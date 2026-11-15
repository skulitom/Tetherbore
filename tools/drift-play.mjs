// A pumice drift played with no hand on it and no browser (docs/CONTENT-PLAN.md, content item 7): the drill comes
// into the cavern at the end of a tunnel, flies once round each boulder as a thumb's circle would, two cells clear of
// it, and the boulder is reeled in when the tether is round it; then the nearest boulder left. What it took, what
// each haul paid and how the chain of hauls ran is printed. And the rubble of a whole drift on its way home at
// once, counted (`--burst`).
//   node tools/drift-play.mjs [--seed 7] [--drift n] [--boulders n] [--tether level] [--burst seconds]
//
//   --seed n       the world (7)
//   --drift n      which of the world's drifts, counted from the nearest the core (0, the default; `node
//                  tools/zone-budget.mjs --where <seed>` lists a world's pockets in that order)
//   --boulders n   how many boulders to bring home at the most (all the drift has)
//   --tether n     the level of reach; if not given, the first that goes round the drift. With it go the levels of
//                  bit, winch and ram a player holds by then (tools/slab-play.mjs: `holds`).
//   --burst s      play nothing: every boulder of the drift is hauled as a loop round it would haul it, one every
//                  `s` seconds (0.3: a drift's worth within a few seconds, quicker than any thumb), and the frames
//                  until the last of the rubble is home are counted: how many hauls and bits of rubble were on
//                  their way at once, how many moves of a bit a frame took, and how long the frames were
//
// The pilot flies from cell to cell through open ground only, down the middle of the lanes, and slows for every
// turn: slower than a thumb, and no cleverer. It means to cut nothing: in a drift there is nothing to cut, and a
// drill pushed into a boulder bites a cell out of it (`crushed` counts those).
//
// `play` and `burst` return what happened; test/regress/c7-drift-play.mjs and c7-drift-rubble.mjs hold drifts of
// world 7 to it.
import { fileURLToPath } from 'node:url';
import { makeGame, random, tetherFaults, UPGRADES, income, C, N, K, world } from '../test/harness.mjs';
import { holds } from './slab-play.mjs';

const { rowOf } = world, HX = C + 0.5, HY = C + 0.5;

// Flies the drill to the middle of cell (x, y), `frames` frames at the most, slowing as it comes up to it so that it
// is there, and all but still, before it turns: flown at full tilt to a corner it would coast on a cell past it,
// into whatever stands there. Returns whether it came there; `each`, called after every frame, may end the flight
// by returning true.
function fly(game, x, y, clock, each, frames = 600) {
  const d = game.drill, tx = x + 0.5, ty = y + 0.5;
  for (let f = 0; f < frames; f++) {
    const dx = tx - d.x, dy = ty - d.y, far = Math.hypot(dx, dy);
    if (far < 0.2 && Math.hypot(d.vx, d.vy) < 5 && d.mode === 'free') { game.input.auto = null; return true; }
    game.input.auto = [dx / (far || 1), dy / (far || 1), Math.max(0.12, Math.min(1, far / 3))];
    game.update(1 / 60); clock.t += 1 / 60;
    if (each && each()) { game.input.auto = null; return false; }
  }
  game.input.auto = null;
  return false;
}
// A world's drifts, the nearest the core first.
export const driftsOf = (w, far = 2300) => w.pocketsWithin(far).filter(Z => rowOf(Z.row).pocket.twist === 'drift');
// The boulders that stand in a drift, asked of the world's own cells: each piece of the drift's ground, joined side
// to side, as { cells, box: [x0, y0, x1, y1], minerals, at: [x, y] (its middle) }, the nearest the drift's middle first.
export function bouldersOf(w, Z) {
  const most = Math.ceil(Z.reach), seen = new Set(), found = [];
  for (let y = Z.cy - most; y <= Z.cy + most; y++) for (let x = Z.cx - most; x <= Z.cx + most; x++) {
    const i = y * N + x;
    if (seen.has(i) || w.b(i) !== Z.row || w.k(i) === K.EMPTY) continue;
    const cells = [i], box = [x, y, x, y];
    seen.add(i);
    for (const c of cells) for (const s of [1, N, -1, -N]) { const j = c + s; if (!seen.has(j) && w.b(j) === Z.row && w.k(j) !== K.EMPTY) { seen.add(j); cells.push(j); } }
    let minerals = 0, mx = 0, my = 0;
    for (const c of cells) {
      const cx = c % N, cy = Math.floor(c / N);
      if (cx < box[0]) box[0] = cx; if (cy < box[1]) box[1] = cy; if (cx > box[2]) box[2] = cx; if (cy > box[3]) box[3] = cy;
      mx += cx / cells.length; my += cy / cells.length;
      if (w.k(c) === Z.mineral) minerals++;
    }
    found.push({ cells, box, minerals, at: [mx, my] });
  }
  return found.sort((a, b) => Math.hypot(a.at[0] - Z.cx, a.at[1] - Z.cy) - Math.hypot(b.at[0] - Z.cx, b.at[1] - Z.cy));
}
// A game with the drill just inside drift number `pick` of world `seed`, at the end of a tunnel three cells wide
// from the core, as the fuzz stages a start: { game, Z, levels, out (how far out the drift's middle lies) }. The
// tunnel comes a cell and a half into the cavern, where no boulder stands (each keeps two cells from the wall).
export async function stage(seed = 7, pick = 0, lv = {}) {
  const probe = new world.World(); probe.reset(seed);
  const at = driftsOf(probe)[pick], out = Math.hypot(at.cx - C, at.cy - C);
  const level = lv.tether ?? UPGRADES[0].values.findIndex(R => R >= out + at.reach + 2), levels = { ...holds(level), ...lv };
  const game = await makeGame(seed, levels), w = game.world, d = game.drill, Z = driftsOf(w)[pick];
  const ux = (Z.cx - C) / out, uy = (Z.cy - C) / out, len = out - Z.rho + 1.5;
  for (let s = 0; s <= len; s += 0.5) for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) {
    const i = (C + Math.round(uy * s) + v) * N + C + Math.round(ux * s) + u;
    if (w.b(i) !== Z.row) w.setK(i, K.EMPTY);
  }
  d.x = C + Math.round(ux * len) + 0.5; d.y = C + Math.round(uy * len) + 0.5; d.mode = 'free';
  game.band = [[d.x, d.y], [HX, HY]];
  game.changed();
  return { game, Z, levels, out };
}
// The shortest way through open ground from cell (sx, sy) to cell (tx, ty), side to side, as a list of cells, or
// null: no further than `most` cells from the drift's middle each way.
function route(w, Z, sx, sy, tx, ty, most) {
  const wide = 2 * most + 1, at = (x, y) => (y - Z.cy + most) * wide + x - Z.cx + most, from = new Map([[at(sx, sy), -1]]), list = [[sx, sy]];
  for (const [x, y] of list) {
    if (x === tx && y === ty) {
      const path = [];
      for (let q = at(x, y); q !== -1; q = from.get(q)) path.unshift([Z.cx - most + q % wide, Z.cy - most + Math.floor(q / wide)]);
      return path;
    }
    for (const [u, v] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const qx = x + u, qy = y + v;
      if (Math.abs(qx - Z.cx) > most || Math.abs(qy - Z.cy) > most || from.has(at(qx, qy)) || w.k(qy * N + qx) !== K.EMPTY) continue;
      from.set(at(qx, qy), at(x, y)); list.push([qx, qy]);
    }
  }
  return null;
}

// Plays drift number `pick` of world `seed`. Returns
//   { drift, levels, boulders (how many it has), aerolite (cells of its mineral), took: [{ at: [x, y], n, minerals,
//     paid, chain (what the lump was multiplied by), spec, t (seconds since the haul before, or since coming in),
//     light }] (every haul made: a scrap of the rock round the drift may come home too, by itself or with a
//     boulder), home (cells of aerolite brought home), grit, spec (specimens banked, by direction), cut (cells the
//     drill cut: none, if it flies well), crushed (cells of aerolite among them), t (seconds in all), rate (grit a
//     second while at it, over the model's income there), books (how many of the drift's pieces the game knew as
//     loose the frame it came in), left (boulders still standing), faults, game }
export async function play(seed = 7, pick = 0, most = Infinity, lv = {}) {
  Math.random = random(seed + 5);
  const { game, Z, levels, out: far } = await stage(seed, pick, lv), w = game.world, d = game.drill;
  const all = bouldersOf(w, Z);
  const out = { drift: Z, levels, boulders: all.length, aerolite: all.reduce((sum, b) => sum + b.minerals, 0), took: [], home: 0, grit: 0, spec: [0, 0, 0, 0, 0], cut: 0, crushed: 0, t: 0, rate: 0, books: 0, faults: [], game };
  const clock = { t: 0 }, wide = Math.ceil(Z.reach) + 3;
  let frame = 0, hauls = game.S.stats.hauls, hauled = null, last = 0;
  const finish = game.finishDig.bind(game);
  game.finishDig = i => { out.cut++; if (w.k(i) === Z.mineral && w.b(i) === Z.row) out.crushed++; finish(i); };
  const each = () => {
    if (frame++ % 6 === 0) for (const f of tetherFaults(game)) if (out.faults.length < 8) out.faults.push(`${clock.t.toFixed(1)} s: ${f}`);
    if (game.S.stats.hauls === hauls) return false;
    hauls = game.S.stats.hauls; hauled = game.hauled;
    return true;
  };
  // (One frame, and the drill is in: its place is the drift, and the boulders are in the books.)
  game.update(1 / 60); clock.t += 1 / 60;
  out.books = game.pieces.filter(cells => w.b(cells[0]) === Z.row).length;
  const follow = path => {
    // (From the middle of the cell it is in: a straight line from one side of a cell can clip the next corner.)
    for (let n = 0; n < path.length; n++) {
      const [x, y] = path[n], turn = n === 0 || n === path.length - 1 || path[n + 1][0] - x !== x - path[n - 1][0] || path[n + 1][1] - y !== y - path[n - 1][1];
      if (turn && !fly(game, x, y, clock, each, 600) && hauled) return false;
    }
    return true;
  };
  const left = () => bouldersOf(w, Z).sort((a, b) => Math.hypot(a.at[0] + 0.5 - d.x, a.at[1] + 0.5 - d.y) - Math.hypot(b.at[0] + 0.5 - d.x, b.at[1] + 0.5 - d.y));
  for (let todo = left(); todo.length && out.took.length < most; todo = left()) {
    const B = todo[0], [x0, y0, x1, y1] = B.box, spec = game.S.spec[Z.kin];
    hauled = null;
    // Round it two cells clear, down the middle of the lanes: the four corners of the box two cells out from its
    // own, begun at the one nearest the drill and gone round once and half as far again. (A corner that would
    // lie against the cavern's wall or in it is drawn in: a cell out, or the box's own.)
    const open = (x, y) => w.k(y * N + x) === K.EMPTY, roomy = (x, y) => { for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) if (!open(x + u, y + v)) return false; return true; };
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => {
      const bx = u < 0 ? x0 : x1, by = v < 0 ? y0 : y1;
      return roomy(bx + 2 * u, by + 2 * v) ? [bx + 2 * u, by + 2 * v] : open(bx + u, by + v) ? [bx + u, by + v] : [bx, by];
    });
    if (!corners.every(([x, y]) => open(x, y))) { out.stuck = [Math.round(B.at[0]) - C, Math.round(B.at[1]) - C]; break; }
    let first = 0;
    for (let n = 1; n < 4; n++) if (Math.hypot(corners[n][0] + 0.5 - d.x, corners[n][1] + 0.5 - d.y) < Math.hypot(corners[first][0] + 0.5 - d.x, corners[first][1] + 0.5 - d.y)) first = n;
    let [px, py] = [Math.floor(d.x), Math.floor(d.y)];
    for (let n = 0; n <= 6 && !hauled; n++) {
      const [tx, ty] = corners[(first + n) % 4], path = route(w, Z, px, py, tx, ty, wide);
      if (!path) break;
      follow(path);
      [px, py] = [Math.floor(d.x), Math.floor(d.y)];
    }
    // (The game asks ten times a second what the tether is round.)
    for (let f = 0; f < 30 && !hauled; f++) { game.update(1 / 60); clock.t += 1 / 60; each(); }
    if (!hauled) { out.stuck = [Math.round(B.at[0]) - C, Math.round(B.at[1]) - C]; break; }
    out.took.push({ at: [Math.round(B.at[0]) - C, Math.round(B.at[1]) - C], n: hauled.n, minerals: hauled.minerals, paid: hauled.grit, chain: hauled.chain, spec: game.S.spec[Z.kin] - spec, t: clock.t - last, light: hauled.light });
    out.home += hauled.minerals;
    last = clock.t;
  }
  out.left = bouldersOf(w, Z).length;
  out.t = clock.t; out.grit = game.S.grit; out.spec = [...game.S.spec];
  out.rate = out.t ? out.grit / out.t / income(far) : 0;
  return out;
}

// Every boulder of drift number `pick` of world `seed` hauled as a loop round it would haul it, one every `gap`
// seconds, the nearest the drill first, with the drill standing where it came in; then the game runs until the
// last of the rubble is home. Returns
//   { drift, boulders, cells (hauled in all), frames, hauls (the most on their way at once), bits (the most bits of
//     rubble not yet home at once), made (bits made in all), moves (the most moves of a bit in one frame: a bit is
//     moved once for each small step the frame takes), meanMs, worstMs (how long game.update took: the machine's
//     own, to be read beside test/frame-time.mjs), over16 (frames over 16 ms), fine (how many hauls broke fine,
//     sixteen bits to a cell), game }
export async function burst(seed = 7, pick = 0, gap = 0.3, lv = {}) {
  Math.random = random(seed + 5);
  const { game, Z } = await stage(seed, pick, lv), w = game.world;
  game.update(1 / 60);
  const todo = bouldersOf(w, Z).sort((a, b) => Math.hypot(a.at[0] - game.drill.x, a.at[1] - game.drill.y) - Math.hypot(b.at[0] - game.drill.x, b.at[1] - game.drill.y));
  const out = { drift: Z, boulders: todo.length, cells: 0, frames: 0, hauls: 0, bits: 0, made: 0, moves: 0, meanMs: 0, worstMs: 0, over16: 0, fine: 0, game };
  let next = 0, total = 0;
  const seen = new Set();
  for (let f = 0; f < 60 * 120; f++) {
    if (todo.length && f / 60 >= next) {
      const B = todo.shift(), piece = game.pieceOf.get(B.cells[0]) ?? B.cells;
      out.cells += piece.length;
      const cells = piece.slice();
      game.haul(cells); game.changed(cells);
      next += gap;
    }
    const began = performance.now();
    game.update(1 / 60);
    const ms = performance.now() - began;
    total += ms; out.frames++;
    if (ms > out.worstMs) out.worstMs = ms;
    if (ms > 16) out.over16++;
    // What is on its way: hauls not yet home, and their bits. A frame moves each such bit once for every small
    // step it takes (`updateHauls`: one to four, by how fast the rope is drawing).
    let hauls = 0, bits = 0, moves = 0;
    for (const h of game.hauls) {
      if (!seen.has(h)) { seen.add(h); out.made += h.total; if (h.size === 4) out.fine++; }
      if (h.doneAt !== undefined) continue;
      hauls++;
      const live = h.bits.reduce((sum, b) => sum + (b.st ? 0 : 1), 0), steps = h.v > 330 ? 1 : Math.max(1, Math.min(4, Math.ceil((h.v * 1.5 + 80) / 60 / 3)));
      bits += live; moves += live * steps;
    }
    if (hauls > out.hauls) out.hauls = hauls;
    if (bits > out.bits) out.bits = bits;
    if (moves > out.moves) out.moves = moves;
    if (!todo.length && !game.hauls.length) break;
  }
  out.meanMs = total / out.frames;
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (name, fallback) => { const n = process.argv.indexOf(`--${name}`); return n < 0 ? fallback : process.argv[n + 1]; };
  const lv = arg('tether') === undefined ? {} : { tether: Number(arg('tether')) }, seed = Number(arg('seed', 7)), pick = Number(arg('drift', 0));
  if (arg('burst') !== undefined) {
    const r = await burst(seed, pick, Number(arg('burst')) || 0.3, lv), Z = r.drift;
    console.log(`seed ${seed}: the drift at ${Z.cx - C},${Z.cy - C} (${Math.round(Math.hypot(Z.cx - C, Z.cy - C))} out), radius ${Z.rho.toFixed(1)}: ${r.boulders} boulders, ${r.cells} cells, hauled one every ${Number(arg('burst')) || 0.3} s`);
    console.log(`  ${r.frames} frames until the last bit was home: at the most ${r.hauls} hauls and ${r.bits} bits of rubble on their way at once (${r.made} bits made in all, ${r.fine} haul${r.fine === 1 ? '' : 's'} broken fine), ${r.moves} moves of a bit in a frame; game.update took ${r.meanMs.toFixed(2)} ms in the mean, ${r.worstMs.toFixed(1)} at the worst, ${r.over16} frames over 16 ms`);
  } else {
    const r = await play(seed, pick, Number(arg('boulders', Infinity)), lv), Z = r.drift;
    console.log(`seed ${seed}: the drift at ${Z.cx - C},${Z.cy - C} (${Math.round(Math.hypot(Z.cx - C, Z.cy - C))} out), radius ${Z.rho.toFixed(1)}${Z.herald ? ', a herald' : ''}: ${r.boulders} boulders, ${r.aerolite} cells of aerolite, ${r.books} loose pieces in the books on coming in; reach ${UPGRADES[0].values[r.levels.tether]}, bit ${r.levels.drill}, ram ${r.levels.momentum}`);
    for (const n of r.took) console.log(`  a haul at ${n.at}: home ${n.t.toFixed(1)} s after the one before; ${n.n} cells, ${n.minerals} of aerolite${n.light ? ', a light haul' : ''}${n.chain ? `, lump x${n.chain.toFixed(1)}` : ''}, +${n.paid} grit, +${n.spec.toFixed(1)} specimens`);
    if (r.stuck) console.log(`  the boulder at ${r.stuck} was not brought home`);
    console.log(`  ${r.home} of ${r.aerolite} cells of aerolite home in ${r.took.length} hauls and ${r.t.toFixed(1)} s, ${r.left} boulders left: ${r.grit} grit, ${r.rate.toFixed(2)} times the model's income there; specimens ${JSON.stringify(r.spec.map(s => +s.toFixed(1)))}; ${r.cut} cells cut by the drill, ${r.crushed} of them aerolite; tether faults: ${r.faults.length ? r.faults.join('; ') : 'none'}`);
  }
}
