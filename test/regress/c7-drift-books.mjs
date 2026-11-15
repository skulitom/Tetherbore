// A drift's boulders in the books of loose ground (docs/CONTENT-PLAN.md, content item 7; js/game.js: driftIn,
// driftsOut, and their places in enter, arrive and look). In a drift everything lies loose already:
//   - the frame the drill comes in, every boulder that stands is in the books, each as one piece, whether it has
//     been seen or not (with the first scanner the drill sees three cells), and its drift is one the game keeps;
//   - what stands is asked of the world's cells, not of the pocket's record: a boulder hauled before is not
//     entered, and one cut in two is two pieces;
//   - out of the drift but still near it, with its boulders on the screen, they stay in the books; further off
//     than the screen shows, they are out of them, cell for cell, and the drift is kept no longer: so the list of
//     loose pieces is no longer for a drift crossed, or for five crossings;
//   - back in, they are in the books again;
//   - a boulder the tether lies against stays in the books when the rest go, and its drift is kept until it goes;
//     and loose ground that is not the drift's own stays, however near the drift it lies;
//   - boulders seen from outside the drift, by a drill that never comes in, are in the books as any loose ground
//     that comes into view is, and go out of them the same way;
//   - a boulder that is out of the books is no less loose: looked at again, it is entered again;
//   - ground of a drift where the world lays no drift (a saved game's may) breaks nothing.
//   node test/regress/c7-drift-books.mjs
import { C, N, K, world } from '../harness.mjs';
import { stage, bouldersOf } from '../../tools/drift-play.mjs';

const fails = [], check = (ok, what) => { if (!ok && fails.length < 16) fails.push(what); };
const HX = C + 0.5, HY = C + 0.5, out = {};
// The loose pieces the game knows of that lie in a drift's ground, each as its cells in order; and the boulders
// that stand there, the same way.
const inBooks = (game, Z) => game.pieces.filter(cells => game.world.b(cells[0]) === Z.row).map(cells => cells.slice().sort((a, b) => a - b).join()).sort();
const standing = (game, Z) => bouldersOf(game.world, Z).map(b => b.cells.slice().sort((a, b) => a - b).join()).sort();
// The drill set down `far` cells from the core on the straight way to the drift, in the tunnel it came by.
const put = (game, Z, far) => {
  const d = game.drill, len = Math.hypot(Z.cx - C, Z.cy - C);
  d.x = C + Math.round((Z.cx - C) / len * far) + 0.5; d.y = C + Math.round((Z.cy - C) / len * far) + 0.5; d.mode = 'free'; d.vx = d.vy = 0;
  game.band = [[d.x, d.y], [HX, HY]];
  game.update(1 / 60);
};

// ---- 1. coming in, with the first scanner: every boulder is in the books, seen or not
{
  const { game, Z, out: far } = await stage(7, 0, { scanner: 0 }), w = game.world;
  const before = game.pieces.length, there = standing(game, Z);
  check(Z.herald && there.length === 4 && inBooks(game, Z).length === 0 && game.drifts.size === 0, `before the drill is in: ${there.length} boulders stand, ${inBooks(game, Z).length} are in the books`);
  game.update(1 / 60);
  const unseen = bouldersOf(w, Z).filter(b => b.cells.every(i => !w.s(i))).length;
  check(game.placeKey === Z.key && JSON.stringify(inBooks(game, Z)) === JSON.stringify(there), `the frame the drill came in, the books hold ${inBooks(game, Z).length} of the drift's ${there.length} boulders`);
  check(unseen >= 1, `every boulder had been seen with the first scanner: nothing shows that the unseen are entered (${unseen})`);
  check(game.drifts.size === 1 && game.drifts.get(Z.key) === w.zoneOf(0, -2), 'the drift the drill is in is not one whose boulders the game keeps');
  check(game.pieces.length === before + 4 && there.every(cells => cells.split(',').every(i => game.pieceOf.has(+i))), 'a cell of a boulder is not in the book of loose cells');
  // ---- 3. near, they stay; away, they go; back in, they are in again
  const edge = far - Z.rho - 3;
  put(game, Z, edge);
  check(game.placeKey !== Z.key && inBooks(game, Z).length === 4 && game.drifts.size === 1, `three cells outside the drift, ${inBooks(game, Z).length} of its boulders are in the books`);
  put(game, Z, far - 60);
  check(inBooks(game, Z).length === 0 && game.drifts.size === 0 && game.pieces.length === before, `sixty cells away, ${inBooks(game, Z).length} boulders are still in the books; ${game.pieces.length} loose pieces where there were ${before}`);
  check(there.every(cells => cells.split(',').every(i => !game.pieceOf.has(+i))), 'a cell of a boulder is still in the book of loose cells');
  check(JSON.stringify(standing(game, Z)) === JSON.stringify(there), 'leaving the books changed the ground');
  // (And it is as loose as ever: looked at, it is entered again.)
  const one = +there[0].split(',')[0];
  let found = false;
  for (const i of there[0].split(',')) if (game.spot(+i)) found = true;
  check(found && game.pieceOf.has(one) && inBooks(game, Z).length === 1 && game.drifts.size === 1, 'a boulder out of the books is not entered again when it is looked at');
  put(game, Z, far - 61);
  check(inBooks(game, Z).length === 0 && game.drifts.size === 0, 'and does not go out of them again');
  for (let lap = 0; lap < 5; lap++) {
    put(game, Z, far - Z.rho + 1.5);
    if (inBooks(game, Z).length !== 4) check(false, `crossing ${lap + 1}: back in the drift, ${inBooks(game, Z).length} boulders are in the books`);
    put(game, Z, far - 60 - lap);
  }
  check(game.pieces.length === before && game.pieceOf.size === game.pieces.reduce((sum, cells) => sum + cells.length, 0), `after five crossings the books hold ${game.pieces.length} pieces, not ${before}`);
  out.herald = { before, unseen, after: game.pieces.length };
}

// ---- 2. what stands is the cells' to say: one boulder gone, one cut in two
{
  const { game, Z } = await stage(7, 3, { scanner: 0 }), w = game.world, all = bouldersOf(w, Z);
  const gone = all[0], cut = all.slice(1).find(b => b.box[2] - b.box[0] >= 2 && b.cells.length >= 7);
  for (const i of gone.cells) w.setK(i, K.EMPTY);
  // (Its middle column goes: what is left of it is a piece to either side.)
  const mid = cut.box[0] + 1;
  for (const i of cut.cells) if (i % N === mid) w.setK(i, K.EMPTY);
  const there = standing(game, Z);
  check(there.length === all.length, `${all.length} boulders, one taken and one cut in two: ${there.length} pieces stand`);
  game.update(1 / 60);
  check(JSON.stringify(inBooks(game, Z)) === JSON.stringify(there), `the books hold ${inBooks(game, Z).length} pieces of the drift where ${there.length} stand`);
  check(!gone.cells.some(i => game.pieceOf.has(i)), 'a boulder that is gone is in the books');
  out.cut = { boulders: all.length, stand: there.length };

  // ---- 5. a boulder the tether lies against stays when the rest go
  const d = game.drill, piece = game.pieces.find(cells => w.b(cells[0]) === Z.row), kept = piece.length, others = inBooks(game, Z).length - 1;
  // (And a rock of other ground that stands loose beside the drift, in the corner of the box the drift lies in:
  // it is no boulder, and stays in the books whatever the drift's do.)
  const corner = Math.floor(Z.rho) - 1, rock = (Z.cy + corner) * N + Z.cx + corner;
  check(w.b(rock) !== Z.row && w.b(rock + 1) !== Z.row, 'the corner of the box the drift lies in is the drift\'s own ground');
  w.setK(rock, K.SOFT);
  for (const s of [1, N, -1, -N]) w.setK(rock + s, K.EMPTY);
  game.enter([rock]);
  d.x += 400; game.placeKey = 0;
  game.band = [[d.x, d.y], [(piece[0] % N) + 1, Math.floor(piece[0] / N), 1, piece[0], 1], [HX, HY]];
  game.driftsOut();
  check(inBooks(game, Z).length === 1 && game.pieces.includes(piece) && piece.length === kept && game.drifts.has(Z.key), `with the tether against one boulder and the drill far off, ${inBooks(game, Z).length} of the drift's pieces are in the books (${others} others were)`);
  game.band = [[d.x, d.y], [HX, HY]];
  game.driftsOut();
  check(inBooks(game, Z).length === 0 && game.drifts.size === 0, 'the boulder the tether lay against did not go when the tether let it go');
  check(game.pieceOf.has(rock) && game.pieces.some(cells => cells[0] === rock), 'a loose rock of other ground beside the drift went out of the books with its boulders');
}

// ---- 6. seen from outside by a drill that never comes in
{
  const { game, Z, out: far } = await stage(7, 0, { scanner: 4 }), before = game.pieces.length;
  put(game, Z, far - Z.rho - 3);
  const seen = inBooks(game, Z).length;
  check(game.placeKey !== Z.key && seen >= 1 && game.drifts.has(Z.key), `from three cells outside, with the best scanner, ${seen} boulders are in the books and the drift is ${game.drifts.has(Z.key) ? '' : 'not '}kept`);
  put(game, Z, far - 70);
  check(inBooks(game, Z).length === 0 && game.drifts.size === 0 && game.pieces.length === before, `seen from outside and left behind, ${inBooks(game, Z).length} boulders are still in the books`);
  out.outside = { seen };

  // ---- 8. a drift's ground where the world lays no drift
  const w = game.world, i = (C - 60) * N + C + 20;
  check(w.pocketOf(C + 20, C - 60) === null, 'a pocket lies where the test wants none');
  w.setK(i, K.SOFT); w.setB(i, 33);
  for (const s of [1, N, -1, -N]) w.setK(i + s, K.EMPTY);
  let threw = null;
  try { game.enter([i]); game.driftsOut(); } catch (e) { threw = e; }
  check(!threw && game.pieceOf.has(i) && game.drifts.size === 0, `a cell of drift ground far from any drift: ${threw ?? 'entered, and a drift is kept for it'}`);
}

console.log(JSON.stringify(out));
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: a drift\'s boulders are in the books from the frame the drill comes in, as the cells stand, and out of them once it is well away, but for one the tether lies against');
process.exit(fails.length ? 1 : 0);
