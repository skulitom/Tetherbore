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
