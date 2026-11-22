// The three capsule concepts, each a function of a layout, so one picture can be cut to every shape the store asks for.
//   haul     the block in flight, lit by the core, the tether drawn round it
//   eclipse  the block black against the molten core, one silhouette
//   cut      the drill in close, a line of fire round a block in a wall
import { PALETTE, Plate, clamp, fbm, hash, lerp, tone, cellMask, paintRock, scatterOre, paintDrill, paintTether, paintLoop, paintSparks } from './kit.mjs';

export const BLOCKS = {
  big: [
    '.#####......',
    '.########...',
    '##########..',
    '###########.',
    '############',
    '############',
    '..##########',
    '...#######..',
    '.....####...',
  ],
  wide: [
    '.######.........',
    '.##########.....',
    '##############..',
    '###############.',
    '################',
    '..##############',
    '....#########...',
    '......####......',
  ],
  tall: [
    '...####...',
    '..######..',
    '.########.',
    '##########',
    '##########',
    '##########',
    '.#########',
    '..#######.',
    '..######..',
    '...####...',
    '....##....',
  ],
};

const recipe = (name, w, h, layers) => ({ version: 1, name, width: w, height: h, palette: PALETTE, animations: {}, frames: [{ name: 'art', layers }] });

// Monotone-chain hull of a mask, outset a little: the shape a taut loop takes round it.
function hullOf(m, out = 1.5) {
  const pts = [];
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (m.has(x, y) && (!m.has(x - 1, y) || !m.has(x + 1, y) || !m.has(x, y - 1) || !m.has(x, y + 1))) pts.push([x + 0.5, y + 0.5]);
  }
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = list => { const h = []; for (const q of list) { while (h.length > 1 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop(); h.push(q); } h.pop(); return h; };
  const hull = [...half(pts), ...half([...pts].reverse())];
  const cx = hull.reduce((s, q) => s + q[0], 0) / hull.length, cy = hull.reduce((s, q) => s + q[1], 0) / hull.length;
  // drop near-duplicates so the loop runs in long taut spans
  const spans = [];
  for (const q of hull) { const l = spans[spans.length - 1]; if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > 5) spans.push(q); }
  return spans.map(([x, y]) => { const d = Math.hypot(x - cx, y - cy) || 1; return [x + (x - cx) / d * out, y + (y - cy) / d * out]; });
}

// The cave behind everything: violet dark, warmed about `focus`, on one ramp so no glow has an edge, with black ground
// closing in at the top and foot, stepped on a grid as the game's ground is.
function cave(p, { focus, reach, seed = 3, heat = 0.6, halo = null, back = null, power = 0.62, step }) {
  const { w, h } = p;
  p.fill((x, y) => {
    const g = 1 - clamp(Math.hypot((x - focus[0]) / reach, (y - focus[1]) / (reach * 0.72)));
    const wall = fbm(x * 0.034, y * 0.06, seed, 3), bed = Math.sin((y + wall * 26) * 0.2) * 0.5 + 0.5;
    // the wall's own mottling stays in the violets; the heat is a clean radial laid over it, so it never blotches
    const dark = Math.min(0.34, 0.12 + Math.pow(g, 1.5) * heat * 0.4 + (wall - 0.5) * 0.3 * (0.45 + g) + (bed - 0.5) * 0.04);
    const wob = 1 + (wall - 0.5) * 0.22;
    let hot = 0;
    if (halo) { const d = Math.hypot(x - halo[0], y - halo[1]) / (halo[2] * 3.1) * wob; if (d < 1) hot = Math.max(hot, Math.pow(1 - d, 2) * 1.05); }
    if (back) { const d = Math.hypot((x - back[0]) / back[2], (y - back[1]) / (back[2] * 0.8)) * wob; if (d < 1) hot = Math.max(hot, Math.pow(1 - d, 1.6) * power * 1.25); }
    return tone('0123ijklm', Math.max(dark, hot), x, y, 0.6);
  });
  const c = step ?? Math.max(4, Math.round(h / 16)), n = Math.ceil(w / c) + 1;
  const heights = (s, mid, amp) => Array.from({ length: n }, (_, i) => Math.max(0, Math.round((mid + (fbm(i * 0.23, s, s, 3) - 0.5) * amp * 1.7 + (hash(i, 5, s) - 0.5) * c * 1.2) / c)) * c);
  const tops = heights(seed + 1, h * 0.1, h * 0.36), feet = heights(seed + 2, h * 0.12, h * 0.38);
  const solid = (x, y) => { const i = Math.floor(x / c); if (i < 0 || i >= n) return true; return y < tops[i] || y >= h - feet[i]; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!solid(x, y)) continue;
    const near = 1 - clamp(Math.hypot(x - focus[0], (y - focus[1]) * 1.4) / (reach * 0.9));
    const lip = !solid(x, y - 1) || !solid(x, y + 1) || !solid(x - 1, y) || !solid(x + 1, y);
    const inner = !solid(x, y - 2) || !solid(x, y + 2) || !solid(x - 2, y) || !solid(x + 2, y);
    p.set(x, y, lip ? (near > 0.45 ? '4' : '3') : inner ? '1' : '0');
  }
}

// Dust dragged out behind what is flying: dashes along its line of travel.
function streaks(p, x, y, w, h, ang, n, seed, keys = '345') {
  for (let i = 0; i < n; i++) {
    const sx = x + hash(i, 1, seed) * w, sy = y + hash(i, 2, seed) * h, len = 3 + Math.floor(hash(i, 3, seed) * 11), key = keys[Math.floor(hash(i, 4, seed) * keys.length)];
    for (let k = 0; k < len; k++) p.set(Math.round(sx + Math.cos(ang) * k), Math.round(sy + Math.sin(ang) * k), key);
  }
}

// The core itself: a molten disc with a white heart.
function paintCore(p, cx, cy, r, { spokes = 0 } = {}) {
  for (let y = Math.floor(cy - r) - 1; y <= cy + r + 1; y++) for (let x = Math.floor(cx - r) - 1; x <= cx + r + 1; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy) / r;
    if (d > 1) continue;
    const swirl = fbm(dx * 0.06 + d * 2, dy * 0.06 - d * 2, 7, 3);
    let t = 1 - d * d * 0.92 + (swirl - 0.5) * 0.3 * d;
    if (spokes) t += Math.cos(Math.atan2(dy, dx) * spokes) * 0.03 * d;
    p.set(x, y, tone('jklmnow', clamp(t), x, y, 0.3));
  }
  return p;
}

function debris(p, x, y, ang, n, reach, seed) {
  for (let i = 0; i < n; i++) {
    const a = ang + (hash(i, 1, seed) - 0.5) * 1.1, dist = 3 + Math.pow(hash(i, 2, seed), 1.4) * reach;
    const px = Math.round(x + Math.cos(a) * dist + (hash(i, 5, seed) - 0.5) * 16), py = Math.round(y + Math.sin(a) * dist + (hash(i, 6, seed) - 0.5) * 10);
    const r = hash(i, 3, seed) < 0.35 ? 2 : 1, key = 'bcde'[Math.floor(hash(i, 4, seed) * 4)];
    for (let b = 0; b < r; b++) for (let c = 0; c < r; c++) p.set(px + c, py + b, key);
    if (r > 1) p.set(px, py, 'f');
  }
}

// ---------------------------------------------------------------- 1. THE HAUL
export function haul(name, W, H, o) {
  const { block = 'big', cell = 8, at, core, drill, seed = 5 } = o;
  const rows = BLOCKS[block], bw = rows[0].length * cell, bh = rows.length * cell;
  const m = cellMask(W, H, rows, at[0], at[1], cell, seed);
  const bg = new Plate(W, H);
  const mid = [at[0] + bw / 2, at[1] + bh / 2];
  cave(bg, { focus: [lerp(mid[0], core[0], 0.35), lerp(mid[1], core[1], 0.3)], reach: Math.max(W * 0.62, H), seed: seed + 1, heat: o.heat ?? 0.42, halo: core[2] ? core : null, back: [mid[0] + bw * 0.04, mid[1], Math.max(bw, bh) * 0.92] });
  const dir = [core[0] - mid[0], core[1] - mid[1]], len = Math.hypot(...dir), light = [dir[0] / len, dir[1] / len];

  const fx = new Plate(W, H);
  const away = Math.atan2(-light[1], -light[0]);
  streaks(fx, at[0] + bw * 0.45, at[1] - bh * 0.05, bw * 0.75, bh * 1.1, away, Math.round(bh * 0.5), seed + 4);
  debris(fx, at[0] + bw * 0.62, at[1] + bh * 0.8, away + 0.55, Math.round(bw * 0.42), bw * 0.6, seed);

  for (let i = 0; i < (o.motes ?? 0); i++) {
    const x = Math.floor(hash(i, 21, seed) * W), y = Math.floor(hash(i, 22, seed) * H), key = 'jkkl4'[Math.floor(hash(i, 23, seed) * 5)];
    fx.set(x, y, key);
    if (hash(i, 24, seed) < 0.3) fx.set(x, y - 1, key);
  }

  const rock = new Plate(W, H);
  paintRock(rock, m, { light, seed, base: o.base ?? 0.56, hot: 1, veins: 0.3, facet: Math.max(6, cell * 1.5), ore: scatterOre(m, seed, Math.round(bw * bh / 420), ['hot', 'hot', 'hot', 'ice']) });

  const line = new Plate(W, H);
  paintLoop(line, m, { width: o.loop ?? 2.1, aura: o.aura ?? 2.6 });
  // the tail ties on where the block's edge is nearest the core
  let knotAt = [mid[0], mid[1]], best = 1e9;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!m.has(x, y)) continue;
    const d = Math.hypot(x - core[0], y - core[1]);
    if (d < best) { best = d; knotAt = [x, y]; }
  }
  const loop = [knotAt], knot = 0;
  paintTether(line, [core, loop[knot]], { width: (o.tw ?? 1.15), aura: (o.aura ?? 2.6) + 0.8, bead: 7 });

  const front = new Plate(W, H);
  if (core[2]) paintCore(front, core[0], core[1], core[2]);
  const bit = new Plate(W, H);
  // the drill rides the line from the core to the knot, `drill[0]` of the way along, nose to the block
  const along = drill[0], ang = Math.atan2(loop[knot][1] - core[1], loop[knot][0] - core[0]), L = drill[1], R = drill[2];
  const dx = lerp(core[0], loop[knot][0], along), dy = lerp(core[1], loop[knot][1], along);
  paintDrill(bit, dx, dy, ang, L, R);
  const sparks = new Plate(W, H);
  paintSparks(sparks, dx + Math.cos(ang) * L / 2, dy + Math.sin(ang) * L / 2, ang + Math.PI * 0.82, 1.5, Math.round(L * 1.1), L * 0.85, seed + 2);

  return recipe(name, W, H, [
    bg.layer('cave'),
    fx.layer('debris'),
    rock.layer('block', [{ op: 'outline', color: 'Z', position: 'outside', diagonal: true }]),
    line.layer('tether'),
    front.layer('core'),
    bit.layer('drill', [{ op: 'outline', color: 'Z', position: 'outside', diagonal: true }]),
    sparks.layer('sparks'),
  ]);
}

// ---------------------------------------------------------------- 2. ECLIPSE
export function eclipse(name, W, H, o) {
  const { block = 'wide', cell = 7, at, disc, drill, tail, seed = 8 } = o;
  const rows = BLOCKS[block], bw = rows[0].length * cell, bh = rows.length * cell;
  const m = cellMask(W, H, rows, at[0], at[1], cell, seed);
  const bg = new Plate(W, H);
  bg.fill((x, y) => {
    const d = Math.hypot(x - disc[0], y - disc[1]) / disc[2];
    const wall = fbm(x * 0.03, y * 0.05, seed, 3);
    const t = 0.08 + (d > 1 ? Math.pow(clamp(1.0 - (d - 1) / 1.45), 2.2) * 0.8 : 0.9) + (wall - 0.5) * 0.16;
    return tone('0123ijk', t, x, y, 0.3);
  });
  const hot = new Plate(W, H);
  paintCore(hot, disc[0], disc[1], disc[2]);
  // a corona of flares
  for (let i = 0; i < 90; i++) {
    const a = hash(i, 1, seed) * Math.PI * 2, r0 = disc[2] * (0.99 + hash(i, 2, seed) * 0.05), n = 2 + Math.floor(hash(i, 3, seed) * disc[2] * 0.16);
    for (let k = 0; k < n; k++) hot.set(Math.round(disc[0] + Math.cos(a) * (r0 + k)), Math.round(disc[1] + Math.sin(a) * (r0 + k)), k < n / 3 ? 'n' : k < n / 1.6 ? 'l' : 'k');
  }
  const rock = new Plate(W, H);
  const light = [(disc[0] - at[0] - bw / 2) / disc[2], (disc[1] - at[1] - bh / 2) / disc[2]], ll = Math.hypot(...light) || 1;
  rock.fill((x, y) => {
    if (!m.has(x, y)) return null;
    const d = m.dist[y * W + x], [nx, ny] = m.normal(x, y), up = nx * light[0] / ll + ny * light[1] / ll;
    if (d <= 1.3) return up > 0.2 ? 'n' : up > -0.25 ? 'l' : 'k';
    if (d <= 2.4) return up > 0.3 ? 'l' : 'j';
    const tex = fbm(x * 0.1, y * 0.1, seed, 3), crack = Math.abs(fbm(x * 0.075, y * 0.075, seed + 9, 3) - 0.5);
    if (crack < 0.012) return 'i';
    return tone('0123', 0.12 + (tex - 0.5) * 0.5 + (d < 6 ? (6 - d) / 6 * 0.18 : 0), x, y, 0.2);
  });
  const line = new Plate(W, H);
  paintTether(line, tail, { width: 1.3, aura: 3.5, bead: 7 });
  const loop = hullOf(m, 1.2);
  const front = new Plate(W, H);
  paintTether(front, [...loop, loop[0]], { width: 0.85, aura: 1.6, bead: 7 });
  const bit = new Plate(W, H);
  paintDrill(bit, drill[0], drill[1], drill[2], drill[3], drill[4]);
  const sparks = new Plate(W, H);
  paintSparks(sparks, drill[0], drill[1], drill[2] + Math.PI, 2.2, 26, drill[3], seed + 2, 'wonm');
  return recipe(name, W, H, [
    bg.layer('cave'), hot.layer('core'), line.layer('tether'),
    rock.layer('block', [{ op: 'outline', color: 'Z', position: 'outside', diagonal: true }]),
    front.layer('loop'),
    bit.layer('drill', [{ op: 'outline', color: 'Z', position: 'outside', diagonal: true }]),
    sparks.layer('sparks'),
  ]);
}

// ---------------------------------------------------------------- 3. THE CUT
export function cut(name, W, H, o) {
  const { block = 'big', cell = 8, at, drill, tail, seed = 13 } = o;
  const rows = BLOCKS[block];
  const m = cellMask(W, H, rows, at[0], at[1], cell, seed, 1.1);
  // the wall: the whole frame is ground, dark, with the block's edge a trench of fire
  const wall = new Plate(W, H);
  const solid = cellMask(W, H, Array(Math.ceil(H / cell) + 2).fill('#'.repeat(Math.ceil(W / cell) + 2)), -cell, -cell, cell, seed + 1, 0);
  paintRock(wall, solid, { light: [-0.5, -0.8], seed: seed + 2, base: 0.14, ramp: '0abbc', hot: 0, facet: 15, ore: scatterOre(solid, seed + 3, Math.round(W * H / 1600), ['hot', 'ice']) });
  wall.fill((x, y) => {
    const v = Math.hypot((x - W * 0.6) / (W * 0.72), (y - H * 0.5) / (H * 0.8));
    return v > 0.86 && hash(x, y, 3) < (v - 0.86) * 5 ? '0' : null;
  });
  const slab = new Plate(W, H);
  paintRock(slab, m, { light: [-0.6, -0.8], seed, base: 0.5, hot: 0, veins: 0.22, facet: Math.max(6, cell * 1.5), ore: scatterOre(m, seed, Math.round(rows.length * rows[0].length * cell * cell / 360), ['hot', 'hot', 'ice']) });
  // the trench round it: white at the heart, ember at its lip
  const trench = new Plate(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let near = 9;
    for (let b = -4; b <= 4; b++) for (let a = -4; a <= 4; a++) {
      if (m.has(x + a, y + b) !== m.has(x, y)) { const d = Math.hypot(a, b); if (d < near) near = d; }
    }
    if (m.has(x, y) || near > 4.2) continue;
    trench.set(x, y, near < 1.5 ? 'w' : near < 2.4 ? 'o' : near < 3.2 ? 'm' : hash(x, y, 8) < 0.6 ? 'k' : 'j');
  }
  const line = new Plate(W, H);
  paintTether(line, tail, { width: 1.4, aura: 3.8, bead: 7 });
  const bit = new Plate(W, H);
  paintDrill(bit, drill[0], drill[1], drill[2], drill[3], drill[4]);
  const sparks = new Plate(W, H);
  const tipX = drill[0] + Math.cos(drill[2]) * drill[3] / 2, tipY = drill[1] + Math.sin(drill[2]) * drill[3] / 2;
  paintSparks(sparks, tipX, tipY, drill[2] + Math.PI * 0.86, 1.8, 54, drill[3] * 1.5, seed, 'wwonml');
  return recipe(name, W, H, [
    wall.layer('wall'), trench.layer('cut'),
    slab.layer('block', [{ op: 'outline', color: 'a', position: 'inside' }]),
    line.layer('tether'),
    bit.layer('drill', [{ op: 'outline', color: 'Z', position: 'outside', diagonal: true }]),
    sparks.layer('sparks'),
  ]);
}

// ---------------------------------------------------------------- what carries no title
// The store page's background: the cave alone, dim and quiet, since the page's text is read over it.
export function backdrop(name, W, H) {
  const p = new Plate(W, H);
  cave(p, { focus: [W * 0.5, H * 0.34], reach: W * 0.7, seed: 11, heat: 0.2, back: [W * 0.5, H * 0.3, W * 0.42], power: 0.3 });
  const motes = new Plate(W, H);
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(hash(i, 1, 31) * W), y = Math.floor(hash(i, 2, 31) * H), key = 'jk4l'[Math.floor(hash(i, 3, 31) * 4)];
    motes.set(x, y, key);
    if (hash(i, 4, 31) < 0.3) motes.set(x, y - 1, key);
  }
  return recipe(name, W, H, [p.layer('cave'), motes.layer('motes')]);
}

// The icon: the line coming in from the corner, the drill on it, and the block in its loop. S pixels square.
export function icon(name, S) {
  const cell = S >= 60 ? 6 : 4;
  const rows = ['.####...', '.######.', '########', '########', '.#######', '..####..'];
  const at = [Math.round(S * 0.08), S - rows.length * cell - Math.round(S * 0.08)];
  const m = cellMask(S, S, rows, at[0], at[1], cell, 6, 0.4);
  const bg = new Plate(S, S);
  bg.fill((x, y) => tone('0123ijkl', clamp(0.1 + Math.pow(1 - clamp(Math.hypot(x - S * 0.42, y - S * 0.6) / (S * 0.62)), 1.5) * 0.78), x, y, 0.6));
  const light = [0.71, -0.71], rock = new Plate(S, S);
  paintRock(rock, m, { light, seed: 6, base: 0.6, hot: 1, veins: 0.34, facet: Math.max(6, cell * 1.6), ore: scatterOre(m, 4, S >= 60 ? 4 : 3, ['hot', 'ice']) });
  const from = [S + 1, -1];
  let knot = at, best = 1e9;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (m.has(x, y)) { const d = Math.hypot(x - from[0], y - from[1]); if (d < best) { best = d; knot = [x, y]; } }
  const line = new Plate(S, S);
  paintLoop(line, m, { width: S >= 60 ? 1.9 : 1.5, aura: 1.2 });
  paintTether(line, [from, knot], { width: S >= 60 ? 1.3 : 1, aura: 1.2, bead: 7 });
  const bit = new Plate(S, S), ang = Math.atan2(knot[1] - from[1], knot[0] - from[0]);
  paintDrill(bit, lerp(from[0], knot[0], 0.6), lerp(from[1], knot[1], 0.6), ang, S * 0.38, S * 0.11);
  return recipe(name, S, S, [
    bg.layer('ground'),
    rock.layer('block', [{ op: 'outline', color: 'Z', position: 'outside', diagonal: true }]),
    line.layer('tether'),
    bit.layer('drill', [{ op: 'outline', color: 'Z', position: 'outside', diagonal: true }]),
  ]);
}

// A plain page and captions for the contact sheet (the only place in the store art with words other than the title).
export function label(name, W, H, text = '', color = 'w') {
  if (text) return recipe(name, W, H, [{ name: 'text', ops: [{ op: 'text', x: 0, y: 0, text, color }] }]);
  return recipe(name, W, H, [new Plate(W, H).fill(() => '2').layer('page')]);
}
