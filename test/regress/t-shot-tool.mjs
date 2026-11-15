// tools/shot.mjs, run as it is run by hand: a PNG of the size asked for is written and its path is the last line
// printed; the picture is of something (many colours, not one); `--lit` at the same place is brighter; `--zoom`
// keeps the picture's size. Arguments that cannot be met are refused before any browser is started. Where no Edge
// or Chrome is installed the tool says so (exit 3) and the pictures are passed over, with a line to say so.
// Nothing here is timed. The pictures go in a folder of their own under the system's temp folder, removed after.
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG } from '../../tools/png.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url)), fails = [];
const check = (ok, what) => { if (!ok) fails.push(what); };
const run = (tool, ...args) => spawnSync(process.execPath, [path.join(root, 'tools', tool), ...args], { cwd: root, encoding: 'utf8' });
const folder = await mkdtemp(path.join(os.tmpdir(), 'tetherbore-test-'));
// How many colours a picture has, and how bright it is on the whole.
const look = ({ width, height, data }) => {
  const colours = new Set();
  let light = 0;
  for (let o = 0; o < data.length; o += 4) { colours.add(data[o] << 16 | data[o + 1] << 8 | data[o + 2]); light += data[o] + data[o + 1] + data[o + 2]; }
  return { colours: colours.size, light: light / (width * height * 3) };
};

try {
  // Refused before a browser is started.
  for (const [why, ...args] of [['no place to write', '--at', '0,-300'], ['a place beyond the world', 'x.png', '--at', '0,-5000'], ['an unknown option', 'x.png', '--nearer'], ['a zoom of nothing', 'x.png', '--zoom', '0'], ['a file that is not a PNG', 'x.jpg']]) {
    check(run('shot.mjs', ...args).status === 2, `tools/shot.mjs did not refuse ${why}`);
  }

  const dark = path.join(folder, 'dark.png'), first = run('shot.mjs', dark, '--at', '0,-300', '--frames', '30');
  if (first.status === 3) console.log('note: no Edge or Chrome is installed here, so tools/shot.mjs took no pictures');
  else {
    check(first.status === 0, `tools/shot.mjs failed: ${(first.stdout + first.stderr).trim().slice(-600)}`);
    check(first.stdout.trim().split('\n').pop().trim() === dark, `the last line printed is not the path written: ${first.stdout.trim().split('\n').pop()}`);
    check(/300 north of the core, in frost/.test(first.stdout), `the tool does not say where the drill stands: ${first.stdout.trim()}`);
    const lit = path.join(folder, 'lit.png'), wide = path.join(folder, 'wide.png');
    check(run('shot.mjs', lit, '--at=0,-300', '--frames', '30', '--lit').status === 0, 'tools/shot.mjs --lit failed');
    check(run('shot.mjs', wide, '--at', '0,-300', '--frames', '0', '--size', '400x300', '--zoom', '4', '--lit').status === 0, 'tools/shot.mjs --zoom failed');
    if (!fails.length) {
      const a = decodePNG(await readFile(dark)), b = decodePNG(await readFile(lit)), c = decodePNG(await readFile(wide));
      const la = look(a), lb = look(b), lc = look(c);
      check(a.width === 360 && a.height === 640 && b.width === 360 && b.height === 640, `the pictures are ${a.width} x ${a.height} and ${b.width} x ${b.height}, not 360 x 640`);
      check(c.width === 400 && c.height === 300, `the zoomed picture is ${c.width} x ${c.height}, not 400 x 300`);
      check(la.colours > 60 && lb.colours > 60 && lc.colours > 60, `a picture shows next to nothing: ${la.colours}, ${lb.colours} and ${lc.colours} colours`);
      check(lb.light > la.light * 1.15, `--lit is no brighter (${lb.light.toFixed(1)}) than the dark (${la.light.toFixed(1)})`);
    }
  }
} finally {
  await rm(folder, { recursive: true, force: true }).catch(() => {});
}
if (fails.length) { console.log(`FAIL: ${fails.join('\n      ')}`); process.exit(1); }
console.log('ok: the shots are written, of the size and the place asked for');
