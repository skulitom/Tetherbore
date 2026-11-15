// A staged view of the world, for tools/shot.mjs to photograph and for looking at a far place by hand:
//   index.html?shot&seed=7&at=0,-300&reach=6&zoom=4&lit&met&wake&bombs=3&blast&key&pocket&haul=1
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
// `pocket` stands the drill inside the pocket nearest `at` (within POCKET cells): in the open cell of its middle
// that is nearest the core (of a hive, in the lane of the chamber at its middle, beside the nugget; of a drift,
// among the four boulders round its middle), at the end of a tunnel from the core that stops short of the pocket
// and a way one cell wide bitten on from there; no room is carved. A pocket with no open cell in it (an ash flat)
// has the drill in its middle cell, at the end of that way. `haul=n` then brings home the n nuggets of the
// pocket's mineral nearest the drill, as a loop drawn round them would (of a drift, the whole boulder each lies
// in): one is a light haul, which says what it paid where it lay, and two have a banner; either brings out the
// count of specimens under the top bar.
//
// The view is held still: `tetherbore.advance(ms)` steps it, `tetherbore.resume()` lets it play.
import * as world from './world.js';
import { T, UPGRADES } from './game.js';

const { N, C, K } = world, HX = C + 0.5, HY = C + 0.5;
const ROOM = 2;                                 // the room is this many cells out from the drill's own, each way
const MOST = 8192;                              // the widest the zoomed canvas may be, in its own pixels
const WAKE = 12;                                // how far from the drill a hazard to wake is looked for, in cells
const KEY = 80;                                 // how far from `at` the middle of a slab to stage the last key of may lie
const POCKET = 150;                             // and the middle of a pocket to stand the drill in

// The pocket nearest (ax, ay) and where the drill may stand in it: { zone, at: [x, y] }, or null where none is
// near. The place is an open cell among those three cells from the pocket's middle (in a hive, the lane of the
// middle chamber), or failing that among all the pocket's cells: the one the straight way to which from the core
// goes through the fewest cells of the pocket's mineral and its stalks (the way in is bitten through whatever lies
// on it), and of those the nearest the core. Where the pocket has no open cell at all, its middle cell.
function inPocket(game, ax, ay) {
  const w = game.world, near = [];
  for (let v = -2; v <= 2; v++) for (let u = -2; u <= 2; u++) near.push(w.zoneOf(Math.floor((ax - C) / world.ZONE) + u, Math.floor((ay - C) / world.ZONE) + v));
  let Z = null;
  for (const z of near) if (z && Math.hypot(z.cx - ax, z.cy - ay) <= POCKET && (!Z || Math.hypot(z.cx - ax, z.cy - ay) < Math.hypot(Z.cx - ax, Z.cy - ay))) Z = z;
  if (!Z) return null;
  let best = null;
  for (const ring of [true, false]) {
    const most = ring ? 3 : Math.ceil(Z.reach);
    for (let v = -most; v <= most && !(best && !ring); v++) for (let u = -most; u <= most; u++) {
      const x = Z.cx + u, y = Z.cy + v, far = Math.hypot(x - C, y - C);
      if ((ring && Math.max(Math.abs(u), Math.abs(v)) !== 3) || w.b(y * N + x) !== Z.row || w.k(y * N + x) !== K.EMPTY) continue;
      let cost = 0;
      for (let s = Math.max(0, far - 2 * Z.reach - 6), last = -1; s <= far; s += 0.5) {
        const i = (C + Math.round((y - C) * s / far)) * N + C + Math.round((x - C) * s / far), k = i === last ? K.EMPTY : w.k(i);
        if (k === Z.mineral || k === K.NODE) cost++;
        last = i;
      }
      if (!best || cost < best.cost || (cost === best.cost && far < best.far)) best = { far, cost, at: [x, y] };
    }
    if (best) break;
  }
  return { zone: Z, at: best ? best.at : [Z.cx, Z.cy] };
}
// The cells of the `count` nuggets of a pocket's mineral that lie nearest the drill: each the cells of mineral
// joined to one another and whatever special cells (a stalk) are joined to those; or, where the mineral lies in a
// piece of ground that hangs loose (a drift's boulder), the whole of that piece.
function nuggets(game, Z, count) {
  const w = game.world, d = game.drill, seen = new Set(), found = [], most = Math.ceil(Z.reach);
  for (let v = -most; v <= most; v++) for (let u = -most; u <= most; u++) {
    const i = (Z.cy + v) * N + Z.cx + u;
    if (seen.has(i) || w.b(i) !== Z.row || w.k(i) !== Z.mineral) continue;
    const cells = [i];
    seen.add(i);
    for (const c of cells) for (const s of [1, N, -1, -N]) { const j = c + s, k = w.k(j); if (!seen.has(j) && w.b(j) === Z.row && (k === Z.mineral || k === K.NODE)) { seen.add(j); cells.push(j); } }
    // (A drift's boulder: the ground joined to the mineral, which the game knows as loose once any cell on its
    // outside has been looked at.)
    let piece = null;
    if (world.BIOMES[Z.row].pocket.twist === 'drift') {
      const ground = [i], got = new Set(ground);
      for (const c of ground) { game.spot(c); for (const s of [1, N, -1, -N]) { const j = c + s; if (!got.has(j) && w.b(j) === Z.row && w.k(j) !== K.EMPTY && ground.length < 64) { got.add(j); ground.push(j); } } }
      piece = game.pieceOf.get(i) ?? null;
      if (piece) for (const c of piece) seen.add(c);
    }
    found.push({ cells: piece ? piece.slice() : cells, far: Math.hypot((i % N) + 1.5 - d.x, Math.floor(i / N) + 1.5 - d.y) });
  }
  return found.sort((a, b) => a.far - b.far).slice(0, count).flatMap(n => n.cells);
}

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
  const haul = Math.max(0, Math.min(9, Math.floor(number('haul', 0))));

  game.save = () => {};
  game.fresh(seed, true);
  // The last key of a slab: the drill's place is the crack beside it, wherever `at` was.
  const key = query.has('key') && query.get('key') !== '0' ? lastKey(game, C + dx, C + dy) : null;
  if (key) { dx = key.at[0] - C; dy = key.at[1] - C; }
  // Inside a pocket: likewise.
  const pocket = !key && query.has('pocket') && query.get('pocket') !== '0' ? inPocket(game, C + dx, C + dy) : null;
  if (pocket) { dx = pocket.at[0] - C; dy = pocket.at[1] - C; }
  const far = Math.hypot(dx, dy), least = reaches.findIndex(R => R >= far + (key ? key.slab.p * 2 + 6 : pocket ? pocket.zone.reach * 2 : 8));
  const level = Math.max(0, Math.min(reaches.length - 1, Math.floor(number('reach', least < 0 ? reaches.length - 1 : least))));
  game.S.lv.tether = level; game.S.lv.bombs = bombs; game.bombs = bombs;
  game.daylight = lit;
  if (met) for (const row of world.BIOMES) if (row) game.S.met[row.id] = 1;
  const d = game.drill, w = game.world;
  if (dx || dy) {
    // (To a slab's last key the tunnel is one cell wide where it comes through the collar, and leaves the slab
    // and the key be; and there is no room.)
    // (Into a pocket the tunnel is one cell wide from where it comes within three cells of the pocket's own.)
    for (let s = 0; s <= far; s += 0.5) for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) {
      const x = C + Math.round(dx * s / far) + u, y = C + Math.round(dy * s / far) + v;
      if (key && ((u || v) && w.slabCell(key.slab, x, y) || key.line.has(y * N + x) || w.slabCell(key.slab, x, y) === 3)) continue;
      if (pocket && (u || v) && Math.hypot(x - pocket.zone.cx, y - pocket.zone.cy) < pocket.zone.reach + 3) continue;
      w.setK(y * N + x, K.EMPTY);
    }
    // (And every cell the straight line from the core passes through there, so the tether lies in open ground
    // all the way: a way one cell wide, cut a cell at a time, does not hold a line that runs askew.)
    if (pocket) for (const i of world.cellsAlong(HX, HY, C + dx + 0.5, C + dy + 0.5, Math.ceil(far * 2) + 8)) w.setK(i, K.EMPTY);
    if (!bombs && !key && !pocket) for (let v = -ROOM; v <= ROOM; v++) for (let u = -ROOM; u <= ROOM; u++) w.setK((C + dy + v) * N + C + dx + u, K.EMPTY);
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
  // Nuggets of the pocket's mineral, brought home as a loop round them would bring them.
  const hauled = pocket && haul ? nuggets(game, pocket.zone, haul) : [];
  if (hauled.length) { w.see(Math.floor(d.x), Math.floor(d.y), 12); game.haul(hauled); game.changed(hauled); }

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
        // Inside a pocket: where its middle lies, its radius and its ground; and how many cells were hauled.
        pocket: pocket && { at: [pocket.zone.cx - C, pocket.zone.cy - C], radius: pocket.zone.rho, ground: world.BIOMES[pocket.zone.row].name, hauled: hauled.length, specimens: game.S.spec },
        // The last key of a slab: where the slab lies and how big it is, the cell of key the drill pushes into,
        // and how many cells the glow of the cut in hand holds (0: no cut in hand).
        key: key && { slab: [key.slab.cx - C, key.slab.cy - C], radius: key.slab.p, into: [key.into[0] - C, key.into[1] - C], glow: game.drill.dig >= 0 && game.preview.length ? game.preview[0].cells.length : 0 },
      };
    },
  };
}
