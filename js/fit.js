// Tetherbore: what the upgrades show. Every level of the rig is drawn on the drill, the tether or the station, and
// this is what makes the rest of it seen: the bit glowing and throwing sparks as it bites, the ram's flame and
// exhaust at speed, light running along the tether, lights circling the station, the dish's beam, what WORKS fits
// lighting up as it acts, what CORE builds standing on the station, and the moment of buying: the row lit in the
// shop at once, and the part fitted at the core, with a ring and its name, once the shop is shut.
//
// Nothing in the game asks it anything. It reads the game and draws; it writes none of the game's own state (its
// particles, rings, effects, popups, flash, shake, pause, notice or banner, the drill's heading) and lights nothing
// in the light map: what it shows glowing is laid over the dark. Its generator is its own and it never draws from
// the game's, so the game that has it is the game that has not. Its sparks, exhaust and smoke are a pool of its
// own, made once and never grown, and nothing it does in a frame makes an object: its tables of frames and
// colours are made here at load, and the tinted copies of the sheets it lays over the drill and the station are
// made one a frame over a game's first frames (`warm`).
import { UPGRADES, WORKS, MAPS, CORE, TABS } from './shop.js';
import { sheets, draw, frameAt, duration, tinted, text, textWidth } from './atlas.js';
import { sfx } from './audio.js';
import { tr } from './lang.js';
import { N, C, K } from './world.js';

// (Figures of the game's own, kept here so that nothing of js/game.js or js/drawing.js need be imported: pixels in
// a cell, the middle of the core in cells, and the cells only the diamond tip cuts at its own pace, METALS.)
const T = 16, HX = C + 0.5, HY = C + 0.5;
const METALS = [K.STEEL, K.KEY];
// (And the gems' colours, as js/drawing.js has them: test/regress/e-corner-gems.mjs holds the two the same.)
export const GEM_COLOR = [null, '#bfe6ff', '#ffb060', '#b8f06a', '#d8b8ff', '#5a8cff', '#f2346c', '#aaa6bc', '#2ed060'];

// ---------------------------------------------------------------- how the tether looks
// At each level of reach a tether of its own, and named so (js/shop.js: `tiers`): TWINE; HEMP, a twisted rope;
// KNOTTED, hemp with a knot every so far; PARACORD, a tight orange weave; STEEL WIRE, fine and twisted; CHAIN, dark
// with bright links on it; GOLD CABLE; FIBRE, a fine blue line that light races down; PLASMA, a cyan cable in a glow
// of its own; and STARLINE, violet, in a glow, strung with stars. `a` is the rope, `b` the second strand of its braid
// in lengths `dash` of each turn, a turn `turn` times the usual and the strand `links` times the rope's width with
// round ends where it is a chain's; `fine` a thinner rope, `thick` a thicker; `knot`, a knot of that colour every
// `every` pixels along it; `halo`, a glow about the tether over the dark. From GOLD CABLE, light runs out along it from
// the core to the drill, as power fed down the cable: a dash of `glow` every `gap` pixels, `run` pixels a second (and
// at the last, a white dash between each two). `dashes` is the pattern, made once.
export const TETHERS = [
  { a: '#e8dcc0', b: '#e8dcc0', dash: 1 },
  { a: '#d8c49a', b: '#8a6a3e', dash: 0.5 },
  { a: '#e0cc9c', b: '#a8844e', dash: 0.5, knot: '#6a4a26', every: 9 },
  { a: '#ffa060', b: '#c8342a', dash: 0.5, turn: 0.5 },
  { a: '#eef2fa', b: '#5a6884', dash: 0.3, turn: 0.4, fine: true },
  { a: '#3a4058', b: '#d0d8e4', dash: 0.4, turn: 1.5, links: 1.1, thick: true },
  { a: '#ffe89a', b: '#c89020', dash: 0.25, thick: true, glow: '#fff4c0', gap: 60, run: 50 },
  { a: '#4a80d0', b: '#a8d8ff', dash: 0.2, fine: true, glow: '#ffffff', gap: 22, run: 150, halo: '#5cc4f0' },
  { a: '#a8fff0', b: '#30c8c0', dash: 0.5, thick: true, glow: '#d8fff8', gap: 36, run: 90, halo: '#5fe0d0' },
  { a: '#ffc8f4', b: '#b050d0', dash: 0.5, thick: true, glow: '#ffd8f8', gap: 28, run: 120, twin: '#ffffff', halo: '#c070ff', knot: '#ffffff', every: 14 },
];
for (const t of TETHERS) if (t.glow) t.dashes = [3, t.gap];

// ---------------------------------------------------------------- the names of frames, made once
// The drill's body, bit hot, ram, plates and flame at each level; the core and the dish at each level; and what
// is fitted to the drill, plain and lit, at each level of its row.
export const BODY = [], BODY_A = [], HOT = [], HOT_A = [], RAM = [], PLATE = [], FLAME = [null, 'flame-1', 'flame-2', 'flame-3', 'flame-4'];
for (let b = 0; b <= 7; b++) { BODY[b] = `right-${b}`; BODY_A[b] = `right-a-${b}`; HOT[b] = b >= 3 ? `hot-${b}` : null; HOT_A[b] = b >= 3 ? `right-h-a-${b}` : null; PLATE[b] = b ? `plate-right-${b}` : null; }
for (let r = 0; r <= 6; r++) RAM[r] = r ? `ram-right-${r}` : null;
export const CORE_IDLE = [], CORE_A = [], CORE_C = [], CORE_FLASH = [], DISH = [];
for (let l = 0; l <= 8; l++) { CORE_IDLE[l] = `idle-${l}`; CORE_A[l] = `core-a-${l}`; CORE_C[l] = `core-c-${l}`; CORE_FLASH[l] = `core-flash-${l}`; }
for (let l = 0; l <= 6; l++) DISH[l] = `dish-${l}`;
// Which flame each level of the ram burns (none before its thruster), and the bit's point, in the drill's own
// pixels from its middle (a pixel further on the longer cone from the sixth bit).
export const FLAME_TIER = [0, 0, 0, 1, 2, 3, 4];
const TIP = [7, 7, 7, 7, 7, 8, 8, 8];
// What shows on the drill, by row: its bit in `look.lit` (what is lit this frame) and its frames at each level of
// the row, plain and lit. The diamond tip has its own on the longer cone; the mender is a picture a level, and so
// is each fitting's second level (the lava skin's bellows, the spore drive's graft, the arc coil's capacitor); the
// black box and the lamp are CORE's, shown on the drill. The flywheel's wheel has a picture a level, and its lit
// one is its spokes a step round: lit by turns, as fast as its run of hauls (`wheel`), it spins.
const levels = (n, plain, lit) => Array.from({ length: n + 1 }, (_, l) => l ? [plain(l), lit(l)] : null);
const second = id => levels(2, l => l > 1 ? `fit-${id}-${l}` : `fit-${id}`, l => l > 1 ? `fit-${id}-${l}-b` : `fit-${id}-b`);
export const FITS = [
  { id: 'mender', bit: 1, frames: levels(5, l => `fit-mender-${l}`, l => `fit-mender-${l}-b`) },
  { id: 'lavaskin', bit: 2, frames: second('lavaskin') },
  { id: 'sporedrive', bit: 4, frames: second('sporedrive') },
  { id: 'arccoil', bit: 8, frames: second('arccoil') },
  { id: 'diamond', bit: 16, frames: levels(1, () => 'fit-diamond', () => 'fit-diamond-b'), long: levels(1, () => 'fit-diamond-l', () => 'fit-diamond-l-b') },
  { id: 'blackbox', bit: 32, frames: levels(4, () => 'fit-blackbox', () => 'fit-blackbox-b') },
  { id: 'lamp', bit: 64, frames: levels(5, l => `fit-lamp-${l}`, l => `fit-lamp-${l}`) },
  { id: 'flywheel', bit: 128, frames: levels(2, l => `fit-flywheel-${l}`, l => `fit-flywheel-${l}-b`) },
];
// (What WORKS and CORE fit lights for so many seconds, in a typed array by these places.)
export const FIT_BIT = Object.fromEntries(FITS.map(f => [f.id, f.bit]));
const MENDER = 0, LAVASKIN = 1, SPOREDRIVE = 2, ARCCOIL = 3, DIAMOND = 4, BLACKBOX = 5, LAMP = 6, FLYWHEEL = 7, LIT_BIT = FITS.map(f => f.bit);
// What CORE builds on the station, a picture a level (js/sprites.mjs: `station`), and where on that sheet each
// part's middle is, for what flies to it and the light it gives.
export const REFINERY = levels(7, l => `refinery-${l}`, l => `refinery-${l}`).map(f => f && f[0]);
export const CUTTER = levels(6, l => l === 6 ? null : `cutter-${l}`, l => l).map(f => f && f[0]);
export const BOX = levels(4, l => `blackbox-${l}`, l => `blackbox-${l}-b`);
// The live catch's clamp at the middle of the right edge, a jaw more a level, and the trophy line's rack under the
// core, more barbs a level (each third level the late game's); and where their lamps are, as the black box's.
export const LIVECATCH = levels(3, l => `livecatch-${l}`, l => l).map(f => f && f[0]);
export const TROPHY = levels(3, l => `trophy-${l}`, l => l).map(f => f && f[0]);
const REFINERY_MOUTHS = [[], [6, 5], [6, 5], [6, 5, 11, 2], [6, 5, 11, 2], [6, 5, 11, 2], [6, 5, 11, 2, 2, 9], [6, 5, 11, 2, 2, 9]];
const BOX_LAMPS = [[], [8, 55], [8, 55, 5, 47], [8, 55], [8, 55, 5, 54, 4, 46]];
const CLAMP_LAMPS = [[], [62, 26], [62, 26, 62, 37], [62, 26, 62, 37, 62, 32]];
const RACK_LAMPS = [[], [21, 62, 42, 62], [19, 62, 24, 62, 39, 62, 44, 62], [18, 62, 22, 62, 26, 62, 37, 62, 41, 62, 45, 62, 32, 61]];
const PART_AT = { refinery: [9, 10], cutter: [54, 54], blackbox: [7, 55], winch: [32, 32], scanner: [50, 3], livecatch: [59, 32], trophy: [32, 58] };
// What the shop shows of a part of the station that is not the refinery, the cutter or the black box (js/drawing.js:
// `drawPreview`): the 16 x 16 of its sheet's frame from `crop`, at each level.
export const STATION_PARTS = { livecatch: { crop: [48, 24], frames: LIVECATCH }, trophy: { crop: [14, 48], frames: TROPHY } };

// ---------------------------------------------------------------- figures
export const CAP = 96, PANEL_CAP = 24, RINGS = 8, QUEUE = 6;
// (A fitting begins every GAP seconds and lasts LIFE, a show GRAND_LIFE; its part is seated SEAT seconds in. The
// shop's moment lasts MOMENT, its new value stamped in twice the size for the first STAMP.)
const GAP = 0.35, LIFE = 0.9, GRAND_LIFE = 1.6, SEAT = 0.25, MOMENT = 0.6, STAMP = 0.07, EFFECTS = 3, LABELS = 3;
// The bit: how hot it goes cutting hard ground, by level (only from gold on), how many sparks a second it throws
// off its point cutting anything, in what colours, and the colour its shimmer rises in.
const HEAT = [0, 0, 0, 0.25, 0.3, 0.45, 0.6, 0.7];
const SPARK_RATE = [0, 0, 4, 8, 10, 12, 16, 20];
const SPARK_COLOURS = [null, null, ['#bfe4ff', '#ffffff'], ['#ffe14a', '#fff2a0'], ['#e6fffa', '#38dcd0'], ['#e4d4ff', '#b48cff'], ['#ffb060', '#ff5a2a'], ['#ffffff', '#b48cff']];
const SHIMMER = [null, null, null, null, null, '#ff7ad8', '#ff5a2a', '#ffffff'];
// The ram: exhaust a second at full speed, by level, and its colours (from the fifth, from two nozzles).
const EXHAUST_RATE = [0, 0, 0, 10, 16, 22, 28];
const EXHAUST_COLOURS = [null, null, null, ['#ffb060', '#ff5a3a'], ['#ffe14a', '#ffb060'], ['#ffe14a', '#ffffff'], ['#84dcff', '#ffffff']];
// The winch: lights that circle the station at each level, how far out (clear of everything built on it) and how
// fast; the scanner: how often its dish pings, while the drill is home, and from which level its beam sweeps.
export const ORBIT = [0, 0, 0, 0, 0, 2, 3, 4, 6];
const ORBIT_R = 46, ORBIT_SPEED = 0.8;
// (In each winch's own colours, two to a winch, by turns: the magma's embers, the storm's sparks, the gravity's
// stars; and the singularity's crown of the four gems.)
const ORBIT_COLOURS = [null, null, null, null, null, ['#ffd060', '#ff6a1a'], ['#fff27a', '#c8e0ff'], ['#f0e4ff', '#b08aff']], CROWN_COLOURS = ['#bfe6ff', '#ffffff', '#ffb060', '#b8f06a', '#ffffff', '#d8b8ff'];
const PING = [0, 6, 5, 4.5, 4, 3.5, 3], BEAM = 3;
// The hull's plates holding glint in their own metal: cobalt, gold, the aegis's white.
const PLATE_GLINT = [null, null, null, null, null, '#84dcff', '#ffe14a', '#e6fbff'];
// The lamp: the small warm glow at the drill's nose and the length of its flare, by level.
const LAMP_GLOW = [0, 0.1, 0.12, 0.14, 0.16, 0.18], FLARE = [0, 9, 12, 15, 18, 21], WARM = '#ffe0a0';
// The black box blinks every so many seconds, by level, on the station and the drill.
export const BEACON = [0, 1.6, 1.3, 1.0, 0.8];
// The flywheel: how long the game's run of quick hauls lasts after its last (js/game.js: CHAIN), how many steps of
// its spokes a second at rest in a run and how many more for each haul in it (up to RUN_MOST), and how fast it
// winds up or down to that. The capacitor throws a spark off its cap every so often while the bit holds a charge.
const RUN = 6, TURN = 6, TURN_UP = 3, RUN_MOST = 8, WIND = 4, CRACK = 0.3;
// The trophy line's barbs on the tether: a short tick across it every BARB_GAP of its pixels, in the colour of its
// level, laid on as the braid is so that they stay put on the ground (`barbs`). The dash list is made once.
const BARB_GAP = 9, BARB_DASH = [1.2, BARB_GAP - 1.2], BARB_COLOURS = [null, '#c8ccd8', '#ffb060', '#ffe14a'];
// The colour of each tab's moment, and of the parts it fits.
const TAB_COLOUR = { rig: '#8ce060', map: '#5cc4f0', core: '#ffe14a' };
const SPORE = ['#b8f06a', '#8ce060'], LAVA = ['#ffb060', '#ff5a3a'], GOLD = ['#ffd84a', '#ffe14a'], SMOKE = '#5a6074', GLINT = ['#ffffff', '#5cc4f0'];
const ARC = ['#e4d4ff', '#ffffff'], LIVE = '#b8f06a', TROPHY_LIGHT = '#ffb060';

// Every colour a particle may be is one of these, by its place: a particle holds a number, never a string.
const COLOURS = [], COLOUR = new Map();
const col = c => { let n = COLOUR.get(c); if (n === undefined) { n = COLOURS.length; COLOURS.push(c); COLOUR.set(c, n); } return n; };
const cols = list => list && list.map(col);
const SPARK_CI = SPARK_COLOURS.map(cols), EXHAUST_CI = EXHAUST_COLOURS.map(cols), SHIMMER_CI = SHIMMER.map(c => c && col(c));
for (const c of [...Object.values(TAB_COLOUR), ...GEM_COLOR.slice(1, 5)]) col(c);
const SPORE_CI = cols(SPORE), LAVA_CI = cols(LAVA), GOLD_CI = cols(GOLD), SMOKE_CI = col(SMOKE), GLINT_CI = cols(GLINT), WHITE_CI = col('#ffffff');
const ARC_CI = cols(ARC);
// The kinds of particle: a spark (a pixel, laid on as light), a star (a cross of pixels, as the game's own), an
// ember (a pixel that rises), a puff (two pixels of smoke, laid on as paint).
const SPARK = 0, STAR = 1, EMBER = 2, PUFF = 3;

// The sheets in the colours they are flashed and lit in, and the font in the colours the words are written in:
// each made once (js/atlas.js: `tinted`), one a frame in a game's first frames. (The corners' gems' come last, so
// that the rest are made in the frames they always were.)
const TINTS = [['drill', '#ffffff'], ['drill', '#ff8a2a'], ['drill', '#aab4c8'], ['drill', '#8ce060'], ['core', '#ffffff'], ['dish', '#ffffff'], ['station', '#ffffff'],
  ['station', '#ffd84a'], ['station', WARM], ...GEM_COLOR.slice(1, 5).map(c => ['station', c]),
  ...['#8ce060', '#5cc4f0', '#ffe14a', '#fff6c8', '#ffffff', ...GEM_COLOR.slice(1, 5)].map(c => ['font', c]),
  ...GEM_COLOR.slice(5).map(c => ['station', c]), ...GEM_COLOR.slice(5).map(c => ['font', c])];

// Whose tab a row is in, what its fitting is a part of (0 the drill or the tether, 1 the station, 2 the map), and
// its colour.
const TAB_OF = new Map(), KIND_OF = new Map(), COLOUR_OF = new Map();
for (const t of TABS) for (const u of t.rows) {
  TAB_OF.set(u, t);
  KIND_OF.set(u.id, t.id === 'map' ? 2 : ['winch', 'scanner', 'refinery', 'cutter', 'blackbox', 'livecatch', 'trophy'].includes(u.id) ? 1 : 0);
  COLOUR_OF.set(u.id, t.id === 'works' ? GEM_COLOR[u.kin] : TAB_COLOUR[t.id]);
}
const ROW = Object.fromEntries([...UPGRADES, ...WORKS, ...MAPS, ...CORE].map(u => [u.id, u]));

const ease = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);

export class Fitter {
  // `fly` and `boost` are the game's: cells a second in open ground, and how much faster a spore's drive goes
  // (js/game.js: FLY, BOOST), so that the ram's flame knows how fast is fast.
  constructor(fly = 9, boost = 1.5) {
    this.fly = fly; this.boost = boost;
    this.pool = this.makePool(CAP); this.panelPool = this.makePool(PANEL_CAP);
    this.rings = Array.from({ length: RINGS }, () => ({ on: false, x: 0, y: 0, follow: false, colour: '#ffffff', reach: 0, t: 0, life: 0.5, alpha: 0.9 }));
    this.effects = Array.from({ length: EFFECTS }, () => ({ on: false, sheet: '', animation: '', x: 0, y: 0, t: 0, follow: false }));
    this.labels = Array.from({ length: LABELS }, () => ({ on: false, text: '', colour: '#ffffff', x: 0, y: 0, follow: false, t: 0 }));
    this.queue = Array.from({ length: QUEUE }, () => ({ on: false, u: null, level: 0, grand: false, seq: 0 }));
    this.playing = Array.from({ length: 3 }, () => ({ on: false, u: null, level: 0, grand: false, kind: 0, colour: '#ffffff', label: '', t: 0, life: LIFE, seated: false, still: false, sub: '' }));
    this.moment = { t: 0, tab: '', id: '', row: 0, grand: false, colour: '#ffffff', stamp: '', fresh: false };
    this.banner = { t: 0, life: 1.6, title: '', sub: '', colour: '#ffffff' };
    // The shape of the arc coil's crackle: four lines of five pieces, each piece's end off the straight by so much.
    this.jag = new Float32Array(4 * 5);
    // What the drill looks like this frame, beyond its levels (js/drawing.js: `drawDrill`).
    this.look = { heat: 0, flame: 0, tint: '#ffffff', tintAlpha: 0, lit: 0, spin: 0 };
    this.lit = new Float32Array(FITS.length);
    this.warmed = 0; this.clock = 0;
    this.reset();
  }
  makePool(cap) {
    return { n: 0, cap, x: new Float32Array(cap), y: new Float32Array(cap), vx: new Float32Array(cap), vy: new Float32Array(cap), t: new Float32Array(cap),
      life: new Float32Array(cap), fall: new Float32Array(cap), col: new Uint8Array(cap), kind: new Uint8Array(cap) };
  }
  // Everything given back, as on a new world, a game loaded or a trip lost (`Game.begin`).
  reset() {
    this.seed = 0x2545f491;
    this.pool.n = 0; this.panelPool.n = 0;
    for (const r of this.rings) r.on = false;
    for (const e of this.effects) e.on = false;
    for (const l of this.labels) l.on = false;
    for (const q of this.queue) q.on = false;
    for (const p of this.playing) p.on = false;
    this.moment.t = 0; this.banner.t = 0; this.flash = 0; this.gap = 0; this.seq = 0; this.sounded = true; this.queued = 0;
    this.heat = 0; this.heatKick = 0; this.flameKick = 0; this.tint = 0; this.tintColour = '#ffffff'; this.tintAlpha = 0; this.tintFade = 0.3;
    this.menderShow = false; this.arcRing = false; this.gemCycle = false;
    this.spark = 0; this.shimmer = 0; this.exhaust = 0; this.side = 1; this.puffs = 0; this.embers = 0; this.glints = 0;
    this.lit.fill(0);
    this.crackle = 0; this.jagAt = -1; this.diamondIn = 2.5; this.beacon = 0; this.blinks = 0; this.calling = 0;
    this.wisps = 0; this.payAt = 0; this.wellGold = 0; this.wellGems = 0; this.wellGem = 0; this.gemTurn = 0; this.pingIn = 3; this.flareKick = 0; this.orbitIn = 0;
    this.sweep = 0; this.ox = 0; this.oy = 0;
    this.wheel = 0; this.wheelRate = 0; this.wheelKick = 0; this.runSeen = 0; this.crack = 0; this.clampLit = 0; this.rackLit = 0; this.barbLit = 0; this.haulSeen = null;
    this.bellows = false; this.graft = false;
    const L = this.look; L.heat = 0; L.flame = 0; L.tintAlpha = 0; L.lit = 0; L.spin = 0;
  }
  // The generator: a number in [0, 1), from the fitter's own seed.
  rnd() { let s = this.seed; s ^= s << 13; s ^= s >>> 17; s ^= s << 5; this.seed = s >>> 0; return this.seed / 4294967296; }

  // ------------------------------------------------------------ what the game tells it
  // A row has been bought (`Game.buy`): its moment in the shop now, and its fitting at the core once the shop is
  // shut. A milestone is made a show of: the row's last level, anything WORKS fits, anything CORE builds, and the
  // first thing a game buys. Of a row bought twice before it is fitted, its last level is fitted, once.
  bought(game, u, level) {
    const tab = TAB_OF.get(u), last = level === u.values.length - 1, works = tab.id === 'works', core = tab.id === 'core';
    const grand = last || works || core || game.S.stats.buys === 1, colour = COLOUR_OF.get(u.id), m = this.moment;
    m.t = MOMENT; m.tab = tab.id; m.id = u.id; m.row = tab.rows.indexOf(u); m.grand = grand; m.colour = colour; m.fresh = true;
    m.stamp = last ? 'MAX' : u.values.length === 2 ? 'FITTED' : u.show(u.values[level]);
    let q = this.queue.find(e => e.on && e.u === u);
    if (!q) q = this.queue.find(e => !e.on);
    if (!q) {
      // (Full: the oldest plain fitting gives way, or failing one, the oldest.)
      let oldest = null;
      for (const e of this.queue) if (!e.grand && (!oldest || e.seq < oldest.seq)) oldest = e;
      if (!oldest) for (const e of this.queue) if (!oldest || e.seq < oldest.seq) oldest = e;
      q = oldest;
    }
    if (!q.on || q.u !== u) q.grand = false;
    q.on = true; q.u = u; q.level = level; q.grand = q.grand || grand; q.seq = ++this.seq;
    this.sounded = false;
    this.count();
  }
  count() { let n = 0; for (const q of this.queue) if (q.on) n++; this.queued = n; }
  // A power of something fitted acted at an instant: the mender mended a pip, the arc coil took an arc in; the
  // lava skin's bellows quenched the slag round woken lava, the spore drive's graft healed moss as ore; the live
  // catch took a rare hazard in awake, the trophy line a foe. (The bellows and the graft may act many times in a
  // frame, a chain of lava woken or a cloud of moss: what they show is begun once and held, not begun again.)
  fire(id) {
    if (id === 'mender') { this.lit[MENDER] = 0.5; this.menderShow = true; }
    else if (id === 'arccoil') { this.lit[ARCCOIL] = 1.5; this.crackle = 0.4; this.arcRing = true; }
    else if (id === 'lavaskin') { if (this.lit[LAVASKIN] < 0.3) { this.lit[LAVASKIN] = 0.8; this.bellows = true; } }
    else if (id === 'sporedrive') { if (this.lit[SPOREDRIVE] < 0.3) { this.lit[SPOREDRIVE] = 0.8; this.graft = true; } }
    else if (id === 'livecatch') { this.clampLit = 1; this.ring((C - 1) * T - 8 + PART_AT.livecatch[0], (C - 1) * T - 8 + PART_AT.livecatch[1], LIVE, 22, 0, 0.5, false); }
    else if (id === 'trophy') { this.rackLit = 1; this.barbLit = 1; this.ring((C - 1) * T - 8 + PART_AT.trophy[0], (C - 1) * T - 8 + PART_AT.trophy[1], TROPHY_LIGHT, 22, 0, 0.5, false); }
  }

  // ------------------------------------------------------------ a frame
  step(game, dt) {
    const d = game.drill, S = game.S, lv = S.lv, x = d.x * T, y = d.y * T, ang = d.ang, ca = Math.cos(ang), sa = Math.sin(ang), w = game.world;
    this.clock += dt;
    // (One tinted sheet made a frame, until all are.)
    if (this.warmed < TINTS.length) { const [sheet, c] = TINTS[this.warmed++]; if (sheets[sheet]) tinted(sheet, c); }
    if (this.moment.t > 0) this.moment.t -= dt;
    this.flash = Math.max(0, this.flash - dt);
    // The fittings: one begun every GAP seconds while the shop and the lab are shut and the drill is whole.
    this.gap = Math.max(0, this.gap - dt);
    if (this.queued && this.gap <= 0 && !game.shop && !game.lab && d.mode !== 'dead') this.begin(game);
    for (let k = 0; k < this.playing.length; k++) if (this.playing[k].on) this.fitting(game, this.playing[k], dt);
    // The bit: hot while it bites into hard ground, cooling after; sparks off its point whatever it cuts; from the
    // sixth level a shimmer rising off it hot; and with the diamond tip, glints off metal.
    const bit = Math.min(7, lv.drill), cutting = d.dig >= 0 && d.mode !== 'dead', tip = TIP[bit] + 2, px = x + ca * tip, py = y + sa * tip;
    const want = cutting && d.digDur > 0.15 ? Math.min(1, d.digT / d.digDur) * HEAT[bit] : 0;
    this.heat = want > this.heat ? Math.min(want, this.heat + dt * 10) : Math.max(want, this.heat - dt * 2.5);
    this.heatKick = Math.max(0, this.heatKick - dt / 0.6);
    if (cutting && SPARK_RATE[bit]) {
      this.spark += SPARK_RATE[bit] * dt;
      while (this.spark >= 1) {
        this.spark--;
        const a = ang + Math.PI + (this.rnd() - 0.5) * 1.75, v = 40 + this.rnd() * 50, c = SPARK_CI[bit][(this.rnd() * 2) | 0];
        this.emit(this.pool, px, py, Math.cos(a) * v, Math.sin(a) * v, 0.18 + this.rnd() * 0.12, 120, c, this.rnd() < 0.33 ? STAR : SPARK);
      }
    } else this.spark = 0;
    if (SHIMMER_CI[bit] !== null && this.heat > 0.5) {
      this.shimmer += 3 * dt;
      while (this.shimmer >= 1) { this.shimmer--; this.emit(this.pool, px - ca * 3 + (this.rnd() - 0.5) * 4, py - 2, (this.rnd() - 0.5) * 6, -15, 0.35, 0, SHIMMER_CI[bit], EMBER); }
    }
    const metal = cutting && lv.diamond > 0 && METALS.includes(w.k(d.dig));
    if (metal) {
      this.glints += 10 * dt;
      while (this.glints >= 1) { this.glints--; const a = this.rnd() * 6.283, v = 20 + this.rnd() * 40; this.emit(this.pool, px, py, Math.cos(a) * v, Math.sin(a) * v, 0.25, 0, GLINT_CI[(this.rnd() * 2) | 0], STAR); }
    }
    // The ram: its flame as fast as the drill flies, against how fast it can, and exhaust from its nozzles.
    const ram = Math.min(6, lv.momentum), speed = Math.hypot(d.vx, d.vy);
    const top = this.fly * ROW.momentum.values[lv.momentum] * (game.boost > 0 ? this.boost : 1);
    this.flameKick = Math.max(0, this.flameKick - dt);
    const flame = ram >= 3 && d.mode === 'free' ? Math.max(this.flameKick > 0 ? 1 : 0, Math.min(1, Math.max(0, (speed / top - 0.35) / 0.65))) : 0;
    if (flame > 0) {
      this.exhaust += EXHAUST_RATE[ram] * flame * dt;
      while (this.exhaust >= 1) { this.exhaust--; this.side = -this.side; this.puff(x, y, ca, sa, -9, this.side * 2.5, EXHAUST_CI[ram][(this.rnd() * 2) | 0], 30 + this.rnd() * 30, 0.15 + this.rnd() * 0.15, SPARK); }
    } else this.exhaust = 0;
    // What WORKS fits, as it acts: the spore drive's vents while it drives, the lava skin in lava, the mender's lamp
    // blinking while the hull is dented (quicker as the next pip comes) and lit as it mends, the arc coil as it
    // takes an arc in, the diamond tip now and then.
    for (let k = 0; k < this.lit.length; k++) this.lit[k] = Math.max(0, this.lit[k] - dt);
    if (lv.sporedrive && game.boost > 0 && d.mode !== 'dead') {
      this.lit[SPOREDRIVE] = Math.max(this.lit[SPOREDRIVE], 0.05);
      this.puffs += 20 * dt;
      while (this.puffs >= 1) { this.puffs--; this.side = -this.side; this.puff(x, y, ca, sa, -7, this.side > 0 ? 1.5 : -2, SPORE_CI[(this.rnd() * 2) | 0], 20, 0.4, PUFF); }
    } else this.puffs = 0;
    const lava = lv.lavaskin > 0 && d.mode !== 'dead' && (w.lava.has(Math.floor(d.y - 0.3) * N + Math.floor(d.x - 0.3)) || w.lava.has(Math.floor(d.y + 0.3) * N + Math.floor(d.x + 0.3)));
    if (lava) {
      this.lit[LAVASKIN] = Math.max(this.lit[LAVASKIN], 0.05);
      this.embers += 8 * dt;
      while (this.embers >= 1) { this.embers--; const along = (this.rnd() - 0.5) * 10; this.emit(this.pool, x + ca * along - sa * 3, y + sa * along + ca * 3, (this.rnd() - 0.5) * 8, -18 - this.rnd() * 10, 0.4, 0, LAVA_CI[(this.rnd() * 2) | 0], EMBER); }
    } else if (this.lit[LAVASKIN] <= 0) this.embers = 0;
    if (lv.mender > 0 && game.dents > 0 && d.mode !== 'dead' && this.lit[MENDER] <= 0) {
      const every = ROW.mender.values[lv.mender], period = 0.3 + 0.7 * Math.max(0, 1 - game.mendIn / every);
      if (this.clock % period < 0.1) this.lit[MENDER] = 0.05;
    }
    if (this.menderShow) { this.menderShow = false; this.ring(x, y, '#8ce060', 14, 0, 0.4, true); this.ring(x, y, '#8ce060', 22, 0.1, 0.45, true); this.tintOn('#8ce060', 0.5); }
    if (this.crackle > 0) { this.crackle -= dt; if ((this.clock * 20 | 0) !== this.jagAt) { this.jagAt = this.clock * 20 | 0; for (let k = 0; k < this.jag.length; k++) this.jag[k] = (this.rnd() - 0.5) * 5; } }
    if (this.arcRing) { this.arcRing = false; this.ring(x, y, '#d8b8ff', 18, 0, 0.4, true); }
    if (lv.diamond > 0 && !metal) { this.diamondIn -= dt; if (this.diamondIn <= 0) { this.diamondIn = 2.5; this.lit[DIAMOND] = 0.12; } }
    if (metal) this.lit[DIAMOND] = Math.max(this.lit[DIAMOND], 0.05);
    // The second levels of what WORKS fits: the bellows blowing heat out of the belly as they quench, the graft's
    // spores out of the tail as it heals, and the capacitor lit, a spark off its cap now and then, while the bit
    // holds the charge (js/game.js: `charge`).
    if (this.bellows) { this.bellows = false; for (let n = 0; n < 6; n++) { const sx = 3.5 + (n % 3) * 2; this.emit(this.pool, x + ca * (sx - 8) - sa * 5, y + sa * (sx - 8) + ca * 5, -sa * 20 + (this.rnd() - 0.5) * 10, ca * 20 + (this.rnd() - 0.5) * 10, 0.5, 0, LAVA_CI[n & 1], EMBER); } }
    if (this.graft) { this.graft = false; for (let n = 0; n < 6; n++) { this.side = -this.side; this.puff(x, y, ca, sa, -7, this.side > 0 ? 1.5 : -2, SPORE_CI[n & 1], 20, 0.5, PUFF); } }
    if (lv.arccoil > 0 && game.charge > 0 && d.mode !== 'dead') {
      this.lit[ARCCOIL] = Math.max(this.lit[ARCCOIL], 0.05);
      this.crack -= dt;
      if (this.crack <= 0) { this.crack = CRACK + this.rnd() * CRACK; const a = this.rnd() * 6.283, v = 15 + this.rnd() * 20; this.emit(this.pool, x + ca * 0.5 + sa * 4, y + sa * 0.5 - ca * 4, Math.cos(a) * v, Math.sin(a) * v, 0.25, 0, ARC_CI[(this.rnd() * 2) | 0], this.rnd() < 0.4 ? STAR : SPARK); }
    } else this.crack = 0;
    // The flywheel: its spokes step round as fast as the game's run of quick hauls is long, wound up as each haul
    // joins it and down once the run is over (or the drill knocked: js/game.js `spin`); and each haul in the run
    // throws a ring off the wheel.
    if (lv.flywheel > 0) {
      const spin = game.spin, run = spin && game.time - spin.t <= RUN ? spin.n : 0, want = run ? TURN + TURN_UP * Math.min(RUN_MOST, run) : 0;
      if (run > this.runSeen) this.ring(x, y, COLOUR_OF.get('flywheel'), 14 + 2 * Math.min(RUN_MOST, run), 0, 0.35, true);
      this.runSeen = run;
      this.wheelKick = Math.max(0, this.wheelKick - dt);
      const target = Math.max(want, this.wheelKick > 0 ? TURN + TURN_UP * RUN_MOST : 0);
      this.wheelRate += (target - this.wheelRate) * Math.min(1, WIND * dt);
      this.wheel = (this.wheel + this.wheelRate * dt) % 2;
    } else { this.wheel = 0; this.wheelRate = 0; this.runSeen = 0; }
    // The station's parts that act out in the ground: the live catch's clamp as a rare hazard comes home awake (a
    // haul the game titles so; js/game.js `haulTitle`), and the trophy line's rack and barbs as a foe is caught.
    const h = game.hauled;
    if (h && h !== this.haulSeen) { this.haulSeen = h; if (lv.livecatch > 0 && (h.live || h.title === 'CAUGHT LIVE!')) this.fire('livecatch'); }
    this.clampLit = Math.max(0, this.clampLit - dt); this.rackLit = Math.max(0, this.rackLit - dt); this.barbLit = Math.max(0, this.barbLit - dt);
    // The black box: a blink every so many seconds, and over a wreck, fast, with a red ring from the drill every
    // 0.6 s: the box calling.
    if (lv.blackbox > 0) {
      const dead = d.mode === 'dead', every = dead ? 0.2 : BEACON[Math.min(4, lv.blackbox)];
      this.beacon += dt;
      if (this.beacon >= every) { this.beacon -= every; this.lit[BLACKBOX] = 0.12; }
      if (this.blinks > 0) { this.blinks -= dt; if ((this.blinks * 10 | 0) % 2 === 0) this.lit[BLACKBOX] = Math.max(this.lit[BLACKBOX], 0.05); }
      if (dead) { this.calling -= dt; if (this.calling <= 0) { this.calling = 0.6; this.ring(x, y, '#ff5a4a', 20, 0, 0.5, false); } } else this.calling = 0;
    }
    // The station: smoke from the refinery's mouths, and while a haul is paid the mouths throw gold and the well
    // glows gold (and, with the gem cutter, in the colours of the gems coming in, in turn); the dish's pings
    // while the drill is home.
    const coreX = (C - 1) * T - 8, coreY = (C - 1) * T - 8, home = this.coreSeen(game);
    this.wellGold = Math.max(0, this.wellGold - dt); this.wellGems = Math.max(0, this.wellGems - dt);
    if (this.wellGems <= 0) this.gemCycle = false;
    const mouths = REFINERY_MOUTHS[Math.min(7, lv.refinery)];
    if (home && mouths.length) {
      this.wisps -= dt;
      if (this.wisps <= 0) { this.wisps = 0.8; for (let k = 0; k < mouths.length; k += 2) this.emit(this.pool, coreX + mouths[k], coreY + mouths[k + 1], (this.rnd() - 0.5) * 4, -8 - this.rnd() * 4, 1.2, 0, SMOKE_CI, PUFF); }
    }
    if (game.coreFlash > 0 && this.clock - this.payAt > 0.11) {
      this.payAt = this.clock;
      if (lv.refinery > 0) {
        this.wellGold = 0.15;
        if (home) for (let k = 0; k < mouths.length; k += 2) for (let n = 0; n < 2 + Math.ceil(lv.refinery / 2); n++) this.emit(this.pool, coreX + mouths[k], coreY + mouths[k + 1], (this.rnd() - 0.5) * 40, -30 - this.rnd() * 40, 0.4, 140, GOLD_CI[(this.rnd() * 2) | 0], this.rnd() < 0.3 ? STAR : SPARK);
      }
      if (lv.cutter > 0) for (let n = 0; n < 8; n++) { this.gemTurn = this.gemTurn % 8 + 1; if (game.pending.gems[this.gemTurn] > 0) { this.wellGem = this.gemTurn; this.wellGems = 0.15; break; } }
    }
    if (home && lv.scanner > 0 && game.atCore && !game.shop) {
      this.pingIn -= dt;
      if (this.pingIn <= 0) { this.pingIn = PING[Math.min(6, lv.scanner)]; this.ring(coreX + PART_AT.scanner[0], coreY + PART_AT.scanner[1], '#5fe0d0', 48 + 8 * lv.scanner, 0, 1.2, false, 0.35); }
    }
    this.flareKick = Math.max(0, this.flareKick - dt); this.orbitIn = Math.max(0, this.orbitIn - dt);
    this.tint = Math.max(0, this.tint - dt);
    this.stepPool(this.pool, dt); this.stepPool(this.panelPool, dt);
    for (let k = 0; k < RINGS; k++) { const r = this.rings[k]; if (r.on && (r.t += dt) >= r.life) r.on = false; }
    for (let k = 0; k < EFFECTS; k++) { const e = this.effects[k]; if (e.on && (e.t += dt * 1000) >= duration(e.sheet, e.animation)) e.on = false; }
    for (let k = 0; k < LABELS; k++) { const l = this.labels[k]; if (l.on && (l.t += dt) >= 0.9) l.on = false; }
    if (this.banner.t > 0) this.banner.t -= dt;
    if (this.sweep > 0) this.sweep -= dt;
    // What the drill looks like.
    const L = this.look;
    L.heat = bit >= 3 ? Math.max(this.heat, this.heatKick) : 0;
    L.flame = flame;
    L.lit = 0;
    for (let k = 0; k < this.lit.length; k++) if (this.lit[k] > 0) L.lit |= LIT_BIT[k];
    if (this.flareKick > 0) L.lit |= LIT_BIT[LAMP];
    if (this.wheel >= 1) L.lit |= LIT_BIT[FLYWHEEL];
    L.tint = this.tintColour; L.tintAlpha = this.tint > 0 ? this.tintAlpha * Math.min(1, this.tint / this.tintFade) : 0;
    if (lava && L.tintAlpha < 0.2) { L.tint = '#ff8a2a'; L.tintAlpha = 0.2 + 0.12 * Math.sin(game.time * 12); }
    L.spin = 0;
    for (let k = 0; k < this.playing.length; k++) { const f = this.playing[k]; if (f.on && f.kind === 0 && f.still && game.atCore && f.t > SEAT) L.spin = 6.2832 * ease((f.t - SEAT) / 0.4); }
  }
  // Whether the core is in view, or near it.
  coreSeen(game) { return Math.abs(HX * T - game.cam.x) < game.W / 2 + 80 && Math.abs(HY * T - game.cam.y) < game.H / 2 + 80; }
  // The next fitting in the queue begins (the oldest first). A part of the station is not fitted where the
  // station cannot be seen: the drill has gone.
  begin(game) {
    let q = null;
    for (const e of this.queue) if (e.on && (!q || e.seq < q.seq)) q = e;
    let f = null;
    for (const p of this.playing) if (!p.on) { f = p; break; }
    if (!q || !f) return;
    q.on = false; this.count();
    const u = q.u, kind = KIND_OF.get(u.id);
    if (kind === 1 && !this.coreSeen(game)) return;
    const d = game.drill;
    f.on = true; f.u = u; f.level = q.level; f.grand = q.grand; f.kind = kind; f.colour = COLOUR_OF.get(u.id); f.t = 0; f.life = q.grand ? GRAND_LIFE : LIFE; f.seated = false;
    // (A drill part is fitted with a turn on the core only where the drill sits still on it; out in flight it is
    // fitted where the drill is, with no turn.)
    f.still = game.atCore && Math.hypot(d.vx, d.vy) < 2;
    // (A bit or a winch is named for what it is now: `tiers`, DIAMOND BIT, FROST WINCH.)
    // (In another language the name and the value are each turned, as they are said apart in the shop: js/lang.js.)
    f.label = u.tiers ? `${u.tiers[q.level]} ${u.noun ?? u.name}` : `${tr(u.name)} ${tr(u.show(u.values[q.level]))}`;
    const last = q.level === u.values.length - 1, tab = TAB_OF.get(u).id;
    f.sub = last ? 'MAX' : tab === 'works' ? 'FITTED' : tab === 'core' ? 'BUILT' : u.show(u.values[q.level]);
    this.gap = GAP;
  }
  // Where a fitting's part is, in the world's pixels.
  partAt(game, f, out) {
    const d = game.drill, at = PART_AT[f.u.id];
    if (f.kind === 0 || !at) { out[0] = d.x * T; out[1] = d.y * T; } else { out[0] = (C - 1) * T - 8 + at[0]; out[1] = (C - 1) * T - 8 + at[1]; }
    return out;
  }
  fitting(game, f, dt) {
    f.t += dt;
    if (!f.seated && f.t >= SEAT) { f.seated = true; this.seat(game, f); }
    if (f.t >= f.life) f.on = false;
  }
  // The part is seated: it flashes white, a ring and sparks, its name rises over it, and the row's own flourish.
  seat(game, f) {
    const at = this.partAt(game, f, SPOT), x = at[0], y = at[1], d = game.drill, lv = game.S.lv, id = f.u.id, follow = f.kind === 0, c = col(f.colour);
    if (!this.sounded) {
      // (One sound for all that was bought at one visit to the shop, at the first seating: a bell, and a run up as
      // long as what was bought, where any of it is a milestone. Nothing that ducks the music, and nothing of a
      // relic's or a cache's.)
      this.sounded = true;
      let grand = f.grand, n = 1;
      for (const q of this.queue) if (q.on) { n++; if (q.grand) grand = true; }
      if (grand) sfx.gather(Math.min(6, n + 2)); else sfx.clink();
    }
    if (f.kind === 0) this.tintOn('#ffffff', 0.9, 0.2);
    this.ring(x, y, f.colour, 26, 0, 0.45, follow);
    this.burst(x, y, 8, c, 60);
    const label = this.labelSlot();
    label.on = true; label.text = f.label; label.colour = f.colour; label.x = x; label.y = y - (f.kind === 1 ? 10 : 18); label.follow = follow; label.t = -0.05;
    if (id === 'drill') { this.heatKick = 1; const bit = Math.min(7, lv.drill), ca = Math.cos(d.ang), sa = Math.sin(d.ang); for (let n = 0; n < 10; n++) { const a = d.ang + Math.PI + (this.rnd() - 0.5) * 2, v = 50 + this.rnd() * 60; this.emit(this.pool, x + ca * (TIP[bit] + 2), y + sa * (TIP[bit] + 2), Math.cos(a) * v, Math.sin(a) * v, 0.3, 120, SPARK_CI[Math.max(2, bit)][(this.rnd() * 2) | 0], this.rnd() < 0.33 ? STAR : SPARK); } }
    else if (id === 'momentum') { this.flameKick = 0.5; const ram = Math.min(6, lv.momentum), ca = Math.cos(d.ang), sa = Math.sin(d.ang); if (ram >= 3) for (let n = 0; n < 12; n++) { this.side = -this.side; this.puff(x, y, ca, sa, -9, this.side * 2.5, EXHAUST_CI[ram][n & 1], 40 + this.rnd() * 30, 0.3, SPARK); } }
    else if (id === 'hull') { this.tintOn('#aab4c8', 0.8, 0.4); if (lv.hull >= ROW.hull.values.length - 1) this.effect('ward', 'shield', x, y, true); }
    else if (id === 'tether') { const t = TETHERS[Math.min(9, lv.tether)]; this.ring(HX * T, HY * T, t.a, 90, 0, 0.6, false); this.ring(HX * T, HY * T, t.b, 110, 0.09, 0.6, false); }
    else if (id === 'winch') { this.orbitIn = 0.8; this.ring(x, y, '#c8f4ff', 40, 0, 0.5, false); }
    else if (id === 'scanner') this.ring(x, y, '#5fe0d0', 48 + 8 * lv.scanner, 0, 1.2, false, 0.5);
    else if (id === 'mender') this.fire('mender');
    else if (id === 'lavaskin') { this.lit[LAVASKIN] = 1; this.tintOn('#ff8a2a', 0.35, 1); for (let n = 0; n < 8; n++) this.emit(this.pool, x + (this.rnd() - 0.5) * 10, y + 3, (this.rnd() - 0.5) * 10, -20 - this.rnd() * 10, 0.6, 0, LAVA_CI[n & 1], EMBER); }
    else if (id === 'sporedrive') { this.lit[SPOREDRIVE] = 0.8; const ca = Math.cos(d.ang), sa = Math.sin(d.ang); for (let n = 0; n < 10; n++) { this.side = -this.side; this.puff(x, y, ca, sa, -7, this.side > 0 ? 1.5 : -2, SPORE_CI[n & 1], 25, 0.6, PUFF); } }
    else if (id === 'arccoil') { this.lit[ARCCOIL] = 1.5; this.crackle = 0.6; this.ring(x, y, '#d8b8ff', 18, 0, 0.4, true); this.effect('zap', 'impact', x, y, true); }
    else if (id === 'diamond') { this.lit[DIAMOND] = 0.5; this.burst(x, y, 6, WHITE_CI, 50, STAR); }
    else if (id === 'flywheel') { this.wheelKick = 0.8; this.ring(x, y, f.colour, 18, 0, 0.4, true); }
    else if (id === 'livecatch') this.clampLit = 0.8;
    else if (id === 'trophy') { this.rackLit = 0.8; this.barbLit = 0.8; }
    else if (id === 'refinery') { this.wellGold = 0.8; const mouths = REFINERY_MOUTHS[Math.min(7, lv.refinery)], cx = (C - 1) * T - 8, cy = (C - 1) * T - 8; for (let k = 0; k < mouths.length; k += 2) for (let n = 0; n < 5; n++) this.emit(this.pool, cx + mouths[k], cy + mouths[k + 1], (this.rnd() - 0.5) * 40, -30 - this.rnd() * 40, 0.5, 140, GOLD_CI[n & 1], n % 3 ? SPARK : STAR); }
    else if (id === 'cutter') { this.wellGems = 0.8; this.gemCycle = true; }
    else if (id === 'lamp') this.flareKick = 0.5;
    else if (id === 'blackbox') { this.blinks = 0.6; this.ring(x, y, '#ff5a4a', 20, 0, 0.5, false); }
    else if (f.kind === 2) this.sweep = 0.5;
    if (f.grand) {
      // A milestone: a circle and a pillar of light at the core where the core is seen (or rings where the drill
      // is, out in flight), three rings, sparks, the screen lit a moment, and its banner.
      const home = this.coreSeen(game) && (f.kind !== 0 || f.still);
      if (home) this.effect('crest', 'healing-circle', HX * T, HY * T - 12, false);
      for (let k = 0; k < 3; k++) this.ring(home ? HX * T : x, home ? HY * T : y, k === 1 ? '#ffffff' : f.colour, 90 + 40 * k, 0.09 * k, 0.7, follow && !home);
      this.burst(x, y, 24, c, 90);
      this.flash = 0.3;
      const b = this.banner;
      b.t = b.life; b.title = f.u.tiers ? f.label : f.u.name; b.sub = f.sub; b.colour = f.colour;
    }
  }
  tintOn(colour, alpha, fade = 0.3) { this.tintColour = colour; this.tintAlpha = alpha; this.tint = fade; this.tintFade = fade; }
  labelSlot() { let best = this.labels[0]; for (const l of this.labels) { if (!l.on) return l; if (l.t > best.t) best = l; } return best; }
  ring(x, y, colour, reach, delay, life, follow, alpha = 0.9) {
    let r = this.rings[0];
    for (const e of this.rings) { if (!e.on) { r = e; break; } if (e.t > r.t) r = e; }
    r.on = true; r.x = x; r.y = y; r.colour = colour; r.reach = reach; r.t = -delay; r.life = life; r.follow = follow; r.alpha = alpha;
  }
  effect(sheet, animation, x, y, follow) {
    if (!sheets[sheet]) return;
    let e = this.effects[0];
    for (const f of this.effects) { if (!f.on) { e = f; break; } if (f.t > e.t) e = f; }
    e.on = true; e.sheet = sheet; e.animation = animation; e.x = x; e.y = y; e.t = 0; e.follow = follow;
  }
  // A particle: dropped where the pool is full.
  emit(P, x, y, vx, vy, life, fall, c, kind) {
    if (P.n >= P.cap) return;
    const i = P.n++;
    P.x[i] = x; P.y[i] = y; P.vx[i] = vx; P.vy[i] = vy; P.t[i] = 0; P.life[i] = life; P.fall[i] = fall; P.col[i] = c; P.kind[i] = kind;
  }
  // Sparks all round a point.
  burst(x, y, count, c, speed, kind = -1) {
    for (let n = 0; n < count; n++) { const a = this.rnd() * 6.283, v = speed * (0.4 + this.rnd() * 0.8); this.emit(this.pool, x, y, Math.cos(a) * v, Math.sin(a) * v, 0.3 + this.rnd() * 0.35, 40, c, kind >= 0 ? kind : this.rnd() < 0.33 ? STAR : SPARK); }
  }
  // Out of the drill's tail, `back` of its pixels behind its middle and `side` across, blown back the way it came.
  puff(x, y, ca, sa, back, side, c, speed, life, kind) {
    const vx = -ca * speed - sa * (this.rnd() - 0.5) * 12, vy = -sa * speed + ca * (this.rnd() - 0.5) * 12;
    this.emit(this.pool, x + ca * back - sa * side, y + sa * back + ca * side, vx, vy, life, 0, c, kind);
  }
  stepPool(P, dt) {
    const drag = 1 - 2.5 * dt;
    for (let i = 0; i < P.n;) {
      if ((P.t[i] += dt) >= P.life[i]) {
        const j = --P.n;
        P.x[i] = P.x[j]; P.y[i] = P.y[j]; P.vx[i] = P.vx[j]; P.vy[i] = P.vy[j]; P.t[i] = P.t[j]; P.life[i] = P.life[j]; P.fall[i] = P.fall[j]; P.col[i] = P.col[j]; P.kind[i] = P.kind[j];
        continue;
      }
      P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt;
      if (P.kind[i] === SPARK || P.kind[i] === STAR) { P.vx[i] *= drag; P.vy[i] = P.vy[i] * drag + P.fall[i] * dt; }
      i++;
    }
  }

  // ------------------------------------------------------------ drawing
  // What CORE builds, on the station (drawn with the core, under the dark), and the station's parts flashing white
  // as they are seated.
  station(game, ctx, coreX, coreY, now) {
    const lv = game.S.lv, x = coreX - 8, y = coreY - 8, s = sheets.station;
    if (!s) return;
    if (lv.refinery > 0) draw(ctx, 'station', REFINERY[Math.min(7, lv.refinery)], x, y);
    if (lv.cutter > 0) draw(ctx, 'station', lv.cutter >= 6 ? frameAt('station', 'cutter-6', now) : CUTTER[lv.cutter], x, y);
    if (lv.blackbox > 0) draw(ctx, 'station', BOX[Math.min(4, lv.blackbox)][this.lit[BLACKBOX] > 0 ? 1 : 0], x, y);
    if (lv.livecatch > 0) draw(ctx, 'station', LIVECATCH[Math.min(3, lv.livecatch)], x, y);
    if (lv.trophy > 0) draw(ctx, 'station', TROPHY[Math.min(3, lv.trophy)], x, y);
    for (let k = 0; k < this.playing.length; k++) {
      const f = this.playing[k];
      if (!f.on || f.kind !== 1 || f.t < SEAT || f.t > SEAT + 0.3) continue;
      const base = ctx.globalAlpha;
      ctx.globalAlpha = base * (1 - (f.t - SEAT) / 0.3);
      const id = f.u.id;
      if (id === 'winch') draw(ctx, 'core', CORE_FLASH[Math.min(8, lv.winch)], coreX, coreY);
      else if (id === 'scanner') { const r = sheets.dish.frames[DISH[Math.min(6, lv.scanner)]]; ctx.drawImage(tinted('dish', '#ffffff'), r[0], r[1], r[2], r[3], coreX + 34, coreY - 6, r[2], r[3]); }
      else {
        const name = id === 'refinery' ? REFINERY[Math.min(7, lv.refinery)] : id === 'cutter' ? (lv.cutter >= 6 ? 'cutter-6-a' : CUTTER[lv.cutter])
          : id === 'livecatch' ? LIVECATCH[Math.min(3, lv.livecatch)] : id === 'trophy' ? TROPHY[Math.min(3, lv.trophy)] : BOX[Math.min(4, lv.blackbox)][0], r = s.frames[name];
        ctx.drawImage(tinted('station', '#ffffff'), r[0], r[1], r[2], r[3], x, y, r[2], r[3]);
      }
      ctx.globalAlpha = base;
    }
  }
  // Everything that shines, over the dark, as light: sparks, rings, the lights about the station and the dish's
  // beam, the well's glows, the lamp's glow and flare, the arc coil's crackle, the hull's plates holding, and what
  // flies in to a part as it is fitted.
  glow(game, ctx, ox, oy, now) {
    this.ox = ox; this.oy = oy;
    const d = game.drill, lv = game.S.lv, W = game.W, H = game.H, base = ctx.globalAlpha;
    ctx.globalCompositeOperation = 'lighter';
    const cx = HX * T - ox, cy = HY * T - oy, sx = (C - 1) * T - 8 - ox, sy = (C - 1) * T - 8 - oy;
    if (cx > -120 && cy > -120 && cx < W + 120 && cy < H + 120) {
      // The dish's beam, swinging across the quarter above and right of the station and back.
      if (lv.scanner >= BEAM) {
        const bx = sx + PART_AT.scanner[0], by = sy + PART_AT.scanner[1], a = -0.785 + Math.sin(game.time * 2.094) * 0.785, len = 30 + 6 * lv.scanner;
        ctx.globalAlpha = 0.12; ctx.fillStyle = '#5fe0d0';
        for (let side = -1; side <= 1; side += 2) {
          const ux = Math.cos(a + side * 0.175), uy = Math.sin(a + side * 0.175);
          for (let s = 2; s < len; s++) ctx.fillRect(Math.round(bx + ux * s), Math.round(by + uy * s), 1, 1);
        }
      }
      // Lights circling the station, each with a short trail; spun in from further out as the winch is fitted.
      const n = ORBIT[Math.min(8, lv.winch)];
      if (n) {
        const r = ORBIT_R + 14 * ease(this.orbitIn / 0.8), crown = lv.winch >= 8;
        for (let k = 0; k < n; k++) {
          const a = game.time * ORBIT_SPEED + k * 6.2832 / n;
          ctx.fillStyle = crown ? CROWN_COLOURS[k % 6] : ORBIT_COLOURS[lv.winch][k % 2];
          for (let j = 3; j >= 0; j--) {
            const b = a - j * 0.05;
            ctx.globalAlpha = j ? 0.35 - j * 0.08 : 0.9;
            ctx.fillRect(Math.round(cx + Math.cos(b) * r) - (j ? 0 : 1), Math.round(cy + Math.sin(b) * r) - (j ? 0 : 1), j ? 1 : 2, j ? 1 : 2);
          }
        }
      }
      // The well, gold as the refinery pays a haul, or a gem's colour with the cutter.
      const well = sheets.station?.frames.well;
      if (well && (this.wellGold > 0 || this.wellGems > 0)) {
        const gold = this.wellGold > 0, colour = gold ? '#ffd84a' : GEM_COLOR[this.gemCycle && !game.coreFlash ? 1 + ((this.clock * 5) | 0) % 4 : this.wellGem || 1];
        ctx.globalAlpha = gold ? Math.min(0.75, 0.35 + 0.05 * lv.refinery) : 0.5;
        ctx.drawImage(tinted('station', colour), well[0], well[1], well[2], well[3], sx, sy, well[2], well[3]);
      }
      // The black box's lamp, lit; the live catch's jaws, lit as a rare hazard comes home awake; the trophy line's
      // barbs, lit as a foe is caught (and each, a moment, as it is fitted).
      if (lv.blackbox > 0 && this.lit[BLACKBOX] > 0) this.lamps(ctx, BOX_LAMPS[Math.min(4, lv.blackbox)], sx, sy, '#ff5a4a', 0.5);
      if (lv.livecatch > 0 && this.clampLit > 0) this.lamps(ctx, CLAMP_LAMPS[Math.min(3, lv.livecatch)], sx, sy, LIVE, Math.min(0.8, this.clampLit));
      if (lv.trophy > 0 && this.rackLit > 0) this.lamps(ctx, RACK_LAMPS[Math.min(3, lv.trophy)], sx, sy, TROPHY_LIGHT, Math.min(0.8, this.rackLit));
    }
    const dx = d.x * T - ox, dy = d.y * T - oy, ca = Math.cos(d.ang), sa = Math.sin(d.ang);
    if (d.mode !== 'dead' && lv.lamp > 0 && sheets.station) {
      // The lamp: a small warm glow at the nose, and a flare off it turned to the heading, longer at each level.
      const bit = Math.min(7, lv.drill), nx = dx + ca * (TIP[bit] + 1), ny = dy + sa * (TIP[bit] + 1), F = sheets.station.frames, lamp = Math.min(5, lv.lamp);
      const glow = F.well, size = 10 + 3 * lamp, kick = 1 + 2 * ease(this.flareKick / 0.5);
      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = LAMP_GLOW[lamp] * (1 + this.flareKick);
      ctx.drawImage(tinted('station', WARM), glow[0] + 20, glow[1] + 20, 24, 24, nx - size / 2, ny - size / 2, size, size);
      ctx.imageSmoothingEnabled = false;
      const flare = F.flare, scale = FLARE[lamp] * kick / 52;
      ctx.globalAlpha = 0.25 + 0.05 * Math.sin(game.time * 1.3) + 0.3 * ease(this.flareKick / 0.5);
      ctx.save(); ctx.translate(nx, ny); ctx.rotate(d.ang);
      ctx.drawImage(tinted('station', WARM), flare[0], flare[1], flare[2], flare[3], -32 * scale, -32 * Math.min(1, scale * 1.5), 64 * scale, 64 * Math.min(1, scale * 1.5));
      ctx.restore();
    }
    // The hull's plates holding while nothing can knock it, from the sixth level.
    if (game.shield > 0 && lv.hull >= 5 && d.mode !== 'dead') {
      ctx.fillStyle = PLATE_GLINT[Math.min(7, lv.hull)]; ctx.globalAlpha = 0.7 * Math.min(1, game.shield);
      for (let k = 0; k < 12; k++) { const a = game.time * 4 + k * 0.5236; ctx.fillRect(Math.round(dx + Math.cos(a) * 11), Math.round(dy + Math.sin(a) * 11), 1, 1); }
    }
    // The arc coil's crackle: four jagged lines out of the coil.
    if (this.crackle > 0) {
      ctx.lineWidth = 1; ctx.globalAlpha = Math.min(1, this.crackle * 4);
      for (let k = 0; k < 4; k++) {
        // (Out of the coil's winding, two lines up and forward and two down and forward, in the drill's own frame.)
        const ly = k < 2 ? -3 : 2, out = 8 + (k & 1) * 5, fx = 0.3 + (k & 1) * 0.5, fy = k < 2 ? -1 : 1, x0 = dx + ca * 2 - sa * ly, y0 = dy + sa * 2 + ca * ly;
        const ex = (fx * ca - fy * sa) * out, ey = (fx * sa + fy * ca) * out;
        ctx.strokeStyle = k & 1 ? '#d8b8ff' : '#fff2a0';
        ctx.beginPath(); ctx.moveTo(x0, y0);
        for (let s = 1; s <= 5; s++) { const j = this.jag[k * 5 + s - 1] * (s < 5 ? 1 : 0); ctx.lineTo(x0 + ex * s / 5 - ey / out * j, y0 + ey * s / 5 + ex / out * j); }
        ctx.stroke();
      }
    }
    // What flies in to a part being fitted: six motes spiralling in about it (or out of the well to a part of the
    // station), until it is seated.
    for (let q = 0; q < this.playing.length; q++) {
      const f = this.playing[q];
      if (!f.on || f.t >= SEAT) continue;
      const at = this.partAt(game, f, SPOT), u = f.t / SEAT;
      ctx.fillStyle = f.colour;
      for (let k = 0; k < 6; k++) {
        const a = k * 1.0472 + f.level * 0.2967 + u * 3, far = 40 * (1 - ease(u));
        let mx = at[0] - ox + Math.cos(a) * far, my = at[1] - oy + Math.sin(a) * far;
        if (f.kind === 1 && f.u.id !== 'winch') { mx = cx + (at[0] - ox - cx) * ease(u) + Math.cos(a) * 4 * (1 - u); my = cy + (at[1] - oy - cy) * ease(u) + Math.sin(a) * 4 * (1 - u); }
        ctx.globalAlpha = 0.5 + 0.5 * u;
        ctx.fillRect(Math.round(mx) - 1, Math.round(my) - 1, 2, 2);
      }
    }
    this.drawPool(ctx, this.pool, ox, oy, W, H);
    for (let k = 0; k < RINGS; k++) {
      const r = this.rings[k];
      if (!r.on || r.t < 0) continue;
      const u = r.t / r.life, rad = r.reach * (1 - (1 - u) * (1 - u)), n = Math.max(12, (rad * 1.6) | 0), rx = (r.follow ? d.x * T : r.x) - ox, ry = (r.follow ? d.y * T : r.y) - oy;
      ctx.globalAlpha = (1 - u) * r.alpha; ctx.fillStyle = r.colour;
      for (let a = 0; a < n; a++) ctx.fillRect(Math.round(rx + Math.cos(a / n * 6.283) * rad), Math.round(ry + Math.sin(a / n * 6.283) * rad), 1, 1);
    }
    for (let k = 0; k < EFFECTS; k++) {
      const e = this.effects[k];
      if (!e.on) continue;
      const f = frameAt(e.sheet, e.animation, e.t);
      if (!f) continue;
      ctx.globalAlpha = 0.85;
      draw(ctx, e.sheet, f, (e.follow ? d.x * T : e.x) - ox - f[2] / 2, (e.follow ? d.y * T : e.y) - oy - f[3] / 2);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = base;
  }
  // Lamps on the station, lit: a soft square of light on each [x, y] of `at`, in the station sheet's pixels.
  lamps(ctx, at, sx, sy, colour, alpha) {
    ctx.fillStyle = colour; ctx.globalAlpha = alpha;
    for (let k = 0; k < at.length; k += 2) ctx.fillRect(sx + at[k] - 1, sy + at[k + 1] - 1, 3, 3);
  }
  // The trophy line's barbs on the tether, on the screen's own canvas, laid on a rope as js/drawing.js lays its braid
  // (`drawRopes`: its `trace` of a part of it and the `runs` of it in view, each with how far along the rope it
  // begins, so the barbs stay put on the ground): short ticks across it, wider than it, in the colour of the level,
  // and white a moment as a foe is caught. Only the tether out to the drill has them, not a loop round a haul.
  barbs(game, o, r) {
    const level = Math.min(3, game.S.lv.trophy);
    if (!level || r.loop || !r.runs || !r.runs.length) return;
    o.lineCap = 'butt'; o.setLineDash(BARB_DASH); o.lineWidth = r.wide + 2.4;
    o.strokeStyle = this.barbLit > 0 && ((this.barbLit * 10) | 0) % 2 === 0 ? '#ffffff' : BARB_COLOURS[level];
    for (const run of r.runs) { o.lineDashOffset = run[2] % BARB_GAP; r.trace(0, run); o.stroke(); }
    o.lineDashOffset = 0; o.setLineDash(NO_DASH);
  }
  drawPool(ctx, P, ox, oy, W, H) {
    for (let i = 0; i < P.n; i++) {
      const px = Math.round(P.x[i] - ox), py = Math.round(P.y[i] - oy), kind = P.kind[i], fade = 1 - P.t[i] / P.life[i];
      if (px < -2 || py < -2 || px >= W + 2 || py >= H + 2) continue;
      ctx.fillStyle = COLOURS[P.col[i]];
      if (kind === PUFF) { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.45 * fade; ctx.fillRect(px, py, 2, 2); ctx.globalCompositeOperation = 'lighter'; continue; }
      ctx.globalAlpha = kind === EMBER ? 0.6 * fade : Math.min(1, fade * 2);
      if (kind === STAR) { const arm = fade > 0.5 ? 2 : 1; ctx.fillRect(px - arm, py, arm * 2 + 1, 1); ctx.fillRect(px, py - arm, 1, arm * 2 + 1); }
      else ctx.fillRect(px, py, 1, 1);
    }
  }
  // Over the interface: the names of parts as they are fitted, rising over them; a milestone's banner, under the
  // core, clear of the haul's banner, the word across the screen and a place's name, which are all above it; and
  // the screen lit a moment.
  hud(game, ctx, head) {
    const W = game.W, H = game.H, base = ctx.globalAlpha, d = game.drill;
    for (let k = 0; k < LABELS; k++) {
      const l = this.labels[k];
      if (!l.on || l.t < 0) continue;
      ctx.globalAlpha = base * Math.min(1, (0.9 - l.t) * 4, l.t * 12);
      text(ctx, l.text, (l.follow ? d.x * T : l.x) - this.ox, (l.follow ? d.y * T - 18 : l.y) - this.oy - l.t * 18, l.colour, 0.5);
    }
    const b = this.banner;
    if (b.t > 0 && !game.shop && !game.lab) {
      const age = b.life - b.t, pop = Math.min(1, age / 0.12), y = Math.round((H - 44) / 2 + 30 + (1 - pop) * 6);
      ctx.globalAlpha = base * Math.min(1, b.t * 3);
      text(ctx, b.title, W / 2, y, b.colour, 0.5, textWidth(b.title, 2) > W - 8 ? 1 : 2);
      text(ctx, b.sub, W / 2, y + 22, '#ffe14a', 0.5);
    }
    if (this.flash > 0) { ctx.globalAlpha = base * Math.min(0.25, this.flash); ctx.fillStyle = '#fff6c8'; ctx.fillRect(0, 0, W, H); }
    ctx.globalAlpha = base;
  }
  // The map, as a row of the MAP tab is fitted: a line of light sweeps down it and its border is lit.
  map(game, ctx, x, y, w, h) {
    if (this.sweep <= 0) return;
    const u = 1 - this.sweep / 0.5, row = Math.round(y + u * h), base = ctx.globalAlpha;
    ctx.fillStyle = '#5cc4f0';
    for (let k = 0; k < 4; k++) { if (row - k < y || row - k >= y + h) continue; ctx.globalAlpha = base * 0.6 * (1 - k / 4); ctx.fillRect(x, row - k, w, 1); }
    ctx.globalAlpha = base * 0.8 * (1 - u);
    ctx.fillRect(x - 2, y - 2, w + 4, 1); ctx.fillRect(x - 2, y + h + 1, w + 4, 1); ctx.fillRect(x - 2, y - 2, 1, h + 4); ctx.fillRect(x + w + 1, y - 2, 1, h + 4);
    ctx.globalAlpha = base;
  }
  // Whether a row's new value is stamped where its steps are written: the shop leaves its own words out meanwhile.
  stamps(tab, id) { return this.moment.t > 0 && this.moment.tab === tab && this.moment.id === id; }
  // The moment in the shop, drawn over its rows: the bought row's picture lit white, a ring and sparks out of it,
  // its new value stamped in, and for a milestone a light run once round the panel's edge (below its header,
  // where the tabs are). Nothing of it is drawn above the header's line.
  panel(game, ctx, px, py, pw, ph, rh, tab) {
    const m = this.moment, base = ctx.globalAlpha;
    if (m.t > 0 && m.tab === tab.id) {
      const age = MOMENT - m.t, y = py + 20 + m.row * rh, vx = px + 7, vy = y + Math.floor((rh - 17) / 2), cx = vx + 8, cy = vy + 8;
      if (m.fresh) {
        m.fresh = false;
        const c = col(m.colour);
        for (let n = 0; n < (m.grand ? 16 : 8); n++) { const a = this.rnd() * 6.283, v = 30 + this.rnd() * 50; this.emit(this.panelPool, cx, cy, Math.cos(a) * v, Math.sin(a) * v, 0.3 + this.rnd() * 0.3, 60, n & 1 ? WHITE_CI : c, this.rnd() < 0.33 ? STAR : SPARK); }
      }
      ctx.globalCompositeOperation = 'lighter';
      if (age < 0.2) { ctx.globalAlpha = base * 0.8 * (1 - age / 0.2); ctx.fillStyle = '#ffffff'; ctx.fillRect(vx, vy, 16, 16); }
      if (age < 0.3) {
        const u = age / 0.3, rad = 3 + 11 * (1 - (1 - u) * (1 - u)), n = Math.max(12, (rad * 1.6) | 0);
        ctx.globalAlpha = base * (1 - u); ctx.fillStyle = m.colour;
        for (let a = 0; a < n; a++) { const ry = Math.round(cy + Math.sin(a / n * 6.283) * rad); if (ry >= py + 20) ctx.fillRect(Math.round(cx + Math.cos(a / n * 6.283) * rad), ry, 1, 1); }
      }
      if (m.grand && age < 0.5) {
        // (Round the panel below the header: down its left side, along its foot, up its right side, and back
        // along the header's line.)
        const top = py + 20, side = ph - 20, all = 2 * side + 2 * pw, at = (age / 0.5) * all;
        ctx.fillStyle = m.colour; ctx.globalAlpha = base * 0.9;
        for (let k = 0; k < 6; k++) {
          let s = (at - k + all) % all, ex, ey;
          if (s < side) { ex = px + 1; ey = top + s; } else if ((s -= side) < pw) { ex = px + s; ey = top + side - 2; } else if ((s -= pw) < side) { ex = px + pw - 2; ey = top + side - s; } else { ex = px + pw - (s - side); ey = top; }
          ctx.fillRect(Math.round(ex), Math.round(ey), 1, 1);
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = base;
      // (Twice the size, shadow and all, only where that ends within the line: on the narrowest phone a long name
      // and a long value, TROPHY LINE's 2 SPEC, would run past the panel and the screen, and are stamped as drawn.)
      const sx = px + 31 + textWidth(ROW[m.id].name), big = age < STAMP && sx + 2 * textWidth(m.stamp) + 2 <= px + pw - 6;
      text(ctx, m.stamp, sx, y + 2 - (big ? 5 : 0), '#ffe14a', 0, big ? 2 : 1);
    }
    ctx.globalCompositeOperation = 'lighter';
    this.drawPool(ctx, this.panelPool, 0, 0, game.W, game.H);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = base;
  }
}
// (Where a part is, handed back without making anything: the fitter's own pair. And a line with no dashes.)
const SPOT = new Float64Array(2), NO_DASH = [];
