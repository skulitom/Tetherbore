// Where the creatures live (js/fauna.js), from the seed alone and making none of the world.
//   node tools/dens.mjs                      how many dens of each kind lie within each ring round the core, on worlds 1 to 8
//   node tools/dens.mjs --where 7            world 7's dens, by kind, the nearest few of each first, with a place to stand
//   node tools/dens.mjs --where 7 --kind bat --most 10
// A den is a sector's, its middle and its kind worked out from the seed as the game does (`Fauna.denOf`); whether it
// finds a home is the ground's to say once it has been seen (a natural open cell near its middle that suits what lives
// there), so not every den listed holds creatures. The place to stand is the den's middle, for tools/shot.mjs:
// `--cave --at dx,dy` stands the drill in the nearest natural cave, where the den will look for its home.
import { makeGame, C } from '../test/harness.mjs';
import { Fauna, CREATURES, DEN, KIN } from '../js/fauna.js';
import { BIOMES } from '../js/world.js';

const args = process.argv.slice(2), option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const where = option('--where'), only = option('--kind'), most = Number(option('--most') ?? 4), R = Number(option('--out') ?? 1200);
const dens = async seed => {
  const game = await makeGame(seed), f = new Fauna(), out = [];
  f.reset(seed, null);
  for (const [grid, side] of [[0, DEN], [1, KIN]]) for (let sy = Math.floor(-R / side); sy <= R / side; sy++) for (let sx = Math.floor(-R / side); sx <= R / side; sx++) {
    if (f.dens.size > 80) f.reset(seed, null);
    const d = f.denOf(game, grid, sx, sy);
    if (!d) continue;
    const far = Math.hypot(d.mx - C, d.my - C);
    if (far <= R) out.push({ kind: CREATURES[d.kind].key, tier: CREATURES[d.kind].tier, at: [d.mx - C, d.my - C], far: Math.round(far), ground: BIOMES[d.row].name, flock: d.flock });
  }
  return out.sort((a, b) => a.far - b.far);
};
if (where !== undefined) {
  const list = await dens(Number(where));
  for (const c of CREATURES.slice(1)) {
    if (only && c.key !== only) continue;
    const mine = list.filter(d => d.kind === c.key);
    console.log(`${c.name} (${c.tier}): ${mine.length} dens within ${R} cells`);
    for (const d of mine.slice(0, most)) console.log(`  ${String(d.far).padStart(5)} out in ${d.ground.padEnd(10)} ${d.flock > 1 ? `${d.flock} of them` : 'one'}; stand at --cave --at ${d.at.join(',')}`);
  }
} else {
  const RINGS = [130, 250, 500, 900, R];
  console.log(`dens by kind and ring, worlds 1 to 8 (rings out to ${RINGS.join(', ')} cells)`);
  const count = {};
  for (let seed = 1; seed <= 8; seed++) for (const d of await dens(seed)) { const ring = RINGS.findIndex(r => d.far <= r); (count[d.kind] ??= RINGS.map(() => 0))[ring]++; }
  for (const c of CREATURES.slice(1)) console.log(`  ${c.key.padEnd(11)} ${c.tier.padEnd(7)} ${(count[c.key] ?? []).map(n => String((n / 8).toFixed(1)).padStart(6)).join('')}  a world`);
}
