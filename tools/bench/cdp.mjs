// The browser for tools/bench.mjs: found as tools/shot.mjs finds it, started headless on a profile of its own,
// driven over the DevTools protocol with Node's own WebSocket, and closed with its profile removed whatever happens.
//   const browser = await launch({ program, size: [360, 640], extra: ['--autoplay-policy=no-user-gesture-required'] });
//   const page = await browser.page();          // a new tab: page.send(method, params), page.evaluate(expression)
//   await browser.close();                      // and the profile is gone, unless `keep` was asked for
// A profile may be handed in (`profile`) to start the browser again on what an earlier visit left in it (the HTTP
// cache, V8's code cache, the saved game); then it is the caller's to remove (`removeProfile`).
import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Edge first on Windows, where it is always present; Chrome first elsewhere (as tools/shot.mjs).
export async function findBrowser(given) {
  if (given) return given;
  const programs = base => [path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe')];
  const installed = {
    win32: [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter(Boolean).flatMap(programs).sort((a, b) => b.includes('Edge') - a.includes('Edge')),
    darwin: ['Google Chrome', 'Microsoft Edge', 'Chromium'].map(name => `/Applications/${name}.app/Contents/MacOS/${name}`),
    linux: ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'].flatMap(name => ['/usr/bin', '/usr/local/bin', '/snap/bin'].map(folder => `${folder}/${name}`)),
  }[process.platform] ?? [];
  for (const candidate of installed) if (await access(candidate).then(() => true, () => false)) return candidate;
  return null;
}

// (Not `maxRetries`: it tries again at every level of the tree, and one held file then takes minutes.)
export async function removeProfile(folder, most = 80) {
  for (let tries = 0; tries < most; tries++) {
    if (await rm(folder, { recursive: true, force: true }).then(() => true, () => false)) return true;
    await sleep(250);
  }
  return false;
}

export const newProfile = () => mkdtemp(path.join(os.tmpdir(), 'tb-bench-'));

export async function launch({ program, size = [360, 640], extra = [], profile = null }) {
  const own = !profile;
  profile ??= await newProfile();
  await rm(path.join(profile, 'DevToolsActivePort'), { force: true });
  const child = spawn(program, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-networking', '--disable-component-update', '--disable-sync', '--mute-audio', '--hide-scrollbars', `--window-size=${size[0]},${size[1]}`, ...extra, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let complaints = '', unstarted = null;
  child.stderr.on('data', chunk => { complaints = (complaints + chunk).slice(-4000); }); child.once('error', error => { unstarted = error; });
  let endpoint = null;
  for (const start = Date.now(); !endpoint && Date.now() - start < 60000; await sleep(100)) {
    if (unstarted) throw new Error(`the browser (${program}) could not be started: ${unstarted.message}`);
    const [port, address] = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8').catch(() => '')).split('\n');
    if (address) endpoint = `ws://127.0.0.1:${port}${address}`;
  }
  if (!endpoint) { child.kill(); throw new Error(`the browser did not open its DevTools port within a minute:\n${complaints.trim()}`); }
  const socket = new WebSocket(endpoint), pending = new Map(), listeners = new Set();
  let sequence = 0, lost = null;
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', () => reject(new Error('could not connect to the browser'))); });
  const disconnected = why => {
    if (lost) return;
    lost = new Error(`the browser closed its DevTools connection (${why})`);
    for (const waiting of pending.values()) waiting.reject(lost);
    pending.clear();
  };
  socket.addEventListener('close', event => disconnected(`close code ${event.code}`));
  socket.addEventListener('error', event => disconnected(event.message || 'socket error'));
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id) { for (const listen of listeners) listen(message); return; }
    const waiting = pending.get(message.id); if (!waiting) return;
    pending.delete(message.id);
    if (message.error) waiting.reject(new Error(`${waiting.method}: ${message.error.message}`)); else waiting.resolve(message.result);
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    if (lost) { reject(lost); return; }
    const id = ++sequence; pending.set(id, { resolve, reject, method });
    try { socket.send(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) })); } catch (error) { pending.delete(id); reject(error); }
  });
  const pids = new Set();
  const processes = async () => { for (const p of (await send('SystemInfo.getProcessInfo').catch(() => ({ processInfo: [] }))).processInfo) pids.add(p.id); };
  await processes();
  // A tab: its own session, what it threw kept (`problems`), its events handed to `on`.
  const page = async (url = 'about:blank') => {
    const { targetId } = await send('Target.createTarget', { url }), { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const problems = [], own = new Set();
    const listen = message => {
      if (message.sessionId !== sessionId) return;
      if (message.method === 'Runtime.exceptionThrown') problems.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
      for (const l of own) l(message);
    };
    listeners.add(listen);
    const p = {
      sessionId, targetId, problems,
      send: (method, params) => send(method, params, sessionId),
      on: l => { own.add(l); return () => own.delete(l); },
      async evaluate(expression) {
        const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
        if (exceptionDetails) throw new Error(`the page threw: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
        return result.value;
      },
      // Until the expression is true in the page (an exception in the page meanwhile, or a minute, is an error).
      async until(expression, what, most = 60000) {
        for (const start = Date.now(); !await p.evaluate(expression).catch(() => false); await sleep(50)) {
          if (Date.now() - start > most) throw new Error(`${what} did not happen in ${most / 1000} s${problems.length ? `: ${problems.join('; ')}` : ''}`);
        }
      },
      async close() { listeners.delete(listen); await send('Target.closeTarget', { targetId }).catch(() => {}); },
    };
    await p.send('Page.enable'); await p.send('Runtime.enable');
    await processes();
    return p;
  };
  // Browser-wide events (Tracing's) go to these.
  const on = l => { listeners.add(l); return () => listeners.delete(l); };
  let closing = null;
  const close = () => closing ??= (async () => {
    await processes();
    if (!lost) await Promise.race([send('Browser.close').then(() => new Promise(resolve => socket.addEventListener('close', resolve))), sleep(5000)]).catch(() => {});
    child.kill();
    if (own && !await removeProfile(profile, 12)) {
      for (const pid of pids) { try { process.kill(pid); } catch { /* already gone */ } }
      if (!await removeProfile(profile)) console.error(`The browser's profile could not be removed: ${profile}`);
    }
    if (!own) { await sleep(300); for (const pid of pids) { try { process.kill(pid); } catch { /* already gone */ } } }
  })();
  return { send, page, on, close, profile };
}

// A trace's events, collected over the browser's connection.
export async function traced(browser, categories, work) {
  const events = [];
  let complete;
  const finished = new Promise(resolve => { complete = resolve; });
  const off = browser.on(message => {
    if (message.method === 'Tracing.dataCollected') for (const e of message.params.value) events.push(e);
    else if (message.method === 'Tracing.tracingComplete') complete();
  });
  await browser.send('Tracing.start', { traceConfig: { includedCategories: categories, recordMode: 'recordAsMuchAsPossible' }, transferMode: 'ReportEvents' });
  let value;
  try { value = await work(); } finally { await browser.send('Tracing.end'); await finished; off(); }
  return { value, events };
}
