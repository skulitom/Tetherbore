// Tetherbore: the game. A drill flies free on a tether from a fixed core, cuts whatever ground it is pushed into,
// and reels in any piece of ground it has drawn the tether round.
import { World, N, C, K, B, HARD, GRIT, GEMS, DX, DY, BIOMES, HAZARDS, ZONE, FIND, WRECK_R, rowOf, hazOf, gemKin, digTime, cellHash, sight, cellsAlong, RELIC_R, HOME_R } from './world.js';
import { sheets, draw, drawScaled, frameAt, duration, slice9, text, textWidth } from './atlas.js';
import { sfx, unlock, isMuted, setMuted, setAmbience } from './audio.js';

export const T = 16;                            // pixels in a cell
const HX = C + 0.5, HY = C + 0.5;               // the middle of the core, in cells
const SAVE_KEY = 'tetherbore-save-v3';
const DIR_BIOME = [B.LODE, B.EMBER, B.MIRE, B.FROST];
const GEM_ICON = [null, 'frost', 'ember', 'mire', 'lode'];
const GEM_COLOR = [null, '#bfe6ff', '#ffb060', '#b8f06a', '#d8b8ff'];

// ---------------------------------------------------------------- the economy
// Everything here is worked out from one model of how fast a player earns, so that prices keep pace with income
// however far out the game goes.
//
// Ground is worth more the further out it lies, in proportion to the distance (`richness`). A haul pays the worth of
// its cells times a bonus for its size that grows with the logarithm of the size (`haulBonus`): cutting a big piece is
// already quicker per cell than cutting small ones, so a bonus in proportion to size would pay with its square.
// For the same reason a piece larger than the winch's load pays less a cell (`overload`).
//
// A player with reach R cuts loops about R / 3 across, 48 at most. A loop of side s takes 4 s cells of cutting and
// frees s x s cells, so at `PACE` cells cut a second it earns about s x PACE / 4 cells a second (`income`). The price
// of a level of reach is that income for a set time (`MINUTES`), longer at each level. Every other upgrade is priced
// as a share of the reach it belongs beside (`beside`, in levels of reach), and takes gems only once that reach is
// well into the ground the gems come from.
const REACH = [12, 22, 40, 72, 130, 230, 420, 750, 1350, 2300];
const PACE = 0.9, WORTH = 1.6;                  // cells cut a second, turning and flying counted in; grit in an average cell
const GEM_REACH = 5;                            // the level of reach (230) from which upgrades may ask for gems
export const richness = r => Math.max(1, r / 12);
export const haulBonus = (n, winch = 1) => 1 + winch * Math.log2(Math.max(1, n)) / 8;
// The winch draws in so many cells at full pay. A piece beyond that pays as its load does and a little more for
// every doubling of its size past the load (the load times 1 + ln(n / load)), never less in all, in grit and in
// gems alike: so the biggest loop a player can cut is a little better than one of the winch's load, and not many
// times better. (It was (load / n) ** 0.35 a cell, and on grit alone: a tunnel that cut a whole quarter of the
// ground off paid for half the shop in one haul, and its gems were not thinned at all.)
const WINCH_LOAD = [150, 400, 1000, 2300, 5000, 12000];
export const overload = (n, level) => n <= WINCH_LOAD[level] ? 1 : WINCH_LOAD[level] * (1 + Math.log(n / WINCH_LOAD[level])) / n;
export const income = R => { const side = Math.max(4, Math.min(48, R / 3)); return side * PACE / 4 * WORTH * richness(R * 0.7) * haulBonus(side * side); };
const round2 = n => { const unit = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1); return Math.round(n / unit) * unit; };
// A haul of fewer cells than LIGHT, with nothing in it to make a show of, is a light one: it stops nothing and
// says what it paid where it lay. A haul made within CHAIN seconds of the one before is a link in a chain.
const LIGHT = 12, CHAIN = 6;
// How many bits of rubble may be on their way home at once, over every haul there is.
export const RUBBLE = 400;
// What the step up from each level of reach costs: the first is within the first haul, then 3 minutes of the
// model's income rising to 15. (It was half that. A whole game played by a pilot earned two to three times what
// the model says, and the owner had the shop nearly bought out before leaving the ground about the core: every
// other price follows the reach's, so all of them are doubled with it.)
const REACH_COST = REACH.slice(0, -1).map((R, l) => l === 0 ? 15 : round2(income(R) * (80 + 100 * l)));
// The price of something that belongs beside level `at` of reach (it may lie between two), and its gems.
const priced = (at, share) => {
  const lo = Math.min(REACH_COST.length - 1, Math.floor(at)), hi = Math.min(REACH_COST.length - 1, lo + 1);
  return round2(share * Math.exp(Math.log(REACH_COST[lo]) + (Math.log(REACH_COST[hi]) - Math.log(REACH_COST[lo])) * (at - lo)));
};
const gemsFor = at => at < GEM_REACH ? 0 : round2(150 * 2 ** (at - GEM_REACH));
const levels = (beside, share) => ({ beside, grit: beside.map(at => priced(at, share)), gems: beside.map(gemsFor) });

// ---------------------------------------------------------------- upgrades
// Grit and gems are not enough for the levels of the first tab: each level also asks that something has been
// found, so that the rig grows no faster than the ground is explored. `needs` on a row is [what, how many for each
// level]: 'parts', parts of the older machine brought home from its wrecks, which lie one to each stretch of
// ground (45, 90, 160 ... cells out); 'kinds', kinds of thing the lab has analysed, two in each direction's own
// ground and the rest in lava and in pockets; 'places', grounds met, of which the strains, the pockets and the
// crosses lie further and further out. (`Game.need` counts what is held.)
// 'out' is how far from the core the drill has ever been, in cells, by any road and in any direction: the levels
// of the first tab ask it, so the rig cannot be bought up from the ground about the core. (Kinds analysed and
// places met were asked first, and both are to be had within two hundred cells: a game had the bit and the ram at
// their last levels and a reach of 1,350 with nothing explored past a tenth of it.)
const NEEDS = { parts: 'WRECK PARTS', kinds: 'KINDS ANALYSED', places: 'PLACES MET', out: 'CELLS OUT' };
// `values` is what each level gives; `grit` and `gems` what the next level costs; `gem` whose gems it takes.
export const UPGRADES = [
  // The tether's reach: how far from the core the drill may go, by any road. Each level nearly doubles it. It is
  // bought with grit alone, which every ground gives: no one direction's gems and nothing that must be found in
  // one place, so a player may follow a single direction as far out as they like. From the third level it asks that
  // the drill has been three fifths of the way out its tether already goes, in whatever direction.
  { id: 'tether', icon: 'string', name: 'REACH', what: 'TETHER GOES FURTHER', values: REACH, gem: B.MIRE, needs: ['out', REACH.slice(0, -1).map((R, l) => l < 2 ? 0 : Math.round(R * 0.6))], ...levels(REACH.slice(0, -1).map((R, l) => l), 1), gems: REACH.slice(0, -1).map(() => 0), show: v => `${v}` },
  { id: 'drill', icon: 'drill', name: 'BIT', what: 'CUTS FASTER', values: [1, 2, 3, 4, 5], gem: B.LODE, needs: ['out', [0, 40, 130, 400]], ...levels([0.6, 2.2, 4.4, 6.6], 0.6), show: v => `MK${v}` },
  { id: 'winch', icon: 'winch', name: 'WINCH', what: 'BIGGER HAULS AT FULL PAY', values: [1, 1.3, 1.6, 2, 2.5, 3], gem: B.FROST, needs: ['out', [0, 30, 100, 300, 700]], ...levels([0.8, 2, 3.6, 5.4, 7.2], 0.5), show: v => `x${v}` },
  { id: 'scanner', icon: 'scanner', name: 'SCAN', what: 'SEES DEEPER IN ROCK', values: [3, 4, 5, 7, 9], gem: B.FROST, needs: ['parts', [0, 1, 2, 4]], ...levels([0.4, 1.6, 3.4, 5.8], 0.3), show: v => `${v}` },
  { id: 'momentum', icon: 'momentum', name: 'RAM', what: 'FLIES FASTER', values: [1, 1.25, 1.5, 1.8, 2.2], gem: B.LODE, needs: ['out', [0, 60, 200, 600]], ...levels([0.7, 2.4, 4.2, 6.2], 0.4), show: v => `x${v}` },
  // The hull: how many knocks the drill takes before it is wrecked and wound home (`hit`, `wreck`), a pip a level,
  // each a plate more on the drill. Its first level is priced beside a reach that has only just met hazards and
  // asks no gems; from there on it takes the south's, whose lava is the worst of what it is for.
  { id: 'hull', icon: 'hull', name: 'HULL', what: 'TAKES MORE KNOCKS', values: [5, 6, 7, 8, 9], gem: B.EMBER, needs: ['out', [150, 300, 600, 1000]], ...levels([4.5, 5.5, 6.5, 7.5], 0.5), show: v => `${v}` },
];
// What the lab can know: each thing the bit can crush, by the sheet and frame it is drawn from (`Game.sampleOf`),
// with its name, where it lies, and the lab's note on it. A thing crushed is a sample analysed, and what is known
// of a thing makes every one of it hauled worth more: a hundredth more for the first sample, and a hundredth more
// each time the count of samples doubles (`labLevel`). So the first few samples teach the most, and crushing ore
// for its own sake soon stops paying. (A prism pays nothing itself, so there is nothing of it to learn.)
export const LAB = [
  { key: 'lode-items:oreA', name: 'COPPER', where: 'HOME GROUND AND EAST', note: 'SOFT RED METAL WITH A GREEN BLOOM. THE FIRST THING A NEW BIT LEARNS THE TASTE OF.' },
  { key: 'lode-items:oreB', name: 'VIOLET QUARTZ', where: 'HOME GROUND AND EAST', note: 'A CRYSTAL THAT HOLDS A CHARGE. IT HUMS WHEN A SPARK VEIN IS NEAR.' },
  { key: 'frost-items:oreA', name: 'RIME SALT', where: 'NORTH', note: 'BLUE SALT FROZEN SQUARE. IT KEEPS ITS COLD FOR A HUNDRED YEARS.' },
  { key: 'frost-items:oreB', name: 'AURORA SPAR', where: 'NORTH', note: 'PINK AND GREEN NEEDLES, GROWN IN THE DARK UNDER THE ICE.' },
  { key: 'ember-items:oreA', name: 'CINDER ORE', where: 'SOUTH', note: 'IRON STILL WARM FROM THE DEEP. IT NEVER QUITE COOLS.' },
  { key: 'ember-items:oreB', name: 'SUNSTONE', where: 'SOUTH', note: 'A SPARK THAT FORGOT TO GO OUT. BRIGHTEST BESIDE LAVA.' },
  { key: 'ember-items:steel', name: 'STEEL', where: 'SOUTH, WHERE LAVA MEETS SLAG', note: 'SLAG QUENCHED BY LAVA. DOWN HERE THE GROUND DOES ITS OWN SMELTING.' },
  { key: 'mire-items:oreA', name: 'BOG GOLD', where: 'WEST', note: 'NUGGETS SWEATED OUT BY ROOTS. THE FUNGUS HAS NO USE FOR IT.' },
  { key: 'mire-items:oreB', name: 'GLOWCAP', where: 'WEST', note: 'A MUSHROOM THAT EATS ROCK AND LIGHTS ITS OWN WAY THROUGH IT.' },
  { key: 'minerals:amber', name: 'AMBER', where: 'AMBER HIVES', note: 'HONEY OF THE HIVE GONE TO STONE. EACH NUGGET HANGS BY ONE STALK.' },
  { key: 'minerals:aerolite', name: 'AEROLITE', where: 'PUMICE DRIFTS', note: 'A STAR THAT FELL INTO PUMICE AND STAYED. LIGHT ENOUGH TO FLOAT.' },
  { key: 'minerals:tektite', name: 'TEKTITE', where: 'ASH FLATS', note: 'BLACK GLASS FROM AN OLD IMPACT, LEFT LYING IN THE ASH.' },
];
const LAB_OF = Object.fromEntries(LAB.map(e => [e.key, e]));
// The levels a count of samples has earned (0 for none; 1 for the first; one more at 2, 4, 8 ...), and the count
// the next level comes at.
export const labLevel = n => { let l = 0; while (n >> l) l++; return l; };
export const labNext = n => 2 ** labLevel(n);
// Text broken into lines no wider than `wide` pixels, at the spaces.
const wrap = (words, wide) => {
  const lines = [];
  for (const word of words.split(' ')) {
    const last = lines[lines.length - 1];
    if (last !== undefined && textWidth(`${last} ${word}`) <= wide) lines[lines.length - 1] = `${last} ${word}`; else lines.push(word);
  }
  return lines;
};
// The shop's second tab, WORKS: what is fitted to the drill for the rare things found in pockets. Each row is paid
// for in grit and in the specimens of one direction (`kin`; `spec`, how many each level asks), which only that
// direction's pockets give. A row of two values is fitted once; MENDER has levels.
//   MENDER      the hull mends itself, a pip back every so many seconds since the last knock (the value): every
//               twenty with no mender fitted, so a drill that gets clear of trouble recovers, and faster with one
//   LAVA SKIN   lava neither knocks the hull nor stops the drill: it flies through it
//   SPORE DRIVE a spore pod's burst does not knock: it drives the drill half as fast again for BOOST seconds
//   ARC COIL    a crystal's arc does not knock: it mends a pip
const works = (beside, share, spec) => ({ beside, grit: beside.map(at => priced(at, share)), gems: beside.map(() => 0), spec });
export const WORKS = [
  { id: 'mender', name: 'MENDER', what: 'HULL MENDS FASTER', values: [20, 14, 9, 5], kin: B.FROST, gem: B.FROST, ...works([5, 6, 7], 0.4, [8, 16, 30]), show: v => `${v}S` },
  { id: 'lavaskin', name: 'LAVA SKIN', what: 'SWIMS IN LAVA', values: [0, 1], kin: B.EMBER, gem: B.EMBER, ...works([5.5], 0.4, [12]), show: v => v ? 'ON' : 'OFF' },
  { id: 'sporedrive', name: 'SPORE DRIVE', what: 'SPORES SPEED IT UP', values: [0, 1], kin: B.MIRE, gem: B.MIRE, ...works([5.5], 0.4, [12]), show: v => v ? 'ON' : 'OFF' },
  { id: 'arccoil', name: 'ARC COIL', what: 'ARCS MEND THE HULL', values: [0, 1], kin: B.LODE, gem: B.LODE, ...works([5.5], 0.4, [12]), show: v => v ? 'ON' : 'OFF' },
];
// The shop's third tab, MAP: what the map in the corner shows.
//   RANGE    how many cells of ground a pixel of the map is, so how far it shows: 69 cells across at first
//   LENS     what the map tells apart from plain rock, in colours of their own: ore; then hard ground and hazards;
//            then minerals, caches and whatever else was laid to be found (`LENS`)
//   FINDER   finds not yet seen are marked on the map: caches; then geodes; then prisms (`findsNear`)
//   CHART    a map of the whole of the tether's reach (a tap on the map; the third tab of the top bar's panel)
export const MAPS = [
  { id: 'maprange', icon: 'scanner', name: 'RANGE', what: 'MAP SHOWS FURTHER', values: [1.5, 2.25, 3.5, 5], gem: B.FROST, ...levels([2, 4, 6], 0.25), show: v => `${Math.round(v * 46)}` },
  { id: 'maplens', icon: 'scanner', name: 'LENS', what: 'MAP TELLS MORE APART', values: [0, 1, 2, 3], gem: B.LODE, ...levels([1.5, 3.5, 5.5], 0.25), show: v => ['ROCK', 'ORE', 'HARD', 'ALL'][v] },
  { id: 'mapfinder', icon: 'scanner', name: 'FINDER', what: 'MARKS FINDS NEAR THE DRILL', values: [0, 1, 2, 3], gem: B.MIRE, ...levels([2.5, 4.5, 6.5], 0.25), show: v => ['OFF', 'CACHE', 'GEODE', 'PRISM'][v] },
  { id: 'chart', icon: 'scanner', name: 'CHART', what: 'TAP MAP FOR THE WHOLE REACH', values: [0, 1], gem: B.EMBER, ...levels([3], 0.3), show: v => v ? 'ON' : 'OFF' },
];
// What the lens shows a kind of ground as, and from which level of it: [level, red, green, blue].
const LENS = [];
for (const [level, colour, kinds] of [[1, [214, 178, 64], [K.ORE_A]], [1, [255, 232, 96], [K.ORE_B]], [2, [176, 184, 204], [K.SLATE, K.VAULT, K.KEY, K.STEEL, K.SLAG]], [2, [255, 84, 64], [K.HAZARD, K.HAZARD2]],
  [3, [120, 240, 190], [K.MINERAL, K.NODE, K.CACHE, K.PRISM, K.FOSSIL, K.CAP, K.CAP_LIT, K.TWIN]]]) for (const k of kinds) LENS[k] = [level, ...colour];
// Which finds the finder marks at each level of it, and how far from the drill it marks them, in cells. (It marked
// every find within the tether's reach, and listed no more than two hundred, from the north down: on the chart of
// a long reach that was a solid band of dots across the north and none anywhere else.)
const FOUND = { cache: 1, geode: 2, prism: 3 };
const FINDER = [0, 120, 200, 320];
// The shop's fourth tab, CORE: what is built into the station late in a game, at many times the price of anything
// in the other tabs (a level costs from one and a half to six times the step of reach it lies beside, and gems by
// the thousand), each asking besides for much to have been found.
//   REFINERY   every haul's grit is multiplied
//   GEM CUTTER every haul's gems are multiplied
//   LAMP       the drill's light reaches further (cells)
//   BLACK BOX  when the drill is lost, this share of the grit the trip had earned is kept
const deep = (steps, gems) => ({ beside: steps.map(([at]) => at), grit: steps.map(([at, share]) => priced(at, share)), gems });
export const CORE = [
  { id: 'refinery', pic: 'grit', name: 'REFINERY', what: 'HAULS PAY MORE GRIT', values: [1, 1.15, 1.3, 1.5, 1.75, 2], gem: B.FROST, needs: ['places', [6, 9, 12, 16, 20]], ...deep([[5, 1.5], [6, 2], [7, 2.5], [8, 3], [8, 6]], [600, 1500, 4000, 10000, 25000]), show: v => `x${v}` },
  { id: 'cutter', pic: 'lode', name: 'GEM CUTTER', what: 'HAULS PAY MORE GEMS', values: [1, 1.2, 1.4, 1.7, 2], gem: B.LODE, needs: ['kinds', [4, 7, 10, 12]], ...deep([[5.5, 1.5], [6.5, 2], [7.5, 3], [8, 5]], [800, 2500, 8000, 20000]), show: v => `x${v}` },
  { id: 'lamp', pic: 'bolt', name: 'LAMP', what: 'LIGHT REACHES FURTHER', values: [8.5, 10, 12, 14], gem: B.EMBER, needs: ['parts', [1, 3, 5]], ...deep([[4, 1], [6, 1.5], [8, 2]], [0, 1000, 6000]), show: v => `${v}` },
  { id: 'blackbox', pic: 'lock', name: 'BLACK BOX', what: 'KEEPS GRIT WHEN LOST', values: [0, 0.25, 0.5, 0.75], gem: B.MIRE, needs: ['places', [5, 10, 15]], ...deep([[5, 1], [6.5, 2], [8, 3]], [400, 2000, 9000]), show: v => `${Math.round(v * 100)}%` },
];
const ROWS = [...UPGRADES, ...WORKS, ...MAPS, ...CORE];
const TABS = [{ id: 'rig', name: 'RIG', rows: UPGRADES }, { id: 'works', name: 'WORKS', rows: WORKS }, { id: 'map', name: 'MAP', rows: MAPS }, { id: 'core', name: 'CORE', rows: CORE }];
// How long a spore pod's burst drives a drill fitted with the spore drive, and how much faster.
const BOOST = { time: 3, by: 1.5 };
// After a knock nothing takes another pip, or stuns again, for SHIELD seconds: time to get clear. (It was a second
// and a half. What knocks comes in runs, pods bursting one after another, arcs leaping from crystal to crystal:
// a drill flown at random was lost a dozen seconds after its first knock, all three pips to one mistake.)
// A drill whose
// last pip is gone lies dead for DEATH seconds, the screen going dark, and then the game is back at the last
// docking (`revert`).
const SHIELD = 3;
// How far from a crystal its arc knocks the drill, in cells either way (it was 3.5: most of the screen's width).
const ARC = 2.5;
export const DEATH = 1.2;
// How long each blow that knocks the hull stuns, in seconds: lava cut into, lava touched, an arc, a spore burst.
// (Before there was a hull an arc stunned for 0.7 s and lava for 0.5: with a pip gone as well, and SHIELD running
// from the blow, that left under a second to get clear.)
const JOLT = { lava: 0.4, burn: 0.3, arc: 0.5, spore: 0.4 };
// What flies off a hull that breaks, and the smoke of one in trouble.
const WRECKAGE = ['#ffd83a', '#e08a1c', '#8a94a8', '#3a3440'];
const SMOKE = ['#4a4654', '#6a6474', '#2e2a36'];
// Where each direction's gems are found, for a price that cannot be met yet.
const GEM_WHERE = [null, 'NORTH', 'SOUTH', 'WEST', 'EAST'];
// What is called out the first time it is seen (`World.see` says what it is): the name that comes up, and the
// colour of that name, of the ring round the thing and of its dot on the map. A relic's colour is its direction's
// gem's, and a pocket's mineral has its own name and its pocket's colour. Names only: nothing here says what a
// thing is for.
const SPOT = {
  cache: ['CACHE', '#ffe14a'], geode: ['GEODE', '#f4ecd8'], wreck: ['WRECK', '#ff9a3a'], key: ['KEYSTONE', '#a4acbc'], prism: ['PRISM', '#ffffff'],
  relic: ['RELIC', '#ffffff'], mineral: ['MINERAL', '#ffffff'],
};
// A place's name is written in the colour it has on the map, as bright as that colour goes.
const bright = ([r, g, b]) => { const k = 255 / Math.max(1, r, g, b); return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`; };
// How long a place's name stays up: on its plate, and across the screen the first time the place is met. How
// many dots of things seen the map keeps, and how near an unclaimed wreck is heard.
const PLATE = 2.4, CARD = 1.6, MARKS = 24, HEAR = 30;
// How long the count of specimens stays up after a haul adds to it, and how many pockets the map marks at once.
const SPEC_LINE = 3, PIPS = 24;
// How long after a spore pod bursts the pods round it burst, in seconds, and how many pods the glow follows a bunch
// through.
const POD_CHAIN = 0.15, BUNCH = 64;
// How long slag shows white as lava quenches it to steel, in seconds.
const QUENCH = 0.12;
// How long a charged crystal's fuse burns when it is woken by a cut beside it, in seconds: at the slowest the drill
// flies (9 cells a second) that is seven cells, twice the reach of the arc.
const FUSE = 0.8;
// Ground that cuts this quick (its row's `dig` under PLOUGH: ash) is ploughed, not cut a block at a time: a cell
// of it is gone in a twentieth of a second, so pushing into it neither breaks the drill's run nor draws the drill
// square on to each block, and the loop a thumb draws is the loop that is cut. Ore cut into there says CRUSHED no
// more often than every CRUSH_EVERY seconds: a plough goes through a mineral a second.
const PLOUGH = 0.3, CRUSH_EVERY = 1;
// The boulders of a drift (a pocket whose row's `twist` is 'drift') are in the books of loose ground while the
// drill is in the drift or near it, and leave them once it is out and they are AWAY cells off the screen: so the
// books do not grow by a drift's boulders for every drift crossed.
const AWAY = 6;
// What flies off the kinds of rock that look the same in every ground, by the sheet each is drawn from. A ground's
// own rock sheds the colours in its row (js/world.js: BIOMES), where the dark it lies in, its motes and its colour
// on the map are too.
const DEBRIS = {
  slate: ['#6a7080', '#a4acbc', '#454a5a'], vault: ['#463a68', '#8a78c0', '#c8a8ff'], ice: ['#6fb0e0', '#d8f4ff', '#ffffff'],
  basalt: ['#463e4c', '#7a6a78', '#8a3424'], bedrock: ['#1e1e26', '#34343e'],
};
// And off what is found in the ground, whatever ground it lies in: a keystone's iron and rust, a prism's glass.
const CHIPS = [];
CHIPS[K.KEY] = ['#8a94a8', '#eef4ff', '#b0603a']; CHIPS[K.PRISM] = ['#ffffff', '#bfe6ff', '#d8b8ff'];
// How many keystones in view glint in the dark at once (the nearest the drill), how bright, and how far.
const KEY_GLINTS = 12, KEY_GLINT = 0.4, KEY_GLOW = 2;
// How the tether looks at each level of reach: rope, braid, cable, then lines of light.
const TETHERS = [
  { a: '#e8dcc0', b: '#e8dcc0', dash: 1 }, { a: '#e8dcc0', b: '#b89a6c', dash: 0.5 }, { a: '#f0d890', b: '#b0803a', dash: 0.5 },
  { a: '#f0b060', b: '#c8442a', dash: 0.5 }, { a: '#d8e0ec', b: '#8a94a8', dash: 0.5 }, { a: '#eef4ff', b: '#6e7c98', dash: 0.25, thick: true },
  { a: '#ffe89a', b: '#c89020', dash: 0.25, thick: true }, { a: '#fff4c0', b: '#e8a020', dash: 0.5, thick: true },
  { a: '#a8fff0', b: '#30c8c0', dash: 0.5, thick: true }, { a: '#ffc8f4', b: '#b050d0', dash: 0.5, thick: true }, { a: '#ffffff', b: '#5cc4f0', dash: 0.5, thick: true },
];
// Nothing is too hard to cut: tougher ground only takes longer (js/world.js: `digTime`), and a better bit cuts all
// of it faster.
const SPEED = [1, 1.6, 2.4, 3.6, 5];
const ROUND = 3.5, BRAID = 4;                    // on the fine canvas: how wide a rope rounds a corner, and the length of one turn of its braid, in the game's pixels
const FLY = 9, BODY = 0.34;                     // cells a second in open ground; the drill's half-width in cells
const SIDE = [1, N, -1, -N];                    // the cells beside a cell, as steps of its number: east, south, west, north
const LIGHT_STEP = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.41], [-1, 1, 1.41], [1, -1, 1.41], [-1, -1, 1.41]];

const compact = n => n < 1000 ? `${Math.floor(n)}` : n < 10000 ? `${(Math.floor(n / 100) / 10).toFixed(1)}K` : n < 1e6 ? `${Math.floor(n / 1000)}K`
  : n < 1e9 ? `${(Math.floor(n / 1e5) / 10).toFixed(1)}M` : `${(Math.floor(n / 1e8) / 10).toFixed(1)}B`;
const store = () => new Promise((resolve, reject) => {
  const open = indexedDB.open('tetherbore', 1);
  open.onupgradeneeded = () => open.result.createObjectStore('pieces');
  open.onsuccess = () => resolve(open.result);
  open.onerror = () => reject(open.error);
});

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
    this.band = []; this.pieces = []; this.pieceOf = new Map(); this.preview = []; this.under = new Set();
    this.taken = []; this.walked = new Set(); this.boxes = new WeakMap(); this.cuts = 0; this.homeKey = '';
    this.swept = 0;                         // cells the tether's sweeps have looked at, for tests of how much work is done
    this.effects = []; this.popups = []; this.hauls = []; this.clouds = []; this.sparks = new Map(); this.lavaVol = new Map(); this.frostOpen = [];
    this.parts = []; this.rings = []; this.motes = []; this.gloom = [10, 8, 7]; this.murk = 1; this.flash = 0; this.counted = 0; this.chime = 3; this.clock = 0;
    this.shake = 0; this.twang = 0; this.edge = 0; this.hurt = 0; this.coreFlash = 0; this.banner = null; this.shop = false; this.shopRise = 0; this.lab = false; this.labRise = 0; this.labSel = null; this.labPage = 0; this.labFlash = 0; this.confirmReset = 0;
    this.buttons = []; this.panels = [];    // what can be tapped this frame; and the small panels up this frame, each [x, y, w, h]
    this.chunks = new Map(); this.version = 0;
    this.daylight = false;                  // no dark is laid over the ground: only a staged view asks for it (js/shot.js)
    this.place = null; this.placeKey = null; this.motifAt = -9;      // the name on show, the place the drill is in, when a place last sounded
    this.called = new Set(); this.calledAt = {};                      // things called out since the game began, and when each kind last was
    this.tickIn = 0; this.ticks = 0;                                  // until a wreck's next tick, and how many there have been
    this.quenched = new Map();                                        // slag just turned to steel: how long each cell still shows white
    this.specLine = null;                                             // the count of specimens just banked, on show under the top bar
    this.pips = []; this.pipsFor = '';                                // the pockets the map marks, and what that list was made for
    this.drifts = new Map();                                          // the drifts whose boulders are in the books, by their keys
    this.crushedAt = -9;                                              // when ore cut into last said CRUSHED
    this.dents = 0; this.shield = 0; this.tow = null;                 // knocks the hull has taken, how long nothing more knocks it, how long the wreck has lain dead
    this.chart = { zoom: 1, x: HX, y: HY };                           // the chart's view: how far it is zoomed in, and the cell at its middle
    this.chartRect = null; this.chartBase = 1; this.chartTouch = new Map();   // where the chart is on the screen this frame, its cells to a pixel unzoomed, the fingers on it
    this.shopTab = 'rig'; this.labTab = 'stats'; this.boost = 0; this.mendIn = 0;   // the tab each panel is open at; a spore's drive, in seconds left; until the mender's next pip
    // The last frames that took long (see `frameTook`), kept apart from the game's own save, to find what freezes.
    this.probe = {}; this.stalls = [];
    try { this.stalls = JSON.parse(localStorage.getItem('tetherbore-stalls') ?? '[]'); } catch { this.stalls = []; }
    this.docked = null;                                               // what was banked and bought at the last docking, to go back to (`dockMark`)
    this.knocked = 0; this.mended = 0; this.notice = null;            // a pip just lost and the hull just mended (seconds left to show it), and the word across the screen
    this.smokeIn = 0; this.wrecks = 0; this.knocks = 0;               // until a hull in trouble next smokes; wrecks and knocks since the game began (for tests and tools)
    // (The parts of a frame whose time is added up by name, for `frameTook`.)
    for (const name of ['save', 'changed', 'haul', 'revert', 'updateHazards', 'updateHauls', 'homecoming', 'sweepHome', 'look']) {
      const part = this[name];
      if (typeof part === 'function') this[name] = (...args) => { const t0 = performance.now(); try { return part.apply(this, args); } finally { this.timed(name, t0); } };
    }
    this.fresh((Math.random() * 1e9) | 0, true);
  }

  // ------------------------------------------------------------ state
  fresh(seed, quiet = false) {
    this.S = { seed, grit: 0, gems: [0, 0, 0, 0, 0], lv: Object.fromEntries(ROWS.map(u => [u.id, 0])), relics: [0, 0, 0, 0], wrecks: [0, 0, 0, 0, 0, 0, 0, 0],
      stats: { hauls: 0, best: 0, buys: 0, moves: 0, time: 0 }, won: false, met: {}, marks: [], visited: {}, spec: [0, 0, 0, 0, 0], lab: {}, out: 0 };
    this.world.reset(seed);
    this.begin();
    if (!quiet) store().then(db => db.transaction('pieces', 'readwrite').objectStore('pieces').clear()).catch(() => {});
  }
  begin() {
    const w = this.world;
    this.pending = { grit: 0, gems: [0, 0, 0, 0, 0] };
    this.parts.length = 0; this.rings.length = 0; this.effects.length = 0; this.popups.length = 0; this.hauls.length = 0; this.clouds.length = 0;
    this.sparks.clear(); this.lavaVol.clear(); this.quenched.clear(); this.frostOpen.length = 0; w.lava.clear(); w.dug.clear();
    this.drill = { x: HX, y: HY, px: HX, py: HY, vx: 0, vy: 0, ang: 0, mode: 'free', tx: 0, ty: 0, speed: 0, dig: -1, digT: 0, digDur: 1, stun: 0, squash: 0, run: 0, armed: true, cell: -1, home: true };
    this.cam = { x: HX * T, y: HY * T };
    this.band = [[HX, HY], [HX, HY]];
    this.pieces = []; this.pieceOf = new Map(); this.taken.length = 0; this.homeKey = ''; this.homeEnd = [HX, HY];
    this.chain = null; this.hauled = null; this.specLine = null; this.pipsFor = ''; this.drifts.clear(); this.crushedAt = -9;
    // The hull is whole on a new game and on a game loaded: what is saved is its level, never its dents.
    this.dents = 0; this.shield = 0; this.tow = null; this.knocked = 0; this.mended = 0; this.notice = null; this.smokeIn = 0; this.boost = 0; this.mendIn = 0;
    w.see(C, C, this.val('scanner') + 4);
    // Where the game begins is where the player already is: its name does not come up, now or as a new place later.
    const here = this.placeAt(this.di);
    this.place = null; this.placeKey = here.key; this.S.met[here.row.id] = 1;
    this.called.clear(); this.calledAt = {}; this.tickIn = 0;
    // The first piece, beside the core, lies loose from the start: the open cell between them tells of it.
    this.changed([C * N + C + 3]);
    this.shop = false; this.lab = false; this.labSel = null; this.labPage = 0; this.labFlash = 0;
    this.dockMark();
  }
  val(id) { const u = ROWS.find(u => u.id === id); return u.values[this.S.lv[id] ?? 0]; }
  // Fitted with the lava skin, the drill flies through lava.
  get swims() { return this.val('lavaskin') > 0; }
  // The pips the hull has left: what its level gives, less the knocks taken since it was last mended.
  get hull() { return Math.max(0, this.val('hull') - this.dents); }
  get di() { return Math.floor(this.drill.y) * N + Math.floor(this.drill.x); }
  get far() { return Math.hypot(this.drill.x - HX, this.drill.y - HY); }
  get atCore() { return this.far < 1.7; }

  // What was bought and banked goes in local storage; the ground, a piece at a time, in the browser's database.
  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 3, ...this.S })); } catch { /* the game goes on without saving */ }
    const w = this.world, ids = [...w.touched];
    if (!ids.length) return;
    w.touched.clear();
    store().then(db => {
      const pieces = db.transaction('pieces', 'readwrite').objectStore('pieces');
      for (const id of ids) { const p = w.chunks[id]; if (p) pieces.put({ kind: p.kind, biome: p.biome, seen: p.seen }, id); }
    }).catch(() => {});
  }
  async restore() {
    try {
      const data = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!data || data.v !== 3) return false;
      const { v, ...S } = data;
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
      // things seen on the map, the pockets visited, the specimens of each direction, the lab's samples.
      S.wrecks ??= [0, 0, 0, 0, 0, 0, 0, 0]; S.met ??= {}; S.marks ??= []; S.visited ??= {}; S.spec ??= [0, 0, 0, 0, 0]; S.lab ??= {}; S.out ??= 0;
      for (const u of ROWS) this.S.lv[u.id] = Math.min(this.S.lv[u.id] ?? 0, u.values.length - 1);
      this.world.reset(S.seed);
      for (const [id, p] of rows) this.world.chunks[id] = p;
      this.begin();
      return true;
    } catch { return false; }
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
    if (this.input.id !== null) return;
    if (hit) { hit.act(); return; }
    if (this.shop || this.lab) { this.shop = this.lab = false; sfx.tap(); return; }
    Object.assign(this.input, { id, ax: x, ay: y, px: x, py: y, m: 0 });
    this.drill.armed = true;
  }
  pointerMove(id, x, y) {
    if (this.chartTouch.has(id)) { if (this.lab && this.chartRect) this.chartMove(id, x, y); return; }
    const inp = this.input;
    if (inp.id !== id) return;
    inp.px = x; inp.py = y;
    const dx = x - inp.ax, dy = y - inp.ay, far = Math.hypot(dx, dy);
    if (far < 4) { inp.m = 0; return; }
    inp.vx = dx / far; inp.vy = dy / far; inp.m = Math.min(1, (far - 3) / 12);
    if (far > 24) { inp.ax = x - inp.vx * 24; inp.ay = y - inp.vy * 24; }
  }
  pointerUp(id) { this.chartTouch.delete(id); if (this.input.id === id) { this.input.id = null; this.input.m = 0; } }
  key(code, down) {
    const dir = { ArrowRight: 0, KeyD: 0, ArrowDown: 1, KeyS: 1, ArrowLeft: 2, KeyA: 2, ArrowUp: 3, KeyW: 3 }[code];
    if (dir !== undefined) {
      if (down) { unlock(); this.shop = this.lab = false; if (!this.input.keys.size) this.drill.armed = true; this.input.keys.add(dir); } else this.input.keys.delete(dir);
      return true;
    }
    if (!down) return false;
    unlock();
    if (code === 'KeyU' || code === 'Enter') { if (this.atCore && this.drill.mode !== 'dead') { this.shop = !this.shop; this.lab = false; } return true; }
    if (code === 'KeyL') { this.openLab(!this.lab); return true; }
    if (code === 'Escape') { this.shop = this.lab = false; return true; }
    return false;
  }
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
    if (cut.length) for (const cells of w.freed(cut, 120000)) {
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
      const cells = w.pieceIn(i, -Infinity, -Infinity, Infinity, Infinity, 120000);
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
  discover(bends, most, walked, limit = 120000) {
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
    // No cell is ever handed over twice, and never a haul of nothing.
    const cells = [...new Set(round.flat())];
    if (!cells.length) return;
    this.haul(cells);
    this.changed(cells);
  }
  // The tether lets the drill go this far from the core and no further, whatever road it takes.
  within(x, y) { return Math.hypot(x - HX, y - HY) <= this.val('tether') + 0.3; }

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
    const top = FLY * this.val('momentum') * (this.boost > 0 ? BOOST.by : 1) * (1 + Math.max(0, d.run - 0.8) * 0.9) * m, ease = Math.min(1, dt * (m > 0 ? 14 : 10));
    d.vx += (ix * top - d.vx) * ease; d.vy += (iy * top - d.vy) * ease;
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
      const plough = w.row(i >= 0 ? i : this.di).dig < PLOUGH;
      if (!plough) d.run = 0;
      if (i < 0) { d.dig = -1; if (hitX) d.vx = 0; if (hitY) d.vy = 0; }
      else {
        const k = w.k(i);
        if (HARD[k] >= 99) {
          if (this.time - (this.lastClink ?? -1) > 0.35) { this.lastClink = this.time; sfx.clink(); d.squash = 0.12; this.effect('sparks', 'sparks', (d.x + ix * 0.5) * T, (d.y + iy * 0.5) * T); }
          d.dig = -1;
        } else if (!this.within((i % N) + 0.5, Math.floor(i / N) + 0.5)) { if (this.edge <= 0) this.refuse(); d.dig = -1; }
        else {
          if (d.dig !== i) { d.dig = i; d.digT = 0; d.digDur = digTime(k, w.row(i)) / SPEED[this.S.lv.drill]; d.digX = ix; d.digY = iy; this.foresee(i); }
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
          if (d.digT >= d.digDur) this.finishDig(i);
        }
      }
    } else { if (d.dig >= 0) this.preview = []; d.dig = -1; }
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
      if (this.world.see(x, y, r)) this.version++;
      // Ground that has come into view is looked at: an island among it is known as loose from the first sight.
      for (let v = y - r; v <= y + r; v++) for (let u = x - r; u <= x + r; u++) if (Math.abs(u - px) > r || Math.abs(v - py) > r) this.spot(v * N + u);
      this.arrive(cell);
      if (this.drifts.size) this.driftsOut();
    }
    if (this.world.spotted.length) this.callOut();
    const home = this.atCore;
    if (home && !d.home) { this.homecoming(); this.save(); }
    // Riding on to the core mends the hull.
    if (home && this.dents && d.mode !== 'dead') this.mend();
    // Leaving the core is the docking the game goes back to if the drill is lost: everything up to now is kept.
    if (!home && d.home) this.dockMark();
    d.home = home;
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
    if (card) sfx.arrive(row.kin); else if (this.time - this.motifAt > PLATE) sfx.place(row.kin);
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
  // sooner still gets its dot.
  callOut() {
    const w = this.world, S = this.S;
    for (const [what, seen, mid] of w.spotted.splice(0)) {
      const x = mid % N, y = Math.floor(mid / N), key = `${what}:${Math.floor((x - C) / FIND)},${Math.floor((y - C) / FIND)}`;
      if (this.called.has(key)) continue;
      this.called.add(key);
      // The cell the thing is marked by is one that goes when it is taken: a geode's is a cell of its ore.
      const cell = what === 'geode' && w.k(mid + 1) === K.ORE_B ? mid + 1 : seen, kind = w.k(cell);
      if (kind === K.EMPTY || S.marks.some(m => m[0] === cell)) continue;
      const row = w.row(seen), dir = w.relicAt.indexOf(seen);
      const name = what === 'mineral' ? (row.pocket?.mineral ?? SPOT.mineral[0]).toUpperCase() : SPOT[what][0];
      const colour = what === 'mineral' ? bright(row.map) : what === 'relic' && dir >= 0 ? GEM_COLOR[DIR_BIOME[dir]] : SPOT[what][1];
      if (what !== 'wreck' && what !== 'relic') { S.marks.push([cell, kind, colour]); if (S.marks.length > MARKS) S.marks.shift(); }
      if (this.time - (this.calledAt[what] ?? -9) < 3) continue;
      this.calledAt[what] = this.time;
      this.ring((x + 0.5) * T, (y + 0.5) * T, colour, 30);
      this.sparkle((x + 0.5) * T, (y + 0.5) * T, 5, colour);
      this.popup(x, y - 1, name, colour);
      sfx.spot(what);
    }
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
    for (let s = 0; s < 4; s++) {
      const j = i + DY[s] * N + DX[s];
      const haz = w.hazAt(j);
      if (haz === 'lava') cells.push(j);
      else if (haz === 'spore') this.bunch(j, cells);
    }
    const open = also.filter(j => j !== i && w.k(j) !== K.EMPTY), found = w.freed(cells, 2000, open.length ? new Set(open) : null);
    this.preview = [{ i, cells: open.concat(...found) }];
  }
  finishDig(i) {
    const w = this.world, d = this.drill, x = i % N, y = Math.floor(i / N), k = w.k(i), b = w.b(i), row = rowOf(b), haz = hazOf(k, row);
    w.setK(i, K.EMPTY);
    if (row.freeze > 0) { w.dug.set(i, this.clock); this.frostOpen.push(i); }
    // (A keystone is iron: it rings and shatters as slate does. A prism breaks like any crystal.)
    const mineral = row.pocket !== null && k === (row.pocket.kind ?? K.MINERAL);
    const tough = k === K.SLATE || k === K.KEY ? 3 : k === K.VAULT ? 4 : k === K.DENSE || k === K.ORE_B || k === K.BASALT || k === K.SLAG || k === K.STEEL || k === K.PRISM || mineral ? 2 : 1;
    sfx.dig(tough);
    this.chips(x, y, this.debris(k, b), 9 + tough * 3, d.ang, 1);
    this.effect('dust', 'dust', (x + 0.5) * T, (y + 0.5) * T);
    if (tough >= 2 || k === K.ICE) this.effect('shatter', 'shatter', (x + 0.5) * T, (y + 0.5) * T);
    // (Ploughing, the drill goes through a mineral every second or so: it says so no more often than that.)
    if (k === K.ORE_A || k === K.ORE_B || k === K.STEEL || k === K.PRISM || mineral) this.analyse(this.sampleOf(k, row), x, y, row.dig >= PLOUGH || this.time - this.crushedAt >= CRUSH_EVERY);
    this.shake = Math.max(this.shake, 1 + tough * 0.5);
    // The hazard that was cut into wakes, and a hazard beside the cut: each may open cells (its own; the slate an
    // arc shatters), and every cell opened goes to `changed` together.
    const opened = [i];
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
  // drawn from, so a cross's rich ore is its donor's here too), or null for what the lab does not study.
  sampleOf(k, row) {
    const P = row.pocket;
    if (P !== null && k === (P.kind ?? K.MINERAL)) return `minerals:${P.mineral}`;
    if (k === K.ORE_A) return `${row.items}:oreA`;
    if (k === K.ORE_B) return `${row.itemsB}:oreB`;
    if (k === K.STEEL) return `${HAZARDS.lava.sheet}:steel`;
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
    // (One count on the screen at a time: cutting through a seam of ore, each would lie over the last.)
    this.popups = this.popups.filter(p => !p.label.startsWith('SAMPLE '));
    if ((n & (n - 1)) === 0) {
      this.popup(x, y + 0.7, `ANALYSED +${labLevel(n)}%`, '#8cf2c4');
      this.sparkle((x + 0.5) * T, (y + 0.5) * T, 6, '#8cf2c4');
      sfx.gem(labLevel(n)); this.labSel = key; this.labFlash = 3;
    } else if (say) this.popup(x, y + 0.7, `SAMPLE ${n}/${labNext(n)}`, '#6fa894');
  }
  // The panel is opened and shut by a tap on the bar: at the tab it was left at, or at the lab's notes just after
  // something was analysed (at the thing last learnt about); a tap on the map names the chart's tab itself.
  openLab(open, tab) {
    this.lab = open; this.shop = false; this.chartTouch.clear();
    if (open) { this.labSel ??= (LAB.find(e => this.S.lab[e.key]) ?? LAB[0]).key; this.labPage = -1; this.labTab = tab ?? (this.labFlash > 0 ? 'lab' : this.labTab); }
    sfx.tap();
  }

  // ------------------------------------------------------------ hauling
  // What a haul of these cells would pay, were it made now. Asking changes nothing: the haul itself asks and then
  // does as this says, and so may anything that shows what a piece is worth before it is hauled, which then cannot
  // say otherwise than the haul will. `extra` is cells that are no longer in the world but come home with the haul,
  // each { k, b, x, y } (a kind, a ground and where it lay): counted in the haul's size and paid at its multiplier.
  //   n                 how many cells, the extra ones among them
  //   grit, gems        what is paid: grit in all, and gems of each direction (1 north, 2 south, 3 west, 4 east)
  //   lump              the part of the grit paid as it stands, whatever the size of the haul: caches, and the
  //                     mineral of a pocket (which, in a pocket whose row says `chain`, pays more for each haul
  //                     before it in a chain)
  //   chain             what such a mineral's lump was multiplied by for the hauls before this one: 1 with none
  //                     before it, and 0 where no cell is a mineral that pays more in a chain
  //   spec, minerals    specimens of each direction, and how many cells of a pocket's mineral there are
  //   mineral           the name of that mineral (the last met), or null
  //   prisms, shine     cells of prism, and what they multiply every gem by: half as much again each, to three
  //   relic             which direction's relic is among the cells, or -1
  //   caches, parts     caches; and wreck parts not held yet (`wrecks`: which wrecks they are)
  //   mult, over        what the cells' grit is multiplied by, and the share of it left by a piece over the winch's load
  payOf(cells, extra = []) {
    const w = this.world, S = this.S, n = cells.length + extra.length, gems = [0, 0, 0, 0, 0], spec = [0, 0, 0, 0, 0], wrecks = [], held = S.wrecks ?? [];
    const chain = 1 + 0.2 * Math.min(5, this.chain && this.time - this.chain.t <= CHAIN ? this.chain.n : 0);
    let grit = 0, lump = 0, relic = -1, caches = 0, minerals = 0, mineral = null, prisms = 0, chains = false;
    const one = (k, b, x, y) => {
      const row = rowOf(b), far = Math.hypot(x - C, y - C), rich = richness(far) * row.rich * row.worth, P = row.pocket;
      // Whose gems a cell pays is its kind's and its ground's to say; the home ground pays none.
      // What the lab knows of a thing makes it worth that much more (`studied`): its grit, its gems, its lump.
      const study = 1 + this.studied(k, row);
      grit += GRIT[k] * rich * study; gems[gemKin(k, row)] += GEMS[k] * row.gemx * study;
      if (b === B.CRUST && (k === K.ORE_A || k === K.ORE_B)) grit += (k === K.ORE_B ? 20 : 4) * rich * study;
      if (k === K.RELIC) relic = w.relicAt.indexOf(y * N + x);
      // A cache holds what a quarter of a minute's cutting out here would earn; a wreck gives up its part.
      else if (k === K.CACHE) { caches++; lump += round2(income(Math.max(22, far)) * 12); }
      else if (k === K.WRECK) { const which = w.wrecks.findIndex(([wx, wy]) => wx === x && wy === y); if (which >= 0 && !held[which] && !wrecks.includes(which)) wrecks.push(which); }
      else if (k === K.PRISM) prisms++;
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
    // Each part brought home from a wreck makes every haul pay a tenth more, the haul that brings it too.
    // (A piece over the winch's load pays less for each cell's own grit, and its banner says so; where the cells
    // are worth nothing themselves, as a loop of ash is, nothing is lost and nothing is said.)
    const parts = wrecks.length, over = grit > 0 ? overload(n, S.lv.winch) : 1, mult = haulBonus(n, this.val('winch')) * (1 + 0.1 * (held.filter(Boolean).length + parts)) * over;
    const shine = 1 + 0.5 * Math.min(prisms, 3);
    // (The station's refinery multiplies a haul's grit, lumps and all; its gem cutter the gems.)
    const refined = this.val('refinery'), cut = this.val('cutter');
    for (let b = 1; b < 5; b++) gems[b] = Math.round(gems[b] * shine * over * cut);
    return { n, grit: Math.round((Math.round(grit * mult) + lump) * refined), gems, lump, spec, minerals, mineral, prisms, shine, relic, caches, parts, wrecks, mult, over, chain: chains ? chain : 0 };
  }
  // The tether is round these cells: they go, and what they are worth is on its way home.
  haul(cells) {
    // (A haul of nothing would never be over: it ends when the last of its rubble is home.)
    if (!cells.length) return;
    const w = this.world, S = this.S, n = cells.length, pay = this.payOf(cells), { grit, gems, relic, caches, parts, mult, over } = pay;
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
    for (const i of cells) w.setK(i, K.EMPTY);
    // (It is plainly gone, wherever it was: the map shows it open without the drill going to look.)
    w.show(cells);
    // A haul made soon after another is a link in a chain: `n` is how many came before it.
    const linked = this.chain && this.time - this.chain.t <= CHAIN ? this.chain.n : 0;
    this.chain = { t: this.time, n: linked + 1 };
    // Small, and with nothing in it to make a show of, it is a light haul: flight is not stopped for it. (A prism
    // is something to make a show of: the banner says what it did to the gems.)
    const light = n < LIGHT && relic < 0 && !caches && !parts && !pay.prisms;
    S.grit += grit; this.pending.grit += grit;
    for (let b = 1; b < 5; b++) { S.gems[b] += gems[b]; this.pending.gems[b] += gems[b]; }
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
    sfx.crack(n);
    for (const sp of sprites) if (count < 60 || cellHash(sp.x, sp.y, 9) < 0.4) this.chips(sp.x, sp.y, sp.debris, 2, null, 0.7);
    const title = relic >= 0 ? 'RELIC!' : parts ? 'WRECK PART! PAY +10%' : caches ? 'CACHE!' : n >= 200 ? 'COLOSSAL!' : n >= 80 ? 'HUGE HAUL!' : n >= 30 ? 'BIG HAUL!' : n >= 10 ? 'NICE CUT!' : 'HAUL';
    // What the last haul was and paid (`hauled`). Any but a light one says so across the screen, with a flash and
    // a beat of stillness. A light one says what it paid where it lay, and leaves the banner of a bigger haul up.
    const mineral = pay.mineral && sheets.minerals?.frames[pay.mineral] ? pay.mineral : null;
    this.hauled = { title, n, mult, over, grit, gems, light, shine: pay.shine, minerals: pay.minerals, mineral, spec: specUp, specOf, chain: pay.chain, t: 0, life: 2.2 + Math.min(1.2, n * 0.01) };
    if (light) {
      this.shake = Math.max(this.shake, Math.min(1.5, 0.7 + n * 0.08));
      this.ring(cx, cy, '#fff6c8', 12 + n);
      // (What a pocket's mineral paid has the mineral beside it, and under it the specimens it added.)
      this.popup(mx, my - 0.6, `+${compact(grit)}`, '#ffe14a', mineral ? ['minerals', mineral] : 'grit');
      let up = 1;
      if (specUp > 0) this.popup(mx, my - 0.6 - 0.6 * up++, `+${specUp}`, GEM_COLOR[specOf], `spec-${GEM_ICON[specOf]}`);
      for (let g = 1; g < 5; g++) if (gems[g] > 0) this.popup(mx, my - 0.6 - 0.6 * up++, `+${compact(gems[g])}`, GEM_COLOR[g], GEM_ICON[g]);
    } else {
      if (n >= 20) this.effect('bank', 'area', cx, cy);
      this.shake = Math.max(this.shake, Math.min(9, 2.5 + n * 0.12));
      this.hitstop = Math.min(0.16, 0.05 + n * 0.002);
      this.flash = Math.min(0.5, 0.12 + n * 0.006);
      this.ring(cx, cy, '#fff6c8', 30 + Math.min(60, n * 1.5));
      this.banner = this.hauled;
    }
    if (parts || caches) sfx.relic();
    if (relic >= 0) { S.relics[relic] = 1; sfx.relic(); if (S.relics.every(Boolean) && !S.won) { S.won = true; this.wonAt = this.time; } }
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
    const w = this.world, homeX = HX * T, homeY = HY * T;
    for (const h of this.hauls) {
      h.t += dt;
      const { size, bits } = h, per = T / size, rad = size * 0.45, wall = size * 0.4;
      // Blocks break up, each bit thrown a little way out.
      for (const s of h.sprites) {
        if (s.broke || h.t < s.go) continue;
        s.broke = true;
        for (let q = 0; q < per * per; q++) {
          const qx = q % per, qy = (q / per) | 0, a = Math.atan2(qy - (per - 1) / 2, qx - (per - 1) / 2) + (Math.random() - 0.5) * 2, v = 25 + Math.random() * 70;
          bits.push({ s, sx: qx * size, sy: qy * size, x: s.x * T + (qx + 0.5) * size, y: s.y * T + (qy + 0.5) * size, vx: Math.cos(a) * v, vy: Math.sin(a) * v, born: h.t, k: s.k, st: 0, ft: 0, stall: 0, ghost: false });
        }
        if (h.count < 80 || cellHash(s.x, s.y, 9) < 0.35) this.chips(s.x, s.y, s.debris, 3, null, 0.8);
        if (this.time - (this.lastSnap ?? 0) > 0.05) { this.lastSnap = this.time; sfx.dig((s.x + s.y) & 1); }
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
      for (let step = 0; step < steps; step++) {
        for (const b of bits) {
          if (b.st) continue;
          const age = h.t - b.born;
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
        // No two bits in the same place: this is what makes the heap flow instead of shrinking.
        for (let pass = 0; pass < 2; pass++) {
          const grid = new Map();
          for (const b of bits) {
            if (b.st) continue;
            const key = Math.floor(b.x / size) * 1048576 + Math.floor(b.y / size);
            const cell = grid.get(key);
            if (cell) cell.push(b); else grid.set(key, [b]);
          }
          for (const b of bits) {
            if (b.st) continue;
            const gx = Math.floor(b.x / size), gy = Math.floor(b.y / size);
            for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
              const cell = grid.get((gx + ox) * 1048576 + gy + oy);
              if (!cell) continue;
              for (const c of cell) {
                if (c === b) continue;
                const ux = c.x - b.x, uy = c.y - b.y, far2 = ux * ux + uy * uy;
                if (far2 >= 4 * rad * rad) continue;
                const far = Math.sqrt(far2) || 0.01, push = (2 * rad - far) * 0.25, nx = far2 ? ux / far : 1, ny = far2 ? uy / far : 0;
                b.x -= nx * push; b.y -= ny * push; c.x += nx * push; c.y += ny * push;
              }
            }
          }
        }
        for (const b of bits) {
          if (b.st) continue;
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

  // ------------------------------------------------------------ hazards
  // A hazard wakes when the drill cuts beside it (or into it: `direct`). Lassoed asleep, it is worth gems.
  // What it does is its type's (`haz`: world.hazAt), whatever ground it lies in. Returns the cells it opened, for
  // `changed`.
  trigger(i, haz, direct) {
    const w = this.world, x = i % N, y = Math.floor(i / N);
    if (haz === 'lava') {
      w.setK(i, K.EMPTY); w.lava.set(i, 9); this.lavaVol.set(i, w.row(i).lavaVol);
      sfx.hiss(); this.effect('steam', 'smoke-puff', (x + 0.5) * T, (y + 0.5) * T);
      this.quench(i);
      if (direct && !this.swims) { this.hit(JOLT.lava); this.shake = 5; }
      return [i];
    }
    if (haz === 'spore') {
      w.setK(i, K.EMPTY);
      this.clouds.push({ x, y, t: 0, life: 6 });
      sfx.puff();
      return [i];
    }
    if (haz === 'spark') {
      // Cut into, a crystal arcs at once, and what the arc shattered is opened with the cut. Cut beside, its fuse is
      // lit: long enough to pull back out of the arc's reach before it goes.
      if (direct) return this.zap(x, y);
      const s = this.sparks.get(i);
      if (!s || s.cool <= 0) this.sparks.set(i, { fuse: FUSE, cool: 0 });
    }
    return [];
  }
  // Lava has come into cell `i`: the slag beside it is quenched to steel, white for a moment. A sleeping pocket's
  // rind is dull slag, worth little; woken, the lava makes steel of all the slag it touches, where it lay and
  // wherever it pours. Nothing opens or closes, so the books of loose ground are as they were, and the ground is
  // drawn again. Returns how many cells turned.
  quench(i) {
    const w = this.world;
    let turned = 0;
    for (const s of SIDE) {
      const j = i + s;
      if (w.k(j) !== K.SLAG) continue;
      w.setK(j, K.STEEL); this.quenched.set(j, QUENCH); turned++;
      const x = j % N, y = Math.floor(j / N);
      if (this.onScreen(x, y)) this.sparkle((x + 0.5) * T, (y + 0.5) * T, 4, '#d8e8ff');
    }
    if (turned) { this.version++; if (this.onScreen(i % N, Math.floor(i / N))) { sfx.clink(); sfx.hiss(); } }
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
      if (this.val('arccoil')) { if (this.dents) { this.dents--; this.mended = 0.5; } this.popup(d.x - 0.5, d.y - 1, 'CHARGED', '#d8b8ff'); sfx.gem(4); }
      else this.hit(JOLT.arc);
      this.shake = Math.max(this.shake, 5); this.twang = 0.3;
    }
    for (let v = -3; v <= 3; v++) for (let u = -3; u <= 3; u++) {
      const j = (y + v) * N + x + u;
      if ((u || v) && w.hazAt(j) === 'spark' && !this.sparks.has(j)) this.sparks.set(j, { fuse: 0.3 + cellHash(u, v, 7) * 0.3, cool: 0 });
    }
    const opened = this.shatters(x, y);
    for (const j of opened) {
      const jx = j % N, jy = Math.floor(j / N);
      w.setK(j, K.EMPTY);
      // (Open ground in the north closes over with ice, whatever opened it.)
      if (w.row(j).freeze > 0) { w.dug.set(j, this.clock); this.frostOpen.push(j); }
      if (!this.onScreen(jx, jy)) continue;
      this.chips(jx, jy, DEBRIS.slate, 8, null, 0.9);
      this.effect('shatter', 'shatter', (jx + 0.5) * T, (jy + 0.5) * T);
    }
    // An arc lights what it breaks: the ground it opened, and what stood behind, is seen.
    if (opened.length) { sfx.dig(3); w.see(x, y, 2); }
    return opened;
  }
  // The slate an arc from the crystal at (x, y) shatters: every cell of slate among the eight round it that the
  // tether can reach.
  shatters(x, y) {
    const w = this.world, cells = [];
    for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) {
      const j = (y + v) * N + x + u;
      if ((u || v) && w.k(j) === K.SLATE && this.within(x + u + 0.5, y + v + 0.5)) cells.push(j);
    }
    return cells;
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
  // body), the arc of a charged crystal within its reach, and the burst of a spore pod beside the drill. Frost
  // does not: ice only closes a cut behind the drill, and never on it. Nor does moss growing back, slag turning to
  // steel, the end of the tether's reach, a throw that fetches up against rock, rubble on its way home, or the
  // drill's own charge.
  //
  // A blow that lands takes a pip and stuns for a moment (`jolt`), and for SHIELD seconds after nothing lands
  // again, pip or stun: time to get clear, and the drill blinks to say so. With one pip left it smokes. With the
  // last gone it is a wreck (`wreck`). Returns whether the blow landed.
  hit(time) {
    const d = this.drill;
    if (d.mode === 'dead' || this.shield > 0) return false;
    this.jolt(time);
    this.dents++; this.knocks++; this.shield = SHIELD; this.knocked = 0.5; this.mendIn = 0;
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
  revert() {
    const earned = Math.max(0, Math.round(this.S.grit - JSON.parse(this.docked).grit));
    this.S = JSON.parse(this.docked);
    // (The black box keeps a share of what the trip had earned.)
    const kept = Math.round(earned * this.val('blackbox')), lost = earned - kept;
    this.S.grit += kept;
    this.world.back();
    this.version++;
    this.begin();
    this.drill.armed = false; this.drill.park = true;
    this.notice = { title: 'TRIP LOST', sub: lost > 0 ? `-${compact(lost)} GRIT${kept > 0 ? `, ${compact(kept)} KEPT` : ''}` : '', colour: '#ff7a5a', t: 0, life: 3 };
    this.flash = 0.25; sfx.dock();
    this.save();
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
  updateHazards(dt) {
    const w = this.world, d = this.drill, here = this.di, dcx = Math.floor(d.x), dcy = Math.floor(d.y);
    // The cells that open and that grow back in this pass, for `changed`.
    const opened = [], closed = [];
    // Ground never grows back across the tether: where it lies is worked out afresh, at the moment it is asked.
    let fresh = false;
    const lies = i => {
      if (!fresh) {
        fresh = true; this.under.clear();
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
          const j = (y + DY[(s + start) % 4]) * N + x + DX[(s + start) % 4];
          if (w.hazAt(j) === 'lava') { opened.push(...this.trigger(j, 'lava', false)); continue; }
          if (vol > 1 && w.k(j) === K.EMPTY && !w.lava.has(j) && j !== here && w.s(j) && Math.hypot(x - C, y - C) > 3) {
            w.lava.set(j, 8); this.lavaVol.set(j, vol - 1); this.lavaVol.set(i, 1);
            this.quench(j);
            break;
          }
        }
      }
      if (life - dt > 0) { w.lava.set(i, life - dt); continue; }
      w.lava.delete(i); this.lavaVol.delete(i);
      // (Nothing closes over in a pocket: lava that ran into one only goes out.)
      if (!lies(i) && Math.abs(dcx - x) + Math.abs(dcy - y) > 1 && w.row(i).pocket === null) {
        w.setK(i, K.BASALT); closed.push(i);
        this.effect('steam', 'smoke-puff', (x + 0.5) * T, (y + 0.5) * T);
      }
    }
    // Spores: a burst pod hangs a cloud that stuns what flies into it, then moss closes the ground round it: soft
    // rock of whatever ground each cell lies in. The pods round one that has burst, side by side or corner to
    // corner, burst a moment after it, so a bunch of pods goes off one after another from a single nick (`bunch`
    // says which, for the glow). (A pod woken here joins the list and is met later in this same pass, a moment
    // younger.)
    for (const c of this.clouds) {
      c.t += dt;
      if (Math.max(Math.abs(dcx - c.x), Math.abs(dcy - c.y)) <= 1 && c.t < 0.2) {
        // (Fitted with the spore drive, the burst drives the drill where it would have knocked it.)
        if (!this.val('sporedrive')) this.hit(JOLT.spore);
        else { if (this.boost < BOOST.time - 0.5) { this.popup(d.x - 0.5, d.y - 1, 'BOOST', '#b8f06a'); sfx.gem(6); } this.boost = BOOST.time; }
      }
      if (!c.spread && c.t >= POD_CHAIN) {
        c.spread = true;
        for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) { const j = (c.y + v) * N + c.x + u; if (w.hazAt(j) === 'spore') opened.push(...this.trigger(j, 'spore', false)); }
      }
      if (c.t < c.life) continue;
      for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) {
        const j = (c.y + v) * N + c.x + u;
        if (w.k(j) === K.EMPTY && !lies(j) && !w.lava.has(j) && Math.max(Math.abs(dcx - c.x - u), Math.abs(dcy - c.y - v)) > 1 && w.row(j).pocket === null) { w.setK(j, K.SOFT); closed.push(j); }
      }
    }
    this.clouds = this.clouds.filter(c => c.t < c.life);
    // Charged crystals: a short fuse, then an arc that jumps to every crystal near it.
    for (const [i, s] of this.sparks) {
      if (w.hazAt(i) !== 'spark') { this.sparks.delete(i); continue; }
      if (s.fuse > 0) { s.fuse -= dt; if (s.fuse <= 0) { s.cool = 3; opened.push(...this.zap(i % N, Math.floor(i / N))); } }
      else { s.cool -= dt; if (s.cool <= 0) this.sparks.delete(i); }
    }
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

  // ------------------------------------------------------------ shop
  cost(u) { const l = this.S.lv[u.id]; return l >= u.values.length - 1 ? null : { grit: u.grit[l], gems: u.gems[l], spec: u.spec ? u.spec[l] : 0 }; }
  // What a row's next level asks to have been found, and what is held of it: { what, have, need }, or null where
  // it asks nothing (or there is no next level). A wreck the seed did not lay whole (another thing lies where it
  // should) is not asked for: nothing that cannot be found is ever needed.
  need(u) {
    const l = this.S.lv[u.id];
    if (!u.needs || l >= u.values.length - 1) return null;
    const [what, counts] = u.needs, S = this.S, w = this.world;
    let need = counts[l], have = 0;
    if (what === 'parts') {
      const held = S.wrecks ?? [];
      have = held.filter(Boolean).length;
      for (let n = 0; n < counts[l] && n < w.wrecks.length; n++) { const [x, y] = w.wrecks[n]; if (!held[n] && w.kindAt(x, y, w.biomeAt(x, y)) !== K.WRECK) need--; }
    } else if (what === 'kinds') have = LAB.filter(e => S.lab[e.key]).length;
    else if (what === 'out') have = Math.floor(S.out ?? 0);
    else have = Object.keys(S.met).length;
    return need > 0 ? { what, have, need } : null;
  }
  // What is still to be found before a row's next level can be bought, as the shop says it; or null.
  lacks(u) { const q = this.need(u); return q && q.have < q.need ? `NEEDS ${q.have}/${q.need} ${NEEDS[q.what]}` : null; }
  // The whole specimens of a direction that are in hand.
  specs(kin) { return Math.floor((this.S.spec[kin] ?? 0) + 1e-9); }
  // What can be spent is what has come home: grit and gems still on their way up the tether are not banked yet,
  // and the top bar never shows them (nor ever less than nothing).
  banked(gem) { return gem === undefined ? this.S.grit - this.pending.grit : this.S.gems[gem] - this.pending.gems[gem]; }
  canBuy(u) { const c = this.cost(u); return !!c && this.banked() >= c.grit && this.banked(u.gem) >= c.gems && (!c.spec || this.specs(u.kin) >= c.spec) && !this.lacks(u); }
  buy(u) {
    if (!this.canBuy(u)) {
      // Says what is missing, and where gems are to be had.
      const c = this.cost(u);
      if (c) {
        const gems = c.gems > this.banked(u.gem), spec = c.spec > 0 && this.specs(u.kin) < c.spec, lack = this.lacks(u);
        this.shopNote = { t: 2.5, color: lack ? '#ff9a6a' : gems ? GEM_COLOR[u.gem] : spec ? GEM_COLOR[u.kin] : '#ff7a5a', text: lack ?? (gems ? `GEMS: ${GEM_WHERE[u.gem]}, PAST ${HOME_R}` : spec ? `${GEM_WHERE[u.kin]} POCKETS` : 'NOT ENOUGH GRIT') };
      }
      sfx.deny(); return;
    }
    const c = this.cost(u);
    this.S.grit -= c.grit; this.S.gems[u.gem] -= c.gems; if (c.spec) this.S.spec[u.kin] -= c.spec; this.S.lv[u.id]++; this.S.stats.buys++;
    sfx.buy();
    this.ring(HX * T, HY * T, '#8ce060', 70); this.sparkle(HX * T, HY * T, 16, '#c8f4a0'); this.flash = 0.15;
    if (u.id === 'scanner') { this.world.see(Math.floor(this.drill.x), Math.floor(this.drill.y), this.val('scanner')); this.version++; }
    this.bought = { id: u.id, t: 0.5 };
    this.save();
  }

  // ------------------------------------------------------------ feel
  // Chips of the ground's own colours (`debris`). `ang` is the way the drill was cutting (they fly back at it), null
  // for all round.
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
  ring(x, y, color, reach) { this.rings.push({ x, y, color, reach, t: 0 }); }
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
    this.rings = this.rings.filter(r => r.t < 0.5);
    this.flash = Math.max(0, this.flash - dt); this.counted = Math.max(0, this.counted - dt);
    // The dark eases to the colour and the depth of the ground the drill is in.
    const here = w.row(this.di), want = here.gloom, k = 1 - Math.exp(-dt * 1.5);
    for (let c = 0; c < 3; c++) this.gloom[c] += (want[c] - this.gloom[c]) * k;
    this.murk += (here.dark - this.murk) * k;
    // Motes hang in open ground near the view; each belongs to the ground it was born over.
    while (this.motes.length < 34) {
      const x = this.cam.x + (Math.random() - 0.5) * (W + 60), y = this.cam.y + (Math.random() - 0.5) * (H + 60);
      this.motes.push({ x, y, seed: Math.random() * 100, t: 0, life: 4 + Math.random() * 5, mote: w.row(Math.floor(y / T) * N + Math.floor(x / T)).mote });
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
    setAmbience(here.kin, here.rich >= 2);
    this.chime -= dt;
    if (this.chime <= 0) { this.chime = 2.5 + Math.random() * 4.5; sfx.chime(here.kin); }
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
    this.boost = Math.max(0, this.boost - dt);
    // The mender gives a pip back every so many seconds out in the ground, counted from the last knock or mend.
    if (this.val('mender') && this.dents > 0 && d.mode !== 'dead') {
      this.mendIn += dt;
      if (this.mendIn >= this.val('mender')) { this.mendIn = 0; this.dents--; this.mended = 0.5; this.sparkle(d.x * T, d.y * T, 5, '#8ce060'); sfx.tick(0); }
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
    if (!this.shop && !this.lab) {
      // The clock the ground's own changes are timed by (a cut in the north icing over) stands still with the shop
      // or the lab's notes open, as the lava, the spores and the sparks do: nothing comes due behind them.
      this.clock += dt;
      this.fly(dt);
      this.tend();
      // Ground the string came to lie against on the way: is any of it loose, though nobody knew?
      let met = this.taken.length > 0 && this.discover(this.taken.splice(0), 600, this.walked);
      this.reelTick = (this.reelTick ?? 0) + dt;
      // And ground the line home has passed over: is any of that loose?
      if (d.mode !== 'dead' && this.sweepHome(this.reelTick > 0.1)) met = true;
      if (met || this.reelTick > 0.1) { this.reelTick = 0; this.reelIfRound(); }
      this.updateHazards(dt);
      this.listen(dt);
      // The station makes a trickle of grit of its own: however a world has been spent, the next reach is never out
      // of reach for good.
      this.trickle = (this.trickle ?? 0) + dt;
      if (this.trickle >= 2) { this.trickle -= 2; this.S.grit += Math.ceil(richness(this.val('tether') / 2)); }
      this.saveTick = (this.saveTick ?? 0) + dt;
      if (this.saveTick > 20) { this.saveTick = 0; this.save(); }
    }
    // Rubble on its way home keeps coming with the shop open: what it pays is banked as it lands.
    this.updateHauls(dt);
    this.ambient(dt);
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

  // ------------------------------------------------------------ drawing
  rockSheet(k, b) {
    return k === K.BEDROCK ? 'bedrock' : k === K.SLATE ? 'slate' : k === K.VAULT || k === K.RELIC ? 'vault' : k === K.ICE ? 'ice' : k === K.BASALT ? 'basalt' : rowOf(b).sheet;
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
  // own sheet (`row`), a hazard from its type's, a relic from its direction's, a find from the finds'. A cross's
  // rich ore is its donor's, and is drawn as the donor's (`itemsB`), so that what it looks like is what it pays.
  // A pocket's mineral is its own frame of the 'minerals' sheet, and its special cell (a hive's stalk) one of two:
  // the one that runs level or the one that stands upright, as the cell `i` lies between what it joins (asked of
  // the cells beside it; upright where `i` is not given).
  overlay(k, row, i) {
    const P = row.pocket;
    if (P !== null && (k === K.NODE || k === (P.kind ?? K.MINERAL))) {
      if (k === (P.kind ?? K.MINERAL)) return this.mineralOf(row) ? ['minerals', P.mineral] : null;
      const w = this.world, joins = j => { const q = w.k(j); return q === K.NODE || q === (P.kind ?? K.MINERAL); };
      const frame = `${P.node}-${i !== undefined && !joins(i - N) && !joins(i + N) && (joins(i - 1) || joins(i + 1)) ? 'h' : 'v'}`;
      return sheets.minerals?.frames[frame] ? ['minerals', frame] : null;
    }
    if (k === K.ORE_B) return [row.itemsB, 'oreB'];
    if (k === K.DENSE || k === K.ORE_A) return [row.items, k === K.DENSE ? 'dense' : 'oreA'];
    if (k === K.HAZARD || k === K.HAZARD2) { const haz = hazOf(k, row); return haz ? [HAZARDS[haz].sheet, 'hazard'] : null; }
    // Slag and the steel it is quenched to are the lava's, drawn from the lava's sheet whatever ground they lie in.
    if (k === K.SLAG || k === K.STEEL) return [HAZARDS.lava.sheet, k === K.SLAG ? 'slag' : 'steel'];
    // A keystone is an iron staple across its block of rock; a prism turns through the gems' colours (`render`).
    return k === K.RELIC ? [rowOf(row.kin).items, 'relic'] : k === K.CACHE ? ['finds', 'cache'] : k === K.WRECK ? ['finds', 'part']
      : k === K.KEY ? ['finds', 'key'] : k === K.PRISM ? ['finds', 'prism'] : null;
  }

  render() {
    const { ctx, W, H, world: w } = this, d = this.drill, now = this.time * 1000;
    const sx = this.shake ? (cellHash((now / 16) | 0, 1, 5) - 0.5) * this.shake : 0, sy = this.shake ? (cellHash((now / 16) | 0, 2, 5) - 0.5) * this.shake : 0;
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
      if (k !== K.HAZARD && k !== K.HAZARD2 && k !== K.RELIC && k !== K.STEEL && k !== K.PRISM) continue;
      const i = y * N + x, row = w.row(i), m = w.mask(x, y), ux = x * T - ox - ((m & 4) ? 0 : 1), uy = y * T - oy - ((m & 16) ? 0 : 1);
      // A prism turns through the gems' colours, each in its own time.
      if (k === K.PRISM) { draw(ctx, 'finds', frameAt('finds', 'prism', now + cellHash(x, y, 4) * 720), ux, uy); continue; }
      // Steel glints now and then, each bar in its own time, and is white for a moment as it is quenched.
      if (k === K.STEEL) { const items = HAZARDS.lava.sheet; draw(ctx, items, this.quenched.has(i) ? 'quench' : frameAt(items, 'steel', now + cellHash(x, y, 4) * 1140), ux, uy); continue; }
      if (k === K.RELIC) { const rs = rowOf(DIR_BIOME[w.relicAt.indexOf(i)] ?? row.kin).items; draw(ctx, rs, frameAt(rs, 'relic', now), ux, uy); continue; }
      // A hazard looks as its type does, whatever ground it lies in.
      const haz = hazOf(k, row);
      if (!haz) continue;
      const items = HAZARDS[haz].sheet, s = this.sparks.get(i);
      draw(ctx, items, s && s.fuse > 0 ? (((now / 60) | 0) % 2 ? 'hazard-b' : 'hazard') : frameAt(items, 'hazard', now + cellHash(x, y, 4) * 900), ux, uy);
    }
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
    // The core, as the winch upgrades have built it, with the scanner's dish on its shoulder.
    const coreX = (C - 1) * T - ox, coreY = (C - 1) * T - oy;
    if (coreX > -80 && coreY > -80 && coreX < W + 40 && coreY < H + 40) {
      const hull = this.S.lv.winch;
      draw(ctx, 'core', this.coreFlash > 0 ? `core-flash-${hull}` : this.S.won ? `core-c-${hull}` : frameAt('core', `idle-${hull}`, now), coreX, coreY);
      draw(ctx, 'dish', frameAt('dish', `dish-${this.S.lv.scanner}`, now), coreX + 34, coreY - 6);
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
        hull.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), ring = [];
        for (const pass of [0, 1]) {
          const start = ring.length;
          for (const p of pass ? hull.slice().reverse() : hull) { while (ring.length >= start + 2 && turn(ring[ring.length - 2], ring[ring.length - 1], p) <= 0) ring.pop(); ring.push(p); }
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
      ctx.globalAlpha = Math.min(1, (c.life - c.t) * 2) * 0.85;
      const f = frameAt('spore', 'area', (c.t * 1000) % (duration('spore', 'area') * 0.8));
      if (f) draw(ctx, 'spore', f, (c.x + 0.5) * T - ox - f[2] / 2, (c.y + 0.5) * T - oy - f[3] / 2);
      ctx.globalAlpha = 1;
    }
    // The drill: turned to its heading, biting into what it cuts, stretched by speed and squashed by a knock.
    const speed = Math.hypot(d.vx, d.vy), bite = d.dig >= 0 ? 2 + Math.min(1, d.digT / d.digDur) * 4 + Math.sin(d.digT * 70) : 0;
    const dx = d.x * T - ox + Math.cos(d.ang) * bite, dy = d.y * T - oy + Math.sin(d.ang) * bite;
    const along = d.squash > 0 ? 0.82 : 1 + Math.min(0.3, speed / 90), across = d.squash > 0 ? 1.18 : 1 - Math.min(0.14, speed / 200);
    // Where there is the fine canvas (the tether's), the drill is drawn on it, at the screen's own resolution: it
    // stands exactly where it is, not on the nearest pixel of the game's, and turned to any heading each of its
    // pixels is still a clean square (`drawRopes`). With a panel up, and where there is no such canvas, it is drawn
    // here with the ground.
    const wake = speed > 14 ? [3, 2, 1].map(g => [0.34 - g * 0.09, dx - d.vx / speed * g * 7, dy - d.vy / speed * g * 7]) : [];
    this.drillDrawn = [dx, dy, d.ang, this.S.lv.drill, this.S.lv.momentum, d.mode !== 'dead' && (d.dig >= 0 || speed > 1) ? now : -1, along, across];
    // A wreck is dark; a drill that has just been knocked blinks for as long as nothing can knock it again.
    const alpha = d.mode === 'dead' ? 0.5 : this.shield > 0 && ((now / 70) | 0) % 2 === 0 ? 0.35 : 1, hurt = this.hurt > 0 && ((now / 50) | 0) % 2 === 1;
    this.drillFine = this.over && this.shopRise <= 0.02 && this.labRise <= 0.02 ? { wake, alpha, hurt } : null;
    if (!this.drillFine) {
      // Speed leaves a wake: fading copies of the drill back along the way it came.
      for (const [a, wx, wy] of wake) { ctx.globalAlpha = a; this.drawDrill(wx, wy, d.ang, this.S.lv.drill, this.S.lv.momentum, -1, along, across); }
      ctx.globalAlpha = alpha;
      this.drawDrill(...this.drillDrawn);
      ctx.globalAlpha = 1;
      if (hurt) { ctx.globalAlpha = 0.5; ctx.fillStyle = '#ff5a4a'; ctx.fillRect(Math.round(dx) - 5, Math.round(dy) - 5, 10, 10); ctx.globalAlpha = 1; }
    }
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
    for (const m of this.motes) {
      if (w.peek(Math.floor(m.x / T), Math.floor(m.y / T)) !== K.EMPTY) continue;
      ctx.globalAlpha = Math.max(0, Math.min(1, m.t, m.life - m.t)) * (0.35 + 0.3 * Math.sin(this.time * 3 + m.seed)); ctx.fillStyle = m.mote[0];
      ctx.fillRect(Math.round(m.x - ox), Math.round(m.y - oy), 1, 1);
    }
    ctx.globalAlpha = 1;
    { const t0 = performance.now(); this.light(ox, oy); this.timed('light', t0); }
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
    for (const r of this.rings) {
      // A ring of whole pixels spreading from a point.
      const u = r.t / 0.5, rad = r.reach * (1 - (1 - u) * (1 - u)), n = Math.max(12, (rad * 1.6) | 0);
      ctx.globalAlpha = (1 - u) * 0.9; ctx.fillStyle = r.color;
      for (let a = 0; a < n; a++) ctx.fillRect(Math.round(r.x - ox + Math.cos(a / n * 6.283) * rad), Math.round(r.y - oy + Math.sin(a / n * 6.283) * rad), 1, 1);
    }
    ctx.globalAlpha = 1;
    if (this.flash > 0) { ctx.globalAlpha = Math.min(0.45, this.flash * 1.4); ctx.fillStyle = '#fff6c8'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    for (const p of this.popups) {
      const py = p.y - oy - p.t * 18, px = p.x - ox;
      ctx.globalAlpha = Math.min(1, (0.9 - p.t) * 4);
      if (typeof p.icon === 'string') draw(ctx, 'icons', p.icon, px - textWidth(p.label) / 2 - 11, py - 1);
      else if (p.icon) this.drawMineral(ctx, p.icon[1], px - textWidth(p.label) / 2 - 13, py - 3);
      text(ctx, p.label, px, py, p.color, 0.5);
      ctx.globalAlpha = 1;
    }
    { const t0 = performance.now(); this.drawHud(ox, oy); this.timed('hud', t0); }
    if (this.over) { const t0 = performance.now(); this.drawRopes(ox, oy); this.timed('ropes', t0); }
  }

  // The drill as its upgrades have made it (the bit's metal, whatever the ram has bolted on), drawn about its
  // middle at any heading, `along` and `across` times its size.
  drawDrill(x, y, ang, bit, ram, now, along = 1, across = 1, ctx = this.ctx, plates = this.S.lv.hull, fitted = null) {
    const body = now >= 0 ? frameAt('drill', `right-${bit}`, now) : `right-a-${bit}`, s = sheets.drill;
    ctx.save();
    // (On the game's own canvas it stands on a whole pixel; on a finer one, exactly where it is.)
    if (ctx === this.ctx) ctx.translate(Math.round(x), Math.round(y)); else ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(along, across);
    const fits = WORKS.filter(u => this.S.lv[u.id] > 0 || u.id === fitted).map(u => `fit-${u.id}`);
    for (const frame of [...(ram > 0 ? [`ram-right-${ram}`] : []), body, ...(plates > 0 ? [`plate-right-${plates}`] : []), ...fits]) {
      const r = typeof frame === 'string' ? s.frames[frame] : frame;
      ctx.drawImage(s.image, r[0], r[1], r[2], r[3], -8, -8, 16, 16);
    }
    ctx.restore();
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
      const wide = r.style.thick ? 2 : 1.4, braid = r.style.b !== r.style.a;
      // A rope that is no loop is traced only where it crosses the view (`ropeRuns`). Far out nearly all of the
      // tether lies off the screen, and so does nearly all of the rope of every haul on its way home: traced whole,
      // three times each, a dozen hauls a thousand cells out were a dozen ropes twenty thousand pixels long in every
      // frame, and a phone stood still drawing them.
      const runs = r.loop ? null : this.ropeRuns(pts, braid);
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
      o.setLineDash([]); o.lineCap = 'round';
      o.strokeStyle = 'rgba(10, 8, 16, 0.7)'; o.lineWidth = wide + 1.2; trace(0.8); o.stroke();
      o.strokeStyle = r.style.a; o.lineWidth = wide; trace(0); o.stroke();
      if (braid) {
        // The second strand of the braid, in short lengths along it: each part of the rope begins its lengths where
        // the whole rope would have them, so the braid stays put on the ground whatever part of it is in view.
        o.lineCap = 'butt'; o.setLineDash([BRAID * r.style.dash, BRAID * (1 - r.style.dash)]);
        o.strokeStyle = r.style.b; o.lineWidth = wide * 0.62;
        if (r.loop) { trace(0); o.stroke(); }
        else for (const run of runs) { o.lineDashOffset = run[2] % BRAID; trace(0, run); o.stroke(); }
        o.lineDashOffset = 0; o.setLineDash([]);
      }
      if (r.loop) for (const [x, y] of pts) { bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); }
      else for (const [from, to] of runs) for (let i = from; i <= to; i++) { const [x, y] = pts[i]; bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); }
    }
    // (The drill and its wake are drawn here too: their place is cleared with the ropes'.)
    if (fine) for (const [x, y] of [[this.drillDrawn[0], this.drillDrawn[1]], ...fine.wake.map(([, wx, wy]) => [wx, wy])]) { bx0 = Math.min(bx0, x - 8); by0 = Math.min(by0, y - 8); bx1 = Math.max(bx1, x + 8); by1 = Math.max(by1, y + 8); }
    if (bx0 > bx1) return;
    bx0 = Math.max(0, Math.floor(bx0 - 12)); by0 = Math.max(0, Math.floor(by0 - 12)); bx1 = Math.min(W, Math.ceil(bx1 + 12)); by1 = Math.min(H, Math.ceil(by1 + 12));
    this.ropeDirty = [bx0, by0, bx1, by1];
    // In the dark it is as dim as the ground it lies on.
    if (this.dark && this.darkAt) {
      o.globalCompositeOperation = 'source-atop'; o.imageSmoothingEnabled = true; o.globalAlpha = 0.85;
      o.drawImage(this.dark, ...this.darkAt);
      o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1;
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
      this.drawDrill(...this.drillDrawn, o);
      o.globalAlpha = 1;
      if (fine.hurt) { o.globalAlpha = 0.5; o.fillStyle = '#ff5a4a'; o.fillRect(dx - 5, dy - 5, 10, 10); o.globalAlpha = 1; }
    }
    // Never over the interface: the bar at the foot, the map, the buttons, and the small panels that come and go under the
    // top bar (a place's plate, the count of specimens), which the frame's own drawing of the interface listed.
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
      if (this.chunks.size > 180) for (const [k, old] of this.chunks) if (Math.abs(old.cx - cx) > 9 || Math.abs(old.cy - cy) > 12) this.chunks.delete(k);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 128;
      c = { canvas, ctx: canvas.getContext('2d', { alpha: false }), v: -1, cx, cy };
      this.chunks.set(key, c);
    }
    if (c.v !== this.version) { c.v = this.version; this.paint(c.ctx, cx * 8, cy * 8); }
    return c.canvas;
  }
  // Everything in a piece of ground that stays put: floors, rock, ore and armour.
  paint(ctx, x0, y0) {
    const w = this.world;
    ctx.globalAlpha = 1; ctx.fillStyle = '#07060b'; ctx.fillRect(0, 0, 128, 128);
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
      if (k === K.EMPTY) continue;
      const sheet = this.rockSheet(k, b), rects = sheets[sheet].tiles[m];
      draw(ctx, sheet, rects[(cellHash(x, y, 3) * rects.length) | 0], px, py);
      const ux = px - ((m & 4) ? 0 : 1), uy = py - ((m & 16) ? 0 : 1);
      if (k === K.SLATE || k === K.VAULT) draw(ctx, 'tough', k === K.SLATE ? 'slate' : 'vault', ux, uy);
      const over = this.overlay(k, row, i);
      if (over && over[1] !== 'hazard' && over[1] !== 'relic' && over[1] !== 'prism') draw(ctx, over[0], over[1], ux, uy);
    }
  }

  // Light spreads from a cell through open ground, losing a little with every cell, and soaks a short way into
  // the rock it meets: so it takes the shape of the tunnels and lights the faces of their walls. It is worked out
  // in a window of cells round the view; `want` holds the brightest light to reach each cell this frame.
  shine(cx, cy, power, reach) {
    const L = this.lightMap, w = this.world, x = cx - L.x0, y = cy - L.y0;
    if (x < 1 || y < 1 || x >= L.cols - 1 || y >= L.rows - 1 || L.want[y * L.cols + x] >= power) return;
    const queue = L.queue, fade = power / reach;
    let head = 0, tail = 0;
    L.want[y * L.cols + x] = power; queue[tail++] = y * L.cols + x;
    while (head < tail) {
      const at = queue[head++], here = L.want[at], qx = at % L.cols, qy = (at / L.cols) | 0;
      if (qx < 1 || qy < 1 || qx >= L.cols - 1 || qy >= L.rows - 1) continue;
      const solid = L.solid[at];
      for (const [u, v, far] of LIGHT_STEP) {
        const j = at + v * L.cols + u;
        // Rock drinks light fast: a face is lit, the cell behind it barely.
        const next = here - fade * far * (solid || L.solid[j] ? 2.6 : 1);
        if (next > L.want[j] + 0.01 && tail < queue.length) { L.want[j] = next; queue[tail++] = j; }
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
    if (!L || L.cols !== cols || L.rows !== rows) L = this.lightMap = { x0, y0, cols, rows, want: new Float32Array(cols * rows), lit: new Float32Array(cols * rows), next: new Float32Array(cols * rows), solid: new Uint8Array(cols * rows), queue: new Int32Array(4096) };
    // The window follows the view: what was lit keeps its place in the world.
    if (L.x0 !== x0 || L.y0 !== y0) {
      const sx = x0 - L.x0, sy = y0 - L.y0;
      L.next.fill(0);
      for (let y = Math.max(0, -sy); y < Math.min(rows, rows - sy); y++) for (let x = Math.max(0, -sx); x < Math.min(cols, cols - sx); x++) L.next[y * cols + x] = L.lit[(y + sy) * cols + x + sx];
      [L.lit, L.next] = [L.next, L.lit]; L.x0 = x0; L.y0 = y0;
    }
    L.want.fill(0);
    const keys = L.keys ??= [];
    keys.length = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const k = w.peek(x0 + x, y0 + y);
      L.solid[y * cols + x] = k === K.EMPTY ? 0 : 1;
      if (k === K.KEY) keys.push((y0 + y) * N + x0 + x);
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
    // Keystones that have been seen glint, so that they read from across the screen: the nearest dozen.
    if (keys.length > KEY_GLINTS) {
      const far = i => ((i % N) + 0.5 - d.x) ** 2 + (Math.floor(i / N) + 0.5 - d.y) ** 2;
      keys.sort((a, b) => far(a) - far(b)); keys.length = KEY_GLINTS;
    }
    this.glints = keys.length;
    for (const i of keys) this.shine(i % N, Math.floor(i / N), KEY_GLINT, KEY_GLOW);
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
      ctx.fillStyle = this.edge > 0 ? '#ff7a5a' : '#f4ecd8'; ctx.globalAlpha = this.edge > 0 ? 0.9 : 0.3;
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
      this.ropes.push({ pts: pts.reverse(), style, wob });
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
  // And third, where the haul held a pocket's mineral that raised a count of specimens: by how many.
  bannerSays(b) { return [`${b.n} x${b.mult.toFixed(1)}${b.over < 1 ? ' WINCH OVER LOAD' : ''}`, b.shine > 1 ? `PRISM x${b.shine}` : null, b.spec > 0 ? `+${b.spec}` : null]; }
  // What the next thing to be bought with a direction's specimens asks of them, or 0 where nothing is left to buy.
  specNeed(kin) { const u = WORKS.find(u => u.kin === kin && this.cost(u)); return u ? this.cost(u).spec : 0; }
  drawHud(ox, oy) {
    const { ctx, W, H, S } = this, now = this.time * 1000, d = this.drill;
    this.buttons.length = 0; this.panels.length = 0;
    // Banner of the last haul. (It, the word across the screen and a new place's name stand clear of the map, and of
    // a place's plate where that has had to go under the map: `plateLow`.)
    const head = this.plateLow ? 78 : Math.max(60, H * 0.2);
    if (this.banner) {
      const b = this.banner, pop = Math.min(1, b.t / 0.12), y = Math.round(head - (1 - pop) * 8);
      ctx.globalAlpha = Math.min(1, (b.life - b.t) * 3);
      const big = (b.n >= 10 ? 2 : 1) + (b.t < 0.07 ? 1 : 0);
      text(ctx, b.title, W / 2, y, b.n >= 30 ? '#ffe14a' : '#ffffff', 0.5, big);
      const [size, prism, spec] = this.bannerSays(b);
      text(ctx, size, W / 2, y + 11 * big + 2, b.over < 1 ? '#ffb060' : '#bfe6ff', 0.5);
      let line = `+${compact(b.grit)}`, lw = textWidth(line) + 11;
      const gems = [1, 2, 3, 4].filter(g => b.gems[g] > 0);
      for (const g of gems) lw += textWidth(`+${compact(b.gems[g])}`) + 15;
      if (spec) lw += textWidth(spec) + 17;
      let lx = Math.round(W / 2 - lw / 2), ly = y + 11 * big + 14;
      draw(ctx, 'icons', 'grit', lx, ly - 1); text(ctx, line, lx + 11, ly, '#ffe14a'); lx += textWidth(line) + 15;
      for (const g of gems) { draw(ctx, 'icons', GEM_ICON[g], lx, ly - 1); text(ctx, `+${compact(b.gems[g])}`, lx + 11, ly, GEM_COLOR[g]); lx += textWidth(`+${compact(b.gems[g])}`) + 15; }
      // The specimens a pocket's mineral added, with the mineral itself beside the figure.
      if (spec) { if (b.mineral) this.drawMineral(ctx, b.mineral, lx - 1, ly - 3); else draw(ctx, 'icons', `spec-${GEM_ICON[b.specOf]}`, lx, ly - 1); text(ctx, spec, lx + 13, ly, GEM_COLOR[b.specOf]); }
      // A prism among the cells: what it multiplied the gems by, in the gems' colours by turns.
      if (prism) text(ctx, prism, W / 2, ly + 12, GEM_COLOR[1 + ((now / 240) | 0) % 4], 0.5);
      ctx.globalAlpha = 1;
    }
    // Over a dead drill the screen goes dark.
    if (d.mode === 'dead' && this.tow) { ctx.globalAlpha = Math.min(0.85, this.tow.t / DEATH); ctx.fillStyle = '#07060b'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    if (this.notice) {
      const note = this.notice, pop = Math.min(1, note.t / 0.12);
      ctx.globalAlpha = Math.min(1, (note.life - note.t) * 3);
      text(ctx, note.title, W / 2, Math.round(head - (1 - pop) * 8), note.colour, 0.5, 2 + (note.t < 0.07 ? 1 : 0));
      if (note.sub) text(ctx, note.sub, W / 2, Math.round(head) + 24, '#ffe14a', 0.5);
      ctx.globalAlpha = 1;
    }
    if (S.won && this.wonAt !== undefined && this.time - this.wonAt < 6) text(ctx, 'CORE RESTORED', W / 2, H * 0.36, '#ffe14a', 0.5, 2);
    // A ground met for the first time: its name alone, large, a little under where a haul's banner goes (and under
    // the banner itself, if one is up). A name too long for the screen is set on two lines, or small.
    const place = this.place;
    if (place && place.card) {
      const pop = Math.min(1, place.t / 0.12), words = place.title.split(' '), fits = s => textWidth(s, 2) <= W - 8;
      let lines = [place.title], big = 2;
      if (!fits(place.title)) {
        let best = null;
        for (let n = 1; n < words.length; n++) {
          const a = words.slice(0, n).join(' '), b = words.slice(n).join(' '), wide = Math.max(textWidth(a, 2), textWidth(b, 2));
          if (fits(a) && fits(b) && (!best || wide < best[2])) best = [a, b, wide];
        }
        if (best) lines = [best[0], best[1]]; else big = 1;
      }
      const under = this.banner ? Math.round(head) + 11 * (this.banner.n >= 10 ? 2 : 1) + (this.banner.shine > 1 ? 42 : 30) : 0, y = Math.max(under, Math.round(Math.max(head + 14, H * 0.3) - (1 - pop) * 8));
      ctx.globalAlpha = Math.min(1, (place.life - place.t) * 3);
      lines.forEach((line, n) => text(ctx, line, W / 2, y + n * 11 * big, place.colour, 0.5, big + (n === 0 && lines.length === 1 && place.t < 0.07 ? 1 : 0)));
      ctx.globalAlpha = 1;
    }
    // The bar, at the foot of the screen: what has been banked, the hull, what the lab knows, and how much of its
    // reach the tether has left. A tap on it opens the panel (what the drill is, the lab's notes, the chart, the
    // menu), and another shuts it.
    const B = H - 44;
    slice9(ctx, 'ui', 'panel', 2, B + 2, W - 4, 40);
    draw(ctx, 'icons', 'grit', 6, B + 5);
    text(ctx, compact(S.grit - this.pending.grit), 18, B + 6 - (this.counted > 0 ? 1 : 0), this.counted > 0 ? '#ffffff' : '#ffe14a');
    const gw = (W - 30) / 4;
    for (let g = 1; g < 5; g++) {
      const gx = Math.round(6 + (g - 1) * gw), have = S.gems[g] - this.pending.gems[g];
      ctx.globalAlpha = S.gems[g] > 0 ? 1 : 0.35;
      draw(ctx, 'icons', GEM_ICON[g], gx, B + 17);
      text(ctx, compact(have), gx + 12, B + 18, GEM_COLOR[g]);
      ctx.globalAlpha = 1;
    }
    const R = this.val('tether'), far = this.far, left = Math.max(0, R - far), label = compact(left), room = textWidth(label) + 10;
    this.bar(6, B + 29, W - 12 - room, 'tether', left / R, far / R > 0.93 ? '#ff7a5a' : '#f4ecd8', this.twang > 0);
    text(ctx, label, W - 6, B + 30, this.twang > 0 ? '#ff7a5a' : '#f4ecd8', 1);
    // The hull: a pip for each knock it can take, after the grit. One just lost shows red for a moment, the last
    // one left stays red, and a hull just mended shows white.
    const pips = this.val('hull'), sound = this.hull, hx = 18 + textWidth(compact(S.grit - this.pending.grit)) + 7;
    for (let n = 0; n < pips; n++) {
      const x = hx + n * 5, full = n < sound, lost = n === sound && this.knocked > 0;
      ctx.fillStyle = '#16121c'; ctx.fillRect(x, B + 6, 4, 7);
      ctx.fillStyle = lost ? '#ff5a4a' : !full ? '#3a3450' : this.mended > 0 ? '#ffffff' : sound === 1 ? '#ff7a5a' : '#bfe6ff';
      ctx.fillRect(x + 1, B + 7, 2, 5);
    }
    // What the lab has analysed, of all it can: shown once there is a first sample, lit for a moment by a new level.
    const known = LAB.filter(e => S.lab[e.key]).length;
    if (known && hx + pips * 5 + 4 < W - 6 - textWidth(`${known}/${LAB.length}`) - 11) {
      const count = `${known}/${LAB.length}`, lit = this.labFlash > 0 && ((now / 120) | 0) % 2 === 0;
      text(ctx, count, W - 6, B + 6, lit ? '#ffffff' : '#8cf2c4', 1);
      draw(ctx, 'icons', 'lab', W - 6 - textWidth(count) - 11, B + 5);
    }
    this.button(0, B, W, 44, () => this.openLab(!this.lab));
    // The place the drill has come into: its name on a plate, with its direction's gem (and a second gem, where
    // the place pays two).
    if (!place || place.card) this.plateLow = false;
    if (place && !place.card) {
      const more = place.also ? 11 : 0, slide = Math.min(1, place.t / 0.15), pw = textWidth(place.title) + 23 + more, px = 4 - Math.round((1 - slide) * (1 - slide) * 10);
      ctx.globalAlpha = Math.min(1, slide, (place.life - place.t) / 0.3);
      // (At the head of the screen; under the map, where its name is too long to stand beside it.)
      const ty = px + pw > W - 60 ? 58 : 4;
      this.plateLow = ty > 4;
      slice9(ctx, 'ui', 'panel', px, ty, pw, 14);
      this.panels.push([px, ty, pw, 14]);
      if (place.mineral) this.drawMineral(ctx, place.mineral, px + 3, ty + 1); else draw(ctx, 'icons', place.icon, px + 4, ty + 2);
      if (place.also) draw(ctx, 'icons', place.also, px + 15, ty + 2);
      text(ctx, place.title, px + 17 + more, ty + 2, place.colour);
      ctx.globalAlpha = 1;
    }
    // Specimens just banked: the count of that direction's slides out under the top bar, below where a place's
    // plate goes, with what the next thing they buy asks, while there is one.
    const line = this.specLine;
    if (line) {
      const need = this.specNeed(line.kin), label = `${Math.floor(S.spec[line.kin] + 1e-9)}${need ? `/${need}` : ''}`;
      const slide = Math.min(1, line.t / 0.15), pw = textWidth(label) + 23, px = 4 - Math.round((1 - slide) * (1 - slide) * 10);
      ctx.globalAlpha = Math.min(1, slide, (line.life - line.t) / 0.3);
      slice9(ctx, 'ui', 'panel', px, 20, pw, 14);
      this.panels.push([px, 20, pw, 14]);
      draw(ctx, 'icons', `spec-${GEM_ICON[line.kin]}`, px + 4, 22);
      text(ctx, label, px + 17, 22, GEM_COLOR[line.kin]);
      ctx.globalAlpha = 1;
    }
    // The map, in the top right corner.
    this.drawMap(W - 52, 6);
    // The shop's button, over the bar, when the drill is home.
    const by = H - 88;
    const afford = ROWS.some(u => this.canBuy(u));
    if (this.atCore && !this.shop && !this.lab && d.mode === 'free') {
      const w = 84, x = Math.round(W / 2 - w / 2), up = afford && ((now / 300) | 0) % 2;
      slice9(ctx, 'ui', afford ? (up ? 'button-down' : 'button') : 'panel', x, by + 6, w, 24);
      text(ctx, 'UPGRADES', x + w / 2, by + 13, afford ? '#ffffff' : '#9a94a8', 0.5);
      this.button(x - 4, by, w + 8, 36, () => { this.shop = true; sfx.tap(); });
      if (afford && S.stats.buys === 0) draw(ctx, 'ui', 'hand', x + w / 2 - 4, by + 18 + Math.round(Math.sin(now / 150) * 3));
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
      slice9(ctx, 'ui', 'panel', x - 3, y - 3, size + 6, size + 6);
      this.mapRect = [x - 3, y - 3, size + 6, size + 6];
      // With the chart bought, a tap on the map opens it.
      if (this.val('chart') && !this.lab && !this.shop) {
        ctx.fillStyle = '#ffe14a'; ctx.fillRect(x - 2, y - 2, size + 4, 1); ctx.fillRect(x - 2, y + size + 1, size + 4, 1);
        this.button(x - 3, y - 3, size + 6, size + 6, () => this.openLab(true, 'chart'));
      }
    }
    let map = M.mapCanvas;
    if (!map || map.width !== size) { map = M.mapCanvas = document.createElement('canvas'); map.width = map.height = size; M.mapData = map.getContext('2d', { willReadFrequently: true }).createImageData(size, size); M.mapAt = -1; }
    const view = `${this.version}:${R}:${per}:${lens}:${mx0},${my0}`;
    if (this.time - M.mapAt > 0.5 || M.mapFor !== view) {
      M.mapAt = this.time; M.mapFor = view;
      const px = M.mapData.data;
      for (let v = 0; v < size; v++) for (let u = 0; u < size; u++) {
        const wx = Math.floor(mx0 + (u - size / 2 + 0.5) * per), wy = Math.floor(my0 + (v - size / 2 + 0.5) * per), o = (v * size + u) * 4, k = w.peek(wx, wy);
        let [r, g, b] = rowOf(w.biomeKnown(wx, wy)).map;
        const inside = Math.hypot(wx - C, wy - C) <= R;
        let shade = (k < 0 ? 0.3 : k === K.EMPTY ? 0.12 : 0.85) * (inside ? 1 : 0.45);
        // What the lens tells apart is drawn in its own colour, at full strength.
        const L = k > 0 ? LENS[k] : undefined;
        if (L !== undefined && L[0] <= lens) { r = L[1]; g = L[2]; b = L[3]; shade = inside ? 1 : 0.6; }
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
    // What the finder knows of and the drill has not seen: a dot each, in the find's own colour, ringed dark.
    for (const [what, fx, fy] of this.findsNear(mx0, my0, size * per / 2)) {
      const [mx, my] = at(fx + 0.5, fy + 0.5);
      ctx.fillStyle = '#0c0a12'; ctx.fillRect(Math.round(mx) - 2, Math.round(my) - 2, 4, 4);
      ctx.fillStyle = SPOT[what][1]; ctx.fillRect(Math.round(mx) - 1, Math.round(my) - 1, 2, 2);
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
  }
  // The finds the finder marks within `half` cells of a place (square) and within its range of the drill: those of the kinds its level knows, that
  // still lie where the seed laid them (a pocket or a wreck may have taken the place), within the tether's reach,
  // and that the drill has not yet seen (what it has seen is on the map already). Asked of the seed alone: no
  // ground is made to answer. The list is kept while the place, the span and the level stay the same.
  findsNear(cx, cy, half) {
    const w = this.world, level = this.val('mapfinder'), R = this.val('tether');
    if (!level) return [];
    // (Sectors of finds that are both in the view asked about and within the finder's range of the drill.)
    const d = this.drill, far = FINDER[level], lo = (a, b) => Math.floor((Math.max(a - half, b - far) - C) / FIND), hi = (a, b) => Math.floor((Math.min(a + half, b + far) - C) / FIND);
    const x0 = lo(cx, d.x), x1 = hi(cx, d.x), y0 = lo(cy, d.y), y1 = hi(cy, d.y);
    const key = `${this.S.seed}:${level}:${R}:${x0},${y0},${x1},${y1}:${Math.floor(d.x / 8)},${Math.floor(d.y / 8)}:${this.version}`;
    if (this.foundFor !== key) {
      this.foundFor = key; this.found = [];
      for (let sy = y0; sy <= y1 && this.found.length < 200; sy++) for (let sx = x0; sx <= x1; sx++) {
        const [what, fx, fy] = w.findSpot(sx, sy);
        if (what === null || !(FOUND[what] <= level) || Math.hypot(fx - C, fy - C) > R || Math.hypot(fx + 0.5 - d.x, fy + 0.5 - d.y) > far || w.peek(fx, fy) >= 0) continue;
        const laid = w.kindAt(fx, fy, w.biomeAt(fx, fy));
        if ((what === 'cache' && laid !== K.CACHE) || (what === 'prism' && laid !== K.PRISM) || rowOf(w.biomeAt(fx, fy)).pocket !== null) continue;
        this.found.push([what, fx, fy]);
      }
    }
    return this.found;
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
  // A wheel turned over the chart zooms it about the pointer. Returns whether the chart took it.
  wheel(x, y, delta) {
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
  // whole reach), and its cross.
  panelTabs(px, py, pw, HEAD) {
    const { ctx } = this;
    let tx = px + 8;
    for (const [id, name] of [['stats', 'STATS'], ['lab', 'LAB'], ...(this.charted ? [['chart', 'MAP']] : []), ['menu', 'MENU']]) {
      const tw = textWidth(name), on = this.labTab === id;
      text(ctx, name, tx, py + 7, on ? '#ffe14a' : '#8a84a0');
      if (on) { ctx.fillStyle = '#ffe14a'; ctx.fillRect(tx, py + 17, tw, 1); }
      this.buttons.unshift({ x: tx - 4, y: py, w: tw + 10, h: HEAD, act: () => { this.labTab = id; sfx.tap(); } });
      tx += tw + 12;
    }
    text(ctx, 'x', px + pw - 12, py + 6, '#ffffff');
    this.buttons.unshift({ x: px + pw - 24, y: py, w: 24, h: HEAD, act: () => { this.lab = false; sfx.tap(); } });
  }
  // What the drill is now, a line a thing: every figure read from the game itself, so it cannot say otherwise than
  // the game plays. What a hazard does to this drill is in green where something fitted has turned it.
  stats() {
    const S = this.S, parts = (S.wrecks ?? []).filter(Boolean).length, known = LAB.filter(e => S.lab[e.key]), mender = this.val('mender');
    const best = known.reduce((most, e) => Math.max(most, labLevel(S.lab[e.key])), 0);
    return [
      ['REACH', `${this.val('tether')} CELLS`],
      ['BIT', `MK${this.val('drill')}`],
      ['SPEED', `x${this.val('momentum')}`],
      ['WINCH', `x${this.val('winch')}`],
      ['SCAN', `${this.val('scanner')} CELLS`],
      ['HULL', `${this.hull}/${this.val('hull')} PIPS`],
      ['MENDS', `1 PIP / ${mender} S`, this.S.lv.mender > 0],
      ['LAVA', this.swims ? 'SWIMS IN IT' : 'BURNS', this.swims],
      ['SPORES', this.val('sporedrive') ? `SPEED x${BOOST.by}` : 'KNOCK', this.val('sporedrive') > 0],
      ['ARCS', this.val('arccoil') ? 'MEND A PIP' : 'KNOCK', this.val('arccoil') > 0],
      ['HAUL PAY', `+${parts * 10}% (${parts}/8 PARTS)`, parts > 0],
      ['FURTHEST OUT', `${Math.floor(S.out ?? 0)} CELLS`],
      ['PLACES MET', `${Object.keys(S.met).length}`],
      ['REFINERY', `GRIT x${this.val('refinery')}, GEMS x${this.val('cutter')}`, S.lv.refinery + S.lv.cutter > 0],
      ['LAMP', `${this.val('lamp')} CELLS`, S.lv.lamp > 0],
      ['BLACK BOX', this.val('blackbox') ? `KEEPS ${Math.round(this.val('blackbox') * 100)}%` : 'NONE', S.lv.blackbox > 0],
      ['ANALYSED', known.length ? `${known.length}/${LAB.length}, UP TO +${best}%` : `0/${LAB.length}`, known.length > 0],
      ['SPECIMENS', [1, 2, 3, 4].map(k => this.specs(k)).join(' / ')],
      ['MAP', `${Math.round(this.val('maprange') * 46)} CELLS, ${MAPS[1].show(this.val('maplens'))}`, this.S.lv.maprange + this.S.lv.maplens > 0],
      ['FINDER', this.val('mapfinder') ? `${['', 'CACHES', '+GEODES', 'ALL'][this.val('mapfinder')]}, ${FINDER[this.val('mapfinder')]} CELLS` : 'NONE', this.val('mapfinder') > 0],
      ['CHART', this.val('chart') ? 'YES' : 'NONE', this.val('chart') > 0],
    ];
  }
  // The menu: the sound, and a new world (two taps, so a slip of the thumb does not cost a world).
  drawMenu(px, y0, pw) {
    const { ctx } = this, sure = this.confirmReset > 0;
    slice9(ctx, 'ui', 'button', px + 6, y0 + 4, pw - 12, 20);
    text(ctx, 'SOUND', px + 14, y0 + 10, '#ffffff');
    text(ctx, isMuted() ? 'OFF' : 'ON', px + pw - 14, y0 + 10, isMuted() ? '#ff7a5a' : '#8cf2c4', 1);
    this.buttons.unshift({ x: px + 6, y: y0 + 4, w: pw - 12, h: 20, act: () => { setMuted(!isMuted()); sfx.tap(); } });
    slice9(ctx, 'ui', sure ? 'button-off' : 'button', px + 6, y0 + 28, pw - 12, 20);
    text(ctx, sure ? 'TAP AGAIN: NEW WORLD' : 'NEW WORLD', px + pw / 2, y0 + 34, sure ? '#ff7a5a' : '#ffffff', 0.5);
    this.buttons.unshift({ x: px + 6, y: y0 + 28, w: pw - 12, h: 20, act: () => {
      if (this.confirmReset > 0) { this.confirmReset = 0; this.fresh((Math.random() * 1e9) | 0); this.save(); sfx.relic(); } else { this.confirmReset = 2.5; sfx.tap(); }
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
  drawStats(px, y0, pw) {
    const { ctx } = this;
    this.stats().forEach(([name, value, lit], n) => {
      const y = y0 + 2 + n * 11;
      if (n % 2 === 0) { ctx.fillStyle = '#241f38'; ctx.fillRect(px + 4, y - 1, pw - 8, 11); }
      text(ctx, name, px + 8, y, '#bcb4cc');
      text(ctx, value, px + pw - 8, y, lit === undefined ? '#ffffff' : lit ? '#8cf2c4' : '#8a84a0', 1);
    });
  }
  // The lab's notes: everything it can know, a line each (what is not yet analysed is only a question mark), and
  // under the list what it has to say of the line that was tapped. Where the list is longer than the screen it is
  // turned a page at a time.
  drawLab() {
    const { ctx, W, H, S } = this, RH = 13, HEAD = 20, NOTE = 48;
    ctx.globalAlpha = 0.6 * this.labRise; ctx.fillStyle = '#07060b'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    const pw = Math.min(W - 8, 200), px = Math.round((W - pw) / 2);
    const room = H - 48 - HEAD - NOTE - 4, paged = Math.floor(room / RH) < LAB.length, rows = paged ? Math.max(3, Math.floor((room - 14) / RH)) : LAB.length, pages = Math.ceil(LAB.length / rows);
    const sel = LAB_OF[this.labSel] ?? LAB[0];
    if (this.labPage < 0 || this.labPage >= pages) this.labPage = Math.floor(LAB.indexOf(sel) / rows);
    if (this.labTab === 'chart' && !this.charted) this.labTab = 'stats';
    const chart = Math.min(pw - 12, H - 52 - HEAD - 10);
    const rise = 1 - this.labRise, ph = this.labTab === 'menu' ? HEAD + 56 + (this.stalls.length ? 14 + this.stalls.length * 10 : 0) : this.labTab === 'chart' ? HEAD + chart + 10 : this.labTab === 'stats' ? HEAD + this.stats().length * 11 + 8 : HEAD + rows * RH + NOTE + (paged ? 14 : 0) + 4, py = Math.max(2, Math.round((H - 44 - ph) / 2)) + Math.round(rise * rise * 60);
    slice9(ctx, 'ui', 'panel', px, py, pw, ph);
    this.button(px, py, pw, ph, () => {});
    this.buttons.at(-1).swallow = true;
    this.chartRect = null;
    this.panelTabs(px, py, pw, HEAD);
    if (this.labTab === 'stats') { this.drawStats(px, py + HEAD, pw); return; }
    if (this.labTab === 'menu') { this.drawMenu(px, py + HEAD, pw); if (this.stalls.length) this.drawStalls(px, py + HEAD + 54, pw); return; }
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
    LAB.slice(this.labPage * rows, this.labPage * rows + rows).forEach((e, r) => {
      const y = py + HEAD + r * RH, n = S.lab[e.key] ?? 0, on = e === sel;
      if (on) { ctx.fillStyle = '#3a3260'; ctx.fillRect(px + 4, y, pw - 8, RH - 1); }
      if (n) {
        const [sheet, frame] = e.key.split(':'), f = sheets[sheet].frames[frame];
        ctx.drawImage(sheets[sheet].image, f[0] + 2, f[1] + 2, 12, 12, px + 6, y, 12, 12);
        text(ctx, e.name, px + 22, y + 2, on ? '#ffe14a' : '#ffffff');
        text(ctx, `+${labLevel(n)}%`, px + pw - 8, y + 2, '#8cf2c4', 1);
      } else {
        text(ctx, '?', px + 10, y + 2, '#6a6478');
        text(ctx, '? ? ?', px + 22, y + 2, on ? '#bcb4cc' : '#6a6478');
      }
      this.buttons.unshift({ x: px + 4, y, w: pw - 8, h: RH, act: () => { this.labSel = e.key; sfx.tap(); } });
    });
    // What the lab says of the line chosen.
    const ny = py + HEAD + rows * RH + 3, n = S.lab[sel.key] ?? 0;
    ctx.fillStyle = '#4a4468'; ctx.fillRect(px + 6, ny - 2, pw - 12, 1);
    if (n) {
      text(ctx, `${compact(n)} SAMPLES. NEXT +1% AT ${compact(labNext(n))}`, px + 8, ny + 1, '#bfe6ff');
      wrap(sel.note, pw - 16).slice(0, 3).forEach((line, l) => text(ctx, line, px + 8, ny + 12 + l * 10, '#d8d0c0'));
    } else {
      text(ctx, 'NOT ANALYSED YET', px + 8, ny + 1, '#bcb4cc');
      wrap(`CUT THROUGH ONE WITH THE BIT. FOUND: ${sel.where}.`, pw - 16).slice(0, 3).forEach((line, l) => text(ctx, line, px + 8, ny + 12 + l * 10, '#9a94a8'));
    }
    if (paged) {
      const fy = py + ph - 16;
      text(ctx, `< ${this.labPage + 1}/${pages} >`, px + pw / 2, fy + 2, '#bfe6ff', 0.5);
      this.buttons.unshift({ x: px + 4, y: fy - 2, w: pw / 2 - 4, h: 16, act: () => { this.labPage = (this.labPage + pages - 1) % pages; sfx.tap(); } });
      this.buttons.unshift({ x: px + pw / 2, y: fy - 2, w: pw / 2 - 4, h: 16, act: () => { this.labPage = (this.labPage + 1) % pages; sfx.tap(); } });
    }
  }
  drawShop() {
    const { ctx, W, H, S } = this;
    ctx.globalAlpha = 0.6 * this.shopRise; ctx.fillStyle = '#07060b'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    // (The panel is as tall as its longest tab, so it does not jump when the tab is changed.)
    const most = Math.max(...TABS.map(t => t.rows.length)), tab = TABS.find(t => t.id === this.shopTab) ?? TABS[0];
    const pw = Math.min(W - 8, 200), px = Math.round((W - pw) / 2), rh = Math.max(24, Math.min(32, Math.floor((H - 100) / most)));
    const rise = 1 - this.shopRise, ph = 22 + rh * most + 22, py = Math.max(2, Math.round((H - 44 - ph) / 2)) + Math.round(rise * rise * 60);
    slice9(ctx, 'ui', 'panel', px, py, pw, ph);
    this.button(px, py, pw, ph, () => {});
    // The tabs: the one that is open in yellow, and a dot on one that has something to buy.
    let tx = px + 8;
    for (const t of TABS) {
      const tw = textWidth(t.name), id = t.id;
      text(ctx, t.name, tx, py + 7, t === tab ? '#ffe14a' : '#8a84a0');
      if (t === tab) { ctx.fillStyle = '#ffe14a'; ctx.fillRect(tx, py + 17, tw, 1); }
      if (t.rows.some(u => this.canBuy(u))) { ctx.fillStyle = '#8ce060'; ctx.fillRect(tx + tw + 2, py + 6, 2, 2); }
      this.buttons.unshift({ x: tx - 4, y: py, w: tw + 10, h: 20, act: () => { this.shopTab = id; sfx.tap(); } });
      tx += tw + 9;
    }
    text(ctx, 'x', px + pw - 12, py + 6, '#ffffff');
    this.buttons.unshift({ x: px + pw - 24, y: py, w: 24, h: 22, act: () => { this.shop = false; sfx.tap(); } });
    tab.rows.forEach((u, n) => {
      const y = py + 20 + n * rh, c = this.cost(u), can = this.canBuy(u), lit = this.bought?.id === u.id;
      slice9(ctx, 'ui', lit ? 'button-down' : !c ? 'button-max' : can ? 'button' : 'button-off', px + 4, y, pw - 8, rh - 1);
      // What it will look like once bought (or does now, at its last level).
      const l = S.lv[u.id], next = Math.min(l + 1, u.values.length - 1), vx = px + 7, vy = y + Math.floor((rh - 17) / 2);
      ctx.fillStyle = '#0c0a12'; ctx.fillRect(vx, vy, 16, 16);
      if (u.id === 'drill') this.drawDrill(vx + 8, vy + 8, 0, next, S.lv.momentum, this.time * 1000);
      else if (u.id === 'momentum') this.drawDrill(vx + 8, vy + 8, 0, S.lv.drill, next, -1);
      else if (u.id === 'tether') { for (const pass of TETHERS[next].thick ? [1, 0] : [0]) this.drawSpan(vx + 1, vy + 12 + pass, vx + 14, vy + 3 + pass, TETHERS[next]); }
      else if (u.id === 'winch') drawScaled(ctx, 'core', `core-a-${next}`, vx, vy, 16, 16);
      else if (u.id === 'scanner') draw(ctx, 'dish', `dish-${next}`, vx, vy);
      else if (u.id === 'hull') this.drawDrill(vx + 8, vy + 8, 0, S.lv.drill, S.lv.momentum, -1, 1, 1, ctx, next);
      else if (u.kin !== undefined && u.spec) this.drawDrill(vx + 8, vy + 8, 0, S.lv.drill, S.lv.momentum, -1, 1, 1, ctx, S.lv.hull, u.id);
      else if (MAPS.includes(u)) draw(ctx, 'upgrades', u.icon, vx + 2, vy + 2);
      else if (u.pic) draw(ctx, 'icons', u.pic, vx + 3, vy + 3);
      else { draw(ctx, 'upgrades', u.icon, vx + 2, vy + 2); text(ctx, `${u.values[next]}`, vx + 15, vy + 7, '#ffffff', 1); }
      // What it is, what it does, and what the next level changes.
      text(ctx, u.name, px + 25, y + 2, '#ffffff');
      // (A thing fitted once has no levels to show: it is FITTED or it is not.)
      const once = u.values.length === 2, steps = once ? (c ? '' : 'FITTED') : c ? `${u.show(u.values[l])}>${u.show(u.values[l + 1])}` : `${u.show(u.values[l])} MAX`;
      text(ctx, steps, px + 31 + textWidth(u.name), y + 2, c ? '#bfe6ff' : '#ffe14a');
      const lack = c ? this.lacks(u) : null;
      // What must be found first is said on the second line, and no price is shown until it has been.
      // (A row tall enough for three lines keeps what the thing does on its second, whatever is on the third.)
      const tall = rh >= 30;
      if (lack) { if (tall) text(ctx, u.what, px + 25, y + 11, '#c8c2d4'); text(ctx, lack, px + 25, y + rh - (tall ? 11 : 12), '#ff9a6a'); }
      else if (c) {
        // The cost sits on the second line when the first is full. It is lit by what has come home (`banked`), as
        // the purchase itself is judged: never shown as enough while the tap would be refused.
        let cx = px + pw - 18;
        const have = c.spec ? this.specs(u.kin) : 0, asks = c.spec ? `${have}/${c.spec}` : '';
        const wide = textWidth(u.name) + textWidth(steps) + textWidth(compact(c.grit)) + (c.gems ? textWidth(compact(c.gems)) + 16 : 0) + (c.spec ? textWidth(asks) + 16 : 0) > pw - 80, cy = wide ? y + rh - (tall ? 11 : 12) : y + 2;
        draw(ctx, 'icons', 'grit', cx, cy - 1);
        text(ctx, compact(c.grit), cx - 2, cy, this.banked() >= c.grit ? '#ffe14a' : '#ff7a5a', 1);
        if (c.gems > 0) {
          cx -= textWidth(compact(c.grit)) + 16;
          draw(ctx, 'icons', GEM_ICON[u.gem], cx, cy - 1);
          text(ctx, compact(c.gems), cx - 2, cy, this.banked(u.gem) >= c.gems ? GEM_COLOR[u.gem] : '#ff7a5a', 1);
        }
        // Specimens: how many are in hand of how many are asked, with the direction's own stone.
        if (c.spec > 0) {
          cx -= textWidth(compact(c.grit)) + 16;
          draw(ctx, 'icons', `spec-${GEM_ICON[u.kin]}`, cx, cy - 1);
          text(ctx, asks, cx - 2, cy, have >= c.spec ? GEM_COLOR[u.kin] : '#ff7a5a', 1);
        }
        const short = c.gems > 0 && this.banked(u.gem) < c.gems;
        if (!wide || tall) text(ctx, short ? `${GEM_WHERE[u.gem]}, PAST ${HOME_R}` : u.what, px + 25, wide ? y + 11 : y + rh - 12, short ? GEM_COLOR[u.gem] : '#c8c2d4');
      } else text(ctx, u.what, px + 25, y + rh - 12, '#e8c070');
      this.buttons.unshift({ x: px + 4, y, w: pw - 8, h: rh - 1, act: () => this.buy(u) });
    });
    const fy = py + ph - 19;
    // Why a tap was refused is said on the footer's line: the header is the tabs'. (A new world is in the menu.)
    const note = this.shopNote && this.shopNote.t > 0 ? this.shopNote : null;
    if (note) note.t -= 1 / 60;
    if (note) text(ctx, note.text, px + pw / 2, fy + 4, note.color, 0.5);
  }
}
