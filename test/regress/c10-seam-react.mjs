// What the seams do (js/game.js: REACT, `zap`, `trigger`, `updateHazards`, `reacted`), each staged by hand at the
// end of the first reach, in the seam's ground and then in a cross of the same two traits, which must not react:
//   - THAW: an arc in hoarstone opens the ice within three cells of the crystal (one four off stands), as an arc's
//     slate is opened (the frost has the cells again); in hailstone (crystals, and ground that freezes) the ice
//     stands;
//   - GLASS: an arc in glassdune wakes the lava within three cells of the crystal (lava four off sleeps), and the
//     lava sets as glass, never basalt; in kilnstone (crystals and lava) the lava sleeps, and lava woken by a cut
//     sets as basalt;
//   - BURN: lava woken in cinderfen sets off the pod beside it and the pod beside that, which burn off: they knock
//     nothing and leave no moss; in sootfen (lava and pods) the pod beside the lava stands;
//   - RIME: a pod set off in frostfen leaves no cloud that knocks, and the open ground two round it closes with ice,
//     but its own cell, the drill's and the cells round the drill; in tundra (pods, and ground that freezes) it
//     is a cloud, and moss;
//   - after each, the tether is sound and every piece the books hold is loose.
// Fails on the game before the seams reacted: the ice stands, the lava sleeps, the pods stand and the clouds grow
// moss.
//   node test/regress/c10-seam-react.mjs
import { makeGame, world, C, N, tetherFaults } from '../harness.mjs';
import { arena, at, fixRandom, isLoose, rect } from './lib/lasso.mjs';
const { K, BIOMES, SEAMS, KIND_NAMES } = world;

const fails = [], check = (ok, what) => { if (!ok && fails.length < 30) fails.push(what); };
fixRandom(10);
const name = n => BIOMES[n].name, kinds = (w, cells) => cells.map(i => KIND_NAMES[w.k(i)]).join(' ');
// (Each reaction says so where it happened, if that is on the screen; these are off it, so when it last said so is
// asked: never, -9.)
const cross = (a, b, freeze) => BIOMES.find(r => r?.cross && r.cross.structure === 0 && [r.haz?.type, r.haz2?.type].includes(a) && (b === 'freeze' ? r.freeze > 0 : [r.haz?.type, r.haz2?.type].includes(b)) && (freeze === undefined || (r.freeze > 0) === freeze)).id;
const sound = (game, where) => {
  const faults = tetherFaults(game);
  check(!faults.length, `${where}: the tether is not sound: ${faults[0]}`);
  check(game.pieces.every(cells => isLoose(game, cells)), `${where}: the books hold a piece that is not loose`);
};
const stage = async (b, kind = K.SOFT) => {
  const game = await makeGame(7, { tether: 0 });
  arena(game, 46, kind, b);
  game.changed();
  return game;
};
const run = (game, seconds) => { for (let f = 0; f < seconds * 60; f++) game.update(1 / 60); };

// ---- THAW
for (const b of [SEAMS[0][0], SEAMS[0][1], cross('spark', 'freeze')]) {
  const game = await stage(b), w = game.world, seam = BIOMES[b].react === 'thaw';
  const near = [at(22, 0), at(20, 3), at(17, -3), at(23, 2)], far = [at(24, 0), at(20, 4)];
  for (const i of [...near, ...far]) w.setK(i, K.ICE);
  w.setK(at(20, 0), K.HAZARD);
  game.changed();
  game.finishDig(at(20, 0));
  const where = `thaw in ${name(b)}`;
  if (seam) {
    check(near.every(i => w.k(i) === K.EMPTY), `${where}: the ice within three of the crystal is ${kinds(w, near)}`);
    check(near.every(i => game.frostOpen.includes(i)), `${where}: the frost does not have the thawed cells again`);
    check((game.saidAt?.thaw ?? -9) > -9, `${where}: it never said THAWED`);
  } else check(near.every(i => w.k(i) === K.ICE), `${where} (a cross): the ice within three of the crystal is ${kinds(w, near)}`);
  check(far.every(i => w.k(i) === K.ICE), `${where}: the ice four off is ${kinds(w, far)}`);
  run(game, 1);
  sound(game, where);
}

// ---- GLASS
for (const b of [SEAMS[1][0], SEAMS[1][1], cross('spark', 'lava')]) {
  const game = await stage(b), w = game.world, seam = BIOMES[b].react === 'glass', row = BIOMES[b];
  const lava = row.haz?.type === 'lava' ? K.HAZARD : K.HAZARD2, crystal = row.haz?.type === 'spark' ? K.HAZARD : K.HAZARD2;
  // (Room below the crystal's lava for it to pour into.)
  rect(game, 20, 3, 24, 4, K.EMPTY);
  const woken = at(22, 2), asleep = at(25, 2);
  w.setK(woken, lava); w.setK(asleep, lava); w.setK(at(20, 0), crystal);
  game.changed();
  game.finishDig(at(20, 0));
  const where = `glass in ${name(b)}`;
  check(w.lava.has(woken) === seam, `${where}: the lava three from the crystal is ${w.lava.has(woken) ? 'woken' : 'asleep'}`);
  check(w.k(asleep) === lava && !w.lava.has(asleep), `${where}: the lava four from the crystal is ${KIND_NAMES[w.k(asleep)]}`);
  if (!seam) game.finishDig(at(22, 1));
  run(game, 14);
  let glass = 0, basalt = 0;
  for (let y = 0; y <= 5; y++) for (let x = 18; x <= 27; x++) { const k = w.k(at(x, y)); glass += k === K.GLASS; basalt += k === K.BASALT; }
  check(w.lava.size === 0, `${where}: lava still runs after fourteen seconds`);
  if (seam) { check(glass >= 2 && basalt === 0, `${where}: the lava set as ${glass} cells of glass and ${basalt} of basalt`); check((game.saidAt?.glass ?? -9) > -9, `${where}: it never said GLASS ROAD`); }
  else check(glass === 0 && basalt >= 2, `${where} (a cross): the lava set as ${glass} cells of glass and ${basalt} of basalt`);
  sound(game, where);
}

// ---- BURN
for (const b of [SEAMS[2][0], SEAMS[2][1], cross('lava', 'spore', false)]) {
  const game = await stage(b), w = game.world, seam = BIOMES[b].react === 'burn', row = BIOMES[b];
  const lava = row.haz?.type === 'lava' ? K.HAZARD : K.HAZARD2, pod = row.haz?.type === 'spore' ? K.HAZARD : K.HAZARD2;
  rect(game, 20, -3, 20, 3, K.EMPTY);
  const L = at(21, 0), A = at(22, 0), Bp = at(23, 1);
  w.setK(L, lava); w.setK(A, pod); w.setK(Bp, pod);
  game.changed();
  const knocks = game.knocks;
  game.finishDig(at(21, 1));
  const where = `burn in ${name(b)}`;
  run(game, 1.5);
  if (seam) {
    check(w.k(A) === K.EMPTY && w.k(Bp) === K.EMPTY, `${where}: the pods beside the lava are ${kinds(w, [A, Bp])}`);
    check(game.clouds.every(c => c.burnt), `${where}: a cloud that did not burn off: ${JSON.stringify(game.clouds)}`);
    run(game, 7);
    check(w.k(Bp) === K.EMPTY, `${where}: the burnt pod's cell grew ${KIND_NAMES[w.k(Bp)]}`);
    check((game.saidAt?.burn ?? -9) > -9, `${where}: it never said BURNT OFF`);
  } else {
    check(w.k(A) === pod && w.k(Bp) === pod, `${where} (a cross): the pods beside the lava are ${kinds(w, [A, Bp])}`);
    run(game, 7);
  }
  check(game.knocks === knocks, `${where}: the drill was knocked`);
  sound(game, where);
}

// ---- RIME
for (const b of [SEAMS[3][0], SEAMS[3][1], cross('spore', 'freeze')]) {
  const game = await stage(b), w = game.world, seam = BIOMES[b].react === 'rime', row = BIOMES[b];
  const pod = row.haz?.type === 'spore' ? K.HAZARD : K.HAZARD2;
  rect(game, 21, -3, 25, 3, K.EMPTY);
  w.setK(at(20, 0), pod);
  game.changed();
  game.finishDig(at(20, 1));
  const where = `rime in ${name(b)}`, ring = [at(20, 1), at(21, 0), at(22, 0), at(22, -2), at(22, 2), at(21, -1)], beyond = [at(23, 0), at(23, 2)];
  check(w.k(at(20, 0)) === K.EMPTY, `${where}: the pod did not go off`);
  run(game, 0.5);
  if (seam) {
    check(game.clouds.length === 0, `${where}: a cloud of ${game.clouds.length} still hangs`);
    check(ring.every(i => w.k(i) === K.ICE), `${where}: the ground two round the pod is ${kinds(w, ring)}`);
    check(w.k(at(20, 0)) === K.EMPTY && beyond.every(i => w.k(i) === K.EMPTY), `${where}: the pod's own cell and the ground three off are ${kinds(w, [at(20, 0), ...beyond])}`);
    check((game.saidAt?.rime ?? -9) > -9, `${where}: it never said ICE RING`);
  } else {
    check(game.clouds.length === 1 && ring.every(i => w.k(i) !== K.ICE), `${where} (a cross): ${game.clouds.length} clouds, and the ground round the pod ${kinds(w, ring)}`);
    run(game, 6);
    check(w.k(at(21, 0)) === K.SOFT, `${where} (a cross): the cloud grew ${KIND_NAMES[w.k(at(21, 0))]}`);
  }
  sound(game, where);
}
// And never the drill's cell or the cells round it: a pod gone off beside the drill, which stands in the open.
{
  const b = SEAMS[3][0], game = await stage(b), w = game.world, d = game.drill;
  rect(game, 21, -3, 25, 3, K.EMPTY);
  w.setK(at(20, 0), K.HAZARD);
  d.x = C + 22.5; d.y = C + 0.5; d.mode = 'free'; game.band = [[d.x, d.y], [C + 0.5, C + 0.5]];
  rect(game, 3, -1, 21, 1, K.EMPTY);
  w.setK(at(20, 0), K.HAZARD);
  game.changed();
  game.trigger(at(20, 0), 'spore', false);
  run(game, 0.5);
  const round = []; for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) round.push(at(22 + u, v));
  check(round.every(i => w.k(i) === K.EMPTY), `rime beside the drill: the drill's cells are ${kinds(w, round)}`);
  sound(game, 'rime beside the drill');
}

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: each seam reacts as its row says (thaw, glass, burn, rime), the crosses of the same traits do not, and the tether and the books hold');
process.exit(fails.length ? 1 : 0);
