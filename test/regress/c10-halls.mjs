// The old deep (js/world.js: HALL, HALL_FROM, HALL_SHARE, HALL_NEAR, `hallOf`, `hallCell`; js/game.js: DEEPEN), as
// the world of generation 2 lays it on worlds 1, 7 and 123456, every square of the world asked:
//   - a hall lies only where its square's middle is over 1,600 cells out, and wholly inside its square, its collar
//     too; its walls are a cell thick, or two where the square's middle is within 260 cells of a relic;
//   - each is laid as written: its walls vault but for two doors, each two cells of soft rock across the middle of
//     opposite walls; inside it all open but its store, six cells of rich ore three by two against a wall with no
//     door, so that nothing in it stands free; its collar all ground (no cave, no find opened in it);
//   - its walls are joined to the rock: the ground round its collar, as the world lays it, runs on unbroken, a cell
//     beside the next, twenty-four cells beyond the collar, from a side of the collar and not only a corner of it
//     (and on worlds 2 and 11, where two halls met the rock only at a corner, those two are not laid);
//   - none meets a pocket (no cell of its collar is a pocket's ground), a find (no sector's find has its middle
//     within six cells of its collar), a site (no site's heart within its reach and two), a wreck, a relic's vault
//     or a shrine;
//   - they thicken toward the relics: a larger share of the squares holds one from 1,800 cells out than nearer, and
//     a larger share still within 260 cells of a relic, and there are halls in every direction;
//   - none in an older game's ground (generation 1), nor where a piece its collar touches is of generation 1, and
//     there the cells are what an older game's are;
// and the dark the game draws deepens in the old deep, by a quarter from 2,200 cells out, and not at 1,000.
// Fails on the world before the halls: there is no hall anywhere.
//   node test/regress/c10-halls.mjs
import { world, makeGame } from '../harness.mjs';
const { World, N, C, CH, K, BIOMES, HALL, RELIC_R, SHRINES, FIND, SITE, DX, DY, rowOf } = world;

// The world with no halls in it.
class Bare extends World { hallOf() { return null; } }
const fails = [], check = (ok, what) => { if (!ok && fails.length < 16) fails.push(what); };
if (typeof World.prototype.hallOf !== 'function') {
  console.log('DEFECT: the world lays no builders\' halls (`hallOf`)');
  process.exit(1);
}
// Whether the ground round a hall's collar, as the world lays it, runs on to 24 cells beyond it, a cell joined to the
// next by a side, from the cells against the collar's sides (a corner's cell touches the collar only at a point).
const held = (w, H) => {
  const out = (x, y) => Math.max(H.x0 - 2 - x, x - H.x1 - 2, H.y0 - 2 - y, y - H.y1 - 2, 0), seen = new Set(), list = [];
  for (let y = H.y0 - 3; y <= H.y1 + 3; y++) for (let x = H.x0 - 3; x <= H.x1 + 3; x++) {
    if (out(x, y) !== 1 || ((x === H.x0 - 3 || x === H.x1 + 3) && (y === H.y0 - 3 || y === H.y1 + 3))) continue;
    seen.add(y * N + x);
    if (w.at(x, y) !== K.EMPTY) list.push(x, y);
  }
  while (list.length) {
    const y = list.pop(), x = list.pop();
    if (out(x, y) > 24) return true;
    for (let s = 0; s < 4; s++) {
      const u = x + DX[s], v = y + DY[s];
      if (out(u, v) > 0 && !seen.has(v * N + u) && w.at(u, v) !== K.EMPTY) { seen.add(v * N + u); list.push(u, v); }
    }
  }
  return false;
};
const counts = { inner: [0, 0], outer: [0, 0], relic: [0, 0] }, ways = new Set();
let halls = 0, walls = 0, cells = 0;
for (const seed of [1, 7, 123456]) {
  const w = new World(); w.reset(seed);
  for (let sy = -50; sy < 50; sy++) for (let sx = -50; sx < 50; sx++) {
    const mx = sx * HALL + HALL / 2, my = sy * HALL + HALL / 2, far = Math.hypot(mx, my), relic = Math.min(...[0, 1, 2, 3].map(d => Math.hypot(mx - DX[d] * RELIC_R, my - DY[d] * RELIC_R)));
    const H = w.hallOf(sx, sy), where = `seed ${seed} square ${sx},${sy}`;
    if (far > 1600 && far < 2200) { const band = relic < 260 ? counts.relic : far >= 1800 ? counts.outer : counts.inner; band[1]++; if (H) band[0]++; }
    if (!H) continue;
    halls++;
    check(far > 1600, `${where}: a hall ${Math.round(far)} cells out`);
    check(H.wall === (relic < 260 ? 2 : 1), `${where}: its walls are ${H.wall} thick, ${Math.round(relic)} cells from a relic`);
    const x0 = C + sx * HALL, y0 = C + sy * HALL;
    check(H.x0 - 2 >= x0 && H.y0 - 2 >= y0 && H.x1 + 2 < x0 + HALL && H.y1 + 2 < y0 + HALL, `${where}: the hall at ${H.x0 - C},${H.y0 - C} to ${H.x1 - C},${H.y1 - C} runs out of its square`);
    ways.add(Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 'east' : 'west') : (my > 0 ? 'south' : 'north'));
    // Its cells, as the world lays them.
    const t = H.wall, wide = H.x1 - H.x0 + 1, high = H.y1 - H.y0 + 1, doors = [], store = [];
    for (let y = H.y0; y <= H.y1; y++) for (let x = H.x0; x <= H.x1; x++) {
      const u = x - H.x0, v = y - H.y0, k = w.at(x, y), wall = u < t || v < t || u >= wide - t || v >= high - t;
      cells++;
      if (wall) { if (k === K.SOFT) doors.push([u, v]); else check(k === K.VAULT, `${where}: its wall at ${u},${v} is ${k}`); walls++; }
      else if (k === K.ORE_B) store.push([u, v]);
      else check(k === K.EMPTY, `${where}: inside it at ${u},${v} is ${k}`);
    }
    // The doors: two of two cells each, through the wall, across the middle of two opposite walls.
    const west = doors.filter(([u]) => u < t), east = doors.filter(([u]) => u >= wide - t), north = doors.filter(([, v]) => v < t), south = doors.filter(([, v]) => v >= high - t);
    const across = (list, along, size) => list.length === 2 * t && new Set(list.map(p => p[along])).size === 2 && list.every(p => Math.abs(p[along] - (size - 1) / 2) <= 1);
    const ew = across(west, 1, high) && across(east, 1, high) && !north.length && !south.length, ns = across(north, 0, wide) && across(south, 0, wide) && !west.length && !east.length;
    check(ew || ns, `${where}: its doors are ${JSON.stringify(doors)}`);
    // The store: three by two, against a wall that has no door.
    const us = store.map(p => p[0]), vs = store.map(p => p[1]), su = Math.max(...us) - Math.min(...us) + 1, sv = Math.max(...vs) - Math.min(...vs) + 1;
    const against = ew ? Math.min(...vs) === t || Math.max(...vs) === high - 1 - t : Math.min(...us) === t || Math.max(...us) === wide - 1 - t;
    check(store.length === 6 && su * sv === 6 && (ew ? su === 3 : sv === 3) && against, `${where}: its store is ${JSON.stringify(store)}`);
    // Its collar is all ground, and the ground round that runs on.
    const out = (x, y) => Math.max(H.x0 - 2 - x, x - H.x1 - 2, H.y0 - 2 - y, y - H.y1 - 2, 0), inner = (x, y) => Math.max(H.x0 - x, x - H.x1, H.y0 - y, y - H.y1, 0);
    let open = 0, pocket = 0;
    for (let y = H.y0 - 2; y <= H.y1 + 2; y++) for (let x = H.x0 - 2; x <= H.x1 + 2; x++) {
      if (rowOf(w.biomeAt(x, y)).pocket !== null) pocket++;
      if (inner(x, y) > 0 && w.at(x, y) === K.EMPTY) open++;
    }
    check(!open && !pocket, `${where}: its collar has ${open} open cells and ${pocket} of a pocket's ground`);
    check(held(w, H), `${where}: the hall at ${H.x0 - C},${H.y0 - C} hangs on nothing`);
    // Clear of what else lies there.
    for (let fy = sy - 1; fy <= sy + 1; fy++) for (let fx = sx - 1; fx <= sx + 1; fx++) {
      const [what, x, y] = w.findSpot(fx, fy);
      check(what === null || out(x, y) >= 6, `${where}: a ${what} lies ${out(x, y)} cells from its collar`);
    }
    for (let ty = Math.floor((H.y0 - 20 - C + SITE / 2) / SITE); ty <= Math.floor((H.y1 + 20 - C + SITE / 2) / SITE); ty++) for (let tx = Math.floor((H.x0 - 20 - C + SITE / 2) / SITE); tx <= Math.floor((H.x1 + 20 - C + SITE / 2) / SITE); tx++) {
      const S = w.siteOf(tx, ty);
      check(!S || out(S.cx, S.cy) >= S.reach + 2, `${where}: a site's heart lies ${S && out(S.cx, S.cy)} cells from its collar`);
    }
    for (const [x, y] of w.wrecks) check(out(x, y) >= 5, `${where}: a wreck lies ${out(x, y)} cells from its collar`);
    for (let d = 0; d < 4; d++) check(out(C + DX[d] * RELIC_R, C + DY[d] * RELIC_R) >= 7 && out(C + SHRINES[d][0], C + SHRINES[d][1]) >= 7, `${where}: a relic or a shrine lies by it`);
  }
  // Generation 1: no hall anywhere. And with one piece its collar touches of generation 1 (the one holding its
  // north-west corner) a hall is not laid, and its cells are what the world lays with no hall there.
  const old = new World(); old.reset(seed); old.genOf.fill(1);
  let none = true, same = 0, tried = 0;
  for (let sy = -50; sy < 50; sy++) for (let sx = -50; sx < 50; sx++) if (old.hallOf(sx, sy)) none = false;
  for (let sy = -50; sy < 50 && tried < 6; sy++) for (let sx = -50; sx < 50 && tried < 6; sx++) {
    const H = w.hallOf(sx, sy);
    if (!H) continue;
    tried++;
    const part = new World(), bare = new Bare(), corner = (((H.y0 - 2) >> 6) << 8) | ((H.x0 - 2) >> 6);
    part.reset(seed); bare.reset(seed); part.genOf[corner] = bare.genOf[corner] = 1; part.forget(); bare.forget();
    check(part.hallOf(sx, sy) === null, `seed ${seed} square ${sx},${sy}: a hall is laid with a piece of generation 1 under its corner`);
    for (let y = H.y0 - 2; y <= H.y1 + 2; y++) for (let x = H.x0 - 2; x <= H.x1 + 2; x++) if (part.kindAt(x, y, part.biomeAt(x, y)) !== bare.kindAt(x, y, bare.biomeAt(x, y))) same++;
  }
  check(!same, `seed ${seed}: ${same} cells of halls not laid are not the ground laid with none`);
  check(none, `seed ${seed}: generation 1 lays halls`);
}
check(halls > 600 && walls > 50000, `only ${halls} halls were laid, with ${walls} cells of wall`);
// Two squares, on worlds 2 and 11, where the rock round a hall met its collar only at a corner, the hall and its
// collar standing free in a cavern: no hall is laid there, or it is held by a side.
for (const [seed, sx, sy] of [[2, 21, -35], [11, -47, -1]]) {
  const w = new World(); w.reset(seed);
  const H = w.hallOf(sx, sy);
  check(H === null || held(w, H), `seed ${seed} square ${sx},${sy}: the hall at ${H?.x0 - C},${H?.y0 - C} meets the rock only at a corner of its collar`);
}
check(ways.size === 4, `halls lie only ${[...ways]}`);
const share = ([n, of]) => n / of;
check(share(counts.inner) > 0.04 && share(counts.outer) > share(counts.inner) * 1.4 && share(counts.relic) > share(counts.outer) * 1.2,
  `the share of the squares that hold a hall: ${(share(counts.inner) * 100).toFixed(1)}% from 1,600 cells out, ${(share(counts.outer) * 100).toFixed(1)}% from 1,800, ${(share(counts.relic) * 100).toFixed(1)}% near a relic`);

// The dark the game draws: deeper by a quarter from 2,200 cells out, as deep as the ground's own at 1,000.
{
  const game = await makeGame(7), d = game.drill;
  const murk = (x, y) => {
    d.x = C + x + 0.5; d.y = C + y + 0.5;
    const dark = game.world.row(game.di).dark;
    for (let n = 0; n < 200; n++) game.ambient(0.05);
    return game.murk / dark;
  };
  const near = murk(1000, 0), deep = murk(0, 2250), middle = murk(-1900, 0);
  check(Math.abs(near - 1) < 0.01 && Math.abs(deep - 1.25) < 0.01 && Math.abs(middle - (1 + 0.25 * 300 / 600)) < 0.01, `the dark is ${near.toFixed(3)} of the ground's own at 1,000 cells out, ${middle.toFixed(3)} at 1,900, ${deep.toFixed(3)} at 2,250`);
}

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : `ok: ${halls} builders' halls (${(share(counts.inner) * 100).toFixed(1)}% of the squares from 1,600 cells out, ${(share(counts.outer) * 100).toFixed(1)}% from 1,800, ${(share(counts.relic) * 100).toFixed(1)}% near a relic), each laid as written, held, and clear of all else; none at generation 1; and the dark deeper in the old deep`);
process.exit(fails.length ? 1 : 0);
