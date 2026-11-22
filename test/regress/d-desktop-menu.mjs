// The desktop build's two rows of the menu (`drawMenu`: FULLSCREEN and SAVE AND QUIT) are there only in that build, and
// a controller reaches and presses them like any other row, at the size a Steam Deck shows the game.
//   node test/regress/d-desktop-menu.mjs
import { makeGame } from '../harness.mjs';
const { Pad, SETTLE } = await import('../../js/pad.js');

const problems = [], dt = 1 / 60, A = 0, DOWN = 13;
const hand = () => ({ connected: true, mapping: 'standard', index: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) });

async function menu(desktop) {
  const game = await makeGame(7), pad_ = hand(), pad = new Pad(game, () => [pad_]);
  game.resize(1280, 800, 1, true);
  if (desktop) game.desktop = desktop;
  const frames = (n = 1) => { for (let f = 0; f < n; f++) { pad.poll(dt); game.update(dt); game.render(); } };
  const tap = b => { pad_.buttons[b].pressed = true; pad_.buttons[b].value = 1; frames(); pad_.buttons[b].pressed = false; pad_.buttons[b].value = 0; frames(2); };
  frames(Math.ceil(SETTLE / dt) + 2);
  game.lab = true; game.labTab = 'menu'; game.labRise = 1;
  frames(3);
  return { game, tap };
}

const plain = await menu(null);
const rows = plain.game.menuRows();
const stubbed = await menu({ fullscreen: true, toggle() {}, quit() {} });
if (stubbed.game.menuRows() <= rows) problems.push('the desktop build has no more rows of the menu than the web');

let toggled = false, quit = false;
for (let k = 0; k < 10 && !(toggled && quit); k++) {
  let t = 0, q = 0;
  const { tap } = await menu({ fullscreen: true, toggle() { t++; }, quit() { q++; } });
  for (let n = 0; n < k; n++) tap(DOWN);
  tap(A);
  toggled ||= t === 1; quit ||= q === 1;
}
if (!toggled) problems.push('a controller did not reach FULLSCREEN');
if (!quit) problems.push('a controller did not reach SAVE AND QUIT');

// No two rows of the menu lie on one another, and the list of achievements is worked and left with the pad.
{
  const { game, tap } = await menu({ fullscreen: true, toggle() {}, quit() {} });
  const frame = game.buttons.find(b => b.swallow), rows = game.buttons.slice(0, game.buttons.indexOf(frame)).filter(b => b.y > frame.y && b.w > 100 && b.w < game.W).sort((a, b) => a.y - b.y);
  if (rows.length !== 8) problems.push(`the desktop menu has ${rows.length} rows, not 8`);
  for (let n = 1; n < rows.length; n++) if (rows[n].y < rows[n - 1].y + rows[n - 1].h) problems.push(`two rows of the menu overlap at y ${rows[n].y}`);
  for (let n = 0; n < 4; n++) tap(DOWN);
  tap(A);
  if (game.labTab !== 'ach') problems.push(`the fifth row opened ${game.labTab}, not the achievements`);
  const was = game.ach.sel;
  tap(DOWN);
  if (game.ach.sel !== was + 1) problems.push('the pad did not walk the list of achievements');
  tap(1);
  if (!game.lab || game.labTab !== 'menu') problems.push(`B from the achievements left ${game.lab ? game.labTab : 'no panel'}, not the menu`);
}

if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('the desktop rows of the menu are there and a controller works them');
