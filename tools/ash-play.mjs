// An ash flat played with no hand on it and no browser (docs/CONTENT-PLAN.md, content item 7): the drill comes to
// the flat's edge at the end of a tunnel and ploughs one great round loop through the ash, as a thumb would draw
// it, steered by a heading that turns all the time and never by cells; where the loop closes on itself the ash
// inside hangs loose with its tektites in it and is reeled in. What it took and what it paid is printed.
//   node tools/ash-play.mjs [--seed 7] [--flat n] [--loop share] [--tether level] [--drill level]
//
//   --seed n       the world (7)
//   --flat n       which of the world's ash flats, counted from the nearest the core (0, the default; `node
//                  tools/zone-budget.mjs --where <seed>` lists a world's pockets in that order)
//   --loop x       how wide a loop: its radius as a share of the flat's own (0.62)
//   --tether n     the level of reach; if not given, the first that goes round the flat. With it go the levels of
//                  bit, winch and ram a player holds by then (tools/slab-play.mjs: `holds`)
//   --drill n      the level of the bit, whatever the reach
//
// `play` returns what happened; test/regress/c7-ash-play.mjs holds flats of world 7 to it.
import { fileURLToPath } from 'node:url';
import { makeGame, random, tetherFaults, UPGRADES, income, C, N, K, world } from '../test/harness.mjs';
import { holds } from './slab-play.mjs';

const { rowOf } = world, HX = C + 0.5, HY = C + 0.5;

// A world's ash flats, the nearest the core first.
export const flatsOf = (w, far = 2300) => w.pocketsWithin(far).filter(Z => rowOf(Z.row).pocket.shape === 'ash');

// Plays ash flat number `pick` of world `seed`: one loop, `share` of the flat's radius in radius, about its middle.
// Returns
//   { flat, levels, tektites (cells of its mineral in the flat), loop (the loop's radius), hauled: [{ n, ash (how
//     many of its cells were the flat's), minerals, paid, lump (what its tektites pay by themselves), spec, light,
//     title, says (the first line under its banner's title) }] (every haul made), n, minerals (cells and tektites brought home in all), cut
//     (cells the drill cut), crushed (tektites among them), said (how many times CRUSHED came up), t (seconds from
//     the flat's edge to the last haul), lap (seconds the loop took), pace (cells cut a second on the loop), speed
//     (cells flown a second on the loop), run (the longest the drill's run went unbroken, in seconds: pushing
//     into ground breaks it, but ploughed ground does not), grit, rate (grit a second, over the model's income
//     there), worstMs, faults, game }
export async function play(seed = 7, pick = 0, share = 0.62, lv = {}) {
  Math.random = random(seed + 5);
  const probe = new world.World(); probe.reset(seed);
  const at = flatsOf(probe)[pick], far = Math.hypot(at.cx - C, at.cy - C);
  const level = lv.tether ?? UPGRADES[0].values.findIndex(R => R >= far + at.reach + 2), levels = { ...holds(level), ...lv };
  const game = await makeGame(seed, levels), w = game.world, d = game.drill, Z = flatsOf(w)[pick], P = rowOf(Z.row).pocket;
  // The tunnel, three cells wide, to where the loop is to begin: on the loop, on the side nearest the core.
  const ux = (Z.cx - C) / far, uy = (Z.cy - C) / far, R = Z.rho * share, len = far - R;
  for (let s = 0; s <= len; s += 0.5) for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) w.setK((C + Math.round(uy * s) + v) * N + C + Math.round(ux * s) + u, K.EMPTY);
  d.x = C + Math.round(ux * len) + 0.5; d.y = C + Math.round(uy * len) + 0.5; d.mode = 'free';
  game.band = [[d.x, d.y], [HX, HY]];
  game.changed();
  let tektites = 0;
  for (let y = Z.cy - 40; y <= Z.cy + 40; y++) for (let x = Z.cx - 40; x <= Z.cx + 40; x++) if (w.b(y * N + x) === Z.row && w.k(y * N + x) === Z.mineral) tektites++;
  const out = { flat: Z, levels, tektites, loop: R, hauled: [], n: 0, minerals: 0, cut: 0, crushed: 0, said: 0, t: 0, lap: 0, pace: 0, speed: 0, run: 0, grit: 0, rate: 0, worstMs: 0, faults: [], game };
  const finish = game.finishDig.bind(game), popup = game.popup.bind(game), haul = game.haul.bind(game);
  game.finishDig = i => { out.cut++; if (w.k(i) === Z.mineral) out.crushed++; finish(i); };
  game.popup = (x, y, label, ...rest) => { if (label === 'CRUSHED') out.said++; popup(x, y, label, ...rest); };
  // (What a haul's tektites pay by themselves, worked out here from the cells before they go: half a second of
  // what cutting earns out there, each.)
  const round2 = n => { const unit = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1); return Math.round(n / unit) * unit; };
  game.haul = cells => {
    const ash = cells.filter(i => w.b(i) === Z.row).length, lump = cells.reduce((sum, i) => sum + (w.b(i) === Z.row && w.k(i) === Z.mineral ? round2(income(Math.max(22, Math.hypot(i % N - C, Math.floor(i / N) - C))) * P.lump) : 0), 0);
    haul(cells);
    const h = game.hauled;
    out.hauled.push({ n: h.n, ash, minerals: h.minerals, paid: h.grit, lump, spec: h.spec, light: h.light, title: h.title, says: h.light ? null : game.bannerSays(h)[0] }); out.n += h.n; out.minerals += h.minerals;
  };
  // Round the loop: the drill is steered at a point a little way on round the circle from where it is, so the
  // heading turns all the time, a degree or two a frame. Once and an eighth round, or until the loop's haul.
  const mx = Z.cx + 0.5, my = Z.cy + 0.5, a0 = Math.atan2(d.y - my, d.x - mx);
  let turned = 0, last = a0, flown = 0, frames = 0, t = 0;
  while (turned < Math.PI * 2.25 && frames < 60 * 90 && !out.hauled.some(h => h.n > R * R)) {
    const a = Math.atan2(d.y - my, d.x - mx), ahead = a + Math.min(0.9, 2.2 / R), tx = mx + Math.cos(ahead) * R, ty = my + Math.sin(ahead) * R, gap = Math.hypot(tx - d.x, ty - d.y) || 1;
    const px = d.x, py = d.y;
    game.input.auto = [(tx - d.x) / gap, (ty - d.y) / gap, 1];
    const began = performance.now();
    game.update(1 / 60);
    out.worstMs = Math.max(out.worstMs, performance.now() - began);
    frames++; t += 1 / 60;
    flown += Math.hypot(d.x - px, d.y - py);
    out.run = Math.max(out.run, d.run);
    let step = a - last; if (step > Math.PI) step -= 2 * Math.PI; if (step < -Math.PI) step += 2 * Math.PI;
    turned += step; last = a;
    if (frames % 6 === 0) for (const f of tetherFaults(game)) if (out.faults.length < 8) out.faults.push(`${t.toFixed(1)} s: ${f}`);
  }
  out.lap = t; out.pace = out.cut / (t || 1); out.speed = flown / (t || 1);
  game.input.auto = null;
  for (let f = 0; f < 30; f++) { game.update(1 / 60); t += 1 / 60; }
  out.t = t; out.grit = game.S.grit; out.rate = out.grit / t / income(far);
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (name, fallback) => { const n = process.argv.indexOf(`--${name}`); return n < 0 ? fallback : process.argv[n + 1]; };
  const lv = {};
  if (arg('tether') !== undefined) lv.tether = Number(arg('tether'));
  if (arg('drill') !== undefined) lv.drill = Number(arg('drill'));
  const r = await play(Number(arg('seed', 7)), Number(arg('flat', 0)), Number(arg('loop', 0.62)), lv), Z = r.flat;
  console.log(`seed ${arg('seed', 7)}: the ash flat at ${Z.cx - C},${Z.cy - C} (${Math.round(Math.hypot(Z.cx - C, Z.cy - C))} out), radius ${Z.rho.toFixed(1)}${Z.herald ? ', a herald' : ''}: ${r.tektites} tektites; reach ${UPGRADES[0].values[r.levels.tether]}, bit ${r.levels.drill}, ram ${r.levels.momentum}`);
  console.log(`  a loop ${r.loop.toFixed(1)} cells in radius took ${r.lap.toFixed(1)} s: ${r.cut} cells cut, ${r.pace.toFixed(1)} a second, flying ${r.speed.toFixed(1)} cells a second; ${r.crushed} tektites crushed, CRUSHED said ${r.said} times; its run unbroken for ${r.run.toFixed(1)} s`);
  for (const h of r.hauled) console.log(`  a haul of ${h.n} cells${h.light ? ' (light)' : `: ${h.title}`}, ${h.minerals} tektites, +${h.paid} grit, +${h.spec} specimens`);
  console.log(`  ${r.minerals} of ${r.tektites} tektites home in ${r.t.toFixed(1)} s: ${r.grit} grit, ${r.rate.toFixed(2)} times the model's income there; worst frame ${r.worstMs.toFixed(1)} ms; tether faults: ${r.faults.length ? r.faults.join('; ') : 'none'}`);
}
