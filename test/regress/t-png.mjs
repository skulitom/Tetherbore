// tools/png.mjs, which writes the game's art: a picture of few colours is written as a palette and reads back
// exactly as it was given, down to the colour under a clear pixel and an alpha between; one of more than 256 colours
// is written as RGBA and reads back the same; and every sheet in assets/ is a palette picture that reads, as
// art/build.mjs writes them (written as RGBA, the sheets are three fifths larger again, for a phone to fetch).
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG, decodePNG } from '../../tools/png.mjs';

const assets = fileURLToPath(new URL('../../assets/', import.meta.url)), fails = [];
const check = (ok, what) => { if (!ok) fails.push(what); };
const type = file => file[25];
const same = (a, b) => Buffer.from(a).equals(Buffer.from(b));

// 37 x 23 of six colours: two opaque, two clear ones that differ only under the clear, and two half seen.
const few = [[10, 20, 30, 255], [200, 100, 0, 255], [0, 0, 0, 0], [255, 0, 255, 0], [40, 50, 60, 128], [1, 2, 3, 1]];
const small = new Uint8Array(37 * 23 * 4);
for (let p = 0; p < 37 * 23; p++) small.set(few[(p * 7 + (p >> 3)) % few.length], p * 4);
const a = encodePNG(37, 23, small), back = decodePNG(a);
check(type(a) === 3, `six colours were written as colour type ${type(a)}, not a palette`);
check(back.width === 37 && back.height === 23 && same(back.data, small), 'a palette picture did not read back as it was written');
check(same(encodePNG(37, 23, small), a), 'the same pixels did not give the same bytes');

// 300 x 2: every pixel its own colour, too many for a palette.
const many = new Uint8Array(600 * 4);
for (let p = 0; p < 600; p++) many.set([p & 255, p >> 8, 7, 255], p * 4);
const b = encodePNG(300, 2, many);
check(type(b) === 6 && same(decodePNG(b).data, many), 'a picture of 600 colours was not written as RGBA, or did not read back');

// Exactly 256 colours still fit a palette; the first pixel of a slice of a larger buffer is where the slice starts.
const full = new Uint8Array(4 + 256 * 4).fill(9);
for (let p = 0; p < 256; p++) full.set([p, 255 - p, p >> 1, p], 4 + p * 4);
const c = encodePNG(16, 16, full.subarray(4));
check(type(c) === 3 && same(decodePNG(c).data, full.subarray(4)), 'a picture of 256 colours was not a palette, or did not read back');

for (const name of (await readdir(assets)).filter(n => n.endsWith('.png'))) {
  const file = await readFile(path.join(assets, name));
  check(type(file) === 3, `assets/${name} is colour type ${type(file)}, not a palette`);
  try { decodePNG(file); } catch (e) { fails.push(`assets/${name} does not read: ${e.message}`); }
}

if (fails.length) { console.log(`FAIL: ${fails.join('\n      ')}`); process.exit(1); }
console.log('ok: pictures read back as written, and the art is palette pictures');
