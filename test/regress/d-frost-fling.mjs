// A tunnel cut north into the frost, the drill reeled home, the shop opened for half a minute, then Up pressed:
// the key shuts the shop and throws the drill up the tunnel in the same frame. The cut closes with ice while the
// drill is in flight (ice only spares cells under the tether or beside the drill), and the throw ends inside it.
//   node test/hunt/terrain/frost-fling.mjs [seconds in shop=31]
import { makeGame, tetherFaults, moreFaults, flyTo, idle, idx, rel, bandRel, C, N, K, B } from './lib/terrain.mjs';

const wait = Number(process.argv[2] ?? 31);
const game = await makeGame(11, { tether: 5, drill: 4 });
const w = game.world, d = game.drill;
// Staged: a one-cell tunnel straight north through home ground, stopping where the frost begins.
let top = 3;
while ((w.b(idx(0, -top)) || 0) === B.CRUST) { w.setK(idx(0, -top), K.EMPTY); top++; }
game.changed();
// Real play from here: fly up it and cut twelve cells of frost.
const log = [];
flyTo(game, 0, -(top - 1), { log });
for (let f = 0; f < 4000 && d.y > C + 0.5 - (top + 11); f++) { game.input.auto = [0, -1, 1]; game.update(1 / 60); log.push(...tetherFaults(game)); }
const end = rel([d.x, d.y]);
console.log(`frost begins ${top} cells north; cut up to ${JSON.stringify(end)}; frost cuts on record: ${game.frostOpen.length}; faults so far: ${log.length}`);
// Home again (the tether reels it in over the last cells), and let go.
flyTo(game, 0, 0, { near: 0.05, log, max: 6000 });
idle(game, 5, log);
console.log(`home at ${JSON.stringify(rel([d.x, d.y]))} t=${game.time.toFixed(2)}, frost cuts still open: ${game.frostOpen.filter(i => w.k(i) === K.EMPTY).length}`);
game.key('Enter', true); game.key('Enter', false);
console.log(`shop open: ${game.shop}`);
for (let f = 0; f < wait * 60; f++) game.update(1 / 60);
game.key('ArrowUp', true);          // shuts the shop and steers north
let flew = 0;
for (let f = 0; f < 120; f++) { game.update(1 / 60); if (d.mode !== 'free') flew++; }
const here = Math.floor(d.y) * N + Math.floor(d.x);
console.log(`after the throw (${flew} frames in flight): drill at ${JSON.stringify(rel([d.x, d.y]))} mode=${d.mode}, its own cell is kind ${w.k(here)} (ICE=${K.ICE}, EMPTY=0)`);
console.log('tether faults:', JSON.stringify([...new Set([...tetherFaults(game), ...moreFaults(game)])].slice(0, 4)));
console.log('band:', JSON.stringify(bandRel(game)));
// Can it get out? Steer each way for four seconds and see how far it moves.
game.key('ArrowUp', false);
let moved = 0, cut = 0;
for (const code of ['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp']) {
  const x = d.x, y = d.y, hauls = game.frostOpen.length;
  game.key(code, true);
  for (let f = 0; f < 240; f++) game.update(1 / 60);
  game.key(code, false);
  for (let f = 0; f < 10; f++) game.update(1 / 60);
  moved = Math.max(moved, Math.hypot(d.x - x, d.y - y));
  cut += game.frostOpen.length - hauls;
  console.log(`  ${code} for 4 s: moved ${Math.hypot(d.x - x, d.y - y).toFixed(3)} cells, now at ${JSON.stringify(rel([d.x, d.y]))}, own cell kind ${w.k(Math.floor(d.y) * N + Math.floor(d.x))}`);
}
console.log(moved < 0.01 ? 'STUCK: the drill cannot move in any direction' : 'the drill got free');
process.exit(moved < 0.01 || w.k(here) !== K.EMPTY ? 1 : 0);
