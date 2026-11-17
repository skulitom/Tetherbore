// A game saved before the seams and the deep strains loads on the game as it is now, and its ground is brought up
// to today's rules where it was never seen (js/world.js: GEN, `genOf`, `migrate`; js/game.js: `restore`, `save`).
// test/fixtures/save-93ecb92-ne.json.gz is such a save, made by the game at commit 93ecb92 flown out along the
// north-east diagonal to 905 cells and across to 600,-300 (test/fixtures/old-save.mjs --north-east says how): what it
// kept in local storage and the pieces of world it had seen, each of which said its world and none its generation.
//   node test/regress/h-gen-save.mjs
// The rules of generation 2 are the game's own: the fixture's flight crosses the north-east seam, hoarstone, from
// where it begins about 470 cells out to 905, and its set piece. What is held is the way an old save is brought up:
//   - it loads, what was banked is as saved, and what an old save lacks is made (the generation it was played at,
//     the shrines, the fossils); it says NEW GROUND once;
//   - every cell it saw is as saved, kind and ground, and so is every cell it changed without seeing;
//   - every other cell of a piece a newer rule can reach is what generation 2 lays, and the piece is generation 2's
//     and to be saved; a piece no newer rule can reach (within 445 cells, or far off the diagonal) is as saved and
//     stays generation 1's;
//   - ground in pieces never saved is generation 2's: the seam, and the deep seam past it;
//   - a piece that does not say its world is judged by its own generation's rules (`World.strange`), and kept;
//   - the dens (js/fauna.js: `lay`) and the finder, which ask the seed, agree with the ground as it lies; and a den
//     whose middle the old game saw is of the ground it saw, kept as it was laid then (not the seam the seed lays
//     there now, whose roster and whose specimens it took);
//   - saved again it says its generation, and a second load brings up nothing and says nothing;
//   - and it plays, with the tether looked at after every frame;
//   - and a save that saw the cell where the north-east's shrine's heart now lies: the shrine is not laid (the heart
//     keeps its old ground, so it would be a sealed ring of stone round old rock, marked on the chart for good and
//     never hauled), no cell round its heart is a shrine's stone, the other three are laid, and loaded again it is
//     still not laid (`unshrined`, saved).
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { makeGame, random, tetherFaults, farStart, C, N, K, world } from '../harness.mjs';

const { World, GEN, CH, CW, MIGRATE_NEAR, SEAMS, rowOf } = world, problems = [], note = text => { if (problems.length < 16) problems.push(text); };
const save = JSON.parse(gunzipSync(readFileSync(new URL('../fixtures/save-93ecb92-ne.json.gz', import.meta.url))));
const bytes = text => Uint8Array.from(Buffer.from(text, 'base64'));
const saved = new Map(save.pieces.map(([id, kind, biome, seen]) => [id, { kind: bytes(kind), biome: bytes(biome), seen: bytes(seen) }]));
for (const p of saved.values()) for (let n = 0; n < CH * CH; n++) if ((p.biome[n] >= 9 && p.biome[n] <= 16) || (p.biome[n] >= 64 && p.biome[n] < 128)) { note(`the fixture holds ground ${p.biome[n]}, which an old game never laid`); break; }

// (What each migration took up, as [pieces, cells].)
const took = [], migrate = World.prototype.migrate;
World.prototype.migrate = function () { const r = migrate.call(this); took.push(r); return r; };

// What each generation lays in a piece, from a world of its own.
const lays = gen => { const w = new World(); w.reset(save.seed); w.genOf.fill(gen); return id => { const kind = new Uint8Array(CH * CH), biome = new Uint8Array(CH * CH); w.lay(id, kind, biome); return { kind, biome }; }; };
const lay1 = lays(1), lay2 = lays(2), first = new Map([...saved.keys()].map(id => [id, lay1(id)]));

// A database that holds pieces and keeps what the game puts in it (the harness's own refuses to open).
let rows;
const pieces = {
  put(value, id) { rows.set(id, { ...value, kind: Uint8Array.from(value.kind), biome: Uint8Array.from(value.biome), seen: Uint8Array.from(value.seen) }); },
  clear() { rows.clear(); }, delete(id) { rows.delete(id); },
  openCursor() {
    const request = {}, list = [...rows];
    let n = 0;
    const next = () => queueMicrotask(() => { request.result = n < list.length ? { key: list[n][0], value: list[n][1], continue() { n++; next(); } } : null; request.onsuccess?.(); });
    next();
    return request;
  },
};
globalThis.indexedDB = { open() { const request = {}; queueMicrotask(() => { request.result = { transaction: () => ({ objectStore: () => pieces }) }; request.onsuccess?.(); }); return request; } };
const settle = () => new Promise(done => setTimeout(done, 20));
// The old save as the old game left it: each piece with its world (as the fixture's maker checked each said), or
// with none, and no mark on the store either. (The game seldom changes a cell it has not seen, and the flight
// changed none: every 61st cell unseen in a piece past MIGRATE_NEAR is cut here, as a tunnel staged by hand cuts,
// so that what is changed unseen is there to be kept.)
for (const [id, p] of saved) {
  const x = (id % CW) * CH - C + 32, y = ((id / CW) | 0) * CH - C + 32;
  if (Math.hypot(x, y) > MIGRATE_NEAR) for (let n = 0; n < CH * CH; n += 61) if (!p.seen[n] && p.kind[n] !== K.EMPTY) p.kind[n] = K.EMPTY;
}
const fixture = said => new Map([...saved].map(([id, p]) => [id, { kind: Uint8Array.from(p.kind), biome: Uint8Array.from(p.biome), seen: Uint8Array.from(p.seen), ...(said ? { seed: save.seed } : {}) }]));
const pieceOf = (x, y) => (((C + y) >> 6) << 8) | ((C + x) >> 6);

// 1. Loaded.
rows = fixture(true);
localStorage.setItem('tetherbore-save-v3', save.local);
localStorage.removeItem('tetherbore-save-v3-latest');
const was = JSON.parse(save.local), game = await makeGame(1), w = game.world;
let loaded = false;
try { loaded = await game.restore(); } catch (error) { note(`restore threw: ${error.message}`); }
if (!loaded) note('the old save did not load');
const S = game.S;
// (Its four gems where they were, and the corners', which it had no places for, none.)
if (was.gems.length !== 5) note(`the old save banked ${was.gems.length} gems' places, not the four directions' and none`);
if (S.seed !== was.seed || S.grit !== was.grit || JSON.stringify(S.gems) !== JSON.stringify([...was.gems, 0, 0, 0, 0])) note(`what was banked is not as saved: seed ${S.seed}, grit ${S.grit}, gems ${S.gems}`);
if (S.gen !== GEN || JSON.stringify(S.shrines) !== '[0,0,0,0]' || S.fossils !== 0) note(`what an old save lacks was not made: gen ${S.gen}, shrines ${JSON.stringify(S.shrines)}, fossils ${S.fossils}`);
if (game.notice?.title !== 'NEW GROUND') note(`loaded, the game says ${JSON.stringify(game.notice?.title)}, not NEW GROUND`);

// 2. Cell by cell.
const newer = new Set([...saved.keys()].filter(id => w.newer(id)));
let seenKept = 0, changedKept = 0, laidAnew = 0, near = 0, off = 0, wrong = 0;
for (const [id, p] of saved) {
  const now = w.chunks[id], one = first.get(id), two = newer.has(id) ? lay2(id) : null;
  if (!now) { note(`saved piece ${id} was not loaded`); continue; }
  if (newer.has(id) ? w.genOf[id] !== GEN || !w.touched.has(id) : w.genOf[id] !== 1) note(`piece ${id} is generation ${w.genOf[id]}${w.touched.has(id) ? ', to be saved' : ''}`);
  if (!newer.has(id)) { const x = (id % CW) * CH - C, y = ((id / CW) | 0) * CH - C; if (Math.hypot(x + 32, y + 32) < MIGRATE_NEAR) near++; else off++; }
  for (let n = 0; n < CH * CH; n++) {
    const asSaved = now.kind[n] === p.kind[n] && now.biome[n] === p.biome[n], untouched = p.kind[n] === one.kind[n] && p.biome[n] === one.biome[n];
    let ok;
    if (p.seen[n]) { ok = asSaved; seenKept += newer.has(id); }
    else if (!untouched) { ok = asSaved; changedKept += newer.has(id); }
    else if (two) { ok = now.kind[n] === two.kind[n] && now.biome[n] === two.biome[n]; if (two.kind[n] !== one.kind[n] || two.biome[n] !== one.biome[n]) laidAnew++; }
    else ok = asSaved;
    if (!ok && wrong++ < 3) note(`piece ${id} cell ${n & 63},${n >> 6}: kind ${now.kind[n]} in ground ${now.biome[n]}, saved ${p.kind[n]} in ${p.biome[n]}${p.seen[n] ? ', seen' : ''}`);
  }
}
if (wrong) note(`${wrong} cells are not what they should be`);
// (The fixture must be worth loading: pieces of each kind, and much that was seen and much laid anew in those
// brought up.)
if (newer.size < 20 || near < 4 || off < 1 || seenKept < 4000 || changedKept < 50 || laidAnew < 10000) note(`the fixture is not what this test wants: ${newer.size} pieces brought up, ${near} within ${MIGRATE_NEAR} and ${off} off the diagonal left; ${seenKept} cells seen and ${changedKept} changed unseen kept, ${laidAnew} laid anew`);
if (took[0]?.[0] !== newer.size || took[0]?.[1] !== laidAnew) note(`the migration says it took up ${took[0]}, where ${newer.size} pieces and ${laidAnew} cells were`);

// 3. Ground never saved is generation 2's: on the diagonal past the flight, the seam and the deep seam.
let beyond = 0;
for (const [x, y] of [[720, -720], [850, -850], [1000, -1000], [1200, -1200], [1500, -1500]]) {
  const id = pieceOf(x, y);
  if (saved.has(id)) { note(`${x},${y} lies in a saved piece`); continue; }
  const p = w.piece(id), two = lay2(id), one = lay1(id);
  if (p.kind.some((k, n) => k !== two.kind[n]) || p.biome.some((b, n) => b !== two.biome[n])) note(`the piece at ${x},${y}, never saved, is not generation 2's ground`);
  if (one.biome.some((b, n) => b !== two.biome[n]) && p.biome.some(b => b === SEAMS[0][0] || b === SEAMS[0][1])) beyond++;
}
if (beyond < 5) note(`only ${beyond} of 5 pieces never saved on the diagonal are the seam's, where generation 1 lays other ground`);

// 4. The dens and the finder ask the seed: where a cell holds what its own generation laid there and is unseen,
// they agree with it. (Every den's and every find's middle in the saved pieces.)
const agrees = (x, y) => { const i = y * N + x; return w.biomeAt(x, y) === w.b(i) && w.kindAt(x, y, w.biomeAt(x, y)) === w.k(i); };
const plainCell = (x, y) => {
  const id = ((y >> 6) << 8) | (x >> 6), p = saved.get(id), at = ((y & 63) << 6) | (x & 63), one = first.get(id);
  return p && !p.seen[at] && p.kind[at] === one.kind[at] && p.biome[at] === one.biome[at];
};
let dens = 0, finds = 0, cells = 0;
for (const [id] of saved) {
  const x0 = (id % CW) * CH, y0 = ((id / CW) | 0) * CH;
  for (let n = 0; n < CH * CH; n += 7) { const x = x0 + (n & 63), y = y0 + (n >> 6); if (plainCell(x, y)) { cells++; if (!agrees(x, y)) { note(`the seed's ground at ${x - C},${y - C} is not the ground as it lies`); break; } } }
}
for (let sy = -20; sy <= 0; sy++) for (let sx = 0; sx <= 20; sx++) {
  const d = { grid: 0, sx, sy, kind: 0 };
  game.fauna.lay(game, d);
  if (d.kind && plainCell(d.mx, d.my)) { dens++; if (d.row !== w.b(d.my * N + d.mx)) note(`the den at ${d.mx - C},${d.my - C} is of ground ${d.row}, where the ground is ${w.b(d.my * N + d.mx)}`); }
  const what = w.findName(sx, sy), fx = w.asked.fx, fy = w.asked.fy;
  if (what !== null && plainCell(fx, fy)) { finds++; if (w.kindAt(fx, fy, w.biomeAt(fx, fy)) !== w.k(fy * N + fx)) note(`the finder's ${what} at ${fx - C},${fy - C} is not what lies there`); }
}
if (cells < 10000 || dens < 5 || finds < 5) note(`too little was asked: ${cells} cells, ${dens} dens, ${finds} finds`);
// (And the dens whose middle the old game saw, in the pieces brought up: of the ground that lies there.)
let seenDens = 0;
for (const grid of [0, 1]) for (let sy = -60; sy <= 0; sy++) for (let sx = 0; sx <= 60; sx++) {
  const d = { grid, sx, sy, kind: 0 };
  game.fauna.lay(game, d);
  const id = ((d.my >> 6) << 8) | (d.mx >> 6), p = saved.get(id);
  if (!d.kind || !p || !newer.has(id) || !p.seen[((d.my & 63) << 6) | (d.mx & 63)]) continue;
  seenDens++;
  if (d.row !== w.b(d.my * N + d.mx)) note(`the den at ${d.mx - C},${d.my - C}, on ground the old game saw, is of ground ${d.row}, where the ground is ${w.b(d.my * N + d.mx)}`);
}
if (seenDens < 10) note(`only ${seenDens} dens lie on ground the old game saw`);

// 5. Saved again, each piece says its generation; a second load brings up nothing, and says nothing.
const after = new Map([...w.chunks.entries()].filter(([, p]) => p).map(([id, p]) => [id, { kind: p.kind.slice(), biome: p.biome.slice() }]));
game.save();
await settle();
for (const id of newer) if (rows.get(id)?.gen !== GEN) { note(`piece ${id}, brought up, was saved as generation ${rows.get(id)?.gen}`); break; }
for (const id of saved.keys()) if (!newer.has(id) && (rows.get(id)?.gen ?? 1) !== 1) { note(`piece ${id}, left, is saved as generation ${rows.get(id)?.gen}`); break; }
if (!(await game.restore())) note('the game did not load again');
if (took[1]?.[0] !== 0 || took[1]?.[1] !== 0) note(`the second load took up ${took[1]}`);
if (game.notice?.title === 'NEW GROUND') note('the second load says NEW GROUND again');
for (const [id, p] of after) { const now = game.world.chunks[id]; if (saved.has(id) && (!now || now.kind.some((k, n) => k !== p.kind[n]) || now.biome.some((b, n) => b !== p.biome[n]))) { note(`piece ${id} came back otherwise`); break; } }

// 6. A save whose pieces do not say their world, in a store with no mark: each is judged by its own generation's
// rules, and kept (by today's, the ground near the diagonal is the other direction's: another world's). And a piece
// of the north-east's flank put down in the south-west is another world's: thrown out, and made afresh by today's
// rules.
{
  rows = fixture(false);
  const foreign = pieceOf(-400, 400);
  rows.set(foreign, { ...rows.get(pieceOf(640, -640)) });
  localStorage.setItem('tetherbore-save-v3', save.local);
  localStorage.removeItem('tetherbore-save-v3-latest');
  const other = await makeGame(1);
  if (!(await other.restore())) note('the save with pieces that do not say their world did not load');
  const kept = [...saved.keys()].filter(id => other.world.chunks[id]).length;
  if (other.thrownOut !== 1 || kept !== saved.size) note(`${other.thrownOut} pieces were thrown out as another world's, ${kept} of ${saved.size} kept`);
  if (other.world.genOf[foreign] !== GEN) note(`the piece thrown out is made afresh by generation ${other.world.genOf[foreign]}'s rules`);
  if (took[2]?.[0] !== newer.size) note(`judged, the save brought up ${took[2]?.[0]} pieces, not ${newer.size}`);
}

// 7. And it plays, from a start at the far end of the flight, out into ground laid anew.
let frames = 0;
try {
  rows = fixture(true);
  localStorage.setItem('tetherbore-save-v3', save.local);
  localStorage.removeItem('tetherbore-save-v3-latest');
  if (!(await game.restore())) note('the game did not load for the flight');
  farStart(game, 640, -640);
  const rnd = random(11);
  let heading = -0.8;
  for (let turn = 0; turn < 40 && problems.length === 0; turn++) {
    heading += (rnd() - 0.5) * 2.5;
    for (let f = 10 + Math.floor(rnd() * 50); f > 0; f--) {
      game.input.auto = [Math.cos(heading), Math.sin(heading), 1];
      game.update(1 / 60); frames++;
      if (frames % 7 === 0) game.render();
      const faults = tetherFaults(game);
      if (faults.length) { note(`frame ${frames}: ${faults[0]}`); break; }
    }
    if (!Number.isFinite(game.S.grit) || game.S.grit < 0) { note(`grit ${game.S.grit}`); break; }
  }
  game.input.auto = null;
  for (let f = 0; f < 1200 && game.hauls.length; f++) game.update(1 / 60);
  if (game.hauls.length) note(`${game.hauls.length} hauls never came home`);
} catch (error) { note(`threw: ${error.stack.split('\n').slice(0, 4).join(' | ')}`); }

// 8. A save that saw the north-east's shrine's heart (a piece the old game laid round it, nine cells round the heart
// seen): the shrine is not laid, and stays so.
let unshrined = '';
{
  const [sx, sy] = world.SHRINES[0], hx = C + sx, hy = C + sy, id = ((hy >> 6) << 8) | (hx >> 6), at = (x, y) => ((y & 63) << 6) | (x & 63);
  const one = lay1(id), seen = new Uint8Array(CH * CH);
  for (let y = hy - 1; y <= hy + 1; y++) for (let x = hx - 1; x <= hx + 1; x++) seen[at(x, y)] = 1;
  rows = fixture(true);
  rows.set(id, { kind: one.kind.slice(), biome: one.biome.slice(), seen, seed: save.seed });
  localStorage.setItem('tetherbore-save-v3', save.local);
  localStorage.removeItem('tetherbore-save-v3-latest');
  const far = await makeGame(1);
  if (!(await far.restore())) note('the save that saw the shrine did not load');
  const ring = () => { let n = 0; for (let y = hy - 5; y <= hy + 5; y++) for (let x = hx - 5; x <= hx + 5; x++) { const k = far.world.k(y * N + x); if ((k === K.VAULT || k === K.RELIC) && k !== one.kind[at(x, y)]) n++; } return n; };
  const v = far.world;
  if (v.shrine(0) || far.S.unshrined !== 1 || ![1, 2, 3].every(d => v.shrine(d)) || ring()) note(`the shrine whose heart the old game saw: laid ${v.shrine(0)}, unshrined ${far.S.unshrined}, the others laid ${[1, 2, 3].map(d => v.shrine(d))}, ${ring()} cells of a shrine's stone round its heart`);
  far.save();
  await settle();
  if (!(await far.restore())) note('the save that saw the shrine did not load again');
  if (far.world.shrine(0) || far.S.unshrined !== 1 || ring()) note(`loaded again, the shrine whose heart the old game saw is laid ${far.world.shrine(0)} (unshrined ${far.S.unshrined}), with ${ring()} cells of its stone`);
  unshrined = '; a shrine whose heart was seen is not laid, and stays so';
}

if (problems.length) { console.log('PROBLEMS\n' + problems.join('\n')); process.exit(1); }
console.log(`ok: ${saved.size} old pieces, ${newer.size} brought up with ${laidAnew} cells laid anew and ${seenKept} seen and ${changedKept} changed kept, ${near + off} left as saved; ${dens} dens and ${finds} finds agree, and ${seenDens} dens on seen ground; loaded again, nothing taken up; ${frames} frames flown${unshrined}`);
