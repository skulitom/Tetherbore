// The bellows (js/game.js: `quench`, RING2; the lava skin's second level, js/shop.js). With it, lava that wakes
// quenches every cell of slag within two of it to steel, not only the four beside it; never a cell of a pocket's
// ground, nor one past the tether's reach. Staged by hand in the south's ground, a cell of lava at the end of the
// first reach (40 cells), a rind of slag two cells deep all round it, one cell of the rind laid as a pocket's
// ground, and a cut beside the lava to wake it:
//   - with the lava skin's first level, or none, the slag on the lava's four sides turns, and no more, as ever;
//   - with the second, all the rind within reach turns, and the slag past the reach and the pocket's stands;
//   - each turned cell shows white (`quenched`), the ground is drawn again, nothing opens or closes, and the
//     fitting is told when three or more turn at once (`fitter.fire('lavaskin')`);
//   - the slag turns in play, not as the world lays it: the world laid there is as it was;
//   - lava one cell past the reach, woken by a cut at its edge, with slag on its four sides, one of them past the
//     reach and one of a pocket's ground: all four turn at the second level as at the first, for the reach and the
//     pocket hold only the cells the first level never reached.
// Fails on the game before there were bellows: the rind beyond the four sides stays slag; and on the bellows that
// held the four sides to the reach too, which left a side past it slag where the first level made steel.
//   node test/regress/c2-bellows.mjs
import { makeGame, world, C, N } from '../harness.mjs';
import { arena, at, fixRandom } from './lib/lasso.mjs';
const { K, B, BIOMES } = world;

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
fixRandom(6);
const pocketRow = BIOMES.findIndex(row => row && row.pocket !== null);

const stage = async skin => {
  const game = await makeGame(7, { tether: 0, lavaskin: skin }), w = game.world;
  arena(game, 46, K.SOFT, B.EMBER);
  const lava = at(39, 0), rind = [];
  for (let v = -2; v <= 2; v++) for (let u = -2; u <= 2; u++) if ((u || v) && !(u === -1 && v === 0)) { const i = at(39 + u, v); w.setK(i, K.SLAG); rind.push(i); }
  w.setK(lava, K.HAZARD);
  const pocket = at(37, -2);
  w.setB(pocket, pocketRow);
  game.changed();
  const fired = [], fire = game.fitter.fire.bind(game.fitter);
  game.fitter.fire = id => { fired.push(id); fire(id); };
  const solid = () => { let n = 0; for (let v = -3; v <= 3; v++) for (let u = -3; u <= 3; u++) n += w.k(at(39 + u, v)) !== K.EMPTY; return n; };
  const solid0 = solid(), pieces0 = game.pieces.length, version0 = game.version;
  game.finishDig(at(38, 0));
  const out = rind.filter(i => !game.within(i % N + 0.5, Math.floor(i / N) + 0.5));
  const near = [at(39, -1), at(39, 1), at(40, 0)];
  return { game, w, lava, rind, pocket, out, near, fired, opened: solid0 - solid(), loose: game.pieces.length - pieces0, drawn: game.version > version0 };
};
const kinds = (w, cells) => cells.map(i => world.KIND_NAMES[w.k(i)]).join(' ');

for (const skin of [0, 1]) {
  const s = await stage(skin), steel = s.rind.filter(i => s.w.k(i) === K.STEEL);
  check(s.w.lava.has(s.lava), `with the lava skin at ${skin} the cut did not wake the lava`);
  check(steel.length === 3 && s.near.every(i => s.w.k(i) === K.STEEL), `with the lava skin at ${skin} the lava turned ${steel.length} cells of its rind, its sides ${kinds(s.w, s.near)}`);
  check(!s.fired.includes('lavaskin'), `with the lava skin at ${skin} the fitting was told of a quench`);
}
{
  const s = await stage(2), w = s.w, inside = s.rind.filter(i => !s.out.includes(i) && i !== s.pocket);
  check(s.out.length === 5, `the staging is wrong: ${s.out.length} cells of the rind lie past the reach`);
  check(inside.every(i => w.k(i) === K.STEEL), `with the bellows the rind within reach is ${kinds(w, inside)}`);
  check(s.out.every(i => w.k(i) === K.SLAG), `with the bellows the rind past the reach is ${kinds(w, s.out)}`);
  check(w.k(s.pocket) === K.SLAG, `with the bellows the slag of a pocket's ground is ${kinds(w, [s.pocket])}`);
  check(inside.every(i => s.game.quenched.get(i) > 0) && s.drawn, 'the steel the bellows made does not show white, or the ground is not drawn again');
  check(s.opened === 2 && s.loose === 0, `the bellows opened ${s.opened} cells (the cut and the lava are 2) and made ${s.loose} pieces loose`);
  check(s.fired.includes('lavaskin'), `the fitting was not told: ${s.fired}`);
  check(inside.every(i => w.first(i) !== K.STEEL), 'the world lays steel where the bellows made it');
}
for (const skin of [1, 2]) {
  // (The fourth side, the lava's west, is the cut. The corner north-east of it lies past the reach as well, and is
  // never the first level's.)
  const game = await makeGame(7, { tether: 0, lavaskin: skin }), w = game.world;
  arena(game, 46, K.SOFT, B.EMBER);
  const lava = at(40, 0), sides = [at(41, 0), at(40, 1), at(40, -1)], corner = at(41, 1);
  for (const i of [...sides, corner]) w.setK(i, K.SLAG);
  w.setB(at(40, -1), pocketRow);
  w.setK(lava, K.HAZARD);
  game.changed();
  game.finishDig(at(39, 0));
  const out = !game.within(41.5, Math.floor(at(41, 0) / N) + 0.5);
  check(w.lava.has(lava) && out, `the staging is wrong: the lava woke ${w.lava.has(lava)}, the slag east of it past the reach ${out}`);
  check(sides.every(i => w.k(i) === K.STEEL), `with the lava skin at ${skin} the sides of lava at the reach are ${kinds(w, sides)}`);
  check(w.k(corner) === K.SLAG, `with the lava skin at ${skin} the corner past the reach is ${kinds(w, [corner])}`);
}
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: with the bellows woken lava quenches the slag two cells round it, none past the reach or in a pocket but its four sides, which turn as at the first level');
process.exit(fails.length ? 1 : 0);
