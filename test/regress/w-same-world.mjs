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
// And pockets (docs/CONTENT-PLAN.md S3 and content item 6), under "Pockets" below: which sector of 128 cells holds
// one and where, each direction's first, which cells are a hive's and what each of them is; and that no find and
// no slab lies in a pocket or against one. And the other two kinds of pocket (content item 7): which kind a
// sector's pocket is, the boulders of a pumice drift and the tektites of an ash flat. And the four rare hazards
// (docs/CONTENT-PLAN.md), under "Rare hazards' sites" below: which sector of 144 cells holds one, where its heart
// lies and which it is, the four heralds, and what each lays round its heart, after the caves and in place of all
// else that is not open.
// And what generation 2 lays (js/world.js: GEN, `genOf`), under "Generation 2" below: the seams on the diagonals
// and their set pieces, the flanks' provinces and the deep strains in them, the strains' tells, the corner heralds,
// twin stones, fossils, a druse's geodes, the shrines and the builders' halls, each written out as plainly. The world
// is read twice: as a new game lays it, every piece of generation 2, and in a second pass at generation 1, as an older
// game's ground is laid, which must be the world as it was before any of that, cell for cell (`plain(seed, 1)` leaves
// it all out).
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
// ---- Generation 2. The seams: on the north-east diagonal 9 (hoarstone, the north's) and past the flanks' distance
// 13 (skarn), on the south-east 10 and 14 (glassdune and obsidian, the east's), the south-west 11 and 15 (cinderfen
// and tarpit, the south's), the north-west 12 and 16 (frostfen and muskeg, the west's). And the deep strains of the
// flanks far out, 63 + the flank's direction: 64 glacier, 65 caldera, 66 mycelium, 67 druse. Each is laid as the
// strains are, by the figures written here: whose ground it is, its first hazard where that is not its direction's
// (`haz`), its second (`lava2`, `spore2`), its thresholds where they are not its direction's, how thick its hazard
// is (`rate`, `lava`, `rind`), and its tells: ripples of glass (`ripples`), hairline faults (`threads`), a sheath of
// ice on its halls' walls (`sheath`), caps on its caves' rims (`rims`) and lakes of lava (`lakes`). A deep one's
// ore is thicker (0.6 and 0.66) and its hazard 1.8 times as thick, as a flank's is.
const DEEPER = { oreA: 0.6, oreB: 0.66 };
const NEW = {
  9: { kin: 1, haz: 'spark', slate: 0.05 }, 13: { kin: 1, haz: 'spark', slate: 0.05, rate: 1.8, ...DEEPER },
  10: { kin: 4, lava2: 0.78, ripples: 0.02 }, 14: { kin: 4, lava2: 0.72, ripples: 0.035, rate: 1.8, ...DEEPER },
  11: { kin: 2, cave: 0.74, spore2: 1, bubbles: 0.8 }, 15: { kin: 2, cave: 0.74, spore2: 1, bubbles: 0.8, lava: 0.72, ...DEEPER },
  12: { kin: 3, rivers: 0.02 }, 16: { kin: 3, rivers: 0.02, rate: 1.8, ...DEEPER },
  64: { kin: 1, cave: 0.82, cavern: 0.62, sheath: 0.03, ...DEEPER }, 65: { kin: 2, lava: 0.76, rind: 0.14, lakes: 0.76, rate: 1.8, ...DEEPER },
  66: { kin: 3, rate: 1.4, threads: 0.014, rims: 0.025, ...DEEPER }, 67: { kin: 4, rate: 1.4, geodes: true, ...DEEPER },
};
// Deep ground: the flanks, the deep seams and the deep strains (a site's share there is a flank's).
const DEEP = b => (b >= 5 && b <= 8) || (b >= 13 && b <= 16) || (b >= 64 && b <= 67);
const ROW = b => STRAIN[b] ?? cross(b) ?? NEW[b] ?? {};
const SHRINES = [[990, -990], [990, 990], [-990, 990], [-990, -990]], CORNERS = [[3, -3], [3, 3], [-3, 3], [-3, -3]];
const plain = (seed, gen = 2) => {
  const wrecks = WRECK_R.map((r, n) => {
    const ux = hash(n, 1, seed + 31) - 0.5, uy = hash(n, 2, seed + 31) - 0.5, len = Math.sqrt(ux * ux + uy * uy) || 1;
    return [C + Math.round(ux / len * r), C + Math.round(uy / len * r)];
  });
  // ---- Pockets. A sector of 128 cells holds one at the most, all of it inside the sector. Four sectors hold the
  // first pocket of each direction (north, south, west, east), nine cells in radius, 165 cells out along the
  // direction's line and 14 to one side, or 40 further out where a wreck lies within 24 cells of that. Of the
  // other sectors half try one: its middle 38 cells or more inside the sector, 170 cells or more from the core and
  // not so far out that the last reach does not go round it; its radius 6 + 24 x the square of a hash, kept within
  // 8 and 30 (a drift's within 9 and 30); and none within 40 cells and its radius of a wreck or a relic.
  // There are three kinds. The hive (ground 32) is the west's: it lies only where the middle is further west than
  // it is north or south. The ash flat (34) is the south's, likewise. The pumice drift (33) lies anywhere. Where
  // two kinds may lie, the sector's pocket is the one whose own hash for the sector (100 + its ground's number) is
  // larger. The first pockets are a drift in the north and the east, an ash flat in the south, a hive in the west.
  // (Kept once worked out, as a sector's slab is.)
  // (In generation 2 the shrines are kept clear of as the relics are.)
  const relics = [0, 1, 2, 3].map(d => [C + DX[d] * RELIC_R, C + DY[d] * RELIC_R]).concat(gen >= 2 ? SHRINES.map(([x, y]) => [C + x, C + y]) : []);
  const HERALD = [[14, -165, 0, -1, 33], [-14, 165, 0, 1, 34], [-165, -14, -1, 0, 32], [165, 14, 1, 0, 33]];
  const zones = new Map();
  const zoneOf = (sx, sy) => {
    const id = `${sx},${sy}`;
    if (zones.has(id)) return zones.get(id);
    let Z = null, herald = false;
    for (let [hx, hy, ux, uy, row] of HERALD) {
      if (Math.floor(hx / 128) !== sx || Math.floor(hy / 128) !== sy) continue;
      herald = true;
      if (wrecks.some(([wx, wy]) => (C + hx - wx) ** 2 + (C + hy - wy) ** 2 < 24 * 24)) { hx += ux * 40; hy += uy * 40; }
      Z = { cx: C + hx, cy: C + hy, rho: 9, row };
    }
    if (!herald && hash(sx, sy, seed + 40) < 0.5) {
      const cx = C + sx * 128 + 38 + Math.floor(hash(sx, sy, seed + 42) * 52), cy = C + sy * 128 + 38 + Math.floor(hash(sx, sy, seed + 43) * 52);
      const far = Math.sqrt((cx - C) * (cx - C) + (cy - C) * (cy - C)), h = hash(sx, sy, seed + 41);
      const west = C - cx > Math.abs(cy - C), south = !west && cy - C >= Math.abs(cx - C), east = !west && !south && cx - C > Math.abs(cy - C);
      // Which kind: the drift, which lies anywhere; the direction's own first kind (the west's hive, the south's ash
      // flat); and, from 300 cells out, the direction's further kind (the west's grotto, 35; the south's tinderwork,
      // 36; the north's glaze, 37; the east's shale stack, 38). Of those that may lie there, the one whose own hash
      // for the sector (100 + its ground's number) is largest; of two the same, the kind of the lower number.
      const may = [33, ...(west ? [32] : south ? [34] : []), ...(far >= 300 ? [west ? 35 : south ? 36 : east ? 38 : 37] : [])].sort((a, b) => a - b);
      let row = may[0];
      for (const id of may) if (hash(sx, sy, seed + 100 + id) > hash(sx, sy, seed + 100 + row)) row = id;
      // (Its radius is kept within its kind's own least: 8, a drift's and a tinderwork's 9, a grotto's 10.)
      const rho = Math.min(30, Math.max(row === 35 ? 10 : row === 33 || row === 36 ? 9 : 8, 6 + 24 * h * h));
      if (far >= 170 && far + 36 <= WORLD_R - 100 && ![...wrecks, ...relics].some(([x, y]) => (cx - x) ** 2 + (cy - y) ** 2 < (40 + rho) * (40 + rho))) Z = { cx, cy, rho, row };
    }
    zones.set(id, Z);
    return Z;
  };
  // A hive is a comb of chambers seven cells square with walls a cell thick between them: the rows of chambers
  // eight cells apart, every other row shifted four cells, and the hive's middle cell the middle of a chamber. A
  // chamber is the hive's if its middle is within the hive's radius of the hive's middle, and a cell is the
  // hive's if it is within four cells, each way, of the middle of such a chamber: its inside, or its walls.
  const inHive = (Z, x, y) => {
    for (let r = -5; r <= 5; r++) for (let c = -5; c <= 5; c++) {
      const uc = 8 * c + (Math.abs(r) % 2 ? 4 : 0), vc = 8 * r;
      if (uc * uc + vc * vc <= Z.rho * Z.rho && Math.abs(x - Z.cx - uc) <= 4 && Math.abs(y - Z.cy - vc) <= 4) return true;
    }
    return false;
  };
  // What a cell of a hive is. A wall is wax, but for a door: by the hash of the corner where the wall at a
  // chamber's west side meets the wall over the chamber, under 0.35 the cell of the wall overhead two cells east
  // of the corner is open; from there to 0.7 one cell of the west wall is, two cells above its middle (under
  // 0.525) or two below; and a door only where the chambers on both sides of it are the hive's. Inside a chamber,
  // by the chamber's own
  // hash: a nugget three cells square in the middle (55 in a hundred, or 7.7 over the hive's radius where that is
  // less; and always the chamber at the hive's middle) with a stalk of two cells from it to one of the four
  // walls; wax right through (15 in a hundred); or nothing.
  const hiveCell = (Z, x, y) => {
    const ey = y - Z.cy, r = Math.floor((ey + 4) / 8), dv = ey - 8 * r, shift = Math.abs(r) % 2 ? 4 : 0, ex = x - Z.cx - shift, c = Math.floor((ex + 4) / 8), du = ex - 8 * c;
    const corner = hash(Z.cx + shift + 8 * c - 4, Z.cy + 8 * r - 4, seed + 45), uc = 8 * c + shift, vc = 8 * r, within = (u, v) => u * u + v * v <= Z.rho * Z.rho;
    if (dv === -4) return du === -2 && corner < 0.35 && within(uc, vc) && within(uc - 4, vc - 8) ? K.EMPTY : K.SOFT;
    if (du === -4) return corner >= 0.35 && corner < 0.7 && dv === (corner < 0.525 ? -2 : 2) && within(uc, vc) && within(uc - 8, vc) ? K.EMPTY : K.SOFT;
    const mx = Z.cx + 8 * c + shift, my = Z.cy + 8 * r, what = c === 0 && r === 0 ? 0 : hash(mx, my, seed + 46);
    const share = Math.min(0.55, 7.7 / Z.rho);
    if (what >= share + 0.15) return K.EMPTY;
    if (what >= share) return K.SOFT;
    if (Math.abs(du) <= 1 && Math.abs(dv) <= 1) return K.MINERAL;
    const [ux, uy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][Math.floor(hash(mx, my, seed + 47) * 4)];
    return (du === 2 * ux || du === 3 * ux) && (dv === 2 * uy || dv === 3 * uy) ? K.NODE : K.EMPTY;
  };
  // A pumice drift is a plain disc, open but for its boulders. They lie on a grid of squares seven cells across,
  // the drift's middle cell the first of a square each way: a square has a boulder where its hash is under 0.8 or
  // 5.2 over the drift's radius, whichever is less (and the four squares round the middle always). The boulder's
  // middle is three cells in from the square's first, and on by the two halves of one hash, a part of a cell each
  // way; its radius 1.2 to 1.8 by another hash, and no more than leaves two cells between it and the drift's
  // edge; there is none where that is under 0.9. A cell within 0.9 of the boulder's middle is the mineral, the
  // rest of it pumice.
  const driftCell = (Z, x, y) => {
    const gx = Math.floor((x - Z.cx) / 7), gy = Math.floor((y - Z.cy) / 7), qx = Z.cx + 7 * gx, qy = Z.cy + 7 * gy;
    const first = (gx === 0 || gx === -1) && (gy === 0 || gy === -1);
    if (!first && hash(qx, qy, seed + 48) >= Math.min(0.8, 5.2 / Z.rho)) return K.EMPTY;
    const h = hash(qx, qy, seed + 49) * 65536, bx = qx + 3 + Math.floor(h) / 65536, by = qy + 3 + h % 1;
    const room = Z.rho - 2 - Math.sqrt((bx - Z.cx) ** 2 + (by - Z.cy) ** 2), r = Math.min(room, 1.2 + 0.6 * hash(qx, qy, seed + 50));
    if (room < 0.9) return K.EMPTY;
    const d = Math.sqrt((x - bx) ** 2 + (y - by) ** 2);
    return d >= r ? K.EMPTY : d < 0.9 ? K.MINERAL : K.SOFT;
  };
  // An ash flat is a disc whose edge wanders between 0.8 and 1.2 of its radius, soft ash with a cell of the mineral
  // where the cell's hash is under one in ten, or 2.1 over the radius where that is less.
  const ashCell = (Z, x, y) => hash(x, y, seed + 51) < Math.min(0.1, 2.1 / Z.rho) ? K.MINERAL : K.SOFT;
  // The four kinds met from 300 cells out.
  // A glaze is ice in panes five cells long and two high, each course of them shifted along by its own hash, and in
  // half the glazes stood on end (the pane's long way runs up). A pane holds one cell of the mineral where its own
  // hash is under 0.15, or 1.9 over the glaze's radius where that is less, and the pane at the middle always: which
  // of its ten cells, another hash says.
  const glazeCell = (Z, x, y) => {
    const turned = hash(Z.cx, Z.cy, seed + 93) < 0.5, u = turned ? y - Z.cy : x - Z.cx, v = turned ? x - Z.cx : y - Z.cy;
    const course = Math.floor(v / 2), shift = Math.floor(hash(course, Z.cx * 3 + Z.cy, seed + 93) * 5), n = Math.floor((u + shift) / 5), along = u + shift - 5 * n, up = v - 2 * course;
    const holds = (course === 0 && n === 0) || hash(Z.cx + n, Z.cy + course, seed + 94) < Math.min(0.15, 1.9 / Z.rho);
    return holds && up * 5 + along === Math.floor(hash(Z.cx + course, Z.cy + n, seed + 98) * 10) ? K.MINERAL : K.SOFT;
  };
  // A shale stack is level beds: a bed holds a seam of the mineral where its hash is under 0.14, or 1.4 over the
  // stack's radius where that is less (and the bed through the middle always), and along such a bed the mineral
  // lies wherever a layer of noise six cells to a step is over a half.
  const shaleCell = (Z, x, y) => {
    const bed = y - Z.cy;
    if (bed !== 0 && hash(bed, Z.cx + Z.cy, seed + 95) >= Math.min(0.14, 1.4 / Z.rho)) return K.SOFT;
    return noise((x - Z.cx) / 6 + 64, bed * 7 + 4096, seed + 95) > 0.5 ? K.MINERAL : K.SOFT;
  };
  // A tinderwork is coal with rings of fuse on a grid fourteen cells across, the pocket's middle the middle of one:
  // a ring is 3.5 to 5.5 cells in radius by its square's hash, laid only where all of it and a cell and a half
  // more lies within the pocket, and the fuse is the cells within three quarters of a cell of the ring's line.
  // Inside it a cell is the mineral where its hash is under 0.45, or 5 over the pocket's radius where that is less.
  const tinderCell = (Z, x, y) => {
    const ex = x - Z.cx, ey = y - Z.cy, mx = 14 * Math.floor((ex + 7) / 14), my = 14 * Math.floor((ey + 7) / 14), R = 3.5 + 2 * hash(Z.cx + mx, Z.cy + my, seed + 96);
    if (Math.sqrt(mx * mx + my * my) + R + 1.5 > Z.rho) return K.SOFT;
    const from = Math.sqrt((ex - mx) ** 2 + (ey - my) ** 2) - R;
    return from >= 0.75 ? K.SOFT : from > -0.75 ? K.NODE : hash(x, y, seed + 52) < Math.min(0.45, 5 / Z.rho) ? K.MINERAL : K.SOFT;
  };
  // A grotto is open wherever a layer of noise five cells to a step is over 0.6; a cell of its rock with open
  // ground beside it is a cap where the cell's hash is under 0.2, or 2.8 over the grotto's radius where that is less.
  const cave = (x, y) => noise(x / 5, y / 5, seed + 53) > 0.6;
  const grottoCell = (Z, x, y) => cave(x, y) ? K.EMPTY : hash(x, y, seed + 54) < Math.min(0.2, 2.8 / Z.rho) && (cave(x + 1, y) || cave(x - 1, y) || cave(x, y + 1) || cave(x, y - 1)) ? K.CAP : K.SOFT;
  // Which cells are a pocket's, and how far from its middle they can lie: a hive's 5.7 cells beyond its radius.
  // A drift and a tinderwork are plain discs; the edge of any other wanders.
  const plain = Z => Z.row === 33 || Z.row === 36;
  const inPocket = (Z, x, y) => {
    if (Z.row === 32) return inHive(Z, x, y);
    const d = Math.sqrt((x - Z.cx) ** 2 + (y - Z.cy) ** 2);
    return d < (plain(Z) ? Z.rho : Z.rho * (0.8 + 0.4 * noise(x / 7, y / 7, seed + 44)));
  };
  const reachOf = Z => Z.row === 32 ? Z.rho + 5.7 : plain(Z) ? Z.rho : Z.rho * 1.2;
  // Whether a disc (its middle and how far it runs) meets a pocket: its middle is nearer a pocket's than the disc
  // runs and the pocket's cells can lie.
  const meets = (cx, cy, reach) => {
    for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) {
      const Z = zoneOf(Math.floor((cx - C) / 128) + u, Math.floor((cy - C) / 128) + v);
      if (Z && (Z.cx - cx) ** 2 + (Z.cy - cy) ** 2 < (reach + reachOf(Z)) * (reach + reachOf(Z))) return true;
    }
    return false;
  };
  // In generation 2, far out: a sector of a druse (its middle's ground) over 900 cells out that would hold nothing,
  // or twin stones or a fossil, holds a geode. Twin stones (0.74 to 0.80, the middle over 800 out): two cells three
  // either side of the middle, east and west, north and south, or along one diagonal or the other by hash 34, each
  // in a ring of dense rock. A fossil (0.80 to 0.86, over 1,200 out): 4 to 7 bones by hash 36, the first three cells
  // behind the middle along one of the four ways by hash 35 (east, south, west, north), each a cell on from the one
  // before and a cell to one side, the other, or neither of the one before by its own hash (35, of the sector
  // that many east), never more than a cell from the line, in a bed of dense rock round each bone. Neither where a
  // slab any sector tries could have a cell within six cells of the middle, nor where a wreck's heart is within 7 of
  // it, or a relic's or a shrine's within 9 (as a square's distance).
  const druse = (sx, sy, what, fx, fy) => gen >= 2 && what >= 0.74 && (fx - C) ** 2 + (fy - C) ** 2 > 900 * 900 && ROW(biomeAt(fx, fy)).geodes === true;
  const findAt = (x, y) => {
    const sx = Math.floor((x - C) / FIND), sy = Math.floor((y - C) / FIND);
    let what = hash(sx, sy, seed + 21);
    const fx = C + sx * FIND + 8 + Math.floor(hash(sx, sy, seed + 22) * (FIND - 16)), fy = C + sy * FIND + 8 + Math.floor(hash(sx, sy, seed + 23) * (FIND - 16));
    if (druse(sx, sy, what, fx, fy)) what = 0;
    if (what >= 0.86 || (what >= 0.74 && gen < 2)) return -1;
    if (Math.hypot(fx - C, fy - C) < 16) return -1;
    // No find where its middle is within five cells of where a pocket's cells can lie.
    if (meets(fx, fy, 5)) return -1;
    const dx = x - fx, dy = y - fy;
    if (what >= 0.74) {
      if (Math.hypot(fx - C, fy - C) <= (what < 0.8 ? 800 : 1200)) return -1;
      const square = ([x, y]) => Math.max(Math.abs(x - fx), Math.abs(y - fy));
      if (tryNear(fx, fy, 6) || wrecks.some(p => square(p) < 8) || relics.some(p => square(p) < 10)) return -1;
      const near = [];
      if (what < 0.8) {
        const [ux, uy] = [[1, 0], [0, 1], [1, 1], [1, -1]][Math.floor(hash(sx, sy, seed + 34) * 4)];
        near.push([3 * ux, 3 * uy], [-3 * ux, -3 * uy]);
      } else {
        const [ux, uy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][Math.floor(hash(sx, sy, seed + 35) * 4)];
        let side = 0;
        for (let k = 0; k < 4 + Math.floor(hash(sx, sy, seed + 36) * 4); k++) {
          if (k) side = Math.max(-1, Math.min(1, side + Math.floor(hash(sx + k, sy, seed + 35) * 3) - 1));
          near.push([(k - 3) * ux - side * uy, (k - 3) * uy + side * ux]);
        }
      }
      if (near.some(([u, v]) => u === dx && v === dy)) return what < 0.8 ? K.TWIN : K.FOSSIL;
      return near.some(([u, v]) => Math.abs(u - dx) <= 1 && Math.abs(v - dy) <= 1) ? K.DENSE : -1;
    }
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
    // A pocket before all else: the cell is its sector's pocket's.
    const Z = zoneOf(Math.floor(dx / 128), Math.floor(dy / 128));
    if (r > 130 && Z && inPocket(Z, x, y)) return Z.row;
    if (r < HOME_R + (noise(x / 30, y / 30, seed + 3) - 0.5) * 50) return B.CRUST;
    const far = Math.min(90, r * 0.2), near = Math.min(8, r * 0.1);
    const ax = Math.abs(dx) + (noise(x / 61, y / 61, seed + 1) - 0.5) * far + (noise(x / 9, y / 9, seed + 16) - 0.5) * near;
    const ay = Math.abs(dy) + (noise(x / 61, y / 61, seed + 2) - 0.5) * far + (noise(x / 9, y / 9, seed + 17) - 0.5) * near;
    const b = ax > ay ? (dx > 0 ? B.LODE : B.MIRE) : (dy < 0 ? B.FROST : B.EMBER);
    const far50 = r > DEEP_R + (noise(x / 50, y / 50, seed + 14) - 0.5) * 200;
    // Generation 2: a seam, where the borders' long sweeps (with none of their small wobble) leave the two
    // distances within its half-width of each other, wandering 12 cells either way: 0.12 of the distance from the
    // core, from 24 to 90 cells, and past the flanks' own distance 0.09 of it, from 90 to 180. Not under 470 cells
    // out, the start wandering 25 either way.
    if (gen >= 2 && r <= WORLD_R + 2 && r > 470 + (noise(x / 30, y / 30, seed + 76) - 0.5) * 50) {
      const px = Math.abs(dx) + (noise(x / 61, y / 61, seed + 1) - 0.5) * far, py = Math.abs(dy) + (noise(x / 61, y / 61, seed + 2) - 0.5) * far;
      const w = far50 ? Math.min(180, Math.max(90, 0.09 * r)) : Math.min(90, Math.max(24, 0.12 * r));
      if (Math.abs(px - py) + (noise(x / 40, y / 40, seed + 75) - 0.5) * 24 < w) return (dx > 0 ? (dy < 0 ? 9 : 10) : (dy > 0 ? 11 : 12)) + (far50 ? 4 : 0);
    }
    const deep = far50 && Math.min(Math.abs(dx), Math.abs(dy)) > Math.max(Math.abs(dx), Math.abs(dy)) * 0.36 + (noise(x / 37, y / 37, seed + 15) - 0.5) * 60;
    // Generation 2: the flank in provinces as the near ground's are, and by a province's hash (33) a share of them,
    // none whose middle is under 1,050 out and a part in 1,000 for each cell further to six tenths, the flank's
    // deep strain.
    if (deep && gen >= 2) {
      const qx = Math.floor((dx + (noise(x / 61, y / 61, seed + 1) - 0.5) * 120) / 256), qy = Math.floor((dy + (noise(x / 61, y / 61, seed + 2) - 0.5) * 120) / 256);
      const rc = Math.sqrt(((qx + 0.5) * 256) ** 2 + ((qy + 0.5) * 256) ** 2);
      return hash(qx, qy, seed + 33) < Math.min(0.6, Math.max(0, (rc - 1050) / 1000)) ? 63 + b : b + 4;
    }
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
  const cavernOf = b => b === B.CRUST ? 0.76 : ROW(b).cavern ?? ((ROW(b).kin ?? base(b)) === B.MIRE ? 0.7 : 0.78);
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
      if (out > 60 && out + p + 6 <= WORLD_R - 100 && ![...wrecks, ...relics].some(([x, y]) => within(x, y, 40 + p)) && !(one && within(one.cx, one.cy, 44 + p)) && !meets(cx, cy, hash(sx, sy, seed + 85) < 0.35 ? p + 6.5 : p + 5)
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
  // ---- Rare hazards' sites. Sectors of 144 cells, whose middles are the corners of the slabs' sectors (so the
  // sector 0,0 runs from 72 cells west of the core to 71 east). A sector tries one where its hash (60) is under a
  // tenth; its middle is (hash 61 - 0.5) x 21 cells east of the corner, floored, and (62) south. It holds one only
  // where the middle is 450 cells out or more and the site's furthest six cells are within the last reach; its
  // ground is a direction's own, a strain, a deep flank or a cross of that direction (no pocket), and the ground
  // seven cells from it each way is the same direction's; it is 44 cells or more from every wreck and relic, its
  // middle and a pocket's further apart than 11 and the pocket's reach, and the middle of every find (a geode, a
  // cache, a prism, or the two allotted and not laid) 11 cells or more from it; its heart is solid: the middle,
  // or else the first of the four beside it (east, south, west, north) of the same direction's ground that no
  // cavern, cave or bubble opens; and its hash is under its share: 0.1 in a cross, 0.06 in a deep flank, 0.1
  // past 1,500 cells out, and 0.08 wherever the ground two rings round it, 20 and 40 cells out at eight points
  // each, is all the middle's (the largest of these that holds). Four sectors are each direction's herald: east
  // 4,1, west -4,-1, north 1,-4 and south -1,4. A herald is tried whatever its hash and share, its ground must be
  // its direction's, and where it holds none its middle is tried again by the hashes of the sectors 64, 128, ...
  // east of it, eight times in all; and where none of those holds one, the sector across its direction's line
  // (4,-1, -4,1, -1,-4, 1,4) is the herald in its place, and where that holds none either, the sector on the line
  // (4,0, -4,0, 0,-4, 0,4). Which hazard a site is, its direction says.
  const KIN = b => b >= 32 && b < 64 ? -1 : ROW(b).kin ?? base(b);
  const opens = (x, y, b) => {
    const S = ROW(b), kin = KIN(b);
    return noise(x / 19, y / 19, seed + 18) > (S.cavern ?? (kin === B.MIRE ? 0.7 : 0.78)) || noise(x / 5, y / 5, seed + 13) > (S.cave ?? (kin === B.MIRE ? 0.68 : 0.8))
      || (S.bubbles && noise(x / 2, y / 2, seed + 67) > S.bubbles);
  };
  // The middle of a sector's find, or null where it holds none.
  const findMiddle = (sx, sy) => {
    const what = hash(sx, sy, seed + 21), fx = C + sx * FIND + 8 + Math.floor(hash(sx, sy, seed + 22) * (FIND - 16)), fy = C + sy * FIND + 8 + Math.floor(hash(sx, sy, seed + 23) * (FIND - 16));
    if (what >= 0.86 && !druse(sx, sy, what, fx, fy)) return null;
    if (Math.hypot(fx - C, fy - C) < 16 || (what >= 0.7 && what < 0.74 && Math.hypot(fx - C, fy - C) <= 130) || meets(fx, fy, 5)) return null;
    return [fx, fy];
  };
  const TYPE = [null, 'bell', 'vent', 'worm', 'lodestone'], REACH = { bell: 5, vent: 3, worm: 4, lodestone: 6 };
  const HERALDS = [[4, 1, B.LODE], [-4, -1, B.MIRE], [1, -4, B.FROST], [-1, 4, B.EMBER]], ACROSS = [[4, -1], [-4, 1], [-1, -4], [1, 4]], ON = [[4, 0], [-4, 0], [0, -4], [0, 4]];
  // In generation 2, a corner's herald too: the sectors 3,-3, 3,3, -3,3 and -3,-3 (north-east, south-east,
  // south-west, north-west), tried as a herald is, with its ground that corner's seam or deep seam; and where one
  // holds none, the sector on the same diagonal one further out, and where neither does, the one beyond that. A
  // seam's share is a cross's, deep ground's a flank's.
  const tryAt = (sx, sy, n, h, herald, corner = -1) => {
    const cx = C + sx * 144 + Math.floor((hash(sx + 64 * n, sy, seed + 61) - 0.5) * 21), cy = C + sy * 144 + Math.floor((hash(sx + 64 * n, sy, seed + 62) - 0.5) * 21);
    const far = Math.hypot(cx - C, cy - C), b = biomeAt(cx, cy), kin = KIN(b);
    if (far < 450 || far + 6 > WORLD_R - 100 || kin < 1 || (herald && kin !== herald) || (corner >= 0 && b !== 9 + corner && b !== 13 + corner)) return null;
    if ([[7, 0], [-7, 0], [0, 7], [0, -7]].some(([u, v]) => KIN(biomeAt(cx + u, cy + v)) !== kin)) return null;
    if ([...wrecks, ...relics].some(([x, y]) => Math.hypot(cx - x, cy - y) < 44) || meets(cx, cy, 11)) return null;
    for (let fy = Math.floor((cy - 11 - C) / FIND); fy <= Math.floor((cy + 11 - C) / FIND); fy++) for (let fx = Math.floor((cx - 11 - C) / FIND); fx <= Math.floor((cx + 11 - C) / FIND); fx++) {
      const m = findMiddle(fx, fy);
      if (m && Math.hypot(m[0] - cx, m[1] - cy) < 11) return null;
    }
    const heart = [[cx, cy], [cx + 1, cy], [cx, cy + 1], [cx - 1, cy], [cx, cy - 1]].find(([x, y]) => KIN(biomeAt(x, y)) === kin && !opens(x, y, biomeAt(x, y)));
    if (!heart) return null;
    if (!herald && corner < 0) {
      const share = cross(b) || (b >= 9 && b <= 16) ? 0.1 : DEEP(b) ? 0.06 : far > 1500 ? 0.1 : 0;
      const plain = [20, 40].every(r => [[r, 0], [-r, 0], [0, r], [0, -r], [0.7 * r, 0.7 * r], [0.7 * r, -0.7 * r], [-0.7 * r, 0.7 * r], [-0.7 * r, -0.7 * r]].every(([u, v]) => biomeAt(cx + Math.round(u), cy + Math.round(v)) === b));
      if (!(h < share || (h < 0.08 && plain))) return null;
    }
    return { cx: heart[0], cy: heart[1], type: TYPE[kin], reach: REACH[TYPE[kin]] };
  };
  const sites = new Map();
  const siteOf = (sx, sy) => {
    const id = sx * 1000 + sy;
    if (sites.has(id)) return sites.get(id);
    const h = hash(sx, sy, seed + 60), first = HERALDS.findIndex(([x, y]) => x === sx && y === sy), second = ACROSS.findIndex(([x, y]) => x === sx && y === sy), third = ON.findIndex(([x, y]) => x === sx && y === sy);
    const herald = first >= 0 ? HERALDS[first][2]
      : second >= 0 && !siteOf(HERALDS[second][0], HERALDS[second][1]) ? HERALDS[second][2]
      : third >= 0 && !siteOf(HERALDS[third][0], HERALDS[third][1]) && !siteOf(ACROSS[third][0], ACROSS[third][1]) ? HERALDS[third][2] : 0;
    // (Which corner's diagonal the sector is on, and how many sectors out along it: 3, 4 or 5.)
    const c = gen < 2 || Math.abs(sx) !== Math.abs(sy) || Math.abs(sx) < 3 || Math.abs(sx) > 5 ? -1 : CORNERS.findIndex(([x, y]) => Math.sign(x) === Math.sign(sx) && Math.sign(y) === Math.sign(sy));
    const corner = c >= 0 && [3, 4, 5].filter(n => n < Math.abs(sx)).every(n => !siteOf(n * Math.sign(sx), n * Math.sign(sy))) ? c : -1;
    let S = null;
    for (let n = 0; n < (herald || corner >= 0 ? 8 : 1) && !S; n++) if (herald || corner >= 0 || h < 0.1) S = tryAt(sx, sy, n, h, herald, corner);
    sites.set(id, S);
    return S;
  };
  // What a site lays round its heart (u, v: a cell's place from it), or -1 where it leaves the ground as it is:
  //   a bell: the heart; within root 10 dense rock, or rich ore where the cell's hash (70) is under 0.3; and
  //     between root 12 and root 20, ice
  //   a vent: the heart; within root 2 slag; within 3, rich ore where hash 71 is under 0.15 (none nearer than
  //     2), else basalt where hash 72 is under 0.6, else dense rock
  //   a worm: the heart; within 2 soft rock; within root 13, plain ore where hash 73 is under a quarter
  //   a lodestone: an eight-armed star from 2 cells out to 6, along the axes and the diagonals: rich ore where hash
  //     74 is under three quarters, else plain ore
  const shape = (S, x, y) => {
    const u = x - S.cx, v = y - S.cy, d2 = u * u + v * v;
    if (d2 === 0) return K.RARE;
    if (S.type === 'bell') return d2 <= 10 ? (hash(x, y, seed + 70) < 0.3 ? K.ORE_B : K.DENSE) : d2 >= 12 && d2 <= 20 ? K.ICE : -1;
    if (S.type === 'vent') return d2 <= 2 ? K.SLAG : d2 > 9 ? -1 : hash(x, y, seed + 71) < 0.15 && d2 >= 4 ? K.ORE_B : hash(x, y, seed + 72) < 0.6 ? K.BASALT : K.DENSE;
    if (S.type === 'worm') return d2 <= 4 ? K.SOFT : d2 <= 13 && hash(x, y, seed + 73) < 0.25 ? K.ORE_A : -1;
    const spoke = u === 0 || v === 0 || Math.abs(u) === Math.abs(v);
    return spoke && d2 >= 4 && d2 <= 36 ? (hash(x, y, seed + 74) < 0.75 ? K.ORE_B : K.ORE_A) : -1;
  };
  // Generation 2: each seam's set piece, at the first cell on the diagonal itself from 480 cells out to 640 whose
  // ground is the seam's and so is the ground six cells from it each way, with no pocket within six cells and its
  // reach and no wreck within twelve, and a cave, great or small, or a bubble of the seam's ground at no more than
  // two of the eight points seven cells round it (and five each way on the diagonals): as `kindAt` lays it below.
  // (And clear of every slab a sector tries, laid or not: no cell its disc and five more could have, six and a half
  // for a cobble field, within six cells.)
  const tried = (x, y) => {
    for (let sy = -6; sy <= 6; sy++) for (let sx = -6; sx <= 6; sx++) {
      if (hash(sx, sy, seed + 80) >= 0.22) continue;
      const p = 8 + Math.floor(hash(sx, sy, seed + 81) * 9), cx = C + sx * 144 + 40 + Math.floor(hash(sx, sy, seed + 82) * 64), cy = C + sy * 144 + 40 + Math.floor(hash(sx, sy, seed + 83) * 64);
      if (Math.hypot(cx - x, cy - y) < (hash(sx, sy, seed + 85) < 0.35 ? p + 6.5 : p + 5) + 6) return true;
    }
    return false;
  };
  // (And no site's heart within its reach and eight cells.)
  const sited = (x, y) => {
    for (let ty = Math.floor((y - 14 - C + 72) / 144); ty <= Math.floor((y + 14 - C + 72) / 144); ty++) for (let tx = Math.floor((x - 14 - C + 72) / 144); tx <= Math.floor((x + 14 - C + 72) / 144); tx++) {
      const S = siteOf(tx, ty);
      if (S && Math.hypot(S.cx - x, S.cy - y) < S.reach + 8) return true;
    }
    return false;
  };
  const sets = [0, 1, 2, 3].map(c => {
    const ux = c < 2 ? 1 : -1, uy = c === 0 || c === 3 ? -1 : 1;
    for (let k = 340; k <= 452; k++) {
      const x = C + k * ux, y = C + k * uy;
      if ([[0, 0], [6, 0], [-6, 0], [0, 6], [0, -6]].every(([u, v]) => gen >= 2 && biomeAt(x + u, y + v) === 9 + c) && !meets(x, y, 6) && !wrecks.some(([wx, wy]) => Math.hypot(wx - x, wy - y) < 12) && !tried(x, y) && !sited(x, y)
        && [[7, 0], [5, 5], [0, 7], [-5, 5], [-7, 0], [-5, -5], [0, -7], [5, -5]].filter(([u, v]) => opens(x + u, y + v, 9 + c)).length <= 2) return [x, y];
    }
    return null;
  });
  // What a set piece lays, by corner, a cell u, v from its middle (d2 = u u + v v): within d2 30, and outside what it
  // lays, rock with no cave or find in it (`collar`).
  //   north-east  the first hazard at the middle; ice on the two cells under it; open within d2 4; ice to d2 10
  //   south-east  the second hazard three cells square; the first at 3, 0
  //   south-west  the first hazard three cells square; the second at 0, -3; slag two cells out from the middle
  //   north-west  the first hazard at the middle; dense rock under it; open within d2 2
  const setPiece = (x, y) => {
    const c = x > C ? (y < C ? 0 : 1) : (y > C ? 2 : 3), at = sets[c];
    if (!at) return null;
    const u = x - at[0], v = y - at[1], d2 = u * u + v * v, edge = Math.max(Math.abs(u), Math.abs(v));
    if (d2 > 30) return null;
    const lays = [
      d2 === 0 ? K.HAZARD : u === 0 && v > 0 && v <= 2 ? K.ICE : d2 <= 4 ? K.EMPTY : d2 <= 10 ? K.ICE : 'collar',
      edge <= 1 ? K.HAZARD2 : u === 3 && v === 0 ? K.HAZARD : 'collar',
      edge <= 1 ? K.HAZARD : u === 0 && v === -3 ? K.HAZARD2 : edge === 2 ? K.SLAG : 'collar',
      d2 === 0 ? K.HAZARD : u === 0 && v === 1 ? K.DENSE : d2 <= 2 ? K.EMPTY : 'collar'];
    return lays[c];
  };
  // Generation 2: the builders' halls. The world is laid out in squares of 48 cells (the finds' sectors). A square
  // whose middle is over 1,600 cells out, and under 2,252 (its middle and 48 more short of 2,300), holds one where its
  // hash (38) is under 0.08, and 0.17 more by 2,000 cells out, rising evenly from 1,600 and no more beyond, and 0.15
  // more where its middle is within 260 cells of a relic. Its walls are a box 12 + 13 x hash 39 cells wide (floored)
  // and 12 + 13 x hash 25 high, 4 cells into the square and as many more as hash 26 (across) and 27 (down) say of the
  // room left, which leaves 4 cells at the far side. Where the square holds a find (any find named there) and the box
  // with 7 cells round it (its collar, two, and five) holds the find's middle, the box moves the least way across
  // that clears it, in the square (the lesser way on a tie), or else up or down; or there is no hall. Then there is
  // none where its collar (the box and two cells round it) would come within 5 cells of a wreck's heart, 7 of a
  // relic's or a shrine's (as a square's distance); or a slab any sector tries could have a cell, or a pocket's cell
  // could lie, within a cell of the disc round the collar; or a sector's find has its middle under 6 cells from the
  // collar, or a site its heart within its reach and 2; or the ground round the collar, as it lies with no hall and no
  // slab, does not run on, a cell joined to the next by a side, to more than 24 cells beyond the collar, followed from
  // the cells against the collar's sides (not its four corners, which touch it only at a point).
  const tryNear = (x, y, room) => {
    for (let sy = Math.floor((y - C) / 144) - 1; sy <= Math.floor((y - C) / 144) + 1; sy++) for (let sx = Math.floor((x - C) / 144) - 1; sx <= Math.floor((x - C) / 144) + 1; sx++) {
      if (hash(sx, sy, seed + 80) >= 0.22) continue;
      const p = 8 + Math.floor(hash(sx, sy, seed + 81) * 9), cx = C + sx * 144 + 40 + Math.floor(hash(sx, sy, seed + 82) * 64), cy = C + sy * 144 + 40 + Math.floor(hash(sx, sy, seed + 83) * 64);
      if (Math.hypot(cx - x, cy - y) < (hash(sx, sy, seed + 85) < 0.35 ? p + 6.5 : p + 5) + room) return true;
    }
    return false;
  };
  const halls = new Map(), side = (x, y) => [[x + 1, y], [x, y + 1], [x - 1, y], [x, y - 1]], cell = (x, y) => y * N + x;
  const hallOf = (sx, sy) => {
    const id = sx * 1000 + sy;
    if (halls.has(id)) return halls.get(id);
    let H = null;
    const mx = sx * 48 + 24, my = sy * 48 + 24, far = Math.hypot(mx, my), relic = Math.min(...[0, 1, 2, 3].map(d => Math.hypot(mx - DX[d] * RELIC_R, my - DY[d] * RELIC_R)));
    if (gen >= 2 && far > 1600 && far + 48 < 2300 && hash(sx, sy, seed + 38) < 0.08 + 0.17 * Math.min(1, (far - 1600) / 400) + (relic < 260 ? 0.15 : 0)) {
      const w = 12 + Math.floor(hash(sx, sy, seed + 39) * 13), h = 12 + Math.floor(hash(sx, sy, seed + 25) * 13);
      const xs = Array.from({ length: 41 - w }, (_, n) => C + sx * 48 + 4 + n), ys = Array.from({ length: 41 - h }, (_, n) => C + sy * 48 + 4 + n);
      let x0 = xs[Math.floor(hash(sx, sy, seed + 26) * xs.length)], y0 = ys[Math.floor(hash(sx, sy, seed + 27) * ys.length)], ok = true;
      const find = findMiddle(sx, sy);
      if (find && find[0] >= x0 - 7 && find[0] <= x0 + w - 1 + 7 && find[1] >= y0 - 7 && find[1] <= y0 + h - 1 + 7) {
        const nearest = (list, at, f, size) => list.filter(p => f < p - 7 || f > p + size - 1 + 7).sort((a, b) => Math.abs(a - at) - Math.abs(b - at) || a - b)[0];
        const across = nearest(xs, x0, find[0], w), down = across === undefined ? nearest(ys, y0, find[1], h) : undefined;
        if (across !== undefined) x0 = across; else if (down !== undefined) y0 = down; else ok = false;
      }
      const x1 = x0 + w - 1, y1 = y0 + h - 1, out = (x, y) => Math.max(x0 - 2 - x, x - x1 - 2, y0 - 2 - y, y - y1 - 2, 0);
      const mid = [(x0 + x1) / 2, (y0 + y1) / 2], round = Math.hypot(w + 3, h + 3) / 2 + 1;
      if (ok && wrecks.some(([x, y]) => out(x, y) < 5)) ok = false;
      if (ok && [...[0, 1, 2, 3].map(d => [C + DX[d] * RELIC_R, C + DY[d] * RELIC_R]), ...SHRINES.map(([x, y]) => [C + x, C + y])].some(([x, y]) => out(x, y) < 7)) ok = false;
      if (ok && (tryNear(mid[0], mid[1], round) || meets(mid[0], mid[1], round))) ok = false;
      for (let fy = sy - 1; ok && fy <= sy + 1; fy++) for (let fx = sx - 1; fx <= sx + 1; fx++) { const m = findMiddle(fx, fy); if (m && out(m[0], m[1]) < 6) ok = false; }
      for (let ty = Math.floor((y0 - 10 - C + 72) / 144); ok && ty <= Math.floor((y1 + 10 - C + 72) / 144); ty++) for (let tx = Math.floor((x0 - 10 - C + 72) / 144); tx <= Math.floor((x1 + 10 - C + 72) / 144); tx++) {
        const S = siteOf(tx, ty);
        if (S && out(S.cx, S.cy) < S.reach + 2) ok = false;
      }
      if (ok) {
        const ground = (x, y) => kindAt(x, y, biomeAt(x, y), true, true) !== K.EMPTY, got = new Set(), list = [];
        for (let y = y0 - 3; y <= y1 + 3; y++) for (let x = x0 - 3; x <= x1 + 3; x++) if (out(x, y) === 1 && ((x - x0 + 3) % (x1 - x0 + 6) || (y - y0 + 3) % (y1 - y0 + 6))) { got.add(cell(x, y)); if (ground(x, y)) list.push([x, y]); }
        let held = false;
        for (let n = 0; n < list.length && !held; n++) {
          const [qx, qy] = list[n];
          if (out(qx, qy) > 24) held = true;
          for (const [u, v] of side(qx, qy)) if (out(u, v) > 0 && !got.has(cell(u, v))) { got.add(cell(u, v)); if (ground(u, v)) list.push([u, v]); }
        }
        // (Walls a cell thick, or two near a relic; its doors in the west and east walls where hash 28 is under a half,
        // else the north and south; its store against the north or west wall where hash 30 is under a half, else the
        // south or east.)
        if (held) H = { x0, y0, x1, y1, wall: relic < 260 ? 2 : 1, ew: hash(sx, sy, seed + 28) < 0.5, store: hash(sx, sy, seed + 30) < 0.5 ? 0 : 1 };
      }
    }
    halls.set(id, H);
    return H;
  };
  // What a hall lays, a cell u, v from its north-west corner (`wide` by `high` cells, walls `t` thick): its collar,
  // laid with no caves and no find; its walls, vault, but for its doors, soft rock in the two cells across the middle
  // of each of two opposite walls (the middle two of an even count, the middle and the one before of an odd), right
  // through the wall; and inside, open, but for its store, rich ore in the three cells across the middle of the
  // inside (the middle one and one each side) and two deep, against the wall its hash says.
  const hallAt = (x, y) => {
    const H = hallOf(Math.floor((x - C) / 48), Math.floor((y - C) / 48));
    if (!H || x < H.x0 - 2 || x > H.x1 + 2 || y < H.y0 - 2 || y > H.y1 + 2) return null;
    if (x < H.x0 || x > H.x1 || y < H.y0 || y > H.y1) return 'collar';
    const u = x - H.x0, v = y - H.y0, wide = H.x1 - H.x0 + 1, high = H.y1 - H.y0 + 1, t = H.wall;
    const inside = u >= t && u < wide - t && v >= t && v < high - t;
    if (inside) {
      const along = H.ew ? u : v, size = H.ew ? wide : high, deep = H.ew ? v : u, depth = H.ew ? high : wide;
      const store = Math.abs(along - Math.floor((size - 1) / 2)) <= 1 && (H.store ? deep >= depth - t - 2 : deep < t + 2);
      return store ? K.ORE_B : K.EMPTY;
    }
    const door = H.ew ? (u < t || u >= wide - t) && [Math.floor(high / 2) - 1, Math.floor(high / 2)].includes(v) : (v < t || v >= high - t) && [Math.floor(wide / 2) - 1, Math.floor(wide / 2)].includes(u);
    return door ? K.SOFT : K.VAULT;
  };
  // (`bare`: the ground as it lies with no slab, which is what is asked when one is being tried; `hallless`, with no
  // builders' hall, which is what is asked when one is.)
  const kindAt = (x, y, b, bare = false, hallless = false) => {
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
    // Generation 2: a shrine on each diagonal, its heart 990 cells out each way: a relic, in stone that is ore where
    // its hash (37) is under 0.3 (the plain ore where x + y is odd, the rich ore where it is even), in soft rock.
    if (gen >= 2) for (const [sx, sy] of SHRINES) {
      const edge = Math.max(Math.abs(dx - sx), Math.abs(dy - sy));
      if (edge === 0) return K.RELIC;
      if (edge <= 3) return hash(x, y, seed + 37) < 0.3 ? ((x + y) % 2 ? K.ORE_A : K.ORE_B) : K.VAULT;
      if (edge <= 5) return K.SOFT;
    }
    for (const [wx, wy] of wrecks) {
      const edge = Math.max(Math.abs(x - wx), Math.abs(y - wy));
      if (edge === 0) return K.WRECK;
      if (edge === 1) return hash(x, y, seed + 32) < 0.55 ? K.SLATE : K.EMPTY;
      if (edge <= 3) return K.EMPTY;
    }
    // A pocket's cells are its own to say: nothing else is laid in one.
    if (b === 32) return hiveCell(zoneOf(Math.floor(dx / 128), Math.floor(dy / 128)), x, y);
    if (b === 33) return driftCell(zoneOf(Math.floor(dx / 128), Math.floor(dy / 128)), x, y);
    if (b === 34) return ashCell(zoneOf(Math.floor(dx / 128), Math.floor(dy / 128)), x, y);
    if (b >= 35 && b <= 38) return [grottoCell, tinderCell, glazeCell, shaleCell][b - 35](zoneOf(Math.floor(dx / 128), Math.floor(dy / 128)), x, y);
    // A slab's crack and joints are open and its keys are keys; its own ground and its collar are the ground of
    // wherever it lies, with no find and no cave in them, and in the slab's own the ore's thresholds are 0.05 lower.
    const slab = bare ? 'out' : slabAt(x, y), lift = slab === 'inside' ? 0.05 : 0;
    if (slab === 'gap') return K.EMPTY;
    if (slab === 'key') return K.KEY;
    // A seam's set piece where no slab is (generation 2), and round it its collar, laid as a slab's ground is.
    const set = slab === 'out' && gen >= 2 ? setPiece(x, y) : null;
    if (typeof set === 'number') return set;
    // A builders' hall where no slab and no set piece is (generation 2), and round it its collar, likewise.
    const hall = slab === 'out' && set === null && !hallless ? hallAt(x, y) : null;
    if (typeof hall === 'number') return hall;
    const solid = slab !== 'out' || set === 'collar' || hall === 'collar';
    const find = r > 12 && !solid ? findAt(x, y) : -1;
    if (find >= 0) return find;
    const S = ROW(b), h = hash(x, y, seed + 9), deep = b > 4 && b < 9, kin = S.kin ?? base(b);
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
    // The first hazard is the direction's (the south's lava, the west's pods, the east's crystals; the north has
    // none), but where the row says otherwise (`haz`: a seam's of the north has the east's crystals).
    const haz = S.haz ?? [null, null, 'lava', 'spore', 'spark'][kin];
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
    if (haz === 'lava' && noise(x / 2.5, y / 2.5, seed + 8) > (S.lava ?? (deep ? 0.72 : 0.78)) && h > 0.45) k = K.HAZARD;
    if (haz === 'spore' && hash(x, y, seed + 10) < 0.022 * more) k = K.HAZARD;
    if (haz === 'spark' && hash(x, y, seed + 10) < 0.026 * more) k = K.HAZARD;
    // Crystals on the flanks of slate, in the east's grounds: one cell in five (as many times that as the ground
    // has crystals) of those within 0.03 beyond the edge of a rib of slate, or of a level bed of redrock's, on the
    // slate's own layer.
    if (haz === 'spark' && hash(x, y, seed + 10) < 0.2 * more && flank) k = K.HAZARD;
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
    // Generation 2's tells on the caves' walls, over all else the caves leave (and in a slab's ground or a set
    // piece's collar, where the caves are filled, the same): a lake of lava where a layer of noise 14 cells to a step
    // (78) is over the figure and slag where it is within 0.04 under it; a cap on a cell within the figure under the
    // caves' threshold or the halls' (on their own layers) where its hash (63) is under 0.3; ice on a cell within the
    // figure under the halls' threshold where its hash (77) is under a half.
    if (k !== K.EMPTY) {
      const hall = noise(x / 19, y / 19, seed + 18), hole = noise(x / 5, y / 5, seed + 13), cavern = S.cavern ?? (kin === B.MIRE ? 0.7 : 0.78), cave = S.cave ?? (kin === B.MIRE ? 0.68 : 0.8);
      if (S.lakes && noise(x / 14, y / 14, seed + 78) > S.lakes - 0.04) k = noise(x / 14, y / 14, seed + 78) > S.lakes ? K.HAZARD : K.SLAG;
      if (S.rims && ((hall > cavern - S.rims && hall <= cavern) || (hole > cave - S.rims && hole <= cave)) && hash(x, y, seed + 63) < 0.3) k = K.CAP;
      if (S.sheath && hall > cavern - S.sheath && hall <= cavern && hash(x, y, seed + 77) < 0.5) k = K.ICE;
    }
    // A rare hazard's site: what it lays round its heart takes the place of whatever is laid but open ground (and
    // of slag after it), in the cells within its reach of the heart of the cell's own sector's site.
    if (!solid && k !== K.EMPTY && r > 440) {
      const site = siteOf(Math.floor((x - C + 72) / 144), Math.floor((y - C + 72) / 144));
      if (site && (x - site.cx) ** 2 + (y - site.cy) ** 2 <= site.reach ** 2 && shape(site, x, y) >= 0) return shape(site, x, y);
    }
    // Slag, in the grounds whose first hazard is lava, where plain rock is left when all the rest is laid: a rind
    // round each pocket of lava, where the lava's layer is under the pocket's threshold by less than 0.07 (forge:
    // 0.12, caldera 0.14), and half of the plain rock within the pocket.
    if (haz === 'lava' && (k === K.SOFT || k === K.DENSE)) {
      const n = noise(x / 2.5, y / 2.5, seed + 8), t = S.lava ?? (deep ? 0.72 : 0.78);
      if (n > t - (S.rind ?? 0.07) && (n <= t || hash(x, y, seed + 68) < 0.5)) k = K.SLAG;
    }
    // And round the lava a cross has from the south, on that lava's own layer.
    if (S.lava2 && (k === K.SOFT || k === K.DENSE)) {
      const n = noise(x / 2.5, y / 2.5, seed + 58);
      if (n > S.lava2 - 0.07 && (n <= S.lava2 || hash(x, y, seed + 68) < 0.5)) k = K.SLAG;
    }
    // Generation 2's tells in plain rock, where all else has left it: ribbons of glass, where a layer of noise
    // stretched twenty cells to a step along and three up (29) is within the figure of its middle; hairline faults
    // where one fourteen cells to a step (90) is within the figure of its middle and one forty to a step (91) is over
    // a half.
    if (S.ripples && (k === K.SOFT || k === K.DENSE) && Math.abs(noise(x / 20, y / 3, seed + 29) - 0.5) < S.ripples) k = K.GLASS;
    if (S.threads && (k === K.SOFT || k === K.DENSE) && Math.abs(noise(x / 14, y / 14, seed + 90) - 0.5) < S.threads && noise(x / 40, y / 40, seed + 91) > 0.5) k = K.FAULT;
    return k;
  };
  return { wrecks, biomeAt, kindAt, firstSlab, slabIn, zoneOf, siteOf, sets, hallOf };
};

let pieces = 0, cells = 0, wrong = 0, first = '', slabs = 0, cobbles = 0, pockets = 0, sites = 0, corners = 0, halls = 0;
const kinds = new Set(), biomes = new Set(), rare = new Set(), older = { pieces: 0, kinds: new Set(), biomes: new Set() };
// One world of seed `seed` laid by generation `gen`'s rules, beside the plain reading of the same: `older` for the
// second pass, at generation 1, where what is met is kept apart.
const compare = (seed, gen, met) => {
  const w = new World(); w.reset(seed); w.genOf.fill(gen);
  const ref = plain(seed, gen), ids = new Set(), at = gen < 2 ? ` (generation ${gen})` : '';
  const round = (x, y, r = 1) => { for (let v = -r; v <= r; v++) for (let u = -r; u <= r; u++) ids.add((((y >> 6) + v) << 8) | ((x >> 6) + u)); };
  // Generation 2's own places: each diagonal at 500, 650, 800, 950 and 1,400 cells (the seams, and the shrines at
  // 1,400), and the flanks a sixteenth of a circle from each axis at 1,300, 1,700 and 2,100 (the deep strains), and
  // each seam's set piece. Asked at both generations: at 1 they must be the world as it was.
  for (const [sx, sy] of [[1, -1], [1, 1], [-1, 1], [-1, -1]]) {
    for (const r of [500, 650, 800, 950, 1400]) round(C + sx * Math.round(r * Math.SQRT1_2), C + sy * Math.round(r * Math.SQRT1_2), 0);
    for (const r of [1300, 1700, 2100]) { round(C + sx * Math.round(r * 0.924), C + sy * Math.round(r * 0.383), 0); round(C + sx * Math.round(r * 0.383), C + sy * Math.round(r * 0.924), 0); }
  }
  const sets = ref.sets.filter(Boolean);
  for (const [x, y] of sets) round(x, y, 0);
  if (gen >= 2 && sets.length < 4) { wrong++; first ||= `seed ${seed}: only ${sets.length} of the four seams has a set piece`; }
  if (gen < 2 && sets.length) { wrong++; first ||= `seed ${seed}${at}: a seam has a set piece`; }
  // Twin stones and fossils laid (the first few of each that the game says it has laid: the cells are compared).
  if (gen >= 2) {
    let twins = 0, fossils = 0;
    for (let sy = -45; sy <= 45 && (twins < 3 || fossils < 3); sy += 3) for (let sx = -45; sx <= 45; sx += 3) {
      const what = w.findName(sx, sy);
      if (!w.asked.laid || (what === 'twin' ? twins++ >= 3 : what === 'fossil' ? fossils++ >= 3 : true)) continue;
      round(w.asked.fx, w.asked.fy, 0);
    }
  }
  if (gen >= 2) {
    round(C, C, 3);
    for (const [wx, wy] of ref.wrecks) round(wx, wy);
    for (let d = 0; d < 4; d++) { round(C + DX[d] * RELIC_R, C + DY[d] * RELIC_R); round(C + DX[d] * WORLD_R, C + DY[d] * WORLD_R); round(C + DX[d] * 600, C + DY[d] * 600, 0); }
    for (const [x, y] of [[1700, 1700], [-1700, 1650], [900, -900], [-640, -700], [1000, 420], [-300, 1100], [700, -1900], [-1500, -200], [140, 60], [-90, -120], [1697, 1697]]) round(C + x, C + y);
    // Provinces: a ring of pieces 320 and 1100 cells out, where strains of every direction lie.
    // And 1500 and 1900 out, where a third of the provinces that are no deep flank are crosses.
    for (const far of [320, 1100, 1500, 1900]) for (const [u, v] of [[1, 0], [1, 0.4], [0.4, 1], [0, 1], [-0.4, 1], [-1, 0.4], [-1, 0], [-1, -0.4], [-0.4, -1], [0, -1], [0.4, -1], [1, -0.4]]) round(C + Math.round(u * far), C + Math.round(v * far), 0);
  }
  // Keystone slabs: the first, and the slab or cobble field of every sector within four of the core's that has
  // one. The game must lay one in the same sectors as the plain reading, and nowhere else.
  for (let sy = -4; sy < 4; sy++) for (let sx = -4; sx < 4; sx++) {
    const S = ref.slabIn(sx, sy), mine = w.slabIn(sx, sy);
    if (!S !== !mine || (S && (S.cx !== mine.cx || S.cy !== mine.cy || S.p !== mine.p || S.cobble !== mine.cobble))) { wrong++; first ||= `seed ${seed}${at} sector ${sx},${sy}: the game lays ${mine ? 'a slab' : 'no slab'}, the plain reading ${S ? 'one' : 'none'}`; }
    if (S && gen >= 2) { round(S.cx, S.cy); if (S.cobble) cobbles++; else slabs++; }
  }
  if (!ref.firstSlab() || !w.firstSlab) { wrong++; first ||= `seed ${seed}${at}: there is no first slab`; }
  // Pockets: the four heralds, and the pocket of every sector within six of the core's that has one. The game
  // must lay one in the same sectors as the plain reading, the same size in the same place, and nowhere else; and
  // every piece of the world one lies in is compared. (And, at generation 2, the sectors round each shrine.)
  for (const [sx, sy] of [...Array.from({ length: 144 }, (_, n) => [(n % 12) - 6, Math.floor(n / 12) - 6]), ...[[7, -8], [7, 7], [-8, 7], [-8, -8]].flatMap(([x, y]) => [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]])]) {
    const Z = ref.zoneOf(sx, sy), mine = w.zoneOf(sx, sy);
    if (!Z !== !mine || (Z && (Z.cx !== mine.cx || Z.cy !== mine.cy || Z.rho !== mine.rho || Z.row !== mine.row))) { wrong++; first ||= `seed ${seed}${at} sector ${sx},${sy}: the game lays ${mine ? `a pocket at ${mine.cx - C},${mine.cy - C} of radius ${mine.rho}` : 'no pocket'}, the plain reading ${Z ? `one at ${Z.cx - C},${Z.cy - C} of radius ${Z.rho}` : 'none'}`; }
    if (!Z || gen < 2) continue;
    pockets++;
    const most = Math.ceil(Z.rho + 6);
    for (let v = -most; v <= most; v += most) for (let u = -most; u <= most; u += most) round(Z.cx + u, Z.cy + v, 0);
  }
  // Rare hazards' sites: the site of every sector of the world. The game must lay one in the same sectors as the
  // plain reading, of the same type with its heart in the same cell, and nowhere else; and every piece of the
  // world one lies in is compared. (At generation 1, those of the sectors round the diagonals.)
  const hearts = [];
  for (let sy = -17; sy <= 17; sy++) for (let sx = -17; sx <= 17; sx++) {
    const S = ref.siteOf(sx, sy), mine = w.siteOf(sx, sy);
    if (!S !== !mine || (S && (S.cx !== mine.cx || S.cy !== mine.cy || S.type !== mine.type || S.reach !== mine.reach))) { wrong++; first ||= `seed ${seed}${at} site sector ${sx},${sy}: the game lays ${mine ? `a ${mine.type} at ${mine.cx - C},${mine.cy - C}` : 'none'}, the plain reading ${S ? `a ${S.type} at ${S.cx - C},${S.cy - C}` : 'none'}`; }
    if (!S || (gen < 2 && Math.abs(Math.abs(sx) - Math.abs(sy)) > 1)) continue;
    if (gen >= 2) { sites++; hearts.push(S); if (mine.corner >= 0) corners++; }
    for (const [u, v] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) round(S.cx + u, S.cy + v, 0);
  }
  for (const S of hearts) if (ref.kindAt(S.cx, S.cy, ref.biomeAt(S.cx, S.cy)) === K.RARE) rare.add(S.type);
  // Builders' halls: the hall of every square of seven by seven round the north's relic, round the north-east diagonal
  // 2,000 cells out and round the south-west's 1,730 cells out. The game must lay one in the same squares as the plain
  // reading, in the same place, of the same shape, and nowhere else; and the pieces of the first eight are compared.
  for (const [mx, my] of [[0, -42], [29, -30], [-26, 25]]) for (let sy = my - 3; sy <= my + 3; sy++) for (let sx = mx - 3; sx <= mx + 3; sx++) {
    const H = ref.hallOf(sx, sy), mine = w.hallOf(sx, sy), shape = H => H && [H.x0 - C, H.y0 - C, H.x1 - C, H.y1 - C, H.wall, H.ew, H.store].join();
    if (shape(H) !== shape(mine)) { wrong++; first ||= `seed ${seed}${at} square ${sx},${sy}: the game lays ${mine ? `a hall ${shape(mine)}` : 'no hall'}, the plain reading ${H ? `one ${shape(H)}` : 'none'}`; }
    if (!H) continue;
    if (halls++ % 4 === 0) { round(H.x0, H.y0, 0); round(H.x1, H.y1, 0); }
  }
  // Asked in the game's order (a piece at a time, as play makes them) and then a second time in another order, so
  // what the layers remember from the cell before is put to the test.
  for (const id of ids) {
    const p = w.piece(id), x0 = (id % CW) * CH, y0 = ((id / CW) | 0) * CH;
    met.pieces++;
    for (let v = 0; v < CH; v++) for (let u = 0; u < CH; u++) {
      const b = ref.biomeAt(x0 + u, y0 + v), k = ref.kindAt(x0 + u, y0 + v, b);
      cells++; met.kinds.add(k); met.biomes.add(b);
      if (p.biome[v * CH + u] !== b || p.kind[v * CH + u] !== k) { wrong++; first ||= `seed ${seed}${at} cell ${x0 + u - C},${y0 + v - C}: the game makes kind ${p.kind[v * CH + u]} biome ${p.biome[v * CH + u]}, the plain reading ${k} and ${b}`; }
    }
    for (let n = 0; n < 300; n++) {
      const x = x0 + ((n * 37) & 63), y = y0 + ((n * 53) & 63), b = ref.biomeAt(x, y), k = ref.kindAt(x, y, b);
      if (w.biomeAt(x, y) !== b || w.kindAt(x, y, b) !== k) { wrong++; first ||= `seed ${seed}${at} cell ${x - C},${y - C}, asked out of order: differs from the plain reading`; }
    }
  }
  if (JSON.stringify(w.wrecks) !== JSON.stringify(ref.wrecks)) { wrong++; first ||= `seed ${seed}${at}: the wrecks lie elsewhere`; }
};
const now = { pieces: 0, kinds, biomes };
for (const seed of [1, 7, 34, 99991, 123456789]) compare(seed, 2, now);
// And at generation 1, as an older game's ground is laid: the places generation 2 lays anew are the world as it
// was, and none of what it lays is met.
const newer = halls;
for (const seed of [7, 123456789]) compare(seed, 1, older);
pieces = now.pieces;
console.log(JSON.stringify({ pieces, older: older.pieces, cells, kindsSeen: kinds.size, biomesSeen: biomes.size, slabs, cobbles, pockets, sites, corners, halls: newer, wrong }));
console.log(wrong ? `DEFECT: the world a seed makes has changed: ${first}` : 'no defect');
const crosses = [...biomes].filter(b => b >= 128), donors = new Set(crosses.map(b => OTHERS[cross(b).kin][Math.floor((b - 128) % 15 / 5)])), shapes = new Set(crosses.map(b => (b - 128) % 5));
const NEWER = [9, 10, 11, 12, 13, 14, 15, 16, 64, 65, 66, 67], NEW_KINDS = [K.GLASS, K.FAULT, K.TWIN, K.FOSSIL, K.CAP];
if (!wrong && biomes.size - crosses.length < 30) console.log(`DEFECT: only ${biomes.size - crosses.length} of the 30 hand-made grounds were met: ${[...biomes].sort((a, b) => a - b)}`);
if (!wrong && (pockets < 40 || !kinds.has(K.MINERAL) || !kinds.has(K.NODE))) console.log(`DEFECT: ${pockets} pockets were met${kinds.has(K.MINERAL) ? '' : ', no mineral'}${kinds.has(K.NODE) ? '' : ', no stalk'}`);
if (!wrong && ![32, 33, 34].every(b => biomes.has(b))) console.log(`DEFECT: of the three kinds of pocket (grounds 32, 33, 34) only ${[32, 33, 34].filter(b => biomes.has(b))} were met`);
if (!wrong && (crosses.length < 20 || donors.size < 4 || shapes.size < 5)) console.log(`DEFECT: only ${crosses.length} crosses were met, with ${donors.size} of the 4 donors and ${shapes.size} of the 5 structures: ${crosses.sort((a, b) => a - b)}`);
if (!wrong && (slabs < 20 || cobbles < 8 || !kinds.has(K.KEY) || !kinds.has(K.PRISM))) console.log(`DEFECT: ${slabs} slabs and ${cobbles} cobble fields were met${kinds.has(K.KEY) ? '' : ', no key'}${kinds.has(K.PRISM) ? '' : ', no prism'}`);
if (!wrong && (sites < 150 || !kinds.has(K.RARE) || rare.size < 4 || corners < 16)) console.log(`DEFECT: ${sites} rare hazards' sites were met (${corners} of them corners' heralds), with ${rare.size} of the 4 types at their hearts: ${[...rare]}`);
const missing = [...NEWER.filter(b => !biomes.has(b)).map(b => `ground ${b}`), ...NEW_KINDS.filter(k => !kinds.has(k)).map(k => `kind ${k}`)];
if (!wrong && missing.length) console.log(`DEFECT: of what generation 2 lays, not met: ${missing.join(', ')}`);
if (!wrong && (newer < 30 || halls !== newer)) console.log(`DEFECT: ${newer} builders' halls were met at generation 2, and ${halls - newer} at generation 1`);
const leaked = [...NEWER.filter(b => older.biomes.has(b)).map(b => `ground ${b}`), ...NEW_KINDS.filter(k => k !== K.CAP && older.kinds.has(k)).map(k => `kind ${k}`)];
if (!wrong && (leaked.length || older.pieces < 100)) console.log(`DEFECT: at generation 1, ${older.pieces} pieces met ${leaked.join(', ') || 'nothing of generation 2'}`);
process.exit(wrong || sites < 150 || corners < 16 || !kinds.has(K.RARE) || rare.size < 4 || slabs < 20 || cobbles < 8 || !kinds.has(K.KEY) || !kinds.has(K.PRISM) || kinds.size < 19 || biomes.size - crosses.length < 30 || crosses.length < 20 || donors.size < 4 || shapes.size < 5
  || pockets < 40 || !kinds.has(K.MINERAL) || !kinds.has(K.NODE) || ![32, 33, 34].every(b => biomes.has(b)) || missing.length || leaked.length || older.pieces < 100 || newer < 30 || halls !== newer ? 1 : 0);
