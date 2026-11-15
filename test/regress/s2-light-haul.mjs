// S2: the light haul. A haul of fewer than 12 cells with no relic, cache or wreck part in it stops nothing: no beat
// of stillness, no flash, no burst at the core when it is banked, a shake of 1.5 at the most, a small ring, and what
// it paid said in a popup where the piece lay, the banner of a bigger haul left up. A haul of 12, or a small one
// with a cache in it, is as it always was. Hauls that follow one another within a few seconds are a chain, and in
// a chain rubble never breaks fine. A haul of no cells is nothing at all.
//   node test/regress/s2-light-haul.mjs
import { makeGame, world, C, N } from '../harness.mjs';
const { K, B } = world;

const game = await makeGame(7), w = game.world, S = game.S, fails = [];
const at = (x, y) => (C + y) * N + C + x;
const check = (ok, what) => { if (!ok) fails.push(what); };
const lay = (x, y, kinds, b = B.FROST) => kinds.map((k, n) => { const i = at(x + n, y); w.setK(i, k); w.setB(i, b); return i; });
const quiet = () => { game.hitstop = 0; game.flash = 0; game.shake = 0; game.rings.length = 0; game.popups.length = 0; game.effects.length = 0; };
const settle = seconds => { const seen = new Set(); for (let f = 0; f < seconds * 60; f++) { game.update(1 / 60); for (const e of game.effects) seen.add(e.sheet); } return seen; };

// ---- eleven cells of plain ground with an ore among them: light
quiet();
game.haul(lay(30, -10, [...Array(10).fill(K.SOFT), K.ORE_B]));
let h = game.hauls[game.hauls.length - 1];
check(game.hauled?.light === true && game.hauled.n === 11, `a haul of 11 is not light: ${JSON.stringify(game.hauled)}`);
check(game.banner === null, 'a light haul put up a banner');
check(!(game.hitstop > 0), `a light haul stopped the game for ${game.hitstop} s`);
check(game.flash === 0, 'a light haul flashed the screen');
check(game.shake > 0 && game.shake <= 1.5, `a light haul shook by ${game.shake}`);
check(game.rings.length === 1 && game.rings[0].reach <= 24, `a light haul's ring: ${JSON.stringify(game.rings)}`);
check(!game.effects.some(e => e.sheet === 'bank'), 'a light haul burst where it lay');
const gold = game.popups.find(p => p.color === '#ffe14a'), gem = game.popups.find(p => p.icon === 'frost');
check(gold && gold.label === `+${game.hauled.grit}` && gold.icon === 'grit', `no popup of what it paid: ${JSON.stringify(game.popups)}`);
check(gold && Math.abs(gold.x / 16 - (C + 35.5)) < 1 && Math.abs(gold.y / 16 - (C - 10)) < 1.5, `the popup is not at the piece: ${gold && [gold.x / 16 - C, gold.y / 16 - C]}`);
check(gem && gem.label === '+5', `no popup of the gems it paid: ${JSON.stringify(game.popups)}`);
check(h.light === true, 'the rubble does not know it is a light haul');
check(!settle(12).has('bank') && !game.hauls.length, 'a light haul burst at the core when it was banked, or never came home');

// ---- twelve cells: as it always was
quiet();
game.haul(lay(30, -8, Array(12).fill(K.SOFT)));
check(game.hauled.light === false && game.banner === game.hauled && game.banner.title === 'NICE CUT!', `a haul of 12 has no banner: ${JSON.stringify(game.banner)}`);
check(game.hitstop > 0 && game.flash > 0 && game.shake > 1.5, `a haul of 12 neither stopped, flashed nor shook: ${game.hitstop} ${game.flash} ${game.shake}`);
check(!game.popups.some(p => p.color === '#ffe14a'), 'a haul of 12 says what it paid twice');
const big = game.banner;
// A light haul while that banner is up leaves it there.
game.haul(lay(30, -6, Array(5).fill(K.SOFT)));
check(game.banner === big && game.hauled !== big && game.hauled.light, 'a light haul took the place of a bigger haul\'s banner');
check(settle(12).has('bank'), 'a haul of 12 did not burst at the core when it was banked');

// ---- a small haul with something in it to make a show of
quiet();
game.haul(lay(30, -4, [K.DENSE, K.CACHE, K.DENSE]));
check(game.hauled.light === false && game.banner?.title === 'CACHE!' && game.hitstop > 0, `a cache in a small haul: ${JSON.stringify(game.hauled)}`);
settle(12);

// ---- nothing
const hauls = S.stats.hauls, grit = S.grit, chain = JSON.stringify(game.chain), said = game.hauled;
game.haul([]);
check(S.stats.hauls === hauls && S.grit === grit && !game.hauls.length && JSON.stringify(game.chain) === chain && game.hauled === said, 'a haul of no cells was made');
settle(1);
check(!game.hauls.length, 'a haul of no cells is on its way home');

// ---- a chain: rubble breaks fine alone, never fine with a haul close behind another
game.haul(lay(30, 0, Array(6).fill(K.SOFT)));
const first = game.hauls[game.hauls.length - 1].size;
settle(2);
game.haul(lay(30, 2, Array(6).fill(K.SOFT)));
const second = game.hauls[game.hauls.length - 1].size, links = game.chain.n;
settle(14);
game.haul(lay(30, 4, Array(6).fill(K.SOFT)));
const later = game.hauls[game.hauls.length - 1].size;
check(first === 4 && second === 8 && later === 4 && links === 2 && game.chain.n === 1, `bits of ${first}, ${second} and ${later} pixels for a haul alone, one close behind it and one long after; ${links} links, then ${game.chain.n}`);

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: a light haul stops nothing and says what it paid where it lay; 12 cells or a cache are a haul as before; none is nothing; a chain breaks coarse');
process.exit(fails.length ? 1 : 0);
