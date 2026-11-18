// Text as the tests read it: a glyph at a time. js/atlas.js draws each copy of a line (its shadow, its colour) as one
// picture from a page of lines (`text`, `lineAt`); a test that reads what is drawn by the glyphs of the font's
// tinted copies wraps the drawImage it puts on a canvas in `asGlyphs`, and is given, for each such picture, the
// calls text() made for it when it drew a glyph at a time: the tinted font, the glyph's rectangle on it, where it
// was laid and how large, in the same order. Any other call is passed on as it is.
//   game.ctx.drawImage = asGlyphs((image, sx, sy, sw, sh, dx, dy, dw, dh) => { ... });
import { sheets, tinted, lineAt } from '../../../js/atlas.js';

export const asGlyphs = draw => function (image, sx, sy, sw, sh, dx, dy, dw, dh) {
  const line = arguments.length === 9 ? lineAt(image, sx, sy) : null;
  if (line === null) return draw.apply(this, arguments);
  const { glyphs } = sheets.font, font = tinted('font', line.colour), scale = dw / sw;
  let cx = dx;
  for (const ch of line.value) {
    const [gx, gw, gy = 0] = glyphs[ch] ?? glyphs['?'];
    if (ch !== ' ') draw.call(this, font, gx, gy, gw, 10, cx, dy, gw * scale, 10 * scale);
    cx += (gw + 1) * scale;
  }
};
