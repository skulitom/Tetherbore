// Loads the sprite sheets Pixelbolt built (assets/atlas.json and its PNGs) and draws frames, animations and text.
import { tr, words } from './lang.js';

export const sheets = {};
const tints = new Map();

export async function loadAtlas(base = 'assets/') {
  const data = await (await fetch(`${base}atlas.json`)).json();
  await Promise.all(Object.entries(data).map(async ([name, sheet]) => {
    const image = new Image();
    // Waits on the load event, not decode(): a page opened in a background tab never finishes a decode.
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = base + sheet.image; });
    const animations = {};
    for (const [key, a] of Object.entries(sheet.animations)) {
      const frames = a.frames.map(f => sheet.frames[f]);
      animations[key] = { frames, loop: a.loop, duration: frames.reduce((t, f) => t + f[4], 0) };
    }
    sheets[name] = { ...sheet, image, animations };
  }));
  // Terrain sheets: frame rectangles by mask, then variant.
  for (const [name, sheet] of Object.entries(sheets)) {
    const first = Object.keys(sheet.frames)[0];
    if (!/-\d+-[a-z]$/.test(first)) continue;
    sheet.tiles = [];
    for (const [frame, rect] of Object.entries(sheet.frames)) {
      const mask = +frame.slice(name.length + 1).split('-')[0];
      (sheet.tiles[mask] ??= []).push(rect);
    }
  }
}

export function draw(ctx, sheet, frame, x, y) {
  const s = sheets[sheet], r = typeof frame === 'string' ? s.frames[frame] : frame;
  ctx.drawImage(s.image, r[0], r[1], r[2], r[3], Math.round(x), Math.round(y), r[2], r[3]);
}
export function drawScaled(ctx, sheet, frame, x, y, w, h) {
  const s = sheets[sheet], r = typeof frame === 'string' ? s.frames[frame] : frame;
  ctx.drawImage(s.image, r[0], r[1], r[2], r[3], Math.round(x), Math.round(y), w, h);
}
// The frame of an animation `time` milliseconds in; a one-shot returns null once it is over.
export function frameAt(sheet, animation, time) {
  const a = sheets[sheet].animations[animation];
  if (a.loop) time %= a.duration; else if (time >= a.duration) return null;
  for (const f of a.frames) { if (time < f[4]) return f; time -= f[4]; }
  return a.frames[a.frames.length - 1];
}
export const duration = (sheet, animation) => sheets[sheet].animations[animation].duration;

// A 9-slice of a 16 x 16 frame with `m` pixel margins.
export function slice9(ctx, sheet, frame, x, y, w, h, m = 5) {
  const s = sheets[sheet], [fx, fy, fw, fh] = s.frames[frame], c = fw - 2 * m;
  const xs = [[fx, m, x, m], [fx + m, c, x + m, w - 2 * m], [fx + fw - m, m, x + w - m, m]];
  const ys = [[fy, m, y, m], [fy + m, fh - 2 * m, y + m, h - 2 * m], [fy + fh - m, m, y + h - m, m]];
  for (const [sy, sh, dy, dh] of ys) for (const [sx, sw, dx, dw] of xs) if (dw > 0 && dh > 0) ctx.drawImage(s.image, sx, sy, sw, sh, dx, dy, dw, dh);
}

// A sheet in one colour, every pixel of it that has any (its alpha kept): made once for each sheet and colour, and
// kept by sheet and then by colour, so that asking for one made already makes nothing (motes ask every frame).
export function tinted(name, color) {
  let own = tints.get(name);
  if (!own) tints.set(name, own = new Map());
  let canvas = own.get(color);
  if (!canvas) {
    const { image } = sheets[name];
    canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = image.height;
    const c = canvas.getContext('2d');
    c.drawImage(image, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = color;
    c.fillRect(0, 0, canvas.width, canvas.height);
    own.set(color, canvas);
  }
  return canvas;
}
const fontIn = color => tinted('font', color);
// (Both say the line in the language chosen, js/lang.js: what is measured is what is drawn.)
export function textWidth(text, scale = 1) {
  const { glyphs } = sheets.font;
  let w = 0;
  for (const ch of tr(String(text))) w += ((glyphs[ch] ?? glyphs['?'])[1] + 1) * scale;
  return w - scale;
}
// Text broken into lines no wider than `wide` pixels, at the spaces: in the language chosen, turned whole before it
// is broken (and in Mandarin broken between characters: js/lang.js, `words`).
export const wrap = (said, wide) => {
  const lines = [], { parts, join } = words(tr(said));
  for (const word of parts) {
    const last = lines[lines.length - 1];
    if (last !== undefined && textWidth(`${last}${join}${word}`) <= wide) lines[lines.length - 1] = `${last}${join}${word}`; else lines.push(word);
  }
  return lines;
};
// Text in Pixelbolt's pixel font, with the Cyrillic capitals drawn for it and the Chinese characters the game says
// taken from Fusion Pixel (art/build.mjs): a glyph is [x, width, row of the sheet]. `align`: 0 left, 0.5 centre, 1
// right. A dark copy under it keeps it readable.
export function text(ctx, value, x, y, color = '#ffffff', align = 0, scale = 1, shadow = '#0c0a12') {
  value = tr(String(value));
  const { glyphs } = sheets.font;
  x = Math.round(x - textWidth(value, scale) * align); y = Math.round(y);
  for (const pass of shadow ? [shadow, color] : [color]) {
    const image = fontIn(pass), o = pass === shadow && shadow ? scale : 0;
    let cx = x;
    for (const ch of value) {
      const [gx, gw, gy = 0] = glyphs[ch] ?? glyphs['?'];
      if (ch !== ' ') ctx.drawImage(image, gx, gy, gw, 10, cx + o, y + o, gw * scale, 10 * scale);
      cx += (gw + 1) * scale;
    }
    if (pass === color) break;
  }
}
