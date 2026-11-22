#!/usr/bin/env node
// Checks the Steam store art in store/art/ against the table in docs/STEAM.md (milestone 6): each file's exact size
// and real format, read from its bytes and not its name, and that what must be see-through is and what must not be
// is not. Exits 1 and says what is wrong if anything is.
//
//   node tools/store-check.mjs
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG } from './png.mjs';

const ART = join(dirname(fileURLToPath(import.meta.url)), '..', 'store', 'art');

const ASSETS = [
  { name: 'Header capsule', file: 'header_capsule.png', w: 920, h: 430, format: 'png', opaque: true },
  { name: 'Small capsule', file: 'small_capsule.png', w: 462, h: 174, format: 'png', opaque: true },
  { name: 'Main capsule', file: 'main_capsule.png', w: 1232, h: 706, format: 'png', opaque: true },
  { name: 'Vertical capsule', file: 'vertical_capsule.png', w: 748, h: 896, format: 'png', opaque: true },
  { name: 'Library capsule', file: 'library_capsule.png', w: 600, h: 900, format: 'png', opaque: true },
  { name: 'Library header', file: 'library_header.png', w: 920, h: 430, format: 'png', opaque: true },
  { name: 'Library hero', file: 'library_hero.png', w: 3840, h: 1240, format: 'png', opaque: true },
  // 1280 wide and/or 720 tall: it must meet one of them and pass neither
  { name: 'Library logo', file: 'library_logo.png', logo: true, format: 'png', transparent: true },
  { name: 'Shortcut icon', file: 'shortcut_icon.png', w: 256, h: 256, format: 'png', opaque: true },
  { name: 'App icon', file: 'app_icon.jpg', w: 184, h: 184, format: 'jpeg' },
  { name: 'Page background', file: 'page_background.png', w: 1438, h: 810, format: 'png', opaque: true },
];

const isPNG = b => b.length > 24 && b.readUInt32BE(0) === 0x89504e47 && b.readUInt32BE(4) === 0x0d0a1a0a;
const isJPEG = b => b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

// The size in a JPEG's start-of-frame marker (any SOF but the DHT, JPG and DAC codes that share its range).
function jpegSize(b) {
  for (let i = 2; i + 9 < b.length;) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; }
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
    if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

// Whether any pixel is clear and any is solid, read through the decoder the repository already has where it can (it
// takes 8-bit RGB, RGBA and palette pictures that are not interlaced, which is what Inkbolt writes).
function alpha(bytes) {
  const { width, height, data } = decodePNG(bytes);
  let clear = 0, solid = 0;
  for (let i = 3; i < width * height * 4; i += 4) { if (data[i] === 0) clear++; else if (data[i] === 255) solid++; }
  return { clear, solid, all: width * height };
}

let failed = 0;
for (const a of ASSETS) {
  const path = join(ART, a.file), problems = [];
  let size = '';
  if (!existsSync(path)) problems.push('missing');
  else {
    const bytes = readFileSync(path);
    const png = isPNG(bytes), jpeg = isJPEG(bytes);
    if (a.format === 'png' && !png) problems.push('is not a PNG');
    if (a.format === 'jpeg' && !jpeg) problems.push('is not a JPEG');
    const got = png ? { w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20) } : jpeg ? jpegSize(bytes) : null;
    if (!got) problems.push('has no readable size');
    else {
      size = `${got.w}x${got.h}`;
      if (a.logo) {
        if (got.w > 1280 || got.h > 720 || (got.w !== 1280 && got.h !== 720)) problems.push(`is ${size}, wants 1280 wide and/or 720 tall`);
      } else if (got.w !== a.w || got.h !== a.h) problems.push(`is ${size}, wants ${a.w}x${a.h}`);
    }
    if (png && (a.opaque || a.transparent)) {
      const { clear, solid, all } = alpha(bytes);
      if (a.opaque && solid !== all) problems.push(`has ${all - solid} pixels that are not opaque`);
      if (a.transparent && (!clear || !solid)) problems.push('wants both clear and solid pixels');
    }
  }
  if (problems.length) failed++;
  console.log(`${problems.length ? 'FAIL' : 'ok  '}  ${a.name.padEnd(18)} ${a.file.padEnd(22)} ${size}${problems.length ? `  ${problems.join('; ')}` : ''}`);
}
console.log(failed ? `${failed} of ${ASSETS.length} wrong` : `all ${ASSETS.length} as the table asks`);
process.exit(failed ? 1 : 0);
