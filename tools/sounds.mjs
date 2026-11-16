// Measures the game's sounds, so that they can be judged by number with no ear on a speaker:
//   node tools/sounds.mjs [only: a word the row's name must hold] [--wav folder] [--module js/audio.js] [--json] [--browser path]
//
// It renders js/audio.js in an installed Edge or Chrome run headless, with an OfflineAudioContext standing in for
// the live one: the module is loaded afresh for every row, unlocked, and its sounds asked for at set times while
// the browser renders the sound that would have reached the speaker, after the compressor and the ceiling. Nothing
// is played and nothing waits for real time: a minute of music is rendered in a second or two. One row a sound,
// then the bursts (cuts faster than they can sound, a held grind, a haul paid out, a run of six hauls, everything
// at once), then the mute, the bed and the music. For each row:
//   length   seconds from the first sound asked for to the last moment louder than -60 dB of full level
//   peak     the loudest sample, in dB of full level (0 is the most a speaker can take)
//   rms      the level over that length, in dB
//   clip     how many samples reached full level: any at all is a fault, and the row is marked
//   high     the share of the energy above 4 kHz, in percent (a high share is hiss or shrillness)
//   nodes    audio nodes made by the sounds asked for (not those made once at unlock), and the most by one call
//   voices   the most sources sounding at once
//   cost     the time one call took on this machine, in microseconds: the median and the worst. (For a row of one
//            sound, of twenty calls made beforehand, once the browser had compiled it; for a burst, of its own calls,
//            most of which the least gap turns away.)
//   first    the time the first call took, in a page where no sound had yet been made: the browser builds each
//            kind of node and each waveform when it is first asked for, so this is paid once a sitting
// The music's rows also say how many nodes are held from the unlock on (the master's chain, the bed's and the
// music's) and how many timers run. There is a row of each ground's piece alone, with no bed (`music: <score>`),
// and of three crosses. The run fails (exit 1) if any row clips, a muted row makes a sound or a node, a sound
// throws or has not died away when its row ends, or a node is made that no sound asked for (the music is to make
// none as it plays); or if a piece alone is not under the sounds (its peak over -18 dB or its level over -30 dB)
// or cannot be heard (its level under -62 dB). `--wav` writes every row as a 16-bit mono WAV file, to be listened to. `--module` measures
// another file of sounds in the same way (the one before a change, say), given from the top of the checkout.
//
// Like tools/shot.mjs it serves this checkout on a loopback port, read only, drives the browser over the DevTools
// protocol with Node's own WebSocket (Node.js 22 or newer), on a profile of its own under the system's temp
// folder, and closes both whatever happens. Exit codes: 0 measured and well; 1 a fault, or it failed (the reason is
// printed); 2 the arguments were wrong; 3 no browser was found.
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const usage = 'node tools/sounds.mjs [word] [--wav folder] [--module js/audio.js] [--json] [--browser path]';
const wrong = why => { console.error(`${why}\n  ${usage}`); process.exit(2); };
const options = { wav: '', module: 'js/audio.js', json: false, browser: '' };
let only = '';
for (let args = process.argv.slice(2), i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--help' || arg === '-h') { console.log(usage); process.exit(0); }
  if (!arg.startsWith('--')) { only = arg; continue; }
  const [name, inline] = arg.slice(2).split(/=(.*)/s);
  if (!(name in options)) wrong(`There is no option --${name}.`);
  if (typeof options[name] === 'boolean') { options[name] = true; continue; }
  const value = inline ?? args[++i];
  if (value === undefined) wrong(`--${name} needs a value.`);
  options[name] = value;
}
if (typeof WebSocket !== 'function') { console.error('This tool needs Node.js 22 or newer, which has a WebSocket client built in.'); process.exit(2); }
if (!await access(path.join(root, options.module)).then(() => true, () => false)) wrong(`There is no ${options.module} in this checkout.`);

// ---------------------------------------------------------------- what is asked of the sounds
// A row: its name, how many seconds are rendered, and what is asked for: [seconds from the start, sound, ...arguments].
// A row may also set `muted`, `music` (the switch; off unless a row turns it on), `bed` ([ground, deep, cells from the
// core]: the sound of the place is started, as the game starts it), `moves` ([seconds, ground, deep, cells]) and
// `score` (a ground whose music is played alone, with no bed). A ground is a score's name, a row or a number.
const one = (name, seconds, sound, ...args) => ({ name, seconds, events: [[0, sound, ...args]] });
const every = (gap, count, sound, args = () => [], from = 0) => Array.from({ length: count }, (_, n) => [from + n * gap, sound, ...args(n)]);
// Three crosses, as rows of the world are (the host's piece with the donor's voice and a structure's change).
const CROSSES = [{ name: 'hollow thaw', kin: 1, cross: { host: 1, donor: 2, structure: 1 } }, { name: 'banded buzzmire', kin: 3, cross: { host: 3, donor: 4, structure: 4 } },
  { name: 'crazed hoarsand', kin: 4, cross: { host: 4, donor: 1, structure: 2 } }];
const haul = (at, size, link) => [[at, 'crack', size, link], ...every(0.045, 16, 'tick', n => [n], at + 0.5), [at + 0.5 + 16 * 0.045, 'banked', size]];
const rows = [
  one('dig soft', 1, 'dig', 1), one('dig dense', 1, 'dig', 2), one('dig slate', 1, 'dig', 3), one('dig vault', 1, 'dig', 4),
  one('dig ore', 1.5, 'dig', 2, 'ore'), one('dig ice', 1, 'dig', 1, 'ice'), one('crumble', 1, 'crumble'), one('grind', 1, 'grind'),
  one('slide 3', 1, 'slide', 3), one('slide 12', 1, 'slide', 12), one('thud', 1, 'thud'), one('clink', 1.5, 'clink'), one('twang', 1.5, 'twang'),
  one('crack 3', 2, 'crack', 3, 0), one('crack 12', 2, 'crack', 12, 0), one('crack 40', 2.5, 'crack', 40, 0), one('crack 120', 2.5, 'crack', 120, 0), one('crack 300 link 4', 2.5, 'crack', 300, 4),
  one('tick 0', 1.5, 'tick', 0), one('tick 14', 1.5, 'tick', 14), one('tick no step', 1.5, 'tick'),
  one('gem 0', 2, 'gem', 0), one('gem 5', 2, 'gem', 5), one('gem 10', 2, 'gem', 10),
  one('banked 5', 2, 'banked', 5), one('banked 15', 2.5, 'banked', 15), one('banked 40', 2.5, 'banked', 40), one('banked 150', 3, 'banked', 150),
  one('dock', 2, 'dock'), one('buy', 2.5, 'buy'), one('deny', 1.5, 'deny'), one('tap', 1, 'tap'), one('zap', 2, 'zap'), one('hiss', 1.5, 'hiss'), one('puff', 1.5, 'puff'),
  one('freeze', 1.5, 'freeze'), one('relic', 3.5, 'relic'), one('knock', 1.5, 'knock'), one('wreck', 3.5, 'wreck'), one('mend', 2, 'mend'),
  one('chime 0', 3, 'chime', 0), one('place 1', 2, 'place', 1), one('arrive 2', 3.5, 'arrive', 2), one('place hive', 2, 'place', 'hive'), one('arrive rime', 3.5, 'arrive', 'rime'), one('spot relic', 2, 'spot', 'relic'), one('ping 1', 1.5, 'ping', 1),
  one('step', 1, 'step', 0.5), one('recall', 1.5, 'recall'), one('low', 1.5, 'low'),
  { name: 'burst: 20 digs in a second', seconds: 2, events: every(0.05, 20, 'dig', n => [1 + (n % 3 === 2)]) },
  { name: 'burst: 60 digs asked in a second', seconds: 2, events: every(1 / 60, 60, 'dig', n => [2, n % 4 ? '' : 'ore']) },
  { name: 'burst: grind held a second', seconds: 2, events: every(1 / 30, 30, 'grind') },
  { name: 'burst: a block breaks 20 a second', seconds: 2, events: every(0.05, 20, 'crumble') },
  { name: 'burst: a haul of 40 paid out', seconds: 3.5, events: haul(0, 40, 0) },
  { name: 'burst: a run of six hauls', seconds: 11, events: [0, 1, 2, 3, 4, 5].flatMap(n => haul(n * 1.5, 14 + n * 6, n)) },
  { name: 'burst: everything at once', seconds: 4.5, events: [[0.2, 'crack', 300, 5], [0.2, 'banked', 150], [0.2, 'relic'], [0.2, 'gem', 5], [0.2, 'knock'], [0.2, 'zap'], [0.2, 'dig', 4], [0.2, 'buy'], [0.2, 'wreck'],
    ...every(0.045, 20, 'tick', n => [n], 0.2), ...every(0.05, 20, 'dig', () => [3], 0.22)] },
  { name: 'muted: a haul of 40', seconds: 2, muted: true, music: true, bed: [0, false, 0], events: haul(0, 40, 0) },
  { name: 'the bed alone, home', seconds: 20, bed: [0, false, 0], events: [] },
  { name: 'music alone, on the core', seconds: 60, music: true, events: [] },
  { name: 'music and bed, home', seconds: 60, music: true, bed: [0, false, 40], events: [] },
  { name: 'music and bed, magma, far', seconds: 60, music: true, bed: ['magma', false, 1500], events: [] },
  { name: 'music, eight grounds in a minute', seconds: 60, music: true, bed: ['frost', false, 200],
    moves: [[7.5, 'firn', false, 300], [15, 'hive', false, 300], [22.5, 'ember', false, 300], [30, CROSSES[0], false, 600], [37.5, 'mire', false, 300], [45, 'lode', false, 300], [52.5, 'glaze', false, 400]], events: [] },
  { name: 'music under a run of six hauls', seconds: 20, music: true, bed: [0, false, 40], events: [0, 1, 2, 3, 4, 5].flatMap(n => haul(8 + n * 1.5, 14 + n * 6, n)) },
  { name: 'music turned off at 10 s', seconds: 16, music: true, events: [[10, 'music-off']] },
  ...['crust', 'frost', 'ember', 'mire', 'lode', 'rime', 'magma', 'bloom', 'gilt', 'firn', 'serac', 'scoria', 'forge', 'tangle', 'sporefall', 'redrock', 'loess',
    'hive', 'drift', 'ash', 'grotto', 'tinder', 'glaze', 'shale', ...CROSSES].map(score => ({ name: `music: ${score.name ?? score}`, seconds: 24, music: true, score, events: [] })),
].filter(row => row.name.includes(only));
if (!rows.length) wrong(`No row's name holds "${only}".`);

// ---------------------------------------------------------------- the page's side: render one row, and measure it
// (This function is sent to the page as text: it sees nothing of this file.)
async function measure(row, module, wav) {
  const RATE = 48000, state = window.soundsTool ??= { serial: 0 };
  if (!state.counting) {
    // Every node that is made is counted, and every source's start and stop written down.
    state.counting = true; state.made = 0; state.lives = [];
    for (const name of Object.getOwnPropertyNames(BaseAudioContext.prototype)) {
      if (!/^create/.test(name) || /^create(Buffer|PeriodicWave)$/.test(name)) continue;
      const create = BaseAudioContext.prototype[name];
      BaseAudioContext.prototype[name] = function (...args) { state.made++; return create.apply(this, args); };
    }
    for (const proto of [AudioScheduledSourceNode.prototype, AudioBufferSourceNode.prototype]) {
      const start = proto.start;
      proto.start = function (when, ...rest) { const life = [when ?? this.context.currentTime, Infinity]; this.soundsLife = life; state.lives.push(life); return start.call(this, ...(when === undefined ? [] : [when, ...rest])); };
    }
    const stop = AudioScheduledSourceNode.prototype.stop;
    AudioScheduledSourceNode.prototype.stop = function (when) { if (this.soundsLife) this.soundsLife[1] = when ?? this.context.currentTime; return stop.call(this, ...(when === undefined ? [] : [when])); };
    // The music's timer is kept here and run on the rendering's own clock.
    state.timers = [];
    window.setInterval = (run, ms) => { state.timers.push({ run, ms }); return state.timers.length; };
    window.clearInterval = id => { if (state.timers[id - 1]) state.timers[id - 1] = null; };
  }
  localStorage.setItem('tetherbore-mute', row.muted ? '1' : '0'); localStorage.setItem('tetherbore-music', row.music ? '1' : '0');
  // What one call costs once the browser has compiled it: a row of one sound has it asked for twenty-four times
  // first, on a context of its own, and the first four are not counted.
  let warm = null;
  if (row.events.length === 1 && row.events[0][1] !== 'music-off') {
    const [, name, ...args] = row.events[0], spare = new OfflineAudioContext(1, RATE * 10, RATE), took = [];
    window.AudioContext = function () { return spare; };
    const other = await import(`/${module}?row=${++state.serial}`);
    other.unlock();
    if (other.sfx[name]) {
      const ask = () => { const t0 = performance.now(); try { other.sfx[name](...args); } catch { /* the row itself says so */ } took.push((performance.now() - t0) * 1000); };
      ask();
      for (let n = 1; n < 24; n++) spare.suspend(n * 0.4).then(() => { ask(); spare.resume(); });
      await spare.startRendering();
      took.splice(0, 4); took.sort((a, b) => a - b);
      warm = [took[took.length >> 1], took[took.length - 1]];
    }
  }
  state.timers.length = 0; state.lives.length = 0; state.made = 0;
  const frames = Math.round(row.seconds * RATE), ctx = new OfflineAudioContext(1, frames, RATE);
  window.AudioContext = function () { return ctx; };
  const audio = await import(`/${module}?row=${++state.serial}`);
  const thrown = [], costs = [];
  let most = 0, calls = 0, asked = 0;
  const began = performance.now();
  audio.unlock();
  const unlock = (performance.now() - began) * 1000;
  if (row.bed) audio.setAmbience?.(...row.bed);
  if (row.score) audio.hear?.(row.score);
  const fixed = state.made, timers = state.timers.filter(Boolean).length;
  state.made = 0;
  // What happens at each moment, in order: the music's timer first, then the sounds asked for.
  const moments = new Map(), at = (t, what) => { const key = Math.round(t * RATE / 128) * 128; if (!moments.has(key)) moments.set(key, []); moments.get(key).push(what); };
  for (const timer of state.timers) if (timer) for (let t = timer.ms / 1000; t < row.seconds; t += timer.ms / 1000) at(t, () => { if (state.timers.includes(timer)) timer.run(); });
  for (const [t, ground, deep, far] of row.moves ?? []) at(t, () => audio.setAmbience(ground, deep, far));
  let unknown = 0;
  for (const [t, name, ...args] of row.events) at(t, () => {
    if (name === 'music-off') { audio.setMusic?.(false); return; }
    if (!audio.sfx[name]) { unknown++; return; }
    const before = state.made, t0 = performance.now();
    try { audio.sfx[name](...args); } catch (error) { thrown.push(`${name}: ${error.message}`); }
    costs.push((performance.now() - t0) * 1000);
    calls++; asked += state.made - before; most = Math.max(most, state.made - before);
  });
  // (Console warnings are how the sounds say one of them went wrong.)
  const warn = console.warn;
  console.warn = (...said) => { thrown.push(said.map(part => part?.message ?? String(part)).join(' ')); };
  for (const [key, list] of [...moments].sort((a, b) => a[0] - b[0])) {
    const run = () => { for (const what of list) try { what(); } catch (error) { thrown.push(error.message); } };
    if (key === 0) run(); else if (key < frames) ctx.suspend(key / RATE).then(() => { run(); ctx.resume(); });
  }
  const sound = (await ctx.startRendering()).getChannelData(0);
  console.warn = warn;
  const first = Math.round((row.events[0]?.[0] ?? 0) * RATE);
  let peak = 0, clip = 0, last = -1, sum = 0;
  for (let i = 0; i < frames; i++) { const a = Math.abs(sound[i]); if (a > peak) peak = a; if (a >= 0.999) clip++; if (a > 0.001) last = i; }
  for (let i = first; i <= last; i++) sum += sound[i] * sound[i];
  let tail = 0;
  for (let i = Math.max(0, frames - 480); i < frames; i++) tail = Math.max(tail, Math.abs(sound[i]));
  // The share of the energy above 4 kHz: what a one-pole highpass at 4 kHz, run twice, lets through.
  let high = 0, all = 0;
  { const k = Math.exp(-2 * Math.PI * 4000 / RATE); let l1 = 0, l2 = 0; for (let i = first; i <= last; i++) { const x = sound[i]; l1 = l1 * k + x * (1 - k); const h1 = x - l1; l2 = l2 * k + h1 * (1 - k); const h2 = h1 - l2; high += h2 * h2; all += x * x; } }
  // The most sources sounding at once, of those the sounds made (the music's and the bed's never stop).
  const edges = state.lives.filter(life => life[1] < Infinity).flatMap(([from, to]) => [[from, 1], [to, -1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let voices = 0, now = 0;
  for (const [, step] of edges) { now += step; if (now > voices) voices = now; }
  costs.sort((a, b) => a - b);
  let data = null;
  if (wav) {
    const bytes = new Uint8Array(44 + frames * 2), view = new DataView(bytes.buffer);
    const text = (at, word) => { for (let i = 0; i < word.length; i++) bytes[at + i] = word.charCodeAt(i); };
    text(0, 'RIFF'); view.setUint32(4, 36 + frames * 2, true); text(8, 'WAVEfmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, RATE, true); view.setUint32(28, RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, frames * 2, true);
    for (let i = 0; i < frames; i++) view.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, Math.round(sound[i] * 32767))), true);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
    data = btoa(binary);
  }
  return { name: row.name, length: last < first ? 0 : (last + 1 - first) / RATE, peak, rms: last < first ? 0 : Math.sqrt(sum / (last + 1 - first)), clip, high: all ? high / all : 0, tail,
    nodes: asked, beside: state.made - asked, most, voices, calls, unknown, fixed, timers, cost: warm ? warm[0] : costs.length ? costs[costs.length >> 1] : 0, worst: warm ? warm[1] : costs.length ? costs[costs.length - 1] : 0, cold: costs.length ? costs[costs.length - 1] : 0, unlock, thrown, exact: crossOriginIsolated, data };
}

// ---------------------------------------------------------------- the browser to use (as tools/shot.mjs finds it)
const programs = base => [path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe')];
const installed = {
  win32: [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter(Boolean).flatMap(programs).sort((a, b) => b.includes('Edge') - a.includes('Edge')),
  darwin: ['Google Chrome', 'Microsoft Edge', 'Chromium'].map(name => `/Applications/${name}.app/Contents/MacOS/${name}`),
  linux: ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'].flatMap(name => ['/usr/bin', '/usr/local/bin', '/snap/bin'].map(folder => `${folder}/${name}`)),
}[process.platform] ?? [];
let program = options.browser || null;
for (const candidate of program ? [] : installed) if (await access(candidate).then(() => true, () => false)) { program = candidate; break; }
if (!program) { console.error('No Chromium-based browser (Edge or Chrome) was found, so nothing was measured. Name one with --browser.'); process.exit(3); }

// ---------------------------------------------------------------- the server: this checkout's scripts, read only
// (The page is isolated from other origins, which is what lets it tell time to a few microseconds.)
const HEADERS = { 'Cache-Control': 'no-store', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };
const server = createServer(async (request, response) => {
  const answer = (status, type, body = '') => { response.writeHead(status, { ...HEADERS, 'Content-Type': type }); response.end(body); };
  if (request.method !== 'GET') { answer(405, 'text/plain', 'This server only reads.'); return; }
  let name;
  try { name = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); } catch { answer(400, 'text/plain'); return; }
  if (name === '/') { answer(200, 'text/html; charset=utf-8', '<!doctype html><meta charset="utf-8"><title>sounds</title>'); return; }
  const file = path.join(root, name);
  if (!file.startsWith(root + path.sep) || !/\.m?js$/.test(name) || name.split('/').some(part => part.startsWith('.'))) { answer(404, 'text/plain'); return; }
  try { answer(200, 'text/javascript; charset=utf-8', await readFile(file)); } catch { answer(404, 'text/plain'); }
});

// ---------------------------------------------------------------- everything that must be closed, closed once
let browser = null, profile = null, closeBrowser = null, closing = null;
const pids = new Set();
const gone = async (folder, most = 12) => {
  for (let tries = 0; tries < most; tries++) {
    if (await rm(folder, { recursive: true, force: true }).then(() => true, () => false)) return true;
    await sleep(250);
  }
  return false;
};
const close = () => closing ??= (async () => {
  await closeBrowser?.().catch(() => {});
  browser?.kill();
  server.closeAllConnections(); server.close();
  if (profile && !await gone(profile)) {
    for (const pid of pids) { try { process.kill(pid); } catch { /* already gone */ } }
    if (!await gone(profile, 80)) console.error(`The browser's profile could not be removed: ${profile}`);
  }
})();
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => { close().then(() => process.exit(130)); });

// ---------------------------------------------------------------- the measuring
const dB = level => level > 0 ? (20 * Math.log10(level)).toFixed(1) : '-inf';
async function run() {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  profile = await mkdtemp(path.join(os.tmpdir(), 'tetherbore-sounds-'));
  browser = spawn(program, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-networking', '--disable-component-update', '--disable-sync', '--mute-audio', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let complaints = '', unstarted = null;
  browser.stderr.on('data', chunk => { complaints += chunk; }); browser.once('error', error => { unstarted = error; });
  let endpoint = null;
  for (const start = Date.now(); !endpoint && Date.now() - start < 60000; await sleep(100)) {
    if (unstarted) throw new Error(`the browser (${program}) could not be started: ${unstarted.message}`);
    const [port, address] = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8').catch(() => '')).split('\n');
    if (address) endpoint = `ws://127.0.0.1:${port}${address}`;
  }
  if (!endpoint) throw new Error(`the browser (${program}) did not open its DevTools port within a minute:\n${complaints.trim()}`);

  const socket = new WebSocket(endpoint), pending = new Map();
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
    const message = JSON.parse(event.data), waiting = pending.get(message.id);
    if (!waiting) return;
    pending.delete(message.id);
    if (message.error) waiting.reject(new Error(`${waiting.method}: ${message.error.message}`)); else waiting.resolve(message.result);
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    if (lost) { reject(lost); return; }
    const id = ++sequence; pending.set(id, { resolve, reject, method });
    try { socket.send(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) })); } catch (error) { pending.delete(id); reject(error); }
  });
  closeBrowser = async () => { if (!lost) await Promise.race([send('Browser.close').then(() => new Promise(resolve => socket.addEventListener('close', resolve))), sleep(5000)]); };
  const processes = async () => { for (const p of (await send('SystemInfo.getProcessInfo').catch(() => ({ processInfo: [] }))).processInfo) pids.add(p.id); };
  await processes();
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }), { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const page = (method, params) => send(method, params, sessionId);
  const evaluate = async expression => {
    const { result, exceptionDetails } = await page('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (exceptionDetails) throw new Error(`the page threw: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
    return result.value;
  };
  await page('Page.enable'); await page('Runtime.enable');
  await page('Page.navigate', { url: `${origin}/` });
  for (const start = Date.now(); await evaluate('document.readyState') !== 'complete' || await evaluate('location.origin') !== origin; await sleep(50)) if (Date.now() - start > 30000) throw new Error('the page did not load');
  await processes();
  await evaluate(`window.measure = ${measure}; 1`);

  if (options.wav) await mkdir(path.resolve(options.wav), { recursive: true });
  const results = [], faults = [];
  for (const row of rows) {
    const result = JSON.parse(await evaluate(`measure(${JSON.stringify(row)}, ${JSON.stringify(options.module.replaceAll('\\', '/'))}, ${!!options.wav}).then(JSON.stringify)`));
    if (result.data) await writeFile(path.join(path.resolve(options.wav), `${row.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}.wav`), Buffer.from(result.data, 'base64'));
    delete result.data;
    results.push(result);
    if (result.clip) faults.push(`${row.name}: ${result.clip} samples reached full level`);
    for (const said of result.thrown) faults.push(`${row.name}: a sound went wrong: ${said}`);
    if (row.muted && (result.peak > 0 || result.nodes)) faults.push(`${row.name}: muted, yet it made ${result.nodes} nodes and a peak of ${dB(result.peak)} dB`);
    if (result.beside) faults.push(`${row.name}: ${result.beside} nodes were made as it played that no sound asked for${row.music ? ': the music is to make none' : ''}`);
    if (row.score && (result.peak > 10 ** (-18 / 20) || result.rms > 10 ** (-30 / 20))) faults.push(`${row.name}: the music is to stay under the sounds, and it peaks at ${dB(result.peak)} dB with a level of ${dB(result.rms)} dB`);
    if (row.score && !(result.rms > 10 ** (-62 / 20))) faults.push(`${row.name}: the music cannot be heard (${dB(result.rms)} dB)`);
    if (!row.music && !row.bed && result.tail > 0.001) faults.push(`${row.name}: it has not died away when its ${row.seconds} seconds are up`);
  }
  if (options.json) console.log(JSON.stringify(results, null, 1));
  else {
    const cells = results.map(r => [r.name, r.length.toFixed(2), dB(r.peak), dB(r.rms), r.clip ? `${r.clip} !` : '0', (r.high * 100).toFixed(0), `${r.nodes}${r.calls > 1 ? ` (${r.most})` : ''}`, String(r.voices),
      r.calls ? `${r.cost.toFixed(0)} (${r.worst.toFixed(0)})` : '', r.calls ? r.cold.toFixed(0) : '', [r.unknown ? `${r.unknown} not known` : '', r.thrown.length ? 'WENT WRONG' : '', r.timers || r.fixed !== results[0].fixed ? `holds ${r.fixed} nodes, ${r.timers} timer${r.timers === 1 ? '' : 's'}` : ''].filter(Boolean).join(', ')]);
    const head = ['sound', 'length s', 'peak dB', 'rms dB', 'clip', 'high %', 'nodes (most)', 'voices', 'cost us (worst)', 'first us', ''];
    const wide = head.map((word, n) => Math.max(word.length, ...cells.map(row => row[n].length)));
    for (const row of [head, ...cells]) console.log(row.map((cell, n) => n ? cell.padStart(wide[n]) : cell.padEnd(wide[n])).join('  ').trimEnd());
    console.log(`\n${options.module}, rendered by ${path.basename(program)} at 48 kHz; made once at unlock: ${results[0].fixed} nodes, in ${(results.reduce((sum, r) => sum + r.unlock, 0) / results.length / 1000).toFixed(1)} ms${results[0].exact ? '' : '; (times are to a tenth of a millisecond only: the page was not isolated)'}`);
    if (options.wav) console.log(`WAV files: ${path.resolve(options.wav)}`);
  }
  for (const fault of faults) console.error(`FAULT  ${fault}`);
  return faults.length ? 1 : 0;
}

let code = 1;
try {
  let timer;
  code = await Promise.race([run(), new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error('not done after five minutes: given up')), 300000); })]).finally(() => clearTimeout(timer));
} catch (error) {
  console.error(`Nothing was measured: ${error.message}`);
} finally {
  await close();
}
process.exit(code);
