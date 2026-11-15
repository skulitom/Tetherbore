// The world a seed makes must not change: saved games hold only the pieces that were seen, and the rest is made
// again from the seed. The ground was first laid out by the plain reading below (every layer of noise worked out
// for every cell, hashes and all); js/world.js now skips what cannot matter and remembers what the cell before
// asked about. Here pieces of the world from the game are compared, cell for cell, with the plain reading: at the
// core, in each direction's ground, on the borders between them, at the wrecks, the relics and the world's edge.
//
// Ground that was laid on purpose since is in the plain reading too, written out as plainly: the provinces and the
// eight strains laid in them (docs/CONTENT-PLAN.md S3 and content item 1), each strain's figures as a line of
// `STRAIN` below and its tell as one line of `kindAt`. So this is also what holds those figures and tells. And the
// rind of slag round every pocket of lava, in every ground that has lava (content item 2): its last lines. And the
// crystals that stud the flanks of slate in every ground that has charged crystals: the lines after the east's.
// And the generated crosses (docs/CONTENT-PLAN.md, section 4 (a)): which provinces are one and of what, in
// `biomeAt`, and what a cross's number says of its ground, in `cross`: its host's ground with one structure and
// its donor's hazard laid a second time, thinner, on layers of its own.
//   node test/regress/w-same-world.mjs
import { world } from '../harness.mjs';
const { World, N, C, CH, CW, K, B, HOME_R, DEEP_R, RELIC_R, WORLD_R, FIND, WRECK_R, DX, DY, base, cellHash: hash } = world;

const noise = (x, y, s) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
// The strains: whose direction's ground each is a kind of, and what it has that its direction's has not.
const STRAIN = {
  17: { kin: 1, dense: 0.60, cave: 0.86, cavern: 0.84, rivers: 0.02 },
  18: { kin: 1, lanes: 0.085 },
  19: { kin: 2, lava: 0.80, bubbles: 0.8 },
  20: { kin: 2, lava: 0.735, slate: 0.04, rind: 0.12 },
  21: { kin: 3, cavern: 0.60 },
  22: { kin: 3, oreA: 0.63, rate: 0.5, grapes: 0.85 },
  23: { kin: 4, slate: 0, strata: 0.05 },
  24: { kin: 4, dense: 0.76, oreA: 0.72, oreB: 0.80, slate: 0.02, rate: 0.5 },
};
// A cross is known by its number: 128 + (host - 1) x 15 + (which of the other three directions, in the order of
// their numbers, is the donor) x 5 + structure. Its ground is the host's (`kin`) with one structure: 1 great caves,
// 2 lanes of ice (only where the host or the donor is the north: otherwise none), 3 bubbles, 4 level beds of slate
// in place of ribs. And the donor's hazard as its second, at six tenths: lava over 0.80, pods or crystals six
// tenths as many (the north gives no hazard: its crosses freeze, which lays nothing).
const OTHERS = [null, [2, 3, 4], [1, 3, 4], [1, 2, 4], [1, 2, 3]];
const SHAPE = [{}, { cavern: 0.62 }, { lanes: 0.085 }, { bubbles: 0.8 }, { slate: 0, strata: 0.05 }];
const cross = b => {
  if (b < 128 || b > 187) return null;
  const host = 1 + Math.floor((b - 128) / 15), donor = OTHERS[host][Math.floor((b - 128) % 15 / 5)], shape = (b - 128) % 5;
  return { kin: host, ...SHAPE[shape === 2 && host !== 1 && donor !== 1 ? 0 : shape], ...[null, {}, { lava2: 0.80 }, { spore2: 0.6 }, { spark2: 0.6 }][donor] };
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
    if (deep) return b + 4;
    // Past the world's edge no province is asked for. Within it, the province the cell lies in, on borders that
    // wander: its direction's own ground if its middle is under 220 out, and by its hash a cross's (a share that
    // is nothing under 500 out and 0.35 from 1,375 on: the donor and the structure by two more hashes), a
    // strain's (two thirds of the rest: the strain of this direction whose own hash is largest) or its
    // direction's own.
    if (r > WORLD_R + 2) return b;
    const px = Math.floor((dx + (noise(x / 61, y / 61, seed + 1) - 0.5) * 120) / 256), py = Math.floor((dy + (noise(x / 61, y / 61, seed + 2) - 0.5) * 120) / 256);
    const rc = Math.sqrt(((px + 0.5) * 256) ** 2 + ((py + 0.5) * 256) ** 2);
    if (rc < 220) return b;
    const X = Math.min(0.35, Math.max(0, (rc - 500) / 2500)), pick = hash(px, py, seed + 55);
    if (pick < X) {
      const which = Math.floor(hash(px, py, seed + 56) * 3), donor = OTHERS[b][which], shape = Math.floor(hash(px, py, seed + 57) * 5);
      return 128 + (b - 1) * 15 + which * 5 + (shape === 2 && b !== 1 && donor !== 1 ? 0 : shape);
    }
    if (pick >= X + (1 - X) * 2 / 3) return b;
    const one = 15 + b * 2, two = one + 1;
    return hash(px, py, seed + 300 + two) > hash(px, py, seed + 300 + one) ? two : one;
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
    const S = STRAIN[b] ?? cross(b) ?? {}, h = hash(x, y, seed + 9), deep = b > 4 && b < 9, kin = S.kin ?? base(b);
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
    if (noise(x / 4, y / 4, seed + 5) > (S.dense ?? (kin === B.EMBER ? 0.64 : 0.68))) k = K.DENSE;
    // Serac's lanes of ice lie where plain rock would; firn's rivers run through its ore as well.
    if (S.lanes && Math.abs(noise(x / 6, y / 6, seed + 65) - 0.5) < S.lanes) k = K.ICE;
    if (noise(x / 3, y / 3, seed + 6) > (S.oreA ?? (deep ? 0.6 : 0.66)) && h < 0.62) k = K.ORE_A;
    if (noise(x / 3.5, y / 3.5, seed + 7) > (S.oreB ?? (deep ? 0.66 : 0.74)) && h < 0.5) k = K.ORE_B;
    if (S.rivers && Math.abs(noise(x / 40, y / 40, seed + 66) - 0.5) < S.rivers) k = K.ICE;
    // A cross's second hazard, on layers of its own (58 for lava, 59 for pods and crystals), so that it never
    // lies where the first does; the first, laid after it here, takes the cell where both would. Crystals stud
    // the flanks of the host's slate as the east's own do, six tenths as many.
    const wide = S.slate ?? (kin === B.LODE ? 0.05 : 0.03), rib = Math.abs(noise(x / 9, y / 9, seed + 11) - 0.5), bed = Math.abs(noise(x / 40, y / 3, seed + 11) - 0.5);
    const flank = (wide > 0 && rib >= wide && rib < wide + 0.03) || (S.strata > 0 && bed >= S.strata && bed < S.strata + 0.03);
    if (S.lava2 && noise(x / 2.5, y / 2.5, seed + 58) > S.lava2 && h > 0.45) k = K.HAZARD2;
    if (S.spore2 && hash(x, y, seed + 59) < 0.022 * S.spore2) k = K.HAZARD2;
    if (S.spark2 && (hash(x, y, seed + 59) < 0.026 * S.spark2 || (flank && hash(x, y, seed + 59) < 0.2 * S.spark2))) k = K.HAZARD2;
    const more = S.rate ?? (deep ? 1.8 : 1);
    if (kin === B.EMBER && noise(x / 2.5, y / 2.5, seed + 8) > (S.lava ?? (deep ? 0.72 : 0.78)) && h > 0.45) k = K.HAZARD;
    if (kin === B.MIRE && hash(x, y, seed + 10) < 0.022 * more) k = K.HAZARD;
    if (kin === B.LODE && hash(x, y, seed + 10) < 0.026 * more) k = K.HAZARD;
    // Crystals on the flanks of slate, in the east's grounds: one cell in five (as many times that as the ground
    // has crystals) of those within 0.03 beyond the edge of a rib of slate, or of a level bed of redrock's, on the
    // slate's own layer.
    if (kin === B.LODE && hash(x, y, seed + 10) < 0.2 * more && flank) k = K.HAZARD;
    // Sporefall's bunches: a square of six cells has one where its hash is over the figure, the bunch's middle
    // cell a cell or more inside the square, and the pods are that cell and those round it that their hash keeps.
    if (S.grapes) {
      const gx = Math.floor(x / 6), gy = Math.floor(y / 6), g = hash(gx, gy, seed + 64);
      if (g >= S.grapes) {
        const at = Math.floor((g - S.grapes) / (1 - S.grapes) * 16), ex = Math.abs(x - (gx * 6 + 1 + at % 4)), ey = Math.abs(y - (gy * 6 + 1 + Math.floor(at / 4)));
        if (ex <= 1 && ey <= 1 && (ex + ey === 0 || hash(x, y, seed + 10) < 0.6)) k = K.HAZARD;
      }
    }
    if (Math.abs(noise(x / 9, y / 9, seed + 11) - 0.5) < (S.slate ?? (kin === B.LODE ? 0.05 : 0.03))) k = K.SLATE;
    if (S.strata && Math.abs(noise(x / 40, y / 3, seed + 11) - 0.5) < S.strata) k = K.SLATE;
    if (r > 600 && Math.abs(noise(x / 8, y / 8, seed + 12) - 0.5) < 0.028) k = K.VAULT;
    if (S.bubbles && noise(x / 2, y / 2, seed + 67) > S.bubbles) k = K.EMPTY;
    if (noise(x / 5, y / 5, seed + 13) > (S.cave ?? (kin === B.MIRE ? 0.68 : 0.8))) k = K.EMPTY;
    if (noise(x / 19, y / 19, seed + 18) > (S.cavern ?? (kin === B.MIRE ? 0.7 : 0.78))) k = K.EMPTY;
    // Slag, in the south's grounds, where plain rock is left when all the rest is laid: a rind round each pocket
    // of lava, where the lava's layer is under the pocket's threshold by less than 0.07 (forge: 0.12), and half
    // of the plain rock within the pocket.
    if (kin === B.EMBER && (k === K.SOFT || k === K.DENSE)) {
      const n = noise(x / 2.5, y / 2.5, seed + 8), t = S.lava ?? (deep ? 0.72 : 0.78);
      if (n > t - (S.rind ?? 0.07) && (n <= t || hash(x, y, seed + 68) < 0.5)) k = K.SLAG;
    }
    // And round the lava a cross has from the south, on that lava's own layer.
    if (S.lava2 && (k === K.SOFT || k === K.DENSE)) {
      const n = noise(x / 2.5, y / 2.5, seed + 58);
      if (n > S.lava2 - 0.07 && (n <= S.lava2 || hash(x, y, seed + 68) < 0.5)) k = K.SLAG;
    }
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
  // Provinces: a ring of pieces 320 and 1100 cells out, where strains of every direction lie.
  // And 1500 and 1900 out, where a third of the provinces that are no deep flank are crosses.
  for (const far of [320, 1100, 1500, 1900]) for (const [u, v] of [[1, 0], [1, 0.4], [0.4, 1], [0, 1], [-0.4, 1], [-1, 0.4], [-1, 0], [-1, -0.4], [-0.4, -1], [0, -1], [0.4, -1], [1, -0.4]]) round(C + Math.round(u * far), C + Math.round(v * far), 0);
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
const crosses = [...biomes].filter(b => b >= 128), donors = new Set(crosses.map(b => OTHERS[cross(b).kin][Math.floor((b - 128) % 15 / 5)])), shapes = new Set(crosses.map(b => (b - 128) % 5));
if (!wrong && biomes.size - crosses.length < 17) console.log(`DEFECT: only ${biomes.size - crosses.length} of the 17 hand-made grounds were met: ${[...biomes].sort((a, b) => a - b)}`);
if (!wrong && (crosses.length < 20 || donors.size < 4 || shapes.size < 5)) console.log(`DEFECT: only ${crosses.length} crosses were met, with ${donors.size} of the 4 donors and ${shapes.size} of the 5 structures: ${crosses.sort((a, b) => a - b)}`);
process.exit(wrong || kinds.size < 12 || biomes.size - crosses.length < 17 || crosses.length < 20 || donors.size < 4 || shapes.size < 5 ? 1 : 0);
