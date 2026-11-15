// "Ground never grows back across the tether" (updateHazards): but a span between two bends on the same grid line
// lies exactly on a cell boundary, and the cells it is held to protect are only those to one side of that line
// (cellsAlong floors it) plus those under the drawn line, which crosses from one side to the other halfway along.
// So in a shaft that steps sideways off the middle, moss closes a cell the string runs beside, and the string is
// left between two rocks.
//   node test/hunt/modes/moss-on-line.mjs
import { makeGame, tetherFaults, C, N, K, B } from '../harness.mjs';
const game = await makeGame(7, { tether: 3, drill: 4 });
const d = game.drill, w = game.world, at = (x, y) => (C + y) * N + C + x;
// Staged: stone south-west of the core (the west's ground), a room above, a room below, and between them a shaft
// one cell wide that steps one cell east at row 12. A spore pod lies beside the shaft at row 11.
for (let y = 3; y <= 26; y++) for (let x = -14; x <= 4; x++) { w.setK(at(x, y), K.DENSE); w.setB(at(x, y), B.MIRE); }
for (let y = 3; y <= 5; y++) for (let x = -8; x <= 2; x++) w.setK(at(x, y), K.EMPTY);
for (let y = 6; y <= 10; y++) w.setK(at(-6, y), K.EMPTY);
w.setK(at(-6, 11), K.SOFT); w.setK(at(-6, 12), K.SOFT); w.setK(at(-7, 11), K.HAZARD);
for (let y = 12; y <= 15; y++) w.setK(at(-5, y), K.EMPTY);
for (let y = 16; y <= 22; y++) for (let x = -12; x <= -2; x++) w.setK(at(x, y), K.EMPTY);
game.pieces = []; game.changed();
const step = auto => { game.input.auto = auto; game.update(1 / 60); };
const flyTo = (x, y) => { for (let f = 0; f < 900; f++) { const dx = C + 0.5 + x - d.x, dy = C + 0.5 + y - d.y, far = Math.hypot(dx, dy); if (far < 0.12) return; step([dx / far, dy / far, Math.min(1, 0.4 + far)]); } };
const rel = () => JSON.stringify(game.band.map(p => [+(p[0] - C - 0.5).toFixed(2), +(p[1] - C - 0.5).toFixed(2)]));
const row = y => [-7, -6, -5, -4].map(x => w.k(at(x, y)) === K.EMPTY ? '.' : '#').join('');
// Played: down the shaft (cutting its last two cells, which bursts the pod), out into the lower room, and wait.
d.x = C + 0.5; d.y = C + 2 + 0.5; game.band = [[d.x, d.y], [C + 0.5, C + 0.5]];
flyTo(-6, 4); flyTo(-6, 12); flyTo(-5, 12); flyTo(-5, 17); flyTo(-9, 20);
console.log(`pod burst: ${game.clouds.length === 1}; band ${rel()}; faults ${tetherFaults(game).length}`);
console.log(`shaft rows 10..13, columns -7..-4 (the string runs down the line between columns -6 and -5):\n  ${[10, 11, 12, 13].map(row).join('\n  ')}`);
for (let f = 0; f < 480; f++) step(null);
console.log(`8 s later, nothing steered: band ${rel()}\n  ${[10, 11, 12, 13].map(row).join('\n  ')}`);
const pinched = [];
for (let n = 1; n + 1 < game.band.length; n++) {
  const a = game.band[n], b = game.band[n + 1];
  if (a[0] !== b[0]) continue;
  for (let y = Math.min(a[1], b[1]); y < Math.max(a[1], b[1]); y++) if (w.k(y * N + a[0]) !== K.EMPTY && w.k(y * N + a[0] - 1) !== K.EMPTY) pinched.push(y - C);
}
console.log(`rows where the string runs between two cells of rock: ${pinched.join(', ') || 'none'}; tetherFaults() (which allows a string on a cell's edge): ${tetherFaults(game).length}`);
// The drill flies east across the lower room: the string leaves the lower corner and now cuts through the stone.
flyTo(-3, 20);
const faults = tetherFaults(game);
console.log(`after flying east: band ${rel()}\n  faults: ${faults.join('; ') || 'none'}`);
process.exit(pinched.length || faults.length ? 1 : 0);
