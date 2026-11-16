// The prism in play (docs/CONTENT-PLAN.md, content item 5): a clear crystal that multiplies the gems of whatever
// haul it rides in, by half as much again for each prism, to three (`payOf`, held by s2-pay-of). Here:
//   - a prism the world laid (seed 7, in firn north-west of the core) stands in its eight cells of plain ore; a loop
//     flown round the nine of them brings them home, the ore's gems half as much again;
//   - a haul with a prism in it is never a light haul, however small: its banner comes up and says what the prism
//     did ('PRISM x1.5'), and a haul with none says nothing of prisms;
//   - two prisms say x2, four say x2.5;
//   - a prism cut into is crushed, says so, and pays nothing;
//   - it is drawn from the finds sheet over its rock, afresh each frame, turning through its three frames, and it
//     sheds chips of glass in whatever ground it lies.
//   node test/regress/c5-prism.mjs
import { makeGame, tetherFaults, farStart, world, C, N } from '../harness.mjs';
import { flyTo, idle, fixRandom } from './lib/lasso.mjs';
const { K, B, GEMS } = world;
const atlas = await import('../../js/atlas.js');

fixRandom(5);
const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const at = (x, y) => (C + y) * N + C + x;

// ---- 1. The world's own prism, flown round.
{
  const PX = -223, PY = -353;
  const game = await makeGame(7, { tether: 7, drill: 4 }), w = game.world, S = game.S;
  const ring = [];
  for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) if (u || v) ring.push(at(PX + u, PY + v));
  check(w.k(at(PX, PY)) === K.PRISM && ring.every(i => w.k(i) === K.ORE_A), `the prism at ${PX},${PY} is ${w.k(at(PX, PY))} in ${ring.map(i => w.k(i))}`);
  const [what, fx, fy] = w.findSpot(Math.floor(PX / 48), Math.floor(PY / 48));
  check(what === 'prism' && fx === C + PX && fy === C + PY, `the world says the sector holds ${what} at ${fx - C},${fy - C}`);
  // A tunnel three cells wide from the core to four cells south of it, as the fuzz stages a start, which leaves the
  // nine standing where it runs past them.
  farStart(game, PX, PY + 4, i => Math.max(Math.abs((i % N) - C - PX), Math.abs(Math.floor(i / N) - C - PY)) <= 1);
  const nine = [at(PX, PY), ...ring], plain = game.payOf(ring), with1 = game.payOf(nine), kin = w.row(at(PX, PY)).kin;
  check(plain.gems[kin] === 8 * GEMS[K.ORE_A] && with1.gems[kin] === Math.round(plain.gems[kin] * 1.5) && with1.shine === 1.5, `the ring pays ${plain.gems[kin]} gems, and with its prism ${with1.gems[kin]}`);
  // Round it: a ring of cuts two cells out from the prism, east about, begun and ended at the tunnel's west side
  // (so that the ring's last cell to be cut is its south-west corner, and nothing but the nine is shut in).
  const gems = S.gems[kin], hauls = S.stats.hauls;
  let faults = 0;
  const each = f => { if (f % 6 === 0) faults += tetherFaults(game).length; };
  for (const [x, y] of [[PX - 1, PY + 3], [PX - 1, PY + 2], [PX + 2, PY + 2], [PX + 2, PY - 2], [PX - 2, PY - 2], [PX - 2, PY + 2], [PX - 1, PY + 2]]) { if (S.stats.hauls === hauls) flyTo(game, x, y, { frames: 900, each }); }
  idle(game, 0.3);
  const h = game.hauled;
  check(S.stats.hauls === hauls + 1 && nine.every(i => w.k(i) === K.EMPTY), `the prism and its ore were not hauled: ${S.stats.hauls - hauls} hauls, ${nine.filter(i => w.k(i) !== K.EMPTY).length} of the nine still stand`);
  check(h && h.n === 9 && h.shine === 1.5 && h.gems[kin] === with1.gems[kin] && S.gems[kin] === gems + with1.gems[kin], `the haul: ${JSON.stringify(h)}`);
  check(h && h.light === false && game.banner === h, 'a haul of nine with a prism in it was a light haul: no banner');
  check(h && game.bannerSays(h)[1] === 'PRISM x1.5', `the banner says ${h && JSON.stringify(game.bannerSays(h))}`);
  check(faults === 0, `${faults} faults in the tether on the way round`);
}

// ---- 2. Laid by hand: what the banner says, and a prism cut into.
{
  const game = await makeGame(7), w = game.world, S = game.S;
  const lay = (x, y, kinds) => kinds.map((k, n) => { const i = at(x + n, y); w.setK(i, k); w.setB(i, B.LODE); return i; });
  game.haul(lay(40, 20, [K.ORE_B, K.ORE_B, K.SOFT]));
  check(game.hauled.light && game.hauled.shine === 1 && game.bannerSays(game.hauled)[1] === null, `a haul with no prism: ${JSON.stringify(game.bannerSays(game.hauled))}`);
  game.haul(lay(40, 22, [K.ORE_B, K.PRISM]));
  check(!game.hauled.light && game.banner === game.hauled && game.bannerSays(game.banner)[1] === 'PRISM x1.5' && game.hauled.gems[B.LODE] === 8, `two cells, one a prism: ${JSON.stringify(game.hauled)}`);
  game.haul(lay(40, 24, [K.ORE_B, K.PRISM, K.PRISM]));
  check(game.bannerSays(game.banner)[1] === 'PRISM x2' && game.hauled.gems[B.LODE] === 10, `two prisms: ${JSON.stringify(game.hauled)}`);
  game.haul(lay(40, 26, [K.ORE_B, K.PRISM, K.PRISM, K.PRISM, K.PRISM]));
  check(game.bannerSays(game.banner)[1] === 'PRISM x2.5' && game.hauled.gems[B.LODE] === 13, `four prisms: ${JSON.stringify(game.hauled)}`);
  // Cut into: crushed.
  const [cell] = lay(40, 28, [K.PRISM]), grit = S.grit, lode = S.gems[B.LODE];
  game.popups.length = 0; game.effects.length = 0;
  game.finishDig(cell);
  check(w.k(cell) === K.EMPTY && game.popups.some(p => p.label === 'CRUSHED') && S.grit === grit && S.gems[B.LODE] === lode, `a prism cut into: ${JSON.stringify(game.popups.map(p => p.label))}`);
  check(game.effects.some(e => e.sheet === 'shatter'), 'a prism cut into does not shatter');
}

// ---- 3. Drawn, each frame, turning.
{
  const game = await makeGame(7), w = game.world, finds = atlas.sheets.finds;
  const frames = finds.animations.prism.frames, same = (r, f) => r[0] === f[0] && r[1] === f[1] && r[2] === f[2] && r[3] === f[3];
  check(frames.length === 3, `the prism turns through ${frames.length} frames`);
  for (const b of [B.CRUST, B.FROST, B.EMBER, 20, 130]) {
    const over = game.overlay(K.PRISM, world.rowOf(b));
    check(over && over[0] === 'finds' && over[1] === 'prism', `in ground ${b} a prism is drawn from ${JSON.stringify(over)}`);
    check(JSON.stringify(game.debris(K.PRISM, b)) === JSON.stringify(['#ffffff', '#bfe6ff', '#d8b8ff']), `in ground ${b} a prism sheds ${game.debris(K.PRISM, b)}`);
  }
  // One prism in view, in rock: every frame the screen is drawn it is drawn on the screen itself (not once, on
  // the ground's own picture), and over a second and a half it has shown all three of its frames.
  const cell = at(3, -4);
  w.setK(cell, K.PRISM); w.see(C, C, 12);
  const shown = new Set(), screen = [];
  game.ctx.drawImage = (image, sx, sy, sw, sh) => { if (image === finds.image) frames.forEach((f, n) => { if (same([sx, sy, sw, sh], f)) { shown.add(n); screen.push(n); } }); };
  let drawn = 0;
  for (let f = 0; f < 90; f++) { game.update(1 / 60); screen.length = 0; game.render(); if (screen.length === 1) drawn++; }
  check(drawn === 90, `the prism was drawn on the screen in ${drawn} frames of 90`);
  check(shown.size === 3, `over a second and a half the prism showed ${shown.size} of its three frames`);
}

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: a prism stands in its ore, rides home in a loop and multiplies the gems, its haul has a banner that says so, and it turns as it is drawn');
process.exit(fails.length ? 1 : 0);
