// Times game.update over the rope fuzz's own flight: the mean frame, the worst, and how many ran over 16 ms. The
// rubble of hauls on their way home (updateHauls) is most of an ordinary frame and depends on what happens to be
// hauled, so the same figures are given without it as well: that is the part a change to the tether or the ground
// can make slower.
//   node test/frame-time.mjs [seed] [turns] [reach level] [start x] [start y]
// The flight is the one test/rope-fuzz.mjs flies (same steering from the same seed), with no checks between frames,
// so what is timed is the game alone. Run it by itself: another busy process makes the worst frame meaningless.
// The rubble's own throws and dust are drawn from Math.random, so that is seeded too (from the seed, as
// tools/long-play.mjs seeds it): the same arguments time the same heap of rubble every run.
//   --hash   also print a hash of where every bit of rubble was after every frame (harness.mjs: rubbleHash), taken
//            outside the timing: a change to updateHauls that gives the same hash on these flights moved no bit.
import { makeGame, random, rubbleHash, farStart, wander } from './harness.mjs';

const args = process.argv.slice(2), digest = args.includes('--hash') ? rubbleHash() : null;
const [seed = 11, turns = 600, reach = 5, sx = 0, sy = 0] = args.filter(a => a !== '--hash').map(Number);
Math.random = random(seed + 5);
const game = await makeGame(seed, { tether: reach, drill: 4 });
if (sx || sy) farStart(game, sx, sy);
let frames = 0, total = 0, worst = 0, worstAt = 0, over = 0, rubble = 0, bare = 0, bareWorst = 0, bareWorstAt = 0, bareOver = 0;
const hauls = game.updateHauls.bind(game);
game.updateHauls = dt => { const t = performance.now(); hauls(dt); rubble += performance.now() - t; };
for (const auto of wander(random(seed), turns)) {
  game.input.auto = auto;
  rubble = 0;
  const t = performance.now();
  game.update(1 / 60);
  const ms = performance.now() - t, rest = ms - rubble;
  frames++; total += ms; bare += rest;
  if (rest > bareWorst) { bareWorst = rest; bareWorstAt = frames; }
  if (rest > 16) bareOver++;
  if (ms > worst) { worst = ms; worstAt = frames; }
  if (ms > 16) over++;
  digest?.add(game);
}
console.log(JSON.stringify({ seed, reach, start: [sx, sy], frames, meanMs: +(total / frames).toFixed(4), worstMs: +worst.toFixed(2), worstAt, over16: over,
  withoutRubble: { meanMs: +(bare / frames).toFixed(4), worstMs: +bareWorst.toFixed(2), worstAt: bareWorstAt, over16: bareOver }, hauls: game.S.stats.hauls, bends: game.band.length, ...digest && { hash: digest.hex } }));
