// Times game.update over the rope fuzz's own flight: the mean frame, the worst, and how many ran over 16 ms. The
// rubble of hauls on their way home (updateHauls) is most of an ordinary frame and depends on what happens to be
// hauled, so the same figures are given without it as well: that is the part a change to the tether or the ground
// can make slower.
//   node test/frame-time.mjs [seed] [turns] [reach level] [start x] [start y]
// The flight is the one test/rope-fuzz.mjs flies (same steering from the same seed), with no checks between frames,
// so what is timed is the game alone. Run it by itself: another busy process makes the worst frame meaningless.
// The rubble's own throws and dust are drawn from Math.random, so that is seeded too (from the seed, as
// tools/long-play.mjs seeds it): the same arguments time the same heap of rubble every run.
//   --hash   also print a hash of where every bit of rubble was after every frame (harness.mjs: rubbleHash), taken
//            outside the timing: a change to updateHauls that gives the same hash on these flights moved no bit.
//   --draw   every row of the shop at its last level, and every frame drawn too (with the tether's canvas there),
//            the drawing timed apart and by its parts (`Game.timed`): what the upgrades show is `fit`. The canvas
//            here swallows every call, so this is the work of the drawing and not what the browser does with it.
//   --fauna  the game with its creatures (js/fauna.js), and as many as there may be (FAUNA) kept about the drill,
//            one of every kind set down beside it in turn: what they do is timed with the frame, and what is drawn
//            of them is the part `fauna`. And a lord at the ends (js/bosses.js) at its last stage kept up beside the
//            drill, the four in turn, each raised telling in open ground on the narrowest screen whenever none is up:
//            it fights about the drill there until it sinks, is leashed (it is far from its lair) and is raised again.
//            What it does is timed with the frame, and what is drawn of it is in the part `fauna` too (`lords`: how
//            many were raised; `lordUp`: in what share of the frames one was up).
import { makeGame, random, rubbleHash, farStart, wander, UPGRADES, WORKS, MAPS, CORE, N, K } from './harness.mjs';

const args = process.argv.slice(2), digest = args.includes('--hash') ? rubbleHash() : null, drawn = args.includes('--draw'), crowd = args.includes('--fauna');
const [seed = 11, turns = 600, reach = 5, sx = 0, sy = 0] = args.filter(a => !a.startsWith('--')).map(Number);
Math.random = random(seed + 5);
const game = await makeGame(seed, { tether: reach, drill: 4 }, { fauna: crowd });
const KINDS = ['bat', 'moth', 'bee', 'leech', 'spitter', 'puff', 'skink', 'frog', 'beetle', 'jelly', 'salamander', 'wren', 'newt', 'pup', 'rimeling', 'emberling', 'mireling', 'lodeling'];
let most = 0, lord = 0, lords = 0, lordUp = 0;
// An open cell seen three to six cells from the drill, on the narrowest screen, for a lord to be raised in (or -1).
const lordCell = () => {
  const B = game.fauna.bosses, d = game.drill, w = game.world;
  for (let r = 3; r <= 6; r++) for (let a = 0; a < 16; a++) {
    const x = Math.floor(d.x + Math.cos(a * Math.PI / 8) * r), y = Math.floor(d.y + Math.sin(a * Math.PI / 8) * r);
    if (w.peek(x, y) === K.EMPTY && B.inView(game, x + 0.5, y + 0.5)) return y * N + x;
  }
  return -1;
};
if (drawn) {
  for (const u of [...UPGRADES, ...WORKS, ...MAPS, ...CORE]) if (u.id !== 'tether') game.S.lv[u.id] = u.values.length - 1;
  game.over = document.createElement('canvas'); game.overCtx = game.over.getContext('2d'); game.resize(360, 640, 1);
}
let draw = 0, parts = {};
if (sx || sy) farStart(game, sx, sy);
let frames = 0, total = 0, worst = 0, worstAt = 0, over = 0, rubble = 0, bare = 0, bareWorst = 0, bareWorstAt = 0, bareOver = 0;
const hauls = game.updateHauls.bind(game);
game.updateHauls = dt => { const t = performance.now(); hauls(dt); rubble += performance.now() - t; };
for (const auto of wander(random(seed), turns)) {
  game.input.auto = auto;
  if (crowd && frames % 20 === 0 && game.fauna.alive < 16) game.fauna.stage(game, KINDS[(frames / 20) % KINDS.length], 8);
  if (crowd) most = Math.max(most, game.fauna.alive);
  const up = crowd && [0, 1, 2, 3].some(b => game.fauna.bosses.up(b));
  if (up) lordUp++;
  if (crowd && frames % 30 === 0 && !up) {
    const c = lordCell();
    if (c >= 0) { game.fauna.bosses.stageAs(game, lord, 'tell', 3, c); lord = (lord + 1) % 4; lords++; }
  }
  rubble = 0;
  const t = performance.now();
  game.update(1 / 60);
  const ms = performance.now() - t, rest = ms - rubble;
  frames++; total += ms; bare += rest;
  if (rest > bareWorst) { bareWorst = rest; bareWorstAt = frames; }
  if (rest > 16) bareOver++;
  if (ms > worst) { worst = ms; worstAt = frames; }
  if (ms > 16) over++;
  digest?.add(game);
  if (drawn) {
    // (The probe begun again as js/main.js begins it after each frame, so that it holds the drawing's parts alone.)
    game.frameTook(1000 / 60, 0, 0);
    const t0 = performance.now();
    game.render();
    draw += performance.now() - t0;
    for (const [name, ms] of Object.entries(game.probe)) if (ms) parts[name] = (parts[name] ?? 0) + ms;
  }
}
console.log(JSON.stringify({ seed, reach, start: [sx, sy], frames, meanMs: +(total / frames).toFixed(4), worstMs: +worst.toFixed(2), worstAt, over16: over,
  withoutRubble: { meanMs: +(bare / frames).toFixed(4), worstMs: +bareWorst.toFixed(2), worstAt: bareWorstAt, over16: bareOver }, hauls: game.S.stats.hauls, bends: game.band.length, ...digest && { hash: digest.hex },
  ...crowd && { creatures: most, lords, lordUp: +(lordUp / frames).toFixed(2) },
  ...drawn && { drawMs: +(draw / frames).toFixed(4), drawParts: Object.fromEntries(Object.entries(parts).map(([name, ms]) => [name, +(ms / frames).toFixed(4)])) } }));
