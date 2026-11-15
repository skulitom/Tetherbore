// What a sector of finds holds is said by one hash of the sector, and its whole range is allotted once
// (docs/CONTENT-PLAN.md S3; js/world.js: FINDS, find, findSpot, findAt): a geode up to 0.38 and a cache up to 0.70
// as before, then a prism up to 0.74, twin stones up to 0.80, a fossil up to 0.86, and nothing above. Checked:
//   - the table, and how many sectors of each there are;
//   - geodes and caches are where they were before the rest were allotted, cell for cell;
//   - a prism never has its middle within 130 cells of the core, and no find within 16;
//   - every find's middle lies eight cells or more inside its own sector;
//   - a prism is laid (content item 5): one cell of prism at its middle and plain ore in the eight round it;
//   - the two that are allotted and not laid yet put nothing in the ground;
//   - asking what a sector holds makes none of the world.
//   node test/regress/s3-find-bands.mjs
import { World, C, K, FIND, FINDS, cellHash as hash } from '../../js/world.js';

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
let sectors = 0, moved = 0, nearPrism = 0, nearAny = 0, outside = 0, laid = 0, unlaid = 0, checked = 0, far = 0, prisms = 0, badPrism = 0;
const w = new World();
for (const seed of [1, 7, 34]) {
  w.reset(seed);
  for (let sy = -40; sy < 40; sy++) for (let sx = -40; sx < 40; sx++) {
    const [what, fx, fy, size] = w.findSpot(sx, sy), old = was(seed, sx, sy);
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
check(nearAny === 0, `${nearAny} finds have their middle within 16 cells of the core`);
check(nearPrism === 0 && counts.prism > 300, `${nearPrism} prisms have their middle within 130 cells of the core`);
check(outside === 0 && far > sectors * 0.8, `${outside} finds have their middle outside their sector, or nearer its edge than eight cells`);
check(checked > 400 && unlaid === 0, `${unlaid} geodes or caches are not laid in the ground at their middle`);
check(prisms > 20 && badPrism === 0, `${badPrism} of ${prisms} prisms are not one cell of prism with plain ore in the eight cells round it`);
check(laid === 0, `${laid} sectors of twin stones or a fossil have cells laid by findAt: until one is built its sector's ground is plain`);
// The sector hard by the core holds nothing, whatever its hash.
{
  w.reset(7);
  let near = 0;
  for (let seed = 1; seed <= 400; seed++) { w.reset(seed); for (const [sx, sy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) { const [what, fx, fy] = w.findSpot(sx, sy); if (what && Math.hypot(fx - C, fy - C) < 16) near++; } }
  check(near === 0, `${near} finds on 400 seeds lie within 16 cells of the core`);
}

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: the range of a sector\'s hash is allotted to five finds, the first two laid where they always were, a prism in its ore, the last two waiting');
process.exit(fails.length ? 1 : 0);
