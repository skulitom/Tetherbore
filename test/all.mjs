// Every test in one command: each script in test/regress (each fails while the defect it was written for is there),
// the smoke test, and the rope fuzz on seeds 11 to 18 from the core and from a start 200 cells out each way.
//   node test/all.mjs [only: a word the test's name must hold]
// One line a test, and the last line of a failing test's own output under it. Exits 1 if any failed. Tests run side by
// side, as many as the machine has cores to spare, and the whole run takes a few minutes.
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url)), only = process.argv[2] ?? '';
// A regress script named here is run once for each list of arguments; any other is run once, with none.
const ARGS = {
  'a-fuzz-field': [[1, 400, 0], [1, 400, 1], [1, 400, 2], [1, 400, 3], [1, 400, 4]],
  'a-fuzz-keys': [[2, 300, 0, 4], [2, 300, 1, 4], [2, 300, 2, 4], [2, 300, 3, 4], [2, 300, 4, 4]],
  'a-fuzz-soft': [[4, 500, 16, 2, 4], [14, 500, 16, 2, 4], [18, 500, 12, 0, 0]],
  'b-fuzz-fast': [[1, 100, 4, 80, 70, 60], [2, 100, 4, 80, 70, 30]],
  'e-hazard-fuzz': [[2, 500, 0, 170, 0.08], [1, 300, -170, 0, 0.08], [4, 300, 170, 0, 0.08],
    [3, 300, 0, 170, 0.08, 5, 'second'], [5, 300, -170, 0, 0.08, 5, 'second'], [6, 300, 170, 0, 0.08, 5, 'second']],
  'f-big': [[71], [250], [205, 'jog'], [150, 'bump']],
  'f-freed-diff': [[1, 4000, 14, 0.55], [5, 6000, 20, 0.62], [9, 3000, 20, 0.62]],
  'f-fuzz-books': [[2, 300], [7, 300], [9, 300], [12, 300]],
  'f-wreck': [[7, 0], [32, 0], [61, 0], [63, 0]],
  'g-far-wreck': [[7, 5, 60], [7, 7, 60]],
  'i-fuzz-play': [[45, 500, 5, 0, 0, 30], [33, 400, 5, 60, 210, 60], [60, 400, 5, 141, 141, 60], [50, 400, 5, 60, 210, 60], [57, 260, 9, -1061, 1061, 'mix'],
    [39, 260, 1, 0, 0, 60, 'lowdrill,home'], [51, 260, 5, 141, 141, 60, 'bombs,forceshop']],
};
const tests = [];
for (const file of readdirSync(here + 'regress').filter(name => name.endsWith('.mjs')).sort()) {
  for (const args of ARGS[file.slice(0, -4)] ?? [[]]) tests.push({ name: `regress/${file}${args.length ? ' ' + args.join(' ') : ''}`, run: [`regress/${file}`, ...args] });
}
tests.push({ name: 'smoke.mjs', run: ['smoke.mjs'] });
for (let seed = 11; seed <= 18; seed++) tests.push({ name: `rope-fuzz.mjs ${seed} 600 5`, run: ['rope-fuzz.mjs', seed, 600, 5] });
// North is up the screen: negative y.
for (const [seed, x, y, way] of [[11, 0, -200, 'north'], [12, 0, 200, 'south'], [13, 200, 0, 'east'], [14, -200, 0, 'west']]) tests.push({ name: `rope-fuzz.mjs ${seed} 600 5 ${x} ${y} (${way})`, run: ['rope-fuzz.mjs', seed, 600, 5, x, y] });

const queue = tests.filter(test => test.name.includes(only)), began = Date.now();
let failed = 0, done = 0;
const one = test => new Promise(resolve => {
  const t = Date.now(), child = spawn(process.execPath, [here + test.run[0], ...test.run.slice(1).map(String)], { cwd: here + '..', stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', data => { out += data; });
  child.stderr.on('data', data => { out += data; });
  // A test that hangs is a failed test: the longest takes two minutes.
  const timer = setTimeout(() => { out += '\ntook over 420 s: stopped'; child.kill(); }, 420000);
  child.on('close', code => {
    clearTimeout(timer);
    const ok = code === 0, lines = out.trim().split('\n');
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${test.name}  (${((Date.now() - t) / 1000).toFixed(1)} s)${ok ? '' : `\n     ${lines.slice(-2).join('\n     ').slice(0, 600)}`}`);
    done++;
    resolve();
  });
});
const workers = Array.from({ length: Math.max(1, Math.min(queue.length, availableParallelism() - 1)) }, async () => { while (queue.length) await one(queue.shift()); });
await Promise.all(workers);
console.log(`${done} tests, ${failed} failed, ${((Date.now() - began) / 1000).toFixed(0)} s`);
process.exit(failed ? 1 : 0);
