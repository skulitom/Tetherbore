// A druse rings (js/game.js: `resonant`, `haul`). On world 7, the nearest geode lying in a druse (a row whose
// `geodes` is set) with four geodes or more round it, hauled whole by hand:
//   - every geode in a sector of finds within two sectors of it (96 cells) is shown, out to its shell, and none
//     further; the banner says how many rang under its title;
//   - called out, each is marked on the map, and a mark goes once its geode is got to (hauled: m-map-gone);
//   - two druse geodes in one haul ring once; and with the map's marks full of things still standing, the geodes
//     they ring take no mark from any of them (they took one each, the oldest first: half the map at a stroke);
//   - a geode hauled in gilt, the flank the druse is a strain of, rings nothing: no geode round it is shown, and the
//     banner says nothing of it.
// Fails on the game before a druse rang: nothing round the geode is shown, and the banner says nothing.
//   node test/regress/m-druse-ring.mjs
import { makeGame, world, C, N } from '../harness.mjs';
import { fixRandom } from './lib/lasso.mjs';
const { K, FIND, rowOf } = world;

const fails = [], check = (ok, what) => { if (!ok && fails.length < 20) fails.push(what); };
fixRandom(5);
const game = await makeGame(7, { tether: 9 }), w = game.world, S = game.S;
// The geodes of world 7, nearest first, in a ground whose finds are geodes and in gilt.
const geodes = [];
for (let sy = -48; sy < 48; sy++) for (let sx = -48; sx < 48; sx++) {
  const [what, fx, fy, size] = w.findSpot(sx, sy);
  if (what !== 'geode') continue;
  const row = rowOf(w.biomeAt(fx, fy));
  if (!row.geodes && row.id !== 8) continue;
  const round = [];
  for (let v = -2; v <= 2; v++) for (let u = -2; u <= 2; u++) if (u || v) { const [o, gx, gy, gs] = w.findSpot(sx + u, sy + v); if (o === 'geode') round.push([gx, gy, gs]); }
  geodes.push({ sx, sy, fx, fy, size, row, round, far: Math.hypot(fx - C, fy - C) });
}
geodes.sort((a, b) => a.far - b.far);
const druse = geodes.find(g => g.row.geodes && g.round.length >= 4), gilt = geodes.find(g => !g.row.geodes && g.round.length >= 2 && g.round.every(([gx, gy]) => Math.hypot(gx - druse.fx, gy - druse.fy) > 200));
check(druse && gilt, `world 7 has no druse geode with four round it (${!!druse}) or gilt geode with two (${!!gilt})`);
const cellsOf = g => { const out = []; for (let y = g.fy - g.size; y <= g.fy + g.size; y++) for (let x = g.fx - g.size; x <= g.fx + g.size; x++) if ((x - g.fx) ** 2 + (y - g.fy) ** 2 <= g.size * g.size && w.at(x, y) !== K.EMPTY) out.push(y * N + x); return out; };
const shown = g => g.round.filter(([gx, gy, gs]) => { for (let b = -gs; b <= gs; b++) for (let a = -gs; a <= gs; a++) if (a * a + b * b <= gs * gs && w.peek(gx + a, gy + b) < 0) return false; return true; }).length;
// (The cells seen within 110 of a geode but its own, which its haul shows.)
const seenNear = g => { let n = 0; for (let y = g.fy - 110; y <= g.fy + 110; y++) for (let x = g.fx - 110; x <= g.fx + 110; x++) if (w.peek(x, y) >= 0 && (x - g.fx) ** 2 + (y - g.fy) ** 2 > (g.size + 1) ** 2) n++; return n; };

if (druse && gilt) {
  // A gilt geode first: nothing rings.
  const before = seenNear(gilt), cells = cellsOf(gilt);
  check(cells.some(i => w.k(i) === K.SLATE), 'the gilt geode has no shell');
  game.haul(cells);
  check(game.hauled.sub === null && seenNear(gilt) === before + 0 && shown(gilt) === 0, `a gilt geode hauled: '${game.hauled.sub}', ${seenNear(gilt) - before} cells round it seen, ${shown(gilt)} geodes shown`);
  // The druse's: every geode within two sectors is shown, out to its shell.
  const seen0 = seenNear(druse);
  game.haul(cellsOf(druse));
  const n = druse.round.length, sub = game.hauled.sub;
  check(sub === `${n} GEODES RING`, `the druse's geode hauled says '${sub}', with ${n} geodes round it`);
  check(shown(druse) === n, `${shown(druse)} of the ${n} geodes round it are shown`);
  const far = []; for (let v = -3; v <= 3; v++) for (let u = -3; u <= 3; u++) if (Math.max(Math.abs(u), Math.abs(v)) === 3) { const [o, gx, gy] = w.findSpot(druse.sx + u, druse.sy + v); if (o === 'geode') far.push([gx, gy]); }
  check(far.every(([gx, gy]) => w.peek(gx, gy) < 0), 'a geode three sectors off was shown');
  check(seenNear(druse) - seen0 < n * 60, `${seenNear(druse) - seen0} cells were shown for ${n} geodes`);
  // Called out, they are marked; one hauled, its mark goes.
  S.marks.length = 0;
  game.callOut();
  const marked = S.marks.filter(m => m[1] === K.SLATE || m[1] === K.ORE_B).length;
  check(marked >= Math.min(n, 24), `${marked} of the ${n} geodes that rang are marked on the map`);
  const first = druse.round[0], fg = { fx: first[0], fy: first[1], size: first[2] }, own = cellsOf(fg), was = S.marks.length;
  game.haul(own);
  game.changed();
  check(S.marks.length === was - 1 && !S.marks.some(m => own.includes(m[0])), `a geode that rang, hauled: the map still marks ${S.marks.length} of ${was}`);
  // Two druse geodes in one haul ring once.
  const pair = geodes.filter(g => g.row.geodes && g !== druse && Math.hypot(g.fx - druse.fx, g.fy - druse.fy) > 300).slice(0, 2);
  const rings = game.rings.length, standing = [];
  for (let y = C - 30; y <= C + 30 && standing.length < 24; y += 3) for (let x = C - 30; x <= C + 30 && standing.length < 24; x += 5) { const i = y * N + x; if (w.k(i) !== K.EMPTY) standing.push([i, w.k(i), '#ffe14a']); }
  S.marks = standing.map(m => m.slice());
  game.haul([...cellsOf(pair[0]), ...cellsOf(pair[1])]);
  check(/^\d+ GEODES? RINGS?$/.test(game.hauled.sub ?? '') && game.rings.length - rings <= 4, `two druse geodes in one haul: '${game.hauled.sub}', ${game.rings.length - rings} rings`);
  game.callOut();
  const kept = standing.filter(([i]) => S.marks.some(m => m[0] === i)).length;
  check(game.hauled.sub && kept === 24 && S.marks.length === 24, `with the map's marks full, the geodes a haul rang left ${kept} of 24 marks of things standing (${S.marks.length} marks)`);
}
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: a geode hauled in a druse rings the geodes within two sectors, which the map marks until they are got to; a gilt geode rings nothing');
process.exit(fails.length ? 1 : 0);
