// What paid most in a haul, said on its banner (js/game.js: `payOf`'s `top`, `topPayer`; js/drawing.js:
// `bannerSplit`): so many cells of the thing of the lab's that brought in most (its cells' grit as the haul multiplies
// it, its lumps as they stand), its name, or a '?' until the lab has analysed it, and its worth as js/worth.js says it,
// in its tier's colour, where that thing is of the second tier or the third. Held here:
//   - sunstone among rock: '6 SUNSTONE x4', silver; '6 ? x4' before it is analysed; violet quartz hauled at home its
//     home ground's figure, x24; a rime bell among ore '1 RIME BELL ~x190', gold (a lump, about so);
//   - cinder ore among rock, the first tier, names nothing; nor a light haul, nor a relic's haul or a shrine's with
//     sunstone and the shrine's own stone in them (their banners are as they were);
//   - two cells of cinder ore and one of sunstone, which bring in the same, name sunstone (the higher tier), and
//     three of cinder ore and one of sunstone nothing (cinder ore paid most);
//   - payOf says it, and the haul says what payOf said;
//   - on the banner at 160 x 284 the line is laid under the gems, and dropped where the banner has the three lines
//     it might have under them already, a second of gems, a prism's and a word more, so it reaches no lower than
//     before (test/regress/w-worth-seen.mjs holds every thing's line to the narrowest phones in every language).
// Each fails on the code before, whose banner says nothing of what paid most.
//   node test/regress/w-worth-haul.mjs
import { makeGame, world, C, N, K, B } from '../harness.mjs';
const { WORTH_AT } = await import('../../js/worth.js');
const { TIER_RIM } = await import('../../js/drawing.js');
const { SHRINES } = world;

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const SUN = 'ember-items:oreB', CINDER = 'ember-items:oreA', VIOLET = 'lode-items:oreB', BELL = 'bell-items:hazard';
const game = await makeGame(7, { tether: 8 }), w = game.world, S = game.S;
S.stats.hauls = 1;
// A haul of the cells listed, each [x, y, kind, ground], made into the world first: what the banner was given.
let row = 0;
const haul = (cells, rock = 24) => {
  const list = [];
  for (const [x, y, k, b = B.EMBER] of cells) { const i = (C + y) * N + C + x; w.setK(i, k); w.setB(i, b); list.push(i); }
  // (The rock beside them, a row of its own each haul, far enough out that none is home ground.)
  for (let n = 0; n < rock; n++) { const i = (C + 120 + row) * N + C - 40 + n; w.setK(i, K.SOFT); w.setB(i, B.EMBER); list.push(i); }
  row += 2;
  game.banner = null;
  const pay = game.payOf(list);
  game.haul(list);
  return { pay, top: game.hauled.top, banner: game.banner };
};

// ---- sunstone among rock, known and not
S.lab = { [SUN]: 2 };
let got = haul([0, 1, 2, 3, 4, 5].map(n => [60 + n, 40, K.ORE_B]));
check(got.pay.top === SUN && got.pay.topN === 6, `payOf's top of sunstone among rock: ${got.pay.top} ${got.pay.topN}`);
check(got.top?.said === '6 SUNSTONE x4' && got.top.colour === TIER_RIM[2] && got.top.key === SUN && got.banner?.top === got.top, `sunstone among rock: ${JSON.stringify(got.top)}`);
S.lab = {};
got = haul([0, 1, 2, 3, 4, 5].map(n => [60 + n, 42, K.ORE_B]));
check(got.top?.said === '6 ? x4', `sunstone not yet analysed: ${got.top?.said}`);
// Violet quartz in the home ground: its own ground's figure.
S.lab = { [VIOLET]: 1 };
got = haul([[2, 4, K.ORE_B, B.CRUST], [3, 4, K.ORE_B, B.CRUST], [4, 4, K.ORE_B, B.CRUST]]);
check(got.top?.said === `3 VIOLET QUARTZ x${Math.round(WORTH_AT[0][VIOLET].home.x)}` && got.top.said.endsWith('x24'), `violet quartz at home: ${got.top?.said}`);
// A rime bell among ore: a lump, about so, gold.
S.lab = { [BELL]: 1, [SUN]: 1 };
got = haul([[70, 50, K.RARE, B.FROST], ...[0, 1, 2, 3].map(n => [72 + n, 50, K.ORE_B])]);
check(got.top?.key === BELL && got.top.said === `1 RIME BELL ${WORTH_AT[0][BELL].said.split(' ')[0]}` && got.top.said.startsWith('1 RIME BELL ~x') && got.top.colour === TIER_RIM[3], `a rime bell among sunstone: ${JSON.stringify(got.top)}`);

// ---- nothing named
got = haul([0, 1, 2, 3, 4, 5].map(n => [60 + n, 44, K.ORE_A]));
check(got.pay.top === CINDER && got.top === null && got.banner && !got.banner.top, `cinder ore among rock named ${JSON.stringify(got.top)}`);
got = haul([[60, 46, K.ORE_B], [61, 46, K.ORE_B]], 4);
check(got.top === null && game.hauled.light, `a light haul of sunstone named ${JSON.stringify(got.top)}`);
// A relic's haul: the relic, sunstone and rock.
const relic = w.relicAt[1], rx = relic % N - C, ry = Math.floor(relic / N) - C;
got = haul([[rx, ry, K.RELIC, w.b(relic)], ...[0, 1, 2, 3, 4, 5].map(n => [60 + n, 48, K.ORE_B])]);
check(got.pay.relic === 1 && got.pay.top === SUN && got.top === null && got.banner && !got.banner.top, `a relic's haul named ${JSON.stringify(got.top)}`);
// A shrine's haul: its heart, its stone and ore round it.
{
  const [sx, sy] = SHRINES[0], cells = [];
  for (let y = C + sy - 5; y <= C + sy + 5; y++) for (let x = C + sx - 5; x <= C + sx + 5; x++) if (w.at(x, y) !== K.EMPTY) cells.push(y * N + x);
  const pay = game.payOf(cells);
  game.banner = null; game.haul(cells);
  check(pay.shrine === 0 && pay.top && WORTH_AT[0][pay.top].tier === 3 && game.hauled.top === null && game.hauled.title === 'SHRINE!' && !game.banner.top, `a shrine's haul named ${JSON.stringify(game.hauled.top)} (its top payer ${pay.top})`);
}

// ---- the same paid, the higher tier: two cells of cinder ore and one of sunstone, all 65 cells from the core
S.lab = { [SUN]: 1, [CINDER]: 1 };
const RING = [[25, 60], [33, 56], [39, 52], [52, 39]];
got = haul([[...RING[0], K.ORE_B], [...RING[1], K.ORE_A], [...RING[2], K.ORE_A]]);
check(got.pay.top === SUN && got.top?.said === '1 SUNSTONE x4', `two of cinder ore and one of sunstone: ${got.pay.top}, ${got.top?.said}`);
got = haul([[...RING[0], K.ORE_A], [...RING[1], K.ORE_A], [...RING[2], K.ORE_B]].reverse());
check(got.pay.top === SUN, `the same, the other way round: ${got.pay.top}`);
got = haul([[...RING[0], K.ORE_B], [...RING[1], K.ORE_A], [...RING[2], K.ORE_A], [...RING[3], K.ORE_A]]);
check(got.pay.top === CINDER && got.top === null, `three of cinder ore and one of sunstone: ${got.pay.top}, ${JSON.stringify(got.top)}`);

// ---- on the banner, at 160 x 284
game.resize(160, 284, 1);
S.lab = { [SUN]: 1 };
got = haul([0, 1, 2, 3, 4, 5].map(n => [60 + n, 52, K.ORE_B]));
const b = game.banner;
game.drawHud(0, 0);
check(b.topAt === 12 && b.topW <= game.W - 8 && b.topW > 40, `sunstone's line on the banner: ${b.topAt} at ${b.topW} wide on ${game.W}`);
const room = { ...b, splitW: 0 };
game.bannerSplit(room, null);
check(room.topAt === 12, 'a plain banner has no room for what paid most');
// (Two lines of gems, a prism's line and a word more already: no room; with two of those, room. bannerSplit works out
// `split` itself, and a banner of every gem paid is one that splits.)
const every = { ...b, gems: [0, 9e5, 9e5, 9e5, 9e5, 9e5, 9e5, 9e5, 9e5], shine: 2, sub: 'THE WINCH IS CRYING', splitW: 0 };
game.bannerSplit(every, null);
check(every.split > 0 && every.topAt === 0, `a banner of two lines of gems, a prism and a word more still says what paid most: split ${every.split}, ${every.topAt}`);
const two = { ...every, sub: null, splitW: 0 };
game.bannerSplit(two, null);
check(two.split > 0 && two.topAt === 12, `a banner of two lines of gems and a prism has no room for what paid most: split ${two.split}, ${two.topAt}`);

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: a haul\'s banner names what paid most in it, of the second tier or the third, as worth.js says it, and not for a relic, a shrine, a light haul or a common ore');
process.exit(fails.length ? 1 : 0);
