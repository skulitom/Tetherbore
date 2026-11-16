// tools/long-play.mjs plays a new game with no hand on it: its first six minutes on world 7 are played here and
// held to what a game must be. Nothing is thrown; the tether is sound (looked at every tenth frame); the money is
// always a number and never less than nothing; every haul is of ground truly cut off (no cell of it lies against
// ground that stayed); the pilot gets somewhere (the reach is bought at least four times, and the first keystone
// slab is brought home with its keys); and the same seed plays the same game twice.
//   node test/regress/t-long-play.mjs [seed] [minutes]
import { play } from '../../tools/long-play.mjs';
import { tetherFaults, N, K } from '../harness.mjs';

const [seed = 7, minutes = 6] = process.argv.slice(2).map(Number), problems = [];
const note = text => { if (problems.length < 12) problems.push(text); };
const run = async checked => {
  let frames = 0, wrapped = false;
  const r = await play(seed, minutes, 60, checked ? (game, t) => {
    if (!wrapped) {
      wrapped = true;
      const inner = game.haul, w = game.world;
      game.haul = cells => {
        const own = new Set(cells);
        let against = 0;
        for (const i of cells) for (const j of [i + 1, i - 1, i + N, i - N]) if (!own.has(j) && w.k(j) !== K.EMPTY) against++;
        if (against) note(`at ${t.toFixed(1)} s a haul of ${cells.length} cells lay against ground that stayed, on ${against} sides`);
        inner(cells);
      };
    }
    const S = game.S;
    if (!Number.isFinite(S.grit) || S.grit < 0 || S.gems.some(g => !Number.isFinite(g) || g < 0) || game.banked() < -1e-6) note(`at ${t.toFixed(1)} s the money is ${S.grit}, ${S.gems}, banked ${game.banked()}`);
    if (++frames % 10) return;
    for (const fault of tetherFaults(game).slice(0, 1)) note(`at ${t.toFixed(1)} s: ${fault}`);
    for (const h of game.hauls) if (h.t > 60) note(`at ${t.toFixed(1)} s a haul of ${h.n} cells has run ${h.t.toFixed(0)} s`);
  } : null);
  return r;
};
let first = null;
try { first = await run(true); } catch (error) { note(`threw: ${error.stack.split('\n').slice(0, 4).join(' | ')}`); }
if (first) {
  const { S, sum, bought, samples } = first;
  // (A level of reach asks that the drill has been three fifths of the way out the last one goes: the pilot is at
  // the fourth reach, 72, by six minutes, where it was at the fifth before levels asked for that.)
  if (S.lv.tether < 3) note(`after ${minutes} minutes the reach is at level ${S.lv.tether}: under 3`);
  if (!first.first.slab) note('the first keystone slab was not brought home');
  // (With the first reaches as long as they are now the pilot's rings are wider, and it flies seven where it flew eight.)
  if (sum.loops < 6) note(`${sum.loops} rings flown shut: under 6`);
  if (sum.failed > 2) note(`${sum.failed} rings left standing`);
  if (samples.length !== minutes) note(`${samples.length} lines for ${minutes} minutes`);
  // What came in is what the hauls paid and the station's own trickle: a little every two seconds, and no more.
  const trickle = sum.earned - sum.hauled, most = minutes * 30 * Math.ceil(samples[samples.length - 1].reach / 24);
  if (!(trickle >= 0 && trickle <= most)) note(`${sum.earned} grit came in and the hauls paid ${sum.hauled}: ${trickle} from nowhere (the trickle is ${most} at the most)`);
  // The same game twice: the pilot and the game are both the seed's.
  const again = await run(false);
  if (JSON.stringify(again.S) !== JSON.stringify(S) || again.bought.length !== bought.length) note('the same seed played another game the second time');
}
if (problems.length) { console.log('PROBLEMS\n' + problems.join('\n')); process.exit(1); }
console.log(`ok: ${first.sum.loops} rings, ${first.sum.hauls} hauls, reach ${first.samples[first.samples.length - 1].reach} after ${minutes} minutes`);
