// A random flight far out, then straight home (cutting the way). Times the frame in which the drill docks: look()
// floods the ground at every bend the tether still has, each flood up to 400000 cells. Fails when look() on that
// frame looks at more than 300,000 cells of ground, or leaves a fault in the tether.
//   node test/regress/g-home-arrival.mjs [seed] [turns] [reach level] [start x] [start y]
import { makeGame, random, tetherFaults, C, N, K } from '../harness.mjs';
const [seed = 5, turns = 250, reach = 8, sx = 500, sy = 0] = process.argv.slice(2).map(Number);
const game = await makeGame(seed, { tether: reach, drill: 4, momentum: 4, scanner: 4 });
const d = game.drill, w = game.world, rnd = random(seed), dt = 1 / 60;
const len = Math.hypot(sx, sy);
for (let s = 0; s <= len; s += 0.5) for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) w.setK((C + Math.round(sy * s / len) + v) * N + C + Math.round(sx * s / len) + u, K.EMPTY);
d.x = C + sx + 0.5; d.y = C + sy + 0.5; d.mode = 'free';
game.band = [[d.x, d.y], [C + 0.5, C + 0.5]];
game.changed();
let lookMs = 0, floods = 0, looked = 0, lookCells = 0, dockCells = 0, frames = 0, heading = Math.atan2(sy, sx);
const kind = w.k; w.k = function (i) { looked++; return kind.call(this, i); };
// (Ground is also read straight from the world's pieces, when a piece is followed and when the tether sweeps: counted too.)
const follow = w.follow; w.follow = function (...a) { const n = this.followed; try { return follow.apply(this, a); } finally { looked += this.followed - n; } };
const sweep = game.catchIn; game.catchIn = function (...a) { const n = this.swept; try { return sweep.apply(this, a); } finally { looked += this.swept - n; } };
const look = game.look; game.look = function () { const t0 = performance.now(), l0 = looked; look.call(this); lookMs = performance.now() - t0; lookCells = Math.max(lookCells, looked - l0); };
const pieceIn = w.pieceIn; w.pieceIn = function (...a) { floods++; const got = pieceIn.apply(this, a); return got; };
for (let turn = 0; turn < turns; turn++) {
  heading += (rnd() - 0.5) * 2.5;
  const hold = 10 + Math.floor(rnd() * 50), pause = rnd() < 0.1;
  for (let f = 0; f < hold; f++) { game.input.auto = pause ? null : [Math.cos(heading), Math.sin(heading), 1]; game.update(dt); frames++; }
}
const out = game.far, bendsOut = game.band.length - 2;
let worst = 0, worstLook = 0, bendsAtDock = 0, homeFrames = 0, docked = false;
for (; homeFrames < 40000 && game.far > 0.05; homeFrames++) {
  const far = game.far, n0 = game.band.length - 2, was = d.home;
  // The heading is held for a third of a second at a time, as a thumb would hold it.
  if (homeFrames % 20 === 0 || far < 4) game.input.auto = [(C + 0.5 - d.x) / far, (C + 0.5 - d.y) / far, 1];
  lookCells = 0;
  const t0 = performance.now();
  game.update(dt);
  const t = performance.now() - t0;
  if (!was && d.home) { docked = true; bendsAtDock = n0; worstLook = lookMs; dockCells = lookCells; worst = t; }
}
console.log(JSON.stringify({ seed, reach: game.val('tether'), randomFrames: frames, cellsOutBeforeTurningHome: +out.toFixed(0), bendsBeforeTurningHome: bendsOut, framesFlyingHome: homeFrames, docked, bendsAtDock, cellsLookedAtByLookAtDock: dockCells, floodsInAll: floods, dockFrameMs: +worst.toFixed(1), lookMs: +worstLook.toFixed(1), bendsAfter: game.band.length - 2, hauls: game.S.stats.hauls, faults: tetherFaults(game).length }));
process.exit(!docked || dockCells > 300000 || tetherFaults(game).length ? 1 : 0);
