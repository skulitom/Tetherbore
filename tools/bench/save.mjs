// A saved game for tools/bench.mjs to load: a fixture is what the browser's database and local storage hold after a
// game's saves, as one gzipped JSON ({ seed, local, pieces: [[id, kind, biome, seen, gen?], ...] }, the bytes in
// base64), and the page code that puts one into the real 'tetherbore' database and times a real boot from it.
//   FILL_PAGE    a page of the bench's own, served at the root's origin: `bench.fill(url)` fills the store as the
//                game would have it (the meta row, every piece, the save under its key)
//   BOOT_INJECT  run before anything of the page (Page.addScriptToEvaluateOnNewDocument): times each animation
//                frame's callback, the database's opening and its cursor (with the rows it gave), and when the game's
//                canvas is first asked for its context (the first line of the Game constructor)
//   BOOT_HOOK    an early module put in before js/main.js: it imports /js/world.js and /js/game.js, the very
//                instances main.js imports, and times World.prototype.migrate and Game.prototype.restore
//   synth(name)  the synthetic saves (`bench mksave`), as the profiler's synth.mjs made them
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export const FILL_PAGE = `<!doctype html><meta charset="utf-8"><title>fill</title><script type="module">
const b64 = s => { const bin = atob(s), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; };
const openDB = () => new Promise((res, rej) => { const o = indexedDB.open('tetherbore', 1); o.onupgradeneeded = () => o.result.createObjectStore('pieces'); o.onsuccess = () => res(o.result); o.onerror = () => rej(o.error); });
const done = tx => new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
window.bench = {
  async fill(url) {
    const r = await fetch(url), save = JSON.parse(await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text());
    const db = await openDB(), tx = db.transaction('pieces', 'readwrite'), st = tx.objectStore('pieces');
    st.clear(); st.put({ seed: save.seed }, 'meta');
    let bytes = 0;
    for (const [id, kind, biome, seen, gen] of save.pieces) { const v = { kind: b64(kind), biome: b64(biome), seen: b64(seen), seed: save.seed, ...(gen !== undefined ? { gen } : {}) }; bytes += v.kind.length * 3; st.put(v, id); }
    await done(tx); db.close();
    localStorage.setItem('tetherbore-save-v3', save.local); localStorage.removeItem('tetherbore-save-v3-latest');
    return { pieces: save.pieces.length, bytes };
  },
};
window.benchReady = true;
</script>`;

export const BOOT_INJECT = `(() => {
  const T = window.__bt = { raf: [], migrate: 0, migrates: 0, idbOpen: null, idbOpened: null, cursorStart: null, cursorEnd: null, rows: 0, ctorStart: null, restoreStart: null, restoreEnd: null };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(ts => { const a = performance.now(); try { cb(ts); } finally { if (T.raf.length < 60) T.raf.push([a, performance.now()]); } });
  const open = IDBFactory.prototype.open;
  IDBFactory.prototype.open = function (name, ...rest) {
    const r = open.call(this, name, ...rest);
    if (name === 'tetherbore' && T.idbOpen === null) { T.idbOpen = performance.now(); r.addEventListener('success', () => { T.idbOpened ??= performance.now(); }); }
    return r;
  };
  const cursor = IDBObjectStore.prototype.openCursor;
  IDBObjectStore.prototype.openCursor = function (...a) {
    const r = cursor.apply(this, a);
    if (T.cursorStart === null) { T.cursorStart = performance.now(); r.addEventListener('success', () => { if (r.result) { if (r.result.key !== 'meta') T.rows++; } else T.cursorEnd ??= performance.now(); }); }
    return r;
  };
  const context = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (...a) { if (this.id === 'game' && T.ctorStart === null) T.ctorStart = performance.now(); return context.apply(this, a); };
})();`;

export const BOOT_HOOK = `import { World } from '/js/world.js';
import { Game } from '/js/game.js';
const T = window.__bt;
const migrate = World.prototype.migrate;
World.prototype.migrate = function (...a) { const t = performance.now(); try { return migrate.apply(this, a); } finally { T.migrate += performance.now() - t; T.migrates++; } };
const restore = Game.prototype.restore;
Game.prototype.restore = async function (...a) { T.restoreStart ??= performance.now(); try { return await restore.apply(this, a); } finally { T.restoreEnd ??= performance.now(); } };
`;

// The synthetic late saves: the ground seen (scanner 13) and a tunnel cut along the four axes out past the lords
// (2,250) and, for `all`, along the four diagonals out past the shrines (1,450 along); gen 2 (today's) or gen 1 (an
// old save, its pieces saying no generation, laid by generation 1's rules).
export const SYNTH = { 'syn2-all': [2, 'all'], 'syn2-axes': [2, 'axes'], 'syn1-all': [1, 'all'], 'syn1-axes': [1, 'axes'] };
export async function synth(root, name, out) {
  const [gen, which] = SYNTH[name];
  const H = await import(pathToFileURL(path.join(root, 'test', 'harness.mjs')).href);
  const { makeGame, C, N, K, UPGRADES, WORKS, MAPS, CORE } = H;
  const game = await makeGame(7), w = game.world;
  for (const u of [...UPGRADES, ...WORKS, ...MAPS, ...CORE]) game.S.lv[u.id] = u.values.length - 1;
  w.reset(7);
  if (gen === 1) { w.genOf.fill(1); w.forget(); }
  // Every piece ever touched (seen or changed): what the browser's database holds after a game's saves.
  const ever = new Set(), add = w.touched.add.bind(w.touched);
  w.touched.add = id => { ever.add(id); return add(id); };
  const r = 13;
  const cut = (ux, uy, far) => {
    const len = Math.hypot(ux, uy);
    for (let s = 0; s <= far; s += 2) {
      const x = C + Math.round(ux / len * s), y = C + Math.round(uy / len * s);
      w.see(x, y, r);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) w.setK((y + b) * N + x + a, K.EMPTY);
    }
  };
  for (const [x, y] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) cut(x, y, 2250);
  if (which === 'all') for (const [x, y] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) cut(x, y, 1450 * Math.SQRT2);
  const S = game.S;
  S.relics = [1, 1, 1, 1]; S.out = 2250; S.grit = 1e9; S.stats.time = 5 * 3600; S.gen = gen; S.bosses = 15;
  const b64 = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
  const pieces = [];
  for (const id of [...ever].sort((p, q) => p - q)) {
    const p = w.chunks[id];
    if (!p) continue;
    pieces.push(gen !== 1 ? [id, b64(p.kind), b64(p.biome), b64(p.seen), w.genOf[id]] : [id, b64(p.kind), b64(p.biome), b64(p.seen)]);
  }
  const local = JSON.stringify({ v: 3, rev: 1, ...game.kept() });
  writeFileSync(out, gzipSync(JSON.stringify({ seed: S.seed, local, pieces })));
  return { pieces: pieces.length, made: w.made };
}
