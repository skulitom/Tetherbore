// What a frame allocates and asks of the canvas, with no browser: test/frame-time.mjs's flight (seed 11, 600 turns,
// the tether at 5 and the bit at 4, every other row at its last level, 360 by 640 at dpr 1 so 180 by 320) in the
// checkout named, run by tools/bench.mjs as a child of its own for each root.
//   node --max-semi-space-size=512 --min-semi-space-size=512 tools/bench/alloc-child.mjs <root> bytes|count [--seed 11] [--turns 600] [--fauna] [--size 360x640]
//                                                                       [--rows max|plain]
// (--rows plain: the rows as the flight buys them, the tether and the bit alone, as the step flies it.)
// bytes: the heap used before and after update() and render() of every frame (v8.getHeapStatistics, less what asking
//        costs), with a young generation so large that a scavenge falls in few frames; a frame in which the heap
//        shrank is not counted. The game's two canvases have contexts that do nothing and keep their state as plain
//        properties; the canvases the game makes for itself are the harness's stand-in, as test/frame-time.mjs has
//        them (each method asked of one makes a closure, so a call to one counts a few dozen bytes).
// count: every call to every context per frame, by context (game, over, and `off`: a canvas the game made), by
//        method and by the part of the drawing it came from (the innermost of the drawing's methods named in PARTS);
//        drawImage by its source (`font`: a tinted copy of the pixel font, `tint`: of another sheet, `sheet`: a sheet,
//        `lines`: a page of js/atlas.js's pictures of lines of text, `canvas`: any other canvas); and each state set,
//        with how many set the value already there (`same`).
// Prints one line of JSON.
import v8 from 'node:v8';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const [rootArg, mode] = process.argv.slice(2), args = process.argv.slice(4);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const root = path.resolve(rootArg), url = f => pathToFileURL(path.join(root, f)).href;
const seed = Number(opt('seed', 11)), turns = Number(opt('turns', 600)), crowd = args.includes('--fauna');
const [sw, sh] = opt('size', '360x640').split('x').map(Number);
const { makeGame, random, wander, UPGRADES, WORKS, MAPS, CORE, N, K } = await import(url('test/harness.mjs'));
const { sheets } = await import(url('js/atlas.js'));
const KINDS = ['bat', 'moth', 'bee', 'leech', 'spitter', 'puff', 'skink', 'frog', 'beetle', 'jelly', 'salamander', 'wren', 'newt', 'pup', 'rimeling', 'emberling', 'mireling', 'lodeling'];
const PARTS = ['drawTether', 'drawRares', 'drawRareSigns', 'light', 'halos', 'drawHud', 'drawRopes', 'drawMap', 'drawShop', 'drawLab', 'drawMenu', 'drawStats', 'drawEye', 'chunk', 'paint', 'drawDrill', 'rope', 'drawSpan'];
const METHODS = ['drawImage', 'fillRect', 'clearRect', 'strokeRect', 'save', 'restore', 'translate', 'rotate', 'scale', 'setTransform', 'resetTransform', 'beginPath', 'moveTo', 'lineTo',
  'arcTo', 'arc', 'quadraticCurveTo', 'bezierCurveTo', 'closePath', 'stroke', 'fill', 'setLineDash', 'putImageData', 'fillText', 'clip', 'rect', 'ellipse'];
const PROPS = ['fillStyle', 'strokeStyle', 'globalAlpha', 'globalCompositeOperation', 'imageSmoothingEnabled', 'lineWidth', 'lineCap', 'lineJoin', 'lineDashOffset', 'font', 'textAlign', 'filter'];
const START = { globalAlpha: 1, globalCompositeOperation: 'source-over', imageSmoothingEnabled: true, fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', lineDashOffset: 0, font: '10px sans-serif', textAlign: 'start', filter: 'none' };
const counting = mode === 'count';

Math.random = random(seed + 5);
const game = await makeGame(seed, { tether: 5, drill: 4 }, { fauna: crowd });

// ---- the counting contexts
let part = 'scene';
const C = {};                                   // C[part][key] = calls
const bump = key => { const p = C[part] ??= {}; p[key] = (p[key] ?? 0) + 1; };
const sheetOf = new Map(Object.entries(sheets).map(([name, s]) => [s.image, name]));
const blank = () => {};
function makeCtx(label, canvas) {
  const st = { ...START }, ctx = { canvas };
  for (const m of METHODS) {
    const key = `${label}.${m}`;
    ctx[m] = !counting ? blank : function (a0) {
      bump(key);
      if (m === 'drawImage') {
        const from = sheetOf.has(a0) ? 'sheet' : a0?.tintOf === 'font' ? 'font' : a0?.tintOf ? 'tint' : a0?.lines ? 'lines' : a0?.getContext ? 'canvas' : 'other';
        bump(`${key}.${from}`);
        // (A canvas's first picture, a whole sheet at 0, 0, is a tint being made: js/atlas.js, `tinted`.)
        if (canvas && !canvas.drawn && sheetOf.has(a0) && arguments.length === 3) canvas.tintOf = sheetOf.get(a0);
        if (canvas) canvas.drawn = true;
      }
    };
  }
  ctx.createImageData = (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0) * 4)), width: w, height: h });
  ctx.getImageData = (x, y, w, h) => { if (counting) bump(`${label}.getImageData`); return { data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0) * 4)), width: w, height: h }; };
  ctx.measureText = () => ({ width: 0 });
  for (const p of PROPS) {
    const k1 = `${label}.set.${p}`, k2 = `${label}.same.${p}`;
    Object.defineProperty(ctx, p, { get: () => st[p], set: !counting ? v => { st[p] = v; } : v => { bump(k1); if (st[p] === v) bump(k2); st[p] = v; } });
  }
  return ctx;
}
const gctx = makeCtx('game', null), octx = makeCtx('over', null);
game.ctx = gctx;
// (Counting, every canvas the game makes for itself counts too; measuring bytes, they are the harness's.)
if (counting) globalThis.document.createElement = () => { const c = { width: 0, height: 0, style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: sw, height: sh }) }; const x = makeCtx('off', c); c.getContext = () => x; return c; };
if (opt('rows', 'max') === 'max') for (const u of [...UPGRADES, ...WORKS, ...MAPS, ...CORE]) if (u.id !== 'tether') game.S.lv[u.id] = u.values.length - 1;
game.over = { width: 0, height: 0, getContext: () => octx }; game.overCtx = octx; game.resize(sw, sh, 1);

// ---- parts: the innermost named wins
const wrap = (obj, name, label) => {
  const own = obj?.[name];
  if (typeof own !== 'function') return;
  obj[name] = function (...a) { const was = part; part = label; try { return own.apply(this, a); } finally { part = was; } };
};
if (counting) {
  for (const name of PARTS) wrap(game, name, name);
  for (const name of ['draw', 'glow', 'signs', 'rider']) wrap(game.fauna, name, `fauna.${name}`);
  for (const name of ['dust', 'glow']) wrap(game.feel, name, `feel.${name}`);
  for (const name of ['glow', 'station']) wrap(game.fitter, name, `fit.${name}`);
}

let frames = 0, lord = 0;
const lordCell = () => {
  const B = game.fauna.bosses, d = game.drill, w = game.world;
  for (let r = 3; r <= 6; r++) for (let a = 0; a < 16; a++) {
    const x = Math.floor(d.x + Math.cos(a * Math.PI / 8) * r), y = Math.floor(d.y + Math.sin(a * Math.PI / 8) * r);
    if (w.peek(x, y) === K.EMPTY && B.inView(game, x + 0.5, y + 0.5)) return y * N + x;
  }
  return -1;
};
const hs = () => v8.getHeapStatistics().used_heap_size;
let base = 0; for (let i = 0; i < 50; i++) { const a = hs(), b = hs(); base += b - a; } base /= 50;
const up = [], rn = [];
for (const auto of wander(random(seed), turns)) {
  game.input.auto = auto;
  if (crowd && frames % 20 === 0 && game.fauna.alive < 16) game.fauna.stage(game, KINDS[(frames / 20) % KINDS.length], 8);
  const lordUp = crowd && [0, 1, 2, 3].some(b => game.fauna.bosses.up(b));
  if (crowd && frames % 30 === 0 && !lordUp) { const c = lordCell(); if (c >= 0) { game.fauna.bosses.stageAs(game, lord, 'tell', 3, c); lord = (lord + 1) % 4; } }
  part = 'update';
  const h0 = hs();
  game.update(1 / 60);
  const h1 = hs();
  frames++;
  part = 'scene';
  game.probe = {};
  const h2 = hs();
  game.render();
  const h3 = hs();
  if (h1 >= h0) up.push(h1 - h0 - base);
  if (h3 >= h2) rn.push(h3 - h2 - base);
}
const sum = a => { const s = [...a].sort((x, y) => x - y); return { mean: Math.round(a.reduce((x, y) => x + y, 0) / a.length), p50: Math.round(s[s.length >> 1]), p95: Math.round(s[Math.floor(s.length * 0.95)]), max: Math.round(s[s.length - 1]), counted: a.length }; };
const out = { root, seed, turns, frames, crowd, size: [sw, sh], W: game.W, H: game.H };
if (counting) {
  const per = {}, totals = {};
  for (const [p, keys] of Object.entries(C)) for (const [k, n] of Object.entries(keys)) { (per[p] ??= {})[k] = n / frames; totals[k] = (totals[k] ?? 0) + n / frames; }
  out.totals = totals; out.per = per;
} else { out.update = sum(up); out.render = sum(rn); }
console.log(JSON.stringify(out));
