// Tetherbore on the desktop: the same files the web build ships, served to an Electron window from an origin of their
// own (tetherbore://game/), so that modules load and the game's localStorage and IndexedDB stay put between runs.
//   npm start                     play it
//   npm run spike -- --out f.json check the window, storage and Steam, write what was found, and quit
//
// TETHERBORE_STEAM_APP names the Steam app. Until the game has its own App ID it is Valve's test app, 480.
const { app, BrowserWindow, Menu, ipcMain, protocol } = require('electron');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const saveFile = require('./saves.cjs');

app.setName('Tetherbore');
const SPIKE = process.argv.includes('--spike');
// (TETHERBORE_DATA puts everything the game keeps in another folder, for tests. --no-steam leaves Steam alone.)
if (process.env.TETHERBORE_DATA) app.setPath('userData', path.resolve(process.env.TETHERBORE_DATA));
const NO_STEAM = process.argv.includes('--no-steam');
const option = name => { const at = process.argv.indexOf(name); return at < 0 ? null : process.argv[at + 1]; };
const APP_ID = Number(process.env.TETHERBORE_STEAM_APP) || 480;
const ROOT = app.isPackaged ? path.join(process.resourcesPath, 'game') : path.resolve(__dirname, '..');
// What a browser loads (tools/build-dist.mjs, SHIPPED), and so all this origin will serve.
const SHIPPED = new Set(['index.html', 'manifest.webmanifest', 'css', 'js', 'assets', 'media']);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon' };

let steamworks = null, steam = null, steamError = null;
if (!NO_STEAM) try {
  steamworks = require('steamworks.js');
  steamworks.electronEnableSteamOverlay();   // must be before the app is ready
} catch (error) { steamError = String(error.message ?? error); }

protocol.registerSchemesAsPrivileged([{ scheme: 'tetherbore', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
if (SPIKE && !process.env.TETHERBORE_DATA) app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'tetherbore-spike-')));

// How the window was left: fullscreen unless the player has chosen otherwise.
const prefsFile = () => path.join(app.getPath('userData'), 'window.json');
const prefs = () => { try { return { fullscreen: true, ...JSON.parse(fs.readFileSync(prefsFile(), 'utf8')) }; } catch { return { fullscreen: true }; } };
const keepPrefs = value => { try { fs.mkdirSync(path.dirname(prefsFile()), { recursive: true }); fs.writeFileSync(prefsFile(), JSON.stringify(value)); } catch { /* not kept */ } };

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
  if (option('--run')) { await window.webContents.executeJavaScript(option('--run')); await new Promise(done => setTimeout(done, 700)); }
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
  Menu.setApplicationMenu(null);
  if (!NO_STEAM) startSteam();
  const saves = saveFile.open(path.join(app.getPath('userData'), 'saves'));
  const start = SPIKE ? { fullscreen: false } : prefs(), [width, height] = (option('--size') ?? '1280x720').split('x').map(Number);
  const window = new BrowserWindow({
    width, height, minWidth: 960, minHeight: 540, useContentSize: true, fullscreen: start.fullscreen, backgroundColor: '#07060b', title: 'Tetherbore',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  ipcMain.handle('saves:read', () => saves.read());
  ipcMain.handle('saves:write', (_, data) => saves.write(data));
  ipcMain.handle('window:is-fullscreen', () => window.isFullScreen());
  ipcMain.handle('window:toggle-fullscreen', () => window.setFullScreen(!window.isFullScreen()));
  ipcMain.handle('window:quit', () => window.close());
  const told = on => { if (!SPIKE) keepPrefs({ fullscreen: on }); window.webContents.send('window:fullscreen', on); };
  window.on('enter-full-screen', () => told(true));
  window.on('leave-full-screen', () => told(false));
  // F11 and Alt+Enter, as on any Windows game.
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && !input.isAutoRepeat && (input.key === 'F11' || (input.alt && input.key === 'Enter'))) { event.preventDefault(); window.setFullScreen(!window.isFullScreen()); }
  });
  // The game is written to its file before the window goes, for four seconds at the most.
  let flushed = false;
  const shut = () => { if (flushed) return; flushed = true; if (!window.isDestroyed()) window.close(); };
  ipcMain.on('window:flushed', shut);
  window.on('close', event => {
    if (flushed) return;
    event.preventDefault();
    window.webContents.send('window:flush');
    setTimeout(shut, 4000);
  });
  window.webContents.on('console-message', event => { if (event.level === 'error') errors.push(String(event.message).slice(0, 300)); });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (!url.startsWith('tetherbore://game/')) event.preventDefault(); });
  window.loadURL(`tetherbore://game/index.html${option('--page') ?? ''}`);
  if (option('--proof')) window.webContents.once('did-finish-load', () => proof(window, option('--proof')).catch(error => { console.error(error); app.exit(1); }));
  else if (SPIKE) window.webContents.once('did-finish-load', () => spike(window).catch(error => { console.error(error); app.exit(1); }));
});

// For the save test: `set` banks a sum and closes the window as a player would; `get` says what the game loaded.
async function proof(window, what) {
  await new Promise(done => setTimeout(done, 3000));
  if (what === 'set') {
    await window.webContents.executeJavaScript(`(() => { const g = window.tetherbore.game; g.S.grit = 7777; g.save(); })()`);
    await new Promise(done => setTimeout(done, 300));
    window.close();
    return;
  }
  const grit = await window.webContents.executeJavaScript('window.tetherbore.game.S.grit');
  console.log(JSON.stringify({ grit, errors }));
  app.exit(0);
}
app.on('window-all-closed', () => app.quit());
