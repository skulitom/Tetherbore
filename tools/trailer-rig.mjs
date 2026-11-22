// The film rig of tools/trailer.mjs: opens the real game in a headless browser at 1920x1080, as the desktop build shows
// it, and steps it one sixtieth of a second at a time with its sound rendered in step.
//
//   - The page believes it is the desktop build (`window.tetherboreDesktop`, a stand-in that saves nothing), so it sizes
//     itself with `Game.resize(w, h, dpr, true)`: 3x pixels, the one-row bar. A staged view (`?shot`) has no payoff of
//     its own, so the rig makes the same `Payoff` js/main.js makes on the desktop.
//   - Web Audio is an OfflineAudioContext: the game's own js/audio.js builds its own nodes on it, and the context is
//     suspended at each frame while the game steps, so every sound lands on the frame that asked for it. The music's
//     timer runs on that clock. Nothing is played.
//   - Nothing in js/, assets/, css/ or index.html is changed or served changed.
import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };

const browserPath = async () => {
  const bases = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter(Boolean);
  const list = bases.flatMap(b => [path.join(b, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(b, 'Google', 'Chrome', 'Application', 'chrome.exe')]);
  for (const file of list) if (await access(file).then(() => true, () => false)) return file;
  throw new Error('no Edge or Chrome found');
};

// What runs in the page before any of its scripts.
const before = seconds => `(() => {
  const film = window.__film = { timers: [], k: 0, render: null, errors: [] };
  const ctx = film.ctx = new OfflineAudioContext(2, Math.ceil(${seconds} * 48000), 48000);
  const go = ctx.resume.bind(ctx), hold = ctx.suspend.bind(ctx);
  film.go = go; film.hold = hold;
  ctx.resume = () => Promise.resolve();                 // (only the rig moves this clock)
  ctx.suspend = when => when === undefined ? Promise.resolve() : hold(when);
  const AC = function () { return ctx; };
  window.AudioContext = AC; window.webkitAudioContext = AC;
  const every = window.setInterval.bind(window), stop = window.clearInterval.bind(window);
  window.setInterval = (fn, ms, ...rest) => { if (fn && fn.name === 'conduct') { const t = { fn, ms, next: ms / 1000, id: 1e7 + film.timers.length }; film.timers.push(t); return t.id; } return every(fn, ms, ...rest); };
  window.clearInterval = id => { const t = film.timers.find(x => x.id === id); if (t) t.dead = true; else stop(id); };
  Object.defineProperty(document, 'hidden', { get: () => false });
  Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
  document.hasFocus = () => true;
  window.tetherboreDesktop = {
    saves: { read: async () => null, write: async () => {}, readDemo: async () => null, hasFull: async () => false },
    window: { isFullscreen: async () => true, toggleFullscreen() {}, quit() {}, onFullscreen() {}, onFlush() {} },
  };
})();`;

// What runs in the page once the game stands: the payoff, the sound, and one step.
const RIG = `(async () => {
  const film = window.__film, game = tetherbore.game;
  const audio = await import('./js/audio.js');
  if (!game.payoff) { const { Payoff } = await import('./js/payoff.js'); game.payoff = new Payoff(game); }
  film.audio = audio;
  audio.setMusic(false);
  audio.unlock();
  film.log = [];
  const haul = game.haul;
  game.haul = function (cells, area) { const before = game.S.stats.hauls, out = haul.call(game, cells, area); if (game.S.stats.hauls !== before) film.log.push({ f: film.k, n: game.hauled?.n ?? cells.length, grit: Math.round(game.hauled?.grit ?? 0), title: game.hauled?.title ?? '' }); return out; };
  film.step = () => new Promise((resolve, reject) => {
    const k = ++film.k;
    film.hold(k / 60).then(() => {
      try {
        const now = film.ctx.currentTime;
        for (const t of film.timers) while (!t.dead && t.next <= now) { t.fn(); t.next += t.ms / 1000; }
        window.pilot?.tick();
        tetherbore.advance(1000 / 60 - 0.5);
      } catch (error) { film.errors.push(String(error && error.stack || error)); }
      resolve();
    }, reject);
    if (!film.render) film.render = film.ctx.startRendering(); else film.go();
  });
  film.steps = async n => { for (let i = 0; i < n; i++) await film.step(); return film.k; };
  // The game's own music alone, or its sounds asked for at set times: no game is stepped. The plan: [[seconds, score,
  // cells from the core]], the piece the band turns to then (js/audio.js, hear); the cues: [[seconds, sound, ...args]].
  film.score = async (plan, seconds, cues = []) => {
    if (plan.length) { audio.setMusic(true); audio.hear(plan[0][1], plan[0][2] ?? 300); }
    const todo = [...plan.slice(1).map(([t, score, far]) => [t, () => audio.hear(score, far ?? 300)]), ...cues.map(([t, name, ...args]) => [t, () => audio.sfx[name]?.(...args)])].sort((a, b) => a[0] - b[0]);
    for (const [t, run] of todo) if (t <= 0) run();
    const QUANT = 128 / 48000;
    for (let k = 1, last = 0; k * 0.02 < seconds; k++) {
      await new Promise((resolve, reject) => {
        film.hold(Math.round(k * 0.02 / QUANT) * QUANT).then(() => {
          try {
            const now = film.ctx.currentTime;
            for (const t of film.timers) while (!t.dead && t.next <= now) { t.fn(); t.next += t.ms / 1000; }
            for (const [t, run] of todo) if (t > last && t <= now) run();
            last = now;
          } catch (error) { film.errors.push(String(error && error.stack || error)); }
          resolve();
        }, reject);
        if (!film.render) film.render = film.ctx.startRendering(); else film.go();
      });
    }
    return true;
  };
  film.finish = async () => {
    film.go();
    const buffer = await film.render, L = buffer.getChannelData(0), R = buffer.getChannelData(1), bytes = new Uint8Array(L.length * 8), view = new DataView(bytes.buffer);
    for (let i = 0; i < L.length; i++) { view.setFloat32(i * 8, L[i], true); view.setFloat32(i * 8 + 4, R[i], true); }
    film.pcm = bytes;
    return bytes.length;
  };
  film.chunk = (from, size) => { let s = ''; const part = film.pcm.subarray(from, from + size); for (let i = 0; i < part.length; i += 32768) s += String.fromCharCode.apply(null, part.subarray(i, i + 32768)); return btoa(s); };
  return true;
})()`;

export async function openGame({ query, seconds, width = 1920, height = 1080 }) {
  const server = createServer(async (request, response) => {
    let name = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    if (name.endsWith('/')) name += 'index.html';
    const file = path.join(root, name);
    if (!file.startsWith(root + path.sep) || name.split('/').some(part => part.startsWith('.'))) { response.writeHead(404); response.end(); return; }
    try { const body = await readFile(file); response.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }); response.end(body); } catch { response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const profile = await mkdtemp(path.join(os.tmpdir(), 'tetherbore-film-'));
  const browser = spawn(await browserPath(), ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-networking', '--disable-component-update', '--disable-sync', '--mute-audio', '--hide-scrollbars', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    `--window-size=${width},${height}`, 'about:blank'], { stdio: 'ignore' });
  let endpoint = null;
  for (const start = Date.now(); !endpoint && Date.now() - start < 60000; await sleep(100)) {
    const [port, address] = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8').catch(() => '')).split('\n');
    if (address) endpoint = `ws://127.0.0.1:${port}${address}`;
  }
  if (!endpoint) throw new Error('the browser did not open its DevTools port');
  const socket = new WebSocket(endpoint), pending = new Map(), problems = [];
  let sequence = 0;
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id) { if (message.method === 'Runtime.exceptionThrown') problems.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text); return; }
    const waiting = pending.get(message.id); if (!waiting) return;
    pending.delete(message.id);
    if (message.error) waiting.reject(new Error(`${waiting.method}: ${message.error.message}`)); else waiting.resolve(message.result);
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject, method }); socket.send(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) })); });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }), { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const page = (method, params) => send(method, params, sessionId);
  const evaluate = async expression => {
    const { result, exceptionDetails } = await page('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (exceptionDetails) throw new Error(`the page threw: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
    return result.value;
  };
  await page('Page.enable'); await page('Runtime.enable');
  await page('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await page('Emulation.setFocusEmulationEnabled', { enabled: true });
  await page('Page.addScriptToEvaluateOnNewDocument', { source: before(seconds) });
  await page('Page.navigate', { url: `${origin}/index.html?${query}` });
  for (const start = Date.now(); !await evaluate('!!(window.tetherbore && tetherbore.game && !tetherbore.game.loading && tetherbore.game.W)').catch(() => false); await sleep(100)) {
    if (problems.length || Date.now() - start > 60000) throw new Error(`the page did not start:\n  ${problems.join('\n  ') || 'it said nothing in a minute'}`);
  }
  await evaluate(RIG);
  const grab = async () => Buffer.from((await page('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true })).data, 'base64');
  const pcm = async () => {
    const size = await evaluate('__film.finish()'), parts = [], CHUNK = 6 * 1024 * 1024;
    for (let from = 0; from < size; from += CHUNK) parts.push(Buffer.from(await evaluate(`__film.chunk(${from}, ${CHUNK})`), 'base64'));
    return Buffer.concat(parts);
  };
  const close = async () => {
    await Promise.race([send('Browser.close').catch(() => {}), sleep(3000)]);
    try { socket.close(); } catch { /* gone */ }
    browser.kill(); server.closeAllConnections(); server.close();
    for (let tries = 0; tries < 40 && !await rm(profile, { recursive: true, force: true }).then(() => true, () => false); tries++) await sleep(250);
  };
  return { evaluate, grab, pcm, close, problems };
}
