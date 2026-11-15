// A fast straight flight far out must not cost a sweep of the whole tether for every small move. With no bend the
// string sweeps about the core, so each sweep looks along every row the tether spans; fly() moves the drill in
// small moves (a dozen a frame at speed, more at a low frame rate), and the string followed each one. Small moves
// that go straight on are one straight line, and the string is now led along the run of them at once.
// Staged: a tunnel three cells wide at 37 degrees. Counted over the last stretch of the flight: sweeps a frame (it
// was 14 at 60 fps and 38 at 20 fps; one or two is right) and the cells they looked at.
//   node test/regress/b-straight-run.mjs
import { makeGame, tetherFaults, C, N, K } from '../harness.mjs';

let bad = 0;
for (const [dt, ram] of [[1 / 60, 4], [0.05, 4], [1 / 60, 0]]) {
  const L = 700, game = await makeGame(7, { tether: 7, momentum: ram }), w = game.world, d = game.drill;
  const ux = Math.cos(37 * Math.PI / 180), uy = Math.sin(37 * Math.PI / 180);
  for (let s = 0; s <= L + 4; s += 0.5) for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) w.setK((C + Math.round(uy * s) + v) * N + C + Math.round(ux * s) + u, K.EMPTY);
  d.x = C + 0.5 + ux * 6; d.y = C + 0.5 + uy * 6; d.mode = 'free'; game.band = [[d.x, d.y], [C + 0.5, C + 0.5]];
  game.changed();
  let sweeps = 0, frames = 0, counted = 0, swept = 0, faults = 0;
  const catchIn = game.catchIn; game.catchIn = function (...a) { sweeps++; return catchIn.apply(this, a); };
  for (; game.far < L - 20 && frames < 20000; frames++) {
    game.input.auto = [ux, uy, 1];
    const far = game.far, s0 = sweeps, w0 = game.swept;
    game.update(dt);
    if (tetherFaults(game).length) faults++;
    if (far > L - 150 && game.band.length === 2) { counted++; swept += game.swept - w0; } else sweeps = s0;
  }
  const each = sweeps / counted, ok = each <= 3 && !faults && counted > 5;
  if (!ok) bad++;
  console.log(`${Math.round(1 / dt)} fps, ram ${ram}: ${game.far.toFixed(0)} cells out at ${Math.hypot(d.vx, d.vy).toFixed(0)} cells a second, ${each.toFixed(1)} sweeps a frame looking at ${Math.round(swept / counted)} cells, over ${counted} frames; frames with tether faults ${faults}${ok ? '' : '   <-- DEFECT'}`);
}
process.exit(bad ? 1 : 0);
