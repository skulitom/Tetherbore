// The tether is drawn on a canvas of its own, laid over the game's, and is cut away wherever the interface is. The
// plate that names a place and the count of specimens under it are interface too: with the tether running up the
// screen behind them it was drawn across the name (seen in a picture of FROTHY SOOTFEN, whose last letter the
// tether struck out). Here the cuts made in the tether's canvas are listed for a frame with both panels up, and
// each panel's own rectangle must be among them; with neither up, there is no cut there.
//   node test/regress/s5-plate-over-tether.mjs
import { Game, C } from '../harness.mjs';

const problems = [], game = new Game(document.createElement('canvas'), document.createElement('canvas'));
game.fresh(7, true);
game.resize(360, 640, 1);
// The drill a little way out, so there is a tether to draw.
for (let f = 0; f < 40; f++) { game.input.auto = [0, -1, 1]; game.update(1 / 60); }
game.input.auto = null;
const cuts = [];
game.overCtx.clearRect = (x, y, w, h) => { cuts.push([x, y, w, h]); };
const frame = () => { cuts.length = 0; game.render(); return cuts.map(c => c.join(',')); };
const within = ([x, y, w, h]) => cuts.some(([cx, cy, cw, ch]) => cx <= x && cy <= y && cx + cw >= x + w && cy + ch >= y + h);

game.place = null; game.specLine = null;
let made = frame();
if (!game.ropes.length) problems.push('no tether was drawn on the canvas laid over the game: the test stages nothing');
if (cuts.some(([x, y, w, h]) => y >= 43 && y < 80 && x < 100 && w < 200)) problems.push(`with no panel up the tether is cut under the top bar: ${made.join(' | ')}`);

game.place = { title: 'FROTHY SOOTFEN', icon: 'ember', mineral: null, also: 'mire', colour: '#ffffff', t: 1, card: false, life: 2.4 };
game.specLine = { kin: 3, t: 1, life: 3 };
made = frame();
if (game.panels.length !== 2) problems.push(`${game.panels.length} panels listed with a plate and a count of specimens up`);
for (const [n, what] of [[0, 'the plate that names a place'], [1, 'the count of specimens']]) {
  const p = game.panels[n];
  if (!p) continue;
  if (!(p[1] === (n ? 20 : 4) && p[3] === 14 && p[2] > 20)) problems.push(`${what} is listed at ${p}`);
  if (!within(p)) problems.push(`the tether is not cut away behind ${what} (${p}): ${made.join(' | ')}`);
}
// A name across the screen (the first meeting) is no panel: the tether stays whole under it.
game.place = { ...game.place, card: true }; game.specLine = null;
frame();
if (game.panels.length) problems.push('a title card is listed as a panel');

if (problems.length) { console.log('PROBLEMS\n' + problems.join('\n')); process.exit(1); }
console.log(`ok: the tether is cut away behind both panels`);
