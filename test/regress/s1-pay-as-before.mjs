// What a haul pays is read from the ground's row (rich, worth, gemx, whose gems), and in grounds 0 to 8 that is
// what the arithmetic on the ground's number paid: twice the grit and the gems past 4, the gems to the number less
// 4, none in the home ground. One piece of every paying kind is hauled in each of the nine grounds and the pay
// compared with the old sum, written out here. Then a row made for the test, whose ores pay two other directions'
// gems and whose ground is worth six times as much, pays as its row says; and one whose rich ore pays a corner's
// gem pays it into that gem's own place, which is banked as the rest are once it is home, and a ground cannot be
// a corner's or pay a gem there is none of.
//   node test/regress/s1-pay-as-before.mjs
import { makeGame, world, haulBonus, richness, C, N } from '../harness.mjs';
const { K, B, G, GEM_N, BIOMES, biome, noGems } = world;

const GRIT = [0, 0, 0, 1, 2, 2, 4, 4, 10, 3, 0, 0, 1, 0, 0], GEMS = [0, 0, 0, 0, 0, 1, 5, 0, 0, 2, 0, 0, 0, 0, 0];
const base = b => b > 4 ? b - 4 : b, HAS_HAZARD = [0, 0, 1, 1, 1, 0, 1, 1, 1];
const fails = [];
const game = await makeGame(7, { winch: 2 }), w = game.world, S = game.S;
const at = (x, y) => (C + y) * N + C + x;
// A strip of cells 40 out to the east is made ground `b`, its kinds laid along it, and hauled.
const haul = (b, kinds, y) => {
  const cells = kinds.map((k, n) => { const i = at(40 + n, y); w.setK(i, k); w.setB(i, b); return i; });
  const before = { grit: S.grit, gems: S.gems.slice() };
  game.haul(cells);
  return { cells, grit: S.grit - before.grit, gems: S.gems.map((g, n) => g - before.gems[n]) };
};
for (let b = 0; b <= 8; b++) {
  const kinds = [K.SOFT, K.DENSE, K.ORE_A, K.ORE_B, K.SLATE, K.VAULT, K.BASALT, K.ICE, ...(HAS_HAZARD[b] ? [K.HAZARD] : [])];
  const got = haul(b, kinds, b * 3 - 12);
  let grit = 0;
  const gems = noGems();
  got.cells.forEach((i, n) => {
    const k = kinds[n], far = Math.hypot(i % N - C, Math.floor(i / N) - C), rich = richness(far) * (b > 4 ? 2 : 1);
    grit += GRIT[k] * rich; gems[base(b)] += b ? GEMS[k] * (b > 4 ? 2 : 1) : 0;
    if (b === B.CRUST && (k === K.ORE_A || k === K.ORE_B)) grit += (k === K.ORE_B ? 20 : 4) * rich;
  });
  grit = Math.round(grit * haulBonus(kinds.length, game.val('winch')));
  const want = gems.map((g, n) => n ? Math.round(g) : 0);
  if (got.grit !== grit || JSON.stringify(got.gems) !== JSON.stringify(want)) fails.push(`ground ${b} (${BIOMES[b].name}) paid ${got.grit} grit and gems ${got.gems}; the old sum is ${grit} and ${want}`);
  if (got.cells.some(i => w.k(i) !== K.EMPTY)) fails.push(`ground ${b}: a hauled cell is still there`);
}
// A row of the test's own: rich 3, worth 2, gems three times over, ore A paying the south and ore B the west.
const row = biome({ id: 120, name: 'test-pay', kin: B.FROST, gemA: B.EMBER, gemB: B.MIRE, rich: 3, worth: 2, gemx: 3, sheet: 'frost', floor: 'frost-floor',
  gloom: [1, 2, 3], mote: ['#ffffff', 'still'], map: [1, 2, 3], debris: ['#000000'], gen: BIOMES[1].gen });
const got = haul(row.id, [K.SOFT, K.ORE_A, K.ORE_B], 20);
let grit = 0;
got.cells.forEach((i, n) => { grit += [1, 2, 4][n] * richness(Math.hypot(i % N - C, Math.floor(i / N) - C)) * 3 * 2; });
grit = Math.round(grit * haulBonus(3, game.val('winch')));
if (got.grit !== grit || JSON.stringify(got.gems) !== JSON.stringify([0, 0, 3, 15, 0, 0, 0, 0, 0])) fails.push(`the test's row paid ${got.grit} grit and gems ${got.gems}; its row says ${grit} and 0,0,3,15,0,0,0,0,0`);
// (A corner's gem: paid, on its way and banked by its own number, nothing of it lost and nothing of it NaN.)
const corner = biome({ ...row, id: 121, name: 'test-corner', gemB: G.NE, gloom: [1, 2, 3], mote: ['#ffffff', 'still'], map: [1, 2, 3], debris: ['#000000'], gen: BIOMES[1].gen });
const paid = haul(corner.id, [K.SOFT, K.ORE_A, K.ORE_B], 23);
if (JSON.stringify(paid.gems) !== JSON.stringify([0, 0, 3, 0, 0, 15, 0, 0, 0])) fails.push(`a row whose rich ore pays the north east's gem paid gems ${paid.gems}, not 0,0,3,0,0,15,0,0,0`);
if (S.gems.length !== GEM_N || game.pending.gems.length !== GEM_N || game.banked(G.NE) !== 0 || game.pending.gems[G.NE] !== 15) fails.push(`the north east's gems on their way: ${S.gems} banked, ${game.pending.gems} on the way, ${game.banked(G.NE)} of the north east's shown`);
for (let f = 0; f < 1200 && game.hauls.length; f++) game.update(1 / 60);
if (game.hauls.length || game.banked(G.NE) !== S.gems[G.NE] || game.pending.gems.some(Boolean) || S.gems.some(g => !Number.isFinite(g))) fails.push(`home, the north east's gems are ${game.banked(G.NE)} of ${S.gems[G.NE]} banked, ${game.pending.gems} still on the way`);
for (const [bad, f] of [['a corner as kin', { kin: G.NE }], ['a gem past the last', { gemB: GEM_N }], ['half a gem', { gemA: 1.5 }]]) {
  let threw = false;
  try { biome({ ...row, id: 122, name: 'test-bad', ...f }); } catch { threw = true; }
  if (!threw) fails.push(`a ground with ${bad} was taken`);
}

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: a haul in each of the nine grounds pays what the old sum paid, a row of other figures pays by its row, and a corner\'s gem by its own number');
process.exit(fails.length ? 1 : 0);
