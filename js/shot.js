// A staged view of the world, for tools/shot.mjs to photograph and for looking at a far place by hand:
//   index.html?shot&seed=7&at=0,-300&reach=6&zoom=4&lit&met&wake&bombs=3&blast&key
// js/main.js loads this file only when the address has `shot`; ordinary play never fetches it.
//
// The view is a fresh world on `seed` (7 if none is given). It reads no saved game and is never saved. The drill
// stands `at` dx,dy cells from the core, east and south counted up, so north is a negative dy. Away from the core
// it stands in a small room at the end of a tunnel carved straight from the core, as test/rope-fuzz.mjs carves a
// far start, so the tether lies as a real one would; whatever lay in the room and the tunnel is gone. All the
// ground in view is uncovered, and looked at as ground that comes into view is, so what stands loose is known.
// `reach` is the level of the tether (if none is given, the first that reaches the room with a little to spare).
// `zoom` shows that many times as many cells across: the game's canvas is that much larger and the page scales
// it down. `lit` leaves out the dark. `met` takes every ground as met before, so the name of the place the drill
// stands in comes up on its plate and not, as the first time, across the screen. `wake` wakes the hazard nearest
// the drill (within WAKE cells), as a cut beside it would: lava pours and quenches its slag, a pod bursts, a
// crystal's fuse is lit; how far that has gone when the picture is taken is how long the view is stepped.
// `bombs` gives the drill that level of BLAST, with its charges racked, and no room is carved: the drill stands in
// the end of the tunnel with the ground round it as the seed laid it. `blast` then sets one charge off there, so
// the same view with and without it is a charge's room before and after.
// `key` is the last cut of a keystone slab: of the slab nearest `at` (within KEY cells; no cobble field) every key
// is cut through but the one that faces the core, which is cut down to one line of cells across the crack, and the
// drill stands in the crack beside that line, at the end of a tunnel from the core, pushing into it. Stepped a
// little way (`tetherbore.advance(500)`), the cut is half made and its glow holds the whole slab; stepped for two
// seconds, the slab hangs loose.
//
// The view is held still: `tetherbore.advance(ms)` steps it, `tetherbore.resume()` lets it play.
import * as world from './world.js';
import { T, UPGRADES } from './game.js';

const { N, C, K } = world, HX = C + 0.5, HY = C + 0.5;
const ROOM = 2;                                 // the room is this many cells out from the drill's own, each way
const MOST = 8192;                              // the widest the zoomed canvas may be, in its own pixels
const WAKE = 12;                                // how far from the drill a hazard to wake is looked for, in cells
const KEY = 80;                                 // how far from `at` the middle of a slab to stage the last key of may lie

// The last key of the slab nearest (ax, ay): the others are cut through and this one cut down to one line of
// cells across the crack. Returns { slab, at: [x, y] (the open cell of the crack the drill stands in), into: [x, y]
// (the cell of key beside it) }, or null where no slab is near or its key cannot be come to straight from the core.
function lastKey(game, ax, ay) {
  const w = game.world, near = [];
  for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) near.push(w.slabIn(Math.floor((ax - C) / world.SLAB) + u, Math.floor((ay - C) / world.SLAB) + v));
  near.push(w.firstSlab);
  let S = null;
  for (const s of near) if (s && !s.cobble && Math.hypot(s.cx - ax, s.cy - ay) <= KEY && (!S || Math.hypot(s.cx - ax, s.cy - ay) < Math.hypot(S.cx - ax, S.cy - ay))) S = s;
  if (!S) return null;
  // Which of its keys each cell of key is: the one whose way from the middle it lies nearest. The last key is
  // the one that faces the core.
  const which = i => { const ex = (i % N) - S.cx, ey = Math.floor(i / N) - S.cy; let best = 0; for (let n = 1; n < S.ux.length; n++) if (ex * S.ux[n] + ey * S.uy[n] > ex * S.ux[best] + ey * S.uy[best]) best = n; return best; };
  let last = 0;
  for (let n = 1; n < S.ux.length; n++) if (S.ux[n] * (C - S.cx) + S.uy[n] * (C - S.cy) > S.ux[last] * (C - S.cx) + S.uy[last] * (C - S.cy)) last = n;
  const mine = new Set(S.keys.filter(i => which(i) === last)), code = i => w.slabCell(S, i % N, Math.floor(i / N)), SIDES = [1, N, -1, -N];
  // The shortest line of its cells from the slab's side of the crack to the collar's.
  const from = new Map(), list = [];
  for (const i of mine) if (SIDES.some(s => code(i + s) === 3)) { from.set(i, -1); list.push(i); }
  let end = -1;
  for (let head = 0; head < list.length && end < 0; head++) {
    const i = list[head];
    if (SIDES.some(s => code(i + s) === 4)) { end = i; break; }
    for (const s of SIDES) if (mine.has(i + s) && !from.has(i + s)) { from.set(i + s, i); list.push(i + s); }
  }
  if (end < 0) return null;
  const line = new Set();
  for (let i = end; i >= 0; i = from.get(i)) line.add(i);
  // Where the drill may stand: in the crack beside a cell of that line, with nothing of the slab or the line
  // on the straight way there from the core. The nearest such place to the core.
  let best = null;
  for (const into of line) for (const s of SIDES) {
    const at = into + s, c = code(at);
    if (line.has(at) || (c !== 1 && c !== 2)) continue;
    const x = at % N, y = Math.floor(at / N), far = Math.hypot(x - C, y - C);
    if (best && far >= best.far) continue;
    let clear = true;
    for (const j of world.cellsAlong(HX, HY, x + 0.5, y + 0.5, Math.ceil(far * 2) + 8)) if (j !== at && (line.has(j) || code(j) === 3)) clear = false;
    if (clear) best = { far, at: [x, y], into: [into % N, Math.floor(into / N)] };
  }
  if (!best) return null;
  for (const i of S.keys) if (!line.has(i)) w.setK(i, K.EMPTY);
  return { slab: S, at: best.at, into: best.into, line };
}

export function stage(game, query) {
  const number = (name, fallback) => { const text = query.get(name); return text === null || text.trim() === '' || !Number.isFinite(+text) ? fallback : +text; };
  const reaches = UPGRADES.find(u => u.id === 'tether').values;
  const seed = Math.floor(number('seed', 7));
  let [dx = 0, dy = 0] = (query.get('at') ?? '').split(',').map(v => Math.round(+v) || 0);
  const zoom = Math.max(1, number('zoom', 1)), lit = query.has('lit') && query.get('lit') !== '0', met = query.has('met') && query.get('met') !== '0';
  const wake = query.has('wake') && query.get('wake') !== '0';
  const bombs = Math.max(0, Math.min(4, Math.floor(number('bombs', 0)))), blast = bombs > 0 && query.has('blast') && query.get('blast') !== '0';

  game.save = () => {};
  game.fresh(seed, true);
  // The last key of a slab: the drill's place is the crack beside it, wherever `at` was.
  const key = query.has('key') && query.get('key') !== '0' ? lastKey(game, C + dx, C + dy) : null;
  if (key) { dx = key.at[0] - C; dy = key.at[1] - C; }
  const far = Math.hypot(dx, dy), least = reaches.findIndex(R => R >= far + (key ? key.slab.p * 2 + 6 : 8));
  const level = Math.max(0, Math.min(reaches.length - 1, Math.floor(number('reach', least < 0 ? reaches.length - 1 : least))));
  game.S.lv.tether = level; game.S.lv.bombs = bombs; game.bombs = bombs;
  game.daylight = lit;
  if (met) for (const row of world.BIOMES) if (row) game.S.met[row.id] = 1;
  const d = game.drill, w = game.world;
  if (dx || dy) {
    // (To a slab's last key the tunnel is one cell wide where it comes through the collar, and leaves the slab
    // and the key be; and there is no room.)
    for (let s = 0; s <= far; s += 0.5) for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) {
      const x = C + Math.round(dx * s / far) + u, y = C + Math.round(dy * s / far) + v;
      if (key && ((u || v) && w.slabCell(key.slab, x, y) || key.line.has(y * N + x) || w.slabCell(key.slab, x, y) === 3)) continue;
      w.setK(y * N + x, K.EMPTY);
    }
    if (!bombs && !key) for (let v = -ROOM; v <= ROOM; v++) for (let u = -ROOM; u <= ROOM; u++) w.setK((C + dy + v) * N + C + dx + u, K.EMPTY);
    d.x = d.px = C + dx + 0.5; d.y = d.py = C + dy + 0.5; d.mode = 'free';
    game.band = [[d.x, d.y], [HX, HY]];
    game.changed();
    // Whoever has come this far has hauled before: the first game's title and its beckoning hand are not shown.
    game.S.stats.hauls = 1; game.S.stats.moves = 2;
  }
  game.cam.x = d.x * T; game.cam.y = d.y * T;
  // The nearest hazard is woken as the game wakes one beside a cut, and what that opened is told as a cut is.
  let woke = null;
  if (wake) {
    const x0 = Math.floor(d.x), y0 = Math.floor(d.y);
    let best = -1, near = Infinity;
    for (let v = -WAKE; v <= WAKE; v++) for (let u = -WAKE; u <= WAKE; u++) {
      const j = (y0 + v) * N + x0 + u;
      if (u * u + v * v < near && w.hazAt(j)) { best = j; near = u * u + v * v; }
    }
    if (best >= 0) { woke = w.hazAt(best); game.changed(game.trigger(best, woke, false)); }
  }
  // The drill pushes into the last key for as long as the view is stepped and that cell of key stands, and then
  // lets go. (Whatever steers the game after that, a hand or a test, takes the stick as it always could.)
  if (key) {
    const push = [key.into[0] - key.at[0], key.into[1] - key.at[1], 1], cell = key.into[1] * N + key.into[0];
    Object.defineProperty(game.input, 'auto', {
      configurable: true, enumerable: true,
      get: () => w.k(cell) === K.KEY ? push : null,
      set: value => { Object.defineProperty(game.input, 'auto', { configurable: true, enumerable: true, writable: true, value }); },
    });
  }
  // One charge, set off as a tap on the bomb sets it off.
  const opened = blast ? game.sifts(Math.floor(d.x), Math.floor(d.y)).length : 0;
  if (blast) game.blast();

  let shown = 1;                                // the zoom as it came out: no canvas is made wider than MOST
  return {
    seed, at: [dx, dy], level, reach: reaches[level], zoom, lit,
    // After the game has sized its canvas: widen it by the zoom, and uncover all the ground in view.
    fit() {
      const z = shown = Math.max(1, Math.min(zoom, MOST / Math.max(game.W, game.H)));
      if (z > 1) {
        game.W = Math.ceil(game.W * z); game.H = Math.ceil(game.H * z);
        game.canvas.width = game.W; game.canvas.height = game.H;
        game.ctx.imageSmoothingEnabled = false;
        game.scale /= z;
        // Drawn smaller than it is, the canvas is smoothed, not sampled a pixel in every few.
        if (game.scale < 1 && game.canvas.style) game.canvas.style.imageRendering = 'auto';
      }
      const cx = Math.floor(game.cam.x / T), cy = Math.floor(game.cam.y / T), radius = Math.ceil(Math.max(game.W, game.H) / T / 2) + 2;
      w.see(cx, cy, radius);
      for (let y = cy - radius; y <= cy + radius; y++) for (let x = cx - radius; x <= cx + radius; x++) game.spot(y * N + x);
      game.version++;
    },
    // What the view shows, for the tool to say.
    facts() {
      const b = w.b(game.di);
      return {
        seed, at: [dx, dy], level, reach: reaches[level], zoom: shown, lit,
        cells: [Math.round(game.W / T), Math.round(game.H / T)], canvas: [game.W, game.H],
        biome: b, ground: world.BIOMES[b]?.name ?? `${b}`,
        loose: game.pieces.length, woke, bombs: game.bombs, opened,
        // The last key of a slab: where the slab lies and how big it is, the cell of key the drill pushes into,
        // and how many cells the glow of the cut in hand holds (0: no cut in hand).
        key: key && { slab: [key.slab.cx - C, key.slab.cy - C], radius: key.slab.p, into: [key.into[0] - C, key.into[1] - C], glow: game.drill.dig >= 0 && game.preview.length ? game.preview[0].cells.length : 0 },
      };
    },
  };
}
