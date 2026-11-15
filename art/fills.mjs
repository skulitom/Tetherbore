// Drawn fills for the terrain sets: one tile of palette keys (16 rows of 16), built from seeded clumps like
// Pixelbolt's speckle and then marked with what makes a kind of ground itself (cracks, bubbles, strata, roots).
//
// What must stay true:
// - A fill repeats every tile and a set's three variants are mixed cell by cell, so nothing drawn here may depend on
//   what lies across a tile's border. Clumps are cut off there, so they are kept small and close in tone to what
//   they lie on (large or contrasty ones show each block's outline in solid ground; making every variant agree along
//   the border was tried, and shows the grid as a lattice instead). Marks keep inside the tile; anything that runs
//   through (strata) crosses the border at the same rows in every variant.
// - Seeded hashing and + - x / only, so a build always draws the same pixels.

export const TILE = 16;

// A number in [0, 1) from whole numbers.
export function hash(...values) {
  let h = 0x9e3779b9;
  for (const v of values) {
    h = Math.imul(h ^ (v | 0), 0x85ebca6b); h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  }
  return (h >>> 0) / 4294967296;
}
const wrap = n => ((n % TILE) + TILE) % TILE;

// Smooth noise that repeats every tile, its lattice `size` pixels apart.
function noise(seed, salt, size, x, y) {
  const cells = Math.max(1, Math.round(TILE / size));
  const at = (i, j) => hash(seed, salt, ((i % cells) + cells) % cells, ((j % cells) + cells) % cells);
  const smooth = t => t * t * (3 - 2 * t);
  const fx = (x + 0.5) * cells / TILE, ix = Math.floor(fx), u = smooth(fx - ix);
  const fy = (y + 0.5) * cells / TILE, iy = Math.floor(fy), v = smooth(fy - iy);
  return (at(ix, iy) * (1 - u) + at(ix + 1, iy) * u) * (1 - v) + (at(ix, iy + 1) * (1 - u) + at(ix + 1, iy + 1) * u) * v;
}

export class Fill {
  constructor(seed, base) {
    this.seed = seed; this.salt = 0;
    this.grid = Array.from({ length: TILE }, () => Array(TILE).fill(base));
  }
  // The next number of this fill's own sequence.
  next() { return hash(this.seed, 0x5eed, this.salt++); }
  int(low, high) { return low + Math.floor(this.next() * (high - low + 1)); }
  get(x, y) { return this.grid[wrap(y)][wrap(x)]; }
  set(x, y, key) { this.grid[wrap(y)][wrap(x)] = key; return this; }
  // Clumps about `size` pixels across covering `amount` of the tile: the pixels where smooth noise is lowest.
  clumps(key, amount, size) {
    const salt = this.salt++, values = [];
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      values.push({ x, y, value: noise(this.seed, 0x51ec + salt, size, x, y) * 0.7 + noise(this.seed, 0x7e11 + salt, Math.max(1, size / 2), x, y) * 0.3 });
    }
    values.sort((a, b) => a.value - b.value || a.y - b.y || a.x - b.x);
    for (let k = 0; k < Math.round(amount * TILE * TILE); k++) this.grid[values[k].y][values[k].x] = key;
    return this;
  }
  // `count` single pixels, none beside another.
  dots(key, count, margin = 1) {
    for (const [x, y] of this.places(count, 2, margin)) this.set(x, y, key);
    return this;
  }
  // `count` places at least `apart` from each other and `margin` in from the tile's border.
  places(count, apart, margin = 1) {
    const out = [];
    for (let tries = 0; out.length < count && tries < 200; tries++) {
      const x = this.int(margin, TILE - 1 - margin), y = this.int(margin, TILE - 1 - margin);
      if (out.every(([u, v]) => Math.max(Math.abs(u - x), Math.abs(v - y)) >= apart)) out.push([x, y]);
    }
    return out;
  }
  // A straight run of pixels from one point to another.
  line(x0, y0, x1, y1, key) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0;
      this.set(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), key);
    }
    return this;
  }
  // A line that wanders: `steps` pixels from a start, each one of `moves` on from the last, kept `margin` inside
  // the tile. Naming a move twice makes it twice as likely.
  wander(x, y, moves, steps, key, margin = 1) {
    for (let i = 0; i < steps; i++) {
      if (x < margin || y < margin || x > TILE - 1 - margin || y > TILE - 1 - margin) break;
      this.set(x, y, key);
      const [dx, dy] = moves[this.int(0, moves.length - 1)];
      x += dx; y += dy;
    }
    return this;
  }
  // Rows of keys laid with their top left at a place; a '.' leaves what is there.
  stamp(x, y, rows) {
    rows.forEach((row, v) => [...row].forEach((key, u) => { if (key !== '.') this.set(x + u, y + v, key); }));
    return this;
  }
  rows() { return this.grid.map(row => row.join('')); }
}

// The fills of one kind of ground: the set's own pattern, then one for each further variant.
export const VARIANTS = ['a', 'b', 'c', 'd', 'e'];
export function drawn(seed, draw) {
  return [0, 7, 19, 31, 43].map((step, n) => { const fill = new Fill(seed + step, 'f'); draw(fill, n); return fill.rows(); });
}
