// Runs the game with no browser: the page, the canvas, storage and sound are stood in for, and the art's frame
// tables are read from assets/atlas.json. Tests import `makeGame` and step the game with `game.update(1 / 60)`.
//
//   import { makeGame, C, N, K } from './harness.mjs';
//   const game = await makeGame(7);
//   game.input.auto = [1, 0, 1];          // steer: [x, y, how hard 0..1], or null to let go
//   game.update(1 / 60);
//
// `farStart` stages a start deep in the ground and `wander` is the fuzzes' random steering; `tetherFaults` and
// `Oracle` check the tether. Nothing is drawn (the canvas swallows every call), so this tests what the game does,
// not how it looks.
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
const { Game, UPGRADES, WORKS, MAPS, CORE, DEATH, income, richness, haulBonus } = await import(new URL('js/game.js', root));
const world = await import(new URL('js/world.js', root));

export const { N, C, K, B, sight, cellsAlong, HOME_R } = world;
export { Game, UPGRADES, WORKS, MAPS, CORE, DEATH, income, richness, haulBonus, world };

// A fresh game on world `seed`, with the title screen already left.
//
// The hull takes no harm unless `hull` is asked for: a blow lands as it does in play (the stun, the moment after in
// which nothing lands again), and the pip it took is given back at once, so the drill is never wrecked and wound
// home. The flights and the pilots written before there was a hull are of a drill that stays out in the ground it
// was set down in, whatever it flies into; with `{ hull: true }` the game is exactly the one that is played.
export async function makeGame(seed = 7, levels = {}, { hull = false } = {}) {
  const game = new Game(canvas());
  game.fresh(seed, true);
  game.resize(360, 640, 1);
  Object.assign(game.S.lv, levels);
  if (!hull) { const hit = game.hit.bind(game); game.hit = time => { const landed = hit(time); game.dents = 0; return landed; }; }
  return game;
}

// A repeatable stream of numbers in [0, 1).
export function random(seed) {
  let s = (seed * 2654435761) >>> 0;
  return () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296;
}

// A running hash of where the rubble is, frame by frame: `add(game)` after each frame folds in every bit of every
// haul on its way (where it is, how fast it is going, whether it is home), the grit banked and still to come, and
// where the drill is; `hex` is the hash so far. It is there so that a change to how the rubble is drawn home
// (updateHauls) can be shown not to move a single bit by so much as the last binary place: it reads the numbers'
// own bits, not their printed digits, so the same game gives the same hash and any other game almost surely does not.
export function rubbleHash() {
  const f = new Float64Array(1), u = new Uint32Array(f.buffer);
  let a = 0x811c9dc5, b = 0x9e3779b9;
  const fold = value => {
    f[0] = value;
    for (let n = 0; n < 2; n++) { a = Math.imul(a ^ u[n], 0x01000193); b = Math.imul(b ^ u[n] ^ (a >>> 15), 0x5bd1e995); }
  };
  return {
    add(game) {
      for (const h of game.hauls) for (const bit of h.bits) { fold(bit.x); fold(bit.y); fold(bit.vx); fold(bit.vy); fold(bit.st); }
      fold(game.S.grit); fold(game.pending.grit); fold(game.drill.x); fold(game.drill.y);
    },
    get hex() { return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0'); },
  };
}

// A straight tunnel three cells wide from the core out to the offset (sx, sy), as the fuzzes stage a start deep in
// the ground: a step every half cell along the line, rounded to the cell it lies in, and the cells round that opened.
// A cell `keep` says yes to is left as it is (a wreck, a prism and its ore). The steps are rounded exactly so for
// every flight written with it was flown through these cells and no others.
export function tunnel(game, sx, sy, keep = () => false) {
  const w = game.world, len = Math.hypot(sx, sy);
  for (let s = 0; s <= len; s += 0.5) for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) {
    const i = (C + Math.round(sy * s / len) + v) * N + C + Math.round(sx * s / len) + u;
    if (!keep(i)) w.setK(i, K.EMPTY);
  }
}

// A start at (sx, sy) from the core: the tunnel out to it, and the drill set down free at its end with the tether
// running straight back home.
export function farStart(game, sx, sy, keep) {
  tunnel(game, sx, sy, keep);
  setDown(game, sx, sy);
}

// The drill set down free at (sx, sy) from the core, the tether straight from it to the core, and the game told the
// ground has changed. (Called on its own by a script that does more to the ground between cutting the tunnel and
// setting the drill down, as the hazard fuzz plants its hazards.)
export function setDown(game, sx, sy) {
  const d = game.drill;
  d.x = C + sx + 0.5; d.y = C + sy + 0.5; d.mode = 'free';
  game.band = [[d.x, d.y], [C + 0.5, C + 0.5]];
  game.changed();
}

// The fuzzes' random flight, as `game.input.auto` for one frame after another. A turn swings the heading by up to
// 1.25 radians either way and holds it for 10 to 59 frames at full strength; one turn in ten lets go instead (null).
// The three numbers a turn takes from `rnd` are drawn as it begins, in that order, so a script that draws nothing
// else while it flies flies as it did when it wrote this loop out for itself.
export function* wander(rnd, turns, heading = 0) {
  for (let turn = 0; turn < turns; turn++) {
    heading += (rnd() - 0.5) * 2.5;
    const hold = 10 + Math.floor(rnd() * 50), pause = rnd() < 0.1;
    for (let f = 0; f < hold; f++) yield pause ? null : [Math.cos(heading), Math.sin(heading), 1];
  }
}

// Everything wrong with the tether as it lies now, as a list of strings (empty when it is sound):
//   a span that goes through rock, or that runs in the seam between two cells of rock (rock on both sides of it);
//   a bend whose corner is gone, or that the string no longer turns round (it should have been let go);
//   the same corner twice running, and a bend the string runs out to and straight back from: both have a turn of
//   exactly nothing, so the turn test alone says they are sound;
//   a bend whose turn has no ground inside it (the string is hooked on a corner it does not go round).
// Bends are the rock's own corners, so a span is checked a little short of each end. Whether it passes through
// rock is asked exactly, of every cell it crosses, however long it is: a cell that lies on both of two lines a
// ten-thousandth of a cell to either side of the span is one the span goes through, and it must be open. (A span
// was once looked at only at points along it, 4,000 at the most, which on a span of 1,500 cells stepped over rock
// that it cut a fifth of a cell deep.) The seam is looked for at points no more than a fifth of a cell apart, and
// the cell last asked on each side of it is remembered: up to twenty points fall in each cell, and asking the world
// at every one of them made this check most of the time of the longest tests. The ground cannot change while it is
// looked at, so a remembered answer is the answer the world would give.
export function tetherFaults(game) {
  const w = game.world, P = game.band, faults = [], rel = p => `(${(p[0] - C - 0.5).toFixed(2)},${(p[1] - C - 0.5).toFixed(2)})`;
  const rock = (x, y) => w.k(Math.floor(y) * N + Math.floor(x)) !== K.EMPTY;
  let cellA = -1, rockA = false, cellB = -1, rockB = false;
  for (let n = 0; n + 1 < P.length; n++) {
    const a = P[n], b = P[n + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), steps = Math.ceil(len / (len > 200 ? 0.2 : 0.05));
    const nx = len ? -(b[1] - a[1]) / len * 1e-3 : 0, ny = len ? (b[0] - a[0]) / len * 1e-3 : 0;
    for (let k = 1; k < steps; k++) {
      const x = a[0] + (b[0] - a[0]) * k / steps, y = a[1] + (b[1] - a[1]) * k / steps;
      // Rock a hair to both sides of the line at once, away from the grid's own points where four cells meet. The
      // distance is weighed on its square, and Math.hypot asked only within a hair of the tenth of a cell, where the
      // square alone might round the other way from it; a point that is not a number is passed over, as it was.
      const ex = x - Math.round(x), ey = y - Math.round(y), sq = ex * ex + ey * ey;
      if (!(sq >= 0.0099) || (sq <= 0.0101 && Math.hypot(ex, ey) < 0.1)) continue;
      const ia = Math.floor(y + ny) * N + Math.floor(x + nx);
      if (ia !== cellA) { cellA = ia; rockA = w.k(ia) !== K.EMPTY; }
      if (!rockA) continue;
      const ib = Math.floor(y - ny) * N + Math.floor(x - nx);
      if (ib !== cellB) { cellB = ib; rockB = w.k(ib) !== K.EMPTY; }
      if (rockB) {
        faults.push(`span ${n} ${rel(a)}-${rel(b)} runs in a seam with rock on both sides at ${rel([x, y])}`);
        break;
      }
    }
    if (len < 0.01) continue;
    const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len, e = 1e-3, o = 1e-4, most = Math.ceil(len * 2) + 64;
    const one = new Set(cellsAlong(a[0] + ux * e - uy * o, a[1] + uy * e + ux * o, b[0] - ux * e - uy * o, b[1] - uy * e + ux * o, most));
    for (const c of cellsAlong(a[0] + ux * e + uy * o, a[1] + uy * e - ux * o, b[0] - ux * e + uy * o, b[1] - uy * e - ux * o, most)) {
      if (!one.has(c) || w.k(c) === K.EMPTY) continue;
      faults.push(`span ${n} ${rel(a)}-${rel(b)} passes through rock at ${rel([(c % N) + 0.5, Math.floor(c / N) + 0.5])}`);
      break;
    }
  }
  for (let n = 1; n + 1 < P.length; n++) {
    const a = P[n - 1], b = P[n], c = P[n + 1];
    if (w.k(b[3]) === K.EMPTY) { faults.push(`bend ${n} ${rel(b)} is on a corner that is gone`); continue; }
    if (n + 2 < P.length && c[0] === b[0] && c[1] === b[1]) { faults.push(`bends ${n} and ${n + 1} ${rel(b)} are the same corner twice running (turns ${b[2]} and ${c[2]})`); continue; }
    if (a[0] === b[0] && a[1] === b[1]) continue;
    const ux = a[0] - b[0], uy = a[1] - b[1], vx = c[0] - b[0], vy = c[1] - b[1];
    const turn = (b[0] - c[0]) * (a[1] - b[1]) - (b[1] - c[1]) * (a[0] - b[0]);
    if (turn === 0 && ux * vx + uy * vy > 0) { faults.push(`bend ${n} ${rel(b)} is a fold-back: the string runs out to it and straight back`); continue; }
    if (turn * b[2] < -1e-9) faults.push(`bend ${n} ${rel(b)} should have been let go: the string no longer turns round it (${(turn * b[2]).toFixed(3)})`);
    const cx = (b[3] % N) + 0.5, cy = Math.floor(b[3] / N) + 0.5, side = (b[0] - c[0]) * (cy - b[1]) - (b[1] - c[1]) * (cx - b[0]);
    if (side * b[2] < 0) faults.push(`bend ${n} ${rel(b)} is wrapped the wrong way round its cell`);
    // What the string turns round: the point just inside the turn, midway between the two spans, must be ground.
    // (Not asked of a bend the string runs all but straight across, where that point is a hair from a cell's edge.)
    const ul = Math.hypot(ux, uy), vl = Math.hypot(vx, vy), mx = ux / ul + vx / vl, my = uy / ul + vy / vl, ml = Math.hypot(mx, my);
    if (ml > 1e-3 && !rock(b[0] + mx / ml * 0.01, b[1] + my / ml * 0.01)) faults.push(`bend ${n} ${rel(b)} turns round open ground: nothing lies inside its turn`);
  }
  return faults;
}

// A second, stronger check of the tether, which uses none of the game's catching maths: is the string in the same
// class as the path the drill flew, that is, does it pass every piece of rock on the side the drill passed it?
// Every bounded piece of rock in a box is a puncture with a ray going straight up from inside it, a path's class is
// the reduced word of its signed crossings of those rays, and the drill's flown path and the band (core to drill)
// must give the same word. Make one after the ground is laid, call `step()` after every `game.update`, and ask
// `mismatch()` ('' when they agree). `fine()` records every small move inside a frame as well.
//
// It is sound where the pieces of rock in the box stay as they were found or go whole (uncuttable fields, single
// blocks that are cut or hauled away). It is not sound where a piece is cut into, split or grown on to: the point its
// ray starts from may then lie in open ground, which a string may rightly pass over. So it checks staged fields in
// test/regress, and `tetherFaults` checks everything else.
const HX = C + 0.5, HY = C + 0.5;
export class Oracle {
  // box: offsets [x0, y0, x1, y1] within which bounded pieces of rock are punctures.
  constructor(game, box) {
    this.game = game; this.box = box;
    this.find();
    this.word = [];
    this.last = [HX, HY];
    this.trail = null;
    this.step();
  }
  // Record every sub-step of the drill's flight (the game moves it in several small slides a frame when it is
  // fast), by listening to the game's own `free` test. Nothing about the game changes.
  fine() {
    const game = this.game, free = game.free.bind(game), trail = this.trail = [];
    game.free = (x, y) => { const d = game.drill; if (d.mode === 'free') trail.push([d.x, d.y]); return free(x, y); };
    return this;
  }
  find() {
    const w = this.game.world, [x0, y0, x1, y1] = this.box, seen = new Set();
    this.punctures = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = (C + y) * N + C + x;
      if (seen.has(i) || w.k(i) === K.EMPTY) continue;
      const cells = [i]; seen.add(i);
      let bounded = true;
      for (let h = 0; h < cells.length; h++) for (const j of [cells[h] + 1, cells[h] - 1, cells[h] + N, cells[h] - N]) {
        if (seen.has(j) || w.k(j) === K.EMPTY) continue;
        const jx = j % N - C, jy = Math.floor(j / N) - C;
        if (jx < x0 || jx > x1 || jy < y0 || jy > y1) { bounded = false; continue; }
        seen.add(j); cells.push(j);
      }
      if (!bounded) continue;
      const id = this.punctures.length;
      this.punctures.push({ id, cell: i, cells, px: i % N + 0.2 + 0.6 * ((id * 0.6180339887498949) % 1), py: Math.floor(i / N) + 0.5 });
    }
  }
  crossings(a, b) {
    const out = [];
    for (const p of this.punctures) {
      if (p.gone) continue;
      if ((a[0] < p.px) === (b[0] < p.px)) continue;
      const t = (p.px - a[0]) / (b[0] - a[0]), y = a[1] + t * (b[1] - a[1]);
      if (y < p.py) out.push([t, p.id, b[0] > a[0] ? 1 : -1]);
    }
    return out.sort((u, v) => u[0] - v[0]).map(([, id, s]) => [id, s]);
  }
  static push(word, letters) {
    for (const [id, s] of letters) {
      const top = word[word.length - 1];
      if (top && top[0] === id && top[1] === -s) word.pop(); else word.push([id, s]);
    }
  }
  // Call after every game.update: adds the drill's move to the flown word.
  step() {
    const d = this.game.drill, w = this.game.world, now = [d.x, d.y];
    if (this.trail) { for (const p of this.trail) { if (p[0] !== this.last[0] || p[1] !== this.last[1]) { Oracle.push(this.word, this.crossings(this.last, p)); this.last = p; } } this.trail.length = 0; }
    Oracle.push(this.word, this.crossings(this.last, now));
    this.last = now;
    // A puncture whose rock is gone no longer counts, in either word.
    let lost = false;
    for (const p of this.punctures) if (!p.gone && p.cells.every(c => w.k(c) === K.EMPTY)) { p.gone = true; lost = true; }
    if (lost) { const kept = this.word.filter(([id]) => !this.punctures[id].gone); this.word = []; Oracle.push(this.word, kept); }
  }
  bandWord() {
    const P = this.game.band, word = [];
    for (let n = P.length - 1; n > 0; n--) Oracle.push(word, this.crossings(P[n], P[n - 1]));
    return word;
  }
  // '' when the band is in the class the drill flew, else what differs.
  mismatch() {
    const a = this.word.map(l => l.join(':')).join(' '), b = this.bandWord().map(l => l.join(':')).join(' ');
    return a === b ? '' : `flown [${a}] band [${b}]`;
  }
}
export const here = fileURLToPath(root);
