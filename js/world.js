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
// `freed` walks outlines: JOIN sides each while there is more than one to settle or one is known to be held, WALK
// sides in all, OUTLINE sides for the one left when nothing says it is not the rest of the world. HOLLOW is how
// many cells are followed from a cut that opened only on to a closed hollow.
const STEP = [1, N, -1, -N], OUTLINE = 600, JOIN = 20000, WALK = 60000, HOLLOW = 4000;
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
// Smooth noise in [0, 1): the hashes at the four whole points round (x, y), blended. `s` is the world's seed plus
// the layer's number `k`, and each layer remembers the four hashes of the square it was last asked about: a piece
// of the world is made a row at a time, so most cells ask about the square the cell before them did.
const kept = new Float64Array(32 * 7).fill(NaN);
const noise = (x, y, s, k = s & 31) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, m = k * 7;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  if (kept[m] !== xi || kept[m + 1] !== yi || kept[m + 2] !== s) {
    kept[m] = xi; kept[m + 1] = yi; kept[m + 2] = s;
    kept[m + 3] = hash(xi, yi, s); kept[m + 4] = hash(xi + 1, yi, s); kept[m + 5] = hash(xi, yi + 1, s); kept[m + 6] = hash(xi + 1, yi + 1, s);
  }
  const a = kept[m + 3], b = kept[m + 4], c = kept[m + 5], d = kept[m + 6];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
// Noise never leaves [0, 1) by more than rounding, so where a test against it is settled whatever it is, it is not
// worked out at all: `SURE` is the margin kept for that rounding.
const SURE = 1e-6;

export class World {
  constructor() {
    this.chunks = new Array(CW * CW);      // each { kind, biome, seen }, made when first looked at
    this.touched = new Set();              // pieces changed since the last save
    this.lava = new Map();                 // seconds of lava left in an open cell
    this.dug = new Map();                  // when the drill opened a cell of the north (for the ice to close it)
    this.seed = 1;
    this.made = 0;                         // pieces of the world made, and outline sides walked and cells followed by
    this.sides = 0; this.followed = 0;     // `freed` and `pieceIn`: for tests of how much work is done
    this.sector = { sx: NaN, sy: NaN, seed: NaN, what: 1, fx: 0, fy: 0, size: 3 };      // the sector `findAt` last looked at
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
      this.wreckX = Int32Array.from(this.wreckSpots, p => p[0]); this.wreckY = Int32Array.from(this.wreckSpots, p => p[1]);
    }
    return this.wreckSpots;
  }
  // What a sector's find puts in a cell, or -1 where it puts nothing. What the sector holds and where is worked out
  // once and kept while cells of the same sector are asked about.
  findAt(x, y) {
    const seed = this.seed, sx = Math.floor((x - C) / FIND), sy = Math.floor((y - C) / FIND), S = this.sector;
    if (S.sx !== sx || S.sy !== sy || S.seed !== seed) {
      S.sx = sx; S.sy = sy; S.seed = seed; S.what = hash(sx, sy, seed + 21);
      if (S.what < 0.7) {
        S.fx = C + sx * FIND + 8 + Math.floor(hash(sx, sy, seed + 22) * (FIND - 16)); S.fy = C + sy * FIND + 8 + Math.floor(hash(sx, sy, seed + 23) * (FIND - 16));
        if (Math.hypot(S.fx - C, S.fy - C) < 16) S.what = 1;
        else if (S.what < 0.38) S.size = hash(sx, sy, seed + 24) < 0.4 ? 4 : 3;
      }
    }
    const what = S.what;
    if (what >= 0.7) return -1;
    const dx = x - S.fx, dy = y - S.fy;
    if (what < 0.38) {
      // A geode: slate outside, ore within, and in the bigger ones a hollow at the heart.
      const size = S.size, far = Math.sqrt(dx * dx + dy * dy);
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
    this.made = 0;
  }

  // Whose ground a cell is, from the seed alone.
  biomeAt(x, y) {
    const seed = this.seed, dx = x - C, dy = y - C, r = Math.sqrt(dx * dx + dy * dy);
    if (r < HOME_R - 25 - SURE || (r < HOME_R + 25 + SURE && r < HOME_R + (noise(x / 30, y / 30, seed + 3, 3) - 0.5) * 50)) return B.CRUST;
    // The larger of the two distances, on a border that wanders in long sweeps and small wobbles.
    const far = Math.min(90, r * 0.2), near = Math.min(8, r * 0.1);
    const ax = Math.abs(dx) + (noise(x / 61, y / 61, seed + 1, 1) - 0.5) * far + (noise(x / 9, y / 9, seed + 16, 16) - 0.5) * near;
    const ay = Math.abs(dy) + (noise(x / 61, y / 61, seed + 2, 2) - 0.5) * far + (noise(x / 9, y / 9, seed + 17, 17) - 0.5) * near;
    const b = ax > ay ? (dx > 0 ? B.LODE : B.MIRE) : (dy < 0 ? B.FROST : B.EMBER);
    if (r <= DEEP_R - 100 - SURE) return b;
    const least = Math.min(Math.abs(dx), Math.abs(dy)), flank = Math.max(Math.abs(dx), Math.abs(dy)) * 0.36;
    if (least <= flank - 30 - SURE) return b;
    const deep = r > DEEP_R + (noise(x / 50, y / 50, seed + 14, 14) - 0.5) * 200 && least > flank + (noise(x / 37, y / 37, seed + 15, 15) - 0.5) * 60;
    return deep ? b + 4 : b;
  }
  // What a cell is before anything has touched it, from the seed alone.
  kindAt(x, y, b) {
    const seed = this.seed, dx = x - C, dy = y - C, r = Math.sqrt(dx * dx + dy * dy);
    if (r > WORLD_R + 1.5 + SURE || (r > WORLD_R - 1.5 - SURE && r > WORLD_R + (noise(x / 5, y / 5, seed + 4, 4) - 0.5) * 3)) return K.BEDROCK;
    // The core is a platform: its nine cells and the gap round them are open. Beside it lies a first piece already
    // cut loose, to show what drawing the tether round something does.
    if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) return K.EMPTY;
    if (dx >= 3 && dx <= 6 && dy >= -2 && dy <= 1) return dx === 3 || dx === 6 || dy === -2 || dy === 1 ? K.EMPTY : (dx + dy) % 2 ? K.ORE_A : K.SOFT;
    // What each direction hides: a relic sealed in ancient stone. (Asked only of cells that far out.)
    if (r > RELIC_R - 8 && r < RELIC_R + 8) for (let d = 0; d < 4; d++) {
      const edge = Math.max(Math.abs(dx - DX[d] * RELIC_R), Math.abs(dy - DY[d] * RELIC_R));
      if (edge === 0) return K.RELIC;
      if (edge <= 3) return K.VAULT;
      if (edge <= 5) return K.SOFT;
    }
    if (this.wrecksFor !== seed) this.wrecks;
    for (let n = 0, wx = this.wreckX, wy = this.wreckY; n < wx.length; n++) {
      const ex = x - wx[n], ey = y - wy[n];
      if (ex > 3 || ex < -3 || ey > 3 || ey < -3) continue;
      const edge = Math.max(Math.abs(ex), Math.abs(ey));
      if (edge === 0) return K.WRECK;
      if (edge === 1) return hash(x, y, seed + 32) < 0.55 ? K.SLATE : K.EMPTY;
      return K.EMPTY;
    }
    const find = r > 12 ? this.findAt(x, y) : -1;
    if (find >= 0) return find;
    const h = hash(x, y, seed + 9), deep = b > 4, kin = base(b);
    let k = K.SOFT;
    if (b === B.CRUST) {
      // Home ground: soft, with stones to go round, nuggets worth lassoing, and further out seams of slate.
      // (The last of these to hold is what the cell is, so they are asked last first, and the first that holds
      // settles it: an open cell asks about nothing else.)
      if (r > 60 && noise(x / 19, y / 19, seed + 18, 18) > 0.76) return K.EMPTY;      // great open caverns
      if (r > 22 && noise(x / 5, y / 5, seed + 13, 13) > 0.8) return K.EMPTY;
      if (r > 35 && Math.abs(noise(x / 9, y / 9, seed + 11, 11) - 0.5) < 0.022) return K.SLATE;
      if (r > 55 && h < 0.5 && noise(x / 3.5, y / 3.5, seed + 7, 7) > 0.78) return K.ORE_B;
      if (r > 4.5 && h < 0.6 && noise(x / 3, y / 3, seed + 6, 6) > 0.64) return K.ORE_A;
      if (r > 5 && noise(x / 4, y / 4, seed + 5, 5) > 0.7) return K.DENSE;
      return k;
    }
    const more = deep ? 1.8 : 1;
    if (noise(x / 19, y / 19, seed + 18, 18) > (kin === B.MIRE ? 0.7 : 0.78)) return K.EMPTY;
    if (noise(x / 5, y / 5, seed + 13, 13) > (kin === B.MIRE ? 0.68 : 0.8)) return K.EMPTY;
    if (r > 600 && Math.abs(noise(x / 8, y / 8, seed + 12, 12) - 0.5) < 0.028) return K.VAULT;
    if (Math.abs(noise(x / 9, y / 9, seed + 11, 11) - 0.5) < (kin === B.LODE ? 0.05 : 0.03)) return K.SLATE;
    if (kin === B.LODE && hash(x, y, seed + 10) < 0.026 * more) return K.HAZARD;
    if (kin === B.MIRE && hash(x, y, seed + 10) < 0.022 * more) return K.HAZARD;
    if (kin === B.EMBER && h > 0.45 && noise(x / 2.5, y / 2.5, seed + 8, 8) > (deep ? 0.72 : 0.78)) return K.HAZARD;
    if (h < 0.5 && noise(x / 3.5, y / 3.5, seed + 7, 7) > (deep ? 0.66 : 0.74)) return K.ORE_B;
    if (h < 0.62 && noise(x / 3, y / 3, seed + 6, 6) > (deep ? 0.6 : 0.66)) return K.ORE_A;
    if (noise(x / 4, y / 4, seed + 5, 5) > (kin === B.EMBER ? 0.64 : 0.68)) return K.DENSE;
    return k;
  }
  // The piece of world holding a cell, made now if nothing has looked there before.
  piece(id) {
    let p = this.chunks[id];
    if (p) return p;
    p = this.chunks[id] = { kind: new Uint8Array(CH * CH), biome: new Uint8Array(CH * CH), seen: new Uint8Array(CH * CH) };
    this.made++;
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
  // (What was known of a cell's sides goes when the cell changes: `dull`.)
  setK(i, v) { const id = ((i >>> 20) << 8) | ((i >>> 6) & 255), p = this.piece(id), at = (((i >>> 14) & 63) << 6) | (i & 63); p.kind[at] = v; if (p.dull) p.dull[at] = 0; this.touched.add(id); }
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
  // What a cell is where the world has been made, -1 where it has not: asking never makes it.
  laid(i) { const p = this.chunks[((i >>> 20) << 8) | ((i >>> 6) & 255)]; return p ? p.kind[(((i >>> 14) & 63) << 6) | (i & 63)] : -1; }
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
  // Is the ground a cell belongs to an island, asked for ground that nobody has cut: a rock standing free in a
  // cavern, a wreck in its hollow. As `island`, from side `d` of cell `s`, but what it learns is kept with the
  // world: every side of an outline that proved not to be an island's (or too long to tell) is marked dull, in
  // each piece of the world, and a walk that comes to a dull side stops there. So no wall is walked twice, however
  // often it is asked about, until a cell of it changes (`setK`).
  isle(s, d, most) {
    if (this.k(s) === K.EMPTY || this.k(s + STEP[d]) !== K.EMPTY) return false;
    const first = s * 4 + d, path = [];
    let found = false;
    for (let n = 0, at = first, turns = 0; n < most; n++) {
      const p = this.chunks[((at >>> 22) << 8) | ((at >>> 8) & 255)];
      if (p.dull && p.dull[(((at >>> 16) & 63) << 6) | ((at >>> 2) & 63)] & (1 << (at & 3))) break;
      path.push(at);
      const next = this.along(at);
      turns += (((next & 3) - (at & 3) + 1) & 3) - 1;
      at = next;
      if (this.k(at >> 2) === K.BEDROCK) break;
      if (at === first) { found = turns === 4; break; }
    }
    this.sides += path.length;
    if (!found) for (const at of path) {
      const p = this.chunks[((at >>> 22) << 8) | ((at >>> 8) & 255)];
      (p.dull ??= new Uint8Array(CH * CH))[(((at >>> 16) & 63) << 6) | ((at >>> 2) & 63)] |= 1 << (at & 3);
    }
    return found;
  }
  // Are these sides of ground all on one outline? Each is walked, a side in turn, until it comes to another's
  // start: `most` sides each at the most. Ground along one outline is one piece of ground, so cells whose sides
  // are on one outline are joined; if they are not found to be, nothing is known.
  oneOutline(sides, most) {
    const n = sides.length, starts = new Map(sides.map((side, q) => [side, q])), at = sides.slice(), parent = sides.map((side, q) => q);
    const find = q => { while (parent[q] !== q) q = parent[q] = parent[parent[q]]; return q; };
    let apart = n;
    for (let round = 0; round < most && apart > 1; round++) for (let q = 0; q < n && apart > 1; q++) {
      if (at[q] < 0) continue;
      at[q] = this.along(at[q]);
      this.sides++;
      const o = starts.get(at[q]);
      if (o === undefined) continue;
      if (o === q) return false;                       // all the way round and none of the others on it
      at[q] = -1;
      if (find(o) !== find(q)) { parent[find(o)] = find(q); apart--; }
    }
    return apart === 1;
  }
  // The ground that hangs on nothing once `cells` are open (or would, were they cut): one cell or a list of cells
  // opened together, which need not be open in the world yet. `open` is a set of further cells to take as open.
  // A list of pieces, each a list of cells.
  //
  // Ground that a cut has freed lies beside an opened cell, and it is an island: its outline, walked from the side
  // that faces the opened cell, comes back to where it began having turned outward four times more than inward
  // (`island`). So the outlines are walked, a side each in turn, from every side of ground that faces an opened
  // cell, and nothing is flooded to find out what is loose: the work is in proportion to the outlines, whatever
  // lies behind them, and the held ground beside a cut is never followed into the world. A walk that comes to the
  // side another began from is on the same outline and stops there; an outline is closed when every walk on it has
  // come to the next one's start. One that closes turned outward is an island, and only then is its ground
  // followed, to list its cells: no more than `limit` of them, or it is held. One that closes turned inward is the
  // wall of the open ground the cut was made from, one that touches bedrock is the world's own: both are held.
  //
  // Walks go on while there is more than one to settle, JOIN sides each and WALK in all. The last one left, with
  // nothing yet known to be held, is most likely the rest of the world (every cut at the end of a tunnel leaves one
  // such) and is given up after OUTLINE sides.
  //
  // One case the outline cannot settle: a cut that opens only on to a closed hollow inside a piece, with no way to
  // the core (not one the drill can make: its tether is always a way out). The hollow's wall says nothing of what
  // surrounds it, so that ground is followed a little way, HOLLOW cells, and is an island if it runs out.
  freed(cells, limit = 700, open = null) {
    const opened = typeof cells === 'number' ? [cells] : cells, gone = new Set(opened);
    if (open) for (const j of open) gone.add(j);
    // Where each walk began (a side: its cell times four plus which side), and where it is now.
    const starts = new Map(), from = [];
    for (const i of opened) for (let s = 0; s < 4; s++) {
      const c = i + STEP[s];
      if (gone.has(c) || this.k(c) === K.EMPTY) continue;
      const side = c * 4 + ((s + 2) & 3);
      if (!starts.has(side)) { starts.set(side, from.length); from.push(side); }
    }
    const n = from.length;
    if (!n) return [];
    // Of each walk: how it has turned, whether it has crossed the line east from the core's middle an odd number
    // of times (an outline that has is round the core), the walk whose start it came to, and whether it is over
    // (1: came to a start, 2: touched bedrock).
    const at = from.slice(), turns = new Int32Array(n), odd = new Uint8Array(n), next = new Int32Array(n).fill(-1), over = new Uint8Array(n);
    const isles = [], hollows = [];
    let going = n, held = false, walked = 0;
    for (let q = 0; q < n; q++) if (this.k(from[q] >> 2) === K.BEDROCK) { over[q] = 2; going--; held = true; }
    for (let round = 1; going > 0 && walked < WALK && round <= (going > 1 || held ? JOIN : OUTLINE); round++) for (let q = 0; q < n; q++) {
      if (over[q]) continue;
      const a = at[q], b = this.along(a, gone), c = b >> 2, f = b & 3;
      // The side turns outward (+1), goes straight on (0) or turns inward (-1).
      turns[q] += ((f - (a & 3) + 1) & 3) - 1;
      at[q] = b; walked++;
      if (this.k(c) === K.BEDROCK) { over[q] = 2; going--; held = true; continue; }
      if (!(f & 1) && (c >>> 14) === C && (c & (N - 1)) + (f ? 0 : 1) > C) odd[q] ^= 1;
      const o = starts.get(b);
      if (o === undefined) continue;
      over[q] = 1; next[q] = o; going--;
      // Is the outline closed: has every walk on it come to the next one's start?
      let sum = 0, core = 0, x = q;
      do { sum += turns[x]; core ^= odd[x]; x = next[x]; } while (x !== q && over[x] === 1);
      if (x !== q) continue;
      if (sum === 4) isles.push(q);
      else { held = true; if (!core) hollows.push(q); }
    }
    this.sides += walked;
    // The ground of each island is followed, once: cells already followed are known by `seen`.
    const seen = new Map(), pieces = [];
    for (const q of isles) { const piece = this.follow(from[q] >> 2, limit, gone, seen); if (piece) pieces.push(piece); }
    for (const q of hollows) { const piece = this.follow(from[q] >> 2, Math.min(limit, HOLLOW), gone, seen); if (piece) pieces.push(piece); }
    return pieces;
  }
  // The whole piece of ground a cell belongs to, as a list of cells: null if it is more than `limit` cells, touches
  // bedrock, or is ground that was followed before (`seen`, shared between calls, holds a mark for every cell
  // followed: a map from each piece of the world to its marks, 1 for a cell taken as open, else which call
  // followed it). `gone` is cells to take as open; `only`, if given, says which cells the piece may hold, and it is
  // null if it comes to any other.
  follow(start, limit, gone = null, seen = new Map(), only = null) {
    const chunks = this.chunks, run = seen.run = (seen.run ?? 1) + 1;
    if (run > 255) return this.follow(start, limit, gone, new Map(), only);
    let id = -1, kind = null, marks = null;
    // Turn to the piece of the world holding cell j; returns its place there.
    const turn = j => {
      const now = ((j >>> 20) << 8) | ((j >>> 6) & 255);
      if (now !== id) {
        id = now; kind = (chunks[id] ?? this.piece(id)).kind; marks = seen.get(id);
        if (!marks) seen.set(id, marks = new Uint8Array(CH * CH));
      }
      return (((j >>> 14) & 63) << 6) | (j & 63);
    };
    if (gone && run === 2) for (const j of gone) { const p = turn(j); marks[p] = 1; }
    const p0 = turn(start);
    if (marks[p0] || kind[p0] === K.EMPTY) return null;
    if (kind[p0] === K.BEDROCK || (only !== null && !only(start))) return null;
    marks[p0] = run;
    const cells = [start];
    let whole = true;
    for (let head = 0; head < cells.length && whole; head++) {
      const c = cells[head];
      for (let s = 0; s < 4; s++) {
        const j = c + STEP[s], p = turn(j), mark = marks[p];
        if (mark === run || mark === 1) continue;
        const k = kind[p];
        if (k === K.EMPTY) continue;
        // Ground another call followed and gave up on, bedrock, too much, or not allowed: this is not a piece.
        if (mark || k === K.BEDROCK || cells.length >= limit || (only !== null && !only(j))) { whole = false; break; }
        marks[p] = run; cells.push(j);
      }
    }
    this.followed += cells.length;
    return whole ? cells : null;
  }
  // The whole piece of ground a cell belongs to, if it lies inside the box and is no more than `limit` cells; null if
  // it runs out of the box, touches bedrock or is larger. `only`, if given, says which cells it may hold.
  pieceIn(i, x0, y0, x1, y1, limit, only = null) {
    const boxed = x0 > -Infinity || y0 > -Infinity || x1 < Infinity || y1 < Infinity;
    const inside = boxed ? j => { const x = j % N, y = Math.floor(j / N); return x >= x0 && x <= x1 && y >= y0 && y <= y1 && (only === null || only(j)); } : only;
    return this.follow(i, limit, null, new Map(), inside);
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
