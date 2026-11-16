// The shop's second tab. Four things are fitted for grit and the specimens of one direction each: without the
// specimens the tap is refused and says where they are found; with them the specimens are spent. Each changes
// what a hazard does to the drill: LAVA SKIN lets it through lava, SPORE DRIVE turns a pod's burst into speed,
// ARC COIL turns an arc into a pip mended, MENDER mends the hull faster than it mends itself. A game saved before them loads
// with none. The panel the top bar opens says what the drill is now, from the game's own figures.
import { makeGame, UPGRADES, WORKS, MAPS, K, B, N, C } from '../harness.mjs';

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const fly = (game, x, y, seconds) => { game.input.auto = [x, y, 1]; for (let f = 0; f < seconds * 60; f++) game.update(1 / 60); game.input.auto = null; };
const rest = (game, seconds) => { for (let f = 0; f < seconds * 60; f++) game.update(1 / 60); };
const row = id => WORKS.find(u => u.id === id);
const fitted = async (id, level = 1) => { const game = await makeGame(7, { drill: 4 }, { hull: true }); game.S.lv[id] = level; return game; };

check(WORKS.map(u => u.id).join() === 'mender,lavaskin,sporedrive,arccoil' && WORKS.map(u => u.kin).join() === [B.FROST, B.EMBER, B.MIRE, B.LODE].join(), `the second tab's rows are ${WORKS.map(u => `${u.id} (${u.kin})`)}`);
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
  check(game.S.lv.lavaskin === 1 && Math.abs(game.S.spec[B.EMBER] - 0.6) < 1e-9 && game.S.grit === grit - u.grit[0] && game.S.spec[B.FROST] === 40 && game.cost(u) === null && game.specNeed(B.EMBER) === 0, `bought: level ${game.S.lv.lavaskin}, the south's specimens ${game.S.spec[B.EMBER]}, grit down ${grit - game.S.grit}`);
  const m = row('mender');
  for (let l = 0; l < 3; l++) game.buy(m);
  check(game.S.lv.mender === 2 && game.val('mender') === 9 && Math.abs(game.S.spec[B.FROST] - 16) < 1e-9, `the mender bought as far as 40 specimens go: level ${game.S.lv.mender}, one pip every ${game.val('mender')} s, ${game.S.spec[B.FROST]} specimens left`);
  // Both tabs draw, and a tap on a tab opens it.
  game.resize(320, 568, 1); game.shop = true; game.shopRise = 1; game.render();
  // (The tabs stand in the panel's header, left to right, each a button twenty high and under sixty wide.)
  const tabs = game.buttons.filter(b => b.h === 20 && b.y < game.H / 2 && b.w < 60 && b.w > 24 && b.x < game.W * 0.6).sort((a, b) => a.x - b.x);
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
  check(tabs.length === 3 && game.shopTab === 'works', `a tap on the second tab left the shop at '${game.shopTab}'`);
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
  check(said.REACH[0] === '72 CELLS' && said.HULL[0] === '6/7 PIPS' && said.MENDS[0] === '1 PIP / 20 S' && said.LAVA[0] === 'SWIMS IN IT' && said.LAVA[1] === true && said.SPORES[0] === 'KNOCK' && said.SPORES[1] === false && said.ANALYSED[0] === '1/12, UP TO +3%', `the stats say ${JSON.stringify(said)}`);
  game.resize(320, 568, 1); game.labTab = 'stats'; game.openLab(true); game.render();
  // (The panel's tabs stand in its header, left to right: STATS, LAB, MENU; and MAP before MENU once the chart is bought.)
  const heads = game.buttons.filter(b => b.h === 20 && b.w < 60 && b.w > 24 && b.y < game.H / 2).sort((a, b) => a.x - b.x);
  heads[1]?.act(); game.render();
  check(heads.length === 3 && game.labTab === 'lab', `a tap on the second of ${heads.length} tabs left the panel at '${game.labTab}'`);
  // The menu: the sound, and a new world on the second tap.
  heads[2].act(); game.render();
  const rows = game.buttons.filter(b => b.h === 20 && b.w > 100).sort((a, b) => a.y - b.y), seed = game.S.seed;
  check(game.labTab === 'menu' && rows.length === 2, `the menu has ${rows.length} rows`);
  rows[1].act(); game.render();
  check(game.S.seed === seed && game.confirmReset > 0, 'one tap on NEW WORLD made a new world');
  rows[1].act(); game.render();
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
  game.render();
  // The chart: a third tab of the top bar's panel, at the core, once bought; a tap on the map there opens it.
  game.labTab = 'chart'; game.openLab(true); game.render();
  check(!game.charted && game.labTab === 'stats', `before the chart is bought the panel can be left at '${game.labTab}'`);
  game.openLab(false); game.S.lv.chart = 1; game.render();
  const [x, y, mw, mh] = game.mapRect;
  game.pointerDown(1, x + mw / 2, y + mh / 2); game.pointerUp(1); game.render();
  check(game.lab && game.labTab === 'chart' && game.chartMap?.mapFor?.endsWith(`:${C + 0.5},${C + 0.5}`), `a tap on the map at the core left the panel ${game.lab ? 'open' : 'shut'} at '${game.labTab}'`);
  game.openLab(false);
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
  // Reach is bought with grit alone: no gems of any direction, and nothing that must be found.
  game.S.gems = game.S.gems.map(() => 0);
  for (let l = 0; l < 9; l++) game.buy(reach);
  check(game.S.lv.tether === 9 && game.val('tether') === 2300 && reach.gems.every(g => g === 0) && !reach.needs, `with grit alone the reach is ${game.val('tether')}`);
  game.S.gems = game.S.gems.map(() => 1e6);
  // The scan's levels ask for wreck parts: none for the first, one for the second.
  const scan = UPGRADES.find(u => u.id === 'scanner');
  game.buy(scan); game.buy(scan);
  check(game.S.lv.scanner === 1 && game.shopNote?.text === 'NEEDS 0/1 WRECK PARTS', `the scan's second level with no wreck part ${game.S.lv.scanner > 1 ? 'was bought' : 'was refused'}: '${game.shopNote?.text}'`);
  game.S.wrecks[0] = 1; game.buy(scan);
  check(game.S.lv.scanner === 2 && game.lacks(scan) === 'NEEDS 1/2 WRECK PARTS', `with the first wreck's part the scan is at level ${game.S.lv.scanner}, and the next says '${game.lacks(scan)}'`);
  game.buy(winch); game.buy(winch);
  check(game.S.lv.winch === 1 && game.lacks(winch) === 'NEEDS 1/3 PLACES MET', `with only the home ground met the winch is at level ${game.S.lv.winch}: '${game.lacks(winch)}'`);
  game.S.met[1] = 1; game.S.met[2] = 1; game.buy(winch);
  check(game.S.lv.winch === 2, `with three places met the winch is at level ${game.S.lv.winch}`);
  game.shop = true; game.shopRise = 1; game.shopTab = 'rig'; game.render(); game.shop = false;
  const { overload } = await import('../../js/game.js');
  const total = n => n * overload(n, 0);
  check(overload(150, 0) === 1 && total(60000) < total(150) * 8 && total(60000) > total(6000) && total(6000) > total(600), `a piece of 60,000 cells on the first winch pays as ${Math.round(total(60000))} cells at full pay, one of 600 as ${Math.round(total(600))}`);
}

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : 'no defect: the second tab sells four things for specimens, each turns a hazard, and the stats say what the drill is');
process.exit(fails.length ? 1 : 0);
