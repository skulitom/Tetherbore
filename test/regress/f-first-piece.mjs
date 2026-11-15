// The untouched world. The piece beside the core is "already cut loose, to show what drawing the tether round
// something does" (world.js kindAt), and begin() calls changed([the cell beside it]) to register it.
// Fly right round it, further than once, stop away from the core, and wait.
import { makeGame } from '../harness.mjs';
import { fixRandom, flyTo, idle, where, bandRel, isLoose, at, C, N } from './lib/lasso.mjs';

fixRandom(5);
const game = await makeGame(7);
const piece = [at(4, -1), at(5, -1), at(4, 0), at(5, 0)];
console.log(JSON.stringify({ atStart: true, pieceIsLoose: isLoose(game, piece), registeredPieces: game.pieces.length, looseCells: game.loose.length,
  freedSaysOfTheCellBeside: game.world.freed(at(3, 0), 120000).length }));
for (const [x, y] of [[2, -2], [6, -2], [6, 1], [3.1, 1.3], [3.1, -2], [6, -2]]) { if (flyTo(game, x, y) < 0) throw new Error(`never reached ${x},${y} from ${where(game)}`); idle(game, 0.4); }
idle(game, 3);
const winds = (x, y) => { const pts = game.band; let t = 0; for (let n = 0; n < pts.length; n++) { const a = pts[n], b = pts[(n + 1) % pts.length];
  if (a[1] <= y) { if (b[1] > y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) > 0) t++; } else if (b[1] <= y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) < 0) t--; } return t; };
const out = { afterOnceRoundAndThreeSeconds: true, drill: where(game), band: bandRel(game), windingOfEachCell: piece.map(i => winds((i % N) + 0.5, Math.floor(i / N) + 0.5)),
  registeredPieces: game.pieces.length, hauls: game.S.stats.hauls, pieceStillThere: piece.filter(i => game.world.k(i)).length };
console.log(JSON.stringify(out));
// Only coming home finds it.
flyTo(game, 0, 0, { tol: 0.05 });
console.log(JSON.stringify({ afterComingHome: true, hauls: game.S.stats.hauls, pieceStillThere: piece.filter(i => game.world.k(i)).length }));
const bad = out.hauls === 0 && out.windingOfEachCell.every(Boolean);
console.log(bad ? 'DEFECT: the first loose piece was never registered, so the tether going right round it does not reel it in' : 'no defect');
process.exit(bad ? 1 : 0);
