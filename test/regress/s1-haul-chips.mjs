// The chips that fly off a hauled piece are its ground's own colours. When chips() came to take colours in place
// of a sheet's name (S1), the two calls in the haul still handed it the name, and a chip's colour was one letter
// of it: not a colour, so each was drawn in whatever was drawn before it. A piece is hauled, broken up, and every
// chip in flight must be one of the colours of the ground it came from.
//   node test/regress/s1-haul-chips.mjs
import { makeGame, world, C, N } from '../harness.mjs';
const { K, B, BIOMES } = world;

const game = await makeGame(7), w = game.world;
const cells = [];
for (let n = 0; n < 6; n++) { const i = (C + 20) * N + C + 30 + n; w.setK(i, K.SOFT); w.setB(i, B.FROST); cells.push(i); }
game.parts.length = 0;
game.haul(cells);
const atHaul = game.parts.map(p => p.color);
game.parts.length = 0;
for (let f = 0; f < 45; f++) game.update(1 / 60);          // the blocks break up, well before any of it is home
const own = new Set(BIOMES[B.FROST].debris), all = [...atHaul, ...game.parts.filter(p => !p.star).map(p => p.color)];
const wrong = all.filter(c => !own.has(c));
if (!atHaul.length) { console.log('DEFECT: a haul threw no chips'); process.exit(1); }
console.log(wrong.length ? `DEFECT: ${wrong.length} of ${all.length} chips of a hauled piece of frost are not frost's colours: ${[...new Set(wrong)].slice(0, 6).join(' ')}`
  : `ok: ${all.length} chips of a hauled piece, all in its ground's colours`);
process.exit(wrong.length ? 1 : 0);
