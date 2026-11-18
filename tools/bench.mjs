// One interleaved A/B benchmark of two copies of the game: first load, a saved game's load, staged frames, the
// step, what a frame allocates, and pictures compared pixel by pixel. Every later change for speed is measured with
// it, A the commit before and B the working tree, so that what is said of it is said the same way each time.
//   node tools/bench.mjs load  [--net none|4g|3g] [--cpu 1|4|6] [--cache cold|warm|reval] [--lang en|ru|zh]
//   node tools/bench.mjs save  --save <fixture.json.gz | name> [--cpu 1|4|6]
//   node tools/bench.mjs mksave <syn2-all|syn2-axes|syn1-all|syn1-axes> <out.json.gz>
//   node tools/bench.mjs frame [--scene core,cave,far,dig,crowd,boss,haul,shop,lab,chart,fly] [--cpu 4|6] [--frames 300] [--dpr 3] [--size 360x640]
//   node tools/bench.mjs step  [--cpu 1|4|6] [--fauna] [--seed 11] [--turns 600]
//   node tools/bench.mjs alloc [--part render|update|both] [--fauna] [--rows max|plain]
//   node tools/bench.mjs shots [--set all|text|hud|map|haul|world|panels[,...]] [--size 180x320,360x640]
// and with each: [--a <ref|dir>] [--b <ref|dir>] [--rounds 3] [--out file.json] [--browser path]
//
// The two roots. `--a` (HEAD if not given) and `--b` (`.`, the working tree as it is, if not given) are each a git
// ref or a directory. A ref is `git archive`d (line endings as git holds them, LF) into <dir>/roots/<sha>/ and kept
// there for the next run; <dir> is $TB_BENCH_DIR, or tetherbore-bench in the system's temp folder. Each root is
// served by a server of the bench's own as GitHub Pages serves the game (tools/bench/serve.mjs: gzip -6 on text,
// max-age=600, a weak ETag and 304 to If-None-Match; for load and save over HTTP/2 and TLS, with a self-signed
// certificate made once with openssl into <dir>/tls/), text with LF endings whatever the checkout has, so a working
// tree with CRLF sends what a commit would.
//
// The rounds. Every timing runs A and B interleaved, `--rounds` times (3 if not given), the order flipped every other
// round (AB BA AB ...), each run in a browser started afresh on a profile of its own that is deleted afterwards
// (tools/bench/cdp.mjs: Edge or Chrome as tools/shot.mjs finds it, headless, 360 by 640, mobile emulation, CPU
// throttled by --cpu with Emulation.setCPUThrottlingRate). Each metric is printed as its median [min-max] for A and
// for B, and B-A, the difference of the medians with its sign; `~` after it says the two ranges overlap, so that a
// difference that small is within what the runs moved by themselves. The browser, the CPU rate and the machine (its
// CPUs and how busy they were, measured over a second before and over the whole run: other work on the machine moves
// every timing) are printed first. `--out` keeps every run's raw values as JSON.
//
//   load   The first load of the game: index.html opened on a fresh profile under --net (none; 4g, 165 ms and
//          1.01 MB/s down; 3g, 562.5 ms and 180 KB/s), at DPR 3. The metric is the ms from navigationStart to the end
//          of the first animation frame's callback (the game's first update and render, timed by a wrapper put in
//          before any script of the page), with the bytes the server sent (bodies, gzipped where text), the
//          requests it answered, and when the last module and the last PNG arrived. The measured visit waits two
//          seconds after the browser has started (Edge, measured at once, made no request for a second and a half
//          after the page's HTML in two runs of three). --cache warm and reval visit
//          twice first on the same profile, the browser started again each time (V8 keeps a script's code cache from
//          its second load), and measure the third: warm with everything fresh for 600 s; reval with every response
//          saying max-age=0, so the third asks again for each and is answered 304.
//   save   A long game's boot. The fixture is put into the real 'tetherbore' database and local storage of the
//          served origin (unthrottled), then index.html is opened under --cpu and timed by its parts: the database's
//          cursor read, restore (Game.restore whole), migrate (World.prototype.migrate, wrapped by an early module
//          that imports /js/world.js, the instance main.js has), the Game constructor (from its first line, the
//          game canvas's getContext, to restore), when the atlas was in (the constructor's first line), and
//          navigationStart to the end of the first and of the third frame; and the pieces the cursor gave. A fixture is a path or a name looked for in <dir>/saves/: the
//          synthetic ones are made by `mksave` (seed 7, every row at its last, the ground seen along a tunnel cut out
//          the four axes past the lords and, for -all, the four diagonals past the shrines; syn1 of generation 1);
//          long480 (the long pilot's 480 minutes on world 7, 1,530 pieces) and long300g1 (300 minutes, generation 1)
//          were played and cannot be made here.
//   frame  Staged scenes (index.html?shot&...) at --dpr 3 in a --size page: 180 frames stepped by hand, the scene's
//          own staging, 120 frames in the page's own rAF loop unthrottled to warm the JIT, then under --cpu --frames
//          more, each update(1/60) then render() timed, steered as the scene says, with a trace of the GCs; then as
//          many again with V8's sampling heap profiler (every 1 KB, objects since collected kept) for the bytes a
//          frame allocates, told apart by whether `render` is on the stack. `fly` flies north at full speed from 800
//          cells out through ground never made, a corridor five cells wide laid open in each piece as it is made, and
//          counts the pieces of world made each frame (game.world.made), printed as a histogram.
//   step   test/frame-time.mjs's flight (seed 11, 600 turns, the tether at 5 and the bit at 4) flown in the page by
//          a game of its own, cross-origin isolated (fine-grained performance.now()), with real audio, storage and
//          database; --fauna sets every kind of creature down beside the drill in turn. update alone is timed: mean,
//          p99, p999, max, the rubble's share (updateHauls), frames over 8 and 16 ms, and the GCs from a trace.
//   alloc  No browser and no rounds, A then B: tools/bench/alloc-child.mjs runs the same flight in each root's own
//          test/harness.mjs with every other row at its last (--rows plain: as bought, the step's), at 360 by 640
//          (180 by 320 game pixels), and gives the exact bytes update() and render() allocate a frame (the used
//          heap before and after, young generation 512 MB), and the canvas calls a frame by context, method, source
//          of a drawImage (tinted font, other tint, sheet, page of lines, canvas) and part of the drawing, with the
//          state sets that set what was already set. The calls are deterministic: the same code gives the same
//          counts. The bytes are too but for the frames a scavenge falls in, which are left out, so a maximum may
//          move. The canvases the game makes for itself are the harness's stand-in, whose every method asked for is
//          a closure made, so a call to one counts some bytes; the game's own two do nothing and keep their state.
//   shots  Pictures of named sets (SHOTS below), each a list of tools/shot.mjs's arguments, A twice and B once, at
//          each of the set's sizes or --size. Each is taken as tools/shot.mjs takes it (the same query to the root's
//          own js/shot.js, the page that size at DPR 1, the frames stepped by hand, the page's screenshot), by the
//          bench, which seeds Math.random before any script of the page: tools/shot.mjs leaves it alone, and the
//          motes, sparks and dust then fall elsewhere in every picture (a hundred pixels and more of the far rooms
//          differed between two pictures of one commit). A panel tools/shot.mjs cannot open (the chart, the menu,
//          STATS) is opened by a line of the page's code once the frames are stepped, and 30 frames more let it rise.
//          Pixels in which A's two differ are noise and are not counted; the pixels in which B differs from A outside
//          them are, shot by shot, with a picture of where in <dir>/px/ (red: B differs; yellow: A against A), the
//          pictures themselves in <dir>/px/shots/. A shot whose A-A noise is not zero proves less, and says so.
//          Exits 1 if any pixel differs.
//
// Exit codes: 0 done; 1 it failed, or shots found a difference; 2 the arguments were wrong; 3 no browser was found.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBrowser, launch, newProfile, removeProfile, traced } from './bench/cdp.mjs';
import { certificate, serve } from './bench/serve.mjs';
import { BOOT_HOOK, BOOT_INJECT, FILL_PAGE, SYNTH, synth } from './bench/save.mjs';
import { decodePNG, encodePNG } from './png.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.resolve(process.env.TB_BENCH_DIR || path.join(os.tmpdir(), 'tetherbore-bench'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const USAGE = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//')).slice(3, 11).map(l => l.slice(3)).join('\n');
const wrong = why => { console.error(`${why}\n${USAGE}`); process.exit(2); };

// ---------------------------------------------------------------- what was asked for
const FLAGS = new Set(['fauna', 'help']);
const argv = process.argv.slice(2), command = argv[0], positional = [], opt = {};
for (let i = 1; i < argv.length; i++) {
  const arg = argv[i];
  if (!arg.startsWith('--')) { positional.push(arg); continue; }
  const [name, inline] = arg.slice(2).split(/=(.*)/s);
  if (FLAGS.has(name)) { opt[name] = true; continue; }
  const value = inline ?? argv[++i];
  if (value === undefined) wrong(`--${name} needs a value.`);
  opt[name] = value;
}
if (!command || command === '--help' || command === '-h' || opt.help) { console.log(USAGE); process.exit(0); }
const COMMANDS = { load: ['net', 'cpu', 'cache', 'lang'], save: ['save', 'cpu'], mksave: [], frame: ['scene', 'cpu', 'frames', 'dpr', 'size'], step: ['cpu', 'fauna', 'seed', 'turns'],
  alloc: ['part', 'fauna', 'rows', 'seed', 'turns'], shots: ['set', 'size'] };
if (!(command in COMMANDS)) wrong(`There is no subcommand ${command}.`);
for (const name of Object.keys(opt)) if (![...COMMANDS[command], 'a', 'b', 'rounds', 'out', 'browser'].includes(name)) wrong(`${command} has no option --${name}.`);
const oneOf = (name, values, fallback) => { const v = String(opt[name] ?? fallback); if (!values.includes(v)) wrong(`--${name} is one of ${values.join(', ')}, not ${v}.`); return v; };
const rounds = Number(opt.rounds ?? 3);
if (!Number.isInteger(rounds) || rounds < 1) wrong(`--rounds is a whole number from 1, not ${opt.rounds}.`);

// ---------------------------------------------------------------- the roots
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
// A tar from `git archive`, unpacked with nothing but Node (pax headers for long names; links and the global header
// skipped).
function untar(buffer, into) {
  let at = 0, longName = null;
  const field = (o, n) => buffer.toString('utf8', o, o + n).replace(/\0.*$/s, '');
  while (at + 512 <= buffer.length) {
    if (buffer[at] === 0) break;
    const size = parseInt(field(at + 124, 12).trim() || '0', 8), type = String.fromCharCode(buffer[at + 156] || 48);
    const prefix = field(at + 345, 155), name = longName ?? (prefix ? `${prefix}/` : '') + field(at, 100);
    const data = buffer.subarray(at + 512, at + 512 + size);
    at += 512 + Math.ceil(size / 512) * 512;
    if (type === 'x') { const m = /\d+ path=([^\n]*)\n/.exec(data.toString('utf8')); longName = m ? m[1] : null; continue; }
    longName = null;
    if (type === 'g') continue;
    const target = path.join(into, name);
    if (type === '5') mkdirSync(target, { recursive: true });
    else if (type === '0') { mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, data); }
  }
}
async function rootOf(spec, side) {
  if (spec === '.') {
    let head = '?', changed = 0;
    try { head = git('rev-parse', '--short', 'HEAD'); changed = git('status', '--porcelain').split('\n').filter(Boolean).length; } catch { /* not a checkout */ }
    return { side, spec, dir: REPO, label: `. (the working tree: ${head}${changed ? ` and ${changed} changed file${changed === 1 ? '' : 's'}` : ', clean'})` };
  }
  if (existsSync(spec) && statSync(spec).isDirectory()) return { side, spec, dir: path.resolve(spec), label: `${spec} (a directory)` };
  let sha;
  try { sha = git('rev-parse', '--verify', `${spec}^{commit}`); } catch { wrong(`--${side.toLowerCase()} ${spec} is neither a directory nor a git ref.`); }
  const dir = path.join(DIR, 'roots', sha);
  if (!existsSync(path.join(dir, '.complete'))) {
    const tmp = `${dir}.tmp${process.pid}`;
    rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
    const tar = execFileSync('git', ['-C', REPO, '-c', 'core.autocrlf=false', '-c', 'core.eol=lf', 'archive', '--format=tar', sha], { maxBuffer: 1 << 30 });
    untar(tar, tmp);
    writeFileSync(path.join(tmp, '.complete'), sha);
    rmSync(dir, { recursive: true, force: true });
    renameSync(tmp, dir);
  }
  return { side, spec, dir, label: `${spec} (${sha.slice(0, 7)}, archived in ${dir})` };
}

// ---------------------------------------------------------------- the machine
const cpuTimes = () => os.cpus().reduce((t, c) => { const all = Object.values(c.times).reduce((a, b) => a + b, 0); t.all += all; t.idle += c.times.idle; return t; }, { all: 0, idle: 0 });
const busySince = t0 => { const t1 = cpuTimes(), all = t1.all - t0.all; return all > 0 ? Math.round(100 * (1 - (t1.idle - t0.idle) / all)) : 0; };
async function machine() {
  const t0 = cpuTimes(); await sleep(1000);
  const load = process.platform === 'win32' ? 'no load average on Windows' : `load average ${os.loadavg().map(x => x.toFixed(2)).join(' ')}`;
  return `${os.cpus().length} CPUs (${os.cpus()[0]?.model.trim()}), ${busySince(t0)}% busy over the last second, ${load}`;
}

// ---------------------------------------------------------------- figures
const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[n >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const fmt = v => v === undefined || v === null || Number.isNaN(v) ? '-' : Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : Math.abs(v) >= 1 ? v.toFixed(2) : v.toFixed(3);
const signed = v => (v > 0 ? '+' : v < 0 ? '' : '±') + fmt(v);
function table(rows, heads) {
  const widths = heads.map((h, i) => Math.max(h.length, ...rows.map(r => String(r[i]).length)));
  const line = r => r.map((c, i) => i === 0 ? String(c).padEnd(widths[i]) : String(c).padStart(widths[i])).join('  ');
  console.log(line(heads)); console.log(widths.map(w => '-'.repeat(w)).join('  '));
  for (const r of rows) console.log(line(r));
}
// Each metric of each run, by side: `runs.A` and `runs.B` are lists of { name: value }.
function summary(runs, keys = null) {
  keys ??= [...new Set([...runs.A, ...runs.B].flatMap(r => Object.keys(r)))];
  const rows = [];
  for (const k of keys) {
    const a = runs.A.map(r => r[k]).filter(Number.isFinite), b = runs.B.map(r => r[k]).filter(Number.isFinite);
    if (!a.length && !b.length) continue;
    const ma = a.length ? median(a) : NaN, mb = b.length ? median(b) : NaN, d = mb - ma;
    const pct = ma ? ` (${d >= 0 ? '+' : ''}${(100 * d / ma).toFixed(1)}%)` : '';
    const overlap = a.length && b.length && Math.max(...a) >= Math.min(...b) && Math.max(...b) >= Math.min(...a);
    rows.push([k, `${fmt(ma)} [${fmt(Math.min(...a))}-${fmt(Math.max(...a))}]`, `${fmt(mb)} [${fmt(Math.min(...b))}-${fmt(Math.max(...b))}]`, `${signed(d)}${pct}${overlap ? ' ~' : ''}`]);
  }
  table(rows, ['metric', 'A median [min-max]', 'B median [min-max]', 'B-A']);
}
const stats = a => { const s = [...a].sort((x, y) => x - y); return { mean: a.reduce((x, y) => x + y, 0) / a.length, p95: s[Math.floor(s.length * 0.95)], p99: s[Math.min(s.length - 1, Math.floor(s.length * 0.99))], p999: s[Math.min(s.length - 1, Math.floor(s.length * 0.999))], max: s[s.length - 1] }; };

// ---------------------------------------------------------------- what is open, closed however it ends
const open = new Set();
const closeAll = async () => { for (const c of [...open]) { open.delete(c); await c().catch(() => {}); } };
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { closeAll().then(() => process.exit(130)); });
async function withBrowser(options, work) {
  const browser = await launch(options);
  const close = () => browser.close();
  open.add(close);
  try { return await work(browser); } finally { open.delete(close); await close(); }
}
async function withSite(root, options, work) {
  const site = await serve(root, options);
  const close = () => site.close();
  open.add(close);
  try { return await work(site); } finally { open.delete(close); await close(); }
}

// ---------------------------------------------------------------- load
const NETS = { none: null, '4g': { latency: 165, down: 1012500, up: 168750 }, '3g': { latency: 562.5, down: 180000, up: 84375 } };
const RAF_INJECT = `(() => {
  const T = window.__lt = { raf: [] };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(ts => { const a = performance.now(); try { cb(ts); } finally { if (T.raf.length < 60) T.raf.push([a, performance.now()]); } });
})();`;
// A browser just started does work of its own for a second or two (Edge more than Chrome: a first load measured at
// once was 1.5 s later, two runs in three, its requests not made until that was done), so a run waits that out first.
const settle = async page => { await page.evaluate('1'); await sleep(2000); await page.evaluate('1'); };
let TLS = null;
const tls = () => TLS ??= certificate(path.join(DIR, 'tls'));
const tlsFlag = () => `--ignore-certificate-errors-spki-list=${tls().spki}`;

async function loadRun(root, o) {
  const net = NETS[o.net], frames = 10;
  return withSite(root.dir, { tls: tls(), routes: { '/__blank': async () => ({ type: 'text/html', body: Buffer.from('<!doctype html><title>blank</title>') }) } }, async site => {
    const profile = await newProfile();
    const visit = (measure) => withBrowser({ program: o.program, size: [360, 640], extra: [tlsFlag()], profile }, async browser => {
      const page = await browser.page();
      await page.send('Network.enable');
      await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 3, mobile: true });
      await page.send('Page.navigate', { url: `${site.origin}/__blank` }); await sleep(500);
      if (o.lang !== 'en') await page.evaluate(`localStorage.setItem('tetherbore-lang', ${JSON.stringify(o.lang)})`);
      await page.send('Page.addScriptToEvaluateOnNewDocument', { source: RAF_INJECT });
      if (measure) {
        if (o.cpu > 1) await page.send('Emulation.setCPUThrottlingRate', { rate: o.cpu });
        if (net) await page.send('Network.emulateNetworkConditions', { offline: false, latency: net.latency, downloadThroughput: net.down, uploadThroughput: net.up });
      }
      if (measure) await settle(page);
      site.log.length = 0;
      await page.send('Page.navigate', { url: `${site.origin}/index.html` });
      await page.until(`window.__lt && window.__lt.raf.length >= ${frames}`, 'the first frames', 180000);
      const r = await page.evaluate(`(() => {
        const res = performance.getEntriesByType('resource').map(e => ({ name: e.name.replace(location.origin + '/', ''), start: Math.round(e.startTime), first: Math.round(e.responseStart), end: Math.round(e.responseEnd), transfer: e.transferSize, proto: e.nextHopProtocol }));
        const n = performance.getEntriesByType('navigation')[0];
        return { raf: __lt.raf, res, nav: { fetch: n.fetchStart, connect: n.connectStart, tls: n.secureConnectionStart, request: n.requestStart, response: n.responseStart, end: n.responseEnd } };
      })()`);
      const log = site.log.filter(e => !e.own && e.name !== '/__blank');
      // (Leaving lets the page save, as a player's would on leaving, before the browser goes.)
      await page.send('Page.navigate', { url: `${site.origin}/__blank` }).catch(() => {}); await sleep(400);
      if (page.problems.length) throw new Error(`the page threw: ${page.problems.join('; ')}`);
      return { r, log };
    });
    try {
      if (o.cache !== 'cold') { site.maxAge = o.cache === 'reval' ? 0 : 600; await visit(false); await visit(false); }
      const { r, log } = await visit(true);
      const last = re => Math.max(0, ...r.res.filter(e => re.test(e.name)).map(e => e.end));
      return { resources: r.res, nav: r.nav, metrics: {
        'first frame ms': r.raf[0][1],
        'first frame callback ms': r.raf[0][1] - r.raf[0][0],
        'last module in ms': last(/\.m?js(\?|$)/),
        'last PNG in ms': last(/\.png(\?|$)/),
        'bytes sent KB': log.reduce((s, e) => s + (e.bytes ?? 0), 0) / 1024,
        'requests': log.length,
        'answered 304': log.filter(e => e.status === 304).length,
      } };
    } finally { await removeProfile(profile); site.maxAge = 600; }
  });
}

// ---------------------------------------------------------------- save
function fixture(name) {
  const tries = [name, path.join(DIR, 'saves', name), path.join(DIR, 'saves', `${name}.json.gz`)];
  const found = tries.find(f => existsSync(f) && statSync(f).isFile());
  if (found) return path.resolve(found);
  const base = path.basename(name).replace(/\.json\.gz$/, '');
  if (base in SYNTH) wrong(`No fixture ${name}: make it with  node tools/bench.mjs mksave ${base} ${path.join(DIR, 'saves', `${base}.json.gz`)}`);
  if (base === 'long480' || base === 'long300g1') wrong(`No fixture ${name}. ${base} is a save the long pilot played (tools/long-play.mjs's play() with --all, every 600, dumped as the browser's database would hold it: long480 480 minutes on world 7, long300g1 300 minutes laid by generation 1); mksave cannot make it. Copy it to ${path.join(DIR, 'saves')} or name its path.`);
  wrong(`No fixture ${name} (looked in ${tries.join(', ')}).`);
}
async function saveRun(root, o) {
  const routes = {
    '/__bench/fill.html': async () => ({ type: 'text/html; charset=utf-8', body: Buffer.from(FILL_PAGE) }),
    '/__bench/fixture.json.gz': async () => ({ type: 'application/octet-stream', body: readFileSync(o.save) }),
    '/__bench/hook.js': async () => ({ type: 'application/javascript; charset=utf-8', body: Buffer.from(BOOT_HOOK) }),
  };
  const html = text => text.replace('<script type="module" src="js/main.js"></script>', '<script type="module" src="/__bench/hook.js"></script>\n<script type="module" src="js/main.js"></script>');
  return withSite(root.dir, { tls: tls(), routes, html }, site => withBrowser({ program: o.program, size: [360, 640], extra: [tlsFlag()] }, async browser => {
    const page = await browser.page();
    await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 3, mobile: true });
    await page.send('Page.navigate', { url: `${site.origin}/__bench/fill.html` });
    await page.until('window.benchReady === true', 'the fill page');
    const filled = await page.evaluate(`bench.fill('/__bench/fixture.json.gz')`);
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: BOOT_INJECT });
    if (o.cpu > 1) await page.send('Emulation.setCPUThrottlingRate', { rate: o.cpu });
    await settle(page);
    await page.send('Page.navigate', { url: `${site.origin}/index.html` });
    await page.until('window.__bt && window.__bt.raf.length >= 3', 'the third frame', 300000);
    const T = await page.evaluate('window.__bt');
    await page.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const game = await page.evaluate('(() => { const g = window.tetherbore && window.tetherbore.game; return g ? { thrown: g.thrownOut, notice: g.notice && g.notice.title, kept: g.world.chunks.filter(Boolean).length } : null; })()');
    if (page.problems.length) throw new Error(`the page threw: ${page.problems.join('; ')}`);
    if (T.restoreStart === null || T.cursorEnd === null) throw new Error('the game did not restore the save');
    if (T.rows !== filled.pieces) throw new Error(`the database gave ${T.rows} pieces where ${filled.pieces} were put in`);
    return {
      'idb read ms': T.cursorEnd - T.cursorStart,
      'idb open ms': T.idbOpened - T.idbOpen,
      'restore ms': T.restoreEnd - T.restoreStart,
      'migrate ms': T.migrate,
      'constructor ms': T.restoreStart - T.ctorStart,
      'atlas in at ms': T.ctorStart,
      'first frame ms': T.raf[0][1],
      'third frame ends ms': T.raf[2][1],
      'pieces restored': T.rows,
      'pieces kept': game?.kept,
      'thrown out': game?.thrown,
    };
  }));
}

// ---------------------------------------------------------------- frame
const SCENES = {
  core: { q: 'lv=max&met=1', steer: 'circle' },
  cave: { q: 'at=-316,131&cave=1&lv=max&met=1', steer: 'slow' },
  far: { q: 'at=0,-900&lv=max&met=1', steer: 'circle' },
  dig: { q: 'at=300,-500&lv=max&met=1', steer: 'circle' },
  crowd: { q: 'at=-316,131&cave=1&lv=max&met=1&fauna=frog', steer: 'slow', crowd: true },
  boss: { q: 'fauna=boss-n:act:3&lv=max&met=1', steer: null },
  haul: { q: 'at=200,200&pocket=1&haul=9&lv=max', steer: null, pre: 20, warm: 0, frames: 150 },
  shop: { q: 'shop=rig&lv=max&met=1', steer: null },
  lab: { q: 'lab=all&lv=max&met=1', steer: null },
  chart: { q: 'lv=max&met=1&at=0,-400', steer: null, js: "game.openLab(true, 'chart')" },
  // North at full speed through ground never made: each piece made from now on has a corridor five cells wide laid
  // open down the drill's column, as the profiler's farfly.mjs --open laid it, so the drill flies and does not cut.
  fly: { q: 'at=0,-800&lv=max&met=1', steer: 'north', js: `const { C, N, K } = await import('/js/world.js'); const w = game.world, lay = w.lay.bind(w), x0 = Math.floor(game.drill.x) - 2;
    w.lay = (id, kind, biome) => { lay(id, kind, biome); const px = (id % 256) * 64, py = ((id / 256) | 0) * 64; if (py > game.drill.y || x0 + 5 <= px || x0 >= px + 64) return;
      for (let v = 0; v < 64; v++) for (let x = Math.max(x0, px); x < Math.min(x0 + 5, px + 64); x++) kind[v * 64 + x - px] = K.EMPTY; };` },
};
const LOOP = `(() => {
  const g = tetherbore.game;
  const KINDS = ['bat', 'moth', 'bee', 'leech', 'spitter', 'puff', 'skink', 'frog', 'beetle', 'jelly', 'salamander', 'wren', 'newt', 'pup'];
  window.__bench = (n, steer, crowd) => new Promise(res => {
    const out = new Float64Array(n * 3); let f = 0;
    const loop = () => {
      if (steer === 'circle') g.input.auto = [Math.cos(f / 45), Math.sin(f / 61), 1];
      else if (steer === 'slow') g.input.auto = [Math.cos(f / 90), Math.sin(f / 120), 0.6];
      else if (steer === 'north') g.input.auto = [0, -1, 1];
      if (crowd && f % 20 === 0 && g.fauna.alive < 16) g.fauna.stage(g, KINDS[(f / 20) % KINDS.length], 8);
      const m = g.world.made, t0 = performance.now(); g.update(1 / 60); const t1 = performance.now(); g.render(); const t2 = performance.now();
      out[f * 3] = t1 - t0; out[f * 3 + 1] = t2 - t1; out[f * 3 + 2] = g.world.made - m;
      if (++f < n) requestAnimationFrame(loop); else res(Array.from(out));
    };
    requestAnimationFrame(loop);
  });
})()`;
const GC_CATEGORIES = ['devtools.timeline', 'disabled-by-default-v8.gc'];
function gcOf(events) {
  const minor = [], major = [];
  for (const e of events) {
    if (e.ph !== 'X' && e.ph !== 'B') continue;
    if (e.name === 'MinorGC') minor.push((e.dur ?? 0) / 1000);
    else if (e.name === 'MajorGC') major.push((e.dur ?? 0) / 1000);
  }
  const sum = a => a.reduce((x, y) => x + y, 0);
  return { minor: minor.length, minorMs: sum(minor), minorMax: Math.max(0, ...minor), major: major.length, majorMs: sum(major), majorMax: Math.max(0, ...major) };
}
// Bytes of a sampling heap profile: all of it, and what was allocated with `render` (else `update`) on the stack.
function heapOf(profile) {
  let all = 0, render = 0, update = 0;
  const walk = (node, inRender, inUpdate) => {
    const name = node.callFrame.functionName, r = inRender || name === 'render', u = inUpdate || name === 'update';
    all += node.selfSize; if (r) render += node.selfSize; else if (u) update += node.selfSize;
    for (const c of node.children ?? []) walk(c, r, u);
  };
  walk(profile.head, false, false);
  return { all, render, update };
}
async function frameRun(root, o, scene) {
  const sc = SCENES[scene], n = sc.frames ?? o.frames;
  return withSite(root.dir, {}, site => withBrowser({ program: o.program, size: o.size }, async browser => {
    const page = await browser.page();
    await page.send('Emulation.setDeviceMetricsOverride', { width: o.size[0], height: o.size[1], deviceScaleFactor: o.dpr, mobile: true });
    await page.send('Page.bringToFront');
    await page.send('Page.navigate', { url: `${site.origin}/index.html?shot=1&seed=7&${sc.q}` });
    await page.until('!!(window.tetherbore && window.tetherbore.shot)', 'the staging');
    await page.evaluate(`tetherbore.advance(${((sc.pre ?? 180) - 0.5) * 1000 / 60})`);
    if (sc.js) await page.evaluate(`(async () => { const game = tetherbore.game; ${sc.js} })()`);
    await page.evaluate(LOOP);
    const call = `__bench(${n}, ${JSON.stringify(sc.steer)}, ${!!sc.crowd})`;
    if ((sc.warm ?? 120) > 0) await page.evaluate(`__bench(${sc.warm ?? 120}, ${JSON.stringify(sc.steer)}, ${!!sc.crowd}).then(() => 0)`);
    await page.send('Emulation.setCPUThrottlingRate', { rate: o.cpu });
    const at = () => page.evaluate('[tetherbore.game.drill.x, tetherbore.game.drill.y]'), from = await at();
    const { value: t, events } = await traced(browser, GC_CATEGORIES, () => page.evaluate(call));
    const to = await at();
    await page.send('HeapProfiler.enable');
    await page.send('HeapProfiler.startSampling', { samplingInterval: 1024, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
    await page.evaluate(call);
    const { profile } = await page.send('HeapProfiler.stopSampling');
    await page.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    if (page.problems.length) throw new Error(`the page threw: ${page.problems.join('; ')}`);
    const up = [], rn = [], made = [];
    for (let i = 0; i < t.length; i += 3) { up.push(t[i]); rn.push(t[i + 1]); made.push(t[i + 2]); }
    const u = stats(up), r = stats(rn), gc = gcOf(events), heap = heapOf(profile), k = `${scene} `;
    const m = {
      [`${k}update mean ms`]: u.mean, [`${k}update p95 ms`]: u.p95, [`${k}update max ms`]: u.max,
      [`${k}render mean ms`]: r.mean, [`${k}render p95 ms`]: r.p95, [`${k}render max ms`]: r.max,
      [`${k}frames over 16.7 ms`]: up.filter((x, i) => x + rn[i] > 16.7).length,
      [`${k}heap KB/frame`]: heap.all / n / 1024, [`${k}heap render KB/frame`]: heap.render / n / 1024, [`${k}heap update KB/frame`]: heap.update / n / 1024,
      [`${k}minor GC /1000 frames`]: gc.minor * 1000 / n, [`${k}major GC /1000 frames`]: gc.major * 1000 / n, [`${k}GC ms/frame`]: (gc.minorMs + gc.majorMs) / n,
    };
    if (scene === 'fly') { m[`${k}pieces made/frame`] = made.reduce((a, b) => a + b, 0) / n; m[`${k}cells flown/frame`] = Math.hypot(to[0] - from[0], to[1] - from[1]) / n; }
    return { metrics: m, made };
  }));
}

// ---------------------------------------------------------------- step
async function stepRun(root, o) {
  return withSite(root.dir, { coi: true }, site => withBrowser({ program: o.program, size: [360, 640], extra: ['--autoplay-policy=no-user-gesture-required'] }, async browser => {
    const page = await browser.page();
    await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 2, mobile: true });
    await page.send('Page.navigate', { url: `${site.origin}/index.html?debug` });
    await page.until('!!window.tetherbore', 'the game');
    if (!await page.evaluate('self.crossOriginIsolated')) throw new Error('the page is not cross-origin isolated');
    // The pilot, set up in the page: a fresh game of its own, the page's own loop stopped.
    await page.evaluate(`(async () => {
      window.tetherbore.advance(0);
      const { Game } = await import('/js/game.js');
      const world = await import('/js/world.js'), audio = await import('/js/audio.js');
      { const AC = window.AudioContext; window.AudioContext = class extends AC { constructor(...a) { super(...a); window.__ctx = this; } }; }
      audio.unlock();
      const random = s0 => { let s = (s0 * 2654435761) >>> 0; return () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296; };
      function* wander(rnd, turns, heading = 0) { for (let turn = 0; turn < turns; turn++) { heading += (rnd() - 0.5) * 2.5; const hold = 10 + Math.floor(rnd() * 50), pause = rnd() < 0.1; for (let f = 0; f < hold; f++) yield pause ? null : [Math.cos(heading), Math.sin(heading), 1]; } }
      window.P = { Game, world, random, wander };
    })()`);
    await sleep(500);
    if (o.cpu > 1) await page.send('Emulation.setCPUThrottlingRate', { rate: o.cpu });
    const { value: out, events } = await traced(browser, GC_CATEGORIES, () => page.evaluate(`(async () => {
      const { Game, random, wander } = P;
      const seed = ${o.seed}, turns = ${o.turns}, crowd = ${!!o.fauna};
      Math.random = random(seed + 5);
      const game = new Game(document.createElement('canvas'), null);
      game.fresh(seed, true); game.resize(360, 640, 2);
      Object.assign(game.S.lv, { tether: 5, drill: 4 });
      const hit = game.hit.bind(game); game.hit = t => { const l = hit(t); game.dents = 0; return l; };
      if (!crowd) game.fauna.off = true;
      const KINDS = ['bat', 'moth', 'bee', 'leech', 'spitter', 'puff', 'skink', 'frog', 'beetle', 'jelly', 'salamander', 'wren', 'newt', 'pup', 'rimeling', 'emberling', 'mireling', 'lodeling'];
      const times = [], rub = []; let frames = 0, rubble = 0;
      const hauls = game.updateHauls; game.updateHauls = dt => { const t = performance.now(); hauls.call(game, dt); rubble = performance.now() - t; };
      for (const auto of wander(random(seed), turns)) {
        game.input.auto = auto;
        if (crowd && frames % 20 === 0 && game.fauna.alive < 16) game.fauna.stage(game, KINDS[(frames / 20) % KINDS.length], 8);
        rubble = 0; game.probe = {};
        const t = performance.now(); game.update(1 / 60); times.push(performance.now() - t); rub.push(rubble); frames++;
      }
      return { times, rub, made: game.world.made };
    })()`));
    await page.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    if (page.problems.length) throw new Error(`the page threw: ${page.problems.join('; ')}`);
    const s = stats(out.times), gc = gcOf(events), n = out.times.length;
    return {
      'update mean ms': s.mean, 'update p99 ms': s.p99, 'update p999 ms': s.p999, 'update max ms': s.max,
      'rubble mean ms': out.rub.reduce((a, b) => a + b, 0) / n,
      'frames over 8 ms': out.times.filter(x => x > 8).length, 'frames over 16 ms': out.times.filter(x => x > 16).length,
      'minor GCs': gc.minor, 'minor GC total ms': gc.minorMs, 'minor GC max ms': gc.minorMax,
      'major GCs': gc.major, 'major GC total ms': gc.majorMs, 'major GC max ms': gc.majorMax,
      'frames': n, 'pieces made': out.made,
    };
  }));
}

// ---------------------------------------------------------------- alloc
function child(root, mode, o) {
  const script = path.join(REPO, 'tools', 'bench', 'alloc-child.mjs');
  const flags = mode === 'bytes' ? ['--max-semi-space-size=512', '--min-semi-space-size=512'] : [];
  const extra = ['--seed', String(o.seed), '--turns', String(o.turns), ...(o.fauna ? ['--fauna'] : []), ...(o.rows === 'plain' ? ['--rows', 'plain'] : [])];
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [...flags, script, root.dir, mode, ...extra], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', c => { out += c; }); p.stderr.on('data', c => { err += c; });
    p.on('close', code => { if (code) reject(new Error(`alloc in ${root.dir} (${mode}) failed:\n${err}`)); else { try { resolve(JSON.parse(out.trim().split('\n').pop())); } catch (e) { reject(new Error(`alloc in ${root.dir} said: ${out}\n${err}`)); } } });
  });
}

// ---------------------------------------------------------------- shots
// Each: [name, tools/shot.mjs's arguments] or [name, arguments, a line of the page's code run once the frames are
// stepped, after which 30 frames more are] for a panel tools/shot.mjs cannot open. The sizes are the set's unless
// --size names others. (GEOLOGY HAPPENED! and TWIN STONES! as h-call-clear stages them cannot be asked of the
// staging, and are not here.)
const SHOTS = {
  text: { sizes: ['180x320', '360x640'], shots: [
    ['lab-all', '--lab all --lv max --frames 4'],
    ['lab-sel', '--lab 20 --labsel seracB --frames 4'],
    ['shop-rig', '--shop rig --lv max --frames 8'],
    ['shop-works', '--shop works --lv max --frames 8'],
    ['shop-map', '--shop map --lv max --frames 8'],
    ['shop-core', '--shop core --lv max --frames 8'],
    ['lab-ru', '--lab all --lv max --lang ru --frames 4'],
    ['shop-zh', '--shop works --lv max --lang zh --frames 8'],
    ['banner-20', '--at 200,200 --pocket --haul 9 --lv max --frames 20'],
    ['banner-40', '--at 200,200 --pocket --haul 9 --lv max --frames 40'],
    ['banner-60', '--at 200,200 --pocket --haul 9 --lv max --frames 60'],
  ] },
  hud: { sizes: ['180x320', '360x640'], shots: [
    ['core-max', '--lv max --frames 120'],
    ['mender-10', '--lv max --fire mender --frames 10'],
    ['mender-20', '--lv max --fire mender --frames 20'],
    ['mender-40', '--lv max --fire mender --frames 40'],
    ['knock-arc', '--at 0,-300 --lv max --fire arccoil --frames 8'],
    ['knock-wreck', '--at 0,-300 --lv max --fire blackbox --frames 6'],
  ] },
  map: { sizes: ['360x640'], shots: [
    ['core', '--lv max --met --frames 60'],
    ['far', '--at 0,-900 --lv max --met --frames 60'],
    ['dig', '--at 300,-500 --lv max --met --frames 60'],
    ['chart', '--at 0,-400 --lv max --met --frames 180', "game.openLab(true, 'chart')"],
  ] },
  haul: { sizes: ['360x640'], shots: [20, 30, 40, 50, 60].map(f => [`haul-${f}`, `--at 200,200 --pocket --haul 9 --lv max --frames ${f}`]) },
  world: { sizes: ['360x640'], shots: [
    ['steer', '--at 0,-300 --lv max --steer 1,0.3 --met --frames 40'],
    ['cave', '--at -316,131 --cave --met --frames 120'],
    ['far-n', '--at 0,-1500 --met --frames 60'],
    ['far-e', '--at 1500,0 --met --frames 60'],
    ['far-s', '--at 0,1500 --met --frames 60'],
    ['far-w', '--at -1500,0 --met --frames 60'],
  ] },
  panels: { sizes: ['180x320', '360x640'], shots: [
    ['menu', '--lv max --met --frames 60', "game.openLab(true, 'menu')"],
    ['stats', '--lv max --met --frames 60', "game.openLab(true, 'stats')"],
  ] },
};
// tools/shot.mjs's arguments as it turns them into the staging's query (and the frames it steps).
const SHOT_BOOLEANS = ['lit', 'met', 'key', 'pocket', 'cave', 'ladder', 'orebook', 'faunabook', 'bossbook'];
function shotQuery(args) {
  const o = { seed: '7', at: '0,0', zoom: '1', frames: '180' };
  const list = args.split(' ');
  for (let i = 0; i < list.length; i++) { const name = list[i].slice(2); o[name] = SHOT_BOOLEANS.includes(name) ? '1' : list[++i]; }
  const q = new URLSearchParams({ shot: '1', seed: o.seed, at: o.at, zoom: o.zoom });
  if (o.reach) q.set('reach', o.reach);
  for (const name of ['lit', 'met']) if (o[name]) q.set(name, '1');
  if (o.wake) q.set('wake', o.wake);
  for (const name of ['key', 'pocket', 'cave']) if (o[name]) q.set(name, '1');
  if (o.haul) q.set('haul', o.haul);
  if (o.feel) q.set('feel', o.feel);
  for (const name of ['lv', 'grit', 'shop', 'buy', 'steer', 'fire', 'lab', 'labsel', 'scroll']) if (o[name]) q.set(name, o[name]);
  for (const name of ['ladder', 'orebook']) if (o[name]) q.set(name, '1');
  if (o.fauna) q.set('fauna', o.fauna);
  for (const name of ['faunabook', 'bossbook']) if (o[name]) q.set(name, '1');
  if (o.lang) q.set('lang', o.lang);
  return { query: q.toString(), frames: Number(o.frames) };
}
// Math.random seeded before any script of the page: the motes, sparks and dust fall the same in every picture.
const SEEDED = `(() => { let s = 0x2545f491; Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;
// A picture as tools/shot.mjs takes it (the page the size asked, DPR 1, not mobile; staged by the root's js/shot.js
// from the same query; stepped by hand; the page's screenshot), but with Math.random seeded, which tools/shot.mjs
// leaves alone, so that two pictures of the same code agree.
async function shoot(root, [, args, js], sizeText, out, program) {
  const size = sizeText.split('x').map(Number), { query, frames } = shotQuery(args);
  return withSite(root.dir, {}, site => withBrowser({ program, size }, async browser => {
    const page = await browser.page();
    await page.send('Emulation.setDeviceMetricsOverride', { width: size[0], height: size[1], deviceScaleFactor: 1, mobile: false });
    await page.send('Page.bringToFront');
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: SEEDED });
    await page.send('Page.navigate', { url: `${site.origin}/index.html?${query}` });
    await page.until('!!(window.tetherbore && window.tetherbore.shot)', 'the staging');
    await page.evaluate(`tetherbore.advance(${frames ? (frames - 0.5) * 1000 / 60 : 0})`);
    if (js) await page.evaluate(`(() => { const game = tetherbore.game; ${js}; tetherbore.advance(${(30 - 0.5) * 1000 / 60}); })()`);
    const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
    if (page.problems.length) throw new Error(`the page threw: ${page.problems.join('; ')}`);
    writeFileSync(out, Buffer.from(data, 'base64'));
  }));
}
function compare(a1, a2, b, diffOut) {
  const A = decodePNG(readFileSync(a1)), A2 = decodePNG(readFileSync(a2)), B = decodePNG(readFileSync(b));
  if (A.width !== B.width || A.height !== B.height || A.width !== A2.width || A.height !== A2.height) return { error: `sizes differ: A ${A.width}x${A.height}, A again ${A2.width}x${A2.height}, B ${B.width}x${B.height}` };
  const n = A.width * A.height, d = Buffer.alloc(n * 4);
  let noise = 0, differ = 0;
  const same = (P, Q, i) => P.data[i] === Q.data[i] && P.data[i + 1] === Q.data[i + 1] && P.data[i + 2] === Q.data[i + 2] && P.data[i + 3] === Q.data[i + 3];
  for (let p = 0; p < n; p++) {
    const i = p * 4, masked = !same(A, A2, i);
    d[i + 3] = 255;
    if (masked) { noise++; d[i] = 255; d[i + 1] = 220; }
    else if (!same(A, B, i)) { differ++; d[i] = 255; }
    else { const g = (A.data[i] + A.data[i + 1] + A.data[i + 2]) / 12; d[i] = d[i + 1] = d[i + 2] = g; }
  }
  if (noise || differ) writeFileSync(diffOut, encodePNG(A.width, A.height, d));
  return { noise, differ, pixels: n };
}
async function pool(jobs, most) {
  const results = new Array(jobs.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(most, jobs.length) }, async () => { while (next < jobs.length) { const i = next++; results[i] = await jobs[i](); } }));
  return results;
}

// ---------------------------------------------------------------- the run
const started = Date.now(), busy0 = cpuTimes();
async function header(roots, extra) {
  const program = await findBrowser(opt.browser);
  if (!program && extra.browser !== false) { console.error('No Chromium-based browser (Edge or Chrome) was found. Name one with --browser.'); process.exit(3); }
  console.log(`tools/bench.mjs ${argv.join(' ')}`);
  for (const r of roots) console.log(`${r.side}: ${r.label}`);
  if (extra.browser !== false) console.log(`browser: ${program}`);
  if (extra.cpu) console.log(`CPU throttling: ${extra.cpu}x`);
  console.log(`machine: ${await machine()}`);
  if (extra.rounds) console.log(`rounds: ${rounds}, A and B interleaved (AB, BA, ...)`);
  console.log('');
  return program;
}
const raw = { command, argv, rounds: [], started: new Date().toISOString() };
const keep = async () => { if (opt.out) { raw.busy = busySince(busy0); raw.seconds = (Date.now() - started) / 1000; writeFileSync(opt.out, JSON.stringify(raw, null, 1)); console.log(`\nraw values: ${path.resolve(opt.out)}`); } };
// A and B over the rounds, the order flipped every other round; `run(root)` gives { name: value }.
async function interleaved(A, B, run, what = '') {
  const runs = { A: [], B: [] };
  for (let r = 0; r < rounds; r++) {
    for (const root of r % 2 ? [B, A] : [A, B]) {
      const t = Date.now();
      const v = await run(root);
      const m = v.metrics ?? v;
      runs[root.side].push(m);
      raw.rounds.push({ round: r, side: root.side, what, ...v });
      process.stderr.write(`  round ${r + 1}/${rounds} ${root.side}${what ? ` ${what}` : ''}: ${((Date.now() - t) / 1000).toFixed(0)} s\n`);
    }
  }
  return runs;
}

async function main() {
  if (command === 'mksave') {
    const [name, out] = positional;
    if (!(name in SYNTH) || !out) wrong(`mksave makes ${Object.keys(SYNTH).join(', ')}: node tools/bench.mjs mksave <name> <out.json.gz>`);
    mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    const t = Date.now(), r = await synth(REPO, name, path.resolve(out));
    console.log(`${name}: ${r.pieces} pieces saved (${r.made} made) in ${((Date.now() - t) / 1000).toFixed(0)} s: ${path.resolve(out)}`);
    return 0;
  }
  const A = await rootOf(opt.a ?? 'HEAD', 'A'), B = await rootOf(opt.b ?? '.', 'B');
  raw.a = A; raw.b = B;
  if (command === 'load') {
    const o = { net: oneOf('net', ['none', '4g', '3g'], 'none'), cpu: Number(oneOf('cpu', ['1', '4', '6'], '4')), cache: oneOf('cache', ['cold', 'warm', 'reval'], 'cold'), lang: oneOf('lang', ['en', 'ru', 'zh'], 'en') };
    o.program = await header([A, B], { cpu: o.cpu, rounds: true });
    console.log(`first load: net ${o.net}, cache ${o.cache}, language ${o.lang}, 360x640 at DPR 3, HTTP/2 over TLS as Pages serves it\n`);
    summary(await interleaved(A, B, root => loadRun(root, o)));
  } else if (command === 'save') {
    if (!opt.save) wrong('save needs --save <fixture.json.gz | name>.');
    const o = { save: fixture(opt.save), cpu: Number(oneOf('cpu', ['1', '4', '6'], '6')) };
    o.program = await header([A, B], { cpu: o.cpu, rounds: true });
    console.log(`a saved game's boot: ${o.save}, 360x640 at DPR 3\n`);
    summary(await interleaved(A, B, root => saveRun(root, o)));
  } else if (command === 'frame') {
    const scenes = String(opt.scene ?? 'core').split(',');
    for (const s of scenes) if (!SCENES[s]) wrong(`--scene is a list of ${Object.keys(SCENES).join(', ')}, not ${s}.`);
    const size = String(opt.size ?? '360x640').split('x').map(Number);
    const o = { cpu: Number(oneOf('cpu', ['1', '2', '4', '6'], '4')), frames: Number(opt.frames ?? 300), dpr: Number(opt.dpr ?? 3), size };
    if (!(o.frames > 0) || !(o.dpr > 0) || size.length !== 2 || !size.every(x => x >= 120)) wrong('--frames, --dpr and --size (WxH) are numbers.');
    o.program = await header([A, B], { cpu: o.cpu, rounds: true });
    console.log(`staged scenes ${scenes.join(', ')}: ${size.join('x')} at DPR ${o.dpr}, 180 frames staged, 120 warm, then ${o.frames} timed and ${o.frames} under the heap profiler\n`);
    const runs = { A: [], B: [] }, made = { A: {}, B: {} };
    for (let r = 0; r < rounds; r++) for (const scene of scenes) for (const root of r % 2 ? [B, A] : [A, B]) {
      const t = Date.now(), v = await frameRun(root, o, scene);
      (runs[root.side][r] ??= {}); Object.assign(runs[root.side][r], v.metrics);
      if (scene === 'fly') for (const m of v.made) made[root.side][m] = (made[root.side][m] ?? 0) + 1;
      raw.rounds.push({ round: r, side: root.side, scene, metrics: v.metrics, made: v.made });
      process.stderr.write(`  round ${r + 1}/${rounds} ${scene} ${root.side}: ${((Date.now() - t) / 1000).toFixed(0)} s\n`);
    }
    summary(runs);
    if (scenes.includes('fly')) {
      console.log('\nfly: pieces of world made in a timed frame -> frames (all rounds)');
      const ks = [...new Set([...Object.keys(made.A), ...Object.keys(made.B)].map(Number))].sort((p, q) => p - q);
      table(ks.map(k => [k, made.A[k] ?? 0, made.B[k] ?? 0]), ['pieces', 'A frames', 'B frames']);
    }
  } else if (command === 'step') {
    const o = { cpu: Number(oneOf('cpu', ['1', '4', '6'], '4')), fauna: !!opt.fauna, seed: Number(opt.seed ?? 11), turns: Number(opt.turns ?? 600) };
    o.program = await header([A, B], { cpu: o.cpu, rounds: true });
    console.log(`the step: frame-time's flight, seed ${o.seed}, ${o.turns} turns${o.fauna ? ', with the creatures' : ''}, cross-origin isolated\n`);
    summary(await interleaved(A, B, root => stepRun(root, o)));
  } else if (command === 'alloc') {
    const part = oneOf('part', ['render', 'update', 'both'], 'both');
    const o = { fauna: !!opt.fauna, rows: oneOf('rows', ['max', 'plain'], 'max'), seed: Number(opt.seed ?? 11), turns: Number(opt.turns ?? 600) };
    await header([A, B], { browser: false });
    console.log(`allocation and canvas calls a frame, no browser: frame-time's flight, seed ${o.seed}, ${o.turns} turns, rows ${o.rows === 'max' ? 'every one at its last' : 'as bought (tether 5, bit 4)'}${o.fauna ? ', with the creatures and the lords' : ''}, 360x640 (180x320)\n`);
    const [ab, bb, ac, bc] = await Promise.all([child(A, 'bytes', o), child(B, 'bytes', o), child(A, 'count', o), child(B, 'count', o)]);
    raw.A = { bytes: ab, count: ac }; raw.B = { bytes: bb, count: bc };
    const rows = [];
    const row = (name, a, b) => rows.push([name, fmt(a), fmt(b), signed(b - a) + (a ? ` (${b - a >= 0 ? '+' : ''}${(100 * (b - a) / a).toFixed(1)}%)` : '')]);
    for (const p of part === 'both' ? ['render', 'update'] : [part]) for (const s of ['mean', 'p50', 'p95', 'max']) row(`${p} KB/frame ${s}`, ab[p][s] / 1024, bb[p][s] / 1024);
    console.log(`frames: A ${ab.frames}, B ${bb.frames} (${ab.render.counted} and ${bb.render.counted} counted: a frame in which a GC shrank the heap is not)\n`);
    table(rows, ['bytes', 'A', 'B', 'B-A']);
    const keys = [...new Set([...Object.keys(ac.totals), ...Object.keys(bc.totals)])].filter(k => !/\.update\./.test(k));
    const order = k => -(ac.totals[k] ?? bc.totals[k] ?? 0);
    const calls = keys.filter(k => /^(game|over|off)\.(drawImage|fillRect|clearRect|set\.(fillStyle|globalAlpha)|same\.(fillStyle|globalAlpha))/.test(k) || (ac.totals[k] ?? 0) !== (bc.totals[k] ?? 0));
    console.log('\ncanvas calls a frame (all contexts; drawImage.<source>; set.<state> and same.<state>, the sets that set what was there)');
    const crow = [];
    for (const k of calls.sort((p, q) => order(p) - order(q))) { const a = ac.totals[k] ?? 0, b = bc.totals[k] ?? 0; crow.push([k, a.toFixed(1), b.toFixed(1), (b - a > 0 ? '+' : '') + (b - a).toFixed(1)]); }
    table(crow, ['calls/frame', 'A', 'B', 'B-A']);
    const parts = [...new Set([...Object.keys(ac.per), ...Object.keys(bc.per)])];
    const tot = (c, p) => Object.entries(c.per[p] ?? {}).filter(([k]) => /^[a-z]+\.[a-zA-Z]+$/.test(k) || /^[a-z]+\.set\./.test(k)).reduce((s, [, v]) => s + v, 0);
    console.log('\ncalls and state sets a frame by part of the drawing');
    table(parts.map(p => [p, tot(ac, p).toFixed(1), tot(bc, p).toFixed(1), (tot(bc, p) - tot(ac, p) > 0 ? '+' : '') + (tot(bc, p) - tot(ac, p)).toFixed(1)]).sort((p, q) => q[1] - p[1]), ['part', 'A', 'B', 'B-A']);
  } else if (command === 'shots') {
    const sets = String(opt.set ?? 'all').split(',').flatMap(s => s === 'all' ? Object.keys(SHOTS) : [s]);
    for (const s of sets) if (!SHOTS[s]) wrong(`--set is a list of all, ${Object.keys(SHOTS).join(', ')}, not ${s}.`);
    const sizes = opt.size ? String(opt.size).split(',') : null;
    if (sizes) for (const s of sizes) if (!/^\d+x\d+$/.test(s)) wrong(`--size is a list of WxH, not ${s}.`);
    const program = await header([A, B], {});
    const px = path.join(DIR, 'px'), shots = path.join(px, 'shots');
    mkdirSync(shots, { recursive: true });
    const list = [];
    for (const set of [...new Set(sets)]) for (const s of SHOTS[set].shots) for (const size of sizes ?? SHOTS[set].sizes) list.push({ id: `${set}-${s[0]}-${size}`, s, size });
    console.log(`${list.length} shots, A twice and B once: ${shots}\n`);
    const jobs = [];
    for (const shot of list) for (const [root, tag] of [[A, 'a1'], [A, 'a2'], [B, 'b']]) jobs.push(() => shoot(root, shot.s, shot.size, path.join(shots, `${shot.id}.${tag}.png`), program).then(() => null, e => e.message));
    const failed = (await pool(jobs, Math.max(2, Math.min(6, os.cpus().length >> 2)))).filter(Boolean);
    if (failed.length) throw new Error(`${failed.length} shot${failed.length === 1 ? '' : 's'} failed:\n${failed.join('\n')}`);
    const rows = []; let total = 0, noisy = 0;
    for (const shot of list) {
      const f = tag => path.join(shots, `${shot.id}.${tag}.png`), c = compare(f('a1'), f('a2'), f('b'), path.join(px, `${shot.id}.diff.png`));
      raw.rounds.push({ shot: shot.id, ...c });
      if (c.error) { rows.push([shot.id, '-', 'ERROR', c.error]); total += 1; continue; }
      total += c.differ; if (c.noise) noisy++;
      rows.push([shot.id, c.noise, c.differ, c.differ ? `${path.join(px, `${shot.id}.diff.png`)}` : c.noise ? 'A-A noise: proves less' : '']);
    }
    table(rows, ['shot', 'A-A noise', 'B differs', '']);
    console.log(`\n${total} pixel${total === 1 ? '' : 's'} of B differ from A outside the noise, over ${list.length} shots${noisy ? `; ${noisy} shot${noisy === 1 ? '' : 's'} had A-A noise` : ''}.`);
    await keep();
    return total ? 1 : 0;
  }
  console.log(`\nmachine ${busySince(busy0)}% busy over the run's ${((Date.now() - started) / 1000).toFixed(0)} s (the benchmark's own browser among it)`);
  await keep();
  return 0;
}

let code = 1;
try { code = await main(); } catch (error) { console.error(`\nFailed: ${error.stack ?? error.message}`); code = 1; } finally { await closeAll(); }
process.exit(code);
