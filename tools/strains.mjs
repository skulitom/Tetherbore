// What the hand-made strains are made of, counted: for each strain (grounds 17 to 31 in js/world.js) and for its
// direction's own ground beside it, how much of the ground is each kind of cell, and the figures of its tell: how
// wide a river or a lane of ice runs, how big the bubbles and the bunches of pods are, how long and thick the beds
// of slate, how much slag lies round the lava, how many crystals stand beside slate and what one arc among them
// sets off and shatters; and what it pays beside its direction's own ground, a cell and a second of cutting (grit alone, by the
// row's `rich` and `dig`). This is what a strain's row is tuned by (docs/CONTENT-PLAN.md, content item 1), with the
// eye; test/regress/c1-tells.mjs holds the figures to what was settled.
//   node tools/strains.mjs [--seeds 8] [--where 7]
//
//   --seeds n    how many seeds to count over (1 to n); up to four provinces of each ground on each.
//   --where s    instead of counting: where on seed s a province of each strain lies nearest the core, as cells
//                east and south of the core. That is a place to send tools/shot.mjs (`--at`), test/rope-fuzz.mjs and
//                test/regress/i-fuzz-play.mjs (their start), with the tether level that reaches it.
//
// It asks the world itself (`province`, `biomeAt`, `kindAt`) and makes no piece of it. A window of 96 x 96 cells in
// the middle of a province is counted, if nine tenths of it and more are the province's own ground.
import { World, C, K, B, BIOMES, PROVINCE, KIND_NAMES, DEEP_R, GRIT, digTime } from '../js/world.js';
import { REACH } from '../js/shop.js';

const SIZE = 96;
const strains = () => BIOMES.filter(row => row && row.id >= 17 && row.id <= 31);
// The provinces of a world between the four round the core and the deep flanks, nearest the core first:
// [px, py, kin, ground, how far its middle is]. Whose direction a province is, is asked of the cell in its middle.
export const provinces = w => {
  const list = [];
  for (let py = -9; py <= 8; py++) for (let px = -9; px <= 8; px++) {
    const mx = (px + 0.5) * PROVINCE, my = (py + 0.5) * PROVINCE, rc = Math.sqrt(mx * mx + my * my);
    if (rc < 220 || rc > DEEP_R - 150) continue;
    const kin = BIOMES[w.biomeAt(C + Math.round(mx), C + Math.round(my))]?.kin;
    if (kin) list.push([px, py, kin, w.province(px, py, kin), rc]);
  }
  return list.sort((a, b) => a[4] - b[4]);
};
// Where a province of each strain lies nearest the core on a seed: { [ground]: [x, y] }, cells east and south of
// the core, the cell of that ground nearest the province's middle.
export const where = seed => {
  const w = new World(), found = {};
  w.reset(seed);
  for (const [px, py, , ground] of provinces(w)) {
    if (ground < 17 || found[ground]) continue;
    const mx = Math.round((px + 0.5) * PROVINCE), my = Math.round((py + 0.5) * PROVINCE);
    for (let ring = 0; ring < 120 && !found[ground]; ring += 4) for (let v = -ring; v <= ring && !found[ground]; v += 4) for (let u = -ring; u <= ring && !found[ground]; u += 4) {
      if (Math.max(Math.abs(u), Math.abs(v)) === ring && w.biomeAt(C + mx + u, C + my + v) === ground) found[ground] = [mx + u, my + v];
    }
  }
  return found;
};

// ---- counting
// What is counted of each ground: how many windows and cells; cells of each kind; the sizes of the groups of open
// cells, hazards, ice and slate that lie wholly inside a window (cells joined along sides and across corners); and
// the lengths of the runs of ice and of slate along rows ([0]) and down columns ([1]); and of the charged crystals
// that have slate among the eight cells round them (`arcs.beside`), what one arc from each would do: how many
// crystals go off in all, each setting off those within three cells (`arcs.set`), and how many cells of slate
// they shatter between them, each the slate round itself (`arcs.slate`), as js/game.js: `zap` has it.
export const count = (seeds = 8) => {
  const w = new World(), counts = new Map(), grid = new Int16Array(SIZE * SIZE), mark = new Uint8Array(SIZE * SIZE);
  const tally = () => ({ windows: 0, cells: 0, kind: new Array(32).fill(0), groups: { [K.EMPTY]: [], [K.HAZARD]: [], [K.ICE]: [], [K.SLATE]: [] }, runs: { [K.ICE]: [[], []], [K.SLATE]: [[], []] },
    arcs: { beside: 0, set: [], slate: [] } });
  const arcs = into => {
    const is = (x, y, kind) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && grid[y * SIZE + x] === kind;
    for (let s = 0; s < SIZE * SIZE; s++) {
      if (grid[s] !== K.HAZARD) continue;
      let beside = false;
      for (let v = -1; v <= 1 && !beside; v++) for (let u = -1; u <= 1; u++) if (is(s % SIZE + u, ((s / SIZE) | 0) + v, K.SLATE)) { beside = true; break; }
      if (!beside) continue;
      const set = new Set([s]), slate = new Set(), stack = [s];
      while (stack.length) {
        const c = stack.pop(), x = c % SIZE, y = (c / SIZE) | 0;
        for (let v = -3; v <= 3; v++) for (let u = -3; u <= 3; u++) {
          const j = (y + v) * SIZE + x + u;
          if (is(x + u, y + v, K.HAZARD) && !set.has(j)) { set.add(j); stack.push(j); }
          if (u >= -1 && u <= 1 && v >= -1 && v <= 1 && is(x + u, y + v, K.SLATE)) slate.add(j);
        }
      }
      into.beside++; into.set.push(set.size); into.slate.push(slate.size);
    }
  };
  const groups = (kind, into) => {
    mark.fill(0);
    for (let s = 0; s < SIZE * SIZE; s++) {
      if (grid[s] !== kind || mark[s]) continue;
      let n = 0, edge = false;
      const stack = [s]; mark[s] = 1;
      while (stack.length) {
        const c = stack.pop(), x = c % SIZE, y = (c / SIZE) | 0;
        n++;
        if (x === 0 || y === 0 || x === SIZE - 1 || y === SIZE - 1) edge = true;
        for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) {
          const X = x + u, Y = y + v, j = Y * SIZE + X;
          if (X >= 0 && Y >= 0 && X < SIZE && Y < SIZE && grid[j] === kind && !mark[j]) { mark[j] = 1; stack.push(j); }
        }
      }
      if (!edge) into.push(n);
    }
  };
  const runs = (kind, into) => {
    for (let way = 0; way < 2; way++) for (let a = 0; a < SIZE; a++) {
      let n = 0;
      for (let b = 0; b <= SIZE; b++) {
        if (b < SIZE && grid[way ? b * SIZE + a : a * SIZE + b] === kind) n++; else { if (n && n < SIZE) into[way].push(n); n = 0; }
      }
    }
  };
  for (let seed = 1; seed <= seeds; seed++) {
    const had = new Map();
    w.reset(seed);
    for (const [px, py, , ground] of provinces(w)) {
      if ((had.get(ground) ?? 0) >= 4) continue;
      had.set(ground, (had.get(ground) ?? 0) + 1);
      const x0 = C + Math.round((px + 0.5) * PROVINCE) - SIZE / 2, y0 = C + Math.round((py + 0.5) * PROVINCE) - SIZE / 2;
      let own = 0;
      for (let v = 0; v < SIZE; v++) for (let u = 0; u < SIZE; u++) {
        const b = w.biomeAt(x0 + u, y0 + v);
        grid[v * SIZE + u] = b === ground ? w.kindAt(x0 + u, y0 + v, b) : -1;
        if (b === ground) own++;
      }
      if (own < SIZE * SIZE * 0.9) continue;
      const t = counts.get(ground) ?? counts.set(ground, tally()).get(ground);
      t.windows++; t.cells += own;
      for (let s = 0; s < SIZE * SIZE; s++) if (grid[s] >= 0) t.kind[grid[s]]++;
      for (const kind of [K.EMPTY, K.HAZARD, K.ICE, K.SLATE]) groups(kind, t.groups[kind]);
      for (const kind of [K.ICE, K.SLATE]) runs(kind, t.runs[kind]);
      if (BIOMES[ground].haz?.type === 'spark') arcs(t.arcs);
    }
  }
  // What a solid cell of each pays in grit, and what a second of cutting it does.
  for (const [id, t] of counts) {
    const row = BIOMES[id];
    let grit = 0, time = 0, solid = 0;
    for (let k = 1; k < 32; k++) if (t.kind[k] && GRIT[k] !== undefined) { grit += t.kind[k] * GRIT[k] * row.rich * row.worth; time += t.kind[k] * digTime(k, row); solid += t.kind[k]; }
    t.pays = [grit / solid, grit / time];
  }
  return counts;
};
export const mean = list => list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0;
export const median = list => list.length ? list.slice().sort((a, b) => a - b)[list.length >> 1] : 0;
// How much of a list of sizes lies from `from` to `to`, as a share of the list.
export const share = (list, from, to = Infinity) => list.length ? list.filter(v => v >= from && v <= to).length / list.length : 0;

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const options = { seeds: '8', where: '' };
  for (let args = process.argv.slice(2), i = 0; i < args.length; i++) {
    const name = args[i].replace(/^--/, '');
    if (!(name in options) || args[i + 1] === undefined) { console.error('node tools/strains.mjs [--seeds 8] [--where 7]'); process.exit(2); }
    options[name] = args[++i];
  }
  if (options.where) {
    const found = where(+options.where);
    for (const row of strains()) {
      const at = found[row.id];
      if (!at) { console.log(`${String(row.id).padStart(3)} ${row.name.padEnd(10)} none between the core's four provinces and the deep flanks on seed ${options.where}`); continue; }
      const far = Math.sqrt(at[0] * at[0] + at[1] * at[1]), level = REACH.findIndex(r => r >= far + 40);
      console.log(`${String(row.id).padStart(3)} ${row.name.padEnd(10)} at ${at[0]},${at[1]}  (${Math.round(far)} out: tether level ${level}, reach ${REACH[level]})`);
    }
    process.exit(0);
  }
  const counts = count(+options.seeds), kinds = [K.EMPTY, K.SOFT, K.DENSE, K.ORE_A, K.ORE_B, K.SLATE, K.HAZARD, K.ICE, K.SLAG];
  const pct = (n, of) => of ? (n / of * 100).toFixed(1).padStart(5) : '    -';
  const sizes = (list, edges) => edges.map((to, n) => { const from = n ? edges[n - 1] + 1 : 1; return `${from === to ? to : `${from}-${to}`}: ${(share(list, from, to) * 100).toFixed(0)}%`; }).concat(`more: ${(share(list, edges[edges.length - 1] + 1) * 100).toFixed(0)}%`).join(', ');
  console.log(`seeds 1 to ${options.seeds}; a window of ${SIZE} x ${SIZE} cells in the middle of each province; shares are of all cells\n`);
  console.log(`ground       wins   ${kinds.map(k => KIND_NAMES[k].padStart(7)).join('')}   other   pays a cell, a second (x its direction's)`);
  for (const id of [B.FROST, 17, 18, B.EMBER, 19, 20, B.MIRE, 21, 22, B.LODE, 23, 24, ...strains().filter(r => r.id > 24).map(r => r.id)]) {
    const t = counts.get(id), row = BIOMES[id], own = id <= 4;
    if (!t) { console.log(`${row.name.padEnd(12)} no province of it was counted`); continue; }
    const rest = t.cells - kinds.reduce((sum, k) => sum + t.kind[k], 0), kin = counts.get(row.kin)?.pays;
    const pay = !own && kin ? `${(t.pays[0] / kin[0]).toFixed(2).padStart(8)} ${(t.pays[1] / kin[1]).toFixed(2).padStart(6)}` : '';
    console.log(`${(own ? '' : '  ') + row.name.padEnd(own ? 12 : 10)} ${String(t.windows).padStart(4)}   ${kinds.map(k => pct(t.kind[k], t.cells).padStart(7)).join('')}   ${pct(rest, t.cells)}${pay}`);
    const says = [], has = extra => row.extras.includes(extra), each = list => (list.length / t.windows).toFixed(1);
    if (has('rivers') || has('lanes')) says.push(`ice runs ${mean(t.runs[K.ICE][0]).toFixed(1)} cells along a row and ${mean(t.runs[K.ICE][1]).toFixed(1)} down a column`);
    if (has('bubbles') || id === B.EMBER) says.push(`open groups by size, ${sizes(t.groups[K.EMPTY], [1, 2, 3, 6, 20])} (${each(t.groups[K.EMPTY])} a window)`);
    if (has('grapes') || id === B.MIRE) says.push(`bunches of pods by size, ${sizes(t.groups[K.HAZARD], [1, 2, 3, 4, 5, 6])} (${each(t.groups[K.HAZARD])} a window)`);
    if (has('strata') || id === B.LODE) says.push(`slate runs ${mean(t.runs[K.SLATE][0]).toFixed(1)} cells along a row and ${mean(t.runs[K.SLATE][1]).toFixed(1)} down a column`);
    if (row.kin === B.EMBER) says.push(`pockets of lava by size, ${sizes(t.groups[K.HAZARD], [1, 2, 3, 6])} (${each(t.groups[K.HAZARD])} a window); ${(t.kind[K.SLAG] / t.kind[K.HAZARD]).toFixed(2)} cells of slag for each of lava`);
    if (row.haz?.type === 'spark') says.push(`${(t.arcs.beside / t.kind[K.HAZARD] * 100).toFixed(0)} crystals in a hundred stand beside slate; one arc among them sets off ${mean(t.arcs.set).toFixed(1)} crystals and shatters ${mean(t.arcs.slate).toFixed(1)} cells of slate (half of them ${median(t.arcs.slate)} or more)`);
    for (const line of says) console.log(`             ${line}`);
  }
}
