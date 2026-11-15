// Hand-made cases with lengths worked out by hand. Each prints what was expected and what the band was.
//   node test/regress/a-cases.mjs
import { makeGame, tetherFaults, C, N, K, HX, HY, idx, arena, rocks, place, flyTo, settle, Oracle, showBand, bandLength } from './lib/rig.mjs';
let failed = 0;
const near = (a, b) => Math.abs(a - b) < 1e-9;
const report = (name, ok, text) => { if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${text}`); };
async function scene(cells, box = [-4, -12, 30, 12]) {
  const game = await makeGame(4, { tether: 9 });
  arena(game, ...box);
  rocks(game, cells);
  game.changed();
  const oracle = new Oracle(game, box);
  let bad = 0, frames = 0;
  const each = () => { frames++; oracle.step(); if (tetherFaults(game).length || oracle.mismatch()) { if (!bad) console.log(`   first fault at frame ${frames}: ${tetherFaults(game).join('; ')} ${oracle.mismatch()} band ${showBand(game)}`); bad++; } };
  return { game, oracle, each, bad: () => bad, go: pts => { for (const [x, y] of pts) flyTo(game, x, y, { each, m: 0.3 }); } };
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

{ // 1. One pillar, wound three times round and unwound the same way back.
  const s = await scene([[15, 0]]), d = s.game.drill, ring = [[13, -2.5], [17.5, -2.5], [17.5, 2.5], [13, 2.5]];
  s.go([[13, -2.5]]);
  for (let k = 0; k < 3; k++) s.go([ring[1], ring[2], ring[3], ring[0]]);
  // by hand: core -> (15,1) is the first corner met going clockwise from the north-west... worked out from the band's own order
  const P = s.game.band, wound = P.length - 2;
  // every span between bends is one side of the cell; the two end spans are straight to the drill and the core
  let sides = 0; for (let n = 2; n < P.length - 1; n++) sides += dist(P[n], P[n - 1]);
  const expect = dist(P[0], P[1]) + (wound - 1) + dist(P[P.length - 2], P[P.length - 1]);
  report('three turns round one cell', s.bad() === 0 && wound >= 12 && wound <= 13 && near(sides, wound - 1) && near(bandLength(s.game), expect), `${wound} bends, each one cell from the last (sum ${sides}), length ${bandLength(s.game).toFixed(6)}`);
  for (let k = 0; k < 3; k++) s.go([ring[3], ring[2], ring[1], ring[0]]);
  report('unwound in reverse', s.bad() === 0 && s.game.band.length === 2, `band ${showBand(s.game)}`);
}
{ // 2. Two cells touching at a corner, wound twice round: six corners a turn, never the pinch itself.
  const s = await scene([[15, 0], [16, 1]]), ring = [[13, -2.5], [19, -2.5], [19, 4], [13, 4]];
  s.go([ring[0]]);
  for (let k = 0; k < 2; k++) s.go([ring[1], ring[2], ring[3], ring[0]]);
  const P = s.game.band, pinch = P.slice(1, -1).filter(b => b[0] === C + 16 && b[1] === C + 1).length;
  let inner = 0; for (let n = 2; n < P.length - 1; n++) inner += dist(P[n], P[n - 1]);
  const per = 4 + 2 * Math.SQRT2, bends = P.length - 2;      // the hull of two diagonal cells: four unit sides and two diagonals
  // inner spans go round the hull: each full turn is `per`
  const turns = Math.floor((bends - 1) / 6), rest = inner - turns * per;
  report('two turns round a pinched pair', s.bad() === 0 && pinch === 0 && bends === 12 && near(inner, 2 * per - 1), `${bends} bends, none at the pinch, inner length ${inner.toFixed(6)} = ${turns} x ${per.toFixed(6)} + ${rest.toFixed(6)}`);
  for (let k = 0; k < 2; k++) s.go([ring[3], ring[2], ring[1], ring[0]]);
  s.go([[5, 0]]);
  report('pinched pair unwound', s.bad() === 0 && s.game.band.length === 2, `band ${showBand(s.game)}`);
}
{ // 3. A one-cell-wide passage that makes a U-turn round a single cell.
  const cells = [];
  for (let x = 10; x <= 14; x++) for (let y = -2; y <= 2; y++) if (!(x >= 11 && x <= 13 && y >= -1 && y <= 1) || (x === 12 && y === 0) || (x === 11 && y === 0)) cells.push([x, y]);
  // ring passage round the cell (12,0), walled off on the west (11,0) so it is a U; opened to the hall at (10,-1) and (10,1)
  const open = [[10, -1], [10, 1]], solid = cells.filter(([x, y]) => !open.some(o => o[0] === x && o[1] === y));
  const s = await scene(solid);
  s.go([[8, -1], [11, -1], [13, -1], [13, 1], [11, 1], [8, 1]]);
  const P = s.game.band;
  // by hand the string hugs the island (11..12, 0): the corners (13,0), (13,1) on its east end, and the mouths' corners
  report('U-turn in a one-wide passage', s.bad() === 0 && P.length > 4, `band ${showBand(s.game)} length ${bandLength(s.game).toFixed(4)}`);
  s.go([[11, 1], [13, 1], [13, -1], [11, -1], [8, -1], [4, 0]]);
  report('U-turn unwound', s.bad() === 0 && s.game.band.length === 2, `band ${showBand(s.game)}`);
}
{ // 4. The drill held exactly on the line through two bends (a wall's bottom face), and exactly along a wall face.
  const s = await scene([[10, -5], [10, -4], [10, -3]]), g = s.game, d = g.drill;   // a wall: column 10, rows -5..-3
  s.go([[13, 0], [13, -1.2]]);                   // east under the wall and up a little: bends on both bottom corners
  const before = showBand(g);
  const hold = (x, y, frames, steer) => { let zero = 0; for (let f = 0; f < frames; f++) { if (x !== null) d.x = x; if (y !== null) d.y = y; g.input.auto = steer(f); g.update(1 / 60); if (x !== null) d.x = x; if (y !== null) d.y = y; g.tend(); s.each(); const P = g.band; if (P.length >= 4) { const a = P[0], b = P[1], c = P[2]; if ((b[0] - c[0]) * (a[1] - b[1]) - (b[1] - c[1]) * (a[0] - b[0]) === 0) zero++; } } return zero; };
  // exactly on the line of the bottom face, y = C - 2, flown east and back west along it
  const zeroA = hold(null, C - 2, 90, f => [f < 45 ? 1 : -1, 0, 0.2]);
  const onLine = showBand(g);
  s.go([[13, -1]]);                              // below the line: still round both
  const below = g.band.length - 2;
  s.go([[13, -3]]);                              // above it: still both (the string now leans on the east face's corner)
  // now exactly along the east face, x = C + 11, north of the wall's top
  s.go([[12.5, -6.5]]);
  const zeroB = hold(C + 11, null, 60, f => [0, f < 30 ? -1 : 1, 0.1]);
  const onFace = showBand(g);
  s.go([[10.4, -6.6]]);                          // west of the face line: the top corner is caught
  const west = showBand(g);
  s.go([[12.5, -6.5]]);                          // east again: let go
  report('exactly on the line through two bends, and along a face', s.bad() === 0 && g.band.length === 3, `under the wall ${before}; on the bottom line (${zeroA} frames of zero turn) ${onLine}; on the east face's line (${zeroB} zero-turn frames) ${onFace}; west of it ${west}; east again ${showBand(g)}`);
}
{ // 5. Corners exactly in line from the core: an exact diagonal throw past a staircase, then a step to either side.
  const stairs = []; for (let k = 4; k <= 12; k++) stairs.push([k, k - 1]);   // cells just above the diagonal: corners (k,k) on it
  const s = await scene(stairs, [-4, -6, 22, 22]), g = s.game, d = g.drill;
  g.key('ArrowRight', true); g.key('ArrowDown', true);
  for (let f = 0; f < 40; f++) { g.update(1 / 60); s.each(); }
  g.key('ArrowRight', false); g.key('ArrowDown', false);
  settle(g, 10, s.each);
  const exact = d.x - HX === d.y - HY, thrown = showBand(g);
  s.go([[d.x - HX + 2, d.y - HY - 1]]);          // a step toward the stairs' side: the furthest corner in line is the bend
  const P = g.band, first = P.length === 3 ? [P[1][0] - C, P[1][1] - C] : null;
  report('several corners on one line', s.bad() === 0 && exact && first && first[0] === first[1], `thrown along the exact diagonal (${exact}): ${thrown}; after a step aside: ${showBand(g)}`);
}
console.log(failed ? `${failed} case(s) failed` : 'all cases as worked out by hand');
process.exit(failed ? 1 : 0);
