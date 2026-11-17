// What a sector of finds holds is said by one hash of the sector, and its whole range is allotted once
// (docs/CONTENT-PLAN.md S3; js/world.js: FINDS, find, findSpot, findAt): a geode up to 0.38 and a cache up to 0.70
// as before, then a prism up to 0.74, twin stones up to 0.80, a fossil up to 0.86, and nothing above. Checked:
//   - the table, and how many sectors of each there are;
//   - geodes and caches are where they were before the rest were allotted, cell for cell;
//   - a prism never has its middle within 130 cells of the core, and no find within 16;
//   - every find's middle lies eight cells or more inside its own sector;
//   - a prism is laid (content item 5): one cell of prism at its middle and plain ore in the eight round it;
//   - the two that came last put nothing in the ground of an older game (generation 1: js/world.js, `genOf`), where
//     all of the above is asked;
//   - and in generation 2: twin stones are laid only where their middle is over 800 cells out, two cells of twin
//     stone three cells either side of the middle, each in a ring of dense rock; a fossil only over 1,200, four to
//     seven bones in a bed of dense rock, never more than four cells from the middle; nearer, both bands hold
//     nothing laid, as before, nor where a slab, a wreck, a relic's vault or a shrine could take a cell of one
//     (`findRoom`); and a druse's sectors (`geodes`) over 900 out hold a geode wherever they would hold
//     nothing, twin stones or a fossil, so 64 in a hundred of them are geodes; every other sector's find is where
//     it was at generation 1;
//   - a sector whose find would have its middle within five cells of where a pocket's cells can lie holds nothing
//     (pockets, content item 6): those sectors are counted apart, and the shares are of the rest;
//   - asking what a sector holds makes none of the world.
//   node test/regress/s3-find-bands.mjs
import { World, C, K, FIND, FINDS, SHRINES, cellHash as hash } from '../../js/world.js';

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
check(JSON.stringify(FINDS) === JSON.stringify([[0.38, 'geode'], [0.70, 'cache'], [0.74, 'prism'], [0.80, 'twin'], [0.86, 'fossil']]), `the bands are ${JSON.stringify(FINDS)}`);

// The finds as they were before the bands, written out plainly: a geode or a cache, and nothing else.
const was = (seed, sx, sy) => {
  const what = hash(sx, sy, seed + 21);
  if (what >= 0.7) return null;
  const fx = C + sx * FIND + 8 + Math.floor(hash(sx, sy, seed + 22) * (FIND - 16)), fy = C + sy * FIND + 8 + Math.floor(hash(sx, sy, seed + 23) * (FIND - 16));
  if (Math.sqrt((fx - C) * (fx - C) + (fy - C) * (fy - C)) < 16) return null;
  return what < 0.38 ? ['geode', fx, fy, hash(sx, sy, seed + 24) < 0.4 ? 4 : 3] : ['cache', fx, fy, 1];
};
const counts = { geode: 0, cache: 0, prism: 0, twin: 0, fossil: 0, null: 0 };
let sectors = 0, moved = 0, nearPrism = 0, nearAny = 0, outside = 0, laid = 0, unlaid = 0, checked = 0, far = 0, prisms = 0, badPrism = 0, pocketed = 0, inPocket = 0;
const w = new World();
for (const seed of [1, 7, 34]) {
  w.reset(seed); w.genOf.fill(1);
  for (let sy = -40; sy < 40; sy++) for (let sx = -40; sx < 40; sx++) {
    const [what, fx, fy, size] = w.findSpot(sx, sy), old = was(seed, sx, sy);
    // Where the find would lie, whatever it is, and whether a pocket is in its way.
    const mx = C + sx * FIND + 8 + Math.floor(hash(sx, sy, seed + 22) * (FIND - 16)), my = C + sy * FIND + 8 + Math.floor(hash(sx, sy, seed + 23) * (FIND - 16));
    if (hash(sx, sy, seed + 21) < 0.86 && w.meetsPocket(mx, my, 5)) { pocketed++; if (what !== null || w.findAt(mx, my) >= 0) inPocket++; continue; }
    sectors++; counts[what]++;
    if (JSON.stringify(old ?? [null, 0, 0, 0]) !== JSON.stringify(what === 'geode' || what === 'cache' ? [what, fx, fy, size] : [null, 0, 0, 0])) moved++;
    if (what === null) continue;
    const r = Math.sqrt((fx - C) * (fx - C) + (fy - C) * (fy - C)), ux = fx - C - sx * FIND, uy = fy - C - sy * FIND;
    if (r < 16) nearAny++;
    if (what === 'prism' && r <= 130) nearPrism++;
    if (ux < 8 || uy < 8 || ux >= FIND - 8 || uy >= FIND - 8) outside++;
    if (r > 200) far++;
    // What it puts in the ground: every twentieth sector, cell by cell.
    if ((sx * 7 + sy * 13 + seed) % 20) continue;
    checked++;
    let cells = 0;
    for (let v = 0; v < FIND; v++) for (let u = 0; u < FIND; u++) if (w.findAt(C + sx * FIND + u, C + sy * FIND + v) >= 0) cells++;
    if (what === 'geode' || what === 'cache') { if (cells === 0 || w.findAt(fx, fy) !== (what === 'cache' ? K.CACHE : size === 4 ? K.EMPTY : K.ORE_B)) unlaid++; }
    else if (what === 'prism') {
      prisms++;
      let ore = 0;
      for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) if ((u || v) && w.findAt(fx + u, fy + v) === K.ORE_A) ore++;
      if (cells !== 9 || w.findAt(fx, fy) !== K.PRISM || ore !== 8) badPrism++;
    } else if (cells) laid++;
  }
}
const share = name => counts[name] / sectors;
console.log(JSON.stringify({ sectors, counts, checked }));
check(w.made === 0, `asking what sectors hold made ${w.made} pieces of the world`);
check(moved === 0, `${moved} sectors' geodes and caches are not where they were before the bands`);
for (const [name, want] of [['geode', 0.38], ['cache', 0.32], ['prism', 0.04], ['twin', 0.06], ['fossil', 0.06], ['null', 0.14]]) check(Math.abs(share(name) - want) < 0.012, `${(share(name) * 100).toFixed(1)} sectors in a hundred hold ${name === 'null' ? 'nothing' : `a ${name}`}, not ${want * 100}`);
check(inPocket === 0 && pocketed > 100, `${inPocket} of the ${pocketed} sectors whose find a pocket is in the way of hold one all the same`);
check(nearAny === 0, `${nearAny} finds have their middle within 16 cells of the core`);
check(nearPrism === 0 && counts.prism > 300, `${nearPrism} prisms have their middle within 130 cells of the core`);
check(outside === 0 && far > sectors * 0.8, `${outside} finds have their middle outside their sector, or nearer its edge than eight cells`);
check(checked > 400 && unlaid === 0, `${unlaid} geodes or caches are not laid in the ground at their middle`);
check(prisms > 20 && badPrism === 0, `${badPrism} of ${prisms} prisms are not one cell of prism with plain ore in the eight cells round it`);
check(laid === 0, `${laid} sectors of twin stones or a fossil have cells laid by findAt at generation 1: an older game's ground is plain there`);
// Generation 2, out to the world's edge.
{
  const two = new World(), one = new World(), sum = { twins: 0, twinsNear: 0, fossils: 0, fossilsNear: 0, badTwin: 0, badFossil: 0, druse: 0, druseGeodes: 0, notDruse: 0, moved: 0 };
  for (const seed of [1, 7, 34]) {
    two.reset(seed); one.reset(seed); one.genOf.fill(1);
    for (let sy = -50; sy < 50; sy++) for (let sx = -50; sx < 50; sx++) {
      const [what, fx, fy] = two.findSpot(sx, sy), laidHere = two.asked.laid, druse = two.asked.druse, h = hash(sx, sy, seed + 21);
      const mx = C + sx * FIND + 8 + Math.floor(hash(sx, sy, seed + 22) * (FIND - 16)), my = C + sy * FIND + 8 + Math.floor(hash(sx, sy, seed + 23) * (FIND - 16)), r = Math.hypot(mx - C, my - C);
      if (r > 2350 || two.meetsPocket(mx, my, 5)) continue;
      const inDruse = r > 900 && two.biomeAt(mx, my) === 67;
      if (inDruse) { sum.druse++; if (what === 'geode') sum.druseGeodes++; if (h >= 0.74 && !(druse && what === 'geode')) sum.notDruse++; }
      // (Out of a druse a find is where it was, but by a shrine, whose clearance can take a pocket away.)
      else if (JSON.stringify(two.findSpot(sx, sy)) !== JSON.stringify(one.findSpot(sx, sy)) && !SHRINES.some(([x, y]) => Math.hypot(mx - C - x, my - C - y) < 200)) sum.moved++;
      if (what !== 'twin' && what !== 'fossil') continue;
      // (And only where nothing laid over a find could take a cell of it: js/world.js, `findRoom`.)
      const want = r > (what === 'twin' ? 800 : 1200) && two.findRoom(fx, fy);
      if (laidHere !== want) { if (what === 'twin') sum.badTwin++; else sum.badFossil++; continue; }
      if (!want) { if (what === 'twin') sum.twinsNear++; else sum.fossilsNear++; continue; }
      // What it lays, cell by cell, in the sector.
      const of = { [K.TWIN]: 0, [K.FOSSIL]: 0, [K.DENSE]: 0 };
      let far = 0, other = 0;
      for (let v = 0; v < FIND; v++) for (let u = 0; u < FIND; u++) {
        const x = C + sx * FIND + u, y = C + sy * FIND + v, k = two.findAt(x, y);
        if (k < 0) continue;
        if (k in of) of[k]++; else other++;
        far = Math.max(far, Math.abs(x - fx), Math.abs(y - fy));
      }
      if (what === 'twin') { sum.twins++; if (of[K.TWIN] !== 2 || of[K.DENSE] !== 16 || of[K.FOSSIL] || other || far !== 4) sum.badTwin++; }
      else { sum.fossils++; if (of[K.FOSSIL] < 4 || of[K.FOSSIL] > 7 || of[K.DENSE] < 8 || of[K.TWIN] || other || far > 4) sum.badFossil++; }
    }
  }
  console.log(JSON.stringify(sum));
  check(sum.twins > 300 && sum.twinsNear > 50 && sum.badTwin === 0, `twin stones: ${sum.twins} laid past 800, ${sum.twinsNear} nearer and not, ${sum.badTwin} laid where they should not be or not as they should be`);
  check(sum.fossils > 200 && sum.fossilsNear > 50 && sum.badFossil === 0, `fossils: ${sum.fossils} laid past 1,200, ${sum.fossilsNear} nearer and not, ${sum.badFossil} laid where they should not be or not as they should be`);
  check(sum.druse > 300 && sum.notDruse === 0 && Math.abs(sum.druseGeodes / sum.druse - 0.64) < 0.05, `of ${sum.druse} sectors of druse, ${sum.druseGeodes} hold a geode (${(sum.druseGeodes / sum.druse * 100).toFixed(0)} in a hundred, not 64), ${sum.notDruse} that would hold nothing do not`);
  check(sum.moved === 0, `${sum.moved} sectors out of a druse hold otherwise at generation 2 than at 1`);
}
// The sector hard by the core holds nothing, whatever its hash.
{
  w.reset(7);
  let near = 0;
  for (let seed = 1; seed <= 400; seed++) { w.reset(seed); for (const [sx, sy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) { const [what, fx, fy] = w.findSpot(sx, sy); if (what && Math.hypot(fx - C, fy - C) < 16) near++; } }
  check(near === 0, `${near} finds on 400 seeds lie within 16 cells of the core`);
}

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: the range of a sector\'s hash is allotted to five finds, the first two laid where they always were, a prism in its ore, the last two far out in generation 2, and a druse\'s sectors geodes');
process.exit(fails.length ? 1 : 0);
