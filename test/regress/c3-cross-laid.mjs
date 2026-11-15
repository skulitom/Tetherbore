// What a generated cross is made of, counted in real provinces on eight seeds with tools/crosses.mjs (which asks
// the world's own `province`, `biomeAt` and `kindAt`), beside its host's and its donor's own ground
// (docs/CONTENT-PLAN.md, section 4 (a); js/world.js: `crossRow`):
//   - the host's own hazard lies about as thick as in the host's own ground, and its ore;
//   - the donor's hazard lies in it as K.HAZARD2, thinner than in the donor's own ground (lava and pods six or
//     seven tenths, crystals about half: the host has less slate for them to stud), and a cross whose donor is the
//     north has no second hazard at all;
//   - lava from the south brings its rind of slag, and no cross without the south in it has any slag;
//   - the structure shows: HOLLOW is far more open than the plain cross, FROTHY more open, CRAZED is a tenth ice
//     and nothing else has ice, BANDED has its slate in level beds, long along a row and a cell or two thick;
//   - a solid cell pays a fifth to a half more than the host's own ground.
// What each cell is, cell for cell, test/regress/w-same-world.mjs holds.
//   node test/regress/c3-cross-laid.mjs
import { count, sum, pays, provinces } from '../../tools/crosses.mjs';
import { World, C, K, B, BIOMES, PROVINCE, DONORS, STRUCTURES, crossId } from '../../js/world.js';

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const counts = count(8), said = {};
const pc = (t, ...kinds) => kinds.reduce((n, k) => n + t.kind[k], 0) / t.cells * 100, between = (v, lo, hi) => v >= lo && v <= hi, f = v => +v.toFixed(2);
for (let kin = 1; kin <= 4; kin++) check(counts.get(kin)?.windows >= 8, `only ${counts.get(kin)?.windows ?? 0} provinces of ${BIOMES[kin].name} were counted`);

if (!fails.length) for (let host = B.FROST; host <= B.LODE; host++) {
  const own = counts.get(host), name = BIOMES[host].name;
  for (const donor of DONORS[host]) {
    const ids = [0, 1, 2, 3, 4].map(s => crossId(host, donor, s)), t = sum(counts, ids), title = BIOMES[ids[0]].title, theirs = counts.get(donor);
    if (t.windows < 8) { check(false, `only ${t.windows} provinces of ${title} were counted`); continue; }
    const first = pc(t, K.HAZARD), second = pc(t, K.HAZARD2), slag = pc(t, K.SLAG), pay = pays(t, BIOMES[ids[0]]) / pays(own, BIOMES[host]);
    said[title] = { own: f(first), donors: f(second), ofTheDonorsOwn: donor === B.FROST ? undefined : f(second / pc(theirs, K.HAZARD)), slag: f(slag), pays: f(pay) };
    // The host's.
    if (host === B.FROST) check(first === 0, `${title}: ${first.toFixed(2)} cells in a hundred are a first hazard, and the north has none`);
    else check(between(first / pc(own, K.HAZARD), 0.75, 1.1), `${title}: its own hazard is ${first.toFixed(2)} cells in a hundred, ${name}'s ${pc(own, K.HAZARD).toFixed(2)}: not as thick`);
    check(pc(t, K.ORE_A, K.ORE_B) > pc(own, K.ORE_A, K.ORE_B) * 0.75, `${title}: ore is ${pc(t, K.ORE_A, K.ORE_B).toFixed(1)} cells in a hundred, ${name}'s ${pc(own, K.ORE_A, K.ORE_B).toFixed(1)}`);
    // The donor's.
    if (donor === B.FROST) check(second === 0, `${title}: ${second.toFixed(2)} cells in a hundred are a second hazard, and its donor has none`);
    else {
      const share = second / pc(theirs, K.HAZARD), [lo, hi] = donor === B.LODE ? [0.35, 0.75] : [0.45, 0.9];
      check(between(share, lo, hi), `${title}: its donor's hazard is ${second.toFixed(2)} cells in a hundred, ${share.toFixed(2)} of the ${pc(theirs, K.HAZARD).toFixed(2)} in ${BIOMES[donor].name}: not ${lo} to ${hi}`);
    }
    if (host !== B.EMBER && donor === B.EMBER) check(slag > second * 0.8, `${title}: ${slag.toFixed(2)} cells of slag in a hundred round ${second.toFixed(2)} of the donor's lava`);
    if (host !== B.EMBER && donor !== B.EMBER) check(slag === 0, `${title}: ${slag.toFixed(2)} cells in a hundred are slag, and it has no lava`);
    check(between(pay, 1.15, 1.5), `${title}: a solid cell pays ${pay.toFixed(2)} of what one of ${name} does, not a fifth to a half more`);
    // Ice: a tenth of a cross with lanes, none of any other.
    for (const id of ids) {
      const one = counts.get(id);
      if (!one) continue;
      if (BIOMES[id].cross.structure === 2) check(between(pc(one, K.ICE), 8, 16), `${BIOMES[id].title}: lanes of ice are ${pc(one, K.ICE).toFixed(1)} cells in a hundred, not about 12`);
      else check(one.kind[K.ICE] === 0, `${BIOMES[id].title}: ${one.kind[K.ICE]} cells of ice, and it has no lanes`);
    }
  }
  // The structures, whatever the donor, beside the plain cross of the same host.
  const shape = s => sum(counts, DONORS[host].map(donor => crossId(host, donor, s)).filter(id => BIOMES[id].cross.structure === s));
  const plain = shape(0), hollow = shape(1), crazed = shape(2), frothy = shape(3), banded = shape(4);
  for (const [s, t] of [plain, hollow, crazed, frothy, banded].entries()) check(t.windows >= 4, `${name}: only ${t.windows} provinces of its ${STRUCTURES[s] || 'plain'} crosses were counted`);
  if (Math.min(plain.windows, hollow.windows, crazed.windows, frothy.windows, banded.windows) < 4) continue;
  said[`${name} by structure`] = { open: [plain, hollow, crazed, frothy, banded].map(t => f(pc(t, K.EMPTY))), ice: f(pc(crazed, K.ICE)), slate: [f(pc(plain, K.SLATE)), f(pc(banded, K.SLATE))] };
  check(pc(hollow, K.EMPTY) > pc(plain, K.EMPTY) + 4, `${name}: HOLLOW is ${pc(hollow, K.EMPTY).toFixed(1)} open in a hundred, the plain cross ${pc(plain, K.EMPTY).toFixed(1)}`);
  check(pc(frothy, K.EMPTY) > pc(plain, K.EMPTY) + 3, `${name}: FROTHY is ${pc(frothy, K.EMPTY).toFixed(1)} open in a hundred, the plain cross ${pc(plain, K.EMPTY).toFixed(1)}`);
  check(between(pc(crazed, K.ICE), 8, 16), `${name}: CRAZED is ${pc(crazed, K.ICE).toFixed(1)} ice in a hundred`);
  check(between(pc(banded, K.SLATE), 9, 15), `${name}: BANDED is ${pc(banded, K.SLATE).toFixed(1)} slate in a hundred, not about 12`);
}

// BANDED: the slate lies level. Runs of slate along rows and down columns, in the middle of provinces of banded
// crosses and of plain ones.
{
  const SIZE = 96, w = new World(), grid = new Int16Array(SIZE * SIZE), runs = { banded: [[], []], plain: [[], []] };
  for (let seed = 1; seed <= 8; seed++) {
    w.reset(seed);
    for (const [px, py, , ground] of provinces(w)) {
      const cross = BIOMES[ground]?.cross, into = cross?.structure === 4 ? runs.banded : cross?.structure === 0 ? runs.plain : null;
      if (!into) continue;
      const x0 = C + Math.round((px + 0.5) * PROVINCE) - SIZE / 2, y0 = C + Math.round((py + 0.5) * PROVINCE) - SIZE / 2;
      let own = 0;
      for (let v = 0; v < SIZE; v++) for (let u = 0; u < SIZE; u++) { const b = w.biomeAt(x0 + u, y0 + v); grid[v * SIZE + u] = b === ground ? w.kindAt(x0 + u, y0 + v, b) : -1; own += b === ground; }
      if (own < SIZE * SIZE * 0.9) continue;
      for (let way = 0; way < 2; way++) for (let a = 0; a < SIZE; a++) {
        let n = 0;
        for (let b = 0; b <= SIZE; b++) { if (b < SIZE && grid[way ? b * SIZE + a : a * SIZE + b] === K.SLATE) n++; else { if (n && n < SIZE) into[way].push(n); n = 0; } }
      }
    }
  }
  const mean = list => list.reduce((a, b) => a + b, 0) / (list.length || 1);
  const along = mean(runs.banded[0]), down = mean(runs.banded[1]);
  said.bandedSlate = { along: f(along), down: f(down), plain: [f(mean(runs.plain[0])), f(mean(runs.plain[1]))] };
  check(runs.banded[0].length > 2000 && along > 4 && down < 2 && along > mean(runs.plain[0]) * 1.5, `the slate of BANDED crosses runs ${along.toFixed(1)} cells along a row and ${down.toFixed(1)} down a column (plain crosses ${mean(runs.plain[0]).toFixed(1)} and ${mean(runs.plain[1]).toFixed(1)}): not level beds`);
}

console.log(JSON.stringify(said));
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: every cross has its host\'s hazard and ore, its donor\'s hazard thinner as a second, slag only with lava, and its structure in the shape of its ground');
process.exit(fails.length ? 1 : 0);
