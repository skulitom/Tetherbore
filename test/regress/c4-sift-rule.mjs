// Content item 4: the bomb. A charge opens the plain rock in a disc round the drill, by the level of BLAST, and
// nothing else:
//   the disc is 21, 21, 37 and 69 cells at levels 1 to 4, and only cells in it open where nothing stands;
//   soft and dense rock, ice, basalt, glass and fault rock go; every other kind stands as it stood;
//   a hazard that stands is not woken, then or after: no lava, no cloud, no fuse, no jolt;
//   what stands has the plain rock round it opened two cells deep, past the disc's edge too (`SIFT.room`), and is
//   in the books as loose at once, each lump a piece of its own, by a single `changed`;
//   a lump that runs out of the disc is followed two cells past its edge (`SIFT.shake`) and comes loose whole; one
//   that runs further stays on the wall;
//   nothing opens beyond the tether's reach;
//   in ground that freezes the room closes over with ice like any cut;
//   a charge that would open nothing is not spent and says NO ROCK; with none left the tap says NO BOMBS;
//   and a lump the charge left loose is hauled by flying round it, and pays its gems.
import { makeGame, K, B, C, N, at, rect, arena, fixRandom, flyTo, idle, isLoose, tetherFaults, world } from './lib/lasso.mjs';

const { SIFT } = await import('../../js/game.js');
const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const HX = C + 0.5, HY = C + 0.5, PLAIN = [K.SOFT, K.DENSE, K.ICE, K.BASALT, K.GLASS, K.FAULT];
const figures = { ...SIFT, radius: [...SIFT.radius] };
check(JSON.stringify(SIFT.radius) === '[0,2.5,2.5,3.5,4.5]' && SIFT.shake === 2 && SIFT.room === 2, `the bomb's figures are ${JSON.stringify(SIFT)}`);

// A block of one kind of ground round the core, a tunnel east along y = 0, and the drill at its end, (X, 0).
const X = 20;
async function staged(level, { reach = 3, ground = B.CRUST, fill = K.SOFT, x = X } = {}) {
  fixRandom(4);
  const game = await makeGame(7, { tether: reach, drill: 4, bombs: level });
  arena(game, 40, fill, ground);
  rect(game, 3, 0, x, 0, K.EMPTY);
  const d = game.drill;
  d.x = d.px = C + x + 0.5; d.y = d.py = C + 0.5; d.mode = 'free';
  game.band = [[d.x, d.y], [HX, HY]];
  game.bombs = game.val('bombs');
  game.changed();
  return game;
}
const solid = game => { const set = new Set(); for (let y = -14; y <= 14; y++) for (let x = X - 14; x <= X + 14; x++) if (game.world.k(at(x, y)) !== K.EMPTY) set.add(at(x, y)); return set; };
const off = i => [(i % N) - C - X, Math.floor(i / N) - C];

// The disc, by level, in ground with nothing in it.
for (let level = 1; level <= 4; level++) {
  const game = await staged(level), r = SIFT.radius[level], before = solid(game), asked = game.sifts(C + X, C);
  check(solid(game).size === before.size, `level ${level}: asking what a charge would open changed the ground`);
  game.blast();
  const opened = [...before].filter(i => game.world.k(i) === K.EMPTY), disc = [21, 21, 37, 69][level - 1], tunnel = Math.floor(r) + 1;
  check(opened.length === disc - tunnel, `level ${level}: a charge in plain ground opened ${opened.length} cells, not the ${disc} of its disc less the ${tunnel} the tunnel had open`);
  check(opened.every(i => { const [u, v] = off(i); return u * u + v * v <= r * r; }), `level ${level}: a cell opened outside the disc of radius ${r}`);
  check(asked.length === opened.length && asked.every(i => game.world.k(i) === K.EMPTY), `level ${level}: sifts said ${asked.length} cells and the charge opened ${opened.length}`);
  check(game.bombs === level - 1, `level ${level}: ${game.bombs} charges left of ${level} after one`);
  check(!game.pieces.some(cells => cells.some(i => Math.abs(off(i)[0]) < 10)) && !tetherFaults(game).length, `level ${level}: plain ground left something loose, or the tether is wrong`);
}

// What goes and what stands: one cell of each kind inside the disc, two cells east and one south of the drill.
for (const [name, k] of Object.entries(K)) {
  if (k === K.EMPTY || k === K.CORE) continue;
  const game = await staged(1), w = game.world, i = at(X + 2, 1);
  w.setK(i, k); game.changed();
  game.blast();
  if (PLAIN.includes(k)) { check(w.k(i) === K.EMPTY, `${name} is plain rock and did not open`); continue; }
  check(w.k(i) === k, `${name} did not stand: the cell is kind ${w.k(i)} after the charge`);
  if (world.HARD[k] >= 99) continue;
  check(game.pieceOf.get(i)?.length === 1 && isLoose(game, [i]), `${name} left standing is not in the books as a loose lump of one cell`);
}

// One nugget on the disc's edge has room all round it, past the edge; with less room in the figures it has less.
for (const room of [2, 1]) {
  SIFT.room = room;
  const game = await staged(1), w = game.world, i = at(X + 2, 1);
  w.setK(i, K.ORE_B); game.changed();
  game.blast();
  let open = 0, shut = 0;
  for (let v = -2; v <= 2; v++) for (let u = -2; u <= 2; u++) if (u || v) { if (w.k(i + v * N + u) === K.EMPTY) open++; else shut++; }
  if (room === 2) check(shut === 0, `${shut} of the 24 cells within two of a nugget on the disc's edge are still rock`);
  else check(shut > 0 && w.k(at(X + 4, 1)) === K.SOFT && w.k(at(X + 3, 2)) === K.EMPTY, `with one cell of room, ${open} of the 24 cells round the nugget opened`);
  check(w.k(at(X + 5, 1)) === K.SOFT, 'rock three cells from the nugget, outside the disc, opened');
}
Object.assign(SIFT, figures);

// A lump that runs out over the disc's edge: followed two cells past it and no further.
for (const [shake, long, loose] of [[2, 3, true], [2, 5, false], [0, 3, false]]) {
  SIFT.shake = shake;
  const game = await staged(1), w = game.world, lump = [];
  for (let n = 0; n < long; n++) { lump.push(at(X + 2 + n, 1)); w.setK(lump[n], K.ORE_A); }
  game.changed();
  game.blast();
  check(lump.every(i => w.k(i) === K.ORE_A), `a lump of ${long} over the edge lost cells to the charge`);
  const piece = game.pieceOf.get(lump[0]);
  if (loose) check(piece?.length === long && isLoose(game, lump), `a lump of ${long} cells running two past the disc's edge is not loose: ${piece ? `the books have ${piece.length} cells` : 'the books do not have it'}`);
  else check(!piece && !isLoose(game, lump), `a lump of ${long} with lumps followed ${shake} past the edge came loose`);
}
Object.assign(SIFT, figures);

// Two lumps, one `changed`, both in the books; and a hazard of each kind that stands is not woken.
{
  const game = await staged(1), w = game.world, a = at(X + 1, -1), b = [at(X - 1, 1), at(X - 1, 2)];
  w.setK(a, K.ORE_B); for (const i of b) w.setK(i, K.SLATE);
  game.changed();
  const changed = game.changed.bind(game);
  let calls = 0;
  game.changed = (...args) => { calls++; return changed(...args); };
  game.blast();
  check(calls === 1, `the charge told the books of loose ground ${calls} times, not once`);
  check(game.pieceOf.get(a)?.length === 1 && game.pieceOf.get(b[0])?.length === 2 && game.pieceOf.get(b[0]) === game.pieceOf.get(b[1]) && game.pieceOf.get(a) !== game.pieceOf.get(b[0]), 'two lumps left by one charge are not two pieces in the books');
}
for (const [ground, type] of [[B.EMBER, 'lava'], [B.MIRE, 'spore'], [B.LODE, 'spark']]) {
  const game = await staged(1, { ground }), w = game.world, cells = [at(X + 1, 1), at(X + 2, 1), at(X - 1, -1)];
  for (const i of cells) w.setK(i, K.HAZARD);
  game.changed();
  check(w.hazAt(cells[0]) === type, `the staged hazard is ${w.hazAt(cells[0])}, not ${type}`);
  game.blast();
  let stunned = 0;
  idle(game, 3, () => { if (game.drill.stun > 0) stunned++; });
  check(cells.every(i => w.k(i) === K.HAZARD), `${type} did not stand through a charge`);
  check(w.lava.size === 0 && game.clouds.length === 0 && game.sparks.size === 0 && stunned === 0, `${type} was woken by a charge: ${w.lava.size} cells of lava, ${game.clouds.length} clouds, ${game.sparks.size} fuses, ${stunned} frames stunned`);
  check(cells.every(i => game.pieceOf.has(i)), `${type} left standing by a charge is not in the books as loose`);
}

// Nothing opens beyond the tether's reach: the drill at 21 on the first reach but one (22 cells).
{
  const game = await staged(1, { reach: 1, x: 21 }), w = game.world, before = solid(game);
  w.setK(at(22, 2), K.ORE_B); game.changed();
  game.blast();
  const opened = [...before].filter(i => w.k(i) === K.EMPTY), beyond = opened.filter(i => !game.within((i % N) + 0.5, Math.floor(i / N) + 0.5));
  check(opened.length > 5 && !beyond.length, `${beyond.length} of ${opened.length} cells a charge opened lie beyond the tether's reach`);
  check(w.k(at(23, 0)) === K.SOFT && w.k(at(23, 2)) === K.SOFT, 'a cell of the disc beyond the reach opened');
}

// In ground that freezes, the room closes over with ice like any cut (not where the drill stands, or its tether lies).
{
  const game = await staged(3, { ground: B.FROST }), w = game.world, before = solid(game);
  game.blast();
  const opened = [...before].filter(i => w.k(i) === K.EMPTY);
  idle(game, 34);
  const iced = opened.filter(i => w.k(i) === K.ICE).length;
  check(opened.length === 37 - 4 && iced >= opened.length - 8, `${iced} of the ${opened.length} cells a charge opened in frost have frozen over after 34 s`);
  check(!tetherFaults(game).length, `the tether after the room froze: ${tetherFaults(game).join('; ')}`);
}

// A refusal says why, and spends nothing.
{
  const game = await staged(2), before = solid(game).size;
  game.bombs = 0;
  game.blast();
  check(game.popups.some(p => p.label === 'NO BOMBS') && solid(game).size === before && game.bombs === 0, 'a tap with no charge left did not say NO BOMBS, or changed something');
  const open = await staged(2);
  rect(open, X - 6, -6, X + 6, 6, K.EMPTY); open.changed();
  open.blast();
  check(open.popups.some(p => p.label === 'NO ROCK') && open.bombs === 2, `a charge with no rock to open: ${open.bombs} of 2 left, popups ${open.popups.map(p => p.label).join(',') || 'none'}`);
  const none = await staged(0);
  none.blast();
  check(!none.popups.length && solid(none).size === before, 'a drill with no BLAST bought blasted, or said something');
}

// What a charge leaves loose is hauled by flying round it, in the room the charge made, and pays.
{
  const game = await staged(1, { ground: B.LODE }), w = game.world, i = at(X + 2, 1);
  w.setK(i, K.ORE_B); game.changed();
  game.blast();
  const cut = game.cuts;
  for (const [x, y] of [[X, 3], [X + 4, 3], [X + 4, -1], [X, -1]]) if (flyTo(game, x, y) < 0) { check(false, `the way round the nugget is not open: never reached ${x},${y}`); break; }
  idle(game, 0.3);
  check(game.S.stats.hauls === 1 && w.k(i) === K.EMPTY && game.S.gems[B.LODE] === 5, `flown round, the nugget was hauled ${game.S.stats.hauls} times and paid ${game.S.gems[B.LODE]} gems`);
  check(game.cuts === cut + 1, `the flight round the nugget cut ground (${game.cuts - cut - 1} cuts besides the haul's own)`);
}

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : 'no defect: a charge opens the plain rock of its disc and round what stands, wakes nothing, and leaves every lump loose in the books');
process.exit(fails.length ? 1 : 0);
