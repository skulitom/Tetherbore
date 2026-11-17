// The creatures of the ground: small things that live in the caves of each ground and do as they do.
//
// They come in two tiers. KIN are only to be looked at: a pebble beetle that tucks into a ball, a salamander that
// basks by lava that sleeps behind the wall, frogs that fall quiet where pods hang, skinks that bolt a beat before an
// arc, the hive's bees and the drift's jellies. NAMED creatures each have one job. Friends help: the burrowpup
// (fed three crushed ores near it, it follows the drill as a pal, warns of foes and pulls a leech off), lumen
// moths (they fly a little way ahead of the lamp and light it), the prospector wren (it leads the eye to a find
// nobody has seen), the puffling (a living thing the tether goes round is caught, and pays) and the lantern
// newt (it lights the grotto's caps). Three foes threaten, each in its own way, each with a warning drawn over the
// dark and a moment after in which a ram drives it off: the cinder bat knocks, the cave leech slows, the rime
// spitter blocks. Two rules are all a player need learn: eyes that shine in the dark are trouble (only a foe's do,
// in FOE_EYE, a colour nothing else in the game is drawn in), and anything alive the tether goes round is caught.
//
// Where they live. Dens lie on two grids of sectors counted from the core, by the seed's hash alone (salts 800 to
// 807 on the seed, which nothing else uses): a named den in a share of the sectors DEN cells across, a den of kin
// in a share of those KIN across. What lives in a den is its ground's (`ROSTER`, by the ground's name: a strain or a
// deep flank its own, a cross its host's with the donor's kin lent to one den in three, a row a test makes its
// direction's). A den is found a home in the ground only once that ground has been seen: the nearest open cell to
// its middle that the seed left open (no tunnel), that suits what lives there (a floor, a ceiling, the air). Nothing
// lives within CALM cells of the core; no foe lives within FOE_FROM, in a pocket or in the home ground; a pocket's
// creatures never leave it and nothing else ever goes into one.
//
// What must stay true:
//   - It never draws from Math.random: it has a generator of its own seeded from the world's seed, and the seed's
//     hash. It never writes the game's particles, rings, effects, popups, shake or flash for what is only seen: its
//     particles are its own, a pool of POOL made once, and its rings and words are its own.
//   - It reads the world only where it has been seen (`peek`, and a seen cell's own ground), and asks the seed what a
//     cell was (`first`) only of a cell that is a den's home already chosen; it makes no piece of the world. Its own
//     line of sight counts ground not seen as rock.
//   - It changes the game only through its deeds (`deed`): a bat's knock, a spitter's chill and its plug of ice, a
//     leech's drag, the wren's showing of a find, the puffling's pay, the newt's lit cap, and what is kept of them
//     (`S.fauna`). With `tame` the deeds do nothing, and a game with its creatures tame plays exactly as one with
//     none (test/regress/s8-fauna.mjs); with `off` no den wakes and nothing is drawn (test/harness.mjs sets it).
//   - What it keeps is in arrays made once, a creature a slot (FAUNA of them, NAMED at most of a tier above kin);
//     nothing it does in a frame makes an object. What it looks at in a frame is counted (`work`) and bounded.
//   - Everything is begun again with the game (`reset`, from `Game.begin`): a new world, a game loaded, a trip lost.
//     Only the pal, which is saved, is set down again beside the drill.
//   - Its sounds are a section of their own in js/audio.js (`voices`), soft and few: those that are only the life of
//     the place one in AMBIENT seconds at the most, within HEAR cells, and none while anything that matters sounds;
//     a warning (a bat's chitter and screech, a spitter's wheeze, a leech's drips, the pal's yip) is kept apart only
//     by its own least gap, for it is what the player plays by.
import { N, C, K, rowOf, hazOf, cellHash } from './world.js';
import { sheets, tinted, text, textWidth } from './atlas.js';
import { voices } from './audio.js';
import { income, round2, FOUND, FINDER } from './shop.js';

const T = 16;                                   // pixels in a cell, as js/drawing.js has it
export const CALM = 40;                         // within this many cells of the core nothing lives
export const FOE_FROM = 250;                    // and no foe within this many
export const FAUNA = 16, NAMED = 8;             // the most creatures alive at once, and of those the most above kin
export const POOL = 48, SPOTS = 6;              // its particles and its rings
export const DEN = 48, KIN = 16;                // the sides of the two grids of dens, in cells
export const DEN_SHARE = 0.35, KIN_SHARE = 0.3; // the share of sectors that hold a den
export const DENS = 96;                         // the most dens it knows at once
export const SPENT = 600, QUIET = 120;          // seconds of play a den stays spent (its job done), and quiet (driven off)
export const WORK = 600;                        // the most cells it looks at in a frame to find dens a home
export const HEAR = 10, AMBIENT = 1.5;          // how far a creature is heard, in cells; the least time between two of its sounds by themselves
export const RUSH = 1.15;                       // a drill rushes at this many times its own flying speed, over a long run
export const FOE_EYE = '#ff2bd6';               // the colour of a foe's eyes and of every warning a foe gives
const SALT = 800;
// Each creature's figures:
export const PUP = { feed: 3, near: 3, follow: 2.5, ride: 10, alight: 6, stuck: 1.5, behind: 12, warn: 10, pull: 2 };
export const MOTH = { ahead: [6, 8.5], call: 10, still: 1, ore: 8, bell: 12, scatter: 20, shy: 2, leave: 40, power: 0.6, reach: 4 };
export const SPITTER = { range: 7, puff: 0.9, lock: 0.7, flight: 0.5, lead: 0.5, sag: 1.5, cool: 4, chill: 0.35, hit: 0.6, keep: 1.5, sleep: 10 };
export const BAT = { near: 4, cut: 3, hear: 8, fuse: 0.7, stagger: 0.25, lock: 0.25, speed: 14, run: 10, hit: 0.6, rest: 2.5, again: 8 };
export const LEECH = { under: 0.6, below: [1, 4], slow: 6, tell: 0.5, fall: 0.4, latch: 0.9, drag: 0.75, slurp: 2, fast: 12, shake: 0.6, most: 10 };
export const WREN = { call: 10, find: 24, peck: 1.6 };
export const PUFF = { speed: 0.8, loop: 4, drill: 12, lump: 6, gems: 3 };
export const NEWT = { caps: 3, every: 4, find: 8, tongue: 2 };
export const RAM = 0.6, RAM_SPEED = 3;
const STEP = 0.3;                               // how near the edge of a step, in cells, a creature on a floor goes up or down it          // how near the drill must come to a foe at rest to drive it off, and how fast

// ---------------------------------------------------------------- who they are
// tier: 'kin' (only seen), 'friend', 'foe'; place: where it lives (`floor`: on a floor; `ceil`: hung from a
// ceiling; `air`: flying); n: how many to a den; color: the colour its name comes up in.
export const CREATURES = [null,
  { key: 'beetle', name: 'PEBBLE BEETLE', tier: 'kin', place: 'floor', n: [1, 2], color: '#c8b8a0' },
  { key: 'pup', name: 'BURROWPUP', tier: 'friend', place: 'floor', n: [1, 1], color: '#ecd0b0' },
  { key: 'moth', name: 'LUMEN MOTH', tier: 'friend', place: 'air', n: [2, 3], color: '#e8f2ff' },
  { key: 'spitter', name: 'RIME SPITTER', tier: 'foe', place: 'floor', n: [1, 1], color: '#d0ccdc' },
  { key: 'salamander', name: 'EMBER SALAMANDER', tier: 'kin', place: 'floor', n: [1, 2], color: '#b0a0b0' },
  { key: 'bat', name: 'CINDER BATS', tier: 'foe', place: 'ceil', n: [2, 4], color: '#a898c0' },
  { key: 'frog', name: 'MIRE FROG', tier: 'kin', place: 'floor', n: [1, 2], color: '#b4a47a' },
  { key: 'puff', name: 'PUFFLING', tier: 'friend', place: 'air', n: [1, 1], color: '#f4dcc4' },
  { key: 'leech', name: 'CAVE LEECH', tier: 'foe', place: 'ceil', n: [1, 3], color: '#b48aa0' },
  { key: 'skink', name: 'SAND SKINK', tier: 'kin', place: 'floor', n: [1, 3], color: '#ecd09a' },
  { key: 'wren', name: 'PROSPECTOR WREN', tier: 'friend', place: 'floor', n: [1, 1], color: '#ecd8b4' },
  { key: 'bee', name: 'NURSE BEES', tier: 'kin', place: 'air', n: [4, 6], color: '#f2e4b8' },
  { key: 'jelly', name: 'STAR JELLIES', tier: 'kin', place: 'air', n: [2, 3], color: '#d8c8f0' },
  { key: 'newt', name: 'LANTERN NEWT', tier: 'friend', place: 'floor', n: [1, 1], color: '#f0e8a8' },
];
const ID = Object.fromEntries(CREATURES.slice(1).map((c, n) => [c.key, n + 1]));
export const KINDS = CREATURES.length - 1;
const [BEETLE, PUPS, MOTHS, SPITTERS, SALAMANDER, BATS, FROG, PUFFS, LEECHES, SKINK, WRENS, BEE, JELLY, NEWTS] = CREATURES.slice(1).map((c, n) => n + 1);

// What lives in each ground, by its name: `kin`, what may live in a den of the kin's grid; `named`, in a den of the
// named grid; each [creature, share], the shares of a list coming to 1. A foe is passed over for the next in its list
// in a den nearer the core than FOE_FROM. `dense` is how many times the usual share of sectors hold a named den.
export const ROSTER = {
  crust: { kin: [[BEETLE, 1]], named: [[PUPS, 1]] },
  frost: { named: [[MOTHS, 1]] }, firn: { named: [[MOTHS, 1]] },
  serac: { named: [[SPITTERS, 0.45], [MOTHS, 0.55]] }, rime: { named: [[SPITTERS, 0.5], [MOTHS, 0.5]] },
  ember: { kin: [[SALAMANDER, 1]] }, scoria: { kin: [[SALAMANDER, 1]] }, forge: { kin: [[SALAMANDER, 1]], named: [[BATS, 1]] }, magma: { kin: [[SALAMANDER, 1]], named: [[BATS, 1]] },
  mire: { kin: [[FROG, 1]], named: [[PUFFS, 1]] }, tangle: { kin: [[FROG, 1]], named: [[LEECHES, 0.25], [PUFFS, 0.75]] },
  sporefall: { kin: [[FROG, 1]], named: [[LEECHES, 0.5], [PUFFS, 0.5]] }, bloom: { kin: [[FROG, 1]], named: [[LEECHES, 0.5], [PUFFS, 0.5]] },
  lode: { kin: [[SKINK, 1]], named: [[WRENS, 1]] }, redrock: { kin: [[SKINK, 1]], named: [[WRENS, 1]] }, loess: { kin: [[SKINK, 1]] }, gilt: { kin: [[SKINK, 1]], named: [[WRENS, 1]], dense: 2 },
  hive: { kin: [[BEE, 1]] }, drift: { kin: [[JELLY, 1]] }, grotto: { kin: [[NEWTS, 1]] },
};
// The ground whose roster a row with none of its own has: its direction's.
export const KIN_FAUNA = ['crust', 'frost', 'ember', 'mire', 'lode'];
const NONE = { kin: [], named: [], lent: [], dense: 1, pocket: false };
// A ground's creatures, worked out once for each row (and kept by the row itself).
const known = new WeakMap();
export function faunaOf(row) {
  let f = known.get(row);
  if (f) return f;
  if (row.pocket) f = { ...NONE, kin: ROSTER[row.name]?.kin ?? [], pocket: true };
  else if (row.cross) {
    const host = ROSTER[KIN_FAUNA[row.cross.host]] ?? {}, donor = ROSTER[KIN_FAUNA[row.cross.donor]] ?? {};
    f = { ...NONE, kin: host.kin ?? [], named: host.named ?? [], lent: donor.kin ?? [] };
  } else {
    const own = ROSTER[row.name] ?? ROSTER[KIN_FAUNA[row.kin]] ?? {};
    f = { ...NONE, kin: own.kin ?? [], named: own.named ?? [], dense: own.dense ?? 1 };
  }
  known.set(row, f);
  return f;
}
const pick = (list, h) => { let s = 0; for (const [id, share] of list) { s += share; if (h < s) return id; } return list.length ? list[list.length - 1][0] : 0; };

// ---------------------------------------------------------------- the frames
// What a creature is drawn with: by kind and pose, the frame facing east and facing west, and where in each its
// foe eyes are and the pixels it lights (js/atlas.js has them from the build: art/fauna.mjs). Looked up once, when
// the sheet is there.
let FR = null;
const POSES = {
  beetle: ['walk-a', 'walk-b', 'ball-a', 'ball-b', 'ball-c', 'ball-d'], pup: ['idle-a', 'idle-b', 'walk-a', 'walk-b', 'blink', 'yip', 'sniff', 'sleep', 'ride'],
  moth: ['flap-a', 'flap-b', 'flap-c'], spitter: ['sit', 'puff-a', 'puff-b', 'spit', 'sag', 'glob'], salamander: ['walk-a', 'walk-b', 'bask', 'swim'],
  bat: ['hang-a', 'hang-b', 'fly-a', 'fly-b', 'rest'], frog: ['sit', 'croak', 'hop'], puff: ['drift-a', 'drift-b', 'shy', 'caught'],
  leech: ['hang-a', 'hang-b', 'stiff', 'fall', 'latched', 'crawl'], skink: ['walk-a', 'walk-b', 'sun'], wren: ['perch-a', 'perch-b', 'peck', 'fly-a', 'fly-b'],
  bee: ['fly-a', 'fly-b'], jelly: ['bob-a', 'bob-b'], newt: ['walk-a', 'walk-b', 'lick'],
};
// The pose numbers, by name, for each kind (`P.pup.ride` is 8).
export const P = Object.fromEntries(Object.entries(POSES).map(([kind, list]) => [kind, Object.fromEntries(list.map((p, n) => [p.replace('-', '_'), n]))]));
const NO_EYES = [];
// A pixel of a frame (from its top left) where it is drawn turned a quarter `turn` times about its middle, as a
// creature that creeps is on a wall or a ceiling (`footing`).
const turnX = (u, v, turn) => turn === 1 ? 15 - v : turn === 2 ? 15 - u : turn === 3 ? v : u;
const turnY = (u, v, turn) => turn === 1 ? u : turn === 2 ? 15 - v : turn === 3 ? 15 - u : v;
// A moth's wings, down and up again.
const MOTH_FLAP = [P.moth.flap_a, P.moth.flap_b, P.moth.flap_c, P.moth.flap_b];
function frames() {
  if (FR || !sheets.fauna) return FR;
  const s = sheets.fauna;
  FR = CREATURES.map(c => c && POSES[c.key].map(pose => [0, 1].map(left => {
    const name = `${c.key}-${pose}${left ? '-l' : ''}`;
    return { r: s.frames[name], eyes: s.eyes?.[name] ?? NO_EYES, lamps: s.lamps?.[name] ?? NO_EYES };
  })));
  return FR;
}
export const frameName = (kind, pose, left) => `${CREATURES[kind].key}-${POSES[CREATURES[kind].key][pose]}${left ? '-l' : ''}`;

// ---------------------------------------------------------------- the world as it is seen
const openAt = (w, x, y) => w.peek(x, y) === K.EMPTY && !w.lava.has(y * N + x);
const rockAt = (w, x, y) => w.peek(x, y) > 0;
// The row of a cell that has been seen, read from its piece (null for one that has not: no piece is made).
const rowSeen = (w, x, y) => { const p = w.chunks[((y >> 6) << 8) | (x >> 6)], at = ((y & 63) << 6) | (x & 63); return p && p.seen[at] ? p.biome[at] : -1; };
// Is the straight line between two points through open ground that has been seen? (Ground not seen is rock.)
export function clear(w, x0, y0, x1, y1) {
  let cx = Math.floor(x0), cy = Math.floor(y0);
  const ex = Math.floor(x1), ey = Math.floor(y1), dx = x1 - x0, dy = y1 - y0, sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const tdx = dx ? Math.abs(1 / dx) : Infinity, tdy = dy ? Math.abs(1 / dy) : Infinity;
  let tx = dx ? (dx > 0 ? cx + 1 - x0 : x0 - cx) * tdx : Infinity, ty = dy ? (dy > 0 ? cy + 1 - y0 : y0 - cy) * tdy : Infinity;
  for (let guard = 0; guard < 64; guard++) {
    if (w.peek(cx, cy) !== K.EMPTY) return false;
    if (cx === ex && cy === ey) return true;
    if (tx < ty) { tx += tdx; cx += sx; } else { ty += tdy; cy += sy; }
  }
  return false;
}

// ---------------------------------------------------------------- particles
const DUST = 1, HEART = 2, RIPPLE = 3, PUFFS_P = 4, DRIP = 5, SPLAT = 6, NOTE = 7, SPARK = 8;
const LIT_P = [false, false, true, false, false, false, false, true, true];
const INKS = [], INK = new Map();
const ink = color => { let n = INK.get(color); if (n === undefined) { n = INKS.length; INKS.push(color); INK.set(color, n); } return n; };
const HEART_INK = ink('#ff8aa0'), DUST_INK = ink('#a89880'), ICE_INK = ink('#eef8ff'), SPORE_INK = ink('#f4dcc4'), DRIP_INK = ink('#cab4ca'), EYE_INK = ink(FOE_EYE), LIGHT_INK = ink('#f0e8a8'), WHITE = ink('#ffffff');

// Creature states, shared by name where they mean the same (each kind reads its own few).
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]], BESIDE = [[0, -1], [1, 0], [-1, 0], [0, 1]];
const IDLE = 0, MOVE = 1, BALL = 2, WAKE = 3, TELL = 4, ACT = 5, REST = 6, BACK = 7, AWAY = 8, RIDE = 9, SLEEP = 10, HIDE = 11, SWIM = 12, LATCH = 13, FALL = 14, FLIT = 15, PECK = 16, CAUGHT = 17;

export class Fauna {
  // `fly` is the drill's flying speed (cells a second at the first ram) and `knock` what a bat's knock stuns for
  // (js/game.js: FLY, JOLT.bat).
  constructor(fly = 9, knock = 0.3) {
    this.fly = fly; this.knock = knock;
    this.off = false; this.tame = false;
    // The creatures, a slot each: what each is (0: none), its den, its state and how long it has been in it, how long
    // it has lived, how far it has faded in (0 to 1) and whether it is fading out; where it is (cells: for one on a
    // floor its feet, for one that hangs its top, for one that flies its middle), how fast it goes, where it is going
    // or aims, which way it faces (1 east, -1 west), its own phase, a cell it keeps to, and a count of its own; and
    // for one on a floor, the floor it is stepping from (`crawl`).
    const F = FAUNA;
    this.kind = new Uint8Array(F); this.den = new Int16Array(F); this.st = new Uint8Array(F); this.t = new Float32Array(F); this.age = new Float32Array(F);
    this.fade = new Float32Array(F); this.out = new Uint8Array(F); this.x = new Float32Array(F); this.y = new Float32Array(F); this.vx = new Float32Array(F); this.vy = new Float32Array(F);
    this.ax = new Float32Array(F); this.ay = new Float32Array(F); this.bx = new Float32Array(F); this.by = new Float32Array(F); this.face = new Int8Array(F); this.ph = new Float32Array(F);
    this.cell = new Int32Array(F); this.n = new Int32Array(F); this.unseen = new Float32Array(F); this.slot = new Uint8Array(F); this.dim = new Float32Array(F);
    this.from = new Float32Array(F);
    // Its particles: where, how fast, how long they have been and are to be, what they are and their colour.
    this.px = new Float32Array(POOL); this.py = new Float32Array(POOL); this.pvx = new Float32Array(POOL); this.pvy = new Float32Array(POOL);
    this.pt = new Float32Array(POOL); this.plife = new Float32Array(POOL); this.pk = new Uint8Array(POOL); this.pink = new Uint16Array(POOL);
    // Its rings: x, y (pixels), age, life, reach, colour.
    this.spots = Array.from({ length: SPOTS }, () => new Float32Array(6));
    // The dens it knows, by key, each a record made once and used again (`denOf`); and the dens driven off, by key,
    // with when each may come back.
    this.dens = new Map(); this.spare = Array.from({ length: DENS }, () => this.blank());
    this.quiet = new Map(); this.spentAt = new Map();
    // The lights the creatures give this frame, [x, y, power, reach] (`lights`); and the words it shows: a
    // creature's name the first time it is met, and the pal's warning.
    this.glowing = Array.from({ length: 6 }, () => new Float64Array(4)); this.lit = 0;
    this.words = Array.from({ length: 4 }, () => ({ text: '', x: 0, y: 0, t: 9, life: 1, color: '#ffffff', of: -1 }));
    this.index = []; this.met = new Set(); this.w = null;
    // A search over a Map of the game's (lava woken, crystals charged), asked of each entry by a function made once:
    // who asks, how many it has looked at, and the best found.
    this.q = { x: 0, y: 0, n: 0, far: 0, best: -1 };
    this.nearLava = (left, c) => { const q = this.q; if (q.n++ > 40) return; const e = (c % N + 0.5 - q.x) ** 2 + (Math.floor(c / N) + 0.5 - q.y) ** 2; if (e < q.far) { q.far = e; q.best = c; } };
    this.nearFuse = (spark, c) => { const q = this.q; if (q.best < 0 && spark.fuse > 0 && Math.hypot(c % N + 0.5 - q.x, Math.floor(c / N) + 0.5 - q.y) < 8) q.best = c; };
    this.reset(7, null);
  }
  blank() { return this.clear({}); }
  // A den's record as it is before anything is known of it (made once, and cleared to be used again).
  clear(d) {
    d.key = -1; d.grid = 0; d.sx = 0; d.sy = 0; d.kind = 0; d.row = 0; d.mx = 0; d.my = 0; d.flock = 1; d.anchor = -1; d.tried = -1; d.triedAt = -9; d.live = 0; d.used = 0;
    d.st = 0; d.t = 0; d.hits = 0; d.woke = 0; d.warned = -99; d.lit = 0; d.litAt = -99; d.cool = 0; d.bell = -1; d.bellX = 0; d.bellY = 0; d.staged = false;
    return d;
  }
  // Begun again with the game: everything goes but the pal, which is set down again beside the drill.
  reset(seed, game) {
    this.seed = (Math.imul((seed | 0) + SALT, 2654435761) ^ 0x2545f491) >>> 0; this.world = seed | 0;
    this.kind.fill(0); this.pk.fill(0); for (const s of this.spots) s[3] = 0;
    for (const w of this.words) w.t = 9;
    for (const d of this.dens.values()) { d.key = -1; this.spare.push(d); }
    this.dens.clear(); this.quiet.clear(); this.spentAt.clear(); this.index.length = 0; this.met.clear();
    this.time = 0; this.tick = 0; this.frame = 0; this.work = 0; this.heard = -9; this.drag = 1; this.latched = -1; this.pal = -1;
    this.paid = { grit: 0, gems: [0, 0, 0, 0, 0] }; this.deeds = 0; this.searches = 0;
    this.lastSpeed = 0; this.stillFor = 0; this.fastFor = 0; this.hunt = 0; this.lit = 0;
    if (!game) return;
    const F = game.S.fauna;
    if (F) for (const [key, at] of F.spent ?? []) this.spentAt.set(key, at);
    if (F?.pal && !this.off) this.befriend(game, -1);
  }
  rnd() { return (this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0) / 4294967296; }
  get alive() { let n = 0; for (let i = 0; i < FAUNA; i++) if (this.kind[i]) n++; return n; }
  named() { let n = 0; for (let i = 0; i < FAUNA; i++) if (this.kind[i] && CREATURES[this.kind[i]].tier !== 'kin') n++; return n; }

  // ---------------------------------------------------------------- dens
  // A den's key: its grid (0 named, 1 kin, 2 staged) and its sector, as one number.
  keyOf(grid, sx, sy) { return grid * 16777216 + ((sy + 2048) & 4095) * 4096 + ((sx + 2048) & 4095); }
  // The den of a sector, worked out from the seed alone the first time it is asked and kept: null where there is
  // none. (Full, the den looked at longest ago gives way.)
  denOf(game, grid, sx, sy) {
    const key = this.keyOf(grid, sx, sy);
    let d = this.dens.get(key);
    if (d !== undefined) { d.used = this.frame; return d.kind ? d : null; }
    d = this.spare.pop();
    if (!d) {
      let old = null;
      for (const q of this.dens.values()) if (!q.live && (!old || q.used < old.used)) old = q;
      if (!old) return null;
      this.dens.delete(old.key); d = old;
    }
    this.clear(d);
    d.key = key; d.grid = grid; d.sx = sx; d.sy = sy; d.used = this.frame;
    this.dens.set(key, d);
    this.lay(game, d);
    return d.kind ? d : null;
  }
  // What a den holds, from the seed: where its middle is, whose ground that is, what lives there and how many.
  lay(game, d) {
    const w = game.world, seed = this.world, { grid, sx, sy } = d, side = grid ? KIN : DEN;
    d.kind = 0;
    const h = cellHash(sx, sy, seed + SALT + (grid ? 5 : 0));
    if (h >= (grid ? KIN_SHARE : DEN_SHARE) * 2) return;
    d.mx = C + Math.floor((sx + 0.2 + 0.6 * cellHash(sx, sy, seed + SALT + 1 + grid * 5)) * side);
    d.my = C + Math.floor((sy + 0.2 + 0.6 * cellHash(sx, sy, seed + SALT + 2 + grid * 5)) * side);
    const far = Math.hypot(d.mx - C, d.my - C);
    if (far < CALM) return;
    const row = rowOf(w.biomeAt(d.mx, d.my)), f = faunaOf(row);
    if (h >= (grid ? KIN_SHARE : DEN_SHARE) * (grid ? 1 : f.dense)) return;
    d.row = row.id;
    const k = cellHash(sx, sy, seed + SALT + 3 + grid * 3);
    if (grid) d.kind = f.lent.length && cellHash(sx, sy, seed + SALT + 4) < 1 / 3 ? pick(f.lent, k) : pick(f.kin, k);
    else {
      // (A foe nearer the core than FOE_FROM, or in the home ground, gives way to the next in its list.)
      const list = far >= FOE_FROM && row.id !== 0 ? f.named : f.named.filter(([id]) => CREATURES[id].tier !== 'foe');
      const total = list.reduce((s, [, share]) => s + share, 0);
      d.kind = total > 0 ? pick(list, k * total) : 0;
    }
    if (!d.kind) return;
    const [a, b] = CREATURES[d.kind].n;
    d.flock = a + Math.floor(cellHash(sx, sy, seed + SALT + 7) * (b - a + 1));
  }
  // A home for a den: the open cell nearest its middle, within a few cells of it, that the seed left open (no
  // tunnel) and that suits what lives there; in its own ground (in a pocket, its pocket's; elsewhere, never a
  // pocket's). Only cells seen are looked at. -1 where there is none yet.
  home(game, d, x0 = d.mx, y0 = d.my, most = d.grid ? 6 : 10, natural = true, least = 0) {
    const w = game.world, c = CREATURES[d.kind], pocket = rowOf(d.row).pocket !== null, game0 = game;
    for (let r = least; r <= most; r++) for (let v = -r; v <= r; v++) for (let u = -r; u <= r; u++) {
      if (Math.max(Math.abs(u), Math.abs(v)) !== r) continue;
      const x = x0 + u, y = y0 + v, i = y * N + x;
      if (++this.work > WORK * 2) return -1;
      if (!openAt(w, x, y)) continue;
      const b = rowSeen(w, x, y);
      if (pocket ? b !== d.row : b < 0 || rowOf(b).pocket !== null) continue;
      if (Math.hypot(x - C, y - C) < (natural ? CALM : 4)) continue;
      if (!this.suits(game0, d.kind, x, y, c.place)) continue;
      if (natural && w.first(i) !== K.EMPTY) continue;
      return i;
    }
    return -1;
  }
  // Whether a cell suits a creature to live in: its place, and what each wants of what is about it.
  suits(game, kind, x, y, place) {
    const w = game.world;
    if (place === 'floor' && !rockAt(w, x, y + 1)) return false;
    if (place === 'ceil' && (!rockAt(w, x, y - 1) || !openAt(w, x, y + 1) || !openAt(w, x, y + 2))) return false;
    if (place === 'air' && (!openAt(w, x + 1, y) && !openAt(w, x - 1, y))) return false;
    if (kind === SALAMANDER) return this.near(game, x, y, 4, 'lava') >= 0;
    if (kind === FROG) return this.near(game, x, y, 4, 'spore') < 0;
    if (kind === SKINK) return this.near(game, x, y, 3, 'spark') < 0;
    if (kind === LEECHES) return openAt(w, x, y + 3);
    return true;
  }
  // The nearest seen hazard of a type within `r` cells of (x, y), or -1.
  near(game, x, y, r, type) {
    const w = game.world;
    let best = -1, far = Infinity;
    for (let v = -r; v <= r; v++) for (let u = -r; u <= r; u++) {
      const k = w.peek(x + u, y + v);
      this.work++;
      if (k !== K.HAZARD && k !== K.HAZARD2) continue;
      const b = rowSeen(w, x + u, y + v);
      if (b < 0 || hazOf(k, rowOf(b)) !== type || u * u + v * v >= far) continue;
      far = u * u + v * v; best = (y + v) * N + x + u;
    }
    return best;
  }
  // Is a den spent (its job done within SPENT seconds of play) or driven off (within QUIET seconds)?
  resting(game, d) {
    const spent = this.spentAt.get(d.key);
    if (spent !== undefined && game.S.stats.time - spent < SPENT) return true;
    const q = this.quiet.get(d.key);
    return q !== undefined && this.time < q;
  }

  // ---------------------------------------------------------------- a frame
  // With the shop or the lab open the creatures only breathe: they fade, and nothing else changes.
  idle(game, dt) {
    if (this.off) return;
    this.time += dt;
    for (let i = 0; i < FAUNA; i++) if (this.kind[i]) {
      this.age[i] += dt;
      // (The pal sleeps on the core while the shop is open.)
      if (i === this.pal && game.atCore) { this.st[i] = SLEEP; this.x[i] = C + 0.5 - 2.2; this.y[i] = C + 2; this.face[i] = 1; }
    }
    this.particles(dt);
  }
  step(game, dt) {
    if (this.off) return;
    const w = this.w = game.world, d = game.drill;
    this.frame++; this.time += dt; this.work = 0; this.searches = 0;
    const speed = Math.hypot(d.vx, d.vy), base = this.fly * game.val('momentum');
    this.speed = speed;
    this.rush = d.mode === 'fling' || (speed > base * RUSH && (d.run > 1 || game.boost > 0));
    this.stillFor = speed < 0.5 ? this.stillFor + dt : 0;
    // Every half second: the dens about the view, found a home and woken, and what each creature is near.
    this.tick -= dt;
    if (this.tick <= 0) { this.tick = 0.5; this.wake(game); }
    this.drag = 1;
    for (let i = 0; i < FAUNA; i++) {
      const k = this.kind[i];
      if (!k) continue;
      this.age[i] += dt; this.t[i] += dt;
      this.fade[i] = this.out[i] ? this.fade[i] - dt * 2.5 : Math.min(1, this.fade[i] + dt * 2.5);
      if (this.out[i] && this.fade[i] <= 0) { this.drop(i); continue; }
      // Out of view for long, or far from its den, it goes (but the pal).
      const sx = (this.x[i] * T - game.cam.x) / (game.W / 2), sy = (this.y[i] * T - game.cam.y) / (game.H / 2), seen = Math.abs(sx) < 1.1 && Math.abs(sy) < 1.1;
      this.unseen[i] = seen ? 0 : this.unseen[i] + dt;
      if (i !== this.pal && i !== this.latched) {
        const den = this.denAt(i), kin = CREATURES[k].tier === 'kin';
        const away = kin ? Math.max(Math.abs(this.x[i] * T - game.cam.x) - game.W / 2, Math.abs(this.y[i] * T - game.cam.y) - game.H / 2) > 14 * T
          : den && Math.hypot(this.x[i] - den.mx, this.y[i] - den.my) > 40;
        if (away || this.unseen[i] > 5) { this.drop(i); continue; }
      }
      switch (k) {
        case BEETLE: this.beetle(game, i, dt); break;
        case PUPS: this.pup(game, i, dt); break;
        case MOTHS: this.moth(game, i, dt); break;
        case SPITTERS: this.spitter(game, i, dt); break;
        case SALAMANDER: this.salamander(game, i, dt); break;
        case BATS: this.bat(game, i, dt); break;
        case FROG: this.frog(game, i, dt); break;
        case PUFFS: this.puff(game, i, dt); break;
        case LEECHES: this.leech(game, i, dt); break;
        case SKINK: this.skink(game, i, dt); break;
        case WRENS: this.wren(game, i, dt); break;
        case BEE: this.bee(game, i, dt); break;
        case JELLY: this.jelly(game, i, dt); break;
        case NEWTS: this.newt(game, i, dt); break;
      }
    }
    // Ground that changed under a creature: one whose cell has closed, or whose floor or ceiling is gone, goes.
    if (game.version !== this.v) { this.v = game.version; this.settle(game); }
    this.particles(dt);
    for (const s of this.spots) if (s[3] > 0) { s[2] += dt; if (s[2] >= s[3]) s[3] = 0; }
    for (const wd of this.words) wd.t += dt;
  }
  // The dens about the view: each found a home (two a frame at the most), and woken where nothing stands against it.
  wake(game) {
    const d = game.drill, w = game.world, cx = game.cam.x / T, cy = game.cam.y / T, hw = game.W / T / 2 + 6, hh = game.H / T / 2 + 6;
    for (let grid = 0; grid < 2; grid++) {
      const side = grid ? KIN : DEN;
      for (let sy = Math.floor((cy - hh - C) / side) - 1; sy <= Math.floor((cy + hh - C) / side); sy++) for (let sx = Math.floor((cx - hw - C) / side) - 1; sx <= Math.floor((cx + hw - C) / side); sx++) {
        const den = this.denOf(game, grid, sx, sy);
        if (!den || den.live) continue;
        if (den.anchor < 0) {
          if (this.searches >= 2 || this.work >= WORK || (den.tried === game.version && this.time - den.triedAt < 5) || this.time - den.triedAt < 1) continue;
          this.searches++; den.tried = game.version; den.triedAt = this.time;
          den.anchor = this.home(game, den);
          if (den.anchor < 0) continue;
        }
        const ax = den.anchor % N, ay = Math.floor(den.anchor / N);
        if (Math.abs(ax + 0.5 - cx) > hw || Math.abs(ay + 0.5 - cy) > hh || this.resting(game, den)) continue;
        // (The den's home may have changed since it was found: it is looked at again before anything is born there.)
        if (!openAt(w, ax, ay) || !this.suits(game, den.kind, ax, ay, CREATURES[den.kind].place)) { den.anchor = -1; continue; }
        const c = CREATURES[den.kind];
        if (this.alive + den.flock > FAUNA || (c.tier !== 'kin' && this.named() + den.flock > NAMED)) continue;
        if (c.tier === 'foe' && Math.hypot(ax - C, ay - C) < FOE_FROM) continue;
        // (The pup that is the pal is not born again in its own den.)
        if (den.kind === PUPS && this.pal >= 0) continue;
        this.populate(game, den);
      }
    }
    if (this.pal >= 0) this.warnings(game);
    this.meet(game);
    // A rime bell that has been seen (it is marked: `S.marks`) within MOTH.bell cells of a den of moths.
    for (let i = 0; i < FAUNA; i++) {
      const den = this.kind[i] === MOTHS && this.slot[i] === 0 ? this.denAt(i) : null;
      if (!den) continue;
      den.bell = -1;
      for (let m = 0; m < game.S.marks.length; m++) {
        const c = game.S.marks[m][0], k = game.S.marks[m][1], x = c % N, y = Math.floor(c / N), b = rowSeen(w, x, y);
        if (k !== K.RARE || w.peek(x, y) !== K.RARE || b < 0 || hazOf(K.RARE, rowOf(b)) !== 'bell' || Math.hypot(x - this.x[i], y - this.y[i]) > MOTH.bell) continue;
        den.bell = c; den.bellX = x + 0.5; den.bellY = y + 0.5;
      }
    }
  }
  // The creatures of a den, born about its home: on a floor or a ceiling along it either way, in the air about it.
  populate(game, den) {
    const w = game.world, c = CREATURES[den.kind], ax = den.anchor % N, ay = Math.floor(den.anchor / N);
    den.st = 0; den.t = 0; den.hits = 0; den.lit = 0;
    for (let n = 0; n < den.flock; n++) {
      let x = ax, y = ay;
      if (n) {
        const way = n % 2 ? 1 : -1, steps = Math.ceil(n / 2) * (c.place === 'air' ? 1 : 2);
        for (let s = 0; s < steps; s++) {
          const nx = x + way;
          if (!openAt(w, nx, y) || !this.ours(w, den, nx, y) || (c.place === 'floor' && !rockAt(w, nx, y + 1)) || (c.place === 'ceil' && !rockAt(w, nx, y - 1))) break;
          x = nx;
        }
      }
      const i = this.spawn(den.kind, x, y, den);
      if (i >= 0) { this.slot[i] = n; den.live++; }
    }
  }
  // A creature in a free slot at cell (x, y), as its place stands it there: its slot, or -1.
  spawn(kind, x, y, den) {
    let i = -1;
    for (let n = 0; n < FAUNA; n++) if (!this.kind[n]) { i = n; break; }
    // (Never more above kin than NAMED, whatever sets them down.)
    if (i < 0 || (CREATURES[kind].tier !== 'kin' && this.named() >= NAMED)) return -1;
    const place = CREATURES[kind].place;
    this.kind[i] = kind; this.den[i] = den ? this.denIndex(den) : -1; this.st[i] = IDLE; this.t[i] = this.rnd() * 2; this.age[i] = 0;
    this.fade[i] = 0; this.out[i] = 0; this.x[i] = x + 0.5; this.y[i] = place === 'floor' ? y + 1 : place === 'ceil' ? y : y + 0.5;
    this.vx[i] = 0; this.vy[i] = 0; this.ax[i] = this.x[i]; this.ay[i] = this.y[i]; this.bx[i] = this.x[i]; this.by[i] = this.y[i];
    this.face[i] = this.rnd() < 0.5 ? 1 : -1; this.ph[i] = this.rnd() * 6.283; this.cell[i] = y * N + x; this.n[i] = 0; this.unseen[i] = 0; this.slot[i] = 0; this.dim[i] = 0; this.from[i] = this.y[i];
    return i;
  }
  // Dens are kept by key in a Map; a creature holds its den as a small number, the den's place in `index`.
  denIndex(den) { let n = this.index.indexOf(den); if (n < 0) { n = this.index.indexOf(null); if (n < 0) { n = this.index.length; this.index.push(den); } else this.index[n] = den; } return n; }
  denAt(i) { const n = this.den[i]; return n >= 0 ? this.index[n] ?? null : null; }
  drop(i) {
    const den = this.denAt(i);
    if (den) {
      den.live = Math.max(0, den.live - 1);
      let still = false;
      for (let j = 0; j < FAUNA; j++) if (j !== i && this.kind[j] && this.den[j] === this.den[i]) still = true;
      if (!still) this.index[this.den[i]] = null;
    }
    if (i === this.pal) this.pal = -1;
    if (i === this.latched) this.latched = -1;
    this.kind[i] = 0; this.den[i] = -1;
    // (A bat gone from a roost still woken: the rest may be home already.)
    if (den && den.kind === BATS) this.settled(den);
  }
  leave(i) { this.out[i] = 1; }
  // Ground that changed: a creature whose cell is rock now (frost or moss closed over it, ice was laid on it, lava
  // came into it), or whose floor or ceiling has gone (hauled away, cut), goes in a puff of dust.
  settle(game) {
    const w = game.world;
    for (let i = 0; i < FAUNA; i++) {
      const k = this.kind[i];
      if (!k || this.out[i] || i === this.latched || (i === this.pal && this.st[i] === RIDE)) continue;
      const st = this.st[i], at = this.where(i), x = Math.floor(this.x[i]), y = Math.floor(this.mid(i));
      if (st === SWIM || st === FALL || st === ACT || st === FLIT || st === AWAY || st === HIDE) continue;
      const ok = openAt(w, x, y) && (at === 2 || (at === 0 ? rockAt(w, x, y + 1) : rockAt(w, x, y - 1)));
      if (!ok) { this.leave(i); this.puff2(this.x[i] * T, (this.y[i] - 0.3) * T, DUST, DUST_INK, 5); if (i === this.pal) this.pop(game, i); }
    }
  }

  // ---------------------------------------------------------------- moving
  // On a floor: along it, a cell at a time, up or down a step where the floor steps. Returns false where it can go
  // no further that way (it has turned round). A step is taken at the edge between the two cells, so that it never
  // cuts through the corner of the rock: down, it walks off the ledge and drops within STEP of a cell past the edge;
  // up, it climbs within STEP of a cell before it.
  crawl(game, i, speed, dt, any = false) {
    const w = game.world, x = Math.floor(this.x[i]), y = Math.floor(this.y[i] - 0.5), f = this.face[i];
    const goal = this.ax[i];
    if (Math.abs(goal - this.x[i]) > 0.02) {
      const s = Math.sign(goal - this.x[i]);
      this.x[i] += s * Math.min(Math.abs(goal - this.x[i]), speed * dt);
      const rise = this.ay[i] - this.from[i], past = (this.x[i] - (Math.floor(goal) + (s > 0 ? 0 : 1))) * s;
      const u = rise > 0 ? past / STEP : rise < 0 ? 1 + past / STEP : 1;
      this.y[i] = this.from[i] + rise * Math.max(0, Math.min(1, u));
      return true;
    }
    this.y[i] = this.from[i] = this.ay[i];
    const floor = (u, v) => openAt(w, u, v) && (rockAt(w, u, v + 1) || (any && (rockAt(w, u, v - 1) || rockAt(w, u + 1, v) || rockAt(w, u - 1, v))));
    this.work += 4;
    let nx = x + f, ny = y;
    if (floor(nx, y)) ny = y;
    else if (floor(nx, y - 1) && openAt(w, x, y - 1)) ny = y - 1;
    else if (openAt(w, nx, y) && floor(nx, y + 1)) ny = y + 1;
    else { this.face[i] = -f; return false; }
    // (A creature of the ground never steps into a pocket, nor one of a pocket out of it.)
    if (!this.mine(i, nx, ny)) { this.face[i] = -f; return false; }
    this.ax[i] = nx + 0.5; this.ay[i] = ny + 1; this.cell[i] = ny * N + nx;
    return true;
  }
  // In the air: easing toward (tx, ty) at up to `speed` cells a second, turned back by rock (seen ground only) and
  // by the edge of a pocket, either way.
  steer(game, i, tx, ty, speed, dt, ease = 2) {
    const w = game.world, dx = tx - this.x[i], dy = ty - this.y[i], len = Math.hypot(dx, dy) || 1, want = Math.min(speed, len * 2.5);
    this.vx[i] += (dx / len * want - this.vx[i]) * Math.min(1, dt * ease); this.vy[i] += (dy / len * want - this.vy[i]) * Math.min(1, dt * ease);
    const nx = this.x[i] + this.vx[i] * dt, ny = this.y[i] + this.vy[i] * dt;
    this.work += 2;
    if (this.free(i, Math.floor(nx), Math.floor(this.y[i]))) this.x[i] = nx; else this.vx[i] *= -0.4;
    if (this.free(i, Math.floor(this.x[i]), Math.floor(ny))) this.y[i] = ny; else this.vy[i] *= -0.4;
    if (Math.abs(this.vx[i]) > 0.3) this.face[i] = this.vx[i] > 0 ? 1 : -1;
  }
  // How a creature stands now: 0 on a floor (its feet at y), 1 hung from a ceiling (its top at y), 2 in the air (its
  // middle at y); where its middle is; the top of its frame, in pixels; and how far it is from the drill.
  where(i) {
    const k = this.kind[i], st = this.st[i];
    if (k === BATS) return st === IDLE ? 1 : 2;
    if (k === LEECHES) return st === IDLE || st === TELL ? 1 : st === AWAY ? 0 : 2;
    if (k === WRENS) return st === FLIT || st === AWAY ? 2 : 0;
    const place = CREATURES[k].place;
    return place === 'floor' ? 0 : place === 'ceil' ? 1 : 2;
  }
  mid(i) { const at = this.where(i); return this.y[i] + (at === 0 ? -0.5 : at === 1 ? 0.5 : 0); }
  top(i) { const at = this.where(i); return this.y[i] * T - (at === 0 ? 16 : at === 1 ? 0 : 8); }
  dist(game, i) { return Math.hypot(game.drill.x - this.x[i], game.drill.y - this.mid(i)); }
  set(i, st) { this.st[i] = st; this.t[i] = 0; }

  // ---------------------------------------------------------------- each creature
  // The pebble beetle trundles along the floor; the drill within three cells, it tucks into a ball and rolls away
  // down the floor, and uncurls.
  beetle(game, i, dt) {
    const st = this.st[i], near = this.dist(game, i);
    if (st === IDLE || st === MOVE) {
      if (near < 3) { this.face[i] = game.drill.x > this.x[i] ? -1 : 1; this.set(i, BALL); this.voice(game, i, 'tick', false); return; }
      if (st === IDLE && this.t[i] > 2.5) this.set(i, MOVE);
      if (st === MOVE) { this.crawl(game, i, 0.7, dt); if (this.t[i] > 3 + this.ph[i]) this.set(i, IDLE); }
    } else if (st === BALL) { this.crawl(game, i, 3, dt); if (this.t[i] > 0.7) this.set(i, REST); }
    else if (st === REST && this.t[i] > 0.6) this.set(i, IDLE);
  }
  // The burrowpup. Wild, it potters along the floors of the home ground, and keeps away from a drill in a hurry.
  // Ore crushed beside it is a feeding; three at one meeting, and it is the pal (`crushed`).
  pup(game, i, dt) {
    if (i === this.pal) return this.palStep(game, i, dt);
    const st = this.st[i], d = game.drill, near = this.dist(game, i);
    if (st === WAKE && this.t[i] < 0.6) return;                                     // (sniffing what it was given)
    if (near < PUP.near && this.speed > 6) { this.face[i] = d.x > this.x[i] ? -1 : 1; this.crawl(game, i, 2.2, dt); return; }
    if (st === IDLE && this.t[i] > 2 + this.ph[i] % 2) this.set(i, MOVE);
    else if (st === MOVE) { this.crawl(game, i, 0.9, dt); if (this.t[i] > 2.5) this.set(i, IDLE); }
    else if (st === WAKE) this.set(i, IDLE);
  }
  palStep(game, i, dt) {
    const w = game.world, d = game.drill, st = this.st[i], fast = this.speed > PUP.ride || d.mode !== 'free';
    if (st === SLEEP) { this.set(i, RIDE); }
    if (this.st[i] === RIDE) {
      this.x[i] = d.x; this.y[i] = d.y;
      if (!fast && this.speed < PUP.alight && this.t[i] > 0.5 && d.mode === 'free') this.alight(game, i);
      return;
    }
    if (fast) { this.set(i, RIDE); this.x[i] = d.x; this.y[i] = d.y; return; }
    const near = Math.hypot(d.x - this.x[i], d.y - (this.y[i] - 0.5));
    if (near > PUP.behind || this.n[i] > PUP.stuck) { this.n[i] = 0; this.pop(game, i); return; }
    if (st === WAKE) { if (this.t[i] < 0.6) return; this.set(i, IDLE); }            // (yipping)
    this.face[i] = d.x > this.x[i] ? 1 : -1;
    if (near > PUP.follow) {
      const was = this.x[i], went = this.crawl(game, i, 2.6, dt);
      this.n[i] = went && Math.abs(this.x[i] - was) > 1e-4 ? 0 : this.n[i] + dt;
      if (!went) this.face[i] = d.x > this.x[i] ? 1 : -1;
      if (this.st[i] !== MOVE) this.set(i, MOVE);
    } else { this.n[i] = 0; if (this.st[i] === MOVE) this.set(i, IDLE); }
  }
  // Off the drill, on to the nearest floor beside it.
  alight(game, i) {
    const at = this.floorBy(game, game.drill.x, game.drill.y, 3);
    if (at < 0) return;
    this.x[i] = this.ax[i] = at % N + 0.5; this.y[i] = this.ay[i] = Math.floor(at / N) + 1; this.cell[i] = at;
    this.set(i, IDLE); this.fade[i] = 0.4;
  }
  // Stuck or left behind, the pal comes up out of the rock beside the drill: the rock ripples where it went down and
  // where it comes up, and no cell changes.
  pop(game, i) {
    this.ripple(this.x[i] * T, (this.y[i] - 0.4) * T);
    const at = this.floorBy(game, game.drill.x, game.drill.y, 4);
    if (at < 0) { this.set(i, RIDE); this.x[i] = game.drill.x; this.y[i] = game.drill.y; this.out[i] = 0; this.fade[i] = 1; return; }
    this.x[i] = this.ax[i] = at % N + 0.5; this.y[i] = this.ay[i] = Math.floor(at / N) + 1; this.cell[i] = at;
    this.out[i] = 0; this.fade[i] = 0.2; this.set(i, IDLE);
    this.ripple(this.x[i] * T, (this.y[i] - 0.4) * T);
    this.voice(game, i, 'pop', false);
  }
  floorBy(game, x0, y0, r) {
    const w = game.world;
    let best = -1, far = Infinity;
    for (let v = -r; v <= r; v++) for (let u = -r; u <= r; u++) {
      const x = Math.floor(x0) + u, y = Math.floor(y0) + v, e = (x + 0.5 - x0) ** 2 + (y + 0.5 - y0) ** 2;
      this.work++;
      if (e < far && e > 0.5 && openAt(w, x, y) && rockAt(w, x, y + 1) && rowSeen(w, x, y) >= 0 && rowOf(rowSeen(w, x, y)).pocket === null) { far = e; best = y * N + x; }
    }
    return best;
  }
  // Lumen moths come to the lamp and fly a little ahead of it, lighting the way it is going; with the drill still a
  // moment they hover over the nearest ore that has been seen; by a rime bell that has been seen they gather round
  // it; a drill going fast scatters them; they keep within forty cells of their den.
  moth(game, i, dt) {
    const d = game.drill, st = this.st[i], near = this.dist(game, i), den = this.denAt(i);
    let tx = this.ax[i], ty = this.ay[i], speed = 3;
    const wob = this.time * (1.1 + this.slot[i] * 0.3) + this.ph[i];
    if (this.speed > MOTH.scatter && near < 8) { this.set(i, AWAY); this.voice(game, i, 'flutter', true); }
    if (this.st[i] === AWAY) {
      tx = this.x[i] + (this.x[i] - d.x) * 2; ty = this.y[i] + (this.y[i] - d.y) * 2; speed = 6;
      if (this.t[i] > MOTH.shy) this.set(i, IDLE);
    } else if (den && den.bell >= 0 && Math.hypot(d.x - den.bellX, d.y - den.bellY) < MOTH.bell + 6) {
      // (Round the bell, each at its own distance.)
      tx = den.bellX + Math.cos(wob) * (1.6 + this.slot[i] * 0.5); ty = den.bellY + Math.sin(wob) * (1.2 + this.slot[i] * 0.4); speed = 2.5;
      if (st !== BACK) this.set(i, BACK);
    } else if (near < MOTH.call || st === MOVE || st === REST) {
      if (this.stillFor > MOTH.still) {
        if (st !== REST) { this.set(i, REST); this.cell[i] = this.oreBy(game, d.x, d.y, MOTH.ore); }
        if (this.cell[i] >= 0 && game.world.peek(this.cell[i] % N, Math.floor(this.cell[i] / N)) > 0) { tx = this.cell[i] % N + 0.5 + Math.cos(wob) * 0.8; ty = Math.floor(this.cell[i] / N) - 0.4 + Math.sin(wob * 1.3) * 0.4; }
        else { tx = d.x + Math.cos(wob) * 2; ty = d.y - 1 + Math.sin(wob) * 1; }
      } else {
        if (st !== MOVE) this.set(i, MOVE);
        // A little ahead of the lamp, as far as the open ground goes that way: each moth at its own distance.
        const ux = Math.cos(d.ang), uy = Math.sin(d.ang), want = MOTH.ahead[0] + (MOTH.ahead[1] - MOTH.ahead[0]) * (this.slot[i] / 2);
        let go = 1;
        while (go < want && openAt(game.world, Math.floor(d.x + ux * (go + 0.5)), Math.floor(d.y + uy * (go + 0.5)))) go += 0.5;
        this.work += 18;
        tx = d.x + ux * (go - 0.6) - uy * Math.sin(wob) * 0.8; ty = d.y + uy * (go - 0.6) + ux * Math.sin(wob) * 0.8; speed = Math.max(4, this.speed * 1.1);
      }
    } else {
      if (st !== IDLE) this.set(i, IDLE);
      const ax = den ? den.anchor % N + 0.5 : this.bx[i], ay = den ? Math.floor(den.anchor / N) + 0.5 : this.by[i];
      tx = ax + Math.cos(wob * 0.7) * 2; ty = ay + Math.sin(wob) * 1.2; speed = 1.5;
    }
    this.steer(game, i, tx, ty, speed, dt, 3);
  }
  oreBy(game, x0, y0, r) {
    const w = game.world;
    let best = -1, far = Infinity;
    for (let v = -r; v <= r; v++) for (let u = -r; u <= r; u++) {
      const x = Math.floor(x0) + u, y = Math.floor(y0) + v, k = w.peek(x, y);
      this.work++;
      if ((k === K.ORE_A || k === K.ORE_B) && u * u + v * v < far && openAt(w, x, y - 1)) { far = u * u + v * v; best = y * N + x; }
    }
    return best;
  }
  // The rime spitter sits and never moves. A drill rushing past within its sight wakes it; awake, with the drill
  // still near and in sight, it swells (the warning: a wheeze, and a dotted arc to where it will land, which follows
  // where the drill is going until a moment before it spits), spits a glob of ice that chills the drill if it is
  // still there and else plugs the open ground it lands in, and sags for a moment, when a ram drives it off.
  spitter(game, i, dt) {
    const d = game.drill, st = this.st[i], hx = this.x[i], hy = this.y[i] - 0.6, near = Math.hypot(d.x - hx, d.y - hy), sight = near < SPITTER.range && clear(game.world, hx, hy - 0.3, d.x, d.y);
    const free = d.mode === 'free' && game.shield <= 0;
    this.dim[i] = st === REST ? 0.45 : 0;
    // (A throw past it wakes it as a long run does; it swells only at a drill flying free.)
    if (st === IDLE) { if (sight && this.rush && (free || d.mode === 'fling')) { this.set(i, WAKE); this.n[i] = 0; } return; }
    if (st === WAKE) {
      if (near > SPITTER.sleep) { this.set(i, IDLE); return; }
      if (this.t[i] > (this.n[i] ? SPITTER.cool - SPITTER.sag : 0.2) && sight && free) { this.set(i, TELL); this.tell(game, i); this.voice(game, i, 'wheeze', false); }
      return;
    }
    if (st === TELL) {
      if (this.t[i] < SPITTER.lock) { this.ax[i] = d.x + d.vx * SPITTER.lead; this.ay[i] = d.y + d.vy * SPITTER.lead; }
      if (this.t[i] >= SPITTER.puff) { this.set(i, ACT); this.bx[i] = hx + this.face[i] * 0.3; this.by[i] = hy - 0.2; this.voice(game, i, 'spit', false); }
      return;
    }
    if (st === ACT) {
      // The glob in flight, on a low arc from the mouth to where it was aimed.
      if (this.t[i] >= SPITTER.flight) {
        this.n[i]++;
        this.land(game, i);
        this.set(i, REST);
      }
      return;
    }
    if (st === REST) {
      if (this.ram(game, i)) return;
      if (this.t[i] > SPITTER.sag) this.set(i, WAKE);
    }
  }
  // Where a glob lands: on the drill, a chill; elsewhere, a plug of ice in the open ground there, if it may be laid.
  land(game, i) {
    const d = game.drill, x = this.ax[i], y = this.ay[i];
    this.voice(game, i, 'splat', false);
    this.puff2(x * T, y * T, SPLAT, ICE_INK, 8);
    if (Math.hypot(d.x - x, d.y - y) < SPITTER.hit) { this.deed(game, 'chill'); return; }
    this.deed(game, 'plug', Math.floor(y) * N + Math.floor(x));
  }
  // The ember salamander basks on a floor beside lava that has been seen and sleeps (where salamanders bask, lava
  // sleeps behind the wall). It edges away from the drill; lava woken within six cells, it slips into it and swims,
  // and climbs out when it sets.
  salamander(game, i, dt) {
    const w = game.world, st = this.st[i], d = game.drill;
    if (st === SWIM) {
      const c = this.cell[i];
      if (!w.lava.has(c)) { this.set(i, IDLE); this.x[i] = this.ax[i] = this.bx[i]; this.y[i] = this.ay[i] = this.by[i]; this.fade[i] = 0; return; }
      this.x[i] += (c % N + 0.5 + Math.sin(this.t[i] * 1.3) * 0.25 - this.x[i]) * Math.min(1, dt * 3); this.y[i] += (Math.floor(c / N) + 0.9 - this.y[i]) * Math.min(1, dt * 3);
      return;
    }
    if (this.t[i] > 0.5 && (this.age[i] % 0.5) < dt && w.lava.size) {
      // (Lava that has woken near: the nearest cell of it, of the first forty looked at.)
      const q = this.q;
      q.x = this.x[i]; q.y = this.y[i]; q.n = 0; q.far = 36; q.best = -1;
      w.lava.forEach(this.nearLava);
      const best = q.best;
      if (best >= 0) { this.bx[i] = this.x[i]; this.by[i] = this.y[i]; this.cell[i] = best; this.set(i, SWIM); return; }
    }
    if (this.dist(game, i) < 4) { this.face[i] = d.x > this.x[i] ? -1 : 1; if (st !== MOVE) this.set(i, MOVE); this.crawl(game, i, 1, dt); return; }
    if (st === MOVE && this.t[i] > 1.5) this.set(i, IDLE);
    if (st === IDLE && this.dist(game, i) < 3) this.voice(game, i, 'purr', true);
  }
  // Cinder bats hang in a roost of two to four. A drill rushing past within four cells, or a cut finished within
  // three, wakes them: each drops, screeches, and a dashed line shows the way it will swoop, following the drill until
  // a moment before it goes; then it swoops along that line, through open ground only, and knocks the drill if it is
  // still on it (one pip a waking at the most). Where it stops it clings a while, dim, and a ram drives the roost off;
  // then the bats fly back and hang, and may be woken again.
  bat(game, i, dt) {
    const den = this.denAt(i), d = game.drill, st = this.st[i], w = game.world;
    if (!den) { this.leave(i); return; }
    const sx = den.anchor % N + 0.5 + (this.slot[i] - (den.flock - 1) / 2) * 0.9, sy = Math.floor(den.anchor / N), hover = 1.2 + (this.slot[i] % 2) * 0.7;
    this.dim[i] = st === REST ? 0.5 : 0;
    if (st === IDLE) {
      this.x[i] += (sx - this.x[i]) * Math.min(1, dt * 4); this.y[i] = sy;
      if (this.rush && Math.hypot(d.x - sx, d.y - sy - 0.5) < BAT.near) this.stir(game, den);
      // (Each bat answers a waking once: one back on its roost while its mates are still out waits for the next.)
      if (den.st === 1 && this.n[i] !== den.woke) { this.n[i] = den.woke; this.set(i, TELL); this.y[i] += 0.5; this.voice(game, i, 'screech', false); this.tell(game, i); }
      else if (this.slot[i] === 0 && Math.hypot(d.x - sx, d.y - sy) < BAT.hear) this.voice(game, i, 'chitter', false);
      return;
    }
    if (st === TELL) {
      // (Down from the roost to hang in the air below it, and the line of the swoop drawn, following the drill.)
      this.steer(game, i, sx + (this.slot[i] - (den.flock - 1) / 2) * 0.5, sy + hover, 3, dt);
      const fuse = BAT.fuse + this.slot[i] * BAT.stagger;
      if (this.t[i] < fuse - BAT.lock) { this.ax[i] = d.x; this.ay[i] = d.y; }
      if (this.t[i] >= fuse && d.mode === 'free' && game.shield <= 0) {
        // The line is fixed: out through where the drill was, as far as a swoop goes.
        const ux = this.ax[i] - this.x[i], uy = this.ay[i] - this.y[i], len = Math.hypot(ux, uy) || 1;
        this.bx[i] = this.x[i] + ux / len * BAT.run; this.by[i] = this.y[i] + uy / len * BAT.run;
        this.vx[i] = ux / len * BAT.speed; this.vy[i] = uy / len * BAT.speed; this.face[i] = ux > 0 ? 1 : -1;
        this.set(i, ACT); this.voice(game, i, 'whoosh', false);
      }
      return;
    }
    if (st === ACT) {
      const nx = this.x[i] + this.vx[i] * dt, ny = this.y[i] + this.vy[i] * dt;
      if (!this.free(i, Math.floor(nx), Math.floor(ny)) || this.t[i] * BAT.speed >= BAT.run) { this.set(i, REST); return; }
      this.x[i] = nx; this.y[i] = ny;
      if (!den.hits && Math.hypot(d.x - nx, d.y - ny) < BAT.hit && d.mode === 'free') {
        if (this.deed(game, 'hit')) den.hits++;
        // (It glances off, back the way it came, and clings there.)
        for (let back = 1; back > 0; back -= 0.25) { const bx = nx - this.vx[i] / BAT.speed * back, by = ny - this.vy[i] / BAT.speed * back; if (openAt(w, Math.floor(bx), Math.floor(by))) { this.x[i] = bx; this.y[i] = by; break; } }
        this.set(i, REST);
      }
      return;
    }
    if (st === REST) {
      if (this.ram(game, i)) return;
      if (this.t[i] > BAT.rest) this.set(i, BACK);
      return;
    }
    if (st === BACK) {
      this.steer(game, i, sx, sy + 0.4, 4, dt);
      if (Math.hypot(sx - this.x[i], sy + 0.4 - this.y[i]) < 0.3 || this.t[i] > 6) { this.set(i, IDLE); this.y[i] = sy; this.settled(den); }
      return;
    }
    if (st === AWAY) this.steer(game, i, this.x[i] + this.face[i] * 4, this.y[i] - 3, 5, dt);
  }
  // A roost woken: by a drill rushing past (`wake` sees it, each half second, and a frame's own look besides) or a
  // cut beside it (`crushed`).
  stir(game, den) {
    const mode = game.drill.mode;
    if (den.st || this.time < den.cool || (mode !== 'free' && mode !== 'fling')) return;
    den.st = 1; den.hits = 0; den.woke++;
  }
  // A waking is over only when every bat of the roost is back on it: till then its one knock stays taken, and a bat
  // home early does not go out again.
  settled(den) {
    if (den.st !== 1) return;
    for (let j = 0; j < FAUNA; j++) if (this.kind[j] === BATS && this.denAt(j) === den && this.st[j] !== IDLE && !this.out[j]) return;
    den.st = 0; den.cool = this.time + BAT.again; den.hits = 0;
  }
  // The mire frog croaks in a slow rhythm, its throat swelling, and hops away from a drill near it. Within four
  // cells of a pod that has been seen it is silent (where the frogs go quiet, pods hang).
  frog(game, i, dt) {
    const st = this.st[i], d = game.drill;
    if (st === ACT) {
      // A hop: an arc from where it sat to the floor it chose.
      const u = Math.min(1, this.t[i] / 0.45);
      this.x[i] = this.bx[i] + (this.ax[i] - this.bx[i]) * u; this.y[i] = this.by[i] + (this.ay[i] - this.by[i]) * u - Math.sin(u * Math.PI) * 1.4;
      if (u >= 1) this.set(i, IDLE);
      return;
    }
    if (this.dist(game, i) < 4) {
      this.face[i] = d.x > this.x[i] ? -1 : 1;
      const w = game.world, x = Math.floor(this.x[i]), y = Math.floor(this.y[i] - 0.5);
      // (Three cells off, else two; level, else a step up, else a step down.)
      for (let far = 3; far >= 2; far--) {
        const nx = x + this.face[i] * far;
        for (let m = 0; m < 3; m++) {
          const ny = y - m + (m === 2 ? 3 : 0);
          if (openAt(w, nx, ny) && rockAt(w, nx, ny + 1) && openAt(w, x + this.face[i], y - 1) && this.mine(i, nx, ny)) {
            this.bx[i] = this.x[i]; this.by[i] = this.y[i]; this.ax[i] = nx + 0.5; this.ay[i] = ny + 1; this.cell[i] = ny * N + nx; this.set(i, ACT); return;
          }
        }
      }
      return;
    }
    if (st === IDLE && this.t[i] > 2.6 + this.ph[i] % 1.5) {
      // (A croak, unless a pod hangs near.)
      if (this.near(game, Math.floor(this.x[i]), Math.floor(this.y[i] - 0.5), 4, 'spore') < 0) { this.set(i, TELL); this.voice(game, i, 'croak', true); }
      else this.set(i, IDLE);
    } else if (st === TELL && this.t[i] > 0.5) this.set(i, IDLE);
  }
  // A cell a creature of a den may stand in: in a pocket, its pocket's; elsewhere, no pocket's (and the pal, which
  // has no den, never a pocket's).
  mine(i, x, y) { return this.ours(this.w, this.denAt(i), x, y); }
  ours(w, den, x, y) {
    const b = rowSeen(w, x, y);
    return den && rowOf(den.row).pocket !== null ? b === den.row : b >= 0 && rowOf(b).pocket === null;
  }
  // Open, and its own to go into.
  free(i, x, y) { return openAt(this.w, x, y) && this.mine(i, x, y); }
  // The puffling drifts about its den and bobs, and edges away from a drill in a hurry. Lassoed (`wound`), it is
  // caught.
  puff(game, i, dt) {
    const st = this.st[i], d = game.drill, den = this.denAt(i);
    if (st === CAUGHT) { this.y[i] -= dt * 0.6; if (this.t[i] > 0.7) { this.puff2(this.x[i] * T, this.y[i] * T, PUFFS_P, SPORE_INK, 14); this.voice(game, i, 'poof', false); this.drop(i); } return; }
    const near = this.dist(game, i), ax = den ? den.anchor % N + 0.5 : this.bx[i], ay = den ? Math.floor(den.anchor / N) + 0.5 : this.by[i];
    if (near < 3 && this.rush) { if (st !== AWAY) { this.set(i, AWAY); this.voice(game, i, 'squeak', false); } }
    if (this.st[i] === AWAY) {
      this.steer(game, i, this.x[i] + (this.x[i] - d.x), this.y[i] + (this.y[i] - d.y), 2, dt);
      if (this.t[i] > 1.5) this.set(i, IDLE);
      return;
    }
    const wob = this.time * 0.5 + this.ph[i];
    this.steer(game, i, ax + Math.cos(wob) * 2, ay + Math.sin(wob * 1.7) * 0.8, PUFF.speed, dt, 1.5);
  }
  // A cave leech hangs from a ceiling, swaying. With the drill under it, slow, it stiffens (its drips come quicker:
  // the warning), drops, and latches on: the drill flies at three quarters of its speed while it is on. It never
  // knocks. It comes off flown fast, at the core, by itself, or pulled off by the pal; and crawls away. Its moment is
  // while it stiffens: flown into then, it is knocked from its roof and its den is quiet (`ram`).
  leech(game, i, dt) {
    const d = game.drill, st = this.st[i], w = game.world;
    if (st === IDLE) {
      const dx = Math.abs(d.x - this.x[i]), below = d.y - this.y[i];
      if (dx < LEECH.under && below > LEECH.below[0] && below < LEECH.below[1] + 0.5 && this.speed < LEECH.slow && d.mode === 'free' && this.latched < 0 && clear(w, this.x[i], this.y[i] + 0.5, d.x, d.y)) {
        this.set(i, TELL); this.tell(game, i); this.voice(game, i, 'plip', false);
      }
      if (this.t[i] > 1.4 + this.ph[i] % 1) { this.t[i] = 0; this.puff2(this.x[i] * T, (this.y[i] + 0.55) * T, DRIP, DRIP_INK, 1); }
      return;
    }
    if (st === TELL) {
      if (this.ram(game, i)) return;
      if ((this.t[i] * 10 | 0) !== ((this.t[i] - dt) * 10 | 0)) this.puff2(this.x[i] * T, (this.y[i] + 0.55) * T, DRIP, DRIP_INK, 1);
      if (this.t[i] >= LEECH.tell) { this.set(i, FALL); this.vy[i] = 0; this.y[i] += 0.5; this.bx[i] = this.x[i]; this.by[i] = this.y[i]; }
      return;
    }
    if (st === FALL) {
      this.vy[i] += 40 * dt; this.y[i] += this.vy[i] * dt;
      const hit = Math.hypot(d.x - this.x[i], d.y - this.y[i]) < LEECH.latch;
      if (hit && this.latched < 0 && d.mode === 'free' && this.deed(game, 'drag', i)) { this.set(i, LATCH); this.latched = i; this.n[i] = 0; this.voice(game, i, 'slurp', false); return; }
      if (this.t[i] >= LEECH.fall || !openAt(w, Math.floor(this.x[i]), Math.floor(this.y[i] + 0.3))) { this.offAt(game, i, this.x[i], this.y[i]); }
      return;
    }
    if (st === LATCH) {
      this.x[i] = d.x; this.y[i] = d.y; this.drag = this.tame ? 1 : LEECH.drag;
      this.vx[i] = this.speed > LEECH.fast ? this.vx[i] + dt : 0;
      if ((this.t[i] % LEECH.slurp) < dt && this.t[i] > 0.5) this.voice(game, i, 'slurp', false);
      const pulled = this.pal >= 0 && this.t[i] > PUP.pull && this.st[this.pal] !== SLEEP;
      if (this.vx[i] > LEECH.shake || d.mode === 'home' || d.mode === 'dead' || this.t[i] > LEECH.most || pulled) {
        if (pulled) { this.voice(game, i, 'tug', false); this.set(this.pal, WAKE); }
        this.latched = -1; this.drag = 1;
        this.offAt(game, i, d.x, d.y);
      }
      return;
    }
    if (st === AWAY) {
      // (Crawling off along the floor, to fade.)
      this.crawl(game, i, 0.8, dt);
      if (this.t[i] > 1.2) this.leave(i);
    }
  }
  // A leech that missed or came off: it drops to the floor below, crawls off, and its den is spent (but for one
  // rammed off its roof, whose den is quiet instead).
  offAt(game, i, x, y, spend = true) {
    const w = game.world, cx = Math.floor(x);
    let fy = Math.floor(y);
    for (let n = 0; n < 6 && openAt(w, cx, fy + 1); n++) fy++;
    this.x[i] = this.ax[i] = cx + 0.5; this.y[i] = this.ay[i] = fy + 1; this.face[i] = this.rnd() < 0.5 ? 1 : -1;
    this.voice(game, i, 'pop', false);
    this.set(i, AWAY);
    const den = this.denAt(i);
    if (den && spend) this.deed(game, 'spend', den.key);
  }
  // The sand skink suns itself, and darts into a crevice from a drill within five cells, or from a crystal's fuse
  // lit within eight (skinks bolt a beat before an arc); it comes out again a while after.
  skink(game, i, dt) {
    const st = this.st[i], d = game.drill;
    if (st === HIDE) { if (this.t[i] > 4 && this.dist(game, i) > 6) { this.set(i, IDLE); this.x[i] = this.ax[i] = this.bx[i]; this.y[i] = this.ay[i] = this.by[i]; this.out[i] = 0; this.fade[i] = 0; } return; }
    if (st === ACT) { this.crawl(game, i, 4, dt); if (this.t[i] > 0.45) { this.set(i, HIDE); this.fade[i] = 0; } return; }
    let fuse = false;
    // (Charged crystals are few, and only in the east: the list is looked at only when there are any.)
    if (game.sparks.size) { const q = this.q; q.x = this.x[i]; q.y = this.y[i]; q.best = -1; game.sparks.forEach(this.nearFuse); fuse = q.best >= 0; }
    if (this.dist(game, i) < 5 || fuse) {
      this.face[i] = fuse ? this.face[i] : d.x > this.x[i] ? -1 : 1; this.bx[i] = this.x[i]; this.by[i] = this.y[i];
      this.set(i, ACT); this.voice(game, i, 'skitter', true); return;
    }
    if (st === IDLE && this.t[i] > 4 + this.ph[i]) this.set(i, MOVE);
    else if (st === MOVE) { this.crawl(game, i, 1.2, dt); if (this.t[i] > 0.8) this.set(i, IDLE); }
  }
  // The prospector wren perches and preens. With the drill within WREN.call cells, it flits toward the nearest find
  // within WREN.find cells that nobody has seen and the finder does not already mark (a cache, a geode, a prism),
  // perches on the rock nearest it and pecks; and the find is shown (`reveal`): the game calls it out by name, with
  // its ring and its dot on the map. Then it flies off, and its den is spent. With no such find it only preens.
  wren(game, i, dt) {
    const st = this.st[i], w = game.world, d = game.drill;
    if (st === IDLE || st === MOVE) {
      if (this.t[i] > 1.5 && this.dist(game, i) < WREN.call && this.findFor(game, i)) { this.set(i, FLIT); this.voice(game, i, 'trill', false); return; }
      if (this.t[i] > 1.2 + this.ph[i] % 1) this.set(i, st === IDLE ? MOVE : IDLE);
      return;
    }
    if (st === FLIT) {
      this.steer(game, i, this.ax[i], this.ay[i] - 0.5, 5, dt, 4);
      if (Math.hypot(this.ax[i] - this.x[i], this.ay[i] - 0.5 - this.y[i]) < 0.4 || this.t[i] > 4) { this.x[i] = this.ax[i]; this.y[i] = this.ay[i]; this.set(i, PECK); }
      return;
    }
    if (st === PECK) {
      this.face[i] = this.bx[i] > this.x[i] ? 1 : -1;
      if (this.t[i] >= WREN.peck) {
        this.deed(game, 'reveal', this.cell[i], this.n[i]);
        this.voice(game, i, 'trill', false);
        const den = this.denAt(i);
        if (den) this.deed(game, 'spend', den.key);
        this.set(i, AWAY);
      }
      return;
    }
    if (st === AWAY) {
      this.steer(game, i, this.x[i] + this.face[i] * 6, this.y[i] - 4, 5, dt);
      if (this.t[i] > 1) this.leave(i);
    }
  }
  // The find a wren leads to (its middle in `cell`, a geode's size in `n`, where it will perch in ax, ay and the
  // find's middle in bx, by): whether there is one.
  findFor(game, i) {
    const w = game.world, d = game.drill, x0 = this.x[i], y0 = this.y[i], level = game.val('mapfinder'), reach = FINDER[level] ?? 0;
    let best = -1, bestSize = 0, far = WREN.find;
    for (let sy = Math.floor((y0 - WREN.find - C) / 48); sy <= Math.floor((y0 + WREN.find - C) / 48); sy++) for (let sx = Math.floor((x0 - WREN.find - C) / 48); sx <= Math.floor((x0 + WREN.find - C) / 48); sx++) {
      // (What the sector holds, its middle and size left in the world's record of it: no array made.)
      const what = w.findName(sx, sy), fx = w.asked.fx, fy = w.asked.fy, size = w.asked.size;
      if (what !== 'cache' && what !== 'geode' && what !== 'prism') continue;
      const e = Math.hypot(fx + 0.5 - x0, fy + 0.5 - y0);
      if (e >= far || w.peek(fx, fy) >= 0) continue;
      // (Not one the finder marks already, nor one in a pocket; and what is there must still be that find.)
      if (level >= FOUND[what] && Math.hypot(fx + 0.5 - d.x, fy + 0.5 - d.y) <= reach) continue;
      const laid = w.laid(fy * N + fx), want = what === 'cache' ? K.CACHE : what === 'prism' ? K.PRISM : -2;
      if (laid >= 0 && want >= 0 && laid !== want) continue;
      if (rowOf(w.biomeKnown(fx, fy)).pocket !== null) continue;
      far = e; best = fy * N + fx; bestSize = what === 'geode' ? size : 0;
    }
    if (best < 0) return false;
    // Where it perches: the last open cell on the straight way from it toward the find, before rock.
    const fx = best % N, fy = Math.floor(best / N), size = bestSize, ux = fx + 0.5 - x0, uy = fy + 0.5 - y0, len = Math.hypot(ux, uy) || 1;
    let px = Math.floor(x0), py = Math.floor(y0 - 0.5);
    for (let s = 0.5; s < len; s += 0.5) {
      const x = Math.floor(x0 + ux / len * s), y = Math.floor(y0 - 0.5 + uy / len * s);
      if (!this.free(i, x, y)) break;
      px = x; py = y;
    }
    this.work += Math.ceil(len * 2);
    this.cell[i] = fy * N + fx; this.n[i] = size; this.bx[i] = fx + 0.5; this.by[i] = fy + 0.5;
    this.ax[i] = px + 0.5; this.ay[i] = py + (rockAt(w, px, py + 1) ? 1 : 0.6);
    return true;
  }
  // The hive's nurse bees bumble between its chambers, and cluster where a nugget hangs that has been seen.
  bee(game, i, dt) {
    const den = this.denAt(i), w = game.world;
    if (this.t[i] > 1.5 + this.ph[i] % 1.5 || this.st[i] === IDLE) {
      this.set(i, MOVE);
      const ax = den ? den.anchor % N : Math.floor(this.x[i]), ay = den ? Math.floor(den.anchor / N) : Math.floor(this.y[i]);
      let tx = -1, ty = -1;
      if (this.rnd() < 0.6) for (let tries = 0; tries < 6 && tx < 0; tries++) {
        const x = ax + Math.floor(this.rnd() * 13) - 6, y = ay + Math.floor(this.rnd() * 13) - 6;
        if (w.peek(x, y) === K.MINERAL) for (let n = 0; n < 4; n++) { const u = BESIDE[n][0], v = BESIDE[n][1]; if (openAt(w, x + u, y + v)) { tx = x + u + 0.5; ty = y + v + 0.5; break; } }
      }
      if (tx < 0) { tx = ax + 0.5 + (this.rnd() - 0.5) * 8; ty = ay + 0.5 + (this.rnd() - 0.5) * 6; }
      this.ax[i] = tx; this.ay[i] = ty;
    }
    const wob = this.time * 7 + this.ph[i];
    this.steer(game, i, this.ax[i] + Math.cos(wob) * 0.4, this.ay[i] + Math.sin(wob * 1.3) * 0.3, 2.5, dt, 3);
    if (this.dist(game, i) < 4) this.voice(game, i, 'buzz', true);
  }
  // The drift's star jellies drift slowly, and gather by the boulders that are not yet hauled.
  jelly(game, i, dt) {
    const den = this.denAt(i), w = game.world;
    if (this.st[i] === IDLE || this.t[i] > 8) {
      this.set(i, MOVE);
      const ax = den ? den.anchor % N : Math.floor(this.x[i]), ay = den ? Math.floor(den.anchor / N) : Math.floor(this.y[i]);
      let best = -1, far = Infinity;
      for (let v = -7; v <= 7; v++) for (let u = -7; u <= 7; u++) { const k = w.peek(ax + u, ay + v); if (k === K.MINERAL && u * u + v * v < far) { far = u * u + v * v; best = (ay + v) * N + ax + u; } }
      this.work += 225;
      this.ax[i] = best >= 0 ? best % N + 0.5 + (this.rnd() - 0.5) * 3 : ax + 0.5 + (this.rnd() - 0.5) * 6; this.ay[i] = best >= 0 ? Math.floor(best / N) - 1.2 : ay + 0.5 + (this.rnd() - 0.5) * 4;
    }
    const wob = this.time * 0.8 + this.ph[i];
    this.steer(game, i, this.ax[i] + Math.cos(wob) * 0.6, this.ay[i] + Math.sin(wob * 1.4) * 0.5, 0.7, dt, 1);
    if ((this.age[i] % 9) < dt && this.dist(game, i) < 8) this.voice(game, i, 'glass', true);
  }
  // The lantern newt creeps from cap to cap over the grotto's floors, walls and ceilings, and lights one it can reach
  // with its tongue of light (two cells): three in a visit at the most, one every four seconds.
  newt(game, i, dt) {
    const den = this.denAt(i), w = game.world, st = this.st[i];
    if (st === ACT) {
      if (this.t[i] > 0.5) {
        const c = this.cell[i];
        if (den && w.peek(c % N, Math.floor(c / N)) === K.CAP && den.lit < NEWT.caps) { this.deed(game, 'light', c); den.lit++; den.litAt = this.time; }
        this.set(i, IDLE);
      }
      return;
    }
    // (A cap beside it, if it may light one now.)
    const x = Math.floor(this.x[i]), y = Math.floor(this.y[i] - 0.5);
    if (den && den.lit < NEWT.caps && this.time - den.litAt >= NEWT.every && Math.abs(this.ax[i] - this.x[i]) + Math.abs(this.ay[i] - this.y[i]) < 0.05) {
      for (let v = -NEWT.tongue; v <= NEWT.tongue; v++) for (let u = -NEWT.tongue; u <= NEWT.tongue; u++) if (w.peek(x + u, y + v) === K.CAP) {
        this.cell[i] = (y + v) * N + x + u; if (u) this.face[i] = u > 0 ? 1 : -1; this.set(i, ACT); return;
      }
    }
    if (st === IDLE && this.t[i] > 0.8) {
      // Toward the nearest cap not yet lit that has been seen, or anywhere about its den.
      let best = -1, far = Infinity;
      for (let v = -NEWT.find; v <= NEWT.find; v++) for (let u = -NEWT.find; u <= NEWT.find; u++) if (w.peek(x + u, y + v) === K.CAP && u * u + v * v < far) { far = u * u + v * v; best = (y + v) * N + x + u; }
      this.work += (NEWT.find * 2 + 1) ** 2;
      this.bx[i] = best >= 0 ? best % N + 0.5 : x + 0.5 + (this.rnd() - 0.5) * 8; this.by[i] = best >= 0 ? Math.floor(best / N) + 0.5 : y + 0.5 + (this.rnd() - 0.5) * 6;
      this.set(i, MOVE);
    }
    if (st === MOVE) { this.creep(game, i, this.bx[i], this.by[i], 1, dt); if (this.t[i] > 4) this.set(i, IDLE); }
  }
  // Over floors, walls and ceilings alike: a cell at a time, to whichever of the four beside it is open, against
  // rock, in its own ground and not the one it came from, that is nearest (tx, ty).
  creep(game, i, tx, ty, speed, dt) {
    const w = game.world, gx = this.ax[i], gy = this.ay[i];
    if (Math.abs(gx - this.x[i]) + Math.abs(gy - this.y[i]) > 0.02) {
      const dx = gx - this.x[i], dy = gy - this.y[i], len = Math.hypot(dx, dy), go = Math.min(len, speed * dt);
      this.x[i] += dx / len * go; this.y[i] += dy / len * go;
      if (Math.abs(dx) > 0.01) this.face[i] = dx > 0 ? 1 : -1;
      return;
    }
    const x = Math.floor(this.x[i]), y = Math.floor(this.y[i] - 0.5), from = this.cell[i];
    let best = -1, far = Infinity;
    for (let n = 0; n < 4; n++) {
      const u = SIDES[n][0], v = SIDES[n][1], nx = x + u, ny = y + v, j = ny * N + nx;
      if (j === from || !openAt(w, nx, ny) || !this.mine(i, nx, ny)) continue;
      if (!rockAt(w, nx, ny + 1) && !rockAt(w, nx, ny - 1) && !rockAt(w, nx + 1, ny) && !rockAt(w, nx - 1, ny)) continue;
      const e = Math.hypot(nx + 0.5 - tx, ny + 0.5 - ty) + this.rnd() * 0.3;
      if (e < far) { far = e; best = j; }
    }
    this.work += 20;
    this.cell[i] = y * N + x;
    if (best < 0) return;
    this.ax[i] = best % N + 0.5; this.ay[i] = Math.floor(best / N) + 1;
  }
  // Which way a creature that creeps has its feet: the side of its cell that is rock (0 below, 1 to its left wall,
  // 2 above, 3 to its right wall), for its picture to be turned.
  footing(i) {
    const w = this.w, x = Math.floor(this.x[i]), y = Math.floor(this.y[i] - 0.5);
    if (!w || rockAt(w, x, y + 1)) return 0;
    if (rockAt(w, x - 1, y)) return 1;
    if (rockAt(w, x + 1, y)) return 3;
    return rockAt(w, x, y - 1) ? 2 : 0;
  }
  // A foe at rest driven off by a ram: its den is quiet for QUIET seconds, and it flees.
  ram(game, i) {
    const d = game.drill;
    // (Flown into: a drill standing still beside a foe at rest does not drive it off.)
    if (this.dist(game, i) >= RAM + 0.4 || this.speed < RAM_SPEED || d.mode === 'dead') return false;
    const den = this.denAt(i);
    this.deed(game, 'quiet', den ? den.key : -1);
    this.voice(game, i, 'squeak', false);
    this.spot(this.x[i] * T, this.y[i] * T, 18, ink('#ffffff'));
    // (Every one of its den goes; a leech still hung is knocked down to the floor first.)
    for (let j = 0; j < FAUNA; j++) if (this.kind[j] && (j === i || (this.den[i] >= 0 && this.den[j] === this.den[i]))) {
      if (this.kind[j] === LEECHES && this.where(j) === 1) this.offAt(game, j, this.x[j], this.y[j] + 0.5, false);
      this.set(j, AWAY); this.leave(j);
    }
    return true;
  }
  // A foe's warning has begun: the pal, if near, yips and looks at it.
  tell(game, i) {
    if (this.pal < 0 || Math.hypot(this.x[i] - game.drill.x, this.y[i] - game.drill.y) > 12) return;
    this.warn(game, i);
  }
  warn(game, i) {
    const p = this.pal;
    if (p < 0) return;
    if (this.st[p] !== RIDE) { this.set(p, WAKE); this.face[p] = this.x[i] > this.x[p] ? 1 : -1; }
    this.n[p] = 0;
    this.say(game, '!', p, FOE_EYE);
    this.voice(game, p, 'yip', false);
    this.warnedAt = this.time; this.warnedOf = this.kind[i];
  }
  // The pal warns of a foe's den the drill comes within PUP.warn cells of, once in twenty seconds a den.
  warnings(game) {
    const d = game.drill;
    for (let i = 0; i < FAUNA; i++) {
      if (!this.kind[i] || CREATURES[this.kind[i]].tier !== 'foe' || this.st[i] === AWAY) continue;
      const den = this.denAt(i);
      if (!den || this.time - den.warned < 20 || Math.hypot(d.x - this.x[i], d.y - this.y[i]) > PUP.warn) continue;
      den.warned = this.time;
      this.warn(game, i);
    }
  }
  // The first time each kind is met (on the screen, within the lamp's reach of the drill and in its sight), its name
  // comes up in its own colour.
  meet(game) {
    const d = game.drill, lamp = game.val('lamp'), met = game.S.fauna?.met;
    for (let i = 0; i < FAUNA; i++) {
      const k = this.kind[i];
      if (!k || this.out[i] || this.fade[i] < 0.5 || (met && met[CREATURES[k].key]) || (this.met ??= new Set()).has(k)) continue;
      const y = this.y[i] - (CREATURES[k].place === 'floor' ? 0.5 : 0);
      if (!this.inView(game, this.x[i], y, 8) || Math.hypot(d.x - this.x[i], d.y - y) > lamp || !clear(game.world, d.x, d.y, this.x[i], y)) continue;
      this.met.add(k);
      this.deed(game, 'met', k);
      this.say(game, CREATURES[k].name, i, CREATURES[k].color);
      this.voice(game, i, 'meet', false);
    }
  }
  // Whether a point (cells) is on the screen as the game draws it (js/drawing.js), `margin` pixels inside its edges.
  inView(game, x, y, margin) {
    const px = x * T - game.cam.x + game.W / 2, py = y * T - game.cam.y + (game.H - 44) / 2;
    return px >= margin && py >= margin && px <= game.W - margin && py <= game.H - margin;
  }
  // Words over a creature: a name, a warning.
  say(game, what, i, color) {
    let w = this.words[0];
    for (const v of this.words) if (v.t > w.t) w = v;
    w.text = what; w.x = this.x[i]; w.y = this.y[i] - (CREATURES[this.kind[i]].place === 'floor' ? 1 : 0.5); w.t = 0; w.life = what === '!' ? 1 : 2.2; w.color = color; w.of = i;
  }

  // ---------------------------------------------------------------- what the game tells it
  // A cell was cut (`Game.finishDig`): ore, steel or a prism crushed within PUP.near cells of a wild pup is a
  // feeding, and three at one meeting make it the pal; a cut within BAT.cut cells of a roost wakes it. It only reads.
  crushed(game, i, k) {
    if (this.off) return;
    const x = i % N + 0.5, y = Math.floor(i / N) + 0.5, food = k === K.ORE_A || k === K.ORE_B || k === K.STEEL || k === K.PRISM;
    for (let j = 0; j < FAUNA; j++) {
      const kind = this.kind[j];
      if (!kind || this.out[j]) continue;
      if (kind === PUPS && j !== this.pal && food && Math.hypot(x - this.x[j], y - (this.y[j] - 0.5)) < PUP.near + 0.5) {
        this.n[j]++; this.set(j, WAKE); this.face[j] = x > this.x[j] ? 1 : -1;
        this.puff2(this.x[j] * T, (this.y[j] - 1) * T, HEART, HEART_INK, 1);
        this.voice(game, j, 'coo', false);
        if (this.n[j] >= PUP.feed && this.pal < 0) this.befriend(game, j);
      }
      if (kind === BATS) { const den = this.denAt(j); if (den && den.anchor >= 0 && Math.hypot(x - den.anchor % N - 0.5, y - Math.floor(den.anchor / N) - 0.5) < BAT.cut + 0.5) this.stir(game, den); }
    }
  }
  // The tether goes round a puffling (`Game.update`, beside `reelIfRound`, with the tether as it is before any haul
  // is taken): the band closed home winds round it, it lies within PUFF.loop cells of the band and the drill within
  // PUFF.drill of it. Caught, it pays. It only reads the band.
  wound(game) {
    if (this.off) return;
    const pts = game.band, d = game.drill;
    if (pts.length < 3 || d.mode === 'dead') return;
    for (let i = 0; i < FAUNA; i++) {
      if (this.kind[i] !== PUFFS || this.st[i] === CAUGHT || this.out[i]) continue;
      const x = this.x[i], y = this.y[i];
      if (Math.hypot(d.x - x, d.y - y) > PUFF.drill) continue;
      let turns = 0, near = Infinity;
      for (let n = 0; n < pts.length; n++) {
        const a = pts[n], b = pts[(n + 1) % pts.length];
        if (a[1] <= y) { if (b[1] > y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) > 0) turns++; }
        else if (b[1] <= y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) < 0) turns--;
        if (n + 1 < pts.length) {
          const ex = b[0] - a[0], ey = b[1] - a[1], len2 = ex * ex + ey * ey || 1, u = Math.max(0, Math.min(1, ((x - a[0]) * ex + (y - a[1]) * ey) / len2));
          near = Math.min(near, Math.hypot(a[0] + ex * u - x, a[1] + ey * u - y));
        }
      }
      if (turns === 0 || near > PUFF.loop) continue;
      if (!this.deed(game, 'catch', i)) continue;
      this.set(i, CAUGHT);
      const den = this.denAt(i);
      if (den) this.deed(game, 'spend', den.key);
    }
  }

  // ---------------------------------------------------------------- the deeds
  // Everything a creature does to the game is one of these, and with `tame` none of them is done (the creatures
  // still show). Returns whether it was done.
  deed(game, what, a, b) {
    if (this.tame) return false;
    const S = game.S, d = game.drill, w = game.world;
    this.deeds++;
    switch (what) {
      // A bat's swoop: a knock, as any hazard's (`Game.hit`): the shield after it, and a pip.
      case 'hit': return game.hit(this.knock);
      // A spitter's glob on the drill: stunned a moment by the cold, as by a bite, and no pip taken. Within the
      // shield after a knock nothing lands, pip or stun (`Game.hit`), and the glob only splashes.
      case 'chill': if (d.mode !== 'free' || game.shield > 0) return false; game.jolt(SPITTER.chill); this.spot(d.x * T, d.y * T, 14, ICE_INK); return true;
      // A spitter's glob that lands in open ground: that cell and up to two open cells beside it are ice, as the
      // frost closes a cut, and with the frost's own guards: only open ground, no lava, no pocket, never under the
      // tether as it is drawn or as it truly runs (`Game.layUnder`), and never within SPITTER.keep cells of a drill
      // that is flying free.
      case 'plug': {
        if (d.mode !== 'free') return false;
        const closed = [], x0 = a % N, y0 = Math.floor(a / N);
        game.layUnder();
        for (const [u, v] of [[0, 0], [1, 0], [-1, 0], [0, -1], [0, 1]]) {
          if (closed.length >= 3) break;
          const x = x0 + u, y = y0 + v, j = y * N + x;
          if (w.peek(x, y) !== K.EMPTY || w.lava.has(j) || game.under.has(j) || rowOf(w.b(j)).pocket !== null) continue;
          if (Math.hypot(x + 0.5 - d.x, y + 0.5 - d.y) < SPITTER.keep + 0.5 || Math.hypot(C + 0.5 - x - 0.5, C + 0.5 - y - 0.5) < CALM) continue;
          w.setK(j, K.ICE); closed.push(j);
        }
        if (!closed.length) return false;
        game.changed([], closed);
        return true;
      }
      // A leech on the hull (its drag is the frame's own: `drag`).
      case 'drag': return d.mode === 'free';
      // The wren's find shown: the ground about it is seen, as the scanner would see it, and the game calls it out.
      // (Ground seen afresh is painted again, as the drill's own look has it: `Game.look`.)
      case 'reveal': { if (w.see(a % N, Math.floor(a / N), b ? b + 1 : 1)) game.version++; return true; }
      // A puffling caught: half a cache's lump of grit, with the refinery's share, and three of the west's gems with
      // the cutter's; banked at once (there is no haul for it to come home with).
      case 'catch': {
        const x = this.x[a], y = this.y[a], far = Math.hypot(x - C, y - C);
        const grit = Math.round(round2(income(Math.max(22, far)) * PUFF.lump) * game.val('refinery')), gems = Math.round(PUFF.gems * game.val('cutter'));
        S.grit += grit; S.gems[3] += gems;
        this.paid.grit += grit; this.paid.gems[3] += gems;
        game.popup(Math.floor(x), Math.floor(y) - 1, 'CAUGHT!', '#f4dcc4');
        game.popup(Math.floor(x), Math.floor(y), `+${grit} GRIT`, '#ffe14a');
        this.spot(x * T, y * T, 26, SPORE_INK);
        voices.caught?.();
        return true;
      }
      // The newt's lick: a cap lit, as the drill's flying by lights one.
      case 'light': game.lightCap(a); game.version++; return true;
      // What is kept: the pal; a den spent; a creature met.
      case 'befriend': (S.fauna ??= { pal: null, met: {}, spent: [] }).pal = { kind: 'pup', at: Math.round(S.stats.time) }; return true;
      case 'spend': {
        const F = S.fauna ??= { pal: null, met: {}, spent: [] };
        F.spent = (F.spent ?? []).filter(([key, at]) => key !== a && S.stats.time - at < SPENT);
        F.spent.push([a, Math.round(S.stats.time)]);
        while (F.spent.length > 48) F.spent.shift();
        this.spentAt.set(a, S.stats.time);
        return true;
      }
      case 'quiet': if (a >= 0) { this.quiet.set(a, this.time + QUIET); if (this.quiet.size > 32) for (const [key, at] of this.quiet) if (at <= this.time) this.quiet.delete(key); } return true;
      case 'met': ((S.fauna ??= { pal: null, met: {}, spent: [] }).met ??= {})[CREATURES[a].key] = 1; return true;
    }
    return false;
  }
  // A pup becomes the pal (j: its slot; -1 to set the pal down beside the drill, as a game begins).
  befriend(game, j) {
    if (j >= 0) {
      if (!this.deed(game, 'befriend')) return;
      const den = this.denAt(j);
      if (den) { den.live = Math.max(0, den.live - 1); this.deed(game, 'spend', den.key); }
      this.den[j] = -1; this.pal = j;
      this.spot(this.x[j] * T, (this.y[j] - 0.5) * T, 20, HEART_INK);
      for (let n = 0; n < 4; n++) this.puff2(this.x[j] * T, (this.y[j] - 1) * T, HEART, HEART_INK, 1);
      this.say(game, 'PAL!', j, '#ffb0c0');
      voices.befriend?.();
      return;
    }
    const d = game.drill, i = this.spawn(PUPS, Math.floor(d.x), Math.floor(d.y), null);
    if (i < 0) return;
    this.pal = i; this.set(i, RIDE); this.x[i] = d.x; this.y[i] = d.y; this.fade[i] = 1;
  }

  // ---------------------------------------------------------------- particles, rings, sounds
  puff2(x, y, kind, inkN, count) {
    for (let c = 0; c < count; c++) {
      let i = -1;
      for (let n = 0; n < POOL; n++) { const j = (this.hunt + n) % POOL; if (!this.pk[j]) { i = j; break; } }
      if (i < 0) return;
      this.hunt = (i + 1) % POOL;
      const a = this.rnd() * 6.283, v = kind === HEART ? 6 : kind === DRIP ? 0 : 10 + this.rnd() * 30;
      this.pk[i] = kind; this.px[i] = x + (kind === HEART ? (this.rnd() - 0.5) * 8 : 0); this.py[i] = y; this.pvx[i] = Math.cos(a) * v * (kind === HEART ? 0.3 : 1);
      this.pvy[i] = kind === HEART ? -14 : kind === DRIP ? 10 : Math.sin(a) * v - (kind === PUFFS_P ? 8 : 0);
      this.pt[i] = 0; this.plife[i] = kind === HEART ? 0.9 : kind === DRIP ? 0.6 : kind === RIPPLE ? 0.5 : 0.3 + this.rnd() * 0.4; this.pink[i] = inkN;
    }
  }
  ripple(x, y) { this.spot(x, y, 10, DUST_INK); this.puff2(x, y, DUST, DUST_INK, 6); }
  particles(dt) {
    for (let i = 0; i < POOL; i++) {
      const k = this.pk[i];
      if (!k) continue;
      this.pt[i] += dt;
      if (this.pt[i] >= this.plife[i]) { this.pk[i] = 0; continue; }
      if (k === DRIP) this.pvy[i] += 200 * dt;
      else if (k === DUST || k === SPLAT) { this.pvy[i] += 60 * dt; this.pvx[i] *= 1 - 2 * dt; }
      else { this.pvx[i] *= 1 - 2 * dt; this.pvy[i] *= 1 - 1.5 * dt; }
      this.px[i] += this.pvx[i] * dt; this.py[i] += this.pvy[i] * dt;
    }
  }
  spot(x, y, reach, inkN) {
    let s = this.spots[0];
    for (const q of this.spots) if (q[3] <= 0) { s = q; break; }
    s[0] = x; s[1] = y; s[2] = 0; s[3] = 0.5; s[4] = reach; s[5] = inkN;
  }
  // A creature's voice: one that is only the life of the place (`ambient`) when nothing that matters is sounding,
  // one in AMBIENT seconds at the most; a warning whenever it comes. Either only within HEAR cells of the drill.
  voice(game, i, what, ambient) {
    const v = voices[what];
    if (!v) return;
    const near = 1 - Math.hypot(this.x[i] - game.drill.x, this.y[i] - game.drill.y) / HEAR;
    if (near <= 0) return;
    if (ambient) {
      if (this.time - this.heard < AMBIENT || game.tickIn > 0 || game.hauls.length || game.banner || game.notice || game.place?.card) return;
      this.heard = this.time;
    }
    v(near);
  }

  // ---------------------------------------------------------------- drawing
  // The creatures, under the dark: the lamp shows them.
  draw(game, ctx, ox, oy) {
    if (this.off || !frames()) return;
    this.w = game.world;
    const s = sheets.fauna, image = s.image, now = this.time;
    for (let i = 0; i < FAUNA; i++) {
      const k = this.kind[i];
      if (!k || (i === this.pal && this.st[i] === RIDE) || i === this.latched || this.st[i] === HIDE) continue;
      const pose = this.pose(i, now), f = FR[k][pose][this.face[i] < 0 ? 1 : 0], r = f.r;
      if (!r) continue;
      const px = Math.round(this.x[i] * T - ox - 8), py = Math.round(this.top(i) - oy);
      if (px < -16 || py < -16 || px > game.W || py > game.H) continue;
      ctx.globalAlpha = Math.max(0, Math.min(1, this.fade[i])) * (1 - this.dim[i]);
      const turn = k === NEWTS ? this.footing(i) : 0;
      if (turn) {
        // (On a wall or a ceiling, turned about the middle of its cell so that its feet are on the rock.)
        ctx.save(); ctx.translate(px + 8, py + 8); ctx.rotate(turn * Math.PI / 2); ctx.drawImage(image, r[0], r[1], r[2], r[3], -8, -8, 16, 16); ctx.restore();
      } else ctx.drawImage(image, r[0], r[1], r[2], r[3], px, py, 16, 16);
      // (A spitter's glob in flight.)
      if (k === SPITTERS && this.st[i] === ACT) {
        const u = Math.min(1, this.t[i] / SPITTER.flight), gx = this.bx[i] + (this.ax[i] - this.bx[i]) * u, gy = this.by[i] + (this.ay[i] - this.by[i]) * u - Math.sin(u * Math.PI) * 1.2;
        const g = FR[k][P.spitter.glob][0].r;
        ctx.globalAlpha = 1; ctx.drawImage(image, g[0], g[1], g[2], g[3], Math.round(gx * T - ox - 8), Math.round(gy * T - oy - 8), 16, 16);
      }
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < POOL; i++) {
      const k = this.pk[i];
      if (!k || LIT_P[k]) continue;
      const px = Math.round(this.px[i] - ox), py = Math.round(this.py[i] - oy);
      if (px < 0 || py < 0 || px >= game.W || py >= game.H) continue;
      ctx.globalAlpha = 1 - this.pt[i] / this.plife[i]; ctx.fillStyle = INKS[this.pink[i]];
      ctx.fillRect(px, py, k === SPLAT ? 2 : 1, 1);
    }
    ctx.globalAlpha = 1;
  }
  // The pose a creature is drawn in now: by what it is doing, and its own time.
  pose(i, now) {
    const k = this.kind[i], st = this.st[i], t = this.t[i], beat = ((now * 5 + this.ph[i]) | 0) & 1;
    switch (k) {
      case BEETLE: return st === BALL ? P.beetle.ball_a + (((now * 12) | 0) & 3) : st === REST ? P.beetle.ball_a : st === MOVE ? (((now * 8) | 0) & 1 ? P.beetle.walk_b : P.beetle.walk_a) : P.beetle.walk_a;
      case PUPS: return st === SLEEP ? P.pup.sleep : st === WAKE ? (i === this.pal ? P.pup.yip : P.pup.sniff) : st === MOVE ? (((now * 6) | 0) & 1 ? P.pup.walk_b : P.pup.walk_a) : ((now + this.ph[i]) % 4 < 0.15 ? P.pup.blink : ((now * 1.5) | 0) & 1 ? P.pup.idle_b : P.pup.idle_a);
      case MOTHS: return MOTH_FLAP[((now * 14 + this.ph[i]) | 0) & 3];
      case SPITTERS: return st === TELL ? (t > SPITTER.puff * 0.5 ? P.spitter.puff_b : P.spitter.puff_a) : st === ACT && t < 0.15 ? P.spitter.spit : st === REST ? P.spitter.sag : P.spitter.sit;
      case SALAMANDER: return st === SWIM ? P.salamander.swim : st === MOVE ? (((now * 6) | 0) & 1 ? P.salamander.walk_b : P.salamander.walk_a) : P.salamander.bask;
      case BATS: return st === IDLE ? (((now * 1.2 + this.ph[i]) | 0) & 1 ? P.bat.hang_b : P.bat.hang_a) : st === REST ? P.bat.rest : (((now * (st === ACT ? 16 : 9)) | 0) & 1 ? P.bat.fly_b : P.bat.fly_a);
      case FROG: return st === ACT ? P.frog.hop : st === TELL ? (((t * 6) | 0) & 1 ? P.frog.croak : P.frog.sit) : P.frog.sit;
      case PUFFS: return st === CAUGHT ? P.puff.caught : st === AWAY ? P.puff.shy : (((now * 1.6 + this.ph[i]) | 0) & 1 ? P.puff.drift_b : P.puff.drift_a);
      case LEECHES: return st === TELL ? P.leech.stiff : st === FALL ? P.leech.fall : st === AWAY ? P.leech.crawl : (((now * 1.4 + this.ph[i]) | 0) & 1 ? P.leech.hang_b : P.leech.hang_a);
      case SKINK: return st === MOVE || st === ACT ? (((now * 10) | 0) & 1 ? P.skink.walk_b : P.skink.walk_a) : P.skink.sun;
      case WRENS: return st === FLIT || st === AWAY ? (((now * 12) | 0) & 1 ? P.wren.fly_b : P.wren.fly_a) : st === PECK ? (((t * 6) | 0) & 1 ? P.wren.peck : P.wren.perch_a) : st === MOVE ? (beat ? P.wren.peck : P.wren.perch_b) : P.wren.perch_a;
      case BEE: return ((now * 20 + this.ph[i]) | 0) & 1 ? P.bee.fly_b : P.bee.fly_a;
      case JELLY: return ((now * 1.5 + this.ph[i]) | 0) & 1 ? P.jelly.bob_b : P.jelly.bob_a;
      case NEWTS: return st === ACT ? P.newt.lick : st === MOVE ? (((now * 5) | 0) & 1 ? P.newt.walk_b : P.newt.walk_a) : P.newt.walk_a;
    }
    return 0;
  }
  // What rides on the drill, drawn after it in whichever canvas it is drawn in: the pal perched on its tail, a
  // leech fast to its hull. (Inside the drill's own box, so the tether's cut and the box are as they were.)
  rider(game, ctx, dx, dy, ang, alpha = 1) {
    if (this.off || !frames()) return;
    const image = sheets.fauna.image, cos = Math.cos(ang), sin = Math.sin(ang);
    if (this.pal >= 0 && this.st[this.pal] === RIDE) {
      const left = cos < 0 ? 1 : 0, r = FR[PUPS][P.pup.ride][left].r;
      ctx.globalAlpha = alpha * Math.min(1, this.fade[this.pal]);
      ctx.drawImage(image, r[0], r[1], r[2], r[3], Math.round(dx - cos * 6 - 8), Math.round(dy - sin * 6 - 12), 16, 16);
    }
    if (this.latched >= 0) {
      const r = FR[LEECHES][P.leech.latched][cos < 0 ? 0 : 1].r, wob = Math.sin(this.time * 9) * 0.7;
      ctx.globalAlpha = alpha;
      ctx.drawImage(image, r[0], r[1], r[2], r[3], Math.round(dx + sin * 4 - 8 + wob), Math.round(dy - cos * 4 - 7), 16, 16);
    }
    ctx.globalAlpha = 1;
  }
  // Over the dark: each foe's warning (a bat's dashed line, a spitter's dotted arc, a leech's drips falling to the
  // drill) and a foe's shape ringed in FOE_EYE while it warns; the words over a creature; its rings.
  signs(game, ctx, ox, oy) {
    if (this.off || !frames()) return;
    const now = this.time, image = sheets.fauna.image;
    for (let i = 0; i < FAUNA; i++) {
      const k = this.kind[i], st = this.st[i];
      if (!k || CREATURES[k].tier !== 'foe' || (st !== TELL && !(k === BATS && st === ACT))) continue;
      const x0 = this.x[i] * T - ox, y0 = this.mid(i) * T - oy;
      ctx.fillStyle = FOE_EYE;
      if (k === BATS) {
        // (Following the drill, the line flickers; fixed, it is steady and brighter.)
        const fuse = BAT.fuse + this.slot[i] * BAT.stagger, fixed = st === ACT || this.t[i] >= fuse - BAT.lock;
        const ex = (fixed && st === ACT ? this.bx[i] : this.ax[i]) * T - ox, ey = (fixed && st === ACT ? this.by[i] : this.ay[i]) * T - oy;
        const len = Math.hypot(ex - x0, ey - y0) || 1, run = st === ACT ? len : Math.min(len + 40, BAT.run * T), ux = (ex - x0) / len, uy = (ey - y0) / len;
        ctx.globalAlpha = fixed ? 0.9 : 0.35 + 0.3 * Math.sin(now * 30);
        for (let s = (now * 60) % 6; s < run; s += 6) ctx.fillRect(Math.round(x0 + ux * s), Math.round(y0 + uy * s), 2, 1);
      } else if (k === SPITTERS) {
        const ex = this.ax[i] * T - ox, ey = this.ay[i] * T - oy, fixed = this.t[i] >= SPITTER.lock;
        ctx.globalAlpha = fixed ? 1 : 0.65;
        for (let s = 0; s < 1; s += 0.05) { const u = (s + now * 0.4) % 1; ctx.fillRect(Math.round(x0 + (ex - x0) * u), Math.round(y0 + (ey - y0) * u - Math.sin(u * Math.PI) * 1.2 * T), 2, 1); }
        // (Where it will land, a ring of dots.)
        for (let a = 0; a < 8; a++) ctx.fillRect(Math.round(ex + Math.cos(a * 0.785 + now * 3) * 6), Math.round(ey + Math.sin(a * 0.785 + now * 3) * 6), 1, 1);
      } else if (k === LEECHES) {
        ctx.globalAlpha = 0.8;
        const d = game.drill;
        for (let s = (now * 50) % 5; s < (d.y - this.y[i]) * T; s += 5) ctx.fillRect(Math.round(x0), Math.round(y0 + 9 + s), 1, 2);
      }
      // The foe itself ringed in the warning's colour: its shape, not its eyes alone.
      const f = FR[k][this.pose(i, now)][this.face[i] < 0 ? 1 : 0], r = f.r;
      const px = Math.round(this.x[i] * T - ox - 8), py = Math.round(this.top(i) - oy), lit = tinted('fauna', FOE_EYE);
      ctx.globalAlpha = 0.45 + 0.35 * Math.sin(now * 24);
      for (let n = 0; n < 4; n++) ctx.drawImage(lit, r[0], r[1], r[2], r[3], px + SIDES[n][0], py + SIDES[n][1], 16, 16);
      ctx.globalAlpha = 1;
      ctx.drawImage(image, r[0], r[1], r[2], r[3], px, py, 16, 16);
    }
    ctx.globalAlpha = 1;
    for (const s of this.spots) {
      if (s[3] <= 0) continue;
      const u = s[2] / s[3], rad = s[4] * (1 - (1 - u) * (1 - u)), n = Math.max(10, (rad * 1.6) | 0);
      ctx.globalAlpha = (1 - u) * 0.8; ctx.fillStyle = INKS[s[5]];
      for (let a = 0; a < n; a++) ctx.fillRect(Math.round(s[0] - ox + Math.cos(a / n * 6.283) * rad), Math.round(s[1] - oy + Math.sin(a / n * 6.283) * rad), 1, 1);
    }
    for (const w of this.words) {
      if (w.t >= w.life) continue;
      // (Words over a creature follow it while it lives.)
      const i = w.of;
      if (i >= 0 && this.kind[i]) { w.x = this.x[i]; w.y = this.y[i] - (CREATURES[this.kind[i]].place === 'floor' ? 1 : 0.5); }
      ctx.globalAlpha = Math.min(1, (w.life - w.t) * 3);
      // (Kept wholly on the screen, however near its edge the creature is.)
      const half = textWidth(w.text) / 2, x = Math.max(half + 2, Math.min(game.W - half - 2, w.x * T - ox));
      text(ctx, w.text, Math.round(x), Math.max(2, Math.round(w.y * T - oy - 12 - w.t * 6)), w.color, 0.5);
    }
    ctx.globalAlpha = 1;
  }
  // Over the dark, adding light: a foe's eyes (seen across the screen), the moths' and jellies' halos, the newt's
  // spots, and the particles that glow.
  glow(game, ctx, ox, oy) {
    if (this.off || !frames()) return;
    const now = this.time, halo = sheets.halo;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < FAUNA; i++) {
      const k = this.kind[i];
      if (!k || (i === this.pal && this.st[i] === RIDE) || i === this.latched || this.st[i] === HIDE) continue;
      const px = Math.round(this.x[i] * T - ox - 8), py = Math.round(this.top(i) - oy), a = Math.max(0, Math.min(1, this.fade[i])) * (1 - this.dim[i]);
      if (px < -24 || py < -24 || px > game.W + 8 || py > game.H + 8) continue;
      if (CREATURES[k].tier === 'foe') {
        const eyes = FR[k][this.pose(i, now)][this.face[i] < 0 ? 1 : 0].eyes;
        ctx.fillStyle = FOE_EYE;
        const lit = this.st[i] === TELL ? 1 : this.st[i] === REST ? 0.35 : 0.8 + 0.2 * Math.sin(now * 2 + this.ph[i]);
        for (let n = 0; n < eyes.length; n++) { const ex = eyes[n][0], ey = eyes[n][1]; ctx.globalAlpha = a * lit; ctx.fillRect(px + ex, py + ey, 1, 1); ctx.globalAlpha = a * lit * 0.35; ctx.fillRect(px + ex - 1, py + ey, 3, 1); ctx.fillRect(px + ex, py + ey - 1, 1, 3); }
      } else if ((k === MOTHS || k === JELLY) && halo && !game.daylight) {
        const r = halo.frames['halo-ice'];
        if (r) { ctx.globalAlpha = a * (k === MOTHS ? 0.4 : 0.35) * (0.85 + 0.15 * Math.sin(now * 3 + this.ph[i])); ctx.drawImage(halo.image, r[0], r[1], r[2], r[3], Math.round(px + 8 - r[2] / 2), Math.round(py + 8 - r[3] / 2), r[2], r[3]); }
      } else if (k === NEWTS) {
        // Its spots alight, turned with it on a wall or a ceiling.
        const turn = this.footing(i), lamps = FR[k][this.pose(i, now)][this.face[i] < 0 ? 1 : 0].lamps, glow = a * (0.5 + 0.3 * Math.sin(now * 2 + this.ph[i]));
        ctx.fillStyle = INKS[LIGHT_INK];
        for (let n = 0; n < lamps.length; n++) {
          const lx = px + turnX(lamps[n][0], lamps[n][1], turn), ly = py + turnY(lamps[n][0], lamps[n][1], turn);
          ctx.globalAlpha = glow; ctx.fillRect(lx, ly, 1, 1); ctx.globalAlpha = glow * 0.35; ctx.fillRect(lx - 1, ly, 3, 1); ctx.fillRect(lx, ly - 1, 1, 3);
        }
        if (this.st[i] === ACT) {
          // Its tongue of light, from its mouth out to the cap.
          const mu = this.face[i] < 0 ? 2 : 13, c = this.cell[i], sx = px + turnX(mu, 13, turn), sy = py + turnY(mu, 13, turn), ey = (Math.floor(c / N) + 0.5) * T - oy, ux = (c % N + 0.5) * T - ox;
          const u = Math.min(1, this.t[i] / 0.25) * (this.t[i] < 0.35 ? 1 : Math.max(0, 1 - (this.t[i] - 0.35) / 0.15));
          ctx.globalAlpha = a * 0.9;
          for (let s = 0; s <= 1; s += 0.08) if (s <= u) ctx.fillRect(Math.round(sx + (ux - sx) * s), Math.round(sy + (ey - sy) * s), 1, 1);
        }
      }
    }
    for (let i = 0; i < POOL; i++) {
      const k = this.pk[i];
      if (!k || !LIT_P[k]) continue;
      const px = Math.round(this.px[i] - ox), py = Math.round(this.py[i] - oy), u = this.pt[i] / this.plife[i];
      ctx.globalAlpha = 1 - u; ctx.fillStyle = INKS[this.pink[i]];
      if (k === HEART) { ctx.fillRect(px - 1, py, 1, 1); ctx.fillRect(px + 1, py, 1, 1); ctx.fillRect(px - 1, py + 1, 3, 1); ctx.fillRect(px, py + 2, 1, 1); }
      else ctx.fillRect(px, py, 1, 1);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  // The light the creatures give, inside the drawing's own (`Game.light`): the moths, brightest, ahead of the lamp;
  // the jellies and the newt a little.
  lights(game) {
    if (this.off) return;
    let n = 0;
    for (let i = 0; i < FAUNA && n < this.glowing.length; i++) {
      const k = this.kind[i];
      if ((k !== MOTHS && k !== JELLY && k !== NEWTS) || this.fade[i] < 0.3) continue;
      const g = this.glowing[n++];
      g[0] = Math.floor(this.x[i]); g[1] = Math.floor(this.y[i] - (k === NEWTS ? 0.5 : 0)); g[2] = (k === MOTHS ? MOTH.power : k === JELLY ? 0.4 : 0.3) * this.fade[i]; g[3] = k === MOTHS ? MOTH.reach : 2;
    }
    this.lit = n;
    for (let m = 0; m < n; m++) { const g = this.glowing[m]; game.shine(g[0], g[1], g[2], g[3]); }
  }

  // ---------------------------------------------------------------- staging (js/shot.js and the tests)
  // A creature of a kind set down beside the drill, in the nearest place within `r` cells that suits it (or at the
  // cell `at`, as it is), with a den of its own (no home in a seed-laid cave asked for, nor the distance from the
  // core): its first slot, or -1.
  stage(game, name, r = 8, at = -1) {
    const kind = ID[name];
    if (!kind) return -1;
    const d = game.drill, w = game.world, key = this.keyOf(2, kind, 0), den = this.dens.get(key) ?? this.spare.pop() ?? this.blank();
    this.w = w;
    Object.assign(this.clear(den), { key, grid: 2, sx: kind, kind, row: w.b(game.di), mx: Math.floor(d.x), my: Math.floor(d.y), flock: CREATURES[kind].n[1], staged: true, used: this.frame });
    this.dens.set(den.key, den);
    // (Not on the drill's own cell: a few cells from it.)
    den.anchor = at >= 0 ? at : this.home(game, den, Math.floor(d.x), Math.floor(d.y), r, false, 3);
    if (den.anchor < 0) den.anchor = this.home(game, den, Math.floor(d.x), Math.floor(d.y), r + 6, false, 2);
    if (den.anchor < 0) return -1;
    this.populate(game, den);
    let first = -1;
    for (let i = 0; i < FAUNA; i++) if (this.kind[i] === kind && this.denAt(i) === den) { this.fade[i] = 1; if (first < 0) first = i; }
    return first;
  }
  // A staged creature put in a state of its own, for a picture or a test: `pal` (a pup befriended), `ride` (and
  // riding), `fuse` (a roost woken), `puff` (a spitter swelling), `latched` (a leech on the hull), `caught` (a
  // puffling lassoed), `peck` (a wren off to its find). Whatever it is not, it is left as it is.
  stageAs(game, i, what) {
    if (i < 0 || !this.kind[i]) return false;
    const k = this.kind[i], den = this.denAt(i);
    if (k === PUPS && (what === 'pal' || what === 'ride')) { this.befriend(game, i); if (what === 'ride') { this.set(i, RIDE); this.x[i] = game.drill.x; this.y[i] = game.drill.y; } return this.pal === i; }
    if (k === BATS && what === 'fuse' && den) { den.st = 1; den.hits = 0; den.woke++; return true; }
    if (k === SPITTERS && what === 'puff') { this.set(i, TELL); this.tell(game, i); return true; }
    if (k === LEECHES && what === 'latched') { if (!this.deed(game, 'drag', i) && !this.tame) return false; this.set(i, LATCH); this.latched = i; return true; }
    if (k === PUFFS && what === 'caught') { this.set(i, CAUGHT); return true; }
    if (k === WRENS && what === 'peck') { if (!this.findFor(game, i)) return false; this.set(i, FLIT); return true; }
    return false;
  }
}
