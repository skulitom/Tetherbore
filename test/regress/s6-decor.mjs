// Each ground's own pieces in its caves (js/decor.js, art/decor.mjs): what has them, that they are a pure answer of
// the ground, that they lie only where the seed left a cave and go when their rock is cut, that they come as often
// as their rates say, and that the art keeps to its rules: a piece keeps to its band along its rock and out of the
// middle of the cell, is never as bright as the rock nor darker than the floor, and no colour of it (least of all
// a glow) is near a colour of what pays or hurts in any ground it is drawn in. And the motes are drawn as the air.
//   node test/regress/s6-decor.mjs
import { readFile } from 'node:fs/promises';
import { makeGame, farStart, N, C, K, world } from '../harness.mjs';
import { decodePNG } from '../../tools/png.mjs';
import { decorAt, markAt, natural, framesOf, placeOf, setOf, falls, DECOR, DECOR_MIX, CLEAR, DECOR_SHEETS } from '../../js/decor.js';
import { sheets } from '../../js/atlas.js';
import { SETS, HALOS, BAND, luma } from '../../art/decor.mjs';
import { ROCKS, STRAINS, POCKETS, CROSSES, FLOORS, POCKET_FLOORS } from '../../art/tiles.mjs';
const { BIOMES, HAZARDS, CROSS, cellHash } = world;

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const rows = BIOMES.filter(Boolean);
const book = framesOf();

// ---- 1. the rows and the sheets
for (const row of rows) {
  if (row.id === 33 || row.id === 34) { check(row.decor === null, `${row.name} has a set of pieces (it has no caves of its own)`); continue; }
  check(typeof row.decor === 'string' && DECOR[row.decor] && book.sets[row.decor], `${row.name} (${row.id}) has no set of pieces the sheets and the rates both have: ${row.decor}`);
  if (row.cross) {
    const host = BIOMES[row.cross.host], donor = BIOMES[row.cross.donor];
    check(row.decor === host.decor && row.decor2 === `${host.decor}-${donor.decor}` && row.air === host.air, `${row.name}: a cross has its host's set and air and the host-donor pieces (${row.decor}, ${row.decor2}, ${row.air})`);
    check(book.sets[row.decor2], `${row.name}: the sheets have no ${row.decor2}`);
  } else check(row.decor2 === null, `${row.name} mixes in another set`);
  if (row.air !== null) check(sheets.air.animations[row.air], `${row.name}: its motes are drawn as ${row.air}, which the air has not`);
}
for (const [set, rate] of Object.entries(DECOR)) {
  const f = book.sets[set];
  check(f, `the rates name a set the sheets have not: ${set}`);
  if (!f) continue;
  check(rate.top + rate.bottom <= 1, `${set}: its top and bottom rates come to more than every cell`);
  for (const [place, has] of [['top', f.top], ['bottom', f.bottom], ['side', f.left], ['floor', f.floor]]) check(rate[place] === 0 || has.length > 0, `${set} has a rate for ${place} and no frame for it`);
  check(f.left.length === f.right.length, `${set} has ${f.left.length} pieces for a left wall and ${f.right.length} for a right`);
}
for (const sheet of DECOR_SHEETS) for (const [frame, glow] of Object.entries(sheets[sheet].glows ?? {})) check(sheets.halo.frames[glow[2]], `${frame} glows with a halo there is no frame of: ${glow[2]}`);
// No glow in the ground of the steady lamp's tunnel (test/regress/light-steady.mjs: home and the east).
for (const id of [0, 4]) check(!Object.keys(sheets.decor.glows).some(f => setOf(f) === BIOMES[id].decor), `${BIOMES[id].name} has pieces that glow, in the tunnel the steady lamp is held in`);
// Glowing pieces are fewer than half of any set's pieces, as often as they come.
for (const set of Object.keys(DECOR)) {
  const f = book.sets[set], rate = DECOR[set], glows = name => book.frame.get(name).glow ? 1 : 0, share = list => list.length ? list.reduce((s, n) => s + glows(n), 0) / list.length : 0;
  const all = rate.top + rate.bottom + rate.side, lit = rate.top * share(f.top) + rate.bottom * share(f.bottom) + rate.side * share(f.left);
  check(!all || lit / all <= 0.4, `${set}: ${(lit / all * 100).toFixed(0)} in 100 of its pieces glow`);
}
// What falls is an icicle: a piece that hangs.
for (const sheet of DECOR_SHEETS) for (const f of sheets[sheet].falls ?? []) check(placeOf(f) === 'top' && falls(f), `${f} falls but does not hang`);
check(['frost', 'rime', 'firn', 'serac'].every(set => book.sets[set].top.some(falls)), 'a ground of the north has no icicle that may fall');

// ---- 2. the art: bands, brightness, colours
const pictures = {};
const picture = async name => pictures[name] ??= decodePNG(await readFile(new URL(`../../assets/${name}.png`, import.meta.url)));
const pixels = async (sheet, frame) => {
  const p = await picture(sheet), [fx, fy, fw, fh] = sheets[sheet].frames[frame], out = [];
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) { const o = ((fy + y) * p.width + fx + x) * 4; if (p.data[o + 3] > 0) out.push([x, y, p.data[o], p.data[o + 1], p.data[o + 2], p.data[o + 3]]); }
  return out;
};
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const Y = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
const far = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const glowing = new Set(Object.values(HALOS).flatMap(h => [h.g, h.d]));
const isGlow = c => glowing.has('#' + c.map(v => v.toString(16).padStart(2, '0')).join(''));
const rockOf = name => [...ROCKS, ...STRAINS, ...POCKETS, ...CROSSES].find(r => r.name === name)?.palette;
const floorOf = name => [...FLOORS, ...POCKET_FLOORS].find(r => r.name === name)?.palette;
// The colours that say what pays or hurts in a ground: every colour of its ores, hazards, lava, steel and mineral
// that is a colour at all (whites, greys and the dark outlines are not), and of the halos' own colours.
const signals = async row => {
  const out = [], take = async (sheet, frame) => { if (sheets[sheet]?.frames[frame]) for (const [, , r, g, b] of await pixels(sheet, frame)) if (Math.max(r, g, b) - Math.min(r, g, b) >= 64) out.push([r, g, b]); };
  await take(row.items, 'oreA'); await take(row.items, 'oreB'); await take(row.itemsB, 'oreB'); await take(...row.ores[0]); await take(...row.ores[1]);
  for (const haz of [row.haz, row.haz2]) if (haz) {
    const s = HAZARDS[haz.type].sheet;
    await take(s, 'hazard'); await take(s, 'hazard-b');
    if (haz.type === 'lava') { for (const f of ['slag', 'steel', 'steel-glint']) await take(s, f); await take('lava', 'lava-255-a'); await take('lava', 'lava-255-b'); }
  }
  if (row.pocket) { await take('minerals', row.pocket.mineral); if (row.pocket.node) { await take('minerals', `${row.pocket.node}-h`); } await take('minerals', 'cap'); }
  return out;
};
const framesBySet = {};
for (const sheet of DECOR_SHEETS) for (const f of Object.keys(sheets[sheet].frames)) (framesBySet[setOf(f)] ??= []).push([sheet, f]);
for (const sheet of [...DECOR_SHEETS]) {
  const p = await picture(sheet), colours = new Set();
  for (let o = 0; o < p.data.length; o += 4) colours.add(p.data.readUInt32BE?.(o) ?? ((p.data[o] << 24) | (p.data[o + 1] << 16) | (p.data[o + 2] << 8) | p.data[o + 3]));
  check(colours.size <= 256, `assets/${sheet}.png has ${colours.size} colours: more than a palette picture holds`);
}
// Each frame keeps to its band (BAND pixels from its rock: so the middle of the cell, where an ore or a hazard sits,
// is always empty), and has no colour darker than its floor (no outline) or brighter than its rock, but its glow;
// and what most of it is no brighter than two thirds of the way from its rock's dark band to its rock's own colour.
const checked = new Set();
for (const row of rows) {
  if (!row.decor) continue;
  const rock = rockOf(row.sheet), floor = floorOf(row.floor), all = await signals(row);
  // (A colour that the ground's own rock has too, within 40, says nothing apart from the rock: an ore or a hazard
  // is told from rock by its outline and its shape, and a piece of decor, darker than the rock, is no nearer it.
  // A glow is held to every one.)
  const sig = rock ? all.filter(s => ![rock.f, rock.a, rock.b, rock.D].some(c => far(rgb(c), s) < 40)) : all;
  check(rock && floor, `${row.name}: no palette for its rock ${row.sheet} or floor ${row.floor}`);
  if (!rock || !floor) continue;
  const top = Y(rgb(rock.f)), body = Y(rgb(rock.D)) + (Y(rgb(rock.f)) - Y(rgb(rock.D))) * 2 / 3, low = Y(rgb(floor.f));
  for (const set of [row.decor, row.decor2]) for (const [sheet, f] of set ? framesBySet[set] : []) {
    const place = placeOf(f), px = await pixels(sheet, f), counts = new Map();
    if (!checked.has(f)) {
      checked.add(f);
      const out = px.filter(([x, y]) => place === 'top' ? y >= BAND : place === 'bottom' ? y < 16 - BAND : place === 'left' ? x >= BAND : place === 'right' ? x < 16 - BAND : false);
      check(!out.length, `${f} reaches ${out.length} pixels past its band of ${BAND} from its ${place}`);
      check(place === 'floor' || !px.some(([x, y]) => x >= 6 && x <= 9 && y >= 6 && y <= 9), `${f} has a pixel in the middle of the cell`);
    }
    for (const [, , r, g, b] of px) {
      const c = [r, g, b];
      if (isGlow(c)) { for (const s of all) if (far(c, s) < 72) { check(false, `${f} glows in ${c} in ${row.name}, within ${far(c, s).toFixed(0)} of ${s}, a colour of what pays or hurts there`); break; } continue; }
      counts.set(c.join(), (counts.get(c.join()) ?? 0) + 1);
      for (const s of sig) if (far(c, s) < 48) { check(false, `${f} has ${c} in ${row.name}, within ${far(c, s).toFixed(0)} of ${s}, a colour of what pays or hurts there`); break; }
      if (Y(c) > top + 1) check(false, `${f} has ${c} in ${row.name}, brighter (${Y(c).toFixed(0)}) than its rock's own colour (${top.toFixed(0)})`);
      if (Y(c) < low - 2) check(false, `${f} has ${c} in ${row.name}, darker (${Y(c).toFixed(0)}) than the floor (${low.toFixed(0)}): an outline`);
    }
    const most = [...counts].sort((a, b) => b[1] - a[1])[0];
    if (most && place !== 'floor') check(Y(most[0].split(',').map(Number)) <= body + 1, `${f} is mostly ${most[0]} in ${row.name}, as bright as its rock`);
  }
  for (const glow of Object.values(HALOS)) for (const s of all) if (Object.keys(sheets.decor.glows).some(f => [row.decor, row.decor2].includes(setOf(f)) && sheets.decor.glows[f][2] === `halo-${Object.keys(HALOS).find(k => HALOS[k] === glow)}`) && far(rgb(glow.halo), s) < 72) { check(false, `${row.name}'s halo ${glow.halo} is within ${far(rgb(glow.halo), s).toFixed(0)} of ${s}`); break; }
}

// ---- 3. what has a piece: a pure answer, only where the seed left a cave, gone with its rock
// (Places on world 7 where each ground lies all about. The north's deep flank was counted at -613,-747, where the
// north-west seam lies now: `node tools/field.mjs --seed 7 --at -440,-960`. The seams and the deep strains, which
// a new game lays (generation 2), at the places tools/field.mjs shows the most of each about.)
const PLACES = { 1: [-86, -170], 2: [92, 150], 3: [-160, 64], 4: [160, 64], 5: [-440, -960], 6: [-418, 781], 7: [-763, 510], 8: [795, 425], 17: [-149, -360], 18: [67, -335],
  19: [-34, 340], 20: [57, 288], 21: [-564, 377], 22: [-320, -64], 23: [351, 288], 24: [281, -85], 178: [1123, 341], 163: [-1231, -373],
  9: [496, -480], 10: [544, 560], 11: [-448, 432], 12: [-608, -608], 13: [752, -768], 14: [848, 832], 15: [-896, 880], 16: [-704, -720],
  64: [-608, -832], 65: [-640, 1312], 66: [-1328, -816], 67: [1088, -496] };
const game = await makeGame(7), w = game.world;
const memo = new Map(), wild = i => { let v = memo.get(i); if (v === undefined) memo.set(i, v = natural(w, i, i % N, Math.floor(i / N))); return v; };
const anchored = j => [K.SOFT, K.DENSE, K.ORE_A, K.ORE_B, K.SLATE, K.VAULT, K.ICE, K.BASALT, K.SLAG, K.STEEL, K.BEDROCK, K.FAULT, K.GLASS].includes(w.k(j)) && w.s(j) > 0;
const tally = {};
for (const [id, [dx, dy]] of Object.entries(PLACES)) {
  const cx = C + dx, cy = C + dy, R = 70;
  w.see(cx, cy, R);
  check(w.b(cy * N + cx) === +id, `world 7 has not ${BIOMES[id].name} at ${dx},${dy} any more`);
  const t = tally[id] = { up: 0, top: 0, down: 0, bottom: 0, wall: 0, side: 0, floor: 0, open: 0, mark: 0 };
  const names = [];
  for (let y = cy - R + 1; y < cy + R; y++) for (let x = cx - R + 1; x < cx + R; x++) {
    const i = y * N + x;
    if (w.k(i) !== K.EMPTY || w.b(i) !== +id) { names.push(null); continue; }
    const f = decorAt(w, i, x, y, BIOMES[id], wild), place = f && placeOf(f), mark = markAt(x, y, BIOMES[id]);
    names.push(f);
    if (f) check(wild(i), `${f} at ${x - C},${y - C}: a cell the seed did not leave open has a piece`);
    if (place === 'top') check(anchored(i - N), `${f} hangs from nothing`);
    if (!wild(i)) continue;
    const up = anchored(i - N), down = anchored(i + N), wall = !up && !down && (anchored(i - 1) || anchored(i + 1));
    t.open++; if (f === null && mark) t.mark++;
    if (up) { t.up++; if (place === 'top') t.top++; }
    if (down) { t.down++; if (place === 'bottom') t.bottom++; }
    if (wall) { t.wall++; if (place === 'left' || place === 'right') t.side++; }
    check(!(f && BIOMES[id].decor2) || [BIOMES[id].decor, BIOMES[id].decor2].includes(setOf(f)), `${f} is of neither set of ${BIOMES[id].name}`);
  }
  // The same asked the other way round, with nothing kept from before.
  memo.clear();
  let k = names.length, differ = 0;
  for (let y = cy + R - 1; y > cy - R; y--) for (let x = cx + R - 1; x > cx - R; x--) {
    const i = y * N + x, want = names[--k];
    const got = w.k(i) !== K.EMPTY || w.b(i) !== +id ? null : decorAt(w, i, x, y, BIOMES[id], wild);
    if (got !== want) differ++;
  }
  check(!differ, `${BIOMES[id].name}: ${differ} cells have another piece when asked in the other order`);
  // As often as the rates say, each where its rock is.
  const rate = DECOR[BIOMES[id].decor], near = (n, of, want) => of < 150 || Math.abs(n / of - want) <= Math.max(0.05, 3 * Math.sqrt(want * (1 - want) / of));
  check(near(t.top, t.up, rate.top), `${BIOMES[id].name}: ${t.top} of ${t.up} cells under rock have a piece hanging, not ${rate.top} of them`);
  check(near(t.bottom, t.down, rate.bottom), `${BIOMES[id].name}: ${t.bottom} of ${t.down} cells over rock have a piece standing, not ${rate.bottom} of them`);
  check(near(t.side, t.wall, rate.side), `${BIOMES[id].name}: ${t.side} of ${t.wall} cells against a wall have a piece on it, not ${rate.side} of them`);
  check(t.up >= 150 || +id > 100, `${BIOMES[id].name}: only ${t.up} cells under rock to count`);
}
// Cut cells have no piece, only the back wall's mark; cutting the rock a piece hangs from takes the piece.
{
  const [dx, dy] = PLACES[3], cx = C + dx, cy = C + dy;
  let cut = 0, hung = null;
  for (let y = cy - 30; y < cy + 30 && hung === null; y++) for (let x = cx - 30; x < cx + 30; x++) {
    const i = y * N + x, f = w.k(i) === K.EMPTY ? decorAt(w, i, x, y, BIOMES[3], wild) : null;
    if (f && placeOf(f) === 'top' && w.k(i - N) === K.SOFT) { hung = i; break; }
  }
  check(hung !== null, 'no piece hanging from soft rock in the mire to cut');
  if (hung !== null) {
    w.setK(hung - N, K.EMPTY);
    const x = hung % N, y = Math.floor(hung / N), f = decorAt(w, hung, x, y, BIOMES[3], wild);
    check(f === null || placeOf(f) !== 'top', `cutting the rock over ${x - C},${y - C} left ${f} hanging from it`);
    check(decorAt(w, hung - N, x, y - 1, BIOMES[3], wild) === null, 'the cell cut out of the rock has a piece of its own');
  }
  for (let y = cy - 30; y < cy + 30; y++) for (let x = cx - 30; x < cx + 30; x++) {
    const i = y * N + x;
    if (w.first(i) === K.EMPTY || w.k(i) === K.EMPTY) continue;
    w.setK(i, K.EMPTY); cut++;
    check(decorAt(w, i, x, y, BIOMES[w.b(i)], wild) === null, `a cell cut at ${x - C},${y - C} has a piece`);
    if (cut > 400) break;
  }
  let marks = 0;
  for (let y = cy - 30; y < cy + 30; y++) for (let x = cx - 30; x < cx + 30; x++) if (w.first(y * N + x) !== K.EMPTY && w.k(y * N + x) === K.EMPTY && markAt(x, y, BIOMES[3])) marks++;
  check(marks > 0, 'no cut cell has a mark of the back wall');
}
// Nothing in a slab's crack, near the core, or hanging from a hazard, a cap, a stalk or a mineral.
{
  const S = w.firstSlab;
  w.see(S.cx, S.cy, S.p + 4);
  for (let y = S.cy - S.p - 3; y <= S.cy + S.p + 3; y++) for (let x = S.cx - S.p - 3; x <= S.cx + S.p + 3; x++) {
    const i = y * N + x;
    if (w.slabCell(S, x, y) === 1 && w.k(i) === K.EMPTY) check(decorAt(w, i, x, y, w.row(i), wild) === null, `the slab's crack at ${x - C},${y - C} has a piece`);
  }
  w.see(C, C, CLEAR + 2);
  for (let y = C - CLEAR; y <= C + CLEAR; y++) for (let x = C - CLEAR; x <= C + CLEAR; x++) if ((x - C) ** 2 + (y - C) ** 2 <= CLEAR * CLEAR) {
    check(decorAt(w, y * N + x, x, y, BIOMES[0], () => true) === null && markAt(x, y, BIOMES[0]) === null, `${x - C},${y - C}, by the core, has a piece`);
  }
  let asked = 0;
  for (const [id, [dx, dy]] of Object.entries(PLACES)) for (let y = C + dy - 60; y < C + dy + 60; y++) for (let x = C + dx - 60; x < C + dx + 60; x++) {
    const i = y * N + x, over = w.k(i - N);
    if (w.k(i) !== K.EMPTY || ![K.HAZARD, K.HAZARD2, K.CAP, K.CAP_LIT, K.NODE, K.MINERAL, K.CACHE, K.WRECK, K.KEY].includes(over)) continue;
    asked++;
    const f = decorAt(w, i, x, y, w.row(i), wild);
    check(!f || placeOf(f) !== 'top', `${f} hangs from a ${world.KIND_NAMES[over]} at ${x - C},${y - C}`);
  }
  check(asked > 20, `only ${asked} open cells under a hazard to look at`);
}
// Painting draws no Math.random and is the same painted twice over, with the wild answers kept or not.
{
  const g = await makeGame(11);
  farStart(g, -300, 40);
  g.resize(360, 640, 1);
  for (let f = 0; f < 30; f++) { g.update(1 / 60); g.render(); }
  const sketch = () => { const calls = []; return { calls, set globalAlpha(a) { calls.push(`a${a}`); }, set fillStyle(s) { calls.push(`f${s}`); }, fillRect(...a) { calls.push(`r${a}`); }, drawImage(im, ...a) { calls.push(`i${a}`); } }; };
  const before = Math.random;
  let drawn = 0;
  Math.random = () => { drawn++; return before(); };
  const one = [], two = [];
  for (const [cx, cy] of [...g.chunks.values()].slice(0, 40).map(c => [c.cx, c.cy])) { const s = sketch(); g.paint(s, cx * 8, cy * 8); one.push(s.calls.join('|')); }
  g.wild = new Map();
  for (const [cx, cy] of [...g.chunks.values()].slice(0, 40).map(c => [c.cx, c.cy]).reverse()) { const s = sketch(); g.paint(s, cx * 8, cy * 8); two.unshift(s.calls.join('|')); }
  Math.random = before;
  check(drawn === 0, `painting the ground drew Math.random ${drawn} times`);
  check(one.every((s, n) => s === two[n]), 'a piece of ground painted again, asked afresh in the other order, came out otherwise');
  // A fallen icicle is not drawn, and what has one can be asked (`decorOf`, `falls`).
  const h = await makeGame(7);
  farStart(h, ...PLACES[1]); h.resize(360, 640, 1); h.world.see(C + PLACES[1][0], C + PLACES[1][1], 40);
  let icicle = -1;
  for (let y = C + PLACES[1][1] - 40; y < C + PLACES[1][1] + 40 && icicle < 0; y++) for (let x = C + PLACES[1][0] - 40; x < C + PLACES[1][0] + 40; x++) { const f = h.decorOf(y * N + x); if (f && falls(f)) { icicle = y * N + x; break; } }
  if (icicle >= 0) {
    const x = icicle % N, y = Math.floor(icicle / N), s1 = sketch(), s2 = sketch();
    h.paint(s1, x & ~7, y & ~7);
    h.feel.fallen.add(icicle);
    h.paint(s2, x & ~7, y & ~7);
    check(s1.calls.join() !== s2.calls.join() && !(h.decorOf(icicle) && falls(h.decorOf(icicle))), 'an icicle that has fallen is still drawn');
  }
  check(icicle >= 0, 'no icicle found in the north to let fall');
}

// ---- 4. the air
{
  const g = await makeGame(7);
  farStart(g, -86, -170);
  const tints = [];
  const atlas = await import('../../js/atlas.js');
  // (The air of the place in view: the drill is left where it was set down, and only the air is stepped.)
  g.cam.x = g.drill.x * 16; g.cam.y = g.drill.y * 16; g.world.see(Math.floor(g.drill.x), Math.floor(g.drill.y), 16);
  for (let f = 0; f < 300; f++) g.ambient(1 / 60);
  check(g.motes.length > 20 && g.motes.filter(m => g.world.row(Math.floor(m.y / 16) * N + Math.floor(m.x / 16)).kin === 1).every(m => m.air === 'flake'), 'motes in the north are not flakes');
  const drawn = [];
  g.ctx = new Proxy(g.ctx, { get: (t, k) => k === 'drawImage' ? (im, ...a) => { drawn.push(im); } : t[k], set: (t, k, v) => { t[k] = v; return true; } });
  g.render();
  const flake = atlas.tinted('air', BIOMES[1].mote[0]);
  check(drawn.includes(flake), 'no mote was drawn as a flake of the air in its colour');
}

console.log(fails.length ? `DEFECT:\n  ${[...new Set(fails)].slice(0, 40).join('\n  ')}${fails.length > 40 ? `\n  ... ${fails.length} in all` : ''}` : `no defect: ${rows.length} grounds have their pieces, pure and only in caves, at their rates (${Object.entries(tally).map(([id, t]) => `${BIOMES[id].name} ${t.top}/${t.up}`).join(', ')}), and the art keeps to its rules`);
process.exit(fails.length ? 1 : 0);
