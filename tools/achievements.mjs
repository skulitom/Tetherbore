#!/usr/bin/env node
// Writes what Steamworks is given for the achievements, from the game's own list (js/achievements.js) and table of
// words (js/words.js):
//
//   node tools/achievements.mjs            desktop/achievements.json
//   node tools/achievements.mjs --icons    and the icons, store/achievements/<API name>_ACHIEVED.png and
//                                          _UNACHIEVED.png, 256 x 256, drawn by Pixelbolt from art/achievements.mjs
//                                          (--pixelbolt <checkout>, or PIXELBOLT, or ../PixelForge)
//   node tools/achievements.mjs --check    says whether desktop/achievements.json is what the list makes
//
// Those file names are the ones the Steamworks achievements page takes in a bulk upload of icons.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ACHIEVEMENTS } from '../js/achievements.js';
import { WORDS } from '../js/words.js';
import { MEDALS, SIZE, ENLARGE, medalRecipe } from '../art/achievements.mjs';
import { encodePNG } from './png.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2);
const OUT = join(ROOT, 'desktop', 'achievements.json'), STORE = join(ROOT, 'store', 'achievements');
const said = new Map(WORDS.map(row => [row[0], row]));
const three = en => { const row = said.get(en); if (!row) throw new Error(`no row in js/words.js for ${en}`); return { english: row[0], russian: row[1], schinese: row[2] }; };

export const manifest = () => ({
  note: 'For the Steamworks achievements page, once the game has its App ID. Made by tools/achievements.mjs; do not edit by hand. Language keys are Steam\'s API language codes. "hidden" is Steam\'s Spoiler visibility.',
  iconSize: 256,
  iconFolder: 'store/achievements',
  achievements: ACHIEVEMENTS.map(a => ({ apiName: a.id, hidden: !!a.hidden, icon: `${a.id}_ACHIEVED.png`, iconLocked: `${a.id}_UNACHIEVED.png`, name: three(a.name), description: three(a.says) })),
});
const text = () => `${JSON.stringify(manifest(), null, 2)}\n`;

if (args.includes('--check')) {
  const same = readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') === text();
  console.log(same ? 'desktop/achievements.json is up to date' : 'desktop/achievements.json differs from the list');
  process.exit(same ? 0 : 1);
}
writeFileSync(OUT, text());
console.log(`${ACHIEVEMENTS.length} achievements written to desktop/achievements.json`);

if (args.includes('--icons')) {
  const at = args.indexOf('--pixelbolt'), checkout = resolve(at >= 0 ? args[at + 1] : process.env.PIXELBOLT ?? join(ROOT, '..', 'PixelForge'));
  const pb = await import(pathToFileURL(join(checkout, 'src', 'index.js')).href);
  // A frame of one of the game's sheets, as Pixelbolt renders its recipe. (A name ending in '-' is the first frame
  // that begins so.)
  const sheets = new Map(), frame = (sheet, name) => {
    if (!sheets.has(sheet)) sheets.set(sheet, pb.renderProject(JSON.parse(readFileSync(join(ROOT, 'art', 'recipes', `${sheet}.json`), 'utf8'))));
    const p = sheets.get(sheet), f = p.frames.find(x => name.endsWith('-') ? x.name.startsWith(name) : x.name === name);
    if (!f) throw new Error(`no frame ${name} in ${sheet}`);
    return { w: p.width, h: p.height, data: f.data };
  };
  const ids = ACHIEVEMENTS.map(a => a.id), lost = ids.filter(id => !MEDALS[id]);
  if (lost.length) throw new Error(`no medal for ${lost.join(', ')}`);
  const recipe = medalRecipe(ids, frame), project = pb.renderProject(recipe);
  for (const warning of project.warnings) console.warn(warning);
  mkdirSync(STORE, { recursive: true });
  writeFileSync(join(STORE, 'medals.recipe.json'), JSON.stringify(recipe));
  const big = SIZE * ENLARGE;
  for (const f of project.frames) {
    const out = new Uint8ClampedArray(big * big * 4);
    for (let y = 0; y < big; y++) for (let x = 0; x < big; x++) {
      const from = 4 * (Math.floor(y / ENLARGE) * SIZE + Math.floor(x / ENLARGE)), to = 4 * (y * big + x);
      for (let c = 0; c < 4; c++) out[to + c] = f.data[from + c];
    }
    const locked = f.name.endsWith('-locked'), id = locked ? f.name.slice(0, -7) : f.name;
    writeFileSync(join(STORE, `${id}_${locked ? 'UNACHIEVED' : 'ACHIEVED'}.png`), encodePNG(big, big, out));
  }
  console.log(`${project.frames.length} icons of ${big} x ${big} written to store/achievements`);
}
