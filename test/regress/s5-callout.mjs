// S5: first sight. What the world tells of when it is first seen (World.see: test s5-first-sight) is called out by
// the game: a ring from the thing, its name in a popup, and a dot kept for the map in S.marks until the thing is
// gone. One call for a thing however many of its cells come into view; one of a kind in three seconds, though a
// thing seen sooner still gets its dot; wrecks and relics are named but get no dot (the map shows them anyway); the
// map keeps 24 dots at the most; a geode's dot is on its ore, so it goes when the ore does. Names only.
//   node test/regress/s5-callout.mjs
import { makeGame, world, C, N } from '../harness.mjs';
const { K, B, BIOMES, FIND, biome } = world;

const game = await makeGame(7, { tether: 5 }), w = game.world, S = game.S, fails = [];
const at = (x, y) => (C + y) * N + C + x;
const check = (ok, what) => { if (!ok) fails.push(what); };
const same = (got, want) => JSON.stringify(got) === JSON.stringify(want);
// Uncover the ground round a cell and let the game take one frame over it: what came up.
const sight = (x, y, r = 2) => {
  game.popups.length = 0; game.rings.length = 0;
  w.see(C + x, C + y, r);
  game.update(1 / 60);
  return { names: game.popups.map(p => p.label), colours: game.popups.map(p => p.color), rings: game.rings.length, left: w.spotted.length };
};
const wait = seconds => { for (let f = 0; f < seconds * 60; f++) game.update(1 / 60); };

// ---- a cache
let got = sight(57, 13);
check(same(got, { names: ['CACHE'], colours: ['#ffe14a'], rings: 1, left: 0 }), `a cache seen: ${JSON.stringify(got)}`);
check(same(S.marks, [[at(57, 13), K.CACHE, '#ffe14a']]), `its dot: ${JSON.stringify(S.marks)}`);
const ring = game.rings[0], word = game.popups[0];
check(ring && Math.abs(ring.x / 16 - (C + 57.5)) < 0.01 && Math.abs(ring.y / 16 - (C + 13.5)) < 0.01, 'the ring does not spread from the cache');
check(word && Math.abs(word.x / 16 - (C + 57.5)) < 0.01 && word.y / 16 < C + 13 && word.y / 16 > C + 11, 'the name is not just above the cache');
got = sight(57, 13, 4);
check(got.names.length === 0 && S.marks.length === 1, `the same cache called out twice: ${JSON.stringify(got)}`);

// ---- another cache a moment later gets its dot and no fanfare; one three seconds on is called out again
got = sight(-80, 12);
check(got.names.length === 0 && got.rings === 0 && S.marks.length === 2 && S.marks[1][0] === at(-80, 12), `a second cache within three seconds: ${JSON.stringify(got)}, dots ${JSON.stringify(S.marks)}`);
wait(3.1);
w.setK(at(30, 40), K.CACHE);
got = sight(30, 40, 0);
check(same(got.names, ['CACHE']) && S.marks.length === 3, `a third cache after three seconds: ${JSON.stringify(got)}`);

// ---- a geode: many cells of shell, one call, and the dot on its ore
got = sight(-20, 63, 5);
check(same(got.names, ['GEODE']) && got.rings === 1 && S.marks.length === 4 && same(S.marks[3].slice(0, 2), [at(-19, 63), K.ORE_B]), `a geode seen: ${JSON.stringify(got)}, dots ${JSON.stringify(S.marks)}`);
check(Math.abs(game.rings[0].x / 16 - (C - 19.5)) < 0.01 && Math.abs(game.rings[0].y / 16 - (C + 63.5)) < 0.01, 'the ring does not spread from the middle of the geode');

// ---- a wreck and a relic are named, with no dot; a keystone, a prism and a pocket's mineral with one
const [wx, wy] = w.wrecks[1];
got = sight(wx - C, wy - C, 0);
check(same(got.names, ['WRECK']) && got.rings === 1 && S.marks.length === 4, `a wreck seen: ${JSON.stringify(got)}, ${S.marks.length} dots`);
const relic = w.relicAt[1];
got = sight((relic % N) - C, Math.floor(relic / N) - C, 0);
check(same(got, { names: ['RELIC'], colours: ['#ffb060'], rings: 1, left: 0 }) && S.marks.length === 4, `the south's relic seen: ${JSON.stringify(got)}, ${S.marks.length} dots`);
w.setK(at(205, 70), K.KEY); w.setK(at(207, 70), K.PRISM);
got = sight(206, 70, 1);
check(same(got.names.slice().sort(), ['KEYSTONE', 'PRISM']) && S.marks.length === 6, `a keystone and a prism seen: ${JSON.stringify(got)}`);
const hive = biome({ id: 121, name: 'test-hive', kin: B.MIRE, pocket: { mineral: 'amber', lump: 4, spec: 1.5 },
  sheet: 'mire', floor: 'mire-floor', gloom: [1, 2, 3], mote: ['#ffffff', 'still'], map: [51, 102, 25], debris: ['#000000'], gen: BIOMES[3].gen });
for (const x of [205, 206, 207]) { w.setK(at(x, 80), K.MINERAL); w.setB(at(x, 80), hive.id); }
got = sight(206, 80, 1);
check(same(got, { names: ['AMBER'], colours: ['rgb(128,255,63)'], rings: 1, left: 0 }) && S.marks.length === 7, `a pocket's mineral seen: ${JSON.stringify(got)}, ${S.marks.length} dots`);
check(game.popups.every(p => /^[A-Z]+$/.test(p.label)), 'something other than a name came up');

// ---- a dot goes when its thing does: hauled, or cut
game.haul([at(57, 13)]); game.changed([at(57, 13)]);
check(!S.marks.some(m => m[0] === at(57, 13)) && S.marks.length === 6, `the dot of a cache that was hauled is still there: ${JSON.stringify(S.marks)}`);
w.setK(at(-19, 63), K.EMPTY); game.changed([at(-19, 63)]);
check(!S.marks.some(m => m[0] === at(-19, 63)) && S.marks.length === 5, 'the dot of a geode whose ore was cut is still there');

// ---- the map keeps 24 dots: the oldest go first
for (let n = 0; n < 30; n++) { w.setK(at(300 + n * FIND, 200), K.KEY); w.see(C + 300 + n * FIND, C + 200, 0); }
game.update(1 / 60);
check(S.marks.length === 24 && S.marks[23][0] === at(300 + 29 * FIND, 200) && !S.marks.some(m => m[0] === at(-80, 12)), `the map keeps ${S.marks.length} dots, the last ${JSON.stringify(S.marks[23])}`);

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: what is first seen is called out once, by name, with a ring and a dot kept for the map until it is gone');
process.exit(fails.length ? 1 : 0);
