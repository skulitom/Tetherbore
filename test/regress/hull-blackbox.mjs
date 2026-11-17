// The black box's lore (js/game.js: `revert`, `keepLore`, LORE; CORE, js/shop.js). From its third level (75%) a
// drill lost keeps the box's share of the gems and the specimens the trip had earned, as it keeps that share of the
// grit, and everything the trip learnt: the lab's samples, the grounds and pockets met, the rare hazards met and the
// kinds of creature met. A wreck's part and a relic are not kept: they lie where the drill was lost. With the hull
// on, a trip flown out of the core and earned on by hand, then the drill knocked to pieces:
//   - at the third level, 75 of every hundred of the trip's grit, gems and specimens are kept (whole), and every
//     sample, ground, pocket, rare hazard and creature met since the docking, and the count of kinds analysed
//     with them; a wreck's part found on the trip is not;
//   - at the second level, half the grit, and the gems, the specimens and the lore are lost, as ever.
// Fails on the game before the box kept lore: at the third level the gems, specimens and lore are lost.
//   node test/regress/hull-blackbox.mjs
import { makeGame, C } from '../harness.mjs';
import { fixRandom } from './lib/lasso.mjs';

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const fly = (game, x, y, seconds) => { game.input.auto = [x, y, 1]; for (let f = 0; f < seconds * 60; f++) game.update(1 / 60); game.input.auto = null; };

const trip = async box => {
  fixRandom(12);
  const game = await makeGame(7, { drill: 4, blackbox: box }, { hull: true }), S0 = game.S;
  S0.grit = 1000; S0.gems = [0, 100, 100, 100, 100]; S0.spec = [0, 10, 10, 10, 10]; S0.lab['lode-items:oreA'] = 2;
  fly(game, 1, 0, 2);
  const S = game.S;
  // Earned on the trip.
  S.grit += 4000; S.gems[1] += 40; S.gems[2] += 80; S.gems[3] += 3; S.gems[4] += 0; S.spec[1] += 4.5; S.spec[2] += 8; S.spec[3] += 1;
  S.lab['lode-items:oreA'] = 5; S.lab['ember-items:oreA'] = 1; S.lab['frost-items:oreB'] = 1;
  S.met[30] = 1; S.visited['z7,-3'] = 1; S.rare.bell = 1; S.wrecks[0] = 1;
  (S.fauna ??= { pal: null, met: {}, spent: [] }).met.bat = 1; S.fauna.met.moth = 1;
  game.analyse('lode-items:oreB', C, C, false);
  // Knocked to pieces. (What the trip earned is what was banked at the docking, 1,000, from what is banked as the
  // game goes back: the station's trickle comes in while the wreck lies dead.)
  let earned = -1;
  const revert = game.revert.bind(game);
  game.revert = () => { earned = game.S.grit - 1000; revert(); };
  while (game.drill.mode !== 'dead') { game.shield = 0; game.hit(0.3); }
  for (let f = 0; f < 120; f++) game.update(1 / 60);
  return { game, S: game.S, earned };
};

{
  const { game, S, earned } = await trip(3);
  check(game.drill.mode === 'free' && game.notice?.title === 'TRIP LOST', `the trip was not lost: ${game.drill.mode}, ${game.notice?.title}`);
  check(S.grit === 1000 + Math.round(0.75 * earned), `at the black box's third level ${S.grit - 1000} grit was kept of ${earned}`);
  check(S.gems.join() === '0,130,160,102,100', `at the third level the gems are ${S.gems}, not 0,130,160,102,100`);
  check(S.spec.map(n => +n.toFixed(2)).join() === '0,13,16,10,10', `at the third level the specimens are ${S.spec}, not 0,13,16,10,10`);
  check(S.lab['lode-items:oreA'] === 5 && S.lab['ember-items:oreA'] === 1 && S.lab['frost-items:oreB'] === 1 && S.lab['lode-items:oreB'] === 1, `at the third level the lab is ${JSON.stringify(S.lab)}`);
  check(game.known === 4, `the count of kinds analysed is ${game.known}, not 4`);
  check(S.met[30] === 1 && S.visited['z7,-3'] === 1 && S.rare.bell === 1, `at the third level the grounds, pockets and rare hazards met: ${JSON.stringify({ met: S.met[30], visited: S.visited, rare: S.rare })}`);
  check(S.fauna?.met?.bat === 1 && S.fauna.met.moth === 1, `at the third level the creatures met: ${JSON.stringify(S.fauna)}`);
  check(!S.wrecks[0], 'the wreck\'s part found on the trip was kept');
  game.render();
}
{
  const { S, earned } = await trip(2);
  check(S.grit === 1000 + Math.round(0.5 * earned), `at the black box's second level ${S.grit - 1000} grit was kept of ${earned}`);
  check(S.gems.join() === '0,100,100,100,100' && S.spec.join() === '0,10,10,10,10', `at the second level the gems are ${S.gems} and the specimens ${S.spec}`);
  check(S.lab['lode-items:oreA'] === 2 && !S.lab['ember-items:oreA'] && !S.met[30] && !S.rare.bell && !S.fauna?.met?.bat, `at the second level the lore was kept: ${JSON.stringify({ lab: S.lab, met: S.met[30], rare: S.rare, fauna: S.fauna })}`);
}
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: at the black box\'s third level a lost trip keeps three quarters of its gems and specimens and all it learnt; at the second, half its grit and nothing more');
process.exit(fails.length ? 1 : 0);
