// The hand-drawn recipes: what lies in the rock, the drill, the core, the interface.
// Ore and hazard drawings are 12 x 12 in the middle of a 16 x 16 frame, so they sit inside a tile's rim.

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
    v: '#b060d0', V: '#7a3a9a', u: '#f0c0f8', y: '#f4d86a', g: '#b8f06a', G: '#5cb848', D: '#2a7a3a' },
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
      '............',
      '............',
      '....kkkk....',
      '...kvvvVk...',
      '..kvuvvvVk..',
      '..kvvvuvVk..',
      '..kvvvvVVk..',
      '..kVvuVVVk..',
      '...kVVVVk...',
      '....kkkk....',
      '............',
      '............',
    ],
    relic: RELIC,
  },
  frames: [frame('dense', 'dense'), frame('oreA', 'oreA'), frame('oreB', 'oreB'),
    frame('hazard', 'pod', { duration: 500 }), frame('hazard-b', 'pod', { duration: 220, palette: { u: '#ffffff', v: '#c880e8' } }),
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
const SPIN = { s: 'S', S: 's' };
const DIRS = ['right', 'down', 'left', 'up'];
// Each better bit is a different metal: steel, bronze, blue steel, gold, diamond.
export const BITS = [
  { s: '#eef2f8', S: '#8c96a8' }, { s: '#f4cc94', S: '#b4703a' }, { s: '#bfe4ff', S: '#4a86c8' }, { s: '#fff2a0', S: '#e0a020' }, { s: '#e6fffa', S: '#38dcd0' },
];
// The ram bolts on to the body: fins, longer fins, a thruster, then a second pair of fins and a lit thruster.
const blank = () => Array.from({ length: 16 }, () => Array(16).fill('.'));
const put = (g, y, x0, x1, c) => { for (let x = x0; x <= x1; x++) g[y][x] = c; };
const RAMS = [1, 2, 3, 4].map(level => {
  const g = blank();
  const fin = level >= 2 ? 7 : 5;
  put(g, 2, 3, fin, 'r'); put(g, 13, 3, fin, 'r'); put(g, 1, 3, fin - 1, 'k'); put(g, 14, 3, fin - 1, 'k');
  if (level >= 3) { for (let y = 6; y <= 9; y++) put(g, y, 0, 1, y === 6 || y === 9 ? 'k' : 'r'); }
  if (level >= 4) { put(g, 1, 3, 5, 'y'); put(g, 14, 3, 5, 'y'); put(g, 0, 3, 4, 'k'); put(g, 15, 3, 4, 'k'); put(g, 7, 0, 0, 'y'); put(g, 8, 0, 0, 'y'); }
  return g.map(row => row.join(''));
});
// The hull's plates are riveted over the body: a band of steel behind the bit, a second at the tail, then a rim
// along both flanks, then bright rivets on every band.
const PLATES = [1, 2, 3, 4].map(level => {
  const g = blank();
  for (let y = 4; y <= 11; y++) g[y][9] = y === 4 ? 'P' : 'p';
  if (level >= 2) for (let y = 4; y <= 11; y++) g[y][3] = y === 4 ? 'P' : 'p';
  if (level >= 3) { put(g, 4, 3, 9, 'P'); put(g, 11, 3, 9, 'p'); }
  if (level >= 4) for (const [x, y] of [[9, 6], [9, 9], [3, 6], [3, 9], [6, 4], [6, 11]]) g[y][x] = 'R';
  return g.map(row => row.join(''));
});
// What is fitted to the drill shows on it: the mender's green lamp, the lava skin's red-hot keel, the spore drive's
// two green vents at the tail, the arc coil's yellow winding between body and bit, the diamond tip's glint at the
// point of the bit.
const fit = cells => { const g = blank(); for (const [x, y, c] of cells) g[y][x] = c; return g.map(row => row.join('')); };
const FITS = {
  mender: fit([[7, 8, 'M'], [8, 8, 'm'], [7, 9, 'm'], [8, 9, 'm']]),
  lavaskin: fit([3, 4, 5, 6, 7, 8, 9].flatMap(x => [[x, 11, 'r'], [x, 10, x % 2 ? 'r' : 'o']])),
  sporedrive: fit([[1, 5, 'k'], [1, 6, 'g'], [2, 6, 'g'], [1, 7, 'k'], [1, 8, 'k'], [1, 9, 'g'], [2, 9, 'g'], [1, 10, 'k'], [0, 6, 'k'], [0, 9, 'k']]),
  arccoil: fit([[10, 5, 'y'], [10, 7, 'y'], [10, 8, 'y'], [10, 10, 'y']]),
  diamond: fit([[14, 7, 'w'], [14, 8, 'c'], [13, 7, 'w'], [13, 8, 'w']]),
};
export const drill = {
  version: 1, name: 'drill', width: 16, height: 16,
  palette: { k: '#1c1420', b: '#ffd83a', d: '#e08a1c', c: '#3ab8e8', w: '#eafcff', s: '#eef2f8', S: '#8c96a8', r: '#ff5a3a', y: '#ffe14a', p: '#77829a', P: '#aab4c8', R: '#ffffff', m: '#5cc040', M: '#d8ffb0', g: '#8ce060', o: '#ffb060' },
  symbols: { drill: DRILL, ...Object.fromEntries(RAMS.map((rows, n) => [`ram${n + 1}`, rows])), ...Object.fromEntries(PLATES.map((rows, n) => [`plate${n + 1}`, rows])), ...Object.fromEntries(Object.entries(FITS).map(([id, rows]) => [`fit-${id}`, rows])) },
  frames: [
    ...BITS.flatMap((bit, level) => DIRS.flatMap((dir, i) => [
      { name: `${dir}-a-${level}`, duration: 70, palette: bit, ops: [{ op: 'stamp', symbol: 'drill', x: 0, y: 0, ...(i && { rotate: i * 90 }) }] },
      { name: `${dir}-b-${level}`, duration: 70, palette: bit, ops: [{ op: 'stamp', symbol: 'drill', x: 0, y: 0, ...(i && { rotate: i * 90 }), remap: SPIN }] },
    ])),
    ...RAMS.flatMap((rows, n) => DIRS.map((dir, i) => ({ name: `ram-${dir}-${n + 1}`, ops: [{ op: 'stamp', symbol: `ram${n + 1}`, x: 0, y: 0, ...(i && { rotate: i * 90 }) }] }))),
    ...PLATES.map((rows, n) => ({ name: `plate-right-${n + 1}`, ops: [{ op: 'stamp', symbol: `plate${n + 1}`, x: 0, y: 0 }] })),
    ...Object.keys(FITS).map(id => ({ name: `fit-${id}`, ops: [{ op: 'stamp', symbol: `fit-${id}`, x: 0, y: 0 }] })),
  ],
  animations: Object.fromEntries(BITS.flatMap((bit, level) => DIRS.map(dir => [`${dir}-${level}`, { frames: [`${dir}-a-${level}`, `${dir}-b-${level}`] }]))),
};

// ------------------------------------------------------------------ the core
// Three cells across: a riveted ring round a lit well, with a socket on each side for what the four directions hide.
const coreOps = [
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
// A better winch is a better station: iron, steel, bronze, brass, gold, then gold gone radiant; from brass on it
// grows teeth.
export const HULLS = [
  { l: '#c8ccd8', m: '#8a90a2', M: '#5a6074' }, { l: '#dce8f8', m: '#8aa4c8', M: '#566e94' }, { l: '#f4cc94', m: '#c48c52', M: '#84582c' },
  { l: '#ffe8a4', m: '#dcac44', M: '#986e1c' }, { l: '#fff6bc', m: '#f4c434', M: '#b48010' }, { l: '#ffffff', m: '#ffe468', M: '#e49c20' },
];
const teeth = [[22, 0, 4, 3], [22, 45, 4, 3], [0, 22, 3, 4], [45, 22, 3, 4], [6, 6, 4, 4], [38, 6, 4, 4], [6, 38, 4, 4], [38, 38, 4, 4]]
  .flatMap(([x, y, w, h]) => [{ op: 'rect', x, y, w, h, color: 'k', filled: true }, { op: 'rect', x: x + (w > 3 ? 1 : 0), y: y + (h > 3 ? 1 : 0), w: Math.min(w, 2), h: Math.min(h, 2), color: 'l', filled: true }]);
const GLOWS = { a: {}, b: { g: '#3a90dc', G: '#84dcff' }, c: { g: '#5cc4f0', G: '#c8f4ff', D: '#2a4a78' }, flash: { g: '#c8f4ff', G: '#ffffff', D: '#5cc4f0' } };
export const core = {
  version: 1, name: 'core', width: 48, height: 48,
  palette: { k: '#16121c', l: '#c8ccd8', m: '#8a90a2', M: '#5a6074', D: '#1e2a44', g: '#2a78c8', G: '#5cc4f0', w: '#eafcff' },
  frames: HULLS.flatMap((hull, level) => Object.entries(GLOWS).map(([glow, lit]) => ({
    name: `core-${glow}-${level}`, duration: glow === 'flash' ? 80 : 260, palette: { ...hull, ...lit },
    ops: [...(level >= 3 ? teeth : []), ...coreOps, ...(level >= 5 ? [{ op: 'ellipse', x: 12, y: 12, w: 24, h: 24, color: 'w' }] : [])],
  }))),
  animations: Object.fromEntries(HULLS.map((hull, level) => [`idle-${level}`, { frames: [`core-a-${level}`, `core-b-${level}`, `core-c-${level}`, `core-b-${level}`] }])),
};

// The scanner is a dish on the station's shoulder; each level raises the mast and widens the dish.
export const dish = {
  version: 1, name: 'dish', width: 16, height: 16,
  palette: { k: '#16121c', s: '#8a90a2', l: '#d8e4f4', c: '#5fe0d0', r: '#ff5a4a' },
  frames: [0, 1, 2, 3, 4].flatMap(level => {
    const h = 4 + level * 2, w = 1 + level, top = 14 - h;
    const ops = [
      { op: 'line', x: 8, y: 15, x2: 8, y2: top + 1, color: 's' },
      { op: 'line', x: 8 - w, y: top, x2: 8 + w, y2: top, color: 'l' },
      { op: 'pixel', x: 8 - w, y: top - 1, color: 'l' }, { op: 'pixel', x: 8 + w, y: top - 1, color: 'l' },
      ...(level >= 2 ? [{ op: 'pixel', x: 8 - w, y: top - 2, color: 'l' }, { op: 'pixel', x: 8 + w, y: top - 2, color: 'l' }] : []),
      { op: 'pixel', x: 8, y: top - 1, color: 'c' },
      { op: 'outline', color: 'k', position: 'outside' },
    ];
    return [{ name: `dish-${level}`, duration: 500, ops }, { name: `dish-${level}-b`, duration: 160, ops, palette: { c: '#ffffff' } }];
  }),
  animations: Object.fromEntries([0, 1, 2, 3, 4].map(level => [`dish-${level}`, { frames: [`dish-${level}`, `dish-${level}-b`] }])),
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
const SPECIMEN = ['..aaa...', '.abaac..', 'abaaaac.', 'aaaaacc.', 'aaaaccc.', '.aaccc..', '..ccc...', '........'];
export const icons = {
  version: 1, name: 'icons', width: 10, height: 10,
  palette: { k: '#16121c', w: '#ffffff', i: '#bfe6ff', o: '#ff7a1c', y: '#ffd84a', W: '#fff6c8', g: '#8ce060', G: '#4aa040', s: '#d8d0c0',
    p: '#d8b8ff', q: '#ffffff', P: '#8a5ad8', z: '#ffe14a', d: '#9a8a74', l: '#d4c4a8', D: '#6a5c4c', a: '#bfe6ff', b: '#ffffff', c: '#5a9ad8' },
  frames: [
    ...Object.entries(icons8).map(([name, rows]) => ({ name, ops: [{ op: 'grid', x: 1, y: 1, rows }, { op: 'outline', color: 'k', position: 'outside' }] })),
    // A specimen: a cut stone, six-sided, in the colour of the direction it was found in (north, south, west,
    // east, as the gems are). One drawing, each frame with its own three colours.
    ...[['frost', '#bfe6ff', '#ffffff', '#5a9ad8'], ['ember', '#ffb060', '#fff6c8', '#c8501c'], ['mire', '#b8f06a', '#f4ffd8', '#4aa040'], ['lode', '#d8b8ff', '#ffffff', '#8a5ad8']]
      .map(([name, a, b, c]) => ({ name: `spec-${name}`, palette: { a, b, c }, ops: [{ op: 'grid', x: 1, y: 1, rows: SPECIMEN }, { op: 'outline', color: 'k', position: 'outside' }] })),
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
export const finds = {
  version: 1, name: 'finds', width: 16, height: 16,
  palette: { k: '#1c1420', y: '#ffd84a', Y: '#fff2a0', b: '#9a6638', o: '#5e3a22', S: '#8e98ac', s: '#e2e8f4', d: '#565e72', g: '#5cc4f0', G: '#c8f4ff',
    i: '#8a94a8', I: '#eef4ff', r: '#b0603a', w: '#ffffff', m: '#bfe6ff', R: '#4fd0e8' },
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
  },
  frames: [frame('cache', 'cache'), frame('part', 'part'), frame('key', 'key'),
    frame('prism', 'prism', { duration: 240 }),
    frame('prism-b', 'prism', { duration: 240, palette: { m: '#ffb060', R: '#c8442a' } }),
    frame('prism-c', 'prism', { duration: 240, palette: { m: '#b8f06a', R: '#d8b8ff' } })],
  animations: { prism: { frames: ['prism', 'prism-b', 'prism-c'] } },
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

export const RECIPES = [finds, cracks, dish, frost, ember, mire, lode, minerals, drill, core, icons, upgrades, ui, logo, tough, bell, vent, worm, lodestone];

// The home-screen icon: the core on dark ground, with the drill out on its tether.
const shift = (ops, dx, dy) => ops.map(op => ({ ...op, x: op.x + dx, y: op.y + dy }));
export const appIcon = {
  version: 1, name: 'icon', width: 64, height: 64,
  palette: { ...core.palette, ...drill.palette, k: '#16121c', q: '#0c0a12', e: '#2a211c', E: '#3a2e26', t: '#f4ecd8' },
  symbols: { drill: DRILL },
  frames: [{ name: 'icon', ops: [
    { op: 'rect', x: 0, y: 0, w: 64, h: 64, color: 'q', filled: true },
    { op: 'rect', x: 0, y: 40, w: 64, h: 24, color: 'e', filled: true },
    { op: 'rect', x: 0, y: 40, w: 64, h: 2, color: 'E', filled: true },
    { op: 'line', x: 26, y: 26, x2: 50, y2: 50, color: 't' },
    ...shift(coreOps, 2, 2),
    { op: 'stamp', symbol: 'drill', x: 44, y: 44, rotate: 90 },
  ] }],
};
