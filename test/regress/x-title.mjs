// The desktop's title screen (js/title.js), through the game's own inputs:
//   - a returning player is one press from playing, by Enter, Space, a click or a pad's A, and goes on with the very game;
//   - with no game saved there is no CONTINUE, and NEW GAME is first and asks one press; with one saved it asks two, and
//     moving away takes the first back;
//   - each of the four choices is reached and pressed by keyboard, mouse and pad;
//   - SETTINGS opens the menu's panel over it and shutting that comes back, by key and by pad;
//   - the view behind it is a game of its own: while it plays nothing is saved, the player's game does not move and
//     neither its ground nor its save changes, and it does haul;
//   - a save still loads under it.
//   node test/regress/x-title.mjs
import { makeGame, Game } from '../harness.mjs';
const { Pad, SETTLE } = await import('../../js/pad.js');
const { Title } = await import('../../js/title.js');
const { lang, tr } = await import('../../js/lang.js');

const fails = [], check = (ok, what) => { if (!ok && fails.length < 30) fails.push(what); }, dt = 1 / 60, A = 0, B = 1, UP = 12, DOWN = 13;
const SAVE = 'tetherbore-save-v3', clear = () => { localStorage.removeItem(SAVE); localStorage.removeItem(`${SAVE}-latest`); };
const hand = () => ({ connected: true, mapping: 'standard', index: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) });

async function up(returning = true, size = [1920, 1080]) {
  clear();
  const game = await makeGame(21);
  let quit = 0;
  game.desktop = { fullscreen: false, toggle() {}, quit() { quit++; } };
  game.S.grit = 777;
  game.resize(size[0], size[1], 1, true);
  const title = new Title(game, returning), source = hand(), pad = new Pad(game, () => [source]);
  const frames = (n = 1) => { for (let f = 0; f < n; f++) { pad.poll(dt); game.update(dt); game.render(); } };
  const tap = b => { source.buttons[b].pressed = true; source.buttons[b].value = 1; frames(); source.buttons[b].pressed = false; source.buttons[b].value = 0; frames(2); };
  const key = code => { game.key(code, true); game.key(code, false); frames(); };
  const click = i => { const b = title.boxes[i]; game.pointerMove(1, b[0] + 3, b[1] + 3); game.pointerDown(1, b[0] + 3, b[1] + 3); game.pointerUp(1); frames(); };
  frames(Math.ceil(SETTLE / dt) + 2);
  return { game, title, pad, frames, tap, key, click, quits: () => quit };
}
const ids = t => t.rows.map(r => r.id).join(' ');

// ---- one press from playing
for (const how of ['Enter', 'Space', 'click', 'pad']) {
  const t = await up();
  check(ids(t.title) === 'continue new settings quit', `the choices are ${ids(t.title)}`);
  check(t.title.rows[t.title.focus].id === 'continue', 'CONTINUE does not have the focus');
  if (how === 'click') t.click(0); else if (how === 'pad') t.tap(A); else t.key(how);
  check(!t.title.on && t.game.front === null, `${how}: one press did not go into the game`);
  check(t.game.S.grit === 777 && t.game.S.seed === 21, `${how}: it is not the game that was there`);
  t.game.input.auto = [1, 0, 1];
  const x = t.game.drill.x;
  t.frames(30);
  check(t.game.drill.x !== x, `${how}: the drill does not fly after it`);
}

// ---- no game saved: no CONTINUE, and NEW GAME at one press
for (const how of ['Enter', 'click', 'pad']) {
  const t = await up(false);
  check(ids(t.title) === 'new settings quit', `with no save the choices are ${ids(t.title)}`);
  const was = t.game.S.seed;
  if (how === 'click') t.click(0); else if (how === 'pad') t.tap(A); else t.key(how);
  check(!t.title.on && t.game.S.seed !== was, `${how}: NEW GAME with nothing saved did not begin at one press`);
  check(!!localStorage.getItem(SAVE), `${how}: the new game was not saved`);
}

// ---- with a game saved, NEW GAME asks twice and moving away takes it back
for (const how of ['key', 'click', 'pad']) {
  const t = await up(), was = t.game.S.seed;
  const go = () => { if (how === 'key') t.key('Enter'); else if (how === 'pad') t.tap(A); else t.click(1); };
  if (how === 'key') t.key('ArrowDown'); else if (how === 'pad') t.tap(DOWN); else { const b = t.title.boxes[1]; t.game.pointerMove(1, b[0] + 3, b[1] + 3); t.frames(); }
  check(t.title.rows[t.title.focus].id === 'new', `${how}: did not reach NEW GAME`);
  go();
  check(t.title.on && t.game.S.seed === was && t.title.sure > 0, `${how}: one press of NEW GAME over a saved game did something`);
  if (how === 'key') t.key('ArrowDown'); else if (how === 'pad') t.tap(DOWN); else { const b = t.title.boxes[2]; t.game.pointerMove(1, b[0] + 3, b[1] + 3); t.frames(); }
  check(!(t.title.sure > 0), `${how}: moving away did not take the first press back`);
  if (how === 'key') t.key('ArrowUp'); else if (how === 'pad') t.tap(UP); else { const b = t.title.boxes[1]; t.game.pointerMove(1, b[0] + 3, b[1] + 3); t.frames(); }
  go(); go();
  check(!t.title.on && t.game.S.seed !== was, `${how}: two presses of NEW GAME did not begin a world`);
}

// ---- SETTINGS: the menu's panel, and back
for (const how of ['key', 'click', 'pad']) {
  const t = await up();
  if (how === 'key') { t.key('ArrowDown'); t.key('ArrowDown'); t.key('Enter'); } else if (how === 'pad') { t.tap(DOWN); t.tap(DOWN); t.tap(A); } else t.click(2);
  check(t.game.lab && t.game.labTab === 'menu' && t.title.on, `${how}: SETTINGS did not open the menu over the title`);
  t.frames(4);
  check(t.game.buttons.some(b => b.swallow), `${how}: the menu's panel was not drawn`);
  if (how === 'pad') t.tap(B); else t.key('Escape');
  t.frames(2);
  check(!t.game.lab && t.title.on && t.game.front === t.title, `${how}: shutting the menu did not come back to the title`);
  check(t.title.rows[t.title.focus].id === 'settings', `${how}: the focus did not stay on SETTINGS`);
}

// ---- the credits from the menu, over the title, come back to the menu and the title
{
  const t = await up(), { game, title } = t;
  t.key('ArrowDown'); t.key('ArrowDown'); t.key('Enter');
  t.frames(3);
  game.finale.begin(game, true);
  check(game.front === game.finale && !game.lab, 'the credits did not stand in front of the title');
  t.frames(40);
  t.key('Enter');
  check(!game.finale.on && game.front === title && game.lab && game.labTab === 'menu', 'the credits did not go back to the menu over the title');
  t.key('Escape'); t.frames(2);
  check(!game.lab && game.front === title && title.on, 'shutting the menu after the credits did not come back to the title');
}

// ---- QUIT, by each
for (const how of ['key', 'click', 'pad']) {
  const t = await up();
  if (how === 'key') { t.key('ArrowUp'); t.key('Enter'); } else if (how === 'pad') { t.tap(UP); t.tap(A); } else t.click(3);
  check(t.quits() === 1, `${how}: QUIT asked the shell to quit ${t.quits()} times`);
}

// ---- the view is nobody's game
{
  const t = await up(), { game, title } = t;
  const before = JSON.stringify(game.S), at = [game.drill.x, game.drill.y], stirred = game.world.stirred;
  game.save();
  const kept = localStorage.getItem(SAVE);
  let writes = 0;
  const set = localStorage.setItem;
  localStorage.setItem = (k, v) => { writes++; set(k, v); };
  const hauls = title.view.S.stats.hauls;
  t.frames(60 * 30);
  localStorage.setItem = set;
  check(writes === 0, `the title screen wrote to storage ${writes} times`);
  check(localStorage.getItem(SAVE) === kept, 'the save changed under the title screen');
  check(JSON.stringify(game.S) === before, 'the player\'s game changed under the title screen');
  check(game.drill.x === at[0] && game.drill.y === at[1] && game.world.stirred === stirred, 'the player\'s drill or ground moved');
  check(title.view !== game && title.view.world !== game.world, 'the view is the player\'s world');
  check(title.view.S.stats.hauls > hauls, 'the view never hauled in thirty seconds');
  title.leave();
  check(title.view === null, 'the view was not let go');
}

// ---- a save loads under it
{
  const first = await makeGame(33);
  first.S.grit = 4242; first.S.bosses = 0x31;
  first.save();
  const game = new Game(document.createElement('canvas'), null, { blank: true });
  game.ach.off = true; game.fauna.off = true;
  game.desktop = { fullscreen: false, toggle() {}, quit() {} };
  const loaded = await game.restore();
  check(loaded && game.S.seed === 33 && game.S.grit === 4242 && game.S.bosses === 0x31, 'the save did not load');
  game.resize(1280, 800, 1, true);
  const title = new Title(game, loaded);
  for (let n = 0; n < 20; n++) { game.update(dt); game.render(); }
  check(title.rows[0].id === 'continue', 'a save loaded did not offer CONTINUE');
  game.key('Enter', true);
  check(!title.on && game.S.grit === 4242, 'CONTINUE did not go on with the save');
}

// ---- it is drawn on every window the desktop allows, its rows on the screen and clear of one another
for (const [w, h] of [[960, 540], [1280, 720], [1280, 800], [1920, 1080], [2560, 1440]]) {
  const t = await up(true, [w, h]), { game, title } = t;
  t.frames(2);
  check(title.boxes.length === 4, `${w}x${h}: ${title.boxes.length} rows drawn`);
  title.boxes.forEach((b, n) => {
    check(b[0] >= 0 && b[1] >= 0 && b[0] + b[2] <= game.W && b[1] + b[3] <= game.H, `${w}x${h}: row ${n} is off the screen`);
    if (n) check(b[1] >= title.boxes[n - 1][1] + title.boxes[n - 1][3], `${w}x${h}: rows ${n - 1} and ${n} overlap`);
  });
}
if (lang !== 'en') for (const said of ['CONTINUE', 'NEW GAME', 'SETTINGS', 'QUIT', 'ENTER AGAIN: NEW WORLD']) check(tr(said) !== said, `${lang}: ${said} is not turned`);

if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
console.log(`ok x-title (${lang}): every choice by keyboard, mouse and pad, one press to play, and the view is nobody's game`);
