// What the game tells Steam: the achievements it has earned, by the API names of desktop/achievements.json. The page
// asks through desktop/preload.cjs; only the game's own page is heard, and only names on the list are passed on.
// Steam may be absent, or not running, or the app may be Valve's test app, whose achievements are not the game's: then
// nothing is set, and the game goes on (what it has earned is in its save, and is told again next time it starts).
const fs = require('node:fs');
const path = require('node:path');

const TEST_APP = 480, PAGE = 'tetherbore://game/';
const CHANNELS = { sync: 'tetherbore:achievements-sync', unlock: 'tetherbore:achievements-unlock' };
const knownNames = () => new Set(JSON.parse(fs.readFileSync(path.join(__dirname, 'achievements.json'), 'utf8')).achievements.map(a => a.apiName));

// `client()` gives the steamworks.js client, or null. Each call says what it did, for the tests and the console.
// (A demo reports nothing: Steam's demos do not earn the full game's achievements. What it earned is in its save, and
// the full game tells Steam when it takes that save up.)
function reporter(client, appId, known = knownNames(), { demo = false } = {}) {
  const set = ids => {
    if (demo) return { set: [], skipped: 'demo' };
    const steam = client();
    if (!steam) return { set: [], skipped: 'no steam' };
    if (appId === TEST_APP) return { set: [], skipped: 'test app' };
    const done = [];
    for (const id of ids) {
      if (!known.has(id)) continue;
      try { if (!steam.achievement.isActivated(id) && steam.achievement.activate(id)) done.push(id); } catch { /* the next start tells it again */ }
    }
    if (done.length) { try { steam.stats?.store?.(); } catch { /* Steam stores it at exit */ } }
    return { set: done };
  };
  return { sync: ids => set(Array.isArray(ids) ? ids : []), unlock: id => set([id]) };
}

function attachSteam(ipcMain, client, appId, { demo = false } = {}) {
  let report = null;
  try { report = reporter(client, appId, knownNames(), { demo }); } catch (error) { console.error('achievements list not read:', error.message); }
  const hear = what => (event, arg) => {
    if (!report || !String(event.senderFrame?.url ?? '').startsWith(PAGE)) return { set: [], skipped: 'refused' };
    return report[what](arg);
  };
  ipcMain.handle(CHANNELS.sync, hear('sync'));
  ipcMain.handle(CHANNELS.unlock, hear('unlock'));
}

module.exports = { attachSteam, reporter, CHANNELS, TEST_APP };
