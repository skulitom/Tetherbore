// What one cut may cost in World.freed, counted in work and not in time: outline sides walked (`world.sides`),
// cells followed (`world.followed`) and pieces of unseen world made (`world.made`). Before, both sides of a cut were
// flooded, each to 120,000 cells, making unseen world as they went: 240 to 360 ms in one frame when the outline
// walk had not joined them (the verifiers' soak and big-loop-cut). Now only outlines are walked to find out what is
// loose, and only an island's own ground is followed. Played: the drill makes each cut by steering.
//
// 1. The cut that closes a loop round 300 x 300 cells of natural ground: the piece is known, and nothing but the
//    piece is followed.
// 2. The same round 400 x 400 (more than the 120,000 cells a piece may have): nothing is known, and no more than
//    those 120,000 cells are followed.
// 3. A cut through the wall between two long corridors, each with over 20,000 sides of wall and no way round but
//    the cut: nothing comes loose, nothing is followed at all, and the walk gives up within its 60,000 sides.
//   node test/regress/g-loop-cut.mjs
import { makeGame, tetherFaults, C, N, K } from '../harness.mjs';

const at = (x, y) => (C + y) * N + C + x;
let bad = 0;
const report = (name, game, ok, extra) => {
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${extra}; tether faults ${tetherFaults(game).length}`);
};
// The drill, set down on the way it would have flown (`road`: the corners of that way, from the core out), flies
// the last few cells east along the row to a cell and cuts the cell beyond it the way given; returns what that
// frame's cut cost.
function cutFrom(game, x, y, way, target, road = []) {
  const d = game.drill, w = game.world;
  d.x = C + x - 3 + 0.5; d.y = C + y + 0.5; d.mode = 'free'; d.armed = false;
  game.band = [[d.x, d.y], [C + 0.5, C + 0.5]];
  for (const [rx, ry] of road) game.lead(game.band, [C + rx + 0.5, C + ry + 0.5]);
  game.lead(game.band, [d.x, d.y]);
  game.changed();
  if (tetherFaults(game).length) throw new Error(`staging is wrong: ${tetherFaults(game)}`);
  const fly = (auto, until, most) => { for (let f = 0; f < most && !until(); f++) { game.input.auto = auto; game.update(1 / 60); } if (!until()) throw new Error(`never got there: at ${(d.x - C).toFixed(1)},${(d.y - C).toFixed(1)}`); };
  fly([1, 0, 0.6], () => d.x >= C + x + 0.4, 600);
  fly([Math.sign(C + x + 0.5 - d.x) || 1, 0, 0.55], () => Math.abs(d.x - (C + x + 0.5)) < 0.12, 900);
  const before = { sides: w.sides, followed: w.followed, made: w.made };
  let cost = null;
  for (let f = 0; f < 600 && !cost; f++) {
    game.input.auto = [way[0], way[1], 1];
    const now = { sides: w.sides, followed: w.followed, made: w.made };
    game.update(1 / 60);
    if (w.k(target) === K.EMPTY) cost = { sides: w.sides - now.sides, followed: w.followed - now.followed, made: w.made - now.made };
  }
  if (!cost) throw new Error('the cut was never made');
  game.input.auto = null;
  for (let f = 0; f < 30; f++) game.update(1 / 60);
  return cost;
}

for (const [W, most] of [[300, true], [400, false]]) {
  const game = await makeGame(7, { tether: 9, drill: 4, momentum: 4 }), w = game.world, X = 800;
  // Staged: tunnels one cell wide along row 0 from the core and round three sides of the square, all but one cell.
  for (let x = 3; x <= X; x++) w.setK(at(x, 0), K.EMPTY);
  for (let y = 0; y >= -W; y--) w.setK(at(X, y), K.EMPTY);
  for (let x = X; x >= X - W; x--) w.setK(at(x, -W), K.EMPTY);
  for (let y = -W; y <= -2; y++) w.setK(at(X - W, y), K.EMPTY);
  w.setK(at(X - W, -1), K.SOFT);
  game.pieces = []; game.changed();
  const cost = cutFrom(game, X - W, 0, [0, -1], at(X - W, -1)), big = game.pieces.map(p => p.length).filter(n => n > 1000);
  const ok = most
    ? big.length === 1 && cost.followed <= big[0] + 50 && cost.sides <= 20000 && cost.made <= 20
    : big.length === 0 && cost.followed <= 120001 && cost.sides <= 20000 && cost.made <= 30;
  report(`a loop closed round ${W} x ${W}`, game, ok, `${big.length ? `a piece of ${big[0]} cells is known` : 'no piece is known'}; the cut walked ${cost.sides} sides, followed ${cost.followed} cells and made ${cost.made} pieces of world`);
}
{
  const game = await makeGame(7, { tether: 6, drill: 4, momentum: 4 }), w = game.world;
  // Staged in solid ground: a way from the core down to row 10 and east along it to x = 120; a corridor of 110 rows
  // folded back and forth off that row (west of x = 119), and another, closed, east of x = 121.
  for (let y = 3; y <= 240; y++) for (let x = -3; x <= 226; x++) w.setK(at(x, y), K.SOFT);
  for (let y = 3; y <= 10; y++) w.setK(at(0, y), K.EMPTY);
  for (let x = 0; x <= 120; x++) w.setK(at(x, 10), K.EMPTY);
  w.setK(at(60, 11), K.EMPTY);
  for (let k = 0; k < 110; k++) {
    for (let x = 20; x <= 118; x++) w.setK(at(x, 12 + 2 * k), K.EMPTY);
    if (k < 109) w.setK(at(k % 2 ? 20 : 118, 13 + 2 * k), K.EMPTY);
    for (let x = 122; x <= 220; x++) w.setK(at(x, 10 + 2 * k), K.EMPTY);
    if (k < 109) w.setK(at(k % 2 ? 122 : 220, 11 + 2 * k), K.EMPTY);
  }
  game.pieces = []; game.changed();
  // (The first piece beside the core, four cells, is all that lies loose here.)
  const cost = cutFrom(game, 120, 10, [1, 0], at(121, 10), [[0, 10]]), loose = game.pieces.filter(p => p.length > 4).length;
  const ok = !loose && cost.followed === 0 && cost.sides <= 60000 && cost.sides >= 20000 && cost.made <= 2;
  report('a cut through the wall between two long corridors', game, ok, `${loose} pieces came loose; the cut walked ${cost.sides} sides, followed ${cost.followed} cells and made ${cost.made} pieces of world`);
}
console.log(bad ? 'DEFECT: a cut did more work than its outlines and what it freed' : 'no defect');
process.exit(bad ? 1 : 0);
