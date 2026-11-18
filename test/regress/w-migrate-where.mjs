// An older game's ground is brought up to today's rules (js/world.js: `migrate`) laying only the cells where it can
// matter (`layWhere`), and brings up exactly what laying every piece whole by both generations brought up.
//   - `layWhere` lays each cell not skipped as `lay` lays it, kind and ground, and leaves the cells skipped as they
//     were: every piece tools/world-hash.mjs records (seeds 1, 7 and 123456) and pieces along the seams from where
//     they begin, round their set pieces and round the four shrines' hearts, each by generation 1's rules and by
//     today's, under skip masks of every density from one cell to all but one (laid in another world, in another
//     order, so the seed's records are asked in another order too).
//   - A small save of generation 1 made here (seeds 7 and 123456: pieces past MIGRATE_NEAR along the north-east
//     diagonal and the seam, past MIGRATE_FAR along the east axis, beside the shrines, and some no newer rule
//     reaches; some cells seen, cells changed while unseen and seen, the north-east shrine's heart seen, the
//     south-east's not, the south-west's changed unseen and the north-west's piece not saved, its shrine already
//     unlaid) is brought up by `migrate` and by today's way written out below with the public `lay` (both
//     generations laid whole), and the two worlds are the same: every piece's kind, ground and what was seen,
//     which pieces are drawn afresh (`dull`), `touched` in its order, `genOf`, `unshrined` and what is returned.
//   - The work: `lay` is not called, and the cells laid are the four hearts' (by generation 1) where their pieces
//     are taken up, every unseen cell of the pieces taken up (by today's) and the unseen cells that hold other than
//     today's rules lay (by generation 1 again), where it was 8,192 a piece.
// It fails if a cell were laid by `layWhere` otherwise than `lay` lays it, if a cell were brought up that laying
// both whole would not bring up or left that it would, or if a piece were laid whole again.
//   node test/regress/w-migrate-where.mjs
import { world } from '../harness.mjs';
import { places, GEN2_PLACES } from '../../tools/world-hash.mjs';

const { World, C, CH, CW, K, GEN, SHRINES, MIGRATE_NEAR, MIGRATE_FAR, SET_FROM } = world, fails = [], check = (ok, what) => { if (!ok && fails.length < 20) fails.push(what); };
const idOf = (dx, dy) => (((C + dy) >> 6) << 8) | ((C + dx) >> 6);
const named = id => `${id % CW - C / CH},${((id / CW) | 0) - C / CH}`;
// (A stream of numbers of its own, from a seed: no Math.random.)
const stream = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ---- (a) layWhere lays what lay lays
const diag = (r, c) => { const leg = Math.round(r * Math.SQRT1_2); return [[1, -1], [1, 1], [-1, 1], [-1, -1]][c].map(s => s * leg); };
const near = [];
for (let c = 0; c < 4; c++) {
  for (const r of [MIGRATE_NEAR, SET_FROM - 20, SET_FROM + 40, 560, 640, MIGRATE_FAR, 1200]) { const [dx, dy] = diag(r, c); near.push(idOf(dx, dy), idOf(dx + 64, dy), idOf(dx, dy - 64)); }
  for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) near.push(idOf(SHRINES[c][0] + u * 64, SHRINES[c][1] + v * 64));
}
let laid = 0, pieces = 0;
const masks = [0.0003, 0.02, 0.3, 0.7, 0.98, 0.9998];
function compare(seed, gen, ids, what) {
  const R = new World(), W = new World(), rnd = stream(seed * 31 + gen);
  for (const w of [R, W]) { w.reset(seed); w.genOf.fill(gen); w.forget(); }
  const kind = new Uint8Array(CH * CH), biome = new Uint8Array(CH * CH), skip = new Uint8Array(CH * CH);
  const want = ids.filter((id, n, a) => a.indexOf(id) === n).map(id => { const k = new Uint8Array(CH * CH), b = new Uint8Array(CH * CH); R.lay(id, k, b); return [id, k, b]; });
  want.reverse().forEach(([id, k, b], n) => {
    // (Each piece under one of the masks in turn, and the cell left alone first or last in a mask of one.)
    const share = masks[(n + pieces) % masks.length];
    for (let c = 0; c < CH * CH; c++) skip[c] = rnd() < share ? 0 : 1;
    if (share < 0.001) skip[(n & 1) ? CH * CH - 1 : 0] = 0;
    kind.fill(255); biome.fill(255);
    W.layWhere(id, kind, biome, skip);
    pieces++;
    for (let c = 0; c < CH * CH; c++) {
      if (skip[c]) { check(kind[c] === 255 && biome[c] === 255, `${what}, seed ${seed} generation ${gen}: layWhere wrote cell ${c} of piece ${named(id)}, skipped`); continue; }
      laid++;
      check(kind[c] === k[c] && biome[c] === b[c], `${what}, seed ${seed} generation ${gen}: piece ${named(id)} cell ${c} laid by layWhere as kind ${kind[c]} ground ${biome[c]}, by lay ${k[c]} ${b[c]}`);
    }
  });
  check(W.made === 0 && R.made === 0, `${what}: a piece was made laying`);
}
for (const seed of [1, 7, 123456]) for (const gen of [1, GEN]) {
  compare(seed, gen, places().map(([, dx, dy]) => idOf(dx, dy)), 'world-hash');
  compare(seed, gen, GEN2_PLACES().map(([, dx, dy]) => idOf(dx, dy)), 'world-hash, generation 2\'s places');
  compare(seed, gen, near, 'the seams and the shrines');
}

// ---- (b) a save of generation 1 brought up, as laying both generations whole brings it up
// Today's way, as it was written before `layWhere`: every piece taken up laid whole by generation 1's rules and
// then by today's, a cell taking today's where it is unseen and holds what generation 1 laid.
function wholeMigrate(w) {
  w.forget();
  const ids = [];
  for (let id = 0; id < CW * CW; id++) if (w.chunks[id] && w.genOf[id] < GEN && w.newer(id)) ids.push(id);
  if (!ids.length) return [0, 0];
  const kind = new Uint8Array(CH * CH), biome = new Uint8Array(CH * CH), alike = new Uint8Array(ids.length * CH * CH), gens = w.genOf.slice();
  w.genOf.fill(1);
  ids.forEach((id, n) => {
    const p = w.chunks[id], o = n * CH * CH;
    w.lay(id, kind, biome);
    for (let at = 0; at < CH * CH; at++) alike[o + at] = !p.seen[at] && p.kind[at] === kind[at] && p.biome[at] === biome[at] ? 1 : 0;
  });
  w.genOf.set(gens);
  for (const id of ids) w.genOf[id] = GEN;
  for (let d = 0; d < 4; d++) {
    const hx = C + SHRINES[d][0], hy = C + SHRINES[d][1], n = ids.indexOf(((hy >> 6) << 8) | (hx >> 6));
    if (n >= 0 && !alike[n * CH * CH + (((hy & 63) << 6) | (hx & 63))]) w.unshrined |= 1 << d;
  }
  w.forget();
  let cells = 0;
  ids.forEach((id, n) => {
    const p = w.chunks[id], o = n * CH * CH;
    w.lay(id, kind, biome);
    let moved = 0;
    for (let at = 0; at < CH * CH; at++) if (alike[o + at] && (p.kind[at] !== kind[at] || p.biome[at] !== biome[at])) { p.kind[at] = kind[at]; p.biome[at] = biome[at]; moved++; }
    if (moved) { p.dull = undefined; cells += moved; }
    w.touched.add(id);
  });
  w.stirred++;
  return [ids.length, cells];
}
const heart = d => [C + SHRINES[d][0], C + SHRINES[d][1]];
const heartAt = d => { const [hx, hy] = heart(d); return [((hy >> 6) << 8) | (hx >> 6), ((hy & 63) << 6) | (hx & 63)]; };
let worked = '';
function save(seed) {
  // The pieces an older game saved, laid by generation 1's rules, seen and changed here and there.
  const ids = [];
  for (const r of [430, 470, 520, 600, 700, 800, 900, 1000, 1200]) { const [dx, dy] = diag(r, 0); ids.push(idOf(dx, dy), idOf(dx + 64, dy)); }
  for (const x of [760, 820, 900, 1100]) ids.push(idOf(x, 0), idOf(x, 64));
  ids.push(idOf(300, -300), idOf(0, 200), idOf(500, -40));
  for (const d of [0, 1, 2]) { const [hx, hy] = heart(d); ids.push(idOf(hx - C, hy - C), idOf(hx - C + 64, hy - C)); }
  const old = new World(), rnd = stream(seed);
  old.reset(seed); old.genOf.fill(1); old.forget();
  const saved = new Map();
  for (const id of ids.filter((id, n, a) => a.indexOf(id) === n)) {
    const p = old.piece(id), kind = p.kind.slice(), biome = p.biome.slice(), seen = new Uint8Array(CH * CH);
    // (Seen: a band of rows, a band of columns, or none, and cells here and there.)
    const how = (rnd() * 4) | 0, a = (rnd() * 48) | 0, b = a + 4 + ((rnd() * 24) | 0);
    for (let c = 0; c < CH * CH; c++) {
      const u = c & 63, v = c >> 6;
      if ((how === 1 && v >= a && v < b) || (how === 2 && u >= a && u < b) || how === 3 || rnd() < 0.02) seen[c] = 1;
    }
    // (Changed: every 61st cell cut, seen or not, a few unseen poured into, and a few unseen of another ground.)
    for (let c = 0; c < CH * CH; c += 61) if (kind[c] !== K.EMPTY) kind[c] = K.EMPTY;
    for (let c = 7; c < CH * CH; c += 409) if (!seen[c]) kind[c] = K.HAZARD;
    for (let c = 13; c < CH * CH; c += 127) if (!seen[c]) biome[c] = biome[c] === 1 ? 2 : 1;
    saved.set(id, { kind, biome, seen, dull: rnd() < 0.5 ? 1 : undefined });
  }
  // The shrines' hearts: the north-east's seen, the south-east's unseen and as laid, the south-west's unseen and
  // changed; the north-west's piece is not saved, and its shrine was left unlaid by an earlier load.
  for (const d of [0, 1, 2]) {
    const [id, at] = heartAt(d), p = saved.get(id), laid1 = old.chunks[id];
    p.kind[at] = laid1.kind[at];
    p.seen[at] = d === 0 ? 1 : 0;
    if (d === 2) p.kind[at] = laid1.kind[at] === K.EMPTY ? K.SOFT : K.EMPTY;
  }
  return saved;
}
for (const seed of [7, 123456]) {
  const saved = save(seed), worlds = [new World(), new World()];
  // (Loaded as js/game.js `restore` loads it.)
  for (const w of worlds) {
    w.reset(seed); w.unshrined = 8;
    for (const id of saved.keys()) w.genOf[id] = 1;
    w.forget();
    for (const [id, p] of saved) w.chunks[id] = { kind: p.kind.slice(), biome: p.biome.slice(), seen: p.seen.slice(), ...(p.dull ? { dull: p.dull } : {}) };
  }
  const [mine, whole] = worlds, P = World.prototype, { lay, layWhere } = P;
  let lays = 0, cells = 0;
  P.lay = function (...a) { lays++; return lay.apply(this, a); };
  P.layWhere = function (id, kind, biome, skip) { for (let c = 0; c < CH * CH; c++) if (!skip[c]) cells++; return layWhere.call(this, id, kind, biome, skip); };
  const got = mine.migrate();
  P.lay = lay; P.layWhere = layWhere;
  // (What today's rules lay in each piece taken up, for the cells the work should come to.)
  const ids = [...saved.keys()].filter(id => whole.newer(id)).sort((a, b) => a - b), now = new World();
  now.reset(seed); now.unshrined = mine.unshrined; for (const id of saved.keys()) now.genOf[id] = ids.includes(id) ? GEN : 1; now.forget();
  let unseen = 0, differ = 0;
  for (const id of ids) {
    const p = saved.get(id), kind = new Uint8Array(CH * CH), biome = new Uint8Array(CH * CH);
    now.lay(id, kind, biome);
    for (let c = 0; c < CH * CH; c++) if (!p.seen[c]) { unseen++; if (p.kind[c] !== kind[c] || p.biome[c] !== biome[c]) differ++; }
  }
  const hearts = [0, 1, 2, 3].filter(d => ids.includes(heartAt(d)[0])).length;
  const want = wholeMigrate(whole);
  check(JSON.stringify(got) === JSON.stringify(want), `seed ${seed}: migrate returned ${got}, laying whole ${want}`);
  check(got[0] === ids.length && got[0] >= 25 && got[1] > 10000, `seed ${seed}: ${got[0]} pieces taken up (of ${ids.length} a newer rule reaches) and ${got[1]} cells, too few to say anything`);
  check(saved.size - ids.length >= 2, `seed ${seed}: ${saved.size - ids.length} pieces saved that no newer rule reaches, not 2 or more`);
  check(mine.unshrined === (1 | 4 | 8) && whole.unshrined === mine.unshrined, `seed ${seed}: unshrined ${mine.unshrined}, laying whole ${whole.unshrined}, not 13 (the north-east's heart seen, the south-west's changed, the north-west's as it was)`);
  check(mine.stirred === whole.stirred, `seed ${seed}: stirred ${mine.stirred} against ${whole.stirred}`);
  check([...mine.touched].join() === [...whole.touched].join(), `seed ${seed}: touched ${[...mine.touched]} against ${[...whole.touched]}`);
  for (let id = 0; id < CW * CW; id++) {
    check(mine.genOf[id] === whole.genOf[id], `seed ${seed}: piece ${named(id)} of generation ${mine.genOf[id]}, laying whole ${whole.genOf[id]}`);
    const p = mine.chunks[id], q = whole.chunks[id];
    if (!p || !q) { check(!p && !q, `seed ${seed}: piece ${named(id)} made in one world only`); continue; }
    for (let c = 0; c < CH * CH; c++) {
      check(p.kind[c] === q.kind[c] && p.biome[c] === q.biome[c] && p.seen[c] === q.seen[c], `seed ${seed}: piece ${named(id)} cell ${c}: kind ${p.kind[c]} ground ${p.biome[c]}, laying whole ${q.kind[c]} ${q.biome[c]}`);
    }
    check(p.dull === q.dull, `seed ${seed}: piece ${named(id)} dull ${p.dull}, laying whole ${q.dull}`);
  }
  check(lays === 0, `seed ${seed}: migrate laid ${lays} pieces whole`);
  const should = hearts + unseen + differ;
  check(cells === should, `seed ${seed}: migrate laid ${cells} cells, not ${should} (${hearts} hearts, ${unseen} unseen, ${differ} unseen and not as today's rules lay them)`);
  worked += `${worked ? '; ' : ''}seed ${seed}: ${got[0]} pieces, ${got[1]} cells brought up, ${cells} cells laid where ${2 * CH * CH * got[0]} were`;
}

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : `no defect: layWhere laid ${laid} cells of ${pieces} pieces as lay lays them and left the rest; an old save brought up as laying both generations whole brings it up (${worked})`);
process.exitCode = fails.length ? 1 : 0;
