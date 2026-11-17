// The lords' fights, played at their lairs with the hull taking its knocks (js/bosses.js; js/fauna.js, its deeds;
// js/game.js: `lordBeaten`, `payOf`, `keepLore`). Each lord whose fight is built is held: the north's, the south's, the
// west's and the east's.
//   - The north, FROST WYRM: a band wound round it while it rests is a blow, and flown round it, the tether bent on
//     the rock behind its perch, too; the same band while it rises, tells, breathes, swims or is hurt is not, nor
//     one too far from it or with the drill too far; and a band left wound round it from before its rest began is
//     not, until it has come off and wound round again.
//   - The south, MAGMA BEHEMOTH: the drill flown into it while it rests, within 1.6 of its middle at 3 cells a second
//     or more, is a blow, and flown into it in a room at its lair, too; the same while it rises, tells, charges, tells
//     its charge back, swims or is hurt is not, nor slower, nor further, nor flying off it. Its charge hits a drill
//     standing in its lane once, through the rock between them, and changes no cell; it rests where the drill stood; a
//     drill stepped off the lane after it locks is not hit; and in its last stage it tells a charge back along the
//     same lane and rests where it rose.
//   - The west, SPORE MOTHER: the cell her tendril is anchored in, cut while she rests taut, is a blow, and flown into
//     and cut in a room at her lair, too; a cell beside it is not, nor that cell cut while she rises, tells, lashes,
//     tells her second tendril, holds the drill, follows it sunk or is hurt, nor after her rest when the tendril has
//     gone back. Her tendril holds a drill standing on her line: it flies at 0.6 of its speed, she drinks 1.5 seconds
//     on and 3.5 after, each a hit landed, and lets go at 6 seconds; 12 cells a second for half a second shakes her
//     off, 11 does not, nor 12 broken off short, and the drill reeled home is let go. Lashed at vault, bedrock or
//     unseen rock, the tendril comes back unanchored. From her second stage a second tendril is told 0.4 seconds
//     after the first, and comes back while the first is anchored.
//   - The east, CRYSTAL KING: as he rests a shard breaks from his crown, a loose piece of one cell of rich ore, two
//     to four cells from him, open ground all round it, SHARD_KEEP or more from the drill and on the narrowest
//     screen; hauled home it is a blow, and its ore is paid as a haul's, no specimens; flown round in a room at his
//     lair, too; one standing hauled as he tells is a blow, as he is hurt or yields or once he is asleep is not.
//     Cut, by the game's own cut or flown into, it is no blow, and he sheds another as he next rests. A ram is no
//     blow while a shard stands; with his SHARDS spent, or where no shard can be laid (a corridor a cell high), his
//     rest takes a ram, and a slow one is not. His pulse hits a drill inside his ring as the tell ends, once, and not
//     one outside it.
//   - Every lord: three blows give exactly one beaten, which pays BOSS_LUMP seconds of what cutting at the lair
//     earns with the refinery's share, BOSS_SPEC of its direction's specimens and its bit, and its banner; its
//     direction's gems are paid BOSS_PERK times as many for good (1.1 cubed with both its shrines), the others not;
//     it is never beaten twice and never woken again, a game saved and loaded keeps the bit and leaves it asleep.
//   - Losing: a wreck mid-fight leaves the lord asleep and whole and the ground as it was at the docking, its ice
//     gone; a wreck after the kill loses the bit and the pay; with the black box at its third level the lord is
//     kept as met and not as beaten; and led away past its leash for HEAL seconds it is whole, and wakes whole.
//   - The tether: 600 seconds of a seeded thumb in each fight, blows landed along the way: no cell a lord lays is
//     under the tether or within 1.5 of a drill flying free; no more than PLUGS of its ice a fight (the north lays
//     some, the south, the west and the east none); the tether never goes wrong; every cell the west's tendril is
//     anchored in is seen rock a drill can cut, not vault, relic, bedrock, the core or lava, inside the tether's
//     reach, ten times and more, and she holds the drill three times and more; and every shard the east sheds is a
//     loose piece of one cell when it is laid, SHARD_KEEP or more from the drill and not inside the tether's loop,
//     no more than SHARDS a fight, and five and more of them.
//   - Old saves: one with no `bosses` loads as nothing met or beaten, and one of generation 1 near a lair meets the
//     lord as a new game does, tell for tell.
// (The west's lashes are dodged, her latch refused, wherever a test waits for her rest: `dodge`.)
// Fails on the game before the lords, which has no js/bosses.js, and on the games before the south's, the west's and
// the east's, whose lords never wake.
//   node test/regress/s9-boss-play.mjs
import { makeGame, random, tetherFaults, setDown, farStart, tunnel, C, N, K, B as G } from '../harness.mjs';
import { income, round2 } from '../../js/shop.js';
import { BOSS_LUMP, BOSS_SPEC, BOSS_PERK } from '../../js/game.js';
import { BOSS, LAIR, LEASH, HEAL, PLUGS, SHARDS, ST, TW } from '../../js/bosses.js';
import { SHARD_KEEP } from '../../js/fauna.js';
import { winds } from '../../js/winds.js';
import { flyTo, rect } from './lib/lasso.mjs';
import { LORDS, NAMES, VERB, atLair, run, until, loopBand, loopRound, ramInto, cutAt, haulAt, dodge, beat, thumb, lairX, lairY, DX, DY } from './lib/lords.mjs';

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
check(LORDS.includes(3), 'the north\'s lord is not ready');
check(LORDS.includes(1), 'the south\'s lord is not ready');
check(LORDS.includes(2), 'the west\'s lord is not ready');
check(LORDS.includes(0), 'the east\'s lord is not ready');
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

// ---- the south: the ram
{
  const game = await atLair(1, { hull: false }), B = game.fauna.bosses;
  B.stageAs(game, 1, 'rest', 1);
  check(ramInto(game, 1) && B.blows[1] === 1 && B.stage[1] === 2 && B.st[1] === ST.HURT, `a ram into the south's lord at rest was not a blow (blows ${B.blows[1]}, state ${B.st[1]})`);
  check(!ramInto(game, 1), 'a ram into the south\'s lord as it is hurt was a blow');
  for (const what of ['rise', 'tell', 'act', 'return', 'sunk']) { B.stageAs(game, 1, what, 2); check(!ramInto(game, 1) && B.blows[1] === 1, `a ram into the south's lord as it ${what}s was a blow (state ${B.st[1]})`); }
  B.stageAs(game, 1, 'rest', 2);
  check(!ramInto(game, 1, { speed: 2.5 }), 'the drill flown into the south\'s lord at rest at 2.5 cells a second was a blow');
  check(!ramInto(game, 1, { off: 1.8 }), 'the drill flown toward the south\'s lord at rest 1.8 cells from it was a blow');
  check(!ramInto(game, 1, { away: true }), 'the drill flying off the south\'s lord at rest was a blow');
  check(ramInto(game, 1) && B.blows[1] === 2 && B.stage[1] === 3, `a ram into the south's lord at rest after those was not a blow (blows ${B.blows[1]})`);
}
// Flown, and charged: a room at the lair, the drill at its top.
const southRoom = async () => {
  const game = await atLair(1, { hull: false }), B = game.fauna.bosses, y0 = LAIR - 8;
  rect(game, -6, y0 - 1, 6, y0 + 8, K.EMPTY);
  game.world.see(C, C + y0 + 3, 12); game.changed(); game.pieces = [];
  return { game, B, y0 };
};
{
  const { game, B, y0 } = await southRoom();
  B.stageAs(game, 1, 'rest', 1, (C + y0 + 5) * N + C);
  let faults = null;
  const hold = () => { if (B.st[1] === ST.REST) B.t[1] = 0; const f = tetherFaults(game); if (f.length && !faults) faults = f[0]; };
  flyTo(game, 0, y0 + 7, { frames: 600, each: hold });
  check(B.blows[1] === 1, `the drill flown into the south's lord at rest was not a blow (state ${B.st[1]}, blows ${B.blows[1]})`);
  check(!faults, `the tether went wrong flying into the south's lord: ${faults}`);
}
{
  // Its charge: through a pillar of rock between it and the drill, the drill standing in the lane hit once and no
  // cell changed; at rest where the drill stood.
  const { game, B, y0 } = await southRoom(), w = game.world, d = game.drill;
  rect(game, 1, y0 + 2, 2, y0 + 3, K.DENSE); game.changed();
  const hits = [], tells = [], deed = game.fauna.deed.bind(game.fauna);
  game.fauna.deed = (g, what, a, c) => { const done = deed(g, what, a, c); if (what === 'hit' && done) hits.push(a); return done; };
  B.onTell = (lord, what, x, y, ex, ey) => tells.push({ what, x, y, ex, ey });
  const cells = () => { let n = 0; for (let y = y0 - 2; y <= y0 + 10; y++) for (let x = -8; x <= 8; x++) n = (n * 31 + w.k((C + y) * N + C + x)) | 0; return n; };
  const before = cells(), version = game.version, sx = d.x, sy = d.y;
  B.stageAs(game, 1, 'tell', 1, (C + y0 + 4) * N + C + 3);
  const rose = [B.x[1], B.y[1]];
  until(game, () => B.st[1] === ST.REST, 60 * 5);
  check(hits.length === 1 && hits[0] === BOSS[1].stun, `the south's charge at a drill standing in its lane hit it ${hits.length} times (${hits})`);
  check(cells() === before && game.version === version, 'the south\'s charge through rock changed the ground');
  check(B.st[1] === ST.REST && Math.hypot(B.x[1] - sx, B.y[1] - sy) < 0.01 && B.cell[1] === Math.floor(sy) * N + Math.floor(sx), `the south's lord did not rest where the drill stood (${(B.x[1] - C).toFixed(2)},${(B.y[1] - C).toFixed(2)}, state ${B.st[1]})`);
  // Stepped off the lane once it has locked: not hit.
  hits.length = 0; tells.length = 0;
  game.shield = 0;
  B.stageAs(game, 1, 'tell', 1, (C + y0 + 4) * N + C + 3);
  until(game, () => B.t[1] >= BOSS[1].tell[0] - 0.25, 60 * 3);
  setDown(game, -3, y0 + 2);
  until(game, () => B.st[1] === ST.REST, 60 * 5);
  check(hits.length === 0 && B.st[1] === ST.REST, `the south's charge hit a drill stepped off its lane after it locked (${hits.length} hits, state ${B.st[1]})`);
  // In its last stage: its charge, then its charge told back along the same lane, and at rest where it rose.
  setDown(game, 0, y0);
  hits.length = 0; tells.length = 0;
  game.shield = 999;
  B.stageAs(game, 1, 'tell', 3, (C + y0 + 4) * N + C + 3);
  const from = [B.x[1], B.y[1]];
  until(game, () => B.st[1] === ST.REST, 60 * 6);
  const [a, z] = tells, dot = a && z ? ((a.ex - a.x) * (z.ex - z.x) + (a.ey - a.y) * (z.ey - z.y)) / Math.hypot(a.ex - a.x, a.ey - a.y) / Math.hypot(z.ex - z.x, z.ey - z.y) : 0;
  check(tells.length === 2 && a.what === 'charge' && z.what === 'return' && dot < -0.999 && Math.hypot(z.x - sx, z.y - sy) < 0.01, `the south's last stage told ${tells.map(t => t.what).join(', ')} (the lanes ${dot.toFixed(3)} the one to the other)`);
  check(B.st[1] === ST.REST && Math.hypot(B.x[1] - from[0], B.y[1] - from[1]) < 0.01, `the south's lord after its charge back is ${B.st[1]} at ${(B.x[1] - C).toFixed(2)},${(B.y[1] - C).toFixed(2)}, not at rest where it rose`);
  check(rose[0] === from[0] && rose[1] === from[1], 'the south\'s lord rose in another place');
}

// ---- the west: the cut
// A room at her lair, the drill in it, a floor of soft rock under it: she roots five cells above the drill (on the
// narrowest screen), and her line down through the drill runs to the floor, seven cells under the drill.
const westRoom = async (wall = K.SOFT) => {
  const game = await atLair(2, { hull: false }), B = game.fauna.bosses;
  rect(game, -2206, -6, -2198, 6, K.EMPTY); rect(game, -2206, 7, -2198, 7, wall);
  game.world.see(C - 2202, C, 12); game.changed(); game.pieces = [];
  return { game, B, her: (C - 5) * N + C - 2202, wall: (C + 7) * N + C - 2202 };
};
const unsee = (game, x, y) => { const w = game.world; w.k(y * N + x); w.chunks[((y >> 6) << 8) | (x >> 6)].seen[((y & 63) << 6) | (x & 63)] = 0; };
{
  const { game, B, her, wall } = await westRoom();
  B.stageAs(game, 2, 'rest', 1, her);
  check(B.st[2] === ST.REST && B.anchor[2] === wall, `the west's lord at rest is not anchored in the wall behind the drill (${B.anchor[2] % N - C},${Math.floor(B.anchor[2] / N) - C})`);
  check(!cutAt(game, 2, wall + 1) && B.blows[2] === 0, 'a cell cut beside the west\'s anchor was a blow');
  check(cutAt(game, 2) && B.blows[2] === 1 && B.stage[2] === 2 && B.st[2] === ST.HURT && B.anchor[2] === -1 && B.latch[2] === -1, `her anchor cut while the west's lord rests taut was not a blow (blows ${B.blows[2]}, state ${B.st[2]})`);
  check(!cutAt(game, 2, wall), 'her anchor cut as the west\'s lord is hurt was a blow');
  for (const what of ['rise', 'tell', 'act', 'second', 'latch', 'sunk']) { B.stageAs(game, 2, what, 2, her); check(!cutAt(game, 2, wall) && B.blows[2] === 1, `her anchor's cell cut as the west's lord ${what === 'latch' ? 'holds the drill' : what + 's'} was a blow (state ${B.st[2]})`); }
  // Cut after her rest, the tendril gone back: no blow.
  B.stageAs(game, 2, 'rest', 2, her);
  check(until(game, () => B.st[2] !== ST.REST, 60 * 4) > 0 && B.anchor[2] === -1 && !cutAt(game, 2, wall) && B.blows[2] === 1, `her anchor cut after the west's lord had gone back was a blow (blows ${B.blows[2]}, state ${B.st[2]})`);
}
// Flown: the drill flies to her anchor and cuts it, as she rests taut.
{
  const { game, B, her, wall } = await westRoom();
  B.stageAs(game, 2, 'rest', 1, her);
  let faults = null;
  const hold = () => { if (B.st[2] === ST.REST) B.t[2] = 0; const f = tetherFaults(game); if (f.length && !faults) faults = f[0]; };
  flyTo(game, -2202, 7, { frames: 600, each: hold });
  check(B.blows[2] === 1 && game.world.k(wall) === K.EMPTY, `the drill flown into the west's anchor and cutting it was not a blow (state ${B.st[2]}, blows ${B.blows[2]}, the cell ${game.world.k(wall)})`);
  check(!faults, `the tether went wrong flying to the west's anchor: ${faults}`);
}
// Her latch: the drill standing on her line is held, flies at 0.6 of its speed, is drunk from 1.5 seconds on and
// 3.5 seconds after (each a hit through the shield's end), and let go after 6 seconds.
{
  const { game, B, her } = await westRoom(), hits = [], deed = game.fauna.deed.bind(game.fauna);
  game.fauna.deed = (g, what, a, c) => { const done = deed(g, what, a, c); if (what === 'hit') hits.push({ at: game.time, stun: a, done }); return done; };
  B.stageAs(game, 2, 'tell', 1, her);
  check(until(game, () => B.st[2] === ST.LATCH, 60 * 3) > 0, `the west's tendril did not hold a drill standing on her line (state ${B.st[2]})`);
  const t0 = game.time;
  run(game, 1);
  check(B.drag === BOSS[2].drag && game.fauna.drag === BOSS[2].drag && BOSS[2].drag === 0.6, `the drill held by the west's tendril flies at ${game.fauna.drag} of its speed`);
  const gone = until(game, () => B.latch[2] < 0, 60 * 8);
  const near = (a, b) => Math.abs(a - b) <= 1 / 60 + 1e-6;
  check(hits.length === 2 && hits.every(h => h.done && h.stun === 0.3) && near(hits[0].at - t0, 1.5) && near(hits[1].at - hits[0].at, 3.5), `held, the west's lord drank ${hits.map(h => `${(h.at - t0).toFixed(2)} s${h.done ? '' : ' (not landed)'}`).join(', ')}`);
  check(gone > 0 && near(game.time - t0, 6) && B.st[2] !== ST.LATCH && (run(game, 1), game.fauna.drag === 1), `the west's lord let the drill go ${(game.time - t0).toFixed(2)} s after holding it (drag ${game.fauna.drag})`);
}
// Shaken off: 12 cells a second for half a second frees the drill; 11 does not, nor 12 broken off; reeled home frees it.
{
  const { game, B, her } = await westRoom(), d = game.drill;
  B.stageAs(game, 2, 'latch', 1, her);
  const fly = (v, secs) => { for (let n = 0; n < Math.round(secs * 60); n++) { d.vx = v; d.vy = 0; B.step(game, 1 / 60); } d.vx = 0; };
  fly(11, 1);
  check(B.latch[2] >= 0, 'the drill flying 11 cells a second shook the west\'s tendril off');
  fly(12.5, 0.4); fly(6, 0.1); fly(12.5, 0.4);
  check(B.latch[2] >= 0, 'the drill flying 12 cells a second twice for less than half a second shook the west\'s tendril off');
  fly(12.5, 0.15);
  check(B.latch[2] < 0 && B.st[2] !== ST.LATCH, 'the drill flying 12 cells a second for half a second did not shake the west\'s tendril off');
  B.stageAs(game, 2, 'latch', 1, her);
  d.mode = 'home'; B.step(game, 1 / 60); d.mode = 'free';
  check(B.latch[2] < 0, 'the drill reeled home was still held by the west\'s tendril');
}
// Never anchored in vault, bedrock or unseen ground: the tendril comes back.
for (const [what, kind] of [['vault', K.VAULT], ['bedrock', K.BEDROCK], ['unseen ground', K.SOFT]]) {
  const { game, B, her, wall } = await westRoom(kind);
  if (what === 'unseen ground') for (let x = -2206; x <= -2198; x++) unsee(game, C + x, C + 7);
  dodge(game, 2);
  B.stageAs(game, 2, 'act', 1, her);
  const back = until(game, () => B.st[2] !== ST.ACT, 60 * 2);
  check(back > 0 && B.anchor[2] === -1 && B.st[2] === ST.RISE && game.world.peek(C - 2202, C + 7) === (what === 'unseen ground' ? -1 : kind), `the west's tendril lashed at ${what} left her ${B.st[2]}, anchored at ${B.anchor[2]}`);
}
// From her second stage, a second tendril told 0.4 seconds after the first; one anchored, the other back.
{
  const { game, B, her } = await westRoom(), tells = [], T0 = B.tendril, TD = T0.length / 3;
  dodge(game, 2);
  B.onTell = (lord, what) => tells.push({ what, at: game.time });
  B.stageAs(game, 2, 'tell', 2, her);
  let both = 0;
  until(game, () => { if (T0[0] === TW.ANCHOR && T0[TD] === TW.ANCHOR) both++; return B.st[2] === ST.REST && T0[TD] === TW.NONE; }, 60 * 4);
  check(tells.length === 2 && tells[0].what === 'lash' && tells[1].what === 'second' && Math.abs(tells[1].at - tells[0].at - BOSS[2].second) <= 1 / 60 + 1e-6, `the west's lord at her second stage told ${tells.map(t => `${t.what} at ${t.at.toFixed(2)}`).join(', ')}`);
  check(!both && B.st[2] === ST.REST && T0[0] === TW.ANCHOR && T0[TD] === TW.NONE, `both the west's tendrils were anchored (${both} frames), or the second did not come back (${T0[0]}, ${T0[TD]})`);
}

// ---- the east: the haul
// A room at his lair, the drill in it: he rests three cells up and to the west of the drill, his shard beside him.
const eastRoom = async () => {
  const game = await atLair(0, { hull: false }), B = game.fauna.bosses;
  rect(game, 2196, -6, 2208, 6, K.EMPTY);
  game.world.see(C + 2202, C, 12); game.changed(); game.pieces = [];
  return { game, B, him: (C - 3) * N + C + 2199 };
};
// A shard as it should be laid: a loose piece of one cell of rich ore, open ground all round it, two to four cells
// from him, SHARD_KEEP or more from the drill, on the narrowest screen and inside the tether's reach.
const shardFault = (game, B, c) => {
  const w = game.world, x = c % N + 0.5, y = Math.floor(c / N) + 0.5, far = Math.hypot(x - B.x[0], y - B.y[0]);
  if (c < 0) return 'none';
  if (w.k(c) !== K.ORE_B || game.pieceOf.get(c)?.length !== 1) return `kind ${w.k(c)}, piece of ${game.pieceOf.get(c)?.length}`;
  for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) if ((u || v) && w.peek(c % N + u, Math.floor(c / N) + v) !== K.EMPTY) return `ground beside it at ${u},${v}`;
  if (far < 2 - 1e-9 || far > 4 + 1e-9) return `${far.toFixed(2)} cells from him`;
  if (Math.hypot(x - game.drill.x, y - game.drill.y) < SHARD_KEEP) return 'by the drill';
  if (!B.inView(game, x, y) || !game.within(x, y)) return 'off the screen or past the reach';
  return null;
};
{
  const { game, B, him } = await eastRoom(), S = game.S;
  B.stageAs(game, 0, 'rest', 1, him);
  const sh = B.shard[0], fault = shardFault(game, B, sh);
  check(!fault && B.shards[0] === 1 && B.armed[0] === 0, `the east's lord at rest shed no shard as it should be (${fault}, ${B.shards[0]} shed)`);
  check(!ramInto(game, 0) && B.blows[0] === 0, 'a ram into the east\'s lord with his shard standing was a blow');
  // Hauled home: a blow, and its ore paid as a haul's.
  const pay = game.payOf([sh]), grit = S.grit, hauls = S.stats.hauls, spec = S.spec.join();
  check(haulAt(game, 0) && B.blows[0] === 1 && B.stage[0] === 2 && B.st[0] === ST.HURT && B.shard[0] === -1 && game.world.k(sh) === K.EMPTY, `the east's shard hauled home was not a blow (blows ${B.blows[0]}, state ${B.st[0]})`);
  check(pay.grit > 0 && S.grit - grit === pay.grit && S.stats.hauls === hauls + 1 && S.spec.join() === spec, `the east's shard hauled paid ${S.grit - grit} grit (its ore ${pay.grit}) in ${S.stats.hauls - hauls} hauls, specimens ${S.spec} (were ${spec})`);
  // One standing hauled as he tells is a blow; as he is hurt or yields, or once he is asleep, it is ore and no more.
  B.stageAs(game, 0, 'rest', 2, him); B.stageAs(game, 0, 'tell', 2, him);
  check(B.shard[0] >= 0 && haulAt(game, 0) && B.blows[0] === 2, `the east's shard hauled as he tells was not a blow (blows ${B.blows[0]})`);
  for (const what of ['hurt', 'yield', 'sleep']) {
    B.stageAs(game, 0, 'rest', 2, him);
    const c = B.shard[0];
    B.stageAs(game, 0, what, 2, him);
    const grit = S.grit, blows = B.blows[0];
    check(c >= 0 && !haulAt(game, 0, c) && B.blows[0] === blows && game.world.k(c) === K.EMPTY && S.grit > grit && B.shard[0] === -1, `the east's shard hauled as he ${what === 'sleep' ? 'sleeps' : what === 'hurt' ? 'is hurt' : 'yields'} was a blow, or was not hauled (blows ${B.blows[0]}, the cell ${game.world.k(c)})`);
  }
}
// Flown round, the tether bent on the shard itself: a blow.
{
  const { game, B, him } = await eastRoom();
  B.stageAs(game, 0, 'rest', 1, him);
  const sh = B.shard[0], sx = sh % N - C, sy = Math.floor(sh / N) - C, grit = game.S.grit;
  let faults = null;
  const hold = () => { if (B.st[0] === ST.REST) B.t[0] = 0; const f = tetherFaults(game); if (f.length && !faults) faults = f[0]; };
  for (const [x, y] of [[sx + 2, sy + 2], [sx + 2, sy - 2], [sx - 2, sy - 2], [sx - 2, sy + 2], [sx + 2, sy + 2]]) { if (B.blows[0]) break; flyTo(game, x, y, { frames: 600, each: hold }); }
  check(B.blows[0] === 1 && game.world.k(sh) === K.EMPTY && game.S.grit > grit, `the drill flown round the east's shard was not a blow (state ${B.st[0]}, blows ${B.blows[0]}, the cell ${game.world.k(sh)})`);
  check(!faults, `the tether went wrong flying round the east's shard: ${faults}`);
}
// Cut: no blow, by the game's own cut or flown into, and another shard as he next rests.
{
  const { game, B, him } = await eastRoom();
  B.stageAs(game, 0, 'rest', 1, him);
  const sh = B.shard[0];
  game.finishDig(sh); run(game, 1);
  check(B.blows[0] === 0 && B.shard[0] === -1 && game.world.k(sh) === K.EMPTY, `the east's shard cut was a blow, or not let go (blows ${B.blows[0]}, shard ${B.shard[0]})`);
  until(game, () => B.st[0] !== ST.REST, 60 * 5);
  check(until(game, () => B.st[0] === ST.REST, 60 * 10) >= 0 && B.shard[0] >= 0 && B.shard[0] !== sh && B.shards[0] === 2 && !shardFault(game, B, B.shard[0]), `the east's lord after his shard was cut shed no other as he next rested (state ${B.st[0]}, ${B.shards[0]} shed)`);
}
{
  const { game, B, him } = await eastRoom();
  B.stageAs(game, 0, 'rest', 1, him);
  const sh = B.shard[0];
  let faults = null;
  const hold = () => { if (B.st[0] === ST.REST) B.t[0] = 0; const f = tetherFaults(game); if (f.length && !faults) faults = f[0]; };
  flyTo(game, sh % N - C, Math.floor(sh / N) - C, { frames: 600, each: hold });
  check(B.blows[0] === 0 && B.shard[0] === -1 && game.world.k(sh) === K.EMPTY, `the drill flown into the east's shard was a blow, or did not cut it (blows ${B.blows[0]}, the cell ${game.world.k(sh)})`);
  check(!faults, `the tether went wrong flying into the east's shard: ${faults}`);
}
// His shards spent: his rest takes a ram, and a slow one is not a blow.
{
  const { game, B, him } = await eastRoom();
  B.stageAs(game, 0, 'rest', 1, him);
  B.shards[0] = SHARDS;
  check(haulAt(game, 0) && B.blows[0] === 1, 'the east\'s last shard hauled was not a blow');
  B.stageAs(game, 0, 'rest', 2, him);
  check(B.shard[0] === -1 && B.shards[0] === SHARDS && B.armed[0] === 1, `the east's lord with his shards spent shed another (${B.shards[0]}, armed ${B.armed[0]})`);
  check(!ramInto(game, 0, { speed: 2.5 }) && !ramInto(game, 0, { away: true }) && B.blows[0] === 1, 'a slow ram, or the drill flying off him, was a blow on the east\'s lord with his shards spent');
  check(ramInto(game, 0) && B.blows[0] === 2, `a ram into the east's lord with his shards spent was not a blow (blows ${B.blows[0]})`);
}
// Nowhere to lay one, a corridor a cell high: his rest takes a ram.
{
  const game = await atLair(0, { hull: false }), B = game.fauna.bosses;
  rect(game, 2190, -1, 2208, -1, K.SOFT); rect(game, 2190, 1, 2208, 1, K.SOFT);
  game.world.see(C + 2202, C, 12); game.changed(); game.pieces = [];
  B.stageAs(game, 0, 'rest', 1, C * N + C + 2198);
  check(B.shard[0] === -1 && B.shards[0] === 0 && B.armed[0] === 1 && ramInto(game, 0) && B.blows[0] === 1, `the east's lord in a corridor with no shard to shed did not take a ram (shard ${B.shard[0]}, armed ${B.armed[0]}, blows ${B.blows[0]})`);
}
// His pulse: a drill inside his ring as the tell ends is hit, once, at the tell's end; one outside it is not. (He
// tells at stage 1 with a ring of 3.5 and at stage 3 with one of 4.5, the drill 4.24 cells from him.)
{
  const { game, B, him } = await eastRoom(), hits = [], deed = game.fauna.deed.bind(game.fauna);
  game.fauna.deed = (g, what, a, c) => { const done = deed(g, what, a, c); if (what === 'hit') hits.push({ at: game.time, stun: a, done }); return done; };
  for (const n of [1, 3]) {
    hits.length = 0; game.shield = 0;
    B.stageAs(game, 0, 'tell', n, him);
    const t0 = game.time, far = Math.hypot(game.drill.x - B.x[0], game.drill.y - B.y[0]), inside = far <= BOSS[0].ring[n - 1];
    until(game, () => B.st[0] === ST.REST, 60 * 3);
    check(inside === (n === 3) && hits.length === (inside ? 1 : 0) && hits.every(h => h.done && h.stun === BOSS[0].stun && Math.abs(h.at - t0 - BOSS[0].tell[n - 1]) <= 1 / 60 + 1e-6),
      `the east's pulse at stage ${n}, the drill ${far.toFixed(2)} from him, hit ${hits.map(h => `at ${(h.at - t0).toFixed(2)} s`).join(', ') || 'nothing'}`);
  }
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
// The perk: ore of each direction paid with no lord beaten, with each lord's beaten, and with each and its
// direction's two shrines (the north's the north east's and the north west's, the south's the south east's and the
// south west's, the west's the south west's and the north west's).
{
  const game = await makeGame(7), w = game.world, S = game.S, ore = [];
  for (let k = 1; k <= 4; k++) for (let n = 0; n < 40; n++) { const i = (C - 30 + k) * N + C + 20 + n; w.setK(i, K.ORE_B); w.setB(i, k); ore.push(i); }
  const gems = (bits, held) => { S.bosses = bits; S.shrines = held; return game.payOf(ore).gems; };
  const none = gems(0, [0, 0, 0, 0]), met = gems(15, [0, 0, 0, 0]);
  const near = (a, b, by) => Math.abs(a - b * by) <= 1;
  const GEM = { 0: G.LODE, 1: G.EMBER, 2: G.MIRE, 3: G.FROST }, SHRINES = { 0: [1, 1, 0, 0], 1: [0, 1, 1, 0], 2: [0, 0, 1, 1], 3: [1, 0, 0, 1] };
  for (const b of LORDS) {
    const g = GEM[b], one = gems(1 << (4 + b) | 1 << b, [0, 0, 0, 0]), all = gems(1 << (4 + b), SHRINES[b]);
    check(near(one[g], none[g], BOSS_PERK) && [G.FROST, G.EMBER, G.MIRE, G.LODE].every(k => k === g || one[k] === none[k]) && one.slice(5).join() === none.slice(5).join(), `with the ${NAMES[b]}'s lord beaten the gems are ${one}, with none ${none}`);
    check(near(all[g], none[g], 1.331) && all[g] <= Math.round(none[g] * 1.331) + 1, `with the ${NAMES[b]}'s lord beaten and its two shrines its gems are ${all[g]}, with neither ${none[g]}`);
  }
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
    dodge(game, b);
    check(until(game, () => B.st[b] !== ST.SLEEP, 60 * 10, toward) >= 0, `flown toward its lair the ${NAMES[b]}'s lord never woke`);
    // (The north's fight with its ice laid.)
    const iced = BOSS[b].verb === 'loop';
    until(game, () => B.st[b] === ST.REST && (!iced || B.plugs[b] > 0), 60 * 40);
    check(VERB[b](game, b) && (!iced || B.plugs[b] > 0), `no blow${iced ? ' and ice' : ''} in the ${NAMES[b]}'s fight before the wreck (plugs ${B.plugs[b]})`);
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
    dodge(game, b);
    until(game, () => B.st[b] === ST.REST, 60 * 20);
    check(VERB[b](game, b) && B.blows[b] === 1, `no blow on the ${NAMES[b]}'s lord before it was led away`);
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
  let fight = 0, most = 0, blows = 0, shards = 0;
  const deed = game.fauna.deed.bind(game.fauna);
  game.fauna.deed = (g, what, a, c) => {
    if (what === 'plug' || what === 'shard') {
      const free = d.mode === 'free', was = what === 'shard' ? a : -1, inside = was >= 0 && winds(game.band, was % N + 0.5, Math.floor(was / N) + 0.5) !== 0, done = deed(g, what, a, c);
      if (done) for (const j of what === 'plug' ? game.fauna.plugged : [was]) {
        if (game.under.has(j)) bad.push(`a cell laid under the tether at ${j % N - C},${Math.floor(j / N) - C}`);
        if (free && Math.hypot(j % N + 0.5 - d.x, Math.floor(j / N) + 0.5 - d.y) < 1.5) bad.push(`a cell laid by a drill flying free at ${j % N - C},${Math.floor(j / N) - C}`);
        if (what === 'plug') { fight++; continue; }
        // (A shard: a loose piece of one cell as it is laid, open ground all round it, kept from the drill and
        // outside the tether's loop.)
        shards++;
        let open = true;
        for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) if ((u || v) && game.world.k(j + v * N + u) !== K.EMPTY) open = false;
        if (!open || game.world.k(j) !== K.ORE_B || game.pieceOf.get(j)?.length !== 1 || inside || Math.hypot(j % N + 0.5 - d.x, Math.floor(j / N) + 0.5 - d.y) < SHARD_KEEP) bad.push(`a shard laid at ${j % N - C},${Math.floor(j / N) - C} not a loose cell kept from the drill and the loop`);
      }
      return done;
    }
    if (what === 'boss-met') fight = 0;
    return deed(g, what, a, c);
  };
  const steer = thumb(game, b, random(600 + b), 12);
  let faults = null, rests = 0, wasRest = false, fights = 1, beaten = 0, anchored = 0, held = 0, wasHeld = false, anchor = -1;
  run(game, 600 * 60, steer, f => {
    most = Math.max(most, fight, B.plugs[b]);
    // (A blow landed on every third rest that no flight has, so that it fights at its last stage too; and beaten,
    // it is fought again: its bit taken back, it wakes anew. The thumb seldom cuts the west's anchor by chance, so
    // her third blow is landed too.)
    const rest = B.st[b] === ST.REST;
    if (rest && !wasRest && ++rests % 3 === 0 && B.blows[b] < (BOSS[b].verb === 'cut' || BOSS[b].verb === 'haul' ? 3 : 2) && VERB[b](game, b)) blows++;
    wasRest = rest;
    // (Every cell the west's tendril is anchored in, as it is anchored: seen rock a drill can cut, not vault, relic,
    // bedrock, the core or lava, inside the tether's reach; and the drill held now and then.)
    if (B.anchor[b] >= 0 && B.anchor[b] !== anchor) {
      const j = B.anchor[b], k = game.world.peek(j % N, Math.floor(j / N));
      anchored++;
      if (k <= 0 || k === K.VAULT || k === K.RELIC || k === K.BEDROCK || k === K.CORE || game.world.lava.has(j) || !game.within(j % N + 0.5, Math.floor(j / N) + 0.5)) bad.push(`an anchor in ${k} at ${j % N - C},${Math.floor(j / N) - C}`);
    }
    anchor = B.anchor[b];
    if (B.latch[b] >= 0 && !wasHeld) held++;
    wasHeld = B.latch[b] >= 0;
    if (B.st[b] === ST.GONE) { beaten++; game.S.bosses &= ~(1 << (4 + b)); B.heal(b); fights++; }
    if (f % 10 === 0 && !faults) { const t = tetherFaults(game); if (t.length) faults = `${(f / 60).toFixed(1)} s: ${t[0]}`; }
  });
  check(!bad.length, `in the ${NAMES[b]}'s fight: ${bad.slice(0, 3).join('; ')}`);
  check(most <= PLUGS && [...B.shards].every(n => n <= SHARDS), `in the ${NAMES[b]}'s fight a lord laid ${most} cells of ice in a fight`);
  check(!faults, `in the ${NAMES[b]}'s fight the tether went wrong at ${faults}`);
  check(blows >= 2 && fights >= 2 && (BOSS[b].verb === 'loop' ? most > 0 : most === 0), `the ${NAMES[b]}'s fight landed ${blows} blows, was fought ${fights} times and laid ${most} cells`);
  check(BOSS[b].verb !== 'cut' || (anchored >= 10 && held >= 3), `the west's fight was anchored ${anchored} times and held the drill ${held} times`);
  check(BOSS[b].verb === 'haul' ? shards >= 5 : shards === 0, `the ${NAMES[b]}'s fight shed ${shards} shards`);
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

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : `ok: each lord (${LORDS.map(b => NAMES[b]).join(', ')}) is beaten by its own verb and no other, three blows to one beaten that pays, is kept and is never fought again; a wreck takes the fight and the kill back with the ground; led away it heals; its ice and shards keep from the tether; an old save meets it as a new game does`);
process.exit(fails.length ? 1 : 0);
