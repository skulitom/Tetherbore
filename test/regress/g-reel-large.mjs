// A large loose piece that the straight line home runs through (F18). Whether the tether is round it used to be
// asked of every cell of it against every point of the tether, several times a frame: 38 ms a call far out. A block
// 150 cells square is cut loose; the drill flies half way round it, so the line home passes through its middle and
// the half above that line is wound while the half below is not; then on round, and it must be reeled in.
// What is counted is how many times reelIfRound reads a point of the tether (two for each side of the string it tests
// a cell against), which is the work, whatever the machine. Fails over 20,000 reads in a call (the old game: over a
// hundred thousand), when the block is reeled in while only half wound, or when it is not reeled in once it is wound.
//   node test/regress/g-reel-large.mjs
import { makeGame, tetherFaults, K, at, rect, arena, fixRandom, flyTo, where } from './lib/lasso.mjs';

fixRandom(5);
const game = await makeGame(7, { tether: 6, drill: 4, momentum: 2, winch: 2 });   // (a winch that draws in a block of 22,500 cells)
const w = game.world, x0 = 20, x1 = 169, y0 = -75, y1 = 74;
arena(game, 200);
rect(game, 3, -1, x0 - 2, 1, K.EMPTY);                                   // a way out from the core
rect(game, x0 - 3, y0 - 3, x1 + 3, y1 + 3, K.EMPTY);                     // a moat three wide all round the block
rect(game, x0, y0, x1, y1, K.DENSE);
w.setK(at(95, y0 - 1), K.DENSE); w.setK(at(95, y0 - 2), K.DENSE); w.setK(at(95, y0 - 3), K.DENSE);      // held by a neck at the top
game.changed();
// The neck is cut as the drill would cut it: the block is loose, and the game knows it.
for (const y of [y0 - 3, y0 - 2, y0 - 1]) { w.setK(at(95, y), K.EMPTY); game.changed([at(95, y)]); }
const block = () => { let n = 0; for (let y = y0; y <= y1; y += 7) for (let x = x0; x <= x1; x += 7) if (w.k(at(x, y)) !== K.EMPTY) n++; return n; };
const whole = block();

// reelIfRound's own work, counted: every read of a point of the tether while it runs.
let reads = 0, calls = 0, most = 0;
const own = game.reelIfRound.bind(game);
game.reelIfRound = () => {
  const real = game.band, before = reads;
  game.band = new Proxy(real, { get(target, key, self) { if (typeof key === 'string' && key.charCodeAt(0) < 58) reads++; return Reflect.get(target, key, self); } });
  try { own(); } finally { if (game.band !== real && game.band.length === real.length) game.band = real; }
  calls++; most = Math.max(most, reads - before);
};
const faults = new Set();
const fly = (x, y) => { if (flyTo(game, x, y, { frames: 20000, each: () => { for (const f of tetherFaults(game)) faults.add(f.replace(/[-\d.(),]+/g, '#')); } }) < 0) throw new Error(`never reached ${x},${y} from ${where(game)}`); };
// West side, over the top, and half way down the east side: the line home now runs through the block's middle.
for (const [x, y] of [[x0 - 2, 0], [x0 - 2, y0 - 2], [x1 + 2, y0 - 2], [x1 + 2, 2]]) fly(x, y);
for (let f = 0; f < 120; f++) { game.input.auto = null; game.update(1 / 60); }
const half = { registered: game.pieces.map(p => p.length), blockLeft: block() === whole, hauls: game.S.stats.hauls, reelCalls: calls, mostReadsInACall: most, bends: game.band.length - 2 };
// On round: down the east side, along the bottom, and up the west side until it is wound.
for (const [x, y] of [[x1 + 2, y1 + 2], [x0 - 2, y1 + 2], [x0 - 2, 3]]) { if (block() === 0) break; fly(x, y); }
console.log(JSON.stringify({ halfWayRound: half, afterGoingRound: { blockCellsLeft: block(), hauls: game.S.stats.hauls, reelCalls: calls, mostReadsInACall: most }, faults: [...faults] }));
const bad = !half.blockLeft || half.registered.length !== 1 || most > 20000 || block() !== 0 || faults.size > 0;
console.log(bad ? 'DEFECT: reelIfRound asks about far more cells than the line home can divide, or reels the block wrongly' : 'no defect');
process.exit(bad ? 1 : 0);
