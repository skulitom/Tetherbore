// The chart shows what is out there (js/drawing.js: `drawMap`, `unseenShade`, UNSEEN_LUM, UNSEEN_GRAIN, EDGE,
// `cornerSites`). A new game on world 7 with the longest tether, its chart drawn whole (the reach about the core,
// 160 pixels across) and the map in the corner:
//   - ground not yet seen is its row's colour on the map at UNSEEN_LUM's luminance or more (a third of it, as it
//     was, wherever that is brighter, and never more than UNSEEN_MOST of it), and in UNSEEN_GRAIN of the squares of 8
//     cells its second chip's colour: every pixel of it is that, to the unit, on the chart and on the map; so a
//     deep flank's magma or gilt reads at a luminance of 34 or more, where a third of its colour was 25 and 34;
//   - on the chart, and only there, a pixel whose ground is not the pixel's to its left or above it is a quarter
//     darker: two grounds side by side are told apart, every pair of them, and the borders are a share of the
//     chart;
//   - the borders ask the world no more than the picture did: one `biomeKnown` a pixel;
//   - each corner's shrine is marked from the start, a cross in its two parents' colours where it lies, and each
//     corner's herald is rung in its rare hazard's colour once the finder reaches it (the drill set down beside
//     it), and not before;
//   - each seam is told on the chart from every ground made by hand it meets (not a pocket, nor a generated cross,
//     whose colours are its parents' and so a seam's kin's): its colour unseen, the ground's
//     shade and grain together, is 7 or more apart from each of theirs, as worlds 7, 11 and 23 lay them on the
//     diagonals (cinderfen was 0.9 from scoria and 1.0 from ember, the south's ground carried on to the diagonal, and
//     glassdune 5.6 from lode);
//   - and the colour of every ground on the map is its rock's (the mean of its sheet's pixels), as a hue, wherever
//     both are coloured (obsidian's was violet, over amber sand).
// Fails on the chart before: a deep flank unseen was a third of its colour, flat, and no border nor shrine shown;
// and before the seams were coloured apart, on cinderfen, glassdune and obsidian.
//   node test/regress/d-chart-unseen.mjs
import { makeGame, world, C, N } from '../harness.mjs';
const { K, rowOf, cellHash, SEAMS, SHRINES } = world;
const { unseenShade, GEM_COLOR, SPOT } = await import('../../js/drawing.js');
const { FINDER } = await import('../../js/shop.js');

const fails = [], check = (ok, what) => { if (!ok && fails.length < 20) fails.push(what); };
const game = await makeGame(7, { tether: 9, chart: 1, mapfinder: 3, maprange: 3 }), w = game.world, R = game.val('tether');
const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
const rgb = hex => [1, 3, 5].map(n => parseInt(hex.slice(n, n + 2), 16));
// What the drawing says a pixel is, written out plainly: [r, g, b, the row, whether a grain, whether a border].
const expect = (wx, wy, row, left, above, big) => {
  let [r, g, b] = row.map, shade = unseenShade(row);
  const grain = cellHash(wx >> 3, wy >> 3, row.id) < 0.35;
  if (grain) { [r, g, b] = rgb(row.debris[1]); shade = Math.min(0.65, Math.max(0.2, 46 / lum(r, g, b))); }
  const edge = big && ((left !== null && left !== row.id) || (above !== null && above !== row.id));
  if (edge) shade *= 0.75;
  if (Math.hypot(wx - C, wy - C) > R) shade *= 0.45;
  return [r * shade + 8, g * shade + 7, b * shade + 10, grain, edge];
};
const draw = (big, size, per, cx, cy) => {
  const M = big ? (game.chartMap ??= {}) : game;
  if (M) M.mapFor = null;
  let asked = 0;
  const own = w.biomeKnown;
  w.biomeKnown = function (x, y) { asked++; return own.call(this, x, y); };
  const fills = [], ctx = game.ctx;
  ctx.fillRect = function (x, y, ww, hh) { fills.push([this.fillStyle, x, y, ww, hh]); };
  game.drawMap(0, 0, big ? { size, per, cx, cy } : null);
  w.biomeKnown = own; delete ctx.fillRect;
  return { data: (big ? game.chartMap : game).mapData.data, asked, fills };
};
const read = (out, size, per, mx0, my0, big) => {
  const ids = new Int32Array(size * size);
  let wrong = 0, low = 0, same = 0, pairs = 0, borders = 0, unseen = 0, deep = 0, first = '';
  for (let v = 0; v < size; v++) for (let u = 0; u < size; u++) {
    const wx = Math.floor(mx0 + (u - size / 2 + 0.5) * per), wy = Math.floor(my0 + (v - size / 2 + 0.5) * per), row = rowOf(w.biomeKnown(wx, wy)), o = (v * size + u) * 4;
    ids[v * size + u] = row.id;
    if (w.peek(wx, wy) >= 0 || Math.hypot(wx - C, wy - C) > R) continue;
    unseen++;
    const [r, g, b, grain, edge] = expect(wx, wy, row, u > 0 ? ids[v * size + u - 1] : null, v > 0 ? ids[(v - 1) * size + u] : null, big), px = out.data;
    if (Math.abs(px[o] - r) > 1 || Math.abs(px[o + 1] - g) > 1 || Math.abs(px[o + 2] - b) > 1) { wrong++; first ||= `${row.name} at ${wx - C},${wy - C}: ${px[o]},${px[o + 1]},${px[o + 2]}, not ${r.toFixed(1)},${g.toFixed(1)},${b.toFixed(1)}`; }
    const L = lum(px[o] - 8, px[o + 1] - 7, px[o + 2] - 10);
    if (!edge && L < 33.5) low++;
    if ((row.id === 6 || row.id === 8) && !edge) { deep++; if (L < 33.5) low++; }
    if (edge) borders++;
    // (Two grounds of one colour, crosses of one pair with structures apart, are told apart by the border alone.)
    const lx = Math.floor(mx0 + (u - 1 - size / 2 + 0.5) * per), left = rowOf(ids[v * size + u - 1]);
    if (u > 0 && left.id !== row.id && left.map.join() !== row.map.join() && !grain && cellHash(lx >> 3, wy >> 3, left.id) >= 0.35 && w.peek(lx, wy) < 0 && Math.hypot(lx - C, wy - C) <= R) {
      pairs++;
      if (px[o] === px[o - 4] && px[o + 1] === px[o - 3] && px[o + 2] === px[o - 2]) same++;
    }
  }
  return { wrong, low, same, pairs, borders, unseen, deep, first };
};

// The chart: the whole reach.
{
  // (Drawn twice, and read the second time: what else the chart asks of the world, the pockets it marks, it keeps.)
  const size = 160, per = (2 * R + 8) / size, warm = draw(true, size, per, C + 0.5, C + 0.5), out = draw(true, size, per, C + 0.5, C + 0.5), got = read(out, size, per, C + 0.5, C + 0.5, true);
  check(got.unseen > size * size * 0.6 && got.deep > 400, `the chart shows ${got.unseen} pixels unseen, ${got.deep} of magma and gilt`);
  check(got.wrong === 0, `${got.wrong} pixels of the chart unseen are not as written: ${got.first}`);
  check(got.low === 0, `${got.low} pixels of the chart unseen, not on a border, are darker than a luminance of 34`);
  check(got.pairs > 300 && got.same === 0, `of ${got.pairs} pairs of grounds side by side unseen, ${got.same} look the same`);
  check(got.borders > got.unseen * 0.02, `${got.borders} of ${got.unseen} pixels are borders`);
  check(out.asked === size * size, `the chart asked biomeKnown ${out.asked} times for ${size * size} pixels`);
  // The shrines.
  SHRINES.forEach(([sx, sy], c) => {
    const row = rowOf(SEAMS[c][0]), mx = Math.round(size / 2 + (C + sx - C - 0.5 + 0.5) / per), my = Math.round(size / 2 + (C + sy - C) / per);
    const mark = out.fills.some(([style, x, y, ww, hh]) => style === GEM_COLOR[row.gemA] && ww === 3 && hh === 1 && Math.abs(x - (mx - 1)) <= 1 && Math.abs(y - my) <= 1);
    check(mark, `the shrine of corner ${c} is not marked at ${mx},${my}`);
  });
}
// The map in the corner, three cells a pixel about the core: no borders, every unseen pixel as written.
{
  const per = game.val('maprange'), out = draw(false, 46, per, C + 0.5, C + 0.5), got = read(out, 46, per, game.drill.x, game.drill.y, false);
  check(got.wrong === 0 && got.low === 0, `the map in the corner: ${got.wrong} pixels unseen not as written (${got.first}), ${got.low} too dark`);
}
// A corner's herald, rung once the finder reaches it.
{
  const sites = game.cornerSites();
  check(sites.length === 4, `world 7 has ${sites.length} corners' heralds`);
  const [hx, hy, type] = sites[0], colour = SPOT[type][1], d = game.drill, size = 160, per = (2 * R + 8) / size;
  const rung = () => draw(true, size, per, C + 0.5, C + 0.5).fills.filter(([style, , , ww, hh]) => style === colour && ww === 1 && hh === 1).length;
  const before = rung();
  d.x = hx + 0.5 - FINDER[3] + 20; d.y = hy + 0.5;
  const near = rung();
  check(before === 0 && near >= 6, `the north-east's herald (${type}) is rung with ${before} dots from the core and ${near} with the drill beside it`);
}
// Each seam against the grounds it meets, on the chart.
{
  const { World, BIOMES } = world, unseen = row => {
    const g = rgb(row.debris[1]), s = unseenShade(row), gs = Math.min(0.65, Math.max(0.2, 46 / lum(...g)));
    return [0, 1, 2].map(n => 0.65 * row.map[n] * s + 0.35 * g[n] * gs);
  };
  const meets = new Map(), seam = row => row.seam !== null && row.seam !== undefined && !row.deep;
  for (const seed of [7, 11, 23]) {
    const v = new World(); v.reset(seed);
    for (let y = -2300; y <= 2300; y += 6) for (let x = -2300; x <= 2300; x += 6) {
      const r = Math.hypot(x, y);
      if (r < 440 || r > 2300 || Math.abs(Math.abs(x) - Math.abs(y)) > 400) continue;
      const a = rowOf(v.biomeAt(C + x, C + y));
      for (const [u, t] of [[6, 0], [0, 6]]) {
        const b = rowOf(v.biomeAt(C + x + u, C + y + t));
        if (a.id === b.id || a.pocket !== null || b.pocket !== null || a.id >= 128 || b.id >= 128) continue;
        if (seam(a)) meets.set(`${a.id}:${b.id}`, [a, b]);
        if (seam(b)) meets.set(`${b.id}:${a.id}`, [b, a]);
      }
    }
  }
  const seams = new Set([...meets.values()].map(([a]) => a.name));
  check(seams.size === 4, `the seams met on the chart are ${[...seams]}`);
  for (const [a, b] of meets.values()) {
    const p = unseen(a), q = unseen(b), apart = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    check(apart >= 7, `on the chart ${a.name} is ${apart.toFixed(1)} from ${b.name} beside it`);
  }
  // Each ground's colour and its rock's, as hues.
  const { readFileSync } = await import('node:fs'), { decodePNG } = await import('../../tools/png.mjs');
  const hue = ([r, g, b]) => {
    const most = Math.max(r, g, b), d = most - Math.min(r, g, b);
    return [d ? ((most === r ? (g - b) / d + 6 : most === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60) % 360 : 0, most ? d / most : 0];
  };
  let rows = 0;
  for (const row of BIOMES) {
    if (!row || row.id >= 128 || row.pocket !== null) continue;
    const { data: rgba } = decodePNG(readFileSync(new URL(`../../assets/${row.sheet}.png`, import.meta.url))), sum = [0, 0, 0];
    let n = 0;
    for (let i = 0; i < rgba.length; i += 4) if (rgba[i + 3] >= 200) { sum[0] += rgba[i]; sum[1] += rgba[i + 1]; sum[2] += rgba[i + 2]; n++; }
    const [rock, rs] = hue(sum.map(v => v / n)), [map, ms] = hue(row.map), off = Math.min(Math.abs(rock - map), 360 - Math.abs(rock - map));
    if (rs < 0.25 || ms < 0.25) continue;
    rows++;
    check(off <= 25, `${row.name}'s colour on the map is ${row.map} (hue ${map.toFixed(0)}), its rock's hue ${rock.toFixed(0)}`);
  }
  check(rows > 15, `only ${rows} grounds' colours were held to their rocks'`);
}
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: ground unseen reads at a luminance of 34 or more, grained, with its borders on the chart; the shrines are marked and the corners\' heralds rung within the finder; each seam is told from the grounds beside it, and each ground\'s colour on the map is its rock\'s');
process.exit(fails.length ? 1 : 0);
