// Where places lie (docs/CONTENT-PLAN.md S3; js/world.js: biomeAt, province). Past the four pieces of ground round
// the core, each direction's ground is laid out in provinces 256 cells across, and a province may be a hand-made
// strain of its direction's ground. Checked here:
//   - the order of the rules: the home ground and the deep flanks are never a strain's, and the four provinces
//     round the core are their direction's own ground;
//   - a strain lies only in its own direction's ground;
//   - how many provinces are strains: two thirds of those that are not kept for crosses, a share that grows from
//     nothing under 500 cells out to 0.35 from 1,375 on; and each direction's two strains about as often as each
//     other;
//   - what a province is does not depend on what was asked before, and differs from seed to seed;
//   - a strain added later takes provinces only from the direction's own ground and from the other strains, never
//     moving a province from one of the older strains to the other.
//   node test/regress/s3-provinces.mjs
import { World, C, BIOMES, B, PROVINCE, HOME_R, DEEP_R, biome } from '../../js/world.js';

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
// The world as it was before provinces: every province its direction's own ground.
class Bare extends World { province(px, py, kin) { return kin; } }

// ---- cells: the order of the rules, and whose ground a strain lies in
let cells = 0, strains = 0, near = 0, inDeep = 0, inHome = 0, astray = 0, lost = 0, deep = 0;
const met = new Set();
for (const seed of [1, 7, 34]) {
  const w = new World(), bare = new Bare();
  w.reset(seed); bare.reset(seed);
  for (let y = -2300; y <= 2300; y += 13) for (let x = -2300; x <= 2300; x += 13) {
    const b = w.biomeAt(C + x, C + y), was = bare.biomeAt(C + x, C + y), strain = b >= 17 && b <= 31;
    cells++; met.add(b);
    // Ground that is a deep flank's wherever its borders wander: far enough out, and far enough from the middle
    // line of its direction (the borders wander 100 cells and 30 at the most).
    if (Math.sqrt(x * x + y * y) > DEEP_R + 101 && Math.min(Math.abs(x), Math.abs(y)) > Math.max(Math.abs(x), Math.abs(y)) * 0.36 + 31 && Math.sqrt(x * x + y * y) < 2390) { deep++; if (b < 5 || b > 8) inDeep++; }
    if (!strain) { if (b !== was) lost++; continue; }
    strains++;
    if (Math.max(Math.abs(x), Math.abs(y)) < PROVINCE - 60) near++;
    if (was === B.CRUST) inHome++; else if (was > 4) inDeep++; else if (BIOMES[b].kin !== was) astray++;
  }
  // Close in, every cell: the home ground and the four provinces round the core.
  for (let y = -195; y <= 195; y++) for (let x = -195; x <= 195; x++) {
    const b = w.biomeAt(C + x, C + y);
    if (b >= 17) near++;
    if (Math.sqrt(x * x + y * y) < HOME_R - 26 && b !== B.CRUST) inHome++;
  }
}
check(strains > cells * 0.08, `only ${strains} of ${cells} cells are a strain's: provinces are not laid`);
check([17, 18, 19, 20, 21, 22, 23, 24].every(id => met.has(id)), `not all eight strains were met: ${[...met].sort((a, b) => a - b)}`);
check(near === 0, `${near} cells of the four provinces round the core are a strain's`);
check(inHome === 0, `${inHome} cells of the home ground are not the home ground's`);
check(inDeep === 0 && deep > cells * 0.2, `${inDeep} of ${deep} cells of the deep flanks are not a deep flank's: strains never take the place of deep ground`);
check(astray === 0, `${astray} cells are a strain of another direction than the one they lie in`);
check(lost === 0, `${lost} cells that are no strain's are not what they were before provinces`);

// ---- provinces: how many are strains, and which
const share = { near: [0, 0], far: [0, 0] }, each = {};
let inner = 0;
for (let seed = 1; seed <= 40; seed++) {
  const w = new World(); w.reset(seed);
  for (let py = -9; py <= 8; py++) for (let px = -9; px <= 8; px++) for (let kin = 1; kin <= 4; kin++) {
    const mx = (px + 0.5) * PROVINCE, my = (py + 0.5) * PROVINCE, rc = Math.sqrt(mx * mx + my * my), b = w.province(px, py, kin);
    if (b !== kin && BIOMES[b].kin !== kin) astray++;
    if (rc < 220) { if (b !== kin) inner++; continue; }
    const band = rc <= 500 ? share.near : rc >= 1375 ? share.far : null;
    if (band) { band[0] += b !== kin; band[1]++; }
    if (b !== kin) each[b] = (each[b] ?? 0) + 1;
  }
}
const nearShare = share.near[0] / share.near[1], farShare = share.far[0] / share.far[1];
console.log(JSON.stringify({ cells, strains, provinces: { near: share.near, far: share.far }, nearShare: +nearShare.toFixed(3), farShare: +farShare.toFixed(3), each }));
check(inner === 0, `${inner} provinces with their middle under 220 cells out are a strain's`);
check(astray === 0, 'a province was given a strain of another direction');
check(Math.abs(nearShare - 2 / 3) < 0.05, `${(nearShare * 100).toFixed(1)}% of provinces under 500 cells out are strains, not two thirds`);
check(Math.abs(farShare - 0.65 * 2 / 3) < 0.03, `${(farShare * 100).toFixed(1)}% of provinces from 1,375 cells out are strains, not two thirds of the 65% that crosses leave`);
for (let kin = 1; kin <= 4; kin++) {
  const a = each[15 + kin * 2] ?? 0, b = each[16 + kin * 2] ?? 0;
  check(a + b > 500 && Math.abs(a / (a + b) - 0.5) < 0.06, `direction ${kin}: its two strains have ${a} and ${b} provinces, not about half each`);
}

// ---- the same whatever was asked before, and its own on every seed
{
  const one = new World(), two = new World(), other = new World();
  one.reset(7); two.reset(7); other.reset(8);
  const order = [];
  for (let py = -9; py <= 8; py++) for (let px = -9; px <= 8; px++) for (let kin = 1; kin <= 4; kin++) order.push([px, py, kin]);
  const first = order.map(p => one.province(...p)), again = order.map(p => one.province(...p));
  const back = order.slice().reverse().map(p => two.province(...p)).reverse(), elsewhere = order.map(p => other.province(...p));
  check(first.join() === again.join() && first.join() === back.join(), 'what a province is depends on what was asked before');
  check(first.join() !== elsewhere.join(), 'seeds 7 and 8 have the same provinces');
  // A world that has been asked about one seed and is given another forgets the first.
  one.reset(8);
  check(order.map(p => one.province(...p)).join() === elsewhere.join(), 'a world given a new seed kept the provinces of the old');
}

// ---- a strain added later
{
  const before = [], after = [];
  const all = list => { for (let seed = 1; seed <= 20; seed++) { const w = new World(); w.reset(seed); for (let py = -9; py <= 8; py++) for (let px = -9; px <= 8; px++) list.push(w.province(px, py, B.FROST)); } };
  all(before);
  biome({ ...BIOMES[17], id: 25, name: 'test-strain' });
  all(after);
  let taken = 0, wrong = 0, were = 0;
  for (let n = 0; n < before.length; n++) {
    if (before[n] !== B.FROST) were++;
    if (after[n] === 25) { taken++; if (before[n] === B.FROST) wrong++; }
    else if (after[n] !== before[n]) wrong++;
  }
  check(wrong === 0, `a third strain of the north moved ${wrong} provinces that it did not take for itself from a strain`);
  check(Math.abs(taken / were - 1 / 3) < 0.05, `a third strain of the north took ${taken} of the ${were} provinces that were strains, not a third`);
}

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: provinces lie past the four round the core, never in the home ground or a deep flank; two thirds of what crosses leave are strains of their own direction');
process.exit(fails.length ? 1 : 0);
