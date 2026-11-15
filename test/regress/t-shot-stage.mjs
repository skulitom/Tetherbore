// The view that tools/shot.mjs photographs (js/shot.js, behind `?shot` in js/main.js), with no browser: js/main.js
// itself is run on the harness's stand-in page, once for each address.
//   An ordinary start reads the saved game, stages nothing, and saves as ever; away from localhost it shows no hook.
//   `?shot` reads no saved game and never writes one. The drill stands where it was asked to, in an open room at
//   the end of an open tunnel from the core, the tether sound, on the first reach that gets there; every cell in
//   view is uncovered; ground standing loose in view is known (a wreck in its hollow); `zoom` widens the game's
//   canvas and leaves the tether's as it was; `lit` takes the dark away; `met` puts the place's name on its plate
//   in place of the title card of a first meeting; `wake` wakes the hazard nearest the drill, as a cut beside it
//   would, and nothing is woken without it; `bombs` gives the drill that level of BLAST and carves no room, and
//   `blast` sets one charge off there; and stepped for three seconds, nothing
//   has moved the drill, nothing is wrong with the tether, and the saved game is as it was.
import { makeGame, tetherFaults, sight, C, N, K } from '../harness.mjs';

const SAVE = 'tetherbore-save-v3', fails = [];
const check = (ok, what) => { if (!ok) fails.push(what); };

// What js/main.js asks of a page beyond what the harness stands in for.
const element = document.getElementById;
document.getElementById = id => Object.assign(element(id), { addEventListener() {}, setPointerCapture() {} });
Object.assign(globalThis, { innerWidth: 360, innerHeight: 640, devicePixelRatio: 1, requestAnimationFrame: () => 0, addEventListener() {} });
let opened = 0;
const open = async (search, hostname = 'localhost') => {
  globalThis.location = { search, hostname };
  delete globalThis.tetherbore;
  await import(`../../js/main.js?${opened++}`);
  return globalThis.tetherbore;
};
// Every cell the view shows has been seen.
const uncovered = game => {
  const w = game.world, cx = Math.floor(game.cam.x / 16), cy = Math.floor(game.cam.y / 16), hw = Math.ceil(game.W / 32), hh = Math.ceil(game.H / 32);
  for (let y = cy - hh; y <= cy + hh; y++) for (let x = cx - hw; x <= cx + hw; x++) if (!w.s(y * N + x)) return false;
  return true;
};

// A saved game for the page to find.
const first = await makeGame(99);
first.S.grit = 1234;
first.save();
const saved = localStorage.getItem(SAVE);
check(saved !== null && JSON.parse(saved).seed === 99, 'the harness did not save a game to start from');

// Ordinary play.
const plain = await open('');
check(plain && plain.shot === null, 'an ordinary start staged a view');
check(plain?.game.S.seed === 99 && plain?.game.S.grit === 1234, 'an ordinary start did not read the saved game');
check(plain?.game.daylight === false, 'an ordinary start has no dark');
plain.game.S.grit = 5;
plain.game.save();
check(JSON.parse(localStorage.getItem(SAVE)).grit === 5, 'an ordinary game no longer saves');
localStorage.setItem(SAVE, saved);
check(await open('', 'example.org') === undefined, 'away from localhost an ordinary start shows the test hook');

// 300 cells north: on seed 7 that is in a province of firn, a strain of the north's ground.
{
  const t = await open('?shot&seed=7&at=0,-300', 'example.org'), game = t?.game, d = game?.drill, w = game?.world;
  check(t && t.shot, '`?shot` staged nothing');
  if (t?.shot) {
    check(game.S.seed === 7, `the staged world is on seed ${game.S.seed}, not 7`);
    check(d.x === C + 0.5 && d.y === C - 300 + 0.5, `the drill stands at ${d.x - C - 0.5},${d.y - C - 0.5}, not 0,-300`);
    let room = true;
    for (let v = -2; v <= 2; v++) for (let u = -2; u <= 2; u++) if (w.k((C - 300 + v) * N + C + u) !== K.EMPTY) room = false;
    check(room, 'the room round the drill is not open');
    check(sight(w, d.x, d.y, C + 0.5, C + 0.5), 'the tunnel from the core is not open');
    check(game.band.length === 2 && !tetherFaults(game).length, `the tether as staged: ${tetherFaults(game).join('; ') || `${game.band.length} points`}`);
    check(t.shot.level === 6 && t.shot.reach === 420 && game.S.lv.tether === 6, `the reach is level ${t.shot.level} (${t.shot.reach}), not the first that reaches 300 cells (6, 420)`);
    check(game.W === 180 && game.H === 320, `the view is ${game.W} x ${game.H}, not the game's own 180 x 320`);
    check(uncovered(game), 'ground in view is not uncovered');
    check(game.daylight === false, 'the dark is gone though `lit` was not asked for');
    game.save();
    t.advance(3000);
    check(d.x === C + 0.5 && d.y === C - 300 + 0.5, `after three seconds untouched the drill is at ${d.x - C - 0.5},${d.y - C - 0.5}`);
    check(!tetherFaults(game).length, `the tether after three seconds: ${tetherFaults(game).join('; ')}`);
    check(game.S.stats.hauls === 1 && !game.hauled, 'something was hauled in a view nobody touched');
    const facts = t.shot.facts();
    check(facts.cells.join() === '11,20' && facts.ground === 'firn' && facts.zoom === 1, `what the view says of itself: ${JSON.stringify(facts)}`);
    check(localStorage.getItem(SAVE) === saved, 'the staged view wrote over the saved game');
  }
}

// The name of the place the drill is staged in comes up as it does the first time a ground is met, across the
// screen; with `met` every ground counts as met before, and it comes up on its plate.
{
  const first = (await open('?shot&seed=7&at=0,-300')).game;
  globalThis.tetherbore.advance(100);
  check(first.place?.title === 'FIRN' && first.place.card === true, `the place named in a staged view: ${JSON.stringify(first.place)}`);
  const again = (await open('?shot&seed=7&at=0,-300&met')).game;
  globalThis.tetherbore.advance(100);
  check(again.place?.title === 'FIRN' && again.place.card === false, `the place named in a view staged with \`met\`: ${JSON.stringify(again.place)}`);
}

// At the core nothing is carved, and the first game's title is left as it is.
{
  const t = await open('?shot&seed=7'), game = t.game;
  check(game.drill.x === C + 0.5 && game.drill.y === C + 0.5 && game.S.lv.tether === 0 && game.S.stats.hauls === 0, 'the view at the core is not a fresh game');
  check(game.world.k(C * N + C + 8) !== K.EMPTY || game.world.k((C + 1) * N + C + 8) !== K.EMPTY, 'ground was carved though the drill is at the core');
}

// Zoomed and lit, and a reach that was asked for.
{
  const t = await open('?shot&seed=7&at=300,0&zoom=4&lit&reach=8'), game = t.game;
  check(game.W === 720 && game.H === 1280 && game.scale === 0.5, `zoom 4 made the view ${game.W} x ${game.H} at scale ${game.scale}, not 720 x 1280 at 0.5`);
  check(game.canvas.width === 720 && game.over.width === 360 && game.over.height === 640, `the canvases are ${game.canvas.width} and ${game.over.width} x ${game.over.height} wide`);
  check(uncovered(game), 'ground in the zoomed view is not uncovered');
  check(game.daylight === true, '`lit` left the dark');
  check(game.S.lv.tether === 8, `the reach asked for (8) is ${game.S.lv.tether}`);
  // The tunnel east goes through the first piece beside the core: the books of loose ground know it.
  check([...game.pieceOf.keys()].every(i => game.world.k(i) !== K.EMPTY), 'ground the tunnel opened is still in the books as loose');
  t.advance(500);
  check(!tetherFaults(game).length, `the tether in the zoomed view: ${tetherFaults(game).join('; ')}`);
}

// No canvas wider than 8192 pixels, whatever zoom is asked for.
{
  const t = await open('?shot&seed=7&at=-300,0&zoom=64'), game = t.game;
  check(Math.max(game.W, game.H) === 8192 && t.shot.facts().zoom === 25.6, `zoom 64 made the view ${game.W} x ${game.H} (zoom ${t.shot.facts().zoom})`);
  check(uncovered(game), 'ground in the widest view is not uncovered');
}

// A wreck stands free in its hollow: uncovered, it is known as loose, as it is when the drill comes on it.
{
  const [wx, wy] = (await makeGame(7)).world.wrecks[3], r = Math.hypot(wx - C, wy - C);
  const ax = wx - C + Math.round(-(wy - C) / r * 9), ay = wy - C + Math.round((wx - C) / r * 9);
  const t = await open(`?shot&seed=7&at=${ax},${ay}`), game = t.game;
  check(game.world.k(wy * N + wx) === K.WRECK, 'the wreck beside the room is gone');
  check(game.pieceOf.has(wy * N + wx), 'the wreck in view is not known as loose');
}

// `wake`: the lava nearest the drill is woken as a cut beside it would wake it, and stepped, it quenches its slag
// to steel. Without it nothing is woken.
{
  const steel = game => { let n = 0; for (let y = -12; y <= 12; y++) for (let x = -12; x <= 12; x++) n += game.world.k((C + 158 + y) * N + C + 21 + x) === K.STEEL; return n; };
  const still = await open('?shot&seed=7&at=21,158');
  still.advance(2000);
  check(still.shot.facts().woke === null && still.game.world.lava.size === 0 && steel(still.game) === 0, 'a hazard was woken in a view staged without `wake`');
  const t = await open('?shot&seed=7&at=21,158&wake'), game = t.game;
  check(t.shot.facts().woke === 'lava' && game.world.lava.size === 1, `the view staged with wake woke ${t.shot.facts().woke}, and ${game.world.lava.size} cells of lava are open`);
  t.advance(2000);
  check(game.world.lava.size > 1 && steel(game) > 0, `two seconds after the wake there are ${game.world.lava.size} cells of lava and ${steel(game)} of steel`);
  check(!tetherFaults(game).length, `the tether beside woken lava: ${tetherFaults(game).join('; ')}`);
}

// `bombs`: the drill holds that level of BLAST, and the ground round the end of the tunnel is as the seed laid it
// (no room is carved). `blast`: one charge is set off there, and what it shook loose is known.
{
  const rock = game => { let n = 0; for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) n += game.world.k((C - 156 + y) * N + C + 6 + x) !== K.EMPTY; return n; };
  const room = await open('?shot&seed=7&at=6,-156');
  check(rock(room.game) === 0 && room.shot.facts().bombs === 0 && room.game.S.lv.bombs === 0, 'a view staged without `bombs` has no room round the drill, or has bombs');
  const before = await open('?shot&seed=7&at=6,-156&bombs=3'), b = before.shot.facts();
  check(rock(before.game) > 0 && b.bombs === 3 && before.game.S.lv.bombs === 3 && b.opened === 0, `staged with bombs=3: ${rock(before.game)} cells of rock within two of the drill, ${b.bombs} charges, ${b.opened} opened`);
  const after = await open('?shot&seed=7&at=6,-156&bombs=3&blast'), a = after.shot.facts();
  check(a.bombs === 2 && a.opened > 20 && a.loose > b.loose && rock(after.game) < rock(before.game), `staged with blast: ${a.bombs} charges left, ${a.opened} cells opened, ${a.loose} loose pieces (${b.loose} before)`);
  after.advance(1000);
  check(!tetherFaults(after.game).length, `the tether in the room a charge made: ${tetherFaults(after.game).join('; ')}`);
  const idle = await open('?shot&seed=7&at=6,-156&blast');
  check(idle.shot.facts().opened === 0 && rock(idle.game) === 0, '`blast` without `bombs` set a charge off');
}

if (fails.length) { console.log(`FAIL: ${fails.join('\n      ')}`); process.exit(1); }
console.log('ok: an ordinary start is as it was; `?shot` stages the view asked for and leaves the saved game alone');
