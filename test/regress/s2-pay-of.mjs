// S2: what a haul pays is worked out by one function, Game.payOf(cells, extra), which changes nothing, so that
// whatever shows a worth before the haul says what the haul then pays. Checked here:
//   asking changes neither the world nor the game, and asking twice gives the same answer;
//   the haul credits exactly what payOf said, and a wreck's part is held only once it is hauled;
//   a part in the haul raises that same haul's multiplier; extra cells ({ k, b, x, y }) count in the size and pay
//   as the same cells would in the ground;
//   prisms multiply every gem by half as much again each, to three, rounded once;
//   a pocket's mineral pays its lump (seconds of income where it lies) and its specimens, to the direction of its
//   pocket; the kind that is the mineral is the row's to say; a chain of hauls raises the lump a fifth a link, to
//   five, and runs out with time.
//   node test/regress/s2-pay-of.mjs
import { makeGame, world, income, haulBonus, richness, C, N } from '../harness.mjs';
const { K, B, BIOMES, biome } = world;

const round2 = n => { const unit = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1); return Math.round(n / unit) * unit; };
const game = await makeGame(7, { winch: 1 }), w = game.world, S = game.S, fails = [];
const at = (x, y) => (C + y) * N + C + x;
const expect = (name, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${name}: ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`); };
const lay = (x, y, kinds, b) => kinds.map((k, n) => { const i = at(x + n, y); w.setK(i, k); w.setB(i, b); return i; });
const state = cells => JSON.stringify({ S, kinds: cells.map(i => w.k(i)), pending: game.pending, hauls: game.hauls.length, chain: game.chain, hauled: game.hauled, banner: game.banner, popups: game.popups.length });

// ---- asking changes nothing, and the haul pays what was said
const [wx, wy] = w.wrecks[0], wreck = wy * N + wx;
const mixed = [...lay(60, -20, [K.SOFT, K.DENSE, K.ORE_A, K.ORE_B, K.SLATE, K.CACHE, K.HAZARD], B.EMBER), wreck];
expect('the first wreck is where the world says', w.k(wreck), K.WRECK);
const before = state(mixed), said = game.payOf(mixed), again = game.payOf(mixed);
expect('payOf changed the game or the world', state(mixed), before);
expect('payOf asked twice', again, said);
expect('what payOf counts', { n: said.n, caches: said.caches, parts: said.parts, wrecks: said.wrecks, relic: said.relic }, { n: 8, caches: 1, parts: 1, wrecks: [0], relic: -1 });
expect('the part is not held for the asking', S.wrecks[0], 0);
expect('a part in the haul raises that haul', +(said.mult / haulBonus(8, game.val('winch'))).toFixed(6), 1.1);
const had = { grit: S.grit, gems: S.gems.slice() };
game.haul(mixed);
expect('the haul credited the grit payOf said', S.grit - had.grit, said.grit);
expect('the haul credited the gems payOf said', S.gems.map((g, n) => g - had.gems[n]), said.gems);
expect('the part is held once hauled', S.wrecks[0], 1);
expect('the haul says what payOf said', [game.hauled.grit, game.hauled.gems, game.hauled.mult], [said.grit, said.gems, said.mult]);

// ---- extra cells: counted, and paid as the same cells in the ground
for (let f = 0; f < 600; f++) game.update(1 / 60);                // the chain runs out
const strip = lay(60, -10, [K.SOFT, K.SOFT, K.ORE_A], B.FROST), bead = lay(63, -10, [K.ORE_B], B.FROST)[0];
const whole = game.payOf([...strip, bead]), strung = game.payOf(strip, [{ k: K.ORE_B, b: B.FROST, x: C + 63, y: C - 10 }]);
expect('extra cells pay as cells in the ground', [strung.n, strung.grit, strung.gems], [whole.n, whole.grit, whole.gems]);
expect('and more than the haul without them', strung.grit > game.payOf(strip).grit && strung.gems[B.FROST] === game.payOf(strip).gems[B.FROST] + 5, true);

// ---- prisms
const ores = lay(60, 0, [K.ORE_B, K.ORE_B, K.ORE_A], B.LODE);                       // 11 gems of the east
const prisms = lay(60, 2, [K.PRISM, K.PRISM, K.PRISM, K.PRISM], B.LODE);
expect('no prism', game.payOf(ores).gems[B.LODE], 11);
expect('one prism', [game.payOf([...ores, prisms[0]]).gems[B.LODE], game.payOf([...ores, prisms[0]]).prisms], [Math.round(11 * 1.5), 1]);
expect('four prisms count as three', [game.payOf([...ores, ...prisms]).gems[B.LODE], game.payOf([...ores, ...prisms]).shine], [Math.round(11 * 2.5), 2.5]);

// ---- a pocket's mineral
const looks = { sheet: 'mire', floor: 'mire-floor', gloom: [1, 2, 3], mote: ['#ffffff', 'still'], map: [1, 2, 3], debris: ['#000000'], gen: BIOMES[3].gen };
const hive = biome({ id: 121, name: 'test-hive', kin: B.MIRE, worth: 0, pocket: { mineral: 'amber', lump: 4, spec: 1.5, chain: true }, ...looks });
const nodes = biome({ id: 122, name: 'test-nodes', kin: 0, pocket: { mineral: 'opal', kind: K.NODE, lump: 2, spec: 1 }, ...looks });
const amber = lay(-70, 5, [K.MINERAL, K.SOFT, K.MINERAL, K.NODE], hive.id);
const lumpOf = (cells, seconds, chain = 1) => cells.reduce((sum, i) => sum + round2(income(Math.max(22, Math.hypot(i % N - C, Math.floor(i / N) - C))) * seconds * chain), 0);
let pay = game.payOf(amber);
expect('the mineral of a pocket', { minerals: pay.minerals, mineral: pay.mineral, lump: pay.lump, grit: pay.grit, spec: pay.spec },
  { minerals: 2, mineral: 'amber', lump: lumpOf([amber[0], amber[2]], 4), grit: lumpOf([amber[0], amber[2]], 4), spec: [0, 0, 0, 3, 0] });
// The pocket's own record says whose direction it lies in, where the world has one.
w.zoneOf = (sx, sy) => ({ key: `${sx},${sy}`, row: hive.id, cx: C - 70, cy: C + 5, rho: 9, kin: B.FROST });
expect('specimens go to the direction of the pocket', game.payOf(amber).spec, [0, 3, 0, 0, 0]);
delete w.zoneOf;
const opal = lay(-70, 9, [K.MINERAL, K.NODE, K.NODE, K.NODE], nodes.id);
pay = game.payOf(opal);
expect('the kind that is the mineral is the row\'s to say', [pay.minerals, pay.mineral, pay.lump], [3, 'opal', lumpOf(opal.slice(1), 2)]);
// A chain: each haul before this one, close enough in time, raises the lump a fifth.
for (let link = 1; link <= 7; link++) {
  game.haul(lay(-70, 20 + link, [K.SOFT], B.CRUST));
  expect(`the lump after ${link} hauls in a chain`, game.payOf(amber).lump, lumpOf([amber[0], amber[2]], 4, 1 + 0.2 * Math.min(5, link)));
}
// (Only where the pocket's row says so: in any other a chain raises nothing.)
expect('a chain in a pocket that has none', game.payOf(opal).lump, lumpOf(opal.slice(1), 2));
for (let f = 0; f < 600; f++) game.update(1 / 60);
expect('the chain runs out', game.payOf(amber).lump, lumpOf([amber[0], amber[2]], 4));

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: payOf changes nothing, the haul pays what it said, and extra cells, prisms, a pocket\'s mineral and a chain pay as written');
process.exit(fails.length ? 1 : 0);
