// Following on from hairpin.mjs: with the tether left running west to the corridor corner and back, the drill cuts a
// block loose in a chamber to the EAST and lassoes it. Which way does the rubble go home?
import { makeGame, K, at, rect, arena, fixRandom, flyTo, idle, where, bandRel, C } from './lib/lasso.mjs';

async function run(withBlockWest) {
  fixRandom(8);
  const game = await makeGame(7, { tether: 3, drill: 4 });
  arena(game, 30);
  rect(game, -12, 0, -3, 0, K.EMPTY); rect(game, -12, 0, -12, 10, K.EMPTY); rect(game, -15, 11, -9, 17, K.EMPTY);
  if (withBlockWest) rect(game, -13, 13, -12, 14, K.SOFT);
  rect(game, 3, 0, 15, 0, K.EMPTY);                        // a corridor east...
  rect(game, 16, -3, 22, 3, K.EMPTY);                      // ...to a chamber...
  rect(game, 18, -1, 20, 1, K.SOFT); game.world.setK(at(19, -2), K.SOFT); game.world.setK(at(19, -3), K.SOFT);   // ...where a block hangs by a stem
  game.changed();
  const go = pts => { for (const [x, y] of pts) { if (flyTo(game, x, y) < 0) throw new Error(`never reached ${x},${y} from ${where(game)}`); idle(game, 0.2); } };
  go([[-12, 0], [-12, 11], [-14.3, 11.7], [-14.3, 15.7], [-10.7, 15.7], [-10.7, 11.7], [-12, 11], [-12, 0]]);
  flyTo(game, 0, 0, { tol: 0.05 }); idle(game, 6);
  const hauls0 = game.S.stats.hauls;
  go([[2.2, 0], [15, 0], [17, -2.2]]);
  let west = Infinity, h = null, frames = 0;
  const each = () => { if (!h && game.hauls.length) h = game.hauls[0]; if (h) { frames++; for (const b of h.bits) if (b.st === 0) west = Math.min(west, b.x / 16 - C - 0.5); } };
  for (const [x, y] of [[21, -2.2], [21, 2], [17, 2]]) if (flyTo(game, x, y, { each }) < 0) throw new Error(`never reached ${x},${y} from ${where(game)}`);
  const route = h && h.route.map(([x, y]) => [+(x / 16 - C - 0.5).toFixed(1), +(y / 16 - C - 0.5).toFixed(1)]);
  for (let f = 0; f < 3600 && game.hauls.length; f++) { game.update(1 / 60); each(); }
  const out = { blockHauledInTheWestFirst: withBlockWest, haulsBefore: hauls0, haulsAfter: game.S.stats.hauls, route, routeLengthCells: h && +(h.length / 16).toFixed(1), furthestWestAnyRubbleWent: +west.toFixed(1), haulFrames: frames };
  console.log(JSON.stringify(out));
  return out;
}
const a = await run(false), b = await run(true);
const bad = b.furthestWestAnyRubbleWent < -3 && a.furthestWestAnyRubbleWent > -3;
console.log(bad ? `DEFECT: the rubble of a haul in the east is drawn ${-b.furthestWestAnyRubbleWent} cells west past the core and back (route ${b.routeLengthCells} cells against ${a.routeLengthCells})` : 'no defect');
process.exit(bad ? 1 : 0);
