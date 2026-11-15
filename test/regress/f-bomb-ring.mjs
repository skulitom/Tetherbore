// A ring trench round a block is finished with a bomb instead of the bit. The block is then loose and the drill
// flies the rest of the way round it. Compare with finishing the same ring by cutting the last cell.
import { makeGame, K, at, rect, arena, fixRandom, flyTo, idle, where, bandRel, isLoose, tetherFaults } from './lib/lasso.mjs';

async function run(how) {
  fixRandom(3);
  const game = await makeGame(7, { tether: 3, drill: 4, bombs: 1 });
  game.bombs = 1;
  arena(game, 30);
  rect(game, 3, 0, 10, 0, K.EMPTY);                       // a tunnel east from the core
  rect(game, 11, -3, 17, -3, K.EMPTY); rect(game, 11, 3, 17, 3, K.EMPTY);      // the ring, all but one cell
  rect(game, 11, -3, 11, 3, K.EMPTY); rect(game, 17, -3, 17, 3, K.EMPTY);
  game.world.setK(at(17, 0), K.SOFT);                     // the neck: the last cell of the ring
  game.changed();
  const block = []; for (let y = -2; y <= 2; y++) for (let x = 12; x <= 16; x++) block.push(at(x, y));
  const grit0 = game.S.grit;
  for (const [x, y] of [[10, 0], [11, 0], [11, -3], [17, -3], [17, -1]]) if (flyTo(game, x, y) < 0) throw new Error(`never reached ${x},${y}: at ${where(game)}`);
  if (how === 'bomb') game.blast(); 
  const left = block.filter(i => game.world.k(i) !== K.EMPTY);
  // On round the rest of the ring, and stop below the block on its west side.
  for (const [x, y] of [[17, 3], [11, 3], [11, 1]]) if (flyTo(game, x, y) < 0) throw new Error(`never reached ${x},${y}: at ${where(game)}`);
  idle(game, 0.5);
  const still = left.filter(i => game.world.k(i) !== K.EMPTY);
  console.log(JSON.stringify({ how, blockCellsAfterCut: left.length, blockIsLoose: isLoose(game, still.length ? still : left), registeredPieces: game.pieces.length,
    hauls: game.S.stats.hauls, blockCellsStillThere: still.length, drill: where(game), band: bandRel(game), faults: tetherFaults(game) }));
  return game.S.stats.hauls;
}
const cut = await run('cut'), bomb = await run('bomb');
console.log(cut === 1 && bomb === 0 ? 'DEFECT: the bombed-loose block is never registered or hauled' : 'no defect');
process.exit(cut === 1 && bomb === 0 ? 1 : 0);
