// The seams (js/world.js: `biomeAt` rule 4, SEAMS, `setPiece`), as they lie in the world of generation 2, on worlds 1
// to 8. On each diagonal, where two directions meet, a ground of its own:
//   - each corner's: hoarstone in the north-east, glassdune in the south-east, cinderfen in the south-west, frostfen
//     in the north-west, and past the flanks' distance its deep seam (skarn, obsidian, tarpit, muskeg);
//   - it begins on the diagonal between 445 and 500 cells out and runs to the world's edge, broken only by pockets,
//     each of which is wholly its own ground;
//   - its half-width is the rule's: a cell that is nearer the diagonal than the half-width less what the borders'
//     sweep and the seam's wobble can move it (90 and 12) is the seam's, and one further than the half-width and
//     those is not: 0.12 of the distance from the core from 24 cells to 90, and past the flanks 0.09 of it to 180;
//   - it is a tenth of the ground or so from 600 cells out, and nothing nearer than 445;
//   - each seam has one set piece, where it begins, laid as written, standing in rock that holds it (nothing it lays
//     hangs on nothing), and its hearts are the seam's own hazards;
//   - in an older game's ground (generation 1) there is no seam and no set piece.
//   node test/regress/c10-seams-laid.mjs
import { World, N, C, K, SEAMS, SEAM_FROM, SET_FROM, SET_TO, BIOMES, rowOf, hazOf } from '../../js/world.js';

const fails = [], check = (ok, what) => { if (!ok && fails.length < 16) fails.push(what); };
const CORNER = [[1, -1], [1, 1], [-1, 1], [-1, -1]], NAMES = [['hoarstone', 'skarn'], ['glassdune', 'obsidian'], ['cinderfen', 'tarpit'], ['frostfen', 'muskeg']];
const KINS = [1, 4, 2, 3];
SEAMS.forEach(([a, b], c) => check(BIOMES[a].name === NAMES[c][0] && BIOMES[b].name === NAMES[c][1] && BIOMES[a].seam === c && BIOMES[b].seam === c && !BIOMES[a].deep && BIOMES[b].deep && BIOMES[a].kin === KINS[c] && BIOMES[b].kin === KINS[c],
  `corner ${c}'s seams are ${BIOMES[a].name} and ${BIOMES[b].name}`));
check(SEAM_FROM === 470 && SET_FROM === 480 && SET_TO === 640, 'the seams begin elsewhere');
const isSeam = (b, c) => b === SEAMS[c][0] || b === SEAMS[c][1];
const half = (r, deep) => deep ? Math.min(180, Math.max(90, 0.09 * r)) : Math.min(90, Math.max(24, 0.12 * r));
const sums = { starts: [], broken: 0, along: 0, inside: 0, insideNot: 0, outside: 0, outsideIs: 0, rings: [0, 0, 0, 0], ringCells: [0, 0, 0, 0], near: 0, setCells: 0 };
for (let seed = 1; seed <= 8; seed++) {
  const w = new World(); w.reset(seed);
  for (let c = 0; c < 4; c++) {
    const [ux, uy] = CORNER[c];
    // Along the diagonal: at each step out, across it to 110 cells either side (the borders it follows sweep 90
    // cells from the diagonal at the most, and its half-width is under that until 750 out), the seam is met, and
    // past 1,050 its deep seam; a step whose cells across are all a pocket's is left out.
    let start = 0;
    for (let k = 280; k <= 1660; k += 2) {
      const x = C + ux * k, y = C + uy * k, r = Math.SQRT2 * k;
      let met = false, deep = false, open = false;
      for (let t = -78; t <= 78 && !(met && deep); t++) {
        const b = w.biomeAt(x + t * ux, y - t * uy);
        if (rowOf(b).pocket === null) open = true;
        if (isSeam(b, c)) met = true;
        if (b === SEAMS[c][1]) deep = true;
      }
      if (!open) continue;
      if (!start) { if (met) start = r; else if (r > 510) { start = -1; break; } continue; }
      if (r > 520) { sums.along++; if (!met) sums.broken++; }
      if (r > 1050 && !deep) sums.broken++;
    }
    sums.starts.push(Math.round(start));
    // (The step out along the diagonal is a little nearer the core than the cell across it where the seam is met.)
    check(start >= 440 && start <= 500, `seed ${seed} corner ${c}: the seam begins ${Math.round(start)} cells out`);
    // The set piece, and what it lays.
    const sets = w.setPieces(), sx = sets[2 * c], sy = sets[2 * c + 1], r = Math.hypot(sx - C, sy - C);
    check(Number.isFinite(sx) && Math.abs(sx - C) === Math.abs(sy - C) && r >= SET_FROM && r <= SET_TO && w.biomeAt(sx, sy) === SEAMS[c][0], `seed ${seed} corner ${c}: its set piece is at ${sx - C},${sy - C}`);
    if (!Number.isFinite(sx)) continue;
    let cells = 0, hazards = 0;
    for (let y = sy - 5; y <= sy + 5; y++) for (let x = sx - 5; x <= sx + 5; x++) {
      const k = w.setPiece(x, y);
      if (k < 0) continue;
      cells++;
      check(w.k(y * N + x) === k, `seed ${seed} corner ${c}: the set piece's cell ${x - sx},${y - sy} is ${w.k(y * N + x)}, not ${k}`);
      if (k === K.HAZARD || k === K.HAZARD2) { hazards++; check(hazOf(k, w.row(y * N + x)) !== null, `seed ${seed} corner ${c}: the set piece's hazard at ${x - sx},${y - sy} is none its ground has`); }
    }
    sums.setCells += cells;
    check(hazards >= (c === 1 || c === 2 ? 10 : 1) && w.k(sy * N + sx) !== K.EMPTY, `seed ${seed} corner ${c}: the set piece lays ${hazards} hazards`);
    // Held by the world: the ground its heart is of runs on past 400 cells.
    check(w.follow(sy * N + sx, 400) === null, `seed ${seed} corner ${c}: the set piece's heart hangs on nothing`);
    // Nowhere else along the diagonal is there a set piece's cell.
    for (let k = 300; k <= 470; k++) { const x = C + ux * k, y = C + uy * k; if (Math.abs(x - sx) > 5 && w.setPiece(x, y) >= 0) check(false, `seed ${seed} corner ${c}: a set piece's cell at ${x - C},${y - C}`); }
  }
  // Across the diagonals: the half-width, and how much of each ring.
  for (let y = -2350; y <= 2350; y += 9) for (let x = -2350; x <= 2350; x += 9) {
    const r = Math.hypot(x, y);
    if (r > 2350) continue;
    const b = w.biomeAt(C + x, C + y), c = x > 0 ? (y < 0 ? 0 : 1) : (y > 0 ? 2 : 3), e = Math.abs(Math.abs(x) - Math.abs(y)), row = rowOf(b);
    if (r < 445 && b >= 9 && b <= 16) sums.near++;
    const ring = [[600, 800], [900, 1100], [1300, 1500], [1900, 2100]].findIndex(([a, z]) => r >= a && r < z);
    if (ring >= 0) { sums.ringCells[ring]++; if (b >= 9 && b <= 16) sums.rings[ring]++; }
    if (row.pocket || r < 520 || r > 2340) continue;
    // (Which of the two half-widths: the flanks' distance wanders 100 either way of 900.)
    if (r > 800 && r < 1000) continue;
    const w0 = half(r, r >= 1000);
    if (e < w0 - 103) { sums.inside++; if (!isSeam(b, c)) sums.insideNot++; }
    if (e > w0 + 103) { sums.outside++; if (b >= 9 && b <= 16) sums.outsideIs++; }
  }
  // Generation 1.
  const old = new World(); old.reset(seed); old.genOf.fill(1);
  check([...old.setPieces()].every(Number.isNaN), `seed ${seed}: generation 1 has a set piece`);
  let older = 0;
  for (let k = 300; k <= 1660; k += 3) for (const [ux, uy] of CORNER) { const b = old.biomeAt(C + ux * k, C + uy * k); if (b >= 9 && b <= 16) older++; }
  check(older === 0, `seed ${seed}: ${older} cells of the diagonals are a seam's at generation 1`);
}
const share = sums.rings.map((n, i) => n / sums.ringCells[i]);
console.log(JSON.stringify({ starts: sums.starts.join(), broken: sums.broken, along: sums.along, inside: [sums.inside, sums.insideNot], outside: [sums.outside, sums.outsideIs], rings: share.map(s => +(s * 100).toFixed(1)), setCells: sums.setCells }));
check(sums.broken === 0 && sums.along > 15000, `at ${sums.broken} of ${sums.along} steps out along the diagonals past 520 cells (and past 1,050, the deep seams) the seam is not met`);
check(sums.inside > 10000 && sums.insideNot === 0, `${sums.insideNot} of ${sums.inside} cells well within the half-width are not the seam's`);
check(sums.outside > 100000 && sums.outsideIs === 0, `${sums.outsideIs} of ${sums.outside} cells well beyond the half-width are a seam's`);
check(sums.near === 0, `${sums.near} cells under 445 cells out are a seam's`);
check(share.every(s => s > 0.06 && s < 0.16), `the seams are ${share.map(s => (s * 100).toFixed(1))} in a hundred of the rings at 700, 1,000, 1,400 and 2,000, not a tenth or so`);

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: a seam on each diagonal from 445 to 500 cells out to the edge, as wide as the rule, its set piece where it begins, and none in an older game\'s ground');
process.exit(fails.length ? 1 : 0);
