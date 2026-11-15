// A game saved before the content build loads on the game as it is (docs/CONTENT-PLAN.md, section 5 and open
// question 5). test/fixtures/save-4293f7c.json.gz is such a save, made by the game at commit 4293f7c
// (test/fixtures/old-save.mjs says how): what it kept in local storage and the pieces of world it had seen.
//   node test/regress/h-old-save.mjs
// Held here:
//   - it loads, and what was bought and banked is as saved; what a save of that day lacks is made (specimens, the
//     grounds met, the map's dots, the pockets visited);
//   - ground that was seen is as it was saved, cell for cell, kind and ground: where the first keystone slab and
//     the north's first pocket lie in a new world, an old one has the plain ground it always had, the map marks
//     neither, and the place a cell there is in is its old ground's;
//   - beyond what was seen the world is the new one: the east's and the south's first pockets are whole, pips mark
//     them, and strains lie further out;
//   - a pocket that lies half in seen ground is cut off at the edge of it (the plan's default) and nothing minds:
//     the drill is flown in the old pocket's place, at the cut edge of a drift and in a whole new pocket, with the
//     tether looked at after every frame and the screen drawn, and the game is saved and loaded again each time.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { makeGame, random, tetherFaults, UPGRADES, C, N, K, world } from '../harness.mjs';

const { BIOMES, rowOf } = world, problems = [], note = text => { if (problems.length < 16) problems.push(text); };
const save = JSON.parse(gunzipSync(readFileSync(new URL('../fixtures/save-4293f7c.json.gz', import.meta.url))));
const bytes = text => Uint8Array.from(Buffer.from(text, 'base64'));
const saved = new Map(save.pieces.map(([id, kind, biome, seen]) => [id, { kind: bytes(kind), biome: bytes(biome), seen: bytes(seen) }]));
// A database that holds the saved pieces and keeps what the game puts in it (the harness's own refuses to open).
const rows = new Map([...saved].map(([id, p]) => [id, { kind: Uint8Array.from(p.kind), biome: Uint8Array.from(p.biome), seen: Uint8Array.from(p.seen) }]));
const pieces = {
  put(value, id) { rows.set(id, { kind: Uint8Array.from(value.kind), biome: Uint8Array.from(value.biome), seen: Uint8Array.from(value.seen) }); },
  clear() { rows.clear(); },
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

const was = JSON.parse(save.local), game = await makeGame(1), w = game.world;
const pieceOf = (x, y) => (((C + y) >> 6) << 8) | ((C + x) >> 6), cell = (x, y) => (C + y) * N + C + x;
let loaded = false;
try { loaded = await game.restore(); } catch (error) { note(`restore threw: ${error.message}`); }
if (!loaded) note('the old save did not load');
const S = game.S;

// 1. What was bought and banked, and what an old save lacks. (Every level it had it has; the hull, which it had
// not, is at its first.)
if (S.seed !== was.seed || S.grit !== was.grit || Object.keys(was.lv).some(id => S.lv[id] !== was.lv[id]) || S.lv.hull !== 0 || JSON.stringify(S.gems) !== JSON.stringify(was.gems)) note(`what was banked is not as saved: seed ${S.seed}, grit ${S.grit}, levels ${JSON.stringify(S.lv)}`);
for (const u of UPGRADES) if (!(S.lv[u.id] >= 0)) note(`no level of ${u.id}`);
if (JSON.stringify(S.spec) !== '[0,0,0,0,0]' || !Array.isArray(S.marks) || typeof S.visited !== 'object' || !S.met || !S.met[0]) note(`what the old save lacks was not made: spec ${JSON.stringify(S.spec)}, marks ${JSON.stringify(S.marks)}, visited ${JSON.stringify(S.visited)}, met ${JSON.stringify(S.met)}`);

// 2. Seen ground is as it was saved, and holds nothing the old game did not know.
const same = when => {
  let moved = 0;
  for (const [id, p] of saved) {
    const now = w.chunks[id];
    if (!now) { moved++; continue; }
    for (let n = 0; n < 4096; n++) if (now.kind[n] !== p.kind[n] || now.biome[n] !== p.biome[n] || (p.seen[n] && !now.seen[n])) { moved++; break; }
  }
  if (moved) note(`${moved} of ${saved.size} saved pieces are not as they were saved, ${when}`);
};
same('once loaded');
for (const p of saved.values()) for (let n = 0; n < 4096; n++) if (p.kind[n] > 14 || p.biome[n] > 8) { note(`the fixture holds kind ${p.kind[n]} in ground ${p.biome[n]}: not an old save`); break; }
game.input.auto = null;
for (let f = 0; f < 120; f++) { game.update(1 / 60); if (f % 10 === 0) game.render(); }
same('after two seconds of the game');

// 3. Where a new world has the first slab and the north's first pocket, the old one has its own ground still.
const slab = w.firstSlab, north = w.zoneOf(0, -2), east = w.zoneOf(1, 0), south = w.zoneOf(-1, 1), half = w.pocketOf(C + 174, C - 78);
if (!slab || !saved.has(pieceOf(slab.cx - C, slab.cy - C))) note('the first slab of a new world 7 does not lie in seen ground: the fixture is not what this test wants');
else {
  if (slab.keys.some(i => w.k(i) === K.KEY)) note('a keystone lies in ground the old game had seen');
  if (game.firstRing()) note('the map rings a first slab that an old world does not have');
}
if (!north || !saved.has(pieceOf(north.cx - C, north.cy - C))) note('the north\'s first pocket does not lie in seen ground: the fixture is not what this test wants');
else {
  const i = cell(north.cx - C, north.cy - C), here = game.placeAt(i);
  if (w.b(i) > 8 || rowOf(w.b(i)).pocket) note(`the cell at the middle of the north's first pocket is ground ${w.b(i)}: it was saved as old ground`);
  if (here.zone || here.key !== w.b(i)) note(`the place there is ${JSON.stringify(here.key)}, not its old ground's`);
}
// 4. Beyond what was seen, the new world: whole pockets with pips, and strains.
for (const [Z, what] of [[east, 'east'], [south, 'south']]) {
  if (!Z || saved.has(pieceOf(Z.cx - C, Z.cy - C))) { note(`the ${what}'s first pocket lies in seen ground: the fixture is not what this test wants`); continue; }
  let own = 0, mineral = 0;
  for (let y = Z.cy - 12; y <= Z.cy + 12; y++) for (let x = Z.cx - 12; x <= Z.cx + 12; x++) if (w.b(y * N + x) === Z.row) { own++; if (w.k(y * N + x) === Z.mineral) mineral++; }
  if (own < 150 || mineral < 4) note(`the ${what}'s first pocket has ${own} cells and ${mineral} of its mineral: it should be whole`);
}
const pips = game.pocketPips();
if (!pips.includes(east) || !pips.includes(south)) note('the map has no pip for the east\'s or the south\'s first pocket');
if (pips.includes(north)) note('the map has a pip for the north\'s first pocket, which an old world does not have');
let strain = null;
for (let x = 260; x <= 700 && !strain; x += 8) for (const [ux, uy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const b = w.biomeAt(C + ux * x, C + uy * x); if (b >= 17 && b <= 31 && !saved.has(pieceOf(ux * x, uy * x))) { strain = [ux * x, uy * x, b]; break; } }
if (!strain) note('no strain lies along the four directions between 260 and 700 out');
else if (w.b(cell(strain[0], strain[1])) !== strain[2]) note(`the cell ${strain[0]},${strain[1]} beyond seen ground is ground ${w.b(cell(strain[0], strain[1]))}, where the new world lays ${BIOMES[strain[2]].name}`);

// 5. A pocket that lies half in seen ground is cut off at its edge: its cells in seen ground are old ground, its
// cells beyond it the pocket's. (The drift at 174, -78: the piece of world south of y = -64 was seen.)
for (const [Z, what] of [[half, 'the drift at 174,-78']]) {
  if (!Z) { note(`${what} is not where the fixture was made for`); continue; }
  let old = 0, own = 0;
  for (let y = Z.cy - 30; y <= Z.cy + 30; y++) for (let x = Z.cx - 30; x <= Z.cx + 30; x++) {
    if (!w.inPocket(Z, x, y)) continue;
    const b = w.b(y * N + x), seen = saved.has(pieceOf(x - C, y - C));
    if (seen) { old++; if (b === Z.row) note(`${what}: a cell of it lies in seen ground`); }
    else { own++; if (b !== Z.row) note(`${what}: a cell beyond seen ground is ground ${b}`); }
  }
  if (old < 40 || own < 40) note(`${what} has ${old} cells in seen ground and ${own} beyond: it should lie in both`);
}

// 6. And it plays: from a start in the old pocket's place, at the cut edge of the half drift and in a whole new
// pocket. (The game is loaded afresh before each: what the flight before changed was saved, and comes back.)
let frames = 0;
const fly = async (sx, sy, turns, seed) => {
  game.save();
  await new Promise(done => setTimeout(done, 20));
  if (!(await game.restore())) { note('the game did not load again'); return; }
  const rnd = random(seed), len = Math.hypot(sx, sy), d = game.drill;
  for (let s = 0; s <= len; s += 0.5) for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) w.setK((C + Math.round(sy * s / len) + v) * N + C + Math.round(sx * s / len) + u, K.EMPTY);
  d.x = C + sx + 0.5; d.y = C + sy + 0.5; d.mode = 'free';
  game.band = [[d.x, d.y], [C + 0.5, C + 0.5]];
  game.changed();
  let heading = rnd() * 6.283;
  for (let turn = 0; turn < turns; turn++) {
    heading += (rnd() - 0.5) * 2.5;
    for (let f = 10 + Math.floor(rnd() * 50); f > 0; f--) {
      game.input.auto = [Math.cos(heading), Math.sin(heading), 1];
      game.update(1 / 60); frames++;
      if (frames % 7 === 0) game.render();
      const faults = tetherFaults(game);
      if (faults.length) { note(`from ${sx},${sy}, frame ${frames}: ${faults[0]}`); return; }
    }
    if (!Number.isFinite(game.S.grit) || game.S.grit < 0 || game.S.spec.some(n => !Number.isFinite(n))) { note(`from ${sx},${sy}: grit ${game.S.grit}, specimens ${game.S.spec}`); return; }
  }
};
try {
  if (north) await fly(north.cx - C, north.cy - C + 3, 40, 3);
  if (half) await fly(half.cx - C, -66, 60, 5);
  if (east) await fly(east.cx - C - 3, east.cy - C, 60, 7);
  game.input.auto = null;
  for (let f = 0; f < 1200 && game.hauls.length; f++) game.update(1 / 60);
  if (game.hauls.length) note(`${game.hauls.length} hauls never came home`);
  // Saved by the new game and loaded again: the new fields come back, and so does the ground.
  game.save();
  await new Promise(done => setTimeout(done, 20));
  const kept = JSON.parse(JSON.stringify(game.S)), kinds = new Map([...rows].map(([id, p]) => [id, Uint8Array.from(p.kind)]));
  if (!(await game.restore())) note('the game saved over the old save did not load');
  if (JSON.stringify(game.S.spec) !== JSON.stringify(kept.spec) || JSON.stringify(game.S.visited) !== JSON.stringify(kept.visited) || game.S.grit !== kept.grit) note('what the new game saved over the old save came back otherwise');
  for (const [id, kind] of kinds) { const now = game.world.chunks[id]; if (!now || now.kind.some((k, n) => k !== kind[n])) { note('a piece saved over the old save came back otherwise'); break; } }
  if (!(rows.size > saved.size)) note('nothing was saved beyond the old save\'s pieces');
} catch (error) { note(`threw: ${error.stack.split('\n').slice(0, 4).join(' | ')}`); }

if (problems.length) { console.log('PROBLEMS\n' + problems.join('\n')); process.exit(1); }
console.log(`ok: ${saved.size} old pieces as saved, ${frames} frames flown, ${Object.keys(game.S.visited).length} pockets visited, ${rows.size} pieces saved after`);
