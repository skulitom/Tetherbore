// Tetherbore on the desktop: the same files the web build ships, served to an Electron window from an origin of their
// own (tetherbore://game/), so that modules load and the game's localStorage and IndexedDB stay put between runs.
//   npm start                     play it
//   npm run spike -- --out f.json check the window, storage and Steam, write what was found, and quit
//
// TETHERBORE_STEAM_APP names the Steam app. Until the game has its own App ID it is Valve's test app, 480.
const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const { attachSteam } = require('./steam.cjs');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SPIKE = process.argv.includes('--spike');
const option = name => { const at = process.argv.indexOf(name); return at < 0 ? null : process.argv[at + 1]; };
const APP_ID = Number(process.env.TETHERBORE_STEAM_APP) || 480;
const ROOT = app.isPackaged ? path.join(process.resourcesPath, 'game') : path.resolve(__dirname, '..');
// What a browser loads (tools/build-dist.mjs, SHIPPED), and so all this origin will serve.
const SHIPPED = new Set(['index.html', 'manifest.webmanifest', 'css', 'js', 'assets', 'media']);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon' };

let steamworks = null, steam = null, steamError = null;
try {
  steamworks = require('steamworks.js');
  steamworks.electronEnableSteamOverlay();   // must be before the app is ready
} catch (error) { steamError = String(error.message ?? error); }

protocol.registerSchemesAsPrivileged([{ scheme: 'tetherbore', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
if (SPIKE) app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'tetherbore-spike-')));

// The file an address names, or null if it is not one of the shipped files.
function fileFor(url) {
  const { pathname } = new URL(url);
  let relative;
  try { relative = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html'; } catch { return null; }
  const file = path.resolve(ROOT, relative), inside = path.relative(ROOT, file);
  if (!inside || inside.startsWith('..') || path.isAbsolute(inside)) return null;
  return SHIPPED.has(inside.split(path.sep)[0]) ? file : null;
}

async function serve(request) {
  const file = fileFor(request.url);
  if (!file) return new Response('not found', { status: 404 });
  try {
    const body = await fs.promises.readFile(file);
    return new Response(body, { headers: { 'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream' } });
  } catch { return new Response('not found', { status: 404 }); }
}

function startSteam() {
  if (!steamworks || steamError) return;
  try { steam = steamworks.init(APP_ID); } catch (error) { steamError = String(error.message ?? error); }
}

// One of Spacewar's (app 480) achievements is set and read back, and taken off again unless the account already had it.
function checkAchievement() {
  if (!steam || APP_ID !== 480) return null;
  const name = 'ACH_WIN_ONE_GAME', had = steam.achievement.isActivated(name);
  const set = steam.achievement.activate(name), read = steam.achievement.isActivated(name);
  const cleared = had ? 'already held, left' : steam.achievement.clear(name) && !steam.achievement.isActivated(name);
  return { set, read, cleared };
}

function overlayLoaded() {
  if (process.platform !== 'win32') return null;
  try {
    const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', `(Get-Process -Id ${process.pid}).Modules | Where-Object ModuleName -like 'GameOverlayRenderer*' | Select-Object -First 1 -ExpandProperty ModuleName`], { encoding: 'utf8', timeout: 20000 });
    return out.trim() || false;
  } catch { return null; }
}

async function spike(window) {
  const found = { electron: process.versions.electron, appId: steam?.utils.getAppId() ?? null, steamError };
  await new Promise(done => setTimeout(done, 5000));
  found.page = await window.webContents.executeJavaScript(`(async () => {
    localStorage.setItem('tetherbore-spike', '1');
    const db = await new Promise(done => { const r = indexedDB.open('tetherbore-spike', 1); r.onsuccess = () => done(true); r.onerror = () => done(false); });
    const c = document.getElementById('game');
    return { origin: location.origin, canvas: c ? [c.width, c.height] : null, storage: localStorage.getItem('tetherbore-spike') === '1', indexedDB: db };
  })()`);
  const image = await window.webContents.capturePage();
  const shot = option('--shot');
  if (shot) fs.writeFileSync(shot, image.toPNG());
  found.painted = !image.isEmpty();
  found.achievement = checkAchievement();
  found.cloud = steam ? { account: steam.cloud.isEnabledForAccount(), app: steam.cloud.isEnabledForApp() } : null;
  found.deck = steam?.utils.isSteamRunningOnSteamDeck() ?? null;
  found.overlayModule = overlayLoaded();
  found.errors = errors;
  const out = JSON.stringify(found, null, 2);
  if (option('--out')) fs.writeFileSync(option('--out'), out);
  console.log(out);
  app.exit(0);
}

const errors = [];
app.whenReady().then(() => {
  protocol.handle('tetherbore', serve);
  startSteam();
  attachSteam(ipcMain, () => steam, APP_ID);
  const window = new BrowserWindow({
    width: 1280, height: 720, useContentSize: true, autoHideMenuBar: true, backgroundColor: '#07060b', title: 'Tetherbore',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
  });
  window.webContents.on('console-message', event => { if (event.level === 'error') errors.push(String(event.message).slice(0, 300)); });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (!url.startsWith('tetherbore://game/')) event.preventDefault(); });
  window.loadURL('tetherbore://game/index.html');
  if (SPIKE) window.webContents.once('did-finish-load', () => spike(window).catch(error => { console.error(error); app.exit(1); }));
});
app.on('window-all-closed', () => app.quit());
