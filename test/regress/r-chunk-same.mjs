// A piece of ground shows what painting it shows. A piece is drawn into its canvas only when its drawing has
// changed (`Sketch` in js/drawing.js): any change to the ground tells every piece in view to draw itself again, and
// most draw just what they hold. Over a flight that cuts and uncovers ground, with the view drawn every frame, each
// piece is painted as it used to be, whenever it was told to, straight into a list of calls; and the calls its
// canvas was last given must be the same, in the same order. A canvas's pixels are those of the last drawing it
// was given (every drawing begins by filling the whole piece), so the same calls are the same picture.
// And a Sketch refuses a call it does not take down, so a new kind of call in the drawing of the ground cannot be
// left out of the list and a piece go on showing what it showed before.
//   node test/regress/r-chunk-same.mjs [seed] [turns]
import { makeGame, random } from '../harness.mjs';

const [seed = 7, turns = 120] = process.argv.slice(2).map(Number);
const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };

// A canvas whose context writes down the calls of the ground's drawing, an image by the order it was first met;
// any other call goes to the harness's own context, which swallows it.
const images = new Map(), name = image => { if (!images.has(image)) images.set(image, images.size); return images.get(image); };
const logger = calls => ({
  set globalAlpha(a) { calls.push(`alpha ${a}`); },
  set fillStyle(s) { calls.push(`fill ${s}`); },
  fillRect(...a) { calls.push(`rect ${a.join(' ')}`); },
  drawImage(image, ...a) { calls.push(`image ${name(image)} ${a.join(' ')}`); },
});
const make = document.createElement;
document.createElement = kind => {
  const canvas = make(kind), own = canvas.getContext(), calls = [], log = logger(calls);
  return Object.assign(canvas, { calls, getContext: () => new Proxy(own, { get: (t, key) => key in log ? log[key] : own[key], set: (t, key, value) => { if (key in log) log[key] = value; else own[key] = value; return true; } }) });
};

const game = await makeGame(seed, { tether: 5, drill: 4 }), rnd = random(seed);
const painted = new Map();             // each piece's last drawing, painted the old way
let told = 0, drawn = 0, wrong = 0, first = '';
const chunk = game.chunk.bind(game);
game.chunk = (cx, cy) => {
  const key = cy * 4096 + cx, was = game.chunks.get(key), stale = !was || was.v !== game.version;
  const canvas = chunk(cx, cy), before = was && was.canvas === canvas ? was.mark ?? 0 : 0;
  const c = game.chunks.get(key);
  if (stale) { const calls = []; game.paint(logger(calls), cx * 8, cy * 8); painted.set(key, calls); told++; }
  if (canvas.calls.length > before) drawn++;
  // What the canvas was last given: the calls since the start of its last drawing.
  if (canvas.calls.length > before) c.last = canvas.calls.slice(before);
  c.mark = canvas.calls.length;
  const old = painted.get(key), now = c.last;
  if (!now || now.length !== old.length || now.some((call, n) => call !== old[n])) { wrong++; first ||= `piece ${cx},${cy} at version ${game.version}`; }
  return canvas;
};

let heading = 0, frames = 0;
for (let turn = 0; turn < turns; turn++) {
  heading += (rnd() - 0.5) * 2.5;
  const hold = 10 + Math.floor(rnd() * 50), pause = rnd() < 0.1;
  for (let f = 0; f < hold; f++) { game.input.auto = pause ? null : [Math.cos(heading), Math.sin(heading), 1]; game.update(1 / 60); game.render(); frames++; }
}
check(wrong === 0, `${wrong} times a piece showed other than its painting would, first ${first}`);
check(game.version > 200 && told > 1000, `the flight changed the ground ${game.version} times and pieces were told to draw again ${told} times: too few to show anything`);
check(drawn < told, `pieces were drawn ${drawn} times of the ${told} they were told to: none was spared`);

// A call the Sketch does not take down is an error, not a piece left as it was.
{
  const paint = game.paint;
  game.paint = function (ctx, x0, y0) { paint.call(this, ctx, x0, y0); ctx.globalCompositeOperation = 'lighter'; };
  let threw = false;
  try { game.version++; game.chunk(game.chunks.values().next().value.cx, game.chunks.values().next().value.cy); } catch { threw = true; }
  check(threw, 'a drawing of the ground that set globalCompositeOperation was taken down without a word');
  game.paint = function (ctx, x0, y0) { paint.call(this, ctx, x0, y0); ctx.strokeRect(0, 0, 1, 1); };
  threw = false;
  try { game.version++; game.chunk(game.chunks.values().next().value.cx, game.chunks.values().next().value.cy); } catch { threw = true; }
  check(threw, 'a drawing of the ground that called strokeRect was taken down without a word');
  game.paint = paint;
}
document.createElement = make;

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : `no defect: over ${frames} frames every piece showed what painting it shows; ${drawn} drawings of the ${told} the pieces were told to make were made, and a call the Sketch does not take down is refused`);
process.exit(fails.length ? 1 : 0);
