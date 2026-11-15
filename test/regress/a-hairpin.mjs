// A lone block stands in a chamber at the end of a corridor with one corner in it (as a wreck stands in its hollow).
// The drill flies in, right round the block, and home the way it came; the block is hauled as it comes home.
// What is left of the tether, with the drill sitting on the core?
import { makeGame, K, at, rect, arena, fixRandom, flyTo, idle, where, bandRel, tetherFaults } from './lib/lasso.mjs';

fixRandom(8);
const game = await makeGame(7, { tether: 3, drill: 4 });
arena(game, 30);
rect(game, -12, 0, -3, 0, K.EMPTY);                      // a corridor west from the core...
rect(game, -12, 0, -12, 10, K.EMPTY);                    // ...turning south...
rect(game, -15, 11, -9, 17, K.EMPTY);                    // ...into a chamber
rect(game, -13, 13, -12, 14, K.SOFT);                    // the block: 4 cells, touching nothing
rect(game, 3, 0, 14, 0, K.EMPTY);                        // and a corridor east, to fly about in afterwards
game.changed();
const go = pts => { for (const [x, y] of pts) { if (flyTo(game, x, y) < 0) throw new Error(`never reached ${x},${y} from ${where(game)}`); idle(game, 0.2); } };
const len = () => { let l = 0; for (let n = 1; n < game.band.length; n++) l += Math.hypot(game.band[n][0] - game.band[n - 1][0], game.band[n][1] - game.band[n - 1][1]); return +l.toFixed(2); };
go([[-12, 0], [-12, 11], [-14.3, 11.7], [-14.3, 15.7], [-10.7, 15.7], [-10.7, 11.7], [-12, 11], [-12, 0]]);
console.log(JSON.stringify({ step: 'round the block and back at the corner', hauls: game.S.stats.hauls, band: bandRel(game), faults: tetherFaults(game) }));
flyTo(game, 0, 0, { tol: 0.05 }); idle(game, 3);
const home = { step: 'home, three seconds later', drill: where(game), hauls: game.S.stats.hauls, haulsStillRunning: game.hauls.length, band: bandRel(game), tetherLength: len(), faults: tetherFaults(game) };
console.log(JSON.stringify(home));
go([[2.2, 0], [14, 0]]);
const east = { step: 'flown 14 cells east', drill: where(game), band: bandRel(game), tetherLength: len(), straightLineHome: +Math.hypot(...where(game)).toFixed(2), faults: tetherFaults(game) };
console.log(JSON.stringify(east));
const bad = home.band.length > 2 || east.band.length > 2;
console.log(bad ? 'DEFECT: nothing is left for the tether to go round, yet it still runs out along the corridor and back' : 'no defect');
process.exit(bad ? 1 : 0);
