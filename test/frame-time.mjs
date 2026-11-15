// Times game.update over the rope fuzz's own flight: the mean frame, the worst, and how many ran over 16 ms.
//   node test/frame-time.mjs [seed] [turns] [reach level] [start x] [start y]
// The flight is the one test/rope-fuzz.mjs flies (same steering from the same seed), with no checks between frames,
// so what is timed is the game alone. Run it by itself: another busy process makes the worst frame meaningless.
import { makeGame, random, C, N, K } from './harness.mjs';

const [seed = 11, turns = 600, reach = 5, sx = 0, sy = 0] = process.argv.slice(2).map(Number);
const game = await makeGame(seed, { tether: reach, drill: 4 });
const d = game.drill, w = game.world, rnd = random(seed);
if (sx || sy) {
  const len = Math.hypot(sx, sy);
  for (let s = 0; s <= len; s += 0.5) for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) w.setK((C + Math.round(sy * s / len) + v) * N + C + Math.round(sx * s / len) + u, K.EMPTY);
  d.x = C + sx + 0.5; d.y = C + sy + 0.5; d.mode = 'free';
  game.band = [[d.x, d.y], [C + 0.5, C + 0.5]];
  game.changed();
}
let frames = 0, total = 0, worst = 0, worstAt = 0, over = 0, heading = 0;
for (let turn = 0; turn < turns; turn++) {
  heading += (rnd() - 0.5) * 2.5;
  const hold = 10 + Math.floor(rnd() * 50), pause = rnd() < 0.1;
  for (let f = 0; f < hold; f++) {
    game.input.auto = pause ? null : [Math.cos(heading), Math.sin(heading), 1];
    const t = performance.now();
    game.update(1 / 60);
    const ms = performance.now() - t;
    frames++; total += ms;
    if (ms > worst) { worst = ms; worstAt = frames; }
    if (ms > 16) over++;
  }
}
console.log(JSON.stringify({ seed, reach, start: [sx, sy], frames, meanMs: +(total / frames).toFixed(4), worstMs: +worst.toFixed(2), worstAt, over16: over, hauls: game.S.stats.hauls, bends: game.band.length }));
