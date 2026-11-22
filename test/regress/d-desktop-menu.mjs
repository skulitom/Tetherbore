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
for (let k = 0; k < 8 && !(toggled && quit); k++) {
  let t = 0, q = 0;
  const { tap } = await menu({ fullscreen: true, toggle() { t++; }, quit() { q++; } });
  for (let n = 0; n < k; n++) tap(DOWN);
  tap(A);
  toggled ||= t === 1; quit ||= q === 1;
}
if (!toggled) problems.push('a controller did not reach FULLSCREEN');
if (!quit) problems.push('a controller did not reach SAVE AND QUIT');

if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('the desktop rows of the menu are there and a controller works them');
