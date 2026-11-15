// Ground that grows back against a loose piece (ice over a cut, basalt, moss), counted in work: cells followed
// (`world.followed`). Before, the piece was flooded afresh with a limit of every loose cell in the books, so a
// piece that had grown on to held ground flooded that many cells of the mainland before it was known to be held:
// 29 to 62 ms a time in the verifiers' soak with one large piece known. Now what the grown cell belongs to is
// followed from that cell, through loose ground and the cells that grew and no further: held ground is known at
// the first step on to it.
//
// Staged: a block of 173 x 173 cells in a ring of open cells one wide, cut loose by one cell (so the game knows it:
// 29,929 cells), and a second, small block beside it in a ring of its own.
// 1. The cut cell grows back: the block is held again, and next to nothing was followed to know it.
// 2. A cell grows between the two blocks: they are one piece. 3. A cell grows on the block's far side, touching
//    nothing else: the block has one cell more.
//   node test/regress/g-regrow.mjs
import { makeGame, C, N, K } from '../harness.mjs';

const at = (x, y) => (C + y) * N + C + x;
let bad = 0;
const check = (name, ok, said) => { if (!ok) bad++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${said}`); };
async function stage() {
  const game = await makeGame(7, { tether: 6 }), w = game.world;
  for (let y = 20; y <= 230; y++) for (let x = 20; x <= 260; x++) w.setK(at(x, y), K.SOFT);
  // The big block at 40..212 square, its ring at 39 and 213; the small block 216..219 x 100..103, its ring beside.
  for (let v = 39; v <= 213; v++) for (const e of [39, 213]) { w.setK(at(v, e), K.EMPTY); w.setK(at(e, v), K.EMPTY); }
  for (let v = 99; v <= 104; v++) for (const e of [99, 104]) w.setK(at(v - 99 + 215, e), K.EMPTY);
  for (let y = 99; y <= 104; y++) w.setK(at(220, y), K.EMPTY);
  for (const [x, y] of [[214, 100], [214, 101], [214, 102], [214, 103]]) w.setK(at(x, y), K.SOFT);        // the wall between the two rings
  w.setK(at(215, 100), K.EMPTY); w.setK(at(215, 101), K.EMPTY); w.setK(at(215, 102), K.EMPTY); w.setK(at(215, 103), K.EMPTY);
  // The neck that held the big block, and the cut that frees it.
  w.setK(at(100, 39), K.SOFT);
  game.pieces = []; game.changed();
  w.setK(at(100, 39), K.EMPTY);
  game.changed([at(100, 39)]);
  // The small block is cut loose the same way.
  w.setK(at(217, 99), K.SOFT); game.changed([], [at(217, 99)]);
  w.setK(at(217, 99), K.EMPTY); game.changed([at(217, 99)]);
  return game;
}
const sizes = game => game.pieces.map(p => p.length).filter(n => n > 4).sort((a, b) => a - b).join(',');
{
  const game = await stage(), w = game.world;
  check('staged', sizes(game) === '16,29929', `pieces of ${sizes(game)} cells are known`);
  const before = w.followed;
  w.setK(at(100, 39), K.ICE);
  game.changed([], [at(100, 39)]);
  const followed = w.followed - before;
  check('the cut grows back', sizes(game) === '16' && followed <= 100, `pieces known now: ${sizes(game)}; ${followed} cells were followed to know it`);
}
{
  const game = await stage(), w = game.world;
  // The wall between the rings is 213 (open), 214 (ground), 215 (open): ground growing in all three at one row
  // joins the two blocks through it.
  for (const x of [213, 215]) w.setK(at(x, 101), K.BASALT);
  game.changed([], [at(213, 101), at(215, 101)]);
  check('a cell grows on to held ground between the blocks', sizes(game) === '', `pieces known now: ${sizes(game) || 'none'}`);
}
{
  const game = await stage(), w = game.world;
  w.setK(at(39, 150), K.EMPTY); w.setK(at(38, 150), K.EMPTY); w.setK(at(38, 149), K.EMPTY); w.setK(at(38, 151), K.EMPTY); w.setK(at(37, 150), K.EMPTY);
  game.changed([at(38, 150), at(38, 149), at(38, 151), at(37, 150)]);
  const before = w.followed;
  w.setK(at(39, 150), K.ICE);
  game.changed([], [at(39, 150)]);
  check('a cell grows on the block alone', sizes(game) === '16,29930', `pieces known now: ${sizes(game)}; ${w.followed - before} cells were followed`);
  // And two loose pieces grown together are one: the wall between their rings is taken away first.
  for (let y = 100; y <= 103; y++) w.setK(at(214, y), K.EMPTY);
  game.changed([at(214, 100), at(214, 101), at(214, 102), at(214, 103)]);
  w.setK(at(213, 101), K.BASALT); w.setK(at(214, 101), K.BASALT); w.setK(at(215, 101), K.BASALT);
  game.changed([], [at(213, 101), at(214, 101), at(215, 101)]);
  check('ground grows between two loose pieces', sizes(game) === '29949', `pieces known now: ${sizes(game)}`);
  const all = new Set(game.pieces.flat());
  check('the books agree', game.pieceOf.size === all.size && game.pieces.every(p => p.every(c => game.pieceOf.get(c) === p && w.k(c) !== K.EMPTY)), `${game.pieceOf.size} cells in the book, ${all.size} in the pieces`);
}
console.log(bad ? 'DEFECT: ground that grew back was not rightly entered, or the held ground beside it was followed' : 'no defect');
process.exit(bad ? 1 : 0);
