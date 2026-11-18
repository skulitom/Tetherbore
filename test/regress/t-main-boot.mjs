// What js/main.js does as the page boots and with each frame, run on the harness's stand-in page (as t-shot-stage
// runs it), and not read from its source:
//   - a page with a game to go on with in local storage (`hasSave`) makes the game blank: no world is begun before
//     restore (Game.fresh is not called until restore has begun), and the game it goes on with is the saved one;
//     a page with none, or with an older save, begins a new world as the game is made, as ever;
//   - a frame whose step and drawing take under AHEAD_UNDER ms lays AHEAD_ROWS rows of the world ahead, about the
//     drill (`World.ahead`), and rows are laid; a frame that takes AHEAD_UNDER ms or more lays none, nor does one
//     while a game is being loaded; AHEAD_UNDER and AHEAD_ROWS are more than nothing.
// (The page's clock is stood in for, so that how long a frame takes is what the test says.)
//   node test/regress/t-main-boot.mjs
import { makeGame, Game, world } from '../harness.mjs';

const { AHEAD_ROWS, AHEAD_UNDER } = world;
const SAVE = 'tetherbore-save-v3', LATEST = `${SAVE}-latest`, fails = [];
const check = (ok, what) => { if (!ok && fails.length < 20) fails.push(what); };

// What js/main.js asks of a page beyond what the harness stands in for, its frames kept to be called by hand.
const element = document.getElementById;
document.getElementById = id => Object.assign(element(id), { addEventListener() {}, setPointerCapture() {} });
let frame = null;
Object.assign(globalThis, { innerWidth: 360, innerHeight: 640, devicePixelRatio: 1, requestAnimationFrame: f => { frame = f; return 0; }, addEventListener() {} });
document.hasFocus = () => true;
let clock = 1000;
const realPerformance = globalThis.performance;
Object.defineProperty(globalThis, 'performance', { value: { now: () => clock }, configurable: true, writable: true });

// Game.fresh as the page calls it: counted until restore has begun.
let restoring = false, freshFirst = 0;
const fresh = Game.prototype.fresh, restore = Game.prototype.restore;
Game.prototype.fresh = function (...a) { if (!restoring) freshFirst++; return fresh.apply(this, a); };
Game.prototype.restore = function (...a) { restoring = true; return restore.apply(this, a); };
let opened = 0;
const boot = async local => {
  for (const k of [SAVE, LATEST, `${SAVE}-kept`]) localStorage.removeItem(k);
  for (const [k, v] of Object.entries(local)) localStorage.setItem(k, v);
  restoring = false; freshFirst = 0; frame = null;
  globalThis.location = { search: '', hostname: 'localhost' };
  delete globalThis.tetherbore;
  await import(`../../js/main.js?${opened++}`);
  await new Promise(done => setTimeout(done, 20));
  return globalThis.tetherbore.game;
};

// A saved game for the page to find.
Object.defineProperty(globalThis, 'performance', { value: realPerformance, configurable: true, writable: true });
const first = await makeGame(99);
first.S.grit = 4321;
first.save();
const saved = { [SAVE]: localStorage.getItem(SAVE), [LATEST]: localStorage.getItem(LATEST) };
Object.defineProperty(globalThis, 'performance', { value: { now: () => clock }, configurable: true, writable: true });

// ---- blank where there is a game to go on with, and not where there is none
{
  const game = await boot(saved);
  check(freshFirst === 0, `with a saved game the page began ${freshFirst} worlds before restore: the game was not made blank`);
  check(game.S.seed === 99 && game.S.grit === 4321, `with a saved game the page goes on with seed ${game.S.seed} and ${game.S.grit} grit, not the saved game`);
}
for (const [what, local] of [['nothing saved', {}], ['an older save', { [SAVE]: '{"v":2,"seed":9}' }]]) {
  const game = await boot(local);
  check(freshFirst === 1, `with ${what} the page began ${freshFirst} worlds as the game was made, not one`);
  check(game.S && game.world.made > 0, `with ${what} the page has no game`);
}

// ---- laying ahead, after a frame with time to spare
check(AHEAD_UNDER > 0 && AHEAD_ROWS > 0, `AHEAD_UNDER is ${AHEAD_UNDER} and AHEAD_ROWS ${AHEAD_ROWS}: the page never lays ahead`);
{
  const game = await boot(saved), w = game.world;
  let asked = [], laid = 0;
  const ahead = w.ahead;
  w.ahead = function (x, y, rows) { const n = ahead.call(this, x, y, rows); asked.push([x, y, rows]); laid += n; return n; };
  const update = game.update;
  let slow = 0;
  game.update = function (dt) { clock += slow; return update.call(this, dt); };
  const run = n => { for (let f = 0; f < n; f++) { clock += 16; const f0 = frame; f0(clock); } };
  check(typeof frame === 'function', 'the page asked for no frame');
  run(30);
  check(asked.length === 30 && asked.every(([x, y, rows]) => x === game.drill.x && y === game.drill.y && rows === AHEAD_ROWS), `30 quick frames laid ahead ${asked.length} times, or not AHEAD_ROWS about the drill: ${JSON.stringify(asked.slice(0, 2))}`);
  check(laid > 0 && laid <= 30 * AHEAD_ROWS, `30 quick frames laid ${laid} rows ahead`);
  asked = []; slow = AHEAD_UNDER;
  run(10);
  check(asked.length === 0, `10 frames of AHEAD_UNDER ms laid ahead ${asked.length} times`);
  slow = 0; game.loading = true;
  run(10);
  check(asked.length === 0, `10 quick frames while a game was being loaded laid ahead ${asked.length} times`);
  game.loading = false;
  run(1);
  check(asked.length === 1, 'a quick frame after the load did not lay ahead');
  check(!game.failedAt, 'a frame threw');
}
Game.prototype.fresh = fresh; Game.prototype.restore = restore;
Object.defineProperty(globalThis, 'performance', { value: realPerformance, configurable: true, writable: true });

if (fails.length) { console.log(`FAIL t-main-boot: ${fails.join('; ')}`); process.exit(1); }
console.log('ok t-main-boot: js/main.js makes the game blank only with a game to go on with, and lays ahead after a frame with time to spare and only then');
