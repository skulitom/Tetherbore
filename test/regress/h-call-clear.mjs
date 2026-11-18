// What is called out across the screen stands clear of the drill and of one another: a haul's banner whole (its
// title on one line or two, its size, its gems on as many lines as they take, what paid most, a prism's line and a
// word more under it), the word across the screen with what it says under it, CORE RESTORED, and a ground's card or a
// lord's, as the game sets them, alone and together as they come in play (the winning relic's banner with CORE
// RESTORED, a haul with a ground met for the first time, a haul with a word come during it), with a place's plate at
// the head (every ground's name, the long ones that go under the map among them), and with the worth of a thing seen
// first standing over the bar. On the narrowest phone (160 x 284), the common one (180 x 320), a tall one (206 x 458)
// and screens held sideways (640 x 360, and 456 x 256, a laptop's window): nothing of any of them drawn within
// DRILL_CLEAR of the drill, over it or under it, as the view keeps it in the middle of the screen over the bar; no
// line of one drawn on a line of another; and the banner's foot over the worth's panel where it stands under the
// drill. A large title too wide for the screen at size 2 is set on two lines at size 2 where they fit (HUGE HAUL! and
// TWIN STONES! in Russian, WRECK PART! PAY +10% everywhere on the narrowest phone), not a size smaller. And every
// glyph of it in a box the tether is cut away under (`callText`), so a line under the drill is not struck through. (A banner
// whose gems took a second line ran onto the drill at 160 x 284, as did CORE RESTORED under the relic's banner, a
// banner pushed down by a plate gone under the map, and a word under a banner; and those titles were small.)
// Run in the language TETHERBORE_LANG names (test/all.mjs runs it in all three).
//   node test/regress/h-call-clear.mjs
import { makeGame, world } from '../harness.mjs';
const { UI } = await import('../../js/drawing.js');
const { HX } = await import('../../js/game.js');
const { BOSS } = await import('../../js/bosses.js');
const { BIOMES } = await import('../../js/world.js');
const { sheets, tinted, textWidth } = await import('../../js/atlas.js');
const { lang, tr } = await import('../../js/lang.js');

const fails = [], check = (ok, what) => { if (!ok && fails.length < 40) fails.push(what); };
const game = await makeGame(7), S = game.S, SHADOW = tinted('font', '#0c0a12');
// What drawHud draws: each glyph's cell (its shadow left out) and each picture, with where it is.
const drawn = [];
let on = false;
game.ctx.drawImage = (image, sx, sy, sw, sh, dx, dy, dw, dh) => {
  if (!on || dw === undefined || image === SHADOW) return;
  drawn.push({ x: dx, y: dy, w: dw, h: dh, glyph: image !== sheets.icons.image && image !== sheets.minerals?.image && sh === 10 && sw <= 10 });
};
// (As on a phone, with the tether on its own canvas over the game: what is called out keeps its boxes for it.)
const hud = () => { drawn.length = 0; on = true; game.over = true; try { game.drawHud(0, 0); } finally { on = false; game.over = null; } };
const gems = list => { const a = new Array(9).fill(0); for (const [i, v] of list) a[i] = v; return a; };
const ALL8 = gems([[1, 9e5], [2, 9e5], [3, 9e5], [4, 9e5], [5, 9e5], [6, 9e5], [7, 9e5], [8, 9e5]]);
const banner = o => Object.assign({ title: 'HAUL', n: 40, mult: 1.6, over: 1, grit: 0, gems: gems([]), light: false, shine: 0, minerals: null, mineral: null, spec: 0, specOf: 1, chain: 0, spin: 0, live: false, t: 1, life: 60, giant: 0, colour: null, sub: null, top: null }, o);
const BANNERS = {
  relic: { title: 'RELIC!', loud: true, n: 24, mult: 1.3, grit: 45000, gems: gems([[1, 120], [2, 80]]) },
  shrine: { title: 'SHRINE!', loud: true, n: 18, mult: 1.4, grit: 52000, gems: gems([[5, 1200], [1, 300]]), sub: 'GEMS x1.1 FOR GOOD' },
  geology: { title: 'GEOLOGY HAPPENED!', n: 900, mult: 4.8, grit: 9.9e9, gems: ALL8, spec: 30, specOf: 2 },
  prism: { title: 'BIG HAUL!', n: 64, mult: 2.1, grit: 6.5e6, gems: gems([[1, 4500], [2, 3000], [3, 120]]), shine: 3, sub: 'GEOLOGISTS ARE SCREAMING' },
  wreck: { title: 'WRECK PART! PAY +10%', loud: true, n: 18, mult: 1.3, grit: 12000, gems: gems([[2, 40]]) },
  twins: { title: 'TWIN STONES!', loud: true, n: 4, mult: 1.2, grit: 3200, gems: gems([[3, 12]]), sub: 'FOSSIL, WHOLE' },
  huge: { title: 'HUGE HAUL!', n: 120, mult: 2.4, grit: 250000, gems: gems([[1, 900], [4, 300]]), sub: 'THE WINCH IS CRYING' },
  small: { title: 'NICE CUT!', n: 6, mult: 1.1, grit: 900, gems: gems([[1, 3]]) },
};
const NOTICES = {
  loaded: { title: 'GAME LOADED', sub: 'IT WAS PLAYED ON IN ANOTHER TAB', colour: '#8ce060' },
  lost: { title: 'TRIP LOST', sub: '-1.2M GRIT, 340K KEPT', colour: '#ff7a5a' },
};
const titles = [...new Set(BIOMES.filter(Boolean).map(b => b.title))];
const card = title => ({ title, icon: 'lode', mineral: null, also: null, colour: '#ffffff', t: 1, card: true, life: 9 });
const plate = title => ({ title, icon: 'lode', mineral: null, also: 'mire', colour: '#ffffff', t: 1, card: false, life: 4 });

// One scene: what is up, drawn, and held. (Out in the ground, 100 cells from the core; at the core, `core`, where
// the shop's button stands over the bar, only that the drill is clear: a banner too tall for the room left under the
// drill there may cover the button a moment.)
let core = false;
const scene = (what, set) => {
  game.drill.x = core ? HX : HX + 100;
  game.banner = null; game.notice = null; game.place = null; game.eye = null; S.won = false; game.wonAt = undefined; game.popups.length = 0;
  set();
  hud();
  const { W, H } = game, x0 = W / 2 - 8, top = Math.round((H - UI.BAR) / 2) - 8 - UI.DRILL_CLEAR, foot = top + 16 + 2 * UI.DRILL_CLEAR;
  const at = `${W}x${H} ${lang}, ${what}`, mid = drawn.filter(r => r.y < H - UI.BAR);
  const near = mid.filter(r => r.x < x0 + 16 && r.x + r.w > x0 && r.y < foot && r.y + r.h > top);
  if (core) what += ', at the core';
  check(!near.length, `${at}: ${near.length} things drawn within ${UI.DRILL_CLEAR} of the drill (${top + UI.DRILL_CLEAR} to ${foot - UI.DRILL_CLEAR}), the first at y ${near[0]?.y}`);
  if (core) return;
  // (Two glyphs of lines at different heights that share pixels: one line on another.)
  const g = mid.filter(r => r.glyph);
  let on = 0, first = null;
  for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
    const a = g[i], b = g[j];
    if (a.y !== b.y && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) { on++; first ??= [a.y, b.y]; }
  }
  check(!on, `${at}: ${on} glyphs of one line drawn on another's (lines at y ${first})`);
  // (Every glyph called out lies in a box the tether is cut away under, or on a panel it is cut away under: a line
  // under the drill is not struck through by the tether running down from it.)
  const c = game.callBoxes, n = 4 * (game.callN ?? 0), within = (r, x, y, w, h) => r.x >= x && r.y >= y && r.x + r.w <= x + w && r.y + r.h <= y + h;
  const boxed = r => { for (let i = 0; i < n; i += 4) if (within(r, c[i], c[i + 1], c[i + 2], c[i + 3])) return true; return game.panels.some(p => within(r, ...p)); };
  const bare = g.filter(r => !boxed(r));
  check(!bare.length, `${at}: ${bare.length} glyphs called out with the tether not cut away under them, the first at ${bare[0]?.x},${bare[0]?.y}`);
  const e = game.eye, b = game.banner;
  if (e && b && b.below && !game.eyeHeld) check(b.y + b.foot <= e.rect[1] - UI.EDGE, `${at}: the banner under the drill ends at ${b.y + b.foot}, on the worth's panel at ${e.rect[1]}`);
};

for (const [cw, ch] of [[320, 568], [360, 640], [412, 916], [1280, 720], [912, 512]]) {
  game.resize(cw, ch, 1);
  for (const [name, o] of Object.entries(BANNERS)) {
    scene(`the banner '${name}'`, () => { game.banner = banner(o); });
    core = true;
    scene(`the banner '${name}'`, () => { game.banner = banner(o); });
    scene(`the banner '${name}' with CORE RESTORED`, () => { game.banner = banner(o); S.won = true; game.wonAt = game.time; });
    core = false;
    scene(`the banner '${name}' with CORE RESTORED`, () => { game.banner = banner(o); S.won = true; game.wonAt = game.time; });
    scene(`the banner '${name}' with a ground's card`, () => { game.banner = banner(o); game.place = card('HOLLOW KILNSTONE'); });
    for (const [word, n] of Object.entries(NOTICES)) scene(`the banner '${name}' with the word '${word}'`, () => { game.banner = banner(o); game.notice = { ...n, t: 1, life: 5 }; });
    scene(`the banner '${name}' with the worth of a thing seen first`, () => {
      game.banner = banner(o);
      game.eye = { key: 'x', sheet: 'icons', frame: 'grit', name: 'SUNSTONE', said: '12 CELLS PAY AS 1 OF ROCK', tier: 2, rim: null, tag: 'HERE x2.5', cell: 0, t: 1, life: 9, W: 0, rect: [0, 0, 0, 0] };
    });
    // (Under a plate at the head, a ground's name on it, the long ones gone under the map among them.)
    for (const title of titles) scene(`the banner '${name}' in ${tr(title)}`, () => { game.banner = banner(o); game.place = plate(title); });
  }
  for (const [word, n] of Object.entries(NOTICES)) {
    scene(`the word '${word}'`, () => { game.notice = { ...n, t: 1, life: 5 }; });
    scene(`the word '${word}' with a ground's card`, () => { game.notice = { ...n, t: 1, life: 5 }; game.place = card('HOLLOW MOULDSTONE'); });
  }
  scene('CORE RESTORED', () => { S.won = true; game.wonAt = game.time; });
  for (const title of titles) scene(`the card of ${tr(title)}`, () => { game.place = card(title); });
  // The lords: each woken, its card; each beaten, its banner, and its banner with the word once all four are.
  BOSS.forEach((B, d) => {
    scene(`${B.name} woken`, () => { game.lordMet(d); if (game.place) game.place.t = 1; });
    scene(`${B.name} beaten`, () => { S.bosses = 15; game.lordBeaten(d, game.drill.x, game.drill.y); game.banner.t = 1; game.notice = null; game.popups.length = 0; });
  });
  // A large title is large: on two lines at size 2 where one is too wide.
  const room = game.W - 2 * UI.EDGE;
  for (const name of ['huge', 'twins', 'wreck', 'geology']) {
    game.banner = banner(BANNERS[name]); game.place = null; game.notice = null; hud();
    const b = game.banner, two = b.lines.length === 2 && b.lines.every(l => textWidth(l, 2) <= room);
    check(b.big === 2 && (b.lines.length === 1 ? textWidth(BANNERS[name].title, 2) <= room : two), `${game.W}x${game.H} ${lang}: '${tr(BANNERS[name].title)}' is set at size ${b.big} on ${b.lines.length} line${b.lines.length > 1 ? 's' : ''} (${b.lines.join(' / ')})`);
  }
}

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : `ok (${lang}): every banner, word, CORE RESTORED and card stands clear of the drill and of one another on every screen, large titles large, the tether cut away under them`);
process.exit(fails.length ? 1 : 0);
