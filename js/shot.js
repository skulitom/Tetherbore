// A staged view of the world, for tools/shot.mjs to photograph and for looking at a far place by hand:
//   index.html?shot&seed=7&at=0,-300&reach=6&zoom=4&lit&met&wake&key&pocket&haul=1&cave   (or wake=bell, and so on)
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
// crystal's fuse is lit; how far that has gone when the picture is taken is how long the view is stepped. `wake=`
// a type (lava, spore, spark, bell, vent, worm, lodestone) wakes the nearest of that type. A rare hazard is woken
// by the cut beside it that is nearest the drill, which is made first: a rime bell's fuse is lit, a fumarole
// rumbles and fires out of that side, a glowworm uncoils, a lodestone hums.
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
// `cave` stands the drill in a natural cave of the ground at `at`, within CAVE cells of it: the open cell with the
// most open cells against rock in the eleven by fifteen round it (about what a phone shows), at the end of a tunnel
// from the core that stops three cells short of it and a way one cell wide on from there, with no room carved. So
// the cave is as the ground has it, with the pieces of its own that hang, stand and grow in it (js/decor.js).
// `feel=<event>` makes something of the ground's feel come at once, whatever the ground and its clock: a quake,
// a gust, a drip, a creak, a bubble, steam, a trickle, a shooting star (stars), a worm or a crackle; or `flies`
// (the ground's fireflies, all of them about the drill), `icicle` (one falls near the drill) or `rime` (the
// corners frosted over). Stepped a little way, the picture catches it (js/feel.js: `force`).
//
// What the upgrades show (js/fit.js) is staged with five more: `lv` sets levels before anything else is looked at,
// `max` every row at its last, `late` every row at its last before the late game's, or `id.n` one row, any of them
// in a list read left to right (`lv=max,drill.6`); `shop=<tab>` opens the shop at that tab (with the drill at the
// core); `buy=<id>` buys that row's next level as a purchase does, with nothing asked for it (and never saved): with
// `shop` the shop's moment is what is seen, and without it the shop is opened, bought from and shut at once, so the
// part is fitted at the core; `steer=x,y` holds the thumb that way for every frame; `fire=<id>` makes a power of
// what WORKS fits act at once: `mender` (a pip mended), `arccoil` (an arc taken in), `sporedrive` (a spore's
// drive), `lavaskin` (lava under the drill), `diamond` (steel ahead, to cut), `blackbox` (the drill wrecked). And
// `ladder` shows no world at all: every level of every row, drawn by the game's own drawing in rows, labelled.
//
// The lab's notes are staged with four more: `lab` opens them, at LAB and risen, with what the lab knows set first
// (`all`: everything analysed, thing i with 2 ** (i mod 10) samples; a number n: the first n in the list's order;
// `none`: nothing); `labsel` chooses a thing, by the frame it is drawn from (`seracB`, `firnA`, `hazard` of a
// sheet as `bell-items:hazard`) or by its name (`FLUORITE`), and shows it as a choice does; `scroll` scrolls the
// list that many pixels on from there. None of them saves anything. And `orebook`, as `ladder`, shows no world:
// for each ground that has ore of its own (home, the four directions, the eight strains and the four deep flanks)
// its name, a patch of its rock with its dense rock, its two ores and its hazard as the game draws them, and its
// two ores three times the size.
//
// The creatures (js/fauna.js) are staged with two more: `fauna=<kind>[:<state>]` sets one down (with the rest of
// its den) in the nearest place that suits it, a few cells from the drill, once the view is uncovered: `beetle`,
// `pup`, `moth`, `spitter`, `salamander`, `bat`, `frog`, `puff`, `leech`, `skink`, `wren`, `bee`, `jelly`, `newt`;
// and puts it in a state of its own: `pup:pal` (befriended), `pup:ride` (and riding the drill), `bat:fuse` (the roost
// woken), `spitter:puff` (swelling to spit), `leech:latched` (on the hull), `puff:caught` (lassoed), `wren:peck` (off to
// the find it leads to). With `met` every creature is taken as met before, so no name comes up over it. And
// `faunabook`, as `orebook`, shows no world: each creature in each of its poses on its own ground's rock, by name,
// with what it is to the player (FRIEND, FOE or only seen, KIN).
//
// The view is held still: `tetherbore.advance(ms)` steps it, `tetherbore.resume()` lets it play.
import * as world from './world.js';
import { T, UPGRADES, BOOST } from './game.js';
import { ROWS, EARLY, LAB } from './shop.js';
import { draw, frameAt, sheets, text } from './atlas.js';
import { TETHERS, CORE_IDLE, DISH, REFINERY, CUTTER, BOX, ORBIT } from './fit.js';
import { CREATURES, ROSTER, KIN_FAUNA, FOE_EYE, frameName } from './fauna.js';

const { N, C, K } = world, HX = C + 0.5, HY = C + 0.5;
const ROOM = 2;                                 // the room is this many cells out from the drill's own, each way
const MOST = 8192;                              // the widest the zoomed canvas may be, in its own pixels
const WAKE = 12;                                // how far from the drill a hazard to wake is looked for, in cells
const KEY = 80;                                 // how far from `at` the middle of a slab to stage the last key of may lie
const POCKET = 150;                             // and the middle of a pocket to stand the drill in
const CAVE = 40;                                // and a cave to stand the drill in

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

// The open cell of the ground at (ax, ay), within CAVE cells of it, with the most open cells against rock in the
// eleven by fifteen round it (the world is fresh, so open is as the seed left it), and of those the nearest (ax, ay);
// or null where there is none.
function inCave(game, ax, ay) {
  const w = game.world, open = (x, y) => w.k(y * N + x) === K.EMPTY, ground = w.b(ay * N + ax);
  let best = null;
  for (let v = -CAVE; v <= CAVE; v++) for (let u = -CAVE; u <= CAVE; u++) {
    const x = ax + u, y = ay + v;
    if (!open(x, y) || w.b(y * N + x) !== ground || Math.hypot(x - C, y - C) < 12) continue;
    let room = 0;
    for (let b = -7; b <= 7; b++) for (let a = -5; a <= 5; a++) {
      const p = x + a, q = y + b;
      if (open(p, q) && (!open(p - 1, q) || !open(p + 1, q) || !open(p, q - 1) || !open(p, q + 1))) room++;
    }
    const far = u * u + v * v;
    if (!best || room > best.room || (room === best.room && far < best.far)) best = { room, far, at: [x, y] };
  }
  return best;
}

export function stage(game, query) {
  const number = (name, fallback) => { const text = query.get(name); return text === null || text.trim() === '' || !Number.isFinite(+text) ? fallback : +text; };
  const reaches = UPGRADES.find(u => u.id === 'tether').values;
  const seed = Math.floor(number('seed', 7));
  let [dx = 0, dy = 0] = (query.get('at') ?? '').split(',').map(v => Math.round(+v) || 0);
  const zoom = Math.max(1, number('zoom', 1)), lit = query.has('lit') && query.get('lit') !== '0', met = query.has('met') && query.get('met') !== '0';
  const wake = query.has('wake') && query.get('wake') !== '0', only = world.HAZARDS[query.get('wake')] ? query.get('wake') : null;
  const haul = Math.max(0, Math.min(9, Math.floor(number('haul', 0))));

  game.save = () => {};
  game.fresh(seed, true);
  // The last key of a slab: the drill's place is the crack beside it, wherever `at` was.
  const key = query.has('key') && query.get('key') !== '0' ? lastKey(game, C + dx, C + dy) : null;
  if (key) { dx = key.at[0] - C; dy = key.at[1] - C; }
  // Inside a pocket: likewise.
  const pocket = !key && query.has('pocket') && query.get('pocket') !== '0' ? inPocket(game, C + dx, C + dy) : null;
  if (pocket) { dx = pocket.at[0] - C; dy = pocket.at[1] - C; }
  // In a cave: likewise.
  const cave = !key && !pocket && query.has('cave') && query.get('cave') !== '0' ? inCave(game, C + dx, C + dy) : null;
  if (cave) { dx = cave.at[0] - C; dy = cave.at[1] - C; }
  const far = Math.hypot(dx, dy), least = reaches.findIndex(R => R >= far + (key ? key.slab.p * 2 + 6 : pocket ? pocket.zone.reach * 2 : 8));
  const level = Math.max(0, Math.min(reaches.length - 1, Math.floor(number('reach', least < 0 ? reaches.length - 1 : least))));
  game.S.lv.tether = level;
  game.daylight = lit;
  if (met) for (const row of world.BIOMES) if (row) game.S.met[row.id] = 1;
  const [faunaKind, faunaState] = (query.get('fauna') ?? '').split(':');
  if (met && faunaKind) game.S.fauna = { pal: null, met: Object.fromEntries(CREATURES.slice(1).map(c => [c.key, 1])), spent: [] };
  const d = game.drill, w = game.world;
  if (dx || dy) {
    // (To a slab's last key the tunnel is one cell wide where it comes through the collar, and leaves the slab
    // and the key be; and there is no room.)
    // (Into a pocket the tunnel is one cell wide from where it comes within three cells of the pocket's own.)
    for (let s = 0; s <= far; s += 0.5) for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) {
      const x = C + Math.round(dx * s / far) + u, y = C + Math.round(dy * s / far) + v;
      if (key && ((u || v) && w.slabCell(key.slab, x, y) || key.line.has(y * N + x) || w.slabCell(key.slab, x, y) === 3)) continue;
      if (pocket && (u || v) && Math.hypot(x - pocket.zone.cx, y - pocket.zone.cy) < pocket.zone.reach + 3) continue;
      if (cave && s > far - 3) continue;
      w.setK(y * N + x, K.EMPTY);
    }
    // (And every cell the straight line from the core passes through there, so the tether lies in open ground
    // all the way: a way one cell wide, cut a cell at a time, does not hold a line that runs askew.)
    if (pocket || cave) for (const i of world.cellsAlong(HX, HY, C + dx + 0.5, C + dy + 0.5, Math.ceil(far * 2) + 8)) w.setK(i, K.EMPTY);
    if (!key && !pocket && !cave) for (let v = -ROOM; v <= ROOM; v++) for (let u = -ROOM; u <= ROOM; u++) w.setK((C + dy + v) * N + C + dx + u, K.EMPTY);
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
      if (u * u + v * v < near && w.hazAt(j) && (!only || w.hazAt(j) === only)) { best = j; near = u * u + v * v; }
    }
    if (best >= 0) {
      woke = w.hazAt(best);
      const cut = [];
      if (world.HAZARDS[woke].rare) {
        let side = -1, least = Infinity;
        for (const s of [1, N, -1, -N]) { const j = best + s, far = (j % N - x0) ** 2 + (Math.floor(j / N) - y0) ** 2; if (far < least) { least = far; side = j; } }
        if (world.CRUSH[w.k(side)]) { w.setK(side, K.EMPTY); cut.push(side); }
      }
      game.changed([...cut, ...game.trigger(best, woke, false)]);
    }
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
  // Something of the ground's feel, made to come at once.
  const feel = query.get('feel');
  if (feel) game.feel.force(feel);
  // Nuggets of the pocket's mineral, brought home as a loop round them would bring them.
  const hauled = pocket && haul ? nuggets(game, pocket.zone, haul) : [];
  if (hauled.length) { w.see(Math.floor(d.x), Math.floor(d.y), 12); game.haul(hauled); game.changed(hauled); }

  // Levels, the shop, a purchase, the thumb, a power acting (above).
  const levels = query.get('lv');
  if (levels) {
    let set = 0;
    for (const word of levels.split(',')) {
      if (word === 'max' || word === 'late') { for (const u of ROWS) { game.S.lv[u.id] = word === 'max' ? u.values.length - 1 : EARLY[u.id]; set += game.S.lv[u.id]; } continue; }
      const [id, n] = word.split('.'), u = ROWS.find(r => r.id === id);
      if (u && Number.isInteger(+n)) { game.S.lv[id] = Math.max(0, Math.min(u.values.length - 1, +n)); set += game.S.lv[id]; }
    }
    // (A game with levels bought has bought before: the next purchase is not its first.)
    game.S.stats.buys = set; game.S.stats.hauls = Math.max(1, game.S.stats.hauls);
  }
  const tab = query.get('shop');
  if (tab) { game.shop = true; game.shopTab = tab; game.shopRise = 1; }
  const buying = ROWS.find(u => u.id === query.get('buy'));
  if (buying) {
    // (Bought as a purchase is, its price put aside: a level at its last is bought again from the one before.)
    if (game.S.lv[buying.id] >= buying.values.length - 1) game.S.lv[buying.id] = buying.values.length - 2;
    const can = game.canBuy, cost = game.cost, open = game.shop;
    game.canBuy = u => u === buying || can.call(game, u);
    game.cost = u => u === buying ? { grit: 0, gems: 0, spec: 0 } : cost.call(game, u);
    game.shop = true; game.buy(buying); game.shop = open;
    game.canBuy = can; game.cost = cost;
  }
  const steer = (query.get('steer') ?? '').split(',').map(Number);
  if (steer.length === 2 && steer.every(Number.isFinite) && Math.hypot(...steer) > 0) game.input.auto = [steer[0] / Math.hypot(...steer), steer[1] / Math.hypot(...steer), 1];
  const fire = query.get('fire');
  if (fire) {
    const i = game.di, x = i % N, y = Math.floor(i / N);
    if (fire === 'mender') { game.S.lv.mender ||= 1; game.dents = 1; game.mendIn = game.val('mender'); }
    else if (fire === 'arccoil') { game.S.lv.arccoil = 1; game.dents = 1; game.zap(x + 2, y); }
    else if (fire === 'sporedrive') { game.S.lv.sporedrive = 1; game.boost = BOOST.time; }
    else if (fire === 'lavaskin') { game.S.lv.lavaskin = 1; for (const j of [i, i - 1, i + 1]) { w.lava.set(j, 9); game.lavaVol.set(j, 1); } }
    else if (fire === 'diamond') { game.S.lv.diamond = 1; w.setK(i + 2, K.STEEL); w.setK(i + 1, K.STEEL); game.changed(); game.input.auto = [1, 0, 1]; }
    else if (fire === 'blackbox') { game.S.lv.blackbox ||= 1; game.dents = game.val('hull') - 1; game.shield = 0; game.hit(0.3); }
  }
  if (query.has('ladder') && query.get('ladder') !== '0') game.render = () => ladder(game);
  if (query.has('orebook') && query.get('orebook') !== '0') game.render = () => orebook(game);
  if (query.has('faunabook') && query.get('faunabook') !== '0') game.render = () => faunabook(game);
  // The lab's notes (above): what it knows, then the panel opened at the thing chosen, once the view has its size.
  const lab = query.get('lab');
  if (lab !== null && lab !== '0') {
    game.S.lab = {};
    LAB.forEach((e, i) => { if (lab === 'all' || i < Math.floor(number('lab', 0))) game.S.lab[e.key] = 2 ** (i % 10); });
    const want = (query.get('labsel') ?? '').trim(), chosen = want && LAB.find(e => e.key === want || e.key.split(':')[1] === want || e.name === want.toUpperCase());
    if (chosen) game.labSel = chosen.key;
  }
  const staged = lab !== null && lab !== '0';

  let shown = 1;                                // the zoom as it came out: no canvas is made wider than MOST
  let creature = -1;                            // the slot of the creature set down, if one was
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
      // (A creature is set down once the ground about it is seen: it lives only in ground that has been.)
      if (faunaKind) { creature = game.fauna.stage(game, faunaKind); if (faunaState) game.fauna.stageAs(game, creature, faunaState); }
      // (The lab's list is laid out for the screen it is seen on, so it is opened once the screen has its size.)
      if (staged) {
        game.labRise = 1; game.openLab(true, 'lab'); game.labRise = 1;
        const i = LAB.findIndex(e => e.key === game.labSel), g = game.labGeom();
        if (query.get('labsel')) { game.labReveal(i); if (game.labAim !== null) game.labScroll = game.labAim; game.labAim = null; }
        game.labScroll = Math.max(0, Math.min(g.most, game.labScroll + number('scroll', 0)));
      }
    },
    // What the view shows, for the tool to say.
    facts() {
      const b = w.b(game.di);
      return {
        seed, at: [dx, dy], level, reach: reaches[level], zoom: shown, lit,
        cells: [Math.round(game.W / T), Math.round(game.H / T)], canvas: [game.W, game.H],
        biome: b, ground: world.BIOMES[b]?.name ?? `${b}`,
        loose: game.pieces.length, woke,
        // The creature set down: where, and in what state; and how many are about.
        fauna: faunaKind ? { kind: faunaKind, slot: creature, at: creature >= 0 ? [+(game.fauna.x[creature] - C).toFixed(1), +(game.fauna.y[creature] - C).toFixed(1)] : null, state: creature >= 0 ? game.fauna.st[creature] : null, alive: game.fauna.alive } : null,
        // What of the ground's feel is on show, and whether what was made to come has still to (`feel`).
        feel: { particles: game.feel.live, events: game.feel.events, forced: game.feel.forced },
        // Inside a pocket: where its middle lies, its radius and its ground; and how many cells were hauled.
        cave: cave && { at: [cave.at[0] - C, cave.at[1] - C], room: cave.room },
        pocket: pocket && { at: [pocket.zone.cx - C, pocket.zone.cy - C], radius: pocket.zone.rho, ground: world.BIOMES[pocket.zone.row].name, hauled: hauled.length, specimens: game.S.spec },
        // The last key of a slab: where the slab lies and how big it is, the cell of key the drill pushes into,
        // and how many cells the glow of the cut in hand holds (0: no cut in hand).
        key: key && { slab: [key.slab.cx - C, key.slab.cy - C], radius: key.slab.p, into: [key.into[0] - C, key.into[1] - C], glow: game.drill.dig >= 0 && game.preview.length ? game.preview[0].cells.length : 0 },
      };
    },
  };
}

// Each creature, in each of its poses facing east and its first facing west, three times the size, on a patch of the
// rock of a ground it lives in, with its name and what it is to the player: FRIEND, FOE, or KIN (only seen). A foe's
// eyes are drawn again over it, as the game lays them over the dark.
function faunabook(game) {
  const ctx = game.ctx, rowH = 46, cols = Math.max(1, Math.min(2, Math.floor(game.W / 360))), colW = Math.floor(game.W / cols), per = Math.ceil((CREATURES.length - 1) / cols);
  ctx.globalAlpha = 1; ctx.fillStyle = '#100e18'; ctx.fillRect(0, 0, game.W, game.H);
  game.overCtx?.clearRect(0, 0, game.over.width, game.over.height);
  const s = sheets.fauna, homeOf = key => {
    const name = Object.keys(ROSTER).find(g => [...(ROSTER[g].kin ?? []), ...(ROSTER[g].named ?? [])].some(([id]) => CREATURES[id].key === key));
    return world.BIOMES.find(r => r && r.name === name) ?? world.BIOMES[0];
  };
  CREATURES.slice(1).forEach((c, n) => {
    const x0 = 4 + Math.floor(n / per) * colW, y0 = 4 + (n % per) * rowH, row = homeOf(c.key), tiles = sheets[row.sheet].tiles[255];
    text(ctx, `${c.name}  ${c.tier === 'foe' ? 'FOE' : c.tier === 'friend' ? 'FRIEND' : 'KIN'}  (${row.title ?? row.name.toUpperCase()})`, x0, y0, c.tier === 'foe' ? FOE_EYE : c.tier === 'friend' ? '#8cf2c4' : '#bcb4cc');
    const poses = Object.keys(s.frames).filter(f => f.startsWith(`${c.key}-`) && !f.endsWith('-l'));
    [...poses, `${poses[0]}-l`].forEach((f, m) => {
      const x = x0 + m * 34, y = y0 + 11, r = s.frames[f], t = tiles[m % tiles.length];
      ctx.drawImage(sheets[row.sheet].image, t[0], t[1], t[2], t[3], x, y, 32, 32);
      ctx.drawImage(s.image, r[0], r[1], r[2], r[3], x, y, 32, 32);
      ctx.fillStyle = FOE_EYE;
      for (const [ex, ey] of s.eyes?.[f] ?? []) ctx.fillRect(x + ex * 2, y + ey * 2, 2, 2);
    });
  });
}

// For each ground with ore of its own, its name, a patch of its rock as the game draws it (two rows of four cells:
// plain rock, dense rock, its common ore, its rich ore; its common ore, its hazard, its rich ore, plain rock), and
// its two ores again at three times the size. A direction's ground that has no hazard of its own (the north's) shows
// its direction's rare one. In one column or two, as the page has room. (No world is drawn: a page of pictures.)
const OREBOOK = [0, 1, 2, 3, 4, 17, 18, 19, 20, 21, 22, 23, 24, 5, 6, 7, 8];
function orebook(game) {
  const ctx = game.ctx, cols = Math.max(1, Math.min(3, Math.floor(game.W / 196))), rowH = 62, colW = Math.floor(game.W / cols);
  ctx.globalAlpha = 1; ctx.fillStyle = '#100e18'; ctx.fillRect(0, 0, game.W, game.H);
  game.overCtx?.clearRect(0, 0, game.over.width, game.over.height);
  const frame = (sheet, name, x, y, size = 16) => { const s = sheets[sheet], r = s?.frames[name]; if (r) ctx.drawImage(s.image, r[0], r[1], r[2], r[3], x, y, size, size); };
  const rock = (row, x, y, n, size = 16) => { const r = sheets[row.sheet].tiles[255][n % sheets[row.sheet].tiles[255].length]; ctx.drawImage(sheets[row.sheet].image, r[0], r[1], r[2], r[3], x, y, size, size); };
  OREBOOK.forEach((id, n) => {
    const row = world.BIOMES[id], x0 = 4 + Math.floor(n / Math.ceil(OREBOOK.length / cols)) * colW, y0 = 4 + (n % Math.ceil(OREBOOK.length / cols)) * rowH;
    const haz = row.haz ? [world.HAZARDS[row.haz.type].sheet, 'hazard'] : world.RARE[row.kin] ? [world.HAZARDS[world.RARE[row.kin]].sheet, 'hazard'] : null;
    text(ctx, `${row.title}  ${row.ores[0][1]} / ${row.ores[1][1]}`, x0, y0, '#bcb4cc');
    const cells = [null, [row.items, 'dense'], row.ores[0], row.ores[1], row.ores[0], haz, row.ores[1], null];
    cells.forEach((what, c) => { const x = x0 + (c % 4) * 16, y = y0 + 12 + Math.floor(c / 4) * 16; rock(row, x, y, c); if (what) frame(what[0], what[1], x, y); });
    [row.ores[0], row.ores[1]].forEach((what, c) => { const x = x0 + 72 + c * 52, y = y0 + 11; rock(row, x, y, c, 48); frame(what[0], what[1], x, y, 48); });
  });
}

// Every level of every row, drawn by the game's own drawing, in rows: the bit spinning and hot, the ram with its
// flame, the hull's plates, what WORKS fits plain and lit (the mender at each level), what CORE fits on the drill
// (the black box, the lamp), the reach's spans, the dish, the core with its circling lights, and what CORE builds
// on the station. (The game is not drawn: this is a page of pictures.)
function ladder(game) {
  const ctx = game.ctx, S = game.S, keep = { ...S.lv }, now = game.time * 1000, look = { heat: 0, flame: 0, tint: '#ffffff', tintAlpha: 0, lit: 0, spin: 0 };
  ctx.globalAlpha = 1; ctx.fillStyle = '#100e18'; ctx.fillRect(0, 0, game.W, game.H);
  game.overCtx?.clearRect(0, 0, game.over.width, game.over.height);
  const clear = () => { for (const u of ROWS) S.lv[u.id] = 0; };
  const label = (name, y) => text(ctx, name, 4, y - 4, '#bcb4cc');
  // A row of drills, one a level, each drawn by `paint(x, y, level)` with every other row at nothing.
  const drills = (name, y, n, paint, step = 22, from = 52) => {
    label(name, y);
    for (let k = 0; k < n; k++) { clear(); paint(from + k * step, y, k); text(ctx, `${k}`, from + k * step, y + 9, '#6a6478', 0.5); }
  };
  let y = 14;
  look.lit = 0;
  drills('BIT', y, 8, (x, yy, l) => { look.heat = l >= 3 ? 0.6 + 0.3 * Math.sin(game.time * 6) : 0; look.flame = 0; game.drawDrill(x, yy, 0, l, 0, now, 1, 1, ctx, 0, null, look); }); y += 26;
  drills('RAM', y, 7, (x, yy, l) => { look.heat = 0; look.flame = 1; game.drawDrill(x, yy, 0, 0, l, now, 1, 1, ctx, 0, null, look); }, 34, 64); y += 26;
  drills('HULL', y, 8, (x, yy, l) => game.drawDrill(x, yy, 0, 0, 0, -1, 1, 1, ctx, l, null, null)); y += 26;
  // What WORKS fits, and what CORE puts on the drill: plain, then lit. (The diamond tip on both cones.)
  const fits = [['mender', 1, 0], ['mender', 2, 0], ['mender', 3, 0], ['mender', 4, 0], ['mender', 5, 0], ['lavaskin', 1, 0], ['sporedrive', 1, 0], ['arccoil', 1, 0],
    ['diamond', 1, 0], ['diamond', 1, 6], ['blackbox', 1, 0], ['lamp', 1, 0], ['lamp', 3, 0], ['lamp', 5, 0]];
  look.heat = 0; look.flame = 0;
  for (const lit of [0, 127]) {
    label(lit ? 'LIT' : 'FITS', y);
    fits.forEach(([id, l, bit], k) => { clear(); S.lv[id] = l; look.lit = lit; game.drawDrill(52 + k * 22, y, 0, bit, 0, -1, 1, 1, ctx, 0, null, look); });
    y += 22;
  }
  y += 4;
  // The reach: a span of each level, with a dot of its light where it has one.
  label('REACH', y);
  TETHERS.forEach((style, k) => {
    const x = 44 + k * 22;
    if (style.thick) game.drawSpan(x, y + 5, x + 16, y - 5, style);
    game.drawSpan(x, y + 4, x + 16, y - 6, style);
    if (style.glow) { const u = (game.time % 0.8) / 0.8; ctx.fillStyle = style.glow; ctx.fillRect(Math.round(x + 16 * u), Math.round(y + 4 - 10 * u), 2, 2); }
  });
  y += 22;
  label('SCAN', y);
  for (let k = 0; k < DISH.length; k++) draw(ctx, 'dish', frameAt('dish', DISH[k], now), 44 + k * 22, y - 10);
  y += 22;
  label('WINCH', y + 16);
  for (let k = 0; k < CORE_IDLE.length; k++) {
    const x = 40 + k * 50;
    draw(ctx, 'core', frameAt('core', CORE_IDLE[k], now), x, y - 6);
    ctx.fillStyle = '#c8f4ff';
    for (let n = 0; n < ORBIT[k]; n++) { const a = game.time * 0.8 + n * 6.2832 / ORBIT[k]; ctx.fillRect(Math.round(x + 24 + Math.cos(a) * 25), Math.round(y + 18 + Math.sin(a) * 25), 2, 2); }
  }
  y += 56;
  // What CORE builds on the station, each level a cell of its corner of the sheet, twice the size.
  const parts = [['REFINERY', REFINERY, 0, 0], ['CUTTER', CUTTER, 46, 46], ['BLACK BOX', BOX.map(f => f && f[((game.time * 2) | 0) % 2]), 0, 44]];
  for (const [name, frames, cx, cy] of parts) {
    label(name, y + 10);
    for (let k = 1; k < frames.length; k++) {
      const r = frames[k] ? sheets.station.frames[frames[k]] : frameAt('station', 'cutter-6', now);
      ctx.drawImage(sheets.station.image, r[0] + cx, r[1] + cy, 18, 18, 52 + (k - 1) * 40, y - 6, 36, 36);
    }
    y += 40;
  }
  Object.assign(S.lv, keep);
}
