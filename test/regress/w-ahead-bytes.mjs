// A piece of world laid ahead of need (js/world.js: `ahead`, `hold`, `layHeld`, and `lay` giving a held piece up)
// is the piece the seed lays, byte for byte, and nothing laid ahead outlives what it was laid by.
//   - Every piece tools/world-hash.mjs records (seeds 1, 7 and 123456, by generation 1's rules and by today's), and
//     a grid of pieces every fourth piece each way over the whole world of seeds 7, 19 and 23 at generation 1 and at
//     2, are laid by `lay` in one world and in another laid ahead: held 24 at a time, 8 rows of each in turn for
//     three turns, and then made (`piece`) in the other order, the rows left of each laid as it is made, while the
//     others are held in part. Kind and ground are the same in every cell, and `made` goes as it does.
//   - Pieces held, then the world begun again (`reset`), its records asked again (`forget`), an older game's
//     ground brought up (`migrate`), and an old save loaded (test/fixtures/save-93ecb92-ne.json.gz, staged as
//     h-gen-save stages it, with pieces of its world held by today's rules first): nothing is held after any.
//   - Laying ahead finds the nearest piece not made nor held whole within AHEAD_REACH of a cell, lays AHEAD_ROWS
//     of it a call, and holds AHEAD_MOST at the most, letting the furthest go; and laying ahead, which makes nothing
//     of the world's, leaves `chunks` and `made` alone.
// It fails if a held piece were laid by other rows or another slab than `lay` lays it by, if `lay` did not finish
// it, or if anything held were kept over a change of seed or generation.
//   node test/regress/w-ahead-bytes.mjs
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { makeGame, world } from '../harness.mjs';
import { places, GEN2_PLACES } from '../../tools/world-hash.mjs';

const { World, C, CH, CW, AHEAD_REACH, AHEAD_MOST, AHEAD_ROWS } = world, fails = [], check = (ok, what) => { if (!ok && fails.length < 20) fails.push(what); };
const idOf = (dx, dy) => (((C + dy) >> 6) << 8) | ((C + dx) >> 6);
const same = (a, b) => { for (let n = 0; n < CH * CH; n++) if (a.kind[n] !== b.kind[n] || a.biome[n] !== b.biome[n]) return n; return -1; };

// ---- (a) the bytes
let compared = 0, partly = 0;
function compare(seed, gen, ids, what) {
  const R = new World(), H = new World();
  for (const w of [R, H]) { w.reset(seed); w.genOf.fill(gen); }
  for (let at = 0; at < ids.length; at += AHEAD_MOST) {
    const batch = ids.slice(at, at + AHEAD_MOST).filter((id, n, a) => a.indexOf(id) === n && !H.chunks[id]);
    for (let turn = 0; turn < 3; turn++) for (const id of batch) { const h = H.heldOf(id) ?? H.hold(id, C, C); H.layHeld(h, Math.min(CH, h.rows + 8)); }
    check(H.heldN === batch.length, `${what}: ${H.heldN} pieces held of ${batch.length}`);
    for (const id of [...batch].reverse()) {
      partly += H.heldOf(id)?.rows < CH ? 1 : 0;
      const a = R.piece(id), b = H.piece(id), n = same(a, b);
      compared++;
      check(n < 0, `${what}, seed ${seed} generation ${gen}: piece ${id % CW - C / CH},${((id / CW) | 0) - C / CH} laid ahead differs at cell ${n} (kind ${b.kind[n]} for ${a.kind[n]}, ground ${b.biome[n]} for ${a.biome[n]})`);
      check(H.heldOf(id) === null, `${what}: piece ${id} still held once made`);
    }
    check(R.made === H.made, `${what}: ${H.made} pieces made laying ahead, ${R.made} without`);
  }
  check(H.heldN === 0, `${what}: ${H.heldN} held at the end`);
}
for (const seed of [1, 7, 123456]) {
  compare(seed, 1, places().map(([, dx, dy]) => idOf(dx, dy)), 'world-hash');
  compare(seed, 2, GEN2_PLACES().map(([, dx, dy]) => idOf(dx, dy)), 'world-hash');
}
const grid = [];
for (let py = 90; py <= 166; py += 4) for (let px = 90; px <= 166; px += 4) grid.push((py << 8) | px);
for (const seed of [7, 19, 23]) for (const gen of [1, 2]) compare(seed, gen, grid, 'the grid');

// ---- the choosing, the cap and the world left alone
{
  const w = new World();
  w.reset(7);
  const x = C + 300.5, y = C - 500.25, cx = Math.floor(x), cy = Math.floor(y), near = id => {
    const px = (id % CW) * CH, py = ((id / CW) | 0) * CH;
    return Math.max(px - cx, 0, cx - (px + CH - 1), py - cy, 0, cy - (py + CH - 1));
  };
  // (The pieces within reach, nearest first in the order they are scanned.)
  const want = [];
  for (let py = (cy - AHEAD_REACH) >> 6; py <= (cy + AHEAD_REACH) >> 6; py++) for (let px = (cx - AHEAD_REACH) >> 6; px <= (cx + AHEAD_REACH) >> 6; px++) {
    const id = (py << 8) | px; if (near(id) <= AHEAD_REACH) want.push(id);
  }
  const order = want.map((id, n) => [id, near(id), n]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(([id]) => id);
  const got = [];
  let calls = 0;
  for (;;) {
    const before = w.holding.map(h => h.id + ':' + h.rows).join(), rows = w.ahead(x, y, AHEAD_ROWS);
    if (!rows) break;
    calls++;
    check(rows === AHEAD_ROWS, `a call laid ${rows} rows, not ${AHEAD_ROWS}`);
    const h = w.holding.find((g, n) => g.id >= 0 && before.split(',')[n] !== g.id + ':' + g.rows);
    if (h && h.rows === AHEAD_ROWS) got.push(h.id);
  }
  check(JSON.stringify(got) === JSON.stringify(order), `pieces begun ahead in the order ${got.join(' ')}, not nearest first ${order.join(' ')}`);
  check(calls === order.length * CH / AHEAD_ROWS, `${calls} calls laid every piece within reach whole, not ${order.length * CH / AHEAD_ROWS}`);
  check(w.made === 0 && w.chunks.every(p => !p), 'laying ahead made a piece of the world');
  check(w.aheadRows === order.length * CH, `${w.aheadRows} rows laid ahead, not ${order.length * CH}`);
  // Further on, the pieces left behind make room: never more than AHEAD_MOST held, the furthest let go first.
  for (let step = 1; step <= 12; step++) {
    const fx = x + step * 64;
    for (let n = 0; n < 40; n++) w.ahead(fx, y, AHEAD_ROWS);
    check(w.heldN <= AHEAD_MOST, `${w.heldN} pieces held`);
    const ids = w.holding.filter(h => h.id >= 0).map(h => h.id), furthest = Math.max(...ids.map(id => {
      const px = (id % CW) * CH; return Math.max(px - Math.floor(fx), Math.floor(fx) - (px + CH - 1));
    }));
    check(furthest <= AHEAD_REACH + 6 * CH, `a piece ${furthest} cells away is still held at step ${step}`);
  }
  check(w.heldN === AHEAD_MOST, `${w.heldN} held after a long way, not the most, ${AHEAD_MOST}`);
  // (Each place's bytes are made once and kept.)
  const buffers = new Set(w.holding.map(h => h.kind));
  for (let n = 0; n < 200; n++) w.ahead(x + 900 + n * 8, y, AHEAD_ROWS);
  check(w.holding.every(h => buffers.has(h.kind)), 'a place to hold a piece in was given new bytes');
}

// ---- (c) nothing held outlives what it was laid by
{
  const w = new World(), fill = () => { for (let n = 0; n < 40; n++) w.ahead(C + 200, C - 700, AHEAD_ROWS); return w.heldN; };
  w.reset(7);
  check(fill() > 0, 'nothing was held to let go');
  w.reset(8);
  check(w.heldN === 0 && w.holding.every(h => h.id < 0), `${w.heldN} pieces held after reset`);
  check(fill() > 0, 'nothing was held to let go');
  w.forget();
  check(w.heldN === 0 && w.holding.every(h => h.id < 0), `${w.heldN} pieces held after forget`);
  fill();
  w.piece(idOf(200, -700)); w.genOf[idOf(200, -700)] = 1;
  w.migrate();
  check(w.heldN === 0 && w.holding.every(h => h.id < 0), `${w.heldN} pieces held after migrate`);
}
{
  // An old save loaded, as h-gen-save stages it, over a world of its seed with its pieces held by today's rules.
  const save = JSON.parse(gunzipSync(readFileSync(new URL('../fixtures/save-93ecb92-ne.json.gz', import.meta.url))));
  const bytes = text => Uint8Array.from(Buffer.from(text, 'base64'));
  const rows = new Map(save.pieces.map(([id, kind, biome, seen]) => [id, { kind: bytes(kind), biome: bytes(biome), seen: bytes(seen), seed: save.seed }]));
  const pieces = {
    put() {}, clear() {}, delete() {},
    openCursor() {
      const request = {}, list = [...rows];
      let n = 0;
      const next = () => queueMicrotask(() => { request.result = n < list.length ? { key: list[n][0], value: list[n][1], continue() { n++; next(); } } : null; request.onsuccess?.(); });
      next();
      return request;
    },
  };
  globalThis.indexedDB = { open() { const request = {}; queueMicrotask(() => { request.result = { transaction: () => ({ objectStore: () => pieces }) }; request.onsuccess?.(); }); return request; } };
  localStorage.setItem('tetherbore-save-v3', save.local);
  localStorage.removeItem('tetherbore-save-v3-latest');
  const game = await makeGame(1), w = game.world;
  w.reset(save.seed);
  const ids = [...rows.keys()].sort((a, b) => a - b);
  for (const id of ids.slice(0, AHEAD_MOST)) { const h = w.hold(id, (id % CW) * CH, ((id / CW) | 0) * CH); w.layHeld(h, CH); }
  check(w.heldN === Math.min(AHEAD_MOST, ids.length), `${w.heldN} of the save's pieces held before it was loaded`);
  const loaded = await game.restore();
  check(loaded, 'the old save did not load');
  check(w.heldN === 0 && w.holding.every(h => h.id < 0), `${w.heldN} pieces held after an old save was loaded`);
  // (And what is laid there now is the generation-1 ground the save keeps, where nothing was seen and no newer rule
  // reaches: a piece made after it is the seed's by its own generation's rules.)
  const fresh = new World();
  fresh.reset(save.seed); fresh.genOf.set(w.genOf); fresh.unshrined = w.unshrined; fresh.forget();
  let made = 0;
  for (const id of ids.slice(0, 64).map(id => id + 2)) if (!w.chunks[id] && !rows.has(id)) {
    const a = w.piece(id), b = fresh.piece(id), n = same(a, b);
    made++;
    check(n < 0, `piece ${id} made after the old save loaded differs from the seed's at cell ${n}`);
  }
  check(made > 0, 'no piece was made after the old save loaded');
}

// ---- and the game lays ahead: js/main.js, after a frame with time to spare, and nothing else in the game.
{
  const main = readFileSync(new URL('../../js/main.js', import.meta.url), 'utf8');
  check(/if \(t2 - t0 < AHEAD_UNDER && !game\.loading\) game\.world\.ahead\(game\.drill\.x, game\.drill\.y, AHEAD_ROWS\)/.test(main), 'js/main.js no longer lays ahead after a frame with time to spare');
  for (const name of ['game', 'drawing', 'fauna', 'bosses', 'feel', 'fit', 'shot', 'world']) {
    const text = readFileSync(new URL(`../../js/${name}.js`, import.meta.url), 'utf8');
    check(!/\.ahead\(/.test(text.replace(/^\s*\/\/.*$/gm, '')), `js/${name}.js lays ahead`);
  }
}

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : `no defect: ${compared} pieces laid ahead in slices of 8 rows (${partly} held in part as they were made) are the bytes lay() lays, nearest first within ${AHEAD_REACH} cells, ${AHEAD_MOST} held at the most in bytes made once, and nothing held outlives a reset, forget, migrate or an old save loaded`);
process.exit(fails.length ? 1 : 0);
