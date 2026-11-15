// When the tether has more than about 600 bends, retighten stops before it reaches the far ones: a bend whose
// ground is then removed is left standing in open space.
// The drill winds through a field of pillars until the band is long; then the cell under one far bend, and for
// comparison under one near bend, is opened (as a cut or a haul would) and the game told with changed().
//   node test/hunt/geometry/long-band.mjs
import { makeGame, tetherFaults, C, N, K, HX, HY, idx, arena, rocks, place, showBand } from './lib/rig.mjs';
import { random } from '../harness.mjs';
const game = await makeGame(1, { tether: 9, momentum: 2 });
const rnd = random(1), size = 70, X0 = 10, mx = X0 + size;
arena(game, X0, -size, X0 + 2 * size, size);
for (let x = -2; x < X0; x++) for (let y = -1; y <= 1; y++) game.world.setK(idx(x, y), K.EMPTY);
const cells = [];
for (let n = 0; n < 160; n++) cells.push([X0 + 4 + Math.floor(rnd() * (2 * size - 6)), -size + 2 + Math.floor(rnd() * (2 * size - 4))]);
rocks(game, cells);
place(game, X0 + 1, 0);
const d = game.drill;
let frames = 0, heading = 0, faulty = 0;
while (game.band.length < 720 && frames < 200000) {
  const spin = (rnd() - 0.5) * 0.12, hold = 20 + Math.floor(rnd() * 120);
  for (let f = 0; f < hold; f++) {
    heading += spin;
    const ox = d.x - HX - mx, oy = d.y - HY;
    if (Math.max(Math.abs(ox), Math.abs(oy)) > size - 14) heading = Math.atan2(-oy, -ox) + 0.5;
    game.input.auto = [Math.cos(heading), Math.sin(heading), 0.5];
    game.update(1 / 60); frames++;
    if (tetherFaults(game).length) faulty++;
  }
}
game.input.auto = null;
for (let f = 0; f < 30; f++) game.update(1 / 60);
console.log(`after ${frames} frames the band has ${game.band.length - 2} bends; frames with faults so far: ${faulty}`);
const open = at => {
  const P = game.band, b = P[at], cell = b[3], key = b[4], count = P.filter(p => p[3] === cell).length;
  game.world.setK(cell, K.EMPTY);
  game.changed([cell]);
  const left = game.band.filter(p => p[3] === cell).length, faults = tetherFaults(game);
  console.log(`opened the cell under bend ${at} (cell ${cell % N - C},${Math.floor(cell / N) - C}; ${count} bends were on it): ${left} bends are still on it; harness: ${faults.length ? faults.length + ' fault(s), first: ' + faults[0] : 'sound'}`);
  return left;
};
const near = open(100), far = open(game.band.length - 40);
process.exit(far ? 1 : 0);
