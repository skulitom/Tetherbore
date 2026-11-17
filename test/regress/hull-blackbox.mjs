// The black box's lore (js/game.js: `revert`, `keepLore`, LORE; CORE, js/shop.js). From its third level (75%) a
// drill lost keeps the box's share of the grit the trip had earned, as every level does, and everything the trip
// learnt: the lab's samples, the grounds and pockets met, the rare hazards met and the kinds of creature met. Not the
// trip's gems or specimens: the ground comes back as it was at the docking, and with it every pocket the trip
// hauled. A wreck's part and a relic are not kept: they lie where the drill was lost. With the hull on, a trip flown
// out of the core and earned on by hand, then the drill knocked to pieces:
//   - at the third level, 75 of every hundred of the trip's grit are kept, and every sample, ground, pocket, rare
//     hazard and creature met since the docking, and the count of kinds analysed with them; the gems, the
//     specimens and a wreck's part found on the trip are not;
//   - at the second level, half the grit, and the lore is lost, as ever;
//   - a pocket hauled and then the drill lost, four times over at the box's last level: the pocket is whole again
//     each time and not one specimen is kept, so a pocket pays its specimens once however many trips are lost.
// Fails on the game before the box kept lore, where at the third level the lore is lost; and on the game that kept
// a share of a lost trip's gems and specimens too, which paid a pocket's specimens again on every wreck after it.
//   node test/regress/hull-blackbox.mjs
import { makeGame, C, N, K } from '../harness.mjs';
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
  check(S.gems.join() === '0,100,100,100,100' && S.spec.join() === '0,10,10,10,10', `at the third level the gems are ${S.gems} and the specimens ${S.spec}, not as they were at the docking`);
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
{
  // The nearest pocket with mineral in it, hauled and then lost, four times: the pocket comes back with the ground
  // each time, and nothing of what it paid is kept.
  fixRandom(12);
  const game = await makeGame(7, { blackbox: 4, hull: 4 }, { hull: true }), w = game.world;
  let cells = [];
  for (const Z of w.pocketsWithin(400)) {
    const r = Math.ceil((Z.rho ?? 6) * 1.5);
    cells = [];
    for (let y = Z.cy - r; y <= Z.cy + r; y++) for (let x = Z.cx - r; x <= Z.cx + r; x++) if (w.k(y * N + x) === K.MINERAL) cells.push(y * N + x);
    if (cells.length) break;
  }
  check(cells.length > 0, 'no pocket with mineral in it within 400 cells of the core');
  const docked = game.S.spec.join(), rounds = [];
  for (let round = 0; round < 4 && cells.length; round++) {
    game.dockMark();
    const whole = cells.every(i => w.k(i) === K.MINERAL), was = game.S.spec.reduce((a, b) => a + b, 0);
    game.haul(cells);
    const paid = +(game.S.spec.reduce((a, b) => a + b, 0) - was).toFixed(2);
    while (game.drill.mode !== 'dead') { game.shield = 0; game.hit(0.3); }
    for (let f = 0; f < 200; f++) game.update(1 / 60);
    rounds.push({ whole, paid, spec: game.S.spec.join() });
  }
  check(rounds.every(r => r.whole && r.paid > 0 && r.spec === docked), `a pocket hauled and lost four times over: ${JSON.stringify(rounds)}, the specimens at the docking ${docked}`);
}
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: at the black box\'s third level a lost trip keeps three quarters of its grit and all it learnt, and no gem or specimen of the ground that comes back with the docking; at the second, half its grit and nothing more');
process.exit(fails.length ? 1 : 0);
