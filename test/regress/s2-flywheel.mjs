// The flywheel (js/game.js: `spin`, `payOf`, `haul`, `hit`, `haulTitle`; WORKS, js/shop.js). With it, a haul of a
// dozen cells or more made within six seconds of the last of its run is the next of the run, and pays its cells'
// grit (not its lumps) eight in a hundred more for each haul of the run before it, up to the row's value. Staged
// by hand, blocks of dense rock two hundred cells out hauled one after another, the clock moved on between them:
//   - at the first level (+40%) hauls of twenty cells three seconds apart pay x1, x1.08, x1.16 ... and x1.4 from the
//     sixth on, against what the same cells pay with no flywheel; the third and on are called SPIN x2 ...;
//   - a haul of eleven cells is paid as ever and adds no link;
//   - a haul more than six seconds after the last begins the run again, and so does a knock;
//   - a game begun, or gone back to its docking, has no run;
//   - at the second level (+60%) a haul of twelve cells at the most the run gives still pays less a cell than one
//     loop of 2,304 at the winch's fifth level, where the load is 5,000;
//   - with no flywheel nothing changes: the run is never counted.
// Fails on the game before there was a flywheel: every haul pays x1.
//   node test/regress/s2-flywheel.mjs
import { makeGame, world, C, N } from '../harness.mjs';
import { at, fixRandom } from './lib/lasso.mjs';
import { haulTitle } from '../../js/game.js';
const { K, B } = world;

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
fixRandom(3);
let row = 0;
// A fresh block of `n` cells of dense rock, 200 cells east of the core.
const block = (game, n) => {
  const cells = [];
  for (let k = 0; k < n; k++) { const i = at(200 + (k % 5), row + Math.floor(k / 5)); game.world.setK(i, K.DENSE); game.world.setB(i, B.LODE); cells.push(i); }
  row += Math.ceil(n / 5) + 1;
  return cells;
};
// What the cells pay with no flywheel, asked of the same game.
const plain = (game, cells) => { const was = game.S.lv.flywheel; game.S.lv.flywheel = 0; const pay = game.payOf(cells); game.S.lv.flywheel = was; return pay.grit; };

{
  const game = await makeGame(7, { tether: 9, flywheel: 1 }), ratios = [], titles = [];
  for (let h = 0; h < 8; h++) {
    const cells = block(game, 20), base = plain(game, cells);
    game.haul(cells);
    ratios.push(+(game.hauled.grit / base).toFixed(2)); titles.push(game.hauled.title);
    game.time += 3;
  }
  check(ratios.join() === '1,1.08,1.16,1.24,1.32,1.4,1.4,1.4', `twenty-cell hauls three seconds apart paid x${ratios.join(', x')}`);
  check(titles[0] !== 'SPIN x1' && titles[2] === 'SPIN x2' && titles[7] === 'SPIN x7', `the hauls were called ${titles.join(', ')}`);
  // Eleven cells: paid as ever, and no link.
  const n = game.spin.n, small = block(game, 11), base = plain(game, small);
  game.haul(small);
  check(game.hauled.grit === base && game.spin.n === n, `an eleven-cell haul paid x${(game.hauled.grit / base).toFixed(2)} and the run went from ${n} to ${game.spin.n}`);
  game.time += 3;
  const next = block(game, 20), was = plain(game, next);
  game.haul(next);
  check(+(game.hauled.grit / was).toFixed(2) === 1.4, `after the eleven-cell haul the next paid x${(game.hauled.grit / was).toFixed(2)}`);
  // More than six seconds: the run begins again.
  game.time += 6.5;
  const late = block(game, 20), lateBase = plain(game, late);
  game.haul(late);
  check(game.hauled.grit === lateBase && game.spin.n === 1, `six and a half seconds on a haul paid x${(game.hauled.grit / lateBase).toFixed(2)}, the run ${game.spin.n}`);
  game.time += 3;
  game.haul(block(game, 20));
  // A knock: the run begins again.
  game.shield = 0;
  check(game.hit(0.1) && game.spin.n === 0, `a knock left the run at ${game.spin.n}`);
  game.time += 1;
  const after = block(game, 20), afterBase = plain(game, after);
  game.haul(after);
  check(game.hauled.grit === afterBase, `just after a knock a haul paid x${(game.hauled.grit / afterBase).toFixed(2)}`);
  game.time += 1;
  game.haul(block(game, 20));
  game.begin();
  check(game.spin.n === 0, 'a game begun again kept the run');
  const spin = game.spin;
  game.time += 1; game.haul(block(game, 20)); game.time += 1; game.haul(block(game, 20));
  game.revert();
  check(game.spin === spin && game.spin.n === 0, `gone back to its docking the game has a run of ${game.spin.n}${game.spin === spin ? '' : ', and a new one made'}`);
}
{
  // The most the run gives on a dozen cells, against one great loop: a cell's grit each, all at one place.
  const game = await makeGame(7, { tether: 9, flywheel: 2, winch: 4 });
  const cell = n => Array.from({ length: n }, () => ({ k: K.DENSE, b: B.LODE, x: C + 300, y: C }));
  game.spin.t = game.time; game.spin.n = 20;
  const small = game.payOf([], cell(12)), big = (game.spin.n = 0, game.payOf([], cell(2304)));
  check(small.spin === 20 && small.grit / 12 < big.grit / 2304, `a dozen cells at the flywheel's most pay ${(small.grit / 12).toFixed(1)} a cell, a loop of 2,304 ${(big.grit / 2304).toFixed(1)}`);
}
{
  const game = await makeGame(7, { tether: 9 }), ratios = [];
  for (let h = 0; h < 4; h++) { const cells = block(game, 20), base = plain(game, cells); game.haul(cells); ratios.push(game.hauled.grit / base); game.time += 3; }
  check(ratios.every(r => r === 1) && game.spin.n === 0, `with no flywheel hauls paid x${ratios.join(', x')} and the run is ${game.spin.n}`);
}
check(haulTitle(20, {})[0] === 'NICE CUT!' && haulTitle(20, { spin: 2 })[0] === 'SPIN x2' && haulTitle(20, { spin: 2, caches: 1 })[0] === 'CACHE!', 'the titles of a haul in a run are not as they should be');
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: with the flywheel a run of quick hauls pays eight in a hundred more a haul up to the row\'s value; a small haul adds nothing, a wait or a knock begins it again, and a dozen cells never beat one great loop');
process.exit(fails.length ? 1 : 0);
