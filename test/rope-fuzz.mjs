// Flies the drill at random and checks the tether after every frame.
//   node test/rope-fuzz.mjs [seed] [turns] [reach level] [start x] [start y]
// A start away from the core carves a tunnel out to it first, so a run can begin deep in any direction's ground.
import { makeGame, random, tetherFaults, C, N, K } from './harness.mjs';

const [seed = 11, turns = 600, reach = 5, sx = 0, sy = 0] = process.argv.slice(2).map(Number);
const game = await makeGame(seed, { tether: reach, drill: 4 });
const d = game.drill, w = game.world, rnd = random(seed);

if (sx || sy) {
  // A straight tunnel from the core to the start, three cells wide, and the drill set down at the end of it.
  const len = Math.hypot(sx, sy);
  for (let s = 0; s <= len; s += 0.5) for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) w.setK((C + Math.round(sy * s / len) + v) * N + C + Math.round(sx * s / len) + u, K.EMPTY);
  d.x = C + sx + 0.5; d.y = C + sy + 0.5; d.mode = 'free';
  game.band = [[d.x, d.y], [C + 0.5, C + 0.5]];
  game.changed();
}

let frames = 0, bad = 0, heading = 0;
const seen = new Map();
for (let turn = 0; turn < turns; turn++) {
  heading += (rnd() - 0.5) * 2.5;
  const hold = 10 + Math.floor(rnd() * 50), pause = rnd() < 0.1;
  for (let f = 0; f < hold; f++) {
    game.input.auto = pause ? null : [Math.cos(heading), Math.sin(heading), 1];
    game.update(1 / 60);
    frames++;
    const faults = tetherFaults(game);
    if (!faults.length) continue;
    bad++;
    for (const fault of faults) {
      const kind = fault.replace(/[-\d.(),]+/g, '#');
      if (!seen.has(kind)) { seen.set(kind, 0); console.log(`frame ${frames}: ${fault}\n  band: ${JSON.stringify(game.band.slice(0, 6).map(p => [+(p[0] - C - 0.5).toFixed(2), +(p[1] - C - 0.5).toFixed(2), p[2] ?? 0]))}`); }
      seen.set(kind, seen.get(kind) + 1);
    }
  }
}
console.log(JSON.stringify({ seed, frames, framesWithFaults: bad, kinds: Object.fromEntries(seen), hauls: game.S.stats.hauls, at: [+(d.x - C - 0.5).toFixed(1), +(d.y - C - 0.5).toFixed(1)], bends: game.band.length }));
process.exit(bad ? 1 : 0);
