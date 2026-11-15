// The whole game played at random and checked after every frame (the verifiers' fuzz of the hunt's fixes, kept):
//   node test/regress/i-fuzz-play.mjs <seed> <turns> <reach level> <start x> <start y> <dt: 60|30|mix> [flags]
// flags (comma list): bombs, shop, home, forceshop, lowdrill, ram, pillars, known
// Steering only, or with trips home and throws, bombs, the shop. Checked: the tether (tetherFaults); the books of
// loose ground (every piece really cut off, one piece, no cell twice); the lasso (an island the tether is right
// round, found by flooding with none of the game's books, is reeled within two seconds); every haul (what is
// handed over is loose and wound, and pays what its banner says); money; and the drill (never in rock, never a
// jump, never far beyond its reach, never stuck: steered and still for two seconds it is steered eight ways, and
// must move or cut).
//
// One thing is counted and not failed: a drill hemmed in by lava (`hemmedByLava`). Lava is shut to it until it
// drains or sets, and at the very end of the reach the ways out are refused, so there it waits, 14 s in the
// longest seen. That is the hazard as it was designed, not a fault of the tether; whether lava should hold the
// drill at all is the owner's to say.
//
// test/all.mjs runs the flights in which the verifiers found something: 45 (a wreck wound and not reeled), 33
// (basalt that set in the open), 60 and 50 (stuck at the end of the reach), 57 (a bend hooked beyond the string's
// end), 39 (throws), 51 (bombs and the shop).
import { makeGame, random, tetherFaults, UPGRADES, C, N, K, world } from '../harness.mjs';

const argv = process.argv.slice(2);
const [seed = 30, turns = 300, reach = 5, sx = 0, sy = 0] = argv.slice(0, 5).map(Number);
const dtMode = argv[5] ?? '60', flags = new Set((argv[6] ?? '').split(',').filter(Boolean));
const HX = C + 0.5, HY = C + 0.5, HARD = world.HARD;
Math.random = random(seed + 5);
const lv = { tether: reach, drill: flags.has('lowdrill') ? 1 : 4 };
if (flags.has('bombs')) lv.bombs = 4;
if (flags.has('ram')) lv.momentum = 4;
const game = await makeGame(seed, lv);
const d = game.drill, w = game.world, rnd = random(seed * 7 + 1);
const rel = i => `${(i % N) - C},${Math.floor(i / N) - C}`;
const at = () => `${(d.x - HX).toFixed(2)},${(d.y - HY).toFixed(2)}`;

if (sx || sy) {
  const len = Math.hypot(sx, sy);
  for (let s = 0; s <= len; s += 0.5) for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) w.setK((C + Math.round(sy * s / len) + v) * N + C + Math.round(sx * s / len) + u, K.EMPTY);
  d.x = C + sx + 0.5; d.y = C + sy + 0.5; d.mode = 'free';
  game.band = [[d.x, d.y], [HX, HY]];
  game.changed();
}
// Staged, not natural: lone cells of bedrock near the core, which nothing cuts or hauls, so the band stays wound
// round them on the way home and through a throw.
if (flags.has('pillars')) {
  const most = Math.min(34, game.val('tether') * 0.7);
  for (let n = 0; n < 40; n++) {
    const a = rnd() * 6.283, r = 6 + rnd() * (most - 6), x = Math.round(Math.cos(a) * r), y = Math.round(Math.sin(a) * r);
    if (x >= 2 && x <= 7 && y >= -3 && y <= 2) continue;
    if ((sx || sy) && w.k((C + y) * N + C + x) === K.EMPTY) continue;      // never in the tunnel the band starts in
    w.setK((C + y) * N + C + x, K.BEDROCK);
  }
  game.changed();
}
// A/B: with 'known', every island of the world's own making within reach is put in the game's books before the
// flight, exactly as `discover` would put it there, to see whether being known is all that such an island lacks.
if (flags.has('known')) {
  const R = Math.min(240, game.val('tether')), seen = new Set(), bigKnown = new Set(); let n = 0;
  for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
    const i = (C + y) * N + C + x;
    if (seen.has(i) || w.k(i) === K.EMPTY || game.pieceOf.has(i)) continue;
    const cells = [i]; seen.add(i); let held = false;
    for (let h = 0; h < cells.length && !held; h++) for (const j of [cells[h] + 1, cells[h] - 1, cells[h] + N, cells[h] - N]) { if (seen.has(j)) { if (bigKnown.has(j)) held = true; continue; } if (w.k(j) === K.EMPTY) continue; if (cells.length >= 3000) { held = true; break; } seen.add(j); cells.push(j); }
    if (held) { for (const c of cells) bigKnown.add(c); continue; }
    game.pieces.push(cells); for (const c of cells) game.pieceOf.set(c, cells); n++;
  }
  game.loose = game.pieces.flat();
  console.log(`known: ${n} islands of the world's own making put in the books`);
}
// Every cell the game itself opens from here on: an island beside one of these was cut loose in play.
const openedInPlay = new Set(), setK0 = w.setK.bind(w);
const grownInPlay = new Set();
w.setK = (i, v) => { if (v === K.EMPTY) openedInPlay.add(i); else grownInPlay.add(i); setK0(i, v); };
if (flags.has('shop')) { game.S.grit = 5e6; game.S.gems = [0, 5000, 5000, 5000, 5000]; }

let frames = 0, clock = 0;
const kinds = new Map();
const note = (kind, detail) => {
  if (!kinds.has(kind)) { kinds.set(kind, 0); console.log(`frame ${frames} t=${clock.toFixed(2)} at ${at()}: ${kind}: ${detail}`); }
  kinds.set(kind, kinds.get(kind) + 1);
};
const stats = { hauls: 0, hauled: 0, biggest: 0, throws: 0, homes: 0, blasts: 0, buys: 0, shops: 0, maxBends: 0, maxPieces: 0, islandChecks: 0, woundSeen: 0, probes: 0, longestHeld: 0, maxHaulT: 0 };

// ---------------------------------------------------------------- winding
const winds = (x, y) => {
  const pts = game.band; let t = 0;
  for (let n = 0; n < pts.length; n++) {
    const a = pts[n], b = pts[(n + 1) % pts.length];
    if (a[1] <= y) { if (b[1] > y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) > 0) t++; }
    else if (b[1] <= y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) < 0) t--;
  }
  return t;
};
const wound = i => winds((i % N) + 0.5, Math.floor(i / N) + 0.5) !== 0;

// ---------------------------------------------------------------- money: every haul's banner against what it credits
let expectGrit = game.S.grit, expectGems = game.S.gems.slice(), haulsThisFrame = 0;
const haul0 = game.haul.bind(game);
game.haul = cells => {
  const g0 = game.S.grit, m0 = game.S.gems.slice(), p0 = game.pending.grit;
  // What is handed over: no cell twice, all of it ground, all of it wound, and nothing else hanging on it.
  const set = new Set(cells);
  if (set.size !== cells.length) note('haul: a cell handed over twice', `${cells.length - set.size} of ${cells.length}`);
  if (!cells.length) note('haul of nothing', '');
  let open = 0, unwound = 0, joined = 0;
  const stride = Math.max(1, Math.floor(cells.length / 4000));
  for (let n = 0; n < cells.length; n++) {
    const c = cells[n];
    if (w.k(c) === K.EMPTY) open++;
    for (const j of [c + 1, c - 1, c + N, c - N]) if (!set.has(j) && w.k(j) !== K.EMPTY) joined++;
    if (n % stride === 0 && game.band.length > 2 && !wound(c)) unwound++;
  }
  if (open) note('haul: open cells handed over', `${open} of ${cells.length}`);
  if (joined) note('haul: ground hauled that still hangs on other ground', `${joined} joins, ${cells.length} cells, first ${rel(cells[0])}`);
  if (unwound || game.band.length < 3) note('haul: ground hauled that the tether is not round', `${unwound} cells not wound of ${cells.length}, first ${rel(cells[0])}, bends ${game.band.length}`);
  haul0(cells);
  haulsThisFrame++;
  stats.hauls++; stats.hauled += cells.length; stats.biggest = Math.max(stats.biggest, cells.length);
  const b = game.hauled;
  if (!b) { note('haul: no banner', ''); return; }
  if (game.S.grit - g0 !== b.grit) note('haul: banner grit is not what was credited', `banner ${b.grit}, credited ${game.S.grit - g0}`);
  if (game.pending.grit - p0 !== b.grit) note('haul: banner grit is not what was put on its way', `banner ${b.grit}, pending ${game.pending.grit - p0}`);
  for (let g = 1; g < 5; g++) if (game.S.gems[g] - m0[g] !== b.gems[g]) note('haul: banner gems are not what was credited', `gem ${g}: banner ${b.gems[g]}, credited ${game.S.gems[g] - m0[g]}`);
  if (!Number.isFinite(b.grit) || b.grit < 0) note('haul: banner grit is not a sound number', `${b.grit}`);
  expectGrit += b.grit; for (let g = 1; g < 5; g++) expectGems[g] += b.gems[g];
};

// ---------------------------------------------------------------- the books of loose ground
const checked = new WeakMap();
let lastCuts = -1, lastPieces = null, booksAge = 0;
function books() {
  const pieces = game.pieces;
  stats.maxPieces = Math.max(stats.maxPieces, pieces.length);
  booksAge++;
  if (game.cuts === lastCuts && pieces === lastPieces && booksAge < 90) return;
  const full = booksAge >= 90 || game.cuts !== lastCuts;
  lastCuts = game.cuts; lastPieces = pieces; booksAge = 0;
  let total = 0;
  const all = new Set();
  for (const p of pieces) {
    total += p.length;
    if (!p.length) { note('books: an empty piece', ''); continue; }
    const set = new Set(p);
    if (set.size !== p.length) note('books: a cell twice in one piece', `${p.length - set.size}`);
    for (const c of p) { if (all.has(c)) { note('books: a cell in two pieces', rel(c)); break; } }
    for (const c of p) all.add(c);
    if (!full && checked.get(p) === game.cuts) continue;
    checked.set(p, game.cuts);
    let open = 0, joined = 0, hard = 0;
    for (const c of p) {
      const k = w.k(c);
      if (k === K.EMPTY) open++;
      if (k === K.BEDROCK || k === K.CORE) hard++;
      for (const j of [c + 1, c - 1, c + N, c - N]) if (!set.has(j) && w.k(j) !== K.EMPTY) joined++;
    }
    if (open) note('books: a piece holds open cells', `${open} of ${p.length}, first ${rel(p[0])}`);
    if (hard) note('books: a piece holds bedrock or core', `${hard} of ${p.length}`);
    if (joined) note('books: a piece is not cut off from the rest', `${joined} joins, ${p.length} cells, first ${rel(p[0])}`);
    // One piece of ground, not several: flood it from its first cell.
    const seen = new Set([p[0]]), q = [p[0]];
    for (let h = 0; h < q.length; h++) for (const j of [q[h] + 1, q[h] - 1, q[h] + N, q[h] - N]) if (set.has(j) && !seen.has(j)) { seen.add(j); q.push(j); }
    if (q.length !== set.size) note('books: a piece is several separate pieces', `${q.length} of ${set.size} reached from its first cell ${rel(p[0])}`);
    for (const c of p) if (game.pieceOf.get(c) !== p) { note('books: pieceOf does not say a cell is in its piece', rel(c)); break; }
  }
  if (game.pieceOf.size !== total) note('books: pieceOf holds other cells than the pieces', `${game.pieceOf.size} against ${total}`);
  if (game.loose.length !== total) note('books: the drawn loose list differs from the pieces', `${game.loose.length} against ${total}`);
}

// Islands under 3,000 cells near the drill and at the tether's bends, found by flooding, with none of the game's books.
const woundSince = new Map();
function islands() {
  stats.islandChecks++;
  const big = new Set(), seen = new Set(), out = [];
  const flood = start => {
    const cells = [start]; seen.add(start);
    let held = false;
    for (let h = 0; h < cells.length && !held; h++) {
      for (const j of [cells[h] + 1, cells[h] - 1, cells[h] + N, cells[h] - N]) {
        if (seen.has(j)) { if (big.has(j)) held = true; continue; }
        const k = w.k(j);
        if (k === K.EMPTY) continue;
        if (k === K.BEDROCK) { held = true; continue; }
        seen.add(j); cells.push(j);
        if (cells.length >= 3000) { held = true; break; }
      }
    }
    if (held) { for (const c of cells) big.add(c); return null; }
    return cells;
  };
  const starts = [];
  const dx = Math.floor(d.x), dy = Math.floor(d.y), R = 30;
  for (let y = dy - R; y <= dy + R; y++) for (let x = dx - R; x <= dx + R; x++) starts.push(y * N + x);
  const P = game.band;
  for (let n = 1; n + 1 < P.length && n < 300; n++) if (P[n][3] !== undefined) starts.push(P[n][3]);
  for (const i of starts) { if (seen.has(i) || w.k(i) === K.EMPTY) continue; if (w.k(i) === K.BEDROCK) { seen.add(i); big.add(i); continue; } const cells = flood(i); if (cells) out.push(cells); }
  return out;
}
let islandClock = 0;
function lasso(dt) {
  if (game.shop) return;
  islandClock += dt;
  if (islandClock < 0.1) return;
  const step = islandClock; islandClock = 0;
  if (game.band.length < 3) { woundSince.clear(); return; }
  const live = new Set();
  for (const cells of islands()) {
    if (!wound(cells[0]) || !cells.every(wound)) continue;
    let key = cells[0]; for (const c of cells) if (c < key) key = c;
    key = `${key}:${cells.length}`;
    live.add(key);
    const held = (woundSince.get(key) ?? 0) + step;
    woundSince.set(key, held);
    stats.woundSeen++;
    stats.longestHeld = Math.max(stats.longestHeld, held);
    if (held > 2.15 && held - step <= 2.15) {
      const known = game.pieceOf.has(cells[0]), ks = {};
      for (const c of cells) ks[w.k(c)] = (ks[w.k(c)] ?? 0) + 1;
      const touched = game.band.some(b => b[3] !== undefined && cells.includes(b[3]));
      const made = cells.some(c => openedInPlay.has(c + 1) || openedInPlay.has(c - 1) || openedInPlay.has(c + N) || openedInPlay.has(c - N));
      note(`lasso: an island the tether is right round was not reeled in 2 s (${known ? 'registered' : 'not registered'}, ${touched ? 'a bend lies on it' : 'the tether does not touch it'}, ${cells.some(c => grownInPlay.has(c)) ? 'ground that grew in play' : made ? 'cut loose in play' : 'as the world made it'})`,
        `${cells.length} cells at ${rel(cells[0])}, kinds ${JSON.stringify(ks)}, bends ${game.band.length}, mode ${d.mode}`);
    }
  }
  for (const key of [...woundSince.keys()]) if (!live.has(key)) woundSince.delete(key);
}

// ---------------------------------------------------------------- the drill
let pinned = null, thrownIn = 0;
const ring = () => { let around = ''; for (let v = -1; v <= 1; v++) { for (let u = -1; u <= 1; u++) { const j = (Math.floor(d.y) + v) * N + Math.floor(d.x) + u; around += w.lava.has(j) ? 'L' : w.k(j).toString(16); } around += '/'; } return around; };
let overlap = 0, anchor = [d.x, d.y], heldFor = 0, digs = 0, anchorDigs = 0;
const dig0 = game.finishDig.bind(game);
game.finishDig = i => { digs++; dig0(i); };
const BODY = 0.34;
function drillCheck(dt, steering, before) {
  if (!Number.isFinite(d.x) || !Number.isFinite(d.y)) { note('drill: its place is not a number', `${d.x},${d.y}`); return; }
  const i = Math.floor(d.y) * N + Math.floor(d.x);
  if (w.k(i) !== K.EMPTY) note('drill: its middle is inside rock', `kind ${w.k(i)} at ${rel(i)}, mode ${d.mode}`);
  let over = false;
  for (const [u, v] of [[-BODY, -BODY], [BODY, -BODY], [-BODY, BODY], [BODY, BODY]]) if (w.k(Math.floor(d.y + v) * N + Math.floor(d.x + u)) !== K.EMPTY) over = true;
  overlap = over && d.mode === 'free' && before.mode === 'free' ? overlap + 1 : 0;
  // A thrown drill flies the line of the drag whatever lies beside it: how often its body is in rock on the way.
  if (over && d.mode !== 'free') { thrownIn++; stats.thrownThroughRockFrames = (stats.thrownThroughRockFrames ?? 0) + 1; if (thrownIn > (stats.thrownThroughRockLongest ?? 0)) { stats.thrownThroughRockLongest = thrownIn; stats.thrownThroughRockAt = `frame ${frames}, ${at()}, mode ${d.mode}`; } } else thrownIn = 0;
  if (overlap === 3) note('drill: its body lies in rock for three frames running', `mode ${d.mode}`);
  const far = Math.hypot(d.x - HX, d.y - HY), R = game.val('tether');
  // How long the drill stands on one spot beyond its reach, and what was round it when that began and ended.
  if (far > R + 0.02 && d.x === before.x && d.y === before.y && d.mode === 'free') {
    if (!pinned) pinned = { since: clock, frame: frames, blasts: stats.blasts, steered: 0, around: ring(), by: far - R };
    if (steering) pinned.steered += dt;
  } else if (pinned) {
    if (pinned.steered > 2) console.log(`  pinned beyond reach by ${pinned.by.toFixed(2)} from frame ${pinned.frame} for ${(clock - pinned.since).toFixed(1)} s (${pinned.steered.toFixed(1)} s of it steered); round it then ${pinned.around}, now ${ring()}; blasts meanwhile ${stats.blasts - pinned.blasts}; now at ${at()}`);
    stats.longestPinned = +Math.max(stats.longestPinned ?? 0, pinned.steered).toFixed(1);
    pinned = null;
  }
  if (far > R + 0.02) stats.mostBeyondReach = +Math.max(stats.mostBeyondReach ?? 0, far - R).toFixed(3);
  if (far > R + 0.45) {
    let around = '';
    for (let v = -1; v <= 1; v++) { for (let u = -1; u <= 1; u++) { const j = (Math.floor(d.y) + v) * N + Math.floor(d.x) + u; around += w.lava.has(j) ? 'L' : w.k(j).toString(16); } around += '/'; }
    note('drill: beyond its reach', `${far.toFixed(2)} of ${R}; the frame before it was at ${(before.x - HX).toFixed(2)},${(before.y - HY).toFixed(2)} (${Math.hypot(before.x - HX, before.y - HY).toFixed(2)} out), mode ${before.mode} to ${d.mode}, shop ${game.shop}; cells round it (lava L) ${around}`);
  }
  // A move no flight makes: free flight goes at most its top speed, a throw at its own.
  const moved = Math.hypot(d.x - before.x, d.y - before.y), top = before.mode === 'free' ? 9 * game.val('momentum') * 11.1 : Math.max(60, d.speed, before.speed);
  if (moved > top * dt * 1.05 + 1.0) note('drill: it jumped', `${moved.toFixed(2)} cells in a frame of ${dt.toFixed(4)} s, mode ${before.mode} to ${d.mode}`);
  // Stuck: steered for two seconds, free, awake, and it has neither moved nor cut.
  if (!steering || game.shop) { heldFor = 0; anchor = [d.x, d.y]; anchorDigs = digs; }
  else if (Math.hypot(d.x - anchor[0], d.y - anchor[1]) > 0.3 || digs !== anchorDigs) { heldFor = 0; anchor = [d.x, d.y]; anchorDigs = digs; }
  else heldFor += dt;
}
// Steered and still for two seconds: can it go anywhere at all? Eight ways, a second and a half each.
function probe(dtOf) {
  stats.probes++;
  const from = [d.x, d.y], cuts = digs, state = `stun ${d.stun.toFixed(2)}, mode ${d.mode}, dig ${d.dig >= 0 ? rel(d.dig) + ' kind ' + w.k(d.dig) : 'none'}, park ${!!d.park}, far ${Math.hypot(d.x - HX, d.y - HY).toFixed(1)} of ${game.val('tether')}`;
  let around = '';
  for (let v = -1; v <= 1; v++) { for (let u = -1; u <= 1; u++) { const j = (Math.floor(d.y) + v) * N + Math.floor(d.x) + u; around += w.lava.has(j) ? 'L' : w.k(j).toString(16); } around += '/'; }
  let t = 0;
  // Toward the core first (the reach never forbids that), then round from there.
  const home = Math.atan2(HY - d.y, HX - d.x);
  for (const turn of [0, 1, -1, 2, -2, 3, -3, 4]) {
    const a = home + turn * Math.PI / 4;
    for (let t1 = 0; t1 < 1.5;) {
      const dt = dtOf(); t1 += dt; t += dt;
      game.input.auto = [Math.cos(a), Math.sin(a), 1];
      step(dt, true, false);
      if (Math.hypot(d.x - from[0], d.y - from[1]) > 0.5 || digs !== cuts) {
        stats.longestStill = +Math.max(stats.longestStill ?? 0, 2 + t).toFixed(2);
        if (t > 1.5) { stats.heldTowardHome = (stats.heldTowardHome ?? 0) + 1; if (!stats.heldExample) stats.heldExample = `${state}; round it ${around}`; }
        return true;
      }
    }
  }
  if (around.includes('L')) { stats.hemmedByLava = (stats.hemmedByLava ?? 0) + 1; return false; }
  note('drill: stuck: steered eight ways for 12 s it neither moved nor cut', `${state}; cells round it (lava L) ${around}`);
  return false;
}

// ---------------------------------------------------------------- one frame, checked
function step(dt, steering, mayProbe = true) {
  const before = { x: d.x, y: d.y, mode: d.mode, speed: d.speed }, g0 = game.S.grit, shown0 = game.banked(), shop = game.shop;
  haulsThisFrame = 0;
  const e0 = expectGrit;
  try { game.update(dt); } catch (e) { note('threw', e.stack.split('\n').slice(0, 5).join(' | ')); }
  frames++; if (!shop) clock += dt;
  stats.maxBends = Math.max(stats.maxBends, game.band.length);
  for (const f of tetherFaults(game)) note('tether: ' + f.replace(/[-\d.(),]+/g, '#'), `${f}\n  band: ${JSON.stringify(game.band.slice(0, 8).map(p => [+(p[0] - HX).toFixed(2), +(p[1] - HY).toFixed(2), p[2] ?? 0]))}`);
  books();
  lasso(dt);
  drillCheck(dt, steering && d.stun <= 0 && d.mode === 'free' && !d.park, before);
  // Money.
  const S = game.S, trick = Math.ceil(Math.max(1, game.val('tether') / 2 / 12));
  const extra = S.grit - g0 - (expectGrit - e0);
  if (extra !== 0 && extra !== trick) note('money: grit changed by something that is neither a haul nor the trickle', `${extra} (trickle is ${trick}), hauls this frame ${haulsThisFrame}`);
  expectGrit += extra;
  if (!Number.isFinite(S.grit) || S.grit < 0) note('money: grit is not a sound number', `${S.grit}`);
  for (let g = 0; g < 5; g++) if (!Number.isFinite(S.gems[g]) || S.gems[g] < 0) note('money: gems are not sound numbers', `${S.gems}`);
  if (!Number.isFinite(game.pending.grit) || game.pending.grit < 0) note('money: grit on its way is not a sound number', `${game.pending.grit}`);
  if (game.banked() < 0) note('money: banked grit below nothing', `${game.banked()}`);
  for (let g = 1; g < 5; g++) if (!(game.banked(g) >= 0) || !(game.pending.gems[g] >= 0)) note('money: banked gems below nothing', `gem ${g}: ${game.banked(g)}, pending ${game.pending.gems[g]}`);
  if (game.banked() < shown0 - 1e-9) note('money: the grit shown went down with nothing bought', `${shown0} to ${game.banked()}`);
  if (!game.hauls.length && (game.pending.grit !== 0 || game.pending.gems.some(Boolean))) note('money: something still on its way with no haul in flight', JSON.stringify(game.pending));
  if (game.hauls.length) {
    let left = 0;
    for (const h of game.hauls) { left += h.left; if (h.doneAt === undefined) { stats.maxHaulT = Math.max(stats.maxHaulT, h.t); if (h.t > 40) note('money: a haul has run over 40 s', `${h.n} cells, paid ${h.paid} of ${h.total}, route ${(h.length / 16).toFixed(0)} cells, v ${h.v.toFixed(0)}`); } }
    if (Math.abs(left - game.pending.grit) > 1e-6) note('money: grit on its way is not what the hauls in flight still owe', `pending ${game.pending.grit}, hauls owe ${left}`);
    if (game.hauls.length > 1) stats.mostHauls = Math.max(stats.mostHauls ?? 0, game.hauls.length);
  }
  if (S.grit !== expectGrit) { note('money: grit is not the sum of what the banners said', `${S.grit} against ${expectGrit}`); expectGrit = S.grit; }
  if (mayProbe && heldFor > 2) { heldFor = 0; const keep = game.input.auto; probe(nextDt); game.input.auto = keep; anchor = [d.x, d.y]; heldFor = 0; }
}
const nextDt = () => dtMode === '30' ? 1 / 30 : dtMode === 'mix' ? (rnd() < 0.05 ? 0.05 : 1 / 144 + rnd() * (0.05 - 1 / 144)) : 1 / 60;

// ---------------------------------------------------------------- the flight
function buySome() {
  for (const u of UPGRADES) {
    if (u.id === 'tether' || rnd() > 0.35) continue;
    const c = game.cost(u), can = game.canBuy(u), g0 = game.S.grit, m0 = game.S.gems[u.gem], l0 = game.S.lv[u.id];
    game.buy(u);
    if (can) { stats.buys++; expectGrit -= c.grit; expectGems[u.gem] -= c.gems; if (game.S.lv[u.id] !== l0 + 1 || game.S.grit !== g0 - c.grit || game.S.gems[u.gem] !== m0 - c.gems) note('money: a purchase took something other than its price', `${u.id}`); }
    else if (game.S.lv[u.id] !== l0 || game.S.grit !== g0) note('money: something was bought that could not be afforded', `${u.id}`);
    if (game.banked() < 0 || game.banked(u.gem) < 0) note('money: buying left the bank below nothing', `${u.id}: ${game.banked()} ${game.banked(u.gem)}`);
  }
}
// Fly to the core (cutting straight at it), then throw from its middle with whatever the band is wound round.
function tripHome() {
  let got = false;
  for (let f = 0; f < 6000; f++) {
    const dx = HX - d.x, dy = HY - d.y, far = Math.hypot(dx, dy);
    if (far < 0.05 && d.mode === 'free') { got = true; break; }
    game.input.auto = far < 0.3 && d.mode === 'free' ? [dx / (far || 1), dy / (far || 1), 0.2] : [dx / (far || 1), dy / (far || 1), 1];
    step(nextDt(), true);
    if (d.park) { got = true; break; }
  }
  if (!got) { stats.homeFailed = (stats.homeFailed ?? 0) + 1; return; }
  stats.homes++;
  stats.bendsHome = Math.max(stats.bendsHome ?? 0, game.band.length);
  game.input.auto = null;
  for (let f = 0; f < 2 + Math.floor(rnd() * 20); f++) step(nextDt(), false);
  if (flags.has('shop') && rnd() < 0.7) {
    game.key('KeyU', true);
    if (!game.shop) note('shop: would not open at the core', `far ${game.far}`);
    stats.shops++;
    for (let f = 0; f < Math.floor(rnd() * 120); f++) { step(nextDt(), false); if (f % 9 === 0) buySome(); }
    buySome();
    game.key('Escape', true);
  }
  if (flags.has('bombs') && game.bombs !== game.val('bombs')) stats.bombsNotRefilled = (stats.bombsNotRefilled ?? 0) + 1;
  // The throw: a fresh stroke at any angle.
  const a = rnd() * 6.283;
  game.pointerDown(1, 180, 400); game.pointerMove(1, 180 + Math.cos(a) * 40, 400 + Math.sin(a) * 40);
  const b0 = game.band.length;
  step(nextDt(), true);
  if (d.mode === 'fling') {
    stats.throws++; stats.thrownWound = (stats.thrownWound ?? 0) + (b0 > 2 ? 1 : 0);
    // The shop opened and shut in the middle of the throw (the key works while the drill is still over the core).
    if (flags.has('shop') && rnd() < 0.5) { game.key('KeyU', true); if (game.shop) { stats.shopsMidThrow = (stats.shopsMidThrow ?? 0) + 1; for (let f = 0; f < 1 + Math.floor(rnd() * 200); f++) step(nextDt(), false); game.key('Escape', true); } }
    for (let f = 0; f < 400 && d.mode === 'fling'; f++) step(nextDt(), true);
  }
  for (let f = 0; f < Math.floor(rnd() * 40); f++) step(nextDt(), true);
  game.pointerUp(1);
}

let heading = rnd() * 6.283;
for (let turn = 0; turn < turns; turn++) {
  heading += (rnd() - 0.5) * 2.5;
  const hold = 10 + Math.floor(rnd() * 50), pause = rnd() < 0.1;
  for (let f = 0; f < hold; f++) {
    game.input.auto = pause ? null : [Math.cos(heading), Math.sin(heading), 1];
    step(nextDt(), !pause);
    if (flags.has('bombs') && rnd() < 0.004) { if (game.bombs <= 0 && !flags.has('home')) game.bombs = game.val('bombs'); if (game.bombs > 0) { game.blast(); stats.blasts++; books(); for (const f2 of tetherFaults(game)) note('tether after a blast: ' + f2.replace(/[-\d.(),]+/g, '#'), f2); } }
    if (flags.has('forceshop') && rnd() < 0.003) { game.shop = true; stats.shops++; for (let k = 0; k < 1 + Math.floor(rnd() * 90); k++) step(nextDt(), false); buySome(); game.shop = false; }
  }
  if (flags.has('home') && turn % 23 === 11) tripHome();
  if (flags.has('shop') && !flags.has('home') && game.atCore && rnd() < 0.5) { game.key('KeyU', true); if (game.shop) { stats.shops++; for (let k = 0; k < Math.floor(rnd() * 60); k++) step(nextDt(), false); buySome(); game.key('Escape', true); } }
}
// Let go and wait: every haul comes home, and nothing is left on its way.
game.input.auto = null;
for (let f = 0; f < 3600 && game.hauls.length; f++) step(1 / 60, false);
if (game.hauls.length) note('money: hauls never ended', `${game.hauls.length}`);
if (game.pending.grit || game.pending.gems.some(Boolean)) note('money: something left on its way at the end', JSON.stringify(game.pending));
for (let g = 1; g < 5; g++) if (game.S.gems[g] !== expectGems[g]) note('money: gems are not the sum of what the banners said', `gem ${g}: ${game.S.gems[g]} against ${expectGems[g]}`);
stats.longestHeld = +stats.longestHeld.toFixed(2); stats.maxHaulT = +stats.maxHaulT.toFixed(1);
console.log(JSON.stringify({ seed, turns, reach, start: [sx, sy], dt: dtMode, flags: [...flags].join(','), frames, seconds: +clock.toFixed(0), at: at(), bends: game.band.length, ...stats, problems: Object.fromEntries(kinds) }));
process.exit(kinds.size ? 1 : 0);
