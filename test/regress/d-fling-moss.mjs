// The same with the west's moss: a burst pod's cloud closes the open ground round it after 6 s. A drill thrown back
// down its tunnel then lands in ground that grew while it was in the air.
//   node test/hunt/modes/fling-moss.mjs [seconds after the pod burst at which the drill is thrown, default 5.7]
import { makeGame, tetherFaults, C, N, K, B } from '../harness.mjs';
const when = Number(process.argv[2] ?? 5.7);
const game = await makeGame(7, { tether: 5, drill: 4, momentum: 4 });
const d = game.drill, w = game.world, at = (x, y) => (C + y) * N + C + x, dt = 1 / 60;
// Staged: a shaft west from the core to 140 cells out, soft mire ground beyond it, and one spore pod 143 out.
for (let x = 3; x <= 140; x++) for (let y = -1; y <= 1; y++) w.setK(at(-x, y), K.EMPTY);
for (let x = 141; x <= 150; x++) for (let y = -3; y <= 3; y++) { w.setK(at(-x, y), K.SOFT); w.setB(at(-x, y), B.MIRE); }
w.setK(at(-143, 0), K.HAZARD);
d.x = C - 138 + 0.5; d.y = C + 0.5; d.mode = 'free';
game.band = [[d.x, d.y], [C + 0.5, C + 0.5]];
game.changed();
const step = auto => { game.input.auto = auto; game.update(dt); };
// Played: cut west until the pod bursts, fly home, throw west again.
while (!game.clouds.length) step([-1, 0, 1]);
const burst = game.time;
while (d.mode !== 'home' && game.far > 0.3) step([1, 0, 1]);
while (game.far > 0.01) step([1, 0, 1]);
step(null);
const homeAt = game.time;
while (game.time < burst + when) step(null);
d.armed = true;                                   // a fresh stroke, as pointerDown makes it
let frames = 0;
do { step([-1, 0, 1]); frames++; } while (d.mode === 'fling');
const name = () => Object.keys(K).find(k => K[k] === w.k(game.di));
console.log(`pod burst at t=${burst.toFixed(2)} s, home at t=${homeAt.toFixed(2)} s, thrown at t=${(burst + when).toFixed(2)} s, in the air ${frames} frames`);
console.log(`landed ${(game.far).toFixed(1)} cells out; the drill's own cell is ${name()}; tether faults: ${tetherFaults(game).length}`);
const x0 = d.x, y0 = d.y;
let moved = 0;
for (let round = 0; round < 3; round++) for (const [ix, iy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, -0.7]]) { for (let f = 0; f < 180; f++) step([ix, iy, 1]); moved = Math.max(moved, Math.hypot(d.x - x0, d.y - y0)); }
console.log(`steered 3 s each of six ways, three times over (54 s): the drill moved ${moved.toFixed(3)} cells at most; its cell is ${name()}`);
process.exit(name() !== 'EMPTY' ? 1 : 0);
