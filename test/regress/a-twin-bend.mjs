// A haul leaves the tether hooked on a corner it no longer goes round: two bends on the same corner, with opposite
// turns, each shielding the other from being let go.
// Staged ground in an open arena: a wall W (held), a piece P to the north-west of W's corner (a block, a tail down
// from it and a foot running east under W, past the core), joined to held ground by one cell under the foot.
// Real play: the drill flies round the foot's tip, under W's south-west corner, up between W and the block, over
// the block, down its west side, under the foot, and cuts the joining cell. P comes loose with the tether right
// round it and is reeled. With P gone there is nothing between the drill and the core.
//   node test/hunt/terrain/twin-bend.mjs
import { makeGame, tetherFaults, seamFaults, moreFaults, openBends, flyTo, idle, idx, open, C, N, K } from './lib/terrain.mjs';

const game = await makeGame(7, { tether: 4, drill: 4 });
const w = game.world, d = game.drill, log = [];
open(game, -40, -40, 40, 40);
open(game, -8, -14, -3, -10, K.SOFT); open(game, -3, -44, -3, -15, K.SOFT);             // W, held from the north
open(game, -16, -22, -10, -17, K.SOFT);                                                 // P: the block,
open(game, -12, -16, -12, -4, K.SOFT);                                                  //    its tail,
open(game, -12, -3, 6, -3, K.SOFT);                                                     //    and its foot
open(game, -6, -2, -6, 44, K.SOFT);                                                     // the joining cell and a spit of held ground
game.changed();
const corner = p => p[3] === undefined ? `(${(p[0] - C).toFixed(2)},${(p[1] - C).toFixed(2)})` : `bend(${p[0] - C},${p[1] - C} turn ${p[2]} on cell ${p[3] % N - C},${Math.floor(p[3] / N) - C})`;
const map = () => { const rows = []; for (let y = -25; y <= 3; y++) { let s = String(y).padStart(4) + ' '; for (let x = -20; x <= 10; x++) { const k = w.k(idx(x, y)); s += x === 0 && y === 0 ? 'C' : Math.floor(d.x) - C === x && Math.floor(d.y) - C === y ? 'D' : k === K.EMPTY ? '.' : '#'; } rows.push(s); } return rows.join('\n'); };
for (const [x, y] of [[8, -1], [8, -5], [-9, -8], [-9, -24], [-18, -24], [-18, -2], [-8, -2]]) if (flyTo(game, x, y, { log, near: 0.08, settle: true }) < 0) throw new Error(`never reached ${x},${y}`);
console.log(`ground before the last cut (C core, D drill; columns x=-20..10):\n${map()}`);
console.log(`tether before the last cut:\n  ${game.band.map(corner).join('\n  ')}`);
console.log(`loose pieces known: ${game.pieces.length}; faults on the way: ${JSON.stringify([...new Set(log)])}`);
const hauls = game.S.stats.hauls;
for (let f = 0; f < 300 && game.S.stats.hauls === hauls; f++) { game.input.auto = [1, 0, 1]; game.update(1 / 60); }
console.log(`\nhauled ${game.S.stats.hauls - hauls} piece of ${game.S.stats.best} cells. Tether straight after:\n  ${game.band.map(corner).join('\n  ')}`);
idle(game, 120);
console.log(`two seconds later:\n  ${game.band.map(corner).join('\n  ')}`);
console.log(`ground now:\n${map()}`);
const P = game.band, straight = Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]);
let length = 0;
for (let n = 1; n < P.length; n++) length += Math.hypot(P[n][0] - P[n - 1][0], P[n][1] - P[n - 1][1]);
const faults = [...tetherFaults(game), ...seamFaults(game), ...moreFaults(game)], hooked = openBends(game);
console.log(`stock tetherFaults: ${JSON.stringify(faults)}`);
console.log(`bends round open space: ${JSON.stringify(hooked)}`);
console.log(`tether length ${length.toFixed(2)} cells; drill to core in a straight line ${straight.toFixed(2)} cells, and that line is ${game.world && (await import('../harness.mjs')).sight(w, P[0][0], P[0][1], P[P.length - 1][0], P[P.length - 1][1]) ? 'clear' : 'blocked'}`);
// Does flying about shake it off? Down and back.
const later = [];
flyTo(game, -8, 6, { log: later, near: 0.3 }); flyTo(game, 4, 6, { log: later, near: 0.3 });
console.log(`after flying to (-8,6) then (4,6): tether ${game.band.map(corner).join(' ')}; stock faults on the way: ${JSON.stringify([...new Set(later.map(f => f.replace(/[-\d.(),]+/g, '#')))])}`);
flyTo(game, 0, 0, { log: later, near: 0.05, max: 900 }); idle(game, 60);
console.log(`after flying home and letting go: drill at (${(d.x - C).toFixed(2)},${(d.y - C).toFixed(2)}), tether ${game.band.map(corner).join(' ')}`);
process.exit(hooked.length || faults.length ? 1 : 0);
