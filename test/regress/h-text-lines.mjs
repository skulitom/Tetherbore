// Text is drawn a line at a time, not a glyph at a time. Each copy of a line, its shadow and its colour, is one
// picture made once on a page of lines (js/atlas.js: `text`, `lineIn`) and drawn whole; the lab drew 580 glyphs a
// frame and the shop up to 424 before. Held here on the lab's notes (everything known), every tab of the shop, the
// menu, STATS and the chart, every row at its last level, at 180 by 320 and 360 by 640, each drawn for 20 frames:
//   - no glyph of the font's tinted copies is drawn on the game's canvas, in the first frame or after (only on a
//     page of lines, as a line is made);
//   - lines are drawn as pictures from the pages, many a frame;
//   - a panel that stands still makes its lines in its first frame and next to none after (a figure that counts,
//     the time, may make a few), and the pages stay within their bound (`linesKept`).
// It fails when text() is put back to drawing a glyph at a time.
//   node test/regress/h-text-lines.mjs
import '../harness.mjs';
const { sheets, linesKept } = await import('../../js/atlas.js');

// Know each tinted copy of the font as it is made: a canvas whose first picture is the font's whole sheet at 0, 0
// (js/atlas.js: `tinted`). Each canvas the game makes counts what is drawn on it from the font's copies.
let onPages = 0;
const make = document.createElement;
document.createElement = (...a) => {
  const c = make(...a), get = c.getContext;
  c.getContext = (...b) => {
    const ctx = get(...b), was = ctx.drawImage;
    ctx.drawImage = function (image, ...rest) {
      if (!c.drawn && image === sheets.font.image && rest.length === 2) c.font = true;
      c.drawn = true;
      if (image?.font) onPages++;
      return typeof was === 'function' ? was.call(this, image, ...rest) : undefined;
    };
    return ctx;
  };
  return c;
};
const { makeGame, UPGRADES, WORKS, MAPS, CORE } = await import('../harness.mjs');
const { TABS, LAB } = await import('../../js/shop.js');

const fails = [], check = (ok, what) => { if (!ok && fails.length < 20) fails.push(what); };
const game = await makeGame(7);
for (const u of [...UPGRADES, ...WORKS, ...MAPS, ...CORE]) game.S.lv[u.id] = u.values.length - 1;
LAB.forEach((e, i) => { game.S.lab[e.key] = 2 ** (i % 10); });
game.S.grit = 123456789;
// What the game's own canvas is given: glyphs from the font's copies, and pictures from the pages of lines.
let glyphs = 0, lines = 0;
game.ctx.drawImage = (image) => { if (image?.font) glyphs++; else if (image?.lines) lines++; };

const panels = [
  ['the lab', () => { game.shop = false; game.openLab(true, 'lab'); game.labRise = 1; }],
  ...TABS.map(t => [`the shop's ${t.id}`, () => { game.openLab(false); game.shop = true; game.shopRise = 1; game.shopTab = t.id; }]),
  ['the menu', () => { game.shop = false; game.openLab(true, 'menu'); game.labRise = 1; }],
  ['STATS', () => { game.shop = false; game.openLab(true, 'stats'); game.labRise = 1; }],
  ['the chart', () => { game.shop = false; game.openLab(true, 'chart'); game.labRise = 1; }],
];
let seen = 0;
for (const [w, h] of [[360, 640], [720, 1280]]) {
  game.resize(w, h, 1);
  for (const [name, open] of panels) {
    open();
    let first = 0, after = 0, made = 0;
    for (let f = 0; f < 20; f++) {
      glyphs = 0; lines = 0; const pages = onPages;
      game.update(1 / 60); game.render();
      if (f === 0) first = lines; else { after = Math.max(after, glyphs); made = Math.max(made, onPages - pages); }
      if (glyphs) check(false, `${name} at ${game.W} by ${game.H}: ${glyphs} glyphs drawn one at a time in frame ${f + 1}`);
      seen += lines;
    }
    check(first >= 20, `${name} at ${game.W} by ${game.H} drew ${first} lines as pictures in its first frame`);
    // (A line made is its glyphs laid on a page; still, a panel makes next to none after its first frame.)
    check(made <= 40, `${name} at ${game.W} by ${game.H} laid ${made} glyphs on the pages in a frame after its first`);
  }
}
const kept = linesKept();
check(seen > 1000 && kept.lines > 50 && kept.pages >= 1 && kept.pages <= 24, `the lines drawn (${seen}) and kept (${kept.lines} on ${kept.pages} pages) are not what drawing a line at a time keeps`);
check(onPages > 0, 'no glyph was laid on a page of lines: the font\'s copies were not known');

if (fails.length) { console.log(`FAIL h-text-lines: ${fails.join('; ')}`); process.exit(1); }
console.log(`ok h-text-lines: the lab, the shop's tabs, the menu, STATS and the chart draw their text a line at a time (${seen} lines over ${panels.length * 2 * 20} frames), never a glyph`);
