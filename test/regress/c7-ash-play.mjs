// An ash flat played with no hand on it (docs/CONTENT-PLAN.md, content item 7; tools/ash-play.mjs): the drill
// ploughs one round loop through the ash, steered by a heading that turns all the way and never by cells, and
// where the loop closes the ash inside it comes home with its tektites. In two flats of world 7, the south's first
// with the bit a player holds there and a great one with the best bit:
//   - the loop closes and what it is round comes home in one haul, all of it the flat's own ground, with a
//     banner: every cell of ash and every tektite inside the loop;
//   - that haul pays its tektites' lumps and nothing else (ash is worth nothing, however big the haul), and a
//     fifth of a specimen of the south for each;
//   - the drill's run is never broken on the way round: ploughed ground costs it neither its run nor its speed,
//     with the first bit's cut of three frames or the best bit's of one, and it cuts more than twelve cells a second;
//   - it goes through tektites on the way, more than once a second, and CRUSHED comes up no more than once a second;
//   - and the tether is sound all the way.
//   node test/regress/c7-ash-play.mjs
import { C, B } from '../harness.mjs';
import { play } from '../../tools/ash-play.mjs';

const fails = [], check = (ok, what) => { if (!ok && fails.length < 16) fails.push(what); };
const out = [];
for (const [pick, share, lv, name] of [[0, 0.75, {}, 'the south\'s first ash flat'], [1, 0.62, { drill: 4 }, 'a flat 23 cells in radius, with the best bit'], [1, 0.62, { drill: 0 }, 'the same flat with the first bit']]) {
  const r = await play(7, pick, share, lv), Z = r.flat, at = `${name} (${Z.cx - C},${Z.cy - C})`;
  const big = r.hauled.filter(h => h.n > r.loop * r.loop), loop = big[0];
  check(big.length === 1 && loop && loop.ash === loop.n && !loop.light && loop.n > 2.2 * r.loop * r.loop, `${at}: a loop ${r.loop.toFixed(1)} cells in radius brought home hauls of ${r.hauled.map(h => `${h.n} (${h.ash} of them ash)`).join(', ')} cells`);
  if (!loop) continue;
  // (About one cell in ten inside the loop is a tektite: fewer in the greatest flats.)
  check(loop.minerals >= loop.n * 0.05 && loop.minerals <= loop.n * 0.14, `${at}: ${loop.minerals} tektites in a haul of ${loop.n} cells`);
  check(loop.paid === loop.lump && loop.lump > 0, `${at}: the loop's haul paid ${loop.paid}, where its ${loop.minerals} tektites' lumps come to ${loop.lump}`);
  const ashen = r.hauled.reduce((sum, h) => sum + (h.ash === h.n ? h.minerals : 0), 0);
  check(Math.abs(r.game.S.spec[B.EMBER] - 0.2 * ashen) < 1e-6 && r.game.S.spec.every((s, kin) => kin === B.EMBER || s === 0), `${at}: ${ashen} tektites banked specimens ${r.game.S.spec}`);
  check(r.run > r.lap - 0.6 && r.pace > 12, `${at}: the loop took ${r.lap.toFixed(1)} s, the run was unbroken for ${r.run.toFixed(1)} s of it, and ${r.pace.toFixed(1)} cells were cut a second`);
  check(r.crushed > r.lap && r.said >= 1 && r.said <= Math.ceil(r.t) && r.said < r.crushed, `${at}: ${r.crushed} tektites were cut through in ${r.lap.toFixed(1)} s and CRUSHED came up ${r.said} times`);
  check(r.faults.length === 0, `${at}: the tether: ${r.faults.join('; ')}`);
  out.push({ name, at: [Z.cx - C, Z.cy - C], loop: +r.loop.toFixed(1), cells: loop.n, tektites: loop.minerals, crushed: r.crushed, said: r.said, seconds: +r.lap.toFixed(1), run: +r.run.toFixed(1), pace: +r.pace.toFixed(1) });
}
console.log(JSON.stringify(out));
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: a round loop ploughed through an ash flat closes and comes home in one haul that pays its tektites\' lumps, with the run unbroken all the way and the tether sound');
process.exit(fails.length ? 1 : 0);
