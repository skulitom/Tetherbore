// The creatures' jobs, each staged beside the drill in the ground it lives in and played, with the hull taking its
// knocks and the tether checked every frame (js/fauna.js):
//   the pup: three crushes beside it make it the pal and two do not; the pal is saved, comes back with a game
//   loaded, is forgotten with a trip lost, rides a long flight and comes down beside the drill, warns as a foe's
//   warning begins, and pulls a leech off;
//   moths: a cell ahead of the lamp, further than the lamp lights, is lit with them and not without; a rime bell
//   seen draws them round it; a drill going fast scatters them;
//   the wren: it leads to a find nobody has seen, which is then seen, painted and called out, once; never to one the
//   finder marks already;
//   the puffling: a loop round it catches it and pays what it should, and a loop far from it does not; its den is
//   spent, and saved so;
//   the newt: no more than three caps a visit, never two within four seconds;
//   bats: a slow pass never wakes them, a throw does; the warning lasts at least BAT.fuse before any knock, its line
//   stays where it was fixed; one pip a waking at the most, and each bat warns once a waking, on four worlds with
//   the swoops falling about the shield; rammed at rest, the roost is quiet for QUIET seconds;
//   the leech: it drops only on a drill under it and slow; latched, the drill flies at LEECH.drag of its speed and
//   takes no pip; it comes off flown fast, at the core and by itself; flown into as it stiffens, its den is quiet;
//   the spitter: a slow pass never wakes it, a throw does; it swells for SPITTER.puff before it spits; behind rock
//   it never swells; a chill takes no pip, and never lands within the shield after a knock; no plug is laid under
//   the tether, near the drill, in lava or a pocket;
//   a name: it comes up only for a creature on the screen, and is kept wholly on it;
//   pockets: the grotto's creatures never leave it, and nothing from outside goes in, the pal neither.
//   node test/regress/s8-fauna-play.mjs
import { makeGame, random, farStart, tetherFaults, C, N, K, world } from '../harness.mjs';
import { PUP, MOTH, BAT, LEECH, SPITTER, PUFF, NEWT, QUIET, CREATURES, FAUNA } from '../../js/fauna.js';
import { income, round2 } from '../../js/shop.js';

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const KIND = Object.fromEntries(CREATURES.slice(1).map((c, n) => [c.key, n + 1]));
// A game with its creatures and its hull, the drill set down at (sx, sy) at the end of a tunnel from the core, the
// ground about it seen.
const at = async (sx, sy, reach, seed = 7, see = 10) => {
  const game = await makeGame(seed, { tether: reach, drill: 4 }, { fauna: true, hull: true });
  Math.random = random(seed + 11);
  farStart(game, sx, sy); game.world.see(C + sx, C + sy, see); game.changed();
  game.update(1 / 60);
  return game;
};
// Frames, steered or not; `each` is asked after every one, and the tether is looked at.
const run = (game, frames, steer = null, each = null) => {
  for (let n = 0; n < frames; n++) {
    game.input.auto = typeof steer === 'function' ? steer(n) : steer;
    game.update(1 / 60);
    const faults = tetherFaults(game);
    if (faults.length) { check(false, `the tether went wrong: ${faults[0]}`); return; }
    if (each?.(n) === false) return;
  }
};
const where = (game, i) => `${(game.fauna.x[i] - C).toFixed(1)},${(game.fauna.y[i] - C).toFixed(1)}`;

// ---- the pup
{
  const game = await at(-60, 0, 2), f = game.fauna, i = f.stage(game, 'pup');
  check(i >= 0, 'no pup could be set down in the home ground');
  const near = () => Math.floor(f.y[i] - 1) * N + Math.floor(f.x[i]) + 1;
  f.crushed(game, near(), K.ORE_A); run(game, 20); f.crushed(game, near(), K.ORE_B); run(game, 20);
  check(f.pal < 0 && !game.S.fauna?.pal, 'two crushes made the pup the pal');
  f.crushed(game, near(), K.DENSE); run(game, 20);
  check(f.pal < 0, 'dense rock crushed fed the pup');
  // (A real cut, through the game: ore beside the pup, cut.)
  const c = near();
  game.world.setK(c, K.ORE_A); game.changed(); game.finishDig(c); run(game, 20);
  check(f.pal === i && game.S.fauna?.pal?.kind === 'pup', `three crushes beside the pup did not make it the pal (${f.pal}, ${JSON.stringify(game.S.fauna)})`);
  // Saved, and loaded again.
  game.save();
  const again = await makeGame(7, {}, { fauna: true });
  await again.restore();
  check(again.fauna.pal >= 0 && again.S.fauna?.pal, 'the pal did not come back with the game loaded');
  // A long flight: it rides, and comes down beside the drill.
  run(game, 150, [1, 0, 1]);
  check(f.st[f.pal] === 9, `flying fast the pal does not ride (state ${f.st[f.pal]})`);
  run(game, 180);
  const d = game.drill, gap = Math.hypot(d.x - f.x[f.pal], d.y - f.y[f.pal] + 0.5);
  check(f.st[f.pal] !== 9 && gap < PUP.behind, `the pal did not come down beside the drill (${gap.toFixed(1)} cells, state ${f.st[f.pal]})`);
  // Lost with a trip: befriended since the last docking, it is forgotten.
  const lost = await at(-60, 0, 2), g = lost.fauna, j = g.stage(lost, 'pup');
  lost.dockMark();
  g.stageAs(lost, j, 'pal');
  check(g.pal >= 0, 'a pup staged as the pal is not');
  lost.dents = lost.val('hull') - 1; lost.shield = 0; lost.hit(0.3);
  run(lost, 120);
  check(!lost.S.fauna?.pal && g.pal < 0, 'a pal made on a trip that was lost is still the pal');
}

// ---- moths: light ahead of the lamp
{
  const game = await at(60, -180, 4, 7, 12), f = game.fauna, d = game.drill, w = game.world;
  // (Back down the tunnel toward the core, slowly: they fly out ahead.)
  const ux = (C + 0.5 - d.x) / Math.hypot(C + 0.5 - d.x, C + 0.5 - d.y), uy = (C + 0.5 - d.y) / Math.hypot(C + 0.5 - d.x, C + 0.5 - d.y);
  const i = f.stage(game, 'moth');
  check(i >= 0, 'no moth could be set down in the north');
  run(game, 90, [ux, uy, 0.12]);
  game.render();
  const L = game.lightMap, lit = (x, y) => L.want[(y - L.y0) * L.cols + x - L.x0];
  // The brightest cell of the tunnel ahead that the lamp alone does not reach.
  let gain = 0;
  const withMoths = [];
  for (let s = 6; s <= 10; s++) { const x = Math.floor(d.x + ux * s), y = Math.floor(d.y + uy * s); withMoths.push([x, y, lit(x, y)]); }
  f.off = true; game.render(); f.off = false;
  for (const [x, y, v] of withMoths) gain = Math.max(gain, v - lit(x, y));
  check(gain > 0.15, `moths ahead light the tunnel no more than the lamp (${gain.toFixed(2)} at most, moths in states ${[...f.st].slice(0, 3)})`);
  // Fast, they scatter.
  run(game, 40, [ux, uy, 1], () => Math.hypot(d.vx, d.vy) < MOTH.scatter);
  run(game, 10, [ux, uy, 1]);
  check(Math.hypot(d.vx, d.vy) < MOTH.scatter || [...f.st].some((s, n) => f.kind[n] === KIND.moth && s === 8), 'a drill going fast does not scatter the moths');
}
// ---- moths at a rime bell (the first of world 7, 141,-576)
{
  const game = await at(141, -584, 7, 7, 14), f = game.fauna;
  run(game, 2);
  const bell = game.S.marks.find(([c, k]) => k === K.RARE);
  check(bell, 'the bell beside the drill was not seen and marked');
  const i = f.stage(game, 'moth');
  run(game, 240);
  if (bell && i >= 0) {
    const bx = bell[0] % N + 0.5, by = Math.floor(bell[0] / N) + 0.5, far = Math.hypot(f.x[i] - bx, f.y[i] - by);
    check(far < 4, `the moths do not gather at the bell (${far.toFixed(1)} cells from it)`);
  }
}

// ---- the wren: to a find nobody has seen, east of the core on world 7
{
  // A cache in the east's ground that the drill can stand twelve cells short of, on its way from the core.
  const probe = await makeGame(7);
  let find = null;
  for (let sy = -3; sy <= 3 && !find; sy++) for (let sx = 2; sx <= 5 && !find; sx++) {
    const [what, fx, fy] = probe.world.findSpot(sx, sy);
    if (what === 'cache' && world.BIOMES[probe.world.biomeAt(fx, fy)].kin === world.B.LODE && probe.world.kindAt(fx, fy, probe.world.biomeAt(fx, fy)) === K.CACHE) find = [fx - C, fy - C];
  }
  check(find, 'no cache in the east near the core on world 7');
  if (find) {
    const len = Math.hypot(...find), sx = Math.round(find[0] - find[0] / len * 12), sy = Math.round(find[1] - find[1] / len * 12);
    for (const finder of [0, 1]) {
      const game = await at(sx, sy, 5, 7, 4), f = game.fauna, w = game.world, cell = (C + find[1]) * N + C + find[0];
      game.S.lv.mapfinder = finder;
      check(w.peek(C + find[0], C + find[1]) < 0, 'the cache was seen before the wren');
      const i = f.stage(game, 'wren');
      check(i >= 0, 'no wren could be set down in the east');
      const leads = f.findFor(game, i);
      if (finder) { check(!leads || f.cell[i] !== cell, 'the wren leads to a cache the finder marks already'); continue; }
      check(leads && f.cell[i] === cell, `the wren does not lead to the cache 12 cells off (${leads}, ${f.cell[i] % N - C},${Math.floor(f.cell[i] / N) - C})`);
      f.stageAs(game, i, 'peck');
      // (Shown, the ground about it is painted again: the game's version moves on in the frame it is seen.)
      let shown = -1, version = game.version, repainted = false;
      run(game, 400, null, n => { if (shown < 0 && w.peek(C + find[0], C + find[1]) >= 0) { shown = n; repainted = game.version > version; } version = game.version; });
      check(shown >= 0, 'the wren pecked and the cache was not shown');
      check(shown < 0 || repainted, 'the cache the wren showed is not painted again: the game\'s version did not move on');
      check(game.S.marks.some(m => m[0] === cell), 'the cache the wren showed was not called out and marked');
      check(game.S.fauna?.spent?.length === 1, `the wren's den is not spent once (${JSON.stringify(game.S.fauna?.spent)})`);
    }
  }
}

// ---- the puffling: a loop round it
{
  const game = await at(-160, 64, 4, 7, 12), f = game.fauna, d = game.drill;
  const i = f.stage(game, 'puff');
  check(i >= 0, 'no puffling could be set down in the west');
  run(game, 30);
  const x = f.x[i], y = f.y[i], far = Math.hypot(x - C, y - C), grit = game.S.grit, gems = game.S.gems[3];
  // (A loop that does not go round it: a triangle off to one side.)
  const band = game.band;
  game.band = [[d.x, d.y], [x + 9, y - 6], [x + 14, y + 6], [C + 0.5, C + 0.5]];
  f.wound(game);
  check(game.S.grit === grit && f.st[i] !== 17, 'a loop far from the puffling caught it');
  game.band = [[x + 1.5, y + 0.5], [x + 1.5, y - 2], [x - 2, y - 2], [x - 2, y + 2], [x + 2.5, y + 2], [C + 0.5, C + 0.5]];
  f.wound(game);
  const want = Math.round(round2(income(Math.max(22, far)) * PUFF.lump) * game.val('refinery'));
  check(f.st[i] === 17, 'a loop round the puffling did not catch it');
  check(game.S.grit - grit === want && game.S.gems[3] - gems === PUFF.gems, `the puffling paid ${game.S.grit - grit} grit and ${game.S.gems[3] - gems} gems, not ${want} and ${PUFF.gems}`);
  check(f.paid.grit === want, 'what the creatures paid is not kept for the books');
  check(game.S.fauna?.spent?.length === 1, 'the puffling\'s den is not spent');
  game.band = band;
  check(!game.pending.grit, 'the puffling\'s pay was put on its way as a haul\'s is, with no haul to bring it');
}

// ---- the newt: in the lantern grotto at -551,302
{
  const game = await makeGame(7, { tether: 7, drill: 4 }, { fauna: true, hull: true }), w = game.world;
  const Z = w.zoneOf(Math.floor(-551 / 128), Math.floor(302 / 128));
  let st = null;
  for (let r = 0; r < 10 && !st; r++) for (let v = -r; v <= r && !st; v++) for (let u = -r; u <= r; u++) { const x = Z.cx + u, y = Z.cy + v; if (w.k(y * N + x) === K.EMPTY && w.b(y * N + x) === Z.row) { st = [x - C, y - C]; break; } }
  farStart(game, st[0], st[1]); w.see(C + st[0], C + st[1], 16); game.changed(); game.update(1 / 60);
  const f = game.fauna, i = f.stage(game, 'newt'), times = [];
  check(i >= 0, 'no newt could be set down in the grotto');
  const light = game.lightCap.bind(game);
  game.lightCap = c => { times.push(game.time); light(c); };
  // (Many caps lit about it, so that it has more to light than it may.)
  run(game, 60 * 40);
  check(times.length >= 1 && times.length <= NEWT.caps, `the newt lit ${times.length} caps in a visit`);
  check(times.every((t, n) => !n || t - times[n - 1] >= NEWT.every - 1e-6), `the newt lit two caps within ${NEWT.every} s: ${times.map(t => t.toFixed(1))}`);
}

// The drill stands at the end of a tunnel three cells wide (rows -1 to 1 about it): a creature of the ceiling is
// set down on its roof, one of the floor on its floor, `back` cells down it toward the core. (The foes are tried in
// a level tunnel 300 cells west of the core on world 7, whatever ground they live in: it is what each does that is
// tried here; where each lives, js/fauna.js's ROSTER and test/regress/s8-fauna.mjs.)
const tunnelCell = (game, back, row) => {
  const d = game.drill, len = Math.hypot(d.x - C - 0.5, d.y - C - 0.5);
  return (Math.floor(d.y - (d.y - C - 0.5) / len * back) + row) * N + Math.floor(d.x - (d.x - C - 0.5) / len * back);
};
// A careful pilot: half a stick, let go now and then (so no long run builds up), that way.
const careful = (x, y) => n => n % 40 < 30 ? [x, y, 0.45] : null;
const homeward = game => { const d = game.drill, len = Math.hypot(C + 0.5 - d.x, C + 0.5 - d.y); return [(C + 0.5 - d.x) / len, (C + 0.5 - d.y) / len]; };

// ---- bats
{
  const game = await at(-300, 0, 6), f = game.fauna, d = game.drill;
  const i = f.stage(game, 'bat', 8, tunnelCell(game, 4, -1)), den = f.denAt(i);
  check(i >= 0 && den?.flock >= 2, 'no roost of bats could be set down on the tunnel\'s roof');
  // A slow pass under the roost never wakes it.
  const [hx, hy] = homeward(game);
  run(game, 150, careful(hx, hy));
  run(game, 150, careful(-hx, -hy));
  check(den.st === 0, 'a slow pass woke the roost');
  // Woken: no knock before the warning has run its time, the line fixed until the swoop, one pip at the most.
  run(game, 60);
  f.stageAs(game, i, 'fuse');
  const dents = game.dents;
  let t = 0, first = -1, fixed = null, moved = false;
  run(game, 300, null, () => {
    t += 1 / 60;
    if (game.dents > dents && first < 0) first = t;
    if (f.st[i] === 4 && f.t[i] >= BAT.fuse - BAT.lock + 0.02) { if (fixed && (fixed[0] !== f.ax[i] || fixed[1] !== f.ay[i])) moved = true; fixed = [f.ax[i], f.ay[i]]; }
  });
  check(first >= 0, 'a roost woken beside a still drill never knocked it');
  check(first < 0 || first >= BAT.fuse, `a bat knocked ${first.toFixed(2)} s after the roost woke`);
  check(!moved, 'the line of a swoop moved once it was fixed');
  check(game.dents - dents <= 1, `one waking took ${game.dents - dents} pips`);
  // Rammed at rest, the roost is driven off.
  const resting = [...Array(FAUNA).keys()].find(j => f.kind[j] === KIND.bat && f.st[j] === 6);
  if (resting !== undefined) {
    const was = { x: d.x, y: d.y };
    d.x = f.x[resting] - 0.4; d.y = f.y[resting]; f.speed = 6;
    f.ram(game, resting);
    d.x = was.x; d.y = was.y;
    check(f.resting(game, den), 'a bat rammed at rest did not drive its roost off');
    check(f.quiet.get(den.key) - f.time > QUIET - 1, 'the roost is not quiet for QUIET seconds');
  } else check(false, 'no bat clung at rest after its swoop');
}

// ---- the leech: hung from the tunnel's roof
{
  const game = await at(-300, 0, 6), f = game.fauna, d = game.drill;
  const i = f.stage(game, 'leech', 8, tunnelCell(game, 6, -1));
  check(i >= 0, 'no leech could be set down');
  // Fast under it: it does not drop.
  const [hx, hy] = homeward(game);
  run(game, 50, [hx, hy, 1]);
  check(f.st[i] === 0, 'a leech dropped on a drill flying fast under it');
  // Back, slow, and still under it: it warns, drops and latches.
  run(game, 400, () => { const dx = f.x[i] - d.x; return Math.abs(dx) > 0.15 ? [Math.sign(dx), 0, 0.25] : null; }, () => f.latched < 0);
  const dents = game.dents;
  check(f.latched === i, `a leech over a slow drill did not latch on (state ${f.st[i]}, the drill ${(d.x - f.x[i]).toFixed(2)} cells beside it)`);
  run(game, 60, [hx, hy, 1]);
  const speed = Math.hypot(d.vx, d.vy), top = 9 * game.val('momentum') * LEECH.drag * (1 + Math.max(0, d.run - 0.8) * 0.9);
  check(f.latched === i && Math.abs(speed - top) < 0.8, `with a leech on, the drill flies at ${speed.toFixed(2)}, not ${top.toFixed(2)} (latched ${f.latched})`);
  check(game.dents === dents, 'a leech took a pip');
  // Flown fast a while, it comes off.
  game.S.lv.momentum = 3;
  run(game, 90, [-hx, -hy, 1]);
  check(f.latched < 0 && f.drag === 1, 'a leech stayed on a drill flown fast');
  // And by itself, after LEECH.most seconds.
  const again = await at(-300, 0, 6), g = again.fauna, j = g.stage(again, 'leech', 8, tunnelCell(again, 0, -1));
  check(g.stageAs(again, j, 'latched'), 'a leech could not be staged on the hull');
  run(again, 60 * (LEECH.most + 0.5));
  check(g.latched < 0 && g.drag === 1, 'a leech stayed on longer than it may');
}

// ---- the spitter: on the tunnel's floor
{
  const game = await at(-300, 0, 6), f = game.fauna, d = game.drill, w = game.world;
  const i = f.stage(game, 'spitter', 8, tunnelCell(game, 5, 1));
  check(i >= 0, 'no spitter could be set down');
  // A slow pass never wakes it.
  const [hx, hy] = homeward(game);
  run(game, 120, careful(hx, hy)); run(game, 120, careful(-hx, -hy));
  check(f.st[i] === 0, 'a slow pass woke the spitter');
  // Woken and swelling: it swells for SPITTER.puff before it spits; a chill on a still drill takes no pip.
  run(game, 30);
  f.stageAs(game, i, 'puff');
  const dents = game.dents;
  let puffed = 0, chilled = false;
  run(game, 120, null, () => { if (f.st[i] === 4) puffed += 1 / 60; if (d.stun > 0) chilled = true; });
  check(puffed >= SPITTER.puff - 1 / 30, `the spitter swelled only ${puffed.toFixed(2)} s before it spat`);
  check(chilled, 'a glob that landed on a still drill did not chill it');
  check(game.dents === dents, 'a spitter\'s glob took a pip');
  // Plugs: never under the tether, never near the drill, never in lava or a pocket.
  const setK = w.setK.bind(w), bad = [];
  w.setK = (c, v) => {
    if (v === K.ICE && f.st[i] === 5) {
      game.layUnder();
      if (game.under.has(c)) bad.push('under the tether');
      if (Math.hypot(c % N + 0.5 - d.x, Math.floor(c / N) + 0.5 - d.y) < SPITTER.keep) bad.push('beside the drill');
      if (w.lava.has(c)) bad.push('in lava');
      if (w.row(c).pocket) bad.push('in a pocket');
    }
    setK(c, v);
  };
  for (let n = 0; n < 8; n++) { f.st[i] = 3; f.t[i] = 10; f.n[i] = 1; run(game, 100, m => m < 50 ? [hx, hy, 0.6] : [-hx, -hy, 0.6]); }
  check(!bad.length, `a plug was laid ${[...new Set(bad)].join(', ')}`);
  w.setK = setK;
  // Behind rock it never swells: one set down in a hollow of its own under the tunnel's floor.
  const hidden = await at(-300, 0, 6), h = hidden.fauna, hw = hidden.world, x = Math.floor(hidden.drill.x) - 3, y = Math.floor(hidden.drill.y) + 4;
  for (let u = -1; u <= 1; u++) hw.setK(y * N + x + u, K.EMPTY);
  hw.see(x, y, 2); hidden.changed();
  const j = h.stage(hidden, 'spitter', 8, y * N + x);
  h.st[j] = 3; h.t[j] = 10;
  run(hidden, 120);
  check(j >= 0 && h.st[j] !== 4 && h.st[j] !== 5, 'a spitter swelled at a drill it could not see');
}

// ---- the pal: it warns as a foe's warning begins, and pulls a leech off
{
  const game = await at(-300, 0, 6), f = game.fauna;
  game.S.fauna = { pal: { kind: 'pup', at: 0 }, met: {}, spent: [] };
  f.befriend(game, -1);
  const i = f.stage(game, 'leech', 8, tunnelCell(game, 0, -1));
  let told = -1, warned = -1, off = -1, on = -1, t = 0;
  run(game, 400, null, () => {
    t += 1 / 60;
    if (f.st[i] === 4 && told < 0) told = t;
    if (f.warnedOf === 9 && warned < 0) warned = t;
    if (f.latched === i && on < 0) on = t;
    if (on >= 0 && f.latched < 0 && off < 0) off = t;
  });
  check(told >= 0 && warned >= 0 && warned <= told + 1 / 60, `the pal did not warn as the leech began to drop (warned ${warned.toFixed(2)}, the leech's warning ${told.toFixed(2)})`);
  check(on >= 0 && off >= 0 && off - on >= PUP.pull - 0.05 && off - on < LEECH.most - 1, `the pal did not pull the leech off (on ${on.toFixed(2)}, off ${off.toFixed(2)})`);
}

// ---- bats: a roost woken once beside a still drill, its bats each warning once, and one pip at the most, however
// the swoops fall about the shield (a bat back on the roost while its mates still wait out the shield neither ends
// the waking nor goes out again); and the waking over once they are all home.
for (const [seed, off] of [[7, 5], [11, 1], [23, 5], [31, 1]]) {
  const game = await makeGame(seed, { tether: 6, drill: 4 }, { fauna: true, hull: true });
  Math.random = random(18 + off);
  farStart(game, -300, 0); game.world.see(C - 300, C, 10); game.changed(); game.update(1 / 60);
  const f = game.fauna, d = game.drill, w = game.world, x = Math.floor(d.x) + off, y = Math.floor(d.y);
  let roof = -1;
  for (let v = 0; v < 6 && roof < 0; v++) if (w.peek(x, y - v) === K.EMPTY && w.peek(x, y - v - 1) > 0) roof = (y - v) * N + x;
  const i = roof >= 0 ? f.stage(game, 'bat', 8, roof) : -1, den = f.denAt(i);
  check(i >= 0, `no roost could be set down ${off} cells along the tunnel on world ${seed}`);
  if (i < 0) continue;
  f.stageAs(game, i, 'fuse');
  const knocks = game.knocks, was = new Map();
  let tells = 0;
  run(game, 60 * 20, null, () => {
    for (let j = 0; j < FAUNA; j++) if (f.kind[j] && f.denAt(j) === den) { if (f.st[j] === 4 && was.get(j) !== 4) tells++; was.set(j, f.st[j]); }
  });
  check(game.knocks - knocks <= 1 && tells <= den.flock, `world ${seed}: a roost of ${den.flock} woken once beside a still drill warned ${tells} times and took ${game.knocks - knocks} pips`);
  check(den.st === 0, `world ${seed}: the roost's waking never ended`);
}

// ---- a throw past a roost or a spitter wakes it, as a long run does
for (const kind of ['bat', 'spitter']) {
  const game = await at(-300, 0, 6), f = game.fauna, d = game.drill;
  const i = f.stage(game, kind, 8, tunnelCell(game, 4, kind === 'bat' ? -1 : 1)), den = f.denAt(i);
  run(game, 20);
  // (Thrown from ten cells down the tunnel back out to its end, under the roost or over the spitter.)
  const ex = d.x, ey = d.y;
  d.x = ex + 10; d.mode = 'fling'; d.tx = ex; d.ty = ey; d.speed = 34;
  let woke = false;
  run(game, 40, null, () => { woke ||= kind === 'bat' ? den.st === 1 : f.st[i] !== 0; });
  check(i >= 0 && woke, `a throw past a ${kind === 'bat' ? 'roost' : 'spitter'} did not wake it`);
}

// ---- a spitter's chill never lands within the shield after a knock
{
  const game = await makeGame(7, { tether: 6, drill: 4 }, { fauna: true, hull: true });
  Math.random = random(5);
  farStart(game, 0, -300); game.world.see(C, C - 300, 10); game.changed(); game.update(1 / 60);
  const f = game.fauna, d = game.drill, i = f.stage(game, 'spitter', 6);
  check(i >= 0, 'no spitter could be set down in the north');
  f.stageAs(game, i, 'puff');
  // (Knocked by something else while it swells: the glob lands with the shield still up.)
  let stun = 0, shield = 0, within = null;
  run(game, 120, null, n => {
    if (shield > 0 && d.stun > stun + 0.01) within ??= shield;
    if (n === 10) game.hit(0.3);
    stun = d.stun; shield = game.shield;
  });
  check(i < 0 || f.n[i] > 0, 'the spitter\'s glob never landed');
  check(within === null, `a spitter's chill stunned the drill with ${within?.toFixed(2)} s of the shield left`);
}

// ---- the leech: flown into while it stiffens, it is knocked off and its den is quiet
{
  const game = await at(-300, 0, 6), f = game.fauna, d = game.drill;
  const i = f.stage(game, 'leech', 8, tunnelCell(game, 0, -1)), den = f.denAt(i);
  check(i >= 0, 'no leech could be set down');
  run(game, 200, null, () => f.st[i] !== 4);
  check(f.st[i] === 4, `a leech over a still drill did not stiffen (state ${f.st[i]})`);
  run(game, 30, [0, -1, 1], () => f.kind[i] && !f.out[i]);
  check(f.latched < 0 && den && f.resting(game, den) && f.quiet.get(den.key) - f.time > QUIET - 2, `a leech flown into as it stiffened was not driven off (state ${f.st[i]}, latched ${f.latched})`);
  check(!game.S.fauna?.spent?.length, 'a leech driven off had its den spent');
}

// ---- a name comes up only for a creature on the screen, and is kept wholly on it
{
  const game = await at(-300, 0, 6), f = game.fauna, d = game.drill;
  game.input.auto = null; run(game, 30);
  const i = f.stage(game, 'moth');
  check(i >= 0, 'no moth could be set down');
  // (Held off the side of the screen, within the lamp's reach and in sight down the tunnel.)
  const hold = (u) => { for (let j = 0; j < FAUNA; j++) if (f.kind[j]) { f.x[j] = d.x + u; f.y[j] = d.y; f.vx[j] = f.vy[j] = 0; f.fade[j] = 1; } };
  const off = (game.W / 2 + 10) / 16;
  hold(off); f.meet(game);
  check(!f.met.size && !game.S.fauna?.met, `a moth ${off.toFixed(1)} cells to the side, off the screen, was met`);
  const near = (game.W / 2 - 12) / 16;
  hold(near); f.meet(game);
  check(f.met.size === 1, `a moth ${near.toFixed(1)} cells to the side, on the screen, was not met`);
  const drawn = [];
  const ctx = { globalAlpha: 1, fillStyle: '', fillRect() {}, drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh) { drawn.push([dx, dx + (dw ?? sw)]); } };
  const ox = Math.round(game.cam.x - game.W / 2), oy = Math.round(game.cam.y - (game.H - 44) / 2);
  f.signs(game, ctx, ox, oy);
  check(drawn.length && drawn.every(([a, b]) => a >= 0 && b <= game.W), `the moth's name runs off the screen (${drawn.map(([a, b]) => `${a}..${b}`).join(' ')} of ${game.W})`);
}

// ---- pockets: a pocket's creatures never leave it, and nothing else goes into one, the pal neither (the lantern
// grotto at -551,302 on world 7, the drill flown out of it down its tunnel and back)
{
  const game = await makeGame(7, { tether: 7, drill: 4 }, { fauna: true, hull: true }), w = game.world;
  const Z = w.zoneOf(Math.floor(-551 / 128), Math.floor(302 / 128));
  let st = null;
  for (let r = 0; r < 10 && !st; r++) for (let v = -r; v <= r && !st; v++) for (let u = -r; u <= r; u++) { const x = Z.cx + u, y = Z.cy + v; if (w.k(y * N + x) === K.EMPTY && w.b(y * N + x) === Z.row) { st = [x - C, y - C]; break; } }
  farStart(game, st[0], st[1]); w.see(C + st[0], C + st[1], 16); game.changed(); game.update(1 / 60);
  const f = game.fauna, d = game.drill;
  game.S.fauna = { pal: { kind: 'pup', at: 0 }, met: {}, spent: [] };
  f.befriend(game, -1);
  const inside = f.stage(game, 'moth'), home = f.denAt(inside);
  check(inside >= 0 && home && w.row(home.anchor).pocket, 'no moth could be set down in the grotto');
  const pocket = (x, y) => w.row(Math.floor(y) * N + Math.floor(x)).pocket !== null;
  const [hx, hy] = homeward(game), bad = new Set();
  let outside = -1;
  const look = () => {
    for (let j = 0; j < FAUNA; j++) {
      if (!f.kind[j] || f.out[j]) continue;
      const den = f.denAt(j), at = f.where(j) === 0 ? [f.x[j], f.y[j] - 0.5] : [f.x[j], f.mid(j)];
      if (j === f.pal) { if (f.st[j] !== 9 && pocket(...at)) bad.add('the pal went into the grotto'); }
      else if (den && w.row(den.anchor).pocket && !pocket(...at)) bad.add(`a ${CREATURES[f.kind[j]].key} of the grotto left it`);
      else if (den && !w.row(den.anchor).pocket && pocket(...at)) bad.add(`a ${CREATURES[f.kind[j]].key} from outside went into the grotto`);
    }
  };
  // Out down the tunnel (the grotto's moths left behind), moths of the ground outside set down there in their place
  // (a kind staged has one den), and back in again.
  run(game, 200, [hx, hy, 0.5], look);
  check(!pocket(d.x, d.y), 'the drill did not get out of the grotto');
  for (let j = 0; j < FAUNA; j++) if (f.kind[j] === KIND.moth) f.drop(j);
  if (!pocket(d.x, d.y)) outside = f.stage(game, 'moth', 4);
  run(game, 300, [-hx, -hy, 0.5], look);
  run(game, 120, null, look);
  check(outside >= 0, 'no moth could be set down outside the grotto');
  check(!bad.size, [...bad].join('; '));
}

for (const f of fails) console.log(`FAIL ${f}`);
console.log(fails.length ? `${fails.length} failures` : 'the creatures do their jobs');
process.exit(fails.length ? 1 : 0);
