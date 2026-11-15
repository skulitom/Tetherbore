// A staged view of the world, for tools/shot.mjs to photograph and for looking at a far place by hand:
//   index.html?shot&seed=7&at=0,-300&reach=6&zoom=4&lit&met
// js/main.js loads this file only when the address has `shot`; ordinary play never fetches it.
//
// The view is a fresh world on `seed` (7 if none is given). It reads no saved game and is never saved. The drill
// stands `at` dx,dy cells from the core, east and south counted up, so north is a negative dy. Away from the core
// it stands in a small room at the end of a tunnel carved straight from the core, as test/rope-fuzz.mjs carves a
// far start, so the tether lies as a real one would; whatever lay in the room and the tunnel is gone. All the
// ground in view is uncovered, and looked at as ground that comes into view is, so what stands loose is known.
// `reach` is the level of the tether (if none is given, the first that reaches the room with a little to spare).
// `zoom` shows that many times as many cells across: the game's canvas is that much larger and the page scales
// it down. `lit` leaves out the dark. `met` takes every ground as met before, so the name of the place the drill
// stands in comes up on its plate and not, as the first time, across the screen.
//
// The view is held still: `tetherbore.advance(ms)` steps it, `tetherbore.resume()` lets it play.
import * as world from './world.js';
import { T, UPGRADES } from './game.js';

const { N, C, K } = world, HX = C + 0.5, HY = C + 0.5;
const ROOM = 2;                                 // the room is this many cells out from the drill's own, each way
const MOST = 8192;                              // the widest the zoomed canvas may be, in its own pixels

export function stage(game, query) {
  const number = (name, fallback) => { const text = query.get(name); return text === null || text.trim() === '' || !Number.isFinite(+text) ? fallback : +text; };
  const reaches = UPGRADES.find(u => u.id === 'tether').values;
  const seed = Math.floor(number('seed', 7));
  const [dx = 0, dy = 0] = (query.get('at') ?? '').split(',').map(v => Math.round(+v) || 0);
  const far = Math.hypot(dx, dy), least = reaches.findIndex(R => R >= far + 8);
  const level = Math.max(0, Math.min(reaches.length - 1, Math.floor(number('reach', least < 0 ? reaches.length - 1 : least))));
  const zoom = Math.max(1, number('zoom', 1)), lit = query.has('lit') && query.get('lit') !== '0', met = query.has('met') && query.get('met') !== '0';

  game.save = () => {};
  game.fresh(seed, true);
  game.S.lv.tether = level;
  game.daylight = lit;
  if (met) for (const row of world.BIOMES) if (row) game.S.met[row.id] = 1;
  const d = game.drill, w = game.world;
  if (dx || dy) {
    for (let s = 0; s <= far; s += 0.5) for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) w.setK((C + Math.round(dy * s / far) + v) * N + C + Math.round(dx * s / far) + u, K.EMPTY);
    for (let v = -ROOM; v <= ROOM; v++) for (let u = -ROOM; u <= ROOM; u++) w.setK((C + dy + v) * N + C + dx + u, K.EMPTY);
    d.x = d.px = C + dx + 0.5; d.y = d.py = C + dy + 0.5; d.mode = 'free';
    game.band = [[d.x, d.y], [HX, HY]];
    game.changed();
    // Whoever has come this far has hauled before: the first game's title and its beckoning hand are not shown.
    game.S.stats.hauls = 1; game.S.stats.moves = 2;
  }
  game.cam.x = d.x * T; game.cam.y = d.y * T;

  let shown = 1;                                // the zoom as it came out: no canvas is made wider than MOST
  return {
    seed, at: [dx, dy], level, reach: reaches[level], zoom, lit,
    // After the game has sized its canvas: widen it by the zoom, and uncover all the ground in view.
    fit() {
      const z = shown = Math.max(1, Math.min(zoom, MOST / Math.max(game.W, game.H)));
      if (z > 1) {
        game.W = Math.ceil(game.W * z); game.H = Math.ceil(game.H * z);
        game.canvas.width = game.W; game.canvas.height = game.H;
        game.ctx.imageSmoothingEnabled = false;
        game.scale /= z;
        // Drawn smaller than it is, the canvas is smoothed, not sampled a pixel in every few.
        if (game.scale < 1 && game.canvas.style) game.canvas.style.imageRendering = 'auto';
      }
      const cx = Math.floor(game.cam.x / T), cy = Math.floor(game.cam.y / T), radius = Math.ceil(Math.max(game.W, game.H) / T / 2) + 2;
      w.see(cx, cy, radius);
      for (let y = cy - radius; y <= cy + radius; y++) for (let x = cx - radius; x <= cx + radius; x++) game.spot(y * N + x);
      game.version++;
    },
    // What the view shows, for the tool to say.
    facts() {
      const b = w.b(game.di);
      return {
        seed, at: [dx, dy], level, reach: reaches[level], zoom: shown, lit,
        cells: [Math.round(game.W / T), Math.round(game.H / T)], canvas: [game.W, game.H],
        biome: b, ground: world.BIOMES[b]?.name ?? `${b}`,
        loose: game.pieces.length,
      };
    },
  };
}
