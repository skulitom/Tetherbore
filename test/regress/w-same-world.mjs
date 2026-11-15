// The world a seed makes must not change: saved games hold only the pieces that were seen, and the rest is made
// again from the seed. The ground was first laid out by the plain reading below (every layer of noise worked out
// for every cell, hashes and all); js/world.js now skips what cannot matter and remembers what the cell before
// asked about. Here pieces of the world from the game are compared, cell for cell, with the plain reading: at the
// core, in each direction's ground, on the borders between them, at the wrecks, the relics and the world's edge.
//   node test/regress/w-same-world.mjs
import { world } from '../harness.mjs';
const { World, N, C, CH, CW, K, B, HOME_R, DEEP_R, RELIC_R, WORLD_R, FIND, WRECK_R, DX, DY, base, cellHash: hash } = world;

const noise = (x, y, s) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const plain = seed => {
  const wrecks = WRECK_R.map((r, n) => {
    const ux = hash(n, 1, seed + 31) - 0.5, uy = hash(n, 2, seed + 31) - 0.5, len = Math.sqrt(ux * ux + uy * uy) || 1;
    return [C + Math.round(ux / len * r), C + Math.round(uy / len * r)];
  });
  const findAt = (x, y) => {
    const sx = Math.floor((x - C) / FIND), sy = Math.floor((y - C) / FIND), what = hash(sx, sy, seed + 21);
    if (what >= 0.7) return -1;
    const fx = C + sx * FIND + 8 + Math.floor(hash(sx, sy, seed + 22) * (FIND - 16)), fy = C + sy * FIND + 8 + Math.floor(hash(sx, sy, seed + 23) * (FIND - 16));
    if (Math.hypot(fx - C, fy - C) < 16) return -1;
    const dx = x - fx, dy = y - fy;
    if (what < 0.38) {
      const size = hash(sx, sy, seed + 24) < 0.4 ? 4 : 3, far = Math.sqrt(dx * dx + dy * dy);
      if (far > size - 0.2) return -1;
      return far > size - 1.3 ? K.SLATE : size === 4 && far < 0.5 ? K.EMPTY : K.ORE_B;
    }
    const edge = Math.max(Math.abs(dx), Math.abs(dy));
    return edge === 0 ? K.CACHE : edge === 1 ? K.DENSE : -1;
  };
  const biomeAt = (x, y) => {
    const dx = x - C, dy = y - C, r = Math.sqrt(dx * dx + dy * dy);
    if (r < HOME_R + (noise(x / 30, y / 30, seed + 3) - 0.5) * 50) return B.CRUST;
    const far = Math.min(90, r * 0.2), near = Math.min(8, r * 0.1);
    const ax = Math.abs(dx) + (noise(x / 61, y / 61, seed + 1) - 0.5) * far + (noise(x / 9, y / 9, seed + 16) - 0.5) * near;
    const ay = Math.abs(dy) + (noise(x / 61, y / 61, seed + 2) - 0.5) * far + (noise(x / 9, y / 9, seed + 17) - 0.5) * near;
    const b = ax > ay ? (dx > 0 ? B.LODE : B.MIRE) : (dy < 0 ? B.FROST : B.EMBER);
    const deep = r > DEEP_R + (noise(x / 50, y / 50, seed + 14) - 0.5) * 200
      && Math.min(Math.abs(dx), Math.abs(dy)) > Math.max(Math.abs(dx), Math.abs(dy)) * 0.36 + (noise(x / 37, y / 37, seed + 15) - 0.5) * 60;
    return deep ? b + 4 : b;
  };
  const kindAt = (x, y, b) => {
    const dx = x - C, dy = y - C, r = Math.sqrt(dx * dx + dy * dy);
    if (r > WORLD_R + (noise(x / 5, y / 5, seed + 4) - 0.5) * 3) return K.BEDROCK;
    if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) return K.EMPTY;
    if (dx >= 3 && dx <= 6 && dy >= -2 && dy <= 1) return dx === 3 || dx === 6 || dy === -2 || dy === 1 ? K.EMPTY : (dx + dy) % 2 ? K.ORE_A : K.SOFT;
    for (let d = 0; d < 4; d++) {
      const edge = Math.max(Math.abs(dx - DX[d] * RELIC_R), Math.abs(dy - DY[d] * RELIC_R));
      if (edge === 0) return K.RELIC;
      if (edge <= 3) return K.VAULT;
      if (edge <= 5) return K.SOFT;
    }
    for (const [wx, wy] of wrecks) {
      const edge = Math.max(Math.abs(x - wx), Math.abs(y - wy));
      if (edge === 0) return K.WRECK;
      if (edge === 1) return hash(x, y, seed + 32) < 0.55 ? K.SLATE : K.EMPTY;
      if (edge <= 3) return K.EMPTY;
    }
    const find = r > 12 ? findAt(x, y) : -1;
    if (find >= 0) return find;
    const h = hash(x, y, seed + 9), deep = b > 4, kin = base(b);
    let k = K.SOFT;
    if (b === B.CRUST) {
      if (r > 5 && noise(x / 4, y / 4, seed + 5) > 0.7) k = K.DENSE;
      if (r > 4.5 && noise(x / 3, y / 3, seed + 6) > 0.64 && h < 0.6) k = K.ORE_A;
      if (r > 55 && noise(x / 3.5, y / 3.5, seed + 7) > 0.78 && h < 0.5) k = K.ORE_B;
      if (r > 35 && Math.abs(noise(x / 9, y / 9, seed + 11) - 0.5) < 0.022) k = K.SLATE;
      if (r > 22 && noise(x / 5, y / 5, seed + 13) > 0.8) k = K.EMPTY;
      if (r > 60 && noise(x / 19, y / 19, seed + 18) > 0.76) k = K.EMPTY;
      return k;
    }
    if (noise(x / 4, y / 4, seed + 5) > (kin === B.EMBER ? 0.64 : 0.68)) k = K.DENSE;
    if (noise(x / 3, y / 3, seed + 6) > (deep ? 0.6 : 0.66) && h < 0.62) k = K.ORE_A;
    if (noise(x / 3.5, y / 3.5, seed + 7) > (deep ? 0.66 : 0.74) && h < 0.5) k = K.ORE_B;
    const more = deep ? 1.8 : 1;
    if (kin === B.EMBER && noise(x / 2.5, y / 2.5, seed + 8) > (deep ? 0.72 : 0.78) && h > 0.45) k = K.HAZARD;
    if (kin === B.MIRE && hash(x, y, seed + 10) < 0.022 * more) k = K.HAZARD;
    if (kin === B.LODE && hash(x, y, seed + 10) < 0.026 * more) k = K.HAZARD;
    if (Math.abs(noise(x / 9, y / 9, seed + 11) - 0.5) < (kin === B.LODE ? 0.05 : 0.03)) k = K.SLATE;
    if (r > 600 && Math.abs(noise(x / 8, y / 8, seed + 12) - 0.5) < 0.028) k = K.VAULT;
    if (noise(x / 5, y / 5, seed + 13) > (kin === B.MIRE ? 0.68 : 0.8)) k = K.EMPTY;
    if (noise(x / 19, y / 19, seed + 18) > (kin === B.MIRE ? 0.7 : 0.78)) k = K.EMPTY;
    return k;
  };
  return { wrecks, biomeAt, kindAt };
};

let pieces = 0, cells = 0, wrong = 0, first = '';
const kinds = new Set(), biomes = new Set();
for (const seed of [1, 7, 34, 99991, 123456789]) {
  const w = new World(); w.reset(seed);
  const ref = plain(seed), ids = new Set();
  const round = (x, y, r = 1) => { for (let v = -r; v <= r; v++) for (let u = -r; u <= r; u++) ids.add((((y >> 6) + v) << 8) | ((x >> 6) + u)); };
  round(C, C, 3);
  for (const [wx, wy] of ref.wrecks) round(wx, wy);
  for (let d = 0; d < 4; d++) { round(C + DX[d] * RELIC_R, C + DY[d] * RELIC_R); round(C + DX[d] * WORLD_R, C + DY[d] * WORLD_R); round(C + DX[d] * 600, C + DY[d] * 600, 0); }
  for (const [x, y] of [[1700, 1700], [-1700, 1650], [900, -900], [-640, -700], [1000, 420], [-300, 1100], [700, -1900], [-1500, -200], [140, 60], [-90, -120], [1697, 1697]]) round(C + x, C + y);
  // Asked in the game's order (a piece at a time, as play makes them) and then a second time in another order, so
  // what the layers remember from the cell before is put to the test.
  for (const id of ids) {
    const p = w.piece(id), x0 = (id % CW) * CH, y0 = ((id / CW) | 0) * CH;
    pieces++;
    for (let v = 0; v < CH; v++) for (let u = 0; u < CH; u++) {
      const b = ref.biomeAt(x0 + u, y0 + v), k = ref.kindAt(x0 + u, y0 + v, b);
      cells++; kinds.add(k); biomes.add(b);
      if (p.biome[v * CH + u] !== b || p.kind[v * CH + u] !== k) { wrong++; first ||= `seed ${seed} cell ${x0 + u - C},${y0 + v - C}: the game makes kind ${p.kind[v * CH + u]} biome ${p.biome[v * CH + u]}, the plain reading ${k} and ${b}`; }
    }
    for (let n = 0; n < 300; n++) {
      const x = x0 + ((n * 37) & 63), y = y0 + ((n * 53) & 63), b = ref.biomeAt(x, y), k = ref.kindAt(x, y, b);
      if (w.biomeAt(x, y) !== b || w.kindAt(x, y, b) !== k) { wrong++; first ||= `seed ${seed} cell ${x - C},${y - C}, asked out of order: differs from the plain reading`; }
    }
  }
  if (JSON.stringify(w.wrecks) !== JSON.stringify(ref.wrecks)) { wrong++; first ||= `seed ${seed}: the wrecks lie elsewhere`; }
}
console.log(JSON.stringify({ pieces, cells, kindsSeen: kinds.size, biomesSeen: biomes.size, wrong }));
console.log(wrong ? `DEFECT: the world a seed makes has changed: ${first}` : 'no defect');
process.exit(wrong || kinds.size < 12 || biomes.size < 9 ? 1 : 0);
