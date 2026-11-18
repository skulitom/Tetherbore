// The hand-drawn recipes: what lies in the rock, the drill, the core, the interface.
// Ore and hazard drawings are 12 x 12 in the middle of a 16 x 16 frame, so they sit inside a tile's rim.
import { fauna } from './fauna.mjs';

// A frame that only recolours another is drawn from the symbol again with its own palette: a frame copied with
// `from` keeps the pixels of the first, colours and all.
const frame = (name, symbol, extra = {}) => ({ name, duration: 300, ops: [{ op: 'stamp', symbol, x: 2, y: 2 }], ...extra });

const RELIC = [
  '......kk......',
  '.....kyyk.....',
  '....kyggyk....',
  '...kygwgGyk...',
  '..kygwggGGyk..',
  '.kyggggGGGGyk.',
  'kyggggGGGGGGyk',
  'kyGGGGGGGGGDyk',
  '.kyGGGGGGDDyk.',
  '..kyGGGGDDyk..',
  '...kyGDDDyk...',
  '....kyDDyk....',
  '.....kyyk.....',
  '......kk......',
];
const relic = (palette) => ([
  { name: 'relic', duration: 400, ops: [{ op: 'stamp', symbol: 'relic', x: 1, y: 1 }] },
  { name: 'relic-glint', duration: 160, palette: { ...palette, g: '#ffffff' }, ops: [{ op: 'stamp', symbol: 'relic', x: 1, y: 1 }] },
]);

export const frost = {
  version: 1, name: 'frost-items', width: 16, height: 16,
  palette: { k: '#22395a', d: '#5f86b8', l: '#eef8ff', i: '#e6f5ff', w: '#ffffff', p: '#4fd0e8', q: '#1f86c0', a: '#f6a0e0', b: '#b452ac', g: '#8cf2c4', h: '#3aa88a',
    y: '#f4d86a', G: '#6ab8f0', D: '#3a78c8' },
  symbols: {
    dense: [
      '............',
      '.kkkk...kkk.',
      'kllldk.klldk',
      'kllddk.klddk',
      '.kkkk...kkk.',
      '............',
      '...kkkkk....',
      '..kllllkk...',
      '..klldddkkk.',
      '...kkkk.kldk',
      '.........kk.',
      '............',
    ],
    oreA: [
      '............',
      '....kkk.....',
      '...kwppk....',
      '...kpppk.kk.',
      '...kppqkkwpk',
      '....kkk.kpqk',
      '.kkk.....kk.',
      'kwppk.......',
      'kpppk.......',
      'kppqk.......',
      '.kkk........',
      '............',
    ],
    oreB: [
      '............',
      '.....k......',
      '....kak.....',
      '....kabk..k.',
      '...kaabk.kgk',
      '...kaabkkggk',
      '...kabbkkghk',
      '..kaabbkkghk',
      '..kabbbkghhk',
      '..kkkkkkkkk.',
      '............',
      '............',
    ],
    relic: RELIC,
  },
  frames: [frame('dense', 'dense'), frame('oreA', 'oreA'), frame('oreB', 'oreB'), ...relic({})],
  animations: { relic: { frames: ['relic', 'relic', 'relic', 'relic-glint'] } },
};

export const ember = {
  version: 1, name: 'ember-items', width: 16, height: 16,
  palette: { k: '#160c12', d: '#2a1214', l: '#a86a58', o: '#ff8a2a', y: '#ffd84a', r: '#c8381e', w: '#fff6c8', m: '#7a1e14',
    g: '#ffb060', G: '#f0602a', D: '#a82a1a', e: '#6a5a52', E: '#3e3230', h: '#8e7c70', i: '#d8e8ff', I: '#6e8cc8', j: '#3a4a7a', W: '#ffffff', z: '#ffffff00' },
  symbols: {
    dense: [
      '............',
      '.kkkk...kkk.',
      'kllldk.klldk',
      'kllddk.klddk',
      '.kkkk...kkk.',
      '............',
      '...kkkkk....',
      '..kllllkk...',
      '..klldddkkk.',
      '...kkkk.kldk',
      '.........kk.',
      '............',
    ],
    oreA: [
      '............',
      '....kkk.....',
      '...kroyk....',
      '..kroyyok...',
      '..krooork.kk',
      '...krrrk.kok',
      '....kkk.kyok',
      '.kk.....krrk',
      'kyok.....kk.',
      'kork........',
      '.kk.........',
      '............',
    ],
    oreB: [
      '............',
      '.....y......',
      '..y..k..y...',
      '...ykykyk...',
      '...kywyyk...',
      '.ykywwyyoky.',
      '...kyyyok...',
      '...kyooyk...',
      '..y.kkk.y...',
      '.....y......',
      '............',
      '............',
    ],
    lava: [
      '............',
      '...kkkkk....',
      '..kroooork..',
      '.kroyyyoork.',
      '.kroywyyork.',
      '.kooyyyyork.',
      '.kroyyyoork.',
      '.kroooyoork.',
      '..kroooork..',
      '...krrrrk...',
      '....kkkk....',
      '............',
    ],
    // What lava leaves round itself: a pitted lump of clinker, dull beside everything else here.
    slag: [
      '............',
      '............',
      '...kkkkk....',
      '..khheeekk..',
      '.khheEeeeek.',
      '.kheeeeeEek.',
      '.keeEeeeeek.',
      '.keeeeeEeEk.',
      '..kEeeEeekk.',
      '...kkkkkk...',
      '............',
      '............',
    ],
    // What slag becomes when lava touches it: a bar of blue steel, strapped twice. The z above it is clear but in
    // the glint and the quench, where it is a sparkle.
    steel: [
      '..........z.',
      '.........zzz',
      '.kkkkkkkkkk.',
      'kiiiiiiiiiik',
      'kiWWiiiiiiik',
      'kIIIjIIIjIIk',
      'kIIIjIIIjIIk',
      'kIIIjIIIjIIk',
      'kjjjjjjjjjjk',
      '.kkkkkkkkkk.',
      '............',
      '............',
    ],
    relic: RELIC,
  },
  frames: [frame('dense', 'dense'), frame('oreA', 'oreA'), frame('oreB', 'oreB'),
    frame('hazard', 'lava', { duration: 260 }), frame('hazard-b', 'lava', { duration: 260, palette: { y: '#ff8a2a', o: '#ffd84a' } }),
    ...relic({}),
    frame('slag', 'slag'), frame('steel', 'steel', { duration: 500 }), frame('steel-glint', 'steel', { duration: 140, palette: { i: '#ffffff', I: '#d8e8ff', z: '#ffffff' } }),
    // The flash as slag is quenched to steel: the bar with every colour white.
    frame('quench', 'steel', { duration: 120, palette: { k: '#ffffff', i: '#ffffff', I: '#ffffff', j: '#ffffff', z: '#ffffff' } })],
  animations: { hazard: { frames: ['hazard', 'hazard-b'] }, relic: { frames: ['relic', 'relic', 'relic', 'relic-glint'] },
    steel: { frames: ['steel', 'steel', 'steel-glint'] } },
};

export const mire = {
  version: 1, name: 'mire-items', width: 16, height: 16,
  palette: { k: '#1c1426', d: '#30243e', l: '#8c7ca0', a: '#f0a020', A: '#ffd070', B: '#a85a10', c: '#58f0e0', C: '#2aa8b0', w: '#ffffff', s: '#e8e0d0', S: '#a89ab0',
    v: '#b060d0', V: '#7a3a9a', u: '#f0c0f8', y: '#f4d86a', g: '#b8f06a', G: '#5cb848', D: '#2a7a3a',
    // (The pod's: a hot magenta shell with a pale shine, spotted white, so that it stands out of the mire's dark violet
    // and the pale sporefall alike; it was a dull violet the size of a pebble, and players lost it. Its spots are not
    // the lime they might be: that is the west's ore, and what hurts is kept far from what pays.)
    p: '#e070ff', P: '#9a32c8', q: '#ffe0ff', t: '#fff0ff', T: '#a040d0' },
  symbols: {
    dense: [
      '............',
      '.kkkk...kkk.',
      'kllldk.klldk',
      'kllddk.klddk',
      '.kkkk...kkk.',
      '............',
      '...kkkkk....',
      '..kllllkk...',
      '..klldddkkk.',
      '...kkkk.kldk',
      '.........kk.',
      '............',
    ],
    oreA: [
      '............',
      '....kk......',
      '...kAak.....',
      '..kAaaak....',
      '..kaaaBk.k..',
      '..kaaBBkkak.',
      '...kBBk.kAak',
      '....kk..kaBk',
      '.........kk.',
      '............',
      '............',
      '............',
    ],
    oreB: [
      '............',
      '....kkkk....',
      '..kkccCCkk..',
      '.kcwccCCCCk.',
      '.kccccCCCCk.',
      '..kkkkkkkk..',
      '....ksSk....',
      '....ksSk....',
      '...kssSSk...',
      '...kkkkkk...',
      '............',
      '............',
    ],
    pod: [
      '....kkkk....',
      '..kkpppPkk..',
      '.kpqqpptPPk.',
      '.kpqpptTpPk.',
      'kpppppppptPk',
      'kptpppppTPPk',
      'kpTpptpppPPk',
      'kppppTpptPPk',
      '.kPpppppPPk.',
      '.kPPtPPPPPk.',
      '..kkPPPPkk..',
      '....kkkk....',
    ],
    relic: RELIC,
  },
  frames: [frame('dense', 'dense'), frame('oreA', 'oreA'), frame('oreB', 'oreB'),
    frame('hazard', 'pod', { duration: 500 }), frame('hazard-b', 'pod', { duration: 260, palette: { t: '#ffffff', T: '#ffc0ff', p: '#f4a0ff', q: '#ffffff' } }),
    ...relic({})],
  animations: { hazard: { frames: ['hazard', 'hazard-b'] }, relic: { frames: ['relic', 'relic', 'relic', 'relic-glint'] } },
};

export const lode = {
  version: 1, name: 'lode-items', width: 16, height: 16,
  palette: { k: '#3a2414', d: '#7a5230', l: '#ecd09a', c: '#e07a3a', C: '#f8b070', t: '#3aa890', x: '#ffffff', p: '#c8a0ff', P: '#8a5ad8', q: '#70e0ff',
    z: '#fff08a', Z: '#f0b020', w: '#ffffff', y: '#f4d86a', g: '#e0b8ff', G: '#a070e8', D: '#6a3ab8' },
  symbols: {
    dense: [
      '............',
      '.kkkk...kkk.',
      'kllldk.klldk',
      'kllddk.klddk',
      '.kkkk...kkk.',
      '............',
      '...kkkkk....',
      '..kllllkk...',
      '..klldddkkk.',
      '...kkkk.kldk',
      '.........kk.',
      '............',
    ],
    oreA: [
      '............',
      '............',
      '...kkk......',
      '..kCcck.kk..',
      '..kcctkkCck.',
      '...kkk.kctk.',
      '.......kkk..',
      '..kkkk......',
      '.kCccck.....',
      '.kccttk.....',
      '..kkkk......',
      '............',
    ],
    oreB: [
      '............',
      '.....kk.....',
      '....kxqk....',
      '...kxqqpk...',
      '...kxqppk...',
      '...kqqpPk...',
      '...kqppPk...',
      '...kqpPPk...',
      '....kpPk....',
      '.....kk.....',
      '............',
      '............',
    ],
    spark: [
      '............',
      '.....k......',
      '....kzk..k..',
      '....kzk.kzk.',
      '..k.kzZkkzk.',
      '.kzkkzZkzZk.',
      '.kzZkzZkzZk.',
      '.kzZZzZZZZk.',
      '..kZZZZZZk..',
      '...kkkkkk...',
      '............',
      '............',
    ],
    relic: RELIC,
  },
  frames: [frame('dense', 'dense'), frame('oreA', 'oreA'), frame('oreB', 'oreB'),
    frame('hazard', 'spark', { duration: 700 }), frame('hazard-b', 'spark', { duration: 120, palette: { z: '#ffffff', Z: '#fff08a' } }),
    ...relic({})],
  animations: { hazard: { frames: ['hazard', 'hazard-b'] }, relic: { frames: ['relic', 'relic', 'relic', 'relic-glint'] } },
};

// ------------------------------------------------------------------ the drill
// Drawn facing right; the other three directions are the same symbol turned. The bit's two greys swap to spin it.
const DRILL = [
  '................',
  '................',
  '................',
  '...kkkkkkk......',
  '..kbbbbbbbkk....',
  '..kbwwcbbbksk...',
  '..kbwccbbbkSsk..',
  '..kbccbbbbksSsk.',
  '..kbbbbbbbksSsk.',
  '..kbbbbbbbkSsk..',
  '..kdddddddksk...',
  '..kdddddddkk....',
  '...kkkkkkk......',
  '................',
  '................',
  '................',
];
// From the sixth bit the cone is a pixel longer, its point at the frame's edge.
const DRILL_LONG = [
  '................',
  '................',
  '................',
  '...kkkkkkk......',
  '..kbbbbbbbkk....',
  '..kbwwcbbbkssk..',
  '..kbwccbbbkSsSk.',
  '..kbccbbbbksSssk',
  '..kbbbbbbbksSssk',
  '..kbbbbbbbkSsSk.',
  '..kdddddddkssk..',
  '..kdddddddkk....',
  '...kkkkkkk......',
  '................',
  '................',
  '................',
];
// The bit alone, to lay over it hot: every pixel that is not the bit's metal left clear.
const bitOnly = rows => rows.map(row => row.replace(/[^sS]/g, '.'));
const SPIN = { s: 'S', S: 's' };
const DIRS = ['right', 'down', 'left', 'up'];
// Each better bit is a different metal and a different shape, the five columns in front of the body drawn again
// (rows 2 to 13; `h` is the bit's own trim, which does not spin): a STEEL cone; a BRONZE auger behind a brass
// collar; a COBALT fork of two prongs; a GOLD crown of three teeth; a DIAMOND cut in facets that catch the light;
// then, on the longer cone, a VOID needle through a magenta ring, an EMBER cone with swept fins, and a STARMETAL
// cone burning to a star at its point.
const BIT_SHAPES = [
  { 4: 'kk....', 5: 'ksk...', 6: 'kSsk..', 7: 'ksSsk.', 8: 'ksSsk.', 9: 'kSsk..', 10: 'ksk...', 11: 'kk....' },
  { 3: '.k....', 4: 'khk...', 5: 'khsk..', 6: 'khSsk.', 7: 'khsSsk', 8: 'khsSsk', 9: 'khSsk.', 10: 'khsk..', 11: 'khk...', 12: '.k....' },
  { 4: 'kk....', 5: 'kssk..', 6: 'kSsssk', 7: 'ksSkk.', 8: 'ksSkk.', 9: 'kSsssk', 10: 'kssk..', 11: 'kk....' },
  { 3: 'kkkk..', 4: 'ksssk.', 5: 'kSskk.', 6: 'kSsk..', 7: 'ksSssk', 8: 'ksSssk', 9: 'kSsk..', 10: 'kSskk.', 11: 'ksssk.', 12: 'kkkk..' },
  { 3: 'kk....', 4: 'khkk..', 5: 'ksShk.', 6: 'kSshsk', 7: 'ksShSk', 8: 'kSsSsk', 9: 'kSsSk.', 10: 'ksSk..', 11: 'kkk...', 12: '......' },
  { 4: 'kkk...', 5: 'khhk..', 6: 'khSkkk', 7: 'khsSss', 8: 'khSsSs', 9: 'khskkk', 10: 'khhk..', 11: 'kkk...' },
  { 2: '.k....', 3: 'khk...', 4: 'kkhk..', 5: 'ksskk.', 6: 'kSsssk', 7: 'ksSsSs', 8: 'ksSsSs', 9: 'kSsssk', 10: 'ksskk.', 11: 'kkhk..', 12: 'khk...', 13: '.k....' },
  { 4: 'kk....', 5: 'ksskh.', 6: 'kSssh.', 7: 'ksSsRh', 8: 'ksSsRh', 9: 'kSssh.', 10: 'ksskh.', 11: 'kk....' },
];
const bitRows = level => DRILL.map((row, y) => {
  const tip = BIT_SHAPES[level][y];
  return tip ? row.slice(0, 10) + tip : y >= 4 && y <= 11 ? row.slice(0, 11) + '.....' : row;
});
export const BITS = [
  { s: '#eef2f8', S: '#8c96a8' }, { s: '#f4cc94', S: '#b4703a', h: '#ffe8a0' }, { s: '#bfe4ff', S: '#4a86c8' }, { s: '#fff2a0', S: '#e0a020' }, { s: '#e6fffa', S: '#38dcd0', h: '#ffffff' },
  { s: '#e4d4ff', S: '#7a52d8', h: '#ff7ad8' }, { s: '#ffd8c0', S: '#e0482a', h: '#ffb030' }, { s: '#ffffff', S: '#b48cff', h: '#fff6c8' },
];
// From gold on, the bit glows as it bites into hard ground: the same cone in the colours its metal goes hot, laid
// over it (the starmetal goes white).
export const HOT = [null, null, null, { s: '#fff6c8', S: '#ffb060' }, { s: '#ffffff', S: '#ffd84a' }, { s: '#fff0ff', S: '#ff7ad8' }, { s: '#fff6c8', S: '#ff5a2a' }, { s: '#ffffff', S: '#ffffff' }];
const LONG = level => level >= 5;
// The ram bolts on to the body, under it, each level a thing of its own (its top half drawn, rows 0 to 2 and the
// tail's two columns at rows 4 to 7, and turned over for the bottom): RUNNER, a steel rail along the back; FINNED,
// red fins swept back; THRUSTER, taller fins and a pair of nozzles at the tail; TWIN JET, the fins tipped gold and the
// nozzles glowing; AFTERBURNER, ember wings swept back from the tail to the bit, the nozzles ringed hot; and COMET,
// white and blue wings swept forward past the bit, its nozzles lit blue.
const blank = () => Array.from({ length: 16 }, () => Array(16).fill('.'));
const put = (g, y, x0, x1, c) => { for (let x = x0; x <= x1; x++) g[y][x] = c; };
const RAM_HALVES = [
  { top: ['................', '...kkkkk........', '..kPPPPpk.......'] },
  { top: ['..kk............', '..kLkkk.........', '..krLLrkk.......'] },
  { top: ['.kkk............', '.kLLkkk.........', '.krrLLrkk.......'], tail: ['kk', 'kP', 'kp', 'kk'] },
  { top: ['.kkkk...........', '.kyyLkkk........', '.krrrLLrkk......'], tail: ['kk', 'oP', 'op', 'kk'] },
  { top: ['.kkkkkk.........', '.kyyooodkkk.....', '.krrrdddoooddk..'], tail: ['kk', 'yP', 'yd', 'kk'] },
  { top: ['.........kkkk...', '.kkkkkkkkRRBBk..', '.kCcccBBBBBBk...'], tail: ['kk', 'RB', 'Bc', 'kk'] },
];
const RAMS = RAM_HALVES.map(({ top, tail }) => {
  const g = blank();
  top.forEach((row, y) => { for (let x = 0; x < 16; x++) if (row[x] !== '.') { g[y][x] = row[x]; g[15 - y][x] = row[x]; } });
  (tail ?? []).forEach((row, n) => { for (let x = 0; x < 2; x++) { g[4 + n][x] = row[x]; g[11 - n][x] = row[x]; } });
  return g.map(row => row.join(''));
});
// Behind a ram with a thruster burns its exhaust at speed, from two nozzles either side of where the tether leaves
// the tail, so the one is never taken for the other: each plume a hot core along the thruster's edge (`core`, from
// the nozzle back) in a cooler sheath beside it (`sheath`), and from the third a wisp at its root. A longer and
// hotter flame at each level, and blue at the racer's. Drawn one frame behind the drill; its flicker a pixel short.
const FLAMES = [
  { core: ['y', 'o', 'r'], sheath: ['r'] },
  { core: ['W', 'y', 'y', 'o', 'r'], sheath: ['o', 'r', 'r'] },
  { core: ['W', 'W', 'y', 'y', 'o', 'r'], sheath: ['y', 'o', 'o', 'r'], wisp: 'r' },
  { core: ['R', 'R', 'B', 'B', 'c', 'c', 'C'], sheath: ['B', 'c', 'c', 'C', 'C'], wisp: 'C' },
];
const flame = (tier, short) => {
  const g = blank(), { core, sheath, wisp } = FLAMES[tier - 1], cut = short ? 1 : 0;
  for (const [inner, outer, edge] of [[6, 5, 4], [9, 10, 11]]) {
    for (let n = 0; n < core.length - cut; n++) g[inner][15 - n] = core[n];
    for (let n = 0; n < sheath.length - cut; n++) g[outer][15 - n] = sheath[n];
    if (wisp && !short) g[edge][15] = wisp;
  }
  return g.map(row => row.join(''));
};
// The hull's plates are laid over the body, clear of the cockpit's glass, each level a hull of its own: BANDED, a
// steel band behind the bit; TWIN BAND, a second at the tail; FRAMED, a steel rim joining them, riveted at the
// corners; COPPER, the frame clad in copper and riveted all round; COBALT, blue armour with a third band and a plate
// under the belly; GILDED, gunmetal trimmed in gold with gold cheek plates at the bit's root; and AEGIS, white plates
// with a seam of blue light and guards wrapped round the bit's root.
const band = (g, x, top, rest) => { for (let y = 4; y <= 11; y++) g[y][x] = y === 4 ? top : rest; };
const rivets = (g, c, at) => { for (const [x, y] of at) g[y][x] = c; };
const CORNERS4 = [[3, 4], [9, 4], [3, 11], [9, 11]], ROUND = [[9, 6], [9, 9], [3, 6], [3, 9], [6, 4], [6, 11]];
const GLASS = new Set(['4,5', '5,5', '6,5', '4,6', '5,6', '6,6', '4,7', '5,7']);
const shell = (g, top, mid, low) => { for (let y = 4; y <= 11; y++) for (let x = 3; x <= 9; x++) if (!GLASS.has(`${x},${y}`)) g[y][x] = y === 4 ? top : y >= 10 ? low : x === 3 ? top : mid; };
const frame4 = (g, light, dark) => { band(g, 9, light, dark); band(g, 3, light, dark); put(g, 4, 3, 9, light); put(g, 11, 3, 9, dark); };
const PLATES = [1, 2, 3, 4, 5, 6, 7].map(level => {
  const g = blank();
  if (level === 1) band(g, 9, 'P', 'p');
  if (level === 2) { band(g, 9, 'P', 'p'); band(g, 3, 'P', 'p'); }
  if (level === 3) { frame4(g, 'P', 'p'); rivets(g, 'R', CORNERS4); }
  if (level === 4) { frame4(g, 'n', 'N'); rivets(g, 'R', [...CORNERS4, ...ROUND]); }
  // (From COBALT the plates close over the body as a shell, lit along the top and darker under the belly, so the
  // fittings sit on one surface.)
  if (level === 5) { shell(g, 'B', 'C', 'J'); rivets(g, 'B', [[9, 6], [9, 9]]); }
  if (level === 6) {
    shell(g, 'y', 'Q', 'q'); rivets(g, 'y', [[9, 6], [9, 9]]);
    for (const [x, y, c] of [[10, 3, 'k'], [11, 3, 'k'], [10, 4, 'y'], [11, 4, 'y'], [10, 11, 'd'], [11, 11, 'd'], [10, 12, 'k'], [11, 12, 'k']]) g[y][x] = c;
  }
  if (level === 7) {
    shell(g, 'R', 'A', 'B'); put(g, 8, 7, 9, 'c'); g[4][6] = 'c';
    for (const [x, y, c] of [[10, 2, 'k'], [11, 2, 'k'], [12, 2, 'k'], [10, 3, 'R'], [11, 3, 'R'], [12, 3, 'k'], [10, 4, 'B'], [11, 4, 'B'],
      [10, 13, 'k'], [11, 13, 'k'], [12, 13, 'k'], [10, 12, 'B'], [11, 12, 'B'], [12, 12, 'k'], [10, 11, 'C'], [11, 11, 'C']]) g[y][x] = c;
  }
  return g.map(row => row.join(''));
});
// What is fitted to the drill shows on it, each in a place of its own so that a drill with everything fitted is one
// machine and not a heap: the glass at the top left of the body, the mender's lamp under it, the flywheel beside
// that, the capacitor at the top right, the lava skin's keel along the belly, the spore drive's vents in the tail's
// rim, the arc coil's winding between body and bit, the diamond tip's glint at the bit's point (on the longer cone a
// pixel further on); and what CORE builds, the black box's beacon on the roof behind the glass and the lamp's light
// on the brow, a pixel more and brighter a level. At rest each is engraved in the hull, whatever the hull is (`x` a
// shade darker than what is under it, `X` a shade lighter) with a pip or two in the dark of its own colour; it shows
// its colour as it acts, in its lit copy.
const fit = cells => { const g = blank(); for (const [x, y, c] of cells) g[y][x] = c; return g.map(row => row.join('')); };
// The mender: a lamp under the glass, a pip, a bar, a cross, the cross brighter, and last a cross in a frame (lit,
// green and white).
const MENDER_AT = [5, 9], ARMS = [[-1, 0], [1, 0], [0, -1], [0, 1]], CORNERS1 = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
const mender = (centre, bar, arms, corners) => {
  const [x, y] = MENDER_AT, cells = [[x, y, centre]];
  if (bar) cells.push([x - 1, y, bar], [x + 1, y, bar]);
  if (arms) cells.push([x, y - 1, arms], [x, y + 1, arms]);
  if (corners) for (const [u, v] of CORNERS1) cells.push([x + u, y + v, corners]);
  return cells;
};
const MENDERS = [
  [mender('G'), mender('m')],
  [mender('G', 'x'), mender('M', 'm')],
  [mender('G', 'x', 'x'), mender('M', 'm', 'm')],
  [mender('m', 'x', 'x'), mender('R', 'M', 'M')],
  [mender('m', 'x', 'x', 'X'), mender('R', 'M', 'M', 'm')],
];
const lit = (cells, map) => cells.map(([x, y, c]) => [x, y, map[c] ?? c]);
const point = dx => [[14 + dx, 7, 'w'], [14 + dx, 8, 'c'], [13 + dx, 7, 'w'], [13 + dx, 8, 'w']];
const star = dx => [[13 + dx, 6, 'w'], [12 + dx, 7, 'w'], [13 + dx, 7, 'R'], [14 + dx, 7, 'w'], [13 + dx, 8, 'w'], [14 + dx, 8, 'c']];
const LAMPS = [[[9, 3, 'd']], [[8, 3, 'd'], [9, 3, 'y']], [[8, 3, 'y'], [9, 3, 'W']], [[7, 3, 'd'], [8, 3, 'y'], [9, 3, 'W']], [[7, 3, 'y'], [8, 3, 'W'], [9, 3, 'R'], [10, 3, 'W']]];
// The lava skin: a keel along the belly, ember-dark, glowing through as it swims; its bellows a grille of vents in
// the keel and two under it, which blow heat out under it lit.
const KEEL = [3, 4, 5, 6, 7, 8, 9].map(x => [x, 11, x % 2 ? 'x' : 'z']);
const KEEL_LIT = [3, 4, 5, 6, 7, 8, 9].flatMap(x => [[x, 11, 'o'], [x, 12, x % 2 ? 'r' : 'y']]);
const BELLOWS = [3, 4, 5, 6, 7, 8, 9].map(x => [x, 11, x % 2 ? 'x' : 'z']).concat([[4, 12, 'z'], [6, 12, 'z'], [8, 12, 'z']]);
const BELLOWS_LIT = [3, 4, 5, 6, 7, 8, 9].map(x => [x, 11, x % 2 ? 'r' : 'y']).concat([[4, 12, 'y'], [6, 12, 'y'], [8, 12, 'y'], [4, 13, 'o'], [6, 13, 'o'], [8, 13, 'o'], [5, 14, 'r'], [7, 14, 'r']]);
// The spore drive: two vents in the tail's rim, a canister between them at its second level (the graft); lit, they
// puff green out behind.
const VENTS = [[2, 6, 'G'], [2, 9, 'G']];
const VENTS_LIT = [[2, 5, 'g'], [2, 6, 'M'], [2, 9, 'M'], [2, 10, 'g'], [1, 6, 'g'], [1, 9, 'g'], [0, 5, 'M'], [0, 10, 'M']];
const GRAFT = [[3, 7, 'x'], [3, 8, 'Z'], [3, 9, 'G'], [3, 10, 'x']];
// The arc coil: a winding between the body and the bit; its capacitor a small can at the top right of the body,
// which stays lit and sparks while the bit holds its charge.
const COIL = [[10, 5, 'd'], [10, 7, 'd'], [10, 8, 'd'], [10, 10, 'd']];
const COIL_LIT = [[10, 5, 'R'], [10, 6, 'y'], [10, 7, 'R'], [10, 8, 'R'], [10, 9, 'y'], [10, 10, 'R'], [11, 4, 'y'], [11, 11, 'y']];
const CAPACITOR = [[8, 4, 'x'], [9, 4, 'x'], [8, 5, 'x'], [9, 5, 'j']];
const CHARGED = [[8, 4, 'e'], [9, 4, 'v'], [8, 5, 'v'], [9, 5, 'R'], [10, 4, 'y'], [9, 3, 'e']];
// The flywheel: a small spoked wheel set in the body beside the mender, steel and then copper, whose lit frame is
// its rim a step round, so that lit by turns it spins.
const WHEEL_AT = [8, 9], RIM8 = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
const flywheel = (light, dark, hub) => turn => [
  ...RIM8.map(([u, v], n) => [WHEEL_AT[0] + u, WHEEL_AT[1] + v, (n + turn) % 2 ? dark : light]), [WHEEL_AT[0], WHEEL_AT[1], hub],
];
// (At rest its rim is engraved, its hub steel or copper; lit, the rim is its metal and a step round.)
const WHEELS = [[flywheel('X', 'x', 'p'), flywheel('P', 'p', 'k')], [flywheel('X', 'x', 'N'), flywheel('n', 'N', 'o')]];
const FITS = {
  ...Object.fromEntries(MENDERS.flatMap(([plain, shine], n) => [[`mender-${n + 1}`, fit(plain)], [`mender-${n + 1}-b`, fit(shine)]])),
  lavaskin: fit(KEEL), 'lavaskin-b': fit(KEEL_LIT),
  sporedrive: fit(VENTS), 'sporedrive-b': fit(VENTS_LIT),
  arccoil: fit(COIL), 'arccoil-b': fit(COIL_LIT),
  diamond: fit(point(0)), 'diamond-b': fit(star(0)), 'diamond-l': fit(point(1)), 'diamond-l-b': fit(star(1)),
  blackbox: fit([[4, 3, 'z']]), 'blackbox-b': fit([[4, 3, 'L'], [4, 2, 'r']]),
  ...Object.fromEntries(LAMPS.map((cells, n) => [`lamp-${n + 1}`, fit(cells)])),
  'lavaskin-2': fit(BELLOWS), 'lavaskin-2-b': fit(BELLOWS_LIT),
  'sporedrive-2': fit([...VENTS, ...GRAFT]), 'sporedrive-2-b': fit([...VENTS_LIT, ...lit(GRAFT, { G: 'm', m: 'M' })]),
  'arccoil-2': fit([...COIL, ...CAPACITOR]), 'arccoil-2-b': fit([...COIL_LIT, ...CHARGED]),
  ...Object.fromEntries(WHEELS.flatMap(([rest, spin], n) => [[`flywheel-${n + 1}`, fit(rest(0))], [`flywheel-${n + 1}-b`, fit(spin(1))]])),
};
export const drill = {
  version: 1, name: 'drill', width: 16, height: 16,
  palette: { k: '#1c1420', b: '#ffd83a', d: '#e08a1c', c: '#3ab8e8', w: '#eafcff', s: '#eef2f8', S: '#8c96a8', r: '#ff5a3a', y: '#ffe14a', p: '#77829a', P: '#aab4c8', R: '#ffffff', m: '#5cc040', M: '#d8ffb0', g: '#8ce060', o: '#ffb060',
    W: '#fff6c8', B: '#84dcff', C: '#2a7ab8', L: '#ff9a8a', G: '#3a7a2a', v: '#b48cff', V: '#6a4ab8', e: '#e4d4ff', h: '#ffffff', n: '#f0a070', N: '#a8582c', Q: '#5a5470', q: '#38324a',
    x: '#16121c59', X: '#ffffff40', Z: '#2a5a2a', z: '#7a2a1a', j: '#4a2a7a', J: '#1a3a6a', A: '#dfe8f4' },
  symbols: { ...Object.fromEntries(BITS.flatMap((bit, n) => [[`bit${n}`, bitRows(n)], [`hot${n}`, bitOnly(bitRows(n))]])), ...Object.fromEntries(RAMS.map((rows, n) => [`ram${n + 1}`, rows])), ...Object.fromEntries(PLATES.map((rows, n) => [`plate${n + 1}`, rows])),
    ...Object.fromEntries(Object.entries(FITS).map(([id, rows]) => [`fit-${id}`, rows])), ...Object.fromEntries([1, 2, 3, 4].flatMap(t => [[`flame${t}`, flame(t, false)], [`flame${t}-b`, flame(t, true)]])) },
  frames: [
    // (The later bits are only ever drawn facing right.)
    ...BITS.flatMap((bit, level) => (LONG(level) ? ['right'] : DIRS).flatMap((dir, i) => [
      { name: `${dir}-a-${level}`, duration: 70, palette: bit, ops: [{ op: 'stamp', symbol: `bit${level}`, x: 0, y: 0, ...(i && { rotate: i * 90 }) }] },
      { name: `${dir}-b-${level}`, duration: 70, palette: bit, ops: [{ op: 'stamp', symbol: `bit${level}`, x: 0, y: 0, ...(i && { rotate: i * 90 }), remap: SPIN }] },
    ])),
    ...HOT.flatMap((heat, level) => heat ? [
      { name: `right-h-a-${level}`, duration: 70, palette: heat, ops: [{ op: 'stamp', symbol: `hot${level}`, x: 0, y: 0 }] },
      { name: `right-h-b-${level}`, duration: 70, palette: heat, ops: [{ op: 'stamp', symbol: `hot${level}`, x: 0, y: 0, remap: SPIN }] },
    ] : []),
    ...RAMS.flatMap((rows, n) => (n >= 4 ? ['right'] : DIRS).map((dir, i) => ({ name: `ram-${dir}-${n + 1}`, ops: [{ op: 'stamp', symbol: `ram${n + 1}`, x: 0, y: 0, ...(i && { rotate: i * 90 }) }] }))),
    ...PLATES.map((rows, n) => ({ name: `plate-right-${n + 1}`, ops: [{ op: 'stamp', symbol: `plate${n + 1}`, x: 0, y: 0 }] })),
    ...Object.keys(FITS).map(id => ({ name: `fit-${id}`, ops: [{ op: 'stamp', symbol: `fit-${id}`, x: 0, y: 0 }] })),
    ...[1, 2, 3, 4].flatMap(t => [{ name: `flame-${t}-a`, duration: 60, ops: [{ op: 'stamp', symbol: `flame${t}`, x: 0, y: 0 }] }, { name: `flame-${t}-b`, duration: 60, ops: [{ op: 'stamp', symbol: `flame${t}-b`, x: 0, y: 0 }] }]),
  ],
  animations: Object.fromEntries([
    ...BITS.flatMap((bit, level) => (LONG(level) ? ['right'] : DIRS).map(dir => [`${dir}-${level}`, { frames: [`${dir}-a-${level}`, `${dir}-b-${level}`] }])),
    ...HOT.flatMap((heat, level) => heat ? [[`hot-${level}`, { frames: [`right-h-a-${level}`, `right-h-b-${level}`] }]] : []),
    ...[1, 2, 3, 4].map(t => [`flame-${t}`, { frames: [`flame-${t}-a`, `flame-${t}-b`] }]),
  ]),
};

// ------------------------------------------------------------------ the core
// Three cells across: a ring round a lit well, with a socket on each side for what the four directions hide. Each
// level of the winch is a winch of its own, told apart by its shape before its colour: IRON, a plain riveted ring;
// STEEL, with a bolted lug at each corner; GEARED, a bronze cog with lightening holes and an amber well; FROST, ice
// with a spike of crystal at each corner and a snowflake in the well; CRYSTAL, a faceted violet ring with a cluster
// of shards at each corner; MAGMA, basalt split by glowing cracks round a well of lava, with horns of obsidian;
// STORM, a navy ring with a tesla coil at each corner and lightning across it; GRAVITY, a deep purple ring with a
// band in orbit about it and a well that turns; and SINGULARITY, black, a burning disc falling into a well with no
// light in it but its rim, haloed, each of its four sockets lined in the colour of the gem of the direction it
// faces (letters of their own, N S W E, which nothing else of the core is drawn in). Each is drawn a pixel at a
// time from where the pixel lies about the middle, lit from the top left.
export const WINCHES = ['IRON', 'STEEL', 'GEARED', 'FROST', 'CRYSTAL', 'MAGMA', 'STORM', 'GRAVITY', 'SINGULARITY'];
const CC = 23.5, TAU = Math.PI * 2;
// (How far an angle is from the nearest of n spokes, the first at `off`, in radians.)
const spoke = (a, n, off = 0) => { const step = TAU / n; let t = (a - off) / step; t -= Math.round(t); return t * step; };
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// The plain ring every winch is built on: an outline, a lit lip, a groove, an inner lip and the well.
const ringPixel = ({ d, s }) => {
  if (d > 22.6) return null;
  if (d > 21.6) return 'k';
  if (d > 20.4) return s > 0.3 ? 'l' : s < -0.6 ? 'M' : 'm';
  if (d > 16.6) return s < -0.7 ? 'M' : 'm';
  if (d > 15.6) return 'M';
  if (d > 13.6) return s < -0.25 ? 'm' : 'M';
  if (d > 12.6) return 'k';
  if (d > 10.2) return 'D';
  if (d > 7) return 'g';
  if (d > 3.6) return 'G';
  return 'w';
};
const ring = d => d > 12.6 && d <= 21.6;
// A shard standing out from the ring at angle `at`, to a point at `len`, `half` wide where it leaves the ring.
const shard = (p, at, len, half, lit, dark, tip = 'w') => {
  const off = spoke(p.a, 1, at) * p.d;
  if (p.d < 20 || p.d > len) return null;
  const w = half * Math.min(1, (len - p.d) / (len - 21));
  if (Math.abs(off) > w) return null;
  return len - p.d < 1.3 ? tip : off < 0 ? lit : dark;
};
const CORNERS = [1, 3, 5, 7].map(n => n * Math.PI / 4);
const TIERS = [
  // IRON: eight rivets round the ring.
  { palette: { l: '#c8ccd8', m: '#8a90a2', M: '#5a6074', D: '#1e2a44', g: '#2a78c8', G: '#5cc4f0', w: '#eafcff' },
    pixel: p => ring(p.d) && Math.abs(spoke(p.a, 8, Math.PI / 8) * p.d) < 0.8 && Math.abs(p.d - 18.5) < 0.8 ? 'l' : undefined },
  // STEEL: a bolted lug at each corner, standing out of the ring.
  { palette: { l: '#e6f0ff', m: '#8aa4c8', M: '#4e6690', D: '#1a2a4c', g: '#3a8ae0', G: '#8ad4ff', w: '#f0fcff' },
    pixel: p => {
      for (const c of CORNERS) {
        const cx = CC + Math.cos(c) * 19.5, cy = CC + Math.sin(c) * 19.5, ux = Math.abs(p.x - cx), uy = Math.abs(p.y - cy);
        if (ux <= 3.5 && uy <= 3.5) return ux <= 0.5 && uy <= 0.5 ? 'k' : (ux > 2.5 || uy > 2.5) ? 'k' : p.x - cx + p.y - cy < 0 ? 'l' : 'm';
      }
    } },
  // GEARED: a bronze cog, sixteen teeth, eight holes through the ring, an amber well.
  { palette: { l: '#ffd8a0', m: '#c88a4a', M: '#7a4a24', D: '#3a1e0c', g: '#e08a20', G: '#ffd060', w: '#fff6d0' },
    pixel: p => {
      if (p.d > 21.6 && p.d < 25.4 && Math.abs(spoke(p.a, 16, Math.PI / 16) * p.d) < 1.7) return p.s > 0.2 ? 'l' : 'm';
      if (p.d > 16.8 && p.d < 20.2 && Math.abs(spoke(p.a, 8, Math.PI / 8) * p.d) < 1.6) return 'k';
    } },
  // FROST: white ice, a spike of crystal at each corner and a pair of short ones beside it, a snowflake in the well.
  { palette: { l: '#ffffff', m: '#bfe8ff', M: '#6aa8d8', D: '#103a5a', g: '#2ab8e0', G: '#a8f4ff', w: '#ffffff', a: '#e6faff', A: '#7ac8f0' },
    pixel: p => {
      for (const c of CORNERS) {
        const f = shard(p, c, 30.5, 2.4, 'a', 'A') ?? shard(p, c - 0.42, 26, 1.4, 'a', 'A') ?? shard(p, c + 0.42, 26, 1.4, 'a', 'A');
        if (f) return f;
      }
      if (p.d < 9.5 && p.d > 1.5 && Math.abs(spoke(p.a, 6, Math.PI / 2) * p.d) < 0.55) return 'w';
      if (ring(p.d) && p.d > 14 && hash(p.x, p.y) < 0.08) return 'l';
    } },
  // CRYSTAL: twelve facets, a cluster of three shards at each corner, a magenta well.
  { palette: { l: '#f4dcff', m: '#b48cff', M: '#6a3ab8', D: '#3a1050', g: '#c050e0', G: '#ff9aff', w: '#ffffff', a: '#ffc8f4', A: '#d050b8' },
    pixel: p => {
      for (const c of CORNERS) {
        const f = shard(p, c, 31, 2.2, 'a', 'A') ?? shard(p, c - 0.32, 27, 1.6, 'a', 'A') ?? shard(p, c + 0.32, 27, 1.6, 'a', 'A');
        if (f) return f;
      }
      if (ring(p.d) && p.d > 13.6) {
        const facet = Math.floor((p.a + Math.PI) / (TAU / 12)), mid = -Math.PI + (facet + 0.5) * TAU / 12, s = -(Math.cos(mid) + Math.sin(mid)) / Math.SQRT2;
        if (Math.abs(spoke(p.a, 12, -Math.PI) * p.d) < 0.5) return 'M';
        return s > 0.35 ? 'l' : s < -0.45 ? 'M' : 'm';
      }
    } },
  // MAGMA: basalt split by glowing cracks, a hot inner rim, eight horns of obsidian, a well of lava.
  { palette: { l: '#8a7270', m: '#4e3e40', M: '#2c2228', D: '#6a1808', g: '#f04a1a', G: '#ffb030', w: '#fff6c8', a: '#ffd060', A: '#ff6a1a' },
    pixel: p => {
      if (p.d > 21 && p.d < 27.4) { const off = spoke(p.a, 8, Math.PI / 8) * p.d, w = 2.6 * Math.min(1, (27.4 - p.d) / 5); if (Math.abs(off) < w) return 27.4 - p.d < 1.6 ? 'a' : 27.4 - p.d < 2.8 ? 'A' : off < 0 ? 'l' : 'm'; }
      if (ring(p.d) && p.d > 13.6) {
        if (p.d < 14.8) return 'A';
        for (let i = 0; i < 10; i++) {
          const at = i * TAU / 10 + 0.31 + 0.18 * Math.sin(p.d * 1.1 + i * 2.3);
          if (Math.abs(spoke(p.a, 1, at) * p.d) < 0.55) return p.d < 17.5 ? 'a' : 'A';
        }
      }
    } },
  // STORM: navy steel, a tesla coil at each corner with a ball of light on it, a bolt across the ring between.
  { palette: { l: '#c8d4ff', m: '#5a6aa8', M: '#2e3868', D: '#141e5a', g: '#4a7aff', G: '#c0dcff', w: '#ffffff', a: '#fff27a', A: '#d89a2a', c: '#ffffff' },
    pixel: p => {
      for (const c of CORNERS) {
        const off = Math.abs(spoke(p.a, 1, c) * p.d);
        const ball = Math.hypot(p.x - (CC + Math.cos(c) * 28.2), p.y - (CC + Math.sin(c) * 28.2));
        if (ball < 2.7) return ball < 1.2 ? 'c' : 'a';
        if (p.d > 20 && p.d <= 26.5 && off < 2.1) return Math.floor(p.d) % 2 ? 'A' : 'l';
      }
      if (ring(p.d) && p.d > 14.2 && p.d < 20.6) for (let k = 0; k < 4; k++) {
        const at = k * Math.PI / 2 + Math.PI / 4 + 0.32, zig = (Math.floor(p.d) % 4 < 2 ? 0.07 : -0.07) * (k % 2 ? -1 : 1);
        if (Math.abs(spoke(p.a, 1, at + zig) * p.d) < 0.6) return 'a';
      }
    } },
  // GRAVITY: a deep purple ring with a band in orbit about it, tilted, behind it above and before it below; the
  // well turns in two arms.
  { palette: { l: '#c8b8ff', m: '#5a3ca8', M: '#2e1a68', D: '#12062a', g: '#6a2ac8', G: '#c08aff', w: '#ffffff', a: '#f0e4ff', A: '#9a7ae8' },
    pixel: (p, base) => {
      const t = -0.62, u = p.dx * Math.cos(t) + p.dy * Math.sin(t), v = -p.dx * Math.sin(t) + p.dy * Math.cos(t), e = (u / 29.5) ** 2 + (v / 8.5) ** 2;
      if (e > 0.7 && e < 1.0 && (v > 0 || !base || (base === 'k' && p.d > 21.6))) return e > 0.86 ? 'A' : 'a';
      if (p.d < 10.2 && p.d > 3.6) return ((p.a * 2 + p.d * 0.55) % TAU + TAU) % TAU < Math.PI ? 'g' : 'G';
    } },
  // SINGULARITY: a black ring, a disc burning white to red as it falls inward, brighter on the side coming toward
  // us, and a black well with a bright rim; haloed, and crowned in the four gems.
  { palette: { l: '#6a5a8a', m: '#2a2040', M: '#160f24', D: '#000000', g: '#ff8a2a', G: '#ffe08a', w: '#ffffff', a: '#ff4a2a', A: '#a81a3a', c: '#fff0d0', h: '#c8a8ff' },
    pixel: p => {
      if (p.d > 22.9 && p.d < 23.9) return 'h';
      if (p.d <= 12.6) return p.d > 11.4 ? 'c' : 'D';
      if (p.d > 12.6 && p.d < 19.4) {
        const swirl = Math.sin(p.a * 3 - p.d * 0.9) * 0.9, hot = p.d + swirl - (p.dx < 0 ? 1.2 : -0.4);
        return hot < 14.2 ? 'w' : hot < 15.6 ? 'G' : hot < 17 ? 'g' : hot < 18.4 ? 'a' : 'A';
      }
    } },
];
const SOCKETS = [[20, 1, 'N'], [20, 39, 'S'], [1, 20, 'W'], [39, 20, 'E']];
const coreRows = level => {
  const tier = TIERS[level], g = [];
  for (let y = 0; y < 48; y++) {
    const row = [];
    for (let x = 0; x < 48; x++) {
      const dx = x - CC, dy = y - CC, d = Math.hypot(dx, dy), p = { x, y, dx, dy, d, a: Math.atan2(dy, dx), s: d ? -(dx + dy) / (d * Math.SQRT2) : 0 };
      const base = ringPixel(p), own = tier.pixel(p, base);
      row.push(own ?? base ?? '.');
    }
    g.push(row);
  }
  // The sockets, lined with the crown's gems at the last.
  for (const [sx, sy, gem] of SOCKETS) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const edge = x === 0 || y === 0 || x === 7 || y === 7, rim = x === 1 || y === 1 || x === 6 || y === 6;
    g[sy + y][sx + x] = edge ? 'k' : rim ? (x + y < 7 ? 'm' : 'M') : level === 8 ? gem : 'D';
  }
  // A glint on the well, and an outline round whatever stands out of the ring.
  if (level < 8) g[19][19] = 'w';
  const solid = c => c !== '.' && c !== 'h' && c !== 'k';
  const out = g.map(row => [...row]);
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if (g[y][x] === '.' || g[y][x] === 'h') {
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([u, v]) => solid(g[y + v]?.[x + u] ?? '.'))) out[y][x] = 'k';
  }
  return out.map(row => row.join(''));
};
// The well's glow: breathing in and out, and a flash as something is fitted.
const mix = (a, b, t) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('');
const glows = ({ D, g, G, w }) => ({ a: {}, b: { g: mix(g, G, 0.4), G: mix(G, w, 0.4) }, c: { g: mix(g, G, 0.7), G: mix(G, w, 0.7), D: mix(D, g, 0.3) },
  flash: { g: mix(G, '#ffffff', 0.6), G: '#ffffff', D: mix(D, g, 0.7) } });
export const HULLS = TIERS.map(t => t.palette);
export const core = {
  version: 1, name: 'core', width: 48, height: 48,
  palette: { k: '#16121c', l: '#c8ccd8', m: '#8a90a2', M: '#5a6074', D: '#1e2a44', g: '#2a78c8', G: '#5cc4f0', w: '#eafcff', a: '#ffffff', A: '#888888', c: '#ffffff', h: '#9af0d8',
    N: '#bfe6ff', S: '#ffb060', W: '#b8f06a', E: '#d8b8ff' },
  frames: TIERS.flatMap((tier, level) => {
    const rows = coreRows(level);
    return Object.entries(glows(tier.palette)).map(([glow, lit]) => ({
      name: `core-${glow}-${level}`, duration: glow === 'flash' ? 80 : 260, palette: { ...tier.palette, ...lit }, ops: [{ op: 'grid', x: 0, y: 0, rows }],
    }));
  }),
  animations: Object.fromEntries(TIERS.map((tier, level) => [`idle-${level}`, { frames: [`core-a-${level}`, `core-b-${level}`, `core-c-${level}`, `core-b-${level}`] }])),
};

// The scanner stands on the station's shoulder, each level a scanner of its own, and named so: a ROD, a whip of an
// aerial with a teal tip; a YAGI, a mast of three crossbars; a DISH, a small teal bowl; a BIG DISH, a wide bowl with
// its feed held over it on struts; an ARRAY, a flat panel of teal cells; a RADAR, a long bar on its mast with a
// beacon over it; and a DEEP EYE, a violet orb ringed in teal on a tripod. (Its top is at the middle of the frame's
// top, where the beam and the pings come from: js/fit.js, `PART_AT`.) The second frame of each blinks its lights.
const DISH = { k: '#16121c', s: '#8a90a2', S: '#c8ccd8', l: '#e6fffa', c: '#5fe0d0', C: '#2a9a9a', r: '#ff5a4a', w: '#ffffff', v: '#b48cff', V: '#6a3ab8', p: '#ffc8ff' };
const SCANNERS = [
  ['................', '................', '................', '........c.......', '........s.......', '........s.......', '........s.......', '........s.......',
    '........s.......', '........s.......', '........s.......', '........s.......', '........s.......', '........s.......', '........s.......', '.......sss......'],
  ['................', '................', '........c.......', '.......SSS......', '........s.......', '........s.......', '......SSSSS.....', '........s.......',
    '........s.......', '.....SSSSSSS....', '........s.......', '........s.......', '........s.......', '........s.......', '........s.......', '.......sss......'],
  ['................', '................', '................', '................', '................', '......l...l.....', '......lCwCl.....', '.......ccc......',
    '........s.......', '........s.......', '........s.......', '........s.......', '........s.......', '........s.......', '........s.......', '.......sss......'],
  ['................', '........w.......', '.......S.S......', '......S...S.....', '....lS.....Sl...', '....lCCCCCCCl...', '.....ccccccc....', '......cccc......',
    '........s.......', '........s.......', '........s.......', '........s.......', '........s.......', '........s.......', '.......sss......', '......sssss.....'],
  ['................', '.....SSSSSSS....', '.....SccCccS....', '.....ScCcCcS....', '.....SccCccS....', '.....ScCcCcS....', '.....SSSSSSS....', '........s.......',
    '........s.......', '.......sss......', '........s.......', '........s.......', '........s.......', '........s.......', '.......sss......', '......sssss.....'],
  ['........r.......', '........s.......', '..SSSSSSSSSSSS..', '..CcccccccccC...', '..ssssssssssss..', '........s.......', '.......sss......', '........s.......',
    '........s.......', '........s.......', '.......sss......', '........s.......', '........s.......', '........s.......', '.......sss......', '......sssss.....'],
  ['........r.......', '......vvv.......', '..cc.vpwpv.cc...', '....cVvpvVc.....', '.....VVvVV......', '......VVV.......', '.......s........', '.......s........',
    '......sss.......', '......s.s.......', '.....s...s......', '.....s...s......', '....s.....s.....', '....s.....s.....', '...s.......s....', '..ss.......ss...'],
];
// (The DEEP EYE is drawn a pixel left of the rest; it is moved back so that its orb is over the mast's foot.)
const dishOps = level => [{ op: 'grid', x: level === 6 ? 1 : 0, y: 0, rows: SCANNERS[level] }, { op: 'outline', color: 'k', position: 'outside' }];
export const dish = {
  version: 1, name: 'dish', width: 16, height: 16,
  palette: DISH,
  frames: [0, 1, 2, 3, 4, 5, 6].flatMap(level => {
    const ops = dishOps(level);
    return [{ name: `dish-${level}`, duration: 500, ops }, { name: `dish-${level}-b`, duration: 160, ops, palette: { w: '#5fe0d0', c: '#a8fff4', r: '#ffffff' } }];
  }),
  animations: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(level => [`dish-${level}`, { frames: [`dish-${level}`, `dish-${level}-b`] }])),
};

// What CORE builds on the station, on a sheet of 64 x 64 laid over the core with the core's 48 in its middle (so
// the core's own pixel (x, y) is this sheet's (x + 8, y + 8)), in the corners the core, its teeth, its sockets and
// the dish leave clear: the refinery's stacks at the top left, the gem cutter's wheel and rack at the bottom right,
// the black box at the bottom left. Each level of each is a picture of its own: the refinery a stack, banded, two,
// both banded, a crucible across their feet, a third, all gilt; the cutter a bare wheel, a violet stone on it, then
// one cut stone more on the rack a level (north's, south's, west's, east's), the last glinting each in turn; the
// black box small, with a mast, armoured, and both. Besides: `well`, a soft disc for the glows over the core's well,
// and `flare`, the streak and star of the lamp's flare, both white, to be tinted.
// Every part has a colour of its own, so the station reads as so many machines and not one grey heap, and each is
// outlined and lit from the top left as the core is: the refinery copper with gold bands, the cutter violet, the
// black box charcoal under yellow and black stripes, the live catch's jaws green on a steel arm, the trophy line's
// rail and barbs bone with red points (gold at the last), and the dish (its own sheet) teal.
const box = (x, y, w, h, color) => ({ op: 'rect', x, y, w, h, color, filled: true });
const stack = (x, top, foot, w, band) => [
  box(x - 1, top - 1, w + 2, foot - top + 2, 'k'), box(x, top, w, foot - top, 'P'), box(x, top, 1, foot - top, 'p'),
  ...(w >= 3 ? [box(x + w - 1, top, 1, foot - top, 'q')] : []), box(x, top, w, 1, 'o'), ...(band ? [box(x, top + 3, w, 1, band)] : []),
];
// (The stacks' pipe runs under them, between the core's top tooth and its corner tooth, into the ring.)
const pipe = [box(8, 11, 15, 3, 'k'), box(8, 12, 15, 1, 'P')];
const REFINERY = [
  [...pipe, ...stack(5, 6, 15, 3)],
  [...pipe, ...stack(5, 6, 15, 3, 'y')],
  [...pipe, ...stack(5, 6, 15, 3, 'y'), ...stack(10, 3, 13, 2)],
  [...pipe, ...stack(5, 6, 15, 3, 'y'), ...stack(10, 3, 13, 2, 'y')],
  [...pipe, ...stack(5, 6, 15, 3, 'y'), ...stack(10, 3, 13, 2, 'y'), box(3, 15, 11, 2, 'k'), box(4, 15, 9, 1, 'O')],
  [...pipe, ...stack(5, 6, 15, 3, 'y'), ...stack(10, 3, 13, 2, 'y'), ...stack(1, 10, 16, 2), box(1, 16, 12, 2, 'k'), box(2, 16, 11, 1, 'O')],
  [...pipe, ...stack(5, 6, 15, 3, 'o'), ...stack(10, 3, 13, 2, 'o'), ...stack(1, 10, 16, 2, 'o'), box(1, 16, 12, 2, 'k'), box(2, 16, 11, 1, 'o')],
];
// Where each level's mouths are, on the sheet, for the smoke and the gold they throw.
export const REFINERY_MOUTHS = [[], [6, 5], [6, 5], [6, 5, 11, 2], [6, 5, 11, 2], [6, 5, 11, 2], [6, 5, 11, 2, 2, 9], [6, 5, 11, 2, 2, 9]];
// (The cutter's wheel stands clear of the core's tooth at the bottom right; its stones hang on a rack beside it.)
const STONES = [['n', 60, 51], ['u', 60, 54], ['v', 60, 57], ['e', 60, 60]];
const wheel = [box(49, 50, 8, 8, 'k'), box(50, 51, 6, 6, 'I'), box(49, 52, 8, 4, 'I'), box(50, 52, 6, 4, 'j'), box(50, 51, 2, 1, 'i'), box(49, 52, 1, 2, 'i'), box(52, 53, 2, 2, 'i'),
  box(51, 58, 4, 4, 'k'), box(52, 58, 2, 3, 'I'), box(49, 61, 8, 2, 'k'), box(50, 61, 6, 1, 'j')];
const cut = [box(53, 48, 3, 2, 'k'), box(54, 48, 1, 1, 'e')];
const rack = [box(62, 49, 2, 14, 'k'), box(62, 49, 1, 13, 'I')];
const gem = ([color, x, y], glint) => [box(x - 1, y - 1, 3, 2, 'k'), box(x, y - 1, 1, 1, glint ? 'w' : color), box(x - 1, y, 3, 1, color)];
const CUTTER = [wheel, [...wheel, ...cut], ...[1, 2, 3].map(n => [...wheel, ...cut, ...rack, ...STONES.slice(0, n).flatMap(s => gem(s))])];
// The black box: charcoal, lit along its top, with a band of yellow and black across it and a red lamp; the armoured
// box is bigger, its band a chevron.
const SMALL_BOX = ['kkkkkkkk', 'kBBBBBBk', 'kBbbbbbk', 'kBbbbrbk', 'kykykykk', 'kbbbbbbk', 'kkkkkkkk'];
const BIG_BOX = ['kkkkkkkkkk', 'kBBBBBBBBk', 'kBbbbbbbbk', 'kBbbbbbbbk', 'kBbbbbrbbk', 'kBbbbbbbbk', 'kyykkyykkk', 'kykkyykkyk', 'kkkkkkkkkk'];
const mast = (x, top) => [box(x - 1, top + 1, 3, 51 - top, 'k'), box(x, top + 1, 1, 50 - top, 'l'), box(x - 1, top - 1, 3, 3, 'k'), box(x, top, 1, 1, 'r')];
const BOXES = [
  [{ op: 'grid', x: 3, y: 52, rows: SMALL_BOX }],
  [...mast(5, 47), { op: 'grid', x: 3, y: 52, rows: SMALL_BOX }],
  [{ op: 'grid', x: 2, y: 51, rows: BIG_BOX }],
  [...mast(4, 46), { op: 'grid', x: 2, y: 51, rows: BIG_BOX.map((row, y) => y === 3 ? 'kBbrbbbbbk' : row) }],
];
// Where each level's lamps are, on the sheet, for the light they blink.
export const BOX_LAMPS = [[], [8, 55], [8, 55, 5, 47], [8, 55], [8, 55, 5, 54, 4, 46]];
// The live catch is a clamp held out from the core's east socket on a steel arm, at the middle of the right edge,
// that grows a green jaw a level: a hook, then a pair of jaws, then (the late game's) a third prong between them; the
// tip of each jaw lights as a rare hazard is hauled in awake. The trophy line is a rack of bone slung under the core
// between two posts, with barbs hung on it, two, four, then (the late game's) six round a plate of gold; each barb's
// red point lights as a foe is caught.
const JAW = ['.........', '..kkkkkk.', '..kffffFk', '..kfkkkFk', '..kfk.kvk', '..kfk..k.', '..kfk....', '..kfk....', 'kkkFk....'];
const ARM = ['lllMk....', 'MMMMk....'], PRONG = ['lllMfffvk', 'MMMMFFFvk'];
const CLAMPS = [
  [...JAW, ...ARM, 'kkkkk....'],
  [...JAW, ...ARM, ...[...JAW].reverse()],
  [...JAW.slice(0, 8), 'kkkFkkkkk', ...PRONG, 'kkkFkkkkk', ...JAW.slice(0, 8).reverse()],
].map(rows => [{ op: 'grid', x: 55, y: 22, rows }]);
const post = x => [box(x - 1, 48, 3, 10, 'k'), box(x, 49, 1, 8, 't')];
const rail = [...post(16), ...post(47), box(14, 56, 36, 4, 'k'), box(15, 57, 34, 1, 't'), box(15, 58, 34, 1, 'T')];
const barb = (x, tip) => [{ op: 'grid', x: x - 1, y: 59, rows: ['kTk', 'tTt', 'k' + tip + 'k', '.' + tip + '.'] }];
const BARBS = [[21, 42], [19, 24, 39, 44], [18, 22, 26, 37, 41, 45]];
const RACKS = BARBS.map((xs, n) => [...rail, ...xs.flatMap(x => barb(x, n === 2 ? 'o' : 'r')), ...(n === 2 ? [box(29, 59, 6, 5, 'k'), box(30, 60, 4, 3, 'o'), box(31, 60, 1, 1, 'w')] : [])]);
const well = [{ op: 'ellipse', x: 20, y: 20, w: 24, h: 24, color: 'a', filled: true }, { op: 'ellipse', x: 24, y: 24, w: 16, h: 16, color: 'A', filled: true },
  { op: 'ellipse', x: 27, y: 27, w: 10, h: 10, color: 'Z', filled: true }, { op: 'ellipse', x: 30, y: 30, w: 4, h: 4, color: 'R', filled: true }];
const flare = [
  { op: 'line', x: 6, y: 32, x2: 58, y2: 32, color: 'a' }, { op: 'line', x: 16, y: 32, x2: 48, y2: 32, color: 'A' }, { op: 'line', x: 25, y: 32, x2: 39, y2: 32, color: 'Z' },
  { op: 'line', x: 32, y: 27, x2: 32, y2: 37, color: 'A' }, { op: 'line', x: 32, y: 30, x2: 32, y2: 34, color: 'Z' },
  { op: 'pixel', x: 30, y: 30, color: 'a' }, { op: 'pixel', x: 34, y: 30, color: 'a' }, { op: 'pixel', x: 30, y: 34, color: 'a' }, { op: 'pixel', x: 34, y: 34, color: 'a' },
  box(31, 31, 3, 3, 'Z'), { op: 'pixel', x: 32, y: 32, color: 'R' },
];
export const station = {
  version: 1, name: 'station', width: 64, height: 64,
  palette: { k: '#16121c', l: '#c8ccd8', m: '#8a90a2', M: '#5a6074', o: '#ffd84a', y: '#ffe14a', O: '#ffb060', r: '#ff5a4a', x: '#1c1420', w: '#ffffff',
    n: '#bfe6ff', u: '#ffb060', v: '#b8f06a', e: '#d8b8ff', a: '#ffffff30', A: '#ffffff60', Z: '#ffffffa0', R: '#ffffff',
    p: '#f4a070', P: '#c0603a', q: '#7a3422', i: '#d4b4ff', I: '#8a5ad8', j: '#46287e', b: '#3c3648', B: '#6a6480', f: '#9ae860', F: '#3a9a3a', t: '#f0e4c8', T: '#a08a68' },
  frames: [
    ...REFINERY.map((ops, n) => ({ name: `refinery-${n + 1}`, ops })),
    ...CUTTER.slice(0, 5).map((ops, n) => ({ name: `cutter-${n + 1}`, ops })),
    ...STONES.map((s, n) => ({ name: `cutter-6-${'abcd'[n]}`, duration: 300, ops: [...wheel, ...cut, ...rack, ...STONES.flatMap(t => gem(t, t === s))] })),
    ...BOXES.flatMap((ops, n) => [{ name: `blackbox-${n + 1}`, ops }, { name: `blackbox-${n + 1}-b`, ops, palette: { r: '#ff9a8a' } }]),
    { name: 'well', ops: well },
    { name: 'flare', ops: flare },
    ...CLAMPS.map((ops, n) => ({ name: `livecatch-${n + 1}`, ops })),
    ...RACKS.map((ops, n) => ({ name: `trophy-${n + 1}`, ops })),
  ],
  animations: { 'cutter-6': { frames: ['cutter-6-a', 'cutter-6-b', 'cutter-6-c', 'cutter-6-d'] } },
};

// ------------------------------------------------------------------ icons
const icon = (name, rows, size) => ({ name, ops: [{ op: 'grid', x: 1, y: 1, rows }, { op: 'outline', color: 'k', position: 'outside' }], size });
const icons8 = {
  frost: ['...w....', '.w.w.w..', '..wiw...', 'wwiiiww.', '..wiw...', '.w.w.w..', '...w....', '........'],
  ember: ['...o....', '..oo....', '..oyo.o.', '.oyyooo.', '.oyWyyo.', '.oyWWyo.', '..oyyo..', '........'],
  mire: ['..gg....', '.gggg.g.', '.gGgggg.', '..gGgg..', '...s....', '...s....', '..ss....', '........'],
  lode: ['...p....', '..pqp...', '..pqP...', '.pqqPP..', '.pqPPP..', '..pPP...', '...P....', '........'],
  bolt: ['....zz..', '...zz...', '..zz....', '.zzzzz..', '...zz...', '..zz....', '.zz.....', '........'],
  lock: ['..sss...', '.s...s..', '.s...s..', 'zzzzzzz.', 'zzzkzzz.', 'zzzkzzz.', 'zzzzzzz.', '........'],
  home: ['...w....', '..www...', '.wwwww..', 'wwwwwww.', '.wwwww..', '.ww.ww..', '.ww.ww..', '........'],
  check: ['........', '......g.', '.....gg.', 'g...gg..', 'gg.gg...', '.ggg....', '..g.....', '........'],
  grit: ['........', '..ddd...', '.dllld..', 'dlllddd.', 'dlldddD.', '.ddDDD..', '........', '........'],
  tether: ['.yy.....', 'y..y....', 'y..y....', '.yy.y...', '....y...', '....y.y.', '.....y..', '........'],
  // The lab: a flask, for what has been analysed.
  lab: ['..www...', '..wiw...', '..wiw...', '.wiiiw..', '.wgggw..', 'wgggggw.', '.wwwww..', '........'],
};
// (One stone for every corner, cut along the diagonal: `a` and `c` the half toward the first direction going round
// with the sun, light and dark, `e` and `f` the half toward the second, and a white glint on the cut.)
const CORNER_STONE = Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => {
  if (Math.hypot(x - 3.5, y - 3.5) > 3.9) return '.';
  const side = x + y;
  return side === 7 ? 'w' : side < 7 ? (x + 2 * y > 9 ? 'c' : 'a') : (2 * x + y > 15 ? 'f' : 'e');
}).join(''));
const GEM_CUTS = [
  ['ne', '#5a8cff', '#a8c4ff', '#2a4ab8', ['...w....', '..wac...', '..wbc...', '.wbbac..', '.wbbac..', 'wbbbacc.', 'accccccc', '........']],
  ['se', '#f2346c', '#ff9ab4', '#a01840', ['........', '.awbbba.', 'awbbbaac', 'aaaaaccc', '.aaaacc.', '..aacc..', '...ac...', '........']],
  ['sw', '#aaa6bc', '#dcdae8', '#5c586e', ['...bb...', '.bbwbbb.', 'abbbbbbc', 'aaabbccc', 'aaaacccc', 'aaaacccc', '.aaaccc.', '...ac...']],
  ['nw', '#2ed060', '#9cf2b0', '#12803a', ['...ab...', '..awbc..', '..awbc..', '..abbc..', '..abbc..', '..abbc..', '..abcc..', '...cc...']],
];
const SPECIMEN = ['..aaa...','.abaac..', 'abaaaac.', 'aaaaacc.', 'aaaaccc.', '.aaccc..', '..ccc...', '........'];
export const icons = {
  version: 1, name: 'icons', width: 10, height: 10,
  palette: { k: '#16121c', w: '#ffffff', i: '#bfe6ff', o: '#ff7a1c', y: '#ffd84a', W: '#fff6c8', g: '#8ce060', G: '#4aa040', s: '#d8d0c0',
    p: '#d8b8ff', q: '#ffffff', P: '#8a5ad8', z: '#ffe14a', d: '#9a8a74', l: '#d4c4a8', D: '#6a5c4c', a: '#bfe6ff', b: '#ffffff', c: '#5a9ad8', e: '#d8b8ff', f: '#8a5ad8' },
  frames: [
    ...Object.entries(icons8).map(([name, rows]) => ({ name, ops: [{ op: 'grid', x: 1, y: 1, rows }, { op: 'outline', color: 'k', position: 'outside' }] })),
    // A specimen: a cut stone, six-sided, in the colour of the direction it was found in (north, south, west,
    // east, as the gems are). One drawing, each frame with its own three colours.
    ...[['frost', '#bfe6ff', '#ffffff', '#5a9ad8'], ['ember', '#ffb060', '#fff6c8', '#c8501c'], ['mire', '#b8f06a', '#f4ffd8', '#4aa040'], ['lode', '#d8b8ff', '#ffffff', '#8a5ad8']]
      .map(([name, a, b, c]) => ({ name: `spec-${name}`, palette: { a, b, c }, ops: [{ op: 'grid', x: 1, y: 1, rows: SPECIMEN }, { op: 'outline', color: 'k', position: 'outside' }] })),
    // A corner, where two directions meet, for its part of the lab's list: a stone cut in two, each half in the
    // colours of one of the two directions, as the corner's own ground is made of both.
    ...[['ne', '#bfe6ff', '#5a9ad8', '#d8b8ff', '#8a5ad8'], ['se', '#d8b8ff', '#8a5ad8', '#ffb060', '#c8501c'], ['sw', '#ffb060', '#c8501c', '#b8f06a', '#4aa040'],
      ['nw', '#b8f06a', '#4aa040', '#bfe6ff', '#5a9ad8']]
      .map(([name, a, c, e, f]) => ({ name: `corner-${name}`, palette: { a, c, e, f }, ops: [{ op: 'grid', x: 1, y: 1, rows: CORNER_STONE }, { op: 'outline', color: 'k', position: 'outside' }] })),
    // A corner's own gem, which only its deep seam and its shrine pay: each cut its own way and none round, so that
    // none is taken for a specimen, in its own colour (`a`) with its light (`b`) and its shade (`c`). The north-east's
    // a trillion of blue, the south-east's a brilliant of crimson seen side on, the south-west's a cube of hematite,
    // the north-west's an emerald's column.
    ...GEM_CUTS.map(([name, a, b, c, rows]) => ({ name: `gem-${name}`, palette: { a, b, c }, ops: [{ op: 'grid', x: 1, y: 1, rows }, { op: 'outline', color: 'k', position: 'outside' }] })),
  ],
};

const up12 = {
  string: [
    '....kkkk....',
    '..kkyyyykk..',
    '.kyykkkkyyk.',
    '.kykyyyykyk.',
    'kykykkkkykyk',
    'kykyk..kykyk',
    'kykyk..kykyk',
    'kykykkkkykyk',
    '.kykyyyykyk.',
    '.kyykkkkyyk.',
    '..kkyyyykk..',
    '....kkkk....',
  ],
  drill: [
    '..kkkkkkkk..',
    '..kbbbbbbk..',
    '..kkkkkkkk..',
    '..kssSsssk..',
    '...ksSssk...',
    '...kSsssk...',
    '....ksSk....',
    '....kSsk....',
    '.....kk.....',
    '.....kk.....',
    '............',
    '............',
  ],
  battery: [
    '....kkkk....',
    '....kbbk....',
    '..kkkkkkkk..',
    '..kggggggk..',
    '..kgggwggk..',
    '..kggwwggk..',
    '..kgwwwwgk..',
    '..kggwwggk..',
    '..kggwgggk..',
    '..kggggggk..',
    '..kkkkkkkk..',
    '............',
  ],
  scanner: [
    '...kkkkkk...',
    '..kCCCCCCk..',
    '.kCCCCCcCCk.',
    'kCCCCCcCCCCk',
    'kCCCCccCCCCk',
    'kCCCCwcCCCCk',
    'kCCCCCCCCCCk',
    'kCCcCCCCCCCk',
    '.kCCCCCCCCk.',
    '..kCCCCCCk..',
    '...kkkkkk...',
    '............',
  ],
  winch: [
    '....kkkk....',
    '...kyyyyk...',
    '...kykkyk...',
    '...kyyyyk...',
    '....kyyk....',
    '....kssk....',
    '..k.kssk....',
    '.ksk.kssk...',
    '.kssk.ksk...',
    '.ksssksssk..',
    '..ksssssk...',
    '...kkkkk....',
  ],
  momentum: [
    '............',
    '.kk...kk....',
    '.kok..kok...',
    '..kok..kok..',
    '...kok..kok.',
    '....kok..kok',
    '....kok..kok',
    '...kok..kok.',
    '..kok..kok..',
    '.kok..kok...',
    '.kk...kk....',
    '............',
  ],
  shield: [
    '.kkkkkkkkkk.',
    '.kccccCCCCk.',
    '.kccccCCCCk.',
    '.kcwccCCCCk.',
    '.kccccCCCCk.',
    '.kccccCCCCk.',
    '..kcccCCCk..',
    '..kcccCCCk..',
    '...kccCCk...',
    '....kcCk....',
    '.....kk.....',
    '............',
  ],
  bomb: [
    '.......k.w..',
    '......k.y...',
    '.....kk.....',
    '...kkkkkk...',
    '..kddddddk..',
    '.kddwddddDk.',
    '.kdwdddddDk.',
    '.kdddddddDk.',
    '.kddddddDDk.',
    '..kdddDDDk..',
    '...kkkkkk...',
    '............',
  ],
};
export const upgrades = {
  version: 1, name: 'upgrades', width: 12, height: 12,
  palette: { k: '#16121c', y: '#e8c070', b: '#f0a838', s: '#d4dae4', S: '#7e8898', g: '#3aa040', w: '#ffe14a', C: '#1e5a6a', c: '#5fe0d0', o: '#ff8a2a',
    d: '#4a4a5a', D: '#2e2e3a' },
  frames: Object.entries(up12).map(([name, rows]) => ({ name, ops: [{ op: 'grid', x: 0, y: 0, rows }] })),
};

// ------------------------------------------------------------------ interface
// 9-slices: the panel keeps 6 px margins, the button 5.
const panelOps = (w, h) => [
  { op: 'rect', x: 1, y: 0, w: w - 2, h, color: 'k', filled: true },
  { op: 'rect', x: 0, y: 1, w, h: h - 2, color: 'k', filled: true },
  { op: 'rect', x: 1, y: 1, w: w - 2, h: h - 2, color: 'b', filled: true },
  { op: 'rect', x: 2, y: 2, w: w - 4, h: h - 4, color: 'f', filled: true },
  { op: 'rect', x: 2, y: 2, w: w - 4, h: 1, color: 'h', filled: true },
  { op: 'rect', x: 2, y: h - 3, w: w - 4, h: 1, color: 'd', filled: true },
];
export const ui = {
  version: 1, name: 'ui', width: 16, height: 16,
  palette: { k: '#0c0a12', b: '#5a6074', f: '#1c1a28', h: '#2a2838', d: '#141220', w: '#ffffff', y: '#ffe14a', r: '#ff5a4a', c: '#5cc4f0', g: '#8ce060' },
  symbols: {
    hand: [
      '......kk........',
      '.....kwwk.......',
      '.....kwwk.......',
      '.....kwwk.......',
      '.....kwwkkk.....',
      '.....kwwkwwkk...',
      '..kk.kwwkwwkwk..',
      '.kwwkkwwwwwwwwk.',
      '.kwwwkwwwwwwwwk.',
      '..kwwwwwwwwwwwk.',
      '...kwwwwwwwwwwk.',
      '...kwwwwwwwwwk..',
      '....kwwwwwwwwk..',
      '.....kwwwwwwk...',
      '.....kkkkkkkk...',
      '................',
    ],
    recall: [
      '................',
      '.......kk.......',
      '......kwwk......',
      '.....kwwwwk.....',
      '....kwwwwwwk....',
      '...kwwwwwwwwk...',
      '..kwwwwwwwwwwk..',
      '.kkkwwwwwwwwkkk.',
      '...kwwwwwwwwk...',
      '...kwwwkkwwwk...',
      '...kwwwkkwwwk...',
      '...kwwwkkwwwk...',
      '...kkkkkkkkkk...',
      '................',
      '................',
      '................',
    ],
    sound: [
      '................',
      '................',
      '.......kk.......',
      '......kwk..k....',
      '.kkkkkwwk.kwk...',
      '.kwwwwwwk..kwk..',
      '.kwwwwwwk.k.kwk.',
      '.kwwwwwwk.kw.kwk',
      '.kwwwwwwk.kw.kwk',
      '.kwwwwwwk.k.kwk.',
      '.kwwwwwwk..kwk..',
      '.kkkkkwwk.kwk...',
      '......kwk..k....',
      '.......kk.......',
      '................',
      '................',
    ],
    mute: [
      '................',
      '................',
      '.......kk.......',
      '......kwk.......',
      '.kkkkkwwk.k...k.',
      '.kwwwwwwkkrk.krk',
      '.kwwwwwwk.krkrk.',
      '.kwwwwwwk..krk..',
      '.kwwwwwwk.krkrk.',
      '.kwwwwwwkkrk.krk',
      '.kwwwwwwk.k...k.',
      '.kkkkkwwk.......',
      '......kwk.......',
      '.......kk.......',
      '................',
      '................',
    ],
  },
  frames: [
    { name: 'panel', ops: panelOps(16, 16) },
    { name: 'button', ops: panelOps(16, 16), palette: { b: '#8ce060', f: '#2a6a34', h: '#3a8a44', d: '#1e4a26' } },
    { name: 'button-down', ops: panelOps(16, 16), palette: { b: '#c8f4a0', f: '#3a8a44', h: '#2a6a34', d: '#2a6a34' } },
    { name: 'button-off', ops: panelOps(16, 16), palette: { b: '#4a4a5a', f: '#22212c', h: '#2a2838', d: '#1a1924' } },
    { name: 'button-max', ops: panelOps(16, 16), palette: { b: '#e8c070', f: '#5a4420', h: '#6e5630', d: '#3a2c14' } },
    { name: 'hand', ops: [{ op: 'stamp', symbol: 'hand', x: 0, y: 0 }] },
    { name: 'recall', ops: [{ op: 'stamp', symbol: 'recall', x: 0, y: 0 }] },
    { name: 'sound', ops: [{ op: 'stamp', symbol: 'sound', x: 0, y: 0 }] },
    { name: 'mute', ops: [{ op: 'stamp', symbol: 'mute', x: 0, y: 0 }] },
  ],
};

export const logo = {
  version: 1, name: 'logo', width: 132, height: 24,
  palette: { k: '#16121c', y: '#ffe14a', o: '#f0a838', s: '#00000080' },
  frames: [{ name: 'logo', layers: [
    { name: 'shadow', ops: [{ op: 'text', x: 67, y: 6, text: 'TETHERBORE', color: 'k', scale: 2, align: 'center' }, { op: 'outline', color: 'k', position: 'outside' }] },
    { name: 'face', ops: [{ op: 'text', x: 66, y: 4, text: 'TETHERBORE', color: 'y', scale: 2, align: 'center' }, { op: 'outline', color: 'k', position: 'outside' }] },
  ] }],
};

// Ground that takes longer to cut wears armour: a riveted plate on slate, a doubled one with a boss on ancient stone.
const plate = [
  { op: 'rect', x: 2, y: 2, w: 12, h: 12, color: 'k' },
  { op: 'rect', x: 3, y: 3, w: 10, h: 1, color: 'l', filled: true },
  { op: 'rect', x: 3, y: 3, w: 1, h: 10, color: 'l', filled: true },
  ...[[4, 4], [10, 4], [4, 10], [10, 10]].flatMap(([x, y]) => [
    { op: 'rect', x, y, w: 2, h: 2, color: 'k', filled: true }, { op: 'pixel', x, y, color: 'w' },
  ]),
];
export const tough = {
  version: 1, name: 'tough', width: 16, height: 16,
  palette: { k: '#0c0a1268', l: '#ffffff58', w: '#ffffffd0', g: '#ffe14a' },
  frames: [
    { name: 'slate', ops: plate },
    { name: 'vault', ops: [...plate,
      { op: 'rect', x: 5, y: 5, w: 6, h: 6, color: 'k' },
      { op: 'rect', x: 7, y: 7, w: 2, h: 2, color: 'g', filled: true },
    ] },
  ],
};

// A block being cut: four stages of cracks, each adding to the last, dark with a light lip beside them.
const CRACKS = [
  [[8, 2, 7, 6], [7, 6, 9, 8]],
  [[9, 8, 6, 12], [7, 6, 3, 7]],
  [[9, 8, 13, 9], [6, 12, 5, 14], [3, 7, 2, 4]],
  [[13, 9, 14, 13], [9, 8, 11, 4], [6, 12, 10, 14], [3, 7, 4, 11]],
];
const crackOps = n => CRACKS.slice(0, n).flat().flatMap(([x, y, x2, y2]) => [
  { op: 'line', x: x + 1, y, x2: x2 + 1, y2, color: 'l' }, { op: 'line', x, y, x2, y2, color: 'k' },
]);
export const cracks = {
  version: 1, name: 'cracks', width: 16, height: 16,
  palette: { k: '#0c0a12d0', l: '#ffffff60' },
  frames: [1, 2, 3, 4].map(n => ({ name: `crack-${n}`, ops: crackOps(n) })),
};

// Things found in the ground: a buried crate, a part of an older machine, the iron staple that holds a keystone
// slab to the world, and a prism, which turns through the four gems' colours.
// The fossils, by the direction their middle lies in (js/world.js: FOSSILS, `fossilKin`): frames
// `fossil-<kin>-head`, `-body` and `-tail`, kin 1 north, 2 south, 3 west, 4 east. Bone (e), its shade (E) and what
// the ground has done to it (x).
const FOSSIL_KINDS = [
  [1, 'beast', { e: '#eef4f6', E: '#a8b8c8', x: '#8ec8ec' }],
  [2, 'ribs', { e: '#dcbca4', E: '#7e5444', x: '#e8642a' }],
  [3, 'wyrm', { e: '#dcd4b4', E: '#8a8468', x: '#6a9a4a' }],
  [4, 'ammonite', { e: '#ecc8a0', E: '#a8784a', x: '#8ee0d0' }],
];
export const finds = {
  version: 1, name: 'finds', width: 16, height: 16,
  palette: { k: '#1c1420', y: '#ffd84a', Y: '#fff2a0', b: '#9a6638', o: '#5e3a22', S: '#8e98ac', s: '#e2e8f4', d: '#565e72', g: '#5cc4f0', G: '#c8f4ff',
    i: '#8a94a8', I: '#eef4ff', r: '#b0603a', w: '#ffffff', m: '#bfe6ff', R: '#4fd0e8',
    v: '#3e3650', V: '#6a5e88', t: '#9a7ae8', T: '#e0d0ff', e: '#e8dcc0', E: '#b0a07c', x: '#8a7a5a' },
  symbols: {
    cache: [
      '............',
      '.kkkkkkkkkk.',
      '.kYyyyyyyyk.',
      '.kobbkkbbok.',
      '.kobkYykbok.',
      '.kkkkyykkkk.',
      '.kobkyykbok.',
      '.kobbkkbbok.',
      '.kobbbbbbok.',
      '.kyyyyyyyyk.',
      '.kkkkkkkkkk.',
      '............',
    ],
    part: [
      '....kkkk....',
      '.kk.kssk.kk.',
      'ksskkSSkkssk',
      'ksSSSSSSSSSk',
      '.kSSSkkSSSk.',
      'ksSSkGgkSSSk',
      'kSSSkggkSSdk',
      '.kSSSkkSSdk.',
      'kSSSSSSSSddk',
      'kSdkkSdkkddk',
      '.kk.kddk.kk.',
      '....kkkk....',
    ],
    key: [
      '............',
      '............',
      '.kkkkkkkkkk.',
      'kIIIIIIIIIIk',
      'kiiiiiiiiiik',
      'kiiriiiiidik',
      'kidkkkkkkidk',
      'kidk....kidk',
      'kirk....kidk',
      'kidk....krdk',
      '.kk......kk.',
      '............',
    ],
    prism: [
      '.....kk.....',
      '....kwmk....',
      '...kwwmRk...',
      '..kwwmmRRk..',
      '..kwwmmRRk..',
      '..kwwmmRRk..',
      '..kwwmmRRk..',
      '..kwwmmRRk..',
      '..kwwmmRRk..',
      '...kwmmRk...',
      '....kmRk....',
      '.....kk.....',
    ],
    // ---- generation 2's finds, from 800 cells out (js/world.js: `find`). A twin stone: one of a pair, a dark
    // polished stone with a ring of violet in it that lights with its twin (`twin-b`, the pair's glint).
    twin: [
      '............',
      '....kkkk....',
      '..kkVVVvkk..',
      '.kVVVvvvvvk.',
      '.kVVtTTtvvk.',
      'kVVtvvvvtvvk',
      'kVvTvvvvtvdk',
      'kvvtvvvvtddk',
      '.kvvttttddk.',
      '..kkvdddkk..',
      '....kkkk....',
      '............',
    ],
    // A fossil's bones, three to a species: the head of the chain, a bone of its middle and its tail. Each species is
    // the beast of its direction, and its colours are its ground's: the north's frozen beast pale under a crust of
    // frost (x), the south's ember ribs charred with embers in the cracks, the west's root wyrm bound in roots, and
    // the east's ammonite in nacre with a sheen.
    beastHead: [
      '............',
      '...kkkkkk...',
      '..keeeeeek..',
      '.keekkeeeek.',
      '.keekkeeeEk.',
      '.keeeeeeeEk.',
      '..kEeeeeEEk.',
      '..kxkEEkkk..',
      '.kexk.kk....',
      '.kexk.......',
      '..kexk......',
      '...kkk......',
    ],
    beastBody: [
      '............',
      '.....kk.....',
      '....keek....',
      '.kkkkeekkkk.',
      'keeeeeeeeeek',
      'kEEEEeeEEEEk',
      '.kkekkkkekk.',
      '..kek..kek..',
      '..kxk..kxk..',
      '..kek..kek..',
      '...k....k...',
      '............',
    ],
    beastTail: [
      '............',
      '............',
      '............',
      '.kk.kk.kk...',
      'keekeekeek..',
      'kEEkEEkEEkk.',
      '.kk.kk.kxek.',
      '.........kk.',
      '............',
      '............',
      '............',
      '............',
    ],
    ribsHead: [
      '............',
      '.k......k...',
      'kek....kek..',
      '.kekkkkek...',
      '..keeeeek...',
      '.keekkeeek..',
      '.keekxeeek..',
      '.keeeeeeEk..',
      '..keEkEEk...',
      '..kekekek...',
      '...k.k.k....',
      '............',
    ],
    ribsBody: [
      '............',
      '.kkkkkkkkkk.',
      'keeeeEeeeeek',
      '.kkekkkkekk.',
      '.kek....kek.',
      'kek......kek',
      'kxk......kxk',
      'kek......kek',
      '.kek....kek.',
      '..kek..kek..',
      '...k....k...',
      '............',
    ],
    ribsTail: [
      '............',
      '............',
      '....kkk.....',
      '...kexek....',
      '..kkekkkk...',
      '.keeEkeek...',
      '..kkkkEEkk..',
      '......kxek..',
      '.......kk...',
      '............',
      '............',
      '............',
    ],
    wyrmHead: [
      '............',
      '............',
      '..kkkkk.....',
      '.keeeeekk...',
      'keekkeeeekk.',
      'keekkeeeeeek',
      '.keeeeEEEEk.',
      '..kkxkkkkk..',
      '...kxk.ek...',
      '....kxk.k...',
      '.....kk.....',
      '............',
    ],
    wyrmBody: [
      '............',
      '.......x....',
      '.kk..kkxk...',
      'keek.keexk..',
      'kEeekkEeek..',
      '.kEeeekEeekk',
      '..kkEEekEeek',
      '.x..kkk.kEEk',
      '..x.......k.',
      '...xx.......',
      '............',
      '............',
    ],
    wyrmTail: [
      '............',
      '............',
      '............',
      '.kkk........',
      'keeekk......',
      'kEeeeekk....',
      '.kEEEeeekk..',
      '..kkkEEEexk.',
      '.....kkkkxk.',
      '..........x.',
      '............',
      '............',
    ],
    ammoniteHead: [
      '....kkkk....',
      '..kkeeeekk..',
      '.keeEkkkEek.',
      '.keEkeeekEk.',
      'keEkeEEkeEek',
      'keEkeExkeEek',
      'keEkeEkkeEek',
      'keEkekkeeEk.',
      '.keEkeeeEEk.',
      '.keeEkkkEek.',
      '..kkeeeekk..',
      '....kkkk....',
    ],
    ammoniteBody: [
      '............',
      '............',
      '..kkkkkkkk..',
      '.keEkeEkeEk.',
      'keeEkeEkeEek',
      'kxeEkeEkeEek',
      'keeEkeEkeEek',
      '.keEkeEkeEk.',
      '..kkkkkkkk..',
      '............',
      '............',
      '............',
    ],
    ammoniteTail: [
      '............',
      '............',
      '............',
      '....kkkk....',
      '...keEEek...',
      '..keEkkEek..',
      '..keEkxkEk..',
      '...keEEEk...',
      '....kkkk....',
      '............',
      '............',
      '............',
    ],
  },
  frames: [frame('cache', 'cache'), frame('part', 'part'), frame('key', 'key'),
    frame('prism', 'prism', { duration: 240 }),
    frame('prism-b', 'prism', { duration: 240, palette: { m: '#ffb060', R: '#c8442a' } }),
    frame('prism-c', 'prism', { duration: 240, palette: { m: '#b8f06a', R: '#d8b8ff' } }),
    frame('twin', 'twin', { duration: 900, palette: { d: '#26202e' } }), frame('twin-b', 'twin', { duration: 160, palette: { d: '#26202e', t: '#e0d0ff', T: '#ffffff', V: '#8a7eaa' } }),
    ...FOSSIL_KINDS.flatMap(([kin, beast, palette]) => ['head', 'body', 'tail'].map(part => frame(`fossil-${kin}-${part}`, `${beast}${part[0].toUpperCase()}${part.slice(1)}`, { palette }))),
    // (And a bone of no species, in plain bone: what a fossil is drawn as where its species is not asked.)
    frame('bone', 'beastBody')],
  animations: { prism: { frames: ['prism', 'prism-b', 'prism-c'] }, twin: { frames: ['twin', 'twin-b'] } },
};

// What the pockets hold, each lying in its pocket's own ground: amber in the hive's wax, with the stalk a nugget
// hangs by. A stalk is a strand right across a block of wax, so its frames fill the whole cell.
const STALK = [
  '................',
  '................',
  '................',
  '................',
  '................',
  'eeeeeeeeeeeeeeee',
  'SSStSSStSSStSSSt',
  'sstssstssstsssts',
  'stssstssstssstss',
  'ettsettsettsetts',
  'eeeeeeeeeeeeeeee',
  '................',
  '................',
  '................',
  '................',
  '................',
];
export const minerals = {
  version: 1, name: 'minerals', width: 16, height: 16,
  palette: { k: '#3a2208', a: '#ff9a1a', A: '#ffd070', B: '#a85a10', w: '#fff6d8', s: '#f4dc9a', S: '#fff4c8', t: '#d0a050', e: '#7a4a10',
    o: '#2a6cc0', r: '#7fd0ff', c: '#e8fbff', W: '#ffffff', n: '#6e6880', h: '#d8d2e4', N: '#4a4458',
    x: '#101018', T: '#2a2a36', u: '#46465c', y: '#8ce0ff',
    // starglass (g G i), agate (R D P m), fire opal (O F M v), a lantern cap lit (l L q z) and dull (d j J), fuse (f Y E b)
    g: '#30c8c0', G: '#a8fff0', i: '#0c5068', R: '#e85a3a', D: '#7a2a1a', P: '#ffd8a0', m: '#b8402a',
    O: '#ff5a3a', F: '#ffd070', M: '#7a1e3a', v: '#c03028', l: '#58f0e0', L: '#c8fff8', q: '#1c8a80', z: '#e8e0d0',
    d: '#2a5a54', j: '#1a3a38', J: '#8a8478', f: '#ffd84a', Y: '#ff8a2a', E: '#2a1c14', b: '#5a3a1c' },
  symbols: {
    amber: [
      '.....kk.....',
      '....kAak....',
      '....kAak....',
      '...kAaaak...',
      '...kAaaBk...',
      '..kAAaaaBk..',
      '.kAwAaaaaBk.',
      '.kAAaaakaBk.',
      '.kAaaaaaBBk.',
      '.kaaaaaBBBk.',
      '..kaBBBBBk..',
      '...kkkkkk...',
    ],
    // A four-point star set in a knob of the pumice it lies in.
    aerolite: [
      '.....o......',
      '....oro.....',
      '...horoh....',
      '..hnoconn...',
      '.ooorcrooo..',
      'orrccWccrro.',
      '.ooorcrooo..',
      '..nnoconN...',
      '...NoroN....',
      '....oro.....',
      '.....o......',
      '............',
    ],
    // A nodule of black glass, its upper left rim catching the light.
    tektite: [
      '............',
      '....xxxx....',
      '...xyyyTxx..',
      '..xywTTTTTx.',
      '.xyTTTTTTTx.',
      '.xyTTuTTTTx.',
      '.xTTTTTTTux.',
      '..xTTTTuuux.',
      '..xTTuuuxx..',
      '...xxxxx....',
      '............',
      '............',
    ],
    // A six-pointed star of clear ice, white at its heart.
    starglass: [
      '.....ii.....',
      '.i...gG...i.',
      '..ig.GG.gi..',
      '...gGGGGg...',
      '.iigGWWGgii.',
      'igGGWWWWGGgi',
      '.iigGWWGgii.',
      '...gGGGGg...',
      '..ig.GG.gi..',
      '.i...gG...i.',
      '.....ii.....',
      '............',
    ],
    // A nodule sawn across: bands of red and cream about a pale eye.
    agate: [
      '............',
      '...DDDDDD...',
      '..DRRRRRRD..',
      '.DRPPPPPPRD.',
      '.DRPmmmmPRD.',
      'DRPmRRRRmPRD',
      'DRPmRPPRmPRD',
      '.DRPmmmmPRD.',
      '.DRPPPPPPRD.',
      '..DRRRRRRD..',
      '...DDDDDD...',
      '............',
    ],
    // A cut gem with fire in it: red, lit gold from the upper left, wine in its shade.
    opal: [
      '............',
      '....MMMM....',
      '...MFFOOM...',
      '..MFWFOOOM..',
      '.MFFFOOOvvM.',
      '.MFOOOOvvvM.',
      '.MOOOOvvvMM.',
      '..MOOvvvMM..',
      '...MvvvMM...',
      '....MMMM....',
      '............',
      '............',
    ],
    // A cap that has lit: a bright dome over a pale stem.
    lantern: [
      '............',
      '....qqqq....',
      '..qqlLLlqq..',
      '.qlLLWLLllq.',
      '.qllLLLlllq.',
      'qllllllllllq',
      'qqlqlqlqlqqq',
      '.qqqzzzzqqq.',
      '....zzzz....',
      '....zzJz....',
      '...zzJJzz...',
      '............',
    ],
    // The same cap before anything has flown by: dull, its gills dark.
    cap: [
      '............',
      '....jjjj....',
      '..jjddddjj..',
      '.jdddqdddjj.',
      '.jdddddddjj.',
      'jddddddddddj',
      'jjdjdjdjdjjj',
      '.jjjJJJJjjj.',
      '....JJJJ....',
      '....JJjJ....',
      '...JJjjJJ...',
      '............',
    ],
    // Fuse: a block of dark matchwood packed with grains that are waiting to burn. It fills the cell, as a ring of
    // it is a wall.
    fuse: [
      'EEEEEEEEEEEEEEEE',
      'EbbEbbbEbbEbbbEE',
      'EbfbbYbbbfbbYbbE',
      'EbbYbbbfbbbYbbbE',
      'EEbbbfbbYbbbbfbE',
      'EbYbbbbbbbfbbbbE',
      'EbbbfbYbbbbbYbEE',
      'EbbbbbbbfbbbbbbE',
      'EEbYbbbbbbYbfbbE',
      'EbbbbfbYbbbbbbbE',
      'EbfbbbbbbbfbbYbE',
      'EbbbYbbfbbbbbbEE',
      'EbbbbbbbbYbbfbbE',
      'EEbfbYbbbbbbbbbE',
      'EbbbbbbfbbYbbbEE',
      'EEEEEEEEEEEEEEEE',
    ],
    stalk: STALK,
    // The same strand turned upright, lit on its left as the level one is on its top.
    upright: STALK.map((row, y) => [...row].map((_, x) => STALK[x][y]).join('')),
  },
  frames: [frame('amber', 'amber'), frame('aerolite', 'aerolite'), frame('tektite', 'tektite'),
    frame('starglass', 'starglass'), frame('agate', 'agate'), frame('opal', 'opal'), frame('lantern', 'lantern'), frame('cap', 'cap'),
    { name: 'fuse-h', duration: 300, ops: [{ op: 'stamp', symbol: 'fuse', x: 0, y: 0 }] },
    { name: 'fuse-v', duration: 300, ops: [{ op: 'stamp', symbol: 'fuse', x: 0, y: 0 }] },
    { name: 'stalk-h', duration: 300, ops: [{ op: 'stamp', symbol: 'stalk', x: 0, y: 0 }] },
    { name: 'stalk-v', duration: 300, ops: [{ op: 'stamp', symbol: 'upright', x: 0, y: 0 }] }],
};

// The four rare hazards, one to a direction and a sheet each, as the game draws a hazard by its sheet's `hazard`.
// What they do awake has frames of its own, drawn only while it is awake.

// The rime bell: a squat bell of black ice with a pale rim. It tolls tipped a pixel either way, its rim lit.
const BELL = [
  '.....kk.....',
  '....kmbk.z..',
  '...kbmbbkzzz',
  '..kbmwbbbkz.',
  '..kbmwbbbk..',
  '..kbmbbbBk..',
  '.kbmbbbbBBk.',
  '.kbbbbbbBBk.',
  'krrrrrrrrrrk',
  'kRRRRRRRRRRk',
  '.kkkkrrkkkk.',
  '.....kk.....',
];
const tip = dx => BELL.map((row, y) => y > 6 ? row : dx > 0 ? '.' + row.slice(0, -1) : row.slice(1) + '.');
export const bell = {
  version: 1, name: 'bell-items', width: 16, height: 16,
  palette: { k: '#070c18', b: '#1b2a44', B: '#111a2c', m: '#2e4a70', w: '#e8fbff', r: '#6fb6e8', R: '#3a78b0', z: '#ffffff00' },
  symbols: { bell: BELL, 'bell-l': tip(-1), 'bell-r': tip(1) },
  frames: [frame('hazard', 'bell', { duration: 400 }), frame('hazard-b', 'bell', { duration: 400, palette: { w: '#ffffff', r: '#bff4ff', z: '#ffffff' } }),
    frame('toll-a', 'bell-l', { duration: 80, palette: { r: '#e8fbff', R: '#6fb6e8', w: '#ffffff' } }),
    frame('toll-b', 'bell-r', { duration: 80, palette: { r: '#e8fbff', R: '#6fb6e8', w: '#ffffff' } })],
  animations: { hazard: { frames: ['hazard', 'hazard', 'hazard', 'hazard-b'] } },
};

// The fumarole: a cracked cone with fire in its throat, breathing. Its jet is a band of flame that fills the cell
// end to end, so a line of them is one flame. Its two drawings are alike at the cell's edges, so any two join.
const JET_A = [
  '................',
  '................',
  '.....r......r...',
  '....rorr...ror..',
  'r..roooor.rooo.r',
  'orroYYYooroYYoro',
  'YooYWWWYYoYWWYoY',
  'WYWWWWWWWWWWWWYW',
  'WWWWWWYWWWWWWWWW',
  'YYWWWYYoYWWWYYYY',
  'ooYYYoorroYYoooo',
  'rroooor..rrooror',
  '..rrorr....rr.r.',
  '....r.......r...',
  '................',
  '................',
];
const JET_B = [
  '................',
  '................',
  '..r.......r.....',
  '.ror.....rorr...',
  'rrooor.rroooorrr',
  'oooYYoroooYYYooo',
  'YYYWWYoYYYWWWYYY',
  'WWWWWWYWWWWWWWWW',
  'WYWWWWWWWWWYWWWW',
  'YYYWWYYYYWWWWYYY',
  'oYoYYooooYYYooYo',
  'roroorr.roooroor',
  '.rr.r..rrorr..r.',
  '.......r..r.....',
  '................',
  '................',
];
const jet = (name, symbol, rotate) => ({ name, duration: 60, ops: [{ op: 'stamp', symbol, x: 0, y: 0, rotate }] });
export const vent = {
  version: 1, name: 'vent-items', width: 16, height: 16,
  palette: { k: '#120806', l: '#7a4e38', m: '#5a3626', M: '#2a1a14', o: '#ff7a1a', Y: '#ffd36a', W: '#fff6c8', r: '#c2361a', z: '#ffffff00' },
  symbols: {
    cone: [
      '......z.....',
      '....z...z...',
      '...kkkkkk...',
      '..koYWWYok..',
      '..kloYYoMk..',
      '..klmmoMMk..',
      '.kllmmYoMMk.',
      '.klmmmMoMMk.',
      'klmmMMMMYoMk',
      'klmomMMMMoMk',
      'kkkkkkkkkkkk',
      '............',
    ],
    'jet-a': JET_A, 'jet-b': JET_B,
  },
  frames: [frame('hazard', 'cone', { duration: 500 }), frame('hazard-b', 'cone', { duration: 300, palette: { o: '#ffb040', Y: '#fff6c8', W: '#ffffff', z: '#ffd36a' } }),
    { name: 'rumble-a', duration: 60, palette: { o: '#ffd36a', Y: '#ffffff', W: '#ffffff', z: '#ff7a1a' }, ops: [{ op: 'stamp', symbol: 'cone', x: 1, y: 2 }] },
    { name: 'rumble-b', duration: 60, palette: { o: '#ffd36a', Y: '#ffffff', W: '#ffffff', z: '#ffd36a' }, ops: [{ op: 'stamp', symbol: 'cone', x: 3, y: 2 }] },
    jet('jet-h-a', 'jet-a', 0), jet('jet-h-b', 'jet-b', 0), jet('jet-v-a', 'jet-a', 90), jet('jet-v-b', 'jet-b', 90)],
  animations: { hazard: { frames: ['hazard', 'hazard-b'] } },
};

// The glowworm: coiled asleep, lamps down its back and a white light at its tail. Awake it swims straight, drawn
// heading east and turned for the other three ways, its body rippling between two drawings.
const SWIM_A = [
  '............',
  '............',
  '............',
  '....kk..kkk.',
  '..kkglkkgglk',
  '.kglggglgkgk',
  'kwggGGgggggk',
  '.kGGkkGGGGGk',
  '..kk..kkkkk.',
  '............',
  '............',
  '............',
];
const SWIM_B = [
  '............',
  '............',
  '............',
  '..kk..kkkkk.',
  '.kglkkglgglk',
  'kwggglgggkgk',
  '.kGGggGGgggk',
  '..kkGGkkGGGk',
  '....kk..kkk.',
  '............',
  '............',
  '............',
];
const swim = (dir, symbol, extra) => ({ name: `swim-${dir}`, duration: 120, ops: [{ op: 'stamp', symbol, x: 2, y: 2, ...extra }] });
export const worm = {
  version: 1, name: 'worm-items', width: 16, height: 16,
  palette: { k: '#1c2a10', g: '#6bd13a', G: '#2f6e1c', l: '#d8ff7a', w: '#ffffff', t: '#c8ff5a60', T: '#6bd13a38' },
  symbols: {
    coil: [
      '...kkkk.kkk.',
      '..kgglwkgglk',
      '.kgGGGkkgkgk',
      'kgGkkk.kGggk',
      'klGk....kGgk',
      'kgGk....kGlk',
      'kgGk....kGgk',
      'klGk....kGgk',
      'kggGkkkkGGgk',
      '.kgGGGGGGgk.',
      '..kglgglgk..',
      '...kkkkkk...',
    ],
    'swim-a': SWIM_A, 'swim-b': SWIM_B,
    trail: [
      '............',
      '............',
      '............',
      '....T.T.....',
      '...TtTtT.T..',
      '..TttttTT...',
      '.T.tttttT...',
      '..TTttTtT...',
      '...T.TT.....',
      '............',
      '............',
      '............',
    ],
  },
  frames: [frame('hazard', 'coil', { duration: 450 }), frame('hazard-b', 'coil', { duration: 450, palette: { l: '#ffffff' } }),
    swim('e-a', 'swim-a'), swim('e-b', 'swim-b'), swim('s-a', 'swim-a', { rotate: 90 }), swim('s-b', 'swim-b', { rotate: 90 }),
    swim('w-a', 'swim-a', { flipX: true }), swim('w-b', 'swim-b', { flipX: true }), swim('n-a', 'swim-a', { rotate: 270 }), swim('n-b', 'swim-b', { rotate: 270 }),
    frame('trail', 'trail')],
  animations: { hazard: { frames: ['hazard', 'hazard', 'hazard-b'] } },
};

// The lodestone: a lump of dark iron stone with a red pole and a blue, and the filings that stand along the lines
// between them, clear but when it stirs. The filing frame rings a cell: the ore it will pull next.
export const lodestone = {
  version: 1, name: 'lodestone-items', width: 16, height: 16,
  palette: { k: '#16141c', d: '#3a3448', s: '#454a5a', h: '#6a6e84', R: '#e04848', r: '#902a30', B: '#4f7cff', b: '#2a46a0', z: '#ffffff00', w: '#ffffff' },
  symbols: {
    stone: [
      '...z...z....',
      '.z..kkkkk.z.',
      '..kkhhssdk..',
      '.kRRhsssddk.',
      'kRRrsssdddkk',
      'kRrrssdddbBk',
      'kRrsssddbBBk',
      '.kksddddbBBk',
      '...kdddkbBk.',
      '.z..kkk.kk..',
      '...z...z..z.',
      '............',
    ],
  },
  frames: [frame('hazard', 'stone', { duration: 350 }), frame('hazard-b', 'stone', { duration: 350, palette: { R: '#ff7a6a', B: '#8cacff', z: '#d8e0ff' } }),
    { name: 'hum-a', duration: 60, palette: { R: '#ffd0c8', r: '#e04848', B: '#d0dcff', b: '#4f7cff', z: '#ffffff' }, ops: [{ op: 'stamp', symbol: 'stone', x: 1, y: 2 }] },
    { name: 'hum-b', duration: 60, palette: { R: '#ffffff', r: '#ff7a6a', B: '#ffffff', b: '#8cacff', z: '#ff6a5a' }, ops: [{ op: 'stamp', symbol: 'stone', x: 3, y: 2 }] },
    { name: 'filing', duration: 300, ops: [{ op: 'rect', x: 0, y: 0, w: 16, h: 16, color: 'w', filled: false }] }],
  animations: { hazard: { frames: ['hazard', 'hazard', 'hazard', 'hazard-b'] } },
};

// ------------------------------------------------------------------ the strains' and the deep flanks' own ores
// Each strain and each deep flank has two ores of its own, drawn here, two frames to a ground: `<ground>A`, the
// common ore, two or three small pieces spread over the cell as a direction's oreA is, and `<ground>B`, the rich
// ore, one larger form near the middle. Each is drawn as a fill alone and ringed with its direction's own outline
// (`k`, as the direction's sheet has it), so a piece is always closed; each frame has its colours of its own.
// Lit from the upper left: a light, b body, c shade, w a glint; x and y, s and S, d and D, g and G, r and R accents.
const ORE_KEYS = { k: '#000000', a: '#000000', b: '#000000', c: '#000000', w: '#ffffff', x: '#000000', y: '#000000', s: '#000000', S: '#000000',
  d: '#000000', D: '#000000', g: '#000000', G: '#000000', r: '#000000', R: '#000000', o: '#000000', O: '#000000' };
// (And a corner's own, for the rich ore of its deep seam, which pays the corner's own gem: a dark of that gem's
// colour, so that the stone that pays the new gem is ringed as no direction's is.)
const OUTLINE = { north: '#22395a', south: '#160c12', west: '#1c1426', east: '#3a2414', ne: '#14204a', se: '#3a0c1c', sw: '#24222e', nw: '#0c3018' };
const ore = (name, side, palette) => ({ name, duration: 300, palette: { ...palette, k: OUTLINE[side] },
  ops: [{ op: 'stamp', symbol: name, x: 2, y: 2 }, { op: 'outline', color: 'k', position: 'outside' }] });
export const ores = {
  version: 1, name: 'ores', width: 16, height: 16,
  palette: ORE_KEYS,
  symbols: {
    // North. Firn: sapphires, three small cut stones; enhydro, a yellow crystal lying on its side with a
    // bubble of water shut in it.
    firnA: [
      '............',
      '.....a......',
      '....wab.....',
      '....abb.....',
      '....bbc.....',
      '.....c...a..',
      '..a.....wab.',
      '.wab....abb.',
      '.abb....bbc.',
      '.bbc.....c..',
      '..c.........',
      '............',
    ],
    firnB: [
      '............',
      '............',
      '............',
      '...wwaaaa...',
      '..waaawwaab.',
      '.abbbxxbbbc.',
      '..bbbbxbbcc.',
      '...ccccccc..',
      '............',
      '............',
      '............',
      '............',
    ],
    // Serac: shard silver, three blades split alike; fluorite, a cube seen corner on with a band across it.
    seracA: [
      '............',
      '..........a.',
      '.........ab.',
      '........wb..',
      '.......ab...',
      '......bc....',
      '......c.....',
      '...a......a.',
      '..ab.....ab.',
      '.ab.....ab..',
      '.c......c...',
      '............',
    ],
    seracB: [
      '............',
      '.....wa.....',
      '...aaaaaa...',
      '.aaaaaaaaaa.',
      '.bbaaaaaacc.',
      '.bbbbaacccc.',
      '.xxbbbcccxx.',
      '.bbxxbcxxcc.',
      '.bbbbxxcccc.',
      '...bbbccc...',
      '.....bc.....',
      '............',
    ],
    // Rime: moonstones, two smooth milky pebbles with a band of blue light across each (larger than the ovals of
    // rime's dense rock, and the blue is what tells them from it); ice opal, an oval flecked with colour.
    rimeA: [
      '............',
      '..aaab......',
      '.awxxbb.....',
      '.abbxxbc....',
      '..bbbxc.....',
      '............',
      '............',
      '.......aaab.',
      '......awxxbb',
      '......abbxxc',
      '.......bbbc.',
      '............',
    ],
    rimeB: [
      '............',
      '....aaab....',
      '...waaabb...',
      '..aaxabbbb..',
      '..abbbbybb..',
      '..abxbbbbc..',
      '..bbbbbxbc..',
      '..bybbbbcc..',
      '...bbbxcc...',
      '....bccc....',
      '............',
      '............',
    ],
    // South. Scoria: sulphur in crusts of stubby crystals, pale lemon (a yellow kept well clear of lava's); a
    // thunderegg, a plain nodule cracked open, most of what is seen of it the star of blue crystal inside.
    scoriaA: [
      '............',
      '....wa.a....',
      '...aabab....',
      '...bbbbbc...',
      '....cccc....',
      '............',
      '.a.......a..',
      'wab.....aab.',
      'abbc....bbbc',
      '.cc......cc.',
      '............',
      '............',
    ],
    scoriaB: [
      '............',
      '...ssssss...',
      '..saaaabsS..',
      '.sabwacbbcS.',
      '.sacabbcbcS.',
      '.sabbcwbcbS.',
      '.sbcbbabccS.',
      '.sSbcccccSS.',
      '..SSSSSSSS..',
      '...SSSSSS...',
      '............',
      '............',
    ],
    // Forge: cinnabar in scarlet lumps, each sweating a bead of quicksilver; kidney ore, round lumps of iron, bright
    // as polished metal and deep in its shade, with a streak of red down its cleft (so it is not taken at a glance
    // for the dull lump of slag that tells of lava).
    forgeA: [
      '............',
      '....ab......',
      '...abbc.....',
      '...bbcc.....',
      '....cx......',
      '........ab..',
      '.......abbc.',
      '..ab...bbcc.',
      '.abbc...cx..',
      '.bbcc.......',
      '..cx........',
      '............',
    ],
    forgeB: [
      '............',
      '...aab......',
      '..abbbxaab..',
      '..bwbbxbbbc.',
      '..bbbcxbwbc.',
      '..abcxcbbcc.',
      '.abbbxbccc..',
      '.bwbxbbccx..',
      '.bbbxbccx...',
      '..bccc......',
      '............',
      '............',
    ],
    // Magma: red gold run in drops, the rosy gold of metal with a glint on each; peridot, a green stone set in a lump
    // of black lava.
    magmaA: [
      '............',
      '....a.......',
      '....ab......',
      '...wbbb.....',
      '...bbbc.....',
      '....cc......',
      '.a......a...',
      '.ab.....ab..',
      '.wbb...wbbb.',
      '.bbc...bbbc.',
      '..c.....cc..',
      '............',
    ],
    magmaB: [
      '............',
      '....sSSS....',
      '...sSaaSS...',
      '..sSawabSS..',
      '..SaaabbcS..',
      '..SabbbccS..',
      '..SSbbccSS..',
      '...SSccSS...',
      '....SSSS....',
      '............',
      '............',
      '............',
    ],
    // West. Tangle: malachite in banded nodules; cave pearls, three in a cup of stone.
    tangleA: [
      '............',
      '.....aab....',
      '....axbbb...',
      '....abxbc...',
      '.....bcc....',
      '............',
      '..ab........',
      '.axbb....a..',
      '.bxbc...axb.',
      '..cc....bbc.',
      '.........c..',
      '............',
    ],
    tangleB: [
      '............',
      '.....aw.....',
      '....abbb....',
      '....abbc....',
      '.....cc.....',
      '...aw..aw...',
      '..abbbabbb..',
      '.sabbcabbcs.',
      '.sSccSSccSs.',
      '..sSSSSSSs..',
      '...SSSSSS...',
      '............',
    ],
    // Sporefall: foxfire, two sticks of old root speckled with light; a jewel beetle seen from above.
    sporefallA: [
      '............',
      '......a.....',
      '....ddaddd..',
      '..DDbDDDD...',
      '............',
      '............',
      '............',
      '...ddddadd..',
      '.DDbDDDDD...',
      '............',
      '............',
      '............',
    ],
    sporefallB: [
      '............',
      '.....aa.....',
      '....abbc....',
      '..c.cccc.c..',
      '...xaabbx...',
      '..cxabcbcxc.',
      '...xabcbbx..',
      '.......bbbc.',
      '...xbbcbbx..',
      '....bbcbc...',
      '.....ccc....',
      '............',
    ],
    // Bloom: sunseeds, small teardrops gone hard; a flower stone, dark, with a white flower open in it.
    bloomA: [
      '............',
      '.....a......',
      '....wb......',
      '....bc....a.',
      '.........wb.',
      '..a......bc.',
      '.wb.........',
      '.bc....a....',
      '......wb....',
      '......bc....',
      '............',
      '............',
    ],
    bloomB: [
      '............',
      '....dddd....',
      '..dddabdDD..',
      '.daadabDaaD.',
      '.dabbyybbaD.',
      '.dDDbyybDDD.',
      '.dabDabDbaD.',
      '..dDDabDDD..',
      '...DDDDDD...',
      '............',
      '............',
      '............',
    ],
    // East. Redrock: turquoise in nuggets webbed with dark veins; selenite, flat blades lying level in a bundle.
    redrockA: [
      '............',
      '....aab.....',
      '...axbbx....',
      '...bbxbc....',
      '....bcc.....',
      '............',
      '.........a..',
      '..ab....axb.',
      '.abxb...bbc.',
      '.bxbc....c..',
      '..cc........',
      '............',
    ],
    redrockB: [
      '............',
      '............',
      '....waaaa...',
      '...abbbbbbc.',
      '.waaaaaac...',
      '..bbbbbbbcc.',
      '...waaaaaaa.',
      '..bbbbbbbcc.',
      '....cccccc..',
      '............',
      '............',
      '............',
    ],
    // Loess: stone ferns, fronds drawn black on the silt; lapis lazuli, a rough blue lump flecked with gold.
    loessA: [
      '............',
      '........b...',
      '.......aba..',
      '........b...',
      '.......aba..',
      '........c...',
      '...b........',
      '..aba.......',
      '...b........',
      '..aba.......',
      '...c........',
      '............',
    ],
    loessB: [
      '............',
      '...aa.......',
      '..aayab.....',
      '..abbbbb.ab.',
      '.aabbybbbbc.',
      '.abbbbbbbcc.',
      '..bbbbbybcc.',
      '...bbcbbcc..',
      '....cc.ccc..',
      '............',
      '............',
      '............',
    ],
    // Gilt: spinels, small red octahedra; alexandrite, a cut stone green on one side and red on the other.
    giltA: [
      '............',
      '.....a......',
      '....wab.....',
      '...aabbc....',
      '....bbc.....',
      '.....c......',
      '........a...',
      '.......wab..',
      '..a...aabbc.',
      '.wab...bbc..',
      '..c.....c...',
      '............',
    ],
    giltB: [
      '............',
      '....GGGG....',
      '...gwggGr...',
      '..ggggGrrR..',
      '..gggGrrrR..',
      '..ggGrrrRR..',
      '..gGrrrRRR..',
      '..GrrrRRRR..',
      '...rrRRRR...',
      '....RRRR....',
      '............',
      '............',
    ],
    // ---- the seams' and the deep strains' own (generation 2). A seam's common ore pays its own direction's gems and
    // is ringed in that direction's outline; its rich ore pays the other parent's and is ringed in the other's, so the
    // ring says whose gems a piece pays. A deep seam's are its seam's. Every one is kept off the colours of what hurts
    // in its ground (both its hazards, the slag where there is lava, its direction's rare hazard) and off its rock.
    // Hoarstone: hoar quartz, frosted points of periwinkle quartz in clusters; polar topaz, one cut stone of sherry
    // pink (the east's crystals are gold, so a topaz of the east is not).
    hoarstoneA: [
      '....a.......',
      '...wab......',
      '...abb......',
      '...abc......',
      '...bbc......',
      '....c.......',
      '.........a..',
      '........wab.',
      '.a......abc.',
      'wab.....bbc.',
      'abc......c..',
      '.c..........',
    ],
    hoarstoneB: [
      '............',
      '............',
      '..aaaaaaab..',
      '.awwaaaaabb.',
      'aaxaaaaaabbc',
      'abbxbbbbbbcc',
      'abbbxbbbbbcc',
      'bbbbbxbbbccc',
      '.bbbbbxbccc.',
      '..cccccccc..',
      '............',
      '............',
    ],
    // Glassdune: sand roses, rosettes of rose-pink blades grown in the dunes; ember garnet, a rhombic garnet of
    // raspberry red (redder would be lava's).
    glassduneA: [
      '............',
      '..a.a.......',
      '.abwab......',
      'abbabba.....',
      '.cbbbc......',
      '..cbc.......',
      '............',
      '............',
      '.......a.a..',
      '......abwab.',
      '.....abbabbc',
      '......ccbcc.',
    ],
    glassduneB: [
      '....aaaa....',
      '..aaawaaab..',
      '.aaawwaabbb.',
      'aaaaawaabbbc',
      'xaaaaaabbbbc',
      'xxaaaabbbbcc',
      'xxxaabbbbccc',
      '.xxxabbbccc.',
      '..xxxbbccc..',
      '...xxbccc...',
      '....xxcc....',
      '.....cc.....',
    ],
    // Cinderfen: bog iron, knobbly nodules of warm grey metal pitted with rust (not tan, which is the frogs' and the
    // pufflings' that live there, nor orange, the salamanders'); smoke jasper, a nodule banded in
    // moss green and smoky cream.
    cinderfenA: [
      '............',
      '..aab.......',
      '.awbbb......',
      '.abbxb......',
      '.bbbcc......',
      '..ccc.......',
      '........aab.',
      '.......awbbc',
      '.......abxcc',
      '..ab....ccc.',
      '.wbbc.......',
      '..cc........',
    ],
    cinderfenB: [
      '............',
      '............',
      '............',
      '...aaaabbb..',
      '.aaabbxxbbb.',
      'aabxxbbbxxbc',
      'abbbbxxbbbcc',
      'bxxbbbbxxbcc',
      '.bbbxxbbbcc.',
      '..cccccccc..',
      '............',
      '............',
    ],
    // Frostfen: moss agate, two clear pale pebbles with green moss frozen in them in threads; ice jade, a pebble of
    // green jade with a frost of white on it.
    frostfenA: [
      '............',
      '..aab.......',
      '.awgbb......',
      '.agbgb......',
      '.bbgbc......',
      '..bcc.......',
      '............',
      '........aab.',
      '.......awgbb',
      '.......abgbc',
      '........bcc.',
      '............',
    ],
    frostfenB: [
      '.......ab...',
      '......aab...',
      '.....waabb..',
      '....waabbb..',
      '...waabbbbc.',
      '..aaabbybbc.',
      '.aabbbbbbcc.',
      '.abbybbbbcc.',
      '.bbbbbbbcc..',
      '..bbbbccc...',
      '...cccc.....',
      '............',
    ],
    // Glacier: aquamarines, two sea-green prisms lying aslant; cryolite, a block of ice-white stone with a violet
    // cast, the stone that vanishes in water.
    glacierA: [
      '..........a.',
      '.........wab',
      '........abbc',
      '.......abbc.',
      '......abbc..',
      '.......cc...',
      '............',
      '..a.........',
      '.wab........',
      '.abbc.......',
      '..bcc.......',
      '............',
    ],
    glacierB: [
      '............',
      '.wwaaaaaaa..',
      '.waaaaaaaab.',
      '.aaaaaaaabb.',
      '.abbbbbbbbc.',
      '.abbxbbbbbc.',
      '.abbbbbxbbc.',
      '.abbbbbbbbc.',
      '.abbbbbbbbc.',
      '.bccccccccc.',
      '............',
      '............',
    ],
    // Caldera: melanite, black garnets each with a lilac shine on its lit face; labradorite, a bubbly lump of dull
    // brown with the play of green and gold in it.
    calderaA: [
      '............',
      '..aab.......',
      '.awbbo......',
      '.abbbo......',
      '..boo.......',
      '........aab.',
      '.......awbbo',
      '.......abbbo',
      '.aab....boo.',
      'awbbo.......',
      'abbbo.......',
      '.boo........',
    ],
    calderaB: [
      '............',
      '..sss..ss...',
      '.sgggssggs..',
      'sgGGgssgGgs.',
      'sgGgyssggSs.',
      'sggggsssSSs.',
      '.ssssyyssss.',
      '.sGgggsgggs.',
      'sgGGgssgGGs.',
      'sggSSs.sgSs.',
      '.SSSS...SS..',
      '............',
    ],
    // Mycelium: spore pearls, small and sea-glass pale and shaded periwinkle (a teal shade is the newts'), three of them; chitin opal, opal blue with flecks of green
    // and gold, set in a plate of dark chitin.
    myceliumA: [
      '............',
      '...ab.......',
      '..awbb......',
      '..abbc......',
      '...cc.......',
      '.........ab.',
      '........awbb',
      '........abbc',
      '.ab......cc.',
      'awbb........',
      'abbc........',
      '.cc.........',
    ],
    myceliumB: [
      '..dddddddd..',
      '.ddoOOOoodd.',
      '.doOwOooood.',
      '.doOOoogood.',
      '.dooOogyood.',
      '.doooOoogod.',
      '..dooooOod..',
      '..ddoyoOdd..',
      '...ddoood...',
      '....ddod....',
      '.....dd.....',
      '............',
    ],
    // Druse: citrine points, clear crystal with a lemon tip, in two clusters; heliodor, one six-sided prism of
    // yellow-green beryl (gold is the east's crystals').
    druseA: [
      '............',
      '.a...a......',
      '.yb.wyb.....',
      '.ab.abb.....',
      '.abbabc.....',
      '..bbbc......',
      '...cc.......',
      '.........a..',
      '........wyb.',
      '........abc.',
      '........bbc.',
      '.........c..',
    ],
    druseB: [
      '............',
      '....aaaa....',
      '...awwaab...',
      '...aaaabb...',
      '...abbbbc...',
      '...abxbbc...',
      '...abbbbc...',
      '...abbxbc...',
      '...abbbbc...',
      '...bbbbcc...',
      '....cccc....',
      '............',
    ],
    // ---- the deep seams' own. A deep seam's common ore pays its first parent's gems and is ringed in that
    // direction's outline, as its seam's is; its rich ore pays its corner's own gem and is ringed in the corner's
    // outline. Each is kept off what hurts there and off its rock, as the seams' are.
    // Skarn: scheelite, honey-coloured dipyramids (gold would be the crystals'); peacock ore, a knobbly lump of
    // bornite tarnished blue, violet and teal, with a bronze glint where the tarnish is worn.
    skarnA: [
      '....a.......',
      '...awb......',
      '..aabbb.....',
      '.aaabbbc....',
      '..abbbc.....',
      '...bbc......',
      '....c.......',
      '.........a..',
      '.a......awb.',
      'awb....aabbc',
      '.bc.....bbc.',
      '.........c..',
    ],
    skarnB: [
      '............',
      '..ab....ab..',
      '.awbb..axbr.',
      '.abxbbabbrrc',
      '..bbbbbbrbc.',
      '.abbyxxbbbc.',
      'abrrbxxbbyc.',
      'abrrbbbbbcc.',
      '.bbbbbbccc..',
      '..bbcbbc....',
      '...cc.cc....',
      '............',
    ],
    // Obsidian: dune gold, nuggets of a green gold (a yellow one would be the crystals' and the lava's); rainbow
    // glass, a nodule of black glass whose polished face shows bands of magenta, violet and teal.
    obsidianA: [
      '............',
      '..aab.......',
      '.awbbb......',
      '.abbbbc.....',
      '..bbbcc.....',
      '...cc....ab.',
      '........awbc',
      '........bbc.',
      '...aab...c..',
      '..awbbc.....',
      '..abbcc.....',
      '...cc.......',
    ],
    obsidianB: [
      '............',
      '....ddddd...',
      '..ddxxxxxd..',
      '.dxxwxrrxxd.',
      '.dxrrrggrxdd',
      'dxrrgggggrxd',
      'dxrgddddggrd',
      'dxgddddddgrd',
      'dgdddddddddd',
      '.ddddddddDd.',
      '..dddddDDd..',
      '....dddd....',
    ],
    // Tarpit: orpiment, its plates stacked in flakes, a straw yellow kept clear of the lava's; ammolite, a plate of
    // fossil shell cut flat, its play of colour teal and green in cells split by dark seams.
    tarpitA: [
      '............',
      '.aaaaw......',
      'bbbbbbb.....',
      'aaaaaabc....',
      'bbbbbbbc....',
      '.bbbbcc.....',
      '............',
      '............',
      '........aaw.',
      '.......bbbbc',
      '.......aaabc',
      '........bbc.',
    ],
    tarpitB: [
      '............',
      '............',
      '..dddddddd..',
      '.dggggdGGgd.',
      'dgwggdGGGgdd',
      'dggggdGGggbd',
      'ddddgggdddbd',
      'dbbbdggggdbd',
      'dbbbbdgggggd',
      '.dbbbdggggd.',
      '..dddddddd..',
      '............',
    ],
    // Muskeg: vivianite, sprays of indigo blades; larimar, a pebble of sea blue webbed with white.
    muskegA: [
      '............',
      '.a..a.......',
      '.ab.ab..a...',
      '..bab..ab...',
      '..bbbbab....',
      '...bbbc.....',
      '....cc......',
      '.........a..',
      '.......a.ab.',
      '.......abbc.',
      '........bc..',
      '............',
    ],
    muskegB: [
      '............',
      '............',
      '...aaaab....',
      '..awwaabbb..',
      '.aaxaaabxbb.',
      '.abbxxbbxbc.',
      'abbbbxxbbbcc',
      'abxbbbbxxbcc',
      '.bbxxbbbbcc.',
      '..bbbxbccc..',
      '...ccccc....',
      '............',
    ],
    // ---- the crosses' own rich ores. A cross pays its donor's gems for its rich ore, which is ringed in the
    // donor's outline, kept off both its parents' hazards, its host's common ore and its donor's own rich ore, and
    // seen on the cross's rock. Named as `CROSS_LOOKS` names the cross (js/world.js), host by host.
    // Thaw: candle quartz, a point with small points crowded round its foot, the warm white of wax.
    thawB: [
      '.....a......',
      '....awb.....',
      '....awb.....',
      '....abb.....',
      '..a.abb.a...',
      '.awbabbab...',
      '.abbabbbbc..',
      '.abbbbbbbc..',
      '..bbbbbbcc..',
      '..bbbbbbcc..',
      '...cccccc...',
      '............',
    ],
    // Tundra: frost lichen, a lobed rosette of pale green crust rimed white.
    tundraB: [
      '..aa........',
      '.abba.aa....',
      '.abbbabba...',
      '..bxbbbbba..',
      '.abbbxxbbbc.',
      'abbxbxxbxbbc',
      '.bbbbbbbbbc.',
      '..cbbxbbbbc.',
      '...cbbcbbc..',
      '....cc.cc...',
      '............',
      '............',
    ],
    // Hailstone: ghost quartz, a clear point with the green ghost of an older crystal standing in it.
    hailstoneB: [
      '.....a......',
      '....awa.....',
      '...awgga....',
      '...wgGgab...',
      '..agggGgb...',
      '..aggGggbc..',
      '..agGgggbc..',
      '..aggGGgbc..',
      '..agggggbc..',
      '..aggggbbc..',
      '..abbbbbbc..',
      '...cccccc...',
    ],
    // Quench: tourmaline, a long striated prism of rose with its foot gone green, as a watermelon's is.
    quenchB: [
      '.........ab.',
      '........awbc',
      '.......abxbc',
      '......abxbc.',
      '.....abxbc..',
      '....abxbc...',
      '...abxbc....',
      '..aGxbc.....',
      '.agGGc......',
      '.ggGc.......',
      '.gGc........',
      '..c.........',
    ],
    // Sootfen: fire morel, the honeycombed cap of the morel that comes up where a fen has burnt, on its pale stem.
    sootfenB: [
      '.....aa.....',
      '....abbb....',
      '...abdbdb...',
      '...bbbbbc...',
      '..abdbdbbc..',
      '..bbbbbbbc..',
      '..bdbdbdbc..',
      '..bbbbbbcc..',
      '...ccccc....',
      '....wsS.....',
      '....wsS.....',
      '....sSS.....',
    ],
    // Flashrock: fulgurite, glass fused by lightning, a branching tube of pale green glass round a dark core.
    flashrockB: [
      '.....aa.....',
      '....abbc....',
      '....abc.....',
      '...abbc.....',
      '..abbbbc....',
      '.ab.abbbc...',
      'ab..abbdc.ab',
      'b...abddbabc',
      '....abdbbbc.',
      '...abbdc....',
      '..abbdc.....',
      '..bcc.......',
    ],
    // Rimemoss: celestine, a cluster of tabular crystals of the palest sky blue on a crust of matrix.
    rimemossB: [
      '.......a....',
      '......awb...',
      '..a...abb...',
      '.awb..abbc..',
      '.abb.aabbc..',
      '.abbcabbbc.a',
      '.abbcabbbcab',
      '.abbbabbbabc',
      '.abbbbbbbbbc',
      '..ssssssssS.',
      '...SSSSSSS..',
      '............',
    ],
    // Smoulder: pyrite, two cubes of pale brass grown through each other, striated.
    smoulderB: [
      '............',
      '.aaaab......',
      '.awaabb.....',
      '.abbbbbaaab.',
      '.abxbbbawabb',
      '.abbbxbabbbb',
      '.abxbbbabxbc',
      '.cbbbxbabbbc',
      '..cccccbxbbc',
      '......cbbbcc',
      '.......cccc.',
      '............',
    ],
    // Buzzmire: electrum, a lumpy nugget of the pale gold that is half silver.
    buzzmireB: [
      '............',
      '.....ab.....',
      '..ab.awb....',
      '.awbbabbb...',
      '.abxbbbbbab.',
      '..bbybbxbwbc',
      '.abbbbbbbxbc',
      'abxbbbcbbbc.',
      '.bbcbxccbc..',
      '..cc..cc....',
      '............',
      '............',
    ],
    // Hoarsand: kyanite, a sheaf of long blue blades, each streaked down its length with white.
    hoarsandB: [
      '.........ab.',
      '......ab.bbc',
      '.....abcabc.',
      '....abcabc..',
      '...abcabc.ab',
      '..abcabc.abc',
      '.abcabc.abc.',
      '.bcabc.abc..',
      '..abc.abc...',
      '...c.abc....',
      '.....bc.....',
      '............',
    ],
    // Kilnstone: goldstone, the violet kind, glass tumbled smooth with sparks of copper gold shut in it.
    kilnstoneB: [
      '............',
      '............',
      '.....aaab...',
      '...aawaabbb.',
      '..aaybabbybc',
      '.abbbbbbbbbc',
      '.abybbbbybcc',
      'abbbbbybbbcc',
      'abbybbbbbcc.',
      '.bbbbbybcc..',
      '..ccccccc...',
      '............',
    ],
    // Mouldstone: chrysoprase, apple green, grown in rounded clusters.
    mouldstoneB: [
      '............',
      '..aab...aab.',
      '.awabb.awabb',
      '.aabbbcaabbc',
      '..bbbcaabbcc',
      '.aab.cabbcc.',
      'awabbcbbcc..',
      'aabbbbbcc...',
      '.bbbbbcc....',
      '..bccc......',
      '............',
      '............',
    ],
  },
  frames: [
    ore('firnA', 'north', { a: '#8ab4ff', b: '#3a62d8', c: '#2030a0' }),
    ore('firnB', 'north', { a: '#fff4c0', w: '#ffffff', b: '#f0c040', c: '#a87020', x: '#2a5ad0' }),
    ore('seracA', 'north', { a: '#f0f4ff', b: '#7a78c8', c: '#3a4a7a' }),
    ore('seracB', 'north', { a: '#c090ff', b: '#8060e8', c: '#4a3098', x: '#80f0b0' }),
    ore('rimeA', 'north', { a: '#ffffff', b: '#ece6f2', c: '#a8a0c0', x: '#5aa8ff' }),
    ore('rimeB', 'north', { a: '#f0e8ff', b: '#c8b8f0', c: '#8a5ab8', x: '#ff90d8', y: '#90ffb8' }),
    ore('scoriaA', 'south', { a: '#fffcd0', b: '#f4f08c', c: '#b0a438' }),
    ore('scoriaB', 'south', { a: '#e8f6ff', b: '#9ad0ff', c: '#4a80d0', s: '#e0d0b8', S: '#c0a888' }),
    ore('forgeA', 'south', { a: '#ff80a8', b: '#e8205c', c: '#80102c', x: '#e8ecf8' }),
    ore('forgeB', 'south', { a: '#ffffff', b: '#c8ccd8', c: '#484c5e', x: '#e8402a' }),
    ore('magmaA', 'south', { a: '#fff0c8', b: '#f0a070', c: '#a05038' }),
    ore('magmaB', 'south', { a: '#d0ffa0', b: '#80d040', c: '#3a7a20', s: '#4a3a3a', S: '#2a2020' }),
    ore('tangleA', 'west', { a: '#9cf0b4', b: '#3cc070', c: '#1a6a40', x: '#0e4a2a' }),
    ore('tangleB', 'west', { a: '#ffffff', b: '#e8e0f0', c: '#b0a0c8', s: '#b8a890', S: '#8a7a64' }),
    ore('sporefallA', 'west', { a: '#e0ff90', b: '#a0ff40', d: '#7a5a3a', D: '#4a3420' }),
    ore('sporefallB', 'west', { a: '#ff9a7a', b: '#d84a3a', c: '#7a2020', x: '#50e0a0' }),
    ore('bloomA', 'west', { a: '#faffc0', b: '#e0f050', c: '#8aa020' }),
    ore('bloomB', 'west', { a: '#ffffff', b: '#e8e0ff', y: '#ffd040', d: '#3a2e48', D: '#241c30' }),
    ore('redrockA', 'east', { a: '#b0fff0', b: '#40d0c0', c: '#1e8a80', x: '#2a3a3a' }),
    ore('redrockB', 'east', { a: '#ffffff', b: '#d8d0f0', c: '#9890c0' }),
    ore('loessA', 'east', { a: '#a684d4', b: '#5e3c8e', c: '#2a1a46' }),
    ore('loessB', 'east', { a: '#5a7ae8', b: '#2a40b8', c: '#1a2470', y: '#ffd84a' }),
    ore('giltA', 'east', { a: '#ffa0b0', b: '#ff4060', c: '#a01838' }),
    ore('giltB', 'east', { g: '#70d0e0', G: '#30a080', r: '#ff80b0', R: '#c03070' }),
    ore('hoarstoneA', 'north', { a: '#e4e0ff', w: '#ffffff', b: '#a8a0f8', c: '#6a5ec0' }),
    ore('hoarstoneB', 'east', { a: '#ffd8c8', w: '#ffffff', b: '#f08a78', c: '#b04858', x: '#d06a70' }),
    ore('glassduneA', 'east', { a: '#ffe0e8', w: '#ffffff', b: '#e898a8', c: '#a85868' }),
    ore('glassduneB', 'south', { a: '#ff7aa8', w: '#ffe0ec', b: '#c0186a', c: '#6a0838', x: '#8a1050' }),
    ore('cinderfenA', 'south', { a: '#f0e6e0', w: '#ffffff', b: '#c4a898', c: '#6a5048', x: '#a83a20' }),
    ore('cinderfenB', 'west', { a: '#a8e0b0', b: '#5ab070', c: '#2e6a44', x: '#c8c0a8' }),
    ore('frostfenA', 'west', { a: '#f4fcf8', w: '#ffffff', b: '#c8dcd4', c: '#8aa8a0', g: '#3a8a3a' }),
    ore('frostfenB', 'north', { a: '#a0f8d0', w: '#e8fff8', b: '#3ad69a', c: '#1a8a4a', y: '#d8fff0' }),
    ore('glacierA', 'north', { a: '#d0fff0', w: '#ffffff', b: '#70f0c0', c: '#28a080' }),
    ore('glacierB', 'north', { a: '#ffffff', w: '#ffffff', b: '#eceaff', c: '#9a94c8', x: '#c8c0f0' }),
    ore('calderaA', 'south', { a: '#c08ae0', w: '#ffffff', b: '#2c2434', o: '#181420' }),
    ore('calderaB', 'south', { s: '#4a3028', S: '#2a1a16', g: '#40d0a0', G: '#a0ffd0', y: '#ffc040' }),
    ore('myceliumA', 'west', { a: '#d0fff0', w: '#ffffff', b: '#80e8c8', c: '#5a78c0' }),
    ore('myceliumB', 'west', { d: '#3a2a20', o: '#60a0ff', O: '#c0e0ff', w: '#ffffff', g: '#70f0a0', y: '#f0e060' }),
    ore('druseA', 'east', { a: '#ffffff', w: '#ffffff', b: '#fff2d0', c: '#c8b488', y: '#ffe070' }),
    ore('druseB', 'east', { a: '#f0ffa8', w: '#ffffff', b: '#c8f050', c: '#4a7a28', x: '#a8d040' }),
    ore('skarnA', 'north', { a: '#ffd8a0', w: '#ffffff', b: '#d87838', c: '#8a3e1c' }),
    ore('skarnB', 'ne', { a: '#9ab8ff', w: '#ffffff', b: '#4a5ee0', c: '#28248a', x: '#8250e6', r: '#38b8b0', y: '#f0c850' }),
    ore('obsidianA', 'east', { a: '#fff8c0', w: '#ffffff', b: '#c4cc44', c: '#5e5a3c' }),
    ore('obsidianB', 'se', { d: '#2a1a30', D: '#160c1c', w: '#ffffff', x: '#d03890', r: '#8048d8', g: '#30b8b0' }),
    ore('tarpitA', 'south', { a: '#fffbe6', w: '#ffffff', b: '#ece6b4', c: '#aaa078' }),
    ore('tarpitB', 'sw', { d: '#1c1a26', w: '#ffffff', g: '#2898d0', G: '#50d080', b: '#bee6e6' }),
    ore('muskegA', 'west', { a: '#8aa8ff', b: '#3c50c0', c: '#1e2470' }),
    ore('muskegB', 'nw', { a: '#c8f0ff', w: '#ffffff', b: '#6ec8dc', c: '#2a7a9a', x: '#e8fcff' }),
    ore('thawB', 'south', { a: '#fff4e8', w: '#ffffff', b: '#fad2aa', c: '#a0806a' }),
    ore('tundraB', 'west', { a: '#f0fff0', b: '#b4e678', c: '#6a9a48', x: '#e8fff8' }),
    ore('hailstoneB', 'east', { a: '#f4fbff', w: '#ffffff', g: '#82d2a0', G: '#4ea878', b: '#c8dce8', c: '#8aa4b8' }),
    ore('quenchB', 'north', { a: '#ffb0d0', w: '#ffffff', b: '#e65082', c: '#902050', x: '#c03a6a', g: '#60c070', G: '#2e7a40' }),
    ore('sootfenB', 'west', { a: '#e1dacd', b: '#beb4a5', c: '#786e64', d: '#3a302c', w: '#ffffff', s: '#e8e0d0', S: '#b0a890' }),
    ore('flashrockB', 'east', { a: '#f0f8d0', b: '#c8dc78', c: '#7a8a40', d: '#3a3a2a' }),
    ore('rimemossB', 'north', { a: '#f0f8ff', w: '#ffffff', b: '#c4def8', c: '#8496be', s: '#a89c90', S: '#6a6058' }),
    ore('smoulderB', 'south', { a: '#f0ecd2', w: '#ffffff', b: '#c4be96', c: '#787050', x: '#a09870' }),
    ore('buzzmireB', 'east', { a: '#ffffff', w: '#ffffff', b: '#e8e6d4', c: '#989282', x: '#c6c2ac', y: '#fff8dc' }),
    ore('hoarsandB', 'north', { a: '#a0c0ff', b: '#4678dc', c: '#203c8a', x: '#dce8ff' }),
    ore('kilnstoneB', 'south', { a: '#b48ce8', w: '#ffffff', b: '#783cbe', c: '#3a1a6a', y: '#ffe070' }),
    ore('mouldstoneB', 'west', { a: '#c8f8d0', w: '#ffffff', b: '#78dc8c', c: '#2e8a4a' }),
  ],

};

// ------------------------------------------------------------------ the corner shrines (generation 2)
// A shrine's heart, one on each diagonal 1,400 cells out in its deep seam (js/world.js: SHRINES): a stele of grey
// stone with a gem in it split between its two parents' colours, the first going round with the sun from the north
// in its upper half. Frames `shrine-<d>` in SHRINES' order (north-east, south-east, south-west, north-west), and
// each an animation of the same name that glints now and then, as a relic does.
const SHRINE = [
  '.....kkkk.....',
  '....kwsssk....',
  '....ksppSk....',
  '...kspppqSk...',
  '...ksppqqSk...',
  '...kspqqqSk...',
  '...ksqqqSSk...',
  '..kssSSSSSSk..',
  '..kSSkkkkSSk..',
  '.ksssssssSSSk.',
  '.kSSSSSSSSSSk.',
  'kssssssssSSSSk',
  'kSSSSSSSSSSSSk',
  '.kkkkkkkkkkkk.',
];
const GEM = { frost: ['#6ab8f0', '#d0f0ff'], ember: ['#ff9a2a', '#ffe08a'], mire: ['#8ad04a', '#d8ff98'], lode: ['#a070e8', '#e4d0ff'] };
const SHRINE_GEMS = [['frost', 'lode'], ['lode', 'ember'], ['ember', 'mire'], ['mire', 'frost']];
export const shrines = {
  version: 1, name: 'shrines', width: 16, height: 16,
  palette: { k: '#14101c', s: '#8a8498', S: '#4e4860', w: '#ffffff', p: '#000000', q: '#000000' },
  symbols: { shrine: SHRINE },
  frames: SHRINE_GEMS.flatMap(([a, b], d) => [
    { name: `shrine-${d}`, duration: 500, palette: { p: GEM[a][0], q: GEM[b][0] }, ops: [{ op: 'stamp', symbol: 'shrine', x: 1, y: 1 }] },
    { name: `shrine-${d}-glint`, duration: 160, palette: { p: GEM[a][1], q: GEM[b][1], s: '#b4aec4' }, ops: [{ op: 'stamp', symbol: 'shrine', x: 1, y: 1 }] },
  ]),
  animations: Object.fromEntries(SHRINE_GEMS.map((_, d) => [`shrine-${d}`, { frames: [`shrine-${d}`, `shrine-${d}`, `shrine-${d}`, `shrine-${d}-glint`] }])),
};

// ------------------------------------------------------------------ carved stones (generation 2)
// Ancient stone that is more than stone, which the lab can know. A tablet of a shrine's grey stone, set in the ring
// of ancient stone round its heart, with a diamond inlaid in it split between the shrine's two parents' colours as
// its heart's gem is, the first in the upper half, a line of light on the cut: `stone-<corner>`, in SHRINES' order
// by name (ne, se, sw, nw). And the builders' stone of their halls' walls: the same tablet in the ancient stone's
// own violet, a square spiral cut into it and laid with gold: `builders`. Each is drawn over the cell's stone and
// its plate, and is opaque over the middle twelve pixels each way, which is what the lab shows of it; the stone's
// own rim shows round it. (The builders' mark was first the plan of a hall, its walls, doors and store; at six
// pixels it was a face.)
const TABLET = Array.from({ length: 12 }, (_, y) => Array.from({ length: 12 }, (_, x) => {
  if (x === 0 || y === 0 || x === 11 || y === 11) return 'k';
  if (x === 10 || y === 10) return 'S';
  if (x === 1 || y === 1) return 'l';
  return x === 2 || y === 2 || x === 9 || y === 9 ? 'g' : 'm';
}).join(''));
// (The diamond in the tablet's field, eight pixels each way: the first parent where x + y is under 7, the line of
// light where it is 7, and the second beyond, with the shadow of its cutting under its lower edges. Rimmed dark all
// round, the rim ran into the groove round the field and the diamond read as a cross.)
const INLAY = Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => {
  const d = Math.abs(x - 3.5) + Math.abs(y - 3.5);
  return d > 4 ? '.' : d > 3 ? (x + y > 7 ? 'o' : '.') : x + y < 7 ? 'p' : x + y === 7 ? 'w' : 'q';
}).join(''));
const SPIRAL = ['yyyyyy', '.....y', 'yyyy.y', 'y..y.y', 'y....y', 'yyyyyy'];
const CORNER_NAMES = ['ne', 'se', 'sw', 'nw'];
export const stones = {
  version: 1, name: 'stones', width: 16, height: 16,
  palette: { k: '#14101c', l: '#b4aec4', S: '#4e4860', g: '#2e2838', m: '#6e6880', w: '#ffffff', o: '#2e2838', p: '#000000', q: '#000000', y: '#000000' },
  symbols: { tablet: TABLET, inlay: INLAY, spiral: SPIRAL },
  frames: [
    ...SHRINE_GEMS.map(([a, b], d) => ({ name: `stone-${CORNER_NAMES[d]}`, duration: 300, palette: { p: GEM[a][0], q: GEM[b][0] },
      ops: [{ op: 'stamp', symbol: 'tablet', x: 2, y: 2 }, { op: 'stamp', symbol: 'inlay', x: 4, y: 4 }] })),
    { name: 'builders', duration: 300, palette: { k: '#0e0a18', l: '#8a78c0', S: '#2c2244', g: '#1c1430', m: '#3a2f58', y: '#f0c848' },
      ops: [{ op: 'stamp', symbol: 'tablet', x: 2, y: 2 }, { op: 'stamp', symbol: 'spiral', x: 5, y: 5 }] },
  ],
};

export const RECIPES = [finds, cracks, dish, frost, ember, mire, lode, ores, minerals, drill, core, station, icons, upgrades, ui, logo, tough, bell, vent, worm, lodestone, fauna, shrines, stones];

// The home-screen icon: the core on dark ground, with the drill out on its tether.
// (The core as the first winch was drawn before each winch was one of its own, in the colours it had then.)
const iconCore = [
  { op: 'ellipse', x: 2, y: 2, w: 44, h: 44, color: 'k', filled: true },
  { op: 'ellipse', x: 3, y: 3, w: 42, h: 42, color: 'l', filled: true },
  { op: 'ellipse', x: 4, y: 4, w: 41, h: 41, color: 'm', filled: true },
  { op: 'ellipse', x: 6, y: 6, w: 39, h: 39, color: 'M', filled: true },
  { op: 'ellipse', x: 6, y: 6, w: 37, h: 37, color: 'm', filled: true },
  { op: 'ellipse', x: 10, y: 10, w: 28, h: 28, color: 'k', filled: true },
  { op: 'ellipse', x: 11, y: 11, w: 26, h: 26, color: 'D', filled: true },
  { op: 'ellipse', x: 14, y: 14, w: 20, h: 20, color: 'g', filled: true },
  { op: 'ellipse', x: 17, y: 17, w: 14, h: 14, color: 'G', filled: true },
  { op: 'ellipse', x: 20, y: 20, w: 8, h: 8, color: 'w', filled: true },
  // sockets
  ...[[20, 1], [20, 39], [1, 20], [39, 20]].flatMap(([x, y]) => [
    { op: 'rect', x, y, w: 8, h: 8, color: 'k', filled: true },
    { op: 'rect', x: x + 1, y: y + 1, w: 6, h: 6, color: 'M', filled: true },
    { op: 'rect', x: x + 2, y: y + 2, w: 4, h: 4, color: 'D', filled: true },
  ]),
  // rivets
  ...[[9, 9], [38, 9], [9, 38], [38, 38]].flatMap(([x, y]) => [
    { op: 'pixel', x, y, color: 'l' }, { op: 'pixel', x: x + 1, y: y + 1, color: 'k' },
  ]),
];
const shift = (ops, dx, dy) => ops.map(op => ({ ...op, x: op.x + dx, y: op.y + dy }));
export const appIcon = {
  version: 1, name: 'icon', width: 64, height: 64,
  palette: { k: '#16121c', l: '#c8ccd8', m: '#8a90a2', M: '#5a6074', D: '#1e2a44', g: '#2a78c8', G: '#5cc4f0', w: '#eafcff', h: '#9af0d8', N: '#bfe6ff', S: '#ffb060', W: '#b8f06a', E: '#d8b8ff',
    ...drill.palette, k: '#16121c', q: '#0c0a12', e: '#2a211c', E: '#3a2e26', t: '#f4ecd8' },
  symbols: { drill: DRILL },
  frames: [{ name: 'icon', ops: [
    { op: 'rect', x: 0, y: 0, w: 64, h: 64, color: 'q', filled: true },
    { op: 'rect', x: 0, y: 40, w: 64, h: 24, color: 'e', filled: true },
    { op: 'rect', x: 0, y: 40, w: 64, h: 2, color: 'E', filled: true },
    { op: 'line', x: 26, y: 26, x2: 50, y2: 50, color: 't' },
    ...shift(iconCore, 2, 2),
    { op: 'stamp', symbol: 'drill', x: 44, y: 44, rotate: 90 },
  ] }],
};
