// A piece of ground shows what painting it shows. A piece is drawn into its canvas only when its drawing has
// changed (`Sketch` in js/drawing.js): any change to the ground tells every piece in view to draw itself again, and
// most draw just what they hold. Over a flight that cuts and uncovers ground, with the view drawn every frame, each
// piece is painted as it used to be, whenever it was told to, straight into a list of calls; and the calls its
// canvas was last given must be the same, in the same order. A canvas's pixels are those of the last drawing it
// was given (every drawing begins by filling the whole piece), so the same calls are the same picture.
// And a Sketch refuses a call it does not take down, so a new kind of call in the drawing of the ground cannot be
// left out of the list and a piece go on showing what it showed before.
// The pieces of decor in the ground's caves (js/decor.js) are drawn with it, and are looked at here too: they are drawn
// (on a second flight, from a far start among the mire's caves, as well), the world is asked what the seed laid in
// a cell once at the most while its piece of ground is kept, and they add less than three tenths to a drawing.
//   node test/regress/r-chunk-same.mjs [seed] [turns]
import { makeGame, random, farStart } from '../harness.mjs';
import { sheets } from '../../js/atlas.js';

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

const decor = new Set([sheets.decor.image, sheets['decor-x'].image]);
let told = 0, drawn = 0, wrong = 0, first = '', adorned = 0, asked = 0, dropped = 0, frames = 0;
const cells = new Set();
async function flight(game, turns, rnd) {
  const painted = new Map();             // each piece's last drawing, painted the old way
  // (What the seed laid is asked of the world only while the ground is painted, and only by the decor's cache: the
  // game asks it too, as a cut is made, of cells beside the cut.)
  const laid = game.world.first.bind(game.world), paint = game.paint;
  let painting = false;
  game.world.first = i => { if (painting) { asked++; cells.add(i); } return laid(i); };
  game.paint = function (ctx, x0, y0) { painting = true; try { return paint.call(this, ctx, x0, y0); } finally { painting = false; } };
  game.wild = new Map();
  const drop = game.wild.delete.bind(game.wild);
  game.wild.delete = k => { if (game.wild.has(k)) dropped++; return drop(k); };
  const chunk = game.chunk.bind(game);
  game.chunk = (cx, cy) => {
    const key = cy * 4096 + cx, was = game.chunks.get(key), stale = !was || was.v !== game.version;
    const canvas = chunk(cx, cy), before = was && was.canvas === canvas ? was.mark ?? 0 : 0;
    const c = game.chunks.get(key);
    if (stale) { const calls = [], log = logger(calls), image = log.drawImage; log.drawImage = (im, ...a) => { if (decor.has(im)) adorned++; image(im, ...a); }; game.paint(log, cx * 8, cy * 8); painted.set(key, calls); told++; }
    if (canvas.calls.length > before) drawn++;
    // What the canvas was last given: the calls since the start of its last drawing.
    if (canvas.calls.length > before) c.last = canvas.calls.slice(before);
    c.mark = canvas.calls.length;
    const old = painted.get(key), now = c.last;
    if (!now || now.length !== old.length || now.some((call, n) => call !== old[n])) { wrong++; first ||= `piece ${cx},${cy} at version ${game.version}`; }
    return canvas;
  };

  let heading = 0;
  for (let turn = 0; turn < turns; turn++) {
    heading += (rnd() - 0.5) * 2.5;
    const hold = 10 + Math.floor(rnd() * 50), pause = rnd() < 0.1;
    for (let f = 0; f < hold; f++) { game.input.auto = pause ? null : [Math.cos(heading), Math.sin(heading), 1]; game.update(1 / 60); game.render(); frames++; }
  }
}
const game = await makeGame(seed, { tether: 5, drill: 4 });
await flight(game, turns, random(seed));
const mire = await makeGame(seed, { tether: 5, drill: 4 });
farStart(mire, -160, 64);
await flight(mire, 30, random(seed + 1));
check(wrong === 0, `${wrong} times a piece showed other than its painting would, first ${first}`);
check(game.version > 200 && told > 1000, `the flight changed the ground ${game.version} times and pieces were told to draw again ${told} times: too few to show anything`);
check(drawn < told, `pieces were drawn ${drawn} times of the ${told} they were told to: none was spared`);
check(adorned > 0, 'no piece of decor was drawn on either flight');
check(asked <= cells.size + dropped * 64, `the world was asked what the seed laid ${asked} times while the ground was painted, of ${cells.size} cells (and ${dropped} pieces were let go)`);
// The decor adds less than three tenths to the drawing of the pieces in view.
{
  let all = 0, bare = 0;
  const adorn = mire.adorn;
  for (const c of mire.chunks.values()) { const calls = []; mire.paint(logger(calls), c.cx * 8, c.cy * 8); all += calls.length; }
  mire.adorn = () => {};
  for (const c of mire.chunks.values()) { const calls = []; mire.paint(logger(calls), c.cx * 8, c.cy * 8); bare += calls.length; }
  mire.adorn = adorn;
  check(all <= bare * 1.3, `the decor makes a drawing of the ground ${(all / bare).toFixed(2)} times as long`);
}

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

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : `no defect: over ${frames} frames every piece showed what painting it shows; ${drawn} drawings of the ${told} the pieces were told to make were made, and a call the Sketch does not take down is refused; ${adorned} pieces of decor were drawn, and the world was asked what the seed laid in ${cells.size} cells ${asked} times`);
process.exit(fails.length ? 1 : 0);
