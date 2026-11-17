// The air of the deep strains (js/game.js: CURRENT, `fly`; js/world.js: `flowAt`). A flight staged by hand: the
// drill flown from the core due east for sixty frames with the thumb down, across open ground all of
// one row, on world 7, where a thermal stands across that line east of the core:
//   - in the glacier the wind leans on the flight, and in the caldera the heat: each lands in the same place every
//     time it is flown, and not where the same flight lands in rime or in magma, the flanks they are strains of;
//   - in the caldera the heat lifts it (north is up the screen: it lands further north), and where the thermal is not
//     it does not: flown due north, where there is none, it lands where the flight in magma lands;
//   - in every other row there is (none has a current) it lands where the flight in the home ground does;
//   - with the thumb lifted the drill stands: in the glacier, left still for two seconds, it has not moved;
//   - the game says the flow as it is (`flow`: the row's current and the way of the air), and nothing where there
//     is none.
// Fails on the game before there were currents: the glacier's flight is rime's, and the caldera's magma's.
//   node test/regress/c10-currents.mjs
import { makeGame, world, C, N } from '../harness.mjs';
import { arena, fixRandom } from './lib/lasso.mjs';
const { K, B, BIOMES } = world;

const fails = [], check = (ok, what) => { if (!ok && fails.length < 20) fails.push(what); };
fixRandom(3);
const GLACIER = BIOMES.findIndex(r => r?.name === 'glacier'), CALDERA = BIOMES.findIndex(r => r?.name === 'caldera'), RIME = 5, MAGMA = 6;
const fly = async (b, way = 1, frames = 60, still = 0) => {
  const game = await makeGame(7, { tether: 1 }), d = game.drill;
  arena(game, 66, K.EMPTY, b);
  game.changed();
  let flow = null;
  for (let f = 0; f < frames; f++) { game.input.auto = way === 'north' ? [0, -1, 1] : [way, 0, 1]; game.update(1 / 60); if (f === 40) flow = { ...game.flow }; }
  game.input.auto = null;
  const at = [d.x, d.y];
  for (let f = 0; f < still; f++) game.update(1 / 60);
  return { game, x: d.x - C - 0.5, y: d.y - C - 0.5, at, moved: Math.hypot(d.x - at[0], d.y - at[1]), flow };
};
const same = (a, b) => a.x === b.x && a.y === b.y, where = r => `${r.x.toFixed(3)},${r.y.toFixed(3)}`;

const crust = await fly(0), rime = await fly(RIME), magma = await fly(MAGMA);
check(crust.x > 8 && Math.abs(crust.y) < 1e-9, `the plain flight landed at ${where(crust)}`);
check(same(rime, crust) && same(magma, crust), `the flights in rime and magma landed at ${where(rime)} and ${where(magma)}, not with the home ground's at ${where(crust)}`);
for (const [b, plain, nameOf] of [[GLACIER, rime, 'glacier'], [CALDERA, magma, 'caldera']]) {
  const one = await fly(b), two = await fly(b);
  check(same(one, two), `the ${nameOf}'s flight landed at ${where(one)} once and ${where(two)} the next time`);
  check(Math.hypot(one.x - plain.x, one.y - plain.y) > 0.5, `the ${nameOf}'s flight landed at ${where(one)}, with its flank's at ${where(plain)}`);
  check(one.flow?.kind === BIOMES[b].current && Math.hypot(one.flow.x, one.flow.y) > 0, `in the ${nameOf} the game says the flow is ${JSON.stringify(one.flow)}`);
  check(plain.flow?.kind === null && plain.flow.x === 0 && plain.flow.y === 0, `in its flank the game says the flow is ${JSON.stringify(plain.flow)}`);
  if (b === CALDERA) check(one.y < plain.y - 0.5, `the caldera's heat did not lift the flight: ${where(one)} against ${where(plain)}`);
}
// (North of the core on world 7 there is no thermal on the line: `flowAt`.)
{
  const w = (await makeGame(7)).world, f = { x: 0, y: 0 };
  let none = true;
  for (let y = -60; y <= 0; y++) { w.flowAt(C + 0.5, C + y + 0.5, 'heat', f); if (f.y) none = false; }
  const north = await fly(CALDERA, 'north'), plain = await fly(MAGMA, 'north');
  check(none && same(north, plain), `flown north where no thermal is (${none}), the caldera's flight landed at ${where(north)}, magma's at ${where(plain)}`);
}
// Every other row: no current, no lean.
let rows = 0;
for (const row of BIOMES) {
  if (!row || row.current !== null || row.id === 0) continue;
  const r = await fly(row.id, 1, 50), plain = await fly(0, 1, 50);
  rows++;
  check(same(r, plain), `in ${row.name} (no current) the flight landed at ${where(r)}, the home ground's at ${where(plain)}`);
}
// The thumb lifted: the drill stands.
{
  const r = await fly(GLACIER, 1, 0, 120);
  check(r.moved === 0, `left still in the glacier the drill moved ${r.moved} cells`);
}
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : `ok: the glacier's wind and the caldera's heat lean on a flight with the thumb down, the same every time; ${rows} other rows lean on nothing, and a drill left still stands`);
process.exit(fails.length ? 1 : 0);
