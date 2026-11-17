// The world a seed makes is the world it made before: the hashes of 96 pieces of it (tools/world-hash.mjs: the
// core, each direction at five distances, each diagonal at two, on three seeds) are those recorded in
// test/world-hash.txt before the kinds and the grounds were put into tables. A threshold copied wrongly into a row
// moves a line here. The pieces are laid by the rules of generation 1 (js/world.js: GEN, `genOf`), which every rule
// laid since asks for and lays nothing in: these lines staying as they were is the proof of it.
//   node test/regress/s1-world-hash.mjs
// Ground that is laid anew on purpose moves lines too: look at what moved (`node tools/world-hash.mjs --check`),
// and record them again with `--write` in the same commit that says why.
import { readFile } from 'node:fs/promises';
import { lines, RECORD } from '../../tools/world-hash.mjs';

const now = lines(1), was = (await readFile(RECORD, 'utf8')).split(/\r?\n/).filter(Boolean);
const wrong = [];
for (let n = 0; n < Math.max(now.length, was.length); n++) if (now[n] !== was[n]) wrong.push(`was: ${was[n] ?? '(no line)'}\n  now: ${now[n] ?? '(no line)'}`);
// The pieces must be worth checking: no two of them are the same ground.
const different = new Set(now.map(line => line.split('kind ')[1].split(' ')[0])).size;
console.log(wrong.length ? `DEFECT: ${wrong.length} of ${now.length} pieces of the world are not as recorded:\n  ${wrong.slice(0, 6).join('\n  ')}` : `ok: all ${now.length} pieces of the world are as recorded`);
process.exit(wrong.length || now.length !== 96 || different !== 96 ? 1 : 0);
