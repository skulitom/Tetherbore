// The hull, and losing the drill. A knock takes a pip and for three seconds after nothing takes another; with the last
// pip gone the drill is lost: it lies dead for DEATH seconds, whatever the thumb does, and then the game is what it
// was at the last docking (the moment the drill last left the core): what was banked, bought and analysed then,
// and the ground as it was then, every cut and haul since undone. The drill stands whole in the middle of the core
// and leaves only on a fresh stroke; the screen says TRIP LOST and what it cost. What was banked before leaving is
// kept. Riding on to the core mends a hull that is only dented. HULL is the shop's sixth row, a pip a level from
// five to nine, and a game saved before there was a hull loads with five.
// Ground hauled away is known to be gone without the drill going to look (the map shows it open).
import { makeGame, tetherFaults, random, DEATH, UPGRADES, K, B, N, C, world } from '../harness.mjs';
const { G } = world;

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const HX = C + 0.5, HY = C + 0.5;
const fly = (game, x, y, seconds) => { game.input.auto = [x, y, 1]; for (let f = 0; f < seconds * 60; f++) game.update(1 / 60); game.input.auto = null; };
const rest = (game, seconds) => { for (let f = 0; f < seconds * 60; f++) game.update(1 / 60); };

// ---- knocks, the moment after, the last pip, and the game gone back
{
  const game = await makeGame(7, { drill: 4 }, { hull: true }), w = game.world;
  game.S.grit = 500;
  // A cell far to the east that the trip will cut by hand, and what it is now.
  const cell = C * N + C + 9, was = w.k(cell), seen = w.s(C * N + C + 30);
  fly(game, 1, 0, 3);
  const out = Math.hypot(game.drill.x - HX, game.drill.y - HY);
  check(out > 4 && game.hull === 5 && w.k(cell) === K.EMPTY && was !== K.EMPTY, `three seconds east the drill is ${out.toFixed(1)} cells out with ${game.hull} pips; the cell on its way was ${was} and is ${w.k(cell)}`);
  // Out on the trip: grit earned, a sample analysed.
  game.S.grit += 250; game.S.lab['lode-items:oreA'] = 3;
  check(game.hit(0.3) === true && game.hull === 4 && game.drill.stun > 0, `a knock left ${game.hull} pips and a stun of ${game.drill.stun}`);
  check(game.hit(0.3) === false && game.hull === 4, `a second knock at once left ${game.hull} pips`);
  // (Nothing lands for three seconds after a knock: not a second and a half after, and then again.)
  rest(game, 1.6);
  check(game.hit(0.3) === false && game.hull === 4, `a knock a second and a half after the last left ${game.hull} pips`);
  rest(game, 1.6);
  check(game.hit(0.3) === true && game.hull === 3 && game.drill.mode !== 'dead', `a knock after the moment had passed left ${game.hull} pips`);
  for (const left of [2, 1]) { rest(game, 3.1); check(game.hit(0.3) === true && game.hull === left && game.drill.mode !== 'dead', `the next knock left ${game.hull} pips`); }
  rest(game, 3.1);
  check(game.hit(0.3) === true && game.hull === 0 && game.drill.mode === 'dead' && game.notice?.title === 'HULL GONE', `the last knock: ${game.hull} pips, mode ${game.drill.mode}, the screen says ${game.notice?.title}`);
  game.render();
  // The thumb does nothing to a dead drill, and it lies where it fell.
  const at = [game.drill.x, game.drill.y];
  let frames = 0;
  game.input.auto = [1, 0, 1];
  while (game.drill.mode === 'dead' && frames < 600) { game.update(1 / 60); frames++; if (game.drill.mode === 'dead') check(game.drill.x === at[0] && game.drill.y === at[1], 'a dead drill moved'); if (frames % 9 === 0) game.render(); }
  check(Math.abs(frames - DEATH * 60) <= 2, `the drill lay dead for ${frames} frames, where DEATH is ${DEATH} s`);
  check(game.drill.mode === 'free' && game.drill.x === HX && game.drill.y === HY && game.hull === 5 && game.band.length === 2, `after it the drill is ${game.drill.mode} at ${game.drill.x - HX},${game.drill.y - HY} with ${game.hull} pips and a tether of ${game.band.length} points`);
  check(game.S.grit === 500 && !game.S.lab['lode-items:oreA'], `the game went back to grit ${game.S.grit} and a lab of ${JSON.stringify(game.S.lab)}`);
  check(w.k(cell) === was && w.s(C * N + C + 30) === seen, `the cell cut on the trip is ${w.k(cell)} (was ${was}); the ground the trip saw is ${w.s(C * N + C + 30) ? 'still seen' : 'unseen again'}`);
  // (250 put in the purse by this test, and whatever the cutting itself brought home.)
  check(game.notice?.title === 'TRIP LOST' && /^-2[5-9]\d GRIT$/.test(game.notice.sub), `the screen says ${game.notice?.title} / ${game.notice?.sub}`);
  game.render();
  // Still held, the thumb does not take it out again: it leaves on a fresh stroke.
  for (let f = 0; f < 30; f++) game.update(1 / 60);
  check(game.drill.x === HX && game.drill.y === HY, 'the drill left the core with the thumb still down from before');
  game.input.auto = null; game.update(1 / 60);
  fly(game, 1, 0, 1);
  check(game.drill.x > HX + 1 && !tetherFaults(game).length && game.wrecks === 1, `on a fresh stroke the drill is at ${(game.drill.x - HX).toFixed(1)}; tether ${tetherFaults(game).join('; ')}`);
  // What is banked before leaving is kept: home, bank, out again, lost.
  fly(game, -1, 0, 3); rest(game, 0.5);
  game.S.grit = 900;
  fly(game, 0, 1, 2);
  game.S.grit = 1500;
  game.dents = game.val('hull') - 1; game.shield = 0; game.hit(0.3);
  rest(game, DEATH + 0.2);
  check(game.drill.mode === 'free' && game.S.grit === 900, `banked 900 at the core, 600 more on the trip, lost: grit is ${game.S.grit}`);
  // The game saved is the game gone back to.
  const loaded = await makeGame(7, {}, { hull: true }); await loaded.restore();
  check(loaded.S.grit === 900, `loaded after the loss, grit is ${loaded.S.grit}`);
}

// ---- lost at the end of a long, wound tether, on three worlds: back at the core, the tether sound, the ground as it was
for (const seed of [7, 19, 23]) {
  const game = await makeGame(seed, { tether: 5, drill: 4, momentum: 3 }, { hull: true }), rnd = random(seed * 31 + 5), w = game.world;
  // The ground near the core as it is before the trip.
  const near = []; for (let y = -24; y <= 24; y++) for (let x = -24; x <= 24; x++) near.push((C + y) * N + C + x);
  const before = near.map(i => w.k(i)), grit = game.S.grit;
  let heading = rnd() * 6.283;
  for (let turn = 0; turn < 60 && game.drill.mode !== 'dead'; turn++) { heading += (rnd() - 0.5) * 2.4; fly(game, Math.cos(heading), Math.sin(heading), 0.4 + rnd() * 0.8); }
  const far = Math.hypot(game.drill.x - HX, game.drill.y - HY), changed = near.filter((i, n) => w.k(i) !== before[n]).length;
  if (game.drill.mode !== 'dead') { game.dents = game.val('hull') - 1; game.shield = 0; game.hit(0.3); }
  rest(game, DEATH + 0.2);
  const still = near.filter((i, n) => w.k(i) !== before[n]).length;
  check(game.drill.mode === 'free' && game.drill.x === HX && game.drill.y === HY && game.hull === 5, `world ${seed}: lost ${far.toFixed(0)} cells out, the drill is ${game.drill.mode} at ${(game.drill.x - HX).toFixed(1)},${(game.drill.y - HY).toFixed(1)}`);
  check(changed > 20 && still === 0 && game.S.grit === grit, `world ${seed}: the trip changed ${changed} cells near the core, ${still} are still changed; grit ${game.S.grit} (was ${grit})`);
  game.input.auto = null; game.update(1 / 60);
  fly(game, 0, 1, 2);
  check(!tetherFaults(game).length && game.drill.y > HY + 2, `world ${seed}: flying on after the loss, the tether: ${tetherFaults(game).join('; ')}`);
}

// ---- riding on to the core mends
{
  const game = await makeGame(7, { drill: 4 }, { hull: true });
  fly(game, 1, 0, 3); game.hit(0.3); rest(game, 1);
  check(game.hull === 4, `a knock out east left ${game.hull} pips`);
  fly(game, -1, 0, 4);
  check(game.hull === 5 && game.drill.mode !== 'dead', `back on the core the hull has ${game.hull} pips`);
}

// ---- the row, and a game saved before there was a hull
{
  const row = UPGRADES[5];
  check(row.id === 'hull' && row.name === 'HULL' && row.values.join() === '5,6,7,8,9,10,11,12' && row.gem === B.EMBER, `the shop's sixth row is ${row?.id} with values ${row?.values}`);
  check(row.gems[0] === 0 && row.grit.every((g, l) => l === 0 || g > row.grit[l - 1]), `the hull's prices are ${row.grit} grit and ${row.gems} gems`);
  const game = await makeGame(7, {}, { hull: true });
  game.S.grit = 1e9; game.S.gems[B.EMBER] = 1e6;
  // Its levels ask that the drill has been 150, 280, 440 and 660 cells out: having been nowhere, the tap is refused and says so.
  game.buy(row);
  check(game.S.lv.hull === 0 && game.shopNote?.text === 'NEEDS 0/150 CELLS OUT' && game.lacks(row) === 'NEEDS 0/150 CELLS OUT', `with grit and a drill that has been nowhere the tap ${game.S.lv.hull ? 'bought' : 'was refused'} and said '${game.shopNote?.text}'`);
  game.S.out = 659;
  for (let l = 0; l < 4; l++) game.buy(row);
  check(game.S.lv.hull === 3 && game.lacks(row) === 'NEEDS 659/660 CELLS OUT', `having been 659 cells out: level ${game.S.lv.hull}, and the next says '${game.lacks(row)}'`);
  game.S.out = 660;
  for (let l = 0; l < 3; l++) game.buy(row);
  check(game.S.lv.hull === 4 && game.val('hull') === 9 && game.hull === 9 && game.lacks(row) === 'NEEDS 660/1200 CELLS OUT', `having been 660 cells out: level ${game.S.lv.hull}, ${game.hull} pips, and the next says '${game.lacks(row)}'`);
  // The three levels of the late game ask for 1,200, 1,500 and 1,800 cells out; the last makes twelve pips, drawn with the last plates there are.
  // (And is paid in the south east's gems: js/shop.js, LATE.)
  game.S.out = 1800; game.S.gems[G.SE] = 1e6;
  for (let l = 0; l < 4; l++) game.buy(row);
  check(game.S.lv.hull === 7 && game.val('hull') === 12 && game.hull === 12 && game.cost(row) === null, `having been 1,800 cells out: level ${game.S.lv.hull}, ${game.hull} pips`);
  game.resize(320, 568, 1); game.render();
  game.S.lv.hull = 4;
  game.shop = true; game.shopRise = 1; game.render(); game.shop = false; game.render();
  game.save();
  const loaded = await makeGame(7, {}, { hull: true }); await loaded.restore();
  check(loaded.S.lv.hull === 4 && loaded.hull === 9, `loaded, the hull is at level ${loaded.S.lv.hull} with ${loaded.hull} pips`);
  const { hull, ...lv } = game.S.lv;
  localStorage.setItem('tetherbore-save-v3', JSON.stringify({ v: 3, ...game.S, lv }));
  const old = await makeGame(7, {}, { hull: true }); await old.restore();
  check(old.S.lv.hull === 0 && old.hull === 5, `a game saved before there was a hull loads at level ${old.S.lv.hull} with ${old.hull} pips`);
}

// ---- ground hauled away is seen to be gone
{
  const game = await makeGame(7), w = game.world;
  const cells = []; for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) cells.push((C + 60 + y) * N + C + 60 + x);
  for (const i of cells) w.setK(i, K.SOFT);
  check(cells.every(i => !w.s(i)), 'ground sixty cells out is seen before anything went there');
  game.haul(cells);
  check(cells.every(i => w.k(i) === K.EMPTY && w.s(i) === 1) && cells.every(i => w.peek(i % N, Math.floor(i / N)) === K.EMPTY), 'ground hauled away is not known to be gone');
}

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : 'no defect: knocks take pips, the last loses the drill and the game goes back to the last docking, and HULL is sold a pip a level');
process.exit(fails.length ? 1 : 0);
