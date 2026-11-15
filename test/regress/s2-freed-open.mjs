// S2: what a cut would free is asked with everything else the cut would open (a pane, a crack, a punch) taken as
// open too, and ground that hangs only on one of those cells is found, though it lies nowhere near the cut itself.
// Without that the glow would not show a piece that the cut then frees.
//   World.freed(cells, limit, open): a piece held only by a cell of `open` is returned;
//   Game.foresee(i, also): the glow holds the `also` cells and what they leave hanging; foresee(i) alone does not.
//   node test/regress/s2-freed-open.mjs
import { makeGame, C, N, K } from '../harness.mjs';

const game = await makeGame(7), w = game.world, problems = [];
const at = (x, y) => (C + y) * N + C + x;
const rect = (x0, y0, x1, y1, kind) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) w.setK(at(x, y), kind); };
const sizes = pieces => JSON.stringify(pieces.map(p => p.length).sort((a, b) => a - b));
const expect = (name, got, want) => { console.log(`${got === want ? 'ok  ' : 'FAIL'} ${name}: ${got}${got === want ? '' : ` (expected ${want})`}`); if (got !== want) problems.push(name); };

// A field of plain ground with a block standing in a ring of open cells, held by a neck two cells long.
rect(20, -30, 80, 30, K.SOFT);
rect(38, -12, 62, 12, K.EMPTY);
rect(40, -10, 60, 10, K.SOFT);                                    // the block: 21 x 21 = 441 cells
rect(50, -12, 50, -11, K.SOFT);                                   // its neck
const far = at(30, 20), neck = at(50, -12);                       // a cell deep in the held ground, and the neck's top
expect('the far cut alone frees nothing', sizes(w.freed(far, 120000)), '[]');
expect('with the neck taken as open, the block and the rest of its neck', sizes(w.freed(far, 120000, new Set([neck]))), '[442]');
expect('the neck is not among what came free', w.freed(far, 120000, new Set([neck])).flat().includes(neck), false);
expect('a list of cuts with a set of open cells', sizes(w.freed([far, at(31, 20)], 120000, new Set([neck, at(50, -11)]))), '[441]');
expect('an open cell that is open already changes nothing', sizes(w.freed(far, 120000, new Set([at(39, 0)]))), '[]');
expect('the world was not changed by asking', w.k(far) === K.SOFT && w.k(neck) === K.SOFT, true);

// The glow.
game.foresee(far);
expect('foresee: the far cut alone glows nothing', game.preview[0].cells.length, 0);
game.foresee(far, [neck]);
const glow = new Set(game.preview[0].cells);
expect('foresee: with the neck, the neck and what it frees glow', glow.size, 443);
expect('foresee: the neck itself glows', glow.has(neck), true);
expect('foresee: the block glows', glow.has(at(50, 0)) && glow.has(at(40, -10)) && glow.has(at(60, 10)), true);
expect('foresee: the cut cell is not in its own glow', glow.has(far), false);
game.foresee(far, [far, at(39, 0)]);
expect('foresee: the cut itself and open ground among the extra cells are passed over', game.preview[0].cells.length, 0);

if (problems.length) { console.log(`DEFECT: ${problems.length} of the promises about cells taken as open are broken`); process.exit(1); }
console.log('no defect');
