// A square block s x s is ring-cut by the drill, which flies the whole way round and cuts the last cell of the ring.
//   node test/regress/f-big.mjs <side> [bump | jog]
// Fails when a piece no larger than the 120,000 cells `changed` asks `freed` about is not reeled in where it is cut.
// With `bump`, the last cell cut has a third solid neighbour (a one-cell bump of the block standing in the trench).
// With `jog`, the trench steps one cell sideways at the last cell, so that cell has held ground on two sides.
import { makeGame, K, B, at, rect, fixRandom, flyTo, idle, where, bandRel, isLoose, N, C } from './lib/lasso.mjs';

const s = Number(process.argv[2] ?? 71), bump = process.argv[3] === 'bump', jog = process.argv[3] === 'jog';
fixRandom(2);
const game = await makeGame(7, { tether: 9, drill: 4, winch: 5 });
const w = game.world, x0 = 12, x1 = 11 + s, y0 = -Math.floor(s / 2), y1 = y0 + s - 1;
let t = performance.now();
rect(game, x0 - 3, y0 - 3, x1 + 3, y1 + 3, K.SOFT, B.CRUST);
rect(game, 3, 0, 10, 0, K.EMPTY);
rect(game, 3, -2, 6, 1, K.EMPTY);                         // the first loose piece is no part of this
rect(game, x0 - 1, y0 - 1, x1 + 1, y0 - 1, K.EMPTY); rect(game, x0 - 1, y1 + 1, x1 + 1, y1 + 1, K.EMPTY);
rect(game, x0 - 1, y0 - 1, x0 - 1, y1 + 1, K.EMPTY); rect(game, x1 + 1, y0 - 1, x1 + 1, y1 + 1, K.EMPTY);
w.setK(at(11, 4), K.SOFT);                                // the last cell of the ring
if (bump) { w.setK(at(11, 3), K.SOFT); w.setK(at(10, 3), K.EMPTY); w.setK(at(10, 2), K.EMPTY); w.setK(at(10, 1), K.EMPTY); }
if (jog) { for (let y = y0 - 1; y <= 3; y++) { w.setK(at(11, y), K.SOFT); w.setK(at(12, y), K.EMPTY); } rect(game, 3, 0, 11, 0, K.EMPTY); }
game.changed();
const staged = performance.now() - t;
const go = (pts, each) => { for (const [x, y] of pts) if (flyTo(game, x, y, { frames: 20000, each }) < 0) throw new Error(`never reached ${x},${y} from ${where(game)}`); };
go([[10, 0], [jog ? 12 : 11, 0], [jog ? 12 : 11, y0 - 1], [x1 + 1, y0 - 1], [x1 + 1, y1 + 1], [11, y1 + 1], [11, 6]]);
const direct = w.freed(at(11, 4), 120000);                // what the game will be told when the cell is cut
let worst = 0, frames = 0, cutFrame = -1, hauledFrame = -1, banner = null;
const each = () => { frames++; };
const d = game.drill;
// Cut the last cell, timing every frame.
for (let f = 0; f < 600; f++) {
  const tx = C + (bump ? 10 : 11) + 0.5, ty = C + (jog ? 4 : 1) + 0.5, dx = tx - d.x, dy = ty - d.y, far = Math.hypot(dx, dy);
  game.input.auto = far < 0.2 ? null : [dx / far, dy / far, 1];
  const t0 = performance.now(); game.update(1 / 60); const ms = performance.now() - t0;
  worst = Math.max(worst, ms);
  if (cutFrame < 0 && w.k(at(11, 4)) === K.EMPTY) cutFrame = f;
  if (hauledFrame < 0 && game.S.stats.hauls && game.hauled) { hauledFrame = f; banner = { n: game.hauled.n, grit: game.hauled.grit, over: +game.hauled.over.toFixed(3) }; }
  if (far < 0.2) break;
}
idle(game, 1);
let block = 0; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (w.k(at(x, y))) block++;
const hauledWhereItWasCut = game.S.stats.hauls, stillThere = block;
if (!hauledWhereItWasCut) { flyTo(game, 11, 0, { frames: 20000 }); flyTo(game, 0, 0, { tol: 0.05, frames: 20000 }); idle(game, 0.5); }
const hauledOnlyAtHome = !hauledWhereItWasCut && game.S.stats.hauls === 1;
let finish = -1, worstHaul = 0;
for (let f = 0; f < 60 * 120 && finish < 0; f++) { const t0 = performance.now(); game.update(1 / 60); worstHaul = Math.max(worstHaul, performance.now() - t0); if (!game.hauls.length) finish = f; }
console.log(JSON.stringify({ side: s, cells: s * s + (bump ? 1 : 0), bump, stagedMs: Math.round(staged), freedBeforeCut: direct.map(p => p.length), cutFrame, hauledFrame, worstFrameMs: Math.round(worst), banner,
  blockCellsLeftAfterCut: stillThere, hauledWhereItWasCut, hauledOnlyAtHome, homeBanner: game.hauled && game.hauled.n, registered: game.pieces.map(p => p.length), hauls: game.S.stats.hauls, haulFinishedAfterFrames: finish, worstHaulFrameMs: Math.round(worstHaul), pendingLeft: game.pending.grit, drill: where(game), bends: game.band.length }));
process.exit(s * s <= 120000 && !hauledWhereItWasCut ? 1 : 0);
