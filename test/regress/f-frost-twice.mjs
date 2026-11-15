// Frost ground, where a cut closes over with ice after 30 seconds. A block hangs in a cavern from a stem. The drill
// cuts the stem (the block is loose and registered), nibbles one more cell off the top of the loose piece, and goes
// away. Both cuts freeze over. The drill comes back, cuts the stem again in the same place, and lassoes the block.
// Control: the same without going away (no ice).
import { makeGame, K, B, at, rect, arena, fixRandom, flyTo, idle, where, bandRel, isLoose, N, C } from './lib/lasso.mjs';

async function run(wait) {
  fixRandom(4);
  const game = await makeGame(7, { tether: 3, drill: 4 });
  const w = game.world;
  arena(game, 30, K.SOFT, B.FROST);
  rect(game, 3, 0, 9, 0, K.EMPTY);                         // a tunnel east from the core
  rect(game, 10, -8, 24, 8, K.EMPTY);                      // a cavern
  rect(game, 15, -2, 18, 1, K.SOFT);                       // the block: 16 cells
  rect(game, 16, -8, 16, -3, K.SOFT);                      // its stem, up to the cavern's roof
  game.changed();
  const go = pts => { for (const [x, y] of pts) if (flyTo(game, x, y) < 0) throw new Error(`never reached ${x},${y} from ${where(game)}`); };
  go([[9, 0], [13, -5], [16, -5]]);                        // cut the stem at (16,-5) from the west
  const afterFirstCut = game.pieces.map(p => p.length);
  go([[16, -4]]);                                          // and the cell below it, which is part of the loose piece
  const afterSecondCut = game.pieces.map(p => p.length);
  go([[16, -5], [13, -5], [12, 6]]);                       // away to a far corner of the cavern
  if (wait) idle(game, 32);
  const ice = [at(16, -5), at(16, -4)].map(i => w.k(i) === K.ICE);
  const piece = game.pieces[0] ?? [], stillLoose = isLoose(game, piece);
  const registeredWhileFrozenOn = game.pieces.map(p => p.length);
  go([[13, -5], [16, -5]]);                                // back, and cut the stem again where it was cut before
  const afterRecut = game.pieces.map(p => p.length), twice = game.loose.length - new Set(game.loose).size;
  let banner = null;
  const each = () => { if (!banner && game.banner) banner = { n: game.banner.n, grit: game.banner.grit }; };
  for (const [x, y] of [[21, -5], [21, 4], [12, 4], [12, -1]]) if (flyTo(game, x, y, { each }) < 0) throw new Error(`never reached ${x},${y} from ${where(game)}`);
  idle(game, 1, each);
  const out = { wait, afterFirstCut, afterSecondCut, ice, registeredWhileFrozenOn, pieceLooseWhileFrozenOn: stillLoose, afterRecut, cellsRegisteredTwice: twice, hauls: game.S.stats.hauls, banner };
  console.log(JSON.stringify(out));
  return out;
}
const a = await run(false), b = await run(true);
const bad = b.cellsRegisteredTwice > 0 || (b.banner && a.banner && b.banner.n > a.banner.n + 2);
console.log(bad ? `DEFECT: the same ground is registered twice and paid for twice (${a.banner?.n} cells, ${a.banner?.grit} grit without ice; ${b.banner?.n} cells, ${b.banner?.grit} grit with)` : 'no defect');
process.exit(bad ? 1 : 0);
