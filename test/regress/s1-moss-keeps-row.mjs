// Moss that closes the ground round a burst spore pod is soft rock of the ground each cell lies in. It was once
// written into the cell as the west's own ground (number 3), whatever lay there: a pod in the deep west's bloom
// left a patch of plain mire that paid half, and one on a border turned its neighbour's ground into the west's.
// Here a pod is burst on the line between bloom and frost, and the nine cells round it are read once the moss
// has grown.
//   node test/regress/s1-moss-keeps-row.mjs
import { makeGame, world, C, N } from '../harness.mjs';
import { arena, rect, at, idle, fixRandom } from './lib/lasso.mjs';
const { K, B } = world, BLOOM = 7;

fixRandom(2);
const game = await makeGame(7), w = game.world;
arena(game, 30, K.SOFT, BLOOM);
rect(game, 13, -30, 30, 30, K.SOFT, B.FROST);            // from column 13 east the ground is the north's
// A room, with the pod standing in it on a stalk of soft rock: cutting the stalk bursts the pod.
rect(game, 10, -3, 15, 3, K.EMPTY);
w.setK(at(12, 0), K.HAZARD); w.setK(at(12, 1), K.SOFT);
game.changed();
const grounds = () => { const out = []; for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) out.push(w.b(at(12 + u, v))); return out; };
const before = grounds();
game.finishDig(at(12, 1));
const burst = game.clouds.length === 1 && w.k(at(12, 0)) === K.EMPTY;
idle(game, 7);
let grown = 0;
for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) grown += w.k(at(12 + u, v)) === K.SOFT;
const after = grounds(), kept = JSON.stringify(after) === JSON.stringify(before);
console.log(JSON.stringify({ burst, grown, before, after }));
console.log(burst && grown === 9 && kept ? 'ok: moss grew in all nine cells and each is still the ground it lay in' : 'DEFECT: moss changed whose ground a cell is, or did not grow');
process.exit(burst && grown === 9 && kept && before.includes(BLOOM) && before.includes(B.FROST) ? 0 : 1);
