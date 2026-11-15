// A drill at rest still creeps: its speed dies away by halves and never reaches nothing, so the string's end makes
// moves of a hundred-millionth of a cell. The verifiers' fuzz (seed 57, reach 9, from -1061,1061) found the drill
// lying still in a pocket one cell wide, exactly on the diagonal through two corners of ground: the corner the
// string hung on (behind it) and one half a cell beyond its end. Such a move swings the string past straight at the
// first corner and lets it go, and the sweep that follows, a triangle a few billionths of a cell wide, took the
// corner beyond the end of the string for one the string had met: every test of which side of the triangle's short
// edge the corner lay on was within its allowance, the edge being so short. A bend appeared half a cell past the
// drill, turning round open ground. A corner further from the pivot than the string reaches is now never caught.
// Staged: the ground as it was (a 7 x 7 patch), the string hung as it was; the two moves are made by `lead`.
//   node test/regress/a-micro-move.mjs
import { makeGame, tetherFaults, C, N, K } from '../harness.mjs';

const game = await makeGame(7, { tether: 5 }), w = game.world, X = C + 60, Y = C + 60;
const rows = ['7778777', '0008777', '0700777', '7770870', '7777000', '4440000', '0000000'];
for (let y = -8; y <= 8; y++) for (let x = -8; x <= 8; x++) w.setK((Y + y) * N + X + x, K.SLATE);
rows.forEach((row, v) => [...row].forEach((k, u) => w.setK((Y + v - 3) * N + X + u - 3, parseInt(k, 16))));
// The drill's cell is (X, Y). The string comes from open ground to the west, bends on the north-east corner of the
// rock at (X - 2, Y - 1), and runs down the diagonal to the drill, a hair off flush with the rock east and south.
const rock = (Y - 1) * N + X - 2, bend = [X - 1, Y - 1, 1, rock, rock * 4 + 1];
let bad = 0;
for (const [name, moves] of [['the two moves the fuzz made', [[0, 1.943408278748393e-8], [8.12815414974466e-9, 0]]], ['the same, the other way about', [[1.9e-8, 0], [0, 8.1e-9]]],
  ['a thousand moves of that size', Array.from({ length: 1000 }, (_, n) => [n % 2 ? 0 : (n % 4 ? -1 : 1) * 7e-9, n % 2 ? (n % 3 ? 1 : -1) * 9e-9 : 0])]]) {
  let at = [X + 0.5 + 0.16 - 1.21628e-8, Y + 0.5 + 0.16 - 2.56734e-8];
  game.band = [at, bend.slice(), [X - 2.8, Y - 1.2]];
  if (tetherFaults(game).length) throw new Error(`staging is wrong: ${tetherFaults(game)}`);
  let faults = [];
  for (const [mx, my] of moves) {
    at = [at[0] + mx, at[1] + my];
    game.lead(game.band, at);
    faults = tetherFaults(game);
    if (faults.length) break;
  }
  if (faults.length) bad++;
  console.log(`${name}: ${faults.length ? `FAULT: ${faults[0]}` : 'the string is sound'}; bends at ${JSON.stringify(game.band.slice(1, -1).map(b => [b[0] - X, b[1] - Y, b[2]]))}`);
}
console.log(bad ? 'DEFECT: a move too small to see hooked the string on a corner beyond its end' : 'no defect');
process.exit(bad ? 1 : 0);
