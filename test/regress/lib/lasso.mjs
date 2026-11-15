// Shared staging and driving helpers for the lasso/haul hunt. Coordinates are cells relative to the core.
import { makeGame, random, tetherFaults, C, N, K, B, world } from '../../harness.mjs';
export { makeGame, random, tetherFaults, C, N, K, B, world };

export const at = (x, y) => (C + y) * N + C + x;
export const rel = i => [(i % N) - C, Math.floor(i / N) - C];
// Fill a rectangle (inclusive) with a kind, and optionally a biome.
export function rect(game, x0, y0, x1, y1, kind, biome) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { game.world.setK(at(x, y), kind); if (biome !== undefined) game.world.setB(at(x, y), biome); }
}
// A solid block of soft ground round the core with the core's own 5 x 5 left open, and everything seen.
export function arena(game, r = 30, kind = K.SOFT, biome = B.CRUST) {
  rect(game, -r, -r, r, r, kind, biome);
  rect(game, -2, -2, 2, 2, K.EMPTY);
  game.world.see(C, C, r + 2);
}
// Make the game's own randomness repeatable (it only dresses effects and rubble).
export function fixRandom(seed = 1) { Math.random = random(seed); }
// Steer toward the middle of a cell until the drill is there. Returns the frames used, or -1 if it never arrived.
export function flyTo(game, x, y, opts = {}) {
  const { frames = 3000, tol = 0.2, each } = opts, d = game.drill, tx = C + x + 0.5, ty = C + y + 0.5;
  for (let f = 0; f < frames; f++) {
    const dx = tx - d.x, dy = ty - d.y, far = Math.hypot(dx, dy);
    if (far < tol && d.mode === 'free') { game.input.auto = null; return f; }
    game.input.auto = [dx / (far || 1), dy / (far || 1), far > 1.5 ? 1 : Math.max(0.55, far / 1.5)];
    game.update(1 / 60);
    if (each) each(f);
  }
  game.input.auto = null;
  return -1;
}
export function idle(game, seconds, each) {
  game.input.auto = null;
  for (let f = 0; f < seconds * 60; f++) { game.update(1 / 60); if (each) each(f); }
}
export const where = game => [+(game.drill.x - C - 0.5).toFixed(2), +(game.drill.y - C - 0.5).toFixed(2)];
export const bandRel = game => game.band.map(p => [+(p[0] - C - 0.5).toFixed(2), +(p[1] - C - 0.5).toFixed(2)]);
// Is a set of cells cut off from all other ground (no 4-neighbour outside the set is solid)?
export function isLoose(game, cells) {
  const set = new Set(cells);
  for (const c of cells) for (const j of [c + 1, c - 1, c + N, c - N]) if (!set.has(j) && game.world.k(j) !== K.EMPTY) return false;
  return true;
}
