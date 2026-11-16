// Flies the drill at random and checks the tether after every frame.
//   node test/rope-fuzz.mjs [seed] [turns] [reach level] [start x] [start y]
// A start away from the core carves a tunnel out to it first, so a run can begin deep in any direction's ground.
import { makeGame, random, tetherFaults, farStart, wander, C } from './harness.mjs';

const [seed = 11, turns = 600, reach = 5, sx = 0, sy = 0] = process.argv.slice(2).map(Number);
const game = await makeGame(seed, { tether: reach, drill: 4 });
const d = game.drill;
if (sx || sy) farStart(game, sx, sy);

let frames = 0, bad = 0;
const seen = new Map();
for (const auto of wander(random(seed), turns)) {
  game.input.auto = auto;
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
console.log(JSON.stringify({ seed, frames, framesWithFaults: bad, kinds: Object.fromEntries(seen), hauls: game.S.stats.hauls, at: [+(d.x - C - 0.5).toFixed(1), +(d.y - C - 0.5).toFixed(1)], bends: game.band.length }));
process.exit(bad ? 1 : 0);
