// The four rare hazards as they lie in the ground (js/world.js: `World.siteOf`, SITE_SHAPES, K.RARE), checked on the
// world's own cells, in every site of worlds 1 to 8:
//   - how many: 30 to 60 sites a world, four or more of each type, and the four heralds, one of each type, each
//     in its own direction about 594 cells out;
//   - where: 450 cells out or more, in one direction's ground seven cells each way from the middle (and the type
//     is that direction's), no pocket's cell, slab's cell or find within reach, 44 cells or more from a wreck or a
//     relic;
//   - the heart is K.RARE, its hazard is the site's type, and seeing it tells of the type once, naming the heart;
//   - each shape as written: a cell within a site's reach is what its shape lays wherever the ground would be
//     solid, and as the ground would be wherever it lays nothing; a site opens no cell;
//   - nothing outside a site moved: every piece a site lies in, and the slabs round the core, are as a world with
//     no sites makes them, but for the sites' own cells.
// What each cell is, cell for cell, test/regress/w-same-world.mjs holds; where they lie, `node tools/sites.mjs`.
//   node test/regress/c9-rare-laid.mjs
import { World, N, C, K, B, CH, CW, FIND, RELIC_R, DX, DY, RARE, HAZARDS, SITE_SHAPES, rowOf, cellHash } from '../../js/world.js';

const fails = [], check = (ok, what) => { if (!ok && fails.length < 16) fails.push(what); };
class NoSite extends World { siteOf() { return null; } }
const TYPES = RARE.slice(1), REACH = { bell: 5, vent: 3, worm: 4, lodestone: 6 };
// The shapes as the plan writes them: a kind, or -1 where the ground is as it would be.
const plan = (type, u, v, x, y, seed, hash) => {
  const d2 = u * u + v * v;
  if (d2 === 0) return K.RARE;
  if (type === 'bell') return d2 <= 10 ? (hash(x, y, seed + 70) < 0.3 ? K.ORE_B : K.DENSE) : d2 >= 12 && d2 <= 20 ? K.ICE : -1;
  if (type === 'vent') return d2 <= 2 ? K.SLAG : d2 <= 9 ? (d2 >= 4 && hash(x, y, seed + 71) < 0.15 ? K.ORE_B : hash(x, y, seed + 72) < 0.6 ? K.BASALT : K.DENSE) : -1;
  if (type === 'worm') return d2 <= 4 ? K.SOFT : d2 <= 13 && hash(x, y, seed + 73) < 0.25 ? K.ORE_A : -1;
  return d2 >= 4 && d2 <= 36 && (u === 0 || v === 0 || Math.abs(u) === Math.abs(v)) ? (hash(x, y, seed + 74) < 0.75 ? K.ORE_B : K.ORE_A) : -1;
};
// How many cells each shape lays, before the caves take any: the spokes of a lodestone are 32.
const spread = Object.fromEntries(TYPES.map(t => { let n = 0; for (let v = -6; v <= 6; v++) for (let u = -6; u <= 6; u++) if (u * u + v * v <= REACH[t] ** 2 && plan(t, u, v, 0, 0, 0, () => 0.5) >= 0) n++; return [t, n]; }));
check(spread.lodestone === 33 && spread.bell === 1 + 36 + 32 && spread.vent === 1 + 8 + 20 && spread.worm === 13, `the shapes lay ${JSON.stringify(spread)} cells`);
for (const t of TYPES) check(HAZARDS[t].rare && SITE_SHAPES[t], `${t} is not a rare hazard with a shape`);

const counts = [], totals = Object.fromEntries(TYPES.map(t => [t, 0]));
let sites = 0, cells = 0, moved = 0, opened = 0, pieces = 0, wrongShape = 0, outside = 0, slabsSame = 0;
for (let seed = 1; seed <= 8; seed++) {
  const w = new World(), bare = new NoSite(); w.reset(seed); bare.reset(seed);
  const list = w.sitesWithin(2400), types = Object.fromEntries(TYPES.map(t => [t, 0]));
  counts.push(list.length);
  check(list.length >= 30 && list.length <= 60, `seed ${seed}: ${list.length} sites`);
  // The heralds: one of each type, in its own direction, about 594 cells out.
  const heralds = list.filter(S => S.herald);
  check(heralds.length === 4 && TYPES.every(t => heralds.some(S => S.type === t)), `seed ${seed}: the heralds are ${heralds.map(S => S.type)}`);
  for (const S of heralds) {
    const dx = S.cx - C, dy = S.cy - C, kin = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? B.LODE : B.MIRE) : (dy < 0 ? B.FROST : B.EMBER), r = Math.hypot(dx, dy);
    check(RARE[kin] === S.type && r > 560 && r < 630, `seed ${seed}: the ${S.type} herald lies at ${dx},${dy}`);
  }
  const ids = new Set();
  for (const S of list) {
    sites++; types[S.type]++; totals[S.type]++;
    const dx = S.cx - C, dy = S.cy - C, row = rowOf(w.biomeAt(S.cx, S.cy)), where = `seed ${seed} ${S.type} at ${dx},${dy}`;
    check(Math.hypot(dx, dy) >= 449 && S.reach === REACH[S.type] && RARE[row.kin] === S.type && row.pocket === null, `${where}: ${Math.round(Math.hypot(dx, dy))} out, in ${row.name}`);
    for (let d = 0; d < 4; d++) check(rowOf(w.biomeAt(S.cx + DX[d] * 8, S.cy + DY[d] * 8)).kin === row.kin, `${where}: the ground beside it is another direction's`);
    check(![...w.wrecks, ...[0, 1, 2, 3].map(d => [C + DX[d] * RELIC_R, C + DY[d] * RELIC_R])].some(([x, y]) => Math.hypot(S.cx - x, S.cy - y) < 42), `${where}: a wreck or a relic is near`);
    for (let fy = Math.floor((S.cy - 12 - C) / FIND); fy <= Math.floor((S.cy + 12 - C) / FIND); fy++) for (let fx = Math.floor((S.cx - 12 - C) / FIND); fx <= Math.floor((S.cx + 12 - C) / FIND); fx++) {
      const [what, x, y, size] = w.findSpot(fx, fy);
      check(!what || Math.hypot(x - S.cx, y - S.cy) > S.reach + size + 1, `${where}: a ${what} lies within reach`);
    }
    for (let y = S.cy - 6; y <= S.cy + 6; y++) for (let x = S.cx - 6; x <= S.cx + 6; x++) {
      ids.add(((y >> 6) << 8) | (x >> 6));
      if ((x - S.cx) ** 2 + (y - S.cy) ** 2 > S.reach ** 2) continue;
      const b = w.biomeAt(x, y);
      check(rowOf(b).pocket === null && w.slabAt(x, y) === 0, `${where}: cell ${x - C},${y - C} is a pocket's or a slab's`);
      const k = w.at(x, y), was = bare.at(x, y), want = plan(S.type, x - S.cx, y - S.cy, x, y, seed, cellHash);
      cells++;
      if (was === K.EMPTY) { if (k !== K.EMPTY) opened++; continue; }
      if (k !== (want >= 0 ? want : was)) wrongShape++;
    }
    const heart = S.cy * N + S.cx;
    check(w.k(heart) === K.RARE && w.hazAt(heart) === S.type, `${where}: its heart is kind ${w.k(heart)}, hazard ${w.hazAt(heart)}`);
    // Seen: told of once, as its type, naming the heart.
    w.spotted.length = 0; w.see(S.cx, S.cy, S.reach + 1);
    const told = w.spotted.filter(([what]) => TYPES.includes(what));
    check(told.length === 1 && told[0][0] === S.type && told[0][1] === heart && told[0][2] === heart, `${where}: seen, it was told of as ${JSON.stringify(told)}`);
  }
  for (const t of TYPES) check(types[t] >= 4, `seed ${seed}: ${types[t]} ${t}s`);
  // Nothing else moved: every cell of every piece a site lies in, but the sites' own.
  for (const id of ids) {
    const a = w.piece(id), b = bare.piece(id), x0 = (id % CW) * CH, y0 = ((id / CW) | 0) * CH;
    pieces++;
    for (let at = 0; at < CH * CH; at++) {
      if (a.biome[at] !== b.biome[at]) outside++;
      if (a.kind[at] === b.kind[at]) continue;
      moved++;
      if (w.siteAt(x0 + (at & 63), y0 + (at >> 6)) === null || a.kind[at] === K.EMPTY || b.kind[at] === K.EMPTY) outside++;
    }
  }
  if (seed <= 2) for (let sy = -6; sy < 6; sy++) for (let sx = -6; sx < 6; sx++) {
    const S = w.slabIn(sx, sy), T = bare.slabIn(sx, sy);
    if (JSON.stringify(S && [S.cx, S.cy, S.p, S.cobble, S.keys]) === JSON.stringify(T && [T.cx, T.cy, T.p, T.cobble, T.keys])) slabsSame++;
    else check(false, `seed ${seed}: the slab of sector ${sx},${sy} moved`);
  }
}
check(opened === 0 && wrongShape === 0, `of ${cells} cells within the sites' reach, ${opened} were opened and ${wrongShape} are not what the shapes lay`);
check(outside === 0 && moved > 0, `${outside} of the ${moved} cells that moved lie outside a site, or were opened or closed, or a ground moved`);
check(K.RARE === 28, 'K.RARE is not kind 28');

console.log(JSON.stringify({ sites, perWorld: counts, ...totals, cells, moved, pieces, slabsSame }));
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : `ok: ${sites} sites on worlds 1 to 8 (${Math.min(...counts)} to ${Math.max(...counts)} a world), every type four times or more and a herald of each, each shaped as written, and nothing outside them moved`);
process.exit(fails.length ? 1 : 0);
