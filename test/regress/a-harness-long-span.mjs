// The tests' own check of the tether (tetherFaults in test/harness.mjs) must see a span that passes through rock,
// however long the span. It once looked at a span at 4,000 points at the most: on a span of 1,561 cells those are
// 0.39 of a cell apart, and rock the span cut up to a fifth of a cell deep across a corner was stepped over (7 of
// 40 here). Staged: a hall 1,500 cells long, a straight tether down it, and single cells of rock set, one at a
// time, where the string cuts 0.05 to 0.2 of a cell deep across a corner. Every one must be reported.
//   node test/regress/a-harness-long-span.mjs
import { makeGame, tetherFaults, cellsAlong, C, N, K } from '../harness.mjs';
const game = await makeGame(7, { tether: 9 }), w = game.world, d = game.drill;
const L = 1500, ex = L, ey = 431.3;
for (let s = 0; s <= 1; s += 0.2 / L) for (let u = -3; u <= 3; u++) for (let v = -3; v <= 3; v++) w.setK((C + Math.floor(ey * s + 0.5) + v) * N + C + Math.floor(ex * s + 0.5) + u, K.EMPTY);
d.x = C + 0.5 + ex; d.y = C + 0.5 + ey; d.mode = 'free';
game.band = [[d.x, d.y], [C + 0.5, C + 0.5]]; game.pieces = []; game.pieceOf = new Map(); game.loose = [];
// Cells the line clips: where it crosses a column line x = k at height y, the cell above-left of the crossing is
// entered by a small triangle when y is just past a row line.
let placed = 0, seenByStock = 0, deepest = 0;
for (let k = 20; k < L - 20 && placed < 40; k++) {
  const y = 0.5 + ey * (k - 0.5) / ex, f = y - Math.floor(y);          // the line at x = C + k (relative to the core cell's corner)
  if (f < 0.05 || f > 0.2) continue;
  // The line rises to the right (in y down the screen): just right of x = k it is in row floor(y); the cell to the
  // left in the same row is clipped at its lower right... take the cell left of the column line, in that row.
  const cell = (C + Math.floor(y)) * N + C + k - 1;
  w.setK(cell, K.DENSE);
  const inside = new Set(cellsAlong(C + 0.5, C + 0.5 + 1e-4, d.x, d.y + 1e-4, 20000)).has(cell) && new Set(cellsAlong(C + 0.5, C + 0.5 - 1e-4, d.x, d.y - 1e-4, 20000)).has(cell);
  if (!inside) { w.setK(cell, K.EMPTY); continue; }
  placed++; deepest = Math.max(deepest, f);
  if (tetherFaults(game).length) seenByStock++;
  w.setK(cell, K.EMPTY);
}
console.log(JSON.stringify({ spanLength: +Math.hypot(ex, ey).toFixed(0), rocksSetOnTheString: placed, deepestCut: +deepest.toFixed(2), seenByTetherFaults: seenByStock }));
const sound = tetherFaults(game).length === 0;
console.log(placed >= 30 && seenByStock === placed && sound ? 'no defect' : 'DEFECT: the tether check stepped over rock on a long span (or sees rock where there is none)');
process.exit(placed >= 30 && seenByStock === placed && sound ? 0 : 1);
