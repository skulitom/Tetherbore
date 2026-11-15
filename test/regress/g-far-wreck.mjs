// A far wreck fetched along a staircase corridor (as if dug before): out, right round the wreck, and home the same
// way. How long does the frame of the homecoming take, and why?
//   node test/hunt/lasso/far-wreck.mjs [seed] [which wreck] [cells per stair]
import { makeGame } from '../harness.mjs';
import { fixRandom, flyTo, idle, where, bandRel, at, rect, C, N, K } from './lib/lasso.mjs';

const seed = Number(process.argv[2] ?? 7), which = Number(process.argv[3] ?? 5), stair = Number(process.argv[4] ?? 60);
fixRandom(6);
const game = await makeGame(seed, { tether: 9, drill: 4, momentum: 4 });
const w = game.world, [ax, ay] = w.wrecks[which], wx = ax - C, wy = ay - C, sx = Math.sign(wx) || 1, sy = Math.sign(wy) || 1;
// The corridor: stairs toward the hollow's near corner, then straight in.
const ex = wx - sx * 2, ey = wy - sy * 2, pts = [[0, 0]];
const steps = Math.max(1, Math.round(Math.max(Math.abs(ex), Math.abs(ey)) / stair));
for (let n = 1; n <= steps; n++) { const x = Math.round(ex * n / steps), y = Math.round(ey * n / steps), [px, py] = pts[pts.length - 1]; pts.push([x, py], [x, y]); }
for (let n = 1; n < pts.length; n++) rect(game, Math.min(pts[n - 1][0], pts[n][0]), Math.min(pts[n - 1][1], pts[n][1]), Math.max(pts[n - 1][0], pts[n][0]), Math.max(pts[n - 1][1], pts[n][1]), K.EMPTY);
rect(game, -2, -2, 2, 2, K.EMPTY);
game.changed();
let calls = 0, inside = 0, cellsFlooded = 0;
const real = w.pieceIn.bind(w);
w.pieceIn = (...a) => { const t = performance.now(), r = real(...a); inside += performance.now() - t; calls++; return r; };
let worst = 0, worstAt = '', frame = 0, phase = 'out';
const each = () => {};
const fly = (x, y, tol = 0.2) => { const d = game.drill, tx = C + x + 0.5, ty = C + y + 0.5;
  for (let f = 0; f < 40000; f++) { const dx = tx - d.x, dy = ty - d.y, far = Math.hypot(dx, dy); if (far < tol && d.mode === 'free') return; game.input.auto = [dx / far, dy / far, far > 3 ? 1 : Math.max(0.55, far / 3)];
    const t = performance.now(); game.update(1 / 60); const ms = performance.now() - t; frame++; if (ms > worst) { worst = ms; worstAt = `${phase}, frame ${frame}, drill ${where(game)}, hauls ${game.S.stats.hauls}`; } }
  throw new Error(`never reached ${x},${y} from ${where(game)} (${phase})`); };
for (const [x, y] of pts.slice(1)) fly(x, y);
phase = 'round the wreck';
for (const [x, y] of [[wx - sx * 2, wy + sy * 2], [wx + sx * 2, wy + sy * 2], [wx + sx * 2, wy - sy * 2], [ex, ey]]) fly(x, y);
const outWorst = worst, outAt = worstAt; worst = 0; phase = 'back';
for (const [x, y] of pts.slice(1, -1).reverse()) fly(x, y);
const bendsNearHome = game.band.length - 2, callsBefore = calls, insideBefore = inside;
const backWorst = worst, backAt = worstAt; worst = 0; phase = 'homecoming';
fly(0, 0, 0.05);
game.input.auto = null; for (let f = 0; f < 30; f++) { const t = performance.now(); game.update(1 / 60); worst = Math.max(worst, performance.now() - t); }
const first = Math.round(worst), firstCalls = calls - callsBefore, firstInside = Math.round(inside - insideBefore), partFirst = game.S.wrecks[which], haulsFirst = game.S.stats.hauls;
// Later: three ordinary short hops out of the core and back.
const again = [];
for (let n = 0; n < 3; n++) {
  for (let f = 0; f < 120; f++) game.update(1 / 60);
  phase = 'hop out'; fly(-sx * 2, 0, 0.3); game.input.auto = null; for (let f = 0; f < 20; f++) game.update(1 / 60);
  worst = 0; phase = 'hop home'; const c0 = calls; fly(0, 0, 0.05); game.input.auto = null;
  again.push({ worstFrameMs: Math.round(worst), pieceInCalls: calls - c0, bends: game.band.length - 2 });
}
worst = first;
console.log(JSON.stringify({ laterHopsOutAndHome: again, partAfterHops: game.S.wrecks[which] }));
console.log(JSON.stringify({ seed, wreck: [wx, wy], corners: pts.length - 2, framesFlown: frame, worstFrameGoingOutMs: Math.round(outWorst), worstFrameComingBackMs: Math.round(backWorst),
  bendsOnTheTetherNearHome: bendsNearHome, worstHomecomingFrameMs: Math.round(worst), at: worstAt, pieceInCalls: firstCalls, msInsidePieceIn: firstInside, partHeld: partFirst, hauls: haulsFirst, tetherPointsAfter: game.band.length }));
