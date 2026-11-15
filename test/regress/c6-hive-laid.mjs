// The amber hive as it lies in the ground (docs/CONTENT-PLAN.md, content item 6; js/world.js: POCKET_SHAPES.hive,
// hiveChambers, nuggets, and the hive's row). Checked on the world's own cells, in hives of four worlds:
//   - the row: the west's, from 170 cells out, 8 to 30 in radius, wax that cuts in half the time, a stalk that
//     cuts at a touch, and what its amber pays;
//   - a hive is whole chambers: seven cells square inside, a wall of wax a cell thick all round, each chamber's
//     middle within the hive's radius of the hive's own, every other row of them shifted half a chamber; and every
//     cell of the hive is one of a chamber's or of its walls;
//   - the chamber at the hive's middle holds a nugget; of the others the share `nuggets(rho)` do (55 in a hundred
//     up to radius 14, fewer in a bigger hive as its radius grows), 15 in a hundred are wax right through and the
//     rest are empty;
//   - a nugget is nine cells of amber in the chamber's middle with a stalk of two cells to one wall, each wall as
//     often as another, and two cells of room all round but for the stalk; the wall the stalk hangs from has no
//     door there;
//   - cut either cell of the stalk and exactly the nugget hangs loose (with the other cell of stalk, where that is
//     the one against it); a nugget whose stalk is whole hangs on the wall. (But in a hive that itself hangs on
//     nothing: one that stands clear of the rock in a great cavern is one loose piece, walls, nuggets and all,
//     and is not asked: with whatever rock it stands on, if that hangs too. About one hive in a hundred does.)
//   - doors: at the corner where a chamber's west wall meets the wall over it, in 35 corners of a hundred the west
//     wall has one and in 35 the wall overhead has, in its half next the corner; never both, never the other half
//     of the wall overhead, and only between two chambers of the hive, so the hive's outside wall is whole;
//   - so nothing in a hive hangs on nothing: its walls, its nuggets and their stalks are one piece of ground;
//   - what a hive holds grows no faster than its radius: under 4.5 cells of amber for each cell of radius, on
//     the mean, in hives small and great.
//   node test/regress/c6-hive-laid.mjs
import { World, N, C, K, B, BIOMES, ZONE, hiveChambers, nuggets, digTime } from '../../js/world.js';

const fails = [], check = (ok, what) => { if (!ok && fails.length < 16) fails.push(what); };
const out = {};

// ---- the row
{
  const row = BIOMES[32], P = row.pocket;
  check(row.name === 'hive' && row.title === 'AMBER HIVE' && row.kin === B.MIRE && row.sheet === 'wax' && row.floor === 'wax-floor' && row.dig === 0.5 && row.worth === 1 && row.rich === 1, `the hive's row: ${JSON.stringify({ ...row, pocket: undefined })}`);
  check(row.haz === null && row.haz2 === null && row.freeze === 0 && row.gen === null && row.lay === null && row.extras.length === 0, 'the hive has a hazard, a freeze or thresholds of its own');
  check(JSON.stringify(row.gloom) === '[28,16,4]' && JSON.stringify(row.mote) === '["#ffd070","still"]' && JSON.stringify(row.map) === '[216,154,42]', 'the hive\'s dark, motes or colour on the map are not the ones written');
  check(P.shape === 'hive' && JSON.stringify(P.kins) === '[3]' && P.minR === 170 && JSON.stringify(P.rho) === '[8,30]' && P.weight === 1 && P.mineral === 'amber' && P.node === 'stalk' && P.kind === K.MINERAL && !P.chain,
    `the hive's pocket: ${JSON.stringify(P)}`);
  check(P.lump === 0.8 && P.spec === 0.25 && P.nodeDig === 0.1 && P.pip === '#ffb020', `what the hive's amber pays: lump ${P.lump}, ${P.spec} specimens, a stalk cut in ${P.nodeDig}`);
  check(Math.abs(digTime(K.SOFT, row) - 0.12) < 1e-9 && Math.abs(digTime(K.NODE, row) - 0.05) < 1e-9 && Math.abs(digTime(K.MINERAL, row) - 0.225) < 1e-9, 'wax, a stalk or amber does not cut in the time written');
  check(nuggets(8) === 0.55 && nuggets(14) === 0.55 && Math.abs(nuggets(28) - 0.275) < 1e-9, `the share of chambers with a nugget: ${nuggets(8)}, ${nuggets(14)}, ${nuggets(28)}`);
}

const w = new World();
const kindOf = (x, y) => w.kindAt(x, y, w.biomeAt(x, y)), isHive = (x, y) => w.biomeAt(x, y) === 32;
let hives = 0, chambers = 0, withNugget = 0, solid = 0, empty = 0, odd = 0, middles = 0, strays = 0, open = 0, roomless = 0, doorAtStalk = 0, expected = 0;
let corners = 0, west = 0, over = 0, both = 0, badDoor = 0, outer = 0, apart = 0, cutNear = 0, cutFar = 0, badCut = 0, heldWrong = 0, adrift = 0;
const sides = [0, 0, 0, 0], perRadius = [];
for (const seed of [1, 7, 34, 99]) {
  w.reset(seed);
  for (const Z of w.pocketsWithin(2300).filter(Z => Z.row === 32)) {
    hives++;
    const list = hiveChambers(Z), mine = new Set(), most = Math.ceil(Z.reach) + 2;
    check(list[0][0] === Z.cx && list[0][1] === Z.cy, `seed ${seed}: the hive at ${Z.cx - C},${Z.cy - C} has no chamber at its middle`);
    let amber = 0, whole = 0, hangs = false;
    for (const [mx, my] of list) for (let v = -4; v <= 4; v++) for (let u = -4; u <= 4; u++) mine.add((my + v) * N + mx + u);
    for (const i of mine) if (kindOf(i % N, Math.floor(i / N)) !== K.EMPTY) whole++;
    for (const [mx, my] of list) {
      chambers++;
      const ex = mx - Z.cx, ey = my - Z.cy, row = ey / 8;
      if (ex * ex + ey * ey > Z.rho * Z.rho || !Number.isInteger(row) || !Number.isInteger((ex - (Math.abs(row) % 2 ? 4 : 0)) / 8)) odd++;
      for (let v = -4; v <= 4; v++) for (let u = -4; u <= 4; u++) { mine.add((my + v) * N + mx + u); if (!isHive(mx + u, my + v)) strays++; }
      // What it holds: a nugget, wax right through, or nothing.
      const inside = [];
      for (let v = -3; v <= 3; v++) for (let u = -3; u <= 3; u++) inside.push([u, v, kindOf(mx + u, my + v)]);
      const count = k => inside.filter(c => c[2] === k).length, first = mx === Z.cx && my === Z.cy;
      if (first) { middles++; if (count(K.MINERAL) !== 9) check(false, `seed ${seed}: the chamber at the middle of the hive at ${Z.cx - C},${Z.cy - C} holds no nugget`); } else expected += nuggets(Z.rho);
      if (count(K.SOFT) === 49) { solid++; continue; }
      if (count(K.EMPTY) === 49) { empty++; continue; }
      if (count(K.MINERAL) !== 9 || count(K.NODE) !== 2 || count(K.EMPTY) !== 38 || !inside.every(([u, v, k]) => (k === K.MINERAL) === (Math.abs(u) <= 1 && Math.abs(v) <= 1))) { odd++; continue; }
      if (!first) withNugget++;
      amber += 9;
      // The stalk: two cells in a line from the nugget to a wall, and the wall there is wax.
      const stalk = inside.filter(c => c[2] === K.NODE), [sx, sy] = [Math.sign(stalk[0][0]), Math.sign(stalk[0][1])], side = sx === 1 ? 0 : sy === 1 ? 1 : sx === -1 ? 2 : 3;
      sides[side]++;
      if (!(Math.abs(sx) + Math.abs(sy) === 1 && stalk.every(([u, v]) => (u === 2 * sx || u === 3 * sx) && (v === 2 * sy || v === 3 * sy)))) { odd++; continue; }
      if (kindOf(mx + 4 * sx, my + 4 * sy) !== K.SOFT) doorAtStalk++;
      // Two cells of room all round, but for the stalk.
      if (inside.some(([u, v, k]) => Math.max(Math.abs(u), Math.abs(v)) >= 2 && k !== K.EMPTY && k !== K.NODE)) roomless++;
      // Cut the stalk: the nugget hangs on nothing. (Every sixth nugget, in the world's own cells.)
      if (withNugget % 6) continue;
      const cell = (u, v) => (my + v) * N + mx + u, nugget = [];
      for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) nugget.push(cell(u, v));
      // (Uncut, nothing hangs: asked from the open cell against the nugget's far side, nothing is loose. Unless
      // the whole hive is: then what is loose is all of it, and its stalks are not asked about.)
      if (hangs) continue;
      const loose = w.freed([cell(-2 * sx, -2 * sy)], 4000);
      if (loose.length === 1 && loose[0].length >= whole && loose[0].filter(i => mine.has(i)).length === whole) { hangs = true; adrift++; continue; }
      if (loose.length) heldWrong++;
      const same = (pieces, want) => pieces.length === 1 && pieces[0].length === want.length && want.every(i => pieces[0].includes(i));
      const near = cell(2 * sx, 2 * sy), away = cell(3 * sx, 3 * sy);
      if (same(w.freed([near]), nugget)) cutNear++; else badCut++;
      if (same(w.freed([away]), [...nugget, near])) cutFar++; else badCut++;
    }
    perRadius.push([Z.rho, amber]);
    // Every cell of the hive's ground is a chamber's or its walls', and nothing else is the hive's.
    for (let y = Z.cy - most; y <= Z.cy + most; y++) for (let x = Z.cx - most; x <= Z.cx + most; x++) if (isHive(x, y) !== mine.has(y * N + x)) strays++;
    // Doors. The open cells of a chamber's west wall and of the wall over it; a corner is counted where both the
    // walls that meet at it lie between two chambers of the hive, so that either could have the door.
    const has = (x, y) => list.some(([cx, cy]) => cx === x && cy === y);
    for (const [mx, my] of list) {
      const gaps = cells => cells.filter(([x, y]) => kindOf(x, y) === K.EMPTY);
      const inWest = gaps([-3, -2, -1, 0, 1, 2, 3].map(v => [mx - 4, my + v])), inOver = gaps([-3, -2, -1].map(u => [mx + u, my - 4])), inOther = gaps([1, 2, 3].map(u => [mx + u, my - 4]));
      if (has(mx - 8, my) && has(mx - 4, my - 8)) { corners++; if (inWest.length) west++; if (inOver.length) over++; }
      if (inWest.length && inOver.length) both++;
      if (inOther.length || inWest.length > 1 || inOver.length > 1) badDoor++;
      if (inWest.length && (!has(mx - 8, my) || Math.abs(inWest[0][1] - my) !== 2)) badDoor++;
      if (inOver.length && (!has(mx - 4, my - 8) || inOver[0][0] !== mx - 2)) badDoor++;
      // (The corners, and the cell under the wall that stands on a level wall, are never open.)
      for (const [u, v] of [[-4, -4], [0, -4], [4, -4], [-4, 4], [0, 4], [4, 4]]) if (kindOf(mx + u, my + v) !== K.SOFT) open++;
    }
    // The outside wall is whole: a cell of the hive with ground that is not the hive's beside it or corner to
    // corner is wax. And all that is not open in the hive is one piece, joined side to side.
    const ground = [...mine].filter(i => kindOf(i % N, Math.floor(i / N)) !== K.EMPTY), got = new Set([ground[0]]), walk = [ground[0]], standing = new Set(ground);
    for (const i of mine) {
      const x = i % N, y = Math.floor(i / N);
      let edge = false;
      for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) if (!mine.has((y + v) * N + x + u)) edge = true;
      if (edge && kindOf(x, y) !== K.SOFT) outer++;
    }
    for (const i of walk) for (const s of [1, N, -1, -N]) if (standing.has(i + s) && !got.has(i + s)) { got.add(i + s); walk.push(i + s); }
    apart += ground.length - walk.length;
  }
}
const nuggetChambers = chambers - middles;
out.counted = { hives, adrift, chambers, withNugget, solid, empty, corners, west, over, sides, cutNear, cutFar };
check(hives > 80 && chambers > 1500, `${hives} hives and ${chambers} chambers looked at`);
check(odd === 0, `${odd} chambers are not where a chamber lies, or hold something that is no nugget, no wax and not nothing`);
check(strays === 0, `${strays} cells are a chamber's and not the hive's ground, or the hive's ground and no chamber's`);
check(Math.abs(withNugget - expected) < expected * 0.08, `${withNugget} chambers hold a nugget besides the middle ones, where their hives' shares come to ${expected.toFixed(0)}`);
check(Math.abs(solid / nuggetChambers - 0.15) < 0.03, `${(solid / nuggetChambers * 100).toFixed(1)} chambers in a hundred are wax right through, not 15`);
check(empty > nuggetChambers * 0.25, `only ${empty} of ${nuggetChambers} chambers are empty`);
check(Math.min(...sides) > Math.max(...sides) * 0.75, `the stalks hang from the four walls ${sides} times: not as often from each`);
check(doorAtStalk === 0, `${doorAtStalk} stalks hang from a door`);
check(roomless === 0, `${roomless} nuggets have less than two cells of room on some side`);
check(open === 0, `${open} corners of walls are open`);
check(Math.abs(west / corners - 0.35) < 0.04 && Math.abs(over / corners - 0.35) < 0.04 && corners > 1000, `of ${corners} corners between chambers of a hive, ${(west / corners * 100).toFixed(1)} in a hundred have a door in the west wall and ${(over / corners * 100).toFixed(1)} in the wall overhead, not 35 and 35`);
check(both === 0, `${both} corners have a door in both of their walls`);
check(badDoor === 0, `${badDoor} doors lie where no door may: in the far half of a wall overhead, two in one wall, off their place, or in the outside wall`);
check(outer === 0, `${outer} cells of a hive's outside wall are not wax`);
check(apart === 0, `${apart} cells of a hive's walls, nuggets and stalks are not joined to the rest of it`);
check(badCut === 0 && cutNear > 80 && cutFar > 80, `a stalk cut did not free exactly its nugget ${badCut} times (${cutNear} and ${cutFar} did)`);
check(heldWrong === 0, `${heldWrong} nuggets hang loose with their stalks whole`);
check(adrift <= hives * 0.02, `${adrift} of ${hives} hives hang on nothing`);
// What a hive holds against its radius: the mean of the small, the middling and the great.
for (const [lo, hi] of [[8, 12], [12, 18], [18, 31]]) {
  const band = perRadius.filter(([rho]) => rho >= lo && rho < hi), per = band.reduce((s, [rho, amber]) => s + amber, 0) / band.reduce((s, [rho]) => s + rho, 0);
  (out.amberPerRadius ??= []).push(+per.toFixed(2));
  check(band.length > 8 && per > 2 && per < 4.5, `hives of radius ${lo} to ${hi} (${band.length}): ${per.toFixed(2)} cells of amber for each cell of radius`);
}
console.log(JSON.stringify(out));
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: a hive is whole chambers walled all round, a nugget hung by a stalk in its share of them with room to fly round it, and a stalk cut frees exactly its nugget');
process.exit(fails.length ? 1 : 0);
