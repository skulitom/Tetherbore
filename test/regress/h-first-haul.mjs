// The untouched world: lasso the first loose piece beside the core, go home, and buy the first level of reach
// while the rubble is still on its way. Then watch what the top bar would show (S.grit - pending.grit).
import { makeGame, UPGRADES } from '../harness.mjs';
import { fixRandom, flyTo, idle, where, bandRel } from './lib/lasso.mjs';

fixRandom(5);
const game = await makeGame(7);
const S = game.S, shown = () => S.grit - game.pending.grit;
const log = [];
let hauledAt = -1, frames = 0;
const each = () => { frames++; if (hauledAt < 0 && S.stats.hauls) { hauledAt = frames; log.push({ frame: frames, event: 'hauled', banner: game.banner.grit, n: game.banner.n, grit: S.grit, pending: game.pending.grit, shown: shown(), drill: where(game) }); } };
for (const [x, y] of [[2, -2], [6, -2], [6, 1], [3, 1], [0, 0]]) { if (flyTo(game, x, y, { each, tol: x === 0 ? 0.05 : 0.2 }) < 0) throw new Error(`never reached ${x},${y} from ${where(game)}`); }
log.push({ frame: frames, event: 'home', atCore: game.atCore, mode: game.drill.mode, grit: S.grit, pending: game.pending.grit, shown: shown(), hauls: game.hauls.length });
game.key('Enter', true);                 // the shop
log.push({ frame: frames, event: 'shop', open: game.shop, canBuyReach: game.canBuy(UPGRADES[0]), cost: game.cost(UPGRADES[0]) });
game.buy(UPGRADES[0]);
log.push({ frame: frames, event: 'bought', reachLevel: S.lv.tether, grit: S.grit, pending: game.pending.grit, shown: shown() });
for (let f = 0; f < 120; f++) game.update(1 / 60);       // two seconds looking at the shop
log.push({ frame: frames + 120, event: 'shop still open', grit: S.grit, pending: game.pending.grit, shown: shown() });
game.key('Escape', true);
let done = -1;
for (let f = 0; f < 1200 && done < 0; f++) { game.update(1 / 60); if (!game.hauls.length) done = f; }
log.push({ event: 'haul finished', framesAfterShop: done, grit: S.grit, pending: game.pending.grit, shown: shown() });
for (const l of log) console.log(JSON.stringify(l));
const bad = log.some(l => l.shown < 0);
console.log(bad ? 'DEFECT: the top bar shows a negative amount of grit' : 'no defect');
process.exit(bad ? 1 : 0);
