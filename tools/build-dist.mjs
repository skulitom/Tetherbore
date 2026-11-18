// The site as it is deployed: the files a browser loads, made smaller and asked for sooner, in a folder of their own
// (GitHub Pages and itch.io are given that folder, .github/workflows/static.yml and itch.yml). Nothing the game does
// or draws changes: every module is the same module, the atlas the same object once read.
//   node tools/build-dist.mjs <outdir> [--esbuild <esbuild's folder>] [--check]
//
// What it writes:
//   - index.html, manifest.webmanifest, css/, js/, assets/ and media/, the files a browser loads. (Nothing anyone
//     can open links into docs/, test/, tools/ or art/: index.html, the manifest and the stylesheet name only these,
//     and the README's links are the repository's, read on GitHub, not the site's. So those stay out.)
//   - each module of js/ through esbuild's transform on its own, whitespace and comments taken out and nothing else
//     (format esm, minifyWhitespace, legalComments none, target es2022): the 1.19 MB of the modules a first load
//     reads, mostly comments and indentation, 384 KB gzipped, are 566 KB, 192 gzipped. charset utf8 keeps the Cyrillic and the Chinese of js/words.js as they are,
//     where escaped they would make it 128 KB and not 72. Not bundled: each module stays a file of its own, so that
//     index.html's modulepreload list (held to the import graph by test/regress/t-page-preload.mjs) asks for each,
//     and esbuild's bundle breaks on the cycle between js/game.js and js/drawing.js.
//   - assets/atlas.json compact (`compactAtlas`): a sheet's frames as a list of names, with the sheet's own name and
//     a hyphen taken off the front where every one has them, and their rectangles in one flat list; an animation of
//     every frame in order as `all`. js/atlas.js (`expandAtlas`) makes it again into the very object the art build
//     wrote, which the repository keeps (the art build, the python tools and the tests read it);
//     test/regress/t-atlas-compact.mjs holds that, key order and all. 237 KB of the atlas's 782 was animations
//     listing every frame of their sheet over again; it was 107 KB gzipped and is 24.
//   - into index.html, after the atlas's preload, a preload of every sheet's image the atlas names, made from it:
//     the game asks for them only once every module has run and the atlas has been read, and they then came last.
//     (`new Image()` asks for an image as a preload `as="image"` without crossorigin does, so it takes the
//     preloaded response and nothing is fetched twice.)
// Text is written with LF endings, as Pages serves a checkout on Linux.
//
// esbuild is not in the repository: `--esbuild` names the folder of its package (C:/DEV/NeonVoyage/node_modules/
// esbuild here; in the workflows esbuild@0.20.2, installed with --no-save into a folder of the runner's own), or
// TB_ESBUILD does. The output folder is made afresh; one that holds anything the build does not write is refused.
//
// --check then puts the repository's test/ and tools/ beside the built js/ and assets/ in a folder of its own and
// runs the unattended play of every direction (test/smoke.mjs) and the two that hold two games frame for frame the
// same (s6-feel, s7-fit) there, with the built modules and the compact atlas; and checks that the compact atlas
// is read as the repository's is and that every file index.html asks for is there. Exits 1 if any of it fails.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// What a browser loads, and so all the output folder may hold.
export const SHIPPED = ['index.html', 'manifest.webmanifest', 'css', 'js', 'assets', 'media'];
export const TRANSFORM = { loader: 'js', format: 'esm', minifyWhitespace: true, legalComments: 'none', charset: 'utf8', target: 'es2022' };

// The atlas compact: see the head. Every frame's rectangle is five numbers (x, y, w, h, ms).
export function compactAtlas(atlas) {
  const out = {};
  for (const [name, sheet] of Object.entries(atlas)) {
    const names = Object.keys(sheet.frames), pre = names.length > 0 && names.every(n => n.startsWith(`${name}-`));
    const r = [];
    for (const n of names) {
      const rect = sheet.frames[n];
      if (!Array.isArray(rect) || rect.length !== 5 || !rect.every(Number.isFinite)) throw new Error(`atlas: ${name}'s frame ${n} is not five numbers`);
      r.push(...rect);
    }
    const every = JSON.stringify(names), animations = {};
    for (const [key, a] of Object.entries(sheet.animations)) {
      const plain = Object.keys(a).join() === 'frames,loop';
      animations[key] = plain && JSON.stringify(a.frames) === every ? { all: 1, loop: a.loop } : a;
    }
    // (Every other key of the sheet, its image, glyphs, map and the rest, as it is and where it is.)
    const sheetOut = {};
    for (const [key, v] of Object.entries(sheet)) sheetOut[key] = key === 'frames' ? { n: names.map(n => pre ? n.slice(name.length + 1) : n), r, p: pre ? 1 : 0 } : key === 'animations' ? animations : v;
    out[name] = sheetOut;
  }
  return out;
}
// The preloads of the sheets' images, in the order the atlas has them, after the atlas's own.
export function withPreloads(html, atlas) {
  const images = [...new Set(Object.values(atlas).map(s => s.image))];
  const anchor = /^<link rel="preload" href="assets\/atlas\.json"[^>]*>\n/m;
  if (!anchor.test(html)) throw new Error('index.html has no preload of assets/atlas.json to put the images after');
  const links = images.map(file => `<link rel="preload" as="image" href="assets/${file}">\n`).join('');
  return html.replace(anchor, m => `${m}<!-- (Every sheet's image the atlas names, asked for at once: written by tools/build-dist.mjs.) -->\n${links}`);
}

const lf = text => text.replace(/\r\n/g, '\n');
function esbuildAt(given) {
  const where = given ?? process.env.TB_ESBUILD;
  const require = createRequire(path.join(REPO, 'package.json'));
  try { return require(where ? path.resolve(where) : 'esbuild'); } catch (error) {
    console.error(`No esbuild${where ? ` at ${where}` : ''} (${error.message.split('\n')[0]}). Name its package's folder with --esbuild or TB_ESBUILD; it is not in the repository (npm install --no-save --no-package-lock esbuild@0.20.2 into a folder of its own).`);
    process.exit(2);
  }
}
function fresh(out) {
  const resolved = path.resolve(out);
  if (REPO === resolved || REPO.startsWith(resolved + path.sep)) throw new Error(`${out} is the repository or holds it`);
  if (existsSync(resolved)) {
    const strange = readdirSync(resolved).filter(f => !SHIPPED.includes(f));
    if (strange.length) throw new Error(`${out} holds ${strange.slice(0, 5).join(', ')}, which the build does not write: not cleared`);
    rmSync(resolved, { recursive: true, force: true });
  }
  mkdirSync(resolved, { recursive: true });
  return resolved;
}

export function build(out, esbuild) {
  const dir = fresh(out), counts = { files: 0, jsIn: 0, jsOut: 0, atlasIn: 0, atlasOut: 0, images: 0 };
  for (const part of ['css', 'media', 'assets']) cpSync(path.join(REPO, part), path.join(dir, part), { recursive: true });
  for (const file of ['manifest.webmanifest']) writeFileSync(path.join(dir, file), lf(readFileSync(path.join(REPO, file), 'utf8')));
  for (const file of readdirSync(path.join(dir, 'css'))) writeFileSync(path.join(dir, 'css', file), lf(readFileSync(path.join(dir, 'css', file), 'utf8')));
  mkdirSync(path.join(dir, 'js'));
  for (const file of readdirSync(path.join(REPO, 'js')).filter(f => f.endsWith('.js')).sort()) {
    const source = readFileSync(path.join(REPO, 'js', file), 'utf8');
    const { code, warnings } = esbuild.transformSync(source, { ...TRANSFORM, sourcefile: `js/${file}` });
    for (const w of warnings) console.warn(`js/${file}: ${w.text}`);
    writeFileSync(path.join(dir, 'js', file), code);
    counts.jsIn += Buffer.byteLength(lf(source)); counts.jsOut += Buffer.byteLength(code);
  }
  const atlasText = readFileSync(path.join(REPO, 'assets', 'atlas.json'), 'utf8'), atlas = JSON.parse(atlasText), compact = JSON.stringify(compactAtlas(atlas));
  writeFileSync(path.join(dir, 'assets', 'atlas.json'), compact);
  counts.atlasIn = Buffer.byteLength(atlasText); counts.atlasOut = Buffer.byteLength(compact);
  const html = withPreloads(lf(readFileSync(path.join(REPO, 'index.html'), 'utf8')), atlas);
  writeFileSync(path.join(dir, 'index.html'), html);
  counts.images = new Set(Object.values(atlas).map(s => s.image)).size;
  const walk = d => readdirSync(d).reduce((n, f) => n + (statSync(path.join(d, f)).isDirectory() ? walk(path.join(d, f)) : 1), 0);
  counts.files = walk(dir);
  return { dir, counts };
}

// --check: see the head.
export async function check(dir) {
  const problems = [];
  // Every file index.html asks for is there.
  const html = readFileSync(path.join(dir, 'index.html'), 'utf8');
  for (const [, href] of html.matchAll(/(?:href|src)="([^"#?:]+)"/g)) if (!existsSync(path.join(dir, href))) problems.push(`index.html asks for ${href}, which is not there`);
  // The tests, beside the built modules (with a package.json saying they are modules, so that node reads them as
  // such at once and says nothing of it).
  const tree = mkdtempSync(path.join(os.tmpdir(), 'tetherbore-dist-check-'));
  try {
    cpSync(path.join(dir, 'js'), path.join(tree, 'js'), { recursive: true });
    cpSync(path.join(dir, 'assets'), path.join(tree, 'assets'), { recursive: true });
    cpSync(path.join(REPO, 'test'), path.join(tree, 'test'), { recursive: true });
    cpSync(path.join(REPO, 'tools'), path.join(tree, 'tools'), { recursive: true });
    writeFileSync(path.join(tree, 'package.json'), '{ "type": "module" }\n');
    // The compact atlas is read by the built js/atlas.js as the repository's is.
    const { expandAtlas } = await import(pathToFileURL(path.join(tree, 'js', 'atlas.js')).href);
    const built = expandAtlas(JSON.parse(readFileSync(path.join(tree, 'assets', 'atlas.json'), 'utf8')));
    if (JSON.stringify(built) !== JSON.stringify(JSON.parse(readFileSync(path.join(REPO, 'assets', 'atlas.json'), 'utf8')))) problems.push('the built atlas is not read as the repository\'s is');
    for (const test of ['test/smoke.mjs', 'test/regress/s6-feel.mjs', 'test/regress/s7-fit.mjs']) {
      const t0 = Date.now(), run = spawnSync(process.execPath, [test], { cwd: tree, encoding: 'utf8', maxBuffer: 1 << 28 });
      const last = (run.status === 0 ? run.stdout ?? '' : `${run.stdout ?? ''}${run.stderr ?? ''}`).trim().split('\n').slice(-1)[0] ?? '';
      console.log(`${run.status === 0 ? 'ok  ' : 'FAIL'} ${test} with the built modules (${((Date.now() - t0) / 1000).toFixed(0)} s): ${last.slice(0, 160)}`);
      if (run.status !== 0) problems.push(`${test} failed with the built modules: ${last}`);
    }
  } finally { rmSync(tree, { recursive: true, force: true }); }
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), opts = { check: false, esbuild: null, out: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--check') opts.check = true;
    else if (args[i] === '--esbuild') opts.esbuild = args[++i];
    else if (!args[i].startsWith('--') && !opts.out) opts.out = args[i];
    else { console.error(`What is ${args[i]}?\n  node tools/build-dist.mjs <outdir> [--esbuild <esbuild's folder>] [--check]`); process.exit(2); }
  }
  if (!opts.out) { console.error('  node tools/build-dist.mjs <outdir> [--esbuild <esbuild\'s folder>] [--check]'); process.exit(2); }
  const esbuild = esbuildAt(opts.esbuild);
  const { dir, counts: c } = build(opts.out, esbuild);
  const kb = n => `${(n / 1024).toFixed(0)} KB`;
  console.log(`${dir}: ${c.files} files with esbuild ${esbuild.version}; js ${kb(c.jsIn)} -> ${kb(c.jsOut)}, atlas.json ${kb(c.atlasIn)} -> ${kb(c.atlasOut)}, ${c.images} images preloaded`);
  if (opts.check) {
    const problems = await check(dir);
    if (problems.length) { console.log(`FAIL ${problems.join('; ')}`); process.exit(1); }
    console.log('ok: the built site plays as the repository does');
  }
}
