// The world: a vast grid of cells round a fixed core, far too large to hold whole. It is made a 64 x 64 piece at
// a time, the first time anything looks there, from the seed alone; only pieces that have been changed or seen are
// kept. This module owns what each cell is and how the ground is laid out: the table of kinds (`K`), the table of
// grounds (`BIOMES`, a row each) and the rules that lay them. It draws nothing, though a ground's row names the
// sheets the game draws it from.
//
// What must stay true: the same seed makes the same world on every JavaScript engine (a new rule uses only `hash`,
// `noise`, + - x / and sqrt; never Math.random, never a transcendental function), and nothing changes the ground a
// seed makes unless it is meant to (test/regress/w-same-world.mjs, tools/world-hash.mjs). Kind numbers and ground
// numbers never move: saved games hold them.

export const N = 16384, C = 8192, CH = 64, CW = N / CH;      // a cell is y * N + x; the core's middle cell is (C, C)

// ---------------------------------------------------------------- what a cell can be
// One table of kinds. A kind's number is what a piece of the world stores for a cell (and what a saved game holds),
// so a number never moves and never means something else: a new kind takes the next free number, up to 31.
// Of each: what can cut it (`hard`: 1 anything, 99 nothing; nothing is unminable but the core, bedrock and what is
// hauled whole), what a hauled cell pays in grit and in gems, and how long it takes to cut with the first bit, in
// seconds (`dig`: tougher ground only takes longer).
const KINDS = [];
const kind = (id, name, hard, grit, gems, dig) => { KINDS[id] = { id, name, hard, grit, gems, dig }; return id; };
export const K = {
  EMPTY: kind(0, 'EMPTY', 0, 0, 0, 0),
  CORE: kind(1, 'CORE', 99, 0, 0, 0),
  BEDROCK: kind(2, 'BEDROCK', 99, 0, 0, 0),
  SOFT: kind(3, 'SOFT', 1, 1, 0, 0.24),
  DENSE: kind(4, 'DENSE', 1, 2, 0, 0.45),
  ORE_A: kind(5, 'ORE_A', 1, 2, 1, 0.24),
  ORE_B: kind(6, 'ORE_B', 1, 4, 5, 0.45),
  SLATE: kind(7, 'SLATE', 1, 4, 0, 1.0),
  VAULT: kind(8, 'VAULT', 1, 10, 0, 1.8),
  HAZARD: kind(9, 'HAZARD', 1, 3, 2, 0.24),             // a ground's first hazard: which, its row says (`haz`)
  RELIC: kind(10, 'RELIC', 99, 0, 0, 0),
  ICE: kind(11, 'ICE', 1, 0, 0, 0.18),
  BASALT: kind(12, 'BASALT', 1, 1, 0, 0.45),
  CACHE: kind(13, 'CACHE', 1, 0, 0, 0.6),
  WRECK: kind(14, 'WRECK', 99, 0, 0, 0),
  // Kinds 15 and on are named here so their numbers are settled; the ground that lays them comes later.
  MINERAL: kind(15, 'MINERAL', 1, 0, 0, 0.45),          // a pocket's mineral: which one, the cell's row says
  NODE: kind(16, 'NODE', 1, 0, 0, 0.45),                // a pocket's special cell; its `dig` is its row's `pocket.nodeDig`
  HAZARD2: kind(17, 'HAZARD2', 1, 3, 2, 0.24),          // a ground's second hazard (`haz2`)
  KEY: kind(18, 'KEY', 1, 4, 0, 1.0),
  FAULT: kind(19, 'FAULT', 1, 1, 0, 0.12),
  SLAG: kind(20, 'SLAG', 1, 2, 0, 0.45),                // the dull rind of a pocket of lava
  // Slag that lava has quenched; its gems are the south's. A woken pocket makes about three cells of steel for
  // every four of lava it had (counted in play), so at 4 gems waking a pocket pays half as much again in gems as
  // hauling it asleep (2 a cell of lava), for the trouble of the flood; at the 2 first planned it paid less.
  STEEL: kind(21, 'STEEL', 1, 6, 4, 0.6),
  CAP: kind(22, 'CAP', 1, 1, 1, 0.24),                  // its gems are the west's
  CAP_LIT: kind(23, 'CAP_LIT', 1, 1, 3, 0.24),          // its gems are the west's
  PRISM: kind(24, 'PRISM', 1, 0, 0, 0.6),
  GLASS: kind(25, 'GLASS', 1, 1, 0, 0.12),
  TWIN: kind(26, 'TWIN', 1, 2, 0, 0.6),
  FOSSIL: kind(27, 'FOSSIL', 1, 2, 0, 1.0),
};
export const KIND_NAMES = KINDS.map(k => k.name);
// What is worth calling out the first time it is seen (`World.see`), by kind. Slate is, where it is a geode's shell;
// a pocket's mineral is too, and which kind that is its row says.
const NOTABLE = [];
NOTABLE[K.CACHE] = 'cache'; NOTABLE[K.WRECK] = 'wreck'; NOTABLE[K.RELIC] = 'relic'; NOTABLE[K.KEY] = 'key'; NOTABLE[K.PRISM] = 'prism'; NOTABLE[K.SLATE] = 'geode';
export const HARD = KINDS.map(k => k.hard), GRIT = KINDS.map(k => k.grit), GEMS = KINDS.map(k => k.gems), DIG_TIME = KINDS.map(k => k.dig);

// ---------------------------------------------------------------- whose ground a cell is
// The four directions' own grounds, by number: north, south, west, east. The same numbers are the four gems', and a
// ground's `kin` is which of the four it belongs to (0: none, the home ground).
export const B = { CRUST: 0, FROST: 1, EMBER: 2, MIRE: 3, LODE: 4 };
// (The kin of grounds 0 to 8 by arithmetic, as the world was first written. Only the plain reading of that first
// world in test/regress/w-same-world.mjs still asks this way: everything else reads the ground's row.)
export const base = b => b > 4 ? b - 4 : b;
// What a hazard is and looks like comes from its type, never from the ground it lies in: whose gems it pays when
// lassoed asleep, the sheet its sprite is on (never recoloured), and for the two that are scattered a cell at a
// time, how many cells in one are hazards where the ground's `rate` is 1. Lava lies in pockets, where a layer of
// noise is over the ground's own threshold `t`.
// What goes with a hazard wherever it is laid, in any ground, as its first hazard or its second (a ground's row may
// give a figure of its own in `haz`, and 0 is none of it):
//   rind   lava lies in a rind of dull slag: plain rock is slag where the lava's layer of noise is under the
//          pocket's threshold by less than this, and half of the plain rock among the lava is slag too. Slag is
//          worth little; lava that wakes beside it turns it to steel (js/game.js: `quench`).
//   ribs   charged crystals stud the flanks of slate: a cell just outside a rib or a level bed of slate (within
//          RIB of its edge on the slate's own layer of noise, which is the nearer half of the cells against it)
//          is a crystal where its hash is under this times the ground's `rate`: one such cell in five. An arc
//          shatters the slate beside it (js/game.js: `zap`) and sets off the crystals within three cells, and
//          along a rib they stand that near: one nick unzips a run of it, seven cells of slate as often as not.
//          (Counted, tools/strains.mjs. The figures first planned, one cell in ten within 0.015, left a crystal
//          every ten cells of rib, and an arc took three cells of slate and stopped.)
export const HAZARDS = {
  lava: { kin: B.EMBER, sheet: 'ember-items', share: 0, rind: 0.07 },
  spore: { kin: B.MIRE, sheet: 'mire-items', share: 0.022 },
  spark: { kin: B.LODE, sheet: 'lode-items', share: 0.026, ribs: 0.2 },
};
const RIB = 0.03;
const KIN_ITEMS = ['lode-items', 'frost-items', 'ember-items', 'mire-items', 'lode-items'];

// One table of grounds (biomes), by number. The number is what a piece of the world stores for a cell, so, as with
// kinds, it never moves:
//   0-8      the home ground, the four directions' grounds and their four deep kinds
//   9-16     seams          17-31    hand-made strains          32-63    pockets          64-127   more hand-made rows
//   128-187  generated crosses                                  192-239  generated flank pockets
// A row says everything that differs from ground to ground, and the game reads it wherever it once asked which
// ground a number was:
//   id, name, title (the name as it is shown)
//   kin                 whose direction it is; gemA, gemB: whose gems its two ores pay
//   rich, gemx, worth   what multiplies a hauled cell's grit (rich, worth) and gems (gemx)
//   dig                 what multiplies the time to cut a cell
//   sheet, floor, items the terrain sheet of its rock, of its floor, and the sheet of its dense rock and ores
//   gloom, dark         the colour of its dark, and how deep the dark is (1 as everywhere today)
//   mote                [colour, drift]: the motes in its air, and whether they 'fall', 'rise', 'sway' or hang 'still'
//   map, debris         its colour on the map (its sheet's own ground colour) and the three colours of its chips
//   gen                 the thresholds its standard ground is laid by: { dense, oreA, oreB, slate, cave, cavern }
//                       (null: the home ground, which has rules of its own in `kindAt`)
//   haz, haz2           its hazards, { type, rate, t } or null: K.HAZARD cells are the first, K.HAZARD2 the second
//                       (and what goes with a hazard, where the ground's figure is not its type's: `HAZARDS`)
//   lavaVol, freeze     how far a lava pocket of it pours; seconds until a cut closes with ice (0: never)
//   extras              the names of what else is laid in it, each a rule of `TELLS`
//   glass, pocket       for ground yet to come (docs/CONTENT-PLAN.md S1): nothing reads them yet
// and `lay`, made from gen, the hazards and the extras: the same numbers as `kindAt` wants them, worked out once.
export const BIOMES = [];
const SCATTER = 2, POCKETS = 1;                 // how a hazard is laid: a cell at a time by its hash, or in pockets of noise
// What a ground may have laid in it besides its standard ground (its row's `extras`), and the one figure each is
// laid by. Each is a tell: a shape in the ground that says which place this is before its colour does.
//   rivers   long winding rivers of ice through the rock, two to four cells wide: quick to cut, and worth nothing
//   lanes    a mesh of lanes of ice two or three cells wide, round blocks of rock six to twelve cells across
//   bubbles  open bubbles of one to three cells, everywhere
//   grapes   the first hazard hung in bunches of three to six
//   strata   slate in long level beds, a cell or two thick
// The figure is how far to either side of the middle of its layer of noise the ice or slate lies (rivers, lanes,
// strata), or what the layer must be over (bubbles, grapes). `OFF` is the figure of a ground with none of that.
// The figures were set by counting (tools/strains.mjs) and by eye (tools/shot.mjs): rivers are 5 cells in a hundred
// of firn, lanes 15 of serac, bubbles 5 of scoria beyond its caves; a square of sporefall in seven has a bunch;
// redrock has as much slate as the east's own ground, 12 in a hundred, lying level.
export const TELLS = { rivers: 0.02, lanes: 0.085, bubbles: 0.8, grapes: 0.85, strata: 0.05 };
const OFF = { rivers: 0, lanes: 0, bubbles: 2, grapes: 2, strata: 0 };
const river = (x, y, seed, w) => Math.abs(noise(x / 40, y / 40, seed + 66, 66) - 0.5) < w;
const lane = (x, y, seed, w) => Math.abs(noise(x / 6, y / 6, seed + 65, 65) - 0.5) < w;
const bubble = (x, y, seed, t) => noise(x / 2, y / 2, seed + 67, 67) > t;
// Bunches hang on a grid of squares six cells across: a square has one or none, by its own hash, with its middle
// cell at least a cell inside the square, so that a cell asks only about its own square. The pods are the middle
// cell and, of the eight round it, those their own hash keeps: three to six for the most part.
const grape = (x, y, seed, t) => {
  const gx = Math.floor(x / 6), gy = Math.floor(y / 6), h = hash(gx, gy, seed + 64);
  if (h < t) return false;
  const at = Math.floor((h - t) / (1 - t) * 16), ex = x - gx * 6 - 1 - (at & 3), ey = y - gy * 6 - 1 - (at >> 2);
  return ex >= -1 && ex <= 1 && ey >= -1 && ey <= 1 && ((ex === 0 && ey === 0) || hash(x, y, seed + 10) < 0.6);
};
// (How far a cell is from the middle of a level bed, on the bed's layer: under the ground's figure it is slate.)
const stratum = (x, y, seed) => Math.abs(noise(x / 40, y / 3, seed + 11, 11) - 0.5);
// The hand-made strains of each direction's ground (grounds 17 to 31), by kin: `biomeAt` lays them as provinces.
const STRAINS = [[], [], [], [], []];
const laid = (haz, what) => {
  if (!haz) return [0, 0];
  const type = HAZARDS[haz.type];
  if (!type) throw new Error(`${what}: there is no hazard called ${haz.type}`);
  if (!type.share && typeof haz.t !== 'number') throw new Error(`${what}: ${haz.type} needs its threshold t`);
  return type.share ? [SCATTER, type.share * (haz.rate ?? 1)] : [POCKETS, haz.t];
};
// What goes with a hazard in a ground (`rind`, `ribs`): the ground's own figure, or its type's, or none.
const withIt = (haz, what) => haz ? haz[what] ?? HAZARDS[haz.type][what] ?? 0 : 0;
// Adds a row to the table (or takes the place of one: tests do). Whatever is left out is as the plainest ground has
// it; what a ground must say for itself is asked for.
export function biome(f) {
  const { id, name } = f, kin = f.kin ?? 0;
  if (!Number.isInteger(id) || id < 0 || id > 255 || typeof name !== 'string') throw new Error(`a ground needs a number from 0 to 255 and a name: ${id} ${name}`);
  for (const need of ['gloom', 'mote', 'map', 'debris']) if (!Array.isArray(f[need])) throw new Error(`${name}: a ground says its ${need}`);
  const [haz, hazT] = laid(f.haz, name), [haz2, haz2T] = laid(f.haz2, name), g = f.gen ?? null, tells = { ...OFF };
  for (const extra of f.extras ?? []) {
    if (!(extra in TELLS)) throw new Error(`${name}: there is no extra called ${extra}`);
    if (!g || (extra === 'grapes' && !haz)) throw new Error(`${name}: ${extra} need ${g ? 'a hazard to hang' : 'standard ground to lie in'}`);
    tells[extra] = TELLS[extra];
  }
  for (const list of STRAINS) if (list.includes(id)) list.splice(list.indexOf(id), 1);
  if (id >= 17 && id <= 31 && kin) STRAINS[kin].push(id);
  return BIOMES[id] = {
    id, name, title: f.title ?? name.toUpperCase(), kin, gemA: f.gemA ?? kin, gemB: f.gemB ?? kin,
    rich: f.rich ?? 1, gemx: f.gemx ?? 1, worth: f.worth ?? 1, dig: f.dig ?? 1,
    sheet: f.sheet ?? name, floor: f.floor ?? `${name}-floor`, items: f.items ?? KIN_ITEMS[kin],
    gloom: f.gloom, dark: f.dark ?? 1, mote: f.mote, map: f.map, debris: f.debris,
    gen: g, haz: f.haz ?? null, haz2: f.haz2 ?? null, lavaVol: f.lavaVol ?? 5, freeze: f.freeze ?? 0,
    glass: f.glass ?? false, extras: f.extras ?? [], pocket: f.pocket ?? null,
    lay: g && { dense: g.dense, oreA: g.oreA, oreB: g.oreB, slate: g.slate, cave: g.cave, cavern: g.cavern, haz, hazT, haz2, haz2T,
      rind: withIt(f.haz, 'rind'), rind2: withIt(f.haz2, 'rind'), ribs: withIt(f.haz, 'ribs') * (f.haz?.rate ?? 1), ribs2: withIt(f.haz2, 'ribs') * (f.haz2?.rate ?? 1), ...tells },
  };
}
// The row of a ground's number: the home ground's for a number that has no row.
export const rowOf = b => BIOMES[b] ?? BIOMES[0];
// What hazard a cell of kind `k` in ground `row` is: 'lava', 'spore', 'spark', or null (not a hazard, or one of a
// kind this ground has none of).
export const hazOf = (k, row) => (k === K.HAZARD ? row.haz : k === K.HAZARD2 ? row.haz2 : null)?.type ?? null;
// Whose gems a cell pays (1 north, 2 south, 3 west, 4 east).
export const gemKin = (k, row) => k === K.ORE_A ? row.gemA : k === K.ORE_B ? row.gemB : k === K.STEEL ? B.EMBER : k === K.CAP || k === K.CAP_LIT ? B.MIRE
  : k === K.HAZARD || k === K.HAZARD2 ? HAZARDS[hazOf(k, row)]?.kin ?? row.kin : row.kin;
// How long a cell takes to cut with the first bit, in seconds.
export const digTime = (k, row) => (k === K.NODE && row.pocket ? row.pocket.nodeDig : DIG_TIME[k]) * row.dig;

// The home ground: its own rules of generation, and no gems.
biome({ id: 0, name: 'crust', kin: 0, gemx: 0, gloom: [10, 8, 7], mote: ['#8a7a66', 'still'], map: [111, 91, 73], debris: ['#6f5b49', '#806a55', '#a08a6c'] });
// The four directions. North: a cut closes over with ice. South: pockets of lava. West: more caves, and spore pods.
// East: more slate, and charged crystals.
const GROUND = { dense: 0.68, oreA: 0.66, oreB: 0.74, slate: 0.03, cave: 0.8, cavern: 0.78 };
biome({ id: 1, name: 'frost', kin: B.FROST, gloom: [5, 12, 30], mote: ['#ffffff', 'fall'], map: [188, 216, 238], debris: ['#bcd8ee', '#ffffff', '#a2c4e2'],
  gen: GROUND, freeze: 30 });
biome({ id: 2, name: 'ember', kin: B.EMBER, gloom: [22, 5, 6], mote: ['#ff9a3a', 'rise'], map: [116, 64, 58], debris: ['#74403a', '#c07a5c', '#ff8a3a'],
  gen: { ...GROUND, dense: 0.64 }, haz: { type: 'lava', rate: 1, t: 0.78 } });
biome({ id: 3, name: 'mire', kin: B.MIRE, gloom: [14, 6, 26], mote: ['#a5f0a0', 'sway'], map: [102, 84, 120], debris: ['#665478', '#5f9450', '#b4e878'],
  gen: { ...GROUND, cave: 0.68, cavern: 0.7 }, haz: { type: 'spore', rate: 1 } });
biome({ id: 4, name: 'lode', kin: B.LODE, gloom: [22, 13, 4], mote: ['#ffe08a', 'still'], map: [185, 138, 90], debris: ['#b98a5a', '#f0d8a0', '#a57648'],
  gen: { ...GROUND, slate: 0.05 }, haz: { type: 'spark', rate: 1 } });
// Far out, the ground to either side of each direction's middle turns into a richer, meaner kind of the same: more
// ore, twice the pay, and its hazard nearly twice as thick.
const deep = (id, name, of, looks) => {
  const { gen, haz, freeze } = BIOMES[of];
  return biome({ id, name, kin: of, rich: 2, gemx: 2, gen: { ...gen, oreA: 0.6, oreB: 0.66 }, freeze,
    haz: haz && (haz.type === 'lava' ? { ...haz, rate: 1.8, t: 0.72 } : { ...haz, rate: 1.8 }), ...looks });
};
deep(5, 'rime', B.FROST, { gloom: [3, 18, 24], mote: ['#d8fff4', 'fall'], map: [98, 184, 180], debris: ['#62b8b4', '#d8fff4', '#84d4c8'] });
deep(6, 'magma', B.EMBER, { gloom: [30, 5, 3], mote: ['#ffc040', 'rise'], map: [122, 36, 24], debris: ['#7a2418', '#e8743a', '#ffb040'] });
deep(7, 'bloom', B.MIRE, { gloom: [26, 4, 28], mote: ['#ffa0e0', 'sway'], map: [138, 60, 140], debris: ['#8a3c8c', '#ffa0e0', '#7af0d0'] });
deep(8, 'gilt', B.LODE, { gloom: [24, 18, 2], mote: ['#ffe680', 'still'], map: [110, 90, 52], debris: ['#6e5a34', '#ffe680', '#ffd040'] });
// Two strains of each direction's ground, laid as provinces from a little way out (`biomeAt`), so that a long flight
// keeps coming into somewhere else. Each is its direction's ground with a few figures changed and a tell of its own
// in the shape of the ground; its floor, its dark, its motes, its ore and its hazard's kind are its direction's, so
// that colour and icon still say whose gems it pays. `rich` follows the danger and the cutting time:
// 1 + 0.4 x (how many times the hazard - 1) + 0.3 x (dig - 1), near enough.
const strain = (id, name, of, f) => {
  const kin = BIOMES[of];
  return biome({ id, name, kin: of, floor: kin.floor, gloom: kin.gloom, mote: kin.mote, freeze: kin.freeze, haz: kin.haz, ...f, gen: { ...kin.gen, ...f.gen } });
};
// North. Firn: massive ice with few caves, crossed by long frozen rivers that are quick roads; a cut stays open
// longer. Serac: shattered by a mesh of brittle lanes, so pieces come loose easily; a cut closes fast.
strain(17, 'firn', B.FROST, { rich: 0.95, freeze: 45, gen: { dense: 0.60, cave: 0.86, cavern: 0.84 }, extras: ['rivers'],
  map: [154, 180, 210], debris: ['#9ab4d2', '#a8c0dc', '#eef6ff'] });
strain(18, 'serac', B.FROST, { rich: 1.05, freeze: 15, extras: ['lanes'], map: [234, 248, 255], debris: ['#eaf8ff', '#cfe8f8', '#6cb2e4'] });
// South. Scoria: frothy, with bubbles everywhere and less lava. Forge: clinker, with more lava that pours further.
strain(19, 'scoria', B.EMBER, { rich: 0.95, haz: { type: 'lava', rate: 1, t: 0.80 }, extras: ['bubbles'], map: [150, 88, 74], debris: ['#96584a', '#aa6c58', '#dc9c7c'] });
strain(20, 'forge', B.EMBER, { rich: 1.25, haz: { type: 'lava', rate: 1, t: 0.735, rind: 0.12 }, lavaVol: 7, gen: { slate: 0.04 }, map: [102, 70, 68], debris: ['#664644', '#7e5a56', '#ff9a3a'] });
// West. Tangle: great open caves with thin bridges between them. Sporefall: pods hang in bunches.
strain(21, 'tangle', B.MIRE, { rich: 1, gen: { cavern: 0.60 }, map: [62, 90, 64], debris: ['#3e5a40', '#5a4a70', '#a8e070'] });
strain(22, 'sporefall', B.MIRE, { rich: 1.2, haz: { type: 'spore', rate: 0.5 }, gen: { oreA: 0.63 }, extras: ['grapes'], map: [168, 136, 184], debris: ['#a888b8', '#b898c6', '#b4e878'] });
// East. Redrock: its slate lies in level beds, so loops come out long and flat. Loess: pale silt that cuts in half
// the time and holds little ore: the quick road.
strain(23, 'redrock', B.LODE, { rich: 1, gen: { slate: 0 }, extras: ['strata'], map: [168, 90, 58], debris: ['#a85a3a', '#bc6e48', '#f0b080'] });
strain(24, 'loess', B.LODE, { rich: 0.85, dig: 0.5, gen: { dense: 0.76, oreA: 0.72, oreB: 0.80, slate: 0.02 }, haz: { type: 'spark', rate: 0.5 }, map: [228, 220, 200], debris: ['#e4dcc8', '#f0ead8', '#ffffff'] });

export const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
// The cell next to a cell on each side, as steps of its number: east, south, west, north (as DX, DY). And how far
// `freed` walks outlines: JOIN sides each while there is more than one to settle or one is known to be held, WALK
// sides in all, OUTLINE sides for the one left when nothing says it is not the rest of the world. HOLLOW is how
// many cells are followed from a cut that opened only on to a closed hollow.
const STEP = [1, N, -1, -N], OUTLINE = 600, JOIN = 20000, WALK = 60000, HOLLOW = 4000;
// Plain home ground runs out to HOME_R before any direction's ground begins; the flanks turn strange past DEEP_R;
// what each direction hides lies RELIC_R out; the world ends at WORLD_R.
export const HOME_R = 130, DEEP_R = 900, RELIC_R = 2000, WORLD_R = 2400;
// Things to find. The ground is laid out in sectors FIND cells across, and a sector may hold a geode (a shell of slate
// round rich ore) or a cache (a crate buried in stone). Eight wrecks lie at set distances, each in a hollow of its
// own with what is left of its hull; each holds a part of an older machine.
export const FIND = 48, WRECK_R = [45, 90, 160, 300, 500, 800, 1200, 1700];
// What a sector holds is said by one hash of the sector, and the whole of its range is allotted here once: each
// find has the band up to its figure from the one before, and what is over the last holds nothing. A geode and a
// cache are laid by `findAt`. The other three have their bands and nothing laid yet (a prism only where its middle
// is over PRISM_R cells out): whoever lays one adds its cells to `findAt`, and until then the sector's ground is
// plain.
export const FINDS = [[0.38, 'geode'], [0.70, 'cache'], [0.74, 'prism'], [0.80, 'twin'], [0.86, 'fossil']];
const GEODES = FINDS[0][0], CACHES = FINDS[1][0], PRISMS = FINDS[2][0], HELD = FINDS[FINDS.length - 1][0], PRISM_R = 130;
// Pockets (mini zones) are laid out in sectors ZONE cells across, one pocket at the most in each.
export const ZONE = 128;
// Past the four pieces of ground round the core, each direction's ground is laid out in provinces PROVINCE cells
// across, and a province may be a strain of the direction's ground (`World.province`).
export const PROVINCE = 256;
export const onCore = (x, y) => Math.abs(x - C) <= 1 && Math.abs(y - C) <= 1;

const hash = (x, y, s) => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export const cellHash = hash;
// Smooth noise in [0, 1): the hashes at the four whole points round (x, y), blended. `s` is the world's seed plus
// the layer's number `k` (0 to 127: a layer added to the seed is its own number), and each layer remembers the four
// hashes of the square it was last asked about: a piece of the world is made a row at a time, so most cells ask
// about the square the cell before them did.
// Layers and hash seeds in use (added to the world's seed): 1-3 and 14-17 whose ground a cell is; 4 the world's
// edge; 5-13 and 18 the ground itself; 21-24 finds; 31-32 wrecks; 55 and 300 + a strain's number, provinces (56 and
// 57 are kept for crosses); 58-59 a second hazard; 64 grapes, 65 lanes, 66 rivers, 67 bubbles (strata are on 11,
// stretched); 68 slag among lava. docs/CONTENT-PLAN.md (S3) allots the rest: take a number from there, so that no two rules read the
// same layer.
const kept = new Float64Array(128 * 7).fill(NaN);
const noise = (x, y, s, k = s & 127) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, m = k * 7;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  if (kept[m] !== xi || kept[m + 1] !== yi || kept[m + 2] !== s) {
    kept[m] = xi; kept[m + 1] = yi; kept[m + 2] = s;
    kept[m + 3] = hash(xi, yi, s); kept[m + 4] = hash(xi + 1, yi, s); kept[m + 5] = hash(xi, yi + 1, s); kept[m + 6] = hash(xi + 1, yi + 1, s);
  }
  const a = kept[m + 3], b = kept[m + 4], c = kept[m + 5], d = kept[m + 6];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
// Noise never leaves [0, 1) by more than rounding, so where a test against it is settled whatever it is, it is not
// worked out at all: `SURE` is the margin kept for that rounding.
const SURE = 1e-6;

export class World {
  constructor() {
    this.chunks = new Array(CW * CW);      // each { kind, biome, seen }, made when first looked at
    this.touched = new Set();              // pieces changed since the last save
    this.lava = new Map();                 // seconds of lava left in an open cell
    this.dug = new Map();                  // when the drill opened a cell of the north (for the ice to close it)
    this.seed = 1;
    this.made = 0;                         // pieces of the world made, and outline sides walked and cells followed by
    this.sides = 0; this.followed = 0;     // `freed` and `pieceIn`: for tests of how much work is done
    this.sector = { sx: NaN, sy: NaN, seed: NaN, what: 1, fx: 0, fy: 0, size: 3 };      // the sector `findAt` last looked at
    this.asked = { sx: NaN, sy: NaN, seed: NaN, what: 1, fx: 0, fy: 0, size: 3 };       // and the one `findSpot` did
    this.spotted = [];                     // things seen for the first time and not yet called out: `see` adds, the game takes
    this.provinces = new Uint8Array(4096).fill(255);      // the ground of each province and direction asked about (255: not yet)
    this.relicAt = [0, 1, 2, 3].map(d => (C + DY[d] * RELIC_R) * N + C + DX[d] * RELIC_R);
  }
  // Where the eight wrecks lie in this world: [x, y] each, in a direction of its own.
  get wrecks() {
    if (this.wrecksFor !== this.seed) {
      this.wrecksFor = this.seed;
      this.wreckSpots = WRECK_R.map((r, n) => {
        const ux = hash(n, 1, this.seed + 31) - 0.5, uy = hash(n, 2, this.seed + 31) - 0.5, len = Math.sqrt(ux * ux + uy * uy) || 1;
        return [C + Math.round(ux / len * r), C + Math.round(uy / len * r)];
      });
      this.wreckX = Int32Array.from(this.wreckSpots, p => p[0]); this.wreckY = Int32Array.from(this.wreckSpots, p => p[1]);
    }
    return this.wreckSpots;
  }
  // What a sector of FIND cells holds and where, worked out into the record `S`: `what` is the sector's hash, which
  // lies in the band of what it holds (`FINDS`: under 0.38 a geode, `size` cells from its middle to the outside of
  // its shell; under 0.7 a cache; and so on), or is 1 where it holds nothing; `fx`, `fy` is the middle cell. A sector
  // is its place counted from the core's: (x - C) / FIND, floored.
  find(sx, sy, S) {
    const seed = this.seed;
    S.sx = sx; S.sy = sy; S.seed = seed; S.what = hash(sx, sy, seed + 21);
    if (S.what >= HELD) { S.what = 1; return; }
    S.fx = C + sx * FIND + 8 + Math.floor(hash(sx, sy, seed + 22) * (FIND - 16)); S.fy = C + sy * FIND + 8 + Math.floor(hash(sx, sy, seed + 23) * (FIND - 16));
    const dx = S.fx - C, dy = S.fy - C, far = dx * dx + dy * dy;
    if (far < 16 * 16 || (S.what >= CACHES && S.what < PRISMS && far <= PRISM_R * PRISM_R)) S.what = 1;
    else if (S.what < GEODES) S.size = hash(sx, sy, seed + 24) < 0.4 ? 4 : 3;
  }
  // What a sector holds, asked without making any of the world: [what, x, y, size], `what` being a name from
  // `FINDS` ('geode', 'cache', 'prism', 'twin', 'fossil') or null, with the find's middle cell and, of a geode, its
  // size. (What is truly there is the world's cells to say: a wreck or a relic's vault laid over a find has taken
  // its place, and the last three names have no cells laid yet.)
  findSpot(sx, sy) {
    const S = this.asked;
    if (S.sx !== sx || S.sy !== sy || S.seed !== this.seed) this.find(sx, sy, S);
    for (let n = 0; n < FINDS.length; n++) if (S.what < FINDS[n][0]) return [FINDS[n][1], S.fx, S.fy, n ? 1 : S.size];
    return [null, 0, 0, 0];
  }
  // What a sector's find puts in a cell, or -1 where it puts nothing. What the sector holds and where is worked out
  // once and kept while cells of the same sector are asked about.
  findAt(x, y) {
    const sx = Math.floor((x - C) / FIND), sy = Math.floor((y - C) / FIND), S = this.sector;
    if (S.sx !== sx || S.sy !== sy || S.seed !== this.seed) this.find(sx, sy, S);
    const what = S.what;
    if (what >= CACHES) return -1;
    const dx = x - S.fx, dy = y - S.fy;
    if (what < GEODES) {
      // A geode: slate outside, ore within, and in the bigger ones a hollow at the heart.
      const size = S.size, far = Math.sqrt(dx * dx + dy * dy);
      if (far > size - 0.2) return -1;
      return far > size - 1.3 ? K.SLATE : size === 4 && far < 0.5 ? K.EMPTY : K.ORE_B;
    }
    const edge = Math.max(Math.abs(dx), Math.abs(dy));
    return edge === 0 ? K.CACHE : edge === 1 ? K.DENSE : -1;
  }
  // The pocket laid in a sector of ZONE cells (sx, sy: the sector's place, counted from the core's), as
  // { key, row, cx, cy, rho, kin }: the key it is known by, its ground's number, its middle, how far it runs and
  // whose direction its middle lies in. Null where the sector has none. (No pockets are laid yet,
  // docs/CONTENT-PLAN.md S3: until they are, no sector has one.)
  zoneOf(sx, sy) { return null; }
  reset(seed) {
    this.seed = seed;
    this.chunks = new Array(CW * CW);
    this.touched.clear(); this.lava.clear(); this.dug.clear();
    this.made = 0;
    this.spotted.length = 0;
    this.provincesFor = NaN;
  }

  // Whose ground a cell is, from the seed alone. The rules, in the order they are asked (docs/CONTENT-PLAN.md S3):
  // the first that holds is the answer.
  //   1. a pocket          (not laid yet: `zoneOf`. Its place is here, before the home ground, for cells over 150 out)
  //   2. the home ground
  //   3. which direction's ground, on borders that wander
  //   4. a seam along a diagonal   (not laid yet. Its place is after the direction is known and before the flanks)
  //   5. a deep flank: strains and crosses never take the place of one
  //   6. the province the cell lies in: a cross (not laid yet), a hand-made strain of the direction, or
  //   7. the direction's own ground.
  biomeAt(x, y) {
    const seed = this.seed, dx = x - C, dy = y - C, r = Math.sqrt(dx * dx + dy * dy);
    if (r < HOME_R - 25 - SURE || (r < HOME_R + 25 + SURE && r < HOME_R + (noise(x / 30, y / 30, seed + 3, 3) - 0.5) * 50)) return B.CRUST;
    // The larger of the two distances, on a border that wanders in long sweeps and small wobbles.
    const far = Math.min(90, r * 0.2), near = Math.min(8, r * 0.1), n1 = noise(x / 61, y / 61, seed + 1, 1), n2 = noise(x / 61, y / 61, seed + 2, 2);
    const ax = Math.abs(dx) + (n1 - 0.5) * far + (noise(x / 9, y / 9, seed + 16, 16) - 0.5) * near;
    const ay = Math.abs(dy) + (n2 - 0.5) * far + (noise(x / 9, y / 9, seed + 17, 17) - 0.5) * near;
    const b = ax > ay ? (dx > 0 ? B.LODE : B.MIRE) : (dy < 0 ? B.FROST : B.EMBER);
    if (r > DEEP_R - 100 - SURE) {
      const least = Math.min(Math.abs(dx), Math.abs(dy)), flank = Math.max(Math.abs(dx), Math.abs(dy)) * 0.36;
      if (least > flank - 30 - SURE && r > DEEP_R + (noise(x / 50, y / 50, seed + 14, 14) - 0.5) * 200 && least > flank + (noise(x / 37, y / 37, seed + 15, 15) - 0.5) * 60) return b + 4;
      if (r > WORLD_R + 2) return b;           // past the world's edge there is only bedrock, and no province is asked for
    }
    // Provinces are PROVINCE cells across, on borders that wander with the same long sweeps as the directions' do.
    // The four round the core are too near it to be anything but their direction's own ground, and are not asked.
    const u = dx + (n1 - 0.5) * 120, v = dy + (n2 - 0.5) * 120;
    if (u >= -PROVINCE && u < PROVINCE && v >= -PROVINCE && v < PROVINCE) return b;
    return this.province(Math.floor(u / PROVINCE), Math.floor(v / PROVINCE), b);
  }
  // What the ground of direction `kin` is in province (px, py), provinces being counted from the core's cell.
  // A province whose middle is under 220 cells out is its direction's own ground. Further out, by the province's
  // own hash: a share `X` of provinces, none under 500 cells out and never more than 0.35, is kept for generated
  // crosses (not laid yet: the direction's own ground until they are); two thirds of the rest are a hand-made
  // strain of the direction, the one whose own hash for the province is largest, so that a strain added later
  // takes few provinces from the others; the last third is the direction's own. A province on a border between
  // two directions is asked for each. What is worked out is kept, a number for each province and direction.
  province(px, py, kin) {
    const seed = this.seed;
    if (this.provincesFor !== seed) { this.provincesFor = seed; this.provinces.fill(255); }
    const at = (((py + 16) & 31) << 7) | (((px + 16) & 31) << 2) | (kin - 1), known = this.provinces[at];
    if (known !== 255) return known;
    const mx = (px + 0.5) * PROVINCE, my = (py + 0.5) * PROVINCE, rc = Math.sqrt(mx * mx + my * my);
    let b = kin;
    if (rc >= 220) {
      const X = Math.min(0.35, Math.max(0, (rc - 500) / 2500)), pick = hash(px, py, seed + 55);
      if (pick >= X && pick < X + (1 - X) * 2 / 3) for (let n = 0, most = -1, list = STRAINS[kin]; n < list.length; n++) {
        const h = hash(px, py, seed + 300 + list[n]);
        if (h > most) { most = h; b = list[n]; }
      }
    }
    return this.provinces[at] = b;
  }
  // Whose ground a cell is, as far as is known: what a piece of the world holds where it has been made (a saved
  // game's older pieces may hold ground that is laid otherwise now), and from the seed alone where it has not.
  // Asking never makes a piece.
  biomeKnown(x, y) {
    const p = this.chunks[((y >> 6) << 8) | (x >> 6)];
    return p ? p.biome[((y & 63) << 6) | (x & 63)] : this.biomeAt(x, y);
  }
  // What a cell is before anything has touched it, from the seed alone.
  kindAt(x, y, b) {
    const seed = this.seed, dx = x - C, dy = y - C, r = Math.sqrt(dx * dx + dy * dy);
    if (r > WORLD_R + 1.5 + SURE || (r > WORLD_R - 1.5 - SURE && r > WORLD_R + (noise(x / 5, y / 5, seed + 4, 4) - 0.5) * 3)) return K.BEDROCK;
    // The core is a platform: its nine cells and the gap round them are open. Beside it lies a first piece already
    // cut loose, to show what drawing the tether round something does.
    if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) return K.EMPTY;
    if (dx >= 3 && dx <= 6 && dy >= -2 && dy <= 1) return dx === 3 || dx === 6 || dy === -2 || dy === 1 ? K.EMPTY : (dx + dy) % 2 ? K.ORE_A : K.SOFT;
    // What each direction hides: a relic sealed in ancient stone. (Asked only of cells that far out.)
    if (r > RELIC_R - 8 && r < RELIC_R + 8) for (let d = 0; d < 4; d++) {
      const edge = Math.max(Math.abs(dx - DX[d] * RELIC_R), Math.abs(dy - DY[d] * RELIC_R));
      if (edge === 0) return K.RELIC;
      if (edge <= 3) return K.VAULT;
      if (edge <= 5) return K.SOFT;
    }
    if (this.wrecksFor !== seed) this.wrecks;
    for (let n = 0, wx = this.wreckX, wy = this.wreckY; n < wx.length; n++) {
      const ex = x - wx[n], ey = y - wy[n];
      if (ex > 3 || ex < -3 || ey > 3 || ey < -3) continue;
      const edge = Math.max(Math.abs(ex), Math.abs(ey));
      if (edge === 0) return K.WRECK;
      if (edge === 1) return hash(x, y, seed + 32) < 0.55 ? K.SLATE : K.EMPTY;
      return K.EMPTY;
    }
    const find = r > 12 ? this.findAt(x, y) : -1;
    if (find >= 0) return find;
    const h = hash(x, y, seed + 9), g = (BIOMES[b] ?? BIOMES[0]).lay;
    if (g === null) {
      // Home ground: soft, with stones to go round, nuggets worth lassoing, and further out seams of slate.
      // (The last of these to hold is what the cell is, so they are asked last first, and the first that holds
      // settles it: an open cell asks about nothing else.)
      if (r > 60 && noise(x / 19, y / 19, seed + 18, 18) > 0.76) return K.EMPTY;      // great open caverns
      if (r > 22 && noise(x / 5, y / 5, seed + 13, 13) > 0.8) return K.EMPTY;
      if (r > 35 && Math.abs(noise(x / 9, y / 9, seed + 11, 11) - 0.5) < 0.022) return K.SLATE;
      if (r > 55 && h < 0.5 && noise(x / 3.5, y / 3.5, seed + 7, 7) > 0.78) return K.ORE_B;
      if (r > 4.5 && h < 0.6 && noise(x / 3, y / 3, seed + 6, 6) > 0.64) return K.ORE_A;
      if (r > 5 && noise(x / 4, y / 4, seed + 5, 5) > 0.7) return K.DENSE;
      return K.SOFT;
    }
    // Every other ground is laid the same way, by its row's own thresholds (`lay`), and in the same order: the
    // last of these to hold is what the cell is, as above. A second hazard has layers of its own (58, and 59 for
    // the hash), so it never lies where the first does, and gives way to it. What a row has besides (its extras,
    // `TELLS`) is asked where it belongs: bubbles with the caves, strata with the slate, grapes with the first
    // hazard, a river before the ore and lanes after it. And what goes with a hazard (`HAZARDS`): crystals on the
    // flanks of slate with the charged crystals, slag last of all, where plain rock is left.
    if (noise(x / 19, y / 19, seed + 18, 18) > g.cavern) return K.EMPTY;
    if (noise(x / 5, y / 5, seed + 13, 13) > g.cave) return K.EMPTY;
    if (g.bubbles < 1 && bubble(x, y, seed, g.bubbles)) return K.EMPTY;
    if (r > 600 && Math.abs(noise(x / 8, y / 8, seed + 12, 12) - 0.5) < 0.028) return K.VAULT;
    // (`flank`: the cell is not slate, and lies within RIB of a rib's edge or a bed's.)
    let flank = false;
    if (g.slate > 0) { const s = Math.abs(noise(x / 9, y / 9, seed + 11, 11) - 0.5); if (s < g.slate) return K.SLATE; flank = s < g.slate + RIB; }
    if (g.strata > 0) { const s = stratum(x, y, seed); if (s < g.strata) return K.SLATE; if (s < g.strata + RIB) flank = true; }
    if (g.haz === SCATTER) { const c = hash(x, y, seed + 10); if (c < g.hazT || (flank && c < g.ribs)) return K.HAZARD; }
    else if (g.haz === POCKETS && h > 0.45 && noise(x / 2.5, y / 2.5, seed + 8, 8) > g.hazT) return K.HAZARD;
    if (g.grapes < 1 && grape(x, y, seed, g.grapes)) return K.HAZARD;
    if (g.haz2 === SCATTER) { const c = hash(x, y, seed + 59); if (c < g.haz2T || (flank && c < g.ribs2)) return K.HAZARD2; }
    else if (g.haz2 === POCKETS && h > 0.45 && noise(x / 2.5, y / 2.5, seed + 58, 58) > g.haz2T) return K.HAZARD2;
    // A river runs through ore as through plain rock, or it would be no road; lanes lie only where plain rock would.
    if (g.rivers > 0 && river(x, y, seed, g.rivers)) return K.ICE;
    if (h < 0.5 && noise(x / 3.5, y / 3.5, seed + 7, 7) > g.oreB) return K.ORE_B;
    if (h < 0.62 && noise(x / 3, y / 3, seed + 6, 6) > g.oreA) return K.ORE_A;
    if (g.lanes > 0 && lane(x, y, seed, g.lanes)) return K.ICE;
    // Slag, only where plain rock would lie: a rind round each pocket of lava, where the lava's own layer is under
    // the pocket's threshold by less than `rind`, and half of the plain rock within the pocket.
    if (g.rind > 0) { const n = noise(x / 2.5, y / 2.5, seed + 8, 8); if (n > g.hazT - g.rind && (n <= g.hazT || hash(x, y, seed + 68) < 0.5)) return K.SLAG; }
    if (g.rind2 > 0) { const n = noise(x / 2.5, y / 2.5, seed + 58, 58); if (n > g.haz2T - g.rind2 && (n <= g.haz2T || hash(x, y, seed + 68) < 0.5)) return K.SLAG; }
    if (noise(x / 4, y / 4, seed + 5, 5) > g.dense) return K.DENSE;
    return K.SOFT;
  }
  // What the seed laid in a cell, in the ground the cell lies in: what it was before anything touched it.
  first(i) { return this.kindAt(i & (N - 1), i >>> 14, this.b(i)); }
  // The piece of world holding a cell, made now if nothing has looked there before.
  piece(id) {
    let p = this.chunks[id];
    if (p) return p;
    p = this.chunks[id] = { kind: new Uint8Array(CH * CH), biome: new Uint8Array(CH * CH), seen: new Uint8Array(CH * CH) };
    this.made++;
    const x0 = (id % CW) * CH, y0 = ((id / CW) | 0) * CH;
    for (let v = 0; v < CH; v++) for (let u = 0; u < CH; u++) {
      const b = this.biomeAt(x0 + u, y0 + v);
      p.biome[v * CH + u] = b; p.kind[v * CH + u] = this.kindAt(x0 + u, y0 + v, b);
    }
    return p;
  }
  k(i) { return this.piece(((i >>> 20) << 8) | ((i >>> 6) & 255)).kind[(((i >>> 14) & 63) << 6) | (i & 63)]; }
  b(i) { return this.piece(((i >>> 20) << 8) | ((i >>> 6) & 255)).biome[(((i >>> 14) & 63) << 6) | (i & 63)]; }
  s(i) { return this.piece(((i >>> 20) << 8) | ((i >>> 6) & 255)).seen[(((i >>> 14) & 63) << 6) | (i & 63)]; }
  // (What was known of a cell's sides goes when the cell changes: `dull`.)
  setK(i, v) { const id = ((i >>> 20) << 8) | ((i >>> 6) & 255), p = this.piece(id), at = (((i >>> 14) & 63) << 6) | (i & 63); p.kind[at] = v; if (p.dull) p.dull[at] = 0; this.touched.add(id); }
  setB(i, v) { const id = ((i >>> 20) << 8) | ((i >>> 6) & 255); this.piece(id).biome[(((i >>> 14) & 63) << 6) | (i & 63)] = v; this.touched.add(id); }
  // Show the ground within `radius` cells of a cell. Returns whether anything new was seen. A cell seen for the
  // first time that is worth calling out (a cache, a wreck, a relic, a keystone, a prism, a pocket's mineral, the
  // shell of a geode) goes on `spotted` as [what, cell, middle]: what it is ('cache', 'wreck', 'relic', 'key',
  // 'prism', 'mineral', 'geode'), the cell seen, and the middle cell of the thing (the cell itself, but for a
  // geode). Whoever calls things out takes them from the list; it never holds more than a few hundred.
  see(cx, cy, radius) {
    let fresh = false;
    for (let y = cy - radius; y <= cy + radius; y++) for (let x = cx - radius; x <= cx + radius; x++) {
      const id = ((y >> 6) << 8) | (x >> 6), p = this.piece(id), at = ((y & 63) << 6) | (x & 63);
      if (p.seen[at]) continue;
      p.seen[at] = 1; this.touched.add(id); fresh = true;
      const k = p.kind[at], P = (BIOMES[p.biome[at]] ?? BIOMES[0]).pocket;
      if (NOTABLE[k] !== undefined || (P !== null && k === (P.kind ?? K.MINERAL))) this.notice(x, y, k, P);
    }
    return fresh;
  }
  notice(x, y, k, P) {
    if (this.spotted.length >= 400) return;
    const i = y * N + x;
    if (P !== null && k === (P.kind ?? K.MINERAL)) { this.spotted.push(['mineral', i, i]); return; }
    if (k !== K.SLATE) { this.spotted.push([NOTABLE[k], i, i]); return; }
    // Slate is a geode's shell where its sector holds a geode and the cell lies within it.
    const [what, fx, fy, size] = this.findSpot(Math.floor((x - C) / FIND), Math.floor((y - C) / FIND)), dx = x - fx, dy = y - fy;
    if (what === 'geode' && dx * dx + dy * dy <= (size - 0.2) * (size - 0.2)) this.spotted.push(['geode', i, fy * N + fx]);
  }
  // What a cell is, without making its piece of the world: -1 where nothing has been seen yet.
  peek(x, y) { const p = this.chunks[((y >> 6) << 8) | (x >> 6)]; return p && p.seen[((y & 63) << 6) | (x & 63)] ? p.kind[((y & 63) << 6) | (x & 63)] : -1; }
  // What a cell is where the world has been made, -1 where it has not: asking never makes it.
  laid(i) { const p = this.chunks[((i >>> 20) << 8) | ((i >>> 6) & 255)]; return p ? p.kind[(((i >>> 14) & 63) << 6) | (i & 63)] : -1; }
  at(x, y) { return this.k(y * N + x); }
  solid(x, y) { return this.k(y * N + x) !== K.EMPTY; }
  lavaAt(i) { return this.lava.get(i) ?? 0; }
  // The row of the ground a cell lies in, and what hazard the cell is ('lava', 'spore', 'spark') or null.
  row(i) { return BIOMES[this.b(i)] ?? BIOMES[0]; }
  hazAt(i) { const k = this.k(i); return k === K.HAZARD || k === K.HAZARD2 ? hazOf(k, this.row(i)) : null; }

  // An outline is walked a side at a time, the ground always on the same hand. A side is a cell of ground and which
  // of its sides faces open ground (0 east, 1 south, 2 west, 3 north), held as one number: the cell's, times four,
  // plus the side. This is the side after `at`. Ground counts as joined along sides only, never across a corner.
  // `gone` is a set of cells to take as open.
  along(at, gone = null) {
    const c = at >> 2, f = at & 3, r = (f + 1) & 3, a = c + STEP[r], b = a + STEP[f];
    if ((gone !== null && gone.has(a)) || this.k(a) === K.EMPTY) return c * 4 + r;                    // round this cell's own corner
    if ((gone !== null && gone.has(b)) || this.k(b) === K.EMPTY) return a * 4 + f;                    // straight on, along the next cell
    return b * 4 + ((f + 3) & 3);                                                                     // into an inside corner
  }
  // Whether the ground a cell belongs to is an island: ground that hangs on nothing. `s` is a cell of ground and
  // `d` the side of it that faces open ground. Its outline is walked from there (`along`). An outline that comes
  // back to where it began having turned outward four times more than inward is the outside of a piece, so the
  // piece is an island, whatever its area: the work is in proportion to the outline, not to the ground inside it.
  // One that runs to `most` sides without closing, touches the world's bedrock, or closes the other way round (the
  // wall of a hollow, with the ground on its outside) is not known to be one.
  // `walked`, kept between calls, holds the sides of outlines that were not an island's, so none is walked twice.
  island(s, d, most, gone = null, walked = null) {
    if ((gone !== null && gone.has(s)) || this.k(s) === K.EMPTY) return false;
    if (!(gone !== null && gone.has(s + STEP[d])) && this.k(s + STEP[d]) !== K.EMPTY) return false;
    const first = s * 4 + d;
    for (let n = 0, at = first, turns = 0; n < most; n++) {
      if (walked !== null) { if (walked.has(at)) return false; walked.add(at); }
      const next = this.along(at, gone);
      // The side turns outward (+1), goes straight on (0) or turns inward (-1).
      turns += (((next & 3) - (at & 3) + 1) & 3) - 1;
      at = next;
      if (this.k(at >> 2) === K.BEDROCK) return false;
      if (at === first) return turns === 4;
    }
    return false;
  }
  // Is the ground a cell belongs to an island, asked for ground that nobody has cut: a rock standing free in a
  // cavern, a wreck in its hollow. As `island`, from side `d` of cell `s`, but what it learns is kept with the
  // world: every side of an outline that proved not to be an island's (or too long to tell) is marked dull, in
  // each piece of the world, and a walk that comes to a dull side stops there. So no wall is walked twice, however
  // often it is asked about, until a cell of it changes (`setK`).
  isle(s, d, most) {
    if (this.k(s) === K.EMPTY || this.k(s + STEP[d]) !== K.EMPTY) return false;
    const first = s * 4 + d, path = [];
    let found = false;
    for (let n = 0, at = first, turns = 0; n < most; n++) {
      const p = this.chunks[((at >>> 22) << 8) | ((at >>> 8) & 255)];
      if (p.dull && p.dull[(((at >>> 16) & 63) << 6) | ((at >>> 2) & 63)] & (1 << (at & 3))) break;
      path.push(at);
      const next = this.along(at);
      turns += (((next & 3) - (at & 3) + 1) & 3) - 1;
      at = next;
      if (this.k(at >> 2) === K.BEDROCK) break;
      if (at === first) { found = turns === 4; break; }
    }
    this.sides += path.length;
    if (!found) for (const at of path) {
      const p = this.chunks[((at >>> 22) << 8) | ((at >>> 8) & 255)];
      (p.dull ??= new Uint8Array(CH * CH))[(((at >>> 16) & 63) << 6) | ((at >>> 2) & 63)] |= 1 << (at & 3);
    }
    return found;
  }
  // Are these sides of ground all on one outline? Each is walked, a side in turn, until it comes to another's
  // start: `most` sides each at the most. Ground along one outline is one piece of ground, so cells whose sides
  // are on one outline are joined; if they are not found to be, nothing is known.
  oneOutline(sides, most) {
    const n = sides.length, starts = new Map(sides.map((side, q) => [side, q])), at = sides.slice(), parent = sides.map((side, q) => q);
    const find = q => { while (parent[q] !== q) q = parent[q] = parent[parent[q]]; return q; };
    let apart = n;
    for (let round = 0; round < most && apart > 1; round++) for (let q = 0; q < n && apart > 1; q++) {
      if (at[q] < 0) continue;
      at[q] = this.along(at[q]);
      this.sides++;
      const o = starts.get(at[q]);
      if (o === undefined) continue;
      if (o === q) return false;                       // all the way round and none of the others on it
      at[q] = -1;
      if (find(o) !== find(q)) { parent[find(o)] = find(q); apart--; }
    }
    return apart === 1;
  }
  // The ground that hangs on nothing once `cells` are open (or would, were they cut): one cell or a list of cells
  // opened together, which need not be open in the world yet. `open` is a set of further cells to take as open
  // with them (what a cut would open besides itself: a pane, a crack, a punch), for the glow to ask what a cut
  // would free before it is made: ground that hung only on one of those is found as ground beside the cut is.
  // A list of pieces, each a list of cells.
  //
  // Ground that a cut has freed lies beside an opened cell, and it is an island: its outline, walked from the side
  // that faces the opened cell, comes back to where it began having turned outward four times more than inward
  // (`island`). So the outlines are walked, a side each in turn, from every side of ground that faces an opened
  // cell, and nothing is flooded to find out what is loose: the work is in proportion to the outlines, whatever
  // lies behind them, and the held ground beside a cut is never followed into the world. A walk that comes to the
  // side another began from is on the same outline and stops there; an outline is closed when every walk on it has
  // come to the next one's start. One that closes turned outward is an island, and only then is its ground
  // followed, to list its cells: no more than `limit` of them, or it is held. One that closes turned inward is the
  // wall of the open ground the cut was made from, one that touches bedrock is the world's own: both are held.
  //
  // Walks go on while there is more than one to settle, JOIN sides each and WALK in all. The last one left, with
  // nothing yet known to be held, is most likely the rest of the world (every cut at the end of a tunnel leaves one
  // such) and is given up after OUTLINE sides.
  //
  // One case the outline cannot settle: a cut that opens only on to a closed hollow inside a piece, with no way to
  // the core (not one the drill can make: its tether is always a way out). The hollow's wall says nothing of what
  // surrounds it, so that ground is followed a little way, HOLLOW cells, and is an island if it runs out.
  freed(cells, limit = 700, open = null) {
    const opened = typeof cells === 'number' ? [cells] : cells, gone = new Set(opened);
    if (open) for (const j of open) gone.add(j);
    // Where each walk began (a side: its cell times four plus which side), and where it is now.
    const starts = new Map(), from = [];
    for (const i of gone) for (let s = 0; s < 4; s++) {
      const c = i + STEP[s];
      if (gone.has(c) || this.k(c) === K.EMPTY) continue;
      const side = c * 4 + ((s + 2) & 3);
      if (!starts.has(side)) { starts.set(side, from.length); from.push(side); }
    }
    const n = from.length;
    if (!n) return [];
    // Of each walk: how it has turned, whether it has crossed the line east from the core's middle an odd number
    // of times (an outline that has is round the core), the walk whose start it came to, and whether it is over
    // (1: came to a start, 2: touched bedrock).
    const at = from.slice(), turns = new Int32Array(n), odd = new Uint8Array(n), next = new Int32Array(n).fill(-1), over = new Uint8Array(n);
    const isles = [], hollows = [];
    let going = n, held = false, walked = 0;
    for (let q = 0; q < n; q++) if (this.k(from[q] >> 2) === K.BEDROCK) { over[q] = 2; going--; held = true; }
    for (let round = 1; going > 0 && walked < WALK && round <= (going > 1 || held ? JOIN : OUTLINE); round++) for (let q = 0; q < n; q++) {
      if (over[q]) continue;
      const a = at[q], b = this.along(a, gone), c = b >> 2, f = b & 3;
      // The side turns outward (+1), goes straight on (0) or turns inward (-1).
      turns[q] += ((f - (a & 3) + 1) & 3) - 1;
      at[q] = b; walked++;
      if (this.k(c) === K.BEDROCK) { over[q] = 2; going--; held = true; continue; }
      if (!(f & 1) && (c >>> 14) === C && (c & (N - 1)) + (f ? 0 : 1) > C) odd[q] ^= 1;
      const o = starts.get(b);
      if (o === undefined) continue;
      over[q] = 1; next[q] = o; going--;
      // Is the outline closed: has every walk on it come to the next one's start?
      let sum = 0, core = 0, x = q;
      do { sum += turns[x]; core ^= odd[x]; x = next[x]; } while (x !== q && over[x] === 1);
      if (x !== q) continue;
      if (sum === 4) isles.push(q);
      else { held = true; if (!core) hollows.push(q); }
    }
    this.sides += walked;
    // The ground of each island is followed, once: cells already followed are known by `seen`.
    const seen = new Map(), pieces = [];
    for (const q of isles) { const piece = this.follow(from[q] >> 2, limit, gone, seen); if (piece) pieces.push(piece); }
    for (const q of hollows) { const piece = this.follow(from[q] >> 2, Math.min(limit, HOLLOW), gone, seen); if (piece) pieces.push(piece); }
    return pieces;
  }
  // The whole piece of ground a cell belongs to, as a list of cells: null if it is more than `limit` cells, touches
  // bedrock, or is ground that was followed before (`seen`, shared between calls, holds a mark for every cell
  // followed: a map from each piece of the world to its marks, 1 for a cell taken as open, else which call
  // followed it). `gone` is cells to take as open; `only`, if given, says which cells the piece may hold, and it is
  // null if it comes to any other.
  follow(start, limit, gone = null, seen = new Map(), only = null) {
    const chunks = this.chunks, run = seen.run = (seen.run ?? 1) + 1;
    if (run > 255) return this.follow(start, limit, gone, new Map(), only);
    let id = -1, kind = null, marks = null;
    // Turn to the piece of the world holding cell j; returns its place there.
    const turn = j => {
      const now = ((j >>> 20) << 8) | ((j >>> 6) & 255);
      if (now !== id) {
        id = now; kind = (chunks[id] ?? this.piece(id)).kind; marks = seen.get(id);
        if (!marks) seen.set(id, marks = new Uint8Array(CH * CH));
      }
      return (((j >>> 14) & 63) << 6) | (j & 63);
    };
    if (gone && run === 2) for (const j of gone) { const p = turn(j); marks[p] = 1; }
    const p0 = turn(start);
    if (marks[p0] || kind[p0] === K.EMPTY) return null;
    if (kind[p0] === K.BEDROCK || (only !== null && !only(start))) return null;
    marks[p0] = run;
    const cells = [start];
    let whole = true;
    for (let head = 0; head < cells.length && whole; head++) {
      const c = cells[head];
      for (let s = 0; s < 4; s++) {
        const j = c + STEP[s], p = turn(j), mark = marks[p];
        if (mark === run || mark === 1) continue;
        const k = kind[p];
        if (k === K.EMPTY) continue;
        // Ground another call followed and gave up on, bedrock, too much, or not allowed: this is not a piece.
        if (mark || k === K.BEDROCK || cells.length >= limit || (only !== null && !only(j))) { whole = false; break; }
        marks[p] = run; cells.push(j);
      }
    }
    this.followed += cells.length;
    return whole ? cells : null;
  }
  // The whole piece of ground a cell belongs to, if it lies inside the box and is no more than `limit` cells; null if
  // it runs out of the box, touches bedrock or is larger. `only`, if given, says which cells it may hold.
  pieceIn(i, x0, y0, x1, y1, limit, only = null) {
    const boxed = x0 > -Infinity || y0 > -Infinity || x1 < Infinity || y1 < Infinity;
    const inside = boxed ? j => { const x = j % N, y = Math.floor(j / N); return x >= x0 && x <= x1 && y >= y0 && y <= y1 && (only === null || only(j)); } : only;
    return this.follow(i, limit, null, new Map(), inside);
  }

  // The blob mask of a cell among its solid neighbours (N=1, NE=2, E=4, SE=8, S=16, SW=32, W=64, NW=128), a corner
  // counting only between two solid sides, as Pixelbolt's blob tiles are named.
  mask(x, y) {
    const n = this.solid(x, y - 1), e = this.solid(x + 1, y), s = this.solid(x, y + 1), w = this.solid(x - 1, y);
    return (n ? 1 : 0) | (n && e && this.solid(x + 1, y - 1) ? 2 : 0) | (e ? 4 : 0) | (e && s && this.solid(x + 1, y + 1) ? 8 : 0)
      | (s ? 16 : 0) | (s && w && this.solid(x - 1, y + 1) ? 32 : 0) | (w ? 64 : 0) | (w && n && this.solid(x - 1, y - 1) ? 128 : 0);
  }
  lavaMask(x, y) {
    const L = (u, v) => this.lava.has(v * N + u) || this.k(v * N + u) !== K.EMPTY;
    const n = L(x, y - 1), e = L(x + 1, y), s = L(x, y + 1), w = L(x - 1, y);
    return (n ? 1 : 0) | (n && e && L(x + 1, y - 1) ? 2 : 0) | (e ? 4 : 0) | (e && s && L(x + 1, y + 1) ? 8 : 0)
      | (s ? 16 : 0) | (s && w && L(x - 1, y + 1) ? 32 : 0) | (w ? 64 : 0) | (w && n && L(x - 1, y - 1) ? 128 : 0);
  }
}

// Every cell a straight line passes through, in order, each sharing a side with the one before. Points are in
// cells, a cell's middle at +0.5.
export function cellsAlong(x0, y0, x1, y1, max = 6000) {
  let cx = Math.floor(x0), cy = Math.floor(y0);
  const ex = Math.floor(x1), ey = Math.floor(y1), dx = x1 - x0, dy = y1 - y0, sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const tdx = dx ? Math.abs(1 / dx) : Infinity, tdy = dy ? Math.abs(1 / dy) : Infinity, cells = [cy * N + cx];
  let tx = dx ? (dx > 0 ? cx + 1 - x0 : x0 - cx) * tdx : Infinity, ty = dy ? (dy > 0 ? cy + 1 - y0 : y0 - cy) * tdy : Infinity;
  for (let guard = 0; guard < max && (cx !== ex || cy !== ey); guard++) {
    if (tx < ty) { tx += tdx; cx += sx; } else { ty += tdy; cy += sy; }
    cells.push(cy * N + cx);
  }
  return cells;
}
// Is the straight line between two points clear of ground?
export function sight(world, x0, y0, x1, y1) {
  let cx = Math.floor(x0), cy = Math.floor(y0);
  const ex = Math.floor(x1), ey = Math.floor(y1), dx = x1 - x0, dy = y1 - y0, sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const tdx = dx ? Math.abs(1 / dx) : Infinity, tdy = dy ? Math.abs(1 / dy) : Infinity;
  let tx = dx ? (dx > 0 ? cx + 1 - x0 : x0 - cx) * tdx : Infinity, ty = dy ? (dy > 0 ? cy + 1 - y0 : y0 - cy) * tdy : Infinity;
  for (let guard = 0; guard < 12000; guard++) {
    if (world.k(cy * N + cx) !== K.EMPTY) return false;
    if (cx === ex && cy === ey) return true;
    if (tx < ty) { tx += tdx; cx += sx; } else { ty += tdy; cy += sy; }
  }
  return false;
}
