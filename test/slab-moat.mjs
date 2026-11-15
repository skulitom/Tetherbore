// Keystone slabs and cobble fields as they lie in the world's own cells, on 200 worlds (docs/CONTENT-PLAN.md,
// content item 5). Of every slab looked at (tools/slabs.mjs: `check`):
//   - the crack, with the keys cut, is one ring of open cells joined side to side right round the slab: a way a
//     drill 0.68 of a cell wide can fly, shut in by the slab and its collar;
//   - the slab is one piece of ground with no open cell in it, it touches other ground only through its keys, and
//     with the keys cut the game's own books (`World.freed`) find it loose, whole and alone;
//   - each key joins the slab to the collar, and the keys lie 60 degrees apart or more;
//   - the collar has no open cell, is one piece, and is held by the world: the ground beside it runs on unbroken
//     48 cells beyond the slab's own (and, counted here and not required, twice that).
// Of every cobble field: no block floats, and the keys against a whole block, cut, leave that block loose and whole.
// And of where they lie: one first slab in every world, 52 cells from the core, clear of the first wreck and with
// all of it within the fourth reach (72); the others wholly inside their sectors, over 60 cells from the core,
// clear of wrecks, of the relics' vaults and of the first slab, and in about a sector in six.
//
// In each world the first slab is looked at, every slab within 700 cells of the core, and every seventh beyond.
//   node test/slab-moat.mjs [seeds: 200] [first seed: 1]
import { World, N, C, K, SLAB, FIRST_R, HOLD, RELIC_R, DX, DY } from '../js/world.js';
import { slabsOf, check } from '../tools/slabs.mjs';

const seeds = Number(process.argv[2] ?? 200), from = Number(process.argv[3] ?? 1), fails = [], kinds = new Map();
const fail = (seed, S, what) => { const kind = what.replace(/\d+/g, '#'); kinds.set(kind, (kinds.get(kind) ?? 0) + 1); if (fails.length < 12) fails.push(`seed ${seed}${S ? ` at ${S.cx - C},${S.cy - C}` : ''}: ${what}`); };
const tally = { slabs: 0, cobbles: 0, three: 0, firsts: 0, looked: 0, cells: 0, keyCells: 0, blocks: 0, heldTwice: 0, sectors: 0, laid: 0, turned: 0 };
let least = 1, most = 0, tried = 0;
for (let seed = from; seed < from + seeds; seed++) {
  const w = new World(); w.reset(seed);
  const first = w.firstSlab, all = slabsOf(w, 2300);
  for (let sy = -16; sy < 16; sy++) for (let sx = -16; sx < 16; sx++) if (Math.hypot((sx + 0.5) * SLAB, (sy + 0.5) * SLAB) <= 2200) { tally.sectors++; if (w.slabIn(sx, sy)) tally.laid++; }
  tried += w.tried;
  if (!first) { fail(seed, null, 'there is no first slab'); continue; }
  tally.firsts++;
  // The first slab: where the plan puts it.
  {
    const r = Math.hypot(first.cx - C, first.cy - C), [wx, wy] = w.wrecks[0];
    if (Math.abs(r - FIRST_R) > 1 || first.p !== 8 || first.cobble || first.ux.length !== 2) fail(seed, first, `the first slab is ${r.toFixed(1)} out, ${first.p} in radius, with ${first.ux.length} keys`);
    if (Math.hypot(first.cx - wx, first.cy - wy) < 25) fail(seed, first, 'the first slab is within 25 cells of the first wreck');
    let reach = 0;
    for (let y = first.cy - 14; y <= first.cy + 14; y++) for (let x = first.cx - 14; x <= first.cx + 14; x++) if (w.slabCell(first, x, y)) reach = Math.max(reach, Math.hypot(x + 0.5 - C - 0.5, y + 0.5 - C - 0.5));
    if (reach > 70) fail(seed, first, `the first slab runs ${reach.toFixed(1)} cells out: not all within a reach of 72`);
    if (w.kindAt(first.cx, first.cy, w.biomeAt(first.cx, first.cy)) === K.EMPTY) fail(seed, first, 'the first slab is not laid in the ground');
    const way = (first.cx - C) * (wx - C) + (first.cy - C) * (wy - C);
    if (way > 0 && Math.hypot(first.cx - wx, first.cy - wy) < 45) tally.turned++;
  }
  all.forEach((S, n) => {
    const r = Math.hypot(S.cx - C, S.cy - C);
    if (S !== first) {
      tally[S.cobble ? 'cobbles' : 'slabs']++;
      // Where it lies: wholly inside its sector, and clear of what it must be clear of.
      const ux = ((S.cx - C) % SLAB + SLAB) % SLAB, uy = ((S.cy - C) % SLAB + SLAB) % SLAB, near = (x, y) => Math.hypot(S.cx - x, S.cy - y);
      if (S.p < 8 || S.p > 16 || ux < 40 || uy < 40 || ux >= SLAB - 40 || uy >= SLAB - 40 || S.reach > 40) fail(seed, S, `a slab of radius ${S.p} has its middle ${ux},${uy} into its sector`);
      if (r <= 60) fail(seed, S, 'a slab is within 60 cells of the core');
      if (w.wrecks.some(([x, y]) => near(x, y) < 40 + S.p) || [0, 1, 2, 3].some(d => near(C + DX[d] * RELIC_R, C + DY[d] * RELIC_R) < 40 + S.p)) fail(seed, S, 'a slab is within 40 cells and its radius of a wreck or a vault');
      if (near(first.cx, first.cy) < 44 + S.p) fail(seed, S, 'a slab is within 44 cells and its radius of the first slab');
      if (!S.cobble && S.ux.length !== (S.p > 12 ? 3 : 2)) fail(seed, S, `a slab of radius ${S.p} has ${S.ux.length} keys`);
      if (!S.cobble && S.ux.length === 3) tally.three++;
    }
    // Its keys' ways: 60 degrees apart or more (the cosine of the angle between two is a half or less).
    for (let a = 0; a < S.ux.length; a++) for (let b = a + 1; b < S.ux.length; b++) {
      const cos = S.ux[a] * S.ux[b] + S.uy[a] * S.uy[b];
      most = Math.max(most, cos);
      if (cos > 0.5) fail(seed, S, `two keys lie under 60 degrees apart (cosine ${cos.toFixed(3)})`);
    }
    for (let a = 0; a < S.ux.length; a++) least = Math.min(least, Math.abs(Math.hypot(S.ux[a], S.uy[a]) - 1) < 1e-12 ? least : 0);
    if (S !== first && r > 700 && n % 7) return;
    const c = check(w, S);
    tally.looked++; tally.cells += c.inside; tally.keyCells += c.keys; tally.blocks += c.blocks ?? 0;
    if (S.cobble && c.loose !== c.blocks) fail(seed, S, `${c.blocks - c.loose} of ${c.blocks} whole blocks do not come loose by their keys`);
    for (const f of c.faults) fail(seed, S, f);
    if (!c.faults.length && !check(w, S, 2 * HOLD).faults.length) tally.heldTwice++;
  });
}
const share = tally.laid / tally.sectors, any = tally.slabs + tally.cobbles;
if (tally.firsts !== seeds) fails.push(`${seeds - tally.firsts} worlds have no first slab`);
if (share < 0.13 || share > 0.2) fails.push(`${(share * 100).toFixed(1)} sectors in a hundred hold a slab: about a sixth should (22 in a hundred are tried)`);
if (tally.cobbles < any * 0.27 || tally.cobbles > any * 0.43) fails.push(`${tally.cobbles} of ${any} are cobble fields: about 35 in a hundred should be`);
if (tally.three < tally.slabs * 0.3 || tally.three > tally.slabs * 0.6) fails.push(`${tally.three} of ${tally.slabs} slabs have three keys`);
if (least !== 1) fails.push('a key\'s way is not a unit vector');
if (tally.heldTwice < tally.looked * 0.97) fails.push(`only ${tally.heldTwice} of ${tally.looked} are held ${2 * HOLD} cells out as well`);
// Trying a slab is work done once for a sector: counted in cells of ground asked about, never timed.
if (tried / (any + tally.firsts) > 600) fails.push(`laying a slab asked about ${Math.round(tried / (any + tally.firsts))} cells of ground on average: a few hundred at the most`);
console.log(JSON.stringify({ seeds, from, ...tally, share: +share.toFixed(3), closestKeysCosine: +most.toFixed(3), cellsAskedPerSlab: Math.round(tried / (any + tally.firsts)), faults: Object.fromEntries(kinds) }));
console.log(fails.length || kinds.size ? `DEFECT: ${fails.join('\n        ')}` : `ok: on ${seeds} worlds every slab looked at (${tally.looked}) has a crack a drill can fly right round, hangs by its keys alone and is held by the world`);
process.exit(fails.length || kinds.size ? 1 : 0);
