// What the player is saving for (js/goal.js). A new game saves for a row of the first tab; a purchase moves it on;
// a tap on a row that asks only for grit not yet banked makes that row the goal, held until it is bought, and the
// shop pins it; the line along the top of the bar grows with the grit banked and blinks green once it is all there,
// for three seconds and then steady green, and a tap on the bar stops it at once;
// coming home with enough says '<ROW> READY' at the core; and nothing of it is saved, so a game saved before
// there was a goal loads and saves with no key it did not have.
//   node test/regress/h-goal.mjs
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { makeGame, UPGRADES } from '../harness.mjs';
const { ROWS } = await import('../../js/shop.js');
const { pickGoal, goalShare } = await import('../../js/goal.js');
const { flyTo } = await import('./lib/lasso.mjs');

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const row = id => ROWS.find(u => u.id === id);

// ---- a new game's goal, and a purchase moving it on
const game = await makeGame(7), S = game.S;
game.render();
const first = game.goal;
check(first && first.id && UPGRADES.some(u => u.id === first.id) && first.grit === game.cost(row(first.id)).grit, `a new game saves for ${JSON.stringify(first)}`);
// (The goal is one object, filled again: what it was is taken now.)
const id = first.id, was = `${first.id}:${first.level}`;
S.grit = first.grit; game.buy(row(id));
check(S.lv[id] === 1 && `${game.goal.id}:${game.goal.level}` !== was && !game.canBuy(row(game.goal.id)), `bought ${was}, the goal is ${game.goal.id} at ${game.goal.level}`);

// ---- a refused tap on a row short only of grit makes it the goal; one that lacks what must be found does not
S.grit = 0;
const winch = row('winch');
check(!game.lacks(winch) && !game.canBuy(winch), 'the winch cannot be tapped for as the test means');
game.buy(winch);
check(game.goal.id === 'winch' && game.goal.pinned && game.goal.grit === game.cost(winch).grit, `after a refused tap on WINCH the goal is ${JSON.stringify(game.goal)}`);
const hull = row('hull');
check(game.lacks(hull), 'the hull asks nothing to be found');
game.buy(hull);
check(game.goal.id === 'winch', `a tap on HULL, which asks to have been further out, made the goal ${game.goal.id}`);
// (Held when the drill comes home and the game would choose otherwise.)
pickGoal(game);
check(game.goal.id === 'winch', `chosen again, the goal is ${game.goal.id}`);

// ---- the shop pins it
{
  game.resize(320, 568, 1); game.shop = true; game.shopRise = 1; game.shopTab = 'rig';
  const pins = [];
  game.ctx.fillRect = (x, y, w, h) => { if (w === 2 && h === 2 && game.ctx.fillStyle === '#ffe14a') pins.push([x, y]); };
  game.render();
  delete game.ctx.fillRect;
  const pw = Math.min(game.W - 8, 200), rows = game.buttons.filter(b => b.w === pw - 8).sort((a, b) => a.y - b.y), at = UPGRADES.findIndex(u => u.id === 'winch');
  check(pins.length === 1 && pins[0][1] >= rows[at].y && pins[0][1] < rows[at].y + rows[at].h, `the shop pins ${JSON.stringify(pins)}, the winch's row being at y ${rows[at]?.y}`);
  game.shop = false;
}

// ---- the line along the bar
{
  const lit = () => {
    let most = -1, colour = null;
    game.ctx.fillRect = (x, y, w, h) => { if (y === game.H - 41 && h === 1 && x === 4 && w > most) { most = w; colour = game.ctx.fillStyle; } };
    game.render();
    delete game.ctx.fillRect;
    return [most, colour];
  };
  const price = game.goal.grit, widths = [];
  for (const share of [0.1, 0.4, 0.8]) { S.grit = Math.floor(price * share); widths.push(lit()); }
  check(widths.every(([w, c]) => c === '#ffe14a') && widths[0][0] < widths[1][0] && widths[1][0] < widths[2][0] && Math.abs(widths[1][0] - Math.round((game.W - 8) * Math.floor(price * 0.4) / price)) <= 1, `with a tenth, two fifths and four fifths of ${price} banked the line is ${JSON.stringify(widths)}`);
  check(Math.abs(goalShare(game) - Math.floor(price * 0.8) / price) < 1e-9, `goalShare is ${goalShare(game)}`);
  S.grit = price;
  const blink = [];
  for (let f = 0; f < 40; f++) { game.time += 1 / 60; blink.push(lit()); }
  check(blink.some(([w, c]) => c === '#8ce060' && w === game.W - 8) && blink.some(([w]) => w < 0), `with all of it banked the line is ${JSON.stringify(blink.slice(0, 20))}`);
  // (Steady green after three seconds, the goal left unbought.)
  const steady = () => { const seen = []; for (let f = 0; f < 40; f++) { game.time += 1 / 60; seen.push(lit()); } return seen.every(([w, c]) => c === '#8ce060' && w === game.W - 8); };
  for (let f = 0; f < 200; f++) game.update(1 / 60);
  check(S.grit >= price && steady(), 'the line still blinks three seconds after all of it was banked');
  // (Blinks again when it fills again, and stops at a tap on the bar.)
  S.grit = 0; lit(); S.grit = price;
  const again = []; for (let f = 0; f < 40; f++) { game.time += 1 / 60; again.push(lit()); }
  check(again.some(([w]) => w < 0), 'the line does not blink when it is filled again');
  game.pointerDown(1, game.W / 2, game.H - 20); game.pointerUp(1);
  check(game.lab && steady(), `the line still blinks after a tap on the bar (the lab is ${game.lab ? 'open' : 'shut'})`);
  game.openLab(false);
}

// ---- home with enough
{
  const home = await makeGame(7), H = home.S;
  home.render();
  const goal = home.goal, price = goal.grit;
  for (const [x, y] of [[2, -2], [6, -2], [6, 1], [3, 1]]) if (flyTo(home, x, y) < 0) check(false, 'the drill never got out');
  check(!home.atCore, 'the drill is still at the core');
  H.grit += price; home.popups.length = 0;
  if (flyTo(home, 0, 0, { tol: 0.05 }) < 0) check(false, 'the drill never came home');
  const said = home.popups.map(p => p.label);
  check(home.atCore && said.includes(`${goal.name} READY`), `home with ${H.grit} grit for ${goal.name} at ${price}, the core said ${JSON.stringify(said)}`);
  // (Not again for staying at home.)
  home.popups.length = 0; for (let f = 0; f < 60; f++) home.update(1 / 60);
  check(!home.popups.some(p => /READY$/.test(p.label)), 'the core said READY again with the drill sitting at home');
}

// ---- nothing is saved: a game saved before there was a goal loads and saves with the keys it had
{
  const save = JSON.parse(gunzipSync(readFileSync(new URL('../fixtures/save-4293f7c.json.gz', import.meta.url))));
  localStorage.setItem('tetherbore-save-v3', save.local);
  const old = await makeGame(1);
  const loaded = await old.restore();
  old.render(); old.buy(row('winch')); pickGoal(old); old.render();
  const keys = Object.keys(old.S);
  old.save();
  const written = Object.keys(JSON.parse(localStorage.getItem('tetherbore-save-v3')));
  check(loaded && old.goal?.of === old.S && !('goal' in old.S) && written.every(k => k === 'v' || k === 'rev' || keys.includes(k)) && !written.includes('goal'), `the old save loaded ${loaded}, chose ${old.goal?.id}, and saved the keys ${written}`);
}

if (fails.length) { console.log(`FAIL (${fails.length}):\n  ${fails.join('\n  ')}`); process.exit(1); }
console.log('ok: a goal is chosen, moved on, pinned by a tap, drawn along the bar, said READY at home, and never saved');
