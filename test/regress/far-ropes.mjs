// Far from the core the ropes cost no more to draw than beside it. On the fine canvas the tether, and the rope of
// every haul on its way home, was traced whole in every frame, three times each: a thousand cells out, with a dozen
// hauls under way, that was a dozen ropes twenty thousand pixels long, nearly all of every one off the screen, and
// drawing them took four times as long as the same hauls beside the core. Only the part of a rope that crosses the
// view is traced now, its braid begun where the whole rope would have it (and the light that runs along a long
// reach's tether, where the whole tether would have it); and the map walks only the spans of tether that lie on it.
import { makeGame, C, N, K } from '../harness.mjs';
import { fly } from '../../tools/fly.mjs';

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const near = (a, b) => Math.abs(a - b) < 1e-6;

// ---- the parts of a rope that cross the view (the view is 180 by 320)
{
  const game = await makeGame(7);
  game.resize(360, 640, 2);
  const { W, H } = game, arc = 3.5 * Math.PI / 2;
  // Wholly in view: the whole rope, begun at its beginning.
  check(JSON.stringify(game.ropeRuns([[10, 10], [60, 40], [90, 200], [170, 300]], true)) === '[[0,3,0]]', `a rope wholly in view is traced as ${JSON.stringify(game.ropeRuns([[10, 10], [60, 40], [90, 200], [170, 300]], true))}`);
  // Wholly out of view: nothing.
  check(game.ropeRuns([[-900, 50], [-500, 50], [-200, 90]], true).length === 0 && game.ropeRuns([[40, H + 80], [90, H + 300]], true).length === 0, 'a rope that lies wholly off the screen is traced');
  // Straight in from ten thousand pixels away, a point every hundred: the last spans, begun as far along as they lie.
  {
    const pts = []; for (let x = -10000; x <= 100; x += 100) pts.push([x, 120]);
    const runs = game.ropeRuns(pts, true), [from, to, along] = runs[0] ?? [];
    check(runs.length === 1 && to === pts.length - 1 && from >= pts.length - 5 && near(along, pts[from][0] + 10000), `a straight rope from far off is traced as ${JSON.stringify(runs)} of ${pts.length} points`);
  }
  // Round two square corners far off, then straight into view: the distance is along the arcs, not through the corners.
  {
    const pts = [[-1000, 50], [-500, 50], [-500, 100], [-400, 100], [-300, 100], [50, 100], [100, 100]], runs = game.ropeRuns(pts, true);
    check(runs.length === 1 && runs[0][0] === 3 && runs[0][1] === 6 && near(runs[0][2], 650 - 2 * (7 - arc)), `round two corners and into view: ${JSON.stringify(runs)}, where the part should begin ${(650 - 2 * (7 - arc)).toFixed(4)} along`);
  }
  // A part that begins at a corner begins at the corner's point: short of the end of its arc by the tangent.
  {
    const pts = [[-2000, 50], [-1000, 50], [-1000, 100], [-500, 100], [60, 100]], runs = game.ropeRuns(pts, true);
    check(runs.length === 1 && runs[0][0] === 2 && near(runs[0][2], 996.5 + arc + 43 + arc - 3.5), `a part begun at a corner: ${JSON.stringify(runs)}, where it should begin ${(996.5 + arc + 43 + arc - 3.5).toFixed(4)} along`);
  }
  // In view twice, with a long way round between: two parts, each with its own beginning; and no distance is
  // worked out for a rope with no braid.
  {
    const pts = [[20, 20], [60, 30], [600, 30], [1200, 30], [1200, 900], [600, 900], [600, 200], [90, 200], [40, 260]], runs = game.ropeRuns(pts, true);
    check(runs.length === 2 && runs[0][0] === 0 && runs[0][2] === 0 && runs[1][1] === 8 && runs[1][2] > 2000 && game.ropeRuns(pts, false)[1][2] === 0, `a rope in view twice: ${JSON.stringify(runs)}`);
  }
}

// ---- the game, far out, with hauls on their way home
const traced = async far => {
  const game = await makeGame(7, { tether: 9, drill: 4, momentum: 4, winch: 4, maprange: 1 }), w = game.world;
  // A fine canvas that counts what is traced on it.
  const count = { path: 0, strokes: 0, offsets: [] }, own = { lineDashOffset: 0, dash: [] };
  game.over = {}; game.overCtx = new Proxy(own, {
    get: (target, key) => key === 'lineTo' || key === 'arcTo' || key === 'quadraticCurveTo' || key === 'moveTo' ? () => { count.path++; } : key === 'stroke' ? () => { count.strokes++; count.offsets.push([target.lineDashOffset, target.dash.reduce((a, b) => a + b, 0)]); }
      : key === 'setLineDash' ? pattern => { target.dash = pattern; } : key in target ? target[key] : () => {},
    set: (target, key, value) => { target[key] = value; return true; },
  });
  game.resize(360, 640, 3);
  // The way out: legs of 40 cells, each turned ten cells aside from the last, three cells wide.
  const stops = []; let side = 1;
  for (let r = 6; r <= far; r += 40) { stops.push([C + r, C + side * 10]); side = -side; }
  let [px, py] = [C, C];
  for (const [x, y] of stops) { const n = Math.max(Math.abs(x - px), Math.abs(y - py)); for (let s = 0; s <= n; s++) { const cx = Math.round(px + (x - px) * s / n), cy = Math.round(py + (y - py) * s / n); for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) w.setK((cy + v) * N + cx + u, K.EMPTY); } [px, py] = [x, y]; }
  game.changed();
  const clock = { t: 0 };
  for (const [x, y] of stops) fly(game, x, y, clock, null, 900);
  // A dozen small hauls beside the drill, a moment on their way.
  const d = game.drill, x0 = Math.floor(d.x) - 12, y0 = Math.floor(d.y) + 4;
  for (let m = 0; m < 12; m++) { const cells = []; for (let v = 0; v < 3; v++) for (let u = 0; u < 3; u++) cells.push((y0 + v + (m >> 3) * 4) * N + x0 + u + (m & 7) * 4); game.haul(cells); }
  game.hitstop = 0;
  for (let f = 0; f < 50; f++) game.update(1 / 60);
  count.path = 0; count.strokes = 0; count.offsets.length = 0;
  game.render();
  // And what the map in the corner draws.
  let rects = 0;
  const fill = game.ctx.fillRect;
  game.ctx.fillRect = () => { rects++; };
  game.drawMap(game.W - 53, 7);
  game.ctx.fillRect = fill;
  return { out: Math.round(game.far), band: game.band.length, ropes: game.ropes.length, ...count, rects };
};
const beside = await traced(90), out = await traced(1300);
check(out.out > 1200 && out.band > 60 && beside.band < 12, `the far flight came ${out.out} cells out on a tether of ${out.band} points, the near one ${beside.out} out on ${beside.band}`);
check(out.ropes >= 13 && beside.ropes >= 13, `with a dozen hauls on their way there are ${out.ropes} ropes far out and ${beside.ropes} beside the core`);
// (Traced whole, the far frame was some three thousand steps of path; in view there is the same to draw as beside the core.)
check(out.path <= beside.path * 1.5 + 60, `a frame's ropes are ${out.path} steps of path ${out.out} cells out and ${beside.path} beside the core`);
// (Each dashed stroke begins within its own pattern: a braid's four pixels, the tether's lights their own.)
const within = ([o, period]) => Number.isFinite(o) && o >= 0 && (o === 0 || o < period);
check(out.offsets.every(within), `the braid of a rope far out begins at ${out.offsets.filter(o => !within(o)).slice(0, 4).map(o => o.join(' of '))}`);
check(out.rects <= beside.rects + 120, `the map in the corner draws ${out.rects} marks ${out.out} cells out and ${beside.rects} beside the core`);

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : `no defect: ${out.out} cells out with a dozen hauls on their way, a frame's ropes are ${out.path} steps of path (${beside.path} beside the core) and the map draws ${out.rects} marks (${beside.rects}); a part of a rope begins its braid where the whole rope has it`);
process.exit(fails.length ? 1 : 0);
