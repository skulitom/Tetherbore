// The world: a vast grid of cells round a fixed core, far too large to hold whole. It is made a 64 x 64 piece at
// a time, the first time anything looks there, from the seed alone; only pieces that have been changed or seen are
// kept. This module owns what each cell is and how the ground is laid out. It draws nothing.

export const N = 16384, C = 8192, CH = 64, CW = N / CH;      // a cell is y * N + x; the core's middle cell is (C, C)
export const K = { EMPTY: 0, CORE: 1, BEDROCK: 2, SOFT: 3, DENSE: 4, ORE_A: 5, ORE_B: 6, SLATE: 7, VAULT: 8, HAZARD: 9, RELIC: 10, ICE: 11, BASALT: 12, CACHE: 13, WRECK: 14 };
export const B = { CRUST: 0, FROST: 1, EMBER: 2, MIRE: 3, LODE: 4 };
// Far out, the ground to either side of each direction's middle turns into a richer, meaner kind of the same.
export const BIOME_NAMES = ['crust', 'frost', 'ember', 'mire', 'lode', 'rime', 'magma', 'bloom', 'gilt'];
export const base = b => b > 4 ? b - 4 : b;
// What can be cut (99: nothing cuts it), and what a hauled cell pays in grit and in its direction's gem.
export const HARD = [0, 99, 99, 1, 1, 1, 1, 1, 1, 1, 99, 1, 1, 1, 99];
export const GRIT = [0, 0, 0, 1, 2, 2, 4, 4, 10, 3, 0, 0, 1, 0, 0];
export const GEMS = [0, 0, 0, 0, 0, 1, 5, 0, 0, 2, 0, 0, 0, 0, 0];
export const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
// Plain home ground runs out to HOME_R before any direction's ground begins; the flanks turn strange past DEEP_R;
// what each direction hides lies RELIC_R out; the world ends at WORLD_R.
export const HOME_R = 130, DEEP_R = 900, RELIC_R = 2000, WORLD_R = 2400;
// Things to find. The ground is laid out in sectors FIND cells across, and a sector may hold a geode (a shell of slate
// round rich ore) or a cache (a crate buried in stone). Eight wrecks lie at set distances, each in a hollow of its
// own with what is left of its hull; each holds a part of an older machine.
export const FIND = 48, WRECK_R = [45, 90, 160, 300, 500, 800, 1200, 1700];
export const onCore = (x, y) => Math.abs(x - C) <= 1 && Math.abs(y - C) <= 1;

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
    this.chunks = new Array(CW * CW);      // each { kind, biome, seen }, made when first looked at
    this.touched = new Set();              // pieces changed since the last save
    this.lava = new Map();                 // seconds of lava left in an open cell
    this.dug = new Map();                  // when the drill opened a cell of the north (for the ice to close it)
    this.seed = 1;
    this.relicAt = [0, 1, 2, 3].map(d => (C + DY[d] * RELIC_R) * N + C + DX[d] * RELIC_R);
  }
  // Where the eight wrecks lie in this world: [x, y] each, in a direction of its own.
  get wrecks() {
    if (this.wrecksFor !== this.seed) {
      this.wrecksFor = this.seed;
      this.wreckSpots = WRECK_R.map((r, n) => {
        const ux = hash(n, 1, this.seed + 31) - 0.5, uy = hash(n, 2, this.seed + 31) - 0.5, len = Math.sqrt(ux * ux + uy * uy) || 1;
        return [C + Math.round(ux / len * r), C + Math.round(uy / len * r)];
      });
    }
    return this.wreckSpots;
  }
  // What a sector's find puts in a cell, or -1 where it puts nothing.
  findAt(x, y) {
    const seed = this.seed, sx = Math.floor((x - C) / FIND), sy = Math.floor((y - C) / FIND), what = hash(sx, sy, seed + 21);
    if (what >= 0.7) return -1;
    const fx = C + sx * FIND + 8 + Math.floor(hash(sx, sy, seed + 22) * (FIND - 16)), fy = C + sy * FIND + 8 + Math.floor(hash(sx, sy, seed + 23) * (FIND - 16));
    if (Math.hypot(fx - C, fy - C) < 16) return -1;
    const dx = x - fx, dy = y - fy;
    if (what < 0.38) {
      // A geode: slate outside, ore within, and in the bigger ones a hollow at the heart.
      const size = hash(sx, sy, seed + 24) < 0.4 ? 4 : 3, far = Math.sqrt(dx * dx + dy * dy);
      if (far > size - 0.2) return -1;
      return far > size - 1.3 ? K.SLATE : size === 4 && far < 0.5 ? K.EMPTY : K.ORE_B;
    }
    const edge = Math.max(Math.abs(dx), Math.abs(dy));
    return edge === 0 ? K.CACHE : edge === 1 ? K.DENSE : -1;
  }
  reset(seed) {
    this.seed = seed;
    this.chunks = new Array(CW * CW);
    this.touched.clear(); this.lava.clear(); this.dug.clear();
  }

  // Whose ground a cell is, from the seed alone.
  biomeAt(x, y) {
    const seed = this.seed, dx = x - C, dy = y - C, r = Math.sqrt(dx * dx + dy * dy);
    if (r < HOME_R + (noise(x / 30, y / 30, seed + 3) - 0.5) * 50) return B.CRUST;
    // The larger of the two distances, on a border that wanders in long sweeps and small wobbles.
    const far = Math.min(90, r * 0.2), near = Math.min(8, r * 0.1);
    const ax = Math.abs(dx) + (noise(x / 61, y / 61, seed + 1) - 0.5) * far + (noise(x / 9, y / 9, seed + 16) - 0.5) * near;
    const ay = Math.abs(dy) + (noise(x / 61, y / 61, seed + 2) - 0.5) * far + (noise(x / 9, y / 9, seed + 17) - 0.5) * near;
    const b = ax > ay ? (dx > 0 ? B.LODE : B.MIRE) : (dy < 0 ? B.FROST : B.EMBER);
    const deep = r > DEEP_R + (noise(x / 50, y / 50, seed + 14) - 0.5) * 200
      && Math.min(Math.abs(dx), Math.abs(dy)) > Math.max(Math.abs(dx), Math.abs(dy)) * 0.36 + (noise(x / 37, y / 37, seed + 15) - 0.5) * 60;
    return deep ? b + 4 : b;
  }
  // What a cell is before anything has touched it, from the seed alone.
  kindAt(x, y, b) {
    const seed = this.seed, dx = x - C, dy = y - C, r = Math.sqrt(dx * dx + dy * dy);
    if (r > WORLD_R + (noise(x / 5, y / 5, seed + 4) - 0.5) * 3) return K.BEDROCK;
    // The core is a platform: its nine cells and the gap round them are open. Beside it lies a first piece already
    // cut loose, to show what drawing the tether round something does.
    if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) return K.EMPTY;
    if (dx >= 3 && dx <= 6 && dy >= -2 && dy <= 1) return dx === 3 || dx === 6 || dy === -2 || dy === 1 ? K.EMPTY : (dx + dy) % 2 ? K.ORE_A : K.SOFT;
    // What each direction hides: a relic sealed in ancient stone.
    for (let d = 0; d < 4; d++) {
      const edge = Math.max(Math.abs(dx - DX[d] * RELIC_R), Math.abs(dy - DY[d] * RELIC_R));
      if (edge === 0) return K.RELIC;
      if (edge <= 3) return K.VAULT;
      if (edge <= 5) return K.SOFT;
    }
    for (const [wx, wy] of this.wrecks) {
      const edge = Math.max(Math.abs(x - wx), Math.abs(y - wy));
      if (edge === 0) return K.WRECK;
      if (edge === 1) return hash(x, y, seed + 32) < 0.55 ? K.SLATE : K.EMPTY;
      if (edge <= 3) return K.EMPTY;
    }
    const find = r > 12 ? this.findAt(x, y) : -1;
    if (find >= 0) return find;
    const h = hash(x, y, seed + 9), deep = b > 4, kin = base(b);
    let k = K.SOFT;
    if (b === B.CRUST) {
      // Home ground: soft, with stones to go round, nuggets worth lassoing, and further out seams of slate.
      if (r > 5 && noise(x / 4, y / 4, seed + 5) > 0.7) k = K.DENSE;
      if (r > 4.5 && noise(x / 3, y / 3, seed + 6) > 0.64 && h < 0.6) k = K.ORE_A;
      if (r > 55 && noise(x / 3.5, y / 3.5, seed + 7) > 0.78 && h < 0.5) k = K.ORE_B;
      if (r > 35 && Math.abs(noise(x / 9, y / 9, seed + 11) - 0.5) < 0.022) k = K.SLATE;
      if (r > 22 && noise(x / 5, y / 5, seed + 13) > 0.8) k = K.EMPTY;
      if (r > 60 && noise(x / 19, y / 19, seed + 18) > 0.76) k = K.EMPTY;      // great open caverns
      return k;
    }
    if (noise(x / 4, y / 4, seed + 5) > (kin === B.EMBER ? 0.64 : 0.68)) k = K.DENSE;
    if (noise(x / 3, y / 3, seed + 6) > (deep ? 0.6 : 0.66) && h < 0.62) k = K.ORE_A;
    if (noise(x / 3.5, y / 3.5, seed + 7) > (deep ? 0.66 : 0.74) && h < 0.5) k = K.ORE_B;
    const more = deep ? 1.8 : 1;
    if (kin === B.EMBER && noise(x / 2.5, y / 2.5, seed + 8) > (deep ? 0.72 : 0.78) && h > 0.45) k = K.HAZARD;
    if (kin === B.MIRE && hash(x, y, seed + 10) < 0.022 * more) k = K.HAZARD;
    if (kin === B.LODE && hash(x, y, seed + 10) < 0.026 * more) k = K.HAZARD;
    if (Math.abs(noise(x / 9, y / 9, seed + 11) - 0.5) < (kin === B.LODE ? 0.05 : 0.03)) k = K.SLATE;
    if (r > 600 && Math.abs(noise(x / 8, y / 8, seed + 12) - 0.5) < 0.028) k = K.VAULT;
    if (noise(x / 5, y / 5, seed + 13) > (kin === B.MIRE ? 0.68 : 0.8)) k = K.EMPTY;
    if (noise(x / 19, y / 19, seed + 18) > (kin === B.MIRE ? 0.7 : 0.78)) k = K.EMPTY;
    return k;
  }
  // The piece of world holding a cell, made now if nothing has looked there before.
  piece(id) {
    let p = this.chunks[id];
    if (p) return p;
    p = this.chunks[id] = { kind: new Uint8Array(CH * CH), biome: new Uint8Array(CH * CH), seen: new Uint8Array(CH * CH) };
    const x0 = (id % CW) * CH, y0 = ((id / CW) | 0) * CH;
    for (let v = 0; v < CH; v++) for (let u = 0; u < CH; u++) {
      const b = this.biomeAt(x0 + u, y0 + v);
      p.biome[v * CH + u] = b; p.kind[v * CH + u] = this.kindAt(x0 + u, y0 + v, b);
    }
    return p;
  }
  k(i) { return this.piece(((i >>> 20) << 8) | ((i >>> 6) & 255)).kind[(((i >>> 14) & 63) << 6) | (i & 63)]; }
  b(i) { return this.piece(((i >>> 20) << 8) | ((i >>> 6) & 255)).biome[(((i >>> 14) & 63) << 6) | (i & 63)]; }
  s(i) { return this.piece(((i >>> 20) << 8) | ((i >>> 6) & 255)).seen[(((i >>> 14) & 63) << 6) | (i & 63)]; }
  setK(i, v) { const id = ((i >>> 20) << 8) | ((i >>> 6) & 255); this.piece(id).kind[(((i >>> 14) & 63) << 6) | (i & 63)] = v; this.touched.add(id); }
  setB(i, v) { const id = ((i >>> 20) << 8) | ((i >>> 6) & 255); this.piece(id).biome[(((i >>> 14) & 63) << 6) | (i & 63)] = v; this.touched.add(id); }
  // Show the ground within `radius` cells of a cell. Returns whether anything new was seen.
  see(cx, cy, radius) {
    let fresh = false;
    for (let y = cy - radius; y <= cy + radius; y++) for (let x = cx - radius; x <= cx + radius; x++) {
      const id = ((y >> 6) << 8) | (x >> 6), p = this.piece(id), at = ((y & 63) << 6) | (x & 63);
      if (!p.seen[at]) { p.seen[at] = 1; this.touched.add(id); fresh = true; }
    }
    return fresh;
  }
  // What a cell is, without making its piece of the world: -1 where nothing has been seen yet.
  peek(x, y) { const p = this.chunks[((y >> 6) << 8) | (x >> 6)]; return p && p.seen[((y & 63) << 6) | (x & 63)] ? p.kind[((y & 63) << 6) | (x & 63)] : -1; }
  at(x, y) { return this.k(y * N + x); }
  solid(x, y) { return this.k(y * N + x) !== K.EMPTY; }
  lavaAt(i) { return this.lava.get(i) ?? 0; }

  // The ground that hangs on nothing once cell `i` is open (or would, were it cut): each neighbouring piece is
  // followed until it proves larger than `limit` cells or to reach the world's edge. A list of pieces, each a list
  // of cells.
  freed(i, limit = 700) {
    const seen = new Set([i]), held = new Set(), found = [];
    for (const start of [i + 1, i - 1, i + N, i - N]) {
      if (this.k(start) === K.EMPTY || seen.has(start)) continue;
      const cells = [start];
      let stuck = false;
      seen.add(start);
      for (let head = 0; head < cells.length && !stuck; head++) {
        const c = cells[head];
        for (const j of [c + 1, c - 1, c + N, c - N]) {
          if (seen.has(j)) { if (held.has(j)) { stuck = true; break; } continue; }
          const kind = this.k(j);
          if (kind === K.EMPTY) continue;
          if (kind === K.BEDROCK || cells.length >= limit) { stuck = true; break; }
          seen.add(j); cells.push(j);
        }
      }
      if (stuck) { for (const c of cells) held.add(c); continue; }
      found.push(cells);
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
    const L = (u, v) => this.lava.has(v * N + u) || this.k(v * N + u) !== K.EMPTY;
    const n = L(x, y - 1), e = L(x + 1, y), s = L(x, y + 1), w = L(x - 1, y);
    return (n ? 1 : 0) | (n && e && L(x + 1, y - 1) ? 2 : 0) | (e ? 4 : 0) | (e && s && L(x + 1, y + 1) ? 8 : 0)
      | (s ? 16 : 0) | (s && w && L(x - 1, y + 1) ? 32 : 0) | (w ? 64 : 0) | (w && n && L(x - 1, y - 1) ? 128 : 0);
  }
}

// Every cell a straight line passes through, in order, each sharing a side with the one before. Points are in
// cells, a cell's middle at +0.5.
export function cellsAlong(x0, y0, x1, y1, max = 6000) {
  let cx = Math.floor(x0), cy = Math.floor(y0);
  const ex = Math.floor(x1), ey = Math.floor(y1), dx = x1 - x0, dy = y1 - y0, sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const tdx = dx ? Math.abs(1 / dx) : Infinity, tdy = dy ? Math.abs(1 / dy) : Infinity, cells = [cy * N + cx];
  let tx = dx ? (dx > 0 ? cx + 1 - x0 : x0 - cx) * tdx : Infinity, ty = dy ? (dy > 0 ? cy + 1 - y0 : y0 - cy) * tdy : Infinity;
  for (let guard = 0; guard < max && (cx !== ex || cy !== ey); guard++) {
    if (tx < ty) { tx += tdx; cx += sx; } else { ty += tdy; cy += sy; }
    cells.push(cy * N + cx);
  }
  return cells;
}
// Is the straight line between two points clear of ground?
export function sight(world, x0, y0, x1, y1) {
  let cx = Math.floor(x0), cy = Math.floor(y0);
  const ex = Math.floor(x1), ey = Math.floor(y1), dx = x1 - x0, dy = y1 - y0, sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const tdx = dx ? Math.abs(1 / dx) : Infinity, tdy = dy ? Math.abs(1 / dy) : Infinity;
  let tx = dx ? (dx > 0 ? cx + 1 - x0 : x0 - cx) * tdx : Infinity, ty = dy ? (dy > 0 ? cy + 1 - y0 : y0 - cy) * tdy : Infinity;
  for (let guard = 0; guard < 12000; guard++) {
    if (world.k(cy * N + cx) !== K.EMPTY) return false;
    if (cx === ex && cy === ey) return true;
    if (tx < ty) { tx += tdx; cx += sx; } else { ty += tdy; cy += sy; }
  }
  return false;
}
