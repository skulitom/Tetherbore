// What the creatures may pay. Two of them pay: the puffling, caught in a loop of the tether, half a cache's lump and
// three of the west's gems, once in SPENT seconds of play at a den; and with the trophy line bought, a foe looped at
// rest, the line's value in specimens of the direction of its ground, as often. (The newt's lit caps pay as the
// grotto's mineral pays when they are hauled: they are the grotto's own, which the drill lights flying by.)
// Counted on worlds 1 to 8 out to 1,500 cells. The dens are counted from the seed alone, making none of the world:
// every den that holds a puffling or a foe, as though each found a home (they do not all), against every cache, and
// against every cell of a pocket's mineral (those of the world as it is made, as a haul finds them).
//   - What pufflings pay over the ground, caught once each, is under a sixth of what caches pay over the same.
//   - Caught at one den again and again as often as it comes back, they pay under a fiftieth of what cutting there
//     earns in the same time (js/shop.js: `income`, a second's cutting).
//   - What foes pay as trophies over the ground, caught once each at the line's first level: the north's (the
//     scarcest specimens, the line's reason) and the west's are under a quarter of what the pockets of their
//     direction pay over the same ground, and the south's, whose roosts are many and whose specimens the most
//     plentiful, under a half; at the line's last level every direction's is under what its pockets pay. The pockets
//     stay where specimens come from; a hunt for them is a second way, chosen.
//   - Caught at one den of the north's as often as it comes back, an hour at the line's last level pays under a
//     fifth of all that the shop asks of the north's specimens.
// And nothing laid in the world is touched: test/regress/m-ground-worth.mjs holds the worth of the ground as it was.
//   node test/regress/s8-fauna-budget.mjs
import { makeGame, C, N } from '../harness.mjs';
import { Fauna, CREATURES, DEN, PUFF, SPENT } from '../../js/fauna.js';
import { income, round2, CORE, ROWS } from '../../js/shop.js';
import { FIND, ZONE, K, rowOf } from '../../js/world.js';

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const R = 1500, PUFFS = CREATURES.findIndex(c => c?.key === 'puff'), FOE = CREATURES.map(c => c?.tier === 'foe');
const TROPHY = CORE.find(u => u.id === 'trophy').values, FIRST = TROPHY[1], LAST = TROPHY[TROPHY.length - 1];
const DIR = ['', 'north', 'south', 'west', 'east'];
let puffs = 0, caches = 0, puffPay = 0, cachePay = 0;
const foes = [0, 0, 0, 0, 0], pockets = [0, 0, 0, 0, 0];
for (let seed = 1; seed <= 8; seed++) {
  const game = await makeGame(seed), w = game.world, f = new Fauna(), made = w.made;
  f.reset(seed, null);
  for (let sy = Math.floor(-R / DEN); sy <= R / DEN; sy++) for (let sx = Math.floor(-R / DEN); sx <= R / DEN; sx++) {
    if (f.dens.size > 80) f.reset(seed, null);
    const d = f.denOf(game, 0, sx, sy);
    if (!d || Math.hypot(d.mx - C, d.my - C) > R) continue;
    if (FOE[d.kind]) foes[f.kinOf(d, d.kind)]++;
    if (d.kind !== PUFFS) continue;
    puffs++; puffPay += round2(income(Math.max(22, Math.hypot(d.mx - C, d.my - C))) * PUFF.lump);
  }
  for (let sy = Math.floor(-R / FIND); sy <= R / FIND; sy++) for (let sx = Math.floor(-R / FIND); sx <= R / FIND; sx++) {
    const [what, fx, fy] = w.findSpot(sx, sy);
    if (what !== 'cache' || Math.hypot(fx - C, fy - C) > R) continue;
    caches++; cachePay += round2(income(Math.max(22, Math.hypot(fx - C, fy - C))) * 12);
  }
  check(w.made === made, `world ${seed}: counting dens made ${w.made - made} pieces of the world`);
  // Every pocket's mineral, as the world is made (a grotto's caps lit or not yet), to the pocket's direction, as a
  // haul pays it (js/game.js: payOf).
  for (let sy = Math.floor(-R / ZONE) - 1; sy <= R / ZONE; sy++) for (let sx = Math.floor(-R / ZONE) - 1; sx <= R / ZONE; sx++) {
    const Z = w.zoneOf(sx, sy);
    if (!Z || Math.hypot(Z.cx - C, Z.cy - C) > R) continue;
    const r = Math.ceil(Z.reach) + 3;
    for (let y = Z.cy - r; y <= Z.cy + r; y++) for (let x = Z.cx - r; x <= Z.cx + r; x++) {
      const i = y * N + x, P = rowOf(w.b(i)).pocket;
      if (!P) continue;
      const k = w.k(i), pays = P.kind ?? K.MINERAL;
      if (k === pays || (pays === K.CAP_LIT && k === K.CAP)) pockets[Z.kin] += P.spec;
    }
  }
}
const share = puffPay / cachePay, hourly = 3600 / SPENT * PUFF.lump / 3600;
check(puffs > 50, `only ${puffs} dens of pufflings on eight worlds`);
check(share < 1 / 6, `pufflings pay ${(share * 100).toFixed(1)} in a hundred of what caches pay over the same ground`);
check(hourly < 1 / 50, `a den caught as often as it comes back pays ${(hourly * 100).toFixed(1)} in a hundred of what cutting earns`);

// The trophies.
const trophy = (b, v) => foes[b] * v / pockets[b];
check(foes[1] > 100 && foes[2] > 100 && foes[3] > 100 && !foes[0] && !foes[4], `foes' dens on eight worlds by direction: ${foes.join()}`);
for (const [b, most] of [[1, 1 / 4], [3, 1 / 4], [2, 1 / 2]]) check(trophy(b, FIRST) < most, `at the trophy line's first level the ${DIR[b]}'s foes pay ${(trophy(b, FIRST) * 100).toFixed(1)} in a hundred of what its pockets pay over the same ground`);
for (const b of [1, 2, 3]) check(trophy(b, LAST) < 1, `at the trophy line's last level the ${DIR[b]}'s foes pay ${(trophy(b, LAST) * 100).toFixed(1)} in a hundred of what its pockets pay over the same ground`);
const asks = ROWS.reduce((sum, u) => sum + (u.kin === 1 && u.spec ? u.spec.reduce((a, s) => a + (s ?? 0), 0) : 0), 0), hunt = 3600 / SPENT * LAST / asks;
check(asks > 0 && hunt < 1 / 5, `an hour at one den of the north's at the trophy line's last level pays ${(hunt * 100).toFixed(1)} in a hundred of the ${asks} the shop asks of the north's specimens`);

for (const f of fails) console.log(`FAIL ${f}`);
console.log(fails.length ? `${fails.length} failures` : `pufflings: ${puffs} dens on eight worlds paying ${(share * 100).toFixed(1)} in a hundred of what ${caches} caches pay, and at one den ${(hourly * 100).toFixed(1)} in a hundred of what cutting earns; trophies (${FIRST} to ${LAST} a catch): ${[1, 2, 3].map(b => `${DIR[b]} ${foes[b]} dens, ${(trophy(b, FIRST) * 100).toFixed(0)} to ${(trophy(b, LAST) * 100).toFixed(0)} in a hundred of its pockets`).join('; ')}; an hour at one den ${(hunt * 100).toFixed(1)} in a hundred of the north's asks`);
process.exit(fails.length ? 1 : 0);
