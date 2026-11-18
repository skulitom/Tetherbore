// Tetherbore: how the game is drawn. The scene (the ground, the drill, the ropes, the dark and the light) and the
// panels over it (the top bar, the map, the chart, the shop and the lab) are methods of the game written here apart
// from its rules: js/game.js copies them onto the game as they are, so `this` in them is the game. Nothing here is a
// rule of play: what these methods keep on the game is what was drawn and where (the pieces of ground, the chart's
// picture and view, what can be tapped this frame).
import { N, C, K, B, DX, DY, BIOMES, HAZARDS, CRUSH, ZONE, FIND, rowOf, hazOf, cellHash, RELIC_R, SEAMS, SHRINES, CORNER_HERALDS, fossilKin, GEM_PAST, STONES } from './world.js';
import { sheets, draw, drawScaled, frameAt, duration, slice9, text, textWidth, tinted, wrap } from './atlas.js';
import { tr, words, LANGS, lang, chooseLang, spaced } from './lang.js';
import { decorAt, markAt, natural, framesOf, placeOf } from './decor.js';
import { sfx, soundVolume, musicVolume, setSoundVolume, setMusicVolume, STEPS_OF_VOLUME } from './audio.js';
import { WORKS, MAPS, TABS, LAB, LAB_OF, LAB_PARTS, PART_INDEX, labLevel, labNext, ROWS, FOUND, FINDER, CUT, WINCH_LOAD, NEEDS } from './shop.js';
import { pickGoal, goalShare } from './goal.js';
import { WORTH_AT } from './worth.js';
import { TETHERS, BODY, BODY_A, HOT, HOT_A, RAM, PLATE, FLAME, FLAME_TIER, FITS, FIT_BIT, CORE_IDLE, CORE_C, CORE_FLASH, DISH, REFINERY, CUTTER, BOX, ORBIT, BEACON, STATION_PARTS } from './fit.js';
// (The middle of the core and two figures of the rules are the game's, read from js/game.js, which imports this
// module in turn. The two may import each other because these names are read only inside the methods, which run
// once both modules have: js/game.js is the module a page, a test or a tool loads, and this one runs before it,
// reading nothing of it as it runs. Loaded first on its own, this module would have js/game.js run first, and
// that copies the methods from here before there are any: so nothing loads it but js/game.js.)
import { HX, HY, BOOST, DEATH, BELL, VENT, WORM, STONE, GIANTS } from './game.js';
import { KINDS } from './fauna.js';

export const T = 16;                            // pixels in a cell
// How the interface is laid out, in the game's pixels: one set of figures for every panel and line of it, so that the
// same thing stands the same way everywhere. They follow the font: a line of text is a cell 10 rows tall, a capital's
// or a figure's ink on its rows 1 to 7 and its shadow a row lower, a Mandarin character's on rows 0 to 8 and its
// shadow on 9; a 10 pixel icon's ink is on rows 0 to 8, so an icon drawn at its text's own height is centred on it.
// The 'panel' 9-slice at (x, w) has two columns of rim each side and a fill from x+2 to x+w-3, two rows of rim on top
// and three under, its fill from y+2 to y+h-4.
//   EDGE    from the screen's edge to any panel that floats (the place's plate, the map's frame, the shop and the
//           lab); a line across the screen has W - 2*EDGE.
//   DOCK    from the screen's edge to the bar, which alone is docked to the foot of the screen.
//   INSET   inside any box at (x, w), what is in it begins at x+INSET and what is set to the right ends at x+w-INSET
//           (its ink a column short of that and its shadow on it): two columns of fill clear of the rim either side.
//   ICON    from a 10 pixel icon to its words (GAP, two columns, clear of the icon's frame). A 12 pixel mineral is
//           drawn a column left of where an icon would be, and its words a column further on (ICON + 1).
//   CHIP    from a 12 pixel ringed chip to its words (CHIP_GAP, four columns, clear of it).
//   ICON_DY, PIC_DY  a 10 pixel icon stands at its text's own height, a 12 pixel chip or mineral 2 rows above it.
//   GROUP   blank columns between one figure with its icon and the next on the same line.
//   WORD    the least room between two runs of words on one line that must read apart (a space is 4).
//   FIG     the widest figure `compact` writes ('987K', '987M'): it never writes more than four characters.
//   LINE    from one line of small text to the next, in banners, notices and popups' stacks; LINE_MIN the least.
//   TITLE, TITLE_GAP  a line under a title of size s stands TITLE * s + TITLE_GAP under it (`under`).
//   HEAD, TAB_GAP    a panel's header, and between its tabs.
//   STACK   rows between two chips stacked at the head of the screen.
//   DRILL_CLEAR      rows between words called out over the view and the top of the drill.
//   MAP     the map in the corner, square.
export const UI = Object.freeze({ EDGE: 4, DOCK: 2, INSET: 4, GAP: 2, ICON: 12, CHIP: 16, CHIP_GAP: 4, ICON_DY: 0, PIC_DY: -2, GROUP: 6, WORD: 8, FIG: 23,
  LINE: 12, LINE_MIN: 10, TITLE: 11, TITLE_GAP: 2, HEAD: 20, TAB_GAP: 9, STACK: 2, DRILL_CLEAR: 4, MAP: 46 });
const under = s => UI.TITLE * s + UI.TITLE_GAP;
// The shop: as many rows as its longest tab has, each SHOP_RH tall where the screen allows (every phone's does), and
// a footer under them for a refused tap's note. SHOP_GROUP: from one of a price's icons to the next, past the
// figure between them (an icon, UI.GROUP, and UI.GAP before the icon).
const SHOP_MOST = Math.max(...TABS.map(t => t.rows.length)), SHOP_RH = 32, SHOP_FOOT = 14, SHOP_GROUP = 10 + UI.GROUP + UI.GAP;
// A price as the shop says it: as `compact` writes it with a tenth that is nought left out ('25M', '4K' where it
// writes '25.0M', '4.0K'), made once a figure (the prices are few) and kept.
const PRICES = new Map();
const price = n => {
  let s = PRICES.get(n);
  if (s === undefined) { if (PRICES.size > 512) PRICES.clear(); PRICES.set(n, s = compact(n).replace(/\.0(?=[KMB])/, '')); }
  return s;
};
// A name said on two lines no wider than `room` at size `s`, broken where the longer of the two is shortest (so that
// no short word hangs at the end of the first), or null where no two lines fit.
const halves = (said, room, s) => {
  const { parts, join } = words(tr(said));
  let best = null, most = Infinity;
  for (let n = 1; n < parts.length; n++) {
    const a = parts.slice(0, n).join(join), b = parts.slice(n).join(join), w = Math.max(textWidth(a, s), textWidth(b, s));
    if (w <= room && w < most) { most = w; best = [a, b]; }
  }
  return best;
};
// The map's frame in the corner: three pixels of frame round the map, and four under it, as the panel's foot is a row
// deeper than its head, so that the map has a pixel of fill clear of the rim all round; EDGE from the top and the
// right. And the room left for the place's plate beside it, EDGE clear of it.
const MAP_FRAME = UI.MAP + 6, MAP_FRAME_H = UI.MAP + 7, MAP_X = W => W - UI.EDGE - MAP_FRAME + 3, MAP_Y = UI.EDGE + 3, BESIDE_MAP = W => W - UI.EDGE - MAP_FRAME - UI.EDGE;
// Where the drill's picture begins, from the top of the screen (its middle at the middle of the view, above the bar).
const drillTop = H => Math.round((H - 44) / 2) - 8;
const VOLUME_BAR = 49;                          // the menu's bar of ten steps of loudness, in pixels
const LANG_ROW = 18, LANG_ROWS = 3 * LANG_ROW + 2; // the menu's list of languages: a row each, and all it adds to the menu
// A heart of the hull, 9 pixels by 8, two round lobes over a point: each row's runs of pixels, first and last column.
// Its left half is columns 0 to 4 (the middle with it) and its right 5 to 8. HEART_PITCH: from one heart to the next.
const HEART = ['.##...##.', '####.####', '#########', '#########', '.#######.', '..#####..', '...###...', '....#....']
  .flatMap((row, r) => [...row.matchAll(/#+/g)].map(m => [m.index, m.index + m[0].length - 1, r])), HEART_PITCH = 10, HEART_MID = 4;
export const DIR_BIOME = [B.LODE, B.EMBER, B.MIRE, B.FROST];
// Each gem's icon and colour, by its number: the four directions' (whose icons are their grounds' names, and whose
// specimens' are those with `spec-` before them) and the four corners' (js/world.js: `G`), which have no specimens.
export const GEM_ICON = [null, 'frost', 'ember', 'mire', 'lode', 'gem-ne', 'gem-se', 'gem-sw', 'gem-nw'];
export const GEM_COLOR = [null, '#bfe6ff', '#ffb060', '#b8f06a', '#d8b8ff', '#5a8cff', '#f2346c', '#aaa6bc', '#2ed060'];
// The gems a haul's banner lists, in order: every gem but none.
const GEM_ORDER = [1, 2, 3, 4, 5, 6, 7, 8];
// The bar's four places for gems: the four directions', or the four corners' each in one of its parents' places (the
// north west's in the north's, the south east's in the south's, the south west's in the west's, the north east's in
// the east's), where the corners' are what matter (`cornerBar`); and on a screen wide enough for eight (BAR_ALL_W:
// each as much room as one of four has on the common phone), all eight in their order.
// BAR_COL: what a gem's column on the bar takes, its icon and the widest figure. A plate at the head of the screen is
// PLATE_H tall, and the worth of a thing seen first stands on a panel EYE_H tall (two lines under its chip).
const BAR_DIRS = [1, 2, 3, 4], BAR_CORNERS = [8, 6, 7, 5], BAR_ALL = GEM_ORDER, BAR_ALL_W = 330, BAR_COL = UI.ICON + UI.FIG, PLATE_H = 14, EYE_H = 32;
// How long, in seconds, the goal's line blinks green as what it asks for is all banked.
export const GOAL_BLINK = 3;
// Where the corners' gems are what matter: out where they are had, past CORNER_BAR cells from the core and within
// CORNER_LANE of the distance of a diagonal (the deep seams lie along them from 900 out).
export const CORNER_BAR = 840, CORNER_LANE = 0.3;
// The lab's notes are one list in parts (js/shop.js: `LAB_PARTS`), laid out once here: a line of SEC pixels at the
// head of each part that has anything in it (its icon, its title and how many of it are known) and a line of RH for
// each thing, in the order of `LAB`. `lines` is every line from the top, `line[i]` thing i's (with what is said of it
// before it is known, `found`), `at[i]` where it begins, `head[k]` where part k's head does (k its place in
// `LAB_PARTS`), and `content` how tall the whole list is. A thing not yet known is
// drawn as where it is found (`label`), and two of one part found in one place (a ground's common ore and its rich
// one) are told apart there and in what is said of them by which they are. NOTE is the room under
// the list for what is said of the thing chosen: a line of its count, a line of what it is worth (js/worth.js), and
// up to NOTE_LINES lines of its note (test/regress/l-analysis.mjs holds every note to them on the narrowest panel).
export const LAB_RH = 13, LAB_SEC = 12, LAB_HEAD = 20, NOTE_LINES = 4, LAB_NOTE = 22 + NOTE_LINES * 10 + 4;
export const LAB_LIST = (() => {
  const lines = [], line = [], at = [], head = [];
  let y = 0;
  LAB.forEach((e, i) => {
    const part = PART_INDEX[e.part];
    if (i === 0 || LAB[i - 1].part !== e.part) { head[part] = y; lines.push({ y, h: LAB_SEC, part, entry: null, i: -1, total: LAB.filter(f => f.part === e.part).length }); y += LAB_SEC; }
    const [sheet, frame] = e.key.split(':'), twin = LAB.some(f => f !== e && f.part === e.part && f.at === e.at), which = twin ? (frame.endsWith('A') ? 'COMMON' : 'RICH') : null;
    at[i] = y; lines.push(line[i] = { y, h: LAB_RH, part, entry: e, i, sheet, frame, label: which ? `${e.at}, ${which}` : e.at,
      found: `${which ? `A ${which} ORE. ` : ''}CUT THROUGH ONE WITH THE BIT. FOUND: ${e.where}.` });
    y += LAB_RH;
  });
  return { lines, line, at, head, content: y };
})();
// A thing's chip in the lab's list, 12 pixels square with its corners cut; and the rim round it in a tier's colour
// (js/worth.js: `tier`): none for the first, silver for the second, gold for the third.
export const TIER_RIM = [null, null, '#9cc4f0', '#ffcc40'];
const chip = (ctx, x, y, rim, fill) => { ctx.fillStyle = fill; ctx.fillRect(x + 1, y, 10, 12); ctx.fillRect(x, y + 1, 12, 10); };
const ring = (ctx, x, y, rim) => {
  ctx.fillStyle = rim;
  ctx.fillRect(x + 1, y, 10, 1); ctx.fillRect(x + 1, y + 11, 10, 1); ctx.fillRect(x, y + 1, 1, 10); ctx.fillRect(x + 11, y + 1, 1, 10);
};
// What is said under the list of a thing analysed n times: its count, and the count its next level comes at.
// Two values of a shop's row, `a>b`, in no more than `room` pixels: a word the two share said once ('ALL x3>x4',
// '3>4 SPEC'), failing that the next alone ('>ALL x2'), and failing that its figure without its word ('>2' for '2
// SPEC', where TROPHY LINE's long name leaves no more in Russian). (What the row says on its second line says the rest.)
const fewer = (a, b, room) => {
  const A = a.split(' '), B = b.split(' ');
  if (A.length === 2 && B.length === 2) {
    const one = A[0] === B[0] ? `${A[0]} ${A[1]}>${B[1]}` : A[1] === B[1] ? `${A[0]}>${B[0]} ${A[1]}` : null;
    if (one && textWidth(one) <= room) return one;
  }
  return B.length === 2 && textWidth(`>${b}`) > room ? `>${B[0]}` : `>${b}`;
};
export const labCount = n => `${compact(n)} ${n === 1 ? 'SAMPLE' : 'SAMPLES'}. +1% AT ${compact(labNext(n))}`;
// What the lens shows a kind of ground as, and from which level of it: [level, red, green, blue].
const LENS = [];
for (const [level, colour, kinds] of [[1, [214, 178, 64], [K.ORE_A]], [1, [255, 232, 96], [K.ORE_B]], [2, [176, 184, 204], [K.SLATE, K.VAULT, K.KEY, K.STEEL, K.SLAG]], [2, [255, 84, 64], [K.HAZARD, K.HAZARD2]],
  [3, [120, 240, 190], [K.MINERAL, K.NODE, K.CACHE, K.PRISM, K.FOSSIL, K.CAP, K.CAP_LIT, K.TWIN]]]) for (const k of kinds) LENS[k] = [level, ...colour];
// Which of two things the lens tells apart a pixel of the map in the corner shows, where a pixel is many cells: the
// higher of these (a rare hazard, which is not in LENS, above them all). A find before a hazard, a hazard before
// hard ground, hard ground before ore: the rarer thing, as a pixel of three cells and more across would otherwise
// show whichever cell its middle fell on, and a wider range showed less than a narrow one.
const LENS_RANK = [];
LENS.forEach((L, k) => { LENS_RANK[k] = L[0] === 3 ? 4 : L[0] === 1 ? 1 : k === K.HAZARD || k === K.HAZARD2 ? 3 : 2; });
const RARE_RANK = 5;
// A rare hazard is shown with the hazards, each of the four in a colour of its own: by the kin of its ground, which
// is which it is (js/world.js: `RARE`).
const RARE_LENS = [undefined, [2, 170, 236, 255], [2, 255, 150, 40], [2, 190, 255, 90], [2, 176, 128, 255]];
// Which finds the finder marks at each level of it, and how far from the drill it marks them, in cells. (It marked
// every find within the tether's reach, and listed no more than two hundred, from the north down: on the chart of
// a long reach that was a solid band of dots across the north and none anywhere else.)
// (They are js/shop.js's, beside the row that buys them, where the creatures' wren reads them too.)
// Where each gem is found, for a price that cannot be met yet (and how far out: js/world.js, GEM_PAST); and a
// corner's said short, where the whole will not fit.
export const GEM_WHERE = [null, 'NORTH', 'SOUTH', 'WEST', 'EAST', 'NORTH EAST', 'SOUTH EAST', 'SOUTH WEST', 'NORTH WEST'];
export const GEM_SHORT = [null, null, null, null, null, 'NE', 'SE', 'SW', 'NW'];
// What is called out the first time it is seen (`World.see` says what it is): the name that comes up, and the
// colour of that name, of the ring round the thing and of its dot on the map. A relic's colour is its direction's
// gem's, and a pocket's mineral has its own name and its pocket's colour. Names only: nothing here says what a
// thing is for.
export const SPOT = {
  cache: ['CACHE', '#ffe14a'], geode: ['GEODE', '#f4ecd8'], wreck: ['WRECK', '#ff9a3a'], key: ['KEYSTONE', '#a4acbc'], prism: ['PRISM', '#ffffff'],
  relic: ['RELIC', '#ffffff'], mineral: ['MINERAL', '#ffffff'], shrine: ['SHRINE', '#fff0c8'],
  bell: ['RIME BELL', '#bff4ff'], vent: ['FUMAROLE', '#ff9a3c'], worm: ['GLOWWORM', '#c8ff5a'], lodestone: ['LODESTONE', '#b48cff'],
};
// A place's name is written in the colour it has on the map, as bright as that colour goes.
export const bright = ([r, g, b]) => { const k = 255 / Math.max(1, r, g, b); return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`; };
// How many pockets the map marks at once.
const PIPS = 24;
// What flies off the kinds of rock that look the same in every ground, by the sheet each is drawn from. A ground's
// own rock sheds the colours in its row (js/world.js: BIOMES), where the dark it lies in, its motes and its colour
// on the map are too.
export const DEBRIS = {
  slate: ['#6a7080', '#a4acbc', '#454a5a'], vault: ['#463a68', '#8a78c0', '#c8a8ff'], ice: ['#6fb0e0', '#d8f4ff', '#ffffff'],
  basalt: ['#463e4c', '#7a6a78', '#8a3424'], bedrock: ['#1e1e26', '#34343e'],
};
// And off what is found in the ground, whatever ground it lies in: a keystone's iron and rust, a prism's glass.
const CHIPS = [];
CHIPS[K.KEY] = ['#8a94a8', '#eef4ff', '#b0603a']; CHIPS[K.PRISM] = ['#ffffff', '#bfe6ff', '#d8b8ff'];
// How many keystones in view glint in the dark at once (the nearest the drill), how bright, and how far.
const KEY_GLINTS = 12, KEY_GLINT = 0.4, KEY_GLOW = 2;
// Glowing decor (js/decor.js): as many as DECOR_MOST in view have a halo, at DECOR_HALO, and the nearest DECOR_GLOWS
// also light the cave about them, as bright as DECOR_GLOW for as far as DECOR_REACH cells.
const DECOR_MOST = 64, DECOR_HALO = 0.85, DECOR_GLOWS = 12, DECOR_GLOW = 0.4, DECOR_REACH = 2.2;
// And rare hazards asleep (the nearest the drill): a glowworm glows brighter than the rest. And how many cells of
// a fumarole's flames light the dark, at the most.
const RARE_GLINTS = 8, RARE_GLINT = [0.3, 1.5], WORM_GLOW = [0.45, 2.5], JET_LIGHTS = 16;
// (How the tether looks at each level of reach, and what lights run along it, is js/fit.js's: `TETHERS`.)
// What the shop's pictures of the next level show of the drill besides its parts: the bit hot, the flame, what is
// fitted lit (`drawShop`). One, made once and filled in for each picture.
const PREVIEW = { heat: 0, flame: 0, tint: '#ffffff', tintAlpha: 0, lit: 0, spin: 0 };
// And the frames of the CORE tab's rows: where on the station's sheet each part lies, a cell's worth of it.
// The names of the levels of the rows that have them (js/shop.js: `tiers`), for STATS.
const TIERED = Object.fromEntries(ROWS.filter(u => u.tiers).map(u => [u.id, u.tiers]));
const PART_CROP = { refinery: [0, 1], cutter: [48, 47], blackbox: [0, 45] };
// The finds the map in the corner marks on its rim, past its edge, at the most: the nearest so many (`drawMap`), in
// lists made once.
const RIM = 8, RIM_FAR = new Float64Array(RIM), RIM_OF = new Int32Array(RIM);
const NO_DASH = [], NO_FINDS = [];
// How ground not yet seen is shown on the map and the chart (`drawMap`): its row's colour on the map, as dark as a
// third of it, but never darker than a luminance of UNSEEN_LUM (a deep flank's colours, a third as bright, were
// nearly black, and a wedge of one ground read as a hole in the world) nor brighter than UNSEEN_MOST of it (which
// the darkest colour there is needs to reach UNSEEN_LUM: magma's, 0.56 of it); and in
// UNSEEN_GRAIN of the squares of 8 cells, its second chip's colour (`debris`), a little brighter (UNSEEN_GRAIN_LUM),
// so that no ground is one flat tone. Both worked out once a row (`unseen`), into tables made once. On the chart,
// where ground changes the pixel is a quarter darker (EDGE), so the grounds' borders show.
export const UNSEEN_LUM = 34, UNSEEN_MOST = 0.65, UNSEEN_GRAIN_LUM = 46, UNSEEN_GRAIN = 0.35, EDGE = 0.75;
const UNSEEN_SHADE = new Float32Array(256).fill(-1), GRAIN_SHADE = new Float32Array(256), GRAIN_RGB = new Uint8Array(256 * 3);
const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
export const unseenShade = row => {
  const id = row.id;
  if (UNSEEN_SHADE[id] < 0) {
    const [r, g, b] = row.map, hex = row.debris?.[1] ?? '#808080', gr = parseInt(hex.slice(1, 3), 16), gg = parseInt(hex.slice(3, 5), 16), gb = parseInt(hex.slice(5, 7), 16);
    UNSEEN_SHADE[id] = Math.min(UNSEEN_MOST, Math.max(0.3, UNSEEN_LUM / Math.max(1, lum(r, g, b))));
    GRAIN_SHADE[id] = Math.min(UNSEEN_MOST, Math.max(0.2, UNSEEN_GRAIN_LUM / Math.max(1, lum(gr, gg, gb))));
    GRAIN_RGB[id * 3] = gr; GRAIN_RGB[id * 3 + 1] = gg; GRAIN_RGB[id * 3 + 2] = gb;
  }
  return UNSEEN_SHADE[id];
};
// What is drawn over a twin stone, a fossil's bone (its species' head, body or tail: by direction, then which bone),
// a fault, a shrine's heart (by corner) and the ancient stone of a shrine's or a builders' hall's walls (by which:
// js/world.js, STONES) (`overlay`): made once, not for each cell.
const CAP_OVER = ['minerals', 'cap'], LANTERN_OVER = ['minerals', 'lantern'], TWIN_OVER = ['finds', 'twin'], BONE_OVER = ['finds', 'bone'], FAULT_OVER = ['cracks', 'crack-2'];
const FOSSIL_OVER = [0, 1, 2, 3, 4].map(kin => ['head', 'body', 'tail'].map(part => ['finds', `fossil-${kin}-${part}`]));
const SHRINE_OVER = [0, 1, 2, 3].map(d => ['shrines', `shrine-${d}`]);              // (a line with no dashes, and no finds: the one list each, given each time)
const STONE_OVER = STONES.map(name => ['stones', name]);
const ROUND = 3.5, BRAID = 4;                    // on the fine canvas: how wide a rope rounds a corner, and the length of one turn of its braid, in the game's pixels
const LIGHT_STEP = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.41], [-1, 1, 1.41], [1, -1, 1.41], [-1, -1, 1.41]];
// How far light goes to each of those neighbours, in a flat array: the flood of light reads it eight times for
// every cell it lights, many times a frame, and taking each step apart as an array cost most of the flood's time.
// The steps themselves, as offsets in the light's window, are kept on the window (lightMap.step), which alone
// knows how many cells it is across.
const LIGHT_FAR = Float64Array.from(LIGHT_STEP, s => s[2]);
// A figure in no more than four characters (UI.FIG wide) below a thousand thousand million: with a tenth under ten
// of a K, an M or a B, and with none from ten on ('9.9K', '987K', '9.8M', '987M').
const tenths = (n, of, sign) => `${(Math.floor(n / (of / 10)) / 10).toFixed(1)}${sign}`;
export const compact = n => n < 1000 ? `${Math.floor(n)}` : n < 1e4 ? tenths(n, 1e3, 'K') : n < 1e6 ? `${Math.floor(n / 1e3)}K`
  : n < 1e7 ? tenths(n, 1e6, 'M') : n < 1e9 ? `${Math.floor(n / 1e6)}M` : n < 1e10 ? tenths(n, 1e9, 'B') : `${Math.floor(n / 1e9)}B`;

// A piece of the ground is drawn first into a Sketch, a list of the calls drawing it takes, and only drawn into its
// canvas when that list is not the one the canvas was last drawn from (`Game.chunk`). Any change to the ground, a
// cut or a cell newly seen, tells every piece in view to draw itself again, and most of them draw just what they
// already hold: four in five, over a flight of cuts, where a change drew eight pieces again and one or two had
// changed. A canvas drawn again costs the browser far more the next time it is laid on the screen, as it is sent to
// the graphics card again: in Edge a frame in which the ground changed took 2 ms to draw, and 1 ms once only the
// pieces that changed were drawn again. The same calls in the same order make the same pixels, so nothing that
// changes the ground needs to say which pieces it changed.
// The list is numbers alone: a sheet's image or a colour is written as its place in THINGS, which only grows, so a
// number stands for the same thing for as long as the page is open. A Sketch takes only the calls `Game.paint`
// makes (and `draw` in js/atlas.js makes for it): any other is an error, not a call left out of the list, so a
// change to the drawing of the ground cannot leave a piece showing what it showed before.
const THINGS = [], THING = new Map();
const thing = x => { let n = THING.get(x); if (n === undefined) { n = THINGS.length; THINGS.push(x); THING.set(x, n); } return n; };
const ALPHA = 0, FILL = 1, RECT = 2, IMAGE = 3;
class Sketch {
  constructor() { this.ops = new Float64Array(2048); this.n = 0; Object.preventExtensions(this); }
  set globalAlpha(alpha) { const o = this.put(2); this.ops[o] = ALPHA; this.ops[o + 1] = alpha; }
  set fillStyle(style) { const o = this.put(2); this.ops[o] = FILL; this.ops[o + 1] = thing(style); }
  fillRect(x, y, w, h) { const o = this.put(5), a = this.ops; a[o] = RECT; a[o + 1] = x; a[o + 2] = y; a[o + 3] = w; a[o + 4] = h; }
  drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh) {
    if (arguments.length !== 9) throw new Error('a piece of ground draws a part of an image to a place and size: nine arguments');
    const o = this.put(10), a = this.ops;
    a[o] = IMAGE; a[o + 1] = thing(image); a[o + 2] = sx; a[o + 3] = sy; a[o + 4] = sw; a[o + 5] = sh; a[o + 6] = dx; a[o + 7] = dy; a[o + 8] = dw; a[o + 9] = dh;
  }
  // Room for k more numbers at the end of the list: where they begin.
  put(k) {
    const o = this.n;
    if (o + k > this.ops.length) { const more = new Float64Array(2 * (o + k)); more.set(this.ops); this.ops = more; }
    this.n = o + k;
    return o;
  }
  same(held) {
    const a = this.ops, n = this.n;
    if (!held || held.length !== n) return false;
    for (let i = 0; i < n; i++) if (a[i] !== held[i]) return false;
    return true;
  }
}
// The calls of a list, made on a canvas in the order they were taken down.
function replay(ops, ctx) {
  for (let i = 0; i < ops.length;) {
    const op = ops[i];
    if (op === ALPHA) { ctx.globalAlpha = ops[i + 1]; i += 2; }
    else if (op === FILL) { ctx.fillStyle = THINGS[ops[i + 1]]; i += 2; }
    else if (op === RECT) { ctx.fillRect(ops[i + 1], ops[i + 2], ops[i + 3], ops[i + 4]); i += 5; }
    else { ctx.drawImage(THINGS[ops[i + 1]], ops[i + 2], ops[i + 3], ops[i + 4], ops[i + 5], ops[i + 6], ops[i + 7], ops[i + 8], ops[i + 9]); i += 10; }
  }
}
const sketch = new Sketch();

const PANEL_NAMES = { stats: 'STATS', lab: 'LAB', chart: 'MAP', menu: 'MENU' };   // the bar's panel's tabs (`panelIds`)
export class Drawing {
  // (Glass and a hairline fault are drawn from sheets of their own, in whatever ground they lie: glass, until its
  // sheet is drawn, as ice, which it cuts like; a fault as its ground's rock, with a crack over it, `overlay`.)
  rockSheet(k, b) {
    return k === K.BEDROCK ? 'bedrock' : k === K.SLATE ? 'slate' : k === K.VAULT || k === K.RELIC ? 'vault' : k === K.ICE ? 'ice' : k === K.BASALT ? 'basalt'
      : k === K.GLASS ? (sheets.glass?.tiles ? 'glass' : 'ice') : k === K.FAULT && sheets.fault?.tiles ? 'fault' : rowOf(b).sheet;
  }
  // The colours of the chips that fly off a cell of kind `k` in ground `b`.
  debris(k, b) {
    const row = rowOf(b), P = row.pocket;
    return P !== null && P.chips && k === (P.kind ?? K.MINERAL) ? P.chips : CHIPS[k] ?? DEBRIS[this.rockSheet(k, b)] ?? row.debris;
  }
  rockRect(x, y, k, b) {
    const sheet = this.rockSheet(k, b), rects = sheets[sheet].tiles[this.world.mask(x, y)];
    return [sheet, rects[(cellHash(x, y, 3) * rects.length) | 0]];
  }
  // What is drawn over a cell's rock, as [sheet, frame], or null for nothing: dense rock and ore from its ground's
  // own sheet (`row`), a hazard from its type's, a relic from its direction's, a find from the finds'. Ore is drawn
  // from what its row says its two ores are (`ores`), which is what the lab knows them by: a strain's, a seam's or a
  // deep flank's are its own, and a cross's rich ore is a stone of its own in its donor's outline, so that what it
  // looks like says whose gems it pays. (The row's own pairs are returned, so nothing is made for a cell.)
  // Vault is drawn with a stone over it where it is a shrine's or a builders' hall's walls, which only the cell `i`
  // says (js/world.js: `stoneOf`), the same stone the lab knows it as.
  // A pocket's mineral is its own frame of the 'minerals' sheet, and its special cell (a hive's stalk) one of two:
  // the one that runs level or the one that stands upright, as the cell `i` lies between what it joins (asked of
  // the cells beside it; upright where `i` is not given).
  overlay(k, row, i) {
    const P = row.pocket;
    // (A grotto's cap before it is lit.)
    if (k === K.CAP) return sheets.minerals?.frames.cap ? CAP_OVER : null;
    // (And lit, outside a grotto, on a mycelium's rims: a grotto's lantern.)
    if (k === K.CAP_LIT && P === null) return sheets.minerals?.frames.lantern ? LANTERN_OVER : null;
    if (P !== null && (k === K.NODE || k === (P.kind ?? K.MINERAL))) {
      if (k === (P.kind ?? K.MINERAL)) return this.mineralOf(row) ? ['minerals', P.mineral] : null;
      const w = this.world, joins = j => { const q = w.k(j); return q === K.NODE || q === (P.kind ?? K.MINERAL); };
      const frame = `${P.node}-${i !== undefined && !joins(i - N) && !joins(i + N) && (joins(i - 1) || joins(i + 1)) ? 'h' : 'v'}`;
      return sheets.minerals?.frames[frame] ? ['minerals', frame] : null;
    }
    if (k === K.ORE_B) return row.ores[1];
    if (k === K.ORE_A) return row.ores[0];
    if (k === K.DENSE) return [row.items, 'dense'];
    if (k === K.HAZARD || k === K.HAZARD2 || k === K.RARE) { const haz = hazOf(k, row); return haz ? [HAZARDS[haz].sheet, 'hazard'] : null; }
    // Slag and the steel it is quenched to are the lava's, drawn from the lava's sheet whatever ground they lie in.
    if (k === K.SLAG || k === K.STEEL) return [HAZARDS.lava.sheet, k === K.SLAG ? 'slag' : 'steel'];
    // Twin stones and a fossil's bones are the finds' (until their frames are drawn, a twin stone as its ground's
    // rich ore and a bone as its dense rock); a fault with no sheet of its own, a crack in its ground's rock.
    if (k === K.TWIN) return sheets.finds?.frames.twin ? TWIN_OVER : row.ores[1];
    if (k === K.FOSSIL) {
      // (Which bone of its fossil this is, the sector's record says: js/world.js, `findAt`.)
      const w = this.world, x = i % N, y = Math.floor(i / N);
      if (i !== undefined && sheets.finds?.frames['fossil-1-head'] && w.findAt(x, y) === K.FOSSIL) {
        const S = w.sector;
        for (let n = 0; n < S.n; n++) if (S.fx + S.bx[n] === x && S.fy + S.by[n] === y) return FOSSIL_OVER[fossilKin(S.fx, S.fy)][n === 0 ? 0 : n === S.n - 1 ? 2 : 1];
      }
      return sheets.finds?.frames.bone ? BONE_OVER : [row.items, 'dense'];
    }
    if (k === K.FAULT) return sheets.fault?.tiles ? null : FAULT_OVER;
    if (k === K.VAULT) { if (i === undefined || !sheets.stones) return null; const s = this.world.stoneOf(i % N, Math.floor(i / N)); return s < 0 ? null : STONE_OVER[s]; }
    // (A shrine's heart is a relic's kind, drawn as its corner's shrine.)
    if (k === K.RELIC && i !== undefined && sheets.shrines) { const d = this.world.shrineAt.indexOf(i); if (d >= 0) return SHRINE_OVER[d]; }
    // A keystone is an iron staple across its block of rock; a prism turns through the gems' colours (`render`).
    return k === K.RELIC ? [rowOf(row.kin).items, 'relic'] : k === K.CACHE ? ['finds', 'cache'] : k === K.WRECK ? ['finds', 'part']
      : k === K.KEY ? ['finds', 'key'] : k === K.PRISM ? ['finds', 'prism'] : null;
  }

  render() {
    const { ctx, W, H, world: w } = this, d = this.drill, now = this.time * 1000;
    // (The ground's own quake shakes the view too, and nothing else: js/feel.js.)
    const shook = this.shake + this.feel.quake;
    const sx = shook ? (cellHash((now / 16) | 0, 1, 5) - 0.5) * shook : 0, sy = shook ? (cellHash((now / 16) | 0, 2, 5) - 0.5) * shook : 0;
    // (The drill is kept in the middle of the screen above the bar, not of the whole screen.)
    const ox = Math.round(this.cam.x - W / 2 + sx), oy = Math.round(this.cam.y - (H - 44) / 2 + sy);
    ctx.fillStyle = '#07060b';
    ctx.fillRect(0, 0, W, H);
    this.ropes.length = 0; this.drillDrawn = null;
    // The ground is painted once into 8 x 8 cell pieces and redrawn only when it changes; a frame lays those
    // down, then draws what moves over them.
    const x0 = Math.floor(ox / T), y0 = Math.floor(oy / T), x1 = Math.floor((ox + W) / T), y1 = Math.floor((oy + H) / T);
    for (let cy = y0 >> 3; cy <= y1 >> 3; cy++) for (let cx = x0 >> 3; cx <= x1 >> 3; cx++) ctx.drawImage(this.chunk(cx, cy), cx * 128 - ox, cy * 128 - oy);
    for (const i of w.lava.keys()) {
      const x = i % N, y = Math.floor(i / N);
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1 && w.s(i)) draw(ctx, 'lava', frameAt('lava', `lava-${w.lavaMask(x, y)}`, now + cellHash(x, y, 2) * 300), x * T - ox, y * T - oy);
    }
    for (const i of this.frostOpen) {
      // Ice about to close over a cut: a rim of it creeps in first.
      const age = this.clock - (w.dug.get(i) ?? this.clock), rim = w.row(i).freeze - 8;
      if (age <= rim || this.under.has(i)) continue;
      ctx.globalAlpha = Math.min(0.8, (age - rim) / 8);
      draw(ctx, 'ice', sheets.ice.tiles[0][0], (i % N) * T - ox, Math.floor(i / N) * T - oy);
      ctx.globalAlpha = 1;
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = w.peek(x, y);
      if (k !== K.HAZARD && k !== K.HAZARD2 && k !== K.RARE && k !== K.RELIC && k !== K.STEEL && k !== K.PRISM && k !== K.TWIN) continue;
      const i = y * N + x, row = w.row(i), m = w.mask(x, y), ux = x * T - ox - ((m & 4) ? 0 : 1), uy = y * T - oy - ((m & 16) ? 0 : 1);
      // A prism turns through the gems' colours, each in its own time; a twin stone glints.
      if (k === K.PRISM) { draw(ctx, 'finds', frameAt('finds', 'prism', now + cellHash(x, y, 4) * 720), ux, uy); continue; }
      if (k === K.TWIN) { if (sheets.finds.animations.twin) draw(ctx, 'finds', frameAt('finds', 'twin', now + cellHash(x, y, 4) * 900), ux, uy); continue; }
      // Steel glints now and then, each bar in its own time, and is white for a moment as it is quenched.
      if (k === K.STEEL) { const items = HAZARDS.lava.sheet; draw(ctx, items, this.quenched.has(i) ? 'quench' : frameAt(items, 'steel', now + cellHash(x, y, 4) * 1140), ux, uy); continue; }
      if (k === K.RELIC) {
        const shrine = sheets.shrines ? w.shrineAt.indexOf(i) : -1;
        if (shrine >= 0) { draw(ctx, 'shrines', frameAt('shrines', SHRINE_OVER[shrine][1], now), ux, uy); continue; }
        const rs = rowOf(DIR_BIOME[w.relicAt.indexOf(i)] ?? row.kin).items; draw(ctx, rs, frameAt(rs, 'relic', now), ux, uy); continue;
      }
      // A hazard looks as its type does, whatever ground it lies in.
      const haz = hazOf(k, row);
      if (!haz) continue;
      const items = HAZARDS[haz].sheet, s = this.sparks.get(i), awake = k === K.RARE ? this.rareFrame(haz, i, now) : s && s.fuse > 0 ? (((now / 60) | 0) % 2 ? 'hazard-b' : 'hazard') : null;
      if (awake !== false) draw(ctx, items, awake ?? frameAt(items, 'hazard', now + cellHash(x, y, 4) * 900), ux, uy);
    }
    this.drawRares(ctx, ox, oy, now);
    // The block being cut cracks further the nearer it is to giving way, and what it would free glows.
    if (d.dig >= 0) {
      const stage = Math.min(4, Math.floor(d.digT / d.digDur * 5));
      if (stage > 0) draw(ctx, 'cracks', `crack-${stage}`, (d.dig % N) * T - ox, Math.floor(d.dig / N) * T - oy);
      for (const p of this.preview) {
        ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.16 + 0.12 * Math.sin(now / 110);
        for (const i of p.cells) ctx.fillRect((i % N) * T - ox, Math.floor(i / N) * T - oy, T, T);
        ctx.globalAlpha = 1;
      }
    }
    // The core, as the winch upgrades have built it, with the scanner's dish on its shoulder and what CORE has built
    // on it (js/fit.js: `station`).
    const coreX = (C - 1) * T - ox, coreY = (C - 1) * T - oy;
    if (coreX > -80 && coreY > -80 && coreX < W + 40 && coreY < H + 40) {
      const hull = Math.min(8, this.S.lv.winch);
      draw(ctx, 'core', this.coreFlash > 0 ? CORE_FLASH[hull] : this.S.won ? CORE_C[hull] : frameAt('core', CORE_IDLE[hull], now), coreX, coreY);
      draw(ctx, 'dish', frameAt('dish', DISH[Math.min(6, this.S.lv.scanner)], now), coreX + 34, coreY - 6);
      this.fitter.station(this, ctx, coreX, coreY, now);
      [[39, 20], [20, 39], [1, 20], [20, 1]].forEach(([u, v], dir) => {
        if (this.S.relics[dir]) drawScaled(ctx, BIOMES[DIR_BIOME[dir]].items, 'relic', coreX + u, coreY + v, 8, 8);
      });
    }
    this.drawTether(ox, oy);
    // Lassoed pieces: blocks tremble, crack and break into bits of ground, held in a loop of the tether, and the
    // hatch they are bound for.
    for (const h of this.hauls) {
      const flash = h.t < h.lift && ((h.t * 24) | 0) % 2 === 0, hx = Math.round(HX * T - ox), hy = Math.round(HY * T - oy), hull = [];
      if (h.hole > 0.5) {
        const R = h.hole;
        for (const [rad, color] of [[R + 1.5, '#f4ecd8'], [R + 0.5, '#3a3046'], [R - 0.5, '#07060a']]) {
          ctx.fillStyle = color;
          for (let y = -Math.ceil(rad); y <= Math.ceil(rad); y++) { const half = Math.sqrt(rad * rad - y * y); if (half > 0) ctx.fillRect(Math.round(hx - half), hy + y, Math.round(half * 2), 1); }
        }
      }
      for (const s of h.sprites) {
        const before = h.t - s.go;
        if (before >= 0) continue;
        const shake = Math.max(0, 1 + before / 0.3) * 1.4;
        const px = s.x * T - ox + Math.sin(h.t * 83 + s.x * 3.1) * shake, py = s.y * T - oy - Math.min(1, h.t / h.lift) * 3 + Math.cos(h.t * 71 + s.y * 2.3) * shake;
        hull.push([px, py], [px + T, py], [px, py + T], [px + T, py + T]);
        if (px < -T || py < -T || px > W || py > H) continue;
        draw(ctx, s.tile[0], s.tile[1], px, py);
        if (s.item) ctx.drawImage(s.item[0], s.item[1][0], s.item[1][1], T, T, Math.round(px), Math.round(py), T, T);
        if (before > -0.24) draw(ctx, 'cracks', `crack-${Math.min(4, 1 + (((before + 0.24) / 0.06) | 0))}`, px, py);
        if (flash) { ctx.globalAlpha = 0.6; ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(px) + 2, Math.round(py) + 2, 12, 12); ctx.globalAlpha = 1; }
      }
      const size = h.size, half = size / 2;
      for (const b of h.bits) {
        if (b.st === 2) continue;
        let x = b.x - ox, y = b.y - oy, sz = size;
        if (b.st === 1) {
          // Dropping down the hatch: away from the eye, into the dark.
          const u = Math.min(1, b.ft / 0.16);
          x += (hx - x) * u * 0.7; y += (hy - y) * u * 0.7; sz = Math.max(1, Math.round(size * (1 - u * 0.7))); ctx.globalAlpha = 1 - u * 0.8;
        } else hull.push([x - half, y - half], [x + half, y - half], [x - half, y + half], [x + half, y + half]);
        if (x > -size && y > -size && x < W + size && y < H + size) {
          const r = b.s.tile[1], px = Math.round(x - sz / 2), py = Math.round(y - sz / 2);
          ctx.drawImage(sheets[b.s.tile[0]].image, r[0] + b.sx, r[1] + b.sy, size, size, px, py, sz, sz);
          if (b.s.item) ctx.drawImage(b.s.item[0], b.s.item[1][0] + b.sx, b.s.item[1][1] + b.sy, size, size, px, py, sz, sz);
          // The break shows white for a moment.
          if (h.t - b.born < 0.07) { ctx.globalAlpha = 0.7; ctx.fillStyle = '#ffffff'; ctx.fillRect(px, py, sz, sz); }
        }
        ctx.globalAlpha = 1;
      }
      // The haul's own rope: a loop round the lot, and a line from it along the way home.
      if (hull.length && h.doneAt === undefined) {
        const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), ring = [];
        // A big heap has a thousand corners and an outline of a score of them, and sorting them all was the dearest
        // part of drawing a busy frame. The corners furthest out to the right, down, left and up and along the four
        // diagonals between make an octagon inside the outline, and a corner inside that cannot be on the outline,
        // so those are thrown out before the sort. Only a corner inside by more than rounding could account for
        // goes: one on the octagon's edge, or a hair either side of it, is left to the outline to keep or pass over.
        // (r is the corner furthest right, dr the one furthest down and right, and so on round.)
        let r = hull[0], dr = r, d = r, dl = r, l = r, ul = r, u = r, ur = r;
        for (const p of hull) {
          const x = p[0], y = p[1];
          if (x > r[0]) r = p; if (x < l[0]) l = p; if (y > d[1]) d = p; if (y < u[1]) u = p;
          if (x + y > dr[0] + dr[1]) dr = p; if (x + y < ul[0] + ul[1]) ul = p; if (y - x > dl[1] - dl[0]) dl = p; if (y - x < ur[1] - ur[0]) ur = p;
        }
        // (In turn round the compass, with any corner that repeats the one before it left out: an edge of no length
        // would have every corner on it.)
        const oct = [r, dr, d, dl, l, ul, u, ur].filter((p, i, all) => p[0] !== all[(i + 7) % 8][0] || p[1] !== all[(i + 7) % 8][1]), n = oct.length;
        let kept = hull;
        if (n > 2) {
          kept = [];
          for (const p of hull) { let i = 0; while (i < n && turn(oct[i], oct[(i + 1) % n], p) > 1e-3) i++; if (i < n) kept.push(p); }
        }
        kept.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        for (const pass of [0, 1]) {
          const start = ring.length;
          for (let k = 0; k < kept.length; k++) {
            const p = kept[pass ? kept.length - 1 - k : k];
            while (ring.length >= start + 2 && turn(ring[ring.length - 2], ring[ring.length - 1], p) <= 0) ring.pop();
            ring.push(p);
          }
          ring.pop();
        }
        if (ring.length > 2) {
          let mx = 0, my = 0;
          for (const p of ring) { mx += p[0] / ring.length; my += p[1] / ring.length; }
          const own = TETHERS[this.S.lv.tether], dark = { a: '#16121c', b: '#16121c', dash: 1 };
          const line = [this.along(h, h.S)];
          for (let k = 1; k < h.route.length; k++) if (h.cum[k] > h.S) line.push(h.route[k]);
          if (this.over) this.ropes.push({ pts: line.map(([x, y]) => [x - ox, y - oy]).reverse(), style: own });
          else for (const pass of [1, 0]) for (let i = 0; i + 1 < line.length; i++) {
            const a = line[i], b = line[i + 1];
            if (Math.max(a[0], b[0]) - ox < -2 || Math.max(a[1], b[1]) - oy < -2 || Math.min(a[0], b[0]) - ox > W + 2 || Math.min(a[1], b[1]) - oy > H + 2) continue;
            this.drawSpan(a[0] - ox, a[1] - oy, b[0] - ox, b[1] - oy, pass ? dark : own, pass);
          }
          // The loop lies like rope, not like a line drawn from bit to bit: it is the heap's outline as a distance
          // from its middle in each direction, eased round the loop and over time, and drawn as one smooth curve.
          // Slack at first, drawn tight as the blocks break up.
          const M = 28, slack = 2.5 + 3 * Math.max(0, 1 - h.t / h.gathered), want = new Float32Array(M), loop = h.loop ??= new Float32Array(M);
          const ease = h.loopAt === undefined ? 1 : Math.max(0, Math.min(1, (this.time - h.loopAt) * 16));
          h.loopAt = this.time;
          for (let i = 0; i < M; i++) {
            const ux = Math.cos(i / M * 6.2832), uy = Math.sin(i / M * 6.2832);
            let far = Infinity;
            for (let k = 0; k < ring.length; k++) {
              const a = ring[k], b = ring[(k + 1) % ring.length], ex = b[0] - a[0], ey = b[1] - a[1], den = ux * ey - uy * ex;
              if (Math.abs(den) < 1e-6) continue;
              const t = ((a[0] - mx) * ey - (a[1] - my) * ex) / den, v = ((a[0] - mx) * uy - (a[1] - my) * ux) / den;
              if (t > 0 && v >= -0.001 && v <= 1.001 && t < far) far = t;
            }
            want[i] = (far === Infinity ? 4 : far) + slack;
          }
          const round = [];
          for (let i = 0; i < M; i++) {
            loop[i] += (want[(i + M - 1) % M] * 0.25 + want[i] * 0.5 + want[(i + 1) % M] * 0.25 - loop[i]) * ease;
            round.push([mx + Math.cos(i / M * 6.2832) * loop[i], my + Math.sin(i / M * 6.2832) * loop[i]]);
          }
          if (Math.max(mx, my) > -80 && mx < W + 80 && my < H + 80) {
            if (this.over) this.ropes.push({ pts: round, style: own, loop: true });
            else for (const pass of [1, 0]) this.rope(round, true, pass ? dark : own, pass);
          }
        }
      }
    }
    // Spore clouds.
    for (const c of this.clouds) {
      // (A pod that rimed leaves no cloud, and one burnt off a thin one: js/game.js, `trigger`.)
      if (c.rime) continue;
      ctx.globalAlpha = Math.min(1, (c.life - c.t) * 2) * (c.burnt ? 0.4 : 0.85);
      const f = frameAt('spore', 'area', (c.t * 1000) % (duration('spore', 'area') * 0.8));
      if (f) draw(ctx, 'spore', f, (c.x + 0.5) * T - ox - f[2] / 2, (c.y + 0.5) * T - oy - f[3] / 2);
      ctx.globalAlpha = 1;
    }
    // The creatures of the ground, under the dark: the lamp shows them (js/fauna.js).
    { const t0 = performance.now(); this.fauna.draw(this, ctx, ox, oy); this.timed('fauna', t0); }
    // The drill: turned to its heading, biting into what it cuts, stretched by speed and squashed by a knock.
    const speed = Math.hypot(d.vx, d.vy), bite = d.dig >= 0 ? 2 + Math.min(1, d.digT / d.digDur) * 4 + Math.sin(d.digT * 70) : 0;
    const dx = d.x * T - ox + Math.cos(d.ang) * bite, dy = d.y * T - oy + Math.sin(d.ang) * bite;
    const along = d.squash > 0 ? 0.82 : 1 + Math.min(0.3, speed / 90), across = d.squash > 0 ? 1.18 : 1 - Math.min(0.14, speed / 200);
    // Where there is the fine canvas (the tether's), the drill is drawn on it, at the screen's own resolution: it
    // stands exactly where it is, not on the nearest pixel of the game's, and turned to any heading each of its
    // pixels is still a clean square (`drawRopes`). With a panel up, and where there is no such canvas, it is drawn
    // here with the ground.
    const wake = speed > 14 ? [3, 2, 1].map(g => [0.34 - g * 0.09, dx - d.vx / speed * g * 7, dy - d.vy / speed * g * 7]) : [];
    // (Turned as it is fitted on the core: drawn so, and its heading left as it is. js/fit.js: `look`.)
    this.drillDrawn = [dx, dy, d.ang + this.fitter.look.spin, this.S.lv.drill, this.S.lv.momentum, d.mode !== 'dead' && (d.dig >= 0 || speed > 1) ? now : -1, along, across];
    // A wreck is dark; a drill that has just been knocked blinks for as long as nothing can knock it again.
    const alpha = d.mode === 'dead' ? 0.5 : this.shield > 0 && ((now / 70) | 0) % 2 === 0 ? 0.35 : 1, hurt = this.hurt > 0 && ((now / 50) | 0) % 2 === 1;
    this.drillFine = this.over && this.shopRise <= 0.02 && this.labRise <= 0.02 ? { wake, alpha, hurt } : null;
    if (!this.drillFine) {
      // Speed leaves a wake: fading copies of the drill back along the way it came.
      for (const [a, wx, wy] of wake) { ctx.globalAlpha = a; this.drawDrill(wx, wy, d.ang, this.S.lv.drill, this.S.lv.momentum, -1, along, across); }
      ctx.globalAlpha = alpha;
      this.drawDrill(...this.drillDrawn, ctx, this.S.lv.hull, null, this.fitter.look);
      ctx.globalAlpha = 1;
      // (What rides on the drill: the pal on its tail, a leech on its hull.)
      this.fauna.rider(this, ctx, this.drillDrawn[0], this.drillDrawn[1], d.ang, alpha);
      if (hurt) { ctx.globalAlpha = 0.5; ctx.fillStyle = '#ff5a4a'; ctx.fillRect(Math.round(dx) - 5, Math.round(dy) - 5, 10, 10); ctx.globalAlpha = 1; }
    }
    // What the ground's feel lets fall and drift, under the dark.
    this.feel.dust(this, ctx, ox, oy);
    for (const e of this.effects) {
      const f = frameAt(e.sheet, e.animation, e.t);
      if (f) draw(ctx, e.sheet, f, e.x - ox - f[2] / 2, e.y - oy - f[3] / 2);
    }
    for (const p of this.parts) {
      const px = Math.round(p.x - ox), py = Math.round(p.y - oy), fade = 1 - p.t / p.life;
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      ctx.globalAlpha = Math.min(1, fade * 2); ctx.fillStyle = p.color;
      if (p.star) { const arm = fade > 0.5 ? 2 : 1; ctx.fillRect(px - arm, py, arm * 2 + 1, 1); ctx.fillRect(px, py - arm, 1, arm * 2 + 1); }
      else ctx.fillRect(px, py, p.size, p.size);
    }
    // (The ground's wind, a gust, leans them over as it blows, each a little differently: only as they are drawn.)
    const lean = this.feel.drift;
    for (const m of this.motes) {
      const mx = m.x + lean * (0.7 + 0.3 * Math.sin(m.seed));
      if (w.peek(Math.floor(mx / T), Math.floor(m.y / T)) !== K.EMPTY) continue;
      ctx.globalAlpha = Math.max(0, Math.min(1, m.t, m.life - m.t)) * (0.35 + 0.3 * Math.sin(this.time * 3 + m.seed)); ctx.fillStyle = m.mote[0];
      // (A ground's motes may be small sprites of the `air` sheet, in the mote's colour: flakes, embers, spores.)
      if (m.air) { const f = frameAt('air', m.air, now + m.seed * 97); ctx.drawImage(tinted('air', m.mote[0]), f[0], f[1], f[2], f[3], Math.round(mx - ox) - (f[2] >> 1), Math.round(m.y - oy) - (f[3] >> 1), f[2], f[3]); }
      else ctx.fillRect(Math.round(mx - ox), Math.round(m.y - oy), 1, 1);
    }
    ctx.globalAlpha = 1;
    { const t0 = performance.now(); this.light(ox, oy); this.timed('light', t0); }
    // What the ground's feel lights over the dark, and the layers over the whole view.
    { const t0 = performance.now(); this.feel.glow(this, ctx, ox, oy); this.timed('feel', t0); }
    // What the upgrades show glowing: sparks, flame, light about the station, the lamp's flare (js/fit.js).
    { const t0 = performance.now(); this.fitter.glow(this, ctx, ox, oy, now); this.timed('fit', t0); }
    // A foe's eyes, seen across the dark, and the light of what glows among the creatures.
    { const t0 = performance.now(); this.fauna.glow(this, ctx, ox, oy); this.timed('fauna', t0); }
    // Ground lying loose: cut off from the world, waiting for the tether to be drawn round it. It shows through the
    // dark, with a dotted edge that crawls round it.
    if (this.pieceOf.size) {
      // (The cells in view are asked whether they are loose: however much ground lies loose elsewhere.)
      const set = this.pieceOf, crawl = (now / 90) | 0;
      for (let cy = Math.floor(oy / T); cy <= Math.floor((oy + H) / T); cy++) for (let cx = Math.floor(ox / T); cx <= Math.floor((ox + W) / T); cx++) {
        const i = cy * N + cx;
        if (!set.has(i)) continue;
        const px = cx * T - ox, py = cy * T - oy;
        ctx.fillStyle = '#84dcff'; ctx.globalAlpha = 0.16 + 0.08 * Math.sin(now / 260);
        ctx.fillRect(px, py, T, T);
        ctx.globalAlpha = 0.95;
        for (let n = 0; n < T; n++) {
          if ((n + crawl) & 3) continue;
          if (!set.has(i - N)) ctx.fillRect(px + n, py, 1, 1);
          if (!set.has(i + N)) ctx.fillRect(px + T - 1 - n, py + T - 1, 1, 1);
          if (!set.has(i - 1)) ctx.fillRect(px, py + T - 1 - n, 1, 1);
          if (!set.has(i + 1)) ctx.fillRect(px + T - 1, py + n, 1, 1);
        }
      }
      ctx.globalAlpha = 1;
    }
    this.drawRareSigns(ctx, ox, oy, now);
    // A foe's warning, over the dark; and the creatures' words and rings.
    { const t0 = performance.now(); this.fauna.signs(this, ctx, ox, oy); this.timed('fauna', t0); }
    for (const r of this.rings) {
      // A ring of whole pixels spreading from a point (once its delay is over: `Game.ring`).
      if (r.t < 0) continue;
      const u = r.t / (r.life ?? 0.5), rad = r.reach * (1 - (1 - u) * (1 - u)), n = Math.max(12, (rad * 1.6) | 0);
      ctx.globalAlpha = (1 - u) * 0.9; ctx.fillStyle = r.color;
      for (let a = 0; a < n; a++) ctx.fillRect(Math.round(r.x - ox + Math.cos(a / n * 6.283) * rad), Math.round(r.y - oy + Math.sin(a / n * 6.283) * rad), 1, 1);
    }
    ctx.globalAlpha = 1;
    if (this.flash > 0) { ctx.globalAlpha = Math.min(0.45, this.flash * 1.4); ctx.fillStyle = '#fff6c8'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    for (const p of this.popups) {
      const py = p.y - oy - p.t * 18, px = p.x - ox;
      ctx.globalAlpha = Math.min(1, (0.9 - p.t) * 4);
      // (An icon and its figure centred as one on where the haul was, measured once a popup.)
      if (p.icon) {
        if (!(p.w > 0)) p.w = textWidth(p.label) + UI.ICON + (typeof p.icon === 'string' ? 0 : 1);
        const lx = Math.round(px - p.w / 2);
        if (typeof p.icon === 'string') draw(ctx, 'icons', p.icon, lx, py); else this.drawMineral(ctx, p.icon[1], lx - 1, py + UI.PIC_DY);
        text(ctx, p.label, lx + p.w, py, p.color, 1);
      } else text(ctx, p.label, px, py, p.color, 0.5);
      ctx.globalAlpha = 1;
    }
    { const t0 = performance.now(); this.drawHud(ox, oy); this.timed('hud', t0); }
    if (this.over) { const t0 = performance.now(); this.drawRopes(ox, oy); this.timed('ropes', t0); }
  }

  // The drill as its upgrades have made it (the bit's metal, whatever the ram has bolted on, the hull's plates, what
  // is fitted), drawn about its middle at any heading, `along` and `across` times its size. `fitted` is a row drawn
  // a level on from where it is (the shop's picture of what it will look like); `look` is what the drill shows this
  // frame beyond its levels (js/fit.js: `Fitter.look`): the flame behind it, the bit hot, what is fitted lit, the
  // whole of it flashed a colour. Every alpha is the caller's times its own, so a drill that blinks or lies wrecked
  // blinks and lies dim with all of it; and the drawing never changes how it is laid on, so where it is drawn to cut
  // the tether away in its shape (with no look: no flame) the cut is its shape and nothing more.
  drawDrill(x, y, ang, bit, ram, now, along = 1, across = 1, ctx = this.ctx, plates = this.S.lv.hull, fitted = null, look = null) {
    bit = Math.min(bit, 7); ram = Math.min(ram, 6); plates = Math.min(plates, 7);
    const s = sheets.drill, F = s.frames, base = ctx.globalAlpha, body = now >= 0 ? frameAt('drill', BODY[bit], now) : F[BODY_A[bit]];
    ctx.save();
    // (On the game's own canvas it stands on a whole pixel; on a finer one, exactly where it is.)
    if (ctx === this.ctx) ctx.translate(Math.round(x), Math.round(y)); else ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(along, across);
    if (look !== null && look.flame > 0 && ram >= 3) {
      const r = frameAt('drill', FLAME[FLAME_TIER[ram]], Math.max(0, now));
      ctx.globalAlpha = base * look.flame; ctx.drawImage(s.image, r[0], r[1], r[2], r[3], -24, -8, 16, 16); ctx.globalAlpha = base;
    }
    const hot = look !== null && look.heat > 0 && bit >= 3 ? (now >= 0 ? frameAt('drill', HOT[bit], now) : F[HOT_A[bit]]) : null;
    this.drillParts(ctx, s.image, F, body, hot, look === null ? 0 : look.heat, bit, ram, plates, fitted, look === null ? 0 : look.lit, base);
    if (look !== null && look.tintAlpha > 0) { ctx.globalAlpha = base * look.tintAlpha; this.drillParts(ctx, tinted('drill', look.tint), F, body, null, 0, bit, ram, plates, fitted, look.lit, base * look.tintAlpha); }
    ctx.restore();
  }
  // The drill's parts in turn, from `image` (the sheet, or the sheet in one colour): the ram, the body, the bit hot,
  // the plates, and what is fitted, plain or lit.
  drillParts(ctx, image, F, body, hot, heat, bit, ram, plates, fitted, lit, alpha) {
    if (ram > 0) { const r = F[RAM[ram]]; ctx.drawImage(image, r[0], r[1], r[2], r[3], -8, -8, 16, 16); }
    ctx.drawImage(image, body[0], body[1], body[2], body[3], -8, -8, 16, 16);
    if (hot !== null) { ctx.globalAlpha = alpha * heat; ctx.drawImage(image, hot[0], hot[1], hot[2], hot[3], -8, -8, 16, 16); ctx.globalAlpha = alpha; }
    if (plates > 0) { const r = F[PLATE[plates]]; ctx.drawImage(image, r[0], r[1], r[2], r[3], -8, -8, 16, 16); }
    const S = this.S;
    for (let k = 0; k < FITS.length; k++) {
      const f = FITS[k], most = f.frames.length - 1, level = f.id === fitted ? Math.min(most, S.lv[f.id] + 1) : Math.min(most, S.lv[f.id]);
      if (level <= 0) continue;
      const r = F[(f.long && bit >= 5 ? f.long : f.frames)[level][(lit & f.bit) ? 1 : 0]];
      ctx.drawImage(image, r[0], r[1], r[2], r[3], -8, -8, 16, 16);
    }
  }
  // The tether and the loops round hauls, drawn on the canvas laid over the game at the screen's own resolution: smooth
  // lines whatever way they lie, rounded where they turn a corner, then shaded by the same darkness as the ground and
  // cut away where the interface is. Lengths here are in the game's pixels; the canvas is `scale` times finer.
  drawRopes(ox, oy) {
    const o = this.overCtx, k = this.scale, { W, H } = this;
    o.setTransform(1, 0, 0, 1, 0, 0);
    if (this.ropeDirty) { const [x0, y0, x1, y1] = this.ropeDirty; o.clearRect(x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k); }
    this.ropeDirty = null;
    const fine = this.drillFine && this.drillDrawn ? this.drillFine : null;
    if ((!this.ropes.length && !fine) || this.shopRise > 0.02 || this.labRise > 0.02) return;
    o.setTransform(k, 0, 0, k, 0, 0);
    o.lineJoin = 'round';
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const r of this.ropes) {
      const pts = r.pts;
      if (pts.length < 2) continue;
      const wide = r.style.thick ? 2 : r.style.fine ? 1 : 1.4, braid = r.style.b !== r.style.a, turn = BRAID * (r.style.turn ?? 1);
      // A rope that is no loop is traced only where it crosses the view (`ropeRuns`). Far out nearly all of the
      // tether lies off the screen, and so does nearly all of the rope of every haul on its way home: traced whole,
      // three times each, a dozen hauls a thousand cells out were a dozen ropes twenty thousand pixels long in every
      // frame, and a phone stood still drawing them.
      // (A rope that lights run along is measured as a braided one is: the lights keep their places on it.)
      const runs = r.loop ? null : this.ropeRuns(pts, braid || !!r.pulse);
      r.runs = runs; r.wide = wide;
      if (runs !== null && !runs.length) continue;
      const trace = (dy, only = null) => {
        o.beginPath();
        if (r.loop) {
          // A closed curve through the middles of its sides.
          const n = pts.length, mid = i => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2 + dy];
          o.moveTo(...mid(0));
          for (let i = 1; i <= n; i++) o.quadraticCurveTo(pts[i % n][0], pts[i % n][1] + dy, ...mid(i));
          o.closePath();
          return;
        }
        for (const [from, to] of only ? [only] : runs) {
          o.moveTo(pts[from][0], pts[from][1] + dy);
          for (let i = from + 1; i <= to; i++) {
            const [x, y] = pts[i], [px, py] = pts[i - 1];
            if (r.wob && Math.hypot(x - px, y - py) < 600) {
              // A plucked string: each span bows across itself.
              const len = Math.hypot(x - px, y - py) || 1;
              o.quadraticCurveTo((px + x) / 2 - (y - py) / len * r.wob * 2, (py + y) / 2 + (x - px) / len * r.wob * 2 + dy, x, y + dy);
            } else if (i < to) {
              // Round the corner, as wide as the shorter span beside it allows.
              const nx = pts[i + 1][0], ny = pts[i + 1][1];
              o.arcTo(x, y + dy, nx, ny + dy, Math.min(ROUND, Math.hypot(x - px, y - py) / 2, Math.hypot(nx - x, ny - y) / 2));
            } else o.lineTo(x, y + dy);
          }
        }
      };
      r.trace = trace;
      o.setLineDash(NO_DASH); o.lineCap = 'round';
      o.strokeStyle = 'rgba(10, 8, 16, 0.7)'; o.lineWidth = wide + 1.2; trace(0.8); o.stroke();
      o.strokeStyle = r.style.a; o.lineWidth = wide; trace(0); o.stroke();
      if (braid) {
        // The second strand of the braid, in short lengths along it: each part of the rope begins its lengths where
        // the whole rope would have them, so the braid stays put on the ground whatever part of it is in view.
        // (A chain's links are the strand drawn wide with round ends.)
        o.lineCap = r.style.links ? 'round' : 'butt'; o.setLineDash(r.style.braid ??= [turn * r.style.dash, turn * (1 - r.style.dash)]);
        o.strokeStyle = r.style.b; o.lineWidth = wide * (r.style.links ?? 0.62);
        if (r.loop) { trace(0); o.stroke(); }
        else for (const run of runs) { o.lineDashOffset = run[2] % turn; trace(0, run); o.stroke(); }
        o.lineDashOffset = 0; o.setLineDash(NO_DASH);
      }
      // Its knots, or its stars, every so far along it, where the whole rope would have them.
      if (r.style.knot) {
        o.lineCap = 'round'; o.setLineDash(r.style.knots ??= [0.01, r.style.every]); o.strokeStyle = r.style.knot; o.lineWidth = wide + 1.4;
        if (r.loop) { trace(0); o.stroke(); }
        else for (const run of runs) { o.lineDashOffset = run[2] % r.style.every; trace(0, run); o.stroke(); }
        o.lineDashOffset = 0; o.setLineDash(NO_DASH);
      }
      // (The trophy line's barbs, on the tether out to the drill: js/fit.js.)
      if (r.pulse) this.fitter.barbs(this, o, r);
      if (r.loop) for (const [x, y] of pts) { bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); }
      else for (const [from, to] of runs) for (let i = from; i <= to; i++) { const [x, y] = pts[i]; bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); }
    }
    // (The drill and its wake are drawn here too: their place is cleared with the ropes'.)
    // (A box about each of them as wide as the ram's flame reaches behind the drill at any heading.)
    if (fine) for (const [x, y] of [[this.drillDrawn[0], this.drillDrawn[1]], ...fine.wake.map(([, wx, wy]) => [wx, wy])]) { bx0 = Math.min(bx0, x - 24); by0 = Math.min(by0, y - 24); bx1 = Math.max(bx1, x + 24); by1 = Math.max(by1, y + 24); }
    if (bx0 > bx1) return;
    bx0 = Math.max(0, Math.floor(bx0 - 12)); by0 = Math.max(0, Math.floor(by0 - 12)); bx1 = Math.min(W, Math.ceil(bx1 + 12)); by1 = Math.min(H, Math.ceil(by1 + 12));
    this.ropeDirty = [bx0, by0, bx1, by1];
    // In the dark it is as dim as the ground it lies on.
    if (this.dark && this.darkAt) {
      o.globalCompositeOperation = 'source-atop'; o.imageSmoothingEnabled = true; o.globalAlpha = 0.85;
      o.drawImage(this.dark, ...this.darkAt);
      o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1;
    }
    // From the seventh reach, light runs along the tether from the core out to the drill, over the dark: a short
    // dash every so far along it, moving, each part of the rope's dashes where the whole rope would have them.
    for (const r of this.ropes) {
      const style = r.style;
      if (!r.pulse || !style.glow || !r.runs || !r.runs.length) continue;
      // (A glow about it first, where it has one.)
      if (style.halo) {
        o.globalCompositeOperation = 'lighter'; o.globalAlpha = 0.22; o.lineCap = 'round'; o.strokeStyle = style.halo; o.lineWidth = r.wide + 3.5;
        for (const run of r.runs) { r.trace(0, run); o.stroke(); }
        o.globalAlpha = 1; o.globalCompositeOperation = 'source-over';
      }
      const period = 3 + style.gap;
      o.globalCompositeOperation = 'lighter'; o.lineCap = 'butt'; o.setLineDash(style.dashes); o.lineWidth = r.wide + 0.6;
      for (let pass = 0; pass < (style.twin ? 2 : 1); pass++) {
        o.strokeStyle = pass ? style.twin : style.glow;
        for (const run of r.runs) { o.lineDashOffset = ((run[2] - this.time * style.run + pass * period / 2) % period + period) % period; r.trace(0, run); o.stroke(); }
      }
      o.lineDashOffset = 0; o.setLineDash(NO_DASH); o.globalCompositeOperation = 'source-over';
    }
    // The tether lies under the drill: it is cut away in the drill's own shape, so that at the core, where its end
    // is made fast under the drill, and wherever the drill flies back over it, the drill is whole on top.
    if (this.drillDrawn) {
      o.globalCompositeOperation = 'destination-out'; o.imageSmoothingEnabled = false;
      this.drawDrill(...this.drillDrawn, o);
      o.globalCompositeOperation = 'source-over';
    }
    // The drill itself, with its wake behind it, each pixel of it as many of the screen's as the game is scaled by.
    if (fine) {
      const [dx, dy, ang, bit, ram, , along, across] = this.drillDrawn;
      o.imageSmoothingEnabled = false;
      for (const [a, wx, wy] of fine.wake) { o.globalAlpha = a; this.drawDrill(wx, wy, ang, bit, ram, -1, along, across, o); }
      o.globalAlpha = fine.alpha;
      this.drawDrill(...this.drillDrawn, o, this.S.lv.hull, null, this.fitter.look);
      o.globalAlpha = 1;
      this.fauna.rider(this, o, dx, dy, this.drill.ang, fine.alpha);
      if (fine.hurt) { o.globalAlpha = 0.5; o.fillStyle = '#ff5a4a'; o.fillRect(dx - 5, dy - 5, 10, 10); o.globalAlpha = 1; }
    }
    // Never over the interface: the bar at the foot, the map, the buttons, and the small panels that come and go under the
    // top bar (a place's plate, the count of specimens) and over the bar (a thing's worth first seen), which the frame's
    // own drawing of the interface listed.
    o.clearRect(0, H - 44, W, 44);
    if (this.mapRect) o.clearRect(...this.mapRect);
    for (const b of this.buttons) o.clearRect(b.x, b.y, b.w, b.h);
    for (const p of this.panels) o.clearRect(...p);
  }
  // The parts of a rope that cross the view, each [its first point, its last, how far along the whole rope it
  // begins]. A part is the spans that come within a few pixels of the screen, and one span more at each end so that
  // the corners beside the view are rounded as they are in the whole rope; parts that meet are one. The distance
  // (asked for a braided rope: it is where the braid's short lengths begin) is measured along the rope as it is
  // drawn, round every corner's arc and not through its point, so a part traced alone lies on the pixels the whole
  // rope would have drawn there. Nothing here is in proportion to the rope's length but a little arithmetic.
  ropeRuns(pts, braid = false) {
    const { W, H } = this, n = pts.length, m = 12, runs = [];
    for (let i = 1; i < n; i++) {
      const a = pts[i - 1], b = pts[i];
      if (Math.max(a[0], b[0]) < -m || Math.min(a[0], b[0]) > W + m || Math.max(a[1], b[1]) < -m || Math.min(a[1], b[1]) > H + m) continue;
      const from = Math.max(0, i - 2), to = Math.min(n - 1, i + 1), last = runs[runs.length - 1];
      if (last && from <= last[1]) last[1] = to; else runs.push([from, to, 0]);
    }
    const far = runs.length ? runs[runs.length - 1][0] : 0;
    if (!braid || far === 0) return runs;
    // Along the rope from its first point: straight to where each corner's arc begins, round the arc, and on from
    // where it ends. A part that begins at a corner begins at the corner's own point, short of the arc's end by
    // the length of its tangent.
    let cx = pts[0][0], cy = pts[0][1], len = 0, next = runs[0][0] === 0 ? 1 : 0;
    for (let i = 1; i <= far; i++) {
      const [x, y] = pts[i], [px, py] = pts[i - 1], [nx, ny] = pts[i + 1];
      const r = Math.min(ROUND, Math.hypot(x - px, y - py) / 2, Math.hypot(nx - x, ny - y) / 2);
      const ax = cx - x, ay = cy - y, al = Math.hypot(ax, ay), bx = nx - x, by = ny - y, bl = Math.hypot(bx, by);
      let t = 0, arc = 0;
      if (r > 0 && al > 0 && bl > 0) {
        const cos = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (al * bl)));
        if (1 - cos > 1e-9) { t = r * Math.sqrt((1 + cos) / (1 - cos)); arc = r * (Math.PI - Math.acos(cos)); }
      }
      len += Math.abs(al - t) + arc;
      cx = x + (bl ? bx / bl * t : 0); cy = y + (bl ? by / bl * t : 0);
      while (next < runs.length && runs[next][0] === i) runs[next++][2] = len - t;
    }
    return runs;
  }
  // A rope through `pts` (a closed loop if `closed`), as one clean line of pixels: a smooth curve through the points,
  // with no doubled corners.
  rope(pts, closed, style, off = 0) {
    const { ctx } = this, n = pts.length, px = [];
    const at = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = at(i - 1), b = at(i), c = at(i + 1), e = at(i + 2), steps = Math.max(2, Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]) * 2));
      for (let k = 0; k < steps; k++) {
        const t = k / steps, t2 = t * t, t3 = t2 * t;
        const X = Math.round(0.5 * (2 * b[0] + (c[0] - a[0]) * t + (2 * a[0] - 5 * b[0] + 4 * c[0] - e[0]) * t2 + (3 * b[0] - a[0] - 3 * c[0] + e[0]) * t3));
        const Y = Math.round(0.5 * (2 * b[1] + (c[1] - a[1]) * t + (2 * a[1] - 5 * b[1] + 4 * c[1] - e[1]) * t2 + (3 * b[1] - a[1] - 3 * c[1] + e[1]) * t3)) + off;
        const last = px.length - 2;
        if (last >= 0 && px[last] === X && px[last + 1] === Y) continue;
        // A pixel that only joins two that already touch at a corner is taken out.
        if (last >= 2 && Math.abs(X - px[last - 2]) === 1 && Math.abs(Y - px[last - 1]) === 1) { px[last] = X; px[last + 1] = Y; continue; }
        px.push(X, Y);
      }
    }
    ctx.fillStyle = style.a;
    for (let k = 0; k < px.length; k += 2) ctx.fillRect(px[k], px[k + 1], 1, 1);
    if (style.b !== style.a) { ctx.fillStyle = style.b; for (let k = 0; k < px.length; k += 2) if (((k >> 1) & 3) < style.dash * 4) ctx.fillRect(px[k], px[k + 1], 1, 1); }
  }
  // A span of tether in the style of a level of reach.
  drawSpan(x0, y0, x1, y1, style, off = 0) {
    const { ctx } = this;
    ctx.fillStyle = style.a; this.line(x0, y0 + off, x1, y1 + off);
    if (style.b !== style.a) { ctx.fillStyle = style.b; this.line(x0, y0 + off, x1, y1 + off, style.dash); }
  }
  chunk(cx, cy) {
    const key = cy * 4096 + cx;
    let c = this.chunks.get(key);
    if (!c) {
      // Far-off pieces are dropped, so a long journey does not hold every piece it passed.
      if (this.chunks.size > 180) for (const [k, old] of this.chunks) if (Math.abs(old.cx - cx) > 9 || Math.abs(old.cy - cy) > 12) { this.chunks.delete(k); this.wild?.delete(k); this.glowing?.delete(k); }
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 128;
      c = { canvas, ctx: canvas.getContext('2d', { alpha: false }), v: -1, cx, cy, ops: null };
      this.chunks.set(key, c);
    }
    // A piece is drawn again only if its drawing has changed (`Sketch`).
    if (c.v !== this.version) {
      c.v = this.version;
      sketch.n = 0; this.paint(sketch, cx * 8, cy * 8);
      if (!sketch.same(c.ops)) { c.ops = sketch.ops.slice(0, sketch.n); replay(c.ops, c.ctx); }
    }
    return c.canvas;
  }
  // Everything in a piece of ground that stays put: floors, rock, ore and armour. It is drawn into a Sketch, which
  // takes only the calls made here: a new kind of call wants a place in the Sketch first.
  paint(ctx, x0, y0) {
    const w = this.world;
    ctx.globalAlpha = 1; ctx.fillStyle = '#07060b'; ctx.fillRect(0, 0, 128, 128);
    this.lights(x0, y0);
    for (let y = y0; y < y0 + 8; y++) for (let x = x0; x < x0 + 8; x++) {
      const i = y * N + x, k = w.k(i), b = w.b(i), row = rowOf(b), px = (x - x0) * T, py = (y - y0) * T;
      const floorSheet = row.floor, floors = sheets[floorSheet].tiles[255], floor = floors[(cellHash(x, y, 1) * floors.length) | 0];
      if (!w.s(i)) {
        // Ground the scanner has not reached: only whose it is shows, dimly.
        if (k !== K.BEDROCK) { ctx.globalAlpha = 0.42; draw(ctx, floorSheet, floor, px, py); ctx.globalAlpha = 1; }
        continue;
      }
      const m = k === K.EMPTY ? 255 : w.mask(x, y);
      if (m !== 255 || k === K.EMPTY) draw(ctx, floorSheet, floor, px, py);
      if (k === K.EMPTY) { this.adorn(ctx, i, x, y, row, px, py); continue; }
      const sheet = this.rockSheet(k, b), rects = sheets[sheet].tiles[m];
      draw(ctx, sheet, rects[(cellHash(x, y, 3) * rects.length) | 0], px, py);
      const ux = px - ((m & 4) ? 0 : 1), uy = py - ((m & 16) ? 0 : 1);
      if (k === K.SLATE || k === K.VAULT) draw(ctx, 'tough', k === K.SLATE ? 'slate' : 'vault', ux, uy);
      const over = this.overlay(k, row, i);
      if (over && over[1] !== 'hazard' && over[1] !== 'relic' && over[1] !== 'prism') draw(ctx, over[0], over[1], ux, uy);
      // A glaze's panes: a line of light along the top and left of each, a line of dark along its foot and right,
      // wherever the ice beside is of another pane.
      if (row.pocket?.twist === 'pane') {
        const Z = w.pocketOf(x, y);
        if (Z !== null && Z.row === b) {
          const own = w.paneKey(Z, x, y), other = (u, v) => w.k(i + v * N + u) !== K.EMPTY && w.b(i + v * N + u) === b && w.paneKey(Z, x + u, y + v) !== own;
          ctx.fillStyle = 'rgba(200, 244, 255, 0.5)';
          if (other(-1, 0)) ctx.fillRect(px, py, 1, T);
          if (other(0, -1)) ctx.fillRect(px, py, T, 1);
          ctx.fillStyle = 'rgba(6, 16, 38, 0.6)';
          if (other(1, 0)) ctx.fillRect(px + T - 1, py, 1, T);
          if (other(0, 1)) ctx.fillRect(px, py + T - 1, T, 1);
        }
      }
    }
  }

  // ---- each ground's own pieces in its caves (js/decor.js), drawn into the pieces of ground with the floors.
  // An open cell's piece of decor, or failing that the mark on its back wall, drawn over its floor. None is drawn
  // under lava (it runs into tunnels, and is drawn over them each frame with its corners rounded), and no icicle
  // where one has fallen (`game.fallen`). A piece that glows is written down for `glowsIn`.
  adorn(ctx, i, x, y, row, px, py) {
    if (row.decor === null || row.decor === undefined || this.world.lava.has(i)) return;
    let f = decorAt(this.world, i, x, y, row, this.wilds ??= j => this.wildAt(j));
    if (f !== null && this.fallen?.has(i) && placeOf(f) === 'top') f = null;
    if (f === null) f = markAt(x, y, row);
    if (f === null) return;
    const what = framesOf().frame.get(f);
    draw(ctx, what.sheet, f, px, py);
    if (what.glow) this.shining.push(i, what.glow[0], what.glow[1], what.glow[2]);
  }
  // The frame of the piece or the mark that cell `i` shows (in view or not), or null.
  decorOf(i) {
    const w = this.world, x = i & (N - 1), y = i >>> 14, row = w.row(i);
    if (w.k(i) !== K.EMPTY || !w.s(i) || row.decor === null || row.decor === undefined || w.lava.has(i)) return null;
    const f = decorAt(w, i, x, y, row, this.wilds ??= j => this.wildAt(j));
    return f !== null && !(this.fallen?.has(i) && placeOf(f) === 'top') ? f : markAt(x, y, row);
  }
  // The piece of ground cell `i` is in is drawn again at the next frame (an icicle has fallen from it), and no other.
  redraw(i) { const c = this.chunks.get(((i >>> 14) >> 3) * 4096 + ((i & (N - 1)) >> 3)); if (c) c.v = -1; }
  // Whether the seed left cell `i` open (js/decor.js: `natural`): asked of the world once for each cell, and kept
  // with the piece of ground the cell is in, for as long as that piece is kept and the world is the same.
  wildAt(i) {
    const w = this.world, x = i & (N - 1), y = i >>> 14, key = (y >> 3) * 4096 + (x >> 3), book = this.wild ??= new Map();
    let e = book.get(key);
    if (!e || e.seed !== w.seed) book.set(key, e = { seed: w.seed, cells: new Uint8Array(64) });
    const at = ((y & 7) << 3) | (x & 7);
    if (e.cells[at] === 0) e.cells[at] = natural(w, i, x, y) ? 1 : 2;
    return e.cells[at] === 1;
  }
  // The glowing pieces of the piece of ground at (x0, y0), written down afresh each time it is painted: four
  // numbers to a glow, its cell, where in the cell it is and its halo.
  lights(x0, y0) {
    this.shining = [];
    (this.glowing ??= new Map()).set((y0 >> 3) * 4096 + (x0 >> 3), this.shining);
  }
  // The glowing pieces in view (DECOR_MOST of them at the most, the nearest the drill): each has its halo laid over
  // the dark (`halos`), and the nearest DECOR_GLOWS light the cave a little, each wavering in its own time. Kept in
  // arrays made once.
  glowsIn(ox, oy) {
    const G = this.glows ??= { n: 0, at: new Int32Array(DECOR_MOST), gx: new Float32Array(DECOR_MOST), gy: new Float32Array(DECOR_MOST), halo: new Array(DECOR_MOST), far: new Float32Array(DECOR_MOST), order: new Int32Array(DECOR_MOST) };
    const { W, H } = this, d = this.drill;
    G.n = 0;
    if (!this.glowing) return;
    const x0 = Math.floor(ox / T) - 1, y0 = Math.floor(oy / T) - 1, x1 = Math.floor((ox + W) / T) + 1, y1 = Math.floor((oy + H) / T) + 1;
    for (let cy = y0 >> 3; cy <= y1 >> 3; cy++) for (let cx = x0 >> 3; cx <= x1 >> 3; cx++) {
      const list = this.glowing.get(cy * 4096 + cx);
      if (!list) continue;
      for (let k = 0; k < list.length; k += 4) {
        const i = list[k], x = i & (N - 1), y = i >>> 14;
        if (x < x0 || x > x1 || y < y0 || y > y1) continue;
        const far = (x + 0.5 - d.x) ** 2 + (y + 0.5 - d.y) ** 2;
        let n = G.n;
        // (Once there are as many as there may be, a nearer one takes the place of the furthest.)
        if (n === DECOR_MOST) { let worst = 0; for (let m = 1; m < n; m++) if (G.far[m] > G.far[worst]) worst = m; if (G.far[worst] <= far) continue; n = worst; } else G.n++;
        G.at[n] = i; G.gx[n] = list[k + 1]; G.gy[n] = list[k + 2]; G.halo[n] = list[k + 3]; G.far[n] = far;
      }
    }
    const n = G.n, order = G.order;
    for (let m = 0; m < n; m++) {
      let k = m;
      while (k > 0 && G.far[order[k - 1]] > G.far[m]) { order[k] = order[k - 1]; k--; }
      order[k] = m;
    }
    for (let m = 0; m < Math.min(n, DECOR_GLOWS); m++) {
      const i = G.at[order[m]], x = i & (N - 1), y = i >>> 14;
      this.shine(x, y, DECOR_GLOW + 0.04 * Math.sin(this.time * 1.7 + cellHash(x, y, 27) * 6.28), DECOR_REACH);
    }
  }
  // The halos of the glowing pieces in view, over the dark, in their own colours, each breathing in its own time.
  // Not in daylight (a staged picture with no dark), where there is nothing for them to show through.
  halos(ox, oy) {
    const G = this.glows, ctx = this.ctx;
    if (!G || !G.n || this.daylight || !sheets.halo) return;
    const s = sheets.halo, image = s.image;
    ctx.globalCompositeOperation = 'lighter';
    for (let m = 0; m < G.n; m++) {
      const i = G.at[m], x = i & (N - 1), y = i >>> 14, r = s.frames[G.halo[m]];
      ctx.globalAlpha = DECOR_HALO * (0.8 + 0.2 * Math.sin(this.time * 1.7 + cellHash(x, y, 27) * 6.28));
      ctx.drawImage(image, r[0], r[1], r[2], r[3], Math.round(x * T - ox + G.gx[m] - r[2] / 2), Math.round(y * T - oy + G.gy[m] - r[3] / 2), r[2], r[3]);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }

  // Light spreads from a cell through open ground, losing a little with every cell, and soaks a short way into
  // the rock it meets: so it takes the shape of the tunnels and lights the faces of their walls. It is worked out
  // in a window of cells round the view; `want` holds the brightest light to reach each cell this frame.
  shine(cx, cy, power, reach) {
    const L = this.lightMap, { want, solid: sol, cols, rows, queue, step } = L, x = cx - L.x0, y = cy - L.y0;
    if (x < 1 || y < 1 || x >= cols - 1 || y >= rows - 1 || want[y * cols + x] >= power) return;
    const qlen = queue.length, fade = power / reach;
    let head = 0, tail = 0;
    want[y * cols + x] = power; queue[tail++] = y * cols + x;
    while (head < tail) {
      const at = queue[head++], here = want[at], qx = at % cols, qy = (at / cols) | 0;
      if (qx < 1 || qy < 1 || qx >= cols - 1 || qy >= rows - 1) continue;
      const solid = sol[at];
      for (let s = 0; s < 8; s++) {
        const j = at + step[s];
        // Rock drinks light fast: a face is lit, the cell behind it barely.
        const next = here - fade * LIGHT_FAR[s] * (solid || sol[j] ? 2.6 : 1);
        if (next > want[j] + 0.01 && tail < qlen) { want[j] = next; queue[tail++] = j; }
      }
    }
  }
  // The dark, in the colour of the ground the drill is in, thinned wherever light reaches. It is worked out a cell
  // at a time and drawn smoothed, and each cell's light eases toward what it should be, so light trails the drill.
  light(ox, oy) {
    const { ctx, W, H } = this, d = this.drill, w = this.world, pad = 10;
    // The window is as many cells across and down whatever part of a cell the view begins on: were it a cell wider
    // on some frames than on others (as the view scrolls, wherever the screen is not a whole number of cells
    // across), the light would be made again from black each time, and the whole screen would flicker.
    const vx0 = Math.floor(ox / T) - 1, vy0 = Math.floor(oy / T) - 1, vx1 = vx0 + Math.ceil(W / T) + 2, vy1 = vy0 + Math.ceil(H / T) + 2;
    const x0 = vx0 - pad, y0 = vy0 - pad, cols = vx1 - vx0 + 1 + pad * 2, rows = vy1 - vy0 + 1 + pad * 2;
    let L = this.lightMap;
    if (!L || L.cols !== cols || L.rows !== rows) L = this.lightMap = { x0, y0, cols, rows, want: new Float32Array(cols * rows), lit: new Float32Array(cols * rows), next: new Float32Array(cols * rows), solid: new Uint8Array(cols * rows), queue: new Int32Array(4096), step: Int32Array.from(LIGHT_STEP, ([u, v]) => v * cols + u) };
    // The window follows the view: what was lit keeps its place in the world.
    if (L.x0 !== x0 || L.y0 !== y0) {
      const sx = x0 - L.x0, sy = y0 - L.y0;
      L.next.fill(0);
      for (let y = Math.max(0, -sy); y < Math.min(rows, rows - sy); y++) for (let x = Math.max(0, -sx); x < Math.min(cols, cols - sx); x++) L.next[y * cols + x] = L.lit[(y + sy) * cols + x + sx];
      [L.lit, L.next] = [L.next, L.lit]; L.x0 = x0; L.y0 = y0;
    }
    L.want.fill(0);
    const keys = L.keys ??= [], rares = L.rares ??= [];
    keys.length = 0; rares.length = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const k = w.peek(x0 + x, y0 + y);
      L.solid[y * cols + x] = k === K.EMPTY ? 0 : 1;
      if (k === K.KEY) keys.push((y0 + y) * N + x0 + x);
      else if (k === K.RARE) rares.push((y0 + y) * N + x0 + x);
    }
    // The drill's lamp is steady, and it stands where the drill is, not in the middle of the drill's cell: it is
    // lit from each open cell about the drill, less by the way from the drill to that cell's middle. Its power is
    // a little over 1 (light is capped at 1), so the four cells the drill is among are all fully lit and the
    // light under the drill is the same wherever in a cell it is. (Lit from its cell's middle alone, brighter
    // while the bit cut and with a waver, the light pulsed as the drill crossed each cell and at every cut.)
    const LAMP = this.val('lamp'), dcx = Math.floor(d.x), dcy = Math.floor(d.y);
    for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const cx = Math.floor(d.x - 0.5) + u, cy = Math.floor(d.y - 0.5) + v, lx = cx - x0, ly = cy - y0;
      if ((cx !== dcx || cy !== dcy) && (lx < 0 || ly < 0 || lx >= cols || ly >= rows || L.solid[ly * cols + lx])) continue;
      const power = 1.1 - Math.hypot(d.x - cx - 0.5, d.y - cy - 0.5) / LAMP;
      this.shine(cx, cy, power, LAMP * power);
    }
    this.shine(C, C, 1 + this.coreFlash * 1.5 + Math.sin(this.time * 2) * 0.04, 8 + this.coreFlash * 10);
    let lavas = 0;
    for (const i of w.lava.keys()) { if (lavas++ > 40) break; this.shine(i % N, Math.floor(i / N), 0.85, 3.5); }
    for (const e of this.effects) if (e.sheet === 'zap' || e.sheet === 'haul' || e.sheet === 'bank') this.shine(Math.floor(e.x / T), Math.floor(e.y / T), 1, 6);
    for (const [i, sp] of this.sparks) if (sp.fuse > 0) this.shine(i % N, Math.floor(i / N), 0.9, 3);
    for (const i of this.quenched.keys()) this.shine(i % N, Math.floor(i / N), 0.8, 2.5);
    this.feel.lights(this);
    this.fauna.lights(this);
    // Keystones that have been seen glint, so that they read from across the screen: the nearest dozen.
    if (keys.length > KEY_GLINTS) {
      const far = i => ((i % N) + 0.5 - d.x) ** 2 + (Math.floor(i / N) + 0.5 - d.y) ** 2;
      keys.sort((a, b) => far(a) - far(b)); keys.length = KEY_GLINTS;
    }
    this.glints = keys.length;
    for (const i of keys) this.shine(i % N, Math.floor(i / N), KEY_GLINT, KEY_GLOW);
    this.glowsIn(ox, oy);
    // Rare hazards that have been seen glint too, the nearest few; and awake, each lights the dark as it goes off.
    if (rares.length > RARE_GLINTS) {
      const far = i => ((i % N) + 0.5 - d.x) ** 2 + (Math.floor(i / N) + 0.5 - d.y) ** 2;
      rares.sort((a, b) => far(a) - far(b)); rares.length = RARE_GLINTS;
    }
    for (const i of rares) { const [power, reach] = w.hazAt(i) === 'worm' ? WORM_GLOW : RARE_GLINT; this.shine(i % N, Math.floor(i / N), power, reach); }
    for (const [i, b] of this.bells) if (b.cool <= 0) this.shine(i % N, Math.floor(i / N), 0.6, 2.5);
    for (const f of this.flares) this.shine(f.x, f.y, f.power, f.reach);
    for (const [i, v] of this.vents) if (v.cool <= 0) this.shine(i % N, Math.floor(i / N), 0.6, 2);
    let flames = 0;
    for (const e of this.jets) for (const i of e.cells) if (flames++ < JET_LIGHTS) this.shine(i % N, Math.floor(i / N), 0.9, 3);
    for (const [i, m] of this.worms) { const j = m.since < WORM.tween / 2 ? m.from : i; this.shine(j % N, Math.floor(j / N), 0.8, 3.5); }
    for (const [i, s] of this.stones) if (s.cool <= 0) this.shine(i % N, Math.floor(i / N), 0.5, 2.5);
    // One pixel of darkness per cell, drawn sixteen times the size and smoothed.
    const mcols = vx1 - vx0 + 1, mrows = vy1 - vy0 + 1;
    let map = this.dark;
    if (!map || map.width !== mcols || map.height !== mrows) { map = this.dark = document.createElement('canvas'); map.width = mcols; map.height = mrows; this.darkData = null; }
    // (The dark's own little canvas is kept in memory, not on the graphics card: pixels are written to it every
    // frame, and writing pixels to a canvas the card holds stalled a frame for 50 to 90 ms every so often on a
    // desktop, several times that on a phone. `willReadFrequently` is how a canvas is asked to stay in memory.)
    const mc = map.getContext('2d', { willReadFrequently: true }), data = this.darkData ??= mc.createImageData(mcols, mrows), px = data.data, [r, g, b] = this.gloom;
    // (Eased by the time that has passed, not by the frame: the same on a screen of any rate. At sixty frames a
    // second this is three tenths of the way each frame.)
    const since = Math.max(0, Math.min(0.1, this.time - (this.litAt ?? this.time - 1 / 60))), ease = 1 - Math.exp(-since * 21.4);
    this.litAt = this.time;
    for (let i = 0; i < L.lit.length; i++) L.lit[i] += (Math.min(1, L.want[i]) - L.lit[i]) * ease;
    for (let y = 0; y < mrows; y++) for (let x = 0; x < mcols; x++) {
      const l = L.lit[(y + pad) * cols + x + pad], o = (y * mcols + x) * 4;
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = this.daylight ? 0 : 168 * this.murk * (1 - l * (2 - l));
    }
    mc.putImageData(data, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(map, vx0 * T - ox, vy0 * T - oy, mcols * T, mrows * T);
    ctx.imageSmoothingEnabled = false;
    this.darkAt = [vx0 * T - ox, vy0 * T - oy, mcols * T, mrows * T];
    this.halos(ox, oy);
    // The core's slow turning rays.
    const cxp = HX * T - ox, cyp = HY * T - oy;
    if (cxp > -80 && cyp > -80 && cxp < W + 80 && cyp < H + 80) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#5cc4f0';
      for (let ray = 0; ray < 6; ray++) {
        const a = this.time * 0.25 + ray * 1.0472, len = 46 + Math.sin(this.time * 1.7 + ray * 2) * 10 + this.coreFlash * 80;
        ctx.globalAlpha = 0.07 + this.coreFlash * 0.5;
        this.line(cxp + Math.cos(a) * 24, cyp + Math.sin(a) * 24, cxp + Math.cos(a) * len, cyp + Math.sin(a) * len);
        this.line(cxp + Math.cos(a + 0.04) * 24, cyp + Math.sin(a + 0.04) * 24, cxp + Math.cos(a + 0.04) * len * 0.8, cyp + Math.sin(a + 0.04) * len * 0.8);
      }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
  }

  // A rare hazard awake, in its own cell (`render`): the frame it is drawn with there (a bell shivers as its fuse
  // burns, a fumarole rumbles until it has fired, a lodestone hums while it pulls), null for the one it has asleep,
  // or false for none: a glowworm swimming is drawn on its way from cell to cell (`drawRares`).
  rareFrame(haz, i, now) {
    const flick = ((now / 60) | 0) % 2;
    if (haz === 'bell') { const b = this.bells.get(i); return b && b.cool <= 0 ? (((now / 80) | 0) % 2 ? 'toll-b' : 'toll-a') : null; }
    if (haz === 'vent') { const v = this.vents.get(i); return v && v.cool <= 0 ? (flick ? 'rumble-b' : 'rumble-a') : null; }
    if (haz === 'worm') return this.worms.has(i) ? false : null;
    const s = this.stones.get(i);
    return s && s.cool <= 0 ? (flick ? 'hum-b' : 'hum-a') : null;
  }
  // What the rare hazards awake do in the ground, drawn over it and under the dark: the ring of a bell cracking as
  // its fuse burns; a fumarole's flames along its jet, flickering; a glowworm under the stone, half seen, swimming
  // from cell to cell with a trail behind it, or thrashing where it cannot go on; the ore a lodestone is to pull
  // next, blinking, and the ore it pulled flying to it.
  drawRares(ctx, ox, oy, now) {
    const w = this.world, flick = ((now / 60) | 0) % 2, px = i => (i % N) * T - ox, py = i => Math.floor(i / N) * T - oy;
    const shown = i => px(i) > -T && py(i) > -T && px(i) < this.W && py(i) < this.H;
    for (const [i, b] of this.bells) {
      if (b.cool > 0) continue;
      const stage = Math.min(4, 1 + Math.floor(b.t / BELL.fuse * 4));
      for (const j of this.ringOf(i)) { const k = w.peek(j % N, Math.floor(j / N)); if (k >= 0 && CRUSH[k] && shown(j)) draw(ctx, 'cracks', `crack-${stage}`, px(j), py(j)); }
    }
    const vent = HAZARDS.vent.sheet, worm = HAZARDS.worm.sheet, stone = HAZARDS.lodestone.sheet;
    for (const e of this.jets) e.cells.forEach((j, n) => { if (shown(j)) draw(ctx, vent, `jet-${e.upright ? 'v' : 'h'}-${(flick + n) % 2 ? 'b' : 'a'}`, px(j), py(j)); });
    for (const [i, m] of this.worms) {
      if (m.trail >= 0 && m.trailT > 0 && shown(m.trail)) { ctx.globalAlpha = Math.min(1, m.trailT / WORM.trail); draw(ctx, worm, 'trail', px(m.trail), py(m.trail)); }
      const u = Math.min(1, m.since / WORM.tween), x = px(m.from) + (px(i) - px(m.from)) * u, y = py(m.from) + (py(i) - py(m.from)) * u;
      const frame = !m.steps && m.t < WORM.uncoil ? (((now / 100) | 0) % 2 ? 'hazard-b' : 'hazard') : m.stuck ? (flick ? 'hazard-b' : 'hazard') : `swim-${'eswn'[m.way]}-${((now / 120) | 0) % 2 ? 'b' : 'a'}`;
      ctx.globalAlpha = 0.8; draw(ctx, worm, frame, x, y); ctx.globalAlpha = 1;
    }
    for (const s of this.stones.values()) if (s.next && s.cool <= 0 && s.t >= STONE.hum && flick && shown(s.next.from)) draw(ctx, stone, 'filing', px(s.next.from), py(s.next.from));
    for (const f of this.flying) {
      const u = 1 - f.t / STONE.fly, x = (f.x0 + (f.x1 - f.x0) * u) * T - ox, y = (f.y0 + (f.y1 - f.y0) * u) * T - oy;
      if (sheets[f.over[0]]?.frames[f.over[1]]) draw(ctx, f.over[0], f.over[1], x, y);
    }
  }
  // And what they say over the dark, of what is coming: the dotted ring a bell's toll will open; the line a
  // fumarole's jet will take, in faint red ticks; rings drawn in to a lodestone as it hums, red and blue by turns.
  drawRareSigns(ctx, ox, oy, now) {
    const dots = (x, y, rad, colour, alpha) => {
      const n = Math.max(12, (rad * 1.6) | 0);
      ctx.globalAlpha = alpha; ctx.fillStyle = colour;
      for (let a = 0; a < n; a++) ctx.fillRect(Math.round(x + Math.cos(a / n * 6.283) * rad), Math.round(y + Math.sin(a / n * 6.283) * rad), 1, 1);
    };
    const cx = i => (i % N + 0.5) * T - ox, cy = i => (Math.floor(i / N) + 0.5) * T - oy;
    for (const [i, b] of this.bells) if (b.cool <= 0) dots(cx(i), cy(i), 4.5 * T, SPOT.bell[1], 0.55 + 0.35 * Math.sin(now / 70));
    for (const [i, v] of this.vents) {
      if (v.cool > 0) continue;
      ctx.globalAlpha = 0.5 + 0.25 * Math.sin(now / 50); ctx.fillStyle = '#ff4a2a';
      const sx = DX[v.way], sy = DY[v.way];
      for (const j of this.jetPath(i, v.way)) for (let n = -6; n <= 6; n += 4) ctx.fillRect(Math.round(cx(j) + sx * n - sy * 0.5), Math.round(cy(j) + sy * n - sx * 0.5), sx ? 2 : 1, sy ? 2 : 1);
    }
    for (const [i, s] of this.stones) if (s.cool <= 0 && s.t < STONE.hum) {
      const rad = (7 - 6 * s.t / STONE.hum) * T;
      dots(cx(i), cy(i), rad, ((now / 90) | 0) % 2 ? '#ff6a5a' : '#6a8cff', 0.8);
      if (rad > 3 * T) dots(cx(i), cy(i), rad - 2 * T, ((now / 90) | 0) % 2 ? '#6a8cff' : '#ff6a5a', 0.6);
    }
    ctx.globalAlpha = 1;
  }

  // A line of whole pixels, clipped to the view; `dash` (0-1) draws only that share of every 4 pixels.
  line(x0, y0, x1, y1, dash = 1) {
    const { ctx, W, H } = this;
    // A long line is cut down to the part that crosses the view before it is walked.
    const dxf = x1 - x0, dyf = y1 - y0;
    let t0 = 0, t1 = 1;
    for (const [p, q] of [[-dxf, x0 + 2], [dxf, W + 2 - x0], [-dyf, y0 + 2], [dyf, H + 2 - y0]]) {
      if (p === 0) { if (q < 0) return; continue; }
      const t = q / p;
      if (p < 0) { if (t > t1) return; if (t > t0) t0 = t; } else { if (t < t0) return; if (t < t1) t1 = t; }
    }
    const skip = Math.round(Math.max(Math.abs(dxf), Math.abs(dyf)) * t0);
    x1 = Math.round(x0 + dxf * t1); y1 = Math.round(y0 + dyf * t1); x0 = Math.round(x0 + dxf * t0); y0 = Math.round(y0 + dyf * t0);
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy, n = skip;
    for (let guard = 0; guard < 4000; guard++) {
      if (x0 >= 0 && y0 >= 0 && x0 < W && y0 < H && (dash >= 1 || (n & 3) < dash * 4)) ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
      n++;
    }
  }
  drawTether(ox, oy) {
    const { ctx, W, H } = this, d = this.drill, R = this.val('tether');
    // Where the tether's reach ends: a faint dotted ring, bright for a moment when the drill is turned back by it.
    const cx = HX * T - ox, cy = HY * T - oy, rad = (R + 0.5) * T, off = Math.hypot(W / 2 - cx, H / 2 - cy), half = Math.hypot(W, H) / 2;
    if (off + half > rad && off - half < rad) {
      // (From the seventh reach it is in the tether's own colour.)
      const lv = this.S.lv.tether;
      ctx.fillStyle = this.edge > 0 ? '#ff7a5a' : lv >= 6 ? TETHERS[lv].a : '#f4ecd8'; ctx.globalAlpha = this.edge > 0 ? 0.9 : lv >= 6 ? 0.35 : 0.3;
      // Only the arc that crosses the view is walked: the ring may be thousands of cells round.
      const mid = Math.atan2(H / 2 - cy, W / 2 - cx), sweep = Math.min(Math.PI, half / rad * 1.3), step = 7 / rad, phase = (this.time * 0.05) % step;
      for (let a = Math.ceil((mid - sweep) / step) * step + phase; a < mid + sweep; a += step) {
        const x = Math.round(cx + Math.cos(a) * rad), y = Math.round(cy + Math.sin(a) * rad);
        if (x >= 0 && y >= 0 && x < W && y < H) ctx.fillRect(x, y, 2, 1);
      }
      ctx.globalAlpha = 1;
    }
    const pts = this.lay().map(([x, y]) => [x * T - ox, y * T - oy]);
    const wob = this.twang > 0 ? Math.sin(this.time * 90) * this.twang * 5 : 0;
    // Turned back at the edge it shows red; otherwise it is whatever the reach upgrades have made it.
    const own = TETHERS[this.S.lv.tether], style = this.twang > 0 ? { a: '#ff5a4a', b: '#ff5a4a', dash: 1, thick: own.thick } : own;
    if (this.over) {
      // It leaves the drill's tail, and is laid out from the core's end so that its braid stays put on the ground
      // as the drill pays it out.
      pts[0] = [d.x * T - ox - Math.cos(d.ang) * 5, d.y * T - oy - Math.sin(d.ang) * 5];
      this.ropes.push({ pts: pts.reverse(), style, wob, pulse: true });
      return;
    }
    for (const pass of own.thick ? [2, 1, 0] : [1, 0]) {
      const shadow = pass === (own.thick ? 2 : 1), use = shadow ? { a: '#16121c', b: '#16121c', dash: 1 } : style;
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        if (Math.max(x0, x1) < -2 || Math.max(y0, y1) < -2 || Math.min(x0, x1) > W + 2 || Math.min(y0, y1) > H + 2) continue;
        if (wob && Math.hypot(x1 - x0, y1 - y0) < 600) {
          // A plucked string: the middle of each span swings across it.
          const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, len = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / len * wob, ny = (x1 - x0) / len * wob;
          this.drawSpan(x0, y0, mx + nx, my + ny, use, pass); this.drawSpan(mx + nx, my + ny, x1, y1, use, pass);
        } else this.drawSpan(x0, y0, x1, y1, use, pass);
      }
    }
  }

  button(x, y, w, h, act) { this.buttons.push({ x, y, w, h, act }); }
  // What a haul's banner says besides its title and what it paid: how many cells came and what their grit was
  // multiplied by, and that the piece was over the winch's load where it was (a keystone slab is the haul the winch
  // is for); and, where a prism came with it, what the prism multiplied the gems by (null: no prism).
  // And third, where the haul held a pocket's mineral that raised a count of specimens: by how many. (A foe caught
  // as a trophy, js/fauna.js, is no haul: its banner has the specimens it paid and nothing else.)
  bannerSays(b) { if (b.trophy) return ['', null, `+${b.spec}`]; return [`${b.n} x${b.mult.toFixed(1)}${b.over < 1 ? ' WINCH OVER LOAD' : ''}`, b.shine > 1 ? `PRISM x${b.shine}` : null, b.spec > 0 ? `+${b.spec}` : null]; }
  // How a banner's line of what it paid is laid out, for a screen `W` wide: worked out once a banner (and again only
  // if the screen changes), so that drawing it every frame measures and makes nothing. `lw` is the line's width;
  // where that is wider than the screen, the gems go on over a second line, `lw2` wide, from the gem `split` (0:
  // one line): from the first of the corners' where the line up to it fits, else from the first that would not fit.
  // The specimens go last, on the second line where there is one. And the line of what paid most in the haul
  // (js/game.js: `topPayer`), its picture and its words `topW` wide, goes under them (`topAt`: 12, the room it takes)
  // where it fits the screen, and where the banner has no more than two of the lines it may have under its gems
  // already (a second of gems, a prism's, a word more): so a banner reaches no lower down the screen, towards the
  // drill, than it could before it said this.
  bannerSplit(b, spec) {
    this.splitGems(b, spec);
    b.topW = b.top ? textWidth(b.top.said) + UI.CHIP : 0;
    b.topAt = b.top && b.topW <= this.W - 2 * UI.EDGE && (b.split ? 1 : 0) + (b.split2 ? 1 : 0) + (b.shine > 1 ? 1 : 0) + (b.sub ? 1 : 0) <= 2 ? UI.LINE : 0;
  }
  // (Each figure on the line with its icon before it, GROUP clear of the one before; the specimens' mineral a column
  // wider than an icon. A second line too wide for the screen goes on over a third, from `split2`: a gem, or 9 for
  // the specimens alone. `down` is how far under the first line the last is.)
  splitGems(b, spec) {
    const W = this.W, room = W - 2 * UI.EDGE, gemW = g => textWidth(`+${compact(b.gems[g])}`) + UI.ICON + UI.GROUP;
    const specW = spec ? textWidth(spec) + UI.ICON + (b.mineral ? 1 : 0) + UI.GROUP : 0, first = b.trophy ? -UI.GROUP : textWidth(`+${compact(b.grit)}`) + UI.ICON;
    let lw = first;
    for (const g of GEM_ORDER) if (b.gems[g] > 0) lw += gemW(g);
    b.splitW = W; b.split = 0; b.split2 = 0; b.lw = lw + specW; b.lw2 = 0; b.lw3 = 0; b.down = 0;
    if (b.lw <= room) return;
    let corner = 0, over = 0, upTo = first, w1 = first;
    for (const g of GEM_ORDER) {
      if (!(b.gems[g] > 0)) continue;
      if (!corner && g >= 5) { corner = g; w1 = upTo; }
      if (!over && upTo + gemW(g) > room) over = g;
      upTo += gemW(g);
    }
    const split = corner && w1 <= room && w1 > first ? corner : over || (spec ? 9 : 0);
    if (!split) return;
    let a = first, c = -UI.GROUP, d = -UI.GROUP, split2 = 0;
    for (const g of GEM_ORDER) {
      if (!(b.gems[g] > 0)) continue;
      if (g < split) a += gemW(g);
      else if (!split2 && c + gemW(g) <= room) c += gemW(g);
      else { split2 ||= g; d += gemW(g); }
    }
    if (spec && !split2 && c + specW > room && c > -UI.GROUP) split2 = 9;
    if (spec) { if (split2) d += specW; else c += specW; }
    b.split = split; b.split2 = split2; b.lw = a; b.lw2 = c; b.lw3 = split2 ? d : 0; b.down = split2 ? 2 * UI.LINE : UI.LINE;
  }
  // A thing of the lab's seen for the first time: its picture on a chip rimmed by its tier, its name (or what the lab
  // says of it before it is known) and what it is worth as the lab says it (js/worth.js), on a panel just over the
  // bar, in the middle (out in the ground: at the core, where the shop's button is, it waits). The view keeps the
  // drill within three tenths of the screen's narrower side of its middle, so on a phone held upright the panel,
  // this low, is never over it. Where its ground pays more than the thing's own, how much more (`tag`): beside the
  // name where there is room, else after the worth, else on a third line. Laid out once a thing (and again only if
  // the screen changes), so a frame measures and makes nothing.
  eyeFit(e) {
    // (The chip and the name after it on the first line, INSET in; the worth under them; the tag set to the right,
    // INSET in, WORD clear of whatever is before it on its line.)
    const room = this.W - 2 * UI.EDGE, l1 = UI.INSET + UI.CHIP + textWidth(e.name) + UI.INSET, l2 = UI.INSET + textWidth(e.said) + UI.INSET, tw = e.tag ? textWidth(e.tag) + UI.WORD : 0;
    e.tagAt = !e.tag ? 0 : l1 + tw <= room ? 1 : l2 + tw <= room ? 2 : 3;
    e.w = Math.min(room, Math.max(l1 + (e.tagAt === 1 ? tw : 0), l2 + (e.tagAt === 2 ? tw : 0), e.tagAt === 3 ? tw - UI.WORD + 2 * UI.INSET : 0));
    e.h = e.tagAt === 3 ? EYE_H + 10 : EYE_H; e.W = this.W;
  }
  drawEye() {
    const { ctx, W, H } = this, e = this.eye;
    if (e.W !== W) this.eyeFit(e);
    const slide = Math.min(1, e.t / 0.15);
    // (On a screen wider than it is tall the drill may come further down it: the panel stands at the left. It stands
    // EDGE over the bar's frame.)
    const x = W > H ? UI.EDGE : Math.round(W / 2 - e.w / 2), y = H - 42 - UI.EDGE - e.h + Math.round((1 - slide) * (1 - slide) * 8);
    ctx.globalAlpha = Math.min(1, slide, (e.life - e.t) / 0.3);
    slice9(ctx, 'ui', 'panel', x, y, e.w, e.h);
    e.rect[0] = x; e.rect[1] = y; e.rect[2] = e.w; e.rect[3] = e.h;
    this.panels.push(e.rect);
    const cx = x + UI.INSET, cy = y + UI.INSET, ty = cy - UI.PIC_DY;
    chip(ctx, cx, cy, null, '#5a5674');
    const f = sheets[e.sheet].frames[e.frame];
    ctx.drawImage(sheets[e.sheet].image, f[0] + 2, f[1] + 2, 12, 12, cx, cy, 12, 12);
    if (e.rim) ring(ctx, cx, cy, e.rim);
    text(ctx, e.name, cx + UI.CHIP, ty, '#ffffff');
    text(ctx, e.said, cx, ty + UI.LINE, '#ffe14a');
    if (e.tag) text(ctx, e.tag, x + e.w - UI.INSET, e.tagAt === 1 ? ty : e.tagAt === 2 ? ty + UI.LINE : ty + UI.LINE + 11, '#8ce060', 1);
    ctx.globalAlpha = 1;
  }
  // What the next thing to be bought with a direction's specimens asks of them, or 0 where nothing is left to buy.
  specNeed(kin) { const u = WORKS.find(u => u.kin === kin && this.cost(u)); return u ? this.cost(u).spec : 0; }
  // How a place's name is laid out on a screen `W` wide: worked out once a place (and again only if the screen
  // changes), so that a frame measures and makes nothing; and before the banner is drawn, which stands clear of a
  // plate that has gone under the map. On its plate (`lay`): its gem's icon (or its pocket's mineral), the second
  // gem where it pays two, and its name after them, the whole no wider than the screen less EDGE each side: the
  // second gem dropped first where it is too wide, and then the name set on two lines (`lines`, `h` tall). Beside the
  // map where it fits there (`ty`), else under it. And as a card across the screen (`card`), at size 2 (`big`) on one
  // line or two, else at size 1.
  plateFit(place) {
    const W = this.W, room = W - 2 * UI.EDGE, L = place.lay ?? (place.lay = { W: 0, pw: 0, h: 0, ty: 0, tx: 0, also: false, lines: null, card: null, big: 2, cardW: 0, pop: 0 });
    const pic = UI.INSET + UI.ICON + (place.mineral ? 1 : 0), widest = lines => lines.reduce((m, l) => Math.max(m, textWidth(l)), 0);
    L.W = W; L.also = !!place.also; L.lines = [place.title];
    let pw = pic + (L.also ? UI.ICON : 0) + textWidth(place.title) + UI.INSET;
    if (pw > room && L.also) { L.also = false; pw -= UI.ICON; }
    if (pw > room) {
      L.lines = halves(place.title, room - pic - UI.INSET, 1) ?? wrap(place.title, room - pic - UI.INSET);
      pw = pic + widest(L.lines) + UI.INSET;
    }
    L.pw = Math.min(room, pw); L.tx = pic + (L.also ? UI.ICON : 0); L.h = PLATE_H + UI.TITLE * (L.lines.length - 1);
    L.ty = UI.EDGE + L.pw > BESIDE_MAP(W) ? MAP_Y - 3 + MAP_FRAME_H + UI.STACK : UI.EDGE;
    L.big = 2; L.card = [place.title];
    if (textWidth(place.title, 2) > room) {
      const two = halves(place.title, room, 2);
      if (two) L.card = two; else { L.big = 1; L.card = halves(place.title, room, 1) ?? wrap(place.title, room); }
    }
    L.cardW = L.card.reduce((m, l) => Math.max(m, textWidth(l, L.big)), 0);
    L.pop = L.card.length === 1 && L.big === 2 && textWidth(place.title, 3) <= room ? 1 : 0;
    return L;
  }
  // A notice laid out for a screen `W` wide, once: its title at size 2 where it fits (3 as it pops up, where that
  // fits too), else at 1; and what it says under that on as many lines as it takes.
  noticeFit(note) {
    const room = this.W - 2 * UI.EDGE;
    let big = 2;
    while (big > 1 && textWidth(note.title, big) > room) big--;
    note.lay = { W: this.W, big, pop: big === 2 && textWidth(note.title, 3) <= room ? 1 : 0, subs: !note.sub ? null : textWidth(note.sub) <= room ? [note.sub] : halves(note.sub, room, 1) ?? wrap(note.sub, room) };
    return note.lay;
  }
  drawHud(ox, oy) {
    const { ctx, W, H, S } = this, now = this.time * 1000, d = this.drill;
    this.buttons.length = 0; this.panels.length = 0;
    // The place the drill has come into, laid out before anything that stands clear of it.
    const place = this.place, lay = place ? (place.lay?.W === W ? place.lay : this.plateFit(place)) : null, low = place && !place.card && lay.ty > UI.EDGE;
    this.plateLow = !!low;
    // Banner of the last haul. (It, the word across the screen and a new place's name stand clear of the map, and of
    // a place's plate where that has had to go under the map: `plateLow`.)
    const head = Math.max(60, H * 0.2, low ? lay.ty + lay.h + 6 : 0);
    if (this.banner) {
      const b = this.banner, pop = Math.min(1, b.t / 0.12), y = Math.round(head - (1 - pop) * 8);
      ctx.globalAlpha = Math.min(1, (b.life - b.t) * 3);
      // (A title too wide for the screen at its size is set a size smaller. A haul named by its place is in its
      // colour; a giant's title is gold and white by turns, faster the bigger it is, and HALF's runs through the gems'.)
      let big = (b.n >= 10 ? 2 : 1) + (b.t < 0.07 || (b.giant > 3 && b.t < 0.3) ? 1 : 0);
      while (big > 1 && textWidth(b.title, big) > W - 2 * UI.EDGE) big--;
      const giant = b.giant ?? 0, beat = (now / Math.max(60, 260 - giant * 30)) | 0;
      const colour = giant > GIANTS.length ? GEM_COLOR[1 + beat % 4] : giant ? (beat % 2 ? '#ffffff' : '#ffe14a') : b.colour ?? (b.n >= 30 ? '#ffe14a' : '#ffffff');
      text(ctx, b.title, W / 2, y, colour, 0.5, big);
      const [size, prism, spec] = this.bannerSays(b);
      if (size) text(ctx, size, W / 2, y + under(big), b.over < 1 ? '#ffb060' : '#bfe6ff', 0.5);
      // (The gems it paid, in their order: those it paid none of are passed over. Too wide for the screen, they
      // go on over a second line from the gem `split` says, and a third from `split2`: `bannerSplit`, measured once
      // a banner. Each figure has its icon before it, at its own height.)
      if (b.splitW !== W) this.bannerSplit(b, spec);
      const line = `+${compact(b.grit)}`, ly = y + under(big) + (size ? UI.LINE : 0), down = b.down;
      let lx = Math.round(W / 2 - b.lw / 2), at = ly;
      if (!b.trophy) { draw(ctx, 'icons', 'grit', lx, at); text(ctx, line, lx + UI.ICON, at, '#ffe14a'); lx += textWidth(line) + UI.ICON + UI.GROUP; }
      for (const g of GEM_ORDER) {
        if (!(b.gems[g] > 0)) continue;
        if (g === b.split) { lx = Math.round(W / 2 - b.lw2 / 2); at = ly + UI.LINE; }
        if (g === b.split2) { lx = Math.round(W / 2 - b.lw3 / 2); at = ly + 2 * UI.LINE; }
        draw(ctx, 'icons', GEM_ICON[g], lx, at); text(ctx, `+${compact(b.gems[g])}`, lx + UI.ICON, at, GEM_COLOR[g]); lx += textWidth(`+${compact(b.gems[g])}`) + UI.ICON + UI.GROUP;
      }
      // The specimens a pocket's mineral added, with the mineral itself beside the figure.
      if (spec) {
        if (b.split === 9) { lx = Math.round(W / 2 - b.lw2 / 2); at = ly + UI.LINE; }
        if (b.split2 === 9) { lx = Math.round(W / 2 - b.lw3 / 2); at = ly + 2 * UI.LINE; }
        if (b.mineral) { this.drawMineral(ctx, b.mineral, lx - 1, at + UI.PIC_DY); text(ctx, spec, lx + UI.ICON + 1, at, GEM_COLOR[b.specOf]); }
        else { draw(ctx, 'icons', `spec-${GEM_ICON[b.specOf]}`, lx, at); text(ctx, spec, lx + UI.ICON, at, GEM_COLOR[b.specOf]); }
      }
      // What paid most in it, with its picture rimmed by its tier, in that tier's colour.
      if (b.topAt) {
        const t = b.top, tx = Math.round(W / 2 - b.topW / 2), f = sheets[t.sheet].frames[t.frame], ty = ly + down + UI.LINE;
        ctx.drawImage(sheets[t.sheet].image, f[0] + 2, f[1] + 2, 12, 12, tx, ty + UI.PIC_DY, 12, 12);
        ring(ctx, tx, ty + UI.PIC_DY, t.colour);
        text(ctx, t.said, tx + UI.CHIP, ty, t.colour);
      }
      // A prism among the cells: what it multiplied the gems by, in the gems' colours by turns.
      const more = down + b.topAt;
      if (prism) text(ctx, prism, W / 2, ly + more + UI.LINE, GEM_COLOR[1 + ((now / 240) | 0) % 4], 0.5);
      // A word more under the rest, where the haul has one (HALF's).
      if (b.sub) text(ctx, b.sub, W / 2, ly + more + (prism ? 2 : 1) * UI.LINE, '#fff6c8', 0.5);
      ctx.globalAlpha = 1;
    }
    // Over a dead drill the screen goes dark.
    if (d.mode === 'dead' && this.tow) { ctx.globalAlpha = Math.min(0.85, this.tow.t / DEATH); ctx.fillStyle = '#07060b'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    if (this.notice) {
      // (Laid out once a notice: `noticeFit`.)
      const note = this.notice, pop = Math.min(1, note.t / 0.12), nl = note.lay?.W === W ? note.lay : this.noticeFit(note);
      ctx.globalAlpha = Math.min(1, (note.life - note.t) * 3);
      text(ctx, note.title, W / 2, Math.round(head - (1 - pop) * 8), note.colour, 0.5, nl.big + (note.t < 0.07 ? nl.pop : 0));
      if (nl.subs) for (let n = 0; n < nl.subs.length; n++) text(ctx, nl.subs[n], W / 2, Math.round(head) + under(nl.big) + n * UI.LINE, '#ffe14a', 0.5);
      ctx.globalAlpha = 1;
    }
    // The names of parts as they are fitted, a milestone's banner (under the core, clear of all of the above).
    this.fitter.hud(this, ctx, head, UI);
    if (S.won && this.wonAt !== undefined && this.time - this.wonAt < 6) {
      if (this.wonW !== W) { this.wonW = W; this.wonBig = textWidth('CORE RESTORED', 2) <= W - 2 * UI.EDGE ? 2 : 1; }
      text(ctx, 'CORE RESTORED', W / 2, H * 0.36, '#ffe14a', 0.5, this.wonBig);
    }
    // A ground met for the first time: its name alone, large, a little under where a haul's banner goes (and under
    // the banner itself, if one is up), and clear of the drill. A name too long for the screen is set on two lines,
    // or small (`plateFit`). On a screen wider than it is tall, where the banner leaves no room over the drill, it
    // goes up at the head of the screen, in the room left of the map; on one taller than it is wide, under the drill.
    if (place && place.card) {
      const pop = Math.min(1, place.t / 0.12), lines = lay.card, big = lay.big, tall = lines.length * UI.TITLE * big;
      const bn = this.banner, below = bn ? Math.round(head) + UI.TITLE * (bn.n >= 10 ? 2 : 1) + (bn.shine > 1 ? 42 : 30) + (bn.sub ? UI.LINE : 0) + (bn.down ?? 0) + (bn.topAt ?? 0) : 0;
      let y = Math.min(Math.round(Math.max(head + 14, H * 0.3)), drillTop(H) - UI.DRILL_CLEAR - tall), cx = W / 2;
      if (y < below) {
        const left = W - UI.EDGE - MAP_FRAME;
        const past = Math.max(below, drillTop(H) + 16 + UI.DRILL_CLEAR);
        if (W > H && lay.cardW <= left - 2 * UI.EDGE) { y = UI.EDGE + 2; cx = left / 2; } else y = past + tall <= H - 44 - UI.EDGE ? past : below;
      }
      y = Math.round(y - (1 - pop) * 8);
      ctx.globalAlpha = Math.min(1, (place.life - place.t) * 3);
      for (let n = 0; n < lines.length; n++) text(ctx, lines[n], cx, y + n * UI.TITLE * big, place.colour, 0.5, big + (place.t < 0.07 ? lay.pop : 0));
      ctx.globalAlpha = 1;
    }
    // The bar, at the foot of the screen: what has been banked, the hull, what the lab knows, and how much of its
    // reach the tether has left. A tap on it opens the panel (what the drill is, the lab's notes, the chart, the
    // menu), and another shuts it. It is docked DOCK from the sides and the foot; what is in it stands INSET in from
    // its frame (`left` and `right`), three rows of an icon with its figure at the icon's own height.
    const B = H - 44, left = UI.DOCK + UI.INSET, right = W - UI.DOCK - UI.INSET, row1 = B + 5, row2 = row1 + 12, row3 = row2 + 12;
    slice9(ctx, 'ui', 'panel', UI.DOCK, B + UI.DOCK, W - 2 * UI.DOCK, 40);
    // What the player is saving for (js/goal.js): a line along the bar's top edge, its light rim from end to end, as
    // far across as what is banked has come towards its price (the least of its grit, gems and specimens), in yellow,
    // and green once all of it is there: blinking for three seconds as it fills (GOAL_BLINK) or until the bar is
    // tapped, then steady, so a goal the player leaves unbought does not blink on for as long as they leave it. Its
    // price was kept when it was chosen: nothing of the shop is asked here.
    const goal = this.saving();
    if (goal.id !== null) {
      const share = goalShare(this), full = share >= 1, of = `${goal.id} ${goal.level}`, rim = UI.DOCK + 1;
      if (!full) this.goalLitFor = null;
      else if (this.goalLitFor !== of) { this.goalLitFor = of; this.goalBlink = GOAL_BLINK; }
      if (!full || !(this.goalBlink > 0) || ((now / 250) | 0) % 2 === 0) { ctx.fillStyle = full ? '#8ce060' : '#ffe14a'; ctx.fillRect(rim, B + 3, Math.round((W - 2 * rim) * share), 1); }
    }
    draw(ctx, 'icons', 'grit', left, row1);
    text(ctx, compact(S.grit - this.pending.grit), left + UI.ICON, row1 - (this.counted > 0 ? 1 : 0), this.counted > 0 ? '#ffffff' : '#ffe14a');
    // The gems: the four directions', or the corners' where they are what matter, or all eight where there is room.
    // Each has a column as wide as an icon and the widest figure, spread at an even pitch from the bar's left to its
    // right, the last ending where the rows above and below it do.
    const gems = W >= BAR_ALL_W ? BAR_ALL : this.cornerBar() ? BAR_CORNERS : BAR_DIRS, gw = (right - left - BAR_COL) / (gems.length - 1);
    for (let n = 0; n < gems.length; n++) {
      const g = gems[n], gx = Math.round(left + n * gw), have = (S.gems[g] ?? 0) - (this.pending.gems[g] ?? 0);
      ctx.globalAlpha = S.gems[g] > 0 ? 1 : 0.35;
      draw(ctx, 'icons', GEM_ICON[g], gx, row2);
      text(ctx, compact(have), gx + UI.ICON, row2, GEM_COLOR[g]);
      ctx.globalAlpha = 1;
    }
    // (The figure of the reach left in a slot as wide as the widest figure, set to the right, so the track before it
    // keeps its length as the figure counts down.)
    const R = this.val('tether'), far = this.far, left2 = Math.max(0, R - far), label = compact(left2);
    this.bar(left, row3, right - left - UI.FIG - UI.INSET, 'tether', left2 / R, far / R > 0.93 ? '#ff7a5a' : '#f4ecd8', this.twang > 0);
    text(ctx, label, right, row3, this.twang > 0 ? '#ff7a5a' : '#f4ecd8', 1);
    // The hull, after the grit: hearts, each two of the knocks it can take, so a knock is half a heart (a hull of an
    // odd number has a half heart last), on the grit's line, their rims on its figure's ink and shadow. Half a heart
    // just lost blinks white for a moment, the last half left blinks red, and a hull just mended shows white.
    const pips = this.val('hull'), sound = this.hull, hx = left + UI.ICON + textWidth(compact(S.grit - this.pending.grit)) + UI.GROUP + 1, hearts = Math.ceil(pips / 2);
    const blink = ((now / 150) | 0) % 2 === 0, half = (n, l, h) => n & 1 ? [Math.max(l, HEART_MID + 1), h] : [l, Math.min(h, HEART_MID)];
    // (The dark rim of every heart first, a whole heart's as one, and its colour over it: a heart whole is not
    // parted down the middle.)
    ctx.fillStyle = '#16121c';
    for (let n = 0; n < pips; n += 2) {
      const x = hx + (n >> 1) * HEART_PITCH, last = n + 1 >= pips;
      for (const [a, b, r] of HEART) { const [l, h] = last ? half(n, a, b) : [a, b]; if (l <= h) ctx.fillRect(x + l - 1, row1 + r, h - l + 3, 3); }
    }
    for (let n = 0; n < pips; n++) {
      const x = hx + (n >> 1) * HEART_PITCH, full = n < sound, lost = n === sound && this.knocked > 0;
      const colour = lost ? (blink ? '#ffffff' : '#ff4d6d') : !full ? '#3a3450' : this.mended > 0 ? '#ffffff' : sound === 1 ? (blink ? '#ff4d6d' : '#8a2038') : '#ff4d6d';
      ctx.fillStyle = colour;
      for (const [a, b, r] of HEART) { const [l, h] = half(n, a, b); if (l <= h) ctx.fillRect(x + l, row1 + 1 + r, h - l + 1, 1); }
      // (A glint on the left lobe of a heart lit as ever.)
      if (!(n & 1) && colour === '#ff4d6d' && !lost && sound > 1) { ctx.fillStyle = '#ffc2cf'; ctx.fillRect(x + 1, row1 + 2, 1, 1); }
    }
    // What the lab has analysed, of all it can: shown once there is a first sample, lit for a moment by a new level.
    // (`known` is the game's count, kept as samples come in: counting the lab's list here made a list every frame.)
    const known = this.known;
    if (this.knownFor !== known) { this.knownFor = known; this.knownSaid = `${known}/${LAB.length}`; this.knownW = textWidth(this.knownSaid); }
    if (known && hx + hearts * HEART_PITCH + 3 < right - this.knownW - UI.ICON) {
      const lit = this.labFlash > 0 && ((now / 120) | 0) % 2 === 0;
      text(ctx, this.knownSaid, right, row1, lit ? '#ffffff' : '#8cf2c4', 1);
      draw(ctx, 'icons', 'lab', right - this.knownW - UI.ICON, row1);
    }
    this.button(0, B, W, 44, () => { this.goalBlink = 0; this.openLab(!this.lab); });
    // The place the drill has come into: its name on a plate, with its direction's gem (and a second gem, where
    // the place pays two), laid out once a place (`plateFit`): at the head of the screen, EDGE in, or under the map
    // where its name is too long to stand beside it.
    if (place && !place.card) {
      const slide = Math.min(1, place.t / 0.15), px = UI.EDGE - Math.round((1 - slide) * (1 - slide) * 10), ty = lay.ty, ix = px + UI.INSET;
      ctx.globalAlpha = Math.min(1, slide, (place.life - place.t) / 0.3);
      slice9(ctx, 'ui', 'panel', px, ty, lay.pw, lay.h);
      this.panels.push([px, ty, lay.pw, lay.h]);
      // (A pocket's mineral is drawn as the middle ten rows of it, which the plate holds.)
      if (place.mineral) { const r = sheets.minerals.frames[place.mineral]; ctx.drawImage(sheets.minerals.image, r[0] + 2, r[1] + 3, 12, 10, ix - 1, ty + 2, 12, 10); }
      else draw(ctx, 'icons', place.icon, ix, ty + 2);
      if (lay.also) draw(ctx, 'icons', place.also, ix + UI.ICON, ty + 2);
      for (let n = 0; n < lay.lines.length; n++) text(ctx, lay.lines[n], px + lay.tx, ty + 2 + n * UI.TITLE, place.colour);
      ctx.globalAlpha = 1;
    }
    // Specimens just banked: the count of that direction's slides out at the head of the screen, under a place's
    // plate where one stands there, with what the next thing they buy asks, while there is one.
    const line = this.specLine;
    if (line) {
      const need = this.specNeed(line.kin), label = `${Math.floor(S.spec[line.kin] + 1e-9)}${need ? `/${need}` : ''}`;
      const slide = Math.min(1, line.t / 0.15), pw = UI.INSET + UI.ICON + textWidth(label) + UI.INSET, px = UI.EDGE - Math.round((1 - slide) * (1 - slide) * 10);
      const sy = place && !place.card && !low ? UI.EDGE + lay.h + UI.STACK : UI.EDGE;
      ctx.globalAlpha = Math.min(1, slide, (line.life - line.t) / 0.3);
      slice9(ctx, 'ui', 'panel', px, sy, pw, PLATE_H);
      this.panels.push([px, sy, pw, PLATE_H]);
      draw(ctx, 'icons', `spec-${GEM_ICON[line.kin]}`, px + UI.INSET, sy + 2);
      text(ctx, label, px + UI.INSET + UI.ICON, sy + 2, GEM_COLOR[line.kin]);
      ctx.globalAlpha = 1;
    }
    // A thing of the lab's seen for the first time (js/game.js: `showEye`), out in the ground, and not over a wreck.
    if (this.eye && !this.shop && !this.lab && !this.atCore && this.drill.mode !== 'dead') this.drawEye();
    // The map, in the top right corner.
    this.drawMap(MAP_X(W), MAP_Y);
    // The shop's button, over the bar, when the drill is home.
    const by = H - 88;
    if (this.atCore && !this.shop && !this.lab && d.mode === 'free') {
      // (Whether anything can be bought is asked only here, where the button shows it: out in the ground it would
      // count what is left of the reach again after every cut, for nothing.)
      const afford = ROWS.some(u => this.canBuy(u));
      const w = 84, x = Math.round(W / 2 - w / 2), up = afford && ((now / 300) | 0) % 2;
      slice9(ctx, 'ui', afford ? (up ? 'button-down' : 'button') : 'panel', x, by + 6, w, 24);
      text(ctx, 'UPGRADES', x + w / 2, by + 13, afford ? '#ffffff' : '#9a94a8', 0.5);
      this.button(x - 4, by, w + 8, 36, () => { this.shop = true; sfx.tap(); });
      // (The hand under the word, pointing up at it, its fingertip at the word's middle and never over it.)
      if (afford && S.stats.buys === 0) draw(ctx, 'ui', 'hand', x + w / 2 - 7, by + 22 + Math.round(Math.abs(Math.sin(now / 150)) * 3));
    }
    // The idea, shown and not told: a hand draws a loop, as the tether must be drawn round the loose piece.
    if (S.stats.hauls === 0 && !this.shop && !this.lab && this.input.id === null) {
      const u = (now % 2200) / 2200, turn = u * 6.2832 - 1.5708, cx = W / 2 - 20, hx = cx - 6 + Math.cos(turn) * 20, hy = (H - 44) * 0.72 + Math.sin(turn) * 14;
      ctx.fillStyle = '#ffffff';
      for (let n = 1; n < 14; n++) { const a = turn - n * 0.22; ctx.globalAlpha = 1 - n / 14; ctx.fillRect(Math.round(cx + Math.cos(a) * 20), Math.round((H - 44) * 0.72 + Math.sin(a) * 14) - 2, 2, 2); }
      ctx.globalAlpha = 1;
      draw(ctx, 'ui', 'hand', hx, hy);
      if (S.stats.moves < 1.5) draw(ctx, 'logo', 'logo', W / 2 - 66, 62);
    }
    // Where the thumb is steering from, and which way.
    if (this.input.id !== null && !this.shop && !this.lab) {
      const { ax, ay, px, py } = this.input;
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(ax) - 1, Math.round(ay) - 1, 3, 3);
      this.line(ax, ay, px, py, 0.5);
      ctx.globalAlpha = 1;
    }
    this.shopRise = this.shop ? Math.min(1, this.shopRise + 0.12) : 0;
    if (this.shop) this.drawShop();
    this.labRise = this.lab ? Math.min(1, this.labRise + 0.12) : 0;
    if (this.lab) this.drawLab();
  }
  // The map: everything within the tether's reach, the core in the middle. Ground that has been seen shows as
  // rock or open; the rest only as whose ground it is, so there is always somewhere to choose to go. Whose it is
  // is asked of the world as far as it is known (`biomeKnown`): what a piece already made holds, seen or not, so
  // that an older saved game's map never shows a place that its ground does not have.
  // The map. In the corner it shows the ground near the drill with the drill in its middle, so many cells to a
  // pixel as RANGE gives: the whole of a long reach in so small a square cannot be read. The core, where it is off
  // the map, is a mark at the map's edge on the way home. `big` draws the chart instead: { size, per }, the whole
  // reach about the core, in a square that many pixels across.
  drawMap(x, y, big = null) {
    const { ctx } = this, w = this.world, d = this.drill, R = this.val('tether'), lens = this.val('maplens');
    const size = big ? big.size : 46, per = big ? big.per : this.val('maprange'), mx0 = big ? big.cx ?? HX : Math.floor(d.x) + 0.5, my0 = big ? big.cy ?? HY : Math.floor(d.y) + 0.5;
    const M = big ? (this.chartMap ??= {}) : this;
    if (!big) {
      slice9(ctx, 'ui', 'panel', x - 3, y - 3, MAP_FRAME, MAP_FRAME_H);
      this.mapRect = [x - 3, y - 3, MAP_FRAME, MAP_FRAME_H];
      // With the chart bought, a tap on the map opens it.
      if (this.val('chart') && !this.lab && !this.shop) {
        ctx.fillStyle = '#ffe14a'; ctx.fillRect(x - 2, y - 2, size + 4, 1); ctx.fillRect(x - 2, y + size + 2, size + 4, 1);
        this.button(x - 3, y - 3, MAP_FRAME, MAP_FRAME_H, () => this.openLab(true, 'chart'));
      }
    }
    let map = M.mapCanvas;
    if (!map || map.width !== size) { map = M.mapCanvas = document.createElement('canvas'); map.width = map.height = size; M.mapData = map.getContext('2d', { willReadFrequently: true }).createImageData(size, size); M.mapAt = -1; M.mapFor = null; }
    // The picture is drawn again when what it shows may have changed. The chart knows that from the ground's own
    // count of its changes (`World.stirred`), and stands as it is while nothing moves, however long it is open. The
    // map in the corner does not ask that count, which in flight moves nearly every frame, more often than is worth
    // drawing again: it is drawn again every half second as well, which catches what the version does not.
    const view = `${this.version}${big ? `+${w.stirred}` : ''}:${R}:${per}:${lens}:${mx0},${my0}`;
    if (M.mapFor !== view || (!big && this.time - M.mapAt > 0.5)) {
      M.mapAt = this.time; M.mapFor = view;
      const px = M.mapData.data;
      // (In the corner, where a pixel is three cells across and more, the lens looks at four cells spread over it,
      // a quarter and three quarters of the way across and down, and shows the one it ranks highest (`LENS_RANK`):
      // a lone cache or hazard is not lost between the cells the pixels' middles fall on. A cell more a pixel is
      // looked at only where the lens has anything to tell apart.)
      const spread = !big && per >= 3 && lens > 0;
      // (The chart's borders: the grounds of the line of pixels above, made once for its size, and of the pixel to
      // the left, so no ground is asked of the world twice.)
      const line = big ? (M.mapLine?.length === size ? M.mapLine : (M.mapLine = new Int32Array(size))) : null;
      for (let v = 0, left = -1; v < size; v++) for (let u = 0; u < size; u++) {
        const wx = Math.floor(mx0 + (u - size / 2 + 0.5) * per), wy = Math.floor(my0 + (v - size / 2 + 0.5) * per), o = (v * size + u) * 4, k = w.peek(wx, wy), row = rowOf(w.biomeKnown(wx, wy)), id = row.id;
        let [r, g, b] = row.map;
        const inside = Math.hypot(wx - C, wy - C) <= R;
        let shade = (k < 0 ? unseenShade(row) : k === K.EMPTY ? 0.12 : 0.85);
        if (k < 0 && cellHash(wx >> 3, wy >> 3, id) < UNSEEN_GRAIN) { r = GRAIN_RGB[id * 3]; g = GRAIN_RGB[id * 3 + 1]; b = GRAIN_RGB[id * 3 + 2]; shade = GRAIN_SHADE[id]; }
        if (line !== null) { if ((u > 0 && left !== id) || (v > 0 && line[u] !== id)) shade *= EDGE; line[u] = id; left = id; }
        shade *= inside ? 1 : 0.45;
        // What the lens tells apart is drawn in its own colour, at full strength.
        let L = k === K.RARE ? RARE_LENS[row.kin] : k > 0 ? LENS[k] : undefined, lit = inside;
        if (L !== undefined && L[0] > lens) L = undefined;
        if (spread) {
          let rank = L === undefined ? 0 : k === K.RARE ? RARE_RANK : LENS_RANK[k];
          for (let q = 0; q < 4 && rank < RARE_RANK; q++) {
            const sx = Math.floor(mx0 + (u - size / 2 + 0.25 + (q & 1) * 0.5) * per), sy = Math.floor(my0 + (v - size / 2 + 0.25 + (q >> 1) * 0.5) * per), sk = w.peek(sx, sy);
            if (sk <= 0) continue;
            const SL = sk === K.RARE ? RARE_LENS[rowOf(w.biomeKnown(sx, sy)).kin] : LENS[sk], sr = sk === K.RARE ? RARE_RANK : LENS_RANK[sk];
            if (SL === undefined || SL[0] > lens || sr <= rank) continue;
            L = SL; rank = sr; lit = Math.hypot(sx - C, sy - C) <= R;
          }
        }
        if (L !== undefined) { r = L[1]; g = L[2]; b = L[3]; shade = lit ? 1 : 0.6; }
        px[o] = r * shade + 8; px[o + 1] = g * shade + 7; px[o + 2] = b * shade + 10; px[o + 3] = 255;
      }
      map.getContext('2d', { willReadFrequently: true }).putImageData(M.mapData, 0, 0);
    }
    ctx.drawImage(map, x, y);
    const at = (wx, wy) => [x + size / 2 + (wx - mx0) / per, y + size / 2 + (wy - my0) / per];
    // The tether, the reach, what each direction hides, the core and the drill.
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, size, size); ctx.clip();
    ctx.fillStyle = '#f4ecd8'; ctx.globalAlpha = 0.5;
    for (let a = 0; a < 6.283; a += 0.09) { const [mx, my] = at(HX + Math.cos(a) * R, HY + Math.sin(a) * R); ctx.fillRect(Math.round(mx), Math.round(my), 1, 1); }
    ctx.globalAlpha = 1; ctx.fillStyle = TETHERS[this.S.lv.tether].a;
    for (let n = 1; n < this.band.length; n++) {
      const [ax, ay] = at(...this.band[n - 1]), [bx, by] = at(...this.band[n]);
      // (A span that lies off the map is not walked: far out, that is nearly all of them.)
      if (Math.max(ax, bx) < x - 1 || Math.min(ax, bx) > x + size + 1 || Math.max(ay, by) < y - 1 || Math.min(ay, by) > y + size + 1) continue;
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
      for (let s = 0; s <= steps; s++) ctx.fillRect(Math.round(ax + (bx - ax) * s / steps), Math.round(ay + (by - ay) * s / steps), 1, 1);
    }
    for (let dir = 0; dir < 4; dir++) {
      if (this.S.relics[dir]) continue;
      const [mx, my] = at(HX + DX[dir] * RELIC_R, HY + DY[dir] * RELIC_R);
      ctx.fillStyle = GEM_COLOR[DIR_BIOME[dir]]; ctx.fillRect(Math.round(mx) - 1, Math.round(my) - 1, 3, 3);
    }
    // And what each corner hides, a shrine (where it is laid: js/world.js, `shrine`), from the start as a relic is:
    // a cross in its two parents' colours, until it is hauled.
    for (let c = 0; c < 4; c++) {
      if (this.S.shrines?.[c] || !w.shrine(c)) continue;
      const [mx, my] = at(HX + SHRINES[c][0], HY + SHRINES[c][1]), row = rowOf(SEAMS[c][0]), ax = Math.round(mx), ay = Math.round(my);
      ctx.fillStyle = GEM_COLOR[row.gemA]; ctx.fillRect(ax - 1, ay, 3, 1); ctx.fillRect(ax, ay - 1, 1, 3);
      ctx.fillStyle = GEM_COLOR[row.gemB]; ctx.fillRect(ax, ay, 1, 1);
    }
    // A corner's herald (js/world.js: CORNER_HERALDS) is rung in its rare hazard's colour once the finder reaches it,
    // within the tether's reach, until its heart has been seen.
    const level = this.val('mapfinder');
    if (level > 0) for (const [hx, hy, type] of this.cornerSites()) {
      if (w.peek(hx, hy) >= 0 || Math.hypot(hx + 0.5 - HX, hy + 0.5 - HY) > R || Math.hypot(hx + 0.5 - d.x, hy + 0.5 - d.y) > FINDER[level]) continue;
      const [mx, my] = at(hx + 0.5, hy + 0.5);
      ctx.fillStyle = SPOT[type][1];
      for (let a = 0; a < 6.283; a += 0.8) ctx.fillRect(Math.round(mx + Math.cos(a) * 3 - 0.5), Math.round(my + Math.sin(a) * 3 - 0.5), 1, 1);
    }
    // The first keystone slab, a ring of its own size, until it hangs by no key: somewhere to go, once it is near
    // enough to lie on the map (or on the chart, which shows the whole reach).
    const slab = this.firstRing();
    if (slab) {
      const [mx, my] = at(slab.cx + 0.5, slab.cy + 0.5), r = Math.max(1.5, slab.p / per);
      // (Where its middle lies on the map: nothing beyond the map is marked at its edge.)
      if (Math.max(Math.abs(mx - x - size / 2), Math.abs(my - y - size / 2)) <= size / 2 - 2) {
        ctx.fillStyle = SPOT.key[1];
        for (let a = 0; a < 6.283; a += 0.7 / r) ctx.fillRect(Math.round(mx + Math.cos(a) * r - 0.5), Math.round(my + Math.sin(a) * r - 0.5), 1, 1);
      }
    }
    // Things seen and not yet taken, each a dot in its own colour.
    for (const [cell, , colour] of this.S.marks) {
      const wx = cell % N, wy = Math.floor(cell / N);
      if (Math.hypot(wx + 0.5 - HX, wy + 0.5 - HY) > R) continue;
      const [mx, my] = at(wx + 0.5, wy + 0.5);
      ctx.fillStyle = '#0c0a12'; ctx.fillRect(Math.round(mx) - 1, Math.round(my) - 1, 3, 3);
      ctx.fillStyle = colour; ctx.fillRect(Math.round(mx) - 1, Math.round(my) - 1, 2, 2);
    }
    if (((this.time * 2) | 0) % 2) this.world.wrecks.forEach(([wx, wy], n) => {
      if (this.S.wrecks?.[n] || Math.hypot(wx + 0.5 - HX, wy + 0.5 - HY) > R) return;
      const [mx, my] = at(wx + 0.5, wy + 0.5);
      ctx.fillStyle = '#ff9a3a'; ctx.fillRect(Math.round(mx) - 1, Math.round(my), 3, 1); ctx.fillRect(Math.round(mx), Math.round(my) - 1, 1, 3);
    });
    // What the finder knows of and the drill has not seen: a dot each, in the find's own colour, ringed dark. In the
    // corner the finder is asked as far as it reaches (FINDER), which is further than the map shows from RANGE's
    // first level to its last: a find beyond the map's edge is a pip on its rim, in its colour, on the line from the
    // drill to it, so the far levels of the finder show what they find. (The chart shows the whole reach.)
    // (Only the RIM nearest of those past the edge: at RANGE's far levels the map shows a few dozen finds already,
    // and a rim of pips all round says nothing.)
    const half = size / 2 - 1, finds = big ? this.findsNear(mx0, my0, size * per / 2, M) : this.findsNear(mx0, my0, FINDER[this.val('mapfinder')], M);
    let rims = 0;
    for (let n = 0; n < finds.length; n++) {
      const [what, fx, fy] = finds[n], [mx, my] = at(fx + 0.5, fy + 0.5), ox = mx - x - size / 2, oy = my - y - size / 2;
      if (Math.max(Math.abs(ox), Math.abs(oy)) > half) {
        // (Kept nearest first: the furthest of RIM is put out by a nearer.)
        const far = ox * ox + oy * oy;
        let k = rims < RIM ? rims++ : RIM;
        while (k > 0 && RIM_FAR[k - 1] > far) { if (k < RIM) { RIM_FAR[k] = RIM_FAR[k - 1]; RIM_OF[k] = RIM_OF[k - 1]; } k--; }
        if (k < RIM) { RIM_FAR[k] = far; RIM_OF[k] = n; }
        continue;
      }
      ctx.fillStyle = '#0c0a12'; ctx.fillRect(Math.round(mx) - 2, Math.round(my) - 2, 4, 4);
      ctx.fillStyle = SPOT[what][1]; ctx.fillRect(Math.round(mx) - 1, Math.round(my) - 1, 2, 2);
    }
    for (let r = 0; r < rims; r++) {
      const [what, fx, fy] = finds[RIM_OF[r]], [mx, my] = at(fx + 0.5, fy + 0.5), ox = mx - x - size / 2, oy = my - y - size / 2, off = Math.max(Math.abs(ox), Math.abs(oy));
      // (Flat along the rim it lies on: two pixels along the top or the foot, two down a side.)
      const ex = Math.round(x + size / 2 + ox * half / off), ey = Math.round(y + size / 2 + oy * half / off), flat = Math.abs(oy) >= Math.abs(ox);
      const rx = Math.max(x, Math.min(x + size - (flat ? 2 : 1), flat ? ex - 1 : ex)), ry = Math.max(y, Math.min(y + size - (flat ? 1 : 2), flat ? ey : ey - 1));
      ctx.fillStyle = SPOT[what][1]; ctx.fillRect(rx, ry, flat ? 2 : 1, flat ? 1 : 2);
    }
    // Pockets within reach that the drill has not been into: a pip each, in the pocket's own colour.
    // (Only those that lie on the map: the map in the corner shows the drill's surroundings and nothing beyond.)
    for (const Z of this.pocketPips()) {
      const [mx, my] = at(Z.cx + 0.5, Z.cy + 0.5);
      if (Math.max(Math.abs(mx - x - size / 2), Math.abs(my - y - size / 2)) > size / 2 - 2) continue;
      ctx.fillStyle = '#0c0a12'; ctx.fillRect(Math.round(mx) - 2, Math.round(my) - 2, 4, 4);
      ctx.fillStyle = rowOf(Z.row).pocket.pip ?? bright(rowOf(Z.row).map); ctx.fillRect(Math.round(mx) - 1, Math.round(my) - 1, 2, 2);
    }
    // The core; where it is off the map, a mark at the map's edge on the way home.
    let [hx, hy] = at(HX, HY);
    const hox = hx - x - size / 2, hoy = hy - y - size / 2, hoff = Math.max(Math.abs(hox), Math.abs(hoy)), hedge = size / 2 - 2;
    if (hoff > hedge) { hx = x + size / 2 + hox * hedge / hoff; hy = y + size / 2 + hoy * hedge / hoff; }
    ctx.fillStyle = '#84dcff'; ctx.fillRect(Math.round(hx) - 1, Math.round(hy) - 1, 3, 3);
    const [dx, dy] = at(d.x, d.y);
    ctx.fillStyle = ((this.time * 3) | 0) % 2 ? '#ffffff' : '#ffd83a'; ctx.fillRect(Math.round(dx) - 1, Math.round(dy) - 1, 3, 3);
    ctx.restore();
    // (A row of the MAP tab being fitted sweeps the map in the corner.)
    if (!big) this.fitter.map(this, ctx, x, y, size, size);
  }
  // The finds the finder marks within `half` cells of a place (square) and within its range of the drill: those of the kinds its level knows, that
  // still lie where the seed laid them (a pocket or a wreck may have taken the place), within the tether's reach,
  // and that the drill has not yet seen (what it has seen is on the map already). Asked of the seed alone: no
  // ground is made to answer. The list is kept while the place, the span and the level stay the same.
  // (`M` keeps the list: the map in the corner and the chart, drawn in one frame, keep one each, so that neither
  // makes the other's again.)
  findsNear(cx, cy, half, M = this) {
    const w = this.world, level = this.val('mapfinder'), R = this.val('tether');
    if (!level) return NO_FINDS;
    // (Sectors of finds that are both in the view asked about and within the finder's range of the drill.)
    const d = this.drill, far = FINDER[level], lo = (a, b) => Math.floor((Math.max(a - half, b - far) - C) / FIND), hi = (a, b) => Math.floor((Math.min(a + half, b + far) - C) / FIND);
    const x0 = lo(cx, d.x), x1 = hi(cx, d.x), y0 = lo(cy, d.y), y1 = hi(cy, d.y);
    // (What the seed lays there is asked again only when the drill has gone eight cells or the span or the level has
    // changed; which of it is still unseen, whenever the ground has: in flight, every cell.)
    const key = `${this.S.seed}:${level}:${R}:${x0},${y0},${x1},${y1}:${Math.floor(d.x / 8)},${Math.floor(d.y / 8)}`;
    if (M.laidFor !== key) {
      M.laidFor = key; M.laid = []; M.foundAt = -1;
      for (let sy = y0; sy <= y1 && M.laid.length < 200; sy++) for (let sx = x0; sx <= x1; sx++) {
        // (Asked without an array a sector: in the corner the finder's whole range is asked.)
        const what = w.findName(sx, sy), fx = w.asked.fx, fy = w.asked.fy;
        // (Twin stones and a fossil are named in their bands everywhere, and have cells only where the world says they
        // are laid, `asked.laid`: far out, in generation 2.)
        if (what === null || !(FOUND[what] <= level) || ((what === 'twin' || what === 'fossil') && !w.asked.laid) || Math.hypot(fx - C, fy - C) > R || Math.hypot(fx + 0.5 - d.x, fy + 0.5 - d.y) > far) continue;
        const laid = w.kindAt(fx, fy, w.biomeAt(fx, fy));
        if ((what === 'cache' && laid !== K.CACHE) || (what === 'prism' && laid !== K.PRISM) || rowOf(w.biomeAt(fx, fy)).pocket !== null) continue;
        // (With a cell of it that the seed laid solid, and what it laid there: a big geode's heart is hollow, so the
        // ore beside it. A find hauled away unseen, the tether round it from afar, is not seen, but that cell is
        // open then, and the find is gone: its mark was left on the map for good.)
        const px = laid === K.EMPTY ? fx + 1 : fx;
        M.laid.push([what, fx, fy, fy * N + px, laid === K.EMPTY ? w.kindAt(px, fy, w.biomeAt(px, fy)) : laid]);
      }
    }
    // (Into one of two lists `M` keeps, made once, in turn: the ground changes at every cut, and a list made at
    // each would be garbage at each. Two, so a list asked for before the ground changed is not emptied under
    // whoever still holds it.)
    if (M.foundAt !== this.version) {
      M.foundAt = this.version;
      const into = M.found === M.foundA ? (M.foundB ??= []) : (M.foundA ??= []);
      into.length = 0;
      // (Unseen, and still there: the cell the seed laid solid holds what it laid, or is not made yet.)
      for (const f of M.laid) { const now = w.laid(f[3]); if (w.peek(f[1], f[2]) < 0 && (now < 0 || now === f[4])) into.push(f); }
      M.found = into;
    }
    return M.found;
  }
  // The hearts of the corners' heralds in this world, [x, y, type] each: asked of the world's sites once a game
  // (`begin` forgets them, as a game loaded may lay its corners by other rules).
  cornerSites() {
    if (this.cornersFor !== this.S.seed) {
      this.cornersFor = this.S.seed; this.corners = [];
      for (const [sx, sy] of CORNER_HERALDS) { const S = this.world.siteOf(sx, sy); if (S !== null && S.corner >= 0) this.corners.push([S.cx, S.cy, S.type]); }
    }
    return this.corners;
  }
  // The pockets the map marks: those whose middles lie within the tether's reach and that the drill has not been
  // into, the PIPS nearest the drill. One whose ground was made before pockets were laid (an older saved game's:
  // the cell at its middle holds some other ground) is not there, and is not marked. The list is made again when
  // the drill comes into another sector of pockets, the reach changes or a pocket is visited: not every frame.
  pocketPips() {
    const w = this.world, d = this.drill, S = this.S, R = this.val('tether');
    const key = `${S.seed}:${Math.floor((d.x - C) / ZONE)},${Math.floor((d.y - C) / ZONE)}:${R}:${Object.keys(S.visited).length}`;
    if (key !== this.pipsFor) {
      this.pipsFor = key;
      const far = Z => (Z.cx + 0.5 - d.x) ** 2 + (Z.cy + 0.5 - d.y) ** 2;
      this.pips = w.pocketsWithin(R).filter(Z => !S.visited[Z.key] && w.biomeKnown(Z.cx, Z.cy) === Z.row).sort((a, b) => far(a) - far(b)).slice(0, PIPS);
    }
    return this.pips;
  }
  // The first keystone slab, while it is there to be found: the world's record of it, or null once none of its
  // keys is left (cut, or hauled with it), or where the ground there was made before slabs were (an older saved
  // game: what is there is the cells' to say). Where the ground is not made yet, it will be.
  firstRing() {
    const w = this.world, slab = w.firstSlab;
    return slab && slab.keys.some(i => { const k = w.laid(i); return k < 0 || k === K.KEY; }) ? slab : null;
  }
  bar(x, y, w, icon, fill, color, flash) {
    const { ctx } = this;
    draw(ctx, 'icons', icon, x, y);
    ctx.fillStyle = '#0c0a12'; ctx.fillRect(x + 11, y + 2, w - 11, 6);
    ctx.fillStyle = flash ? '#ffffff' : color; ctx.fillRect(x + 12, y + 3, Math.round((w - 13) * Math.max(0, Math.min(1, fill))), 4);
  }
  // The chart's view, kept within bounds: zoomed from 1 (the whole reach) to where a cell is four pixels, its middle
  // never so far from the core that the view leaves the square the whole reach is drawn in.
  chartMost() { return Math.max(1, this.chartBase / 0.25); }
  chartView() {
    const c = this.chart, size = this.chartRect ? this.chartRect[2] : 1;
    c.zoom = Math.max(1, Math.min(this.chartMost(), c.zoom));
    const room = Math.max(0, size * this.chartBase / 2 * (1 - 1 / c.zoom));
    c.x = Math.max(HX - room, Math.min(HX + room, c.x)); c.y = Math.max(HY - room, Math.min(HY + room, c.y));
    return c;
  }
  // Zoom the chart `by` times about the point (sx, sy) of the screen, which stays over the same ground.
  chartZoom(by, sx, sy) {
    if (!this.chartRect) return;
    const c = this.chartView(), [rx, ry, size] = this.chartRect, ox = sx - rx - size / 2, oy = sy - ry - size / 2, per = this.chartBase / c.zoom;
    const wx = c.x + ox * per, wy = c.y + oy * per;
    c.zoom = Math.max(1, Math.min(this.chartMost(), c.zoom * by));
    c.x = wx - ox * this.chartBase / c.zoom; c.y = wy - oy * this.chartBase / c.zoom;
    this.chartView();
  }
  // A wheel turned over the chart zooms it about the pointer, and over the lab's notes scrolls them (`delta` in the
  // game's pixels: js/main.js turns lines and pages into those). Returns whether either took it.
  wheel(x, y, delta) {
    if (this.lab && this.labTab === 'lab') {
      const g = this.labGeom();
      if (x < g.px || y < g.py || x >= g.px + g.pw || y >= g.py + g.ph) return false;
      this.labScroll = Math.max(0, Math.min(g.most, this.labScroll + delta)); this.labVel = 0; this.labAim = null;
      return true;
    }
    const r = this.lab && this.labTab === 'chart' ? this.chartRect : null;
    if (!r || x < r[0] || y < r[1] || x >= r[0] + r[2] || y >= r[1] + r[3]) return false;
    this.chartZoom(delta < 0 ? 1.2 : 1 / 1.2, x, y);
    return true;
  }
  // A finger moved on the chart: one drags it, two pinch it (and drag it by the point between them).
  chartMove(id, x, y) {
    const T2 = this.chartTouch, was = T2.get(id), c = this.chartView();
    if (T2.size >= 2) {
      const [oid, other] = [...T2].find(([key]) => key !== id), before = Math.hypot(was[0] - other[0], was[1] - other[1]), after = Math.hypot(x - other[0], y - other[1]);
      const mid = [(x + other[0]) / 2, (y + other[1]) / 2], midWas = [(was[0] + other[0]) / 2, (was[1] + other[1]) / 2], per = this.chartBase / c.zoom;
      c.x -= (mid[0] - midWas[0]) * per; c.y -= (mid[1] - midWas[1]) * per;
      if (before > 4 && after > 4) this.chartZoom(after / before, mid[0], mid[1]);
    } else { const per = this.chartBase / c.zoom; c.x -= (x - was[0]) * per; c.y -= (y - was[1]) * per; }
    T2.set(id, [x, y]);
    this.chartView();
  }
  // The chart can be read once it is bought, wherever the drill is.
  get charted() { return this.val('chart') > 0; }
  // The tabs of the panel the top bar opens (STATS: what the drill is now; ANALYSIS: the lab's notes; CHART: the
  // whole reach), and its cross. (A tab chosen stops the lab's list where it is: left running, it would run on again
  // when its tab came back, with no finger near it.)
  panelTabs(px, py, pw) {
    this.headAt(px, py, pw);
    for (const id of this.panelIds()) this.headTab(PANEL_NAMES[id], this.labTab === id, false, () => { this.labTab = id; this.labVel = 0; this.labAim = null; sfx.tap(); });
    this.headClose(() => { this.lab = false; sfx.tap(); });
  }
  // A panel's header, the shop's and the bar's panel's alike (UI.HEAD tall): its tabs from the content's column
  // (UI.INSET into the row boxes under them), UI.TAB_GAP apart, their boxes meeting; the one open underlined at the
  // header's foot, a row clear of a Mandarin tab's shadow and a row over the first box; a green dot after one with
  // something to buy. Then the cross, its ink ending on the content's right column, and its box from the last tab's
  // to the panel's edge, so that neither takes a tap meant for the other. `headAt` begins a header, `headTab` adds
  // a tab to it, `headClose` ends it. (Its place is kept on one object, made once.)
  headAt(px, py, pw) { const h = this.headFit ??= { px: 0, py: 0, pw: 0, tx: 0, end: 0 }; h.px = px; h.py = py; h.pw = pw; h.tx = px + 2 * UI.INSET; h.end = px; }
  headTab(name, on, ready, act) {
    const { ctx } = this, h = this.headFit, tw = textWidth(name), tx = h.tx;
    text(ctx, name, tx, h.py + 7, on ? '#ffe14a' : '#8a84a0');
    if (on) { ctx.fillStyle = '#ffe14a'; ctx.fillRect(tx, h.py + UI.HEAD - 2, tw, 1); }
    if (ready) { ctx.fillStyle = '#8ce060'; ctx.fillRect(tx + tw + 2, h.py + 6, 2, 2); }
    this.buttons.unshift({ x: tx - UI.INSET, y: h.py, w: tw + UI.TAB_GAP, h: UI.HEAD, act });
    h.end = tx - UI.INSET + tw + UI.TAB_GAP; h.tx = tx + tw + UI.TAB_GAP;
  }
  headClose(act) {
    const h = this.headFit, x = Math.max(h.px + h.pw - 24, h.end);
    text(this.ctx, 'x', h.px + h.pw - 2 * UI.INSET, h.py + 6, '#ffffff', 1);
    this.buttons.unshift({ x, y: h.py, w: h.px + h.pw - x, h: UI.HEAD, act });
  }
  // What the player is saving for, chosen for this game where it has not been yet (js/goal.js).
  saving() { const g = this.goal; return g !== undefined && g.of === this.S ? g : pickGoal(this); }
  // Whether the bar shows the corners' gems in the directions' places: while what is saved for is paid in a corner's
  // gems (js/goal.js), or the drill is out where they are had, far out on a diagonal (CORNER_BAR, CORNER_LANE). A few
  // sums a frame, so it cannot flicker with anything but where the drill is.
  cornerBar() {
    const g = this.saving();
    if (g.id !== null && g.gem >= 5) return true;
    const dx = this.drill.x - C, dy = this.drill.y - C, r2 = dx * dx + dy * dy;
    return r2 > CORNER_BAR * CORNER_BAR && Math.abs(Math.abs(dx) - Math.abs(dy)) < CORNER_LANE * Math.sqrt(r2);
  }
  // What the drill is now, a line a thing: every figure read from the game itself, so it cannot say otherwise than
  // the game plays. What a hazard does to this drill is in green where something fitted has turned it.
  stats() {
    const S = this.S, parts = (S.wrecks ?? []).filter(Boolean).length, mender = this.val('mender'), lv = S.lv;
    // (Counted from the lab's own book, not the game's running count, so a book filled by hand is read as it is.)
    let known = 0, best = 0;
    for (const e of LAB) { const n = S.lab[e.key]; if (n) { known++; best = Math.max(best, labLevel(n)); } }
    // The panel is no more than 23 lines on the narrowest phone, and every line one line: what a later row adds is
    // said on a line there already, and where two ways of saying a line are given the first that fits is said.
    const room = Math.min(this.W - 8, 200) - 20, first = (...ways) => ways.find(([name, value]) => textWidth(name) + textWidth(value) <= room) ?? ways[ways.length - 1];
    const tierOf = id => TIERED[id][Math.min(TIERED[id].length - 1, lv[id])];
    const out = Math.floor(S.out ?? 0), load = WINCH_LOAD[lv.winch], live = this.val('livecatch'), spin = this.val('flywheel'), foe = this.val('trophy');
    const beasts = S.fauna?.met ? Object.keys(S.fauna.met).length : 0, places = Object.keys(S.met).length, chart = this.val('chart') > 0, finder = this.val('mapfinder');
    const refine = this.val('refinery'), cut = this.val('cutter'), specs = [1, 2, 3, 4].map(k => this.specs(k)), keeps = Math.round(this.val('blackbox') * 100), PLACES = places === 1 ? 'PLACE' : 'PLACES';
    // (The corners' shrines held and the fossils found whole, once there is one: on a line of its own, and the lamp
    // said on the scanner's line then, so the panel is no longer for it.)
    const shrines = (S.shrines ?? []).filter(Boolean).length, fossils = [0, 1, 2, 3].filter(n => (S.fossils ?? 0) & (1 << n)).length, deep = shrines + fossils > 0;
    // (A rare hazard alive in a loop pays more with the live catch, said on its own line.)
    const rare = (name, does) => live > 1 ? [...first([name, `${does}, x${live} LIVE`], [name, `${does} x${live} LIVE`], [name, `x${live} LIVE`]), true] : [name, does, false];
    return [
      // (How far out the drill has been, of how far the tether goes.)
      first(['REACH', `${tierOf('tether')} ${out > 0 ? `${Math.min(out, this.val('tether'))}/${this.val('tether')}` : this.val('tether')} CELLS`],
        ['REACH', out > 0 ? `${Math.min(out, this.val('tether'))}/${this.val('tether')} CELLS` : `${this.val('tether')} CELLS`]),
      // (The reach, the bit, the ram, the winch, the scanner and the hull say which they are where the line has room:
      // `tiers`.)
      [...first(['BIT', `${tierOf('drill')} MK${this.val('drill')}, x${CUT[lv.drill]}${lv.drill >= 5 ? ' PLOUGH' : ''}`], ['BIT', `MK${this.val('drill')}, CUTS x${CUT[lv.drill]}${lv.drill >= 5 ? ' PLOUGH' : ''}`]), lv.drill >= 5 || undefined],
      first(['SPEED', `${tierOf('momentum')} RAM x${this.val('momentum')}`], ['SPEED', `x${this.val('momentum')}`]),
      first(['WINCH', `${tierOf('winch')} x${this.val('winch')}, LOAD ${load < 10000 ? load : compact(load)}`], ['WINCH', `x${this.val('winch')}, LOAD ${load < 10000 ? load : compact(load)}`]),
      // (Once there is a shrine or a fossil the lamp is said on the scanner's line: see `deep`.)
      deep ? [...first(['SCAN', `${tierOf('scanner')} ${this.val('scanner')} CELLS, LAMP ${this.val('lamp')}`], ['SCAN', `${this.val('scanner')} CELLS, LAMP ${this.val('lamp')}`], ['SCAN', `${this.val('scanner')}, LAMP ${this.val('lamp')}`]), S.lv.lamp > 0 || undefined]
        : first(['SCAN', `${tierOf('scanner')} ${this.val('scanner')} CELLS`], ['SCAN', `${this.val('scanner')} CELLS`]),
      first(['HULL', `${tierOf('hull')} ${this.hull}/${this.val('hull')} PIPS`], ['HULL', `${this.hull}/${this.val('hull')} PIPS`]),
      ['MENDS', `1 PIP / ${mender} S`, this.S.lv.mender > 0],
      ['LAVA', this.swims ? lv.lavaskin >= 2 ? 'SWIMS, SMELTS' : 'SWIMS IN IT' : 'BURNS', this.swims],
      ['SPORES', this.val('sporedrive') ? `SPEED x${BOOST.by}${lv.sporedrive >= 2 ? ', GRAFT' : ''}` : 'KNOCK', this.val('sporedrive') > 0],
      ['ARCS', this.val('arccoil') ? lv.arccoil >= 2 ? 'MEND, CHARGE BIT' : 'MEND A PIP' : 'KNOCK', this.val('arccoil') > 0],
      // (A rare hazard has its line once it has been met: there would be no room on a phone for all of them.)
      ...[['bell', 'BELLS', 'KNOCK'], ['vent', 'JETS', 'KNOCK'], ['worm', 'WORMS', 'BITE'], ['lodestone', 'LODESTONES', 'KNOCK']].filter(([type]) => S.rare?.[type]).map(([, name, does]) => rare(name, does)),
      // (The wrecks' parts, and the flywheel's run.)
      spin ? [...first(['HAUL PAY', `+${parts * 10}% ${parts}/8, SPIN +${Math.round(spin * 100)}%`], ['HAUL PAY', `+${parts * 10}%, SPIN +${Math.round(spin * 100)}%`]), true]
        : ['HAUL PAY', `+${parts * 10}% (${parts}/8 PARTS)`, parts > 0],
      // (The places met; and the creatures, once one has been: how many kinds, lit while the pal is with the drill.)
      beasts ? [...first(['MET', `${places} ${PLACES}, ${beasts}/${KINDS} BEASTS`], ['MET', `${places} ${PLACES}, ${beasts} ${beasts === 1 ? 'BEAST' : 'BEASTS'}`]), !!S.fauna.pal] : ['MET', `${places} ${PLACES}`],
      // (What the refinery and the gem cutter multiply: on the narrowest phone the refinery's own is plainly grit.)
      [...first(['REFINERY', `GRIT x${refine}, GEMS x${cut}`], ['REFINERY', `GRIT x${refine} GEMS x${cut}`], ['REFINERY', `x${refine}, GEMS x${cut}`]), S.lv.refinery + S.lv.cutter > 0],
      ...(deep ? [first(['CORNERS', `${shrines}/4, FOSSILS ${fossils}/4`], ['CORNERS', `${shrines}/4 FOSSILS ${fossils}/4`], ['SHRINES', `${shrines}/4 BONES ${fossils}/4`])] : [['LAMP', `${this.val('lamp')} CELLS`, S.lv.lamp > 0]]),
      // (From its third level the black box keeps what a lost trip learnt as well: js/game.js, `keepLore`.)
      lv.blackbox >= 3 ? [...first(['BLACK BOX', `KEEPS ${keeps}% +LORE`], ['BLACK BOX', `${keeps}% +LORE`]), true] : ['BLACK BOX', keeps ? `KEEPS ${keeps}%` : 'NONE', S.lv.blackbox > 0],
      known ? [...first(['ANALYSED', `${known}/${LAB.length}, UP TO +${best}%`], ['ANALYSED', `${known}/${LAB.length}, +${best}%`]), true] : ['ANALYSED', `0/${LAB.length}`, false],
      // (The specimens of each direction, north, south, west and east; and what a foe at rest pays in a loop.)
      foe ? [...first(['SPECIMENS', `${specs.join('/')}, FOE +${foe}`], ['SPEC', `${specs.join('/')}, FOE +${foe}`], ['SPEC', `${specs.join('/')}`]), true]
        : first(['SPECIMENS', specs.join(' / ')], ['SPECIMENS', specs.join('/')], ['SPEC', specs.join('/')]),
      ['MAP', chart ? `${Math.round(this.val('maprange') * 46)}, ${MAPS[1].show(this.val('maplens'))}, CHART` : `${Math.round(this.val('maprange') * 46)} CELLS, ${MAPS[1].show(this.val('maplens'))}`, this.S.lv.maprange + this.S.lv.maplens + this.S.lv.chart > 0],
      ['FINDER', finder ? `${['', 'CACHES', '+GEODES', 'ALL'][finder]}, ${FINDER[finder]} CELLS` : 'NONE', finder > 0],
    ];
  }
  // The menu: how loud the sounds are and how loud the music, the language, and a new world (two taps, so a slip of
  // the thumb does not cost a world).
  drawMenu(px, y0, pw) {
    const { ctx } = this, sure = this.confirmReset > 0;
    this.volumeRow('SOUND', soundVolume, setSoundVolume, 'sound', px, y0 + 4, pw);
    this.volumeRow('MUSIC', musicVolume, setMusicVolume, 'music', px, y0 + 28, pw);
    // The language: a tap opens the list of the three under it (and shuts it again), and one chosen from the list
    // that is not the one spoken now is the language: the game is saved and the page loaded again in it
    // (js/lang.js). (Each name is in its own tongue, which no table turns.)
    const speaks = LANGS.findIndex(l => l.id === lang), open = !!this.langOpen, below = open ? LANG_ROWS : 0;
    slice9(ctx, 'ui', open ? 'button-down' : 'button', px + 6, y0 + 52, pw - 12, 20);
    text(ctx, 'LANGUAGE', px + 14, y0 + 58, '#ffffff');
    text(ctx, `${LANGS[speaks].name} ${open ? '^' : 'v'}`, px + pw - 14, y0 + 58, '#8cf2c4', 1);
    this.buttons.unshift({ x: px + 6, y: y0 + 52, w: pw - 12, h: 20, act: () => { this.langOpen = !this.langOpen; sfx.tap(); } });
    if (open) LANGS.forEach((l, n) => {
      const y = y0 + 74 + n * LANG_ROW, on = n === speaks;
      slice9(ctx, 'ui', on ? 'button-down' : 'button', px + 14, y, pw - 28, LANG_ROW - 2);
      text(ctx, l.name, px + 22, y + 4, on ? '#8cf2c4' : '#ffffff');
      if (on) text(ctx, '<', px + pw - 22, y + 4, '#8cf2c4', 1);
      this.buttons.unshift({ x: px + 14, y, w: pw - 28, h: LANG_ROW - 2, act: () => { this.langOpen = false; sfx.tap(); if (!on) { this.save(); chooseLang(l.id); } } });
    });
    slice9(ctx, 'ui', sure ? 'button-off' : 'button', px + 6, y0 + 76 + below, pw - 12, 20);
    text(ctx, sure ? 'TAP AGAIN: NEW WORLD' : 'NEW WORLD', px + pw / 2, y0 + 82 + below, sure ? '#ff7a5a' : '#ffffff', 0.5);
    this.buttons.unshift({ x: px + 6, y: y0 + 76 + below, w: pw - 12, h: 20, act: () => {
      if (this.confirmReset > 0) { this.confirmReset = 0; this.fresh((Math.random() * 1e9) | 0); this.save(); sfx.relic(); } else { this.confirmReset = 2.5; sfx.tap(); }
    } });
  }
  // A row of the menu that sets how loud something is: its name, and a bar of ten steps at the row's right end, as
  // many lit as it is loud. A tap on the bar sets the step under it (just left of the first, nothing), and a tap on
  // the name turns it off, or back on at the step it was at; a tap that sounds is heard at the new step.
  volumeRow(name, get, set, which, px, y, pw) {
    const { ctx } = this, step = get(), bx = px + pw - 14 - VOLUME_BAR, was = this.volumeWas ??= { sound: STEPS_OF_VOLUME, music: STEPS_OF_VOLUME };
    slice9(ctx, 'ui', 'button', px + 6, y, pw - 12, 20);
    text(ctx, name, px + 14, y + 6, step ? '#ffffff' : '#8a84a0');
    for (let n = 0; n < STEPS_OF_VOLUME; n++) { ctx.fillStyle = n < step ? '#8cf2c4' : '#3a3450'; ctx.fillRect(bx + n * 5, y + 7, 4, 6); }
    this.buttons.unshift({ x: px + 6, y, w: pw - 12, h: 20, act: x => {
      const step = get(), to = x === undefined || x < bx - 3 ? (step ? 0 : was[which] || STEPS_OF_VOLUME) : Math.max(0, Math.min(STEPS_OF_VOLUME, Math.ceil((x - bx + 1) / 5)));
      if (step) was[which] = step;
      set(to); sfx.tap();
    } });
  }
  // Under the menu's rows, the long frames written down (`frameTook`) and the frames that threw (`failed`), newest
  // first: how long, and where the time went, so that whoever sees the game freeze can say what it was doing.
  drawStalls(px, y0, pw) {
    const { ctx } = this;
    text(ctx, 'LONG FRAMES', px + 8, y0, '#8a84a0');
    this.stalls.slice().reverse().forEach((s, n) => {
      // (A frame that threw says what and where, as much of it as the panel has room for.)
      if (s.err) { text(ctx, `ERR ${s.where} ${s.err}`.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/ +/g, ' ').slice(0, Math.floor((pw - 16) / 6)), px + 8, y0 + 11 + n * 10, '#ff7a5a'); return; }
      const ours = s.update + s.render, where = ours < s.gap / 2 ? 'BROWSER' : s.ms >= ours / 2 && s.top ? s.top.toUpperCase() : s.update > s.render ? 'STEP' : 'DRAW';
      text(ctx, `${(s.gap / 1000).toFixed(1)}S ${where} ${s.update}+${s.render} AT ${s.out}`, px + 8, y0 + 11 + n * 10, '#bcb4cc');
    });
  }
  // How far apart the lines of STATS are: 11 pixels, or as little as 9 where that many would not fit above the bar.
  statsPitch(rows) { return Math.max(9, Math.min(11, Math.floor((this.H - 48 - 20 - 8) / rows))); }
  drawStats(px, y0, pw) {
    const { ctx } = this, rows = this.stats(), pitch = this.statsPitch(rows.length);
    rows.forEach(([name, value, lit], n) => {
      const y = y0 + 2 + n * pitch;
      if (n % 2 === 0) { ctx.fillStyle = '#241f38'; ctx.fillRect(px + 4, y - 1, pw - 8, pitch); }
      text(ctx, name, px + 8, y, '#bcb4cc');
      text(ctx, value, px + pw - 8, y, lit === undefined ? '#ffffff' : lit ? '#8cf2c4' : '#8a84a0', 1);
    });
  }
  // Where the lab's notes lie on the screen, worked out from the screen's size and how far the panel has risen, as
  // they are drawn, so that a touch is read against the lines it falls on: the panel (px, py, pw, ph), the window
  // the list is seen through (vx, vy, vw, view), and how far it can be scrolled (`most`). One object, filled again.
  labGeom() {
    const g = this.labG ??= { px: 0, py: 0, pw: 0, ph: 0, vx: 0, vy: 0, vw: 0, view: 0, most: 0 }, { W, H } = this, rise = 1 - this.labRise;
    g.pw = Math.min(W - 8, 200); g.px = Math.round((W - g.pw) / 2);
    g.view = Math.min(LAB_LIST.content, Math.max(3 * LAB_RH, H - 48 - LAB_HEAD - LAB_NOTE - 4));
    g.ph = LAB_HEAD + g.view + LAB_NOTE + 4;
    g.py = Math.max(2, Math.round((H - 44 - g.ph) / 2)) + Math.round(rise * rise * 60);
    g.vx = g.px + 4; g.vy = g.py + LAB_HEAD; g.vw = g.pw - 8;
    g.most = LAB_LIST.content - g.view;
    return g;
  }
  // The head of a part of the lab's list, at (x, y) and `w` wide, over whatever lies under it: its icon, its title
  // in its gems' colour and how many of it are known (`known`, by part).
  labHead(line, x, y, w, known) {
    const { ctx } = this, { title, icon, colour } = LAB_PARTS[line.part], f = sheets.icons.frames[icon];
    ctx.fillStyle = '#1c1a28'; ctx.fillRect(x, y, w, LAB_SEC);
    ctx.drawImage(sheets.icons.image, f[0], f[1], f[2], f[3], x + 2, y + 1, f[2], f[3]);
    text(ctx, title, x + 16, y + 1, colour);
    text(ctx, `${known[line.part]}/${line.total}`, x + w - 5, y + 1, '#8a84a0', 1);
    ctx.fillStyle = '#4a4468'; ctx.fillRect(x + 2, y + LAB_SEC - 1, w - 8, 1);
  }
  // The panel the bar opens: STATS, the lab's notes (LAB), the chart (MAP) and MENU. The lab's notes are everything
  // the lab can know, in parts by where it lies, a line each: what is analysed with its picture and its worth, what is not with
  // where it is found. The list scrolls (dragged, flicked, wheeled or stepped with the keys: js/game.js), clipped to
  // its window, the head of the part at the top held there until the next pushes it up; a bar at its edge says how
  // far down it is and marks the line chosen, and under it the lab says what it knows of the line chosen.
  drawLab() {
    const { ctx, W, H, S } = this, HEAD = LAB_HEAD;
    ctx.globalAlpha = 0.6 * this.labRise; ctx.fillStyle = '#07060b'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    if (this.labTab === 'chart' && !this.charted) this.labTab = 'stats';
    const g = this.labGeom(), { pw, px } = g;
    const chart = Math.min(pw - 12, H - 52 - HEAD - 10);
    const rise = 1 - this.labRise, ph = this.labTab === 'menu' ? HEAD + 104 + (this.langOpen ? LANG_ROWS : 0) + (this.stalls.length ? 14 + this.stalls.length * 10 : 0) : this.labTab === 'chart' ? HEAD + chart + 10 : this.labTab === 'stats' ? HEAD + this.stats().length * this.statsPitch(this.stats().length) + 8 : g.ph;
    const py = this.labTab === 'lab' ? g.py : Math.max(2, Math.round((H - 44 - ph) / 2)) + Math.round(rise * rise * 60);
    slice9(ctx, 'ui', 'panel', px, py, pw, ph);
    this.button(px, py, pw, ph, () => {});
    this.buttons.at(-1).swallow = true;
    this.chartRect = null;
    this.panelTabs(px, py, pw);
    if (this.labTab === 'stats') { this.drawStats(px, py + HEAD, pw); return; }
    if (this.labTab === 'menu') { this.drawMenu(px, py + HEAD, pw); if (this.stalls.length) this.drawStalls(px, py + HEAD + 102 + (this.langOpen ? LANG_ROWS : 0), pw); return; }
    if (this.labTab === 'chart') {
      // The chart is dragged to look about it and pinched (or wheeled, or stepped by its two buttons) to look closer:
      // from the whole reach down to four pixels a cell, never past the edge of the whole reach's own view.
      const cx0 = Math.round(px + (pw - chart) / 2), cy0 = py + HEAD + 3;
      this.chartRect = [cx0, cy0, chart, chart]; this.chartBase = Math.max(0.3, this.val('tether') * 2.25 / chart);
      const view = this.chartView();
      this.drawMap(cx0, cy0, { size: chart, per: this.chartBase / view.zoom, cx: view.x, cy: view.y });
      [['+', 1.5], ['-', 1 / 1.5]].forEach(([sign, by], n) => {
        const bx = cx0 + chart - 16, by0 = cy0 + chart - 32 + n * 16, can = by > 1 ? view.zoom < this.chartMost() - 1e-9 : view.zoom > 1 + 1e-9;
        slice9(ctx, 'ui', can ? 'button' : 'button-off', bx, by0, 14, 14);
        text(ctx, sign, bx + 7, by0 + 2, can ? '#ffffff' : '#6a6478', 0.5);
        this.buttons.unshift({ x: bx - 1, y: by0 - 1, w: 16, h: 16, act: () => { this.chartZoom(by, cx0 + chart / 2, cy0 + chart / 2); sfx.tap(); } });
      });
      if (view.zoom > 1.01) text(ctx, `x${view.zoom.toFixed(1)}`, cx0 + 3, cy0 + chart - 12, '#f4ecd8');
      return;
    }
    const sel = LAB_OF[this.labSel] ?? LAB[0], chosen = LAB.indexOf(sel), { vx, vy, vw, view, most } = g;
    this.labScroll = Math.max(0, Math.min(most, this.labScroll));
    const top = Math.round(this.labScroll), RIGHT = vx + vw - 5;
    // How many of each part are known, counted once a frame with no list made.
    const known = this.labKnown ??= LAB_PARTS.map(() => 0), worthNow = WORTH_AT[Math.min(WORTH_AT.length - 1, S.lv.winch)];
    known.fill(0);
    for (const e of LAB) if (S.lab[e.key]) known[PART_INDEX[e.part]]++;
    ctx.save(); ctx.beginPath(); ctx.rect(vx, vy, vw, view); ctx.clip();
    for (const line of LAB_LIST.lines) {
      if (line.y + line.h <= top) continue;
      if (line.y >= top + view) break;
      const y = vy + line.y - top;
      if (!line.entry) { this.labHead(line, vx, y, vw, known); continue; }
      const e = line.entry, n = S.lab[e.key] ?? 0, on = line.i === chosen;
      if (on) { ctx.fillStyle = '#3a3260'; ctx.fillRect(vx, y, vw - 4, LAB_RH - 1); }
      // (What it is worth shows in the rim of its chip, known or not: none, silver or gold by its tier, with the
      // winch as it is; js/worth.js. The rim is laid over the picture, so no picture hides it.)
      const rim = TIER_RIM[worthNow[e.key]?.tier ?? 1];
      if (n) {
        // (Each picture on a chip a little lighter than the panel: a dark stone, drawn to be seen on its own pale
        // rock, would be lost on the panel's dark.)
        chip(ctx, vx + 2, y, null, on ? '#6e6896' : '#5a5674');
        const f = sheets[line.sheet].frames[line.frame];
        ctx.drawImage(sheets[line.sheet].image, f[0] + 2, f[1] + 2, 12, 12, vx + 2, y, 12, 12);
        if (rim) ring(ctx, vx + 2, y, rim);
        text(ctx, e.name, vx + 18, y + 2, on ? '#ffe14a' : '#ffffff');
        text(ctx, `+${labLevel(this.learnt(e.key))}%`, RIGHT, y + 2, '#8cf2c4', 1);
      } else {
        // (What is not yet known says where it is found.)
        if (rim) { chip(ctx, vx + 2, y, null, '#1c1a28'); ring(ctx, vx + 2, y, rim); }
        text(ctx, '?', vx + 6, y + 2, on ? '#bcb4cc' : '#6a6478');
        text(ctx, line.label, vx + 18, y + 2, on ? '#bcb4cc' : '#6a6478');
      }
    }
    // The head of the part at the top of the window stays there, and the next one pushes it up as it comes.
    let held = null, next = Infinity;
    for (const line of LAB_LIST.lines) if (!line.entry) { if (line.y <= top) held = line; else { next = line.y; break; } }
    if (held && held.y < top) this.labHead(held, vx, vy + Math.min(0, next - top - LAB_SEC), vw, known);
    // A fade at either edge while there is more beyond it (at the top, under the head held there).
    ctx.fillStyle = '#1c1a28';
    for (let r = 0; r < 4; r++) {
      ctx.globalAlpha = 0.8 - r * 0.2;
      if (top < most) ctx.fillRect(vx, vy + view - 1 - r, vw - 4, 1);
      if (top > 0) ctx.fillRect(vx, vy + LAB_SEC + r, vw - 4, 1);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // The bar at the window's right edge: where the window is in the list, and a mark where the line chosen lies.
    if (most > 0) {
      const thumb = Math.max(8, Math.round(view * view / LAB_LIST.content)), ty = vy + Math.round((view - thumb) * top / most);
      ctx.fillStyle = '#2a2838'; ctx.fillRect(vx + vw - 2, vy, 2, view);
      ctx.fillStyle = '#6a6488'; ctx.fillRect(vx + vw - 2, ty, 2, thumb);
      ctx.fillStyle = '#ffe14a'; ctx.fillRect(vx + vw - 3, vy + Math.round((LAB_LIST.at[chosen] + LAB_RH / 2) * (view - 1) / LAB_LIST.content), 3, 1);
    }
    // What the lab says of the line chosen (its note wrapped once for the width it is drawn at, not every frame).
    const ny = vy + view + 3, n = S.lab[sel.key] ?? 0, wide = pw - 16, said = n ? sel.note : LAB_LIST.line[chosen].found;
    const w = this.labWrap ??= { said: '', wide: 0, lines: [] };
    if (w.said !== said || w.wide !== wide) { w.said = said; w.wide = wide; w.lines = wrap(said, wide).slice(0, NOTE_LINES); }
    ctx.fillStyle = '#4a4468'; ctx.fillRect(px + 6, ny - 2, pw - 12, 1);
    if (n) text(ctx, labCount(this.learnt(sel.key)), px + 8, ny + 1, '#bfe6ff');
    else text(ctx, 'NOT ANALYSED YET', px + 8, ny + 1, '#bcb4cc');
    // (What it is worth, against plain rock out where it lies, known or not.)
    const worth = worthNow[sel.key];
    if (worth) text(ctx, worth.said, px + 8, ny + 11, '#ffe14a');
    for (let l = 0; l < w.lines.length; l++) text(ctx, w.lines[l], px + 8, ny + 22 + l * 10, n ? '#d8d0c0' : '#9a94a8');
  }
  // The shop's picture of level `next` of row `u`, in the 16 x 16 at (vx, vy), as it will look and move: the reach's
  // span with light running along it, the bit spinning and hot, the ram's flame behind the tail, the plates with a
  // glint across them, the core turning with its lights, the dish with its ping, what WORKS fits lit by turns, the
  // map's icon swept, and what CORE builds as it will stand on the station.
  drawPreview(ctx, u, next, vx, vy) {
    const S = this.S, now = this.time * 1000, t = this.time, F = sheets.drill.frames, image = sheets.drill.image, P = PREVIEW;
    P.heat = 0; P.flame = 0; P.tintAlpha = 0; P.lit = 0; P.spin = 0;
    if (u.id === 'tether') {
      const style = TETHERS[next];
      if (style.thick) this.drawSpan(vx + 1, vy + 13, vx + 14, vy + 4, style);
      this.drawSpan(vx + 1, vy + 12, vx + 14, vy + 3, style);
      if (style.glow) { const k = (t % 0.8) / 0.8; ctx.fillStyle = style.glow; ctx.fillRect(Math.round(vx + 1 + 12 * k), Math.round(vy + 11 - 9 * k), 2, 2); }
    } else if (u.id === 'drill') {
      if (next >= 3) P.heat = 0.5 + 0.4 * Math.sin(t * 8);
      this.drawDrill(vx + 8, vy + 8, 0, next, S.lv.momentum, now, 1, 1, ctx, S.lv.hull, null, P);
      if (next >= 2) { ctx.fillStyle = '#fff2a0'; ctx.fillRect(vx + 15, vy + 6 + ((t * 18) | 0) % 4, 1, 1); }
    } else if (u.id === 'momentum') {
      const ram = Math.min(6, next);
      if (ram >= 3) {
        // (The tail alone, with its flame behind it: the flame's last ten pixels, and the six of the drill's tail.)
        const f = frameAt('drill', FLAME[FLAME_TIER[ram]], now), r = F[RAM[ram]], b = F[BODY_A[Math.min(7, S.lv.drill)]];
        ctx.drawImage(image, f[0] + 6, f[1], 10, 16, vx, vy, 10, 16);
        ctx.drawImage(image, r[0], r[1], 6, 16, vx + 10, vy, 6, 16);
        ctx.drawImage(image, b[0], b[1], 6, 16, vx + 10, vy, 6, 16);
      } else this.drawDrill(vx + 8, vy + 8, 0, S.lv.drill, next, -1);
    } else if (u.id === 'hull') {
      this.drawDrill(vx + 8, vy + 8, 0, S.lv.drill, S.lv.momentum, -1, 1, 1, ctx, next);
      ctx.globalAlpha = 0.55; ctx.fillStyle = '#ffffff'; ctx.fillRect(vx + 2 + Math.floor((t % 1.2) / 1.2 * 12), vy + 4, 1, 8); ctx.globalAlpha = 1;
    } else if (u.id === 'winch') {
      drawScaled(ctx, 'core', frameAt('core', CORE_IDLE[next], now), vx, vy, 16, 16);
      ctx.fillStyle = '#c8f4ff';
      for (let k = 0; k < ORBIT[next]; k++) { const a = t * 0.8 + k * 6.2832 / ORBIT[next]; ctx.fillRect(Math.round(vx + 7.5 + Math.cos(a) * 7.5), Math.round(vy + 7.5 + Math.sin(a) * 7.5), 1, 1); }
    } else if (u.id === 'scanner') {
      draw(ctx, 'dish', frameAt('dish', DISH[next], now), vx, vy);
      const k = (t % 1.5) / 1.5, rad = 1 + k * 7, n = 12;
      ctx.globalAlpha = 1 - k; ctx.fillStyle = '#5fe0d0';
      for (let a = 0; a < n; a++) ctx.fillRect(Math.round(vx + 8 + Math.cos(a / n * 6.283) * rad), Math.round(vy + 3 + Math.sin(a / n * 6.283) * rad), 1, 1);
      ctx.globalAlpha = 1;
    } else if (u.kin !== undefined && u.spec) {
      P.lit = ((t * 2) | 0) % 2 ? FIT_BIT[u.id] : 0;
      this.drawDrill(vx + 8, vy + 8, 0, S.lv.drill, S.lv.momentum, -1, 1, 1, ctx, S.lv.hull, u.id, P);
    } else if (MAPS.includes(u)) {
      draw(ctx, 'upgrades', u.icon, vx + 2, vy + 2);
      ctx.globalAlpha = 0.6; ctx.fillStyle = '#5cc4f0'; ctx.fillRect(vx + 2, vy + 2 + Math.floor((t % 1.2) / 1.2 * 12), 12, 1); ctx.globalAlpha = 1;
    } else if (u.id === 'lamp') {
      P.lit = FIT_BIT.lamp;
      this.drawDrill(vx + 6, vy + 8, 0, S.lv.drill, 0, -1, 1, 1, ctx, 0, 'lamp', P);
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 3); ctx.fillStyle = '#ffe0a0'; ctx.fillRect(vx + 13, vy + 7, 3, 1); ctx.fillRect(vx + 14, vy + 6, 1, 3); ctx.globalAlpha = 1;
    } else if (PART_CROP[u.id] && sheets.station) {
      const [cx, cy] = PART_CROP[u.id], name = u.id === 'refinery' ? REFINERY[next] : u.id === 'cutter' ? (next >= 6 ? null : CUTTER[next]) : BOX[next]?.[((t / BEACON[next]) % 1) < 0.15 ? 1 : 0];
      const r = name ? sheets.station.frames[name] : frameAt('station', 'cutter-6', now);
      if (r) ctx.drawImage(sheets.station.image, r[0] + cx, r[1] + cy, 16, 16, vx, vy, 16, 16);
      if (u.id === 'refinery' && ((t * 3) | 0) % 3 === 0) { ctx.fillStyle = '#ffd84a'; ctx.fillRect(vx + 6, vy + 2, 1, 1); }
    } else if (STATION_PARTS[u.id] && sheets.station) {
      // (The live catch's clamp and the trophy line's rack, as they will stand on the station: js/fit.js.)
      const part = STATION_PARTS[u.id], r = sheets.station.frames[part.frames[next]];
      if (r) ctx.drawImage(sheets.station.image, r[0] + part.crop[0], r[1] + part.crop[1], 16, 16, vx, vy, 16, 16);
    } else if (u.pic) draw(ctx, 'icons', u.pic, vx + 3, vy + 3);
    else { draw(ctx, 'upgrades', u.icon, vx + 2, vy + 2); text(ctx, `${u.values[next]}`, vx + 15, vy + 7, '#ffffff', 1); }
  }
  drawShop() {
    const { ctx, W, H, S } = this, goal = this.saving();
    ctx.globalAlpha = 0.6 * this.shopRise; ctx.fillStyle = '#07060b'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    // (The panel is as tall as its longest tab, so it does not jump when the tab is changed: its header, its rows
    // and the footer where a refused tap is said. A row is as tall as the screen allows up to SHOP_RH, which every
    // screen the game is played on allows.)
    const tab = TABS.find(t => t.id === this.shopTab) ?? TABS[0];
    const pw = Math.min(W - 2 * UI.EDGE, 200), px = Math.round((W - pw) / 2), rh = Math.max(24, Math.min(SHOP_RH, Math.floor((H - 92) / SHOP_MOST)));
    const rise = 1 - this.shopRise, ph = UI.HEAD + rh * SHOP_MOST + SHOP_FOOT, py = Math.max(UI.EDGE, Math.round((H - 44 - ph) / 2)) + Math.round(rise * rise * 60);
    slice9(ctx, 'ui', 'panel', px, py, pw, ph);
    this.button(px, py, pw, ph, () => {});
    // The tabs: the one that is open in yellow, and a dot on one that has something to buy.
    this.headAt(px, py, pw);
    for (const t of TABS) this.headTab(t.name, t === tab, t.rows.some(u => this.canBuy(u)), () => { this.shopTab = t.id; sfx.tap(); });
    this.headClose(() => { this.shop = false; sfx.tap(); });
    // The rows' columns: each row a box UI.INSET in from the panel's, its words and figures UI.INSET in from that
    // (`left` to `edge`, the last column a shadow may fall on); the picture at the left, its name UI.GAP after it.
    // Its lines: a Latin row tall enough has three, evenly spaced (`p`), its first and last a row clear of the
    // box's rim; Mandarin, whose characters fill their whole cell, has two, a row further in, and says NEEDS in
    // place of what the thing does, and leaves out where gems are had where the price is on its second line (the
    // footer says it on a tap).
    const left = px + 2 * UI.INSET, edge = px + pw - 2 * UI.INSET, nx = left + 16 + UI.GAP, lead = spaced ? 0 : 1;
    const p = (rh - 14) >> 1, tall = rh >= 30 && spaced, mid = y => y + 2 + p, bottom = y => y + rh - 12 - lead;
    // (Whether NEEDS is said is one answer for every row on this screen: `needsSaid`.)
    const needs = this.needsSaid(edge - nx), rows = this.shopRows ??= Array.from({ length: SHOP_MOST }, () => ({ y: 0, top: 0, vx: 0, vy: 0, sx: 0, c: null, steps: '', lack: null, wide: false }));
    // Each row's words first, to know whether any row of the tab has a third line: where none has, what the
    // others say is on their last line and not their middle one, so that no row is heavy at its head.
    let third = false;
    for (let n = 0; n < tab.rows.length; n++) {
      const u = tab.rows[n], r = rows[n], l = S.lv[u.id], c = this.cost(u);
      r.y = py + UI.HEAD + n * rh; r.top = r.y + 2 + lead; r.vx = left; r.vy = r.y + ((rh - 16) >> 1); r.sx = nx + textWidth(u.name) + 6; r.c = c;
      // (A thing fitted once has no levels to show: it is FITTED or it is not. Where the two values are too wide
      // for the line, a word they share is said once, and failing that the next is said alone: `fewer`.)
      let steps = u.values.length === 2 ? (c ? '' : 'FITTED') : c ? `${u.show(u.values[l])}>${u.show(u.values[l + 1])}` : `${u.show(u.values[l])} MAX`;
      if (r.sx + textWidth(steps) > edge) steps = c ? fewer(u.show(u.values[l]), u.show(u.values[l + 1]), edge - r.sx) : u.show(u.values[l]);
      r.steps = steps;
      // What must be found first, and no price shown until it has been.
      const q = c ? this.need(u) : null;
      r.lack = q && q.have < q.need ? needs ? `NEEDS ${q.have}/${q.need} ${NEEDS[q.what]}` : `${q.have}/${q.need} ${NEEDS[q.what]}` : null;
      // The price: right to left from the edge, each figure UI.GAP before its icon and each group UI.GROUP clear
      // of the next; on the second line where it would come within UI.WORD of the steps.
      r.wide = false;
      if (c && !r.lack) {
        const costs = textWidth(price(c.grit)) + (c.gems > 0 ? SHOP_GROUP + textWidth(price(c.gems)) : 0) + (c.spec ? SHOP_GROUP + textWidth(`${this.specs(u.kin)}/${c.spec}`) : 0);
        r.wide = r.sx + textWidth(steps) + UI.WORD > edge - 9 - UI.GAP - costs;
      }
      if (r.lack || r.wide) third = true;
    }
    // (What a row says goes on its middle line where any row has three, and else on its last.)
    const says = y => tall && third ? mid(y) : bottom(y);
    for (let n = 0; n < tab.rows.length; n++) {
      const u = tab.rows[n], r = rows[n], { y, c, top } = r, can = this.canBuy(u), lit = this.bought?.id === u.id, l = S.lv[u.id];
      slice9(ctx, 'ui', lit ? 'button-down' : !c ? 'button-max' : can ? 'button' : 'button-off', px + UI.INSET, y, pw - 2 * UI.INSET, rh - 1);
      // What it will look like once bought (or does now, at its last level), moving as it will.
      ctx.fillStyle = '#0c0a12'; ctx.fillRect(r.vx, r.vy, 16, 16);
      this.drawPreview(ctx, u, Math.min(l + 1, u.values.length - 1), r.vx, r.vy);
      // What it is, what it does, and what the next level changes. (Where a level has just been bought, the new
      // value is stamped in its place for a moment: js/fit.js, `panel`.)
      text(ctx, u.name, nx, top, '#ffffff');
      // (The row saved for, `goal`, has a pin after its name, at the middle of its capitals.)
      if (goal.id === u.id) { ctx.fillStyle = '#ffe14a'; ctx.fillRect(r.sx - 4, top + 3, 2, 2); }
      if (!this.fitter.stamps(tab.id, u.id)) text(ctx, r.steps, r.sx, top, c ? '#bfe6ff' : '#ffe14a');
      // What the next level changes, where the row says (`says`), and what the thing does where it does not or
      // there is no next level. (The reach's row says so where its price is cut for ground that is spent.)
      const spent = u.id === 'tether' && c && this.groundLeft() < 1, what = spent ? 'GROUND SPENT: CHEAPER' : c ? u.says?.(l) ?? u.what : u.what;
      if (r.lack) { if (tall) text(ctx, what, nx, mid(y), '#c8c2d4'); text(ctx, r.lack, nx, bottom(y), '#ff9a6a'); }
      else if (c) {
        // The cost is lit by what has come home (`banked`), as the purchase itself is judged: never shown as
        // enough while the tap would be refused. Each icon at its figure's height (UI.ICON_DY), the grit's ink
        // ending on the column the words end on.
        const cy = r.wide ? bottom(y) : top, grit = price(c.grit);
        let cx = edge - 9, last = grit;
        draw(ctx, 'icons', 'grit', cx, cy + UI.ICON_DY);
        text(ctx, grit, cx - UI.GAP, cy, this.banked() >= c.grit ? '#ffe14a' : '#ff7a5a', 1);
        if (c.gems > 0) {
          cx -= textWidth(last) + SHOP_GROUP; last = price(c.gems);
          draw(ctx, 'icons', GEM_ICON[c.gem], cx, cy + UI.ICON_DY);
          text(ctx, last, cx - UI.GAP, cy, this.banked(c.gem) >= c.gems ? GEM_COLOR[c.gem] : '#ff7a5a', 1);
        }
        // Specimens: how many are in hand of how many are asked, with the direction's own stone.
        if (c.spec) {
          const have = this.specs(u.kin);
          cx -= textWidth(last) + SHOP_GROUP;
          draw(ctx, 'icons', `spec-${GEM_ICON[u.kin]}`, cx, cy + UI.ICON_DY);
          text(ctx, `${have}/${c.spec}`, cx - UI.GAP, cy, have >= c.spec ? GEM_COLOR[u.kin] : '#ff7a5a', 1);
        }
        // (Where gems are short, where they are had: a corner's said short where the whole will not fit the line.)
        const short = c.gems > 0 && this.banked(c.gem) < c.gems;
        let where = short ? `${GEM_WHERE[c.gem]}, PAST ${GEM_PAST[c.gem]}` : what;
        if (short && GEM_SHORT[c.gem] && nx + textWidth(where) > edge) where = `${GEM_SHORT[c.gem]}, PAST ${GEM_PAST[c.gem]}`;
        if (!r.wide || tall) text(ctx, where, nx, r.wide ? mid(y) : says(y), short ? GEM_COLOR[c.gem] : spent ? '#8ce060' : '#c8c2d4');
      } else text(ctx, u.what, nx, says(y), '#e8c070');
      this.buttons.unshift({ x: px + UI.INSET, y, w: pw - 2 * UI.INSET, h: rh - 1, act: () => this.buy(u) });
    }
    // The moment of a purchase, over the rows (js/fit.js), on the row bought as it was just laid out.
    this.fitter.panel(this, ctx, px, py, pw, ph, tab, rows, edge, UI);
    // Why a tap was refused is said in the footer, a row under its middle as a capital's ink is a row under its
    // cell's top: the header is the tabs'. (A new world is in the menu.)
    const note = this.shopNote && this.shopNote.t > 0 ? this.shopNote : null;
    if (note) note.t -= 1 / 60;
    // (A corner's gems said short where the whole will not fit: js/game.js, `buy`.)
    if (note) text(ctx, note.short && textWidth(note.text) > pw - 2 * UI.INSET ? note.short : note.text, px + pw / 2, py + ph - SHOP_FOOT + 1, note.color, 0.5);
  }
  // Whether the shop's rows say NEEDS before what is still to be found, the same in every row: where the longest
  // that could ever be said fits `room` (each figure at its most and in the widest digit). Worked out once a
  // screen's width, and kept.
  needsSaid(room) {
    const f = this.needsFit ??= { room: -1, said: false };
    if (f.room === room) return f.said;
    const digit = [...'0123456789'].reduce((a, b) => textWidth(b) > textWidth(a) ? b : a);
    let most = 0;
    for (const u of ROWS) if (u.needs) for (const asked of u.needs[1]) {
      const [what, count] = Array.isArray(asked) ? asked : [u.needs[0], asked];
      if (!count) continue;
      const n = String(count).replace(/\d/g, digit);
      most = Math.max(most, textWidth(`NEEDS ${n}/${n} ${NEEDS[what]}`));
    }
    f.room = room; f.said = most <= room;
    return f.said;
  }
}
