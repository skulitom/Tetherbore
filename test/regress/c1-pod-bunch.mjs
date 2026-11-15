// Spore pods that hang together go off together (docs/CONTENT-PLAN.md, content item 1: sporefall's bunches, "one
// nick is a chain of clouds"). A pod that bursts sets off the pods round it, side by side or corner to corner, a
// moment later, and those the pods round them: so a cut beside one pod of a bunch takes the whole bunch, one after
// another, and leaves a pod that is not joined to it asleep. The glow of the cut says so before it is made: it
// holds every pod of the bunch and what they leave hanging.
//   node test/regress/c1-pod-bunch.mjs
import { makeGame, world, tetherFaults } from '../harness.mjs';
import { arena, rect, at, idle, fixRandom } from './lib/lasso.mjs';
const { K, B } = world;

fixRandom(6);
const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };

for (const ground of [22, B.MIRE]) {
  const game = await makeGame(7), w = game.world, name = world.BIOMES[ground].name;
  arena(game, 30, K.SOFT, ground);
  // A bunch: four pods, the last two joined to the rest only across corners. A pod two cells off is not of it.
  // A block hangs in a cavern by the bunch's last pod alone.
  const bunch = [at(10, 0), at(11, 0), at(12, 1), at(13, 2)], apart = at(16, 2), far = at(10, -6);
  for (const i of [...bunch, apart, far]) w.setK(i, K.HAZARD);
  rect(game, 12, 3, 20, 12, K.EMPTY);
  rect(game, 13, 3, 13, 5, K.SOFT);
  const block = [at(13, 3), at(13, 4), at(13, 5)];
  game.changed();

  // The glow of a cut beside the first pod.
  game.foresee(at(9, 0));
  const glow = new Set(game.preview.flatMap(p => p.cells));
  check(block.every(i => glow.has(i)), `${name}: the glow of a cut beside a bunch does not hold the block that hangs by the bunch's last pod`);
  check(!glow.has(apart) && !glow.has(far), `${name}: the glow holds a pod that is not of the bunch`);
  check(game.bunch(bunch[0]).length === 4 && bunch.every(i => game.bunch(bunch[0]).includes(i)) && game.bunch(apart).length === 1, `${name}: the bunch of the first pod is ${game.bunch(bunch[0]).map(i => i - at(0, 0))}`);

  // The cut.
  game.finishDig(at(9, 0));
  const burst = () => bunch.map(i => w.k(i) === K.EMPTY ? 1 : 0).join('');
  check(burst() === '1000', `${name}: on the cut the pods burst are ${burst()}, not the first alone`);
  const order = [];
  idle(game, 1, f => { const now = burst(); if (order[order.length - 1] !== now) order.push(now); });
  check(order.join() === '1000,1100,1110,1111', `${name}: the bunch went off as ${order.join(' ')}, not a pod at a time down the bunch`);
  check(w.k(apart) === K.HAZARD && w.k(far) === K.HAZARD, `${name}: a pod that is not of the bunch burst with it`);
  check(game.clouds.length === 4, `${name}: ${game.clouds.length} clouds hang, not four`);
  check(game.pieces.some(cells => block.every(i => cells.includes(i))) || game.S.stats.hauls > 0, `${name}: the block that hung by the last pod is not known to be loose`);
  check(!tetherFaults(game).length, `${name}: the tether after the bunch: ${tetherFaults(game).join('; ')}`);
  // Moss closes round each cloud and the game goes on.
  idle(game, 7);
  check(game.clouds.length === 0 && bunch.every(i => w.k(i) === K.SOFT), `${name}: seven seconds on, ${game.clouds.length} clouds hang and the pods' cells are ${bunch.map(i => w.k(i))}`);
  check(w.k(apart) === K.HAZARD, `${name}: the pod apart did not outlast the moss`);
}

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: one cut takes a whole bunch of pods, a pod at a time, and the glow says so first');
process.exit(fails.length ? 1 : 0);
