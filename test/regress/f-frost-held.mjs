// Frost ground. A block hanging in a cavern is cut off its stem, so it is loose and registered; the drill goes away
// and the cut freezes over, which joins the block to the roof again. The drill then flies round three sides of the
// block without cutting anything.
import { makeGame, K, B, at, rect, arena, fixRandom, flyTo, idle, where, bandRel, isLoose } from './lib/lasso.mjs';

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
const piece = game.pieces[0].slice();                    // registered by the cut
go([[13, -5], [12, 6]]);                                 // away to a far corner of the cavern
idle(game, 32);
const before = { stemIsIceNow: w.k(at(16, -5)) === K.ICE, registered: game.pieces.map(p => p.length), registeredPieceIsLoose: isLoose(game, piece), cutsSoFar: 1 };
console.log(JSON.stringify(before));
go([[21, 4], [21, -5]]);                                 // under the block and up its far side: nothing is cut
idle(game, 1);
const after = { drill: where(game), band: bandRel(game), hauls: game.S.stats.hauls, banner: game.banner && { n: game.banner.n, grit: game.banner.grit },
  blockCellsLeft: piece.filter(i => w.k(i)).length, iceLeftHangingFromTheRoof: w.k(at(16, -5)) === K.ICE };
console.log(JSON.stringify(after));
const bad = (before.registered.length > 0 && !before.registeredPieceIsLoose) || after.hauls === 1;
console.log(bad ? 'DEFECT: ground frozen back on to the roof is still counted loose, and is hauled while it is held' : 'no defect');
process.exit(bad ? 1 : 0);
