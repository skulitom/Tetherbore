// Coming home with a long tether wound round something nobody knew was loose, most of its bends on held ground
// (F21, F19). A stair of a corridor leads from the core to a hollow; in the hollow stands a comb of rock whose outline
// is too long to be found where the tether first meets it; the drill flies out, right round the comb, and home the
// way it came. The old search flooded the ground from every bend, the mainland from each corner of the stair.
// Fails when the comb is not reeled in on that homecoming, or when the frame it comes home in looks at more than
// 50,000 cells of ground (the old game: three times that here, and it left its bends on the stair for good).
//   node test/regress/g-homecoming-held.mjs
import { makeGame, tetherFaults, K, C, at, rect, arena, fixRandom, flyTo, idle, where } from './lib/lasso.mjs';

fixRandom(3);
const game = await makeGame(7, { tether: 6, drill: 4, momentum: 2 });
const w = game.world, R = 190;
arena(game, R);
// The stair: 12 steps of 12 east and 12 south, three wide, from the core to the hollow's corner.
const pts = [[0, 0]];
for (let n = 1; n <= 12; n++) pts.push([n * 12, (n - 1) * 12], [n * 12, n * 12]);
for (let n = 1; n < pts.length; n++) rect(game, Math.min(pts[n - 1][0], pts[n][0]) - 1, Math.min(pts[n - 1][1], pts[n][1]) - 1, Math.max(pts[n - 1][0], pts[n][0]) + 1, Math.max(pts[n - 1][1], pts[n][1]) + 1, K.EMPTY);
// The hollow, and in it the comb: a back along the top with thirteen teeth hanging from it. Its outline is some 760
// sides: more than is walked for a bend the tether has just taken up, well within what is walked at home.
const hx = 144, hy = 144;
rect(game, hx - 2, hy - 2, hx + 33, hy + 37, K.EMPTY);
rect(game, hx + 3, hy + 3, hx + 27, hy + 3, K.DENSE);
for (let t = 0; t < 13; t++) rect(game, hx + 3 + t * 2, hy + 4, hx + 3 + t * 2, hy + 32, K.DENSE);
game.changed();
let comb = 0; for (let y = hy; y <= hy + 35; y++) for (let x = hx; x <= hx + 31; x++) if (w.k(at(x, y)) !== K.EMPTY) comb++;

let looked = 0;
const kind = w.k; w.k = function (i) { looked++; return kind.call(this, i); };
// (Ground is also read straight from the world's pieces, when a piece is followed and when the tether sweeps: counted too.)
const follow = w.follow; w.follow = function (...a) { const n = this.followed; try { return follow.apply(this, a); } finally { looked += this.followed - n; } };
const sweep = game.catchIn; game.catchIn = function (...a) { const n = this.swept; try { return sweep.apply(this, a); } finally { looked += this.swept - n; } };
const faults = new Set();
const fly = (x, y, tol = 0.25) => { if (flyTo(game, x, y, { frames: 20000, tol, each: () => { for (const f of tetherFaults(game)) faults.add(f.replace(/[-\d.(),]+/g, '#')); } }) < 0) throw new Error(`never reached ${x},${y} from ${where(game)}`); };
for (const [x, y] of pts.slice(1)) fly(x, y);
for (const [x, y] of [[hx - 1, hy - 1], [hx + 31, hy - 1], [hx + 31, hy + 35], [hx - 1, hy + 35], [hx - 1, hy - 1]]) fly(x, y);
const knownOutThere = game.pieces.length, haulsOutThere = game.S.stats.hauls;
for (const [x, y] of pts.slice(1, -1).reverse()) fly(x, y);
const bends = game.band.length - 2, hauls = game.S.stats.hauls;
// The last stretch home, a frame at a time, counting what each frame looks at.
let most = 0, mostMs = 0;
for (let f = 0; f < 3000 && game.far > 0.05; f++) {
  const d = game.drill, far = game.far;
  game.input.auto = [(C + 0.5 - d.x) / far, (C + 0.5 - d.y) / far, 1];
  const l0 = looked, t0 = performance.now();
  game.update(1 / 60);
  most = Math.max(most, looked - l0); mostMs = Math.max(mostMs, performance.now() - t0);
}
idle(game, 1);
let left = 0; for (let y = hy; y <= hy + 35; y++) for (let x = hx; x <= hx + 31; x++) if (w.k(at(x, y)) !== K.EMPTY) left++;
console.log(JSON.stringify({ combCells: comb, knownLooseOutThere: knownOutThere, hauledOutThere: haulsOutThere, bendsComingHome: bends, haulsAtHome: game.S.stats.hauls - hauls, combCellsLeft: left,
  mostCellsLookedAtInAFrameComingHome: most, thatFrameMs: +mostMs.toFixed(1), bendsAfter: game.band.length - 2, faults: [...faults] }));
const bad = left > 0 || most > 50000 || game.band.length > 2 || faults.size > 0;
console.log(bad ? 'DEFECT: the homecoming did not reel the comb in, or looked at too much ground to do it' : 'no defect');
process.exit(bad ? 1 : 0);
