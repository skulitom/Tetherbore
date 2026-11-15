// The drill's lamp is steady. Flying down an open tunnel, the light where the drill is never jumps: the light is
// not made again from black as the view scrolls (it was, whenever the view came to span a cell more or fewer, and
// the light under the drill fell to a third and climbed back many times a second), it does not pulse as the
// drill crosses from cell to cell, and the lamp is no brighter while the bit cuts. The light eases by the time that has passed, so
// it is the same at thirty frames a second as at a hundred and twenty.
import { makeGame, K, N, C } from '../harness.mjs';

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
// The light where the drill is: between the middles of the four cells about it, as the dark is drawn (one value
// a cell, smoothed).
const under = game => {
  const L = game.lightMap, d = game.drill, fx = d.x - 0.5 - L.x0, fy = d.y - 0.5 - L.y0, x = Math.floor(fx), y = Math.floor(fy), u = fx - x, v = fy - y;
  const at = (cx, cy) => Math.min(1, L.lit[cy * L.cols + cx]);
  return at(x, y) * (1 - u) * (1 - v) + at(x + 1, y) * u * (1 - v) + at(x, y + 1) * (1 - u) * v + at(x + 1, y + 1) * u * v;
};
const tunnel = async rate => {
  const game = await makeGame(7, { tether: 4 }), w = game.world, d = game.drill;
  game.resize(360, 640, 1);
  // A tunnel three cells high, running east from the core, seen.
  for (let x = 2; x <= 70; x++) { for (let y = -1; y <= 1; y++) w.setK((C + y) * N + C + x, K.EMPTY); w.see(C + x, C, 2); }
  // (The drill is set down in the tunnel: from the core itself a stroke straight out is a throw, far faster than flight.)
  d.x = d.px = C + 5.5; d.y = d.py = C + 0.5; d.home = false; game.band = [[d.x, d.y], [C + 0.5, C + 0.5]];
  game.changed(); game.version++;
  const seen = [];
  game.input.auto = [1, 0, 1];
  for (let f = 0; f < 5 * rate; f++) { game.update(1 / rate); game.render(); if (game.drill.x > C + 14 && game.drill.x < C + 62) seen.push(under(game)); }
  game.input.auto = null;
  return { game, seen, least: Math.min(...seen), most: Math.max(...seen) };
};

for (const rate of [30, 60, 120]) {
  const { seen, least, most, game } = await tunnel(rate);
  check(seen.length > rate && game.drill.x > C + 20, `at ${rate} frames a second the drill flew to ${(game.drill.x - C).toFixed(0)} and the light was read ${seen.length} times`);
  // (The light trails the drill a little, and more as the drill gathers speed: it may fall slowly, never jump.)
  const jump = Math.max(...seen.slice(1).map((l, n) => Math.abs(l - seen[n]))) * rate / 60;
  check(least > 0.88 && jump < 0.012, `at ${rate} frames a second the light under the drill ran from ${least.toFixed(3)} to ${most.toFixed(3)} down an open tunnel, and changed by as much as ${jump.toFixed(4)} in a sixtieth of a second`);
}

// Cutting: the lamp's own power is the same with the bit in rock as out of it (the light at the middle of the
// drill's own cell, settled, is full either way).
{
  const game = await makeGame(7, { drill: 2 });
  game.resize(360, 640, 1);
  const own = () => { const L = game.lightMap, d = game.drill; return L.want[(Math.floor(d.y) - L.y0) * L.cols + Math.floor(d.x) - L.x0]; };
  game.input.auto = [0, 1, 1];
  let cutting = 0, least = 9, most = 0;
  for (let f = 0; f < 240; f++) { game.update(1 / 60); game.render(); const p = own(); least = Math.min(least, p); most = Math.max(most, p); if (game.drill.dig >= 0) cutting++; }
  check(cutting > 30 && cutting < 240 && least >= 1 && most <= 1.1 + 1e-6, `cutting south for four seconds (${cutting} frames with the bit in rock) the lamp lit its own cell from ${least.toFixed(3)} to ${most.toFixed(3)}`);
}

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : 'no defect: the light under the drill is steady down a tunnel, at any frame rate, and the lamp is no brighter for cutting');
process.exit(fails.length ? 1 : 0);
