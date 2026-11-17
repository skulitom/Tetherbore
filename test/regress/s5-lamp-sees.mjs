// The lamp sees across open ground (js/game.js: `lampSees`, RAYS; js/world.js: `seeCell`; CORE, js/shop.js). With a
// lamp bought, its light goes out from the drill through open ground as far as the lamp reaches, and whatever it
// falls on is seen as the scan sees what lies in the rock round the drill: drawn, and called out the first time.
// The first ground each ray meets stops it. Staged by hand a hundred cells east of the core, where nothing has been
// seen: the drill at the end of a tunnel through solid rock, a cavern before it, and a prism standing in the cavern
// eleven cells off:
//   - with no lamp bought the prism is not seen;
//   - at the lamp's third level (14 cells) it is seen and called out (a dot on the map), and the ground is drawn
//     again;
//   - with a wall across the cavern between them, the wall is seen and the prism is not;
//   - the scan's reach is as it was: rock beside the drill past the scan's square is not seen, lamp or none.
// Fails on the game before the lamp saw: the prism is never seen.
//   node test/regress/s5-lamp-sees.mjs
import { makeGame, farStart, world, C, N } from '../harness.mjs';
import { rect, at, fixRandom } from './lib/lasso.mjs';
const { K } = world;

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
fixRandom(5);

const stage = async (lamp, wall) => {
  const game = await makeGame(7, { tether: 4, lamp }), w = game.world;
  farStart(game, 100, 0);
  // (Solid all round first: the world lays caves out there of its own.)
  rect(game, 88, -12, 122, 12, K.DENSE);
  rect(game, 88, -1, 100, 1, K.EMPTY);
  rect(game, 101, -6, 116, 6, K.EMPTY);
  const prism = at(111, 0);
  w.setK(prism, K.PRISM);
  if (wall) rect(game, 105, -6, 105, 6, K.DENSE);
  game.changed();
  const unseen = w.s(prism) === 0 && w.s(at(105, 0)) === 0 && w.s(at(100, 5)) === 0, version = game.version;
  game.drill.cell = -1;
  game.look();
  return { game, w, prism, unseen, drawn: game.version > version };
};

{
  const s = await stage(0, false);
  check(s.unseen, 'the staging is wrong: the cavern was seen before the drill looked');
  check(!s.w.s(s.prism), 'with no lamp the prism eleven cells off across the cavern is seen');
  check(!s.w.s(at(100, 5)), 'with no lamp the rock past the scan is seen');
}
{
  const s = await stage(3, false);
  check(s.w.s(s.prism) === 1, 'at the lamp\'s third level the prism eleven cells off across the cavern is not seen');
  check(s.game.S.marks.some(m => m[0] === s.prism), 'the prism the lamp saw was not called out');
  check(s.drawn, 'the ground was not drawn again after the lamp saw the cavern');
  check(s.w.s(at(100, 5)) === 0 && s.w.s(at(100, 3)) === 1, `the scan's reach is not as it was: ${s.w.s(at(100, 3))} at three cells, ${s.w.s(at(100, 5))} at five`);
}
{
  const s = await stage(3, true);
  check(s.w.s(at(105, 0)) === 1 && !s.w.s(s.prism), `with a wall across the cavern the wall ${s.w.s(at(105, 0)) ? 'is' : 'is not'} seen and the prism ${s.w.s(s.prism) ? 'is' : 'is not'}`);
}
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: the lamp sees across a cavern as far as it reaches and calls out what it sees there; a wall stops it, and the scan reaches as it did');
process.exit(fails.length ? 1 : 0);
