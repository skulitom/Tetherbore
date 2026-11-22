// Builds the game for Steam: the site as it is deployed (tools/build-dist.mjs), in an Electron app for 64-bit Windows,
// which is also what a Steam Deck runs through Proton.
//   node desktop/package.mjs [--demo] [--esbuild <esbuild's folder>]
// Writes desktop/out/Tetherbore-win32-x64, the folder a Steam depot is made from; with --demo the demo, its site built
// with --demo and its own App ID (desktop/app-id-demo.json, null until the demo's app exists), to
// desktop/out-demo/Tetherbore Demo-win32-x64.
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), repo = path.resolve(here, '..');
const require = createRequire(path.join(here, 'package.json'));
const { packager } = require('@electron/packager');
const demo = process.argv.includes('--demo'), title = demo ? 'Tetherbore Demo' : 'Tetherbore';
const at = process.argv.indexOf('--esbuild');
const esbuild = at > 0 ? process.argv[at + 1] : process.env.TB_ESBUILD ?? path.resolve(repo, '..', 'NeonVoyage', 'node_modules', 'esbuild');
const run = (command, args) => { const r = spawnSync(command, args, { cwd: repo, stdio: 'inherit' }); if (r.status !== 0) throw new Error(`${command} ${args[0]} failed`); };

const work = mkdtempSync(path.join(os.tmpdir(), 'tetherbore-package-'));
try {
  const site = path.join(work, 'game');
  run(process.execPath, ['tools/build-dist.mjs', site, '--esbuild', esbuild, ...(demo ? ['--demo'] : [])]);
  const icon = path.join(work, 'icon.ico'), art = [path.join(repo, 'store', 'art', 'shortcut_icon.png'), path.join(repo, 'media', 'icon-512.png')].find(existsSync);
  run('ffmpeg', ['-v', 'error', '-y', '-i', art, '-vf', 'scale=256:256:flags=neighbor', icon]);
  // The licences of what ships, as files beside the game (`resources/licenses`, which the credits point to): Electron's
  // own and Chromium's also stand at the top of the app's folder.
  const notices = path.join(work, 'licenses');
  mkdirSync(notices);
  for (const [from, name] of [[path.join(here, 'node_modules', 'electron', 'LICENSE'), 'electron.txt'], [path.join(here, 'node_modules', 'steamworks.js', 'LICENSE'), 'steamworks.js.txt'], [path.join(repo, 'art', 'OFL-fusion-pixel.txt'), 'fusion-pixel-font-OFL.txt']]) cpSync(from, path.join(notices, name));
  const out = path.join(here, demo ? 'out-demo' : 'out');
  rmSync(out, { recursive: true, force: true });
  const keep = new Set(['package.json', 'main.cjs', 'preload.cjs', 'saves.cjs', 'steam.cjs', 'achievements.json', 'app-id.json', 'node_modules']);
  const [built] = await packager({
    dir: here, out, name: title, executableName: demo ? 'TetherboreDemo' : 'Tetherbore', platform: 'win32', arch: 'x64', overwrite: true, icon,
    appVersion: require('./package.json').version,
    asar: { unpack: '**/*.{node,dll}' },
    extraResource: [site, notices],
    win32metadata: { ProductName: title, FileDescription: title },
    // (The demo's own App ID, and the word that it is the demo, in place of the game's.)
    afterCopy: demo ? [({ buildPath }) => copyFileSync(path.join(here, 'app-id-demo.json'), path.join(buildPath, 'app-id.json'))] : [],
    // Only the shell and what it needs at run time, and of the Steam library only its Windows files.
    ignore: file => {
      if (!file) return false;
      const parts = file.split('/').filter(Boolean);
      if (!keep.has(parts[0])) return true;
      if (parts[0] === 'node_modules' && parts[1] === 'steamworks.js' && parts[2] === 'dist' && parts[3] && parts[3] !== 'win64') return true;
      return false;
    },
  });
  const size = dir => readdirSync(dir, { withFileTypes: true }).reduce((sum, e) => sum + (e.isDirectory() ? size(path.join(dir, e.name)) : statSync(path.join(dir, e.name)).size), 0);
  console.log(`${path.relative(repo, built)}: ${(size(built) / 1048576).toFixed(0)} MB`);
} finally { rmSync(work, { recursive: true, force: true }); }
