// Content item 4: the bomb is worth buying. Played with no hand on it (tools/sift.mjs: a charge aimed where ore
// stands, set off, and every lump it shook loose flown round; and from the same place, the biggest loop that is
// cut and closed in the time that took), on two worlds, two places in each direction, at every level of BLAST:
//   at most two charges in sixteen shake nothing loose;
//   a charge brings home at least half as much grit again as the loop of the same time, at every level;
//   from the level the directions' grounds are in reach (3), at least 25 gems a charge and twice the loop's.
// And the two figures that make it so are what make it so: with no lump followed past the disc's edge
// (`SIFT.shake` 0), a charge brings home under three quarters of those gems; with one cell of room round what
// stands in place of two (`SIFT.room` 1), under 85 in a hundred; with none, under a third.
// (Counted on four worlds, 214 charges: 28 to 39 gems a charge at level 3 and 33 to 62 at level 4, by direction,
// where the loop of the same time brings 2 to 16 and 10 to 31. As first planned, a plain disc with dense rock left
// standing, two charges in three shook nothing loose and a charge brought 1 to 9 gems: `--planned`.)
import { play } from '../../tools/sift.mjs';

const { SIFT } = await import('../../js/game.js');
const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]], SEEDS = [7, 11], PLACES = 2;
const level = async (L, loops) => {
  const sum = { n: 0, none: 0, gems: 0, grit: 0, lgems: 0, lgrit: 0 };
  for (const [ux, uy] of DIRS) { const s = await play(L, ux, uy, SEEDS, PLACES, null, loops); for (const k in sum) sum[k] += s[k]; }
  return sum;
};
const built = [];
for (let L = 1; L <= 4; L++) {
  const s = built[L] = await level(L, true);
  check(s.n >= (L === 1 ? 8 : 16), `level ${L}: only ${s.n} places were played`);
  check(s.none <= 2, `level ${L}: ${s.none} of ${s.n} charges shook nothing loose`);
  check(s.grit >= 1.5 * s.lgrit, `level ${L}: ${s.n} charges brought home ${Math.round(s.grit)} grit, the loops of the same time ${Math.round(s.lgrit)}`);
  if (L >= 3) check(s.gems >= 25 * s.n && s.gems >= 2 * s.lgems, `level ${L}: ${s.n} charges brought home ${s.gems} gems, the loops of the same time ${s.lgems}`);
}
const gems = built[3].gems + built[4].gems, figures = { shake: SIFT.shake, room: SIFT.room };
for (const [shake, room, share] of [[0, 2, 0.75], [2, 1, 0.85], [2, 0, 0.34]]) {
  Object.assign(SIFT, { shake, room });
  const less = (await level(3, false)).gems + (await level(4, false)).gems;
  check(less < share * gems, `lumps followed ${shake} past the edge and ${room} of room: ${less} gems at levels 3 and 4, against ${gems} as built`);
}
Object.assign(SIFT, figures);

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : `no defect: a charge brings home ${(built[3].gems / built[3].n).toFixed(0)} gems at level 3 and ${(built[4].gems / built[4].n).toFixed(0)} at level 4, the loop of the same time ${(built[3].lgems / built[3].n).toFixed(0)} and ${(built[4].lgems / built[4].n).toFixed(0)}`);
process.exit(fails.length ? 1 : 0);
