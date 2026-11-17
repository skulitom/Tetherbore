// Slag and steel (docs/CONTENT-PLAN.md, content item 2; js/game.js: `quench`). A pocket of lava lies in a rind of
// dull slag. Lava that comes into a cell quenches the slag on that cell's four sides to steel: where a pocket is
// woken, where the waking spreads through it, and where the lava pours. Staged by hand in the south's ground:
//   - a cut beside the pocket wakes the lava next to it, and the slag beside that lava is steel at once, white for
//     a moment; the rest of the pocket wakes a tick later and its slag turns then; slag that no lava touches stays;
//   - lava pouring down a tunnel quenches the slag in the tunnel's wall;
//   - nothing opens and nothing closes by it: the books of loose ground are as they were, and the ground is drawn
//     again (the game's `version`);
//   - what is hauled: slag pays 2 grit and no gems, steel 6 grit and 4 of the south's gems whatever ground it lies
//     in, so the pocket woken pays more gems than the pocket hauled asleep;
//   - both are drawn from the lava's sheet, and the art has the frames.
// In real ground, a cut beside a pocket of lava makes steel (counted over 30 pockets on a seed).
//   node test/regress/c2-quench.mjs
import { readFile } from 'node:fs/promises';
import { makeGame, world, C, N } from '../harness.mjs';
import { arena, rect, at, fixRandom, isLoose } from './lib/lasso.mjs';
const { K, B, BIOMES, GRIT, GEMS, digTime } = world;

fixRandom(5);
const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const kinds = (w, cells) => cells.map(i => world.KIND_NAMES[w.k(i)]).join(' ');

const game = await makeGame(7), w = game.world;
arena(game, 40, K.SOFT, B.EMBER);
// A tunnel east from the core to (8, 0); the cell (9, 0) is to be cut. Beyond it a pocket of two cells of lava, (10, 0)
// and (11, 0), slag on every side of it, one cell of slag out of its reach, and one in the wall of the tunnel.
rect(game, 3, 0, 8, 0, K.EMPTY);
const lavaA = at(10, 0), lavaB = at(11, 0), first = [at(10, -1), at(10, 1)], second = [at(11, -1), at(11, 1), at(12, 0)], apart = at(14, 0), wall = at(6, -1), corner = at(12, 1);
for (const i of [lavaA, lavaB]) w.setK(i, K.HAZARD);
for (const i of [...first, ...second, apart, wall, corner]) w.setK(i, K.SLAG);
game.changed();
const solid = () => { let n = 0; for (let y = -3; y <= 3; y++) for (let x = 2; x <= 16; x++) n += w.k(at(x, y)) !== K.EMPTY; return n; };
const pocket = [lavaA, lavaB, ...first, ...second], asleep = game.payOf(pocket);
const pieces0 = game.pieces.length, version0 = game.version, solid0 = solid();

game.finishDig(at(9, 0));
check(w.lava.has(lavaA) && w.k(lavaA) === K.EMPTY && w.k(lavaB) === K.HAZARD, 'the cut beside the pocket did not wake the lava next to it alone');
check(first.every(i => w.k(i) === K.STEEL), `the slag beside the woken lava is ${kinds(w, first)}, not steel`);
check(first.every(i => game.quenched.get(i) > 0), 'slag just quenched does not show white');
check(second.every(i => w.k(i) === K.SLAG), `slag the lava has not come to is ${kinds(w, second)}`);
check(game.version > version0, 'the ground is not drawn again after a quench');
// The waking spreads through the pocket with the lava's next tick, and the pour goes down the tunnel.
for (let f = 0; f < 18; f++) game.updateHazards(1 / 60);
check(w.lava.has(lavaB) && second.every(i => w.k(i) === K.STEEL), `a third of a second on, the rest of the pocket: lava ${w.lava.has(lavaB)}, its slag ${kinds(w, second)}`);
check(game.quenched.size > 0 && first.every(i => !game.quenched.has(i)), 'the white of a quench does not pass');
for (let f = 0; f < 150; f++) game.updateHazards(1 / 60);
check(w.lava.has(at(6, 0)) || w.k(at(6, 0)) === K.BASALT, 'the lava did not pour down the tunnel');
check(w.k(wall) === K.STEEL, `slag in the wall of the tunnel the lava poured down is ${kinds(w, [wall])}`);
check(w.k(apart) === K.SLAG && w.k(corner) === K.SLAG, `slag no lava touched (two cells off, and corner to corner) is ${kinds(w, [apart, corner])}`);
check(game.quenched.size === 0, 'cells still show white three seconds after the last quench');
// Nothing opened or closed but the cut and the lava itself: the pocket's two cells are open (lava), the rest solid.
check(solid() === solid0 - 3 && game.pieces.length === pieces0, `the quench changed what is solid or loose: ${solid0 - solid()} cells opened (the cut and two of lava are 3), ${game.pieces.length - pieces0} more loose pieces`);
// The lava sets, and the pocket woken is hauled: more gems than it held asleep.
for (let f = 0; f < 60 * 12; f++) game.updateHazards(1 / 60);
check(w.k(lavaA) === K.BASALT && w.k(lavaB) === K.BASALT, `the lava set as ${kinds(w, [lavaA, lavaB])}`);
const woken = game.payOf(pocket);
check(asleep.gems[B.EMBER] === 4 && asleep.gems.reduce((a, b) => a + b, 0) === 4, `asleep the pocket pays gems ${asleep.gems}: 2 for each cell of lava, the south's`);
check(woken.gems[B.EMBER] === 20 && woken.gems.reduce((a, b) => a + b, 0) === 20, `woken it pays gems ${woken.gems}: 4 for each of its five cells of steel, the south's`);
check(woken.grit > asleep.grit, `woken it pays ${woken.grit} grit, asleep ${asleep.grit}`);

// A quench by itself: the ground is drawn again when slag turned, and only then.
{
  const open = at(-20, -20), slag = at(-20, -21), bare = at(-25, -20);
  w.setK(slag, K.SLAG);
  const before = game.version, none = game.quench(bare), same = game.version, one = game.quench(open);
  check(none === 0 && same === before, `a quench beside no slag turned ${none} cells and drew the ground again ${same - before} times`);
  check(one === 1 && w.k(slag) === K.STEEL && game.version === same + 1, `a quench beside one cell of slag turned ${one}, and the ground was drawn again ${game.version - same} times`);
}
// What they pay, a cell, and whose gems: steel's are the south's in any ground.
check(GRIT[K.SLAG] === 2 && GEMS[K.SLAG] === 0 && GRIT[K.STEEL] === 6 && GEMS[K.STEEL] === 4, `slag pays ${GRIT[K.SLAG]} grit and ${GEMS[K.SLAG]} gems, steel ${GRIT[K.STEEL]} and ${GEMS[K.STEEL]}`);
check(digTime(K.SLAG, BIOMES[2]) === 0.45 && digTime(K.STEEL, BIOMES[2]) === 0.6, 'slag or steel takes other than 0.45 and 0.6 s to cut');
{
  const north = at(0, -20), deep = at(0, 20);
  w.setB(north, B.FROST); w.setK(north, K.STEEL); w.setB(deep, 6); w.setK(deep, K.STEEL);
  check(game.payOf([north]).gems.join() === '0,0,4,0,0,0,0,0,0', `steel in the north's ground pays gems ${game.payOf([north]).gems}`);
  check(game.payOf([deep]).gems.join() === '0,0,8,0,0,0,0,0,0', `steel in a deep flank of the south pays gems ${game.payOf([deep]).gems}, not twice 4`);
}
// Lava that is a ground's second hazard quenches as the first does.
{
  const row = world.biome({ ...BIOMES[B.MIRE], id: 120, name: 'test-mire-lava', sheet: 'mire', floor: 'mire-floor', haz2: { type: 'lava', rate: 1, t: 0.78 } });
  rect(game, -30, 10, -10, 30, K.SOFT, row.id);
  const lava = at(-20, 20), slag = at(-20, 19);
  w.setK(lava, K.HAZARD2); w.setK(slag, K.SLAG);
  game.changed();
  game.finishDig(at(-19, 20));
  check(w.lava.has(lava) && w.k(slag) === K.STEEL, 'lava that is a second hazard did not quench the slag beside it');
}
// How they are drawn: from the lava's own sheet, in any ground.
const atlas = JSON.parse(await readFile(new URL('../../assets/atlas.json', import.meta.url), 'utf8'));
check(JSON.stringify([game.overlay(K.SLAG, BIOMES[2]), game.overlay(K.STEEL, BIOMES[2]), game.overlay(K.STEEL, BIOMES[1])]) === JSON.stringify([['ember-items', 'slag'], ['ember-items', 'steel'], ['ember-items', 'steel']]),
  `slag and steel are drawn as ${JSON.stringify([game.overlay(K.SLAG, BIOMES[2]), game.overlay(K.STEEL, BIOMES[2])])}`);
check(['slag', 'steel', 'steel-glint', 'quench'].every(f => atlas['ember-items'].frames[f]) && atlas['ember-items'].animations.steel, 'the art has no slag, steel, glint or quench among the south\'s items');
// A haul with steel in it shows the bar on its rubble.
{
  const bar = at(20, 20), rock = at(21, 20);
  w.setK(bar, K.STEEL);
  rect(game, 19, 19, 22, 19, K.EMPTY); rect(game, 19, 21, 22, 21, K.EMPTY); w.setK(at(19, 20), K.EMPTY); w.setK(at(22, 20), K.EMPTY);
  game.changed();
  check(isLoose(game, [bar, rock]), 'the staged piece is not loose');
  const gems0 = game.S.gems[B.EMBER];
  game.haul([bar, rock]);
  check(game.S.gems[B.EMBER] - gems0 === 4 && game.hauls.at(-1).sprites.some(s => s.over?.[1] === 'steel'), 'a hauled bar of steel did not pay 4 of the south\'s gems, or is not drawn on its rubble');
}

// Real ground: 30 pockets of the south's own ground on seed 7, each woken by a cut beside it.
{
  const real = await makeGame(7), rw = real.world, R = 9;
  let cuts = 0, woke = 0, steel = 0;
  for (let by = -3; by <= 3 && cuts < 30; by++) for (let bx = -3; bx <= 3 && cuts < 30; bx++) {
    const cx = C + bx * 22, cy = C + 175 + by * 22;
    rw.see(cx, cy, R + 2);
    let cut = -1;
    for (let v = -3; v <= 3 && cut < 0; v++) for (let u = -3; u <= 3 && cut < 0; u++) {
      const i = (cy + v) * N + cx + u, k = rw.k(i);
      if (rw.b(i) === B.EMBER && (k === K.SOFT || k === K.DENSE || k === K.SLAG) && [1, -1, N, -N].some(s => rw.hazAt(i + s) === 'lava')) cut = i;
    }
    if (cut < 0) continue;
    const count = k => { let n = 0; for (let v = -R; v <= R; v++) for (let u = -R; u <= R; u++) n += rw.k((cy + v) * N + cx + u) === k; return n; };
    const lava = count(K.HAZARD);
    real.finishDig(cut);
    for (let f = 0; f < 60 * 14; f++) real.updateHazards(1 / 60);
    cuts++; woke += lava - count(K.HAZARD); steel += count(K.STEEL);
  }
  console.log(JSON.stringify({ realGround: { pockets: cuts, lavaWoken: woke, steelMade: steel, steelForEachLava: +(steel / woke).toFixed(2) } }));
  check(cuts >= 20, `only ${cuts} pockets of lava were found to wake`);
  // At 4 gems a cell of steel against 2 a cell of lava, waking pays more from half a cell of steel for each of lava.
  check(steel / woke > 0.55 && steel / woke < 1.6, `a woken pocket makes ${(steel / woke).toFixed(2)} cells of steel for each cell of lava: not about three for four`);
}

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: lava quenches the slag beside it to steel where it wakes, spreads and pours; nothing opens or closes by it; steel pays the south\'s gems');
process.exit(fails.length ? 1 : 0);
