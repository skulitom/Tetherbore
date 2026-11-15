// The same throw with no shop: the drill waits at the core and is thrown north at a chosen moment. For which
// moments does the throw end inside ice?  node test/hunt/terrain/frost-fling-noshop.mjs
import { makeGame, tetherFaults, flyTo, idle, idx, rel, C, N, K, B } from './lib/terrain.mjs';

async function run(at) {
  const game = await makeGame(11, { tether: 5, drill: 4 });
  const w = game.world, d = game.drill;
  let top = 3;
  while ((w.b(idx(0, -top)) || 0) === B.CRUST) { w.setK(idx(0, -top), K.EMPTY); top++; }
  game.changed();
  flyTo(game, 0, -(top - 1));
  for (let f = 0; f < 4000 && d.y > C + 0.5 - (top + 11); f++) { game.input.auto = [0, -1, 1]; game.update(1 / 60); }
  const first = Math.min(...game.frostOpen.map(i => w.dug.get(i)));
  flyTo(game, 0, 0, { near: 0.05, max: 6000 });
  game.input.auto = null;
  while (game.time < first + 30 + at) game.update(1 / 60);
  game.key('ArrowUp', true);
  for (let f = 0; f < 90; f++) game.update(1 / 60);
  return { at, drill: rel([d.x, d.y]), own: w.k(Math.floor(d.y) * N + Math.floor(d.x)), faults: tetherFaults(game).length };
}
let bad = 0;
const rows = [];
for (let k = -40; k <= 30; k += 2) { const r = await run(k / 60); rows.push(r); if (r.own !== K.EMPTY || r.faults) bad++; }
for (const r of rows) console.log(`thrown ${(r.at >= 0 ? '+' : '') + r.at.toFixed(3)} s from the oldest frost cut turning 30 s: lands ${JSON.stringify(r.drill)} own cell kind ${r.own} faults ${r.faults}`);
console.log(`${bad} of ${rows.length} moments end inside ice or with the tether through ice`);
process.exit(bad ? 1 : 0);
