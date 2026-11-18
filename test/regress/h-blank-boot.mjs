// A returning player's game is made blank and laid only from the save. The page made a whole new game (a seed drawn,
// a world reset, four pieces of ground laid about the core) and restore then threw it away for the saved one: 48 ms
// at a phone's speed on every visit. Now js/main.js makes the game `{ blank: true }` wherever local storage holds a
// game to go on with (`hasSave`): it draws the seed as before and keeps it, lays nothing, and restore lays the saved
// world; where restore finds no game it can begin after all, or fails, it begins the kept seed's world first.
//   node test/regress/h-blank-boot.mjs
// Held here, each with Math.random one stream for both games:
//   - `hasSave` says yes to a v3 save under either key and no to none, an older one and one that is not JSON;
//   - a blank game lays no piece of ground and has no game state until restore;
//   - with nothing saved, with an older save and with one that is not JSON, a blank game restored is the very game
//     a game not blank restored is: its S, drill, view, tether, number, notice, every piece's bytes, the pieces
//     made, the draws of Math.random, and the same again after two seconds flown;
//   - with a save (one the game makes now, the game at 4293f7c's and the game at 93ecb92's, each with its ground in
//     the database), a blank game restored is the game restored, S, every piece's bytes, the generations, the drill,
//     what it says and what it threw out, and the same after two seconds flown; and it made four pieces fewer.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { Game, random, world } from '../harness.mjs';
import { hasSave } from '../../js/game.js';

const { CH, World } = world, problems = [], note = text => { if (problems.length < 20) problems.push(text); };
const KEY = 'tetherbore-save-v3', LATEST = `${KEY}-latest`;

// A database that holds pieces and keeps what the game puts in it (the harness's own refuses to open).
let rows = new Map();
const clone = v => ({ ...v, kind: Uint8Array.from(v.kind), biome: Uint8Array.from(v.biome), seen: Uint8Array.from(v.seen) });
const pieces = {
  put(value, id) { rows.set(id, value.kind ? clone(value) : { ...value }); }, clear() { rows.clear(); }, delete(id) { rows.delete(id); },
  openCursor() {
    const request = {}, list = [...rows].map(([k, v]) => [k, v.kind ? clone(v) : { ...v }]);
    let n = 0;
    const next = () => queueMicrotask(() => { request.result = n < list.length ? { key: list[n][0], value: list[n][1], continue() { n++; next(); } } : null; request.onsuccess?.(); });
    next();
    return request;
  },
};
globalThis.indexedDB = { open() { const request = {}; queueMicrotask(() => { request.result = { transaction: () => ({ objectStore: () => pieces }) }; request.onsuccess?.(); }); return request; } };
const settle = () => new Promise(done => setTimeout(done, 20));
const canvas = () => document.createElement('canvas');

// (Every piece of ground laid, counted across restore's reset of the world, which sets `made` back to nought.)
let laid = 0;
const lay = World.prototype.lay;
World.prototype.lay = function (...args) { laid++; return lay.apply(this, args); };
// Math.random as one stream, counted.
let draws = 0;
const stream = seed => { const r = random(seed); draws = 0; Math.random = () => { draws++; return r(); }; };

const sha = (...parts) => { const h = createHash('sha1'); for (const p of parts) h.update(typeof p === 'string' ? p : Buffer.from(p.buffer, p.byteOffset, p.byteLength)); return h.digest('hex').slice(0, 16); };
const chunksOf = w => { const ids = []; w.chunks.forEach((p, id) => { if (p) ids.push(id); }); return { ids: ids.join(','), bytes: sha(...ids.flatMap(id => [String(id), w.chunks[id].kind, w.chunks[id].biome, w.chunks[id].seen])) }; };
const snap = g => ({ S: JSON.stringify(g.S), drill: JSON.stringify(g.drill), cam: JSON.stringify(g.cam), band: JSON.stringify(g.band), rev: g.rev,
  notice: JSON.stringify(g.notice), thrown: g.thrownOut, placeKey: g.placeKey, known: g.known, ...chunksOf(g.world), gen: sha(g.world.genOf), unshrined: g.world.unshrined, draws });
const compare = (what, a, b) => { for (const k of Object.keys(a)) if (a[k] !== b[k]) note(`${what}: ${k} differs, ${String(a[k]).slice(0, 90)} against ${String(b[k]).slice(0, 90)} blank`); };
// Two seconds flown out and round, the same for both.
const fly = g => { g.resize(360, 640, 1); for (let f = 0; f < 120; f++) { g.input.auto = [Math.cos(f / 30), Math.sin(f / 30) - 0.6, 1]; g.update(1 / 60); } g.input.auto = null; };

// Boots as the page does, blank or not, with what local storage and the database hold set before each.
async function boot(blank, local, db, seed = 5) {
  localStorage.removeItem(KEY); localStorage.removeItem(LATEST); localStorage.removeItem(`${KEY}-kept`);
  for (const [k, v] of Object.entries(local)) localStorage.setItem(k, v);
  rows = new Map(db.map(([id, v]) => [id, v.kind ? clone(v) : { ...v }]));
  stream(seed); laid = 0;
  const game = new Game(canvas(), null, { blank });
  const before = { made: game.world.made, S: game.S };
  game.failed = () => {};
  const ok = await game.restore();
  await settle();
  const after = snap(game), made = laid;
  fly(game);
  return { game, ok, before, after, made, flown: snap(game), kept: localStorage.getItem(`${KEY}-kept`) };
}
async function same(what, local, db, { saved = false } = {}) {
  const a = await boot(false, local, db), b = await boot(true, local, db);
  if (b.before.made !== 0 || b.before.S !== undefined || a.before.made !== 4) note(`${what}: the blank game laid ${b.before.made} pieces (the game ${a.before.made}) or had a state before restore`);
  if (a.ok !== saved || b.ok !== saved) note(`${what}: restore said ${a.ok} and ${b.ok} blank, not ${saved}`);
  if (a.kept !== b.kept) note(`${what}: the save kept aside differs`);
  compare(`${what}, restored`, a.after, b.after);
  compare(`${what}, flown`, a.flown, b.flown);
  // (Nothing saved: the same pieces made, the blank game's late. Saved: four fewer, the throwaway world's.)
  if (!saved && a.made !== b.made) note(`${what}: ${a.made} pieces made, ${b.made} blank`);
  if (saved && a.made - b.made !== 4) note(`${what}: the blank game made ${b.made} pieces where the game made ${a.made}, not four fewer`);
  return [a, b];
}

// 1. hasSave.
const has = local => { localStorage.removeItem(KEY); localStorage.removeItem(LATEST); for (const [k, v] of Object.entries(local)) localStorage.setItem(k, v); return hasSave(); };
const v3 = JSON.stringify({ v: 3, seed: 9 });
for (const [local, want] of [[{}, false], [{ [KEY]: v3 }, true], [{ [LATEST]: v3 }, true], [{ [KEY]: '{"v":2,"seed":9}' }, false], [{ [KEY]: '{' }, false], [{ [KEY]: 'null', [LATEST]: v3 }, true], [{ [KEY]: '{', [LATEST]: '[]' }, false]]) {
  if (has(local) !== want) note(`hasSave says ${!want} of ${JSON.stringify(local)}`);
}

// 2. No game to go on with: nothing saved, an older save, one that is not JSON.
await same('nothing saved', {}, []);
await same('an older save', { [KEY]: '{"v":2,"seed":9,"grit":5}' }, []);
const [broken] = await same('a save that is not JSON', { [KEY]: '{"v":3,' }, []);
if (broken.kept !== '{"v":3,') note('the broken save was not kept aside');

// 3. A save: one the game makes now, flown and saved, with its ground in the database.
{
  localStorage.removeItem(KEY); localStorage.removeItem(LATEST); rows = new Map();
  stream(3);
  const g = new Game(canvas()); g.fresh(7, true); g.claim(); await settle(); g.resize(360, 640, 1);
  for (let f = 0; f < 600; f++) { g.input.auto = [Math.sin(f / 50), 1, 1]; g.update(1 / 60); }
  g.S.grit += 1234; g.save(); await settle();
  const local = { [KEY]: localStorage.getItem(KEY), [LATEST]: localStorage.getItem(LATEST) };
  const db = [...rows];
  if (db.length < 5) note(`the game saved only ${db.length} rows`);
  const [a] = await same('a save of today', local, db, { saved: true });
  if (JSON.parse(a.after.S).grit !== g.S.grit) note('the save of today did not load what it saved');
}
// The saves of older games, from the fixtures, their pieces saying no world (as those games saved them).
for (const name of ['save-4293f7c', 'save-93ecb92-ne']) {
  const save = JSON.parse(gunzipSync(readFileSync(new URL(`../fixtures/${name}.json.gz`, import.meta.url))));
  const bytes = text => Uint8Array.from(Buffer.from(text, 'base64'));
  const db = save.pieces.map(([id, kind, biome, seen]) => [id, { kind: bytes(kind), biome: bytes(biome), seen: bytes(seen) }]);
  if (db[0][1].kind.length !== CH * CH) note(`${name}: a piece of ${db[0][1].kind.length} cells`);
  await same(`the save of ${name}`, { [KEY]: save.local }, db, { saved: true });
}

if (problems.length) { console.log(`FAIL h-blank-boot: ${problems.join('; ')}`); process.exit(1); }
console.log('ok h-blank-boot: a blank game restored is the game restored, with a save and without, and lays no throwaway world');
