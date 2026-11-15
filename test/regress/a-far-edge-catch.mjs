// After a haul the tether takes up a corner it does not go round: one that lies exactly on the span it is
// straightening away from, on a cell beyond that span.
// Staged, in an open arena: a held cell X (hanging from a wall to the east) and a long loose piece L (a slab south of
// the core with an arm standing up from it, cut free beforehand). Real play: the drill flies round L's west end,
// under it, up its east side, past X's west face, over X and on north, until the tether is right round L and L is
// reeled. With L gone the taut tether is core -> X's north-west corner -> drill.
//   node test/hunt/terrain/far-edge-catch.mjs
import { makeGame, tetherFaults, seamFaults, moreFaults, openBends, flyTo, idle, idx, open, C, N, K } from './lib/terrain.mjs';

const game = await makeGame(7, { tether: 4, drill: 4 });
const w = game.world, d = game.drill, log = [];
open(game, -40, -40, 40, 40);
open(game, 10, -8, 44, -8, K.SOFT);                                       // X at (10,-8), held from the east
open(game, -10, 2, 9, 5, K.SOFT); open(game, 7, -11, 7, 1, K.SOFT);       // L: the slab and its arm
open(game, -44, 3, -11, 3, K.SOFT);                                       // a spit of held ground joined to L's west end...
game.changed();
w.setK(idx(-11, 3), K.EMPTY); game.changed([idx(-11, 3)]);                // ...and the joining cell cut: L is loose
const corner = p => p[3] === undefined ? `(${(p[0] - C).toFixed(2)},${(p[1] - C).toFixed(2)})` : `bend(${p[0] - C},${p[1] - C} turn ${p[2]} on cell ${p[3] % N - C},${Math.floor(p[3] / N) - C})`;
console.log(`loose pieces known before flying: ${game.pieces.length} (${game.loose.length} cells)`);
for (const [x, y] of [[-11, 0], [-11, 7], [10, 7], [10, -5], [9, -6], [9, -10], [12, -10]]) if (flyTo(game, x, y, { log, near: 0.08, settle: true }) < 0) throw new Error(`never reached ${x},${y}`);
console.log(`L still whole on the way round: ${game.loose.length} cells`);
const hauls = game.S.stats.hauls;
let before = null;
for (let f = 0; f < 600 && game.S.stats.hauls === hauls; f++) { before = game.band.map(corner); game.input.auto = [0, -1, 1]; game.update(1 / 60); log.push(...tetherFaults(game)); }
console.log(`tether just before the haul:\n  ${before.join('\n  ')}`);
console.log(`faults on the way: ${JSON.stringify([...new Set(log)])}`);
console.log(`\nhauled ${game.S.stats.hauls - hauls} piece of ${game.S.stats.best} cells. Tether straight after:\n  ${game.band.map(corner).join('\n  ')}`);
idle(game, 120);
const hooked = openBends(game), faults = [...tetherFaults(game), ...seamFaults(game), ...moreFaults(game)];
console.log(`two seconds later:\n  ${game.band.map(corner).join('\n  ')}`);
console.log(`cells round X now (x=8..12, y=-10..-6): ${[-10, -9, -8, -7, -6].map(y => [8, 9, 10, 11, 12].map(x => w.k(idx(x, y)) === K.EMPTY ? '.' : '#').join('')).join(' / ')}`);
console.log(`stock tetherFaults: ${JSON.stringify(faults)}`);
console.log(`bends round open space: ${JSON.stringify(hooked)}`);
process.exit(hooked.length || faults.length ? 1 : 0);
