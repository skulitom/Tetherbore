// Runs the game with no browser: the page, the canvas, storage and sound are stood in for, and the art's frame
// tables are read from assets/atlas.json. Tests import `makeGame` and step the game with `game.update(1 / 60)`.
//
//   import { makeGame, C, N, K } from './harness.mjs';
//   const game = await makeGame(7);
//   game.input.auto = [1, 0, 1];          // steer: [x, y, how hard 0..1], or null to let go
//   game.update(1 / 60);
//
// Nothing is drawn (the canvas swallows every call), so this tests what the game does, not how it looks.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);

const nothing = new Proxy(function () {}, {
  get: (target, key) => key === 'data' ? new Uint8ClampedArray(4) : key === Symbol.toPrimitive ? () => 0 : nothing,
  apply: () => nothing, set: () => true,
});
const context = () => new Proxy({}, {
  get: (target, key) => key === 'createImageData' || key === 'getImageData'
    ? (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0) * 4)), width: w, height: h })
    : key in target ? target[key] : () => nothing,
  set: (target, key, value) => { target[key] = value; return true; },
});
const canvas = () => ({ width: 0, height: 0, style: {}, getContext: context, getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 640 }) });

const kept = new Map();
globalThis.localStorage = { getItem: k => kept.has(k) ? kept.get(k) : null, setItem: (k, v) => { kept.set(k, String(v)); }, removeItem: k => { kept.delete(k); } };
// No database: opening one fails, and the game goes on without saving ground, as it does in a private window.
globalThis.indexedDB = { open() { const request = {}; queueMicrotask(() => request.onerror?.()); return request; } };
globalThis.window = globalThis;
globalThis.document = { createElement: canvas, getElementById: canvas, addEventListener() {}, hidden: false };
globalThis.Image = class { set src(value) { queueMicrotask(() => this.onload?.()); } get width() { return 4096; } get height() { return 4096; } };
globalThis.fetch = async url => { const text = await readFile(new URL(String(url), root), 'utf8'); return { json: async () => JSON.parse(text), text: async () => text }; };

const atlas = await import(new URL('js/atlas.js', root));
await atlas.loadAtlas('assets/');
const { Game, UPGRADES, income, richness, haulBonus } = await import(new URL('js/game.js', root));
const world = await import(new URL('js/world.js', root));

export const { N, C, K, B, sight, cellsAlong, HOME_R } = world;
export { Game, UPGRADES, income, richness, haulBonus, world };

// A fresh game on world `seed`, with the title screen already left.
export async function makeGame(seed = 7, levels = {}) {
  const game = new Game(canvas());
  game.fresh(seed, true);
  game.resize(360, 640, 1);
  Object.assign(game.S.lv, levels);
  return game;
}

// A repeatable stream of numbers in [0, 1).
export function random(seed) {
  let s = (seed * 2654435761) >>> 0;
  return () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296;
}

// Everything wrong with the tether as it lies now, as a list of strings (empty when it is sound): a span that goes
// through rock, a bend whose corner is gone, and a bend the string no longer turns round (it should have been let
// go). Bends are the rock's own corners, so spans are checked a little short of each end and by how deep they go.
export function tetherFaults(game) {
  const w = game.world, P = game.band, faults = [], rel = p => `(${(p[0] - C - 0.5).toFixed(2)},${(p[1] - C - 0.5).toFixed(2)})`;
  for (let n = 0; n + 1 < P.length; n++) {
    const a = P[n], b = P[n + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), steps = Math.min(4000, Math.ceil(len / 0.05));
    for (let k = 1; k < steps; k++) {
      const x = a[0] + (b[0] - a[0]) * k / steps, y = a[1] + (b[1] - a[1]) * k / steps;
      if (w.k(Math.floor(y) * N + Math.floor(x)) === K.EMPTY) continue;
      const fx = x - Math.floor(x), fy = y - Math.floor(y);
      if (Math.min(fx, 1 - fx, fy, 1 - fy) > 0.04) { faults.push(`span ${n} ${rel(a)}-${rel(b)} passes through rock at ${rel([x, y])}`); break; }
    }
  }
  for (let n = 1; n + 1 < P.length; n++) {
    const a = P[n - 1], b = P[n], c = P[n + 1];
    if (w.k(b[3]) === K.EMPTY) { faults.push(`bend ${n} ${rel(b)} is on a corner that is gone`); continue; }
    const turn = (b[0] - c[0]) * (a[1] - b[1]) - (b[1] - c[1]) * (a[0] - b[0]);
    if (turn * b[2] < -1e-9) faults.push(`bend ${n} ${rel(b)} should have been let go: the string no longer turns round it (${(turn * b[2]).toFixed(3)})`);
    const cx = (b[3] % N) + 0.5, cy = Math.floor(b[3] / N) + 0.5, side = (b[0] - c[0]) * (cy - b[1]) - (b[1] - c[1]) * (cx - b[0]);
    if (side * b[2] < 0) faults.push(`bend ${n} ${rel(b)} is wrapped the wrong way round its cell`);
  }
  return faults;
}
export const here = fileURLToPath(root);
