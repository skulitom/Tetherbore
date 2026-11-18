// The shop and the panel of what the drill is, on the narrowest phone (160 x 284 of the game's pixels: a phone 320
// CSS pixels wide) and on the common one (180 x 320): every line drawn lies within its panel, and no two things
// drawn on one line run into each other. For every tab, every level of every row (every row of a tab at once, each
// at that level or its last), with what the levels ask not yet found and found, and with nothing in hand and with
// everything: the words, the steps, what must be found (with its NEEDS in every row or in none, as the widest
// fits the line), the prices and their icons, measured as the glyphs and icons are drawn, each line ending on the
// rows' right column (UI.INSET in from the row's box) and lying inside its row's fill, its lines clear of one
// another (Mandarin's two a row, a row in from the rim). The reach's row says GROUND SPENT within its line. And
// STATS, with every row at its last level, every rare hazard and creature met, every shrine and fossil, and
// thousands of everything, fits above the bar a line a line, and says what the bit and the winch are.
// The eight levels paid in a corner's gems (js/shop.js: LATE) are among them, short of their gems and not: where
// they are had is said whole where it fits the line and short where it does not (GEM_SHORT: the Russian of the north
// east is too wide for the narrowest phone), and the footer's note of a tap refused for want of them too. And the
// bar at the foot of the screen, with the corners' gems in the directions' places (`cornerBar`: a corner's level
// saved for) and with all eight on a screen 330 wide, at the widest figures a count can have there ('9.9K', and
// '999K' with all eight): each gem's icon is its own, and no figure runs into the next icon or off the bar; and at
// the widest figure there is, '999K' or '987M', on the narrowest phones and with all eight, the same holds, each
// icon and figure at the same height.
//   node test/regress/h-shop-fit.mjs
import '../harness.mjs';

// Know each tinted copy of the font by the colour it was filled with.
const make = document.createElement;
document.createElement = () => { const c = make(); const ctx = c.getContext('2d'); c.getContext = () => new Proxy(ctx, { set: (t, k, v) => { if (k === 'fillStyle') c.tint = v; t[k] = v; return true; } }); return c; };
const { makeGame, B } = await import('../harness.mjs');
const { TABS, LAB, CORE, ROWS } = await import('../../js/shop.js');
const { GEM_ICON, GEM_SHORT, compact } = await import('../../js/drawing.js');
const { KINDS } = await import('../../js/fauna.js');
const { sheets, textWidth } = await import('../../js/atlas.js');
const { lang, tr } = await import('../../js/lang.js');

const fails = [], check = (ok, what) => { if (!ok && fails.length < 40) fails.push(what); };
const game = await makeGame(7), S = game.S;
// What is drawn while the shop (or the panel) is drawn: each glyph of the font's (its shadow left out) and each icon.
// (And, apart, what the rest of the HUD draws, the bar among it, with each icon's place on its sheet.)
let drawing = false, hud = false;
const glyphs = [], icons = [], hudGlyphs = [], hudIcons = [];
game.ctx.drawImage = (image, sx, sy, sw, sh, dx, dy, dw, dh) => {
  if (!(drawing || hud) || dw === undefined) return;
  const [g, c] = drawing ? [glyphs, icons] : [hudGlyphs, hudIcons];
  if (image?.tint && sh === 10 && sy % 10 === 0) { if (image.tint !== '#0c0a12') g.push({ x: dx, y: dy, w: dw }); }
  else if (image === sheets.icons.image) c.push({ x: dx, y: dy, w: dw, h: dh, sx, sy });
};
for (const name of ['drawShop', 'drawStats']) {
  const own = game[name];
  game[name] = function (...args) { drawing = true; try { return own.apply(this, args); } finally { drawing = false; } };
}
{
  const own = game.drawHud;
  game.drawHud = function (...args) { hud = true; try { return own.apply(this, args); } finally { hud = false; } };
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
const clashes = (gs = glyphs, cs = icons) => {
  let n = 0;
  for (let i = 0; i < gs.length; i++) for (let j = i + 1; j < gs.length; j++) if (meets(gs[i], gs[j])) n++;
  for (const g of gs) for (const c of cs) if (meets(g, c, c.h - 2, 1)) n++;
  return n;
};

// Where the shop's panel and rows are on a screen H tall (js/drawing.js, `drawShop`, risen): six rows of 32, the
// header over them and the footer under them, 4 from the top at the least.
const shopAt = H => {
  const most = Math.max(...TABS.map(t => t.rows.length)), rh = Math.max(24, Math.min(32, Math.floor((H - 92) / most))), ph = 20 + rh * most + 14;
  return { most, rh, ph, py: Math.max(4, Math.round((H - 44 - ph) / 2)) };
};
// Each row's lines as its glyphs lie, in the language spoken: every glyph's ink and shadow inside the row box's
// fill, clear of its rim (a capital's ink from its cell's row 1 and its shadow on row 8; a Mandarin character's
// from row 0, its shadow on row 9), and so every icon's (ink rows 0 to 8); and no two lines of a row that share a
// column so near that one's ink touches the other's shadow (9 rows apart, and 10 for Mandarin, whose lines then
// abut).
const zh = lang === 'zh', inkTop = zh ? 0 : 1, inkFoot = zh ? 9 : 8, pitch = zh ? 10 : 9;
const rowLines = (at, H, n) => {
  const { rh, py } = shopAt(H);
  for (let k = 0; k < n; k++) {
    const y0 = py + 20 + k * rh, own = glyphs.filter(g => g.y >= y0 - 2 && g.y < y0 + rh - 2 && g.w <= 12), marks = icons.filter(c => c.y >= y0 && c.y < y0 + rh);
    for (const g of own) check(g.y + inkTop >= y0 + 2 && g.y + inkFoot <= y0 + rh - 4, `${at}: row ${k + 1} has a glyph at y ${g.y}, on its rim (its fill ${y0 + 2} to ${y0 + rh - 4})`);
    for (const c of marks) check(c.y >= y0 + 2 && c.y + 8 <= y0 + rh - 4, `${at}: row ${k + 1} has an icon at y ${c.y}, on its rim (its fill ${y0 + 2} to ${y0 + rh - 4})`);
    for (const a of own) for (const b of own) if (a.y < b.y && a.x < b.x + b.w && b.x < a.x + a.w) check(b.y - a.y >= pitch, `${at}: row ${k + 1} has lines at y ${a.y} and ${b.y}, ${b.y - a.y} apart where they share columns (${pitch} at the least)`);
  }
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
// (The corners' gems as well as the directions': the levels paid in them are drawn short of them and not.)
const hold = rich => { S.grit = rich ? 1e13 : 0; for (let g = 1; g < 9; g++) S.gems[g] = rich ? 1e9 : 0; for (let g = 1; g < 5; g++) S.spec[g] = rich ? 999 : 0; };

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
      for (const r of runs()) check(r.x >= px + 4 && r.x + r.w <= px + pw - 8, `${at}: a line of ${r.n} letters at y ${r.y} runs from x ${r.x} to ${r.x + r.w}, past the rows' column (${px + 4} to ${px + pw - 8})`);
      const n = clashes();
      check(n === 0, `${at}: ${n} glyphs run into another glyph or an icon`);
      rowLines(at, H, tab.rows.length);
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
    for (const r of runs()) check(r.x >= px + 4 && r.x + r.w <= px + pw - 8, `${W}x${H}: ${u.name} bought to level ${l}, a line of ${r.n} letters at y ${r.y} runs from x ${r.x} to ${r.x + r.w}, past the rows' column (${px + 4} to ${px + pw - 8})`);
  }
  game.fitter.moment.t = 0; game.shop = false;
  const sw = Math.min(W - 8, 200);
  for (let a = 0; a < CORE[0].values.length; a++) for (let b = 0; b < CORE[1].values.length; b++) {
    S.lv.refinery = a; S.lv.cutter = b;
    const [name, value] = game.stats().find(([name]) => name === 'REFINERY');
    check(textWidth(name) + 4 + textWidth(value) <= sw - 16, `${W}x${H}: STATS's ${name} and '${value}' come within four pixels of each other`);
  }
}

// The reach's row where the ground it reaches is spent (`groundLeft` none), at every level from the third to the
// last but one, with nothing found and everything, with nothing in hand and everything: it says GROUND SPENT within
// its line, in the language spoken (ЗЕМЛЯ ВЫРАБОТАНА: СКИДКА ran off the narrowest phone), and the rows still hold.
for (const [cssW, cssH] of [[320, 568], [360, 640]]) {
  game.resize(cssW, cssH, 1);
  const { W, H } = game, pw = Math.min(W - 8, 200), px = Math.round((W - pw) / 2), reach = TABS[0].rows.find(u => u.id === 'tether');
  game.groundLeft = () => 0;
  for (let l = 2; l <= 8; l++) for (const [all, rich] of [[false, false], [true, false], [true, true]]) {
    for (const u of TABS[0].rows) S.lv[u.id] = 0;
    S.lv.tether = l; found(all); hold(rich); game.pending.grit = 0; game.pending.gems.fill(0);
    game.goal = undefined; game.bought = null; game.shopNote = null;
    game.shop = true; game.shopRise = 1; game.shopTab = 'rig'; game.lab = false;
    glyphs.length = 0; icons.length = 0;
    game.render(); renders++;
    const at = `${W}x${H}, the reach at level ${l} with its ground spent, ${all ? 'all found' : 'nothing found'}, ${rich ? 'rich' : 'poor'}`;
    check(game.cost(reach)?.grit === 1, `${at}: the next reach costs ${game.cost(reach)?.grit}, not next to nothing`);
    // (Said on the row's second or third line; in Mandarin, which has two, NEEDS takes its place where more must be
    // found first.)
    const said = [...tr('GROUND SPENT: CHEAPER')].filter(ch => ch !== ' ').length, { rh, py } = shopAt(H), y0 = py + 20 + TABS[0].rows.indexOf(reach) * rh;
    const lines = [...new Set(glyphs.filter(g => g.y > y0 + 4 && g.y < y0 + rh).map(g => g.y))];
    if (!zh || !game.lacks(reach)) check(lines.some(y => glyphs.filter(g => g.y === y).length === said), `${at}: GROUND SPENT was not said on the reach's row`);
    for (const r of runs()) check(r.x >= px + 4 && r.x + r.w <= px + pw - 8, `${at}: a line of ${r.n} letters at y ${r.y} runs from x ${r.x} to ${r.x + r.w}, past the rows' column (${px + 4} to ${px + pw - 8})`);
    check(clashes() === 0, `${at}: a glyph runs into another glyph or an icon`);
    rowLines(at, H, TABS[0].rows.length);
  }
  delete game.groundLeft;
  game.shop = false;
}

// The levels paid in a corner's gems, each tapped with too few of them in hand and all else found: the footer says
// where they are had, whole or short, within the panel; and that level, now saved for, puts the corners' gems on
// the bar in the directions' places (at their widest, '9.9K'), each with its own icon, clear of the next and on the
// bar. And on a screen 330 wide the bar has all eight, at '999K'; and at '999K' and '987M' on the narrowest phones
// and with all eight, every figure and icon is on the bar, clear of the next.
const moved = ROWS.flatMap(u => (u.gemAt ?? []).map((gem, l) => [u, l, gem]).filter(([, , gem]) => gem >= 5));
check(moved.length === 8, `${moved.length} levels are paid in a corner's gems, not eight`);
const bar = (W, H, at) => {
  // (A figure at its icon's own height: js/drawing.js, UI.ICON_DY.)
  const row = hudGlyphs.filter(g => g.y === H - 44 + 17), marks = hudIcons.filter(c => c.y === H - 44 + 17);
  check(row.length > 0, `${at}: no figure was drawn on the bar's gems' line, at the height of their icons`);
  for (const g of [...row, ...marks]) check(g.x >= 6 && g.x + g.w <= W - 6, `${at}: a figure or an icon on the bar's gems runs from ${g.x} to ${g.x + g.w}, off the bar (6 to ${W - 6})`);
  check(clashes(row, marks) === 0, `${at}: a figure on the bar's gems runs into another or into an icon`);
  return marks.map(c => Object.entries(sheets.icons.frames).find(([, f]) => f[0] === c.sx && f[1] === c.sy)?.[0]);
};
for (const [cssW, cssH] of [[320, 568], [360, 640]]) {
  game.resize(cssW, cssH, 1);
  const { W, H } = game, pw = Math.min(W - 8, 200), px = Math.round((W - pw) / 2);
  // (Where the footer's line is: js/drawing.js, `drawShop`, risen.)
  const { rh, ph, py } = shopAt(H), foot = py + ph - 13;
  for (const [u, l, gem] of moved) {
    for (const v of TABS.flatMap(t => t.rows)) S.lv[v.id] = 0;
    S.lv[u.id] = l; found(true); hold(true);
    for (let g = 5; g < 9; g++) S.gems[g] = 9999;
    game.pending.grit = 0; game.pending.gems.fill(0);
    game.goal = undefined; game.bought = null; game.shopNote = null; game.banner = null; game.notice = null; game.place = null;
    game.shop = true; game.shopRise = 1; game.shopTab = TABS.find(t => t.rows.includes(u)).id; game.lab = false;
    game.buy(u);
    glyphs.length = 0; icons.length = 0; hudGlyphs.length = 0; hudIcons.length = 0;
    game.render(); renders++;
    const at = `${W}x${H}, ${u.name} ${l + 1} tapped with too few gems of the ${GEM_SHORT[gem]}`, note = game.shopNote;
    check(S.lv[u.id] === l && note?.text === `GEMS: ${['', '', '', '', '', 'NORTH EAST', 'SOUTH EAST', 'SOUTH WEST', 'NORTH WEST'][gem]}, PAST 900` && note.short === `GEMS: ${GEM_SHORT[gem]}, PAST 900`, `${at}: it was ${S.lv[u.id] === l ? 'refused' : 'bought'}, and the note is '${note?.text}' and short '${note?.short}'`);
    for (const r of runs()) check(r.x >= px + 4 && r.x + r.w <= px + pw - 4, `${at}: a line of ${r.n} letters at y ${r.y} runs from x ${r.x} to ${r.x + r.w}, past the panel (${px + 4} to ${px + pw - 4})`);
    check(clashes() === 0, `${at}: in the shop a glyph runs into another glyph or an icon`);
    check(glyphs.some(g => g.y === foot), `${at}: the footer's note was not drawn`);
    check(game.goal.id === u.id && game.goal.gem === gem && game.cornerBar(), `${at}: the goal is ${game.goal.id} paid in gem ${game.goal.gem}, and the bar shows the corners: ${game.cornerBar()}`);
    const shown = bar(W, H, at);
    check(shown.join() === 'gem-nw,gem-se,gem-sw,gem-ne', `${at}: the bar's gems are ${shown}`);
  }
  game.shop = false;
}
{
  game.resize(330, 450, 1);
  const { W, H } = game;
  check(W === 330, `a screen 330 wide is ${W} of the game's pixels`);
  game.shop = false; game.banner = null;
  for (let g = 1; g < 9; g++) S.gems[g] = 999999;
  hudGlyphs.length = 0; hudIcons.length = 0; game.render(); renders++;
  const shown = bar(W, H, `${W}x${H}, every gem at 999K`);
  check(shown.join() === GEM_ICON.slice(1).join(), `${W}x${H}: the bar's gems are ${shown}`);
  for (const [cssW, cssH] of [[160, 284], [180, 320], [330, 450]]) for (const [have, said] of [[999999, '999K'], [987654321, '987M']]) {
    game.resize(cssW, cssH, 1);
    for (let g = 1; g < 9; g++) S.gems[g] = have;
    check(compact(have) === said, `${have} is written '${compact(have)}', not '${said}'`);
    hudGlyphs.length = 0; hudIcons.length = 0; game.render(); renders++;
    check(bar(game.W, game.H, `${game.W}x${game.H}, every gem at ${said}`).length === (game.W >= 330 ? 8 : 4), `${game.W}x${game.H}: the bar does not show its gems at ${said}`);
  }
  // (Back to the common phone, where the lines below were measured.)
  game.resize(360, 640, 1);
}

// What the bit and the winch are, said on their lines: which bit, its cut, and from its sixth level its plough;
// which winch and its load (the last winch's name, SINGULARITY, has no room, and its line says what the others do
// without it).
{
  const said = lv => { Object.assign(S.lv, lv); return Object.fromEntries(game.stats().map(([name, value]) => [name, value])); };
  const a = said({ drill: 3, winch: 2 }), b = said({ drill: 5, winch: 8 });
  // (In English: another language says each in its own number of pixels, and has room for other words.)
  if (lang === 'en') check(a.BIT === 'GOLD MK4, x3.6' && a.WINCH === 'GEARED x1.6, LOAD 1000', `the bit at MK4 says '${a.BIT}' and the winch at x1.6 '${a.WINCH}'`);
  if (lang === 'en') check(b.BIT === 'VOID MK6, x6.5 PLOUGH' && b.WINCH === 'x5, LOAD 100K', `the bit at MK6 says '${b.BIT}' and the winch at its last '${b.WINCH}'`);
}
// Every row's `says` (and its `what`) fits the narrowest line by itself, as js/shop.js promises.
for (const u of TABS.flatMap(t => t.rows)) for (let l = 0; l < u.values.length - 1; l++) {
  const said = u.says?.(l) ?? u.what;
  check(textWidth(said) <= 160 - 8 - 34, `${u.name} at level ${l} says '${said}', ${textWidth(said)} pixels: wider than the narrowest phone's line`);
}
check(CORE.length === 6 && TABS.every(t => t.rows.length <= 6), `a tab has more than the six rows the panel is made for: ${TABS.map(t => t.rows.length)}`);

console.log(`${renders} pictures of the shop`);
if (fails.length) { console.log(`FAIL (${fails.length}):\n  ${fails.join('\n  ')}`); process.exit(1); }
console.log('ok: every line of the shop and of STATS lies within its panel, and nothing drawn on a line runs into anything else');
