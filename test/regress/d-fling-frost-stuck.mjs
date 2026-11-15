// As fling-frost.mjs, but the far end of the tunnel was cut first (the drill came round by a side cut and dug back
// toward home), so the cell the throw ends in is the first to freeze. It freezes while the drill is in the air.
//   node test/hunt/modes/fling-frost-stuck.mjs [seconds the drill waits at home before the throw, default 22.6]
import { makeGame, tetherFaults, C, N, K, B } from '../harness.mjs';
const wait = Number(process.argv[2] ?? 22.6);
const game = await makeGame(7, { tether: 5, drill: 4 });
const d = game.drill, w = game.world, at = (x, y) => (C + y) * N + C + x, dt = 1 / 60;
// Staged: a shaft north from the core to 150 cells out, and plain soft frost ground beyond it.
for (let y = 3; y <= 150; y++) for (let x = -1; x <= 1; x++) w.setK(at(x, -y), y > 132 && x ? K.SOFT : K.EMPTY);
for (let y = 133; y <= 180; y++) for (let x = -6; x <= 6; x++) { w.setB(at(x, -y), B.FROST); if (y > 150 || x < -1 || x > 1) w.setK(at(x, -y), K.SOFT); }
d.x = C + 0.5; d.y = C - 148 + 0.5; d.mode = 'free';
game.band = [[d.x, d.y], [C + 0.5, C + 0.5]];
game.changed();
const step = auto => { game.input.auto = auto; game.update(dt); };
const flyTo = (x, y) => { for (let f = 0; f < 2000; f++) { const dx = C + 0.5 + x - d.x, dy = C + 0.5 + y - d.y, far = Math.hypot(dx, dy); if (far < 0.12) return; step([dx / far, dy / far, 1]); } };
// Played: cut east, north, back west to the shaft's line 162 out, then south down that line into the shaft; fly home.
flyTo(0, -150); flyTo(3, -150); flyTo(3, -162); flyTo(0, -162); flyTo(0, -150);
const cutAt = game.time, hauls = game.S.stats.hauls;
while (d.mode !== 'home' && game.far > 0.3) step([0, 1, 1]);
while (game.far > 0.01) step([0, 1, 1]);
step(null);
const homeAt = game.time;
while (game.time < homeAt + wait) step(null);
d.armed = true;                                   // a fresh stroke, as pointerDown makes it
let frames = 0;
do { step([0, -1, 1]); frames++; } while (d.mode === 'fling');
const kind = w.k(game.di), name = Object.keys(K).find(k => K[k] === kind);
console.log(`cutting done at t=${cutAt.toFixed(1)} s (${hauls} haul), home at t=${homeAt.toFixed(1)} s, thrown at t=${(homeAt + wait).toFixed(1)} s, in the air ${frames} frames`);
console.log(`landed ${(game.far).toFixed(1)} cells out; the drill's own cell is ${name}; tether faults: ${tetherFaults(game).length}`);
const x0 = d.x, y0 = d.y;
let moved = 0;
for (let round = 0; round < 3; round++) for (const [ix, iy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [0.7, 0.7], [-0.7, -0.7]]) { for (let f = 0; f < 180; f++) step([ix, iy, 1]); moved = Math.max(moved, Math.hypot(d.x - x0, d.y - y0)); }
console.log(`steered 3 s each of six ways, three times over (54 s): the drill moved ${moved.toFixed(3)} cells at most; its cell is ${Object.keys(K).find(k => K[k] === w.k(game.di))}`);
process.exit(kind !== K.EMPTY ? 1 : 0);
