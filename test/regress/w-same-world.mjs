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
// And keystone slabs and cobble fields (content item 5), under "Keystone slabs" below: where one lies, what it
// makes of each cell, and the three things asked of the ground before one is laid (its keys hold it, its crack goes
// right round, the world holds its collar), each asked here the plainest way there is. And the prism, in `findAt`.
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
    if (what >= 0.74) return -1;
    const fx = C + sx * FIND + 8 + Math.floor(hash(sx, sy, seed + 22) * (FIND - 16)), fy = C + sy * FIND + 8 + Math.floor(hash(sx, sy, seed + 23) * (FIND - 16));
    if (Math.hypot(fx - C, fy - C) < 16) return -1;
    const dx = x - fx, dy = y - fy;
    if (what < 0.38) {
      const size = hash(sx, sy, seed + 24) < 0.4 ? 4 : 3, far = Math.sqrt(dx * dx + dy * dy);
      if (far > size - 0.2) return -1;
      return far > size - 1.3 ? K.SLATE : size === 4 && far < 0.5 ? K.EMPTY : K.ORE_B;
    }
    const edge = Math.max(Math.abs(dx), Math.abs(dy));
    // A prism, set in plain ore: only where its middle is over 130 cells out.
    if (what >= 0.7) return (fx - C) ** 2 + (fy - C) ** 2 <= 130 * 130 ? -1 : edge === 0 ? K.PRISM : edge === 1 ? K.ORE_A : -1;
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
  // What a ground's great caverns are laid over, on their layer of noise.
  const cavernOf = b => b === B.CRUST ? 0.76 : (STRAIN[b] ?? cross(b) ?? {}).cavern ?? (((STRAIN[b] ?? cross(b) ?? {}).kin ?? base(b)) === B.MIRE ? 0.7 : 0.78);
  // ---- Keystone slabs. A way from a slab's middle, `q` quarters of a circle round, as a unit vector: within a
  // quarter it is (1 - t t, 2 t) / (1 + t t), t running from -(root 2 - 1) to root 2 - 1.
  const way = q => {
    q -= Math.floor(q / 4) * 4;
    const n = Math.floor(q), t = (q - n - 0.5) * (2 * (Math.sqrt(2) - 1)), c = (1 - t * t) / (1 + t * t), s = 2 * t / (1 + t * t);
    return [[c, s], [-s, c], [-c, -s], [s, -c]][n];
  };
  // What a slab makes of a cell: 'out' (nothing), 'gap' (open), 'key', 'inside' or 'collar'.
  const part = (S, x, y) => {
    const ex = x - S.cx, ey = y - S.cy, d = Math.sqrt(ex * ex + ey * ey);
    if (S.cobble) {
      // A disc of p + 4 with a collar of two and a half: every fifth row and column from the middle is an open
      // joint, and a block's one key lies in the joint east of it or south of it, against one of its four cells.
      if (d >= S.p + 6.5) return 'out';
      if (d >= S.p + 4) return 'collar';
      const u = ((ex % 5) + 5) % 5, v = ((ey % 5) + 5) % 5;
      if (u && v) return 'inside';
      if (!u && !v) return 'gap';
      const bx = x - (u || 5), by = y - (v || 5), east = hash(bx, by, seed + 86) < 0.5, which = Math.floor(hash(bx, by, seed + 87) * 4);
      return east === !u && which === (u || v) - 1 ? 'key' : 'gap';
    }
    // The crack's middle is p cells out, pushed a cell and a half either way by noise; the crack is 1.1 to either
    // side of that, a key 1.2 to either side of its way where it crosses the crack, the collar out to 3.5.
    if (d >= S.p + 5) return 'out';
    const f = d - S.p - (noise(x / 6, y / 6, seed + 84) - 0.5) * 3;
    if (f < -1.1) return 'inside';
    if (f >= 3.5) return 'out';
    if (f >= 1.1) return 'collar';
    return S.ways.some(([ux, uy]) => ex * ux + ey * uy > 0 && Math.abs(ex * uy - ey * ux) < 1.2) ? 'key' : 'gap';
  };
  // Is a slab sound where it would lie? Asked of every cell near it, with nothing kept from one question to the next.
  const sound = S => {
    const R = S.cobble ? S.p + 7 : S.p + 5, at = (x, y) => part(S, x, y), cells = [];
    for (let y = S.cy - R - 1; y <= S.cy + R + 1; y++) for (let x = S.cx - R - 1; x <= S.cx + R + 1; x++) cells.push([x, y]);
    const beside = (x, y) => [[x + 1, y], [x, y + 1], [x - 1, y], [x, y - 1]], name = (x, y) => y * N + x;
    if (!S.cobble) {
      // Its keys hold it: each run of key cells touches the slab and the collar, and there is a run for each way.
      const done = new Set();
      let runs = 0;
      for (const [x, y] of cells) {
        if (at(x, y) !== 'key' || done.has(name(x, y))) continue;
        const run = [[x, y]]; done.add(name(x, y));
        let inner = false, outer = false;
        for (const [qx, qy] of run) for (const [u, v] of beside(qx, qy)) {
          const what = at(u, v);
          if (what === 'inside') inner = true;
          if (what === 'collar') outer = true;
          if (what === 'key' && !done.has(name(u, v))) { done.add(name(u, v)); run.push([u, v]); }
        }
        if (!inner || !outer) return false;
        runs++;
      }
      if (runs !== S.ways.length) return false;
      // Its crack goes right round, a cell joined to the next by a side, once the keys are cut: followed from the
      // first cell of it east of the middle, never stepping over the line that runs east from the middle between
      // the middle's row and the row above, it comes round to the cells just across that line.
      const crack = (x, y) => at(x, y) === 'gap' || at(x, y) === 'key';
      let x0 = S.cx;
      while (x0 <= S.cx + R && !crack(x0, S.cy)) x0++;
      if (x0 > S.cx + R) return false;
      const got = new Set([name(x0, S.cy)]), list = [[x0, S.cy]];
      for (const [qx, qy] of list) for (const [u, v] of beside(qx, qy)) {
        if (!crack(u, v) || got.has(name(u, v)) || (u > S.cx && ((qy === S.cy && v === S.cy - 1) || (qy === S.cy - 1 && v === S.cy)))) continue;
        got.add(name(u, v)); list.push([u, v]);
      }
      if (!list.some(([x, y]) => y === S.cy - 1 && x > S.cx && got.has(name(x, y + 1)))) return false;
    }
    // The world holds its collar: the ground beside the collar, as it lies with no slab there, runs on, a cell
    // joined to the next by a side, to 48 cells beyond the furthest the slab's own cells go.
    const far = (S.cobble ? S.p + 6.5 : S.p + 5) + 48, ground = (x, y) => at(x, y) === 'out' && kindAt(x, y, biomeAt(x, y), true) !== K.EMPTY;
    const start = cells.filter(([x, y]) => beside(x, y).some(([u, v]) => at(u, v) === 'collar') && ground(x, y)), got = new Set(start.map(([x, y]) => name(x, y)));
    for (const [qx, qy] of start) {
      if ((qx - S.cx) ** 2 + (qy - S.cy) ** 2 >= far * far) return true;
      for (const [u, v] of beside(qx, qy)) if (!got.has(name(u, v)) && ground(u, v)) { got.add(name(u, v)); start.push([u, v]); }
    }
    return false;
  };
  // The first slab: 52 cells from the core on a way the seed says, eight in radius with two keys; a quarter of a
  // circle further round wherever it would be within 25 cells of the first wreck or not sound.
  let first;
  const firstSlab = () => {
    if (first !== undefined) return first;
    first = null;
    const key = hash(1, 1, seed + 86) * 4;
    for (let n = 0; n < 4 && !first; n++) {
      const [ux, uy] = way(hash(1, 1, seed + 89) * 4 + n), S = { cx: C + Math.round(ux * 52), cy: C + Math.round(uy * 52), p: 8, cobble: false, ways: [way(key), way(key + 0.8 + hash(1, 1, seed + 87) * 2.4)] };
      if ((S.cx - wrecks[0][0]) ** 2 + (S.cy - wrecks[0][1]) ** 2 >= 25 * 25 && sound(S)) first = S;
    }
    return first;
  };
  // The slab of a sector of 144 cells, if it has one. (Kept once worked out: the one thing here that is.)
  const sectors = new Map();
  const slabIn = (sx, sy) => {
    const id = `${sx},${sy}`;
    if (sectors.has(id)) return sectors.get(id);
    let S = null;
    if (hash(sx, sy, seed + 80) < 0.22) {
      const p = 8 + Math.floor(hash(sx, sy, seed + 81) * 9), cx = C + sx * 144 + 40 + Math.floor(hash(sx, sy, seed + 82) * 64), cy = C + sy * 144 + 40 + Math.floor(hash(sx, sy, seed + 83) * 64);
      const out = Math.sqrt((cx - C) ** 2 + (cy - C) ** 2), within = (x, y, r) => (cx - x) ** 2 + (cy - y) ** 2 < r * r, one = firstSlab();
      const relics = [0, 1, 2, 3].map(d => [C + DX[d] * RELIC_R, C + DY[d] * RELIC_R]);
      if (out > 60 && out + p + 6 <= WORLD_R - 100 && ![...wrecks, ...relics].some(([x, y]) => within(x, y, 40 + p)) && !(one && within(one.cx, one.cy, 44 + p))
        && !(noise(cx / 19, cy / 19, seed + 18) > cavernOf(biomeAt(cx, cy)) - 0.08)) {
        const q = hash(sx, sy, seed + 86) * 4, a = 0.8 + hash(sx, sy, seed + 87) * (p > 12 ? 0.8 : 2.4);
        S = { cx, cy, p, cobble: hash(sx, sy, seed + 85) < 0.35, ways: (p > 12 ? [q, q + a, q + a + 0.8 + hash(sx, sy, seed + 88) * 0.8] : [q, q + a]).map(way) };
        if (!sound(S)) S = null;
      }
    }
    sectors.set(id, S);
    return S;
  };
  // What the slab a cell lies in makes of it: the first slab's cells, or those of the cell's own sector's.
  const slabAt = (x, y) => {
    const one = firstSlab(), here = one && part(one, x, y);
    if (here && here !== 'out') return here;
    const S = slabIn(Math.floor((x - C) / 144), Math.floor((y - C) / 144));
    return S ? part(S, x, y) : 'out';
  };
  // (`bare`: the ground as it lies with no slab, which is what is asked when one is being tried.)
  const kindAt = (x, y, b, bare = false) => {
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
    // A slab's crack and joints are open and its keys are keys; its own ground and its collar are the ground of
    // wherever it lies, with no find and no cave in them, and in the slab's own the ore's thresholds are 0.05 lower.
    const slab = bare ? 'out' : slabAt(x, y), solid = slab !== 'out', lift = slab === 'inside' ? 0.05 : 0;
    if (slab === 'gap') return K.EMPTY;
    if (slab === 'key') return K.KEY;
    const find = r > 12 && !solid ? findAt(x, y) : -1;
    if (find >= 0) return find;
    const S = STRAIN[b] ?? cross(b) ?? {}, h = hash(x, y, seed + 9), deep = b > 4 && b < 9, kin = S.kin ?? base(b);
    let k = K.SOFT;
    if (b === B.CRUST) {
      if (r > 5 && noise(x / 4, y / 4, seed + 5) > 0.7) k = K.DENSE;
      if (r > 4.5 && noise(x / 3, y / 3, seed + 6) > 0.64 - lift && h < 0.6) k = K.ORE_A;
      if (r > 55 && noise(x / 3.5, y / 3.5, seed + 7) > 0.78 - lift && h < 0.5) k = K.ORE_B;
      if (r > 35 && Math.abs(noise(x / 9, y / 9, seed + 11) - 0.5) < 0.022) k = K.SLATE;
      if (!solid && r > 22 && noise(x / 5, y / 5, seed + 13) > 0.8) k = K.EMPTY;
      if (!solid && r > 60 && noise(x / 19, y / 19, seed + 18) > 0.76) k = K.EMPTY;
      return k;
    }
    if (noise(x / 4, y / 4, seed + 5) > (S.dense ?? (kin === B.EMBER ? 0.64 : 0.68))) k = K.DENSE;
    // Serac's lanes of ice lie where plain rock would; firn's rivers run through its ore as well.
    if (S.lanes && Math.abs(noise(x / 6, y / 6, seed + 65) - 0.5) < S.lanes) k = K.ICE;
    if (noise(x / 3, y / 3, seed + 6) > (S.oreA ?? (deep ? 0.6 : 0.66)) - lift && h < 0.62) k = K.ORE_A;
    if (noise(x / 3.5, y / 3.5, seed + 7) > (S.oreB ?? (deep ? 0.66 : 0.74)) - lift && h < 0.5) k = K.ORE_B;
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
    if (!solid && S.bubbles && noise(x / 2, y / 2, seed + 67) > S.bubbles) k = K.EMPTY;
    if (!solid && noise(x / 5, y / 5, seed + 13) > (S.cave ?? (kin === B.MIRE ? 0.68 : 0.8))) k = K.EMPTY;
    if (!solid && noise(x / 19, y / 19, seed + 18) > (S.cavern ?? (kin === B.MIRE ? 0.7 : 0.78))) k = K.EMPTY;
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
  return { wrecks, biomeAt, kindAt, firstSlab, slabIn };
};

let pieces = 0, cells = 0, wrong = 0, first = '', slabs = 0, cobbles = 0;
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
  // Keystone slabs: the first, and the slab or cobble field of every sector within four of the core's that has
  // one. The game must lay one in the same sectors as the plain reading, and nowhere else.
  for (let sy = -4; sy < 4; sy++) for (let sx = -4; sx < 4; sx++) {
    const S = ref.slabIn(sx, sy), mine = w.slabIn(sx, sy);
    if (!S !== !mine || (S && (S.cx !== mine.cx || S.cy !== mine.cy || S.p !== mine.p || S.cobble !== mine.cobble))) { wrong++; first ||= `seed ${seed} sector ${sx},${sy}: the game lays ${mine ? 'a slab' : 'no slab'}, the plain reading ${S ? 'one' : 'none'}`; }
    if (S) { round(S.cx, S.cy); if (S.cobble) cobbles++; else slabs++; }
  }
  if (!ref.firstSlab() || !w.firstSlab) { wrong++; first ||= `seed ${seed}: there is no first slab`; }
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
console.log(JSON.stringify({ pieces, cells, kindsSeen: kinds.size, biomesSeen: biomes.size, slabs, cobbles, wrong }));
console.log(wrong ? `DEFECT: the world a seed makes has changed: ${first}` : 'no defect');
const crosses = [...biomes].filter(b => b >= 128), donors = new Set(crosses.map(b => OTHERS[cross(b).kin][Math.floor((b - 128) % 15 / 5)])), shapes = new Set(crosses.map(b => (b - 128) % 5));
if (!wrong && biomes.size - crosses.length < 17) console.log(`DEFECT: only ${biomes.size - crosses.length} of the 17 hand-made grounds were met: ${[...biomes].sort((a, b) => a - b)}`);
if (!wrong && (crosses.length < 20 || donors.size < 4 || shapes.size < 5)) console.log(`DEFECT: only ${crosses.length} crosses were met, with ${donors.size} of the 4 donors and ${shapes.size} of the 5 structures: ${crosses.sort((a, b) => a - b)}`);
if (!wrong && (slabs < 20 || cobbles < 8 || !kinds.has(K.KEY) || !kinds.has(K.PRISM))) console.log(`DEFECT: ${slabs} slabs and ${cobbles} cobble fields were met${kinds.has(K.KEY) ? '' : ', no key'}${kinds.has(K.PRISM) ? '' : ', no prism'}`);
process.exit(wrong || slabs < 20 || cobbles < 8 || !kinds.has(K.KEY) || !kinds.has(K.PRISM) || kinds.size < 12 || biomes.size - crosses.length < 17 || crosses.length < 20 || donors.size < 4 || shapes.size < 5 ? 1 : 0);
