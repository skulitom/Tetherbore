// The close of the game (js/finale.js), through the game's own inputs, in each language (test/all.mjs):
//   - it waits for the last kill to be brought home and the drill to stand at the core, and plays once for a player,
//     through a save and a NEW WORLD, while a save from before it was there is shown it at its next docking;
//   - it can be skipped by a touch, a key or a pad's button, at the second press, and a press as it begins is not heard;
//   - the menu plays it again, at one press to leave, back to the menu; the row is on the web only once it is earned,
//     and on the desktop always, where until it is earned it is the credits alone;
//   - the game goes on: nothing of it has changed, the flight is held while it plays and flies again after;
//   - the credits name who they must and are not called an ending, and every line fits the narrowest phone;
//   - with nothing due it costs the game nothing: a game with it and one without fly the same.
//   node test/regress/x-finale.mjs
import { makeGame, Game, C } from '../harness.mjs';
const { Pad, SETTLE } = await import('../../js/pad.js');
const { creditLines, HUSH, LORD_BEAT, ROLL_AT } = await import('../../js/finale.js');
const { tr, lang } = await import('../../js/lang.js');
const { sheets, textWidth } = await import('../../js/atlas.js');

const fails = [], check = (ok, what) => { if (!ok && fails.length < 30) fails.push(what); }, dt = 1 / 60;
const run = (game, n = 1) => { for (let f = 0; f < n; f++) { game.update(dt); game.render(); } };
const secs = (game, s) => run(game, Math.ceil(s * 60));
const SAVE = 'tetherbore-save-v3', clear = () => { localStorage.removeItem(SAVE); localStorage.removeItem(`${SAVE}-latest`); };
const beaten = async (seed = 7) => { clear(); const g = await makeGame(seed); g.finale.off = false; g.S.bosses = 255; return g; };
const hand = () => ({ connected: true, mapping: 'standard', index: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) });

// ---- when it comes
{
  const g = await beaten();
  g.S.bosses = 0x7F;   // three of the four
  secs(g, 3);
  check(!g.finale.on, 'it played with three lords beaten');
  g.S.bosses = 255; g.spoils = { bits: 128, grit: 0, spec: [0, 0, 0, 0, 0] };
  secs(g, 3);
  check(!g.finale.on, 'it played with the last kill not yet brought home');
  g.spoils = null; g.drill.x = C + 9.5;
  secs(g, 3);
  check(!g.finale.on, 'it played with the drill away from the core');
  g.drill.x = C + 0.5; g.drill.y = C + 0.5; g.shop = true;
  secs(g, 3);
  check(!g.finale.on, 'it played over the open shop');
  g.shop = false;
  secs(g, 3);
  check(g.finale.on && g.front === g.finale, 'all four beaten and the drill home, it did not play');
  check(g.finale.seen, 'it was not marked seen as it began');
}

// ---- once: finished, it does not come again, by a save loaded or a new world
{
  const g = await beaten();
  g.finale.begin(g);
  secs(g, 0.6); g.key('Enter', true); g.key('Enter', false); run(g, 2); g.key('Enter', true); g.key('Enter', false);
  check(!g.finale.on && g.front === null, 'two presses did not end it');
  secs(g, 4);
  check(!g.finale.on, 'it came again after it was seen');
  g.save();
  const saved = JSON.parse(localStorage.getItem(SAVE));
  check(saved.closed === 1, 'the save does not say it was seen');
  const back = new Game(document.createElement('canvas'), null, { blank: true });
  back.ach.off = true; back.fauna.off = true;
  check(await back.restore(), 'the save did not load');
  check(back.finale.seen && back.S.closed === undefined, 'that it was seen did not come back beside the game');
  check((back.S.bosses ?? 0) === 255, 'the lords did not load');
  secs(back, 4);
  check(!back.finale.on, 'it played again in the game loaded');
  back.fresh(99, true); back.S.bosses = 255;
  secs(back, 4);
  check(!back.finale.on, 'it played again in a new world');
}

// ---- a game saved before there was a close is shown it, and one with nothing to show is not
{
  const g = await beaten(); g.save();
  const old = JSON.parse(localStorage.getItem(SAVE));
  check(old.closed === undefined, 'a game that has not seen it says it has');
  delete old.closed; localStorage.setItem(SAVE, JSON.stringify(old)); localStorage.setItem(`${SAVE}-latest`, JSON.stringify(old));
  const back = new Game(document.createElement('canvas'), null, { blank: true });
  back.ach.off = true; back.fauna.off = true;
  await back.restore();
  check(!back.finale.seen, 'a save from before took it as seen');
  secs(back, 3);
  check(back.finale.on, 'a save from before was not shown it at the core');
  clear();
  const plain = await makeGame(7);
  plain.finale.off = false;
  secs(plain, 3);
  check(!plain.finale.on && !plain.finale.seen, 'a game with no lords beaten was shown it');
}

// ---- skipped by each input
for (const how of ['touch', 'key', 'pad']) {
  const g = await beaten(), source = hand(), pad = new Pad(g, () => [source]);
  const frames = (n = 1) => { for (let f = 0; f < n; f++) { pad.poll(dt); g.update(dt); g.render(); } };
  frames(Math.ceil(SETTLE / dt) + 2);
  const press = () => {
    if (how === 'touch') { g.pointerDown(1, 40, 40); g.pointerUp(1); }
    else if (how === 'key') { g.key('Space', true); g.key('Space', false); }
    else { source.buttons[0].pressed = true; source.buttons[0].value = 1; pad.poll(dt); source.buttons[0].pressed = false; source.buttons[0].value = 0; pad.poll(dt); }
    frames(2);
  };
  g.finale.begin(g);
  frames(3); press();
  check(g.finale.on && !(g.finale.run.armed > 0), `${how}: a press as it began was heard`);
  frames(40); press();
  check(g.finale.on && g.finale.run.armed > 0, `${how}: the first press did not ask for a second`);
  frames(200);
  check(g.finale.on && !(g.finale.run.armed > 0), `${how}: the first press was still armed after three seconds`);
  press(); press();
  check(!g.finale.on && g.front === null, `${how}: two presses did not skip it`);
}

// ---- the flight is held while it plays, and the game is as it was after
{
  const g = await beaten();
  g.S.grit = 12345;
  run(g, 2);
  g.finale.begin(g);
  const keep = S => JSON.stringify({ ...S, stats: { ...S.stats, time: 0 } }), was = keep(g.S), at = [g.drill.x, g.drill.y], version = g.world.stirred;
  g.key('ArrowRight', true);
  g.input.auto = [1, 0, 1];
  secs(g, HUSH + 4 * LORD_BEAT + 1);
  check(g.drill.x === at[0] && g.drill.y === at[1], 'the drill flew while it played');
  check(!g.input.keys.size, 'a key held during it was taken as steering');
  secs(g, ROLL_AT - HUSH - 4 * LORD_BEAT + 2);
  check(g.finale.run?.t >= ROLL_AT, 'the credits did not begin');
  g.input.auto = null;
  for (let n = 0; n < 40 && !g.finale.run?.atEnd; n++) secs(g, 5);
  check(g.finale.run?.atEnd, 'the credits did not reach their end');
  g.key('Enter', true); g.key('Enter', false);
  check(!g.finale.on, 'a press at the end card did not leave it');
  check(keep(g.S) === was, 'it changed what is saved of the game');
  check(g.world.stirred === version, 'it changed the ground');
  g.input.auto = [1, 0, 1];
  secs(g, 0.8);
  check(g.drill.x !== at[0], 'the drill does not fly after it');
}

// ---- seen again from the menu
{
  const g = await beaten();
  run(g, 2);
  g.lab = true; g.labTab = 'menu'; g.labRise = 1;
  run(g, 3);
  const rowsBefore = g.menuRows();
  g.finale.begin(g); g.finale.finish();
  g.lab = true; g.labTab = 'menu'; g.labRise = 1;
  run(g, 3);
  check(g.menuRows() > rowsBefore, 'the web menu has no row more once it has been seen');
  const before = g.buttons.length;
  // The row, by what it does.
  const frame = g.buttons.find(b => b.swallow), rows = g.buttons.slice(0, g.buttons.indexOf(frame)).filter(b => b.y > frame.y && b.w > 100 && b.w < g.W);
  let hit = false;
  for (const b of rows) { b.act(); if (g.finale.on) { hit = true; break; } g.lab = true; g.labTab = 'menu'; run(g, 2); }
  check(before > 0 && hit, 'no row of the menu plays it again');
  check(g.finale.run?.replay, 'the menu\'s row is not a replay');
  secs(g, 0.6);
  g.key('Enter', true);
  check(!g.finale.on, 'one press did not leave a replay');
  check(g.lab && g.labTab === 'menu', 'a replay did not go back to the menu');
}

// ---- on the desktop the row is there from the start, and until it is earned it is the credits alone
{
  clear();
  const g = await makeGame(7);
  g.finale.off = false; g.desktop = { fullscreen: false, toggle() {}, quit() {} };
  g.resize(1280, 720, 1, true);
  g.lab = true; g.labTab = 'menu'; g.labRise = 1;
  run(g, 3);
  const frame = g.buttons.find(b => b.swallow), rows = g.buttons.slice(0, g.buttons.indexOf(frame)).filter(b => b.y > frame.y && b.w > 100 && b.w < g.W);
  check(rows.length === 8, `the desktop menu has ${rows.length} rows`);
  for (let n = 1; n < rows.length; n++) check(rows[n - 1].y !== rows[n].y, 'two rows of the desktop menu share a line');
  g.finale.begin(g, true);
  check(g.finale.run.t >= ROLL_AT && !g.finale.seen, 'the credits from the menu, before it is earned, showed the close or marked it seen');
  g.finale.finish();
}

// ---- the credits
for (const desktop of [false, true]) {
  const lines = creditLines(desktop).filter(r => r[1]).map(r => r[1]), all = lines.join('\n');
  for (const name of ['SKULITOM', 'PIXELBOLT', 'FUSION PIXEL FONT', 'TAKWOLF', 'SIL OPEN FONT LICENSE']) check(all.includes(name), `the credits do not name ${name}`);
  if (desktop) for (const name of ['ELECTRON', 'STEAMWORKS.JS', 'MIT LICENSE', 'GABRIEL FRANCISCO DOS SANTOS', 'GITHUB INC', 'PERMISSION IS HEREBY GRANTED', 'LICENSES.CHROMIUM.HTML']) check(all.includes(name), `the desktop's credits do not say ${name}`);
  else check(!all.includes('ELECTRON'), 'the web\'s credits name what it does not ship');
  check(!/\b(FINAL|THE END|ENDING)\b/.test(all), 'the credits call this the end');
  const { glyphs } = sheets.font;
  for (const line of lines) for (const ch of tr(line)) check(glyphs[ch], `${lang}: no glyph for ${ch} in ${tr(line)}`);
  // Each laid out within the narrowest phone and the desktop's narrowest window.
  for (const W of [160, 480]) {
    const g = await makeGame(7);
    g.W = W; g.H = W === 160 ? 284 : 270;
    if (desktop) g.desktop = {};
    const fit = g.finale.layout(g);
    for (const row of fit.rows) if (row.said) check(textWidth(row.said, row.size) <= W - 2, `${lang}: "${row.said}" is ${textWidth(row.said, row.size)} wide on a screen ${W} wide`);
  }
}
const said = ['THE FOUR LORDS ARE BEATEN', 'THANK YOU FOR PLAYING', 'THE WORLD IS STILL YOURS', 'EARLY ACCESS: THE GAME IS STILL GROWING', 'PRESS TO KEEP DIGGING', 'PRESS AGAIN TO SKIP', 'YOUR DIG', 'HAULS', 'BIGGEST HAUL', 'FURTHEST OUT', 'TIME UNDERGROUND', 'CREDITS'];
if (lang !== 'en') for (const line of said) check(tr(line) !== line, `${lang}: "${line}" is not turned`);

// ---- drawn at every part on every size, with nothing thrown
for (const [w, h, wide] of [[360, 640, false], [160, 284, false], [960, 540, true], [1280, 800, true], [1920, 1080, true]]) {
  const g = await beaten();
  if (wide) g.desktop = { fullscreen: false, toggle() {}, quit() {} };
  g.resize(w, h, 1, wide);
  g.finale.begin(g);
  for (let t = 0; t < ROLL_AT + 4; t += 0.5) { g.finale.step(g, 0.5); g.render(); }
  g.finale.run.atEnd = true; g.render();
}

if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
console.log(`ok x-finale (${lang}): it comes once, skips by touch, key and pad, replays, and the game goes on`);
