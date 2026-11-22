// A demo's game brought into a full game that has none of its own. js/main.js fetches this only where there is a demo's
// save and no full one, so a device with neither, or with a full game already, never runs it. A full game's save is
// never replaced, and the demo's is left where it is.
//
// The demo keeps its game in keys and a database of its own (js/edition.js), and what it saves is a full game's save in
// every field but one: `demoLords`, the demo's own lord, which is not the full game's and is dropped here. So the game
// goes on with all it banked, bought, found and earned, on the reach it had, and nothing holds it there.
import { DEMO_DB, DEMO_SAVE, FULL_DB, FULL_SAVE } from './edition.js';

const read = text => { try { const d = JSON.parse(text); return d?.v === 3 ? d : null; } catch { return null; } };
const asked = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
const opened = name => new Promise((resolve, reject) => {
  const open = indexedDB.open(name, 1);
  open.onupgradeneeded = () => open.result.createObjectStore('pieces');
  open.onsuccess = () => resolve(open.result);
  open.onerror = () => reject(open.error);
});

// The later of the demo's two copies, as a full game's save, or null.
export function carried(keys) {
  const a = read(keys[DEMO_SAVE]), b = read(keys[`${DEMO_SAVE}-latest`]), d = a && b ? ((b.rev ?? 0) >= (a.rev ?? 0) ? b : a) : a ?? b;
  if (!d) return null;
  const { demoLords, ...save } = d;
  return JSON.stringify(save);
}

// Brings it over; says whether it did. `file` is the demo's save file on the desktop ({ keys, pieces }, desktop/saves.cjs);
// with none, the demo's game is in this browser's own storage.
export async function carry(file = null, storage = localStorage) {
  // (Anything under the full game's keys stays, even a save that cannot be read: `Game.restore` keeps that one aside.)
  if ([FULL_SAVE, `${FULL_SAVE}-latest`].some(key => storage.getItem(key) !== null)) return false;
  const keys = file?.keys ?? { [DEMO_SAVE]: storage.getItem(DEMO_SAVE), [`${DEMO_SAVE}-latest`]: storage.getItem(`${DEMO_SAVE}-latest`) };
  const save = carried(keys);
  if (!save) return false;
  // The ground first, in one transaction, and the save that names it after, as a game that stops between the two then
  // begins as it was. (With no database to be had, a private window, the world is made again from its seed.)
  try {
    let pieces = file?.pieces;
    if (!pieces) {
      const db = await opened(DEMO_DB), from = db.transaction('pieces').objectStore('pieces');
      const [ids, rows] = await Promise.all([asked(from.getAllKeys()), asked(from.getAll())]);
      pieces = ids.map((id, n) => [id, rows[n]]);
      db.close?.();
    }
    const db = await opened(FULL_DB), tx = db.transaction('pieces', 'readwrite'), to = tx.objectStore('pieces');
    to.clear();
    for (const [id, piece] of pieces) to.put(piece, id);
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(tx.error); });
    db.close?.();
  } catch { /* the save still comes over */ }
  // (From a file, the language and the sound come too, where this device has chosen none.)
  if (file) for (const [key, value] of Object.entries(file.keys)) {
    if (key.startsWith('tetherbore-') && !key.startsWith('tetherbore-demo') && key !== 'tetherbore-stalls' && !key.startsWith(FULL_SAVE) && storage.getItem(key) === null) storage.setItem(key, value);
  }
  storage.setItem(FULL_SAVE, save);
  storage.setItem(`${FULL_SAVE}-latest`, save);
  return true;
}
