// tools/field.mjs, run as it is run by hand: every pixel of the map is the map colour of the ground the world says
// is there (checked where two grounds meet), the core is a white dot, and the last line printed is the path
// written. The maps go in a folder of their own under the system's temp folder, removed after.
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG } from '../../tools/png.mjs';
import { World, C, BIOMES } from '../../js/world.js';

const root = fileURLToPath(new URL('../../', import.meta.url)), fails = [];
const check = (ok, what) => { if (!ok) fails.push(what); };
const run = (tool, ...args) => spawnSync(process.execPath, [path.join(root, 'tools', tool), ...args], { cwd: root, encoding: 'utf8' });
const folder = await mkdtemp(path.join(os.tmpdir(), 'tetherbore-test-'));

try {
  check(run('field.mjs', 'x.png', '--size', '3').status === 2 && run('field.mjs', '--size', '64').status === 2, 'tools/field.mjs did not refuse a square of nothing, or no place to write');
  // 64 cells round a place where two grounds meet, and round the core.
  const edge = path.join(folder, 'edge.png'), home = path.join(folder, 'home.png');
  const made = run('field.mjs', edge, '--seed', '7', '--at', '0,-130', '--size', '64');
  check(made.status === 0 && made.stdout.trim().split('\n').pop().trim() === edge, `tools/field.mjs failed: ${(made.stdout + made.stderr).trim().slice(-400)}`);
  check(run('field.mjs', home, '--seed', '7', '--size', '64').status === 0, 'tools/field.mjs failed at the core');
  if (made.status === 0) {
    const map = decodePNG(await readFile(edge)), world = new World(), grounds = new Set();
    world.reset(7);
    let wrongAt = null;
    for (let v = 0; v < 64 && !wrongAt; v++) for (let u = 0; u < 64; u++) {
      const b = world.biomeAt(C - 32 + u, C - 130 - 32 + v), o = (v * 64 + u) * 4;
      grounds.add(b);
      if (map.data[o] !== BIOMES[b].map[0] || map.data[o + 1] !== BIOMES[b].map[1] || map.data[o + 2] !== BIOMES[b].map[2]) { wrongAt = [u - 32, v - 162]; break; }
    }
    check(map.width === 64 && map.height === 64 && !wrongAt, `the field's pixel for cell ${wrongAt} is not its ground's map colour`);
    check(grounds.size > 1, 'the field was checked where only one ground lies');
    const core = decodePNG(await readFile(home)), o = (32 * 64 + 32) * 4;
    check(core.data[o] === 255 && core.data[o + 1] === 255 && core.data[o + 2] === 255, 'the core is not a white dot on the field');
  }
} finally {
  await rm(folder, { recursive: true, force: true }).catch(() => {});
}
if (fails.length) { console.log(`FAIL: ${fails.join('\n      ')}`); process.exit(1); }
console.log('ok: the field is the map colour of the ground that lies there');
