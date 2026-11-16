// A game takes no ground but its own world's. One began a new world over the ground an older world had saved in
// the browser's database: everything about the core lay mined out to far beyond where its tether had ever reached,
// and only one side of the ground was left to cut. Every piece saved now says whose world it is, the store is
// marked with the world's seed, and `restore` throws out what is another's; in a store saved before pieces said, each
// piece is looked at, since another world's ground does not lie as this seed lays it.
import { makeGame, Game, world, C, N, K } from '../harness.mjs';

const { World } = world;
const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
// A stand-in for the browser's database: one store of rows, with what the game asks of it.
const rows = new Map();
const pieces = {
  put(value, key) { rows.set(key, structuredClone(value)); }, delete(key) { rows.delete(key); }, clear() { rows.clear(); },
  openCursor() { const walk = {}, all = [...rows]; let n = 0; const next = () => queueMicrotask(() => { walk.result = n < all.length ? { key: all[n][0], value: structuredClone(all[n][1]), continue: () => { n++; next(); } } : null; walk.onsuccess(); }); next(); return walk; },
};
globalThis.indexedDB = { open() { const request = {}; queueMicrotask(() => { request.result = { transaction: () => ({ objectStore: () => pieces }) }; request.onsuccess(); }); return request; } };
const settle = () => new Promise(resolve => setTimeout(resolve, 20));
const canvas = () => ({ width: 0, height: 0, style: {}, getContext: document.createElement().getContext, getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 640 }) });
const load = async () => { const game = new Game(canvas()); const ok = await game.restore(); await settle(); return [game, ok]; };
const at = (x, y) => (C + y) * N + C + x;

// ---- an old world's ground, mined far out to the west and all about the core, saved with no word of whose it is
const old = new World(); old.reset(7);
for (let y = -60; y <= 60; y++) for (let x = -500; x <= 60; x++) if (Math.hypot(x, y) > 3) old.setK(at(x, y), K.EMPTY);
for (let y = -30; y <= 30; y++) for (let x = 150; x <= 250; x++) old.k(at(x, y));
const legacy = () => { rows.clear(); old.chunks.forEach((p, id) => { if (p) rows.set(id, { kind: p.kind.slice(), biome: p.biome.slice(), seen: p.seen.slice() }); }); return rows.size; };
const saved = async (seed, more = {}) => { const game = await makeGame(seed); Object.assign(game.S, more); localStorage.setItem('tetherbore-save-v3', JSON.stringify({ v: 3, ...game.S })); };

// A new game of another world, loaded over it: the old world's ground is thrown out, and what is left is this world's.
{
  const had = legacy();
  await saved(55, { grit: 80000, out: 420 });
  const [game, ok] = await load(), w = game.world, plain = new World(); plain.reset(55);
  let wrong = 0, open = 0, all = 0;
  for (let y = -60; y <= 60; y += 3) for (let x = -500; x <= 250; x += 3) { if (Math.hypot(x, y) < 6) continue; all++; if (w.k(at(x, y)) !== plain.k(at(x, y))) wrong++; if (w.k(at(x, y)) === K.EMPTY) open++; }
  check(ok && game.S.seed === 55 && game.S.grit === 80000, `the game loaded is of world ${game.S.seed} with ${game.S.grit} grit`);
  check(wrong === 0 && open < all * 0.5, `${wrong} of ${all} cells are not as world 55 lays them, and ${open} are open`);
  check(game.thrownOut >= had * 0.9 && game.notice?.title === 'GROUND MENDED', `${game.thrownOut} of ${had} saved pieces were thrown out, and the game said '${game.notice?.title}'`);
  check(rows.get('meta')?.seed === 55 && [...rows.keys()].filter(k => k !== 'meta').length <= had * 0.1, `the store is marked ${JSON.stringify(rows.get('meta'))} and holds ${rows.size - 1} pieces still`);
  // What this game cuts is saved as its own, and is there when it is loaded again; nothing more is thrown out.
  for (let x = 4; x < 40; x++) w.setK(at(x, 0), K.EMPTY);
  game.changed(); game.save(); await settle();
  const own = [...rows].filter(([key, value]) => key !== 'meta' && value.seed === 55).length;
  const [again] = await load();
  let cut = 0; for (let x = 4; x < 40; x++) if (again.world.k(at(x, 0)) === K.EMPTY) cut++;
  check(own > 0 && cut === 36 && again.thrownOut === 0 && again.notice === null, `${own} pieces were saved as world 55's; loaded again, ${cut} of the tunnel's 36 cells are open and ${again.thrownOut} pieces were thrown out`);
}

// ---- the same ground under its own world's game is all kept: a save of before pieces said whose they were
{
  const had = legacy();
  await saved(7, { grit: 5 });
  const [game] = await load(), w = game.world;
  let open = 0, all = 0;
  for (let y = -60; y <= 60; y += 3) for (let x = -500; x <= 60; x += 3) { if (Math.hypot(x, y) < 6) continue; all++; if (w.k(at(x, y)) === K.EMPTY) open++; }
  check(game.thrownOut === 0 && open === all && rows.get('meta')?.seed === 7 && rows.size === had + 1, `under world 7's own game ${game.thrownOut} pieces were thrown out and ${open} of ${all} mined cells are open; the store is marked ${JSON.stringify(rows.get('meta'))}`);
  // Marked as this world's, its pieces are taken with no looking at: and one that says it is another world's is not.
  const id = [...rows.keys()].find(k => k !== 'meta');
  rows.set(id, { ...rows.get(id), seed: 99 });
  const [second] = await load();
  check(second.thrownOut === 1 && !rows.has(id), `a piece that says it is world 99's: ${second.thrownOut} thrown out`);
}

// ---- a new world leaves nothing of the old in the store, whatever it held
{
  legacy();
  const game = await makeGame(7);
  game.fresh(31); game.save(); await settle();
  const others = [...rows].filter(([key, value]) => key !== 'meta' && value.seed !== 31).length;
  check(rows.get('meta')?.seed === 31 && others === 0 && rows.size > 1, `after a new world the store is marked ${JSON.stringify(rows.get('meta'))} and holds ${others} pieces that are not its own, of ${rows.size - 1}`);
}

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : 'no defect: a game loaded over another world\'s saved ground throws that ground out and is its own world again, its own cuts are kept, a save of before pieces said whose they were is taken whole under its own world, and a new world leaves nothing of the old');
process.exit(fails.length ? 1 : 0);
