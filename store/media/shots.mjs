// What tools/trailer.mjs films: each shot is the real game at 1920x1080, staged by its own `?shot` query (js/shot.js) and
// flown by the pilot (tools/trailer-pilot.js). Levels are the game's own (`lv=max` is every upgrade bought).
const key = (at, extra = '') => `shot&seed=7&key&at=${at}&lv=max&met${extra}`;
const lap = (min = 120, after = 400) => [{ key: true, min }, { loose: 40, min }, { wait: after }];
const buy = id => ({ act: `game.buy(__shop.ROWS.find(u => u.id === '${id}'))` });

export const SHOTS = {
  // A slab of the south, its last key cut, lapped and hauled.
  south: { query: key('-76,224'), plan: lap(), seconds: 13 },
  // The verb, at the core: a block cut free, the tether round it, reeled home in view.
  verb: { query: 'shot&seed=7&at=11,2&lv=max,drill.3,momentum.2&met', plan: [{ wait: 20 }, { block: 6, ahead: 6 }, { wait: 300 }], seconds: 11 },
  // The first slab of the world, near enough to follow home.
  first: { query: key('3,52'), plan: [{ key: true, min: 100 }, { loose: 40, min: 100 }, { wait: 30 }, { home: true }, { wait: 200 }], seconds: 13 },
  north: { query: key('79,-219'), plan: lap(), seconds: 12 },
  west: { query: key('-208,99'), plan: lap(), seconds: 10 },
  east: { query: key('664,-348'), plan: lap(300), seconds: 14 },
  deep: { query: key('503,-534'), plan: lap(300), seconds: 14 },
  red: { query: key('505,363'), plan: lap(300), seconds: 14 },
  // A block of more than a thousand cells, cut by hand: MOUNTAINOUS.
  giant: { query: 'shot&seed=7&at=0,-120&lv=max&met', plan: [{ block: 34, ahead: 20, mid: true }, { wait: 520 }], seconds: 24 },
  // The shop in the middle of a game that has been 1,500 cells out, three rows bought and paid for.
  shop: {
    query: 'shot&seed=7&met&lv=tether.5,drill.2,winch.2,momentum.2,scanner.2,hull.1&shop=rig&grit=9000000',
    plan: [{ act: 'game.S.out = 1500; game.S.gems = game.S.gems.map(() => 20000);' }, { wait: 50 }, buy('drill'), { wait: 60 }, buy('winch'), { wait: 60 }, buy('momentum'), { wait: 100 }],
    seconds: 6,
  },
  // A part fitted at the core, after the shop has shut.
  fit: { query: 'shot&seed=7&met&lv=late&buy=tether', plan: [{ wait: 240 }], seconds: 4 },
  lab: { query: 'shot&seed=7&met&lv=late&lab=all&labsel=FLUORITE', plan: [{ wait: 120 }], seconds: 2 },
  // The four lords at their lairs, awake and fighting: the pilot flies at the south's and round the north's, and holds
  // still for the west's and the east's. None is beaten on film.
  lordS: { query: 'shot&seed=7&fauna=boss-s:rest:2&lv=max&met', plan: [{ wait: 20 }, { lord: 1, ram: true }, { wait: 300 }], seconds: 7 },
  lordN: { query: 'shot&seed=7&fauna=boss-n:rest:2&lv=max&met', plan: [{ wait: 10 }, { lord: 3, ring: 4, laps: 1.4 }, { wait: 300 }], seconds: 7 },
  lordW: { query: 'shot&seed=7&fauna=boss-w:tell:3&lv=max&met', plan: [{ wait: 420 }], seconds: 7 },
  lordE: { query: 'shot&seed=7&fauna=boss-e:tell:3&lv=max&met', plan: [{ wait: 420 }], seconds: 7 },
  // The station at the core with everything fitted: what the end card lies over.
  home: { query: 'shot&seed=7&lv=max&met', plan: [{ wait: 720 }], seconds: 12 },
};

// The levels of the mix, in dB: the shots' own sound, the game's music, the sting under the logo, how far the music steps back.
export const SFX_DB = 22.5, MUSIC_DB = 22, STING_DB = 20, DUCK = 6;

// The cut, in beats of the music (92 to the minute, four to a bar). `haul`: `at` is counted from the shot's biggest haul;
// otherwise from its first frame. `word`: one of the three words on screen. `end`: the end card over this clip.
export const CUT = [
  // A haul in the first seconds, and what it paid.
  { shot: 'south', haul: true, at: -39, beats: 4, note: 'a 317-cell slab of the south lets go' },
  { shot: 'south', haul: true, at: 190, beats: 4, note: 'its count runs up and stamps' },
  // The verb, in one take at the core.
  { shot: 'verb', haul: true, at: -234, beats: 4, word: 'cut', note: 'the drill cuts round a block' },
  { shot: 'verb', haul: true, at: -78, beats: 4, word: 'loop', note: 'the tether closes round it' },
  { shot: 'verb', haul: true, at: 78, beats: 4, word: 'reel', note: 'the core reels it home' },
  // Bigger and bigger.
  { shot: 'first', haul: true, at: -39, beats: 4, note: '147 cells' },
  { shot: 'red', haul: true, at: -39, beats: 4, note: '588 cells' },
  { shot: 'deep', haul: true, at: -39, beats: 4, note: '707 cells' },
  { shot: 'east', haul: true, at: -39, beats: 4, note: '722 cells' },
  // The four directions.
  { shot: 'north', haul: true, at: -78, beats: 4, note: 'north: ice' },
  { shot: 'south', haul: true, at: -150, beats: 4, note: 'south: basalt and lava' },
  { shot: 'west', haul: true, at: -78, beats: 4, note: 'west: the mire' },
  { shot: 'east', haul: true, at: -220, beats: 4, note: 'east: lode and crystal' },
  // Upgrades.
  { shot: 'shop', at: 30, beats: 4, note: 'the shop, rows bought' },
  { shot: 'fit', at: 0, beats: 5, note: 'a part fitted at the core' },
  { shot: 'lab', at: 0, beats: 3, note: 'the lab' },
  // The lords.
  { shot: 'lordN', at: 0, beats: 5, note: 'the Frost Wyrm' },
  { shot: 'lordE', at: 224, beats: 5, note: 'the Crystal King' },
  { shot: 'lordW', at: 40, beats: 5, note: 'the Spore Mother' },
  { shot: 'lordS', at: 210, beats: 5, note: 'the Magma Behemoth charges' },
  // The biggest of all, and the name.
  { shot: 'giant', haul: true, at: -78, beats: 6, note: '1,102 cells: MOUNTAINOUS!' },
  { shot: 'giant', haul: true, at: 240, beats: 6, note: 'its count' },
  { shot: 'home', at: 60, beats: 12, end: true, mute: true, note: 'logo, Wishlist on Steam' },
];

// The screenshots, best first: a frame of a shot, untouched.
export const STILLS = [
  { name: 'haul-south-lava', shot: 'south', haul: true, at: 60 },    // a big haul mid-flight, in the south
  { name: 'haul-north-ice', shot: 'north', haul: true, at: 84 },     // the north
  { name: 'haul-east-sandstone', shot: 'east', haul: true, at: 60 }, // the east
  { name: 'reel-to-core', shot: 'verb', haul: true, at: 165 },       // the whole verb in one view: tether, rubble, core
  { name: 'haul-west-mire', shot: 'west', haul: true, at: 72 },      // the west
  { name: 'lord-behemoth', shot: 'lordS', at: 272 },                 // a lord fight: the Magma Behemoth charges
  { name: 'haul-deep-frost', shot: 'deep', haul: true, at: 84 },     // a 707-cell haul, its count running
  { name: 'lord-crystal-king', shot: 'lordE', at: 60 },              // a lord fight: the Crystal King tells an attack
  { name: 'upgrade-shop', shot: 'shop', at: 150 },                   // the upgrade shop
  { name: 'lab', shot: 'lab', at: 60 },                              // the lab's notes
];
