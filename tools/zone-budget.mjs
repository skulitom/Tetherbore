// Pockets counted against their budget, with no browser and none of the world made (docs/CONTENT-PLAN.md S3, S4):
// what each kind of pocket holds, what that pays and how many specimens it gives, beside what it may; and where
// pockets lie in a world.
//   node tools/zone-budget.mjs [--pockets 200] [--seeds 8] [--lump x] [--spec x] [--play n] [--where seed] [--near n]
//
//   --pockets n    how many pockets of each kind to make (200), at radii drawn as the world draws them
//   --seeds n      the worlds whose own pockets are counted, 1 to n (or a list: --seeds 7,11)
//   --lump x       count with this lump for every kind, not its row's (to try a figure before it is set)
//   --spec x       likewise its specimens a cell
//   --play n       play the first n hives of world 7 with no hand on them (tools/hive-play.mjs) and say how long a
//                  nugget took: what the last column, the pay while inside, is worked out from
//   --where seed   list that world's pockets instead, nearest the core first: where, what, how big, and a place
//                  beside each to aim tools/shot.mjs or a fuzz at (--near n: the first n; 24)
//
// THE BUDGET (S4). A cell of a pocket's mineral pays `lump` seconds of what cutting earns out there, so a pocket
// pays its cells of mineral times its lump, in seconds of income. It may pay 3.5 seconds for each cell of its
// radius (49 at radius 14), and give about 12 specimens at radius 14. A kind is over where the mean of its
// pockets is, in any band of radius.
// A kind whose lump is more for each haul made just before (its row's `chain`: a fifth more a haul, to double) is
// counted at the most it can pay: every piece of ground in it that holds mineral hauled by itself, one close
// behind another in one chain, the poorest first. `flat` is what it pays with no chain at all.
//
// `budget` is what test/regress/s4-budget.mjs holds the rows' figures to.
import { fileURLToPath } from 'node:url';
import { World, C, K, BIOMES, ZONE, HERALD_RHO, rowOf, cellHash as hash } from '../js/world.js';

export const SECONDS = 3.5, SPECIMENS = 12, AT = 14;
// The bands of radius a kind's pockets are counted in: up to each figure.
export const BANDS = [10, 14, 20, 31];
const mean = list => list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0;

// The cells of a pocket, counted from its record: { cells, open, mineral, node, lumps }. `lumps` is how many cells
// of mineral each piece of its ground holds (ground joined side to side: a drift's boulder is one), of the pieces
// that hold any, the poorest first; counted only where it is asked for (`pieces`).
export function cellsOf(w, Z, pieces = false) {
  const out = { cells: 0, open: 0, mineral: 0, node: 0, lumps: [] }, most = Math.ceil(Z.reach), wide = 2 * most + 1, kinds = pieces ? new Int8Array(wide * wide).fill(-1) : null;
  for (let y = Z.cy - most; y <= Z.cy + most; y++) for (let x = Z.cx - most; x <= Z.cx + most; x++) {
    if (!w.inPocket(Z, x, y)) continue;
    const k = w.pocketCell(Z, x, y);
    out.cells++;
    if (kinds) kinds[(y - Z.cy + most) * wide + x - Z.cx + most] = k;
    if (k === K.EMPTY) out.open++; else if (k === Z.mineral) out.mineral++; else if (k === K.NODE) out.node++;
  }
  if (kinds) for (let from = 0; from < kinds.length; from++) {
    if (kinds[from] <= K.EMPTY) continue;
    const piece = [from];
    let held = kinds[from] === Z.mineral ? 1 : 0;
    kinds[from] = -1;
    for (const at of piece) for (const to of [at + 1, at - 1, at + wide, at - wide]) {
      if (to < 0 || to >= kinds.length || kinds[to] <= K.EMPTY || (to % wide === 0 && at % wide === wide - 1) || (at % wide === 0 && to % wide === wide - 1)) continue;
      if (kinds[to] === Z.mineral) held++;
      kinds[to] = -1; piece.push(to);
    }
    if (held) out.lumps.push(held);
  }
  out.lumps.sort((a, b) => a - b);
  return out;
}
// How many cells' worth of its plain lump a pocket's mineral pays when every piece that holds any is hauled in one
// chain, the poorest first: a fifth more for each haul before, to double.
export const chained = lumps => lumps.reduce((sum, held, n) => sum + held * (1 + 0.2 * Math.min(5, n)), 0);
// `count` pockets of the kind whose ground is `row`, made as the world makes them (a radius of 6 + 24 x the square
// of a hash, brought within the kind's own; a middle and a seed by hashes of their own) and counted. Returns
//   { row, name, lump, spec, made, radius, cells, mineral, seconds, flat, pieces, may, specimens, at14, bands:
//     [{ to, made, radius, mineral, seconds, flat, pieces, may, specimens }], herald: { the same } }
// the means over all of them and over each band of radius: `seconds` is what a pocket pays (the most it can, of a
// kind that pays more in a chain; `flat` is what it pays with none, and `pieces` how many pieces of its ground
// hold mineral), `may` what it may.
// `herald` is as many again made as a direction's first pocket is, HERALD_RHO in radius.
export function budget(row, count = 200, lump = rowOf(row).pocket.lump, spec = rowOf(row).pocket.spec) {
  const P = rowOf(row).pocket, w = new World(), all = [], first = [];
  for (let n = 0; n < count; n++) {
    w.reset(1000 + n);
    const h = hash(n, row, 41), rho = Math.min(P.rho[1], Math.max(P.rho[0], 6 + 24 * h * h));
    const Z = w.zone(row, C - 300 - Math.floor(hash(n, row, 42) * 900), C + Math.floor((hash(n, row, 43) - 0.5) * 400), rho, 3);
    all.push({ rho, ...cellsOf(w, Z, !!P.chain) });
    first.push({ rho: HERALD_RHO, ...cellsOf(w, w.zone(row, C - 165, C - 14, HERALD_RHO, 3), !!P.chain) });
  }
  const sum = list => ({ made: list.length, radius: mean(list.map(p => p.rho)), cells: mean(list.map(p => p.cells)), mineral: mean(list.map(p => p.mineral)),
    seconds: mean(list.map(p => (P.chain ? chained(p.lumps) : p.mineral) * lump)), flat: mean(list.map(p => p.mineral * lump)), pieces: mean(list.map(p => p.lumps.length)),
    may: mean(list.map(p => p.rho * SECONDS)), specimens: mean(list.map(p => p.mineral * spec)) });
  const near = all.filter(p => Math.abs(p.rho - AT) <= 1.5);
  return { row, name: rowOf(row).name, lump, spec, ...sum(all), at14: mean(near.map(p => p.mineral * spec)), herald: sum(first),
    bands: BANDS.map((to, n) => ({ to, ...sum(all.filter(p => p.rho < to && p.rho >= (BANDS[n - 1] ?? 0))) })) };
}
// The kinds of pocket there are: the numbers of their grounds.
export const kinds = () => BIOMES.filter(row => row && row.id >= 32 && row.id <= 63 && row.pocket?.shape).map(row => row.id);
// A world's own pockets: how many lie within each reach, how many of each kind, and the share of the ground within
// the last reach that is a pocket's.
export function census(seed, reaches = [230, 420, 750, 1350, 2300]) {
  const w = new World(); w.reset(seed);
  const all = w.pocketsWithin(2300 + ZONE), far = Z => Math.sqrt((Z.cx - C) ** 2 + (Z.cy - C) ** 2);
  const kinds = {}, heralds = all.filter(Z => Z.herald).map(Z => ({ kin: Z.kin, name: rowOf(Z.row).name, far: Math.round(far(Z)) }));
  let cells = 0;
  for (const Z of all) { kinds[rowOf(Z.row).name] = (kinds[rowOf(Z.row).name] ?? 0) + 1; if (far(Z) <= 2300) cells += cellsOf(w, Z).cells; }
  return { seed, within: reaches.map(R => all.filter(Z => far(Z) <= R).length), kinds, heralds, cover: cells / (Math.PI * 2300 * 2300) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (name, fallback) => { const n = process.argv.indexOf(`--${name}`); return n < 0 ? fallback : process.argv[n + 1]; };
  const where = arg('where');
  if (where !== undefined) {
    const w = new World(); w.reset(Number(where));
    console.log(`world ${where}: its pockets, nearest the core first (x east, y south, from the core)`);
    for (const Z of w.pocketsWithin(2300).slice(0, Number(arg('near', 24)))) {
      const c = cellsOf(w, Z), far = Math.sqrt((Z.cx - C) ** 2 + (Z.cy - C) ** 2), ux = (Z.cx - C) / far, uy = (Z.cy - C) / far, at = far - Z.reach - 4;
      console.log(`  ${rowOf(Z.row).name.padEnd(8)} ${Z.herald ? 'herald' : '      '} at ${String(Z.cx - C).padStart(5)},${String(Z.cy - C).padEnd(5)} ${String(Math.round(far)).padStart(4)} out, radius ${Z.rho.toFixed(1).padStart(4)}, ${['', 'north', 'south', 'west', 'east'][Z.kin].padEnd(5)}  ${String(c.cells).padStart(4)} cells, ${String(c.mineral).padStart(3)} of ${rowOf(Z.row).pocket.mineral}; stand at ${Math.round(ux * at)},${Math.round(uy * at)}`);
    }
    process.exit(0);
  }
  const count = Number(arg('pockets', 200)), list = String(arg('seeds', 8)), seeds = list.includes(',') ? list.split(',').map(Number) : Array.from({ length: Number(list) }, (_, n) => n + 1);
  // How long a nugget takes with no hand on it, and so what a hive pays while the drill is in it.
  let per = null;
  if (arg('play') !== undefined) {
    const { play } = await import('./hive-play.mjs'), took = [];
    for (let n = 0; n < Number(arg('play')); n++) { const r = await play(7, n); for (const t of r.took) took.push(t.t); }
    per = mean(took);
    console.log(`played with no hand on it, ${took.length} nuggets of world 7's first ${arg('play')} hives: ${per.toFixed(1)} s a nugget, the way to it counted in\n`);
  }
  console.log(`the budget: ${SECONDS} s of income for each cell of a pocket's radius, and about ${SPECIMENS} specimens at radius ${AT}; ${count} pockets of each kind\n`);
  for (const row of kinds()) {
    const lump = arg('lump') === undefined ? undefined : Number(arg('lump')), spec = arg('spec') === undefined ? undefined : Number(arg('spec'));
    const b = budget(row, count, lump ?? rowOf(row).pocket.lump, spec ?? rowOf(row).pocket.spec), P = rowOf(row).pocket;
    console.log(`${b.name} (ground ${row}): ${P.mineral}, lump ${b.lump}, ${b.spec} specimens a cell`);
    // (Of a kind that pays more in a chain: in how many pieces its mineral lies, and what it pays with no chain.)
    const also = s => P.chain ? `, in ${s.pieces.toFixed(1)} pieces (${s.flat.toFixed(1)} s with no chain)` : '';
    console.log(`  all ${b.made}: radius ${b.radius.toFixed(1)}, ${b.cells.toFixed(0)} cells, ${b.mineral.toFixed(1)} of ${P.mineral}${also(b)}: pays ${b.seconds.toFixed(1)} s of ${b.may.toFixed(1)} it may (${(b.seconds / b.may * 100).toFixed(0)}%), ${b.specimens.toFixed(1)} specimens; at radius ${AT}, ${b.at14.toFixed(1)} specimens of ${SPECIMENS}`);
    for (const band of b.bands) if (band.made) console.log(`  radius under ${String(band.to).padStart(2)} (${String(band.made).padStart(3)}): ${band.radius.toFixed(1).padStart(4)}, ${band.mineral.toFixed(1).padStart(5)} of ${P.mineral}${also(band)}: pays ${band.seconds.toFixed(1).padStart(5)} s of ${band.may.toFixed(1).padStart(5)} (${(band.seconds / band.may * 100).toFixed(0)}%), ${band.specimens.toFixed(1)} specimens`);
    console.log(`  as a herald, radius ${HERALD_RHO}: ${b.herald.mineral.toFixed(1)} of ${P.mineral}${also(b.herald)}: pays ${b.herald.seconds.toFixed(1)} s of ${b.herald.may.toFixed(1)} (${(b.herald.seconds / b.herald.may * 100).toFixed(0)}%), ${b.herald.specimens.toFixed(1)} specimens`);
    // While inside: a hive's nugget is nine cells, and takes so long to bring home.
    if (P.shape === 'hive') for (const [who, t] of [['at the five seconds a nugget first planned', 5], ...(per ? [['as played with no hand on it', per]] : [])]) console.log(`  while inside, ${who}: ${(9 * b.lump / t).toFixed(2)} times the model's income`);
    console.log('');
  }
  const worlds = seeds.map(seed => census(seed));
  console.log(`in worlds ${seeds.join(', ')}: pockets within reach 230, 420, 750, 1,350 and 2,300: ${[0, 1, 2, 3, 4].map(n => mean(worlds.map(c => c.within[n])).toFixed(1)).join(', ')}`);
  const names = {};
  for (const c of worlds) for (const [name, n] of Object.entries(c.kinds)) names[name] = (names[name] ?? 0) + n / worlds.length;
  console.log(`  of each kind: ${Object.entries(names).map(([name, n]) => `${name} ${n.toFixed(1)}`).join(', ')}; they cover ${(mean(worlds.map(c => c.cover)) * 100).toFixed(2)}% of the ground within the last reach`);
  console.log(`  the heralds of world ${worlds[0].seed}: ${worlds[0].heralds.map(h => `${['', 'north', 'south', 'west', 'east'][h.kin]} ${h.name} ${h.far} out`).join(', ')}`);
}
