// Specimens (docs/CONTENT-PLAN.md S4; js/game.js: haul, S.spec, specLine; js/drawing.js: bannerSays, specNeed): one
// count for each direction, fed only by hauled cells of a pocket's mineral. Checked:
//   - a new game has the counts, and a game saved before there were any is given them on restore;
//   - a haul banks what `payOf` said: the row's specimens a cell, to the direction the pocket lies in (the pocket's
//     record says which; the row's own direction where the world has no record), kept to the fraction;
//   - never multiplied: not by how far out the cells lie, the size of the haul, the winch, or a chain;
//   - `hauled.spec` is how far the whole count rose, and a light haul says so where it lay, under what it paid,
//     with the specimen's icon in the direction's colour (and what it paid has the mineral beside it, not the
//     grit's icon); a haul that raises no whole count says nothing of specimens;
//   - a haul with a banner says it there: `bannerSays` has '+n' third, and nothing third without;
//   - the count comes out under the top bar for three seconds after any haul that adds to it, and is drawn there
//     with the specimen's icon; a haul with no mineral in it brings out nothing;
//   - nothing is bought with specimens yet: `specNeed` is 0 for every direction.
//   node test/regress/s4-specimens.mjs
import { makeGame, Game, world, C, N } from '../harness.mjs';
const { K, B, BIOMES, biome } = world;
const atlas = await import('../../js/atlas.js');

const fails = [], check = (ok, what) => { if (!ok && fails.length < 16) fails.push(what); };
const at = (x, y) => (C + y) * N + C + x;
const looks = { sheet: 'mire', floor: 'mire-floor', gloom: [1, 2, 3], mote: ['#ffffff', 'still'], map: [1, 2, 3], debris: ['#000000'] };
const GEM_COLOR = [null, '#bfe6ff', '#ffb060', '#b8f06a', '#d8b8ff'];

// ---- saved
{
  const game = await makeGame(7);
  check(JSON.stringify(game.S.spec) === '[0,0,0,0,0]', `a new game's specimens: ${JSON.stringify(game.S.spec)}`);
  game.S.spec[2] = 3.5; game.S.grit = 77;
  game.save();
  const again = new Game({ width: 0, height: 0, style: {}, getContext: () => game.ctx });
  check(await again.restore() && again.S.grit === 77 && JSON.stringify(again.S.spec) === '[0,0,3.5,0,0]', `specimens saved and read back: ${JSON.stringify(again.S.spec)}`);
  // A game saved before specimens were counted.
  const old = JSON.parse(localStorage.getItem('tetherbore-save-v3'));
  delete old.spec;
  localStorage.setItem('tetherbore-save-v3', JSON.stringify(old));
  const older = new Game({ width: 0, height: 0, style: {}, getContext: () => game.ctx });
  check(await older.restore() && older.S.grit === 77 && JSON.stringify(older.S.spec) === '[0,0,0,0,0]', `a game saved before specimens: ${JSON.stringify(older.S.spec)}`);
  localStorage.removeItem('tetherbore-save-v3');
}

// ---- banked
{
  const game = await makeGame(7, { winch: 3 }), w = game.world, S = game.S;
  const hive = BIOMES[32], P = hive.pocket;
  const lay = (x, y, kinds, b) => kinds.map((k, n) => { const i = at(x + n, y); w.setK(i, k); w.setB(i, b); return i; });
  w.zoneOf = () => null;                                                   // no record: the row's own direction
  // One cell of amber, in a light haul: a quarter of a specimen to the west, and no whole one yet.
  game.popups.length = 0;
  let cells = lay(-60, 10, [K.MINERAL, K.SOFT], 32), pay = game.payOf(cells);
  game.haul(cells);
  check(pay.spec[B.MIRE] === P.spec && S.spec[B.MIRE] === P.spec && S.spec.every((n, b) => b === B.MIRE || n === 0), `one cell of amber banked ${JSON.stringify(S.spec)}`);
  check(game.hauled.light && game.hauled.spec === 0 && game.hauled.specOf === B.MIRE && game.hauled.mineral === 'amber' && game.hauled.minerals === 1, `the haul of one cell of amber: ${JSON.stringify(game.hauled)}`);
  check(!game.popups.some(p => typeof p.icon === 'string' && p.icon.startsWith('spec-')), 'a haul that raised no whole count says something of specimens');
  check(game.popups.some(p => Array.isArray(p.icon) && p.icon[0] === 'minerals' && p.icon[1] === 'amber' && p.color === '#ffe14a') && !game.popups.some(p => p.icon === 'grit'), `what the amber paid is shown with ${JSON.stringify(game.popups.map(p => p.icon))}`);
  check(game.specLine && game.specLine.kin === B.MIRE && game.specLine.t === 0 && game.specLine.life === 3, `the count on show: ${JSON.stringify(game.specLine)}`);
  // A nugget's worth more: nine cells, two and a quarter, so the whole count rises by two.
  game.popups.length = 0;
  cells = lay(-60, 12, [K.MINERAL, K.MINERAL, K.MINERAL, K.MINERAL, K.MINERAL, K.MINERAL, K.MINERAL, K.MINERAL, K.MINERAL, K.NODE], 32);
  game.haul(cells);
  check(Math.abs(S.spec[B.MIRE] - 10 * P.spec) < 1e-9 && game.hauled.spec === 2 && game.hauled.light, `a nugget banked: ${JSON.stringify(S.spec)}, the whole count up ${game.hauled.spec}`);
  const said = game.popups.find(p => p.icon === 'spec-mire');
  check(said && said.label === '+2' && said.color === GEM_COLOR[B.MIRE], `a light haul that raised the count says ${JSON.stringify(game.popups.map(p => [p.label, p.color, p.icon]))}`);
  // The pocket's record says whose direction: the north's here, though a hive is the west's kind.
  w.zoneOf = (sx, sy) => ({ key: `z${sx},${sy}`, row: 32, cx: C - 60, cy: C + 14, rho: 9, kin: B.FROST });
  cells = lay(-60, 14, [K.MINERAL, K.MINERAL, K.MINERAL, K.MINERAL], 32);
  game.haul(cells);
  check(S.spec[B.FROST] === 4 * P.spec && Math.abs(S.spec[B.MIRE] - 10 * P.spec) < 1e-9 && game.hauled.spec === 1 && game.hauled.specOf === B.FROST && game.specLine.kin === B.FROST, `amber of a hive in the north banked ${JSON.stringify(S.spec)}; ${JSON.stringify(game.specLine)}`);
  // Never multiplied: far out, in a big haul (which has a banner), with a winch, hard on the heels of other hauls.
  const before = S.spec[B.FROST], big = [];
  for (let n = 0; n < 40; n++) big.push(...lay(-1500 + n, 300, [n < 8 ? K.MINERAL : K.SOFT], 32));
  check(game.chain && game.time - game.chain.t < 8, 'no chain is running for the big haul to follow');
  pay = game.payOf(big);
  game.haul(big);
  check(pay.mult > 1.5 && S.spec[B.FROST] === before + 8 * P.spec && game.hauled.spec === 2 && !game.hauled.light, `eight cells of amber in a haul of forty, far out, with a winch and in a chain, banked ${S.spec[B.FROST] - before} specimens (x${pay.mult.toFixed(2)})`);
  check(game.banner === game.hauled && JSON.stringify(game.bannerSays(game.banner)) === JSON.stringify([`40 x${pay.mult.toFixed(1)}`, null, '+2']), `its banner says ${JSON.stringify(game.bannerSays(game.banner))}`);
  // A haul with no mineral: nothing third, and no count brought out.
  game.specLine = null;
  const plain = [];
  for (let n = 0; n < 14; n++) plain.push(...lay(-80 + n, 20, [K.SOFT], B.MIRE));
  const kept = JSON.stringify(S.spec);
  game.haul(plain);
  check(game.bannerSays(game.banner)[2] === null && game.specLine === null && JSON.stringify(S.spec) === kept && game.hauled.spec === 0 && game.hauled.specOf === 0, `a haul with no mineral: ${JSON.stringify(game.bannerSays(game.banner))}, ${JSON.stringify(game.specLine)}`);
  // A pocket with a mineral of its own figure: 1.5 a cell, kept to the fraction and shown whole.
  const rich = biome({ id: 121, name: 'test-rich', kin: B.LODE, pocket: { mineral: 'zircon', lump: 1, spec: 1.5 }, ...looks });
  w.zoneOf = () => null;
  game.popups.length = 0;
  game.haul(lay(-60, 16, [K.MINERAL], rich.id));
  check(S.spec[B.LODE] === 1.5 && game.hauled.spec === 1 && game.hauled.mineral === null && game.popups.some(p => p.icon === 'spec-lode' && p.label === '+1') && game.popups.some(p => p.icon === 'grit'), `a mineral with no picture: ${JSON.stringify(S.spec)}, ${JSON.stringify(game.popups.map(p => [p.label, p.icon]))}`);
  game.haul(lay(-60, 18, [K.MINERAL], rich.id));
  check(S.spec[B.LODE] === 3 && game.hauled.spec === 2, `the second cell of it took the whole count from 1 to 3: said ${game.hauled.spec}`);
  // (What each direction's specimens buy next, and for how many: the first rows of the shop's second tab.)
  check([1, 2, 3, 4].map(kin => game.specNeed(kin)).join() === '8,12,12,12', `the next thing each direction's specimens buy asks ${[1, 2, 3, 4].map(kin => game.specNeed(kin))}`);
}

// ---- the count under the top bar: three seconds, drawn with the specimen's icon
{
  const game = await makeGame(7), w = game.world, icons = atlas.sheets.icons, r = icons.frames['spec-mire'];
  check(['frost', 'ember', 'mire', 'lode'].every(name => icons.frames[`spec-${name}`]), 'the icons sheet has no specimen for some direction');
  w.zoneOf = () => null;
  const cells = [at(-60, 10)]; w.setK(cells[0], K.MINERAL); w.setB(cells[0], 32);
  let drawn = 0;
  // (On its plate at the head of the screen, or under a place's plate where one stands there: js/drawing.js, drawHud.)
  const specY = () => 6 + (game.place && !game.place.card && !game.plateLow ? game.place.lay.h + 2 : 0);
  game.ctx.drawImage = (image, sx, sy, sw, sh, dx, dy) => { if (image === icons.image && sx === r[0] && sy === r[1] && dy === specY()) drawn++; };
  game.render();
  check(drawn === 0, 'the count of specimens is drawn with none banked');
  game.haul(cells);
  let shown = 0, frames = 0;
  for (let f = 0; f < 240; f++) { game.update(1 / 60); drawn = 0; game.render(); frames++; if (drawn === 1) shown++; else if (drawn > 1) shown = -999; }
  // (The haul stops the clock for a moment as it lands, so the three seconds are a little under 180 frames.)
  check(shown >= 170 && shown <= 181 && game.specLine === null, `the count was drawn under the top bar in ${shown} frames of ${frames}; left on show: ${JSON.stringify(game.specLine)}`);
}

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: specimens are counted for each direction, banked by the cell and never multiplied, said where a haul lay or on its banner, and shown under the top bar for three seconds');
process.exit(fails.length ? 1 : 0);
