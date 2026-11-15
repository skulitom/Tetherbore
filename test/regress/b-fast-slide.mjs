// A fast drill slides round a pillar's corner inside one frame, and the tether is left lying through the pillar.
// Steering only: out west along a clear hall, straight back east, then a turn of 0.48 rad toward the pillar.
//   node test/hunt/geometry/fast-slide.mjs
import { makeGame, tetherFaults, C, N, K, HX, HY, idx, arena, rocks, showBand, Oracle } from './lib/rig.mjs';
const game = await makeGame(3, { tether: 9, momentum: 4 });
arena(game, -740, -8, 3, 14);                 // a clear hall west of the core
rocks(game, [[-58, 2]]);                      // one uncuttable pillar: cell (-58, 2)
game.changed();
const d = game.drill, dt = 1 / 60, oracle = new Oracle(game, [-740, -8, 3, 14]).fine();
let frames = 0, first = -1;
const step = (x, y, m) => { game.input.auto = [x, y, m]; game.update(dt); oracle.step(); frames++; };
step(-1, 0, 0.5);                             // a gentle start, so it flies rather than being thrown
while (d.x - HX > -700) step(-1, 0, 1);
while (d.x - HX < -210 || d.vx < 0) step(1, 0, 1);
for (let f = 0; f < 60; f++) {
  if (f < 39) step(1, 0, 1); else step(Math.cos(0.48), Math.sin(0.48), 1);
  const faults = tetherFaults(game), mis = oracle.mismatch();
  if (f >= 40 && f < 47 || faults.length && first < 0) console.log(`frame ${frames}: drill ${(d.px - C).toFixed(3)},${(d.py - C).toFixed(3)} -> ${(d.x - C).toFixed(3)},${(d.y - C).toFixed(3)}  ${Math.hypot(d.vx, d.vy).toFixed(0)} cells/s  band ${showBand(game)}\n    ${faults.join('; ') || 'sound'}${mis ? ' | ' + mis : ''}`);
  if (faults.length && first < 0) first = frames;
}
// carry on east under the pillar and home: the loop round the pillar is gone
let lost = 0;
for (let f = 0; f < 240; f++) { step(1, d.y - HY > 4 ? 0 : 0.2, 0.3); if (tetherFaults(game).length) lost++; }
console.log(`first fault at frame ${first}; then ${lost} more faulty frames; in the end band ${showBand(game)}; flown path vs band: ${oracle.mismatch() || 'same class'}`);
process.exit(first < 0 ? 0 : 1);
