// Shared helpers for the terrain-change lens. Nothing here touches js/: it only drives the game through its own
// functions (update, key, blast, changed) and stages ground with world.setK, as test/rope-fuzz.mjs does.
import { makeGame, tetherFaults, random, C, N, K, B } from '../../harness.mjs';
export { makeGame, tetherFaults, random, C, N, K, B };

export const idx = (dx, dy) => (C + dy) * N + C + dx;
export const rel = p => [+(p[0] - C - 0.5).toFixed(2), +(p[1] - C - 0.5).toFixed(2)];
export const bandRel = game => game.band.map(p => [...rel(p), p[2] ?? 0]);

// Open a rectangle of cells (given relative to the core's middle cell).
export function open(game, x0, y0, x1, y1, kind = K.EMPTY) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) game.world.setK(idx(x, y), kind);
}
// Extra checks the stock tetherFaults does not make.
export function moreFaults(game) {
  const w = game.world, d = game.drill, P = game.band, out = [];
  if (d.mode === 'free' && w.k(Math.floor(d.y) * N + Math.floor(d.x)) !== K.EMPTY) out.push(`the drill's own cell is rock (kind ${w.k(Math.floor(d.y) * N + Math.floor(d.x))})`);
  for (let n = 1; n + 1 < P.length; n++) {
    const b = P[n];
    if (b[4] === undefined) { out.push(`interior point ${n} is not a bend`); continue; }
    if (!Number.isInteger(b[0]) || !Number.isInteger(b[1])) out.push(`bend ${n} is off the lattice`);
  }
  for (const p of P) if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) out.push('a band point is not finite');
  return out;
}
// Steer toward a point (relative to the core's middle) until within `near`, checking the tether every frame.
// `settle` also waits for the drill to come to rest there, so the next leg starts square on.
export function flyTo(game, x, y, { near = 0.25, max = 3000, check = true, log = [], settle = false } = {}) {
  const d = game.drill, tx = C + 0.5 + x, ty = C + 0.5 + y;
  for (let f = 0; f < max; f++) {
    const dx = tx - d.x, dy = ty - d.y, far = Math.hypot(dx, dy);
    if (far < near && d.mode === 'free' && (!settle || Math.hypot(d.vx, d.vy) < 0.3)) return f;
    game.input.auto = settle && far < near ? null : [dx / (far || 1), dy / (far || 1), Math.min(1, Math.max(settle ? 0.06 : 0.15, far / (settle ? 4 : 2)))];
    game.update(1 / 60);
    if (check) for (const fault of [...tetherFaults(game), ...moreFaults(game)]) log.push(fault);
  }
  return -1;
}
export function idle(game, frames, log = null) {
  game.input.auto = null;
  for (let f = 0; f < frames; f++) { game.update(1 / 60); if (log) for (const fault of [...tetherFaults(game), ...moreFaults(game)]) log.push(fault); }
}

// A span that runs along the seam between two cells of rock (rock on both sides of the line at once) is a string
// passing through rock, though the stock check lets it by as "on a cell's edge". Samples away from lattice points.
export function seamFaults(game) {
  const w = game.world, P = game.band, out = [];
  for (let n = 0; n + 1 < P.length; n++) {
    const a = P[n], b = P[n + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.3) continue;
    const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len, steps = Math.min(8000, Math.ceil(len / 0.05));
    for (let k = 1; k < steps; k++) {
      const x = a[0] + (b[0] - a[0]) * k / steps, y = a[1] + (b[1] - a[1]) * k / steps;
      if (Math.hypot(x - Math.round(x), y - Math.round(y)) < 0.1) continue;
      const lx = x - uy * 1e-3, ly = y + ux * 1e-3, rx = x + uy * 1e-3, ry = y - ux * 1e-3;
      if (w.k(Math.floor(ly) * N + Math.floor(lx)) !== K.EMPTY && w.k(Math.floor(ry) * N + Math.floor(rx)) !== K.EMPTY) {
        out.push(`span ${n} (${a[0] - C},${a[1] - C})-(${b[0] - C},${b[1] - C}) runs in a closed seam: rock on both sides at (${(x - C).toFixed(2)},${(y - C).toFixed(2)}), kinds ${w.k(Math.floor(ly) * N + Math.floor(lx))} and ${w.k(Math.floor(ry) * N + Math.floor(rx))}`);
        break;
      }
    }
  }
  return out;
}

// A bend must turn round rock: the point just inside the turn (between the two spans, a hair from the corner) has to
// be ground. Bends sharing one corner are judged as one, by the spans either side of the run. Reports bends that
// turn round open space (the string is hooked on a corner it does not go round) and runs of bends on one corner.
export function openBends(game) {
  const w = game.world, P = game.band, out = [];
  for (let n = 1; n + 1 < P.length; n++) {
    let m = n;
    while (m + 2 < P.length && P[m + 1][0] === P[n][0] && P[m + 1][1] === P[n][1]) m++;
    const a = P[n - 1], b = P[n], c = P[m + 1];
    const al = Math.hypot(a[0] - b[0], a[1] - b[1]), cl = Math.hypot(c[0] - b[0], c[1] - b[1]);
    if (al > 1e-9 && cl > 1e-9) {
      const ux = (a[0] - b[0]) / al + (c[0] - b[0]) / cl, uy = (a[1] - b[1]) / al + (c[1] - b[1]) / cl, len = Math.hypot(ux, uy);
      if (len > 1e-6) {
        const x = b[0] + ux / len * 0.01, y = b[1] + uy / len * 0.01;
        if (w.k(Math.floor(y) * N + Math.floor(x)) === K.EMPTY) out.push(`bend${m > n ? `s ${n}-${m} (one corner, turns ${P.slice(n, m + 1).map(p => p[2]).join(',')})` : ` ${n}`} at corner (${b[0] - C},${b[1] - C}) turn${m > n ? '' : 's'} round open space: between (${(a[0] - C).toFixed(2)},${(a[1] - C).toFixed(2)}) and (${(c[0] - C).toFixed(2)},${(c[1] - C).toFixed(2)})`);
      }
    }
    n = m;
  }
  return out;
}
