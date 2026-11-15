// Ash cuts like air (docs/CONTENT-PLAN.md, content item 7; js/game.js: PLOUGH, and its places in fly and
// finishDig). Ground whose row's `dig` is under 0.3 is ploughed, not cut a block at a time. In a strip of ash laid
// by hand, beside the same strip laid as ground that is all but as quick (dig 0.35, which is cut as any ground is):
//   - pushing into ash does not break the drill's run: steered into it for a second and a half, its run is as
//     long as that; in the other ground every push begins the run again;
//   - the drill is not drawn square on to a block of ash: steered due east a third of a cell off the middle of its
//     row, it stays there and ploughs both the rows it lies across; in the other ground it is drawn to the middle
//     of a row and cuts a tunnel one cell wide;
//   - so ash is gone at close on flying speed: over nine cells in the second and a half with the first bit and no
//     ram, faster as the run builds, where the other ground gives under eight (and soft rock four);
//   - a tektite takes the time its kind takes times the ash's own fifth (0.09 s with the first bit), not the 0.45 s
//     of a mineral in ordinary ground;
//   - ploughing through a tektite every other cell, the lab's count of them (TEKTITE 3/4) comes up no more than
//     once a second, though a level gained (TEKTITE +2%) always does; ore cut into
//     in ground that is not ploughed says so every time;
//   - out of the ash and into ordinary rock, the first push breaks the run as it always did.
//   node test/regress/c7-ash-plough.mjs
import { makeGame, C, N, K, B, world } from '../harness.mjs';

const { BIOMES, biome, digTime } = world, HX = C + 0.5, HY = C + 0.5;
const fails = [], check = (ok, what) => { if (!ok && fails.length < 16) fails.push(what); };
// The same looks as ash, as a ground that is not ploughed: its `dig` just over the mark.
const slow = biome({ id: 120, name: 'test-slow-ash', kin: B.EMBER, sheet: 'ash', floor: 'ash-floor', dig: 0.35, worth: 0, gloom: [14, 14, 16], mote: ['#d0d0d0', 'fall'], map: [196, 196, 192], debris: ['#c4c4c0', '#d2d2ce', '#77777f'] });
check(BIOMES[34].dig === 0.2 && slow.dig === 0.35 && BIOMES.filter(row => row && row.id < 120 && row.dig < 0.3).length === 1, 'ash is not the one ground that cuts in under three tenths of the time');

// A game with a tunnel three cells wide from the core 30 cells east, and beyond it a strip of ground `b`, 40 cells
// long and 9 wide, with `ore` (a kind) in every other cell of the middle three rows from the sixth cell on. The
// drill stands at the tunnel's end, `off` of a cell south of the middle of its row.
const strip = async (b, ore, off = 0) => {
  const game = await makeGame(7, { tether: 5 }), w = game.world, d = game.drill;
  for (let x = 3; x <= 30; x++) for (let y = -1; y <= 1; y++) w.setK((C + y) * N + C + x, K.EMPTY);
  for (let x = 31; x <= 70; x++) for (let y = -4; y <= 4; y++) {
    const i = (C + y) * N + C + x;
    w.setB(i, b); w.setK(i, ore && x >= 36 && x % 2 === 0 && Math.abs(y) <= 1 ? ore : K.SOFT);
  }
  d.x = C + 30.5; d.y = C + 0.5 + off; d.mode = 'free';
  game.band = [[d.x, d.y], [HX, HY]];
  game.changed();
  const said = [], popup = game.popup.bind(game);
  // (What a cell says of a sample: `up` where it is a level gained, which is always said.)
  game.popup = (x, y, label, ...rest) => { if (label === 'CRUSHED' || /[%0-9]$/.test(label)) said.push({ t: game.time, up: label.endsWith('%') }); popup(x, y, label, ...rest); };
  return { game, w, d, said };
};
const east = (game, seconds, each) => { for (let f = 0; f < Math.round(seconds * 60); f++) { game.input.auto = [1, 0, 1]; game.update(1 / 60); each?.(); } game.input.auto = null; };
const opened = (w, y) => { let n = 0; for (let x = 31; x <= 70; x++) if (w.k((C + y) * N + C + x) === K.EMPTY) n++; return n; };
const out = {};

// ---- the run, and how far it gets
{
  const ash = await strip(34, 0), other = await strip(120, 0);
  let least = Infinity, most = 0;
  east(ash.game, 1.5, () => { if (ash.game.time > 0.5) least = Math.min(least, ash.d.run); });
  east(other.game, 1.5, () => { if (other.d.x > C + 31) most = Math.max(most, other.d.run); });
  check(ash.d.run > 1.4 && least > 0.4, `a second and a half into ash, the drill's run is ${ash.d.run.toFixed(2)} s (${least.toFixed(2)} at the least after the first half second)`);
  check(most < 0.3, `in ground that is not ploughed the run reached ${most.toFixed(2)} s between pushes`);
  const far = ash.d.x - C - 30.5, slowFar = other.d.x - C - 30.5;
  check(far > 9 && slowFar < 8 && far > slowFar * 1.3, `in a second and a half the drill went ${far.toFixed(1)} cells through ash and ${slowFar.toFixed(1)} through the other ground`);
  check(opened(ash.w, 0) >= 9 && opened(ash.w, 1) === 0 && opened(ash.w, -1) === 0, `steered down the middle of a row of ash, it opened ${opened(ash.w, -1)}, ${opened(ash.w, 0)} and ${opened(ash.w, 1)} cells of the three rows`);
  out.run = { ash: +ash.d.run.toFixed(2), other: +most.toFixed(2), cells: [+far.toFixed(1), +slowFar.toFixed(1)] };
}

// ---- not drawn square on
{
  const ash = await strip(34, 0, 0.3), other = await strip(120, 0, 0.3);
  east(ash.game, 1); east(other.game, 1.5);
  const moved = ash.d.y - C - 0.8, drawn = other.d.y - C - 0.8;
  check(Math.abs(moved) < 0.02 && opened(ash.w, 0) >= 4 && opened(ash.w, 1) >= 4, `a third of a cell off its row in ash, the drill moved ${moved.toFixed(3)} across its heading and opened ${opened(ash.w, 0)} and ${opened(ash.w, 1)} cells of the two rows it lay across`);
  check(Math.abs(drawn) > 0.2 && Math.min(opened(other.w, 0), opened(other.w, 1)) <= 1, `in ground that is not ploughed it was drawn ${drawn.toFixed(3)} across its heading, and opened ${opened(other.w, 0)} and ${opened(other.w, 1)} cells of the two rows`);
  out.square = { ash: +moved.toFixed(3), other: +drawn.toFixed(3) };
}

// ---- a tektite's time, and CRUSHED
{
  // (A strip that names its mineral, as the ash flat's row does: the cells are tektite.)
  const ash = await strip(34, K.MINERAL), other = await strip(120, K.ORE_A);
  check(Math.abs(digTime(K.MINERAL, BIOMES[34]) - 0.09) < 1e-9, `a tektite cuts in ${digTime(K.MINERAL, BIOMES[34])} s with the first bit`);
  let crushed = 0, time = 0;
  const finish = ash.game.finishDig.bind(ash.game);
  ash.game.finishDig = i => { if (ash.w.k(i) === K.MINERAL) { crushed++; time = ash.d.digDur; } finish(i); };
  east(ash.game, 2.6);
  check(Math.abs(time - 0.09) < 1e-9, `the cut through a tektite was to take ${time} s`);
  // (The first, second and fourth tektites each gain a level, and say so. A count is said only a second after
  // anything was, so in these 2.6 s there may be none.)
  const gaps = ash.said.map((s, n) => s.up || n === 0 ? 9 : s.t - ash.said[n - 1].t);
  check(crushed >= 6 && ash.said.filter(s => s.up).length === 3 && ash.said.length <= 5 && gaps.every(g => g >= 1 - 1e-9), `ploughing through ${crushed} tektites in 2.6 s, the lab spoke ${ash.said.length} times (${ash.said.filter(s => s.up).length} of them levels), ${gaps.map(g => g.toFixed(2))} s apart`);
  let ore = 0;
  const done = other.game.finishDig.bind(other.game);
  other.game.finishDig = i => { if (other.w.k(i) === K.ORE_A) ore++; done(i); };
  east(other.game, 3);
  check(ore >= 4 && other.said.length === ore, `cutting through ${ore} cells of ore in ground that is not ploughed, CRUSHED came up ${other.said.length} times`);
  out.crushed = { tektites: crushed, said: ash.said.length, ore, saidOre: other.said.length };

  // ---- out of the ash, the next push breaks the run
  for (let x = 71; x <= 80; x++) for (let y = -1; y <= 1; y++) { const i = (C + y) * N + C + x; ash.w.setB(i, B.CRUST); ash.w.setK(i, K.SOFT); }
  let inAsh = 0, broke = false;
  for (let n = 0; n < 40 && ash.d.x < C + 72.5; n++) east(ash.game, 0.25, () => { if (ash.d.x < C + 70) inAsh = ash.d.run; else if (ash.d.x > C + 70.6 && ash.d.run < 0.1) broke = true; });
  check(inAsh > 2 && broke && ash.d.x >= C + 72.5, `the run was ${inAsh.toFixed(2)} s at the end of the ash, and ${broke ? 'broke' : 'did not break'} on the rock beyond it`);
}

console.log(JSON.stringify(out));
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: ash is ploughed: a push into it breaks no run and draws the drill square on to nothing, a tektite takes a fifth of a mineral\'s time, and CRUSHED comes up once a second at the most');
process.exit(fails.length ? 1 : 0);
