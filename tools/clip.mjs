// Films the game, for the README: a clip of it played by a small pilot with nobody at the browser.
//   node tools/clip.mjs <out.mp4|out.webp|out.gif> [--query "shot&seed=7&at=0,-300&lv=late&met"] [--pilot lasso|none|steer:x,y|to:dx,dy;dx,dy...]
//                                         [--seconds 12] [--fps 30] [--size 360x640] [--lead 0] [--browser path]
//
//   --query    the page's address after `index.html?`: a staged view (js/shot.js) or, if empty, a new game as a
//              player first sees it. Whatever is staged, the clip plays on from it.
//   --pilot    who flies: `lasso` (the default) goes round the loose piece nearest the drill until it is reeled
//              in, then the next; `none` keeps the thumb off; `steer:x,y` holds the thumb that way; `to:dx,dy;...`
//              flies to those cells from the core, in turn, and then lassos.
//   --lead     seconds stepped before filming begins (the view settles, the dark comes to the ground's colour).
//   --fps      frames of the clip a second; the game is stepped at 60 a second whatever it is.
//
// It serves this folder on a loopback port, opens the page in a headless Edge or Chrome with a profile of its own
// (no saved game is read or written), steps the game by hand a frame at a time, photographs every frame, and has
// ffmpeg (on the PATH) make the clip: H.264 for .mp4, an animated WebP for .webp (what the README shows: GitHub plays it
// inline, which it does not a video in the repository), a palette of the clip's own for .gif. Pixels are doubled
// for the .mp4 so the art stays sharp; the .gif keeps the page's size.
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const usage = 'node tools/clip.mjs <out.mp4|out.webp|out.gif> [--query q] [--pilot lasso|none|steer:x,y|to:dx,dy;...] [--seconds 12] [--fps 30] [--size 360x640] [--lead 0] [--browser path]';
const wrong = why => { console.error(`${why}\n  ${usage}`); process.exit(2); };

const options = { query: '', pilot: 'lasso', block: '3', seconds: '12', fps: '30', size: '360x640', lead: '0', browser: '' };
let out = null;
for (let args = process.argv.slice(2), i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--help' || arg === '-h') { console.log(usage); process.exit(0); }
  if (!arg.startsWith('--')) { out = arg; continue; }
  const [name, inline] = arg.slice(2).split(/=(.*)/s);
  if (!(name in options)) wrong(`There is no option --${name}.`);
  const value = inline ?? args[++i];
  if (value === undefined) wrong(`--${name} needs a value.`);
  options[name] = value;
}
if (!out || !/\.(mp4|gif|webp)$/i.test(out)) wrong('Where should the clip be written (a .mp4, .webp or .gif)?');
const fps = Number(options.fps), seconds = Number(options.seconds), lead = Number(options.lead), size = options.size.split('x').map(Number);
if (![15, 20, 30, 60].includes(fps)) wrong('--fps is 15, 20, 30 or 60.');
if (!(seconds > 0 && seconds <= 120) || !(lead >= 0)) wrong('--seconds is up to 120, --lead 0 or more.');
const steps = 60 / fps;
out = path.resolve(out);

const programs = base => [path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe')];
const installed = {
  win32: [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter(Boolean).flatMap(programs),
  darwin: ['Google Chrome', 'Microsoft Edge', 'Chromium'].map(name => `/Applications/${name}.app/Contents/MacOS/${name}`),
  linux: ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'].map(name => `/usr/bin/${name}`),
}[process.platform] ?? [];
let program = options.browser || null;
for (const candidate of program ? [] : installed) if (await access(candidate).then(() => true, () => false)) { program = candidate; break; }
if (!program) { console.error('No Edge or Chrome was found. Name one with --browser.'); process.exit(3); }

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const server = createServer(async (request, response) => {
  let name = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  if (name.endsWith('/')) name += 'index.html';
  const file = path.join(root, name);
  if (!file.startsWith(root + path.sep) || name.split('/').some(part => part.startsWith('.'))) { response.writeHead(404); response.end(); return; }
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(body);
  } catch { response.writeHead(404); response.end(); }
});

// The pilot, run in the page. Each call of `tick` steers for one step of the game.
const PILOT = `(async () => {
  const { N, C, K } = await import('./js/world.js');
  const game = tetherbore.game, d = game.drill, w = game.world, HX = C + 0.5, HY = C + 0.5;
  const plan = ${JSON.stringify(options.pilot)};
  const size = ${JSON.stringify(Number(options.block))};
  let legs = [], target = null, budget = 0, idle = 0, hauls = game.S.stats.hauls;
  if (plan.startsWith('to:')) legs = plan.slice(3).split(';').map(p => p.split(',').map(Number)).map(([x, y]) => [C + x, C + y]);
  const boxOf = cells => { let b = [Infinity, Infinity, -Infinity, -Infinity]; for (const c of cells) { const x = c % N, y = Math.floor(c / N); b = [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)]; } return b; };
  const choose = () => {
    let best = null, far = 40;
    for (const cells of game.pieces) {
      if (cells.length > 400) continue;
      const [x0, y0, x1, y1] = boxOf(cells), cx = (x0 + x1) / 2 + 0.5, cy = (y0 + y1) / 2 + 0.5, f = Math.hypot(cx - d.x, cy - d.y);
      if (f < far) { far = f; best = { cells, box: [x0, y0, x1, y1] }; }
    }
    if (!best) {
      // Nothing loose near: cut a moat round a block of ground ahead, outward from the core, and lasso that.
      const ox = d.x - HX, oy = d.y - HY, m = Math.hypot(ox, oy) || 1, ux = m > 2 ? ox / m : 1, uy = m > 2 ? oy / m : 0;
      const cx = Math.floor(d.x + ux * (2 + size)), cy = Math.floor(d.y + uy * (2 + size)), h = Math.floor(size / 2);
      best = { cells: null, box: [cx - h, cy - h, cx - h + size - 1, cy - h + size - 1] };
    }
    const [x0, y0, x1, y1] = best.box;
    const corners = [[x0 - 1, y0 - 1], [x1 + 1, y0 - 1], [x1 + 1, y1 + 1], [x0 - 1, y1 + 1]];
    // Round the way that the tether, coming from the core, winds: start at the corner nearest the drill.
    let first = 0;
    for (let n = 1; n < 4; n++) if (Math.hypot(corners[n][0] + 0.5 - d.x, corners[n][1] + 0.5 - d.y) < Math.hypot(corners[first][0] + 0.5 - d.x, corners[first][1] + 0.5 - d.y)) first = n;
    const turn = [];
    for (let n = 0; n < 9; n++) turn.push(corners[(first + n) % 4]);
    return { cells: best.cells, legs: turn };
  };
  window.pilot = {
    tick() {
      if (plan === 'none' || d.mode === 'dead') { game.input.auto = null; return; }
      if (plan.startsWith('steer:')) { const [x, y] = plan.slice(6).split(',').map(Number), m = Math.hypot(x, y) || 1; game.input.auto = [x / m, y / m, 1]; return; }
      if (game.S.stats.hauls !== hauls) { hauls = game.S.stats.hauls; target = null; legs = []; idle = 40; }
      if (idle > 0) { idle--; game.input.auto = null; return; }
      if (!legs.length && (!target || (target.cells && !game.pieces.includes(target.cells)) || !target.cells)) { target = choose(); if (target) legs = target.legs; budget = 0; }
      if (!legs.length) { game.input.auto = null; return; }
      const [x, y] = legs[0], dx = x + 0.5 - d.x, dy = y + 0.5 - d.y, far = Math.hypot(dx, dy);
      if (far < 0.45 || ++budget > 420) { legs.shift(); budget = 0; return this.tick(); }
      game.input.auto = [dx / far, dy / far, Math.max(0.35, Math.min(1, far / 2))];
    },
  };
  return true;
})()`;

let browser = null, profile = null, frames = null;
async function film() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  profile = await mkdtemp(path.join(os.tmpdir(), 'tetherbore-clip-'));
  frames = await mkdtemp(path.join(os.tmpdir(), 'tetherbore-frames-'));
  browser = spawn(program, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--mute-audio', '--hide-scrollbars', `--window-size=${size[0]},${size[1]}`, 'about:blank'], { stdio: 'ignore' });
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
    if (message.error) waiting.reject(new Error(message.error.message)); else waiting.resolve(message.result);
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) }));
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }), { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const page = (method, params) => send(method, params, sessionId);
  const evaluate = async expression => {
    const { result, exceptionDetails } = await page('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (exceptionDetails) throw new Error(`the page threw: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
    return result.value;
  };
  await page('Page.enable'); await page('Runtime.enable');
  await page('Emulation.setDeviceMetricsOverride', { width: size[0], height: size[1], deviceScaleFactor: 1, mobile: false });
  await page('Page.navigate', { url: `${origin}/index.html?${options.query}` });
  for (const start = Date.now(); !await evaluate('!!(window.tetherbore && tetherbore.game && !tetherbore.game.loading)').catch(() => false); await sleep(100)) {
    if (problems.length || Date.now() - start > 60000) throw new Error(`the page did not start:\n  ${problems.join('\n  ') || 'it said nothing in a minute'}`);
  }
  await evaluate(PILOT);
  const step = n => evaluate(`for (let i = 0; i < ${n}; i++) { pilot.tick(); tetherbore.advance(1000 / 60 - 0.5); } true`);
  if (lead) await step(Math.round(lead * 60));
  const count = Math.round(seconds * fps);
  for (let f = 0; f < count; f++) {
    await step(steps);
    const { data } = await page('Page.captureScreenshot', { format: 'png' });
    await writeFile(path.join(frames, `f${String(f).padStart(5, '0')}.png`), Buffer.from(data, 'base64'));
  }
  if (problems.length) throw new Error(`the page threw while it was filmed:\n  ${problems.join('\n  ')}`);
  console.log(await evaluate('JSON.stringify({ hauls: tetherbore.game.S.stats.hauls, at: [Math.round(tetherbore.game.drill.x - 8192), Math.round(tetherbore.game.drill.y - 8192)] })'));
  await send('Browser.close').catch(() => {});
  await mkdir(path.dirname(out), { recursive: true });
  const input = ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(frames, 'f%05d.png')];
  const args = /\.webp$/i.test(out)
    ? [...input, '-c:v', 'libwebp', '-q:v', '35', '-compression_level', '6', '-preset', 'drawing', '-loop', '0', out]
    : /\.gif$/i.test(out)
    ? [...input, '-vf', 'split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle', '-loop', '0', out]
    : [...input, '-vf', 'scale=iw*2:ih*2:flags=neighbor', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'slow', '-movflags', '+faststart', out];
  await new Promise((resolve, reject) => spawn('ffmpeg', args, { stdio: 'inherit' }).on('exit', code => code ? reject(new Error(`ffmpeg failed (${code})`)) : resolve()).on('error', reject));
  console.log(out);
}

let code = 1;
try { await film(); code = 0; } catch (error) { console.error(`No clip was made: ${error.message}`); }
finally {
  browser?.kill(); server.close();
  for (const folder of [profile, frames]) if (folder) for (let tries = 0; tries < 20 && !await rm(folder, { recursive: true, force: true }).then(() => true, () => false); tries++) await sleep(250);
}
process.exit(code);
