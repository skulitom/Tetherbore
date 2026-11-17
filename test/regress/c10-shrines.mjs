// The four shrines (js/world.js: SHRINES, SHRINE_R, `shrine`, `shrineAt`, `kindAt`), as the world of generation 2
// lays them, on worlds 1, 7 and 123456 (the world's part; what one pays is the game's):
//   - one on each diagonal, its heart 990 cells out each way (1,400 from the core), in that corner's deep seam;
//   - laid as written: its heart a relic, the stone three cells round it vault with ore in it (three cells in ten,
//     the plain ore and the rich by turns), soft rock two cells round that; `shrineAt` lists the hearts;
//   - kept clear of as a relic is: no pocket's cell within 40 cells and its radius of the heart, no site's heart
//     within 44, no slab within 40 and its radius;
//   - none in an older game's ground (generation 1), nor where the heart's piece is of generation 1, whatever the
//     pieces round it are.
// And what one pays (js/game.js: `payOf`, `haul`, SHRINE_LUMP, SHRINE_SPEC, SHRINE_PERK, CORNER_KINS), on world 7:
//   - a new game holds no shrine (`shrines` [0, 0, 0, 0]);
//   - the north-east's shrine hauled whole is a SHRINE! (never a relic: the relics held and the game won are as
//     they were), pays SHRINE_LUMP seconds of what cutting 1,400 out earns and SHRINE_SPEC specimens of each of its
//     parents (the north and the east), is held from then on and is saved so;
//   - every gem paid to a parent's direction is SHRINE_PERK times as many for each shrine held of that direction's
//     two corners (the north with both the north-east's and the north-west's, 1.21), and no other's;
//   - and its corner's own: hauled it pays SHRINE_GEMS of the north east's gems besides what its cells pay, and
//     held, every one of the north east's gems paid is SHRINE_OWN times as many, and no other corner's.
// The game's part fails on the game before shrines paid: the haul is a RELIC! and nothing is held. (And its corner's
// gems on the game before they were paid: none.)
//   node test/regress/c10-shrines.mjs
import { World, N, C, K, G, SHRINES, SHRINE_R, SEAMS, SLAB, CORNER_GEM } from '../../js/world.js';

const fails = [], check = (ok, what) => { if (!ok && fails.length < 16) fails.push(what); };
check(SHRINE_R === 1400 && JSON.stringify(SHRINES) === JSON.stringify([[990, -990], [990, 990], [-990, 990], [-990, -990]]), `the shrines lie at ${JSON.stringify(SHRINES)}`);
let ore = 0, vault = 0, laid = 0;
for (const seed of [1, 7, 123456]) {
  const w = new World(), old = new World(); w.reset(seed); old.reset(seed); old.genOf.fill(1);
  check(w.shrineAt.length === 4 && w.shrineAt.every((i, d) => i === (C + SHRINES[d][1]) * N + C + SHRINES[d][0]), `seed ${seed}: shrineAt is ${w.shrineAt}`);
  SHRINES.forEach(([sx, sy], d) => {
    const hx = C + sx, hy = C + sy, where = `seed ${seed} shrine ${d}`;
    check(w.shrine(d) && !old.shrine(d), `${where}: laid at generation 2 ${w.shrine(d)}, at 1 ${old.shrine(d)}`);
    check(w.biomeAt(hx, hy) === SEAMS[d][1], `${where}: its heart is in ground ${w.biomeAt(hx, hy)}, not the deep seam ${SEAMS[d][1]}`);
    for (let y = hy - 6; y <= hy + 6; y++) for (let x = hx - 6; x <= hx + 6; x++) {
      const edge = Math.max(Math.abs(x - hx), Math.abs(y - hy)), k = w.at(x, y), was = old.at(x, y);
      if (edge === 0) check(k === K.RELIC, `${where}: its heart is ${k}`);
      else if (edge <= 3) { if (k === K.VAULT) vault++; else if ((k === K.ORE_A && (x + y) % 2) || (k === K.ORE_B && !((x + y) % 2))) ore++; else check(false, `${where}: its stone at ${x - hx},${y - hy} is ${k}`); }
      else if (edge <= 5) check(k === K.SOFT, `${where}: its soft rock at ${x - hx},${y - hy} is ${k}`);
      if (edge <= 5) { laid++; check(was !== K.RELIC, `${where}: generation 1 lays a relic at ${x - hx},${y - hy}`); }
    }
    check(old.at(hx, hy) !== K.RELIC, `${where}: generation 1 lays a relic at its heart`);
    // Kept clear of.
    for (const Z of w.pocketsWithin(2400)) check(Math.hypot(Z.cx - hx, Z.cy - hy) >= 40 + Z.rho, `${where}: a pocket of radius ${Z.rho} lies ${Math.round(Math.hypot(Z.cx - hx, Z.cy - hy))} from it`);
    for (const S of w.sitesWithin(2400)) check(Math.hypot(S.cx - hx, S.cy - hy) >= 43, `${where}: a site lies ${Math.round(Math.hypot(S.cx - hx, S.cy - hy))} from it`);
    for (let ty = Math.floor((hy - 100 - C) / SLAB); ty <= Math.floor((hy + 100 - C) / SLAB); ty++) for (let tx = Math.floor((hx - 100 - C) / SLAB); tx <= Math.floor((hx + 100 - C) / SLAB); tx++) {
      const S = w.slabIn(tx, ty);
      if (S) check(Math.hypot(S.cx - hx, S.cy - hy) >= 40 + S.p, `${where}: a slab of radius ${S.p} lies ${Math.round(Math.hypot(S.cx - hx, S.cy - hy))} from it`);
    }
  });
}
check(ore > 30 && vault > 100, `the shrines' stone is ${vault} cells of vault and ${ore} of ore`);
// The heart's piece decides: of generation 1, the shrine is not laid, and its cells are what an older game's are.
// (Every heart lies in the middle of its piece, 30 to 34 cells in each way, so the whole shrine is in it.)
{
  const w = new World(), old = new World(); w.reset(7); old.reset(7); old.genOf.fill(1);
  SHRINES.forEach(([sx, sy], d) => {
    const hx = C + sx, hy = C + sy, home = ((hy >> 6) << 8) | (hx >> 6);
    check((hx & 63) >= 6 && (hx & 63) < 58 && (hy & 63) >= 6 && (hy & 63) < 58, `shrine ${d}: its heart lies ${hx & 63},${hy & 63} in its piece, not in the middle`);
    w.genOf.fill(2); w.genOf[home] = 1; w.forget();
    let other = 0;
    for (let y = hy - 5; y <= hy + 5; y++) for (let x = hx - 5; x <= hx + 5; x++) if (w.kindAt(x, y, w.biomeAt(x, y)) !== old.kindAt(x, y, old.biomeAt(x, y))) other++;
    check(!w.shrine(d) && other === 0, `shrine ${d}: with its heart's piece of generation 1, ${other} of its cells are not an older game's`);
  });
}

// What a shrine pays.
{
  const { makeGame, B } = await import('../harness.mjs');
  const { income, round2 } = await import('../../js/shop.js');
  const game = await makeGame(7, { tether: 8 }), w = game.world, S = game.S, kins = [B.FROST, B.LODE];
  check(JSON.stringify(S.shrines) === '[0,0,0,0]', `a new game holds the shrines ${JSON.stringify(S.shrines)}`);
  const [sx, sy] = SHRINES[0], cells = [];
  for (let y = C + sy - 5; y <= C + sy + 5; y++) for (let x = C + sx - 5; x <= C + sx + 5; x++) if (w.at(x, y) !== K.EMPTY) cells.push(y * N + x);
  const pay = game.payOf(cells), spec0 = S.spec.slice(), relics = S.relics.slice();
  check(pay.shrine === 0 && pay.relic === -1 && pay.lump >= round2(income(SHRINE_R) * 30), `the north-east's shrine is shrine ${pay.shrine}, relic ${pay.relic}, and pays a lump of ${pay.lump}`);
  check(pay.gems[G.NE] > 10000 && [G.SE, G.SW, G.NW].every(g => pay.gems[g] === 0), `the north-east's shrine pays the corners' gems ${pay.gems.slice(5)}`);
  game.haul(cells);
  check(game.hauled.title === 'SHRINE!', `the north-east's shrine hauled is called ${game.hauled.title}`);
  check(JSON.stringify(S.shrines) === '[1,0,0,0]' && JSON.stringify(S.relics) === JSON.stringify(relics) && !S.won, `after it the shrines held are ${JSON.stringify(S.shrines)}, the relics ${JSON.stringify(S.relics)}`);
  check(kins.every(k => S.spec[k] - spec0[k] >= 5) && [B.EMBER, B.MIRE].every(k => S.spec[k] === spec0[k]), `the shrine paid specimens ${S.spec.map((n, k) => n - spec0[k])}`);
  game.save();
  check(JSON.stringify(JSON.parse(localStorage.getItem('tetherbore-save-v3')).shrines) === '[1,0,0,0]', 'the shrine held is not saved');
  // The gems' share: ore paying each direction's gems, with no shrine held, with the north-east's, and with the
  // north-east's and the north-west's.
  const ore = [];
  for (let k = 1; k <= 4; k++) for (let n = 0; n < 40; n++) { const i = (C - 30 + k) * N + C + 20 + n; w.setK(i, K.ORE_B); w.setB(i, k); ore.push(i); }
  // (And the deep seams' rich ore, each paying its corner's gems.)
  for (let c = 0; c < 4; c++) for (let n = 0; n < 40; n++) { const i = (C - 20 + c) * N + C + 20 + n; w.setK(i, K.ORE_B); w.setB(i, SEAMS[c][1]); ore.push(i); }
  const gems = held => { S.shrines = held; return game.payOf(ore).gems; };
  const none = gems([0, 0, 0, 0]), ne = gems([1, 0, 0, 0]), both = gems([1, 0, 0, 1]);
  const near = (a, b, by) => Math.abs(a - b * by) <= 1;
  check(near(ne[B.FROST], none[B.FROST], 1.1) && near(ne[B.LODE], none[B.LODE], 1.1) && ne[B.EMBER] === none[B.EMBER] && ne[B.MIRE] === none[B.MIRE], `with the north-east's shrine the gems are ${ne}, with none ${none}`);
  check(near(both[B.FROST], none[B.FROST], 1.21) && near(both[B.MIRE], none[B.MIRE], 1.1) && near(both[B.LODE], none[B.LODE], 1.1) && both[B.EMBER] === none[B.EMBER], `with the north's two shrines the gems are ${both}, with none ${none}`);
  check(CORNER_GEM.every(g => none[g] > 0) && near(ne[G.NE], none[G.NE], 1.25) && [G.SE, G.SW, G.NW].every(g => ne[g] === none[g]), `with the north-east's shrine the corners' gems are ${ne.slice(5)}, with none ${none.slice(5)}`);
  check(near(both[G.NE], none[G.NE], 1.25) && near(both[G.NW], none[G.NW], 1.25) && both[G.SE] === none[G.SE] && both[G.SW] === none[G.SW], `with the north's two shrines the corners' gems are ${both.slice(5)}, with none ${none.slice(5)}`);
}

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : `ok: a shrine on each diagonal in its deep seam, ${laid} cells laid as written and kept clear of, and none in an older game's ground; one hauled pays, is held, and makes its parents' gems more and its corner's most`);
process.exit(fails.length ? 1 : 0);
