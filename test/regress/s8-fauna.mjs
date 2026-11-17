// The creatures of the ground (js/fauna.js) change nothing but by their deeds, keep to their bounds and their
// places, and look as the rules of their art say.
//   1. Two games side by side on one world and one stream of Math.random, flown by the fuzzes' steering in the
//      north's ground, the south's, the west's, the east's and a cross: one with its creatures left out (`off`),
//      the other with them tame (no deed is done) and a creature of every kind set down beside the drill in turn,
//      each foe woken at once, every frame drawn, and the trophy line bought in three of the five grounds (a foe at
//      rest the tether goes round is looped, and not caught). Frame by frame the two are the same: the drill, the
//      tether, the version of the ground, the game's particles, rings, effects, popups, shake and flash, the hull,
//      the grit, all that is saved, the draws from Math.random and the pieces of world made. And js/fauna.js never
//      names Math.random.
//   2. Its bounds: no more creatures than FAUNA, NAMED of them above kin, its particles and its arrays the same
//      ones made at first; what it looks at in a frame bounded; and a game begun again keeps nothing but the pal.
//   3. Its places, on worlds 1 to 4 out to 1,200 cells, from the seed alone: no den within CALM cells of the core;
//      no foe within FOE_FROM, in a pocket or in the home ground; each kind only in the grounds its roster gives it.
//   4. Its art, as built: every frame it draws is in the atlas, ringed in its outline; only a foe's frames have the
//      foe's eye colour in them, and only foes' eyes are written down as glowing; no colour of a creature is near a
//      colour of what pays or hurts in any ground it lives in; and the foe's eye colour is kept well away from all
//      of those, from every glow and mote of those grounds, and from every colour of the tether.
//   node test/regress/s8-fauna.mjs
import { readFile } from 'node:fs/promises';
import { makeGame, random, farStart, wander, C, N, K, world } from '../harness.mjs';
import { Fauna, CREATURES, ROSTER, KIN_FAUNA, faunaOf, FAUNA, NAMED, POOL, CALM, FOE_FROM, FOE_EYE, DEN, KIN, WORK, P, frameName } from '../../js/fauna.js';
import { FEELS } from '../../js/feel.js';
import { TETHERS } from '../../js/fit.js';
import { sheets } from '../../js/atlas.js';
import { HALOS } from '../../art/decor.mjs';
import { CREATURES_ART } from '../../art/fauna.mjs';
import { decodePNG } from '../../tools/png.mjs';
const { BIOMES, HAZARDS } = world;

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const KINDS = CREATURES.slice(1).map(c => c.key);

// ---- 1. nothing changes but by a deed
const source = await readFile(new URL('../../js/fauna.js', import.meta.url), 'utf8');
check(!/Math\.random/.test(source.replace(/\/\/.*$/gm, '')), 'js/fauna.js draws from Math.random');
let draws = 0, stream = null;
const plain = Math.random;
Math.random = () => { draws++; return stream(); };
const PLACES = [['frost', 60, -150], ['ember', 0, 150], ['mire', -150, 0], ['lode', 150, 0], ['buzzmire', -640, -640]];
const STAGE = [['bat', 'fuse'], ['spitter', 'puff'], ['leech', 'latched'], ['puff', 'caught'], ['wren', 'peck'], ['pup', 'pal'], ['moth', ''], ['beetle', ''], ['salamander', ''], ['frog', ''],
  ['skink', ''], ['bee', ''], ['jelly', ''], ['newt', '']];
// (In three of the grounds the trophy line is bought, so that a foe at rest the tether goes round is caught, but
// for its being tame; in the other two it is not, as in every game before it was in the shop.)
const TROPHY = new Set(['frost', 'ember', 'buzzmire']);
let staged = 0, biggest = 0, worst = 0, looped = 0;
for (const [name, x, y] of PLACES) {
  const games = [];
  for (let g = 0; g < 2; g++) {
    stream = random(41);
    const game = await makeGame(7, { tether: 9, drill: 3, trophy: TROPHY.has(name) ? 1 : 0 }, { fauna: true });
    farStart(game, x, y);
    game.own = random(4321);
    games.push(game);
  }
  const [a, b] = games;
  a.fauna.tame = true; b.fauna.off = true;
  // (Each time a foe at rest is looped and the trophy line would catch it, but that it is tame.)
  const catches = a.fauna.trophy;
  a.fauna.trophy = (...args) => { looped++; return catches.apply(a.fauna, args); };
  const arrays = ['kind', 'x', 'y', 'st', 'px', 'pk', 'spots', 'words', 'glowing'].map(k => a.fauna[k]);
  let frame = 0, differ = null, before = looped;
  for (const auto of wander(random(x * 3 + y), 16)) {
    const seen = [];
    for (const game of games) {
      stream = game.own; draws = 0;
      if (game === a && frame % 50 === 10) { const [kind, state] = STAGE[(frame / 50 | 0) % STAGE.length], i = a.fauna.stage(a, kind, 8); if (i >= 0) { staged++; if (state) a.fauna.stageAs(a, i, state); } }
      game.input.auto = auto;
      game.update(1 / 60);
      // (A foe at rest beside the drill, where the line is bought, has a loop of the tether put round it, and the
      // tether put back as it lay: tame, nothing comes of it.)
      if (game === a && TROPHY.has(name)) for (let j = 0; j < FAUNA; j++) if (a.fauna.kind[j] && !a.fauna.out[j] && a.fauna.atRest(j)) {
        const band = a.band, u = a.fauna.x[j], v = a.fauna.mid(j);
        a.band = [[u + 1.5, v + 0.5], [u + 1.5, v - 2], [u - 2, v - 2], [u - 2, v + 2], [u + 2.5, v + 2], [C + 0.5, C + 0.5]]; a.fauna.wound(a); a.band = band;
      }
      const d = game.drill, w = game.world;
      seen.push([d.x, d.y, d.vx, d.vy, d.mode, d.stun, game.version, JSON.stringify(game.band), game.parts.length, game.rings.length, game.effects.length, game.popups.length, game.shake, game.flash, game.dents, game.knocks, game.S.grit, JSON.stringify(game.S), draws, w.made].join());
      game.render();
    }
    biggest = Math.max(biggest, a.fauna.alive); worst = Math.max(worst, a.fauna.work);
    if (!differ && seen[0] !== seen[1]) differ = `${frame}:\n        tame: ${seen[0].slice(0, 300)}\n        none: ${seen[1].slice(0, 300)}`;
    check(a.fauna.alive <= FAUNA && a.fauna.named() <= NAMED, `in ${name} there were ${a.fauna.alive} creatures, ${a.fauna.named()} named`);
    frame++;
  }
  check(!differ, `in ${name} the game with its creatures tame went another way than the game with none, at frame ${differ}`);
  check(a.fauna.deeds === 0, `in ${name} a tame creature did a deed`);
  check(!TROPHY.has(name) || looped > before, `in ${name} no foe at rest was ever looped`);
  check(['kind', 'x', 'y', 'st', 'px', 'pk', 'spots', 'words', 'glowing'].every((k, n) => a.fauna[k] === arrays[n]), `in ${name} the creatures' arrays were made again`);
  check(a.fauna.pk.length === POOL && a.fauna.kind.length === FAUNA, 'the creatures\' pools are not the size they say');
  // Begun again: nothing is kept but the pal (which a tame game never makes).
  a.begin();
  check(a.fauna.alive === 0 && a.fauna.dens.size === 0 && a.fauna.latched < 0 && a.fauna.drag === 1, `in ${name} the creatures were not all gone when the game began again`);
}
Math.random = plain;
check(staged >= 40, `only ${staged} creatures were set down beside the drill`);
check(worst <= WORK * 3, `the creatures looked at ${worst} cells in one frame`);
// (The pal is set down again when a game begins, and nothing else.)
{
  const game = await makeGame(7, {}, { fauna: true });
  game.S.fauna = { pal: { kind: 'pup', at: 0 }, met: { pup: 1 }, spent: [] };
  game.begin();
  check(game.fauna.alive === 1 && game.fauna.pal >= 0, 'the pal was not set down again when the game began again');
}

// ---- 3. places, from the seed alone (no piece of the world is made for them)
const roster = Object.fromEntries(Object.entries(ROSTER).map(([g, r]) => [g, new Set([...(r.kin ?? []), ...(r.named ?? [])].map(([id]) => id))]));
let dens = 0, foes = 0;
const kinds = new Set();
for (let seed = 1; seed <= 4; seed++) {
  const game = await makeGame(seed), f = new Fauna(), w = game.world, made = w.made, R = 1200;
  f.reset(seed, null);
  for (const [grid, side] of [[0, DEN], [1, KIN]]) for (let sy = Math.floor(-R / side); sy <= R / side; sy += grid ? 3 : 1) for (let sx = Math.floor(-R / side); sx <= R / side; sx += grid ? 3 : 1) {
    const d = f.denOf(game, grid, sx, sy);
    if (!d) continue;
    dens++; kinds.add(d.kind);
    const far = Math.hypot(d.mx - C, d.my - C), row = BIOMES[d.row], c = CREATURES[d.kind];
    check(far >= CALM, `a den lies ${far.toFixed(0)} cells from the core`);
    const own = row.pocket ? roster[row.name] : row.cross ? new Set([...roster[KIN_FAUNA[row.cross.host]], ...(grid ? roster[KIN_FAUNA[row.cross.donor]] : [])]) : roster[row.name] ?? roster[KIN_FAUNA[row.kin]];
    check(own?.has(d.kind), `a ${c.key} lives in ${row.name}, which is not its ground`);
    if (c.tier === 'foe') { foes++; check(far >= FOE_FROM && !row.pocket && row.id !== 0, `a ${c.key} lives ${far.toFixed(0)} cells out in ${row.name}`); }
    if (f.dens.size > 80) { f.reset(seed, null); }
  }
  check(w.made === made, `world ${seed}: dens were laid by making ${w.made - made} pieces of the world`);
}
check(dens > 500 && foes > 20, `only ${dens} dens and ${foes} of foes on four worlds`);
check(kinds.size === CREATURES.length - 1, `the dens of four worlds hold only ${[...kinds].map(k => CREATURES[k].key).join(', ')}`);

// ---- 4. the art
const png = decodePNG(await readFile(new URL('../../assets/fauna.png', import.meta.url))), s = sheets.fauna;
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)), far = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const pixels = frame => {
  const [fx, fy, fw, fh] = s.frames[frame], out = [];
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) { const o = ((fy + y) * png.width + fx + x) * 4; if (png.data[o + 3]) out.push([x, y, png.data[o], png.data[o + 1], png.data[o + 2]]); }
  return out;
};
const eye = hex(FOE_EYE);
for (const [k, c] of CREATURES.entries()) {
  if (!c) continue;
  const poses = Object.keys(P[c.key]).length, art = CREATURES_ART[c.key], outline = hex({ home: '#1e1610', north: '#22395a', south: '#160c12', west: '#1c1426', east: '#3a2414', hive: '#201810', drift: '#0e1a30', grotto: '#06201e' }[art.outline]);
  for (let pose = 0; pose < poses; pose++) for (const left of [false, true]) {
    const name = frameName(k, pose, left);
    check(s.frames[name], `the atlas has no ${name}`);
    if (!s.frames[name]) continue;
    const px = pixels(name), at = new Set(px.map(([x, y]) => `${x},${y}`));
    // Ringed: every pixel at the edge of the shape is the outline's.
    const edge = px.filter(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([u, v]) => !at.has(`${x + u},${y + v}`)));
    check(edge.every(([, , r, g, b]) => far([r, g, b], outline) < 1), `${name} is not ringed in its outline`);
    const eyed = px.some(([, , r, g, b]) => far([r, g, b], eye) < 1);
    check(eyed === (c.tier === 'foe' && !!s.eyes?.[name]), `${name} ${eyed ? 'has' : 'has not'} the foe's eye colour, and it is ${c.tier === 'foe' ? 'a foe' : 'no foe'}`);
    check(!s.eyes?.[name] || c.tier === 'foe', `${name} has glowing eyes, and it is no foe`);
  }
}
// What pays or hurts in a ground: every colour of its ores, hazards, lava, steel and mineral that is a colour at all.
const shown = {};
const colours = async (sheet, frame) => {
  if (!sheets[sheet]?.frames[frame]) return [];
  const p = shown[sheet] ??= decodePNG(await readFile(new URL(`../../assets/${sheet}.png`, import.meta.url))), [fx, fy, fw, fh] = sheets[sheet].frames[frame], out = [];
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) { const o = ((fy + y) * p.width + fx + x) * 4; if (p.data[o + 3] && Math.max(p.data[o], p.data[o + 1], p.data[o + 2]) - Math.min(p.data[o], p.data[o + 1], p.data[o + 2]) >= 64) out.push([p.data[o], p.data[o + 1], p.data[o + 2]]); }
  return out;
};
const signals = async row => {
  const out = [];
  for (const [sheet, frame] of [[row.items, 'oreA'], [row.items, 'oreB'], [row.itemsB, 'oreB'], row.ores[0], row.ores[1]]) out.push(...await colours(sheet, frame));
  for (const haz of [row.haz, row.haz2, world.RARE[row.kin] && { type: world.RARE[row.kin] }]) if (haz) {
    const sheet = HAZARDS[haz.type].sheet;
    for (const frame of ['hazard', 'hazard-b']) out.push(...await colours(sheet, frame));
    if (haz.type === 'lava') { for (const frame of ['slag', 'steel', 'steel-glint']) out.push(...await colours(sheet, frame)); out.push(...await colours('lava', 'lava-255-a')); }
  }
  if (row.pocket) { out.push(...await colours('minerals', row.pocket.mineral)); out.push(...await colours('minerals', 'cap')); out.push(...await colours('minerals', 'cap-lit')); }
  return out;
};
// What else glows or drifts there: the halos of what grows in its caves, its motes, its fireflies; and the tether.
const glows = row => {
  const out = Object.values(HALOS).flatMap(h => [h.g, h.d, h.halo]).filter(Boolean).map(hex);
  if (row.mote) out.push(hex(row.mote[0]));
  const f = FEELS[row.name] ?? FEELS[KIN_FAUNA[row.kin]];
  if (f?.flies) out.push(hex(f.flies.color));
  return out;
};
const tether = TETHERS.flatMap(t => [t.a, t.b, t.glow, t.twin]).filter(Boolean).map(hex);
for (const [ground, list] of Object.entries(ROSTER)) {
  const row = BIOMES.find(r => r && r.name === ground), sig = await signals(row), lights = glows(row);
  for (const [id] of [...(list.kin ?? []), ...(list.named ?? [])]) {
    const c = CREATURES[id], palette = CREATURES_ART[c.key].palette;
    for (const [key, colour] of Object.entries(palette)) {
      const rgb = hex(colour);
      if (Math.max(...rgb) - Math.min(...rgb) < 64 || key === 'e') continue;
      for (const sg of sig) if (far(rgb, sg) < 48) { check(false, `the ${c.key}'s ${colour} is within ${far(rgb, sg).toFixed(0)} of ${sg}, a colour of what pays or hurts in ${ground}`); break; }
    }
    if (c.tier !== 'foe') continue;
    for (const sg of sig) if (far(eye, sg) < 72) { check(false, `the foe's eye is within ${far(eye, sg).toFixed(0)} of ${sg}, a colour of what pays or hurts in ${ground}`); break; }
    for (const gl of lights) if (far(eye, gl) < 72) { check(false, `the foe's eye is within ${far(eye, gl).toFixed(0)} of ${gl}, a glow or a mote of ${ground}`); break; }
  }
}
for (const t of tether) check(far(eye, t) >= 72, `the foe's eye is within ${far(eye, t).toFixed(0)} of ${t}, a colour of the tether`);

for (const f of fails) console.log(`FAIL ${f}`);
console.log(fails.length ? `${fails.length} failures` : `the creatures change nothing but by their deeds (${staged} set down, ${looped} looped at rest, at most ${biggest} at once, ${worst} cells looked at in a frame at the most), keep to their places (${dens} dens on four worlds) and to their art`);
process.exit(fails.length ? 1 : 0);
