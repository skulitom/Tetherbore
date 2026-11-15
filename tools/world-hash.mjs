// The world a seed makes, as a list of hashes: one line for each of a set of pieces of the world, with an FNV-1a
// hash of the piece's kind bytes and of its biome bytes. A change to how the ground is laid out that is meant to
// leave the world as it was (a table in place of arithmetic, a faster reading) is run before and after: every
// line must match. A change that lays new ground on purpose moves lines, and says so when it records them again.
//   node tools/world-hash.mjs            prints the lines
//   node tools/world-hash.mjs --check    compares them with test/world-hash.txt; exits 1 and names each line that differs
//   node tools/world-hash.mjs --write    records them in test/world-hash.txt
//
// The pieces, for seeds 1, 7 and 123456: the four round the core's middle; the one holding the cell 200, 600,
// 1000, 1500 and 2000 cells out along each axis; and the one holding the cell 1000 and 1500 cells out along each
// diagonal. It asks the world alone (js/world.js: `piece`), so it needs no browser and nothing of the game.
import { readFile, writeFile } from 'node:fs/promises';
import { World, C, CH, CW, DX, DY } from '../js/world.js';

export const RECORD = new URL('../test/world-hash.txt', import.meta.url);
const fnv = bytes => {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};
// Where the pieces are, as [name, dx, dy] from the core: east and south are counted up.
export const places = () => {
  const list = [['core nw', -1, -1], ['core ne', 0, -1], ['core sw', -1, 0], ['core se', 0, 0]];
  const way = ['east', 'south', 'west', 'north'], corner = ['south-east', 'south-west', 'north-west', 'north-east'];
  for (const r of [200, 600, 1000, 1500, 2000]) for (let d = 0; d < 4; d++) list.push([`${way[d]} ${r}`, DX[d] * r, DY[d] * r]);
  for (const r of [1000, 1500]) for (let d = 0; d < 4; d++) {
    const leg = Math.round(r * Math.SQRT1_2);
    list.push([`${corner[d]} ${r}`, (DX[d] - DY[d]) * leg, (DX[d] + DY[d]) * leg]);
  }
  return list;
};
export const lines = () => {
  const out = [];
  for (const seed of [1, 7, 123456]) {
    const world = new World();
    world.reset(seed);
    for (const [name, dx, dy] of places()) {
      const id = (((C + dy) >> 6) << 8) | ((C + dx) >> 6), p = world.piece(id);
      out.push(`seed ${seed} ${name} (piece ${id % CW - C / CH},${((id / CW) | 0) - C / CH}): kind ${fnv(p.kind)} biome ${fnv(p.biome)}`);
    }
  }
  return out;
};

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const now = lines(), mode = process.argv[2];
  if (mode === '--write') {
    await writeFile(RECORD, now.join('\n') + '\n');
    console.log(`${now.length} lines recorded in test/world-hash.txt`);
  } else if (mode === '--check') {
    const was = (await readFile(RECORD, 'utf8')).split(/\r?\n/).filter(Boolean);
    let wrong = 0;
    for (let n = 0; n < Math.max(now.length, was.length); n++) if (now[n] !== was[n]) { wrong++; console.log(`was: ${was[n] ?? '(no line)'}\nnow: ${now[n] ?? '(no line)'}`); }
    console.log(wrong ? `${wrong} of ${now.length} pieces of the world differ from test/world-hash.txt` : `all ${now.length} pieces of the world are as recorded`);
    process.exit(wrong ? 1 : 0);
  } else console.log(now.join('\n'));
}
