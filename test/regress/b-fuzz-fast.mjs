// Fast flying (full stick, long clear runs) through a sparse field of uncuttable pillars.
//   node test/regress/b-fuzz-fast.mjs [seed] [turns] [momentum level] [pillars] [size] [frames a second]
import { makeGame, tetherFaults, C, N, K, HX, HY, idx, arena, rocks, place, Oracle, showBand } from './lib/rig.mjs';
import { random } from '../harness.mjs';

const [seed = 1, turns = 300, mom = 4, count = 80, size = 70, fps = 60] = process.argv.slice(2).map(Number);
const game = await makeGame(seed, { tether: 9, momentum: mom });
const rnd = random(seed);
const X0 = 10, X1 = X0 + 2 * size, Y0 = -size, Y1 = size, mx = X0 + size, my = 0;
arena(game, X0, Y0, X1, Y1);
for (let x = -2; x < X0; x++) for (let y = -1; y <= 1; y++) game.world.setK(idx(x, y), K.EMPTY);
for (let x = 3; x < X0 - 2; x++) { game.world.setK(idx(x, -2), K.BEDROCK); game.world.setK(idx(x, 2), K.BEDROCK); }
const cells = [];
for (let n = 0; n < count; n++) { const x = X0 + 4 + Math.floor(rnd() * (2 * size - 6)), y = Y0 + 2 + Math.floor(rnd() * (2 * size - 4)); cells.push([x, y]); if (rnd() < 0.3) cells.push([x + 1, y]); if (rnd() < 0.3) cells.push([x, y + 1]); }
rocks(game, cells);
place(game, X0 + 1, 0);
const oracle = new Oracle(game, [X0, Y0, X1, Y1]).fine();
const d = game.drill;
let frames = 0, bad = 0, heading = 0, top = 0;
const seen = new Map();
const note = (kind, text) => { if (!seen.has(kind)) { seen.set(kind, 0); console.log(`frame ${frames}: ${text}\n  speed ${Math.hypot(d.vx, d.vy).toFixed(1)} cells/s, run ${d.run.toFixed(2)}\n  band ${showBand(game)}`); } seen.set(kind, seen.get(kind) + 1); };
for (let turn = 0; turn < turns && bad < 50; turn++) {
  const spin = (rnd() - 0.5) * 0.12, hold = 20 + Math.floor(rnd() * 120);
  for (let f = 0; f < hold; f++) {
    heading += spin;
    // steer back toward the middle when near the walls
    const ox = d.x - HX - mx, oy = d.y - HY - my;
    if (Math.max(Math.abs(ox), Math.abs(oy)) > size - 14) heading = Math.atan2(-oy, -ox) + 0.5;
    game.input.auto = [Math.cos(heading), Math.sin(heading), 1];
    game.update(1 / fps);
    frames++; top = Math.max(top, Math.hypot(d.vx, d.vy));
    oracle.step();
    const faults = tetherFaults(game);
    for (const fault of faults) note('T ' + fault.replace(/[-\d.(),]+/g, '#'), fault);
    const mis = oracle.mismatch();
    if (mis) note('H', 'homotopy: ' + mis + ` drill ${(d.x - C).toFixed(3)},${(d.y - C).toFixed(3)} from ${(d.px - C).toFixed(3)},${(d.py - C).toFixed(3)}`);
    if (faults.length || mis) bad++;
  }
}
console.log(JSON.stringify({ seed, mom, fps, frames, bad, topSpeed: +top.toFixed(1), kinds: Object.fromEntries(seen), bends: game.band.length, hauls: game.S.stats.hauls }));
process.exit(bad ? 1 : 0);
