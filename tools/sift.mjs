// What a charge of the bomb is worth, played with no browser: at each level of BLAST and in each direction, what one
// charge brings home, and what a loop cut round the same spot brings home in the same time. This is what the bomb's
// figures (js/game.js: `SIFT`) are judged by (docs/CONTENT-PLAN.md, content item 4).
//   node tools/sift.mjs [--seeds 7,11,13] [--spots 4] [--level n] [--radius a,b,c,d] [--shake n] [--room n] [--aim n] [--planned] [--each]
//
//   --seeds a,b,c    the worlds played in; --spots n: how many spots in each direction of each world
//   --level n        that level of BLAST only
//   --radius, --shake, --room   other figures for `SIFT`, to see what they would bring
//   --aim n          how far from its spot a charge may be aimed, in cells (5; 0: the spot itself, wherever there is rock)
//   --planned        the rule as it was first planned: a plain disc, dense rock left standing, nothing taken past
//                    the disc's edge
//   --each           a line for every charge
//
// A spot is a cell between half and nearly all of the tether's reach out, with the upgrades a player has when that
// level of BLAST comes within reach of their purse (`has`). A player sets a charge where they see ore, so the charge
// is aimed: of the cells within five of the spot, at the one whose disc holds the most worth having (`aim`). The
// same place is then played twice or more, each time in a world made afresh, from the end of a tunnel staged from
// the core:
//   the charge   the drill cuts the last eight cells to the place itself and sets the charge off; then the lumps it
//                shook loose are flown round, by the quickest way round them there is (`way`), until none is left.
//                The time is from the charge until the last of them is hauled.
//   the loop     a square ring cut round a block of ground with the same place in its middle, as a player cuts
//                one, and closed. The biggest block is taken whose ring is cut and closed in no more time than
//                the charge took (so a charge that shook nothing loose is set against no loop at all).
// What is paid is what the game banks for it, grit and gems (whatever else the flight happens to wind is hauled and
// counted too, for the charge and the loop alike). The pilot flies from cell to cell and slows for every
// turn, which is slower than a thumb; it is the same pilot for both, and a room has more turns in it than a ring,
// so the comparison leans a little toward the loop.
//
// `close` counts the charges whose lumps could only be flown round through a lane one cell wide past a loose lump:
// the drill is 0.68 of a cell wide and cuts whatever it is pushed into, so there a thumb that strays a sixth of a
// cell cuts into what it came for.
import { makeGame, random, UPGRADES, C, N, K, world } from '../test/harness.mjs';

const { SIFT } = await import('../js/game.js');
const { World, HARD, digTime } = world, HX = C + 0.5, HY = C + 0.5;
const DIRS = [['north', 0, -1], ['south', 0, 1], ['west', -1, 0], ['east', 1, 0]];
const SPEED = [1, 1.6, 2.4, 3.6, 5], FLY = 9, RUN = 8;
export const PILOT = { aim: 5 };              // how far from a spot the charge may be aimed, in cells
const plain = k => k === K.SOFT || k === K.DENSE || k === K.ICE || k === K.BASALT || k === K.GLASS || k === K.FAULT;

// What a player holds when level `L` of BLAST is theirs to buy: the level of reach its price lies beside, and every
// level of bit, winch and ram priced below that.
export function has(L) {
  const bombs = UPGRADES.find(u => u.id === 'bombs'), at = Math.round(bombs.beside[L - 1]), lv = { tether: at, bombs: L };
  for (const id of ['drill', 'winch', 'momentum']) lv[id] = UPGRADES.find(u => u.id === id).beside.filter(b => b <= at).length;
  return lv;
}
export const reach = L => UPGRADES[0].values[has(L).tether];
// A game with the drill at (sx, sy) from the core, at the end of a tunnel three cells wide (as the fuzz stages a start).
export async function stage(seed, L, sx, sy) {
  Math.random = random(seed + 5);
  const game = await makeGame(seed, has(L)), w = game.world, d = game.drill, len = Math.hypot(sx, sy);
  for (let s = 0; s <= len; s += 0.5) for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) w.setK((C + Math.round(sy * s / len) + v) * N + C + Math.round(sx * s / len) + u, K.EMPTY);
  d.x = C + sx + 0.5; d.y = C + sy + 0.5; d.mode = 'free';
  game.band = [[d.x, d.y], [HX, HY]];
  game.bombs = game.val('bombs');
  game.changed();
  return game;
}
// Where a player would set the charge: the cell within `PILOT.aim` of (sx, sy) whose disc holds the most worth having, in
// the ground as the seed laid it. Rich ore counts most, then hazards asleep and plain ore; slate and slag hardly.
// Null where there is no rock to set it in (a great cavern).
export function aim(seed, L, sx, sy) {
  const w = new World(), r = SIFT.radius[L], most = Math.ceil(r), R = reach(L);
  w.reset(seed);
  const worth = k => k === K.ORE_B ? 10 : k === K.ORE_A ? 3 : k === K.HAZARD || k === K.HAZARD2 ? 4 : k === K.CACHE ? 30 : k === K.EMPTY || plain(k) || HARD[k] >= 99 ? 0 : 0.5;
  let best = null, top = -1;
  for (let dy = -PILOT.aim; dy <= PILOT.aim; dy++) for (let dx = -PILOT.aim; dx <= PILOT.aim; dx++) {
    const x = sx + dx, y = sy + dy;
    if (Math.hypot(x, y) > R - 1 || Math.hypot(x, y) < RUN + 4 || !plain(w.k((C + y) * N + C + x))) continue;
    let sum = 0;
    for (let v = -most; v <= most; v++) for (let u = -most; u <= most; u++) if (u * u + v * v <= r * r) sum += worth(w.k((C + y + v) * N + C + x + u));
    if (sum > top) { top = sum; best = [x, y]; }
  }
  return best;
}
// Steers to the middle of cell (x, y), slowing as it comes. `each` is called after every frame and stops the flight
// by returning true. Returns whether it got there. (tools/slab-play.mjs flies by it too.)
export function fly(game, x, y, clock, each, frames = 300) {
  const d = game.drill, w = game.world, tx = x + 0.5, ty = y + 0.5;
  // Where there is open ground all round, near enough is there.
  let roomy = true;
  for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) if (w.k((y + v) * N + x + u) !== K.EMPTY) roomy = false;
  for (let f = 0; f < frames; f++) {
    const dx = tx - d.x, dy = ty - d.y, far = Math.hypot(dx, dy);
    if (far < (roomy ? 0.3 : 0.15) && d.mode === 'free') { game.input.auto = null; return true; }
    game.input.auto = [dx / (far || 1), dy / (far || 1), far > 1.2 ? 1 : Math.max(roomy ? 0.6 : 0.3, far / 1.2)];
    game.update(1 / 60); clock.t += 1 / 60;
    if (each && each()) { game.input.auto = null; return false; }
  }
  game.input.auto = null;
  return false;
}
const banked = game => ({ grit: game.S.grit, gems: game.S.gems.reduce((a, b) => a + b, 0), hauls: game.S.stats.hauls });

// The quickest way from cell (sx, sy) to where the tether is right round every one of the loose lumps in `lumps`
// (three at the most), as a list of cells, or null. It flies through open ground (corner to corner only where both
// cells beside are open too) and cuts where it must: plain rock at what the cut costs in time, anything else that
// stands at four seconds more, never anything loose. A cell beside a loose lump costs a quarter of a second more, so
// it keeps a cell's width off them where it can.
//
// The tether is round a lump when the string as it lies, the way flown from here and the straight line home from
// its end go round it together (js/game.js: `reelIfRound`). That is counted by a line drawn east from inside one of
// the lump's cells, below its middle (the string lies along a cell's edges and the way through cells' middles, so
// neither ever runs along that line): each crossing of it counts one, down one way and up the other. And the line
// home must not run through the lump. `path.close` is how many of the way's cells are lanes one cell wide past a loose lump (`tight`).
function way(game, sx, sy, lumps, cx, cy, half) {
  const w = game.world, size = 2 * half + 1, x0 = cx - half, y0 = cy - half, speed = FLY * game.val('momentum'), bit = SPEED[game.S.lv.drill];
  const refs = lumps.map(cells => [cells[0] % N + 0.5, Math.floor(cells[0] / N) + 0.75]), turns = 5 ** lumps.length, mine = new Set(lumps.flat());
  // How a straight stretch from (ax, ay) to (bx, by) crosses a lump's line.
  const cross = ([rx, ry], ax, ay, bx, by) => (ay <= ry) === (by <= ry) || ax + (bx - ax) * (ry - ay) / (by - ay) <= rx ? 0 : by > ay ? 1 : -1;
  // The string as it lies, from the core out to the drill.
  const lies = refs.map(ref => { let sum = 0; for (let n = game.band.length - 1; n > 0; n--) sum += cross(ref, game.band[n][0], game.band[n][1], game.band[n - 1][0], game.band[n - 1][1]); return sum; });
  const round = (x, y, wind) => {
    for (let n = 0, t = wind; n < refs.length; n++, t = Math.floor(t / 5)) if (lies[n] + t % 5 - 2 + cross(refs[n], x + 0.5, y + 0.5, HX, HY) === 0) return false;
    const far = Math.hypot(HX - x - 0.5, HY - y - 0.5), ux = (HX - x - 0.5) / far, uy = (HY - y - 0.5) / far;
    for (let s = 0; s < Math.min(far, 3 * half); s += 0.2) if (mine.has(Math.floor(y + 0.5 + uy * s) * N + Math.floor(x + 0.5 + ux * s))) return false;
    return true;
  };
  const still = (5 ** lumps.length - 1) / 2;                 // nothing flown yet: every count is nought
  const beside = (x, y) => { for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) if (game.pieceOf.has((y + v) * N + x + u)) return true; return false; };
  // A cell with a loose lump on one side of it and ground of any kind straight across on the other: a lane one cell wide.
  const tight = (x, y) => {
    for (const [u, v] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      const a = (y + v) * N + x + u, b = (y - v) * N + x - u;
      if (w.k(a) !== K.EMPTY && w.k(b) !== K.EMPTY && (game.pieceOf.has(a) || game.pieceOf.has(b))) return true;
    }
    return false;
  };
  const cost = new Map(), from = new Map(), heap = [], start = ((sy - y0) * size + sx - x0) * turns + still;
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
    const wind = s % turns, cell = (s - wind) / turns, x = x0 + cell % size, y = y0 + Math.floor(cell / size);
    if (round(x, y, wind)) {
      const path = [];
      for (let at = s; at !== undefined; at = from.get(at)) { const cl = (at - at % turns) / turns; path.unshift([x0 + cl % size, y0 + Math.floor(cl / size)]); }
      path.close = path.slice(1).filter(([px, py]) => tight(px, py)).length;
      return path;
    }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy, i = ny * N + nx;
      if (nx < x0 || ny < y0 || nx >= x0 + size || ny >= y0 + size || game.pieceOf.has(i) || !game.within(nx + 0.5, ny + 0.5)) continue;
      let step = (dx && dy ? 1.414 : 1) / speed;
      if (dx && dy) { if (!open(nx, ny) || !open(x + dx, y) || !open(x, y + dy)) continue; }
      else if (!open(nx, ny)) {
        const k = w.k(i);
        if (k === K.EMPTY || HARD[k] >= 99) continue;
        step += digTime(k, w.row(i)) / bit + (plain(k) ? 0 : 4);
      }
      if (beside(nx, ny)) step += 0.25;
      let to = wind, out = false;
      if (dy) for (let n = 0, unit = 1; n < refs.length; n++, unit *= 5) {
        const turn = cross(refs[n], x + 0.5, y + 0.5, nx + 0.5, ny + 0.5), now = Math.floor(wind / unit) % 5 + turn;
        if (now < 0 || now > 4) out = true; else to += turn * unit;
      }
      if (out) continue;
      const next = ((ny - y0) * size + nx - x0) * turns + to;
      if (c + step < (cost.get(next) ?? Infinity)) { cost.set(next, c + step); from.set(next, s); push(c + step, next); }
    }
  }
  return null;
}
// One charge at the place, and every lump it shook loose flown round. Returns what it opened and shook loose, what
// that is worth, what came home and how long that took.
export async function charge(seed, L, ax, ay) {
  const far = Math.hypot(ax, ay), game = await stage(seed, L, Math.round(ax - ax / far * RUN), Math.round(ay - ay / far * RUN));
  const w = game.world, d = game.drill, cx = C + ax, cy = C + ay, clock = { t: 0 };
  // The last stretch is cut by the drill itself. (A hazard woken on the way may hold it up: it goes on from where
  // it got to.)
  fly(game, cx, cy, clock, null, 900);
  const bx = Math.floor(d.x), by = Math.floor(d.y);
  const r = SIFT.radius[L], half = Math.ceil(r + SIFT.shake) + SIFT.room + 2, near = cells => cells.length <= 400 && Math.hypot(cells[0] % N - bx, Math.floor(cells[0] / N) - by) <= half - 1;
  const known = new Set(game.pieces), before = banked(game);
  const opened = game.sifts(bx, by).length;
  clock.t = 0;
  game.blast();
  const shaken = game.pieces.filter(cells => !known.has(cells) && near(cells)), loose = shaken.flat().length;
  const worth = loose ? game.payOf(shaken.flat()) : null, given = new Set();
  let last = 0, hauls = before.hauls, hit = false, close = 0;
  const each = () => { if (game.S.stats.hauls === hauls) return false; hauls = game.S.stats.hauls; last = clock.t; hit = true; return true; };
  while (clock.t < 30) {
    const here = [Math.floor(d.x), Math.floor(d.y)];
    if (Math.max(Math.abs(here[0] - bx), Math.abs(here[1] - by)) > half) break;
    const left = game.pieces.filter(cells => !known.has(cells) && !given.has(cells) && near(cells))
      .sort((a, b) => Math.hypot(a[0] % N - here[0], Math.floor(a[0] / N) - here[1]) - Math.hypot(b[0] % N - here[0], Math.floor(b[0] / N) - here[1]));
    if (!left.length) break;
    // Round the three nearest at once if there is a way, or else round fewer.
    let path = null, aimed = Math.min(3, left.length);
    for (; aimed > 0 && !path; aimed--) path = way(game, here[0], here[1], left.slice(0, aimed), bx, by, half);
    if (!path) { given.add(left[0]); continue; }
    close += path.close;
    // Only the turns are flown to. A haul on the way ends the flight: what is left is looked at afresh.
    hit = false;
    for (let n = 1; n < path.length && !hit && clock.t < 30; n++) {
      const turn = n === path.length - 1 || path[n + 1][0] - path[n][0] !== path[n][0] - path[n - 1][0] || path[n + 1][1] - path[n][1] !== path[n][1] - path[n - 1][1];
      if (turn) fly(game, path[n][0], path[n][1], clock, each);
    }
    // (The game asks ten times a second what the tether is round.)
    for (let f = 0; f < 12 && !hit; f++) { game.update(1 / 60); clock.t += 1 / 60; each(); }
    // A lump flown right round and still there is left be.
    if (!hit) given.add(left[0]);
  }
  const after = banked(game);
  return { opened, loose, lumps: shaken.length, worth, t: last, grit: after.grit - before.grit, gems: after.gems - before.gems, left: given.size, close };
}
// A loop cut round a block `side` cells square with the place in its middle. Returns what came home and when, or
// null where the ring would pass the tether's reach.
export async function loop(seed, L, ax, ay, side) {
  const [ox, oy] = Math.abs(ax) >= Math.abs(ay) ? [Math.sign(ax), 0] : [0, Math.sign(ay)], h = Math.floor((side + 1) / 2);
  const game = await stage(seed, L, ax - ox * h, ay - oy * h), d = game.drill, cx = Math.floor(d.x), cy = Math.floor(d.y);
  const at = (a, b) => [cx + ox * a - oy * b, cy + oy * a + ox * b];
  const turns = [at(0, -h), at(side + 1, -h), at(side + 1, side + 1 - h), at(0, side + 1 - h), at(0, 0)];
  if (turns.some(([x, y]) => Math.hypot(x + 0.5 - HX, y + 0.5 - HY) > game.val('tether') - 0.5)) return null;
  const before = banked(game), clock = { t: 0 };
  let last = 0, hauls = before.hauls;
  const each = () => { if (game.S.stats.hauls !== hauls) { hauls = game.S.stats.hauls; last = clock.t; } return false; };
  // Round once; and once more if the block still stands (moss, basalt or ice closed the ring behind the drill).
  const stands = () => { for (let a = 1; a <= side; a++) for (let b = 1 - h; b <= side - h; b++) { const [x, y] = at(a, b), k = game.world.k(y * N + x); if (k !== K.EMPTY && HARD[k] < 99) return true; } return false; };
  for (let lap = 0; lap < 2 && (!lap || stands()) && clock.t < 40; lap++) for (const [x, y] of turns) fly(game, x, y, clock, each, 900);
  const after = banked(game);
  return { t: last || clock.t, grit: after.grit - before.grit, gems: after.gems - before.gems };
}
// The places played in one direction of one world at one level, as cells east and south of the core: spots
// between half and nine tenths of the reach out, each aimed, no two within eight cells of each other. (The first
// reach is short: there may not be `count` such places in it.)
export function places(seed, L, ux, uy, count) {
  const R = reach(L), rnd = random(seed * 31 + L * 7 + (ux + 2) * 3 + uy), list = [];
  for (let tries = 0; tries < count * 12 && list.length < count; tries++) {
    const far = R * (0.55 + 0.35 * rnd()), off = (rnd() - 0.5) * 0.5 * far, at = aim(seed, L, Math.round(ux * far - uy * off), Math.round(uy * far + ux * off));
    if (at && !list.some(([x, y]) => Math.hypot(x - at[0], y - at[1]) < 8)) list.push(at);
  }
  return list;
}
// Every place of a level and a direction played, and the sums of it. Without `loops` only the charges are played.
export async function play(L, ux, uy, seeds, count, each, loops = true) {
  const sum = { n: 0, none: 0, opened: 0, loose: 0, wgrit: 0, wgems: 0, t: 0, grit: 0, gems: 0, lgrit: 0, lgems: 0, lside: 0, left: 0, close: 0 };
  for (const seed of seeds) for (const [ax, ay] of places(seed, L, ux, uy, count)) {
    const c = await charge(seed, L, ax, ay);
    let best = { t: 0, grit: 0, gems: 0, side: 0 };
    for (let side = 1; side <= 16 && c.t > 0 && loops; side++) {
      const l = await loop(seed, L, ax, ay, side);
      if (!l || l.t > c.t) break;
      best = { ...l, side };
    }
    sum.n++; sum.none += c.loose ? 0 : 1; sum.opened += c.opened; sum.loose += c.loose; sum.t += c.t; sum.grit += c.grit; sum.gems += c.gems; sum.left += c.left; sum.close += c.close ? 1 : 0;
    sum.wgrit += c.worth?.grit ?? 0; sum.wgems += c.worth ? c.worth.gems.reduce((a, b) => a + b, 0) : 0;
    sum.lgrit += best.grit; sum.lgems += best.gems; sum.lside += best.side;
    if (each) each(seed, ax, ay, c, best);
  }
  return sum;
}

if (process.argv[1] && import.meta.url.endsWith('/' + process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const arg = (name, fallback) => { const n = process.argv.indexOf(`--${name}`); return n < 0 ? fallback : process.argv[n + 1]; };
  const seeds = String(arg('seeds', '7,11,13')).split(',').map(Number), count = Number(arg('spots', 4)), only = Number(arg('level', 0));
  if (arg('radius')) SIFT.radius = [0, ...String(arg('radius')).split(',').map(Number)];
  if (arg('shake') !== undefined) SIFT.shake = Number(arg('shake'));
  if (arg('room') !== undefined) SIFT.room = Number(arg('room'));
  if (arg('aim') !== undefined) PILOT.aim = Number(arg('aim'));
  const planned = process.argv.includes('--planned'), every = process.argv.includes('--each');
  if (planned) {
    // As first planned: a disc, and of what lies in it only soft rock, ice, basalt, glass and fault rock go.
    const { Game } = await import('../js/game.js');
    Game.prototype.sifts = function (cx, cy, r = SIFT.radius[this.S.lv.bombs]) {
      const cells = [], most = Math.ceil(r);
      for (let v = -most; v <= most; v++) for (let u = -most; u <= most; u++) {
        const i = (cy + v) * N + cx + u, k = this.world.k(i);
        if (u * u + v * v <= r * r && plain(k) && k !== K.DENSE && this.within(cx + u + 0.5, cy + v + 0.5)) cells.push(i);
      }
      return cells;
    };
  }
  const compact = n => n < 1000 ? n.toFixed(n < 10 ? 1 : 0) : n < 1e6 ? `${(n / 1000).toFixed(1)}K` : `${(n / 1e6).toFixed(2)}M`;
  console.log(`BLAST${planned ? ' as first planned' : ''}: radius ${SIFT.radius.slice(1).join(', ')}${planned ? '' : `, lumps followed ${SIFT.shake} past the edge, ${SIFT.room} of room round them`}; aimed within ${PILOT.aim}; worlds ${seeds.join(', ')}, ${count} spots a direction`);
  console.log('level  where  reach  charges  none loose  close  opened  loose   worth of it      flown round in  brought home         the loop in that time');
  for (let L = 1; L <= 4; L++) {
    if (only && L !== only) continue;
    for (const [name, ux, uy] of DIRS) {
      const sum = await play(L, ux, uy, seeds, count, every ? (seed, ax, ay, c, best) => console.log(`    seed ${seed} at ${ax},${ay}: opened ${c.opened}, ${c.loose} cells loose in ${c.lumps} lumps (${c.left} left be, ${c.close} close), ${c.t.toFixed(1)} s, `
        + `${compact(c.grit)} grit ${c.gems} gems; loop of ${best.side} in ${best.t.toFixed(1)} s, ${compact(best.grit)} grit ${best.gems} gems`) : null);
      const m = k => sum[k] / sum.n, pc = k => `${String(Math.round(100 * m(k))).padStart(3)}%`;
      console.log(`  ${L}    ${name.padEnd(6)} ${String(reach(L)).padStart(4)}   ${String(sum.n).padStart(4)}     ${pc('none')}     ${pc('close')}   ${m('opened').toFixed(0).padStart(4)}   ${m('loose').toFixed(1).padStart(5)}   ${compact(m('wgrit')).padStart(6)} + ${m('wgems').toFixed(1).padStart(4)} gems   ${m('t').toFixed(1).padStart(5)} s   ${compact(m('grit')).padStart(6)} + ${m('gems').toFixed(1).padStart(4)} gems`
        + `   ${compact(m('lgrit')).padStart(6)} + ${m('lgems').toFixed(1).padStart(4)} gems (block of ${m('lside').toFixed(1)})${sum.left ? `  ${sum.left} lumps left be` : ''}`);
    }
  }
}
