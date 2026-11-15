// A long loose bar is lassoed at the end of two long legs. When it is hauled in, the bend on its corner should be
// let go and the string should settle on the hall's own corner; the triangle to search is too large, so the bend
// is left where the bar's corner was, in open space.
//   node test/hunt/geometry/big-triangle.mjs [legs = 900]
import { makeGame, tetherFaults, C, N, K, HX, HY, idx, arena, rocks, showBand } from './lib/rig.mjs';
const L = Number(process.argv[2] ?? 900);
const game = await makeGame(5, { tether: 9, momentum: 4 });
const w = game.world, d = game.drill;
arena(game, -2, -3, L + 3, 3);                                  // a hall east from the core
arena(game, L - 3, -3, L + 3, L + 110);                         // and one south from its far end
for (let y = -3; y <= 3; y++) for (let x = -2; x <= L + 3; x++) w.setK(idx(x, y), K.EMPTY);   // (the first hall again, where the second's wall crossed it)
// A bar of soft ground down the middle of the south hall, one cell wide, from just inside the east hall.
// It hangs on the hall's west wall by a spur at row 50.
for (let y = 1; y <= L + 100; y++) w.setK(idx(L, y), K.SOFT);
for (let x = L - 3; x < L; x++) w.setK(idx(x, 50), K.SOFT);
w.setK(idx(L - 1, 50), K.EMPTY);                                // the spur is cut: the bar lies loose
game.changed([idx(L - 1, 50)]);
console.log(`loose pieces: ${game.pieces.length}, cells in the bar: ${game.pieces[0]?.length}`);
let frames = 0, hauled = -1;
const check = label => { const f = tetherFaults(game); console.log(`${label}: frame ${frames}, drill ${(d.x - C).toFixed(1)},${(d.y - C).toFixed(1)}, hauls ${game.S.stats.hauls}, band ${showBand(game)}\n    ${f.join('; ') || 'sound'}`); return f; };
const step = (x, y, m) => { game.input.auto = [x, y, m]; game.update(1 / 60); frames++; if (hauled < 0 && game.S.stats.hauls) { hauled = frames; check('the frame the bar is hauled'); } };
step(1, 0, 0.5);
while (d.x - HX < L + 1.8) step(d.x - HX < L - 60 ? 1 : (L + 2 - (d.x - HX)) / 60 + 0.05, (-2 - (d.y - HY)) * 0.2, d.x - HX < L - 60 ? 1 : 0.4);   // east, along the row two above the core's
check('at the turn');
for (let f = 0; f < 4000 && hauled < 0; f++) step((L + 2 - (d.x - HX)) * 0.05, 1, 1);                    // south, east of the bar
for (let f = 0; f < 120; f++) step(0, 0, 0);
const faults = check('two seconds later, at rest');
// What the string should be: round the inner corner of the two halls.
console.log(`inner corner of the halls is at ${L - 3},4; a straight line from the core to the drill ${game.world.k(idx(Math.round(L / 2), Math.round(L / 2))) === K.EMPTY ? 'is open' : 'runs through solid ground'}`);
process.exit(faults.length ? 1 : 0);
