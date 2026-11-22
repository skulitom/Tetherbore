// The logotype. Heavy letters cut from one hot slab; the O is the tether, a closed loop of light whose tail runs on
// under the R and the E to the drill at its end. Drawn at one pixel a pixel, in two lockups: on one line, and stacked.
import { PALETTE, Plate, clamp, paintDrill } from './kit.mjs';

const G = {
  T: ['############', '############', '############', '############', ...Array(12).fill('....####....')],
  E: ['###########', '###########', '###########', ...Array(3).fill('####.......'), '#########..', '#########..', '#########..', ...Array(4).fill('####.......'), '###########', '###########', '###########'],
  H: [...Array(6).fill('####....####'), '############', '############', '############', ...Array(7).fill('####....####')],
  R: ['##########..', '###########.', '############', '####....####', '####....####', '####....####', '####...#####', '###########.', '##########..', '#########...', '####.#####..', '####..#####.', '####...####.', '####...#####', '####....####', '####....####'],
  B: ['##########..', '###########.', '############', '####....####', '####....####', '####...####.', '##########..', '##########..', '###########.', '####....####', '####....####', '####....####', '####....####', '############', '###########.', '##########..'],
};
const HEIGHT = 16, GAP = 2, O_W = 14;
const widthOf = word => [...word].reduce((sum, c, i) => sum + (c === 'O' ? O_W : G[c][0].length) + (i ? GAP : 0), 0);

// The letter's face: a hot band from white at the top through gold to ember at the foot, its top edge lit and its
// lower edge in shade.
const face = (row, x, rows, gx) => {
  const t = row / (HEIGHT - 1), above = row > 0 && rows[row - 1][gx] === '#', below = row < HEIGHT - 1 && rows[row + 1][gx] === '#';
  if (!above) return 'w';
  if (!below) return 'j';
  if (t < 0.2) return 'o';
  if (t < 0.46) return 'n';
  if (t < 0.72) return (x + row) % 2 && t > 0.66 ? 'l' : 'm';
  return t < 0.86 ? 'l' : 'k';
};

function letters(p, word, ox, oy) {
  let x = ox, ring = null;
  for (const c of word) {
    if (c === 'O') { ring = { x, y: oy }; x += O_W + GAP; continue; }
    const rows = G[c];
    rows.forEach((row, j) => [...row].forEach((v, i) => { if (v === '#') p.set(x + i, oy + j, face(j, i, rows, i)); }));
    x += rows[0].length + GAP;
  }
  return { ring, end: x - GAP };
}

// The loop and its tail, ending in the drill. The tail leaves the foot of the loop along its curve, so the O reads as
// a lasso drawn shut and not as a ring on a stalk.
function loop(p, ring, tailTo, { L = 17, R = 4.2, drop = 0 } = {}) {
  const cx = ring.x + O_W / 2, cy = ring.y + HEIGHT / 2 + 1, rx = O_W / 2 + 0.5, ry = HEIGHT / 2 + 1.5, tailY = ring.y + HEIGHT + 1;
  for (let y = ring.y - 2; y <= ring.y + HEIGHT + 4; y++) for (let x = ring.x - 2; x <= ring.x + O_W + 2; x++) {
    const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, d = Math.hypot(u, v);
    const inner = Math.hypot((x + 0.5 - cx) / (rx - 4), (y + 0.5 - cy) / (ry - 4.2));
    if (d > 1 || inner < 1) continue;
    const band = clamp((d - (1 - 4 / rx)) / (4 / rx));
    p.set(x, y, band < 0.22 ? 'r' : band > 0.8 ? 'q' : (band < 0.6 ? 'w' : 's'));
  }
  for (let x = Math.round(cx); x < tailTo; x++) {
    p.set(x, tailY, 'r');
    p.set(x, tailY + 1, 'w');
    p.set(x, tailY + 2, (x - Math.round(cx)) % 6 < 2 ? 's' : 'q');
  }
  // the drill stands clear of the last letter, whose foot it would otherwise turn an E into an F
  paintDrill(p, tailTo + L / 2, tailY + 1.5 + drop, 0, L, R);
}

// The dark ground the word stands on: the letters grown, the slits between them closed, its holes filled, and dropped
// two pixels for weight. Solid, so that the mark holds on any picture and on a light page.
function backing(p) {
  const { w, h } = p, at = (x, y) => y * w + x;
  const grow = (src, r) => {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!src[at(x, y)]) continue;
      for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) if (a * a + b * b <= r * r + 1 && x + a >= 0 && y + b >= 0 && x + a < w && y + b < h) out[at(x + a, y + b)] = 1;
    }
    return out;
  };
  // (beyond the plate counts as empty, so the closing cannot leave the backing stuck to the plate's edge)
  const shrink = (src, r) => grow(src.map(v => 1 - v), r).map((v, i) => { const x = i % w, y = (i - x) / w; return x < r || y < r || x >= w - r || y >= h - r ? 0 : 1 - v; });
  const round = grow(Uint8Array.from(p.d, v => (v ? 1 : 0)), 2);
  const closed = shrink(grow(round, 2), 2);
  const solid = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (round[at(x, y)] || closed[at(x, y)] || (y >= 2 && (round[at(x, y - 2)] || closed[at(x, y - 2)]))) solid[at(x, y)] = 1;
  // small notches along a row are closed, so the edge runs clean over the O's overshoot
  for (let y = 0; y < h; y++) {
    let last = -1;
    for (let x = 0; x < w; x++) {
      if (!solid[at(x, y)]) continue;
      if (last >= 0 && x - last > 1 && x - last <= 6) for (let g = last + 1; g < x; g++) solid[at(g, y)] = 1;
      last = x;
    }
  }
  // what the outside cannot reach is a hole
  const open = new Uint8Array(w * h), stack = [];
  for (let x = 0; x < w; x++) stack.push([x, 0], [x, h - 1]);
  for (let y = 0; y < h; y++) stack.push([0, y], [w - 1, y]);
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h || open[at(x, y)] || solid[at(x, y)]) continue;
    open[at(x, y)] = 1;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  const back = new Plate(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!open[at(x, y)]) back.set(x, y, 'Z');
  return back;
}

const recipe = (name, w, h, plate) => ({
  version: 1, name, width: w, height: h, palette: PALETTE, animations: {},
  frames: [{ name: 'logo', layers: [backing(plate).layer('backing'), plate.layer('letters')] }],
});

// `compact` keeps the drill inside the word's width, for the small capsule.
export function logoWide({ compact = false } = {}) {
  const word = 'TETHERBORE', pad = 3, inner = widthOf(word), w = inner + (compact ? 3 : 17) + pad * 2, h = HEIGHT + 10 + pad * 2;
  const p = new Plate(w, h);
  const { ring, end } = letters(p, word, pad, pad + 1);
  if (compact) loop(p, ring, end - 12, { L: 13, R: 3, drop: 1 });
  else loop(p, ring, end);
  return recipe(compact ? 'logo-compact' : 'logo-wide', w, h, p);
}

export function logoStacked() {
  const top = 'TETHER', low = 'BORE', pad = 3, tw = widthOf(top), lw = widthOf(low);
  const w = tw + pad * 2 + 3, h = HEIGHT * 2 + 3 + 10 + pad * 2;
  const p = new Plate(w, h);
  letters(p, top, pad + 1, pad + 1);
  const { ring, end } = letters(p, low, pad + 1 + Math.floor((tw - lw) / 2) - 5, pad + 1 + HEIGHT + 3);
  loop(p, ring, end);
  return recipe('logo-stacked', w, h, p);
}
