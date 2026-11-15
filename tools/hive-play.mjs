// An amber hive played with no hand on it and no browser (docs/CONTENT-PLAN.md, content item 6): the drill flies
// into a chamber that holds a nugget, through a door or through the wax, flies the lane against the chamber's walls
// once round, biting through the stalk as it comes to it, and the nugget is reeled in when the tether is round it.
// Then the next chamber. What it took and what it paid is printed.
//   node tools/hive-play.mjs [--seed 7] [--hive n] [--nuggets n] [--tether level]
//
//   --seed n      the world (7)
//   --hive n      which of the world's hives, counted from the nearest the core (0, the default; `node
//                 tools/zone-budget.mjs --where <seed>` lists a world's pockets in that order)
//   --nuggets n   how many nuggets to bring home at the most (all the hive has)
//   --tether n    the level of reach; if not given, the first that goes round the hive. With it go the levels of
//                 bit, winch and ram a player holds by then (tools/slab-play.mjs: `holds`).
//
// The drill starts at the end of a tunnel staged from the core to just outside the hive, as the fuzz stages a
// start. The pilot flies from cell to cell by the cheapest way (open ground flown, wax cut, rock cut at more, a
// nugget or a stalk in its way never), and slows for every turn: slower than a thumb, and no cleverer.
//
// `play` returns what happened; test/regress/c6-hive-play.mjs holds the first hive of the west to it, and
// tools/zone-budget.mjs takes from it how long a nugget takes.
import { fileURLToPath } from 'node:url';
import { makeGame, random, tetherFaults, UPGRADES, income, C, N, K, world } from '../test/harness.mjs';
import { fly } from './sift.mjs';
import { holds } from './slab-play.mjs';

const { hiveChambers, rowOf } = world, HX = C + 0.5, HY = C + 0.5;

// A world's hives, the nearest the core first.
export const hivesOf = (w, far = 2300) => w.pocketsWithin(far).filter(Z => rowOf(Z.row).pocket.shape === 'hive');
// The cheapest way from cell (sx, sy) to a cell `goal` says yes to, as a list of cells, or null: side to side
// only, through open ground at 1 a cell, wax at 2, any other ground at 6, and never through a pocket's mineral or
// its stalk, or anything loose.
function route(game, sx, sy, goal, x0, y0, x1, y1) {
  const w = game.world, wide = x1 - x0 + 1, cost = new Map(), from = new Map(), start = (sy - y0) * wide + sx - x0;
  let edge = [start];
  cost.set(start, 0);
  const price = i => { const k = w.k(i); return k === K.EMPTY ? 1 : k === K.MINERAL || k === K.NODE || game.pieceOf.has(i) ? Infinity : w.row(i).pocket ? 2 : 6; };
  // (Costs are small whole numbers: the cells are taken in the order of their cost a bucket at a time.)
  for (let c = 0, live = 1; live > 0; c++) {
    const next = [];
    live = 0;
    for (const s of edge) {
      const at = cost.get(s);
      if (at > c) { next.push(s); live++; continue; }
      if (at < c) continue;
      const x = x0 + s % wide, y = y0 + Math.floor(s / wide);
      if (goal(x, y)) { const path = []; for (let q = s; q !== undefined; q = from.get(q)) path.unshift([x0 + q % wide, y0 + Math.floor(q / wide)]); return path; }
      for (const [u, v] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const qx = x + u, qy = y + v;
        if (qx < x0 || qy < y0 || qx > x1 || qy > y1) continue;
        const q = (qy - y0) * wide + qx - x0, to = at + price(qy * N + qx);
        if (to < (cost.get(q) ?? Infinity)) { cost.set(q, to); from.set(q, s); next.push(q); live++; }
      }
    }
    edge = next;
  }
  return null;
}

// Plays hive number `pick` of world `seed`. Returns
//   { hive, levels, chambers (how many it has), nuggets (how many of them hold a nugget), amber (cells of amber in
//     it), took: [{ at: [x, y], n, paid (what the nugget's own haul paid), grit (all that was banked since setting
//     out for it: scraps of wax reeled in on the way too), spec, t (seconds from setting out for the chamber to
//     the haul), lap (seconds of that inside the chamber), light }], grit, spec (specimens banked, by direction), crushed (cells
//     of amber cut by the drill), t (seconds in all), rate (grit a second while at it, over the model's income
//     there), faults, game }
export async function play(seed = 7, pick = 0, most = Infinity, lv = {}) {
  Math.random = random(seed + 5);
  const probe = new world.World(); probe.reset(seed);
  const at = hivesOf(probe)[pick], out0 = Math.hypot(at.cx - C, at.cy - C);
  const level = lv.tether ?? UPGRADES[0].values.findIndex(R => R >= out0 + at.reach + 2), levels = { ...holds(level), ...lv };
  const game = await makeGame(seed, levels), w = game.world, d = game.drill, Z = hivesOf(w)[pick];
  const ux = (Z.cx - C) / out0, uy = (Z.cy - C) / out0, len = out0 - Z.reach - 3, sx = C + Math.round(ux * len), sy = C + Math.round(uy * len);
  for (let s = 0; s <= len; s += 0.5) for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) w.setK((C + Math.round(uy * s) + v) * N + C + Math.round(ux * s) + u, K.EMPTY);
  d.x = sx + 0.5; d.y = sy + 0.5; d.mode = 'free';
  game.band = [[d.x, d.y], [HX, HY]];
  game.changed();
  const chambers = hiveChambers(Z), held = chambers.filter(([mx, my]) => w.k(my * N + mx) === K.MINERAL);
  let amber = 0;
  for (let y = Z.cy - 40; y <= Z.cy + 40; y++) for (let x = Z.cx - 40; x <= Z.cx + 40; x++) if (w.b(y * N + x) === Z.row && w.k(y * N + x) === K.MINERAL) amber++;
  const out = { hive: Z, levels, chambers: chambers.length, nuggets: held.length, amber, took: [], grit: 0, spec: [0, 0, 0, 0, 0], crushed: 0, t: 0, rate: 0, faults: [], game };
  const clock = { t: 0 }, box = [Z.cx - 46, Z.cy - 46, Z.cx + 46, Z.cy + 46];
  let frame = 0, hauls = game.S.stats.hauls, hauled = null, target = -1;
  const finish = game.finishDig.bind(game);
  game.finishDig = i => { if (w.k(i) === K.MINERAL) out.crushed++; finish(i); };
  const each = () => {
    if (frame++ % 6 === 0) for (const f of tetherFaults(game)) if (out.faults.length < 8) out.faults.push(`${clock.t.toFixed(1)} s: ${f}`);
    if (game.S.stats.hauls === hauls) return false;
    hauls = game.S.stats.hauls;
    // (A scrap of wax cut loose on the way and reeled in is a haul too: the one waited for is the nugget's.)
    if (w.k(target) !== K.EMPTY) return false;
    hauled = game.hauled;
    return true;
  };
  const follow = path => {
    for (let n = 1; n < path.length; n++) {
      const [x, y] = path[n], turn = n === path.length - 1 || path[n + 1][0] - x !== x - path[n - 1][0] || path[n + 1][1] - y !== y - path[n - 1][1];
      if (!turn && w.k(y * N + x) === K.EMPTY) continue;
      if (!fly(game, x, y, clock, each, 900) && hauled) return false;
    }
    return true;
  };
  const left = () => held.filter(([mx, my]) => w.k(my * N + mx) === K.MINERAL).sort((a, b) => Math.hypot(a[0] + 0.5 - d.x, a[1] + 0.5 - d.y) - Math.hypot(b[0] + 0.5 - d.x, b[1] + 0.5 - d.y));
  for (let todo = left(); todo.length && out.took.length < most; todo = left()) {
    const [mx, my] = todo[0], began = clock.t, grit = game.S.grit, spec = game.S.spec[Z.kin];
    hauled = null; target = my * N + mx;
    // Into the lane against the chamber's walls, by the cheapest way.
    const lane = (x, y) => Math.max(Math.abs(x - mx), Math.abs(y - my)) === 3 && w.k(y * N + x) === K.EMPTY;
    const there = route(game, Math.floor(d.x), Math.floor(d.y), lane, ...box);
    if (!there) break;
    follow(there);
    const inAt = clock.t;
    // Once round the lane and half as far again, the way that turns away from where the drill came in: through
    // the stalk's far cell on the way.
    const ring = [];
    for (let u = -3; u < 3; u++) ring.push([mx + u, my - 3]);
    for (let v = -3; v < 3; v++) ring.push([mx + 3, my + v]);
    for (let u = 3; u > -3; u--) ring.push([mx + u, my + 3]);
    for (let v = 3; v > -3; v--) ring.push([mx - 3, my + v]);
    const [ex, ey] = there[there.length - 1], from = ring.findIndex(([x, y]) => x === ex && y === ey), lap = [];
    for (let n = 0; n <= 36; n++) lap.push(ring[(from + n) % 24]);
    if (!hauled) follow(lap);
    // (The game asks ten times a second what the tether is round.)
    for (let f = 0; f < 30 && !hauled; f++) { game.update(1 / 60); clock.t += 1 / 60; each(); }
    if (!hauled) { out.stuck = [mx - C, my - C]; break; }
    out.took.push({ at: [mx - C, my - C], n: hauled.n, paid: hauled.grit, grit: game.S.grit - grit, spec: game.S.spec[Z.kin] - spec, t: clock.t - began, lap: clock.t - inAt, light: hauled.light });
  }
  out.t = clock.t; out.grit = game.S.grit; out.spec = [...game.S.spec];
  out.rate = out.t ? out.grit / out.t / income(out0) : 0;
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (name, fallback) => { const n = process.argv.indexOf(`--${name}`); return n < 0 ? fallback : process.argv[n + 1]; };
  const lv = arg('tether') === undefined ? {} : { tether: Number(arg('tether')) };
  const r = await play(Number(arg('seed', 7)), Number(arg('hive', 0)), Number(arg('nuggets', Infinity)), lv), Z = r.hive;
  console.log(`seed ${arg('seed', 7)}: the hive at ${Z.cx - C},${Z.cy - C} (${Math.round(Math.hypot(Z.cx - C, Z.cy - C))} out), radius ${Z.rho.toFixed(1)}${Z.herald ? ', a herald' : ''}: ${r.chambers} chambers, ${r.nuggets} nuggets, ${r.amber} cells of amber; reach ${UPGRADES[0].values[r.levels.tether]}, bit ${r.levels.drill}, ram ${r.levels.momentum}`);
  for (const n of r.took) console.log(`  the nugget at ${n.at}: home ${n.t.toFixed(1)} s after setting out for it, ${n.lap.toFixed(1)} s of that in its chamber; ${n.n} cells${n.light ? ', a light haul' : ''}, +${n.grit} grit, +${n.spec} specimens`);
  if (r.stuck) console.log(`  the nugget at ${r.stuck} was not brought home`);
  console.log(`  ${r.took.length} nuggets in ${r.t.toFixed(1)} s: ${r.grit} grit, ${r.rate.toFixed(2)} times the model's income there; specimens ${JSON.stringify(r.spec)}; ${r.crushed} cells of amber crushed; tether faults: ${r.faults.length ? r.faults.join('; ') : 'none'}`);
}
