// The generated crosses (docs/CONTENT-PLAN.md, section 4 (a) and content item 3; js/world.js: `crossRow`) are sixty
// rows of the table of grounds at numbers that never move, each made by one rule from three hand-made parts. Held
// here, for every host, donor and structure:
//   - its number: 128 + (host - 1) x 15 + (which of the other three, in the order of their numbers) x 5 + structure;
//   - the host's: its direction, its thresholds, its floor, its dark and motes, its ore's sheet, its own hazard as
//     thick as in its own ground, and whose gems its plain ore pays;
//   - the donor's: whose gems its rich ore pays and whose sheet that ore is drawn from, and its trait at six
//     tenths: the north's a cut that closes after 30 seconds, the others' their hazard as the ground's second
//     (lava over 0.80 with its rind of slag, pods or crystals six tenths as many, crystals on the flanks of slate);
//   - the structure: none, great caves (0.62), lanes of ice (only where the host or the donor is the north:
//     elsewhere the row is the plain one's twin), bubbles, or level beds of slate in place of ribs;
//   - a quarter more pay than its host, in the same gems;
//   - its name from the handwritten table of twelve, the structure's word before it, twenty letters at the most;
//   - its sheet of rock, which the art has, and its colour on the map and its chips as the art made them
//     (assets/atlas.json), with the donor's brightest colour for the third chip;
//   - the eye's verdict: all twelve pairs passed.
// And no hand-made row calls itself a cross.
//   node test/regress/c3-cross-rows.mjs
import { readFile } from 'node:fs/promises';
import { world } from '../harness.mjs';
const { K, B, BIOMES, TELLS, HAZARDS, CROSS, WEAK, STRUCTURES, DONORS, CROSS_OK, crossId, hazOf, gemKin } = world;

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const atlas = JSON.parse(await readFile(new URL('../../assets/atlas.json', import.meta.url), 'utf8'));

const NAMES = {
  1: { 2: 'THAW', 3: 'TUNDRA', 4: 'HAILSTONE' },
  2: { 1: 'QUENCH', 3: 'SOOTFEN', 4: 'FLASHROCK' },
  3: { 1: 'RIMEMOSS', 2: 'SMOULDER', 4: 'BUZZMIRE' },
  4: { 1: 'HOARSAND', 2: 'KILNSTONE', 3: 'MOULDSTONE' },
};
const WORDS = ['', 'HOLLOW', 'CRAZED', 'FROTHY', 'BANDED'], ACCENT = { 1: '#e8fbff', 2: '#ff8a3a', 3: '#b4e878', 4: '#ffe08a' };
const TRAIT = { 1: null, 2: { type: 'lava', rate: 0.6, t: 0.80 }, 3: { type: 'spore', rate: 0.6 }, 4: { type: 'spark', rate: 0.6 } };
const OFF = { rivers: 0, lanes: 0, bubbles: 2, grapes: 2, strata: 0 };
const hex = rgb => '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');

check(CROSS === 128 && WEAK === 0.6 && same(STRUCTURES, WORDS), `crosses begin at ${CROSS}, the donor's trait is at ${WEAK}, the structures are ${STRUCTURES}`);
check(same(DONORS, [[], [2, 3, 4], [1, 3, 4], [1, 2, 4], [1, 2, 3]]), `the donors of each host are ${JSON.stringify(DONORS)}`);
const titles = new Map();
let rows = 0;
for (let host = 1; host <= 4; host++) for (let d = 0; d < 3; d++) for (let structure = 0; structure < 5; structure++) {
  const donor = [1, 2, 3, 4].filter(k => k !== host)[d], id = 128 + (host - 1) * 15 + d * 5 + structure, row = BIOMES[id], own = BIOMES[host], from = BIOMES[donor];
  const frosty = host === B.FROST || donor === B.FROST, shape = structure === 2 && !frosty ? 0 : structure;
  const title = (shape ? WORDS[shape] + ' ' : '') + NAMES[host][donor], what = `${id} (${title})`;
  if (!row) { check(false, `ground ${id} has no row`); continue; }
  rows++;
  check(crossId(host, donor, structure) === id && row.id === id, `${what}: its number by the rule is ${crossId(host, donor, structure)}`);
  check(same(row.cross, { host, donor, structure: shape }), `${what}: it says it was made from ${JSON.stringify(row.cross)}`);
  // The name.
  check(row.title === title && row.name === title.toLowerCase() && title.length <= 20, `${what}: it is called ${row.title}`);
  if (shape === structure) { check(!titles.has(title), `${what}: ground ${titles.get(title)} has the same name`); titles.set(title, id); }
  // The host's.
  check(row.kin === host && row.gemA === host, `${what}: its direction is ${row.kin} and its plain ore pays ${row.gemA}`);
  check(row.floor === own.floor && row.items === own.items && same(row.gloom, own.gloom) && row.dark === own.dark && same(row.mote, own.mote), `${what}: its floor, its ore's sheet, its dark or its motes are not its host's`);
  check(same(row.haz, own.haz) && hazOf(K.HAZARD, row) === (own.haz?.type ?? null) && row.lavaVol === own.lavaVol, `${what}: its own hazard is ${JSON.stringify(row.haz)}, not its host's ${JSON.stringify(own.haz)}`);
  check(row.lay.haz === own.lay.haz && row.lay.hazT === own.lay.hazT && row.lay.rind === own.lay.rind && row.lay.ribs === own.lay.ribs, `${what}: its own hazard is not laid as thick as its host's`);
  // The donor's.
  check(row.gemB === donor && row.itemsB === from.items && atlas[row.itemsB]?.frames.oreB, `${what}: its rich ore pays ${row.gemB} and is drawn from ${row.itemsB}`);
  check(same(row.haz2, TRAIT[donor]) && hazOf(K.HAZARD2, row) === (from.haz?.type ?? null), `${what}: its second hazard is ${JSON.stringify(row.haz2)}`);
  check(row.freeze === (frosty ? 30 : 0), `${what}: a cut in it closes after ${row.freeze} seconds`);
  const second = { 1: [0, 0, 0, 0], 2: [1, 0.80, 0.07, 0], 3: [2, 0.022 * 0.6, 0, 0], 4: [2, 0.026 * 0.6, 0, 0.2 * 0.6] }[donor];
  check(row.lay.haz2 === second[0] && Math.abs(row.lay.haz2T - second[1]) < 1e-12 && row.lay.rind2 === second[2] && Math.abs(row.lay.ribs2 - second[3]) < 1e-12,
    `${what}: its second hazard is laid by ${[row.lay.haz2, row.lay.haz2T, row.lay.rind2, row.lay.ribs2]}, not ${second}`);
  for (const [k, kin] of [[K.ORE_A, host], [K.ORE_B, donor], [K.HAZARD, own.haz ? HAZARDS[own.haz.type].kin : host], [K.HAZARD2, from.haz ? HAZARDS[from.haz.type].kin : host], [K.STEEL, B.EMBER], [K.SOFT, host]]) {
    check(gemKin(k, row) === kin, `${what}: kind ${k} pays gems of ${gemKin(k, row)}, not ${kin}`);
  }
  // The structure.
  const gen = { ...own.gen, ...[{}, { cavern: 0.62 }, {}, {}, { slate: 0 }][shape] }, extras = [[], [], ['lanes'], ['bubbles'], ['strata']][shape];
  check(same(row.gen, gen) && same(row.extras, extras), `${what}: its thresholds are ${JSON.stringify(row.gen)} and its extras ${row.extras}`);
  for (const extra of Object.keys(TELLS)) check(row.lay[extra] === (extras.includes(extra) ? TELLS[extra] : OFF[extra]), `${what}: ${extra} are laid by ${row.lay[extra]}`);
  // What it pays.
  check(row.rich === 1.25 && row.gemx === 1 && row.worth === 1 && row.dig === 1 && row.pocket === null, `${what}: rich ${row.rich}, gemx ${row.gemx}, worth ${row.worth}, dig ${row.dig}`);
  // The art.
  const name = `x-${own.name}-${from.name}`, sheet = atlas[name], frames = sheet ? Object.keys(sheet.frames) : [];
  check(row.sheet === name && frames.filter(f => f.startsWith(`${name}-255-`)).length >= 3 && new Set(frames.map(f => f.slice(name.length + 1).split('-')[0])).size === 47, `${what}: the art has no sheet of rock called ${row.sheet} with 47 shapes of block`);
  check(sheet && same(row.map, sheet.map) && row.debris[0] === sheet.debris[0] && row.debris[1] === sheet.debris[1], `${what}: its colour on the map or its chips are not the art's (${JSON.stringify(sheet?.map)}, ${sheet?.debris})`);
  check(row.debris.length === 3 && row.debris[0] === own.debris[0] && row.debris[2] === ACCENT[donor] && row.debris.every(c => /^#[0-9a-f]{6}$/.test(c)), `${what}: its chips are ${row.debris}`);
  // It shows on the map as a patch: not its host's colour, nor any strain's of its direction.
  for (const other of BIOMES) if (other && !other.cross && other.kin === host) check(hex(other.map) !== hex(row.map), `${what}: its colour on the map is ${other.name}'s`);
  check(CROSS_OK[host][donor] === true, `${what}: the pair is switched off`);
}
check(rows === 60 && BIOMES.filter(row => row?.cross).length === 60 && titles.size === 54, `${rows} rows of crosses, ${titles.size} names: not 60 rows and 54 names (six pairs have no lanes of ice)`);
for (let host = 0; host <= 4; host++) check(CROSS_OK[host].filter(Boolean).length === (host ? 3 : 0) && !CROSS_OK[host][host], `the verdicts for host ${host} are ${CROSS_OK[host]}`);
for (let id = 188; id < 192; id++) check(!BIOMES[id], `ground ${id} has a row`);
// Hand-made ground: no row says it is a cross, and its rich ore is drawn from its own ore's sheet.
for (const row of BIOMES) if (row && row.id < 128) check(row.cross === null && row.itemsB === row.items, `${row.name}: cross ${JSON.stringify(row.cross)}, rich ore from ${row.itemsB}`);

console.log(fails.length ? `DEFECT: ${fails.slice(0, 12).join('\n        ')}${fails.length > 12 ? `\n        and ${fails.length - 12} more` : ''}` : 'ok: sixty crosses, each its host\'s ground with its donor\'s rich ore and trait and one structure, named by hand, on sheets the art has');
process.exit(fails.length ? 1 : 0);
