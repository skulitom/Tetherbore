#!/usr/bin/env node
// Takes the Chinese characters the game says (js/words.js) out of Fusion Pixel's 10 pixel font and writes them to
// art/cjk.json, which art/build.mjs lays into the font's sheet beside Pixelbolt's own letters. Only the characters
// used are kept, so the build does not need the font, and this is run again only when the Mandarin changes:
//
//   node tools/cjk.mjs <fusion-pixel-10px-proportional-zh_hans.bdf>
//
// The font is Fusion Pixel Font by TakWolf (https://github.com/TakWolf/fusion-pixel-font), under the SIL Open Font
// License 1.1 (art/OFL-fusion-pixel.txt). A glyph is written as its width (the font's advance less the one pixel the
// game puts between letters) and ten rows of '#' and '.', laid on the game's line: Pixelbolt's capitals stand on
// the ninth row, so a character's baseline is there, and its ink is cut to the ten rows the line has.
import { readFileSync, writeFileSync } from 'node:fs';
import { WORDS } from '../js/words.js';
import { LANGS } from '../js/lang.js';

const file = process.argv[2];
if (!file) { console.error('node tools/cjk.mjs <fusion-pixel-10px-proportional-zh_hans.bdf>'); process.exit(1); }
const BASE = 8, ROWS = 10;

// Every character of the Mandarin column that is not Latin (the Latin is Pixelbolt's own).
const wanted = new Set();
// (And the names the menu gives the languages, each in its own tongue: js/lang.js.)
for (const said of [...WORDS.map(row => row[2]), ...LANGS.map(l => l.name)]) for (const ch of said) if (ch.codePointAt(0) > 0x7f && ch !== '×' && !/[\u0400-\u04ff]/.test(ch)) wanted.add(ch);

const glyphs = {}, lines = readFileSync(file, 'utf8').split(/\r?\n/);
for (let i = 0; i < lines.length; i++) {
  if (!lines[i].startsWith('ENCODING ')) continue;
  const ch = String.fromCodePoint(+lines[i].slice(9));
  if (!wanted.has(ch)) continue;
  let advance = 0, bbx = null, j = i + 1;
  for (; !lines[j].startsWith('BITMAP'); j++) {
    if (lines[j].startsWith('DWIDTH ')) advance = +lines[j].split(' ')[1];
    if (lines[j].startsWith('BBX ')) bbx = lines[j].split(' ').slice(1).map(Number);
  }
  const [w, h, xo, yo] = bbx, width = Math.max(1, advance - 1), rows = Array.from({ length: ROWS }, () => Array(width).fill('.'));
  for (let r = 0; r < h; r++) {
    const bits = parseInt(lines[j + 1 + r], 16), hexWidth = lines[j + 1 + r].length * 4, y = BASE - (yo + h) + r;
    for (let c = 0; c < w; c++) {
      const x = xo + c;
      if ((bits >> (hexWidth - 1 - c)) & 1 && y >= 0 && y < ROWS && x >= 0 && x < width) rows[y][x] = '#';
    }
  }
  // (A stop, a comma or a bracket is cut to its ink and a pixel after it: at full width each would take as much of a
  // phone's line as a character.)
  if (/[，。：；！？、（）]/.test(ch)) {
    const ink = [...Array(width).keys()].filter(x => rows.some(r => r[x] === '#')), from = ink[0], to = ink[ink.length - 1] + 2;
    glyphs[ch] = { width: to - from, rows: rows.map(r => r.slice(from, to).join('').padEnd(to - from, '.')) };
    continue;
  }
  glyphs[ch] = { width, rows: rows.map(r => r.join('')) };
}
const missing = [...wanted].filter(ch => !glyphs[ch]);
if (missing.length) { console.error(`not in the font: ${missing.join('')}`); process.exit(1); }
// (In the order of the characters, so the file and the sheet are the same for the same words.)
const sorted = Object.fromEntries(Object.keys(glyphs).sort().map(ch => [ch, glyphs[ch]]));
writeFileSync(new URL('../art/cjk.json', import.meta.url), JSON.stringify(sorted, null, 0).replace(/\},"/g, '},\n"') + '\n');
console.log(`${Object.keys(sorted).length} characters written to art/cjk.json`);
