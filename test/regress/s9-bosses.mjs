// The lords at the ends (js/bosses.js): where they lie, that they change nothing but by their deeds, keep to their
// bounds, tell fairly and rise where they can be seen. Each lord whose fight is built (`ready`) is held, the north's
// FROST WYRM first; a lord built later is held by the same parts as it is made ready.
//   1. Each lair lies LAIR (2,210) cells out on its own axis, past the relics, and the leash's disc round it inside
//      the last reach, so every part of a fight can be flown.
//   2. Tame equals off: two games side by side on one world and one stream of Math.random, the drill at a lord's lair
//      and flown for 60 seconds by a seeded thumb that keeps near it, on worlds 7 and 11: one with its creatures off,
//      the other with them tame and the lord woken and set into each of its states in turn (sunk, rising, telling,
//      attacking, resting with a loop of the band put round it, hurt, yielding, beaten, the icefall), every frame
//      drawn. Frame by frame the two are the same: the drill, the band, the version of the ground, the cells about
//      the lair, the hull, the grit, the save, the game's particles and shake, the draws from Math.random and the
//      pieces made. No deed is done, and the lord was in every state.
//   3. Neither js/bosses.js nor js/winds.js names Math.random.
//   4. Bounds: its arrays are the ones made at first and it keeps nothing else; what it looks at in a frame is
//      bounded; with no `bosses` sheet in the atlas it draws nothing at all, and with one every state draws.
//   5. Fairness at 160x284, 120 seconds of a fight with each lord, 40 at each stage, the drill flown about it: every
//      tell begins with the lord and both ends of what it tells (its line, its rings) on the screen 20 pixels inside
//      its edges; every hit lands LEAST_TELL (0.7) seconds or more after the tell of the attack that made it; each
//      comes through `Game.hit`, no two within SHIELD; no tell is shorter than LEAST_TELL; and at the first stage no
//      two attacks come within 4.5 seconds, slower than the late mender's 3.5.
//   6. Surfacing: on worlds 1, 7, 11, 23 and 123456, the drill brought into the open ground the seed left nearest
//      each lair, the lord wakes and rises within 5 seconds of waking, on the screen.
// Fails on the game before the lords, which has no js/bosses.js.
//   node test/regress/s9-bosses.mjs
import { readFile } from 'node:fs/promises';
import { makeGame, random, wander, farStart, C, N, K } from '../harness.mjs';
import { sheets } from '../../js/atlas.js';
import { REACH } from '../../js/shop.js';
import { RELIC_R } from '../../js/world.js';
import { SHIELD } from '../../js/game.js';
import { BOSS, LAIR, LEASH, ST, NARROW, LEAST_TELL, ICEFALL, frameName, Bosses } from '../../js/bosses.js';
import { LORDS, NAMES, atLair, run, until, loopRound, thumb, openNearLair, lairX, lairY, DX, DY } from './lib/lords.mjs';

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
check(LORDS.includes(3), 'the north\'s lord is not ready');

// ---- 1. where
for (let b = 0; b < 4; b++) {
  const x = lairX(b) - C - 0.5, y = lairY(b) - C - 0.5;
  check(x === DX[b] * 2210 && y === DY[b] * 2210, `the ${NAMES[b]}'s lair is at ${x},${y}`);
  check(LAIR > RELIC_R && LAIR + LEASH <= REACH[REACH.length - 1], `the ${NAMES[b]}'s lair at ${LAIR} and its leash of ${LEASH} are not between the relic (${RELIC_R}) and the last reach (${REACH[REACH.length - 1]})`);
}

// ---- 3. no Math.random
for (const file of ['bosses', 'winds']) {
  const source = await readFile(new URL(`../../js/${file}.js`, import.meta.url), 'utf8');
  check(!/Math\.random/.test(source.replace(/\/\/.*$/gm, '')), `js/${file}.js draws from Math.random`);
}

// ---- 2. tame equals off, and 4. bounds
let draws = 0, stream = null;
const plain = Math.random;
Math.random = () => { draws++; return stream(); };
const ARRAYS = ['st', 't', 'stage', 'blows', 'x', 'y', 'cell', 'ax', 'ay', 'lockX', 'lockY', 'face', 'away', 'armed', 'plugs', 'shards', 'shard', 'anchor', 'struck', 'ph', 'beat', 'heard', 'fallT', 'fallX', 'fallY', 'laid', 'tendril', 'near'];
const STATES = [['sunk', 1], ['rise', 1], ['tell', 1], ['act', 1], ['rest', 1], ['hurt', 2], ['tell', 3], ['icefall', 3], ['rest', 2], ['yield', 3], ['gone', 3], ['sunk', 2]];
let worst = 0;
for (const b of LORDS) for (const seed of [7, 11]) {
  const games = [];
  for (let g = 0; g < 2; g++) { stream = random(41); const game = await atLair(b, { seed, hull: true, fix: false, first: game => { if (g) game.fauna.off = true; else game.fauna.tame = true; } }); game.own = random(4321); games.push(game); }
  const [a, z] = games, B = a.fauna.bosses;
  const arrays = ARRAYS.map(k => B[k]), keys = Object.keys(B).sort().join();
  const seen = new Set(), steer = thumb(a, b, random(seed * 5 + b));
  let differ = null, looped = 0;
  for (let frame = 0; frame < 60 * 60; frame++) {
    const auto = steer(), rows = [];
    // (Every three seconds, from five seconds in, the lord set into the next of its states beside the drill.)
    if (frame >= 300 && frame % 180 === 0) { const [what, n] = STATES[(frame / 180 | 0) % STATES.length]; B.stageAs(a, b, what, n); }
    for (const game of games) {
      stream = game.own; draws = 0;
      game.input.auto = auto;
      game.update(1 / 60);
      // (Resting, it has a loop of the band put round it: tame, nothing comes of it.)
      if (game === a && B.st[b] === ST.REST) { loopRound(a, b); looped++; }
      const d = game.drill, w = game.world;
      let cells = 0;
      for (let y = -12; y <= 12; y++) for (let x = -12; x <= 12; x++) cells = (cells * 31 + w.k((Math.floor(d.y) + y) * N + Math.floor(d.x) + x)) | 0;
      rows.push([d.x, d.y, d.vx, d.vy, d.mode, d.stun, game.version, JSON.stringify(game.band), cells, game.parts.length, game.rings.length, game.effects.length, game.popups.length,
        game.shake, game.flash, game.hitstop, game.dents, game.knocks, game.S.grit, JSON.stringify(game.S), game.place?.title ?? '', game.banner?.title ?? '', draws, w.made].join());
      game.render();
    }
    seen.add(B.st[b]);
    worst = Math.max(worst, B.work);
    if (!differ && rows[0] !== rows[1]) differ = `${frame}:\n        tame: ${rows[0].slice(0, 300)}\n        none: ${rows[1].slice(0, 300)}`;
  }
  check(!differ, `with the ${NAMES[b]}'s lord on world ${seed} the game with its creatures tame went another way than the game with none, at frame ${differ}`);
  check(a.fauna.deeds === 0, `with the ${NAMES[b]}'s lord on world ${seed} a tame creature did ${a.fauna.deeds} deeds`);
  check(looped > 30, `with the ${NAMES[b]}'s lord on world ${seed} a loop was put round it at rest only ${looped} times`);
  const missing = Object.entries(ST).filter(([name, s]) => !seen.has(s) && !['LATCH', 'BLINK'].includes(name)).map(([name]) => name);
  check(!missing.length, `with the ${NAMES[b]}'s lord on world ${seed} it was never ${missing.join(', ')}`);
  check(ARRAYS.every((k, n) => B[k] === arrays[n]) && Object.keys(B).sort().join() === keys, `with the ${NAMES[b]}'s lord on world ${seed} its arrays were made again, or it kept something more`);
  // Begun again: every lord asleep and whole.
  a.begin();
  check([...B.st].every(s => s === ST.SLEEP) && [...B.blows].every(n => n === 0) && B.drag === 1, `with the ${NAMES[b]}'s lord on world ${seed} a lord was not asleep and whole when the game began again`);
}
Math.random = plain;
check(worst > 0 && worst <= 400, `a lord looked at ${worst} cells and points in one frame`);

// ---- 4. drawing: nothing with no sheet; everything with one
{
  const game = await atLair(3), B = game.fauna.bosses;
  B.stageAs(game, 3, 'tell', 1);
  let calls = 0;
  const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => { calls++; }, set: (t, k, v) => { t[k] = v; return true; } });
  const had = sheets.bosses;
  delete sheets.bosses;
  B.draw(game, ctx, 0, 0); B.signs(game, ctx, 0, 0); B.glow(game, ctx, 0, 0); B.lights(game);
  check(calls === 0, `with no bosses sheet in the atlas a lord drew ${calls} times`);
  // (A sheet that has every frame, as WS2's art will: each state drawn without a fault.)
  const frames = {};
  for (let b = 0; b < 4; b++) for (let p = 0; p < BOSS[b].poses.length; p++) for (const left of [0, 1]) frames[frameName(b, p, left)] = [0, 0, 48, 48];
  sheets.bosses = { image: {}, frames, eyes: { [frameName(3, 5, 0)]: [[30, 20]] }, lamps: { [frameName(3, 5, 0)]: [[34, 26]] } };
  let drawn = 0;
  for (const [what, n] of STATES) {
    B.stageAs(game, 3, what, n);
    calls = 0;
    const ox = game.cam.x - game.W / 2, oy = game.cam.y - (game.H - 44) / 2;
    try { B.draw(game, ctx, ox, oy); B.signs(game, ctx, ox, oy); B.glow(game, ctx, ox, oy); game.render(); } catch (e) { check(false, `drawing a lord ${what} threw ${e.message}`); }
    if (calls) drawn++;
  }
  check(drawn === STATES.length, `with a bosses sheet only ${drawn} of ${STATES.length} states drew anything`);
  if (had) sheets.bosses = had; else delete sheets.bosses;
}

// ---- 5. fairness at 160x284
for (const b of LORDS) {
  const game = await atLair(b, { seed: 7, hull: false }), B = game.fauna.bosses;
  game.resize(160, 284, 1);
  check(game.W === 160 && game.H === 284, `the screen is ${game.W}x${game.H}`);
  const steer = thumb(game, b, random(99 + b), 10), tells = [], hits = [], landed = [];
  const inView = (x, y) => { const px = x * 16 - game.cam.x + game.W / 2, py = y * 16 - game.cam.y + (game.H - 44) / 2; return px >= NARROW.margin && px <= game.W - NARROW.margin && py >= NARROW.margin && py <= game.H - 44 - NARROW.margin; };
  B.onTell = (lord, what, x, y, ex, ey) => {
    tells.push({ what, at: game.time, stage: B.stage[lord] });
    const ok = what === 'icefall' ? [0, 1, 2].every(k => inView(B.fallX[lord * 3 + k], B.fallY[lord * 3 + k])) : inView(x, y) && inView(ex, ey);
    check(ok, `the ${NAMES[b]}'s ${what} at stage ${B.stage[lord]} began off the screen: ${(x - C).toFixed(1)},${(y - C).toFixed(1)} to ${(ex - C).toFixed(1)},${(ey - C).toFixed(1)}, the camera at ${(game.cam.x / 16 - C).toFixed(1)},${(game.cam.y / 16 - C).toFixed(1)}`);
  };
  const deed = game.fauna.deed.bind(game.fauna);
  game.fauna.deed = (g, what, a, c) => { const done = deed(g, what, a, c); if (what === 'hit' && done) hits.push({ at: game.time, stun: a }); return done; };
  const hit = game.hit.bind(game);
  game.hit = time => { const ok = hit(time); if (ok) landed.push(game.time); return ok; };
  for (let stage = 1; stage <= 3; stage++) {
    B.stageAs(game, b, 'sunk', stage);
    run(game, 40 * 60, steer);
  }
  for (const h of hits) {
    const kind = h.stun === ICEFALL.stun ? 'icefall' : 'breath', told = tells.filter(t => t.what === kind && t.at <= h.at + 1e-9).pop();
    check(told && h.at - told.at >= LEAST_TELL - 1e-6, `a hit by the ${NAMES[b]}'s ${kind} landed ${told ? (h.at - told.at).toFixed(2) : 'with no'} seconds after its tell`);
  }
  for (let n = 1; n < landed.length; n++) check(landed[n] - landed[n - 1] >= SHIELD - 1e-6, `two hits landed ${(landed[n] - landed[n - 1]).toFixed(2)} seconds apart`);
  const first = tells.filter(t => t.stage === 1 && t.what === 'breath');
  for (let n = 1; n < first.length; n++) check(first[n].at - first[n - 1].at >= 4.5, `at the first stage the ${NAMES[b]}'s attacks came ${(first[n].at - first[n - 1].at).toFixed(2)} seconds apart`);
  check(BOSS[b].tell.every(s => s >= LEAST_TELL) && ICEFALL.tell >= LEAST_TELL, `a tell of the ${NAMES[b]}'s is shorter than ${LEAST_TELL}`);
  check(tells.filter(t => t.stage === 1).length >= 4 && tells.filter(t => t.stage === 3).length >= 4 && tells.some(t => t.what === 'icefall'), `the ${NAMES[b]}'s fight told only ${tells.map(t => `${t.what}@${t.stage}`).join(' ')}`);
  check(hits.length >= 3, `the ${NAMES[b]}'s fight hit the drill only ${hits.length} times in 120 seconds`);
}

// ---- 6. surfacing
for (const b of LORDS) for (const seed of [1, 7, 11, 23, 123456]) {
  const game = await makeGame(seed, { tether: 9, drill: 4, hull: 4 }, { fauna: true, hull: true }), B = game.fauna.bosses;
  Math.random = random(seed);
  const at = openNearLair(game, b);
  if (!at) { check(false, `world ${seed} has no open ground near the ${NAMES[b]}'s lair`); continue; }
  farStart(game, at[0], at[1]); game.world.see(C + at[0], C + at[1], 10); game.changed();
  const woke = until(game, () => B.st[b] !== ST.SLEEP, 60 * 3);
  const rose = until(game, () => B.up(b), 60 * 5);
  check(woke >= 0, `on world ${seed} the ${NAMES[b]}'s lord never woke with the drill at ${at}`);
  check(rose >= 0 && B.inView(game, B.x[b], B.y[b]), `on world ${seed} the ${NAMES[b]}'s lord did not rise within 5 seconds of waking with the drill at ${at} (state ${B.st[b]})`);
}

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : `ok: the lords lie ${LAIR} out on their axes; tame they change nothing, and their bounds hold; they draw nothing with no sheet; every tell begins on the narrowest screen and every hit comes ${LEAST_TELL} s and more after its tell; each rises within 5 s on five worlds (${LORDS.map(b => NAMES[b]).join(', ')})`);
process.exit(fails.length ? 1 : 0);
