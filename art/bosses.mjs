// ------------------------------------------------------------------ the four lords at the ends (js/bosses.js)
// Each lord is drawn here a pose at a time in a frame of 48 by 48 (three cells), facing east, and turned to face
// west by the sheet (`-l`): a frame is `<key>-<pose>` and `<key>-<pose>-l`, the keys and the poses in the order
// js/bosses.js's BOSS table has them. As the creatures are (art/fauna.mjs), each is a fill alone ringed with its
// direction's own outline (`k`), lit from the upper left, its eyes the foe's eye (`e`, FOE_EYE) and nothing else
// that colour, and the build writes where each frame's eyes lie (`eyes`) and where its lamps lie (`lamps`, `g`:
// the pixels the game lays its light on) into the atlas beside the frames.
// They are not drawn a pixel at a time but painted by the few shapes below (shaded ovals, tubes along a curve, flat
// facets, lines) into rows of keys, which the sheet stamps as the creatures' rows are stamped. The shapes are fixed
// numbers, so the sheet is the same every build.
//
// What each must read as at the size of a phone, where a frame is about a thumb across:
//   the FROST WYRM (north): a pale serpent of ice plates rearing from its coil, a crest of ice spines down its back,
//     frost lit in its throat; it breathes with its jaw wide and rests coiled, gasping.
//   the MAGMA BEHEMOTH (south): a hulking beast of slag crust on four stumps, horned, a seam of fire down its back
//     that blazes as it crouches to charge and goes dark as it rests.
//   the SPORE MOTHER (west): a rooted fungal bulb under a spotted cap, a ring mouth ringed in eyes, its spores lit;
//     it gapes, lashes, and rests stretched taut toward where her tendril holds.
//   the CRYSTAL KING (east): a faceted monarch afloat, a crown of five lit spikes, blades for arms; he comes apart
//     into shards as he blinks, and rests cracked and dim, a spike of his crown gone (the shard he sheds).
import { FOE_EYE } from './fauna.mjs';

// The directions' own outlines, as the creatures and the ores have them.
export const OUTLINE = { lode: '#3a2414', ember: '#160c12', mire: '#1c1426', frost: '#22395a' };
const S = 48;

// ---------------------------------------------------------------- the painter
const blank = () => Array.from({ length: S }, () => new Array(S).fill('.'));
const put = (g, x, y, k) => { if (x >= 1 && y >= 1 && x <= S - 2 && y <= S - 2) g[y][x] = k; };
const at = (g, x, y) => (x >= 0 && y >= 0 && x < S && y < S ? g[y][x] : '.');
// Light from the upper left and a little in front: how lit a surface of normal (nx, ny, nz) is, -1 to 1.
const LIGHT = (() => { const l = [-0.55, -0.7, 0.55], n = Math.hypot(...l); return l.map(v => v / n); })();
const lit = (nx, ny, nz) => nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
// A ramp of keys, lightest first, picked by how lit.
const ramp = (keys, l) => keys[l > 0.62 ? 0 : l > 0.22 ? 1 : l > -0.2 ? 2 : 3] ?? keys[keys.length - 1];
// A shaded oval about (cx, cy), turned by `rot` radians; `keys` a ramp, or one key for a flat fill.
function oval(g, cx, cy, rx, ry, keys, rot = 0) {
  const c = Math.cos(rot), s = Math.sin(rot), R = Math.max(rx, ry) + 1;
  for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = (dx * c + dy * s) / rx, v = (-dx * s + dy * c) / ry, q = u * u + v * v;
    if (q > 1) continue;
    const nx = u * c - v * s, ny = u * s + v * c;
    put(g, x, y, keys.length === 1 ? keys : ramp(keys, lit(nx, ny, Math.sqrt(1 - q))));
  }
}
// A flat polygon (its corners as [x, y]), filled where a pixel's middle is inside it.
function poly(g, pts, key) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y++) for (let x = Math.floor(Math.min(...xs)); x <= Math.max(...xs); x++) {
    const px = x + 0.5, py = y + 0.5;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) put(g, x, y, key);
  }
}
// A line `w` pixels thick.
function line(g, x0, y0, x1, y1, key, w = 1) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
    if (w <= 1) put(g, Math.floor(x), Math.floor(y), key);
    else for (let v = -w; v <= w; v++) for (let u = -w; u <= w; u++) if (Math.hypot(u, v) <= w / 2) put(g, Math.floor(x + u), Math.floor(y + v), key);
  }
}
// A polyline through `pts`.
const lines = (g, pts, key, w = 1) => { for (let i = 1; i < pts.length; i++) line(g, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], key, w); };
// Points along a smooth curve through `pts` (Catmull-Rom), about a pixel apart, each with its way along (tx, ty).
function curve(pts) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 1.5));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1].slice());
  for (let i = 0; i < out.length; i++) {
    const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    out[i].push((b[0] - a[0]) / l, (b[1] - a[1]) / l);
  }
  return out;
}
// A tube along a curve, `r(u)` thick at the way along it (0 at its first point, 1 at its last), shaded round.
function tube(g, path, r, keys) {
  path.forEach(([x, y], i) => oval(g, x, y, r(i / (path.length - 1)), r(i / (path.length - 1)), keys));
}
// Rubble: the rock a lord breaks out of, a jagged band along the frame's foot from row `top`, with chips over it.
function rubble(g, top, seed) {
  let h = seed;
  const rnd = () => (h = (h * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let x = 2; x <= S - 3; x++) {
    const y0 = top + Math.round(2 * Math.sin(x * 0.7 + seed) + 1.5 * Math.sin(x * 1.9 + seed * 2));
    for (let y = y0; y <= S - 2; y++) put(g, x, y, y === y0 || rnd() < 0.15 ? 'r' : 's');
  }
  for (let n = 0; n < 7; n++) { const x = 4 + Math.floor(rnd() * 40), y = top - 2 - Math.floor(rnd() * 4); oval(g, x, y, 1.2, 1, 'rs'); }
}
const rows = g => g.map(row => row.join(''));

// ---------------------------------------------------------------- NORTH: the FROST WYRM
// Its body a tube of ice plates from the tail to the neck, spines of ice along its back, a long head with a brow,
// horns swept back and a jaw that opens on the frost in its throat (`g`).
function spines(g, path, r, from, to, every, side, glint = true) {
  for (let i = Math.floor(path.length * from); i < path.length * to; i += every) {
    const [x, y, tx, ty] = path[i], rr = r(i / (path.length - 1));
    let nx = ty, ny = -tx;                         // the side of the back
    if (side * ny > 0) { nx = -nx; ny = -ny; }
    const bx = x + nx * (rr - 0.5), by = y + ny * (rr - 0.5), len = 3.2 + rr * 0.35;
    poly(g, [[bx - tx * 1.6, by - ty * 1.6], [bx + tx * 1.4, by + ty * 1.4], [bx + nx * len - tx * 1.8, by + ny * len - ty * 1.8]], 'a');
    put(g, Math.floor(bx + nx * (len - 0.6) - tx * 1.6), Math.floor(by + ny * (len - 0.6) - ty * 1.6), glint && (i / every | 0) % 3 === 1 ? 'g' : 'f');
  }
}
// Plates across the tube: a darker seam every `every` pixels along it.
function plates(g, path, r, every) {
  for (let i = every; i < path.length - 2; i += every) {
    const [x, y, tx, ty] = path[i], rr = r(i / (path.length - 1)) - 0.8;
    for (let v = -rr; v <= rr; v += 0.5) {
      const px = Math.floor(x + ty * v), py = Math.floor(y - tx * v);
      if ('abc'.includes(at(g, px, py))) put(g, px, py, at(g, px, py) === 'a' ? 'b' : 'd');
    }
  }
}
// The head at (hx, hy), turned `rot` (0 looking east, less looking up), its jaw open `open` (0 shut to 1 wide).
function wyrmHead(g, hx, hy, rot, open, { eye = 2, frost = 0 } = {}) {
  const c = Math.cos(rot), s = Math.sin(rot), P = (u, v) => [hx + u * c - v * s, hy + u * s + v * c];
  // horns swept back
  const h1 = P(-3, -3), h2 = P(-11, -7), h3 = P(-1, -4), h4 = P(-8, -9);
  line(g, h1[0], h1[1], h2[0], h2[1], 'b', 2.2); line(g, h3[0], h3[1], h4[0], h4[1], 'a', 1.6);
  // the lower jaw, swung down by `open`
  const ja = rot + open * 0.65, jc = Math.cos(ja), js = Math.sin(ja), J = (u, v) => [hx - 2 * c + u * jc - v * js, hy + 2.5 * c + u * js + v * jc];
  const [jx, jy] = J(5, 0.5);
  if (open > 0) {
    // the mouth open: dark, the frost in its throat lit
    const m = [P(-2, 0.5), P(8.5, -0.5), J(10, 0.8), J(-1, 1)];
    poly(g, m, 'm');
    for (let n = 0; n < 3 + frost; n++) { const t = (n + 0.5) / (3 + frost), q = [m[0][0] + (m[1][0] + m[2][0]) / 2 * t - m[0][0] * t, m[0][1] + ((m[1][1] + m[2][1]) / 2 - m[0][1]) * t]; put(g, Math.floor(q[0]), Math.floor(q[1] + 0.5), 'g'); }
    // teeth of ice along the jaws
    for (let u = 1; u < 9; u += 2.5) { const a = P(u, 0.6), b = J(u + 0.5, 0.2); put(g, Math.floor(a[0]), Math.floor(a[1]), 'f'); put(g, Math.floor(b[0]), Math.floor(b[1]), 'f'); }
  }
  oval(g, jx, jy, 6.5, 2.2, 'bcd', ja);
  // the skull and snout
  const [sx, sy] = P(1, -1.5), [nx, ny] = P(7, -0.5);
  oval(g, sx, sy, 6, 4.2, 'abcd', rot);
  oval(g, nx, ny, 4.2, 2.6, 'abcd', rot);
  // the brow, the eye under it, a nostril
  const b0 = P(-1, -3.8), b1 = P(4.5, -2.8);
  line(g, b0[0], b0[1], b1[0], b1[1], 'd');
  const [ex, ey] = P(2.8, -1.6);
  put(g, Math.floor(ex), Math.floor(ey), 'e');
  if (eye > 1) put(g, Math.floor(ex) + 1, Math.floor(ey), 'e');
  const [qx, qy] = P(9.5, -1.6);
  put(g, Math.floor(qx), Math.floor(qy), 'd');
}
function wyrm(pose) {
  const g = blank();
  const neck = (u, a, b) => (u < 0.5 ? 1.2 + u * 2 * (a - 1.2) : a + (u - 0.5) * 2 * (b - a));
  const body = (pts, r, head, opts = {}) => {
    const path = curve(pts);
    tube(g, path, r, 'abcd');
    plates(g, path, r, 4);
    spines(g, path, r, opts.from ?? 0.15, opts.to ?? 0.92, 5, 1, opts.glint ?? true);
    if (head) wyrmHead(g, ...head);
    return path;
  };
  switch (pose) {
    case 'swim-a': case 'swim-b': {
      // a hump of its back breaking the rock, spines up
      const d = pose === 'swim-a' ? 0 : 3;
      rubble(g, 39, 3 + d);
      body([[3 + d, 46], [10 + d, 37], [20 + d, 31], [30 + d, 33], [38 + d, 40], [42 + d, 46]], u => 2.5 + 3.5 * Math.sin(Math.PI * u), null, { from: 0.1, to: 0.95 });
      rubble(g, 42, 5 + d);
      break;
    }
    case 'rise': {
      rubble(g, 38, 11);
      body([[20, 46], [21, 38], [24, 28], [27, 20], [31, 15]], u => 5 - u * 1.2, [35, 13, -0.35, 0], { from: 0.05, to: 0.95 });
      rubble(g, 42, 12);
      break;
    }
    case 'idle-a': case 'idle-b': {
      const b = pose === 'idle-a' ? 0 : 1;
      body([[4, 33], [7, 40], [15, 44], [25, 43], [31, 37], [29, 29 + b], [25, 22 + b], [27, 16 + b], [31, 13 + b]], u => neck(u, 5.5, 4.2), [35, 12 + b, -0.1, 0]);
      break;
    }
    case 'tell': {
      // rearing back, the jaw open on the lit frost
      body([[4, 34], [7, 41], [15, 44], [25, 43], [31, 37], [28, 29], [23, 22], [23, 15], [27, 11]], u => neck(u, 5.5, 4.2), [31, 10, -0.35, 0.8, { frost: 1 }]);
      break;
    }
    case 'act': {
      // thrust forward, breathing
      body([[3, 36], [7, 42], [16, 44], [26, 42], [30, 35], [29, 27], [30, 21], [33, 17]], u => neck(u, 5.5, 4.2), [37, 16, 0.05, 1, { frost: 3 }]);
      break;
    }
    case 'rest': {
      // coiled tight, its head down on its coil, gasping
      body([[33, 30], [36, 37], [31, 43], [20, 44], [10, 41], [7, 34], [11, 27], [19, 25], [26, 28], [28, 33]], u => (u < 0.3 ? 2 + u * 12 : 5.6), [33, 34, 0.15, 0.35, { eye: 1 }], { from: 0.3, to: 0.85, glint: false });
      break;
    }
    case 'hurt': {
      // flung back, its head up and away
      body([[5, 30], [6, 38], [13, 43], [23, 44], [30, 40], [31, 32], [27, 25], [22, 19], [21, 12]], u => neck(u, 5.5, 4.2), [23, 8, -1.0, 0.5, { eye: 1 }]);
      break;
    }
  }
  return g;
}

// ---------------------------------------------------------------- SOUTH: the MAGMA BEHEMOTH
// A barrel of slag crust on four stumps, its shoulders humped over a low head with a horn swept forward and a
// heavy jaw; a seam of fire (`g`, and `n` the embers either side of it) down its back from its rump to its brow.
// `crouch` lowers it, `lean` stretches it forward as it charges, `seam` is 0 dark (cooled), 1 lit, 2 blazing.
function behemoth(pose) {
  const g = blank();
  const beast = ({ dy = 0, lean = 0, crouch = 0, seam = 1, head = 0, legs = 'stand', eye = 2, jaw = 0 } = {}) => {
    const Y = v => v + dy + crouch;
    // the far legs, darker, behind
    const leg = (x, top, len, slant, keys) => { for (let v = 0; v < len; v++) { const w = v > len - 3 ? 3.4 : 2.8; oval(g, x + slant * v / len, Y(top) + v, w, 1.2, keys); } };
    const L = legs === 'stand' ? [0, 0, 0, 0] : legs === 'charge' ? [-5, 4, -3, 5] : legs === 'fold' ? [0, 0, 0, 0] : [0, 0, 6, 6];
    const len = legs === 'fold' ? 4 : legs === 'rear' ? 10 : 11 - crouch;
    leg(15 - lean, 33, len, L[0], 'cd');
    leg(31 + lean, 33, len - (legs === 'rear' ? 4 : 0), L[2], 'cd');
    // the body: the rump, the barrel, the hump of the shoulders
    oval(g, 13 - lean, Y(28), 9, 9, 'abcd');
    oval(g, 22, Y(29), 15 + lean, 10, 'abcd');
    oval(g, 29 + lean, Y(23) + (legs === 'rear' ? -3 : 0), 11, 10, 'abcd', legs === 'rear' ? -0.4 : 0);
    // the near legs
    leg(11 - lean, 34, len, L[1], 'bcd');
    leg(27 + lean, 34, len - (legs === 'rear' ? 4 : 0), L[3], 'bcd');
    // toes
    if (legs !== 'fold') for (const [x, s] of [[11 - lean, L[1]], [27 + lean, L[3] - (legs === 'rear' ? 2 : 0)]]) for (const u of [-2, 0, 2]) put(g, Math.floor(x + s + u), Y(34) + len - 1 - (legs === 'rear' && x > 20 ? 4 : 0), 'h');
    // the crust: plates parted by dark cracks
    const cracks = [[[8, 24], [12, 27], [10, 32]], [[17, 21], [19, 26], [16, 30], [18, 35]], [[24, 22], [26, 27], [24, 33]], [[31, 19], [33, 25], [31, 30]], [[36, 23], [38, 28]]];
    for (const c of cracks) {
      const pts = c.map(([x, y]) => [x + (x > 20 ? lean : -lean * 0.5), Y(y)]);
      lines(g, pts.map(([x, y]) => [x + 1, y - 1]), 'a');
      lines(g, pts, 'd');
    }
    // the head, low before the hump; the jaw; the horn; the brow and the eye
    const hx = 39 + lean * 1.4, hy = Y(29) + head;
    oval(g, hx + 1, hy + 4 + jaw, 5.5, 2.6, 'bcd');
    if (jaw) { line(g, hx - 2, hy + 3, hx + 5, hy + 3 + jaw, 'm', 2); }
    oval(g, hx, hy, 6, 5, 'abcd');
    oval(g, hx + 4, hy + 1.5, 3.2, 2.6, 'abcd');
    lines(g, [[hx - 2, hy - 3], [hx + 2, hy - 7], [hx + 6, hy - 8], [hx + 8, hy - 6]], 'h', 2.2);
    put(g, Math.floor(hx + 8), Math.floor(hy - 6), 'f');
    line(g, hx + 5, hy + 4.5, hx + 7.5, hy + 2, 'h', 1.4);
    line(g, hx - 1, hy - 2.5, hx + 4.5, hy - 1.5, 'd');
    put(g, Math.floor(hx + 2), Math.floor(hy - 1), 'e');
    if (eye > 1) put(g, Math.floor(hx + 3), Math.floor(hy - 1), 'e');
    // the seam down its back, from the rump to the brow
    const ridge = [[5 - lean, Y(25)], [9 - lean, Y(21)], [15, Y(20)], [21, Y(19) - 1], [27 + lean, Y(15) + (legs === 'rear' ? -3 : 0)], [33 + lean, Y(15) + (legs === 'rear' ? -4 : 0)], [hx - 3, hy - 4]];
    if (seam === 0) lines(g, ridge, 'n');
    else {
      lines(g, ridge, 'n', seam > 1 ? 3 : 2.4);
      lines(g, ridge, seam > 1 ? 'f' : 'n');
      // lit at its joints and between (blazing: all along)
      const path = curve(ridge);
      for (let i = 0; i < path.length; i += seam > 1 ? 3 : 5) put(g, Math.floor(path[i][0]), Math.floor(path[i][1]), 'g');
      if (seam > 1) for (const c of cracks) { const [x, y] = c[1]; put(g, x + (x > 20 ? lean : -lean * 0.5), Y(y), 'g'); }
    }
  };
  switch (pose) {
    case 'swim-a': case 'swim-b': {
      // its back, the seam lit, ploughing up through the rock
      const d = pose === 'swim-a' ? 0 : 2;
      rubble(g, 36, 2 + d);
      oval(g, 22 + d, 37, 17, 8, 'abcd');
      lines(g, [[9 + d, 35], [16 + d, 31], [24 + d, 30], [32 + d, 32], [37 + d, 35]], 'n', 2.4);
      for (const [x, y] of [[12 + d, 33], [20 + d, 30], [28 + d, 31], [35 + d, 34]]) put(g, x, y, 'g');
      rubble(g, 41, 4 + d);
      break;
    }
    case 'rise': rubble(g, 36, 9); beast({ dy: 4, legs: 'fold' }); rubble(g, 40, 10); break;
    case 'idle-a': beast(); break;
    case 'idle-b': beast({ dy: 1, head: 1 }); break;
    case 'tell': beast({ crouch: 3, seam: 2, head: 2 }); break;
    case 'act': beast({ lean: 3, seam: 2, head: 3, legs: 'charge', crouch: 1 }); break;
    case 'rest': beast({ dy: 3, seam: 0, head: 3, legs: 'fold', eye: 1, jaw: 1 }); break;
    case 'hurt': beast({ dy: 1, legs: 'rear', head: -5, eye: 1, jaw: 2, seam: 1 }); break;
  }
  return g;
}

// ---------------------------------------------------------------- WEST: the SPORE MOTHER
// A bulb of mauve flesh rooted in the ground, under a frilled cap of cream with lit spores (`g`); on its east side
// a ring mouth, lipped (`h`) and toothed (`f`), with the eyes round it.
function mother(pose) {
  const g = blank();
  const bulb = ({ dx = 0, dy = 0, rx = 13, ry = 12, cap = 0, gape = 0, lean = 0, taut = false, spores = 1, eyes = 5, roots = 'spread' } = {}) => {
    const cx = 22 + dx, cy = 29 + dy;
    // the roots, flaring from her foot into the floor like a tree's (dragged back as she rests taut)
    const ends = roots === 'spread' ? [[3, 46], [8, 45], [14, 46], [19, 46], [26, 46], [31, 46], [37, 45], [43, 46]] : [[1, 43], [4, 46], [9, 46], [15, 46], [21, 46], [27, 46], [32, 46], [37, 46]];
    ends.forEach(([ex, ey], n) => {
      const sx = cx - 8 + n * 16 / (ends.length - 1), sy = cy + ry - 2;
      const mx = sx + (ex - sx) * (taut ? 0.5 : 0.3), my = sy + (ey - sy) * (taut ? 0.5 : 0.8);
      tube(g, curve([[sx, sy], [mx, my], [ex, ey]]), u => 2.4 - u * 1.9, 'rstq');
    });
    // the bulb, its veins
    oval(g, cx, cy, rx, ry, 'abcd', lean);
    lines(g, [[cx - rx * 0.6, cy - ry * 0.3], [cx - rx * 0.3, cy + ry * 0.2], [cx - rx * 0.45, cy + ry * 0.75]], 'c');
    lines(g, [[cx - rx * 0.05, cy - ry * 0.45], [cx + rx * 0.1, cy + ry * 0.1], [cx - rx * 0.05, cy + ry * 0.8]], 'c');
    // the cap: a frilled dome, scalloped under, spotted with lit spores
    const kx = cx - 2 + lean * 6, ky = cy - ry + 2 - cap;
    oval(g, kx, ky, rx + 3, 6 + cap * 0.5, 'tuvw', lean * 0.6);
    for (let x = Math.ceil(kx - rx - 2); x <= kx + rx + 2; x += 3) oval(g, x, ky + 4 + cap * 0.3 + (x * 7 % 3) * 0.3, 1.4, 1.4, 'vw');
    const spots = [[-9, -2], [-4, -4], [2, -4], [7, -2], [-6, 1], [4, 1], [10, 1], [-1, -1]];
    spots.forEach(([u, v], n) => { const x = Math.floor(kx + u), y = Math.floor(ky + v); oval(g, x + 0.5, y + 0.5, 1.4, 1.2, 'w'); put(g, x, y, (n + spores) % 2 === 0 || spores > 1 ? 'g' : 'v'); });
    // the ring mouth on her east side, the eyes about it
    const mx = cx + rx * 0.55 + lean * 4, my = cy + 1, mrx = 3 + gape * 2, mry = taut ? 1.2 : 4 + gape * 3;
    oval(g, mx, my, mrx + 1.8, mry + 1.8, 'hhcd');
    oval(g, mx, my, mrx, mry, 'm');
    if (!taut) for (let a = 0; a < 12; a++) { const t = a / 12 * Math.PI * 2; put(g, Math.floor(mx + Math.cos(t) * (mrx - 0.3)), Math.floor(my + Math.sin(t) * (mry - 0.3)), a % 2 ? 'f' : 'm'); }
    if (gape > 0.5) for (let n = 0; n < 3; n++) put(g, Math.floor(mx - 1 + n), Math.floor(my), 'g');
    const R = Math.max(mrx, mry) + 4.2, around = [-2.3, -1.6, -0.9, 0.9, 1.6, 2.3, -0.2];
    for (let n = 0; n < eyes; n++) { const t = around[n]; put(g, Math.floor(mx + Math.cos(t) * (mrx + 3.6) - 0.5), Math.floor(my + Math.sin(t) * (mry + 3.4)), 'e'); }
  };
  switch (pose) {
    case 'swim-a': case 'swim-b': {
      // the crown of her cap through the rock, a spore or two loose over it
      const d = pose === 'swim-a' ? 0 : 1;
      rubble(g, 38, 6 + d);
      oval(g, 22, 40 - d, 15, 6, 'tuvw');
      for (const [x, y] of [[14, 38], [20, 36], [27, 37], [32, 39], [18, 40], [26, 40]]) put(g, x, y - d, 'g');
      for (const [x, y] of [[16, 30], [28, 28], [22, 25]]) put(g, x + d * 2, y - d * 2, 'g');
      rubble(g, 43, 8 + d);
      break;
    }
    case 'rise': rubble(g, 36, 13); bulb({ dy: 6, ry: 10, eyes: 5 }); rubble(g, 41, 14); break;
    case 'idle-a': bulb(); break;
    case 'idle-b': bulb({ rx: 13.5, ry: 12.5, dy: -0.5, spores: 2 }); break;
    case 'tell': bulb({ cap: 2, gape: 1, spores: 2, eyes: 7 }); break;
    case 'act': bulb({ dx: 2, gape: 1.2, lean: 0.12, spores: 2, eyes: 7 }); break;
    case 'rest': bulb({ dx: 3, rx: 15, ry: 10, dy: 2, lean: 0.08, taut: true, spores: 0, eyes: 5, roots: 'taut' }); break;
    case 'hurt': bulb({ rx: 11, ry: 11, dy: 2, cap: -1, lean: -0.2, eyes: 4 }); break;
  }
  return g;
}

// ---------------------------------------------------------------- EAST: the CRYSTAL KING
// A monarch of crystal afloat: a cut gem for a body, its facets flat and lit from the upper left (`f a b c d`),
// pauldrons of crystal, blades for arms, a gem head with a dark visor (`m`) and the eyes in it, and a crown of five
// spikes on a band (`h`) lit at their points (`g`). Below him, shards afloat.
function king(pose) {
  const g = blank();
  const lord = ({ dy = 0, arms = 'down', crown = 1, cracked = false, lost = false, tilt = 0, eyes = 2, shards = 0 } = {}) => {
    const cx = 24, cy = 27 + dy, c = Math.cos(tilt), s = Math.sin(tilt);
    const P = (x, y) => [cx + (x - 24) * c - (y - 27) * s, cy + (x - 24) * s + (y - 27) * c];
    const F = (pts, key) => poly(g, pts.map(([x, y]) => P(x, y)), key);
    // the arms, blades hung from the shoulders (raised as he tells, flung wide as he pulses)
    const arm = side => {
      const sx = 24 + side * 10, sy = 20;
      const tip = arms === 'down' ? [24 + side * 15, 38] : arms === 'up' ? [24 + side * 20, 12] : arms === 'wide' ? [24 + side * 22, 22] : [24 + side * 13, 40];
      const mid = [(sx + tip[0]) / 2 + side * 2, (sy + tip[1]) / 2];
      F([[sx, sy - 1], [mid[0] + side * 1.5, mid[1]], tip, [mid[0] - side * 1.5, mid[1] + 1]], side < 0 ? 'b' : 'c');
      F([[sx, sy - 1], [mid[0] + side * 1.5, mid[1]], tip], side < 0 ? 'a' : 'b');
    };
    arm(-1); arm(1);
    // the body: a gem cut to a point below
    const top = 19, mid = 28, low = 40;
    F([[16, top], [24, top - 1], [24, mid], [13, mid - 1]], 'a');
    F([[24, top - 1], [32, top], [35, mid - 1], [24, mid]], 'b');
    F([[13, mid - 1], [24, mid], [24, low + 2]], 'b');
    F([[24, mid], [35, mid - 1], [24, low + 2]], 'c');
    F([[19, mid + 2], [24, mid], [29, mid + 2], [24, low + 2]], 'd');
    lines(g, [P(24, top - 1), P(24, mid)], 'f');
    lines(g, [P(16, top), P(13, mid - 1)], 'f');
    // the pauldrons
    for (const side of [-1, 1]) {
      const x = 24 + side * 10;
      F([[x - 4, 21], [x - 2, 15], [x + side * 1, 13], [x + 2, 16], [x + 4, 21]], side < 0 ? 'a' : 'b');
      F([[x - 2, 15], [x + side * 1, 13], [x, 21]], side < 0 ? 'f' : 'a');
    }
    // the head: a gem with a dark visor, the eyes in it, looking east
    F([[19, 15], [21, 9], [24, 7], [24, 17]], 'a');
    F([[24, 7], [27, 9], [29, 15], [24, 17]], 'b');
    F([[19, 15], [24, 17], [29, 15], [24, 20]], 'c');
    F([[20, 12], [29, 11.4], [29, 13.6], [20, 14.2]], 'm');
    // the crown: a band and five spikes, lit at their points
    F([[19, 9], [29, 9], [28.5, 7], [19.5, 7]], 'h');
    const spikes = [[19.5, 1.3, 0.5], [22, 1, 2.5], [24.5, 1.2, 4.5], [27, 1, 2.5], [29.5, 1.3, 0.5]];
    spikes.forEach(([x, w, up], n) => {
      if (lost && n === 3) return;
      const tipY = 7 - (crown > 1 ? 3.6 : 2.8) - up * (crown > 1 ? 0.55 : 0.45);
      F([[x - w - 0.3, 7.2], [x + w + 0.3, 7.2], [x, tipY]], n < 2 ? 'a' : 'b');
      if (crown > 0) { const [tx, ty] = P(x, tipY + 1); put(g, Math.floor(tx), Math.floor(ty), 'g'); }
      if (crown > 1) { const [tx, ty] = P(x, tipY + 2.4); put(g, Math.floor(tx), Math.floor(ty), 'g'); }
    });
    if (lost) { const [x, y] = P(27, 6.5); put(g, Math.floor(x), Math.floor(y), 'd'); }
    // cracks across him
    if (cracked) {
      lines(g, [P(17, 21), P(20, 25), P(18, 29), P(21, 33)], 'd');
      lines(g, [P(30, 21), P(28, 26), P(31, 30)], 'd');
      lines(g, [P(23, 9), P(25, 12)], 'd');
    }
    if (eyes > 0) { const [ex, ey] = P(25, 12.5); put(g, Math.floor(ex), Math.floor(ey), 'e'); if (eyes > 1) put(g, Math.floor(ex) + 2, Math.floor(ey), 'e'); }
    // the shards afloat under him
    const under = [[18, 44 + shards], [30, 43 - shards], [24, 46]];
    for (const [x, y] of under) { const [px, py] = P(x, y); poly(g, [[px - 1.2, py], [px, py - 2.5], [px + 1.2, py], [px, py + 1.5]], 'b'); put(g, Math.floor(px), Math.floor(py - 1), 'a'); }
  };
  // Coming apart into shards (`u` how far): his own pixels cut in pieces of 3 by 3, some gone, the rest flung out
  // from his middle, some lit as they go.
  const scatter = (u, seed) => {
    const whole = g.map(r => r.slice());
    for (const row of g) row.fill('.');
    let h = seed;
    const rnd = () => (h = (h * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let by = 0; by < S; by += 3) for (let bx = 0; bx < S; bx += 3) {
      if (rnd() < u * 0.5) continue;
      const ox = Math.round((bx + 1 - 24) * u * 0.4 + (rnd() - 0.5) * 2 * u), oy = Math.round((by + 1 - 24) * u * 0.4 + (rnd() - 0.5) * 2 * u), bright = rnd() < u * 0.5;
      for (let y = by; y < by + 3; y++) for (let x = bx; x < bx + 3; x++) {
        const k = whole[y]?.[x];
        if (k && k !== '.') put(g, x + ox, y + oy, bright && 'bcd'.includes(k) ? 'a' : k);
      }
    }
  };
  switch (pose) {
    case 'blink-a': lord(); scatter(0.6, 5); break;
    case 'blink-b': lord({ eyes: 0 }); scatter(1, 9); break;
    case 'rise': lord({ crown: 1 }); scatter(0.3, 13); break;
    case 'idle-a': lord(); break;
    case 'idle-b': lord({ dy: 1, shards: 1 }); break;
    case 'tell': lord({ arms: 'up', crown: 2, shards: 1 }); break;
    case 'act': lord({ arms: 'wide', crown: 2 }); break;
    case 'rest': lord({ dy: 2, arms: 'droop', crown: 0, cracked: true, lost: true, eyes: 2 }); break;
    case 'hurt': lord({ tilt: -0.25, arms: 'wide', crown: 1, cracked: true, eyes: 1 }); break;
  }
  // (Eyes and lamps are what they are named only where they show: a scattered frame keeps them where they fell.)
  return g;
}

// ---------------------------------------------------------------- the lords and their colours
// Each lord's palette: `f a b c d` its body lightest to darkest, `m` the dark of its mouth or visor, `g` its lamps,
// `h` and `n` its own accents, `r s` the rock it breaks out of, `t u v w` and `q` the west's cap and roots. Its
// colours are kept dull (chroma under 64) where they need not be bright, and those that are bright are kept from
// the colours of what pays and hurts about its lair (test/regress/s9-boss-art.mjs).
// `hurt` is the same palette blanched, as a blow lands; `rest` the King's dimmed.
const ROCK = { r: '#4a4448', s: '#2c282c' };
export const LORDS_ART = [
  { key: 'king', look: 'lode', draw: king, poses: ['blink-a', 'blink-b', 'rise', 'idle-a', 'idle-b', 'tell', 'act', 'rest', 'hurt'],
    palette: { f: '#ffffff', a: '#e6e2f4', b: '#b8b0d4', c: '#857ca8', d: '#544a76', m: '#1a1230', g: '#fff8ff', h: '#d8ccac', ...ROCK } },
  { key: 'behemoth', look: 'ember', draw: behemoth, poses: ['swim-a', 'swim-b', 'rise', 'idle-a', 'idle-b', 'tell', 'act', 'rest', 'hurt'],
    palette: { f: '#f4eee4', a: '#8a7c7a', b: '#615456', c: '#433a3e', d: '#2a2228', m: '#120a0c', g: '#fff2dc', h: '#d4c8b4', n: '#b4846a', ...ROCK } },
  { key: 'mother', look: 'mire', draw: mother, poses: ['swim-a', 'swim-b', 'rise', 'idle-a', 'idle-b', 'tell', 'act', 'rest', 'hurt'],
    palette: { f: '#f8f0e6', a: '#dccad8', b: '#ae96ae', c: '#7e6684', d: '#54425e', m: '#2a1220', g: '#f4fad0', h: '#c494aa', t: '#efe4cc', u: '#cfc0a2', v: '#9a8a72', w: '#6a5e4e', r: '#7a6e54', s: '#584e3c', q: '#3a3428' } },
  { key: 'wyrm', look: 'frost', draw: wyrm, poses: ['swim-a', 'swim-b', 'rise', 'idle-a', 'idle-b', 'tell', 'act', 'rest', 'hurt'],
    palette: { f: '#ffffff', a: '#cfdcf0', b: '#8a9ec0', c: '#5a6c94', d: '#38446a', m: '#141c30', g: '#e8fbff', ...ROCK } },
];
// A colour taken `u` of the way to another.
const mix = (a, b, u) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - u) + parseInt(b.slice(i, i + 2), 16) * u).toString(16).padStart(2, '0')).join('');
const BODY = 'fabcdhntuvw';
const blanched = p => Object.fromEntries(Object.entries(p).map(([k, c]) => [k, BODY.includes(k) ? mix(c, '#ffffff', 0.45) : c]));
const dimmed = (p, to) => Object.fromEntries(Object.entries(p).map(([k, c]) => [k, BODY.includes(k) ? mix(c, to, 0.3) : c]));

// Every key a frame may use, so the sheet has them all (each frame sets its own).
const KEYS = Object.fromEntries([...'kabcdefghmnqrstuvw'].map(c => [c, '#000000']));

// The frames of the sheet, and where each frame's foe eyes and lamps lie in it.
const frames = [], symbols = {}, eyes = {}, lamps = {};
for (const art of LORDS_ART) {
  for (const pose of art.poses) {
    const g = art.draw(pose), symbol = `${art.key}-${pose}`;
    symbols[symbol] = rows(g);
    const palette = { ...(pose === 'hurt' ? blanched(art.palette) : pose === 'rest' && art.key === 'king' ? dimmed(art.palette, OUTLINE[art.look]) : art.palette), e: FOE_EYE, k: OUTLINE[art.look] };
    for (const left of [false, true]) {
      const name = `${symbol}${left ? '-l' : ''}`;
      frames.push({ name, duration: 200, palette, ops: [{ op: 'stamp', symbol, x: 0, y: 0, ...(left && { flipX: true }) }, { op: 'outline', color: 'k', position: 'outside' }] });
      const e = [], l = [];
      g.forEach((row, y) => row.forEach((k, x) => { if (k === 'e') e.push([left ? S - 1 - x : x, y]); if (k === 'g') l.push([left ? S - 1 - x : x, y]); }));
      if (e.length) eyes[name] = e;
      if (l.length) lamps[name] = l;
    }
  }
}
export const bosses = { version: 1, name: 'bosses', width: S, height: S, palette: KEYS, symbols, frames };
// (What the game reads of the sheet beside its frames, written into the atlas by art/build.mjs.)
export const BOSS_RECIPES = [[bosses, { eyes, lamps }]];
