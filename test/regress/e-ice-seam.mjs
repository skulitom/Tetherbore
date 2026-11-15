// Ice closes on the far side of a span that lies along a wall, leaving the tether inside a closed seam of rock.
// Staged: a solid slab of frost ground with a room under it. Real play: the drill cuts a zigzag up through the slab
// (up one column, one step east, up, then west) and waits. The tether settles into a span straight up the line
// x = 0 between two bends; half a minute later the cut cells west of that line freeze against the wall east of it.
//   node test/hunt/terrain/ice-seam.mjs [seconds to wait=34]
import { makeGame, tetherFaults, seamFaults, moreFaults, flyTo, idle, idx, open, C, N, K, B } from './lib/terrain.mjs';

const wait = Number(process.argv[2] ?? 34);          // seconds to wait after the cut; 0 is the control: no ice forms
const game = await makeGame(11, { tether: 5, drill: 4 });
const w = game.world, d = game.drill, log = [];
// (The north's first pocket lies hereabouts in every world, since pockets were laid: where it does, the ground
// is made the north's own plain rock again, as it was when this was written.)
for (let y = -182; y <= -146; y++) for (let x = -12; x <= 30; x++) if (w.row(idx(x, y)).pocket) { w.setB(idx(x, y), B.FROST); w.setK(idx(x, y), K.SOFT); }
open(game, -8, -162, 8, -148, K.SOFT);                    // the slab
open(game, -1, -147, 1, -3);                              // a shaft from the core and the room under the slab
for (let y = -162; y <= -148; y++) for (let x = -8; x <= 8; x++) if (w.b(idx(x, y)) !== B.FROST) throw new Error('not frost ground here');
game.changed();
const map = () => { const rows = []; for (let y = -158; y <= -146; y++) { let s = String(y).padStart(5) + ' '; for (let x = -6; x <= 3; x++) { const k = w.k(idx(x, y)); s += k === K.EMPTY ? '.' : k === K.ICE ? 'i' : '#'; } rows.push(s); } return rows.join('\n'); };
flyTo(game, -1, -147, { log });
for (const [x, y] of [[-1, -154], [0, -154], [0, -156], [-4, -156]]) if (flyTo(game, x, y, { log, near: 0.12 }) < 0) throw new Error(`never reached ${x},${y}`);
idle(game, 30, log);
const show = () => game.band.map(p => p[3] === undefined ? `(${(p[0] - C).toFixed(2)},${(p[1] - C).toFixed(2)})` : `bend(${p[0] - C},${p[1] - C})`).join(' ');
console.log(`cut done at t=${game.time.toFixed(1)} s. Tether (x, y in cells from the core cell's corner): ${show()}`);
console.log(`ground (columns x=-6..3; '#' rock, 'i' ice, '.' open):\n${map()}`);
console.log(`faults while cutting: ${log.length}; seam faults now: ${seamFaults(game).length}`);
let first = -1;
for (let f = 0; f < wait * 60; f++) { game.input.auto = null; game.update(1 / 60); if (first < 0 && seamFaults(game).length) first = game.time; }
console.log(`\nafter waiting, t=${game.time.toFixed(1)} s. Tether: ${show()}`);
console.log(map());
const seams = seamFaults(game);
console.log(`stock tetherFaults: ${JSON.stringify(tetherFaults(game))}`);
console.log(`seam faults: ${JSON.stringify(seams)}${first >= 0 ? ` (first at t=${first.toFixed(2)} s)` : ''}`);
// What that does next: the drill flies back down its own cut.
const after = [];
flyTo(game, 0, -154, { log: after, near: 0.2, max: 900 });
flyTo(game, 0, -147, { log: after, near: 0.2, max: 900 });
console.log(`flying back the way it came: ${after.length} stock fault reports, e.g. ${JSON.stringify([...new Set(after)].slice(0, 2))}; drill ends at (${(d.x - C).toFixed(2)},${(d.y - C).toFixed(2)})`);
process.exit(seams.length ? 1 : 0);
