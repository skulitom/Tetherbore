// Each ground's feel (js/feel.js) is only feel, it is bounded, and each of its quirks happens.
//   - Rows: every hand-made ground has a feel of its own, no two alike; every cross has its host's with its donor's
//     mark added, so none is its host's own; a row a test makes, with a name no feel has, has its direction's.
//   - Two games side by side on one world, flown the same way, one with its feel taken out and the other with a
//     quirk made to come every second: frame by frame the drill, the tether, the ground's version, the game's
//     own particles, shake, flash and pause, the hull, the grit, the lava, the draws from Math.random and the
//     pieces of the world made are the same, and so are the cells in view at the end. So the feel has a generator
//     of its own, and changes nothing in the world, the flight or what is paid. (The quake shakes the view and
//     nothing else, so it is held still while the games are drawn: a view shaken a pixel over may paint a piece of
//     ground the other did not, which is no change to the game.)
//   - Bounded: in every ground, forty seconds with something forced every second, the particles, fireflies,
//     pieces and lights stay within their numbers, a frame looks at no more than 2,000 cells, and the feel's two
//     passes make no more than 450 calls on the canvas a frame.
//   - Quirks: a quake shakes the view and is heard, and is still again within two and a half seconds; fireflies
//     come round a drill that stands still in the west; a cut finished in the east pours sand and is heard; a cut
//     in the north about to close over creaks with the drill beside it, and one far from the drill and the tether
//     does not, and one held open creaks once, the newest cuts looked at first; an icicle flown under shivers,
//     falls and shatters, aloud, is drawn no more and changes nothing else, one with no room for it does not fall,
//     and all hang again when the feel is begun again; a quake in thaw shakes a few in view loose, no two beginning
//     to fall within 0.3 seconds; going from the south into the forge, whose edge is of the same colour and darker,
//     the forge's edge is the one that shows; the frost at the corners is made once; a gust pushes the air over and
//     it eases back; a shooting star crosses a drift; a cross has both its
//     grounds' quirks; within forty cells of the core nothing comes by itself and nothing gives light; and the
//     sounds that come by themselves come no more than one in 1.2 seconds.
//   node test/regress/s6-feel.mjs
import { makeGame, farStart, wander, random, world, C, N, K } from '../harness.mjs';

const { sfx } = await import(new URL('../../js/audio.js', import.meta.url));
const { feelOf, FEELS } = await import(new URL('../../js/feel.js', import.meta.url));
const { falls } = await import(new URL('../../js/decor.js', import.meta.url));
const { BIOMES, B } = world;
const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };

// ---------------------------------------------------------------- rows
const own = [0, 1, 2, 3, 4, 5, 6, 7, 8, 17, 18, 19, 20, 21, 22, 23, 24, 32, 33, 34, 35, 36, 37, 38];
for (const id of own) check(!!FEELS[BIOMES[id].name], `${BIOMES[id].name} has no feel of its own`);
const told = own.map(id => JSON.stringify(FEELS[BIOMES[id].name]));
check(new Set(told).size === own.length, 'two hand-made grounds have the same feel');
let crosses = 0;
for (const row of BIOMES) {
  if (!row?.cross) continue;
  crosses++;
  const f = feelOf(row), host = feelOf(BIOMES[row.cross.host]);
  check(JSON.stringify(f) !== JSON.stringify(host), `${row.name} feels just as its host ${BIOMES[row.cross.host].name} does`);
}
check(crosses === 60, `${crosses} crosses were looked at (60 are meant)`);
const thaw = feelOf(BIOMES.find(r => r?.name === 'thaw'));
check(thaw.creak && thaw.rime && thaw.quake?.power === 0.6 && thaw.quake.every[0] === 44 && thaw.vent?.p === 0.025, `thaw's feel is not the north's with the south's mark at half strength: ${JSON.stringify(thaw)}`);
const made = world.biome({ ...BIOMES[B.EMBER], id: 120, name: 'test-made-ember' });
check(JSON.stringify(feelOf(made)) === JSON.stringify(feelOf(BIOMES[B.EMBER])), 'a made row of the south does not feel as the south');

// ---------------------------------------------------------------- the feel changes nothing
// Math.random is a generator of each game's own, the same in both, so the two are the same game.
let draws = 0, stream = null;
const plain = Math.random;
Math.random = () => { draws++; return stream(); };
const PLACES = [['frost', 60, -150], ['ember', 0, 150], ['mire', -150, 0], ['lode', 150, 0], ['rime', -380, -800], ['magma', -332, 800], ['serac', 150, -320],
  ['tangle', -260, -260], ['loess', 300, 0], ['sporefall', -260, -124], ['thaw', -128, -1408], ['scoria', 0, 300]];
const FORCE = ['quake', 'gust', 'drip', 'creak', 'bubble', 'steam', 'trickle', 'stars', 'worm', 'crackle', 'flies', 'icicle', 'rime'];
const metAll = game => { for (const row of BIOMES) if (row) game.S.met[row.id] = 1; };
for (const [name, x, y] of PLACES) {
  const games = [];
  for (let g = 0; g < 2; g++) {
    stream = random(99);
    const game = await makeGame(7, { tether: 9, drill: 3 });
    metAll(game);
    farStart(game, x, y);
    game.own = random(1234);
    games.push(game);
  }
  const [a, b] = games;
  for (const part of ['step', 'dust', 'glow', 'lights']) b.feel[part] = () => {};
  let frame = 0, differ = null;
  for (const auto of wander(random(x * 7 + y), 14)) {
    const seen = [];
    for (const game of games) {
      stream = game.own; draws = 0;
      if (game === a && frame % 60 === 30) a.feel.force(FORCE[(frame / 60 | 0) % FORCE.length]);
      game.input.auto = auto;
      game.update(1 / 60);
      const d = game.drill, w = game.world;
      seen.push([d.x, d.y, d.mode, game.version, game.parts.length, game.shake, game.hitstop ?? 0, game.flash, game.dents, game.S.grit, w.lava.size, game.band.length, draws, w.made].join());
      const quake = game.feel.quake;
      game.feel.quake = 0; game.render(); game.feel.quake = quake;
    }
    if (!differ && seen[0] !== seen[1]) differ = `${frame}: ${seen[0]}\n        without the feel: ${seen[1]}`;
    frame++;
  }
  check(!differ, `in ${name} the game with its feel went another way than the game without, at frame ${differ}`);
  const cells = game => { const w = game.world, d = game.drill; let h = 0; for (let v = -12; v <= 12; v++) for (let u = -8; u <= 8; u++) h = Math.imul(h ^ (w.peek(Math.floor(d.x) + u, Math.floor(d.y) + v) + 3), 16777619); return h; };
  check(cells(a) === cells(b), `in ${name} the cells in view are not the same with the feel as without`);
  check(a.feel.events > 5, `in ${name} the feel's quirks came only ${a.feel.events} times in ${(frame / 60).toFixed(0)} seconds`);
}
Math.random = plain;

// ---------------------------------------------------------------- bounded
// (A count of the calls on the canvas that the feel's passes make.)
let calls = 0;
const counting = ctx => new Proxy(ctx, { get: (t, k) => { const v = t[k]; return typeof v === 'function' ? (...args) => { calls++; return v.apply(t, args); } : v; }, set: (t, k, v) => { t[k] = v; return true; } });
const GROUNDS = [...PLACES, ['crust', 80, 40], ['bloom', -700, 500], ['gilt', 800, -340], ['firn', 0, -300], ['forge', 44, 260], ['redrock', 260, -212]];
const worst = { live: 0, flies: 0, pieces: 0, lit: 0, work: 0, calls: 0 };
for (const [name, x, y] of GROUNDS) {
  const game = await makeGame(7, { tether: 9, drill: 3 }), f = game.feel;
  metAll(game);
  farStart(game, x, y);
  for (const part of ['dust', 'glow']) { const own = f[part].bind(f); f[part] = (g, ctx, ox, oy) => own(g, counting(ctx), ox, oy); }
  let n = 0;
  for (const auto of wander(random(x - y), 40)) {
    if (n % 30 === 0) f.force(FORCE[(n / 30 | 0) % FORCE.length]);
    // (Halfway, the feel is begun again, as a new game or a lost trip begins it: what it holds is all given back.)
    if (n === 600) f.reset(7);
    game.input.auto = n % 300 < 150 ? auto : null;
    game.update(1 / 30);
    calls = 0; game.render();
    for (const [key, value] of [['live', f.live], ['flies', f.flies], ['pieces', f.pieces.size], ['lit', f.lit], ['work', f.work], ['calls', calls]]) if (value > worst[key]) worst[key] = value;
    if (++n >= 1200) break;
  }
}
check(worst.live <= 160 && worst.flies <= 10 && worst.pieces <= 64 && worst.lit <= 8, `the feel held ${worst.live} particles, ${worst.flies} fireflies, ${worst.pieces} pieces and ${worst.lit} lights at once`);
check(worst.work <= 2000, `a frame of the feel looked at ${worst.work} cells`);
check(worst.calls <= 450, `the feel's passes made ${worst.calls} calls on the canvas in a frame`);
check(worst.live > 40 && worst.flies >= 5, `with a quirk every second the feel never held more than ${worst.live} particles and ${worst.flies} fireflies: it hardly ran`);

// ---------------------------------------------------------------- each quirk happens
const heard = {}, tells = [];
for (const name of ['creak', 'shatter', 'drip', 'blub', 'quake', 'gust', 'trickle', 'crackle']) { heard[name] = 0; sfx[name] = (...args) => { heard[name]++; if (name === 'creak' && args[0] === 1) tells.push(args); }; }
const stage = async (x, y, levels = {}) => { const game = await makeGame(7, { tether: 9, drill: 3, ...levels }); metAll(game); farStart(game, x, y); return game; };
const run = (game, seconds, auto = null) => { game.input.auto = auto; for (let n = 0; n < seconds * 60; n++) game.update(1 / 60); };
{
  const game = await stage(0, 150);
  run(game, 0.5);
  game.feel.force('quake');
  let most = 0, t = 0;
  for (; t < 3 * 60; t++) { game.update(1 / 60); most = Math.max(most, game.feel.quake); if (t > 10 && game.feel.quake === 0) break; }
  check(most > 1 && t < 2.5 * 60 && heard.quake === 1, `a quake in the south shook the view by ${most.toFixed(2)}, was still again after ${(t / 60).toFixed(2)} s, and was heard ${heard.quake} times`);
}
{
  const game = await stage(-150, 0);
  run(game, 15);
  const d = game.drill, f = game.feel;
  let near = 0;
  for (let n = 0; n < f.flies; n++) if (Math.hypot(f.fx[n] / 16 - d.x, f.fy[n] / 16 - d.y) < 3) near++;
  check(near >= 2, `after fifteen seconds of a drill standing still in the west, ${near} of ${f.flies} fireflies were within three cells of it`);
}
{
  const game = await stage(150, 0), w = game.world, f = game.feel;
  run(game, 2.5);
  const was = heard.trickle, cuts = game.cuts;
  let poured = false;
  game.input.auto = [1, 0, 1];
  for (let n = 0; n < 120 && !poured; n++) { game.update(1 / 60); poured = f.pours.some(s => s[3] > 0); }
  check(game.cuts > cuts && poured && heard.trickle > was, `a cut finished in the east (${game.cuts - cuts} cuts) poured no sand, or was not heard (${heard.trickle - was} times)`);
}
{
  const game = await stage(60, -150), w = game.world, d = game.drill, f = game.feel, freeze = w.row(game.di).freeze;
  run(game, 2.5);
  const far = (Math.floor(d.y) - 1) * N + Math.floor(d.x) - 30, beside = Math.floor(d.y) * N + Math.floor(d.x) + 1;
  // A cut far off, nearly closed: no creak.
  w.setK(far, K.EMPTY); w.dug.set(far, game.clock - freeze + 2); game.frostOpen.push(far);
  let was = heard.creak;
  run(game, 1);
  check(freeze > 0 && heard.creak === was, `a cut thirty cells from the drill, about to close over, creaked (${heard.creak - was} times; the ground freezes in ${freeze} s)`);
  // (Behind four hundred cuts made before it, far off and fresh: the newest are looked at first.)
  const fresh = (Math.floor(d.y) + 1) * N + Math.floor(d.x) - 30;
  w.setK(fresh, K.EMPTY); w.dug.set(fresh, game.clock);
  for (let n = 0; n < 400; n++) game.frostOpen.push(fresh);
  w.dug.set(beside, game.clock - freeze + 2); game.frostOpen.push(beside);
  was = heard.creak;
  const told = tells.length;
  run(game, 1);
  check(heard.creak > was && tells.length === told + 1, `a cut beside the drill, about to close over behind four hundred older cuts, creaked ${tells.length - told} times as it came to (once is meant)`);
  // Held open by the drill beside it, it creaks no more.
  run(game, 8);
  check(tells.length === told + 1, `a cut held open beside the drill creaked ${tells.length - told} times in nine seconds (once is meant)`);
  const shards = heard.shatter;
  f.force('icicle');
  run(game, 2);
  check(heard.shatter === shards + 1, `an icicle made to fall shattered aloud ${heard.shatter - shards} times`);
}
// The icicles of a cave (js/decor.js): only the feel is stepped, with the drill set down in a cave of the seed's
// under an icicle that has open ground under it, the view on it.
const ICICLE = 15, T = 16;
const icicleNear = (game, sx, sy, R = 60) => {
  const w = game.world;
  w.see(C + sx, C + sy, R);
  for (let y = C + sy - R + 2; y < C + sy + R - 4; y++) for (let x = C + sx - R + 2; x < C + sx + R - 2; x++) {
    const i = y * N + x, f = game.decorOf(i);
    if (f && falls(f) && [1, 2, 3].every(v => w.peek(x, y + v) === K.EMPTY) && w.peek(x - 1, y + 2) === K.EMPTY && w.peek(x + 1, y + 2) === K.EMPTY) return i;
  }
  return -1;
};
const setUnder = (game, i, down = 2) => {
  const d = game.drill;
  d.x = (i % N) + 0.5; d.y = Math.floor(i / N) + down + 0.5; d.vx = 0; d.vy = 0; d.mode = 'free';
  game.cam.x = d.x * T; game.cam.y = d.y * T;
};
const feelFor = (game, seconds, then = () => {}) => { for (let n = 0; n < seconds * 60; n++) { game.feel.step(game, 1 / 60); then(n); } };
const cellsAbout = (w, i) => { let h = 0; for (let v = -12; v <= 12; v++) for (let u = -12; u <= 12; u++) h = Math.imul(h ^ (w.k(i + v * N + u) + 3), 16777619); return h; };
{
  // Flown under, an icicle shivers, falls and shatters aloud; the cell is drawn without it from then on, and
  // nothing else is changed: no cell, no knock, not the ground's version. An icicle stood under, not flown under,
  // stays.
  const game = await makeGame(7, { tether: 9, drill: 3 }), w = game.world, f = game.feel, d = game.drill;
  metAll(game);
  const i = icicleNear(game, -40, -310);
  check(i >= 0, 'no icicle with open ground under it in the north to fly under');
  if (i >= 0) {
    check(game.fallen === f.fallen, 'the game\'s fallen icicles are not the feel\'s');
    setUnder(game, i);
    feelFor(game, 1);
    check(!f.fallen.has(i), 'an icicle fell over a drill standing still under it');
    const version = game.version, dents = game.dents, cells = cellsAbout(w, i), shards = heard.shatter, frame = game.decorOf(i);
    let redrawn = 0;
    const redraw = game.redraw.bind(game);
    game.redraw = j => { if (j === i) redrawn++; redraw(j); };
    d.vx = 4;
    let falling = -1;
    feelFor(game, 0.3, () => { d.x = (i % N) + 0.5; for (let p = 0; p < 160 && falling < 0; p++) if (f.kind[p] === ICICLE && f.size[p] === 0) falling = p; });
    check(f.fallen.has(i) && falling >= 0 && redrawn === 1, `an icicle flown under did not come down (kept as fallen: ${f.fallen.has(i)}, falling: ${falling >= 0}, drawn again ${redrawn} times)`);
    check(!game.decorOf(i) || !falls(game.decorOf(i)), `an icicle that has fallen is still there to draw: ${game.decorOf(i)} (it was ${frame})`);
    feelFor(game, 3);
    check(heard.shatter > shards, 'an icicle that fell did not shatter aloud');
    check(game.version === version && game.dents === dents && cellsAbout(w, i) === cells, `an icicle that fell changed the game: version ${version} to ${game.version}, dents ${dents} to ${game.dents}, the cells about it ${cellsAbout(w, i) === cells ? 'the same' : 'changed'}`);
    game.redraw = redraw;
    // With no room for its particle, an icicle does not come down and is not kept as fallen.
    const other = icicleNear(game, (i % N) - C + 20, Math.floor(i / N) - C, 30);
    if (other >= 0 && other !== i) {
      const kinds = f.kind.slice(), live = f.live;
      f.kind.fill(5); f.live = 160; f.icicleNext = 0;
      check(!f.icicleFall(game, other, game.decorOf(other)) && !f.fallen.has(other), 'an icicle with no room for its particle was kept as fallen');
      f.kind.set(kinds); f.live = live;
    }
    // A trip lost, a game loaded or a new world: the icicles hang again.
    game.begin();
    check(game.fallen === f.fallen && f.fallen.size === 0, `begun again, ${f.fallen.size} icicles are still kept as fallen`);
  }
}
{
  // A quake in thaw (the north with the south's mark) shakes a few icicles in view loose, one beginning to fall
  // LOOSE (0.3) seconds after another at the least.
  const game = await makeGame(7, { tether: 9, drill: 3 }), f = game.feel;
  metAll(game);
  const i = icicleNear(game, -128, -1408, 70);
  check(i >= 0 && game.world.row(i).name === 'thaw', `no icicle with open ground under it in thaw (${i >= 0 ? game.world.row(i).name : 'none'})`);
  if (i >= 0) {
    setUnder(game, i, 3);
    feelFor(game, 0.5);
    const was = f.fallen.size;
    f.force('quake');
    let waits = null;
    feelFor(game, 0.2, () => { if (!waits && f.fallen.size > was) { waits = []; for (let p = 0; p < 160; p++) if (f.kind[p] === ICICLE) waits.push(-f.t[p] - 0.35); } });
    waits = (waits ?? []).sort((a, b) => a - b);
    const view = [...f.fallen].every(j => j % N > f.x0 && j % N < f.x1 && Math.floor(j / N) > f.y0 && Math.floor(j / N) < f.y1);
    check(f.fallen.size - was >= 2 && view, `a quake in thaw shook ${f.fallen.size - was} icicles loose${view ? '' : ', some out of view'}`);
    check(waits.every((t, n) => !n || t - waits[n - 1] >= 0.3 - 0.02), `icicles shaken loose begin to fall ${waits.map(t => t.toFixed(2)).join(', ')} s from now: less than 0.3 s apart`);
  }
}
{
  // The air: a layer over the screen is known by all of it. The south and the forge have edges of one colour,
  // and the forge's darker: gone from one to the other, the other's eases in and the first's goes.
  const game = await stage(0, 150), f = game.feel, ember = feelOf(BIOMES[B.EMBER]), forge = feelOf(BIOMES.find(r => r?.name === 'forge'));
  check(ember.edge.color.join() === forge.edge.color.join() && ember.edge.alpha !== forge.edge.alpha, 'the south\'s edge and the forge\'s are no longer of one colour and two darknesses (the test wants a new pair)');
  for (let n = 0; n < 600; n++) f.atmosphere(game, ember, 1 / 60);
  for (let n = 0; n < 600; n++) f.atmosphere(game, forge, 1 / 60);
  const edges = f.layers.filter(l => !l.fog);
  check(edges.length === 1 && edges[0].spec === forge.edge && edges[0].alpha > 0.99, `from the south into the forge the edge is ${edges.map(l => `${l.spec.alpha} at ${l.alpha.toFixed(2)}`).join(', ')} (the forge's, ${forge.edge.alpha}, is meant)`);
  // And the frost at the corners is made once for each colour and stage, and found again with nothing made.
  check(f.frost('#dff4ff', 3) === f.frost('#dff4ff', 3) && ![...f.art.keys()].some(k => k.startsWith('rime')), 'the frost at the corners is not kept by its colour and stage');
  // The wind: a gust pushes the air over (the game's motes are drawn so far over), and it eases back.
  f.force('gust');
  run(game, 2.5);
  const pushed = Math.abs(f.drift);
  run(game, 12);
  check(pushed > 15 && Math.abs(f.drift) < 3, `a gust pushed the air ${pushed.toFixed(1)} pixels over, and after it, ${Math.abs(f.drift).toFixed(1)}`);
}
{
  const game = await stage(14, -165), f = game.feel;
  let stars = false;
  f.force('stars');
  for (let n = 0; n < 10; n++) { game.update(1 / 60); for (let i = 0; i < f.kind.length; i++) if (f.kind[i] === 11) stars = true; }
  check(stars, 'a shooting star made to come over a drift did not');
}
{
  // Thaw: the north's creak and the south's quake both come by themselves.
  const game = await stage(-128, -1408);
  const was = { creak: heard.creak, quake: heard.quake };
  run(game, 150);
  check(heard.creak > was.creak && heard.quake > was.quake, `in two and a half minutes of thaw the ice creaked ${heard.creak - was.creak} times and the ground quaked ${heard.quake - was.quake} times`);
}
{
  // Home is quiet, and nothing in it gives light.
  const game = await stage(20, 6), f = game.feel;
  let lit = 0;
  for (let n = 0; n < 60 * 60; n++) { game.update(1 / 60); if (n % 30 === 0) { game.render(); lit = Math.max(lit, f.lit); } }
  check(f.events === 0 && lit === 0, `within forty cells of the core ${f.events} quirks came and ${lit} lights shone in a minute`);
}
{
  // The sounds that come by themselves: no more than one in 1.2 seconds, though drips and bubbles are made to come
  // five times a second (away from a wreck, whose ticking they keep out of the way of).
  const game = await stage(-260, -260);
  const at = [], keep = sfx.drip, keep2 = sfx.blub;
  sfx.drip = sfx.blub = () => { at.push(game.feel.time); };
  for (let n = 0; n < 30 * 60; n++) { if (n % 12 === 0) game.feel.force(['drip', 'bubble', 'steam'][n / 12 % 3]); game.update(1 / 60); }
  sfx.drip = keep; sfx.blub = keep2;
  const closest = Math.min(...at.slice(1).map((t, n) => t - at[n]));
  check(at.length >= 10 && closest >= 1.2 - 1e-6, `in thirty seconds of drips and bubbles made to come five times a second, ${at.length} were heard, the closest ${closest.toFixed(2)} s apart`);
}

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : `no defect: every ground has a feel of its own and every cross its host's with its donor's mark; with the feel or without, ${PLACES.length} flights went the same way; at the most ${worst.live} particles, ${worst.flies} fireflies, ${worst.work} cells looked at and ${worst.calls} calls on the canvas a frame; and each quirk came`);
process.exit(fails.length ? 1 : 0);
