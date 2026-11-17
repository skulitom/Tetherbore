// Boots the game: loads the art, sizes the canvas in whole device pixels, and feeds it touches, keys and time.
import { loadAtlas } from './atlas.js';
import { Game } from './game.js';
import { setAside } from './audio.js';

const canvas = document.getElementById('game');
await loadAtlas();
const game = new Game(canvas, document.getElementById('rope'));
// `?shot` in the address stages a view of a far place for tools/shot.mjs to photograph, in place of the saved game,
// which is then neither read nor written (js/shot.js, fetched only then). Without it none of this runs.
const query = new URLSearchParams(location.search);
const shot = query.has('shot') ? (await import('./shot.js')).stage(game, query) : null;
// (With no saved game to go on with, the game begun is a new one, and the saved ground is made its own.)
if (!shot && !(await game.restore())) game.claim();

function resize() {
  const w = window.innerWidth || 360, h = window.innerHeight || 640;
  game.resize(w, h, Math.min(4, window.devicePixelRatio || 1));
  // A staged view is drawn once and held still until it is stepped by hand.
  if (shot) { shot.fit(); game.render(); }
}
resize();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);

const at = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * game.W / r.width, (e.clientY - r.top) * game.H / r.height]; };
canvas.addEventListener('pointerdown', e => { e.preventDefault(); canvas.setPointerCapture?.(e.pointerId); game.pointerDown(e.pointerId, ...at(e)); });
canvas.addEventListener('pointermove', e => { e.preventDefault(); game.pointerMove(e.pointerId, ...at(e)); });
for (const type of ['pointerup', 'pointercancel']) canvas.addEventListener(type, e => { e.preventDefault(); game.pointerUp(e.pointerId); });
// A wheel turned over the chart zooms it, and over the lab's notes scrolls them: by the game's pixels, whatever the
// browser counts in (pixels, lines or pages) and however many of the screen's pixels a pixel of the game is.
canvas.addEventListener('wheel', e => {
  const r = canvas.getBoundingClientRect(), unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
  if (game.wheel(...at(e), e.deltaY * unit * game.W / r.width)) e.preventDefault();
}, { passive: false });
canvas.addEventListener('contextmenu', e => e.preventDefault());
// (A key held down comes again: the game says whether it takes those, as the lab's list does to walk through it.)
window.addEventListener('keydown', e => { if (!e.metaKey && !e.ctrlKey && game.key(e.code, true, e.repeat, e.shiftKey)) e.preventDefault(); else if (e.repeat && /^Arrow|Space/.test(e.code)) e.preventDefault(); });
window.addEventListener('keyup', e => { game.key(e.code, false); });
document.addEventListener('visibilitychange', () => { if (document.hidden) game.save(); });
// The game is silent while its tab is hidden or another window has the focus (js/audio.js, `setAside`).
const quiet = () => setAside(document.hidden || document.hasFocus?.() === false);
document.addEventListener('visibilitychange', quiet);
window.addEventListener('blur', quiet);
window.addEventListener('focus', quiet);
quiet();
window.addEventListener('pagehide', () => game.save());

let last = performance.now(), manual = !!shot;
function frame(now) {
  // The next frame is asked for before this one is made, and whatever this one throws is caught and written down
  // (`Game.failed`): nothing that goes wrong in a frame stops the game. It did once: the hull mending itself asked
  // for a sound with no pitch, the browser threw from the middle of the step, the next frame was never asked for,
  // and the game stood still for good, twenty seconds after any knock.
  requestAnimationFrame(frame);
  if (manual) return;
  const gap = now - last, dt = Math.min(0.05, gap / 1000);
  last = now;
  try {
    const t0 = performance.now();
    game.update(dt);
    const t1 = performance.now();
    game.render();
    // (A frame that took long is written down, with where the time went: `Game.frameTook`.)
    game.frameTook(gap, t1 - t0, performance.now() - t1);
  } catch (error) { game.failed(error); }
}
requestAnimationFrame(frame);

// For tests and for looking at the game in a page that gets no animation frames: step it by hand.
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) || location.search.includes('debug') || shot) {
  window.tetherbore = {
    game, shot,
    advance(ms, step = 1000 / 60) { manual = true; for (let t = 0; t < ms; t += step) game.update(step / 1000); game.render(); },
    resume() { manual = false; last = performance.now(); },
  };
}
