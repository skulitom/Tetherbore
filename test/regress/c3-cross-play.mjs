// What a generated cross is in play (docs/CONTENT-PLAN.md, section 4 (a)), in ground of the crosses' own rows laid
// by hand round the core. A cross is its host's ground with its donor's trait, and the game reads nothing but the
// row to know it:
//   - a cut closes with ice after 30 seconds in a cross whose host or donor is the north, and in no other;
//   - the donor's hazard, a K.HAZARD2 cell, wakes as its own kind does anywhere: lava pours and quenches the slag
//     beside it to steel, a pod bursts, a crystal's fuse is lit; a first-hazard cell in a cross of the north's
//     ground, which has no hazard of its own, is inert;
//   - a hauled cell pays a quarter more grit than in the host's own ground; plain ore pays the host's gems, rich ore
//     the donor's, and each hazard its own kind's;
//   - rock is drawn from the pair's own sheet over the host's floor, plain ore and dense rock from the host's sheet,
//     rich ore from the donor's (it looks like what it pays), a hazard from its kind's; chips are the cross's;
//   - coming into one, the place is named by the cross's name, with both gems it pays on its plate; hand-made
//     ground has one.
// And a frame of every one of the sixty is drawn, so no row names a sheet or a frame the art has not.
//   node test/regress/c3-cross-play.mjs
import { makeGame, world } from '../harness.mjs';
import { arena, rect, at, idle, fixRandom, flyTo } from './lib/lasso.mjs';
const { K, B, BIOMES, crossId } = world;

fixRandom(5);
const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const THAW = crossId(B.FROST, B.EMBER), QUENCH = crossId(B.EMBER, B.FROST), SOOTFEN = crossId(B.EMBER, B.MIRE), FLASHROCK = crossId(B.EMBER, B.LODE);
const RIMEMOSS = crossId(B.MIRE, B.FROST), HOARSAND = crossId(B.LODE, B.FROST), MOULDSTONE = crossId(B.LODE, B.MIRE);
check(BIOMES[THAW].title === 'THAW' && BIOMES[QUENCH].title === 'QUENCH' && BIOMES[MOULDSTONE].title === 'MOULDSTONE', 'the crosses are not at the numbers this test stages them by');

// Above the core three strips (thaw, quench, sootfen), below it three (mouldstone, flashrock, rimemoss), hoarsand
// straight east and the east's own ground straight west.
const game = await makeGame(7), w = game.world, d = game.drill, S = game.S;
arena(game, 40, K.SOFT, B.CRUST);
rect(game, 3, -3, 40, 3, K.SOFT, HOARSAND); rect(game, -40, -3, -3, 3, K.SOFT, B.LODE);
rect(game, -40, -40, -14, -8, K.SOFT, THAW); rect(game, -13, -40, 13, -8, K.SOFT, QUENCH); rect(game, 14, -40, 40, -8, K.SOFT, SOOTFEN);
rect(game, -40, 8, -14, 40, K.SOFT, MOULDSTONE); rect(game, -13, 8, 13, 40, K.SOFT, FLASHROCK); rect(game, 14, 8, 40, 40, K.SOFT, RIMEMOSS);
game.changed();

// ---- ice: one cell cut in each, far from the drill and its tether
const cuts = { thaw: at(-25, -30), quench: at(0, -30), sootfen: at(25, -30), flashrock: at(0, 30), rimemoss: at(25, 30), hoarsand: at(30, 0) };
for (const i of Object.values(cuts)) game.finishDig(i);
const state = () => Object.entries(cuts).map(([name, i]) => `${name} ${w.k(i) === K.EMPTY ? 'open' : w.k(i) === K.ICE ? 'ice' : `kind ${w.k(i)}`}`).join(', ');
idle(game, 28.5);
check(Object.values(cuts).every(i => w.k(i) === K.EMPTY), `after 28.5 seconds: ${state()}`);
idle(game, 3);
check(['thaw', 'quench', 'rimemoss', 'hoarsand'].every(name => w.k(cuts[name]) === K.ICE) && w.k(cuts.sootfen) === K.EMPTY && w.k(cuts.flashrock) === K.EMPTY, `after 31.5 seconds (a cross with the north in it closes at 30): ${state()}`);
idle(game, 30);
check(w.k(cuts.sootfen) === K.EMPTY && w.k(cuts.flashrock) === K.EMPTY, `after a minute, in crosses without the north: ${state()}`);

// ---- the donor's hazard wakes as its kind does
// Lava in thaw, with a lump of slag over it: a cut beside the pocket opens it and the slag is steel.
const pocket = at(-25, -20), slag = at(-25, -21);
w.setK(pocket, K.HAZARD2); w.setK(slag, K.SLAG);
check(w.hazAt(pocket) === 'lava', `a second-hazard cell in thaw reads as ${w.hazAt(pocket)}`);
game.finishDig(at(-24, -20));
check(w.lava.has(pocket) && w.k(pocket) === K.EMPTY && game.lavaVol.get(pocket) === 5 && w.k(slag) === K.STEEL, `a cut beside the south's lava in thaw: the pocket is kind ${w.k(pocket)}, lava ${w.lava.has(pocket)}, the slag over it kind ${w.k(slag)}`);
// A first-hazard cell there is nothing: the north has no hazard of its own.
const inert = at(-30, -15); w.setK(inert, K.HAZARD);
game.finishDig(at(-29, -15));
check(w.hazAt(inert) === null && w.k(inert) === K.HAZARD && game.overlay(K.HAZARD, BIOMES[THAW]) === null, 'a first-hazard cell woke in a cross of the north\'s ground');
// A pod in sootfen and in mouldstone; a crystal in flashrock; and each one's own first hazard beside.
const pod = at(25, -20), ownLava = at(30, -20), crystal = at(0, 20), pod2 = at(-25, 20), ownCrystal = at(-30, 20);
w.setK(pod, K.HAZARD2); w.setK(ownLava, K.HAZARD); w.setK(crystal, K.HAZARD2); w.setK(pod2, K.HAZARD2); w.setK(ownCrystal, K.HAZARD);
check(same([pod, ownLava, crystal, pod2, ownCrystal].map(i => w.hazAt(i)), ['spore', 'lava', 'spark', 'spore', 'spark']), `the hazards of the crosses read as ${[pod, ownLava, crystal, pod2, ownCrystal].map(i => w.hazAt(i))}`);
const clouds = game.clouds.length;
game.finishDig(at(26, -20));
check(game.clouds.length === clouds + 1 && w.k(pod) === K.EMPTY, 'a cut beside the west\'s pod in sootfen did not burst it');
game.finishDig(at(31, -20));
check(w.lava.has(ownLava), 'a cut beside sootfen\'s own lava did not open it');
game.finishDig(at(1, 20));
check(game.sparks.has(crystal) && w.k(crystal) === K.HAZARD2, 'a cut beside the east\'s crystal in flashrock did not light its fuse');
game.finishDig(at(-31, 20));
check(game.sparks.has(ownCrystal), 'a cut beside mouldstone\'s own crystal did not light its fuse');
game.sparks.clear();

// ---- pay
const cells = (x0, y0, x1, y1) => { const list = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) list.push(at(x, y)); return list; };
const paid = (list, ground) => { const was = list.map(i => w.b(i)); for (const i of list) w.setB(i, ground); const pay = game.payOf(list); list.forEach((i, n) => w.setB(i, was[n])); return pay; };
const field = cells(-36, -38, -29, -34);
for (const [cross, host] of [[THAW, B.FROST], [QUENCH, B.EMBER], [RIMEMOSS, B.MIRE], [MOULDSTONE, B.LODE]]) {
  const a = paid(field, cross).grit, b = paid(field, host).grit;
  check(b > 20 && Math.abs(a / b - 1.25) < 0.03, `forty cells pay ${a} as ${BIOMES[cross].name} and ${b} as ${BIOMES[host].name}'s own: not a quarter more`);
}
const gemsOf = (kind, ground) => { const i = at(-20, -36), was = [w.k(i), w.b(i)]; w.setK(i, kind); w.setB(i, ground); const gems = game.payOf([i]).gems; w.setK(i, was[0]); w.setB(i, was[1]); return gems; };
const GEMS = [
  [THAW, K.ORE_A, [0, 1, 0, 0, 0]], [THAW, K.ORE_B, [0, 0, 5, 0, 0]], [THAW, K.HAZARD2, [0, 0, 2, 0, 0]],
  [MOULDSTONE, K.ORE_A, [0, 0, 0, 0, 1]], [MOULDSTONE, K.ORE_B, [0, 0, 0, 5, 0]], [MOULDSTONE, K.HAZARD, [0, 0, 0, 0, 2]], [MOULDSTONE, K.HAZARD2, [0, 0, 0, 2, 0]],
  [QUENCH, K.ORE_B, [0, 5, 0, 0, 0]], [QUENCH, K.HAZARD, [0, 0, 2, 0, 0]], [RIMEMOSS, K.ORE_B, [0, 5, 0, 0, 0]], [FLASHROCK, K.HAZARD2, [0, 0, 0, 0, 2]],
];
for (const [ground, kind, want] of GEMS) check(same(gemsOf(kind, ground), want), `a cell of kind ${kind} in ${BIOMES[ground].name} pays gems ${gemsOf(kind, ground)}, not ${want}`);

// ---- sheets and colours
for (const row of BIOMES.filter(row => row?.cross)) {
  const own = BIOMES[row.cross.host], from = BIOMES[row.cross.donor], id = row.id, sheet = `x-${own.name}-${from.name}`;
  check(game.rockSheet(K.SOFT, id) === sheet && game.rockSheet(K.DENSE, id) === sheet && game.rockSheet(K.SLATE, id) === 'slate' && game.rockSheet(K.ICE, id) === 'ice', `${row.name}: its rock is drawn from ${game.rockSheet(K.SOFT, id)}`);
  check(row.floor === own.floor && same(game.overlay(K.ORE_A, row), [own.items, 'oreA']) && same(game.overlay(K.DENSE, row), [own.items, 'dense']), `${row.name}: its floor, its plain ore or its dense rock is not drawn as its host's`);
  check(same(game.overlay(K.ORE_B, row), [from.items, 'oreB']), `${row.name}: its rich ore is drawn from ${game.overlay(K.ORE_B, row)}, not its donor's sheet`);
  check(same(game.overlay(K.HAZARD, row), game.overlay(K.HAZARD, own)) && same(game.overlay(K.HAZARD2, row), from.haz ? game.overlay(K.HAZARD, from) : null), `${row.name}: its hazards are drawn as ${game.overlay(K.HAZARD, row)} and ${game.overlay(K.HAZARD2, row)}`);
  check(game.debris(K.SOFT, id) === row.debris && game.debris(K.SOFT, id) !== own.debris, `${row.name}: its chips are not its own colours`);
}
// Hand-made ground draws its rich ore from its own ore's sheet, as ever.
for (const id of [1, 2, 3, 4, 5, 8, 17, 20, 22, 24]) check(same(game.overlay(K.ORE_B, BIOMES[id]), [BIOMES[id].items, 'oreB']), `${BIOMES[id].name}: its rich ore is drawn from ${game.overlay(K.ORE_B, BIOMES[id])}`);

// ---- a frame of each: a patch of every cross, with ore, both hazards, slate and ice in it, painted and drawn
{
  const ids = BIOMES.filter(row => row?.cross).map(row => row.id), KINDS = [K.SOFT, K.DENSE, K.ORE_A, K.ORE_B, K.HAZARD, K.HAZARD2, K.SLATE, K.ICE, K.SLAG, K.STEEL, K.EMPTY];
  let drawn = 0, threw = '';
  for (let n = 0; n < ids.length; n += 6) {
    ids.slice(n, n + 6).forEach((id, m) => { for (let y = -10; y <= -5; y++) for (let x = -9; x <= -7; x++) { const i = at(x + m * 3, y); w.setK(i, KINDS[(x + 9 + (y + 10) * 3) % KINDS.length]); w.setB(i, id); } });
    w.see(8192, 8192 - 8, 12);
    game.version++;
    try { game.render(); drawn += Math.min(6, ids.length - n); } catch (error) { threw ||= `${BIOMES[ids[n]].name} and the five after it: ${error.message}`; }
  }
  check(!threw && drawn === 60, `drawing a frame of the crosses failed at ${threw || `${drawn} of 60`}`);
  rect(game, -9, -10, 8, -5, K.SOFT, B.CRUST);
  game.changed();
}

// ---- the name: flying into hoarsand from the home ground, the place is HOARSAND, with the east's gem and the
// north's; across the screen the first time, on its plate the second
rect(game, 3, 0, 8, 0, K.EMPTY); game.changed();
if (flyTo(game, 7, 0) < 0) check(false, 'the drill never reached the hoarsand');
check(game.place?.title === 'HOARSAND' && game.place.card === true && S.met[HOARSAND] === 1, `the place named on coming into hoarsand: ${JSON.stringify(game.place)}`);
check(game.place?.icon === 'lode' && game.place?.also === 'frost', `hoarsand's place has the gems ${game.place?.icon} and ${game.place?.also}, not the east's and the north's`);
if (flyTo(game, 0, 0) < 0) check(false, 'the drill never came home');
check(game.place?.title === 'CRUST' && game.place.also === null, `the home ground's place: ${JSON.stringify(game.place)}`);
idle(game, 0.5);      // (the thumb lifts: the drill leaves the core on a fresh stroke)
// Hand-made ground pays one direction's gems and has that one gem on its plate.
rect(game, -8, 0, -3, 0, K.EMPTY); game.changed();
if (flyTo(game, -7, 0) < 0) check(false, 'the drill never reached the plain ground of the east');
check(game.place?.title === 'LODE' && game.place.icon === 'lode' && game.place.also === null, `the place named on coming into the east's own ground: ${JSON.stringify(game.place)}`);
if (flyTo(game, 0, 0) < 0) check(false, 'the drill never came home a second time');
idle(game, 0.5);
if (flyTo(game, 7, 0) < 0) check(false, 'the drill never reached the hoarsand a second time');
check(game.place?.title === 'HOARSAND' && game.place.card === false && game.place.also === 'frost', `the place named on coming into hoarsand again: ${JSON.stringify(game.place)}`);
game.render();

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: a cross freezes, wakes, pays and is drawn by its row: the host\'s ground, the donor\'s trait and rich ore, and its own name');
process.exit(fails.length ? 1 : 0);
