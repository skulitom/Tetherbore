// Mire. A block hangs in a cavern from a stem one cell wide; one cell of the stem is a spore pod. The drill cuts the
// stem cell just below the pod, which bursts the pod as well: two cells open at once, and the block is loose.
// Control: the same stem without a pod, cut in the same place.
import { makeGame, K, B, at, rect, arena, fixRandom, flyTo, idle, where, bandRel, isLoose } from './lib/lasso.mjs';

async function run(pod) {
  fixRandom(4);
  const game = await makeGame(7, { tether: 3, drill: 4 });
  arena(game, 30, K.SOFT, B.MIRE);
  rect(game, 3, 0, 9, 0, K.EMPTY);                         // a tunnel east from the core
  rect(game, 10, -8, 24, 8, K.EMPTY);                      // a cavern
  rect(game, 15, -2, 18, 1, K.SOFT);                       // the block
  rect(game, 16, -8, 16, -3, K.SOFT);                      // its stem, up to the cavern's roof
  if (pod) game.world.setK(at(16, -6), K.HAZARD);
  game.changed();
  const block = []; for (let y = -2; y <= 1; y++) for (let x = 15; x <= 18; x++) block.push(at(x, y));
  block.push(at(16, -3), at(16, -4));
  for (const [x, y] of [[9, 0], [13, -5]]) if (flyTo(game, x, y) < 0) throw new Error(`never reached ${x},${y}`);
  // Cut the stem at (16,-5) from the west, then fly on through the gap and right round the block.
  for (const [x, y] of [[17, -5], [21, -5], [21, 4], [12, 4], [12, -1]]) if (flyTo(game, x, y) < 0) throw new Error(`never reached ${x},${y} from ${where(game)}`);
  idle(game, 1);
  const out = { pod, stemCut: game.world.k(at(16, -5)) === K.EMPTY, podBurst: game.world.k(at(16, -6)) === K.EMPTY, blockIsLoose: isLoose(game, block.filter(i => game.world.k(i))),
    blockCellsLeft: block.filter(i => game.world.k(i)).length, registeredPieces: game.pieces.length, hauls: game.S.stats.hauls, drill: where(game), band: bandRel(game) };
  console.log(JSON.stringify(out));
  return out;
}
const a = await run(false), b = await run(true);
const bad = a.hauls === 1 && b.hauls === 0 && b.blockIsLoose;
console.log(bad ? 'DEFECT: with the pod bursting beside the cut, the loose block is not registered and not hauled' : 'no defect');
process.exit(bad ? 1 : 0);
