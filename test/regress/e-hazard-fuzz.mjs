// Random flight (as test/rope-fuzz.mjs) in one direction's ground with many more hazards than the world deals out:
// rock cells within 45 of the start are turned into the local hazard at the given density. Checks every frame: the
// stock tether faults, spans in a closed seam, the drill's own cell being rock, and how long the drill sat unable to
// move while steered.
//   node test/regress/e-hazard-fuzz.mjs [seed=1] [turns=500] [start x=0] [start y=170] [density=0.08] [reach=5]
import { makeGame, tetherFaults, seamFaults, moreFaults, random, bandRel, rel, C, N, K } from './lib/terrain.mjs';
const [seed = 1, turns = 500, sx = 0, sy = 170, density = 0.08, reach = 5] = process.argv.slice(2).map(Number);
const game = await makeGame(seed, { tether: reach, drill: 4 });
const d = game.drill, w = game.world, rnd = random(seed + 77);
const len = Math.hypot(sx, sy);
for (let s = 0; s <= len; s += 0.5) for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) w.setK((C + Math.round(sy * s / len) + v) * N + C + Math.round(sx * s / len) + u, K.EMPTY);
let made = 0;
for (let y = sy - 45; y <= sy + 45; y++) for (let x = sx - 45; x <= sx + 45; x++) {
  const i = (C + y) * N + C + x, k = w.k(i);
  if ((k === K.SOFT || k === K.DENSE) && w.b(i) !== 0 && rnd() < density) { w.setK(i, K.HAZARD); made++; }
}
d.x = C + sx + 0.5; d.y = C + sy + 0.5; d.mode = 'free';
game.band = [[d.x, d.y], [C + 0.5, C + 0.5]];
game.changed();
let frames = 0, bad = 0, heading = 0, still = 0, worst = 0, lavaMost = 0, basalt = 0, moss = 0;
const seen = new Map();
for (let turn = 0; turn < turns; turn++) {
  heading += (rnd() - 0.5) * 2.5;
  const hold = 10 + Math.floor(rnd() * 50), pause = rnd() < 0.1;
  for (let f = 0; f < hold; f++) {
    game.input.auto = pause ? null : [Math.cos(heading), Math.sin(heading), 1];
    const x = d.x, y = d.y;
    game.update(1 / 60);
    frames++;
    lavaMost = Math.max(lavaMost, w.lava.size);
    if (!pause && d.x === x && d.y === y && d.dig < 0 && d.stun <= 0) { still++; worst = Math.max(worst, still); } else still = 0;
    const faults = [...tetherFaults(game), ...seamFaults(game), ...moreFaults(game)];
    if (!faults.length) continue;
    bad++;
    for (const fault of faults) {
      const kind = fault.replace(/[-\d.(),]+/g, '#');
      if (!seen.has(kind)) { seen.set(kind, 0); console.log(`frame ${frames}: ${fault}\n  band: ${JSON.stringify(bandRel(game).slice(0, 6))}`); }
      seen.set(kind, seen.get(kind) + 1);
    }
  }
}
console.log(JSON.stringify({ seed, start: [sx, sy], hazardsMade: made, frames, framesWithFaults: bad, kinds: Object.fromEntries(seen), mostLavaCells: lavaMost, longestStuckSeconds: +(worst / 60).toFixed(1), hauls: game.S.stats.hauls, at: rel([d.x, d.y]), bends: game.band.length }));
