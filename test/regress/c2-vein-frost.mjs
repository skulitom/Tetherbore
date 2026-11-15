// Vein frost (docs/CONTENT-PLAN.md, content item 2; js/game.js: `veined`, in the frost tick): in ground that
// freezes, a cut that closes over beside ore heals as ore, the plainer kind, where it would have closed with ice.
// Staged in the north's ground laid by hand, with ore put back where the seed laid ore:
//   - a cut beside ore, of either kind, is ore of the plainer kind once its time is up; a cut beside none, or
//     corner to corner with ore, is ice;
//   - only ore the world itself laid counts: a cut beside ore that healed, or beside ore set down where the seed
//     laid none, closes with ice, so a tunnel dug away from one nugget heals one cell of ore and no more;
//   - it heals when the ground's own row says a cut closes (serac: 15 seconds), and is told to the books of loose
//     ground as ground that grew;
//   - healed ore hauled pays the north's gems as any ore does; on screen it heals with a sparkle;
//   - ground that never freezes heals nothing.
// And counted in real ground: about a third of the plain rock of the north lies beside ore.
//   node test/regress/c2-vein-frost.mjs
import { makeGame, world, C, N } from '../harness.mjs';
import { arena, rect, at, idle, fixRandom } from './lib/lasso.mjs';
const { World, K, B, BIOMES } = world;

fixRandom(5);
const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const name = k => world.KIND_NAMES[k];
const SERAC = 18;

// The north's own ground above the core, serac to the west of it, the south's own below.
const game = await makeGame(7), w = game.world;
arena(game, 44, K.SOFT, B.FROST);
rect(game, -44, -44, -16, 44, K.SOFT, SERAC);
rect(game, -15, 8, 44, 44, K.SOFT, B.EMBER);
game.changed();
// What the seed laid in a cell of this ground, and cells to stage with: `ore(kind, ...)` finds a cell where the
// seed laid that ore with a cell beside it (to the east) where it laid none, and no other such ore near.
const seedKind = (x, y) => w.first(at(x, y)), isOre = k => k === K.ORE_A || k === K.ORE_B;
const used = [];
const ore = (kind, x0, y0, x1, y1, run = 1) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (seedKind(x, y) !== kind || used.some(([ux, uy]) => Math.abs(ux - x) < 8 && Math.abs(uy - y) < 4)) continue;
    let clear = true;
    for (let n = 1; n <= run; n++) if (isOre(seedKind(x + n, y))) clear = false;
    if (!clear) continue;
    used.push([x, y]); w.setK(at(x, y), kind);
    return [x, y];
  }
  throw new Error(`no cell where the seed laid kind ${kind} was found to stage with`);
};
const [ax, ay] = ore(K.ORE_A, -12, -40, 40, -12), [bx, by] = ore(K.ORE_B, -12, -40, 40, -12), [tx, ty] = ore(K.ORE_A, -12, -40, 30, -12, 4);
const [sx, sy] = ore(K.ORE_A, -40, -40, -20, 40), [ex, ey] = ore(K.ORE_A, -10, 12, 40, 40), [kx, ky] = ore(K.ORE_B, -12, -40, 40, -12);
// Ore set down where the seed laid none, and a cut far from any ore.
let fx = 0, fy = -10;
while (isOre(seedKind(fx, fy)) || isOre(seedKind(fx + 1, fy))) fx++;
w.setK(at(fx, fy), K.ORE_A);
const lone = at(30, -6), near = at(ax + 1, ay), rich = at(bx + 1, by), fake = at(fx + 1, fy), tunnel = [1, 2, 3, 4].map(n => at(tx + n, ty)), serac = at(sx + 1, sy), south = at(ex + 1, ey), corner = at(kx + 1, ky + 1);
check(w.b(serac) === SERAC && w.b(near) === B.FROST && w.b(south) === B.EMBER, 'the staging is wrong: a cut is not in the ground it was meant for');
game.changed();
const told = [], changed = game.changed.bind(game);
game.changed = (opened = [], closed = []) => { told.push(...closed); return changed(opened, closed); };

for (const i of [lone, near, rich, fake, corner, ...tunnel, serac, south]) game.finishDig(i);
const state = cells => cells.map(i => name(w.k(i))).join(' ');
idle(game, 14);
check([near, rich, serac].every(i => w.k(i) === K.EMPTY), `after 14 seconds: ${state([near, rich, serac])}`);
idle(game, 2.5);
check(w.k(serac) === K.ORE_A && w.k(near) === K.EMPTY, `after 16.5 seconds (a cut in serac closes at 15): serac's ${state([serac])}, the north's own ${state([near])}`);
idle(game, 12);
check([near, rich, lone, fake, ...tunnel].every(i => w.k(i) === K.EMPTY), `after 28.5 seconds: ${state([near, rich, lone, fake, ...tunnel])}`);
idle(game, 3.5);
check(w.k(near) === K.ORE_A, `a cut beside ore closed as ${state([near])}, not ore`);
check(w.k(rich) === K.ORE_A, `a cut beside rich ore closed as ${state([rich])}, not ore of the plainer kind`);
check(w.k(lone) === K.ICE, `a cut beside no ore closed as ${state([lone])}, not ice`);
check(w.k(corner) === K.ICE, `a cut corner to corner with ore closed as ${state([corner])}, not ice`);
check(w.k(fake) === K.ICE, `a cut beside ore the seed did not lay closed as ${state([fake])}, not ice`);
check(state(tunnel) === 'ORE_A ICE ICE ICE', `a tunnel of four cells dug away from one nugget closed as ${state(tunnel)}: one cell of ore and then ice`);
check([near, rich, lone, tunnel[0], tunnel[3], serac].every(i => told.includes(i)), 'a cut that healed was not told to the books of loose ground as ground that grew');
check(w.k(south) === K.EMPTY, `a cut beside ore in ground that never freezes is ${state([south])}`);
// A second cut beside the healed cell, away from the nugget: the healed ore seeds nothing.
{
  const again = at(ax + 2, ay);
  check(!isOre(seedKind(ax + 2, ay)) && w.k(again) === K.SOFT, 'the staging is wrong: the cell beyond the healed one is not plain rock');
  game.finishDig(again);
  idle(game, 31.5);
  check(w.k(again) === K.ICE, `a cut beside ore that had healed closed as ${state([again])}, not ice`);
}
// Healed ore is ore: hauled, it pays the north's gems.
check(game.payOf([near]).gems.join() === '0,1,0,0,0', `healed ore pays gems ${game.payOf([near]).gems}`);

// On screen it heals with a sparkle of its own.
{
  const view = await makeGame(7), vw = view.world;
  arena(view, 30, K.SOFT, B.FROST);
  let x = 4, y = -6;
  while (vw.first(at(x, y)) !== K.ORE_A || isOre(vw.first(at(x - 1, y)))) { x++; if (x > 20) { x = 4; y--; } }
  vw.setK(at(x, y), K.ORE_A);
  view.changed();
  view.cam.x = (C + x) * 16; view.cam.y = (C + y) * 16;
  view.finishDig(at(x - 1, y));
  view.parts.length = 0;
  for (let f = 0; f < 60 * 31; f++) { view.updateHazards(1 / 60); view.clock += 1 / 60; }
  check(vw.k(at(x - 1, y)) === K.ORE_A && view.parts.some(p => p.color === '#a8fff0'), `in view, the cut healed as ${name(vw.k(at(x - 1, y)))} with ${view.parts.filter(p => p.color === '#a8fff0').length} sparks of its own colour`);
}

// Real ground: how much of the north's plain rock lies beside ore, which is how often a cut heals.
{
  const real = new World(); real.reset(7);
  let plain = 0, beside = 0;
  for (let y = C - 330; y < C - 230; y++) for (let x = C - 50; x < C + 50; x++) {
    const b = real.biomeAt(x, y), k = real.kindAt(x, y, b);
    if (!BIOMES[b].freeze || (k !== K.SOFT && k !== K.DENSE)) continue;
    plain++;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([u, v]) => isOre(real.kindAt(x + u, y + v, real.biomeAt(x + u, y + v))))) beside++;
  }
  console.log(JSON.stringify({ realGround: { plainRock: plain, besideOre: +(beside / plain).toFixed(2) } }));
  check(plain > 3000 && beside / plain > 0.25 && beside / plain < 0.5, `${(beside / plain * 100).toFixed(0)} in a hundred cells of the north's plain rock lie beside ore: not about a third`);
}

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: a cut that closes beside ore the world laid heals as ore, one cell and no more; beside none it closes with ice');
process.exit(fails.length ? 1 : 0);
