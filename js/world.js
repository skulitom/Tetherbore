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
// The cell next to a cell on each side, as steps of its number: east, south, west, north (as DX, DY). And how far
// `freed` walks outlines: OUTLINE sides round the last flood left going, to see whether it is an island, and JOIN
// sides from each flood before any flooding, to see which of them are one piece of ground.
const STEP = [1, N, -1, -N], OUTLINE = 600, JOIN = 4000;
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

  // An outline is walked a side at a time, the ground always on the same hand. A side is a cell of ground and which
  // of its sides faces open ground (0 east, 1 south, 2 west, 3 north), held as one number: the cell's, times four,
  // plus the side. This is the side after `at`. Ground counts as joined along sides only, never across a corner.
  // `gone` is a set of cells to take as open.
  along(at, gone = null) {
    const c = at >> 2, f = at & 3, r = (f + 1) & 3, a = c + STEP[r], b = a + STEP[f];
    if ((gone !== null && gone.has(a)) || this.k(a) === K.EMPTY) return c * 4 + r;                    // round this cell's own corner
    if ((gone !== null && gone.has(b)) || this.k(b) === K.EMPTY) return a * 4 + f;                    // straight on, along the next cell
    return b * 4 + ((f + 3) & 3);                                                                     // into an inside corner
  }
  // Whether the ground a cell belongs to is an island: ground that hangs on nothing. `s` is a cell of ground and
  // `d` the side of it that faces open ground. Its outline is walked from there (`along`). An outline that comes
  // back to where it began having turned outward four times more than inward is the outside of a piece, so the
  // piece is an island, whatever its area: the work is in proportion to the outline, not to the ground inside it.
  // One that runs to `most` sides without closing, touches the world's bedrock, or closes the other way round (the
  // wall of a hollow, with the ground on its outside) is not known to be one.
  // `walked`, kept between calls, holds the sides of outlines that were not an island's, so none is walked twice.
  island(s, d, most, gone = null, walked = null) {
    if ((gone !== null && gone.has(s)) || this.k(s) === K.EMPTY) return false;
    if (!(gone !== null && gone.has(s + STEP[d])) && this.k(s + STEP[d]) !== K.EMPTY) return false;
    const first = s * 4 + d;
    for (let n = 0, at = first, turns = 0; n < most; n++) {
      if (walked !== null) { if (walked.has(at)) return false; walked.add(at); }
      const next = this.along(at, gone);
      // The side turns outward (+1), goes straight on (0) or turns inward (-1).
      turns += (((next & 3) - (at & 3) + 1) & 3) - 1;
      at = next;
      if (this.k(at >> 2) === K.BEDROCK) return false;
      if (at === first) return turns === 4;
    }
    return false;
  }
  // The ground that hangs on nothing once `cells` are open (or would, were they cut): one cell or a list of cells
  // opened together, which need not be open in the world yet. `open` is a set of further cells to take as open.
  // A list of pieces, each a list of cells.
  //
  // Every piece of ground beside an opened cell is flooded at once, a cell each in turn. Floods that meet are one
  // piece. One that runs out is cut off: an island, and it is returned. One that touches bedrock, or grows past
  // `limit` cells of its own, is held. The last one still going, with nothing beside it known to be held, is the
  // rest of the world and need not be finished, so the work is in proportion to what is cut off, however large,
  // and next to nothing when nothing is. But it may be an island too (the only ground beside the cut, or the other
  // half of a piece cut in two), so its outline is walked a little way first (`island`); if that closes it is
  // followed to its end like any other.
  //
  // Before any flooding the floods' outlines are walked, a side each in turn, from the sides that face the opened
  // cells. An outline that comes to another flood's side is the same ground, so the two are one from the start. That
  // is known for the length of the wall between them, not the ground behind it: a cut that breaks through into a
  // cave has the same ground on both sides of it, joined only round the cave, and two floods would each have to
  // fill a great deal of the world before they met.
  freed(cells, limit = 700, open = null) {
    const opened = typeof cells === 'number' ? [cells] : cells, gone = new Set(opened);
    if (open) for (const j of open) gone.add(j);
    // Of each flood: the cells found, how many have been followed, the side its first cell turns to an opened cell.
    // Of each piece (a flood, or several that met): whether it is held, its cells, and how many are yet to follow.
    const owner = new Map(), parent = [], queues = [], heads = [], face = [], held = [], size = [], left = [];
    const find = g => { while (parent[g] !== g) g = parent[g] = parent[parent[g]]; return g; };
    for (const i of opened) for (let s = 0; s < 4; s++) {
      const start = i + STEP[s];
      if (gone.has(start) || owner.has(start)) continue;
      const kind = this.k(start);
      if (kind === K.EMPTY) continue;
      owner.set(start, parent.length); parent.push(parent.length); queues.push([start]); heads.push(0); face.push((s + 2) & 3);
      held.push(kind === K.BEDROCK); size.push(1); left.push(1);
    }
    if (parent.length > 1) {
      const sides = new Map(), at = queues.map((cells, q) => cells[0] * 4 + face[q]);
      for (let q = 0; q < at.length; q++) sides.set(at[q], q);
      for (let n = 0, apart = at.length; n < JOIN && apart > 1; n++) for (let q = 0; q < at.length && apart > 1; q++) {
        if (at[q] < 0) continue;
        at[q] = this.along(at[q], gone);
        const o = sides.get(at[q]);
        if (o === q) at[q] = -1;                                      // all the way round: nothing more to meet
        else if (o !== undefined && find(o) !== find(q)) { const a = find(o), b = find(q); parent[a] = b; held[b] = held[b] || held[a]; size[b] += size[a]; left[b] += left[a]; apart--; }
      }
    }
    for (let sure = -1; ;) {
      let going = 0, last = -1, anyHeld = false;
      for (let q = 0; q < parent.length; q++) {
        if (parent[q] !== q) continue;
        if (held[q]) anyHeld = true; else if (left[q] > 0) { going++; last = q; }
      }
      if (!going) break;
      if (going === 1 && !anyHeld && sure !== last) {
        if (!this.island(queues[last][0], face[last], OUTLINE, gone)) { held[last] = true; break; }
        sure = last;
      }
      for (let q = 0; q < queues.length; q++) {
        if (heads[q] >= queues[q].length) continue;
        let root = find(q);
        if (held[root]) continue;
        const c = queues[q][heads[q]++];
        left[root]--;
        for (let s = 0; s < 4; s++) {
          const j = c + STEP[s], o = owner.get(j);
          if (o !== undefined) {
            const other = find(o);
            if (other !== root) { parent[other] = root; held[root] = held[root] || held[other]; size[root] += size[other]; left[root] += left[other]; }
            continue;
          }
          if (gone.has(j)) continue;
          const kind = this.k(j);
          if (kind === K.EMPTY) continue;
          if (kind === K.BEDROCK) { held[root] = true; continue; }
          owner.set(j, q); queues[q].push(j); size[root]++; left[root]++;
        }
        if (size[root] > limit) held[root] = true;
      }
    }
    // What ran out is cut off. What was held, or still going when the rest was settled, is not.
    const pieces = new Map();
    for (let q = 0; q < queues.length; q++) {
      const root = find(q);
      if (held[root] || left[root] > 0) continue;
      if (!pieces.has(root)) pieces.set(root, []);
      const into = pieces.get(root);
      for (const c of queues[q]) into.push(c);
    }
    return [...pieces.values()];
  }
  // The whole piece of ground a cell belongs to, if it lies inside the box and is no more than `limit` cells; null if
  // it runs out of the box, touches bedrock or is larger.
  pieceIn(i, x0, y0, x1, y1, limit) {
    if (this.k(i) === K.EMPTY) return null;
    const seen = new Set([i]), cells = [i];
    for (let head = 0; head < cells.length; head++) {
      const c = cells[head];
      for (const j of [c + 1, c - 1, c + N, c - N]) {
        if (seen.has(j)) continue;
        const kind = this.k(j);
        if (kind === K.EMPTY) continue;
        const x = j % N, y = Math.floor(j / N);
        if (kind === K.BEDROCK || x < x0 || x > x1 || y < y0 || y > y1 || cells.length >= limit) return null;
        seen.add(j); cells.push(j);
      }
    }
    return cells;
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
