// S3: what a haul is called, and the show it makes. Up to the giants a haul is called by its size, the ladder climbing
// slowly (COLOSSAL from 550 cells), each size with three words said by turns; a creature caught by the loop that
// took it, a hull on its last half heart, and below MASSIVE a haul half ore, one of bare grit or one of three hazards
// asleep, by a joke with a line under it; a giant has a line under it too, and a haul over the winch's load where
// nothing else is said. One of BIG or more
// that lies mostly in a place of its own (a pocket, a deep ground, a strain, a cross) by that place, in its colour,
// with a burst of its colours and its two notes; a giant, from a thousand cells, by its own word at each step, with
// rings after rings, a longer beat of stillness, a brighter flash and a sound of its own; and a haul of half the
// ground the longest tether reaches round, HALF THE WORLD!, which sets the core blazing too: asked of the area the
// loop is round (nine tenths of HALF at the least) and of the ground in it (two fifths of HALF at the least). A relic and a wreck's
// part are told before any size but HALF; a cache and a rare hazard before any but a giant's. Every title fits a
// narrow screen, a size smaller where it must.
//   node test/regress/s3-haul-titles.mjs
import { makeGame, world, C, N } from '../harness.mjs';
const { K, B, BIOMES } = world;
const { haulTitle, placeHaul, giantOf, isHalf, GIANTS, HALF, SIZES, QUIPS, GIANT_SAYS, OVER_SAYS } = await import('../../js/game.js');
const { REACH } = await import('../../js/shop.js');
const { textWidth } = await import('../../js/atlas.js');

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const name = (n, found, row, area) => haulTitle(n, found, row, area)[0];

// ---- the ladder of sizes, and HALF
const ladder = [[1, 'HAUL'], [9, 'HAUL'], [10, 'NICE CUT!'], [30, 'BIG HAUL!'], [80, 'HEFTY HAUL!'], [150, 'HUGE HAUL!'], [300, 'MASSIVE!'], [549, 'MASSIVE!'], [550, 'COLOSSAL!'], [999, 'COLOSSAL!'],
  ...GIANTS.map(([at, word]) => [at, word]), [HALF, GIANTS[GIANTS.length - 1][1]], [Math.round(HALF * 0.8), 'HALF THE WORLD!', HALF]];
for (const [n, want, area] of ladder) check(name(n, {}, null, area) === want, `a haul of ${n} round ${area ?? 0} is called ${name(n, {}, null, area)}, not ${want}`);
check(Math.abs(HALF - Math.PI * REACH[REACH.length - 1] ** 2 / 2) < 1 && HALF > 8e6, `HALF is ${HALF} cells, not half the disc of the last reach`);
check(giantOf(999) === 0 && giantOf(1000) === 1 && giantOf(HALF) === GIANTS.length && giantOf(HALF * 0.8, HALF) === GIANTS.length + 1, 'the giants are not numbered 1 up, with HALF last');
// HALF is a loop round nine tenths of half the reach at the least, with two fifths of it in ground at the least.
check(isHalf(HALF * 0.4, HALF * 0.9) && !isHalf(HALF * 0.4 - 1, HALF) && !isHalf(HALF, HALF * 0.9 - 1), 'HALF is not a loop round nine tenths of it with two fifths of it in ground');
check(GIANTS.every(([at], k) => !k || at > GIANTS[k - 1][0]), 'the giants are not in order of size');

// ---- what is found, against the size
const frost = BIOMES[B.FROST], hive = BIOMES.find(r => r?.name === 'hive'), cross = BIOMES.find(r => r?.cross?.structure === 4);
check(name(40, { relic: 2 }) === 'RELIC!' && name(5000, { relic: 2 }) === 'RELIC!' && name(HALF * 0.8, { relic: 2 }, null, HALF) === 'HALF THE WORLD!', 'a relic is not told before any size but HALF');
check(name(40, { parts: 1 }).startsWith('WRECK PART') && name(5000, { parts: 1 }).startsWith('WRECK PART'), 'a wreck part is not told before any size');
check(name(500, { caches: 1 }) === 'CACHE!' && name(5000, { caches: 1 }) === 'TITANIC!', 'a cache is not told before any size but a giant\'s');
check(haulTitle(5000, { relic: 1 })[1] === 2, 'a giant with a relic in it is not still a giant (its show)');

// ---- the words by turns, and the jokes
check(SIZES.every(([, words]) => words.length === 3) && [0, 1, 2, 3].map(pick => haulTitle(40, { pick })[0]).join('|') === "BIG HAUL!|CHUNKY!|NOW WE'RE TALKING!|BIG HAUL!", `a haul of 40 is called by turns ${[0, 1, 2, 3].map(pick => haulTitle(40, { pick })[0])}`);
check(haulTitle(40, { caught: 1 }).join('|') === 'ECO-VANDAL!|0|false|YOU MONSTER' && haulTitle(40, { caught: 2, pick: 1 })[3] === 'THEY PAID RENT', `a creature caught: ${haulTitle(40, { caught: 1 })}`);
check(name(40, { caught: 1 }, BIOMES.find(r => r?.name === 'hive')) === 'ECO-VANDAL!' && name(500, { caught: 1 }) === 'ECO-VANDAL!' && name(1000, { caught: 1 }) === 'MOUNTAINOUS!' && name(40, { caught: 1, caches: 1 }) === 'CACHE!', 'a creature caught is not told after a cache and a giant and before a place and a size');
check(name(40, { low: true }) === 'CLUTCH!' && haulTitle(40, { low: true })[3] === 'ON HALF A HEART' && name(5, { low: true }) === 'HAUL' && name(40, { low: true, caught: 1 }) === 'ECO-VANDAL!', 'the last half heart is not told after a creature and of ten cells or more');
check(name(40, { ores: 20 }) === 'MOTHER LODE!' && name(40, { ores: 19 }) === 'BIG HAUL!' && name(300, { ores: 300 }) === 'MASSIVE!' && name(29, { ores: 29 }) === 'NICE CUT!', 'a haul half ore is not called so from 30 cells to under MASSIVE');
check(name(40, { dull: true }) === 'PURE GRAVEL!' && name(40, { hazards: 3 }) === 'HOT POTATO!' && name(40, { hazards: 2 }) === 'BIG HAUL!' && name(40, { ores: 30, dull: true }) === 'MOTHER LODE!', 'bare grit or three hazards are not called so, after ore');
check(name(40, { ores: 40 }, BIOMES.find(r => r?.name === 'hive')) === 'HONEYCOMB!', 'what a haul held is told before its place');
check(haulTitle(1000)[3] === GIANT_SAYS[0] && GIANT_SAYS.length === GIANTS.length && haulTitle(40, { over: 0.5 })[3] === OVER_SAYS && haulTitle(40)[3] === null && haulTitle(40, { caught: 1, over: 0.5 })[3] === 'YOU MONSTER', 'a giant or a haul over the load has no line under it, or a joke\'s is not its own');

// ---- places
check(name(40, {}, hive) === 'HONEYCOMB!' && haulTitle(40, {}, hive)[2] === true, `a haul in the hive is called ${name(40, {}, hive)}`);
check(name(29, {}, hive) === 'NICE CUT!', 'a haul under BIG is called by its place');
check(name(40, {}, frost) === 'BIG HAUL!' && placeHaul(BIOMES[0]) === null && placeHaul(frost) === null, 'the home ground or a direction\'s own ground is called a place\'s haul');
check(name(40, { caches: 1 }, hive) === 'CACHE!' && name(1000, {}, hive) === 'MOUNTAINOUS!', 'a place\'s word outshouts a cache or a giant');
check(name(40, {}, cross) === `${cross.title.split(' ').pop()} HAUL!`, `a cross's haul is called ${name(40, {}, cross)}`);
for (const row of BIOMES) {
  const word = row && placeHaul(row);
  if (word) check(word.endsWith('!') && word.length <= 22, `${row.title}'s haul is called ${word}`);
}

// ---- in the game: a place's haul, a giant, HALF
const game = await makeGame(7), w = game.world;
game.resize(320, 568, 1);
const at = (x, y) => (C + y) * N + C + x;
const block = (x0, y0, wide, high, b) => { const cells = []; for (let y = y0; y < y0 + high; y++) for (let x = x0; x < x0 + wide; x++) { const i = at(x, y); w.setK(i, K.SOFT); w.setB(i, b); cells.push(i); } return cells; };
const quiet = () => { game.hitstop = 0; game.flash = 0; game.shake = 0; game.rings.length = 0; game.parts.length = 0; game.coreFlash = 0; };
const settle = seconds => { for (let f = 0; f < seconds * 60; f++) game.update(1 / 60); };

quiet();
game.haul(block(30, -20, 8, 5, hive.id));
check(game.banner?.title === 'HONEYCOMB!' && typeof game.banner.colour === 'string' && game.banner.giant === 0, `forty cells of hive: ${JSON.stringify(game.banner && { title: game.banner.title, colour: game.banner.colour })}`);
check(game.parts.length >= 20 && game.rings.length >= 2, `a place's haul made ${game.parts.length} sparks and ${game.rings.length} rings`);
game.render();
settle(12);

quiet();
game.haul(block(30, -60, 40, 25, B.FROST));
const plain = game.rings.length;
check(game.banner?.title === 'MOUNTAINOUS!' && game.banner.giant === 1 && game.hitstop >= 0.18 && game.flash >= 0.45, `a thousand cells: ${game.banner?.title}, giant ${game.banner?.giant}, still ${game.hitstop}, flash ${game.flash}`);
check(plain >= 4 && game.rings.some(r => r.t < 0) && game.rings.every(r => r.life >= 0.5), `a giant's rings: ${JSON.stringify(game.rings.map(r => [r.t, r.life]))}`);
check(game.banner.life > 3.5 && game.banner.sub === GIANT_SAYS[0], `a giant's banner is up ${game.banner.life} s and says '${game.banner.sub}' under it`);
for (let f = 0; f < 30; f++) { game.update(1 / 60); game.render(); }
settle(20);

// A creature caught by the loop that took a haul (js/fauna.js, `wound`, the same moment), and none caught a moment
// before; and a haul made on the last half heart.
quiet();
game.fauna.caughtAt = game.time; game.fauna.caughtN = 1;
game.haul(block(30, -30, 8, 5, B.FROST));
check(QUIPS.caught.some(([t, s]) => t === game.banner?.title && s === game.banner.sub), `a haul with a creature caught in its loop is called '${game.banner?.title}' / '${game.banner?.sub}'`);
settle(6);
quiet();
game.fauna.caughtAt = game.time - 1;
game.haul(block(40, -30, 8, 5, B.FROST));
check(!QUIPS.caught.some(([t]) => t === game.banner?.title), `a haul a second after a creature was caught is called '${game.banner?.title}'`);
settle(6);
quiet();
game.dents = game.val('hull') - 1;
game.haul(block(50, -30, 8, 5, B.FROST));
check(QUIPS.low.some(([t, s]) => t === game.banner?.title && s === game.banner.sub), `a haul on the last half heart is called '${game.banner?.title}'`);
game.dents = 0;
settle(6);

// HALF cannot be hauled until the winch's cap goes, so its show is asked for as the haul would ask.
quiet();
game.grand(C * 16, C * 16, GIANTS.length + 1);
check(game.coreFlash >= 2 && game.flash >= 1 && game.rings.filter(r => r.life === 1.2).length === 6 && game.rings.length >= 15, `HALF's show: core ${game.coreFlash}, flash ${game.flash}, ${game.rings.length} rings`);
game.banner = { ...game.hauled, title: 'HALF THE WORLD!', giant: GIANTS.length + 1, sub: 'HALF THE REACH IN ONE HAUL', t: 0, life: 7 };
let threw = null;
try { for (let f = 0; f < 60; f++) { game.update(1 / 60); game.render(); } } catch (error) { threw = error; }
check(!threw, `HALF's banner threw: ${threw?.message}`);

// ---- every title fits a 320-wide screen (a size smaller where it must)
// (And every line under a title, which is not set smaller, fits the narrowest phone's 152 pixels.)
const titles = [...ladder.map(([, t]) => t), ...SIZES.flatMap(([, w]) => w), ...Object.values(QUIPS).flat(2), ...GIANT_SAYS, OVER_SAYS, ...BIOMES.map(r => r && placeHaul(r)).filter(Boolean), 'HALF THE REACH IN ONE HAUL'];
for (const t of titles) check(textWidth(t, 1) <= 152, `${t} is ${textWidth(t, 1)} pixels wide, too wide for a narrow screen`);

console.log(fails.length ? `DEFECT: ${[...new Set(fails)].slice(0, 30).join('\n        ')}` : `ok: ${ladder.length} sizes up to HALF (a loop round ${HALF} cells), ${titles.length - ladder.length - 1} places with words of their own, a giant's show and HALF's`);
process.exit(fails.length ? 1 : 0);
