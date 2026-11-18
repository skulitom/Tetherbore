// The site's atlas is written compact (tools/build-dist.mjs: `compactAtlas`) and read back by js/atlas.js
// (`expandAtlas`) into the very object assets/atlas.json is. Of its 782 KB, 107 gzipped, 237 were the animations
// listing every frame of their sheet over again (102 of the 118 sheets' 'default', and a dozen more); compact it is
// 24 KB gzipped, and JSON.parse reads it in a third of the time or less. A frame out of order would draw the wrong picture where a sheet's frames are taken by their
// order (a terrain sheet is known by its first frame's name, an animation plays its frames in turn), so the order is
// held as the keys are.
//   node test/regress/t-atlas-compact.mjs
// Held here:
//   - assets/atlas.json compacted and expanded again is the same object, every key in the same order at every depth
//     (compared as JSON text), each sheet's frames and animations in the same order, and no array shared;
//   - an atlas written out in full is left by expandAtlas as it is;
//   - compact, no sheet's frames are written out by name and rectangle, and only animations of every frame in order
//     are `all`; the compact atlas is under a third of the full one gzipped;
//   - withPreloads asks for every sheet's image the atlas names, once each, after the atlas's own preload.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { expandAtlas } from '../../js/atlas.js';
import { compactAtlas, withPreloads } from '../../tools/build-dist.mjs';

const problems = [], note = text => { if (problems.length < 20) problems.push(text); };
const text = readFileSync(new URL('../../assets/atlas.json', import.meta.url), 'utf8'), atlas = JSON.parse(text);
const compact = JSON.stringify(compactAtlas(JSON.parse(text)));
const back = expandAtlas(JSON.parse(compact));

if (JSON.stringify(back) !== JSON.stringify(atlas)) {
  for (const name of Object.keys(atlas)) if (JSON.stringify(back[name]) !== JSON.stringify(atlas[name])) note(`${name} does not come back as it was`);
  if (Object.keys(back).join() !== Object.keys(atlas).join()) note('the sheets are not in their order');
  if (!problems.length) note('the atlas does not come back as it was');
}
for (const [name, sheet] of Object.entries(atlas)) {
  const b = back[name];
  if (!b) continue;
  if (Object.keys(b.frames).join('|') !== Object.keys(sheet.frames).join('|')) note(`${name}'s frames are not in their order`);
  if (Object.keys(b.animations).join('|') !== Object.keys(sheet.animations).join('|')) note(`${name}'s animations are not in their order`);
  for (const [key, a] of Object.entries(b.animations)) {
    if (Object.keys(a).join() !== Object.keys(sheet.animations[key]).join()) note(`${name}'s ${key} has keys ${Object.keys(a)}`);
    if (Object.values(b.animations).some(o => o !== a && o.frames === a.frames)) note(`${name}'s ${key} shares its frames with another`);
  }
}
const whole = JSON.parse(text);
if (JSON.stringify(expandAtlas(whole)) !== JSON.stringify(atlas)) note('expandAtlas changed an atlas written out in full');

const small = JSON.parse(compact);
let all = 0;
for (const [name, sheet] of Object.entries(small)) {
  if (!Array.isArray(sheet.frames.n) || sheet.frames.r.length !== 5 * sheet.frames.n.length) note(`${name}'s frames are not compact`);
  for (const [key, a] of Object.entries(sheet.animations)) if (a.all) { all++; if (JSON.stringify(atlas[name].animations[key].frames) !== JSON.stringify(Object.keys(atlas[name].frames))) note(`${name}'s ${key} is not every frame in order`); }
}
if (all < 100) note(`only ${all} animations of every frame are written short`);
const gz = s => gzipSync(s, { level: 6 }).length;
if (gz(compact) * 3 > gz(text.replace(/\r\n/g, '\n'))) note(`compact is ${gz(compact)} bytes gzipped against ${gz(text)}`);

const html = withPreloads(readFileSync(new URL('../../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n'), atlas);
const images = [...html.matchAll(/<link rel="preload" as="image" href="assets\/([^"]+)">/g)].map(m => m[1]), named = [...new Set(Object.values(atlas).map(s => s.image))];
if (images.join() !== named.join()) note(`the images preloaded are ${images.length}, not the ${named.length} the atlas names in its order`);
if (html.indexOf('as="image"') < html.indexOf('href="assets/atlas.json"')) note('the images are preloaded before the atlas');

if (problems.length) { console.log(`FAIL t-atlas-compact: ${problems.join('; ')}`); process.exit(1); }
console.log(`ok t-atlas-compact: ${Object.keys(atlas).length} sheets come back as they were; ${gz(compact)} bytes gzipped against ${gz(text.replace(/\r\n/g, '\n'))}; ${images.length} images preloaded`);
