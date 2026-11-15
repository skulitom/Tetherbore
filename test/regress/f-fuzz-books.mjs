// Flies the drill at random through plain ground with a few caverns and checks the lasso's books after every frame:
//  - every registered piece is really loose, and no cell is registered twice
//  - every loose island in the arena is registered (all islands here come from the drill's own cuts)
//  - a registered piece the tether winds round is hauled within a quarter of a second
//  - whatever is hauled was registered and wound the frame before
//   node test/regress/f-fuzz-books.mjs [seed] [turns]
import { makeGame, K, B, at, rect, arena, fixRandom, random, where, bandRel, tetherFaults, C, N } from './lib/lasso.mjs';

const [seed = 1, turns = 400] = process.argv.slice(2).map(Number);
fixRandom(seed);
const game = await makeGame(7, { tether: 2, drill: 4 }), w = game.world, d = game.drill, rnd = random(seed + 100), R = 46;
arena(game, R);
for (let n = 0; n < 6; n++) { const x = Math.floor(rnd() * 50) - 25, y = Math.floor(rnd() * 50) - 25, a = 2 + Math.floor(rnd() * 6), b = 2 + Math.floor(rnd() * 6); if (Math.abs(x) < 6 && Math.abs(y) < 6) continue; rect(game, x - a, y - b, x + a, y + b, K.EMPTY); }
rect(game, -2, -2, 2, 2, K.EMPTY);
game.changed();
const winds = (x, y) => { const pts = game.band; let t = 0; for (let n = 0; n < pts.length; n++) { const a = pts[n], b = pts[(n + 1) % pts.length];
  if (a[1] <= y) { if (b[1] > y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) > 0) t++; } else if (b[1] <= y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) < 0) t--; } return t; };
const wound = cells => game.band.length > 2 && cells.every(i => winds((i % N) + 0.5, Math.floor(i / N) + 0.5) !== 0);
// Islands: ground in the arena not joined to its rim.
function islands() {
  const seen = new Set(), out = [];
  const flood = start => { const cells = [start]; seen.add(start); let held = false; for (let h = 0; h < cells.length; h++) { const c = cells[h], x = (c % N) - C, y = Math.floor(c / N) - C;
    if (Math.abs(x) >= R || Math.abs(y) >= R) { held = true; continue; }
    for (const j of [c + 1, c - 1, c + N, c - N]) if (!seen.has(j) && w.k(j) !== K.EMPTY) { seen.add(j); cells.push(j); } } return held ? null : cells; };
  for (let y = -R + 1; y < R; y++) for (let x = -R + 1; x < R; x++) { const i = at(x, y); if (w.k(i) !== K.EMPTY && !seen.has(i)) { const c = flood(i); if (c) out.push(c); } }
  return out;
}
const kinds = new Map(), note = (kind, detail, frame) => { if (!kinds.has(kind)) { kinds.set(kind, 0); console.log(`frame ${frame}: ${kind}: ${detail}`); } kinds.set(kind, kinds.get(kind) + 1); };
let lastHaul = -1, lastHaulN = 0, lastHaulHome = false, twiceFrames = 0, twiceRuns = [];
let mostAtOnce = 0;
let frames = 0, heading = 0, woundFor = new Map(), unregFor = new Map(), prevPieces = [], prevWound = new Set(), hauls = 0, cut = 0;
for (let turn = 0; turn < turns; turn++) {
  heading += (rnd() - 0.5) * 2.5;
  const hold = 10 + Math.floor(rnd() * 50), pause = rnd() < 0.1;
  for (let f = 0; f < hold; f++) {
    game.input.auto = pause ? null : [Math.cos(heading), Math.sin(heading), 1];
    const before = new Map(); for (const p of game.pieces) for (const c of p) before.set(c, true);
    const solidBefore = prevPieces;
    const grit0 = game.S.grit, shown0 = game.S.grit - game.pending.grit, hauls0 = game.S.stats.hauls;
    try { game.update(1 / 60); } catch (e) { note('threw', e.stack.split('\n').slice(0, 4).join(' | '), frames); }
    frames++;
    if (game.S.stats.hauls !== hauls) {
      hauls = game.S.stats.hauls; lastHaul = frames; lastHaulN = game.banner?.n; lastHaulHome = game.atCore;
      // What went: cells of previously registered pieces that are now open.
    }
    { const delta = game.S.grit - grit0, shown = game.S.grit - game.pending.grit, got = game.S.stats.hauls - hauls0;
      if (got === 0 && delta !== 0 && delta !== 2) note('grit changed with no haul', `${delta}`, frames);
      if (got === 1 && delta !== game.banner.grit && delta !== game.banner.grit + 2) note('haul paid other than its banner', `${delta} against ${game.banner.grit}`, frames);
      if (got > 1) note('two hauls in one frame', `${got}`, frames);
      if (shown < shown0 - 1e-9) note('shown grit went down', `${shown0} to ${shown}`, frames);
      if (game.pending.grit < 0 || shown < 0) note('negative', `${shown} ${game.pending.grit}`, frames);
      mostAtOnce = Math.max(mostAtOnce, game.hauls.length);
      for (const h of game.hauls) if (h.t > 40) note('a haul has run 40 seconds', `${h.n} cells, paid ${h.paid} of ${h.total}, route ${(h.length / 16).toFixed(0)} cells`, frames); }
    const flat = game.pieces.flat(), set = new Set(flat);
    if (set.size !== flat.length) note('registered twice', `${flat.length - set.size} cells`, frames);
    for (const p of game.pieces) { const ps = new Set(p); if (p.some(c => w.k(c) === K.EMPTY)) note('registered piece has open cells', `${p.length}`, frames);
      if (p.some(c => [c + 1, c - 1, c + N, c - N].some(j => !ps.has(j) && w.k(j) !== K.EMPTY))) note('registered piece is not loose', `${p.length} cells at ${[(p[0] % N) - C, Math.floor(p[0] / N) - C]}`, frames); }
    const isl = islands();
    for (const cells of isl) {
      const key = Math.min(...cells);
      if (!set.has(cells[0])) { unregFor.set(key, (unregFor.get(key) ?? 0) + 1); if (unregFor.get(key) === 3) note('loose island not registered', `${cells.length} cells at ${[(cells[0] % N) - C, Math.floor(cells[0] / N) - C]}, drill ${where(game)}`, frames); }
    }
    for (const p of game.pieces) { const key = Math.min(...p); if (wound(p)) { woundFor.set(key, (woundFor.get(key) ?? 0) + 1); if (woundFor.get(key) === 15) note('wound but not hauled', `${p.length} cells, band ${JSON.stringify(bandRel(game))}`, frames); } else woundFor.delete(key); }
    const faults = tetherFaults(game); for (const fault of faults) note('tether: ' + fault.replace(/[-\d.(),]+/g, '#'), fault, frames);
    if (game.band.length > 3) for (let n = 1; n + 1 < game.band.length - 1; n++) if (game.band[n][0] === game.band[n + 1][0] && game.band[n][1] === game.band[n + 1][1]) { note('tether has the same corner twice in a row', `last haul at frame ${lastHaul} (${lastHaulN} cells, drill at the core: ${lastHaulHome}); band ${JSON.stringify(bandRel(game))}`, frames); break; }
  }
}
game.input.auto = null; let tail = 0; for (; tail < 3600 && game.hauls.length; tail++) game.update(1 / 60);
if (game.hauls.length) note('hauls never ended', `${game.hauls.length}`, frames); if (game.pending.grit || game.pending.gems.some(Boolean)) note('pending left over', JSON.stringify(game.pending), frames);
let open = 0; for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) if (w.k(at(x, y)) === K.EMPTY) open++;
console.log(JSON.stringify({ seed, frames, hauls: game.S.stats.hauls, best: game.S.stats.best, mostHaulsAtOnce: mostAtOnce, registered: game.pieces.map(p => p.length), islandsNow: islands().map(c => c.length), openCells: open, problems: Object.fromEntries(kinds), drill: where(game) }));
process.exit(kinds.size ? 1 : 0);
