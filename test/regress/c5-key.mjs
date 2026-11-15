// The keystone in play (docs/CONTENT-PLAN.md, content item 5; the ground that lays it is held by c5-slab-laid and
// test/slab-moat.mjs):
//   - a key is iron: it takes as long to cut as slate (four times soft rock), rings and shatters as slate does, and
//     is drawn as a staple from the finds sheet over its block of rock, shedding iron and rust, in whatever ground;
//   - keys that have been seen glint in the dark, 0.4 bright: the twelve nearest the drill and no more, and never
//     one that has not been seen;
//   - the first slab is a ring on the map from the start of a new game, before any of it has been seen, until none
//     of its keys is left; where its ground holds no key (ground made before slabs were), there is no ring;
//   - the keys of a slab, and the thirty of a cobble field, are called out by name once and marked on the map by
//     a few dots, not by one for each cell of key.
//   node test/regress/c5-key.mjs
import { makeGame, world, C, N } from '../harness.mjs';
import { arena, at, flyTo, fixRandom } from './lib/lasso.mjs';
import { slabsOf } from '../../tools/slabs.mjs';
const { K, B, rowOf } = world;
const atlas = await import('../../js/atlas.js');

fixRandom(5);
const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };

// ---- 1. Cut: as long as slate, and it shatters.
{
  const game = await makeGame(7, { drill: 1 }), w = game.world, d = game.drill;
  arena(game, 14);
  w.setK(at(5, 0), K.KEY); w.setK(at(7, 0), K.SLATE);
  game.changed();
  const took = {}, shattered = {};
  let last = -1;
  flyTo(game, 9, 0, { frames: 2400, each: () => {
    if (d.dig >= 0) took[d.dig] = d.digDur;
    for (const i of [at(4, 0), at(5, 0), at(7, 0)]) if (w.k(i) === K.EMPTY && shattered[i] === undefined) shattered[i] = game.effects.some(e => e.sheet === 'shatter' && Math.floor(e.x / 16) === i % N);
    last = d.dig;
  } });
  const soft = took[at(4, 0)], key = took[at(5, 0)], slate = took[at(7, 0)];
  check(key > 0 && key === slate && Math.abs(key / soft - 1.0 / 0.24) < 1e-9, `cutting takes: soft ${soft}, key ${key}, slate ${slate}`);
  check(shattered[at(5, 0)] === true && shattered[at(7, 0)] === true && shattered[at(4, 0)] === false, `what shattered: ${JSON.stringify(shattered)}`);
}

// ---- 2. Drawn, and what it sheds.
{
  const game = await makeGame(7);
  check(atlas.sheets.finds.frames.key?.length >= 4, 'the finds sheet has no key');
  for (const b of [B.CRUST, B.FROST, B.MIRE, 19, 23, 140]) {
    const over = game.overlay(K.KEY, rowOf(b));
    check(over && over[0] === 'finds' && over[1] === 'key', `in ground ${b} a key is drawn from ${JSON.stringify(over)}`);
    check(JSON.stringify(game.debris(K.KEY, b)) === JSON.stringify(['#8a94a8', '#eef4ff', '#b0603a']), `in ground ${b} a key sheds ${game.debris(K.KEY, b)}`);
    check(game.rockSheet(K.KEY, b) === rowOf(b).sheet, `in ground ${b} a key's block is drawn from ${game.rockSheet(K.KEY, b)}`);
  }
}

// ---- 3. The glint.
{
  const game = await makeGame(7), w = game.world;
  arena(game, 14);
  // Seventeen keys in the rock, each too far from the drill's light and the core's for either to reach it; and
  // one more that has not been seen (the arena is seen 16 cells out, and the light is worked out 20 down).
  const keys = [];
  for (let x = -6; x <= 6; x += 2) keys.push([x, -8], [x, 9]);
  keys.push([10, 0], [-11, 0], [12, 3]);
  for (const [x, y] of keys) w.setK(at(x, y), K.KEY);
  w.setK(at(0, 18), K.KEY);
  game.changed();
  game.render();
  const L = game.lightMap, want = ([x, y]) => L.want[(C + y - L.y0) * L.cols + C + x - L.x0];
  const near = keys.slice().sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
  check(game.glints === 12, `${game.glints} keys glint, of 17 seen`);
  check(near.slice(0, 12).every(k => Math.abs(want(k) - 0.4) < 1e-6), `the twelve nearest are lit ${near.slice(0, 12).map(k => want(k).toFixed(2))}`);
  check(near.slice(12).every(k => want(k) === 0), `the five further are lit ${near.slice(12).map(k => want(k).toFixed(2))}`);
  check(w.k(at(0, 18)) === K.KEY && w.peek(C, C + 18) < 0 && want([0, 18]) === 0, `a key that has not been seen is lit ${want([0, 18])}`);
  // Fewer than twelve: every one.
  for (const [x, y] of near.slice(5)) w.setK(at(x, y), K.SOFT);
  game.changed();
  game.render();
  check(game.glints === 5 && near.slice(0, 5).every(k => Math.abs(want(k) - 0.4) < 1e-6), `with five keys seen ${game.glints} glint`);
}

// ---- 4. The ring on the map.
{
  const game = await makeGame(7), w = game.world, S = w.firstSlab;
  // Every pixel the map draws in the keys' grey: how many, and the box they lie in, from the map's middle.
  const ring = () => {
    const at = [];
    game.ctx.fillRect = (x, y) => { if (game.ctx.fillStyle === '#a4acbc') at.push([x, y]); };
    game.render();
    const [mx, my, mw, mh] = game.mapRect, xs = at.map(p => p[0] - mx - mw / 2), ys = at.map(p => p[1] - my - mh / 2);
    return { n: at.length, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  };
  const grey = () => ring().n;
  check(S && S.keys.every(i => w.peek(i % N, Math.floor(i / N)) < 0), 'the first slab\'s keys are seen before the drill has been near them');
  check(game.firstRing() === S && grey() >= 6, 'a new game has no ring on its map where the first slab lies');
  // On the first reach (12) the slab lies four times as far out as the map shows: its ring is small, at the
  // map's edge and inside it, on the way to the slab (seed 7's lies due south). On the fourth (72) the map shows
  // the place itself, and the ring is the slab's own size there (8 cells of radius at 3.5 cells a pixel).
  {
    const small = ring(), half = 23;
    check(small.x1 - small.x0 === 4 && small.y1 - small.y0 === 4, `on the first reach the ring is ${small.x1 - small.x0 + 1} by ${small.y1 - small.y0 + 1} pixels`);
    check(small.y1 < half && small.y0 > half - 8 && Math.abs(small.x0 + small.x1) <= 4, `on the first reach the ring is drawn at ${JSON.stringify(small)} from the map's middle, which is ${half} pixels from its edge`);
    // (The map shows the ground near the drill, a cell and a half to a pixel. Twelve cells north of the slab's
    // middle the ring is the slab's own size, eight pixels below the map's middle.)
    const home = [game.drill.x, game.drill.y];
    game.drill.x = S.cx + 0.5; game.drill.y = S.cy - 11.5;
    const there = ring(), wide = S.p / 1.5 * 2;
    check(Math.abs((there.x0 + there.x1) / 2) <= 1.5 && Math.abs((there.y0 + there.y1) / 2 - 8) <= 1.5 && Math.abs(there.y1 - there.y0 - wide) <= 2, `twelve cells north of the slab the ring is drawn at ${JSON.stringify(there)}, where the slab is ${wide.toFixed(1)} pixels across, 8 below the middle`);
    [game.drill.x, game.drill.y] = home;
  }
  w.see(S.cx, S.cy, 14);
  check(S.keys.every(i => w.k(i) === K.KEY) && game.firstRing() === S, 'with its keys seen the first slab has no ring');
  game.S.marks = [];
  for (const i of S.keys.slice(1)) w.setK(i, K.EMPTY);
  check(game.firstRing() === S && grey() >= 6, 'with one cell of key left the ring is gone');
  w.setK(S.keys[0], K.SOFT);
  check(game.firstRing() === null && grey() === 0, 'with no key left the ring is still on the map');
}

// ---- 5. Called out, and marked.
{
  const game = await makeGame(7), w = game.world, first = w.firstSlab;
  const field = slabsOf(w, 700).find(S => S.cobble);
  for (const [S, name] of [[first, 'the first slab'], [field, 'a cobble field']]) {
    game.S.marks = []; game.popups.length = 0; game.calledAt = {};
    w.see(S.cx, S.cy, Math.ceil(S.reach) + 1);
    const seen = w.spotted.filter(s => s[0] === 'key').length;
    game.callOut();
    const names = game.popups.filter(p => p.label === 'KEYSTONE').length, dots = game.S.marks.filter(m => m[1] === K.KEY).length;
    check(seen === S.keys.length, `${name}: ${seen} of its ${S.keys.length} cells of key were told of when seen`);
    check(names === 1 && dots >= 1 && dots <= 4, `${name}, ${S.keys.length} cells of key: named ${names} times, ${dots} dots`);
  }
}

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: a key cuts as slate does and is drawn as iron, the nearest twelve seen glint, the first slab is a ring on the map while a key of it is left, and a slab\'s keys are named once');
process.exit(fails.length ? 1 : 0);
