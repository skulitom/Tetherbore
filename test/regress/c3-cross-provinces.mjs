// Where the generated ground lies (docs/CONTENT-PLAN.md, section 4 (a) and S3 step 6; js/world.js: `province`).
// A share of the provinces that are no deep flank is a cross of the direction's own ground (the host) with one of
// the other three (the donor) in one of five structures. Checked here, on forty seeds:
//   - the share is the rule's: none where a province's middle is under 500 cells out, then a part in 2,500 for
//     each cell further, and 0.35 from 1,375 on, never more;
//   - the host is the direction asked about; each of the three donors is given about as often as the others, and
//     each structure, but that lanes of ice are laid only where the host or the donor is the north (elsewhere the
//     province is the plain cross);
//   - crosses take nothing from the strains: with every pair switched off, each province that was a cross is its
//     direction's own ground and every other province is what it was; and a single pair switched off (the eye's
//     verdict, `CROSS_OK`) gives its provinces back to the host's own ground and moves no other;
//   - in cells: generated ground is never in the home ground or a deep flank, and hand-made ground is never
//     under 65 in a hundred of any ring of any seed's world (the owner: "make as many as we can manually").
//   node test/regress/c3-cross-provinces.mjs
import { World, BIOMES, B, PROVINCE, WORLD_R, DONORS, CROSS_OK, CROSS_FROM, CROSS_MOST, crossId } from '../../js/world.js';
import { shares } from '../../tools/crosses.mjs';

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const SEEDS = 40, SPAN = 9;
check(CROSS_FROM === 500 && CROSS_MOST === 0.35, `crosses begin ${CROSS_FROM} cells out and are ${CROSS_MOST} of the provinces at the most`);

// ---- provinces: every one of a world with its middle inside the world's edge, for each direction
const each = (seed, visit) => {
  const w = new World(); w.reset(seed);
  for (let py = -SPAN; py < SPAN; py++) for (let px = -SPAN; px < SPAN; px++) for (let kin = 1; kin <= 4; kin++) {
    const mx = (px + 0.5) * PROVINCE, my = (py + 0.5) * PROVINCE, rc = Math.sqrt(mx * mx + my * my);
    if (rc < WORLD_R) visit(w.province(px, py, kin), kin, rc, px, py);
  }
};
const BANDS = [[0, 500], [500, 800], [800, 1100], [1100, 1375], [1375, 1900], [1900, WORLD_R]];
const bands = BANDS.map(() => ({ n: 0, crosses: 0, rule: 0 }));
const donors = [null, {}, {}, {}, {}], shapes = { frosty: [0, 0, 0, 0, 0], other: [0, 0, 0, 0, 0] }, was = [];
let astray = 0, inner = 0, crazed = 0;
for (let seed = 1; seed <= SEEDS; seed++) each(seed, (b, kin, rc) => {
  const row = BIOMES[b], band = bands[BANDS.findIndex(([from, to]) => rc >= from && rc < to)];
  was.push(b);
  band.n++; band.rule += Math.min(0.35, Math.max(0, (rc - 500) / 2500));
  if (!row.cross) return;
  band.crosses++;
  if (rc < 500) inner++;
  const { host, donor, structure } = row.cross, frosty = host === B.FROST || donor === B.FROST;
  if (host !== kin || row.kin !== kin || b !== crossId(host, donor, structure)) astray++;
  donors[host][donor] = (donors[host][donor] ?? 0) + 1;
  shapes[frosty ? 'frosty' : 'other'][structure]++;
  if (structure === 2 && !frosty) crazed++;
});
const said = { bands: bands.map((t, n) => `${BANDS[n][0]}-${BANDS[n][1]}: ${(t.crosses / t.n * 100).toFixed(1)}% (rule ${(t.rule / t.n * 100).toFixed(1)}%)`) };
check(inner === 0 && bands[0].crosses === 0, `${inner} provinces with their middle under 500 cells out are crosses`);
check(astray === 0, `${astray} provinces were given a cross of another direction's ground than the one asked about`);
bands.forEach((t, n) => {
  if (!n) return;
  const got = t.crosses / t.n, rule = t.rule / t.n;
  check(t.n > 2000 && Math.abs(got - rule) < 0.02, `${BANDS[n][0]} to ${BANDS[n][1]} cells out: ${(got * 100).toFixed(1)} provinces in a hundred are crosses, the rule gives ${(rule * 100).toFixed(1)}`);
});
check(Math.abs(bands[4].rule / bands[4].n - 0.35) < 1e-9 && Math.abs(bands[5].rule / bands[5].n - 0.35) < 1e-9, 'the rule is not 0.35 from 1,375 cells out');
for (let host = 1; host <= 4; host++) {
  const got = DONORS[host].map(donor => donors[host][donor] ?? 0), all = got.reduce((a, b) => a + b, 0);
  check(all > 1500 && got.every(n => Math.abs(n / all - 1 / 3) < 0.03), `host ${host}: its three donors were given ${got} provinces, not a third each`);
}
{
  const f = shapes.frosty, o = shapes.other, fa = f.reduce((a, b) => a + b, 0), oa = o.reduce((a, b) => a + b, 0);
  said.structures = { whereTheNorthIsOne: f, elsewhere: o };
  check(fa > 3000 && f.every(n => Math.abs(n / fa - 0.2) < 0.02), `crosses with the north in them: the five structures were given ${f} provinces, not a fifth each`);
  check(oa > 3000 && crazed === 0 && o[2] === 0 && Math.abs(o[0] / oa - 0.4) < 0.025 && [1, 3, 4].every(s => Math.abs(o[s] / oa - 0.2) < 0.02), `crosses without the north: the structures were given ${o} provinces, not two fifths plain, no lanes of ice and a fifth each of the rest`);
}

// ---- the eye's verdict: pairs switched off
{
  const kept = CROSS_OK.map(list => list.slice());
  // One pair off: the west's ground crossed with the south's.
  CROSS_OK[B.MIRE][B.EMBER] = false;
  let n = 0, back = 0, moved = 0;
  for (let seed = 1; seed <= SEEDS; seed++) each(seed, (b, kin) => {
    const before = was[n++], row = BIOMES[before];
    if (row.cross?.host === B.MIRE && row.cross.donor === B.EMBER) { if (b === B.MIRE) back++; else moved++; }
    else if (b !== before) moved++;
  });
  check(back > 500 && moved === 0, `with one pair switched off, ${back} of its provinces are the host's own ground and ${moved} provinces are neither that nor what they were`);
  // All off: the world as it was before crosses.
  for (const list of CROSS_OK) list.fill(false);
  n = 0; back = 0; moved = 0;
  for (let seed = 1; seed <= SEEDS; seed++) each(seed, (b, kin) => {
    const before = was[n++];
    if (BIOMES[before].cross) { if (b === kin) back++; else moved++; } else if (b !== before) moved++;
  });
  check(back > 6000 && moved === 0, `with every pair switched off, ${back} provinces are their direction's own ground again and ${moved} are neither that nor what they were`);
  CROSS_OK.forEach((list, host) => kept[host].forEach((ok, donor) => { list[donor] = ok; }));
  n = 0; moved = 0;
  for (let seed = 1; seed <= 3; seed++) each(seed, b => { if (b !== was[n++]) moved++; });
  check(moved === 0, 'the provinces are not what they were once the pairs are switched on again');
}

// ---- cells: how much of each ring is generated
{
  const rings = shares(SEEDS);
  said.rings = rings.map(t => `${t.from}-${t.to}: ${(t.cross / t.cells * 100).toFixed(1)}% of all, ${(t.cross / (t.cells - t.deep) * 100).toFixed(1)}% of no deep flank, least hand-made ${(t.least * 100).toFixed(1)}%`);
  for (const t of rings) {
    check(t.least >= 0.65, `${t.from} to ${t.to} cells out: on one seed only ${(t.least * 100).toFixed(1)} cells in a hundred are hand-made`);
    check(t.cross / (t.cells - t.deep) <= CROSS_MOST + 0.04, `${t.from} to ${t.to} cells out: ${(t.cross / (t.cells - t.deep) * 100).toFixed(1)} in a hundred of the ground that is no deep flank is generated`);
  }
  // Near the core there is next to none (a province whose middle is just over 500 out reaches in to 330), and far
  // out about a third of what is no deep flank.
  check(rings[0].cross / rings[0].cells < 0.01, `220 to 500 cells out: ${(rings[0].cross / rings[0].cells * 100).toFixed(1)} cells in a hundred are generated`);
  const far = rings[4].cross + rings[5].cross, of = rings[4].cells - rings[4].deep + rings[5].cells - rings[5].deep;
  check(Math.abs(far / of - 0.35) < 0.04, `from 1,375 cells out: ${(far / of * 100).toFixed(1)} in a hundred of the ground that is no deep flank is generated, not 35`);
}
// (That no cell of the home ground or of a deep flank is a cross's, test/regress/s3-provinces.mjs holds, with the
// strains.)

console.log(JSON.stringify(said));
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: crosses are the share of provinces the rule gives, of the direction asked, with each donor and structure as often as the rule says, and hand-made ground is never under 65 in a hundred');
process.exit(fails.length ? 1 : 0);
