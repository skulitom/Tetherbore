// The pumice drift as it lies in the ground (docs/CONTENT-PLAN.md, content item 7; js/world.js: POCKET_SHAPES.drift,
// driftBoulders, boulders, and the drift's row). Checked on the world's own cells, in the drifts of four worlds:
//   - the row: found in every direction, from 170 cells out, 9 to 30 in radius, a plain disc, the one twist
//     'drift', a mineral that pays more in a chain, and what it pays;
//   - a drift is open ground with nothing in it but boulders: every cell of it is open, pumice or aerolite, and
//     every solid cell is a cell of one of its boulders as `driftBoulders` lists them;
//   - a boulder is 4 to 12 cells, all joined, two to four cells across, with one to four cells of aerolite at its
//     heart (a pebble of 2 or 3 cells, hard against the room it must leave to the wall, is under one in a hundred);
//     not one in twenty is as many as 12 cells, the size at which a haul stops being a light one;
//   - a boulder never leaves its square of seven cells, so the lanes between boulders are three cells wide or
//     more; and it keeps two cells of open ground between itself and the cavern's wall;
//   - so every boulder hangs on nothing as the seed laid it: its outline, walked in the world itself, is an
//     island's;
//   - the four squares round the middle always hold a boulder: no drift has fewer than four, and a direction's
//     first has exactly four;
//   - of the other squares the share `boulders(rho)` do: fewer the bigger the drift, so that what a drift holds
//     grows no faster than its radius (tools/zone-budget.mjs and test/regress/s4-budget.mjs hold what it pays).
// What each cell is, cell for cell, test/regress/w-same-world.mjs holds.
//   node test/regress/c7-drift-laid.mjs
import { World, N, C, K, BIOMES, boulders, driftBoulders, digTime } from '../../js/world.js';

const fails = [], check = (ok, what) => { if (!ok && fails.length < 16) fails.push(what); };
const out = {};

// ---- the row
{
  const row = BIOMES[33], P = row.pocket;
  check(row.name === 'drift' && row.title === 'PUMICE DRIFT' && row.kin === 0 && row.sheet === 'pumice' && row.floor === 'pumice-floor' && row.dig === 1 && row.worth === 1 && row.rich === 1, `the drift's row: ${JSON.stringify({ ...row, pocket: undefined })}`);
  check(row.haz === null && row.haz2 === null && row.freeze === 0 && row.gen === null && row.lay === null && row.extras.length === 0, 'the drift has a hazard, a freeze or thresholds of its own');
  check(JSON.stringify(row.gloom) === '[6,10,22]' && JSON.stringify(row.mote) === '["#7fd0ff","rise"]' && JSON.stringify(row.map) === '[168,160,180]', 'the drift\'s dark, motes or colour on the map are not the ones written');
  check(P.shape === 'drift' && P.kins === 'any' && P.minR === 170 && JSON.stringify(P.rho) === '[9,30]' && P.weight === 1 && P.wobble === false && P.twist === 'drift' && P.chain === true && P.mineral === 'aerolite' && P.kind === K.MINERAL && P.node === undefined,
    `the drift's pocket: ${JSON.stringify(P)}`);
  check(P.lump === 2 && P.spec === 0.9 && P.pip === '#7fd0ff', `what the drift's aerolite pays: lump ${P.lump}, ${P.spec} specimens`);
  check(Math.abs(digTime(K.SOFT, row) - 0.24) < 1e-9 && Math.abs(digTime(K.MINERAL, row) - 0.45) < 1e-9, 'pumice or aerolite does not cut in the time written');
  check(boulders(5) === 0.8 && Math.abs(boulders(13) - 0.4) < 1e-9 && Math.abs(boulders(26) - 0.2) < 1e-9, `the share of squares with a boulder: ${boulders(5)}, ${boulders(13)}, ${boulders(26)}`);
  // (No other pocket's row has the drift's twist or its chain.)
  for (const other of BIOMES) if (other && other.pocket && other.id !== 33 && other.id < 120) check(other.pocket.twist !== 'drift' && !other.pocket.chain, `${other.name} has the drift's twist or a chain`);
}

const w = new World();
let drifts = 0, heralds = 0, rocks = 0, cells = 0, minerals = 0, stray = 0, sizes = new Array(20).fill(0), badSize = 0, badCore = 0, apart = 0, wide = 0, outOfSquare = 0, narrow = 0, pebbles = 0, nearWall = 0, held = 0, few = 0, heraldOdd = 0, unlisted = 0;
let squares = 0, taken = 0, wanted = 0;
const perRadius = [[], [], [], []];
for (const seed of [1, 7, 34, 99]) {
  w.reset(seed);
  for (const Z of w.pocketsWithin(2300).filter(Z => Z.row === 33)) {
    drifts++;
    const most = Math.ceil(Z.reach) + 3, list = driftBoulders(seed, Z), at = `seed ${seed}: the drift at ${Z.cx - C},${Z.cy - C}`;
    check(Z.reach === Z.rho && Z.wobble === false, `${at} is said to run ${Z.reach} cells from its middle with radius ${Z.rho}`);
    // Every cell of the drift, from the world itself: its solid cells gathered into pieces joined side to side.
    const solid = new Map();
    for (let y = Z.cy - most; y <= Z.cy + most; y++) for (let x = Z.cx - most; x <= Z.cx + most; x++) {
      const mine = w.biomeAt(x, y) === 33, inside = (x - Z.cx) ** 2 + (y - Z.cy) ** 2 < Z.rho * Z.rho;
      if (mine !== inside) stray++;
      if (!mine) continue;
      const k = w.kindAt(x, y, 33);
      cells++;
      if (k !== K.EMPTY && k !== K.SOFT && k !== K.MINERAL) stray++;
      if (k !== K.EMPTY) solid.set(y * N + x, k);
    }
    const seen = new Set(), pieces = [];
    for (const i of solid.keys()) {
      if (seen.has(i)) continue;
      const piece = [i]; seen.add(i);
      for (const c of piece) for (const s of [1, N, -1, -N]) if (solid.has(c + s) && !seen.has(c + s)) { seen.add(c + s); piece.push(c + s); }
      pieces.push(piece);
    }
    if (pieces.length !== list.length) apart++;
    if (list.length < 4) few++;
    if (Z.herald) { heralds++; if (list.length !== 4) heraldOdd++; }
    let held0 = 0;
    for (const piece of pieces) {
      rocks++;
      const xs = piece.map(i => i % N), ys = piece.map(i => Math.floor(i / N)), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const core = piece.filter(i => solid.get(i) === K.MINERAL).length;
      minerals += core; held0 += core;
      sizes[Math.min(19, piece.length)]++;
      if (piece.length < 2 || piece.length > 12) badSize++;
      if (piece.length < 4) pebbles++;
      if (core < 1 || core > 4) badCore++;
      if (x1 - x0 > 3 || y1 - y0 > 3 || (x1 === x0 && y1 === y0)) wide++;
      // Its square: the seven cells each way that begin a whole number of sevens from the drift's middle cell. The
      // boulder lies on the third to the sixth of them, so three lanes of cells between it and the next are open.
      const gx = Math.floor((x0 - Z.cx) / 7), gy = Math.floor((y0 - Z.cy) / 7);
      if (x0 - Z.cx - 7 * gx < 2 || x1 - Z.cx - 7 * gx > 5 || y0 - Z.cy - 7 * gy < 2 || y1 - Z.cy - 7 * gy > 5) outOfSquare++;
      // The one the tools list for that square: its middle in the square's middle cell, its cells within its radius.
      const mine = list.find(([bx, by]) => Math.floor((bx - Z.cx) / 7) === gx && Math.floor((by - Z.cy) / 7) === gy);
      if (!mine || mine[0] - Z.cx - 7 * gx < 3 || mine[0] - Z.cx - 7 * gx >= 4 || mine[1] - Z.cy - 7 * gy < 3 || mine[1] - Z.cy - 7 * gy >= 4 || mine[2] > 1.8 || mine[2] < 0.9
        || piece.some(i => Math.hypot(i % N - mine[0], Math.floor(i / N) - mine[1]) >= mine[2])) unlisted++;
      for (const i of piece) {
        const x = i % N, y = Math.floor(i / N);
        // Three cells of open ground, or more, between it and any other boulder: nothing of another within three
        // cells of it either way.
        for (let v = -3; v <= 3; v++) for (let u = -3; u <= 3; u++) if (solid.has(i + v * N + u) && !piece.includes(i + v * N + u)) narrow++;
        // And two between it and the wall: the cells one and two away, to each side, are the drift's own.
        for (const [u, v] of [[1, 0], [2, 0], [-1, 0], [-2, 0], [0, 1], [0, 2], [0, -1], [0, -2]]) if (w.biomeAt(x + u, y + v) !== 33) nearWall++;
      }
    }
    perRadius[Z.rho < 12 ? 0 : Z.rho < 18 ? 1 : Z.rho < 24 ? 2 : 3].push(held0 / Z.rho);
    // The squares that could hold one, beyond the four round the middle: their share is `boulders`.
    for (let gy = -6; gy < 6; gy++) for (let gx = -6; gx < 6; gx++) {
      if ((gx === 0 || gx === -1) && (gy === 0 || gy === -1)) continue;
      // (A square is counted where a boulder's heart would fit wherever in its middle cell it lay.)
      const mx = 7 * gx + (gx < 0 ? 3 : 4), my = 7 * gy + (gy < 0 ? 3 : 4);
      if (Math.hypot(mx, my) + 0.9 + 2 > Z.rho) continue;
      squares++; wanted += boulders(Z.rho);
      if (list.some(([bx, by]) => Math.floor((bx - Z.cx) / 7) === gx && Math.floor((by - Z.cy) / 7) === gy)) taken++;
    }
  }
  // As the world itself lays them: the boulders of this world's nearest drifts hang on nothing.
  for (const Z of w.pocketsWithin(700).filter(Z => Z.row === 33)) {
    for (const [bx, by] of driftBoulders(seed, Z)) {
      const x = Math.round(bx), y = Math.round(by);
      // (The cell at its middle is its own; the first open cell west of that is where the walk begins.)
      let u = x;
      while (w.k(y * N + u) !== K.EMPTY) u--;
      if (!w.isle(y * N + u + 1, 2, 600)) held++;
    }
  }
}
const mean = list => list.reduce((a, b) => a + b, 0) / (list.length || 1), big = sizes[12] / rocks;
check(drifts > 800 && heralds === 8 && rocks > 4000, `${drifts} drifts looked at, ${heralds} of them a direction's first, ${rocks} boulders`);
check(stray === 0, `${stray} cells are a drift's and outside its disc, or inside it and not open, pumice or aerolite`);
check(apart === 0 && unlisted === 0, `${apart} drifts have another count of pieces than of boulders listed; ${unlisted} boulders are not the one listed for their square`);
check(badSize === 0 && badCore === 0 && wide === 0 && pebbles < rocks * 0.01, `${badSize} boulders are not 2 to 12 cells, ${pebbles} are under 4, ${badCore} have no aerolite or more than 4 cells of it, ${wide} are not two to four cells across`);
check(big < 0.05 && sizes[12] > 0, `${(big * 100).toFixed(1)} boulders in a hundred are 12 cells, too big for a light haul`);
check(outOfSquare === 0 && narrow === 0, `${outOfSquare} boulders leave the middle of their squares; ${narrow} cells lie within three of another boulder`);
check(nearWall === 0, `${nearWall} cells of a boulder are within two cells of the cavern's wall`);
check(held === 0, `${held} boulders hang on something as the world lays them`);
check(few === 0 && heraldOdd === 0, `${few} drifts have fewer than four boulders; ${heraldOdd} of the directions' first have not exactly four`);
check(squares > 5000 && Math.abs(taken - wanted) < wanted * 0.06, `${taken} of ${squares} squares away from the middle hold a boulder, where their drifts' shares come to ${wanted.toFixed(0)}`);
// What a drift holds for each cell of its radius, small and great: it does not grow with the radius.
const per = perRadius.map(mean);
check(per.every(p => p > 0.6 && p < 1.5) && per[3] < per[0] * 1.3, `aerolite for each cell of radius, in drifts under 12, 18, 24 and over: ${per.map(p => p.toFixed(2))}`);
out.counted = { drifts, rocks, cells, minerals, squares, taken, sizes: sizes.slice(2, 13), twelve: +(big * 100).toFixed(1) }; out.aerolitePerRadius = per.map(p => +p.toFixed(2));

console.log(JSON.stringify(out));
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: a drift is an open disc with boulders of up to 12 cells in it, each in its own square with lanes of three cells between and two to the wall, hanging on nothing, four at the least and fewer to a square the bigger the drift');
process.exit(fails.length ? 1 : 0);
