// Shared rig for the geometry lens: staged terrain and scripted flying. The independent check of the tether these
// scripts use (`Oracle`) lives in the harness.
import { makeGame, tetherFaults, Oracle, C, N, K } from '../../harness.mjs';
export { makeGame, tetherFaults, Oracle, C, N, K };

export const HX = C + 0.5, HY = C + 0.5;
export const idx = (x, y) => (C + y) * N + C + x;          // cell at an offset from the core's cell
export const rel = p => [+(p[0] - HX).toFixed(4), +(p[1] - HY).toFixed(4)];
export const showBand = game => JSON.stringify(game.band.map(p => [+(p[0] - C).toFixed(3), +(p[1] - C).toFixed(3), p[2] ?? 0]));

// Clear a box of cells (offsets from the core's cell, inclusive) and ring it with bedrock.
export function arena(game, x0, y0, x1, y1, wall = K.BEDROCK) {
  const w = game.world;
  for (let y = y0 - 2; y <= y1 + 2; y++) for (let x = x0 - 2; x <= x1 + 2; x++) {
    const inside = x >= x0 && x <= x1 && y >= y0 && y <= y1;
    w.setK(idx(x, y), inside ? K.EMPTY : wall);
  }
}
export function rocks(game, cells, kind = K.BEDROCK) { for (const [x, y] of cells) game.world.setK(idx(x, y), kind); }
// Put the drill down at an offset from the core's middle with a straight string home (the way must be open).
export function place(game, x, y) {
  const d = game.drill;
  d.x = HX + x; d.y = HY + y; d.px = d.x; d.py = d.y; d.vx = d.vy = 0; d.mode = 'free'; d.armed = false; d.home = game.atCore;
  game.band = [[d.x, d.y], [HX, HY]];
  game.changed();
}

// Bends the string does not turn round by a clear margin, and other local faults the harness check lets by.
export function bendFaults(game) {
  const P = game.band, out = [];
  for (let n = 1; n + 1 < P.length; n++) {
    const a = P[n - 1], b = P[n], c = P[n + 1];
    const turn = (b[0] - c[0]) * (a[1] - b[1]) - (b[1] - c[1]) * (a[0] - b[0]);
    if (b[2] !== 1 && b[2] !== -1) out.push(`bend ${n} has turn ${b[2]}`);
    if (turn === 0) out.push(`bend ${n} at ${rel(b)} has zero turn`);
    if (a[0] === b[0] && a[1] === b[1]) out.push(`bend ${n} at ${rel(b)} coincides with its neighbour`);
  }
  return out;
}
export const bandLength = game => { let s = 0; const P = game.band; for (let n = 1; n < P.length; n++) s += Math.hypot(P[n][0] - P[n - 1][0], P[n][1] - P[n - 1][1]); return s; };

// Fly toward a point (offset from the core's middle) by steering, a frame at a time; `each` runs after every frame.
export function flyTo(game, x, y, { m = 0.15, tol = 0.12, max = 4000, each } = {}) {
  const d = game.drill;
  for (let f = 0; f < max; f++) {
    const dx = HX + x - d.x, dy = HY + y - d.y, far = Math.hypot(dx, dy);
    if (far < tol) { game.input.auto = null; return f; }
    game.input.auto = [dx / far, dy / far, Math.min(m, Math.max(0.02, far * 0.6))];
    game.update(1 / 60);
    if (each && each() === false) return f;
  }
  game.input.auto = null;
  return -1;
}
// Let the drill coast to a stop.
export function settle(game, frames = 20, each) { game.input.auto = null; for (let f = 0; f < frames; f++) { game.update(1 / 60); if (each) each(); } }
