// Keyboard flying among single blocks of soft ground (cut when pushed into, reeled in when lassoed and home) and
// uncuttable bars: the tether is retightened again and again, and the homotopy oracle checks each result.
//   node test/regress/a-fuzz-soft.mjs [seed] [turns] [density %] [bits level] [bombs level]
// With a level of BLAST a charge is set off one turn in twenty, from a rack filled again whenever it is empty: the
// soft blocks within its disc are gone at once, and the bars stand.
import { makeGame, tetherFaults, C, N, K, HX, HY, idx, arena, rocks, Oracle, showBand } from './lib/rig.mjs';
import { random } from '../harness.mjs';

const [seed = 1, turns = 400, density = 12, bit = 0, bombs = 0] = process.argv.slice(2).map(Number);
const game = await makeGame(seed, { tether: 9, drill: bit, bombs });
const rnd = random(seed);
const R = 22;
arena(game, -R, -R, R, R);
const soft = new Set(), hard = [];
const far = (x, y) => Math.max(Math.abs(x), Math.abs(y)) > 2;
for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) if (far(x, y) && rnd() * 100 < density && !soft.has(`${x - 1},${y}`) && !soft.has(`${x},${y - 1}`)) soft.add(`${x},${y}`);
for (let n = 0; n < 6; n++) { const x = Math.floor(rnd() * 2 * R) - R, y = Math.floor(rnd() * 2 * R) - R, h = rnd() < 0.5; for (let k = 0; k < 3 + Math.floor(rnd() * 4); k++) { const c = h ? [x + k, y] : [x, y + k]; if (far(...c) && Math.abs(c[0]) <= R && Math.abs(c[1]) <= R) hard.push(c); } }
// soft blocks keep clear of the bars, so each stays a piece of its own
const near = (x, y) => hard.some(([hx, hy]) => Math.abs(hx - x) + Math.abs(hy - y) <= 1);
rocks(game, hard);
rocks(game, [...soft].map(s => s.split(',').map(Number)).filter(([x, y]) => !near(x, y)), K.SOFT);
game.changed();
const oracle = new Oracle(game, [-R, -R, R, R]).fine();
const d = game.drill;
const KEYS = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
let frames = 0, bad = 0, twins = 0, cuts = 0, blasts = 0;
const seen = new Map();
const note = (kind, text) => { if (!seen.has(kind)) { seen.set(kind, 0); console.log(`frame ${frames}: ${text}\n  drill ${(d.x - C).toFixed(4)},${(d.y - C).toFixed(4)} mode ${d.mode}\n  band ${showBand(game)}`); } seen.set(kind, seen.get(kind) + 1); };
for (let turn = 0; turn < turns && bad < 20; turn++) {
  for (const k of KEYS) game.key(k, false);
  const dir = Math.floor(rnd() * 8), hold = 4 + Math.floor(rnd() * 50);
  if (rnd() < 0.85) { game.key(KEYS[dir >> 1], true); if (dir & 1) game.key(KEYS[((dir >> 1) + 1) % 4], true); }
  if (bombs && rnd() < 0.05) { if (game.bombs <= 0) game.bombs = game.val('bombs'); game.blast(); blasts++; }
  for (let f = 0; f < hold; f++) {
    game.update(1 / 60);
    frames++;
    oracle.step();
    const faults = tetherFaults(game);
    for (const fault of faults) note('T ' + fault.replace(/[-\d.(),]+/g, '#'), fault);
    const mis = oracle.mismatch();
    if (mis) note('H', 'homotopy: ' + mis);
    const P = game.band;
    for (let n = 1; n + 2 < P.length; n++) if (P[n][0] === P[n + 1][0] && P[n][1] === P[n + 1][1]) { twins++; break; }
    if (faults.length || mis) bad++;
  }
}
console.log(JSON.stringify({ seed, density, frames, bad, framesWithTwins: twins, kinds: Object.fromEntries(seen), bends: game.band.length, hauls: game.S.stats.hauls, blasts, gone: oracle.punctures.filter(p => p.gone).length, of: oracle.punctures.length }));
process.exit(bad ? 1 : 0);
