// The demo, played: run in a copy of the game built as the demo (test/regress/y-demo.mjs makes one and runs this in it;
// in the repository, where DEMO is false, this says so and passes). Held here:
//   - the limit: nothing buys the tether past 400 cells, with every price in hand; no drill goes past it; a level that
//     lies beyond it is said to be the full game's; a save written with a longer tether is held to it;
//   - the lord: the south's alone wakes, 360 cells out with its leash inside the limit, and it can be beaten there;
//   - the end: it waits for the end of the last tether, comes up once, takes no press in its first moment, and is
//     worked by touch, by keys and by a pad, each way out of it; the player then plays on;
//   - the save: a demo's save goes under its own key; a full game's on the same device is left byte for byte;
//   - Steam: nothing is reported, from the page or the bridge, and what is earned is still in the save.
//   node test/regress/y-demo-play.mjs [--write <file>]   (--write leaves a played save there for y-demo.mjs)
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const { DEMO, DEMO_LAIR, DEMO_LEVEL, DEMO_LORD, DEMO_SAVE, FULL_SAVE, SAVE_KEY, DB_NAME } = await import('../../js/edition.js');
if (!DEMO) { console.log('ok y-demo-play: this is not a demo build (test/regress/y-demo.mjs runs this in one)'); process.exit(0); }

// (Which databases the game asks for, before anything opens one.)
const databases = [];
const { makeGame, farStart, C, UPGRADES, WORKS, MAPS, CORE } = await import('../harness.mjs');
const open = indexedDB.open;
indexedDB.open = (name, v) => { databases.push(name); return open.call(indexedDB, name, v); };
const { CAP, STORE, SEEN_KEY, CARD_WORDS, fullSaveHere } = await import('../../js/demo.js');
const { Pad, SETTLE } = await import('../../js/pad.js');
const { BOSS, LAIR, LEASH, lairX, lairY } = await import('../../js/bosses.js');
const { LORDS, atLair, beat } = await import('./lib/lords.mjs');
const { fits, lang } = await import('../../js/lang.js');
const { textWidth, sheets } = await import('../../js/atlas.js');

const fails = [], check = (ok, what) => { if (!ok && fails.length < 40) fails.push(what); };
const dt = 1 / 60, ROWS = [...UPGRADES, ...WORKS, ...MAPS, ...CORE], tether = UPGRADES[0];
const rich = game => { game.S.grit = 1e12; game.S.gems = game.S.gems.map(() => 1e9); game.S.spec = game.S.spec.map(() => 1e6); game.S.out = CAP; };
const frames = (game, n = 1) => { for (let f = 0; f < n; f++) { game.update(dt); game.render(); } };
const reset = () => { for (const key of [SAVE_KEY, `${SAVE_KEY}-latest`, FULL_SAVE, `${FULL_SAVE}-latest`, SEEN_KEY]) localStorage.removeItem(key); };
// A game out at the end of the last tether, its card not yet shown.
const atRim = async (seed = 7) => {
  reset();
  const game = await makeGame(seed, { tether: DEMO_LEVEL });
  game.demo.shown = false;
  farStart(game, CAP - 5, 0);
  return game;
};
const cardRow = (game, n) => { const list = game.buttons, frame = list.findIndex(b => b.swallow); return list.slice(0, frame).sort((a, b) => a.y - b.y)[n]; };
const tapRow = (game, n) => { const b = cardRow(game, n); game.pointerDown(1, b.x + b.w / 2, b.y + b.h / 2); game.pointerUp(1); };

check(SAVE_KEY === DEMO_SAVE && DB_NAME !== 'tetherbore', `the demo saves to ${SAVE_KEY} and ${DB_NAME}`);
check(CAP === 400 && LAIR === DEMO_LAIR && LAIR + LEASH <= CAP, `the limit is ${CAP} and the lair ${LAIR}, leash ${LEASH}`);

// ---- the limit
{
  const game = await makeGame(7);
  rich(game);
  for (let round = 0; round < 80; round++) for (const u of ROWS) { game.buy(u); rich(game); }
  check(game.S.lv.tether === DEMO_LEVEL && game.val('tether') === CAP, `with every price in hand the tether came to level ${game.S.lv.tether}, ${game.val('tether')} cells`);
  check(game.cost(tether) === null && !game.canBuy(tether), 'the tether still has a price at the limit');
  for (const u of ROWS) {
    const l = game.S.lv[u.id];
    if (l >= u.values.length - 1) continue;
    const asked = u.needs?.[1][l], what = Array.isArray(asked) ? asked[0] : u.needs?.[0], count = Array.isArray(asked) ? asked[1] : asked;
    if (what === 'out' && count > CAP) check(game.demo.capped(u) && !game.canBuy(u), `${u.id} ${l + 1} asks ${count} cells out and can be bought`);
    if ((u.gemAt?.[l] ?? u.gem) >= 5 && u.gems[l] > 0) check(game.demo.capped(u), `${u.id} ${l + 1} asks a corner's gems and is on offer`);
  }
  // What is drawn says so, and the shop draws with every tab.
  game.shop = true;
  for (const tab of ['rig', 'works', 'map', 'core']) { game.shopTab = tab; game.render(); }
  game.shop = false;
  check(!game.failedAt, 'the shop threw');
  // A level out of reach, tapped: nothing bought, and the shop says why.
  const past = ROWS.find(u => u.id !== 'tether' && game.demo.capped(u));
  if (past) { const was = game.S.lv[past.id]; game.buy(past); check(game.S.lv[past.id] === was && game.shopNote?.text === 'MORE IN THE FULL GAME', `a level past the limit, tapped: level ${game.S.lv[past.id]}, note ${game.shopNote?.text}`); }
  else check(false, 'no row has a level past the limit');
}
{
  // No drill goes past it, however it is steered.
  const game = await atRim();
  game.demo.shown = true;
  let most = 0;
  for (let f = 0; f < 900; f++) { game.input.auto = [Math.cos(f / 90) * 0.3 + 1, Math.sin(f / 70) * 0.6, 1]; game.update(dt); most = Math.max(most, game.far); }
  check(most <= CAP + 0.35, `flown at the limit the drill came ${most.toFixed(2)} cells out`);
  check(game.S.out <= CAP + 0.35, `the furthest out says ${game.S.out}`);
}
{
  // A save with a longer tether is held to the limit in the demo.
  reset();
  const first = await makeGame(7);
  first.S.lv.tether = 9; first.save();
  const game = await makeGame(7);
  check(await game.restore(), 'the save did not load');
  check(game.S.lv.tether === DEMO_LEVEL && game.val('tether') === CAP, `a save with the last tether loaded at ${game.val('tether')} cells`);
  check(JSON.parse(game.docked).lv.tether === DEMO_LEVEL, 'a trip lost would go back to the longer tether');
}

// ---- the lord
{
  check(LORDS.length === 1 && LORDS[0] === DEMO_LORD, `the lords that wake are ${LORDS}`);
  check(Math.hypot(lairX(DEMO_LORD) - C - 0.5, lairY(DEMO_LORD) - C - 0.5) === DEMO_LAIR, 'the lord does not lie where the demo says');
  for (const seed of [3, 7, 11, 23]) {
    const game = await atLair(DEMO_LORD, { seed, levels: { tether: DEMO_LEVEL, drill: 2, hull: 1, momentum: 2 }, hull: false });
    game.demo.shown = true;
    check(game.val('tether') === CAP, 'the lord was staged past the limit');
    check(beat(game, DEMO_LORD), `world ${seed}: the lord could not be beaten at the demo's reach`);
  }
  // Its fall is the demo's: saved apart, and no medal of the lords'.
  reset();
  const game = await atLair(DEMO_LORD, { levels: { tether: DEMO_LEVEL }, hull: false });
  game.ach.off = false; game.demo.shown = true;
  check(beat(game, DEMO_LORD), 'the lord could not be beaten');
  check(((game.S.bosses ?? 0) >> (4 + DEMO_LORD) & 1) === 1, 'the fall was not kept for the demo');
  game.spoils = null;
  game.save();
  const saved = JSON.parse(localStorage.getItem(`${SAVE_KEY}-latest`));
  check(saved.bosses === undefined && saved.demoLords > 0, `the save holds bosses ${saved.bosses} and demoLords ${saved.demoLords}`);
  check(!(saved.ach ?? []).some(id => id.startsWith('ACH_LORD') || id === 'ACH_ALL_LORDS'), `a lord's medal was earned in the demo: ${saved.ach}`);
  const back = await makeGame(7);
  await back.restore();
  check((back.S.bosses ?? 0) >> (4 + DEMO_LORD) & 1, 'the demo forgot its lord on loading');
  check(back.S.demoLords === undefined, 'the demo keeps its own word for it in the game once loaded');
}

// ---- the end
const stores = [];
globalThis.open = url => { stores.push(url); return {}; };
{
  // Not before the last tether, however near the end of the one it has.
  reset();
  const short = await makeGame(7, { tether: DEMO_LEVEL - 1 });
  short.demo.shown = false;
  farStart(short, 249, 0);
  for (let f = 0; f < 120; f++) { short.input.auto = [1, 0, 1]; short.update(dt); }
  check(!short.demo.open && !short.demo.shown, 'the end came up on a shorter tether');

  const game = await atRim();
  check(!game.demo.open, 'the end was up before the drill got there');
  for (let f = 0; f < 200 && !game.demo.open; f++) { game.input.auto = [1, 0, 1]; game.update(dt); }
  game.input.auto = null;
  check(game.demo.open, 'the end did not come up at the end of the last tether');
  check(localStorage.getItem(SEEN_KEY) === '1', 'that it came up was not kept');
  game.render();
  // It takes no press in its first moment.
  game.key('Enter', true);
  check(stores.length === 0, 'a key pressed as it came up opened the store');
  const b = cardRow(game, 0);
  game.pointerDown(1, b.x + 2, b.y + 2); game.pointerUp(1);
  check(stores.length === 0 && game.demo.open, 'a touch as it came up chose something');
  frames(game, 60);
  // By touch: the store, then on with the game.
  tapRow(game, 0);
  check(stores.length === 1 && stores[0] === STORE && game.demo.open, `the wishlist by touch: ${stores}`);
  game.render();
  game.pointerDown(1, 2, 2); game.pointerUp(1);
  check(game.demo.open, 'a touch beside its buttons closed it');
  tapRow(game, 1);
  check(!game.demo.open && !game.lab, 'KEEP PLAYING did not close it');
  frames(game, 5);
  check(game.labTab !== 'demo', 'the panel still opens at the end card');
  // Once: not again on the way out and back, nor in a game loaded after.
  game.input.auto = [-1, 0, 1]; frames(game, 60); game.input.auto = [1, 0, 1]; frames(game, 120); game.input.auto = null;
  check(!game.demo.open, 'it came up a second time');
  const again = await makeGame(7, { tether: DEMO_LEVEL });
  farStart(again, CAP - 1, 0);
  for (let f = 0; f < 120; f++) { again.input.auto = [1, 0, 1]; again.update(dt); }
  check(!again.demo.open && again.demo.shown, 'it came up again in the next sitting');
  // The player asks for it again from the shop's REACH row.
  again.input.auto = null; again.buy(tether);
  check(again.demo.open, 'the REACH row did not bring it back');
  again.render(); tapRow(again, 1);
  check(!again.demo.open, 'brought back, it did not close');
}
{
  // By keys.
  const game = await atRim();
  const before = stores.length;
  for (let f = 0; f < 200 && !game.demo.open; f++) { game.input.auto = [1, 0, 1]; game.update(dt); }
  game.input.auto = null; frames(game, 60);
  game.key('Enter', true);
  check(stores.length === before + 1, 'Enter did not open the store');
  game.key('Escape', true);
  check(!game.demo.open, 'Escape did not close it');
  // And a direction closes it and flies.
  game.demo.show(true); frames(game, 2);
  game.key('ArrowLeft', true); game.key('ArrowLeft', false);
  check(!game.demo.open, 'a direction did not close it');
}
{
  // By a pad.
  const game = await atRim();
  const hand = { connected: true, mapping: 'standard', index: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  const pad = new Pad(game, () => [hand]), A = 0, B = 1, DOWN = 13;
  document.hasFocus = () => true;
  const step = (n = 1) => { for (let f = 0; f < n; f++) { pad.poll(dt); game.update(dt); game.render(); } };
  const set = (button, on) => { hand.buttons[button].pressed = on; hand.buttons[button].value = on ? 1 : 0; };
  const tap = button => { set(button, true); step(); set(button, false); step(2); };
  step(Math.ceil(SETTLE / dt) + 2);
  hand.axes[0] = 1;
  for (let f = 0; f < 200 && !game.demo.open; f++) step();
  hand.axes[0] = 0;
  check(game.demo.open, 'flown by the stick, the end did not come up');
  const before = stores.length;
  tap(A);
  check(stores.length === before, 'A pressed as it came up opened the store');
  step(60);
  tap(A);
  check(stores.length === before + 1, 'A did not press the wishlist');
  tap(DOWN); tap(A);
  check(!game.demo.open, 'down and A did not keep playing');
  game.demo.show(true); step(3);
  tap(B);
  check(!game.demo.open, 'B did not close it');
  check(!game.failedAt, 'the card threw');
}
{
  // A browser that blocks the window: the address is on the card instead.
  const game = await atRim();
  globalThis.open = () => null;
  game.demo.show(); game.demo.wait = 0; game.render();
  game.key('Enter', true);
  check(game.demo.blocked, 'a blocked window was not noticed');
  game.render();
  globalThis.open = url => { stores.push(url); return {}; };
  // On the desktop it asks the shell, and nothing else.
  let asked = 0;
  const desk = await atRim();
  desk.demo.shell = { wishlist: async () => { asked++; return 'held'; } };
  const n = stores.length;
  desk.demo.show(); desk.demo.wait = 0; desk.render(); desk.key('Enter', true);
  check(asked === 1 && stores.length === n, `the desktop's wishlist asked the shell ${asked} times and the browser ${stores.length - n}`);
}
{
  // Every line it says has its words and fits a screen 160 wide, in the language this run speaks.
  const game = await atRim();
  game.resize(160, 284, 1);
  const glyphs = sheets.font.glyphs, room = 160 - 16;
  for (const line of CARD_WORDS) {
    check(fits(line), `${lang}: no words for ${line}`);
    if (lang === 'zh') for (const ch of (await import('../../js/lang.js')).tr(line)) if (ch !== ' ' && !glyphs[ch]) check(false, `no glyph for ${ch} in ${line}`);
    if (line !== 'THE DEMO ENDS AT THIS REACH' && line !== 'STORE.STEAMPOWERED.COM/APP/5681650') check(textWidth(line) <= room, `${lang}: ${line} is ${textWidth(line)} wide`);
  }
  game.demo.show(); game.render();
  const list = game.buttons.slice(0, game.buttons.findIndex(b => b.swallow));
  check(list.length === 2 && list.every(b => b.x >= 0 && b.x + b.w <= game.W && b.y >= 0 && b.y + b.h <= game.H), `its rows do not stand on the screen: ${JSON.stringify(list.map(b => [b.x, b.y, b.w, b.h]))}`);
}

// ---- the save beside a full game's
{
  reset();
  const full = JSON.stringify({ v: 3, rev: 41, seed: 99, grit: 123456, gems: [0, 5, 5, 5, 5, 0, 0, 0, 0], lv: { tether: 9, drill: 7 }, stats: { hauls: 500, best: 900, buys: 90, moves: 9, time: 90000 }, met: {}, marks: [], visited: {}, spec: [0, 1, 2, 3, 4], lab: {}, out: 2200, rare: {}, relics: [1, 1, 1, 1], wrecks: [1, 1, 1, 1, 1, 1, 1, 1], bosses: 255 });
  localStorage.setItem(FULL_SAVE, full); localStorage.setItem(`${FULL_SAVE}-latest`, full);
  check(fullSaveHere(), 'a full game\'s save on this device was not seen');
  const game = await makeGame(5);
  check(!(await game.restore()), 'the demo loaded a full game\'s save');
  check(game.val('tether') === 40, `the demo began at ${game.val('tether')} cells`);
  game.S.grit = 777; game.save();
  for (let f = 0; f < 200; f++) { game.input.auto = [1, 0, 1]; game.update(dt); }
  game.save();
  check(localStorage.getItem(FULL_SAVE) === full && localStorage.getItem(`${FULL_SAVE}-latest`) === full, 'the full game\'s save was changed');
  check(JSON.parse(localStorage.getItem(SAVE_KEY)).seed === 5, 'the demo\'s game did not go under its own key');
  check(databases.every(name => name === DB_NAME), `the demo opened the databases ${[...new Set(databases)]}`);
}

// ---- Steam
{
  reset();
  const told = [];
  globalThis.tetherboreDesktop = { achievements: { sync: ids => { told.push(['sync', ids]); return Promise.resolve(); }, unlock: id => { told.push(['unlock', id]); return Promise.resolve(); } } };
  const game = await makeGame(7, {}, { ach: true });
  game.ach.earn('ACH_FIRST_HAUL'); game.ach.earn('ACH_BIG_HAUL');
  frames(game, 90);
  check(told.length === 0, `the page told Steam ${JSON.stringify(told)}`);
  game.save();
  const ach = JSON.parse(localStorage.getItem(`${SAVE_KEY}-latest`)).ach ?? [];
  check(ach.includes('ACH_FIRST_HAUL') && ach.includes('ACH_BIG_HAUL'), `what was earned is not in the save: ${ach}`);
  check(!game.ach.earn('ACH_LORD_BEHEMOTH') && !game.ach.earn('ACH_ALL_LORDS'), 'a lord\'s medal can be earned in the demo');
  delete globalThis.tetherboreDesktop;
  const require = createRequire(import.meta.url);
  const { reporter } = require('../../desktop/steam.cjs');
  const calls = [], client = { achievement: { isActivated: () => false, activate: id => { calls.push(id); return true; } }, stats: { store: () => calls.push('store') } };
  const report = reporter(() => client, 5681650, new Set(['ACH_FIRST_HAUL']), { demo: true });
  const a = report.sync(['ACH_FIRST_HAUL']), b = report.unlock('ACH_FIRST_HAUL');
  check(calls.length === 0 && a.skipped === 'demo' && b.skipped === 'demo', `the bridge of a demo called Steam: ${calls}`);
}

// ---- a played save, for the full game to take up (y-demo.mjs)
const at = process.argv.indexOf('--write');
if (at > 0) {
  reset();
  const game = await makeGame(11, { tether: DEMO_LEVEL, drill: 2, winch: 2 }, { ach: true });
  game.S.grit = 54321; game.S.gems[1] = 77; game.S.spec[2] = 6; game.S.out = 388; game.S.stats.hauls = 42; game.S.stats.best = 160;
  game.S.lab['lode-items:oreA'] = 9; game.S.met[1] = 1; game.S.bosses = (1 << DEMO_LORD) | (1 << (4 + DEMO_LORD));
  game.ach.earn('ACH_FIRST_HAUL');
  game.save();
  writeFileSync(process.argv[at + 1], JSON.stringify({ [DEMO_SAVE]: localStorage.getItem(DEMO_SAVE), [`${DEMO_SAVE}-latest`]: localStorage.getItem(`${DEMO_SAVE}-latest`) }));
}

if (fails.length) { console.log(`FAIL y-demo-play [${lang}]: ${fails.join('; ')}`); process.exit(1); }
console.log(`ok y-demo-play [${lang}]: the tether stops at ${CAP} cells with everything in hand, the ${BOSS[DEMO_LORD].name} wakes at ${DEMO_LAIR} and can be beaten there, the end comes up once and works by touch, keys and pad, a full game's save is left as it was, and nothing is told to Steam`);
process.exit(0);
