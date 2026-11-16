// The generated ground, counted: crosses of a host direction's ground with a donor's (js/world.js: `crossRow`,
// rows 128 to 187; docs/CONTENT-PLAN.md, section 4 (a)).
//   node tools/crosses.mjs [--seeds 8] [--share 40] [--worth 12] [--where 7] [--far 1500]
//
//   (nothing)    for each of the twelve pairs and each of the five structures, counted over the seeds 1 to --seeds
//                beside the host's own ground: how much of the ground is each kind of cell, how thick the donor's
//                hazard lies beside the donor's own ground, and what a solid cell pays beside the host's.
//   --share n    instead: how much of the ground is generated at each distance from the core, over seeds 1 to n,
//                in cells (of all ground, and of ground that is no deep flank) and in provinces, beside the share
//                the rule gives; and the least that is hand-made on any one seed.
//   --worth n    instead: what a solid cell pays in grit at each distance (its kind's grit by its ground's `rich`
//                and `worth`, the mean over rings of cells on seeds 1 to n), with the crosses and with every pair
//                switched off: what generated ground adds to the income the prices are worked out from.
//   --where s    instead: where on seed s a province of each pair, and of each structure, lies nearest the core,
//                as cells east and south of the core: a place to send tools/shot.mjs (`--at`), test/rope-fuzz.mjs
//                and test/regress/i-fuzz-play.mjs (their start), with the tether level that reaches it.
//                --far is how far out to look (crosses begin 500 out and are few before 1,000).
//
// It asks the world itself (`province`, `biomeAt`, `kindAt`) and makes no piece of it. A window of 96 x 96 cells in
// the middle of a province is counted, if nine tenths of it and more are the province's own ground.
import { World, C, K, B, BIOMES, PROVINCE, KIND_NAMES, GRIT, DONORS, STRUCTURES, CROSS_FROM, CROSS_MOST, CROSS_OK, WORLD_R, crossId } from '../js/world.js';
import { REACH } from '../js/shop.js';

const SIZE = 96;
const SPAN = Math.ceil(WORLD_R / PROVINCE);
// Every province of a world with its middle from 220 cells out to `most`, nearest the core first:
// [px, py, kin, ground, how far its middle is]. Whose direction a province is, is asked of the cell in its middle,
// and so is whether that middle lies in a deep flank (`kin` is then 0: no province is laid there).
export const provinces = (w, most = WORLD_R - 100) => {
  const list = [];
  for (let py = -SPAN; py < SPAN; py++) for (let px = -SPAN; px < SPAN; px++) {
    const mx = (px + 0.5) * PROVINCE, my = (py + 0.5) * PROVINCE, rc = Math.sqrt(mx * mx + my * my);
    if (rc < 220 || rc > most) continue;
    const at = w.biomeAt(C + Math.round(mx), C + Math.round(my)), kin = at >= 5 && at <= 8 ? 0 : BIOMES[at]?.kin ?? 0;
    list.push([px, py, kin, kin ? w.province(px, py, kin) : at, rc]);
  }
  return list.sort((a, b) => a[4] - b[4]);
};
// The cell of a province's own ground nearest its middle, as [x, y] east and south of the core, or null.
const nearest = (w, px, py, ground) => {
  const mx = Math.round((px + 0.5) * PROVINCE), my = Math.round((py + 0.5) * PROVINCE);
  for (let ring = 0; ring < 120; ring += 4) for (let v = -ring; v <= ring; v += 4) for (let u = -ring; u <= ring; u += 4) {
    if (Math.max(Math.abs(u), Math.abs(v)) === ring && w.biomeAt(C + mx + u, C + my + v) === ground) return [mx + u, my + v];
  }
  return null;
};
// Where the crosses of a seed lie, nearest the core first: [{ id, at: [x, y], far }], one for each province of a
// cross that has a cell of its ground near its middle.
export const where = (seed, most = WORLD_R - 100) => {
  const w = new World(), found = [];
  w.reset(seed);
  for (const [px, py, , ground] of provinces(w, most)) {
    if (!BIOMES[ground]?.cross) continue;
    const at = nearest(w, px, py, ground);
    if (at) found.push({ id: ground, at, far: Math.sqrt(at[0] * at[0] + at[1] * at[1]) });
  }
  return found;
};

// What is counted of a ground: how many windows, how many cells, and cells of each kind.
// `count(seeds)` is a Map from a ground's number to that, for every cross and each direction's own ground.
export const count = (seeds = 8) => {
  const w = new World(), counts = new Map();
  for (let seed = 1; seed <= seeds; seed++) {
    const had = new Map();
    w.reset(seed);
    for (const [px, py, , ground] of provinces(w)) {
      if (ground > 4 && !BIOMES[ground]?.cross) continue;
      if ((had.get(ground) ?? 0) >= 6) continue;
      const x0 = C + Math.round((px + 0.5) * PROVINCE) - SIZE / 2, y0 = C + Math.round((py + 0.5) * PROVINCE) - SIZE / 2, kind = new Array(32).fill(0);
      let own = 0;
      for (let v = 0; v < SIZE; v++) for (let u = 0; u < SIZE; u++) {
        if (w.biomeAt(x0 + u, y0 + v) !== ground) continue;
        own++; kind[w.kindAt(x0 + u, y0 + v, ground)]++;
      }
      if (own < SIZE * SIZE * 0.9) continue;
      had.set(ground, (had.get(ground) ?? 0) + 1);
      const t = counts.get(ground) ?? counts.set(ground, { windows: 0, cells: 0, kind: new Array(32).fill(0) }).get(ground);
      t.windows++; t.cells += own;
      for (let k = 0; k < 32; k++) t.kind[k] += kind[k];
    }
  }
  return counts;
};
// Several grounds' counts as one.
export const sum = (counts, ids) => {
  const all = { windows: 0, cells: 0, kind: new Array(32).fill(0) };
  for (const id of ids) { const t = counts.get(id); if (!t) continue; all.windows += t.windows; all.cells += t.cells; for (let k = 0; k < 32; k++) all.kind[k] += t.kind[k]; }
  return all;
};
// What a solid cell of counted ground pays in grit, by its row's `rich`.
export const pays = (t, row) => {
  let grit = 0, solid = 0;
  for (let k = 1; k < 32; k++) if (t.kind[k] && GRIT[k] !== undefined) { grit += t.kind[k] * GRIT[k] * row.rich * row.worth; solid += t.kind[k]; }
  return solid ? grit / solid : 0;
};

// How much of the ground is generated, by distance: for each ring, over seeds 1 to `seeds`, the cells that are a
// cross's, a strain's, a direction's own and a deep flank's; the provinces whose middle lies in the ring and not in
// a deep flank, and how many of them are crosses; what the rule gives for those provinces (the mean of X over
// them); and the least share of a seed's cells in the ring that is hand-made.
export const RINGS = [[220, 500], [500, 750], [750, 1000], [1000, 1375], [1375, 1800], [1800, 2300]];
export const shares = (seeds = 40, step = 16) => {
  const w = new World(), rings = RINGS.map(([from, to]) => ({ from, to, cells: 0, cross: 0, strain: 0, own: 0, deep: 0, provinces: 0, crossed: 0, rule: 0, least: 1 }));
  for (let seed = 1; seed <= seeds; seed++) {
    w.reset(seed);
    const each = RINGS.map(() => [0, 0]);
    for (let y = -2300; y <= 2300; y += step) for (let x = -2300; x <= 2300; x += step) {
      const r = Math.sqrt(x * x + y * y), n = RINGS.findIndex(([from, to]) => r >= from && r < to);
      if (n < 0) continue;
      const b = w.biomeAt(C + x, C + y), t = rings[n];
      t.cells++; each[n][0]++;
      if (BIOMES[b]?.cross) { t.cross++; each[n][1]++; } else if (b >= 17) t.strain++; else if (b >= 5) t.deep++; else t.own++;
    }
    each.forEach(([cells, cross], n) => { rings[n].least = Math.min(rings[n].least, 1 - cross / cells); });
    for (const [, , kin, ground, rc] of provinces(w, 2300)) {
      const t = rings[RINGS.findIndex(([from, to]) => rc >= from && rc < to)];
      if (!t || !kin) continue;
      t.provinces++; t.rule += Math.min(CROSS_MOST, Math.max(0, (rc - CROSS_FROM) / 2500));
      if (BIOMES[ground]?.cross) t.crossed++;
    }
  }
  return rings;
};

// What a solid cell pays in grit, the mean over each ring: [{ from, to, with, without }], `without` being the same
// cells of the same worlds with every pair switched off (each such province its direction's own ground). One cell
// in every `step` x `step` is asked. The verdicts are put back as they were.
export const worth = (seeds = 12, step = 12) => {
  const kept = CROSS_OK.map(list => list.slice()), rings = RINGS.map(([from, to]) => ({ from, to, with: 0, without: 0 }));
  for (const key of ['with', 'without']) {
    CROSS_OK.forEach((list, host) => list.forEach((ok, donor) => { list[donor] = key === 'with' && kept[host][donor]; }));
    const w = new World(), sums = RINGS.map(() => [0, 0]);
    for (let seed = 1; seed <= seeds; seed++) {
      w.reset(seed);
      for (let y = -2300; y <= 2300; y += step) for (let x = -2300; x <= 2300; x += step) {
        const r = Math.sqrt(x * x + y * y), n = RINGS.findIndex(([from, to]) => r >= from && r < to);
        if (n < 0) continue;
        const b = w.biomeAt(C + x, C + y), k = w.kindAt(C + x, C + y, b), row = BIOMES[b];
        if (k === K.EMPTY || k === K.BEDROCK) continue;
        sums[n][0] += GRIT[k] * row.rich * row.worth; sums[n][1]++;
      }
    }
    sums.forEach(([grit, cells], n) => { rings[n][key] = grit / cells; });
  }
  CROSS_OK.forEach((list, host) => kept[host].forEach((ok, donor) => { list[donor] = ok; }));
  return rings;
};

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const usage = 'node tools/crosses.mjs [--seeds 8] [--share 40] [--worth 12] [--where 7] [--far 1500]', options = { seeds: '8', share: '', worth: '', where: '', far: '1500' };
  for (let args = process.argv.slice(2), i = 0; i < args.length; i++) {
    const name = args[i].replace(/^--/, '');
    if (!(name in options) || args[i + 1] === undefined) { console.error(usage); process.exit(2); }
    options[name] = args[++i];
  }
  const pct = (n, of) => of ? (n / of * 100).toFixed(1).padStart(5) : '    -';
  if (options.where) {
    const found = where(+options.where, +options.far), said = new Set();
    const say = (label, c) => {
      // (The last level reaches 2,300 cells: a start nearer the world's edge than 40 cells from that is still its.)
      const level = Math.max(0, REACH.findIndex(r => r >= Math.min(c.far + 40, REACH[REACH.length - 1])));
      console.log(`${label.padEnd(20)} ${String(c.id).padStart(3)} ${BIOMES[c.id].title.padEnd(18)} at ${c.at[0]},${c.at[1]}  (${Math.round(c.far)} out: tether level ${level}, reach ${REACH[level]})`);
    };
    console.log(`seed ${options.where}: ${found.length} provinces of crosses within ${options.far} cells\n\nthe nearest of each pair, then the nearest of each of its structures that is not that one:`);
    for (let host = B.FROST; host <= B.LODE; host++) for (const donor of DONORS[host]) {
      const pair = found.filter(c => BIOMES[c.id].cross.host === host && BIOMES[c.id].cross.donor === donor), label = `${BIOMES[host].name} x ${BIOMES[donor].name}`;
      if (!pair.length) { console.log(`${label.padEnd(20)} none`); continue; }
      say(label, pair[0]); said.add(pair[0].id);
      for (const c of pair) if (!said.has(c.id)) { said.add(c.id); say('', c); }
    }
    console.log('\nthe nearest of each structure:');
    for (let s = 0; s < STRUCTURES.length; s++) { const c = found.find(c => BIOMES[c.id].cross.structure === s); if (c) say(STRUCTURES[s] || 'plain', c); else console.log(`${(STRUCTURES[s] || 'plain').padEnd(20)} none`); }
    process.exit(0);
  }
  if (options.worth) {
    console.log(`seeds 1 to ${options.worth}; a cell in every 12 x 12; grit of a solid cell by its ground's rich and worth\n`);
    console.log('cells out      with crosses   without   more');
    for (const t of worth(+options.worth)) console.log(`${`${t.from}-${t.to}`.padEnd(12)} ${t.with.toFixed(3).padStart(14)} ${t.without.toFixed(3).padStart(9)} ${((t.with / t.without - 1) * 100).toFixed(1).padStart(5)}%`);
    process.exit(0);
  }
  if (options.share) {
    const rings = shares(+options.share);
    console.log(`seeds 1 to ${options.share}; a cell in every 16 x 16; the rule: none under ${CROSS_FROM} cells out, then a part in 2,500 a cell, ${CROSS_MOST * 100} in a hundred at the most\n`);
    console.log('cells out     generated: of all   of no deep flank   of provinces (the rule)     strains   own   deep flank   least hand-made on a seed');
    for (const t of rings) {
      const open = t.cells - t.deep;
      console.log(`${`${t.from}-${t.to}`.padEnd(12)} ${pct(t.cross, t.cells).padStart(16)}% ${pct(t.cross, open).padStart(17)}% ${pct(t.crossed, t.provinces).padStart(13)}% (${pct(t.rule, t.provinces).trim()}%) ${pct(t.strain, t.cells).padStart(13)}% ${pct(t.own, t.cells)}% ${pct(t.deep, t.cells).padStart(11)}% ${pct(t.least, 1).padStart(15)}%`);
    }
    process.exit(0);
  }
  const counts = count(+options.seeds), kinds = [K.EMPTY, K.SOFT, K.DENSE, K.ORE_A, K.ORE_B, K.SLATE, K.HAZARD, K.HAZARD2, K.ICE, K.SLAG];
  const line = (name, t, row, beside) => console.log(`${name.padEnd(22)} ${String(t.windows).padStart(4)}   ${kinds.map(k => pct(t.kind[k], t.cells).padStart(8)).join('')}${beside ? `   ${(pays(t, row) / beside).toFixed(2)}` : ''}`);
  console.log(`seeds 1 to ${options.seeds}; a window of ${SIZE} x ${SIZE} cells in the middle of each province; shares are of all cells\n`);
  console.log(`ground                 wins   ${kinds.map(k => KIND_NAMES[k].padStart(8)).join('')}   pays a cell (x its host's)`);
  for (let host = B.FROST; host <= B.LODE; host++) {
    const own = counts.get(host), beside = own ? pays(own, BIOMES[host]) : 0;
    if (own) line(BIOMES[host].name, own, BIOMES[host], 0); else console.log(`${BIOMES[host].name}: no province of it was counted`);
    for (const donor of DONORS[host]) {
      const ids = [0, 1, 2, 3, 4].map(s => crossId(host, donor, s)), t = sum(counts, ids), theirs = counts.get(donor), type = BIOMES[donor].haz?.type;
      if (!t.windows) { console.log(`  ${BIOMES[ids[0]].title}: no province of it was counted`); continue; }
      line(`  ${BIOMES[ids[0]].title} (all)`, t, BIOMES[ids[0]], beside);
      if (type && theirs) console.log(`${''.padEnd(25)}the donor's ${type}: ${pct(t.kind[K.HAZARD2], t.cells).trim()} cells in a hundred, ${(t.kind[K.HAZARD2] / t.cells / (theirs.kind[K.HAZARD] / theirs.cells)).toFixed(2)} of the ${pct(theirs.kind[K.HAZARD], theirs.cells).trim()} in ${BIOMES[donor].name}`);
    }
    for (let s = 0; s < STRUCTURES.length; s++) {
      const ids = DONORS[host].map(donor => crossId(host, donor, s)).filter(id => BIOMES[id].cross.structure === s), t = sum(counts, ids);
      if (t.windows) line(`  ${STRUCTURES[s] || 'plain'} (any donor)`, t, BIOMES[ids[0]], beside);
    }
  }
}
