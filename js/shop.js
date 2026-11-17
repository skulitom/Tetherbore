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
// ground (45, 90, 160 ... cells out); 'kinds', kinds of thing the lab has analysed, of the forty-eight of `LAB`:
// near the core the ores of the home ground and of the four directions' own, the hazards of the south, the west and
// the east (the north has none so near), keystone iron where a slab lies on the road (the first is 52 cells out, in
// one direction only) and the minerals of the nearer pockets, with steel wherever lava has been woken onto slag;
// the strains' ores and the far pockets' minerals beyond, the rare hazards from 450 cells and the deep flanks' ores
// from about 800 (900, give or take the hundred their edge wanders); 'places', grounds met, of which the strains,
// the pockets and the crosses lie further and further out.
// (`Game.need` counts what is held.)
// 'out' is how far from the core the drill has ever been, in cells, by any road and in any direction: the levels
// of the first tab ask it, so the rig cannot be bought up from the ground about the core. (Kinds analysed and
// places met were asked first, and both are to be had within two hundred cells: a game had the bit and the ram at
// their last levels and a reach of 1,350 with nothing explored past a tenth of it.)
// 'beasts' is how many kinds of creature have been met (js/fauna.js, fourteen in all), which only TROPHY LINE asks:
// a line for foes is bought by a pilot who has met them.
export const NEEDS = { parts: 'WRECK PARTS', kinds: 'KINDS ANALYSED', places: 'PLACES MET', out: 'CELLS OUT', relics: 'RELICS HOME', beasts: 'BEASTS MET' };
// How much faster each level of the bit cuts than the first (js/game.js: `cutTime`, which divides by it; it is the
// game's SPEED). It is here, beside the bit's row, so that the row can say what its next level does.
export const CUT = [1, 1.6, 2.4, 3.6, 5, 6.5, 8.5, 11];
// `values` is what each level gives; `grit` and `gems` what the next level costs; `gem` whose gems it takes;
// `says(l)`, where a row has it, what the step from level l to the next changes, in a few words (21 characters at
// the most, the narrowest phone's line), and where it says nothing the shop says `what`.
export const UPGRADES = [
  // The tether's reach: how far from the core the drill may go, by any road. Each level is about six tenths more. It is
  // bought with grit alone, which every ground gives: no one direction's gems and nothing that must be found in
  // one place, so a player may follow a single direction as far out as they like. From the third level it asks that
  // the drill has been three fifths of the way out its tether already goes, in whatever direction.
  { id: 'tether', icon: 'string', name: 'REACH', what: 'TETHER GOES FURTHER', values: REACH, gem: B.MIRE, needs: ['out', REACH.slice(0, -1).map((R, l) => l < 2 ? 0 : Math.round(R * 0.6))], ...levels(REACH.slice(0, -1).map((R, l) => l), 1), gems: REACH.slice(0, -1).map(() => 0), show: v => `${v}` },
  // The bit: its first four steps cut so many times faster (CUT); its late three (MK6 to MK8) are its plough, the
  // drill keeping its run through ground they cut in a blink, softer ground first, as a cut can take no less than
  // a frame and the run was lost at every cell.
  // (Each level of the bit and of the winch is a thing of its own, drawn so and named so when it is fitted and in
  // STATS: `tiers`, a name a level, art/sprites.mjs: BIT_SHAPES and WINCHES; and so is each of the ram and the hull,
  // RAM_HALVES and PLATES.)
  { id: 'drill', icon: 'drill', name: 'BIT', tiers: ['STEEL', 'BRONZE', 'COBALT', 'GOLD', 'DIAMOND', 'VOID', 'EMBER', 'STAR'], what: 'CUTS FASTER', values: [1, 2, 3, 4, 5], gem: B.LODE, needs: ['out', [0, 40, 130, 400]], ...levels([0.6, 2.2, 4.4, 6.6], 0.6), show: v => `MK${v}`,
    says: l => l < 4 ? `CUTS x${(CUT[l + 1] / CUT[l]).toFixed(1)} FASTER` : ['PLOUGHS SOFT ROCK', 'PLOUGHS DENSE ROCK', 'PLOUGHS SLATE TOO'][l - 4] },
  // The winch: the bonus a haul is paid for its size, and the load it draws in at full pay (WINCH_LOAD), which is
  // most of what a level does. It takes the west's gems, which have least else to buy.
  { id: 'winch', icon: 'winch', name: 'WINCH', tiers: ['IRON', 'STEEL', 'GEARED', 'FROST', 'CRYSTAL', 'MAGMA', 'STORM', 'GRAVITY', 'SINGULARITY'], what: 'BIGGER LOADS', values: [1, 1.3, 1.6, 2, 2.5, 3], gem: B.MIRE, needs: ['out', [0, 30, 100, 300, 700]], ...levels([0.8, 2, 3.6, 5.4, 7.2], 0.5), show: v => `x${v}`,
    says: l => `LOAD ${WINCH_LOAD[l]}>${WINCH_LOAD[l + 1]}` },
  { id: 'scanner', icon: 'scanner', name: 'SCAN', what: 'SEES DEEPER IN ROCK', values: [3, 4, 5, 7, 9], gem: B.FROST, needs: ['parts', [0, 1, 2, 4]], ...levels([0.4, 1.6, 3.4, 5.8], 0.3), show: v => `${v}` },
  // The ram takes the south's gems, as the hull does: the two are the pilot's way through the worst of the ground.
  // Its levels, and the hull's, ask no more than eight tenths of how far the reach they are priced beside goes
  // (the reach after the step of `beside`, rounded up), so that each opens as that reach is flown and not in the
  // same minute as the next reach.
  { id: 'momentum', icon: 'momentum', name: 'RAM', tiers: ['BARE', 'RUNNER', 'FINNED', 'THRUSTER', 'TWIN JET', 'AFTERBURNER', 'COMET'], what: 'FLIES FASTER', values: [1, 1.25, 1.5, 1.8, 2.2], gem: B.EMBER, needs: ['out', [0, 60, 200, 500]], ...levels([0.7, 2.4, 4.2, 6.2], 0.4), show: v => `x${v}` },
  // The hull: how many knocks the drill takes before it is wrecked and wound home (`hit`, `wreck`), a pip a level,
  // each a plate more on the drill. Its first level is priced beside a reach that has only just met hazards and
  // asks no gems; from there on it takes the south's, whose lava is the worst of what it is for. (Its third and
  // fourth levels asked 600 and 1,000 cells out, all of a reach of 620 and more than one of 950: they were bought
  // in the same minute as the reach after, on every world. And its second asked 300, as the winch's fourth does.)
  // A distance of its own does not keep a level from being bought on the same trip home as another a few dozen
  // cells off, for one trip out crosses both: the hull's 440 is often bought with the bit's 400, its 660 with the
  // winch's 700, the ram's 500 with the eighth reach's 570, and the hull's 280 still with the winch's 300. What it
  // keeps is a level from waiting on the reach after the one it is priced beside.
  { id: 'hull', icon: 'hull', name: 'HULL', tiers: ['BARE', 'BANDED', 'TWIN BAND', 'FRAMED', 'COPPER', 'COBALT', 'GILDED', 'AEGIS'], what: 'TAKES MORE KNOCKS', values: [5, 6, 7, 8, 9], gem: B.EMBER, needs: ['out', [150, 280, 440, 660]], ...levels([3.5, 4.5, 5.5, 6.5], 0.5), show: v => `${v}` },
];
// What the lab can know: each thing the bit can crush, by the sheet and frame it is drawn from (`Game.sampleOf`),
// with its name, where it lies (`where`, for its note, and `at`, a few words for its line in the list), whose part of
// the list it is in (`kin`: 0 the home ground and what lies all round, then the four directions), and the lab's
// note on it. A thing crushed is a sample analysed, and what is known of a thing makes every one of it hauled worth
// more: a hundredth more for the first sample, and a hundredth more each time the count of samples doubles
// (`labLevel`). So the first few samples teach the most, and crushing ore for its own sake soon stops paying.
// There are forty-eight things: the two ores of the home ground and of each of the sixteen grounds the four
// directions are made of (each one's own, its two strains and its deep flank; the east's own shares the home
// ground's), steel, keystone iron, the seven pocket minerals and the seven hazards, the three that every
// direction's ground has and the four rare ones, which are sampled as the bit goes into them and go off as ever.
// (A prism pays nothing itself, so there is nothing of it to learn. A rare hazard is in the list to be counted:
// crushing one forfeits its lump, and there are too few in a world for its own hundredths to come to much.)
// Within a part of the list, a direction's own two ores come first and then the rest from near to far.
export const LAB = [
  // Home and all round.
  { kin: 0, key: 'lode-items:oreA', name: 'COPPER', at: 'HOME AND EAST', where: 'HOME GROUND AND EAST', note: 'SOFT RED METAL WITH A GREEN BLOOM. THE FIRST THING A NEW BIT LEARNS THE TASTE OF.' },
  { kin: 0, key: 'lode-items:oreB', name: 'VIOLET QUARTZ', at: 'HOME AND EAST', where: 'HOME GROUND AND EAST', note: 'A CRYSTAL THAT HOLDS A CHARGE. IT HUMS WHEN A SPARK VEIN IS NEAR.' },
  { kin: 0, key: 'finds:key', name: 'KEYSTONE IRON', at: 'KEYSTONE SLABS', where: 'THE KEYS OF KEYSTONE SLABS, EVERYWHERE', note: 'IRON STAPLES SET ACROSS THE CRACKS BY NOBODY. IT HAS NOT RUSTED, AND IT IS NOT FROM HERE.' },
  { kin: 0, key: 'minerals:aerolite', name: 'AEROLITE', at: 'PUMICE DRIFTS', where: 'PUMICE DRIFTS', note: 'A STAR THAT FELL INTO PUMICE AND STAYED. LIGHT ENOUGH TO FLOAT.' },
  // North.
  { kin: 1, key: 'frost-items:oreA', name: 'RIME SALT', at: 'FROST', where: 'FROST, NORTH', note: 'BLUE SALT FROZEN SQUARE. IT KEEPS ITS COLD FOR A HUNDRED YEARS.' },
  { kin: 1, key: 'frost-items:oreB', name: 'AURORA SPAR', at: 'FROST', where: 'FROST, NORTH', note: 'PINK AND GREEN NEEDLES, GROWN IN THE DARK UNDER THE ICE.' },
  { kin: 1, key: 'ores:firnA', name: 'SAPPHIRE', at: 'FIRN', where: 'FIRN, NORTH', note: 'BLUE STONES PRESSED OUT OF THE SNOW BY A THOUSAND WINTERS. THE FIRN IS STILL PRESSING.' },
  { kin: 1, key: 'ores:firnB', name: 'ENHYDRO', at: 'FIRN', where: 'FIRN, NORTH', note: 'A YELLOW CRYSTAL WITH WATER SHUT INSIDE, OLDER THAN THE ICE. TIP IT AND THE BUBBLE MOVES.' },
  { kin: 1, key: 'ores:seracA', name: 'SHARD SILVER', at: 'SERAC', where: 'SERAC, NORTH', note: 'SILVER SPLIT INTO BLADES ALONG THE LANES OF ICE. THE PIECES CHIME WHEN THEY FALL.' },
  { kin: 1, key: 'ores:seracB', name: 'FLUORITE', at: 'SERAC', where: 'SERAC, NORTH', note: 'GLASSY CUBES OF VIOLET. UNDER THE LAMP THEY GLOW A COLOUR THEY ARE NOT.' },
  { kin: 1, key: 'minerals:starglass', name: 'STARGLASS', at: 'GLAZE', where: 'GLAZE, FAR NORTH', note: 'A STAR OF CLEAR ICE THAT NEVER MELTS. ONE TO A PANE, AND THE PANE BREAKS AT A TOUCH.' },
  { kin: 1, key: 'bell-items:hazard', name: 'RIME BELL', at: 'ALONE, 450 OUT', where: 'NORTH, ALONE IN THE ROCK, FROM 450 CELLS OUT', note: 'BLACK ICE CAST AS A BELL, BY WHAT NOBODY KNOWS. IT TOLLS ONCE AS IT BREAKS.' },
  { kin: 1, key: 'ores:rimeA', name: 'MOONSTONE', at: 'RIME', where: 'RIME, THE DEEP FLANKS OF THE NORTH', note: 'MILKY WHITE, WITH A BLUE LIGHT THAT SLIDES ACROSS IT. BRIGHTEST FURTHEST FROM ANY SUN.' },
  { kin: 1, key: 'ores:rimeB', name: 'ICE OPAL', at: 'RIME', where: 'RIME, THE DEEP FLANKS OF THE NORTH', note: 'EVERY COLOUR OF THE SKY OVER THE POLE, FROZEN IN. THE FIRE OPAL IS ITS COUSIN.' },
  // South.
  { kin: 2, key: 'ember-items:oreA', name: 'CINDER ORE', at: 'EMBER', where: 'EMBER, SOUTH', note: 'IRON STILL WARM FROM THE DEEP. IT NEVER QUITE COOLS.' },
  { kin: 2, key: 'ember-items:oreB', name: 'SUNSTONE', at: 'EMBER', where: 'EMBER, SOUTH', note: 'A SPARK THAT FORGOT TO GO OUT. BRIGHTEST BESIDE LAVA.' },
  { kin: 2, key: 'ember-items:steel', name: 'STEEL', at: 'LAVA MEETS SLAG', where: 'SOUTH, WHERE LAVA MEETS SLAG', note: 'SLAG QUENCHED BY LAVA. DOWN HERE THE GROUND DOES ITS OWN SMELTING.' },
  { kin: 2, key: 'ember-items:hazard', name: 'LAVA', at: 'ALL OF THE SOUTH', where: 'SOUTH, IN POCKETS IN A RIND OF SLAG', note: 'ROCK TOO HOT TO KEEP STILL. CUT INTO, IT WAKES AND POURS. THE LAB TAKES ITS SAMPLE FIRST.' },
  { kin: 2, key: 'minerals:tektite', name: 'TEKTITE', at: 'ASH FLATS', where: 'ASH FLATS', note: 'BLACK GLASS FROM AN OLD IMPACT, LEFT LYING IN THE ASH.' },
  { kin: 2, key: 'ores:scoriaA', name: 'SULPHUR', at: 'SCORIA', where: 'SCORIA, SOUTH', note: 'YELLOW STONE THAT BURNS BLUE. THE BUBBLES IN THE SCORIA BREATHE IT OUT.' },
  { kin: 2, key: 'ores:scoriaB', name: 'THUNDEREGG', at: 'SCORIA', where: 'SCORIA, SOUTH', note: 'A PLAIN ROUND STONE. CRACK IT AND THERE IS A STAR OF CLEAR CRYSTAL INSIDE.' },
  { kin: 2, key: 'ores:forgeA', name: 'CINNABAR', at: 'FORGE', where: 'FORGE, SOUTH', note: 'RED AS A COAL AND HEAVY AS LEAD. IN THE HEAT OF THE FORGE IT SWEATS QUICKSILVER.' },
  { kin: 2, key: 'ores:forgeB', name: 'KIDNEY ORE', at: 'FORGE', where: 'FORGE, SOUTH', note: 'IRON IN SHINING LUMPS, ROUND AS KIDNEYS. GROUND TO DUST IT IS RED AS BLOOD.' },
  { kin: 2, key: 'minerals:opal', name: 'FIRE OPAL', at: 'TINDERWORKS', where: 'TINDERWORKS, FAR SOUTH', note: 'A COAL THAT TURNED TO GEM INSIDE A RING OF FUSE. BURN THE FUSE AND IT FALLS OUT.' },
  { kin: 2, key: 'vent-items:hazard', name: 'FUMAROLE', at: 'ALONE, 450 OUT', where: 'SOUTH, ALONE IN THE ROCK, FROM 450 CELLS OUT', note: 'A CHIMNEY OF THE DEEP FIRE. WHAT THE LAB TAKES OF IT IS STILL WARM A YEAR LATER.' },
  { kin: 2, key: 'ores:magmaA', name: 'RED GOLD', at: 'MAGMA', where: 'MAGMA, THE DEEP FLANKS OF THE SOUTH', note: 'GOLD AND COPPER RUN TOGETHER IN THE MAGMA AND COOLED IN DROPS. NO SMITH MADE IT.' },
  { kin: 2, key: 'ores:magmaB', name: 'PERIDOT', at: 'MAGMA', where: 'MAGMA, THE DEEP FLANKS OF THE SOUTH', note: 'GREEN GLASS THE DEEP COUGHS UP IN LUMPS OF LAVA. THE ONE GREEN THING IN THE SOUTH.' },
  // West.
  { kin: 3, key: 'mire-items:oreA', name: 'BOG GOLD', at: 'MIRE', where: 'MIRE, WEST', note: 'NUGGETS SWEATED OUT BY ROOTS. THE FUNGUS HAS NO USE FOR IT.' },
  { kin: 3, key: 'mire-items:oreB', name: 'GLOWCAP', at: 'MIRE', where: 'MIRE, WEST', note: 'A MUSHROOM THAT EATS ROCK AND LIGHTS ITS OWN WAY THROUGH IT.' },
  { kin: 3, key: 'mire-items:hazard', name: 'SPORE POD', at: 'ALL OF THE WEST', where: 'WEST, HUNG IN THE ROCK', note: 'A BAG OF DUST THAT BURSTS AT A TOUCH. THE LAB KEEPS WHAT IS LEFT IN A JAR WITH THE LID ON.' },
  { kin: 3, key: 'minerals:amber', name: 'AMBER', at: 'AMBER HIVES', where: 'AMBER HIVES', note: 'HONEY OF THE HIVE GONE TO STONE. EACH NUGGET HANGS BY ONE STALK.' },
  { kin: 3, key: 'ores:tangleA', name: 'MALACHITE', at: 'TANGLE', where: 'TANGLE, WEST', note: 'COPPER GONE GREEN IN THE DAMP OF THE GREAT CAVES, RING ON RING LIKE THE GRAIN OF A TREE.' },
  { kin: 3, key: 'ores:tangleB', name: 'CAVE PEARL', at: 'TANGLE', where: 'TANGLE, WEST', note: 'ROUND WHITE STONES GROWN IN THE DRIP UNDER THE BRIDGES, A DROP A YEAR, IN A CUP.' },
  { kin: 3, key: 'ores:sporefallA', name: 'FOXFIRE', at: 'SPOREFALL', where: 'SPOREFALL, WEST', note: 'OLD ROOT GONE TO STONE WITH THE FUNGUS STILL IN IT. IT GLOWS AND LIGHTS NOTHING.' },
  { kin: 3, key: 'ores:sporefallB', name: 'JEWEL BEETLE', at: 'SPOREFALL', where: 'SPOREFALL, WEST', note: 'A BEETLE OF RED AND GREEN TURNED TO STONE BEFORE THE MIRE WAS. THE SPORES NEVER TOUCH IT.' },
  { kin: 3, key: 'minerals:lantern', name: 'LANTERN CAP', at: 'GROTTOS', where: 'GROTTOS, FAR WEST', note: 'A MUSHROOM THAT LIGHTS WHEN SOMETHING FLIES BY. ONLY A LIT ONE IS WORTH THE HAUL.' },
  { kin: 3, key: 'worm-items:hazard', name: 'GLOWWORM', at: 'ALONE, 450 OUT', where: 'WEST, ALONE IN THE ROCK, FROM 450 CELLS OUT', note: 'A LIGHT THAT SWIMS THROUGH ROCK AS A FISH SWIMS. WHAT THE BIT LEAVES GLOWS FOR A WEEK.' },
  { kin: 3, key: 'ores:bloomA', name: 'SUNSEED', at: 'BLOOM', where: 'BLOOM, THE DEEP FLANKS OF THE WEST', note: 'SEEDS OF A FLOWER THAT NEVER SAW THE SUN, GONE HARD AS GLASS. PLANTED, NOTHING COMES.' },
  { kin: 3, key: 'ores:bloomB', name: 'FLOWER STONE', at: 'BLOOM', where: 'BLOOM, THE DEEP FLANKS OF THE WEST', note: 'A DARK STONE WITH A WHITE FLOWER OPEN INSIDE IT, AS IF IT GREW THERE. IT DID.' },
  // East.
  { kin: 4, key: 'lode-items:hazard', name: 'SPARK CRYSTAL', at: 'ALL OF THE EAST', where: 'EAST, ON THE FLANKS OF THE SLATE', note: 'A CRYSTAL FULL OF LIGHTNING. IT LETS IT ALL GO AT A TOUCH, AND THE SLATE BESIDE IT GOES TOO.' },
  { kin: 4, key: 'ores:redrockA', name: 'TURQUOISE', at: 'REDROCK', where: 'REDROCK, EAST', note: 'SKY GONE TO STONE IN THE RED BEDS. THE DARK LINES IN IT ARE WHERE IT CRACKED AND HEALED.' },
  { kin: 4, key: 'ores:redrockB', name: 'SELENITE', at: 'REDROCK', where: 'REDROCK, EAST', note: 'PALE BLADES NAMED FOR THE MOON, STACKED FLAT IN THE BEDS AS THE BEDS LIE. A NAIL SCRATCHES THEM.' },
  { kin: 4, key: 'ores:loessA', name: 'STONE FERN', at: 'LOESS', where: 'LOESS, EAST', note: 'DARK FERNS DRAWN ON THE SILT BY WATER THAT DRIED LONG AGO. THEY NEVER GREW.' },
  { kin: 4, key: 'ores:loessB', name: 'LAPIS LAZULI', at: 'LOESS', where: 'LOESS, EAST', note: 'THE BLUE OF A DEEP SKY WITH GOLD DUST CAUGHT IN IT. THE SILT KEEPS IT CLEAN.' },
  { kin: 4, key: 'minerals:agate', name: 'AGATE', at: 'SHALE STACKS', where: 'SHALE STACKS, FAR EAST', note: 'BANDED RED STONE, A LAYER A YEAR. IT LIES ALONG THE GRAIN OF THE SHALE.' },
  { kin: 4, key: 'lodestone-items:hazard', name: 'LODESTONE', at: 'ALONE, 450 OUT', where: 'EAST, ALONE IN THE ROCK, FROM 450 CELLS OUT', note: 'A STONE THAT PULLS ORE TO IT THROUGH SOLID ROCK. THE LAB KEEPS IT FAR FROM THE TOOLS.' },
  { kin: 4, key: 'ores:giltA', name: 'SPINEL', at: 'GILT', where: 'GILT, THE DEEP FLANKS OF THE EAST', note: 'RED STONES THAT KINGS TOOK FOR RUBIES. THE GILT HAS THEM BY THE HANDFUL.' },
  { kin: 4, key: 'ores:giltB', name: 'ALEXANDRITE', at: 'GILT', where: 'GILT, THE DEEP FLANKS OF THE EAST', note: 'GREEN IN THE DARK AND RED IN THE LAMP. THE LAB HAS NEVER SEEN IT THE SAME COLOUR TWICE.' },
];
// The five parts of the list: a title, and the frame of the `icons` sheet drawn beside it.
export const LAB_KINS = [['HOME AND ALL ROUND', 'home'], ['NORTH', 'frost'], ['SOUTH', 'ember'], ['WEST', 'mire'], ['EAST', 'lode']];
export const LAB_OF = Object.fromEntries(LAB.map(e => [e.key, e]));
// The levels a count of samples has earned (0 for none; 1 for the first; one more at 2, 4, 8 ...), and the count
// the next level comes at.
export const labLevel = n => { let l = 0; while (n >> l) l++; return l; };
export const labNext = n => 2 ** labLevel(n);
// The shop's second tab, WORKS: what is fitted to the drill for the rare things found in pockets. Each row is paid
// for in grit and in the specimens of one direction (`kin`; `spec`, how many each level asks), which only that
// direction's pockets give. A row of two values is fitted once; MENDER and FLYWHEEL have levels, and the three
// fittings for hazards a second level late in a game (in LATE: the specimens they ask pile up only after about an
// hour and a half).
//   MENDER      the hull mends itself, a pip back every so many seconds since the last knock (the value): every
//               twenty with no mender fitted, so a drill that gets clear of trouble recovers, and faster with one.
//               Never as fast as SHIELD (js/game.js): a blow inside the shield after a knock takes nothing, so a
//               mender quicker than the shield would give back every pip a steady fire took, and the hull's late
//               levels and the black box's would be for nothing
//   LAVA SKIN   lava neither knocks the hull nor stops the drill: it flies through it; at its second level (the
//               bellows) woken lava smelts a wider rind of slag to steel
//   SPORE DRIVE a spore pod's burst does not knock: it drives the drill half as fast again for BOOST seconds; at its
//               second (the graft) moss that closes beside ore the world laid heals as that ore
//   ARC COIL    a crystal's arc does not knock: it mends a pip; at its second (the capacitor) it charges the bit,
//               and the next cut shatters the hard rock round it
//   DIAMOND TIP metal (steel, and the iron of keystones) cuts as fast as its kind says (js/world.js: DIG_TIME);
//               without it, METAL times as slow (js/game.js). Paid in the north's specimens, as starglass is its
//               mineral: a clear crystal hard enough to cut iron.
//   FLYWHEEL    a haul of a dozen cells or more that comes within a few seconds of the last pays a share more for
//               each in the run, up to the value: a stream of quick loops against the winch's one great one. Paid
//               in the south's specimens, which have least else to buy.
const works = (beside, share, spec) => ({ beside, grit: beside.map(at => priced(at, share)), gems: beside.map(() => 0), spec });
export const WORKS = [
  { id: 'mender', name: 'MENDER', what: 'HULL MENDS FASTER', values: [20, 14, 9, 5], kin: B.FROST, gem: B.FROST, ...works([5, 6, 7], 0.4, [8, 16, 24]), show: v => `${v}S` },
  { id: 'lavaskin', name: 'LAVA SKIN', what: 'SWIMS IN LAVA', values: [0, 1], kin: B.EMBER, gem: B.EMBER, ...works([5.5], 0.4, [12]), show: v => ['OFF', 'SWIM', 'SMELT'][v], says: l => l ? 'SMELTS A WIDER RIND' : null },
  { id: 'sporedrive', name: 'SPORE DRIVE', what: 'SPORES SPEED IT UP', values: [0, 1], kin: B.MIRE, gem: B.MIRE, ...works([5.5], 0.4, [12]), show: v => ['OFF', 'DRIVE', 'GRAFT'][v], says: l => l ? 'MOSS HEALS AS ORE' : null },
  { id: 'arccoil', name: 'ARC COIL', what: 'ARCS MEND THE HULL', values: [0, 1], kin: B.LODE, gem: B.LODE, ...works([5.5], 0.4, [12]), show: v => ['OFF', 'MEND', 'CHARGE'][v], says: l => l ? 'ARCS CHARGE THE BIT' : null },
  { id: 'diamond', name: 'DIAMOND TIP', what: 'CUTS METAL FAST', values: [0, 1], kin: B.FROST, gem: B.FROST, ...works([4.5], 0.4, [10]), show: v => v ? 'ON' : 'OFF' },
  { id: 'flywheel', name: 'FLYWHEEL', what: 'QUICK HAULS PAY MORE', values: [0, 0.4, 0.6], kin: B.EMBER, gem: B.EMBER, ...works([4.5, 6.5], 0.4, [10, 30]), show: v => v ? `+${Math.round(v * 100)}%` : 'OFF', says: l => l ? '+12% A HAUL IN A ROW' : '+8% A HAUL IN A ROW' },
];
// The shop's third tab, MAP: what the map in the corner shows.
//   RANGE    how many cells of ground a pixel of the map is, so how far it shows: 69 cells across at first
//   LENS     what the map tells apart from plain rock, in colours of their own: ore; then hard ground and hazards;
//            then minerals, caches and whatever else was laid to be found (js/drawing.js: `LENS`)
//   FINDER   finds not yet seen are marked on the map: caches; then geodes; then prisms (js/drawing.js: `findsNear`)
//   CHART    a map of the whole of the tether's reach (a tap on the map; the third tab of the top bar's panel)
// Which finds the finder marks at each level of it (`mapfinder`), and how far from the drill it marks them, in
// cells (js/drawing.js: `findsNear`; and js/fauna.js, whose wren never leads the drill to one the finder marks).
export const FOUND = { cache: 1, geode: 2, prism: 3 };
export const FINDER = [0, 120, 200, 320];
// (RANGE takes the west's gems, as the winch does: of the four directions' gems the west's had least to buy.)
export const MAPS = [
  { id: 'maprange', icon: 'scanner', name: 'RANGE', what: 'MAP SHOWS FURTHER', values: [1.5, 2.25, 3.5, 5], gem: B.MIRE, ...levels([2, 4, 6], 0.25), show: v => `${Math.round(v * 46)}` },
  { id: 'maplens', icon: 'scanner', name: 'LENS', what: 'MAP TELLS MORE APART', values: [0, 1, 2, 3], gem: B.LODE, ...levels([1.5, 3.5, 5.5], 0.25), show: v => ['ROCK', 'ORE', 'HARD', 'ALL'][v] },
  { id: 'mapfinder', icon: 'scanner', name: 'FINDER', what: 'MARKS FINDS UNSEEN', values: [0, 1, 2, 3], gem: B.MIRE, ...levels([2.5, 4.5, 6.5], 0.25), show: v => ['OFF', 'CACHE', 'GEODE', 'PRISM'][v],
    says: l => `${['CACHES', 'GEODES', 'PRISMS'][l]} ${FINDER[l + 1]} OUT` },
  { id: 'chart', icon: 'scanner', name: 'CHART', what: 'MAPS THE WHOLE REACH', values: [0, 1], gem: B.EMBER, ...levels([3], 0.3), show: v => v ? 'ON' : 'OFF' },
];
// The shop's fourth tab, CORE: what is built into the station late in a game, at many times the price of anything
// in the other tabs (a level costs from one and a half to six times the step of reach it lies beside, and gems by
// the thousand), each asking besides for much to have been found.
//   REFINERY   every haul's grit is multiplied
//   GEM CUTTER every haul's gems are multiplied: it asks for kinds analysed, 8, 18, 28 and 36 of the forty-eight. A
//              direction and the home ground hold thirteen to seventeen between them (the north fourteen, the
//              south seventeen), most of them far out: within two hundred cells one direction gives five to eight
//              (copper and violet quartz, its own two ores, its hazard but in the north, a pocket's mineral, keystone
//              iron where a slab lies on the road, steel in the south), its strains, a far pocket and its rare
//              hazard add six or so by the reach the second level lies beside, and its deep flank two more from
//              about 800 cells. So the first level is about one direction, the second asks for a second, the third
//              for most of three and the last for all four; a long game played round all four came to eight in ten
//              minutes, eighteen in about thirty-five and twenty-eight in about eighty. (It asked 4, 7, 10 and 12 of
//              sixteen, which one direction gave within two hundred cells.)
//              Its first level of the late game asks for 42 kinds, which only the deep flanks make up: one wall of
//              the late game that is about what has been analysed and not how far out the drill has been.
//   LAMP       the drill's light reaches further (cells), and sees across open ground as far as it reaches, as the
//              scan sees through rock. (It cost what the levels round it do, and gave a light that lit no more than
//              a phone's screen showed: it is a third of that now.)
//   BLACK BOX  when the drill is lost, this share of the grit the trip had earned is kept
//   LIVE CATCH a rare hazard hauled while it is awake (a bell tolling, a fumarole between its jets, a lodestone
//              humming) pays its lump this many times over; a glowworm swimming pays twice with none, as it always
//              has. Paid in the west's gems, and asks for kinds analysed: thirty and forty, as many as a game
//              has by the time it has been out to the rare hazards (from 450 cells) and past them
//   TROPHY LINE a foe at rest (a bat clinging after its swoop, a leech on the floor, a spitter sagging) caught in a
//              loop of the tether pays this many specimens of its ground's direction. Paid in the south's gems, and
//              asks for kinds of creature met (js/fauna.js)
const deep = (steps, gems) => ({ beside: steps.map(([at]) => at), grit: steps.map(([at, share]) => priced(at, share)), gems });
export const CORE = [
  { id: 'refinery', pic: 'grit', name: 'REFINERY', what: 'HAULS PAY MORE GRIT', values: [1, 1.15, 1.3, 1.5, 1.75, 2], gem: B.FROST, needs: ['places', [6, 9, 12, 16, 20]], ...deep([[5, 1.5], [6, 2], [7, 2.5], [8, 3], [8, 6]], [600, 1500, 4000, 10000, 25000]), show: v => `x${v}` },
  { id: 'cutter', pic: 'lode', name: 'GEM CUTTER', what: 'HAULS PAY MORE GEMS', values: [1, 1.2, 1.4, 1.7, 2], gem: B.LODE, needs: ['kinds', [8, 18, 28, 36]], ...deep([[5.5, 1.5], [6.5, 2], [7.5, 3], [8, 5]], [800, 2500, 8000, 20000]), show: v => `x${v}` },
  { id: 'lamp', pic: 'bolt', name: 'LAMP', what: 'LIGHT SEES CAVERNS', values: [8.5, 10, 12, 14], gem: B.EMBER, needs: ['parts', [1, 3, 5]], ...deep([[4, 0.5], [6, 0.8], [8, 1.1]], [0, 600, 3000]), show: v => `${v}` },
  { id: 'blackbox', pic: 'lock', name: 'BLACK BOX', what: 'KEEPS GRIT WHEN LOST', values: [0, 0.25, 0.5, 0.75], gem: B.MIRE, needs: ['places', [5, 10, 15]], ...deep([[5, 1], [6.5, 2], [8, 3]], [400, 2000, 9000]), show: v => `${Math.round(v * 100)}%`,
    // (From its third level it keeps what a lost trip learnt, as well as its grit: js/game.js, `keepLore`.)
    says: l => l === 2 ? 'KEEPS WHAT IT LEARNT' : null },
  // (The live catch's value is what a woken rare's lump is multiplied by: 1, by nothing, before it is bought.)
  { id: 'livecatch', pic: 'mire', name: 'LIVE CATCH', what: 'WOKEN RARES PAY MORE', values: [1, 2, 3], gem: B.MIRE, needs: ['kinds', [30, 40]], ...deep([[6.5, 1.5], [7.5, 2]], [1500, 4000]), show: v => v > 1 ? `ALL x${v}` : 'WORM x2',
    says: l => l ? `WOKEN RARES PAY x${CORE[4].values[l + 1]}` : 'BELLS, VENTS, STONES' },
  { id: 'trophy', pic: 'spec-ember', name: 'TROPHY LINE', what: 'LOOPS CATCH FOES', values: [0, 2, 3], gem: B.EMBER, needs: ['beasts', [6, 10]], ...deep([[6, 1], [7, 1.5]], [1000, 3000]), show: v => v ? `${v} SPEC` : 'OFF',
    says: l => `A FOE PAYS ${CORE[5].values[l + 1]} SPEC` },
];
export const ROWS = [...UPGRADES, ...WORKS, ...MAPS, ...CORE];
// The late game: levels past the ones above, for the two thirds of the ground that lie beyond them. Everything
// above is bought, at 85 million grit in all, by a drill that has been a thousand cells out along one road, while
// the relics lie two thousand out in each of four directions: a game had the whole shop at its last levels, and
// 64 million grit over, with a twentieth of the ground inside its reach explored. Each row here is the levels
// added to a row above: [what the level gives, grit, gems, what must have been found (as `needs`: a count of the
// row's own kind, or [kind, count]), specimens]. They cost from ten million to four hundred and fifty million
// grit, 3.4 thousand million in all, and gems by the thousand of the direction each row takes them from; and they
// ask that the drill has been further out than any level above asks (760 to 1,850 cells), that the far wrecks'
// parts have come home (the last lie 1,200 and 1,700 out), kinds analysed, creatures met or specimens by the
// score, and, the station's last, that relics have. (No level of reach: the tether already goes past the relics.)
// Each of them is drawn as a step up on the drill, the tether or the station, as every level above is
// (js/fit.js). `EARLY` is each row's last level before these, for a picture of a game there.
// No two of them ask the same distance, and none what a level of reach asks (900, for 2,300): they open one at a
// time, forty or fifty cells apart, as the drill goes further out, the first three (the ram, the spore drive's
// graft and the mender, 760 to 850) while it works its way out to the last reach's 900. (They asked 900, 1,000,
// 1,500 and 1,800 of two and three rows at once, and were bought together in the minute the drill first got there,
// with up to three hundred million grit banked waiting; and nothing at all asked between 700 and 900, which a game
// took forty minutes and more to cross with nothing to buy.) A row's first late level is priced as it was; its
// second and third at half as much again, so that from about a hundred minutes on, when levels open faster than
// grit comes in, there is still something to save for.
const LATE = {
  drill: [[6, 25e6, 4000, 950], [7, 120e6, 10000, 1350], [8, 375e6, 25000, 1750]],
  winch: [[3.5, 25e6, 5000, 1050], [4, 120e6, 12000, 1450], [5, 375e6, 30000, 1850]],
  scanner: [[11, 20e6, 3000, 6], [13, 105e6, 8000, 8]],
  momentum: [[2.5, 30e6, 5000, 760], [2.8, 150e6, 14000, 1550]],
  hull: [[10, 25e6, 3000, 1200], [11, 120e6, 8000, 1500], [12, 375e6, 20000, 1800]],
  // (The mender's asked 60 and 120 of the north's specimens, the scarcest kind, where a long game gathers sixty to a
  // hundred in three hours: they were bought on two worlds of six. And they mended every 3 and 2 seconds, no slower
  // than the shield: no steady fire could wear the hull down. See WORKS.)
  mender: [[4, 30e6, 0, 850, 40], [3.5, 150e6, 0, 1650, 60]],
  lavaskin: [[2, 12e6, 0, 0, 60]],
  sporedrive: [[2, 12e6, 0, 810, 40]],
  arccoil: [[2, 15e6, 0, 0, 60]],
  maprange: [[7, 10e6, 2000, ['out', 1000]], [10, 60e6, 6000, ['out', 1700]]],
  refinery: [[2.5, 80e6, 30000, ['relics', 1]], [3, 450e6, 45000, ['relics', 2]]],
  cutter: [[2.5, 60e6, 22000, ['kinds', 42]], [3, 330e6, 35000, ['relics', 1]]],
  lamp: [[16, 30e6, 10000, 7], [18, 135e6, 25000, 8]],
  blackbox: [[0.9, 50e6, 15000, ['out', 1600]]],
  livecatch: [[4, 40e6, 12000, ['relics', 1]]],
  trophy: [[4, 30e6, 10000, ['beasts', 12]]],
};
export const EARLY = Object.fromEntries(ROWS.map(u => [u.id, u.values.length - 1]));
for (const u of ROWS) for (const [value, grit, gems, need, spec] of LATE[u.id] ?? []) {
  // (A row that asked for nothing asks nothing for the levels it had.)
  if (need && !u.needs) u.needs = ['out', u.grit.map(() => 0)];
  u.values.push(value); u.grit.push(grit); u.gems.push(gems);
  if (u.needs) u.needs[1].push(need);
  if (u.spec) u.spec.push(spec);
}
export const TABS = [{ id: 'rig', name: 'RIG', rows: UPGRADES }, { id: 'works', name: 'WORKS', rows: WORKS }, { id: 'map', name: 'MAP', rows: MAPS }, { id: 'core', name: 'CORE', rows: CORE }];
