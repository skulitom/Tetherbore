// A drag held on the diagonal into a notch of two cells must cut one of them. Staged: slate all round, the drill in
// the inside corner of an open room, rock to the west and to the north of it. It is steered north-west four ways:
// straight at a far point exactly on the diagonal (as the hunters' verify/stuck-probe.mjs flew: 970 s with no
// headway), on a fixed heading of exactly 45 degrees, and with the heading wobbling at random by up to 0.5, 2 and 5
// degrees a frame, as a thumb does. Each must have cut a cell within twice the cell's cutting time and a little.
// Before the fix, which of the two cells the stick favoured changed with a hair's turn, and with the drill's own
// squaring up to the cell it was cutting, and each change began the cut again.
//
// And the owner's rule the fix must keep: a new direction cancels a cut in progress. Pushed west until the west
// cell is half cut, then north: the north cell is cut and the west cell is left standing.
//   node test/regress/i-diagonal-notch.mjs
import { makeGame, random, C, N, K } from '../harness.mjs';

const at = (x, y) => (C + y) * N + C + x, HX = C + 0.5;
async function stage(ram, bit) {
  const game = await makeGame(7, { tether: 5, drill: bit, momentum: ram });
  const d = game.drill, w = game.world;
  for (let y = -70; y <= -30; y++) for (let x = -70; x <= -30; x++) w.setK(at(x, y), K.SLATE);
  // A tunnel three cells wide from the core, and a room of 5 x 5 at its end: the drill in the room's north-west cell.
  for (let s = 0; s <= 1; s += 0.002) for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) w.setK(at(Math.round(-48 * s) + u, Math.round(-48 * s) + v), K.EMPTY);
  for (let y = -52; y <= -48; y++) for (let x = -52; x <= -48; x++) w.setK(at(x, y), K.EMPTY);
  d.x = HX - 52; d.y = HX - 52; d.mode = 'free';
  game.band = [[d.x, d.y], [HX, HX]];
  game.changed();
  let cuts = [];
  const dig = game.finishDig.bind(game); game.finishDig = i => { cuts.push(i); dig(i); };
  return { game, d, w, cuts, dur: [1, 1.6, 2.4, 3.6, 5].map(v => 1 / v)[bit] };
}
let bad = 0;
for (const [ram, bit, hz] of [[4, 4, 60], [0, 0, 60], [2, 2, 30], [4, 0, 120]]) {
  const rows = [];
  for (const how of ['at a far point', 'fixed', 'wobble 0.5', 'wobble 2', 'wobble 5']) {
    const { game, d, cuts, dur } = await stage(ram, bit), rnd = random(99), tx = d.x - 300, ty = d.y - 300, wobble = how.startsWith('wobble') ? +how.slice(7) : 0;
    const most = Math.ceil((2 * dur + 0.5) * hz);
    let f = 0;
    for (; f < most && !cuts.length; f++) {
      const a = (how === 'at a far point' ? Math.atan2(ty - d.y, tx - d.x) : -0.75 * Math.PI) + (rnd() * 2 - 1) * wobble * Math.PI / 180;
      game.input.auto = [Math.cos(a), Math.sin(a), 1];
      game.update(1 / hz);
    }
    if (!cuts.length) bad++;
    rows.push(`${how}: ${cuts.length ? `cut after ${(f / hz).toFixed(2)} s` : `NOTHING CUT in ${(most / hz).toFixed(2)} s`}`);
  }
  // A new direction cancels the cut.
  const { game, d, w, cuts, dur } = await stage(ram, bit), west = at(-53, -52), north = at(-52, -53);
  let f = 0;
  for (; f < 4 * hz && !(d.dig === west && d.digT > dur * 0.5); f++) { game.input.auto = [-1, 0, 1]; game.update(1 / hz); }
  const began = d.dig === west;
  for (f = 0; f < Math.ceil((dur + 0.5) * hz) && !cuts.length; f++) { game.input.auto = [0, -1, 1]; game.update(1 / hz); }
  const cancelled = began && cuts[0] === north && w.k(west) !== K.EMPTY;
  if (!cancelled) bad++;
  rows.push(`west then north: ${cancelled ? 'the west cut was dropped, north was cut' : `NOT CANCELLED (began ${began}, cut ${cuts.map(i => `${i % N - C},${Math.floor(i / N) - C}`)})`}`);
  console.log(`ram ${ram}, bit ${bit}, ${hz} fps, slate takes ${dur.toFixed(2)} s: ${rows.join('; ')}`);
}
console.log(bad ? 'DEFECT: a held drag into a notch cut nothing, or a new direction did not cancel the cut' : 'no defect');
process.exit(bad ? 1 : 0);
