// A ground may have a second hazard (its row's `haz2`), whose cells are K.HAZARD2. It is laid from seeds of its own
// and gives way to the first, so adding one to a row moves nothing else: every cell is what it was, but for soft
// rock, dense rock and ore that became the second hazard. And what a hazard cell does, pays and looks like is its
// type's, whichever of the two it is and whatever ground it lies in.
//   node test/regress/s1-second-hazard.mjs
import { makeGame, world, C, N } from '../harness.mjs';
import { arena, rect, at, fixRandom } from './lib/lasso.mjs';
const { World, K, B, BIOMES, biome, hazOf } = world;

fixRandom(5);
const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const looks = { sheet: 'frost', floor: 'frost-floor', gloom: [5, 12, 30], mote: ['#ffffff', 'fall'], map: [1, 2, 3], debris: ['#000000'] }, gen = BIOMES[1].gen;
const lava = { type: 'lava', rate: 1, t: 0.78 }, spore = { type: 'spore', rate: 1 };
const rows = {
  lavaOnly: biome({ id: 120, name: 'test-lava', kin: B.FROST, gen, haz: lava, ...looks }),
  lavaSpark: biome({ id: 121, name: 'test-lava-spark', kin: B.FROST, gen, haz: lava, haz2: { type: 'spark', rate: 1 }, ...looks }),
  sporeOnly: biome({ id: 122, name: 'test-spore', kin: B.FROST, gen, haz: spore, ...looks }),
  sporeLava: biome({ id: 123, name: 'test-spore-lava', kin: B.FROST, gen, haz: spore, haz2: { type: 'lava', rate: 1, t: 0.74 }, ...looks }),
  sporeSpore: biome({ id: 124, name: 'test-spore-twice', kin: B.FROST, gen, haz: spore, haz2: { type: 'spore', rate: 2 }, ...looks }),
};

// The ground: 40,000 cells 700 out, laid with and without the second hazard.
const plain = new Set([K.SOFT, K.DENSE, K.ORE_A, K.ORE_B]);
const compare = (one, two) => {
  const world = new World(); world.reset(3);
  let first = 0, second = 0, host = 0, moved = 0, onFirst = 0;
  for (let y = C - 100; y < C + 100; y++) for (let x = C + 600; x < C + 800; x++) {
    const a = world.kindAt(x, y, one.id), b = world.kindAt(x, y, two.id);
    if (plain.has(a)) host++;
    if (a === K.HAZARD) first++;
    if (b === K.HAZARD2) { second++; if (a === K.HAZARD) onFirst++; else if (!plain.has(a)) moved++; }
    else if (a !== b) moved++;
  }
  return { first, second, share: second / host, moved, onFirst };
};
const spark = compare(rows.lavaOnly, rows.lavaSpark), pour = compare(rows.sporeOnly, rows.sporeLava), twice = compare(rows.sporeOnly, rows.sporeSpore);
console.log(JSON.stringify({ spark, pour, twice }));
check(spark.first > 100 && pour.first > 100, 'the first hazard was not laid where this was checked');
check(spark.moved === 0 && pour.moved === 0 && twice.moved === 0, `a second hazard moved ${spark.moved + pour.moved + twice.moved} cells that are not soft rock, dense rock or ore turned to it`);
check(spark.onFirst === 0 && pour.onFirst === 0 && twice.onFirst === 0, 'a second hazard lies on a cell of the first');
check(Math.abs(spark.share - 0.026) < 0.004, `charged crystals as a second hazard are ${(spark.share * 100).toFixed(2)}% of plain ground, not 2.6%`);
check(Math.abs(twice.share - 0.044) < 0.006, `spore pods at twice the rate are ${(twice.share * 100).toFixed(2)}% of plain ground, not 4.4%`);
check(pour.second > 100, `lava as a second hazard made ${pour.second} cells`);
// Today's grounds have none: not one cell of K.HAZARD2 in them.
{
  const world = new World(); world.reset(3);
  let n = 0;
  for (let b = 0; b <= 8; b++) for (let y = C - 40; y < C + 40; y++) for (let x = C + 660; x < C + 740; x++) n += world.kindAt(x, y, b) === K.HAZARD2;
  check(n === 0, `grounds 0 to 8 hold ${n} cells of a second hazard`);
}

// The game: a field of each ground, with hazards set in it by hand.
const game = await makeGame(7), w = game.world, S = game.S;
arena(game, 40, K.SOFT, rows.lavaSpark.id);
rect(game, -40, 12, 40, 40, K.SOFT, rows.sporeLava.id);
rect(game, -40, -40, 40, -12, K.SOFT, B.FROST);
game.changed();
// Charged crystals as the second hazard: a cut beside one lights its fuse; a cut into one arcs to the others near.
const a = at(20, 0), b = at(22, 1), far = at(30, 0);
for (const i of [a, b, far]) w.setK(i, K.HAZARD2);
check(w.hazAt(a) === 'spark' && hazOf(K.HAZARD, rows.lavaSpark) === 'lava', `a second-hazard cell reads as ${w.hazAt(a)}`);
game.finishDig(at(19, 0));
check(game.sparks.has(a) && w.k(a) === K.HAZARD2, 'a cut beside a charged crystal that is a second hazard did not light its fuse');
game.updateHazards(0.05);
check(game.sparks.has(a), 'the fuse of a second-hazard crystal was put out');
game.sparks.clear();
game.finishDig(a);
check(game.sparks.has(b) && !game.sparks.has(far), 'a cut into a charged crystal did not arc to the crystal two cells off, or arced to one ten off');
// Lava as the second hazard, and spore pods as the first, in the ground to the south.
const pocket = at(-20, 20), pod = at(-20, 26);
w.setK(pocket, K.HAZARD2); w.setK(pod, K.HAZARD);
game.finishDig(at(-19, 20));
check(w.lava.has(pocket) && w.k(pocket) === K.EMPTY && game.lavaVol.get(pocket) === 5, 'a cut beside a lava pocket that is a second hazard did not open it');
game.finishDig(at(-19, 26));
check(game.clouds.length === 1 && w.k(pod) === K.EMPTY, 'a cut beside a spore pod did not burst it');
// The glow of what a cut would free counts a lava pocket beside it as gone, whichever hazard it is.
// (A cell of rock hangs on a pocket that hangs on the cell to be cut: the glow is the rock alone.)
rect(game, -11, 19, -9, 19, K.EMPTY); rect(game, -11, 21, -9, 21, K.EMPTY); w.setK(at(-9, 20), K.EMPTY); w.setK(at(-11, 20), K.HAZARD2);
game.changed();
game.foresee(at(-12, 20));
check(JSON.stringify(game.preview[0].cells) === JSON.stringify([at(-10, 20)]), `the glow of a cut beside a lava pocket that is a second hazard is ${game.preview[0].cells.length} cells, not the one that hangs on the pocket`);
// In ground that has no such hazard, a hazard cell is inert: it wakes nothing and is drawn as nothing.
const inert = at(20, -20); w.setK(inert, K.HAZARD2);
game.finishDig(at(19, -20));
check(w.hazAt(inert) === null && w.k(inert) === K.HAZARD2 && !game.sparks.has(inert) && !w.lava.has(inert) && game.overlay(K.HAZARD2, BIOMES[1]) === null, 'a second-hazard cell woke in ground that has no second hazard');
// Lassoed asleep, a hazard pays its type's gems, twice over: 2 a cell.
const pay = cells => { const before = S.gems.slice(); game.haul(cells); return S.gems.map((g, n) => g - before[n]); };
const crystal = at(25, 5), ember = at(26, 5); w.setK(crystal, K.HAZARD2); w.setK(ember, K.HAZARD);
check(JSON.stringify(pay([crystal])) === JSON.stringify([0, 0, 0, 0, 2]), 'a charged crystal hauled from the north\'s kin of ground did not pay 2 of the east\'s gems');
check(JSON.stringify(pay([ember])) === JSON.stringify([0, 0, 2, 0, 0]), 'a lava pocket hauled from the north\'s kin of ground did not pay 2 of the south\'s gems');
// It is drawn from its type's sheet.
check(JSON.stringify([game.overlay(K.HAZARD2, rows.lavaSpark), game.overlay(K.HAZARD, rows.lavaSpark), game.overlay(K.HAZARD2, rows.sporeLava)]) === JSON.stringify([['lode-items', 'hazard'], ['ember-items', 'hazard'], ['ember-items', 'hazard']]),
  'a second hazard is not drawn from its type\'s sheet');

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: a second hazard is laid apart from the first, moves nothing else, and wakes, pays and is drawn by its type');
process.exit(fails.length ? 1 : 0);
