// The achievements (js/achievements.js), earned as the game earns them.
//   node test/regress/z-ach-earn.mjs
// Held here:
//   - every achievement on the list is earned by a thing done through the game's own methods: real hauls of real cells,
//     flights into the ground, purchases, samples, the creatures' deeds, a drill wrecked, and each lord fought and beaten
//     by its own verb (lib/lords.mjs);
//   - none fires twice, whatever asks again, and a platform is told each once;
//   - none is lost: not by a trip lost (which puts the state back), NEW WORLD, a save and reload, or a lord's kill that
//     never got home; and a save with none earned has no `ach` field at all;
//   - a save made before there were achievements is credited with what its state proves and nothing else, with one word;
//   - what asks for one of every kind can be had on any world;
//   - the watcher changes nothing: a flight with it and one without, on one stream of Math.random, drawn every frame and
//     with medals earned along the way, are the same frame by frame.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { makeGame, farStart, wander, random, rubbleHash, C, N, K, B, world, UPGRADES } from '../harness.mjs';
import { ACHIEVEMENTS, POCKET_KINDS, RARE_KINDS, LORD_IDS } from '../../js/achievements.js';
import { LAB, REACH } from '../../js/shop.js';
import { atLair, beat, LORDS } from './lib/lords.mjs';

const problems = [], note = text => { if (problems.length < 30) problems.push(text); };
const { World, rowOf, SEAMS, FIND } = world;
const at = (x, y) => (C + y) * N + C + x;
const told = [];
globalThis.tetherboreDesktop = { achievements: { unlock: id => { told.push(id); return Promise.resolve(); }, sync: () => Promise.resolve() } };
const wipe = () => { for (const k of ['tetherbore-save-v3', 'tetherbore-save-v3-latest']) localStorage.removeItem(k); };
const fresh = (seed = 7, levels = {}, options = {}) => makeGame(seed, levels, { ach: true, hull: true, ...options });
// A block of `w` by `h` cells of a kind, a little way from the core, hauled.
const block = (g, w, h, kind = K.SOFT, biome = B.CRUST, x0 = 20, y0 = 20) => {
  const cells = [];
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const i = at(x, y); g.world.setK(i, kind); g.world.setB?.(i, biome); cells.push(i); }
  return cells;
};
const haul = (g, ...args) => g.haul(block(g, ...args));
const frames = (g, n) => { for (let f = 0; f < n; f++) g.update(1 / 60); };
// Into the ground at (x, y): the drill set down there and told it has come in (`arrive`, as a step into the cell does).
const flyTo = (g, x, y) => { g.S.lv.tether = 5; farStart(g, x, y); g.arrive(g.di); frames(g, 70); };
// Where each thing lies on a world, found by asking it.
const ground = (w, test, reach = 1200, step = 6) => {
  for (let r = 40; r < reach; r += step) for (let a = 0; a < 48; a++) {
    const x = Math.round(Math.cos(a / 48 * 2 * Math.PI) * r), y = Math.round(Math.sin(a / 48 * 2 * Math.PI) * r);
    if (test(rowOf(w.biomeAt(C + x, C + y)))) return [x, y];
  }
  return null;
};
const arrive = (g, x, y) => { g.placeKey = null; g.arrive(at(x, y)); g.ach.check(g); };
const pocketAt = (g, name) => ground(g.world, row => row?.pocket && row.name === name);
const buyFor = (g, u) => { g.S.grit = 1e12; g.S.out = 1e4; g.S.relics = [1, 1, 1, 1]; g.S.wrecks = [1, 1, 1, 1, 1, 1, 1, 1]; for (let b = 0; b < g.S.gems.length; b++) g.S.gems[b] = 1e9; g.S.spec = [0, 1e6, 1e6, 1e6, 1e6]; g.S.met ??= {}; g.buy(u); };
const tether = UPGRADES.find(u => u.id === 'tether');

const ACTS = {
  ACH_FIRST_HAUL: g => haul(g, 3, 1),
  ACH_BIG_HAUL: g => haul(g, 6, 5),
  ACH_HUGE_HAUL: g => haul(g, 15, 10),
  ACH_COLOSSAL_HAUL: g => haul(g, 25, 22),
  ACH_MOUNTAINOUS: g => haul(g, 40, 25),
  // (Half of everything: a loop round nine tenths of HALF, and a real haul of two fifths of it.)
  ACH_HALF_WORLD: async g => {
    const { HALF } = await import('../../js/game.js'), side = Math.ceil(Math.sqrt(HALF * 0.41)), cells = [];
    for (let y = -side >> 1; y < side >> 1; y++) for (let x = -side >> 1; x < side >> 1; x++) if (Math.abs(x) > 3 || Math.abs(y) > 3) cells.push(at(x, y));
    for (const i of cells) if (g.world.k(i) === K.EMPTY) g.world.setK(i, K.SOFT);
    g.haul(cells, HALF);
  },
  ACH_CLUTCH: g => { g.dents = g.val('hull') - 1; haul(g, 10, 8); },
  ACH_MOTHER_LODE: g => haul(g, 6, 5, K.ORE_A),
  ACH_HOT_POTATO: g => haul(g, 3, 1, K.HAZARD, B.EMBER),
  ACH_WINCH_CRYING: g => haul(g, 40, 40),
  ACH_HULL_GONE: g => { for (let n = 0; n < 40 && g.drill.mode !== 'dead'; n++) { g.shield = 0; g.hit(0.1); } frames(g, 100); },
  ACH_NORTH: g => flyTo(g, 0, -200), ACH_SOUTH: g => flyTo(g, 0, 200), ACH_WEST: g => flyTo(g, -200, 0), ACH_EAST: g => flyTo(g, 200, 0),
  ACH_LONG_WAY: g => { g.S.lv.tether = 8; farStart(g, 1005, 0); frames(g, 70); },
  ACH_FIRST_POCKET: g => { const [x, y] = pocketAt(g, 'hive'); arrive(g, x, y); },
  ACH_ALL_POCKETS: g => { for (const name of POCKET_KINDS) { const p = pocketAt(g, name); if (!p) note(`no ${name} found`); else arrive(g, ...p); } },
  ACH_FOUR_SEAMS: g => { for (const [a] of SEAMS) { const p = ground(g.world, row => row?.id === a); if (!p) note(`no seam ${a} found`); else arrive(g, ...p); } },
  ACH_WRECK_PART: g => { const [x, y] = g.world.wrecks[0], i = y * N + x; g.world.setK(i, K.WRECK); g.haul([i]); },
  ACH_FIRST_RELIC: g => { const i = g.world.relicAt[0]; g.world.setK(i, K.RELIC); g.haul([i]); },
  ACH_ALL_RELICS: g => { for (const i of g.world.relicAt) { g.world.setK(i, K.RELIC); g.haul([i]); } },
  ACH_FIRST_SHRINE: g => { const i = g.world.shrineAt[0]; g.world.setK(i, K.RELIC); g.haul([i]); },
  // (A fossil as the world laid it: every bone, found by the sector it lies in.)
  ACH_FOSSIL: g => {
    const w = g.world, F = World.findRecord();
    for (let sy = -40; sy <= 40; sy++) for (let sx = -40; sx <= 40; sx++) {
      F.n = 0; w.find(sx, sy, F);
      if (!F.laid || !F.n) continue;
      const bones = [];
      for (let k = 0; k < F.n; k++) { const i = (F.fy + F.by[k]) * N + F.fx + F.bx[k]; if (w.k(i) === K.FOSSIL) bones.push(i); }
      if (bones.length === F.n) { g.haul(bones); return; }
    }
    note('no fossil found whole');
  },
  ACH_CAUGHT_LIVE: g => { const cells = block(g, 1, 1, K.RARE, B.MIRE); g.worms.set(cells[0], { t: 9 }); g.haul(cells); g.worms.clear(); },
  ACH_ALL_RARES: g => { for (const what of RARE_KINDS) { const c = at(22 + RARE_KINDS.indexOf(what) * 40, 22); g.world.setK(c, K.SOFT); g.world.spotted.push([what, c, c]); g.callOut(); } g.ach.check(g); },
  ACH_PAL: g => { g.fauna.deed(g, 'befriend'); frames(g, 70); },
  ACH_EVICTED: g => { g.fauna.deed(g, 'catch', 0); },
  ACH_FIRST_UPGRADE: g => buyFor(g, tether),
  ACH_STARLINE: g => { g.S.lv.tether = REACH.length - 2; buyFor(g, tether); },
  ACH_LAB_36: g => { for (const e of LAB.slice(0, 36)) g.analyse(e.key, C, C, false); frames(g, 70); },
};

// 1. Each, on a game of its own, by what earns it; asked again, it is not earned again.
for (const a of ACHIEVEMENTS) {
  if (LORD_IDS.includes(a.id) || a.id === 'ACH_ALL_LORDS') continue;
  const act = ACTS[a.id];
  if (!act) { note(`${a.id} has no act in this test`); continue; }
  wipe();
  const g = await fresh();
  if (g.ach.earned.has(a.id)) note(`${a.id} was earned by a new game`);
  told.length = 0;
  await act(g);
  frames(g, 2);
  if (!g.ach.earned.has(a.id)) { note(`${a.id} was not earned by what earns it`); continue; }
  g.ach.earn(a.id); g.ach.check(g); frames(g, 70);
  const times = told.filter(id => id === a.id).length;
  if (times !== 1) note(`${a.id} told ${times} times`);
  const queued = g.ach.queue.filter(q => q.name === a.name).length;
  if (queued > 1) note(`${a.id} queued ${queued} words`);
}
for (const id of Object.keys(ACTS)) if (!ACHIEVEMENTS.some(a => a.id === id)) note(`the test acts for ${id}, not on the list`);
if (new Set(ACHIEVEMENTS.map(a => a.id)).size !== ACHIEVEMENTS.length) note('two achievements share a name');
if (ACHIEVEMENTS.length < 30 || ACHIEVEMENTS.length > 40) note(`${ACHIEVEMENTS.length} achievements`);

// 2. Each lord by its own verb, each game carrying what the last earned, and all four then earned.
let carried = [];
for (const b of LORDS) {
  const id = LORD_IDS[b], game = await atLair(b, { levels: { hull: 4 }, first: g => { g.ach.off = false; g.ach.load(carried, g.S); } });
  if (game.ach.earned.has(id)) note(`${id} earned before the fight`);
  if (!beat(game, b)) { note(`lord ${b} was not beaten`); continue; }
  if (!game.ach.earned.has(id)) note(`${id} not earned by beating it`);
  // (Kept though the kill goes back: the trip is lost on the way home.)
  for (let n = 0; n < 40 && game.drill.mode !== 'dead'; n++) { game.shield = 0; game.hit(0.1); }
  frames(game, 100);
  if ((game.S.bosses ?? 0) >> (4 + b) & 1) note(`lord ${b}'s kill was kept with the trip lost`);
  if (!game.ach.earned.has(id)) note(`${id} lost with the trip`);
  carried = [...game.ach.earned];
}
if (!carried.includes('ACH_ALL_LORDS')) note('all four lords beaten did not earn ACH_ALL_LORDS');

// 3. Kept: through NEW WORLD, a save and a reload; and no field at all in a save with none.
{
  wipe();
  const g = await fresh();
  g.save();
  if ('ach' in JSON.parse(localStorage.getItem('tetherbore-save-v3'))) note('a save with nothing earned has an ach field');
  haul(g, 6, 5); frames(g, 3);
  const had = [...g.ach.earned].sort().join();
  g.fresh(99, true); g.save();
  if ([...g.ach.earned].sort().join() !== had) note('NEW WORLD changed what is earned');
  if ('ach' in g.S) note('the medals are in the game state');
  const back = await fresh(5);
  if (!(await back.restore())) note('the save did not load');
  if ([...back.ach.earned].sort().join() !== had) note(`lost on reload: ${had} became ${[...back.ach.earned].sort().join()}`);
  if ('ach' in back.S) note('a loaded game has ach in its state');
  told.length = 0; frames(back, 2); back.ach.earn('ACH_FIRST_HAUL'); frames(back, 2);
  if (told.includes('ACH_FIRST_HAUL')) note('an achievement fired again after a reload');
}

// 4. A save from before: credited with what it proves, and one word for all of it.
{
  wipe();
  const maker = await fresh();
  maker.ach.off = true;
  Object.assign(maker.S, { relics: [1, 1, 1, 1], out: 1400, fossils: 3, bosses: (1 << 4) | 1, rare: Object.fromEntries(RARE_KINDS.map(k => [k, 1])), shrines: [0, 1, 0, 0] });
  maker.S.stats.hauls = 12; maker.S.stats.best = 600; maker.S.stats.buys = 3; maker.S.wrecks[2] = 1; maker.S.fauna = { pal: { kind: 'pup', at: 5 }, met: {}, spent: [] };
  for (const [a] of SEAMS) maker.S.met[a] = 1;
  maker.save();
  const old = JSON.parse(localStorage.getItem('tetherbore-save-v3'));
  if ('ach' in old) note('the stand-in old save has an ach field');
  const g = await fresh(5);
  await g.restore();
  for (const id of ['ACH_FIRST_HAUL', 'ACH_BIG_HAUL', 'ACH_HUGE_HAUL', 'ACH_COLOSSAL_HAUL', 'ACH_ALL_RELICS', 'ACH_FIRST_RELIC', 'ACH_LONG_WAY', 'ACH_FOSSIL', 'ACH_LORD_KING', 'ACH_ALL_RARES', 'ACH_FIRST_SHRINE', 'ACH_WRECK_PART', 'ACH_PAL', 'ACH_FOUR_SEAMS', 'ACH_FIRST_UPGRADE']) if (!g.ach.earned.has(id)) note(`an old save was not credited ${id}`);
  for (const id of ['ACH_MOUNTAINOUS', 'ACH_CLUTCH', 'ACH_HALF_WORLD', 'ACH_LORD_WYRM', 'ACH_ALL_LORDS', 'ACH_STARLINE', 'ACH_EVICTED', 'ACH_HULL_GONE']) if (g.ach.earned.has(id)) note(`an old save was credited ${id}, which it does not prove`);
  if (g.ach.queue.length !== 1 || !/FROM YOUR SAVE/.test(g.ach.queue[0].name)) note(`an old save's credit said ${JSON.stringify(g.ach.queue.map(q => q.name))}`);
  // The real one, from 4293f7c, loads and is credited its hauls.
  wipe();
  const real = JSON.parse(gunzipSync(readFileSync(new URL('../fixtures/save-4293f7c.json.gz', import.meta.url))));
  localStorage.setItem('tetherbore-save-v3', real.local);
  const h = await fresh(5);
  if (!(await h.restore())) note('the save of 4293f7c did not load');
  if ((h.S.stats?.hauls ?? 0) > 0 && !h.ach.earned.has('ACH_FIRST_HAUL')) note('the save of 4293f7c was not credited its first haul');
  frames(h, 3);
}

// 5. It changes nothing: two flights on one stream, drawn every frame, one with medals coming.
{
  const fly = async on => {
    wipe();
    const stream = random(4242), real = Math.random;
    let draws = 0;
    Math.random = () => { draws++; return stream(); };
    const g = await makeGame(7, { tether: 4, drill: 3 }, { ach: on, hull: true });
    farStart(g, 0, -120);
    const hash = rubbleHash(), turns = wander(random(9), 80), trail = [];
    let n = 0;
    for (const steer of turns) {
      g.input.auto = steer; g.update(1 / 60); g.render(); hash.add(g);
      if (n++ % 200 === 0) trail.push(`${g.drill.x},${g.drill.y},${g.S.grit},${g.version},${g.world.made}`);
      if (n === 300) haul(g, 8, 8, K.SOFT, B.CRUST, 40, -100);
      if (n > 1500) break;
    }
    Math.random = real;
    return { hash: hash.hex, draws, trail: trail.join(' '), saved: JSON.stringify(g.kept()), earned: g.ach.earned.size };
  };
  const off = await fly(false), on = await fly(true);
  if (!on.earned) note('the flight with medals earned none, and so holds nothing');
  if (off.hash !== on.hash) note(`the watcher moved the flight: ${off.hash} and ${on.hash}`);
  if (off.draws !== on.draws) note(`the watcher drew from Math.random: ${off.draws} and ${on.draws}`);
  if (off.trail !== on.trail) note('the watcher changed the drill, the grit or the ground');
  if (off.saved !== on.saved) note('the watcher changed what the game saves of itself');
}

// 6. What asks for one of every kind can be had on any world: every kind of pocket, every seam, a whole fossil, and the
// heralds of the rare hazards, on worlds the rest of the suite does not stage.
for (const seed of [1, 3, 11, 23, 42, 123456]) {
  const w = new World();
  w.reset(seed);
  for (const name of POCKET_KINDS) if (!ground(w, row => row?.pocket && row.name === name, 1400)) note(`world ${seed} has no ${name} within 1,400 cells`);
  for (const [a] of SEAMS) if (!ground(w, row => row?.id === a, 1200)) note(`world ${seed} has no seam ${a}`);
  const F = World.findRecord();
  let bones = 0;
  for (let sy = -44; sy <= 44 && !bones; sy++) for (let sx = -44; sx <= 44 && !bones; sx++) { F.n = 0; w.find(sx, sy, F); if (F.laid && F.n) bones = F.n; }
  if (!bones) note(`world ${seed} lays no fossil`);
}

if (problems.length) { console.log(`FAIL z-ach-earn:\n  ${problems.join('\n  ')}`); process.exit(1); }
console.log(`ok z-ach-earn: all ${ACHIEVEMENTS.length} earned by real events, none twice, none lost, old saves credited, and a flight with them the same as one without`);
