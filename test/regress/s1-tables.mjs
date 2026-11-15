// The table of kinds and the table of grounds (js/world.js: K, BIOMES) say what the game's separate lists said
// before there were tables: the lists are written out here as they stood. And what was added is as the plan has
// it (docs/CONTENT-PLAN.md S1): kinds 15 to 27 have their numbers, none of them is unminable, and every sheet a
// row names is one the art has.
//   node test/regress/s1-tables.mjs
import { readFile } from 'node:fs/promises';
import { world } from '../harness.mjs';
const { K, HARD, GRIT, GEMS, DIG_TIME, KIND_NAMES, BIOMES, HAZARDS, B, rowOf, hazOf, gemKin, digTime, biome } = world;

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Kinds 0 to 14, as the game had them.
const was = {
  K: { EMPTY: 0, CORE: 1, BEDROCK: 2, SOFT: 3, DENSE: 4, ORE_A: 5, ORE_B: 6, SLATE: 7, VAULT: 8, HAZARD: 9, RELIC: 10, ICE: 11, BASALT: 12, CACHE: 13, WRECK: 14 },
  HARD: [0, 99, 99, 1, 1, 1, 1, 1, 1, 1, 99, 1, 1, 1, 99],
  GRIT: [0, 0, 0, 1, 2, 2, 4, 4, 10, 3, 0, 0, 1, 0, 0],
  GEMS: [0, 0, 0, 0, 0, 1, 5, 0, 0, 2, 0, 0, 0, 0, 0],
  DIG_TIME: [0, 0, 0, 0.24, 0.45, 0.24, 0.45, 1.0, 1.8, 0.24, 0, 0.18, 0.45, 0.6, 0],
};
for (const [name, id] of Object.entries(was.K)) check(K[name] === id && KIND_NAMES[id] === name, `kind ${name} is no longer number ${id}`);
for (const list of ['HARD', 'GRIT', 'GEMS', 'DIG_TIME']) check(same(world[list].slice(0, 15), was[list]), `${list} for kinds 0 to 14 is not as it was: ${world[list].slice(0, 15)}`);
// Kinds 15 to 27: [hard, grit, gems, dig], from the plan.
const added = {
  MINERAL: [15, 1, 0, 0, 0.45], NODE: [16, 1, 0, 0, 0.45], HAZARD2: [17, 1, 3, 2, 0.24], KEY: [18, 1, 4, 0, 1.0], FAULT: [19, 1, 1, 0, 0.12], SLAG: [20, 1, 2, 0, 0.45],
  STEEL: [21, 1, 6, 2, 0.6], CAP: [22, 1, 1, 1, 0.24], CAP_LIT: [23, 1, 1, 3, 0.24], PRISM: [24, 1, 0, 0, 0.6], GLASS: [25, 1, 1, 0, 0.12], TWIN: [26, 1, 2, 0, 0.6], FOSSIL: [27, 1, 2, 0, 1.0],
};
for (const [name, [id, hard, grit, gems, dig]] of Object.entries(added)) {
  check(K[name] === id && same([HARD[id], GRIT[id], GEMS[id], DIG_TIME[id]], [hard, grit, gems, dig]), `kind ${name} (${id}) is not as the plan has it: ${[K[name], HARD[id], GRIT[id], GEMS[id], DIG_TIME[id]]}`);
  check(HARD[id] === 1 && DIG_TIME[id] > 0, `kind ${name} cannot be cut: nothing new is unminable`);
}
check(Object.keys(K).length >= 28 && HARD.length === Object.keys(K).length && new Set(Object.values(K)).size === HARD.length && HARD.length <= 32, 'the kinds are not numbers 0 to 31 at the most, each its own, with none left out');

// Grounds 0 to 8, as the game's lists had them.
const NAMES = ['crust', 'frost', 'ember', 'mire', 'lode', 'rime', 'magma', 'bloom', 'gilt'];
const GLOOM = [[10, 8, 7], [5, 12, 30], [22, 5, 6], [14, 6, 26], [22, 13, 4], [3, 18, 24], [30, 5, 3], [26, 4, 28], [24, 18, 2]];
const MOTE = ['#8a7a66', '#ffffff', '#ff9a3a', '#a5f0a0', '#ffe08a', '#d8fff4', '#ffc040', '#ffa0e0', '#ffe680'];
const MAPC = [[111, 91, 73], [188, 216, 238], [116, 64, 58], [102, 84, 120], [185, 138, 90], [98, 184, 180], [122, 36, 24], [138, 60, 140], [110, 90, 52]];
const DEBRIS = {
  crust: ['#6f5b49', '#806a55', '#a08a6c'], frost: ['#bcd8ee', '#ffffff', '#a2c4e2'], ember: ['#74403a', '#c07a5c', '#ff8a3a'], mire: ['#665478', '#5f9450', '#b4e878'],
  lode: ['#b98a5a', '#f0d8a0', '#a57648'], rime: ['#62b8b4', '#d8fff4', '#84d4c8'], magma: ['#7a2418', '#e8743a', '#ffb040'], bloom: ['#8a3c8c', '#ffa0e0', '#7af0d0'], gilt: ['#6e5a34', '#ffe680', '#ffd040'],
};
const base = b => b > 4 ? b - 4 : b, DRIFT = ['still', 'fall', 'rise', 'sway', 'still'], HAZ = [null, null, 'lava', 'spore', 'spark'];
const atlas = JSON.parse(await readFile(new URL('../../assets/atlas.json', import.meta.url), 'utf8'));
for (let b = 0; b <= 8; b++) {
  const row = BIOMES[b], kin = base(b), deep = b > 4;
  if (!row) { check(false, `ground ${b} has no row`); continue; }
  check(row.id === b && row.name === NAMES[b] && row.sheet === NAMES[b] && row.floor === `${NAMES[b]}-floor`, `ground ${b}: name or sheets are not ${NAMES[b]}'s`);
  check(row.items === (b ? `${NAMES[kin]}-items` : 'lode-items'), `ground ${b}: its ore is drawn from ${row.items}`);
  check(row.kin === kin && row.gemA === kin && row.gemB === kin, `ground ${b}: its kin or whose gems its ore pays is not ${kin}`);
  check(row.rich === (deep ? 2 : 1) && row.gemx === (b ? (deep ? 2 : 1) : 0) && row.worth === 1 && row.dig === 1 && row.dark === 1, `ground ${b}: rich ${row.rich} gemx ${row.gemx} worth ${row.worth} dig ${row.dig} dark ${row.dark}`);
  check(same(row.gloom, GLOOM[b]) && same(row.mote, [MOTE[b], DRIFT[kin]]) && same(row.map, MAPC[b]) && same(row.debris, DEBRIS[NAMES[b]]), `ground ${b}: gloom, motes, map colour or debris are not as they were`);
  check(row.freeze === (kin === B.FROST ? 30 : 0) && row.lavaVol === 5, `ground ${b}: freeze ${row.freeze}, lavaVol ${row.lavaVol}`);
  check((row.haz?.type ?? null) === HAZ[kin] && row.haz2 === null && hazOf(K.HAZARD, row) === HAZ[kin] && hazOf(K.HAZARD2, row) === null && hazOf(K.SOFT, row) === null, `ground ${b}: its hazard is not ${HAZ[kin]} alone`);
  // Whose gems each paying kind pays: its ground's kin, as `gems[base(b)]` had it.
  for (const k of [K.ORE_A, K.ORE_B, K.HAZARD]) check(gemKin(k, row) === kin, `ground ${b}: kind ${k} pays gems of ${gemKin(k, row)}, not ${kin}`);
  for (let k = 0; k < 15; k++) check(digTime(k, row) === was.DIG_TIME[k], `ground ${b}: kind ${k} takes ${digTime(k, row)} s to cut, not ${was.DIG_TIME[k]}`);
  // The sheets the row names are the art's, with the frames the game draws from them.
  check(atlas[row.sheet] && atlas[row.floor] && ['dense', 'oreA', 'oreB', 'relic'].every(f => atlas[row.items]?.frames[f]), `ground ${b}: a sheet it names is not in assets/atlas.json`);
}
// The thresholds the standard ground is laid by, as kindAt had them in its branches.
for (let b = 1; b <= 8; b++) {
  const g = BIOMES[b].gen, kin = base(b), deep = b > 4;
  check(same(g, { dense: kin === B.EMBER ? 0.64 : 0.68, oreA: deep ? 0.6 : 0.66, oreB: deep ? 0.66 : 0.74, slate: kin === B.LODE ? 0.05 : 0.03, cave: kin === B.MIRE ? 0.68 : 0.8, cavern: kin === B.MIRE ? 0.7 : 0.78 }),
    `ground ${b}: its thresholds are ${JSON.stringify(g)}`);
  const haz = BIOMES[b].haz;
  if (haz) check(haz.rate === (deep ? 1.8 : 1) && (haz.type !== 'lava' || haz.t === (deep ? 0.72 : 0.78)), `ground ${b}: its hazard is laid by ${JSON.stringify(haz)}`);
}
check(BIOMES[0].gen === null && BIOMES[0].lay === null, 'the home ground is laid by thresholds: it has rules of its own');
// Each hazard's sprite is on its type's own sheet, whose gems it pays are its type's.
for (const [type, kin] of [['lava', B.EMBER], ['spore', B.MIRE], ['spark', B.LODE]]) {
  check(HAZARDS[type].kin === kin && atlas[HAZARDS[type].sheet]?.frames['hazard-b'] && atlas[HAZARDS[type].sheet].animations.hazard, `the ${type} hazard has no kin ${kin} or no sprite`);
}
// The kinds whose gems are a direction's whatever ground they lie in.
check(gemKin(K.STEEL, BIOMES[1]) === B.EMBER && gemKin(K.CAP, BIOMES[1]) === B.MIRE && gemKin(K.CAP_LIT, BIOMES[4]) === B.MIRE, 'steel pays other than the south, or caps other than the west');
// A number with no row reads as the home ground; a row must say its own looks; a pocket's node takes its row's time.
check(rowOf(200) === BIOMES[0] && rowOf(3) === BIOMES[3], 'rowOf does not fall back on the home ground');
let threw = 0;
for (const bad of [{ id: 126, name: 'x' }, { id: 300, name: 'x', gloom: [], mote: [], map: [], debris: [] }, { id: 126, name: 'x', gloom: [], mote: [], map: [], debris: [], haz: { type: 'lava' } },
  { id: 126, name: 'x', gloom: [], mote: [], map: [], debris: [], haz2: { type: 'gas' } }]) { try { biome(bad); } catch { threw++; } }
check(threw === 4 && BIOMES[126] === undefined, 'a row with no looks, a number past 255, lava with no threshold or an unknown hazard was taken');
const pocket = biome({ id: 126, name: 'test-pocket', kin: 2, dig: 2, gloom: [1, 2, 3], mote: ['#fff', 'still'], map: [1, 2, 3], debris: ['#000'], pocket: { nodeDig: 0.9 } });
check(digTime(K.NODE, pocket) === 1.8 && digTime(K.SOFT, pocket) === 0.48 && digTime(K.NODE, BIOMES[1]) === 0.45, `a node's time to cut is not its pocket's: ${digTime(K.NODE, pocket)}`);
check(pocket.title === 'TEST-POCKET' && pocket.items === 'ember-items' && pocket.lay === null, 'a row left its title, its ore sheet or its thresholds undefaulted');

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: kinds 0 to 14 and grounds 0 to 8 are as the lists had them, and kinds 15 to 27 as the plan has them');
process.exit(fails.length ? 1 : 0);
