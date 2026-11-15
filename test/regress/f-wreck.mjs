// Fetch a wreck's part: a corridor is opened to the wreck's hollow (as if dug before), the drill flies in, right
// round the wreck inside its hollow, and home again by the same corridor.
//   node test/hunt/lasso/wreck.mjs [seed] [which wreck]
import { makeGame } from '../harness.mjs';
import { fixRandom, flyTo, idle, where, bandRel, at, rect, C, N, K } from './lib/lasso.mjs';

const seed = Number(process.argv[2] ?? 7), which = Number(process.argv[3] ?? 0);
fixRandom(6);
const game = await makeGame(seed, { tether: 6, drill: 4 });
const w = game.world, [ax, ay] = w.wrecks[which], wx = ax - C, wy = ay - C, sy = Math.sign(wy), col = wx - 2;
const show = () => { for (let y = -4; y <= 4; y++) { let row = '  '; for (let x = -4; x <= 4; x++) row += '.#BsdabSVHRIBCW'[w.k(at(wx + x, wy + y))] ?? '?'; console.log(row); } };
console.log(`seed ${seed}, wreck ${which} at ${wx},${wy}`); show();
rect(game, Math.min(col, 0), 0, Math.max(col, 0), 0, K.EMPTY);
rect(game, col, Math.min(0, wy - sy * 3), col, Math.max(0, wy - sy * 3), K.EMPTY);
rect(game, -2, -2, 2, 2, K.EMPTY);
game.changed();
const go = pts => { for (const [x, y] of pts) { if (flyTo(game, x, y, { frames: 6000 }) < 0) throw new Error(`never reached ${x},${y} from ${where(game)}`); idle(game, 0.2); } };
go([[col, 0], [col, wy - sy * 2], [col, wy + sy * 2], [wx + 2, wy + sy * 2], [wx + 2, wy - sy * 2], [col, wy - sy * 2]]);
idle(game, 1);
const cluster = []; for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) if (w.k(at(wx + x, wy + y))) cluster.push([x, y]);
console.log(JSON.stringify({ step: 'right round the wreck, still out there', hauls: game.S.stats.hauls, registered: game.pieces.length, clusterCells: cluster.length, band: bandRel(game).map(([x, y]) => [x - wx, y - wy]).slice(0, 12) }));
go([[col, 0]]);
flyTo(game, 0, 0, { tol: 0.05, frames: 6000 }); idle(game, 0.5);
const left = []; for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) if (w.k(at(wx + x, wy + y))) left.push([x, y, w.k(at(wx + x, wy + y)) === K.WRECK ? 'WRECK' : 'slate']);
console.log(JSON.stringify({ step: 'home', hauls: game.S.stats.hauls, banner: game.banner && { title: game.banner.title, n: game.banner.n }, partHeld: game.S.wrecks[which], leftRoundTheWreck: left, band: bandRel(game).map(([x, y]) => [x - wx, y - wy]) }));
// Leave the core and come back, without unwinding.
const first = game.S.wrecks[which];
if (!first) {
  idle(game, 0.5); go([[Math.sign(col) * 2 || -2, 0]]); idle(game, 0.3);
  flyTo(game, 0, 0, { tol: 0.05 }); idle(game, 0.5);
  console.log(JSON.stringify({ step: 'out of the core and home a second time', hauls: game.S.stats.hauls, partHeld: game.S.wrecks[which], banner: game.banner && { title: game.banner.title, n: game.banner.n } }));
}
console.log(first ? 'part fetched on the first homecoming' : 'DEFECT: the tether went right round the wreck and came home, but the part was not hauled on that homecoming');
process.exit(first ? 0 : 1);
