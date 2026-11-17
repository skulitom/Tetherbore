// The language the game speaks: English, Russian or Mandarin. Everything said on the screen is written in English in
// the code and turned into the language chosen where it is drawn (js/atlas.js, `text` and `textWidth`, and the lab's
// notes before they are wrapped), so no line of the game is written twice.
//
// The language is chosen in the menu and kept on this device. A link may name one, `?lang=ru` or `?lang=zh` (or
// `?lang=en`), which is then kept as if chosen; a link that names none leaves the choice as it was, and a device that
// has never chosen speaks English. Changing it reloads the page (the game is saved first), so that nothing laid out
// once in the old language stays.
//
// The table (js/words.js: each line in English, Russian and Mandarin, fetched only for a language not English) is
// keyed by the English. A key holding `#` stands for a number there
// (digits, a decimal point and a K, M or B after them: what `compact` writes), and one holding `*` for any words,
// which are themselves turned; the turned line takes them back in the same order, or by place where it says {0},
// {1} ... . A line no key fits is drawn as it is, in English.

export const LANGS = [{ id: 'en', name: 'ENGLISH' }, { id: 'ru', name: 'РУССКИЙ' }, { id: 'zh', name: '中文' }];
export const LANG_KEY = 'tetherbore-lang';
const known = id => LANGS.some(l => l.id === id) ? id : null;

// The language asked for by the link, else the one kept, else English. (Under node the tests name one with
// TETHERBORE_LANG.)
function chosen() {
  let asked = null;
  try { asked = known(new URLSearchParams(globalThis.location?.search ?? '').get('lang')); } catch { }
  if (asked) { try { globalThis.localStorage?.setItem(LANG_KEY, asked); } catch { } return asked; }
  try { asked = known(globalThis.localStorage?.getItem(LANG_KEY)); } catch { }
  return asked ?? known(globalThis.process?.env?.TETHERBORE_LANG) ?? 'en';
}
export const lang = chosen();

// The language changed from the menu: kept, and the page loaded again in it (with the link's own `lang` made to say
// the same, so that it does not choose the old one again).
export function chooseLang(id) {
  if (!known(id) || id === lang) return;
  try { globalThis.localStorage?.setItem(LANG_KEY, id); } catch { }
  const loc = globalThis.location;
  if (!loc) return;
  const url = new URL(loc.href);
  if (url.searchParams.has('lang')) { url.searchParams.set('lang', id); loc.replace(url.href); } else loc.reload();
}

const NUM = '\\d+(?:\\.\\d+)?(?:[KMB](?![A-Z]))?', number = new RegExp(NUM, 'g');
const escape = s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
function compile(table) {
  const exact = new Map(), wild = [];
  for (const [en, to] of Object.entries(table)) {
    if (!en.includes('*')) { exact.set(en, to); continue; }
    const parts = [], source = en.split(/([#*])/).map(p => p === '#' ? (parts.push('#'), `(${NUM})`) : p === '*' ? (parts.push('*'), '(.+?)') : escape(p)).join('');
    wild.push({ re: new RegExp(`^${source}$`), parts, to, size: en.replace(/[#*]/g, '').length });
  }
  // (The key that says the most of the line is tried first: '* HAUL!' before '* *'.)
  wild.sort((a, b) => b.size - a.size);
  return { exact, wild };
}
const column = LANGS.findIndex(l => l.id === lang);
const table = column > 0 ? compile(Object.fromEntries((await import('./words.js')).WORDS.map(row => [row[0], row[column]]))) : null;
const made = new Map();

// The line `s` in the language chosen.
export function tr(s) {
  if (!table || !s) return s;
  let to = made.get(s);
  if (to !== undefined) return to;
  to = turn(s, false);
  // (A line already turned, drawn and measured again, is not one missed.)
  if (to === undefined) { to = s; if (noting && !/[^\x00-\x7f]/.test(s)) missed.add(s); }
  if (made.size > 6000) made.clear();
  made.set(s, to);
  return to;
}
// Whether the table has the line `s`, every word of it that a `*` stands for included (a line of no Latin letter,
// a figure or a sign, needs none). The tests ask it of every name the game's rows hold.
export const fits = s => !table || turn(s, true) !== undefined;
// The line turned, or undefined where no key fits. `strict`: a key whose `*` holds words the table does not have
// does not fit (drawn, the words are left as they are and the rest is turned).
function turn(s, strict) {
  if (!/[A-Za-z]/.test(s)) return s;
  const { exact, wild } = table;
  let to = exact.get(s);
  if (to !== undefined) return to;
  // The numbers in it stood in for by #.
  const nums = s.match(number);
  if (nums) {
    to = exact.get(s.replace(number, '#'));
    if (to !== undefined) { let n = 0; return to.replace(/#/g, () => nums[n++] ?? '#'); }
  }
  for (const w of wild) {
    const m = w.re.exec(s);
    if (!m) continue;
    const got = w.parts.map((p, i) => p === '*' ? strict ? turn(m[i + 1], true) : tr(m[i + 1]) : m[i + 1]);
    if (got.includes(undefined)) continue;
    if (/\{\d\}/.test(w.to)) return w.to.replace(/\{(\d)\}/g, (_, i) => got[+i] ?? '');
    let n = 0;
    return w.to.replace(/[#*]/g, () => got[n++] ?? '');
  }
  return undefined;
}
// (The lines no key fitted. Under node with TETHERBORE_MISSED naming a file, each is written to it as the process
// ends: the whole suite run so, in each language, says what it drew that the table does not have.)
export const missed = new Set();
const noting = !!(table && globalThis.process?.env?.TETHERBORE_MISSED);
if (noting) {
  const { appendFileSync } = await import('node:fs');
  process.on('exit', () => { if (missed.size) appendFileSync(process.env.TETHERBORE_MISSED, [...missed].join('\n') + '\n'); });
}

// Mandarin is written without spaces: its lines are broken between any two characters (a run of Latin letters and
// figures kept whole), and a stop or a comma never begins a line.
export const spaced = lang !== 'zh';
export function words(s) {
  if (spaced) return { parts: s.split(' '), join: ' ' };
  const parts = [];
  for (const p of s.match(/[A-Za-z0-9+%./>-]+|\s+|./gu) ?? []) {
    if (/^\s+$/.test(p)) continue;
    if (parts.length && /^[，。：；！？、）」]$/.test(p)) parts[parts.length - 1] += p; else parts.push(p);
  }
  return { parts, join: '' };
}
