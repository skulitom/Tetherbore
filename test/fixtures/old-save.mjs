// Makes a saved game with an older build of the game, for test/regress/h-old-save.mjs to load on the game as it is
// now. Run with a checkout of the older build:
//   git worktree add --detach <somewhere> 4293f7c
//   node test/fixtures/old-save.mjs <somewhere> test/fixtures/save-4293f7c.json.gz
//
// test/fixtures/save-4293f7c.json.gz was made this way from commit 4293f7c: the game as it was before the content
// build, with grounds 0 to 8 alone and no slabs, pockets, provinces or specimens. The older build is played through
// its own test harness (world 7, reach 230), with a database that keeps what the game puts in it:
//   south    over where the first keystone slab lies now (3, 52), and a wander there;
//   north    to where the north's first pocket lies now (14, -165), a wander there, and home;
//   east     along y = -30 to x = 150, never north of y = -40: the piece of world it sees there ends at y = -64,
//            so the drift at (174, -78), 21 cells in radius, lies half in seen ground; and never as far south as
//            the east's first pocket (165, 14), which stays unseen.
// What is written: what the game put in local storage, and every piece of world it put in the database (kind,
// ground and seen, as bytes in base64), gzipped. It asserts that the pieces are where the test wants them.
//
// With --north-east it flies another game, for test/regress/h-gen-save.mjs: the game before the seams and the deep
// strains, whose pieces say their world but not their generation (js/world.js: GEN), flown out along the north-east
// diagonal into the ground a newer generation lays otherwise, and saved there.
//   git worktree add --detach <somewhere> 93ecb92
//   node test/fixtures/old-save.mjs <somewhere> test/fixtures/save-93ecb92-ne.json.gz --north-east
// test/fixtures/save-93ecb92-ne.json.gz was made this way from commit 93ecb92 (world 7, reach 950, the bit at its
// fourth level): straight out to 300,-300 and 470,-470, a wander about 520,-520, out to 640,-640 (905 cells, past
// where everything may be laid anew) and a wander there, and across to 600,-300, 670 cells out but 300 off the
// diagonal; saved with the hauls home. It asserts that pieces were saved in each of those kinds of place, and that
// each said its world.
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const [dir, out, how] = process.argv.slice(2), ne = how === '--north-east';
if (!dir || !out) { console.log('node test/fixtures/old-save.mjs <a checkout of the older build> <file to write> [--north-east]'); process.exit(1); }
const { makeGame, random, C, N, K } = await import(pathToFileURL(resolve(dir, 'test/harness.mjs')).href);

// A database that keeps what is put in it (the harness's own refuses to open, as a private window's does).
const rows = new Map();
const pieces = { put(value, id) { if (id !== 'meta') rows.set(id, { kind: Uint8Array.from(value.kind), biome: Uint8Array.from(value.biome), seen: Uint8Array.from(value.seen), seed: value.seed }); }, clear() { rows.clear(); } };
globalThis.indexedDB = { open() { const request = {}; queueMicrotask(() => { request.result = { transaction: () => ({ objectStore: () => pieces }) }; request.onsuccess?.(); }); return request; } };

const seed = 7, game = await makeGame(seed, ne ? { tether: 7, drill: 4, winch: 5, scanner: 3, momentum: 4 } : { tether: 5, drill: 3, winch: 2, scanner: 2, momentum: 1 }), d = game.drill, rnd = random(seed * 3 + 1);
Math.random = random(seed + 5);
game.S.grit = 5000;
let frames = 0;
const go = (x, y, most = 60 * 90, keep = null) => {
  for (let f = 0; f < most; f++) {
    const dx = C + x + 0.5 - d.x, dy = C + y + 0.5 - d.y, far = Math.hypot(dx, dy);
    if (far < 0.4 && d.mode === 'free') break;
    game.input.auto = [dx / far, dy / far, 1];
    game.update(1 / 60); frames++;
    if (keep && !keep()) throw new Error(`the flight left where it was to stay, at ${(d.x - C).toFixed(1)},${(d.y - C).toFixed(1)}`);
  }
  // (Let go for a moment: reeled home, the drill stays put until the thumb lifts.)
  game.input.auto = null;
  for (let f = 0; f < 3; f++) { game.update(1 / 60); frames++; }
};
const wander = (turns, cx, cy, r) => {
  let heading = rnd() * 6.283;
  for (let turn = 0; turn < turns; turn++) {
    heading += (rnd() - 0.5) * 2.5;
    // Turned back toward the middle when it strays.
    if (Math.hypot(d.x - C - cx, d.y - C - cy) > r) heading = Math.atan2(C + cy - d.y, C + cx - d.x);
    for (let f = 10 + Math.floor(rnd() * 50); f > 0; f--) { game.input.auto = [Math.cos(heading), Math.sin(heading), 1]; game.update(1 / 60); frames++; }
  }
  game.input.auto = null;
};
if (ne) {
  go(300, -300, 60 * 300); go(470, -470, 60 * 300); wander(40, 520, -520, 40);
  go(640, -640, 60 * 300); wander(30, 640, -640, 30); go(600, -300, 60 * 300);
} else {
  go(3, 40); wander(40, 3, 52, 16); go(0, 0);
  go(14, -150); wander(60, 14, -165, 14); go(14, -150); go(0, 0);
  go(20, -30); go(150, -30, 60 * 240, () => d.y - C >= -40 && d.y - C <= -20); go(20, -30); go(0, 0);
}
for (let f = 0; f < 600 && game.hauls.length; f++) { game.update(1 / 60); frames++; }
game.save();
await new Promise(done => setTimeout(done, 20));

const pieceOf = (x, y) => (((C + y) >> 6) << 8) | ((C + x) >> 6), has = (x, y) => rows.has(pieceOf(x, y));
const places = ne ? [[300, -300, true, 'the diagonal 424 out'], [520, -520, true, 'the diagonal 735 out'], [640, -640, true, 'the diagonal 905 out'], [600, -300, true, '600,-300'], [720, -720, false, 'the diagonal 1018 out']]
  : [[3, 52, true, 'the first slab\'s place'], [14, -165, true, 'the north\'s first pocket\'s place'], [174, -60, true, 'the south edge of the drift at 174,-78'], [174, -78, false, 'that drift\'s middle'],
  [165, 14, false, 'the east\'s first pocket'], [-14, 165, false, 'the south\'s first pocket'], [-205, -14, false, 'the west\'s first pocket']];
if (ne && [...rows.values()].some(p => p.seed !== seed)) throw new Error('a piece was saved without its world');
for (const [x, y, want, what] of places) {
  if (has(x, y) !== want) throw new Error(`${what} (${x},${y}) is ${want ? 'not ' : ''}in a saved piece`);
}
const b64 = bytes => Buffer.from(bytes).toString('base64');
const local = localStorage.getItem('tetherbore-save-v3'), S = JSON.parse(local);
const save = { made: `commit ${ne ? '93ecb92' : '4293f7c'}, by test/fixtures/old-save.mjs${ne ? ' --north-east' : ''}`, seed, local, pieces: [...rows].sort((a, b) => a[0] - b[0]).map(([id, p]) => [id, b64(p.kind), b64(p.biome), b64(p.seen)]) };
const packed = gzipSync(JSON.stringify(save), { level: 9 });
writeFileSync(out, packed);
let open = 0;
for (const p of rows.values()) for (const k of p.kind) if (k === K.EMPTY) open++;
console.log(`${frames} frames, ${S.stats.hauls} hauls, ${rows.size} pieces of world saved with ${open} open cells in them, ${S.grit} grit; ${packed.length} bytes written to ${out}`);
console.log(`saved fields: ${Object.keys(S).join(', ')}`);
