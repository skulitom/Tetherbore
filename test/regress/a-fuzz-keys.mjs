// Keyboard flying round the core: only the eight exact directions, so throws and flights run exactly along rows,
// columns and diagonals, through the very corners of ground. Uncuttable fields; harness check and homotopy oracle.
//   node test/regress/a-fuzz-keys.mjs [seed] [turns] [field] [momentum level]
import { makeGame, tetherFaults, C, N, K, HX, HY, idx, arena, rocks, Oracle, bendFaults, showBand } from './lib/rig.mjs';
import { random } from '../harness.mjs';

const [seed = 1, turns = 300, field = 0, mom = 0] = process.argv.slice(2).map(Number);
const game = await makeGame(seed, { tether: 9, momentum: mom });
const rnd = random(seed + 31 * field);
const R = 26;
arena(game, -R, -R, R, R);
const cells = [];
const ok = ([x, y]) => Math.max(Math.abs(x), Math.abs(y)) > 2 && Math.max(Math.abs(x), Math.abs(y)) <= R;
if (field === 0) for (let n = 0; n < 90; n++) cells.push([Math.floor(rnd() * 2 * R) - R, Math.floor(rnd() * 2 * R) - R]);
else if (field === 1) for (let n = 0; n < 24; n++) { const x = Math.floor(rnd() * 2 * R) - R, y = Math.floor(rnd() * 2 * R) - R, s = rnd() < 0.5; for (let k = 0; k < 2 + Math.floor(rnd() * 5); k++) cells.push([x + k, y + (s ? k : -k)]); }
else if (field === 2) for (let y = -R + 1; y < R; y += 3) for (let x = -R + 1; x < R; x += 3) cells.push([x, y]);
else if (field === 3) for (let y = -R + 1; y < R; y += 2) for (let x = -R + 1; x < R; x += 2) if (rnd() < 0.6) cells.push([x, y]);
else if (field === 4) for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) if ((x + y) % 2 === 0 && rnd() < 0.5 && (Math.abs(x) + Math.abs(y)) % 7 < 3) cells.push([x, y]);
rocks(game, cells.filter(ok));
game.changed();
const oracle = new Oracle(game, [-R, -R, R, R]).fine();
const d = game.drill;
const KEYS = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
let frames = 0, bad = 0, flings = 0, homes = 0, mode = 'free';
const seen = new Map();
const note = (kind, text) => { if (!seen.has(kind)) { seen.set(kind, 0); console.log(`frame ${frames}: ${text}\n  drill ${(d.x - C).toFixed(4)},${(d.y - C).toFixed(4)} mode ${d.mode}\n  band ${showBand(game)}`); } seen.set(kind, seen.get(kind) + 1); };
for (let turn = 0; turn < turns && bad < 20; turn++) {
  for (const k of KEYS) game.key(k, false);
  const dir = Math.floor(rnd() * 8), hold = 4 + Math.floor(rnd() * 50);
  if (rnd() < 0.85) { game.key(KEYS[dir >> 1], true); if (dir & 1) game.key(KEYS[((dir >> 1) + 1) % 4], true); }
  for (let f = 0; f < hold; f++) {
    game.update(1 / 60);
    frames++;
    if (d.mode !== mode) { if (d.mode === 'fling') flings++; if (d.mode === 'home') homes++; mode = d.mode; }
    oracle.step();
    const faults = tetherFaults(game);
    for (const fault of faults) note('T ' + fault.replace(/[-\d.(),]+/g, '#'), fault);
    const mis = oracle.mismatch();
    if (mis) note('H', 'homotopy: ' + mis);
    for (const s of bendFaults(game)) if (!/zero turn/.test(s)) note('B ' + s.replace(/[-\d.(),]+/g, '#'), s);
    if (faults.length || mis) bad++;
  }
}
console.log(JSON.stringify({ seed, field, mom, frames, bad, flings, homes, kinds: Object.fromEntries(seen), bends: game.band.length, hauls: game.S.stats.hauls }));
process.exit(bad ? 1 : 0);
