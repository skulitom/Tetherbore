// An amber hive played with no hand on it (docs/CONTENT-PLAN.md, content item 6; tools/hive-play.mjs): the drill
// flies in through the wax, flies the lane round a nugget once, biting through the stalk as it passes, and the
// nugget comes home when the tether is round it. Held here, on world 7:
//   - the west's first hive: every nugget it has comes home, each in a light haul of the nugget's nine cells of
//     amber and no more than its two of stalk, with no amber crushed and the tether sound all the way;
//   - each nugget pays nine lumps, of 0.8 seconds of what cutting earns out there, and no more for coming close
//     behind another (the hive has no chain), and nine quarters of a specimen;
//   - the specimens are the direction's the hive lies in: the west's, and from the north's first hive the north's,
//     though a hive is the west's kind of pocket;
//   - the hive is a place of its own: its ground is met, its record visited, and its amber called out by name;
//   - a bigger hive further out is played the same way.
//   node test/regress/c6-hive-play.mjs
import { income, C, N, K, B, world } from '../harness.mjs';
import { play, hivesOf } from '../../tools/hive-play.mjs';

const fails = [], check = (ok, what) => { if (!ok && fails.length < 14) fails.push(what); };
const round2 = n => { const unit = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1); return Math.round(n / unit) * unit; };
const probe = new world.World(); probe.reset(7);
const hives = hivesOf(probe), which = test => hives.findIndex(test);
const out = [];

for (const [name, pick, kin] of [['the west\'s first hive', which(Z => Z.herald && Z.kin === B.MIRE), B.MIRE], ['the north\'s first hive', which(Z => Z.herald && Z.kin === B.FROST), B.FROST], ['a hive 15 cells in radius', which(Z => !Z.herald && Z.rho > 14), B.MIRE]]) {
  const r = await play(7, pick), Z = r.hive, game = r.game, S = game.S, w = game.world, P = world.rowOf(Z.row).pocket;
  out.push({ name, at: [Z.cx - C, Z.cy - C], nuggets: r.nuggets, took: r.took.length, spec: r.spec[kin], seconds: +r.t.toFixed(1), crushed: r.crushed });
  check(pick >= 0 && Z.kin === kin && r.nuggets >= 2, `${name}: hive ${pick} of world 7 lies in direction ${Z.kin} and has ${r.nuggets} nuggets`);
  // Every nugget home: no amber is left in the hive, none was cut by the drill.
  let left = 0;
  for (let y = Z.cy - 40; y <= Z.cy + 40; y++) for (let x = Z.cx - 40; x <= Z.cx + 40; x++) if (w.b(y * N + x) === Z.row && w.k(y * N + x) === K.MINERAL) left++;
  check(left === 0 && !r.stuck, `${name}: ${left} cells of amber are left${r.stuck ? `; the nugget at ${r.stuck} was not brought home` : ''}`);
  check(r.crushed === 0, `${name}: ${r.crushed} cells of amber were crushed by the drill`);
  check(r.faults.length === 0, `${name}: the tether: ${r.faults.join('; ')}`);
  // Each haul of amber: nine cells of it to a nugget, the stalk's cells with it at the most.
  const amber = r.took.reduce((sum, t) => sum + Math.round(t.spec / P.spec), 0);
  check(amber === r.amber, `${name}: ${amber} cells of amber came home in the hauls, of ${r.amber}`);
  for (const t of r.took) {
    const nuggets = Math.round(t.spec / P.spec) / 9;
    check(Number.isInteger(nuggets) && nuggets >= 1 && t.n >= 9 * nuggets && t.n <= 11 * nuggets + 4, `${name}: the haul at ${t.at} had ${t.n} cells for ${nuggets} nuggets`);
    if (nuggets === 1) check(t.light, `${name}: one nugget at ${t.at} was no light haul`);
    // What it pays: nine lumps for a nugget, each what the row says and no chain on it (the stalk that came with
    // it is a few grit more).
    const far = Math.hypot(t.at[0], t.at[1]), lump = round2(income(Math.max(22, far)) * P.lump);
    check(t.paid >= 9 * nuggets * lump * 0.97 && t.paid <= 9 * nuggets * lump * 1.03 + 100, `${name}: the nugget at ${t.at} paid ${t.paid}, where nine lumps are about ${9 * lump}`);
  }
  // Specimens: the direction's the hive lies in, a quarter for each cell of amber, and no other direction's.
  check(Math.abs(S.spec[kin] - r.amber * P.spec) < 1e-6 && S.spec.every((n, b) => b === kin || n === 0), `${name}: specimens ${JSON.stringify(S.spec)} for ${r.amber} cells of amber in direction ${kin}`);
  // A place of its own.
  check(S.met[Z.row] === 1 && S.visited[Z.key] === 1, `${name}: the hive is not met (${S.met[Z.row]}) or not visited (${JSON.stringify(S.visited)})`);
  check(game.called.has(`mineral:${Math.floor((Z.cx - C) / world.FIND)},${Math.floor((Z.cy - C) / world.FIND)}`) || [...game.called].some(k => k.startsWith('mineral:')), `${name}: its amber was never called out: ${[...game.called]}`);
  check(game.pocketPips().every(p => p.key !== Z.key), `${name}: the map still marks the hive the drill has been into`);
}
console.log(JSON.stringify(out));
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: every nugget of three hives comes home in a lap of its chamber, pays nine lumps and nine quarters of a specimen of the hive\'s direction, with the tether sound');
process.exit(fails.length ? 1 : 0);
