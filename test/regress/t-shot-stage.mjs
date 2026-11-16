// The view that tools/shot.mjs photographs (js/shot.js, behind `?shot` in js/main.js), with no browser: js/main.js
// itself is run on the harness's stand-in page, once for each address.
//   An ordinary start reads the saved game, stages nothing, and saves as ever; away from localhost it shows no hook.
//   `?shot` reads no saved game and never writes one. The drill stands where it was asked to, in an open room at
//   the end of an open tunnel from the core, the tether sound, on the first reach that gets there; every cell in
//   view is uncovered; ground standing loose in view is known (a wreck in its hollow); `zoom` widens the game's
//   canvas and leaves the tether's as it was; `lit` takes the dark away; `met` puts the place's name on its plate
//   in place of the title card of a first meeting; `wake` wakes the hazard nearest the drill, as a cut beside it
//   would, and nothing is woken without it; `bombs` gives the drill that level of BLAST and carves no room, and
//   `blast` sets one charge off there; `key` stands the drill at the last key of the slab nearest, the other keys
//   cut through, pushing into it, so that stepped half a second the cut's glow holds the whole slab and stepped two
//   the slab hangs loose and the drill has let go; `pocket` stands the drill inside the pocket nearest, in the lane
//   beside the nugget at a hive's middle, with no room carved and the hive's amber left standing, and `haul` brings
//   that many nuggets home from there, which banks their specimens; and stepped for three seconds, nothing
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
    check(t.shot.level === 5 && t.shot.reach === 400 && game.S.lv.tether === 5, `the reach is level ${t.shot.level} (${t.shot.reach}), not the first that reaches 300 cells (5, 400)`);
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

// `key`: the last cut of a keystone slab (seed 7's first slab lies 52 cells south of the core, 3 east).
{
  const t = await open('?shot&seed=7&at=3,52&key'), game = t.game, w = game.world, d = game.drill, S = w.firstSlab, f = t.shot.facts();
  const left = S.keys.filter(i => w.k(i) === K.KEY), mid = S.cy * N + S.cx;
  check(f.key && f.key.slab[0] === 3 && f.key.slab[1] === 52 && f.key.radius === 8, `staged with key: ${JSON.stringify(f.key)}`);
  check(left.length >= 1 && left.length <= 3 && left.length < S.keys.length, `${left.length} of the slab's ${S.keys.length} cells of key are left standing`);
  check(w.slabCell(S, Math.floor(d.x), Math.floor(d.y)) > 0 && w.k(game.di) === K.EMPTY && !game.pieceOf.has(mid), 'the drill does not stand in the crack, or the slab is loose before the cut');
  check(game.S.lv.tether === 2 && !tetherFaults(game).length, `the reach is level ${game.S.lv.tether}; the tether: ${tetherFaults(game).join('; ')}`);
  const [x0, y0] = [d.x, d.y];
  t.advance(500);
  const glow = t.shot.facts().key.glow, into = (C + f.key.into[1]) * N + C + f.key.into[0];
  check(d.dig === into && w.k(into) === K.KEY, `half a second on the drill is cutting ${d.dig}, not the key at ${into}`);
  check(glow >= 140 && game.preview[0].cells.includes(mid), `the glow of the cut in hand holds ${glow} cells`);
  t.advance(1500);
  const piece = game.pieceOf.get(mid);
  check(w.k(into) === K.EMPTY && piece && piece.length === glow, `two seconds on the key is ${w.k(into) === K.EMPTY ? 'cut' : 'standing'} and ${piece ? piece.length : 'none'} of the slab's cells hang loose (the glow held ${glow})`);
  check(Math.hypot(d.x - x0, d.y - y0) < 1.6 && game.input.auto === null, `with the key cut the drill has gone on ${Math.hypot(d.x - x0, d.y - y0).toFixed(1)} cells`);
  check(!tetherFaults(game).length, `the tether beside the loose slab: ${tetherFaults(game).join('; ')}`);
  // Steering is whoever's it was.
  game.input.auto = [0, -1, 1];
  check(game.input.auto?.[1] === -1, 'after a view staged with `key` the stick cannot be taken');
  // Without it, and with no slab near: nothing of the kind.
  const none = await open('?shot&seed=7&at=3,36'), far = await open('?shot&seed=7&at=0,-300&key');
  check(none.shot.facts().key === null && none.game.world.firstSlab.keys.every(i => none.game.world.k(i) === K.KEY), 'a view staged without `key` cut keys');
  check(far.shot.facts().key === null && far.game.drill.y === C - 300 + 0.5 && far.game.input.auto === null, 'with no slab within reach of `at`, `key` staged something');
}

// `pocket` and `haul`: inside the west's first hive on seed 7, which lies at -205,-14.
{
  const t = await open('?shot&seed=7&at=-200,-10&pocket&met'), game = t.game, w = game.world, d = game.drill, f = t.shot.facts();
  const Z = w.zoneOf(-2, -1), x = Math.floor(d.x), y = Math.floor(d.y);
  check(f.pocket && f.pocket.at[0] === Z.cx - C && f.pocket.at[1] === Z.cy - C && f.pocket.ground === 'hive' && f.pocket.hauled === 0 && f.ground === 'hive', `staged with pocket: ${JSON.stringify(f.pocket)}, in ${f.ground}`);
  check(Math.max(Math.abs(x - Z.cx), Math.abs(y - Z.cy)) === 3 && w.k(y * N + x) === K.EMPTY, `the drill stands ${x - Z.cx},${y - Z.cy} from the hive's middle`);
  // The nugget at the middle stands, and no room was carved: wax or amber within two cells of the drill.
  let amber = 0, near = 0;
  for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) if (w.k((Z.cy + v) * N + Z.cx + u) === K.MINERAL) amber++;
  for (let v = -2; v <= 2; v++) for (let u = -2; u <= 2; u++) if (w.k((y + v) * N + x + u) !== K.EMPTY) near++;
  check(amber === 9 && near > 0, `${amber} cells of the middle nugget stand, ${near} cells of ground within two of the drill`);
  check(tetherFaults(game).length === 0, `the tether into the hive: ${tetherFaults(game).join('; ')}`);
  t.advance(500);
  check(game.place && game.place.title === 'AMBER HIVE' && game.place.card === false && game.place.mineral === 'amber' && game.S.spec.every(n => n === 0), `half a second on: ${JSON.stringify(game.place)}`);
  const one = await open('?shot&seed=7&at=-200,-10&pocket&haul=1'), two = await open('?shot&seed=7&at=-200,-10&pocket&haul=2');
  check(one.shot.facts().pocket.hauled >= 9 && one.shot.facts().pocket.hauled <= 11 && one.game.S.spec[3] === 2.25 && one.game.hauled.light && one.game.specLine, `staged with haul=1: ${JSON.stringify(one.shot.facts().pocket)}`);
  check(two.shot.facts().pocket.hauled >= 18 && two.game.S.spec[3] === 4.5 && !two.game.hauled.light && two.game.banner && two.game.bannerSays(two.game.banner)[2] === '+4', `staged with haul=2: ${JSON.stringify(two.shot.facts().pocket)}`);
  const none = await open('?shot&seed=7&at=0,-10&pocket&haul=1');
  check(none.shot.facts().pocket === null && none.game.drill.y === C - 10 + 0.5 && none.game.hauled === null && none.game.S.spec.every(n => n === 0), 'with no pocket near `at`, `pocket` staged something');
  const plain = await open('?shot&seed=7&at=-200,-10&haul=1');
  check(plain.shot.facts().pocket === null && plain.game.S.spec.every(n => n === 0), '`haul` without `pocket` hauled something');
}

// `pocket` in the other two kinds. A pumice drift, the north's first (14,-165): the drill stands among the four
// boulders round its middle, every one of them standing and in the books; `haul` brings a whole boulder home, rock
// and all. An ash flat, the south's first (-14,165), which has no open cell: the drill stands in its middle cell
// at the end of a way one cell wide, with ash on both sides of it.
{
  const t = await open('?shot&seed=7&at=14,-160&pocket&met'), game = t.game, w = game.world, d = game.drill, f = t.shot.facts();
  const Z = w.zoneOf(0, -2), x = Math.floor(d.x), y = Math.floor(d.y), loose = cells => game.pieces.filter(piece => w.b(piece[0]) === Z.row).length;
  check(f.pocket && f.pocket.ground === 'drift' && f.ground === 'drift' && Math.max(Math.abs(x - Z.cx), Math.abs(y - Z.cy)) === 3 && w.k(y * N + x) === K.EMPTY, `staged in the drift: ${JSON.stringify(f.pocket)}, the drill ${x - Z.cx},${y - Z.cy} from its middle`);
  t.shot.fit();
  check(loose() === 4 && f.pocket.hauled === 0 && tetherFaults(game).length === 0, `${loose()} boulders of the drift stand loose in the staged view; the tether: ${tetherFaults(game).join('; ')}`);
  t.advance(500);
  check(game.place && game.place.title === 'PUMICE DRIFT' && game.place.mineral === 'aerolite' && loose() === 4, `half a second on: ${JSON.stringify(game.place)}, ${loose()} boulders loose`);
  const one = await open('?shot&seed=7&at=14,-160&pocket&haul=1'), h = one.game.hauled, got = one.shot.facts().pocket.hauled;
  one.shot.fit();
  check(got >= 4 && got <= 12 && h.n === got && h.minerals >= 1 && h.minerals < got && h.light && h.chain === 1 && Math.abs(one.game.S.spec[1] - 0.9 * h.minerals) < 1e-9 && one.game.pieces.filter(piece => one.game.world.b(piece[0]) === Z.row).length === 3,
    `staged with haul=1 in the drift: ${got} cells hauled, ${h.minerals} of them aerolite, specimens ${one.game.S.spec}`);
  const ash = await open('?shot&seed=7&at=-14,160&pocket&met'), A = ash.game.world.zoneOf(-1, 1), ax = Math.floor(ash.game.drill.x), ay = Math.floor(ash.game.drill.y), aw = ash.game.world;
  check(ash.shot.facts().pocket?.ground === 'ash' && ax === A.cx && ay === A.cy && aw.k(ay * N + ax) === K.EMPTY, `staged in the ash flat: ${JSON.stringify(ash.shot.facts().pocket)}, the drill at ${ax - C},${ay - C}`);
  let open3 = 0;
  for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) if (aw.k((ay + v) * N + ax + u) === K.EMPTY) open3++;
  check(open3 <= 3 && tetherFaults(ash.game).length === 0, `${open3} of the nine cells round the drill are open in the ash; the tether: ${tetherFaults(ash.game).join('; ')}`);
  ash.advance(500);
  check(ash.game.place && ash.game.place.title === 'ASH FLATS' && ash.game.place.mineral === 'tektite', `half a second on in the ash: ${JSON.stringify(ash.game.place)}`);
}

if (fails.length) { console.log(`FAIL: ${fails.join('\n      ')}`); process.exit(1); }
console.log('ok: an ordinary start is as it was; `?shot` stages the view asked for and leaves the saved game alone');
