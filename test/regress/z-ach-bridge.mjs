// What the achievements hand on: the Steam bridge, against a stand-in for steamworks.js (no test runs Steam), the
// file for Steamworks, the icons, and the words in each language on the narrowest screen.
//   node test/regress/z-ach-bridge.mjs
// Held here:
//   - desktop/steam.cjs sets what is earned once, passes on no name off the list, sets nothing on Valve's test app or
//     with no Steam, survives a client that throws, and hears only the game's own page;
//   - the page's calls reach it through window.tetherboreDesktop, and the game runs with no such thing there;
//   - desktop/achievements.json is what the list and the table of words make, in three languages, and each icon named
//     is a 256 x 256 PNG, a locked one differing from its earned one and grey;
//   - in each language every line has a row, every character a glyph, and each name fits its row and its word on a
//     screen 160 wide, each description in its three lines.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const problems = [], note = text => { if (problems.length < 30) problems.push(text); };
const root = new URL('../../', import.meta.url), self = fileURLToPath(import.meta.url);

// (Run again in a language of its own: the words on the narrowest screen.)
if (process.argv[2] === '--fit') {
  const { makeGame } = await import('../harness.mjs');
  const { ACHIEVEMENTS } = await import('../../js/achievements.js');
  const { fits, tr, lang } = await import('../../js/lang.js');
  const { textWidth, wrap, sheets } = await import('../../js/atlas.js');
  const game = await makeGame(7, {}, { ach: true });
  game.resize(160, 284, 1);
  const { pw } = game.labGeom(), row = pw - 4 * 4 - 14, inner = pw - 4 * 4, toast = game.W - 2 * 4 - 16 - 2 * 4, glyphs = sheets.font.glyphs;
  for (const a of ACHIEVEMENTS) for (const line of [a.name, a.says]) {
    if (!fits(line)) note(`${lang}: no row for ${line}`);
    for (const ch of tr(line)) if (ch !== ' ' && !glyphs[ch]) note(`${lang}: no glyph for ${ch} in ${line}`);
  }
  for (const line of ['ACHIEVEMENT', 'ACHIEVEMENTS', 'A SECRET, UNTIL IT IS EARNED', '+12 FROM YOUR SAVE', 'ACHIEVEMENTS 12/36']) if (!fits(line)) note(`${lang}: no row for ${line}`);
  for (const a of ACHIEVEMENTS) {
    if (textWidth(a.name) > row) note(`${lang}: ${tr(a.name)} is ${textWidth(a.name)} wide in a row of ${row}`);
    if (textWidth(a.name) > toast) note(`${lang}: ${tr(a.name)} is ${textWidth(a.name)} wide in a word of ${toast}`);
    const lines = wrap(a.says, inner - 8);
    if (lines.length > 3) note(`${lang}: ${tr(a.says)} takes ${lines.length} lines`);
    for (const l of lines) if (textWidth(l) > inner - 8) note(`${lang}: a line of ${tr(a.says)} is too wide`);
  }
  // The list and the word, drawn at every page, in the panel the menu opens.
  game.lab = true; game.labTab = 'menu'; game.render();
  game.buttons.find(b => b.y > 0 && b.h === 20 && game.labTab === 'menu' && b.act.toString().includes("'ach'"))?.act();
  if (game.labTab !== 'ach') note(`${lang}: the menu's row did not open the list`);
  for (let n = 0; n < ACHIEVEMENTS.length; n++) { game.ach.sel = n; game.render(); }
  game.key('Escape', true);
  if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
  process.exit(0);
}

const require = createRequire(import.meta.url);
const { attachSteam, reporter, CHANNELS, TEST_APP } = require('../../desktop/steam.cjs');
const manifest = JSON.parse(readFileSync(new URL('desktop/achievements.json', root), 'utf8'));
const names = manifest.achievements.map(a => a.apiName);

// 1. The bridge against a stand-in.
const standIn = (held = []) => {
  const on = new Set(held), calls = [];
  return { on, calls, achievement: { isActivated: id => on.has(id), activate: id => { calls.push(id); on.add(id); return true; } }, stats: { store: () => { calls.push('store'); return true; } } };
};
{
  const steam = standIn([names[1]]), r = reporter(() => steam, 4242);
  const first = r.sync([names[0], names[1], 'ACH_NOT_ON_THE_LIST', 7]);
  if (first.set.join() !== names[0]) note(`sync set ${first.set}`);
  if (steam.calls.includes('ACH_NOT_ON_THE_LIST') || steam.calls.includes(names[1])) note('a name off the list, or one held, was activated');
  if (!steam.calls.includes('store')) note('what was set was not stored');
  steam.calls.length = 0;
  if (r.unlock(names[0]).set.length || steam.calls.length) note('an achievement Steam already holds was set again');
  if (r.unlock(names[2]).set.join() !== names[2]) note('an unlock did not reach Steam');
  const test = standIn(), t = reporter(() => test, TEST_APP);
  if (t.sync(names).set.length || test.calls.length) note("the game's names were set on Valve's test app");
  if (reporter(() => null, 4242).sync(names).skipped !== 'no steam') note('no Steam was not said');
  const bad = { achievement: { isActivated: () => { throw new Error('gone'); }, activate: () => true } };
  try { reporter(() => bad, 4242).sync(names); } catch { note('a client that throws took the bridge down'); }
  if (reporter(() => standIn(), 4242).sync('not a list').set.length) note('a sync of no list set something');
}
{
  const handlers = {}, ipc = { handle: (channel, fn) => { handlers[channel] = fn; } }, steam = standIn();
  attachSteam(ipc, () => steam, 4242);
  const page = { senderFrame: { url: 'tetherbore://game/index.html' } }, other = { senderFrame: { url: 'https://example.test/' } };
  if (handlers[CHANNELS.unlock](other, names[0]).skipped !== 'refused' || steam.on.has(names[0])) note('a page not the game was heard');
  if (handlers[CHANNELS.unlock](page, names[0]).set.join() !== names[0]) note("the game's page was not heard");
  if (handlers[CHANNELS.sync](page, names).set.length !== names.length - 1) note('a sync from the page did not set the rest');
  const preload = readFileSync(new URL('desktop/preload.cjs', root), 'utf8');
  for (const channel of Object.values(CHANNELS)) if (!preload.includes(channel)) note(`the preload does not use ${channel}`);
  if (!/exposeInMainWorld\('tetherboreDesktop'/.test(preload)) note('the preload does not expose tetherboreDesktop');
  const main = readFileSync(new URL('desktop/main.cjs', root), 'utf8');
  if (!/preload: path\.join\(__dirname, 'preload\.cjs'\)/.test(main) || !/attachSteam\(ipcMain/.test(main)) note('main.cjs does not load the bridge');
}

// 2. The file and the icons.
const made = spawnSync(process.execPath, [fileURLToPath(new URL('tools/achievements.mjs', root)), '--check'], { encoding: 'utf8' });
if (made.status !== 0) note(`desktop/achievements.json: ${made.stdout.trim()}`);
const { ACHIEVEMENTS } = await import('../../js/achievements.js');
if (names.join() !== ACHIEVEMENTS.map(a => a.id).join()) note('the file and the list differ');
if (ACHIEVEMENTS.filter(a => a.hidden).length < 3) note('too few are hidden');
// A PNG's width, height and whether its colours are grey (read from its own bytes).
const png = file => {
  const b = readFileSync(new URL(`store/achievements/${file}`, root));
  if (b.readUInt32BE(0) !== 0x89504e47) return null;
  let at = 8, palette = null, depth = 0, type = 0;
  const data = [], w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  while (at < b.length) {
    const len = b.readUInt32BE(at), kind = b.toString('latin1', at + 4, at + 8), body = b.subarray(at + 8, at + 8 + len);
    if (kind === 'IHDR') { depth = body[8]; type = body[9]; } else if (kind === 'PLTE') palette = body; else if (kind === 'IDAT') data.push(body);
    at += 12 + len;
  }
  let grey = true;
  if (palette) for (let p = 0; p + 2 < palette.length; p += 3) { if (Math.abs(palette[p] - palette[p + 1]) > 6 || Math.abs(palette[p + 1] - palette[p + 2]) > 6) grey = false; }
  else { const raw = inflateSync(Buffer.concat(data)), step = type === 6 ? 4 : 3; for (let p = 1; p + 2 < raw.length; p += 97) if (Math.abs(raw[p] - raw[p + 1]) > 40 && depth === 8 && step) grey = grey && false; }
  return { w, h, grey, bytes: b };
};
for (const a of manifest.achievements) {
  for (const lang of ['english', 'russian', 'schinese']) if (!a.name[lang] || !a.description[lang]) note(`${a.apiName} has no ${lang}`);
  if (a.icon !== `${a.apiName}_ACHIEVED.png` || a.iconLocked !== `${a.apiName}_UNACHIEVED.png`) note(`${a.apiName}'s icons are misnamed`);
  let on, off;
  try { on = png(a.icon); off = png(a.iconLocked); } catch (error) { note(`${a.apiName}: ${error.message}`); continue; }
  if (!on || on.w !== 256 || on.h !== 256 || !off || off.w !== 256 || off.h !== 256) { note(`${a.apiName}'s icons are not 256 x 256 PNG`); continue; }
  if (on.bytes.equals(off.bytes)) note(`${a.apiName}'s locked icon is its earned one`);
  if (on.grey) note(`${a.apiName}'s earned icon is grey`);
  if (!off.grey) note(`${a.apiName}'s locked icon is not grey`);
}

// 3. In each language, on the narrowest screen.
for (const id of ['en', 'ru', 'zh']) {
  const run = spawnSync(process.execPath, [self, '--fit'], { encoding: 'utf8', env: { ...process.env, TETHERBORE_LANG: id } });
  if (run.status !== 0) note(`${id}: ${(run.stdout + run.stderr).trim().split('\n').slice(0, 6).join('; ').slice(0, 500)}`);
}

if (problems.length) { console.log(`FAIL z-ach-bridge:\n  ${problems.join('\n  ')}`); process.exit(1); }
console.log(`ok z-ach-bridge: ${names.length} achievements to Steam by a stand-in, with their file, ${names.length * 2} icons, and their words in three languages`);
