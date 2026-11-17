// The lords' fights, played at their lairs with the hull taking its knocks (js/bosses.js; js/fauna.js, its deeds;
// js/game.js: `lordBeaten`, `payOf`, `keepLore`). Each lord whose fight is built is held; the north's first.
//   - The north, FROST WYRM: a band wound round it while it rests is a blow, and flown round it, the tether bent on
//     the rock behind its perch, too; the same band while it rises, tells, breathes, swims or is hurt is not, nor
//     one too far from it or with the drill too far; and a band left wound round it from before its rest began is
//     not, until it has come off and wound round again.
//   - Every lord: three blows give exactly one beaten, which pays BOSS_LUMP seconds of what cutting at the lair
//     earns with the refinery's share, BOSS_SPEC of its direction's specimens and its bit, and its banner; its
//     direction's gems are paid BOSS_PERK times as many for good (1.1 cubed with both its shrines), the others not;
//     it is never beaten twice and never woken again, a game saved and loaded keeps the bit and leaves it asleep.
//   - Losing: a wreck mid-fight leaves the lord asleep and whole and the ground as it was at the docking, its ice
//     gone; a wreck after the kill loses the bit and the pay; with the black box at its third level the lord is
//     kept as met and not as beaten; and led away past its leash for HEAL seconds it is whole, and wakes whole.
//   - The tether: 600 seconds of a seeded thumb in each fight, blows landed along the way: no cell a lord lays is
//     under the tether or within 1.5 of a drill flying free; no more than PLUGS of its ice a fight; the tether never
//     goes wrong.
//   - Old saves: one with no `bosses` loads as nothing met or beaten, and one of generation 1 near a lair meets the
//     lord as a new game does, tell for tell.
// Fails on the game before the lords, which has no js/bosses.js.
//   node test/regress/s9-boss-play.mjs
import { makeGame, random, tetherFaults, setDown, farStart, tunnel, C, N, K, B as G } from '../harness.mjs';
import { income, round2 } from '../../js/shop.js';
import { BOSS_LUMP, BOSS_SPEC, BOSS_PERK } from '../../js/game.js';
import { BOSS, LAIR, LEASH, HEAL, PLUGS, SHARDS, ST } from '../../js/bosses.js';
import { flyTo, rect } from './lib/lasso.mjs';
import { LORDS, NAMES, atLair, run, until, loopBand, loopRound, beat, thumb, lairX, lairY, DX, DY } from './lib/lords.mjs';

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
check(LORDS.includes(3), 'the north\'s lord is not ready');
const wound = (game, band) => { const was = game.band; game.band = band; game.fauna.wound(game); game.band = was; };
const wreck = game => { while (game.drill.mode !== 'dead') { game.shield = 0; game.hit(0.3); } };

// ---- the north: the loop
{
  const game = await atLair(3, { hull: false }), B = game.fauna.bosses;
  B.stageAs(game, 3, 'rest', 1);
  check(loopRound(game, 3) && B.blows[3] === 1 && B.stage[3] === 2 && B.st[3] === ST.HURT, `a loop round the north's lord at rest was not a blow (blows ${B.blows[3]}, state ${B.st[3]})`);
  check(!loopRound(game, 3), 'a loop round the north\'s lord as it is hurt was a blow');
  for (const what of ['rise', 'tell', 'act', 'sunk']) { B.stageAs(game, 3, what, 2); check(!loopRound(game, 3) && B.blows[3] === 1, `a loop round the north's lord as it ${what}s was a blow`); }
  // Too far: the band more than five cells from it, or the drill more than fourteen.
  B.stageAs(game, 3, 'rest', 2);
  const u = B.x[3], d = game.drill, dx = d.x, dy = d.y;
  d.x = u + 8; d.y = B.y[3]; wound(game, loopBand(game, 3, 7));
  check(B.blows[3] === 1, 'a band seven cells round the north\'s lord was a blow');
  d.x = u + 15; wound(game, loopBand(game, 3)); d.x = dx; d.y = dy;
  check(B.blows[3] === 1, 'a loop round the north\'s lord with the drill fifteen cells off was a blow');
  // Left wound from before its rest: no blow, until the band has come off it and wound round again.
  B.stageAs(game, 3, 'tell', 2);
  const was = game.band; game.band = loopBand(game, 3); B.rest(game, 3); game.band = was;
  wound(game, loopBand(game, 3));
  check(B.blows[3] === 1, 'a band left wound round the north\'s lord from before its rest was a blow');
  wound(game, game.band);
  check(B.blows[3] === 1 && loopRound(game, 3) && B.blows[3] === 2 && B.stage[3] === 3, `a band wound round the north's lord again after coming off it was not a blow (blows ${B.blows[3]})`);
}
// Flown: a room at the lair with a pillar of rock, the lord resting before the pillar, the drill flown round both.
{
  const game = await atLair(3, { hull: false, short: 6 }), B = game.fauna.bosses, y0 = -2204;
  rect(game, -6, y0 - 11, 6, y0 + 1, K.EMPTY); rect(game, -1, y0 - 7, 1, y0 - 6, K.DENSE);
  game.world.see(C, C + y0 - 5, 12); game.changed(); game.pieces = [];
  B.stageAs(game, 3, 'rest', 1, (C + y0 - 4) * N + C);
  check(B.x[3] === C + 0.5 && B.y[3] === C + y0 - 3.5, `the north's lord was not set down before the pillar (${B.x[3] - C},${B.y[3] - C})`);
  // (It is held at rest while the drill flies.)
  let faults = null;
  const hold = () => { if (B.st[3] === ST.REST) B.t[3] = 0; const f = tetherFaults(game); if (f.length && !faults) faults = f[0]; };
  for (const [x, y] of [[4, y0], [4, y0 - 10], [-4, y0 - 10], [-4, y0 - 1]]) { if (B.blows[3]) break; flyTo(game, x, y, { frames: 600, each: hold }); }
  check(B.blows[3] === 1, `the drill flown round the north's lord and the pillar behind it was not a blow (state ${B.st[3]}, band ${game.band.length} points)`);
  check(!faults, `the tether went wrong flying round the north's lord: ${faults}`);
}

// ---- every lord: beaten, paid, once
for (const b of LORDS) {
  const game = await atLair(b, { hull: false }), B = game.fauna.bosses, S = game.S, kin = [4, 2, 3, 1][b];
  let beaten = 0;
  const deed = game.fauna.deed.bind(game.fauna);
  game.fauna.deed = (g, what, a, c) => { const done = deed(g, what, a, c); if (what === 'beaten' && done) beaten++; return done; };
  const spec0 = S.spec[kin], expected = Math.round(round2(income(LAIR) * BOSS_LUMP) * game.val('refinery'));
  check(beat(game, b), `the ${NAMES[b]}'s lord was not beaten by three blows (state ${B.st[b]}, blows ${B.blows[b]})`);
  check(beaten === 1 && ((S.bosses ?? 0) >> (4 + b) & 1) && ((S.bosses ?? 0) >> b & 1), `beating the ${NAMES[b]}'s lord: ${beaten} beaten, bits ${S.bosses}`);
  check(game.fauna.paid.grit === expected && S.grit >= expected && S.spec[kin] - spec0 === BOSS_SPEC && game.fauna.paid.spec[kin] === BOSS_SPEC, `the ${NAMES[b]}'s lord paid ${game.fauna.paid.grit} grit (not ${expected}) and ${S.spec[kin] - spec0} specimens`);
  check(game.banner?.lord === b && game.banner.title === BOSS[b].name && game.banner.sub === 'BEATEN!', `the ${NAMES[b]}'s lord beaten said ${game.banner?.title} ${game.banner?.sub}`);
  // Never again: flown about its lair forty seconds, it does not wake, and nothing more is paid.
  const steer = thumb(game, b, random(3), 12);
  run(game, 40 * 60, steer);
  check(beaten === 1 && (B.st[b] === ST.SLEEP || B.st[b] === ST.GONE), `the ${NAMES[b]}'s lord beaten woke again (state ${B.st[b]}, beaten ${beaten})`);
  // Saved and loaded: the bit is kept, and it sleeps at its lair.
  game.save();
  const again = await makeGame(7, {}, { fauna: true, hull: true });
  await again.restore();
  check(((again.S.bosses ?? 0) >> (4 + b) & 1) === 1, `the ${NAMES[b]}'s lord beaten was not saved (${again.S.bosses})`);
  again.S.lv.tether = 9;
  const r = LAIR - 8;
  tunnel(again, DX[b] * r, DY[b] * r); setDown(again, DX[b] * r, DY[b] * r); again.world.see(C + DX[b] * r, C + DY[b] * r, 12); again.changed();
  run(again, 5 * 60);
  check(again.fauna.bosses.st[b] === ST.SLEEP, `the ${NAMES[b]}'s lord beaten woke in a game loaded (state ${again.fauna.bosses.st[b]})`);
}
// The perk: ore of each direction paid with no lord beaten, with the north's, and with the north's and its two
// shrines.
{
  const game = await makeGame(7), w = game.world, S = game.S, ore = [];
  for (let k = 1; k <= 4; k++) for (let n = 0; n < 40; n++) { const i = (C - 30 + k) * N + C + 20 + n; w.setK(i, K.ORE_B); w.setB(i, k); ore.push(i); }
  const gems = (bits, held) => { S.bosses = bits; S.shrines = held; return game.payOf(ore).gems; };
  const none = gems(0, [0, 0, 0, 0]), north = gems(1 << 7 | 1 << 3, [0, 0, 0, 0]), all = gems(1 << 7, [1, 0, 0, 1]), met = gems(15, [0, 0, 0, 0]);
  const near = (a, b, by) => Math.abs(a - b * by) <= 1;
  check(near(north[G.FROST], none[G.FROST], BOSS_PERK) && [G.EMBER, G.MIRE, G.LODE].every(g => north[g] === none[g]) && north.slice(5).join() === none.slice(5).join(), `with the north's lord beaten the gems are ${north}, with none ${none}`);
  check(near(all[G.FROST], none[G.FROST], 1.331) && all[G.FROST] <= Math.round(none[G.FROST] * 1.331) + 1, `with the north's lord beaten and its two shrines the north's gems are ${all[G.FROST]}, with neither ${none[G.FROST]}`);
  check(met.join() === none.join(), `with every lord met and none beaten the gems are ${met}, with none ${none}`);
}

// ---- losing
for (const b of LORDS) {
  // A wreck mid-fight: the lord asleep and whole, the ground as it was at the docking.
  {
    const game = await atLair(b, { short: 30, dug: 8 }), B = game.fauna.bosses, w = game.world;
    game.dockMark();
    const docked = game.S.bosses ?? 0, cells = [], lx = Math.floor(lairX(b)), ly = Math.floor(lairY(b));
    for (let y = ly - 40; y <= ly + 40; y++) for (let x = lx - 40; x <= lx + 40; x++) cells.push(w.k(y * N + x));
    const toward = [DX[b], DY[b], 1];
    game.shield = 999;
    check(until(game, () => B.st[b] !== ST.SLEEP, 60 * 10, toward) >= 0, `flown toward its lair the ${NAMES[b]}'s lord never woke`);
    until(game, () => B.st[b] === ST.REST && B.plugs[b] > 0, 60 * 40);
    check(loopRound(game, b) && B.plugs[b] > 0, `no blow and ice in the ${NAMES[b]}'s fight before the wreck (plugs ${B.plugs[b]})`);
    wreck(game); run(game, 120);
    let same = true, n = 0;
    for (let y = ly - 40; y <= ly + 40; y++) for (let x = lx - 40; x <= lx + 40; x++) if (w.k(y * N + x) !== cells[n++]) same = false;
    check([...B.st].every(s => s === ST.SLEEP) && [...B.blows].every(k => k === 0) && same && (game.S.bosses ?? 0) === docked && game.drill.mode === 'free',
      `a wreck mid-fight with the ${NAMES[b]}'s lord left it ${B.st[b]} with ${B.blows[b]} blows, bits ${game.S.bosses} (docked ${docked}), the ground ${same ? 'as' : 'not as'} it was`);
  }
  // A wreck after the kill: the bit and the pay are lost; with the black box at its third level the lord is kept as
  // met, and not as beaten.
  for (const box of [0, 3]) {
    const game = await atLair(b, { short: 30, dug: 8, levels: { blackbox: box } }), B = game.fauna.bosses, kin = [4, 2, 3, 1][b];
    game.dockMark();
    const S0 = JSON.parse(game.docked);
    game.shield = 999;
    until(game, () => B.st[b] !== ST.SLEEP, 60 * 10, [DX[b], DY[b], 1]);
    check(beat(game, b) && (game.S.bosses >> (4 + b) & 1), `the ${NAMES[b]}'s lord was not beaten before the wreck`);
    let at = null;
    const revert = game.revert.bind(game);
    game.revert = () => { revert(); at = { grit: game.S.grit, spec: game.S.spec[kin], bosses: game.S.bosses ?? 0 }; };
    wreck(game); run(game, 120);
    check(at && at.spec === S0.spec[kin] && (at.bosses >> (4 + b) & 1) === 0, `a wreck after the ${NAMES[b]}'s lord was beaten kept ${JSON.stringify(at)} (docked ${S0.spec[kin]} specimens)`);
    check(at && (box ? at.grit > S0.grit : at.grit === S0.grit), `a wreck after the ${NAMES[b]}'s lord was beaten, the black box at ${box}, left ${at?.grit} grit (docked ${S0.grit})`);
    check(at && at.bosses === (box >= 3 ? (S0.bosses ?? 0) | 1 << b : S0.bosses ?? 0), `a wreck after the ${NAMES[b]}'s lord was beaten, the black box at ${box}, left its bits ${at?.bosses}`);
  }
  // Led away: past its leash for HEAL seconds it is whole, and it wakes whole.
  {
    const game = await atLair(b, { hull: false }), B = game.fauna.bosses;
    until(game, () => B.st[b] === ST.REST, 60 * 20);
    check(loopRound(game, b) && B.blows[b] === 1, `no blow on the ${NAMES[b]}'s lord before it was led away`);
    const home = [-DX[b], -DY[b], 1];
    until(game, () => Math.hypot(game.drill.x - lairX(b), game.drill.y - lairY(b)) > LEASH + 4, 60 * 20, home);
    run(game, (HEAL + 1) * 60);
    check(B.st[b] === ST.SLEEP && B.blows[b] === 0 && B.stage[b] === 1, `led ${LEASH + 4} cells from its lair for ${HEAL + 1} seconds the ${NAMES[b]}'s lord is ${B.st[b]} with ${B.blows[b]} blows`);
    check(until(game, () => B.st[b] !== ST.SLEEP, 60 * 20, [DX[b], DY[b], 1]) >= 0 && B.blows[b] === 0 && B.stage[b] === 1, `the ${NAMES[b]}'s lord led away did not wake whole on the drill's return`);
  }
}

// ---- the tether, 600 seconds of each fight
for (const b of LORDS) {
  const game = await atLair(b, { hull: false, seed: 11 }), B = game.fauna.bosses, d = game.drill, bad = [];
  let fight = 0, most = 0, blows = 0;
  const deed = game.fauna.deed.bind(game.fauna);
  game.fauna.deed = (g, what, a, c) => {
    if (what === 'plug' || what === 'shard') {
      const free = d.mode === 'free', was = what === 'shard' ? a : -1, done = deed(g, what, a, c);
      if (done) for (const j of what === 'plug' ? game.fauna.plugged : [was]) {
        if (game.under.has(j)) bad.push(`a cell laid under the tether at ${j % N - C},${Math.floor(j / N) - C}`);
        if (free && Math.hypot(j % N + 0.5 - d.x, Math.floor(j / N) + 0.5 - d.y) < 1.5) bad.push(`a cell laid by a drill flying free at ${j % N - C},${Math.floor(j / N) - C}`);
        fight++;
      }
      return done;
    }
    if (what === 'boss-met') fight = 0;
    return deed(g, what, a, c);
  };
  const steer = thumb(game, b, random(600 + b), 12);
  let faults = null, rests = 0, wasRest = false, fights = 1, beaten = 0;
  run(game, 600 * 60, steer, f => {
    most = Math.max(most, fight, B.plugs[b]);
    // (A blow landed on every third rest that no flight has, so that it fights at its last stage too; and beaten,
    // it is fought again: its bit taken back, it wakes anew.)
    const rest = B.st[b] === ST.REST;
    if (rest && !wasRest && ++rests % 3 === 0 && B.blows[b] < 2 && loopRound(game, b)) blows++;
    wasRest = rest;
    if (B.st[b] === ST.GONE) { beaten++; game.S.bosses &= ~(1 << (4 + b)); B.heal(b); fights++; }
    if (f % 10 === 0 && !faults) { const t = tetherFaults(game); if (t.length) faults = `${(f / 60).toFixed(1)} s: ${t[0]}`; }
  });
  check(!bad.length, `in the ${NAMES[b]}'s fight: ${bad.slice(0, 3).join('; ')}`);
  check(most <= PLUGS && [...B.shards].every(n => n <= SHARDS), `in the ${NAMES[b]}'s fight a lord laid ${most} cells of ice in a fight`);
  check(!faults, `in the ${NAMES[b]}'s fight the tether went wrong at ${faults}`);
  check(blows >= 2 && fights >= 2 && most > 0, `the ${NAMES[b]}'s fight landed ${blows} blows, was fought ${fights} times and laid ${most} cells`);
}

// ---- old saves
for (const b of LORDS) {
  // A save with no lords in it.
  const first = await makeGame(7, { tether: 9 }, { fauna: true });
  delete first.S.bosses; first.S.gen = 1;
  first.save();
  check(!/"bosses"/.test(localStorage.getItem('tetherbore-save-v3')), 'the old save has lords in it');
  const old = await makeGame(7, {}, { fauna: true, hull: true });
  check(await old.restore() && !('bosses' in old.S) && (old.S.bosses ?? 0) === 0, `an old save loaded with lords ${old.S.bosses}`);
  // Near the lair, it meets the lord as a new game does, tell for tell.
  const logs = [];
  for (const game of [old, await makeGame(7, { tether: 9 }, { fauna: true, hull: true })]) {
    game.S.lv.tether = 9; game.S.lv.drill = 4; game.S.lv.hull = 4;
    Math.random = random(5);
    const r = LAIR - 8;
    game.fauna.reset(game.S.seed, game);
    farStart(game, DX[b] * r, DY[b] * r); game.world.see(C + DX[b] * r, C + DY[b] * r, 12); game.changed();
    const log = [];
    game.fauna.bosses.onTell = (lord, what, x, y, ex, ey) => log.push(`${game.time.toFixed(2)} ${what} ${(x - C).toFixed(2)},${(y - C).toFixed(2)}`);
    run(game, 20 * 60);
    logs.push({ log: log.join(' | '), met: (game.S.bosses ?? 0) >> b & 1 });
  }
  check(logs[0].met && logs[0].log && logs[0].log === logs[1].log, `an old save near the ${NAMES[b]}'s lair met it ${logs[0].met ? '' : 'not '}as a new game: ${logs[0].log.slice(0, 200)} / ${logs[1].log.slice(0, 200)}`);
}

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : `ok: each lord (${LORDS.map(b => NAMES[b]).join(', ')}) is beaten by its own verb and no other, three blows to one beaten that pays, is kept and is never fought again; a wreck takes the fight and the kill back with the ground; led away it heals; its ice keeps from the tether; an old save meets it as a new game does`);
process.exit(fails.length ? 1 : 0);
