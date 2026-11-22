// The achievements' icons for Steam, as Pixelbolt recipes: a medal 64 pixels square, its rim in the colour of what it
// marks, with the game's own sprite on it (the frames are read from the recipes the art build keeps in art/recipes, so
// a lord's medal is that lord). Steam asks for 256 x 256 and each is enlarged four times by whole pixels; the locked
// one is the same frame in a grey palette. tools/achievements.mjs renders them into store/achievements/.

// [sheet, frame]; more than one is laid two by two.
const icon = name => ['icons', name], ROCK = ['minerals', 'aerolite'];
const FOUR_GEMS = [icon('frost'), icon('ember'), icon('mire'), icon('lode')];
export const RIMS = { gold: '#ffe14a', red: '#ff6a4a', frost: '#a8d8f8', ember: '#ff9a3a', mire: '#b4e878', lode: '#f0c070', teal: '#6fe0c8', violet: '#c090ff', foe: '#ff2bd6' };
export const MEDALS = {
  ACH_FIRST_HAUL: { from: [['drill', 'right-a-0']], rim: 'gold' },
  ACH_BIG_HAUL: { from: [ROCK], rim: 'gold', pips: 1 },
  ACH_HUGE_HAUL: { from: [ROCK], rim: 'gold', pips: 2 },
  ACH_COLOSSAL_HAUL: { from: [ROCK], rim: 'gold', pips: 3 },
  ACH_MOUNTAINOUS: { from: [ROCK], rim: 'gold', pips: 4 },
  ACH_HALF_WORLD: { from: [['core', 'core-flash-8']], rim: 'foe' },
  ACH_CLUTCH: { from: [icon('bolt')], rim: 'red' },
  ACH_MOTHER_LODE: { from: [['ember-items', 'oreB']], rim: 'gold' },
  ACH_HOT_POTATO: { from: [['ember-items', 'hazard']], rim: 'red' },
  ACH_WINCH_CRYING: { from: [['core', 'core-a-4']], rim: 'red' },
  ACH_HULL_GONE: { from: [['finds', 'bone']], rim: 'red' },
  ACH_NORTH: { from: [icon('frost')], rim: 'frost' },
  ACH_SOUTH: { from: [icon('ember')], rim: 'ember' },
  ACH_WEST: { from: [icon('mire')], rim: 'mire' },
  ACH_EAST: { from: [icon('lode')], rim: 'lode' },
  ACH_LONG_WAY: { from: [icon('home')], rim: 'teal' },
  ACH_FIRST_POCKET: { from: [['minerals', 'amber']], rim: 'teal' },
  ACH_ALL_POCKETS: { from: [['minerals', 'amber'], ['minerals', 'opal'], ['minerals', 'agate'], ['minerals', 'starglass']], rim: 'teal' },
  ACH_FOUR_SEAMS: { from: [icon('corner-ne'), icon('corner-se'), icon('corner-sw'), icon('corner-nw')], rim: 'teal' },
  ACH_WRECK_PART: { from: [['finds', 'part']], rim: 'violet' },
  ACH_FIRST_RELIC: { from: [['frost-items', 'relic']], rim: 'violet' },
  ACH_ALL_RELICS: { from: [['frost-items', 'relic'], ['ember-items', 'relic'], ['mire-items', 'relic'], ['lode-items', 'relic']], rim: 'violet' },
  ACH_FIRST_SHRINE: { from: [['stones', 'stone-ne']], rim: 'violet' },
  ACH_FOSSIL: { from: [['finds', 'fossil-1-head']], rim: 'violet' },
  ACH_CAUGHT_LIVE: { from: [['worm-items', 'hazard']], rim: 'mire' },
  ACH_ALL_RARES: { from: [['bell-items', 'hazard'], ['vent-items', 'hazard'], ['worm-items', 'hazard'], ['lodestone-items', 'hazard']], rim: 'violet' },
  ACH_PAL: { from: [['fauna', 'pup-idle-a']], rim: 'teal' },
  ACH_EVICTED: { from: [['fauna', 'puff-']], rim: 'red' },
  ACH_LORD_WYRM: { from: [['bosses', 'wyrm-idle-a']], rim: 'foe' },
  ACH_LORD_BEHEMOTH: { from: [['bosses', 'behemoth-idle-a']], rim: 'foe' },
  ACH_LORD_MOTHER: { from: [['bosses', 'mother-idle-a']], rim: 'foe' },
  ACH_LORD_KING: { from: [['bosses', 'king-idle-a']], rim: 'foe' },
  ACH_ALL_LORDS: { from: FOUR_GEMS, rim: 'foe', pips: 4 },
  ACH_FIRST_UPGRADE: { from: [['drill', 'right-a-3']], rim: 'teal' },
  ACH_STARLINE: { from: [icon('tether')], rim: 'gold' },
  ACH_LAB_36: { from: [icon('lab')], rim: 'teal' },
};

export const SIZE = 64, ENLARGE = 4;
const hex = (r, g, b) => `#${[r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
const rgb = h => [1, 3, 5].map(n => parseInt(h.slice(n, n + 2), 16));
const mix = (a, b, u) => { const p = rgb(a), q = rgb(b); return hex(p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u, p[2] + (q[2] - p[2]) * u); };
export const grey = h => { const [r, g, b] = rgb(h), v = (0.3 * r + 0.59 * g + 0.11 * b) * 0.62 + 14; return hex(v, v, v + 4); };
// A fixed scatter over the field, as the game's rock is grained.
const grain = (x, y) => { let h = Math.imul(x * 73856093 ^ y * 19349663, 0x5bd1e995); h ^= h >>> 13; return (Math.imul(h, 0x5bd1e995) >>> 0) / 4294967296; };

// The medal under its sprite, as a grid of colours: a dark grained field, a disc of the rim's colour let down into
// it, and a bevelled rim lit from the top left as everything in the game is. `pips` small studs along the foot.
function field(rim, pips) {
  const dark = '#14101c', deep = mix(dark, rim, 0.16), glow = mix(dark, rim, 0.3), hi = mix(rim, '#ffffff', 0.45), lo = mix(rim, '#000000', 0.5), c = (SIZE - 1) / 2;
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(dark));
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const edge = Math.min(x, y, SIZE - 1 - x, SIZE - 1 - y), r = Math.hypot(x - c, y - c), g = grain(x, y);
    let col = g < 0.1 ? '#1c1726' : dark;
    if (r < 27) col = r > 25.5 ? glow : g < 0.16 ? glow : deep;
    if (edge === 0) col = '#07060b';
    else if (edge <= 2) col = x + y < SIZE - 1 ? (edge === 1 ? hi : rim) : (edge === 1 ? lo : mix(rim, '#000000', 0.25));
    else if (edge === 3) col = '#07060b';
    grid[y][x] = col;
  }
  for (let n = 0; n < pips; n++) {
    const px = Math.round(c - (pips - 1) * 3.5 + n * 7), py = SIZE - 10;
    for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) grid[py + v][px + u] = u === -1 && v === -1 ? '#ffffff' : u + v > 0 ? lo : rim;
  }
  return grid;
}
// Lays a sprite on the grid at (x0, y0), `scale` times as large, with a shadow a pixel down and across.
function lay(grid, sprite, x0, y0, scale) {
  const { w, h, data } = sprite, at = (x, y) => { const i = 4 * (y * w + x); return data[i + 3] < 128 ? null : hex(data[i], data[i + 1], data[i + 2]); };
  for (const shadow of [true, false]) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const col = at(x, y);
    if (!col) continue;
    for (let v = 0; v < scale; v++) for (let u = 0; u < scale; u++) {
      const px = x0 + x * scale + u + (shadow ? 1 : 0), py = y0 + y * scale + v + (shadow ? 1 : 0);
      if (px >= 4 && py >= 4 && px < SIZE - 4 && py < SIZE - 4) grid[py][px] = shadow ? '#07060b' : col;
    }
  }
}
// The whole of a medal as a grid of colours; `frame(sheet, name)` gives a sprite { w, h, data }.
export function medalGrid(id, frame) {
  const m = MEDALS[id], grid = field(RIMS[m.rim], m.pips ?? 0), lift = m.pips ? 3 : 0;
  if (m.from.length === 1) {
    const s = frame(...m.from[0]), scale = Math.max(1, Math.floor(40 / Math.max(s.w, s.h)));
    lay(grid, s, Math.floor((SIZE - s.w * scale) / 2), Math.floor((SIZE - s.h * scale) / 2) - lift, scale);
  } else m.from.forEach((f, n) => {
    const s = frame(...f), scale = Math.max(1, Math.floor(20 / Math.max(s.w, s.h))), cw = s.w * scale, ch = s.h * scale;
    lay(grid, s, Math.floor(SIZE / 2 + (n % 2 ? 1 : -1 - cw)), Math.floor(SIZE / 2 + (n > 1 ? 1 : -1 - ch)) - lift, scale);
  });
  return grid;
}
// A grid as a frame of a Pixelbolt recipe: its colours a palette of its own and its pixels rows of those keys.
const KEYS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export function medalRecipe(ids, frame) {
  const symbols = {}, frames = [];
  for (const id of ids) {
    const grid = medalGrid(id, frame), keys = new Map();
    const rows = grid.map(row => row.map(col => { if (!keys.has(col)) { if (keys.size >= KEYS.length) throw new Error(`${id}: too many colours`); keys.set(col, KEYS[keys.size]); } return keys.get(col); }).join(''));
    symbols[id] = rows;
    const palette = Object.fromEntries([...keys].map(([col, key]) => [key, col])), locked = Object.fromEntries([...keys].map(([col, key]) => [key, grey(col)]));
    frames.push({ name: id, duration: 100, palette, ops: [{ op: 'stamp', symbol: id, x: 0, y: 0 }] });
    frames.push({ name: `${id}-locked`, duration: 100, palette: locked, ops: [{ op: 'stamp', symbol: id, x: 0, y: 0 }] });
  }
  // (A symbol's keys must be in the recipe's own palette; each frame says what they are in its colours.)
  const palette = Object.fromEntries([...KEYS].map(key => [key, '#000000']));
  return { version: 1, name: 'medals', width: SIZE, height: SIZE, palette, symbols, frames, sheet: { padding: 0 } };
}
