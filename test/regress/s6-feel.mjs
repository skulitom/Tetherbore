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
//     does not, and one held open creaks once, the newest cuts looked at first; of two dozen the tether holds open
//     each within hearing creaks once, softer for being off, and none further off at all; an icicle flown under
//     shivers, falls and shatters, aloud, is drawn no more and changes nothing else, one with no room for it does
//     not fall, and all hang again when the feel is begun again; a quake in thaw shakes a few in view loose, no two
//     beginning to fall within 0.3 seconds, and with a notice up they shatter unheard; going from the south into the
//     forge, whose edge is of the same colour and darker, the forge's edge is the one that shows; the frost at the
//     corners is made once; a gust pushes the air over and it eases back; a shooting star crosses a drift, and is
//     drawn only over open ground; the view slid a cell at a time, the vents kept going are those in view; lava run
//     into a cave's piece leaves it drawn as a fresh painting has it, and the feel looks at the cell again; a cross
//     has both its grounds' quirks; within forty cells of the core nothing comes by itself and nothing gives light;
//     and the sounds that come by themselves come no more than one in 1.2 seconds.
//   - The seams and the deep (generation 2, each at a place of world 7 where it lies): every one has a feel of its
//     own, apart from its deep's; in a glacier's halls motes stream the way the air flows where each is born and
//     the wind is told, in a caldera they rise in its thermals and nowhere else, and in ground whose air is still
//     there are none; a fault zipping sparks and rings a note of its run, the further the higher, heard only near
//     the drill; and a seam's reaction bursts in its two parents' colours, three a frame at the most, with its own
//     sound.
//   - The layers over the screen: all their pictures are made in a game's first second, none in the frame a ground
//     is come into.
//   node test/regress/s6-feel.mjs
import { makeGame, farStart, wander, random, world, C, N, K } from '../harness.mjs';

const { sfx } = await import(new URL('../../js/audio.js', import.meta.url));
const { feelOf, FEELS } = await import(new URL('../../js/feel.js', import.meta.url));
const { falls } = await import(new URL('../../js/decor.js', import.meta.url));
const { BIOMES, B } = world;
const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };

// ---------------------------------------------------------------- rows
const own = [0, 1, 2, 3, 4, 5, 6, 7, 8, 17, 18, 19, 20, 21, 22, 23, 24, 32, 33, 34, 35, 36, 37, 38, 9, 10, 11, 12, 13, 14, 15, 16, 64, 65, 66, 67];
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
{
  // The pictures of the layers over the screen are all made in a game's first frames, one a frame, so that none is
  // made in the frame the drill comes into a ground (a fog's took a phone a frame or two).
  const game = await makeGame(7, { tether: 9, drill: 3 }), f = game.feel;
  for (let n = 0; n < 60; n++) f.step(game, 1 / 60);
  const missing = new Set();
  for (const row of [...BIOMES, made]) if (row) for (const l of feelOf(row).layers) if (!f.art.has(l.key)) missing.add(l.key);
  check(missing.size === 0, `after a game's first second the pictures of ${[...missing].join(', ')} were still to be made`);
}

// ---------------------------------------------------------------- the feel changes nothing
// Math.random is a generator of each game's own, the same in both, so the two are the same game.
let draws = 0, stream = null;
const plain = Math.random;
Math.random = () => { draws++; return stream(); };
// (Places on world 7 where each ground lies all about, found with tools/field.mjs: `node tools/field.mjs --seed 7
// --at 416,-912` and so on. The seams and the deep strains are laid by generation 2, which a new game is.)
const PLACES = [['frost', 60, -150], ['ember', 0, 150], ['mire', -150, 0], ['lode', 150, 0], ['rime', 416, -912], ['magma', -432, 816], ['serac', 150, -320],
  ['tangle', -576, 368], ['loess', 300, 0], ['sporefall', -260, -124], ['thaw', -128, -1408], ['scoria', -176, 336],
  ['hoarstone', 496, -480], ['skarn', 752, -768], ['glassdune', 544, 560], ['obsidian', 848, 832], ['cinderfen', -448, 432], ['tarpit', -896, 880],
  ['frostfen', -608, -608], ['muskeg', -704, -720], ['glacier', -608, -832], ['caldera', -640, 1312], ['mycelium', -1328, -816], ['druse', 1088, -496]];
const GROUND_PLACES = [['crust', 80, 40], ['bloom', -784, 544], ['gilt', 800, 448], ['firn', -160, -352], ['forge', 112, 320], ['redrock', 560, -48]];
const FORCE = ['quake', 'gust', 'drip', 'creak', 'bubble', 'steam', 'trickle', 'stars', 'worm', 'crackle', 'flies', 'icicle', 'rime', 'flow'];
const metAll = game => { for (const row of BIOMES) if (row) game.S.met[row.id] = 1; };
{
  stream = random(5);
  const w = (await makeGame(7)).world;
  for (const [name, x, y] of [...PLACES, ...GROUND_PLACES]) check(BIOMES[w.biomeAt(C + x, C + y)]?.name === name, `world 7 has not ${name} at ${x},${y} (it has ${BIOMES[w.biomeAt(C + x, C + y)]?.name})`);
}
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
const GROUNDS = [...PLACES, ...GROUND_PLACES];
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
for (const name of ['creak', 'shatter', 'drip', 'blub', 'quake', 'gust', 'trickle', 'crackle']) { heard[name] = 0; sfx[name] = (...args) => { heard[name]++; if (name === 'creak' && args[1] === 1.2) tells.push(args); }; }
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
{
  // Twenty-four cuts the tether lies in, about to close over, some within ten cells of the drill and some further:
  // in two minutes each near one creaks once, the further the softer, and none further off creaks at all, though
  // there are more of them than a short memory would hold (only the feel's tells are stepped).
  const game = await stage(60, -150), w = game.world, d = game.drill, f = game.feel, F = feelOf(w.row(game.di)), freeze = w.row(game.di).freeze;
  run(game, 2.5);
  w.see(Math.floor(d.x), Math.floor(d.y), 20);
  game.frostOpen.length = 0;
  let near = 0;
  for (let k = 0; k < 24; k++) {
    const i = (Math.floor(d.y) - 3 - (k / 12 | 0)) * N + Math.floor(d.x) - 4 - k % 12;
    w.setK(i, K.EMPTY); w.dug.set(i, game.clock - freeze + 1); game.frostOpen.push(i); game.under.add(i);
    if (Math.hypot(i % N + 0.5 - d.x, Math.floor(i / N) + 0.5 - d.y) < 10) near++;
  }
  const told = tells.length;
  for (let n = 0; n < 1200; n++) { f.time += 0.1; f.tells(game, F, true, 0.1); }
  const said = tells.slice(told);
  check(near >= 8 && near < 24 && said.length === near && said.every(([loud]) => loud > 0 && loud < 0.75), `of twenty-four cuts held open by the tether, ${near} within ten cells of the drill, ${said.length} creaked in two minutes, as loud as ${said.map(([loud]) => loud.toFixed(2)).join(', ')} (each near one once, softer for being off, is meant)`);
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
  // And it passes behind the drift's floating rock: of stars across the whole view, only what is over open ground
  // is drawn.
  f.kind.fill(0); f.live = 0; f.flies = 0; f.nv = 0;
  for (let y = f.y0; y <= f.y1; y += 2) for (let x = f.x0; x <= f.x1; x += 3) f.spawn(11, x * T + 5, y * T + 7, 180, 70, 0.45, 0);
  let open = 0, over = 0;
  const ox = Math.round(game.cam.x - game.W / 2), oy = Math.round(game.cam.y - (game.H - 44) / 2);
  const ctx = new Proxy({}, { get: (t, k) => k === 'fillRect' ? (x, y) => { if (game.world.peek(Math.floor((x + ox) / T), Math.floor((y + oy) / T)) === K.EMPTY) open++; else over++; } : k in t ? t[k] : () => {}, set: (t, k, v) => { t[k] = v; return true; } });
  f.hot = 0;
  f.glow({ W: game.W, H: game.H, drill: game.drill, world: game.world, sparks: new Map(), daylight: true, scale: 1 }, ctx, ox, oy);
  check(open > 50 && over === 0, `of shooting stars across a drift, ${over} pixels were drawn over rock (and ${open} over open ground)`);
}
{
  // An icicle a quake shakes loose comes down by itself, and is heard as what comes by itself is: not while a
  // notice is up. (One the drill flies under is its own, and is heard whatever is up.)
  const game = await makeGame(7, { tether: 9, drill: 3 }), f = game.feel;
  metAll(game);
  const i = icicleNear(game, -128, -1408, 70);
  if (i >= 0) {
    setUnder(game, i, 3);
    feelFor(game, 0.5);
    const was = f.fallen.size, shards = heard.shatter;
    game.notice = { title: 'TEST', sub: '', colour: '#fff', t: 0, life: 9 };
    f.force('quake');
    feelFor(game, 3);
    check(f.fallen.size - was >= 2 && heard.shatter === shards, `with a notice up, a quake in thaw shook ${f.fallen.size - was} icicles loose and ${heard.shatter - shards} shattered aloud (none is meant)`);
  }
}
{
  // The vents in view are those in view: the view slid a cell at a time through the forge, the ground unchanged,
  // the feel keeps going just the vents a fresh look finds.
  const game = await stage(60, 500, { scanner: 4 }), f = game.feel;
  for (let n = 0; n < 30; n++) { game.update(1 / 60); game.render(); }
  const listed = () => [...f.vents.slice(0, f.nv)].sort((a, b) => a - b).join();
  let wrong = 0, seen = 0;
  for (let n = 0; n < 24; n++) {
    game.cam.x += n < 12 ? 16 : -16; game.cam.y += n % 3 ? 0 : 16;
    f.step(game, 1 / 60);
    const now = listed();
    f.cv = -1; f.rx0 = NaN; f.refresh(game);
    if (listed() !== now) wrong++;
    seen += f.nv;
  }
  check(seen > 0 && wrong === 0, `the view slid a cell at a time through the forge 24 times, and ${wrong} times the vents kept going were not those in view`);
}
{
  // Lava running into an open cell of a cave in the south, the ground otherwise as it was: the cave's piece in
  // the cell is drawn no more (as a fresh painting of the ground has it), and the feel looks at the cell again.
  const game = await stage(0, 150, { tether: 5, drill: 4 }), w = game.world, d = game.drill, f = game.feel;
  for (let n = 0; n < 30; n++) { game.update(1 / 60); game.render(); }
  let i = -1, j = -1;
  for (let v = -8; v <= 8 && i < 0; v++) for (let u = -8; u <= 8 && i < 0; u++) {
    const c = (Math.floor(d.y) + v) * N + Math.floor(d.x) + u;
    if (Math.abs(u) + Math.abs(v) < 3 || !game.decorOf(c)) continue;
    for (const s of [1, -1, N, -N]) if (w.k(c + s) === K.EMPTY && w.s(c + s) && !w.lava.has(c + s) && c + s !== game.di) { i = c; j = c + s; break; }
  }
  check(i >= 0, 'no piece of a cave beside open ground near the drill in the south');
  if (i >= 0) {
    const key = ((Math.floor(i / N)) >> 3) * 4096 + ((i % N) >> 3), sum = f.pieces.get(key)?.sum, version = game.version;
    w.lava.set(j, 9); game.lavaVol.set(j, 6);
    for (let t = 0; t < 600 && !w.lava.has(i); t++) { game.update(1 / 60); game.render(); }
    const ops = game.chunks.get(key).ops;
    game.redraw(i); game.render();
    check(w.lava.has(i) && game.version === version && game.chunks.get(key).ops === ops && game.decorOf(i) === null, `lava ran into a cave's piece (${w.lava.has(i)}; the version ${version} to ${game.version}), and the piece of ground drawn was not what a fresh painting draws`);
    check(sum !== undefined && f.pieces.get(key)?.sum !== sum, 'lava ran into a cell, and the feel did not look at it again');
  }
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

// ---------------------------------------------------------------- the air that flows, faults and reactions
{
  // In a glacier's halls motes stream the way the world's flow goes where each is born, over open ground of a
  // ground whose air flows, and the wind is heard as the flow at the drill and the ground open round it say; in a
  // caldera they rise, in its thermals and nowhere else, and its wind is the heat's; in the rime, whose air does
  // not flow, there are none and no wind.
  const FLOW = 16, rec = { x: 0, y: 0 };
  for (const [name, x, y, kind] of [['glacier', -608, -832, 'wind'], ['caldera', -700, 1350, 'heat'], ['rime', 416, -912, null]]) {
    const game = await stage(x, y), f = game.feel, w = game.world;
    let motes = 0, wrong = 0, loud = 0;
    for (let n = 0; n < 8 * 60; n++) {
      game.update(1 / 60);
      loud = Math.max(loud, f.windLevel);
      for (let i = 0; i < 160; i++) {
        if (f.kind[i] !== FLOW || f.t[i] > 1 / 60 + 1e-6) continue;
        motes++;
        const cx = Math.floor((f.x[i] - f.vx[i] / 60) / T), cy = Math.floor((f.y[i] - f.vy[i] / 60) / T), row = f.rowAt(w, cx, cy), fl = w.flowAt(cx, cy, kind ?? 'wind', rec);
        const along = kind === 'heat' ? f.vx[i] === 0 && f.vy[i] < 0 && fl.y < 0 : (f.vx[i] * fl.x + f.vy[i] * fl.y) / Math.hypot(f.vx[i], f.vy[i]) > 0.98;
        if (!along || row?.current !== kind || w.peek(cx, cy) !== K.EMPTY) wrong++;
      }
    }
    if (kind) check(motes > 20 && wrong <= motes * 0.03, `in ${name} ${motes} motes of its ${kind} were born in eight seconds, ${wrong} of them not going the way the air goes where they were born, or not over its open ground`);
    else check(motes === 0 && loud === 0, `in ${name}, whose air does not flow, ${motes} motes of a flow were born and the wind was heard at ${loud.toFixed(2)}`);
    if (kind === 'wind') check(loud >= 0.3 && f.windKind === 'wind', `in a glacier's hall the wind was heard at ${loud.toFixed(2)} at the most (${f.windKind})`);
    if (kind === 'heat') check(f.windKind === 'heat', `in a caldera the air the feel told of is ${f.windKind}`);
  }
}
{
  // A fault zipping: sparks from each cell, and a note of the run each, the further along the higher, heard only
  // near the drill; and nothing in the game changes.
  const game = await stage(-1328, -816), f = game.feel, d = game.drill, zips = [], keep = sfx.zip;
  sfx.zip = (...args) => zips.push(args);
  run(game, 0.5);
  const i = Math.floor(d.y) * N + Math.floor(d.x) + 2, live = f.live, version = game.version, grit = game.S.grit;
  const zip = (...args) => typeof f.zip === 'function' && f.zip(...args);
  check(typeof f.zip === 'function', 'the feel has no zip for a fault to call');
  for (let n = 0; n < 6; n++) zip(game, i, n);
  const near = zips.length;
  zip(game, i + 40, 9);
  sfx.zip = keep;
  check(f.live - live >= 18 && near === 6 && zips.length === 6 && zips.every(([n, loud], k) => n === k && loud > 0.5), `six cells of a fault zipped beside the drill made ${f.live - live} particles and were heard ${near} times as ${JSON.stringify(zips)}, and one forty cells off ${zips.length - near} times`);
  check(game.version === version && game.S.grit === grit, 'a fault zipping changed the game');
}
{
  // A seam's reaction, in each corner: a burst in the two parents' colours, heard as its own sound, no more than
  // three bursts a frame; and none in ground with no reaction.
  for (const [name, x, y] of [['hoarstone', 496, -480], ['glassdune', 544, 560], ['cinderfen', -448, 432], ['frostfen', -608, -608], ['rime', 416, -912]]) {
    const game = await stage(x, y), f = game.feel, w = game.world, d = game.drill, row = w.row(game.di), said = [];
    run(game, 0.5);
    const was = row.react && sfx[row.react];
    if (row.react) sfx[row.react] = (...args) => said.push(args);
    f.kind.fill(0); f.live = 0; f.flies = 0; f.nv = 0;
    let shown = 0;
    check(typeof f.react === 'function', 'the feel has no react for a seam to call');
    for (let n = 0; n < 6; n++) if (f.react?.(game, game.di + (n % 3) - 1)) shown++;
    if (row.react) sfx[row.react] = was;
    const inks = new Set(), ox = Math.round(game.cam.x - game.W / 2), oy = Math.round(game.cam.y - (game.H - 44) / 2);
    const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => {}, set: (t, k, v) => { if (k === 'fillStyle') inks.add(v); t[k] = v; return true; } });
    f.dust(game, ctx, ox, oy); f.glow({ W: game.W, H: game.H, drill: d, world: w, sparks: new Map(), daylight: true, scale: 1 }, ctx, ox, oy);
    if (!row.react) { check(shown === 0 && f.live === 0, `${name} has no reaction, and a burst of one showed ${f.live} particles`); continue; }
    const a = BIOMES[row.kin].mote[0], b = BIOMES[row.gemB].mote[0];
    check(shown === 3 && f.live >= 25 && inks.has(a) && inks.has(b), `in ${name} six reactions in a frame showed ${shown} bursts (three are meant), ${f.live} particles, drawn in ${[...inks].join(' ')} (its parents' ${a} and ${b} are meant)`);
    check(said.length === 3 && said.every(([near]) => near > 0.8), `in ${name} a reaction beside the drill was heard as ${row.react} ${said.length} times at ${said.map(([n]) => n?.toFixed?.(2)).join(', ')}`);
  }
}

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : `no defect: every ground has a feel of its own and every cross its host's with its donor's mark; with the feel or without, ${PLACES.length} flights went the same way; at the most ${worst.live} particles, ${worst.flies} fireflies, ${worst.work} cells looked at and ${worst.calls} calls on the canvas a frame; and each quirk came`);
process.exit(fails.length ? 1 : 0);
