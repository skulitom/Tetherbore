// Boots the game: loads the art, sizes the canvas in whole device pixels, and feeds it touches, keys and time.
import { loadAtlas } from './atlas.js';
import { Game } from './game.js';

const canvas = document.getElementById('game');
await loadAtlas();
const game = new Game(canvas);

function resize() {
  const w = window.innerWidth || 360, h = window.innerHeight || 640;
  game.resize(w, h, Math.min(4, window.devicePixelRatio || 1));
}
resize();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);

const at = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * game.W / r.width, (e.clientY - r.top) * game.H / r.height]; };
canvas.addEventListener('pointerdown', e => { e.preventDefault(); canvas.setPointerCapture?.(e.pointerId); game.pointerDown(e.pointerId, ...at(e)); });
canvas.addEventListener('pointermove', e => { e.preventDefault(); game.pointerMove(e.pointerId, ...at(e)); });
for (const type of ['pointerup', 'pointercancel']) canvas.addEventListener(type, e => { e.preventDefault(); game.pointerUp(e.pointerId); });
canvas.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('keydown', e => { if (!e.repeat && !e.metaKey && !e.ctrlKey && game.key(e.code, true)) e.preventDefault(); else if (e.repeat && /^Arrow|Space/.test(e.code)) e.preventDefault(); });
window.addEventListener('keyup', e => { game.key(e.code, false); });
document.addEventListener('visibilitychange', () => { if (document.hidden) game.save(); });
window.addEventListener('pagehide', () => game.save());

let last = performance.now(), manual = false;
function frame(now) {
  if (!manual) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.update(dt);
    game.render();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// For tests and for looking at the game in a page that gets no animation frames: step it by hand.
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) || location.search.includes('debug')) {
  window.tetherbore = {
    game,
    advance(ms, step = 1000 / 60) { manual = true; for (let t = 0; t < ms; t += step) game.update(step / 1000); game.render(); },
    resume() { manual = false; last = performance.now(); },
  };
}
