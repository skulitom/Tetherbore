// The lab at eighty-nine. What the lab can know is eighty-nine things, in parts (home and all round, then each
// direction and the corner after it, going round with the sun; a part with nothing in it is not shown;
// js/shop.js: `LAB_PARTS`), each drawn from a frame the atlas has; every ground that has ore says what its two ores
// are (`ores`), and that is both what the cell is drawn as and what the lab knows it by, so a strain's, a seam's, a
// deep seam's, a deep flank's and a deep strain's ores are their own, the four directions' as they were, and a
// cross's common ore its host's and its rich ore a stone of the pair's own; a seam's two, its deep seam's two and its
// shrine's stone are in its corner's part and count toward the direction whose ground it is (the deep seam's taking
// the seam's samples as their own, `heir`), a cross's rich ore is in its host's part and counts toward its donor,
// whose rich ore's samples it takes as its own (and the lab, its list, its notes and its ANALYSED, says the level
// so taken, which is what a haul pays), and within a direction's part the crosses' come after the rare
// hazard and the deep strain's after the deep flank's, near to far.
// A hazard of any type and a keystone's iron are samples, an inert hazard and a prism are not. An ore that is its
// own pays exactly as the cell would with its direction's ore, and what is known of it makes it, and nothing else,
// worth more. A hazard cut into is analysed and still goes off; a rare hazard's lump takes what is known of it. A
// game saved with the sixteen first keys loads and counts them, the gem cutter asks for the kinds play set (8, 18,
// 28 and 36), and its late level for more than there are short of the far ground (the seams and all beyond them:
// the crosses' rich ores, the deep seams, flanks and strains, and the ancient stone), 43; LIVE CATCH for 30 and 42
// (41 before the list came to eighty-nine, which brought a game to 41 up to seven minutes sooner). And the art of the new ores keeps to
// its rules, read from the sheets as built: outlined in their direction's outline (a seam's rich ore in its other
// parent's, a deep seam's in its corner's own, a cross's in its donor's), each apart from its neighbours in shape or
// colour, none in the colour of what hurts in its ground (its direction's hazards, and a seam's or a cross's other
// hazard), none lost against its own rock, a common ore in pieces and a rich one in one; and a cross's rich ore
// clear of its host's common ore and its donor's rich ore by more than colour alone.
//   node test/regress/l-ores.mjs
import { readFile } from 'node:fs/promises';
import { makeGame, N, C, K, world } from '../harness.mjs';
import { decodePNG } from '../../tools/png.mjs';
import { ROCKS, STRAINS, CROSSES } from '../../art/tiles.mjs';
const { LAB, LAB_OF, LAB_PARTS, PART_INDEX, CORE, labLevel } = await import('../../js/shop.js');
const { sheets } = await import('../../js/atlas.js');
const { BIOMES, HAZARDS, RARE, B, SEAMS, DEEP_STRAINS, STONES, DONORS, rowOf, crossRow, crossId } = world;

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const atlas = JSON.parse(await readFile(new URL('../../assets/atlas.json', import.meta.url), 'utf8'));

// ---- 1. the eighty-nine
const SIXTEEN = ['lode-items:oreA', 'lode-items:oreB', 'frost-items:oreA', 'frost-items:oreB', 'ember-items:oreA', 'ember-items:oreB', 'ember-items:steel', 'mire-items:oreA', 'mire-items:oreB',
  'minerals:amber', 'minerals:aerolite', 'minerals:tektite', 'minerals:starglass', 'minerals:opal', 'minerals:lantern', 'minerals:agate'];
const GROUNDS = ['firn', 'serac', 'scoria', 'forge', 'tangle', 'sporefall', 'redrock', 'loess', 'rime', 'magma', 'bloom', 'gilt',
  'hoarstone', 'glassdune', 'cinderfen', 'frostfen', 'skarn', 'obsidian', 'tarpit', 'muskeg', 'glacier', 'caldera', 'mycelium', 'druse'];
// (The rows whose ores are their own: the strains, the seams, the deep seams, the deep flanks and the deep strains.)
const OWN = id => (id >= 5 && id <= 24) || (id >= 64 && id <= 67);
const NEW_ORES = GROUNDS.flatMap(g => [`ores:${g}A`, `ores:${g}B`]);
const KIN_PART = ['home', 'n', 's', 'w', 'e'], SEAM_PART = { hoarstone: 'ne', glassdune: 'se', cinderfen: 'sw', frostfen: 'nw' }, CORNER_PART = ['ne', 'se', 'sw', 'nw'];
// (Each pair of crosses, host and donor, and the key of its rich ore, from its first row's name; and the ancient
// stone's keys.)
const PAIRS = [1, 2, 3, 4].flatMap(host => DONORS[host].map(donor => ({ host, donor, key: `ores:${BIOMES[crossId(host, donor)].title.toLowerCase()}B` })));
const STONE_KEYS = STONES.map(name => `stones:${name}`);
check(LAB.length === 89, `the lab knows ${LAB.length} things, not eighty-nine`);
check(new Set(LAB.map(e => e.key)).size === LAB.length, 'two things of the lab share a key');
check(SIXTEEN.every(key => LAB_OF[key]), `the sixteen first keys are not all there: ${SIXTEEN.filter(key => !LAB_OF[key])}`);
check(NEW_ORES.every(key => LAB_OF[key]), `the strains' and flanks' ores are not all there: ${NEW_ORES.filter(key => !LAB_OF[key])}`);
const parts = [0, 1, 2, 3, 4].map(kin => LAB.filter(e => e.kin === kin).length);
check(parts.join() === '5,20,23,22,19', `the directions count ${parts} things, not 5, 20, 23, 22 and 19`);
const shown = LAB_PARTS.map(p => LAB.filter(e => e.part === p.id).length);
check(shown.join() === '5,15,5,14,5,18,5,17,5', `the parts of the list hold ${shown}, not 5, 15, 5, 14, 5, 18, 5, 17 and 5`);
// Near to far within a direction's part: the rare hazard (450 cells), the deep flank (800), the deep strain (1,100);
// and the seam's two (470) in its corner's part, counting toward the direction whose ground it is.
for (const kin of [1, 2, 3, 4]) {
  const seam = BIOMES[SEAMS.find(([id]) => BIOMES[id].kin === kin)[0]], strain = BIOMES[DEEP_STRAINS[kin][0]];
  const at = key => LAB.findIndex(e => e.key === key), order = [`${HAZARDS[RARE[kin]].sheet}:hazard`, `ores:${BIOMES[kin + 4].name}A`, `ores:${BIOMES[kin + 4].name}B`, `ores:${strain.name}A`, `ores:${strain.name}B`];
  check(order.every((key, i) => at(key) >= 0 && LAB[at(key)].kin === kin && LAB[at(key)].part === KIN_PART[kin] && (i === 0 || at(key) > at(order[i - 1]))), `the far things of direction ${kin} are not in its part from near to far: ${order.map(key => `${key} ${at(key)}`)}`);
  const corner = SEAM_PART[seam.name], deep = BIOMES[seam.id + 4], d = CORNER_PART.indexOf(corner);
  // (In its corner: the seam's two, then the deep seam's two, then the shrine's stone, all counting toward the
  // direction whose ground the seam is.)
  const inCorner = [`ores:${seam.name}A`, `ores:${seam.name}B`, `ores:${deep.name}A`, `ores:${deep.name}B`, STONE_KEYS[d]];
  check(inCorner.every((key, i) => LAB_OF[key]?.kin === kin && LAB_OF[key].part === corner && (i === 0 || at(key) > at(inCorner[i - 1]))), `the ${seam.name}'s, the ${deep.name}'s and the shrine's things are not in the ${corner} part in order, counting toward direction ${kin}: ${inCorner.map(key => `${key} ${at(key)} ${LAB_OF[key]?.kin}`)}`);
  // (A deep seam's ores were its seam's to the lab: they take the seam's samples as their own.)
  check(LAB_OF[inCorner[2]]?.heir === inCorner[0] && LAB_OF[inCorner[3]]?.heir === inCorner[1], `the ${deep.name}'s ores do not take the ${seam.name}'s samples`);
  // (In its part, after the rare hazard and before the deep flank: the crosses of this direction's ground, each
  // counting toward its donor and taking the donor's rich ore's samples.)
  for (const { host, donor, key } of PAIRS.filter(p => p.host === kin)) {
    const e = LAB_OF[key];
    check(e && e.part === KIN_PART[host] && e.kin === donor && e.heir === `${BIOMES[donor].items}:oreB` && LAB_OF[e.heir] && at(key) > at(order[0]) && at(key) < at(order[1]),
      `the rich ore of the cross of ${host} and ${donor}, ${key}, is ${e ? `in ${e.part} toward ${e.kin} after ${e.heir}, at ${at(key)}` : 'not in the lab'}`);
  }
}
check(LAB_OF['stones:builders']?.part === 'home' && LAB_OF['stones:builders'].kin === 0 && LAB_OF['stones:builders'].at === 'BUILDERS HALLS', 'the builders\' stone is not home\'s, at the builders\' halls');
check(STONE_KEYS.every(key => LAB_OF[key]) && PAIRS.every(p => LAB_OF[p.key]) && LAB.filter(e => e.heir).length === 20, 'the stones and the crosses\' rich ores are not all the lab\'s, or something else has an heir');
// (The first forty-eight, each in the part of its direction, as many to each as there were.)
const FIRST = [
  'lode-items:oreA', 'lode-items:oreB', 'finds:key', 'minerals:aerolite', 'frost-items:oreA', 'frost-items:oreB',
  'ores:firnA', 'ores:firnB', 'ores:seracA', 'ores:seracB', 'minerals:starglass', 'bell-items:hazard', 'ores:rimeA',
  'ores:rimeB', 'lode-items:hazard', 'ores:redrockA', 'ores:redrockB', 'ores:loessA', 'ores:loessB',
  'minerals:agate', 'lodestone-items:hazard', 'ores:giltA', 'ores:giltB', 'ember-items:oreA', 'ember-items:oreB',
  'ember-items:steel', 'ember-items:hazard', 'minerals:tektite', 'ores:scoriaA', 'ores:scoriaB', 'ores:forgeA',
  'ores:forgeB', 'minerals:opal', 'vent-items:hazard', 'ores:magmaA', 'ores:magmaB', 'mire-items:oreA',
  'mire-items:oreB', 'mire-items:hazard', 'minerals:amber', 'ores:tangleA', 'ores:tangleB', 'ores:sporefallA',
  'ores:sporefallB', 'minerals:lantern', 'worm-items:hazard', 'ores:bloomA', 'ores:bloomB'
];
const first = [0, 1, 2, 3, 4].map(kin => FIRST.filter(key => LAB_OF[key]?.kin === kin && LAB_OF[key].part === KIN_PART[kin]).length);
check(first.join() === '4,10,13,12,9', `the first forty-eight lie in their parts as ${first}, not 4, 10, 13, 12 and 9`);
check(LAB.every((e, i) => i === 0 || PART_INDEX[e.part] >= PART_INDEX[LAB[i - 1].part]), 'the parts of the list are not each in one run, in order');
check(LAB_PARTS.map(p => p.id).join() === 'home,n,ne,e,se,s,sw,w,nw', `the parts go ${LAB_PARTS.map(p => p.id)}, not round with the sun`);
check(LAB_PARTS.every(p => p.title && p.colour && atlas.icons.frames[p.icon]), 'a part of the list has no title, colour or icon');
for (const e of LAB) {
  const [sheet, frame] = e.key.split(':');
  check(atlas[sheet]?.frames[frame], `${e.name}: the atlas has no ${e.key}`);
  check(e.name && e.at && e.where && e.note && [0, 1, 2, 3, 4].includes(e.kin) && e.part in PART_INDEX, `${e.key}: no name, place, where, direction or part`);
}
check(atlas.ores && Object.keys(atlas.ores.frames).length === 60, `the ores sheet has ${Object.keys(atlas.ores?.frames ?? {}).length} frames, not 60`);
check(atlas.stones && Object.keys(atlas.stones.frames).join() === STONES.join(), `the stones sheet has ${Object.keys(atlas.stones?.frames ?? {})}, not ${STONES}`);

// ---- 2. what a cell is drawn as is what the lab knows it by
const game = await makeGame(7), w = game.world;
const owners = new Set();
for (const row of BIOMES) {
  if (!row || !row.gen) continue;
  for (const [k, n] of [[K.ORE_A, 0], [K.ORE_B, 1]]) {
    const key = game.sampleOf(k, row), drawn = game.overlay(k, row, 0);
    check(LAB_OF[key], `${row.name}: its ore ${n ? 'B' : 'A'} is ${key}, which the lab does not know`);
    check(drawn && `${drawn[0]}:${drawn[1]}` === key, `${row.name}: its ore ${n ? 'B' : 'A'} is drawn as ${drawn} and known as ${key}`);
    owners.add(key);
  }
  const want = row.id <= 4 ? [`${row.items}:oreA`, `${row.items}:oreB`]
    : OWN(row.id) ? [`ores:${row.name}A`, `ores:${row.name}B`]
    : row.cross ? [`${BIOMES[row.cross.host].items}:oreA`, PAIRS.find(p => p.host === row.cross.host && p.donor === row.cross.donor).key] : null;
  if (want) check(row.oreKeys.join() === want.join(), `${row.name} (${row.id}): its ores are ${row.oreKeys}, not ${want}`);
  // (Where a row's ores are its direction's sheet, they are what `items` and `itemsB` say, so the two cannot drift;
  // a cross's rich ore is its own, but its donor is still what `itemsB` says.)
  if (row.cross) check(row.oreKeys[0] === `${row.items}:oreA` && row.itemsB === BIOMES[row.cross.donor].items, `${row.name}: its common ore ${row.oreKeys[0]} is not its host's ${row.items}, or its donor's sheet is ${row.itemsB}`);
  else if (!OWN(row.id)) check(row.oreKeys.join() === `${row.items}:oreA,${row.itemsB}:oreB`, `${row.name}: its ores ${row.oreKeys} are not its items' ${row.items}, ${row.itemsB}`);
}
check(NEW_ORES.every(key => owners.has(key)), `an ore of the sheet is no ground's: ${NEW_ORES.filter(key => !owners.has(key))}`);
for (const [type, h] of Object.entries(HAZARDS)) {
  const row = h.rare ? BIOMES[h.kin] : Object.values(BIOMES).find(r => r?.haz?.type === type);
  const k = h.rare ? K.RARE : K.HAZARD;
  check(row && game.sampleOf(k, row) === `${h.sheet}:hazard` && LAB_OF[`${h.sheet}:hazard`], `a ${type} is not the lab's ${h.sheet}:hazard`);
}
check(game.sampleOf(K.HAZARD, BIOMES[1]) === null, 'a hazard cell in a ground with no hazard of its own is a sample');
check(game.sampleOf(K.HAZARD2, BIOMES[2]) === null, 'a second hazard cell in a ground with none is a sample');
check(game.sampleOf(K.PRISM, BIOMES[1]) === null, 'a prism is a sample');
check(game.sampleOf(K.KEY, BIOMES[0]) === 'finds:key' && game.sampleOf(K.KEY, BIOMES[17]) === 'finds:key', 'a keystone is not the lab\'s keystone iron');
check(game.sampleOf(K.ORE_A, BIOMES[17]) === game.sampleOf(K.ORE_A, BIOMES[17]) && typeof game.sampleOf(K.ORE_A, BIOMES[17]) === 'string', 'a strain\'s ore has no key');

// ---- 3. it pays as the cell paid before, and only it is worth more for what is known of it
// A block of each kind staged in each strain, seam, flank and deep strain, paid with the lab empty, against the
// same block with the row's ores set back to its direction's sheet (as a strain's and a flank's were drawn and
// known before): what pays is the ground and not the name.
const staged = (id, k, dx = 0) => {
  const row = BIOMES[id], cells = [], x0 = C + 600 + dx, y0 = C;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) cells.push((y0 + y) * N + x0 + x);
  return { row, extra: cells.map(i => ({ k, b: id, x: i % N, y: Math.floor(i / N) })) };
};
// (And each pair of crosses' first row: its rich ore set back to its donor's, as it was drawn and known before.)
for (const id of [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 64, 65, 66, 67, ...PAIRS.map(p => crossId(p.host, p.donor))]) for (const k of [K.ORE_A, K.ORE_B]) {
  const { row, extra } = staged(id, k), now = game.payOf([], extra);
  const ores = row.ores, keys = row.oreKeys;
  row.ores = [[row.items, 'oreA'], [row.itemsB, 'oreB']]; row.oreKeys = row.ores.map(o => o.join(':'));
  const before = game.payOf([], extra);
  row.ores = ores; row.oreKeys = keys;
  check(now.grit === before.grit && now.gems.join() === before.gems.join(), `${row.name}: a block of its ore ${k === K.ORE_A ? 'A' : 'B'} pays ${now.grit} grit and ${now.gems} gems, not ${before.grit} and ${before.gems} as before`);
}
{
  const firnA = staged(17, K.ORE_A).extra, firnB = staged(17, K.ORE_B, 20).extra, salt = staged(1, K.ORE_A, 40).extra;
  const base = [firnA, firnB, salt].map(e => game.payOf([], e).grit);
  game.S.lab['ores:firnA'] = 4;
  const now = [firnA, firnB, salt].map(e => game.payOf([], e).grit);
  check(Math.abs(now[0] - base[0] * (1 + labLevel(4) / 100)) <= 1, `with four samples of sapphire a block of it pays ${now[0]}, not ${base[0]} and three hundredths more`);
  check(now[1] === base[1] && now[2] === base[2], 'samples of sapphire changed what enhydro or rime salt pays');
  game.S.lab = {};
}
// A cross's rich ore takes what is known of its donor's (`heir`): a game that had analysed sunstone before thaw's
// candle quartz was a thing of its own is paid for it as it was, and what is known of the better of the two counts.
// And a deep seam's ore what is known of its seam's: hoar quartz known, scheelite pays as it did.
{
  const thaw = crossId(B.FROST, B.EMBER), { extra } = staged(thaw, K.ORE_B, 60), sun = staged(B.EMBER, K.ORE_B, 80).extra;
  const pay = () => game.payOf([], extra).grit, none = pay(), sunNone = game.payOf([], sun).grit;
  game.S.lab['ember-items:oreB'] = 8;
  const heir = pay();
  game.S.lab['ores:thawB'] = 2;
  const both = pay();
  game.S.lab = { 'ores:thawB': 8 };
  const own = pay(), sunOwn = game.payOf([], sun).grit;
  game.S.lab = {};
  check(Math.abs(heir - none * (1 + labLevel(8) / 100)) <= 1 && heir === both && heir === own, `a block of candle quartz pays ${none} grit known not at all, ${heir} with sunstone known 8 times, ${both} with candle quartz 2 more, ${own} with candle quartz alone 8 times`);
  check(sunOwn === sunNone, 'what is known of candle quartz changed what sunstone pays');
  const skarn = staged(13, K.ORE_A, 100).extra, cold = game.payOf([], skarn).grit;
  game.S.lab = { 'ores:hoarstoneA': 8 };
  const warm = game.payOf([], skarn).grit;
  game.S.lab = {};
  check(Math.abs(warm - cold * (1 + labLevel(8) / 100)) <= 1, `a block of scheelite pays ${cold} grit known not at all and ${warm} with hoar quartz known 8 times`);
}
// And the lab says what it pays (`learnt`): candle quartz first crushed with sunstone known 32 times is ANALYSED at
// sunstone's +6% and counts on from there, the list and the notes say +6% and its count, and when sunstone is known
// better after, the list says what candle quartz is paid then; scheelite crushed with hoar quartz known 8 times is
// ANALYSED +4%. (What is drawn is read back from the glyphs the font draws, a line of text by its row.)
{
  const font = sheets.font.glyphs, glyphAt = new Map(Object.entries(font).map(([ch, [gx, gw, gy = 0]]) => [`${gx},${gy},${gw}`, ch]));
  const drawn = [], ctx = new Proxy({ drawImage(image, sx, sy, sw, sh, dx, dy) { const ch = sh === 10 && glyphAt.get(`${sx},${sy},${sw}`); if (ch) drawn.push([dx, dy, sw, ch]); } }, { get: (t, k) => t[k] ?? (() => ({ data: new Uint8ClampedArray(4), width: 0 })), set: () => true });
  const lines = () => {
    const rows = new Map();
    for (const [x, y, wd, ch] of drawn) { const row = rows.get(y) ?? []; row.push([x, wd, ch]); rows.set(y, row); }
    const gap = (row, n) => n ? row[n][0] - row[n - 1][0] - row[n - 1][1] : 0;
    return [...rows.values()].map(row => row.sort((a, b) => a[0] - b[0]).reduce((out, [, , ch], n) => out + (gap(row, n) > 8 ? ' | ' : gap(row, n) > 2 ? ' ' : '') + ch, ''));
  };
  const was = game.ctx, CANDLE = 'ores:thawB', SUN = 'ember-items:oreB', name = LAB_OF[CANDLE].name;
  const shown = () => { game.ctx = ctx; game.resize(320, 568, 1); game.labSel = CANDLE; game.openLab(true, 'lab'); drawn.length = 0; game.render(); game.openLab(false); game.ctx = was; return lines(); };
  game.S.lab = { [SUN]: 32 }; game.recount(); game.popups.length = 0; game.crushedAt = -9;
  const known = game.known;
  game.analyse(CANDLE, C + 10, C + 10);
  check(game.S.lab[CANDLE] === 33 && game.learnt(CANDLE) === 33 && game.known === known + 1 && game.popups.some(p => p.label === 'ANALYSED +6%'),
    `candle quartz first crushed with sunstone known 32 times counts ${game.S.lab[CANDLE]}, ${game.known - known} more known, and says ${game.popups.map(p => p.label)}`);
  const sees = shown();
  check(sees.some(l => l.startsWith(`${name} | +6%`)) && sees.some(l => l.startsWith('33 SAMPLES')), `with candle quartz at 33 and sunstone 32, the lab says ${JSON.stringify(sees.filter(l => l.includes('%')).slice(0, 12))}`);
  game.S.lab[SUN] = 64;
  const later = shown(), pays = game.studiedOf(CANDLE);
  check(later.some(l => l.startsWith(`${name} | +7%`)) && Math.round(pays * 100) === 7, `with sunstone known 64 times candle quartz is paid +${Math.round(pays * 100)}% and the lab says ${JSON.stringify(later.filter(l => l.startsWith(name)))}`);
  game.S.lab = { 'ores:hoarstoneA': 8 }; game.recount(); game.popups.length = 0;
  game.analyse('ores:skarnA', C + 10, C + 10);
  check(game.popups.some(p => p.label === 'ANALYSED +4%') && Math.round(game.studiedOf('ores:skarnA') * 100) === 4, `scheelite first crushed with hoar quartz known 8 times says ${game.popups.map(p => p.label)}`);
  game.S.lab = {}; game.recount(); game.popups.length = 0;
}

// ---- 4. crushed: what the lab counts
const near = (x, y) => (C + y) * N + C + x;
{
  // Firn's ore A, cut, counts as sapphire alone.
  const i = near(-10, -300); w.see(C - 10, C - 300, 3);
  check(w.b(i) === 17, `world 7 has not firn at -10,-300 any more (${w.b(i)})`);
  w.setK(i, K.ORE_A); game.finishDig(i);
  check(game.S.lab['ores:firnA'] === 1 && Object.keys(game.S.lab).length === 1, `firn's ore crushed, the lab holds ${JSON.stringify(game.S.lab)}`);
  check(game.popups.some(p => p.label === 'ANALYSED +1%'), 'the first sapphire crushed was not said to be analysed');
}
{
  // Lava cut into: a sample of lava, said, and it wakes and pours as ever.
  game.S.lab = {}; game.popups.length = 0; game.crushedAt = -9;
  const x = 40, y = 150, i = near(x, y); w.see(C + x, C + y, 4);
  check(w.row(i).haz?.type === 'lava', `world 7 has not ground with lava at ${x},${y} (${w.row(i).name})`);
  for (const s of [0, 1, -1, N, -N]) w.setK(i + s, K.HAZARD);
  w.setK(i, K.HAZARD); game.finishDig(i);
  check(game.S.lab['ember-items:hazard'] === 1, `lava cut into, the lab holds ${JSON.stringify(game.S.lab)}`);
  check(game.popups.some(p => p.label === 'CRUSHED') && game.popups.some(p => p.label === 'ANALYSED +1%'), `lava cut into said ${game.popups.map(p => p.label)}`);
  check(w.lava.size > 0, 'lava cut into did not wake');
}
{
  // A key cut: keystone iron.
  game.S.lab = {};
  const i = near(-30, 40); w.see(C - 30, C + 40, 2);
  w.setK(i, K.KEY); game.finishDig(i);
  check(game.S.lab['finds:key'] === 1, `a key cut, the lab holds ${JSON.stringify(game.S.lab)}`);
}
{
  // A hazard hauled asleep pays its study; a rare hazard's lump takes it.
  game.S.lab = {};
  const pod = [{ k: K.HAZARD, b: B.MIRE, x: C - 200, y: C }], bell = [{ k: K.RARE, b: B.FROST, x: C, y: C - 600 }];
  const before = [game.payOf([], pod), game.payOf([], bell)];
  game.S.lab['mire-items:hazard'] = 64; game.S.lab['bell-items:hazard'] = 64;
  const after = [game.payOf([], pod), game.payOf([], bell)];
  check(after[0].gems[B.MIRE] > before[0].gems[B.MIRE] || after[0].grit > before[0].grit, `a spore pod hauled pays ${after[0].grit} grit, ${after[0].gems[B.MIRE]} gems with 64 samples, as with none`);
  check(after[1].lump > before[1].lump, `a rime bell's lump is ${after[1].lump} with 64 samples, as with none (${before[1].lump})`);
  game.S.lab = {};
}

// ---- 5. an old save, and the gem cutter
{
  const old = await makeGame(7);
  for (const key of SIXTEEN.slice(0, 9)) old.S.lab[key] = 3;
  old.save();
  const back = await makeGame(7); await back.restore();
  const asked = back.need(CORE.find(u => u.id === 'cutter'));
  check(asked?.what === 'kinds' && asked.have === 9 && asked.need === 8, `a game saved with nine of the first sixteen is asked by the gem cutter for ${JSON.stringify(asked)}`);
  check(SIXTEEN.slice(0, 9).every(key => back.S.lab[key] === 3), 'a saved game lost its samples');
}
const cutter = CORE.find(u => u.id === 'cutter');
check(cutter.needs[0] === 'kinds' && cutter.needs[1].slice(0, 4).join() === '8,18,28,36', `the gem cutter asks for ${cutter.needs[1].slice(0, 4)} kinds, not 8, 18, 28 and 36`);
check(cutter.needs[1].slice(0, 4).every(n => n <= LAB.length), 'the gem cutter asks for more kinds than there are');
// Its late level asks for more kinds than there are short of the far ground, so that some of it must be analysed
// (and no more than there are); and LIVE CATCH's first two levels for no more than there are. The far ground is
// the seams (from 470 cells out) and all that lies beyond them: the crosses' rich ores (from 500), the deep seams',
// flanks' and strains' ores, and the ancient stone of the shrines and the halls, forty-nine; the forty short of it
// are the home ground's, the directions' own and their strains', the pockets' minerals, steel, keystone iron and
// the hazards, the rare ones at 450 among them.
{
  const FAR = new Set([...[5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 64, 65, 66, 67].flatMap(id => BIOMES[id].oreKeys), ...PAIRS.map(p => p.key), ...STONE_KEYS]);
  const far = LAB.filter(e => FAR.has(e.key)).length, late = cutter.needs[1][4];
  check(far === 49 && LAB.length - far === 40 && late[0] === 'kinds' && late[1] > LAB.length - far && late[1] <= LAB.length, `the gem cutter's late level asks for ${late}, where ${LAB.length - far} kinds lie short of the ${far} far things`);
  // As play set them for the list of eighty-nine (js/shop.js, CORE): the cutter's late level at 43, and LIVE CATCH
  // at 30 and 42, where it asked 41 of the sixty-four.
  check(late[1] === 43, `the gem cutter's late level asks for ${late[1]} kinds, not 43`);
  const live = CORE.find(u => u.id === 'livecatch');
  check(live.needs[0] === 'kinds' && live.needs[1].slice(0, 2).join() === '30,42' && live.needs[1].slice(0, 2).every(n => n <= LAB.length), `LIVE CATCH asks for ${live.needs[1].slice(0, 2)} kinds, not 30 and 42 of ${LAB.length}`);
}

// ---- 6. the art of the new ores
const pictures = {};
const picture = async name => pictures[name] ??= decodePNG(await readFile(new URL(`../../assets/${name}.png`, import.meta.url)));
const pixels = async (sheet, frame) => {
  const p = await picture(sheet), [fx, fy, fw, fh] = sheets[sheet].frames[frame], grid = [];
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) { const o = ((fy + y) * p.width + fx + x) * 4; grid.push(p.data[o + 3] > 0 ? [p.data[o], p.data[o + 1], p.data[o + 2]] : null); }
  return { w: fw, h: fh, grid };
};
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const far = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const vivid = c => Math.max(...c) - Math.min(...c) >= 64;
// What an ore looks like at a glance: its most frequent colour that is a colour at all (as s6-decor counts colour),
// where such colours are a quarter of it or more (its outline aside); or else the colour most of it is, as a white
// or a grey ore is seen by its body and not by a fleck of colour or a glint in it. And what it covers, and its
// pieces, 4-connected.
const look = async (sheet, frame, outline) => {
  const { w: fw, h: fh, grid } = await pixels(sheet, frame), counts = new Map(), fill = grid.filter(c => c && !(outline && far(c, outline) < 1));
  for (const c of fill) if (vivid(c)) counts.set(c.join(), (counts.get(c.join()) ?? 0) + 1);
  const most = [...counts].sort((a, b) => b[1] - a[1])[0], share = [...counts.values()].reduce((a, b) => a + b, 0) / Math.max(1, fill.length);
  const body = new Map();
  for (const c of fill) body.set(c.join(), (body.get(c.join()) ?? 0) + 1);
  const colour = (most && share >= 0.25 ? most : [...body].sort((a, b) => b[1] - a[1])[0])[0].split(',').map(Number);
  const seen = new Uint8Array(grid.length), pieces = [];
  for (let i = 0; i < grid.length; i++) if (grid[i] && !seen[i]) {
    let n = 0; const stack = [i]; seen[i] = 1;
    while (stack.length) { const j = stack.pop(); n++; const x = j % fw, y = Math.floor(j / fw); for (const [u, v] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + u, Y = y + v, q = Y * fw + X; if (X >= 0 && Y >= 0 && X < fw && Y < fh && grid[q] && !seen[q]) { seen[q] = 1; stack.push(q); } } }
    pieces.push(n);
  }
  const edge = grid.map((c, i) => { if (!c) return null; const x = i % fw, y = Math.floor(i / fw); return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([u, v]) => { const X = x + u, Y = y + v; return X < 0 || Y < 0 || X >= fw || Y >= fh || !grid[Y * fw + X]; }) ? c : null; }).filter(Boolean);
  return { sheet, frame, colour, vivid: !!most, mask: grid.map(c => !!c), pieces: pieces.sort((a, b) => b - a), edge, all: grid.filter(Boolean) };
};
const differ = (a, b) => a.mask.reduce((n, on, i) => n + (on !== b.mask[i] ? 1 : 0), 0);
const OUTLINE = { 1: '#22395a', 2: '#160c12', 3: '#1c1426', 4: '#3a2414' }, CORNER_LINE = ['#14204a', '#3a0c1c', '#24222e', '#0c3018'];
const KIN_SHEET = { 1: 'frost-items', 2: 'ember-items', 3: 'mire-items', 4: 'lode-items' };
// (Each direction's grounds with ores of their own: its own, its strains, its deep flank, its seam, its deep seam
// and its deep strain.)
const KIN_ROWS = { 1: [1, 17, 18, 5, 9, 13, 64], 2: [2, 19, 20, 6, 11, 15, 65], 3: [3, 21, 22, 7, 12, 16, 66], 4: [4, 23, 24, 8, 10, 14, 67] };
const rockOf = name => [...ROCKS, ...STRAINS].find(r => r.name === name)?.palette;
for (const kin of [1, 2, 3, 4]) {
  const rows = KIN_ROWS[kin].map(id => BIOMES[id]), mine = [];
  // (A seam's rich ore pays its other parent's gems and is drawn in that direction's outline, as a cross's rich ore
  // is drawn in its donor's; a deep seam's in its corner's own, the stone that pays its corner's gems; every other
  // ore here is in this direction's.)
  const lineOf = (row, frame) => frame.endsWith('B') && row.seam != null ? row.deep ? CORNER_LINE[row.seam] : OUTLINE[row.gemB] : OUTLINE[kin];
  for (const row of rows) for (const [sheet, frame] of row.ores) mine.push({ row, fresh: sheet === 'ores', line: lineOf(row, frame), ...(await look(sheet, frame, rgb(lineOf(row, frame)))) });
  // What hurts in this direction: every colour of its own hazard as drawn that is a colour at all (its frames, and
  // lava's steel and pools), every colour of lava's slag, dull as it is (a grey lump is what tells of lava, and an
  // ore must not be one), its outline aside, and the colour its rare hazard is seen as. And in a ground that has a
  // hazard its direction has not (a seam's: the hoarstone's crystals, the glassdune's lava, the cinderfen's pods),
  // that hazard's colours too, for that ground's ores.
  const take = async (into, sheet, frame, all = false) => { if (sheets[sheet]?.frames[frame]) for (const c of (await pixels(sheet, frame)).grid) if (c && (vivid(c) || all && far(c, rgb(OUTLINE[kin])) >= 1)) into.push(c); };
  const hazard = async (into, type) => {
    const s = HAZARDS[type].sheet;
    await take(into, s, 'hazard'); await take(into, s, 'hazard-b');
    if (type === 'lava') { await take(into, s, 'slag', true); for (const f of ['steel', 'steel-glint']) await take(into, s, f); await take(into, 'lava', 'lava-255-a'); await take(into, 'lava', 'lava-255-b'); }
  };
  const own = BIOMES[kin].haz?.type, rare = HAZARDS[RARE[kin]].sheet, base = [];
  if (own) await hazard(base, own);
  base.push((await look(rare, 'hazard')).colour);
  const hurtsOf = new Map();
  for (const row of rows) {
    const hurts = [...base];
    for (const type of new Set([row.haz?.type, row.haz2?.type])) if (type && type !== own) await hazard(hurts, type);
    hurtsOf.set(row, hurts);
  }
  for (const o of mine.filter(m => m.fresh)) {
    const hurts = hurtsOf.get(o.row);
    const name = `${o.frame} (${o.row.name})`;
    // (a) outlined: most of its edge is its direction's outline (a seam's rich ore, its other parent's).
    const k = rgb(o.line), outlined = o.edge.filter(c => far(c, k) < 1).length / o.edge.length;
    check(outlined >= 0.6, `${name}: ${(outlined * 100).toFixed(0)} in 100 of its edge is its direction's outline ${o.line}`);
    // (e) a common ore lies in pieces, a rich one in one.
    if (o.frame.endsWith('A')) check(o.pieces.length >= 2, `${name}: a common ore in ${o.pieces.length} piece`);
    else check(o.pieces[0] / o.all.length >= 0.7, `${name}: a rich ore whose largest piece is ${o.pieces[0]} of ${o.all.length} pixels`);
    // (c) not in the colour of what hurts.
    const worst = hurts.reduce((m, c) => Math.min(m, far(o.colour, c)), Infinity);
    check(worst >= 60, `${name}: its colour ${o.colour} is within ${worst.toFixed(0)} of a colour of what hurts in its direction`);
    // (d) not lost against its own rock.
    const rock = rockOf(o.row.sheet), against = rock ? Math.min(...['f', 'a', 'b', 'D'].map(c => far(o.colour, rgb(rock[c])))) : 0;
    check(rock && against >= 60, `${name}: its colour ${o.colour} is within ${against.toFixed(0)} of its rock`);
  }
  // (b) apart from its neighbours: in shape, and in colour or in shape by much more.
  for (let a = 0; a < mine.length; a++) for (let b = a + 1; b < mine.length; b++) {
    const x = mine[a], y = mine[b];
    if (!x.fresh && !y.fresh) continue;
    const shape = differ(x, y), colour = far(x.colour, y.colour);
    check(shape >= 16 && (colour >= 40 || shape >= 40), `${x.frame} (${x.row.name}) and ${y.frame} (${y.row.name}) are too alike: ${shape} pixels of shape and ${colour.toFixed(0)} of colour apart`);
  }
}

// ---- 7. the art of the crosses' rich ores: each outlined in its donor's outline and a rich ore in one piece; clear
// of what hurts in the pair's ground (both directions' hazards and rare hazards) and of the pair's rock; apart from
// every ore of its host's and its donor's grounds and of each cross that shares a direction with it; and further
// in colour than the rest from its host's common ore and its donor's own rich ore, beside which it lies or which
// it stands for, so that it is not taken for either.
{
  const none = [];
  const take = async (into, sheet, frame, all = false) => { if (sheets[sheet]?.frames[frame]) for (const c of (await pixels(sheet, frame)).grid) if (c && (vivid(c) || all && far(c, rgb(OUTLINE[2])) >= 1)) into.push(c); };
  const hazardOf = async type => {
    const into = [], s = HAZARDS[type].sheet;
    await take(into, s, 'hazard'); await take(into, s, 'hazard-b');
    if (type === 'lava') { await take(into, s, 'slag', true); for (const f of ['steel', 'steel-glint']) await take(into, s, f); await take(into, 'lava', 'lava-255-a'); await take(into, 'lava', 'lava-255-b'); }
    return into;
  };
  const hurtsOf = async kin => [...(BIOMES[kin].haz ? await hazardOf(BIOMES[kin].haz.type) : none), (await look(HAZARDS[RARE[kin]].sheet, 'hazard')).colour];
  const looks = new Map();
  for (const { host, donor, key } of PAIRS) looks.set(key, await look('ores', key.slice(5), rgb(OUTLINE[donor])));
  const kinOres = async kin => {
    const out = [];
    for (const id of KIN_ROWS[kin]) for (const [sheet, frame] of BIOMES[id].ores) { const row = BIOMES[id], line = frame.endsWith('B') && row.seam != null ? row.deep ? CORNER_LINE[row.seam] : OUTLINE[row.gemB] : OUTLINE[kin]; out.push(await look(sheet, frame, rgb(line))); }
    return out;
  };
  for (const { host, donor, key } of PAIRS) {
    const o = looks.get(key), name = `${o.frame} (the cross of ${host} and ${donor})`, line = rgb(OUTLINE[donor]);
    const outlined = o.edge.filter(c => far(c, line) < 1).length / o.edge.length;
    check(outlined >= 0.6, `${name}: ${(outlined * 100).toFixed(0)} in 100 of its edge is its donor's outline ${OUTLINE[donor]}`);
    check(o.pieces[0] / o.all.length >= 0.7, `${name}: a rich ore whose largest piece is ${o.pieces[0]} of ${o.all.length} pixels`);
    const hurts = [...await hurtsOf(host), ...await hurtsOf(donor)], worst = hurts.reduce((m, c) => Math.min(m, far(o.colour, c)), Infinity);
    check(worst >= 60, `${name}: its colour ${o.colour} is within ${worst.toFixed(0)} of a colour of what hurts in its ground`);
    const sheet = `x-${BIOMES[host].name}-${BIOMES[donor].name}`, rock = CROSSES.find(r => r.name === sheet)?.palette;
    const against = rock ? Math.min(...['f', 'a', 'b', 'D'].map(c => far(o.colour, rgb(rock[c])))) : 0;
    check(rock && against >= 60, `${name}: its colour ${o.colour} is within ${against.toFixed(0)} of its rock ${sheet}`);
    const others = [...await kinOres(host), ...await kinOres(donor), ...PAIRS.filter(p => p.key !== key && [p.host, p.donor].some(k => k === host || k === donor)).map(p => looks.get(p.key))];
    for (const n of others) {
      const shape = differ(o, n), colour = far(o.colour, n.colour);
      check(shape >= 16 && (colour >= 40 || shape >= 40), `${name} and ${n.frame} are too alike: ${shape} pixels of shape and ${colour.toFixed(0)} of colour apart`);
    }
    for (const n of [await look(BIOMES[host].items, 'oreA', rgb(OUTLINE[host])), await look(BIOMES[donor].items, 'oreB', rgb(OUTLINE[donor]))]) {
      const colour = far(o.colour, n.colour);
      check(colour >= 60, `${name}: its colour ${o.colour} is within ${colour.toFixed(0)} of ${n.sheet}:${n.frame}, which it lies beside or stands for`);
    }
  }
}

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : 'ok: eighty-nine things in nine parts, near to far, every ore drawn as the lab knows it and paying as it did, a cross\'s rich ore paid for its donor\'s samples, hazards and keys sampled, old saves counted, the late level asking for the far ground, and the new ores outlined, apart, safe and seen');
process.exit(fails.length ? 1 : 0);
