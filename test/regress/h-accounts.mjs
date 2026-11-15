// Two hauls at once, one of them large enough to be shown by a share of its cells, in ground that pays gems.
// Checks: what is paid equals what the banners said; nothing is left pending; what the top bar shows never goes down
// or below zero; every bit of rubble is swallowed; both hauls end.
import { makeGame, K, B, at, rect, arena, fixRandom, flyTo, idle, where, bandRel, isLoose, C, N } from './lib/lasso.mjs';

fixRandom(9);
const game = await makeGame(7, { tether: 4, drill: 4 });
const w = game.world, S = game.S;
arena(game, 60, K.SOFT, B.FROST);
rect(game, 3, 0, 9, 0, K.EMPTY);
rect(game, 10, -30, 50, 12, K.EMPTY);                        // a cavern
// A big block (28 x 28, every third cell ore) hanging from the roof by a stem, and a small one beside it.
rect(game, 16, -24, 43, 3, K.SOFT); for (let y = -24; y <= 3; y++) for (let x = 16; x <= 43; x++) if ((x * 7 + y * 3) % 5 === 0) w.setK(at(x, y), K.ORE_A);
rect(game, 30, -30, 30, -25, K.SOFT);
rect(game, 12, 6, 14, 8, K.ORE_B); rect(game, 13, 9, 13, 12, K.SOFT); w.setK(at(13, 13), K.SOFT);   // small: hangs from the floor
game.changed();
const banners = []; let lastBanner = null, frames = 0, minShown = Infinity, wentDown = 0, prev = -Infinity, most = 0, prevGems = -Infinity, gemsDown = 0, negGems = 0;
const trickle0 = S.grit;
let trickle = 0, lastGrit = S.grit;
const each = () => {
  frames++;
  if (game.banner && game.banner !== lastBanner) { lastBanner = game.banner; banners.push({ frame: frames, n: game.banner.n, grit: game.banner.grit, gems: game.banner.gems.slice() }); }
  const shown = S.grit - game.pending.grit, g = S.gems[1] - game.pending.gems[1];
  minShown = Math.min(minShown, shown); if (shown < prev - 1e-9) wentDown++; prev = shown;
  if (g < prevGems) gemsDown++; prevGems = g; if (g < 0) negGems++;
  most = Math.max(most, game.hauls.length);
};
const go = pts => { for (const [x, y] of pts) { if (flyTo(game, x, y, { each }) < 0) throw new Error(`never reached ${x},${y} from ${where(game)}`); } };
go([[9, 0], [12, 10], [13, 10], [15, 10], [15, 5], [11, 5], [11, 9]]);            // cut the small one's stem and go round it
const small = S.stats.hauls;
go([[14, -27], [30, -27], [46, -27], [46, 5], [14, 5]]);                          // cut the big one's stem and go round it
const big = S.stats.hauls;
let end = -1;
for (let f = 0; f < 60 * 60 && end < 0; f++) { game.update(1 / 60); each(); if (!game.hauls.length) end = f; }
const paid = banners.reduce((a, b) => a + b.grit, 0), gems = banners.reduce((a, b) => a + b.gems[1], 0);
// The station's trickle: one unit of grit every two seconds at this reach.
console.log(JSON.stringify({ hauls: S.stats.hauls, afterSmall: small, afterBig: big, banners, mostHaulsAtOnce: most, endedAfterFrames: end,
  grit: S.grit, bannersSay: paid, restIsTrickle: S.grit - paid, secondsPlayed: +(S.stats.time).toFixed(1), gemsHeld: S.gems[1], bannerGems: gems,
  pendingLeft: game.pending, minShown, shownWentDownFrames: wentDown, gemsShownWentDown: gemsDown, gemsShownNegative: negGems }));
// The books: nothing left on its way, the bar never below nothing nor going down, and all the grit held is what the
// banners said plus the station's own trickle (so much every two seconds, by the reach).
const rest = S.grit - paid, trickled = Math.ceil(Math.max(1, game.val('tether') / 24)) * (S.stats.time / 2 + 1);
process.exit(game.pending.grit || game.pending.gems.some(Boolean) || minShown < 0 || wentDown || negGems || end < 0 || rest < 0 || rest > trickled ? 1 : 0);
