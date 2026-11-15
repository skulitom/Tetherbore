// Plays the game with no one watching and fails on anything thrown, a tether fault, money that is not a number, or a
// haul that never finishes. Flies at random from the core and from a start deep in each direction, draws every few
// frames (into a canvas that swallows it, which still catches a missing sprite), buys what it can, opens the shop
// and sets off bombs.
//   node test/smoke.mjs [seed] [turns]
import { makeGame, random, tetherFaults, UPGRADES, C, N, K } from './harness.mjs';

const [seed = 7, turns = 120] = process.argv.slice(2).map(Number);
const problems = [];
const note = (where, what) => { if (problems.length < 20) problems.push(`${where}: ${what}`); };

for (const [name, sx, sy, reach] of [['home', 0, 0, 4], ['north', 0, -260, 6], ['south', 0, 260, 6], ['west', -260, 0, 6], ['east', 260, 0, 6], ['far north-east', 700, -700, 8], ['far south', 0, 1300, 9]]) {
  const game = await makeGame(seed, { tether: reach, drill: 3, bombs: 2 });
  const d = game.drill, w = game.world, rnd = random(seed + sx * 3 + sy * 7);
  if (sx || sy) {
    const len = Math.hypot(sx, sy);
    for (let s = 0; s <= len; s += 0.5) for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) w.setK((C + Math.round(sy * s / len) + v) * N + C + Math.round(sx * s / len) + u, K.EMPTY);
    d.x = C + sx + 0.5; d.y = C + sy + 0.5; d.mode = 'free';
    game.band = [[d.x, d.y], [C + 0.5, C + 0.5]];
    game.changed();
  }
  game.S.grit = 5e6; game.S.gems = [0, 5000, 5000, 5000, 5000];
  let heading = rnd() * 6.283, frames = 0;
  try {
    for (let turn = 0; turn < turns; turn++) {
      heading += (rnd() - 0.5) * 2.5;
      const hold = 10 + Math.floor(rnd() * 50);
      for (let f = 0; f < hold; f++) {
        game.input.auto = [Math.cos(heading), Math.sin(heading), 1];
        game.update(1 / 60); frames++;
        if (frames % 7 === 0) game.render();
        const faults = tetherFaults(game);
        if (faults.length) note(name, `frame ${frames}: ${faults[0]}`);
      }
      if (turn % 9 === 4) { game.blast?.(); }
      if (turn % 13 === 6) { game.shop = true; game.shopRise = 1; game.render(); for (const u of UPGRADES) if (rnd() < 0.3) game.buy(u); game.render(); game.shop = false; game.shopRise = 0; }
      if (!Number.isFinite(game.S.grit) || game.S.grit < 0) note(name, `grit is ${game.S.grit}`);
      if (game.S.gems.some(g => !Number.isFinite(g) || g < 0)) note(name, `gems are ${game.S.gems}`);
      for (const h of game.hauls) if (h.t > 40) note(name, `a haul of ${h.n} cells has run ${h.t.toFixed(0)} s`);
    }
    // Let go and wait: every haul must come home.
    game.input.auto = null;
    for (let f = 0; f < 1800 && game.hauls.length; f++) { game.update(1 / 60); if (f % 11 === 0) game.render(); }
    if (game.hauls.length) note(name, `${game.hauls.length} haul(s) never finished`);
    game.save();
  } catch (error) {
    note(name, `threw at frame ${frames}: ${error.stack.split('\n').slice(0, 4).join(' | ')}`);
  }
  console.log(`${name}: ${frames} frames, ${game.S.stats.hauls} hauls, at ${(d.x - C - 0.5).toFixed(0)},${(d.y - C - 0.5).toFixed(0)}`);
}
if (problems.length) { console.log('PROBLEMS\n' + problems.join('\n')); process.exit(1); }
console.log('ok');
