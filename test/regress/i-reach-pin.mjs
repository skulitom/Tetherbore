// The end of the reach must never pin the drill. Staged: the drill stands in the middle of a cell that lies a
// quarter of a cell beyond its reach (where the game itself sets it when lava runs into a cell its body overlaps:
// `node test/verify-fuzz/stuck.mjs 34 600 5 60 210` in the verifiers' fuzz, 326 s on one spot), rock to the north
// of it, the corridor it came by to the west. Steered at the core, then eight ways for two seconds each, it must
// move or cut. Before the fix every small move, the one straight at the core among them, was drawn back to the
// reach, landed in the rock beside that spot and was undone, and nothing it was pushed against was ever cut.
//   node test/regress/i-reach-pin.mjs
import { makeGame, tetherFaults, C, N, K } from '../harness.mjs';

let bad = 0;
for (const [ram, hz] of [[0, 60], [3, 120], [0, 30]]) {
  const game = await makeGame(34, { tether: 5, drill: 4, momentum: ram });
  // (The place is laid out for a reach of 230 cells, which the sixth reach was: the game is given that reach.)
  const val = game.val.bind(game);
  game.val = id => id === 'tether' ? 230 : val(id);
  const d = game.drill, w = game.world, at = (x, y) => (C + y) * N + C + x, HX = C + 0.5, R = game.val('tether');
  // Solid soft ground round the spot; a tunnel three cells wide from the core, then a corridor one cell wide east
  // along a row to the spot. The drill flies the corridor to the end of its reach, and is then set in the middle of
  // the corridor's last cell, as the game sets it when ground closes on it.
  for (let y = 214; y <= 238; y++) for (let x = 28; x <= 56; x++) w.setK(at(x, y), K.SOFT);
  for (let s = 0; s <= 1; s += 0.001) for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) w.setK(at(Math.round(38 * s) + u, Math.round(226 * s) + v), K.EMPTY);
  for (let x = 39; x <= 44; x++) w.setK(at(x, 226), K.EMPTY);
  d.x = HX + 38; d.y = HX + 226; d.mode = 'free';
  game.band = [[d.x, d.y], [HX, HX]];
  game.changed();
  if (tetherFaults(game).length) throw new Error(`staging is wrong: ${tetherFaults(game)}`);
  for (let f = 0; f < 3 * hz; f++) { game.input.auto = [1, 0, 1]; game.update(1 / hz); }
  d.x = HX + 44; d.y = HX + 226; d.vx = d.vy = 0; game.tend();
  if (tetherFaults(game).length || !game.free(d.x, d.y) || game.far <= R) throw new Error(`staging is wrong: ${tetherFaults(game)} ${game.far}`);
  let cuts = 0;
  const dig = game.finishDig.bind(game); game.finishDig = i => { cuts++; dig(i); };
  const from = [d.x, d.y], ways = [[HX - d.x, HX - d.y], ...Array.from({ length: 8 }, (_, k) => [Math.cos(k * Math.PI / 4), Math.sin(k * Math.PI / 4)])];
  let moved = false, faults = [];
  for (const [x, y] of ways) for (let f = 0; f < 2 * hz && !moved; f++) {
    game.input.auto = [x / Math.hypot(x, y), y / Math.hypot(x, y), 1];
    game.update(1 / hz);
    faults = tetherFaults(game);
    if (faults.length) break;
    moved = cuts > 0 || Math.hypot(d.x - from[0], d.y - from[1]) > 0.05;
  }
  const out = game.far - R;
  console.log(`ram ${ram} at ${hz} fps: ${moved ? 'it moved or cut' : 'PINNED: steered at the core and eight ways for 2 s each it neither moved nor cut'}; ${out > 0 ? `${out.toFixed(3)} beyond the reach` : 'within the reach'}; faults ${JSON.stringify(faults)}`);
  if (!moved || faults.length) bad++;
}
process.exit(bad ? 1 : 0);
