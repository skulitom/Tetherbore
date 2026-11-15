// Keystone slabs, as the world lays them (docs/CONTENT-PLAN.md, content item 5; js/world.js: `slabIn`, `slab`,
// `slabCell`, `firstSlab`). test/slab-moat.mjs holds that every slab laid is sound; this holds the rules that
// decide where one is laid and what its ground is, each by a case that would come out otherwise without it:
//   - a slab is not laid where its keys would not hold it, where its crack would not go right round, or where the
//     world would not hold its collar: for sectors where each of those is so, the game lays none, and the same
//     slab laid there all the same is found broken in that way by tools/slabs.mjs;
//   - nor where it would meet a pocket (`meetsPocket`, asked of `zoneOf`: stood in for here), near a wreck, or
//     with its middle in or beside a great cavern;
//   - the slab's own ground and its collar have no cave, no bubble and no find in them, where the ground there
//     would have had; the slab's own has more ore than that ground would, the collar the same;
//   - a cobble field's joints are every fifth row and column, and each whole block has one key of its own, in
//     the joint east of it or south of it;
//   - the first slab lies on the way the seed says, or a quarter of a circle on where the first wreck is near;
//   - a sector's slab is worked out once, however often its cells are asked about.
//   node test/regress/c5-slab-laid.mjs
import { World, N, C, K, SLAB, ZONE, FIRST_R, heading, cellHash as hash } from '../../js/world.js';
import { check, slabsOf } from '../../tools/slabs.mjs';

const fails = [], fail = what => { if (fails.length < 14) fails.push(what); };
const world = seed => { const w = new World(); w.reset(seed); return w; };
const key = (sx, sy) => ((sy + 64) << 7) | (sx + 64);
const out = {};

// 1. What is wrong with a slab that is not laid: [seed, sector x, sector y] for each fault, found by looking.
const FAULTS = {
  keys: [[5, -7, 10], [11, 10, -3], [14, 5, 9]],
  ring: [[17, -2, -9], [66, -9, 9], [195, 7, 1]],
  held: [[43, -7, -1], [69, -5, -1], [107, -12, -1]],
};
const SHOWS = { keys: /does not join the slab to the collar|keys for/, ring: /not a ring a drill can fly/, held: /not held|books find/ };
for (const [fault, cases] of Object.entries(FAULTS)) for (const [seed, sx, sy] of cases) {
  const w = world(seed), at = `seed ${seed} sector ${sx},${sy}`;
  w.unsound = null;
  const before = w.refused[fault], laid = w.slabIn(sx, sy), S = w.unsound;
  if (laid !== null) { fail(`${at}: a slab is laid whose fault is '${fault}'`); continue; }
  if (!S || S.fault !== fault || w.refused[fault] !== before + 1) { fail(`${at}: the slab tried there has fault ${S?.fault}, not '${fault}'`); continue; }
  // The same slab, laid all the same in a world of its own, is broken in just that way.
  const forced = world(seed);
  forced.slabIn(sx, sy);
  forced.slabs.set(key(sx, sy), S);
  const found = check(forced, S).faults;
  if (!found.some(f => SHOWS[fault].test(f))) fail(`${at}: laid all the same, the slab with fault '${fault}' shows: ${found.join('; ') || 'nothing wrong'}`);
  (out.broken ??= {})[fault] = (out.broken[fault] ?? 0) + 1;
}

// 2. Pockets. A slab that is laid, and the same sector with a pocket set against it, and with one set clear of it.
{
  const w = world(7), S = slabsOf(w, 700).find(s => s !== w.firstSlab && !s.cobble), sx = Math.floor((S.cx - C) / SLAB), sy = Math.floor((S.cy - C) / SLAB);
  const withPocket = (px, py, rho) => {
    const v = world(7);
    let asked = 0;
    v.zoneOf = (zx, zy) => { asked++; return zx === Math.floor((px - C) / ZONE) && zy === Math.floor((py - C) / ZONE) ? { key: 'test', row: 32, cx: px, cy: py, rho, kin: 1 } : null; };
    return [v.slabIn(sx, sy), v.refused.pocket, asked];
  };
  const [met, refused, asked] = withPocket(S.cx + S.p + 14, S.cy, 10), [clear] = withPocket(S.cx + S.p + 5 + 12 + 3, S.cy, 10);
  if (met !== null || refused !== 1) fail(`a slab of radius ${S.p} is laid with a pocket of radius 10 whose middle is ${S.p + 14} cells from its own`);
  if (clear === null) fail('a slab is not laid though the pocket beside it is clear of its disc and five cells more');
  if (asked < 1 || asked > 4) fail(`asking whether a slab meets a pocket asked about ${asked} sectors of pockets`);
  if (w.meetsPocket(S.cx, S.cy, 20)) fail('with no pocket laid, a disc meets one');
  out.pocket = { asked };
}

// 3. What stood against the rest, counted: wrecks and caverns each refuse some, and the share laid is what it was.
{
  let tried = 0, laid = 0;
  const why = {};
  for (let seed = 1; seed <= 12; seed++) {
    const w = world(seed);
    for (let sy = -14; sy < 14; sy++) for (let sx = -14; sx < 14; sx++) { if (hash(sx, sy, seed + 80) < 0.22) tried++; if (w.slabIn(sx, sy)) laid++; }
    for (const [k, n] of Object.entries(w.refused)) why[k] = (why[k] ?? 0) + n;
  }
  out.refused = { tried, laid, ...why };
  if (!(why.wreck > 0 && why.cavern > tried * 0.1 && why.cavern < tried * 0.35 && why.keys > 0)) fail(`of ${tried} slabs tried, what stood against them: ${JSON.stringify(why)}`);
  if (laid + Object.values(why).reduce((a, b) => a + b, 0) !== tried) fail('slabs tried are neither laid nor counted as refused');
}

// 4. The ground of a slab and of its collar, beside what would lie there with no slab.
{
  const sum = { cells: 0, caves: 0, finds: 0, oreIn: 0, oreWas: 0, inside: 0, collar: 0, collarSame: 0, open: 0, findLaid: 0 };
  const ore = k => k === K.ORE_A || k === K.ORE_B, find = k => k === K.CACHE || k === K.PRISM;
  for (const seed of [7, 11, 13]) {
    const w = world(seed);
    for (const S of slabsOf(w, 1500)) {
      const R = Math.ceil(S.reach);
      for (let y = S.cy - R; y <= S.cy + R; y++) for (let x = S.cx - R; x <= S.cx + R; x++) {
        const code = w.slabCell(S, x, y);
        if (code < 3) continue;
        const b = w.biomeAt(x, y), k = w.kindAt(x, y, b);
        w.slabHere = null;
        const was = w.kindAt(x, y, b);
        w.slabHere = undefined;
        sum.cells++;
        if (was === K.EMPTY) sum.caves++;
        if (find(was) || (was !== k && w.findAt(x, y) >= 0)) sum.finds++;
        if (k === K.EMPTY) sum.open++;
        if (find(k)) sum.findLaid++;
        if (code === 3) { sum.inside++; if (ore(k)) sum.oreIn++; if (ore(was)) sum.oreWas++; }
        else { sum.collar++; if (k === was || was === K.EMPTY || w.findAt(x, y) >= 0) sum.collarSame++; }
      }
    }
  }
  out.ground = sum;
  if (sum.open) fail(`${sum.open} cells of slabs or their collars are open`);
  if (sum.findLaid) fail(`${sum.findLaid} cells of a find lie in a slab or its collar`);
  if (sum.caves < sum.cells * 0.08 || sum.finds < 20) fail(`the ground the slabs lie in would have had ${sum.caves} open cells and ${sum.finds} cells of finds in ${sum.cells}: too few to say they were kept out`);
  if (sum.oreIn < sum.oreWas * 1.25 || sum.oreIn > sum.oreWas * 2.2) fail(`slabs hold ${sum.oreIn} cells of ore where the ground would have had ${sum.oreWas}: a quarter more at the least, with the thresholds lowered`);
  if (sum.collarSame !== sum.collar) fail(`${sum.collar - sum.collarSame} cells of collar are not what the ground would be there with its caves filled`);
}

// 5. Cobble fields: joints every fifth row and column, one key of its own to a whole block.
{
  let fields = 0, blocks = 0, east = 0, bad = 0, joints = 0;
  const w = world(7);
  for (const S of slabsOf(w, 1500).filter(s => s.cobble)) {
    fields++;
    const keys = new Set(S.keys), R = S.p + 4, kind = (u, v) => w.kindAt(S.cx + u, S.cy + v, w.biomeAt(S.cx + u, S.cy + v));
    for (let v = -R; v <= R; v++) for (let u = -R; u <= R; u++) {
      if (Math.hypot(u, v) >= R) continue;
      const joint = u % 5 === 0 || v % 5 === 0, k = kind(u, v);
      if (joint) { joints++; if (k !== K.EMPTY && k !== K.KEY) bad++; } else if (k === K.EMPTY || k === K.KEY) bad++;
    }
    for (let bv = -4; bv <= 3; bv++) for (let bu = -4; bu <= 3; bu++) {
      // Whole, with the joints east and south of it: every cell well within the field.
      if (Math.hypot(bu * 5 + (bu < 0 ? 0 : 5), bv * 5 + (bv < 0 ? 0 : 5)) >= R - 1) continue;
      let e = 0, s = 0;
      for (let j = 1; j <= 4; j++) { if (keys.has((S.cy + bv * 5 + j) * N + S.cx + bu * 5 + 5)) e++; if (keys.has((S.cy + bv * 5 + 5) * N + S.cx + bu * 5 + j)) s++; }
      blocks++; east += e;
      if (e + s !== 1) fail(`a block of a cobble field has ${e} keys in the joint east of it and ${s} in the joint south`);
    }
  }
  out.cobbles = { fields, blocks, east, joints };
  if (bad) fail(`${bad} cells of cobble fields are not open joint, key or block as the rule says`);
  if (fields < 5 || blocks < 60 || east < blocks * 0.3 || east > blocks * 0.7) fail(`${fields} cobble fields with ${blocks} whole blocks, ${east} of them keyed on the east`);
}

// 6. The first slab: on the way the seed says, or a quarter on.
{
  let turned = 0, straight = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const w = world(seed), S = w.firstSlab, [wx, wy] = w.wrecks[0];
    if (!S) { fail(`seed ${seed}: no first slab`); continue; }
    let n = 0, where = null;
    for (; n < 4; n++) { const [ux, uy] = heading(hash(1, 1, seed + 89) * 4 + n); where = [C + Math.round(ux * FIRST_R), C + Math.round(uy * FIRST_R)]; if (where[0] === S.cx && where[1] === S.cy) break; }
    if (n === 4) { fail(`seed ${seed}: the first slab is on none of the four ways`); continue; }
    if (n) turned++; else straight++;
    // Every way passed over was too near the wreck, or would not have been sound.
    for (let m = 0; m < n; m++) {
      const [ux, uy] = heading(hash(1, 1, seed + 89) * 4 + m), cx = C + Math.round(ux * FIRST_R), cy = C + Math.round(uy * FIRST_R);
      const key = hash(1, 1, seed + 86) * 4;
      if (Math.hypot(cx - wx, cy - wy) >= 25 && !w.slab(cx, cy, 8, false, [key, key + 0.8 + hash(1, 1, seed + 87) * 2.4]).fault) fail(`seed ${seed}: the first slab was turned from a way that was clear of the wreck and sound`);
    }
  }
  out.first = { straight, turned };
  if (turned < 5 || straight < 60) fail(`of 120 first slabs ${straight} lie on the seed's own way and ${turned} a quarter or more on`);
}

// 7. Worked out once: asking about every cell of a slab's sector again tries nothing again.
{
  const w = world(7), S = slabsOf(w, 700)[1], x0 = C + Math.floor((S.cx - C) / SLAB) * SLAB, y0 = C + Math.floor((S.cy - C) / SLAB) * SLAB;
  const tried = w.tried;
  let keys = 0;
  for (let y = y0; y < y0 + SLAB; y++) for (let x = x0; x < x0 + SLAB; x++) if (w.kindAt(x, y, w.biomeAt(x, y)) === K.KEY) keys++;
  for (let id = 0; id < 9; id++) w.piece(((((S.cy >> 6) - 1 + ((id / 3) | 0)) << 8) | ((S.cx >> 6) - 1 + id % 3)));
  if (w.tried !== tried) fail(`asking about a sector's cells again asked about ${w.tried - tried} more cells of ground to try its slab`);
  if (keys !== S.keys.length) fail(`a sector's cells hold ${keys} keys, its slab's record ${S.keys.length}`);
  out.once = { tried, keys };
}

console.log(JSON.stringify(out));
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: a slab is laid only where it is sound and clear, its ground has no cave or find and more ore, a cobble field\'s blocks have a key each, and the first slab lies where the seed says');
process.exit(fails.length ? 1 : 0);
