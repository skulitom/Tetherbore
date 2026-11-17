// The world a seed makes is the world it made before: the hashes of 96 pieces of it (tools/world-hash.mjs: the
// core, each direction at five distances, each diagonal at two, on three seeds) are those recorded in
// test/world-hash.txt before the kinds and the grounds were put into tables. A threshold copied wrongly into a row
// moves a line here. The pieces are laid by the rules of generation 1 (js/world.js: GEN, `genOf`), which every rule
// laid since asks for and lays nothing in: these lines staying as they were is the proof of it.
// And 120 more of generation 2, where its rules lay ground of their own (the diagonals from 500 cells out, the deep
// strains in the flanks, the shrines: `GEN2_PLACES`), as they were recorded when those rules were laid, and 21 of
// those 2,000 cells out again when the builders' halls were (their kinds alone: the grounds are as they were). And
// near the core, within the 445 cells no rule of generation 2 reaches (js/world.js: MIGRATE_NEAR), generation 2
// lays the same as 1: the core and each direction at 200 cells, on each seed, where every recorded flight begins.
//   node test/regress/s1-world-hash.mjs
// Ground that is laid anew on purpose moves lines too: look at what moved (`node tools/world-hash.mjs --check`),
// and record them again with `--write` in the same commit that says why.
import { readFile } from 'node:fs/promises';
import { lines, places, GEN2_PLACES, RECORD } from '../../tools/world-hash.mjs';

const one = lines(1), now = [...one, ...lines(2, GEN2_PLACES)], was = (await readFile(RECORD, 'utf8')).split(/\r?\n/).filter(Boolean);
const wrong = [];
for (let n = 0; n < Math.max(now.length, was.length); n++) if (now[n] !== was[n]) wrong.push(`was: ${was[n] ?? '(no line)'}\n  now: ${now[n] ?? '(no line)'}`);
// The pieces must be worth checking: no two of them are the same ground.
const different = new Set(now.map(line => line.split('kind ')[1].split(' ')[0])).size;
// Near the core, generation 2 is generation 1.
const near = () => places().filter(([name]) => name.startsWith('core') || name.endsWith(' 200')), same = lines(2, near).filter((line, n) => line !== lines(1, near)[n]);
console.log(wrong.length ? `DEFECT: ${wrong.length} of ${now.length} pieces of the world are not as recorded:\n  ${wrong.slice(0, 6).join('\n  ')}`
  : same.length ? `DEFECT: near the core generation 2 lays otherwise than 1: ${same[0]}` : `ok: all ${now.length} pieces of the world are as recorded, and near the core both generations lay the same`);
process.exit(wrong.length || same.length || now.length !== 216 || different !== 216 ? 1 : 0);
