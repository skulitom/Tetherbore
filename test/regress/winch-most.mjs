// No game is left with nothing to cut and a rope it cannot pay for. One was: a tunnel cut right round a reach of
// 230 lassoed the whole of it, a hundred and sixty thousand cells, the winch drew that in for the pay of six
// thousand (over its load a haul pays less a cell), and with nothing left in reach the next reach cost four times
// the grit there was. Two things hold now. The winch draws in no more than forty times its load at once: a piece
// larger than that hangs where it is and the game says why, while smaller pieces wound with it still come. And the
// next reach costs less where the ground this one reaches is spent, down to next to nothing.
import { makeGame, UPGRADES, C, N, K } from '../harness.mjs';

const { HAUL_MOST } = await import('../../js/game.js'), { textWidth } = await import('../../js/atlas.js');
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

check(HAUL_MOST === 40, `the winch draws in ${HAUL_MOST} times its load`);

// ---- a piece over what the winch draws in stays, and the game says why; a smaller one wound with it comes
{
  const game = await makeGame(7, { tether: 6 }), w = game.world;
  // (The first winch's load is 150 cells: it draws in 6,000.)
  const big = block(game, 20, -45, 90, 90), small = block(game, 120, -10, 20, 20);
  game.changed();
  game.pieces = game.pieces.filter(p => p.length < 400).concat([big, small]); game.changed();
  check(game.pieces.includes(big) && game.pieces.includes(small), 'the two blocks are not known to hang loose');
  // The tether, round both: out under them, up the far side, back over them, and home.
  game.band = [[C + 10.5, C - 60.5], [C + 150.5, C - 60.5, 0, 0, 0], [C + 150.5, C + 60.5, 0, 0, 0], [C + 10.5, C + 60.5, 0, 0, 0], [C + 0.5, C + 0.5]];
  const d = game.drill; d.x = d.px = C + 10.5; d.y = d.py = C - 60.5; d.home = false;
  const hauls = game.S.stats.hauls;
  game.reelIfRound();
  // (With it comes whatever else small the loop is round: the first loose piece of a new game lies beside the core.)
  check(game.S.stats.hauls === hauls + 1 && game.S.stats.best >= small.length && game.S.stats.best < small.length + 40 && small.every(i => w.k(i) === K.EMPTY), `the small block wound with the great one: ${game.S.stats.hauls - hauls} hauls, the largest ${game.S.stats.best} cells`);
  check(big.every(i => w.k(i) === K.SOFT) && game.pieces.includes(big), `${big.filter(i => w.k(i) !== K.SOFT).length} cells of the block of ${big.length} are gone`);
  check(game.notice?.title === 'TOO BIG' && game.notice.sub === '8.1K CELLS. WINCH DRAWS 6.0K' && textWidth(game.notice.title, 2) < 170 && textWidth(game.notice.sub) < 170, `the game says '${game.notice?.title}', '${game.notice?.sub}'`);
  // It does not say so again at once, however often it is asked; and with a winch that draws it, the block comes.
  game.notice = null; game.reelIfRound();
  check(game.notice === null, 'asked again at once, the game said so again');
  game.S.lv.winch = 1; game.reelIfRound();
  check(big.every(i => w.k(i) === K.EMPTY) && game.S.stats.best >= big.length, `with the second winch (it draws ${HAUL_MOST * 400}) ${big.filter(i => w.k(i) === K.EMPTY).length} of the block's ${big.length} cells came`);
  game.resize(320, 568, 1); game.render();
}

// ---- the next reach costs less where the ground within this one is spent
{
  const game = await makeGame(7, { tether: 5 }), w = game.world, list = reach.grit[5];
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
  // The game that was stuck: 72 thousand grit, everything within 230 gone. It buys the reach and goes on.
  game.S.grit = 72000; game.S.out = 229;
  check(game.canBuy(reach), `with 72,000 grit and the ground spent the next reach ${game.lacks(reach) ?? 'cannot be paid for'}`);
  game.buy(reach);
  check(game.val('tether') === 420 && game.S.grit === 72000 - least && game.groundLeft() === 1, `bought: a reach of ${game.val('tether')}, ${game.S.grit} grit left, and the reach after costs ${game.groundLeft()} of its price`);
  // The shop says why the price is what it is.
  game.S.lv.tether = 5; game.shop = true; game.shopRise = 1; game.resize(320, 568, 1); game.render();
  // No other row's price moves.
  check(UPGRADES.filter(u => u.id !== 'tether').every(u => game.cost(u) === null || game.cost(u).grit === u.grit[game.S.lv[u.id]]), 'a row other than the reach costs something other than its price');
}

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : 'no defect: the winch leaves hanging what is over forty times its load and says so, draws in what is under it, and the next reach costs less where the ground is spent: a game with everything in reach gone buys it and goes on');
process.exit(fails.length ? 1 : 0);
