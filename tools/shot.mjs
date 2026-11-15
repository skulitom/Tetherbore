// Photographs the game, so that ground and art can be judged by eye with no hand on a browser:
//   node tools/shot.mjs <out.png> [--seed 7] [--at dx,dy] [--reach level] [--size 360x640] [--zoom n] [--frames n] [--lit] [--met] [--wake]
//                                 [--key] [--pocket] [--haul n]
//
//   --at dx,dy    where the drill stands, in cells from the core: east and south are counted up, so 300 cells north
//                 is `--at 0,-300`. Away from the core it stands in a small room at the end of a tunnel carved from
//                 the core (what lay there is gone), with the tether run down the tunnel. No further than the world.
//   --reach n     the level of the tether, 0 to 9; if not given, the first level that reaches the room. (The
//                 last reaches 2,300 cells: a room further out is drawn, though no drill could come there.)
//   --size WxH    the page, in CSS pixels, which is also the size of the PNG. The game picks its own pixel size
//                 from it, as it does on a phone: 360x640 shows about 11 x 20 cells.
//   --zoom n      n times as many cells across in the same picture: the game's canvas is made n times larger and
//                 the page scales it down. `--size 1200x1200 --zoom 8` shows 150 x 150 cells, 8 pixels each.
//   --frames n    how many frames (sixtieths of a second) the game is stepped before the picture; 180 if not
//                 given, which lets the dark settle to the colour of the ground the drill is in.
//   --lit         no dark: every cell in view as the sheet draws it. (All ground in view is uncovered either way.)
//   --met         every ground is taken as met before, so the name of the place the drill stands in comes up on
//                 its plate, not across the screen as it does the first time. (Either shows for a second or two:
//                 `--frames 30` catches it, and the names of what the view uncovered, called out in the first frame.)
//   --wake        the hazard nearest the drill, within 12 cells, is woken as a cut beside it would wake it: lava
//                 pours, a pod bursts, a crystal's fuse is lit. `--frames` is then how far that has gone when the
//                 picture is taken (`--frames 5`: lava just woken; 400: poured; 700: set).
//   --key         the last cut of a keystone slab: of the slab nearest `--at` (within 80 cells; `node
//                 tools/slabs.mjs --where <seed>` lists them) every key is cut through but the one that faces the
//                 core, and the drill stands in the crack beside what is left of that one, pushing into it.
//                 `--frames 30`: the cut half made, its glow on the whole slab; 180: the slab hanging loose.
//   --pocket      the drill stands inside the pocket nearest `--at` (within 150 cells; `node tools/zone-budget.mjs
//                 --where <seed>` lists them): of a hive, in the lane of the chamber at its middle, beside the
//                 nugget, at the end of a way one cell wide bitten in from the tunnel. `--frames 30` catches the
//                 pocket's name as it comes up (with `--met`, on its plate, with its mineral).
//   --haul n      with --pocket: the n nuggets of the pocket's mineral nearest the drill (1 to 9) are brought home
//                 as a loop round them would bring them. One is a light haul, which says what it paid where it
//                 lay; two have a banner. `--frames 20`: the count of specimens out under the top bar.
//   --browser p   the Edge or Chrome to use, if the installed one is not to be.
//
// It serves this checkout on a free loopback port (static files, read only), opens `index.html?shot&...` in an
// installed Edge or Chrome run headless on a profile of its own under the system's temp folder (so no saved game is
// read or written), steps the game with `window.tetherbore.advance`, and saves a PNG of the page: both canvases,
// the game's and the tether's. What stages the view is js/shot.js. The browser is driven over the DevTools protocol
// with Node's own WebSocket (Node.js 22 or newer); nothing is installed. The browser and the server are closed
// whatever happens, and the last line printed is the path that was written.
//
// Exit codes: 0 the picture was written; 1 it failed (the reason is printed); 2 the arguments were wrong; 3 no
// browser was found.
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORLD_R } from '../js/world.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const usage = 'node tools/shot.mjs <out.png> [--seed 7] [--at dx,dy] [--reach level] [--size 360x640] [--zoom n] [--frames n] [--lit] [--met] [--wake] [--key] [--pocket] [--haul n] [--browser path]';
const wrong = why => { console.error(`${why}\n  ${usage}`); process.exit(2); };

// ---------------------------------------------------------------- what was asked for
const options = { seed: '7', at: '0,0', reach: '', size: '360x640', zoom: '1', frames: '180', lit: false, met: false, wake: false, key: false, pocket: false, haul: '0', browser: '' };
let out = null;
for (let args = process.argv.slice(2), i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--help' || arg === '-h') { console.log(usage); process.exit(0); }
  if (!arg.startsWith('--')) { if (out !== null) wrong(`Two places to write were given: ${out} and ${arg}.`); out = arg; continue; }
  const [name, inline] = arg.slice(2).split(/=(.*)/s);
  if (!(name in options)) wrong(`There is no option --${name}.`);
  if (typeof options[name] === 'boolean') { options[name] = inline === undefined || inline !== '0'; continue; }
  // A value may begin with a minus (`--at -300,0`), so whatever follows an option is its value.
  const value = inline ?? args[++i];
  if (value === undefined) wrong(`--${name} needs a value.`);
  options[name] = value;
}
if (out === null) wrong('Where should the picture be written?');
if (!/\.png$/i.test(out)) wrong(`The picture is a PNG: ${out} does not end in .png.`);
const whole = (name, least, most) => {
  const n = Number(options[name]);
  if (!Number.isInteger(n) || n < least || n > most) wrong(`--${name} is a whole number from ${least} to ${most}, not ${options[name]}.`);
  return n;
};
const seed = whole('seed', 0, 2 ** 31 - 1), frames = whole('frames', 0, 36000), level = options.reach === '' ? null : whole('reach', 0, 9);
const zoom = Number(options.zoom), haul = whole('haul', 0, 9);
if (haul && !options.pocket) wrong('--haul brings home nuggets of the pocket the drill stands in: say --pocket too.');
if (!(zoom >= 1 && zoom <= 64)) wrong(`--zoom is a number from 1 to 64, not ${options.zoom}.`);
const at = options.at.split(',').map(Number), size = options.size.toLowerCase().split('x').map(Number);
if (at.length !== 2 || !at.every(Number.isInteger)) wrong(`--at is two whole numbers of cells, dx,dy, not ${options.at}.`);
if (Math.hypot(...at) > WORLD_R - 20) wrong(`--at ${options.at} is ${Math.round(Math.hypot(...at))} cells out: the world ends ${WORLD_R} cells from the core, and the room must lie ${WORLD_R - 20} or nearer.`);
if (size.length !== 2 || !size.every(n => Number.isInteger(n) && n >= 120 && n <= 4096)) wrong(`--size is WxH in CSS pixels, each from 120 to 4096, not ${options.size}.`);
if (typeof WebSocket !== 'function') { console.error('This tool needs Node.js 22 or newer, which has a WebSocket client built in.'); process.exit(2); }
out = path.resolve(out);

// ---------------------------------------------------------------- the browser to use
// Edge first on Windows, where it is always present; Chrome first elsewhere.
const programs = base => [path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe')];
const installed = {
  win32: [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter(Boolean).flatMap(programs).sort((a, b) => b.includes('Edge') - a.includes('Edge')),
  darwin: ['Google Chrome', 'Microsoft Edge', 'Chromium'].map(name => `/Applications/${name}.app/Contents/MacOS/${name}`),
  linux: ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'].flatMap(name => ['/usr/bin', '/usr/local/bin', '/snap/bin'].map(folder => `${folder}/${name}`)),
}[process.platform] ?? [];
let program = options.browser || null;
for (const candidate of program ? [] : installed) if (await access(candidate).then(() => true, () => false)) { program = candidate; break; }
if (!program) { console.error('No Chromium-based browser (Edge or Chrome) was found, so no picture was taken. Name one with --browser.'); process.exit(3); }

// ---------------------------------------------------------------- the server: this checkout, read only
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg',
};
const missing = [];
const server = createServer(async (request, response) => {
  const answer = (status, body = '') => { response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(body); };
  if (request.method !== 'GET' && request.method !== 'HEAD') { answer(405, 'This server only reads.'); return; }
  let name;
  try { name = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); } catch { answer(400); return; }
  if (name.endsWith('/')) name += 'index.html';
  // Nothing outside the checkout, and nothing whose name begins with a dot (the repository's own files).
  const file = path.join(root, name);
  if (!file.startsWith(root + path.sep) || name.split('/').some(part => part.startsWith('.'))) { answer(404); return; }
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Length': body.length });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch { missing.push(name); answer(404); }
});

// ---------------------------------------------------------------- everything that must be closed, closed once
let browser = null, profile = null, closeBrowser = null, closing = null;
const pids = new Set();
const gone = async (folder, most = 12) => {
  // (Not `maxRetries`: it tries again at every level of the tree, and one held file then takes minutes.)
  for (let tries = 0; tries < most; tries++) {
    if (await rm(folder, { recursive: true, force: true }).then(() => true, () => false)) return true;
    await sleep(250);
  }
  return false;
};
const close = () => closing ??= (async () => {
  // Ask the browser to quit. Its profile can be removed once every process of it has let go of it; if it cannot,
  // the processes the browser itself named are ended, and it is tried again, for twenty seconds: on a busy machine
  // (the whole test suite running beside it) they are that slow to let go, and three seconds left a profile behind
  // in the temp folder at every run of the suite.
  await closeBrowser?.().catch(() => {});
  browser?.kill();
  server.closeAllConnections(); server.close();
  if (profile && !await gone(profile)) {
    for (const pid of pids) { try { process.kill(pid); } catch { /* already gone */ } }
    if (!await gone(profile, 80)) console.error(`The browser's profile could not be removed: ${profile}`);
  }
})();
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => { close().then(() => process.exit(130)); });

// ---------------------------------------------------------------- the picture
const compass = ([dx, dy]) => !dx && !dy ? 'at the core' : `${[dy && `${Math.abs(dy)} ${dy < 0 ? 'north' : 'south'}`, dx && `${Math.abs(dx)} ${dx > 0 ? 'east' : 'west'}`].filter(Boolean).join(', ')} of the core`;
async function take() {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  profile = await mkdtemp(path.join(os.tmpdir(), 'tetherbore-shot-'));
  browser = spawn(program, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-networking', '--disable-component-update', '--disable-sync', '--mute-audio', '--hide-scrollbars', `--window-size=${size[0]},${size[1]}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  // The browser writes its DevTools address into the profile. The program that was started may hand over to another
  // process and exit at once (Edge does on Windows), so its exit says nothing; the file does.
  let complaints = '', unstarted = null;
  browser.stderr.on('data', chunk => { complaints += chunk; }); browser.once('error', error => { unstarted = error; });
  let endpoint = null;
  for (const start = Date.now(); !endpoint && Date.now() - start < 60000; await sleep(100)) {
    if (unstarted) throw new Error(`the browser (${program}) could not be started: ${unstarted.message}`);
    const [port, address] = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8').catch(() => '')).split('\n');
    if (address) endpoint = `ws://127.0.0.1:${port}${address}`;
  }
  if (!endpoint) throw new Error(`the browser (${program}) did not open its DevTools port within a minute:\n${complaints.trim()}`);

  // One connection to the browser; the page is a session on it. When the connection goes, whatever waits on the
  // browser is told so at once, and nothing waits for a browser that is gone.
  const socket = new WebSocket(endpoint), pending = new Map(), problems = [];
  let sequence = 0, lost = null;
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', () => reject(new Error('could not connect to the browser'))); });
  const disconnected = why => {
    if (lost) return;
    lost = new Error(`the browser closed its DevTools connection (${why}): it quit, crashed or was stopped`);
    for (const waiting of pending.values()) waiting.reject(lost);
    pending.clear();
  };
  socket.addEventListener('close', event => disconnected(`close code ${event.code}`));
  socket.addEventListener('error', event => disconnected(event.message || 'socket error'));
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id) {
      const { method, params } = message;
      if (method === 'Runtime.exceptionThrown') problems.push(`exception: ${params.exceptionDetails.exception?.description ?? params.exceptionDetails.text}`);
      else if (method === 'Runtime.consoleAPICalled' && params.type === 'error') problems.push(`console.error: ${params.args.map(arg => arg.value ?? arg.description).join(' ')}`);
      else if (method === 'Log.entryAdded' && params.entry.level === 'error') problems.push(`${params.entry.source}: ${params.entry.text} ${params.entry.url ?? ''}`);
      return;
    }
    const waiting = pending.get(message.id); if (!waiting) return;
    pending.delete(message.id);
    if (message.error) waiting.reject(new Error(`${waiting.method}: ${message.error.message}`)); else waiting.resolve(message.result);
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    if (lost) { reject(lost); return; }
    const id = ++sequence; pending.set(id, { resolve, reject, method });
    try { socket.send(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) })); } catch (error) { pending.delete(id); reject(error); }
  });
  closeBrowser = async () => { if (!lost) await Promise.race([send('Browser.close').then(() => new Promise(resolve => socket.addEventListener('close', resolve))), sleep(5000)]); };
  // The browser's own processes, by its own account: what is ended if it does not quit when asked.
  const processes = async () => { for (const p of (await send('SystemInfo.getProcessInfo').catch(() => ({ processInfo: [] }))).processInfo) pids.add(p.id); };
  await processes();

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }), { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const page = (method, params) => send(method, params, sessionId);
  // An expression's value in the page; what it throws is thrown here.
  const evaluate = async expression => {
    const { result, exceptionDetails } = await page('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (exceptionDetails) throw new Error(`the page threw: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
    return result.value;
  };
  await page('Page.enable'); await page('Runtime.enable'); await page('Log.enable');
  await page('Emulation.setDeviceMetricsOverride', { width: size[0], height: size[1], deviceScaleFactor: 1, mobile: false });
  await page('Page.bringToFront');
  const query = new URLSearchParams({ shot: '1', seed: `${seed}`, at: at.join(','), zoom: `${zoom}` });
  if (level !== null) query.set('reach', `${level}`);
  if (options.lit) query.set('lit', '1');
  if (options.met) query.set('met', '1');
  if (options.wake) query.set('wake', '1');
  if (options.key) query.set('key', '1');
  if (options.pocket) query.set('pocket', '1');
  if (haul) query.set('haul', String(haul));
  await page('Page.navigate', { url: `${origin}/index.html?${query}` });
  await processes();
  // The page says when the view is staged; if its scripts failed it never will, and what it said instead is told.
  const told = () => [...problems, ...missing.map(name => `not found: ${name}`)].join('\n  ');
  for (const start = Date.now(); !await evaluate('!!(window.tetherbore && window.tetherbore.shot)'); await sleep(100)) {
    if (problems.some(problem => problem.startsWith('exception')) || missing.length || Date.now() - start > 60000) throw new Error(`the page did not stage the view:\n  ${told() || 'it said nothing in a minute'}`);
  }
  // `advance` steps while its clock is short of the time asked for: half a frame short of n frames is n steps.
  const facts = JSON.parse(await evaluate(`tetherbore.advance(${frames ? (frames - 0.5) * 1000 / 60 : 0}); JSON.stringify(tetherbore.shot.facts())`));
  const { data } = await page('Page.captureScreenshot', { format: 'png' });
  const png = Buffer.from(data, 'base64');
  if (png.length < 24 || png.readUInt32BE(0) !== 0x89504e47) throw new Error('the browser did not hand over a PNG');
  if (problems.some(problem => problem.startsWith('exception'))) throw new Error(`the page threw while the game was stepped:\n  ${told()}`);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, png);
  if (told()) console.error(`The page complained:\n  ${told()}`);
  const narrowed = facts.zoom < zoom ? ` (zoom ${+facts.zoom.toFixed(2)}, not ${zoom}: no canvas is made wider than ${Math.max(...facts.canvas)} pixels)` : '';
  console.log(`seed ${facts.seed}: the drill ${compass(facts.at)}, in ${facts.ground} (ground ${facts.biome}), reach ${facts.reach} (level ${facts.level}); ${facts.cells[0]} x ${facts.cells[1]} cells in view${narrowed}`
    + `${facts.lit ? ', lit' : ''}, ${facts.loose} loose piece${facts.loose === 1 ? '' : 's'} known${options.wake ? `, ${facts.woke ?? 'no hazard near to be'} woken` : ''}${options.key ? (facts.key ? `, at the last key of the slab at ${facts.key.slab} (radius ${facts.key.radius}), the cut's glow on ${facts.key.glow} cells` : ', no slab near to stand at the last key of') : ''}${options.pocket ? (facts.pocket ? `, inside the ${facts.pocket.ground} at ${facts.pocket.at} (radius ${+facts.pocket.radius.toFixed(1)})${haul ? `, ${facts.pocket.hauled} cells hauled, specimens ${JSON.stringify(facts.pocket.specimens)}` : ''}` : ', no pocket near to stand in') : ''}; ${frames} frame${frames === 1 ? '' : 's'}; ${png.readUInt32BE(16)} x ${png.readUInt32BE(20)} pixels`);
  console.log(out);
}

let code = 1;
try {
  // However it goes wrong, it ends: a picture that takes five minutes is not coming.
  let timer;
  await Promise.race([take(), new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error('no picture after five minutes: given up')), 300000); })]).finally(() => clearTimeout(timer));
  code = 0;
} catch (error) {
  console.error(`No picture was taken: ${error.message}`);
} finally {
  await close();
}
process.exit(code);
