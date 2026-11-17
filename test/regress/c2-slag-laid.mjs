// Slag goes with lava wherever lava is laid (docs/CONTENT-PLAN.md, content item 2; js/world.js: HAZARDS.lava.rind and
// the last lines of `kindAt`): a rind of dull slag round each pocket, and half of the plain rock among the lava.
//   - every ground with lava has the figure (0.07; forge's own is 0.12), as its first hazard or its second, and a
//     ground with none has no slag: not a cell of it in the north, the west or the east;
//   - slag lies only where plain rock would: laid with the rind and without, the ground differs in nothing but
//     soft and dense rock turned to slag;
//   - it is a rind: two pockets of lava in three and more have slag against them, most slag lies within two cells
//     of lava, and there is about as much slag as lava (forge: nearly twice as much);
//   - a ground whose row says `rind: 0` has none.
// What each cell is, cell for cell, test/regress/w-same-world.mjs holds.
//   node test/regress/c2-slag-laid.mjs
import { world } from '../harness.mjs';
import { provinces } from '../../tools/strains.mjs';
const { World, C, K, B, BIOMES, HAZARDS, PROVINCE, biome } = world;

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
check(HAZARDS.lava.rind === 0.07 && !HAZARDS.spore.rind && !HAZARDS.spark.rind, `the rind that goes with lava is ${HAZARDS.lava.rind}`);
// (And the seams' and deep strains' of generation 2: cinderfen's and tarpit's lava as their first hazard, the
// caldera's in a thicker rind, glassdune's and obsidian's as their second.)
for (const [id, want] of [[2, 0.07], [6, 0.07], [19, 0.07], [20, 0.12], [11, 0.07], [15, 0.07], [65, 0.14]]) check(BIOMES[id].lay.rind === want && BIOMES[id].lay.rind2 === 0, `${BIOMES[id].name}: its rind of slag is ${BIOMES[id].lay.rind}, not ${want}`);
for (const id of [10, 14]) check(BIOMES[id].lay.rind === 0 && BIOMES[id].lay.rind2 === 0.07, `${BIOMES[id].name}: its second hazard's rind of slag is ${BIOMES[id].lay.rind2}`);
// (A cross that has lava from the south as its second hazard has the rind with it: test/regress/c3-cross-rows.mjs.)
for (const row of BIOMES) if (row && row.lay && row.haz?.type !== 'lava') check(row.lay.rind === 0 && row.lay.rind2 === (row.haz2?.type === 'lava' ? 0.07 : 0), `${row.name} has no lava of its own and a rind of ${row.lay.rind}, or ${row.lay.rind2} for its second hazard`);
// Rows for this test alone: the south's own with no rind, and the west's own with lava as a second hazard.
const bare = biome({ ...BIOMES[B.EMBER], id: 120, name: 'test-no-rind', sheet: 'ember', floor: 'ember-floor', haz: { ...BIOMES[B.EMBER].haz, rind: 0 } });
const both = biome({ ...BIOMES[B.MIRE], id: 121, name: 'test-mire-lava', sheet: 'mire', floor: 'mire-floor', haz2: { type: 'lava', rate: 1, t: 0.78 } });
check(bare.lay.rind === 0 && both.lay.rind === 0 && both.lay.rind2 === 0.07, `a row's own rind, or a second hazard's: ${bare.lay.rind}, ${both.lay.rind}, ${both.lay.rind2}`);

const SIZE = 96, w = new World(), said = {};
const T = () => ({ cells: 0, lava: 0, slag: 0, near: 0, pockets: 0, rinded: 0, moved: 0 });
const tally = { 2: T(), 6: T(), 19: T(), 20: T(), 121: T() }, elsewhere = {};
let bareSlag = 0;
for (let seed = 1; seed <= 6; seed++) {
  // (At generation 1, as an older game's ground is laid: in a new game's the windows on the diagonals deep in the
  // south are a deep seam's, and the flank's provinces a share of them the caldera's.)
  w.reset(seed); w.genOf.fill(1);
  // A window in the middle of each province between the core's four and the deep flanks, as tools/strains.mjs
  // counts them, and four in the south's deep flanks. (A window may hold a little of other ground, a pocket's or
  // the next province's: those cells are not this ground's, and are not counted.)
  const windows = provinces(w).map(([px, py, , ground]) => [ground, C + Math.round((px + 0.5) * PROVINCE) - SIZE / 2, C + Math.round((py + 0.5) * PROVINCE) - SIZE / 2]);
  windows.push([6, C + 1000, C + 1000], [6, C - 1000, C + 1100], [6, C + 1150, C + 1150], [6, C - 1150, C + 1150]);
  const grid = new Int16Array(SIZE * SIZE), mark = new Uint8Array(SIZE * SIZE);
  for (const [ground, x0, y0] of windows) {
    const row = BIOMES[ground], lava = row.haz?.type === 'lava' && !!tally[ground];
    let own = 0;
    for (let v = 0; v < SIZE; v++) for (let u = 0; u < SIZE; u++) { const b = w.biomeAt(x0 + u, y0 + v); grid[v * SIZE + u] = b === ground ? w.kindAt(x0 + u, y0 + v, b) : -1; own += b === ground; }
    if (!lava && row.haz?.type !== 'lava' && row.haz2?.type !== 'lava') { for (let s = 0; s < SIZE * SIZE; s++) if (grid[s] === K.SLAG) elsewhere[row.name] = (elsewhere[row.name] ?? 0) + 1; }
    if (own < SIZE * SIZE * 0.9) continue;
    // The same window laid as the west's own ground with lava for a second hazard, and as the south's with no rind.
    const lay = ground === B.MIRE ? [[121, tally[121], B.MIRE, K.HAZARD2]] : lava ? [[ground, tally[ground], 120, K.HAZARD]] : [];
    for (const [as, t, without, pocket] of lay) {
      if (as !== ground) for (let v = 0; v < SIZE; v++) for (let u = 0; u < SIZE; u++) grid[v * SIZE + u] = w.kindAt(x0 + u, y0 + v, as);
      t.cells += SIZE * SIZE;
      mark.fill(0);
      const is = (x, y, k) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && grid[y * SIZE + x] === k;
      for (let s = 0; s < SIZE * SIZE; s++) {
        const x = s % SIZE, y = (s / SIZE) | 0, k = grid[s];
        if (k < 0) continue;
        // Against the same ground laid without the rind (the south's own with `rind: 0`; the west's own with no
        // second hazard, where the lava itself is new too): nothing moved but plain rock turned to slag.
        if (ground === B.EMBER || as === 121) {
          const plain = w.kindAt(x0 + x, y0 + y, without);
          if (ground === B.EMBER) bareSlag += plain === K.SLAG;
          if (plain !== k && !(as === 121 && k === K.HAZARD2) && !(k === K.SLAG && (plain === K.SOFT || plain === K.DENSE))) t.moved++;
        }
        if (k === K.SLAG) {
          t.slag++;
          let near = false;
          for (let v = -2; v <= 2 && !near; v++) for (let u = -2; u <= 2; u++) if (is(x + u, y + v, pocket)) { near = true; break; }
          t.near += near;
        }
        if (k !== pocket) continue;
        t.lava++;
        if (mark[s]) continue;
        // A pocket: lava joined along sides and across corners. Has it slag against it?
        let rind = false;
        const stack = [s]; mark[s] = 1;
        while (stack.length) {
          const c = stack.pop(), cx = c % SIZE, cy = (c / SIZE) | 0;
          for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) {
            if (is(cx + u, cy + v, K.SLAG)) rind = true;
            const j = (cy + v) * SIZE + cx + u;
            if (is(cx + u, cy + v, pocket) && !mark[j]) { mark[j] = 1; stack.push(j); }
          }
        }
        t.pockets++; t.rinded += rind;
      }
    }
  }
}
check(!Object.keys(elsewhere).length, `there is slag in ground with no lava: ${JSON.stringify(elsewhere)}`);
check(bareSlag === 0, `the south's own ground laid with \`rind: 0\` has ${bareSlag} cells of slag`);
for (const [id, t] of Object.entries(tally)) {
  const name = BIOMES[id].name, pc = n => +(n / t.cells * 100).toFixed(2);
  said[name] = { lava: pc(t.lava), slag: pc(t.slag), slagNearLava: +(t.near / t.slag).toFixed(2), pocketsWithARind: +(t.rinded / t.pockets).toFixed(2) };
  if (!(t.cells >= 4 * SIZE * SIZE)) { check(false, `too little ${name} was counted: ${t.cells} cells`); continue; }
  check(t.moved === 0, `${name}: the rind moved ${t.moved} cells that were not soft or dense rock turned to slag`);
  check(t.slag > t.lava * (+id === 20 ? 1.4 : 0.7) && t.slag < t.lava * (+id === 20 ? 2.2 : 1.6), `${name}: ${pc(t.slag)} cells in a hundred are slag and ${pc(t.lava)} lava`);
  check(t.near / t.slag > 0.66, `${name}: only ${(t.near / t.slag * 100).toFixed(0)} in a hundred cells of slag lie within two cells of lava`);
  check(t.rinded / t.pockets > 0.66, `${name}: only ${(t.rinded / t.pockets * 100).toFixed(0)} in a hundred pockets of lava have slag against them`);
}
check(tally[20].slag / tally[20].cells > tally[2].slag / tally[2].cells * 1.5, 'forge has no thicker a rind of slag than the south\'s own ground');

console.log(JSON.stringify(said));
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: slag lies in a rind round the lava of every ground that has lava, only where plain rock would, and nowhere else');
process.exit(fails.length ? 1 : 0);
