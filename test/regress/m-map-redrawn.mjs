// The map in the corner drawn again as it flies is the map drawn from nothing, and it asks the seed of a cell once.
//   - In a flight out of the core and through ground never made (seed 7, every row at its last, so the lens looks
//     at four cells a pixel), each time the map in the corner is drawn again its picture is, byte for byte, the
//     one drawn from nothing then: with what the world keeps of the seed's answers let go, and with the world asked
//     as it asks with nothing kept (World.biomeAt for a cell in no piece made). The chart likewise.
//   - What the seed says of a cell in no piece made is asked once (World.biomeKnown keeps it): the map drawn twice
//     over the same ground asks it nothing the second time, and asks again after `forget` (a game loaded) and for a
//     piece whose generation has changed. The world keeps no more than 256 pieces' worth of it, a byte a cell.
//   - The map asks for no list of the pockets visited a frame (they are counted as they are put down, Game.visit).
//   node test/regress/m-map-redrawn.mjs
import { makeGame, random, wander, farStart, UPGRADES, WORKS, MAPS, CORE, C } from '../harness.mjs';

const fails = [], check = (ok, what) => { if (!ok && fails.length < 20) fails.push(what); };
const game = await makeGame(7, { tether: 9, drill: 4 }), w = game.world;
for (const u of [...UPGRADES, ...WORKS, ...MAPS, ...CORE]) game.S.lv[u.id] = u.values.length - 1;
game.resize(360, 640, 1);
farStart(game, 0, -300);
check(game.val('maprange') >= 3 && game.val('maplens') > 0, 'the lens does not look at four cells a pixel at the last levels');

// The world as it answers with nothing kept, for the picture drawn from nothing.
const own = w.biomeKnown;
const plain = (x, y) => { const p = w.chunks[((y >> 6) << 8) | (x >> 6)]; return p ? p.biome[((y & 63) << 6) | (x & 63)] : w.biomeAt(x, y); };
const fromNothing = (M, draw) => {
  const kept = M.mapData.data.slice(), was = [M.mapFor, M.mapAt];
  w.biomeKnown = plain; M.mapFor = null;
  try { draw(); } finally { delete w.biomeKnown; }
  const made = M.mapData.data.slice();
  M.mapData.data.set(kept); [M.mapFor, M.mapAt] = was;
  return made;
};
const differ = (a, b) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; };
const corner = () => { const [mx, my] = game.mapRect; game.drawMap(mx + 3, my + 3); };

// ---- in flight: every picture drawn again is the picture drawn from nothing
let drawn = 0, worst = 0, keys = 0, frames = 0;
const keysOf = Object.keys;
Object.keys = function (o) { if (o === game.S.visited) keys++; return keysOf(o); };
for (const auto of wander(random(7), 40, -Math.PI / 2)) {
  game.input.auto = auto;
  game.update(1 / 60);
  const at = game.mapAt;
  game.render(); frames++;
  if (game.mapAt === at) continue;
  drawn++;
  const n = differ(game.mapData.data, fromNothing(game, corner));
  if (n) { worst = Math.max(worst, n); check(false, `frame ${frames}, the drill at ${Math.round(game.drill.x - C)},${Math.round(game.drill.y - C)}: the map drawn again differs from the map drawn from nothing in ${n} bytes`); }
}
Object.keys = keysOf;
check(drawn > 100, `the map was drawn again only ${drawn} times in ${frames} frames`);
check(game.world.made > 10 && w.seeded.size > 20, `the flight made ${game.world.made} pieces and the map asked the seed of cells in ${w.seeded.size} pieces not made: it did not fly by ground never made`);
check(keys <= 2, `the map asked for the list of pockets visited ${keys} times in ${frames} frames`);

// ---- the seed asked once
{
  let asked = 0;
  const seed = w.biomeAt;
  w.biomeAt = function (x, y) { asked++; return seed.call(this, x, y); };
  w.forget();
  game.mapFor = null; corner(); const first = asked;
  asked = 0; game.mapFor = null; corner(); const second = asked;
  check(first > 0 && second === 0, `the map drawn twice over the same ground asked the seed ${first} and then ${second} times`);
  // (Let go with `forget`, and for a piece whose generation has changed.)
  w.forget(); asked = 0; game.mapFor = null; corner();
  check(asked === first, `after forget the map asked the seed ${asked} times, not ${first}`);
  let id = -1;
  for (const m of w.seeded.values()) if (!w.chunks[m.id]) { id = m.id; break; }
  check(id >= 0, 'no piece unmade on the map');
  if (id >= 0) {
    const x = (id & 255) * 64 + 17, y = (id >> 8) * 64 + 40, was = w.genOf[id];
    w.genOf[id] = was === 1 ? 2 : 1;
    const now = own.call(w, x, y), truth = seed.call(w, x, y);
    check(now === truth, `with the generation of piece ${id} changed the world says ground ${now} of a cell the seed now lays as ${truth}`);
    w.genOf[id] = was;
    check(own.call(w, x, y) === seed.call(w, x, y), `with the generation of piece ${id} put back the world says other ground than the seed`);
  }
  w.biomeAt = seed;
}

// ---- the chart, drawn from nothing alike, and the world's keeping bounded
{
  game.openLab(true, 'chart');
  for (let f = 0; f < 3; f++) { game.update(1 / 60); game.render(); }
  const M = game.chartMap;
  check(M && game.chartRect, 'the chart is not open');
  if (M && game.chartRect) {
    const [x, y, size] = game.chartRect, view = game.chartView(), chart = () => game.drawMap(x, y, { size, per: game.chartBase / view.zoom, cx: view.x, cy: view.y });
    M.mapFor = null; chart();
    const n = differ(M.mapData.data, fromNothing(M, chart));
    check(!n, `the chart drawn with what the world keeps differs from the chart drawn from nothing in ${n} bytes`);
  }
  check(w.seeded.size <= 256, `the world keeps ${w.seeded.size} pieces' worth of what the seed says`);
  // (It keeps a byte a cell, 255 where the seed has not been asked: so there must be fewer grounds than that.)
  const { BIOMES } = await import('../../js/world.js');
  check(BIOMES.length < 255 && [...w.seeded.values()].every(m => m.b.BYTES_PER_ELEMENT === 1), `${BIOMES.length} grounds, kept in lists of ${[...w.seeded.values()][0]?.b.BYTES_PER_ELEMENT} bytes a cell`);
}

for (const f of fails) console.log(f);
console.log(fails.length ? `${fails.length} FAILED` : `ok: the map drawn again ${drawn} times in ${frames} frames of flight is the map drawn from nothing every time, the chart too, and the seed is asked of a cell once`);
process.exit(fails.length ? 1 : 0);
