// The eight hand-made strains (docs/CONTENT-PLAN.md, content item 1; js/world.js: grounds 17 to 24) are rows of the
// table of grounds with the figures settled for them, written out here as they stand. Each is its direction's own
// ground with a few figures changed: its floor, its dark, its motes, its ore's sheet and whose gems it pays are its
// direction's, so that colour and icon still say what a place pays; its rock is a sheet of its own that the art
// has; and its tell is an extra the world knows how to lay.
//   node test/regress/c1-strain-rows.mjs
import { readFile } from 'node:fs/promises';
import { world } from '../harness.mjs';
const { K, B, BIOMES, TELLS, HAZARDS, hazOf, gemKin, digTime, DIG_TIME } = world;

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const atlas = JSON.parse(await readFile(new URL('../../assets/atlas.json', import.meta.url), 'utf8'));

// What each strain has that its direction's own ground has not. `haz` is how its hazard is laid where that
// differs: the type is always the direction's.
const ROWS = {
  17: { name: 'firn', kin: B.FROST, rich: 0.95, freeze: 45, gen: { dense: 0.60, cave: 0.86, cavern: 0.84 }, extras: ['rivers'], map: [154, 180, 210] },
  18: { name: 'serac', kin: B.FROST, rich: 1.05, freeze: 15, extras: ['lanes'], map: [234, 248, 255] },
  19: { name: 'scoria', kin: B.EMBER, rich: 0.95, haz: { rate: 1, t: 0.80 }, extras: ['bubbles'], map: [150, 88, 74] },
  20: { name: 'forge', kin: B.EMBER, rich: 1.25, haz: { rate: 1, t: 0.735, rind: 0.12 }, lavaVol: 7, gen: { slate: 0.04 }, map: [102, 70, 68] },
  21: { name: 'tangle', kin: B.MIRE, rich: 1, gen: { cavern: 0.60 }, map: [62, 90, 64] },
  22: { name: 'sporefall', kin: B.MIRE, rich: 1.2, haz: { rate: 0.5 }, gen: { oreA: 0.63 }, extras: ['grapes'], map: [168, 136, 184] },
  23: { name: 'redrock', kin: B.LODE, rich: 1, gen: { slate: 0 }, extras: ['strata'], map: [168, 90, 58] },
  24: { name: 'loess', kin: B.LODE, rich: 0.85, dig: 0.5, haz: { rate: 0.5 }, gen: { dense: 0.76, oreA: 0.72, oreB: 0.80, slate: 0.02 }, map: [228, 220, 200] },
};
check(same(TELLS, { rivers: 0.02, lanes: 0.085, bubbles: 0.8, grapes: 0.85, strata: 0.05, ripples: 0.02, sheath: 0.03, lakes: 0.76, threads: 0.014, rims: 0.025 }), `the figures the tells are laid by are ${JSON.stringify(TELLS)}`);
// (And the tells of the seams and the deep strains, laid since: none of them in a strain or a cross.)
const OFF = { rivers: 0, lanes: 0, bubbles: 2, grapes: 2, strata: 0, ripples: 0, sheath: 0, lakes: 2, threads: 0, rims: 0 };
for (const [id, want] of Object.entries(ROWS)) {
  const row = BIOMES[id], own = BIOMES[want.kin], name = want.name;
  if (!row) { check(false, `ground ${id} (${name}) has no row`); continue; }
  check(row.id === +id && row.name === name && row.title === name.toUpperCase() && row.kin === want.kin, `ground ${id} is not ${name}, of direction ${want.kin}`);
  // What is its direction's.
  check(row.floor === own.floor && row.items === own.items && same(row.gloom, own.gloom) && row.dark === own.dark && same(row.mote, own.mote), `${name}: its floor, its ore's sheet, its dark or its motes are not its direction's`);
  check(row.gemA === want.kin && row.gemB === want.kin && row.gemx === 1 && row.worth === 1 && row.haz2 === null && row.pocket === null, `${name}: whose gems it pays, or how many`);
  check((row.haz?.type ?? null) === (own.haz?.type ?? null) && hazOf(K.HAZARD, row) === (own.haz?.type ?? null), `${name}: its hazard is ${row.haz?.type}, not its direction's`);
  for (const k of [K.ORE_A, K.ORE_B, K.HAZARD]) check(gemKin(k, row) === want.kin, `${name}: kind ${k} pays gems of ${gemKin(k, row)}`);
  // What is its own.
  check(row.rich === want.rich && row.dig === (want.dig ?? 1) && row.freeze === (want.freeze ?? own.freeze) && row.lavaVol === (want.lavaVol ?? 5), `${name}: rich ${row.rich}, dig ${row.dig}, freeze ${row.freeze}, lavaVol ${row.lavaVol}`);
  check(same(row.gen, { ...own.gen, ...want.gen }), `${name}: its thresholds are ${JSON.stringify(row.gen)}`);
  check(same(row.haz, want.haz ? { type: own.haz.type, ...want.haz } : own.haz), `${name}: its hazard is laid by ${JSON.stringify(row.haz)}`);
  check(same(row.extras, want.extras ?? []), `${name}: its extras are ${row.extras}`);
  for (const extra of Object.keys(TELLS)) check(row.lay[extra] === ((want.extras ?? []).includes(extra) ? TELLS[extra] : OFF[extra]), `${name}: ${extra} are laid by ${row.lay[extra]}`);
  check(same(row.map, want.map) && row.debris.length === 3 && row.debris.every(c => /^#[0-9a-f]{6}$/.test(c)), `${name}: its colour on the map or its chips`);
  check(digTime(K.SOFT, row) === DIG_TIME[K.SOFT] * (want.dig ?? 1), `${name}: soft rock takes ${digTime(K.SOFT, row)} s to cut`);
  // Its rock is a sheet of its own, with every shape of block in more than one drawing, and the map's colour is
  // one of the chips' (the sheet's own ground colour).
  const sheet = atlas[row.sheet], frames = sheet ? Object.keys(sheet.frames) : [];
  check(row.sheet === name && frames.filter(f => f.startsWith(`${name}-255-`)).length >= 3 && new Set(frames.map(f => f.split('-')[1])).size === 47, `${name}: the art has no sheet of rock called ${row.sheet} with 47 shapes of block`);
  check(atlas[row.floor] && ['dense', 'oreA', 'oreB'].every(f => atlas[row.items]?.frames[f]) && (!row.haz || atlas[HAZARDS[row.haz.type].sheet]?.frames.hazard), `${name}: a sheet it names is not in assets/atlas.json`);
  const hex = '#' + row.map.map(c => c.toString(16).padStart(2, '0')).join('');
  check(row.debris[0] === hex, `${name}: its colour on the map (${hex}) is not its first chip's (${row.debris[0]})`);
}
// No ground before the strains has an extra, and every ground with standard ground knows all five figures.
for (let b = 0; b <= 8; b++) check(BIOMES[b].extras.length === 0 && (BIOMES[b].lay === null || Object.keys(OFF).every(extra => BIOMES[b].lay[extra] === OFF[extra])), `ground ${b} has a strain's tell`);
// A strain pays a little less or a little more than its direction's own ground, never as a deep flank does.
for (const [id, want] of Object.entries(ROWS)) check(BIOMES[id].rich >= 0.85 && BIOMES[id].rich <= 1.25, `${want.name}: rich ${BIOMES[id].rich} is outside 0.85 to 1.25`);

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: the eight strains are rows of their directions\' grounds with the figures settled for them, and the art has their sheets');
process.exit(fails.length ? 1 : 0);
