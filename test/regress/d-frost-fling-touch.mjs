// The frost throw by touch: a tap shuts the shop, then a second touch drags up `delay` frames later.
//   node test/hunt/terrain/frost-fling-touch.mjs
import { makeGame, tetherFaults, flyTo, idle, idx, rel, C, N, K, B } from './lib/terrain.mjs';
async function run(delay) {
  const game = await makeGame(11, { tether: 5, drill: 4 });
  const w = game.world, d = game.drill;
  let top = 3;
  while ((w.b(idx(0, -top)) || 0) === B.CRUST) { w.setK(idx(0, -top), K.EMPTY); top++; }
  game.changed();
  flyTo(game, 0, -(top - 1));
  for (let f = 0; f < 4000 && d.y > C + 0.5 - (top + 11); f++) { game.input.auto = [0, -1, 1]; game.update(1 / 60); }
  flyTo(game, 0, 0, { near: 0.05, max: 6000 });
  idle(game, 5);
  game.key('Enter', true); game.key('Enter', false);
  for (let f = 0; f < 31 * 60; f++) game.update(1 / 60);
  game.pointerDown(1, 100, 300); game.pointerUp(1);                 // the tap that shuts the shop
  for (let f = 0; f < delay; f++) game.update(1 / 60);
  game.pointerDown(2, 100, 300); game.pointerMove(2, 100, 270);     // the drag up
  for (let f = 0; f < 90; f++) game.update(1 / 60);
  return { delay, at: rel([d.x, d.y]), own: w.k(Math.floor(d.y) * N + Math.floor(d.x)), faults: tetherFaults(game).length };
}
let bad = 0;
for (let delay = 0; delay <= 26; delay += 2) {
  const r = await run(delay);
  if (r.own !== K.EMPTY || r.faults) bad++;
  console.log(`drag ${(delay / 60).toFixed(2)} s after the tap: drill ends at ${JSON.stringify(r.at)}, its own cell is kind ${r.own}${r.own === K.ICE ? ' (ICE)' : ''}, tether faults ${r.faults}`);
}
console.log(`${bad} of 14 delays end with the drill in ice or the tether through it`);
process.exit(bad ? 1 : 0);
