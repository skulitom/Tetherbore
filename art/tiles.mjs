// The terrain sets, as Pixelbolt autotile sources. Each biome is one blob set (47 tiles, three fills), lit from the
// upper left: a light rim on the north and west faces, a dark one with a cast shadow on the south and east.
// The floors are the same fills in the dark, for the ground the drill has already cut away.

import { drawn, VARIANTS } from './fills.mjs';

const rock = (name, palette, fill, seed) => ({
  format: 'pixelforge-autotile', version: 1, name, tile: 16, palette,
  terrain: {
    seed,
    fill,
    // A block fills its cell, so one block alone is as wide as each of two side by side: no margin on the lit
    // faces, one pixel on the dark ones for the shadow it casts.
    edges: {
      all: { depth: 0, jitter: 0, bands: ['k', 'D'] },
      n: { bands: ['k', 'L'] },
      w: { bands: ['k', 'L'] },
      s: { depth: 1, bands: ['k', 'D'], outside: ['s'] },
      e: { depth: 1, bands: ['k', 'D'], outside: ['s'] },
    },
    round: 1, inner: 1,
  },
  frame: `${name}-{mask}-{variant}`,
  variants: [
    { name: 'a', weight: 1 },
    { name: 'b', weight: 1, terrain: { fill: { seed: seed + 7 } } },
    { name: 'c', weight: 1, terrain: { fill: { seed: seed + 19 } } },
  ],
  sheet: { columns: 16 },
});

const floor = (name, palette, fill, seed) => ({
  format: 'pixelforge-autotile', version: 1, name, tile: 16, palette,
  terrain: { seed, fill },
  frame: `${name}-{mask}-{variant}`,
  variants: [{ name: 'a' }, { name: 'b', terrain: { fill: { seed: seed + 5 } } }],
  sheet: { columns: 16 },
});

export const ROCKS = [
  // The loam the core was buried in: soft, plain, the first thing anyone cuts.
  rock('crust', { k: '#241a16', D: '#4d3d33', L: '#a08a6c', s: '#0c080859', f: '#6f5b49', a: '#5e4c3d', b: '#806a55', c: '#93805f' },
    { color: 'f', speckle: [{ color: 'a', amount: 0.22, size: 5 }, { color: 'b', amount: 0.14, size: 4 }, { color: 'c', amount: 0.03, size: 2 }] }, 3),
  // North: packed snow over blue ice.
  rock('frost', { k: '#22395a', D: '#7fa3cc', L: '#ffffff', s: '#06102659', f: '#bcd8ee', a: '#a2c4e2', b: '#d6eaf8', c: '#f4fbff' },
    { color: 'f', speckle: [{ color: 'a', amount: 0.2, size: 6 }, { color: 'b', amount: 0.18, size: 4 }, { color: 'c', amount: 0.04, size: 2 }] }, 11),
  // South: basalt with embers in it.
  rock('ember', { k: '#160808', D: '#3e1e20', L: '#c07a5c', s: '#00000066', f: '#74403a', a: '#5e3230', b: '#8a5044', c: '#ff8a3a' },
    { color: 'f', speckle: [{ color: 'a', amount: 0.24, size: 5 }, { color: 'b', amount: 0.14, size: 4 }, { color: 'c', amount: 0.025, size: 2 }] }, 23),
  // West: violet loam under moss.
  rock('mire', { k: '#17101f', D: '#3c2f50', L: '#9ad062', s: '#05020a59', f: '#665478', a: '#574766', b: '#5f9450', c: '#b4e878' },
    { color: 'f', speckle: [{ color: 'a', amount: 0.2, size: 6 }, { color: 'b', amount: 0.11, size: 5 }, { color: 'c', amount: 0.025, size: 2 }] }, 31),
  // East: sandstone.
  rock('lode', { k: '#3a2212', D: '#8a5c38', L: '#f0d8a0', s: '#1a0c0459', f: '#b98a5a', a: '#a57648', b: '#cca06c', c: '#e4c68e' },
    { color: 'f', speckle: [{ color: 'a', amount: 0.2, size: 6 }, { color: 'b', amount: 0.18, size: 4 }, { color: 'c', amount: 0.04, size: 2 }] }, 43),
  // Hard stone, the same in every direction: it takes a better bit, or a cut round it.
  rock('slate', { k: '#14161e', D: '#454a5a', L: '#a4acbc', s: '#00000066', f: '#6a7080', a: '#5a6070', b: '#7c8494', c: '#8e96a6' },
    { color: 'f', speckle: [{ color: 'a', amount: 0.26, size: 6 }, { color: 'b', amount: 0.16, size: 5 }, { color: 'c', amount: 0.02, size: 2 }] }, 53),
  // Ancient stone, harder still.
  rock('vault', { k: '#0e0a18', D: '#2c2244', L: '#8a78c0', s: '#00000066', f: '#463a68', a: '#3a2f58', b: '#54487a', c: '#c8a8ff' },
    { color: 'f', speckle: [{ color: 'a', amount: 0.26, size: 6 }, { color: 'b', amount: 0.16, size: 5 }, { color: 'c', amount: 0.015, size: 1 }] }, 61),
  // The edge of the world.
  rock('bedrock', { k: '#050508', D: '#121218', L: '#34343e', s: '#00000066', f: '#1e1e26', a: '#18181f', b: '#26262f', c: '#2c2c36' },
    { color: 'f', speckle: [{ color: 'a', amount: 0.3, size: 6 }, { color: 'b', amount: 0.14, size: 4 }, { color: 'c', amount: 0.02, size: 2 }] }, 71),
  // Ice that has closed over a cut in the north.
  rock('ice', { k: '#1c3a66', D: '#3f78b8', L: '#d8f4ff', s: '#06102659', f: '#6fb0e0', a: '#5a9cd2', b: '#8cc8ee', c: '#e8fbff' },
    { color: 'f', speckle: [{ color: 'a', amount: 0.22, size: 6 }, { color: 'b', amount: 0.16, size: 3 }, { color: 'c', amount: 0.03, size: 1 }] }, 83),
  // Lava gone cold in the south.
  rock('basalt', { k: '#0c0608', D: '#241a22', L: '#7a6a78', s: '#00000066', f: '#463e4c', a: '#3a3240', b: '#544a5a', c: '#8a3424' },
    { color: 'f', speckle: [{ color: 'a', amount: 0.26, size: 4 }, { color: 'b', amount: 0.14, size: 3 }, { color: 'c', amount: 0.03, size: 2 }] }, 89),
  // The far flanks: each direction's ground gone strange.
  rock('rime', { k: '#0e2a3a', D: '#2f7a8a', L: '#d8fff4', s: '#02101a59', f: '#62b8b4', a: '#4aa0a4', b: '#84d4c8', c: '#f0fff8' },
    { color: 'f', speckle: [{ color: 'a', amount: 0.22, size: 6 }, { color: 'b', amount: 0.18, size: 4 }, { color: 'c', amount: 0.05, size: 2 }] }, 101),
  rock('magma', { k: '#1a0606', D: '#4a1410', L: '#e8743a', s: '#00000066', f: '#7a2418', a: '#5e1a12', b: '#96321e', c: '#ffb040' },
    { color: 'f', speckle: [{ color: 'a', amount: 0.24, size: 5 }, { color: 'b', amount: 0.16, size: 4 }, { color: 'c', amount: 0.04, size: 2 }] }, 103),
  rock('bloom', { k: '#1f0a24', D: '#5a2460', L: '#ffa0e0', s: '#0a020c59', f: '#8a3c8c', a: '#702e74', b: '#b054a8', c: '#7af0d0' },
    { color: 'f', speckle: [{ color: 'a', amount: 0.22, size: 5 }, { color: 'b', amount: 0.18, size: 5 }, { color: 'c', amount: 0.035, size: 2 }] }, 107),
  rock('gilt', { k: '#1c1408', D: '#4a3a1c', L: '#ffe680', s: '#0c080259', f: '#6e5a34', a: '#5a4828', b: '#8a7240', c: '#ffd040' },
    { color: 'f', speckle: [{ color: 'a', amount: 0.22, size: 6 }, { color: 'b', amount: 0.16, size: 4 }, { color: 'c', amount: 0.06, size: 2 }] }, 109),
];

// ---- the strains
// Two named kinds of each direction's ground, laid as provinces. Each keeps its direction's hue family, so colour
// still says which gem the ground pays, and lies over its kin's floor. Their fills are drawn (art/fills.mjs): clumps
// as above, then the marks that make the ground itself. Marks show the tile's grid sooner than clumps do, so a strain
// has five variants where the older sets have three.
const strain = (name, palette, seed, draw) => {
  const [first, ...rest] = drawn(seed, draw);
  return { ...rock(name, palette, { pattern: first }, seed), variants: [
    { name: 'a', weight: 1 },
    ...rest.map((pattern, n) => ({ name: VARIANTS[n + 1], weight: 1, terrain: { fill: { pattern } } })),
  ] };
};

export const STRAINS = [
  // North. Firn: old ice, massive and dull, in level sheets.
  strain('firn', { k: '#1c2e4a', D: '#5f7ea8', L: '#eef6ff', s: '#06102659', f: '#9ab4d2', a: '#8ca8c8', b: '#a8c0dc', c: '#dcecf8' }, 113, fill => {
    fill.clumps('a', 0.26, 5).clumps('b', 0.16, 4);
    for (const [x, y] of fill.places(3, 4, 2)) fill.line(x, y, x + fill.int(3, 5), y, 'b');
    fill.dots('c', 2, 2);
  }),
  // Serac: shattered ice, white shards between blue cracks.
  strain('serac', { k: '#2a4a72', D: '#8ab8e0', L: '#ffffff', s: '#06102659', f: '#eaf8ff', a: '#cfe8f8', b: '#ffffff', c: '#6cb2e4' }, 127, fill => {
    fill.clumps('a', 0.28, 5).clumps('b', 0.12, 3);
    // One long fracture from side to side with a kink in it, and a splinter or two off it.
    const flat = fill.next() < 0.5, p = fill.int(2, 13), q = fill.int(2, 13), m = fill.int(5, 10), n = fill.int(3, 12);
    const [x0, y0, x1, y1, xm, ym] = flat ? [1, p, 14, q, m, n] : [p, 1, q, 14, n, m];
    fill.line(x0, y0, xm, ym, 'c').line(xm, ym, x1, y1, 'c');
    for (let i = fill.int(1, 2); i > 0; i--) {
      const t = fill.int(2, 8) / 10, x = Math.round(x0 + (xm - x0) * t), y = Math.round(y0 + (ym - y0) * t), far = fill.int(3, 5), side = fill.next() < 0.5 ? 1 : -1;
      fill.wander(x, y, flat ? [[1, side], [0, side], [0, side]] : [[side, 1], [side, 0], [side, 0]], far, 'c', 2);
    }
  }),
  // South. Scoria: froth gone hard, full of bubbles. A bubble is dark under its near lip and lit on its far one.
  strain('scoria', { k: '#1a0a08', D: '#4a2420', L: '#dc9c7c', s: '#00000066', f: '#96584a', a: '#7a4438', b: '#aa6c58', c: '#2a1210', l: '#cc9274' }, 131, fill => {
    fill.clumps('a', 0.22, 4).clumps('b', 0.14, 3);
    const BUBBLES = [['.cc.', 'cDDl', 'cDDl', '.ll.'], ['cc.', 'cDl', '.ll'], ['cD', 'Dl'], ['c.', '.l'], ['c.', '.l'], ['D']];
    fill.places(6, 4, 1).forEach(([x, y], i) => { const rows = BUBBLES[i]; fill.stamp(Math.min(x, 15 - rows.length), Math.min(y, 15 - rows.length), rows); });
  }),
  // Forge: clinker, dark and cindery, still lit in short cracks: bright at the middle, dim at the ends.
  strain('forge', { k: '#120808', D: '#34222a', L: '#b89080', s: '#00000066', f: '#664644', a: '#523838', b: '#7e5a56', c: '#ff9a3a', o: '#b84a22' }, 137, fill => {
    fill.clumps('a', 0.28, 4).clumps('b', 0.16, 3);
    const WAYS = [[1, 0], [1, 1], [0, 1], [-1, 1]];
    for (const [x, y] of fill.places(2, 6, 3)) {
      const [dx, dy] = WAYS[fill.int(0, 3)];
      fill.set(x, y, 'c').set(x + dx, y + dy, fill.next() < 0.5 ? 'c' : 'o').set(x - dx, y - dy, 'o');
    }
    fill.dots('o', 2, 2);
  }),
  // West. Tangle: deep moss shot through with roots.
  strain('tangle', { k: '#0e1a12', D: '#24402c', L: '#a8e070', s: '#05020a59', f: '#3e5a40', a: '#324a36', b: '#5a4a70', c: '#c8f08a', r: '#5e8a48' }, 139, fill => {
    fill.clumps('a', 0.22, 6).clumps('b', 0.12, 5);
    for (const [x, y] of fill.places(3, 5, 2)) {
      const dx = fill.next() < 0.5 ? 1 : -1;
      fill.wander(x, y, [[dx, 1], [0, 1], [0, 1], [dx, 0]], fill.int(5, 8), 'r');
    }
    fill.dots('c', 3, 2);
  }),
  // Sporefall: pale ground dusted with what the pods let fall.
  strain('sporefall', { k: '#22142c', D: '#5a4070', L: '#f0c8ff', s: '#05020a59', f: '#a888b8', a: '#9a7aac', b: '#b898c6', c: '#b4e878', g: '#6aa050' }, 149, fill => {
    fill.clumps('a', 0.2, 4).clumps('b', 0.16, 3).dots('c', 4, 1).dots('g', 3, 1);
  }),
  // East. Redrock: iron sandstone in level beds. The beds meet a block's sides at the same rows in every variant,
  // so they run on through the ground; inside a block a bed steps up or down a pixel here and there.
  strain('redrock', { k: '#2e120a', D: '#703420', L: '#f0b080', s: '#1a0c0459', f: '#a85a3a', a: '#904830', b: '#bc6e48', c: '#e09a6a' }, 151, fill => {
    const BEDS = 'fffabbcfffaabbbf';
    const steps = [0, 1, 2].map(() => ({ x: fill.int(2, 8), w: fill.int(3, 6), y: fill.int(0, 15), h: fill.int(4, 7), by: fill.next() < 0.5 ? 1 : -1 }));
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const lift = steps.reduce((sum, s) => sum + (x >= s.x && x < s.x + s.w && (y - s.y + 16) % 16 < s.h ? s.by : 0), 0);
      fill.set(x, y, BEDS[(y + lift + 16) % 16]);
    }
    fill.dots('a', 4, 1).dots('b', 4, 1);
  }),
  // Loess: pale silt, soft, that stands in fine upright grain.
  strain('loess', { k: '#4a4030', D: '#a89878', L: '#ffffff', s: '#1a140c59', f: '#e4dcc8', a: '#d4cab0', b: '#f0ead8', c: '#fffaf0', g: '#c4b898' }, 157, fill => {
    fill.clumps('a', 0.18, 5).clumps('b', 0.14, 4);
    for (const [x, y] of fill.places(5, 3, 2)) fill.line(x, y, x, y + fill.int(1, 2), 'g');
    fill.dots('c', 2, 2);
  }),
];

// ---- the pockets
// Small places with ground of their own, a mineral and one rule each. A pocket has to read at a glance as somewhere
// else: its ground looks like none of the directions' grounds, and it lies over a floor of its own, which is drawn
// too (three variants unless more are asked for: a floor is only ever seen dark).
const drawnFloor = (name, palette, seed, draw, variants = 3) => {
  const [first, ...rest] = drawn(seed, draw).slice(0, variants);
  return { ...floor(name, palette, { pattern: first }, seed), variants: [
    { name: 'a' },
    ...rest.map((pattern, n) => ({ name: VARIANTS[n + 1], terrain: { fill: { pattern } } })),
  ] };
};

// Honeycomb: cells eight pixels wide in rows eight apart, every other row half a cell along. The comb is the same
// in every variant and meets a tile's sides at the same places, so it runs on through the wax.
const COMB = [[2, 3, 5, 6], [1, 7], [0], [0], [0], [0], [0], [0], [1, 2, 6, 7], [3, 5], [4], [4], [4], [4], [4], [4]];
const onComb = (x, y) => COMB[(y + 16) % 16].includes((x + 16) % 8);
// The comb's walls in one colour and, if a second is given, the shade they throw into each cell from the upper left.
const comb = (fill, wall, shade) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (onComb(x, y)) fill.set(x, y, wall);
    else if (shade && (onComb(x - 1, y) || onComb(x, y - 1))) fill.set(x, y, shade);
  }
};
// One cell filled, every pixel of it that is not wall: the left or the right cell of the upper row, which lie whole
// in the tile, or the one whole cell of the lower row, whose last four pixels lie in the tile below and are left.
const CELL = ['...#...', '.#####.', '#######', '#######', '#######', '#######', '#######', '#######', '..###..', '...#...'];
const LOWER = ['...#...', '.#####.', '#######', '#######', '#######', '#######', '#######', '#######'];
const cell = (fill, which, key, glint) => {
  const [x0, y0, rows] = which === 'lower' ? [5, 8, LOWER] : [which === 'right' ? 9 : 1, 0, CELL];
  rows.forEach((row, v) => [...row].forEach((on, u) => { if (on === '#') fill.set(x0 + u, y0 + v, key); }));
  if (glint) fill.set(x0 + 1, y0 + 3, glint).set(x0 + 2, y0 + 2, glint);
};

// The same set with its outer corners cut rounder.
const rounded = (round, set) => ({ ...set, terrain: { ...set.terrain, round } });

export const POCKETS = [
  // Amber Hive (west): beeswax comb. The cell walls are pale and stand proud of the hollows; a cell here and there
  // is full of dark honey, or capped over. Nothing in the wax is as orange as the amber that lies in it.
  strain('wax', { k: '#3a2208', D: '#8a5a14', L: '#ffe89a', s: '#1a0c0059', f: '#d89a2a', a: '#b87818', b: '#f6d066', c: '#fff2c0', h: '#a8600c', H: '#e0a040' }, 163, (fill, n) => {
    comb(fill, 'b', 'a');
    if (n === 1) cell(fill, 'left', 'h', 'H');
    if (n === 2) cell(fill, 'right', 'b');
    if (n === 3) cell(fill, 'lower', 'h', 'H');
    for (const [x, y] of fill.places(2, 5, 1)) if (onComb(x, y)) fill.set(x, y, 'c');
  }),
  // Pumice Drift (anywhere): boulders of grey froth lying loose in open dark, their corners worn round. Full of
  // holes, each dark under its near lip and lit on its far one.
  rounded(3, strain('pumice', { k: '#2a2630', D: '#5a5466', L: '#e8e2f0', s: '#00000059', f: '#a8a0b4', a: '#948ca2', b: '#bdb6c8', c: '#d8d2e4', p: '#4e485c', q: '#6e6880' }, 167, fill => {
    fill.clumps('a', 0.24, 4).clumps('b', 0.12, 3);
    const HOLES = [['.pp.', 'pppc', 'pqqc', '.cc.'], ['pp.', 'pqc', '.cc'], ['pq', 'qc'], ['p.', '.c'], ['q.', '.c'], ['q']];
    fill.places(6, 4, 1).forEach(([x, y], i) => { const rows = HOLES[i]; fill.stamp(Math.min(x, 15 - rows.length), Math.min(y, 15 - rows.length), rows); });
  })),
  // Ash Flats (south): fallen ash, pale and soft, that cuts like air. Low in contrast, with a fleck of char here
  // and there.
  rounded(2, strain('ash', { k: '#3a3a40', D: '#77777f', L: '#f4f4f0', s: '#00000040', f: '#c4c4c0', a: '#b8b8b5', b: '#cfcfcb', c: '#e0e0dc', g: '#9c9c9e', G: '#6c6c74' }, 173, (fill, n) => {
    fill.clumps('a', 0.2, 6).clumps('b', 0.14, 5);
    fill.dots('c', 2, 1).dots('g', 3, 1);
    if (n % 2) fill.dots('G', 1, 2);
  })),
];

export const POCKET_FLOORS = [
  // The hive's chambers: dark, with the comb still faintly on the floor.
  drawnFloor('wax-floor', { f: '#201206', a: '#1a0e04', b: '#2a1a0a' }, 16, fill => {
    fill.clumps('a', 0.25, 5);
    comb(fill, 'b');
  }),
  // The drift's cavern: night blue with a few far stars, so the open reads as sky.
  drawnFloor('pumice-floor', { f: '#0e1420', a: '#0a101a', b: '#141c2c', s: '#3c5486', S: '#8cb0ea' }, 17, (fill, n) => {
    fill.clumps('a', 0.25, 6).clumps('b', 0.1, 3);
    fill.dots('s', [2, 1, 3, 0, 2][n], 2);
    if (n === 0 || n === 2) fill.dots('S', 1, 3);
  }, 5),
  // The flats, cut away: the dark of cold cinders.
  floor('ash-floor', { f: '#1a1a1e', a: '#151518', b: '#222226' }, { color: 'f', speckle: [{ color: 'a', amount: 0.25, size: 6 }, { color: 'b', amount: 0.1, size: 3 }] }, 18),
];

export const FLOORS = [
  floor('rime-floor', { f: '#102830', a: '#0c2028', b: '#18363c' }, { color: 'f', speckle: [{ color: 'a', amount: 0.25, size: 6 }, { color: 'b', amount: 0.1, size: 3 }] }, 12),
  floor('magma-floor', { f: '#260c0a', a: '#1e0808', b: '#361410' }, { color: 'f', speckle: [{ color: 'a', amount: 0.25, size: 5 }, { color: 'b', amount: 0.1, size: 3 }] }, 13),
  floor('bloom-floor', { f: '#2a1230', a: '#220e28', b: '#381a3e' }, { color: 'f', speckle: [{ color: 'a', amount: 0.25, size: 5 }, { color: 'b', amount: 0.1, size: 3 }] }, 14),
  floor('gilt-floor', { f: '#241c10', a: '#1c160c', b: '#302614' }, { color: 'f', speckle: [{ color: 'a', amount: 0.25, size: 6 }, { color: 'b', amount: 0.1, size: 3 }] }, 15),
  floor('crust-floor', { f: '#2a211c', a: '#241c18', b: '#312720' }, { color: 'f', speckle: [{ color: 'a', amount: 0.25, size: 5 }, { color: 'b', amount: 0.1, size: 3 }] }, 5),
  floor('frost-floor', { f: '#1c2c48', a: '#17253e', b: '#243858' }, { color: 'f', speckle: [{ color: 'a', amount: 0.25, size: 6 }, { color: 'b', amount: 0.1, size: 3 }] }, 6),
  floor('ember-floor', { f: '#200c0c', a: '#180808', b: '#301412' }, { color: 'f', speckle: [{ color: 'a', amount: 0.25, size: 5 }, { color: 'b', amount: 0.1, size: 3 }] }, 7),
  floor('mire-floor', { f: '#1e1628', a: '#181120', b: '#243020' }, { color: 'f', speckle: [{ color: 'a', amount: 0.25, size: 5 }, { color: 'b', amount: 0.1, size: 3 }] }, 8),
  floor('lode-floor', { f: '#3a2616', a: '#301e11', b: '#48301c' }, { color: 'f', speckle: [{ color: 'a', amount: 0.25, size: 6 }, { color: 'b', amount: 0.1, size: 3 }] }, 9),
];

// Lava that has run into a tunnel: one blob set whose three frames move the bright crust along.
export const LAVA = {
  format: 'pixelforge-autotile', version: 1, name: 'lava', tile: 16,
  palette: { k: '#3a0c08', r: '#b0301a', o: '#f0701c', '1': '#ffb030', '2': '#f0701c', '3': '#d04a18' },
  terrain: {
    seed: 9,
    fill: { color: 'o', speckle: [{ color: '1', amount: 0.14, size: 4 }, { color: '2', amount: 0.14, size: 4 }, { color: '3', amount: 0.14, size: 4 }] },
    edges: { all: { depth: 1, jitter: 1, size: 4, bands: ['k', 'r'] } },
    round: 2, inner: 1,
  },
  frame: 'lava-{mask}-{variant}',
  animation: 'lava-{mask}',
  variants: [
    { name: 'a', duration: 220 },
    { name: 'b', duration: 220, palette: { '1': '#d04a18', '2': '#ffb030', '3': '#f0701c' } },
    { name: 'c', duration: 220, palette: { '1': '#f0701c', '2': '#d04a18', '3': '#ffb030' } },
  ],
  sheet: { columns: 15 },
};
