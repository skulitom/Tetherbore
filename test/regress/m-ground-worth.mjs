// The model check (docs/CONTENT-PLAN.md, section 4): the prices are worked out from what an average cell of ground
// is worth (js/shop.js: WORTH), so nothing the build lays may move the mean worth of a solid cell, in any ring round
// the core, more than 15 in a hundred from what it was with grounds 0 to 8 alone. tools/ground-worth.mjs counts it;
// this holds it, on four worlds with 5,000 cells to a ring and direction (the tool's own run asks more).
//   node test/regress/m-ground-worth.mjs
// It also holds the tool to what it says of itself: its last stage is the world as it is, cell for cell (a new
// game's, of generation 2: js/world.js, GEN), and its first has none of what the build laid in it.
import { count, cells, worst, whole, RINGS, WAYS, MOST, LAST } from '../../tools/ground-worth.mjs';
import { World, C, K, BIOMES } from '../../js/world.js';

const problems = [], sums = count(4, 5000), top = worst(sums);
if (!(Math.abs(top.moved) <= MOST)) problems.push(`ring ${top.ring} moved ${(top.moved * 100).toFixed(1)}% from grounds 0 to 8 alone: over ${MOST * 100}%, so WORTH and the prices must follow (the plan's rule)`);
// And no direction of a ring, over eight worlds' worth of cells, by more than a quarter: one direction is one
// province or two on any one world, so it moves more than the whole ring does.
RINGS.forEach((R, r) => WAYS.forEach(([name], d) => {
  const was = sums.before[r][d], now = sums[LAST][r][d], moved = now.grit / now.solid / (was.grit / was.solid) - 1;
  if (!(Math.abs(moved) <= 0.25)) problems.push(`ring ${R} ${name} moved ${(moved * 100).toFixed(1)}%`);
}));
// `before` is grounds 0 to 8 alone; the last stage has strains, crosses and pockets in it, and the rules of
// generation 2: the seams and the deep strains, which only it has. (`now` is generation 1's world, with none.)
RINGS.forEach((R, r) => {
  for (const s of sums.before[r]) s.rows.forEach((n, b) => { if (n && b > 8) problems.push(`ring ${R}: \`before\` has ${n} cells of ${BIOMES[b].name}`); });
});
const far = sums[LAST][RINGS.length - 1].flatMap(s => s.rows.map((n, b) => n ? b : -1)).filter(b => b >= 0);
for (const [what, has] of [['a strain', b => b >= 17 && b <= 31], ['a pocket', b => b >= 32 && b <= 63], ['a cross', b => b >= 128], ['a deep seam', b => b >= 13 && b <= 16], ['a deep strain', b => b >= 64 && b <= 79]]) if (!far.some(has)) problems.push(`the furthest ring has no cell of ${what} in \`${LAST}\``);
RINGS.forEach((R, r) => { for (const s of sums.now[r]) s.rows.forEach((n, b) => { if (n && ((b >= 9 && b <= 16) || (b >= 64 && b <= 79))) problems.push(`ring ${R}: \`now\`, of generation 1, has ${n} cells of ${BIOMES[b].name}`); }); });
// The builders' halls (the last stage over `depth`) lift no ring by more than 8 in a hundred over the world without
// them: their walls are vault, worth five plain cells, and their insides open (the plan's bound; held in the ring at
// 2,000 cells, where they are thickest, and every ring besides). And there are halls far out, and none near.
RINGS.forEach((R, r) => {
  const was = whole(sums.depth[r]), now = whole(sums[LAST][r]), moved = now.grit / now.solid / (was.grit / was.solid) - 1;
  if (!(moved <= 0.08) || (R < 1500 && moved !== 0) || (R === 2000 && !(moved > 0.005))) problems.push(`ring ${R}: the halls move it ${(moved * 100).toFixed(1)}% over \`depth\``);
});
const seams = RINGS.indexOf(700), seamy = sums[LAST][seams].reduce((n, s) => n + s.rows.reduce((m, c, b) => m + (b >= 9 && b <= 12 ? c : 0), 0), 0) / sums[LAST][seams].reduce((n, s) => n + s.asked, 0);
if (!(seamy > 0.06 && seamy < 0.16)) problems.push(`the seams are ${(seamy * 100).toFixed(1)}% of the ring at 700, not about a tenth`);
// `now` is the world itself: the same cells asked of a plain World give the same sums.
const w = new World(); w.reset(1);
const list = cells(1, 700, 0, 1, 5000), plain = { solid: 0, rows: [] };
for (let n = 0; n < list.length; n += 2) {
  const x = C + list[n], y = C + list[n + 1], b = w.biomeAt(x, y), k = w.kindAt(x, y, b);
  plain.rows[b] = (plain.rows[b] ?? 0) + 1;
  if (k !== K.EMPTY && k !== K.BEDROCK) plain.solid++;
}
const one = count(1, 5000)[LAST][RINGS.indexOf(700)][1];
if (one.solid !== plain.solid || JSON.stringify(one.rows) !== JSON.stringify(plain.rows)) problems.push(`\`${LAST}\` is not the world as it is: ${one.solid} solid cells of the south's ring at 700, the world has ${plain.solid}`);
// The rows the tool stood in for `before` are put back.
for (const id of [2, 4, 6, 8]) if (!(BIOMES[id].lay.rind > 0 || BIOMES[id].lay.ribs > 0)) problems.push(`ground ${id} was left without its rind or ribs`);

if (problems.length) { console.log('PROBLEMS\n' + problems.join('\n')); process.exit(1); }
console.log(`ok: the most a ring moved is ${(top.moved * 100).toFixed(1)}% at ${top.ring}`);
