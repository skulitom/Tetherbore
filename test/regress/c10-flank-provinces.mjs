// The deep flanks broken into provinces, and the deep strains laid in them (js/world.js: `biomeAt` rule 5b,
// `flankProvince`, DEEP_STRAINS; grounds 64 to 67), in the world of generation 2, on worlds 1 to 8:
//   - each flank has its strain: the north's glacier, the south's caldera, the west's mycelium, the east's druse,
//     each of its flank's direction, deep ground, paying as a flank does, with its own ores, and where its ground
//     pays in other ways a little under it (the caldera, whose slag the lava it wakes quenches to steel, and the
//     druse, whose sectors of nothing are geodes, under their flanks' `rich`);
//   - a deep strain lies only where the flank test holds (where generation 1 lays the flank), only in its own
//     direction's flank, and only where its province's middle is 1,050 cells out or more (a province reaches 180
//     cells and more from its middle): none under 850, next to none under 1,000, about three in ten of the flank at
//     1,350 and six in ten from 1,650;
//   - a province is one ground for a direction: no province's cells of one direction are part strain, part flank;
//   - each has its tell: the glacier's halls with their walls sheathed in ice (and no free-standing pillar in them:
//     the sheath is only ever on a cell the halls leave, and a cell of it stands alone no oftener than a cell of
//     rock does in the noise of any ground's caves, one in a thousand or so), the caldera's lakes of lava in their slag, the mycelium's
//     hairline faults and caps on the rims of its caves, the druse's geodes; and what it plays by (`current`,
//     `glow`, `geodes`), and the flow of the air in the glacier and the caldera (`flowAt`), the same at every ask;
//   - at generation 1, the flank is its direction's flank everywhere.
//   node test/regress/c10-flank-provinces.mjs
import { World, C, K, B, BIOMES, DEEP_STRAINS, PROVINCE } from '../../js/world.js';

const fails = [], check = (ok, what) => { if (!ok && fails.length < 16) fails.push(what); };
const STRAIN = { 64: ['glacier', B.FROST], 65: ['caldera', B.EMBER], 66: ['mycelium', B.MIRE], 67: ['druse', B.LODE] };
for (const [id, [name, kin]] of Object.entries(STRAIN)) {
  const row = BIOMES[id];
  check(row?.name === name && row.kin === kin && row.deepOf === kin && row.deep && row.gemx === 2 && row.rich >= 1.8 && row.rich <= 2.2 && row.oreKeys.join() === `ores:${name}A,ores:${name}B` && DEEP_STRAINS[kin].includes(+id),
    `ground ${id} is not ${name}, the deep strain of direction ${kin}: ${row?.name}, kin ${row?.kin}, rich ${row?.rich}, ${row?.oreKeys}`);
}
check(BIOMES[65].rich < BIOMES[6].rich && BIOMES[67].rich < BIOMES[8].rich, `the caldera's rich is ${BIOMES[65].rich} against magma's ${BIOMES[6].rich}, the druse's ${BIOMES[67].rich} against gilt's ${BIOMES[8].rich}`);
check(BIOMES[64].current === 'wind' && BIOMES[65].current === 'heat' && BIOMES[66].glow && BIOMES[67].geodes && !BIOMES[5].current && !BIOMES[8].geodes, 'the deep strains do not say what they play by');
const bands = [[850, 1000], [1250, 1450], [1650, 2350]].map(([from, to]) => ({ from, to, n: 0, strain: 0 }));
const sums = { cells: 0, astray: 0, outsideFlank: 0, near: 0, split: 0, older: 0, sheath: 0, sheathFree: 0, lakes: 0, lakeSlag: 0, faults: 0, caps: 0, geodes: 0, met: new Set() };
for (let seed = 1; seed <= 8; seed++) {
  const w = new World(), old = new World(); w.reset(seed); old.reset(seed); old.genOf.fill(1);
  for (let y = -2350; y <= 2350; y += 7) for (let x = -2350; x <= 2350; x += 7) {
    const r = Math.hypot(x, y);
    if (r > 2340 || r < 850) continue;
    const b = w.biomeAt(C + x, C + y), was = old.biomeAt(C + x, C + y), row = BIOMES[b];
    if ((was >= 9 && was <= 16) || (was >= 64 && was <= 79)) sums.older++;
    if (was >= 5 && was <= 8) {
      const band = bands.find(t => r >= t.from && r < t.to);
      if (band && (b === was || row.deepOf)) { band.n++; if (row.deepOf) band.strain++; }
    }
    if (!row.deepOf) continue;
    sums.cells++; sums.met.add(b);
    if (was < 5 || was > 8) sums.outsideFlank++;
    else if (row.deepOf + 4 !== was) sums.astray++;
    if (r < 850) sums.near++;
  }
  // A province is one ground for each direction: asked of `flankProvince` itself over every province.
  for (let py = -10; py <= 9; py++) for (let px = -10; px <= 9; px++) for (let kin = 1; kin <= 4; kin++) {
    const a = w.flankProvince(px, py, kin), b = w.flankProvince(px, py, kin);
    if (a !== b || (a !== kin + 4 && BIOMES[a].deepOf !== kin)) sums.split++;
  }
  // The tells, in cells of each strain met: every cell of a few of their provinces' middles.
  for (let py = -9; py <= 8; py++) for (let px = -9; px <= 8; px++) {
    const mx = C + Math.round((px + 0.5) * PROVINCE), my = C + Math.round((py + 0.5) * PROVINCE), b = w.biomeAt(mx, my);
    if (!BIOMES[b]?.deepOf || Math.hypot(mx - C, my - C) > 2300) continue;
    for (let y = my - 24; y < my + 24; y++) for (let x = mx - 24; x < mx + 24; x++) {
      if (w.biomeAt(x, y) !== b) continue;
      const k = w.at(x, y);
      if (b === 64 && k === K.ICE) { sums.sheath++; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].every(([u, v]) => w.at(x + u, y + v) === K.EMPTY)) sums.sheathFree++; }
      if (b === 65 && k === K.HAZARD) sums.lakes++;
      if (b === 65 && k === K.SLAG) sums.lakeSlag++;
      if (b === 66 && k === K.FAULT) sums.faults++;
      if (b === 66 && k === K.CAP) sums.caps++;
      if (b === 67 && k === K.SLATE) sums.geodes++;
    }
  }
  // The flow of the air: of length 1 in the glacier's wind, straight up or none in the caldera's heat, none for any
  // other; the same at every ask, and into the world's own record.
  let wind = 0, heat = 0, still = 0;
  for (let n = 0; n < 400; n++) {
    const x = C + 900 + n * 7, y = C - 900 - n * 3, f = w.flowAt(x, y, 'wind'), fx = f.x, fy = f.y, again = w.flowAt(x, y, 'wind');
    if (f !== w.flow || again.x !== fx || again.y !== fy || Math.abs(Math.hypot(fx, fy) - 1) > 1e-9) wind++;
    const h = w.flowAt(x, y, 'heat');
    if (!((h.x === 0 && h.y === -1) || (h.x === 0 && h.y === 0))) heat++;
    if (h.y === -1) still++;
    const none = w.flowAt(x, y, null);
    if (none.x !== 0 || none.y !== 0) wind++;
  }
  check(wind === 0 && heat === 0 && still > 40 && still < 360, `seed ${seed}: the flow of the air is not as written (${wind} winds, ${heat} heats wrong, ${still} of 400 rising)`);
}
const share = bands.map(t => t.strain / t.n);
console.log(JSON.stringify({ cells: sums.cells, met: [...sums.met], bands: share.map(s => +(s * 100).toFixed(1)), sheath: [sums.sheath, sums.sheathFree], lakes: [sums.lakes, sums.lakeSlag], faults: sums.faults, caps: sums.caps, geodeSlate: sums.geodes }));
check([64, 65, 66, 67].every(b => sums.met.has(b)) && sums.cells > 20000, `the deep strains met: ${[...sums.met]}, in ${sums.cells} cells`);
check(sums.outsideFlank === 0 && sums.astray === 0, `${sums.outsideFlank} cells of a deep strain lie where generation 1 lays no flank, and ${sums.astray} in another direction's flank`);
check(sums.near === 0 && share[0] < 0.05, `${sums.near} cells of a deep strain lie under 850 cells out, and ${(share[0] * 100).toFixed(1)} in a hundred of the flank 850 to 1,000 out`);
check(share[1] > 0.15 && share[1] < 0.45 && share[2] > 0.45 && share[2] < 0.7, `the deep strains are ${share.map(s => (s * 100).toFixed(1))} in a hundred of the flanks 850 to 1,000, 1,250 to 1,450 and 1,650 to 2,350 out, not none, about three in ten and six in ten`);
check(sums.split === 0, `${sums.split} provinces of a flank are not one ground for a direction`);
check(sums.older === 0, `${sums.older} cells are a seam's or a deep strain's at generation 1`);
check(sums.sheath > 1000 && sums.sheathFree <= sums.sheath / 500, `the glacier's halls have ${sums.sheath} cells of ice on their walls, ${sums.sheathFree} of them standing free`);
check(sums.lakes > 500 && sums.lakeSlag > 300, `the caldera has ${sums.lakes} cells of lava and ${sums.lakeSlag} of slag`);
check(sums.faults > 200 && sums.caps > 200, `the mycelium has ${sums.faults} cells of fault and ${sums.caps} caps`);
check(sums.geodes > 200, `the druse has ${sums.geodes} cells of geodes' shells`);

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: far out the flanks are provinces, a share of them deep strains of their own direction, each with its tell, and none in an older game\'s ground');
process.exit(fails.length ? 1 : 0);
