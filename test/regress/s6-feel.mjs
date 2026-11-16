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
//     does not; an icicle that falls shatters, aloud; a shooting star crosses a drift; a cross has both its
//     grounds' quirks; within forty cells of the core nothing comes by itself and nothing gives light; and the
//     sounds that come by themselves come no more than one in 1.2 seconds.
//   node test/regress/s6-feel.mjs
import { makeGame, farStart, wander, random, world, C, N, K } from '../harness.mjs';

const { sfx } = await import(new URL('../../js/audio.js', import.meta.url));
const { feelOf, FEELS } = await import(new URL('../../js/feel.js', import.meta.url));
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
const heard = {};
for (const name of ['creak', 'shatter', 'drip', 'blub', 'quake', 'gust', 'trickle', 'crackle']) { heard[name] = 0; sfx[name] = () => { heard[name]++; }; }
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
  w.dug.set(beside, game.clock - freeze + 2); game.frostOpen.push(beside);
  was = heard.creak;
  run(game, 1);
  check(heard.creak > was, 'a cut beside the drill, about to close over, did not creak');
  const shards = heard.shatter;
  f.force('icicle');
  run(game, 2);
  check(heard.shatter === shards + 1, `an icicle made to fall shattered aloud ${heard.shatter - shards} times`);
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
