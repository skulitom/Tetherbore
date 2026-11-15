// A tunnel cut north into the frost closes over with ice 30 s after it was cut, unless the tether lies in it.
// A drill thrown from the core up that tunnel just before then is still in the air when the ice comes, and the
// cells ahead of it are not yet under the tether.
//   node test/hunt/modes/fling-frost.mjs [seconds the drill waits at home before the throw, default 21.5]
import { makeGame, tetherFaults, C, N, K, B } from '../harness.mjs';
const wait = Number(process.argv[2] ?? 21.5);
const game = await makeGame(7, { tether: 5, drill: 4 });
const d = game.drill, w = game.world, at = (x, y) => (C + y) * N + C + x, dt = 1 / 60;
// Staged: a straight shaft north from the core to 150 cells out (three wide near home, one wide in the frost), and
// plain soft frost ground for the drill to cut beyond it.
for (let y = 3; y <= 150; y++) for (let x = -1; x <= 1; x++) w.setK(at(x, -y), y > 132 && x ? K.SOFT : K.EMPTY);
for (let y = 133; y <= 175; y++) for (let x = -3; x <= 3; x++) { w.setB(at(x, -y), B.FROST); if (y > 150) w.setK(at(x, -y), K.SOFT); }
d.x = C + 0.5; d.y = C - 148 + 0.5; d.mode = 'free';
game.band = [[d.x, d.y], [C + 0.5, C + 0.5]];
game.changed();
const step = auto => { game.input.auto = auto; game.update(dt); };
// Played: cut twelve cells further north, fly home, wait, throw north again.
while (d.y > C - 162) step([0, -1, 1]);
const cut = game.frostOpen.length, cutAt = game.time;
while (d.mode !== 'home' && game.far > 0.3) step([0, 1, 1]);
while (game.far > 0.01) step([0, 1, 1]);
step(null);
const homeAt = game.time;
while (game.time < homeAt + wait) step(null);
d.armed = true;                                   // a fresh stroke, as pointerDown makes it
const open0 = game.frostOpen.length;
let frames = 0, iceAhead = 0;
do {
  step([0, -1, 1]); frames++;
  if (d.mode === 'fling') for (let y = Math.ceil(C + 0.5 - d.y) + 2; y <= 165; y++) if (w.k(at(0, -y)) === K.ICE) { iceAhead++; break; }
} while (d.mode === 'fling');
const faults = tetherFaults(game), inRock = w.k(game.di) !== K.EMPTY;
console.log(`cut ${cut} frost cells by t=${cutAt.toFixed(1)} s, home at t=${homeAt.toFixed(1)} s, thrown at t=${(homeAt + wait).toFixed(1)} s (${open0} cells still open), in the air ${frames} frames, ice ahead of the drill in ${iceAhead} of them`);
console.log(`landed ${(game.far).toFixed(1)} cells out; the drill's own cell is ${inRock ? 'ICE' : 'open'}; tether faults: ${faults.length ? faults.join('; ') : 'none'}`);
// Can it move?
const x0 = d.x, y0 = d.y;
let moved = 0;
for (const [ix, iy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { for (let f = 0; f < 120; f++) step([ix, iy, 1]); moved = Math.max(moved, Math.hypot(d.x - x0, d.y - y0)); }
console.log(`steered 2 s each way south, north, east, west: moved ${moved.toFixed(2)} cells at most; faults now: ${tetherFaults(game).length}`);
process.exit(faults.length || inRock ? 1 : 0);
