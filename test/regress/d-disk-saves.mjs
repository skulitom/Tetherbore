// The desktop build keeps the game in one file for Steam Cloud (js/disk.js, desktop/saves.cjs), and shows more of the
// world on a larger monitor and not larger pixels (`Game.resize`, `wide`).
//   node test/regress/d-disk-saves.mjs
// Held here: a file of another world or further on is laid over the browser's storage, ground and all, and one
// behind it is not; settings travel and the record of long frames does not; a save with no game in it writes nothing;
// the file survives a torn write through its `.bak`; and the pixel size at each desktop resolution, with the phone's
// sizes as they were.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { newer, pull, push, keep } from '../../js/disk.js';
import { makeGame } from '../harness.mjs';

const require = createRequire(import.meta.url), { open } = require('../../desktop/saves.cjs');
const LATEST = 'tetherbore-save-v3-latest', problems = [];
const check = (ok, what) => { if (!ok) problems.push(what); };
const save = (seed, rev, extra = {}) => JSON.stringify({ v: 3, rev, seed, ...extra });

// A browser's storage, and a database of one store that does what js/disk.js asks of it.
function storage(kept = {}) {
  const map = new Map(Object.entries(kept));
  return { map, get length() { return map.size; }, key: n => [...map.keys()][n], getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
}
function database(rows = []) {
  const map = new Map(rows);
  const answer = result => { const r = { result }; queueMicrotask(() => r.onsuccess?.()); return r; };
  const objects = { clear: () => map.clear(), put: (value, id) => map.set(id, value), getAllKeys: () => answer([...map.keys()]), getAll: () => answer([...map.values()]) };
  return { map, open: async () => ({ transaction: () => { const tx = { objectStore: () => objects }; setTimeout(() => tx.oncomplete?.(), 0); return tx; } }) };
}
const bridge = saved => ({ saved, read: async function () { return this.saved; }, write: async function (data) { this.saved = data; } });

check(newer(null, save(1, 1)), 'a file with nothing here is not taken');
check(newer(save(1, 5), save(1, 6)), 'a file further on is not taken');
check(newer(save(1, 9), save(2, 3)), 'a file of another world is not taken');
check(!newer(save(1, 6), save(1, 6)), 'a file level with this is taken');
check(!newer(save(1, 7), save(1, 6)), 'a file behind this is taken');
check(!newer(save(1, 7), 'not json'), 'a broken file is taken');

{
  const local = storage({ [LATEST]: save(1, 2), 'tetherbore-stalls': 'mine' }), db = database([['old', { seed: 1 }]]);
  const b = bridge({ keys: { [LATEST]: save(1, 3), 'tetherbore-lang': 'ru', 'tetherbore-stalls': 'theirs', other: 'x' }, pieces: [[7, { seed: 1, kind: new Uint8Array([4]) }]] });
  check(await pull(b, local, db.open), 'a newer file was not laid');
  check(JSON.parse(local.getItem(LATEST)).rev === 3 && local.getItem('tetherbore-lang') === 'ru', 'the save and settings did not come');
  check(local.getItem('tetherbore-stalls') === 'mine' && local.getItem('other') === null, 'what is not the game\'s came too');
  check(!db.map.has('old') && db.map.get(7)?.kind[0] === 4, 'the ground was not replaced');
  check(!(await pull(b, local, db.open)), 'the same file was laid twice');
}
{
  const local = storage({ [LATEST]: save(4, 8), 'tetherbore-music': '1', 'tetherbore-stalls': 'mine', unrelated: 'x' }), db = database([[3, { seed: 4 }]]), b = bridge(null);
  check(await push(b, local, db.open), 'the game was not written');
  check(b.saved.keys[LATEST] && b.saved.keys['tetherbore-music'] === '1' && !('tetherbore-stalls' in b.saved.keys) && !('unrelated' in b.saved.keys), 'the wrong keys were written');
  check(b.saved.pieces.length === 1 && b.saved.pieces[0][0] === 3, 'the ground was not written');
  const none = bridge(null);
  check(!(await push(none, storage({ 'tetherbore-music': '1' }), db.open)) && none.saved === null, 'a file was written with no game in it');
  let writes = 0;
  const counted = { write: async () => { writes++; } }, keeper = keep({ save() {} }, counted, local, db.open);
  await keeper.flush(); await keeper.flush();
  check(writes === 1, `an unchanged game was written ${writes} times`);
}

const dir = mkdtempSync(path.join(os.tmpdir(), 'tetherbore-disk-'));
try {
  const file = open(path.join(dir, 'saves')), one = { keys: { a: '1' }, pieces: [[1, { kind: new Uint8Array([1, 2, 3]) }]] };
  check(await file.read() === null, 'a save was read from an empty folder');
  await file.write(one);
  const back = await file.read();
  check(back.keys.a === '1' && back.pieces[0][1].kind[2] === 3, 'the file did not read back');
  await file.write({ keys: { a: '2' }, pieces: [] });
  writeFileSync(file.file, 'torn');
  check((await file.read())?.keys.a === '1', 'a torn file did not fall back on the last good one');
} finally { rmSync(dir, { recursive: true, force: true }); }

const game = await makeGame(7);
for (const [w, h, dpr, scale] of [[1280, 720, 1, 2], [1280, 800, 1, 2], [1366, 768, 1, 2], [1920, 1080, 1, 3], [1280, 720, 1.5, 3], [2560, 1440, 1, 4], [3840, 2160, 1, 6], [960, 540, 1, 2]]) {
  game.resize(w, h, dpr, true);
  check(game.scale === scale && game.W >= 480 && game.H >= 270, `${w}x${h} at ${dpr}: ${game.scale}, not ${scale}`);
}
for (const [w, h, scale] of [[360, 640, 2], [320, 568, 2], [412, 915, 2]]) { game.resize(w, h, 1); check(game.scale === scale, `the phone's ${w}x${h} is ${game.scale}, not ${scale}`); }

if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('the disk saves and the desktop view hold');
