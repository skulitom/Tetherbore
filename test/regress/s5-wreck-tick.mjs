// S5: a wreck nobody has claimed ticks when the drill is within 30 cells of it, quicker the nearer the drill is;
// not from further off, not once its part is held, and not once the wreck itself has gone. Ticks are counted
// (Game.ticks), never timed: over the same three seconds there are more of them close by than far off.
//   node test/regress/s5-wreck-tick.mjs
import { makeGame, world, C, N } from '../harness.mjs';
const { K } = world;

const game = await makeGame(7, { tether: 4 }), w = game.world, S = game.S, d = game.drill, fails = [];
const [wx, wy] = w.wrecks[0], wreck = wy * N + wx;
// The drill is stood `far` cells east of the wreck, in a room at the end of a tunnel carved from the core as the
// tether fuzz carves a far start, and three seconds pass.
const ticksAt = far => {
  const x = wx + far, y = wy, sx = x - C, sy = y - C, len = Math.hypot(sx, sy);
  for (let s = 0; s <= len; s += 0.5) for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) {
    const i = (C + Math.round(sy * s / len) + v) * N + C + Math.round(sx * s / len) + u;
    if (w.k(i) !== K.WRECK) w.setK(i, K.EMPTY);
  }
  d.x = d.px = x + 0.5; d.y = d.py = y + 0.5; d.vx = d.vy = 0; d.mode = 'free';
  game.band = [[d.x, d.y], [C + 0.5, C + 0.5]];
  game.changed();
  game.tickIn = 0;
  const before = game.ticks;
  for (let f = 0; f < 180; f++) game.update(1 / 60);
  return game.ticks - before;
};
const out = ticksAt(34), far = ticksAt(24), near = ticksAt(6);
if (w.k(wreck) !== K.WRECK) fails.push('the staging took the wreck away');
if (out !== 0) fails.push(`${out} ticks from 34 cells off`);
if (!(far >= 2 && far <= 4)) fails.push(`${far} ticks in three seconds from 24 cells off (two to four are meant)`);
if (!(near >= 5 && near <= 8 && near > far)) fails.push(`${near} ticks in three seconds from 6 cells off, ${far} from 24: nearer is not quicker`);
S.wrecks[0] = 1;
const held = ticksAt(6);
if (held !== 0) fails.push(`${held} ticks from a wreck whose part is held`);
S.wrecks[0] = 0;
w.setK(wreck, K.EMPTY);
const gone = ticksAt(6);
if (gone !== 0) fails.push(`${gone} ticks from a wreck that is gone`);

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : `ok: an unclaimed wreck ticks ${far} times in three seconds from 24 cells off and ${near} from 6, and not from further, held or gone`);
process.exit(fails.length ? 1 : 0);
