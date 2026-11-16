// Pockets on the map (docs/CONTENT-PLAN.md S3, "The map"; js/game.js: pocketPips, drawMap): a pocket within the
// tether's reach that the drill has not been into is a pip in the pocket's own colour. Checked:
//   - a new game on the sixth reach has the four heralds marked, and nothing beyond the reach;
//   - the map draws each pip two pixels square in the pocket's colour, on a dark square of four, where the pocket
//     lies;
//   - a pocket the drill has been into is no longer marked;
//   - a pocket whose ground was made before pockets were laid (the piece at its middle holds other ground) is
//     not marked: an older saved game's map shows no place its ground does not have;
//   - never more than 24, the nearest the drill;
//   - the list is made again when the drill comes into another sector of pockets, when the reach changes and when
//     a pocket is visited, and not otherwise: a frame asks the world for nothing.
//   node test/regress/s3-pocket-pips.mjs
import { makeGame, world, C, N } from '../harness.mjs';
const { B, BIOMES, ZONE } = world;

const fails = [], check = (ok, what) => { if (!ok && fails.length < 12) fails.push(what); };
const far = Z => Math.hypot(Z.cx - C, Z.cy - C);

const game = await makeGame(7, { tether: 4 }), w = game.world, S = game.S, d = game.drill;
let asked = 0;
const within = w.pocketsWithin.bind(w);
w.pocketsWithin = r => { asked++; return within(r); };

// ---- the sixth reach: the heralds
let pips = game.pocketPips();
const heralds = within(230).filter(Z => Z.herald);
check(heralds.length === 4 && heralds.every(Z => pips.includes(Z)), `on reach 250, ${pips.length} pockets are marked, ${heralds.filter(Z => pips.includes(Z)).length} of the four heralds among them`);
check(pips.every(Z => far(Z) <= 250 && !S.visited[Z.key]) && pips.length === within(250).length, `pockets marked beyond the reach or visited: ${pips.map(Z => Math.round(far(Z)))}`);

// ---- drawn: two pixels in the pocket's colour on four of dark, where it lies
{
  // (The map shows the ground near the drill, a cell and a half to a pixel; a pocket off it is at its edge.)
  // (The drill is stood twenty cells from the nearest of them, so that one at least lies on the map.)
  const nearest = pips.slice().sort((a, b) => far(a) - far(b))[0];
  game.drill.x = nearest.cx + 20.5; game.drill.y = nearest.cy + 0.5;
  const size = 46, per = 1.5, [mapX, mapY] = [game.W - 52, 6], squares = [], dx = Math.floor(game.drill.x) + 0.5, dy = Math.floor(game.drill.y) + 0.5;
  game.ctx.fillRect = (x, y, wide, high) => { squares.push([game.ctx.fillStyle, x, y, wide, high]); };
  game.render();
  let on = 0;
  for (const Z of pips) {
    const ox = (Z.cx + 0.5 - dx) / per, oy = (Z.cy + 0.5 - dy) / per, mx = Math.round(mapX + size / 2 + ox), my = Math.round(mapY + size / 2 + oy);
    const pip = squares.findIndex(s => s[0] === BIOMES[Z.row].pocket.pip && s[1] === mx - 1 && s[2] === my - 1 && s[3] === 2 && s[4] === 2);
    if (Math.max(Math.abs(ox), Math.abs(oy)) > size / 2 - 2) { check(pip < 0, `the pocket at ${Z.cx - C},${Z.cy - C}, off the map, is drawn on it`); continue; }
    on++;
    check(pip > 0 && squares[pip - 1][0] === '#0c0a12' && squares[pip - 1][1] === mx - 2 && squares[pip - 1][3] === 4, `the pocket at ${Z.cx - C},${Z.cy - C} is not drawn as a pip at ${mx},${my}`);
  }
  const colours = new Set(pips.map(Z => BIOMES[Z.row].pocket.pip)), all = squares.filter(s => colours.has(s[0]) && s[3] === 2 && s[4] === 2).length;
  check(all === on && on > 0 && colours.has('#ffb020'), `${all} pips are drawn for the ${on} pockets on the map, of ${pips.length} marked, in ${[...colours]}`);
  delete game.ctx.fillRect;
}

// ---- not every frame
asked = 0;
for (let f = 0; f < 30; f++) { game.update(1 / 60); game.render(); }
check(asked === 0, `thirty frames with nothing changed asked the world for its pockets ${asked} times`);

// ---- visited: gone from the map
const west = heralds.find(Z => Z.kin === B.MIRE);
S.visited[west.key] = 1;
pips = game.pocketPips();
check(asked === 1 && !pips.includes(west) && pips.length === within(230).length - 1, `a pocket visited is ${pips.includes(west) ? 'still' : 'not'} marked; the list was made again ${asked} times`);

// ---- ground made before pockets: not marked
const north = heralds.find(Z => Z.kin === B.FROST);
w.setB(north.cy * N + north.cx, B.FROST);
game.pipsFor = '';
pips = game.pocketPips();
check(!pips.includes(north), 'a pocket whose middle holds other ground is marked');
// (Where the piece is not made at all, the pocket will be there when it is: marked.)
const east = heralds.find(Z => Z.kin === B.LODE);
check(w.laid(east.cy * N + east.cx) === -1 && pips.includes(east), 'a pocket whose ground is not made yet is not marked');

// ---- the reach changes, the drill changes sector
asked = 0;
S.lv.tether = 9;
pips = game.pocketPips();
check(asked === 1 && pips.length === 24, `on the last reach ${pips.length} pockets are marked (the list was made ${asked} times)`);
const all = within(2300).filter(Z => !S.visited[Z.key] && Z !== north).map(Z => Math.hypot(Z.cx + 0.5 - d.x, Z.cy + 0.5 - d.y)).sort((a, b) => a - b);
check(pips.every(Z => Math.hypot(Z.cx + 0.5 - d.x, Z.cy + 0.5 - d.y) <= all[23] + 1e-9), 'the 24 pockets marked are not the nearest the drill');
asked = 0;
d.x += 3; game.pocketPips();
check(asked === 0, 'a move within a sector of pockets made the list again');
d.x = C - 5 * ZONE + 0.5; d.y = C + 2.5;
pips = game.pocketPips();
const near = within(2300).filter(Z => !S.visited[Z.key] && Z !== north).map(Z => Math.hypot(Z.cx + 0.5 - d.x, Z.cy + 0.5 - d.y)).sort((a, b) => a - b);
check(asked === 1 && pips.length === 24 && pips.every(Z => Math.hypot(Z.cx + 0.5 - d.x, Z.cy + 0.5 - d.y) <= near[23] + 1e-9), `in another sector the list was made ${asked} times, and is ${pips.length} pockets`);

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: pockets within reach and not yet visited are pips on the map, the 24 nearest, each where it lies and in its own colour, and the list is made only when it could have changed');
process.exit(fails.length ? 1 : 0);
