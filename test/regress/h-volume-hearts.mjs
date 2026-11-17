// How loud, and the hull's hearts. The menu sets the sounds and the music apart, ten steps each: a tap on a bar
// sets the step under it (just left of its first, nothing), a tap on the name turns it off and back on at the step
// it was at, each is kept on the device, and the music at nothing is its switch off. A game kept muted before there
// were steps comes back with both at nothing and no longer muted. The bar shows the hull as hearts, two knocks to a
// heart: a hull of seven is three hearts and a half, and five of seven left is two and a half lit.
import { spawnSync } from 'node:child_process';
import { makeGame } from '../harness.mjs';
const audio = await import('../../js/audio.js');

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };

// A game kept muted, and one kept with steps, each loaded in a page of its own (audio.js reads them as it loads).
const load = kept => spawnSync(process.execPath, ['--input-type=module', '-e', `
  const kept = new Map(${JSON.stringify(Object.entries(kept))});
  globalThis.localStorage = { getItem: k => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, String(v)) };
  const a = await import(${JSON.stringify(new URL('../../js/audio.js', import.meta.url).href)});
  console.log([a.soundVolume(), a.musicVolume(), a.isMuted(), a.isMusic(), kept.get('tetherbore-mute')].join(' '));`], { encoding: 'utf8' }).stdout.trim();
check(load({}) === '10 10 false true', `a new device has the sounds and music at '${load({})}'`);
check(load({ 'tetherbore-mute': '1' }) === '0 0 false false 0', `a game kept muted loads as '${load({ 'tetherbore-mute': '1' })}'`);
check(load({ 'tetherbore-sound': '4', 'tetherbore-music-step': '7' }) === '4 7 false true', `steps kept load as '${load({ 'tetherbore-sound': '4', 'tetherbore-music-step': '7' })}'`);
check(load({ 'tetherbore-music': '0', 'tetherbore-music-step': '7' }) === '10 0 false false', 'the music switched off does not load at its step');
check(load({ 'tetherbore-sound': 'loud' }).startsWith('10 '), 'a step kept that is not a step was read');

// The menu's rows.
const game = await makeGame(7);
game.resize(320, 568, 1); game.openLab(true, 'menu'); game.render();
const rows = game.buttons.filter(b => b.h === 20 && b.w > 100).sort((a, b) => a.y - b.y), [sound, music] = rows;
const bar = r => r.x + r.w - 8 - 49;          // where a row's bar of steps begins (its right edge 14 in from the panel's)
const tap = (r, x) => { r.act(x, r.y + 10); game.render(); };
tap(sound, bar(sound) + 2);
check(audio.soundVolume() === 1 && localStorage.getItem('tetherbore-sound') === '1', `a tap on the sound's first step set it to ${audio.soundVolume()}`);
tap(sound, bar(sound) + 5 * 4 + 2);
check(audio.soundVolume() === 5, `a tap on its fifth step set it to ${audio.soundVolume()}`);
tap(sound, bar(sound) + 49);
check(audio.soundVolume() === 10, `a tap on its last step set it to ${audio.soundVolume()}`);
tap(sound, bar(sound) - 2);
check(audio.soundVolume() === 0, `a tap just left of its first step set it to ${audio.soundVolume()}`);
tap(sound, bar(sound) + 3 * 5 + 1); tap(sound, sound.x + 10);
check(audio.soundVolume() === 0, `a tap on SOUND at step 4 left it at ${audio.soundVolume()}`);
tap(sound, sound.x + 10);
check(audio.soundVolume() === 4, `a second tap on SOUND brought it back at ${audio.soundVolume()}, not 4`);
tap(music, bar(music) + 6 * 5 + 1);
check(audio.musicVolume() === 7 && audio.isMusic() && localStorage.getItem('tetherbore-music-step') === '7', `a tap on the music's seventh step set it to ${audio.musicVolume()}`);
tap(music, bar(music) - 2);
check(audio.musicVolume() === 0 && !audio.isMusic() && localStorage.getItem('tetherbore-music') === '0', `the music at nothing is ${audio.isMusic() ? 'on' : 'off'}`);
tap(music, music.x + 10);
check(audio.musicVolume() === 7 && audio.isMusic(), `a tap on MUSIC brought it back at ${audio.musicVolume()}, not 7`);
check(audio.soundVolume() === 4, 'the music moved the sounds');
game.openLab(false);

// The hearts: every pixel of them drawn while the bar is, by colour.
const drawn = new Map();
game.ctx.fillRect = (x, y, w, h) => { const c = game.ctx.fillStyle; if (h === 1 && (c === '#ff4d6d' || c === '#3a3450')) drawn.set(c, (drawn.get(c) ?? 0) + w); };
const hearts = (lv, hull) => { game.S.lv.hull = lv; game.dents = game.val("hull") - hull; game.knocked = 0; game.mended = 0; drawn.clear(); game.render(); return [drawn.get('#ff4d6d') ?? 0, drawn.get('#3a3450') ?? 0]; };
// (A left half is sixteen pixels and the middle column; a right half eleven.)
const [lit, dark] = hearts(2, 5);
check(game.val('hull') === 7 && lit === 16 * 3 + 11 * 2 && dark === 16 + 11, `a hull of ${game.val('hull')} with five left drew ${lit} lit and ${dark} dark`);
const [allLit, none] = hearts(1, 6);
check(game.val('hull') === 6 && allLit === 27 * 3 && none === 0, `a whole hull of six drew ${allLit} lit and ${none} dark`);

for (const f of fails) console.log(f);
console.log(fails.length ? `${fails.length} FAILED` : 'the sounds and the music are set apart, kept, and the hull is drawn in hearts');
process.exit(fails.length ? 1 : 0);
