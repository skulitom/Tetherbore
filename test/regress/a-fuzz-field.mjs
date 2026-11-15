// Random slow flying in hand-made fields of uncuttable rock, checked by the harness and by the homotopy oracle.
//   node test/regress/a-fuzz-field.mjs [seed] [turns] [field] [m]
import { makeGame, tetherFaults, C, N, K, HX, HY, idx, arena, rocks, place, Oracle, bendFaults, showBand } from './lib/rig.mjs';
import { random } from '../harness.mjs';

const [seed = 1, turns = 400, field = 0, m = 0.15] = process.argv.slice(2).map(Number);
const game = await makeGame(seed, { tether: 9 });
const rnd = random(seed + 1000 * field);
const X0 = 20, Y0 = -12, X1 = 44, Y1 = 12;
arena(game, X0, Y0, X1, Y1);
// a way in from the core, three wide
for (let x = -2; x < X0; x++) for (let y = -1; y <= 1; y++) game.world.setK(idx(x, y), K.EMPTY);
for (let x = 3; x < X0 - 2; x++) { game.world.setK(idx(x, -2), K.BEDROCK); game.world.setK(idx(x, 2), K.BEDROCK); }
const cells = [];
if (field === 0) {            // scattered single pillars
  for (let n = 0; n < 40; n++) cells.push([X0 + 2 + Math.floor(rnd() * 21), Y0 + 1 + Math.floor(rnd() * 23)]);
} else if (field === 1) {     // diagonal chains: every pair touches only at a corner
  for (let n = 0; n < 8; n++) { const x = X0 + 3 + Math.floor(rnd() * 16), y = Y0 + 2 + Math.floor(rnd() * 16), s = rnd() < 0.5 ? 1 : -1; for (let k = 0; k < 2 + Math.floor(rnd() * 4); k++) cells.push([x + k, y + (s > 0 ? k : 5 - k)]); }
} else if (field === 2) {     // a regular lattice of pillars two apart: many corners in line
  for (let y = Y0 + 2; y <= Y1 - 2; y += 3) for (let x = X0 + 3; x <= X1 - 2; x += 3) cells.push([x, y]);
} else if (field === 3) {     // bars and one-wide corridors
  for (let n = 0; n < 10; n++) { const x = X0 + 3 + Math.floor(rnd() * 18), y = Y0 + 2 + Math.floor(rnd() * 18), h = rnd() < 0.5, len = 2 + Math.floor(rnd() * 6); for (let k = 0; k < len; k++) cells.push(h ? [x + k, y] : [x, y + k]); }
} else if (field === 4) {     // checkerboard patches: nothing but pinches
  for (let n = 0; n < 5; n++) { const x = X0 + 3 + Math.floor(rnd() * 15), y = Y0 + 2 + Math.floor(rnd() * 15); for (let v = 0; v < 4; v++) for (let u = 0; u < 4; u++) if ((u + v) % 2 === 0) cells.push([x + u, y + v]); }
}
rocks(game, cells.filter(([x, y]) => x > X0 + 1 && x <= X1 && y >= Y0 && y <= Y1 && !(Math.abs(y) <= 1 && x < X0 + 4)));
place(game, X0 + 1, 0);
const oracle = new Oracle(game, [X0, Y0, X1, Y1]);
// the oracle's flown path so far is core -> drill, straight
const d = game.drill;
let frames = 0, bad = 0, heading = 0, zeroRun = 0, worstZero = 0;
const seen = new Map();
const note = (kind, text) => { if (!seen.has(kind)) { seen.set(kind, 0); console.log(`frame ${frames}: ${text}\n  band ${showBand(game)}`); } seen.set(kind, seen.get(kind) + 1); };
for (let turn = 0; turn < turns; turn++) {
  heading += (rnd() - 0.5) * 2.5;
  const hold = 10 + Math.floor(rnd() * 90), pause = rnd() < 0.05;
  for (let f = 0; f < hold; f++) {
    // keep out of the way in, so the drill never goes home
    let hx = Math.cos(heading), hy = Math.sin(heading);
    if (d.x - HX < X0 + 1.5 && hx < 0) { heading = Math.PI - heading; hx = -hx; }
    game.input.auto = pause ? null : [hx, hy, m];
    game.update(1 / 60);
    frames++;
    oracle.step();
    const faults = tetherFaults(game);
    for (const fault of faults) note('T ' + fault.replace(/[-\d.(),]+/g, '#'), fault);
    const mis = oracle.mismatch();
    if (mis) note('H', 'homotopy: ' + mis + ` drill ${(d.x - C).toFixed(3)},${(d.y - C).toFixed(3)}`);
    const bf = bendFaults(game);
    if (bf.some(s => /zero turn/.test(s))) { zeroRun++; worstZero = Math.max(worstZero, zeroRun); } else zeroRun = 0;
    for (const s of bf) if (!/zero turn/.test(s)) note('B ' + s.replace(/[-\d.(),]+/g, '#'), s);
    if (faults.length || mis) bad++;
    if (mis && seen.get('H') > 3) { turn = turns; break; }
  }
}
console.log(JSON.stringify({ seed, field, frames, bad, worstZero, kinds: Object.fromEntries(seen), bends: game.band.length, hauls: game.S.stats.hauls, punctures: oracle.punctures.length }));
process.exit(bad ? 1 : 0);
