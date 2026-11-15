// Many hauls on their way home at once (docs/CONTENT-PLAN.md, content item 7: "several physical hauls at once"). A
// haul is rubble that is really there, sixteen bits to a cell when it breaks fine, and there is no cap on how many
// hauls are out together; a drift is the place where a dozen are, a second or two apart. What holds the work down
// is that in a chain of hauls nothing breaks fine (js/game.js: haul): four bits to a cell.
//
// The richest drift within 700 cells of the core in world 7, fifteen boulders, every one hauled as a loop round it
// would haul it, one every 0.3 seconds (all within five seconds: quicker than any thumb), and again one every
// tenth of a second (tools/drift-play.mjs: `burst`). Counted, not timed:
//   - only the first haul breaks fine; the bits made in all are sixteen to a cell of the first boulder and four
//     to a cell of the rest, about five hundred;
//   - so never more than that are on their way at once, and a frame moves a bit no more than four times: under
//     2,400 moves of a bit in a frame, which is what one great haul by itself already asks (400 bits, four moves);
//   - every bit comes home: no haul is left on its way, and all that was paid is banked.
// (How long the frames took is printed by `node tools/drift-play.mjs --drift 25 --burst 0.3`: under a millisecond
// in the mean and six at the worst on the machine this was written on.)
//   node test/regress/c7-drift-rubble.mjs
import { C } from '../harness.mjs';
import { burst, bouldersOf, stage } from '../../tools/drift-play.mjs';

const fails = [], check = (ok, what) => { if (!ok && fails.length < 12) fails.push(what); };
const out = [];
// (What the drift holds, from a game of its own: the first boulder hauled is the nearest the drill.)
const { game: probe, Z: at } = await stage(7, 25);
probe.update(1 / 60);
const sizes = bouldersOf(probe.world, at).sort((a, b) => Math.hypot(a.at[0] - probe.drill.x, a.at[1] - probe.drill.y) - Math.hypot(b.at[0] - probe.drill.x, b.at[1] - probe.drill.y)).map(b => b.cells.length);
const cells = sizes.reduce((a, b) => a + b, 0), bits = 16 * sizes[0] + 4 * (cells - sizes[0]);
check(sizes.length === 15 && cells > 90, `the drift at ${at.cx - C},${at.cy - C} has ${sizes.length} boulders of ${cells} cells`);
for (const gap of [0.3, 0.1]) {
  const r = await burst(7, 25, gap), game = r.game;
  check(r.boulders === 15 && r.cells === cells, `one every ${gap} s: ${r.boulders} boulders of ${r.cells} cells were hauled`);
  check(r.fine === 1 && r.made === bits, `one every ${gap} s: ${r.fine} hauls broke fine and ${r.made} bits were made, not one and ${bits}`);
  check(r.hauls >= (gap < 0.2 ? 15 : 10) && r.bits <= bits && r.bits > bits * 0.6, `one every ${gap} s: at the most ${r.hauls} hauls and ${r.bits} bits were on their way at once`);
  check(r.moves <= 4 * bits && r.moves < 2400, `one every ${gap} s: a frame moved bits ${r.moves} times`);
  check(game.hauls.length === 0 && game.pending.grit === 0 && game.S.stats.hauls === 15 && r.frames < 60 * 30, `one every ${gap} s: ${game.hauls.length} hauls are still on their way after ${r.frames} frames, ${game.pending.grit} grit not yet banked`);
  out.push({ every: gap, hauls: r.hauls, bits: r.bits, made: r.made, moves: r.moves, frames: r.frames });
}
console.log(JSON.stringify(out));
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: a drift\'s fifteen boulders hauled within seconds of one another are five hundred bits of rubble at the most, moved under 2,400 times a frame, and all of it comes home');
process.exit(fails.length ? 1 : 0);
