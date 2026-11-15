// retighten() looks at no more than 600 bends a call, counted from the drill's end. A switchback tunnel gives the
// tether two bends a turn; once it has more than 600, ground that goes from under a bend near the core is never
// noticed: the bend stays, on a corner that is not there.
//   node test/hunt/modes/guard-600.mjs [turns of the tunnel, default 330]
import { makeGame, tetherFaults, C, N, K } from '../harness.mjs';
const rows = Number(process.argv[2] ?? 330);
const game = await makeGame(7, { tether: 7, drill: 4 });
const d = game.drill, w = game.world, at = (x, y) => (C + y) * N + C + x;
// Staged: a block of stone north of the core with a switchback cut in it, 7 cells wide, a turn every 2 cells.
for (let y = -3; y >= -6 - 2 * rows; y--) for (let x = -6; x <= 6; x++) w.setK(at(x, y), K.DENSE);
w.setK(at(-3, -3), K.EMPTY); w.setK(at(-3, -2), K.EMPTY);
for (let k = 0; k < rows; k++) {
  for (let x = -3; x <= 3; x++) w.setK(at(x, -4 - 2 * k), K.EMPTY);
  if (k < rows - 1) w.setK(at(k % 2 ? -3 : 3, -5 - 2 * k), K.EMPTY);
}
game.pieces = []; game.changed();
const step = auto => { game.input.auto = auto; const t0 = performance.now(); game.update(1 / 60); return performance.now() - t0; };
const flyTo = (x, y) => { for (let f = 0; f < 4000; f++) { const dx = C + 0.5 + x - d.x, dy = C + 0.5 + y - d.y, far = Math.hypot(dx, dy); if (far < 0.15) return; step([dx / far, dy / far, Math.min(1, 0.3 + far)]); } throw new Error(`never reached ${x},${y}`); };
// Played: the drill flies the whole tunnel.
d.x = C - 2 + 0.5; d.y = C - 2 + 0.5; game.band = [[d.x, d.y], [C + 0.5, C + 0.5]];
flyTo(-3, -2); flyTo(-3, -4);
let faultsOnTheWay = 0;
for (let k = 0; k < rows; k++) { const end = k % 2 ? -3 : 3; flyTo(end, -4 - 2 * k); if (k < rows - 1) flyTo(end, -6 - 2 * k); if (k % 10 === 0) faultsOnTheWay += tetherFaults(game).length; }
const P = game.band;
console.log(`flown: ${P.length - 2} bends, faults on the way ${faultsOnTheWay}, faults now ${tetherFaults(game).length}`);
// Staged: the end of the first wall (two bends lie on it, the furthest from the drill) is cut away.
const n = P.length - 3, cell = P[n][3];
console.log(`bends ${n} and ${n + 1} of ${P.length - 2} lie on cell (${(cell % N) - C},${Math.floor(cell / N) - C}); that cell is opened and changed([cell]) called`);
w.setK(cell, K.EMPTY);
let t0 = performance.now();
game.changed([cell]);
console.log(`changed() took ${(performance.now() - t0).toFixed(2)} ms; band now ${game.band.length - 2} bends`);
let faults = tetherFaults(game);
console.log(`faults: ${faults.length}${faults.length ? `\n  ${faults.slice(0, 3).join('\n  ')}` : ''}`);
// Later changes do not find it either, and nor does flying on.
for (let k = 0; k < 5; k++) game.changed();
let worst = 0, total = 0;
for (let f = 0; f < 600; f++) { const t = step([f % 120 < 60 ? -1 : 1, 0, 1]); worst = Math.max(worst, t); total += t; }
faults = tetherFaults(game);
console.log(`after five more changed() calls and 10 s of flying to and fro: faults ${faults.length}; update() mean ${(total / 600).toFixed(3)} ms, worst ${worst.toFixed(2)} ms`);
process.exit(faults.length ? 1 : 0);
