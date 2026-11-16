// Keystone slabs played with no hand on them (docs/CONTENT-PLAN.md, content item 5; the pilot is
// tools/slab-play.mjs: it flies to the crack by the quickest way, cutting as it must, then one lap of the crack
// through each key).
//   - The first slab of a new game, on three worlds: from the core, with the reach that goes round it (72) and what
//     a player holds by then, the drill comes to the crack, cuts through both keys on its lap, and the whole slab
//     comes home in one haul with a banner, nothing of it left standing and the tether sound all the way.
//   - The cut that parts the last key puts the whole slab in the books in that frame, and its glow, the frame
//     before, held the whole slab. That frame is not a slow one, counted in work as `World` counts it and never
//     in time: no more outline is walked than a slab's crack has sides, no cell is followed but the slab's own,
//     and none of the world is made. Nor does any other frame of the play do more than a cut may.
//   - A slab is the haul the winch is for: one of 400 cells hauled with no winch bought is over its load, is paid
//     less for it and says so on its banner; with one level of winch it is paid in full and says nothing.
//   - A slab with three keys comes home whole when the lap has cut through all three.
//   - A cobble field: a lap of its joints round one block, and round a square of four, cuts every key that holds
//     them (each lies in a joint the lap flies) and brings them home, in three fields.
//   node test/regress/c5-slab-play.mjs
import { haulBonus, overload } from '../../js/game.js';
import { play, field } from '../../tools/slab-play.mjs';

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); }, out = {};

// What every slab played must come to: `keys` is how many keys it has.
function whole(name, r, keys) {
  const h = r.hauled, L = r.loose;
  check(r.reached, `${name}: the drill never came to the crack`);
  if (!r.reached) return false;
  check(h && r.left === 0 && h.n >= r.inside, `${name}: ${h ? `${h.n} cells hauled` : 'nothing hauled'} of the slab's ${r.inside}, ${r.left} left standing`);
  if (!h || !L) return false;
  check(!h.light && h.banner, `${name}: the haul of ${h.n} had no banner`);
  check(r.slab.ux.length === keys && r.keys >= keys, `${name}: ${r.keys} cells of key cut, for ${r.slab.ux.length} keys`);
  check(r.faults.length === 0, `${name}: ${r.faults.join('; ')}`);
  // The frame the last key was parted in.
  check(L.cells === h.n && r.glow === L.cells, `${name}: ${L.cells} cells came loose with the last key, its glow held ${r.glow}, and ${h.n} were hauled`);
  check(L.sides <= 1200 && L.followed <= L.cells && L.made === 0, `${name}: the frame the last key was cut in walked ${L.sides} sides, followed ${L.followed} cells (the slab has ${L.cells}) and made ${L.made} pieces of world`);
  check(r.work.sides <= 2400 && r.work.followed <= 4000 && r.work.made <= 6, `${name}: the most work in one frame was ${JSON.stringify(r.work)}`);
  return true;
}

// ---- 1. The first slab of a new game.
for (const seed of [7, 11, 34]) {
  const r = await play(seed, 0), name = `seed ${seed}, the first slab`;
  if (!whole(name, r, 2)) continue;
  check(r.levels.tether === 2 && r.hauled.over === 1, `${name}: played at reach level ${r.levels.tether}, the haul at ${r.hauled.over} of full pay`);
  check(r.reachT < 30 && r.lapT < 20, `${name}: ${r.reachT.toFixed(1)} s of play to the crack and ${r.lapT.toFixed(1)} s round it`);
  out[`first ${seed}`] = { cells: r.hauled.n, keyCells: r.keys, grit: r.hauled.grit, to: +r.reachT.toFixed(1), lap: +r.lapT.toFixed(1), sides: r.loose.sides };
}

// ---- 2. The winch. (Seed 7's slab 233 cells north of the core: 12 in radius, 398 cells.)
{
  const none = await play(7, 3, { winch: 0 }, true), one = await play(7, 3, { winch: 1 }, true);
  if (whole('no winch', none, 2) && whole('one winch', one, 2)) {
    const a = none.hauled, b = one.hauled;
    check(a.n === b.n && a.n > 150 && a.n <= 400, `the slab is ${a.n} and ${b.n} cells: over the first load (150) and within the second (400)`);
    check(a.over === overload(a.n, 0) && a.over < 0.75 && Math.abs(a.mult - haulBonus(a.n, 1) * a.over) < 1e-9, `with no winch the haul is at ${a.over} of full pay, x${a.mult}`);
    check(none.game.bannerSays(none.game.banner)[0] === `${a.n} x${a.mult.toFixed(1)} WINCH OVER LOAD`, `with no winch the banner says ${none.game.bannerSays(none.game.banner)[0]}`);
    check(b.over === 1 && one.game.bannerSays(one.game.banner)[0] === `${b.n} x${b.mult.toFixed(1)}`, `with one winch the haul is at ${b.over} of full pay and the banner says ${one.game.bannerSays(one.game.banner)[0]}`);
    check(b.grit > a.grit * 1.5, `one level of winch pays ${b.grit} for the slab, none ${a.grit}`);
    check(a.title === 'COLOSSAL!' && b.title === 'COLOSSAL!', `the hauls are called ${a.title} and ${b.title}`);
    out.winch = { cells: a.n, none: a.grit, one: b.grit, over: +a.over.toFixed(3) };
  }
}

// ---- 3. Three keys. (Seed 7's slab 516 cells south-east of the core: 13 in radius.)
{
  const r = await play(7, 8, {}, true);
  if (whole('three keys', r, 3)) out.three = { cells: r.hauled.n, keyCells: r.keys, lap: +r.lapT.toFixed(1), sides: r.loose.sides };
}

// ---- 4. Cobble fields. (Seed 7's nearest, 536 cells north of the core, and its third and fourth.)
out.fields = [];
for (const [pick, side] of [[0, 1], [0, 2], [2, 2], [3, 1], [3, 2]]) {
  const r = await field(7, pick, side), name = `the cobble field at ${r.field.cx - 8192},${r.field.cy - 8192}, a square of ${side}`;
  check(r.blocks === 16 * side * side, `${name}: its blocks have ${r.blocks} cells`);
  // (What the way in cut loose beside the joint is hauled too, and counted with the square.)
  check(r.left === 0 && r.n >= r.blocks, `${name}: ${r.n} cells hauled in ${r.hauls.length} hauls, ${r.left} of the blocks' ${r.blocks} left standing`);
  check(r.keys >= 2, `${name}: ${r.keys} keys cut`);
  check(r.hauls.some(h => h.n >= 16) && r.hauls.every(h => h.light === h.n < 12), `${name}: the hauls were ${r.hauls.map(h => `${h.n}${h.light ? ' (no banner)' : ''}`)}`);
  check(r.faults.length === 0, `${name}: ${r.faults.join('; ')}`);
  out.fields.push({ side, cells: r.n, hauls: r.hauls.length, keys: r.keys, t: +r.t.toFixed(1) });
}

console.log(JSON.stringify(out));
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: the first slab of a new game is reached, its keys cut on one lap and all of it hauled; the last key puts the whole slab in the books in a frame that does no more than a cut may; and the winch is what a slab is paid in full by');
process.exit(fails.length ? 1 : 0);
