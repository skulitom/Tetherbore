// The corners' four gems (js/world.js: G, CORNER_GEM), paid and spent. Held here, on world 7:
//   (a) a block of each deep seam's rich ore pays its corner's gems and nothing else, ten to a cell; its common ore
//       its first parent's alone;
//   (b) every other ground pays as it did: no other row's ores pay a corner's gem, and the shallow seams' rich ores
//       their second parents' (the east's, the south's, the west's and the north's), as a block of each hauled says;
//   (c) a save made before there were places for them loads with nine, its four gems where they were;
//   (d) a haul of the north east's gems is on its way and then banked, every count a number and none less than
//       nothing, and nothing is left on its way once it is home;
//   (e) the eight levels paid in them (js/shop.js: LATE) ask for them, as written; a game with every direction's gems
//       and none of the corner's is refused, and one with that corner's buys and pays them;
//   (f) a shrine hauled pays SHRINE_GEMS of its corner's gems on top of what its cells pay, not cut by the gem cutter,
//       and held makes its corner's gems SHRINE_OWN times as many and no other corner's, and is not paid for again
//       when a world laid again from its seed stands it again;
//   (g) the bar shows the corners' gems (`cornerBar`) while a corner's level is saved for and out on a diagonal past
//       CORNER_BAR cells, and not at home, on an axis or nearer in;
//   (i) a deep seam, and so a corner's gem, is had from no nearer than 800 cells, DEEP_R less a hundred, and some
//       nearer than the shop's 900;
//   (h) the station's colours of the gems (js/fit.js) are the screen's (js/drawing.js).
// Each fails on the game before the corners' gems were paid: the deep seams' rich ores paid their second parents'.
//   node test/regress/e-corner-gems.mjs
import { makeGame, Game, world, C, N, K, B } from '../harness.mjs';
const { G, GEM_N, CORNER_GEM, SEAMS, SHRINES, BIOMES, gemKin } = world;
const { SHRINE_GEMS, SHRINE_OWN, CORNER_KINS } = await import('../../js/game.js');
const { GEM_COLOR, CORNER_BAR } = await import('../../js/drawing.js');
const fit = await import('../../js/fit.js');
const { ROWS } = await import('../../js/shop.js');

const fails = [], check = (ok, what) => { if (!ok && fails.length < 30) fails.push(what); };
const game = await makeGame(7, { tether: 8 }), w = game.world, S = game.S;
// A block of 6 by 4 cells of kind `k` in ground `id`, 600 cells out to the east, paid as cells beside the haul.
const block = (id, k) => { const out = []; for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) out.push({ k, b: id, x: C + 600 + x, y: C + y }); return out; };
const only = (gems, g) => gems.every((n, b) => b === g ? n > 0 : n === 0);

// (a) and (b)
SEAMS.forEach(([shallow, deep], c) => {
  const row = BIOMES[deep], rich = game.payOf([], block(deep, K.ORE_B)).gems, common = game.payOf([], block(deep, K.ORE_A)).gems;
  check(row.gemB === CORNER_GEM[c] && only(rich, CORNER_GEM[c]) && rich[CORNER_GEM[c]] === 24 * 10, `${row.name}'s rich ore pays gems ${rich}, not 240 of gem ${CORNER_GEM[c]} alone`);
  check(only(common, row.gemA) && row.gemA === CORNER_KINS[c][0], `${row.name}'s common ore pays gems ${common}, not its first parent's (${row.gemA}) alone`);
  const was = [B.LODE, B.EMBER, B.MIRE, B.FROST][c], paid = game.payOf([], block(shallow, K.ORE_B)).gems;
  check(BIOMES[shallow].gemB === was && only(paid, was), `${BIOMES[shallow].name}'s rich ore pays gems ${paid}, not its second parent's (${was}) alone`);
});
const other = BIOMES.filter(r => r && !(r.seam != null && r.deep)).filter(r => [K.ORE_A, K.ORE_B].some(k => gemKin(k, r) >= 5));
check(!other.length, `grounds other than the deep seams pay a corner's gems: ${other.map(r => r.name)}`);
for (let b = 1; b <= 8; b++) { const paid = game.payOf([], block(b, K.ORE_B)).gems; check(only(paid, BIOMES[b].kin), `ground ${b}'s rich ore pays gems ${paid}`); }

// (c) A save of five places: its four gems where they were, and the corners' none.
{
  const fresh = await makeGame(11);
  fresh.save();
  const kept = JSON.parse(localStorage.getItem('tetherbore-save-v3'));
  kept.gems = [0, 11, 22, 33, 44];
  localStorage.setItem('tetherbore-save-v3', JSON.stringify(kept));
  const store = { put() {}, clear() {}, openCursor() { const request = {}; queueMicrotask(() => { request.result = null; request.onsuccess?.(); }); return request; } };
  const had = globalThis.indexedDB;
  globalThis.indexedDB = { open() { const request = {}; queueMicrotask(() => { request.result = { transaction: () => ({ objectStore: () => store }) }; request.onsuccess?.(); }); return request; } };
  const canvas = { width: 0, height: 0, style: {}, getContext: () => new Proxy({}, { get: () => () => ({ data: new Uint8ClampedArray(4) }), set: () => true }) };
  const again = new Game(canvas);
  const loaded = await again.restore();
  globalThis.indexedDB = had;
  check(loaded && JSON.stringify(again.S.gems) === '[0,11,22,33,44,0,0,0,0]' && again.pending.gems.length === GEM_N && again.banked(G.NW) === 0, `a save of five places loaded ${loaded}, with gems ${JSON.stringify(again.S.gems)}`);
  localStorage.removeItem('tetherbore-save-v3');
}

// (d) The north east's gems hauled 40 cells out, on their way and home.
{
  const cells = [];
  for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) { const i = (C + 10 + y) * N + C + 40 + x; w.setK(i, K.ORE_B); w.setB(i, SEAMS[0][1]); cells.push(i); }
  const had = S.gems.slice();
  game.haul(cells);
  const sound = () => S.gems.length === GEM_N && game.pending.gems.length === GEM_N && S.gems.every(Number.isFinite) && game.pending.gems.every(Number.isFinite) && S.gems.every((_, g) => game.banked(g) >= 0);
  check(sound() && S.gems[G.NE] - had[G.NE] === 120 && game.pending.gems[G.NE] === 120 && game.banked(G.NE) === had[G.NE], `on its way: gems ${S.gems}, on the way ${game.pending.gems}`);
  let ok = true;
  for (let f = 0; f < 1800 && game.hauls.length; f++) { game.update(1 / 60); if (!sound()) ok = false; }
  check(ok && !game.hauls.length && game.pending.gems.every(g => g === 0) && game.banked(G.NE) === S.gems[G.NE] && S.gems[G.NE] === had[G.NE] + 120, `home: gems ${S.gems}, on the way ${game.pending.gems}, ${game.hauls.length} hauls out`);
}

// (e) The eight levels and their prices.
{
  const want = { drill: [8, 75000, G.NE], scanner: [13, 40000, G.NE], momentum: [2.8, 30000, G.SE], hull: [12, 75000, G.SE], blackbox: [0.9, 35000, G.SW], lamp: [18, 60000, G.SW], maprange: [10, 25000, G.NW], winch: [5, 80000, G.NW] };
  const moved = ROWS.flatMap(u => (u.gemAt ?? []).map((g, l) => [u, l, g]).filter(([, , g]) => g >= 5));
  check(moved.length === 8 && moved.every(([u, l]) => want[u.id] && u.values[l + 1] === want[u.id][0]), `the levels paid in a corner's gems: ${moved.map(([u, l]) => `${u.id} ${u.values[l + 1]}`)}`);
  for (const [id, [value, gems, gem]] of Object.entries(want)) {
    const u = ROWS.find(r => r.id === id), l = u.values.indexOf(value) - 1;
    S.lv[id] = l; S.out = 3000; S.relics = [1, 1, 1, 1]; S.wrecks = new Array(8).fill(1); S.lab = {};
    for (let n = 0; n < 40; n++) S.met[`place-${n}`] = 1;
    S.grit = 1e12; game.pending.grit = 0; game.pending.gems.fill(0);
    const c = game.cost(u);
    check(c && c.gem === gem && c.gems === gems && c.grit === u.grit[l], `${u.name} ${value} costs ${JSON.stringify(c)}, not ${gems} of gem ${gem}`);
    // (Every level before it, and a level of the row's own gems where it has another after, as they were.)
    check(u.gemAt?.every((g, n) => n === l ? g === gem : g === u.gem), `${u.name}'s levels are paid in gems ${u.gemAt ?? u.gem}`);
    for (let g = 1; g < GEM_N; g++) S.gems[g] = g === gem ? 0 : 1e9;
    check(!game.canBuy(u), `${u.name} ${value} can be bought with none of gem ${gem}`);
    game.buy(u);
    check(S.lv[id] === l && game.shopNote?.text === `GEMS: ${['', '', '', '', '', 'NORTH EAST', 'SOUTH EAST', 'SOUTH WEST', 'NORTH WEST'][gem]}, PAST 900`, `${u.name} ${value} tapped with none of gem ${gem}: level ${S.lv[id]}, '${game.shopNote?.text}'`);
    S.gems[gem] = gems + 5;
    check(game.canBuy(u), `${u.name} ${value} cannot be bought with ${gems + 5} of gem ${gem}: ${game.lacks(u)}`);
    const before = S.gems.slice();
    game.buy(u);
    check(S.lv[id] === l + 1 && S.gems[gem] === 5 && S.gems.every((n, g) => g === gem || n === before[g]), `${u.name} ${value} bought: level ${S.lv[id]}, gems ${S.gems}`);
  }
}

// (f) A shrine: its lump of its corner's gems, uncut, and its own corner's made more for good.
{
  const g2 = await makeGame(7, { tether: 8 }), w2 = g2.world, S2 = g2.S, [sx, sy] = SHRINES[0], cells = [];
  for (let y = C + sy - 5; y <= C + sy + 5; y++) for (let x = C + sx - 5; x <= C + sx + 5; x++) if (w2.at(x, y) !== K.EMPTY) cells.push(y * N + x);
  const plain = g2.payOf(cells);
  S2.lv.cutter = 4;
  const cut = g2.payOf(cells), by = g2.val('cutter');
  S2.lv.cutter = 0;
  const own = plain.gems[G.NE] - SHRINE_GEMS;
  check(plain.shrine === 0 && own > 0 && Math.abs(cut.gems[G.NE] - SHRINE_GEMS - own * by) <= 1 && [G.SE, G.SW, G.NW].every(g => plain.gems[g] === 0), `the north east's shrine pays ${plain.gems[G.NE]} of its gems (${own} its cells'), and with the cutter at x${by} ${cut.gems[G.NE]}`);
  const had = S2.gems[G.NE];
  g2.haul(cells);
  check(S2.gems[G.NE] - had === plain.gems[G.NE] && S2.shrines[0] === 1 && g2.popups.some(p => p.label === '+10K' && p.icon === 'gem-ne'), `the shrine hauled banked ${S2.gems[G.NE] - had} of the north east's gems, held ${S2.shrines}, and said ${g2.popups.map(p => `${p.label} ${p.icon}`)}`);
  const ore = SEAMS.flatMap(([, deep]) => block(deep, K.ORE_B));
  const gems = held => { S2.shrines = held; return g2.payOf([], ore).gems; };
  const none = gems([0, 0, 0, 0]), ne = gems([1, 0, 0, 0]);
  check(CORNER_GEM.every(g => none[g] === 240) && Math.abs(ne[G.NE] - none[G.NE] * SHRINE_OWN) <= 1 && [G.SE, G.SW, G.NW].every(g => ne[g] === none[g]), `with the north east's shrine held the corners' gems are ${ne.slice(5)}, with none ${none.slice(5)}`);
  // A shrine held is paid for once a game: where the ground could not be kept (the harness's store opens on nothing,
  // as a private window's may), the game loads on its world laid again from the seed, the shrine standing again, and
  // its heart hauled again pays its cell and no 10,000, no lump and no specimens.
  S2.shrines = [1, 0, 0, 0];
  for (let f = 0; f < 1800 && g2.hauls.length; f++) g2.update(1 / 60);
  g2.save();
  await new Promise(r => setTimeout(r, 50));
  const loaded = await g2.restore(), heart = (C + sy) * N + C + sx, laid = g2.world.k(heart) === K.RELIC, again = g2.payOf([heart]);
  check(loaded && g2.S.shrines[0] === 1 && laid && again.shrine < 0 && !again.shrines.length && again.gems.every(n => n === 0) && again.lump === 0 && again.spec.every(n => n === 0),
    `the north east's shrine held, loaded ${loaded} on a world laid again (its heart a relic: ${laid}), and hauled again pays shrine ${again.shrine}, gems ${again.gems}, lump ${again.lump}, specimens ${again.spec}`);
}

// (g) Where the bar shows the corners.
{
  const g3 = await makeGame(7), d = g3.drill, at = (x, y) => { d.x = C + 0.5 + x; d.y = C + 0.5 + y; return g3.cornerBar?.(); };
  g3.goal = undefined;
  check(!at(0, 0) && !at(0, -1200) && !at(1200, 0) && !at(500, 500) && !at(900, -400), 'the bar shows the corners at home, on an axis or nearer in');
  check(at(700, -700) && at(-900, 760) && at(-1600, -1500) && at(1300, 1100), 'the bar does not show the corners far out on a diagonal');
  check(CORNER_BAR > 800 && CORNER_BAR < 900, `the corners are shown from ${CORNER_BAR} cells out`);
  at(0, 0);
  const u = ROWS.find(r => r.id === 'momentum'), S3 = g3.S;
  S3.lv.momentum = u.values.indexOf(2.8) - 1; S3.out = 3000; S3.grit = 0;
  g3.buy(u);
  check(g3.goal.id === 'momentum' && g3.goal.gem === G.SE && g3.cornerBar?.(), `with the ram's x2.8 saved for, at home, the goal is ${g3.goal.id} in gem ${g3.goal.gem} and the bar shows the corners: ${g3.cornerBar?.()}`);
}

// (i) How near the corners' gems are had: a deep seam begins where its noise has it, from a hundred cells inside DEEP_R
// (js/world.js: `biomeAt`), so none of its cells lies nearer than 800, and on world 7 some lie nearer than 900, past
// which the shop says they are had (GEM_PAST: about where, not the least).
{
  const { DEEP_R, GEM_PAST } = world, near = [];
  SHRINES.forEach(([sx, sy], c) => {
    let least = Infinity;
    for (let r = DEEP_R - 160; r <= DEEP_R; r++) for (let a = -0.2; a <= 0.2; a += 0.4 / r) {
      const t = Math.atan2(sy, sx) + a, x = C + Math.round(r * Math.cos(t)), y = C + Math.round(r * Math.sin(t));
      if (w.biomeAt(x, y) === SEAMS[c][1]) least = Math.min(least, Math.hypot(x - C, y - C));
    }
    near.push(Math.round(least));
  });
  check(near.every(r => r >= DEEP_R - 100) && Math.min(...near) < GEM_PAST[G.NE] && CORNER_GEM.every(g => GEM_PAST[g] === DEEP_R), `the deep seams' nearest cells within ${DEEP_R} on world 7 lie ${near} cells out, the shop saying past ${GEM_PAST.slice(5)}`);
}

// (h)
check(JSON.stringify(fit.GEM_COLOR) === JSON.stringify(GEM_COLOR) && GEM_COLOR.length === GEM_N, `the station's gems' colours are ${fit.GEM_COLOR}, the screen's ${GEM_COLOR}`);

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : 'ok: the deep seams\' rich ores pay their corners\' gems and nothing else does, the eight levels ask for them, a shrine pays and multiplies its own, and the bar shows them where they matter');
process.exit(fails.length ? 1 : 0);
