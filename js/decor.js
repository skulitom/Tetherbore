// Tetherbore: what each ground has in its caves. An open cell the seed left open, against rock, may have one piece of
// its ground's own decor hugging that rock: something hanging from the ceiling, standing on the floor or growing on a
// wall (art/decor.mjs draws them). Any open cell that has none, cut by the drill or not, may have a faint mark of
// the ground's back wall instead, so a tunnel through a ground looks like that ground's. Nothing here draws or keeps
// anything: what a cell has is worked out from the cell, the cells beside it and seedless hashes of where it is, so
// the same ground always has the same pieces, and a piece goes as soon as the rock it hangs from is cut away. No
// Math.random is drawn (the hashes' salts 21 to 26 are drawing's own, as 1 to 5 are).
//
// How another part of the game asks about a cell: `game.decorOf(i)` (js/drawing.js) is the name of the frame that
// cell shows, `<set>-<place>-<n>`, or null; `placeOf(name)` is 'top', 'bottom', 'left', 'right' or 'floor', and
// `falls(name)` whether it is an icicle, which may fall. `game.fallen`, a Set of cell numbers that the game may keep
// (it is not there until something makes it), is the cells whose icicle has fallen: paint draws no piece hanging
// in them (the mark of the back wall, if the cell has one, shows instead). Whatever adds to it says the ground has
// changed (`game.version++`), as a cut does, so the pieces in view are drawn again.
import { N, C, K, cellHash } from './world.js';
import { sheets } from './atlas.js';

// The share of cells, by where their anchor is, that have a piece: `top` of those with rock over them, `bottom`
// of those with rock under them, `side` of those with rock beside them and none over or under, `floor` of any
// open cell that has no piece. A cross has its host's rates and draws its donor's pieces (decor-x) in DECOR_MIX
// of its cells.
export const DECOR = {
  crust: { top: 0.32, bottom: 0.26, side: 0.1, floor: 0.08 },
  frost: { top: 0.45, bottom: 0.3, side: 0.12, floor: 0.08 },
  rime: { top: 0.45, bottom: 0.3, side: 0.12, floor: 0.08 },
  firn: { top: 0.35, bottom: 0.35, side: 0.08, floor: 0.08 },
  serac: { top: 0.5, bottom: 0.25, side: 0.1, floor: 0.08 },
  ember: { top: 0.3, bottom: 0.36, side: 0, floor: 0.08 },
  magma: { top: 0.35, bottom: 0.35, side: 0, floor: 0.1 },
  scoria: { top: 0.3, bottom: 0.3, side: 0, floor: 0.1 },
  forge: { top: 0.3, bottom: 0.35, side: 0, floor: 0.08 },
  mire: { top: 0.45, bottom: 0.3, side: 0.12, floor: 0.1 },
  bloom: { top: 0.5, bottom: 0.35, side: 0.12, floor: 0.1 },
  tangle: { top: 0.5, bottom: 0.25, side: 0.1, floor: 0.1 },
  sporefall: { top: 0.4, bottom: 0.3, side: 0.1, floor: 0.1 },
  lode: { top: 0.3, bottom: 0.3, side: 0, floor: 0.08 },
  gilt: { top: 0.3, bottom: 0.3, side: 0.08, floor: 0.08 },
  redrock: { top: 0.3, bottom: 0.3, side: 0, floor: 0.1 },
  loess: { top: 0.25, bottom: 0.4, side: 0, floor: 0.08 },
  hive: { top: 0.4, bottom: 0.25, side: 0.08, floor: 0.06 },
  grotto: { top: 0.4, bottom: 0.2, side: 0, floor: 0.06 },
  tinder: { top: 0.25, bottom: 0.3, side: 0, floor: 0.08 },
  glaze: { top: 0.3, bottom: 0, side: 0, floor: 0.06 },
  shale: { top: 0, bottom: 0.35, side: 0, floor: 0.08 },
};
export const DECOR_MIX = 0.3;
// Nothing within CLEAR cells of the core's middle (the core and its platform stand there).
export const CLEAR = 6;
// The sheets the pieces are on: a ground's own, and the crosses' pieces of their donors.
export const DECOR_SHEETS = ['decor', 'decor-x'];
// What a piece may hang from, stand on or grow from: rock that has been seen. Only these kinds, so that a kind made
// later (a new hazard) is never an anchor until it is put here: nothing hangs from a hazard, a mineral, a cap or a
// stalk, a find, a wreck or the core.
const ANCHOR = new Uint8Array(32);
for (const k of [K.SOFT, K.DENSE, K.ORE_A, K.ORE_B, K.SLATE, K.VAULT, K.ICE, K.BASALT, K.SLAG, K.STEEL, K.BEDROCK, K.FAULT, K.GLASS]) ANCHOR[k] = 1;
export const anchors = k => ANCHOR[k] === 1;

// The frames of the decor sheets, once: by set and place, which sheet each is on, its glow and whether it falls.
let book = null;
const PLACE = /^(.*)-(top|bottom|left|right|floor)-(\d+)$/;
export function framesOf() {
  if (book) return book;
  // (Not kept until the sheets are loaded.)
  if (!sheets.decor) return { sets: {}, frame: new Map() };
  book = { sets: {}, frame: new Map() };
  for (const sheet of DECOR_SHEETS) {
    const s = sheets[sheet];
    if (!s) continue;
    const glows = s.glows ?? {}, falling = new Set(s.falls ?? []);
    for (const name of Object.keys(s.frames)) {
      const [, set, place] = name.match(PLACE);
      const own = book.sets[set] ??= { top: [], bottom: [], left: [], right: [], floor: [] };
      own[place].push(name);
      book.frame.set(name, { sheet, glow: glows[name] ?? null, falls: falling.has(name) });
    }
  }
  return book;
}
export const placeOf = name => name.match(PLACE)?.[2] ?? null;
export const setOf = name => name.match(PLACE)?.[1] ?? null;
export const falls = name => framesOf().frame.get(name)?.falls ?? false;

// The piece a cell has, as its frame's name, or null. `wild(i)` says whether the seed left cell `i` open (it is
// asked last, of a cell that would otherwise have a piece, since it is the dearest question: js/drawing.js keeps
// the answers). The cell is taken to be open and seen.
export function decorAt(w, i, x, y, row, wild) {
  const set = row.decor;
  if (set === null || set === undefined) return null;
  const rate = DECOR[set], h = cellHash(x, y, 21), h2 = cellHash(x, y, 22);
  // (Most cells are settled by their hashes alone, before any cell beside them is asked about.)
  if (h >= rate.top && h <= 1 - rate.bottom && h2 >= rate.side) return null;
  if ((x - C) * (x - C) + (y - C) * (y - C) <= CLEAR * CLEAR) return null;
  const on = j => ANCHOR[w.k(j)] === 1 && w.s(j) > 0;
  let place = null;
  if (h < rate.top && on(i - N)) place = 'top';
  else if (h > 1 - rate.bottom && on(i + N)) place = 'bottom';
  else if (h2 < rate.side && !on(i - N) && !on(i + N)) {
    const left = on(i - 1), right = on(i + 1);
    if (left && right) place = cellHash(x, y, 26) < 0.5 ? 'left' : 'right';
    else place = left ? 'left' : right ? 'right' : null;
  }
  if (place === null || !wild(i)) return null;
  const sets = framesOf().sets;
  let from = sets[set];
  if (row.decor2 && cellHash(x, y, 23) < DECOR_MIX && sets[row.decor2]?.[place].length) from = sets[row.decor2];
  const list = from?.[place];
  return list && list.length ? list[(cellHash(x, y, 24) * list.length) | 0] : null;
}

// The faint mark on the back wall of an open cell, as its frame's name, or null: in any open cell, cut or not.
export function markAt(x, y, row) {
  const set = row.decor;
  if (set === null || set === undefined) return null;
  const h = cellHash(x, y, 25);
  if (h >= DECOR[set].floor || (x - C) * (x - C) + (y - C) * (y - C) <= CLEAR * CLEAR) return null;
  const list = framesOf().sets[set]?.floor;
  return list && list.length ? list[((h / DECOR[set].floor) * list.length) | 0] : null;
}

// Whether the seed left cell `i`, at (x, y), open as part of the ground's own caves: not a crack or a joint of a
// keystone slab, and not the hollow a wreck lies in (a crash site is bare).
export function natural(w, i, x, y) {
  if (w.first(i) !== K.EMPTY || w.slabAt(x, y) !== 0) return false;
  for (let n = 0, wx = w.wreckX, wy = w.wreckY; n < wx.length; n++) if (Math.abs(x - wx[n]) <= 3 && Math.abs(y - wy[n]) <= 3) return false;
  return true;
}
