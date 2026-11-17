// What the map marks goes when what it marks is hauled away, however far the tether went round it.
//   - The finder marks a find the drill has not seen. A haul shows the map every cell it takes, but a big geode's
//     heart is hollow, so it was in no haul and stayed unseen: a geode lassoed whole from afar kept its mark on the
//     map for good. Each kind the finder marks (a hollow geode, a cache, a prism), hauled away unseen in a block
//     round it, is no longer marked; the others stay.
//   - A pocket the drill has not flown into is a pip on the map, somewhere to go. One whose ground is hauled from
//     outside has been got to: its pip goes, as it does when the drill flies in.
//   node test/regress/m-map-gone.mjs
import { makeGame, K, C, N } from '../harness.mjs';

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const block = (w, fx, fy, r) => { const cells = []; for (let y = fy - r; y <= fy + r; y++) for (let x = fx - r; x <= fx + r; x++) if (w.k(y * N + x) !== K.EMPTY) cells.push(y * N + x); return cells; };

{
  const game = await makeGame(7, { tether: 5, mapfinder: 3 }), w = game.world;
  const all = game.findsNear(C + 0.5, C + 0.5, 400, {});
  const hollow = all.find(([what, fx, fy]) => what === 'geode' && w.kindAt(fx, fy, w.biomeAt(fx, fy)) === K.EMPTY);
  const cache = all.find(([what]) => what === 'cache'), prism = all.find(([what]) => what === 'prism');
  check(hollow && cache && prism, 'no hollow geode, cache and prism within reach to try');
  let left = all.length;
  for (const [what, fx, fy] of [hollow, cache, prism].filter(Boolean)) {
    const cells = block(w, fx, fy, 5);
    game.haul(cells, cells.length); game.changed(cells);
    const now = game.findsNear(C + 0.5, C + 0.5, 400, {});
    check(!now.some(f => f[1] === fx && f[2] === fy), `a ${what} hauled away unseen is still marked`);
    check(now.length === left - 1, `hauling a ${what} took ${left - now.length} marks off the map, not one`);
    left = now.length;
  }
}

{
  const game = await makeGame(7, { tether: 6 }), w = game.world;
  const Z = w.pocketsWithin(game.val('tether')).find(Z => w.biomeKnown(Z.cx, Z.cy) === Z.row);
  check(Z, 'no pocket within reach to try');
  if (Z) {
    check(!game.S.visited[Z.key], 'the pocket is visited before anything is done');
    const cells = block(w, Z.cx, Z.cy, 4);
    game.haul(cells, cells.length); game.changed(cells);
    check(game.S.visited[Z.key] === 1, 'a pocket whose ground was hauled from outside is still marked as not got to');
  }
}

if (fails.length) { console.error(fails.join('\n')); process.exit(1); }
console.log('ok');
