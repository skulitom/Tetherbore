// What a pocket pays, against what it may (docs/CONTENT-PLAN.md S4; tools/zone-budget.mjs). A cell of a pocket's
// mineral pays `lump` seconds of what cutting earns out there, so a pocket pays its cells of mineral times its
// lump. For every kind of pocket there is, over 200 of them made as the world makes them:
//   - the mean pocket pays no more than 3.5 seconds for each cell of its radius, in every band of radius, small
//     and great, and as a herald; and no less than half of that overall, so that no pocket is a dead one;
//   - a pocket of radius 14 gives about 12 specimens: from 9 to 15;
//   - and in the worlds themselves: four heralds within the sixth reach in every one, a pocket of some kind in
//     the west within the seventh, and pockets covering less than 2.4 cells in a hundred of the ground.
//   node test/regress/s4-budget.mjs
import { budget, census, kinds, SECONDS, SPECIMENS, AT } from '../../tools/zone-budget.mjs';

const fails = [], check = (ok, what) => { if (!ok && fails.length < 12) fails.push(what); };
check(SECONDS === 3.5 && SPECIMENS === 12 && AT === 14, 'the budget is not the one written');
check(kinds().includes(32), `the kinds of pocket there are: ${kinds()}`);
const out = [];
for (const row of kinds()) {
  const b = budget(row, 200);
  out.push({ name: b.name, lump: b.lump, spec: b.spec, mineral: +b.mineral.toFixed(1), seconds: +b.seconds.toFixed(1), may: +b.may.toFixed(1), at14: +b.at14.toFixed(1), herald: +b.herald.seconds.toFixed(1) });
  check(b.made === 200 && b.mineral > 5, `${b.name}: ${b.made} pockets made, ${b.mineral.toFixed(1)} cells of mineral in the mean one`);
  check(b.seconds <= b.may && b.seconds >= b.may * 0.5, `${b.name}: the mean pocket pays ${b.seconds.toFixed(1)} s of income, where it may pay ${b.may.toFixed(1)}`);
  for (const band of b.bands) if (band.made >= 10) check(band.seconds <= band.may, `${b.name}: pockets of radius under ${band.to} pay ${band.seconds.toFixed(1)} s in the mean, over the ${band.may.toFixed(1)} they may`);
  check(b.bands.filter(band => band.made >= 10).length >= 3, `${b.name}: its pockets fall in ${b.bands.filter(band => band.made >= 10).length} bands of radius`);
  check(b.herald.seconds <= b.herald.may && b.herald.mineral >= 9, `${b.name}: as a herald it pays ${b.herald.seconds.toFixed(1)} s, where it may pay ${b.herald.may.toFixed(1)}, from ${b.herald.mineral.toFixed(1)} cells`);
  check(b.at14 >= 9 && b.at14 <= 15, `${b.name}: at radius ${AT} it gives ${b.at14.toFixed(1)} specimens, not about ${SPECIMENS}`);
}
for (const seed of [1, 7, 34]) {
  const c = census(seed);
  check(c.heralds.length === 4 && c.heralds.every(h => h.far < 215) && c.within[0] >= 4, `world ${seed}: ${c.heralds.length} heralds, ${c.within[0]} pockets within the sixth reach`);
  check(c.within[1] > 4 && c.within[4] > 80, `world ${seed}: ${c.within[1]} pockets within the seventh reach and ${c.within[4]} within the last`);
  check(c.cover > 0.002 && c.cover < 0.024, `world ${seed}: pockets cover ${(c.cover * 100).toFixed(2)} cells in a hundred of the ground`);
}
console.log(JSON.stringify(out));
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: every kind of pocket pays within its budget in every band of radius and as a herald, and gives about a dozen specimens at radius 14');
process.exit(fails.length ? 1 : 0);
