// The oracle must notice a band in the wrong class: fly round a pillar, then take bends out by hand. Fails if the
// oracle faults the band the game made, or passes the one with its bends taken out.
import { makeGame, tetherFaults, C, N, K, HX, HY, idx, arena, rocks, place, flyTo, Oracle, showBand } from './lib/rig.mjs';
const game = await makeGame(2, { tether: 9 });
arena(game, -4, -10, 24, 10);
rocks(game, [[15, 0]]);
game.changed();
const oracle = new Oracle(game, [-4, -10, 24, 10]);
const each = () => oracle.step();
for (const [x, y] of [[13, -3], [17, -3], [17, 3], [13, 3], [13, -3], [17, -3]]) flyTo(game, x, y, { each });
const wound = oracle.mismatch();
console.log('wound:', showBand(game), '| oracle:', wound || 'same class', '| harness:', tetherFaults(game).length);
const keep = game.band.map(p => p.slice());
game.band.splice(1, game.band.length - 2);
console.log('all bends taken out:', showBand(game), '| oracle:', oracle.mismatch() || 'same class', '| harness:', tetherFaults(game).join('; ') || 'sound');
const bare = oracle.mismatch();
game.band = keep;
process.exit(wound || !bare ? 1 : 0);
