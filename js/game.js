// Tetherbore: the game. A drill flies free on a tether from a fixed core, cuts whatever ground it is pushed into,
// and reels in any piece of ground it has drawn the tether round.
import { World, CellBook, N, C, K, B, HARD, GRIT, GEMS, DX, DY, HAZARDS, RARE, CRUSH, ZONE, FIND, rowOf, hazOf, gemKin, digTime, cellHash, sight, cellsAlong, GEN, SEAMS, SHRINE_R, FOSSILS, fossilKin, GEM_N, GEM_PAST, noGems } from './world.js';
import { sheets, frameAt, duration } from './atlas.js';
import { sfx, unlock, setAmbience } from './audio.js';
import { richness, haulBonus, overload, income, round2, NEEDS, UPGRADES, LAB, LAB_OF, labLevel, labNext, CORE, ROWS, REACH, CUT, TABS } from './shop.js';
import { Drawing, T, DIR_BIOME, GEM_ICON, GEM_COLOR, GEM_WHERE, SPOT, bright, compact, DEBRIS, LAB_LIST, LAB_RH, LAB_SEC } from './drawing.js';
import { Feel } from './feel.js';
import { Fitter } from './fit.js';
import { Fauna } from './fauna.js';
import { pickGoal, goalHome } from './goal.js';
export { richness, haulBonus, overload, income, UPGRADES, LAB, labLevel, labNext, WORKS, MAPS, CORE } from './shop.js';

export { T };
export const HX = C + 0.5, HY = C + 0.5;        // the middle of the core, in cells
const SAVE_KEY = 'tetherbore-save-v3';

// What everything costs, the rows of the shop that are bought with it and what the lab can know are in js/shop.js;
// the game imports them, and passes on the names that the tests and tools have always taken from here.

// A haul of fewer cells than LIGHT, with nothing in it to make a show of, is a light one: it stops nothing and
// says what it paid where it lay. A haul made within CHAIN seconds of the one before is a link in a chain.
const LIGHT = 12, CHAIN = 6;
// How much more the flywheel pays a haul's cells for each haul of its run before it, by the flywheel's level, up to
// the row's value. (The second level once only raised the most, from four tenths to six, which a run reaches only at
// its seventh haul: it paid two in ten thousand of what was earned while it was owned. A run pays its most at the
// sixth haul at both levels now.)
const SPIN_STEP = [0, 0.08, 0.12];
// How many bits of rubble may be on their way home at once, over every haul there is.
export const RUBBLE = 400;
// What a haul is called (`haulTitle`). Up to a COLOSSAL one, by its size; a haul of BIG or more that lies mostly in
// a place of its own (a pocket, a deep ground, a strain or a cross: `placeHaul`) by that place, in its colour; and a
// giant, from a thousand cells, by GIANTS, louder and brighter at each step. The last word is kept for a haul of half
// of all the ground the longest tether reaches round (HALF: the disc of the last reach, halved, eight million cells
// and more): the loop is round nine tenths of HALF at the least, and at least two fifths of HALF is ground (`isHalf`).
// It is asked of the loop's area and not of the cells hauled, as caves, tunnels and ground hauled before take a fifth
// of any reach or more: a loop round exactly half the longest reach hauls six and a half million cells.
// Each size has three words, said by turns (`pick`: the game's count of hauls), the first its own; the ladder climbs
// slowly at first, so COLOSSAL is a haul of note and not every slab.
export const SIZES = [
  [550, ['COLOSSAL!', 'GEOLOGY HAPPENED!', 'IS THAT LEGAL?!']],
  [300, ['MASSIVE!', 'ABSOLUTE UNIT!', 'BIG ROCK ENERGY!']],
  [150, ['HUGE HAUL!', 'WHOPPER!', "THAT'S A LOT OF ROCK"]],
  [80, ['HEFTY HAUL!', 'BEEFY!', 'OOF. HEAVY.']],
  [30, ['BIG HAUL!', 'CHUNKY!', "NOW WE'RE TALKING!"]],
  [10, ['NICE CUT!', 'TIDY!', 'NEAT LITTLE ONE!']],
];
// What a haul is called for what is in it or how it was made, with a line under it, the first that holds of: a
// creature caught in the loop that took it (`caught`), a hull down to its last half heart (`low`), and below MASSIVE
// a haul that is half ore and more (`ores`), one of nothing that pays but its grit (`dull`) and one with three
// hazards asleep in it or more (`hazards`). Each has words by turns, as the sizes do.
export const QUIPS = {
  caught: [['ECO-VANDAL!', 'YOU MONSTER'], ['EVICTED!', 'THEY PAID RENT'], ['HABITAT: GONE', 'NATURE WILL REMEMBER THIS']],
  low: [['CLUTCH!', 'ON HALF A HEART'], ['NERVES OF STEEL!', 'ON HALF A HEART'], ['BRAVE. OR SILLY.', 'ON HALF A HEART']],
  ores: [['MOTHER LODE!', 'GREED IS GOOD'], ['JACKPOT!', 'SHINY SHINY SHINY'], ['ORE-SOME!', 'SORRY']],
  dull: [['PURE GRAVEL!', 'A FINE VINTAGE'], ['ROCKS!', 'YOU GOT ROCKS'], ['ARTISANAL DIRT!', 'HAND-PICKED']],
  hazards: [['HOT POTATO!', 'HANDLE WITH CARE'], ['SPICY!', 'DO NOT LICK'], ['RISKY BUSINESS!', 'IT WAS ASLEEP. MOSTLY.']],
};
// And a line under each giant, and under a haul over the winch's load where nothing else is said.
export const GIANT_SAYS = ['THE MOUNTAIN NEEDED THAT', 'MIND THE ICEBERGS', 'TAKE COVER', 'GEOLOGISTS ARE SCREAMING', 'NEW MAPS REQUIRED', 'BURP.'];
export const OVER_SAYS = 'THE WINCH IS CRYING';
// The keys that open a tab of the panel the bar opens, each shutting it again (`key`).
export const PANEL_KEYS = { KeyI: 'stats', KeyL: 'lab', KeyM: 'chart', Escape: 'menu' };
export const GIANTS = [[1000, 'MOUNTAINOUS!'], [4000, 'TITANIC!'], [15000, 'AVALANCHE!'], [50000, 'CATACLYSM!'], [150000, 'CONTINENTAL!'], [400000, 'WORLD EATER!']];
export const HALF = Math.round(Math.PI * REACH[REACH.length - 1] ** 2 / 2);
export const isHalf = (n, area) => area >= HALF * 0.9 && n >= HALF * 0.4;
// The places with words of their own, by the name of their ground; a cross is its noun's haul, and any other place
// of its own its title's.
const PLACE_HAULS = {
  hive: 'HONEYCOMB!', drift: 'SKYFALL!', ash: 'ASHFALL!', grotto: 'LANTERN HAUL!', tinder: 'KINDLED!', glaze: 'SHATTERED!', shale: 'STACKED!',
  rime: 'DEEP FREEZE!', magma: 'MOLTEN HAUL!', bloom: 'FULL BLOOM!', gilt: 'GILDED!',
  hoarstone: 'HOARFROST!', skarn: 'SKARN!', glassdune: 'SANDBLASTED!', obsidian: 'GLASS HEART!', cinderfen: 'SMOKED OUT!', tarpit: 'TARPIT!', frostfen: 'FROZEN FEN!', muskeg: 'MUSKEG!',
  glacier: 'GLACIAL!', caldera: 'CALDERA!', mycelium: 'UNDERGROWTH!', druse: 'DRUSE!',
  firn: 'FROZEN RIVER!', serac: 'ICEFALL!', scoria: 'FROTHING!', forge: 'FORGED!', tangle: 'TANGLED UP!', sporefall: 'SPORE STORM!', redrock: 'RED LETTER!', loess: 'SILTSLIDE!',
};
// (Rows 5 to 31 are the flanks, the seams and the strains, and 64 to 127 the deep strains and what comes after.)
export const placeHaul = row => !row || !(row.pocket || row.cross || (row.id >= 5 && row.id <= 31) || (row.id >= 64 && row.id <= 127)) ? null
  : PLACE_HAULS[row.name] ?? `${row.cross ? row.title.split(' ').pop() : row.title} HAUL!`;
// Which giant a haul of `n` cells is, made by a loop round `area` cells: 0 none, 1 to GIANTS.length, and one more
// for HALF.
export const giantOf = (n, area = 0) => isHalf(n, area) ? GIANTS.length + 1 : GIANTS.findLastIndex(([at]) => n >= at) + 1;
// The title of a haul of `n` cells with what was found in it, lying mostly in ground `row` (null: no one ground),
// made by a loop round `area` cells (0: not known, as when a haul is staged by hand):
// [title, giant, whether the place named it, the line under it or null]. Half of everything outshouts anything; a
// relic and a wreck's part are told before any size, as they are rarer than any; a cache and a rare hazard are told
// before any but a giant's, a rare hazard caught awake with the live catch bought as caught live (`live`); a haul
// that is a link in the flywheel's run of two or more before it (`spin`, how many) by that; then a creature caught
// and the last half heart (`QUIPS`), the place it lies in, what it held (below MASSIVE), and its size. `pick` says
// which of a size's or a quip's words: the same haul is always called the same.
// A shrine is told as a relic is, and a fossil whole (`fossil`: the direction whose species it is) and twin stones
// both in one haul (`twins`) as a rare hazard is.
export function haulTitle(n, { relic = -1, parts = 0, caches = 0, rare = null, live = false, spin = 0, caught = 0, low = false, ores = 0, dull = false, hazards = 0, over = 1, pick = 0, shrine = -1, fossil = 0, twins = 0 } = {}, row = null, area = 0) {
  const giant = giantOf(n, area), place = n >= 30 ? placeHaul(row) : null, one = list => list[pick % list.length];
  const quip = key => { const [title, says] = one(QUIPS[key]); return [title, 0, false, says]; };
  if (giant > GIANTS.length) return ['HALF THE WORLD!', giant, false, 'HALF THE REACH IN ONE HAUL'];
  if (relic >= 0) return ['RELIC!', giant, false, null];
  if (shrine >= 0) return ['SHRINE!', giant, false, null];
  if (parts) return ['WRECK PART! PAY +10%', giant, false, null];
  if (giant) return [GIANTS[giant - 1][1], giant, false, GIANT_SAYS[giant - 1]];
  if (caches) return ['CACHE!', 0, false, null];
  if (rare) return [live ? 'CAUGHT LIVE!' : `${SPOT[rare][0]}!`, 0, false, null];
  if (fossil) return [`${FOSSILS[fossil]}!`, 0, false, null];
  if (twins) return ['TWIN STONES!', 0, false, null];
  if (spin >= 2) return [`SPIN x${spin}`, 0, false, null];
  if (caught) return quip('caught');
  if (low && n >= 10) return quip('low');
  if (place) return [place, 0, true, over < 1 ? OVER_SAYS : null];
  if (n >= 30 && n < 300) {
    if (ores * 2 >= n) return quip('ores');
    if (dull) return quip('dull');
    if (hazards >= 3) return quip('hazards');
  }
  const size = SIZES.find(([at]) => n >= at);
  return [size ? one(size[1]) : 'HAUL', 0, false, over < 1 ? OVER_SAYS : null];
}
// Which bits of rubble are in which cell, to find the bits near each (`jostle`): a table of chains, each cell hashed
// to one chain, which holds the bits by their place in the list being jostled, in that order. The rubble is sorted
// into cells up to eight times a frame, so the arrays are kept and grown, not made anew. (It was a Map of arrays made
// anew each time, keyed by numbers too big to be small integers: rubble took half as long again.)
const crowd = { head: new Int32Array(64), next: new Int32Array(32), cellX: new Int32Array(32), cellY: new Int32Array(32) };
const chainOf = (x, y) => Math.imul(x, 73856093) ^ Math.imul(y, 19349663);
// How long a spore pod's burst drives a drill fitted with the spore drive, and how much faster.
export const BOOST = { time: 3, by: 1.5 };
// After a knock nothing takes another pip, or stuns again, for SHIELD seconds: time to get clear. (It was a second
// and a half. What knocks comes in runs, pods bursting one after another, arcs leaping from crystal to crystal:
// a drill flown at random was lost a dozen seconds after its first knock, all three pips to one mistake.)
// A drill whose
// last pip is gone lies dead for DEATH seconds, the screen going dark, and then the game is back at the last
// docking (`revert`).
// The mender (js/shop.js: WORKS) must always take longer than this to give a pip back: the mend is counted from the
// knock, so a mender inside the shield would give back each pip before the next blow could land, and no steady
// fire would ever wear the hull past one dent.
export const SHIELD = 3;
// Metal is hard: steel and the iron of keystones take METAL times as long to cut as their kind says, until the
// drill is fitted with the diamond tip (js/shop.js: WORKS).
export const METAL = 3, METALS = [K.STEEL, K.KEY];
// How far from a crystal its arc knocks the drill, in cells either way (it was 3.5: most of the screen's width).
const ARC = 2.5;
export const DEATH = 1.2;
// The black box's level from which it keeps what a lost trip learnt (`keepLore`): its third, 75%.
const LORE = 3;
// How long each blow that knocks the hull stuns, in seconds: lava cut into, lava touched, an arc, a spore burst.
// (Before there was a hull an arc stunned for 0.7 s and lava for 0.5: with a pip gone as well, and SHIELD running
// from the blow, that left under a second to get clear.)
// And the rare hazards': a bell's toll, a fumarole's jet, a glowworm's bite, ore a lodestone pulls.
const JOLT = { lava: 0.4, burn: 0.3, arc: 0.5, spore: 0.4, toll: 0.5, jet: 0.5, bite: 0.3, ore: 0.4, bat: 0.3 };
// What flies off a hull that breaks, and the smoke of one in trouble.
const WRECKAGE = ['#ffd83a', '#e08a1c', '#8a94a8', '#3a3440'];
const SMOKE = ['#4a4654', '#6a6474', '#2e2a36'];
// How long a place's name stays up: on its plate, and across the screen the first time the place is met. How
// many dots of things seen the map keeps, and how near an unclaimed wreck is heard.
const PLATE = 2.4, CARD = 1.6, MARKS = 24, HEAR = 30;
// How long the count of specimens stays up after a haul adds to it.
const SPEC_LINE = 3;
// How long after a spore pod bursts the pods round it burst, in seconds, and how many pods the glow follows a bunch
// through.
const POD_CHAIN = 0.15, BUNCH = 64;
// How long slag shows white as lava quenches it to steel, in seconds.
const QUENCH = 0.12;
// How long a charged crystal's fuse burns when it is woken by a cut beside it, in seconds: at the slowest the drill
// flies (9 cells a second) that is seven cells, twice the reach of the arc.
const FUSE = 0.8;
// The four rare hazards (js/world.js: `RARE`, `World.siteOf`), what each does woken and how long it takes, in
// seconds and cells. Everything any of them does is one of three things: it opens solid ground, of the kinds in
// CRUSH only, within the tether's reach and never in a pocket (`breach`); it swaps the kinds of two cells that are
// both solid (`swap`), which the books of loose ground need not hear of; or it leaves a cut to the frost, which
// closes it as it closes any. Nothing grows, nothing pushes the drill, nothing stands in its way.
//   BELL   a rime bell cut beside: a fuse, then the toll opens every cell of the ring of ice round it (12 to 20
//          cells squared from its heart) at once, and knocks a drill within `knock` of it. Where the ground
//          freezes, the ring closes again `freeze` seconds on (and up to a second more). It can ring again `cool`
//          seconds after.
//   VENT   a fumarole cut beside: it rumbles, then fires a jet out of the side that was cut at each of `pulses`,
//          running `run` cells out at the most through open ground and boring the first `bore` cells of rock it
//          meets; a drill within `knock` of the jet is knocked. The flames show for `show` seconds. Asleep again,
//          it can be woken `cool` seconds after the last.
//   WORM   a glowworm cut beside: it uncoils, then swims through the rock (a step takes `soft` seconds through
//          soft rock, ore and ice, `hard` through dense rock, basalt and slate, and `wander` a step while the drill
//          is more than `flee` cells off), never more than `leash` from where it woke; it bites a drill whose
//          middle comes within `bite` of its own, and darts. It coils up again after `awake` seconds, or with the
//          drill more than `lose` cells off. It is drawn swimming from cell to cell over `tween` seconds, with a
//          trail on the cell it left for `trail`.
//   STONE  a lodestone cut beside: it hums, then pulls the ore within `reach` of it home, one cell every `every`
//          seconds (each chosen a pull ahead, and shown for that long), into the rock beside the clump it gathers
//          within `clump` cells squared of it, `most` pulls or `for` seconds at the most. Ore pulled across a
//          drill within `knock` of its way knocks it; a pull flies for `fly` seconds. Then it settles, and can be
//          woken again `cool` seconds on.
export const BELL = { fuse: 1.2, knock: 2.5, freeze: 7, cool: 4 };
export const VENT = { pulses: [1.2, 2.0, 2.8], run: 14, bore: 4, knock: 0.6, show: 0.35, cool: 10 };
export const WORM = { uncoil: 0.4, soft: 0.5, hard: 0.8, wander: 1, flee: 8, leash: 10, bite: 1.4, awake: 30, lose: 32, tween: 0.35, trail: 0.4 };
export const STONE = { hum: 0.6, every: 0.3, reach: 6.5, clump: 9, most: 24, for: 10, knock: 0.8, fly: 0.2, cool: 4 };
// What the seams do (js/world.js: a row's `react`), each in the ground of a seam whose row says so and in no other,
// so the crosses, whose rows say nothing, play as they always have. Everything a reaction opens it opens as an arc
// does (`openShattered`), within the tether's reach and in no pocket, and everything it closes closes as moss does:
// never in the drill's cell or the eight round it, never where the tether lies.
//   THAW   an arc in hoarstone or skarn opens the ice within REACT cells of the crystal (a frozen cut thaws)
//   GLASS  an arc in glassdune or obsidian wakes the lava within REACT of the crystal, and lava there that comes to
//          rest sets as glass, not basalt: a road that cuts in a blink
//   BURN   lava pouring in cinderfen or tarpit sets off the pods beside it: they burn off, a cloud that neither knocks
//          nor grows moss
//   RIME   a pod going off in frostfen or muskeg rimes: no cloud, and RIME_SET seconds on, the open ground two
//          round it closes with ice
// How long each says so, at the least, between two of one.
export const REACT = 3, RIME_SET = 0.3, REACT_SAY = 1.5;
const REACT_SAYS = { thaw: ['THAWED', '#bff4ff'], glass: ['GLASS ROAD', '#c8b8e8'], burn: ['BURNT OFF', '#ff9a3a'], rime: ['ICE RING', '#e0fff4'] };
// The air of a deep strain whose row has a `current` (js/world.js: `flowAt`): while the thumb is down and the drill
// flies free in open ground, the flow there leans on where it is steered, by so much of the drill's speed at its
// momentum, wind and heat. Never on the tether, on hauls or on what is loose, and never while it cuts or with the
// thumb lifted: the drill does not drift.
export const CURRENT = { wind: 0.3, heat: 0.25 };
// A fault cut in ground laced with them (the mycelium's threads: a row whose `lay.threads` is set) runs on along
// the faults joined to it, ZIP.rate cells a second and ZIP.most at the most from one cut, each opened as an arc's
// slate is and paying nothing; the cells waiting are kept in a ring of ZIP.ring, made once.
export const ZIP = { rate: 25, most: 60, ring: 128 };
// What the deep finds pay (`payOf`), in seconds of what cutting out there would earn: twin stones both in one haul,
// a fossil whole (for each bone), a shrine; and the specimens of each, its direction's (a shrine's, each of its two
// parents'). A shrine held makes every gem paid to each of its parents' directions SHRINE_PERK times as many, for
// good: a direction with both its corners' shrines pays 1.21 times.
export const TWIN_LUMP = 16, BONE_LUMP = 4, SHRINE_LUMP = 30, TWIN_SPEC = 1, BONE_SPEC = 2, SHRINE_SPEC = 5, SHRINE_PERK = 1.1;
// The two directions whose ground each corner's seam is made of (its gems' and its rich ore's), north-east,
// south-east, south-west, north-west.
export const CORNER_KINS = SEAMS.map(([id]) => [rowOf(id).gemA, rowOf(id).gemB]);
// What a glowworm swims through, and how long a step into each takes (WORM): nothing else, and no open ground.
const SWIMS = [];
for (const k of [K.SOFT, K.ORE_A, K.ORE_B, K.ICE]) SWIMS[k] = WORM.soft;
for (const k of [K.DENSE, K.BASALT, K.SLATE]) SWIMS[k] = WORM.hard;
// How far a point lies from the segment between two others.
const gap = (px, py, ax, ay, bx, by) => {
  const ex = bx - ax, ey = by - ay, len = ex * ex + ey * ey, u = len ? Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / len)) : 0;
  return Math.hypot(px - ax - ex * u, py - ay - ey * u);
};
// Ground that cuts this quick (its row's `dig` under PLOUGH: ash) is ploughed, not cut a block at a time: a cell
// of it is gone in a twentieth of a second, so pushing into it neither breaks the drill's run nor draws the drill
// square on to each block, and the loop a thumb draws is the loop that is cut. Ore cut into there says CRUSHED no
// more often than every CRUSH_EVERY seconds: a plough goes through a mineral a second.
const PLOUGH = 0.3, CRUSH_EVERY = 1;
// From its sixth level (MK6) the bit ploughs as ash is ploughed whatever it cuts in no more than so many seconds,
// by its level (`ploughs`): soft rock, ice and the plainer ore at MK6; dense rock, basalt, slag and the richer ore at
// MK7; slate, and steel with the diamond tip, at MK8. Only plain ground is ploughed (`ploughable`): never a hazard,
// a find, a key, a cache, a relic, a wreck or a pocket's ground, which stop the run as they always have. And a cut
// takes whole frames: the late bits cut a cell in two or three, so what time a ploughed cut has left in the frame it
// ends goes on to the next cell (the drill's `carry`), or MK7 and MK8 would be rounded to the same frames as MK6.
// (The run began again at every cell and the frame was whole: in soft rock MK6 cut no faster than MK5 nor MK8 than
// MK7, and in dense rock MK5 to MK8 went a third faster where the bit's table says more than twice.)
const PLOUGH_BIT = [0, 0, 0, 0, 0, 0.05, 0.06, 0.1];
// The bellows (the lava skin's second level): woken lava quenches the slag within two cells of it, not only on its
// four sides. The twenty-four cells round a cell out to two either way, as steps of its number, made once; and
// which of them are not its four sides (`RING2_FAR`), the twenty the first level never reaches, which alone are held
// to the tether's reach and kept out of a pocket: the four sides turn as they do at the first level, wherever they
// lie, or the second level would quench less than the first where lava runs out past the reach.
const RING2 = [], RING2_FAR = [];
for (let v = -2; v <= 2; v++) for (let u = -2; u <= 2; u++) if (u || v) { RING2.push(v * N + u); RING2_FAR.push(Math.abs(u) + Math.abs(v) > 1); }
// The capacitor (the arc coil's second level): an arc taken in charges the bit for so many seconds, and the next
// cut while it holds shatters the dense rock and slate round the cell cut (`shatters`).
const CHARGE = 8;
// The lamp sees across open ground (`lampSees`): RAYS rays from the middle of the drill's cell, each the cells it
// crosses in order out to the lamp's reach, as steps either way (dx, dy) one after another; `ends` is where each
// ray's cells end. Made once for each reach the lamp has, when it first has it.
const RAYS = { reach: -1, steps: null, ends: null }, RAY_COUNT = 64;
function rays(reach) {
  if (RAYS.reach === reach) return RAYS;
  const steps = [], ends = new Int32Array(RAY_COUNT);
  for (let r = 0; r < RAY_COUNT; r++) {
    // (The cells a line crosses side to side, never corner to corner: a light seen through a crack between two
    // cells that meet at a corner would see through a wall laid on the slant.)
    const a = (r + 0.5) * 2 * Math.PI / RAY_COUNT, cells = cellsAlong(C + 0.5, C + 0.5, C + 0.5 + Math.cos(a) * reach, C + 0.5 + Math.sin(a) * reach);
    for (let n = 1; n < cells.length; n++) {
      const u = cells[n] % N - C, v = Math.floor(cells[n] / N) - C;
      if (u * u + v * v > reach * reach) break;
      steps.push(u, v);
    }
    ends[r] = steps.length;
  }
  RAYS.reach = reach; RAYS.steps = Int16Array.from(steps); RAYS.ends = ends;
  return RAYS;
}
// A finger on the lab's list that moves less than LAB_TAP pixels is a tap; let go, the list runs on until it is
// slower than LAB_REST pixels a second.
const LAB_TAP = 5, LAB_REST = 6;
// The lab's keys of what is not ore (`sampleOf`): steel, a keystone's iron, each hazard by its type (its sheet's
// `hazard` frame), and each pocket's mineral, the last made the first time it is asked for.
const STEEL_SAMPLE = `${HAZARDS.lava.sheet}:steel`, KEY_SAMPLE = 'finds:key', MINERAL_SAMPLE = {};
const HAZ_SAMPLE = Object.fromEntries(Object.entries(HAZARDS).map(([type, { sheet }]) => [type, `${sheet}:hazard`]));
// The boulders of a drift (a pocket whose row's `twist` is 'drift') are in the books of loose ground while the
// drill is in the drift or near it, and leave them once it is out and they are AWAY cells off the screen: so the
// books do not grow by a drift's boulders for every drift crossed.
const AWAY = 6;
// The old deep is darker: past DEEPEN[0] cells from the core the dark the drill is in deepens, by DEEPEN[2] more at
// DEEPEN[0] + DEEPEN[1] and beyond. Only the dark drawn over what is out of the light deepens (`murk`): nothing the
// game decides by asks it, and nothing in the deep needs the lamp.
export const DEEPEN = [1600, 600, 0.25];
// Nothing is too hard to cut: tougher ground only takes longer (js/world.js: `digTime`), and a better bit cuts all
// of it faster. (The table is the shop's, CUT, where the bit's row says what each level does.)
export const SPEED = CUT;
// The shop's rows by their names, for `val`.
const ROW_OF = new Map(ROWS.map(u => [u.id, u]));
export const FLY = 9;                           // cells a second in open ground
const BODY = 0.34;                              // the drill's half-width in cells
const SIDE = [1, N, -1, -N];                    // the cells beside a cell, as steps of its number: east, south, west, north
// One connection to the browser's database, opened at the first asking and kept. (Every save opened another and
// none was ever closed: a long sitting held thousands of them.) Should it be lost, or fail to open, the next asking
// opens it again.
let opened = null;
// Where a save is written a second time, with its number (`Game.save`), and the number last saved there.
const LATEST = `${SAVE_KEY}-latest`;
const latestRev = () => { try { return JSON.parse(localStorage.getItem(LATEST))?.rev ?? 0; } catch { return 0; } };
const store = () => opened ??= new Promise((resolve, reject) => {
  const open = indexedDB.open('tetherbore', 1);
  open.onupgradeneeded = () => open.result.createObjectStore('pieces');
  open.onsuccess = () => { const db = open.result; db.onclose = () => { opened = null; }; db.onversionchange = () => { opened = null; db.close?.(); }; resolve(db); };
  open.onerror = () => { opened = null; reject(open.error); };
});

// The bits of a haul still on their way, gathered afresh at each small step of `updateHauls` so that the steps walk
// only those and not the many already home. (One list serves every haul: each is done with it before the next.)
const live = [];
// No two bits in the same place: this is what makes the heap flow instead of shrinking. Each of `bits[0..n)` is
// pushed apart from any other nearer than two radii, twice over. Each push moves both bits of the pair at once, so
// the pairs must be met in the same order every time: each cell's bits in the order of `bits`, which the chains of
// `crowd` keep by being built from the last bit back.
function jostle(bits, n, size, rad) {
  // The crowd's arrays are grown to hold every bit, and its table to twice as many chains.
  const span = Math.max(64, 2 ** Math.ceil(Math.log2(n * 2)));
  if (crowd.next.length < n) for (const key of ['next', 'cellX', 'cellY']) crowd[key] = new Int32Array(span / 2);
  if (crowd.head.length < span) crowd.head = new Int32Array(span);
  const { head, next, cellX, cellY } = crowd, mask = span - 1;
  for (let pass = 0; pass < 2; pass++) {
    head.fill(-1, 0, span);
    for (let i = n - 1; i >= 0; i--) {
      const b = bits[i], x = Math.floor(b.x / size), y = Math.floor(b.y / size), at = chainOf(x, y) & mask;
      cellX[i] = x; cellY[i] = y; next[i] = head[at]; head[at] = i;
    }
    for (let i = 0; i < n; i++) {
      const b = bits[i], gx = Math.floor(b.x / size), gy = Math.floor(b.y / size);
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const x = gx + ox, y = gy + oy;
        for (let j = head[chainOf(x, y) & mask]; j >= 0; j = next[j]) {
          if (j === i || cellX[j] !== x || cellY[j] !== y) continue;
          const c = bits[j], ux = c.x - b.x, uy = c.y - b.y, far2 = ux * ux + uy * uy;
          if (far2 >= 4 * rad * rad) continue;
          const far = Math.sqrt(far2) || 0.01, push = (2 * rad - far) * 0.25, nx = far2 ? ux / far : 1, ny = far2 ? uy / far : 0;
          b.x -= nx * push; b.y -= ny * push; c.x += nx * push; c.y += ny * push;
        }
      }
    }
  }
}

export class Game {
  // `over` is a second canvas laid on the first at the screen's full resolution, for the tether: without one (in
  // tests) the tether is drawn in the game's own pixels.
  constructor(canvas, over = null) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.over = over; this.overCtx = over ? over.getContext('2d') : null; this.ropes = []; this.scale = 1;
    this.world = new World();
    this.W = 180; this.H = 320;
    this.time = 0;
    this.input = { id: null, ax: 0, ay: 0, px: 0, py: 0, vx: 0, vy: 0, m: 0, keys: new Set(), auto: null };
    this.band = []; this.pieces = []; this.pieceOf = new CellBook(); this.preview = []; this.under = new Set();
    this.taken = []; this.walked = new Set(); this.boxes = new WeakMap(); this.cuts = 0; this.homeKey = '';
    this.swept = 0;                         // cells the tether's sweeps have looked at, for tests of how much work is done
    this.effects = []; this.popups = []; this.hauls = []; this.clouds = []; this.sparks = new Map(); this.lavaVol = new Map(); this.frostOpen = [];
    this.parts = []; this.rings = []; this.motes = []; this.gloom = [10, 8, 7]; this.murk = 1; this.flash = 0; this.counted = 0; this.chime = 3; this.clock = 0;
    this.shake = 0; this.twang = 0; this.edge = 0; this.hurt = 0; this.coreFlash = 0; this.banner = null; this.shop = false; this.shopRise = 0; this.lab = false; this.labRise = 0; this.labSel = null; this.labFlash = 0; this.confirmReset = 0;
    // The lab's list: how far it is scrolled, in pixels, and how fast it is going; the finger holding it ({ id, y0,
    // s0, moved, caught }: where it came down, the scroll then, the furthest it has gone since, and whether it came
    // down on the list still running on), a scroll it is easing to, and the scroll at the last step (`stepLab`);
    // and the key the list took when it went down, the one key whose repeats walk it (`key`).
    this.labScroll = 0; this.labVel = 0; this.labTouch = null; this.labAim = null; this.labPrev = 0; this.labHeld = null;
    this.buttons = []; this.panels = [];    // what can be tapped this frame; and the small panels up this frame, each [x, y, w, h]
    this.chunks = new Map(); this.version = 0;
    this.daylight = false;                  // no dark is laid over the ground: only a staged view asks for it (js/shot.js)
    this.place = null; this.placeKey = null; this.motifAt = -9;      // the name on show, the place the drill is in, when a place last sounded
    this.called = new Set(); this.calledAt = {};                      // things called out since the game began, and when each kind last was
    this.rung = new Set();                                            // the geodes a druse's haul has just rung, by what each is called out as (`resonant`)
    this.tickIn = 0; this.ticks = 0;                                  // until a wreck's next tick, and how many there have been
    this.quenched = new Map();                                        // slag just turned to steel: how long each cell still shows white
    // The rare hazards awake, each by the cell it is in (`trigger`, `updateHazards`); and what they leave on the
    // screen for a moment: a fumarole's flames, ore in flight to a lodestone, the flash of a toll.
    this.bells = new Map(); this.vents = new Map(); this.worms = new Map(); this.stones = new Map(); this.jets = []; this.flying = []; this.flares = [];
    this.specLine = null;                                             // the count of specimens just banked, on show under the top bar
    this.pips = []; this.pipsFor = '';                                // the pockets the map marks, and what that list was made for
    this.drifts = new Map();                                          // the drifts whose boulders are in the books, by their keys
    this.crushedAt = -9;                                              // when ore cut into last said CRUSHED
    this.dents = 0; this.shield = 0; this.tow = null;                 // knocks the hull has taken, how long nothing more knocks it, how long the wreck has lain dead
    this.chart = { zoom: 1, x: HX, y: HY };                           // the chart's view: how far it is zoomed in, and the cell at its middle
    this.chartRect = null; this.chartBase = 1; this.chartTouch = new Map();   // where the chart is on the screen this frame, its cells to a pixel unzoomed, the fingers on it
    this.shopTab = 'rig'; this.labTab = 'stats'; this.boost = 0; this.mendIn = 0;   // the tab each panel is open at; a spore's drive, in seconds left; until the mender's next pip
    // The capacitor's charge, in seconds left (CHARGE); and the flywheel's run of quick hauls, when the last was and
    // how many there have been (`payOf`, `haul`): kept apart from the chain a pocket's mineral pays for, and made
    // once, never replaced.
    this.charge = 0; this.spin = { t: -99, n: 0 };
    // The flow of the air where the drill is (`fly`: `kind` is its row's `current`, or null where there is none),
    // written in place each frame for the feel and the sound to read; the faults waiting to zip, a ring of cells
    // (`zip`, from `zipHead`, `zipN` of them) with how many more the thread may open and the time owed to it, and
    // the cells opened this frame; what the deep finds of a haul are counted by (`payOf`: their sectors, and a
    // record of a fossil's bones); and when each reaction last said so. All made once.
    this.flow = { x: 0, y: 0, kind: null };
    this.zip = new Int32Array(ZIP.ring); this.zipHead = 0; this.zipN = 0; this.zipLeft = 0; this.zipAcc = 0; this.zipRun = 0; this.zipped = [];
    this.tally = new Map(); this.bones = World.findRecord(); this.saidAt = { thaw: -9, glass: -9, burn: -9, rime: -9 };
    // The last frames that took long (see `frameTook`), kept apart from the game's own save, to find what freezes.
    this.probe = {}; this.stalls = [];
    try { this.stalls = JSON.parse(localStorage.getItem('tetherbore-stalls') ?? '[]'); } catch { this.stalls = []; }
    this.docked = null;                                               // what was banked and bought at the last docking, to go back to (`dockMark`)
    this.knocked = 0; this.mended = 0; this.notice = null;            // a pip just lost and the hull just mended (seconds left to show it), and the word across the screen
    this.smokeIn = 0; this.wrecks = 0; this.knocks = 0;               // until a hull in trouble next smokes; wrecks and knocks since the game began (for tests and tools)
    this.feel = new Feel();                                           // the feel of the ground the drill is in: what only shows and sounds (js/feel.js)
    this.fallen = this.feel.fallen;                                   // the cells whose icicle has fallen: the feel's, which it keeps and gives back
    this.fitter = new Fitter(FLY, BOOST.by);                          // what the upgrades show, and the moment of buying (js/fit.js)
    this.fauna = new Fauna(FLY, JOLT.bat);                            // the creatures of the ground (js/fauna.js)
    // (The parts of a frame whose time is added up by name, for `frameTook`.)
    for (const name of ['save', 'changed', 'haul', 'revert', 'updateHazards', 'updateHauls', 'homecoming', 'sweepHome', 'look']) {
      const part = this[name];
      if (typeof part === 'function') this[name] = (...args) => { const t0 = performance.now(); try { return part.apply(this, args); } finally { this.timed(name, t0); } };
    }
    this.fresh((Math.random() * 1e9) | 0, true);
  }

  // ------------------------------------------------------------ state
  fresh(seed, quiet = false) {
    this.S = { seed, grit: 0, gems: noGems(), lv: Object.fromEntries(ROWS.map(u => [u.id, 0])), relics: [0, 0, 0, 0], wrecks: [0, 0, 0, 0, 0, 0, 0, 0],
      stats: { hauls: 0, best: 0, buys: 0, moves: 0, time: 0 }, won: false, met: {}, marks: [], visited: {}, spec: [0, 0, 0, 0, 0], lab: {}, out: 0, rare: {},
      gen: GEN, shrines: [0, 0, 0, 0], fossils: 0, unshrined: 0 };
    this.world.reset(seed);
    this.begin();
    if (!quiet) this.claim();
  }
  // The ground kept in the browser's database is this world's from now on: whatever was kept of any other world is
  // thrown out, and the store is marked with this world's seed. (Every piece saved says whose it is as well, and
  // `restore` takes none that is another world's: a game once began a new world over the old one's saved ground,
  // and found everything about the core mined out to far beyond where its tether reached.)
  claim() {
    const seed = this.S.seed;
    store().then(db => { const pieces = db.transaction('pieces', 'readwrite').objectStore('pieces'); pieces.clear(); pieces.put({ seed }, 'meta'); }).catch(() => {});
  }
  begin() {
    const w = this.world;
    this.pending = { grit: 0, gems: noGems() };
    this.parts.length = 0; this.rings.length = 0; this.effects.length = 0; this.popups.length = 0; this.hauls.length = 0; this.clouds.length = 0;
    this.sparks.clear(); this.lavaVol.clear(); this.quenched.clear(); this.frostOpen.length = 0; w.lava.clear(); w.dug.clear();
    this.bells.clear(); this.vents.clear(); this.worms.clear(); this.stones.clear(); this.jets.length = 0; this.flying.length = 0; this.flares.length = 0;
    this.fuses = []; this.glowRun = 0; this.glowAt = -9;      // rings of fuse that are burning; and the caps lit one after another, and when the last was
    this.drill = { x: HX, y: HY, px: HX, py: HY, vx: 0, vy: 0, ang: 0, mode: 'free', tx: 0, ty: 0, speed: 0, dig: -1, digT: 0, digDur: 1, carry: 0, stun: 0, squash: 0, run: 0, armed: true, cell: -1, home: true };
    this.cam = { x: HX * T, y: HY * T };
    this.band = [[HX, HY], [HX, HY]];
    this.pieces = []; this.pieceOf = new CellBook(); this.taken.length = 0; this.homeKey = ''; this.homeEnd = [HX, HY];
    this.chain = null; this.hauled = null; this.specLine = null; this.pipsFor = ''; this.cornersFor = null; this.drifts.clear(); this.crushedAt = -9;
    // The hull is whole on a new game and on a game loaded: what is saved is its level, never its dents.
    this.dents = 0; this.shield = 0; this.tow = null; this.knocked = 0; this.mended = 0; this.notice = null; this.smokeIn = 0; this.boost = 0; this.mendIn = 0;
    this.charge = 0; this.spin.t = -99; this.spin.n = 0;
    this.flow.x = this.flow.y = 0; this.flow.kind = null; this.zipN = 0; this.zipLeft = 0; this.zipAcc = 0; this.zipRun = 0;
    for (const what in this.saidAt) this.saidAt[what] = -9;
    w.see(C, C, this.val('scanner') + 4);
    // Where the game begins is where the player already is: its name does not come up, now or as a new place later.
    const here = this.placeAt(this.di);
    this.place = null; this.placeKey = here.key; this.S.met[here.row.id] = 1;
    this.called.clear(); this.calledAt = {}; this.tickIn = 0; this.rung.clear();
    // The first piece, beside the core, lies loose from the start: the open cell between them tells of it.
    this.changed([C * N + C + 3]);
    this.shop = false; this.lab = false; this.labSel = null; this.labFlash = 0;
    this.labScroll = 0; this.labVel = 0; this.labTouch = null; this.labAim = null; this.labPrev = 0; this.labHeld = null;
    this.recount();
    this.feel.reset(this.S.seed);
    this.fitter.reset();
    this.fauna.reset(this.S.seed, this);
    this.dockMark();
  }
  // What a row gives at the level it is at. (Asked many times a frame: the row is looked up in a table made once.)
  val(id) { return ROW_OF.get(id).values[this.S.lv[id] ?? 0]; }
  // How many of the things the lab can know have a sample (`known`), for what is drawn every frame: counted afresh
  // whenever the game begins, is loaded or goes back to a docking (`begin`), and one more by `analyse` for a first
  // sample. (Whatever sets the lab's samples by hand, a tool or a test, counts them again with this.)
  recount() { let n = 0; for (const e of LAB) if (this.S.lab[e.key]) n++; this.known = n; return n; }
  // Fitted with the lava skin, the drill flies through lava.
  get swims() { return this.val('lavaskin') > 0; }
  // The pips the hull has left: what its level gives, less the knocks taken since it was last mended.
  get hull() { return Math.max(0, this.val('hull') - this.dents); }
  get di() { return Math.floor(this.drill.y) * N + Math.floor(this.drill.x); }
  get far() { return Math.hypot(this.drill.x - HX, this.drill.y - HY); }
  get atCore() { return this.far < 1.7; }

  // What was bought and banked goes in local storage; the ground, a piece at a time, in the browser's database.
  //
  // A save is numbered (`rev`), one more each time, and written twice: under the game's key and under LATEST, which
  // no older copy of the game knows of. A game open in another tab since long ago holds what the game was then:
  // were it to save, it would write that over everything played since. (One did: a game far on, with its ground
  // mined out for hundreds of cells round, was left with the grit and the rig of its first hour.) So before a game
  // saves it looks at the number last saved, and if that is past its own it does not save: it loads what was saved
  // (`adopt`). And a game that loads takes the later of the two copies, so that what an older copy of the game
  // wrote over the first key is passed by.
  save() {
    if (this.loading) return;
    if (this.rev !== undefined) {
      let kept = null;
      try { kept = JSON.parse(localStorage.getItem(LATEST)); } catch { kept = null; }
      if (kept && kept.v === 3 && (kept.rev ?? 0) > this.rev) { this.adopt(); return; }
    }
    this.rev = (this.rev ?? latestRev()) + 1;
    try { const text = JSON.stringify({ v: 3, rev: this.rev, ...this.S }); localStorage.setItem(SAVE_KEY, text); localStorage.setItem(LATEST, text); } catch { /* the game goes on without saving */ }
    // (The pieces are taken now, as this world's: by the time the database answers, the game may be in another.)
    const w = this.world, seed = this.S.seed, kept = [...w.touched].map(id => [id, w.chunks[id], w.genOf[id]]).filter(([, p]) => p);
    if (!kept.length) return;
    w.touched.clear();
    store().then(db => {
      const pieces = db.transaction('pieces', 'readwrite').objectStore('pieces');
      // (Each piece says which rules laid it: its own generation, never GEN, as a piece an older game laid and this
      // one has not brought up is saved again with what it holds and is laid by the older rules still.)
      for (const [id, p, gen] of kept) pieces.put({ kind: p.kind, biome: p.biome, seen: p.seen, seed, gen }, id);
    }).catch(() => {});
  }
  // The game saved elsewhere since this one last looked is loaded in place of this one, and the game says so.
  adopt() {
    if (this.loading) return;
    this.loading = true;
    this.restore().then(ok => { this.loading = false; if (ok) this.notice = { title: 'GAME LOADED', sub: 'IT WAS PLAYED ON IN ANOTHER TAB', colour: '#8ce060', t: 0, life: 5 }; });
  }
  async restore() {
    let raw = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
      let data = JSON.parse(raw);
      // (The later copy of the two. Where the first key's has a number, the one with the larger; where it has none
      // (an older copy of the game wrote it, or a hand did), LATEST's only if that is the same world played for
      // longer: then what is under the first key is an old state written over a newer.)
      let latest = null;
      try { latest = JSON.parse(localStorage.getItem(LATEST)); } catch { latest = null; }
      const sound = d => !!d && d.v === 3;
      if (sound(latest) && (!sound(data) || (data.rev !== undefined ? (latest.rev ?? 0) > data.rev : data.seed === latest.seed && (data.stats?.time ?? 0) < (latest.stats?.time ?? 0)))) data = latest;
      if (!data || data.v !== 3) { this.rev = 0; return false; }
      const { v, rev, ...S } = data;
      // (A copy with no number, taken for the later one, is saved next as later than the numbered copy it passed.)
      this.rev = rev ?? latest?.rev ?? 0;
      // What was bought and banked does not wait on the database: where that cannot be opened or read (a private
      // window), the world is made again from its seed and only the cuts are lost.
      let rows = [];
      try {
        const db = await store();
        rows = await new Promise((resolve, reject) => {
          const found = [], walk = db.transaction('pieces').objectStore('pieces').openCursor();
          walk.onsuccess = () => { const c = walk.result; if (c) { found.push([c.key, c.value]); c.continue(); } else resolve(found); };
          walk.onerror = () => reject(walk.error);
        });
      } catch { rows = []; }
      this.S = S;
      // What a game saved before these were kept does not have: the wrecks' parts, the grounds met, the dots of
      // things seen on the map, the pockets visited, the specimens of each direction, the lab's samples, the rare
      // hazards met.
      S.wrecks ??= [0, 0, 0, 0, 0, 0, 0, 0]; S.met ??= {}; S.marks ??= []; S.visited ??= {}; S.spec ??= [0, 0, 0, 0, 0]; S.lab ??= {}; S.out ??= 0; S.rare ??= {};
      // And what one saved before the seams and the deep strains lacks: the generation of the world it last played
      // in (the ground it saved is told apart piece by piece; this says only whether to say the deep has changed),
      // the corner shrines hauled and the fossils whole.
      S.gen ??= 1; S.shrines ??= [0, 0, 0, 0]; S.fossils ??= 0; S.unshrined ??= 0;
      // (And the corners' gems, which a game saved before them has no places for: each gem keeps its number.)
      S.gems ??= []; while (S.gems.length < GEM_N) S.gems.push(0);
      for (const u of ROWS) this.S.lv[u.id] = Math.min(this.S.lv[u.id] ?? 0, u.values.length - 1);
      this.world.reset(S.seed);
      // (The shrines an older game's seen ground left unlaid, before anything asks where one is.)
      this.world.unshrined = S.unshrined;
      // Only this world's ground is taken. A piece says whose it is; one that does not (saved before pieces said)
      // is this world's if the store is marked as this world's. In a store with no mark at all each such piece is
      // looked at (`World.strange`): another world's ground does not lie as this seed lays it. And where a fifth
      // of them or more are another's, the pieces with nothing left in them to judge by go too. What is not this
      // world's is thrown out of the store, and the store is marked.
      const w = this.world, meta = rows.find(([key]) => key === 'meta')?.[1], pieces = rows.filter(([key]) => key !== 'meta'), gone = [], unsure = [];
      let judged = 0, strange = 0;
      // (Each piece is laid by the rules of the generation it says, and one that says none by the first's, before
      // any is judged: a piece of this world an older game saved is the ground those rules lay, and a structure
      // anchored in one piece may lay cells in its neighbour.)
      for (const [id, p] of pieces) w.genOf[id] = p.gen ?? 1;
      w.forget();
      for (const [id, p] of pieces) {
        let own = p.seed === S.seed;
        if (p.seed === undefined) {
          if (meta) own = meta.seed === S.seed;
          else { const how = w.strange(id, p); judged++; own = how < 1; if (how === 1) strange++; else if (how > 0) unsure.push(id); }
        }
        if (own) w.chunks[id] = { kind: p.kind, biome: p.biome, seen: p.seen }; else gone.push(id);
      }
      if (strange >= judged * 0.2 && strange > 0) for (const id of unsure) { w.chunks[id] = undefined; gone.push(id); }
      // (Ground thrown out is made afresh, by today's rules.)
      for (const id of gone) w.genOf[id] = GEN;
      // The ground an older game saved is brought up to today's rules where it was never seen (`World.migrate`),
      // and what the finder knew of the seed is asked again.
      const [, newer] = w.migrate();
      S.unshrined = w.unshrined;
      this.laidFor = ''; if (this.chartMap) this.chartMap.laidFor = '';
      // (The pieces are put in by hand, not through the world: what it counts of changes to the ground goes up here.)
      w.stirred++;
      this.thrownOut = gone.length;
      if (gone.length || meta?.seed !== S.seed) {
        const seed = S.seed;
        store().then(db => { const kept = db.transaction('pieces', 'readwrite').objectStore('pieces'); for (const id of gone) kept.delete?.(id); kept.put({ seed }, 'meta'); }).catch(() => {});
      }
      this.begin();
      if (gone.length) this.notice = { title: 'GROUND MENDED', sub: `${gone.length} PIECES OF AN OLD WORLD`, colour: '#8ce060', t: 0, life: 5 };
      // (Said once, to a game saved before the deep changed whose unseen ground was laid anew: it is today's from then.)
      else if (newer && S.gen < GEN) this.notice = { title: 'NEW GROUND', sub: 'THE DEEP HAS CHANGED', colour: '#8ce060', t: 0, life: 5 };
      S.gen = GEN;
      return true;
    } catch (error) {
      // A save that is there and cannot be begun is kept aside before a new game is written over it, and the
      // game says what went wrong (MENU); the new game begins clean.
      try { if (raw) localStorage.setItem(`${SAVE_KEY}-kept`, raw); } catch { /* not kept */ }
      this.fresh((Math.random() * 1e9) | 0, true);
      this.failed(error);
      return false;
    }
  }

  // ------------------------------------------------------------ view
  resize(cssW, cssH, dpr) {
    const scale = Math.max(1, Math.round(Math.min(cssW, cssH * 0.62) * dpr / 190));
    this.W = Math.ceil(cssW * dpr / scale); this.H = Math.ceil(cssH * dpr / scale);
    this.canvas.width = this.W; this.canvas.height = this.H;
    this.ctx.imageSmoothingEnabled = false;
    this.scale = scale;
    if (this.over) { this.over.width = this.W * scale; this.over.height = this.H * scale; this.ropeDirty = null; }
  }

  // ------------------------------------------------------------ input
  // Press anywhere and drag: the drill flies the way the thumb has moved from where it came down, at any angle,
  // faster the further it is dragged. The origin trails the thumb, so a change of mind is a short stroke.
  pointerDown(id, x, y) {
    unlock();
    const hit = this.buttons.find(b => x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h);
    // A finger on the chart (not on one of its buttons) takes hold of it: any number of fingers, for a pinch.
    if (this.lab && this.labTab === 'chart' && this.chartRect && (!hit || hit.swallow)) {
      const [rx, ry, rw, rh] = this.chartRect;
      if (x >= rx && y >= ry && x < rx + rw && y < ry + rh) { this.chartTouch.set(id, [x, y]); return; }
    }
    // A finger on the lab's list takes hold of it: dragged it scrolls the list, and let go where it came down it is
    // a tap on the line under it (`pointerUp`). It catches the list if it was still running on, and then chooses
    // nothing: a touch that stops the list is to read it by.
    if (this.lab && this.labTab === 'lab' && !this.labTouch && this.input.id === null) {
      const g = this.labGeom();
      if (x >= g.vx && y >= g.vy && x < g.vx + g.vw && y < g.vy + g.view) {
        const caught = Math.abs(this.labVel) >= LAB_REST || this.labAim !== null;
        this.labTouch = { id, y0: y, s0: this.labScroll, moved: 0, caught }; this.labVel = 0; this.labAim = null; this.labPrev = this.labScroll;
        return;
      }
    }
    if (this.input.id !== null) return;
    if (hit) { hit.act(x, y); return; }
    if (this.shop || this.lab) { this.shop = this.lab = false; sfx.tap(); return; }
    Object.assign(this.input, { id, ax: x, ay: y, px: x, py: y, m: 0 });
    this.drill.armed = true;
  }
  pointerMove(id, x, y) {
    if (this.chartTouch.has(id)) { if (this.lab && this.chartRect) this.chartMove(id, x, y); return; }
    const t = this.labTouch;
    if (t && t.id === id) {
      t.moved = Math.max(t.moved, Math.abs(y - t.y0));
      // (Under a few pixels it may yet be a tap, and the list does not move.)
      if (t.moved >= LAB_TAP) this.labScroll = Math.max(0, Math.min(this.labGeom().most, t.s0 - (y - t.y0)));
      return;
    }
    const inp = this.input;
    if (inp.id !== id) return;
    inp.px = x; inp.py = y;
    const dx = x - inp.ax, dy = y - inp.ay, far = Math.hypot(dx, dy);
    if (far < 4) { inp.m = 0; return; }
    inp.vx = dx / far; inp.vy = dy / far; inp.m = Math.min(1, (far - 3) / 12);
    if (far > 24) { inp.ax = x - inp.vx * 24; inp.ay = y - inp.vy * 24; }
  }
  pointerUp(id) {
    this.chartTouch.delete(id);
    const t = this.labTouch;
    if (t && t.id === id) {
      this.labTouch = null;
      // A finger that did not move is a tap: the line it came down on is chosen (the head of a part is not), and
      // shown whole, unless it came down to catch the list running on. One that moved lets go of the list with the
      // speed it had (`stepLab`). (The lines are drawn at the scroll rounded to a pixel, and found there too.)
      if (t.moved < LAB_TAP && this.lab && this.labTab === 'lab') {
        const g = this.labGeom(), top = Math.round(this.labScroll), at = t.y0 - g.vy, i = t.caught || (at < LAB_SEC && top > 0) ? -1 : this.labLineAt(at + top);
        if (i >= 0) { this.labSel = LAB[i].key; this.labReveal(i); sfx.tap(); }
        this.labVel = 0;
      }
      return;
    }
    if (this.input.id === id) { this.input.id = null; this.input.m = 0; }
  }
  // A key held down comes again and again (`repeat`): only the lab's list takes those, to walk on through it, and
  // only of a key it took as it went down (a key held to fly with as the list was opened is not walked by).
  //
  // On a keyboard each panel has a key of its own (`PANEL_KEYS`): U or Enter the shop (at the core), I the panel's
  // STATS, L its LAB, M its MAP (once the chart is bought) and Escape its MENU; the key of the panel or tab open
  // shuts it, and Escape shuts whatever is open. With a panel open, Tab (Shift+Tab back) steps through its tabs and
  // 1 to 4 choose one.
  key(code, down, repeat = false, shift = false) {
    if (!down && code === this.labHeld) this.labHeld = null;
    if (down && this.lab && this.labTab === 'lab' && (!repeat || code === this.labHeld) && this.labKey(code, repeat)) { this.labHeld = code; return true; }
    if (repeat) return false;
    const dir = { ArrowRight: 0, KeyD: 0, ArrowDown: 1, KeyS: 1, ArrowLeft: 2, KeyA: 2, ArrowUp: 3, KeyW: 3 }[code];
    if (dir !== undefined) {
      if (down) { unlock(); this.shop = this.lab = false; if (!this.input.keys.size) this.drill.armed = true; this.input.keys.add(dir); } else this.input.keys.delete(dir);
      return true;
    }
    if (!down) return false;
    unlock();
    if (code === 'KeyU' || code === 'Enter') { if (this.atCore && this.drill.mode !== 'dead') { this.shop = !this.shop; this.lab = false; sfx.tap(); } return true; }
    if (code === 'Escape' && (this.shop || this.lab)) { this.shop = this.lab = false; sfx.tap(); return true; }
    const tab = PANEL_KEYS[code];
    if (tab) {
      if (tab === 'chart' && !this.charted) return true;
      if (this.lab && this.labTab === tab) this.openLab(false); else this.openLab(true, tab);
      return true;
    }
    const step = code === 'Tab' ? (shift ? -1 : 1) : 0, pick = /^(Digit|Numpad)[1-9]$/.test(code) ? +code.at(-1) - 1 : -1;
    if (step || pick >= 0) {
      if (!this.shop && !this.lab) return step !== 0;
      const ids = this.shop ? TABS.map(t => t.id) : this.panelIds(), now = Math.max(0, ids.indexOf(this.shop ? this.shopTab : this.labTab));
      const to = step ? (now + step + ids.length) % ids.length : pick;
      if (to >= ids.length || to === now) return true;
      if (this.shop) this.shopTab = ids[to];
      else if (ids[to] === 'lab') return this.openLab(true, 'lab'), true;   // (the list opens at the thing chosen)
      else { this.labTab = ids[to]; this.labVel = 0; this.labAim = null; }
      sfx.tap();
      return true;
    }
    return false;
  }
  // The panel's tabs, in the order they are drawn (the MAP only once the chart is bought).
  panelIds() { return ['stats', 'lab', ...(this.charted ? ['chart'] : []), 'menu']; }
  // Which way the player is steering, and how hard: [x, y, 0-1].
  steer() {
    const inp = this.input;
    if (inp.auto) return inp.auto;
    if (inp.keys.size) {
      let x = 0, y = 0;
      for (const k of inp.keys) { x += DX[k]; y += DY[k]; }
      const far = Math.hypot(x, y);
      return far ? [x / far, y / far, 1] : [0, 0, 0];
    }
    return inp.id !== null && inp.m > 0 ? [inp.vx, inp.vy, inp.m] : [0, 0, 0];
  }

  // ------------------------------------------------------------ the tether
  // The tether is a string from the drill to the core: `band`, a line of points, the drill's end first. It runs
  // straight and bends only where it lies against a corner of ground. A bend is [x, y, turn, cell, corner]: the
  // rock's own corner (so whole numbers), which way the string turns there (1 or -1), the cell whose corner it is,
  // and which of that cell's corners. The string is drawn a hair off the rock (`lay`); everything else is worked
  // out on the corners themselves, so catching and letting go happen at exactly the same line.
  //
  // Nothing is nudged into place. When an end of the string moves, the string sweeps a triangle about the bend next
  // to it, and any corner of ground inside that triangle is one the string has caught: it becomes a bend at once.
  // When the string swings back until it no longer turns round a bend, the bend is let go. So the string is always
  // the tight one for the way it has been led, and it never creeps.

  // The first corner a string catches as its end moves from `cur` to `to` about `pivot`: [x, y, cell, corner], null
  // when there is none, undefined when the triangle is too large to search. `skip` is corners the string is on.
  catchIn(pivot, cur, to, skip) {
    const w = this.world, px = pivot[0], py = pivot[1], cx = cur[0], cy = cur[1], tx = to[0], ty = to[1];
    const area = (cx - px) * (ty - py) - (cy - py) * (tx - px);
    if (Math.abs(area) < 1e-12) return null;
    const side = area > 0 ? 1 : -1, tri = [[px, py], [cx, cy], [tx, ty]];
    // No point of the triangle is further from the pivot than the further of its other two corners: the string
    // does not reach beyond that. (Where the end has moved a few billionths of a cell the triangle's short edge is
    // too short to tell which side of it a corner lies on, and this alone keeps out a corner past the string's end.)
    const span = Math.max((cx - px) ** 2 + (cy - py) ** 2, (tx - px) ** 2 + (ty - py) ** 2) + 1e-9;
    let best = null, least = Infinity, reach = 0, looked = 0;
    for (let row = Math.floor(Math.min(py, cy, ty)) - 1; row <= Math.floor(Math.max(py, cy, ty)) + 1; row++) {
      // The stretch of this row the triangle crosses, a cell to spare either side.
      const ya = row - 0.01, yb = row + 1.01;
      let lo = Infinity, hi = -Infinity;
      for (let e = 0; e < 3; e++) {
        const a = tri[e], b = tri[(e + 1) % 3];
        if (a[1] >= ya && a[1] <= yb) { lo = Math.min(lo, a[0]); hi = Math.max(hi, a[0]); }
        if (a[1] === b[1]) continue;
        for (const y of [ya, yb]) {
          const t = (y - a[1]) / (b[1] - a[1]);
          if (t >= 0 && t <= 1) { const x = a[0] + (b[0] - a[0]) * t; lo = Math.min(lo, x); hi = Math.max(hi, x); }
        }
      }
      if (lo > hi) continue;
      const x0 = Math.floor(lo) - 1, x1 = Math.floor(hi) + 1;
      if ((looked += x1 - x0 + 1) > 400000) return undefined;
      this.swept += x1 - x0 + 1;
      // The row is read straight from each piece of the world it crosses, and a cell of ground with ground to both
      // sides of it in the row has no corner to catch on: nearly every cell is passed over at one look.
      for (let x = x0; x <= x1;) for (let kind = w.piece(((row >> 6) << 8) | (x >> 6)).kind, base = (row & 63) << 6, end = Math.min(x1, x | 63); x <= end; x++) {
        const u = x & 63;
        if (kind[base | u] === K.EMPTY) continue;
        const west = (u > 0 ? kind[base | (u - 1)] : w.k(row * N + x - 1)) === K.EMPTY, east = (u < 63 ? kind[base | (u + 1)] : w.k(row * N + x + 1)) === K.EMPTY;
        if (!west && !east) continue;
        for (let c = 0; c < 4; c++) {
          // A corner the string can lie against: the cells either side of it along this cell's edges are open.
          // (The cell across the corner may be ground too: two cells touching at a point are two corners there.)
          const ox = c & 1, oy = c >> 1, ny = oy ? 1 : -1;
          if (!(ox ? east : west) || w.k((row + ny) * N + x) !== K.EMPTY) continue;
          const key = (row * N + x) * 4 + c;
          if (skip.includes(key)) continue;
          const qx = x + ox, qy = row + oy;
          if ((qx - px) ** 2 + (qy - py) ** 2 > span) continue;
          const off = side * ((cx - px) * (qy - py) - (cy - py) * (qx - px)), path = side * ((tx - cx) * (qy - cy) - (ty - cy) * (qx - cx));
          // A corner the string already lies along counts: whether it is caught is settled below, by which side its
          // cell is on.
          if ((qx === px && qy === py) || off < -1e-9 || path < -1e-9 || side * ((px - tx) * (qy - ty) - (py - ty) * (qx - tx)) <= 1e-9) continue;
          // The string turns toward the cell it has run into, not away from it.
          if (side * ((qx - px) * (row + 0.5 - qy) - (qy - py) * (x + 0.5 - qx)) <= 0) continue;
          // A corner on the very line the end travels along is reached by the end of the string alone. It is caught
          // only if its cell lies on the string's side of that line, where the string runs into it: a cell beyond
          // the line is never touched.
          if (path <= 1e-9 && side * ((tx - cx) * (row + 0.5 - cy) - (ty - cy) * (x + 0.5 - cx)) <= 0) continue;
          // The one met first is the one least far round from where the string lay; of two in line, the further.
          const round = Math.atan2(off, (cx - px) * (qx - px) + (cy - py) * (qy - py)), far = (qx - px) ** 2 + (qy - py) ** 2;
          if (round < least - 1e-12 || (round < least + 1e-12 && far > reach)) { least = round; reach = far; best = [qx, qy, row * N + x, key]; }
        }
      }
    }
    return best;
  }
  // The bends a string picks up as its end moves from `from` to `to` while the rest holds at `pivot`, in order from
  // the pivot outward. A large triangle is swept a part at a time: the end goes part of the way, then on, which is
  // the same sweep, so no sweep is ever given up. The first part is small and each part that meets nothing is twice
  // the one before: a string let go over ground meets a corner almost at once, and then only a sliver has been
  // searched, however long the legs of the triangle; only a sweep across ground that is truly open is searched whole.
  caught(pivot, from, to, skip = []) {
    const out = [];
    let cur = from, aim = to, most = 4000;
    skip = skip.slice();
    if (pivot[4] !== undefined) skip.push(pivot[4]);
    for (let guard = 0; guard < 4000; guard++) {
      // How many cells the triangle covers: over the most this part may, the end goes only so far first.
      const cells = Math.abs((cur[0] - pivot[0]) * (aim[1] - pivot[1]) - (cur[1] - pivot[1]) * (aim[0] - pivot[0])) / 2;
      if (cells > most * 1.25) { const part = most / cells; aim = [cur[0] + (aim[0] - cur[0]) * part, cur[1] + (aim[1] - cur[1]) * part]; }
      const q = this.catchIn(pivot, cur, aim, skip);
      if (q === undefined) { aim = [(cur[0] + aim[0]) / 2, (cur[1] + aim[1]) / 2]; continue; }
      if (!q) {
        if (aim === to) break;
        cur = aim; aim = to; most = Math.min(250000, most * 2);
        continue;
      }
      most = 4000;
      // Where the moving end was when the string met the corner.
      const ax = q[0] - pivot[0], ay = q[1] - pivot[1], mx = aim[0] - cur[0], my = aim[1] - cur[1], den = mx * ay - my * ax;
      const t = den ? Math.max(0, Math.min(1, -((cur[0] - pivot[0]) * ay - (cur[1] - pivot[1]) * ax) / den)) : 0;
      cur = [cur[0] + mx * t, cur[1] + my * t];
      pivot = [q[0], q[1], Math.sign(ax * (to[1] - q[1]) - ay * (to[0] - q[0])) || 1, q[2], q[3]];
      skip.push(q[3]);
      out.push(pivot);
    }
    return out;
  }
  // An end of the string moves: P[n] goes to `to` and the string beyond it (P[n + 1] and on, toward the core)
  // follows, catching the corners it sweeps over and letting go of each bend it swings past straight at. The move
  // must be one the end could make: a straight line through open ground. Nothing before P[n] is touched.
  lead(P, to, n = 0) {
    let cur = P[n];
    for (let guard = 0; guard < 60 + 2 * P.length && P.length >= n + 2; guard++) {
      const pivot = P[n + 1];
      if (n + 2 < P.length) {
        // The end runs back along its own string right through the bend it hangs from, or stands on it already:
        // the bend is let go there. Going on from the corner, the string takes it up again if it turns round it.
        const ex = to[0] - cur[0], ey = to[1] - cur[1], qx = pivot[0] - cur[0], qy = pivot[1] - cur[1], on = ex * qx + ey * qy;
        if ((qx === 0 && qy === 0) || (ex * qy - ey * qx === 0 && on > 0 && on <= ex * ex + ey * ey)) { P.splice(n + 1, 1); cur = [pivot[0], pivot[1]]; continue; }
      }
      let target = to, lift = false, ref = n + 2;
      // The way the string comes on to this bend, from the nearest point beyond it that is somewhere else.
      while (ref < P.length && P[ref][0] === pivot[0] && P[ref][1] === pivot[1]) ref++;
      if (ref < P.length && pivot[2]) {
        // Does the string swing past straight at this bend on the way? Then it goes only that far first.
        const bx = pivot[0] - P[ref][0], by = pivot[1] - P[ref][1];
        const now = bx * (cur[1] - pivot[1]) - by * (cur[0] - pivot[0]), then = bx * (to[1] - pivot[1]) - by * (to[0] - pivot[0]);
        if (then * pivot[2] < 0) {
          lift = true;
          const t = now * pivot[2] <= 0 ? 0 : now / (now - then);
          target = [cur[0] + (to[0] - cur[0]) * t, cur[1] + (to[1] - cur[1]) * t];
        }
      }
      const got = this.caught(pivot, cur, target, n + 2 < P.length && P[n + 2][4] !== undefined ? [P[n + 2][4]] : []);
      if (got.length) {
        P.splice(n + 1, 0, ...got.reverse());
        // Ground the string has newly come to lie against is looked at soon, in case it is loose (`discover`).
        for (const b of got) if (this.taken.length < 64) this.taken.push(b);
      } else if (lift) P.splice(n + 1, 1);
      cur = target;
      if (!lift) break;
    }
    P[n] = to;
  }
  // The drill has moved: the string follows. Called after every small move the drill makes, never across a move that
  // went round something, so the string is led the way the drill really went.
  tend() {
    const d = this.drill, P = this.band;
    // (A dead drill leads no string.)
    if (d.mode === 'dead') return;
    if (P[0][0] !== d.x || P[0][1] !== d.y) this.lead(P, [d.x, d.y]);
  }
  // Does the string, running from `c` to bend `b` and on to `a`, turn round the bend's ground: the ground is there,
  // the string turns the way the bend says, and the ground lies inside the turn. A bend the string runs out to and
  // straight back from holds nothing, and neither does one whose neighbour stands on the same spot.
  holds(b, a, c) {
    if (this.world.k(b[3]) === K.EMPTY) return false;
    const ux = a[0] - b[0], uy = a[1] - b[1], vx = c[0] - b[0], vy = c[1] - b[1];
    if ((ux === 0 && uy === 0) || (vx === 0 && vy === 0)) return false;
    const gx = (b[3] % N) + 0.5 - b[0], gy = Math.floor(b[3] / N) + 0.5 - b[1], turn = ux * vy - uy * vx;
    // Dead straight across the corner: it stays while its ground is on the side it would turn to.
    if (turn === 0) return ux * vx + uy * vy < 0 && (ux * gy - uy * gx) * b[2] > 0;
    return turn * b[2] > 0 && (ux * gy - uy * gx) * turn > 0 && (gx * vy - gy * vx) * turn > 0;
  }
  // The ground has changed: the string settles on what is left. It is walked from the core outward. A bend that
  // still holds (`holds`) stays as it is. At the first that does not (its ground gone, or the string no longer
  // turning round it) the string's end is taken in hand there and led on along the way the string lay, bend to
  // bend, catching and letting go as any moving end does (`lead`), until it comes to a bend that holds again or to
  // the drill. So nothing is ever swept about a bend that is itself going, a run of bends on ground that went is let
  // go as one, the same corner twice running comes down to one bend or none (a bend whose neighbour stands on the
  // same spot does not hold, and the end led on from there lets go of the other), and however many bends there are
  // each is looked at once.
  retighten() {
    const P = this.band;
    // `loose`: P[n + 1] is no bend but the end in hand, standing where the bend before stood.
    let loose = false;
    for (let n = P.length - 2; n >= 0; n--) {
      const p = P[n];
      if (loose) {
        this.lead(P, [p[0], p[1]], n + 1);
        P.splice(n + 1, 1);
      }
      if (n === 0) break;
      loose = !this.holds(p, P[n - 1], P[n + 1]);
      if (loose) P[n] = [p[0], p[1]];
    }
  }
  // The string as it is drawn and as things ride along it: each bend stood a hair off its corner, on the outside of
  // the turn, so the line never touches the rock.
  lay() {
    const P = this.band, m = 0.16;
    return P.map((b, n) => {
      if (n === 0 || n === P.length - 1 || b[4] === undefined) return [b[0], b[1]];
      const a = P[n - 1], c = P[n + 1], al = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, cl = Math.hypot(c[0] - b[0], c[1] - b[1]) || 1;
      let ux = -(a[0] - b[0]) / al - (c[0] - b[0]) / cl, uy = -(a[1] - b[1]) / al - (c[1] - b[1]) / cl;
      const len = Math.hypot(ux, uy);
      // Nearly straight: away from the cell, by its corner.
      if (len < 0.05) { const k = b[4] % 4; ux = k & 1 ? 1 : -1; uy = k >> 1 ? 1 : -1; return [b[0] + ux * m * 0.7, b[1] + uy * m * 0.7]; }
      return [b[0] + ux / len * m, b[1] + uy / len * m];
    });
  }
  // After the ground changed: which pieces lie loose, and how the tether settles. `opened` is every cell that was
  // opened together (a cut and what burst beside it, a haul), `closed` every cell that grew back. Called
  // with neither, the ground was changed by other hands and every loose piece is looked over.
  //
  // `pieces` is the loose pieces, each a list of cells; `pieceOf` says of every loose cell which piece it is in.
  // Both are kept as they stand and only what the change touched is worked on: a cut into a loose piece of 40,000
  // cells takes the one cell out of it, and nothing here is in proportion to how much ground lies loose.
  changed(opened = [], closed = []) {
    const w = this.world, of = this.pieceOf;
    this.version++; this.cuts++;
    this.walked.clear();
    // A loose piece that has been cut into is whatever is left of it, which may be several pieces now. `hit` holds
    // the cells each has lost (null: look it over), `cut` the cells opened in ground that was held.
    const all = !opened.length && !closed.length, hit = new Map(), cut = [];
    for (const i of opened) {
      const piece = of.get(i);
      if (!piece) { cut.push(i); continue; }
      const lost = hit.get(piece);
      if (lost) lost.push(i); else hit.set(piece, [i]);
    }
    // (Other hands may have changed the list of pieces too: the book of cells is made afresh from it.)
    if (all) { of.clear(); for (const cells of this.pieces) { hit.set(cells, null); for (const c of cells) of.set(c, cells); } }
    if (hit.size) {
      const kept = [];
      for (const cells of this.pieces) { if (hit.has(cells)) kept.push(...this.split(cells, hit.get(cells))); else kept.push(cells); }
      this.pieces = kept;
    }
    // Ground that grew back against a loose piece (ice over a cut, basalt, moss) may have joined it to ground that
    // is held, or to another piece. From each cell that grew beside loose ground, what it now belongs to is followed
    // through loose ground and the cells that grew, and no further. If that is all there is, the whole is one loose
    // piece now (the largest of the pieces in it keeps its list and takes in the rest). The first step on to any
    // other ground shows the pieces beside that cell are held, or have grown on to loose ground nobody knew: held
    // ground is never followed into the world, and a piece that is held is found so at the first cell.
    if (closed.length) {
      const grown = new Set(closed), gone = new Set(), doubt = new Set();
      for (const j of closed) {
        if (of.has(j) || w.k(j) === K.EMPTY) continue;
        const beside = [];
        for (const s of SIDE) { const piece = of.get(j + s); if (piece && !beside.includes(piece)) beside.push(piece); }
        if (!beside.length) continue;
        const whole = w.pieceIn(j, -Infinity, -Infinity, Infinity, Infinity, Infinity, c => of.has(c) || grown.has(c));
        if (!whole) { for (const piece of beside) doubt.add(piece); continue; }
        let keep = beside[0];
        for (const piece of beside) if (piece.length > keep.length) keep = piece;
        this.boxes.delete(keep);
        for (const c of whole) {
          const piece = of.get(c);
          if (piece === keep) continue;
          if (piece) gone.add(piece);
          keep.push(c); of.set(c, keep);
        }
      }
      if (gone.size) this.pieces = this.pieces.filter(cells => !gone.has(cells));
      // Ground that grew where nothing loose lay may be an island of its own (basalt set in the open, ice across a
      // hollow), and a piece that came to other ground may only have grown on to loose ground nobody knew: the
      // cells that grew are looked at as any ground is (`spot`). A piece still in doubt after that is held.
      for (const j of closed) this.spot(j);
      const held = new Set([...doubt].filter(cells => !gone.has(cells) && of.get(cells[0]) === cells));
      for (const cells of held) for (const c of cells) if (of.get(c) === cells) of.delete(c);
      if (held.size) this.pieces = this.pieces.filter(cells => !held.has(cells));
    }
    // A cut into ground that was held may have cut a piece off, of any size. All the cells opened together are
    // asked about at once: a piece is cut off by them all, not by any one.
    if (cut.length) for (const cells of w.freed(cut, Infinity)) {
      // Known already, cell for cell: nothing new.
      const known = of.get(cells[0]);
      if (!known || known.length !== cells.length) this.enter(cells);
    }
    this.retighten();
    this.discover(this.taken.splice(0), 600, this.walked);
    this.reelIfRound();
    // A dot on the map stays until the thing it marks is gone: cut, hauled, or turned into something else.
    const marks = this.S.marks;
    if (marks.length && marks.some(m => { const k = w.laid(m[0]); return k >= 0 && k !== m[1]; })) this.S.marks = marks.filter(m => { const k = w.laid(m[0]); return k < 0 || k === m[1]; });
    // (The book lets go of the pieces that are no longer loose: a piece hauled is not held on to by it.)
    of.keep?.(this.pieces);
  }
  // A piece of loose ground goes into the books. Ground known as loose before that lies within it is part of it now.
  // (A drift's boulder: its drift is one whose boulders are in the books, until the drill is well away: `driftsOut`.)
  enter(cells) {
    const of = this.pieceOf, within = new Set();
    for (const c of cells) { const piece = of.get(c); if (piece) within.add(piece); of.set(c, cells); }
    if (within.size) this.pieces = this.pieces.filter(piece => !within.has(piece));
    this.pieces.push(cells);
    const w = this.world, i = cells[0];
    if (w.row(i).pocket?.twist === 'drift') { const Z = w.pocketOf(i % N, Math.floor(i / N)); if (Z !== null && Z.row === w.b(i)) this.drifts.set(Z.key, Z); }
  }
  // The drill has come into a drift: every boulder that stands in it is in the books of loose ground from now,
  // seen or not, and shows its edge through the dark. What stands there is asked of the cells themselves, each
  // looked at as ground that comes into view is (`spot`): the pocket's record says only where to look.
  driftIn(Z) {
    const w = this.world, most = Math.ceil(Z.reach);
    for (let y = Z.cy - most; y <= Z.cy + most; y++) for (let x = Z.cx - most; x <= Z.cx + most; x++) {
      const i = y * N + x;
      if (w.k(i) !== K.EMPTY && w.b(i) === Z.row) this.spot(i);
    }
    this.drifts.set(Z.key, Z);
  }
  // The drifts whose boulders are in the books and that the drill has left behind, out of the drift and AWAY
  // cells further off than the screen shows: their boulders go out of the books, so that the books hold no more
  // for every drift crossed. A boulder the tether lies against stays (the lasso may yet close on it), and its
  // drift is asked about again. A boulder left out is no less loose: it is found again when it next comes into
  // view, when the drill comes back in, or when the tether is drawn round it (`spot`, `discover`, `sweepHome`).
  driftsOut() {
    const w = this.world, d = this.drill, of = this.pieceOf, away = Math.hypot(this.W, this.H) / 2 / T + AWAY;
    for (const [key, Z] of this.drifts) {
      if (key === this.placeKey || Math.hypot(Z.cx + 0.5 - d.x, Z.cy + 0.5 - d.y) <= Z.reach + away) continue;
      const held = new Set(), most = Z.reach + 1;
      for (const b of this.band) { const piece = b[3] === undefined ? undefined : of.get(b[3]); if (piece) held.add(piece); }
      let kept = false;
      this.pieces = this.pieces.filter(cells => {
        // (Only a piece that lies wholly in this drift's own ground: a boulder, or what is left of one.)
        const x = cells[0] % N - Z.cx, y = Math.floor(cells[0] / N) - Z.cy;
        if (x > most || x < -most || y > most || y < -most || cells.length > 64 || !cells.every(c => w.b(c) === Z.row)) return true;
        if (held.has(cells)) { kept = true; return true; }
        for (const c of cells) if (of.get(c) === cells) of.delete(c);
        return false;
      });
      if (!kept) this.drifts.delete(key);
    }
  }
  // One cell of ground is looked at: is it part of an island nobody knew, ground the world itself made standing
  // free or that grew in the open? If so the island is entered among the loose pieces. Only ground the world has
  // already made is asked about, and what the outline walks learn is kept (`World.isle`), so asking again costs a
  // look. Returns whether an island was found.
  spot(i) {
    const w = this.world, kind = w.laid(i);
    if (kind <= K.EMPTY || kind === K.BEDROCK) return false;
    let known = false;
    for (let s = 0; s < 4; s++) {
      if (w.laid(i + SIDE[s]) !== K.EMPTY) continue;
      if (!known) { if (this.pieceOf.has(i)) return false; known = true; }
      if (!w.isle(i, s, 600)) continue;
      const cells = w.pieceIn(i, -Infinity, -Infinity, Infinity, Infinity, Infinity);
      if (cells) this.enter(cells);
      return !!cells;
    }
    return false;
  }
  // Ground can come to lie inside the tether's loop without the string ever touching it. The string itself never
  // passes over ground; the loop is closed by the straight line home, and that line does. So whatever ground the
  // line home passes over as the drill moves is looked at (`spot`): an island among it is known from then on, and
  // is reeled in when the loop is right round it. With no bend the line home is the string, which catches on all
  // it meets, and nothing is looked at. Returns whether an island was found.
  sweepHome(due) {
    const d = this.drill, a = this.homeEnd, b = [d.x, d.y];
    if (this.band.length < 3) { this.homeEnd = b; return false; }
    const far = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!(far >= 1 || (due && far > 0))) return false;
    this.homeEnd = b;
    // The triangle between the core and the two ends, a row at a time (a column, where the line runs flatter).
    const rows = Math.abs(b[1] - HY) >= Math.abs(b[0] - HX), M = rows ? 1 : 0, m = 1 - M, H = [HX, HY];
    const from = Math.floor(Math.min(H[M], a[M], b[M])), to = Math.floor(Math.max(H[M], a[M], b[M]));
    const slopeA = a[M] !== H[M] ? (a[m] - H[m]) / (a[M] - H[M]) : 0, slopeB = b[M] !== H[M] ? (b[m] - H[m]) / (b[M] - H[M]) : 0;
    const loA = Math.min(H[M], a[M]), hiA = Math.max(H[M], a[M]), loB = Math.min(H[M], b[M]), hiB = Math.max(H[M], b[M]);
    let found = false;
    for (let v = from; v <= to; v++) {
      // Where each of the two lines lies across this row: at its top and bottom, no further than the line goes.
      const a0 = H[m] + slopeA * (Math.max(loA, Math.min(hiA, v)) - H[M]), a1 = H[m] + slopeA * (Math.max(loA, Math.min(hiA, v + 1)) - H[M]);
      const b0 = H[m] + slopeB * (Math.max(loB, Math.min(hiB, v)) - H[M]), b1 = H[m] + slopeB * (Math.max(loB, Math.min(hiB, v + 1)) - H[M]);
      let lo = Math.min(a0, a1, b0, b1), hi = Math.max(a0, a1, b0, b1);
      // (A line that runs along the row has no slope to go by: its end is where it reaches.)
      if (a[M] === H[M] && v === from) { lo = Math.min(lo, a[m], H[m]); hi = Math.max(hi, a[m], H[m]); }
      if (b[M] === H[M] && v === from) { lo = Math.min(lo, b[m], H[m]); hi = Math.max(hi, b[m], H[m]); }
      for (let u = Math.floor(lo), end = Math.floor(hi); u <= end; u++) if (this.spot(rows ? v * N + u : u * N + v)) found = true;
    }
    return found;
  }
  // What is left of a loose piece that has lost cells (`lost`; null: any of its cells may have gone), as a list of
  // pieces. One cell cut from it nearly always leaves it whole: it does if the cells that stood beside the cut are
  // on one outline, walked from the sides that face the cut, and then the cell is taken out and nothing else is
  // looked at. Otherwise what is left is followed, cell by cell, into its pieces; the largest keeps the piece's own
  // list, so only the smaller ones are entered afresh.
  split(cells, lost) {
    const w = this.world, of = this.pieceOf;
    if (lost) for (const i of lost) of.delete(i);
    else if (cells.every(i => w.k(i) !== K.EMPTY)) return [cells];
    if (lost && lost.length >= cells.length) return [];
    this.boxes.delete(cells);
    if (lost && lost.length === 1) {
      const i = lost[0], sides = [];
      for (let s = 0; s < 4; s++) if (of.get(i + SIDE[s]) === cells) sides.push((i + SIDE[s]) * 4 + ((s + 2) & 3));
      if (sides.length && (sides.length === 1 || w.oneOutline(sides, 400))) { cells.splice(cells.indexOf(i), 1); return [cells]; }
    }
    const left = new Set();
    for (const c of cells) { if (w.k(c) !== K.EMPTY && of.get(c) === cells) left.add(c); else if (of.get(c) === cells) of.delete(c); }
    const parts = [];
    let most = 0;
    for (const start of left) {
      const part = [start];
      left.delete(start);
      for (let head = 0; head < part.length; head++) for (const s of SIDE) if (left.delete(part[head] + s)) part.push(part[head] + s);
      if (part.length > parts[most]?.length) most = parts.length;
      parts.push(part);
    }
    if (!parts.length) return [];
    cells.length = 0;
    for (const c of parts[most]) cells.push(c);
    parts[most] = cells;
    for (const part of parts) if (part !== cells) for (const c of part) of.set(c, part);
    return parts;
  }
  // Every loose cell in one list (for tests: nothing in the game needs it).
  get loose() { return this.pieces.flat(); }
  set loose(cells) {}
  // Ground the tether lies against that hangs on nothing, though nobody knew it: a wreck in its hollow, a rock
  // standing free in a cavern, a piece cut loose before the game was loaded. The ground of each of these bends is
  // looked at by walking its outline, `most` sides at the most (`World.island`), and an island is taken in among the
  // loose pieces, no more than `limit` cells of it. `walked` is shared between looks while the ground stays as it
  // is, so the same wall is not walked again for every bend on it. Returns whether anything was found.
  discover(bends, most, walked, limit = Infinity) {
    const w = this.world;
    let found = false;
    for (const b of bends) {
      const i = b[3];
      if (i === undefined || this.pieceOf.has(i) || w.k(i) === K.EMPTY) continue;
      // The side of the bend's cell that faces open ground, beside its corner.
      const east = b[4] & 1, south = (b[4] >> 1) & 1;
      const face = w.k(i + (east ? 1 : -1)) === K.EMPTY ? (east ? 0 : 2) : w.k(i + (south ? N : -N)) === K.EMPTY ? (south ? 1 : 3) : -1;
      if (face < 0 || !w.island(i, face, most, null, walked)) continue;
      const cells = w.pieceIn(i, -Infinity, -Infinity, Infinity, Infinity, limit);
      if (!cells) continue;
      this.enter(cells); found = true;
    }
    return found;
  }
  // The box a piece lies in, [x0, y0, x1, y1], worked out once for each.
  boxOf(cells) {
    let box = this.boxes.get(cells);
    if (!box) {
      box = [Infinity, Infinity, -Infinity, -Infinity];
      for (const i of cells) { const x = i % N, y = Math.floor(i / N); if (x < box[0]) box[0] = x; if (y < box[1]) box[1] = y; if (x > box[2]) box[2] = x; if (y > box[3]) box[3] = y; }
      this.boxes.set(cells, box);
    }
    return box;
  }
  // A loose piece is lassoed once the tether has gone far enough round it that the straight way home would close
  // the loop: it is reeled in there and then.
  reelIfRound() {
    const pts = this.band;
    // (The loops of a wreck's tether are dropped as it is wound in: nothing is hauled by a dead drill.)
    if (!this.pieces.length || pts.length < 3 || this.drill.mode === 'dead') return;
    // How many times the tether, closed by the straight line from the core back to the drill, winds round a point.
    const winds = (x, y) => {
      let turns = 0;
      for (let n = 0; n < pts.length; n++) {
        const a = pts[n], b = pts[(n + 1) % pts.length];
        if (a[1] <= y) { if (b[1] > y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) > 0) turns++; }
        else if (b[1] <= y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) < 0) turns--;
      }
      return turns;
    };
    const inside = i => winds((i % N) + 0.5, Math.floor(i / N) + 0.5) !== 0;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, crossed = null;
    for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[0] > x1) x1 = p[0]; if (p[1] > y1) y1 = p[1]; }
    // Everything the tether is round goes in as one haul: every piece all of whose cells are wound.
    //
    // The tether itself never passes between two cells of one piece, so by the tether alone the whole of a piece is
    // wound alike. Only the straight line home can divide a piece, and it does so only between cells it runs
    // through or beside. So a piece is wound whole when its first cell is, and with it every cell of the piece that
    // the line home runs through and every neighbour of those: nothing else is asked about, however large the piece.
    // A piece whose box lies clear of the tether's is not asked about at all.
    const round = this.pieces.filter(cells => {
      const box = this.boxOf(cells);
      if (box[0] > x1 || box[2] + 1 < x0 || box[1] > y1 || box[3] + 1 < y0 || !inside(cells[0])) return false;
      if (crossed === null) {
        crossed = new Map();
        for (const c of cellsAlong(HX, HY, pts[0][0], pts[0][1])) { const piece = this.pieceOf.get(c); if (piece) { if (!crossed.has(piece)) crossed.set(piece, []); crossed.get(piece).push(c); } }
      }
      for (const c of crossed.get(cells) ?? []) {
        if (!inside(c)) return false;
        for (const j of [c + 1, c - 1, c + N, c - N]) if (this.pieceOf.get(j) === cells && !inside(j)) return false;
      }
      return true;
    });
    // The winch draws in all of it, however much that is: a piece over the winch's load pays less a cell for it
    // (`overload`), and nothing more is held back. (It drew in forty times its load and no more, and said TOO BIG of
    // the rest: half the longest reach could never be hauled.) No cell is handed over twice: a cell goes with the
    // piece the book says it is in. And never a haul of nothing.
    const of = this.pieceOf, cells = [];
    for (const piece of round) for (const c of piece) if (of.get(c) === piece) cells.push(c);
    if (!cells.length) return;
    // How much the loop is round, in cells: what is hauled may be half of everything (`HALF`).
    let area = 0;
    for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
    this.haul(cells, Math.abs(area) / 2);
    this.changed(cells);
  }
  // The tether lets the drill go this far from the core and no further, whatever road it takes.
  within(x, y) { return Math.hypot(x - HX, y - HY) <= this.val('tether') + 0.3; }
  // Is the cell the bit is pressed into (`i`; -1 for none, when the ground the drill stands in says) ploughed: its
  // ground cuts like air (PLOUGH), or the late bit goes through it in a blink (PLOUGH_BIT) and it is plain ground?
  ploughs(i) {
    const w = this.world;
    if (w.row(i >= 0 ? i : this.di).dig < PLOUGH) return true;
    const blink = PLOUGH_BIT[this.S.lv.drill] ?? 0;
    return blink > 0 && i >= 0 && this.cutTime(w.k(i), w.row(i)) <= blink && this.ploughable(i);
  }
  // Plain ground, which the late bit may plough: rock, ore, ice, basalt, slag, steel, slate, glass and faults
  // (`CRUSH`, what a rare hazard may open), in no pocket, no hazard, and no part of a find as the world laid it (a
  // geode's shell and its ore, a prism's ore round it), so the drill stops at each of those as it always has.
  ploughable(i) {
    const w = this.world;
    return CRUSH[w.k(i)] && w.row(i).pocket === null && w.findAt(i % N, Math.floor(i / N)) < 0;
  }
  // How long a cell of kind `k` in ground `row` takes to cut with the bit the drill has: metal METAL times as long
  // without the diamond tip.
  cutTime(k, row) { return digTime(k, row) * (METALS.includes(k) && !this.S.lv.diamond ? METAL : 1) / SPEED[this.S.lv.drill]; }

  // ------------------------------------------------------------ flying and cutting
  free(x, y) {
    const w = this.world;
    for (const [u, v] of [[-BODY, -BODY], [BODY, -BODY], [-BODY, BODY], [BODY, BODY]]) {
      const i = Math.floor(y + v) * N + Math.floor(x + u);
      if (w.k(i) !== K.EMPTY || (w.lava.has(i) && !this.swims)) return false;
    }
    return true;
  }
  fly(dt) {
    const w = this.world, d = this.drill;
    this.flow.kind = null; this.flow.x = this.flow.y = 0;
    // A wreck is wound home by its tether, whatever the thumb does.
    if (d.mode === 'dead') { this.dying(dt); return; }
    let [ix, iy, m] = this.steer();
    if (d.stun > 0 || this.shop || this.lab) m = 0;
    // Just reeled home: it stays put until the thumb lets go.
    if (d.park) { if (m === 0) d.park = false; m = 0; }
    // Ground that grew back round the drill never holds it. Should its own cell have closed, the cell is opened
    // again; then it is set in the middle of the cell it is in.
    if (d.mode === 'free' && !this.free(d.x, d.y)) {
      // (Lava that has poured on to its body burns the hull: a wreck is wound home from where it lies.)
      if (!this.swims && this.inLava(d.x, d.y) && this.hit(JOLT.burn) && d.mode === 'dead') return;
      const i = this.di, k = w.k(i);
      if (k !== K.EMPTY && HARD[k] < 99) {
        w.setK(i, K.EMPTY);
        if (w.row(i).freeze > 0) { w.dug.set(i, this.clock); this.frostOpen.push(i); }
        this.changed([i]);
      }
      if (w.k(i) === K.EMPTY && this.free(Math.floor(d.x) + 0.5, Math.floor(d.y) + 0.5)) {
        d.x = Math.floor(d.x) + 0.5; d.y = Math.floor(d.y) + 0.5;
        // No further out than the tether reaches, where it fits there, or as near to that as it fits (it is the
        // same cell still). Hemmed in by lava at the very end of its reach it may have to stand a little beyond.
        const out = this.far, R = this.val('tether'), cx = d.x, cy = d.y;
        if (out > R) for (let back = 1; back > 0; back -= 0.125) {
          const to = out + (R - out) * back, x = HX + (cx - HX) / out * to, y = HY + (cy - HY) / out * to;
          if (this.free(x, y)) { d.x = x; d.y = y; break; }
        }
        this.tend();
      }
    }
    d.px = d.x; d.py = d.y;
    const far = this.far;
    if (d.mode !== 'free') {
      // Thrown from the core, or being reeled home: straight to where it is going.
      const dx = d.tx - d.x, dy = d.ty - d.y, left = Math.hypot(dx, dy), ux = dx / (left || 1), uy = dy / (left || 1);
      d.ang = Math.atan2(dy, dx); d.vx = ux * d.speed; d.vy = uy * d.speed;
      // The way was open when it set off, and nothing closes on it while it flies (`updateHazards`). All the same
      // each frame's stretch is looked at before it is flown: were it shut, the drill stops at the last free place.
      let go = Math.min(left, d.speed * dt), shut = false;
      const cells = cellsAlong(d.x, d.y, d.x + ux * go, d.y + uy * go, 12000), open = new Set([cells[0]]);
      for (let n = 1; n < cells.length && !shut; n++) { if (w.k(cells[n]) !== K.EMPTY || (w.lava.has(cells[n]) && !this.swims)) shut = true; else open.add(cells[n]); }
      if (shut || (go === left && !this.free(d.tx, d.ty))) {
        shut = true;
        while (go > 0 && !(open.has(Math.floor(d.y + uy * go) * N + Math.floor(d.x + ux * go)) && this.free(d.x + ux * go, d.y + uy * go))) go = Math.max(0, go - 0.1);
      }
      if (!shut && go === left) { d.x = d.tx; d.y = d.ty; } else { d.x += ux * go; d.y += uy * go; }
      if (shut || go === left) {
        d.vx = d.vy = 0;
        if (d.mode === 'home' && !shut) { sfx.dock(); this.ring(HX * T, HY * T, '#84dcff', 30); d.armed = false; d.park = true; }
        else { sfx.thud(); this.land(); d.squash = 0.12; }
        d.mode = 'free'; d.run = 0;
      }
      this.tend();
      this.look();
      return;
    }
    if (m > 0) {
      // The drill turns to face the way it is steered, quickly but not at once.
      let turn = Math.atan2(iy, ix) - d.ang;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      d.ang += turn * Math.min(1, dt * 18);
      // From the very middle of the core a fresh stroke throws it, straight out along the drag.
      if (far < 0.3 && d.armed && m > 0.5) { d.armed = false; if (this.fling(ix, iy)) return; }
      d.armed = false;
      d.run = Math.min(12, d.run + dt);
    } else d.run = 0;
    // Speed builds over a long clear run, so far ground is not a long walk.
    // (A leech on the hull drags: `fauna.drag` is 1 but while one is on, js/fauna.js.)
    const top = FLY * this.val('momentum') * (this.boost > 0 ? BOOST.by : 1) * (1 + Math.max(0, d.run - 0.8) * 0.9) * m * this.fauna.drag, ease = Math.min(1, dt * (m > 0 ? 14 : 10));
    // In a deep strain whose air flows (`CURRENT`), the flow leans on where the drill is steered: only with the
    // thumb down and the drill in open ground, so it never drifts on its own, nor while it cuts.
    const row = w.row(this.di), flow = this.flow, cur = row.current !== null && CURRENT[row.current] !== undefined ? row.current : null;
    flow.kind = cur; flow.x = flow.y = 0;
    if (cur !== null) w.flowAt(d.x, d.y, cur, flow);
    // It leans as hard as the thumb steers (`m`), so that steered against it, however lightly, the drill still goes
    // the way it is steered, more slowly (at the same lean whatever the thumb, a thumb a few pixels from where it came
    // down was carried backward).
    const lean = cur !== null && m > 0 && d.dig < 0 && w.k(this.di) === K.EMPTY ? CURRENT[cur] * FLY * this.val('momentum') * m : 0;
    d.vx += (ix * top + flow.x * lean - d.vx) * ease; d.vy += (iy * top + flow.y * lean - d.vy) * ease;
    // Move a little at a time, sliding along whatever stops it. The string follows the small moves (`tend`), so it
    // goes round whatever the drill went round: a move this small never leaves the open ground the drill stands in,
    // where one straight line across a whole frame's flight could pass the far side of a corner.
    //
    // Small moves that were not stopped, slid or drawn back all go the same way, so together they are one straight
    // line through open ground, and the string is led along the whole run of them at once (`run`): the same sweep
    // as leading it move by move, made once. Far out with no bend that sweep is about the core, as long as the
    // tether, and a fast flight makes a dozen small moves a frame.
    const speed = Math.hypot(d.vx, d.vy), steps = Math.max(1, Math.ceil(speed * dt / 0.3)), R = this.val('tether');
    let hitX = false, hitY = false, held = false, run = false;
    for (let n = 0; n < steps; n++) {
      const sx = d.x, sy = d.y, nx = d.x + d.vx * dt / steps, ny = d.y + d.vy * dt / steps;
      let plain = true;
      if (this.free(nx, d.y)) d.x = nx; else { hitX = true; plain = false; }
      if (this.free(d.x, ny)) d.y = ny; else { hitY = true; plain = false; }
      // The end of the tether's reach: a move that ends beyond it is drawn back on to it. The reach never pins the
      // drill, though. Should it stand beyond the reach already (set in the middle of a cell out there when ground
      // grew back on it) and the place drawn back to be shut, any move that takes it no further out stands: so it
      // can always come back in, or be pushed against what is in its way there and cut it.
      const out = Math.hypot(d.x - HX, d.y - HY);
      if (out > R) {
        const mx = d.x, my = d.y, was = Math.hypot(sx - HX, sy - HY);
        d.x = HX + (mx - HX) / out * R; d.y = HY + (my - HY) / out * R;
        if (!this.free(d.x, d.y)) {
          if (out <= was) { d.x = mx; d.y = my; }
          else if (mx !== sx && Math.hypot(mx - HX, sy - HY) <= was) { d.x = mx; d.y = sy; }
          else if (my !== sy && Math.hypot(sx - HX, my - HY) <= was && this.free(sx, my)) { d.x = sx; d.y = my; }
          else { d.x = sx; d.y = sy; }
        }
        held = true; plain = false;
      }
      if (plain) { run = true; continue; }
      // This move turned off the line of the run before it: the string goes to where the run ended, then on.
      if (run) { this.lead(this.band, [sx, sy]); run = false; }
      this.tend();
    }
    if (run) this.tend();
    if (held) {
      if (m > 0 && (d.vx * (d.x - HX) + d.vy * (d.y - HY)) > 0 && this.edge <= 0) this.refuse();
      d.run = 0;
    }
    // (Pushed against lava the drill is only stopped, as by rock: lava burns what cuts into it and what it pours on
    // to, not what leans on it. It did burn, and a drill hemmed in by lava was lost for trying to move.)
    // Pushed into ground, it cuts.
    if (m > 0 && (hitX || hitY)) {
      // A cut in progress goes on while the drill is still pressed into that cell and the stick has not turned from
      // where it was when the cut began (a new direction cancels it). In a notch, pushed into two cells at once on
      // the diagonal, which of them the stick favours changes with a hair's turn of the thumb, and with the drill's
      // own squaring up to the cell it cuts: without this neither would ever be cut through.
      const i = this.bite(ix, iy, hitX, hitY, d.dig >= 0 && ix * d.digX + iy * d.digY > 0.94 ? d.dig : -1);
      // Ground that cuts like air is ploughed (`PLOUGH`): the run goes on through it, and the drill is not drawn
      // square on to each block of it, or cells gone in a twentieth of a second would stutter, not plough. (Sliding
      // past a block at speed, the drill may be stopped by one that is no longer before the bit when the frame
      // ends: in ploughed ground, which is the ground it stands in when there is no cell to say, that does not
      // break its run either. With a bit that cuts ash in one frame it happens several times a second.)
      // (And from MK6 on, ground the bit goes through in a blink: `ploughs`. What time the last cut had left over in
      // its frame the next cell begins with, where both are ploughed by the late bit; otherwise it begins at none.)
      const plough = this.ploughs(i), carry = d.carry, late = plough && this.S.lv.drill >= 5;
      d.carry = 0;
      if (!plough) d.run = 0;
      if (i < 0) { d.dig = -1; if (hitX) d.vx = 0; if (hitY) d.vy = 0; }
      else {
        const k = w.k(i);
        if (HARD[k] >= 99) {
          if (this.time - (this.lastClink ?? -1) > 0.35) { this.lastClink = this.time; sfx.clink(); d.squash = 0.12; this.effect('sparks', 'sparks', (d.x + ix * 0.5) * T, (d.y + iy * 0.5) * T); }
          d.dig = -1;
        } else if (!this.within((i % N) + 0.5, Math.floor(i / N) + 0.5)) { if (this.edge <= 0) this.refuse(); d.dig = -1; }
        else {
          if (d.dig !== i) { d.dig = i; d.digT = late ? carry : 0; d.digDur = this.cutTime(k, w.row(i)); d.digX = ix; d.digY = iy; this.foresee(i, this.alsoOpens(i)); }
          const before = d.digT;
          d.digT += dt;
          if (((d.digT * 30) | 0) !== ((before * 30) | 0) && d.digDur > 0.15) { sfx.grind(); if (d.digDur > 0.4) this.shake = Math.max(this.shake, 1.2); }
          if (((d.digT * 18) | 0) !== ((before * 18) | 0)) this.chips(i % N, Math.floor(i / N), this.debris(k, w.b(i)), 2, d.ang, 0.6);
          // Cutting draws the drill square on to the block, so tunnels come out clean: never past the tether's reach.
          // (Not in ground that is ploughed: there the cut goes where the thumb draws it.)
          const cx = (i % N) + 0.5, cy = Math.floor(i / N) + 0.5, inReach = (x, y) => { const to = Math.hypot(x - HX, y - HY); return to <= R || to <= Math.hypot(d.x - HX, d.y - HY); };
          if (plough) { /* no squaring up */ }
          else if (Math.abs(cx - d.x) > Math.abs(cy - d.y)) { const ny = d.y + (cy - d.y) * Math.min(1, dt * 6); if (this.free(d.x, ny) && inReach(d.x, ny)) d.y = ny; }
          else { const nx = d.x + (cx - d.x) * Math.min(1, dt * 6); if (this.free(nx, d.y) && inReach(nx, d.y)) d.x = nx; }
          this.tend();
          if (d.digT >= d.digDur) {
            // (No more than a frame's time is carried, however quick the cut: a cell a frame is the most there is.)
            const left = Math.min(dt, d.digT - d.digDur);
            this.finishDig(i, plough);
            if (late && d.mode !== 'dead') d.carry = left;
          }
        }
      }
    } else { if (d.dig >= 0) this.preview = []; d.dig = -1; d.carry = 0; }
    // (The cut may have been into a hazard, and the blow the hull's last.)
    if (d.mode === 'dead') { this.look(); return; }
    // Close to the core and heading in, the tether takes over and reels the drill the rest of the way home.
    const near = this.far;
    if (d.mode === 'free' && m > 0 && near < 3.3 && near > 0.4 && (d.vx * (HX - d.x) + d.vy * (HY - d.y)) > 0.5 * speed * near && near < far + 1e-6 && sight(w, d.x, d.y, HX, HY)) {
      d.mode = 'home'; d.tx = HX; d.ty = HY; d.speed = 22; sfx.slide(3);
    }
    if (m > 0 && speed > 1) this.S.stats.moves += dt;
    this.look();
  }
  // The cell the bit is pressed into: the ground that stopped it, on the side it is being pushed. `keep` is a cell
  // to stay with if it is among them (the cut in progress).
  bite(ix, iy, hitX, hitY, keep = -1) {
    const w = this.world, d = this.drill, reach = BODY + 0.3, tries = [];
    const sx = Math.sign(ix) || 1, sy = Math.sign(iy) || 1;
    const across = [[d.x + sx * reach, d.y], [d.x + sx * reach, d.y - BODY], [d.x + sx * reach, d.y + BODY]];
    const down = [[d.x, d.y + sy * reach], [d.x - BODY, d.y + sy * reach], [d.x + BODY, d.y + sy * reach]];
    if (hitX && (!hitY || Math.abs(ix) >= Math.abs(iy))) tries.push(...across, ...(hitY ? down : []));
    else tries.push(...down, ...(hitX ? across : []));
    let first = -1;
    for (const [x, y] of tries) {
      const i = Math.floor(y) * N + Math.floor(x);
      if (w.k(i) === K.EMPTY) continue;
      if (keep < 0 || i === keep) return i;
      if (first < 0) first = i;
    }
    return first;
  }
  // Does a body standing at (x, y) lie in lava?
  inLava(x, y) {
    const w = this.world;
    for (const [u, v] of [[-BODY, -BODY], [BODY, -BODY], [-BODY, BODY], [BODY, BODY]]) if (w.lava.has(Math.floor(y + v) * N + Math.floor(x + u))) return true;
    return false;
  }
  // From the core the drill can be thrown at any angle: it flies straight along the drag until ground, lava or
  // the end of its reach stops it. Returns false when it cannot leave that way.
  fling(ix, iy) {
    const w = this.world, d = this.drill, R = this.val('tether');
    const cells = cellsAlong(HX, HY, HX + ix * R, HY + iy * R, 12000);
    let last = -1;
    for (let n = 1; n < cells.length; n++) {
      const i = cells[n];
      if (w.k(i) !== K.EMPTY || (w.lava.has(i) && !this.swims) || !this.within((i % N) + 0.5, Math.floor(i / N) + 0.5)) break;
      last = n;
    }
    if (last < 2) return false;
    // As far along the drag as the last open cell lets the drill's middle go.
    // It stays on the line of the drag: where its body would not fit, it stops a little short instead.
    const lx = (cells[last] % N) + 0.5, ly = Math.floor(cells[last] / N) + 0.5;
    let along = (lx - HX) * ix + (ly - HY) * iy;
    while (along > 0.5 && !this.free(HX + ix * along, HY + iy * along)) along -= 0.1;
    if (along <= 0.5) return false;
    d.tx = HX + ix * along; d.ty = HY + iy * along;
    d.mode = 'fling'; d.speed = Math.max(34, along / 0.55); d.ang = Math.atan2(iy, ix);
    sfx.slide(Math.min(12, along));
    return true;
  }
  // What the drill sees from where it is, and what being home does.
  look() {
    const d = this.drill, cell = this.di;
    if (cell !== d.cell) {
      const r = this.val('scanner'), x = Math.floor(d.x), y = Math.floor(d.y), px = d.cell < 0 ? -1e9 : d.cell % N, py = d.cell < 0 ? -1e9 : Math.floor(d.cell / N);
      d.cell = cell;
      // (And with a lamp bought, its light across open ground: `lampSees`.)
      const scanned = this.world.see(x, y, r), lit = this.S.lv.lamp >= 1 && this.lampSees(x, y);
      if (scanned || lit) this.version++;
      // Ground that has come into view is looked at: an island among it is known as loose from the first sight.
      for (let v = y - r; v <= y + r; v++) for (let u = x - r; u <= x + r; u++) if (Math.abs(u - px) > r || Math.abs(v - py) > r) this.spot(v * N + u);
      this.arrive(cell);
      if (this.drifts.size) this.driftsOut();
    }
    if (this.world.spotted.length) this.callOut();
    const home = this.atCore;
    // (And says so where what it was saving for can be paid for now, and chooses that again: js/goal.js.)
    if (home && !d.home) { this.homecoming(); goalHome(this); this.save(); }
    // Riding on to the core mends the hull.
    if (home && this.dents && d.mode !== 'dead') this.mend();
    // Leaving the core is the docking the game goes back to if the drill is lost: everything up to now is kept.
    if (!home && d.home) this.dockMark();
    d.home = home;
  }
  // The lamp's light falls across open ground as far as it reaches (its value, in cells), and the drill sees what it
  // falls on as the scan sees what lies in the rock round it: a cavern's far wall, a hazard, a prism or a cache in
  // it are drawn and called out from across the cave. Each of RAYS rays from the middle of the drill's cell goes
  // on through open ground, lighting the four cells beside each open cell it crosses, and stops at the first cell
  // of ground it meets (lit already, beside the last open one). (It lit only the cells the rays crossed: past ten
  // cells out a stone could stand between two rays and never be seen.) Asked when the drill comes into another
  // cell (`look`), of a table made once; nothing is made. Returns whether anything was seen anew.
  lampSees(x, y) {
    const w = this.world, { steps, ends } = rays(Math.floor(this.val('lamp')));
    let fresh = false;
    for (let r = 0, n = 0; r < RAY_COUNT; n = ends[r++]) {
      for (; n < ends[r]; n += 2) {
        const u = x + steps[n], v = y + steps[n + 1];
        if (w.k(v * N + u) !== K.EMPTY) break;
        if (w.seeCell(u + 1, v)) fresh = true;
        if (w.seeCell(u - 1, v)) fresh = true;
        if (w.seeCell(u, v + 1)) fresh = true;
        if (w.seeCell(u, v - 1)) fresh = true;
      }
    }
    return fresh;
  }
  // The place a cell lies in: the row of its ground, and the key the place is known by. A pocket is a place of
  // its own (`zone`: the world's record of it), so two pockets of one kind are two places; any other ground is one
  // place wherever it lies. What ground a cell is, the cell itself says.
  placeAt(i) {
    const w = this.world, row = w.row(i);
    const zone = row.pocket ? w.zoneOf(Math.floor(((i % N) - C) / ZONE), Math.floor((Math.floor(i / N) - C) / ZONE)) : null;
    return { key: zone ? zone.key : row.id, row, zone };
  }
  // The drill has come into another cell. If that is another place, its name comes up: on a plate under the top
  // bar with its direction's gem beside it (and, where its rich ore pays another direction's gems, as a cross's
  // does, that gem after it), or, the first time ever that this ground is met, alone across the screen. The name
  // and nothing more.
  arrive(i) {
    const here = this.placeAt(i);
    if (here.key === this.placeKey) return;
    this.placeKey = here.key;
    const S = this.S, row = here.row, card = !S.met[row.id];
    S.met[row.id] = 1;
    if (here.zone) S.visited[here.key] = 1;
    // (In a drift everything lies loose already, and is in the books from the moment the drill comes in.)
    if (here.zone && row.pocket.twist === 'drift') this.driftIn(here.zone);
    // (A pocket's plate has its mineral on it, where the mineral has a picture; any other place its direction's gem.)
    this.place = { title: row.title, icon: GEM_ICON[row.kin] ?? 'grit', mineral: this.mineralOf(row), also: row.gemB !== row.kin ? GEM_ICON[row.gemB] ?? null : null, colour: bright(row.map), t: 0, card, life: card ? CARD : PLATE };
    // (A border that wanders is crossed many times in a few cells: the name changes each time, the sound does not.)
    if (card) sfx.arrive(row); else if (this.time - this.motifAt > PLATE) sfx.place(row);
    this.motifAt = this.time;
  }
  // The name of a ground's mineral, where it is a pocket's and the mineral has a picture on the 'minerals' sheet:
  // null otherwise. And that picture drawn, twelve pixels square with its corner at (x, y).
  mineralOf(row) { const name = row.pocket?.mineral; return name && sheets.minerals?.frames[name] ? name : null; }
  drawMineral(ctx, name, x, y) { const r = sheets.minerals.frames[name]; ctx.drawImage(sheets.minerals.image, r[0] + 2, r[1] + 2, 12, 12, Math.round(x), Math.round(y), 12, 12); }
  // Things seen for the first time are called out: a ring spreading from the thing, its name, a few notes, and a
  // dot on the map that stays until it is gone (but for wrecks and relics, which the map shows anyway). One call
  // for each thing, however many of its cells come into view and however often (a thing is known by what it is and
  // the sector of FIND cells its middle lies in), and no more than one of a kind every three seconds: what comes
  // sooner still gets its dot. The map holds MARKS dots, and one more pushes out the oldest; but the geodes a druse
  // rings (`resonant`: a dozen and more at once) take only the room there is, and are the first to make room for
  // anything seen after (they pushed out half the map's dots of things still standing at a stroke).
  callOut() {
    const w = this.world, S = this.S;
    for (const [what, seen, mid] of w.spotted.splice(0)) {
      const x = mid % N, y = Math.floor(mid / N), key = `${what}:${Math.floor((x - C) / FIND)},${Math.floor((y - C) / FIND)}`, rung = this.rung.has(key);
      if (this.called.has(key)) continue;
      this.called.add(key);
      // (A rare hazard called out is met: what it does to the drill is on the panel from now on.)
      if (HAZARDS[what]?.rare) (S.rare ??= {})[what] = 1;
      // The cell the thing is marked by is one that goes when it is taken: a geode's is a cell of its ore.
      const cell = what === 'geode' && w.k(mid + 1) === K.ORE_B ? mid + 1 : seen, kind = w.k(cell);
      if (kind === K.EMPTY || S.marks.some(m => m[0] === cell)) continue;
      // (A shrine's heart is a relic's kind, and is told as a shrine.)
      const row = w.row(seen), dir = w.relicAt.indexOf(seen), shrine = what === 'relic' && dir < 0 ? w.shrineAt.indexOf(seen) : -1;
      const name = what === 'mineral' ? (row.pocket?.mineral ?? SPOT.mineral[0]).toUpperCase() : shrine >= 0 ? SPOT.shrine[0] : SPOT[what][0];
      const colour = what === 'mineral' ? bright(row.map) : what === 'relic' && dir >= 0 ? GEM_COLOR[DIR_BIOME[dir]] : shrine >= 0 ? SPOT.shrine[1] : SPOT[what][1];
      if (rung) { if (S.marks.length < MARKS) S.marks.push([cell, kind, colour, 1]); }
      else if (what !== 'wreck' && what !== 'relic') {
        S.marks.push([cell, kind, colour]);
        if (S.marks.length > MARKS) { const old = S.marks.findIndex(m => m[3] === 1); S.marks.splice(old >= 0 ? old : 0, 1); }
      }
      if (this.time - (this.calledAt[what] ?? -9) < 3) continue;
      this.calledAt[what] = this.time;
      this.ring((x + 0.5) * T, (y + 0.5) * T, colour, 30);
      this.sparkle((x + 0.5) * T, (y + 0.5) * T, 5, colour);
      this.popup(x, y - 1, name, colour);
      sfx.spot(what);
    }
    // (What a ring showed is all called out by now: a geode rung that was in view already is not told as rung later.)
    if (this.rung.size) this.rung.clear();
  }
  // A wreck nobody has claimed, within hearing, ticks: softly, and quicker the nearer the drill is to it.
  listen(dt) {
    const w = this.world, d = this.drill, held = this.S.wrecks ?? [], spots = w.wrecks;
    let near = HEAR;
    for (let n = 0; n < spots.length; n++) {
      if (held[n]) continue;
      const far = Math.hypot(spots[n][0] + 0.5 - d.x, spots[n][1] + 0.5 - d.y);
      // (The wreck itself must be there, where the world has been made: one that is on its way home is not.)
      if (far < near && w.laid(spots[n][1] * N + spots[n][0]) !== K.EMPTY) near = far;
    }
    if (near >= HEAR) { this.tickIn = 0; return; }
    this.tickIn -= dt;
    if (this.tickIn > 0) return;
    this.tickIn = 0.22 + 1.4 * near / HEAR;
    this.ticks++;
    sfx.ping(1 - near / HEAR);
  }
  // Home with the tether still wound round something: ground it lies against that nobody knew was loose is found
  // now (`discover`) and what the tether is round is reeled in. Reeling lets the string settle on whatever lay
  // inside, so the search is made again until it finds nothing new. Nothing is flooded to find out: only outlines
  // are walked, no further than a piece the loop could hold would need, one wall once for all the bends on it, and
  // not at all when neither the tether nor the ground has changed since the last time home.
  homecoming() {
    for (let pass = 0; pass < 64 && this.band.length > 2; pass++) {
      const P = this.band, key = `${this.cuts}:${P.map(b => b[4] ?? '').join(',')}`;
      if (key === this.homeKey) return;
      this.homeKey = key;
      // The most ground the closed tether could be round: no more than the triangles it makes with the core cover,
      // and a cell's width along its length.
      let most = 8;
      for (let n = 0; n + 1 < P.length; n++) {
        const ax = P[n][0] - HX, ay = P[n][1] - HY, bx = P[n + 1][0] - HX, by = P[n + 1][1] - HY;
        most += Math.abs(ax * by - ay * bx) / 2 + 2 * Math.hypot(bx - ax, by - ay);
      }
      const hauls = this.S.stats.hauls;
      if (!this.discover(P.slice(1, -1), Math.min(40000, 4 * Math.ceil(most)), new Set(), Math.min(400000, Math.ceil(most)))) return;
      this.reelIfRound();
      if (hauls === this.S.stats.hauls) return;
    }
  }
  // The end of the tether's reach: say so, and show where the edge is.
  refuse() {
    const d = this.drill;
    this.twang = 0.45; this.edge = 1.2; sfx.twang(); d.squash = 0.14;
    this.popup(d.x - 0.5, d.y - 1, 'REACH', '#ff7a5a', 'tether');
  }
  // What a cut into cell `i` opens besides the cell itself, by the rule of the pocket it lies in (its row's
  // `twist`), as a list of cells:
  //   'pane'   a glaze's ice: the rest of the pane the cell is of, all but its mineral, which is left standing
  //   'plank'  a shale stack's rock, cut along the grain (the drill pushing level): up to three cells more of the
  //            same bed, as far as a seam of its mineral, the pocket's edge or the end of the reach
  // Never a cell past the tether's reach, and never one of another ground.
  alsoOpens(i) {
    const w = this.world, row = w.row(i), P = row.pocket;
    if (!P || (P.twist !== 'pane' && P.twist !== 'plank') || w.k(i) !== K.SOFT) return [];
    const x = i % N, y = Math.floor(i / N), mine = j => w.k(j) === K.SOFT && w.b(j) === row.id && this.within(j % N + 0.5, Math.floor(j / N) + 0.5);
    if (P.twist === 'pane') {
      const Z = w.pocketOf(x, y);
      return Z !== null && Z.row === row.id ? w.paneOf(Z, x, y).filter(j => j !== i && mine(j)) : [];
    }
    const d = this.drill, out = [];
    if (d.digX && !d.digY) for (let n = 1; n <= 3 && mine(i + d.digX * n); n++) out.push(i + d.digX * n);
    return out;
  }
  // A ring of fuse cut into burns: every cell of fuse joined to the cut (side to side or corner to corner) that the
  // tether can reach, nearest first, a few cells every twenty-fifth of a second (`burnFuses`), each going to
  // nothing with a spark. What the ring held then hangs on nothing.
  burn(i) {
    const w = this.world, b = w.b(i), seen = new Set([i]), cells = [];
    for (let head = -1, at = i; ; at = cells[head]) {
      for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) {
        const j = at + v * N + u;
        if (seen.has(j) || w.k(j) !== K.NODE || w.b(j) !== b || !this.within(j % N + 0.5, Math.floor(j / N) + 0.5)) continue;
        seen.add(j); cells.push(j);
      }
      if (++head >= cells.length || cells.length > 400) break;
    }
    if (cells.length) this.fuses.push({ cells, at: 0, t: 0 });
  }
  burnFuses(dt) {
    if (!this.fuses.length) return;
    const w = this.world, gone = [];
    for (const f of this.fuses) {
      f.t += dt;
      for (; f.t >= 0.04 && f.at < f.cells.length; f.t -= 0.04) for (let n = 0; n < 2 && f.at < f.cells.length; n++) {
        const j = f.cells[f.at++];
        if (w.k(j) !== K.NODE) continue;
        const x = j % N, y = Math.floor(j / N);
        w.setK(j, K.EMPTY); gone.push(j);
        this.effect('dust', 'dust', (x + 0.5) * T, (y + 0.5) * T);
        this.chips(x, y, ['#ffd84a', '#ff8a2a', '#fff6c8'], 4, null, 0.8);
      }
    }
    this.fuses = this.fuses.filter(f => f.at < f.cells.length);
    if (gone.length) { if (this.time - (this.lastFuse ?? 0) > 0.07) { this.lastFuse = this.time; sfx.hiss(); } this.changed(gone); }
  }
  // A fault cut (the mycelium's threads: ZIP): the faults beside it, side to side or corner to corner, wait their
  // turn to open, and each that opens sets the faults beside it waiting (`zipOn`), ZIP.most from this cut at the
  // most. The ring of cells waiting is the game's own, made once: a cell that does not fit waits for nothing.
  unzip(i) {
    this.zipLeft = ZIP.most; this.zipRun = 0;
    this.zipNext(i);
  }
  zipNext(i) {
    const w = this.world;
    for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) {
      const j = i + v * N + u;
      if (!(u || v) || w.k(j) !== K.FAULT || !(w.row(j).lay?.threads > 0) || this.zipN >= ZIP.ring) continue;
      this.zip[(this.zipHead + this.zipN) % ZIP.ring] = j; this.zipN++;
    }
  }
  // The faults waiting open, ZIP.rate a second (`updateHazards`, into its `opened`): each as an arc's slate does,
  // paying nothing, within the tether's reach and in no pocket. A cell waiting twice, or that has gone since, is
  // passed by. A spark runs along the thread, a note higher each cell.
  zipOn(dt, opened) {
    if (!this.zipN) return;
    const w = this.world, batch = this.zipped;
    batch.length = 0;
    this.zipAcc += dt * ZIP.rate;
    while (this.zipAcc >= 1 && this.zipN > 0 && this.zipLeft > 0) {
      const j = this.zip[this.zipHead];
      this.zipHead = (this.zipHead + 1) % ZIP.ring; this.zipN--;
      if (w.k(j) !== K.FAULT || batch.includes(j) || w.row(j).pocket !== null || !this.within(j % N + 0.5, Math.floor(j / N) + 0.5)) continue;
      this.zipAcc -= 1; this.zipLeft--;
      batch.push(j);
    }
    if (batch.length) {
      this.openShattered(batch);
      for (let n = 0; n < batch.length; n++) {
        const j = batch[n], x = j % N, y = Math.floor(j / N);
        opened.push(j);
        this.zipNext(j);
        // (The spark that runs along the thread, and its note, a step higher each cell: js/feel.js, `zip`.)
        if (this.feel.zip) this.feel.zip(this, j, this.zipRun++); else sfx.zip?.(this.zipRun++, this.near(x, y));
      }
      w.see(batch[batch.length - 1] % N, Math.floor(batch[batch.length - 1] / N), 1);
    }
    // (A thread run out, or with nothing more waiting, owes nothing to the next.)
    if (!this.zipN || this.zipLeft <= 0) { this.zipN = 0; this.zipAcc = 0; }
  }
  // In a grotto the dull caps on the walls light as the drill flies by, within two cells of it: each with a note,
  // a step higher than the last while they come less than two seconds apart. A lit cap is the grotto's mineral.
  // (And so they do on the rims of a ground whose row says its caps glow, the mycelium's: a lit cap there pays as a
  // cap does, its grit and the west's gems, with no pocket's lump.)
  glow() {
    const w = this.world, d = this.drill, row = w.row(this.di), P = row.pocket;
    if (!(row.glow || P?.twist === 'glow') || d.mode === 'dead') return;
    const x0 = Math.floor(d.x), y0 = Math.floor(d.y);
    let lit = false;
    for (let y = y0 - 2; y <= y0 + 2; y++) for (let x = x0 - 2; x <= x0 + 2; x++) {
      const i = y * N + x;
      if (w.k(i) !== K.CAP || Math.hypot(x + 0.5 - d.x, y + 0.5 - d.y) > 2.1) continue;
      this.lightCap(i); lit = true;
    }
    if (lit) this.version++;
  }
  // A cap lit, by the drill flying by or by the grotto's newt (js/fauna.js): a note a step higher for each lit within
  // two seconds of the last.
  lightCap(i) {
    const x = i % N, y = Math.floor(i / N);
    this.world.setK(i, K.CAP_LIT);
    if (this.time - this.glowAt > 2) this.glowRun = 0;
    this.glowAt = this.time;
    this.sparkle((x + 0.5) * T, (y + 0.5) * T, 5, '#58f0e0'); this.ring((x + 0.5) * T, (y + 0.5) * T, '#58f0e0', 14);
    sfx.gem(Math.min(9, this.glowRun++));
  }
  // The last cut glows: the ground that would come free if this cell were cut. `also` is whatever else the cut
  // would open besides its own cell (a pane that shatters whole, a crack that runs on, the cells a punch goes
  // through): those glow with it, and what they would leave hanging is found as what the cut itself would.
  foresee(i, also = []) {
    // A lava pocket or a spore pod beside the cut bursts with it, and what comes free is what both leave hanging.
    // A pod takes its whole bunch with it (`bunch`), as it will a moment after the cut.
    const w = this.world, cells = [i], here = w.hazAt(i);
    if (here === 'spore') this.bunch(i, cells);
    // A charged crystal cut into arcs at once, and the slate it shatters opens with the cut.
    if (here === 'spark') also = also.concat(this.shatters(i % N, Math.floor(i / N)));
    // A rime bell cut into tolls at once: its ring of ice opens with the cut.
    if (here === 'bell') also = also.concat(this.ringOf(i).filter(j => this.crushes(j)));
    // A bit charged by the capacitor shatters the hard ground round the cut with it.
    if (this.charge > 0) also = also.concat(this.shatters(i % N, Math.floor(i / N), true));
    for (let s = 0; s < 4; s++) {
      const j = i + DY[s] * N + DX[s];
      const haz = w.hazAt(j);
      if (haz === 'lava') cells.push(j);
      else if (haz === 'spore') this.bunch(j, cells);
    }
    const open = also.filter(j => j !== i && w.k(j) !== K.EMPTY), found = w.freed(cells, 2000, open.length ? new Set(open) : null);
    this.preview = [{ i, cells: open.concat(...found) }];
  }
  // A cell cut through. `ploughed`: the late bit ploughed it (`ploughs`), so CRUSHED is said no more often than
  // in ground that cuts like air.
  finishDig(i, ploughed = false) {
    const w = this.world, d = this.drill, x = i % N, y = Math.floor(i / N), k = w.k(i), b = w.b(i), row = rowOf(b), haz = hazOf(k, row);
    // (What the pocket's own rule opens with the cut is asked while the cell still stands.)
    const also = this.alsoOpens(i);
    w.setK(i, K.EMPTY);
    if (row.freeze > 0) { w.dug.set(i, this.clock); this.frostOpen.push(i); }
    // (A keystone is iron: it rings and shatters as slate does. A prism breaks like any crystal.)
    const mineral = row.pocket !== null && k === (row.pocket.kind ?? K.MINERAL);
    const tough = k === K.SLATE || k === K.KEY ? 3 : k === K.VAULT ? 4 : k === K.DENSE || k === K.ORE_B || k === K.BASALT || k === K.SLAG || k === K.STEEL || k === K.PRISM || k === K.RARE || mineral ? 2 : 1;
    sfx.dig(tough, GEMS[k] > 0 || mineral ? 'ore' : k === K.ICE ? 'ice' : '');
    this.chips(x, y, this.debris(k, b), 9 + tough * 3, d.ang, 1);
    this.effect('dust', 'dust', (x + 0.5) * T, (y + 0.5) * T);
    if (tough >= 2 || k === K.ICE) this.effect('shatter', 'shatter', (x + 0.5) * T, (y + 0.5) * T);
    // (Ploughing, the drill goes through a mineral every second or so: it says so no more often than that.)
    // (A hazard cut into is crushed too, a rare one as much as lava, and is a sample: the lab learns from what goes
    // off, before it goes off. So is a keystone's iron.)
    const key = this.sampleOf(k, row);
    if (k === K.ORE_A || k === K.ORE_B || k === K.STEEL || k === K.PRISM || k === K.RARE || mineral || key) this.analyse(key, x, y, (row.dig >= PLOUGH && !ploughed) || this.time - this.crushedAt >= CRUSH_EVERY);
    // (A pup beside the cut is fed by ore crushed; a roost of bats beside it wakes. The creatures only read it.)
    this.fauna.crushed(this, i, k);
    this.shake = Math.max(this.shake, 1 + tough * 0.5);
    // The hazard that was cut into wakes, and a hazard beside the cut: each may open cells (its own; the slate an
    // arc shatters), and every cell opened goes to `changed` together.
    const opened = [i];
    // A pane shatters whole, a plank splits away: each cell of it goes with a crack of its own. A fuse cut burns.
    for (const j of also) {
      w.setK(j, K.EMPTY); opened.push(j);
      this.effect('shatter', 'shatter', (j % N + 0.5) * T, (Math.floor(j / N) + 0.5) * T);
      this.chips(j % N, Math.floor(j / N), this.debris(K.SOFT, b), 3, null, 0.8);
    }
    if (also.length) { w.see(x, y, 2); this.shake = Math.max(this.shake, 2.5); }
    if (k === K.NODE && row.pocket?.twist === 'fuse') this.burn(i);
    // A fault cut in ground laced with them runs on along the faults joined to it (`unzip`).
    if (k === K.FAULT && row.lay?.threads > 0) this.unzip(i);
    // Charged by an arc taken in (the capacitor), the bit lets it go into this cut: the dense rock and slate round the
    // cell shatter, and pay nothing. (Before what the cut wakes: an arc it sets off charges the bit afresh.)
    if (this.charge > 0) {
      const burst = this.shatters(x, y, true);
      this.charge = 0;
      this.openShattered(burst); opened.push(...burst);
      this.popup(x, y - 1, 'DISCHARGE', '#d8b8ff'); sfx.zap();
      if (burst.length) { w.see(x, y, 2); this.shake = Math.max(this.shake, 4); this.effect('zap', 'impact', (x + 0.5) * T, (y + 0.5) * T); }
    }
    if (haz) for (const j of this.trigger(i, haz, true)) if (j !== i) opened.push(j);
    for (let s = 0; s < 4; s++) {
      const j = (y + DY[s]) * N + x + DX[s];
      const beside = w.hazAt(j);
      if (beside) opened.push(...this.trigger(j, beside, false));
    }
    d.dig = -1; this.preview = [];
    w.see(x, y, 1);
    this.changed(opened);
  }

  // ------------------------------------------------------------ the lab
  // What a cell of this kind in this ground is to the lab: the key of its row in `LAB` (the sheet and frame it is
  // drawn from, so a cross's rich ore is its donor's here too and a strain's ore its own: `row.oreKeys`), or null for
  // what the lab does not study. A hazard is its type's, whatever ground it lies in, and a hazard's cell of a type
  // its ground has none of is nothing. (Every key is made once, not for each cell asked about.)
  sampleOf(k, row) {
    const P = row.pocket;
    if (P !== null && k === (P.kind ?? K.MINERAL)) return MINERAL_SAMPLE[P.mineral] ??= `minerals:${P.mineral}`;
    if (k === K.ORE_A) return row.oreKeys[0];
    if (k === K.ORE_B) return row.oreKeys[1];
    if (k === K.STEEL) return STEEL_SAMPLE;
    if (k === K.HAZARD || k === K.HAZARD2 || k === K.RARE) return HAZ_SAMPLE[hazOf(k, row)] ?? null;
    if (k === K.KEY) return KEY_SAMPLE;
    return null;
  }
  // How much more such a cell is worth for what the lab knows of it: a hundredth for each level.
  studied(k, row) { const key = this.sampleOf(k, row); return key && LAB_OF[key] ? labLevel(this.S.lab[key] ?? 0) / 100 : 0; }
  // The bit went through something at cell (x, y). The cell says CRUSHED, as it always has (where `say` allows: in
  // ploughed ground no more than once a second). If the lab studies the thing, that was one more sample of it, and
  // under CRUSHED the cell says what the lab made of it: SAMPLE and how far the count has come towards the next
  // analysis, or, when this sample completes one, ANALYSED and what the thing is now worth more by. An analysis
  // is always said, with a sparkle and a note.
  analyse(key, x, y, say = true) {
    const e = LAB_OF[key];
    if (say) { this.crushedAt = this.time; this.popup(x, y, 'CRUSHED', '#9a94a8'); }
    if (!e) return;
    const n = this.S.lab[key] = (this.S.lab[key] ?? 0) + 1;
    if (n === 1) this.known++;
    // (One count on the screen at a time: cutting through a seam of ore, each would lie over the last.)
    this.popups = this.popups.filter(p => !p.label.startsWith('SAMPLE '));
    if ((n & (n - 1)) === 0) {
      this.popup(x, y + 0.7, `ANALYSED +${labLevel(n)}%`, '#8cf2c4');
      this.sparkle((x + 0.5) * T, (y + 0.5) * T, 6, '#8cf2c4');
      sfx.gem(labLevel(n)); this.labSel = key; this.labFlash = 3;
    } else if (say) this.popup(x, y + 0.7, `SAMPLE ${n}/${labNext(n)}`, '#6fa894');
  }
  // The panel is opened and shut by a tap on the bar: at the tab it was left at, or at the lab's notes just after
  // something was analysed (at the thing last learnt about); a tap on the map names the chart's tab itself. The
  // lab's list opens with the thing chosen in the middle of its window, as near as the ends allow.
  openLab(open, tab) {
    this.lab = open; this.shop = false; this.chartTouch.clear(); this.langOpen = false;
    this.labTouch = null; this.labVel = 0; this.labAim = null; this.labHeld = null;
    if (open) {
      this.labSel ??= (LAB.find(e => this.S.lab[e.key]) ?? LAB[0]).key; this.labTab = tab ?? (this.labFlash > 0 ? 'lab' : this.labTab);
      const g = this.labGeom(), i = Math.max(0, LAB.findIndex(e => e.key === this.labSel));
      this.labScroll = this.labPrev = Math.max(0, Math.min(g.most, LAB_LIST.at[i] + LAB_RH / 2 - g.view / 2));
    }
    sfx.tap();
  }
  // Which thing's line lies at `y` pixels down the whole list, or -1 for the head of a part or past the end.
  labLineAt(y) {
    for (const line of LAB_LIST.lines) if (y >= line.y && y < line.y + line.h) return line.entry ? line.i : -1;
    return -1;
  }
  // The list eases to show thing i's line whole, below the head held at the top of the window (and with its part's
  // head too, where it is the first of its part): it does not move where the line is in view already.
  labReveal(i) {
    const g = this.labGeom(), y = LAB_LIST.at[i], top = y - LAB_SEC, from = this.labAim ?? this.labScroll;
    let aim = from;
    if (top < from) aim = top; else if (y + LAB_RH > from + g.view) aim = y + LAB_RH - g.view;
    aim = Math.max(0, Math.min(g.most, aim));
    this.labAim = aim === this.labScroll ? null : aim; this.labVel = 0;
  }
  // The keys on the lab's list: up and down (or W and S) choose the thing before or after, Page Up and Page Down a
  // window's worth, Home and End the first and the last; each shows the thing chosen. Returns whether it took the key.
  labKey(code, repeat) {
    const at = Math.max(0, LAB.findIndex(e => e.key === this.labSel)), page = Math.max(1, Math.floor(this.labGeom().view / LAB_RH) - 1);
    const to = { ArrowUp: at - 1, KeyW: at - 1, ArrowDown: at + 1, KeyS: at + 1, PageUp: at - page, PageDown: at + page, Home: 0, End: LAB.length - 1 }[code];
    if (to === undefined) return false;
    const i = Math.max(0, Math.min(LAB.length - 1, to));
    if (i !== at) { this.labSel = LAB[i].key; if (!repeat) sfx.tap(); }
    this.labReveal(i);
    return true;
  }
  // The list a step on: held, it goes with the finger and the speed it is moving at is kept (smoothed over two
  // steps); let go, it runs on at that speed, slowing to a twenty-fifth of it in a second and stopping under
  // LAB_REST pixels a second or at either end; easing to a line shown (`labAim`), it closes most of the way in a
  // fraction of a second. Nothing here draws from Math.random, and a step makes nothing.
  stepLab(dt) {
    if (!this.lab || this.labTab !== 'lab' || !(dt > 0)) return;
    const most = this.labGeom().most;
    if (this.labTouch) this.labVel = 0.5 * this.labVel + 0.5 * (this.labScroll - this.labPrev) / dt;
    else if (this.labAim !== null) {
      this.labScroll += (this.labAim - this.labScroll) * Math.min(1, 14 * dt);
      if (Math.abs(this.labAim - this.labScroll) < 0.5) { this.labScroll = this.labAim; this.labAim = null; }
    } else if (this.labVel) {
      this.labScroll += this.labVel * dt; this.labVel *= 0.04 ** dt;
      if (Math.abs(this.labVel) < LAB_REST) this.labVel = 0;
    }
    const held = Math.max(0, Math.min(most, this.labScroll));
    if (held !== this.labScroll) { this.labScroll = held; if (!this.labTouch) this.labVel = 0; }
    this.labPrev = this.labScroll;
  }

  // ------------------------------------------------------------ hauling
  // What a haul of these cells would pay, were it made now. Asking changes nothing: the haul itself asks and then
  // does as this says, and so may anything that shows what a piece is worth before it is hauled, which then cannot
  // say otherwise than the haul will. `extra` is cells that are no longer in the world but come home with the haul,
  // each { k, b, x, y } (a kind, a ground and where it lay): counted in the haul's size and paid at its multiplier.
  //   n                 how many cells, the extra ones among them
  //   grit, gems        what is paid: grit in all, and gems of each direction (1 north, 2 south, 3 west, 4 east)
  //   lump              the part of the grit paid as it stands, whatever the size of the haul: caches, rare
  //                     hazards, and the mineral of a pocket (which, in a pocket whose row says `chain`, pays more
  //                     for each haul before it in a chain)
  //   chain             what such a mineral's lump was multiplied by for the hauls before this one: 1 with none
  //                     before it, and 0 where no cell is a mineral that pays more in a chain
  //   spec, minerals    specimens of each direction, and how many cells of a pocket's mineral there are
  //   mineral           the name of that mineral (the last met), or null
  //   prisms, shine     cells of prism, and what they multiply every gem by: half as much again each, to three
  //   relic             which direction's relic is among the cells, or -1
  //   caches, parts     caches; and wreck parts not held yet (`wrecks`: which wrecks they are)
  //   rares, rare       rare hazards, each of which pays a lump as a cache does, and which (the last met), or null
  //   caught            and of them, glowworms caught awake, whose lump is twice that; and with the live catch
  //                     bought, any rare hazard caught awake (`alive`: a bell whose fuse burns, a fumarole between
  //                     its jets, a lodestone humming), whose lump is the live catch's value times, a glowworm's never
  //                     less than twice
  //   live              whether a rare hazard was caught awake with the live catch bought
  //   mult, over        what the cells' grit is multiplied by, and the share of it left by a piece over the winch's load
  //   spin              the hauls before this in the flywheel's run (`spin`), each of which makes the cells' grit (not
  //                     the lumps) pay a share more, up to the flywheel's value: 0 with none, or no flywheel
  payOf(cells, extra = []) {
    const w = this.world, S = this.S, n = cells.length + extra.length, gems = noGems(), spec = [0, 0, 0, 0, 0], wrecks = [], held = S.wrecks ?? [];
    const chain = 1 + 0.2 * Math.min(5, this.chain && this.time - this.chain.t <= CHAIN ? this.chain.n : 0);
    let grit = 0, lump = 0, relic = -1, caches = 0, minerals = 0, mineral = null, prisms = 0, chains = false, rares = 0, rare = null, caught = 0, live = false, ores = 0, hazards = 0;
    // (The deep finds: the twin stones and fossils' bones in the haul, counted by their sectors and kind, and the
    // shrines.)
    let twins = 0, fossils = 0, fossil = 0, shrine = -1;
    const catches = this.val('livecatch'), tally = this.tally, shrines = [];
    tally.clear();
    const one = (k, b, x, y) => {
      const row = rowOf(b), far = Math.hypot(x - C, y - C), rich = richness(far) * row.rich * row.worth, P = row.pocket;
      // Whose gems a cell pays is its kind's and its ground's to say; the home ground pays none.
      // What the lab knows of a thing makes it worth that much more (`studied`): its grit, its gems, its lump.
      const study = 1 + this.studied(k, row);
      grit += GRIT[k] * rich * study; gems[gemKin(k, row)] += GEMS[k] * row.gemx * study;
      if (b === B.CRUST && (k === K.ORE_A || k === K.ORE_B)) grit += (k === K.ORE_B ? 20 : 4) * rich * study;
      // (Ore and hazards asleep are counted, for what the haul is called: `haulTitle`.)
      if (k === K.ORE_A || k === K.ORE_B) ores++;
      else if (k === K.HAZARD || k === K.HAZARD2) hazards++;
      if (k === K.RELIC) {
        const at = w.relicAt.indexOf(y * N + x);
        if (at >= 0) relic = at;
        else { const d = w.shrineAt.indexOf(y * N + x); if (d >= 0 && !shrines.includes(d)) shrines.push(d); }
      }
      // (A twin stone or a bone: its sector and which, as one number, (sx * 4096 + sy) * 2 + whether it is a bone.)
      else if (k === K.TWIN || k === K.FOSSIL) {
        const key = ((Math.floor((x - C) / FIND) + 2048) * 4096 + Math.floor((y - C) / FIND) + 2048) * 2 + (k === K.FOSSIL ? 1 : 0);
        tally.set(key, (tally.get(key) ?? 0) + 1);
      }
      // A cache holds what a quarter of a minute's cutting out here would earn; a wreck gives up its part.
      else if (k === K.CACHE) { caches++; lump += round2(income(Math.max(22, far)) * 12); }
      else if (k === K.WRECK) { const which = w.wrecks.findIndex(([wx, wy]) => wx === x && wy === y); if (which >= 0 && !held[which] && !wrecks.includes(which)) wrecks.push(which); }
      else if (k === K.PRISM) prisms++;
      // A rare hazard holds what a cache does; a glowworm hauled while it swims, twice that; and with the live
      // catch bought, any of them hauled awake that many times, a glowworm never less than twice.
      else if (k === K.RARE) {
        const worm = this.swimming(y * N + x), awake = !worm && catches > 1 && this.alive(y * N + x);
        rares++; rare = RARE[row.kin] ?? null; if (worm || awake) caught++;
        if (awake || (worm && catches > 1)) live = true;
        lump += round2(income(Math.max(22, far)) * 12 * study) * (worm ? Math.max(2, catches) : awake ? catches : 1);
      }
      // A pocket's mineral pays so many seconds of what cutting out here would earn, and specimens of the
      // direction the pocket lies in.
      if (P !== null && k === (P.kind ?? K.MINERAL)) {
        minerals++; mineral = P.mineral ?? null;
        if (P.chain) chains = true;
        lump += round2(income(Math.max(22, far)) * P.lump * (P.chain ? chain : 1) * study);
        spec[w.zoneOf(Math.floor((x - C) / ZONE), Math.floor((y - C) / ZONE))?.kin ?? row.kin] += P.spec;
      }
    };
    for (const i of cells) one(w.k(i), w.b(i), i % N, Math.floor(i / N));
    for (const e of extra) one(e.k, e.b, e.x, e.y);
    // Twin stones both in one haul pay a lump of TWIN_LUMP seconds and a specimen of their direction; a fossil whole
    // (every bone the seed laid of it: `find` says how many) BONE_LUMP seconds a bone and two specimens. A twin alone,
    // or a fossil in part, pays its cells' grit and no more. A shrine pays SHRINE_LUMP seconds of what cutting at its
    // distance earns, and SHRINE_SPEC specimens of each of its parents' directions.
    for (const [key, count] of tally) {
      const bone = key & 1, at = key >> 1, F = this.bones;
      w.find(Math.floor(at / 4096) - 2048, at % 4096 - 2048, F);
      if (!F.laid) continue;
      const far = Math.hypot(F.fx - C, F.fy - C), kin = fossilKin(F.fx, F.fy);
      if (!bone && count >= 2) { twins++; lump += round2(income(Math.max(22, far)) * TWIN_LUMP); spec[kin] += TWIN_SPEC; }
      else if (bone && count === F.n) { fossils |= 1 << (kin - 1); fossil = kin; lump += round2(income(Math.max(22, far)) * BONE_LUMP * F.n); spec[kin] += BONE_SPEC; }
    }
    for (const d of shrines) {
      shrine = d; lump += round2(income(SHRINE_R) * SHRINE_LUMP);
      for (const kin of CORNER_KINS[d]) spec[kin] += SHRINE_SPEC;
    }
    // Each part brought home from a wreck makes every haul pay a tenth more, the haul that brings it too.
    // (A piece over the winch's load pays less for each cell's own grit, and its banner says so; where the cells
    // are worth nothing themselves, as a loop of ash is, nothing is lost and nothing is said.)
    const parts = wrecks.length, over = grit > 0 ? overload(n, S.lv.winch) : 1, mult = haulBonus(n, this.val('winch')) * (1 + 0.1 * (held.filter(Boolean).length + parts)) * over;
    const shine = 1 + 0.5 * Math.min(prisms, 3);
    // (The flywheel: a haul of LIGHT cells or more made within CHAIN seconds of the last of its run pays its cells'
    // grit eight in a hundred more for each haul of the run before it, twelve at its second level, up to the row's
    // value, SPIN_STEP.)
    const fly = this.val('flywheel'), spin = fly > 0 && n >= LIGHT && this.time - this.spin.t <= CHAIN ? this.spin.n : 0, spun = spin ? 1 + Math.min(fly, SPIN_STEP[Math.min(2, S.lv.flywheel)] * spin) : 1;
    // (The station's refinery multiplies a haul's grit, lumps and all; its gem cutter the gems.)
    const refined = this.val('refinery'), cut = this.val('cutter');
    // (And each shrine held makes the gems of both its parents' directions SHRINE_PERK times as many, for good. The
    // corners' gems are cut, shone and overloaded as the directions' are.)
    const holy = S.shrines;
    for (let b = 1; b < GEM_N; b++) {
      let perk = 1;
      if (holy) for (let d = 0; d < 4; d++) if (holy[d] && (CORNER_KINS[d][0] === b || CORNER_KINS[d][1] === b)) perk *= SHRINE_PERK;
      gems[b] = Math.round(gems[b] * shine * over * cut * perk);
    }
    return { n, grit: Math.round((Math.round(grit * mult * spun) + lump) * refined), gems, lump, spec, minerals, mineral, prisms, shine, relic, caches, rares, rare, caught, live, parts, wrecks, mult, over, spin, chain: chains ? chain : 0,
      ores, hazards, twins, fossils, fossil, shrine, shrines };
  }
  // The tether is round these cells: they go, and what they are worth is on its way home. `area` is how much the
  // loop that took them was round, in cells (`reelIfRound`), where it is known.
  haul(cells, area = 0) {
    // (A haul of nothing would never be over: it ends when the last of its rubble is home.)
    if (!cells.length) return;
    const w = this.world, S = this.S, n = cells.length, pay = this.payOf(cells), { grit, gems, relic, caches, parts, mult, over } = pay;
    const worm = pay.caught ? cells.find(i => this.swimming(i) || (pay.live && this.alive(i))) : -1;
    S.wrecks ??= [0, 0, 0, 0, 0, 0, 0, 0];
    for (const which of pay.wrecks) S.wrecks[which] = 1;
    // A very large piece is shown by a share of its cells: by no more blocks than there is room for among the
    // rubble already on its way home. RUBBLE bits of ground are on their way at the most, whatever number of hauls
    // they belong to, each new haul getting what the hauls before it have left (never fewer than a dozen blocks,
    // half that once two dozen hauls are out). The limit was 400 to a haul: a great piece of natural ground comes
    // loose as a dozen pieces or more at once, the caves in it parting them, and that was thousands of bits to
    // push about and tens of thousands of things to draw in every frame, for seven seconds: a phone stood still.
    const afloat = this.hauls.reduce((sum, h) => sum + Math.max(0, h.total - h.paid), 0), room = Math.max(this.hauls.length >= 24 ? 6 : 12, RUBBLE - afloat);
    const sprites = [], show = Math.max(1, Math.ceil(n / room));
    let cx = 0, cy = 0;
    for (let at = 0; at < n; at++) {
      const i = cells[at], x = i % N, y = Math.floor(i / N);
      cx += x; cy += y;
      if (at % show) continue;
      const k = w.k(i), b = w.b(i), row = rowOf(b), gem = GEMS[k] * row.gemx * pay.shine, kin = gemKin(k, row);
      sprites.push({ x, y, tile: this.rockRect(x, y, k, b), over: this.overlay(k, row, i), debris: this.debris(k, b), gem: gem ? kin : 0, gems: gem * show, far: Math.hypot(x - C, y - C) });
    }
    // The ground the haul lies in, where more than half of it lies in one (`haulTitle`): a few hundred of its cells
    // are asked, however many there are.
    const tally = new Map(), every = Math.max(1, Math.floor(n / 256));
    let asked = 0, ground = null;
    for (let at = 0; at < n; at += every, asked++) { const b = w.b(cells[at]); tally.set(b, (tally.get(b) ?? 0) + 1); }
    for (const [b, count] of tally) if (count * 2 > asked) ground = rowOf(b);
    // A geode hauled in ground whose finds are geodes (a druse) rings: asked of its shell while it still stands.
    const rang = this.resonant(cells);
    for (const i of cells) w.setK(i, K.EMPTY);
    // (It is plainly gone, wherever it was: the map shows it open without the drill going to look.)
    w.show(cells);
    // A pocket whose ground the tether has drawn in has been got to, and the map no longer marks it as somewhere to
    // go, as it does a pocket the drill has flown into (`arrive`). (Its pip stayed on the map, however much of it was
    // hauled away from outside.) Asked once a run of one ground: a haul's cells lie mostly in runs.
    for (let at = 0, was = -1; at < n; at++) {
      const b = w.b(cells[at]);
      if (b === was) continue;
      was = b;
      if (rowOf(b).pocket) { const here = this.placeAt(cells[at]); if (here.zone) S.visited[here.key] = 1; }
    }
    // A haul made soon after another is a link in a chain: `n` is how many came before it.
    const linked = this.chain && this.time - this.chain.t <= CHAIN ? this.chain.n : 0;
    this.chain = { t: this.time, n: linked + 1 };
    // And with the flywheel, a haul of LIGHT cells or more is the next of its run (begun again after CHAIN seconds).
    if (this.val('flywheel') > 0 && n >= LIGHT) { this.spin.n = (this.time - this.spin.t <= CHAIN ? this.spin.n : 0) + 1; this.spin.t = this.time; }
    // Small, and with nothing in it to make a show of, it is a light haul: flight is not stopped for it. (A prism
    // is something to make a show of: the banner says what it did to the gems. So is a rare hazard.)
    const light = n < LIGHT && relic < 0 && !caches && !parts && !pay.prisms && !pay.rares && !pay.twins && !pay.fossils && pay.shrine < 0;
    S.grit += grit; this.pending.grit += grit;
    // A shrine hauled is held for good (its gems' share, `payOf`), and a fossil whole is counted by its direction.
    if (pay.shrines.length) { S.shrines ??= [0, 0, 0, 0]; for (const d of pay.shrines) S.shrines[d] = 1; }
    if (pay.fossils) S.fossils = (S.fossils ?? 0) | pay.fossils;
    for (let b = 1; b < GEM_N; b++) if (gems[b]) { S.gems[b] = (S.gems[b] ?? 0) + gems[b]; this.pending.gems[b] += gems[b]; }
    // Specimens of a pocket's mineral: a count for each direction, kept to the fraction and shown whole. `specUp`
    // is how far the whole count rose, of the direction that gained most (`specOf`).
    S.spec ??= [0, 0, 0, 0, 0];
    let specOf = 0, specUp = 0;
    for (let b = 1; b < 5; b++) {
      if (!(pay.spec[b] > 0)) continue;
      const had = Math.floor(S.spec[b] + 1e-9);
      S.spec[b] += pay.spec[b];
      if (!specOf || pay.spec[b] > pay.spec[specOf]) { specOf = b; specUp = Math.floor(S.spec[b] + 1e-9) - had; }
    }
    // (A mineral that pays more in a chain rings at every haul, a note higher for each haul before it, as far as
    // the pay rises; any other rings when the whole count of specimens does.)
    if (specOf) this.specLine = { kin: specOf, t: 0, life: SPEC_LINE };
    if (pay.chain || (specOf && specUp > 0)) sfx.gem(Math.min(5, linked));
    S.stats.hauls++; S.stats.best = Math.max(S.stats.best, n);
    sprites.sort((a, b) => a.far - b.far);
    const count = sprites.length, spread = Math.min(1.0, 0.2 + count * 0.012), lift = Math.min(0.5, 0.26 + count * 0.003);
    // The rubble is drawn in along the tether as it lay when the loop closed.
    const route = this.lay().map(([x, y]) => [x * T, y * T]), cum = [0];
    for (let k = 1; k < route.length; k++) cum.push(cum[k - 1] + Math.hypot(route[k][0] - route[k - 1][0], route[k][1] - route[k - 1][1]));
    const length = cum[cum.length - 1];
    // Small pieces break fine, big ones coarse, so there are never too many bits of ground to push about; and
    // in a chain, where one heap of rubble follows another, none break fine.
    const per = count <= 24 && !linked && count * 16 <= room ? 4 : count <= 140 && count * 4 <= room ? 2 : 1, size = T / per, h = { sprites, t: 0, n, count, grit, gems, left: grit, paid: 0, lift, relic, route, cum, length,
      bits: [], total: count * per * per, size, v: 0, hole: 0, gathered: lift + spread + 0.3, light };
    let at = 0;
    sprites.forEach((s, i) => {
      s.go = lift + (count > 1 ? i / (count - 1) : 0) * spread; s.left = per * per;
      const [u, k] = this.onRoute(h, (s.x + 0.5) * T, (s.y + 0.5) * T, 0, route.length);
      s.k = k; at += u / count;
      if (s.over) { const [items, frame] = s.over, f = frame === 'hazard' || frame === 'relic' ? frameAt(items, frame, 0) : sheets[items].frames[frame]; s.item = [sheets[items].image, f]; }
    });
    // The rubble gathers on the tether beside where it lay. From here the haul has a rope of its own, and the drill
    // is free to go.
    h.S = at;
    this.hauls.push(h);
    const mx = cx / n, my = cy / n;
    cx = (mx + 0.5) * T; cy = (my + 0.5) * T;
    this.effect('haul', 'impact', cx, cy);
    sfx.crack(n, linked);
    for (const sp of sprites) if (count < 60 || cellHash(sp.x, sp.y, 9) < 0.4) this.chips(sp.x, sp.y, sp.debris, 2, null, 0.7);
    // (A creature caught by the loop that took the haul was caught this very moment: js/fauna.js, `wound`.)
    const caught = this.fauna.caughtAt === this.time ? this.fauna.caughtN : 0, dull = !pay.ores && !pay.lump && !gems.some(g => g > 0);
    const [title, giant, named, says] = haulTitle(n, { relic, parts, caches, rare: pay.rare, live: pay.live, spin: pay.spin, caught, low: this.hull === 1, ores: pay.ores, dull, hazards: pay.hazards, over, pick: S.stats.hauls, shrine: pay.shrine, fossil: pay.fossil, twins: pay.twins }, ground, area), half = giant > GIANTS.length;
    // (What the banner says under its title: what a shrine gives for good, that a fossil is whole, how many geodes rang;
    // else the line under the joke.)
    const sub = half ? says : pay.shrine >= 0 ? `GEMS x${SHRINE_PERK} FOR GOOD` : pay.fossil ? 'FOSSIL, WHOLE' : rang ? `${rang} ${rang === 1 ? 'GEODE RINGS' : 'GEODES RING'}` : says;
    // What the last haul was and paid (`hauled`). Any but a light one says so across the screen, with a flash and
    // a beat of stillness. A light one says what it paid where it lay, and leaves the banner of a bigger haul up.
    // (A haul named by its place has its title in the place's colour; a giant's stays up longer, and HALF's longest.)
    const mineral = pay.mineral && sheets.minerals?.frames[pay.mineral] ? pay.mineral : null;
    this.hauled = { title, n, mult, over, grit, gems, light, shine: pay.shine, minerals: pay.minerals, mineral, spec: specUp, specOf, chain: pay.chain, spin: pay.spin, live: pay.live, t: 0,
      life: half ? 7 : 2.2 + Math.min(1.2, n * 0.01) + giant * 0.4, giant, colour: named ? bright(ground.map) : null, sub };
    if (light) {
      this.shake = Math.max(this.shake, Math.min(1.5, 0.7 + n * 0.08));
      this.ring(cx, cy, '#fff6c8', 12 + n);
      // (What a pocket's mineral paid has the mineral beside it, and under it the specimens it added.)
      this.popup(mx, my - 0.6, `+${compact(grit)}`, '#ffe14a', mineral ? ['minerals', mineral] : 'grit');
      let up = 1;
      if (specUp > 0) this.popup(mx, my - 0.6 - 0.6 * up++, `+${specUp}`, GEM_COLOR[specOf], `spec-${GEM_ICON[specOf]}`);
      for (let g = 1; g < GEM_N; g++) if (gems[g] > 0) this.popup(mx, my - 0.6 - 0.6 * up++, `+${compact(gems[g])}`, GEM_COLOR[g], GEM_ICON[g]);
    } else {
      if (n >= 20) this.effect('bank', 'area', cx, cy);
      this.shake = Math.max(this.shake, Math.min(9, 2.5 + n * 0.12));
      this.hitstop = Math.min(0.16, 0.05 + n * 0.002);
      this.flash = Math.min(0.5, 0.12 + n * 0.006);
      this.ring(cx, cy, '#fff6c8', 30 + Math.min(60, n * 1.5));
      // (A giant's banner stays up while it lasts for anything but a bigger giant: the tether, let go of the ground
      // it lay against, finds rocks standing free in the caves it passed and hauls them one by one just after.)
      const up = this.banner;
      if (!(up && up.giant > giant && up.t < up.life)) this.banner = this.hauled;
      // A place's own haul: a burst of its colours, and its two notes.
      if (named) {
        const chips = ground.pocket?.chips ?? ground.debris;
        for (const colour of chips) this.sparkle(cx, cy, 8, colour);
        this.ring(cx, cy, bright(ground.map), 110, 0.12);
        sfx.place(ground);
      }
      // A giant: rings after rings, gold and the gems' colours, a longer beat of stillness and a brighter flash, and
      // a sound that grows with it (`sfx.vast`).
      if (giant) this.grand(cx, cy, giant);
    }
    if (parts || caches || (pay.rares && !pay.caught)) sfx.relic();
    // A glowworm caught alive says so where it was (and with the live catch, any rare hazard caught awake).
    if (worm >= 0) { this.popup(worm % N, Math.floor(worm / N) - 1, 'CAUGHT', SPOT.worm[1]); this.sparkle((worm % N + 0.5) * T, (Math.floor(worm / N) + 0.5) * T, 8, SPOT.worm[1]); sfx.caught(); }
    if (relic >= 0) { S.relics[relic] = 1; sfx.relic(); if (S.relics.every(Boolean) && !S.won) { S.won = true; this.wonAt = this.time; } }
    // (A shrine has a chord of its own, a fossil or twin stones the relic's call; geodes that ring, a chime.)
    if (pay.shrine >= 0) { sfx.shrine?.(pay.shrine); this.ring(cx, cy, GEM_COLOR[CORNER_KINS[pay.shrine][1]], 140, 0.1); }
    else if (pay.fossil || pay.twins) sfx.relic();
    if (rang) { sfx.resonate?.(rang); this.ring(cx, cy, '#fff0a0', 200, 0.08, 1.2); if (light) this.popup(mx, my - 1.2, `${rang} RING`, '#fff0a0'); }
  }
  // A geode hauled in ground whose finds are geodes (a druse's: a row's `geodes`) rings, once a haul, and the geodes
  // round it answer: every sector of finds within two sectors (96 cells) of it that holds a geode is shown, the
  // whole of the geode out to its shell (`seeCell`), so the map marks it (the shell is what is called a geode) until
  // it is got to, where the map has room (`callOut`, `rung`). Asked of a cell of slate in the haul that lies within
  // its sector's geode's shell. Returns how many geodes rang, the hauled one's not counted.
  resonant(cells) {
    const w = this.world;
    for (let at = 0; at < cells.length; at++) {
      const i = cells[at];
      if (w.k(i) !== K.SLATE || !w.row(i).geodes) continue;
      const x = i % N, y = Math.floor(i / N), sx = Math.floor((x - C) / FIND), sy = Math.floor((y - C) / FIND);
      const [what, fx, fy, size] = w.findSpot(sx, sy);
      if (what !== 'geode' || (x - fx) ** 2 + (y - fy) ** 2 > size * size) continue;
      let rang = 0;
      for (let v = -2; v <= 2; v++) for (let u = -2; u <= 2; u++) {
        if (!(u || v)) continue;
        const [far, gx, gy, r] = w.findSpot(sx + u, sy + v);
        if (far !== 'geode') continue;
        rang++; this.rung.add(`geode:${sx + u},${sy + v}`);
        for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) if (a * a + b * b <= r * r) w.seeCell(gx + a, gy + b);
      }
      return rang;
    }
    return 0;
  }
  // A point `dist` pixels along a haul's route, from the drill's end toward the core.
  along(h, dist) {
    const { route, cum } = h;
    if (dist <= 0 || route.length < 2) return route[0];
    if (dist >= h.length) return route[route.length - 1];
    let k = 1;
    while (cum[k] < dist) k++;
    const u = (dist - cum[k - 1]) / ((cum[k] - cum[k - 1]) || 1);
    return [route[k - 1][0] + (route[k][0] - route[k - 1][0]) * u, route[k - 1][1] + (route[k][1] - route[k - 1][1]) * u];
  }
  // The nearest place on a haul's route to a point, looking at segments `from` to `to`: [pixels along, segment].
  onRoute(h, px, py, from, to) {
    const { route, cum } = h;
    let best = Infinity, at = 0, seg = 1;
    for (let k = Math.max(1, from); k < Math.min(route.length, to); k++) {
      const ax = route[k - 1][0], ay = route[k - 1][1], bx = route[k][0] - ax, by = route[k][1] - ay, len = bx * bx + by * by;
      const u = len ? Math.max(0, Math.min(1, ((px - ax) * bx + (py - ay) * by) / len)) : 0, gap = (px - ax - bx * u) ** 2 + (py - ay - by * u) ** 2;
      if (gap < best) { best = gap; at = cum[k - 1] + (cum[k] - cum[k - 1]) * u; seg = k; }
    }
    return [at, seg];
  }
  // A lassoed piece crumbles into bits of ground, and they are real: they cannot overlap each other, the drill or the
  // rock, so they have to flow down the tunnels to the core, where a hatch opens and they drop in. `h.S` is how far
  // along the route the rope is drawing them to.
  updateHauls(dt) {
    for (const h of this.hauls) {
      h.t += dt;
      const { size, bits } = h, per = T / size, rad = size * 0.45, wall = size * 0.4;
      // Blocks break up, each bit thrown a little way out.
      for (const s of h.sprites) {
        if (s.broke || h.t < s.go) continue;
        s.broke = true;
        for (let q = 0; q < per * per; q++) {
          const qx = q % per, qy = (q / per) | 0, a = Math.atan2(qy - (per - 1) / 2, qx - (per - 1) / 2) + (Math.random() - 0.5) * 2, v = 25 + Math.random() * 70;
          // (Every field a bit will ever have is given here, so that all bits are of one shape to the engine and the
          // loops that move them stay quick: `moved` is the length of its last step, none yet.)
          bits.push({ s, sx: qx * size, sy: qy * size, x: s.x * T + (qx + 0.5) * size, y: s.y * T + (qy + 0.5) * size, vx: Math.cos(a) * v, vy: Math.sin(a) * v, born: h.t, k: s.k, st: 0, ft: 0, stall: 0, ghost: false, fast: false, ox: 0, oy: 0, moved: Infinity });
        }
        if (h.count < 80 || cellHash(s.x, s.y, 9) < 0.35) this.chips(s.x, s.y, s.debris, 3, null, 0.8);
        if (this.time - (this.lastSnap ?? 0) > 0.05) { this.lastSnap = this.time; sfx.crumble(); }
      }
      // Once the blocks have broken up, the rope draws the lot in. A long way out it is carried
      // fast as one bundle; the last stretch, and any short haul, is pushed through the tunnels bit by bit.
      const before = this.along(h, h.S), left = h.length - h.S;
      const want = h.t < h.gathered ? 0 : left > 600 ? Math.max(700, left * 2.5) : 320;
      h.v = want > h.v ? Math.min(want, h.v + Math.max(900, want * 3) * dt) : want;
      h.S = Math.min(h.length, h.S + h.v * dt);
      const express = h.v > 330, aim = this.along(h, h.S), seg = this.onRoute(h, aim[0], aim[1], 0, h.route.length)[1];
      const home = h.S >= h.length - 0.5;
      if (home && h.homeAt === undefined) h.homeAt = h.t;
      // The hatch in the core opens as the rubble comes up to it, and shuts behind the last bit.
      const open = left < 130 && h.t > h.gathered && h.paid < h.total ? 5 + size * 1.3 : 0;
      h.hole += Math.max(-60 * dt, Math.min(60 * dt, open - h.hole));
      const steps = express ? 1 : Math.max(1, Math.min(4, Math.ceil((h.v * 1.5 + 80) * dt / 3))), sdt = dt / steps;
      let arrived = 0;
      // Each small step moves the bits still on their way, and those alone: drawn in, pushed apart, held off the rock.
      for (let step = 0; step < steps; step++) {
        let n = 0;
        for (const b of bits) if (!b.st) live[n++] = b;
        if (!n) break;
        this.drawIn(h, live, n, sdt, steps, express, aim, before, seg, home);
        jostle(live, n, size, rad);
        arrived += this.settle(h, live, n, wall);
      }
      // Nothing is ever left lying about: stragglers are drawn straight in.
      if (h.homeAt !== undefined && h.t > h.homeAt + 2.5 + h.total * 0.004) for (const b of bits) {
        if (b.st) continue;
        b.ghost = true;
        if (h.t > h.homeAt + 4.5 + h.total * 0.004) { b.st = 1; arrived++; b.s.left--; }
      }
      for (const b of bits) if (b.st === 1) { b.ft += dt; if (b.ft > 0.16) b.st = 2; }
      // Dust shed along the way.
      if (h.v > 50 && this.parts.length < 380 && bits.length && Math.random() < dt * 30) {
        const b = bits[(Math.random() * bits.length) | 0], colors = b.s.debris;
        if (!b.st) this.parts.push({ x: b.x, y: b.y, vx: (Math.random() - 0.5) * 16, vy: (Math.random() - 0.5) * 16, t: 0, life: 0.2 + Math.random() * 0.3, color: colors[(Math.random() * colors.length) | 0], size: 1 });
      }
      if (arrived) {
        h.paid += arrived;
        const left = Math.round(h.grit * (1 - h.paid / h.total));
        this.pending.grit = Math.max(0, this.pending.grit - (h.left - left)); h.left = left;
        this.coreFlash = 0.12; this.counted = 0.12;
        if (this.time - (this.lastRing ?? 0) > 0.11) { this.lastRing = this.time; this.ring(HX * T, HY * T, '#ffe14a', 30); this.sparkle(HX * T, HY * T, 3, '#ffe14a'); }
        if (this.time - (this.lastTick ?? 0) > 0.045) { this.lastTick = this.time; sfx.tick(Math.floor(h.paid / Math.max(1, h.total / 14))); }
        if (h.paid >= h.total && h.doneAt === undefined) {
          h.doneAt = h.t;
          sfx.banked(h.n);
          if (!h.light) this.effect('bank', 'area', HX * T, HY * T);
          this.save();
        }
      }
    }
    if (this.hauls.length && this.hauls.every(h => h.doneAt !== undefined && h.t > h.doneAt + 0.4 && h.hole < 0.5)) {
      this.hauls.length = 0; this.pending.grit = 0; this.pending.gems.fill(0);
    }
  }
  // One small step of `sdt` seconds (of `steps` in the frame) for the bits `bits[0..n)` of haul `h`: each is drawn
  // along the route toward the rope's end, `aim` (it was at `before` when the frame began, on segment `seg`), or,
  // once the rope is `home` and the hatch open, toward the hatch; and it moves on at its speed. Where it began the
  // step is kept (`ox`, `oy`) for `settle`.
  drawIn(h, bits, n, sdt, steps, express, aim, before, seg, home) {
    const homeX = HX * T, homeY = HY * T;
    for (let i = 0; i < n; i++) {
      const b = bits[i], age = h.t - b.born;
      if (express && age > 0.18) {
        // Carried: the bundle moves as one, still jostling.
        b.x += (aim[0] - before[0]) / steps; b.y += (aim[1] - before[1]) / steps; b.k = seg; b.ghost = true; b.fast = true;
      } else if (b.fast) { b.fast = false; b.ghost = false; b.stall = 0; }
      if (age > 0.18) {
        // Drawn along the tether toward where the bundle is, never faster than it can follow.
        const [u, k] = this.onRoute(h, b.x, b.y, b.k - 1, b.k + 3);
        b.k = k;
        const to = home && h.hole > 3 ? [homeX, homeY] : this.along(h, u < h.S ? Math.min(h.S, u + 24) : Math.max(h.S, u - 24));
        const tx = to[0] - b.x, ty = to[1] - b.y, gap = Math.hypot(tx, ty) || 1, top = Math.min(h.v * 1.5 + 90, gap * 12), ease = Math.min(1, sdt * 12);
        b.vx += (tx / gap * top - b.vx) * ease; b.vy += (ty / gap * top - b.vy) * ease;
        // A bit that is caught behind rock is let through it rather than left behind.
        if (!b.ghost) { if (gap > 20 && Math.abs(b.vx) + Math.abs(b.vy) > 30 && b.moved < 0.25 * sdt * top) b.stall += sdt; else b.stall = Math.max(0, b.stall - sdt); if (b.stall > 0.5) b.ghost = true; }
      } else { b.vx *= 1 - 4 * sdt; b.vy *= 1 - 4 * sdt; }
      b.ox = b.x; b.oy = b.y;
      b.x += b.vx * sdt; b.y += b.vy * sdt;
    }
  }
  // The end of a small step for the bits `bits[0..n)` of haul `h`: rock pushes each back out to `wall` pixels from
  // it (unless the bit is being let through), and one over the open hatch drops in. Returns how many dropped in.
  settle(h, bits, n, wall) {
    const w = this.world, homeX = HX * T, homeY = HY * T;
    let arrived = 0;
    for (let i = 0; i < n; i++) {
      const b = bits[i];
      // Rock is solid to it.
      if (!b.ghost) {
        for (let cy = Math.floor((b.y - wall) / T); cy <= Math.floor((b.y + wall) / T); cy++) for (let cx = Math.floor((b.x - wall) / T); cx <= Math.floor((b.x + wall) / T); cx++) {
          if (w.k(cy * N + cx) === K.EMPTY) continue;
          const nx = Math.max(cx * T, Math.min(b.x, cx * T + T)), ny = Math.max(cy * T, Math.min(b.y, cy * T + T)), vx = b.x - nx, vy = b.y - ny, gap = Math.hypot(vx, vy);
          if (gap >= wall) continue;
          if (gap > 0.01) { b.x = nx + vx / gap * wall; b.y = ny + vy / gap * wall; }
          else { b.x = b.ox; b.y = b.oy; }
        }
      }
      b.moved = Math.hypot(b.x - b.ox, b.y - b.oy);
      // Over the open hatch, it drops in.
      if (h.hole > 3 && Math.hypot(b.x - homeX, b.y - homeY) < h.hole - 1) { b.st = 1; arrived++; if (--b.s.left === 0 && b.s.gem) this.pending.gems[b.s.gem] = Math.max(0, this.pending.gems[b.s.gem] - b.s.gems); }
    }
    return arrived;
  }

  // ------------------------------------------------------------ hazards
  // A hazard wakes when the drill cuts beside it (or into it: `direct`). Lassoed asleep, it is worth gems.
  // What it does is its type's (`haz`: world.hazAt), whatever ground it lies in. Returns the cells it opened, for
  // `changed`. (`burnt`: a pod set off by lava in a seam whose pods burn, `REACT`.)
  trigger(i, haz, direct, burnt = false) {
    const w = this.world, x = i % N, y = Math.floor(i / N);
    if (haz === 'lava') {
      w.setK(i, K.EMPTY); w.lava.set(i, 9); this.lavaVol.set(i, w.row(i).lavaVol);
      sfx.hiss(); this.effect('steam', 'smoke-puff', (x + 0.5) * T, (y + 0.5) * T);
      this.quench(i);
      if (direct && !this.swims) { this.hit(JOLT.lava); this.shake = 5; }
      return [i];
    }
    if (haz === 'spore') {
      // (In a seam whose pods rime the cloud is a moment's, and leaves ice; one burnt off is gone in a moment too.
      // Each knocks nothing and grows no moss: `updateHazards`.)
      const rime = !burnt && w.row(i).react === 'rime';
      w.setK(i, K.EMPTY);
      this.clouds.push({ x, y, t: 0, life: rime ? RIME_SET : burnt ? 1.2 : 6, burnt, rime, spread: false });
      if (rime) this.reacted('rime', x, y); else if (burnt) { this.reacted('burn', x, y); if (this.onScreen(x, y)) this.chips(x, y, ['#ff9a3a', '#ffd84a', '#3c2a2e'], 5, null, 0.7); } else sfx.puff();
      return [i];
    }
    if (haz === 'spark') {
      // Cut into, a crystal arcs at once, and what the arc shattered is opened with the cut. Cut beside, its fuse is
      // lit: long enough to pull back out of the arc's reach before it goes.
      if (direct) return this.zap(x, y);
      const s = this.sparks.get(i);
      if (!s || s.cool <= 0) this.sparks.set(i, { fuse: FUSE, cool: 0 });
      return [];
    }
    // The rare hazards. Cut into, each is crushed (the cut has opened its cell) and goes off at once; cut beside, it
    // wakes, unless it is awake already or has not long done (`updateHazards` does the rest).
    const d = this.drill;
    if (haz === 'bell') {
      // A rime bell cut into tolls there and then; cut beside, it shivers while its fuse burns.
      if (direct) return this.toll(i);
      if (!this.bells.has(i)) { this.bells.set(i, { t: 0, cool: 0 }); sfx.bellwake(); }
    } else if (haz === 'vent') {
      // A fumarole cut into fires once, at once, out of the side the drill came from. Cut beside, it rumbles and
      // then fires three times out of the open side nearest the drill: the side just cut (or, woken some other
      // way with no side open, a side of its own).
      let way = -1, least = Infinity;
      for (let s = 0; s < 4; s++) {
        const far = (x + DX[s] + 0.5 - d.x) ** 2 + (y + DY[s] + 0.5 - d.y) ** 2;
        if ((direct || w.k(i + SIDE[s]) === K.EMPTY) && far < least) { least = far; way = s; }
      }
      if (direct) return this.jet(i, way, true);
      if (!this.vents.has(i)) { this.vents.set(i, { t: 0, way: way >= 0 ? way : (cellHash(x, y, 6) * 4) | 0, pulses: 0, cool: 0 }); sfx.rumble(); }
    } else if (haz === 'worm') {
      // A glowworm cut into bites. Cut beside, it uncoils.
      if (direct) this.wormBite(x, y);
      else if (!this.worms.has(i)) {
        this.worms.set(i, { nest: i, t: 0, wait: WORM.uncoil, from: i, since: WORM.tween, way: (cellHash(x, y, 8) * 4) | 0, steps: 0, close: Math.hypot(d.x - x - 0.5, d.y - y - 0.5) <= WORM.bite, stuck: false, trail: -1, trailT: 0 });
        sfx.wormwake(); this.effect('dust', 'dust', (x + 0.5) * T, (y + 0.5) * T);
      }
    } else if (haz === 'lodestone') {
      // A lodestone cut into flings what it held at the drill. Cut beside, it hums.
      if (direct) { this.hit(JOLT.ore); this.effect('sparks', 'sparks', (x + 0.5) * T, (y + 0.5) * T); sfx.pull(); }
      else if (!this.stones.has(i)) { this.stones.set(i, { t: 0, n: 0, clump: [i], next: undefined, at: 0, cool: 0 }); sfx.hum(); }
    }
    return [];
  }
  // ------------------------------------------------------------ the rare hazards
  // Can a rare hazard open cell `j`: is it ground of a kind it may crush (`CRUSH`), within the tether's reach, in
  // no pocket, and not the cell the bit is in?
  crushes(j) {
    const w = this.world;
    return CRUSH[w.k(j)] && j !== this.drill.dig && w.row(j).pocket === null && this.within(j % N + 0.5, Math.floor(j / N) + 0.5);
  }
  // Is the glowworm in cell `i` out of its coil and swimming? One the very cut that frees it woke is caught asleep:
  // it is caught alive, and paid twice, only once it has been awake as long as it takes to uncoil.
  swimming(i) { const m = this.worms.get(i); return m !== undefined && m.t >= WORM.uncoil; }
  // Is the rare hazard in cell `i` awake, and not cooling after: a rime bell whose fuse burns, a fumarole rumbling
  // or between its jets, a lodestone humming or pulling (the live catch pays for it so)?
  alive(i) {
    const b = this.bells.get(i), v = this.vents.get(i), s = this.stones.get(i);
    return (b !== undefined && b.cool <= 0) || (v !== undefined && v.cool <= 0) || (s !== undefined && s.cool <= 0);
  }
  // A rare hazard opens cell `j`, if it may (`crushes`), as a cut would: in ground that freezes it closes over
  // again in time. Returns whether it opened; whoever asked tells the books of loose ground, with everything that
  // opened together.
  breach(j) {
    if (!this.crushes(j)) return false;
    const w = this.world, x = j % N, y = Math.floor(j / N), k = w.k(j);
    w.setK(j, K.EMPTY);
    if (w.row(j).freeze > 0) { w.dug.set(j, this.clock); this.frostOpen.push(j); }
    if (this.onScreen(x, y)) { this.chips(x, y, this.debris(k, w.b(j)), 4, null, 0.9); this.effect('shatter', 'shatter', (x + 0.5) * T, (y + 0.5) * T); }
    return true;
  }
  // Two cells of ground, both solid, change places: a glowworm swims, a lodestone pulls its ore. Nothing opens or
  // closes, so the books of loose ground stand as they are; a dot on the map goes with what it marks.
  swap(a, b) {
    const w = this.world, ka = w.k(a), kb = w.k(b);
    w.setK(a, kb); w.setK(b, ka);
    for (const m of this.S.marks) if (m[0] === a) m[0] = b; else if (m[0] === b) m[0] = a;
  }
  // The ring of ice round a rime bell's heart: every cell 12 to 20 cells squared from it.
  ringOf(i) {
    const ring = [];
    for (let v = -4; v <= 4; v++) for (let u = -4; u <= 4; u++) { const d2 = u * u + v * v; if (d2 >= 12 && d2 <= 20) ring.push(i + v * N + u); }
    return ring;
  }
  // A rime bell tolls: its ring opens all at once, the disc inside hangs loose, and a drill near the bell is
  // knocked. Where the ground freezes the ring closes again with ice BELL.freeze seconds on (and up to a second
  // more), through the frost's own rules: never under the tether, beside the drill or in lava, and beside ore it
  // heals as ore. Returns what opened.
  toll(i) {
    const w = this.world, d = this.drill, x = i % N, y = Math.floor(i / N), opened = [];
    for (const j of this.ringOf(i)) {
      if (!this.breach(j)) continue;
      opened.push(j);
      const row = w.row(j);
      if (row.freeze > 0) w.dug.set(j, this.clock - row.freeze + BELL.freeze + cellHash(j % N, Math.floor(j / N), 5));
    }
    if (d.mode !== 'dead' && Math.hypot(d.x - x - 0.5, d.y - y - 0.5) <= BELL.knock) this.hit(JOLT.toll);
    this.shake = Math.max(this.shake, this.onScreen(x, y) ? 6 : 0);
    this.effect('freeze', 'impact', (x + 0.5) * T, (y + 0.5) * T);
    this.flares.push({ x, y, t: 0.3, power: 1, reach: 5 });
    sfx.toll();
    if (opened.length) w.see(x, y, 5);
    return opened;
  }
  // The way a fumarole's jet takes out of its heart `i` along side `s`: the open cells it passes and the solid ones
  // it would bore (VENT.bore at the most), VENT.run cells out at the most; it stops short of anything it may not
  // open and of the end of the tether's reach. Asked of the cells as they are: nothing changes.
  jetPath(i, s) {
    const w = this.world, x = i % N, y = Math.floor(i / N), path = [];
    for (let n = 1, bored = 0; n <= VENT.run && bored < VENT.bore; n++) {
      const j = (y + DY[s] * n) * N + x + DX[s] * n;
      if (w.k(j) !== K.EMPTY) { if (!this.crushes(j)) break; bored++; }
      else if (!this.within(x + DX[s] * n + 0.5, y + DY[s] * n + 0.5)) break;
      path.push(j);
    }
    return path;
  }
  // A fumarole fires out of its heart `i` along side `s`: the jet bores its way (`jetPath`), and lava's heat goes
  // with it (each cell it bores quenches the slag beside it, `quench`); the first jet turns the whole rind of slag
  // round the heart to steel. A hazard beside the bore wakes, as one beside a cut does (not another rare one), and
  // a drill in the jet's way is knocked. Returns the cells opened.
  jet(i, s, first) {
    const w = this.world, d = this.drill, x = i % N, y = Math.floor(i / N), opened = [];
    if (first) {
      let turned = 0;
      for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) {
        const j = i + v * N + u;
        if (w.k(j) !== K.SLAG) continue;
        w.setK(j, K.STEEL); this.quenched.set(j, QUENCH); turned++;
        if (this.onScreen(x + u, y + v)) this.sparkle((x + u + 0.5) * T, (y + v + 0.5) * T, 4, '#d8e8ff');
      }
      if (turned) this.version++;
    }
    const path = this.jetPath(i, s), end = path.length ? path[path.length - 1] : i;
    for (const j of path) if (w.k(j) !== K.EMPTY && this.breach(j)) { opened.push(j); this.quench(j); }
    for (const j of opened.slice()) {
      w.see(j % N, Math.floor(j / N), 1);
      for (const q of SIDE) { const haz = w.hazAt(j + q); if (haz && w.k(j + q) !== K.RARE) opened.push(...this.trigger(j + q, haz, false)); }
    }
    if (d.mode !== 'dead' && gap(d.x, d.y, x + 0.5, y + 0.5, end % N + 0.5, Math.floor(end / N) + 0.5) <= VENT.knock) this.hit(JOLT.jet);
    this.jets.push({ cells: path, upright: s % 2 === 1, t: VENT.show });
    this.effect('blast', 'fire-explosion', (x + DX[s] + 0.5) * T, (y + DY[s] + 0.5) * T);
    if (path.length) this.effect('steam', 'smoke-puff', (end % N + 0.5) * T, (Math.floor(end / N) + 0.5) * T);
    if (this.onScreen(x, y)) this.shake = Math.max(this.shake, 4);
    sfx.jet();
    return opened;
  }
  // A glowworm bites a drill that comes too near it (or cuts into it).
  wormBite(x, y) {
    this.hit(JOLT.bite);
    this.effect('sparks', 'sparks', (x + 0.5) * T, (y + 0.5) * T);
    sfx.bite();
  }
  // How long a glowworm `m` takes to swim into cell `j`, or 0 where it may not: only rock it swims through (SWIMS),
  // seen, in no pocket and in ground of its own kind (or it would be another hazard there), within WORM.leash of
  // where it woke, and never the cell the bit is in.
  swimInto(j, m) {
    const w = this.world, time = SWIMS[w.k(j)];
    if (!time || !w.s(j) || j === this.drill.dig) return 0;
    const row = w.row(j), ex = j % N - m.nest % N, ey = Math.floor(j / N) - Math.floor(m.nest / N);
    return row.pocket === null && RARE[row.kin] === 'worm' && ex * ex + ey * ey <= WORM.leash * WORM.leash ? time : 0;
  }
  // Which side a glowworm in cell `i` swims to next, or -1 with nowhere to go: from a drill that is near, the side
  // that takes it furthest from it; otherwise on the way it was going, turning now and then, and seldom back.
  swimWay(i, m, flee) {
    const d = this.drill, x = i % N, y = Math.floor(i / N), turn = cellHash(x, y, 31 + m.steps);
    const want = turn < 0.3 ? (m.way + (turn < 0.15 ? 1 : 3)) % 4 : m.way;
    let best = -1, most = -Infinity;
    for (let s = 0; s < 4; s++) {
      if (!this.swimInto(i + SIDE[s], m)) continue;
      const h = cellHash(x + DX[s], y + DY[s], 32 + m.steps);
      const score = flee ? (x + DX[s] + 0.5 - d.x) ** 2 + (y + DY[s] + 0.5 - d.y) ** 2 + h * 0.01 : s === want ? 2 + h : s === (m.way + 2) % 4 ? h - 1 : h;
      if (score > most) { most = score; best = s; }
    }
    return best;
  }
  // The pull a lodestone `s` with its heart at `i` makes next: { from, to }, the ore it takes and the rock beside
  // its clump that the ore takes the place of, or null where there is none. Ore that lies against the clump within
  // STONE.clump is part of it already. The ore is the nearest that is not, within STONE.reach of the heart and the
  // tether's reach, in no pocket and not the cell the bit is in; the rock, the nearest the heart within STONE.clump
  // of it that is beside the clump, of a kind it may crush, not ore, in no pocket and not the bit's.
  pullOf(i, s) {
    const w = this.world, d = this.drill, x = i % N, y = Math.floor(i / N), clump = new Set(s.clump), ore = k => k === K.ORE_A || k === K.ORE_B;
    const beside = j => SIDE.some(q => clump.has(j + q)), mine = j => j !== d.dig && w.row(j).pocket === null;
    for (let more = true; more;) {
      more = false;
      for (let v = -3; v <= 3; v++) for (let u = -3; u <= 3; u++) {
        const j = i + v * N + u;
        if (u * u + v * v <= STONE.clump && !clump.has(j) && ore(w.k(j)) && beside(j)) { clump.add(j); s.clump.push(j); more = true; }
      }
    }
    let from = -1, to = -1, least = Infinity;
    for (let v = -6; v <= 6; v++) for (let u = -6; u <= 6; u++) {
      const j = i + v * N + u, far = u * u + v * v + cellHash(x + u, y + v, 33) * 0.5;
      if (far < least && u * u + v * v <= STONE.reach * STONE.reach && ore(w.k(j)) && !clump.has(j) && mine(j) && this.within(x + u + 0.5, y + v + 0.5)) { least = far; from = j; }
    }
    if (from < 0) return null;
    least = Infinity;
    for (let v = -3; v <= 3; v++) for (let u = -3; u <= 3; u++) {
      const j = i + v * N + u, k = w.k(j), far = u * u + v * v + cellHash(x + u, y + v, 34) * 0.5;
      if (far < least && u * u + v * v <= STONE.clump && CRUSH[k] && !ore(k) && !clump.has(j) && mine(j) && beside(j)) { least = far; to = j; }
    }
    return to < 0 ? null : { from, to };
  }
  // Lava has come into cell `i`: the slag beside it is quenched to steel, white for a moment. A sleeping pocket's
  // rind is dull slag, worth little; woken, the lava makes steel of all the slag it touches, where it lay and
  // wherever it pours. Nothing opens or closes, so the books of loose ground are as they were, and the ground is
  // drawn again. With the bellows (the lava skin's second level) the lava quenches every cell of slag within two of
  // it (RING2): the four sides as ever, and the cells further out only in no pocket and within the tether's reach,
  // as everything the ground does in play is. The fitting is told when three or more turn at once. Returns how many
  // cells turned.
  quench(i) {
    const w = this.world, bellows = this.val('lavaskin') >= 2, ring = bellows ? RING2 : SIDE;
    let turned = 0;
    for (let n = 0; n < ring.length; n++) {
      const j = i + ring[n];
      if (w.k(j) !== K.SLAG) continue;
      const x = j % N, y = Math.floor(j / N);
      if (bellows && RING2_FAR[n] && (w.row(j).pocket !== null || !this.within(x + 0.5, y + 0.5))) continue;
      w.setK(j, K.STEEL); this.quenched.set(j, QUENCH); turned++;
      if (this.onScreen(x, y)) this.sparkle((x + 0.5) * T, (y + 0.5) * T, 4, '#d8e8ff');
    }
    if (turned) { this.version++; if (this.onScreen(i % N, Math.floor(i / N))) { sfx.clink(); sfx.hiss(); } }
    if (bellows && turned >= 3) this.fitter.fire('lavaskin');
    return turned;
  }
  // A charged crystal arcs. The drill is jolted if it is near; every crystal within three cells is set to follow;
  // and the slate among the eight cells round the crystal is shattered (`shatters`). Crystals stud the flanks of
  // slate, so one nick, and room to pull back while the fuse burns, unzips a rib. Shattered slate is crushed: it
  // pays nothing. Returns the cells opened, for `changed`: whoever called tells the books of loose ground once, with
  // everything that opened together, so ground the slate was holding is known as loose.
  zap(x, y) {
    const w = this.world, d = this.drill;
    this.effect('zap', 'impact', (x + 0.5) * T, (y + 0.5) * T);
    sfx.zap();
    if (Math.max(Math.abs(d.x - x - 0.5), Math.abs(d.y - y - 0.5)) <= ARC) {
      // (Fitted with the arc coil, the arc is taken in: it mends a pip where it would have taken one.)
      // (And at its second level, the capacitor, the bit holds the charge for the next cut: CHARGE.)
      if (this.val('arccoil')) { if (this.dents) { this.dents--; this.mended = 0.5; } if (this.val('arccoil') >= 2) this.charge = CHARGE; this.popup(d.x - 0.5, d.y - 1, 'CHARGED', '#d8b8ff'); sfx.gem(4); this.fitter.fire('arccoil'); }
      else this.hit(JOLT.arc);
      this.shake = Math.max(this.shake, 5); this.twang = 0.3;
    }
    for (let v = -3; v <= 3; v++) for (let u = -3; u <= 3; u++) {
      const j = (y + v) * N + x + u;
      if ((u || v) && w.hazAt(j) === 'spark' && !this.sparks.has(j)) this.sparks.set(j, { fuse: 0.3 + cellHash(u, v, 7) * 0.3, cool: 0 });
    }
    const opened = this.shatters(x, y), react = w.row(y * N + x).react;
    // In a seam whose arcs thaw (`REACT`), the ice round the crystal opens with the slate; in one whose lava sets as
    // glass, the arc wakes the lava round it.
    let woke = null;
    if (react === 'thaw' || react === 'glass') for (let v = -REACT; v <= REACT; v++) for (let u = -REACT; u <= REACT; u++) {
      const j = (y + v) * N + x + u;
      if (!(u || v) || w.row(j).react !== react || w.row(j).pocket !== null || !this.within(x + u + 0.5, y + v + 0.5)) continue;
      if (react === 'thaw' && w.k(j) === K.ICE && !opened.includes(j)) opened.push(j);
      else if (react === 'glass' && w.hazAt(j) === 'lava') (woke ??= []).push(...this.trigger(j, 'lava', false));
    }
    const thawed = react === 'thaw' && opened.some(j => w.k(j) === K.ICE);
    this.openShattered(opened);
    if (thawed) this.reacted('thaw', x, y);
    if (woke) opened.push(...woke);
    // An arc lights what it breaks: the ground it opened, and what stood behind, is seen.
    if (opened.length) { sfx.dig(3); w.see(x, y, 2); }
    return opened;
  }
  // How near the drill a cell is to be heard: 1 beside it, 0 HEAR cells off and further.
  near(x, y) { return Math.max(0, 1 - Math.hypot(x + 0.5 - this.drill.x, y + 0.5 - this.drill.y) / HEAR); }
  // A seam's reaction at (x, y) is shown and heard (js/feel.js: `react`, a burst in the seam's two parents'
  // colours and its sound), and says so in a word where it happened, if that is on the screen, no more often than
  // every REACT_SAY seconds of each.
  reacted(what, x, y) {
    if (this.feel.react) this.feel.react(this, y * N + x); else sfx[what]?.(this.near(x, y));
    if (this.time - this.saidAt[what] < REACT_SAY) return;
    this.saidAt[what] = this.time;
    const [word, colour] = REACT_SAYS[what];
    if (this.onScreen(x, y)) this.popup(x, y - 1, word, colour);
  }
  // The slate an arc from the crystal at (x, y) shatters: every cell of slate among the eight round it that the
  // tether can reach. With `dense` (the capacitor's charge let go into a cut there), dense rock too, and never a
  // cell of a pocket's ground.
  shatters(x, y, dense = false) {
    const w = this.world, cells = [];
    for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) {
      const j = (y + v) * N + x + u, k = w.k(j);
      if (!(u || v) || !(k === K.SLATE || (dense && k === K.DENSE)) || !this.within(x + u + 0.5, y + v + 0.5)) continue;
      if (dense && w.row(j).pocket !== null) continue;
      cells.push(j);
    }
    return cells;
  }
  // Shattered ground opens: each cell with a crack and chips of its own on the screen, and in the north each to
  // be closed over by the frost, as any cut is. Whoever shattered it tells the books of loose ground.
  openShattered(cells) {
    const w = this.world;
    for (const j of cells) {
      const jx = j % N, jy = Math.floor(j / N), k = w.k(j);
      w.setK(j, K.EMPTY);
      // (Open ground in the north closes over with ice, whatever opened it.)
      if (w.row(j).freeze > 0) { w.dug.set(j, this.clock); this.frostOpen.push(j); }
      if (!this.onScreen(jx, jy)) continue;
      this.chips(jx, jy, k === K.SLATE ? DEBRIS.slate : this.debris(k, w.b(j)), 8, null, 0.9);
      this.effect('shatter', 'shatter', (jx + 0.5) * T, (jy + 0.5) * T);
    }
  }
  // Vein frost: does a cut that is closing over lie beside ore? Then it heals as ore, the plainer kind, where it
  // would have closed with ice: a vein grows a cell into the cut made against it. Only ore the world itself laid
  // counts (`World.first`), never ore that healed: a cut beside healed ore closes with ice, or one cut against one
  // nugget would turn the whole tunnel behind it to ore, cell after cell as each closed beside the last.
  veined(i) {
    const w = this.world;
    for (const s of SIDE) { const k = w.k(i + s); if ((k === K.ORE_A || k === K.ORE_B) && w.first(i + s) === k) return true; }
    return false;
  }
  // The spore pods that go off with a pod: itself and every pod joined to it through pods, side by side or corner
  // to corner. A pod that bursts sets off the pods round it a moment later (`updateHazards`), so one nick takes a
  // whole bunch. They are added to `into` (BUNCH at the most, and none twice), which is returned.
  bunch(j, into = []) {
    const w = this.world;
    let n = into.indexOf(j);
    if (n < 0) n = into.push(j) - 1;
    for (const most = into.length + BUNCH; n < into.length && into.length < most; n++) {
      if (w.hazAt(into[n]) !== 'spore') continue;
      for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) {
        const q = into[n] + v * N + u;
        if ((u || v) && w.hazAt(q) === 'spore' && !into.includes(q)) into.push(q);
      }
    }
    return into;
  }
  // A hazard's bite: the drill is knocked senseless for a moment.
  jolt(time) { const d = this.drill; d.stun = Math.max(d.stun, time); this.hurt = time; d.vx = d.vy = 0; d.dig = -1; }

  // ------------------------------------------------------------ the hull
  // What knocks the hull, and what does not. A knock is lava (cut into, pushed into, or poured on to the drill's
  // body), the arc of a charged crystal within its reach, and the burst of a spore pod beside the drill; and of the
  // rare hazards, a bell's toll near it, a fumarole's jet, a glowworm's bite and ore a lodestone pulls across it.
  // Frost does not: ice only closes a cut behind the drill, and never on it. Nor does moss growing back, slag
  // turning to steel, the end of the tether's reach, a throw that fetches up against rock, rubble on its way home,
  // or the drill's own charge.
  //
  // A blow that lands takes a pip and stuns for a moment (`jolt`), and for SHIELD seconds after nothing lands
  // again, pip or stun: time to get clear, and the drill blinks to say so. With one pip left it smokes. With the
  // last gone it is a wreck (`wreck`). Returns whether the blow landed.
  hit(time) {
    const d = this.drill;
    if (d.mode === 'dead' || this.shield > 0) return false;
    this.jolt(time);
    this.dents++; this.knocks++; this.shield = SHIELD; this.knocked = 0.5; this.mendIn = 0;
    // (A knock stops the flywheel's run.)
    this.spin.n = 0;
    this.shake = Math.max(this.shake, 4);
    sfx.knock();
    this.effect('sparks', 'sparks', d.x * T, d.y * T);
    if (this.hull <= 0) this.wreck();
    return true;
  }
  // The last pip is gone: the drill is lost. It lies dead where it is for DEATH seconds while the screen goes dark
  // (`dying`), and then the game is what it was at the last docking (`revert`). The screen says what happened.
  wreck() {
    const d = this.drill;
    d.mode = 'dead'; d.stun = 0; d.dig = -1; d.vx = d.vy = 0; d.run = 0; d.speed = 0;
    this.preview = []; this.shield = 0;
    this.tow = { t: 0 };
    this.wrecks++;
    this.banner = null; this.notice = { title: 'HULL GONE', colour: '#ff7a5a', t: 0, life: DEATH + 0.3 };
    this.shake = Math.max(this.shake, 8); this.smokeIn = 0;
    sfx.wreck();
    this.effect('steam', 'smoke-puff', d.x * T, d.y * T);
    this.chips(d.x - 0.5, d.y - 0.5, WRECKAGE, 14, null, 1);
  }
  dying(dt) {
    const d = this.drill;
    d.px = d.x; d.py = d.y;
    this.tow.t += dt;
    if (this.tow.t >= DEATH) this.revert(); else this.look();
  }
  // What a part of a frame took is added up by name (`timed`), and when the whole frame took a fifth of a second
  // or more the frame is written down: how long from the frame before, how long the game's own stepping and
  // drawing took of that, and the part that took longest. The rest is the browser's (its own drawing, its
  // collecting of memory, the phone doing something else). The last five are kept and shown in the menu.
  timed(name, t0) { this.probe[name] = (this.probe[name] ?? 0) + performance.now() - t0; }
  frameTook(gap, update, render) {
    const probe = this.probe; this.probe = {};
    if (!(gap >= 200) || gap > 60000) return;
    const [top, ms] = Object.entries(probe).sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
    this.stalls.push({ gap: Math.round(gap), update: Math.round(update), render: Math.round(render), top, ms: Math.round(ms), out: Math.round(this.far), pieces: this.pieces.length, hauls: this.hauls.length });
    this.stalls = this.stalls.slice(-5);
    try { localStorage.setItem('tetherbore-stalls', JSON.stringify(this.stalls)); } catch { /* not kept */ }
  }
  // A frame that threw (js/main.js catches it, and the game goes on): written down among the long frames, what was
  // thrown and where, no more than one a second.
  failed(error) {
    console.error(error);
    const now = performance.now();
    if (now - (this.failedAt ?? -1e9) < 1000) return;
    this.failedAt = now;
    const where = /at (?:\w+\.)?(\w+)/.exec(String(error?.stack ?? '').split('\n')[1] ?? '')?.[1] ?? '';
    this.stalls.push({ err: String(error?.message ?? error).slice(0, 80), where, out: Math.round(this.far) });
    this.stalls = this.stalls.slice(-5);
    try { localStorage.setItem('tetherbore-stalls', JSON.stringify(this.stalls)); } catch { /* not kept */ }
  }
  // The docking the game goes back to: what is banked, bought and known now, and the ground as it is now (the
  // world keeps what it changes from here on, `World.mark`). Made on leaving the core, and when a game begins.
  dockMark() {
    this.docked = JSON.stringify(this.S);
    this.world.mark();
  }
  // The drill was lost: the game is again what it was at the last docking. What was banked, bought, analysed, met
  // and found since is gone, and so is every cut made and every haul taken since: the ground is as it was. The
  // drill stands whole in the middle of the core, and the screen says what the trip cost.
  //
  // The black box keeps a share of the grit the trip had earned; and from its third level (LORE) everything learnt
  // on it besides: the lab's samples, the grounds and pockets met, the rare hazards met and the kinds of creature.
  // (Not a wreck's part or a relic: those lie where the drill was lost, and are fetched again. Nor the trip's gems
  // or specimens: the ground comes back with the docking, a pocket's mineral and a spent den with it, so a share of
  // them kept made every pocket pay three quarters of its specimens again on each trip lost, without end. Grit is
  // paid by any cell, and was never what a level waits on.)
  revert() {
    const lost = this.S, was = JSON.parse(this.docked), earned = Math.max(0, Math.round(lost.grit - was.grit));
    this.S = was;
    const share = this.val('blackbox'), kept = Math.round(earned * share), gone = earned - kept;
    this.S.grit += kept;
    if (lost.lv.blackbox >= LORE) this.keepLore(lost);
    this.world.back();
    this.version++;
    this.begin();
    this.drill.armed = false; this.drill.park = true;
    this.notice = { title: 'TRIP LOST', sub: gone > 0 ? `-${compact(gone)} GRIT${kept > 0 ? `, ${compact(kept)} KEPT` : ''}` : '', colour: '#ff7a5a', t: 0, life: 3 };
    this.flash = 0.25; sfx.dock();
    this.save();
  }
  // What the black box keeps from the game that was lost (`lost`, its state at the wreck) in the one gone back to
  // (`this.S`): every sample, ground, pocket, rare hazard and kind of creature met since the docking, as many
  // samples of a thing as either has.
  keepLore(lost) {
    const S = this.S;
    S.lab ??= {}; S.met ??= {}; S.visited ??= {}; S.rare ??= {};
    for (const key in lost.lab ?? {}) S.lab[key] = Math.max(S.lab[key] ?? 0, lost.lab[key]);
    for (const key in lost.met ?? {}) S.met[key] = 1;
    for (const key in lost.visited ?? {}) S.visited[key] = 1;
    for (const key in lost.rare ?? {}) S.rare[key] = 1;
    const met = lost.fauna?.met;
    if (met && Object.keys(met).length) { S.fauna ??= { pal: null, met: {}, spent: [] }; S.fauna.met ??= {}; for (const key in met) S.fauna.met[key] = 1; }
  }
  // The hull is made whole, for nothing, whenever the drill rides on to the core.
  // Returns whether there was anything to mend.
  mend() {
    if (!this.dents) return false;
    const d = this.drill;
    this.dents = 0; this.shield = 0; this.knocked = 0; this.mended = 0.7; this.smokeIn = 0;
    sfx.mend();
    this.ring(d.x * T, d.y * T, '#bfe6ff', 18); this.sparkle(d.x * T, d.y * T, 8, '#eaf6ff');
    return true;
  }
  // The cells the tether lies in (`under`), as the frost and anything else that would close a cell asks them
  // (`updateHazards`'s `lies`; js/fauna.js before it lays a plug of ice).
  layUnder() {
    const d = this.drill;
    this.under.clear();
    // Both as it is drawn and as it truly runs, corner to corner (taken a hair short of each corner, which
    // belongs to four cells at once). The true line is taken a hair to either side of itself as well: a span
    // that lies along a grid line has a cell on each side of it and one through a grid point has four, and
    // were any of them to close the string would be left with rock on both sides.
    const L = this.lay(), P = this.band, under = this.under;
    const along = (x0, y0, x1, y1) => { for (const c of cellsAlong(x0, y0, x1, y1)) under.add(c); };
    for (let n = 1; n < L.length; n++) {
      along(L[n - 1][0], L[n - 1][1], L[n][0], L[n][1]);
      const sx = P[n][0] - P[n - 1][0], sy = P[n][1] - P[n - 1][1], len = Math.hypot(sx, sy) || 1, ex = sx * 1e-4, ey = sy * 1e-4;
      for (const side of [0, 1e-3, -1e-3]) {
        const ox = -sy / len * side, oy = sx / len * side;
        along(P[n - 1][0] + ex + ox, P[n - 1][1] + ey + oy, P[n][0] - ex + ox, P[n][1] - ey + oy);
      }
    }
    // A drill thrown or being reeled home: nothing closes on the line of its flight, as wide as it is, or where
    // it will come down.
    if (d.mode === 'fling' || d.mode === 'home') {
      const sx = d.tx - d.x, sy = d.ty - d.y, len = Math.hypot(sx, sy) || 1;
      for (const side of [0, BODY, -BODY]) along(d.x - sy / len * side, d.y + sx / len * side, d.tx - sy / len * side, d.ty + sx / len * side);
      for (const [u, v] of [[-BODY, -BODY], [BODY, -BODY], [-BODY, BODY], [BODY, BODY]]) under.add(Math.floor(d.ty + v) * N + Math.floor(d.tx + u));
    }
  }
  updateHazards(dt) {
    const w = this.world, d = this.drill, here = this.di, dcx = Math.floor(d.x), dcy = Math.floor(d.y);
    // The cells that open and that grow back in this pass, for `changed`.
    const opened = [], closed = [];
    // Ground never grows back across the tether: where it lies is worked out afresh, at the moment it is asked.
    let fresh = false;
    const lies = i => {
      if (!fresh) { fresh = true; this.layUnder(); }
      return this.under.has(i);
    };
    for (const [i, t] of this.quenched) { if (t > dt) this.quenched.set(i, t - dt); else this.quenched.delete(i); }
    // Lava: a pocket pours a stream as long as its volume down the open ground, then sets. Slag beside a cell the
    // lava comes into is quenched to steel (`quench`).
    this.lavaTick = (this.lavaTick ?? 0) + dt;
    const flow = this.lavaTick >= 0.26;
    if (flow) this.lavaTick = 0;
    for (const [i, life] of [...w.lava]) {
      const x = i % N, y = Math.floor(i / N);
      if (flow) {
        const vol = this.lavaVol.get(i) ?? 1, start = (cellHash(x, y, (this.time * 10) | 0) * 4) | 0;
        for (let s = 0; s < 4; s++) {
          const j = (y + DY[(s + start) % 4]) * N + x + DX[(s + start) % 4], haz = w.hazAt(j);
          if (haz === 'lava') { opened.push(...this.trigger(j, 'lava', false)); continue; }
          // (In a seam whose pods burn, `REACT`, lava sets off a pod beside it: it burns off.)
          if (haz === 'spore' && w.row(j).react === 'burn') { opened.push(...this.trigger(j, 'spore', false, true)); continue; }
          if (vol > 1 && w.k(j) === K.EMPTY && !w.lava.has(j) && j !== here && w.s(j) && Math.hypot(x - C, y - C) > 3) {
            w.lava.set(j, 8); this.lavaVol.set(j, vol - 1); this.lavaVol.set(i, 1);
            this.lavaMoved(j);
            this.quench(j);
            break;
          }
        }
      }
      if (life - dt > 0) { w.lava.set(i, life - dt); continue; }
      w.lava.delete(i); this.lavaVol.delete(i); this.lavaMoved(i);
      // (Nothing closes over in a pocket: lava that ran into one only goes out.)
      if (!lies(i) && Math.abs(dcx - x) + Math.abs(dcy - y) > 1 && w.row(i).pocket === null) {
        // (In a seam whose lava sets as glass, `REACT`, it does: never in the drill's cell or the eight round it.)
        const glass = w.row(i).react === 'glass' && Math.max(Math.abs(dcx - x), Math.abs(dcy - y)) > 1;
        w.setK(i, glass ? K.GLASS : K.BASALT); closed.push(i);
        this.effect('steam', 'smoke-puff', (x + 0.5) * T, (y + 0.5) * T);
        if (glass) this.reacted('glass', x, y);
      }
    }
    // Spores: a burst pod hangs a cloud that stuns what flies into it, then moss closes the ground round it: soft
    // rock of whatever ground each cell lies in. The pods round one that has burst, side by side or corner to
    // corner, burst a moment after it, so a bunch of pods goes off one after another from a single nick (`bunch`
    // says which, for the glow). (A pod woken here joins the list and is met later in this same pass, a moment
    // younger.)
    for (const c of this.clouds) {
      c.t += dt;
      // (A pod that rimed or burnt off knocks nothing: `trigger`.)
      if (!c.rime && !c.burnt && Math.max(Math.abs(dcx - c.x), Math.abs(dcy - c.y)) <= 1 && c.t < 0.2) {
        // (Fitted with the spore drive, the burst drives the drill where it would have knocked it.)
        if (!this.val('sporedrive')) this.hit(JOLT.spore);
        else { if (this.boost < BOOST.time - 0.5) { this.popup(d.x - 0.5, d.y - 1, 'BOOST', '#b8f06a'); sfx.gem(6); } this.boost = BOOST.time; }
      }
      if (!c.spread && c.t >= POD_CHAIN) {
        c.spread = true;
        for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) { const j = (c.y + v) * N + c.x + u; if (w.hazAt(j) === 'spore') opened.push(...this.trigger(j, 'spore', false, c.burnt)); }
      }
      if (c.t < c.life) continue;
      // A pod burnt off leaves nothing; one that rimed, the open ground two round it closed with ice (but its own
      // cell): never the drill's cell or the eight round it, never where the tether lies, in no pocket.
      if (c.burnt) continue;
      if (c.rime) {
        for (let v = -2; v <= 2; v++) for (let u = -2; u <= 2; u++) {
          const j = (c.y + v) * N + c.x + u;
          if ((u || v) && w.k(j) === K.EMPTY && !lies(j) && !w.lava.has(j) && Math.max(Math.abs(dcx - c.x - u), Math.abs(dcy - c.y - v)) > 1 && w.row(j).pocket === null) { w.setK(j, K.ICE); closed.push(j); }
        }
        if (this.onScreen(c.x, c.y)) this.effect('freeze', 'impact', (c.x + 0.5) * T, (c.y + 0.5) * T);
        continue;
      }
      // (With the graft, the spore drive's second level, moss that closes beside ore the world laid heals as that
      // ore does under the frost, `veined`: never beside ore that healed, so a graft cannot run on cell by cell; and
      // only within the tether's reach, as the bellows and the capacitor are held. A bunch of pods spreads past the
      // reach as it always has, and its moss closes there plain.)
      const graft = this.val('sporedrive') >= 2;
      let grafted = 0;
      for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) {
        const j = (c.y + v) * N + c.x + u;
        if (w.k(j) === K.EMPTY && !lies(j) && !w.lava.has(j) && Math.max(Math.abs(dcx - c.x - u), Math.abs(dcy - c.y - v)) > 1 && w.row(j).pocket === null) {
          const ore = graft && this.veined(j) && this.within(c.x + u + 0.5, c.y + v + 0.5);
          w.setK(j, ore ? K.ORE_A : K.SOFT); closed.push(j);
          if (ore) { grafted++; if (this.onScreen(c.x + u, c.y + v)) this.sparkle((c.x + u + 0.5) * T, (c.y + v + 0.5) * T, 6, '#b8f06a'); }
        }
      }
      if (grafted) { this.fitter.fire('sporedrive'); if (this.onScreen(c.x, c.y)) sfx.gem(0); }
    }
    this.clouds = this.clouds.filter(c => c.t < c.life);
    // Charged crystals: a short fuse, then an arc that jumps to every crystal near it.
    for (const [i, s] of this.sparks) {
      if (w.hazAt(i) !== 'spark') { this.sparks.delete(i); continue; }
      if (s.fuse > 0) { s.fuse -= dt; if (s.fuse <= 0) { s.cool = 3; opened.push(...this.zap(i % N, Math.floor(i / N))); } }
      else { s.cool -= dt; if (s.cool <= 0) this.sparks.delete(i); }
    }
    this.rareHazards(dt, opened);
    this.zipOn(dt, opened);
    // Frost: a cut in ground that freezes (the north's) closes over with ice, after as long as its row says, unless
    // the tether lies in it. Beside ore it closes as ore (`veined`).
    this.frostTick = (this.frostTick ?? 0) + dt;
    if (this.frostTick > 0.4) {
      this.frostTick = 0;
      this.frostOpen = this.frostOpen.filter(i => {
        const freeze = w.row(i).freeze;
        if (w.k(i) !== K.EMPTY || !freeze) { w.dug.delete(i); return false; }
        if (this.clock - w.dug.get(i) < freeze) return true;
        const x = i % N, y = Math.floor(i / N);
        if (lies(i) || Math.max(Math.abs(dcx - x), Math.abs(dcy - y)) <= 1 || w.lava.has(i)) return true;
        // Vein frost: beside ore the cut heals as ore, not as ice.
        const vein = this.veined(i);
        w.setK(i, vein ? K.ORE_A : K.ICE); w.dug.delete(i); closed.push(i);
        if (this.onScreen(x, y)) {
          this.effect('freeze', 'impact', (x + 0.5) * T, (y + 0.5) * T);
          if (vein) { this.sparkle((x + 0.5) * T, (y + 0.5) * T, 6, '#a8fff0'); sfx.gem(0); } else sfx.freeze();
        }
        return false;
      });
    }
    if (opened.length || closed.length) this.changed(opened, closed);
  }

  // The rare hazards awake, a step of `dt` seconds (`updateHazards`, which tells the books of loose ground of what
  // they opened, in `opened`, with the rest). Each is kept by the cell it is in and goes from the books of the
  // awake once that cell is no longer one of its kind: hauled, cut, or swum out of. (Woken again in the same pass,
  // by a jet, a hazard joins its list and is met next time.)
  rareHazards(dt, opened) {
    const w = this.world, d = this.drill;
    let swum = false;
    for (const list of [this.jets, this.flying, this.flares]) { for (const e of list) e.t -= dt; }
    this.jets = this.jets.filter(e => e.t > 0); this.flying = this.flying.filter(e => e.t > 0); this.flares = this.flares.filter(e => e.t > 0);
    // Rime bells: the fuse, the toll, and a while before one can ring again.
    for (const [i, b] of [...this.bells]) {
      if (w.hazAt(i) !== 'bell') { this.bells.delete(i); continue; }
      if (b.cool > 0) { if ((b.cool -= dt) <= 0) this.bells.delete(i); continue; }
      if ((b.t += dt) < BELL.fuse) continue;
      opened.push(...this.toll(i));
      b.cool = BELL.cool;
    }
    // Fumaroles: the rumble, three jets, and a while asleep.
    for (const [i, v] of [...this.vents]) {
      if (w.hazAt(i) !== 'vent') { this.vents.delete(i); continue; }
      if (v.cool > 0) { if ((v.cool -= dt) <= 0) this.vents.delete(i); continue; }
      v.t += dt;
      for (; v.pulses < VENT.pulses.length && v.t >= VENT.pulses[v.pulses]; v.pulses++) opened.push(...this.jet(i, v.way, v.pulses === 0));
      if (v.pulses >= VENT.pulses.length) v.cool = VENT.cool;
    }
    // Glowworms: each swims a cell at a time, bites a drill that comes close and darts away two cells at once, and
    // coils up where it is after a while, or with the drill far off.
    for (const [i, m] of [...this.worms]) {
      if (w.hazAt(i) !== 'worm') { this.worms.delete(i); continue; }
      const x = i % N, y = Math.floor(i / N), far = Math.hypot(d.x - x - 0.5, d.y - y - 0.5);
      m.t += dt; m.since += dt; m.trailT -= dt;
      if (m.t > WORM.awake || far > WORM.lose) { this.worms.delete(i); continue; }
      let steps = 0;
      if (far <= WORM.bite && d.mode !== 'dead') { if (!m.close) { this.wormBite(x, y); steps = 2; } m.close = true; } else m.close = false;
      if (!steps && (m.wait -= dt) > 0) continue;
      const flee = far <= WORM.flee;
      for (let at = i, n = Math.max(1, steps); n > 0; n--) {
        const s = this.swimWay(at, m, flee || steps > 0);
        if (s < 0) { m.stuck = true; m.wait = 0.25; break; }
        const j = at + SIDE[s], time = this.swimInto(j, m);
        this.swap(at, j); swum = true;
        this.worms.delete(at); this.worms.set(j, m);
        Object.assign(m, { from: at, since: 0, way: s, steps: m.steps + 1, stuck: false, trail: at, trailT: WORM.trail, wait: flee || steps ? time : Math.max(time, WORM.wander) });
        const jx = j % N, jy = Math.floor(j / N);
        if (this.onScreen(jx, jy)) sfx.gnaw(Math.max(0, Math.min(1, 1 - Math.hypot(d.x - jx - 0.5, d.y - jy - 0.5) / 12)));
        at = j;
      }
    }
    // Lodestones: the hum, then a pull at a time, each shown a pull ahead; then it settles.
    for (const [i, s] of [...this.stones]) {
      if (w.hazAt(i) !== 'lodestone') { this.stones.delete(i); continue; }
      if (s.cool > 0) { if ((s.cool -= dt) <= 0) this.stones.delete(i); continue; }
      if ((s.t += dt) < STONE.hum) continue;
      const ore = k => k === K.ORE_A || k === K.ORE_B, sound = p => p && ore(w.k(p.from)) && CRUSH[w.k(p.to)] && !ore(w.k(p.to)) && p.from !== d.dig && p.to !== d.dig;
      // (What was to be pulled may have been cut or hauled since it was shown: another is shown in its place.)
      if (s.next !== null && !sound(s.next)) { s.next = this.pullOf(i, s); s.at = s.t + STONE.every; }
      if (s.next !== null && s.t < s.at) continue;
      if (s.next !== null) {
        const { from, to } = s.next, fx = from % N, fy = Math.floor(from / N), tx = to % N, ty = Math.floor(to / N), over = this.overlay(w.k(from), w.row(from), from);
        this.swap(from, to); swum = true;
        s.clump.push(to); s.n++;
        if (over) this.flying.push({ over, x0: fx, y0: fy, x1: tx, y1: ty, t: STONE.fly });
        // (Heard and seen on the screen only: a pull comes every few tenths of a second.)
        if (this.onScreen(tx, ty)) { this.effect('sparks', 'sparks', (tx + 0.5) * T, (ty + 0.5) * T); sfx.pull(); }
        if (d.mode !== 'dead' && gap(d.x, d.y, fx + 0.5, fy + 0.5, tx + 0.5, ty + 0.5) <= STONE.knock) this.hit(JOLT.ore);
        s.next = s.n < STONE.most && s.t < STONE.hum + STONE.for ? this.pullOf(i, s) : null; s.at = s.t + STONE.every;
        if (s.next !== null) continue;
      }
      // Nothing more to pull, or pulled for long enough: it settles with what it has gathered.
      const x = i % N, y = Math.floor(i / N);
      sfx.gather(s.n); this.ring((x + 0.5) * T, (y + 0.5) * T, '#b48cff', 24); this.sparkle((x + 0.5) * T, (y + 0.5) * T, 8, '#d8e0ff');
      s.cool = STONE.cool;
    }
    // (The ground is drawn again once a frame for all the swaps in it.)
    if (swum) this.version++;
  }

  // ------------------------------------------------------------ shop
  // What a row's next level costs: { grit, gems, gem, spec }, `gem` being whose gems they are (the row's, or the
  // level's own where a late level asks another's: js/shop.js, `gemAt`); or null at its last level.
  cost(u) {
    const l = this.S.lv[u.id];
    if (l >= u.values.length - 1) return null;
    // (The next reach costs less where little is left of the ground this one reaches: `groundLeft`.)
    return { grit: u.id === 'tether' ? round2(Math.max(1, u.grit[l] * this.groundLeft())) : u.grit[l], gems: u.gems[l], gem: u.gemAt?.[l] ?? u.gem, spec: u.spec ? u.spec[l] : 0 };
  }
  // What the next reach costs, as a share of its price, for the ground that is left within this one: the whole
  // price while three cells in ten of the reach still stand (ground as the seed lays it is two thirds rock or
  // more), and from there down with the square of what stands, to next to nothing. So a game can never be left
  // with nothing to cut and a rope it cannot pay for. Counted on a grid of some two thousand cells across the
  // reach, of the ground as it is known (ground nobody has looked at stands), once for each change to the ground.
  groundLeft() {
    const R = this.val('tether'), key = `${this.version}:${R}`;
    if (this.leftFor === key) return this.leftIs;
    const w = this.world, step = Math.max(2, Math.floor(R / 25));
    let all = 0, stands = 0;
    for (let y = -R; y <= R; y += step) for (let x = -R; x <= R; x += step) {
      if (x * x + y * y > R * R || (Math.abs(x) < 3 && Math.abs(y) < 3)) continue;
      all++;
      if (w.laid((C + y) * N + C + x) !== K.EMPTY) stands++;
    }
    const share = all ? stands / all : 1, by = Math.min(1, share / 0.3);
    this.leftFor = key; this.leftIs = by * by;
    return this.leftIs;
  }
  // What a row's next level asks to have been found, and what is held of it: { what, have, need }, or null where
  // it asks nothing (or there is no next level). A wreck the seed did not lay whole (another thing lies where it
  // should) is not asked for: nothing that cannot be found is ever needed.
  need(u) {
    const l = this.S.lv[u.id];
    if (!u.needs || l >= u.values.length - 1) return null;
    // (A level may ask for something of another kind than its row does: [kind, count].)
    const asked = u.needs[1][l], [what, count] = Array.isArray(asked) ? asked : [u.needs[0], asked], S = this.S, w = this.world;
    let need = count, have = 0;
    if (what === 'parts') {
      const held = S.wrecks ?? [];
      have = held.filter(Boolean).length;
      for (let n = 0; n < count && n < w.wrecks.length; n++) { const [x, y] = w.wrecks[n]; if (!held[n] && w.kindAt(x, y, w.biomeAt(x, y)) !== K.WRECK) need--; }
    } else if (what === 'kinds') have = LAB.filter(e => S.lab[e.key]).length;
    else if (what === 'out') have = Math.floor(S.out ?? 0);
    else if (what === 'relics') have = S.relics.filter(Boolean).length;
    // (Kinds of creature met: none in a game saved before there were creatures, or played with them left out.)
    else if (what === 'beasts') have = S.fauna?.met ? Object.keys(S.fauna.met).length : 0;
    else have = Object.keys(S.met).length;
    return need > 0 ? { what, have, need } : null;
  }
  // What is still to be found before a row's next level can be bought, as the shop says it; or null.
  lacks(u) { const q = this.need(u); return q && q.have < q.need ? `NEEDS ${q.have}/${q.need} ${NEEDS[q.what]}` : null; }
  // The whole specimens of a direction that are in hand.
  specs(kin) { return Math.floor((this.S.spec[kin] ?? 0) + 1e-9); }
  // What can be spent is what has come home: grit and gems still on their way up the tether are not banked yet,
  // and the top bar never shows them (nor ever less than nothing).
  // (A gem a game has no place for yet is none.)
  banked(gem) { return gem === undefined ? this.S.grit - this.pending.grit : (this.S.gems[gem] ?? 0) - (this.pending.gems[gem] ?? 0); }
  canBuy(u) { const c = this.cost(u); return !!c && this.banked() >= c.grit && this.banked(c.gem) >= c.gems && (!c.spec || this.specs(u.kin) >= c.spec) && !this.lacks(u); }
  buy(u) {
    if (!this.canBuy(u)) {
      // Says what is missing, and where gems are to be had.
      const c = this.cost(u);
      if (c) {
        const gems = c.gems > this.banked(c.gem), spec = c.spec > 0 && this.specs(u.kin) < c.spec, lack = this.lacks(u);
        this.shopNote = { t: 2.5, color: lack ? '#ff9a6a' : gems ? GEM_COLOR[c.gem] : spec ? GEM_COLOR[u.kin] : '#ff7a5a', text: lack ?? (gems ? `GEMS: ${GEM_WHERE[c.gem]}, PAST ${GEM_PAST[c.gem]}` : spec ? `${GEM_WHERE[u.kin]} POCKETS` : 'NOT ENOUGH GRIT') };
        // (A row that asks only to be paid for is what the player is saving for now: js/goal.js.)
        if (!lack) pickGoal(this, u);
      }
      sfx.deny(); return;
    }
    const c = this.cost(u);
    this.S.grit -= c.grit; this.S.gems[c.gem] -= c.gems; if (c.spec) this.S.spec[u.kin] -= c.spec; this.S.lv[u.id]++; this.S.stats.buys++;
    sfx.buy();
    this.ring(HX * T, HY * T, '#8ce060', 70); this.sparkle(HX * T, HY * T, 16, '#c8f4a0'); this.flash = 0.15;
    if (u.id === 'scanner') { this.world.see(Math.floor(this.drill.x), Math.floor(this.drill.y), this.val('scanner')); this.version++; }
    this.bought = { id: u.id, t: 0.5 };
    this.fitter.bought(this, u, this.S.lv[u.id]);
    pickGoal(this);
    this.save();
  }

  // ------------------------------------------------------------ feel
  // Lava has run into the open cell `i`, or gone out of it, and the ground has not otherwise changed: what is drawn
  // in the cell (no piece of a cave's under lava) and what the feel knows of it (no vent) are looked at again, in
  // that piece of ground alone, and the ground's version, which the game's own work keys on, is left alone.
  lavaMoved(i) { this.redraw(i); this.feel.redraw(i); }
  // Chips of the ground's own colours (js/drawing.js: `debris`). `ang` is the way the drill was cutting (they fly
  // back at it), null for all round.
  chips(cx, cy, colors, count, ang, speed) {
    if (this.parts.length > 420) return;
    for (let n = 0; n < count; n++) {
      const a = Math.random() * 6.283, v = (20 + Math.random() * 70) * speed;
      let vx = Math.cos(a) * v, vy = Math.sin(a) * v;
      if (ang !== null) { vx -= Math.cos(ang) * 45 * speed; vy -= Math.sin(ang) * 45 * speed; }
      this.parts.push({ x: (cx + 0.2 + Math.random() * 0.6) * T, y: (cy + 0.2 + Math.random() * 0.6) * T, vx, vy, t: 0, life: 0.25 + Math.random() * 0.4,
        color: colors[(Math.random() * colors.length) | 0], size: Math.random() < 0.3 ? 2 : 1 });
    }
  }
  sparkle(x, y, count, color) {
    for (let n = 0; n < count; n++) {
      const a = Math.random() * 6.283, v = 30 + Math.random() * 90;
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 0.3 + Math.random() * 0.5, color, size: 1, star: Math.random() < 0.4 });
    }
  }
  // A ring of whole pixels spreading from a point: begun `delay` seconds from now, and spreading for `life`.
  ring(x, y, color, reach, delay = 0, life = 0.5) { this.rings.push({ x, y, color, reach, t: -delay, life }); }
  // The show a giant haul makes about (cx, cy), in pixels: `giant` is which (`giantOf`), the last being HALF, which
  // also sets the core blazing and sends rings out from it.
  grand(cx, cy, giant) {
    const half = giant > GIANTS.length, colours = ['#ffe14a', '#fff6c8', ...GEM_COLOR.slice(1, 5)];
    for (let k = 0; k < 2 + giant; k++) this.ring(cx, cy, colours[k % colours.length], 120 + 50 * k, 0.09 * k, 0.6 + 0.08 * k);
    for (let k = 0; k < colours.length; k++) this.sparkle(cx, cy, 6 + giant * 3, colours[k]);
    this.hitstop = Math.max(this.hitstop, Math.min(0.4, 0.18 + giant * 0.03));
    this.flash = Math.max(this.flash, half ? 1.2 : Math.min(0.8, 0.45 + giant * 0.06));
    this.shake = Math.max(this.shake, Math.min(16, 9 + giant));
    if (half) {
      this.coreFlash = 3;
      for (let k = 0; k < 6; k++) this.ring(HX * T, HY * T, colours[k % colours.length], 160 + 90 * k, 0.4 + 0.15 * k, 1.2);
      this.sparkle(HX * T, HY * T, 60, '#ffe14a');
    }
    sfx.vast(giant);
  }
  // The drill fetches up against ground at the end of a throw.
  land() {
    const d = this.drill, x = Math.floor(d.x + Math.cos(d.ang) * 0.8), y = Math.floor(d.y + Math.sin(d.ang) * 0.8), k = this.world.at(x, y);
    this.shake = Math.max(this.shake, 2.2);
    if (k !== K.EMPTY) this.chips(d.x - 0.5 + Math.cos(d.ang) * 0.5, d.y - 0.5 + Math.sin(d.ang) * 0.5, this.debris(k, this.world.b(y * N + x)), 6, d.ang, 0.8);
    this.effect('dust', 'dust', (d.x + Math.cos(d.ang) * 0.4) * T, (d.y + Math.sin(d.ang) * 0.4) * T);
  }
  // Everything that only sets the mood: chips in flight, rings, drifting motes, glints on ore, the colour of the
  // dark, and the sound of the place.
  ambient(dt) {
    const w = this.world, W = this.W, H = this.H;
    for (const p of this.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - 3.5 * dt; p.vy *= 1 - 3.5 * dt; }
    this.parts = this.parts.filter(p => p.t < p.life);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter(r => r.t < (r.life ?? 0.5));
    this.flash = Math.max(0, this.flash - dt); this.counted = Math.max(0, this.counted - dt);
    // The dark eases to the colour and the depth of the ground the drill is in.
    const here = w.row(this.di), want = here.gloom, k = 1 - Math.exp(-dt * 1.5);
    for (let c = 0; c < 3; c++) this.gloom[c] += (want[c] - this.gloom[c]) * k;
    const dx = this.drill.x - C, dy = this.drill.y - C, far = Math.sqrt(dx * dx + dy * dy);
    this.murk += (here.dark * (1 + DEEPEN[2] * Math.min(1, Math.max(0, (far - DEEPEN[0]) / DEEPEN[1]))) - this.murk) * k;
    // Motes hang in open ground near the view; each belongs to the ground it was born over.
    while (this.motes.length < 34) {
      const x = this.cam.x + (Math.random() - 0.5) * (W + 60), y = this.cam.y + (Math.random() - 0.5) * (H + 60), row = w.row(Math.floor(y / T) * N + Math.floor(x / T));
      this.motes.push({ x, y, seed: Math.random() * 100, t: 0, life: 4 + Math.random() * 5, mote: row.mote, air: row.air });
    }
    for (const m of this.motes) {
      m.t += dt;
      const drift = m.mote[1], sway = Math.sin(this.time * 1.3 + m.seed);
      if (drift === 'fall') { m.y += 9 * dt; m.x += sway * 6 * dt; }
      else if (drift === 'rise') { m.y -= 14 * dt; m.x += sway * 4 * dt; }
      else if (drift === 'sway') { m.y += Math.cos(this.time * 0.9 + m.seed) * 4 * dt; m.x += sway * 5 * dt; }
      else { m.y -= 2 * dt; m.x += sway * 2 * dt; }
    }
    this.motes = this.motes.filter(m => m.t < m.life && Math.abs(m.x - this.cam.x) < W / 2 + 40 && Math.abs(m.y - this.cam.y) < H / 2 + 40);
    // A glint now and then on ore in view.
    for (let n = 0; n < 2; n++) {
      const x = Math.floor((this.cam.x + (Math.random() - 0.5) * W) / T), y = Math.floor((this.cam.y + (Math.random() - 0.5) * H) / T), kk = w.peek(x, y);
      if ((kk === K.ORE_A || kk === K.ORE_B || kk === K.STEEL || kk === K.RELIC || kk === K.CACHE || kk === K.WRECK) && Math.random() < (kk === K.CACHE || kk === K.WRECK ? 1 : 0.5)) this.parts.push({ x: (x + 0.25 + Math.random() * 0.5) * T, y: (y + 0.25 + Math.random() * 0.5) * T, vx: 0, vy: 0, t: 0, life: 0.35, color: '#ffffff', size: 1, star: true });
    }
    setAmbience(here, here.rich >= 2, this.far);
    this.chime -= dt;
    if (this.chime <= 0) { this.chime = 2.5 + Math.random() * 4.5; sfx.chime(here); }
  }

  // ------------------------------------------------------------ small things
  effect(sheet, animation, x, y) { this.effects.push({ sheet, animation, x, y, t: 0 }); }
  // Words that rise from a cell and fade (with an icon of the `icons` sheet before them). The same words in the
  // same colour take the place of those already up.
  popup(cx, cy, label, color, icon) { this.popups = this.popups.filter(p => p.label !== label || p.color !== color); this.popups.push({ x: (cx + 0.5) * T, y: cy * T, label, color, icon, t: 0 }); }
  onScreen(x, y) { const sx = x * T - this.cam.x + this.W / 2, sy = y * T - this.cam.y + (this.H - 44) / 2; return sx > -T && sy > -T && sx < this.W && sy < this.H; }

  // ------------------------------------------------------------ update
  update(dt) {
    if (this.hitstop > 0) { this.hitstop -= dt; dt *= 0.15; }
    this.time += dt; this.S.stats.time += dt;
    const d = this.drill;
    this.twang = Math.max(0, this.twang - dt); this.coreFlash = Math.max(0, this.coreFlash - dt); this.hurt = Math.max(0, this.hurt - dt);
    this.edge = Math.max(0, this.edge - dt); d.stun = Math.max(0, d.stun - dt); d.squash = Math.max(0, d.squash - dt);
    this.shake = Math.max(0, this.shake - dt * 22);
    // How far out the drill has ever been.
    if (this.far > (this.S.out ?? 0)) this.S.out = this.far;
    this.boost = Math.max(0, this.boost - dt); this.charge = Math.max(0, this.charge - dt);
    // The mender gives a pip back every so many seconds out in the ground, counted from the last knock or mend.
    if (this.val('mender') && this.dents > 0 && d.mode !== 'dead') {
      this.mendIn += dt;
      if (this.mendIn >= this.val('mender')) { this.mendIn = 0; this.dents--; this.mended = 0.5; this.sparkle(d.x * T, d.y * T, 5, '#8ce060'); sfx.tick(0); if (this.S.lv.mender > 0) this.fitter.fire('mender'); }
    } else this.mendIn = 0;
    this.shield = Math.max(0, this.shield - dt); this.knocked = Math.max(0, this.knocked - dt); this.mended = Math.max(0, this.mended - dt);
    if (this.notice) { this.notice.t += dt; if (this.notice.t > this.notice.life) this.notice = null; }
    // A hull with one knock left in it smokes and spits sparks, so the bar need not be read; a wreck trails smoke.
    if (d.mode === 'dead' || (this.dents > 0 && this.hull === 1)) {
      this.smokeIn -= dt;
      if (this.smokeIn <= 0) {
        const wreck = d.mode === 'dead';
        this.smokeIn = wreck ? 0.09 : 0.32;
        if (this.parts.length < 400) for (let n = 0; n < 2; n++) this.parts.push({ x: d.x * T + (Math.random() - 0.5) * 6, y: d.y * T + (Math.random() - 0.5) * 6, vx: (Math.random() - 0.5) * 14, vy: -10 - Math.random() * 16, t: 0, life: 0.5 + Math.random() * 0.5, color: SMOKE[(Math.random() * SMOKE.length) | 0], size: 2 });
        if (!wreck && Math.random() < 0.5) this.effect('sparks', 'sparks', d.x * T, d.y * T);
      }
    }
    if (this.bought) { this.bought.t -= dt; if (this.bought.t <= 0) this.bought = null; }
    if (this.confirmReset > 0) this.confirmReset -= dt;
    if (this.labFlash > 0) this.labFlash -= dt;
    this.stepLab(dt);
    if (!this.shop && !this.lab) {
      // The clock the ground's own changes are timed by (a cut in the north icing over) stands still with the shop
      // or the lab's notes open, as the lava, the spores and the sparks do: nothing comes due behind them.
      this.clock += dt;
      this.fly(dt);
      this.tend();
      // Ground the string came to lie against on the way: is any of it loose, though nobody knew?
      let met = this.taken.length > 0 && this.discover(this.taken.splice(0), 600, this.walked);
      this.reelTick = (this.reelTick ?? 0) + dt;
      // (A pocket's own rules: caps light as the drill flies by, and a ring of fuse that was cut burns on.)
      this.glow(); this.burnFuses(dt);
      // And ground the line home has passed over: is any of that loose?
      if (d.mode !== 'dead' && this.sweepHome(this.reelTick > 0.1)) met = true;
      // (A puffling the tether goes round is caught, with the tether as it lies before anything it is round is reeled.)
      if (met || this.reelTick > 0.1) { this.reelTick = 0; this.fauna.wound(this); this.reelIfRound(); }
      this.updateHazards(dt);
      // The creatures: what they do, by their own clock (js/fauna.js). With a panel up they only breathe (below).
      { const t0 = performance.now(); this.fauna.step(this, dt); this.timed('fauna', t0); }
      this.listen(dt);
      // The station makes a trickle of grit of its own: however a world has been spent, the next reach is never out
      // of reach for good.
      this.trickle = (this.trickle ?? 0) + dt;
      if (this.trickle >= 2) { this.trickle -= 2; this.S.grit += Math.ceil(richness(this.val('tether') / 2)); }
      this.saveTick = (this.saveTick ?? 0) + dt;
      if (this.saveTick > 20) { this.saveTick = 0; this.save(); }
    } else this.fauna.idle(this, dt);
    // Rubble on its way home keeps coming with the shop open: what it pays is banked as it lands.
    this.updateHauls(dt);
    this.ambient(dt);
    this.feel.step(this, dt);
    this.fitter.step(this, dt);
    for (const e of this.effects) e.t += dt * 1000;
    this.effects = this.effects.filter(e => e.t < duration(e.sheet, e.animation));
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter(p => p.t < 0.9);
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.life) this.banner = null; }
    if (this.place) { this.place.t += dt; if (this.place.t > this.place.life) this.place = null; }
    if (this.specLine) { this.specLine.t += dt; if (this.specLine.t > this.specLine.life) this.specLine = null; }
    // The camera eases after the drill, a little ahead of the way it is flying.
    const k = 1 - Math.exp(-dt * 8), lead = Math.min(3, Math.hypot(d.vx, d.vy) * 0.1), speed = Math.hypot(d.vx, d.vy) || 1;
    this.cam.x += ((d.x + d.vx / speed * lead) * T - this.cam.x) * k; this.cam.y += ((d.y + d.vy / speed * lead) * T - this.cam.y) * k;
    // Flying very fast, the view must not fall behind what is being flown through.
    const lag = Math.hypot(d.x * T - this.cam.x, d.y * T - this.cam.y), most = Math.min(this.W, this.H) * 0.3;
    if (lag > most) { this.cam.x += (d.x * T - this.cam.x) * (1 - most / lag); this.cam.y += (d.y * T - this.cam.y) * (1 - most / lag); }
  }
}
// The game is drawn by the methods of js/drawing.js, which are copied onto it here as they are: a getter stays a
// getter, and none is made enumerable. So the game calls them as its own, and `this` in them is the game.
for (const [name, how] of Object.entries(Object.getOwnPropertyDescriptors(Drawing.prototype))) if (name !== 'constructor') Object.defineProperty(Game.prototype, name, how);
