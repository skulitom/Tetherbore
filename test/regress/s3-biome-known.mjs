// Whose ground a cell is, as far as is known (docs/CONTENT-PLAN.md S3; js/world.js: biomeKnown): what a piece of the
// world holds where it has been made, and from the seed alone where it has not, asked without making any piece.
// The map reads it, so a saved game whose older pieces hold ground that is laid otherwise now (a province that was
// its direction's own ground when the piece was made) never shows a place on its map that its ground does not have.
// And a piece laid by an older generation's rules (js/world.js: `genOf`): on the north-east diagonal, where
// generation 2 lays a seam, a piece of generation 1 is known as generation 1 lays it, made or not, and the piece
// beside it, of generation 2, as the seam.
//   node test/regress/s3-biome-known.mjs
import { makeGame, world, C, N } from '../harness.mjs';
const { B, BIOMES, CH } = world;

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const game = await makeGame(7, { tether: 7 }), w = game.world;

// A cell of firn 300 cells north on this seed, in a piece of the world nothing has looked at.
const x = C, y = C - 300, made = w.made;
check(w.biomeAt(x, y) === 17, `the cell 300 north on seed 7 is ground ${w.biomeAt(x, y)}, not firn: pick another`);
check(w.biomeKnown(x, y) === 17 && w.made === made && w.laid(y * N + x) === -1, 'asking whose ground an unmade cell is made its piece, or did not ask the seed');

// The piece as an older game saved it: made, never seen, and the north's own ground all through.
const piece = w.piece(((y >> 6) << 8) | (x >> 6));
piece.biome.fill(B.FROST);
check(w.biomeKnown(x, y) === B.FROST && w.biomeAt(x, y) === 17, 'where a piece is made, what it holds is not what is known');
check(w.peek(x, y) === -1, 'the cell has been seen: the test wants it made and unseen');

// The map: its pixel for that cell is the stored ground's colour, shaded as unseen ground within reach.
// (The map shows the ground near the drill, a cell and a half to a pixel: the drill is stood twenty cells off.)
game.drill.x = x - 19.5; game.drill.y = y + 0.5;
game.S.lv.tether = 9;
game.drawMap(0, 0);
const size = 46, R = game.val('tether'), per = 1.5, HX = Math.floor(game.drill.x) + 0.5, HY = Math.floor(game.drill.y) + 0.5;
let at = -1, beside = -1;
for (let v = 0; v < size; v++) for (let u = 0; u < size; u++) {
  const wx = Math.floor(HX + (u - size / 2 + 0.5) * per), wy = Math.floor(HY + (v - size / 2 + 0.5) * per);
  const inPiece = (wx >> 6) === (x >> 6) && (wy >> 6) === (y >> 6);
  if (at < 0 && inPiece && w.biomeAt(wx, wy) === 17 && Math.hypot(wx - C, wy - C) <= R) at = (v * size + u) * 4;
  // An unmade cell of firn beside it, for the colour the seed gives.
  if (!inPiece && beside < 0 && w.biomeAt(wx, wy) === 17 && w.laid(wy * N + wx) === -1 && Math.hypot(wx - C, wy - C) <= R) beside = (v * size + u) * 4;
}
const px = game.mapData.data, colour = o => [px[o], px[o + 1], px[o + 2]].join(), shaded = map => [map[0] * 0.3 + 8, map[1] * 0.3 + 7, map[2] * 0.3 + 10].map(c => Math.min(255, Math.round(c))).join();
check(at >= 0 && beside >= 0, 'the map shows no cell of the piece, or no unmade cell of firn');
if (at >= 0 && beside >= 0) {
  check(colour(at) === shaded(BIOMES[B.FROST].map), `the map shows a made, unseen cell that holds the north's own ground as ${colour(at)}, not that ground's ${shaded(BIOMES[B.FROST].map)}`);
  check(colour(beside) === shaded(BIOMES[17].map), `the map shows an unmade cell of firn as ${colour(beside)}, not firn's ${shaded(BIOMES[17].map)}`);
}
check(CH === 64, 'pieces are no longer 64 cells across: the test counts on it');
{
  const ox = C + 424, oy = C - 424, id = ((oy >> 6) << 8) | (ox >> 6), next = (((oy - 64) >> 6) << 8) | ((ox + 64) >> 6), was = w.made;
  check(w.biomeAt(ox, oy) === 9 && w.biomeAt(ox + 64, oy - 64) === 9 && !w.chunks[id] && !w.chunks[next], `the cells 600 and 690 out to the north-east on seed 7 are not hoarstone in pieces nothing has looked at: pick others`);
  w.genOf[id] = 1;
  const old = w.biomeKnown(ox, oy);
  check((old === B.FROST || old === B.LODE || (old >= 17 && old <= 24)) && w.made === was, `an unmade piece of generation 1 on the diagonal is known as ground ${old}, or was made by asking`);
  const p = w.piece(id);
  check(p.biome[((oy & 63) << 6) | (ox & 63)] === old && w.biomeKnown(ox, oy) === old, 'made, a piece of generation 1 holds and is known as other ground than its rules lay');
  check(w.biomeKnown(ox + 64, oy - 64) === 9 && w.made === was + 1, 'the unmade piece beside it, of generation 2, is not known as the seam');
}

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: the map shows the ground a made piece holds, and the ground the seed gives where none is made');
process.exit(fails.length ? 1 : 0);
