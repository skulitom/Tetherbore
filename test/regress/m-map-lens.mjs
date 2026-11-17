// The map in the corner at a wide RANGE, and the FINDER's far marks on it.
//   - Where a pixel of the map is three cells across and more, the lens looks at four cells spread over the pixel
//     and shows the one it ranks highest: a lone cache, a hazard and a cell of ore, each lying on none of the
//     pixels' middles, show in their LENS colours at RANGE's fifth level (seven cells a pixel) with the lens at its
//     last, and a pixel with ore and a cache in it shows the cache. (One cell a pixel was looked at: at RANGE's
//     last levels a lone find fell between the cells looked at nearly always, and more range showed less.)
//   - With the finder at its last level, a geode it marks 150 cells from the drill, far past the map's edge, is a
//     pip of its colour on the map's rim, on its side of the map; at the finder's first level, which marks no
//     geodes, there is none. (The rim shows the nearest eight of what lies past the edge.) (The finder was asked no further than the map showed: its far levels marked nothing
//     more in flight.)
//   node test/regress/m-map-lens.mjs
import { makeGame, K, B, C, N } from '../harness.mjs';
const { SPOT } = await import('../../js/drawing.js');

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };

// ---- the lens, seven cells a pixel
{
  const game = await makeGame(7, { tether: 6, maprange: 4, maplens: 3 }), w = game.world, per = game.val('maprange'), size = 46;
  check(per === 7, `RANGE's fifth level is ${per} cells a pixel`);
  // Pixel (u, v) of the map with the drill at the core spans cells C + per * (u - 23) and on; the lens looks at
  // the cells a quarter and three quarters of the way across it (+2 and +5 here, of 0 to 6) and its middle (+4).
  const block = (k, j) => { for (let y = C + per * j - 1; y <= C + per * j + per; y++) for (let x = C + per * k - 1; x <= C + per * k + per; x++) { w.setK(y * N + x, K.SOFT); w.setB(y * N + x, B.CRUST); w.seeCell(x, y); } };
  const put = (x, y, kind) => { w.setK(y * N + x, kind); w.seeCell(x, y); };
  const cases = [['cache', 5, 5, [[2, 2, K.CACHE]], [120, 240, 190]], ['hazard', -6, 4, [[5, 2, K.HAZARD]], [255, 84, 64]], ['ore', 3, -7, [[2, 5, K.ORE_A]], [214, 178, 64]],
    ['ore and a cache', -4, -4, [[2, 2, K.ORE_A], [5, 5, K.CACHE]], [120, 240, 190]], ['plain rock', 6, -2, [], null]];
  for (const [, k, j, cells] of cases) { block(k, j); for (const [dx, dy, kind] of cells) put(C + per * k + dx, C + per * j + dy, kind); }
  // (None of them on a pixel's middle, which is all the map looked at before.)
  const middle = (k, j) => [Math.floor(C + 0.5 + (k + 0.5) * per), Math.floor(C + 0.5 + (j + 0.5) * per)];
  for (const [what, k, j, cells] of cases) for (const [dx, dy] of cells) check(C + per * k + dx !== middle(k, j)[0] || C + per * j + dy !== middle(k, j)[1], `the ${what} lies on its pixel's middle`);
  game.mapFor = null; game.drawMap(0, 0);
  const px = game.mapData.data, rock = (() => { const o = ((23 - 2) * size + 23 + 6) * 4; return [px[o], px[o + 1], px[o + 2]]; })();
  for (const [what, k, j, , rgb] of cases) {
    const o = ((23 + j) * size + 23 + k) * 4, got = [px[o], px[o + 1], px[o + 2]], want = rgb ? [Math.min(255, rgb[0] + 8), Math.min(255, rgb[1] + 7), Math.min(255, rgb[2] + 10)] : rock;
    check(got.join() === want.join(), `the pixel of the ${what} is rgb(${got}), not rgb(${want})`);
  }
  // At the lens's first level the cache and the hazard are plain rock, and the ore still shows.
  game.S.lv.maplens = 1; game.mapFor = null; game.drawMap(0, 0);
  const at = (k, j) => { const o = ((23 + j) * size + 23 + k) * 4; return [px[o], px[o + 1], px[o + 2]].join(); };
  check(at(5, 5) === rock.join() && at(-6, 4) === rock.join() && at(3, -7) === [222, 185, 74].join(), `with the lens at ORE the cache shows ${at(5, 5)}, the hazard ${at(-6, 4)} and the ore ${at(3, -7)}`);
}

// ---- the finder's far marks, on the rim
{
  const game = await makeGame(7, { tether: 5, mapfinder: 3 }), size = 46;
  const geodes = game.findsNear(C + 0.5, C + 0.5, 400, {}).filter(([what, fx, fy]) => what === 'geode' && Math.hypot(fx - C, fy - C) > 130 && Math.hypot(fx - C, fy - C) < 190);
  check(geodes.length > 0, 'no geode lies 130 to 190 cells out to try');
  const [, gx, gy] = geodes[0] ?? [null, C + 150, C];
  // (Every other find it marks is seen, so the geode is the one mark past the map's edge: the rim shows the nearest
  // few.)
  for (const [, fx, fy] of game.findsNear(C + 0.5, C + 0.5, 400, {})) if (fx !== gx || fy !== gy) game.world.seeCell(fx, fy);
  game.version++;
  const pips = level => {
    game.S.lv.mapfinder = level;
    const drawn = [];
    game.ctx.fillRect = (x, y, w, h) => { if (game.ctx.fillStyle === SPOT.geode[1] && w * h === 2) drawn.push([x, y, w, h]); };
    game.mapFor = null; game.drawMap(0, 0);
    delete game.ctx.fillRect;
    return drawn;
  };
  const far = pips(3), none = pips(1), near = pips(2);
  // On the rim, and on the geode's side of the middle of the map.
  const side = ([x, y, w, h]) => {
    const ax = x + w / 2 - size / 2, ay = y + h / 2 - size / 2, bx = gx + 0.5 - (C + 0.5), by = gy + 0.5 - (C + 0.5);
    const rim = x <= 0 || y <= 0 || x + w >= size || y + h >= size, along = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by));
    return rim && along > 0.98;
  };
  check(far.length >= 1 && far.some(side), `with the finder at its last level the geode ${Math.round(Math.hypot(gx - C, gy - C))} cells out (${gx - C}, ${gy - C}) draws ${JSON.stringify(far)} on the map`);
  check(near.some(side), `with the finder at GEODE the geode draws ${JSON.stringify(near)}`);
  check(none.length === 0, `with the finder at CACHE a geode draws ${JSON.stringify(none)}`);
}

// ---- no more than eight on the rim, however many lie past the edge
{
  const game = await makeGame(7, { tether: 6, maprange: 0, mapfinder: 3 }), colours = new Set([SPOT.cache[1], SPOT.geode[1], SPOT.prism[1]]), pips = [];
  game.ctx.fillRect = (x, y, w, h) => { if (colours.has(game.ctx.fillStyle) && w * h === 2) pips.push([x, y]); };
  game.mapFor = null; game.drawMap(0, 0);
  const past = game.findsNear(C + 0.5, C + 0.5, 400, {}).filter(([, fx, fy]) => Math.max(Math.abs(fx - C), Math.abs(fy - C)) > 36).length;
  check(past > 8 && pips.length === 8, `${past} finds lie past the map's edge and the rim has ${pips.length} pips`);
}

if (fails.length) { console.log(`FAIL (${fails.length}):\n  ${fails.join('\n  ')}`); process.exit(1); }
console.log('ok: the corner map shows a lone find, hazard and ore at seven cells a pixel, and the finder\'s far geode on its rim');
