// Three loose rocks in an open cavern beside the core. The drill flies round all three and comes home.
// The two outer ones are reeled; the string then closes on the one between them, and that one is left lassoed.
//   node test/hunt/modes/home-wound.mjs
import { makeGame, tetherFaults, C, N, K } from '../harness.mjs';
const game = await makeGame(7, { tether: 3 });
const d = game.drill, w = game.world, at = (x, y) => (C + y) * N + C + x;
for (let y = -14; y <= 14; y++) for (let x = -6; x <= 20; x++) w.setK(at(x, y), K.EMPTY);
const rocks = { north: at(10, -4), south: at(10, 4), middle: at(8, 0) };
for (const i of Object.values(rocks)) w.setK(i, K.DENSE);
game.pieces = []; game.changed();

const rel = () => game.band.map(p => [+(p[0] - C - 0.5).toFixed(1), +(p[1] - C - 0.5).toFixed(1)]);
const flyTo = (x, y) => {
  for (let f = 0; f < 600; f++) {
    const dx = C + 0.5 + x - d.x, dy = C + 0.5 + y - d.y, far = Math.hypot(dx, dy);
    if (far < 0.4 || (d.mode === 'free' && d.park)) break;
    game.input.auto = [dx / far, dy / far, 1];
    game.update(1 / 60);
  }
};
const left = () => Object.entries(rocks).filter(([, i]) => w.k(i) !== K.EMPTY).map(([name]) => name);
// How many times the closed string winds round a cell's middle.
const winds = i => {
  const pts = game.band, x = (i % N) + 0.5, y = Math.floor(i / N) + 0.5;
  let turns = 0;
  for (let n = 0; n < pts.length; n++) {
    const a = pts[n], b = pts[(n + 1) % pts.length];
    if (a[1] <= y) { if (b[1] > y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) > 0) turns++; }
    else if (b[1] <= y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) < 0) turns--;
  }
  return turns;
};
d.x = C + 0.5; d.y = C - 2 + 0.5; game.band = [[d.x, d.y], [C + 0.5, C + 0.5]];      // set down just off the core, so no throw
for (const [x, y] of [[3, -8], [14, -8], [14, 8], [3, 8], [0, 3], [0, 0]]) flyTo(x, y);
game.input.auto = null;
for (let f = 0; f < 120; f++) game.update(1 / 60);
console.log(`drill ${(game.far).toFixed(2)} cells from the core, mode ${d.mode}; hauls ${game.S.stats.hauls}; rocks left: ${left().join(', ') || 'none'}`);
console.log(`band: ${JSON.stringify(rel())}`);
console.log(`the string winds ${winds(rocks.middle)} time(s) round the middle rock; known loose pieces: ${game.pieces.length}; faults: ${JSON.stringify(tetherFaults(game))}`);
// It stays that way however long the drill sits at home.
for (let f = 0; f < 600; f++) game.update(1 / 60);
console.log(`10 s later: rocks left: ${left().join(', ') || 'none'}; band has ${game.band.length} points`);
const stuck = left().length;
// Only leaving home and arriving again makes the game look once more.
d.park = false;
flyTo(0, 4); flyTo(0, 0);
game.input.auto = null;
for (let f = 0; f < 60; f++) game.update(1 / 60);
console.log(`after flying 4 cells out and home again: rocks left: ${left().join(', ') || 'none'}; hauls ${game.S.stats.hauls}`);
process.exit(stuck ? 1 : 0);
