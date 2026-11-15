// Every test in one command: each script in test/regress (each fails while the defect it was written for is there),
// the smoke test, and the rope fuzz on seeds 11 to 18 from the core, from a start 200 cells out each way and from
// inside a province of each strain of ground, and from a deep flank.
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
    [3, 300, 0, 170, 0.08, 5, 'second'], [5, 300, -170, 0, 0.08, 5, 'second'], [6, 300, 170, 0, 0.08, 5, 'second'],
    // Inside a province of sporefall (pods in bunches, which go off together) and one of forge (lava that pours further).
    [7, 300, -384, -128, 0.08, 7], [7, 300, 128, 384, 0.08, 7],
    // The east's own ground with few hazards planted, so that the crystals are mostly the world's own, on the
    // flanks of its slate: their arcs shatter the slate beside the string.
    [8, 300, 200, 0, 0.02]],
  'f-big': [[71], [250], [205, 'jog'], [150, 'bump']],
  'f-freed-diff': [[1, 4000, 14, 0.55], [5, 6000, 20, 0.62], [9, 3000, 20, 0.62]],
  'f-fuzz-books': [[2, 300], [7, 300], [9, 300], [12, 300]],
  'f-wreck': [[7, 0], [32, 0], [61, 0], [63, 0]],
  'g-far-wreck': [[7, 5, 60], [7, 7, 60]],
  'i-fuzz-play': [[45, 500, 5, 0, 0, 30], [33, 400, 5, 60, 210, 60], [60, 400, 5, 141, 141, 60], [50, 400, 5, 60, 210, 60], [57, 260, 9, -1061, 1061, 'mix'],
    [39, 260, 1, 0, 0, 60, 'lowdrill,home'], [51, 260, 5, 141, 141, 60, 'bombs,forceshop'],
    // From a start inside a province of each strain (`node tools/strains.mjs --where 7` and `--where 11` say where):
    // firn, serac, scoria, forge, tangle, sporefall, redrock, loess.
    [7, 300, 7, -128, -384, 60], [7, 300, 7, 128, -384, 'mix'], [7, 300, 7, -128, 384, 60], [7, 300, 7, 128, 384, 60, 'bombs'],
    [11, 300, 7, -384, 128, 60], [7, 300, 7, -384, -128, 60], [11, 300, 7, 384, -384, 60], [7, 300, 7, 384, -128, 30],
    // The east's own ground, where arcs shatter slate (with bombs too, at mixed frame lengths), the south's own,
    // where lava quenches its slag to steel, and the north's own, where a cut beside ore heals as ore.
    [21, 300, 5, 190, 10, 60], [23, 300, 5, 190, 10, 'mix', 'bombs'], [22, 300, 5, 20, 180, 60], [24, 300, 5, 10, -190, 60]],
};
const tests = [];
for (const file of readdirSync(here + 'regress').filter(name => name.endsWith('.mjs')).sort()) {
  for (const args of ARGS[file.slice(0, -4)] ?? [[]]) tests.push({ name: `regress/${file}${args.length ? ' ' + args.join(' ') : ''}`, run: [`regress/${file}`, ...args] });
}
tests.push({ name: 'smoke.mjs', run: ['smoke.mjs'] });
for (let seed = 11; seed <= 18; seed++) tests.push({ name: `rope-fuzz.mjs ${seed} 600 5`, run: ['rope-fuzz.mjs', seed, 600, 5] });
// North is up the screen: negative y.
for (const [seed, x, y, way] of [[11, 0, -200, 'north'], [12, 0, 200, 'south'], [13, 200, 0, 'east'], [14, -200, 0, 'west']]) tests.push({ name: `rope-fuzz.mjs ${seed} 600 5 ${x} ${y} (${way})`, run: ['rope-fuzz.mjs', seed, 600, 5, x, y] });

// And from inside a province of each strain, where the ground has shapes of its own for the string to lie on.
for (const [seed, x, y, strain] of [[7, -128, -384, 'firn'], [7, 128, -384, 'serac'], [7, -128, 384, 'scoria'], [7, 128, 384, 'forge'], [11, -384, 128, 'tangle'], [7, -384, -128, 'sporefall'], [11, 384, -384, 'redrock'], [7, 384, -128, 'loess']]) {
  tests.push({ name: `rope-fuzz.mjs ${seed} 400 7 ${x} ${y} (${strain})`, run: ['rope-fuzz.mjs', seed, 400, 7, x, y] });
}

// And in a deep flank, where the crystals and the lava are thickest.
tests.push({ name: 'rope-fuzz.mjs 31 400 9 1000 1000 (deep south-east)', run: ['rope-fuzz.mjs', 31, 400, 9, 1000, 1000] });

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
