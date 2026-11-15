// The game's rules read the row of the ground a cell lies in, not the ground's number: rows made for this test,
// with numbers the old arithmetic knew nothing of, are cut, frozen, poured and flown in.
//   - a cut closes with ice after the row's `freeze` seconds, and never where it is 0;
//   - a lava pocket pours as far as the row's `lavaVol`;
//   - a cell takes the row's `dig` times as long to cut;
//   - the dark eases to the row's `gloom` and `dark`, and the motes are the row's;
//   - rock, floor, ore and chips are drawn from the sheets and colours the row names.
//   node test/regress/s1-row-rules.mjs
import { makeGame, world, C, N } from '../harness.mjs';
import { arena, rect, at, idle, fixRandom } from './lib/lasso.mjs';
const { K, B, BIOMES, biome, digTime } = world;

fixRandom(3);
const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const looks = { gloom: [40, 2, 90], dark: 0.5, mote: ['#123456', 'rise'], map: [9, 8, 7], debris: ['#aa0000', '#bb0000', '#cc0000'], sheet: 'gilt', floor: 'rime-floor', items: 'mire-items' };
const quick = biome({ id: 120, name: 'test-quick-ice', kin: B.EMBER, gen: BIOMES[1].gen, freeze: 5, dig: 2, lavaVol: 2, haz: { type: 'lava', rate: 1, t: 0.78 }, ...looks });
const never = biome({ id: 121, name: 'test-no-ice', kin: B.FROST, gen: BIOMES[1].gen, ...looks });

const game = await makeGame(7), w = game.world, d = game.drill;
arena(game, 30, K.SOFT, quick.id);
rect(game, -30, 10, 30, 30, K.SOFT, never.id);
rect(game, -30, -30, 30, -10, K.SOFT, B.FROST);
game.changed();

// Ice: one cell cut in each ground, far from the drill and its tether.
const cuts = { quick: at(12, 3), never: at(12, 14), frost: at(12, -14) };
for (const i of Object.values(cuts)) game.finishDig(i);
const open = name => w.k(cuts[name]) === K.EMPTY;
idle(game, 4);
check(open('quick') && open('never') && open('frost'), 'a cut closed within 4 seconds');
idle(game, 2);
check(w.k(cuts.quick) === K.ICE, `a cut in ground that freezes in 5 seconds is ${w.k(cuts.quick)} after 6`);
idle(game, 22);
check(open('frost'), 'a cut in the north closed before its 30 seconds');
idle(game, 4);
check(w.k(cuts.frost) === K.ICE && open('never'), `after 32 seconds the cut in the north is ${w.k(cuts.frost)} and the one in ground that never freezes is ${w.k(cuts.never)}`);
check(!game.frostOpen.includes(cuts.never) && !w.dug.has(cuts.never), 'a cut in ground that never freezes is being watched for ice');

// Lava: a pocket of the row's ground, woken by a cut beside it, pours as far as the row says.
w.setK(at(-12, 3), K.HAZARD);
game.finishDig(at(-11, 3));
check(w.lava.has(at(-12, 3)) && game.lavaVol.get(at(-12, 3)) === 2, `a lava pocket in ground of lavaVol 2 holds ${game.lavaVol.get(at(-12, 3))}`);

// Cutting: the drill pushed east from the core into the first cell of the row's ground.
for (let f = 0; f < 240 && d.dig < 0; f++) { game.input.auto = [1, 0, 1]; game.update(1 / 60); }
game.input.auto = null;
check(d.dig === at(3, 0) && d.digDur === digTime(K.SOFT, quick) && d.digDur === 0.48, `a soft cell in ground of dig 2 takes ${d.digDur} s with the first bit (cutting cell ${d.dig - at(0, 0)})`);

// The dark and the motes: the drill has been in the row's ground all along.
idle(game, 6);
check(game.gloom.every((c, n) => Math.abs(c - looks.gloom[n]) < 0.5) && Math.abs(game.murk - 0.5) < 0.01, `the dark is ${game.gloom.map(c => c.toFixed(1))} deep ${game.murk.toFixed(3)}, not the row's`);
// (Motes near the drill's own row: the north's, born ten cells up, fall no more than five in their lives.)
const born = game.motes.filter(m => Math.abs(m.y - d.y * 16) < 3 * 16);
check(born.length > 0 && born.every(m => m.mote === quick.mote), 'motes over the row\'s ground are not the row\'s');

// Sheets and colours.
check(game.rockSheet(K.SOFT, quick.id) === 'gilt' && game.rockSheet(K.SLATE, quick.id) === 'slate', `soft rock of the row is drawn from ${game.rockSheet(K.SOFT, quick.id)}`);
check(game.debris(K.SOFT, quick.id) === quick.debris && game.debris(K.SLATE, quick.id) !== quick.debris, 'chips of the row\'s rock are not the row\'s colours, or slate\'s are');
check(JSON.stringify([game.overlay(K.ORE_A, quick), game.overlay(K.DENSE, quick), game.overlay(K.CACHE, quick), game.overlay(K.SOFT, quick)]) === JSON.stringify([['mire-items', 'oreA'], ['mire-items', 'dense'], ['finds', 'cache'], null]),
  'ore of the row is not drawn from the sheet it names');
check(JSON.stringify(game.overlay(K.HAZARD, quick)) === JSON.stringify(['ember-items', 'hazard']) && game.overlay(K.HAZARD, never) === null, 'a lava pocket is not drawn from the lava\'s own sheet, or a hazard is drawn in ground that has none');
check(JSON.stringify(game.overlay(K.RELIC, never)) === JSON.stringify(['frost-items', 'relic']), 'a relic is not drawn from its direction\'s sheet');

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: ice, lava, cutting, the dark, the motes and the sheets all follow the row of the ground');
process.exit(fails.length ? 1 : 0);
