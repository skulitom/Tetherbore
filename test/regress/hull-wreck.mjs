// The hull. A knock takes a pip and for a moment after nothing takes another; the last pip gone, the drill is a
// wreck and its own tether winds it home, whatever the thumb does, from however far and however the tether is
// wound, within the time TOW allows; it docks mended, in the middle of the core, and leaves only on a fresh stroke.
// Nothing banked is lost. Riding on to the core mends a hull that is only dented. HULL is the shop's sixth row, a
// pip a level from three to seven, and a game saved before there was a hull loads with three.
import { makeGame, tetherFaults, random, TOW, UPGRADES, B, C } from '../harness.mjs';

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const HX = C + 0.5, HY = C + 0.5;
const fly = (game, x, y, seconds) => { game.input.auto = [x, y, 1]; for (let f = 0; f < seconds * 60; f++) game.update(1 / 60); game.input.auto = null; };
const rest = (game, seconds) => { for (let f = 0; f < seconds * 60; f++) game.update(1 / 60); };

// ---- knocks, the moment after, and the last pip
{
  const game = await makeGame(7, { drill: 4 }, { hull: true });
  fly(game, 1, 0, 3);
  check(Math.hypot(game.drill.x - HX, game.drill.y - HY) > 4 && game.hull === 3, `three seconds east the drill is ${Math.hypot(game.drill.x - HX, game.drill.y - HY).toFixed(1)} cells out with ${game.hull} pips`);
  check(game.hit(0.3) === true && game.hull === 2 && game.drill.stun > 0, `a knock left ${game.hull} pips and a stun of ${game.drill.stun}`);
  check(game.hit(0.3) === false && game.hull === 2, `a second knock at once left ${game.hull} pips`);
  rest(game, 1.6);
  check(game.hit(0.3) === true && game.hull === 1 && game.drill.mode !== 'tow', `a knock after the moment had passed left ${game.hull} pips`);
  rest(game, 1.6);
  const grit = game.S.grit;
  check(game.hit(0.3) === true && game.hull === 0 && game.drill.mode === 'tow' && game.notice?.title === 'HULL GONE', `the last knock: ${game.hull} pips, mode ${game.drill.mode}, the screen says ${game.notice?.title}`);
  game.render();
  // The thumb does nothing to a wreck.
  let frames = 0;
  game.input.auto = [1, 0, 1];
  while (game.drill.mode === 'tow' && frames < 2000) { game.update(1 / 60); frames++; if (frames % 9 === 0) game.render(); }
  check(game.drill.mode === 'free' && game.drill.x === HX && game.drill.y === HY && game.hull === 3 && game.band.length === 2, `after ${frames} frames the wreck is ${game.drill.mode} at ${game.drill.x - HX},${game.drill.y - HY} with ${game.hull} pips and a tether of ${game.band.length} points`);
  check(frames <= (TOW.wait + TOW.most + 1) * 60, `the tow home took ${frames} frames`);
  // Still held, the thumb does not take it out again: it leaves on a fresh stroke.
  for (let f = 0; f < 30; f++) game.update(1 / 60);
  check(game.drill.x === HX && game.drill.y === HY, 'the docked drill left the core with the thumb still down from before');
  game.input.auto = null; game.update(1 / 60);
  fly(game, 1, 0, 1);
  check(game.drill.x > HX + 1, 'the mended drill does not leave the core on a fresh stroke');
  check(game.S.grit >= grit && game.wrecks === 1 && !tetherFaults(game).length, `after the wreck: grit ${game.S.grit} (was ${grit}), ${game.wrecks} wrecks, tether ${tetherFaults(game).join('; ')}`);
}

// ---- a wreck at the end of a long, wound tether, on three worlds: home within the time, the tether sound after
for (const seed of [7, 19, 23]) {
  const game = await makeGame(seed, { tether: 5, drill: 4, momentum: 3 }, { hull: true }), rnd = random(seed * 31 + 5);
  let heading = rnd() * 6.283;
  for (let turn = 0; turn < 60; turn++) {
    heading += (rnd() - 0.5) * 2.4;
    fly(game, Math.cos(heading), Math.sin(heading), 0.4 + rnd() * 0.8);
    if (game.drill.mode === 'tow') break;
  }
  const far = Math.hypot(game.drill.x - HX, game.drill.y - HY), bends = game.band.length, grit = game.S.grit;
  if (game.drill.mode !== 'tow') { game.dents = game.val('hull') - 1; game.shield = 0; game.hit(0.3); }
  check(game.drill.mode === 'tow', `world ${seed}: the last knock did not wreck the drill`);
  let frames = 0, bad = null;
  game.input.auto = [Math.cos(heading), Math.sin(heading), 1];
  while (game.drill.mode === 'tow' && frames < 2000) {
    game.update(1 / 60); frames++;
    if (!Number.isFinite(game.drill.x) || !Number.isFinite(game.drill.y)) { bad = 'the drill is nowhere'; break; }
  }
  game.input.auto = null; game.update(1 / 60);
  check(!bad && game.drill.mode === 'free' && game.drill.x === HX && game.drill.y === HY && game.hull === 3, `world ${seed}: from ${far.toFixed(0)} cells out on a tether of ${bends} points the wreck is ${bad ?? game.drill.mode} after ${frames} frames, at ${(game.drill.x - HX).toFixed(1)},${(game.drill.y - HY).toFixed(1)}`);
  check(frames <= (TOW.wait + TOW.most + 1) * 60, `world ${seed}: the tow home from ${far.toFixed(0)} cells out took ${frames} frames`);
  check(game.S.grit >= grit && !tetherFaults(game).length, `world ${seed}: after the tow grit is ${game.S.grit} (was ${grit}) and the tether ${tetherFaults(game).join('; ')}`);
  // And it flies on as before.
  fly(game, 0, 1, 2);
  check(!tetherFaults(game).length && game.drill.y > HY + 2, `world ${seed}: flying on after the tow, the tether: ${tetherFaults(game).join('; ')}`);
}

// ---- riding on to the core mends
{
  const game = await makeGame(7, { drill: 4 }, { hull: true });
  fly(game, 1, 0, 3); game.hit(0.3); rest(game, 1);
  check(game.hull === 2, `a knock out east left ${game.hull} pips`);
  fly(game, -1, 0, 4);
  check(game.hull === 3 && game.drill.mode !== 'tow', `back on the core the hull has ${game.hull} pips`);
}

// ---- the row, and a game saved before there was a hull
{
  const row = UPGRADES[5];
  check(UPGRADES.length === 6 && row.id === 'hull' && row.name === 'HULL' && row.values.join() === '3,4,5,6,7' && row.gem === B.EMBER, `the shop's sixth row is ${row?.id} with values ${row?.values}`);
  check(row.gems[0] === 0 && row.grit.every((g, l) => l === 0 || g > row.grit[l - 1]), `the hull's prices are ${row.grit} grit and ${row.gems} gems`);
  const game = await makeGame(7, {}, { hull: true });
  game.S.grit = 1e9; game.S.gems[B.EMBER] = 1e6;
  for (let l = 0; l < 4; l++) game.buy(row);
  check(game.S.lv.hull === 4 && game.val('hull') === 7 && game.hull === 7 && game.cost(row) === null, `four levels bought: level ${game.S.lv.hull}, ${game.hull} pips`);
  game.shop = true; game.shopRise = 1; game.render(); game.shop = false; game.render();
  game.save();
  const loaded = await makeGame(7, {}, { hull: true }); await loaded.restore();
  check(loaded.S.lv.hull === 4 && loaded.hull === 7, `loaded, the hull is at level ${loaded.S.lv.hull} with ${loaded.hull} pips`);
  const { hull, ...lv } = game.S.lv;
  localStorage.setItem('tetherbore-save-v3', JSON.stringify({ v: 3, ...game.S, lv }));
  const old = await makeGame(7, {}, { hull: true }); await old.restore();
  check(old.S.lv.hull === 0 && old.hull === 3, `a game saved before there was a hull loads at level ${old.S.lv.hull} with ${old.hull} pips`);
}

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : 'no defect: knocks take pips, the last makes a wreck that its tether winds home mended, and HULL is sold a pip a level');
process.exit(fails.length ? 1 : 0);
