// The shop's second tab. Four things are fitted for grit and the specimens of one direction each: without the
// specimens the tap is refused and says where they are found; with them the specimens are spent. Each changes
// what a hazard does to the drill: LAVA SKIN lets it through lava unknocked, SPORE DRIVE turns a pod's burst into
// speed, ARC COIL turns an arc into a pip mended, MENDER gives a pip back in time. A game saved before them loads
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
  check(game.S.lv.mender === 2 && game.val('mender') === 18 && Math.abs(game.S.spec[B.FROST] - 16) < 1e-9, `the mender bought as far as 40 specimens go: level ${game.S.lv.mender}, one pip every ${game.val('mender')} s, ${game.S.spec[B.FROST]} specimens left`);
  // Both tabs draw, and a tap on a tab opens it.
  game.resize(320, 568, 1); game.shop = true; game.shopRise = 1; game.render();
  // (The tabs stand in the panel's header, left to right, each a button twenty high and under sixty wide.)
  const tabs = game.buttons.filter(b => b.h === 20 && b.y > 43 && b.y < game.H / 2 && b.w < 60 && b.w > 24 && b.x < game.W * 0.6).sort((a, b) => a.x - b.x);
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

// ---- lava: shut to the drill and a knock; with the skin, neither
for (const skin of [0, 1]) {
  const game = await fitted('lavaskin', skin), w = game.world, d = game.drill;
  // A corridor east of the core, and lava across it.
  for (let x = 2; x <= 12; x++) for (let y = -1; y <= 1; y++) w.setK((C + y) * N + C + x, K.EMPTY);
  // (A cell of lava is kept with the seconds it has left to stand.)
  for (let y = -1; y <= 1; y++) { w.lava.set((C + y) * N + C + 7, 9); game.lavaVol.set((C + y) * N + C + 7, 1); }
  game.changed();
  fly(game, 1, 0, 2.5);
  const through = d.x > C + 8.5;
  check(skin ? through && game.hull === 3 && d.mode !== 'dead' : !through && game.hull < 3, `${skin ? 'with' : 'without'} the lava skin the drill flew east to ${(d.x - C).toFixed(1)} with ${game.hull} pips`);
}

// ---- a spore pod's burst: a knock; with the drive, speed
for (const drive of [0, 1]) {
  const game = await fitted('sporedrive', drive), d = game.drill;
  fly(game, 1, 0, 2);
  game.clouds.push({ x: Math.floor(d.x), y: Math.floor(d.y), t: 0, life: 1.5 });
  rest(game, 0.1);
  check(drive ? game.hull === 3 && game.boost > 2 && game.popups.some(p => p.label === 'BOOST') : game.hull === 2 && game.boost === 0, `${drive ? 'with' : 'without'} the spore drive a burst left ${game.hull} pips and a drive of ${game.boost.toFixed(1)} s`);
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
  check(coil ? game.hull === 3 && game.popups.some(p => p.label === 'CHARGED') : game.hull === 1, `${coil ? 'with' : 'without'} the arc coil an arc two cells off left ${game.hull} pips of a hull that had 2`);
}

// ---- the mender: a pip back in time, out in the ground
{
  const game = await fitted('mender', 1), none = await fitted('mender', 0);
  for (const g of [game, none]) { fly(g, 1, 0, 2); g.dents = 2; }
  rest(game, 29); rest(none, 29);
  check(game.hull === 1 && none.hull === 1, `a second short of the mender's time the hull has ${game.hull} pips`);
  rest(game, 2); rest(none, 2);
  check(game.hull === 2 && none.hull === 1, `after the mender's thirty seconds the hull has ${game.hull} pips, and ${none.hull} with no mender`);
  rest(game, 31);
  check(game.hull === 3, `after sixty the hull has ${game.hull} pips`);
}

// ---- what the drill is now
{
  const game = await fitted('lavaskin', 1);
  game.S.lv.tether = 3; game.S.lv.hull = 2; game.dents = 1; game.S.lab['lode-items:oreA'] = 4;
  const said = Object.fromEntries(game.stats().map(([name, value, lit]) => [name, [value, lit]]));
  check(said.REACH[0] === '72 CELLS' && said.HULL[0] === '4/5 PIPS' && said.LAVA[0] === 'SWIMS IN IT' && said.LAVA[1] === true && said.SPORES[0] === 'KNOCK' && said.SPORES[1] === false && said.ANALYSED[0] === '1/12, UP TO +3%', `the stats say ${JSON.stringify(said)}`);
  game.resize(320, 568, 1); game.labTab = 'stats'; game.openLab(true); game.render();
  const tab = game.buttons.find(b => b.h === 20 && b.x > 40 && b.w > 40 && b.w < 80);
  tab?.act(); game.render();
  check(game.labTab === 'lab', `a tap on ANALYSIS left the panel at '${game.labTab}'`);
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

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : 'no defect: the second tab sells four things for specimens, each turns a hazard, and the stats say what the drill is');
process.exit(fails.length ? 1 : 0);
