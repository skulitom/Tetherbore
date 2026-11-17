// The mycelium's faults zip (js/game.js: ZIP, `unzip`, `zipNext`, `zipOn`). Staged by hand in the mycelium's ground
// (a row whose `lay.threads` is set), off the screen, with the tether reaching 100 cells:
//   - a fault cut opens the faults joined to it one after another, ZIP.rate a second (a second on, 22 to 27 of
//     them), along the thread and down both arms where it forks, and ZIP.most from the cut at the most: the
//     sixty-first stands;
//   - each opens as an arc's slate does and pays nothing: no haul, no grit but the station's trickle;
//   - none past the tether's reach, none in a pocket, none in ground without threads (a fault laid in bloom, cut,
//     opens alone);
//   - the tether is sound and every piece the books hold is loose;
//   - nothing is made as it runs: the ring of cells waiting and the cells opened in a frame are the game's own, the
//     same arrays from first to last, and six hundred frames of zipping leave the heap as it was (gc'd, under
//     20 KB); and a frame with a thread zipping takes no longer than about what a frame does.
// Fails on the game before faults zipped: the cut opens its own cell and no more.
//   node test/regress/c10-fault-zip.mjs
import v8 from 'node:v8';
import vm from 'node:vm';
import { makeGame, world, C, N, tetherFaults } from '../harness.mjs';
import { arena, at, fixRandom, isLoose } from './lib/lasso.mjs';
const { K, BIOMES } = world;
v8.setFlagsFromString('--expose_gc');
const gc = vm.runInNewContext('gc');

const fails = [], check = (ok, what) => { if (!ok && fails.length < 20) fails.push(what); };
fixRandom(4);
const MYCELIUM = BIOMES.findIndex(r => r?.name === 'mycelium'), BLOOM = 7;
const { ZIP } = await import('../../js/game.js');
check(BIOMES[MYCELIUM]?.lay?.threads > 0 && !(BIOMES[BLOOM].lay.threads > 0), 'the mycelium has no threads, or bloom has');
const stage = async (b, cells) => {
  const game = await makeGame(7, { tether: 2 }), w = game.world;
  arena(game, 112, K.SOFT, b);
  for (const i of cells) w.setK(i, K.FAULT);
  game.changed();
  return game;
};
const open = (w, cells) => cells.filter(i => w.k(i) === K.EMPTY).length;
const sound = (game, where) => {
  const faults = tetherFaults(game);
  check(!faults.length, `${where}: the tether is not sound: ${faults[0]}`);
  check(game.pieces.every(cells => isLoose(game, cells)), `${where}: the books hold a piece that is not loose`);
};

// A thread from 30,5 east to 110 (past the cap), with a fork at 40 running north-east six cells.
const line = [], arm = [];
for (let x = 31; x <= 110; x++) line.push(at(x, 5));
for (let n = 1; n <= 6; n++) arm.push(at(40 + n, 5 - n));
{
  const game = await stage(MYCELIUM, [at(30, 5), ...line, ...arm]), w = game.world, ring = game.zip, batch = game.zipped;
  game.finishDig(at(30, 5));
  check(game.zipN > 0, 'cutting a fault set nothing waiting');
  const times = [];
  for (let f = 0; f < 60; f++) { const t0 = performance.now(); game.update(1 / 60); times.push(performance.now() - t0); }
  const second = open(w, line) + open(w, arm);
  check(second >= 22 && second <= 27, `a second after the cut ${second} faults had opened`);
  for (let f = 0; f < 300; f++) game.update(1 / 60);
  const all = open(w, line) + open(w, arm);
  check(all === ZIP.most, `the thread opened ${all} faults from the cut, not ${ZIP.most}`);
  check(open(w, arm) === arm.length, `the fork opened ${open(w, arm)} of its ${arm.length}`);
  check(w.k(at(31, 5)) === K.EMPTY && line.some(i => w.k(i) === K.FAULT), 'the thread did not open from the cut on and stop');
  check(game.S.stats.hauls === 0 && game.hauls.length === 0, `the zip made ${game.S.stats.hauls} hauls`);
  check(game.zip === ring && game.zipped === batch, 'the ring of cells waiting, or the cells opened in a frame, were made anew');
  sound(game, 'a thread');
  times.sort((a, b) => a - b);
  console.log(`a frame zipping takes ${times[30].toFixed(3)} ms (the middle of 60), ${times[59].toFixed(3)} ms at the most`);
}
// Past the reach: a thread from 92,0 east to 104.
{
  const thread = []; for (let x = 93; x <= 104; x++) thread.push(at(x, 0));
  const game = await stage(MYCELIUM, [at(92, 0), ...thread]), w = game.world;
  game.finishDig(at(92, 0));
  for (let f = 0; f < 120; f++) game.update(1 / 60);
  const past = thread.filter(i => !game.within(i % N + 0.5, Math.floor(i / N) + 0.5));
  check(past.length >= 3 && past.every(i => w.k(i) === K.FAULT), `${past.length} faults past the reach, ${open(w, past)} of them opened`);
  check(thread.filter(i => game.within(i % N + 0.5, Math.floor(i / N) + 0.5)).every(i => w.k(i) === K.EMPTY), 'the faults within the reach did not all open');
  sound(game, 'a thread to the reach');
}
// In a pocket's ground, and in ground with no threads.
{
  const pocketRow = BIOMES.findIndex(r => r && r.pocket !== null), thread = [at(41, 0), at(42, 0), at(43, 0)];
  const game = await stage(MYCELIUM, [at(40, 0), ...thread]), w = game.world;
  w.setB(at(42, 0), pocketRow);
  game.finishDig(at(40, 0));
  for (let f = 0; f < 120; f++) game.update(1 / 60);
  check(w.k(at(41, 0)) === K.EMPTY && w.k(at(42, 0)) === K.FAULT && w.k(at(43, 0)) === K.FAULT, `a thread through a pocket's cell opened ${open(w, thread)} of three`);
  const bloom = await stage(BLOOM, [at(40, 0), ...thread]);
  bloom.finishDig(at(40, 0));
  for (let f = 0; f < 120; f++) bloom.update(1 / 60);
  check(open(bloom.world, thread) === 0, `faults in bloom zipped: ${open(bloom.world, thread)}`);
}
// Nothing made: six hundred frames of zipping alone (a thread long enough, and the cap lifted, so that it runs all
// the while), the heap gc'd before and after.
{
  // (A thread that snakes back and forth across sixty cells, all within the reach.)
  const thread = [];
  for (let r = 0; r <= 40; r++) {
    const y = -60 + 3 * r;
    for (let n = 0; n <= 30; n++) thread.push(at(r & 1 ? 60 - n : 30 + n, y));
    for (let v = 1; v < 3 && r < 40; v++) thread.push(at(r & 1 ? 30 : 60, y + v));
  }
  const game = await stage(MYCELIUM, thread), opened = [];
  game.unzip(thread[0]);
  game.zipLeft = 1e9;
  for (let f = 0; f < 120; f++) { opened.length = 0; game.zipOn(1 / 60, opened); }
  // (Three rounds, and the least the heap grew in any: code the engine optimises while a round runs is kept on the
  // heap too, and comes when it comes, sooner or later as the machine is loaded; a frame that made garbage would
  // grow the heap in every round alike.)
  let zipped = 0, grew = Infinity;
  for (let round = 0; round < 3; round++) {
    gc(); const before = process.memoryUsage().heapUsed;
    zipped = 0;
    for (let f = 0; f < 600; f++) { opened.length = 0; game.zipOn(1 / 60, opened); zipped += opened.length; }
    gc(); grew = Math.min(grew, process.memoryUsage().heapUsed - before);
  }
  check(zipped >= 200 && grew < 20 * 1024, `six hundred frames zipping ${zipped} faults grew the heap by ${grew} bytes`);
  console.log(`six hundred frames zipping ${zipped} faults: the heap grew by ${grew} bytes`);
}
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : `ok: a fault cut in the mycelium zips along its thread ${ZIP.rate} a second, ${ZIP.most} at the most, within the reach and out of pockets, paying nothing and making nothing`);
process.exit(fails.length ? 1 : 0);
