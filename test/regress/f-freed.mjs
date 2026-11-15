// What World.freed and World.island promise, asked of the world alone on ground laid by hand (F22, F23, F27):
//   a lone flood that runs out is an island and is returned (the first piece beside the core);
//   cells opened together are asked about together (a bomb takes a neck and the cells either side of it);
//   `open` names further cells to take as open; an opened cell need not be open in the world yet;
//   the limit is each flood's own, so a piece of up to `limit` cells is found whatever the shape of the last cut;
//   a cut into the mainland costs next to nothing; an island is known by its outline, a hollow's wall is not one.
//   node test/regress/f-freed.mjs
import { world, C, N, K } from '../harness.mjs';

const w = new world.World();
w.reset(7);
const at = (x, y) => (C + y) * N + C + x, problems = [];
const rect = (x0, y0, x1, y1, kind) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) w.setK(at(x, y), kind); };
const sizes = pieces => JSON.stringify(pieces.map(p => p.length).sort((a, b) => a - b));
const expect = (name, got, want) => { console.log(`${got === want ? 'ok  ' : 'FAIL'} ${name}: ${got}${got === want ? '' : ` (expected ${want})`}`); if (got !== want) problems.push(name); };
const safely = f => { try { return f(); } catch (error) { return `threw ${error.message}`; } };

// The first piece of a fresh world: four cells in a moat, told of by the open cell beside it.
expect('the first piece, from the open cell beside it', safely(() => sizes(w.freed(at(3, 0), 120000))), '[4]');

// A field of plain ground with a block standing in a ring of open cells, held by a neck one cell wide.
rect(20, -30, 80, 30, K.SOFT);
rect(38, -12, 62, 12, K.EMPTY);
rect(40, -10, 60, 10, K.SOFT);                                    // the block: 21 x 21 = 441 cells
rect(50, -12, 50, -11, K.SOFT);                                   // its neck, two cells long, up to the roof
expect('the neck cut by one cell', safely(() => sizes(w.freed(at(50, -11), 120000))), '[441]');
// A bomb beside the neck: the neck's two cells and the roof cell above it go together. No one of them alone has
// both the block and the held ground beside it once the others are gone.
w.setK(at(50, -12), K.EMPTY); w.setK(at(50, -11), K.EMPTY); w.setK(at(50, -13), K.EMPTY);
expect('three cells opened together by a blast', safely(() => sizes(w.freed([at(50, -13), at(50, -12), at(50, -11)], 120000))), '[441]');
rect(50, -13, 50, -11, K.SOFT);
// `open`: the neck's upper cell taken as open while the lower is cut. And the cut cell is still ground in the world.
expect('a cut with a further cell taken as open', safely(() => sizes(w.freed(at(50, -11), 120000, new Set([at(50, -12)])))), '[441]');
expect('the same cut alone frees one cell of neck with the block', safely(() => sizes(w.freed(at(50, -12), 120000))), '[442]');
expect('the world was not changed by asking', w.k(at(50, -11)) === K.SOFT && w.k(at(50, -12)) === K.SOFT, true);

// The limit is each flood's own: a piece of 441 cells is found with a limit of 441 and not with 440, though the
// held ground beside the cut is flooded cell for cell alongside it.
expect('a piece of exactly the limit', safely(() => sizes(w.freed(at(50, -11), 441))), '[441]');
expect('a piece one cell over the limit', safely(() => sizes(w.freed(at(50, -11), 440))), '[]');

// A cut into the mainland: nothing comes free, and next to nothing is looked at to know it.
let looked = 0;
const kind = w.k; w.k = function (i) { looked++; return kind.call(this, i); };
expect('a cut into the mainland frees nothing', safely(() => sizes(w.freed(at(30, 20), 120000))), '[]');
expect('and looks at under 5,000 cells to say so', looked < 5000, true);
w.k = kind;

// Outlines.
if (typeof w.island !== 'function') { console.log('FAIL World.island is missing'); problems.push('island'); } else {
  rect(100, -10, 130, 10, K.EMPTY);
  w.setK(at(110, 0), K.DENSE);                                    // one cell standing free
  rect(118, -4, 124, 4, K.DENSE); rect(120, -2, 122, 2, K.EMPTY); // a ring of rock with a hollow in it
  expect('one cell standing free is an island', w.island(at(110, 0), 0, 600), true);
  expect('a ring of rock, from its outside', w.island(at(118, 0), 2, 600), true);
  expect('the same ring, from the wall of its hollow', w.island(at(119, 0), 0, 600), false);
  expect('the wall of the cavern they stand in', w.island(at(99, 0), 0, 600), false);
  expect('an outline longer than is walked', w.island(at(118, 0), 2, 10), false);
  const walked = new Set();
  w.island(at(99, 0), 0, 600, null, walked);
  const marks = walked.size;
  w.island(at(99, 3), 0, 600, null, walked);
  expect('a wall walked once is not walked again', walked.size - marks <= 1, true);
  expect('ground taken as gone is not ground', w.island(at(110, 0), 0, 600, new Set([at(110, 0)])), false);
}
if (problems.length) { console.log(`DEFECT: ${problems.length} of freed's promises broken`); process.exit(1); }
console.log('no defect');
