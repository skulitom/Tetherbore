// The ash flat as it lies in the ground (docs/CONTENT-PLAN.md, content item 7; js/world.js: POCKET_SHAPES.ash,
// tektites, and the flat's row). Checked on the world's own cells, in the ash flats of four worlds:
//   - the row: the south's, from 170 cells out, 8 to 30 in radius, ash that cuts in a fifth of the time and is
//     worth nothing, a mineral that cuts as quick, and what it pays;
//   - a flat is a disc whose edge wanders (every cell within 0.8 of its radius is its own, none beyond 1.2), all of
//     it ash but for single cells of tektite: no open cell, no ore, nothing else;
//   - the tektites are scattered a cell at a time: one cell in ten in a flat of up to 21 cells in radius, and
//     `tektites(rho)` of them in a bigger one, fewer as its radius grows; a cell's being one says nothing of the
//     cell beside it;
//   - every flat lies in the south.
// What each cell is, cell for cell, test/regress/w-same-world.mjs holds; what a flat pays, test/regress/s4-budget.mjs.
//   node test/regress/c7-ash-laid.mjs
import { World, N, C, K, B, BIOMES, tektites, digTime } from '../../js/world.js';

const fails = [], check = (ok, what) => { if (!ok && fails.length < 16) fails.push(what); };
const out = {};

// ---- the row
{
  const row = BIOMES[34], P = row.pocket;
  check(row.name === 'ash' && row.title === 'ASH FLATS' && row.kin === B.EMBER && row.sheet === 'ash' && row.floor === 'ash-floor' && row.dig === 0.2 && row.worth === 0 && row.rich === 1, `the flat's row: ${JSON.stringify({ ...row, pocket: undefined })}`);
  check(row.haz === null && row.haz2 === null && row.freeze === 0 && row.gen === null && row.lay === null && row.extras.length === 0, 'the flat has a hazard, a freeze or thresholds of its own');
  check(JSON.stringify(row.gloom) === '[14,14,16]' && JSON.stringify(row.mote) === '["#d0d0d0","fall"]' && JSON.stringify(row.map) === '[196,196,192]', 'the flat\'s dark, motes or colour on the map are not the ones written');
  check(P.shape === 'ash' && JSON.stringify(P.kins) === '[2]' && P.minR === 170 && JSON.stringify(P.rho) === '[8,30]' && P.weight === 1 && P.wobble === true && !P.twist && !P.chain && P.mineral === 'tektite' && P.kind === K.MINERAL && P.node === undefined,
    `the flat's pocket: ${JSON.stringify(P)}`);
  check(P.lump === 0.5 && P.spec === 0.2 && P.pip === '#d0d0d0', `what the flat's tektite pays: lump ${P.lump}, ${P.spec} specimens`);
  // Ash is gone in a twentieth of a second with the first bit, and a tektite in under a tenth: the row's `dig`
  // scales the mineral's time as it does the rock's.
  check(Math.abs(digTime(K.SOFT, row) - 0.048) < 1e-9 && Math.abs(digTime(K.MINERAL, row) - 0.09) < 1e-9, `ash cuts in ${digTime(K.SOFT, row)} s and a tektite in ${digTime(K.MINERAL, row)}`);
  check(tektites(8) === 0.1 && tektites(21) === 0.1 && Math.abs(tektites(30) - 0.07) < 1e-9, `the share of cells that are tektite: ${tektites(8)}, ${tektites(21)}, ${tektites(30)}`);
}

const w = new World();
let flats = 0, cells = 0, other = 0, inner = 0, outer = 0, north = 0, pairs = 0, both = 0, small = [0, 0], great = [0, 0, 0];
for (const seed of [1, 7, 34, 99]) {
  w.reset(seed);
  for (const Z of w.pocketsWithin(2300).filter(Z => Z.row === 34)) {
    flats++;
    if (Z.kin !== B.EMBER || Z.cy - C < Math.abs(Z.cx - C)) north++;
    const most = Math.ceil(Z.rho * 1.2) + 2, tek = new Set();
    let mine = 0;
    for (let y = Z.cy - most; y <= Z.cy + most; y++) for (let x = Z.cx - most; x <= Z.cx + most; x++) {
      const d = Math.hypot(x - Z.cx, y - Z.cy), ash = w.biomeAt(x, y) === 34;
      if (d < Z.rho * 0.8 - 1e-6 && !ash) inner++;
      if (d >= Z.rho * 1.2 && ash) outer++;
      if (!ash) continue;
      const k = w.kindAt(x, y, 34);
      cells++; mine++;
      if (k !== K.SOFT && k !== K.MINERAL) other++;
      if (k === K.MINERAL) tek.add(y * N + x);
    }
    if (Z.rho <= 21) { small[0] += mine; small[1] += tek.size; } else { great[0] += mine; great[1] += tek.size; great[2] += mine * tektites(Z.rho); }
    // Scattered: of the cells east of a tektite, as many are tektite as of any cells.
    for (const i of tek) { pairs++; if (tek.has(i + 1)) both++; }
  }
}
check(flats > 150 && cells > 100000, `${flats} ash flats looked at, ${cells} cells`);
check(north === 0, `${north} ash flats lie outside the south`);
check(other === 0, `${other} cells of an ash flat are neither ash nor tektite`);
check(inner === 0 && outer === 0, `${inner} cells within 0.8 of a flat's radius are not its own, ${outer} beyond 1.2 of it are`);
check(Math.abs(small[1] / small[0] - 0.1) < 0.006, `${(small[1] / small[0] * 100).toFixed(2)} cells in a hundred are tektite in flats of up to 21 cells in radius, not 10`);
check(great[0] > 20000 && Math.abs(great[1] - great[2]) < great[2] * 0.05 && great[1] / great[0] < 0.092, `in greater flats ${great[1]} cells are tektite, where their shares come to ${great[2].toFixed(0)}: ${(great[1] / great[0] * 100).toFixed(2)} in a hundred`);
check(Math.abs(both / pairs - 0.095) < 0.02, `${(both / pairs * 100).toFixed(1)} tektites in a hundred have a tektite east of them`);
out.counted = { flats, cells, small: +(small[1] / small[0] * 100).toFixed(2), great: +(great[1] / great[0] * 100).toFixed(2), beside: +(both / pairs * 100).toFixed(1) };

console.log(JSON.stringify(out));
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: an ash flat is a disc of ash in the south with tektites scattered through it a cell at a time, one cell in ten and fewer in the greatest');
process.exit(fails.length ? 1 : 0);
