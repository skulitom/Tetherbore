#!/usr/bin/env node
// Builds the Steam store art.
//
//   node store/art/build.mjs [--pixelbolt <checkout>] [--inkbolt <binary>] [--only name,name]
//
// Pixelbolt draws each picture at its pixel scale from the painters in src/; Inkbolt places the picture and the
// logotype, enlarged by a whole number with nearest sampling, and exports each at the exact size the store asks for
// (docs/STEAM.md, milestone 6). Nothing here is read by the game. `node tools/store-check.mjs` checks the result.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { encodePNG } from '../../tools/png.mjs';
import { logoWide, logoStacked } from './src/logo.mjs';
import { haul, eclipse, cut, backdrop, icon, label } from './src/scenes.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const only = option('--only')?.split(',');

// A sibling checkout, looked for up the tree so that this also runs from a worktree.
const sibling = (...path) => {
  for (let dir = HERE; ; dir = dirname(dir)) {
    if (existsSync(join(dir, ...path))) return join(dir, ...path);
    if (dirname(dir) === dir) return null;
  }
};
const PIXELBOLT = resolve(option('--pixelbolt') ?? process.env.PIXELBOLT ?? sibling('PixelForge', 'src', 'index.js')?.replace(/[\\/]src[\\/]index\.js$/, '') ?? '.');
const INKBOLT = resolve(option('--inkbolt') ?? process.env.INKBOLT ?? sibling('Inkbolt', 'target', 'release', process.platform === 'win32' ? 'inkbolt.exe' : 'inkbolt') ?? 'inkbolt');
const pb = await import(pathToFileURL(join(PIXELBOLT, 'src', 'index.js')).href);

const WORK = mkdtempSync(join(tmpdir(), 'tetherbore-store-'));
process.on('exit', () => rmSync(WORK, { recursive: true, force: true }));

const ink = request => {
  const run = spawnSync(INKBOLT, ['--workspace', WORK], { input: JSON.stringify(request), encoding: 'utf8', maxBuffer: 1 << 28 });
  const reply = JSON.parse(run.stdout || run.stderr);
  if (!reply.ok) throw new Error(`inkbolt ${request.command}: ${JSON.stringify(reply.error)}`);
  return reply.result;
};

// ---- a picture from Pixelbolt, as a file Inkbolt can place
const plates = new Map();
function plate(recipe) {
  const project = pb.renderProject({ ...recipe, sheet: { padding: 0 } });
  for (const w of project.warnings) if (!/clip|outside/i.test(w)) console.warn(`${recipe.name}: ${w}`);
  const atlas = pb.buildAtlas(project);
  const file = `${recipe.name}.png`;
  writeFileSync(join(WORK, file), encodePNG(atlas.width, atlas.height, atlas.data));
  const asset = ink({ command: 'asset.import', source_path: file, color_policy: 'assume_srgb' }).asset;
  const made = { file, asset, w: atlas.width, h: atlas.height };
  plates.set(recipe.name, made);
  return made;
}

// `layers`: [{ plate, k, x, y }], x and y in pixels of the output; `sampling` for reductions.
function compose(id, W, H, layers, out = {}) {
  const assets = {}, items = [];
  layers.forEach((l, n) => {
    const key = `a${n}`;
    assets[key] = l.plate.asset;
    items.push({ id: `layer-${n}`, content: { type: 'image', asset_id: key, width: l.w ?? l.plate.w * l.k, height: l.h ?? l.plate.h * l.k, sampling: l.sampling ?? 'nearest' }, transform: [1, 0, 0, 1, l.x ?? 0, l.y ?? 0] });
  });
  const document = { schema_version: 2, id, kind: 'raster', width: W, height: H, color_space: 'srgb', revision: 0, ...(W * H > 3e6 && { resource_profile: 'large_raster' }), assets, items };
  const file = out.file ?? `out-${id}.png`;
  const format = file.endsWith('.jpg') ? 'jpeg' : 'png';
  ink({ command: 'document.publish', document, output: { file_name: file, format, ...(W * H > 1 << 20 && { render_options: { evaluation: 'tiled' } }), ...(format === 'jpeg' && { image_options: { quality: 95, chroma: 'full' } }) } });
  return { file: join(WORK, file), document };
}
const keep = (made, to = basename(made.file)) => { mkdirSync(dirname(join(HERE, to)), { recursive: true }); copyFileSync(made.file, join(HERE, to)); console.log(to); };
const wanted = name => !only || only.includes(name);

// ---- the logotype, one pixel a pixel
const LOGO = { wide: plate(logoWide()), compact: plate(logoWide({ compact: true })), stacked: plate(logoStacked()) };
mkdirSync(join(HERE, 'logo'), { recursive: true });
for (const [name, make] of Object.entries({ wide: logoWide, compact: () => logoWide({ compact: true }), stacked: logoStacked })) {
  writeFileSync(join(HERE, 'logo', `logo-${name}.recipe.json`), JSON.stringify(make()));
}

// Everything the store takes that carries the title, as the picked concept: the picture, its scale k, and where the
// logo stands, in the picture's own pixels, at the same scale so the two share one pixel grid; or, with `lk`, the logo
// at a scale of its own and `lp` where it stands in the output. Steam's upload asks that the logo fill at least a third
// of a capsule and says not how it is measured, so these hold it to the strictest reading, the logo's box by area.
const SHIFT = (size, k, n) => -Math.floor((n * k - size) / 2);
const CAPSULES = {
  header: { out: [920, 430], k: 4, W: 230, H: 108, paint: (n, W, H) => haul(n, W, H, { block: 'big', cell: 6, at: [136, -2], core: [12, 24, 14], drill: [0.74, 34, 8.5] }), logo: 'compact', at: [36, 74], lk: 6, lp: [22, 234] },
  small: { out: [462, 174], k: 3, W: 154, H: 58, paint: (n, W, H) => haul(n, W, H, { block: 'big', cell: 5, at: [84, -6], core: [6, 8, 8], drill: [0.7, 22, 5.6], tw: 0.9, loop: 1.6, aura: 1.6 }), logo: 'compact', at: [2, 27] },
  main: { out: [1232, 706], k: 5, W: 247, H: 142, paint: (n, W, H) => haul(n, W, H, { block: 'big', cell: 8, at: [140, 0], core: [15, 24, 15], drill: [0.7, 42, 10.5] }), logo: 'stacked', at: [44, 108], lk: 9, lp: [14, 245] },
  vertical: { out: [748, 896], k: 6, W: 125, H: 150, paint: (n, W, H) => haul(n, W, H, { block: 'big', cell: 6, at: [46, 12], core: [10, 8, 9], drill: [0.62, 20, 5.2] }), logo: 'stacked', at: [18, 97], lk: 8, lp: [18, 482] },
  'library-capsule': { out: [600, 900], k: 5, W: 120, H: 180, paint: (n, W, H) => haul(n, W, H, { block: 'big', cell: 6, at: [42, 26], core: [12, 12, 10], drill: [0.6, 22, 5.6] }), logo: 'stacked', at: [15, 127], lk: 7, lp: [-8, 539] },
};
CAPSULES['library-header'] = CAPSULES.header;
const FILES = { header: 'header_capsule.png', small: 'small_capsule.png', main: 'main_capsule.png', vertical: 'vertical_capsule.png', 'library-capsule': 'library_capsule.png', 'library-header': 'library_header.png' };

function capsule(id, c, paint = c.paint) {
  const art = plate(paint(`art-${id}`, c.W, c.H));
  const [W, H] = c.out, x = SHIFT(W, c.k, c.W), y = SHIFT(H, c.k, c.H);
  const logo = LOGO[c.logo];
  const [lx, ly] = c.lp ?? [x + c.at[0] * c.k, y + c.at[1] * c.k];
  return compose(id, W, H, [{ plate: art, k: c.k, x, y }, { plate: logo, k: c.lk ?? c.k, x: lx, y: ly }], { file: `out-${id}.png` });
}
const finals = {};
for (const [id, c] of Object.entries(CAPSULES)) {
  finals[id] = capsule(id, c);
  if (wanted(id)) keep(finals[id], FILES[id]);
}

// ---- no title: the library hero, the page background and the two icons
if (wanted('hero')) {
  const k = 6, W = 640, H = 207;
  // the subject stands inside the middle 860 x 380 of the 3840 x 1240, which every window keeps
  const art = plate(haul('art-hero', W, H, { block: 'big', cell: 6, at: [315, 77], core: [64, 56, 26], drill: [0.87, 28, 7], tw: 1.05, loop: 1.7, aura: 2.2, motes: 150 }));
  keep(compose('hero', 3840, 1240, [{ plate: art, k, y: SHIFT(1240, k, H) }]), 'library_hero.png');
}
if (wanted('background')) {
  const k = 4, W = 360, H = 203;
  const art = plate(backdrop('art-background', W, H));
  keep(compose('background', 1438, 810, [{ plate: art, k, x: SHIFT(1438, k, W), y: SHIFT(810, k, H) }]), 'page_background.png');
}
if (wanted('shortcut')) keep(compose('shortcut', 256, 256, [{ plate: plate(icon('art-shortcut', 64)), k: 4 }]), 'shortcut_icon.png');
if (wanted('app')) keep(compose('app', 184, 184, [{ plate: plate(icon('art-app', 46)), k: 4 }], { file: "out-app.jpg" }), 'app_icon.jpg');
if (wanted('logo')) {
  const k = 8, W = 1280, H = 8 * LOGO.wide.h;
  keep(compose('library-logo', W, H, [{ plate: LOGO.wide, k, x: Math.floor((W - LOGO.wide.w * k) / 2) }]), 'library_logo.png');
  keep(compose('logo-stacked', LOGO.stacked.w * 8, LOGO.stacked.h * 8, [{ plate: LOGO.stacked, k: 8 }]), 'logo/logo-stacked.png');
}

// ---- the three concepts, at the store's sizes
const OTHERS = {
  eclipse: {
    header: (n, W, H) => eclipse(n, W, H, { block: 'big', cell: 6, at: [80, 12], disc: [116, 42, 58], drill: [196, 18, -0.4, 34, 8.5], tail: [[150, 34], [181, 24]] }),
    small: (n, W, H) => eclipse(n, W, H, { block: 'big', cell: 3, at: [60, 2], disc: [78, 16, 34], drill: [128, 12, -0.3, 20, 5], tail: [[96, 14], [118, 13]] }),
  },
  cut: {
    header: (n, W, H) => cut(n, W, H, { block: 'big', cell: 7, at: [122, 8], drill: [102, 52, -0.08, 46, 11.5], tail: [[-4, 14], [80, 54]] }),
    small: (n, W, H) => cut(n, W, H, { block: 'big', cell: 4, at: [86, 0], drill: [70, 14, -0.05, 26, 6.5], tail: [[-4, 4], [58, 15]] }),
  },
};
if (wanted('concepts')) {
  const sets = [
    { name: 'haul', title: '1  THE HAUL  (PICKED)', note: 'THE BLOCK IN FLIGHT, LOOPED AND REELED TO THE CORE', header: finals.header, small: finals.small },
    { name: 'eclipse', title: '2  ECLIPSE', note: 'THE BLOCK BLACK AGAINST THE MOLTEN CORE', header: capsule('eclipse-header', CAPSULES.header, OTHERS.eclipse.header), small: capsule('eclipse-small', CAPSULES.small, OTHERS.eclipse.small) },
    { name: 'cut', title: '3  THE CUT', note: 'THE DRILL IN CLOSE, A LINE OF FIRE ROUND A BLOCK', header: capsule('cut-header', CAPSULES.header, OTHERS.cut.header), small: capsule('cut-small', CAPSULES.small, OTHERS.cut.small) },
  ];
  const SW = 1464, ROW = 484, SH = 28 + ROW * sets.length;
  const page = plate(label('sheet-page', 8, 8));
  const layers = [{ plate: page, k: 1, w: SW, h: SH }];
  sets.forEach((set, n) => {
    const y = 20 + n * ROW;
    if (set.name !== 'haul') { keep(set.header, `concepts/${set.name}_header.png`); keep(set.small, `concepts/${set.name}_small.png`); }
    const head = { asset: ink({ command: 'asset.import', source_path: basename(set.header.file), color_policy: 'assume_srgb' }).asset, w: 920, h: 430 };
    const small = { asset: ink({ command: 'asset.import', source_path: basename(set.small.file), color_policy: 'assume_srgb' }).asset, w: 462, h: 174 };
    layers.push({ plate: plate(label(`title-${set.name}`, 700, 16, set.title, 'w')), k: 2, x: 20, y });
    layers.push({ plate: plate(label(`note-${set.name}`, 460, 8, set.note, 'g')), k: 1, x: 980, y: y + 12 });
    const top = y + 36;
    layers.push({ plate: head, k: 1, x: 20, y: top });
    layers.push({ plate: small, k: 1, x: 980, y: top });
    // the two reductions are made on their own, by area, as a browser shrinks a capsule
    const reduced = (w, h) => {
      const made = compose(`${set.name}-${w}`, w, h, [{ plate: small, k: 1, w, h, sampling: 'area' }]);
      return { asset: ink({ command: 'asset.import', source_path: basename(made.file), color_policy: 'assume_srgb' }).asset, w, h };
    };
    layers.push({ plate: reduced(184, 69), k: 1, x: 980, y: top + 204 });
    layers.push({ plate: reduced(120, 45), k: 1, x: 1184, y: top + 204 });
    layers.push({ plate: plate(label(`s-${set.name}`, 460, 8, 'SMALL 462X174, THEN 184X69 AND 120X45', 'E')), k: 1, x: 980, y: top + 290 });
  });
  keep(compose('concepts', SW, SH, layers), 'concepts.png');
}
console.log('done');
