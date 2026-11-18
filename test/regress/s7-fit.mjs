// What the upgrades show (js/fit.js) is only shown, it is bounded, every level of every row is a step that can be
// seen, and buying is an event.
//   - The same game with the show and without: two games side by side on one world and one stream of Math.random,
//     every row at or near its last level, the tether's canvas there so that the drill and the tether are drawn
//     on it, one with the fitter stood in for by one that does nothing and the other drawn every frame; three
//     flights of ten seconds (cutting and flying at full speed, a spore's drive through lava with the lava skin and
//     an arc taken in, and a wreck), with purchases at the core through the shop between them: frame by frame the
//     drill, its heading, the tether, the hull, the grit and the levels, the game's own particles, rings, effects,
//     popups, flash, shake and pause, and the draws from Math.random are the same.
//   - Bounded, every frame of those flights: the fitter's pool of particles never over CAP and the shop's never
//     over PANEL_CAP, its rings never over RINGS and its queue never over QUEUE, and its typed arrays the same ones
//     throughout.
//   - Every level a step: for every row of RIG, WORKS (every fitting at each level, plain and with everything lit,
//     and each off, on and lit) and CORE, and every level of reach, what is drawn at a level is not what is drawn
//     at the level before, pixel for pixel (the drill's parts as drawDrill draws them, the station's as the fitter
//     draws them, the live catch's clamp and the trophy line's rack among them, the core's and the dish's frames,
//     the tether's style); and the whole game drawn at every level of every row, the shop open at each tab too,
//     draws nothing that is not in the atlas (a frame that is not there throws).
//   - The moment: at the core with the shop open, a purchase queues one fitting and nothing is fitted while the
//     shop stays open; the frame after it is shut the fitting begins, and it is over within its time; a row's last
//     level, a WORKS fitting, a CORE level and the first purchase of a game are made a show of, and a middle level
//     of the bit is not; a MAP row sweeps the map when it is fitted; seven purchases queue six. One sound for a
//     visit to the shop: a clink for plain fittings, the bell's run for a show, never a relic's, and nothing from
//     the fitter in flight.
//   - js/fit.js does not name Math.random, and stepping and drawing the fitter alone draws nothing from it.
//   node test/regress/s7-fit.mjs
import { readFile } from 'node:fs/promises';
import { Game, UPGRADES, WORKS, MAPS, CORE, farStart, setDown, random, world, C, N, K } from '../harness.mjs';
const { UI } = await import('../../js/drawing.js');

const { Fitter, CAP, PANEL_CAP, RINGS, QUEUE, TETHERS, CORE_A, DISH, REFINERY, CUTTER, BOX } = await import(new URL('../../js/fit.js', import.meta.url));
const { sheets } = await import(new URL('../../js/atlas.js', import.meta.url));
const { sfx } = await import(new URL('../../js/audio.js', import.meta.url));
const { decodePNG } = await import(new URL('../../tools/png.mjs', import.meta.url));
const { TABS } = await import(new URL('../../js/shop.js', import.meta.url));
const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const ROWS = [...UPGRADES, ...WORKS, ...MAPS, ...CORE];
const row = id => ROWS.find(u => u.id === id);

// A game as the harness makes one, with the tether's own canvas laid over it, so that the drill and the tether are
// drawn there as on a page (`drawRopes`), and the hull as it is played. Its creatures are left out (js/fauna.js), as
// the harness leaves them out: what is tried here is the fitter alone, and a wren's find called out or a creature
// met would only be the same in both games.
async function make(seed = 7, levels = {}) {
  const game = new Game(document.createElement('canvas'), document.createElement('canvas'));
  game.fresh(seed, true);
  game.resize(360, 640, 1);
  Object.assign(game.S.lv, levels);
  game.fauna.off = true;
  return game;
}
// A purchase as the shop makes one, with nothing asked for it.
const buy = (game, u) => {
  const can = game.canBuy, cost = game.cost;
  game.canBuy = v => v === u || can.call(game, v); game.cost = v => v === u ? { grit: 0, gems: 0, gem: u.gem, spec: 0 } : cost.call(game, v);
  game.buy(u);
  game.canBuy = can; game.cost = cost;
};

// ---------------------------------------------------------------- the same game with the show and without
let draws = 0, stream = null;
const plain = Math.random;
Math.random = () => { draws++; return stream(); };
const most = Object.fromEntries(ROWS.map(u => [u.id, u.values.length - 1]));
// (A few rows a level short of their last, to be bought between the flights.)
const short = { ...most, drill: most.drill - 1, momentum: most.momentum - 1, mender: most.mender - 1, refinery: most.refinery - 1, maprange: most.maprange - 1, tether: 6 };
const games = [];
for (let g = 0; g < 2; g++) { stream = random(77); const game = await make(7, short); game.own = random(4321); games.push(game); }
const [shown, bare] = games;
// (The stand-in: a fitter that does nothing at all, and a drill that shows nothing beyond its levels.)
const nothing = new Fitter();
for (const name of ['reset', 'bought', 'fire', 'step', 'station', 'glow', 'hud', 'map', 'panel', 'barbs']) nothing[name] = () => {};
nothing.stamps = () => false;
bare.fitter = nothing;
const arrays = ['x', 'y', 'vx', 'vy', 't', 'life', 'fall', 'col', 'kind'].map(k => shown.fitter.pool[k]);
const worst = { pool: 0, panel: 0, rings: 0, queue: 0 };
let frame = 0, differ = null, sameArrays = true;
const both = (fn) => { for (const game of games) { stream = game.own; fn(game); } };
const step = (auto, render = true) => {
  const seen = [];
  for (const game of games) {
    stream = game.own; draws = 0;
    game.input.auto = auto;
    game.update(1 / 60);
    if (render) game.render();
    const d = game.drill;
    seen.push([d.x, d.y, d.ang, d.mode, game.band.length, game.dents, game.S.grit, JSON.stringify(game.S.lv), game.parts.length, game.rings.length, game.effects.length,
      game.popups.length, game.flash, game.shake, game.hitstop ?? 0, !!game.banner, !!game.notice, game.coreFlash, game.version, draws].join());
  }
  if (!differ && seen[0] !== seen[1]) differ = `${frame}: ${seen[0]}\n        without the show: ${seen[1]}`;
  const f = shown.fitter;
  worst.pool = Math.max(worst.pool, f.pool.n); worst.panel = Math.max(worst.panel, f.panelPool.n);
  worst.rings = Math.max(worst.rings, f.rings.filter(r => r.on).length, f.rings.length); worst.queue = Math.max(worst.queue, f.queue.filter(q => q.on).length, f.queue.length);
  if (['x', 'y', 'vx', 'vy', 't', 'life', 'fall', 'col', 'kind'].some((k, n) => f.pool[k] !== arrays[n])) sameArrays = false;
  frame++;
};
// Purchases at the core through the shop: home, the shop open, rows bought, the shop shut and a second for the
// fittings.
const shopAt = (ids) => {
  both(game => { setDown(game, 0, 0); game.shop = true; game.shopRise = 1; });
  for (let n = 0; n < 20; n++) step(null);
  both(game => { for (const id of ids) buy(game, row(id)); });
  for (let n = 0; n < 20; n++) step(null);
  both(game => { game.shop = false; });
  for (let n = 0; n < 150; n++) step(null);
};
// The first flight: out of a tunnel, cutting north, then flown about at full speed.
both(game => farStart(game, 0, -140));
for (let n = 0; n < 600; n++) step(n < 300 ? [0, -1, 1] : [Math.cos(n / 40), Math.sin(n / 40), 1]);
shopAt(['drill', 'maprange']);
// The second: a spore's drive, through lava, with the lava skin on; an arc taken in.
both(game => {
  farStart(game, 60, 0);
  const w = game.world;
  for (let x = 62; x <= 80; x++) for (let y = -1; y <= 1; y++) w.setK((C + y) * N + C + x, K.EMPTY);
  for (let y = -1; y <= 1; y++) { w.lava.set((C + y) * N + C + 70, 9); game.lavaVol.set((C + y) * N + C + 70, 1); }
  game.changed();
});
for (let n = 0; n < 600; n++) {
  if (n === 30) both(game => { game.boost = 3; });
  if (n === 200) both(game => { game.dents = 1; game.zap(Math.floor(game.drill.x) + 2, Math.floor(game.drill.y)); });
  step(n < 400 ? [1, 0, 1] : [-1, 0, 1]);
}
shopAt(['momentum', 'mender', 'refinery']);
// The third: the hull knocked to its last pip and wrecked.
both(game => farStart(game, -80, 0));
for (let n = 0; n < 600; n++) {
  if (n === 120) both(game => { game.dents = game.val('hull') - 1; game.shield = 0; game.hit(0.3); });
  step([-1, 0, 1]);
}
Math.random = plain;
check(!differ, `the game with the show went another way than the game without, at frame ${differ}`);
check(worst.pool <= CAP && worst.panel <= PANEL_CAP && worst.rings <= RINGS && worst.queue <= QUEUE, `the fitter held ${worst.pool} particles (of ${CAP}), ${worst.panel} in the shop (of ${PANEL_CAP}), ${worst.rings} rings and ${worst.queue} fittings queued`);
check(sameArrays, 'the fitter made its pool again');
check(worst.pool > 20, `in thirty seconds of flight with everything fitted the fitter never held more than ${worst.pool} particles: it hardly ran`);

// ---------------------------------------------------------------- every level a step
// The pixels a list of calls draws, as one string: each call's source pixels (read from the sheets as built) and
// where they went, at what alpha. Two lists that draw the same pixels in the same places give the same string.
const images = new Map(), pixels = new Map();
for (const [name, s] of Object.entries(sheets)) images.set(s.image, name);
const sheetPixels = async name => { if (!pixels.has(name)) pixels.set(name, decodePNG(await readFile(new URL(`../../assets/${sheets[name].image.src ?? `${name}.png`}`, import.meta.url)))); return pixels.get(name); };
for (const name of ['drill', 'core', 'dish', 'station']) pixels.set(name, decodePNG(await readFile(new URL(`../../assets/${name}.png`, import.meta.url))));
const recorder = () => {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (t, k) => k === 'drawImage' ? (image, sx, sy, sw, sh, dx, dy, dw, dh) => calls.push({ sheet: images.get(image) ?? 'tinted', sx, sy, sw, sh, dx, dy, alpha: t.globalAlpha ?? 1, op: t.globalCompositeOperation ?? 'source-over' })
      : k in t ? t[k] : () => {},
    set: (t, k, v) => { t[k] = v; return true; },
  });
  ctx.globalAlpha = 1;
  return { ctx, calls };
};
const picture = calls => calls.map(c => {
  const p = pixels.get(c.sheet);
  let s = `${c.sheet}@${c.dx},${c.dy}x${(+c.alpha).toFixed(2)}${c.op}:`;
  if (!p) return s + `${c.sx},${c.sy}`;
  for (let y = c.sy; y < c.sy + c.sh; y++) for (let x = c.sx; x < c.sx + c.sw; x++) { const o = (y * p.width + x) * 4; s += p.data[o + 3] ? `${p.data[o]},${p.data[o + 1]},${p.data[o + 2]},${p.data[o + 3]};` : '.'; }
  return s;
}).join('|');
const lab = await make(7);
const zero = () => { for (const u of ROWS) lab.S.lv[u.id] = 0; };
const drillAt = (id, level, lit = 0) => {
  zero(); lab.S.lv[id] = level;
  const { ctx, calls } = recorder(), look = { heat: 0, flame: 0, tint: '#ffffff', tintAlpha: 0, lit, spin: 0 }, lv = lab.S.lv;
  lab.drawDrill(0, 0, 0, lv.drill, lv.momentum, -1, 1, 1, ctx, lv.hull, null, look);
  return picture(calls);
};
const stationAt = (id, level) => {
  zero(); lab.S.lv[id] = level; lab.fitter.reset();
  const { ctx, calls } = recorder();
  lab.fitter.station(lab, ctx, 0, 0, 0);
  return picture(calls);
};
const frameOf = (sheet, name) => { const r = sheets[sheet].frames[name]; return picture([{ sheet, sx: r[0], sy: r[1], sw: r[2], sh: r[3], dx: 0, dy: 0, alpha: 1, op: '' }]); };
const steps = [];
const ladder = (id, n, at) => { for (let l = 1; l <= n; l++) if (at(l) === at(l - 1)) steps.push(`${id} ${l - 1} and ${l}`); };
for (const id of ['drill', 'momentum', 'hull']) ladder(id, row(id).values.length - 1, l => drillAt(id, l));
// (Everything lit: the bit of every fitting, the flywheel's spokes a step round among them.)
const ALL_LIT = 255;
for (const u of WORKS) {
  ladder(u.id, u.values.length - 1, l => drillAt(u.id, l));
  ladder(`${u.id} lit`, u.values.length - 1, l => drillAt(u.id, l, ALL_LIT));
  if (drillAt(u.id, 1) === drillAt(u.id, 0)) steps.push(`${u.id} fitted and not`);
  for (let l = 1; l < u.values.length; l++) if (drillAt(u.id, l, ALL_LIT) === drillAt(u.id, l, 0)) steps.push(`${u.id} ${l} lit and not`);
}
ladder('lamp', row('lamp').values.length - 1, l => drillAt('lamp', l));
for (const id of ['refinery', 'cutter', 'blackbox', 'livecatch', 'trophy']) ladder(id, row(id).values.length - 1, l => stationAt(id, l));
ladder('winch', row('winch').values.length - 1, l => frameOf('core', CORE_A[l]));
ladder('scanner', row('scanner').values.length - 1, l => frameOf('dish', DISH[l]));
ladder('tether', row('tether').values.length - 1, l => JSON.stringify(TETHERS[l]));
check(row('tether').values.length === TETHERS.length, `the tether has ${row('tether').values.length} levels and ${TETHERS.length} looks`);
check(!steps.length, `levels that draw just what the level before draws: ${steps.join('; ')}`);
// The whole game drawn at every level of every row, flying and in the shop at each tab.
{
  const game = await make(7, { tether: 9 });
  farStart(game, 0, -60);
  let thrown = null;
  for (const u of ROWS) for (let l = 0; l < u.values.length; l++) {
    game.S.lv[u.id] = l;
    try {
      game.input.auto = [0, -1, 1]; game.update(1 / 60); game.render();
      for (const t of TABS) { game.shop = true; game.shopTab = t.id; game.shopRise = 1; game.render(); }
      game.shop = false; game.shopRise = 0;
    } catch (error) { thrown ??= `${u.id} ${l}: ${error.message}`; }
  }
  check(!thrown, `drawing the game threw at ${thrown}`);
}

// ---------------------------------------------------------------- the moment
{
  const heard = {};
  for (const name of ['clink', 'gather', 'relic', 'buy', 'gem', 'tick', 'hiss', 'zap']) { const own = sfx[name]; heard[name] = 0; sfx[name] = (...a) => { heard[name]++; return own(...a); }; }
  const calm = () => { for (const k in heard) heard[k] = 0; };
  const game = await make(7, { drill: 2, tether: 2 });
  game.S.stats.buys = 5;
  const f = game.fitter, playing = () => f.playing.filter(p => p.on);
  game.shop = true; game.shopRise = 1;
  buy(game, row('drill'));
  check(f.queued === 1 && game.S.lv.drill === 3, `a purchase with the shop open queued ${f.queued} fittings`);
  for (let n = 0; n < 60; n++) { game.update(1 / 60); game.render(); }
  check(f.queued === 1 && playing().length === 0, `with the shop open a second, ${playing().length} fittings played`);
  calm();
  game.shop = false; game.update(1 / 60); game.render();
  const first = playing()[0];
  check(first && first.u.id === 'drill' && !first.grand, `the frame after the shop was shut: ${first ? `${first.u.id}, ${first.grand ? 'a show' : 'plain'}` : 'nothing fitted'}`);
  let over = -1;
  for (let n = 1; n < 120 && over < 0; n++) { game.update(1 / 60); game.render(); if (!playing().length) over = n; }
  check(over > 0 && over <= 0.9 * 60 + 1, `the fitting was over ${over} frames after it began`);
  check(heard.clink === 1 && heard.gather === 0 && heard.relic === 0, `a plain fitting sounded ${JSON.stringify(heard)}`);
  // A milestone each: a row's last level, a WORKS fitting, a CORE level, the first purchase of a game.
  const shows = [];
  const grand = async (id, level, buys = 5) => {
    const g = await make(7, { [id]: level }); g.S.stats.buys = buys;
    g.shop = true; buy(g, row(id)); g.shop = false;
    g.update(1 / 60);
    return g.fitter.playing.find(p => p.on)?.grand;
  };
  if (!await grand('drill', row('drill').values.length - 2)) shows.push('the bit\'s last level');
  if (!await grand('lavaskin', 0)) shows.push('the lava skin');
  if (!await grand('refinery', 2)) shows.push('a level of the refinery');
  if (!await grand('hull', 1, 0)) shows.push('a game\'s first purchase');
  if (await grand('drill', 2)) shows.push('(a middle level of the bit was made a show of)');
  check(!shows.length, `not made a show of: ${shows.join(', ')}`);
  {
    const g = await make(7, { drill: 6 }); g.S.stats.buys = 5;
    calm(); g.shop = true; buy(g, row('drill')); g.shop = false;
    for (let n = 0; n < 60; n++) { g.update(1 / 60); g.render(); }
    check(heard.gather === 1 && heard.relic === 0 && heard.clink === 0, `a fitting made a show of sounded ${JSON.stringify(heard)}`);
  }
  {
    const g = await make(7); g.S.stats.buys = 5;
    g.shop = true; buy(g, row('maprange')); g.shop = false;
    let swept = false;
    for (let n = 0; n < 60; n++) { g.update(1 / 60); g.render(); if (g.fitter.sweep > 0) swept = true; }
    check(swept, 'a row of the MAP tab bought did not sweep the map');
  }
  {
    const g = await make(7); g.S.stats.buys = 5;
    g.shop = true;
    for (const id of ['tether', 'drill', 'winch', 'scanner', 'momentum', 'hull', 'maplens']) buy(g, row(id));
    check(g.fitter.queued === QUEUE, `seven purchases queued ${g.fitter.queued} fittings`);
  }
  // Nothing from the fitter in flight: what it sounds, it sounds only at a fitting.
  {
    const g = await make(7, most);
    farStart(g, 0, -100);
    let inside = 0, during = 0;
    const own = g.fitter.step.bind(g.fitter);
    g.fitter.step = (...a) => { const before = Object.values(heard).reduce((s, n) => s + n, 0); own(...a); inside += Object.values(heard).reduce((s, n) => s + n, 0) - before; };
    for (let n = 0; n < 600; n++) { g.input.auto = [Math.cos(n / 50), Math.sin(n / 50), 1]; g.update(1 / 60); if (n === 100) g.boost = 3; }
    check(inside === 0, `the fitter sounded ${inside} times in a flight`);
  }
}

// ---------------------------------------------------------------- its own generator
{
  const source = await readFile(new URL('../../js/fit.js', import.meta.url), 'utf8');
  check(!source.includes('Math.random'), 'js/fit.js names Math.random');
  const game = await make(7, most);
  farStart(game, 0, -80);
  game.drill.dig = (C - 81) * N + C; game.drill.digT = 0.5; game.drill.digDur = 1; game.drill.vx = 9;
  game.boost = 2; game.dents = 1; game.shield = 2;
  const f = game.fitter;
  let n = 0;
  const own = Math.random;
  Math.random = () => { n++; return 0.5; };
  f.fire('arccoil'); f.fire('mender'); f.fire('lavaskin'); f.fire('sporedrive'); f.fire('livecatch'); f.fire('trophy');
  game.charge = 8; game.spin.n = 5; game.spin.t = game.time;
  const rope = { loop: false, pts: [[0, 0], [8, 8]], runs: [[0, 1, 0]], wide: 2 };  // (traced by js/drawing.js's `traceRope`)
  // (The rows as js/drawing.js's `drawShop` lays them out for the panel, 32 tall under its header.)
  const rows = Array.from({ length: 6 }, (_, n) => ({ y: 40 + 32 * n, top: 42 + 32 * n, vx: 12, vy: 48 + 32 * n, sx: 60 }));
  game.shop = true; f.bought(game, row('hull'), 7); f.bought(game, row('cutter'), 6); game.shop = false;
  for (let k = 0; k < 300; k++) {
    f.step(game, 1 / 60);
    f.station(game, game.ctx, 100, 100, k * 16); f.glow(game, game.ctx, 0, 0, k * 16); f.hud(game, game.ctx, 60, UI); f.map(game, game.ctx, 0, 0, 46, 46);
    f.panel(game, game.ctx, 4, 20, 172, 226, TABS[0], rows, 168, UI); f.barbs(game, game.ctx, rope);
  }
  Math.random = own;
  check(n === 0, `stepping and drawing the fitter alone drew ${n} times from Math.random`);
}

if (fails.length) { console.log(`DEFECT:\n  ${fails.join('\n  ')}`); process.exit(1); }
console.log(`no defect: the game went the same way with the show and without; the fitter held at most ${worst.pool} particles; every level of every row draws a step; buying is a moment in the shop and a fitting at the core`);
