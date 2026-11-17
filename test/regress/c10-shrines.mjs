// The four shrines (js/world.js: SHRINES, SHRINE_R, `shrine`, `shrineAt`, `kindAt`), as the world of generation 2
// lays them, on worlds 1, 7 and 123456 (the world's part; what one pays is the game's):
//   - one on each diagonal, its heart 990 cells out each way (1,400 from the core), in that corner's deep seam;
//   - laid as written: its heart a relic, the stone three cells round it vault with ore in it (three cells in ten,
//     the plain ore and the rich by turns), soft rock two cells round that; `shrineAt` lists the hearts;
//   - kept clear of as a relic is: no pocket's cell within 40 cells and its radius of the heart, no site's heart
//     within 44, no slab within 40 and its radius;
//   - none in an older game's ground (generation 1), nor where the heart's piece is of generation 1, whatever the
//     pieces round it are.
//   node test/regress/c10-shrines.mjs
import { World, N, C, K, SHRINES, SHRINE_R, SEAMS, SLAB } from '../../js/world.js';

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

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : `ok: a shrine on each diagonal in its deep seam, ${laid} cells laid as written and kept clear of, and none in an older game's ground`);
process.exit(fails.length ? 1 : 0);
