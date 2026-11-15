// The tether passes a wall's corner, goes round a loose rock beyond it and comes back past the same corner: a bight.
// When the rock is reeled in, the bends on it go, and retighten() is left with the same corner twice running, once
// for each way the string turned there. Nothing ever lets that pair go: tend() works out a bend's release from the
// line to the next bend, and here that line has no length.
//   node test/hunt/modes/bight-left-on-corner.mjs
import { makeGame, tetherFaults, C, N, K } from '../harness.mjs';
const game = await makeGame(7, { tether: 3 });
const d = game.drill, w = game.world, at = (x, y) => (C + y) * N + C + x;
// Staged: an open room; a wall filling its upper right (its corner at 9.5, 4.5); a loose 2 x 2 rock below the wall.
for (let y = -8; y <= 20; y++) for (let x = -6; x <= 30; x++) if (Math.abs(x) > 2 || Math.abs(y) > 2) w.setK(at(x, y), x >= 10 && y <= 4 ? K.DENSE : K.EMPTY);
for (const [x, y] of [[18, 6], [19, 6], [18, 7], [19, 7]]) w.setK(at(x, y), K.DENSE);
game.pieces = []; game.changed();
const step = auto => { game.input.auto = auto; game.update(1 / 60); };
const flyTo = (x, y) => { for (let f = 0; f < 900; f++) { const dx = C + 0.5 + x - d.x, dy = C + 0.5 + y - d.y, far = Math.hypot(dx, dy); if (far < 0.12 || d.park) return; step([dx / far, dy / far, Math.min(1, 0.4 + far)]); } };
const rel = () => JSON.stringify(game.band.map(p => [+(p[0] - C - 0.5).toFixed(1), +(p[1] - C - 0.5).toFixed(1), ...(p[2] ? [p[2]] : [])]));
// Played: under the wall's corner, over the rock, down its far side, back under it, up past the corner again.
d.x = C + 2 + 0.5; d.y = C + 2 + 0.5; game.band = [[d.x, d.y], [C + 0.5, C + 0.5]];      // set down just off the core, so no throw
for (const [x, y] of [[8, 5], [22, 5], [22, 9], [15, 9], [8, 7], [5, -4]]) flyTo(x, y);
console.log(`bight made:   ${rel()}  faults ${tetherFaults(game).length}`);
// Home: the rock is found loose and reeled in.
flyTo(0, 0);
for (let f = 0; f < 30; f++) step(null);
console.log(`home, hauls ${game.S.stats.hauls}: ${rel()}`);
// Fly somewhere with a clear line to the core.
d.park = false;
flyTo(-4, 6);
for (let f = 0; f < 30; f++) step(null);
const P = game.band, twice = P.some((p, n) => n > 0 && n + 2 < P.length && p[4] !== undefined && p[4] === P[n + 1][4]);
console.log(`at (-4, 6):   ${rel()}`);
console.log(`the same corner twice running: ${twice}; bends ${P.length - 2} (a clear line to the core needs none); tetherFaults: ${JSON.stringify(tetherFaults(game))}`);
process.exit(P.length > 2 ? 1 : 0);
