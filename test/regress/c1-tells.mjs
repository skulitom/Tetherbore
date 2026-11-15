// Each hand-made strain has a tell: a shape in the ground that says which place this is before its colour does
// (docs/CONTENT-PLAN.md, content item 1; js/world.js: TELLS, and the strains' rows). Here the ground of real
// provinces is counted, on eight seeds, with tools/strains.mjs (which asks the world's own `kindAt`), and each
// strain is held to what was settled for it by counting and by eye, beside its direction's own ground:
//   firn       massive (half the open ground, more dense rock), crossed by rivers of ice two to four cells wide;
//   serac      a mesh of lanes of ice, about 15 cells in a hundred, lying only where plain rock would;
//   scoria     bubbles of one to three cells everywhere, and less lava;
//   forge      more lava in bigger pockets, and more slate;
//   tangle     half of it open: great caves;
//   sporefall  pods in bunches of three and more, where the west's own are nearly all single;
//   redrock    as much slate as the east's own, lying level: long along a row, a cell or two thick;
//   loess      soft and plain: little ore, little slate, few crystals;
// and to what it pays beside its direction's own ground, a cell and a second of cutting.
//   node test/regress/c1-tells.mjs
import { count, mean, share } from '../../tools/strains.mjs';
import { K, B } from '../../js/world.js';

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const counts = count(8), said = {};
const of = id => counts.get(id), pc = (id, ...kinds) => kinds.reduce((sum, k) => sum + of(id).kind[k], 0) / of(id).cells * 100;
for (const id of [1, 2, 3, 4, 17, 18, 19, 20, 21, 22, 23, 24]) check(of(id)?.windows >= 8, `only ${of(id)?.windows ?? 0} provinces of ground ${id} were counted`);
if (!fails.length) {
  const between = (v, lo, hi) => v >= lo && v <= hi, f = v => +v.toFixed(2);
  const pays = id => { const t = of(id), kin = of(id < 19 ? 1 : id < 21 ? 2 : id < 23 ? 3 : 4); return [t.pays[0] / kin.pays[0], t.pays[1] / kin.pays[1]]; };
  const along = (id, k) => mean(of(id).runs[k][0]), down = (id, k) => mean(of(id).runs[k][1]);
  const small = id => of(id).groups[K.EMPTY].filter(n => n <= 3).length / of(id).windows;

  // North.
  check(pc(1, K.ICE) === 0 && pc(2, K.ICE) + pc(3, K.ICE) + pc(4, K.ICE) + pc(19, K.ICE) + pc(23, K.ICE) === 0, 'there is ice in ground that has neither rivers nor lanes');
  said.firn = { ice: f(pc(17, K.ICE)), wide: [f(along(17, K.ICE)), f(down(17, K.ICE))], open: f(pc(17, K.EMPTY)), dense: f(pc(17, K.DENSE)) };
  check(between(pc(17, K.ICE), 3, 7), `firn's rivers are ${pc(17, K.ICE).toFixed(1)} cells in a hundred, not about 5`);
  check(between(along(17, K.ICE), 2.4, 4.5) && between(down(17, K.ICE), 2.4, 4.5), `a river of firn is cut across in ${along(17, K.ICE).toFixed(1)} and ${down(17, K.ICE).toFixed(1)} cells, not two to four`);
  check(pc(17, K.EMPTY) < pc(1, K.EMPTY) - 6 && pc(17, K.DENSE) > pc(1, K.DENSE) + 4, `firn is not massive: ${pc(17, K.EMPTY).toFixed(1)} open and ${pc(17, K.DENSE).toFixed(1)} dense in a hundred, the north's own ${pc(1, K.EMPTY).toFixed(1)} and ${pc(1, K.DENSE).toFixed(1)}`);
  said.serac = { ice: f(pc(18, K.ICE)), wide: [f(along(18, K.ICE)), f(down(18, K.ICE))] };
  check(between(pc(18, K.ICE), 13, 17), `serac's lanes are ${pc(18, K.ICE).toFixed(1)} cells in a hundred, not about 15`);
  check(between(along(18, K.ICE), 1.5, 3) && between(down(18, K.ICE), 1.5, 3), `a lane of serac is ${along(18, K.ICE).toFixed(1)} cells wide, not about two`);
  check(Math.abs(pc(18, K.ORE_A, K.ORE_B, K.SLATE) - pc(1, K.ORE_A, K.ORE_B, K.SLATE)) < 2, 'serac\'s lanes have taken ore or slate: they lie only where plain rock would');

  // South.
  said.scoria = { open: f(pc(19, K.EMPTY)), bubbles: f(small(19)), lava: f(pc(19, K.HAZARD)) };
  check(small(19) > small(2) * 4 && small(19) > 80, `scoria has ${small(19).toFixed(0)} bubbles of one to three cells in a window, the south's own ground ${small(2).toFixed(0)}`);
  check(share(of(19).groups[K.EMPTY], 1, 3) > 0.55, `only ${(share(of(19).groups[K.EMPTY], 1, 3) * 100).toFixed(0)} in a hundred of scoria's open places are bubbles of one to three cells`);
  check(between(pc(19, K.EMPTY) - pc(2, K.EMPTY), 2, 9), `scoria is ${pc(19, K.EMPTY).toFixed(1)} open in a hundred, the south's own ${pc(2, K.EMPTY).toFixed(1)}: not froth`);
  check(pc(19, K.HAZARD) < pc(2, K.HAZARD) * 0.9, `scoria has ${pc(19, K.HAZARD).toFixed(1)} lava in a hundred, the south's own ${pc(2, K.HAZARD).toFixed(1)}: not less`);
  said.forge = { lava: f(pc(20, K.HAZARD)), big: f(share(of(20).groups[K.HAZARD], 4)), slate: f(pc(20, K.SLATE)) };
  check(pc(20, K.HAZARD) > pc(2, K.HAZARD) * 1.25, `forge has ${pc(20, K.HAZARD).toFixed(1)} lava in a hundred, the south's own ${pc(2, K.HAZARD).toFixed(1)}: not more`);
  check(share(of(20).groups[K.HAZARD], 4) > share(of(2).groups[K.HAZARD], 4) && share(of(2).groups[K.HAZARD], 4) > share(of(19).groups[K.HAZARD], 4), 'forge\'s pockets of lava are not bigger than the south\'s own, or scoria\'s not smaller');
  check(pc(20, K.SLATE) > pc(2, K.SLATE) + 1.5, `forge has ${pc(20, K.SLATE).toFixed(1)} slate in a hundred, the south's own ${pc(2, K.SLATE).toFixed(1)}`);

  // West.
  said.tangle = { open: f(pc(21, K.EMPTY)) };
  check(between(pc(21, K.EMPTY), 44, 58) && pc(21, K.EMPTY) > pc(3, K.EMPTY) + 6, `tangle is ${pc(21, K.EMPTY).toFixed(1)} open in a hundred, the west's own ${pc(3, K.EMPTY).toFixed(1)}: not great caves`);
  const bunch = of(22).groups[K.HAZARD], pods = bunch.reduce((a, b) => a + b, 0), hung = bunch.filter(n => n >= 3).reduce((a, b) => a + b, 0);
  said.sporefall = { pods: f(pc(22, K.HAZARD)), bunches: f(bunch.filter(n => n >= 3).length / of(22).windows), hung: f(hung / pods), threeToSix: f(share(bunch.filter(n => n >= 2), 3, 6)) };
  check(hung / pods > 0.5, `only ${(hung / pods * 100).toFixed(0)} in a hundred of sporefall's pods hang in bunches of three and more`);
  check(share(of(3).groups[K.HAZARD], 3) < 0.03, 'the west\'s own pods hang in bunches');
  check(between(bunch.filter(n => n >= 3).length / of(22).windows, 12, 30), `a window of sporefall has ${(bunch.filter(n => n >= 3).length / of(22).windows).toFixed(1)} bunches, not about 20`);
  check(share(bunch.filter(n => n >= 2), 3, 6) > 0.6, `only ${(share(bunch.filter(n => n >= 2), 3, 6) * 100).toFixed(0)} in a hundred of sporefall's bunches are of three to six pods`);
  check(pc(22, K.ORE_A) > pc(3, K.ORE_A) + 0.5, 'sporefall has no more ore than the west\'s own ground');

  // East.
  said.redrock = { slate: f(pc(23, K.SLATE)), along: f(along(23, K.SLATE)), thick: f(down(23, K.SLATE)), lodeAlong: f(along(4, K.SLATE)) };
  check(Math.abs(pc(23, K.SLATE) - pc(4, K.SLATE)) < 3, `redrock has ${pc(23, K.SLATE).toFixed(1)} slate in a hundred, the east's own ${pc(4, K.SLATE).toFixed(1)}`);
  check(along(23, K.SLATE) > 4.5 && down(23, K.SLATE) < 2 && along(23, K.SLATE) > down(23, K.SLATE) * 3, `redrock's slate runs ${along(23, K.SLATE).toFixed(1)} cells along a row and ${down(23, K.SLATE).toFixed(1)} down a column: not level beds`);
  check(along(4, K.SLATE) < down(4, K.SLATE) * 1.5, 'the east\'s own slate lies level');
  said.loess = { soft: f(pc(24, K.SOFT)), ore: f(pc(24, K.ORE_A, K.ORE_B)), slate: f(pc(24, K.SLATE)), crystals: f(pc(24, K.HAZARD)) };
  check(pc(24, K.SOFT) > pc(4, K.SOFT) + 8 && pc(24, K.ORE_A, K.ORE_B) < pc(4, K.ORE_A, K.ORE_B) - 2 && pc(24, K.SLATE) < pc(4, K.SLATE) - 4 && pc(24, K.HAZARD) < pc(4, K.HAZARD) * 0.7,
    `loess is not soft and poor: ${JSON.stringify(said.loess)}`);

  // What each pays beside its direction's own ground: [a cell, a second of cutting], grit alone.
  const PAYS = { 17: [0.85, 0.97], 18: [0.88, 1.0], 19: [0.9, 1.0], 20: [1.2, 1.42], 21: [0.96, 1.1], 22: [1.12, 1.3], 23: [0.93, 1.06], 24: [0.65, 0.8] };
  said.pays = {};
  for (const [id, [lo, hi]] of Object.entries(PAYS)) {
    const [cell, second] = pays(+id);
    said.pays[id] = [f(cell), f(second)];
    check(between(cell, lo, hi), `a cell of ground ${id} pays ${cell.toFixed(2)} of what its direction's own does, not ${lo} to ${hi}`);
    check(+id === 24 ? between(second, 1.5, 1.9) : between(second, lo - 0.08, hi + 0.08), `a second of cutting ground ${id} pays ${second.toFixed(2)} of what its direction's own does`);
  }
}
console.log(JSON.stringify(said));
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: each strain has its tell in the ground of real provinces, and pays as settled beside its direction\'s own');
process.exit(fails.length ? 1 : 0);
