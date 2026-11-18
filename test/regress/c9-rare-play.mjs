// The rare hazards in play (js/game.js: `trigger`, `rareHazards`, `toll`, `jet`, `swimWay`, `pullOf`, `payOf`; the
// world lays them, test c9-rare-laid). Each is staged by hand at the heart of its own site in its own direction's
// ground, as the world lays it (`SITE_SHAPES`), and woken by a cut beside it, as play wakes it:
//   - a rime bell: its fuse burns 1.2 s; then the whole ring of ice opens at once, told to the books of loose ground
//     by one call to `changed`, and the disc inside hangs loose; the ring closes with ice 7 to 8 s on; it does not
//     ring again for 4 s; a drill within 2.5 cells is knocked; cut into, it tolls at once, with the cut and the
//     knock, and the glow of that cut holds the ring;
//   - a fumarole: it rumbles 1.2 s, then fires out of the side that was cut at 1.2, 2.0 and 2.8 s, boring four
//     cells of rock each time, never more; the first jet turns its rind of slag to steel; lava beside the bore
//     wakes, another fumarole does not; a drill in the jet's way is knocked; it sleeps 10 s before it can be woken
//     again; cut into, it fires once at once, at the drill;
//   - a glowworm: it uncoils for 0.4 s, then swims a cell at a time through the rock, which moves behind it, and
//     never through open ground, never further than 10 cells from where it woke; with the drill near it flees, and
//     boxed in it thrashes where it is; it bites a drill that comes within 1.4 cells and darts away two cells;
//     its dot on the map goes with it; it coils up after 30 s; hauled awake it pays its lump twice over and says
//     CAUGHT; cut into, it bites;
//   - a lodestone: it hums for 0.6 s, then pulls its star of ore home a cell every 0.3 s, each pull shown a pull
//     ahead, into a ball beside it; ore pulled across the drill knocks it; then it settles, and does not wake again
//     for 4 s; cut into, it knocks;
// and in all of them: no cell opens that is not told to the books, every swap keeps the books sound (every piece
// cut off, one piece, no open cell in one), nothing a rare hazard opens is outside the tether's reach or in a
// pocket, a rare hazard asleep pays a cache's lump, a frame of every state is drawn, the map shows each in its own
// colour, and the panel has a line for each once it has been called out.
//   node test/regress/c9-rare-play.mjs
import { makeGame, world, C, N, income } from '../harness.mjs';
import { round2 } from '../../js/shop.js';
import { arena, rect, at, idle, fixRandom, isLoose } from './lib/lasso.mjs';
const { K, B, BIOMES, SITE_SHAPES, GEMS } = world;

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
// Every call of `changed`, with what it was told opened.
const spy = game => { const calls = [], changed = game.changed.bind(game); game.changed = (opened = [], closed = []) => { calls.push(opened.slice()); return changed(opened, closed); }; return calls; };
// The books of loose ground, as the play fuzz checks them: what is wrong, or nothing.
const books = game => {
  const w = game.world, wrong = [];
  let total = 0;
  for (const p of game.pieces) {
    const set = new Set(p);
    total += p.length;
    if (p.some(c => w.k(c) === K.EMPTY)) wrong.push('a piece holds open cells');
    if (p.some(c => [c + 1, c - 1, c + N, c - N].some(j => !set.has(j) && w.k(j) !== K.EMPTY))) wrong.push('a piece is not cut off');
    const seen = new Set([p[0]]), q = [p[0]];
    for (let h = 0; h < q.length; h++) for (const j of [q[h] + 1, q[h] - 1, q[h] + N, q[h] - N]) if (set.has(j) && !seen.has(j)) { seen.add(j); q.push(j); }
    if (q.length !== set.size) wrong.push('a piece is several pieces');
    if (p.some(c => game.pieceOf.get(c) !== p)) wrong.push('pieceOf does not say a cell is in its piece');
  }
  if (game.pieceOf.size !== total) wrong.push('pieceOf holds other cells');
  return wrong;
};
// A site staged at (hx, hy) from the core, in a square arena of its own direction's ground.
async function staged(type, hx, hy, lv = {}, hull = false) {
  fixRandom(9);
  const game = await makeGame(7, { tether: 3, drill: 4, ...lv }, { hull }), w = game.world, kin = world.HAZARDS[type].kin;
  arena(game, 30, K.SOFT, kin);
  for (let v = -6; v <= 6; v++) for (let u = -6; u <= 6; u++) { const i = at(hx + u, hy + v), k = SITE_SHAPES[type](u, v, i % N, Math.floor(i / N), 7); if (k >= 0) w.setK(i, k); }
  game.changed();
  return { game, w, heart: at(hx, hy), d: game.drill };
}
// The drill stood in an open cell (with the tether straight home), as a test stands it.
const stand = (game, x, y) => { const d = game.drill; game.world.setK(at(x, y), K.EMPTY); d.x = d.px = C + x + 0.5; d.y = d.py = C + y + 0.5; d.mode = 'free'; d.home = false; game.band = [[d.x, d.y], [C + 0.5, C + 0.5]]; game.changed(); };
const count = (w, cells, k) => cells.filter(i => w.k(i) === k).length;
const square = (hx, hy, r) => { const cells = []; for (let v = -r; v <= r; v++) for (let u = -r; u <= r; u++) cells.push(at(hx + u, hy + v)); return cells; };
// The world's lump for a cache, which a rare hazard pays asleep.
const lump = (x, y) => round2(income(Math.max(22, Math.hypot(x, y))) * 12);
const drawn = (game, what) => { try { game.render(); } catch (error) { fails.push(`drawing ${what} threw: ${error.message}`); } };

// ---- the rime bell
{
  const { game, w, heart } = await staged('bell', 16, 0), calls = spy(game), ring = game.ringOf(heart), disc = [];
  for (let v = -3; v <= 3; v++) for (let u = -3; u <= 3; u++) if (u * u + v * v <= 10) disc.push(at(16 + u, v));
  check(ring.length === 32 && ring.every(i => w.k(i) === K.ICE) && w.hazAt(heart) === 'bell', `the bell's site: ring of ${ring.length}, ${count(w, ring, K.ICE)} of it ice, heart ${w.hazAt(heart)}`);
  const asleep = game.payOf([heart]);
  check(asleep.lump === lump(16, 0) && asleep.gems[B.FROST] === GEMS[K.RARE] * BIOMES[B.FROST].gemx && asleep.rares === 1 && asleep.caught === 0, `a bell asleep pays ${JSON.stringify(asleep)}`);
  game.finishDig(at(16, 1));                                                    // the cut beside it
  check(game.bells.has(heart) && ring.every(i => w.k(i) !== K.EMPTY), 'a cut beside the bell did not light its fuse, or the ring went at once');
  drawn(game, 'a bell whose fuse burns');
  idle(game, 1.1);
  check(count(w, ring, K.EMPTY) === 0, `the ring opened before the fuse burnt down: ${count(w, ring, K.EMPTY)} cells`);
  calls.length = 0;
  idle(game, 0.15);
  const told = calls.filter(c => c.length);
  check(ring.every(i => w.k(i) === K.EMPTY) && told.length === 1 && ring.every(i => told[0].includes(i)), `the toll: ${count(w, ring, K.EMPTY)} of 32 ring cells open, told in ${told.length} calls of ${told.map(c => c.length)}`);
  const left = disc.filter(i => w.k(i) !== K.EMPTY);
  check(isLoose(game, left) && game.pieceOf.get(heart)?.length === left.length, `after the toll the disc is ${isLoose(game, left) ? 'loose' : 'held'} and the books hold ${game.pieceOf.get(heart)?.length} of its ${left.length} cells`);
  check(game.dents === 0 && game.knocks === 0, 'the toll knocked a drill fourteen cells off');
  drawn(game, 'a bell that has tolled');
  // Not again for 4 s.
  game.trigger(heart, 'bell', false);
  check(game.bells.get(heart)?.cool > 0 && game.bells.get(heart).t >= 1.2, 'a bell that had just tolled was lit again');
  idle(game, 4.1);
  check(!game.bells.has(heart), 'four seconds after its toll the bell is still not to be rung');
  idle(game, 2.6);
  check(count(w, ring, K.EMPTY) === 32, `6.8 s after the toll ${32 - count(w, ring, K.EMPTY)} ring cells have closed`);
  idle(game, 1.8);
  check(count(w, ring, K.EMPTY) === 0 && count(w, ring, K.ICE) + count(w, ring, K.ORE_A) === 32, `8.6 s after the toll ${count(w, ring, K.EMPTY)} ring cells are open still`);
  check(!books(game).length, `the books after the bell: ${books(game).join('; ')}`);
  // Rung again, cut into: it tolls with the cut, knocks, and the glow of the cut held the ring.
  const near = await staged('bell', 16, 0, {}, true), g = near.game, nw = near.w, ncalls = spy(g);
  rect(g, 3, 0, 15, 0, K.EMPTY); stand(g, 15, 0);
  g.drill.dig = near.heart; g.foresee(near.heart);
  const glow = new Set(g.preview.flatMap(p => p.cells)), nring = g.ringOf(near.heart).filter(i => nw.k(i) !== K.EMPTY);
  check(nring.every(i => glow.has(i)), `the glow of a cut into a bell holds ${nring.filter(i => glow.has(i)).length} of its ${nring.length} ring cells`);
  ncalls.length = 0;
  g.finishDig(near.heart);
  check(nw.k(near.heart) === K.EMPTY && nring.every(i => nw.k(i) === K.EMPTY) && ncalls.length === 1 && nring.every(i => ncalls[0].includes(i)), `cut into, the bell opened ${nring.filter(i => nw.k(i) === K.EMPTY).length} of ${nring.length} ring cells, told in ${ncalls.length} calls`);
  check(g.dents === 1 && g.drill.stun > 0.4, `cut into, the bell left ${g.dents} dents and a stun of ${g.drill.stun}`);
  drawn(g, 'a bell cut into');
}

// ---- the fumarole
{
  const { game, w, heart } = await staged('vent', 16, 0), calls = spy(game), up = n => at(16, -n);
  w.setK(at(17, -7), K.HAZARD);                                                    // lava beside the second bore
  w.setK(at(15, -5), K.RARE);                                                      // and another fumarole beside the first
  const rind = square(16, 0, 1).filter(i => i !== heart);
  check(rind.every(i => w.k(i) === K.SLAG) && w.hazAt(heart) === 'vent', `the fumarole's rind: ${count(w, rind, K.SLAG)} of 8 cells slag`);
  check(game.payOf([heart]).lump === lump(16, 0) && game.payOf([heart]).gems[B.EMBER] === GEMS[K.RARE], `a fumarole asleep pays ${JSON.stringify(game.payOf([heart]))}`);
  game.finishDig(up(1));                                                        // the north side cut: it fires north
  check(game.vents.get(heart)?.way === 3, `cut on its north side, the fumarole will fire ${game.vents.get(heart)?.way}`);
  drawn(game, 'a fumarole rumbling');
  idle(game, 1.1);
  check([2, 3, 4, 5].every(n => w.k(up(n)) !== K.EMPTY), 'the fumarole fired before 1.2 s');
  calls.length = 0;
  idle(game, 0.15);
  const bored = n => Array.from({ length: n }, (_, k) => up(k + 2));
  check(bored(4).every(i => w.k(i) === K.EMPTY) && w.k(up(6)) !== K.EMPTY && calls.filter(c => c.length).length === 1, `the first jet bored ${bored(14).filter(i => w.k(i) === K.EMPTY).length} cells, told in ${calls.filter(c => c.length).length} calls`);
  check(count(w, rind, K.STEEL) === 7, `the first jet turned ${count(w, rind, K.STEEL)} of the 7 cells of slag left round the heart to steel`);
  check(game.vents.size === 1 && w.k(at(15, -5)) === K.RARE, 'a jet woke the other fumarole beside it');
  drawn(game, 'a fumarole firing');
  idle(game, 0.8);
  check(bored(8).every(i => w.k(i) === K.EMPTY) && w.k(up(10)) !== K.EMPTY && w.lava.has(at(17, -7)), `the second jet: ${bored(14).filter(i => w.k(i) === K.EMPTY).length} cells bored; the lava beside it is ${w.lava.has(at(17, -7)) ? 'woken' : 'asleep'}`);
  idle(game, 0.8);
  // (The lava woken beside the second bore pours into it.)
  check(bored(12).every(i => w.k(i) === K.EMPTY) && w.k(up(14)) !== K.EMPTY && w.k(up(16)) !== K.EMPTY && game.vents.get(heart)?.cool > 9, `the third jet: ${bored(14).filter(i => w.k(i) === K.EMPTY).length} cells bored in all, cool ${game.vents.get(heart)?.cool}`);
  check(game.knocks === 0 && !books(game).length, `a fumarole firing away from the drill: ${game.knocks} knocks; books: ${books(game).join('; ')}`);
  idle(game, 5);
  game.trigger(heart, 'vent', false);
  check(game.vents.get(heart)?.cool > 0, 'a fumarole woke again five seconds after it had done');
  idle(game, 5.2);
  check(!game.vents.has(heart), 'ten seconds after it had done the fumarole is still not to be woken');
  // A drill in its way is knocked; cut into, it fires at once, at the drill.
  const way = await staged('vent', 16, 0, {}, true), g = way.game;
  rect(g, 16, -9, 16, -1, K.EMPTY); stand(g, 16, -3);
  g.trigger(way.heart, 'vent', false);
  idle(g, 1.25);
  check(g.dents === 1, `a drill in a fumarole's way, three cells off, has ${g.dents} dents after the first jet`);
  const cut = await staged('vent', 16, 0, {}, true), c = cut.game, cw = cut.w;
  rect(c, 3, 0, 15, 0, K.EMPTY); stand(c, 15, 0);
  c.drill.dig = cut.heart; c.finishDig(cut.heart);
  check(c.dents === 1 && cw.k(cut.heart) === K.EMPTY && c.vents.size === 0 && c.jets.length === 1, `cut into, the fumarole left ${c.dents} dents and ${c.jets.length} jets`);
  drawn(c, 'a fumarole cut into');
}

// ---- the glowworm
{
  const { game, w, heart } = await staged('worm', 14, 0), d = game.drill, area = square(14, 0, 14);
  const where = () => area.find(i => w.k(i) === K.RARE), open0 = count(w, area, K.EMPTY);
  game.S.marks.push([heart, K.RARE, '#c8ff5a']);
  const asleep = game.payOf([heart]);
  check(asleep.lump === lump(14, 0) && asleep.gems[B.MIRE] === GEMS[K.RARE] && asleep.caught === 0, `a glowworm asleep pays ${JSON.stringify(asleep)}`);
  game.finishDig(at(14, 1));
  check(game.worms.has(heart), 'a cut beside the glowworm did not wake it');
  drawn(game, 'a glowworm uncoiling');
  idle(game, 0.35);
  check(where() === heart, 'the glowworm swam before it had uncoiled');
  const path = [heart], problems = new Set();
  idle(game, 20, () => {
    const now = where();
    if (now !== path[path.length - 1]) path.push(now);
    if (count(w, area, K.EMPTY) !== open0 + 1) problems.add('the ground opened or closed as it swam');
    for (const b of books(game)) problems.add(b);
  });
  const nest = Math.max(...path.map(i => Math.hypot(i % N - 14 - C, Math.floor(i / N) - C)));
  check(path.length >= 15 && path.length <= 22 && path.every((i, n) => !n || [1, -1, N, -N].includes(i - path[n - 1])), `in 20 s awake the glowworm swam ${path.length - 1} cells, a cell at a time`);
  check(nest <= 10 && !problems.size, `the glowworm swam ${nest.toFixed(1)} cells from where it woke; ${[...problems].join('; ')}`);
  check(game.S.marks.some(m => m[0] === where() && m[1] === K.RARE) && !game.S.marks.some(m => m[0] === heart && where() !== heart), `the glowworm's dot is at ${JSON.stringify(game.S.marks)}, the glowworm at ${where()}`);
  drawn(game, 'a glowworm swimming');
  idle(game, 10.5);
  const coiled = where();
  check(game.worms.size === 0 && w.hazAt(coiled) === 'worm', `after 30 s the glowworm ${game.worms.size ? 'swims on' : 'lies coiled'}`);
  // Fenced in: it thrashes where it is. Near: it flees. Within reach of a bite: it bites, and darts.
  const box = await staged('worm', 14, 0), bw = box.w;
  rect(box.game, 12, -2, 16, -2, K.EMPTY); rect(box.game, 12, 2, 16, 2, K.EMPTY); rect(box.game, 12, -2, 12, 2, K.EMPTY); rect(box.game, 16, -2, 16, 2, K.EMPTY); box.game.changed();
  box.game.trigger(box.heart, 'worm', false);
  const inside = square(14, 0, 1), boxPath = new Set();
  idle(box.game, 8, () => boxPath.add(inside.find(i => bw.k(i) === K.RARE)));
  check(!boxPath.has(undefined) && boxPath.size > 1 && box.game.worms.size === 1, `fenced in, the glowworm was at ${[...boxPath].map(i => i === undefined ? 'out' : 'in')}`);
  const pin = await staged('worm', 14, 0), pw = pin.w;
  for (const s of [1, -1, N, -N]) pw.setK(pin.heart + s, K.EMPTY);
  pin.game.changed(); pin.game.trigger(pin.heart, 'worm', false);
  idle(pin.game, 1);
  check(pw.k(pin.heart) === K.RARE && pin.game.worms.get(pin.heart)?.stuck, 'with nowhere to go the glowworm does not thrash where it is');
  drawn(pin.game, 'a glowworm thrashing');
  const flee = await staged('worm', 14, 0, {}, true), f = flee.game, fw = flee.w, farea = square(14, 0, 12);
  rect(f, 3, 0, 9, 0, K.EMPTY); stand(f, 9, 0);
  f.trigger(flee.heart, 'worm', false);
  const gapTo = () => { const i = farea.find(c => fw.k(c) === K.RARE); return Math.hypot(i % N + 0.5 - f.drill.x, Math.floor(i / N) + 0.5 - f.drill.y); };
  const before = gapTo();
  idle(f, 3);
  check(gapTo() > before + 1.5 && f.dents === 0, `with the drill near, the glowworm went from ${before.toFixed(1)} to ${gapTo().toFixed(1)} cells off it`);
  const bite = await staged('worm', 14, 0, {}, true), bg = bite.game, bwd = bite.w;
  rect(bg, 3, 0, 13, 0, K.EMPTY); stand(bg, 10, 0);
  bg.trigger(bite.heart, 'worm', false);
  const m = bg.worms.get(bite.heart);
  bg.drill.x = C + 13.3;                                                         // the drill comes up to it
  idle(bg, 1 / 60);
  check(bg.dents === 1 && m.steps === 2 && bwd.k(bite.heart) !== K.RARE, `a drill that came within a cell and a half: ${bg.dents} dents, the glowworm darted ${m.steps} cells`);
  // Caught awake: twice the lump, and it says so; cut into, it bites.
  const catchIt = await staged('worm', 14, 0), cg = catchIt.game, cw = catchIt.w, block = square(14, 0, 2);
  rect(cg, 11, -3, 17, -3, K.EMPTY); rect(cg, 11, 3, 17, 3, K.EMPTY); rect(cg, 11, -3, 11, 3, K.EMPTY); rect(cg, 17, -3, 17, 3, K.EMPTY); cg.changed();
  cg.trigger(catchIt.heart, 'worm', false);
  // (Woken by the very cut that frees it, it is still in its coil: caught asleep, at one lump.)
  const woke = cg.payOf(block);
  check(woke.caught === 0 && woke.lump === lump(14, 0), `a glowworm hauled the moment it woke pays ${JSON.stringify({ caught: woke.caught, lump: woke.lump })}, as if caught alive`);
  idle(cg, 1.5);
  const swum = block.find(i => cw.k(i) === K.RARE), pay = cg.payOf(block), grit = cg.S.grit;
  check(swum !== undefined && cg.worms.has(swum) && pay.caught === 1 && pay.lump === 2 * lump(14, 0), `a glowworm awake in a loose block pays ${JSON.stringify({ caught: pay.caught, lump: pay.lump })}, asleep ${lump(14, 0)}`);
  cg.haul(block); cg.changed(block); cg.updateHazards(1 / 60);
  check(cg.S.grit - grit === pay.grit && cg.popups.some(p => p.label === 'CAUGHT') && cg.worms.size === 0, `caught: paid ${cg.S.grit - grit} of ${pay.grit}, popups ${cg.popups.map(p => p.label)}`);
  drawn(cg, 'a glowworm caught');
  const into = await staged('worm', 14, 0, {}, true), ig = into.game;
  rect(ig, 3, 0, 13, 0, K.EMPTY); stand(ig, 13, 0);
  ig.drill.dig = into.heart; ig.finishDig(into.heart);
  check(ig.dents === 1 && into.w.k(into.heart) === K.EMPTY && ig.worms.size === 0, `cut into, the glowworm left ${ig.dents} dents`);
}

// ---- the lodestone
{
  const { game, w, heart } = await staged('lodestone', 14, 0), star = square(14, 0, 6), ore = i => w.k(i) === K.ORE_A || w.k(i) === K.ORE_B;
  const within = r2 => star.filter(i => ore(i) && (i % N - 14 - C) ** 2 + (Math.floor(i / N) - C) ** 2 <= r2).length, all = star.filter(ore).length, open0 = count(w, star, K.EMPTY);
  const near0 = within(9);
  check(all === 32 && near0 === 12 && w.hazAt(heart) === 'lodestone', `the lodestone's star holds ${all} cells of ore, ${near0} within 3 cells`);
  check(game.payOf([heart]).lump === lump(14, 0) && game.payOf([heart]).gems[B.LODE] === GEMS[K.RARE], `a lodestone asleep pays ${JSON.stringify(game.payOf([heart]))}`);
  game.finishDig(at(13, 0));
  const s = game.stones.get(heart);
  check(!!s, 'a cut beside the lodestone did not wake it');
  drawn(game, 'a lodestone humming');
  idle(game, 0.55);
  check(s.n === 0 && star.filter(ore).every(i => SITE_SHAPES.lodestone(i % N - C - 14, Math.floor(i / N) - C, 0, 0, 7) >= 0), 'the lodestone pulled before it had hummed');
  idle(game, 0.1);
  check(s.n === 0 && s.next && ore(s.next.from) && !ore(s.next.to), `the first pull is not shown before it is made: ${JSON.stringify(s.next)}`);
  const first = s.next.from;
  drawn(game, 'a lodestone about to pull');
  const problems = new Set(), pulls = [];
  idle(game, 0.3, () => { if (game.flying.length) drawn(game, 'ore flying'); });
  check(!ore(first) && ore(s.clump[s.clump.length - 1]) && s.n === 1, `0.95 s on the lodestone has pulled ${s.n} cells; the one shown first is ${ore(first) ? 'still there' : 'gone'}`);
  for (let f = 0; f < 60 * 12 && !(s.cool > 0); f++) idle(game, 1 / 60, () => {
    if (pulls[pulls.length - 1] !== s.n) pulls.push(s.n);
    if (count(w, star, K.EMPTY) !== open0 + 1 || star.filter(ore).length !== all) problems.add('ground opened, closed or was lost as it pulled');
    for (const b of books(game)) problems.add(b);
  });
  check(s.cool > 0 && s.n >= 16 && s.n <= 24 && within(9) >= near0 + 10 && !problems.size, `the lodestone pulled ${s.n} cells and ${s.cool > 0 ? 'settled' : 'did not settle'}; ${within(9)} of its ore lies within 3 cells of it; ${[...problems].join('; ')}`);
  drawn(game, 'a lodestone settled');
  game.trigger(heart, 'lodestone', false);
  check(game.stones.get(heart) === s && s.cool > 0, 'a lodestone that had just settled woke again at once');
  idle(game, 4.1);
  check(!game.stones.has(heart), 'four seconds after it settled the lodestone is still not to be woken');
  // Ore pulled across the drill knocks it; cut into, it knocks.
  const lone = await staged('lodestone', 14, 0, {}, true), g = lone.game, lw = lone.w;
  rect(g, 8, -6, 20, 6, K.SOFT); lw.setK(lone.heart, K.RARE); lw.setK(at(14, -4), K.ORE_B);
  rect(g, 14, -3, 14, -2, K.EMPTY); stand(g, 14, -2);
  g.finishDig(at(13, 0));
  idle(g, 0.95);
  check(g.dents === 1 && lw.k(at(14, -4)) === K.SOFT && g.stones.get(lone.heart)?.n === 1, `ore pulled across the drill: ${g.dents} dents, ${g.stones.get(lone.heart)?.n} pulls`);
  idle(g, 0.4);
  check(g.stones.get(lone.heart)?.cool > 0, 'a lodestone with nothing more to pull did not settle');
  const cut = await staged('lodestone', 14, 0, {}, true), c = cut.game;
  rect(c, 3, 0, 13, 0, K.EMPTY); stand(c, 13, 0);
  c.drill.dig = cut.heart; c.finishDig(cut.heart);
  check(c.dents === 1 && cut.w.k(cut.heart) === K.EMPTY && c.stones.size === 0, `cut into, the lodestone left ${c.dents} dents`);
}

// ---- the four on the map, and on the panel once met
{
  const game = await makeGame(7, { tether: 3, maplens: 2, maprange: 0 }), w = game.world, d = game.drill;
  arena(game, 30, K.SOFT, B.CRUST);
  // (Where the map, a cell and a half to its pixel, has a pixel for the cell.)
  const hearts = { bell: [5, -5, B.FROST, [170, 236, 255]], vent: [5, 5, B.EMBER, [255, 150, 40]], worm: [-5, 4, B.MIRE, [190, 255, 90]], lodestone: [7, -4, B.LODE, [176, 128, 255]] };
  for (const [x, y, b] of Object.values(hearts)) { w.setK(at(x, y), K.RARE); w.setB(at(x, y), b); }
  const plain = game.stats().length;
  check(!game.stats().some(([name]) => ['BELLS', 'JETS', 'WORMS', 'LODESTONES'].includes(name)), 'the panel tells of rare hazards not yet met');
  w.spotted.length = 0;
  for (const [x, y] of Object.values(hearts)) { w.setK(at(x, y + 1), K.SOFT); w.chunks[((C + y) >> 6 << 8) | ((C + x) >> 6)].seen[(((C + y) & 63) << 6) | ((C + x) & 63)] = 0; w.see(C + x, C + y, 0); }
  game.update(1 / 60);
  // (One met has a line of its own, by its name; two or more met are said on one line, RARES, with what they do.)
  check(['bell', 'vent', 'worm', 'lodestone'].every(t => game.S.rare[t] === 1) && game.stats().length === plain + 1, `called out, the rare hazards met are ${JSON.stringify(game.S.rare)} and the panel has ${game.stats().length - plain} lines more`);
  const says = rare => { const was = game.S.rare; game.S.rare = rare; const said = Object.fromEntries(game.stats().map(([name, value]) => [name, value])); game.S.rare = was; return said; };
  const all = says(game.S.rare), one = says({ worm: 1 }), knocks = says({ bell: 1, lodestone: 1 });
  check(all.RARES === 'KNOCK/BITE' && one.WORMS === 'BITE' && !one.RARES && knocks.RARES === 'KNOCK' && !knocks.BELLS, `the panel says ${JSON.stringify([all.RARES, one.WORMS, knocks.RARES])}`);
  game.resize(360, 640, 1); game.openLab(true, 'stats'); drawn(game, 'the panel'); game.openLab(false);
  // (Its lines, in as many columns as the panel's frame has, from the header's foot to a row over the frame's own.)
  { game.labRise = 1; const g = game.labGeom(), n = game.stats().length, pitch = game.statsPitch(n); check(20 + Math.ceil(n / g.cols) * pitch + 6 <= g.ph && g.py + g.ph <= game.H - 48 && pitch >= 10, `${n} lines of the panel ${pitch} apart do not fit its frame, ${g.ph} tall at y ${g.py}`); }
  game.mapFor = null; game.drawMap(0, 0);
  // (The pixel of the map that shows each heart, asked as the map asks it.)
  const per = game.val('maprange'), size = 46, px = game.mapData.data, mx0 = Math.floor(d.x) + 0.5, my0 = Math.floor(d.y) + 0.5;
  for (const [type, [x, y, , rgb]] of Object.entries(hearts)) {
    let o = -1;
    for (let v = 0; v < size; v++) for (let u = 0; u < size; u++) if (Math.floor(mx0 + (u - size / 2 + 0.5) * per) === C + x && Math.floor(my0 + (v - size / 2 + 0.5) * per) === C + y) o = (v * size + u) * 4;
    check(o >= 0 && [8, 7, 10].every((add, n) => px[o + n] === Math.min(255, rgb[n] + add)), `the map shows a ${type} as ${px[o]},${px[o + 1]},${px[o + 2]}`);
  }
}

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: a rime bell tolls its ring open and it freezes shut, a fumarole fires three jets out of the side cut, a glowworm swims and bites and is caught for twice its lump, a lodestone gathers its ore; each knocks, pays and is drawn as it should, and the books stay sound');
process.exit(fails.length ? 1 : 0);
