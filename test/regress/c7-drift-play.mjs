// A pumice drift played with no hand on it (docs/CONTENT-PLAN.md, content item 7; tools/drift-play.mjs): the drill
// comes into the cavern, flies once round each boulder down the middle of the lanes, and the boulder is reeled in
// when the tether is round it. In three drifts of world 7 (the north's first, a middling one and one of eight
// boulders):
//   - the frame the drill comes in, every boulder is in the books of loose ground;
//   - every boulder comes home, and every cell of aerolite with it: none is left standing, and the drill cuts no
//     aerolite (it may clip a cell of pumice or of the rock round the drift; no more than two in a drift);
//   - a boulder hauled by itself is a light haul;
//   - the hauls are one chain: each pays its aerolite a fifth more than the one before, as far as double, for as
//     long as they follow within six seconds, and the pilot's all do;
//   - what is banked is the aerolite's lumps at those factors and the specimens of the direction the drift lies
//     in, nine tenths of one a cell;
//   - and the tether is sound all the way.
//   node test/regress/c7-drift-play.mjs
import { C } from '../harness.mjs';
import { play } from '../../tools/drift-play.mjs';

const fails = [], check = (ok, what) => { if (!ok && fails.length < 16) fails.push(what); };
const out = [];
for (const [pick, name, boulders] of [[0, 'the north\'s first drift', 4], [3, 'a drift 21 cells in radius', 7], [12, 'a drift of eight boulders', 8]]) {
  const r = await play(7, pick), Z = r.drift, at = `${name} (${Z.cx - C},${Z.cy - C})`;
  check(r.boulders === boulders && r.books === boulders, `${at}: ${r.boulders} boulders, ${r.books} of them in the books the frame the drill came in`);
  check(!r.stuck && r.left === 0 && r.home === r.aerolite, `${at}: ${r.home} of ${r.aerolite} cells of aerolite came home, ${r.left} boulders are left${r.stuck ? `, the one at ${r.stuck} not reeled` : ''}`);
  check(r.crushed === 0 && r.cut <= 2, `${at}: the drill cut ${r.cut} cells, ${r.crushed} of them aerolite`);
  check(r.faults.length === 0, `${at}: the tether: ${r.faults.join('; ')}`);
  // The chain: every haul is a link (a scrap of rock reeled in on the way is one too), and those that bring
  // aerolite say what their lump was multiplied by.
  let links = 0, top = 0;
  for (const h of r.took) {
    if (h.t > 6) links = 0;
    if (h.minerals) {
      const want = 1 + 0.2 * Math.min(5, links);
      if (Math.abs(h.chain - want) > 1e-9) check(false, `${at}: haul ${r.took.indexOf(h) + 1}, ${h.t.toFixed(1)} s after the one before, paid its lump x${h.chain}, not x${want}`);
      top = Math.max(top, h.chain);
      if (h.n < 12 && !h.light) check(false, `${at}: a haul of ${h.n} cells was not a light one`);
    } else if (h.chain !== 0) check(false, `${at}: a haul with no aerolite in it says its lump was multiplied by ${h.chain}`);
    links++;
  }
  check(r.took.every(h => h.t <= 6) && top >= (boulders >= 6 ? 2 : 1.6), `${at}: the hauls came ${r.took.map(h => h.t.toFixed(1))} s apart, and the lump rose to x${top}`);
  check(Math.abs(r.spec[Z.kin] - 0.9 * r.aerolite) < 1e-6 && r.spec.every((s, kin) => kin === Z.kin || s === 0), `${at}: ${r.aerolite} cells of aerolite banked specimens ${r.spec}`);
  out.push({ name, at: [Z.cx - C, Z.cy - C], boulders: r.boulders, aerolite: r.aerolite, hauls: r.took.length, top, seconds: +r.t.toFixed(1), cut: r.cut });
}
console.log(JSON.stringify(out));
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: every boulder of three drifts comes home in a lap of it, in one chain that pays up to double, with no aerolite cut and the tether sound');
process.exit(fails.length ? 1 : 0);
