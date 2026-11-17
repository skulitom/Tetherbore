// The capacitor (js/game.js: `zap`, `charge`, CHARGE, `shatters`, `openShattered`, `finishDig`; the arc coil's second
// level, js/shop.js). With it an arc taken in charges the bit for eight seconds, and the next cut lets the charge
// go: the dense rock and slate among the eight cells round the cell cut shatter, as an arc shatters slate, and pay
// nothing. Never a cache, a cell of a pocket's ground or one past the tether's reach. Staged by hand in the east's
// ground, the drill two cells from a crystal that is made to arc, and the cut at the end of the first reach (40
// cells), round it dense rock, slate, a cache, slate of a pocket's ground and dense rock past the reach; and north
// of it a block of soft rock that hangs by the dense rock alone:
//   - at the second level, after the arc, the cut opens the dense rock and the slate, and nothing else; the block
//     is loose and in the books of loose ground at once, and the books are sound; the charge is spent;
//   - with no arc taken, the cut opens nothing;
//   - the charge is gone eight seconds after the arc, and a cut then opens nothing;
//   - at the first level an arc takes nothing in for the bit, and a cut opens nothing.
// Fails on the game before there was a capacitor: the cut after the arc opens nothing.
//   node test/regress/c2-capacitor.mjs
import { makeGame, world, C, N } from '../harness.mjs';
import { arena, rect, at, idle, fixRandom, isLoose } from './lib/lasso.mjs';
const { K, B, BIOMES } = world;

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const kinds = (w, cells) => cells.map(i => world.KIND_NAMES[w.k(i)]).join(' ');
const pocketRow = BIOMES.findIndex(row => row && row.pocket !== null);
// The books of loose ground, as the play fuzz checks them: what is wrong, or nothing.
const books = game => {
  const w = game.world, wrong = [];
  let total = 0;
  for (const p of game.pieces) {
    const set = new Set(p);
    total += p.length;
    if (p.some(c => w.k(c) === K.EMPTY)) wrong.push('a piece holds open cells');
    if (p.some(c => [c + 1, c - 1, c + N, c - N].some(j => !set.has(j) && w.k(j) !== K.EMPTY))) wrong.push('a piece is not cut off');
    const seen = new Set([p[0]]), q = [p[0]];
    for (let h = 0; h < q.length; h++) for (const j of [q[h] + 1, q[h] - 1, q[h] + N, q[h] - N]) if (set.has(j) && !seen.has(j)) { seen.add(j); q.push(j); }
    if (q.length !== set.size) wrong.push('a piece is several pieces');
    if (p.some(c => game.pieceOf.get(c) !== p)) wrong.push('pieceOf does not say a cell is in its piece');
  }
  if (game.pieceOf.size !== total) wrong.push('pieceOf holds other cells');
  return wrong;
};

const stage = async coil => {
  fixRandom(2);
  const game = await makeGame(7, { tether: 0, arccoil: coil }), w = game.world, d = game.drill;
  arena(game, 46, K.SOFT, B.LODE);
  // The drill in a tunnel east from the core, two cells short of a crystal.
  rect(game, 3, 0, 20, 0, K.EMPTY);
  d.x = d.px = C + 20.5; d.y = d.py = C + 0.5; d.mode = 'free'; d.home = false;
  game.band = [[d.x, d.y], [C + 0.5, C + 0.5]];
  w.setK(at(22, 0), K.HAZARD);
  // The cut, and round it.
  const cut = at(40, 0), dense = at(39, -1), slate = at(39, 0), cache = at(39, 1), pocket = at(40, -1), soft = at(40, 1), past = [at(41, -1), at(41, 0), at(41, 1)];
  w.setK(dense, K.DENSE); w.setK(slate, K.SLATE); w.setK(cache, K.CACHE); w.setK(pocket, K.SLATE); w.setB(pocket, pocketRow); w.setK(soft, K.SOFT);
  for (const i of past) w.setK(i, K.DENSE);
  // The block north of the dense rock, open all round but for it.
  rect(game, 37, -5, 40, -2, K.EMPTY);
  const block = [at(39, -2), at(39, -3)];
  for (const i of block) w.setK(i, K.SOFT);
  game.changed();
  return { game, w, d, cut, dense, slate, cache, pocket, soft, past, block };
};
const arc = s => s.game.zap(C + 22, C);

{
  const s = await stage(2), { game, w } = s;
  check(!isLoose(game, s.block), 'the staging is wrong: the block is loose before the cut');
  arc(s);
  check(game.charge > 7.9, `an arc taken in at the capacitor left a charge of ${game.charge}`);
  const grit = game.S.grit;
  game.finishDig(s.cut);
  check(w.k(s.dense) === K.EMPTY && w.k(s.slate) === K.EMPTY, `after the arc the cut left the dense rock ${kinds(w, [s.dense])} and the slate ${kinds(w, [s.slate])}`);
  check(w.k(s.cache) === K.CACHE && w.k(s.pocket) === K.SLATE && w.k(s.soft) === K.SOFT, `the cache, the pocket's slate and the soft rock are ${kinds(w, [s.cache, s.pocket, s.soft])}`);
  check(s.past.every(i => w.k(i) === K.DENSE), `the dense rock past the reach is ${kinds(w, s.past)}`);
  check(game.charge === 0, `the charge was not spent: ${game.charge}`);
  check(game.S.grit === grit, `the shattered ground paid ${game.S.grit - grit}`);
  check(isLoose(game, s.block) && (s.block.every(i => game.pieceOf.has(i)) || w.k(s.block[0]) === K.EMPTY), 'the block the shatter let go is not in the books of loose ground');
  const wrong = books(game);
  check(!wrong.length, `the books of loose ground: ${wrong.join('; ')}`);
  game.render();
}
{
  const s = await stage(2);
  s.game.finishDig(s.cut);
  check(s.w.k(s.dense) === K.DENSE && s.w.k(s.slate) === K.SLATE, `with no arc taken the cut left ${kinds(s.w, [s.dense, s.slate])}`);
}
{
  const s = await stage(2);
  arc(s);
  idle(s.game, 8.05);
  check(s.game.charge === 0, `eight seconds after the arc the charge is ${s.game.charge}`);
  s.game.finishDig(s.cut);
  check(s.w.k(s.dense) === K.DENSE && s.w.k(s.slate) === K.SLATE, `eight seconds after the arc the cut left ${kinds(s.w, [s.dense, s.slate])}`);
}
{
  const s = await stage(1);
  arc(s);
  check(s.game.charge === 0, `at the first level an arc charged the bit: ${s.game.charge}`);
  s.game.finishDig(s.cut);
  check(s.w.k(s.dense) === K.DENSE && s.w.k(s.slate) === K.SLATE, `at the first level the cut left ${kinds(s.w, [s.dense, s.slate])}`);
}
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: with the capacitor an arc taken in charges the bit, and the next cut shatters the dense rock and slate round it, never a cache, a pocket or past the reach; the charge lasts eight seconds, and the first level holds none');
process.exit(fails.length ? 1 : 0);
