// A map of whose ground lies where: a square of the world round a point, a pixel a cell, each cell in the map
// colour of its ground (its biome id), for checking where provinces and pockets lie.
//   node tools/field.mjs <out.png> [--seed 7] [--at dx,dy] [--size 512] [--step 1] [--ground]
//
//   --at dx,dy   the middle of the square, in cells from the core: east and south are counted up (north is -dy).
//   --size n     the square is n cells on a side.
//   --step n     a pixel stands for n x n cells and shows the one in their middle: `--size 4800 --step 4` is the
//                whole world in 1200 pixels.
//   --ground     open ground is drawn dark, as on the game's own map. (This makes every piece of world in the
//                square, where the plain map only asks whose each cell is.)
//
// It asks the world itself (js/world.js: `biomeAt`, and `k` for --ground) and draws nothing of the game, so it
// needs no browser. A colour is the ground's own on the game's map: its row's `map` in the world's table of
// biomes (js/world.js: BIOMES), or a colour made from the id where a number has no row. The core is a white dot.
// It prints, for every id in the square: its name, its colour, how much of the square it is, the box it lies in,
// and the cell of it nearest the middle, which is a place to send tools/shot.mjs (`--at`). The last line is the
// path that was written.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { World, N, C, K, WORLD_R, BIOMES } from '../js/world.js';
import { encodePNG } from './png.mjs';

const usage = 'node tools/field.mjs <out.png> [--seed 7] [--at dx,dy] [--size 512] [--step 1] [--ground]';
const wrong = why => { console.error(`${why}\n  ${usage}`); process.exit(2); };

const options = { seed: '7', at: '0,0', size: '512', step: '1', ground: false };
let out = null;
for (let args = process.argv.slice(2), i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--help' || arg === '-h') { console.log(usage); process.exit(0); }
  if (!arg.startsWith('--')) { if (out !== null) wrong(`Two places to write were given: ${out} and ${arg}.`); out = arg; continue; }
  const [name, inline] = arg.slice(2).split(/=(.*)/s);
  if (!(name in options)) wrong(`There is no option --${name}.`);
  if (typeof options[name] === 'boolean') { options[name] = inline === undefined || inline !== '0'; continue; }
  const value = inline ?? args[++i];
  if (value === undefined) wrong(`--${name} needs a value.`);
  options[name] = value;
}
if (out === null) wrong('Where should the map be written?');
if (!/\.png$/i.test(out)) wrong(`The map is a PNG: ${out} does not end in .png.`);
const whole = (name, least, most) => {
  const n = Number(options[name]);
  if (!Number.isInteger(n) || n < least || n > most) wrong(`--${name} is a whole number from ${least} to ${most}, not ${options[name]}.`);
  return n;
};
const seed = whole('seed', 0, 2 ** 31 - 1), size = whole('size', 16, 2 * WORLD_R + 400), step = whole('step', 1, 64);
const at = options.at.split(',').map(Number);
if (at.length !== 2 || !at.every(Number.isInteger) || Math.hypot(...at) > WORLD_R + 200) wrong(`--at is two whole numbers of cells, dx,dy, within the world (${WORLD_R} cells from the core), not ${options.at}.`);
out = path.resolve(out);

const world = new World();
world.reset(seed);
const colourOf = b => BIOMES[b]?.map ?? [64 + (b * 97) % 160, 64 + (b * 57) % 160, 64 + (b * 151) % 160];
const nameOf = b => BIOMES[b]?.name ?? '?';
const side = Math.ceil(size / step), x0 = C + at[0] - (size >> 1), y0 = C + at[1] - (size >> 1), middle = step >> 1;
const rgba = new Uint8Array(side * side * 4), found = new Map();
for (let v = 0; v < side; v++) for (let u = 0; u < side; u++) {
  const x = x0 + u * step + middle, y = y0 + v * step + middle, b = world.biomeAt(x, y), o = (v * side + u) * 4;
  // Beyond the world's edge there is only bedrock: nearly black, whoever's ground it would have been.
  const beyond = Math.hypot(x - C, y - C) > WORLD_R, open = !beyond && options.ground && world.k(y * N + x) === K.EMPTY;
  const [r, g, bl] = colourOf(b), shade = beyond ? 0.08 : open ? 0.22 : 1;
  rgba[o] = r * shade; rgba[o + 1] = g * shade; rgba[o + 2] = bl * shade; rgba[o + 3] = 255;
  const dx = x - C, dy = y - C, near = (dx - at[0]) ** 2 + (dy - at[1]) ** 2;
  let f = found.get(b);
  if (!f) found.set(b, f = { n: 0, x0: dx, x1: dx, y0: dy, y1: dy, near: Infinity, at: [dx, dy] });
  f.n++; f.x0 = Math.min(f.x0, dx); f.x1 = Math.max(f.x1, dx); f.y0 = Math.min(f.y0, dy); f.y1 = Math.max(f.y1, dy);
  if (near < f.near) { f.near = near; f.at = [dx, dy]; }
}
// The core: a white dot with a dark rim, if the square holds it.
const cu = Math.floor((C - x0) / step), cv = Math.floor((C - y0) / step);
for (let v = -2; v <= 2; v++) for (let u = -2; u <= 2; u++) {
  const pu = cu + u, pv = cv + v;
  if (pu < 0 || pv < 0 || pu >= side || pv >= side) continue;
  const o = (pv * side + pu) * 4, rim = Math.max(Math.abs(u), Math.abs(v)) === 2;
  rgba[o] = rgba[o + 1] = rgba[o + 2] = rim ? 0 : 255;
}
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, encodePNG(side, side, rgba));

const hex = c => `#${c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
console.log(`seed ${seed}: ${size} x ${size} cells round ${at.join(',')}${step > 1 ? `, ${step} cells a pixel` : ''}; x ${x0 - C} to ${x0 - C + size - 1}, y ${y0 - C} to ${y0 - C + size - 1} (north is -y)`);
for (const [b, f] of [...found].sort((p, q) => p[0] - q[0])) {
  console.log(`  ${String(b).padStart(3)} ${nameOf(b).padEnd(12)} ${hex(colourOf(b))}  ${(f.n / (side * side) * 100).toFixed(1).padStart(5)}%  x ${f.x0} to ${f.x1}, y ${f.y0} to ${f.y1}; nearest the middle at ${f.at.join(',')}`);
}
console.log(out);
