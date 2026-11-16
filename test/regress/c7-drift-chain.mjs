// Chained hauls in a pumice drift (docs/CONTENT-PLAN.md, content item 7; js/game.js: payOf, haul, CHAIN): each
// boulder hauled within six seconds of the haul before pays its aerolite a fifth more than the last, up to double,
// and rings a note higher.
//   - boulders of one drift hauled a second apart: their lumps are 1, 1.2, 1.4, 1.6, 1.8 and then 2 times what
//     the aerolite pays by itself, never more; what payOf says beforehand is what the haul pays, and `hauled.chain`
//     says the factor;
//   - each haul rings (`sfx.gem`), a step higher than the last as far as the pay rises: 0, 1, 2, 3, 4, 5, 5; and
//     rings whether or not it raised the whole count of specimens, which is when any other pocket's haul rings;
//   - a haul 5.5 seconds after the last is still a link; one 6.5 seconds after is the first of a new chain, paid
//     and rung as the first was;
//   - every boulder under 12 cells is a light haul: no banner, no beat of stillness, and what it paid is said
//     where it lay with the aerolite's own picture;
//   - its specimens are the direction's the drift lies in, nine tenths of one a cell of aerolite, whatever the
//     chain: a chain multiplies the lump and nothing else;
//   - the rock of the boulder is paid as any ground is, and the chain does not touch it.
//   node test/regress/c7-drift-chain.mjs
import { C, N, K, income, richness, haulBonus } from '../harness.mjs';
import { stage, bouldersOf } from '../../tools/drift-play.mjs';
import { sfx } from '../../js/audio.js';

const fails = [], check = (ok, what) => { if (!ok && fails.length < 16) fails.push(what); };
const round2 = n => { const unit = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1); return Math.round(n / unit) * unit; };
// World 7's drift of twelve boulders, 893 cells out to the south-east.
const { game, Z } = await stage(7, 30), w = game.world, S = game.S, P = w.row(Z.cy * N + Z.cx).pocket;
game.update(1 / 60);
const rung = [], gem = sfx.gem;
sfx.gem = step => { rung.push(step); gem(step); };
const wait = seconds => { for (let f = 0; f < Math.round(seconds * 60); f++) game.update(1 / 60); };
const boulders = bouldersOf(w, Z).filter(b => b.cells.length < 12);
check(boulders.length >= 10 && P.chain === true && P.lump === 2 && P.spec === 0.9, `the drift at ${Z.cx - C},${Z.cy - C} has ${boulders.length} boulders under 12 cells`);
// What a boulder pays with its lump taken `chain` times: the lump of each cell of aerolite, and the rock's own.
const lumpOf = (b, chain) => b.cells.filter(i => w.k(i) === K.MINERAL).reduce((sum, i) => sum + round2(income(Math.max(22, Math.hypot(i % N - C, Math.floor(i / N) - C))) * P.lump * chain), 0);
const rockOf = b => Math.round(b.cells.reduce((sum, i) => sum + (w.k(i) === K.SOFT ? richness(Math.hypot(i % N - C, Math.floor(i / N) - C)) : 0), 0) * haulBonus(b.cells.length, game.val('winch')));
const said = [];
const haul = (b, want, what) => {
  const piece = game.pieceOf.get(b.cells[0]);
  check(piece && piece.length === b.cells.length, `${what}: the boulder is not in the books as one piece`);
  const lump = lumpOf(b, want), rock = rockOf(b), minerals = b.cells.filter(i => w.k(i) === K.MINERAL).length, pay = game.payOf(b.cells), grit = S.grit, spec = S.spec[Z.kin], rings = rung.length;
  check(Math.abs(pay.chain - want) < 1e-9 && pay.lump === lump && pay.grit === lump + rock, `${what}: payOf says a lump of ${pay.lump} at x${pay.chain}, ${pay.grit} in all, where x${want} is ${lump} and the rock ${rock}`);
  game.haul(b.cells.slice()); game.changed(b.cells);
  const h = game.hauled;
  check(S.grit - grit === lump + rock && h.grit === lump + rock && Math.abs(h.chain - want) < 1e-9, `${what}: the haul paid ${S.grit - grit} (said x${h.chain}), not ${lump + rock} at x${want}`);
  check(Math.abs(S.spec[Z.kin] - spec - 0.9 * minerals) < 1e-9, `${what}: ${minerals} cells of aerolite gave ${S.spec[Z.kin] - spec} specimens`);
  check(h.light && h.mineral === 'aerolite' && game.banner === null && !(game.hitstop > 0), `${what}: a boulder of ${b.cells.length} cells was not a light haul`);
  check(game.popups.some(p => Array.isArray(p.icon) && p.icon[1] === 'aerolite'), `${what}: what it paid is not said with the aerolite's picture`);
  check(rung.length === rings + 1, `${what}: the haul rang ${rung.length - rings} times`);
  said.push(+h.chain.toFixed(1));
};
// ---- one chain, a haul a second
const factors = [1, 1.2, 1.4, 1.6, 1.8, 2, 2];
for (let n = 0; n < 7; n++) {
  // (The third boulder is left one cell of aerolite, and the count of specimens made a whole number before it:
  // its nine tenths of a specimen do not raise the whole count, and it rings all the same.)
  if (n === 2) {
    const b = boulders[n], core = b.cells.filter(i => w.k(i) === K.MINERAL);
    for (const i of core.slice(1)) w.setK(i, K.SOFT);
    S.spec[Z.kin] = Math.floor(S.spec[Z.kin]);
  }
  haul(boulders[n], factors[n], `haul ${n + 1} of the chain`);
  if (n === 2) check(game.hauled.spec === 0 && game.hauled.minerals === 1, `the boulder of one cell of aerolite raised the whole count of specimens by ${game.hauled.spec}`);
  wait(1);
}
check(JSON.stringify(rung) === '[0,1,2,3,4,5,5]', `the chain rang steps ${rung}`);
check(game.chain.n === 7, `the chain holds ${game.chain.n} hauls`);
// ---- the window: five and a half seconds on is a link, six and a half is not
wait(4.5);
haul(boulders[7], 2, 'a haul 5.5 s after the last');
wait(6.5);
haul(boulders[8], 1, 'a haul 6.5 s after the last');
wait(1);
haul(boulders[9], 1.2, 'the haul after that');
check(JSON.stringify(rung.slice(7)) === '[5,0,1]', `after the chain, the hauls rang steps ${rung.slice(7)}`);
check(game.chain.n === 2, `the new chain holds ${game.chain.n} hauls`);

console.log(JSON.stringify({ drift: [Z.cx - C, Z.cy - C], factors: said, rung }));
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: boulders hauled within six seconds of one another pay their aerolite a fifth more each, to double, and ring a note higher; the rock, the specimens and the light haul are untouched');
process.exit(fails.length ? 1 : 0);
