// The demo and the full game, side by side.
//   - A normal build has no demo in it: DEMO is false in the repository and in what the site build ships, js/demo.js is
//     not shipped, the game has no limit, no card and no lord nearer than 2,210, and the save keeps its old keys.
//   - The build: --demo changes that one line, ships js/demo.js, and names the page; the two differ in nothing else.
//   - A demo's save, played in a copy built as the demo, is taken up by the full game with nothing lost and nothing of
//     the limit left; a full game with a save of its own takes nothing from a demo's.
//   - The demo played (y-demo-play.mjs) in that copy, in each language.
//   node test/regress/y-demo.mjs
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeGame, UPGRADES, WORKS, MAPS, CORE } from '../harness.mjs';
import { build, editionFor, DEMO_LINE, withPreloads } from '../../tools/build-dist.mjs';
import { demoTree } from './lib/demo-tree.mjs';

const { DEMO, DEMO_SAVE, FULL_SAVE, SAVE_KEY, DB_NAME } = await import('../../js/edition.js');
const { BOSS, LAIR } = await import('../../js/bosses.js');
const { carry, carried } = await import('../../js/carry.js');
const fails = [], check = (ok, what) => { if (!ok && fails.length < 30) fails.push(what); };
const root = new URL('../../', import.meta.url), ROWS = [...UPGRADES, ...WORKS, ...MAPS, ...CORE];

// ---- a normal build has no demo in it
{
  check(DEMO === false, 'js/edition.js says this is the demo');
  check(SAVE_KEY === 'tetherbore-save-v3' && DB_NAME === 'tetherbore', `a normal build saves to ${SAVE_KEY} and ${DB_NAME}`);
  check(LAIR === 2210 && BOSS.every(B => B.ready), `the lords lie ${LAIR} out, ${BOSS.filter(B => B.ready).length} of them ready`);
  const game = await makeGame(7);
  check(game.demo === undefined, 'a normal game has a demo fitted');
  for (const name of ['cost', 'buy', 'kept', 'restore', 'update', 'key']) check(!Object.hasOwn(game, name), `a normal game's ${name} is wrapped`);
  game.S.grit = 1e12; game.S.out = 3000; game.S.gems = game.S.gems.map(() => 1e9);
  for (let n = 0; n < 12; n++) game.buy(UPGRADES[0]);
  check(game.val('tether') === 2300, `a normal game's tether stopped at ${game.val('tether')}`);
  game.far; game.lab = true; game.labTab = 'menu'; game.render();
  check(!game.failedAt, 'a normal game threw');
  const main = readFileSync(new URL('js/main.js', root), 'utf8');
  check(/DEMO \? await import\('\.\/demo\.js'\) : null/.test(main), 'js/main.js does not fetch the demo only in a demo build');
  check(!/^import .*demo\.js/m.test(main), 'js/main.js imports the demo');
}

// ---- the build, with a stand-in for esbuild that passes each module through
{
  const esbuild = { transformSync: source => ({ code: source.replace(/\r\n/g, '\n'), warnings: [] }) };
  const where = mkdtempSync(path.join(os.tmpdir(), 'tetherbore-build-'));
  try {
    const plain = path.join(where, 'plain'), demo = path.join(where, 'demo');
    build(plain, esbuild); build(demo, esbuild, { demo: true });
    const js = dir => readdirSync(path.join(dir, 'js')).sort(), read = (dir, file) => readFileSync(path.join(dir, file), 'utf8');
    check(!js(plain).includes('demo.js') && js(plain).includes('carry.js'), `a normal build ships ${js(plain).filter(f => /demo|carry/.test(f))}`);
    check(js(demo).includes('demo.js') && !js(demo).includes('carry.js'), `a demo build ships ${js(demo).filter(f => /demo|carry/.test(f))}`);
    check(read(plain, 'js/edition.js').includes(DEMO_LINE), 'a normal build\'s edition is not the full game');
    check(read(demo, 'js/edition.js').includes('export const DEMO = true;') && !read(demo, 'js/edition.js').includes(DEMO_LINE), 'a demo build\'s edition does not say so');
    for (const file of js(plain)) if (file !== 'edition.js' && file !== 'carry.js') check(read(plain, `js/${file}`) === read(demo, `js/${file}`), `js/${file} differs between the builds`);
    check(read(plain, 'index.html').includes('<title>Tetherbore</title>') && read(demo, 'index.html').includes('<title>Tetherbore Demo</title>'), 'the pages are not named for their builds');
    const atlas = JSON.parse(readFileSync(new URL('assets/atlas.json', root), 'utf8'));
    check(read(plain, 'index.html') === withPreloads(readFileSync(new URL('index.html', root), 'utf8').replace(/\r\n/g, '\n'), atlas), 'a normal build\'s page is not the page');
    let threw = false;
    try { editionFor('nothing', true); } catch { threw = true; }
    check(threw, 'a demo build of an edition without the line went through');
  } finally { rmSync(where, { recursive: true, force: true }); }
}

// ---- the demo played, and its save
const tree = demoTree(), played = path.join(tree.dir, 'played.json');
try {
  for (const [id, args] of [['en', ['--write', played]], ['ru', []], ['zh', []]]) {
    const run = spawnSync(process.execPath, ['test/regress/y-demo-play.mjs', ...args], { cwd: tree.dir, encoding: 'utf8', env: { ...process.env, TETHERBORE_LANG: id }, maxBuffer: 1 << 26 });
    const last = `${run.stdout ?? ''}${run.stderr ?? ''}`.trim().split('\n').slice(-3).join(' ');
    check(run.status === 0, `the demo played in ${id}: ${last.slice(0, 900)}`);
  }
  let keys = null;
  try { keys = JSON.parse(readFileSync(played, 'utf8')); } catch { check(false, 'the demo left no save to carry over'); }
  if (keys) {
    const demoSave = JSON.parse(keys[`${DEMO_SAVE}-latest`]);
    check(demoSave.demoLords > 0 && demoSave.bosses === undefined, 'the played save has no lord of the demo\'s to leave behind');
    // From a file, as the desktop has it, into a device with no full game.
    localStorage.removeItem(FULL_SAVE); localStorage.removeItem(`${FULL_SAVE}-latest`);
    check(await carry({ keys: { ...keys, 'tetherbore-lang': 'ru', 'tetherbore-stalls': '[]' }, pieces: [] }), 'the full game did not take up the demo\'s save');
    check(localStorage.getItem('tetherbore-lang') === 'ru', 'the language did not come with it');
    localStorage.removeItem('tetherbore-lang');
    check(localStorage.getItem('tetherbore-stalls') === null, 'the demo\'s record of long frames came with it');
    const game = await makeGame(1);
    check(await game.restore(), 'the full game did not load the demo\'s save');
    const S = game.S;
    check(S.seed === demoSave.seed && S.grit === demoSave.grit && S.gems[1] === 77 && S.spec[2] === 6 && S.out === 388 && S.stats.hauls === 42 && S.stats.best === 160 && S.lab['lode-items:oreA'] === 9 && S.met[1] === 1,
      `what the demo had did not all come: ${JSON.stringify({ grit: S.grit, gems: S.gems[1], spec: S.spec[2], out: S.out, hauls: S.stats.hauls })}`);
    for (const u of ROWS) check(S.lv[u.id] === (demoSave.lv[u.id] ?? 0), `${u.id} came over at level ${S.lv[u.id]}`);
    check(game.ach.earned.has('ACH_FIRST_HAUL'), 'what the demo earned did not come');
    check(S.demoLords === undefined && !S.bosses, `the demo's lord came with it: ${S.demoLords}, ${S.bosses}`);
    // No limit left: the next reach is on sale, is bought, and goes past the demo's.
    S.grit = 1e12; S.out = 400;
    check(game.val('tether') === 400 && game.canBuy(UPGRADES[0]), 'the full game cannot buy past the demo\'s reach');
    game.buy(UPGRADES[0]);
    check(game.val('tether') === 620, `bought, the reach is ${game.val('tether')}`);
    // A full game with a save of its own takes nothing.
    game.S.grit = 999; game.save();
    const mine = localStorage.getItem(`${FULL_SAVE}-latest`);
    check(!(await carry({ keys, pieces: [] })), 'a full game with a save took up a demo\'s');
    check(localStorage.getItem(`${FULL_SAVE}-latest`) === mine, 'a full game\'s save was replaced by a demo\'s');
    // Nor over a full game's save that cannot be read, which the game keeps aside.
    localStorage.setItem(FULL_SAVE, '{ broken'); localStorage.removeItem(`${FULL_SAVE}-latest`);
    check(!(await carry({ keys, pieces: [] })) && localStorage.getItem(FULL_SAVE) === '{ broken', 'a broken full save was written over');
    // A demo's save that cannot be read brings nothing.
    localStorage.removeItem(FULL_SAVE); localStorage.removeItem(`${FULL_SAVE}-latest`);
    check(carried({ [DEMO_SAVE]: 'not a save' }) === null && !(await carry({ keys: { [DEMO_SAVE]: '{' }, pieces: [] })), 'a broken demo save was taken up');
    check(localStorage.getItem(FULL_SAVE) === null, 'a broken demo save was written as the full game\'s');
  }
} finally { tree.done(); }

if (fails.length) { console.log(`FAIL y-demo: ${fails.join('; ')}`); process.exit(1); }
console.log('ok y-demo: a normal build has no demo in it, the two builds differ by the one line, the demo plays in all three languages, and its save comes into the full game whole with no limit left');
process.exit(0);
