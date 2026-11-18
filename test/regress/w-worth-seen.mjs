// What a thing of the lab's is worth, said where it is first met (js/game.js: `eyeOn`, `showEye`; js/drawing.js:
// `drawEye`). Run by itself this runs again once in each language (TETHERBORE_LANG), and each run holds:
//   - the first time in a game a cell of a thing of the second tier or the third comes into the drill's view (as the
//     drill comes into another cell, `look`), its worth comes up: its key, its picture, its name (what the lab's list
//     says before it is known, until it is), the line js/worth.js says (WORTH_AT at the winch's level, the same
//     string), the rim of its tier (TIER_RIM: silver, gold) and a ring from the cell in it; never twice in a game,
//     however many of its cells come into view after; never for a thing of the first tier (a common ore), nor
//     before the first haul;
//   - one at a time: what comes while one is up waits, three at the most, each shown as the last goes; what came
//     past those three is passed over and not taken as met, so it comes up when it is next seen; one cut meanwhile
//     is passed over; none is shown, nor its time run, under a panel, at the core (where the shop's button is) or
//     while the drill lies dead, and what waited then is not met;
//   - where the cell's ground pays more than the thing's own, how much more: steel in the magma HERE x2, a crystal
//     in a kilnstone cross HERE +25%, sunstone in the south's own ground nothing;
//   - a game saved before the world said worth takes every thing its lab has analysed as met, and only those; a
//     game saved since keeps what it had met; and a trip lost keeps what was met on it;
//   - every thing of the lab's of the second tier or the third at any level of the winch, known or not, with or
//     without a ground that pays more, laid out on the narrowest phones (160 x 284, 180 x 320) within the screen
//     and over the bar, clear of the lowest the drill can be drawn;
//   - the line a haul's banner says of what paid most in it (js/game.js: `topPayer`), for each such thing, 999 cells
//     of it, known or not, at home or not, laid under the gems where it fits the narrowest phones, dropped where not;
//   - drawing it for six hundred frames, and looking over cells come into view whose things have been met, makes
//     nothing (the heap, gc'd, grows by less than 20 KB in the least of five rounds).
// Each fails on the code before, which shows no worth in the world.
//   node test/regress/w-worth-seen.mjs
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import v8 from 'node:v8';
import vm from 'node:vm';

const here = fileURLToPath(import.meta.url), asked = process.env.TETHERBORE_LANG;
if (!asked) {
  let failed = 0;
  for (const id of ['en', 'ru', 'zh']) {
    const run = spawnSync(process.execPath, [here], { env: { ...process.env, TETHERBORE_LANG: id }, encoding: 'utf8' });
    process.stdout.write(run.stdout); process.stderr.write(run.stderr);
    if (run.status !== 0) failed++;
  }
  console.log(failed ? `DEFECT: ${failed} of 3 languages failed` : 'ok: a thing of the lab\'s says its worth once a game where it is first seen, one at a time, from worth.js, within the narrowest phones, in every language');
  process.exit(failed ? 1 : 0);
}

v8.setFlagsFromString('--expose_gc');
const gc = vm.runInNewContext('gc');
const { makeGame, world, C, N, K, B } = await import('../harness.mjs');
const { LAB, LAB_OF } = await import('../../js/shop.js');
const { WORTH_AT } = await import('../../js/worth.js');
const { TIER_RIM, LAB_LIST } = await import('../../js/drawing.js');
const { textWidth } = await import('../../js/atlas.js');
const { BIOMES } = world;

const fails = [], check = (ok, what) => { if (!ok && fails.length < 40) fails.push(`[${asked}] ${what}`); };
const rowNamed = name => BIOMES.find(r => r?.name === name);
const SUN = 'ember-items:oreB', SPAR = 'frost-items:oreB', GLOW = 'mire-items:oreB', STEEL = 'ember-items:steel', KEYK = 'finds:key', CINDER = 'ember-items:oreA', BELL = 'bell-items:hazard';

// A game with a corridor run east from the core along its row, the ground either side of it plain rock of the
// south's ground, so that nothing of the world's own comes into view; the drill stands in it at `x` cells east.
async function staged(hauls = 1) {
  const game = await makeGame(7, { tether: 3 }), w = game.world;
  game.S.stats.hauls = hauls;
  for (let v = -6; v <= 6; v++) for (let u = 2; u <= 70; u++) { const i = (C + v) * N + C + u; w.setK(i, v ? K.SOFT : K.EMPTY); w.setB(i, B.EMBER); }
  const d = game.drill;
  const to = x => { d.x = d.px = C + x + 0.5; d.y = d.py = C + 0.5; d.vx = d.vy = 0; game.look(); };
  const plant = (x, y, k, b = B.EMBER) => { const i = (C + y) * N + C + x; w.setK(i, k); w.setB(i, b); return i; };
  return { game, w, to, plant };
}
const frames = (game, seconds) => { for (let f = 0; f < Math.round(seconds * 60); f++) game.update(1 / 60); };

// ---- first sight: once a game, of the second tier and the third, after the first haul
{
  const { game, to, plant } = await staged(), S = game.S;
  const sun = plant(14, 2, K.ORE_B), cinder = plant(16, -2, K.ORE_A);
  to(10);
  check(!game.eye && !game.eyeQueue.length, `sunstone 4 cells off, past the scan of 3, was shown: ${JSON.stringify(game.eye?.key ?? game.eyeQueue)}`);
  to(11);
  check(game.eyeQueue.length === 1 && game.eyeQueue[0].key === SUN, `sunstone come into view did not wait its turn: ${JSON.stringify(game.eyeQueue)}`);
  game.rings.length = 0;
  frames(game, 1 / 60);
  const e = game.eye, worth = WORTH_AT[0][SUN], i = LAB.indexOf(LAB_OF[SUN]);
  check(e && e.key === SUN && S.eyed[SUN] === 1, `sunstone seen was not shown and met: ${JSON.stringify(e && e.key)} ${JSON.stringify(S.eyed)}`);
  check(e && e.said === worth.said && e.said === 'WORTH x4 ROCK, +5 GEMS', `sunstone's worth said '${e?.said}', worth.js '${worth.said}'`);
  check(e && e.rim === TIER_RIM[2] && e.tier === 2 && e.rim === '#9cc4f0', `sunstone's rim is ${e?.rim}, not the second tier's silver`);
  check(e && e.name === LAB_LIST.line[i].label && e.sheet === LAB_LIST.line[i].sheet && e.frame === LAB_LIST.line[i].frame, `sunstone not yet analysed is called '${e?.name}', not what the lab's list says, '${LAB_LIST.line[i].label}'`);
  check(e && !e.tag, `sunstone in the south's own ground says ${e?.tag}`);
  const ring = game.rings.find(r => r.color === TIER_RIM[2]);
  check(ring && Math.abs(ring.x / 16 - (C + 14.5)) < 0.01 && Math.abs(ring.y / 16 - (C + 2.5)) < 0.01, 'no ring of the tier\'s colour from the cell of sunstone');
  // (Cinder ore, the south's common ore, of the first tier, came into view with it and is never shown.)
  to(12); to(13); to(14);
  check(game.eyeQueue.length === 0 && !S.eyed[CINDER] && worth.tier === 2 && WORTH_AT[0][CINDER].tier === 1, `cinder ore, the first tier, waits or was met: ${JSON.stringify(game.eyeQueue)}`);
  // A second cell of sunstone, after the first has gone: nothing.
  frames(game, 4);
  check(!game.eye, 'sunstone\'s worth was still up four seconds on');
  plant(21, 1, K.ORE_B); to(18);
  frames(game, 0.1);
  check(!game.eye && !game.eyeQueue.length, `sunstone was shown again: ${game.eye?.key}`);
  void sun; void cinder;
}

// ---- not before the first haul
{
  const { game, to, plant } = await staged(0);
  plant(14, 1, K.ORE_B); to(10); to(11); frames(game, 0.1);
  check(!game.eye && !game.eyeQueue.length && !game.S.eyed[SUN], 'sunstone was shown before the first haul');
}

// ---- one at a time, three waiting at the most; what is passed over comes again; known by name; gold for the third
{
  const { game, to, plant } = await staged(), S = game.S;
  S.lab[SPAR] = 2;
  const col = 14;
  plant(col, -3, K.ORE_B, B.FROST); plant(col, -2, K.ORE_B); plant(col, -1, K.ORE_B, B.MIRE); plant(col, 1, K.STEEL); plant(col, 2, K.KEY); plant(col, 3, K.RARE, B.FROST);
  to(10); to(11);
  check(game.eyeQueue.length === 3, `six things seen at once: ${game.eyeQueue.length} wait, not three`);
  const waiting = game.eyeQueue.map(q => q.key);
  frames(game, 1 / 60);
  const first = game.eye?.key;
  check(first === waiting[0] && game.eyeQueue.length === 2, `the first waiting is not the one shown: ${first}, ${JSON.stringify(waiting)}`);
  frames(game, 1);
  check(game.eye?.key === first, 'the next came while one was up');
  // Under a panel nothing runs.
  game.shop = true; const t = game.eye.t; frames(game, 5); game.shop = false;
  check(game.eye?.key === first && game.eye.t === t, `under the shop the worth ran on or went: ${game.eye?.key} ${game.eye?.t} ${t}`);
  const shown = [first];
  for (let n = 0; n < 2; n++) { frames(game, 3.7); shown.push(game.eye?.key); }
  check(JSON.stringify(shown) === JSON.stringify(waiting), `shown in turn ${JSON.stringify(shown)}, waiting were ${JSON.stringify(waiting)}`);
  const passed = [SPAR, SUN, GLOW, STEEL, KEYK, BELL].filter(k => !waiting.includes(k));
  check(passed.length === 3 && passed.every(k => !S.eyed[k]), `what came past the three is taken as met: ${JSON.stringify(passed.map(k => [k, S.eyed[k]]))}`);
  // Seen again (the drill back out of view of them and in again), they come up.
  frames(game, 4); to(6); to(11);
  check(game.eyeQueue.length === 3 && game.eyeQueue.every(q => passed.includes(q.key)), `passed over and seen again: ${JSON.stringify(game.eyeQueue.map(q => q.key))}`);
  let saw = [];
  for (let n = 0; n < 3; n++) { frames(game, n ? 3.7 : 1 / 60); saw.push(game.eye); }
  const spar = saw.find(e => e?.key === SPAR) ?? (waiting.includes(SPAR) ? null : undefined), bell = saw.find(e => e?.key === BELL);
  if (spar) check(spar.name === LAB_OF[SPAR].name, `aurora spar, analysed, is called '${spar.name}'`);
  check(bell && bell.rim === TIER_RIM[3] && bell.rim === '#ffcc40' && bell.said === WORTH_AT[0][BELL].said, `a rime bell: ${JSON.stringify(bell && [bell.rim, bell.said])}`);
  check([SPAR, SUN, GLOW, STEEL, KEYK, BELL].every(k => S.eyed[k] === 1), `not every thing met: ${JSON.stringify(S.eyed)}`);
  // One cut while it waited is passed over, and not met.
  const g2 = (await staged()), cell = g2.plant(14, 2, K.ORE_B), cell2 = g2.plant(14, -2, K.KEY);
  g2.game.eyeQueue.length = 0; g2.to(10); g2.to(11);
  g2.w.setK(cell, K.EMPTY);
  g2.game.update(1 / 60);
  check(g2.game.eye?.key === KEYK && !g2.game.S.eyed[SUN], `a cell of sunstone cut while it waited: ${g2.game.eye?.key}, ${JSON.stringify(g2.game.S.eyed)}`);
  void cell2;
}

// ---- how much more the ground pays where it is seen
{
  const { game, to, plant } = await staged();
  plant(14, 1, K.STEEL, rowNamed('magma').id);
  to(10); to(11); frames(game, 1 / 60);
  check(game.eye?.key === STEEL && game.eye.tag === 'HERE x2', `steel in the magma: ${game.eye?.key} '${game.eye?.tag}'`);
  frames(game, 4);
  const kiln = rowNamed('kilnstone'), i = plant(19, 1, K.HAZARD, kiln.id), key = game.sampleOf(K.HAZARD, kiln, i);
  to(16); frames(game, 1 / 60);
  check(game.eye?.key === key && key === 'lode-items:hazard' && game.eye.tag === 'HERE +25%', `a spark crystal in a kilnstone cross: ${game.eye?.key} '${game.eye?.tag}'`);
}

// ---- at the core, where the shop's button is, it waits, and is not drawn
{
  const { game, to, plant } = await staged();
  plant(14, 1, K.ORE_B); to(10); to(11); frames(game, 1 / 60);
  const t = game.eye?.t;
  Object.defineProperty(game, 'atCore', { configurable: true, get: () => true });
  frames(game, 5);
  check(game.eye?.key === SUN && game.eye.t === t, `at the core sunstone's worth ran on or went: ${game.eye?.key} ${game.eye?.t} ${t}`);
  game.drawHud(0, 0);
  check(game.eye && !game.panels.includes(game.eye.rect), 'sunstone\'s worth was drawn at the core');
  delete game.atCore;
}

// ---- while the drill lies dead nothing comes up, runs or is drawn, and what waited is not met
{
  const { game, to, plant } = await staged(), S = game.S;
  plant(14, 1, K.ORE_B); plant(14, -1, K.STEEL); to(10); to(11); frames(game, 1 / 60);
  const up = game.eye?.key, next = game.eyeQueue[0]?.key;
  check([up, next].sort().join() === [STEEL, SUN].sort().join() && game.eyeQueue.length === 1, `sunstone and steel, one up and one waiting: ${up} ${JSON.stringify(game.eyeQueue)}`);
  frames(game, 3); game.wreck();
  const t = game.eye?.t;
  frames(game, 1.1);
  check(game.drill.mode === 'dead' && game.eye?.key === up && game.eye.t === t && game.eyeQueue.length === 1 && !S.eyed[next], `the hull gone, ${up}'s worth ran on (${t} to ${game.eye?.t}) or ${next} came up or was met: ${game.eye?.key} ${JSON.stringify(game.eyeQueue)} ${JSON.stringify(S.eyed)}`);
  game.drawHud(0, 0);
  check(game.eye && !game.panels.includes(game.eye.rect), 'a worth was drawn over the wreck');
}

// ---- saved games
{
  const { game } = await staged();
  game.S.lab = { [SUN]: 3, [CINDER]: 0, [STEEL]: 1 }; game.S.eyed = { [GLOW]: 1 };
  game.save();
  const again = await makeGame(7);
  check(await again.restore(), 'a game saved with what it had met did not load');
  check(JSON.stringify(again.S.eyed) === JSON.stringify({ [GLOW]: 1 }), `a game saved since keeps ${JSON.stringify(again.S.eyed)}`);
  const old = JSON.parse(localStorage.getItem('tetherbore-save-v3'));
  delete old.eyed; old.rev = (old.rev ?? 0) + 5;
  localStorage.setItem('tetherbore-save-v3', JSON.stringify(old)); localStorage.setItem('tetherbore-save-v3-latest', JSON.stringify(old));
  const older = await makeGame(7);
  check(await older.restore(), 'a game saved before worth was said did not load');
  check(JSON.stringify(older.S.eyed) === JSON.stringify({ [SUN]: 1, [STEEL]: 1 }), `an older game's things analysed are not what it has met: ${JSON.stringify(older.S.eyed)}`);
  // A trip lost keeps what was met on it.
  const trip = await staged(), tg = trip.game;
  tg.dockMark(); trip.plant(14, 1, K.ORE_B); trip.to(10); trip.to(11); frames(tg, 1 / 60);
  check(tg.S.eyed[SUN] === 1, 'sunstone was not met on the trip');
  tg.revert();
  check(tg.S.eyed[SUN] === 1, 'the trip lost took back what was met on it');
}

// ---- laid out on the narrowest phones, over the bar and clear of the drill
{
  const game = await makeGame(7), S = game.S;
  const things = [];
  for (const e of LAB) for (let lv = 0; lv < WORTH_AT.length; lv++) {
    const w = WORTH_AT[lv][e.key];
    if (!w || w.tier < 2) continue;
    const line = LAB_LIST.line[LAB.indexOf(e)];
    for (const name of [e.name, line.label]) for (const tag of [null, 'HERE x2', 'HERE +80%']) things.push({ key: e.key, name, said: w.said, tag, rim: TIER_RIM[w.tier], sheet: line.sheet, frame: line.frame, t: 1, life: 3.6, W: 0, rect: [0, 0, 0, 0] });
  }
  let widest = 0, tall = 0;
  for (const [cw, ch] of [[160, 284], [180, 320]]) {
    game.resize(cw, ch, 1);
    // (The drill is drawn no lower than three tenths of the screen's narrower side under the middle of the view, the
    // most the view lags it by, and half its size.)
    const { W, H } = game, bar = H - 44, drill = (H - 44) / 2 + 0.3 * Math.min(W, H) + 12;
    for (const e of things) {
      game.eye = e; e.W = 0; game.panels.length = 0;
      game.drawEye();
      const [x, y, w, h] = e.rect;
      widest = Math.max(widest, w); tall = Math.max(tall, h);
      // (Its chip and name, its worth, and its tag each four in from the frame either side, the tag eight clear of
      // what is before it on its line.)
      const l1 = 24 + textWidth(e.name) + (e.tagAt === 1 ? textWidth(e.tag) + 8 : 0), l2 = 8 + textWidth(e.said) + (e.tagAt === 2 ? textWidth(e.tag) + 8 : 0);
      check(x >= 4 && x + w <= W - 4 && Math.max(l1, l2, e.tagAt === 3 ? textWidth(e.tag) + 8 : 0) <= w, `${e.key} '${e.name}' '${e.said}' ${e.tag} is ${Math.max(l1, l2)} wide in a panel of ${w} at ${x}, on a screen ${W} wide`);
      check(y + h === bar - 2 && h === (e.tagAt === 3 ? 42 : 32) && y > drill && game.panels.includes(e.rect), `${e.key} lies from ${y} to ${y + h} on a screen ${H} tall: the drill comes down to ${drill}, the bar begins at ${bar}`);
    }
  }
  check(widest > 100 && tall >= 30, `the panels were never laid out: ${widest} wide, ${tall} tall at the most`);
  // (The tag beside the name somewhere, and on a line of its own somewhere else: each laid out at least once in English.)
  if (asked === 'en') check(things.some(e => e.tagAt === 1) && things.some(e => e.tagAt === 3), `the tag was never laid beside the name, or on a line of its own: ${[...new Set(things.map(e => e.tagAt))]}`);
}

// ---- a haul's banner: the line of what paid most, of every thing of the second tier or the third at any level of
// the winch, known or not, 999 cells of it, at home or not, laid under the gems where it fits the narrowest phones
// and dropped where it does not (js/game.js: `topPayer`; js/drawing.js: `bannerSplit`)
{
  const game = await makeGame(7), S = game.S;
  let laid = 0, dropped = 0;
  for (const [cw, ch] of [[160, 284], [180, 320]]) {
    game.resize(cw, ch, 1);
    for (const e of LAB) for (let lv = 0; lv < WORTH_AT.length; lv++) for (const known of [0, 1]) for (const topHome of [false, true]) {
      S.lv.winch = lv; S.lab = known ? { [e.key]: 1 } : {};
      const top = game.topPayer({ top: e.key, topN: 999, topHome });
      if (!top) { check(WORTH_AT[lv][e.key].tier < 2, `${e.key} of the tier ${WORTH_AT[lv][e.key].tier} at the winch's ${lv} names nothing`); continue; }
      const b = { n: 40, grit: 99999, gems: [0, 0, 0, 0, 9999, 0, 0, 0, 0], trophy: false, shine: 1, top, splitW: 0 };
      game.bannerSplit(b, '+9');
      check(b.topAt ? b.topW <= game.W - 8 && b.topW === textWidth(top.said) + 16 : b.topW > game.W - 8, `'${top.said}' is ${b.topW} wide on a screen ${game.W} wide, ${b.topAt ? 'laid' : 'dropped'}`);
      if (b.topAt) laid++; else dropped++;
    }
  }
  S.lv.winch = 0;
  check(laid > dropped * 4, `of the lines of what paid most ${laid} were laid and ${dropped} dropped`);
  if (dropped) console.log(`[${asked}] ${dropped} lines of what paid most of ${laid + dropped} too wide for the narrowest phones, dropped`);
}

// ---- nothing made in a frame: drawn for six hundred frames, and cells met before looked over
{
  const { game, to, plant, w } = await staged();
  plant(14, 1, K.ORE_B); to(10); to(11); frames(game, 1 / 60);
  const ctx = { globalAlpha: 1, fillStyle: '', drawImage() {}, fillRect() {}, clearRect() {} };
  game.ctx = ctx; game.resize(160, 284, 1); game.ctx = ctx;
  for (let n = 0; n < 40; n++) plant(20 + n, (n % 9) - 4, n % 2 ? K.ORE_B : K.ORE_A);
  const cells = [];
  for (let n = 0; n < 40; n++) for (let v = -4; v <= 4; v++) cells.push((C + v) * N + C + 20 + n);
  const round = () => { for (let f = 0; f < 600; f++) { game.panels.length = 0; game.eye.t = 1; game.drawEye(); for (let c = 0; c < 4; c++) game.eyeOn(cells[(f * 4 + c) % cells.length]); } };
  // (Rounds first to warm it, then the least the heap grew in any of five: code the engine optimises while a round
  // runs is kept on the heap too, and comes when it comes, sooner or later as the machine is loaded; a frame that
  // made what it kept would grow the heap in every round alike.)
  for (let r = 0; r < 3; r++) round();
  let grew = Infinity;
  for (let r = 0; r < 5; r++) { gc(); const before = process.memoryUsage().heapUsed; round(); gc(); grew = Math.min(grew, process.memoryUsage().heapUsed - before); }
  console.log(`[${asked}] the heap grew by ${grew} bytes`);
  check(game.eyeQueue.length === 0 && grew < 20 * 1024, `six hundred frames of the worth up and cells met before looked over grew the heap by ${grew} bytes (${game.eyeQueue.length} waiting)`);
  void w;
}

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : `ok [${asked}]: first sight says worth.js's line once a game, one at a time, in its tier's rim, within 160 x 284 and 180 x 320, making nothing in a frame`);
process.exit(fails.length ? 1 : 0);
