// What a frame works in is made once and kept, not made anew every frame for the collector to sweep away.
//   - Over the fuzz's flight (seed 11, every row at its last, the tether's canvas there), stepped and drawn: the
//     lists of particles, rings, motes, effects, popups, clouds and a fumarole's jets are the same lists from the
//     first frame to the last (they are kept in place, `keepIf`); the probe that adds up what the parts of a frame
//     took is one object, its names there from the first, set to 0 again by `frameTook`; where the drill is drawn
//     (`drillDrawn`), the box the ropes were drawn in (`ropeDirty`), where the dark is laid (`darkAt`) and the
//     tether's rope and its points are the same each frame; and a haul's loop and line home are a rope each, kept
//     on the haul with their points, for as long as the haul is drawn.
//     The rubble is jostled by the grid of its box (`JOSTLED`), never by the table of hashed chains, which is for
//     heaps wider than any this flight brings home and took a fifth as long again.
//   - Each part of a frame that is timed by name is wrapped by a function of as many arguments as the part takes,
//     so a call makes no list of them.
//   - A loose piece cut in two, and cut again, two cells at a time, splits into pieces that are each one piece of
//     ground, together all that is left of it, and no cell in two: what is followed is marked in bytes kept from
//     one split to the next, and every mark is clear again when a split is done.
//   node test/regress/r-made-once.mjs
import { makeGame, random, wander, UPGRADES, WORKS, MAPS, CORE, N, C, K, Game } from '../harness.mjs';
const { JOSTLED } = await import('../../js/game.js');

const fails = [], check = (ok, what) => { if (!ok && fails.length < 20) fails.push(what); };

// ---- a flight, stepped and drawn
{
  Math.random = random(16);
  const game = await makeGame(11, { tether: 5, drill: 4 });
  for (const u of [...UPGRADES, ...WORKS, ...MAPS, ...CORE]) if (u.id !== 'tether') game.S.lv[u.id] = u.values.length - 1;
  game.over = document.createElement('canvas'); game.overCtx = game.over.getContext('2d'); game.resize(360, 640, 1);
  const LISTS = ['parts', 'rings', 'motes', 'effects', 'popups', 'clouds', 'jets'];
  const lists = LISTS.map(name => game[name]), probe = game.probe;
  const same = { drill: null, dirty: null, dark: null, tether: null, tetherPts: null };
  const kept = new Map();   // each haul drawn, and its two ropes as first seen
  let frames = 0, drawnHauls = 0, tethers = 0, moved = 0;
  for (const auto of wander(random(11), 140)) {
    game.input.auto = auto;
    game.update(1 / 60);
    game.render();
    game.frameTook(16, 1, 1);
    frames++;
    for (const name of ['drill', 'dirty', 'dark']) {
      const now = name === 'drill' ? game.drillDrawn : name === 'dirty' ? game.ropeDirty : game.darkAt;
      if (!now) continue;
      if (same[name] === null) same[name] = now; else if (same[name] !== now) { check(false, `${name === 'drill' ? 'drillDrawn' : name === 'dirty' ? 'ropeDirty' : 'darkAt'} was made again in frame ${frames}`); same[name] = now; }
    }
    const tether = game.ropes.find(r => r.pulse);
    if (tether) {
      tethers++;
      if (same.tether === null) { same.tether = tether; same.tetherPts = tether.pts; }
      else if (same.tether !== tether || same.tetherPts !== tether.pts) { check(false, `the tether's rope or its points were made again in frame ${frames}`); same.tether = tether; same.tetherPts = tether.pts; }
    }
    for (const h of game.hauls) {
      const loop = game.ropes.find(r => r.loop && h.drawn && r === h.drawn.loop), line = h.drawn && game.ropes.includes(h.drawn.line) ? h.drawn.line : null;
      if (!loop && !line) continue;
      const was = kept.get(h);
      if (!was) { kept.set(h, { loop, line, loopPts: loop?.pts, linePts: line?.pts }); drawnHauls++; continue; }
      if ((loop && was.loop && (loop !== was.loop || loop.pts !== was.loopPts)) || (line && was.line && (line !== was.line || line.pts !== was.linePts))) { moved++; kept.set(h, { loop, line, loopPts: loop?.pts, linePts: line?.pts }); }
    }
  }
  LISTS.forEach((name, i) => check(game[name] === lists[i], `the list of ${name} was made again in the flight`));
  check(game.probe === probe && Object.values(probe).every(ms => ms === 0) && 'updateHauls' in probe && 'fauna' in probe && 'ropes' in probe, `the probe was made again, or left with ${JSON.stringify(game.probe)}`);
  check(same.drill && same.dark && same.dirty && tethers > 100, `the flight drew the drill ${!!same.drill}, the dark ${!!same.dark}, ropes ${!!same.dirty} and the tether ${tethers} times`);
  check(drawnHauls >= 5 && moved === 0, `of ${drawnHauls} hauls drawn with their ropes, ${moved} had a rope or its points made again`);
  check(game.ropes.every(r => !('trace' in r)), 'a rope was given a closure to trace it by');
  check(JOSTLED.grid > 1000 && JOSTLED.table === 0, `the rubble was jostled ${JOSTLED.grid} times by the grid and ${JOSTLED.table} by the table of chains`);
}

// ---- the parts timed by name
{
  const game = await makeGame(7);
  const proto = Game.prototype, params = f => { const head = /^[^(]*\(([^)]*)\)/.exec(f.toString())?.[1].trim() ?? ''; return head ? head.split(',').length : 0; };
  for (const name of ['save', 'changed', 'haul', 'revert', 'updateHazards', 'updateHauls', 'homecoming', 'sweepHome', 'look']) {
    check(game[name] !== proto[name], `${name} is not timed`);
    check(game[name].length === params(proto[name]), `${name} takes ${params(proto[name])} arguments and is timed by a function of ${game[name].length}`);
  }
  // (What a timed part gives back, and throws, it gives back and throws.)
  const sweep = proto.sweepHome;
  proto.sweepHome = function (due) { if (due === 'throw') throw new Error('thrown'); return [this === game, due]; };
  const again = await makeGame(7);
  let thrown = null;
  try { again.sweepHome('throw'); } catch (error) { thrown = error.message; }
  const back = again.sweepHome(3);
  proto.sweepHome = sweep;
  check(thrown === 'thrown' && back[1] === 3 && again.probe.sweepHome > 0 || thrown === 'thrown' && back[1] === 3 && again.probeOrder.includes('sweepHome'), `a timed part gave back ${JSON.stringify(back)} and threw ${thrown}`);
}

// ---- a loose piece split, and split again
{
  Math.random = random(3);
  const game = await makeGame(7, { tether: 9, drill: 4 }), w = game.world, side = 40;
  const x0 = C - (side >> 1), y0 = C - 200 - side;
  for (let y = y0 - 1; y <= y0 + side; y++) for (let x = x0 - 1; x <= x0 + side; x++) w.setK(y * N + x, x === x0 - 1 || x === x0 + side || y === y0 - 1 || y === y0 + side ? K.EMPTY : K.SOFT);
  for (let y = y0 + side; y <= C - 3; y++) w.setK(y * N + C, K.EMPTY);
  game.changed(); game.enter(w.pieceIn(y0 * N + x0, -Infinity, -Infinity, Infinity, Infinity, Infinity));
  const block = [];
  for (let y = y0; y < y0 + side; y++) for (let x = x0; x < x0 + side; x++) block.push(y * N + x);
  const whole = () => {
    const left = new Set(block.filter(i => w.k(i) !== K.EMPTY)), seen = new Set();
    let pieces = 0;
    for (const p of game.pieces) {
      if (!p.some(i => left.has(i))) continue;
      pieces++;
      const mine = new Set(p), from = [p[0]], met = new Set(from);
      for (let k = 0; k < from.length; k++) for (const s of [1, -1, N, -N]) { const j = from[k] + s; if (mine.has(j) && !met.has(j)) { met.add(j); from.push(j); } }
      if (met.size !== p.length || p.some(i => !left.has(i) || game.pieceOf.get(i) !== p)) return `a piece of ${p.length} cells is not one piece of what is left`;
      for (const i of p) { if (seen.has(i)) return `a cell is in two pieces`; seen.add(i); }
    }
    return seen.size === left.size ? pieces : `${left.size - seen.size} cells of what is left are in no piece`;
  };
  // A cut across the block two cells at a time, from its west side to its east, then one down its middle.
  const said = [];
  for (let x = x0; x < x0 + side; x += 2) { const cut = [(y0 + 20) * N + x, (y0 + 20) * N + x + 1]; for (const c of cut) w.setK(c, K.EMPTY); game.changed(cut); said.push(whole()); }
  for (let y = y0; y < y0 + 20; y += 2) { const cut = [y * N + x0 + 20, (y + 1) * N + x0 + 20]; for (const c of cut) w.setK(c, K.EMPTY); game.changed(cut); said.push(whole()); }
  check(said.every(n => typeof n === 'number') && said.length === 30 && said[18] === 1 && said[19] === 2 && said[28] === 2 && said[29] === 3, `the block cut across and down was ${JSON.stringify(said)} pieces`);
}

if (fails.length) { console.log(`DEFECT: ${fails.join('; ')}`); process.exit(1); }
console.log('No defect: the lists of a frame are kept in place, the probe, where the drill and the dark are drawn and the ropes with their points are made once, a timed part takes its own arguments, and a piece split again and again splits whole');
