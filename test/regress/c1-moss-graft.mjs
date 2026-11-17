// The graft (js/game.js: `updateHazards`, where a cloud's moss closes; the spore drive's second level, js/shop.js).
// With it, moss that closes beside ore the world laid heals as that ore, as a cut in the north beside ore heals under
// the frost (`veined`); the rest of the cloud's moss is soft rock as ever, and moss beside ore that healed in play is
// soft rock too, so a graft cannot run on cell by cell. Staged in the west's own ground beside a cell of ore the
// world laid there, a pod two cells east of it in a hollow of nine cells, woken as a cut beside it wakes it:
//   - at the spore drive's second level the moss beside the ore heals as that ore, and the other seven cells as
//     soft rock, and the fitting is told (`fitter.fire('sporedrive')`);
//   - at its first level and with none, all eight are soft rock;
//   - beside ore laid by hand (ore that healed in play, as the world did not lay it), all eight are soft rock;
//   - the world laid there is as it was.
// Fails on the game before there was a graft: the moss beside the ore is soft rock.
//   node test/regress/c1-moss-graft.mjs
import { makeGame, world, C, N } from '../harness.mjs';
import { idle, fixRandom } from './lib/lasso.mjs';
const { K, B } = world;

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
fixRandom(8);
const kinds = (w, cells) => cells.map(i => world.KIND_NAMES[w.k(i)]).join(' ');

// The first cell of ore A the world laid in the west's own ground, a hundred cells or more from the core, with
// the west's ground and no pocket for three cells round it, and no other ore laid in the five cells east of it
// (where the hollow is to be, and round that): a cell of moss there that the world laid as ore would heal as ore
// beside the one healed before it, as a cut under the frost does, and that is not what is asked here.
const findOre = w => {
  for (let x = C - 110; x > C - 400; x--) for (let y = C - 60; y < C + 60; y++) {
    const i = y * N + x;
    if (w.b(i) !== B.MIRE || w.first(i) !== K.ORE_A || w.k(i) !== K.ORE_A) continue;
    let fit = true;
    for (let v = -3; v <= 3 && fit; v++) for (let u = -3; u <= 5 && fit; u++) {
      const j = i + v * N + u, laid = w.first(j);
      if (w.row(j).pocket !== null || w.b(j) !== B.MIRE || ((u || v) && (laid === K.ORE_A || laid === K.ORE_B))) fit = false;
    }
    if (fit) return i;
  }
  return -1;
};
const stage = async (drive, byHand = false) => {
  const game = await makeGame(7, { tether: 5, sporedrive: drive }), w = game.world;
  const ore = findOre(w);
  if (ore < 0) throw new Error('no ore of the west found to stage beside');
  // Round the ore, soft rock (no other ore beside the hollow); east of it the hollow, its middle a pod.
  for (let v = -2; v <= 2; v++) for (let u = -1; u <= 4; u++) if (u || v) w.setK(ore + v * N + u, K.SOFT);
  const pod = ore + 2, hollow = [];
  for (let v = -1; v <= 1; v++) for (let u = 1; u <= 3; u++) { const j = ore + v * N + u; w.setK(j, K.EMPTY); if (j !== pod) hollow.push(j); }
  w.setK(pod, K.HAZARD);
  // (Ore that healed in play: the same cell made ore by hand where the world laid none.)
  if (byHand) { w.setK(ore, K.SOFT); w.setK(ore - 2 * N + 2, K.ORE_A); w.setK(ore + 4, K.ORE_A); }
  game.changed();
  const fired = [], fire = game.fitter.fire.bind(game.fitter);
  game.fitter.fire = id => { fired.push(id); fire(id); };
  const laid = hollow.map(j => w.first(j));
  game.trigger(pod, 'spore', false);
  idle(game, 7);
  return { game, w, ore, pod, hollow, fired, laid };
};

{
  const s = await stage(2), w = s.w, beside = s.ore + 1, rest = [...s.hollow.filter(j => j !== beside), s.pod];
  check(w.k(beside) === K.ORE_A, `with the graft the moss beside the ore healed as ${kinds(w, [beside])}`);
  check(rest.every(j => w.k(j) === K.SOFT), `with the graft the rest of the moss is ${kinds(w, rest)}`);
  check(s.fired.includes('sporedrive'), `with the graft the fitting was not told: ${s.fired}`);
  check(s.hollow.every((j, n) => w.first(j) === s.laid[n]), 'the world laid there changed');
}
for (const drive of [0, 1]) {
  const s = await stage(drive), all = [...s.hollow, s.pod];
  check(all.every(j => s.w.k(j) === K.SOFT), `with the spore drive at ${drive} the moss is ${kinds(s.w, all)}`);
  check(!s.fired.includes('sporedrive'), `with the spore drive at ${drive} the fitting was told of a graft`);
}
{
  const s = await stage(2, true), all = [...s.hollow, s.pod];
  check(all.every(j => s.w.k(j) === K.SOFT), `beside ore that healed in play the moss is ${kinds(s.w, all)}`);
}
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: with the graft moss beside the world\'s ore heals as ore and the rest as soft rock; beside ore that healed in play, and without the graft, it is all soft rock');
process.exit(fails.length ? 1 : 0);
