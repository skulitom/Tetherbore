#!/usr/bin/env node
// Builds every game asset with Pixelbolt.
//
//   node art/build.mjs [--pixelbolt <Pixelbolt checkout>] [--only name,name]
//
// Writes assets/<name>.png for each sheet, assets/atlas.json (every sheet's frames and animations in one file) and
// art/recipes/<name>.json, the compiled recipe of each sheet, to inspect with `pixelbolt inspect`.
// The output is deterministic: the same sources and Pixelbolt commit give the same bytes.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ROCKS, STRAINS, FLOORS, LAVA } from './tiles.mjs';
import { RECIPES, appIcon } from './sprites.mjs';

const ART = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(ART, '..');
const ASSETS = join(ROOT, 'assets');
const KEEP = join(ART, 'recipes');
const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const PIXELBOLT = resolve(option('--pixelbolt') ?? process.env.PIXELBOLT ?? join(ROOT, '..', 'PixelForge'));
const only = option('--only')?.split(',');
const pb = await import(pathToFileURL(join(PIXELBOLT, 'src', 'index.js')).href);

await mkdir(ASSETS, { recursive: true });
await mkdir(KEEP, { recursive: true });

const atlasFile = join(ASSETS, 'atlas.json');
const sheets = only ? JSON.parse(await readFile(atlasFile, 'utf8')) : {};
const wanted = name => !only || only.includes(name);

async function emit(recipe, name = recipe.name, extra = {}) {
  recipe = { ...recipe, name, sheet: { padding: 0, ...recipe.sheet } };
  const project = pb.renderProject(recipe);
  for (const warning of project.warnings) console.warn(`${name}: ${warning}`);
  const atlas = pb.buildAtlas(project);
  await writeFile(join(ASSETS, `${name}.png`), pb.encodePNG(atlas.data, atlas.width, atlas.height));
  await writeFile(join(KEEP, `${name}.json`), JSON.stringify(recipe));
  const frames = {};
  for (const [frame, f] of Object.entries(atlas.metadata.frames)) frames[frame] = [f.frame.x, f.frame.y, f.frame.w, f.frame.h, f.duration];
  const animations = {};
  for (const [animation, a] of Object.entries(atlas.metadata.animations ?? {})) animations[animation] = { frames: a.frames, loop: a.loop };
  sheets[name] = { image: `${name}.png`, frames, animations, ...extra };
  console.log(`${name}: ${project.frames.length} frames, ${atlas.width}x${atlas.height}`);
}

// ---- terrain
for (const source of [...ROCKS, ...STRAINS, ...FLOORS, LAVA]) {
  if (!wanted(source.name)) continue;
  const { recipe } = pb.compileAutotile(source);
  await emit(recipe);
}

// ---- hand-drawn
for (const recipe of RECIPES) if (wanted(recipe.name)) await emit(recipe);

// ---- the home-screen icon, enlarged by whole numbers
if (wanted('icon')) {
  await mkdir(join(ROOT, 'media'), { recursive: true });
  for (const [scale, size] of [[3, 192], [8, 512]]) {
    const atlas = pb.buildAtlas(pb.renderProject({ ...appIcon, sheet: { padding: 0, scale } }));
    await writeFile(join(ROOT, 'media', `icon-${size}.png`), pb.encodePNG(atlas.data, atlas.width, atlas.height));
  }
  await writeFile(join(KEEP, 'icon.json'), JSON.stringify(appIcon));
}

// ---- the font: every printable ASCII character of Pixelbolt's pixel font, laid in a row
if (wanted('font')) {
  const chars = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('') + '×';
  const glyphs = {}, ops = [];
  let x = 1;
  for (const ch of chars) {
    const width = pb.measureText(ch).width;
    glyphs[ch] = [x, width];
    if (ch !== ' ') ops.push({ op: 'text', x, y: 1, text: ch, color: 'w' });
    x += width + 2;
  }
  await emit({ version: 1, name: 'font', width: x, height: 10, palette: { w: '#ffffff' }, frames: [{ name: 'font', ops }] }, 'font', { glyphs });
}

// ---- effects: shipped Pixelbolt presets, one animation each
const EFFECTS = [
  ['sparks', 'effects', 'sparks'],
  ['dust', 'effects', 'dust'],
  ['shatter', 'effects', 'shatter'],
  ['blast', 'fire-explosion', 'fire-explosion'],
  ['zap', 'lightning-spells', 'impact'],
  ['spore', 'poison-spells', 'area'],
  ['haul', 'holy-spells', 'impact'],
  ['bank', 'holy-spells', 'area'],
  ['freeze', 'ice-spells', 'impact'],
  ['steam', 'smoke-puff', 'smoke-puff'],
];
const tmp = join(ART, '.tmp');
await mkdir(tmp, { recursive: true });
for (const [name, preset, animation] of EFFECTS) {
  if (!wanted(name)) continue;
  const out = join(tmp, `${name}.json`);
  const run = spawnSync(process.execPath, [join(PIXELBOLT, 'bin', 'pixelbolt.js'), 'compile', '--preset', preset, '--animation', animation, '--out', out, '--force'], { encoding: 'utf8' });
  if (run.status !== 0) throw new Error(`${name}: ${run.stderr || run.stdout}`);
  await emit(JSON.parse(await readFile(out, 'utf8')), name);
}
await rm(tmp, { recursive: true, force: true });

await writeFile(atlasFile, JSON.stringify(sheets));
console.log(`atlas.json: ${Object.keys(sheets).length} sheets`);
