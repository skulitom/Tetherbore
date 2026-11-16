// Metal is hard. Steel and the iron of keystones take three times as long to cut as their kind says (METAL), with
// any bit, until the drill is fitted with the DIAMOND TIP, the fifth row of WORKS, paid for in grit and the north's
// specimens (starglass is the north's pocket mineral); then they cut as fast as they always did. Nothing else is
// slower. The tip shows on the drill.
//   node test/regress/m-metal-tip.mjs
import { makeGame, world, WORKS, C, N } from '../harness.mjs';
import { arena, at, idle, fixRandom } from './lib/lasso.mjs';
const { K, B, BIOMES, digTime } = world;
const { METAL, METALS, SPEED } = await import('../../js/game.js');
const { sheets } = await import('../../js/atlas.js');

fixRandom(3);
const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const tip = WORKS.find(u => u.id === 'diamond'), near = (a, b) => Math.abs(a - b) < 1e-9;

check(METAL === 3 && METALS.length === 2 && METALS.includes(K.STEEL) && METALS.includes(K.KEY), `metal is ${METALS} at ${METAL} times`);
check(tip && tip.name === 'DIAMOND TIP' && tip.kin === B.FROST && tip.values.join() === '0,1' && tip.spec[0] > 0 && tip.grit[0] > 0, `the diamond tip's row: ${JSON.stringify(tip)}`);

// ---- how long each kind takes, with and without the tip, at the first bit and the last
{
  const game = await makeGame(7), row = BIOMES[B.EMBER];
  for (const bit of [0, SPEED.length - 1]) {
    game.S.lv.drill = bit;
    for (const k of [K.STEEL, K.KEY, K.SOFT, K.SLATE, K.VAULT, K.SLAG]) {
      const plain = digTime(k, row) / SPEED[bit], metal = METALS.includes(k);
      game.S.lv.diamond = 0;
      check(near(game.cutTime(k, row), plain * (metal ? 3 : 1)), `bit ${bit}, no tip: kind ${k} takes ${game.cutTime(k, row)} s, not ${plain * (metal ? 3 : 1)}`);
      game.S.lv.diamond = 1;
      check(near(game.cutTime(k, row), plain), `bit ${bit}, the tip: kind ${k} takes ${game.cutTime(k, row)} s, not ${plain}`);
    }
  }
}

// ---- in play: the drill cutting a cell of steel, then the same with the tip
for (const fitted of [0, 1]) {
  const game = await makeGame(7), d = game.drill;
  arena(game, 30, K.SOFT, B.EMBER);
  game.world.setK(at(3, 0), K.STEEL);
  game.changed();
  game.S.lv.diamond = fitted;
  for (let f = 0; f < 240 && d.dig < 0; f++) { game.input.auto = [1, 0, 1]; game.update(1 / 60); }
  const want = 0.6 * (fitted ? 1 : 3);
  check(d.dig === at(3, 0) && near(d.digDur, want), `${fitted ? 'with' : 'without'} the tip a cell of steel takes ${d.digDur} s to cut, not ${want}`);
  // It is cut, in the time it says.
  let frames = 0;
  for (; frames < 400 && game.world.k(at(3, 0)) !== K.EMPTY; frames++) { game.input.auto = [1, 0, 1]; game.update(1 / 60); }
  check(game.world.k(at(3, 0)) === K.EMPTY && Math.abs(frames / 60 - want) < 0.15, `${fitted ? 'with' : 'without'} the tip the steel was cut in ${(frames / 60).toFixed(2)} s`);
  game.input.auto = null;
}

// ---- bought with the north's specimens, and shown on the drill
{
  const game = await makeGame(7);
  game.S.grit = 1e9;
  game.buy(tip);
  check(game.S.lv.diamond === 0 && game.shopNote?.text === 'NORTH POCKETS', `with no specimens the tip was ${game.S.lv.diamond ? 'bought' : 'refused'}, saying '${game.shopNote?.text}'`);
  game.S.spec[B.FROST] = tip.spec[0];
  game.buy(tip);
  check(game.S.lv.diamond === 1 && game.S.spec[B.FROST] === 0 && game.cost(tip) === null, `with ${tip.spec[0]} of the north's specimens the tip is at level ${game.S.lv.diamond}, ${game.S.spec[B.FROST]} left`);
  check(!!sheets.drill.frames['fit-diamond'], 'the drill has no picture of the tip');
  let threw = null;
  try { game.resize(320, 568, 1); game.render(); game.shop = true; game.shopRise = 1; game.shopTab = 'works'; game.render(); idle(game, 0.5); } catch (error) { threw = error; }
  check(!threw, `drawing the tip or its row threw: ${threw?.message}`);
}

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : `ok: steel and keys take ${METAL} times as long without the diamond tip, and as long as their kind says with it; the tip is bought with the north's specimens and shows on the drill`);
process.exit(fails.length ? 1 : 0);
