// The chart's picture is drawn again when the ground it shows changes, and not otherwise (js/drawing.js: drawMap). It
// was drawn again every half second whatever happened, a few milliseconds each time at a long reach, the whole
// while the chart was open over still ground. Now it asks the world how often its ground has changed
// (`World.stirred`), and a change the game's version does not count must still reach it: a cell set by hand, a cell
// seen. And the picture kept is always the one drawn from nothing.
//   node test/regress/m-chart-still.mjs
import { makeGame, C, N, K } from '../harness.mjs';

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const game = await makeGame(7, { tether: 5, chart: 1 }), w = game.world;
const frame = () => { game.update(1 / 60); game.render(); };
for (let f = 0; f < 10; f++) frame();
game.openLab(true, 'chart');
frame();
const M = game.chartMap;
check(M && game.chartRect, 'the chart is not open');
// The picture as it would be drawn from nothing now, the kept one put back after.
const fresh = () => {
  const kept = M.mapData.data.slice(), was = M.mapFor, [x, y, size] = game.chartRect, view = game.chartView();
  M.mapFor = null;
  game.drawMap(x, y, { size, per: game.chartBase / view.zoom, cx: view.x, cy: view.y });
  const drawn = M.mapData.data.slice();
  M.mapData.data.set(kept); M.mapFor = was;
  return drawn;
};
const same = (a, b) => a.length === b.length && a.every((v, n) => v === b[n]);

// Two seconds open over still ground: drawn once, when it opened.
const at = M.mapAt;
for (let f = 0; f < 120; f++) frame();
check(M.mapAt === at, `the chart was drawn again over ground that did not change (first at ${at}, last at ${M.mapAt})`);
check(same(M.mapData.data, fresh()), 'the chart kept is not the chart drawn from nothing');

// A cell the drill has seen, 40 cells east of the core, cut by hand: no version moves, and the chart shows it.
const cell = C * N + C + 40;
w.see(C + 40, C, 0);
game.version++; frame();
const version = game.version, before = M.mapAt;
w.setK(cell, w.k(cell) === K.EMPTY ? K.SOFT : K.EMPTY);
frame();
check(game.version === version, 'the version moved: the test wants a change it does not count');
check(M.mapAt !== before, 'a cell changed by hand did not draw the chart again');
check(same(M.mapData.data, fresh()), 'after a cell changed by hand, the chart kept is not the chart drawn from nothing');

// Ground seen for the first time, likewise.
const seenAt = M.mapAt;
w.see(C - 60, C + 30, 3);
frame();
check(M.mapAt !== seenAt && same(M.mapData.data, fresh()), 'ground newly seen did not reach the chart');

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: the chart stands while its ground does, and shows every change to it');
process.exit(fails.length ? 1 : 0);
