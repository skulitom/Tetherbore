// The sites of the four rare hazards, counted with no browser (js/world.js: `World.siteOf`): how many a world has,
// of each type, and by what each was laid; or where they lie in one world.
//   node tools/sites.mjs [--seeds 8] [--where seed] [--at dx,dy] [--near n]
//
//   --seeds n      count over worlds 1 to n (or a list: --seeds 7,11)
//   --where seed   list that world's sites instead, nearest first (to the core, or to `--at`): the type, where its
//                  heart lies as cells east and south of the core, how far out, in what ground, by what it was
//                  laid, and a place beside it to send tools/shot.mjs (`--at`) or a fuzz (--near n: the first n; 24)
//
// By what a site was laid, the largest share that took it: 'herald' (one of the four every world has), 'cross'
// (its middle in a generated cross), 'deep' (in a deep flank), 'far' (past 1,500 cells out) or 'plain' (in the
// middle of one ground all round). The targets: 30 to 60 sites a world, four or more of each type, and the four
// heralds.
import { fileURLToPath } from 'node:url';
import { World, C, SITE, SITE_OUT, SITE_SHARE, WORLD_R, RARE, rowOf, cellHash } from '../js/world.js';

export const TYPES = RARE.slice(1);
// By what a site was laid: asked again of its sector as `siteOf` asks it.
export function family(w, S) {
  if (S.herald) return 'herald';
  const mx = C + S.sx * SITE + Math.floor((cellHash(S.sx, S.sy, w.seed + 61) - 0.5) * 21), my = C + S.sy * SITE + Math.floor((cellHash(S.sx, S.sy, w.seed + 62) - 0.5) * 21);
  const row = rowOf(w.biomeAt(mx, my)), far = Math.hypot(mx - C, my - C), h = cellHash(S.sx, S.sy, w.seed + 60);
  const deep = row.id >= 5 && row.id <= 8;
  return row.cross !== null ? 'cross' : deep ? (h < SITE_SHARE.deep ? 'deep' : 'plain') : far > SITE_OUT && h < SITE_SHARE.far ? 'far' : 'plain';
}
// Every site of world `seed`: the records, nearest the core first.
export function sitesOf(seed) {
  const w = new World(); w.reset(seed);
  return { w, sites: w.sitesWithin(WORLD_R) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const usage = 'node tools/sites.mjs [--seeds 8] [--where seed] [--at dx,dy] [--near n]', options = { seeds: '8', where: '', at: '0,0', near: '24' };
  for (let n = 2; n < process.argv.length; n += 2) {
    const name = process.argv[n].replace(/^--/, '');
    if (!(name in options) || process.argv[n + 1] === undefined) { console.error(usage); process.exit(2); }
    options[name] = process.argv[n + 1];
  }
  if (options.where) {
    const { w, sites } = sitesOf(Number(options.where)), [ax, ay] = options.at.split(',').map(Number);
    const from = S => Math.hypot(S.cx - C - ax, S.cy - C - ay);
    for (const S of sites.sort((a, b) => from(a) - from(b)).slice(0, Number(options.near))) {
      const dx = S.cx - C, dy = S.cy - C, r = Math.hypot(dx, dy), out = (r - S.reach - 4) / r;
      console.log(`${S.type.padEnd(9)} at ${dx},${dy} (${Math.round(r)} out, ${rowOf(w.biomeAt(S.cx, S.cy)).name}, ${family(w, S)})  beside: ${Math.round(dx * out)},${Math.round(dy * out)}`);
    }
  } else {
    const seeds = options.seeds.includes(',') ? options.seeds.split(',').map(Number) : Array.from({ length: Number(options.seeds) }, (_, n) => n + 1);
    const all = { sites: 0 }, unsited = {};
    for (const seed of seeds) {
      const { w, sites } = sitesOf(seed), types = Object.fromEntries(TYPES.map(t => [t, 0])), by = {};
      for (const S of sites) { types[S.type]++; const f = family(w, S); by[f] = (by[f] ?? 0) + 1; all[f] = (all[f] ?? 0) + 1; all[S.type] = (all[S.type] ?? 0) + 1; }
      all.sites += sites.length;
      for (const [why, n] of Object.entries(w.unsited)) unsited[why] = (unsited[why] ?? 0) + n;
      const heralds = sites.filter(S => S.herald).map(S => S.type), miss = [sites.length < 30 || sites.length > 60 ? 'count' : '', ...TYPES.filter(t => types[t] < 4), ...TYPES.filter(t => !heralds.includes(t)).map(t => `no ${t} herald`)].filter(Boolean);
      console.log(`seed ${seed}: ${sites.length} sites  ${TYPES.map(t => `${t} ${types[t]}`).join(', ')}  by ${Object.entries(by).map(([f, n]) => `${f} ${n}`).join(', ')}  nearest ${Math.round(Math.hypot(sites[0].cx - C, sites[0].cy - C))}${miss.length ? `  MISSES: ${miss.join(', ')}` : ''}`);
    }
    console.log(JSON.stringify({ seeds: seeds.length, ...all, perWorld: +(all.sites / seeds.length).toFixed(1) }));
    console.log(`not laid, of the sectors whose hash could have held one (far: past the world's edge too): ${JSON.stringify(unsited)}`);
  }
}
