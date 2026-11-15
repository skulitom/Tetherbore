// A piece cut loose but not yet lassoed is forgotten by a reload: restore() brings back the ground and not the
// list of loose pieces, so drawing the tether round the piece afterwards reels nothing in.
//   node test/hunt/modes/restore-loose.mjs
import { makeGame, Game, tetherFaults, C, N, K } from '../harness.mjs';
// A database that works, in memory (the harness's own always fails to open).
const rows = new Map();
const objectStore = () => ({
  put: (value, key) => { rows.set(key, structuredClone(value)); }, clear: () => rows.clear(),
  openCursor() { const walk = {}, all = [...rows]; let n = 0; const next = () => queueMicrotask(() => { walk.result = n < all.length ? { key: all[n][0], value: structuredClone(all[n][1]), continue: () => { n++; next(); } } : null; walk.onsuccess(); }); next(); return walk; },
});
globalThis.indexedDB = { open() { const request = { result: { transaction: () => ({ objectStore }) } }; queueMicrotask(() => request.onsuccess()); return request; } };

const at = (x, y) => (C + y) * N + C + x;
const stage = async () => {
  const game = await makeGame(7, { tether: 2 });
  const w = game.world, opened = [];
  // Staged: an open room south of the core, and in it a 3 x 3 block held to the floor by one cell; then that cell
  // is cut (as the drill would cut it), which leaves the block loose.
  for (let y = 3; y <= 11; y++) for (let x = -7; x <= 7; x++) w.setK(at(x, y), y >= 8 && y <= 10 && Math.abs(x) <= 1 ? K.DENSE : K.EMPTY);
  for (let x = -8; x <= 8; x++) w.setK(at(x, 12), K.DENSE);
  w.setK(at(0, 11), K.DENSE);
  game.pieces = []; game.changed();
  w.setK(at(0, 11), K.EMPTY); game.changed([at(0, 11)]);
  return game;
};
const lasso = game => {
  const d = game.drill;
  d.x = C + 0.5; d.y = C + 2 + 0.5; game.band = [[d.x, d.y], [C + 0.5, C + 0.5]];      // set down just off the core, so no throw
  for (const [x, y] of [[4, 5], [4, 11], [-4, 11], [-4, 6]]) for (let f = 0; f < 600; f++) {
    const dx = C + 0.5 + x - d.x, dy = C + 0.5 + y - d.y, far = Math.hypot(dx, dy);
    if (far < 0.3) break;
    game.input.auto = [dx / far, dy / far, 1];
    game.update(1 / 60);
  }
  game.input.auto = null;
  for (let f = 0; f < 60; f++) game.update(1 / 60);
  return `known loose pieces ${game.pieces.length}, hauls ${game.S.stats.hauls}, block ${game.world.k(at(0, 9)) === K.EMPTY ? 'reeled in' : 'still there'}, bends ${game.band.length - 2}, drill ${game.far.toFixed(1)} cells from the core`;
};
const first = await stage();
console.log(`before a reload: the game knows ${first.pieces.length} loose piece(s), ${first.pieceOf.has(at(0, 9)) ? 'the block among them' : 'not the block'}`);
first.save();
await new Promise(r => setTimeout(r, 20));
console.log(`  flown round the block without a reload:  ${lasso(await stage())}`);
const canvas = { width: 0, height: 0, style: {}, getContext: () => new Proxy({}, { get: () => () => ({ data: new Uint8ClampedArray(4) }), set: () => true }) };
const again = new Game(canvas);
const ok = await again.restore();
again.resize(360, 640, 1);
console.log(`restore() returned ${ok}; the block is ${again.world.k(at(0, 9)) === K.EMPTY ? 'gone' : 'in the ground as saved'}; the game knows ${again.pieces.length} loose piece(s), ${again.pieceOf.has(at(0, 9)) ? 'the block among them' : 'not the block'}`);
const told = lasso(again);
console.log(`  flown round the block after the reload:  ${told}`);
process.exit(again.world.k(at(0, 9)) === K.EMPTY ? 0 : 1);
