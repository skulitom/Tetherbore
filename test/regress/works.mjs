// The shop's second tab. Things are fitted for grit and the specimens of one direction each: without the
// specimens the tap is refused and says where they are found; with them the specimens are spent. Four change
// what a hazard does to the drill: LAVA SKIN lets it through lava, SPORE DRIVE turns a pod's burst into speed,
// ARC COIL turns an arc into a pip mended, MENDER mends the hull faster than it mends itself (and never as fast as
// the shield after a knock lasts). A game saved before them loads with none. The panel the top bar opens says what
// the drill is now, from the game's own figures. And the shop's tables keep their rules: the first tab's levels ask
// distances that fit the reach they are priced beside, and the late game's open one at a time.
import { makeGame, UPGRADES, WORKS, MAPS, CORE, DEATH, K, B, N, C } from '../harness.mjs';
const { SHIELD } = await import('../../js/game.js');
const { REACH, LAB } = await import('../../js/shop.js');
const { CREATURES } = await import('../../js/fauna.js');

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const fly = (game, x, y, seconds) => { game.input.auto = [x, y, 1]; for (let f = 0; f < seconds * 60; f++) game.update(1 / 60); game.input.auto = null; };
const rest = (game, seconds) => { for (let f = 0; f < seconds * 60; f++) game.update(1 / 60); };
const row = id => WORKS.find(u => u.id === id);
const fitted = async (id, level = 1) => { const game = await makeGame(7, { drill: 4 }, { hull: true }); game.S.lv[id] = level; return game; };

check(WORKS.map(u => u.id).join() === 'mender,lavaskin,sporedrive,arccoil,diamond,flywheel' && WORKS.map(u => u.kin).join() === [B.FROST, B.EMBER, B.MIRE, B.LODE, B.FROST, B.EMBER].join(), `the second tab's rows are ${WORKS.map(u => `${u.id} (${u.kin})`)}`);
// The mender at every level is slower than the shield after a knock: a blow in the moment after a mend still lands.
check(WORKS[0].values.every(v => v > SHIELD) && WORKS[0].spec.slice(0, 3).join() === '8,16,24', `the mender gives a pip back every ${WORKS[0].values} s, where the shield lasts ${SHIELD} s; its specimens are ${WORKS[0].spec}`);
check(WORKS.every(u => u.grit.length === u.values.length - 1 && u.spec.length === u.grit.length && u.grit.every(g => g > 0) && u.spec.every(n => n > 0)), 'a row of the second tab has a level with no price in grit or in specimens');

// ---- buying: refused without the specimens, and says where; spent when bought
{
  const game = await makeGame(7), u = row('lavaskin');
  game.S.grit = 1e9;
  game.buy(u);
  check(game.S.lv.lavaskin === 0 && game.shopNote?.text === 'SOUTH POCKETS', `with grit and no specimens the tap ${game.S.lv.lavaskin ? 'bought' : 'was refused'} and said '${game.shopNote?.text}'`);
  game.S.spec[B.EMBER] = 12.6; game.S.spec[B.FROST] = 40;
  check(game.canBuy(u) && game.specNeed(B.EMBER) === 12, `with 12 of the south's specimens the row ${game.canBuy(u) ? 'can' : 'cannot'} be bought; the south's next asks ${game.specNeed(B.EMBER)}`);
  const grit = game.S.grit;
  game.buy(u);
  // (What it asks next is its level of the late game: sixty specimens, which the bar now says the south wants.)
  check(game.S.lv.lavaskin === 1 && Math.abs(game.S.spec[B.EMBER] - 0.6) < 1e-9 && game.S.grit === grit - u.grit[0] && game.S.spec[B.FROST] === 40 && game.cost(u)?.spec === 60 && game.specNeed(B.EMBER) === 60, `bought: level ${game.S.lv.lavaskin}, the south's specimens ${game.S.spec[B.EMBER]}, grit down ${grit - game.S.grit}, next ${JSON.stringify(game.cost(u))}`);
  const m = row('mender');
  for (let l = 0; l < 3; l++) game.buy(m);
  check(game.S.lv.mender === 2 && game.val('mender') === 9 && Math.abs(game.S.spec[B.FROST] - 16) < 1e-9, `the mender bought as far as 40 specimens go: level ${game.S.lv.mender}, one pip every ${game.val('mender')} s, ${game.S.spec[B.FROST]} specimens left`);
  // Both tabs draw, and a tap on a tab opens it.
  game.resize(320, 568, 1); game.shop = true; game.shopRise = 1; game.render();
  // (The tabs stand in the panel's header, left to right, each a button twenty high and under sixty wide, as wide as
  // its name and the gap to the next: js/drawing.js, `headTab`.)
  const tabs = game.buttons.filter(b => b.h === 20 && b.y < game.H / 2 && b.w < 60 && b.w > 20 && b.x < game.W - 40).sort((a, b) => a.x - b.x);
  tabs[1]?.act(); game.render();
  // What a refused tap says is written on the footer's line, never over the tabs in the header.
  {
    const said = [], fill = game.ctx.drawImage;
    game.buy(row('sporedrive'));
    const note = game.shopNote?.text, top = Math.min(...tabs.map(b => b.y));
    check(note === 'WEST POCKETS' && game.shopNote.t > 0, `a tap refused for want of specimens says '${note}'`);
    // (Text is drawn a glyph at a time: where glyphs are drawn this frame and not the last, the note is.)
    const drawn = () => { const ys = []; game.ctx.drawImage = (...a) => { if (a.length === 9 && a[4] === 10) ys.push(a[6]); }; game.render(); delete game.ctx.drawImage; return ys; };
    const withNote = drawn(); game.shopNote.t = 0; const without = drawn();
    const header = y => y >= top && y < top + 20;
    check(withNote.filter(header).length === without.filter(header).length && withNote.length !== without.length, `with a note up ${withNote.filter(header).length} glyphs are drawn in the header, and ${without.filter(header).length} without`);
  }
  check(tabs.length === 4 && game.shopTab === 'works', `a tap on the second tab left the shop at '${game.shopTab}'`);
  game.shop = false;
  game.save();
  const loaded = await makeGame(7); await loaded.restore();
  check(loaded.S.lv.lavaskin === 1 && loaded.S.lv.mender === 2 && loaded.swims, `loaded: lava skin ${loaded.S.lv.lavaskin}, mender ${loaded.S.lv.mender}`);
  const lv = Object.fromEntries(UPGRADES.map(u => [u.id, game.S.lv[u.id]]));
  localStorage.setItem('tetherbore-save-v3', JSON.stringify({ v: 3, ...game.S, lv }));
  const old = await makeGame(7); await old.restore();
  check(WORKS.every(u => old.S.lv[u.id] === 0) && !old.swims, `a game saved before the second tab loads with ${JSON.stringify(old.S.lv)}`);
}

// ---- lava: shut to the drill, as rock is (leaning on it does not burn); with the skin, the drill flies through it
for (const skin of [0, 1]) {
  const game = await fitted('lavaskin', skin), w = game.world, d = game.drill;
  // A corridor east of the core, and lava across it.
  for (let x = 2; x <= 12; x++) for (let y = -1; y <= 1; y++) w.setK((C + y) * N + C + x, K.EMPTY);
  // (A cell of lava is kept with the seconds it has left to stand.)
  for (let y = -1; y <= 1; y++) { w.lava.set((C + y) * N + C + 7, 9); game.lavaVol.set((C + y) * N + C + 7, 1); }
  game.changed();
  fly(game, 1, 0, 2.5);
  const through = d.x > C + 8.5;
  check(skin ? through && game.hull === 5 && d.mode !== 'dead' : !through && game.hull === 5, `${skin ? 'with' : 'without'} the lava skin the drill flew east to ${(d.x - C).toFixed(1)} with ${game.hull} pips`);
}

// ---- a spore pod's burst: a knock; with the drive, speed
for (const drive of [0, 1]) {
  const game = await fitted('sporedrive', drive), d = game.drill;
  fly(game, 1, 0, 2);
  game.clouds.push({ x: Math.floor(d.x), y: Math.floor(d.y), t: 0, life: 1.5 });
  rest(game, 0.1);
  check(drive ? game.hull === 5 && game.boost > 2 && game.popups.some(p => p.label === 'BOOST') : game.hull === 4 && game.boost === 0, `${drive ? 'with' : 'without'} the spore drive a burst left ${game.hull} pips and a drive of ${game.boost.toFixed(1)} s`);
  // (How fast it flies in open ground, driven and not: a long room, and a second's flight in it.)
  for (let x = -40; x <= 40; x++) for (let y = 20; y <= 24; y++) game.world.setK((C + y) * N + C + x, K.EMPTY);
  d.x = d.px = C - 30.5; d.y = d.py = C + 22.5; game.band = [[d.x, d.y], [C + 0.5, C + 0.5]]; game.changed();
  if (drive) game.boost = 3;
  const x0 = d.x; fly(game, 1, 0, 1.5);
  game.sped = d.x - x0;
  if (drive) { const slow = await fitted('sporedrive', 0), e = slow.drill; for (let x = -40; x <= 40; x++) for (let y = 20; y <= 24; y++) slow.world.setK((C + y) * N + C + x, K.EMPTY); e.x = e.px = C - 30.5; e.y = e.py = C + 22.5; slow.band = [[e.x, e.y], [C + 0.5, C + 0.5]]; slow.changed(); fly(slow, 1, 0, 1.5); check(game.sped > (e.x - x0) * 1.2, `driven by spores the drill flew ${game.sped.toFixed(1)} cells in a second and a half, and ${(e.x - x0).toFixed(1)} without`); }
}

// ---- an arc: a knock; with the coil, a pip mended
for (const coil of [0, 1]) {
  const game = await fitted('arccoil', coil), d = game.drill;
  fly(game, 1, 0, 2);
  game.dents = 1;
  game.zap(Math.floor(d.x) + 2, Math.floor(d.y));
  check(coil ? game.hull === 5 && game.popups.some(p => p.label === 'CHARGED') : game.hull === 3, `${coil ? 'with' : 'without'} the arc coil an arc two cells off left ${game.hull} pips of a hull that had 4`);
  // An arc further off than two and a half cells does not reach the drill.
  if (!coil) { game.shield = 0; game.zap(Math.floor(d.x) + 3, Math.floor(d.y)); check(game.hull === 3, `an arc three cells off left ${game.hull} pips`); }
}

// ---- the hull mends itself: a pip back twenty seconds after the last knock, and sooner with a mender fitted
{
  const game = await fitted('mender', 1), none = await fitted('mender', 0);
  check(game.val('mender') === 14 && none.val('mender') === 20, `a pip mends every ${none.val('mender')} s, and every ${game.val('mender')} with the first mender`);
  for (const g of [game, none]) { fly(g, 1, 0, 2); g.dents = 2; }
  rest(game, 13); rest(none, 13);
  check(game.hull === 3 && none.hull === 3, `a second short of the mender's time the hull has ${game.hull} pips`);
  rest(game, 2); rest(none, 2);
  check(game.hull === 4 && none.hull === 3, `after the mender's fourteen seconds the hull has ${game.hull} pips, and ${none.hull} with no mender`);
  rest(none, 6);
  check(none.hull === 4, `after twenty-one seconds a hull with no mender has ${none.hull} pips`);
  // A knock starts the count again.
  none.hit(0.3); rest(none, 19);
  check(none.hull === 3, `nineteen seconds after a knock a hull with no mender has ${none.hull} pips`);
  rest(none, 2);
  check(none.hull === 4, `twenty-one seconds after it, ${none.hull}`);
}

// ---- what the drill is now
{
  const game = await fitted('lavaskin', 1);
  game.S.lv.tether = 3; game.S.lv.hull = 2; game.dents = 1; game.S.lab['lode-items:oreA'] = 4;
  const said = Object.fromEntries(game.stats().map(([name, value, lit]) => [name, [value, lit]]));
  check(said.REACH[0] === 'PARACORD 160 CELLS' && said.HULL[0] === 'TWIN BAND 6/7 PIPS' && said.MENDS[0] === '1 PIP / 20 S' && said.LAVA[0] === 'SWIMS IN IT' && said.LAVA[1] === true && said.SPORES[0] === 'KNOCK' && said.SPORES[1] === false && said.ANALYSED[0] === `1/${LAB.length}, UP TO +3%`, `the stats say ${JSON.stringify(said)}`);
  game.resize(320, 568, 1); game.labTab = 'stats'; game.openLab(true); game.render();
  // (The panel's tabs stand in its header, left to right: STATS, LAB, MENU; and MAP before MENU once the chart is bought.)
  const heads = game.buttons.filter(b => b.h === 20 && b.w < 60 && b.w > 24 && b.y < game.H / 2).sort((a, b) => a.x - b.x);
  heads[1]?.act(); game.render();
  check(heads.length === 3 && game.labTab === 'lab', `a tap on the second of ${heads.length} tabs left the panel at '${game.labTab}'`);
  // The menu: the sound, the music (a switch of its own, kept as the sound's is), the language (the next of the
  // three kept, and the page loaded again in it: there is no page here), and a new world on the second tap.
  heads[2].act(); game.render();
  const rows = game.buttons.filter(b => b.h === 20 && b.w > 100).sort((a, b) => a.y - b.y), seed = game.S.seed;
  check(game.labTab === 'menu' && rows.length === 4, `the menu has ${rows.length} rows`);
  const audio = await import('../../js/audio.js'), music = audio.isMusic();
  rows[1].act(); game.render();
  check(audio.isMusic() === !music && localStorage.getItem('tetherbore-music') === (music ? '0' : '1'), `a tap on MUSIC left the music ${audio.isMusic() ? 'on' : 'off'}, kept as '${localStorage.getItem('tetherbore-music')}'`);
  rows[1].act(); game.render();
  check(audio.isMusic() === music, 'a second tap on MUSIC did not put it back');
  const { lang, LANGS, LANG_KEY } = await import('../../js/lang.js'), next = LANGS[(LANGS.findIndex(l => l.id === lang) + 1) % LANGS.length].id;
  // (A tap on LANGUAGE opens the list of the three and chooses nothing; one of the list chooses, the one spoken now
  // nothing, and either shuts it.)
  rows[2].act(); game.render();
  const list = () => game.buttons.filter(b => b.h === 16 && b.w > 90).sort((a, b) => a.y - b.y);
  const langs = list();
  check(game.langOpen && langs.length === 3 && localStorage.getItem(LANG_KEY) === null, `a tap on LANGUAGE opened a list of ${langs.length} and kept '${localStorage.getItem(LANG_KEY)}'`);
  langs[LANGS.findIndex(l => l.id === lang)].act(); game.render();
  check(!game.langOpen && localStorage.getItem(LANG_KEY) === null, `the language spoken now, chosen, kept '${localStorage.getItem(LANG_KEY)}'`);
  rows[2].act(); game.render();
  list()[LANGS.findIndex(l => l.id === next)].act(); game.render();
  check(!game.langOpen && localStorage.getItem(LANG_KEY) === next, `${next} chosen from the list kept '${localStorage.getItem(LANG_KEY)}'`);
  localStorage.removeItem(LANG_KEY);
  rows[3].act(); game.render();
  check(game.S.seed === seed && game.confirmReset > 0, 'one tap on NEW WORLD made a new world');
  rows[3].act(); game.render();
  check(game.S.seed !== seed, 'two taps on NEW WORLD made no new world');
  game.openLab(false);
}

// ---- the map shows the ground near the drill, wherever the drill is, and a tap on it does nothing
{
  const game = await makeGame(7);
  game.resize(320, 568, 1); game.render();
  const first = game.mapFor;
  check(first.endsWith(`:${C + 0.5},${C + 0.5}`), `at the core the map is drawn about ${first}`);
  game.S.lv.tether = 6; game.drill.x = C + 300.5; game.drill.y = C - 200.5; game.render();
  check(game.mapFor.endsWith(`:${C + 300.5},${C - 200.5}`), `three hundred cells east the map is drawn about ${game.mapFor}`);
  const [x, y, w, h] = game.mapRect;
  check(!game.buttons.some(b => b.x <= x + w / 2 && b.y <= y + h / 2 && b.x + b.w > x + w / 2 && b.y + b.h > y + h / 2), 'the map can be tapped');
}

// ---- the map's own rows: how far it shows, what it tells apart, the finds it marks, and the chart at the core
{
  const game = await makeGame(7), w = game.world;
  check(MAPS.map(u => u.id).join() === 'maprange,maplens,mapfinder,chart', `the third tab's rows are ${MAPS.map(u => u.id)}`);
  game.resize(320, 568, 1); game.render();
  // The pixel 3 right of the map's middle and 1 below it is the cell 5 east and 2 south of the drill's, at a cell
  // and a half to a pixel. Rich ore laid and seen there is plain rock on the map until the lens is bought.
  const pixel = () => { const o = (24 * 46 + 26) * 4; return [...game.mapData.data.slice(o, o + 3)].join(); };
  w.setK((C + 2) * N + C + 5, K.ORE_B); w.see(C + 5, C + 2, 0); game.version++; game.render();
  const plain = pixel();
  game.S.lv.maplens = 1; game.render();
  check(pixel() === '255,239,106' && plain !== '255,239,106', `rich ore seen is drawn ${plain} without the lens and ${pixel()} with it`);
  // The range: the same square shows further.
  const near = game.mapFor; game.S.lv.maprange = 3; game.render();
  check(game.val('maprange') === 5 && game.mapFor !== near, `with the best range a pixel is ${game.val('maprange')} cells`);
  // The finder: nothing without it; with it, caches within the map's span that the drill has not seen, and no more than its level knows.
  game.S.lv.tether = 6;
  check(game.findsNear(C + 0.5, C + 0.5, 115).length === 0, 'finds are marked with no finder');
  game.S.lv.mapfinder = 1;
  const caches = game.findsNear(C + 0.5, C + 0.5, 115);
  check(caches.length > 0 && caches.every(([what, fx, fy]) => what === 'cache' && w.kindAt(fx, fy, w.biomeAt(fx, fy)) === K.CACHE && w.peek(fx, fy) < 0), `the first finder marks ${caches.length} finds: ${[...new Set(caches.map(f => f[0]))]}`);
  game.S.lv.mapfinder = 3;
  const all = game.findsNear(C + 0.5, C + 0.5, 115);
  check(all.length > caches.length && all.some(f => f[0] === 'geode'), `the best finder marks ${all.length} finds: ${[...new Set(all.map(f => f[0]))]}`);
  // (The ground changes at every cut, and the list is asked again: into one of two lists made once, in turn.)
  const n = all.length;
  game.version++; const again = game.findsNear(C + 0.5, C + 0.5, 115);
  game.version++; const third = game.findsNear(C + 0.5, C + 0.5, 115);
  check(again !== all && again.length === n && all.length === n && third === all, 'the finds are made into a new list each time the ground changes, or the list held before is emptied');
  // It marks what lies near the drill (within 320 cells at its best), however much of the ground is asked about:
  // on the chart of a long reach there is no more than that, and never a band of dots across the north.
  game.S.lv.tether = 8;
  const wide = game.findsNear(C + 0.5, C + 0.5, 1500);
  check(wide.length > 0 && wide.length < 200 && wide.every(([, fx, fy]) => Math.hypot(fx + 0.5 - game.drill.x, fy + 0.5 - game.drill.y) <= 320) && wide.some(f => f[2] > C) && wide.some(f => f[2] < C), `asked about the whole of a reach of 1,350 the finder marks ${wide.length} finds, the furthest ${Math.round(Math.max(...wide.map(([, fx, fy]) => Math.hypot(fx - game.drill.x, fy - game.drill.y))))} cells from the drill`);
  game.S.lv.tether = 6;
  game.render();
  // The chart: a third tab of the top bar's panel, at the core, once bought; a tap on the map there opens it.
  game.labTab = 'chart'; game.openLab(true); game.render();
  check(!game.charted && game.labTab === 'stats', `before the chart is bought the panel can be left at '${game.labTab}'`);
  game.openLab(false); game.S.lv.chart = 1; game.render();
  const [x, y, mw, mh] = game.mapRect;
  game.pointerDown(1, x + mw / 2, y + mh / 2); game.pointerUp(1); game.render();
  check(game.lab && game.labTab === 'chart' && game.chartMap?.mapFor?.endsWith(`:${C + 0.5},${C + 0.5}`), `a tap on the map at the core left the panel ${game.lab ? 'open' : 'shut'} at '${game.labTab}'`);
  game.openLab(false);
  // The chart is zoomed and dragged. A wheel over it zooms about the pointer; a finger drags it; two pinch it; its
  // two buttons step it; and it never leaves the square the whole reach is drawn in, nor zooms out past it.
  {
    game.labTab = 'chart'; game.openLab(true); game.render();
    const [rx, ry, size] = game.chartRect, mid = [rx + size / 2, ry + size / 2], c = game.chart, base = game.chartBase;
    check(c.zoom === 1 && c.x === C + 0.5 && c.y === C + 0.5 && base > 1, `the chart opens at zoom ${c.zoom} about ${c.x - C},${c.y - C}, ${base.toFixed(2)} cells to a pixel`);
    // Zoomed about a point a quarter of the way across: the ground under the pointer stays under it.
    const at = [rx + size / 4, ry + size / 2], under = () => [c.x + (at[0] - mid[0]) * base / c.zoom, c.y + (at[1] - mid[1]) * base / c.zoom], before = under();
    check(game.wheel(at[0], at[1], -100) === true && Math.abs(c.zoom - 1.2) < 1e-9, `a wheel turned over the chart left it at zoom ${c.zoom}`);
    game.wheel(at[0], at[1], -100); game.wheel(at[0], at[1], -100); game.render();
    check(Math.abs(under()[0] - before[0]) < 1e-6 && Math.abs(under()[1] - before[1]) < 1e-6 && c.x < C, `zoomed to ${c.zoom.toFixed(2)} about a point west of the middle, that point lies over ${under().map(v => (v - C).toFixed(1))}, where it lay over ${before.map(v => (v - C).toFixed(1))}`);
    check(game.wheel(2, 2, -100) === false, 'a wheel turned off the chart zoomed it');
    // A finger drags it: ten pixels right is ten pixels' worth of ground to the left; the panel stays open.
    const x0 = c.x, per = base / c.zoom;
    game.pointerDown(1, mid[0], mid[1]); game.pointerMove(1, mid[0] + 10, mid[1]); game.render();
    check(game.lab && Math.abs(c.x - (x0 - 10 * per)) < 1e-6 && game.input.id === null, `dragged ten pixels right the chart's middle moved ${(c.x - x0).toFixed(2)} cells, where ten pixels are ${(10 * per).toFixed(2)}`);
    // A second finger pinches: twice as far apart is twice as close.
    const z0 = c.zoom;
    game.pointerDown(2, mid[0] - 10, mid[1]); game.pointerMove(2, mid[0] - 30, mid[1]); game.render();
    check(Math.abs(c.zoom / z0 - 2) < 1e-6, `two fingers drawn from 20 to 40 pixels apart took the zoom from ${z0.toFixed(2)} to ${c.zoom.toFixed(2)}`);
    game.pointerUp(1); game.pointerUp(2);
    check(game.chartTouch.size === 0 && game.lab, 'fingers lifted, the chart is still held or the panel shut');
    // Dragged far, it stops at the edge of the whole reach's view; zoomed out as far as it goes, it is whole again.
    game.pointerDown(1, mid[0], mid[1]); game.pointerMove(1, mid[0] + 5000, mid[1] + 5000); game.pointerUp(1); game.render();
    const room = size * base / 2 * (1 - 1 / c.zoom);
    check(Math.abs(c.x - (C + 0.5 - room)) < 1e-6 && Math.abs(c.y - (C + 0.5 - room)) < 1e-6, `dragged far, the chart's middle is ${(C + 0.5 - c.x).toFixed(1)} cells from the core's, where its view allows ${room.toFixed(1)}`);
    const steps = game.buttons.filter(b => b.w === 16 && b.h === 16).sort((a, b) => a.y - b.y);
    check(steps.length === 2, `the chart has ${steps.length} buttons to step its zoom`);
    for (let n = 0; n < 20; n++) steps[1]?.act();
    game.render();
    check(c.zoom === 1 && c.x === C + 0.5 && c.y === C + 0.5, `stepped out as far as it goes the chart is at zoom ${c.zoom} about ${c.x - C},${c.y - C}`);
    for (let n = 0; n < 40; n++) steps[0]?.act();
    game.render();
    check(Math.abs(base / c.zoom - 0.25) < 1e-6, `stepped in as far as it goes a cell is ${(c.zoom / base).toFixed(2)} pixels`);
    // A tap beside the chart, in the panel's header, is not a drag; and a tap outside the panel still shuts it.
    game.openLab(false); game.openLab(true); game.render();
  }
  game.openLab(false);
  // A tap on the map opens the chart even just after an analysis, when the bar would open the lab's notes.
  game.labFlash = 3; game.labTab = 'stats'; game.render();
  game.pointerDown(1, x + mw / 2, y + mh / 2); game.pointerUp(1); game.render();
  check(game.lab && game.labTab === 'chart', `a tap on the map just after an analysis left the panel at '${game.labTab}'`);
  game.openLab(false); game.labFlash = 0;
  // And away from the core: the chart is read wherever the drill is.
  game.drill.x = C + 60.5; game.drill.y = C + 0.5; game.render();
  check(game.charted && !game.atCore, 'sixty cells out the chart cannot be read');
  game.pointerDown(1, x + mw / 2, y + mh / 2); game.pointerUp(1); game.render();
  check(game.lab && game.labTab === 'chart', `a tap on the map sixty cells out left the panel ${game.lab ? 'open' : 'shut'} at '${game.labTab}'`);
  game.openLab(false);
}

// ---- the first tab's levels ask for things found, and a piece past the winch's load pays little more for its size
{
  const game = await makeGame(7), reach = UPGRADES[0], winch = UPGRADES.find(u => u.id === 'winch');
  game.S.grit = 1e12; game.S.gems = game.S.gems.map(() => 1e6);
  // Reach is bought with grit alone, no gems of any direction and nothing that must be found in one place; but from
  // its third level it asks that the drill has been three fifths of the way out its tether already goes.
  game.S.gems = game.S.gems.map(() => 0);
  for (let l = 0; l < 9; l++) game.buy(reach);
  check(game.S.lv.tether === 2 && game.val('tether') === 100 && game.shopNote?.text === 'NEEDS 0/60 CELLS OUT' && reach.gems.every(g => g === 0), `with grit and a drill that has been nowhere the reach is ${game.val('tether')}: '${game.shopNote?.text}'`);
  game.S.out = 60.5; game.buy(reach); game.buy(reach);
  check(game.val('tether') === 160 && game.lacks(reach) === 'NEEDS 60/96 CELLS OUT', `having been 60 cells out the reach is ${game.val('tether')}, and the next step says '${game.lacks(reach)}'`);
  game.S.out = 5000;
  for (let l = 0; l < 9; l++) game.buy(reach);
  check(game.S.lv.tether === 9 && game.val('tether') === 2300, `having been everywhere, with grit alone the reach is ${game.val('tether')}`);
  // How far out the drill has been is its furthest, kept as it flies; a new world begins at none.
  {
    const flown = await makeGame(7, { drill: 4 });
    flown.input.auto = [1, 0, 1]; for (let f = 0; f < 180; f++) flown.update(1 / 60); flown.input.auto = [-1, 0, 1]; for (let f = 0; f < 60; f++) flown.update(1 / 60); flown.input.auto = null;
    const most = flown.S.out;
    check(most > 4 && most >= flown.far && Math.abs(most - flown.far) > 0.5, `flown east and part of the way back, the drill is ${flown.far.toFixed(1)} cells out and has been ${most.toFixed(1)}`);
    flown.fresh(9);
    check(flown.S.out === 0, `a new world begins having been ${flown.S.out} cells out`);
  }
  game.S.gems = game.S.gems.map(() => 1e6);
  // The scan's levels ask for wreck parts: none for the first, one for the second.
  const scan = UPGRADES.find(u => u.id === 'scanner');
  game.buy(scan); game.buy(scan);
  check(game.S.lv.scanner === 1 && game.shopNote?.text === 'NEEDS 0/1 WRECK PARTS', `the scan's second level with no wreck part ${game.S.lv.scanner > 1 ? 'was bought' : 'was refused'}: '${game.shopNote?.text}'`);
  game.S.wrecks[0] = 1; game.buy(scan);
  check(game.S.lv.scanner === 2 && game.lacks(scan) === 'NEEDS 1/2 WRECK PARTS', `with the first wreck's part the scan is at level ${game.S.lv.scanner}, and the next says '${game.lacks(scan)}'`);
  // The winch, the bit, the ram and the hull ask how far out the drill has been.
  game.S.out = 29; game.buy(winch); game.buy(winch);
  check(game.S.lv.winch === 1 && game.lacks(winch) === 'NEEDS 29/30 CELLS OUT', `having been 29 cells out the winch is at level ${game.S.lv.winch}: '${game.lacks(winch)}'`);
  game.S.out = 30; game.buy(winch);
  check(game.S.lv.winch === 2, `having been 30 cells out the winch is at level ${game.S.lv.winch}`);
  check(UPGRADES.filter(u => u.needs?.[0] === 'out').map(u => u.id).join() === 'tether,drill,winch,momentum,hull', `the rows that ask how far out the drill has been: ${UPGRADES.filter(u => u.needs?.[0] === 'out').map(u => u.id)}`);
  game.shop = true; game.shopRise = 1; game.shopTab = 'rig'; game.render(); game.shop = false;
  const { overload } = await import('../../js/game.js');
  const total = n => n * overload(n, 0);
  check(overload(150, 0) === 1 && total(60000) < total(150) * 8 && total(60000) > total(6000) && total(6000) > total(600), `a piece of 60,000 cells on the first winch pays as ${Math.round(total(60000))} cells at full pay, one of 600 as ${Math.round(total(600))}`);
}

// ---- the fourth tab: what the station is built up with late, at many times the other tabs' prices
{
  const of = id => CORE.find(u => u.id === id), dearest = Math.max(...[...UPGRADES, ...WORKS, ...MAPS].flatMap(u => u.grit));
  check(CORE.map(u => u.id).join() === 'refinery,cutter,lamp,blackbox,livecatch,trophy', `the fourth tab's rows are ${CORE.map(u => u.id)}`);
  check(CORE.every(u => u.grit.every((g, l) => l === 0 || g > u.grit[l - 1]) && u.gems.every((g, l) => l === 0 || g > u.gems[l - 1]) && u.needs[1].length === u.grit.length), 'a row of the fourth tab does not cost more at each level, in grit and in gems, or asks nothing found');
  // (Of the levels a game comes to first: those of the late game are dear in every tab, further down.)
  const early = Math.max(...[...UPGRADES, ...WORKS, ...MAPS].flatMap(u => u.grit.filter(g => g < 1e7)));
  check(of('refinery').grit[4] > early * 4 && of('cutter').grit[3] > early * 4 && of('refinery').gems[4] >= 25000, `the dearest early level of the other tabs is ${early}; the refinery's fifth is ${of('refinery').grit[4]} and ${of('refinery').gems[4]} gems`);
  const game = await makeGame(7, {}, { hull: true }), w = game.world;
  // A block of rich ore in the north's own ground, 200 cells out: what a haul of it pays, plain, refined and cut.
  const cells = []; for (let y = 0; y < 5; y++) for (let x = 0; x < 6; x++) { const i = (C - 200 + y) * N + C + x; w.setK(i, K.ORE_B); cells.push(i); }
  const plain = game.payOf(cells), frost = plain.gems[B.FROST];
  check(plain.grit > 0 && frost > 0, `a block of the north's rich ore pays ${plain.grit} grit and ${frost} gems`);
  game.S.lv.refinery = 3; game.S.lv.cutter = 2;
  const built = game.payOf(cells);
  check(Math.abs(built.grit - plain.grit * 1.5) <= 1 && Math.abs(built.gems[B.FROST] - frost * 1.4) <= 1, `with the refinery at x1.5 and the cutter at x1.4 it pays ${built.grit} grit and ${built.gems[B.FROST]} gems`);
  game.S.lv.refinery = 0; game.S.lv.cutter = 0;
  // Bought with what is asked, refused without what must be found.
  game.S.grit = 1e12; game.S.gems = game.S.gems.map(() => 1e6);
  game.buy(of('lamp'));
  check(game.S.lv.lamp === 0 && game.shopNote?.text === 'NEEDS 0/1 WRECK PARTS', `the lamp with no wreck part ${game.S.lv.lamp ? 'was bought' : 'was refused'}: '${game.shopNote?.text}'`);
  game.S.wrecks[0] = 1; game.buy(of('lamp'));
  check(game.S.lv.lamp === 1 && game.val('lamp') === 10, `with a wreck part the lamp reaches ${game.val('lamp')} cells`);
  // The lamp: with it the light reaches a cell eleven off down an open tunnel, where without it that cell is dark.
  const lit = async level => {
    const g = await makeGame(7), gw = g.world; g.S.lv.lamp = level; g.resize(360, 640, 1);
    for (let x = 2; x <= 30; x++) { for (let y = -1; y <= 1; y++) gw.setK((C + y) * N + C + x, K.EMPTY); gw.see(C + x, C, 2); }
    g.drill.x = g.drill.px = C + 6.5; g.drill.home = false; g.band = [[g.drill.x, g.drill.y], [C + 0.5, C + 0.5]]; g.changed(); g.version++;
    for (let f = 0; f < 90; f++) { g.update(1 / 60); g.render(); }
    const L = g.lightMap; return L.lit[(C - L.y0) * L.cols + C + 6 + 11 - L.x0];
  };
  const dim = await lit(0), bright = await lit(3);
  check(dim < 0.05 && bright > 0.25, `eleven cells down the tunnel the light is ${dim.toFixed(2)} with the first lamp and ${bright.toFixed(2)} with the last`);
  // The black box: half of what the trip earned is kept when the drill is lost.
  const box = await makeGame(7, { drill: 4, blackbox: 2 }, { hull: true });
  box.S.grit = 1000; box.input.auto = [1, 0, 1]; for (let f = 0; f < 180; f++) box.update(1 / 60); box.input.auto = null;
  const earned = box.S.grit - 1000 + 400; box.S.grit += 400;
  box.dents = box.val('hull') - 1; box.shield = 0; box.hit(0.3);
  for (let f = 0; f < (DEATH + 0.2) * 60; f++) box.update(1 / 60);
  check(box.drill.mode === 'free' && Math.abs(box.S.grit - (1000 + Math.round(earned * 0.5))) <= 1 && /KEPT$/.test(box.notice?.sub ?? ''), `with the black box at a half, a trip that had earned ${earned} left grit at ${box.S.grit}; the screen says '${box.notice?.sub}'`);
  // The fourth tab draws, on the narrowest phone, and the stats name what is built.
  game.S.lv.refinery = 2; game.resize(320, 568, 1); game.shop = true; game.shopRise = 1; game.shopTab = 'core'; game.render(); game.shop = false;
  const said = Object.fromEntries(game.stats().map(([name, value]) => [name, value]));
  // (On the narrowest phone the refinery's own multiple is said without its GRIT, or it runs into the name.)
  check(said.REFINERY === 'x1.3, GEMS x1' && said.LAMP === '10 CELLS' && said['BLACK BOX'] === 'NONE', `the stats say ${said.REFINERY} / ${said.LAMP} / ${said['BLACK BOX']}`);
}

// ---- a frame that takes long is written down, with where the time went, and shown in the menu
{
  localStorage.removeItem('tetherbore-stalls');
  const game = await makeGame(7);
  game.frameTook(16, 2, 3);
  check(game.stalls.length === 0, 'a frame of sixteen milliseconds was written down as long');
  const t0 = performance.now() - 300; game.timed('save', t0);
  game.frameTook(1400, 320, 40);
  check(game.stalls.length === 1 && game.stalls[0].gap === 1400 && game.stalls[0].top === 'save' && game.stalls[0].ms >= 300 && Object.keys(game.probe).length === 0, `a frame of 1.4 s was written down as ${JSON.stringify(game.stalls)}`);
  for (let n = 0; n < 8; n++) game.frameTook(250 + n, 1, 1);
  check(game.stalls.length === 5 && JSON.parse(localStorage.getItem('tetherbore-stalls')).length === 5, `after nine long frames ${game.stalls.length} are kept`);
  const again = await makeGame(7);
  check(again.stalls.length === 5, `a game started afterwards knows of ${again.stalls.length} long frames`);
  again.resize(320, 568, 1); again.openLab(true, 'menu'); again.render(); again.openLab(false);
  localStorage.removeItem('tetherbore-stalls');
}

// ---- many hauls at once share one budget of rubble: a dozen pieces coming loose together are not a dozen full hauls
{
  const { RUBBLE } = await import('../../js/game.js');
  const game = await makeGame(7, { tether: 7 }), w = game.world;
  for (let x = C + 1; x < C + 60; x++) for (let y = -2; y <= 2; y++) w.setK((C + y) * N + x, K.EMPTY);
  game.changed();
  const piece = m => { const cells = []; for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) { const i = (C + 20 + m * 3 + y) * N + C + 62 + x; w.setK(i, K.SOFT); cells.push(i); } return cells; };
  const paid = [];
  for (let m = 0; m < 12; m++) { const before = game.S.grit; game.haul(piece(m)); paid.push(game.S.grit - before); }
  const planned = game.hauls.map(h => h.total);
  check(game.hauls.length === 12 && planned[0] === RUBBLE && planned.slice(1).every(n => n >= 12 && n <= 24) && planned.reduce((a, b) => a + b, 0) <= RUBBLE + 11 * 24, `twelve hauls of 1,600 cells at once are to be ${planned} bits of rubble`);
  check(paid.every(g => g > 0) && paid.slice(1).every(g => Math.abs(g - paid[1]) <= paid[1] * 0.5), `they paid ${paid}`);
  let most = 0, frames = 0;
  while (game.hauls.length && frames < 1800) { game.update(1 / 60); frames++; most = Math.max(most, game.hauls.reduce((sum, h) => sum + h.bits.filter(b => !b.st).length, 0)); }
  check(!game.hauls.length && most <= RUBBLE + 11 * 24 && game.pending.grit === 0, `all twelve came home in ${frames} frames, with ${most} bits on their way at the most and ${game.pending.grit} grit still to bank`);
}

// ---- the late game: levels past the first ladders, for the ground that lies beyond a thousand cells out
{
  const all = [...UPGRADES, ...WORKS, ...MAPS, ...CORE], by = id => all.find(u => u.id === id);
  // (How many levels each row had before the late game's were added.)
  const had = { drill: 4, winch: 5, scanner: 4, momentum: 4, hull: 4, mender: 3, maprange: 3, refinery: 5, cutter: 4, lamp: 3, blackbox: 3, lavaskin: 1, sporedrive: 1, arccoil: 1, livecatch: 2, trophy: 2 };
  const late = all.flatMap(u => u.grit.map((g, l) => ({ u, l, g })).filter(e => e.l >= (had[u.id] ?? 99)));
  // Each costs ten million grit or more, more than the level before it, and asks something that lies far out:
  // more cells out than any level before the late game asks (the winch's 700), the parts of the far wrecks,
  // relics, the deep flanks' kinds analysed, nearly every kind of creature met, or specimens by the score.
  const asks = ({ u, l }) => { const a = u.needs?.[1][l], [what, n] = Array.isArray(a) ? a : [u.needs?.[0], a]; return what === 'out' ? n > 700 : what === 'parts' ? n >= 6 : what === 'relics' ? n >= 1 : what === 'kinds' ? n >= 40 : what === 'beasts' ? n >= 12 : (u.spec?.[l] ?? 0) >= 60; };
  check(late.length === 29 && late.every(e => e.g >= 1e7 && e.g > e.u.grit[e.l - 1]) && late.every(asks), `the late game has ${late.length} levels; one that asks nothing far out: ${late.find(e => !asks(e))?.u.id}`);
  // They open one at a time: no two levels of any row ask the same distance of seven hundred cells or more, and none
  // asks what a level of reach asks.
  const outs = all.flatMap(u => u.needs ? u.needs[1].map(a => Array.isArray(a) ? a : [u.needs[0], a]).filter(([what, n]) => what === 'out' && n >= 700).map(([, n]) => [u.id, n]) : []);
  const reachAsks = all[0].needs[1].filter(n => n > 0), shared = outs.filter(([id, n], i) => outs.some(([, m], j) => j !== i && m === n) || (id !== 'tether' && reachAsks.includes(n)));
  check(outs.length >= 15 && !shared.length, `levels that ask the same distance as another: ${shared.map(([id, n]) => `${id} ${n}`).join(', ')}`);
  // The hull and the ram ask no more of how far out the drill has been than eight tenths of the reach each level is
  // priced beside (the reach after its step: its place beside the reach rounded up). (They asked 600 and 1,000 of
  // reaches of 620 and 950, and were bought in the same minute as the reach after.)
  const fit = ['hull', 'momentum'].flatMap(id => { const u = by(id); return u.beside.map((at, l) => [id, l, u.needs[1][l], REACH[Math.ceil(at)]]).filter(([, , n, R]) => n > 0.8 * R); });
  check(!fit.length, `levels that ask more than eight tenths of their reach: ${fit.map(([id, l, n, R]) => `${id} ${l + 1} asks ${n} of ${R}`).join(', ')}`);
  check(all.every(u => u.values.length === u.grit.length + 1 && u.gems.length === u.grit.length && (!u.needs || u.needs[1].length === u.grit.length) && (!u.spec || u.spec.length === u.grit.length)), `a row's prices and its levels are not of a length: ${all.find(u => u.values.length !== u.grit.length + 1)?.id}`);
  // Eight of them, two to a corner, are paid in a corner's gems (G: 5 north east, 6 south east, 7 south west, 8
  // north west), at these figures; every other level in its row's own, and no row has a gem for each level but
  // those eight's.
  const corner = all.flatMap(u => (u.gemAt ?? []).map((g, l) => g >= 5 ? `${u.id} ${u.values[l + 1]} ${u.gems[l]} ${g}` : null).filter(Boolean)).join(', ');
  check(corner === 'drill 8 75000 5, winch 5 50000 8, scanner 13 40000 5, momentum 2.8 30000 6, hull 12 50000 6, maprange 10 25000 8, lamp 18 60000 7, blackbox 0.9 35000 7', `the levels paid in a corner's gems: ${corner}`);
  check(all.every(u => !u.gemAt || (u.gemAt.length === u.gems.length && u.gemAt.every(g => g === u.gem || g >= 5))), `a row's levels are paid in another direction's gems: ${all.filter(u => u.gemAt).map(u => `${u.id} ${u.gemAt}`).join('; ')}`);
  const whole = all.reduce((sum, u) => sum + u.grit.reduce((a, b) => a + b, 0), 0), first = whole - late.reduce((sum, e) => sum + e.g, 0);
  check(whole > 2e9 && whole > first * 20, `the whole shop costs ${whole} grit, the levels before the late game ${first}`);
  check(by('tether').values.at(-1) === 2300, `the reach goes to ${by('tether').values.at(-1)}`);
  // A game that has everything of the first ladders, has been 800 cells out, and has grit and gems beyond counting:
  // nothing of the late game can be bought, and each row says what it wants. Having been everywhere, with every
  // part and two relics home, every level can.
  const game = await makeGame(7);
  game.S.grit = 1e12; game.S.gems = game.S.gems.map(() => 1e9); game.S.spec = game.S.spec.map(() => 1e6); game.S.out = 800;
  game.S.wrecks = [1, 1, 1, 1, 1, 0, 0, 0]; game.S.lab = Object.fromEntries((await import('../../js/game.js')).LAB.map(e => [e.key, 1]));
  for (let n = 0; n < 30; n++) game.S.met[`place-${n}`] = 1;
  for (let pass = 0; pass < 12; pass++) for (const u of all) game.buy(u);
  const stuck = all.filter(u => game.cost(u)).map(u => `${u.id} ${game.lacks(u)}`);
  // (The ram's first level of the late game asks 760 cells out: it is the first of them a game comes to.)
  check(game.val('drill') === 5 && game.val('winch') === 3 && game.val('momentum') === 2.5 && game.val('hull') === 9 && game.val('scanner') === 9 && game.val('refinery') === 2 && game.val('lamp') === 14 && game.val('maprange') === 5,
    `800 cells out with five parts and no relic, the rig is at bit ${game.val('drill')}, winch ${game.val('winch')}, ram ${game.val('momentum')}, hull ${game.val('hull')}, scan ${game.val('scanner')}, refinery ${game.val('refinery')}, lamp ${game.val('lamp')}, range ${game.val('maprange')}`);
  check(stuck.includes('drill NEEDS 800/950 CELLS OUT') && stuck.includes('scanner NEEDS 5/6 WRECK PARTS') && stuck.includes('refinery NEEDS 0/1 RELICS HOME') && stuck.includes('maprange NEEDS 800/1000 CELLS OUT') && stuck.includes('trophy NEEDS 0/6 BEASTS MET'), `what the rows of the late game ask: ${stuck.join('; ')}`);
  game.shop = true; game.shopRise = 1; game.resize(320, 568, 1);
  for (const tab of ['rig', 'works', 'map', 'core']) { game.shopTab = tab; game.render(); }
  // (Every kind of creature met as well: the trophy line's last level asks for twelve of the fourteen.)
  game.S.out = 2000; game.S.wrecks = game.S.wrecks.map(() => 1); game.S.relics = [1, 1, 0, 0];
  game.S.fauna = { pal: null, met: Object.fromEntries(CREATURES.slice(1).map(c => [c.key, 1])), spent: [] };
  for (let pass = 0; pass < 12; pass++) for (const u of all) game.buy(u);
  check(all.every(u => !game.cost(u)) && game.val('drill') === 8 && game.val('winch') === 5 && game.val('momentum') === 2.8 && game.val('hull') === 12 && game.val('mender') === 3.5 && game.val('refinery') === 3 && game.val('blackbox') === 0.9 && game.val('trophy') === 4,
    `having been everywhere, still to buy: ${all.filter(u => game.cost(u)).map(u => `${u.id} ${game.lacks(u) ?? ''}`).join('; ')}`);
  // And the drill of the late game plays: it cuts, flies and is drawn, with the pictures of the last levels that have them.
  game.shop = false;
  game.input.auto = [1, 0, 1];
  for (let f = 0; f < 240; f++) { game.update(1 / 60); if (f % 10 === 0) game.render(); }
  game.input.auto = null;
  check(game.far > 8 && game.drill.mode !== 'dead', `the drill of the late game flew ${game.far.toFixed(0)} cells east in four seconds`);
  game.openLab(true, 'stats'); game.render(); game.openLab(false);
}

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : 'no defect: the second tab sells six things for specimens, four of which turn a hazard; the stats say what the drill is; the late game opens a level at a time');
process.exit(fails.length ? 1 : 0);
