// Ground the tether is right round is reeled in, whether or not the string ever touched it and whoever made it.
// The verifiers' fuzz found islands of the world's own making (a wreck in its hollow, a cache standing in a cavern)
// and ground that grew in the open (basalt, ice) wound for up to 106 s and never reeled: the game only learnt of an
// island from a cut or from a bend lying on it.
//
// 1. Staged: a hall west of the core with a wall hanging into it from the north and a block of four cells standing
//    free beyond that wall. The drill flies under the wall's tip and up the far side, never within six cells
//    of the block (it sees three). The string bends on the wall's tip; the straight line home passes over the block, which is then
//    inside the loop, untouched and unseen. It must be reeled within two seconds.
// 2. The same hall with no block: a cell of basalt sets in the open (told to the game as ground that grew). It must
//    be known as loose at once, and reeled when the same flight goes round it.
//   node test/regress/f-unseen-island.mjs
import { makeGame, tetherFaults, K, B, at, rect, fixRandom, flyTo, idle, where } from './lib/lasso.mjs';

fixRandom(4);
let bad = 0;
async function hall(block) {
  const game = await makeGame(7, { tether: 3, drill: 4 });
  rect(game, -75, -35, -3, 35, K.SOFT, B.CRUST);
  rect(game, -20, -1, -3, 1, K.EMPTY);                     // a tunnel west from the core
  rect(game, -62, -20, -20, 20, K.EMPTY);                  // the hall
  rect(game, -40, -20, -40, 5, K.SOFT);                    // the wall hanging into it
  if (block) rect(game, -46, -5, -45, -4, K.SOFT);         // the block: four cells, standing free
  game.changed();
  return game;
}
const fly = (game, pts) => { for (const [x, y] of pts) if (flyTo(game, x, y) < 0) throw new Error(`never reached ${x},${y} from ${where(game)}`); };

{
  const game = await hall(true), w = game.world, block = [at(-46, -5), at(-45, -5), at(-46, -4), at(-45, -4)];
  let touched = false, nearest = Infinity, faults = 0;
  const each = () => {
    if (game.band.some(b => block.includes(b[3]))) touched = true;
    nearest = Math.min(nearest, Math.max(Math.abs(game.drill.x - (8192 - 45)), Math.abs(game.drill.y - (8192 - 4))));
    if (tetherFaults(game).length) faults++;
  };
  for (const [x, y] of [[-20, 0], [-38, 8], [-56, 8], [-56, -12]]) if (flyTo(game, x, y, { each }) < 0) throw new Error(`never reached ${x},${y}`);
  idle(game, 2, each);
  const left = block.filter(i => w.k(i) !== K.EMPTY).length, ok = left === 0 && !touched && !faults && nearest > 6;
  if (!ok) bad++;
  console.log(`a block inside the loop, never touched or seen: ${left ? `NOT REELED (${left} of 4 cells still there)` : 'reeled'}; hauls ${game.S.stats.hauls}, a bend lay on it: ${touched}, the drill came no nearer than ${nearest.toFixed(1)} cells, frames with tether faults ${faults}`);
}
{
  const game = await hall(false), w = game.world, cell = at(-45, -4);
  fly(game, [[-20, 0], [-38, 8]]);
  w.setK(cell, K.BASALT);
  game.changed([], [cell]);
  const known = game.pieceOf.has(cell);
  fly(game, [[-56, 8], [-56, -12]]);
  idle(game, 2);
  const ok = known && w.k(cell) === K.EMPTY;
  if (!ok) bad++;
  console.log(`basalt set in the open: ${known ? 'known as loose at once' : 'NOT KNOWN as loose'}, ${w.k(cell) === K.EMPTY ? 'reeled' : 'NOT REELED'} when the tether went round it; hauls ${game.S.stats.hauls}`);
}
console.log(bad ? 'DEFECT: an island the tether is right round was not reeled in' : 'no defect');
process.exit(bad ? 1 : 0);
