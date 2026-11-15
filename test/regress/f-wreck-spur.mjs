// After the wreck is hauled on coming home, what is left of the tether?
import { makeGame, tetherFaults } from '../harness.mjs';
import { fixRandom, flyTo, idle, where, bandRel, at, rect, C, N, K } from './lib/lasso.mjs';

const seed = Number(process.argv[2] ?? 7), which = Number(process.argv[3] ?? 0);
fixRandom(6);
const game = await makeGame(seed, { tether: 6, drill: 4 });
const w = game.world, [ax, ay] = w.wrecks[which], wx = ax - C, wy = ay - C, sy = Math.sign(wy), col = wx - 2;
rect(game, Math.min(col, 0), 0, Math.max(col, 0), 0, K.EMPTY);
rect(game, col, Math.min(0, wy - sy * 3), col, Math.max(0, wy - sy * 3), K.EMPTY);
rect(game, -2, -2, 2, 2, K.EMPTY);
game.changed();
const go = pts => { for (const [x, y] of pts) { if (flyTo(game, x, y, { frames: 6000 }) < 0) throw new Error(`never reached ${x},${y} from ${where(game)}`); idle(game, 0.2); } };
go([[col, 0], [col, wy - sy * 2], [col, wy + sy * 2], [wx + 2, wy + sy * 2], [wx + 2, wy - sy * 2], [col, wy - sy * 2], [col, 0]]);
let seen = false;
const each = () => { if (!seen && game.S.stats.hauls) { seen = true; console.log('frame of the haul:', JSON.stringify({ drill: where(game), band: game.band.map(p => [p[0] - C - 0.5, p[1] - C - 0.5, p[2] ?? null, p[3] === undefined ? null : [(p[3] % N) - C, Math.floor(p[3] / N) - C]]) })); } };
flyTo(game, 0, 0, { tol: 0.05, frames: 6000, each }); idle(game, 2, each);
const len = () => { let l = 0; for (let n = 1; n < game.band.length; n++) l += Math.hypot(game.band[n][0] - game.band[n - 1][0], game.band[n][1] - game.band[n - 1][1]); return +l.toFixed(2); };
console.log('two seconds later, drill parked at the core:', JSON.stringify({ drill: where(game), hauls: game.S.stats.hauls, band: bandRel(game), tetherLength: len(), faults: tetherFaults(game) }));
// around each spur point, the ground
for (const p of game.band.slice(1, -1)) { const cx = Math.round(p[0]) - C, cy = Math.round(p[1]) - C; console.log(`ground round corner ${cx},${cy} (cell ${(p[3] % N) - C},${Math.floor(p[3] / N) - C}, turn ${p[2]}):`); for (let y = -2; y <= 1; y++) { let row = '  '; for (let x = -2; x <= 1; x++) row += w.k(at(cx + x, cy + y)) ? '#' : '.'; console.log(row); } }
// Does it clear when the drill next moves?
go([[2, 0]]); console.log('after a hop east:', JSON.stringify({ band: bandRel(game), tetherLength: len() }));
go([[-2, -1]]); console.log('after a hop west:', JSON.stringify({ band: bandRel(game), tetherLength: len() }));
