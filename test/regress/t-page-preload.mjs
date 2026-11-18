// index.html asks for every module the game loads at once, and for no other. It modulepreloaded six of the fifteen
// js/main.js imports: the other nine (lang, worth, feel, fit, fauna, winds, bosses, goal and decor, about 100 KB
// gzipped) were found only once the first six had come and been read, a round trip later, and on a phone on 4G the
// first frame waited 190 ms more for them, on 3G 490. And js/words.js, which js/lang.js fetches only for Russian
// or Mandarin, from the middle of the graph, was found later still: the script in index.html asks for it too, where
// the language chosen is one of those, by lang.js's own rule.
//   node test/regress/t-page-preload.mjs
// Held here:
//   - index.html's modulepreload links are the static import graph of js/main.js (read from the import statements
//     of each module, main.js itself left out), each once, and nothing else: js/shot.js and js/words.js, fetched
//     only when asked for, are not among them;
//   - the script that asks for js/words.js asks for it exactly where lang.js's `lang` is Russian or Mandarin, for a
//     link's ?lang= of every language, of one the game has not and of none, with every language kept on the device,
//     one it has not, none and a storage that throws; and it writes nothing to storage (lang.js keeps what a link
//     chose itself).
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url), problems = [], note = text => { if (problems.length < 20) problems.push(text); };
const source = file => readFileSync(new URL(file, root), 'utf8');

// 1. The import graph: `import ... from './x.js'`, `export ... from './x.js'` and `import './x.js'` at the start of
// a line (a dynamic import(), inside a function, is not followed).
const STATIC = /^(?:import|export)\b[^;]*?\bfrom\s*['"](\.\/[^'"]+)['"]|^import\s*['"](\.\/[^'"]+)['"]/gm;
const graph = new Set(), walk = file => {
  for (const m of source(`js/${file}`).matchAll(STATIC)) {
    const to = (m[1] ?? m[2]).slice(2);
    if (!graph.has(to)) { graph.add(to); walk(to); }
  }
};
walk('main.js');
graph.delete('main.js');
const modules = readdirSync(new URL('js/', root)).filter(f => f.endsWith('.js'));
for (const f of graph) if (!modules.includes(f)) note(`main.js's graph names js/${f}, which is not there`);
if (graph.size < 10) note(`the import graph read is only ${[...graph].join(', ')}`);

const html = source('index.html');
const links = [...html.matchAll(/<link\b[^>]*\brel="?modulepreload"?[^>]*>/g)].map(m => /\bhref="?([^" >]+)/.exec(m[0])?.[1]);
const listed = links.map(h => h?.replace(/^js\//, ''));
for (const h of links) if (!/^js\/[\w-]+\.js$/.test(h ?? '')) note(`a modulepreload of ${h}, not a module of js/`);
for (const f of new Set(listed)) if (listed.filter(x => x === f).length > 1) note(`js/${f} is modulepreloaded twice`);
for (const f of graph) if (!listed.includes(f)) note(`js/${f} is imported (from main.js on) but not modulepreloaded`);
for (const f of listed) if (!graph.has(f)) note(`js/${f} is modulepreloaded but main.js does not import it`);
for (const f of ['shot.js', 'words.js']) if (graph.has(f)) note(`js/${f} is imported statically, where it is fetched only when asked for`);
if (!/<script type="module" src="js\/main\.js"><\/script>/.test(html)) note('index.html has no module script js/main.js');

// 2. The script that asks for js/words.js, against lang.js's `chosen`.
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) note(`index.html has ${scripts.length} inline scripts, not the one`);
const inline = new vm.Script(scripts[0] ?? '', { filename: 'index.html' });
const at = html.indexOf('<script>');
if (at > html.indexOf('rel="stylesheet"')) note('the inline script stands after the stylesheet, and waits for it');
if (at > html.indexOf('<script type="module"')) note('the inline script stands after the module script');

// A device's storage: what it holds, or `throws` for one that cannot be read; and what is written to it.
const storage = (kept, throws) => {
  const writes = [];
  return { writes, getItem: k => { if (throws) throw new Error('denied'); return kept[k] ?? null; }, setItem: (k, v) => { writes.push([k, v]); if (throws) throw new Error('denied'); }, removeItem() {} };
};
delete process.env.TETHERBORE_LANG;
let n = 0, asked = 0;
const searches = ['', '?lang=ru', '?lang=zh', '?lang=en', '?lang=xx', '?lang=RU', '?lang=', '?shot&lang=zh&lv=max', '?debug'];
const kepts = [undefined, 'ru', 'zh', 'en', 'xx', 'throws'];
for (const search of searches) for (const kept of kepts) {
  const what = `${search || 'no query'} with ${kept ?? 'nothing'} kept`;
  // The page's script, in a page of its own.
  const store = storage(kept && kept !== 'throws' ? { 'tetherbore-lang': kept } : {}, kept === 'throws'), added = [];
  const head = { appendChild: el => added.push(el) };
  const page = { location: { search, href: `https://x.test/index.html${search}` }, localStorage: store, URLSearchParams,
    document: { head, createElement: tag => ({ tagName: tag }) } };
  try { inline.runInNewContext(page); } catch (error) { note(`${what}: the script threw ${error.message}`); continue; }
  if (store.writes.length) note(`${what}: the script wrote ${JSON.stringify(store.writes)} to storage`);
  const words = added.filter(el => el.tagName === 'link' && el.rel === 'modulepreload' && el.href === 'js/words.js');
  if (added.length !== words.length) note(`${what}: the script added ${JSON.stringify(added)}`);
  // lang.js, loaded afresh in the same page.
  const theirs = storage(kept && kept !== 'throws' ? { 'tetherbore-lang': kept } : {}, kept === 'throws');
  globalThis.location = page.location; globalThis.localStorage = theirs;
  let lang;
  try { ({ lang } = await import(new URL(`js/lang.js?case=${n++}`, root))); } catch (error) { note(`${what}: lang.js threw ${error.message}`); continue; }
  const wants = lang === 'ru' || lang === 'zh';
  if (wants) asked++;
  if (words.length !== (wants ? 1 : 0)) note(`${what}: lang.js speaks ${lang}, and the script asked for js/words.js ${words.length} times`);
}
if (asked < 10) note(`only ${asked} cases chose a language not English`);

if (problems.length) { console.log(`FAIL t-page-preload: ${problems.join('; ')}`); process.exit(1); }
console.log(`ok t-page-preload: ${graph.size} modules modulepreloaded as main.js imports them, and js/words.js asked for as lang.js chooses in ${n} cases (${asked} not English)`);
