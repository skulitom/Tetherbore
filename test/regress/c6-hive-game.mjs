// The amber hive in the game (docs/CONTENT-PLAN.md, content item 6, and the pocket's part of S1 and S5): how a
// pocket's mineral and its special cell are drawn, named and told, and what a pocket keeps out. On world 7's first
// hive in the west, as the seed laid it:
//   - amber is drawn from the 'minerals' sheet over its block of wax, and a stalk as the cord that runs level or
//     the one that stands upright, as it lies between its nugget and its wall; a mineral with no picture is not
//     drawn, and a stalk asked about with no cell is upright;
//   - amber sheds amber, a stalk and the wax shed wax; amber cut into says CRUSHED and is a sample for the lab (ANALYSED +1%), shatters and pays nothing, a
//     stalk cut says nothing, and the nugget whose stalk is cut is in the books as loose;
//   - coming into the hive names it, across the screen the first time and on a plate after, with the amber on
//     the plate; its amber is called out by name, in the hive's own colour;
//   - nothing grows back in a pocket: a spore pod's moss closes the open ground round it outside the hive and not
//     inside, and lava that has run into the hive goes out and leaves no basalt;
//   - a charge set off in a chamber opens wax and neither amber nor stalk, and what it shakes loose is in the
//     books: a nugget whose wall went with the charge hangs by nothing.
//   node test/regress/c6-hive-game.mjs
import { makeGame, world, C, N } from '../harness.mjs';
const { K, B, BIOMES, hiveChambers, rowOf, biome } = world;
const atlas = await import('../../js/atlas.js');

const fails = [], check = (ok, what) => { if (!ok && fails.length < 16) fails.push(what); };
const HIVE = BIOMES[32];
const stage = async (lv = {}) => {
  const game = await makeGame(7, { tether: 6, ...lv }), w = game.world;
  const Z = w.pocketsWithin(600).find(Z => Z.kin === B.MIRE && !Z.herald && Z.rho > 14);
  const nuggets = hiveChambers(Z).filter(([mx, my]) => w.k(my * N + mx) === K.MINERAL).map(([mx, my]) => {
    const side = [[1, 0], [0, 1], [-1, 0], [0, -1]].find(([u, v]) => w.k((my + 2 * v) * N + mx + 2 * u) === K.NODE);
    return { mx, my, side, near: (my + 2 * side[1]) * N + mx + 2 * side[0], far: (my + 3 * side[1]) * N + mx + 3 * side[0] };
  });
  return { game, w, Z, nuggets };
};
// Stands the drill in a cell with a tether straight to the core through whatever lies between (nothing here
// asks the tether to be sound).
const stand = (game, x, y) => { const d = game.drill; d.x = d.px = x + 0.5; d.y = d.py = y + 0.5; d.mode = 'free'; d.cell = -1; game.band = [[d.x, d.y], [C + 0.5, C + 0.5]]; };

// ---- 1. drawn
{
  const { game, w, nuggets } = await stage();
  const level = nuggets.find(n => n.side[1] === 0), upright = nuggets.find(n => n.side[0] === 0);
  check(level && upright, 'the hive has no stalk that runs level, or none that stands upright: pick another');
  check(JSON.stringify(game.overlay(K.MINERAL, HIVE, level.my * N + level.mx)) === '["minerals","amber"]', `amber is drawn from ${JSON.stringify(game.overlay(K.MINERAL, HIVE))}`);
  for (const i of [level.near, level.far]) check(JSON.stringify(game.overlay(K.NODE, HIVE, i)) === '["minerals","stalk-h"]', `a stalk that runs level is drawn from ${JSON.stringify(game.overlay(K.NODE, HIVE, i))}`);
  for (const i of [upright.near, upright.far]) check(JSON.stringify(game.overlay(K.NODE, HIVE, i)) === '["minerals","stalk-v"]', `a stalk that stands upright is drawn from ${JSON.stringify(game.overlay(K.NODE, HIVE, i))}`);
  check(JSON.stringify(game.overlay(K.NODE, HIVE)) === '["minerals","stalk-v"]', 'a stalk asked about with no cell is not upright');
  check(game.overlay(K.SOFT, HIVE, level.near - N) === null && game.rockSheet(K.MINERAL, 32) === 'wax' && game.rockSheet(K.NODE, 32) === 'wax' && game.rockSheet(K.SOFT, 32) === 'wax', 'wax, or the block under amber or a stalk, is not drawn from the wax sheet');
  // (A mineral that has no picture on the sheet, as a test's may not, is drawn as its rock alone.)
  const looks = { sheet: 'mire', floor: 'mire-floor', gloom: [1, 2, 3], mote: ['#ffffff', 'still'], map: [1, 2, 3], debris: ['#000000'] };
  const odd = biome({ id: 121, name: 'test-zircon', kin: B.MIRE, pocket: { mineral: 'zircon', node: 'thread', lump: 1, spec: 1 }, ...looks });
  check(game.overlay(K.MINERAL, odd) === null && game.overlay(K.NODE, odd) === null && game.mineralOf(odd) === null && game.mineralOf(HIVE) === 'amber' && game.mineralOf(BIOMES[3]) === null, 'a mineral or a node with no picture is drawn all the same');
  check(JSON.stringify(game.debris(K.MINERAL, 32)) === JSON.stringify(HIVE.pocket.chips) && JSON.stringify(game.debris(K.NODE, 32)) === JSON.stringify(HIVE.debris) && JSON.stringify(game.debris(K.SOFT, 32)) === JSON.stringify(HIVE.debris), `amber sheds ${game.debris(K.MINERAL, 32)}, a stalk ${game.debris(K.NODE, 32)}`);
  // On the screen: with a nugget in view, its nine cells of amber and its two of stalk are painted from the sheet.
  const minerals = atlas.sheets.minerals, drawn = { amber: 0, 'stalk-h': 0, 'stalk-v': 0 };
  stand(game, level.mx - 3 * level.side[0], level.my + 3);
  game.cam.x = (level.mx + 0.5) * 16; game.cam.y = (level.my + 0.5) * 16;
  w.see(level.mx, level.my, 6); game.version++;
  // (The ground's own picture is painted once into pieces of its own, and a piece is painted again only when what
  // it shows has changed: what was drawn there is counted by watching the calls on new pieces as they are made.)
  const watch = ctx => { ctx.drawImage = (image, sx, sy) => { if (image === minerals.image) for (const [name, r] of Object.entries(minerals.frames)) if (r[0] === sx && r[1] === sy && name in drawn) drawn[name]++; }; };
  const made = globalThis.document.createElement;
  globalThis.document.createElement = () => { const c = made(); const get = c.getContext; c.getContext = (...a) => { const ctx = get(...a); watch(ctx); return ctx; }; return c; };
  game.chunks.clear();
  game.render();
  globalThis.document.createElement = made;
  check(drawn.amber >= 9 && drawn['stalk-h'] >= 2, `with a nugget in view, ${drawn.amber} cells of amber and ${drawn['stalk-h']} of level stalk were painted`);
}

// ---- 2. cut into
{
  const { game, w, nuggets } = await stage(), S = game.S;
  const n = nuggets[0], amber = n.my * N + n.mx - 1, grit = S.grit;
  // The stalk's far cell: nothing is said, and the nugget hangs with the cell of stalk against it.
  stand(game, n.mx - 3 * n.side[0] + 3 * n.side[1], n.my - 3 * n.side[1] + 3 * n.side[0]);
  w.see(n.mx, n.my, 6);
  game.popups.length = 0;
  game.finishDig(n.far);
  check(!game.popups.some(p => p.label === 'CRUSHED' || p.label.startsWith('ANALYSED')), 'a stalk cut says CRUSHED, or is a sample of amber');
  const piece = game.pieceOf.get(n.my * N + n.mx);
  check(piece && piece.length === 10 && piece.includes(n.near) && piece.filter(i => w.k(i) === K.MINERAL).length === 9, `a stalk cut: the nugget is ${piece ? `a loose piece of ${piece.length} cells` : 'not in the books as loose'}`);
  // What that piece would pay is nine lumps and nine quarters of a specimen, and asking banks nothing.
  const pay = game.payOf(piece);
  check(pay.minerals === 9 && pay.mineral === 'amber' && Math.abs(pay.spec[B.MIRE] - 2.25) < 1e-9 && pay.lump > 0 && pay.grit >= pay.lump && S.grit === grit, `the loose nugget would pay ${JSON.stringify({ minerals: pay.minerals, mineral: pay.mineral, spec: pay.spec, lump: pay.lump })}`);
  // Amber cut into: crushed.
  game.popups.length = 0; game.effects.length = 0;
  game.finishDig(amber);
  check(w.k(amber) === K.EMPTY && game.popups.some(p => p.label === 'CRUSHED') && game.popups.some(p => p.label === 'ANALYSED +1%') && S.lab['minerals:amber'] === 1 && game.effects.some(e => e.sheet === 'shatter') && S.grit === grit && S.spec.every(n => n === 0), `amber cut into: ${JSON.stringify(game.popups.map(p => p.label))}, grit ${S.grit - grit}, specimens ${S.spec}`);
}

// ---- 3. named
{
  const { game, w, Z, nuggets } = await stage(), S = game.S, n = nuggets[0];
  // From the mire outside the hive (met already, so that it is not what is named), into the lane of a chamber.
  S.met[w.b((Z.cy) * N + Z.cx - 40)] = 1; S.met[3] = 1;
  stand(game, Z.cx - 40, Z.cy); game.placeKey = game.placeAt(game.di).key; game.place = null; game.called.clear(); S.marks.length = 0; w.spotted.length = 0;
  check(!S.visited[Z.key] && game.pocketPips().some(p => p.key === Z.key), 'the hive is visited before the drill has been in it, or the map does not mark it');
  stand(game, n.mx - 3 * n.side[0] + 3 * n.side[1], n.my - 3 * n.side[1] + 3 * n.side[0]);
  game.popups.length = 0;
  game.look();
  check(game.place && game.place.title === 'AMBER HIVE' && game.place.card === true && game.place.mineral === 'amber' && game.place.icon === 'mire' && game.placeKey === Z.key, `into the hive for the first time: ${JSON.stringify(game.place)}, key ${game.placeKey}`);
  check(S.met[32] === 1 && S.visited[Z.key] === 1 && !game.pocketPips().some(p => p.key === Z.key), 'the hive is not met, not visited, or still marked on the map');
  const call = game.popups.find(p => p.label === 'AMBER');
  check(call && call.color === 'rgb(255,182,50)' && S.marks.some(m => m[1] === K.MINERAL), `its amber is called out as ${JSON.stringify(game.popups.map(p => [p.label, p.color]))}, dots ${JSON.stringify(S.marks)}`);
  // Out and in again: the plate, with the amber on it.
  stand(game, Z.cx - 40, Z.cy); game.look();
  stand(game, n.mx - 3 * n.side[0] + 3 * n.side[1], n.my - 3 * n.side[1] + 3 * n.side[0]); game.look();
  check(game.place && game.place.title === 'AMBER HIVE' && game.place.card === false && game.place.mineral === 'amber', `into the hive a second time: ${JSON.stringify(game.place)}`);
  const minerals = atlas.sheets.minerals, r = minerals.frames.amber;
  let plate = 0;
  game.ctx.drawImage = (image, sx, sy, sw, sh, dx, dy) => { if (image === minerals.image && sx === r[0] + 2 && sy === r[1] + 2 && sw === 12 && dy === 5) plate++; };
  game.render();
  check(plate === 1, `the plate has the amber on it ${plate} times`);
}

// ---- 4. nothing grows back in a pocket
{
  const { game, w, Z } = await stage(), d = game.drill;
  stand(game, C, C); d.home = true;
  // A pod's cloud where the hive's outside wall meets open ground laid beside it: three cells of the hive opened,
  // and three of the mire outside.
  const y = Z.cy, edge = Z.cx - 16;
  let x = edge;
  while (w.b(y * N + x) !== 32) x++;
  for (let v = -1; v <= 1; v++) { for (const u of [-2, -1, 0]) { w.setK((y + v) * N + x + u, K.EMPTY); if (u < 0) w.setB((y + v) * N + x + u, B.MIRE); } }
  check(w.b(y * N + x) === 32 && w.b(y * N + x - 1) === B.MIRE, 'the staged cells are not the hive\'s edge');
  game.clouds.push({ x: x - 1, y, t: 0, life: 0.5, spread: true });
  // And lava in two open cells, one of each ground.
  w.lava.set((y + 5) * N + x, 0.3); w.setK((y + 5) * N + x, K.EMPTY);
  w.lava.set((y + 5) * N + x - 1, 0.3); w.setK((y + 5) * N + x - 1, K.EMPTY); w.setB((y + 5) * N + x - 1, B.MIRE);
  for (let f = 0; f < 60; f++) game.update(1 / 60);
  const inside = [-1, 0, 1].map(v => w.k((y + v) * N + x)), outside = [-1, 0, 1].map(v => w.k((y + v) * N + x - 1));
  check(inside.every(k => k === K.EMPTY) && outside.every(k => k === K.SOFT), `after a pod's cloud, the hive's open cells are ${inside} and the mire's beside them ${outside}`);
  check(w.k((y + 5) * N + x) === K.EMPTY && w.k((y + 5) * N + x - 1) === K.BASALT && !w.lava.size, `after lava, the hive's cell is ${w.k((y + 5) * N + x)} and the mire's ${w.k((y + 5) * N + x - 1)}`);
}

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: amber and its stalk are drawn, shed, named and crushed as a pocket\'s own, nothing grows back in the hive, and a charge leaves its nuggets hanging');
process.exit(fails.length ? 1 : 0);
