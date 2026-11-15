// S5, the world's side of first sight. World.see puts each cell seen for the first time that is worth calling out
// on `spotted`, as [what, cell, middle]: a cache, a wreck, a relic, a keystone, a prism, a pocket's mineral (which
// kind that is, its row says), and slate where it is the shell of a geode. Nothing else goes on it, and no cell
// twice. World.findSpot says what a sector of finds holds without making any of the world, and agrees with the
// ground the world then makes.
//   node test/regress/s5-first-sight.mjs
import { world, C, N, K } from '../harness.mjs';
const { World, FIND, B, BIOMES, biome } = world;

const w = new World(), fails = [];
w.reset(7);
const at = (x, y) => (C + y) * N + C + x;
const check = (ok, what) => { if (!ok) fails.push(what); };

// ---- findSpot: no world made by asking, and the world agrees
const spots = [];
for (let sy = -12; sy <= 12; sy++) for (let sx = -12; sx <= 12; sx++) spots.push([sx, sy, ...w.findSpot(sx, sy)]);
check(w.made === 0 && !w.chunks.some(Boolean), `findSpot made ${w.made} pieces of the world`);
let geodes = 0, caches = 0, none = 0, wrong = 0;
for (const [sx, sy, what, fx, fy, size] of spots) {
  if (what === 'geode') {
    geodes++;
    const heart = w.at(fx, fy), shell = w.at(fx + size - 1, fy), ore = w.at(fx + 1, fy);
    if (heart !== (size === 4 ? K.EMPTY : K.ORE_B) || shell !== K.SLATE || ore !== K.ORE_B) wrong++;
  } else if (what === 'cache') {
    caches++;
    if (w.at(fx, fy) !== K.CACHE || w.at(fx + 1, fy + 1) !== K.DENSE) wrong++;
  } else {
    none++;
    for (let n = 0; n < 6; n++) if (w.findAt(C + sx * FIND + 5 + n * 7, C + sy * FIND + 11 + n * 5) !== -1) wrong++;
  }
}
// (A wreck's hollow or the home ground's first cells may lie over a find: a handful in 625 sectors at the most.)
check(geodes > 150 && caches > 100 && none > 100 && wrong <= 6, `findSpot and the ground disagree in ${wrong} of ${spots.length} sectors (${geodes} geodes, ${caches} caches, ${none} empty)`);
check(JSON.stringify(w.findSpot(1, 0)) === JSON.stringify(['cache', C + 57, C + 13, 1]), `the sector east of the core on seed 7: ${JSON.stringify(w.findSpot(1, 0))}`);

// ---- see: what goes on the list
w.reset(7);
const seen = (x, y, r) => { w.spotted.length = 0; w.see(C + x, C + y, r); return w.spotted.map(([what, i, mid]) => `${what} ${(i % N) - C},${Math.floor(i / N) - C} ${(mid % N) - C},${Math.floor(mid / N) - C}`); };
check(JSON.stringify(seen(57, 13, 2)) === JSON.stringify(['cache 57,13 57,13']), `a cache seen: ${JSON.stringify(seen(57, 13, 2))}`);
check(!seen(57, 13, 4).some(s => s.startsWith('cache')), 'a cache seen before was put on the list again');
// A geode of size 3 at -20,63: every cell of its shell is told of, each naming the geode's middle.
let shell = 0;
for (let y = 59; y <= 67; y++) for (let x = -24; x <= -16; x++) if (w.at(C + x, C + y) === K.SLATE && Math.hypot(x + 20, y - 63) <= 2.8) shell++;
const geode = seen(-20, 63, 5);
check(shell >= 8 && geode.length === shell && geode.every(s => s.startsWith('geode ') && s.endsWith(' -20,63')), `a geode's shell of ${shell} cells: ${geode.length} told of, ${JSON.stringify(geode.slice(0, 3))}`);
// Slate that is no geode's, and ordinary ground, are not told of; a keystone, a prism, a wreck and a relic are.
const plain = [K.SLATE, K.SOFT, K.DENSE, K.ORE_A, K.ORE_B, K.VAULT, K.HAZARD, K.ICE, K.BASALT, K.NODE, K.MINERAL];
check(w.findSpot(4, 1)[0] === null, 'the test wants a sector with no find at 4,1');
plain.forEach((k, n) => w.setK(at(205 + n, 60), k));
const dull = seen(210, 60, 6);
check(dull.length === 0, `ordinary ground was told of: ${JSON.stringify(dull)}`);
w.setK(at(205, 70), K.KEY); w.setK(at(207, 70), K.PRISM);
const pair = seen(206, 70, 1).sort();
check(JSON.stringify(pair) === JSON.stringify(['key 205,70 205,70', 'prism 207,70 207,70']), `a keystone and a prism: ${JSON.stringify(pair)}`);
const [wx, wy] = w.wrecks[1], relic = w.relicAt[3];
check(seen(wx - C, wy - C, 0).join() === `wreck ${wx - C},${wy - C} ${wx - C},${wy - C}`, 'a wreck was not told of');
check(seen((relic % N) - C, Math.floor(relic / N) - C, 0).join().startsWith('relic '), 'a relic was not told of');
// A pocket's mineral: the kind its row names (K.MINERAL if it names none), in that row's ground only.
const looks = { sheet: 'mire', floor: 'mire-floor', gloom: [1, 2, 3], mote: ['#ffffff', 'still'], map: [1, 2, 3], debris: ['#000000'], gen: BIOMES[3].gen };
const hive = biome({ id: 121, name: 'test-hive', kin: B.MIRE, pocket: { mineral: 'amber', lump: 4, spec: 1.5 }, ...looks });
const nodes = biome({ id: 122, name: 'test-nodes', kin: B.MIRE, pocket: { mineral: 'opal', kind: K.NODE, lump: 2, spec: 1 }, ...looks });
[[K.MINERAL, hive.id], [K.NODE, hive.id], [K.MINERAL, nodes.id], [K.NODE, nodes.id]].forEach(([k, b], n) => { w.setK(at(205 + n * 2, 80), k); w.setB(at(205 + n * 2, 80), b); });
const ore = seen(208, 80, 4).sort();
check(JSON.stringify(ore) === JSON.stringify(['mineral 205,80 205,80', 'mineral 211,80 211,80']), `a pocket's mineral: ${JSON.stringify(ore)}`);

// ---- the list is the world's: a new world starts with none, and it never grows without end
w.see(C + 57, C - 60, 30);
w.reset(7);
check(w.spotted.length === 0, 'a new world began with things on the list');
for (let n = 0; n < 500; n++) w.setK(at(300 + n, 300), K.KEY);
w.see(C + 550, C + 300, 260);
check(w.spotted.length > 0 && w.spotted.length <= 400, `the list holds ${w.spotted.length}`);

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : `ok: findSpot agrees with the ground in ${spots.length} sectors and makes none of it; see tells of what is worth calling out, once, and of nothing else`);
process.exit(fails.length ? 1 : 0);
