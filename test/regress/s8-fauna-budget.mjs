// What the creatures may pay. Only one of them pays at all, the puffling, caught in a loop of the tether: half a
// cache's lump and three of the west's gems, once in SPENT seconds of play at a den. (The newt's lit caps pay as
// the grotto's mineral pays when they are hauled: they are the grotto's own, which the drill lights flying by.)
// Counted from the seed alone on worlds 1 to 8 out to 1,500 cells, making none of the world: every den that holds a
// puffling, as though each found a home (they do not all), against every cache.
//   - What pufflings pay over the ground, caught once each, is under a sixth of what caches pay over the same.
//   - Caught at one den again and again as often as it comes back, they pay under a fiftieth of what cutting there
//     earns in the same time (js/shop.js: `income`, a second's cutting).
// And nothing laid in the world is touched: test/regress/m-ground-worth.mjs holds the worth of the ground as it was.
//   node test/regress/s8-fauna-budget.mjs
import { makeGame, C } from '../harness.mjs';
import { Fauna, CREATURES, DEN, PUFF, SPENT } from '../../js/fauna.js';
import { income, round2 } from '../../js/shop.js';
import { FIND } from '../../js/world.js';

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const R = 1500, PUFFS = CREATURES.findIndex(c => c?.key === 'puff');
let puffs = 0, caches = 0, puffPay = 0, cachePay = 0;
for (let seed = 1; seed <= 8; seed++) {
  const game = await makeGame(seed), w = game.world, f = new Fauna(), made = w.made;
  f.reset(seed, null);
  for (let sy = Math.floor(-R / DEN); sy <= R / DEN; sy++) for (let sx = Math.floor(-R / DEN); sx <= R / DEN; sx++) {
    if (f.dens.size > 80) f.reset(seed, null);
    const d = f.denOf(game, 0, sx, sy);
    if (!d || d.kind !== PUFFS || Math.hypot(d.mx - C, d.my - C) > R) continue;
    puffs++; puffPay += round2(income(Math.max(22, Math.hypot(d.mx - C, d.my - C))) * PUFF.lump);
  }
  for (let sy = Math.floor(-R / FIND); sy <= R / FIND; sy++) for (let sx = Math.floor(-R / FIND); sx <= R / FIND; sx++) {
    const [what, fx, fy] = w.findSpot(sx, sy);
    if (what !== 'cache' || Math.hypot(fx - C, fy - C) > R) continue;
    caches++; cachePay += round2(income(Math.max(22, Math.hypot(fx - C, fy - C))) * 12);
  }
  check(w.made === made, `world ${seed}: counting dens made ${w.made - made} pieces of the world`);
}
const share = puffPay / cachePay, hourly = 3600 / SPENT * PUFF.lump / 3600;
check(puffs > 50, `only ${puffs} dens of pufflings on eight worlds`);
check(share < 1 / 6, `pufflings pay ${(share * 100).toFixed(1)} in a hundred of what caches pay over the same ground`);
check(hourly < 1 / 50, `a den caught as often as it comes back pays ${(hourly * 100).toFixed(1)} in a hundred of what cutting earns`);

for (const f of fails) console.log(`FAIL ${f}`);
console.log(fails.length ? `${fails.length} failures` : `pufflings: ${puffs} dens on eight worlds paying ${(share * 100).toFixed(1)} in a hundred of what ${caches} caches pay, and at one den ${(hourly * 100).toFixed(1)} in a hundred of what cutting earns`);
process.exit(fails.length ? 1 : 0);
