// The live catch (js/game.js: `alive`, `payOf`, `haul`, `haulTitle`; CORE, js/shop.js). With it a rare hazard hauled
// while it is awake pays its lump the row's value times: a rime bell whose fuse burns, a fumarole rumbling or between
// its jets, a lodestone humming or pulling, and a glowworm swimming, which paid twice with none and never pays less.
// Each staged at the heart of a cell of its own direction's ground, woken as a cut beside it wakes it:
//   - asleep each pays one lump, at every level;
//   - awake, at the first level (x2) two lumps and at the second (x3) three; with none bought, one (and a glowworm
//     swimming two, as it always has);
//   - cooling after it went off (a bell that has tolled, a fumarole after its jets, a lodestone settled), one lump;
//   - hauled awake with the live catch bought, the haul is called CAUGHT LIVE! and says CAUGHT where it was; with
//     none bought, a woken bell's haul is called by the bell's name and a glowworm's says CAUGHT, as ever.
// Fails on the game before there was a live catch: a woken bell, fumarole or lodestone pays one lump.
//   node test/regress/c9-live-catch.mjs
import { makeGame, world, C, N, income } from '../harness.mjs';
import { round2 } from '../../js/shop.js';
import { arena, at, fixRandom } from './lib/lasso.mjs';
const { K, B } = world;

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const lump = round2(income(22) * 12);
const GROUND = { bell: B.FROST, vent: B.EMBER, lodestone: B.LODE, worm: B.MIRE };
const MAP = { bell: 'bells', vent: 'vents', lodestone: 'stones', worm: 'worms' };

const stage = async (type, live) => {
  fixRandom(11);
  const game = await makeGame(7, { tether: 3, livecatch: live }), w = game.world, heart = at(16, 0);
  arena(game, 30, K.SOFT, GROUND[type]);
  w.setK(heart, K.RARE);
  game.changed();
  return { game, w, heart };
};
const lumps = (game, heart) => game.payOf([heart]).lump / lump;

for (const type of ['bell', 'vent', 'lodestone', 'worm']) for (const live of [0, 1, 2]) {
  const { game, heart } = await stage(type, live), want = type === 'worm' ? Math.max(2, live + 1) : live + 1;
  check(game.world.hazAt(heart) === type, `the staging is wrong: the heart is ${game.world.hazAt(heart)}`);
  check(lumps(game, heart) === 1, `a ${type} asleep pays ${lumps(game, heart)} lumps with the live catch at ${live}`);
  game.trigger(heart, type, false);
  const m = game[MAP[type]].get(heart);
  if (type === 'worm') m.t = 1;
  const awake = lumps(game, heart), pay = game.payOf([heart]);
  check(awake === want && pay.caught === (want > 1 ? 1 : 0) && pay.live === (live > 0), `a ${type} awake pays ${awake} lumps (caught ${pay.caught}, live ${pay.live}) with the live catch at ${live}, not ${want}`);
  if (type !== 'worm') {
    m.cool = 1;
    check(lumps(game, heart) === 1, `a ${type} cooling pays ${lumps(game, heart)} lumps with the live catch at ${live}`);
    m.cool = 0;
  }
  // Hauled awake.
  const said = [], popup = game.popup.bind(game);
  game.popup = (x, y, label, ...rest) => { said.push(label); popup(x, y, label, ...rest); };
  game.haul([heart]);
  const title = game.hauled.title, caught = said.includes('CAUGHT');
  if (live) check(title === 'CAUGHT LIVE!' && caught, `a ${type} hauled awake with the live catch at ${live} was called ${title} and said ${said.join(', ')}`);
  else check(title !== 'CAUGHT LIVE!' && caught === (type === 'worm'), `a ${type} hauled awake with no live catch was called ${title} and said ${said.join(', ')}`);
}
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: with the live catch a rare hazard hauled awake pays its lump two and three times over and is called CAUGHT LIVE; asleep or cooling it pays one, and with none bought only a swimming glowworm pays twice');
process.exit(fails.length ? 1 : 0);
