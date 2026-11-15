// Where a frame's time goes: wraps the game's larger methods and totals the time inside each over the rope fuzz's flight.
//   node test/frame-parts.mjs [seed] [turns] [reach level] [start x] [start y]
// A method called from inside another is counted in both (changed inside fly, retighten inside changed, and so on).
import { makeGame, random, C, N, K } from './harness.mjs';

const [seed = 11, turns = 600, reach = 5, sx = 0, sy = 0] = process.argv.slice(2).map(Number);
const game = await makeGame(seed, { tether: reach, drill: 4 });
const d = game.drill, w = game.world, rnd = random(seed);
if (sx || sy) {
  const len = Math.hypot(sx, sy);
  for (let s = 0; s <= len; s += 0.5) for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) w.setK((C + Math.round(sy * s / len) + v) * N + C + Math.round(sx * s / len) + u, K.EMPTY);
  d.x = C + sx + 0.5; d.y = C + sy + 0.5; d.mode = 'free';
  game.band = [[d.x, d.y], [C + 0.5, C + 0.5]];
  game.changed();
}
const spent = {}, calls = {}, worst = {};
const wrap = (obj, name, label = name) => {
  const own = obj[name];
  if (typeof own !== 'function') return;
  spent[label] = 0; calls[label] = 0; worst[label] = 0;
  obj[name] = function (...args) { const t = performance.now(); try { return own.apply(this, args); } finally { const ms = performance.now() - t; spent[label] += ms; calls[label]++; if (ms > worst[label]) worst[label] = ms; } };
};
for (const name of ['fly', 'tend', 'lead', 'retighten', 'changed', 'reelIfRound', 'updateHazards', 'updateHauls', 'ambient', 'look', 'haul', 'foresee', 'finishDig', 'catchIn', 'find']) wrap(game, name);
for (const name of ['freed', 'pieceIn', 'see', 'piece']) wrap(w, name, `world.${name}`);
let frames = 0, total = 0, heading = 0;
for (let turn = 0; turn < turns; turn++) {
  heading += (rnd() - 0.5) * 2.5;
  const hold = 10 + Math.floor(rnd() * 50), pause = rnd() < 0.1;
  for (let f = 0; f < hold; f++) {
    game.input.auto = pause ? null : [Math.cos(heading), Math.sin(heading), 1];
    const t = performance.now();
    game.update(1 / 60);
    total += performance.now() - t; frames++;
  }
}
console.log(`frames ${frames}, mean ${(total / frames * 1000).toFixed(1)} us (with the wrappers' own cost)`);
for (const name of Object.keys(spent).sort((a, b) => spent[b] - spent[a])) if (calls[name]) console.log(`${name.padEnd(16)} ${(spent[name] / frames * 1000).toFixed(1).padStart(8)} us/frame  ${String(calls[name]).padStart(8)} calls  worst ${worst[name].toFixed(2)} ms`);
