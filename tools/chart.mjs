// The chart of the whole reach (the MAP tab of the bar's panel) as a new game has it, with no browser: what the
// player sees of the world before going anywhere, the reach about the core drawn whole and the marks the chart draws
// over it (the core, the relics, the shrines, finds and pockets the finder knows), each pixel scaled up three times.
//   node tools/chart.mjs <out.png> [--seed 7] [--reach 9] [--size 300] [--gen 2] [--tree <a checkout of the game>]
//
//   --reach n   the level of the tether, 0 to 9 (7 reaches 950 cells, 9 the last, 2,300); the chart is that reach
//               about the core, four cells more each way.
//   --size n    the chart is n pixels across before it is scaled up (the game's own is as wide as the panel).
//   --gen n     the world laid by the rules of generation n (js/world.js: GEN): 1 is the world as an older game's
//               unseen ground was laid, before the seams and the deep strains.
//   --tree dir  the game in another checkout (a git worktree of an older commit, say), drawn by its own code: how
//               the chart looked before. (`--gen` is not asked of a game that has no generations.)
//
// The game is new on the seed with the chart, the reach and the finder's last level bought, and nothing seen but
// the core: every ground on it is drawn as unseen ground is (js/drawing.js: `unseenShade`). `docs/shots/chart-*.png`
// are its pictures of world 7, against the complaint that began the seams: the four diagonal quarters read as flat
// dark slabs of one ground each.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const arg = (name, fallback) => { const n = process.argv.indexOf(`--${name}`); return n < 0 ? fallback : process.argv[n + 1]; };
const out = process.argv[2];
if (!out || out.startsWith('--')) { console.log('node tools/chart.mjs <out.png> [--seed 7] [--reach 9] [--size 300] [--gen 2] [--tree <checkout>]'); process.exit(1); }
const seed = Number(arg('seed', 7)), level = Number(arg('reach', 9)), size = Number(arg('size', 300)), gen = Number(arg('gen', 2));
const root = pathToFileURL(resolve(arg('tree', fileURLToPath(new URL('..', import.meta.url)))) + '/');
const { makeGame, C } = await import(new URL('test/harness.mjs', root));
const { encodePNG } = await import(new URL('tools/png.mjs', root));

const game = await makeGame(seed, { tether: level, chart: 1, mapfinder: 3 }), w = game.world;
if (w.genOf && gen !== w.genOf[0]) { w.genOf.fill(gen); w.forget?.(); game.begin(); }
const R = game.val('tether'), per = (2 * R + 8) / size;
// The marks are drawn as small squares over the picture: they are taken as the chart's context is asked to fill them.
const marks = [], ctx = game.ctx;
ctx.fillRect = function (x, y, ww, hh) { marks.push([this.fillStyle, x, y, ww, hh]); };
game.chartMap = {};
game.drawMap(0, 0, { size, per, cx: C + 0.5, cy: C + 0.5 });
const data = game.chartMap.mapData.data, S = 3, W = size * S, px = new Uint8ClampedArray(W * W * 4);
for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
  const o = (Math.floor(y / S) * size + Math.floor(x / S)) * 4, p = (y * W + x) * 4;
  px[p] = data[o]; px[p + 1] = data[o + 1]; px[p + 2] = data[o + 2]; px[p + 3] = 255;
}
const rgb = s => { if (typeof s !== 'string' || !s.startsWith('#')) return null; const h = s.length === 4 ? s.slice(1).split('').map(c => c + c).join('') : s.slice(1, 7); return [0, 2, 4].map(n => parseInt(h.slice(n, n + 2), 16)); };
for (const [style, x, y, ww, hh] of marks) {
  const c = rgb(style); if (!c || ww > 6 || hh > 6) continue;
  for (let v = Math.round(y * S); v < (y + hh) * S; v++) for (let u = Math.round(x * S); u < (x + ww) * S; u++) {
    if (u < 0 || v < 0 || u >= W || v >= W) continue;
    const p = (v * W + u) * 4; px[p] = c[0]; px[p + 1] = c[1]; px[p + 2] = c[2];
  }
}
writeFileSync(out, encodePNG(W, W, px));
console.log(`world ${seed}: the chart of reach ${R}, ${size} pixels of ${per.toFixed(1)} cells${w.genOf ? `, generation ${w.genOf[0]}` : ''}; ${W} x ${W} pixels\n${out}`);
