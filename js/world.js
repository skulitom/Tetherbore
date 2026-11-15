// The world: a square grid of cells round a fixed core. This module owns what each cell is, how the ground is laid
// out, what the tether can reach, and which pieces of ground have been cut free. It draws nothing.

export const N = 129, C = 64, SIZE = N * N;
export const K = { EMPTY: 0, CORE: 1, BEDROCK: 2, SOFT: 3, DENSE: 4, ORE_A: 5, ORE_B: 6, SLATE: 7, VAULT: 8, HAZARD: 9, RELIC: 10, ICE: 11, BASALT: 12 };
export const B = { CRUST: 0, FROST: 1, EMBER: 2, MIRE: 3, LODE: 4 };
// Far out, the ground to either side of each direction's middle turns into a richer, meaner kind of the same.
export const BIOME_NAMES = ['crust', 'frost', 'ember', 'mire', 'lode', 'rime', 'magma', 'bloom', 'gilt'];
export const base = b => b > 4 ? b - 4 : b;
export const DEEP_R = 23;
// What bit a cell needs (99: no bit cuts it), and what a hauled cell pays in grit and in its biome's gem.
export const HARD = [0, 99, 99, 1, 2, 1, 2, 3, 4, 1, 99, 1, 2];
export const GRIT = [0, 0, 0, 1, 2, 2, 4, 4, 10, 3, 0, 0, 1];
export const GEMS = [0, 0, 0, 0, 0, 1, 5, 0, 0, 2, 0, 0, 0];
export const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
export const RELIC_R = 36, WORLD_R = 61;

const hash = (x, y, s) => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export const cellHash = hash;
const noise = (x, y, s) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

export class World {
  constructor() {
    this.kind = new Uint8Array(SIZE);
    this.biome = new Uint8Array(SIZE);
    this.seen = new Uint8Array(SIZE);
    this.dist = new Int16Array(SIZE);      // steps of tether from the core, -1 where it cannot go
    this.parent = new Int32Array(SIZE);
    this.reached = new Uint8Array(SIZE);   // cells already revealed round
    this.onPath = new Uint8Array(SIZE);    // cells the tether lies in
    this.lava = new Float32Array(SIZE);    // seconds of lava left in an empty cell
    this.dugAt = new Float32Array(SIZE);   // when the drill emptied a frost cell (0: never)
    this.mark = new Uint8Array(SIZE);
    this.queue = new Int32Array(SIZE);
    this.seed = 1;
  }

  generate(seed) {
    this.seed = seed;
    const { kind, biome } = this;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, dx = x - C, dy = y - C, r = Math.sqrt(dx * dx + dy * dy);
      // Which direction's ground this is: the larger of the two distances, on a wandering border.
      const sway = Math.min(12, r * 0.45);
      const wx = (noise(x / 9, y / 9, seed + 1) - 0.5) * sway, wy = (noise(x / 9, y / 9, seed + 2) - 0.5) * sway;
      const ax = Math.abs(dx) + wx, ay = Math.abs(dy) + wy;
      let b = ax > ay ? (dx > 0 ? B.LODE : B.MIRE) : (dy < 0 ? B.FROST : B.EMBER);
      if (r < 5.6 + (noise(x / 3, y / 3, seed + 3) - 0.5) * 2.4) b = B.CRUST;
      const deep = b !== B.CRUST && r > DEEP_R + (noise(x / 6, y / 6, seed + 14) - 0.5) * 6
        && Math.min(Math.abs(dx), Math.abs(dy)) > Math.max(Math.abs(dx), Math.abs(dy)) * 0.36 + (noise(x / 7, y / 7, seed + 15) - 0.5) * 5;
      biome[i] = deep ? b + 4 : b;
      if (r > WORLD_R + (noise(x / 5, y / 5, seed + 4) - 0.5) * 3) { kind[i] = K.BEDROCK; continue; }
      let k = K.SOFT;
      if (b !== B.CRUST) {
        const h = hash(x, y, seed + 9);
        if (r > 7 && noise(x / 4, y / 4, seed + 5) > (b === B.EMBER ? 0.57 : 0.63)) k = K.DENSE;
        if (r > 6.5 && noise(x / 3, y / 3, seed + 6) > (deep ? 0.6 : 0.66) && h < 0.62) k = K.ORE_A;
        if (r > 15 && noise(x / 3.5, y / 3.5, seed + 7) > (deep ? 0.66 : 0.74) && h < 0.5) k = K.ORE_B;
        if (r > 10) {
          const more = deep ? 1.8 : 1;
          if (b === B.EMBER && noise(x / 2.5, y / 2.5, seed + 8) > (deep ? 0.72 : 0.78) && h > 0.45) k = K.HAZARD;
          if (b === B.MIRE && hash(x, y, seed + 10) < 0.022 * more) k = K.HAZARD;
          if (b === B.LODE && hash(x, y, seed + 10) < 0.026 * more) k = K.HAZARD;
        }
        const vein = Math.abs(noise(x / 9, y / 9, seed + 11) - 0.5);
        if (r > 11 && vein < (b === B.LODE ? 0.05 : 0.03)) k = K.SLATE;
        if (r > 27 && Math.abs(noise(x / 8, y / 8, seed + 12) - 0.5) < 0.028) k = K.VAULT;
        if (r > 8.5 && noise(x / 5, y / 5, seed + 13) > (b === B.MIRE ? 0.68 : 0.8)) k = K.EMPTY;
      }
      kind[i] = k;
    }
    // What each direction hides: a relic sealed in ancient stone.
    this.relicAt = [];
    for (let d = 0; d < 4; d++) {
      const cx = C + DX[d] * RELIC_R, cy = C + DY[d] * RELIC_R;
      for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
        const i = (cy + y) * N + cx + x, edge = Math.max(Math.abs(x), Math.abs(y));
        kind[i] = edge === 0 ? K.RELIC : edge <= 2 ? K.VAULT : (kind[i] === K.EMPTY || kind[i] === K.HAZARD ? K.SOFT : kind[i]);
      }
      this.relicAt.push(cy * N + cx);
    }
    // The core, the gap round it, and a first piece all but cut free, to show what a cut does.
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) kind[(C + y) * N + C + x] = Math.max(Math.abs(x), Math.abs(y)) <= 1 ? K.CORE : K.EMPTY;
    for (let x = 3; x <= 5; x++) kind[(C - 2) * N + C + x] = K.EMPTY;
    for (let y = -2; y <= 1; y++) kind[(C + y) * N + C + 5] = K.EMPTY;
    kind[(C - 1) * N + C + 3] = K.ORE_A; kind[(C - 1) * N + C + 4] = K.SOFT;
    kind[C * N + C + 3] = K.SOFT; kind[C * N + C + 4] = K.ORE_A;
    this.lava.fill(0); this.dugAt.fill(0); this.seen.fill(0); this.reached.fill(0);
  }

  solid(x, y) { return x < 0 || y < 0 || x >= N || y >= N || this.kind[y * N + x] !== K.EMPTY; }
  at(x, y) { return x < 0 || y < 0 || x >= N || y >= N ? K.BEDROCK : this.kind[y * N + x]; }

  // Where the tether can go and how much of it each cell takes. `radius` is how far round an open cell the
  // scanner shows the ground. Returns how many cells were seen for the first time.
  reach(radius) {
    const { kind, dist, parent, queue, reached, seen } = this;
    dist.fill(-1);
    let head = 0, tail = 0, fresh = 0;
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
      if (Math.max(Math.abs(x), Math.abs(y)) !== 2 || (Math.abs(x) === 2 && Math.abs(y) === 2)) continue;
      const i = (C + y) * N + C + x;
      if (kind[i] === K.EMPTY) { dist[i] = 0; parent[i] = -1; queue[tail++] = i; }
    }
    while (head < tail) {
      const i = queue[head++], x = i % N, d = dist[i] + 1;
      if (!reached[i]) {
        reached[i] = 1;
        const y = (i - x) / N;
        for (let v = -radius; v <= radius; v++) for (let u = -radius; u <= radius; u++) {
          const px = x + u, py = y + v;
          if (px >= 0 && py >= 0 && px < N && py < N && !seen[py * N + px]) { seen[py * N + px] = 1; fresh++; }
        }
      }
      if (x + 1 < N && kind[i + 1] === K.EMPTY && dist[i + 1] < 0) { dist[i + 1] = d; parent[i + 1] = i; queue[tail++] = i + 1; }
      if (i + N < SIZE && kind[i + N] === K.EMPTY && dist[i + N] < 0) { dist[i + N] = d; parent[i + N] = i; queue[tail++] = i + N; }
      if (x > 0 && kind[i - 1] === K.EMPTY && dist[i - 1] < 0) { dist[i - 1] = d; parent[i - 1] = i; queue[tail++] = i - 1; }
      if (i >= N && kind[i - N] === K.EMPTY && dist[i - N] < 0) { dist[i - N] = d; parent[i - N] = i; queue[tail++] = i - N; }
    }
    return fresh;
  }

  // The cells from `i` back to the core, and the cells the tether lies in.
  path(i) {
    const cells = [];
    this.onPath.fill(0);
    while (i >= 0 && this.dist[i] >= 0) { cells.push(i); this.onPath[i] = 1; i = this.parent[i]; }
    return cells;
  }

  // Ground that no longer hangs on the world: every connected piece that touches neither the bedrock nor the core
  // and has open, reached ground beside it. Each is a list of cells.
  islands() {
    const { kind, mark, queue, dist } = this;
    mark.fill(0);
    let tail = 0;
    for (let i = 0; i < SIZE; i++) if (kind[i] === K.BEDROCK || kind[i] === K.CORE) { mark[i] = 1; queue[tail++] = i; }
    for (let head = 0; head < tail; head++) {
      const i = queue[head], x = i % N;
      if (x + 1 < N && kind[i + 1] && !mark[i + 1]) { mark[i + 1] = 1; queue[tail++] = i + 1; }
      if (i + N < SIZE && kind[i + N] && !mark[i + N]) { mark[i + N] = 1; queue[tail++] = i + N; }
      if (x > 0 && kind[i - 1] && !mark[i - 1]) { mark[i - 1] = 1; queue[tail++] = i - 1; }
      if (i >= N && kind[i - N] && !mark[i - N]) { mark[i - N] = 1; queue[tail++] = i - N; }
    }
    const found = [];
    for (let s = 0; s < SIZE; s++) {
      if (!kind[s] || mark[s]) continue;
      const cells = [s];
      let open = false;
      mark[s] = 1;
      for (let head = 0; head < cells.length; head++) {
        const i = cells[head], x = i % N;
        const near = [x + 1 < N ? i + 1 : -1, i + N < SIZE ? i + N : -1, x > 0 ? i - 1 : -1, i >= N ? i - N : -1];
        for (const j of near) {
          if (j < 0) continue;
          if (kind[j]) { if (!mark[j]) { mark[j] = 1; cells.push(j); } } else if (dist[j] >= 0) open = true;
        }
      }
      if (open) found.push(cells);
    }
    return found;
  }

  // The blob mask of a cell among its solid neighbours (N=1, NE=2, E=4, SE=8, S=16, SW=32, W=64, NW=128), a corner
  // counting only between two solid sides, as Pixelbolt's blob tiles are named.
  mask(x, y) {
    const n = this.solid(x, y - 1), e = this.solid(x + 1, y), s = this.solid(x, y + 1), w = this.solid(x - 1, y);
    return (n ? 1 : 0) | (n && e && this.solid(x + 1, y - 1) ? 2 : 0) | (e ? 4 : 0) | (e && s && this.solid(x + 1, y + 1) ? 8 : 0)
      | (s ? 16 : 0) | (s && w && this.solid(x - 1, y + 1) ? 32 : 0) | (w ? 64 : 0) | (w && n && this.solid(x - 1, y - 1) ? 128 : 0);
  }
  lavaMask(x, y) {
    const L = (u, v) => u >= 0 && v >= 0 && u < N && v < N && (this.lava[v * N + u] > 0 || this.kind[v * N + u] !== K.EMPTY);
    const n = L(x, y - 1), e = L(x + 1, y), s = L(x, y + 1), w = L(x - 1, y);
    return (n ? 1 : 0) | (n && e && L(x + 1, y - 1) ? 2 : 0) | (e ? 4 : 0) | (e && s && L(x + 1, y + 1) ? 8 : 0)
      | (s ? 16 : 0) | (s && w && L(x - 1, y + 1) ? 32 : 0) | (w ? 64 : 0) | (w && n && L(x - 1, y - 1) ? 128 : 0);
  }
}

// Is the straight line between two cell centres clear of solid ground? Used to pull the drawn tether taut.
export function clear(world, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 4);
  for (let s = 1; s < steps; s++) {
    const t = s / steps, x = x0 + dx * t, y = y0 + dy * t;
    // The line has the width of the string: test a little to each side of it.
    for (const [ox, oy] of [[0.18, 0.18], [-0.18, 0.18], [0.18, -0.18], [-0.18, -0.18]]) {
      if (world.kind[Math.floor(y + 0.5 + oy) * N + Math.floor(x + 0.5 + ox)] !== K.EMPTY) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------- the taut string
// Is the straight line between two points (in cells, a cell's middle at +0.5) clear of ground? The core lets it in.
export function sight(world, x0, y0, x1, y1) {
  const kind = world.kind;
  let cx = Math.floor(x0), cy = Math.floor(y0);
  const ex = Math.floor(x1), ey = Math.floor(y1), dx = x1 - x0, dy = y1 - y0, sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const tdx = dx ? Math.abs(1 / dx) : Infinity, tdy = dy ? Math.abs(1 / dy) : Infinity;
  let tx = dx ? (dx > 0 ? cx + 1 - x0 : x0 - cx) * tdx : Infinity, ty = dy ? (dy > 0 ? cy + 1 - y0 : y0 - cy) * tdy : Infinity;
  for (let guard = 0; guard < 600; guard++) {
    const k = kind[cy * N + cx];
    if (k !== K.EMPTY && k !== K.CORE) return false;
    if (cx === ex && cy === ey) return true;
    if (tx < ty) { tx += tdx; cx += sx; } else { ty += tdy; cy += sy; }
  }
  return false;
}

// The shortest line from a cell's middle to the core through open ground: straight, except where it wraps the
// corner of something solid. Its points, in cells. Every corner that sticks out into reached ground is a place the
// string may bend; the search is A* over those corners, joined wherever one sees another.
export function taut(world, sx, sy, limit) {
  const { kind, dist } = world, gx = C + 0.5, gy = C + 0.5, o = 0.15;
  sx += 0.5; sy += 0.5;
  if (sight(world, sx, sy, gx, gy)) return [[sx, sy], [gx, gy]];
  const reach = limit + 2, far = Math.hypot(sx - gx, sy - gy);
  const x0 = Math.max(1, Math.floor(Math.min(sx, gx) - reach)), x1 = Math.min(N - 1, Math.ceil(Math.max(sx, gx) + reach));
  const y0 = Math.max(1, Math.floor(Math.min(sy, gy) - reach)), y1 = Math.min(N - 1, Math.ceil(Math.max(sy, gy) + reach));
  const xs = [sx, gx], ys = [sy, gy];
  const open = i => kind[i] === K.EMPTY && dist[i] >= 0;
  for (let vy = y0; vy <= y1; vy++) for (let vx = x0; vx <= x1; vx++) {
    // A string no longer than the tether cannot bend further out than this.
    if (Math.hypot(vx - sx, vy - sy) + Math.hypot(vx - gx, vy - gy) > limit + far * 0.5 + 3) continue;
    const a = (vy - 1) * N + vx - 1, b = a + 1, c = a + N, d = c + 1;
    const sa = kind[a] !== K.EMPTY, sb = kind[b] !== K.EMPTY, sc = kind[c] !== K.EMPTY, sd = kind[d] !== K.EMPTY;
    if (sa + sb + sc + sd !== 1) continue;
    if (sa && open(d)) { xs.push(vx + o); ys.push(vy + o); }
    else if (sb && open(c)) { xs.push(vx - o); ys.push(vy + o); }
    else if (sc && open(b)) { xs.push(vx + o); ys.push(vy - o); }
    else if (sd && open(a)) { xs.push(vx - o); ys.push(vy - o); }
  }
  const n = xs.length, cost = new Float32Array(n).fill(Infinity), from = new Int32Array(n).fill(-1), state = new Uint8Array(n);
  cost[0] = 0;
  for (;;) {
    let i = -1, best = Infinity;
    for (let j = 0; j < n; j++) if (state[j] === 1 || j === 0 && !state[0]) { const f = cost[j] + Math.hypot(xs[j] - gx, ys[j] - gy); if (f < best) { best = f; i = j; } }
    if (i < 0) return null;
    if (i === 1) break;
    state[i] = 2;
    for (let j = 1; j < n; j++) {
      if (state[j] === 2) continue;
      const c2 = cost[i] + Math.hypot(xs[j] - xs[i], ys[j] - ys[i]);
      if (c2 >= cost[j] || !sight(world, xs[i], ys[i], xs[j], ys[j])) continue;
      cost[j] = c2; from[j] = i; state[j] = 1;
    }
  }
  const pts = [];
  for (let i = 1; i >= 0; i = from[i]) pts.push([xs[i], ys[i]]);
  return pts.reverse();
}
