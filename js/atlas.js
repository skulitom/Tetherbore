// Loads the sprite sheets Pixelbolt built (assets/atlas.json and its PNGs) and draws frames, animations and text.
import { tr, words } from './lang.js';

export const sheets = {};
const tints = new Map();

// The atlas as the site is built (tools/build-dist.mjs) is written compact: a sheet's frames as a list of their names,
// the sheet's own name and a hyphen taken off the front of each where every one has them (`p`), and their rectangles
// in one flat list, five numbers a frame (`r`); and an animation of every frame in order, as most sheets' 'default'
// is, as `all`. Made again here into the very object the art build wrote (assets/atlas.json, which the repository
// keeps as it is: the art build, the tools and the tests read it): the same keys, in the same order. A sheet written
// out in full is left as it is.
export function expandAtlas(data) {
  for (const [name, sheet] of Object.entries(data)) {
    const f = sheet.frames;
    if (!Array.isArray(f.n) || !f.n.every(n => typeof n === 'string')) continue;
    const frames = {}, pre = f.p ? `${name}-` : '';
    for (let i = 0; i < f.n.length; i++) frames[pre + f.n[i]] = f.r.slice(i * 5, i * 5 + 5);
    sheet.frames = frames;
    for (const key in sheet.animations) if (sheet.animations[key].all) sheet.animations[key] = { frames: Object.keys(frames), loop: sheet.animations[key].loop };
  }
  return data;
}

export async function loadAtlas(base = 'assets/') {
  const data = expandAtlas(await (await fetch(`${base}atlas.json`)).json());
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
// (Both say the line in the language chosen, js/lang.js: what is measured is what is drawn. A line's width is kept
// once measured, by the line as it is drawn, `WIDE`, emptied whole once it holds 4,096.)
const WIDE = new Map();
export function textWidth(text, scale = 1) {
  const said = tr(String(text));
  if (scale !== (scale | 0)) return widthOf(said, scale);
  let w = WIDE.get(said);
  if (w === undefined) { if (WIDE.size >= 4096) WIDE.clear(); WIDE.set(said, w = widthOf(said, 1)); }
  return (w + 1) * scale - scale;
}
function widthOf(said, scale) {
  const { glyphs } = sheets.font;
  let w = 0;
  for (const ch of said) w += ((glyphs[ch] ?? glyphs['?'])[1] + 1) * scale;
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
// right. A dark copy under it, `scale` pixels down and across, keeps it readable.
//
// Each copy of a line, the shadow's and the colour's, is one picture of its glyphs at the font's own size, a pixel
// apart as they are drawn, made once (`lineIn`) and drawn whole, `scale` times as large, where the glyphs were drawn
// one at a time: a call a copy, where the lab made 580 a frame and the shop 328. What it lays is what they laid. The
// glyphs of a line never overlap, and every place and size is a whole pixel; the canvases text is drawn on draw
// pictures unsmoothed: the game's (Game.resize turns smoothing off whenever its size is set, and what turns it on,
// the dark, the edges' haze and the lamp, turns it off again before it is done; the tether's canvas and the pieces'
// own have no text) and the tests' stand-ins alike; and text is laid only over what is there (source-over: nothing
// draws it under any other way), so the blank pixel between two glyphs lays nothing. A line faded (globalAlpha) is
// faded alike, its shadow and its colour drawn apart as before. Where the shadow is the colour itself the loop drew
// one copy only, the shadow's, `scale` down and across, and so does this. A size not whole (none is drawn so) and a
// line too long for a page are drawn a glyph at a time, as they were.
export function text(ctx, value, x, y, color = '#ffffff', align = 0, scale = 1, shadow = '#0c0a12') {
  value = tr(String(value));
  const e = scale === (scale | 0) && scale > 0 ? lineIn(value, shadow ? shadow : color) : null;
  if (e !== null) {
    x = Math.round(x - e.aw * scale * align); y = Math.round(y);
    if (!shadow) { if (e.ink) ctx.drawImage(e.page, e.sx, e.sy, e.w, 10, x, y, e.w * scale, 10 * scale); return; }
    if (e.ink) ctx.drawImage(e.page, e.sx, e.sy, e.w, 10, x + scale, y + scale, e.w * scale, 10 * scale);
    if (shadow === color) return;
    const c = lineIn(value, color);
    if (c.ink) ctx.drawImage(c.page, c.sx, c.sy, c.w, 10, x, y, c.w * scale, 10 * scale);
    return;
  }
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
// The pictures of lines, kept on the rows of pages: canvases PAGE_W wide of PAGE_ROWS rows, each ROW_H tall (a
// line's 10 and a pixel between), made as they are wanted and PAGES at the most. A line is laid on the row last laid
// on, from the left, a pixel after the line before it; where that row has no room, on a row never laid on, else on a
// new page, else on the row drawn from least lately, emptied first and every line on it forgotten, to be made again
// if it is asked for again. So a line that changes every frame (the grit counting home, a timer) takes room a frame
// and the oldest gives it back, and the pages never grow past PAGES. A line is found by its colour and then by
// itself (`LINES`), so finding one made already builds no key and makes nothing. (`w`: the width of its picture;
// `aw`: its width as textWidth says it, which turns the line again as text() turned it, so it is set where it was;
// `ink`: whether it has a glyph that is not a space.)
const PAGE_W = 512, PAGE_ROWS = 6, ROW_H = 11, PAGES = 24;
const LINES = new Map(), pages = [];
let lineTick = 0, laying = null;
function lineIn(value, colour) {
  let own = LINES.get(colour);
  if (own === undefined) LINES.set(colour, own = new Map());
  const e = own.get(value);
  if (e !== undefined) { e.row.used = ++lineTick; return e; }
  const { glyphs } = sheets.font;
  let w = -1, ink = false;
  for (const ch of value) { w += (glyphs[ch] ?? glyphs['?'])[1] + 1; if (ch !== ' ') ink = true; }
  if (w + 1 > PAGE_W) return null;
  const row = rowFor(w + 1), made = { page: row.page.canvas, sx: row.fill, sy: row.y, w, aw: textWidth(value, 1), ink, row, value, colour };
  if (ink) {
    const image = fontIn(colour), c = row.page.ctx;
    let cx = made.sx;
    for (const ch of value) {
      const g = glyphs[ch] ?? glyphs['?'];
      if (ch !== ' ') c.drawImage(image, g[0], g[2] === undefined ? 0 : g[2], g[1], 10, cx, made.sy, g[1], 10);
      cx += g[1] + 1;
    }
  }
  row.fill += w + 1; row.lines.push(made); row.used = ++lineTick;
  // (The row emptied for it may have held the last line of this colour, and the colour gone with it.)
  if (LINES.get(colour) !== own) LINES.set(colour, own);
  own.set(value, made);
  return made;
}
function rowFor(w) {
  if (laying !== null && laying.fill + w <= PAGE_W) return laying;
  for (let p = 0; p < pages.length; p++) for (const r of pages[p].rows) if (r.fill === 0 && r !== laying) return laying = r;
  if (pages.length < PAGES) {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_W; canvas.height = PAGE_ROWS * ROW_H;
    const page = { canvas, ctx: canvas.getContext('2d'), rows: [] };
    for (let n = 0; n < PAGE_ROWS; n++) page.rows.push({ page, y: n * ROW_H, fill: 0, used: 0, lines: [] });
    canvas.lines = page;
    pages.push(page);
    return laying = page.rows[0];
  }
  let old = null;
  for (const p of pages) for (const r of p.rows) if (old === null || r.used < old.used) old = r;
  for (const l of old.lines) { const own = LINES.get(l.colour); own.delete(l.value); if (!own.size) LINES.delete(l.colour); }
  old.lines.length = 0; old.fill = 0;
  old.page.ctx.clearRect(0, old.y, PAGE_W, ROW_H);
  return laying = old;
}
// What a picture drawn from (sx, sy) of `image` is, where `image` is a page of lines: the line, { value, colour, w,
// ... }, else null. The tests read what is drawn as the glyphs it is (test/regress/lib/glyphs.mjs).
export function lineAt(image, sx, sy) {
  const page = image?.lines;
  if (!page || !Array.isArray(page.rows)) return null;
  return page.rows[Math.floor(sy / ROW_H)]?.lines.find(l => l.sx === sx) ?? null;
}
// (How many pictures of lines are kept, and on how many pages: test/regress/h-text-lines.mjs.)
export const linesKept = () => ({ pages: pages.length, lines: pages.reduce((n, p) => n + p.rows.reduce((m, r) => m + r.lines.length, 0), 0) });
