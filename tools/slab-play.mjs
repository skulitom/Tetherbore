// A keystone slab played with no hand on it and no browser (docs/CONTENT-PLAN.md, content item 5): the drill flies
// from the core to the slab's crack, cutting its own way; flies one lap of the crack, cutting through each key as it
// comes to it; and the slab is hauled when the tether is round it. What it took and what it paid is printed.
//   node tools/slab-play.mjs [--seed 7] [--slab n] [--tether level] [--winch level] [--staged]
//
//   --seed n      the world (7)
//   --slab n      which of the world's slabs, counted from the nearest the core: 0 is the first slab (the default),
//                 and `node tools/slabs.mjs --where <seed>` lists them in that order. A cobble field is not played.
//   --tether n    the level of reach; if not given, the first that goes round the slab. With it go the levels of
//                 bit, winch and ram a player holds by then (`holds`).
//   --winch n     another level of winch than that (0: a slab over 150 cells is over its load)
//   --staged      the drill starts at the end of a tunnel staged from the core to just outside the slab's collar
//                 (as the fuzz stages a start), not at the core: for a slab far out, where the way there is long
//
// The pilot flies from cell to cell by the quickest way (open ground flown, rock cut at what the cut costs), slows
// for every turn, and never cuts a key until it is in the crack: slower than a thumb, and no cleverer. Its lap is
// the cheapest ring through the crack's own cells, the keys among them, right round the slab's middle.
//
// `play` returns what happened; test/regress/c5-slab-play.mjs holds the first slab of a new game to it.
import { fileURLToPath } from 'node:url';
import { makeGame, random, tetherFaults, UPGRADES, C, N, K, world } from '../test/harness.mjs';
import { fly } from './sift.mjs';
import { slabsOf } from './slabs.mjs';

const { HARD, DX, DY, digTime, hazOf } = world, HX = C + 0.5, HY = C + 0.5;
const SPEED = [1, 1.6, 2.4, 3.6, 5], FLY = 9;

// What a player holds when level `tether` of reach is theirs: every level of bit, winch and ram priced below it.
export function holds(tether) {
  const lv = { tether };
  for (const id of ['drill', 'winch', 'momentum']) lv[id] = UPGRADES.find(u => u.id === id).beside.filter(b => b <= tether).length;
  return lv;
}
// The first level of reach that goes right round a slab, crack and all.
export const reachFor = S => UPGRADES[0].values.findIndex(R => R >= Math.hypot(S.cx - C, S.cy - C) + S.p + 4);
// A world's slabs (no cobble fields), the first slab first and then by how far from the core they lie.
export const ringsOf = w => slabsOf(w, 2300).filter(S => !S.cobble).sort((a, b) => (a === w.firstSlab ? -1 : b === w.firstSlab ? 1 : 0) || Math.hypot(a.cx - C, a.cy - C) - Math.hypot(b.cx - C, b.cy - C));

// The quickest way from cell (sx, sy) to a cell `goal` says yes to, as a list of cells, or null: through open
// ground (corner to corner only where both cells beside are open too), cutting where it must at what the cut costs,
// a hazard at four seconds more, never a key, never loose ground, never past the tether's reach.
function route(game, sx, sy, goal, x0, y0, x1, y1) {
  const w = game.world, wide = x1 - x0 + 1, speed = FLY * game.val('momentum'), bit = SPEED[game.S.lv.drill];
  const cost = new Map(), from = new Map(), heap = [], start = (sy - y0) * wide + sx - x0;
  const push = (c, s) => { heap.push([c, s]); for (let n = heap.length - 1; n > 0;) { const up = (n - 1) >> 1; if (heap[up][0] <= heap[n][0]) break; [heap[up], heap[n]] = [heap[n], heap[up]]; n = up; } };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) { heap[0] = last; for (let n = 0; ;) { let m = n; for (const k of [2 * n + 1, 2 * n + 2]) if (k < heap.length && heap[k][0] < heap[m][0]) m = k; if (m === n) break; [heap[m], heap[n]] = [heap[n], heap[m]]; n = m; } }
    return top;
  };
  const open = (x, y) => { const i = y * N + x; return w.k(i) === K.EMPTY && !w.lava.has(i); };
  cost.set(start, 0); push(0, start);
  while (heap.length) {
    const [c, s] = pop();
    if (c > cost.get(s)) continue;
    const x = x0 + s % wide, y = y0 + Math.floor(s / wide);
    if (goal(x, y)) { const path = []; for (let at = s; at !== undefined; at = from.get(at)) path.unshift([x0 + at % wide, y0 + Math.floor(at / wide)]); return path; }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy, i = ny * N + nx;
      if (nx < x0 || ny < y0 || nx > x1 || ny > y1 || game.pieceOf.has(i) || !game.within(nx + 0.5, ny + 0.5)) continue;
      let step = (dx && dy ? 1.414 : 1) / speed;
      if (dx && dy) { if (!open(nx, ny) || !open(x + dx, y) || !open(x, y + dy)) continue; }
      else if (!open(nx, ny)) {
        const k = w.k(i);
        if (k === K.EMPTY || k === K.KEY || HARD[k] >= 99) continue;
        step += digTime(k, w.row(i)) / bit + (hazOf(k, w.row(i)) ? 4 : 0);
      }
      const next = (ny - y0) * wide + nx - x0;
      if (c + step < (cost.get(next) ?? Infinity)) { cost.set(next, c + step); from.set(next, s); push(c + step, next); }
    }
  }
  return null;
}
// One lap of a slab's crack from cell (sx, sy) of it and back to that cell, as a list of cells, or null: side to
// side through the crack's own cells (open, or key: what `World.slabCell` says is crack or key and the world's cells
// agree), counting how many times the way has crossed the line east from the slab's middle (down one, up one off).
// The cheapest such way that comes back having crossed it once: a key costs what cutting it does.
function lap(game, S, sx, sy) {
  const w = game.world, half = Math.ceil(S.reach) + 1, wide = 2 * half + 1, x0 = S.cx - half, y0 = S.cy - half, bit = SPEED[game.S.lv.drill], speed = FLY * game.val('momentum');
  const crack = (x, y) => { const code = w.slabCell(S, x, y), k = w.k(y * N + x); return (code === 1 || code === 2) && (k === K.EMPTY || k === K.KEY); };
  const id = (x, y, turn) => ((y - y0) * wide + x - x0) * 3 + turn + 1, start = id(sx, sy, 0);
  const cost = new Map([[start, 0]]), from = new Map(), list = [[0, start]];
  // (The crack has a few hundred cells: the list is kept in order by hand.)
  while (list.length) {
    let at = 0;
    for (let n = 1; n < list.length; n++) if (list[n][0] < list[at][0]) at = n;
    const [c, s] = list.splice(at, 1)[0];
    if (c > cost.get(s)) continue;
    const turn = (s % 3) - 1, cell = (s - turn - 1) / 3, x = x0 + cell % wide, y = y0 + Math.floor(cell / wide);
    if (turn && x === sx && y === sy) { const path = []; for (let p = s; p !== undefined; p = from.get(p)) { const t = (p % 3) - 1, cl = (p - t - 1) / 3; path.unshift([x0 + cl % wide, y0 + Math.floor(cl / wide)]); } return path; }
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d], ny = y + DY[d];
      if (!crack(nx, ny) || !game.within(nx + 0.5, ny + 0.5)) continue;
      const to = turn + (x > S.cx && d === 1 && y === S.cy - 1 ? 1 : x > S.cx && d === 3 && y === S.cy ? -1 : 0);
      if (to < -1 || to > 1) continue;
      const k = w.k(ny * N + nx), step = 1 / speed + (k === K.KEY ? digTime(k, w.row(ny * N + nx)) / bit : 0), next = id(nx, ny, to);
      if (c + step < (cost.get(next) ?? Infinity)) { cost.set(next, c + step); from.set(next, s); list.push([c + step, next]); }
    }
  }
  return null;
}

// A slab played. `pick` is which of the world's slabs (`ringsOf`: 0 the first), `lv` levels to hold other than what
// a player would by then, `staged` whether the drill starts beside the slab at the end of a staged tunnel.
// Returns:
//   slab            the world's record of it; inside: how many cells of ground the crack shuts in (keys apart)
//   levels          what the drill held
//   reached         whether the drill came to the crack, and in how many seconds (`reachT`)
//   keys            cells of key cut by the drill
//   loose           the frame the whole slab went into the books as one loose piece: { cells, sides, followed,
//                   made } (the piece's size, and the work of that frame as `World` counts it), or null
//   glow            how many cells the last cut's glow held just before that cut
//   hauled          the haul that took the slab: the game's own record of it ({ title, n, mult, over, grit, gems }), or null
//   lapT            seconds from coming to the crack until the haul
//   left            cells of the slab's own ground still standing afterwards
//   grit, gems      what was banked in all
//   work            the most `World` counted in any one frame: { sides, followed, made }
//   ms              how long the frame the slab came loose in took, and the longest frame of all, in milliseconds
//                   on this machine: to be read, never to be held to
//   faults          everything `tetherFaults` found wrong with the string, asked every tenth of a second
export async function play(seed = 7, pick = 0, lv = {}, staged = false) {
  Math.random = random(seed + 5);
  const probe = new world.World(); probe.reset(seed);
  const at = ringsOf(probe)[pick], level = lv.tether ?? reachFor(at), levels = { ...holds(level), ...lv };
  const game = await makeGame(seed, levels), w = game.world, d = game.drill, S = ringsOf(w)[pick];
  const out = { slab: S, levels, reached: false, reachT: 0, keys: 0, loose: null, glow: 0, hauled: null, lapT: 0, left: 0, grit: 0, gems: 0, work: { sides: 0, followed: 0, made: 0 }, faults: [], ms: { loose: 0, worst: 0 } };
  const mid = S.cy * N + S.cx, far = Math.hypot(S.cx - C, S.cy - C), ux = (S.cx - C) / far, uy = (S.cy - C) / far;
  if (staged) {
    // A tunnel three cells wide from the core to three cells short of the collar, as the fuzz stages a start.
    const len = far - S.reach - 3, sx = Math.round(ux * len), sy = Math.round(uy * len);
    for (let s = 0; s <= len; s += 0.5) for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) w.setK((C + Math.round(uy * s) + v) * N + C + Math.round(ux * s) + u, K.EMPTY);
    d.x = C + sx + 0.5; d.y = C + sy + 0.5; d.mode = 'free';
    game.band = [[d.x, d.y], [HX, HY]];
    game.changed();
  }
  // The slab's own ground, as it stands before a cut.
  const own = [];
  for (let y = S.cy - S.p - 2; y <= S.cy + S.p + 2; y++) for (let x = S.cx - S.p - 2; x <= S.cx + S.p + 2; x++) if (w.slabCell(S, x, y) === 3) own.push(y * N + x);
  out.inside = own.length;
  const clock = { t: 0 }, keys = new Set(S.keys), update = game.update.bind(game);
  let took = 0;
  game.update = dt => { const t = performance.now(); update(dt); took = performance.now() - t; if (took > out.ms.worst) out.ms.worst = took; };
  let was = { sides: w.sides, followed: w.followed, made: w.made }, frame = 0, hauls = game.S.stats.hauls, aimed = -1, glow = 0;
  const each = () => {
    const now = { sides: w.sides, followed: w.followed, made: w.made }, cost = { sides: now.sides - was.sides, followed: now.followed - was.followed, made: now.made - was.made };
    was = now;
    for (const k of ['sides', 'followed', 'made']) if (cost[k] > out.work[k]) out.work[k] = cost[k];
    if (frame++ % 6 === 0) for (const f of tetherFaults(game)) if (out.faults.length < 8) out.faults.push(`${clock.t.toFixed(1)} s: ${f}`);
    // The glow of the cut in hand, as it stood the frame before the cut was made.
    if (d.dig >= 0 && game.preview?.length) { aimed = game.preview[0].i; glow = game.preview[0].cells.length; }
    if (!out.loose) {
      const piece = game.pieceOf.get(mid);
      if (piece && piece.length >= own.length * 0.9) { out.loose = { cells: piece.length, ...cost }; out.glow = keys.has(aimed) ? glow : 0; out.ms.loose = took; }
    }
    if (game.S.stats.hauls !== hauls) {
      hauls = game.S.stats.hauls;
      // (Where the lap was flown before the last key was cut, the slab is loose and hauled in the one frame.)
      if (w.k(mid) === K.EMPTY && !out.hauled) { const h = game.hauled; if (!out.loose) { out.loose = { cells: h.n, ...cost }; out.glow = keys.has(aimed) ? glow : 0; out.ms.loose = took; } out.hauled = { title: h.title, n: h.n, mult: h.mult, over: h.over, grit: h.grit, gems: h.gems.reduce((a, b) => a + b, 0), light: h.light, banner: game.banner === h }; return true; }
    }
    return false;
  };
  // Flies a way: to each of its turns, and to every cell that has to be cut on the way. (Within four cells of the
  // core the drill is drawn in to the middle when it heads that way, and a stroke out from the middle is what
  // leaves: so the first place steered for is the way's first cell four cells out, wherever its turns are.)
  const follow = path => {
    let out4 = false;
    for (let n = 1; n < path.length; n++) {
      const [x, y] = path[n], turn = n === path.length - 1 || path[n + 1][0] - x !== x - path[n - 1][0] || path[n + 1][1] - y !== y - path[n - 1][1];
      const near = Math.hypot(x - C, y - C) < 4;
      if (near && n < path.length - 1) continue;
      if (!near && !out4) out4 = true;
      else if (!turn && w.k(y * N + x) === K.EMPTY) continue;
      if (!fly(game, x, y, clock, each, 1800) && out.hauled) return false;
    }
    return true;
  };
  // To the crack: the nearest open cell of it, by the quickest way.
  const box = [Math.min(C, S.cx) - 30, Math.min(C, S.cy) - 30, Math.max(C, S.cx) + 30, Math.max(C, S.cy) + 30];
  const crack = (x, y) => w.slabCell(S, x, y) === 1 && w.k(y * N + x) === K.EMPTY;
  const there = route(game, Math.floor(d.x), Math.floor(d.y), crack, ...box);
  if (!there) return out;
  follow(there);
  const [ex, ey] = there[there.length - 1];
  out.reached = Math.floor(d.x) === ex && Math.floor(d.y) === ey; out.reachT = clock.t;
  if (!out.reached) return out;
  // The lap, cutting each key where the way goes through it.
  const before = S.keys.filter(i => w.k(i) === K.KEY).length, round = lap(game, S, ex, ey);
  if (round) follow(round);
  // (The game asks ten times a second what the tether is round.)
  for (let f = 0; f < 30 && !out.hauled; f++) { game.update(1 / 60); clock.t += 1 / 60; each(); }
  out.lapT = clock.t - out.reachT;
  out.keys = before - S.keys.filter(i => w.k(i) === K.KEY).length;
  out.left = own.filter(i => w.k(i) !== K.EMPTY).length;
  out.grit = game.S.grit; out.gems = game.S.gems.reduce((a, b) => a + b, 0);
  out.game = game;
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (name, fallback) => { const n = process.argv.indexOf(`--${name}`); return n < 0 ? fallback : process.argv[n + 1]; };
  const lv = {};
  if (arg('tether') !== undefined) lv.tether = Number(arg('tether'));
  if (arg('winch') !== undefined) lv.winch = Number(arg('winch'));
  const r = await play(Number(arg('seed', 7)), Number(arg('slab', 0)), lv, process.argv.includes('--staged')), S = r.slab;
  console.log(`seed ${arg('seed', 7)}: the slab at ${S.cx - C},${S.cy - C} (${Math.round(Math.hypot(S.cx - C, S.cy - C))} out), radius ${S.p}, ${S.ux.length} keys, ${r.inside} cells; reach ${UPGRADES[0].values[r.levels.tether]}, bit ${r.levels.drill}, winch ${r.levels.winch}, ram ${r.levels.momentum}`);
  console.log(r.reached ? `  came to the crack in ${r.reachT.toFixed(1)} s` : '  never came to the crack');
  if (r.loose) console.log(`  the last key cut: ${r.loose.cells} cells loose in that frame (the glow held ${r.glow}); it walked ${r.loose.sides} sides, followed ${r.loose.followed} cells and made ${r.loose.made} pieces of world, in ${r.ms.loose.toFixed(1)} ms`);
  console.log(r.hauled ? `  hauled ${r.lapT.toFixed(1)} s after coming to the crack, ${r.keys} cells of key cut: ${r.hauled.title} ${r.hauled.n} x${r.hauled.mult.toFixed(2)}${r.hauled.over < 1 ? ' WINCH OVER LOAD' : ''}, +${r.hauled.grit} grit +${r.hauled.gems} gems; ${r.left} cells of the slab left standing`
    : `  not hauled: ${r.keys} cells of key cut, ${r.left} cells of the slab standing`);
  console.log(`  the most work in one frame: ${r.work.sides} sides walked, ${r.work.followed} cells followed, ${r.work.made} pieces of world made; the longest frame ${r.ms.worst.toFixed(1)} ms; tether faults: ${r.faults.length ? r.faults.join('; ') : 'none'}`);
}
