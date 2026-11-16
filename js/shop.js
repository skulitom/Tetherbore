// Tetherbore: the economy and the shop. What everything costs, worked out from one model of how fast a player
// earns, and the rows of the shop's four tabs that are bought with it; and what the lab can know. Nothing here
// needs the game, a canvas or a sound, so a tool may ask the prices and the reaches of this alone. (A name in the
// notes below that is not made here is the game's: `reelIfRound` or BOOST in js/game.js, `findsNear` or LENS in
// js/drawing.js, which draws it.)
import { B } from './world.js';

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
// (The first reaches were 12, 22, 40, 72 and 130 cells: a new game met the end of its tether within three seconds
// of leaving the core, half a screen out, and at every turn for its first hour. They begin at 40 now, each about
// six tenths more than the last, to the same 2,300; a level still costs so many minutes of what its reach earns.)
export const REACH = [40, 64, 100, 160, 250, 400, 620, 950, 1500, 2300];
const PACE = 0.9, WORTH = 1.6;                  // cells cut a second, turning and flying counted in; grit in an average cell
const GEM_REACH = 5;                            // the level of reach (230) from which upgrades may ask for gems
export const richness = r => Math.max(1, r / 12);
export const haulBonus = (n, winch = 1) => 1 + winch * Math.log2(Math.max(1, n)) / 8;
// The winch draws in so many cells at full pay. A piece beyond that pays as its load does and a little more for
// every doubling of its size past the load (the load times 1 + ln(n / load)), never less in all, in grit and in
// gems alike: so the biggest loop a player can cut is a little better than one of the winch's load, and not many
// times better. (It was (load / n) ** 0.35 a cell, and on grit alone: a tunnel that cut a whole quarter of the
// ground off paid for half the shop in one haul, and its gems were not thinned at all.)
export const WINCH_LOAD = [150, 400, 1000, 2300, 5000, 12000, 25000, 50000, 100000];
// It draws in whatever the tether is round, however much: over its load a haul pays less a cell. (It drew in no
// more than forty times its load at once, and a piece larger than that stayed where it hung: a game had cut one
// tunnel round the whole of a reach of 230 and been paid six thousand for a hundred and sixty thousand cells. But a
// loop round half the longest reach is the biggest thing a game can do, and it was refused at every reach.)
export const overload = (n, level) => n <= WINCH_LOAD[level] ? 1 : WINCH_LOAD[level] * (1 + Math.log(n / WINCH_LOAD[level])) / n;
export const income = R => { const side = Math.max(4, Math.min(48, R / 3)); return side * PACE / 4 * WORTH * richness(R * 0.7) * haulBonus(side * side); };
export const round2 = n => { const unit = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1); return Math.round(n / unit) * unit; };
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
export const NEEDS = { parts: 'WRECK PARTS', kinds: 'KINDS ANALYSED', places: 'PLACES MET', out: 'CELLS OUT', relics: 'RELICS HOME' };
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
  { id: 'hull', icon: 'hull', name: 'HULL', what: 'TAKES MORE KNOCKS', values: [5, 6, 7, 8, 9], gem: B.EMBER, needs: ['out', [150, 300, 600, 1000]], ...levels([3.5, 4.5, 5.5, 6.5], 0.5), show: v => `${v}` },
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
  { key: 'minerals:starglass', name: 'STARGLASS', where: 'GLAZE, FAR NORTH', note: 'A STAR OF CLEAR ICE THAT NEVER MELTS. ONE TO A PANE, AND THE PANE BREAKS AT A TOUCH.' },
  { key: 'minerals:opal', name: 'FIRE OPAL', where: 'TINDERWORKS, FAR SOUTH', note: 'A COAL THAT TURNED TO GEM INSIDE A RING OF FUSE. BURN THE FUSE AND IT FALLS OUT.' },
  { key: 'minerals:lantern', name: 'LANTERN CAP', where: 'GROTTOS, FAR WEST', note: 'A MUSHROOM THAT LIGHTS WHEN SOMETHING FLIES BY. ONLY A LIT ONE IS WORTH THE HAUL.' },
  { key: 'minerals:agate', name: 'AGATE', where: 'SHALE STACKS, FAR EAST', note: 'BANDED RED STONE, A LAYER A YEAR. IT LIES ALONG THE GRAIN OF THE SHALE.' },
];
export const LAB_OF = Object.fromEntries(LAB.map(e => [e.key, e]));
// The levels a count of samples has earned (0 for none; 1 for the first; one more at 2, 4, 8 ...), and the count
// the next level comes at.
export const labLevel = n => { let l = 0; while (n >> l) l++; return l; };
export const labNext = n => 2 ** labLevel(n);
// The shop's second tab, WORKS: what is fitted to the drill for the rare things found in pockets. Each row is paid
// for in grit and in the specimens of one direction (`kin`; `spec`, how many each level asks), which only that
// direction's pockets give. A row of two values is fitted once; MENDER has levels.
//   MENDER      the hull mends itself, a pip back every so many seconds since the last knock (the value): every
//               twenty with no mender fitted, so a drill that gets clear of trouble recovers, and faster with one
//   LAVA SKIN   lava neither knocks the hull nor stops the drill: it flies through it
//   SPORE DRIVE a spore pod's burst does not knock: it drives the drill half as fast again for BOOST seconds
//   ARC COIL    a crystal's arc does not knock: it mends a pip
//   DIAMOND TIP metal (steel, and the iron of keystones) cuts as fast as its kind says (js/world.js: DIG_TIME);
//               without it, METAL times as slow (js/game.js). Paid in the north's specimens, as starglass is its
//               mineral: a clear crystal hard enough to cut iron.
const works = (beside, share, spec) => ({ beside, grit: beside.map(at => priced(at, share)), gems: beside.map(() => 0), spec });
export const WORKS = [
  { id: 'mender', name: 'MENDER', what: 'HULL MENDS FASTER', values: [20, 14, 9, 5], kin: B.FROST, gem: B.FROST, ...works([5, 6, 7], 0.4, [8, 16, 30]), show: v => `${v}S` },
  { id: 'lavaskin', name: 'LAVA SKIN', what: 'SWIMS IN LAVA', values: [0, 1], kin: B.EMBER, gem: B.EMBER, ...works([5.5], 0.4, [12]), show: v => v ? 'ON' : 'OFF' },
  { id: 'sporedrive', name: 'SPORE DRIVE', what: 'SPORES SPEED IT UP', values: [0, 1], kin: B.MIRE, gem: B.MIRE, ...works([5.5], 0.4, [12]), show: v => v ? 'ON' : 'OFF' },
  { id: 'arccoil', name: 'ARC COIL', what: 'ARCS MEND THE HULL', values: [0, 1], kin: B.LODE, gem: B.LODE, ...works([5.5], 0.4, [12]), show: v => v ? 'ON' : 'OFF' },
  { id: 'diamond', name: 'DIAMOND TIP', what: 'CUTS METAL FAST', values: [0, 1], kin: B.FROST, gem: B.FROST, ...works([4.5], 0.4, [10]), show: v => v ? 'ON' : 'OFF' },
];
// The shop's third tab, MAP: what the map in the corner shows.
//   RANGE    how many cells of ground a pixel of the map is, so how far it shows: 69 cells across at first
//   LENS     what the map tells apart from plain rock, in colours of their own: ore; then hard ground and hazards;
//            then minerals, caches and whatever else was laid to be found (js/drawing.js: `LENS`)
//   FINDER   finds not yet seen are marked on the map: caches; then geodes; then prisms (js/drawing.js: `findsNear`)
//   CHART    a map of the whole of the tether's reach (a tap on the map; the third tab of the top bar's panel)
export const MAPS = [
  { id: 'maprange', icon: 'scanner', name: 'RANGE', what: 'MAP SHOWS FURTHER', values: [1.5, 2.25, 3.5, 5], gem: B.FROST, ...levels([2, 4, 6], 0.25), show: v => `${Math.round(v * 46)}` },
  { id: 'maplens', icon: 'scanner', name: 'LENS', what: 'MAP TELLS MORE APART', values: [0, 1, 2, 3], gem: B.LODE, ...levels([1.5, 3.5, 5.5], 0.25), show: v => ['ROCK', 'ORE', 'HARD', 'ALL'][v] },
  { id: 'mapfinder', icon: 'scanner', name: 'FINDER', what: 'MARKS FINDS NEAR THE DRILL', values: [0, 1, 2, 3], gem: B.MIRE, ...levels([2.5, 4.5, 6.5], 0.25), show: v => ['OFF', 'CACHE', 'GEODE', 'PRISM'][v] },
  { id: 'chart', icon: 'scanner', name: 'CHART', what: 'MAP OF THE WHOLE REACH', values: [0, 1], gem: B.EMBER, ...levels([3], 0.3), show: v => v ? 'ON' : 'OFF' },
];
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
export const ROWS = [...UPGRADES, ...WORKS, ...MAPS, ...CORE];
// The late game: levels past the ones above, for the two thirds of the ground that lie beyond them. Everything
// above is bought, at 85 million grit in all, by a drill that has been a thousand cells out along one road, while
// the relics lie two thousand out in each of four directions: a game had the whole shop at its last levels, and
// 64 million grit over, with a twentieth of the ground inside its reach explored. Each row here is the levels
// added to a row above: [what the level gives, grit, gems, what must have been found (as `needs`: a count of the
// row's own kind, or [kind, count]), specimens]. They cost from ten million to three hundred million grit, 2.4
// thousand million in all, and gems by the thousand of the direction each row takes them from; and they ask that
// the drill has been further out than any level above asks (900 to 1,800 cells), that the far wrecks' parts have
// come home (the last lie 1,200 and 1,700 out), and, the station's last, that relics have. (No level of reach: the
// tether already goes past the relics.) The drill and the core are drawn as at the last level above.
const LATE = {
  drill: [[6, 25e6, 4000, 900], [7, 80e6, 10000, 1300], [8, 250e6, 25000, 1700]],
  winch: [[3.5, 25e6, 5000, 1000], [4, 80e6, 12000, 1400], [5, 250e6, 30000, 1800]],
  scanner: [[11, 20e6, 3000, 6], [13, 70e6, 8000, 8]],
  momentum: [[2.5, 30e6, 5000, 1100], [2.8, 100e6, 14000, 1500]],
  hull: [[10, 25e6, 3000, 1200], [11, 80e6, 8000, 1500], [12, 250e6, 20000, 1800]],
  mender: [[3, 30e6, 0, 0, 60], [2, 100e6, 0, 0, 120]],
  maprange: [[7, 10e6, 2000, ['out', 1000]], [10, 40e6, 6000, ['out', 1600]]],
  refinery: [[2.5, 80e6, 30000, ['relics', 1]], [3, 300e6, 45000, ['relics', 2]]],
  cutter: [[2.5, 60e6, 22000, ['out', 1500]], [3, 220e6, 35000, ['relics', 1]]],
  lamp: [[16, 30e6, 10000, 7], [18, 90e6, 25000, 8]],
  blackbox: [[0.9, 50e6, 15000, ['out', 1600]]],
};
for (const u of ROWS) for (const [value, grit, gems, need, spec] of LATE[u.id] ?? []) {
  // (A row that asked for nothing asks nothing for the levels it had.)
  if (need && !u.needs) u.needs = ['out', u.grit.map(() => 0)];
  u.values.push(value); u.grit.push(grit); u.gems.push(gems);
  if (u.needs) u.needs[1].push(need);
  if (u.spec) u.spec.push(spec);
}
export const TABS = [{ id: 'rig', name: 'RIG', rows: UPGRADES }, { id: 'works', name: 'WORKS', rows: WORKS }, { id: 'map', name: 'MAP', rows: MAPS }, { id: 'core', name: 'CORE', rows: CORE }];
