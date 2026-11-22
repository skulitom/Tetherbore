// The painter's kit for the store art: one palette, a plate of palette keys, and the shaders that fill it pixel by
// pixel (the game's own core is drawn the same way, see art/sprites.mjs). A plate becomes a layer of a Pixelbolt
// recipe; Pixelbolt does the outlines, the dithered glows and the flattening.

// One palette for everything. The drill's yellow and the tether's pink are the game's.
export const PALETTE = {
  // the cave, violet black
  0: '#05030a', 1: '#0b0713', 2: '#130c1e', 3: '#1d132b', 4: '#2a1b3b', 5: '#3a274f',
  // ground, warm basalt
  a: '#190e15', b: '#2b171f', c: '#43232a', d: '#623432', e: '#864c3b', f: '#ad704d', g: '#d39a69', h: '#f1cb96',
  // heat, ember to white
  i: '#4f1016', j: '#8f1b1c', k: '#cf3420', l: '#f26a1e', m: '#ffa426', n: '#ffd84f', o: '#fff3b0', w: '#ffffff',
  // the tether
  p: '#5a1450', q: '#a8287f', r: '#ee4fa8', s: '#ffa6dc',
  // crystal
  t: '#0e3f66', u: '#1c7fb0', v: '#3bc7dc', x: '#aef5ef',
  // steel
  A: '#1f2336', B: '#3a4258', C: '#67718a', D: '#9aa6bb', E: '#cdd7e3', F: '#f3f7fb',
  // the drill's body
  G: '#6b3a0c', H: '#a8640f', I: '#e08a1c', J: '#ffc22e', K: '#ffe65e', L: '#fff7b8',
  // outline
  Z: '#04020a',
};
export const RAMP = { cave: '012345', rock: 'abcdefgh', hot: 'ijklmnow', pink: 'pqrsw', ice: 'tuvxw', steel: 'ABCDEF', gold: 'GHIJKL' };

export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

export const hash = (x, y, s = 0) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1440662683)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export const noise = (x, y, s = 0) => {
  const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi;
  const f = t => t * t * (3 - 2 * t), a = f(u), b = f(v);
  return lerp(lerp(hash(xi, yi, s), hash(xi + 1, yi, s), a), lerp(hash(xi, yi + 1, s), hash(xi + 1, yi + 1, s), a), b);
};
export const fbm = (x, y, s = 0, n = 3) => {
  let sum = 0, amp = 1, all = 0;
  for (let i = 0; i < n; i++) { sum += noise(x, y, s + i * 17) * amp; all += amp; amp *= 0.5; x *= 2.03; y *= 2.03; }
  return sum / all;
};

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
// A place t (0 to 1) on a ramp, dithered only in a narrow band between steps, so the shapes stay flat and clean.
export const tone = (ramp, t, x, y, band = 0.34) => {
  const at = clamp(t) * (ramp.length - 1), low = Math.floor(at), f = at - low;
  const up = f > 0.5 + band / 2 ? 1 : f < 0.5 - band / 2 ? 0 : (f - (0.5 - band / 2)) / band > bayer(x, y) ? 1 : 0;
  return ramp[Math.min(ramp.length - 1, low + up)];
};

export class Plate {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8Array(w * h); }
  set(x, y, key) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = key.charCodeAt(0); }
  get(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : 0; }
  fill(fn) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const k = fn(x, y); if (k) this.set(x, y, k); } return this; }
  rows() {
    const out = [];
    for (let y = 0; y < this.h; y++) {
      let row = '';
      for (let x = 0; x < this.w; x++) { const c = this.d[y * this.w + x]; row += c ? String.fromCharCode(c) : '.'; }
      out.push(row);
    }
    return out;
  }
  layer(name, ops = []) { return { name, ops: [{ op: 'grid', x: 0, y: 0, rows: this.rows() }, ...ops] }; }
}

// ---- a mask with its distance from the edge and the slope of a soft copy of it
export class Mask {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8Array(w * h); }
  has(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.d[y * this.w + x] === 1; }
  add(x, y) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = 1; }
  cut(x, y) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = 0; }
  // Distance in from the edge (chamfer), and a normal from a soft copy.
  bake(soft = 3) {
    const { w, h, d } = this;
    const dist = new Float32Array(w * h).fill(1e6);
    for (let i = 0; i < w * h; i++) if (!d[i]) dist[i] = 0;
    const relax = (x, y, dx, dy, c) => { const nx = x + dx, ny = y + dy; const o = nx < 0 || ny < 0 || nx >= w || ny >= h ? 0 : dist[ny * w + nx]; if (o + c < dist[y * w + x]) dist[y * w + x] = o + c; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { relax(x, y, -1, 0, 1); relax(x, y, 0, -1, 1); relax(x, y, -1, -1, 1.41); relax(x, y, 1, -1, 1.41); }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { relax(x, y, 1, 0, 1); relax(x, y, 0, 1, 1); relax(x, y, 1, 1, 1.41); relax(x, y, -1, 1, 1.41); }
    let blur = Float32Array.from(d);
    for (let pass = 0; pass < 2; pass++) {
      const next = new Float32Array(w * h);
      for (let y = 0; y < h; y++) {
        let sum = 0;
        for (let x = -soft; x < w; x++) { if (x + soft < w) sum += blur[y * w + x + soft]; if (x - soft - 1 >= 0) sum -= blur[y * w + x - soft - 1]; if (x >= 0) next[y * w + x] = sum / (soft * 2 + 1); }
      }
      const out = new Float32Array(w * h);
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let y = -soft; y < h; y++) { if (y + soft < h) sum += next[(y + soft) * w + x]; if (y - soft - 1 >= 0) sum -= next[(y - soft - 1) * w + x]; if (y >= 0) out[y * w + x] = sum / (soft * 2 + 1); }
      }
      blur = out;
    }
    this.dist = dist; this.blur = blur;
    return this;
  }
  normal(x, y) {
    const { w, h, blur } = this, at = (a, b) => (a < 0 || b < 0 || a >= w || b >= h ? 0 : blur[b * w + a]);
    const nx = at(x - 1, y) - at(x + 1, y), ny = at(x, y - 1) - at(x, y + 1), len = Math.hypot(nx, ny) || 1;
    return [nx / len, ny / len, Math.min(1, Math.hypot(nx, ny) * 4)];
  }
}

// Ground cut to the game's grid: rows of cells, '#' solid, with the corners and edges nibbled so it is rock, not tiles.
export function cellMask(w, h, rows, ox, oy, cell, seed = 1, nibble = 0.9) {
  const m = new Mask(w, h);
  rows.forEach((row, j) => [...row].forEach((c, i) => {
    if (c !== '#') return;
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) m.add(ox + i * cell + x, oy + j * cell + y);
  }));
  const edge = (x, y) => !m.has(x - 1, y) || !m.has(x + 1, y) || !m.has(x, y - 1) || !m.has(x, y + 1);
  const bites = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!m.has(x, y) || !edge(x, y)) continue;
    const n = fbm(x * 0.21, y * 0.21, seed, 2);
    if (n > 0.66) bites.push([x, y, Math.round((n - 0.66) * nibble * 9)]);
  }
  for (const [x, y, r] of bites) for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) if (a * a + b * b <= r * r) m.cut(x + a, y + b);
  return m.bake();
}

// Broken rock: the nearest two of a jittered grid of points. `edge` is how near the pixel is to a fracture.
const shards = (x, y, size, seed) => {
  const gx = Math.floor(x / size), gy = Math.floor(y / size);
  let d1 = 1e9, d2 = 1e9, a = 0, b = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = gx + i, cy = gy + j, px = (cx + hash(cx, cy, seed)) * size, py = (cy + hash(cx, cy, seed + 1)) * size, d = Math.hypot(x - px, y - py), id = hash(cx, cy, seed + 2);
    if (d < d1) { d2 = d1; b = a; d1 = d; a = id; } else if (d < d2) { d2 = d; b = id; }
  }
  return { edge: d2 - d1, id: a, pair: hash(Math.floor((a + b) * 9973), Math.floor(Math.abs(a - b) * 9973), seed + 3) };
};

// Shaded ground. `light` is a unit vector towards the light; `hot` lights the rim on that side.
export function paintRock(p, m, { light = [-0.7, -0.7], seed = 1, base = 0.36, hot = 0.9, ramp = RAMP.rock, ore = [], veins = 0, facet = 11 } = {}) {
  const orePixels = new Map();
  for (const o of ore) {
    const R = o.r;
    for (let b = -R - 1; b <= R + 1; b++) for (let a = -R - 1; a <= R + 1; a++) {
      const wob = R + (noise((o.x + a) * 0.6, (o.y + b) * 0.6, seed + 40) - 0.5) * 1.8;
      if (a * a + b * b <= wob * wob && m.has(o.x + a, o.y + b)) {
        const s = (-a * 0.7 - b * 0.7) / (R + 0.01);
        orePixels.set((o.y + b) * m.w + o.x + a, o.kind === 'ice' ? tone(RAMP.ice, 0.44 + s * 0.42, o.x + a, o.y + b) : o.kind === 'pink' ? tone(RAMP.pink, 0.4 + s * 0.4, o.x + a, o.y + b) : tone(RAMP.hot, 0.62 + s * 0.3, o.x + a, o.y + b));
      }
    }
  }
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (!m.has(x, y)) continue;
    const i = y * m.w + x, d = m.dist[i];
    const [nx, ny, edge] = m.normal(x, y);
    const lit = (nx * light[0] + ny * light[1]) * edge;
    const wx = x + (noise(x * 0.11, y * 0.11, seed + 3) - 0.5) * facet * 0.6, wy = y + (noise(x * 0.11, y * 0.11, seed + 4) - 0.5) * facet * 0.6;
    const shard = shards(wx, wy, facet, seed);
    const turn = shard.id * Math.PI * 2, tilt = Math.cos(turn) * light[0] + Math.sin(turn) * light[1];
    const blot = fbm(x * 0.09, y * 0.09, seed + 5, 2);
    let t = base + tilt * 0.13 + (blot - 0.5) * 0.16 + (hash(x, y, seed) - 0.5) * 0.035;
    // the light falls across the whole block, then the bevel at the edge
    t += ((x - m.w / 2) * light[0] + (y - m.h / 2) * light[1]) / Math.max(m.w, m.h) * 0.3;
    t += lit * (d < 6 ? lerp(0.6, 0.16, d / 6) : 0.08);
    // each fracture is a dark line with a lit lip, and some of them run with heat
    const seam = veins && shard.pair < veins && d > 2.5;
    if (shard.edge < 1.5 && d > 1.5 && !seam) t = shard.edge < 0.8 ? Math.min(t, 0.08) : t - 0.13;
    else if (shard.edge < 2.6 && d > 1.5) t += 0.06;
    let key = tone(ramp, t, x, y, 0.26);
    if (seam) { if (shard.edge < 0.8) key = 'n'; else if (shard.edge < 1.6) key = 'm'; else if (shard.edge < 2.5) key = 'k'; }
    const orePx = orePixels.get(i);
    if (orePx) key = orePx;
    if (hot && d <= 2.2 && lit > 0.35) key = d <= 1.2 ? (lit > 0.6 ? 'o' : 'n') : (lit > 0.55 ? 'm' : 'l');
    p.set(x, y, key);
  }
  return p;
}

// Ore scattered in the block, in clusters.
export function scatterOre(m, seed, count, kinds = ['hot', 'hot', 'ice']) {
  const out = [];
  let tries = 0, s = seed * 97;
  while (out.length < count && tries++ < count * 60) {
    const x = Math.floor(hash(tries, 3, s) * m.w), y = Math.floor(hash(tries, 7, s) * m.h);
    if (!m.has(x, y) || m.dist[y * m.w + x] < 4) continue;
    const r = 1 + Math.floor(hash(tries, 11, s) * 2.6);
    if (out.some(o => Math.hypot(o.x - x, o.y - y) < o.r + r + 3)) continue;
    out.push({ x, y, r, kind: kinds[Math.floor(hash(tries, 13, s) * kinds.length)] });
  }
  return out;
}

// The drill, as a solid of revolution seen from the side: length L, radius R, centre (cx, cy), pointing along `ang`.
export function paintDrill(p, cx, cy, ang, L, R, { light = [-0.6, -0.8] } = {}) {
  const ca = Math.cos(ang), sa = Math.sin(ang), reach = Math.ceil(Math.hypot(L / 2, R)) + 2;
  const bitFrom = L * 0.06, back = -L / 2, tip = L / 2;
  const radius = u => {
    if (u < back || u > tip) return 0;
    if (u < back + R * 0.55) { const k = (u - back) / (R * 0.55); return R * Math.sqrt(clamp(1 - (1 - k) * (1 - k))) * 0.92; }
    if (u < bitFrom - 1) return R;
    if (u < bitFrom + 1) return R * 1.12;            // the collar
    return R * 0.94 * Math.pow(clamp((tip - u) / (tip - bitFrom)), 0.9);
  };
  for (let y = Math.floor(cy - reach); y <= cy + reach; y++) for (let x = Math.floor(cx - reach); x <= cx + reach; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = dx * ca + dy * sa, v = -dx * sa + dy * ca, r = radius(u);
    if (r <= 0 || Math.abs(v) > r) continue;
    const s = v / r;                 // -1 to 1 across the body
    const nx = -sa * s, ny = ca * s; // which way this strip of the surface faces
    const lit = nx * light[0] + ny * light[1];
    const round = Math.sqrt(clamp(1 - s * s));
    let key;
    if (u >= bitFrom + 1) {
      // the bit: steel, with a spiral flute
      const flute = ((u * 0.62 + s * r * 0.95) % 3.4 + 3.4) % 3.4 < 1.25;
      key = tone(RAMP.steel, clamp(0.5 + lit * 0.42 + round * 0.12 - (flute ? 0.3 : 0)), x, y, 0.2);
      if (!flute && lit > 0.45) key = 'F';
    } else if (u >= bitFrom - 1) {
      key = tone(RAMP.steel, clamp(0.34 + lit * 0.5), x, y, 0.2);
    } else {
      // the body: yellow, a dark band at the back, a round port of crystal
      key = tone(RAMP.gold, clamp(0.58 + lit * 0.42 + round * 0.1), x, y, 0.2);
      if (u < back + L * 0.2 && u > back + L * 0.13) key = tone(RAMP.steel, clamp(0.3 + lit * 0.4), x, y, 0.2);
      const pu = u - (back + L * 0.36), pr = R * 0.56;
      if (pu * pu + v * v < pr * pr) {
        const edge = Math.sqrt(pu * pu + v * v) / pr;
        key = edge > 0.76 ? tone(RAMP.steel, clamp(0.32 + lit * 0.35), x, y, 0.1) : tone(RAMP.ice, clamp(0.56 + ((-pu * ca - v * -sa) / pr) * 0.1 + (-pu * 0.3 - v * 0.7) / pr * 0.5), x, y, 0.1);
      }
    }
    p.set(x, y, key);
  }
  return p;
}

// A taut line of light through the points, with the game's beads along it: thick core, pink edge, a dithered aura.
export function paintTether(p, points, { width = 1.2, aura = 4.5, bead = 7 } = {}) {
  const segs = [];
  let run = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i], len = Math.hypot(bx - ax, by - ay);
    segs.push({ ax, ay, bx, by, len, from: run }); run += len;
  }
  const near = (x, y) => {
    let best = 1e9, at = 0;
    for (const s of segs) {
      const t = clamp(((x - s.ax) * (s.bx - s.ax) + (y - s.ay) * (s.by - s.ay)) / (s.len * s.len || 1));
      const d = Math.hypot(x - lerp(s.ax, s.bx, t), y - lerp(s.ay, s.by, t));
      if (d < best) { best = d; at = s.from + t * s.len; }
    }
    return [best, at];
  };
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of points) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const r = Math.ceil(aura + width + 2);
  for (let y = Math.floor(y0) - r; y <= y1 + r; y++) for (let x = Math.floor(x0) - r; x <= x1 + r; x++) {
    const [d, along] = near(x + 0.5, y + 0.5);
    if (d > aura + width) continue;
    const beadOn = bead > 0 && ((along % bead) + bead) % bead < 2.2;
    if (d < width * 0.62) p.set(x, y, 'w');
    else if (d < width + (beadOn ? 0.9 : 0)) p.set(x, y, beadOn ? 'w' : 's');
    else if (d < width + 1.1) p.set(x, y, 'r');
    else if (d < width + aura) {
      const k = 1 - (d - width - 1.1) / aura;
      if (k * 0.72 > bayer(x, y)) p.set(x, y, k > 0.6 ? 'q' : 'p');
    }
  }
  return p;
}

// The tether drawn tight round a cut block: it follows the steps of the ground as the drill cut them.
export function paintLoop(p, m, { width = 1.5, aura = 3.2, bead = 7, seed = 1 } = {}) {
  const R = Math.ceil(width + aura + 1);
  for (let y = -R; y < m.h + R; y++) for (let x = -R; x < m.w + R; x++) {
    if (m.has(x, y)) continue;
    let near = 1e9;
    for (let b = -R; b <= R; b++) for (let a = -R; a <= R; a++) if (m.has(x + a, y + b)) { const d = Math.hypot(a, b); if (d < near) near = d; }
    if (near > width + aura) continue;
    const beadOn = ((x + y) % bead + bead) % bead < 2;
    if (near <= width * 0.75) p.set(x, y, beadOn ? 'w' : 's');
    else if (near <= width + 0.4) p.set(x, y, beadOn ? 's' : 'r');
    else if (near <= width + 1.1) p.set(x, y, 'q');
    else { const k = 1 - (near - width - 1.1) / aura; if (k * 0.7 > bayer(x, y)) p.set(x, y, k > 0.55 ? 'q' : 'p'); }
  }
  return p;
}

// Sparks and grit flung off a point along a direction, seeded; each a short streak.
export function paintSparks(p, x, y, ang, spread, count, reach, seed, keys = 'wonmml') {
  for (let i = 0; i < count; i++) {
    const a = ang + (hash(i, 1, seed) - 0.5) * spread, dist = Math.pow(hash(i, 2, seed), 1.5) * reach + 2;
    const sx = x + Math.cos(a) * dist, sy = y + Math.sin(a) * dist, n = 1 + Math.floor(hash(i, 3, seed) * 3.5);
    const key = keys[Math.floor(hash(i, 4, seed) * keys.length)];
    for (let k = 0; k < n; k++) p.set(Math.round(sx + Math.cos(a) * k), Math.round(sy + Math.sin(a) * k), key);
  }
  return p;
}
