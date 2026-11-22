// The controller (js/pad.js), on a stand-in pad, with the game stepped and drawn as the page does it:
//   - with no pad nothing happens: the list of pads is not read, nothing is drawn, and a flight is the same to the bit;
//   - the stick flies the drill through `Game.steer`, as hard as it is pushed, with nothing inside the dead zone, and
//     the d-pad flies it too; a fresh stroke throws it from the core; letting go or unplugging leaves nothing held;
//   - every screen is reached and worked with the pad alone: the shop and its tabs and rows (a row bought), the lab's
//     list, STATS, the map (panned and zoomed), the menu with its volumes, the language list and the new world's
//     second press; B goes back a step at a time;
//   - the prompts are shown only once the pad has been used, go when a key is used, and at 1280x800 (a Steam Deck) are
//     at least 9 screen pixels high, fit the screen, and cover no row the focus can reach, in each language.
//   node test/regress/p-pad.mjs
import { makeGame, random } from '../harness.mjs';
const { Pad, DEAD, SETTLE, PAD_WORDS } = await import('../../js/pad.js');
const { TABS } = await import('../../js/shop.js');
const { musicVolume, setMusicVolume } = await import('../../js/audio.js');
const { LANGS, lang, fits } = await import('../../js/lang.js');
const { textWidth } = await import('../../js/atlas.js');

const fails = [], check = (ok, what) => { if (!ok && fails.length < 40) fails.push(what); };
const A = 0, B = 1, X = 2, Y = 3, LB = 4, RB = 5, LT = 6, RT = 7, VIEW = 8, START = 9, UP = 12, DOWN = 13, LEFT = 14, RIGHT = 15;
const standIn = () => ({ connected: true, mapping: 'standard', index: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) });
const dt = 1 / 60;

// 1. No pad: the list is not read after the first look, nothing is put on the game, and a flight is the same.
{
  let reads = 0;
  const fly = async withPad => {
    const real = Math.random, rnd = random(5);
    Math.random = rnd;
    const game = await makeGame(7), pad = withPad ? new Pad(game, () => { reads++; return []; }) : null;
    let sum = 0;
    for (let f = 0; f < 600; f++) {
      pad?.poll(dt);
      game.input.auto = [Math.cos(f / 40), Math.sin(f / 55), 1];
      game.update(dt);
      sum = (sum * 31 + game.drill.x * 1000 + game.drill.y * 7) % 1e9;
    }
    Math.random = real;
    if (pad) check(game.pad === null && !pad.live, 'with no pad connected the game was given one');
    return `${sum} ${game.drill.x} ${game.drill.y} ${game.S.grit}`;
  };
  const bare = await fly(false), padded = await fly(true);
  check(bare === padded, `a flight with the module idle differs: ${bare} against ${padded}`);
  check(reads === 1, `the list of pads was read ${reads} times with none connected`);
}

// A game with the pad plugged in, stepped and drawn as the page does.
const game = await makeGame(7), hand = standIn();
let list = [hand];
const pad = new Pad(game, () => list);
check(pad.live && game.pad === pad, 'a pad already connected was not taken up');
const frames = (n = 1) => { for (let f = 0; f < n; f++) { pad.poll(dt); game.update(dt); game.render(); } };
const set = (b, on) => { hand.buttons[b].pressed = on; hand.buttons[b].value = on ? 1 : 0; };
const tap = b => { set(b, true); frames(); set(b, false); frames(2); };
const stick = (x, y) => { hand.axes[0] = x; hand.axes[1] = y; };
const panel = () => game.shop ? `shop:${game.shopTab}` : game.lab ? `lab:${game.labTab}` : 'shut';
// A button still down as the page comes up (the A that chose a language, which reloads the page) is no press, however
// long it stays down.
set(A, true); frames(Math.ceil(SETTLE / dt) + 10);
check(panel() === 'shut' && !pad.shown, `A held as the page came up left ${panel()}`);
set(A, false); frames(2);

// 2. The prompts wait for the pad to be used.
let legends = 0;
const legend = pad.legend;
pad.legend = function (...a) { legends++; return legend.apply(this, a); };
frames(3);
check(!pad.shown && legends === 0, 'prompts were drawn before the pad was used');

// 3. Flight.
stick(DEAD * 0.8, 0); frames(5);
check(game.steer()[2] === 0 && !pad.shown, `inside the dead zone it steered ${game.steer()[2]}`);
stick(0.6, 0); frames();
const gentle = game.steer();
check(gentle[2] > 0 && gentle[2] < 1 && gentle[0] === 1, `a stick part way steered ${gentle}`);
check(pad.shown, 'a stick pushed did not count as the pad used');
stick(1, 0); frames();
check(game.steer()[2] === 1, `a stick at its edge steered ${game.steer()[2]}`);
stick(0, 0); frames(40);
check(game.steer()[2] === 0 && game.input.pad === null, 'a stick let go left the drill steered');
game.fresh(7, true); frames(2);
stick(1, 0); frames(40); stick(0, 0); frames(2);
check(game.far > 3, `a stroke from the core took the drill only ${game.far} out`);
const was = game.drill.y;
set(DOWN, true); frames(20); set(DOWN, false); frames(2);
check(game.drill.y > was, 'the d-pad did not fly the drill');
game.fresh(7, true); frames(2);
check(game.atCore, 'not at the core for the panels');

// 4. The shop and each of its tabs, by A and the bumpers, each row reached by the focus.
game.S.grit = 1e9;
tap(A);
check(panel() === `shop:${TABS[0].id}`, `A at the core opened ${panel()}`);
frames(12);
for (let t = 0; t < TABS.length; t++) {
  check(panel() === `shop:${TABS[t].id}`, `the bumper reached ${panel()}, not ${TABS[t].id}`);
  const rows = pad.list().length;
  check(rows === TABS[t].rows.length, `${TABS[t].id} offers ${rows} rows of ${TABS[t].rows.length}`);
  const seen = new Set([pad.focus]);
  for (let n = 1; n < rows; n++) { tap(DOWN); seen.add(pad.focus); }
  check(seen.size === rows, `${TABS[t].id}: the focus reached ${seen.size} rows of ${rows}`);
  tap(RB);
}
check(panel() === `shop:${TABS[0].id}`, `RB from the last tab went to ${panel()}`);
tap(LB); check(panel() === `shop:${TABS.at(-1).id}`, `LB from the first tab went to ${panel()}`);
tap(RB); frames(2);
const first = TABS[0].rows.find(u => game.canBuy(u));
if (first) {
  while (pad.list()[pad.focus] && TABS[0].rows[pad.focus] !== first) tap(DOWN);
  const before = game.S.lv[first.id];
  tap(A);
  check(game.S.lv[first.id] === before + 1, `A on ${first.id} left it at level ${game.S.lv[first.id]} from ${before}`);
} else check(false, 'nothing to buy in the first tab');
tap(B); check(panel() === 'shut', `B in the shop left ${panel()}`);

// 5. The lab's list, STATS and the panel's keys.
tap(X); check(panel() === 'lab:lab', `X opened ${panel()}`);
frames(12);
const at = game.labSel;
tap(DOWN); check(game.labSel !== at, 'the d-pad did not walk the lab\'s list');
const walked = game.labSel;
tap(RT); check(game.labSel !== walked, 'RT did not page the lab\'s list');
stick(0, 1); frames(40); stick(0, 0); frames(2);
check(game.labSel !== walked, 'the stick held did not walk the list');
tap(B); check(panel() === 'shut', `B in the lab left ${panel()}`);
tap(Y); check(panel() === 'lab:stats', `Y before the chart opened ${panel()}`);
tap(VIEW); check(panel() === 'shut', `View with a panel up left ${panel()}`);
tap(VIEW); check(game.lab, 'View did not open the panel');
tap(B);

// A stick held as a panel opens does not walk it until it has come back.
tap(X); frames(2); tap(B);
stick(0, 1); frames(3);
const heldAt = game.labSel;
set(X, true); frames(); set(X, false); frames(30);
check(game.labSel === heldAt, 'a stick held as the panel opened walked its list');
stick(0, 0); frames(2); tap(B); frames(2);

// 6. The map.
game.S.lv.chart = 1;
tap(Y);
check(panel() === 'lab:chart', `Y with the chart opened ${panel()}`);
frames(12);
const zoom0 = game.chart.zoom;
set(RT, true); hand.buttons[RT].value = 1; frames(30); set(RT, false); frames();
check(game.chart.zoom > zoom0, `RT left the map at zoom ${game.chart.zoom}`);
const cx = game.chart.x;
stick(1, 0); frames(20); stick(0, 0); frames();
check(game.chart.x > cx, 'the stick did not pan the map');
const zoomed = game.chart.zoom;
set(LT, true); hand.buttons[LT].value = 1; frames(10); set(LT, false); frames();
check(game.chart.zoom < zoomed, 'LT did not zoom the map out');
tap(B);

// 7. The menu: Start, its rows, the volumes, the languages, and a new world's two presses.
tap(START); check(panel() === 'lab:menu', `Start opened ${panel()}`);
frames(12);
check(pad.list().length === 4, `the menu offers ${pad.list().length} rows`);
setMusicVolume(5);
tap(DOWN); check(pad.focus === 1, `down went to row ${pad.focus}`);
tap(LEFT); check(musicVolume() === 4, `left on MUSIC set ${musicVolume()}`);
tap(RIGHT); tap(RIGHT); check(musicVolume() === 6, `right on MUSIC set ${musicVolume()}`);
tap(A); check(musicVolume() === 0, `A on MUSIC left ${musicVolume()}`);
tap(A); check(musicVolume() === 6, `A again on MUSIC left ${musicVolume()}`);
tap(DOWN); check(pad.focus === 2, `down went to row ${pad.focus}`);
tap(A); check(game.langOpen, 'A on LANGUAGE did not open the list');
frames(2);
check(pad.list().length === 4 + LANGS.length, `the open list offers ${pad.list().length} rows`);
check(pad.focus === 3 + LANGS.findIndex(l => l.id === lang), `the list opened at row ${pad.focus}`);
tap(B); check(!game.langOpen && panel() === 'lab:menu', `B on the list left ${panel()}, list ${game.langOpen}`);
check(pad.focus === 2, `the list shut with the focus on row ${pad.focus}`);
tap(A); frames(2); tap(A); frames(2);       // (the language spoken, chosen: the list shuts and nothing reloads)
check(!game.langOpen && pad.focus === 2, `choosing the language spoken left the list ${game.langOpen}, row ${pad.focus}`);
tap(DOWN); check(pad.focus === 3, `down went to row ${pad.focus}`);
const seed = game.S.seed;
tap(A); check(game.confirmReset > 0 && game.S.seed === seed, 'the first press on NEW WORLD did not ask');
tap(UP); check(game.confirmReset === 0, 'moving off NEW WORLD left it armed');
tap(DOWN); tap(A); tap(A);
check(game.S.seed !== seed && panel() === 'shut', `two presses on NEW WORLD left seed ${game.S.seed}, ${panel()}`);

// 8. The prompts at a Steam Deck's size, on every screen, and the keyboard taking them away.
game.resize(1280, 800, 1);
check(game.scale * 5 >= 9, `at 1280x800 a row of the font is ${game.scale} pixels`);
frames(2);
const walk = (what) => {
  frames(14);
  check(pad.shown, `${what}: the prompts are not shown`);
  for (const b of pad.list()) check(b.y + b.h <= game.H - 13, `${what}: the prompts cover a row at ${b.y}`);
};
for (const word of PAD_WORDS) check(fits(word), `'${word}' is not in the table for ${lang}`);
for (const word of PAD_WORDS) check(textWidth(word) <= game.W, `'${word}' is wider than the screen`);
game.S.lv.chart = 1;
tap(START); walk('menu');
tap(A); walk('menu');          // (a volume muted, and the row's own prompts)
tap(A);
tap(DOWN); tap(DOWN); tap(A); walk('languages'); tap(B);
for (const name of ['stats', 'lab', 'chart']) { game.openLab(true, name); frames(2); walk(name); }
game.openLab(false); frames(2);
game.shop = true; frames(2);
for (let t = 0; t < TABS.length; t++) { walk(TABS[t].id); tap(RB); }
tap(B);
legends = 0; frames(2);
check(legends > 0, 'no prompts at the core');
pad.heard();
legends = 0; frames(3);
check(!pad.shown && legends === 0, 'a key used left the prompts up');

// 9. Another window has the focus: the pad is not this game's, and a button held as it comes back is no press.
document.hasFocus = () => false;
stick(1, 0); set(A, true); frames(3);
check(game.input.pad === null && !game.shop, 'the pad worked the game with another window in front');
document.hasFocus = () => true;
stick(0, 0); frames(2);
check(!game.shop, 'a button held as the window came back counted as a press');
set(A, false); frames(2);

// 10. Unplugged in flight: nothing stays held, and the game has no pad.
stick(1, 0); frames(3);
list = [null];
frames(2);
check(game.input.pad === null && game.pad === null && !pad.live && !pad.shown, 'unplugged, the pad was still held');

for (const f of fails) console.log(f);
console.log(fails.length ? `${fails.length} FAILED` : `ok p-pad: flight and every screen worked by a pad, in ${lang}, and nothing with none`);
process.exit(fails.length ? 1 : 0);
