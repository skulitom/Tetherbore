// The model check of the whole content build (docs/CONTENT-PLAN.md, section 4): what a cell of ground is worth at each
// distance and in each direction, now and as the world lay with grounds 0 to 8 alone, with no browser and none of
// the world made.
//   node tools/ground-worth.mjs [--seeds 4] [--cells 20000] [--against <a checkout of the game>] [--rows]
//
// The game's prices are worked out from one figure for the ground, WORTH (js/game.js: 1.6, "grit in an average
// cell"), and the plan's rule is: if the sampled mean of a ring moves more than 15 in a hundred from what it was
// with grounds 0 to 8 alone, WORTH is set to the sampled figure and every price follows. This says whether it has.
//
// In each ring (200, 400, 700, 1,000, 1,500 and 2,000 cells out, forty cells to either side) and each direction
// (the quarter of the ring nearest north, south, west and east) `--cells` cells are asked about on each of the
// worlds 1 to `--seeds`: whose ground each is (`biomeAt`) and what it is (`kindAt`). The same cells are asked of
// the world six times over, with what the build laid added a part at a time:
//   before     grounds 0 to 8 alone, as they were: no slag, no crystals on slate, no provinces, slabs, prisms, pockets
//   rules      with the rind of slag round lava and the crystals on the flanks of slate (content item 2)
//   strains    with the provinces of hand-made strains (item 1)
//   crosses    with the provinces of generated crosses (item 3)
//   slabs      with keystone slabs, cobble fields and prisms (item 5)
//   now        with pockets (items 6 and 7): the world as it is
// What is printed:
//   solid      the share of the cells that are ground (not open, not bedrock)
//   worth      the mean over solid cells of the kind's grit times its ground's `rich` and `worth`: what the rule
//              is about, at each of the six, and how far `now` has moved from `before`
//   an area    the same sum over every cell asked about, open ones too: a loop frees an area, and ground with more
//              open in it (bubbles, great caves, a drift) frees fewer cells for the same cut
//   + lumps    the area's figure with what is paid as a lump counted in: a cache, and a cell of a pocket's mineral,
//              pay so many seconds of the model's income whatever the haul, which is so much grit of a plain cell
//              hauled out there (the lump, divided by what multiplies a plain cell's grit in the model's haul).
//              A drift's aerolite is counted with no chain; in a chain it pays up to twice that.
// With `--against` the same cells are also asked of another checkout's js/world.js (the game as it was before the
// build: commit 4293f7c), which is what `before` says it is: the two must agree. `--rows` lists, for each ring,
// how much of it is each ground.
import { income, richness, haulBonus } from '../test/harness.mjs';
import { World, C, K, B, BIOMES, GRIT, FINDS, rowOf } from '../js/world.js';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const RINGS = [200, 400, 700, 1000, 1500, 2000], BAND = 40, MOST = 0.15;
export const WAYS = [['north', 0, -1], ['south', 0, 1], ['west', -1, 0], ['east', 1, 0]];
export const STAGES = ['before', 'rules', 'strains', 'crosses', 'slabs', 'now'];
const CACHE_SECONDS = 12;                       // js/game.js, payOf: a cache holds twelve seconds of income

// The world with only so much of what the build laid: `on` says which parts.
class Staged extends World {
  constructor(on) { super(); this.on = on; }
  zoneOf(sx, sy) { return this.on.pockets ? super.zoneOf(sx, sy) : null; }
  province(px, py, kin) {
    const b = super.province(px, py, kin);
    return b === kin || (b >= 128 ? this.on.crosses : this.on.strains) ? b : kin;
  }
  slabAt(x, y) { return this.on.slabs ? super.slabAt(x, y) : 0; }
  findAt(x, y) {
    const k = super.findAt(x, y);
    return !this.on.slabs && this.sector.what >= FINDS[1][0] && this.sector.what < FINDS[2][0] ? -1 : k;
  }
}
const PARTS = { before: {}, rules: { rules: 1 }, strains: { rules: 1, strains: 1 }, crosses: { rules: 1, strains: 1, crosses: 1 },
  slabs: { rules: 1, strains: 1, crosses: 1, slabs: 1 }, now: { rules: 1, strains: 1, crosses: 1, slabs: 1, pockets: 1 } };
// Grounds 2, 4, 6 and 8 as they were laid before the direction rules: the same rows with no rind and no ribs.
// (Copies stand in the table while `before` is asked, and the rows themselves are put back.)
const bare = () => {
  const kept = [2, 4, 6, 8].map(id => BIOMES[id]);
  for (const row of kept) BIOMES[row.id] = { ...row, lay: { ...row.lay, rind: 0, rind2: 0, ribs: 0, ribs2: 0 } };
  return () => { for (const row of kept) BIOMES[row.id] = row; };
};
// A repeatable stream of numbers in [0, 1): the tool's own, so that every run asks the same cells.
const random = seed => { let s = (seed * 2654435761) >>> 0; return () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296; };
// `count` cells of ring `R` in the quarter that faces (ux, uy), as offsets from the core.
export function cells(seed, R, ux, uy, count) {
  const rnd = random(seed * 977 + R * 13 + (ux + 2) * 5 + uy), r0 = R - BAND, r1 = R + BAND, out = new Int32Array(count * 2);
  for (let n = 0; n < count;) {
    // A point of the square that holds the quarter's part of the ring, kept if it is in the ring and the quarter.
    const along = r0 * 0.7 + rnd() * (r1 - r0 * 0.7), across = (rnd() * 2 - 1) * r1, x = Math.round(ux * along - uy * across), y = Math.round(uy * along + ux * across);
    const rr = x * x + y * y;
    if (rr < r0 * r0 || rr >= r1 * r1 || Math.abs(across) > along) continue;
    out[2 * n] = x; out[2 * n + 1] = y; n++;
  }
  return out;
}
// What a lump of `seconds` of income, paid for a cell `far` cells out, is in the grit of a plain cell hauled there:
// the model's loop out there is cut by a reach of far / 0.7, and multiplies a cell's grit by how rich the ground is
// that far out and by the bonus of its size.
const lumpAs = (seconds, far) => {
  const side = Math.max(4, Math.min(48, far / 0.7 / 3));
  return seconds * income(Math.max(22, far)) / (richness(far) * haulBonus(side * side));
};
// One ring and direction of one world at one stage: { asked, solid, grit, lumps, rows }.
function sample(w, list, into) {
  for (let n = 0; n < list.length; n += 2) {
    const x = C + list[n], y = C + list[n + 1], b = w.biomeAt(x, y), k = w.kindAt(x, y, b), row = rowOf(b);
    into.asked++;
    into.rows[b] = (into.rows[b] ?? 0) + 1;
    if (k === K.EMPTY || k === K.BEDROCK) continue;
    into.solid++;
    into.grit += GRIT[k] * row.rich * row.worth;
    if (b === B.CRUST && (k === K.ORE_A || k === K.ORE_B)) into.grit += (k === K.ORE_B ? 20 : 4) * row.rich * row.worth;
    const far = Math.sqrt(list[n] * list[n] + list[n + 1] * list[n + 1]);
    if (k === K.CACHE) into.lumps += lumpAs(CACHE_SECONDS, far);
    else if (row.pocket !== null && k === (row.pocket.kind ?? K.MINERAL)) into.lumps += lumpAs(row.pocket.lump, far);
  }
}
// Every ring and direction at every stage, over the worlds 1 to `seeds`: sums[stage][ring][way].
export function count(seeds = 4, each = 20000) {
  const sums = {};
  for (const stage of STAGES) {
    const w = new Staged(PARTS[stage]), back = stage === 'before' ? bare() : null;
    sums[stage] = RINGS.map(() => WAYS.map(() => ({ asked: 0, solid: 0, grit: 0, lumps: 0, rows: [] })));
    for (let seed = 1; seed <= seeds; seed++) {
      w.reset(seed);
      RINGS.forEach((R, r) => WAYS.forEach(([, ux, uy], d) => sample(w, cells(seed, R, ux, uy, each), sums[stage][r][d])));
    }
    back?.();
  }
  return sums;
}
// The same cells asked of another checkout's world (the game before the build, whose grounds 5 to 8 pay double
// and whose kinds have their grit in a list).
export async function against(dir, seeds = 4, each = 20000) {
  const old = await import(pathToFileURL(resolve(dir, 'js/world.js')).href), w = new old.World();
  const rich = b => old.BIOMES ? old.BIOMES[b].rich * old.BIOMES[b].worth : b > 4 ? 2 : 1;
  return RINGS.map(R => WAYS.map(([, ux, uy]) => {
    const into = { asked: 0, solid: 0, grit: 0 };
    for (let seed = 1; seed <= seeds; seed++) {
      w.reset(seed);
      const list = cells(seed, R, ux, uy, each);
      for (let n = 0; n < list.length; n += 2) {
        const x = old.C + list[n], y = old.C + list[n + 1], b = w.biomeAt(x, y), k = w.kindAt(x, y, b);
        into.asked++;
        if (k === old.K.EMPTY || k === old.K.BEDROCK) continue;
        into.solid++;
        into.grit += old.GRIT[k] * rich(b);
        if (b === 0 && (k === old.K.ORE_A || k === old.K.ORE_B)) into.grit += k === old.K.ORE_B ? 20 : 4;
      }
    }
    return into;
  }));
}
const whole = list => list.reduce((sum, s) => ({ asked: sum.asked + s.asked, solid: sum.solid + s.solid, grit: sum.grit + s.grit, lumps: sum.lumps + (s.lumps ?? 0) }), { asked: 0, solid: 0, grit: 0, lumps: 0 });
// The worst a ring has moved, of the mean over solid cells: { ring, way, moved } (`way` is 'all' for a whole ring).
export function worst(sums) {
  let most = { ring: 0, way: 'all', moved: 0 };
  RINGS.forEach((R, r) => {
    const was = whole(sums.before[r]), now = whole(sums.now[r]), moved = now.grit / now.solid / (was.grit / was.solid) - 1;
    if (Math.abs(moved) > Math.abs(most.moved)) most = { ring: R, way: 'all', moved };
  });
  return most;
}

if (process.argv[1] && import.meta.url.endsWith('/' + process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const arg = (name, fallback) => { const n = process.argv.indexOf(`--${name}`); return n < 0 ? fallback : process.argv[n + 1]; };
  const seeds = Number(arg('seeds', 4)), each = Number(arg('cells', 20000)), dir = arg('against'), sums = count(seeds, each);
  const old = dir ? await against(dir, seeds, each) : null;
  const pc = x => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`, f = x => x.toFixed(3);
  console.log(`worlds 1 to ${seeds}; ${each} cells in each ring and direction of each world; rings ${BAND} cells to either side`);
  console.log(`a solid cell's grit by its ground's rich and worth, with what the build laid added a part at a time\n`);
  console.log(`ring  where   solid: before  now    worth: ${STAGES.map(s => s.padStart(7)).join(' ')}   moved${old ? '   the old game' : ''}`);
  const flagged = [];
  RINGS.forEach((R, r) => {
    const line = (name, at, was) => {
      const per = stage => at(stage).grit / at(stage).solid, moved = per('now') / per('before') - 1;
      if (Math.abs(moved) > MOST) flagged.push(`${R} ${name} ${pc(moved)}`);
      console.log(`${String(R).padStart(4)}  ${name.padEnd(6)}        ${(at('before').solid / at('before').asked * 100).toFixed(1).padStart(5)}% ${(at('now').solid / at('now').asked * 100).toFixed(1).padStart(5)}%        ${STAGES.map(s => f(per(s)).padStart(7)).join(' ')}  ${pc(moved).padStart(6)}${Math.abs(moved) > MOST ? ' !' : ''}`
        + (was ? `   ${f(was.grit / was.solid)}${Math.abs(was.grit / was.solid - per('before')) > 1e-9 ? ' (differs from `before`)' : ''}` : ''));
    };
    WAYS.forEach(([name], d) => line(name, stage => sums[stage][r][d], old?.[r][d]));
    line('all', stage => whole(sums[stage][r]), old ? whole(old[r]) : null);
  });
  console.log(`\nby the area asked about (open cells too), and with what is paid as a lump counted in as a plain cell's grit`);
  console.log(`ring   an area: before     now   moved     + lumps: before     now   moved`);
  RINGS.forEach((R, r) => {
    const was = whole(sums.before[r]), now = whole(sums.now[r]), a = was.grit / was.asked, b = now.grit / now.asked, la = (was.grit + was.lumps) / was.asked, lb = (now.grit + now.lumps) / now.asked;
    console.log(`${String(R).padStart(4)}            ${f(a).padStart(7)} ${f(b).padStart(7)}  ${pc(b / a - 1).padStart(6)}              ${f(la).padStart(7)} ${f(lb).padStart(7)}  ${pc(lb / la - 1).padStart(6)}`);
  });
  if (process.argv.includes('--rows')) {
    console.log(`\nwhose ground each ring is, as it is now (of all the cells asked about; grounds under half a cell in a hundred left out)`);
    RINGS.forEach((R, r) => {
      const rows = [];
      let asked = 0;
      for (const s of sums.now[r]) { asked += s.asked; s.rows.forEach((n, b) => { rows[b] = (rows[b] ?? 0) + n; }); }
      const shares = rows.map((n, b) => [b, n / asked]).filter(Boolean).filter(([, share]) => share >= 0.005).sort((p, q) => q[1] - p[1]);
      const made = rows.reduce((sum, n, b) => sum + (b >= 128 ? n : 0), 0) / asked;
      console.log(`${String(R).padStart(4)}  ${shares.map(([b, share]) => `${rowOf(b).title.toLowerCase()} ${(share * 100).toFixed(1)}`).join(', ')}${made ? `; generated ${(made * 100).toFixed(1)}` : ''}`);
    });
  }
  const top = worst(sums);
  console.log(`\nthe rule: no ring's mean over solid cells may move more than ${MOST * 100} in a hundred. The most a whole ring moved: ${pc(top.moved)} at ${top.ring}.`);
  console.log(flagged.length ? `over the rule: ${flagged.join('; ')}` : 'no ring and no direction of a ring is over it: WORTH and every price stay as they are');
}
