// Random flight (as test/rope-fuzz.mjs) in one direction's ground with many more hazards than the world deals out:
// rock cells within 45 of the start are turned into the local hazard at the given density. Checks every frame: the
// stock tether faults, spans in a closed seam, the drill's own cell being rock, and how long the drill sat unable to
// move while steered.
// Fails on any frame with a fault. (Not for a start in the north: the frost has no hazard of its own.)
//   node test/regress/e-hazard-fuzz.mjs [seed=1] [turns=500] [start x=0] [start y=170] [density=0.08] [reach=5] [second | rare | plough, a comma list]
// With `second`, every ground that has a hazard is given a second one for the flight (the south spore pods, the
// west charged crystals, the east lava), the world lays it as it lays any row's, and half the hazards planted are
// the second: lava among moss, arcs beside lava, pods among crystals. With `rare`, what is planted is the rare
// hazard of the ground's direction (K.RARE), with no site round it: rime bells tolling their rings open (in the north
// too), fumaroles firing, glowworms swimming and lodestones pulling the ore near them, many to a screen. With
// `plough`, the drill has the bit's last level (MK8) and the diamond tip, and ploughs the plain ground among the
// hazards keeping its run (js/game.js: `ploughs`), which they still stop.
import { makeGame, tetherFaults, seamFaults, moreFaults, random, bandRel, rel, C, N, K } from './lib/terrain.mjs';
import { world, tunnel, setDown, wander } from '../harness.mjs';
const [seed = 1, turns = 500, sx = 0, sy = 170, density = 0.08, reach = 5] = process.argv.slice(2).map(Number), modes = (process.argv[8] ?? '').split(',');
const second = modes.includes('second'), rare = modes.includes('rare'), plough = modes.includes('plough');
if (second) {
  const NEXT = { lava: { type: 'spore', rate: 1 }, spore: { type: 'spark', rate: 1 }, spark: { type: 'lava', rate: 1, t: 0.78 } };
  for (const row of world.BIOMES.slice(1, 9)) if (row.haz) world.biome({ ...row, haz2: NEXT[row.haz.type] });
}
const game = await makeGame(seed, { tether: reach, drill: plough ? 7 : 4, ...plough && { diamond: 1 } });
const d = game.drill, w = game.world, rnd = random(seed + 77);
// The tunnel is cut before the hazards are planted round its end (none in it), and the drill set down after.
tunnel(game, sx, sy);
let made = 0, seconds = 0;
for (let y = sy - 45; y <= sy + 45; y++) for (let x = sx - 45; x <= sx + 45; x++) {
  const i = (C + y) * N + C + x, k = w.k(i);
  if ((k === K.SOFT || k === K.DENSE) && w.b(i) !== 0 && rnd() < density) { w.setK(i, rare ? K.RARE : second && rnd() < 0.5 ? K.HAZARD2 : K.HAZARD); made++; }
  if (w.k(i) === K.HAZARD2) seconds++;
}
setDown(game, sx, sy);
let frames = 0, bad = 0, still = 0, worst = 0, lavaMost = 0, basalt = 0, moss = 0;
const seen = new Map();
for (const auto of wander(rnd, turns)) {
  game.input.auto = auto;
  const x = d.x, y = d.y;
  game.update(1 / 60);
  frames++;
  lavaMost = Math.max(lavaMost, w.lava.size);
  if (auto && d.x === x && d.y === y && d.dig < 0 && d.stun <= 0) { still++; worst = Math.max(worst, still); } else still = 0;
  const faults = [...tetherFaults(game), ...seamFaults(game), ...moreFaults(game)];
  if (!faults.length) continue;
  bad++;
  for (const fault of faults) {
    const kind = fault.replace(/[-\d.(),]+/g, '#');
    if (!seen.has(kind)) { seen.set(kind, 0); console.log(`frame ${frames}: ${fault}\n  band: ${JSON.stringify(bandRel(game).slice(0, 6))}`); }
    seen.set(kind, seen.get(kind) + 1);
  }
}
console.log(JSON.stringify({ seed, start: [sx, sy], hazardsMade: made, secondHazards: seconds, frames, framesWithFaults: bad, kinds: Object.fromEntries(seen), mostLavaCells: lavaMost, longestStuckSeconds: +(worst / 60).toFixed(1), hauls: game.S.stats.hauls, at: rel([d.x, d.y]), bends: game.band.length }));
process.exit(bad || (second && !seconds) ? 1 : 0);
