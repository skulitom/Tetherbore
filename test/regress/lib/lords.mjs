// Staging and driving helpers for the lords at the ends (js/bosses.js), shared by s9-bosses and s9-boss-play. Each
// lord whose fight is built (`ready`) is in LORDS; a test of one lord's verb adds its own part beside the others'.
import { makeGame, tunnel, setDown, random, C, N, K } from '../../harness.mjs';
import { BOSS, LAIR, ST, lairX, lairY } from '../../../js/bosses.js';
import { DX, DY } from '../../../js/world.js';
export { BOSS, LAIR, ST, lairX, lairY, DX, DY };

export const LORDS = BOSS.map((B, b) => B.ready ? b : -1).filter(b => b >= 0);
export const NAMES = ['east', 'south', 'west', 'north'];

// A game with its creatures (and its hull, unless `hull` is false), the reach at its last level and the drill
// set down free `short` cells short of lord `b`'s lair on its axis (and `side` cells across it), at the end of a
// straight tunnel from the core, the ground within `see` cells of it seen. (`first` is asked of the game before
// its first frame; `fix` makes Math.random a stream of the seed's.)
// (`dug`: the tunnel goes so many cells short of the lair, and the drill is set down in it `short` short.)
export async function atLair(b, { seed = 7, short = 8, dug = short, side = 0, hull = true, levels = {}, see = 12, fauna = true, first = null, fix = true } = {}) {
  const game = await makeGame(seed, { tether: 9, drill: 4, hull: 4, ...levels }, { fauna, hull });
  first?.(game);
  if (fix) Math.random = random(seed + 77);
  const off = r => [DX[b] * r - DY[b] * side, DY[b] * r + DX[b] * side], [tx, ty] = off(LAIR - dug), [sx, sy] = off(LAIR - short);
  tunnel(game, tx, ty); setDown(game, sx, sy); game.world.see(C + sx, C + sy, see); game.world.see(C + tx, C + ty, see); game.changed();
  game.update(1 / 60);
  return game;
}
// Frames, steered or not (`steer` a list [x, y, how hard], or a function of the frame giving one); `each` is asked
// after every frame and may say false to stop.
export function run(game, frames, steer = null, each = null) {
  for (let n = 0; n < frames; n++) {
    game.input.auto = typeof steer === 'function' ? steer(n) : steer;
    game.update(1 / 60);
    if (each?.(n) === false) return n;
  }
  game.input.auto = null;
  return frames;
}
// Frames until `cond` holds (at most `most`): how many were run, or -1.
export function until(game, cond, most = 60 * 30, steer = null) {
  for (let n = 0; n < most; n++) { if (cond()) return n; game.input.auto = typeof steer === 'function' ? steer(n) : steer; game.update(1 / 60); }
  return cond() ? most : -1;
}
// A band looped once round lord `b` where it is, `r` cells off it: from the drill out to the loop, round, and back to
// the drill on the way home (so it winds round the lord once wherever the drill and the core lie).
export function loopBand(game, b, r = 2) {
  const B = game.fauna.bosses, u = B.x[b], v = B.y[b], d = game.drill, band = [[d.x, d.y]];
  for (let k = 0; k <= 12; k++) band.push([u + Math.cos(k * Math.PI / 6) * r, v + Math.sin(k * Math.PI / 6) * r]);
  band.push([d.x, d.y], [C + 0.5, C + 0.5]);
  return band;
}
// That loop handed to the creatures as the game hands it them (`Fauna.wound`), and the band put back as it lay.
// Returns whether it was a blow. (A blow that thawed ice settled the loop on the ground left: the band put back is
// settled on it too, as it would have been.)
export function loopRound(game, b) {
  const B = game.fauna.bosses, band = game.band, blows = B.blows[b], version = game.version;
  game.band = loopBand(game, b);
  game.fauna.wound(game);
  game.band = band;
  if (game.version !== version) game.retighten();
  return B.blows[b] > blows;
}
// The drill flown into lord `b` where it is, as `Bosses.ram` is asked each frame of its rest: set `off` cells from its
// middle on the side the drill is, flying at `speed` cells a second toward it (or away from it, `away`), and put back
// as it was. Returns whether it was a blow.
export function ramInto(game, b, { speed = 6, off = 1, away = false } = {}) {
  const B = game.fauna.bosses, d = game.drill, was = [d.x, d.y, d.vx, d.vy], blows = B.blows[b];
  const a = Math.atan2(d.y - B.y[b], d.x - B.x[b]), ux = Math.cos(a), uy = Math.sin(a), v = away ? speed : -speed;
  d.x = B.x[b] + ux * off; d.y = B.y[b] + uy * off; d.vx = ux * v; d.vy = uy * v;
  B.ram(game, b);
  [d.x, d.y, d.vx, d.vy] = was;
  return B.blows[b] > blows;
}
// The cell lord `b`'s tendril is anchored in (or `cell`) cut, as `Game.finishDig` tells the creatures of a cut
// (`Bosses.crushed`), the cell itself left standing. Returns whether it was a blow.
export function cutAt(game, b, cell = game.fauna.bosses.anchor[b]) {
  const B = game.fauna.bosses, blows = B.blows[b];
  B.crushed(game, cell, cell >= 0 ? game.world.k(cell) : 0);
  return B.blows[b] > blows;
}
// Each lord's verb as a test lands it on a lord that is open to it: the north's a loop, the south's a ram, the
// west's a cut.
export const VERB = { 1: ramInto, 2: cutAt, 3: loopRound };
// The drill dodging every lash of the west's lord, as a drill stepped off her line does: her tendril never latches
// on (the deed refused), and goes on to the rock behind. Nothing for another lord.
const dodging = new WeakSet();
export function dodge(game, b) {
  if (BOSS[b].verb !== 'cut' || dodging.has(game)) return;
  const deed = game.fauna.deed.bind(game.fauna);
  game.fauna.deed = (g, what, a, c) => what === 'drag' ? false : deed(g, what, a, c);
  dodging.add(game);
}
// A lord fought to the end by its verb, landed each time it is open to it: whether it was beaten (its husk left).
// (The west's lashes dodged, so that she rests.)
export function beat(game, b, steer = null) {
  const B = game.fauna.bosses;
  dodge(game, b);
  for (let n = 0; n < 3; n++) {
    if (until(game, () => B.st[b] === ST.REST, 60 * 30, steer) < 0 || !VERB[b](game, b)) return false;
  }
  return until(game, () => B.st[b] === ST.GONE, 60 * 10, steer) >= 0;
}
// The band as it lies handed to the creatures (no loop round anything near the lair).
export const unwound = game => game.fauna.wound(game);
// A seeded thumb that wanders but is drawn back toward lord `b`'s lair when more than `keep` cells from it.
export function thumb(game, b, rnd, keep = 14) {
  let heading = rnd() * 6.283, hold = 0, pause = false;
  return () => {
    const d = game.drill, lx = lairX(b), ly = lairY(b), far = Math.hypot(d.x - lx, d.y - ly);
    if (hold-- <= 0) { heading += (rnd() - 0.5) * 2.5; hold = 10 + Math.floor(rnd() * 50); pause = rnd() < 0.15; }
    if (far > keep) return [(lx - d.x) / far, (ly - d.y) / far, 1];
    return pause ? null : [Math.cos(heading), Math.sin(heading), 1];
  };
}
// The nearest cell to lord `b`'s lair that the seed left open, found outward ring by ring (this makes pieces of the
// world, as a test may): its offset from the core, or null.
export function openNearLair(game, b, most = 60) {
  const w = game.world, lx = Math.floor(lairX(b)), ly = Math.floor(lairY(b));
  for (let r = 0; r <= most; r++) {
    let best = null, bestFar = Infinity;
    for (let y = ly - r; y <= ly + r; y++) for (let x = lx - r; x <= lx + r; x++) {
      if (Math.max(Math.abs(x - lx), Math.abs(y - ly)) !== r || w.k(y * N + x) !== K.EMPTY) continue;
      const far = Math.hypot(x - lx, y - ly);
      if (far < bestFar) { bestFar = far; best = [x - C, y - C]; }
    }
    if (best) return best;
  }
  return null;
}
