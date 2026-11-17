// A whole game played with no hand on it and no browser, from a new game on, to see how the money goes: what is
// banked, bought and met over the first forty minutes and more.
//   node tools/long-play.mjs [--seed 7] [--minutes 40] [--every 120] [--fauna] [--all] [--hull]
//
// With `--fauna` the game has its creatures (js/fauna.js), as it is played: what they knocked, slowed, chilled and
// plugged, what they showed, the pal, and what the pufflings caught paid beside everything earned.
//
// With `--all` the pilot shops in all four tabs (RIG, WORKS, MAP and CORE) and not in the first alone; and what held
// each level up once its grit was in hand is counted, a second at a time, in a table (BLOCKERS). The first tab alone
// is what the tests have always flown, and stays the plain policy; but the other three tabs are most of the shop
// from twenty minutes on (CORE alone is most of what is spent in the first hour), and a balance judged without
// them is judged on a game nobody plays.
//
// With `--hull` the hull takes harm as it does in play (`makeGame`'s `hull`): a drill wrecked goes back to the last
// docking with the game, the pilot gives up the trip it was on, takes its thumb off (a drill wound home leaves on a
// fresh stroke) and goes out again. Without it a blow takes no pip, as in every flight written before the hull.
//
// The policy is a simple one, and no cleverer than a player in a hurry:
//   - At the core it buys whatever can be bought, reach first and then the cheapest.
//   - A trip goes out along one of twelve spokes (the four directions and thirty degrees to either side of each),
//     the directions taken in turn, unless a level that the grit is there for wants gems: then to that gem's ground
//     (the reach's gems before any other level's).
//   - Out there it cuts a square ring round a block and flies the ring shut, so the block comes home: a block about
//     a third of the reach across, 48 cells at the most (the loop the game's prices are worked out from), from four
//     tenths of the reach out, each block beyond the last on its spoke. Up to three blocks a trip; home sooner when
//     what has been hauled will buy something.
//   - Once the reach goes round the first keystone slab it cuts a ring round that, slab, crack and keys. Every
//     fourth trip goes to the nearest pocket not yet visited that the reach goes round, and cuts a ring two thirds
//     of its radius about its middle.
// It never goes for a wreck or a relic and never cuts round a single lump of ore, and it
// flies straight at where it is going, cutting what is in the way and stepping aside when it is held up.
//
// What is printed: a line every `--every` seconds of the game's time (what is owned, banked and has been earned,
// what the last stretch earned a second beside the model's income for that reach, gems and specimens of each
// direction, how far out the last block was), then when each level was bought, when each ground, pocket and find
// was first met, and the two things the owner asked about: how long grit lay banked with nothing to spend it on,
// and how long a level was held up for gems alone, and on what reach. Then the three longest stretches with nothing
// bought, what was earned a second in each ten minutes beside the model's income for the reach then (`income`), what
// held each level up with its grit in hand (gems or specimens of which direction, or which need), and a last line of
// what had been gathered and found: specimens, cells out, kinds analysed, places met, wreck parts, creatures met.
// `play` returns all of it (`each`, if given, is called after every frame with the game and the time: a test's way
// in). The same seed and length give the same game. It is called as `play(seed, minutes, every, each, fauna)`, or
// `play(seed, minutes, { every, each, fauna, all, hull })`.
import { fileURLToPath } from 'node:url';
import { makeGame, random, UPGRADES, WORKS, MAPS, CORE, income, C, N, K, world } from '../test/harness.mjs';

const { HARD, rowOf } = world;
// (Whose gems, by their numbers: the four directions' and the four corners'.)
const WAYS = ['', 'north', 'south', 'west', 'east', 'north east', 'south east', 'south west', 'north west'];
// The gems banked as they are printed: the four directions', and the corners' after them once there are any.
const gemsSaid = gems => gems.slice(1, 5).join('/') + (gems.slice(5).some(Boolean) ? ` +${gems.slice(5).join('/')}` : '');
// The twelve spokes: [x, y, whose direction]. (0.866 and 0.5: thirty degrees off the direction's own line.)
const SPOKES = [[0, -1, 1], [0.5, -0.866, 1], [-0.5, -0.866, 1], [0, 1, 2], [0.5, 0.866, 2], [-0.5, 0.866, 2], [-1, 0, 3], [-0.866, 0.5, 3], [-0.866, -0.5, 3], [1, 0, 4], [0.866, 0.5, 4], [0.866, -0.5, 4]];
const compact = n => n < 1000 ? `${Math.floor(n)}` : n < 1e6 ? `${(n / 1000).toFixed(n < 1e4 ? 1 : 0)}K` : n < 1e9 ? `${(n / 1e6).toFixed(n < 1e7 ? 2 : 1)}M` : `${(n / 1e9).toFixed(2)}B`;
// Every row of every tab, in the shop's order.
export const ALL = [...UPGRADES, ...WORKS, ...MAPS, ...CORE];
// How long a stretch is counted in for what was earned beside the model, in seconds.
const TEN = 600;

export async function play(seed = 7, minutes = 40, every = 120, each = null, fauna = false) {
  const opts = every && typeof every === 'object' ? every : { every, each, ...(fauna && typeof fauna === 'object' ? fauna : { fauna }) };
  every = opts.every ?? 120; each = opts.each ?? null; fauna = !!opts.fauna;
  const all = !!opts.all, hull = !!opts.hull;
  // (The rows the pilot shops in, made once: the first tab's alone, or all four tabs'.)
  const rows = all ? ALL : UPGRADES;
  Math.random = random(seed + 5);
  const game = await makeGame(seed, {}, { fauna, hull }), w = game.world, rnd = random(seed * 13 + 3);
  // (The drill and the state are the game's own objects, made again when the game goes back to a docking: they are
  // taken again after a wreck, in \`settle\`.)
  let d = game.drill, S = game.S;
  const clock = { t: 0 }, limit = minutes * 60, samples = [], events = [], bought = [], tens = [];
  const sum = { earned: 0, hauled: 0, spent: 0, cells: 0, hauls: 0, minerals: 0, keys: 0, loops: 0, failed: 0, pockets: 0, home: 0, stuck: 0, far: 0, idle: 0, flush: 0, lost: 0, idleFor: { gems: 0, spec: 0, need: 0 } };
  const big = [];                               // the hauls that paid most
  const held = {};                              // by upgrade: seconds held up for gems alone, and the reach when it began
  // By level (`drill 6`): the seconds it was on offer with its grit in hand and could not be bought, by what was
  // short first: 'gems north', 'spec west', 'need out'.
  const blockers = {};
  const first = { 'met 0': 0 };               // the first time of each kind of thing (the home ground is met from the start)
  const once = (what, text) => { if (first[what] === undefined) { first[what] = clock.t; events.push([clock.t, text]); } };
  const reach = () => game.val('tether');
  // What holds a level up that is on offer and whose grit is in hand: gems or specimens of a direction, or a need;
  // null if nothing does.
  const short = (u, c) => game.banked(c.gem) < c.gems ? `gems ${WAYS[c.gem]}` : c.spec && game.specs(u.kin) < c.spec ? `spec ${WAYS[u.kin]}` : game.lacks(u) ? `need ${game.need(u).what}` : null;

  // What a haul holds is looked at before the game takes it: keys, a pocket's mineral, what kind of ground.
  const haul = game.haul.bind(game);
  game.haul = cells => {
    let keys = 0, minerals = 0, prisms = 0, caches = 0;
    for (const i of cells) { const k = w.k(i), row = w.row(i); if (k === K.KEY) keys++; else if (k === K.PRISM) prisms++; else if (k === K.CACHE) caches++; else if (row.pocket && k === (row.pocket.kind ?? K.MINERAL)) minerals++; }
    const was = S.grit, ground = w.row(cells[0]);
    haul(cells);
    sum.hauled += S.grit - was; sum.cells += cells.length; sum.hauls++; sum.minerals += minerals; sum.keys += keys;
    const gems = game.hauled.gems.reduce((x, y) => x + y, 0), i0 = cells[0];
    big.push({ t: clock.t, n: cells.length, grit: S.grit - was, gems, far: Math.round(Math.hypot(i0 % N - C, Math.floor(i0 / N) - C)), ground: ground.title, over: game.hauled.over, minerals });
    big.sort((p, q) => q.grit - p.grit); big.length = Math.min(big.length, 8);
    if (keys) once('slab', `a haul with ${keys} cells of keystone in it: ${cells.length} cells, ${compact(S.grit - was)} grit`);
    if (minerals) once('mineral', `a pocket's mineral hauled: ${minerals} cells of ${game.hauled.mineral ?? 'it'} in a haul of ${cells.length} cells, ${compact(S.grit - was)} grit`);
    if (prisms) once('prism', `a prism hauled, in ${cells.length} cells`);
    if (caches) once('cache', `a cache hauled`);
  };
  let met = 1, visited = 0, called = 0, lastSample = 0, lastEarned = 0, second = 0, lastTen = 0, tenEarned = 0;
  const watch = () => {
    const ids = Object.keys(S.met);
    if (ids.length !== met) {
      met = ids.length;
      for (const id of ids) { const row = rowOf(+id), what = `met ${id}`; if (first[what] === undefined) { first[what] = clock.t; events.push([clock.t, `${row.title} met (ground ${id}${row.pocket ? ', a pocket' : row.cross ? ', a cross' : id >= 17 && id <= 31 ? ', a strain' : ''})`]); if (row.pocket) once('pocket', 'the first pocket met'); if (row.cross) once('cross', 'the first cross met'); if (id >= 17 && id <= 31) once('strain', 'the first strain met'); } }
    }
    const keys = Object.keys(S.visited);
    if (keys.length !== visited) { visited = keys.length; sum.pockets = visited; }
    if (game.called.size !== called) {
      called = game.called.size;
      for (const key of game.called) { const what = key.split(':')[0]; once(`saw ${what}`, `${what === 'key' ? 'a keystone' : what === 'mineral' ? 'a pocket\'s mineral' : `a ${what}`} first seen`); }
    }
    // Once a second: is a level held up for gems alone, and has the grit nothing to be spent on?
    if (clock.t - second >= 1) {
      second = clock.t;
      let least = Infinity, most = 0, open = 0, cheapest = null;
      for (const u of rows) {
        const c = game.cost(u);
        if (!c) continue;
        open++; least = Math.min(least, c.grit); most = Math.max(most, c.grit);
        if (game.banked() >= c.grit && game.banked(c.gem) < c.gems) {
          held[u.id] ??= { seconds: 0, spells: [] };
          const h = held[u.id];
          if (!h.now) { h.now = { from: clock.t, reach: reach(), level: S.lv[u.id], gems: c.gems, gem: c.gem }; h.spells.push(h.now); }
          h.seconds++; h.now.to = clock.t;
        } else if (held[u.id]) held[u.id].now = null;
        if (game.banked() >= c.grit) {
          const why = short(u, c);
          if (why) { const at = `${u.id} ${S.lv[u.id] + 1}`; (blockers[at] ??= {})[why] = (blockers[at][why] ?? 0) + 1; if (!cheapest || c.grit < cheapest[0]) cheapest = [c.grit, why]; }
        }
      }
      // Flush: the grit banked would buy the dearest thing on offer twice over. Idle: nothing on offer can be bought
      // though the grit banked is more than the cheapest of it costs (it waits on gems, specimens or what must be
      // found; which, by what the cheapest level whose grit is in hand waits on).
      if (open && game.banked() >= 2 * most) sum.flush++;
      if (open && game.banked() >= least && !rows.some(u => game.canBuy(u))) { sum.idle++; if (cheapest) sum.idleFor[cheapest[1].split(' ')[0]]++; }
    }
    sum.earned = S.grit + sum.spent;              // all that has come in: the hauls, and the station's own trickle
    if (clock.t - lastSample >= every - 1e-6) {
      const next = rows.map(u => game.cost(u)).filter(Boolean);
      samples.push({ t: clock.t, lv: { ...S.lv }, reach: reach(), banked: game.banked(), earned: sum.earned, rate: (sum.earned - lastEarned) / (clock.t - lastSample), model: income(reach()),
        gems: gemsSaid(S.gems), spec: S.spec.slice(1).map(n => Math.floor(n + 1e-9)), far: sum.far, hauls: sum.hauls, cells: sum.cells, pockets: visited,
        cheapest: next.length ? Math.min(...next.map(c => c.grit)) : 0, dearest: next.length ? Math.max(...next.map(c => c.grit)) : 0 });
      lastSample = clock.t; lastEarned = sum.earned;
    }
    // Every ten minutes: what was earned a second, beside the model's income for the reach at the end of it.
    if (clock.t - lastTen >= TEN - 1e-6) {
      const rate = (sum.earned - tenEarned) / (clock.t - lastTen);
      tens.push({ t: clock.t, rate, model: income(reach()), ratio: rate / income(reach()), banked: game.banked() });
      lastTen = clock.t; tenEarned = sum.earned;
    }
  };
  const step = () => { game.update(1 / 60); clock.t += 1 / 60; watch(); if (each) each(game, clock.t); };
  // The drill was wrecked since the trip began (the game went back to the docking it left from).
  let trip = 0;
  const lost = () => game.wrecks !== trip;

  // Flies straight at the middle of cell (x, y), cutting what is in the way. Held up for five seconds (lava, a
  // wreck, bedrock), it steps aside for a moment and tries again, six times. Returns whether it got there. A drill
  // wrecked on the way gets nowhere.
  const go = (x, y, frames) => {
    const tx = x + 0.5, ty = y + 0.5;
    let best = Infinity, since = 0, side = 1, dodge = 0, tries = 0;
    for (let f = 0; f < frames && clock.t < limit && !lost(); f++) {
      const dx = tx - d.x, dy = ty - d.y, far = Math.hypot(dx, dy);
      if (far < 0.3 && d.mode === 'free') { game.input.auto = null; return true; }
      let ux = dx / (far || 1), uy = dy / (far || 1);
      if (dodge > 0) { [ux, uy] = [-uy * side, ux * side]; dodge--; }
      game.input.auto = [ux, uy, far > 1.5 || dodge ? 1 : Math.max(0.4, far / 1.5)];
      step();
      if (d.stun > 0 || d.mode !== 'free') continue;
      if (far < best - 0.3) { best = far; since = 0; }
      else if (++since > 300 && !dodge) { sum.stuck++; dodge = 45; side = -side; since = 0; best = Infinity; if (++tries > 6) break; }
    }
    game.input.auto = null;
    return false;
  };
  const still = frames => { game.input.auto = null; for (let f = 0; f < frames && clock.t < limit; f++) step(); };
  // After a wreck: the drill lies dead, the game goes back, and the thumb comes off so that the next stroke throws.
  const settle = () => { sum.lost++; game.input.auto = null; while (game.drill.mode === 'dead' && clock.t < limit) step(); d = game.drill; S = game.S; still(4); trip = game.wrecks; };
  const fits = (cx, cy, q) => Math.hypot(Math.abs(cx) + q + 0.5, Math.abs(cy) + q + 0.5) <= reach() - 0.8;
  // The ground inside a ring `q` cells from the cell (cx, cy) (offsets from the core) that could be hauled.
  const inside = (cx, cy, q) => {
    let n = 0;
    for (let y = cy - q + 1; y < cy + q; y++) for (let x = cx - q + 1; x < cx + q; x++) { const k = w.k((C + y) * N + C + x); if (k !== K.EMPTY && HARD[k] < 99) n++; }
    return n;
  };
  // Cuts a square ring `q` cells from (cx, cy) and flies it shut, twice if the block still stands (ice, moss or
  // basalt closed the ring behind the drill). It goes in where the line from the core meets the ring.
  const lap = (cx, cy, q) => {
    const vx = -cx, vy = -cy, scale = q / Math.max(Math.abs(vx), Math.abs(vy), 1e-9), ex = Math.round(cx + vx * scale), ey = Math.round(cy + vy * scale);
    const corners = [[cx - q, cy - q], [cx + q, cy - q], [cx + q, cy + q], [cx - q, cy + q]];
    const on = ey === cy - q ? 0 : ex === cx + q ? 1 : ey === cy + q ? 2 : 3, stood = inside(cx, cy, q), cut = 60 * (20 + q * 8);
    if (!go(C + ex, C + ey, 60 * (40 + Math.hypot(ex, ey) * 2))) return false;
    sum.far = Math.round(Math.hypot(cx, cy));
    for (let round = 0; round < 2 && clock.t < limit && !lost(); round++) {
      for (let n = 1; n <= 4; n++) go(C + corners[(on + n) % 4][0], C + corners[(on + n) % 4][1], cut);
      go(C + ex, C + ey, cut);
      still(15);
      if (lost()) break;
      if (inside(cx, cy, q) <= Math.max(4, stood * 0.15)) { sum.loops++; return true; }
    }
    sum.failed++;
    return false;
  };
  const home = () => {
    for (let tries = 0; tries < 8 && clock.t < limit && !game.atCore && !lost(); tries++) go(C, C, 60 * (60 + game.far));
    if (lost()) return;
    sum.home++;
    // What is on its way up the tether is waited for, a little.
    for (let f = 0; f < 60 * 25 && game.hauls.length && clock.t < limit && !lost(); f++) step();
    still(4);
  };
  const shop = () => {
    for (let again = true; again;) {
      again = false;
      const list = [rows[0], ...rows.slice(1).filter(u => game.cost(u)).sort((a, b) => game.cost(a).grit - game.cost(b).grit)];
      for (const u of list) {
        if (!game.canBuy(u)) continue;
        const c = game.cost(u);
        game.buy(u); sum.spent += c.grit;
        bought.push({ t: clock.t, id: u.id, name: u.name, level: S.lv[u.id], grit: c.grit, gems: c.gems, gem: c.gem, spec: c.spec, kin: u.kin, banked: game.banked() });
        again = true;
        break;
      }
    }
  };
  // Whether what has been hauled, banked or on its way, would buy anything.
  // (Grit and gems alone are asked: a pilot in a hurry does not read the rest of the row.)
  const worthHome = () => rows.some(u => { const c = game.cost(u); return c && S.grit >= c.grit && S.gems[c.gem] >= c.gems; });
  // Whose gems a level wants that the grit is there for, or half there: that direction is worked next (the
  // reach's first, as it is bought first, and then the cheapest such level's). Not before the reach is 230: the
  // gems' ground begins 130 out.
  const wanted = () => {
    let gem = 0, least = Infinity;
    if (reach() >= 230) for (const u of rows) {
      const c = game.cost(u);
      if (!c || c.gems <= S.gems[c.gem] || S.grit < c.grit * 0.5) continue;
      if (u.id === 'tether') return c.gem;
      if (c.grit < least) { least = c.grit; gem = c.gem; }
    }
    return gem;
  };
  const spokes = SPOKES.map(([ux, uy, kin]) => ({ ux, uy, kin, dom: Math.max(Math.abs(ux), Math.abs(uy)), at: 3.5 }));
  // The next block on a spoke: { cx, cy, q, spoke, e } or null where the reach has no room for one there.
  const blockOn = (spoke, least) => {
    const R = reach(), side = Math.max(3, Math.min(48, Math.round(R / 3)));
    for (let q = Math.max(2, Math.round((side + 1) / 2)); q >= 2; q = q > 8 ? Math.round(q * 0.7) : q - 1) {
      const e = Math.max(spoke.at, least, 3.5), far = e + q / spoke.dom, cx = Math.round(spoke.ux * far), cy = Math.round(spoke.uy * far);
      if (fits(cx, cy, q) && inside(cx, cy, q) >= 0.5 * (2 * q - 1) ** 2) return { cx, cy, q, spoke, e };
      if (fits(cx, cy, q)) { spoke.at = e + (2 * q + 1) / spoke.dom; q++; if (spoke.at > R) return null; }
    }
    return null;
  };
  let trips = 0, turn = 0, slabbed = false;
  const tried = new Set();
  // Where each spoke had got to when the trip began, and whether the slab was rung: a trip lost is undone, its
  // ground standing again, and the pilot goes back for it. (It went on from where the lost trip had got to, past
  // ground that stood again, and with nothing left on any spoke it stood at the core for the rest of the game.)
  const began = { at: spokes.map(s => s.at), slabbed: false };
  const undo = () => { settle(); spokes.forEach((s, n) => { s.at = began.at[n]; }); slabbed = began.slabbed; };
  while (clock.t < limit) {
    if (lost()) undo(); else if (!game.atCore) home();
    // (Wrecked on the way home: the game is back at the core, and the pilot shops there all the same.)
    if (lost()) undo();
    shop();
    trips++; trip = game.wrecks;
    spokes.forEach((s, n) => { began.at[n] = s.at; }); began.slabbed = slabbed;
    const R = reach();
    let site = null;
    // The first keystone slab, once the reach goes round it.
    const slab = w.firstSlab;
    if (!slabbed && slab) { const cx = slab.cx - C, cy = slab.cy - C, q = Math.ceil(slab.p) + 4; if (fits(cx, cy, q)) { slabbed = true; site = { cx, cy, q, what: 'slab' }; once('slab ring', `a ring cut round the first slab, ${Math.round(Math.hypot(cx, cy))} out, on reach ${R}`); } }
    // Every fourth trip: the nearest pocket not yet visited that the reach goes round.
    if (!site && trips % 4 === 0) for (const Z of w.pocketsWithin(R)) {
      const cx = Z.cx - C, cy = Z.cy - C, q = Math.max(3, Math.round(Z.rho * 0.66));
      if (S.visited[Z.key] || tried.has(Z.key) || !fits(cx, cy, q)) continue;
      tried.add(Z.key); site = { cx, cy, q, what: rowOf(Z.row).name };
      break;
    }
    // A block on a spoke: of the direction whose gems are wanted, or the directions in turn.
    if (!site) {
      const want = wanted(), order = [1, 4, 2, 3], kins = want ? [want, ...order.filter(k => k !== want)] : order.map((k, n) => order[(n + turn) % 4]);
      if (!want) turn++;
      for (const kin of kins) {
        const list = spokes.filter(s => s.kin === kin).sort((a, b) => a.at - b.at);
        for (const spoke of list) { site = blockOn(spoke, Math.max(0.4 * R, want === kin ? 165 : 0)); if (site) break; }
        if (site) break;
      }
    }
    // No spoke has room on this reach: a block anywhere that still stands.
    if (!site) for (let n = 0; n < 40 && !site; n++) {
      const q = Math.max(2, Math.round((Math.max(3, Math.min(48, Math.round(R / 3))) + 1) / 2 * (n < 20 ? 1 : 0.5))), far = 3.5 + q + rnd() * Math.max(0, R - 5 - 2.5 * q), turnBy = rnd() * 4;
      const [ax, ay] = [[1, 0], [0, 1], [-1, 0], [0, -1]][Math.floor(turnBy)], f = turnBy % 1, cx = Math.round((ax * (1 - f) - ay * f) * far), cy = Math.round((ay * (1 - f) + ax * f) * far);
      if (fits(cx, cy, q) && Math.hypot(cx, cy) > q + 3 && inside(cx, cy, q) >= 0.7 * (2 * q - 1) ** 2) site = { cx, cy, q, what: 'anywhere' };
    }
    if (!site) { still(120); continue; }
    d.armed = true;                             // a fresh stroke: from the middle of the core the drill is thrown
    for (let blocks = 0; site && blocks < 3 && clock.t < limit && !lost(); blocks++) {
      const done = lap(site.cx, site.cy, site.q);
      if (site.spoke) site.spoke.at = site.e + (2 * site.q + 1) / site.spoke.dom;
      if (!site.spoke || !done || worthHome()) break;
      site = blockOn(site.spoke, 0);
    }
  }
  for (const h of Object.values(held)) delete h.now;
  // The longest stretches with nothing bought: [seconds, from when].
  const times = [0, ...bought.map(b => b.t), limit], gaps = [];
  for (let n = 1; n < times.length; n++) gaps.push([times[n] - times[n - 1], times[n - 1]]);
  gaps.sort((a, b) => b[0] - a[0]);
  const found = { spec: S.spec.slice(1).map(n => Math.floor(n + 1e-9)), out: Math.floor(S.out ?? 0), kinds: game.recount(), places: Object.keys(S.met).length, parts: (S.wrecks ?? []).filter(Boolean).length,
    relics: S.relics.filter(Boolean).length, beasts: Object.keys(S.fauna?.met ?? {}).length };
  return { seed, minutes, all, hull, samples, events, bought, held, blockers, gaps: gaps.slice(0, 3), tens, found, sum, first, big, S: JSON.parse(JSON.stringify(S)), met: Object.keys(S.met).map(id => rowOf(+id).title), game };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (name, fallback) => { const n = process.argv.indexOf(`--${name}`); return n < 0 ? fallback : process.argv[n + 1]; };
  const seed = Number(arg('seed', 7)), minutes = Number(arg('minutes', 40)), every = Number(arg('every', 120)), began = Date.now();
  const fauna = process.argv.includes('--fauna'), all = process.argv.includes('--all'), hull = process.argv.includes('--hull');
  const r = await play(seed, minutes, { every, fauna, all, hull }), clockOf = t => `${String(Math.floor(t / 60)).padStart(2)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const rowOfId = id => ALL.find(u => u.id === id);
  console.log(`world ${seed}, ${minutes} minutes of the game's time${all ? ', every tab' : ''}${hull ? ', the hull taking harm' : ''} (played in ${((Date.now() - began) / 1000).toFixed(0)} s)\n`);
  console.log(' time  reach  bit winch scan ram   banked   earned   a second (model)   gems n/s/w/e          specimens   far  hauls  pockets  dearest on offer');
  for (const s of r.samples) {
    console.log(`${clockOf(s.t)}  ${String(s.reach).padStart(5)}   ${s.lv.drill}    ${s.lv.winch}     ${s.lv.scanner}    ${s.lv.momentum}   ${compact(s.banked).padStart(7)}  ${compact(s.earned).padStart(7)}  ${compact(s.rate).padStart(7)} (${compact(s.model).padStart(6)})   ${s.gems.padEnd(20)} ${s.spec.join('/').padEnd(10)} ${String(s.far).padStart(5)}  ${String(s.hauls).padStart(5)}  ${String(s.pockets).padStart(5)}    ${compact(s.dearest)}`);
  }
  console.log('\nbought:');
  for (const b of r.bought) console.log(`  ${clockOf(b.t)}  ${b.name} ${b.level}${b.id === 'tether' ? ` (reach ${UPGRADES[0].values[b.level]})` : ''}: ${compact(b.grit)} grit${b.gems ? ` and ${b.gems} gems of the ${WAYS[b.gem]}` : ''}${b.spec ? ` and ${b.spec} specimens of the ${WAYS[b.kin]}` : ''}; ${compact(b.banked)} left`);
  console.log('\nmet and found:');
  for (const [t, text] of r.events.sort((a, b) => a[0] - b[0])) console.log(`  ${clockOf(t)}  ${text}`);
  const total = minutes * 60, pc = n => `${(n / total * 100).toFixed(1)}%`;
  console.log(`\n${r.sum.loops} rings flown shut (${r.sum.failed} left standing), ${r.sum.hauls} hauls of ${r.sum.cells} cells, ${r.sum.pockets} pockets visited, ${r.sum.home} trips; held up ${r.sum.stuck} times${hull ? `; ${r.game.knocks} knocks, ${r.sum.lost} trips lost` : ''}`);
  console.log('the hauls that paid most:');
  for (const h of r.big) console.log(`  ${clockOf(h.t)}  ${String(h.n).padStart(6)} cells of ${h.ground.toLowerCase()} ${h.far} out: ${compact(h.grit)} grit (${(h.grit / r.sum.earned * 100).toFixed(0)}% of all earned), ${h.gems} gems${h.over < 1 ? `, over the winch's load (paid ${(h.over * 100).toFixed(0)}%)` : ''}${h.minerals ? `, ${h.minerals} cells of mineral` : ''}`);
  console.log(`grit banked that would buy the dearest thing on offer twice over: ${pc(r.sum.flush)} of the time`);
  console.log(`grit banked for something on offer and nothing that could be bought (waiting on gems, specimens or needs): ${pc(r.sum.idle)} of the time (gems ${pc(r.sum.idleFor.gems)}, specimens ${pc(r.sum.idleFor.spec)}, needs ${pc(r.sum.idleFor.need)})`);
  for (const [id, h] of Object.entries(r.held)) for (const s of h.spells) console.log(`  ${rowOfId(id).name} ${s.level + 1} waited on ${s.gems} gems of the ${WAYS[s.gem]} from ${clockOf(s.from)} to ${clockOf(s.to)} (${Math.round(s.to - s.from)} s), on reach ${s.reach}`);
  console.log(`the longest stretches with nothing bought: ${r.gaps.map(([g, t]) => `${(g / 60).toFixed(1)} min from ${clockOf(t).trim()}`).join('; ')}`);
  console.log(`earned a second over the model's income, by ten minutes: ${r.tens.map(x => x.ratio.toFixed(1)).join(' ')}`);
  console.log('BLOCKERS: seconds each level was on offer with its grit in hand and could not be bought, by what was short first');
  for (const [at, why] of Object.entries(r.blockers).sort((a, b) => Object.values(b[1]).reduce((x, y) => x + y) - Object.values(a[1]).reduce((x, y) => x + y))) {
    const id = at.split(' ')[0];
    console.log(`  ${`${rowOfId(id).name} ${at.split(' ')[1]}`.padEnd(16)} ${Object.entries(why).map(([what, n]) => `${what} ${n}`).join(', ')}${r.S.lv[id] >= +at.split(' ')[1] ? '' : ' (not bought)'}`);
  }
  console.log(`at the end: reach ${UPGRADES[0].values[r.S.lv.tether]}, levels ${JSON.stringify(r.S.lv)}, grit ${compact(r.S.grit)}, gems ${gemsSaid(r.S.gems)}, specimens ${r.S.spec.slice(1).map(n => n.toFixed(1)).join('/')}`);
  console.log(`grounds met: ${r.met.join(', ')}`);
  if (fauna) {
    const f = r.game.fauna, F = r.S.fauna ?? {};
    console.log(`creatures met: ${Object.keys(F.met ?? {}).join(', ') || 'none'}${F.pal ? ', and the pup is the pal' : ''}; their deeds ${f.deeds}, the hull's knocks in all ${r.game.knocks}; pufflings paid ${compact(f.paid.grit)} grit (${(f.paid.grit / Math.max(1, r.sum.earned) * 100).toFixed(2)}% of what was earned) and ${f.paid.gems[3]} gems`);
  }
  const F = r.found;
  console.log(`found: specimens ${F.spec.join('/')}, ${F.out} cells out, ${F.kinds} kinds analysed, ${F.places} places met, ${F.parts} wreck parts, ${F.relics} relics, ${F.beasts} creatures met`);
}
