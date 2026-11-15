// S5: the name of a place. When the drill comes into another place its name comes up: across the screen for 1.6 s
// the first time a ground is ever met (S.met), and after that on a plate for 2.4 s. The ground a game begins in is
// not announced. A pocket is a place of its own, known by its zone's key, and is marked as visited (S.visited). The
// name is the row's title and nothing else. What is met is saved, and a game saved before these fields has them.
//   node test/regress/s5-place.mjs
import { makeGame, Game, world, C, N } from '../harness.mjs';
import { arena, rect, flyTo, idle, at } from './lib/lasso.mjs';
const { K, B, BIOMES, biome } = world;

const game = await makeGame(7, { tether: 3 }), w = game.world, S = game.S, fails = [];
const check = (ok, what) => { if (!ok) fails.push(what); };
const fly = (x, y) => { if (flyTo(game, x, y) < 0) throw new Error(`never reached ${x},${y}`); };
const ground = (x0, y0, x1, y1, b) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) w.setB(at(x, y), b); };
const says = () => game.place && { title: game.place.title, card: game.place.card, life: game.place.life, icon: game.place.icon };
// Fly toward a cell until a name comes up, let go, and count how long the name stays.
const cross = (x, y) => {
  const d = game.drill;
  for (let f = 0; f < 900 && !game.place; f++) {
    const dx = C + x + 0.5 - d.x, dy = C + y + 0.5 - d.y, far = Math.hypot(dx, dy) || 1;
    game.input.auto = [dx / far, dy / far, 0.7];
    game.update(1 / 60);
  }
  game.input.auto = null;
  const said = says(), key = game.placeKey;
  let frames = 0;
  while (game.place && frames < 900) { game.update(1 / 60); frames++; }
  return { ...said, seconds: Math.round(frames / 6) / 10, key };
};
const same = (got, want) => JSON.stringify(got) === JSON.stringify(want);

check(game.place === null && same(S.met, { 0: 1 }) && same(S.marks, []) && same(S.visited, {}), `a new game: place ${JSON.stringify(game.place)}, met ${JSON.stringify(S.met)}, marks ${JSON.stringify(S.marks)}, visited ${JSON.stringify(S.visited)}`);

// A corridor east from the core; from 14 cells out it is the north's ground.
arena(game, 30);
rect(game, 3, 0, 6, 0, K.EMPTY); rect(game, 6, 0, 6, 3, K.EMPTY); rect(game, 6, 3, 24, 3, K.EMPTY);   // (with a jog in it: a throw from the core stops there)
ground(14, -3, 30, 6, B.FROST);
game.changed();
idle(game, 0.2);
check(game.place === null, `a name came up where the game began: ${JSON.stringify(says())}`);
fly(6, 0); fly(6, 3); fly(9, 3);
check(game.place === null, 'a name came up with no change of place');
let said = cross(18, 3);
check(same(said, { title: 'FROST', card: true, life: 1.6, icon: 'frost', seconds: 1.6, key: B.FROST }) && S.met[B.FROST] === 1, `the north met for the first time: ${JSON.stringify(said)}, met ${JSON.stringify(S.met)}`);
check(said.title === BIOMES[B.FROST].title, 'the name is not the title in the row of its ground');
said = cross(7, 3);
check(same(said, { title: 'CRUST', card: false, life: 2.4, icon: 'grit', seconds: 2.4, key: B.CRUST }), `back in the home ground: ${JSON.stringify(said)}`);
said = cross(18, 3);
check(same(said, { title: 'FROST', card: false, life: 2.4, icon: 'frost', seconds: 2.4, key: B.FROST }), `the north met again: ${JSON.stringify(said)}`);
fly(17, 3);
check(game.place === null, 'a name came up again with no change of place');

// Two pockets of one kind, either side of the line where two sectors of pockets meet (x = 0), and home ground
// between them: each is a place of its own.
const hive = biome({ id: 121, name: 'test-hive', title: 'AMBER HIVE', kin: B.MIRE, pocket: { mineral: 'amber', lump: 4, spec: 1.5 },
  sheet: 'mire', floor: 'mire-floor', gloom: [1, 2, 3], mote: ['#ffffff', 'still'], map: [102, 84, 120], debris: ['#000000'], gen: BIOMES[3].gen });
w.zoneOf = (sx, sy) => ({ key: `z${sx},${sy}`, row: hive.id, cx: C + sx * 128 + 64, cy: C + sy * 128 + 64, rho: 9, kin: B.MIRE });
rect(game, 0, -6, 0, -3, K.EMPTY); rect(game, -10, -6, 10, -6, K.EMPTY);
ground(3, -8, 10, -4, hive.id); ground(-10, -8, -3, -4, hive.id);
game.changed();
fly(0, 0); idle(game, 0.2); fly(0, -6);
idle(game, 3);
said = cross(6, -6);
check(same(said, { title: 'AMBER HIVE', card: true, life: 1.6, icon: 'mire', seconds: 1.6, key: 'z0,-1' }) && same(S.visited, { 'z0,-1': 1 }) && S.met[121] === 1, `a pocket met for the first time: ${JSON.stringify(said)}, visited ${JSON.stringify(S.visited)}`);
said = cross(0, -6);
check(said.title === 'CRUST' && said.card === false, `out of the pocket: ${JSON.stringify(said)}`);
said = cross(-6, -6);
check(same(said, { title: 'AMBER HIVE', card: false, life: 2.4, icon: 'mire', seconds: 2.4, key: 'z-1,-1' }) && same(S.visited, { 'z0,-1': 1, 'z-1,-1': 1 }), `the second pocket: ${JSON.stringify(said)}, visited ${JSON.stringify(S.visited)}`);
delete w.zoneOf;

// What is met is saved; a game saved before these fields were kept has them when it is loaded, and the home ground met.
const canvas = () => ({ width: 0, height: 0, style: {}, getContext: () => new Proxy({}, { get: () => () => ({ data: new Uint8ClampedArray(4) }), set: () => true }) });
S.marks.push([at(57, 13), K.CACHE, '#ffe14a']);                   // (a cache the world itself lays there)
game.save();
const again = new Game(canvas());
check(await again.restore() && same(again.S.met, S.met) && same(again.S.visited, S.visited) && same(again.S.marks, S.marks), `a saved game came back with met ${JSON.stringify(again.S.met)}, visited ${JSON.stringify(again.S.visited)}, marks ${JSON.stringify(again.S.marks)}`);
const old = JSON.parse(localStorage.getItem('tetherbore-save-v3'));
for (const field of ['met', 'marks', 'visited', 'wrecks']) delete old[field];
localStorage.setItem('tetherbore-save-v3', JSON.stringify(old));
const older = new Game(canvas());
check(await older.restore() && same(older.S.met, { 0: 1 }) && same(older.S.marks, []) && same(older.S.visited, {}) && older.S.wrecks.length === 8 && older.S.grit === S.grit,
  `an older save came back with met ${JSON.stringify(older.S.met)}, marks ${JSON.stringify(older.S.marks)}, visited ${JSON.stringify(older.S.visited)}, wrecks ${JSON.stringify(older.S.wrecks)}`);
check(localStorage.getItem('tetherbore-save-v3') !== null && JSON.parse(localStorage.getItem('tetherbore-save-v3')).v === 3, 'the save is not version 3 under the same key');

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: a ground met for the first time is named across the screen, after that on its plate; a pocket is a place of its own; what is met is saved');
process.exit(fails.length ? 1 : 0);
