// Shared rig for the geometry lens: staged terrain, scripted flying, and an independent check of the tether.
// The independent check does not use the game's catching maths at all: every bounded piece of rock is a puncture
// with a ray going straight up from inside it, and a path's class is the reduced word of its signed crossings of
// those rays. The drill's own flown path and the band (core to drill) must give the same word.
import { makeGame, tetherFaults, C, N, K } from '../../harness.mjs';
export { makeGame, tetherFaults, C, N, K };

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

// ---- the independent homotopy check
export class Oracle {
  // box: offsets [x0, y0, x1, y1] within which bounded pieces of rock are punctures.
  constructor(game, box) {
    this.game = game; this.box = box;
    this.find();
    this.word = [];
    this.last = [HX, HY];
    this.trail = null;
    this.step();
  }
  // Record every sub-step of the drill's flight (the game moves it in several small slides a frame when it is
  // fast), by listening to the game's own `free` test. Nothing about the game changes.
  fine() {
    const game = this.game, free = game.free.bind(game), trail = this.trail = [];
    game.free = (x, y) => { const d = game.drill; if (d.mode === 'free') trail.push([d.x, d.y]); return free(x, y); };
    return this;
  }
  find() {
    const w = this.game.world, [x0, y0, x1, y1] = this.box, seen = new Set();
    this.punctures = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = idx(x, y);
      if (seen.has(i) || w.k(i) === K.EMPTY) continue;
      const cells = [i]; seen.add(i);
      let bounded = true;
      for (let h = 0; h < cells.length; h++) for (const j of [cells[h] + 1, cells[h] - 1, cells[h] + N, cells[h] - N]) {
        if (seen.has(j) || w.k(j) === K.EMPTY) continue;
        const jx = j % N - C, jy = Math.floor(j / N) - C;
        if (jx < x0 || jx > x1 || jy < y0 || jy > y1) { bounded = false; continue; }
        seen.add(j); cells.push(j);
      }
      if (!bounded) continue;
      const id = this.punctures.length;
      this.punctures.push({ id, cell: i, cells, px: i % N + 0.2 + 0.6 * ((id * 0.6180339887498949) % 1), py: Math.floor(i / N) + 0.5 });
    }
  }
  crossings(a, b) {
    const out = [];
    for (const p of this.punctures) {
      if (p.gone) continue;
      if ((a[0] < p.px) === (b[0] < p.px)) continue;
      const t = (p.px - a[0]) / (b[0] - a[0]), y = a[1] + t * (b[1] - a[1]);
      if (y < p.py) out.push([t, p.id, b[0] > a[0] ? 1 : -1]);
    }
    return out.sort((u, v) => u[0] - v[0]).map(([, id, s]) => [id, s]);
  }
  static push(word, letters) {
    for (const [id, s] of letters) {
      const top = word[word.length - 1];
      if (top && top[0] === id && top[1] === -s) word.pop(); else word.push([id, s]);
    }
  }
  // Call after every game.update: adds the drill's move to the flown word.
  step() {
    const d = this.game.drill, w = this.game.world, now = [d.x, d.y];
    if (this.trail) { for (const p of this.trail) { if (p[0] !== this.last[0] || p[1] !== this.last[1]) { Oracle.push(this.word, this.crossings(this.last, p)); this.last = p; } } this.trail.length = 0; }
    Oracle.push(this.word, this.crossings(this.last, now));
    this.last = now;
    // A puncture whose rock is gone no longer counts, in either word.
    let lost = false;
    for (const p of this.punctures) if (!p.gone && p.cells.every(c => w.k(c) === K.EMPTY)) { p.gone = true; lost = true; }
    if (lost) { const kept = this.word.filter(([id]) => !this.punctures[id].gone); this.word = []; Oracle.push(this.word, kept); }
  }
  bandWord() {
    const P = this.game.band, word = [];
    for (let n = P.length - 1; n > 0; n--) Oracle.push(word, this.crossings(P[n], P[n - 1]));
    return word;
  }
  // '' when the band is in the class the drill flew, else what differs.
  mismatch() {
    const a = this.word.map(l => l.join(':')).join(' '), b = this.bandWord().map(l => l.join(':')).join(' ');
    return a === b ? '' : `flown [${a}] band [${b}]`;
  }
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

// The fix proposed for twin bends, tried out without touching the game's source: after the game's own retighten,
// two neighbouring bends on the same corner are made one. The one bend is kept if the string, as it now runs,
// turns round that corner's cell; otherwise it is handed back to retighten to be let go with its usual sweep.
export function patchTwins(game) {
  const own = game.retighten.bind(game);
  game.retighten = () => {
    for (let pass = 0; pass < 200; pass++) {
      own();
      const P = game.band;
      // a bend the string runs out to and straight back from (its two neighbours in line with it, on the same side)
      let fold = -1;
      for (let k = 1; k + 1 < P.length && fold < 0; k++) {
        const a = P[k - 1], b = P[k], c = P[k + 1], ux = a[0] - b[0], uy = a[1] - b[1], vx = c[0] - b[0], vy = c[1] - b[1];
        if (ux * vy - uy * vx === 0 && ux * vx + uy * vy > 0) fold = k;
      }
      if (fold >= 0) { P.splice(fold, 1); continue; }
      let n = 1;
      while (n + 2 < P.length && !(P[n][4] !== undefined && P[n][4] === P[n + 1][4])) n++;
      if (n + 2 >= P.length) return;
      const a = P[n - 1], b = P[n], c = P[n + 2];
      const ux = a[0] - b[0], uy = a[1] - b[1], vx = c[0] - b[0], vy = c[1] - b[1];
      const mx = (b[3] % N) + 0.5 - b[0], my = Math.floor(b[3] / N) + 0.5 - b[1];
      const turn = (b[0] - c[0]) * (a[1] - b[1]) - (b[1] - c[1]) * (a[0] - b[0]), wedge = ux * vy - uy * vx;
      const inside = wedge !== 0 && (ux * my - uy * mx) * wedge > 0 && (mx * vy - my * vx) * wedge > 0;
      P.splice(n, 1);
      if (turn === 0 && ux * vx + uy * vy > 0) P.splice(n, 1);           // out and straight back: nothing to turn round
      else P[n][2] = inside ? Math.sign(turn) : -Math.sign(turn) || 1;    // a wrong turn is what retighten lets go
    }
  };
}
