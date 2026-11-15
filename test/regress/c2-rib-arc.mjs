// Crackling ribs, in play (docs/CONTENT-PLAN.md, content item 2; js/game.js: `zap`, `shatters`, FUSE). An arc from a
// charged crystal shatters the slate among the eight cells round it, and whatever that lets go is in the books of
// loose ground at once, told by one `changed` with everything that opened together. Staged in the east's ground, as
// test/regress/f-bomb-ring.mjs stages a bomb:
//   - a block cut all round but for a neck of slate, with a crystal beside the neck. A cut beside the crystal lights
//     its fuse (0.8 s, where it was 0.55); when it burns down the neck is gone, the block is loose and known as
//     loose, and flying on round it hauls it, as it does when the neck is cut by hand;
//   - the arc is one call to `changed`, with the shattered slate in what it names as opened; two crystals that arc
//     in one frame are one call between them;
//   - a crystal cut into arcs at once, and its slate goes to `changed` with the cut;
//   - slate out of the tether's reach stands; slate two cells from the crystal stands;
//   - shattered slate pays nothing; in ground that freezes it is a cut like any other, and closes with ice;
//   - the glow of a cut into a crystal holds the slate the arc will take and the ground that hangs on it;
//   - crystals that are a ground's second hazard do the same.
//   node test/regress/c2-rib-arc.mjs
import { makeGame, world, tetherFaults, C, N } from '../harness.mjs';
import { arena, rect, at, fixRandom, flyTo, idle, isLoose, where } from './lib/lasso.mjs';
const { K, B, BIOMES } = world;

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
// Every call of `changed`, with what it was told opened.
const spy = game => { const calls = [], changed = game.changed.bind(game); game.changed = (opened = [], closed = []) => { calls.push(opened.slice()); return changed(opened, closed); }; return calls; };

// ---- the block on its neck of slate: the arc, and for comparison the bit.
async function ring(how) {
  fixRandom(3);
  const game = await makeGame(7, { tether: 3, drill: 4 }), w = game.world;
  arena(game, 30, K.SOFT, B.LODE);
  rect(game, 3, 0, 10, 0, K.EMPTY);                                             // a tunnel east from the core
  rect(game, 11, -3, 17, -3, K.EMPTY); rect(game, 11, 3, 17, 3, K.EMPTY);      // the ring round the block
  rect(game, 11, -3, 11, 3, K.EMPTY); rect(game, 17, -3, 17, 3, K.EMPTY);
  const neck = at(17, 0), crystal = at(18, 1), block = [];
  w.setK(neck, K.SLATE); w.setK(crystal, K.HAZARD);                            // the neck, and the crystal beside it
  game.changed();
  for (let y = -2; y <= 2; y++) for (let x = 12; x <= 16; x++) block.push(at(x, y));
  for (const [x, y] of [[10, 0], [11, 0], [11, -3], [14, -3]]) if (flyTo(game, x, y) < 0) throw new Error(`never reached ${x},${y}: at ${where(game)}`);
  const calls = spy(game);
  let facts = {};
  if (how === 'arc') {
    check(!game.pieceOf.has(block[0]) && !isLoose(game, block), 'the block is loose before anything was done');
    game.finishDig(at(19, 1));                                                   // the nick: a cut beside the crystal
    const fuse = game.sparks.get(crystal)?.fuse;
    check(fuse === 0.8, `the fuse of a crystal woken from beside it is ${fuse} s, not 0.8`);
    check(w.k(neck) === K.SLATE, 'the slate went before the fuse burnt down');
    calls.length = 0;
    idle(game, 0.75);
    check(w.k(neck) === K.SLATE && calls.length === 0, 'the arc came before 0.8 s were up');
    idle(game, 0.1);
    check(w.k(neck) === K.EMPTY, 'the arc did not shatter the slate beside the crystal');
    check(w.k(crystal) === K.HAZARD, 'the crystal is gone with its arc');
    check(calls.length === 1 && calls[0].includes(neck), `the arc told the books of loose ground ${calls.length} times, of ${JSON.stringify(calls.map(c => c.length))} cells`);
    check(isLoose(game, block) && block.every(i => game.pieceOf.has(i)) && game.pieces.some(p => p.length === block.length), `after the arc the block is ${isLoose(game, block) ? 'loose' : 'held'}, and ${block.filter(i => game.pieceOf.has(i)).length} of its ${block.length} cells are in the books`);
    check(game.pending.grit === 0 && game.hauls.length === 0 && game.S.stats.hauls === 0, 'shattered slate paid something');
    facts = { fuse, calls: calls.length };
  } else game.finishDig(neck);
  // On round the ring, through where the neck was, and stop below the block on its west side.
  for (const [x, y] of [[17, -3], [17, 3], [11, 3], [11, 1]]) if (flyTo(game, x, y) < 0) throw new Error(`never reached ${x},${y}: at ${where(game)}`);
  idle(game, 0.5);
  const left = block.filter(i => w.k(i) !== K.EMPTY).length;
  console.log(JSON.stringify({ how, ...facts, hauls: game.S.stats.hauls, hauled: game.hauled?.n, blockCellsStillThere: left, faults: tetherFaults(game) }));
  check(!tetherFaults(game).length, `${how}: the tether: ${tetherFaults(game).join('; ')}`);
  return { hauls: game.S.stats.hauls, n: game.hauled?.n, left };
}
const cut = await ring('cut'), arc = await ring('arc');
check(cut.hauls === 1 && cut.n === 25 && cut.left === 0, `with the neck cut by hand the block was hauled ${cut.hauls} times (${cut.n} cells)`);
check(arc.hauls === 1 && arc.n === 25 && arc.left === 0, `with the neck shattered by an arc the block was hauled ${arc.hauls} times (${arc.n} cells), ${arc.left} of its cells still there`);

// ---- the rest, in one field.
fixRandom(5);
const game = await makeGame(7, { tether: 2 }), w = game.world;                // reach 40
arena(game, 44, K.SOFT, B.LODE);
game.changed();
const calls = spy(game);
// Two crystals far apart, each with slate round it, lit together: their arcs come in one frame and are one call.
{
  const a = at(-20, -20), b = at(-20, 20), slate = [at(-21, -20), at(-19, -21), at(-20, 19), at(-21, 21)], off = at(-22, -20);
  for (const i of [a, b]) w.setK(i, K.HAZARD);
  for (const i of [...slate, off]) w.setK(i, K.SLATE);
  game.sparks.set(a, { fuse: 0.05, cool: 0 }); game.sparks.set(b, { fuse: 0.05, cool: 0 });
  calls.length = 0;
  for (let f = 0; f < 6; f++) game.updateHazards(1 / 60);
  check(slate.every(i => w.k(i) === K.EMPTY), 'two arcs in one frame did not each shatter the slate round its crystal');
  check(calls.length === 1 && slate.every(i => calls[0].includes(i)) && calls[0].length === slate.length, `two arcs in one frame were ${calls.length} calls to changed, of ${JSON.stringify(calls.map(c => c.length))} cells: not one call of 4`);
  check(w.k(off) === K.SLATE, 'slate two cells from the crystal was shattered');
}
// A crystal cut into: it arcs at once, the slate round it goes with the cut, and the piece it held is loose.
{
  const crystal = at(20, -20), slate = [at(21, -20), at(21, -21)], held = at(22, -20);
  // A cell of rock that hangs on the slate alone: open ground on its other three sides.
  w.setK(crystal, K.HAZARD); for (const i of slate) w.setK(i, K.SLATE);
  w.setK(at(22, -21), K.EMPTY); w.setK(at(23, -20), K.EMPTY); w.setK(at(22, -19), K.EMPTY);
  game.changed();
  game.foresee(crystal);
  const glow = game.preview[0].cells;
  check(slate.every(i => glow.includes(i)) && glow.includes(held), `the glow of a cut into a crystal is ${glow.length} cells: not the slate its arc will shatter and the rock that hangs on it`);
  calls.length = 0;
  game.finishDig(crystal);
  check(slate.every(i => w.k(i) === K.EMPTY), 'a crystal cut into did not shatter the slate round it at once');
  check(calls.length === 1 && calls[0].includes(crystal) && slate.every(i => calls[0].includes(i)), `the cut and its arc were ${calls.length} calls to changed, of ${JSON.stringify(calls.map(c => c.length))} cells`);
  check(game.pieceOf.has(held), 'rock that hung on the shattered slate is not known as loose');
}
// The tether's reach: slate beyond it stands.
{
  const crystal = at(40, 0), within = at(39, 0), beyond = at(41, 0);
  w.setK(crystal, K.HAZARD); w.setK(within, K.SLATE); w.setK(beyond, K.SLATE);
  check(game.within(39.5 + C, 0.5 + C) && !game.within(41.5 + C, 0.5 + C), 'the staging is wrong: the reach is not 40');
  game.sparks.set(crystal, { fuse: 0.01, cool: 0 });
  game.updateHazards(1 / 60);
  check(w.k(within) === K.EMPTY && w.k(beyond) === K.SLATE, `slate within reach is ${world.KIND_NAMES[w.k(within)]} and slate beyond it ${world.KIND_NAMES[w.k(beyond)]}`);
}
// The arc sets off the crystals within three cells, on short fuses, and so runs along a rib: a row of slate with a
// crystal against every third cell of it is gone from end to end in a few seconds, from one nick.
{
  const rib = [], studs = [];
  for (let x = -12; x <= 12; x++) { rib.push(at(x, 30)); w.setK(at(x, 30), K.SLATE); }
  for (let x = -12; x <= 12; x += 3) { studs.push(at(x, 31)); w.setK(at(x, 31), K.HAZARD); }
  game.changed();
  game.finishDig(at(-13, 31));
  check(game.sparks.get(studs[0])?.fuse === 0.8 && !game.sparks.has(studs[1]), 'the nick lit other than the first crystal of the rib');
  idle(game, 0.9);
  const next = game.sparks.get(studs[1])?.fuse;
  check(next > 0 && next <= 0.6, `the next crystal along the rib has a fuse of ${next} s after the first arc`);
  idle(game, 6);
  check(rib.every(i => w.k(i) === K.EMPTY), `${rib.filter(i => w.k(i) !== K.EMPTY).length} of the rib's ${rib.length} cells of slate still stand`);
}
// Ground that freezes: slate an arc opened there closes with ice in its time, as a cut does.
{
  const row = world.biome({ ...BIOMES[B.FROST], id: 120, name: 'test-frost-spark', sheet: 'frost', floor: 'frost-floor', haz2: { type: 'spark', rate: 1 } });
  rect(game, -10, -40, 10, -30, K.SOFT, row.id);
  const crystal = at(0, -35), slate = at(1, -35);
  w.setK(crystal, K.HAZARD2); w.setK(slate, K.SLATE);
  game.changed();
  check(w.hazAt(crystal) === 'spark', 'the staging is wrong: the second hazard is not a crystal');
  game.finishDig(at(-1, -35));
  idle(game, 1);
  check(w.k(slate) === K.EMPTY && game.frostOpen.includes(slate), 'a crystal that is a second hazard did not shatter its slate, or the cell is not due to freeze');
  idle(game, row.freeze + 1);
  check(w.k(slate) === K.ICE, `slate shattered in ground that freezes is ${world.KIND_NAMES[w.k(slate)]} after ${row.freeze + 1} s, not ice`);
}
check(!tetherFaults(game).length, `the tether: ${tetherFaults(game).join('; ')}`);

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: an arc shatters the slate beside its crystal, what that lets go is in the books by one changed, and the block it held is hauled');
process.exit(fails.length ? 1 : 0);
