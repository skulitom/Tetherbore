// The lab at sixty-four. What the lab can know is sixty-four things in five parts (home and all round, then each
// direction), each drawn from a frame the atlas has; every ground that has ore says what its two ores are (`ores`),
// and that is both what the cell is drawn as and what the lab knows it by, so a strain's, a seam's, a deep flank's
// and a deep strain's ores are their own (a deep seam's its seam's), the four directions' and the crosses' as they
// were; within a direction's part the seam's come after the rare hazard and the deep strain's after the deep
// flank's, near to far. A hazard of any type and a keystone's iron are samples, an inert hazard and a prism are
// not. An ore that is its own pays exactly as the cell would with its direction's ore, and what is known of it
// makes it, and nothing else, worth more. A hazard cut into is analysed and still goes off; a rare hazard's lump
// takes what is known of it. A game saved with the sixteen first keys loads and counts them, the gem cutter asks
// for kinds out of the sixty-four, and its late level for more than the near ground holds without the deep
// flanks' and deep strains' ores. And the art of the new ores keeps to its rules, read from the sheets as built:
// outlined in their direction's outline (a seam's rich ore in its other parent's, whose gems it pays), each apart from its neighbours in shape or colour, none in the colour of
// what hurts in its ground (its direction's hazards, and a seam's other hazard), none lost against its own rock, a
// common ore in pieces and a rich one in one.
//   node test/regress/l-ores.mjs
import { readFile } from 'node:fs/promises';
import { makeGame, N, C, K, world } from '../harness.mjs';
import { decodePNG } from '../../tools/png.mjs';
import { ROCKS, STRAINS } from '../../art/tiles.mjs';
const { LAB, LAB_OF, LAB_KINS, CORE, labLevel } = await import('../../js/shop.js');
const { sheets } = await import('../../js/atlas.js');
const { BIOMES, HAZARDS, RARE, B, SEAMS, DEEP_STRAINS, rowOf, crossRow } = world;

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const atlas = JSON.parse(await readFile(new URL('../../assets/atlas.json', import.meta.url), 'utf8'));

// ---- 1. the sixty-four
const SIXTEEN = ['lode-items:oreA', 'lode-items:oreB', 'frost-items:oreA', 'frost-items:oreB', 'ember-items:oreA', 'ember-items:oreB', 'ember-items:steel', 'mire-items:oreA', 'mire-items:oreB',
  'minerals:amber', 'minerals:aerolite', 'minerals:tektite', 'minerals:starglass', 'minerals:opal', 'minerals:lantern', 'minerals:agate'];
const GROUNDS = ['firn', 'serac', 'scoria', 'forge', 'tangle', 'sporefall', 'redrock', 'loess', 'rime', 'magma', 'bloom', 'gilt',
  'hoarstone', 'glassdune', 'cinderfen', 'frostfen', 'glacier', 'caldera', 'mycelium', 'druse'];
// (The rows whose ores are their own: the strains, the seams, the deep flanks and the deep strains. A deep seam's
// are its seam's.)
const OWN = id => (id >= 5 && id <= 24) || (id >= 64 && id <= 67);
const SEAM_OF = id => id >= 13 && id <= 16 ? id - 4 : id;
const NEW_ORES = GROUNDS.flatMap(g => [`ores:${g}A`, `ores:${g}B`]);
check(LAB.length === 64, `the lab knows ${LAB.length} things, not sixty-four`);
check(new Set(LAB.map(e => e.key)).size === LAB.length, 'two things of the lab share a key');
check(SIXTEEN.every(key => LAB_OF[key]), `the sixteen first keys are not all there: ${SIXTEEN.filter(key => !LAB_OF[key])}`);
check(NEW_ORES.every(key => LAB_OF[key]), `the strains' and flanks' ores are not all there: ${NEW_ORES.filter(key => !LAB_OF[key])}`);
const parts = [0, 1, 2, 3, 4].map(kin => LAB.filter(e => e.kin === kin).length);
check(parts.join() === '4,14,17,16,13', `the parts of the list hold ${parts}, not 4, 14, 17, 16 and 13`);
// Near to far within a part: the rare hazard (450 cells), the seam (470), the deep flank (800), the deep strain
// (1,100); and each in the part of the direction whose ground it is.
for (const kin of [1, 2, 3, 4]) {
  const seam = BIOMES[SEAMS.find(([id]) => BIOMES[id].kin === kin)[0]], strain = BIOMES[DEEP_STRAINS[kin][0]];
  const at = key => LAB.findIndex(e => e.key === key), order = [`${HAZARDS[RARE[kin]].sheet}:hazard`, `ores:${seam.name}A`, `ores:${seam.name}B`, `ores:${BIOMES[kin + 4].name}A`, `ores:${BIOMES[kin + 4].name}B`, `ores:${strain.name}A`, `ores:${strain.name}B`];
  check(order.every((key, i) => at(key) >= 0 && LAB[at(key)].kin === kin && (i === 0 || at(key) > at(order[i - 1]))), `the far things of the ${LAB_KINS[kin][0]} are not in its part from near to far: ${order.map(key => `${key} ${at(key)}`)}`);
}
check(LAB.every((e, i) => i === 0 || e.kin >= LAB[i - 1].kin), 'the parts of the list are not each in one run');
check(LAB_KINS.length === 5 && LAB_KINS.every(([title, icon]) => title && atlas.icons.frames[icon]), 'a part of the list has no title or no icon');
for (const e of LAB) {
  const [sheet, frame] = e.key.split(':');
  check(atlas[sheet]?.frames[frame], `${e.name}: the atlas has no ${e.key}`);
  check(e.name && e.at && e.where && e.note && [0, 1, 2, 3, 4].includes(e.kin), `${e.key}: no name, place, where or part`);
}
check(atlas.ores && Object.keys(atlas.ores.frames).length === 40, `the ores sheet has ${Object.keys(atlas.ores?.frames ?? {}).length} frames, not 40`);

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
    : OWN(row.id) ? [`ores:${BIOMES[SEAM_OF(row.id)].name}A`, `ores:${BIOMES[SEAM_OF(row.id)].name}B`]
    : row.cross ? [`${BIOMES[row.cross.host].items}:oreA`, `${BIOMES[row.cross.donor].items}:oreB`] : null;
  if (want) check(row.oreKeys.join() === want.join(), `${row.name} (${row.id}): its ores are ${row.oreKeys}, not ${want}`);
  // (Where a row's ores are its direction's sheet, they are what `items` and `itemsB` say, so the two cannot drift.)
  if (!OWN(row.id)) check(row.oreKeys.join() === `${row.items}:oreA,${row.itemsB}:oreB`, `${row.name}: its ores ${row.oreKeys} are not its items' ${row.items}, ${row.itemsB}`);
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
for (const id of [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 64, 65, 66, 67]) for (const k of [K.ORE_A, K.ORE_B]) {
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
// Its late level asks for more kinds than there are short of the far ground's ores (the seams', the deep flanks'
// and the deep strains', twenty-four: a deep seam's are its seam's), and no more than there are; and LIVE CATCH's
// first two levels for no more than there are.
{
  const far = LAB.filter(e => [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 64, 65, 66, 67].some(id => BIOMES[id].oreKeys.includes(e.key))).length, late = cutter.needs[1][4];
  check(far === 24 && late[0] === 'kinds' && late[1] > LAB.length - far && late[1] <= LAB.length, `the gem cutter's late level asks for ${late}, where ${LAB.length - far} kinds lie short of the ${far} far ores`);
  const live = CORE.find(u => u.id === 'livecatch');
  check(live.needs[0] === 'kinds' && live.needs[1].slice(0, 2).every(n => n <= LAB.length), `LIVE CATCH asks for ${live.needs[1].slice(0, 2)} kinds, of ${LAB.length}`);
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
const OUTLINE = { 1: '#22395a', 2: '#160c12', 3: '#1c1426', 4: '#3a2414' };
const KIN_SHEET = { 1: 'frost-items', 2: 'ember-items', 3: 'mire-items', 4: 'lode-items' };
// (Each direction's grounds with ores of their own: its own, its strains, its deep flank, its seam and its deep
// strain. A deep seam's ores are its seam's.)
const KIN_ROWS = { 1: [1, 17, 18, 5, 9, 64], 2: [2, 19, 20, 6, 11, 65], 3: [3, 21, 22, 7, 12, 66], 4: [4, 23, 24, 8, 10, 67] };
const rockOf = name => [...ROCKS, ...STRAINS].find(r => r.name === name)?.palette;
for (const kin of [1, 2, 3, 4]) {
  const rows = KIN_ROWS[kin].map(id => BIOMES[id]), mine = [];
  // (A seam's rich ore pays its other parent's gems and is drawn in that direction's outline, as a cross's rich ore
  // is drawn as its donor's; every other ore here is in this direction's.)
  const lineOf = (row, frame) => OUTLINE[frame.endsWith('B') && row.seam != null ? row.gemB : kin];
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

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : 'ok: sixty-four things in five parts, near to far, every ore drawn as the lab knows it and paying as it did, hazards and keys sampled, old saves counted, and the new ores outlined, apart, safe and seen');
process.exit(fails.length ? 1 : 0);
