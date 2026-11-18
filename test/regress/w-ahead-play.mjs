// Laying the world ahead of need changes nothing the game does, and takes the laying out of the step.
// tools/long-play.mjs's pilot plays world 7 for 45 minutes, with its creatures (which read the world's pieces
// themselves) and every tab of the shop, twice: once as every test plays, and once with the world laying ahead after
// every frame, AHEAD_ROWS rows of the nearest piece to the drill not yet made (js/world.js: `ahead`; js/main.js does
// it after a frame with time to spare), its most. After every frame the pieces of world made (`made`) are the same;
// at the end every piece made is the same, kind, ground and what was seen, and so are what was banked, bought,
// hauled and met, and how far out the drill went. And the step lays far less: ground is laid in a frame's step (a
// piece laid whole as it is made, or the rows a piece held in part had left) in a third of the frames it was laid
// in without, or fewer (12 against 48 when it was written), and half the rows or fewer (1,752 against 6,144).
// It fails if laying ahead made a piece of the world, or changed one, or the game, or if it laid nothing ahead.
//   node test/regress/w-ahead-play.mjs [minutes=45]
import { play } from '../../tools/long-play.mjs';
import { world } from '../harness.mjs';

const minutes = Number(process.argv[2] ?? 45), { World, CH, AHEAD_ROWS } = world, fails = [], check = (ok, what) => { if (!ok && fails.length < 20) fails.push(what); };
// (The rows laid in the step: 64 for a piece laid whole as it is made, else what a piece held had left.)
const lay = World.prototype.lay;
let step = 0;
World.prototype.lay = function (id, kind, biome) { const h = this.heldN > 0 ? this.heldOf(id) : null; step += h ? CH - h.rows : CH; return lay.call(this, id, kind, biome); };
const fnv = (h, bytes) => { for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 0x01000193); return h >>> 0; };
async function flown(ahead) {
  const made = [], rows = [];
  let frames = 0;
  step = 0;
  const r = await play(7, minutes, { every: 36000, all: true, fauna: true, each: game => {
    made.push(game.world.made); rows.push(step); step = 0; frames++;
    if (ahead) game.world.ahead(game.drill.x, game.drill.y, AHEAD_ROWS);
  } });
  const w = r.game.world, pieces = new Map();
  w.chunks.forEach((p, id) => { if (p) pieces.set(id, fnv(fnv(fnv(0x811c9dc5, p.kind), p.biome), p.seen)); });
  const S = r.game.S;
  return { made, rows, frames, pieces, aheadRows: w.aheadRows, S: JSON.stringify({ grit: S.grit, gems: S.gems, lv: S.lv, stats: S.stats, spec: S.spec, out: S.out, met: S.met }) };
}
const off = await flown(false), on = await flown(true);
check(off.frames === on.frames, `${on.frames} frames played laying ahead, ${off.frames} without`);
let first = -1;
for (let f = 0; f < off.made.length; f++) if (off.made[f] !== on.made[f]) { first = f; break; }
check(first < 0, `after frame ${first} ${on.made[first]} pieces were made laying ahead, ${off.made[first]} without`);
check(off.pieces.size === on.pieces.size, `${on.pieces.size} pieces held at the end laying ahead, ${off.pieces.size} without`);
let differ = 0;
for (const [id, h] of off.pieces) if (on.pieces.get(id) !== h) differ++;
check(differ === 0, `${differ} pieces of the world hold other cells, grounds or sights laying ahead`);
check(off.S === on.S, `the game went otherwise laying ahead:\n    ${on.S}\n    ${off.S}`);
check(off.aheadRows === 0 && on.aheadRows > 0, `${on.aheadRows} rows laid ahead (and ${off.aheadRows} without)`);
const busy = rows => rows.filter(n => n > 0).length, most = rows => rows.reduce((a, b) => Math.max(a, b), 0), sum = rows => rows.reduce((a, b) => a + b, 0);
// (The first frame lays the ground about the core before anything could be laid ahead, as it did.)
check(busy(on.rows.slice(1)) * 3 <= busy(off.rows.slice(1)), `the step laid ground in ${busy(on.rows.slice(1))} frames laying ahead, ${busy(off.rows.slice(1))} without`);
check(sum(on.rows) * 2 <= sum(off.rows), `the step laid ${sum(on.rows)} rows laying ahead, ${sum(off.rows)} without`);
console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : `no defect: ${minutes} minutes of the pilot on world 7 (${off.frames} frames) made the same pieces of world every frame, ${off.pieces.size} in all with the same cells, and played the same, laying ahead or not; the step laid ground in ${busy(on.rows)} frames laying ahead (${sum(on.rows)} rows, at the most ${most(on.rows)} in a frame) and ${busy(off.rows)} without (${sum(off.rows)} rows, at the most ${most(off.rows)}), and ${on.aheadRows} rows were laid ahead`);
process.exit(fails.length ? 1 : 0);
