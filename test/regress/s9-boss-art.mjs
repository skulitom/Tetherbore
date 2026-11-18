// The lords' art (art/bosses.mjs, built into assets/bosses.png): the rules the creatures' art keeps (s8-fauna, part
// 4), held on the `bosses` sheet, and the game drawing it.
//   1. The sheet has every frame js/bosses.js asks for and no other: each lord's poses in the order its BOSS row
//      has them, facing east and facing west (`-l`), 48 by 48, the west's the east's turned.
//   2. Every frame is ringed in its direction's own outline, as the creatures and the ores are.
//   3. The foe's eye colour is in a frame only where its `eyes` say, and they say only where it is; a lord up out of
//      the rock (risen, idle, telling, attacking, resting, hurt) has its eyes; the `lamps` lie on the lord and are
//      never its eyes. Each lord is lit more as it tells than as it rests, and every pose of a lord is its own.
//   4. Each lord up is about two cells and more across, as big as the frame lets it be seen at the size of a phone.
//   5. No colour of a lord that is a colour at all (chroma 64 and more) is within 48 of a colour of what pays or
//      hurts in any ground within 40 cells of its lair on 32 worlds (their ores, hazards, lava, steel and minerals),
//      and the foe's eye is 72 and more from all of those, from every halo, mote and firefly of those grounds and
//      from every colour of the tether.
//   6. The game draws them: each lord staged at its lair in each of its states draws its body from the sheet, the
//      frame its pose and facing name, and lays its glow on its eyes.
// Fails on the game before the lords' art, which has no `bosses` sheet.
//   node test/regress/s9-boss-art.mjs
import { readFile } from 'node:fs/promises';
import { makeGame, C, world } from '../harness.mjs';
import { sheets } from '../../js/atlas.js';
import { FOE_EYE, KIN_FAUNA } from '../../js/fauna.js';
import { FEELS } from '../../js/feel.js';
import { TETHERS } from '../../js/fit.js';
import { HALOS } from '../../art/decor.mjs';
import { decodePNG } from '../../tools/png.mjs';
import { BOSS, EYE, P, frameName, lairX, lairY } from '../../js/bosses.js';
import { NAMES, atLair } from './lib/lords.mjs';
const { BIOMES, HAZARDS, DX, DY } = world;

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)), far = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const chroma = c => Math.max(...c) - Math.min(...c);
const eye = hex(FOE_EYE);
check(EYE === FOE_EYE, `js/bosses.js's EYE ${EYE} is not the creatures' FOE_EYE ${FOE_EYE}`);
const OUTLINE = { lode: '#3a2414', ember: '#160c12', mire: '#1c1426', frost: '#22395a' };
const UP = ['rise', 'idle_a', 'idle_b', 'tell', 'act', 'rest', 'hurt'];

// ---- 1. every frame
const s = sheets.bosses;
check(s, 'the atlas has no bosses sheet');
if (!s) { for (const f of fails) console.log(`FAIL ${f}`); process.exit(1); }
const png = decodePNG(await readFile(new URL('../../assets/bosses.png', import.meta.url)));
const pixels = frame => {
  const [fx, fy, fw, fh] = s.frames[frame], out = [];
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) { const o = ((fy + y) * png.width + fx + x) * 4; if (png.data[o + 3]) out.push([x, y, png.data[o], png.data[o + 1], png.data[o + 2]]); }
  return out;
};
const key = ([x, y, r, g, b]) => `${x},${y},${r},${g},${b}`;
const asked = new Set();
for (let b = 0; b < 4; b++) {
  check(BOSS[b].poses.length === 9, `the ${NAMES[b]}'s lord has ${BOSS[b].poses.length} poses`);
  for (let pose = 0; pose < BOSS[b].poses.length; pose++) for (const left of [0, 1]) {
    const name = frameName(b, pose, left), f = s.frames[name];
    asked.add(name);
    check(f, `the atlas has no ${name}`);
    if (f) check(f[2] === 48 && f[3] === 48, `${name} is ${f[2]}x${f[3]}, not 48x48`);
  }
}
const extra = Object.keys(s.frames).filter(n => !asked.has(n));
check(!extra.length, `the bosses sheet has frames nothing asks for: ${extra.join(', ')}`);

// ---- 2 to 4. each frame's art
for (let b = 0; b < 4; b++) {
  const B = BOSS[b], outline = hex(OUTLINE[B.look]), seen = new Map(), lamps = [];
  for (let pose = 0; pose < B.poses.length; pose++) {
    const name = frameName(b, pose, 0), turned = frameName(b, pose, 1);
    if (!s.frames[name] || !s.frames[turned]) continue;
    const px = pixels(name), mirror = new Set(pixels(turned).map(([x, y, r, g, bl]) => key([47 - x, y, r, g, bl])));
    check(px.length > 0 && px.length === mirror.size && px.every(p => mirror.has(key(p))), `${turned} is not ${name} turned to face west`);
    const sig = px.map(key).join(';');
    check(!seen.has(sig), `${name} is drawn the same as ${seen.get(sig)}`);
    seen.set(sig, name);
    for (const frame of [name, turned]) {
      const all = pixels(frame), at = new Set(all.map(([x, y]) => `${x},${y}`)), colour = new Map(all.map(([x, y, r, g, bl]) => [`${x},${y}`, [r, g, bl]]));
      // Ringed: every pixel at the edge of the shape is the outline's.
      const edge = all.filter(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([u, v]) => !at.has(`${x + u},${y + v}`)));
      check(edge.every(([, , r, g, bl]) => far([r, g, bl], outline) < 1), `${frame} is not ringed in the ${B.look}'s outline`);
      // The foe's eye: where the eyes are said to be, and nowhere else.
      const eyes = s.eyes?.[frame] ?? [], said = new Set(eyes.map(([x, y]) => `${x},${y}`));
      const red = all.filter(([, , r, g, bl]) => far([r, g, bl], eye) < 1).map(([x, y]) => `${x},${y}`);
      check(red.length === said.size && red.every(p => said.has(p)), `${frame} has the foe's eye colour at ${red.join(' ')}, its eyes are said to be at ${[...said].join(' ')}`);
      if (UP.some(p => P[p] === pose)) check(eyes.length > 0, `${frame}, a lord up out of the rock, has no eyes`);
      const lit = s.lamps?.[frame] ?? [];
      check(lit.every(([x, y]) => at.has(`${x},${y}`) && !said.has(`${x},${y}`) && far(colour.get(`${x},${y}`), eye) >= 72), `${frame} has a lamp off the lord, or on its eyes`);
      if (frame === name) lamps[pose] = lit.length;
      // Big enough to be seen: up, about two cells across and more.
      if (UP.some(p => P[p] === pose)) {
        const xs = all.map(p => p[0]), ys = all.map(p => p[1]), w = Math.max(...xs) - Math.min(...xs) + 1, h = Math.max(...ys) - Math.min(...ys) + 1;
        check(w >= 30 && h >= 28 && all.length >= 600, `${frame} is only ${w}x${h} (${all.length} pixels)`);
      }
    }
  }
  check(lamps[P.tell] > lamps[P.rest], `the ${NAMES[b]}'s lord is lit no more as it tells (${lamps[P.tell]} lamps) than as it rests (${lamps[P.rest]})`);
}

// ---- 5. its colours against what pays and hurts about its lair, and the eye against every glow there
const shown = {};
const colours = async (sheet, frame) => {
  if (!sheets[sheet]?.frames[frame]) return [];
  const p = shown[sheet] ??= decodePNG(await readFile(new URL(`../../assets/${sheet}.png`, import.meta.url))), [fx, fy, fw, fh] = sheets[sheet].frames[frame], out = [];
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) { const o = ((fy + y) * p.width + fx + x) * 4; if (p.data[o + 3] && chroma([p.data[o], p.data[o + 1], p.data[o + 2]]) >= 64) out.push([p.data[o], p.data[o + 1], p.data[o + 2]]); }
  return out;
};
const signals = async row => {
  const out = [];
  for (const [sheet, frame] of [[row.items, 'oreA'], [row.items, 'oreB'], [row.itemsB, 'oreB'], row.ores?.[0] ?? [], row.ores?.[1] ?? []]) out.push(...await colours(sheet, frame));
  for (const haz of [row.haz, row.haz2, world.RARE[row.kin] && { type: world.RARE[row.kin] }]) if (haz) {
    const sheet = HAZARDS[haz.type].sheet;
    for (const frame of ['hazard', 'hazard-b']) out.push(...await colours(sheet, frame));
    if (haz.type === 'lava') { for (const frame of ['slag', 'steel', 'steel-glint']) out.push(...await colours(sheet, frame)); out.push(...await colours('lava', 'lava-255-a')); }
  }
  if (row.pocket) { out.push(...await colours('minerals', row.pocket.mineral)); out.push(...await colours('minerals', 'cap')); out.push(...await colours('minerals', 'cap-lit')); }
  return out;
};
const glows = row => {
  const out = Object.values(HALOS).flatMap(h => [h.g, h.d, h.halo]).filter(Boolean).map(hex);
  if (row.mote) out.push(hex(row.mote[0]));
  const f = FEELS[row.name] ?? FEELS[KIN_FAUNA[row.kin]];
  if (f?.flies) out.push(hex(f.flies.color));
  return out;
};
const grounds = [new Set(), new Set(), new Set(), new Set()];
for (let seed = 1; seed <= 32; seed++) {
  const w = (await makeGame(seed)).world;
  for (let b = 0; b < 4; b++) for (let u = -40; u <= 40; u += 4) for (let v = -40; v <= 40; v += 4) if (u * u + v * v <= 1600) grounds[b].add(w.biomeAt(Math.floor(lairX(b)) + u, Math.floor(lairY(b)) + v));
}
const tether = TETHERS.flatMap(t => [t.a, t.b, t.glow, t.twin]).filter(Boolean).map(hex);
for (const t of tether) check(far(eye, t) >= 72, `the foe's eye is within ${far(eye, t).toFixed(0)} of ${t}, a colour of the tether`);
let compared = 0;
for (let b = 0; b < 4; b++) {
  check(grounds[b].size >= 5, `only ${grounds[b].size} grounds lie about the ${NAMES[b]}'s lair on 32 worlds`);
  const own = new Map();
  for (let pose = 0; pose < BOSS[b].poses.length; pose++) for (const [, , r, g, bl] of s.frames[frameName(b, pose, 0)] ? pixels(frameName(b, pose, 0)) : []) if (chroma([r, g, bl]) >= 64 && far([r, g, bl], eye) >= 1) own.set(`${r},${g},${bl}`, [r, g, bl]);
  for (const ground of grounds[b]) {
    const row = BIOMES[ground], sig = await signals(row), lights = glows(row);
    for (const c of own.values()) for (const sg of sig) { compared++; if (far(c, sg) < 48) { check(false, `the ${NAMES[b]}'s lord's ${c} is within ${far(c, sg).toFixed(0)} of ${sg}, a colour of what pays or hurts in ${row.name}`); break; } }
    for (const sg of sig) if (far(eye, sg) < 72) { check(false, `the foe's eye is within ${far(eye, sg).toFixed(0)} of ${sg}, a colour of what pays or hurts in ${row.name}`); break; }
    for (const gl of lights) if (far(eye, gl) < 72) { check(false, `the foe's eye is within ${far(eye, gl).toFixed(0)} of ${gl}, a glow or a mote of ${row.name}`); break; }
  }
}

// ---- 6. the game draws them
const STATES = [['rise', 1, P.rise], ['tell', 1, P.tell], ['act', 1, P.act], ['rest', 1, P.rest], ['hurt', 2, P.hurt]];
for (let b = 0; b < 4; b++) {
  const game = await atLair(b), Bs = game.fauna.bosses;
  for (const [what, n, pose] of STATES) {
    Bs.stageAs(game, b, what, n);
    const drawn = [], dots = { n: 0 };
    const ctx = new Proxy({}, { get: (t, k) => k === 'drawImage' ? (image, sx, sy, sw, sh) => drawn.push([image, sx, sy, sw, sh]) : k === 'fillRect' ? () => { if (t.fillStyle === EYE) dots.n++; } : k in t ? t[k] : () => {}, set: (t, k, v) => { t[k] = v; return true; } });
    const ox = Bs.x[b] * 16 - game.W / 2, oy = Bs.y[b] * 16 - game.H / 2;
    Bs.draw(game, ctx, ox, oy);
    // (The west's rest is drawn in her taut pose, the others as they are staged.)
    const shown = Bs.pose(b), name = frameName(b, shown, Bs.face[b] < 0 ? 1 : 0), r = s.frames[name];
    check(shown === pose, `the ${NAMES[b]}'s lord staged ${what} is drawn as ${BOSS[b].poses[shown]}, not ${BOSS[b].poses[pose]}`);
    check(drawn.length === 1 && drawn[0][0] === s.image && r && drawn[0].slice(1).join() === r.slice(0, 4).join(), `the ${NAMES[b]}'s lord ${what} drew ${drawn.map(d => d.slice(1).join(',')).join(' ')}, not ${name} at ${r?.slice(0, 4).join(',')}`);
    Bs.glow(game, ctx, ox, oy);
    check(dots.n >= (s.eyes?.[name]?.length ?? 1), `the ${NAMES[b]}'s lord ${what} laid its glow on ${dots.n} of its ${s.eyes?.[name]?.length} eyes`);
  }
}

for (const f of fails) console.log(`FAIL ${f}`);
console.log(fails.length ? `${fails.length} failures` : `the lords' art keeps the creatures' rules (${Object.keys(s.frames).length} frames, ${grounds.reduce((n, g) => n + g.size, 0)} grounds about the lairs, ${compared} colours weighed) and the game draws it`);
process.exit(fails.length ? 1 : 0);
