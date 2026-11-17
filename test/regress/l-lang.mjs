// The languages. The game speaks English, Russian or Mandarin (js/lang.js, js/words.js), turned where a line is drawn.
// Run by itself this runs again once in each language (TETHERBORE_LANG), and each run holds:
//   - the table: three columns to a line, no English line twice, none empty;
//   - every character of the Russian and the Mandarin a glyph of the font, so none is drawn as '?';
//   - every name the game's own rows hold turned: the shop's rows (name, what each does, what each level changes,
//     each value and each step from one to the next, the bit's and the winch's names), the shop's and the panel's
//     tabs, what a row needs, the lab's things (name, note, where found, the line and the note said before it is
//     known), every place's title and the banner of a haul there, the giants and the other banners, what is called
//     out when it is seen, the creatures, the menu, and every line of STATS at every level of every row;
//   - a number in a line kept as it was, and a line no key fits drawn as it is;
//   - the language asked for by a link (`?lang=`) chosen and kept, one kept chosen with no link, and English with
//     neither; an unknown one ignored.
// In English nothing is turned and the table is never fetched.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(import.meta.url), asked = process.env.TETHERBORE_LANG;
if (!asked) {
  let failed = 0;
  for (const id of ['en', 'ru', 'zh']) {
    const run = spawnSync(process.execPath, [here], { env: { ...process.env, TETHERBORE_LANG: id }, encoding: 'utf8' });
    process.stdout.write(run.stdout); process.stderr.write(run.stderr);
    if (run.status !== 0) failed++;
  }
  // The choice: by a link, kept, or neither (each in a page of its own, as lang.js chooses once as it loads).
  const choose = (search, kept) => spawnSync(process.execPath, ['--input-type=module', '-e', `
    const kept = new Map(${JSON.stringify(kept ? [['tetherbore-lang', kept]] : [])});
    globalThis.localStorage = { getItem: k => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, v) };
    globalThis.location = { search: ${JSON.stringify(search)}, href: 'https://x.test/' + ${JSON.stringify(search)} };
    const { lang } = await import(${JSON.stringify(new URL('../../js/lang.js', import.meta.url).href)});
    console.log(lang + ' ' + (kept.get('tetherbore-lang') ?? '-'));`], { env: { ...process.env, TETHERBORE_LANG: '' }, encoding: 'utf8' }).stdout.trim();
  const cases = [['', null, 'en -'], ['?lang=ru', null, 'ru ru'], ['?lang=zh', 'ru', 'zh zh'], ['', 'ru', 'ru ru'], ['?lang=en', 'zh', 'en en'], ['?lang=xx', 'ru', 'ru ru'], ['?shot&lang=ru', null, 'ru ru']];
  for (const [search, kept, want] of cases) {
    const got = choose(search, kept);
    if (got !== want) { console.log(`with '${search}' and '${kept}' kept the game spoke and kept '${got}', not '${want}'`); failed++; }
  }
  console.log(failed ? `${failed} FAILED` : 'every language holds');
  process.exit(failed ? 1 : 0);
}

const { lang, tr, fits, LANGS } = await import('../../js/lang.js');
const { WORDS } = await import('../../js/words.js');
const { makeGame } = await import('../harness.mjs');
const { TABS, LAB, NEEDS, CORE } = await import('../../js/shop.js');
const { BIOMES, GEM_PAST } = await import('../../js/world.js');
const { GIANTS, placeHaul, haulTitle, SIZES, QUIPS, GIANT_SAYS, OVER_SAYS } = await import('../../js/game.js');
const { SPOT, GEM_WHERE, GEM_SHORT, LAB_LIST, labCount } = await import('../../js/drawing.js');
const { CREATURES } = await import('../../js/fauna.js');
const { readFileSync } = await import('node:fs');

const fails = [], check = (ok, what) => { if (!ok && fails.length < 40) fails.push(what); };
check(lang === asked, `asked for ${asked}, the game speaks ${lang}`);
const column = LANGS.findIndex(l => l.id === lang);

// The table.
const seen = new Set();
for (const row of WORDS) {
  check(row.length === 3 && row.every(c => typeof c === 'string' && c.length > 0), `a line of the table is ${JSON.stringify(row)}`);
  check(!seen.has(row[0]), `'${row[0]}' is in the table twice`); seen.add(row[0]);
}
// Every character a glyph.
const { glyphs } = JSON.parse(readFileSync(new URL('../../assets/atlas.json', import.meta.url), 'utf8')).font;
const lacking = new Set();
for (const row of WORDS) for (const c of row.slice(1)) for (const ch of c) if (!glyphs[ch]) lacking.add(ch);
for (const l of LANGS) for (const ch of l.name) if (!glyphs[ch]) lacking.add(ch);
check(!lacking.size, `the font has no glyph for ${[...lacking].join('')}`);

// Every name the game holds.
const game = await makeGame(7), S = game.S;
const names = new Set(['STATS', 'LAB', 'MAP', 'MENU', 'SOUND', 'MUSIC', 'LANGUAGE', 'ON', 'OFF', 'NEW WORLD', 'TAP AGAIN: NEW WORLD', 'LONG FRAMES',
  'NOT ANALYSED YET', 'NOT ENOUGH GRIT', 'GROUND SPENT: PRICE CUT', 'FITTED', 'BUILT', 'CRUSHED', 'SAMPLE 3/4', 'ANALYSED +3%', 'GAME LOADED',
  'IT WAS PLAYED ON IN ANOTHER TAB', 'GROUND MENDED', '1200 PIECES OF AN OLD WORLD', 'DISCHARGE', 'CHARGED', 'BOOST', 'HULL GONE', 'TRIP LOST',
  '-350 GRIT', '-1.2K GRIT, 300 KEPT', 'CORE RESTORED', 'CAUGHT!', 'CAUGHT', '+12 GRIT', 'TROPHY!', 'TROPHY', 'PAL!', 'PRISM x3', 'HALF THE REACH IN ONE HAUL']);
for (const tab of TABS) {
  names.add(tab.name);
  for (const u of tab.rows) {
    names.add(u.name); names.add(u.what); names.add(`${u.name} READY`);
    const shows = u.values.map(v => u.show(v));
    for (let l = 0; l < u.values.length; l++) {
      names.add(shows[l]); names.add(`${shows[l]} MAX`);
      if (l + 1 < u.values.length) { names.add(`${shows[l]}>${shows[l + 1]}`); names.add(`>${shows[l + 1]}`); const s = u.says?.(l); if (s) names.add(s); }
    }
    for (const t of u.tiers ?? []) names.add(`${t} ${u.noun ?? u.name}`);
  }
}
for (const what of Object.values(NEEDS)) { names.add(`NEEDS 3/5 ${what}`); names.add(`3/5 ${what}`); }
// (Where each gem is found and how far out; and the pockets, of the four directions alone, which have specimens.)
for (const [g, w] of GEM_WHERE.entries()) if (w) { names.add(w); names.add(`GEMS: ${w}, PAST ${GEM_PAST[g]}`); names.add(`${w}, PAST ${GEM_PAST[g]}`); if (g <= 4) names.add(`${w} POCKETS`); }
// (And a corner's said short, in the shop's line and its footer.)
for (const [g, w] of GEM_SHORT.entries()) if (w) { names.add(w); names.add(`GEMS: ${w}, PAST ${GEM_PAST[g]}`); names.add(`${w}, PAST ${GEM_PAST[g]}`); }
for (const e of LAB) { names.add(e.name); names.add(e.note); names.add(e.at); names.add(e.where); }
for (const line of LAB_LIST.line) { names.add(line.label); names.add(line.found); }
// (What each thing is worth, said under the list: js/worth.js.)
const { WORTH_AT } = await import('../../js/worth.js');
for (const at of WORTH_AT) for (const w of Object.values(at)) if (w) names.add(w.said);
names.add(labCount(1)); names.add(labCount(5)); names.add(labCount(2400));
for (const b of BIOMES) if (b) { names.add(b.title); const h = placeHaul(b); if (h) names.add(h); }
for (const [, g] of GIANTS) names.add(g);
for (const n of [3, 10, 30, 80, 200]) names.add(haulTitle(n)[0]);
// (Every word of every size, every joke and its line, and the lines under the giants, each fitting the narrowest
// phone's 152 pixels at the smallest size a banner sets a title.)
const hauls = [...SIZES.flatMap(([, w]) => w), ...Object.values(QUIPS).flat(2), ...GIANT_SAYS, OVER_SAYS, 'HALF THE REACH IN ONE HAUL'];
for (const t of hauls) names.add(t);
names.add(haulTitle(5, { relic: 1 })[0]); names.add(haulTitle(5, { parts: 1 })[0]); names.add(haulTitle(5, { caches: 1 })[0]); names.add(haulTitle(5, { spin: 3 })[0]);
names.add(haulTitle(5, { rare: 'bell', live: true })[0]);
for (const [what, [name]] of Object.entries(SPOT)) { names.add(name); if (['bell', 'vent', 'worm', 'lodestone'].includes(what)) names.add(haulTitle(5, { rare: what })[0]); }
for (const c of CREATURES.slice(1)) names.add(c.name);
// (The new ground's: a shrine, a fossil of each species and twin stones hauled, what a banner says under them, the
// seams' reactions, the druse's ringing, and the notice of a deep brought up for an old save.)
names.add(haulTitle(5, { shrine: 0 })[0]); names.add(haulTitle(5, { twins: 1 })[0]);
for (const f of [1, 2, 3, 4]) names.add(haulTitle(5, { fossil: f })[0]);
for (const said of ['GEMS x1.1 FOR GOOD', 'FOSSIL, WHOLE', '1 GEODE RINGS', '3 GEODES RING', '3 RING', 'THAWED', 'GLASS ROAD', 'BURNT OFF', 'ICE RING', 'NEW GROUND', 'THE DEEP HAS CHANGED']) names.add(said);
// STATS at the first and the last level of every row, with every rare met and creatures met, and between.
const rows = TABS.flatMap(t => t.rows);
for (const k of [0, 0.5, 1]) {
  for (const u of rows) S.lv[u.id] = Math.round((u.values.length - 1) * k);
  S.rare = k ? { bell: 1, vent: 1, worm: 1, lodestone: 1 } : {};
  S.fauna = { ...S.fauna, met: k ? { beetle: 1, pup: 1 } : {} }; S.out = k * 900;
  for (const [name, value] of game.stats()) { names.add(name); names.add(value); }
  // (And with a shrine held and a fossil found, when the corners have a line and the lamp is said with the scan.)
  S.shrines = [1, 0, 0, 0]; S.fossils = 1;
  for (const [name, value] of game.stats()) { names.add(name); names.add(value); }
  S.shrines = [0, 0, 0, 0]; S.fossils = 0;
}
const missing = [...names].filter(s => s && !fits(s));
check(!missing.length, `${missing.length} lines have no turn in ${lang}: ${missing.slice(0, process.env.ALL ? 999 : 12).map(s => `'${s}'`).join(', ')}`);

// The lab on the narrowest phone, as test/regress/l-analysis.mjs holds it in English: each name with its worth, and
// each label, within its line, and each note and what is said before a thing is known, turned and broken as the
// panel breaks it, within the lines under the list.
{
  const { textWidth } = await import('../../js/atlas.js');
  const { words } = await import('../../js/lang.js');
  const { NOTE_LINES } = await import('../../js/drawing.js');
  const { LAB_PARTS } = await import('../../js/shop.js');
  game.resize(320, 568, 1);
  const g = game.labGeom(), wide = g.pw - 16, right = g.vw - 5;
  const lines = said => { const out = [], { parts, join } = words(tr(said)); for (const p of parts) { const last = out.at(-1); if (last !== undefined && textWidth(`${last}${join}${p}`) <= wide) out[out.length - 1] = `${last}${join}${p}`; else out.push(p); } return out; };
  LAB.forEach((e, i) => {
    const { label, found } = LAB_LIST.line[i];
    for (const at of WORTH_AT) if (at[e.key]) check(textWidth(at[e.key].said) <= wide, `${e.name}: '${tr(at[e.key].said)}' is wider than the notes`);
    check(18 + textWidth(e.name) + 4 + textWidth('+11%') <= right, `${e.name}: '${tr(e.name)}' is too long for its line`);
    check(18 + textWidth(label) <= right, `${e.name}: '${tr(label)}' is too long for its line`);
    for (const said of [e.note, found]) {
      const l = lines(said);
      check(l.length <= NOTE_LINES && l.every(x => textWidth(x) <= wide), `${e.name}: '${tr(said)}' takes ${l.length} lines, of ${NOTE_LINES}`);
    }
  });
  LAB_PARTS.forEach(({ id, title }) => { const all = LAB.filter(e => e.part === id).length || 19; check(16 + textWidth(title) + 4 + textWidth(`${all}/${all}`) <= right, `the head '${tr(title)}' is too long for its line`); });
  check(textWidth(labCount(99999)) <= wide, `'${tr(labCount(99999))}' is wider than the notes`);
}

{
  const { textWidth } = await import('../../js/atlas.js');
  for (const t of hauls) check(textWidth(t, 1) <= 152, `'${tr(t)}' is ${textWidth(t, 1)} pixels wide, too wide for a narrow phone`);
}

// A number is kept; a line no key fits is drawn as it is; English is never turned.
if (column > 0) {
  check(tr('SAMPLE 3/4') === WORDS.find(r => r[0] === 'SAMPLE #/#')[column].replace('#', '3').replace('#', '4'), `SAMPLE 3/4 is '${tr('SAMPLE 3/4')}'`);
  check(tr('-1.2K GRIT') === WORDS.find(r => r[0] === '-# GRIT')[column].replace('#', '1.2K'), `-1.2K GRIT is '${tr('-1.2K GRIT')}'`);
  check(tr('NO SUCH LINE') === 'NO SUCH LINE' && tr('1234') === '1234', 'a line not in the table was changed');
  check(tr(tr('COPPER')) === tr('COPPER'), 'a line turned is turned again');
} else check(tr('COPPER') === 'COPPER' && tr('SAMPLE 3/4') === 'SAMPLE 3/4', 'English was turned');

for (const f of fails) console.log(`  ${lang}: ${f}`);
console.log(fails.length ? `${lang}: ${fails.length} FAILED` : `${lang}: ${names.size} lines, every one turned and every glyph drawn`);
process.exit(fails.length ? 1 : 0);
