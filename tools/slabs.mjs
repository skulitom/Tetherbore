// Keystone slabs and cobble fields, counted and checked with no browser (docs/CONTENT-PLAN.md, content item 5):
// how many sectors hold one and what stood against the rest, how big they are, and whether each is sound as it
// lies in the world's own cells.
//   node tools/slabs.mjs [--seeds 8] [--far 2300] [--where seed] [--near n]
//
//   --seeds n      count over worlds 1 to n (or a list: --seeds 7,11)
//   --far r        only sectors whose slab would lie within r cells of the core
//   --where seed   list that world's slabs instead, nearest first: where, how big, how many keys, in what ground,
//                  and a place beside each to aim tools/shot.mjs or a fuzz at (--near n: the first n; 24)
//
// `check(world, slab)` is what test/slab-moat.mjs asks of every slab; it reads the world's cells and nothing else
// that the world keeps about the slab but where it is, how big, and which cells are its keys.
import { fileURLToPath } from 'node:url';
import { World, N, C, K, SLAB, HOLD, WORLD_R, rowOf } from '../js/world.js';

const STEP = [1, N, -1, -N];
const far = (S, i) => Math.hypot((i % N) - S.cx, Math.floor(i / N) - S.cy);

// Every slab of a world whose sector lies within `reach` cells of the core, the first slab first.
export function slabsOf(w, reach = WORLD_R) {
  const out = [], most = Math.ceil(reach / SLAB);
  if (w.firstSlab) out.push(w.firstSlab);
  for (let sy = -most; sy < most; sy++) for (let sx = -most; sx < most; sx++) {
    if (Math.hypot((sx + 0.5) * SLAB, (sy + 0.5) * SLAB) > reach + SLAB) continue;
    const S = w.slabIn(sx, sy);
    if (S && Math.hypot(S.cx - C, S.cy - C) <= reach) out.push(S);
  }
  return out;
}
// Cells joined side to side from `starts` through cells that `through` allows; stops at `limit` cells or when
// `until` says a cell is far enough (and says so: `.out`).
function spread(starts, through, limit = 60000, until = null) {
  const seen = new Set(starts), cells = [...seen];
  for (let head = 0; head < cells.length && cells.length < limit; head++) for (const s of STEP) {
    const j = cells[head] + s;
    if (seen.has(j) || !through(j)) continue;
    if (until && until(j)) { cells.out = true; return cells; }
    seen.add(j); cells.push(j);
  }
  cells.set = seen;
  return cells;
}

// Everything wrong with a slab as it lies in the world's cells, as a list of strings (empty: it is sound), and
// what was counted on the way: { faults, inside, keys, moat, held }.
//   the crack   with the keys cut it is one ring of open cells, joined side to side, right round the middle, shut
//               in by the slab and its collar (it leaks into no cave);
//   the slab    one piece of ground with no open cell in it, which touches other ground only through keys, and
//               which the game's own books find loose, whole and alone, when the keys are cut (`World.freed`);
//   the keys    each run of key cells joins the slab to the collar;
//   the collar  the ground on the far side of the crack is one piece and runs on, cell beside cell, `hold` cells
//               beyond the slab's own (the world holds it).
// A cobble field: no block of it floats (all its ground is joined to ground that runs on `hold` cells beyond), its
// joints are open and its keys in them, and the keys round a whole block, cut, leave that block loose and whole.
export function check(w, S, hold = HOLD) {
  const faults = [], keys = new Set(S.keys), solid = i => w.k(i) !== K.EMPTY, mid = S.cy * N + S.cx, R = S.reach;
  const beyond = i => far(S, i) >= R + hold;
  if (!S.keys.length) faults.push('it has no keys');
  for (const i of S.keys) if (w.k(i) !== K.KEY) faults.push(`a cell of key is ${w.k(i)}`);
  if (S.cobble) {
    const field = [];
    for (let y = S.cy - S.p - 4; y <= S.cy + S.p + 4; y++) for (let x = S.cx - S.p - 4; x <= S.cx + S.p + 4; x++) if (Math.hypot(x - S.cx, y - S.cy) < S.p + 4) field.push(y * N + x);
    const ground = field.filter(solid), open = field.filter(i => !solid(i));
    // From the collar outward, and back in through everything joined to it.
    const ring = [];
    for (let y = S.cy - S.p - 6; y <= S.cy + S.p + 6; y++) for (let x = S.cx - S.p - 6; x <= S.cx + S.p + 6; x++) { const d = Math.hypot(x - S.cx, y - S.cy); if (d >= S.p + 4 && d < S.p + 6.5) ring.push(y * N + x); }
    if (ring.some(i => !solid(i))) faults.push('its collar has an open cell');
    const out = spread(ring.filter(solid), solid, 60000, beyond);
    if (!out.out) faults.push(`its collar is not held: the ground beside it ends within ${hold} cells`);
    const hung = spread(ring.filter(solid), i => solid(i) && far(S, i) < S.p + 6.5).set ?? new Set();
    const afloat = ground.filter(i => !hung.has(i));
    if (afloat.length) faults.push(`${afloat.length} cells of the field hang on nothing`);
    // Whole blocks: the keys against one, cut together, leave it loose.
    let blocks = 0, loose = 0;
    for (let bv = -4; bv <= 4; bv++) for (let bu = -4; bu <= 4; bu++) {
      const cells = [];
      for (let v = 1; v <= 4; v++) for (let u = 1; u <= 4; u++) cells.push((S.cy + bv * 5 + v) * N + S.cx + bu * 5 + u);
      if (cells.some(i => far(S, i) >= S.p + 2.5)) continue;
      blocks++;
      if (cells.some(i => !solid(i) || keys.has(i))) { faults.push('a block has an open cell or a key in it'); continue; }
      const round = new Set();
      for (const i of cells) for (const s of STEP) if (!cells.includes(i + s)) round.add(i + s);
      const held = [...round].filter(solid);
      if (!held.length || held.some(i => !keys.has(i))) { faults.push(`a block is held by ${held.length} cells, not all of them keys`); continue; }
      if (held.length > 3) faults.push(`a block has ${held.length} keys against it`);
      const first = cells[0], piece = w.freed(held, 120000).find(p => p.includes(first));
      if (piece && piece.length === 16) loose++; else faults.push(`a block's keys, cut, leave ${piece ? piece.length : 'no'} cells loose`);
    }
    if (!blocks) faults.push('it has no whole block');
    return { faults, inside: ground.length - S.keys.filter(i => far(S, i) < S.p + 4).length, keys: S.keys.length, moat: open.length, blocks, loose, held: !!out.out };
  }
  // The slab itself: from its middle through ground that is no key.
  const inside = spread([mid], i => solid(i) && !keys.has(i), 4000);
  if (!solid(mid)) faults.push('its middle is open');
  if (inside.some(i => far(S, i) > S.p + 0.5)) faults.push('the slab touches ground beyond its crack by a way that is no key');
  for (let y = S.cy - S.p; y <= S.cy + S.p; y++) for (let x = S.cx - S.p; x <= S.cx + S.p; x++) if (Math.hypot(x - S.cx, y - S.cy) < S.p - 2.6 && !solid(y * N + x)) faults.push('the slab has an open cell in it');
  // The crack: the open cells beside the keys, and on through open cells and keys.
  const moat = spread(S.keys, i => !solid(i) || keys.has(i), 4000);
  if (moat.length >= 4000 || moat.some(i => far(S, i) > S.p + 2.7 || far(S, i) < S.p - 2.7)) faults.push('the crack leaks: open ground joins it from outside its own width');
  // Right round: followed again keeping count of crossings of the line east from the middle.
  {
    const count = new Map([[moat[0], 0]]), stack = [moat[0]];
    let round = false;
    while (stack.length && !round) {
      const i = stack.pop(), x = i % N, y = Math.floor(i / N), here = count.get(i);
      for (let s = 0; s < 4; s++) {
        const j = i + STEP[s];
        if (!moat.set.has(j)) continue;
        const next = here + (x > S.cx && s === 1 && y === S.cy - 1 ? 1 : x > S.cx && s === 3 && y === S.cy ? -1 : 0);
        if (!count.has(j)) { count.set(j, next); stack.push(j); } else if (count.get(j) !== next) round = true;
      }
    }
    if (!round) faults.push('the crack is not a ring a drill can fly: its open cells do not join side to side right round');
  }
  // The keys: each run of them touches the slab and the ground outside the crack.
  const insideSet = inside.set ?? new Set(inside), runs = [];
  for (const start of S.keys) {
    if (runs.some(run => run.set.has(start))) continue;
    const run = spread([start], i => keys.has(i));
    runs.push(run);
    let touchesIn = false, touchesOut = false;
    for (const i of run) for (const s of STEP) { const j = i + s; if (insideSet.has(j)) touchesIn = true; else if (solid(j) && !keys.has(j)) touchesOut = true; }
    if (!touchesIn || !touchesOut) faults.push(`a key of ${run.length} cells does not join the slab to the collar`);
  }
  if (runs.length !== S.ux.length) faults.push(`it has ${runs.length} keys for ${S.ux.length} ways`);
  // The game's own books: the keys cut together leave the slab loose, whole and alone.
  const pieces = w.freed(S.keys, 120000);
  if (pieces.length !== 1 || pieces[0].length !== inside.length || !pieces[0].every(i => insideSet.has(i))) faults.push(`with its keys cut the books find ${pieces.map(p => p.length).join(' + ') || 'nothing'} loose, not the slab's ${inside.length} cells`);
  // The collar: the ground on the far side of the crack.
  const wall = new Set();
  for (const i of moat) for (const s of STEP) { const j = i + s; if (solid(j) && !keys.has(j) && !insideSet.has(j)) wall.add(j); }
  const start = wall.values().next().value;
  let held = false;
  if (start === undefined) faults.push('there is no ground outside the crack');
  else {
    const out = spread([start], i => solid(i) && !keys.has(i), 60000, beyond);
    held = !!out.out;
    if (!held) faults.push(`its collar is not held: the ground beside it ends within ${hold} cells`);
    // One piece: every cell of the wall is joined to the first, within the collar's own width and a little more.
    const near = spread([start], i => solid(i) && !keys.has(i) && !insideSet.has(i) && far(S, i) < R + 6, 20000).set;
    if ([...wall].some(i => !near.has(i))) faults.push('the collar is in more than one piece');
  }
  for (let y = S.cy - R; y <= S.cy + R; y++) for (let x = S.cx - R; x <= S.cx + R; x++) if (w.slabCell(S, x, y) >= 4 && !solid(y * N + x)) faults.push('the collar has an open cell');
  return { faults: [...new Set(faults)], inside: inside.length, keys: S.keys.length, moat: moat.length - S.keys.length, held };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (name, fallback) => { const at = process.argv.indexOf(`--${name}`); return at < 0 ? fallback : process.argv[at + 1]; };
  const reach = Number(arg('far', 2300)), where = arg('where', null);
  if (where !== null) {
    const w = new World(); w.reset(Number(where));
    const list = slabsOf(w, reach).sort((a, b) => Math.hypot(a.cx - C, a.cy - C) - Math.hypot(b.cx - C, b.cy - C)).slice(0, Number(arg('near', 24)));
    for (const S of list) {
      const c = check(w, S), dx = S.cx - C, dy = S.cy - C, r = Math.hypot(dx, dy), row = rowOf(w.biomeAt(S.cx, S.cy));
      // A place just outside the collar, on the side nearer the core: a shot or a fuzz begins there.
      const out = (r - S.reach - 3) / r;
      console.log(`${S === w.firstSlab ? 'first ' : S.cobble ? 'cobble' : 'slab  '} at ${dx},${dy} (${Math.round(r)} out, ${row.name})  p ${S.p}  ${S.cobble ? `${c.blocks} blocks` : `${S.ux.length} keys`}  ${c.inside} cells  beside: ${Math.round(dx * out)},${Math.round(dy * out)}${c.faults.length ? `  FAULTS: ${c.faults.join('; ')}` : ''}`);
    }
  } else {
    const list = arg('seeds', '8'), seeds = list.includes(',') ? list.split(',').map(Number) : Array.from({ length: Number(list) }, (_, n) => n + 1);
    const tally = { sectors: 0, slabs: 0, three: 0, cobbles: 0, faulty: 0 }, refused = {}, sizes = [], grounds = {}, bad = [], kinds = {};
    let cells = 0, tried = 0, began = Date.now(), firsts = 0;
    for (const seed of seeds) {
      const w = new World(); w.reset(seed);
      if (w.firstSlab) firsts++;
      const most = Math.ceil(reach / SLAB);
      for (let sy = -most; sy < most; sy++) for (let sx = -most; sx < most; sx++) if (Math.hypot((sx + 0.5) * SLAB, (sy + 0.5) * SLAB) <= reach) { tally.sectors++; w.slabIn(sx, sy); }
      const made = Date.now();
      for (const S of slabsOf(w, reach)) {
        const c = check(w, S), name = rowOf(w.biomeAt(S.cx, S.cy)).name;
        tally.slabs++; if (S.cobble) tally.cobbles++; else if (S.ux.length === 3) tally.three++;
        sizes.push(c.inside); cells += c.inside;
        grounds[name] = (grounds[name] ?? 0) + 1;
        for (const f of c.faults) { const kind = f.replace(/\d+/g, '#'); kinds[kind] = (kinds[kind] ?? 0) + 1; }
        if (c.faults.length) { tally.faulty++; if (bad.length < 12) bad.push(`seed ${seed} at ${S.cx - C},${S.cy - C}: ${c.faults.join('; ')}`); }
      }
      began += Date.now() - made;
      for (const [why, n] of Object.entries(w.refused)) refused[why] = (refused[why] ?? 0) + n;
      tried += w.tried;
    }
    sizes.sort((a, b) => a - b);
    console.log(JSON.stringify({ seeds: seeds.length, ...tally, firsts, share: +(tally.slabs / tally.sectors).toFixed(3), refused, cellsMedian: sizes[sizes.length >> 1], cellsMost: sizes[sizes.length - 1],
      cover: +(cells / (tally.sectors * SLAB * SLAB)).toFixed(4), askedPerSlab: Math.round(tried / tally.slabs), msToLay: Date.now() - began }));
    console.log(JSON.stringify(grounds));
    if (tally.faulty) console.log(JSON.stringify(kinds));
    for (const line of bad) console.log(line);
  }
}
