// The game kept on disk, for the desktop build, where Steam Cloud can carry it from one machine to the next. Loaded
// only there (js/main.js, a dynamic import): the web game never asks for it.
//
// The game goes on saving as it does in a browser, to local storage and IndexedDB, and this copies all of it to one
// file through the desktop shell (`bridge`: desktop/saves.cjs reads and writes it). The file is what counts: at boot
// it is laid back over what the browser's storage holds if it is of another world or further on, as it is when the
// game was last played on another machine, or the browser's storage has been lost.
import { SAVE_KEY, DB_NAME } from './edition.js';

const LATEST = `${SAVE_KEY}-latest`;
// (Every setting and save of the game's, but its own record of long frames, which belongs to this machine.)
const carried = key => key.startsWith('tetherbore-') && key !== 'tetherbore-stalls';
const read = text => { try { const d = JSON.parse(text); return d?.v === 3 ? d : null; } catch { return null; } };

const database = () => new Promise((resolve, reject) => {
  const open = indexedDB.open(DB_NAME, 1);
  open.onupgradeneeded = () => open.result.createObjectStore('pieces');
  open.onsuccess = () => resolve(open.result);
  open.onerror = () => reject(open.error);
});
const asked = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });

// Whether what is on disk should replace what is here.
export function newer(here, there) {
  const a = read(here), b = read(there);
  if (!b) return false;
  return !a || a.seed !== b.seed || (b.rev ?? 0) > (a.rev ?? 0);
}

// The file laid over the browser's storage if it should be; whether it was. The ground goes first and in one
// transaction, and the save that names it after, so that a game stopped between the two loads as it was.
export async function pull(bridge, storage = localStorage, open = database) {
  const saved = await bridge.read();
  if (!saved?.keys || !newer(storage.getItem(LATEST), saved.keys[LATEST])) return false;
  const db = await open(), tx = db.transaction('pieces', 'readwrite'), pieces = tx.objectStore('pieces');
  pieces.clear();
  for (const [id, piece] of saved.pieces ?? []) pieces.put(piece, id);
  await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(tx.error); });
  for (const [key, value] of Object.entries(saved.keys)) if (carried(key)) storage.setItem(key, value);
  return true;
}

// Everything the game keeps, written to the file.
export async function push(bridge, storage = localStorage, open = database) {
  const keys = {};
  for (let n = 0; n < storage.length; n++) { const key = storage.key(n); if (carried(key)) keys[key] = storage.getItem(key); }
  if (!read(keys[LATEST])) return false;
  const db = await open(), tx = db.transaction('pieces'), store = tx.objectStore('pieces');
  const [ids, rows] = await Promise.all([asked(store.getAllKeys()), asked(store.getAll())]);
  await bridge.write({ keys, pieces: ids.map((id, n) => [id, rows[n]]) });
  return true;
}

// The file kept up with a running game: every EVERY ms if it has been saved since, and at once when the window is
// closing (`flush`), the game saved first.
const EVERY = 30000;
export function keep(game, bridge, storage = localStorage, open = database) {
  let wrote = null, busy = Promise.resolve();
  const copy = () => busy = busy.then(async () => {
    const now = storage.getItem(LATEST);
    if (now === wrote) return;
    if (await push(bridge, storage, open)) wrote = now;
  }).catch(() => {});
  const timer = setInterval(copy, EVERY);
  timer.unref?.();
  return {
    copy,
    async flush() {
      game.save();
      // (The game's write to the database is asked for a moment after it saves.)
      await new Promise(resolve => setTimeout(resolve, 50));
      await copy();
    },
  };
}
