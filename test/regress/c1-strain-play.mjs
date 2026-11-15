// What a strain changes in play (docs/CONTENT-PLAN.md, content item 1), in ground of the strains' own rows laid
// by hand round the core:
//   - a cut in firn stays open 45 seconds and one in serac closes after 15, where the north's own takes 30;
//   - loess is cut in half the time;
//   - a pocket of lava in forge pours further (7) than one in scoria or the south's own ground (5);
//   - a hauled cell pays by its row's `rich`: forge a quarter more than the south's own, loess 0.85 of the east's;
//   - rock is drawn from the strain's own sheet over its direction's floor, its ore from its direction's sheet,
//     and its chips and its colour on the map are its own;
//   - coming into one, the place is named by the strain's name.
//   node test/regress/c1-strain-play.mjs
import { makeGame, world } from '../harness.mjs';
import { arena, rect, at, idle, fixRandom, flyTo } from './lib/lasso.mjs';
const { K, B, BIOMES, digTime } = world;

fixRandom(5);
const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const FIRN = 17, SERAC = 18, SCORIA = 19, FORGE = 20, SPOREFALL = 22, LOESS = 24;

// The north above the core in three strips (firn, the north's own, serac); the south below (scoria, the south's
// own, forge); loess straight east and the east's own straight west.
const game = await makeGame(7), w = game.world, d = game.drill;
arena(game, 40, K.SOFT, B.LODE);
rect(game, 3, -3, 40, 3, K.SOFT, LOESS);
rect(game, -40, -40, -14, -8, K.SOFT, FIRN); rect(game, -13, -40, 13, -8, K.SOFT, B.FROST); rect(game, 14, -40, 40, -8, K.SOFT, SERAC);
rect(game, -40, 8, -14, 40, K.SOFT, SCORIA); rect(game, -13, 8, 13, 40, K.SOFT, B.EMBER); rect(game, 14, 8, 40, 40, K.SOFT, FORGE);
game.changed();

// Ice: one cell cut in each of the north's three, far from the drill and its tether.
const cuts = { firn: at(-25, -20), frost: at(0, -20), serac: at(25, -20) };
for (const i of Object.values(cuts)) game.finishDig(i);
const open = name => w.k(cuts[name]) === K.EMPTY, state = () => Object.keys(cuts).map(name => `${name} ${open(name) ? 'open' : 'closed'}`).join(', ');
idle(game, 14);
check(open('firn') && open('frost') && open('serac'), `after 14 seconds: ${state()}`);
idle(game, 2.5);
check(open('firn') && open('frost') && w.k(cuts.serac) === K.ICE, `after 16.5 seconds (serac closes at 15): ${state()}`);
idle(game, 12);
check(open('firn') && open('frost'), `after 28.5 seconds: ${state()}`);
idle(game, 3);
check(open('firn') && w.k(cuts.frost) === K.ICE, `after 31.5 seconds (the north's own closes at 30): ${state()}`);
idle(game, 12.5);
check(open('firn'), `after 44 seconds firn's cut has closed: it stays open 45`);
idle(game, 2.5);
check(w.k(cuts.firn) === K.ICE, `after 46.5 seconds firn's cut is ${w.k(cuts.firn)}, not ice`);

// Lava: a pocket in each of the south's three, woken by a cut beside it.
const pours = {};
for (const [name, x] of [['scoria', -25], ['ember', 0], ['forge', 25]]) {
  w.setK(at(x, 20), K.HAZARD);
  game.finishDig(at(x + 1, 20));
  pours[name] = game.lavaVol.get(at(x, 20));
}
check(pours.scoria === 5 && pours.ember === 5 && pours.forge === 7, `a pocket of lava pours ${JSON.stringify(pours)}: forge's should pour 7, the others 5`);

// Pay: the same cells, as forge and then as the south's own ground; as loess and then as the east's own.
const cells = (x0, y0, x1, y1) => { const list = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) list.push(at(x, y)); return list; };
const paid = (list, ground) => { const was = list.map(i => w.b(i)); for (const i of list) w.setB(i, ground); const grit = game.payOf(list).grit; list.forEach((i, n) => w.setB(i, was[n])); return grit; };
const south = cells(20, 30, 27, 34), east = cells(20, -2, 29, 2);
const pay = { forge: paid(south, FORGE), scoria: paid(south, SCORIA), ember: paid(south, B.EMBER), loess: paid(east, LOESS), lode: paid(east, B.LODE) };
check(pay.ember > 100 && Math.abs(pay.forge / pay.ember - 1.25) < 0.01 && Math.abs(pay.scoria / pay.ember - 0.95) < 0.01, `forty cells pay ${pay.forge} as forge, ${pay.scoria} as scoria and ${pay.ember} as the south's own: not 1.25 and 0.95 of it`);
check(pay.lode > 100 && Math.abs(pay.loess / pay.lode - 0.85) < 0.01, `fifty cells pay ${pay.loess} as loess and ${pay.lode} as the east's own: not 0.85 of it`);

// Sheets and colours.
for (const id of [FIRN, SERAC, SCORIA, FORGE, 21, SPOREFALL, 23, LOESS]) {
  const row = BIOMES[id], own = BIOMES[row.kin];
  check(game.rockSheet(K.SOFT, id) === row.name && game.rockSheet(K.DENSE, id) === row.name && game.rockSheet(K.SLATE, id) === 'slate' && game.rockSheet(K.ICE, id) === 'ice', `${row.name}: its rock is drawn from ${game.rockSheet(K.SOFT, id)}`);
  check(row.floor === own.floor && JSON.stringify(game.overlay(K.ORE_A, row)) === JSON.stringify([own.items, 'oreA']) && JSON.stringify(game.overlay(K.HAZARD, row)) === JSON.stringify(game.overlay(K.HAZARD, own)), `${row.name}: its floor, ore or hazard is not drawn as its direction's`);
  check(game.debris(K.SOFT, id) === row.debris && game.debris(K.SOFT, id) !== own.debris, `${row.name}: its chips are not its own colours`);
}

// Cutting: the drill pushed east from the core into loess.
for (let f = 0; f < 240 && d.dig < 0; f++) { game.input.auto = [1, 0, 1]; game.update(1 / 60); }
game.input.auto = null;
check(d.dig === at(3, 0) && d.digDur === digTime(K.SOFT, BIOMES[LOESS]) && d.digDur === 0.12, `a soft cell of loess takes ${d.digDur} s with the first bit, not 0.12 (cutting cell ${d.dig - at(0, 0)})`);

// The name: flying on into loess from the home ground's side, the place is LOESS, across the screen the first time.
rect(game, 3, 0, 8, 0, K.EMPTY); game.changed();
if (flyTo(game, 7, 0) < 0) check(false, 'the drill never reached the loess');
check(game.place?.title === 'LOESS' && game.place.card === true && game.S.met[LOESS], `the place named on coming into loess: ${JSON.stringify(game.place)}`);

console.log(JSON.stringify({ pours, pay }));
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: ice, cutting, lava, pay, sheets and the name all follow the strain\'s row');
process.exit(fails.length ? 1 : 0);
