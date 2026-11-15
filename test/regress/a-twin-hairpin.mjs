// A lasso round a corner leaves the tether hooked on that corner for good.
// Hand-made ground, steering only. A wall runs east from the west side and ends at a corner; beyond its end stands
// one loose block. The drill flies out past the wall's end, once round the block, back past the wall's end and
// home. The string passes the wall's end corner twice (out and back). Home, the block is reeled in; what is left is
// two bends on the same corner, one turning each way, which nothing ever lets go.
//   node test/hunt/geometry/twin-hairpin.mjs
import { makeGame, tetherFaults, C, N, K, HX, HY, idx, arena, rocks, flyTo, showBand, bandLength } from './lib/rig.mjs';
const game = await makeGame(9, { tether: 4 });
const w = game.world, d = game.drill;
arena(game, -6, -8, 22, 12);
for (let x = -6; x <= 9; x++) w.setK(idx(x, 3), K.SOFT);        // the wall: row 3, joined to the bedrock on the west
w.setK(idx(13, 6), K.SOFT);                                     // the block
game.changed();
let frames = 0, hauledAt = -1;
const each = () => { frames++; if (hauledAt < 0 && game.S.stats.hauls) hauledAt = frames; };
const say = label => console.log(`${label}: frame ${frames}, drill ${(d.x - HX).toFixed(2)},${(d.y - HY).toFixed(2)}, hauls ${game.S.stats.hauls}\n    band ${showBand(game)}  length ${bandLength(game).toFixed(2)}\n    harness check: ${tetherFaults(game).join('; ') || 'sound'}`);
const opts = { m: 0.3, each };
for (const [x, y] of [[11.5, 0], [11.5, 8], [15.5, 8], [15.5, 4], [11.5, 4], [11.5, 0], [4, 0]]) flyTo(game, x, y, opts);
say('back past the wall, once round the block');
for (let f = 0; f < 200 && !d.home; f++) { game.input.auto = [-1, 0, 0.6]; game.update(1 / 60); each(); }
game.input.auto = null;
for (let f = 0; f < 120; f++) { game.update(1 / 60); each(); }
say(`home (block reeled in at frame ${hauledAt}), two seconds on`);
flyTo(game, 0, -6, opts);                                       // north, away from the wall altogether
say('flown six cells north of the core');
const P = game.band, twin = P.length >= 4 && P[1][0] === P[2][0] && P[1][1] === P[2][1];
const straight = Math.hypot(d.x - HX, d.y - HY);
console.log(`the way from the drill to the core is open, ${straight.toFixed(2)} cells; the tether is ${bandLength(game).toFixed(2)} cells and has ${P.length - 2} bends${twin ? `: bends 1 and 2 are the same corner (cell ${P[1][3] % N - C},${Math.floor(P[1][3] / N) - C} corner ${P[1][4] % 4}), turning ${P[1][2]} and ${P[2][2]}` : ''}`);
process.exit(P.length > 2 ? 1 : 0);
