// Crackling ribs, as the ground is laid (docs/CONTENT-PLAN.md, content item 2; js/world.js: HAZARDS.spark.ribs, RIB
// and the hazard lines of `kindAt`): in every ground with charged crystals, crystals stud the flanks of slate.
//   - every ground with crystals has the figure, 0.2 times its own rate (loess half, the deep east nearly twice), as
//     its first hazard or its second, and a ground with none has none;
//   - laid with the ribs and without, the ground differs in nothing but rock and ore turned to crystals, and most
//     of those stand against slate: nine in ten beside a rib in the east's own ground, seven in ten beside a level
//     bed in redrock (a bed's flank is wide where the bed thins out);
//   - so half the east's crystals stand beside slate where a quarter did, and one arc among them (each crystal
//     setting off those within three cells and shattering the slate round itself, as the game's `zap` does) takes
//     a run of slate: eight cells in the east's own ground where it took three;
//   - loess keeps few crystals;
//   - crystals that are a ground's second hazard stud its slate the same way, as K.HAZARD2.
// What each cell is, cell for cell, test/regress/w-same-world.mjs holds.
//   node test/regress/c2-ribs-laid.mjs
import { world } from '../harness.mjs';
import { count, provinces, mean, median } from '../../tools/strains.mjs';
const { World, C, K, B, BIOMES, HAZARDS, PROVINCE, biome } = world;

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const near = (a, b) => Math.abs(a - b) < 1e-9;
check(HAZARDS.spark.ribs === 0.2 && !HAZARDS.lava.ribs && !HAZARDS.spore.ribs, `the share of a rib's flank that is crystal is ${HAZARDS.spark.ribs}`);
for (const [id, want] of [[4, 0.2], [8, 0.36], [23, 0.2], [24, 0.1]]) check(near(BIOMES[id].lay.ribs, want) && BIOMES[id].lay.ribs2 === 0, `${BIOMES[id].name}: crystals are ${BIOMES[id].lay.ribs} of its ribs' flanks, not ${want}`);
for (const row of BIOMES) if (row && row.lay && row.haz?.type !== 'spark') check(row.lay.ribs === 0 && row.lay.ribs2 === 0, `${row.name} has no crystals and ribs of ${row.lay.ribs}`);

// What is counted in real provinces (tools/strains.mjs), before the rows for this test alone are made.
const counts = count(8), said = {};
for (const id of [4, 23, 24]) {
  const t = counts.get(id), name = BIOMES[id].name;
  if (!(t?.windows >= 8)) { check(false, `only ${t?.windows ?? 0} provinces of ${name} were counted`); continue; }
  said[name] = { crystals: +(t.kind[K.HAZARD] / t.cells * 100).toFixed(2), besideSlate: +(t.arcs.beside / t.kind[K.HAZARD]).toFixed(2), anArcSetsOff: +mean(t.arcs.set).toFixed(1), shatters: +mean(t.arcs.slate).toFixed(1), halfShatter: median(t.arcs.slate) };
}
if (!fails.length) {
  const lode = said.lode, redrock = said.redrock, loess = said.loess;
  check(lode.besideSlate > 0.42 && redrock.besideSlate > 0.38, `${(lode.besideSlate * 100).toFixed(0)} in a hundred of the east's crystals stand beside slate, and ${(redrock.besideSlate * 100).toFixed(0)} of redrock's: the flanks are not studded`);
  check(lode.shatters >= 6.5 && lode.halfShatter >= 5 && redrock.shatters >= 6 && redrock.halfShatter >= 5, `one arc beside slate shatters ${lode.shatters} cells of it in the east's own ground (half of them ${lode.halfShatter} or more) and ${redrock.shatters} in redrock (${redrock.halfShatter}): a rib does not unzip`);
  check(lode.crystals > 2.4 && lode.crystals < 3.5 && redrock.crystals > 2.3 && redrock.crystals < 3.4, `crystals are ${lode.crystals} cells in a hundred of the east's own ground and ${redrock.crystals} of redrock: not about 3`);
  check(loess.crystals < lode.crystals * 0.7, `loess has ${loess.crystals} crystals in a hundred, the east's own ${lode.crystals}: not few`);
}

// Rows for this test alone: the east's own ground and redrock with no ribs, and the north's own ground with
// crystals for a second hazard.
const SIZE = 96, w = new World();
const bare = { 4: biome({ ...BIOMES[4], id: 120, name: 'test-lode-bare', sheet: 'lode', floor: 'lode-floor', haz: { ...BIOMES[4].haz, ribs: 0 } }),
  23: biome({ ...BIOMES[23], id: 121, name: 'test-redrock-bare', sheet: 'redrock', floor: 'lode-floor', haz: { ...BIOMES[23].haz, ribs: 0 } }) };
const second = biome({ ...BIOMES[B.FROST], id: 122, name: 'test-frost-spark', sheet: 'frost', floor: 'frost-floor', haz2: { type: 'spark', rate: 0.6 } });
bare[122] = biome({ ...BIOMES[B.FROST], id: 123, name: 'test-frost-spark-bare', sheet: 'frost', floor: 'frost-floor', haz2: { type: 'spark', rate: 0.6, ribs: 0 } });
check(bare[4].lay.ribs === 0 && near(second.lay.ribs2, 0.12) && second.lay.ribs === 0, `a row's own ribs, or a second hazard's: ${bare[4].lay.ribs}, ${second.lay.ribs2}`);
const tally = () => ({ cells: 0, added: 0, moved: 0, against: 0, bareBeside: 0, bareCrystals: 0, bareSlate: [] });
const T = { 4: tally(), 23: tally(), 122: tally() };
for (let seed = 1; seed <= 4; seed++) {
  w.reset(seed);
  const grid = new Int16Array(SIZE * SIZE), plain = new Int16Array(SIZE * SIZE);
  for (const [px, py, , ground] of provinces(w)) {
    const lay = ground === 4 || ground === 23 ? [ground, bare[ground].id, K.HAZARD] : ground === B.FROST ? [122, 123, K.HAZARD2] : null;
    if (!lay) continue;
    const [as, without, crystal] = lay, t = T[as], x0 = C + Math.round((px + 0.5) * PROVINCE) - SIZE / 2, y0 = C + Math.round((py + 0.5) * PROVINCE) - SIZE / 2;
    for (let v = 0; v < SIZE; v++) for (let u = 0; u < SIZE; u++) { grid[v * SIZE + u] = w.kindAt(x0 + u, y0 + v, as); plain[v * SIZE + u] = w.kindAt(x0 + u, y0 + v, without); }
    t.cells += SIZE * SIZE;
    const slateBy = (of, s) => { const x = s % SIZE, y = (s / SIZE) | 0; for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) if (x + u >= 0 && y + v >= 0 && x + u < SIZE && y + v < SIZE && of[(y + v) * SIZE + x + u] === K.SLATE) return true; return false; };
    for (let s = 0; s < SIZE * SIZE; s++) {
      const k = grid[s], was = plain[s];
      if (was === crystal) { t.bareCrystals++; if (slateBy(plain, s)) t.bareBeside++; }
      if (k === was) continue;
      if (k !== crystal || (was !== K.SOFT && was !== K.DENSE && was !== K.ORE_A && was !== K.ORE_B)) { t.moved++; continue; }
      t.added++; t.against += slateBy(grid, s);
    }
  }
}
for (const [id, t] of Object.entries(T)) {
  const name = BIOMES[id].name;
  if (!(t.cells >= 3 * SIZE * SIZE)) { check(false, `too little ${name} was counted: ${t.cells} cells`); continue; }
  said[`${name}, with and without`] = { added: +(t.added / t.cells * 100).toFixed(2), againstSlate: +(t.against / t.added).toFixed(2), bareBesideSlate: t.bareCrystals ? +(t.bareBeside / t.bareCrystals).toFixed(2) : undefined };
  check(t.moved === 0, `${name}: the ribs moved ${t.moved} cells that are not rock or ore turned to crystals`);
  // (The north's slate is thinner than the east's and its second hazard is laid at rate 0.6: fewer are added.)
  const [least, most, against] = +id === 122 ? [0.004, 0.012, 0.7] : [0.008, 0.018, +id === 23 ? 0.62 : 0.8];
  check(t.added / t.cells > least && t.added / t.cells < most, `${name}: the ribs added ${(t.added / t.cells * 100).toFixed(2)} cells of crystal in a hundred, not ${least * 100} to ${most * 100}`);
  check(t.against / t.added > against, `${name}: only ${(t.against / t.added * 100).toFixed(0)} in a hundred of the crystals the ribs added stand against slate`);
  check(t.bareBeside / t.bareCrystals < 0.32, `${name} laid with no ribs: ${(t.bareBeside / t.bareCrystals * 100).toFixed(0)} in a hundred of its crystals stand beside slate all the same`);
}

console.log(JSON.stringify(said));
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: crystals stud the flanks of slate in every ground that has crystals, taking only rock and ore, and one arc among them takes a run of slate');
process.exit(fails.length ? 1 : 0);
