// The bit's late levels plough (js/game.js: PLOUGH_BIT, `ploughs`, `ploughable`, the drill's `carry`). From MK6 the
// drill keeps its run through ground the bit cuts in a blink, as it does through ash, and a ploughed cut's time left
// over in its last frame goes on to the next cell. Staged by hand, a straight tunnel cut east through a strip of one
// kind of ground, the drill pushed along it for ten seconds after the first:
//   - cells a second along soft rock rise by at least fifteen in a hundred at each step of the bit from MK5 to MK8,
//     and along dense rock at MK7 and MK8, which plough it (and more than three times over, MK5 to MK8);
//   - MK5 cuts exactly as it did before there were late levels (the distances flown, pinned);
//   - MK6 ploughs soft rock and the plainer ore and not dense rock; MK7 dense rock and the richer ore and not slate;
//     MK8 slate, and steel with the diamond tip and not without it;
//   - at MK8 a cache, a hazard, a pocket's mineral, a geode's shell and a keystone's iron are not ploughed: the
//     drill stops at each as it always has, its run begun again;
//   - ore ploughed through says CRUSHED no more than once a second;
//   - at MK6 a loop flown freehand through soft rock, at any angle and never drawn square on to a block, closes,
//     and what it is round is hauled, with the tether sound at every frame.
// Fails on the game before the late bit ploughed: in soft rock MK6 was MK5 and MK8 was MK7, to the cell.
//   node test/regress/d-bit-plough.mjs
import { makeGame, farStart, tetherFaults, world, C, N } from '../harness.mjs';
import { arena, rect, at, fixRandom } from './lib/lasso.mjs';
const { K, B } = world;

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
fixRandom(4);

// How far the drill gets along a strip of `kind` in ten seconds, after a second's start: in cells a second.
const rate = async (kind, drill, ram, tip = 0) => {
  const game = await makeGame(7, { tether: 9, drill, momentum: ram, diamond: tip }), w = game.world;
  farStart(game, 30, 0);
  for (let x = C + 32; x < C + 400; x++) for (let v = -2; v <= 2; v++) w.setK((C + v) * N + x, kind);
  game.changed();
  game.input.auto = [1, 0, 1];
  for (let f = 0; f < 60; f++) game.update(1 / 60);
  const x0 = game.drill.x;
  for (let f = 0; f < 600; f++) game.update(1 / 60);
  return (game.drill.x - x0) / 10;
};
const out = { soft: [], dense: [] };
for (const bit of [4, 5, 6, 7]) { out.soft.push(+(await rate(K.SOFT, bit, 4)).toFixed(3)); out.dense.push(+(await rate(K.DENSE, bit, 4)).toFixed(3)); }
for (let n = 1; n < 4; n++) check(out.soft[n] >= out.soft[n - 1] * 1.15, `along soft rock MK${n + 5} goes ${out.soft[n]} cells a second, MK${n + 4} ${out.soft[n - 1]}: not fifteen in a hundred more`);
for (let n = 2; n < 4; n++) check(out.dense[n] >= out.dense[n - 1] * 1.15, `along dense rock MK${n + 5} goes ${out.dense[n]} cells a second, MK${n + 4} ${out.dense[n - 1]}: not fifteen in a hundred more`);
check(out.dense[1] > out.dense[0] && out.dense[3] >= 3 * out.dense[0], `along dense rock MK5 to MK8 goes ${out.dense.join(', ')} cells a second`);
// (MK5's distances, flown on the game before the late bit ploughed: to the thousandth of a cell, with no ram and the
// ram's fourth level.)
const mk5 = [await rate(K.SOFT, 4, 0), await rate(K.DENSE, 4, 0), await rate(K.SOFT, 4, 4), await rate(K.DENSE, 4, 4)].map(v => +v.toFixed(3));
check(JSON.stringify(mk5) === JSON.stringify([6.195, 4.71, 9.999, 6.6]), `MK5 goes ${mk5.join(', ')} cells a second, where it went 6.195, 4.71, 9.999 and 6.6`);

// ---- which ground each level ploughs
{
  const game = await makeGame(7, { tether: 5 }), w = game.world;
  arena(game, 30, K.SOFT, B.CRUST);
  const cells = { soft: at(10, 0), oreA: at(10, 1), dense: at(10, 2), oreB: at(10, 3), slate: at(10, 4), steel: at(10, 5) };
  const kinds = { soft: K.SOFT, oreA: K.ORE_A, dense: K.DENSE, oreB: K.ORE_B, slate: K.SLATE, steel: K.STEEL };
  for (const [name, i] of Object.entries(cells)) w.setK(i, kinds[name]);
  const ploughed = () => Object.keys(cells).filter(name => game.ploughs(cells[name])).join(' ');
  const want = ['', 'soft oreA', 'soft oreA dense oreB', 'soft oreA dense oreB slate'];
  for (const [n, bit] of [4, 5, 6, 7].entries()) { game.S.lv.drill = bit; check(ploughed() === want[n], `MK${bit + 1} ploughs [${ploughed()}], not [${want[n]}]`); }
  game.S.lv.diamond = 1;
  check(ploughed() === 'soft oreA dense oreB slate steel', `MK8 with the diamond tip ploughs [${ploughed()}]`);
  // What is never ploughed: a cache, a hazard (lava in the south), a pocket's mineral, a keystone, a geode's shell.
  const never = { cache: at(12, 0), hazard: at(12, 1), key: at(12, 2) };
  w.setK(never.cache, K.CACHE); w.setK(never.key, K.KEY); w.setK(never.hazard, K.HAZARD); w.setB(never.hazard, B.EMBER);
  for (const [name, i] of Object.entries(never)) check(!game.ploughs(i), `MK8 ploughs a ${name}`);
  // (A geode's shell is slate where the world lays a find; a pocket's mineral where it lays a pocket: looked for.)
  let shell = -1, mineral = -1;
  for (let y = C - 600; y < C + 600 && (shell < 0 || mineral < 0); y += 1) for (let x = C - 600; x < C + 600 && (shell < 0 || mineral < 0); x += 3) {
    const i = y * N + x, k = w.k(i), row = w.row(i);
    if (shell < 0 && k === K.SLATE && w.findAt(x, y) === K.SLATE) shell = i;
    if (mineral < 0 && row.pocket !== null && k === (row.pocket.kind ?? K.MINERAL)) mineral = i;
  }
  check(shell >= 0 && !game.ploughs(shell), `a geode's shell ${shell >= 0 ? 'is ploughed' : 'was not found'}`);
  check(mineral >= 0 && !game.ploughs(mineral), `a pocket's mineral ${mineral >= 0 ? 'is ploughed' : 'was not found'}`);
}

// ---- in play: slate ploughed at MK8, the run kept; a cache stops it
{
  const game = await makeGame(7, { tether: 9, drill: 7, momentum: 4 }), w = game.world, d = game.drill;
  farStart(game, 30, 0);
  for (let x = C + 32; x < C + 120; x++) for (let v = -2; v <= 2; v++) w.setK((C + v) * N + x, K.SLATE);
  // Ore A every fourth cell, to be crushed: CRUSHED no more than once a second.
  for (let x = 40; x < 120; x += 4) w.setK(at(x, 0), K.ORE_A);
  const cache = at(100, 0);
  w.setK(cache, K.CACHE);
  game.changed();
  const said = [], popup = game.popup.bind(game);
  game.popup = (x, y, label, ...rest) => { if (label === 'CRUSHED') said.push(game.time); popup(x, y, label, ...rest); };
  game.input.auto = [1, 0, 1];
  let least = Infinity, stopped = false;
  for (let f = 0; f < 900 && !stopped; f++) {
    game.update(1 / 60);
    if (f > 60 && d.dig !== cache) least = Math.min(least, d.run);
    if (d.dig === cache) stopped = true;
  }
  check(least > 1, `ploughing slate at MK8 the drill's run fell to ${least.toFixed(2)} s`);
  check(stopped && d.run === 0, `at a cache the drill ${stopped ? `kept its run of ${d.run.toFixed(2)} s` : 'never came to it'}`);
  const gaps = said.slice(1).map((t, n) => t - said[n]);
  check(said.length >= 2 && gaps.every(g => g >= 0.999), `ploughing through ore, CRUSHED came up ${said.length} times, the least gap ${Math.min(...gaps).toFixed(2)} s`);
}

// ---- a freehand loop at MK6 through soft rock
{
  const game = await makeGame(7, { tether: 4, drill: 5 }), w = game.world, d = game.drill;
  arena(game, 40, K.SOFT, B.CRUST);
  rect(game, 3, 0, 12, 0, K.EMPTY);
  d.x = C + 12.5; d.y = C + 0.5; d.mode = 'free'; d.armed = false;
  game.band = [[d.x, d.y], [C + 0.5, C + 0.5]];
  game.changed();
  // Round a circle of seven cells' radius from (19, 0), steered at each moment toward a point a little further on
  // round it: never along a row or a column for long.
  const hauls = game.S.stats.hauls, faults = [];
  let frames = 0, stuck = 0;
  for (let step = 0; step <= 40 && frames < 4000; step++) {
    const a = Math.PI + step / 40 * 2 * Math.PI, tx = C + 19.5 + Math.cos(a) * 7, ty = C + 0.5 - Math.sin(a) * 7;
    for (let f = 0; f < 240 && Math.hypot(tx - d.x, ty - d.y) > 0.8; f++, frames++) {
      game.input.auto = [(tx - d.x) / Math.hypot(tx - d.x, ty - d.y), (ty - d.y) / Math.hypot(tx - d.x, ty - d.y), 1];
      game.update(1 / 60);
      const wrong = tetherFaults(game);
      if (wrong.length && faults.length < 3) faults.push(`frame ${frames}: ${wrong[0]}`);
      if (f === 239) stuck++;
    }
  }
  // Back down the tunnel toward the core, so that the tether is round what the loop cut off.
  for (let f = 0; f < 240; f++) { game.input.auto = [-1, 0, 1]; game.update(1 / 60); const wrong = tetherFaults(game); if (wrong.length && faults.length < 3) faults.push(`home: ${wrong[0]}`); }
  game.input.auto = null;
  for (let f = 0; f < 240; f++) game.update(1 / 60);
  check(!stuck, `the loop stuck ${stuck} times`);
  check(!faults.length, `the tether went wrong: ${faults.join('; ')}`);
  check(game.S.stats.hauls > hauls && game.S.stats.best >= 100, `the loop hauled ${game.S.stats.hauls - hauls} times, the biggest ${game.S.stats.best} cells`);
  check(w.k(at(19, 0)) === K.EMPTY, 'the middle of the loop is still there');
}

console.log(JSON.stringify(out));
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: the late bit ploughs soft rock, then dense, then slate and tipped steel, faster at every step and MK5 as it was; caches, hazards, minerals, geodes and keys stop it, and a freehand loop at MK6 is cut and hauled with the tether sound');
process.exit(fails.length ? 1 : 0);
