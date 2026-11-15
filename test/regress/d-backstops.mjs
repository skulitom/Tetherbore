// Item D has three guards, and the first (nothing closes on the line of a throw) hides the other two from the
// hunters' scripts. Here ground is shut by hand, past that guard, to see each of the others work alone:
//   1. a throw whose way is shut while it is in the air stops at the last free place, short of the rock;
//   2. a free drill whose own cell has become rock opens it and can fly on;
//   3. with the shop open the frost's clock stands still: a cut 20 s old when the shop opens is no nearer icing
//      over after a minute in the shop.
//   node test/regress/d-backstops.mjs
import { makeGame, tetherFaults, C, N, K, B } from '../harness.mjs';
const at = (x, y) => (C + y) * N + C + x, dt = 1 / 60;
const problems = [];

async function shaft() {
  const game = await makeGame(7, { tether: 5, drill: 4 });
  const w = game.world;
  // A shaft east from the core, three wide and 60 long, in plain soft ground.
  for (let x = 3; x <= 80; x++) for (let y = -6; y <= 6; y++) { w.setK(at(x, y), x <= 60 && Math.abs(y) <= 1 ? K.EMPTY : K.SOFT); w.setB(at(x, y), B.CRUST); }
  game.changed();
  return game;
}

// 1. The way shuts in mid-throw.
{
  const game = await shaft(), d = game.drill, w = game.world;
  d.armed = true; game.input.auto = [1, 0, 1];
  game.update(dt);
  if (d.mode !== 'fling') problems.push(`1: the drill was not thrown (mode ${d.mode})`);
  // A wall across the whole shaft, well ahead of the drill and short of where it was to land.
  const wall = Math.floor(d.x - C) + 12;
  for (let y = -1; y <= 1; y++) w.setK(at(wall, y), K.ICE);
  let frames = 0;
  while (d.mode === 'fling' && frames++ < 600) { game.update(dt); for (const fault of tetherFaults(game)) problems.push(`1: in flight: ${fault}`); }
  const dx = d.x - C;
  console.log(`1. thrown east with a wall grown across the shaft at ${wall}: stopped at ${dx.toFixed(2)}, mode ${d.mode}, body free ${game.free(d.x, d.y)}, own cell ${w.k(game.di) === K.EMPTY ? 'open' : 'ROCK'}`);
  if (d.mode !== 'free' || dx >= wall || !game.free(d.x, d.y) || w.k(game.di) !== K.EMPTY) problems.push('1: the throw did not stop at the last free place before the wall');
  if (dx < wall - 1.5) problems.push(`1: the throw stopped ${(wall - dx).toFixed(2)} cells short of the wall, not at the last free place`);
}

// 2. The drill's own cell is rock.
{
  const game = await shaft(), d = game.drill, w = game.world;
  d.x = C + 30.5; d.y = C + 0.5; d.mode = 'free';
  game.band = [[d.x, d.y], [C + 0.5, C + 0.5]];
  game.changed();
  // Frozen in: its own cell and all round it but the way the tether lies (ground does not close on the tether).
  for (let y = -1; y <= 1; y++) for (let x = 30; x <= 31; x++) w.setK(at(x, y), K.ICE);
  game.input.auto = null; game.update(dt);
  const opened = w.k(game.di) === K.EMPTY, x0 = d.x, y0 = d.y;
  let moved = 0;
  for (const [ix, iy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let f = 0; f < 120; f++) { game.input.auto = [ix, iy, 1]; game.update(dt); moved = Math.max(moved, Math.hypot(d.x - x0, d.y - y0)); for (const fault of tetherFaults(game)) problems.push(`2: ${fault}`); }
  console.log(`2. frozen in where it stood: own cell ${opened ? 'opened' : 'still ROCK'} on the next frame; steered four ways it moved ${moved.toFixed(2)} cells at most`);
  if (!opened || moved < 1) problems.push('2: a drill whose own cell is rock stayed stuck');
}

// 3. The shop stops the frost's clock.
{
  const game = await makeGame(7, { tether: 5, drill: 4 }), d = game.drill, w = game.world;
  // A shaft north from the core into ground made frost, and the drill cuts three cells off the side of it by hand.
  for (let y = 3; y <= 20; y++) for (let x = -5; x <= 5; x++) { w.setK(at(x, -y), x === 0 ? K.EMPTY : K.SOFT); w.setB(at(x, -y), B.FROST); }
  d.x = C + 0.5; d.y = C - 10 + 0.5; d.mode = 'free';
  game.band = [[d.x, d.y], [C + 0.5, C + 0.5]];
  game.changed();
  for (let f = 0; f < 400 && game.frostOpen.length < 3; f++) { game.input.auto = [1, 0, 1]; game.update(dt); }
  const cut = game.frostOpen.slice(), still = () => cut.filter(i => w.k(i) === K.EMPTY).length;
  if (cut.length < 3) problems.push(`3: only ${cut.length} frost cells were cut`);
  // Home, wait until the cuts are 20 s old, then a minute in the shop.
  for (let f = 0; f < 3000 && game.far > 0.05; f++) { const dx = C + 0.5 - d.x, dy = C + 0.5 - d.y, far = Math.hypot(dx, dy) || 1; game.input.auto = Math.abs(d.x - C - 0.5) > 0.1 && d.y < C - 3 ? [dx > 0 ? 1 : -1, 0, 1] : [dx / far, dy / far, 1]; game.update(dt); }
  game.input.auto = null;
  for (let f = 0; f < 20 * 60; f++) game.update(dt);
  const before = still();
  game.shop = true;
  for (let f = 0; f < 60 * 60; f++) game.update(dt);
  game.shop = false;
  for (let f = 0; f < 60; f++) game.update(dt);              // a second after the shop shuts: nothing may be due yet
  const after = still();
  for (let f = 0; f < 30 * 60; f++) game.update(dt);         // and it does ice over once its own 30 s have run
  console.log(`3. cut ${cut.length} frost cells, home at ${game.far.toFixed(2)}; open before the shop ${before}, a second after a minute in the shop ${after}, half a minute later ${still()}`);
  if (before !== cut.length || after !== cut.length) problems.push('3: frost cuts came due behind the open shop');
  if (still() !== 0) problems.push('3: the frost never closed the cuts at all');
}

if (problems.length) { console.log('DEFECT\n' + [...new Set(problems)].slice(0, 12).join('\n')); process.exit(1); }
console.log('no defect');
