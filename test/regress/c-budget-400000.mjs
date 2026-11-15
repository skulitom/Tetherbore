// catchIn() gives up (returns undefined) when the triangle it must search covers more than 400000 cells. In
// retighten() that means a bend whose rock has gone is simply kept. Far out at reach 1350: the tether runs up a
// shaft L cells north, round the corner and L cells east; then the rock at the corner goes.
//   node test/hunt/modes/budget-400000.mjs [L, default 1000]
import { makeGame, tetherFaults, C, N, K } from '../harness.mjs';
const L = Number(process.argv[2] ?? 1000);
const game = await makeGame(7, { tether: 8, momentum: 4 });
const d = game.drill, w = game.world, at = (x, y) => (C + y) * N + C + x;
// Staged: a shaft north from the core and a tunnel east from its top, each three cells wide, in solid stone.
for (let y = -L - 3; y <= -3; y++) for (let x = -3; x <= 3; x++) w.setK(at(x, y), Math.abs(x) <= 1 ? K.EMPTY : K.DENSE);
for (let x = -3; x <= L + 3; x++) for (let y = -L - 3; y <= -L + 3; y++) if (x > 1 || y < -L - 1) w.setK(at(x, y), Math.abs(y + L) <= 1 ? K.EMPTY : K.DENSE);
d.x = C + 0.5; d.y = C + 0.5 - L; d.mode = 'free';
game.band = [[d.x, d.y], [C + 0.5, C + 0.5]];
game.pieces = []; game.changed();
if (tetherFaults(game).length) throw new Error('staging is wrong');
// Played: the drill flies east along the tunnel.
for (let f = 0; f < 6000 && d.x < C + L; f++) { game.input.auto = [1, 0, 1]; game.update(1 / 60); }
game.input.auto = null;
for (let f = 0; f < 60; f++) game.update(1 / 60);
const rel = () => JSON.stringify(game.band.map(p => [+(p[0] - C - 0.5).toFixed(1), +(p[1] - C - 0.5).toFixed(1)]));
console.log(`flown: drill ${game.far.toFixed(0)} cells out, band ${rel()}, faults ${tetherFaults(game).length}`);
// Staged: the rock the tether bends round is taken away (as a haul or a cut would take it).
let gaveUp = 0;
const catchIn = game.catchIn; game.catchIn = function (...a) { const q = catchIn.apply(this, a); if (q === undefined) gaveUp++; return q; };
const cell = game.band[1][3];
w.setK(cell, K.EMPTY);
const t0 = performance.now();
game.changed([cell]);
console.log(`corner rock (${(cell % N) - C},${Math.floor(cell / N) - C}) removed: changed() took ${(performance.now() - t0).toFixed(1)} ms, catchIn gave up ${gaveUp} time(s); band ${rel()}`);
console.log(`faults: ${JSON.stringify(tetherFaults(game))}`);
for (let k = 0; k < 3; k++) game.changed();
for (let f = 0; f < 600; f++) { game.input.auto = [f % 120 < 60 ? -1 : 1, 0, 1]; game.update(1 / 60); }
const faults = tetherFaults(game);
console.log(`three more changed() calls and 10 s of flying to and fro later: band ${rel()}\n  faults: ${JSON.stringify(faults)}`);
process.exit(faults.length ? 1 : 0);
