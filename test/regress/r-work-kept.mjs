// What a frame leaves for the collector, and work done once that is not done again, counted, not timed.
//   - Over the fuzz's flight (seed 11, 200 turns, the tether at 5 and the bit at 4, every other row at its last, 180
//     by 320), the bytes update() and render() allocate a frame, exactly (tools/bench/alloc-child.mjs, the used heap
//     before and after each with a young generation too large to be swept in the flight), are held under what the
//     step and the drawing were brought down to, with four or five in a hundred to spare: update 88 KB a frame,
//     where it was 125 KB at 2a64872 (96 KB with `along` back in `drawIn` alone), and render 183 KB, where it was
//     596 KB at 2a64872 and 324 KB with text drawn a line at a time but the drawing's lists made anew. Measured
//     with node 24.19 (runs move by a hundredth): another V8 may count otherwise, and the figures are then to be
//     measured again (`node tools/bench.mjs alloc` says them for a root, with the turns at 600).
//   - Where a key of the lab lies (js/worth.js, `placeOf`) is found once a key: asking every key's worth at every
//     level of the winch again finds none again.
//   node test/regress/r-work-kept.mjs
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { LAB } from '../../js/shop.js';
import { placesFound, worthOf, LUMP_ROCK } from '../../js/worth.js';

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const MOST = { update: 92000, render: 192000 };

// ---- bytes a frame
const root = fileURLToPath(new URL('../../', import.meta.url)), child = fileURLToPath(new URL('../../tools/bench/alloc-child.mjs', import.meta.url));
const run = spawnSync(process.execPath, ['--no-warnings', '--max-semi-space-size=512', '--min-semi-space-size=512', child, root, 'bytes', '--turns', '200'], { encoding: 'utf8' });
let out = null;
try { out = JSON.parse(run.stdout.trim().split('\n').pop()); } catch { check(false, `the flight did not say what it allocated: ${(run.stderr || run.stdout).slice(-300)}`); }
if (out) {
  check(out.frames > 6000 && out.update.counted > out.frames * 0.95 && out.render.counted > out.frames * 0.95, `the flight counted ${out.update.counted} and ${out.render.counted} of ${out.frames} frames`);
  for (const part of ['update', 'render']) check(out[part].mean <= MOST[part], `${part}() allocates ${(out[part].mean / 1024).toFixed(1)} KB a frame, more than ${(MOST[part] / 1024).toFixed(1)} (node ${process.versions.node})`);
}

// ---- where a key lies, found once
const before = placesFound();
for (let again = 0; again < 3; again++) for (let l = 0; l < LUMP_ROCK.length; l++) for (const e of LAB) worthOf(e.key, l);
const after = placesFound();
check(before.keys === new Set(LAB.map(e => e.key)).size && before.found === before.keys && after.found === before.found, `the places of ${before.keys} keys were found ${before.found} times as worth.js was loaded, and ${after.found - before.found} times more after`);

if (fails.length) { console.log(`FAIL r-work-kept: ${fails.join('; ')}`); process.exit(1); }
console.log(`ok r-work-kept: a frame allocates ${(out.update.mean / 1024).toFixed(1)} KB in update and ${(out.render.mean / 1024).toFixed(1)} KB in render, and a key's place is found once`);
