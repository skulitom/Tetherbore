// The shop and the panel of what the drill is, on the narrowest phone (160 x 284 of the game's pixels: a phone 320
// CSS pixels wide) and on the common one (180 x 320): every line drawn lies within its panel, and no two things
// drawn on one line run into each other. For every tab, every level of every row (every row of a tab at once, each
// at that level or its last), with what the levels ask not yet found and found, and with nothing in hand and with
// everything: the words, the steps, what must be found (`lacks`, without its NEEDS where the line is too narrow
// for it), the prices and their icons, measured as the glyphs and icons are drawn. And STATS, with every row at its
// last level, every rare hazard and creature met, every shrine and fossil, and thousands of everything, fits above
// the bar a line a line, and says what the bit and the winch are.
//   node test/regress/h-shop-fit.mjs
import '../harness.mjs';

// Know each tinted copy of the font by the colour it was filled with.
const make = document.createElement;
document.createElement = () => { const c = make(); const ctx = c.getContext('2d'); c.getContext = () => new Proxy(ctx, { set: (t, k, v) => { if (k === 'fillStyle') c.tint = v; t[k] = v; return true; } }); return c; };
const { makeGame, B } = await import('../harness.mjs');
const { TABS, LAB, CORE } = await import('../../js/shop.js');
const { KINDS } = await import('../../js/fauna.js');
const { sheets, textWidth } = await import('../../js/atlas.js');

const fails = [], check = (ok, what) => { if (!ok && fails.length < 40) fails.push(what); };
const game = await makeGame(7), S = game.S;
// What is drawn while the shop (or the panel) is drawn: each glyph of the font's (its shadow left out) and each icon.
let drawing = false;
const glyphs = [], icons = [];
game.ctx.drawImage = (image, sx, sy, sw, sh, dx, dy, dw, dh) => {
  if (!drawing || dw === undefined) return;
  if (image?.tint && sh === 10 && sy === 0) { if (image.tint !== '#0c0a12') glyphs.push({ x: dx, y: dy, w: dw }); }
  else if (image === sheets.icons.image) icons.push({ x: dx, y: dy, w: dw, h: dh });
};
for (const name of ['drawShop', 'drawStats']) {
  const own = game[name];
  game[name] = function (...args) { drawing = true; try { return own.apply(this, args); } finally { drawing = false; } };
}
// Runs of glyphs, a line of text each (glyphs one or two pixels apart on one line), to say what ran over.
const runs = () => {
  const out = [];
  for (const g of [...glyphs].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const r = out[out.length - 1];
    if (r && r.y === g.y && g.x - (r.x + r.w) <= 4) r.w = g.x + g.w - r.x, r.n++; else out.push({ x: g.x, y: g.y, w: g.w, n: 1 });
  }
  return out;
};
// Two glyphs or a glyph and an icon that share pixels. (A glyph's ink is its rows 1 to 7.)
const meets = (a, b, bh = 7, bt = 1) => a.x < b.x + b.w && b.x < a.x + a.w && a.y + 1 < b.y + bt + bh && b.y + bt < a.y + 8;
const clashes = () => {
  let n = 0;
  for (let i = 0; i < glyphs.length; i++) for (let j = i + 1; j < glyphs.length; j++) if (meets(glyphs[i], glyphs[j])) n++;
  for (const g of glyphs) for (const c of icons) if (meets(g, c, c.h - 2, 1)) n++;
  return n;
};

// What has been found: nothing, or everything any level asks.
const found = all => {
  S.out = all ? 3000 : 0;
  S.lab = all ? Object.fromEntries(LAB.map(e => [e.key, 999])) : {};
  S.relics = [all, all, all, all].map(Boolean);
  // (Every corner's shrine and every fossil: STATS says them on a line of its own, and the lamp on the scanner's.)
  S.shrines = [all, all, all, all].map(Number); S.fossils = all ? 15 : 0;
  S.wrecks = all ? new Array(8).fill(1) : [];
  S.met = all ? Object.fromEntries(Array.from({ length: 40 }, (_, n) => [`place${n}`, 1])) : { crust: 1 };
  S.fauna = all ? { met: Object.fromEntries(Array.from({ length: KINDS }, (_, n) => [`kind${n}`, 1])), pal: { fed: 3 } } : undefined;
  game.recount();
};
const hold = rich => { S.grit = rich ? 1e13 : 0; for (let g = 1; g < 5; g++) { S.gems[g] = rich ? 1e9 : 0; S.spec[g] = rich ? 999 : 0; } };

let renders = 0;
for (const [cssW, cssH] of [[320, 568], [360, 640]]) {
  game.resize(cssW, cssH, 1);
  const { W, H } = game, pw = Math.min(W - 8, 200), px = Math.round((W - pw) / 2);
  for (const tab of TABS) {
    const most = Math.max(...tab.rows.map(u => u.values.length));
    for (let l = 0; l < most; l++) for (const [all, rich] of [[false, false], [true, false], [true, true]]) {
      for (const u of tab.rows) S.lv[u.id] = Math.min(l, u.values.length - 1);
      found(all); hold(rich); game.pending.grit = 0; game.pending.gems.fill(0);
      game.goal = undefined; game.bought = null; game.shopNote = null;
      game.shop = true; game.shopRise = 1; game.shopTab = tab.id; game.lab = false;
      glyphs.length = 0; icons.length = 0;
      game.render(); renders++;
      const at = `${W}x${H}, ${tab.name} at level ${l}, ${all ? 'all found' : 'nothing found'}, ${rich ? 'rich' : 'poor'}`;
      check(glyphs.length > 40, `${at}: only ${glyphs.length} glyphs were drawn`);
      for (const r of runs()) check(r.x >= px + 4 && r.x + r.w <= px + pw - 6, `${at}: a line of ${r.n} letters at y ${r.y} runs from x ${r.x} to ${r.x + r.w}, past the panel (${px + 4} to ${px + pw - 6})`);
      const n = clashes();
      check(n === 0, `${at}: ${n} glyphs run into another glyph or an icon`);
    }
  }
  // STATS, with everything there is.
  for (const u of TABS.flatMap(t => t.rows)) S.lv[u.id] = u.values.length - 1;
  found(true); hold(true); S.out = 2300; S.rare = { bell: 1, vent: 1, worm: 1, lodestone: 1 };
  game.shop = false; game.openLab(true, 'stats'); game.labRise = 1;
  glyphs.length = 0; icons.length = 0; game.render();
  const rows = game.stats(), pitch = game.statsPitch(rows.length), sw = Math.min(W - 8, 200), sx = Math.round((W - sw) / 2);
  check(rows.length <= 23 && 20 + rows.length * pitch + 8 <= H - 48, `${W}x${H}: STATS has ${rows.length} lines at ${pitch} pixels, which do not fit above the bar`);
  for (const r of runs()) check(r.x >= sx + 4 && r.x + r.w <= sx + sw - 4, `${W}x${H}: STATS has a line at y ${r.y} from x ${r.x} to ${r.x + r.w}, past the panel (${sx + 4} to ${sx + sw - 4})`);
  check(clashes() === 0, `${W}x${H}: in STATS a name runs into its value`);
  for (const [name, value] of rows) check(textWidth(name) + 4 + textWidth(value) <= sw - 16, `${W}x${H}: STATS's ${name} and '${value}' come within four pixels of each other`);
  check(new Set(rows.map(([name]) => name)).size === rows.length, `${W}x${H}: STATS names a line twice: ${rows.map(([name]) => name)}`);
  game.openLab(false);
  console.log(`${W}x${H}: STATS at its fullest is ${rows.length} lines of ${pitch} pixels: ${rows.map(([name, value]) => `${name} ${value}`).join(' | ')}`);
}

// The moment a level is bought, its new value stamped twice the size for the first frames: within the line, or
// at its own size where twice would run past it (TROPHY LINE's 2 SPEC on the narrowest phone ran off the screen).
// And STATS's REFINERY line at every level of the refinery and the gem cutter, not only their last, whose
// multiples are the only ones short enough to say in full on the narrowest phone.
for (const [cssW, cssH] of [[320, 568], [360, 640]]) {
  game.resize(cssW, cssH, 1);
  const { W, H } = game, pw = Math.min(W - 8, 200), px = Math.round((W - pw) / 2);
  found(true); hold(true);
  for (const tab of TABS) for (const u of tab.rows) for (let l = 1; l < u.values.length; l++) {
    for (const v of tab.rows) S.lv[v.id] = 0;
    S.lv[u.id] = l;
    game.goal = undefined; game.bought = null; game.shopNote = null;
    game.shop = true; game.shopRise = 1; game.shopTab = tab.id; game.lab = false;
    game.fitter.bought(game, u, l);
    glyphs.length = 0; icons.length = 0;
    game.render(); renders++;
    for (const r of runs()) check(r.x >= px + 4 && r.x + r.w <= px + pw - 6, `${W}x${H}: ${u.name} bought to level ${l}, a line of ${r.n} letters at y ${r.y} runs from x ${r.x} to ${r.x + r.w}, past the panel (${px + 4} to ${px + pw - 6})`);
  }
  game.fitter.moment.t = 0; game.shop = false;
  const sw = Math.min(W - 8, 200);
  for (let a = 0; a < CORE[0].values.length; a++) for (let b = 0; b < CORE[1].values.length; b++) {
    S.lv.refinery = a; S.lv.cutter = b;
    const [name, value] = game.stats().find(([name]) => name === 'REFINERY');
    check(textWidth(name) + 4 + textWidth(value) <= sw - 16, `${W}x${H}: STATS's ${name} and '${value}' come within four pixels of each other`);
  }
}

// What the bit and the winch are, said on their lines: the bit's cut, and from its sixth level its plough; the
// winch's load.
{
  const said = lv => { Object.assign(S.lv, lv); return Object.fromEntries(game.stats().map(([name, value]) => [name, value])); };
  const a = said({ drill: 3, winch: 2 }), b = said({ drill: 5, winch: 8 });
  check(a.BIT === 'MK4, CUTS x3.6' && a.WINCH === 'x1.6, LOAD 1000', `the bit at MK4 says '${a.BIT}' and the winch at x1.6 '${a.WINCH}'`);
  check(b.BIT === 'MK6, CUTS x6.5 PLOUGH' && b.WINCH === 'x5, LOAD 100K', `the bit at MK6 says '${b.BIT}' and the winch at its last '${b.WINCH}'`);
}
// Every row's `says` (and its `what`) fits the narrowest line by itself, as js/shop.js promises.
for (const u of TABS.flatMap(t => t.rows)) for (let l = 0; l < u.values.length - 1; l++) {
  const said = u.says?.(l) ?? u.what;
  check(textWidth(said) <= 160 - 8 - 31, `${u.name} at level ${l} says '${said}', ${textWidth(said)} pixels: wider than the narrowest phone's line`);
}
check(CORE.length === 6 && TABS.every(t => t.rows.length <= 6), `a tab has more than the six rows the panel is made for: ${TABS.map(t => t.rows.length)}`);

console.log(`${renders} pictures of the shop`);
if (fails.length) { console.log(`FAIL (${fails.length}):\n  ${fails.join('\n  ')}`); process.exit(1); }
console.log('ok: every line of the shop and of STATS lies within its panel, and nothing drawn on a line runs into anything else');
