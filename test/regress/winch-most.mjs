// No game is left with nothing to cut and a rope it cannot pay for. One was: a tunnel cut right round a reach of
// 230 lassoed the whole of it, a hundred and sixty thousand cells, the winch drew that in for the pay of six
// thousand (over its load a haul pays less a cell), and with nothing left in reach the next reach cost four times
// the grit there was. Now the next reach costs less where the ground this one reaches is spent, down to next to
// nothing. And there is no most the winch draws in: it once drew in no more than forty times its load and said
// TOO BIG of the rest, so that half the longest reach could never be hauled. Whatever the tether is round comes, in
// one haul, and a piece over the winch's load pays less a cell (`overload`).
import { makeGame, UPGRADES, C, N, K } from '../harness.mjs';

const game0 = await import('../../js/game.js'), { overload, haulBonus } = game0;
const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const reach = UPGRADES.find(u => u.id === 'tether');
// A block of solid ground `w` by `h` cells with its corner at (x0, y0) from the core, standing in open ground, and
// a tether laid right round it and home.
const block = (game, x0, y0, w, h) => {
  const cells = [], world = game.world;
  for (let y = y0 - 3; y < y0 + h + 3; y++) for (let x = x0 - 3; x < x0 + w + 3; x++) {
    const i = (C + y) * N + C + x, inside = x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
    world.setK(i, inside ? K.SOFT : K.EMPTY); world.setB(i, 0);
    if (inside) cells.push(i);
  }
  return cells;
};

check(game0.HAUL_MOST === undefined, 'the game still has a most that the winch draws in');

// ---- a piece fifty times the first winch's load comes, with a small one wound with it, in one haul at less a cell
{
  const game = await makeGame(7, { tether: 6 }), w = game.world;
  // (The first winch's load is 150 cells; the great block is 8,100, which the winch once refused.)
  const big = block(game, 20, -45, 90, 90), small = block(game, 120, -10, 20, 20);
  game.changed();
  game.pieces = game.pieces.filter(p => p.length < 400).concat([big, small]); game.changed();
  check(game.pieces.includes(big) && game.pieces.includes(small), 'the two blocks are not known to hang loose');
  // The tether, round both: out under them, up the far side, back over them, and home.
  game.band = [[C + 10.5, C - 60.5], [C + 150.5, C - 60.5, 0, 0, 0], [C + 150.5, C + 60.5, 0, 0, 0], [C + 10.5, C + 60.5, 0, 0, 0], [C + 0.5, C + 0.5]];
  const d = game.drill; d.x = d.px = C + 10.5; d.y = d.py = C - 60.5; d.home = false;
  const hauls = game.S.stats.hauls;
  game.reelIfRound();
  // (With them comes whatever else small the loop is round: the first loose piece of a new game lies beside the core.)
  const n = game.hauled?.n;
  check(game.S.stats.hauls === hauls + 1 && n >= big.length + small.length && n < big.length + small.length + 40, `the blocks came in ${game.S.stats.hauls - hauls} hauls, the last of ${n} cells`);
  check(big.every(i => w.k(i) === K.EMPTY) && small.every(i => w.k(i) === K.EMPTY) && !game.pieces.includes(big), `${big.filter(i => w.k(i) !== K.EMPTY).length} cells of the great block and ${small.filter(i => w.k(i) !== K.EMPTY).length} of the small are still there`);
  check(game.notice?.title !== 'TOO BIG', `the game says '${game.notice?.title}'`);
  check(game.hauled.over === overload(n, 0) && game.hauled.over < 0.2 && Math.abs(game.hauled.mult - haulBonus(n, 1) * game.hauled.over) < 1e-9, `over the load the haul is at ${game.hauled.over} of full pay, x${game.hauled.mult}`);
  check(game.banner?.giant === 2 && game.banner.title === 'TITANIC!', `the haul is called ${game.banner?.title}`);
  game.resize(320, 568, 1); game.render();
}

// ---- ground cut loose is found however big it is (past 120,000 cells it was held), and the book of it stays right
{
  const game = await makeGame(7, { tether: 6 }), w = game.world, book = game.pieceOf;
  const big = block(game, 30, -250, 500, 500), plug = [];
  // A plug of ground across the moat holds the block to the world, and then it is cut.
  for (let x = 27; x < 30; x++) { const i = (C - 100) * N + C + x; w.setK(i, K.SOFT); plug.push(i); }
  game.changed();
  check(!book.has(big[0]), 'the block is loose while the plug holds it');
  for (const i of plug) w.setK(i, K.EMPTY);
  game.changed(plug);
  const piece = book.get(big[0]), inBook = () => game.pieces.reduce((sum, cells) => sum + cells.length, 0);
  check(piece && piece.length === big.length && big.every(i => book.get(i) === piece) && book.size === inBook(), `the block of ${big.length} cut loose is ${piece ? `a piece of ${piece.length}` : 'held'}, the book holds ${book.size} cells of ${inBook()}`);
  // A tether round it, and it comes in one haul; the book lets go of it.
  game.band = [[C + 25.5, C - 260.5], [C + 540.5, C - 260.5, 0, 0, 0], [C + 540.5, C + 260.5, 0, 0, 0], [C + 25.5, C + 260.5, 0, 0, 0], [C + 0.5, C + 0.5]];
  const d = game.drill; d.x = d.px = C + 25.5; d.y = d.py = C - 260.5; d.home = false;
  game.reelIfRound();
  check(big.every(i => w.k(i) === K.EMPTY) && game.hauled.n >= big.length && game.banner?.title === 'CONTINENTAL!', `the block came as a haul of ${game.hauled?.n}, ${game.banner?.title}`);
  check(!book.has(big[0]) && book.size === inBook() && !book.ids?.has(piece), `after the haul the book holds ${book.size} cells of ${inBook()}, and ${book.ids?.has(piece) ? 'still' : 'no longer'} the block`);
}

// ---- the next reach costs less where the ground within this one is spent
{
  const game = await makeGame(7, { tether: 4 }), w = game.world, list = reach.grit[4];
  check(game.groundLeft() === 1 && game.cost(reach).grit === list, `with the ground as the seed laid it the next reach costs ${game.cost(reach).grit} of ${list}`);
  // Every cell within the reach opened, but a rim five cells wide at its edge.
  const R = game.val('tether'), open = (from, to) => { for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) { const r = Math.hypot(x, y); if (r >= from && r < to && r > 4) w.setK((C + y) * N + C + x, K.EMPTY); } game.version++; };
  open(0, R * 0.6);
  const part = game.groundLeft();
  check(part === 1, `with the inner third of the ground gone the next reach costs ${part} of its price`);
  open(0, R * 0.9);
  const less = game.cost(reach).grit;
  check(less < list * 0.6 && less > list * 0.2, `with four fifths of the ground gone the next reach costs ${less} of ${list}`);
  open(0, R - 5);
  const least = game.cost(reach).grit;
  check(least < list * 0.03 && least >= 1, `with all but a rim of the ground gone the next reach costs ${least} of ${list}`);
  // A game that is stuck: 72 thousand grit, everything within its reach of 250 gone. It buys the reach and goes on.
  game.S.grit = 72000; game.S.out = 249;
  check(game.canBuy(reach), `with 72,000 grit and the ground spent the next reach ${game.lacks(reach) ?? 'cannot be paid for'}`);
  game.buy(reach);
  check(game.val('tether') === 400 && game.S.grit === 72000 - least && game.groundLeft() === 1, `bought: a reach of ${game.val('tether')}, ${game.S.grit} grit left, and the reach after costs ${game.groundLeft()} of its price`);
  // The shop says why the price is what it is.
  game.S.lv.tether = 4; game.shop = true; game.shopRise = 1; game.resize(320, 568, 1); game.render();
  // No other row's price moves.
  check(UPGRADES.filter(u => u.id !== 'tether').every(u => game.cost(u) === null || game.cost(u).grit === u.grit[game.S.lv[u.id]]), 'a row other than the reach costs something other than its price');
}

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : 'no defect: the winch draws in whatever the tether is round, at less a cell over its load, and the next reach costs less where the ground is spent: a game with everything in reach gone buys it and goes on');
process.exit(fails.length ? 1 : 0);
