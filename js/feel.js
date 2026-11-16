// The feel of each ground: what it does by itself while the drill is in it, and what the drill's flight sets off.
// Drops of water fall from the ceilings and plink; in the north the ice groans, and frost creeps in at the corners
// of the view; in the south the ground shakes now and then and vents in the cave floors spit sparks; in the west
// fireflies come to the lamp and gas blubs out of the floor; in the east the wind gets up and sand pours from the
// roof over a fresh cut; the pockets each have something of their own (shooting stars over a drift, ash falling on
// the flats, honey dripping in a hive). Over all of it lies a layer the size of the screen in the ground's colour:
// a fog, an edge of dark or of heat from below, rime in the corners. A cross has its host's feel and a touch of its
// donor's at half strength. Each ground's is a row of `FEELS`, by the ground's name; a ground with none of its own
// (a row a test makes) has its direction's. And where a ground's caves have icicles (js/decor.js), one that the
// drill flies under shivers and falls and shatters, and a quake shakes a few loose.
//
// It is only feel. What must stay true:
//   - Nothing here changes a cell, the flight, the hull, the tether, a haul or what anything pays, and nothing
//     here is asked by the game's rules: a game with the feel taken out plays exactly the same
//     (test/regress/s6-feel.mjs plays two side by side).
//   - It never draws from Math.random (the game's tests count those draws): it has a generator of its own, seeded
//     from the world's seed. And it never writes the game's own particles, motes, shake or flash: what it shows is
//     its own, in a pool of POOL particles made once and used again, so a frame makes nothing new. (The motes are
//     drawn leaning with its wind, `drift`, and are not moved.)
//   - What it keeps that the drawing reads is the icicles that have fallen (`fallen`, which is the game's
//     `game.fallen`): a fall is kept only when an icicle hung there and its particle was made, the piece of ground
//     it hung in is drawn again without it (`game.redraw`), and they are all given back with everything else when
//     the feel is begun again (a new world, a game loaded, a trip lost). An icicle hurts nothing and changes no cell.
//   - It reads the world only where it has been seen (`peek`, and the piece's own ground for a seen cell), so no
//     piece of the world is ever made for it; whether a floor is a natural cave's is asked (`first`) only of the
//     few cells whose hash has already chosen them for a vent.
//   - What it knows of the cells in view is kept a piece of 8 x 8 cells at a time, the pieces the drawing uses,
//     and a piece is looked at again only when the ground has changed and what its cells are has changed with it.
//   - Within CALM cells of the core nothing comes by itself: home is quiet. The clock its events keep stands still
//     while the shop or the lab is open, as the game's own does; what is already moving goes on moving.
//   - Its sounds (js/audio.js, "the sounds of the ground") are few and soft: one a second or so at the most of
//     those that come by themselves (an icicle a quake shakes loose among them), only within HEAR cells of the
//     drill, and none while a wreck ticks, a haul comes in or a banner is up. Those the drill sets off itself are
//     kept apart only by their own least gap, and are heard only within HEAR cells of it too.
//   - The layers over the whole screen are not drawn in a lit view (a staged picture of the ground).
import { N, C, K, BIOMES, rowOf, cellHash } from './world.js';
import { sheets, draw } from './atlas.js';
import { sfx, PLINK } from './audio.js';
import { framesOf, falls, placeOf } from './decor.js';

const T = 16;                                   // pixels in a cell, as js/drawing.js has it
const CALM = 40;                                // within this many cells of the core nothing comes by itself
const HEAR = 10;                                // how far from the drill a placed sound is heard, in cells
const QUIET = 1.2;                              // the least time between two sounds that come by themselves
const POOL = 160, FLIES = 10;                   // the most particles and fireflies there ever are
const PIECES = 64;                              // the most pieces of 8 x 8 cells it knows at once
const VENTS = 12;                               // the most vents in view it keeps going
const BUILDS = 4;                               // the most pieces it looks at afresh in a frame
const GRAVITY = 300;                            // pixels a second, a second, for what falls
const SHIVER = 0.35, LOOSE = 0.3;               // how long an icicle shivers before it falls; the least time between two falling
const UNDER = 4;                                // how many cells over the drill an icicle falls from as it flies under

// ---------------------------------------------------------------- the table
// A row of FEELS says what a ground does; everything is optional:
//   drip     { every: [a, b], color, step, slow? }   a drop swells on a ceiling in view, falls and plinks (`step`
//                                             is its note of PLINK in js/audio.js, the key of the music that is
//                                             playing, or 'scale' for any note of that key's scale);
//                                             `slow`, it is a big drop that swells for longer (honey)
//   creak    { every, pitch }                 the ice groans, and a hairline crack shows on a face in view
//   quake    { every, power }                 the ground shakes (the view only), grit falls from the ceilings, and
//                                             in caves with icicles a few in view are shaken loose
//   gust     { every, strength, streak, haze? }   the wind gets up for a few seconds: streaks cross the view, and
//                                             what the feel lets float leans with it (`haze`: the fog thickens by so
//                                             much while it blows). The game's own motes are drawn leaning with it.
//   bubble   { every, color }                 gas rises from a floor, wobbles and pops
//   steam    { every, color }                 a puff of steam out of a floor
//   trickle  { cut, every?, color }           sand pours from the roof over a cut just finished, for `cut`
//                                             seconds, and from a ceiling by itself every so often
//   settle   { cut, color? }                  the same, a few crumbs and no sound
//   stars    { every, color }                 a shooting star crosses the upper half of the view
//   worm     { every }                        a worm pokes out of a face of soft rock near the drill
//   crackle  { every }                        a vent in view spits a burst of sparks aloud
//   vent     { p, colors: [crack, spark, spark], rate }   that share of natural cave floors glow and spit sparks
//   flies    { most, color }                  fireflies, which come to the drill's lamp
//   fall     { color, rate, speed, sway? }    ash or spores drifting down through the open ground, one every
//                                             `rate` seconds (`sway`: swaying wide as they go)
//   glint    { tries, color }                 more glints on ore, crystal and mineral in view
//   wake     { kind: 'frost'|'heat'|'drip'|'dust', color, strong? }    what the drill gives off
//   fog      { color: [r, g, b], alpha, speed }                        a slow soft layer over the view
//   edge     { color, alpha, below?, pulse? }                          the edge of the view darkened (or, `below`,
//                                                                       heat rising from the foot of the screen)
//   rime     { color, build }                                          frost growing in at the corners of the view
//                                                                       over `build` seconds, gone at the core
const FROST_WAKE = { kind: 'frost', color: '#dff4ff' }, DRIP_WAKE = { kind: 'drip', color: '#7ab89a' }, DUST_WAKE = { kind: 'dust', color: '#c8a070' };
const EMBER_VENT = { p: 0.05, colors: ['#ff6a2a', '#ff9a3a', '#ffd070'], rate: 1 };
export const FEELS = {
  crust: { drip: { every: [5, 10], color: '#8a98a6', step: -5 }, worm: { every: [14, 28] }, settle: { cut: 0.6 }, edge: { color: [20, 14, 8], alpha: 0.45 } },
  frost: { creak: { every: [10, 22], pitch: 1 }, drip: { every: [9, 16], color: '#bcd8ee', step: 3 }, wake: FROST_WAKE,
    edge: { color: [150, 200, 255], alpha: 0.4 }, rime: { color: '#dff4ff', build: 45 } },
  rime: { creak: { every: [7, 16], pitch: 0.8 }, gust: { every: [20, 40], strength: 0.8, streak: '#d8fff4' }, wake: FROST_WAKE,
    edge: { color: [80, 220, 210], alpha: 0.5 }, rime: { color: '#d8fff4', build: 30 } },
  firn: { creak: { every: [6, 14], pitch: 0.7 }, wake: FROST_WAKE, edge: { color: [130, 170, 230], alpha: 0.36 }, rime: { color: '#eef6ff', build: 60 } },
  serac: { creak: { every: [5, 11], pitch: 1.4 }, drip: { every: [8, 14], color: '#cfe8f8', step: 5 }, wake: FROST_WAKE,
    edge: { color: [170, 220, 255], alpha: 0.43 }, rime: { color: '#eaf8ff', build: 35 } },
  ember: { vent: EMBER_VENT, quake: { every: [22, 45], power: 1 }, wake: { kind: 'heat', color: '#ff7a2a' },
    edge: { color: [255, 90, 30], alpha: 0.36, below: true, pulse: true } },
  magma: { vent: { ...EMBER_VENT, p: 0.09 }, quake: { every: [12, 26], power: 1.6 }, fall: { color: '#5a3a34', rate: 0.25, speed: 10 },
    wake: { kind: 'heat', color: '#ff5a1a', strong: true }, edge: { color: [255, 60, 20], alpha: 0.5, below: true, pulse: true }, fog: { color: [200, 80, 40], alpha: 0.1, speed: 0.2 } },
  scoria: { vent: { ...EMBER_VENT, p: 0.03 }, steam: { every: [3, 6], color: '#d8c4c4' }, quake: { every: [30, 60], power: 0.7 }, wake: { kind: 'heat', color: '#ff8a4a' },
    edge: { color: [220, 120, 90], alpha: 0.29, below: true } },
  forge: { vent: { ...EMBER_VENT, p: 0.08, rate: 2 }, quake: { every: [14, 30], power: 1.2 }, wake: { kind: 'heat', color: '#ff7a2a', strong: true },
    edge: { color: [255, 90, 30], alpha: 0.43, below: true, pulse: true } },
  mire: { drip: { every: [2.5, 5], color: '#7ab89a', step: 2 }, flies: { most: 5, color: '#b4f070' }, bubble: { every: [4, 8], color: '#8ac070' }, wake: DRIP_WAKE,
    fog: { color: [150, 130, 190], alpha: 0.12, speed: 0.3 }, edge: { color: [40, 10, 60], alpha: 0.45 } },
  bloom: { drip: { every: [2, 4], color: '#c890d0', step: 4 }, flies: { most: 9, color: '#ffa0e0' }, bubble: { every: [3, 6], color: '#7af0d0' }, wake: { kind: 'drip', color: '#c890d0' },
    fog: { color: [220, 140, 220], alpha: 0.12, speed: 0.3 }, edge: { color: [70, 10, 70], alpha: 0.5 } },
  tangle: { drip: { every: [1.8, 3.5], color: '#7ab89a', step: 1 }, flies: { most: 8, color: '#c8f080' }, bubble: { every: [6, 12], color: '#8ac070' }, wake: DRIP_WAKE,
    fog: { color: [140, 180, 150], alpha: 0.1, speed: 0.25 }, edge: { color: [10, 30, 20], alpha: 0.5 } },
  sporefall: { drip: { every: [3, 6], color: '#a888b8', step: 3 }, flies: { most: 3, color: '#b4f070' }, fall: { color: '#b898c6', rate: 0.3, speed: 5, sway: true }, wake: DRIP_WAKE,
    fog: { color: [200, 170, 220], alpha: 0.14, speed: 0.2 }, edge: { color: [40, 20, 50], alpha: 0.4 } },
  lode: { trickle: { cut: 1.2, every: [5, 10], color: '#f0d8a0' }, gust: { every: [16, 32], strength: 1, streak: '#f0d8a0' }, glint: { tries: 1, color: '#ffffff' },
    wake: DUST_WAKE, edge: { color: [255, 180, 80], alpha: 0.25 } },
  gilt: { trickle: { cut: 1.2, every: [4, 8], color: '#ffe680' }, gust: { every: [12, 24], strength: 1.2, streak: '#ffe680' }, glint: { tries: 3, color: '#ffe680' },
    wake: { kind: 'dust', color: '#d8b860' }, edge: { color: [255, 210, 60], alpha: 0.32 }, fog: { color: [240, 200, 100], alpha: 0.08, speed: 0.15 } },
  redrock: { trickle: { cut: 1.2, every: [6, 12], color: '#f0b080' }, gust: { every: [12, 24], strength: 1, streak: '#f0b080' }, wake: { kind: 'dust', color: '#c07850' },
    edge: { color: [255, 110, 60], alpha: 0.32 } },
  loess: { trickle: { cut: 2, color: '#e4dcc8' }, gust: { every: [8, 16], strength: 1, streak: '#f0ead8', haze: 0.08 }, wake: { kind: 'dust', color: '#e4dcc8', strong: true },
    fog: { color: [230, 210, 170], alpha: 0.18, speed: 0.15 }, edge: { color: [120, 90, 50], alpha: 0.25 } },
  hive: { drip: { every: [4, 7], color: '#ffb020', step: -2, slow: true }, fog: { color: [255, 190, 80], alpha: 0.1, speed: 0.15 }, edge: { color: [255, 170, 40], alpha: 0.36 } },
  drift: { stars: { every: [6, 14], color: '#bfe8ff' }, glint: { tries: 2, color: '#7fd0ff' }, edge: { color: [20, 60, 140], alpha: 0.36 } },
  ash: { fall: { color: '#9a9aa0', rate: 0.06, speed: 16 }, gust: { every: [8, 16], strength: 1.2, streak: '#b0b0b4' }, fog: { color: [170, 170, 176], alpha: 0.16, speed: 0.25 } },
  grotto: { drip: { every: [1.5, 3], color: '#58f0e0', step: 'scale' }, flies: { most: 3, color: '#58f0e0' }, fog: { color: [80, 200, 190], alpha: 0.08, speed: 0.2 },
    edge: { color: [0, 40, 40], alpha: 0.54 } },
  tinder: { vent: { p: 0.12, colors: ['#ff5a3a', '#ffb030', '#ff5a3a'], rate: 1.5 }, crackle: { every: [2, 5] }, fall: { color: '#3a3032', rate: 0.6, speed: 8 },
    wake: { kind: 'heat', color: '#ff7a3a' }, edge: { color: [255, 120, 40], alpha: 0.32, below: true } },
  glaze: { creak: { every: [6, 12], pitch: 1.8 }, glint: { tries: 2, color: '#a8fff0' }, wake: FROST_WAKE, edge: { color: [120, 200, 255], alpha: 0.36 }, rime: { color: '#e8fbff', build: 25 } },
  shale: { settle: { cut: 1.5, color: '#c8c0a0' }, wake: { kind: 'dust', color: '#a89c78' }, fog: { color: [180, 170, 140], alpha: 0.1, speed: 0.15 } },
};
// The ground whose feel a direction has, for a row with no feel of its own: by its kin.
const KIN_FEEL = ['crust', 'frost', 'ember', 'mire', 'lode'];
// What a direction lends a cross it is the donor of: its own mark, at half strength (`half`).
const SIGN = {
  frost: { creak: { every: [10, 22], pitch: 1 }, rime: { color: '#dff4ff', build: 45 } },
  ember: { quake: { every: [22, 45], power: 1 }, vent: EMBER_VENT },
  mire: { drip: { every: [2.5, 5], color: '#7ab89a', step: 2 }, flies: { most: 6, color: '#b4f070' } },
  lode: { gust: { every: [16, 32], strength: 1, streak: '#f0d8a0' }, trickle: { cut: 1.2, every: [5, 10], color: '#f0d8a0' } },
};
// Half strength: what comes every so often comes half as often, what is a share is half of it, a strength or a
// power is six tenths, a number of flies half, and frost takes twice as long to grow.
const half = entry => ({ ...entry, ...(entry.every && { every: entry.every.map(s => s * 2) }), ...(entry.p && { p: entry.p / 2 }), ...(entry.power && { power: entry.power * 0.6 }),
  ...(entry.strength && { strength: entry.strength * 0.6 }), ...(entry.most && { most: Math.max(1, Math.round(entry.most / 2)) }), ...(entry.build && { build: entry.build * 2 }) });
const EVENTS = ['drip', 'creak', 'quake', 'gust', 'bubble', 'steam', 'trickle', 'stars', 'worm', 'crackle'];
// What a forced event does in ground that has none of it (`force`, for pictures and tests).
const PLAIN = { drip: { every: [5, 10], color: '#8a98a6', step: 0 }, creak: { every: [10, 20], pitch: 1 }, quake: { every: [20, 40], power: 1 }, gust: { every: [15, 30], strength: 1, streak: '#d8d0c0' },
  bubble: { every: [5, 10], color: '#8ac070' }, steam: { every: [4, 8], color: '#d8c4c4' }, trickle: { cut: 1.2, every: [5, 10], color: '#f0d8a0' }, stars: { every: [6, 14], color: '#bfe8ff' },
  worm: { every: [14, 28] }, crackle: { every: [2, 5] } };

// A ground's feel, worked out once for each row (and kept by the row itself, so a row a test puts in another's
// place is worked out afresh): its own, or for a cross its host's with its donor's mark added where the host has
// none of that, or its direction's.
const known = new WeakMap();
export function feelOf(row) {
  let f = known.get(row);
  if (f) return f;
  if (row.cross) {
    const host = FEELS[BIOMES[row.cross.host]?.name] ?? FEELS[KIN_FEEL[row.kin]] ?? {}, mark = SIGN[KIN_FEEL[row.cross.donor]] ?? {};
    f = { ...host };
    for (const [key, entry] of Object.entries(mark)) if (!f[key]) f[key] = half(entry);
  } else f = FEELS[row.name] ?? FEELS[KIN_FEEL[row.kin]] ?? FEELS.crust;
  // (What the drawing needs of it is named once here, not in a frame: each layer over the screen, known by its
  // spec, which is the same object in every ground that has the same layer, and its picture's name, which is its
  // colour and kind, as the picture is.)
  f = { ...f, layers: layersOf(f) };
  known.set(row, f);
  return f;
}
const layersOf = f => [f.fog && { key: `fog:${f.fog.color}`, spec: f.fog, fog: true }, f.edge && { key: `edge:${f.edge.color}:${f.edge.below ? 1 : 0}`, spec: f.edge, fog: false }].filter(Boolean);
// The pictures of the layers over the screen, by name, made once for all games (`texture`); and every layer any ground
// has, one of whose pictures is made in each of the first frames of a game (`step`), so that none is made in the
// frame the drill comes into a ground (a cross has its host's layers, and a row a test makes its direction's).
const ART = new Map(), READY = [];
for (const f of Object.values(FEELS)) for (const l of layersOf(f)) if (!READY.some(r => r.key === l.key)) READY.push(l);
// Whether a ground's caves have icicles that may fall (asked once the sheets are loaded, and kept by the row).
const icy = new WeakMap();
function icyOf(row) {
  let v = icy.get(row);
  if (v !== undefined) return v;
  const sets = framesOf().sets;
  if (!sets[row.decor]) return false;
  v = [row.decor, row.decor2].some(set => !!set && !!sets[set]?.top.some(falls));
  icy.set(row, v);
  return v;
}
// The frames of the icicles that are falling, by number, so that a particle holds a number and not a string.
const SHAPES = [null], SHAPE = new Map();
const shapeOf = name => { let n = SHAPE.get(name); if (n === undefined) { n = SHAPES.length; SHAPES.push(name); SHAPE.set(name, n); } return n; };

// The values `val` on a grid `gw` x `gh` that wraps, eased between, at (fx, fy) in the grid's own squares.
const ease = t => t * t * (3 - 2 * t);
function wraps(val, gw, gh, fx, fy) {
  const ix = Math.floor(fx), iy = Math.floor(fy), u = ease(fx - ix), t = ease(fy - iy);
  const x0 = ix % gw, x1 = (ix + 1) % gw, y0 = (iy % gh) * gw, y1 = ((iy + 1) % gh) * gw;
  return (val[y0 + x0] * (1 - u) + val[y0 + x1] * u) * (1 - t) + (val[y1 + x0] * (1 - u) + val[y1 + x1] * u) * t;
}

// ---------------------------------------------------------------- the particles
// Each kind moves as its own: what falls (a drop, a shard, a grain) falls until the floor worked out when it was
// born; a flake drifts and sways; a puff and a spark rise; a streak runs with the wind. A drop that lands splashes,
// and a bubble at the end of its rise pops. Those marked lit are drawn over the dark, adding light.
const DROP = 1, SPLASH = 2, SHARD = 3, GRAIN = 4, FLAKE = 5, PUFF = 6, SPARK = 7, STREAK = 8, RING = 9, POP = 10, STAR = 11, GLINT = 12, WORM = 13, CRACK = 14, ICICLE = 15;
const LIT = [false, false, false, false, false, false, false, true, false, false, false, true, true, false, false, false];
// Every colour a particle can be, by number, so that a particle holds a number and not a string.
const INKS = [], INK = new Map();
const ink = color => { let n = INK.get(color); if (n === undefined) { n = INKS.length; INKS.push(color); INK.set(color, n); } return n; };
const WHITE = ink('#ffffff'), BREATH = ink('#e8f4ff'), WORMS = [ink('#c88a7a'), ink('#a86a5c')], CRYSTAL = ink('#e0c8ff');

export class Feel {
  constructor() {
    this.x = new Float32Array(POOL); this.y = new Float32Array(POOL); this.vx = new Float32Array(POOL); this.vy = new Float32Array(POOL);
    this.t = new Float32Array(POOL); this.life = new Float32Array(POOL); this.floor = new Float32Array(POOL);
    this.kind = new Uint8Array(POOL); this.ink = new Uint16Array(POOL); this.size = new Uint8Array(POOL);
    this.alone = new Uint8Array(POOL);          // of an icicle, whether it came down by itself (a quake shook it loose)
    this.live = 0; this.hunt = 0;
    // Fireflies: where each is (pixels), its own phase, the cell of ore it keeps to (-1: none), how long it has
    // been, how long it is to be, and until when it keeps away from the drill.
    this.fx = new Float32Array(FLIES); this.fy = new Float32Array(FLIES); this.fvx = new Float32Array(FLIES); this.fvy = new Float32Array(FLIES);
    this.fphase = new Float32Array(FLIES); this.fhome = new Int32Array(FLIES); this.ft = new Float32Array(FLIES); this.flife = new Float32Array(FLIES); this.fshy = new Float32Array(FLIES);
    this.fink = new Uint16Array(FLIES); this.flies = 0;
    // Sand pouring: up to four streams at once, each [x, y, floor, seconds left, colour, grains a second].
    this.pours = Array.from({ length: 4 }, () => new Float32Array(6));
    // The pieces of 8 x 8 cells it knows (see `refresh`), and the vents in view.
    this.pieces = new Map(); this.spare = Array.from({ length: PIECES }, () => ({ key: -1, cx: 0, cy: 0, v: -1, sum: 0, used: 0, nc: 0, nf: 0, nv: 0, ceil: new Int32Array(64), floors: new Int32Array(64), vents: new Int32Array(8) }));
    this.vents = new Int32Array(VENTS); this.ventInk = new Uint16Array(VENTS * 3); this.ventRate = new Float32Array(VENTS); this.nv = 0;
    // Each event's clock: seconds until it next comes (NaN: not yet set going).
    this.next = new Float64Array(EVENTS.length);
    this.glowing = [];                          // the lights this frame, [x, y, power, reach] (`lights`)
    for (let n = 0; n < 8; n++) this.glowing.push([0, 0, 0, 0]);
    this.layers = [];                           // the screen's layers as they ease in and out: { key, alpha, spec, fog }
    this.art = ART;                             // what each layer is drawn from, made once for each colour
    this.frosts = new Map();                    // the frost at the corners, by colour: a picture for each stage of growth
    this.fallen = new Set();                    // the cells whose icicle has fallen (the game's `fallen`, which the drawing reads)
    this.loose = new Int32Array(8);             // the icicles a quake may shake loose, while it chooses
    this.told = new Map();                      // the cuts about to close over that have creaked: by cell, when each was cut
    this.reset(7);
  }
  reset(seed) {
    this.seed = (Math.imul(seed | 0, 2654435761) ^ 0x5bd1e995) >>> 0;
    this.kind.fill(0); this.live = 0; this.flies = 0; this.nv = 0; for (const s of this.pours) s[3] = 0;
    for (const p of this.pieces.values()) { p.key = -1; p.built = false; this.spare.push(p); }
    this.pieces.clear();
    this.next.fill(NaN);
    this.time = 0; this.frame = 0; this.F = null;
    this.quake = 0; this.rumble = 0; this.rumbleOf = 0; this.power = 0;      // the shake now; how long the quake has left, of how long; how hard
    this.wind = 0; this.windTo = 0; this.gustLeft = 0; this.haze = 0; this.streak = WHITE;   // the wind (pixels a second), what it eases to, for how long; how thick the haze is
    this.heard = -9; this.tellAt = -9; this.crackleAt = -9; this.pourAt = -9; this.lavaAt = -9; this.lavaWas = 0;
    this.lastDig = -1; this.breathIn = 0; this.wakeIn = 0; this.hot = 0; this.flyIn = 0; this.fallIn = 0; this.tellIn = 0;
    this.rime = 0; this.layers.length = 0; this.lit = 0; this.forced = null; this.cv = -1;
    this.fallen.clear(); this.icicleNext = 0; this.watchIn = 0; this.drift = 0;
    this.told.clear();
    this.work = 0;                              // cells looked at this frame, for the tests
    this.events = 0;                            // how many events have come since the reset (for the tests)
  }
  // The feel's own numbers, from 0 up to 1.
  rnd() { return (this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0) / 4294967296; }
  between([a, b]) { return a + (b - a) * this.rnd(); }

  // A particle, if there is room: its number, or -1.
  spawn(kind, x, y, vx, vy, life, inkN, size = 1, floor = 1e9) {
    let i = -1;
    for (let n = 0; n < POOL; n++) { const j = (this.hunt + n) % POOL; if (!this.kind[j]) { i = j; break; } }
    if (i < 0) return -1;
    this.hunt = (i + 1) % POOL;
    this.kind[i] = kind; this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy; this.t[i] = 0; this.life[i] = life; this.ink[i] = inkN; this.size[i] = size; this.floor[i] = floor;
    this.live++;
    return i;
  }

  // ---------------------------------------------------------------- what is in view
  // The cells in view, as the drawing has them: the corners, in cells.
  view(game) {
    const ox = game.cam.x - game.W / 2, oy = game.cam.y - (game.H - 44) / 2;
    this.x0 = Math.floor(ox / T); this.y0 = Math.floor(oy / T); this.x1 = Math.floor((ox + game.W) / T); this.y1 = Math.floor((oy + game.H - 44) / T);
  }
  // What the pieces in view hold, looked at again where the ground has changed: of each open cell, whether it has
  // rock over it (a ceiling) or under it (a floor), and which floors are vents. A piece is known by a sum of what
  // its 64 cells are, and its lists are made again only when that sum has moved.
  refresh(game) {
    // (A view wider than a phone's, a zoomed picture, is known only for three pieces each way about the drill.)
    const w = game.world, dx = Math.floor(game.drill.x) >> 3, dy = Math.floor(game.drill.y) >> 3;
    const cx0 = Math.max(dx - 3, (this.x0 - 1) >> 3), cy0 = Math.max(dy - 3, (this.y0 - 1) >> 3), cx1 = Math.min(dx + 3, (this.x1 + 1) >> 3), cy1 = Math.min(dy + 3, (this.y1 + 1) >> 3);
    // (The view slid a cell within the same pieces, the ground unchanged: no piece is looked at again, but the vents
    // in view are, as one may have come into it or gone out of it.)
    const moved = cx0 !== this.rx0 || cy0 !== this.ry0 || cx1 !== this.rx1 || cy1 !== this.ry1;
    const slid = this.x0 !== this.sx0 || this.y0 !== this.sy0 || this.x1 !== this.sx1 || this.y1 !== this.sy1;
    if (!moved && !slid && game.version === this.cv) return;
    this.cv = game.version; this.rx0 = cx0; this.ry0 = cy0; this.rx1 = cx1; this.ry1 = cy1;
    this.sx0 = this.x0; this.sy0 = this.y0; this.sx1 = this.x1; this.sy1 = this.y1;
    // (No more than BUILDS pieces are made again in a frame: the rest are, in the frames after.)
    let builds = 0;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const key = cy * 4096 + cx;
      let p = this.pieces.get(key);
      if (!p) { p = this.claim(); p.key = key; p.cx = cx; p.cy = cy; p.v = -1; p.built = false; this.pieces.set(key, p); }
      p.used = this.frame;
      if (p.v === game.version) continue;
      if (builds >= BUILDS) { this.cv = -1; continue; }
      p.v = game.version;
      let sum = 0x811c9dc5;
      for (let y = cy * 8; y < cy * 8 + 8; y++) for (let x = cx * 8; x < cx * 8 + 8; x++) sum = Math.imul(sum ^ (w.peek(x, y) + 2 + (w.lava.has(y * N + x) ? 64 : 0)), 16777619);
      this.work += 64;
      if (p.built && sum === p.sum) continue;
      p.sum = sum; p.built = true; builds++;
      this.build(game, p);
    }
    // The vents in view, the nearest the drill first when there are more than room for.
    this.nv = 0;
    const d = game.drill;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const p = this.pieces.get(cy * 4096 + cx);
      if (!p?.built) continue;
      for (let n = 0; n < p.nv; n++) {
        const i = p.vents[n], x = i % N, y = Math.floor(i / N);
        if (x < this.x0 - 1 || x > this.x1 + 1 || y < this.y0 - 1 || y > this.y1 + 1) continue;
        let at = this.nv;
        if (at >= VENTS) {
          // (Full: the vent furthest from the drill gives way, if this one is nearer.)
          let worst = 0, far = -1;
          for (let m = 0; m < VENTS; m++) { const j = this.vents[m], e = Math.hypot((j % N) - d.x, Math.floor(j / N) - d.y); if (e > far) { far = e; worst = m; } }
          if (Math.hypot(x - d.x, y - d.y) >= far) continue;
          at = worst;
        } else this.nv++;
        const vent = feelOf(this.rowAt(w, x, y) ?? BIOMES[0]).vent ?? EMBER_VENT;
        this.vents[at] = i; this.ventRate[at] = vent.rate ?? 1;
        for (let c = 0; c < 3; c++) this.ventInk[at * 3 + c] = ink(vent.colors[c]);
      }
    }
  }
  // The piece cell `i` is in is looked at again at the next frame (lava has come into the cell or gone out of it),
  // and no other.
  redraw(i) { const p = this.pieces.get((Math.floor(i / N) >> 3) * 4096 + ((i % N) >> 3)); if (p) p.v = -1; this.cv = -1; }
  claim() {
    const p = this.spare.pop();
    if (p) return p;
    // (None spare: the piece looked at longest ago gives way.)
    let old = null;
    for (const q of this.pieces.values()) if (!old || q.used < old.used) old = q;
    this.pieces.delete(old.key);
    old.built = false;
    return old;
  }
  build(game, p) {
    const w = game.world;
    p.nc = 0; p.nf = 0; p.nv = 0;
    for (let y = p.cy * 8; y < p.cy * 8 + 8; y++) for (let x = p.cx * 8; x < p.cx * 8 + 8; x++) {
      if (w.peek(x, y) !== K.EMPTY) continue;
      const i = y * N + x;
      if (w.peek(x, y - 1) > 0) p.ceil[p.nc++] = i;
      if (w.peek(x, y + 1) > 0) {
        p.floors[p.nf++] = i;
        // A vent: chosen by the cell's hash among the floors of ground that has them, and only in a natural cave's
        // floor, never in a tunnel just cut (the world is asked what the cell was only once the hash has chosen it).
        const vent = p.nv < 8 && feelOf(this.rowAt(w, x, y) ?? BIOMES[0]).vent;
        if (vent && cellHash(x, y, 41) < vent.p && !w.lava.has(i) && w.first(i) === K.EMPTY) p.vents[p.nv++] = i;
      }
    }
    this.work += 192;
  }
  // The row of a cell that has been seen, read from its piece (null for one that has not: no piece is made).
  rowAt(w, x, y) {
    const p = w.chunks[((y >> 6) << 8) | (x >> 6)], at = ((y & 63) << 6) | (x & 63);
    return p && p.seen[at] ? rowOf(p.biome[at]) : null;
  }
  // A ceiling (`floors`: a floor) in view, not in the cells cut by its edges, within `most` cells of the drill, chosen
  // at random: its cell, or -1.
  pick(game, floors, most) {
    const d = game.drill;
    let got = -1, seen = 0;
    for (let cy = this.ry0; cy <= this.ry1; cy++) for (let cx = this.rx0; cx <= this.rx1; cx++) {
      const p = this.pieces.get(cy * 4096 + cx);
      if (!p?.built) continue;
      const list = floors ? p.floors : p.ceil, n = floors ? p.nf : p.nc;
      for (let m = 0; m < n; m++) {
        const i = list[m], x = i % N, y = Math.floor(i / N);
        if (x <= this.x0 || x >= this.x1 || y <= this.y0 || y >= this.y1 || Math.abs(x + 0.5 - d.x) > most || Math.abs(y + 0.5 - d.y) > most) continue;
        if (this.rnd() * ++seen < 1) got = i;
      }
    }
    return got;
  }
  // The top of the first rock under (x, y), in pixels, looking no further than `most` cells down (ground not seen
  // is taken as rock).
  floorUnder(w, x, y, most = 14) {
    for (let v = 1; v <= most; v++) if (w.peek(x, y + v) !== K.EMPTY) return (y + v) * T;
    return (y + most + 1) * T;
  }
  // A sound that comes by itself: only when nothing that matters is sounding, one in QUIET seconds at the most,
  // and (placed at the cell (x, y)) only within HEAR cells of the drill. How near it is, or -1 for not heard.
  hear(game, x, y) {
    if (this.time - this.heard < QUIET || game.tickIn > 0 || game.hauls.length || game.banner || game.notice || game.place?.card) return -1;
    const near = x === undefined ? 1 : 1 - Math.hypot(x + 0.5 - game.drill.x, y + 0.5 - game.drill.y) / HEAR;
    if (near <= 0) return -1;
    this.heard = this.time;
    return near;
  }

  // ---------------------------------------------------------------- a frame
  step(game, dt) {
    const w = game.world, d = game.drill, row = w.row(game.di), F = feelOf(row), open = !game.shop && !game.lab;
    this.frame++; this.time += dt; this.work = 0;
    if (ART.size < READY.length) for (const l of READY) if (!ART.has(l.key)) { this.texture(l); break; }
    this.view(game);
    this.refresh(game);
    if (F !== this.F) this.enter(F);
    // What comes by itself, when it comes: not within CALM cells of the core, and not while a panel is up.
    if (open && game.far >= CALM) for (let e = 0; e < EVENTS.length; e++) {
      const entry = F[EVENTS[e]];
      if (!entry?.every) continue;
      if (Number.isNaN(this.next[e])) this.next[e] = this.between(entry.every);
      this.next[e] -= dt;
      if (this.next[e] > 0) continue;
      this.next[e] = this.between(entry.every);
      this.fire(game, EVENTS[e], entry);
    }
    // (What is made to come waits until every piece in view is known, so that it has somewhere to come.)
    if (this.forced && this.cv === game.version) {
      const what = this.forced;
      this.forced = null;
      if (what === 'flies') this.swarm(game, F.flies ?? { most: 6, color: '#b4f070' }, true);
      else if (what === 'icicle') { if (!this.loosen(game, 1, 5) && !this.loosen(game, 1, 10)) { const i = this.pick(game, false, 4); if (i >= 0) this.icicleFall(game, i); } }
      else if (what === 'rime') this.rime = 1;
      else if (EVENTS.includes(what)) this.fire(game, what, F[what] ?? PLAIN[what]);
    }
    this.tells(game, F, open, dt);
    this.watch(game, row, dt);
    this.going(game, F, dt);
    this.wake(game, F, dt);
    this.move(game, dt);
    this.atmosphere(game, F, dt);
  }
  // Into another ground: each event's clock keeps the time it had left, but no longer than the new ground waits.
  enter(F) {
    this.F = F;
    for (let e = 0; e < EVENTS.length; e++) { const entry = F[EVENTS[e]]; if (entry?.every && this.next[e] > entry.every[1]) this.next[e] = entry.every[1]; }
  }
  // An event: what it shows, and the sound it makes.
  fire(game, what, entry) {
    const w = game.world, d = game.drill;
    this.events++;
    if (what === 'drip') {
      const i = this.pick(game, false, 9);
      if (i < 0) return;
      const x = i % N, y = Math.floor(i / N), step = entry.step === 'scale' ? Math.floor(this.rnd() * PLINK.scale.length) : entry.step ?? 0;
      // (It hangs a moment, swelling, before it falls: a negative age.)
      const p = this.spawn(DROP, x * T + 4 + Math.floor(this.rnd() * 8), y * T + 1, 0, 0, 3, ink(entry.color), entry.slow ? 2 : 1, this.floorUnder(w, x, y));
      if (p >= 0) { this.t[p] = entry.slow ? -1.2 : -0.5; this.vx[p] = step + 100; }
    } else if (what === 'creak') {
      const near = this.hear(game);
      if (near >= 0) sfx.creak(0.6, entry.pitch ?? 1);
      // A hairline crack on a face of rock in view near the drill.
      for (let tries = 0; tries < 24; tries++) {
        const x = Math.floor(d.x) + Math.floor(this.rnd() * 13) - 6, y = Math.floor(d.y) + Math.floor(this.rnd() * 13) - 6, k = w.peek(x, y);
        if (k <= 0 || k === K.CORE || (w.peek(x - 1, y) && w.peek(x + 1, y) && w.peek(x, y - 1) && w.peek(x, y + 1))) continue;
        this.spawn(CRACK, x * T, y * T, 0, 0, 0.7, WHITE);
        break;
      }
    } else if (what === 'quake') {
      const power = entry.power ?? 1;
      this.shakeFor(power);
      const near = this.hear(game);
      if (near >= 0) sfx.quake(power);
      // Grit falls from the ceilings in view.
      for (let n = 0; n < 10; n++) {
        const i = this.pick(game, false, 10);
        if (i < 0) break;
        const x = i % N, y = Math.floor(i / N), debris = (this.rowAt(w, x, y - 1) ?? BIOMES[0]).debris;
        for (let g = 0; g < 3; g++) this.spawn(GRAIN, x * T + 2 + this.rnd() * 12, y * T, (this.rnd() - 0.5) * 8, this.rnd() * 30, 2, ink(debris[g % debris.length]), 1, this.floorUnder(w, x, y));
      }
      // And in caves with icicles, a few in view come down, one after another.
      if (icyOf(w.row(game.di))) this.loosen(game, 1 + Math.round(power * 2), 12, true);
    } else if (what === 'gust') {
      const s = entry.strength ?? 1;
      this.windTo = (this.rnd() < 0.5 ? -30 : 30) * s; this.gustLeft = 2.5 + this.rnd() * 1.5; this.streak = ink(entry.streak ?? '#d8d0c0');
      const near = this.hear(game);
      if (near >= 0) sfx.gust(s);
    } else if (what === 'bubble' || what === 'steam') {
      const i = this.pick(game, true, 9);
      if (i < 0) return;
      const x = i % N, y = Math.floor(i / N), colour = ink(entry.color);
      // (A bubble keeps where it rose from in its `floor`, and wobbles about it.)
      if (what === 'bubble') { const p = this.spawn(RING, x * T + 4 + this.rnd() * 8, y * T + T - 3, 0, -(14 + this.rnd() * 10), 1.4 + this.rnd() * 0.8, colour, this.rnd() < 0.4 ? 2 : 1); if (p >= 0) this.floor[p] = this.x[p]; }
      // (Steam comes over a little while: each puff waits its turn, a negative age.)
      else for (let n = 0; n < 12; n++) { const p = this.spawn(PUFF, x * T + 5 + this.rnd() * 6, y * T + T - 2, (this.rnd() - 0.5) * 10, -(12 + this.rnd() * 16), 0.9 + this.rnd() * 0.8, colour, n % 3 ? 2 : 3); if (p >= 0) this.t[p] = -this.rnd() * 0.8; }
      // (A bubble sounds as it pops, steam as it comes.)
      if (what === 'steam') { const near = this.hear(game, x, y); if (near >= 0) sfx.blub(near); }
    } else if (what === 'trickle') {
      const i = this.pick(game, false, 9);
      if (i >= 0) this.pour(game, i, entry.cut ?? 1.2, entry.color, true, 25);
    } else if (what === 'stars') {
      const dir = this.rnd() < 0.5 ? -1 : 1, x = (this.x0 + this.rnd() * (this.x1 - this.x0 + 1)) * T, y = (this.y0 + this.rnd() * (this.y1 - this.y0) * 0.4) * T;
      this.spawn(STAR, x, y, dir * (150 + this.rnd() * 60), 55 + this.rnd() * 30, 0.45, ink(entry.color));
    } else if (what === 'worm') {
      // A face of soft rock near the drill, with open ground beside it: the worm comes out into the open.
      for (let tries = 0; tries < 30; tries++) {
        const x = Math.floor(d.x) + Math.floor(this.rnd() * 13) - 6, y = Math.floor(d.y) + Math.floor(this.rnd() * 13) - 6;
        if (w.peek(x, y) !== K.SOFT) continue;
        const s = Math.floor(this.rnd() * 4), u = [1, 0, -1, 0][s], v = [0, 1, 0, -1][s];
        if (w.peek(x + u, y + v) !== K.EMPTY) continue;
        const p = this.spawn(WORM, x * T + 8 + u * 8, y * T + 8 + v * 8 + (u ? Math.floor(this.rnd() * 8) - 4 : 0), u, v, 1.6, WORMS[0]);
        if (p >= 0 && v) this.x[p] += Math.floor(this.rnd() * 8) - 4;
        break;
      }
    } else if (what === 'crackle') {
      if (!this.nv) return;
      const n = Math.floor(this.rnd() * this.nv), i = this.vents[n], x = i % N, y = Math.floor(i / N);
      for (let s = 0; s < 6; s++) this.spawn(SPARK, x * T + 4 + this.rnd() * 8, y * T + T - 2, (this.rnd() - 0.5) * 40, -(30 + this.rnd() * 40), 0.4 + this.rnd() * 0.4, this.ventInk[n * 3 + 1 + (s & 1)]);
      const near = this.hear(game, x, y);
      if (near >= 0) sfx.crackle(near);
    }
  }
  // The view shakes: for longer and harder the stronger the quake.
  shakeFor(power) { this.power = power; this.rumble = this.rumbleOf = 1.1 + 0.4 * power; }
  // Sand pours from the roof over the open cell `i` for `seconds`, `rate` grains a second; aloud, if `loud`.
  pour(game, i, seconds, color, loud, rate) {
    const w = game.world, x = i % N, y = Math.floor(i / N);
    if (w.peek(x, y - 1) <= 0) return;
    let slot = -1;
    for (let n = 0; n < this.pours.length; n++) if (this.pours[n][3] <= 0) { slot = n; break; }
    if (slot < 0) return;
    const s = this.pours[slot];
    s[0] = x * T + 5 + this.rnd() * 6; s[1] = y * T; s[2] = this.floorUnder(w, x, y); s[3] = seconds; s[4] = ink(color ?? (this.rowAt(w, x, y - 1) ?? BIOMES[0]).debris[1]); s[5] = rate;
    this.pourAt = this.time;
    if (loud) { const near = this.hear(game, x, y); if (near >= 0) sfx.trickle(near); }
  }
  // Fireflies, come all at once (a picture, a test) or one now and then.
  swarm(game, flies, all) {
    const w = game.world, d = game.drill;
    for (let n = all ? flies.most : 1; n > 0 && this.flies < Math.min(FLIES, flies.most); n--) {
      for (let tries = 0; tries < 16; tries++) {
        const x = all ? Math.floor(d.x) + Math.floor(this.rnd() * 9) - 4 : this.x0 + Math.floor(this.rnd() * (this.x1 - this.x0 + 1)), y = all ? Math.floor(d.y) + Math.floor(this.rnd() * 9) - 4 : this.y0 + Math.floor(this.rnd() * (this.y1 - this.y0 + 1));
        if (w.peek(x, y) !== K.EMPTY || w.lava.has(y * N + x)) continue;
        // One born by ore that has been seen keeps to it: a hint, read only from what is known.
        let home = -1;
        for (let v = -4; v <= 4 && home < 0; v++) for (let u = -4; u <= 4; u++) { const k = w.peek(x + u, y + v); if (k === K.ORE_A || k === K.ORE_B) { home = (y + v) * N + x + u; break; } }
        this.work += 81;
        const f = this.flies++;
        this.fx[f] = x * T + 8; this.fy[f] = y * T + 8; this.fvx[f] = 0; this.fvy[f] = 0; this.fphase[f] = this.rnd() * 6.283;
        this.fhome[f] = home; this.ft[f] = 0; this.flife[f] = 20 + this.rnd() * 25; this.fshy[f] = 0; this.fink[f] = ink(flies.color);
        break;
      }
    }
  }

  // What the drill tells by being where it is: a cut in the north about to close over creaks (the drill in it or
  // beside it, or the tether lying in it, which hold it open until they go); a crystal woken near the drill
  // crackles; lava woken on screen shakes the view a little; a cut just finished pours sand or crumbs.
  tells(game, F, open, dt) {
    const w = game.world, d = game.drill;
    if (open && (this.tellIn -= dt) <= 0) {
      this.tellIn = 0.4;
      const dcx = Math.floor(d.x), dcy = Math.floor(d.y);
      // (The newest cuts first, as the drill is nearest them. Each creaks once, as it comes within three seconds of
      // closing, though the tether hold it open for good: it is remembered by its cell and when it was cut, for as
      // long as it is open. It is the drill's own sound, kept apart only by its own gap, but it is placed: heard only
      // within HEAR cells of the drill, the softer the further, so a cut the tether holds open far off is not told
      // until the drill comes back near it.)
      for (let n = game.frostOpen.length - 1, last = Math.max(0, n - 399); n >= last && this.time - this.tellAt > 2; n--) {
        const i = game.frostOpen[n], x = i % N, y = Math.floor(i / N), freeze = (this.rowAt(w, x, y) ?? BIOMES[0]).freeze, cut = w.dug.get(i);
        if (!freeze || cut === undefined || game.clock - cut < freeze - 3 || (Math.max(Math.abs(dcx - x), Math.abs(dcy - y)) > 2 && !game.under.has(i))) continue;
        const near = 1 - Math.hypot(x + 0.5 - d.x, y + 0.5 - d.y) / HEAR;
        if (near <= 0 || this.told.get(i) === cut) continue;
        // (What is remembered of cuts since closed over or cut again is let go, now and then.)
        if (this.told.size >= 64) for (const [j, at] of this.told) if (w.dug.get(j) !== at) this.told.delete(j);
        this.told.set(i, cut);
        this.tellAt = this.time; sfx.creak(near, 1.2);
        for (let s = 0; s < 3; s++) this.spawn(GLINT, x * T + 2 + this.rnd() * 12, y * T + 2 + this.rnd() * 12, 0, 0, 0.5, ink('#dff4ff'), 0);
      }
    }
    // Crystals woken near the drill.
    if (game.sparks.size && this.time - this.crackleAt > 0.6) {
      for (const [i, s] of game.sparks) {
        if (!(s.fuse > 0)) continue;
        const near = 1 - Math.hypot((i % N) + 0.5 - d.x, Math.floor(i / N) + 0.5 - d.y) / 5;
        if (near > 0) { this.crackleAt = this.time; sfx.crackle(near); break; }
      }
    }
    // Lava woken on screen.
    const lava = w.lava.size;
    if (lava > this.lavaWas && this.time - this.lavaAt > 6 && game.far >= CALM) {
      for (const i of w.lava.keys()) {
        const x = i % N, y = Math.floor(i / N);
        if (x >= this.x0 && x <= this.x1 && y >= this.y0 && y <= this.y1) { this.lavaAt = this.time; if (!(this.rumble > 0)) this.shakeFor(0.6); break; }
      }
    }
    this.lavaWas = lava;
    // A cut just finished: the drill was cutting a cell, and is not now, and the cell is open.
    if (this.lastDig >= 0 && d.dig !== this.lastDig && w.peek(this.lastDig % N, Math.floor(this.lastDig / N)) === K.EMPTY) {
      const pour = F.trickle ?? F.settle;
      if (pour?.cut && this.time - this.pourAt > 1) this.pour(game, this.lastDig, pour.cut, pour.color, !!F.trickle, F.trickle ? 25 : 12);
    }
    this.lastDig = d.dig;
  }
  // What goes on all the time: vents spit sparks, ash and spores fall, ore glints, fireflies come, sand pours, the
  // wind blows and the quake shakes.
  going(game, F, dt) {
    const w = game.world;
    for (let n = 0; n < this.nv; n++) {
      if (this.rnd() > dt * this.ventRate[n]) continue;
      const i = this.vents[n], x = i % N, y = Math.floor(i / N);
      this.spawn(SPARK, x * T + 4 + this.rnd() * 8, y * T + T - 2, (this.rnd() - 0.5) * 16, -(18 + this.rnd() * 26), 0.6 + this.rnd() * 0.5, this.ventInk[n * 3 + 1 + (this.rnd() < 0.5 ? 1 : 0)]);
    }
    if (F.fall && this.live < POOL - 30) {
      this.fallIn -= dt;
      while (this.fallIn <= 0) {
        this.fallIn += F.fall.rate;
        const x = (this.x0 - 1 + this.rnd() * (this.x1 - this.x0 + 3)) * T, y = (this.y0 + this.rnd() * (this.y1 - this.y0 + 1)) * T, speed = F.fall.speed ?? 10;
        this.spawn(FLAKE, x, y, F.fall.sway ? 1 : 0, speed * (0.7 + 0.6 * this.rnd()), 3 + this.rnd() * 3, ink(F.fall.color), this.rnd() < 0.25 ? 2 : 1);
      }
    }
    if (F.glint) for (let n = 0; n < F.glint.tries; n++) {
      const x = this.x0 + Math.floor(this.rnd() * (this.x1 - this.x0 + 1)), y = this.y0 + Math.floor(this.rnd() * (this.y1 - this.y0 + 1)), k = w.peek(x, y);
      if ((k === K.ORE_A || k === K.ORE_B || k === K.PRISM || k === K.MINERAL || k === K.GLASS) && this.rnd() < 0.3) this.spawn(GLINT, x * T + 3 + this.rnd() * 10, y * T + 3 + this.rnd() * 10, 0, 0, 0.35, ink(F.glint.color), 1);
    }
    // Fireflies come one at a time, a second or so apart, while the ground has them.
    if (F.flies && this.flies < F.flies.most && (this.flyIn -= dt) <= 0) { this.flyIn = 0.8 + this.rnd() * 1.2; this.swarm(game, F.flies, false); }
    for (let n = 0; n < this.pours.length; n++) {
      const s = this.pours[n];
      if (s[3] <= 0) continue;
      s[3] -= dt;
      for (let g = Math.floor(s[5] * dt + this.rnd()); g > 0; g--) this.spawn(GRAIN, s[0] + (this.rnd() - 0.5) * 3, s[1], (this.rnd() - 0.5) * 6, 10 + this.rnd() * 20, 3, s[4], 1, s[2]);
    }
    // The wind eases up to a gust and down again, and while it blows streaks cross the view.
    if (this.gustLeft > 0 && (this.gustLeft -= dt) <= 0) this.windTo = 0;
    this.wind += (this.windTo - this.wind) * (1 - Math.exp(-dt * 1.5));
    // (How far the wind has pushed the air, easing back as it drops: the game's motes are drawn so far over.)
    this.drift += (this.wind - 0.6 * this.drift) * Math.min(dt, 0.1);
    for (let n = Math.floor(dt * Math.abs(this.wind) * 0.8 + this.rnd()); n > 0 && Math.abs(this.wind) > 6; n--) {
      const up = this.wind > 0 ? this.x0 - 1 : this.x1 + 1;
      this.spawn(STREAK, (up + this.rnd() * (this.x1 - this.x0) * 0.5 * Math.sign(this.wind)) * T, (this.y0 + this.rnd() * (this.y1 - this.y0 + 1)) * T, this.wind * 4.5, 0, 0.7 + this.rnd() * 0.6, this.streak ?? WHITE, 4 + Math.floor(this.rnd() * 9));
    }
    if (this.rumble > 0) {
      this.rumble = Math.max(0, this.rumble - dt);
      const into = this.rumbleOf - this.rumble;
      this.quake = this.rumble > 0 ? 3 * this.power * Math.min(1, into / 0.15) * (this.rumble / this.rumbleOf) : 0;
    } else this.quake = 0;
  }
  // What the drill gives off: in the cold its breath standing still and a trail of frost at speed, in the heat a
  // glow under the hull (drawn in `glow`), in the wet drips off it, in dust a cloud behind it.
  wake(game, F, dt) {
    const w = game.world, d = game.drill, wake = F.wake, speed = Math.hypot(d.vx, d.vy), px = d.x * T, py = d.y * T;
    // Lava swum through leaves the hull white-hot for a while.
    this.hot = Math.max(0, this.hot - dt);
    if (game.swims) for (let n = 0; n < 4; n++) if (w.lava.has(Math.floor(d.y + (n & 2 ? 0.34 : -0.34)) * N + Math.floor(d.x + (n & 1 ? 0.34 : -0.34)))) { this.hot = 2; break; }
    if (!wake || d.mode === 'dead') return;
    if (wake.kind === 'frost') {
      if (speed < 2 && (this.breathIn -= dt) <= 0) {
        this.breathIn = 1.6;
        const nx = px + Math.cos(d.ang) * 7, ny = py + Math.sin(d.ang) * 7;
        for (let n = 4 + Math.floor(this.rnd() * 3); n > 0; n--) this.spawn(PUFF, nx + (this.rnd() - 0.5) * 3, ny + (this.rnd() - 0.5) * 3, Math.cos(d.ang) * 9 + (this.rnd() - 0.5) * 6, -3 - this.rnd() * 5, 0.9 + this.rnd() * 0.6, BREATH, n & 1 ? 2 : 1);
      } else if (speed > 10 && (this.wakeIn -= dt) <= 0) {
        this.wakeIn = 0.06;
        this.spawn(GLINT, px + (this.rnd() - 0.5) * 6, py + (this.rnd() - 0.5) * 6, 0, 0, 0.5, ink(wake.color), 0);
      }
    } else if (wake.kind === 'heat') {
      if (speed > 4 && (this.wakeIn -= dt) <= 0) { this.wakeIn = 0.35; this.spawn(SPARK, px - d.vx * 0.4, py - d.vy * 0.4, (this.rnd() - 0.5) * 12, -12 - this.rnd() * 12, 0.5, ink(wake.color)); }
    } else if (wake.kind === 'drip') {
      if ((this.wakeIn -= dt) <= 0) {
        this.wakeIn = 0.6 + this.rnd() * 0.6;
        this.spawn(DROP, px + (this.rnd() - 0.5) * 6, py + 5, 0, 10, 2, ink(wake.color), 1, this.floorUnder(w, Math.floor(d.x), Math.floor(d.y), 8));
      }
    } else if (wake.kind === 'dust' && speed > 8 && (this.wakeIn -= dt) <= 0) {
      this.wakeIn = wake.strong ? 0.04 : 0.07;
      this.spawn(PUFF, px - d.vx / speed * 6 + (this.rnd() - 0.5) * 3, py - d.vy / speed * 6 + (this.rnd() - 0.5) * 3, (this.rnd() - 0.5) * 6, -4 - this.rnd() * 4, 0.6 + this.rnd() * 0.4, ink(wake.color), wake.strong ? 2 : this.rnd() < 0.5 ? 2 : 1);
    }
  }
  // Every particle and firefly moves on.
  move(game, dt) {
    const w = game.world, d = game.drill, wind = this.wind;
    for (let i = 0; i < POOL; i++) {
      const k = this.kind[i];
      if (!k) continue;
      const t = (this.t[i] += dt);
      if (t >= this.life[i]) {
        // A bubble at the top of its rise pops, and is heard.
        if (k === RING) {
          this.kind[i] = POP; this.t[i] = 0; this.life[i] = 0.14;
          const near = this.hear(game, Math.floor(this.x[i] / T), Math.floor(this.y[i] / T));
          if (near >= 0) sfx.blub(near);
          continue;
        }
        this.kind[i] = 0; this.live--; continue;
      }
      if (t < 0) continue;
      if (k === DROP || k === SHARD || k === GRAIN || k === ICICLE) {
        this.vy[i] = Math.min(k === GRAIN ? 140 : 260, this.vy[i] + GRAVITY * dt);
        if (k === GRAIN) this.x[i] += wind * 0.25 * dt;
        if (k !== DROP) this.x[i] += this.vx[i] * dt;
        this.y[i] += this.vy[i] * dt;
        if (this.y[i] >= this.floor[i]) {
          this.y[i] = this.floor[i] - 1;
          if (k === DROP) {
            // A drop splashes where it lands, and if it fell from a ceiling it plinks: such a drop carries its
            // note a hundred over in its `vx`, which a drop does not otherwise use (one off the drill is silent).
            const step = this.vx[i] - 100;
            this.kind[i] = SPLASH; this.t[i] = 0; this.life[i] = 0.2;
            if (step > -50) { const near = this.hear(game, Math.floor(this.x[i] / T), Math.floor(this.y[i] / T)); if (near >= 0) sfx.drip(near, step); }
          } else if (k === ICICLE) this.shatter(game, i);
          else { this.kind[i] = 0; this.live--; }
        }
      } else if (k === FLAKE) {
        const sway = this.vx[i] ? Math.sin(this.time * 1.7 + i) * 9 : Math.sin(this.time * 1.1 + i) * 3;
        this.x[i] += (sway + wind) * dt; this.y[i] += this.vy[i] * dt;
      } else if (k === PUFF || k === SPARK) {
        this.x[i] += (this.vx[i] + wind * (k === PUFF ? 0.6 : 0.4)) * dt; this.y[i] += this.vy[i] * dt;
        this.vx[i] *= 1 - 1.5 * dt; this.vy[i] *= 1 - (k === PUFF ? 1.2 : 0.6) * dt;
      } else if (k === STREAK || k === STAR) { this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt; if (k === STREAK) this.vx[i] += (wind * 4.5 - this.vx[i]) * dt; }
      else if (k === RING) { this.y[i] += this.vy[i] * dt; this.x[i] = this.floor[i] + Math.sin(t * 7 + i) * 1.5; }
    }
    // Fireflies wander; near the drill's lamp they come to it and go round it, unless it flies fast or spores
    // burst near them, and then they keep away a while; one born by ore keeps to the ore. Each keeps to open
    // ground, turning back from rock.
    const fast = Math.hypot(d.vx, d.vy) > 20, dx = d.x * T, dy = d.y * T;
    for (let f = 0; f < this.flies; f++) {
      this.ft[f] += dt;
      const x = this.fx[f], y = this.fy[f], ph = this.fphase[f];
      // (Out of ground that has them, each fades in a second.)
      if (!this.F?.flies && this.flife[f] > this.ft[f] + 1) this.flife[f] = this.ft[f] + 1;
      if (this.ft[f] > this.flife[f] || Math.abs(x - game.cam.x) > game.W / 2 + 60 || Math.abs(y - game.cam.y) > game.H / 2 + 60) {
        // (Gone: the last takes its place.)
        const last = --this.flies;
        this.fx[f] = this.fx[last]; this.fy[f] = this.fy[last]; this.fvx[f] = this.fvx[last]; this.fvy[f] = this.fvy[last]; this.fphase[f] = this.fphase[last];
        this.fhome[f] = this.fhome[last]; this.ft[f] = this.ft[last]; this.flife[f] = this.flife[last]; this.fshy[f] = this.fshy[last]; this.fink[f] = this.fink[last];
        f--; continue;
      }
      if (fast && Math.hypot(x - dx, y - dy) < 6 * T) this.fshy[f] = 1.5;
      for (let n = 0; n < game.clouds.length; n++) { const c = game.clouds[n]; if (Math.hypot(x - (c.x + 0.5) * T, y - (c.y + 0.5) * T) < 5 * T) this.fshy[f] = 1.5; }
      this.fshy[f] = Math.max(0, this.fshy[f] - dt);
      const far = Math.hypot(x - dx, y - dy);
      let ax = Math.cos(this.time * 0.7 + ph * 3) * 14, ay = Math.sin(this.time * 0.9 + ph * 5) * 12;
      if (this.fshy[f] > 0) { ax += (x - dx) / (far || 1) * 60; ay += (y - dy) / (far || 1) * 60; }
      else if (far < 7 * T) {
        // Round the lamp, each at its own distance and the way its phase says.
        const a = this.time * (0.8 + (f % 3) * 0.2) * (f & 1 ? 1 : -1) + ph, r = (1.5 + (ph % 1)) * T;
        ax += (dx + Math.cos(a) * r - x) * 2.2; ay += (dy + Math.sin(a) * r - y) * 2.2;
      } else if (this.fhome[f] >= 0) { const h = this.fhome[f]; ax += ((h % N) * T + 8 + Math.cos(this.time + ph) * 10 - x) * 1.5; ay += (Math.floor(h / N) * T + 8 + Math.sin(this.time * 1.3 + ph) * 8 - y) * 1.5; }
      this.fvx[f] += (ax - this.fvx[f]) * Math.min(1, dt * 2); this.fvy[f] += (ay - this.fvy[f]) * Math.min(1, dt * 2);
      const nx = x + this.fvx[f] * dt, ny = y + this.fvy[f] * dt;
      if (w.peek(Math.floor(nx / T), Math.floor(y / T)) === K.EMPTY) this.fx[f] = nx; else this.fvx[f] *= -0.5;
      if (w.peek(Math.floor(this.fx[f] / T), Math.floor(ny / T)) === K.EMPTY) this.fy[f] = ny; else this.fvy[f] *= -0.5;
    }
  }
  // The layers over the screen ease to the ground's own, the old ones going as the new come; frost grows in the
  // corners for as long as the drill is in ground that has it, and goes when it is not (at once, on the core).
  atmosphere(game, F, dt) {
    const k = 1 - Math.exp(-dt * 1.5);
    // (A layer is known by its whole spec: two grounds whose edges are of one colour may differ in how dark it is or
    // whether it pulses, and the one gone into eases in as the other goes.)
    for (let m = 0; m < F.layers.length; m++) {
      const d = F.layers[m];
      let there = false;
      for (let n = 0; n < this.layers.length; n++) if (this.layers[n].spec === d.spec) there = true;
      if (!there) this.layers.push({ key: d.key, alpha: 0, spec: d.spec, fog: d.fog });
    }
    for (let n = this.layers.length - 1; n >= 0; n--) {
      const l = this.layers[n];
      let want = 0;
      for (let m = 0; m < F.layers.length; m++) if (F.layers[m].spec === l.spec) want = 1;
      l.alpha += (want - l.alpha) * k;
      if (!want && l.alpha < 0.01) this.layers.splice(n, 1);
    }
    this.haze += ((this.gustLeft > 0 ? 1 : 0) - this.haze) * k;
    if (F.rime && !game.atCore) { this.rime = Math.min(1, this.rime + dt / F.rime.build); this.rimeInk = F.rime.color; }
    else this.rime = game.atCore ? 0 : Math.max(0, this.rime - dt * 0.2);
  }

  // ---------------------------------------------------------------- an icicle falls
  // The icicles are drawn with the ground (js/decor.js), which says where they hang. One the drill flies under (in
  // its column or the one either side, within UNDER cells over it, with nothing but open ground between) shivers
  // and falls; a quake shakes a few in view loose. They begin to fall one at a time, LOOSE seconds apart at the
  // least: one that must wait its turn hangs still until then.
  watch(game, row, dt) {
    const d = game.drill;
    if ((this.watchIn -= dt) > 0) return;
    this.watchIn = 0.1;
    if (this.time < this.icicleNext || d.mode === 'dead' || Math.abs(d.vx) + Math.abs(d.vy) < 1 || !icyOf(row)) return;
    const w = game.world, cx = Math.floor(d.x), cy = Math.floor(d.y);
    for (let u = -1; u <= 1; u++) for (let v = 0; v <= UNDER; v++) {
      const x = cx + u, y = cy - v;
      if (w.peek(x, y) !== K.EMPTY) break;
      const i = y * N + x;
      if (w.peek(x, y - 1) <= 0 || this.fallen.has(i)) continue;
      const f = game.decorOf(i);
      if (f !== null && falls(f) && placeOf(f) === 'top') { this.icicleFall(game, i, f); return; }
    }
  }
  // Up to `most` of the icicles hanging in view within `reach` cells of the drill, chosen at random, come down
  // (`alone`: by themselves, a quake's, and not the drill's): how many did.
  loosen(game, most, reach, alone = false) {
    const d = game.drill;
    let found = 0, seen = 0;
    for (let cy = this.ry0; cy <= this.ry1; cy++) for (let cx = this.rx0; cx <= this.rx1; cx++) {
      const p = this.pieces.get(cy * 4096 + cx);
      if (!p?.built) continue;
      for (let m = 0; m < p.nc; m++) {
        const i = p.ceil[m], x = i % N, y = Math.floor(i / N);
        if (x <= this.x0 || x >= this.x1 || y <= this.y0 || y >= this.y1 || Math.abs(x + 0.5 - d.x) > reach || Math.abs(y + 0.5 - d.y) > reach || this.fallen.has(i)) continue;
        const f = game.decorOf(i);
        if (f === null || !falls(f) || placeOf(f) !== 'top') continue;
        // (Each one found has the same chance of being among those kept, however many there are.)
        seen++;
        if (found < this.loose.length) this.loose[found++] = i;
        else { const at = Math.floor(this.rnd() * seen); if (at < this.loose.length) this.loose[at] = i; }
      }
    }
    let fell = 0;
    for (let n = 0; n < found && fell < most; n++) {
      const at = n + Math.floor(this.rnd() * (found - n)), i = this.loose[at];
      this.loose[at] = this.loose[n];
      if (this.icicleFall(game, i, game.decorOf(i), alone)) fell++;
    }
    return fell;
  }
  // The icicle that hung from the ceiling of the open cell `i`, drawn as the frame `frame`, comes down: it shivers,
  // falls to the floor under it and shatters there. With no frame (a ceiling with nothing hanging from it, for a
  // picture or a test) a plain sliver falls. Whether it came: a fall is kept (`fallen`) only if it did. One that
  // comes down `alone` is heard as a sound that comes by itself is; one the drill set off, as the drill's own.
  icicleFall(game, i, frame = null, alone = false) {
    if (this.fallen.has(i)) return false;
    const w = game.world, x = i % N, y = Math.floor(i / N), wait = Math.max(0, this.icicleNext - this.time);
    if (wait > 4 * LOOSE) return false;
    const p = frame
      ? this.spawn(ICICLE, x * T, y * T, 0, 0, 3, shapeOf(frame), 0, this.floorUnder(w, x, y) - 7)
      : this.spawn(ICICLE, x * T + 4 + Math.floor(cellHash(x, y, 43) * 8), y * T + 1, 0, 0, 3, ink('#cfeeff'), 5, this.floorUnder(w, x, y));
    if (p < 0) return false;
    this.t[p] = -(wait + SHIVER); this.alone[p] = alone ? 1 : 0;
    this.icicleNext = this.time + wait + LOOSE;
    if (frame) { this.fallen.add(i); game.redraw?.(i); }
    return true;
  }
  shatter(game, p) {
    // (A frame is a cell's size, with its icicle in the top half: it breaks where its tip meets the floor.)
    const framed = this.size[p] === 0, x = this.x[p] + (framed ? 8 : 0), y = framed ? this.floor[p] + 6 : this.y[p], alone = this.alone[p];
    this.kind[p] = 0; this.live--;
    for (let n = 6 + Math.floor(this.rnd() * 5); n > 0; n--) this.spawn(SHARD, x + (framed ? Math.round((this.rnd() - 0.5) * 8) : 0), y - 1, (this.rnd() - 0.5) * 70, -40 - this.rnd() * 60, 0.6 + this.rnd() * 0.3, ink(n & 1 ? '#e8fbff' : '#8ab8dc'), 1, y + 1);
    // (Either way it is heard only within HEAR cells of the drill.)
    const near = alone ? this.hear(game, Math.floor(x / T), Math.floor((y - 1) / T)) : 1 - Math.hypot(x / T - game.drill.x, y / T - game.drill.y) / HEAR;
    if (near > 0) sfx.shatter(near);
  }

  // Makes something come at once, whatever the ground and whatever its clock says (for pictures and tests):
  // any of the events, or 'flies' (a ground's fireflies, all of them round the drill), 'icicle' (one hanging in
  // view near the drill comes down, or with none a sliver from a ceiling beside it) or 'rime' (the corners frosted
  // over).
  force(what) { this.forced = what; }

  // ---------------------------------------------------------------- drawing
  // Under the dark: what falls, drifts and splashes.
  dust(game, ctx, ox, oy) {
    const w = game.world, W = game.W, H = game.H;
    for (let i = 0; i < POOL; i++) {
      const k = this.kind[i];
      if (!k || LIT[k] || (this.t[i] < 0 && k !== DROP && k !== ICICLE)) continue;
      const px = Math.round(this.x[i] - ox), py = Math.round(this.y[i] - oy), u = Math.max(0, this.t[i]) / this.life[i];
      if (px < -8 || py < -8 || px >= W + 8 || py >= H) continue;
      ctx.fillStyle = INKS[this.ink[i]];
      if (k === DROP) {
        // (Hanging, it swells; falling, it is a short streak.)
        ctx.globalAlpha = 0.85;
        if (this.t[i] < 0) { const big = this.size[i] > 1 ? (this.t[i] > -0.5 ? 3 : 2) : this.t[i] > -0.25 ? 2 : 1; ctx.fillRect(px - (big > 2 ? 1 : 0), py, big > 2 ? 3 : 1, big > 2 ? 2 : big); if (big > 2) ctx.fillRect(px, py + 2, 1, 1); }
        else ctx.fillRect(px, py - 1, 1, this.size[i] > 1 ? 3 : 2);
      } else if (k === SPLASH) {
        const s = 1 + Math.floor(u * 3);
        ctx.globalAlpha = 0.8 * (1 - u);
        ctx.fillRect(px - s, py - (u < 0.5 ? 1 : 0), 1, 1); ctx.fillRect(px + s, py - (u < 0.5 ? 1 : 0), 1, 1);
      } else if (k === FLAKE) {
        if (w.peek(Math.floor(this.x[i] / T), Math.floor(this.y[i] / T)) !== K.EMPTY) continue;
        ctx.globalAlpha = Math.min(1, this.t[i] * 2, (this.life[i] - this.t[i]) * 2) * 0.7;
        ctx.fillRect(px, py, this.size[i], 1);
      } else if (k === PUFF) {
        ctx.globalAlpha = 0.65 * (1 - u) * Math.min(1, this.t[i] * 8);
        ctx.fillRect(px, py, this.size[i], this.size[i]);
      } else if (k === STREAK) {
        // (Brighter over open ground, faint over rock.)
        const open = w.peek(Math.floor(this.x[i] / T), Math.floor(this.y[i] / T)) === K.EMPTY;
        ctx.globalAlpha = (open ? 0.5 : 0.18) * Math.min(1, this.t[i] * 4, (this.life[i] - this.t[i]) * 4);
        ctx.fillRect(px, py, this.size[i], 1);
      } else if (k === RING) {
        const r = this.size[i];
        ctx.globalAlpha = 0.75;
        ctx.fillRect(px - r + 1, py - r, 2 * r - 1, 1); ctx.fillRect(px - r + 1, py + r, 2 * r - 1, 1); ctx.fillRect(px - r, py - r + 1, 1, 2 * r - 1); ctx.fillRect(px + r, py - r + 1, 1, 2 * r - 1);
        ctx.globalAlpha = 0.5; ctx.fillRect(px - r + 1, py - r + 1, 1, 1);
      } else if (k === POP) {
        ctx.globalAlpha = 0.8 * (1 - u);
        ctx.fillRect(px - 2, py, 1, 1); ctx.fillRect(px + 2, py, 1, 1); ctx.fillRect(px, py - 2, 1, 1); ctx.fillRect(px, py + 2, 1, 1);
      } else if (k === WORM) {
        // Out and back in, wriggling.
        const out = Math.round(Math.sin(Math.min(1, u) * Math.PI) * 3), wig = Math.round(Math.sin(this.t[i] * 14));
        ctx.globalAlpha = 1;
        for (let s = 0; s < out; s++) { ctx.fillStyle = INKS[WORMS[s & 1]]; ctx.fillRect(px + this.vx[i] * s + (this.vy[i] ? wig * (s & 1) : 0), py + this.vy[i] * s + (this.vx[i] ? wig * (s & 1) : 0), 1, 1); }
      } else if (k === CRACK) {
        ctx.globalAlpha = 0.5 * (1 - u);
        if (sheets.cracks) draw(ctx, 'cracks', 'crack-1', px, py);
      } else if (k === ICICLE) {
        // (Waiting its turn it hangs still; then it shivers a moment, a pixel either way, and falls.)
        const shiver = this.t[i] < 0 && this.t[i] > -SHIVER ? ((this.frame >> 1) & 1 ? 1 : -1) : 0;
        ctx.globalAlpha = 1;
        if (this.size[i] === 0) { const name = SHAPES[this.ink[i]]; draw(ctx, framesOf().frame.get(name).sheet, name, px + shiver, py); }
        else { ctx.fillRect(px + shiver, py, 1, this.size[i]); ctx.fillStyle = '#ffffff'; ctx.fillRect(px + shiver, py, 1, 2); }
      } else {
        ctx.globalAlpha = Math.min(1, 2 * (1 - u));
        ctx.fillRect(px, py, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }
  // Over the dark, adding light: sparks, glints, stars, fireflies, vents and the drill's heat; then the layers over
  // the whole screen.
  glow(game, ctx, ox, oy) {
    const W = game.W, H = game.H, now = this.time, d = game.drill, w = game.world;
    ctx.globalCompositeOperation = 'lighter';
    for (let n = 0; n < this.nv; n++) {
      const i = this.vents[n], x = i % N, y = Math.floor(i / N), px = x * T - ox, py = y * T + T - 1 - oy, h = cellHash(x, y, 42);
      ctx.fillStyle = INKS[this.ventInk[n * 3]];
      ctx.globalAlpha = 0.45 + 0.35 * Math.sin(now * (5 + h * 4) + h * 20);
      ctx.fillRect(px + 3 + Math.floor(h * 4), py, 4, 1); ctx.fillRect(px + 6 + Math.floor(h * 5), py - 1, 2, 1);
      ctx.globalAlpha *= 0.4; ctx.fillRect(px + 2 + Math.floor(h * 4), py - 2, 8, 2);
    }
    for (let i = 0; i < POOL; i++) {
      const k = this.kind[i];
      if (!k || !LIT[k]) continue;
      const px = Math.round(this.x[i] - ox), py = Math.round(this.y[i] - oy), u = this.t[i] / this.life[i];
      if (px < -12 || py < -12 || px >= W + 12 || py >= H) continue;
      ctx.fillStyle = INKS[this.ink[i]];
      if (k === SPARK) { ctx.globalAlpha = (1 - u) * (0.6 + 0.4 * Math.sin(this.t[i] * 40 + i)); ctx.fillRect(px, py, 1, 1); }
      else if (k === GLINT) {
        ctx.globalAlpha = 1 - u;
        if (this.size[i]) { const arm = u < 0.5 ? 2 : 1; ctx.fillRect(px - arm, py, arm * 2 + 1, 1); ctx.fillRect(px, py - arm, 1, arm * 2 + 1); }
        else ctx.fillRect(px, py, 1, 1);
      } else if (k === STAR) {
        // A streak behind its head, brightest at the head, passing behind rock: only what is over open ground shows.
        const len = 14, sx = this.vx[i] / Math.hypot(this.vx[i], this.vy[i]), sy = this.vy[i] / Math.hypot(this.vx[i], this.vy[i]);
        for (let s = 0; s < len; s++) {
          const qx = Math.round(px - sx * s), qy = Math.round(py - sy * s);
          if (w.peek(Math.floor((qx + ox) / T), Math.floor((qy + oy) / T)) !== K.EMPTY) continue;
          ctx.globalAlpha = Math.min(1, (1 - u) * 1.6) * (1 - s / len); ctx.fillRect(qx, qy, 1, 1);
        }
        if (w.peek(Math.floor((px + ox) / T), Math.floor((py + oy) / T)) === K.EMPTY) { ctx.globalAlpha = Math.min(1, (1 - u) * 1.6); ctx.fillRect(px, py - 1, 1, 1); ctx.fillRect(px, py + 1, 1, 1); }
      }
    }
    for (let f = 0; f < this.flies; f++) {
      const px = Math.round(this.fx[f] - ox), py = Math.round(this.fy[f] - oy);
      if (px < -4 || py < -4 || px >= W + 4 || py >= H) continue;
      // Each blinks in its own time: a slow swell to bright, and down to a spark.
      const fade = Math.min(1, this.ft[f], this.flife[f] - this.ft[f]), wave = 0.5 + 0.5 * Math.sin(now * (1.6 + (f % 4) * 0.25) + this.fphase[f] * 7), beat = wave * wave;
      ctx.fillStyle = INKS[this.fink[f]];
      ctx.globalAlpha = fade * beat * 0.22;
      ctx.fillRect(px - 2, py - 1, 5, 3); ctx.fillRect(px - 1, py - 2, 3, 5);
      ctx.globalAlpha = fade * beat * 0.5;
      ctx.fillRect(px - 1, py, 3, 1); ctx.fillRect(px, py - 1, 1, 3);
      ctx.globalAlpha = fade * (0.6 + 0.4 * beat);
      ctx.fillRect(px, py, 1, 1);
    }
    // Woken crystals spit a little zigzag of light.
    for (const [i, s] of game.sparks) {
      if (!(s.fuse > 0)) continue;
      const px = (i % N) * T - ox, py = Math.floor(i / N) * T - oy;
      if (px < -T || py < -T || px > W || py > H) continue;
      const h = ((now * 20) | 0) + i;
      ctx.fillStyle = INKS[CRYSTAL]; ctx.globalAlpha = 0.8;
      const zx = px + 3 + (h % 9), zy = py + 2 + ((h >> 3) % 9);
      ctx.fillRect(zx, zy, 1, 1); ctx.fillRect(zx + 1, zy + 1, 1, 1); ctx.fillRect(zx, zy + 2, 1, 1); ctx.fillRect(zx + 1, zy + 3, 1, 1);
    }
    // The heat of the drill's hull, in the south's grounds; white-hot just out of lava.
    const wake = this.F?.wake;
    if ((wake?.kind === 'heat' || this.hot > 0) && d.mode !== 'dead') {
      const px = Math.round(d.x * T - ox), py = Math.round(d.y * T - oy), hot = Math.min(1, this.hot);
      ctx.fillStyle = hot > 0 ? '#fff0d0' : wake.color;
      const a = hot > 0 ? 0.4 + 0.4 * hot : (wake.strong ? 0.42 : 0.32) + 0.1 * Math.sin(now * 5);
      ctx.globalAlpha = a * 0.3; ctx.fillRect(px - 10, py - 7, 20, 14); ctx.fillRect(px - 7, py - 10, 14, 20);
      ctx.globalAlpha = a * 0.5; ctx.fillRect(px - 7, py - 5, 14, 10); ctx.fillRect(px - 5, py - 7, 10, 14);
      ctx.globalAlpha = a; ctx.fillRect(px - 4, py - 4, 8, 8);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    if (!game.daylight && game.scale >= 1) this.screen(game, ctx);
  }
  // The layers over the whole screen: a fog drifting slowly over the view (and away from it as the view moves,
  // at half the pace), an edge of the ground's own colour, and frost at the corners, which is pixels of its own
  // drawn as they are.
  screen(game, ctx) {
    const W = game.W, H = game.H - 44;
    for (const l of this.layers) {
      const spec = l.spec;
      if (l.alpha < 0.01) continue;
      const art = this.texture(l);
      ctx.imageSmoothingEnabled = true;
      if (l.fog) {
        const a = (spec.alpha + (this.F?.gust?.haze ?? 0) * this.haze) * l.alpha;
        const sx = 512, sy = 256, fx = ((game.cam.x * 0.5 + this.time * spec.speed * 40) % sx + sx) % sx, fy = ((game.cam.y * 0.5) % sy + sy) % sy;
        ctx.globalAlpha = Math.min(0.5, a);
        for (let y = -fy; y < H; y += sy) for (let x = -fx; x < W; x += sx) ctx.drawImage(art, Math.round(x), Math.round(y), sx, sy);
      } else {
        // (Heat from below adds its light; any other edge lays its colour over the view.)
        ctx.globalAlpha = spec.alpha * l.alpha * (spec.pulse ? 0.8 + 0.2 * Math.sin(this.time * Math.PI) : 1);
        if (spec.below) ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(art, 0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.imageSmoothingEnabled = false;
    }
    ctx.globalAlpha = 1;
    // Frost, in six stages of growth.
    const stage = Math.ceil(this.rime * 6);
    if (stage > 0 && this.rimeInk) {
      const art = this.frost(this.rimeInk, stage), s = art.width;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(art, 0, 0, s / 2, s / 2, 0, 0, s / 2, s / 2);
      ctx.drawImage(art, s / 2, 0, s / 2, s / 2, W - s / 2, 0, s / 2, s / 2);
      ctx.drawImage(art, 0, s / 2, s / 2, s / 2, 0, H - s / 2, s / 2, s / 2);
      ctx.drawImage(art, s / 2, s / 2, s / 2, s / 2, W - s / 2, H - s / 2, s / 2, s / 2);
      ctx.globalAlpha = 1;
    }
  }
  // A layer's picture, made in the first frames of a game (or else the first time it is drawn): a fog of soft blobs
  // that tiles 128 x 64, or an edge 32 square (the dark round the rim, or heat from the foot), in the layer's colour,
  // drawn larger and smoothed.
  texture(l) {
    let art = this.art.get(l.key);
    if (art) return art;
    const [r, g, b] = l.spec.color, fog = l.fog, w = fog ? 128 : 32, h = fog ? 64 : 32, canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const c = canvas.getContext('2d'), data = c.createImageData(w, h), px = data.data;
    let s = 0x9e3779b9 ^ (r * 65536 + g * 256 + b);
    const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
    // (A fog is two layers of values on a grid that wraps, eased between; it tiles with no seam.)
    const coarse = fog ? Array.from({ length: 32 }, rnd) : null, fine = fog ? Array.from({ length: 128 }, rnd) : null;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let a;
      if (fog) {
        const v = wraps(coarse, 8, 4, x / w * 8, y / h * 4) * 0.65 + wraps(fine, 16, 8, x / w * 16, y / h * 8) * 0.35;
        a = Math.max(0, Math.min(1, (v - 0.32) * 2.6)) ** 1.2;
      } else if (l.spec.below) {
        const v = y / (h - 1), side = Math.abs(x / (w - 1) - 0.5) * 2;
        a = Math.max(0, Math.min(1, (v - 0.45) / 0.55)) ** 1.6 + 0.25 * Math.max(0, side - 0.6) / 0.4;
      } else {
        const e = Math.hypot((x / (w - 1) - 0.5) * 2, (y / (h - 1) - 0.5) * 2) / Math.SQRT2;
        a = Math.max(0, Math.min(1, (e - 0.45) / 0.55)) ** 1.4;
      }
      const o = (y * w + x) * 4;
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = Math.round(255 * Math.min(1, a));
    }
    c.putImageData(data, 0, 0);
    this.art.set(l.key, canvas);
    return canvas;
  }
  // Frost at the four corners, as one picture of 64 x 64 whose quarters are the corners: needles of ice grown out
  // from each corner, a pixel at a time, each pixel with the stage it comes at.
  frost(color, stage) {
    let arts = this.frosts.get(color);
    if (!arts) this.frosts.set(color, arts = []);
    if (arts[stage]) return arts[stage];
    const S = 64, Q = S / 2;
    if (!this.needles) {
      // When each pixel of one corner's frost grows: needles from the corner, branching, longer near the edges.
      const when = this.needles = new Float32Array(Q * Q).fill(2);
      let s = 20261116;
      const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
      const grow = (x, y, a, len, at, depth) => {
        for (let n = 0; n < len; n++) {
          const ix = Math.round(x), iy = Math.round(y);
          if (ix < 0 || iy < 0 || ix >= Q || iy >= Q) return;
          const t = at + n / 28;
          if (t < when[iy * Q + ix]) when[iy * Q + ix] = t;
          if (depth < 2 && n > 2 && rnd() < 0.18) grow(x, y, a + (rnd() < 0.5 ? -1 : 1) * (0.7 + rnd() * 0.3), len * 0.4, t, depth + 1);
          x += Math.cos(a); y += Math.sin(a); a += (rnd() - 0.5) * 0.25;
        }
      };
      for (let n = 0; n < 14; n++) {
        const a = (n / 13) * Math.PI / 2, edge = Math.abs(a - Math.PI / 4) / (Math.PI / 4);
        grow(0, 0, a + (rnd() - 0.5) * 0.1, 8 + edge * 20 + rnd() * 6, rnd() * 0.15, 0);
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = S;
    const c = canvas.getContext('2d'), data = c.createImageData(S, S), px = data.data;
    const hex = parseInt(color.slice(1), 16), r = hex >> 16, g = (hex >> 8) & 255, b = hex & 255, upto = stage / 6;
    for (let y = 0; y < Q; y++) for (let x = 0; x < Q; x++) {
      const t = this.needles[y * Q + x];
      if (t > upto) continue;
      // The newest pixels are the faintest; the corner itself the most solid.
      const a = Math.round(255 * Math.min(1, 0.45 + (upto - t) * 2.5) * (1 - 0.35 * Math.hypot(x, y) / Q));
      for (const [u, v] of [[x, y], [S - 1 - x, y], [x, S - 1 - y], [S - 1 - x, S - 1 - y]]) {
        const o = (v * S + u) * 4;
        px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = a;
      }
    }
    c.putImageData(data, 0, 0);
    arts[stage] = canvas;
    return canvas;
  }
  // The lights the feel gives, inside the drawing's own (`Game.light`): the fireflies nearest the drill.
  lights(game) {
    let n = 0;
    const d = game.drill;
    for (let f = 0; f < this.flies && n < this.glowing.length; f++) {
      const fade = Math.min(1, this.ft[f], this.flife[f] - this.ft[f]);
      if (fade <= 0.2 || Math.hypot(this.fx[f] / T - d.x, this.fy[f] / T - d.y) > 14) continue;
      const g = this.glowing[n++];
      g[0] = Math.floor(this.fx[f] / T); g[1] = Math.floor(this.fy[f] / T); g[2] = 0.3 * fade; g[3] = 1.8;
    }
    this.lit = n;
    for (let m = 0; m < n; m++) { const g = this.glowing[m]; game.shine(g[0], g[1], g[2], g[3]); }
  }
}
