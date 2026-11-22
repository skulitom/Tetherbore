// A copy of the game built as the demo, to run tests and tools in: js/ with the one line tools/build-dist.mjs changes,
// and test/ and tools/ beside it. (The art is linked, not copied.)
//   import { demoTree } from './lib/demo-tree.mjs';
//   const tree = demoTree();  ...  spawnSync(process.execPath, ['test/regress/y-demo-play.mjs'], { cwd: tree.dir });  tree.done();
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { editionFor } from '../../../tools/build-dist.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export function demoTree() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'tetherbore-demo-'));
  for (const part of ['js', 'test', 'tools']) cpSync(path.join(REPO, part), path.join(dir, part), { recursive: true });
  for (const file of readdirSync(path.join(REPO, 'desktop')).filter(f => /\.(cjs|json)$/.test(f) && f !== 'package-lock.json')) cpSync(path.join(REPO, 'desktop', file), path.join(dir, 'desktop', file), { recursive: true });
  writeFileSync(path.join(dir, 'js', 'edition.js'), editionFor(readFileSync(path.join(REPO, 'js', 'edition.js'), 'utf8').replace(/\r\n/g, '\n'), true));
  writeFileSync(path.join(dir, 'package.json'), '{ "type": "module" }\n');
  writeFileSync(path.join(dir, 'desktop', 'package.json'), '{ "type": "commonjs" }\n');
  symlinkSync(path.join(REPO, 'assets'), path.join(dir, 'assets'), 'junction');
  return { dir, done() { rmSync(path.join(dir, 'assets'), { recursive: false, force: true }); rmSync(dir, { recursive: true, force: true }); } };
}
