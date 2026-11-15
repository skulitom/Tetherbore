// The pilot's one move, shared by the tools that play with no hand on the game (tools/slab-play.mjs,
// tools/hive-play.mjs): fly to a cell.
import { N, K } from '../test/harness.mjs';

// Steers to the middle of cell (x, y), slowing as it comes. `each` is called after every frame and stops the flight
// by returning true. Returns whether it got there.
export function fly(game, x, y, clock, each, frames = 300) {
  const d = game.drill, w = game.world, tx = x + 0.5, ty = y + 0.5;
  // Where there is open ground all round, near enough is there.
  let roomy = true;
  for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) if (w.k((y + v) * N + x + u) !== K.EMPTY) roomy = false;
  for (let f = 0; f < frames; f++) {
    const dx = tx - d.x, dy = ty - d.y, far = Math.hypot(dx, dy);
    if (far < (roomy ? 0.3 : 0.15) && d.mode === 'free') { game.input.auto = null; return true; }
    game.input.auto = [dx / (far || 1), dy / (far || 1), far > 1.2 ? 1 : Math.max(roomy ? 0.6 : 0.3, far / 1.2)];
    game.update(1 / 60); clock.t += 1 / 60;
    if (each && each()) { game.input.auto = null; return false; }
  }
  game.input.auto = null;
  return false;
}
