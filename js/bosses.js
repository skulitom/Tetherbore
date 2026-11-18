// The four lords at the ends: one at the far end of each direction's axis, LAIR cells out, past the relic and inside
// the last reach, the living kind of its direction's fossil. Each has a verb of its own that beats it, the game's own
// verbs: the north's FROST WYRM is beaten by a loop of the tether wound round it while it rests (LOOP), the south's
// MAGMA BEHEMOTH by the drill flown into it while it rests (RAM), the west's SPORE MOTHER by the cell her tendril is
// anchored in cut while she rests taut (CUT), the east's CRYSTAL KING by the shard he sheds as he rests hauled home
// by a loop of the tether (HAUL). Each takes BLOWS blows, and each blow raises its stage: every tell and rest of the stage after is shorter, and the last
// stage has a trick more. Nothing hurts on contact; only a told attack does, and every tell starts on the screen and
// lasts LEAST_TELL seconds at the least.
//
// Where. A lord sleeps at its lair until the drill comes within WAKE cells of it (rumbling within NEAR), then wakes:
// it is met (its bit in S.bosses), its name comes up, and after GRACE it fights about the drill, sunk in the rock
// between its attacks and rising each time at a spot near the drill (`spotNear`): seen, open, inside the tether's
// reach, near its lair and on the narrowest screen. Flown LEASH cells or more from its lair for HEAL seconds it sinks
// and is whole again. Its third blow yields it: it is beaten (`beaten`, paid and kept by js/game.js), its husk lies
// where it sank until the drill is HUSK cells off, and it never wakes again in that world. A trip lost takes all of
// that back with the ground and what was banked, as it takes a relic: a kill is kept only if the drill gets home.
//
// What must stay true (test/regress/s9-bosses.mjs holds it):
//   - It never draws from Math.random: it has a generator of its own on the seed (salt 808; the creatures' own
//     stream is untouched).
//   - Everything it does to the game is one of the creatures' deeds (js/fauna.js: `deed`): a hit, a hold on the
//     drill (whose drag it puts on it only then, as a leech does), a plug of ice, a thaw, a blow's jolt, the meeting
//     and the beating. With the creatures tame none is done, a lord's blows and holds with them, and the game is the
//     game with none; with them off it is never stepped.
//   - It reads the world only where it has been seen (`peek`), makes no piece of it, and only reads the band.
//   - What it keeps is in typed arrays made once, a slot a lord; nothing it does in a frame makes an object. What it
//     looks at in a frame is counted (`work`).
//   - It draws nothing while the atlas has no `bosses` sheet.
import { N, C, K, DX, DY } from './world.js';
import { sheets, tinted } from './atlas.js';
import { voices } from './audio.js';
import { winds } from './winds.js';

const T = 16;                                    // pixels in a cell, as js/drawing.js has it
export const EYE = '#ff2bd6';                    // js/fauna.js's FOE_EYE (not imported: js/fauna.js imports this file)
export const LAIR = 2210;                        // how far out on its axis a lord's lair lies
export const WAKE = 20, NEAR = 30, LEASH = 36, HEAL = 8, HUSK = 40;
export const GRACE = 1.5, RISE = 0.4, SINK = 0.5, WAIT = 2, HURT = 1.2, YIELD = 1.5, LOCK = 0.3, LEAST_TELL = 0.7, BLOWS = 3, RUMBLE = 2.5;
// The narrowest screen a lord must be wholly seen on (js/fauna.js: `inView`, at 160 by 284 with the bar's 44 under
// the ground), and the margin kept inside its edges.
export const NARROW = { W: 160, H: 284, bar: 44, margin: 20 };
// A loop round a lord at rest: the band within `band` cells of its middle, the drill within `drill`.
export const LOOP = { band: 5, drill: 14 };
// The north's last stage: rings where the drill is and will be, told `tell` seconds, shards falling for `fall`.
export const ICEFALL = { tell: 1.0, fall: 0.25, reach: 1.0, stun: 0.4, lead: 0.5 };
export const PLUGS = 24, SHARDS = 6;
// How near a drill no shard of the east's is laid (js/fauna.js: the deed 'shard').
export const SHARD_KEEP = 2.5;
// The states a lord is in.
export const ST = { SLEEP: 0, SUNK: 1, RISE: 2, TELL: 3, ACT: 4, REST: 5, HURT: 6, YIELD: 7, LATCH: 8, BLINK: 9, GONE: 10 };
const { SLEEP, SUNK, RISE: UP, TELL, ACT, REST, HURT: HURTING, YIELD: YIELDING, LATCH, BLINK, GONE } = ST;
// The west's tendrils, TD numbers a slot (`tendril`): what it is doing (TP, one of TW), how long it has been at it
// (TT), the end of its line (TX, TY: where it was told to, or the drill it holds), how far out its tip is (TIP), and
// the cell it stops in at the end of its line (TC; -1 for none: open ground, or the edge of the screen).
export const TW = { NONE: 0, TELL: 1, LASH: 2, HOLD: 3, ANCHOR: 4, BACK: 5 };
const TD = 6, TP = 0, TT = 1, TX = 2, TY = 3, TIP = 4, TC = 5;

// ---------------------------------------------------------------- who they are
// By direction (0 east, 1 south, 2 west, 3 north, as DX and DY): its frames' key, its name and title, the direction
// whose specimens it pays (1 north, 2 south, 3 west, 4 east) and whose look it has (art/bosses.mjs), the fossil it is
// the living kind of, its verb, its poses in the order the sheet has them, and its figures by stage. `ready` says its
// fight is built: a lord that is not never wakes.
//   tell, rest: seconds, by stage; act: how long its attack lasts; near: how near the drill it rises, [least, most];
//   stun: what its attack stuns for.
const POSES = ['swim-a', 'swim-b', 'rise', 'idle-a', 'idle-b', 'tell', 'act', 'rest', 'hurt'];
export const P = { swim_a: 0, swim_b: 1, rise: 2, idle_a: 3, idle_b: 4, tell: 5, act: 6, rest: 7, hurt: 8 };
export const BOSS = [
  // The east: he blinks out (`blink` seconds, then `out` unseen) and in again (RISE) `near` cells from the drill
  // (`nearer` at his last stage); he tells a ring `ring` cells round him by stage, and as the tell ends he pulses: a
  // drill inside the ring is hit. As he rests a shard breaks from his crown, one loose cell of rich ore `shard` cells
  // from him, and that shard hauled home is a blow; SHARDS a fight at the most, one standing at a time. Once they are
  // spent, or where none can be laid as his rest begins, the drill flown into him as he rests is a blow, as a ram
  // into the south's lord is (`ram`, `rush`).
  { key: 'king', name: 'CRYSTAL KING', lord: 'LORD OF THE EAST', kin: 4, look: 'lode', fossil: 'AMMONITE', verb: 'haul', ready: true, attack: 'pulse',
    poses: ['blink-a', 'blink-b', ...POSES.slice(2)], tell: [1.2, 1.0, 0.9], act: 0.3, rest: [3.2, 2.7, 2.3], near: [3, 5], nearer: [3, 4], ring: [3.5, 4, 4.5],
    blink: 0.3, out: 0.2, shard: [2, 4], arc: 6, ram: 1.6, rush: 3, stun: 0.5 },
  // The south: it burrows at `burrow` cells a second in straight lines, rises, tells a lane `lane` cells wide to the
  // drill and charges along it at `charge` cells a second by stage, through where the drill is to `over` cells past
  // it (`reach` cells at the most), through rock or open ground and changing none; a drill within `hit` of its middle
  // as it passes is hit, once a charge. It slides back at `slide` cells a second to where the drill was and rests
  // there. In its last stage it tells again for `again` seconds and charges back along the same lane before it rests.
  // A ram is the drill flown into its middle as it rests, from `ram` cells or nearer at `rush` cells a second or more
  // (js/fauna.js's ram, RAM + 0.4 and RAM_SPEED, widened for its size).
  { key: 'behemoth', name: 'MAGMA BEHEMOTH', lord: 'LORD OF THE SOUTH', kin: 2, look: 'ember', fossil: 'EMBER RIBS', verb: 'ram', ready: true, attack: 'charge',
    poses: POSES, tell: [1.2, 1.0, 0.9], again: 0.9, act: 0, rest: [2.6, 2.2, 1.9], near: [4, 7], charge: [16, 18, 20], lane: 1.6, hit: 1.0, over: 2, reach: 14,
    slide: 8, burrow: 3, arc: 6, ram: 1.6, rush: 3, stun: 0.4 },
  // The west: she roots near the drill where she sees it (`perch` 'sight') and stays there, sinking to follow it
  // through the rock at `follow` cells a second should it get `loose` cells from her, and rooting again once she is
  // near it. She tells a line through the
  // drill and lashes a tendril along it at `lash` cells a second to the first rock, `reach` cells at the most.
  // Passing within `latch` of the drill it latches on: the drill flies at `drag` of its speed, and she drinks (a hit)
  // `drink` seconds on and every `sip` after, until the drill flies `free` cells a second for `shake` seconds, is
  // reeled home, or `most` seconds pass. Stopping in rock she can be anchored in, she is anchored there and rests
  // taut, and that cell cut is a blow; else it comes back at `back` cells a second. From her second stage a second
  // tendril is told `second` seconds after the first, which never anchors while another is. Then she cools `cool`
  // seconds, and tells no sooner than `every` after her last tell began.
  { key: 'mother', name: 'SPORE MOTHER', lord: 'LORD OF THE WEST', kin: 3, look: 'mire', fossil: 'ROOT WYRM', verb: 'cut', ready: true, attack: 'lash',
    poses: POSES, tell: [1.1, 0.95, 0.8], act: 0, rest: [3.2, 2.7, 2.3], cool: [1.4, 1.2, 1.0], every: [4.5, 3.8, 3.2], near: [4, 7], reach: 14, lash: 30, back: 40,
    latch: 0.8, drag: 0.6, drink: 1.5, sip: 3.5, free: 12, shake: 0.5, most: 6, follow: 4, loose: 14, second: 0.4, arc: 6, stun: 0.3, perch: 'sight' },
  // The north: it swims at `swim` cells a second in arcs `arc` cells round the drill, rises on a perch (rock behind
  // it for the tether to bend on), and breathes `reach` cells at the most along a line to the drill; a drill within
  // `breath` of the line is hit.
  { key: 'wyrm', name: 'FROST WYRM', lord: 'LORD OF THE NORTH', kin: 1, look: 'frost', fossil: 'FROZEN BEAST', verb: 'loop', ready: true, attack: 'breath',
    poses: POSES, tell: [1.1, 0.95, 0.8], act: 0.4, rest: [3.4, 2.9, 2.5], near: [3.5, 6], perch: true, reach: 9, swim: 7, arc: 6, breath: 0.8, stun: 0.5 },
];
// Its lair's middle, in cells.
export const lairX = b => C + DX[b] * LAIR + 0.5, lairY = b => C + DY[b] * LAIR + 0.5;
// The name of a frame on the `bosses` sheet.
export const frameName = (b, pose, left) => `${BOSS[b].key}-${BOSS[b].poses[pose]}${left ? '-l' : ''}`;

// The offsets `spotNear` tries: 24 ways round, and for the n-th try how far between the least and the most.
const WAYS = 24, WX = new Float64Array(WAYS), WY = new Float64Array(WAYS), FAR = new Float64Array(WAYS);
for (let n = 0; n < WAYS; n++) { WX[n] = Math.cos(n * 2 * Math.PI / WAYS); WY[n] = Math.sin(n * 2 * Math.PI / WAYS); FAR[n] = (n * 0.6180339887498949) % 1; }

// ---------------------------------------------------------------- the frames
// Looked up once the sheet is there (and again should it change): by lord and pose, facing east and facing west.
let FR = null, frSheet = null;
const NONE = [];
function frames() {
  const s = sheets.bosses;
  if (!s) return null;
  if (FR && frSheet === s) return FR;
  frSheet = s;
  FR = BOSS.map((B, b) => B.poses.map((p, pose) => [0, 1].map(left => {
    const name = frameName(b, pose, left);
    return { r: s.frames[name], eyes: s.eyes?.[name] ?? NONE, lamps: s.lamps?.[name] ?? NONE };
  })));
  return FR;
}

export class Bosses {
  constructor(fauna) {
    this.fauna = fauna;
    // A slot a lord: its state and how long it has been in it, its stage (1 to 3) and the blows it has taken; its
    // middle (cells) and the cell it rose in; where its attack aims as it tells and where it locked; which way it
    // faces; how long the drill has been past its leash; whether a loop round it now is a blow (the band was clear
    // of it since its rest began; for the east, whether his rest takes a ram, his shards spent or none to be laid);
    // the plugs and shards it has made this fight, the shard standing (-1 for none) and the cell it
    // is anchored in; whether its attack has struck; its own phase; how many attacks it has made; when it last
    // rumbled; and the north's icefall (how long since it was told, -1 for none) and its three rings.
    this.st = new Uint8Array(4); this.t = new Float32Array(4); this.stage = new Uint8Array(4); this.blows = new Uint8Array(4);
    this.x = new Float64Array(4); this.y = new Float64Array(4); this.cell = new Int32Array(4);
    this.ax = new Float64Array(4); this.ay = new Float64Array(4); this.lockX = new Float64Array(4); this.lockY = new Float64Array(4);
    this.face = new Int8Array(4); this.away = new Float32Array(4); this.armed = new Uint8Array(4);
    this.plugs = new Uint8Array(4); this.shards = new Uint8Array(4); this.shard = new Int32Array(4); this.anchor = new Int32Array(4);
    this.struck = new Uint8Array(4); this.ph = new Float64Array(4); this.beat = new Uint16Array(4); this.heard = new Float32Array(4);
    this.fallT = new Float32Array(4); this.fallX = new Float64Array(12); this.fallY = new Float64Array(12);
    // The south's charge: where the drill was as it locked (where it rests after), where the charge began, and which
    // of its last stage's two charges it is on (0 the first, 1 the one back).
    this.toX = new Float64Array(4); this.toY = new Float64Array(4); this.fromX = new Float64Array(4); this.fromY = new Float64Array(4); this.leg = new Uint8Array(4);
    // The cells of ice each has laid this fight (PLUGS a lord), which only it thaws.
    this.laid = new Int32Array(4 * PLUGS);
    // The west's tendrils (three slots of TD) and the drag they put on the drill (1: none); how long one has held
    // the drill (-1: none), how long the drill has flown fast since, and how often she has drunk; and the time
    // before which she tells no more.
    this.tendril = new Float64Array(3 * TD); this.drag = 1;
    this.latch = new Float32Array(4); this.fast = new Float32Array(4); this.sips = new Uint8Array(4); this.next = new Float64Array(4);
    this.near = new Float64Array(1);
    // (Asked when a lord's tell begins, by the tests: what, where its line or rings are. Null in play.)
    this.onTell = null;
    this.reset(7, null);
  }
  // Begun again with the game (js/fauna.js: `reset`): every lord asleep and whole, and nothing it made kept.
  reset(seed) {
    this.seed = (Math.imul((seed | 0) + 808, 2654435761) ^ 0x2545f491) >>> 0;
    this.st.fill(SLEEP); this.t.fill(0); this.stage.fill(1); this.blows.fill(0); this.away.fill(0); this.armed.fill(0);
    this.plugs.fill(0); this.shards.fill(0); this.shard.fill(-1); this.anchor.fill(-1); this.cell.fill(-1); this.struck.fill(0);
    this.beat.fill(0); this.heard.fill(-99); this.fallT.fill(-1); this.tendril.fill(0); this.leg.fill(0);
    this.latch.fill(-1); this.fast.fill(0); this.sips.fill(0); this.next.fill(0);
    // (And how many hauls the game had made when the ground was last looked at: a shard gone with a haul since was
    // hauled.)
    this.time = 0; this.tick = 0; this.work = 0; this.drag = 1; this.v = -1; this.hauls = -1;
  }
  rnd() { return (this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0) / 4294967296; }
  // Whether lord `b` is beaten, by what is saved; and whether any lord is up and fighting.
  beaten(game, b) { return ((game.S.bosses ?? 0) >> (4 + b) & 1) === 1; }
  awake(b) { const s = this.st[b]; return s !== SLEEP && s !== GONE; }
  up(b) { const s = this.st[b]; return s === UP || s === TELL || s === ACT || s === REST || s === LATCH || s === HURTING || s === YIELDING; }

  // ---------------------------------------------------------------- a frame
  // With a panel up they only breathe.
  idle(game, dt) { this.time += dt; }
  step(game, dt) {
    const d = game.drill;
    this.time += dt; this.work = 0; this.drag = 1;
    // Every half second: whether each wakes, rumbles, or has been left.
    this.tick -= dt;
    if (this.tick <= 0) { this.tick = 0.5; this.watch(game); }
    for (let b = 0; b < 4; b++) {
      const st = this.st[b];
      if (st === SLEEP) continue;
      // (Nothing moves on while the drill lies dead: the game goes back to the docking, and every lord with it.)
      if (st !== GONE && d.mode === 'dead') continue;
      this.t[b] += dt;
      if (st === GONE) continue;
      if (BOSS[b].verb === 'loop') { this.north(game, b, dt); this.icefall(game, b, dt); }
      else if (BOSS[b].verb === 'ram') this.south(game, b, dt);
      else if (BOSS[b].verb === 'cut') this.west(game, b, dt);
      else if (BOSS[b].verb === 'haul') this.east(game, b, dt);
    }
    if (game.version !== this.v) { this.v = game.version; this.settle(game); }
  }
  // Every half second, four distances: a lord asleep wakes with the drill within WAKE of its lair (and rumbles within
  // NEAR); one awake left LEASH cells and more for HEAL seconds sinks and is whole; a husk is gone once the drill is
  // HUSK cells off.
  watch(game) {
    const d = game.drill;
    for (let b = 0; b < 4; b++) {
      const st = this.st[b], far = Math.hypot(d.x - lairX(b), d.y - lairY(b));
      this.work++;
      if (st === GONE) { if (far > HUSK) this.st[b] = SLEEP; continue; }
      if (st === SLEEP) {
        if (!BOSS[b].ready || this.beaten(game, b) || far > NEAR) continue;
        if (far <= WAKE && d.mode !== 'dead') this.wake(game, b);
        else if (this.time - this.heard[b] >= RUMBLE) { this.heard[b] = this.time; this.voice(game, 'rumble', b, 1 - far / NEAR); }
        continue;
      }
      if (far > LEASH) { this.away[b] += 0.5; if (this.away[b] >= HEAL) this.heal(b); } else this.away[b] = 0;
      if (st === SUNK && this.time - this.heard[b] >= RUMBLE) { this.heard[b] = this.time; this.voice(game, 'rumble', b, 1); }
    }
  }
  // Woken: met, its name up, the roar, and GRACE seconds before it first rises.
  wake(game, b) {
    const d = game.drill;
    this.st[b] = SUNK; this.t[b] = -GRACE; this.stage[b] = 1; this.blows[b] = 0; this.away[b] = 0; this.plugs[b] = 0; this.shards[b] = 0;
    this.beat[b] = 0; this.fallT[b] = -1; this.struck[b] = 0; this.leg[b] = 0; this.shard[b] = -1; this.armed[b] = 0;
    this.ph[b] = Math.atan2(lairY(b) - d.y, lairX(b) - d.x);
    this.x[b] = d.x + Math.cos(this.ph[b]) * (BOSS[b].arc ?? 6); this.y[b] = d.y + Math.sin(this.ph[b]) * (BOSS[b].arc ?? 6);
    this.fauna.deed(game, 'boss-met', b);
    this.voice(game, 'roar', b, 1);
  }
  // Leashed: asleep again, whole, its fight forgotten.
  heal(b) {
    this.st[b] = SLEEP; this.t[b] = 0; this.stage[b] = 1; this.blows[b] = 0; this.away[b] = 0; this.fallT[b] = -1; this.cell[b] = -1; this.leg[b] = 0;
    this.shard[b] = -1; this.armed[b] = 0;
    this.unroot(b);
  }
  // Into the rock, to swim about the drill until it rises again.
  sink(game, b) {
    const d = game.drill;
    this.st[b] = SUNK; this.t[b] = 0; this.cell[b] = -1;
    this.ph[b] = Math.atan2(this.y[b] - d.y, this.x[b] - d.x);
    this.unroot(b);
  }
  // Up out of the rock at cell `c`, facing the drill.
  surface(game, b, c) {
    this.st[b] = UP; this.t[b] = 0; this.cell[b] = c;
    this.x[b] = c % N + 0.5; this.y[b] = Math.floor(c / N) + 0.5;
    this.face[b] = game.drill.x >= this.x[b] ? 1 : -1;
    this.next[b] = Math.max(this.next[b], this.time + RISE);
  }
  // The ground changed: a lord whose cell has closed under it sinks; the west's tendril whose anchor has opened by
  // anything but a cut (which was a blow) comes back; the east's shard gone is forgotten, and gone open with a haul
  // made since the ground was last looked at (not cut: `crushed` forgot it then) it was hauled home, a blow.
  settle(game) {
    const w = game.world, hauls = game.S.stats?.hauls ?? 0, hauled = hauls !== this.hauls;
    this.hauls = hauls;
    for (let b = 0; b < 4; b++) {
      const st = this.st[b], c = this.cell[b], a = this.anchor[b], h = this.shard[b];
      if ((st === UP || st === TELL || st === ACT || st === REST || st === LATCH) && c >= 0 && w.peek(c % N, Math.floor(c / N)) !== K.EMPTY) this.sink(game, b);
      else if (a >= 0 && w.peek(a % N, Math.floor(a / N)) <= 0) this.letGo(b, TW.ANCHOR);
      if (h < 0 || w.peek(h % N, Math.floor(h / N)) === K.ORE_B) continue;
      this.shard[b] = -1;
      if (hauled && w.peek(h % N, Math.floor(h / N)) === K.EMPTY && this.awake(b) && this.st[b] !== HURTING && this.st[b] !== YIELDING) this.blow(game, b);
    }
  }

  // ---------------------------------------------------------------- the north: FROST WYRM
  // Sunk, it swims round the drill; it rises on a perch; it tells a line of breath to the drill, which tracks it and
  // locks LOCK seconds before; it breathes along the line, and a plug of ice closes its far end; it rests coiled,
  // and a loop of the tether wound round it then is a blow (`wound`). In its last stage every second rest ends in an
  // icefall.
  north(game, b, dt) {
    const d = game.drill, B = BOSS[b], s = this.stage[b] - 1, t = this.t[b];
    switch (this.st[b]) {
      case SUNK: {
        this.ph[b] += dt * B.swim / B.arc;
        this.x[b] = d.x + Math.cos(this.ph[b]) * B.arc; this.y[b] = d.y + Math.sin(this.ph[b]) * B.arc;
        if (t < SINK) break;
        const c = this.spotNear(game, b, B.near[0], B.near[1], B.perch);
        // (Nowhere yet: it stays sunk, and looks again in half a second.)
        if (c < 0) { this.t[b] = SINK - 0.5; break; }
        this.surface(game, b, c);
        break;
      }
      case UP: {
        this.face[b] = d.x >= this.x[b] ? 1 : -1;
        if (t < RISE) break;
        this.aim(game, b);
        if (this.fair(game, b)) { this.lockX[b] = this.ax[b]; this.lockY[b] = this.ay[b]; this.tell(game, b, 'breath'); }
        // (The drill has gone where it cannot be told fairly: down again, to rise elsewhere.)
        else if (t > RISE + WAIT) this.sink(game, b);
        break;
      }
      case TELL: {
        this.face[b] = d.x >= this.x[b] ? 1 : -1;
        if (t < B.tell[s] - LOCK) { this.aim(game, b); this.lockX[b] = this.ax[b]; this.lockY[b] = this.ay[b]; }
        if (t >= B.tell[s]) { this.st[b] = ACT; this.t[b] = 0; }
        break;
      }
      case ACT: {
        if (!this.struck[b] && d.mode !== 'dead' && toSegment(d.x, d.y, this.x[b], this.y[b], this.lockX[b], this.lockY[b]) <= B.breath) {
          if (this.fauna.deed(game, 'hit', B.stun)) this.struck[b] = 1;
        }
        if (t >= B.act) { this.plug(game, b); this.rest(game, b); }
        break;
      }
      case REST: {
        if (t < B.rest[s]) break;
        this.beat[b]++;
        if (this.stage[b] >= 3 && this.beat[b] % 2 === 0) this.fall(game, b);
        this.sink(game, b);
        break;
      }
      case HURTING: if (t >= HURT) { if (this.blows[b] >= BLOWS) { this.st[b] = YIELDING; this.t[b] = 0; } else this.sink(game, b); } break;
      case YIELDING: if (t >= YIELD) this.yielded(game, b); break;
    }
  }
  // Where the north's breath reaches: from its middle toward the drill, `reach` cells at the most, up to the first
  // cell that is not open and seen, and no further than the narrowest screen shows.
  aim(game, b) {
    if (BOSS[b].verb === 'ram') { this.lane(game, b); return; }
    if (BOSS[b].verb === 'haul') { this.ringAim(game, b); return; }
    const d = game.drill, w = game.world, x0 = this.x[b], y0 = this.y[b], dx = d.x - x0, dy = d.y - y0, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    let ex = x0, ey = y0;
    for (let s = 0.25; s <= BOSS[b].reach + 1e-9; s += 0.25) {
      const x = x0 + ux * s, y = y0 + uy * s;
      this.work++;
      if (w.peek(Math.floor(x), Math.floor(y)) !== K.EMPTY || !this.inView(game, x, y)) break;
      ex = x; ey = y;
    }
    this.ax[b] = ex; this.ay[b] = ey;
  }
  // A tell may begin only with the lord and both ends of what it tells on the narrowest screen.
  fair(game, b) { return this.inView(game, this.x[b], this.y[b]) && this.inView(game, this.ax[b], this.ay[b]); }
  tell(game, b, what) {
    this.st[b] = TELL; this.t[b] = 0; this.struck[b] = 0;
    this.told(game, b, what);
  }
  // Said as a tell begins: the roar, the pal's yip, and (to the tests) what and where.
  told(game, b, what) {
    this.voice(game, 'roar', b, 1);
    this.fauna.yip(game, this.x[b], this.y[b]);
    this.onTell?.(b, what, this.x[b], this.y[b], this.ax[b], this.ay[b]);
  }
  // A plug of ice at the far end of its breath (the creatures' own deed, with its guards: never under the tether,
  // never by a drill flying free, never on lava or in a pocket), PLUGS cells a fight at the most; it keeps which.
  plug(game, b) {
    if (this.plugs[b] + 3 > PLUGS || Math.hypot(this.lockX[b] - this.x[b], this.lockY[b] - this.y[b]) < 2) return;
    const c = Math.floor(this.lockY[b]) * N + Math.floor(this.lockX[b]);
    if (!this.fauna.deed(game, 'plug', c)) return;
    const got = this.fauna.plugged;
    for (let n = 0; n < got.length && this.plugs[b] < PLUGS; n++) this.laid[b * PLUGS + this.plugs[b]++] = got[n];
  }
  // At rest: a loop round it from now is a blow, if the band is not round it already. The east sheds his shard, if
  // none stands; his rest takes a ram if none stands and none can be laid.
  rest(game, b) {
    this.st[b] = REST; this.t[b] = 0;
    if (BOSS[b].verb === 'haul') { this.armed[b] = this.shard[b] < 0 && !this.layShard(game, b) ? 1 : 0; return; }
    if (BOSS[b].verb !== 'loop') return;
    this.armed[b] = winds(game.band, this.x[b], this.y[b]) === 0 ? 1 : 0;
    this.work += game.band.length;
  }
  // The north's icefall: three rings, at the drill and where it will be ICEFALL.lead seconds either way along its
  // course (kept on the narrowest screen), told ICEFALL.tell seconds; then the shards fall, and a drill within
  // ICEFALL.reach of a ring is hit.
  fall(game, b) {
    const d = game.drill, o = b * 3;
    for (let k = 0; k < 3; k++) {
      const lead = (k - 1) * ICEFALL.lead;
      this.fallX[o + k] = d.x + d.vx * lead; this.fallY[o + k] = d.y + d.vy * lead;
      this.keepInView(game, o + k);
    }
    this.fallT[b] = 0;
    this.voice(game, 'roar', b, 1);
    this.onTell?.(b, 'icefall', this.fallX[o], this.fallY[o], this.fallX[o + 2], this.fallY[o + 2]);
  }
  icefall(game, b, dt) {
    if (this.fallT[b] < 0) return;
    this.fallT[b] += dt;
    if (this.fallT[b] < ICEFALL.tell + ICEFALL.fall) return;
    this.fallT[b] = -1;
    const d = game.drill, o = b * 3;
    for (let k = 0; k < 3; k++) if (Math.hypot(d.x - this.fallX[o + k], d.y - this.fallY[o + k]) <= ICEFALL.reach) { this.fauna.deed(game, 'hit', ICEFALL.stun); break; }
  }
  // A loop round a lord: asked where the creatures ask theirs (js/fauna.js: `wound`, every tenth of a second at the
  // most), of the band as it is before anything it is round is reeled. Only the north's verb is a loop. The band
  // must come to be round it while it rests (from round it not at all), lie within LOOP.band of it, and the drill be
  // within LOOP.drill.
  wound(game) {
    const pts = game.band, d = game.drill;
    if (d.mode === 'dead') return;
    for (let b = 0; b < 4; b++) {
      if (this.st[b] !== REST || BOSS[b].verb !== 'loop') continue;
      this.work += pts.length;
      if (winds(pts, this.x[b], this.y[b], this.near) === 0) { this.armed[b] = 1; continue; }
      if (!this.armed[b] || this.near[0] > LOOP.band || Math.hypot(d.x - this.x[b], d.y - this.y[b]) > LOOP.drill) continue;
      this.blow(game, b);
    }
  }
  // A blow: the jolt of it (a deed), HURT seconds in which nothing more hurts it, and its stage up; at the last
  // stage its plugs thaw; at its third it yields.
  blow(game, b) {
    if (!this.fauna.deed(game, 'blow', b)) return false;
    this.blows[b]++; this.st[b] = HURTING; this.t[b] = 0; this.fallT[b] = -1;
    if (BOSS[b].verb === 'cut') this.withdraw(b);
    if (this.blows[b] < BLOWS) { this.stage[b]++; if (this.stage[b] === 3 && BOSS[b].verb === 'loop') this.fauna.deed(game, 'thaw', b); }
    this.voice(game, 'groan', b, 1);
    return true;
  }
  // Yielded: beaten, paid and kept (js/game.js: `lordBeaten`), and its husk left where it sank.
  yielded(game, b) {
    if (this.fauna.deed(game, 'beaten', b)) { this.st[b] = GONE; this.t[b] = 0; } else this.heal(b);
  }
  // A cell was cut (js/fauna.js: `crushed`, from `Game.finishDig`): the cell the west's tendril is anchored in, cut
  // while she rests taut, is a blow. Returns whether it was. (The east's shard cut is shattered, no blow: he sheds
  // another as he next rests.)
  crushed(game, i, k) {
    for (let b = 0; b < 4; b++) if (i >= 0 && this.shard[b] === i) this.shard[b] = -1;
    if (i < 0 || game.drill.mode === 'dead') return false;
    for (let b = 0; b < 4; b++) if (BOSS[b].verb === 'cut' && this.st[b] === REST && this.anchor[b] === i) return this.blow(game, b);
    return false;
  }

  // ---------------------------------------------------------------- the south: MAGMA BEHEMOTH
  // Sunk, it burrows in straight lines about the drill; it rises; it tells a lane to the drill, which tracks it and
  // locks LOCK seconds before; it charges along it, through where the drill was and on, and slides back there; and
  // it rests there, when the drill flown into it is a blow (`ram`). In its last stage it tells again and charges
  // back along the same lane before it rests.
  south(game, b, dt) {
    const d = game.drill, B = BOSS[b], s = this.stage[b] - 1, t = this.t[b];
    switch (this.st[b]) {
      case SUNK: {
        // (Drawn only: straight on, and turned back toward the drill once it is past where it rises.)
        if (Math.hypot(d.x - this.x[b], d.y - this.y[b]) > B.near[1] + 2) this.ph[b] = Math.atan2(d.y - this.y[b], d.x - this.x[b]);
        this.x[b] += Math.cos(this.ph[b]) * B.burrow * dt; this.y[b] += Math.sin(this.ph[b]) * B.burrow * dt;
        if (t < SINK) break;
        const c = this.spotNear(game, b, B.near[0], B.near[1], false);
        if (c < 0) { this.t[b] = SINK - 0.5; break; }
        this.surface(game, b, c);
        break;
      }
      case UP: {
        this.face[b] = d.x >= this.x[b] ? 1 : -1;
        if (t < RISE) break;
        this.aim(game, b);
        if (this.fair(game, b)) { this.lockX[b] = this.ax[b]; this.lockY[b] = this.ay[b]; this.leg[b] = 0; this.tell(game, b, B.attack); }
        else if (t > RISE + WAIT) this.sink(game, b);
        break;
      }
      case TELL: {
        // (The charge back is told along the lane it came by, locked from the first.)
        const long = this.leg[b] ? B.again : B.tell[s];
        if (!this.leg[b]) {
          this.face[b] = d.x >= this.x[b] ? 1 : -1;
          if (t < long - LOCK) { this.aim(game, b); this.lockX[b] = this.ax[b]; this.lockY[b] = this.ay[b]; }
        }
        if (t >= long) this.charge(game, b);
        break;
      }
      case ACT: this.rush(game, b); break;
      case REST: {
        if (this.ram(game, b) || t < B.rest[s]) break;
        this.beat[b]++;
        this.sink(game, b);
        break;
      }
      case HURTING: if (t >= HURT) { if (this.blows[b] >= BLOWS) { this.st[b] = YIELDING; this.t[b] = 0; } else this.sink(game, b); } break;
      case YIELDING: if (t >= YIELD) this.yielded(game, b); break;
    }
  }
  // The south's lane: from its middle through the drill to `over` cells past it, `reach` at the most, its far end
  // drawn back until it is on the narrowest screen; it will rest where the drill is now (or at the far end, should
  // that fall short of the drill).
  lane(game, b) {
    const d = game.drill, B = BOSS[b], x0 = this.x[b], y0 = this.y[b], dx = d.x - x0, dy = d.y - y0, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    let r = Math.min(len + B.over, B.reach);
    while (r > 0.25 && !this.inView(game, x0 + ux * r, y0 + uy * r)) { r -= 0.25; this.work++; }
    this.ax[b] = x0 + ux * r; this.ay[b] = y0 + uy * r;
    if (r >= len) { this.toX[b] = d.x; this.toY[b] = d.y; } else { this.toX[b] = this.ax[b]; this.toY[b] = this.ay[b]; }
  }
  // Off along the locked lane from where it stands.
  charge(game, b) {
    this.st[b] = ACT; this.t[b] = 0; this.struck[b] = 0; this.cell[b] = -1;
    this.fromX[b] = this.x[b]; this.fromY[b] = this.y[b];
    this.face[b] = this.lockX[b] >= this.x[b] ? 1 : -1;
  }
  // The charge: out to the lane's far end at its stage's speed, a drill within `hit` of its middle as it passes hit
  // once (`struck` 1); then (`struck` 2) back to where the drill was, to rest or to tell its charge back.
  rush(game, b) {
    const d = game.drill, B = BOSS[b], t = this.t[b], speed = B.charge[this.stage[b] - 1], fx = this.fromX[b], fy = this.fromY[b], ex = this.lockX[b], ey = this.lockY[b];
    const len = Math.hypot(ex - fx, ey - fy), ux = len ? (ex - fx) / len : 0, uy = len ? (ey - fy) / len : 0;
    if (!(this.struck[b] & 2)) {
      const px = this.x[b], py = this.y[b], go = Math.min(t * speed, len);
      this.x[b] = fx + ux * go; this.y[b] = fy + uy * go;
      if (!(this.struck[b] & 1) && d.mode !== 'dead' && toSegment(d.x, d.y, px, py, this.x[b], this.y[b]) <= B.hit && this.fauna.deed(game, 'hit', B.stun)) this.struck[b] |= 1;
      if (go < len) return;
      this.struck[b] |= 2;
    }
    const back = Math.hypot(ex - this.toX[b], ey - this.toY[b]), u = (t - len / speed) * B.slide;
    if (u < back) { this.x[b] = ex - ux * u; this.y[b] = ey - uy * u; return; }
    this.arrive(game, b);
  }
  // Back where the drill was: in its last stage, after its first charge, its charge back told; else at rest there,
  // if that is open ground (else it sinks, to rise elsewhere).
  arrive(game, b) {
    this.x[b] = this.toX[b]; this.y[b] = this.toY[b];
    if (this.stage[b] >= 3 && this.leg[b] === 0 && this.back(game, b)) return;
    const x = Math.floor(this.x[b]), y = Math.floor(this.y[b]);
    if (game.world.peek(x, y) !== K.EMPTY) { this.sink(game, b); return; }
    this.cell[b] = y * N + x;
    this.rest(game, b);
  }
  // The charge back: along the lane it came by to `over` past where it rose (drawn back onto the narrowest screen),
  // told only with it and both ends of the lane on it.
  back(game, b) {
    const B = BOSS[b], x0 = this.x[b], y0 = this.y[b], fx = this.fromX[b], fy = this.fromY[b], len = Math.hypot(fx - x0, fy - y0);
    if (len < 1 || !this.inView(game, x0, y0)) return false;
    const ux = (fx - x0) / len, uy = (fy - y0) / len;
    let r = len + B.over;
    while (r >= len && !this.inView(game, x0 + ux * r, y0 + uy * r)) { r -= 0.25; this.work++; }
    if (r < len) return false;
    this.toX[b] = fx; this.toY[b] = fy;
    this.ax[b] = this.lockX[b] = x0 + ux * r; this.ay[b] = this.lockY[b] = y0 + uy * r;
    this.leg[b] = 1; this.face[b] = fx >= x0 ? 1 : -1;
    this.tell(game, b, 'return');
    return true;
  }
  // A ram: the drill flown into it as it rests, `ram` cells from its middle or nearer at `rush` cells a second or
  // more, toward its middle (a drill on it flying off is not). Asked every frame of its rest. (The east's rest takes
  // one only when it has no shard to haul: `armed`.)
  ram(game, b) {
    const d = game.drill, B = BOSS[b], dx = this.x[b] - d.x, dy = this.y[b] - d.y;
    if (this.st[b] !== REST || !(B.verb === 'ram' || (B.verb === 'haul' && this.armed[b])) || d.mode === 'dead') return false;
    if (Math.hypot(dx, dy) > B.ram || Math.hypot(d.vx, d.vy) < B.rush || d.vx * dx + d.vy * dy <= 0) return false;
    return this.blow(game, b);
  }

  // ---------------------------------------------------------------- the east: CRYSTAL KING
  // He blinks out where he stands and in again near the drill; he tells a ring round him that fills toward his
  // pulse, and as it ends a drill inside it is hit; he rests, a shard of rich ore broken from his crown beside him
  // (`layShard`), and that shard hauled home by a loop of the tether is a blow (`settle`), cut it is not. With his
  // shards spent, or none to be laid as his rest begins, the drill flown into him as he rests is a blow (`ram`).
  east(game, b, dt) {
    const d = game.drill, B = BOSS[b], s = this.stage[b] - 1, t = this.t[b];
    switch (this.st[b]) {
      case BLINK: if (t >= B.blink) { this.st[b] = SUNK; this.t[b] = 0; } break;
      case SUNK: {
        // (Unseen: he comes in again where `spotNear` has him, or looks again in half a second.)
        if (t < B.out) break;
        const near = this.stage[b] >= 3 ? B.nearer : B.near, c = this.spotNear(game, b, near[0], near[1], false);
        if (c < 0) { this.t[b] = B.out - 0.5; break; }
        this.surface(game, b, c);
        break;
      }
      case UP: {
        this.face[b] = d.x >= this.x[b] ? 1 : -1;
        if (t < RISE) break;
        this.aim(game, b);
        if (this.fair(game, b)) { this.lockX[b] = this.ax[b]; this.lockY[b] = this.ay[b]; this.tell(game, b, B.attack); }
        else if (t > RISE + WAIT) this.blink(b);
        break;
      }
      case TELL: {
        this.face[b] = d.x >= this.x[b] ? 1 : -1;
        if (t < B.tell[s] - LOCK) { this.aim(game, b); this.lockX[b] = this.ax[b]; this.lockY[b] = this.ay[b]; }
        if (t < B.tell[s]) break;
        // The pulse: a drill inside the ring is hit.
        if (d.mode !== 'dead' && Math.hypot(d.x - this.x[b], d.y - this.y[b]) <= B.ring[s] && this.fauna.deed(game, 'hit', B.stun)) this.struck[b] = 1;
        this.st[b] = ACT; this.t[b] = 0;
        break;
      }
      case ACT: if (t >= B.act) this.rest(game, b); break;
      case REST: {
        if (this.ram(game, b) || t < B.rest[s]) break;
        this.beat[b]++;
        this.blink(b);
        break;
      }
      case HURTING: if (t >= HURT) { if (this.blows[b] >= BLOWS) { this.st[b] = YIELDING; this.t[b] = 0; } else this.blink(b); } break;
      case YIELDING: if (t >= YIELD) this.yielded(game, b); break;
    }
  }
  // Out where he stands, with a sparkle, to come in again elsewhere.
  blink(b) { this.st[b] = BLINK; this.t[b] = 0; this.cell[b] = -1; }
  // What his tell tells: the ring's edge on the way to the drill (where the drill must get past), `ring` cells out.
  ringAim(game, b) {
    const d = game.drill, r = BOSS[b].ring[this.stage[b] - 1], dx = d.x - this.x[b], dy = d.y - this.y[b], len = Math.hypot(dx, dy) || 1;
    this.ax[b] = this.x[b] + dx / len * r; this.ay[b] = this.y[b] + dy / len * r;
  }
  // His shard: a cell `shard` cells from him, tried at WAYS ways round from a place his own generator picks, the
  // first that is seen open ground with seen open ground all round it, no lava, SHARD_KEEP or more from the drill,
  // inside the tether's reach and on the narrowest screen, which the deed 'shard' makes a loose cell of rich ore (with
  // its own guards: never under the tether nor inside its loop, nor in a pocket; three asked at the most). SHARDS a
  // fight. Returns whether one was laid.
  layShard(game, b) {
    if (this.shards[b] >= SHARDS) return false;
    const d = game.drill, B = BOSS[b], x0 = this.x[b], y0 = this.y[b], from = (this.rnd() * WAYS) | 0;
    let asked = 0;
    for (let n = 0; n < WAYS && asked < 3; n++) {
      const way = (from + n * 7) % WAYS, r = B.shard[0] + (B.shard[1] - B.shard[0]) * FAR[n], x = Math.floor(x0 + WX[way] * r), y = Math.floor(y0 + WY[way] * r);
      const mx = x + 0.5, my = y + 0.5, far = Math.hypot(mx - x0, my - y0);
      this.work++;
      if (far < B.shard[0] || far > B.shard[1] || Math.hypot(mx - d.x, my - d.y) < SHARD_KEEP || !game.within(mx, my) || !this.inView(game, mx, my) || !this.clear(game, x, y)) continue;
      asked++;
      if (!this.fauna.deed(game, 'shard', y * N + x)) continue;
      this.shard[b] = y * N + x; this.shards[b]++;
      this.voice(game, 'shard', b, 1);
      return true;
    }
    return false;
  }
  // Seen open ground, no lava, in a cell and all eight about it.
  clear(game, x, y) {
    const w = game.world;
    for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) {
      this.work++;
      if (w.peek(x + u, y + v) !== K.EMPTY || w.lava.has((y + v) * N + x + u)) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------- the west: SPORE MOTHER
  // Sunk, she follows the drill through the rock and roots near it; rooted, she stays, telling a line through the
  // drill that tracks it and locks LOCK seconds before she lashes her tendril along it. It latches onto the drill it
  // passes (`hold`), or is anchored in the rock it stops in, when she rests taut and that cell cut is a blow
  // (`crushed`), or comes back. From her second stage a second tendril is told after the first. Got LOOSE cells
  // from her, the drill is followed again.
  west(game, b, dt) {
    const d = game.drill, B = BOSS[b], s = this.stage[b] - 1, t = this.t[b], far = Math.hypot(d.x - this.x[b], d.y - this.y[b]);
    switch (this.st[b]) {
      case SUNK: {
        // (Drawn only: toward the drill, and rooting once near it.)
        if (far > 0.5) { this.x[b] += (d.x - this.x[b]) / far * Math.min(far, B.follow * dt); this.y[b] += (d.y - this.y[b]) / far * Math.min(far, B.follow * dt); }
        if (t < SINK || far > B.near[1] + 2) break;
        const c = this.spotNear(game, b, B.near[0], B.near[1], B.perch);
        if (c < 0) { this.t[b] = SINK - 0.5; break; }
        this.surface(game, b, c);
        break;
      }
      case HURTING:
        this.tendrils(game, b, dt);
        if (t >= HURT) { if (this.blows[b] >= BLOWS) { this.st[b] = YIELDING; this.t[b] = 0; } else this.cool(b); }
        break;
      case YIELDING: if (t >= YIELD) this.yielded(game, b); break;
      default: {
        if (far >= B.loose) { this.sink(game, b); break; }
        this.tendrils(game, b, dt);
        const o = 0, T0 = this.tendril;
        if (this.st[b] === TELL) {
          // (From her second stage, the second tendril told SECOND seconds into the first's tell, if it is fair.)
          if (this.stage[b] >= 2 && t >= B.second && T0[TD + TP] === TW.NONE) { this.aimTendril(game, b, 1); if (this.fair(game, b)) this.lash(game, b, 1, 'second'); }
          if (T0[o + TP] === TW.TELL) break;
        }
        // What she is doing is what her tendrils are: taut on an anchor, holding the drill, lashing or telling, or
        // all home and cooling.
        let busy = false;
        for (let k = 0; k < 2; k++) if (T0[k * TD + TP] !== TW.NONE) busy = true;
        const want = this.anchor[b] >= 0 ? REST : this.latch[b] >= 0 ? LATCH : busy ? ACT : UP;
        if (want !== this.st[b]) { if (want === UP) this.cool(b); else { this.st[b] = want; this.t[b] = 0; } }
        if (this.st[b] !== UP) break;
        this.face[b] = d.x >= this.x[b] ? 1 : -1;
        if (this.t[b] < RISE || this.time < this.next[b]) break;
        this.aimTendril(game, b, 0);
        if (this.fair(game, b)) { this.tell(game, b, B.attack); this.lash(game, b, 0, null); this.next[b] = this.time + B.every[s]; }
        // (The drill has gone where she cannot tell it fairly: down, to follow it and root elsewhere.)
        else if (this.time - this.next[b] > WAIT) this.sink(game, b);
      }
    }
  }
  // Rooted and cooling: no tell for `cool` seconds.
  cool(b) {
    this.st[b] = UP; this.t[b] = RISE;
    this.next[b] = Math.max(this.next[b], this.time + BOSS[b].cool[this.stage[b] - 1]);
  }
  // Tendril `k` told (said as `what`; the first is said by `tell`) along the line it was aimed.
  lash(game, b, k, what) {
    const o = k * TD, T0 = this.tendril;
    T0[o + TP] = TW.TELL; T0[o + TT] = 0; T0[o + TIP] = 0;
    if (what) this.told(game, b, what);
  }
  // Where tendril `k` is told to: from her middle through the drill, `reach` cells at the most, up to the first cell
  // that is not open and seen, the cell it stops in (-1 for none). Its far end as told (`ax`, `ay`) is as far as the
  // narrowest screen shows it; past that the tendril flies on to the rock, where it can find no drill to hold (the
  // screen keeps the drill on it).
  aimTendril(game, b, k) {
    const d = game.drill, w = game.world, T0 = this.tendril, o = k * TD, x0 = this.x[b], y0 = this.y[b];
    const dx = d.x - x0, dy = d.y - y0, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    let ex = x0, ey = y0, tx = x0, ty = y0, stop = -1, seen = true;
    for (let s = 0.25; s <= BOSS[b].reach + 1e-9; s += 0.25) {
      const x = x0 + ux * s, y = y0 + uy * s, cx = Math.floor(x), cy = Math.floor(y);
      this.work++;
      if (w.peek(cx, cy) !== K.EMPTY) { stop = cy * N + cx; break; }
      if (seen && !this.inView(game, x, y)) seen = false;
      if (seen) { tx = x; ty = y; }
      ex = x; ey = y;
    }
    T0[o + TX] = ex; T0[o + TY] = ey; T0[o + TC] = stop; this.ax[b] = tx; this.ay[b] = ty;
  }
  // Her tendrils, a frame: told, tracking the drill until LOCK seconds before they lash; lashing, latching onto the
  // drill they pass or anchored where they stop (`anchorable`; only one at a time), else coming back; holding the
  // drill; taut on an anchor for her rest; and coming home.
  tendrils(game, b, dt) {
    const d = game.drill, B = BOSS[b], T0 = this.tendril, s = this.stage[b] - 1, x0 = this.x[b], y0 = this.y[b];
    for (let k = 0; k < 2; k++) {
      const o = k * TD, ph = T0[o + TP];
      if (ph === TW.NONE) continue;
      const tt = T0[o + TT] += dt;
      switch (ph) {
        case TW.TELL:
          if (tt < B.tell[s] - LOCK) this.aimTendril(game, b, k);
          if (tt >= B.tell[s]) { T0[o + TP] = TW.LASH; T0[o + TT] = 0; }
          break;
        case TW.LASH: {
          const ex = T0[o + TX], ey = T0[o + TY], len = Math.hypot(ex - x0, ey - y0) || 1, ux = (ex - x0) / len, uy = (ey - y0) / len;
          const was = T0[o + TIP], tip = T0[o + TIP] = Math.min(len, tt * B.lash);
          if (this.latch[b] < 0 && d.mode !== 'dead' && toSegment(d.x, d.y, x0 + ux * was, y0 + uy * was, x0 + ux * tip, y0 + uy * tip) <= B.latch && this.fauna.deed(game, 'drag', b)) {
            T0[o + TP] = TW.HOLD; T0[o + TT] = 0; this.latch[b] = 0; this.fast[b] = 0; this.sips[b] = 0;
            this.voice(game, 'roar', b, 0.6);
            break;
          }
          if (tip < len) break;
          const c = T0[o + TC];
          if (this.anchor[b] < 0 && c >= 0 && this.anchorable(game, c)) { T0[o + TP] = TW.ANCHOR; T0[o + TT] = 0; this.anchor[b] = c; }
          else { T0[o + TP] = TW.BACK; T0[o + TT] = 0; }
          break;
        }
        case TW.HOLD: this.hold(game, b, o, dt); break;
        case TW.ANCHOR: if (this.st[b] === REST && this.t[b] >= B.rest[s]) this.letGo(b, TW.ANCHOR); break;
        case TW.BACK: if ((T0[o + TIP] -= B.back * dt) <= 0) { T0[o + TP] = TW.NONE; T0[o + TIP] = 0; } break;
      }
    }
  }
  // Holding the drill: it flies at `drag` of its speed (none of it with the creatures tame), and she drinks; she
  // lets go once it has flown `free` cells a second for `shake` seconds, is reeled home or lies dead, or after `most`.
  hold(game, b, o, dt) {
    const d = game.drill, B = BOSS[b], T0 = this.tendril;
    T0[o + TX] = d.x; T0[o + TY] = d.y; T0[o + TIP] = Math.hypot(d.x - this.x[b], d.y - this.y[b]);
    const held = this.latch[b] += dt;
    if (!this.fauna.tame) this.drag = Math.min(this.drag, B.drag);
    this.fast[b] = Math.hypot(d.vx, d.vy) >= B.free ? this.fast[b] + dt : 0;
    if (held >= B.drink + this.sips[b] * B.sip) { this.sips[b]++; this.fauna.deed(game, 'hit', B.stun); }
    if (this.fast[b] >= B.shake || d.mode === 'home' || d.mode === 'dead' || held >= B.most) this.letGo(b, TW.HOLD);
  }
  // A tendril doing `what` (holding the drill, or anchored) lets go and comes home.
  letGo(b, what) {
    const T0 = this.tendril;
    for (let k = 0; k < 2; k++) if (T0[k * TD + TP] === what) { T0[k * TD + TP] = TW.BACK; T0[k * TD + TT] = 0; }
    if (what === TW.HOLD) this.latch[b] = -1; else this.anchor[b] = -1;
  }
  // Every tendril comes home (a blow): told ones are not lashed.
  withdraw(b) {
    const T0 = this.tendril;
    for (let k = 0; k < 2; k++) { const o = k * TD; if (T0[o + TP] === TW.TELL) T0[o + TP] = TW.NONE; else if (T0[o + TP] !== TW.NONE) { T0[o + TP] = TW.BACK; T0[o + TT] = 0; } }
    this.latch[b] = -1; this.anchor[b] = -1;
  }
  // Gone at once (sunk, healed): no tendril out, nothing held, no anchor.
  unroot(b) {
    if (BOSS[b].verb !== 'cut') return;
    this.tendril.fill(0); this.latch[b] = -1; this.anchor[b] = -1; this.fast[b] = 0;
  }
  // A cell a tendril may be anchored in: seen rock that a drill can cut, not vault, relic, bedrock or the core, not
  // lava, and inside the tether's reach.
  anchorable(game, c) {
    const w = game.world, x = c % N, y = Math.floor(c / N), k = w.peek(x, y);
    return k > 0 && k !== K.VAULT && k !== K.RELIC && k !== K.BEDROCK && k !== K.CORE && !w.lava.has(c) && game.within(x + 0.5, y + 0.5);
  }

  // ---------------------------------------------------------------- where it rises
  // A cell for lord `b` to rise in, near the drill: tried at 16 of WAYS ways round from a place its own generator
  // picks, each between `least` and `most` cells off, the first that is seen and open (not lava), inside the
  // tether's reach, `least` or more from the drill, within NEAR of its lair and on the narrowest screen; with
  // `perch`, the first with seen rock (not vault) within three cells behind it from the drill, and failing that the
  // first (with `perch` 'sight', the first with open ground seen all the way to the drill: `sees`). Failing all, every
  // way at two cells and more. -1 where there is none. It only peeks.
  spotNear(game, b, least, most, perch) {
    const d = game.drill, w = game.world, lx = lairX(b), ly = lairY(b);
    for (let pass = 0; pass < 2; pass++) {
      const tries = pass ? WAYS : 16, lo = pass ? 2 : least, from = (this.rnd() * WAYS) | 0;
      let first = -1;
      for (let n = 0; n < tries; n++) {
        const way = (from + n * 7) % WAYS, r = lo + (most - lo) * FAR[n], x = Math.floor(d.x + WX[way] * r), y = Math.floor(d.y + WY[way] * r);
        const mx = x + 0.5, my = y + 0.5, c = y * N + x;
        this.work++;
        if (w.peek(x, y) !== K.EMPTY || w.lava.has(c) || Math.hypot(mx - d.x, my - d.y) < lo || Math.hypot(mx - lx, my - ly) > NEAR) continue;
        if (!game.within(mx, my) || !this.inView(game, mx, my)) continue;
        if (!perch || (perch === 'sight' ? this.sees(game, mx, my) : this.perched(game, mx, my))) return c;
        if (first < 0) first = c;
      }
      if (first >= 0) return first;
    }
    return -1;
  }
  // Rock seen behind a spot from the drill, within three cells: a corner for the tether to go round.
  perched(game, x, y) {
    const d = game.drill, w = game.world, len = Math.hypot(x - d.x, y - d.y) || 1, ux = (x - d.x) / len, uy = (y - d.y) / len;
    for (let s = 1; s <= 3; s++) {
      const k = w.peek(Math.floor(x + ux * s), Math.floor(y + uy * s));
      this.work++;
      if (k > 0 && k !== K.VAULT && k !== K.RELIC && k !== K.BEDROCK && k !== K.CORE) return true;
    }
    return false;
  }
  // Open ground seen all the way from a spot to the drill, looked at every half cell: a line her tendril can lash along.
  sees(game, x, y) {
    const d = game.drill, w = game.world, len = Math.hypot(d.x - x, d.y - y), n = Math.ceil(len * 2);
    for (let s = 1; s < n; s++) {
      this.work++;
      if (w.peek(Math.floor(x + (d.x - x) * s / n), Math.floor(y + (d.y - y) * s / n)) !== K.EMPTY) return false;
    }
    return true;
  }
  // Whether a point (cells) is on the narrowest screen, NARROW.margin pixels inside its edges, about the camera.
  inView(game, x, y) {
    const px = x * T - game.cam.x, py = y * T - game.cam.y, hw = NARROW.W / 2 - NARROW.margin, hh = (NARROW.H - NARROW.bar) / 2 - NARROW.margin;
    return px >= -hw && px <= hw && py >= -hh && py <= hh;
  }
  // A point of the icefall moved onto the narrowest screen.
  keepInView(game, n) {
    const hw = (NARROW.W / 2 - NARROW.margin) / T, hh = ((NARROW.H - NARROW.bar) / 2 - NARROW.margin) / T, cx = game.cam.x / T, cy = game.cam.y / T;
    this.fallX[n] = Math.max(cx - hw, Math.min(cx + hw, this.fallX[n])); this.fallY[n] = Math.max(cy - hh, Math.min(cy + hh, this.fallY[n]));
  }
  // A lord's voice, pitched by its direction (js/audio.js: `voices`, as the creatures' are), `near` 0 to 1.
  voice(game, what, b, near) { const v = voices[what]; if (v && near > 0) v(near, b); }

  // ---------------------------------------------------------------- staging (js/shot.js and the tests)
  // Lord `b` set up beside the drill in a state of its own (`sunk`, `rise`, `tell`, `act`, `rest`, `hurt`, `yield`,
  // `gone`, `sleep`, `icefall` for the north, `return` for the south, `second` and `latch` for the west, `blink` for
  // the east) at stage `n` (its blows one fewer), in cell `at`, or where `spotNear` would raise it, or failing that
  // four cells above the drill. Nothing is done to the game but the east's shard: it is not met. Returns its cell.
  // (The west at rest is anchored where her tendril would stop, or failing that in the rock `anchorable` nearest the
  // drill; the east at rest sheds his shard by the deed, as his rest does, where none stands.)
  stageAs(game, b, what = 'rest', n = 1, at = -1) {
    const d = game.drill, B = BOSS[b];
    this.stage[b] = n; this.blows[b] = n - 1; this.away[b] = 0; this.fallT[b] = -1; this.struck[b] = 0; this.leg[b] = 0;
    let c = at >= 0 ? at : this.spotNear(game, b, B.near[0], B.near[1], B.perch ?? false);
    if (c < 0) c = Math.floor(d.y - 4) * N + Math.floor(d.x);
    this.unroot(b);
    this.surface(game, b, c);
    this.next[b] = 0;
    if (B.verb === 'cut' && this.stageWest(game, b, what)) { this.t[b] = 0; return c; }
    switch (what) {
      case 'sleep': this.heal(b); break;
      case 'sunk': this.sink(game, b); break;
      case 'tell': this.aim(game, b); this.lockX[b] = this.ax[b]; this.lockY[b] = this.ay[b]; this.tell(game, b, B.attack); break;
      case 'act': this.aim(game, b); this.lockX[b] = this.ax[b]; this.lockY[b] = this.ay[b]; this.tell(game, b, B.attack); if (B.verb === 'ram') this.charge(game, b); else this.st[b] = ACT; break;
      // (The south's charge back: told from where the drill is, along a lane back to its cell.)
      case 'return': this.fromX[b] = this.x[b]; this.fromY[b] = this.y[b]; this.x[b] = d.x; this.y[b] = d.y; if (!this.back(game, b)) { this.x[b] = this.fromX[b]; this.y[b] = this.fromY[b]; this.rest(game, b); } break;
      case 'rest': this.rest(game, b); break;
      case 'hurt': this.st[b] = HURTING; break;
      case 'yield': this.blows[b] = BLOWS; this.st[b] = YIELDING; break;
      case 'gone': this.st[b] = GONE; break;
      case 'blink': this.blink(b); break;
      case 'icefall': this.rest(game, b); this.fall(game, b); break;
    }
    this.t[b] = 0;
    return c;
  }
  stageWest(game, b, what) {
    const T0 = this.tendril, d = game.drill;
    switch (what) {
      case 'tell': case 'act': case 'second':
        this.aimTendril(game, b, 0); this.tell(game, b, BOSS[b].attack); this.lash(game, b, 0, null);
        if (what === 'act') { T0[TP] = TW.LASH; this.st[b] = ACT; }
        if (what === 'second') { this.aimTendril(game, b, 1); this.lash(game, b, 1, 'second'); }
        return true;
      case 'latch':
        T0[TP] = TW.HOLD; T0[TX] = d.x; T0[TY] = d.y; T0[TIP] = Math.hypot(d.x - this.x[b], d.y - this.y[b]);
        this.latch[b] = 0; this.fast[b] = 0; this.sips[b] = 0; this.st[b] = LATCH;
        return true;
      case 'rest': {
        this.aimTendril(game, b, 0);
        let a = T0[TC] >= 0 && this.anchorable(game, T0[TC]) ? T0[TC] : -1;
        const x0 = Math.floor(d.x), y0 = Math.floor(d.y);
        for (let r = 1; r <= 6 && a < 0; r++) for (let y = y0 - r; y <= y0 + r && a < 0; y++) for (let x = x0 - r; x <= x0 + r; x++) {
          if (Math.max(Math.abs(x - x0), Math.abs(y - y0)) !== r) continue;
          const c = y * N + x;
          this.work++;
          if (this.anchorable(game, c) && Math.hypot(x + 0.5 - this.x[b], y + 0.5 - this.y[b]) <= BOSS[b].reach) { a = c; break; }
        }
        if (a < 0) return false;
        if (a !== T0[TC]) { T0[TX] = a % N + 0.5; T0[TY] = Math.floor(a / N) + 0.5; T0[TC] = a; }
        T0[TP] = TW.ANCHOR; T0[TIP] = Math.hypot(T0[TX] - this.x[b], T0[TY] - this.y[b]);
        this.anchor[b] = a; this.st[b] = REST;
        return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------- drawing
  // The pose a lord is drawn in now.
  pose(b) {
    const st = this.st[b], t = this.t[b], beat = ((this.time * 5) | 0) & 1;
    switch (st) {
      case SLEEP: case SUNK: case BLINK: return beat ? P.swim_b : P.swim_a;
      case UP: return t < RISE ? P.rise : ((this.time * 1.5) | 0) & 1 ? P.idle_b : P.idle_a;
      case TELL: return P.tell;
      case ACT: case LATCH: return P.act;
      case HURTING: case YIELDING: return P.hurt;
      default: return P.rest;
    }
  }
  // Up out of the rock, under the dark (the lamp shows it): its body; a husk dimmed.
  draw(game, ctx, ox, oy) {
    if (!frames()) return;
    const image = sheets.bosses.image;
    for (let b = 0; b < 4; b++) {
      const st = this.st[b];
      if (!this.up(b) && st !== GONE && st !== BLINK) continue;
      const r = FR[b][this.pose(b)][this.face[b] < 0 ? 1 : 0].r;
      if (!r) continue;
      const px = Math.round(this.x[b] * T - ox - 24), py = Math.round(this.y[b] * T - oy - 24);
      if (px < -48 || py < -48 || px > game.W || py > game.H) continue;
      ctx.globalAlpha = st === GONE ? 0.5 : st === BLINK ? Math.max(0, 1 - this.t[b] / BOSS[b].blink) : st === YIELDING ? Math.max(0, 1 - this.t[b] / YIELD) : st === UP && this.t[b] < RISE ? Math.min(1, 0.3 + this.t[b] / RISE) : 1;
      ctx.drawImage(image, r[0], r[1], r[2], r[3], px, py, 48, 48);
    }
    ctx.globalAlpha = 1;
  }
  // Over the dark: a lord sunk (or asleep, near) as a hump through the rock; a tell's line, ringed in FOE_EYE; the
  // breath; the icefall's rings and shards; the south's lane (`drawLane`); the west's tendrils (`drawTendrils`); and
  // under a lord up, its blows as three diamonds.
  signs(game, ctx, ox, oy) {
    if (!frames()) return;
    const image = sheets.bosses.image, now = this.time, d = game.drill;
    for (let b = 0; b < 4; b++) {
      const st = this.st[b];
      let hx = this.x[b], hy = this.y[b];
      if (st === SLEEP) {
        if (!BOSS[b].ready || this.beaten(game, b) || Math.hypot(d.x - lairX(b), d.y - lairY(b)) > NEAR) continue;
        hx = lairX(b) + Math.cos(now * 0.4 + b) * 4; hy = lairY(b) + Math.sin(now * 0.6 + b) * 2;
      }
      // (The east: his shard glinting while it stands; blinked out, nothing of him but the sparkle as he goes.)
      if (BOSS[b].verb === 'haul') {
        if (this.shard[b] >= 0) this.glint(ctx, b, this.shard[b], ox, oy);
        if (st === BLINK || (st === UP && this.t[b] < RISE)) this.sparkle(ctx, b, hx * T - ox, hy * T - oy, st === BLINK ? this.t[b] / BOSS[b].blink : this.t[b] / RISE);
        if (st === SUNK || st === BLINK) continue;
      }
      if (st === SLEEP || st === SUNK) {
        const r = FR[b][this.pose(b)][Math.sin(now * 0.4 + b) < 0 ? 1 : 0].r;
        if (r) { ctx.globalAlpha = 0.45; ctx.drawImage(image, r[0], r[1], r[2], r[3], Math.round(hx * T - ox - 24), Math.round(hy * T - oy - 24), 48, 48); }
        continue;
      }
      const x0 = this.x[b] * T - ox, y0 = this.y[b] * T - oy;
      ctx.fillStyle = EYE;
      if (BOSS[b].verb === 'cut') this.drawTendrils(game, ctx, ox, oy, b);
      else if ((st === TELL || st === ACT) && BOSS[b].verb === 'ram') this.drawLane(game, ctx, ox, oy, b);
      else if ((st === TELL || st === ACT) && BOSS[b].verb === 'haul') this.drawRing(ctx, b, x0, y0);
      else if (st === TELL || st === ACT) {
        const s = this.stage[b] - 1, locked = st === ACT || this.t[b] >= BOSS[b].tell[s] - LOCK;
        const ex = this.lockX[b] * T - ox, ey = this.lockY[b] * T - oy, len = Math.hypot(ex - x0, ey - y0) || 1, ux = (ex - x0) / len, uy = (ey - y0) / len;
        if (st === TELL) {
          ctx.globalAlpha = locked ? 0.95 : 0.4 + 0.3 * Math.sin(now * 30);
          for (let u = (now * 40) % 4; u < len; u += 4) ctx.fillRect(Math.round(x0 + ux * u), Math.round(y0 + uy * u), 1, 1);
          this.ringed(ctx, b, x0, y0);
        } else {
          // The breath: a band of frost along the line.
          ctx.fillStyle = '#eef8ff';
          for (let u = 0; u < len; u += 2) { ctx.globalAlpha = 0.6 + 0.4 * Math.sin(u * 0.7 - now * 40); ctx.fillRect(Math.round(x0 + ux * u - 1), Math.round(y0 + uy * u - 1), 3, 3); }
        }
      }
      // The icefall: rings while it is told, shards as they fall.
      if (this.fallT[b] >= 0) {
        const o = b * 3, f = this.fallT[b];
        ctx.fillStyle = EYE;
        for (let k = 0; k < 3; k++) {
          const cx = this.fallX[o + k] * T - ox, cy = this.fallY[o + k] * T - oy;
          if (f < ICEFALL.tell) {
            ctx.globalAlpha = 0.5 + 0.4 * Math.min(1, f / ICEFALL.tell);
            for (let a = 0; a < 12; a++) ctx.fillRect(Math.round(cx + Math.cos(a * 0.5236 + now * 2) * T), Math.round(cy + Math.sin(a * 0.5236 + now * 2) * T), 1, 1);
          } else {
            const u = (f - ICEFALL.tell) / ICEFALL.fall;
            ctx.globalAlpha = 1; ctx.fillStyle = '#eef8ff';
            for (let n = -1; n <= 1; n++) ctx.fillRect(Math.round(cx + n * 5), Math.round(cy - (1 - u) * 48), 1, 4);
            ctx.fillStyle = EYE;
          }
        }
      }
      // Its blows: three diamonds under it, filled as they land.
      ctx.globalAlpha = 1; ctx.fillStyle = EYE;
      for (let n = 0; n < BLOWS; n++) {
        const cx = Math.round(x0 - 8 + n * 8), cy = Math.round(y0 + 28);
        ctx.fillRect(cx, cy - 2, 1, 1); ctx.fillRect(cx - 1, cy - 1, 3, 1); ctx.fillRect(cx - 2, cy, 5, 1); ctx.fillRect(cx - 1, cy + 1, 3, 1); ctx.fillRect(cx, cy + 2, 1, 1);
        if (n >= this.blows[b]) { ctx.fillStyle = '#000000'; ctx.fillRect(cx, cy - 1, 1, 3); ctx.fillRect(cx - 1, cy, 3, 1); ctx.fillStyle = EYE; }
      }
    }
    ctx.globalAlpha = 1;
  }
  // The south's lane as it tells, its two edges dashed `lane` apart from its middle to the far end, flickering
  // until it locks, and the lord ringed in the warning's colour; as it charges, the lane fading behind it.
  drawLane(game, ctx, ox, oy, b) {
    const B = BOSS[b], st = this.st[b], now = this.time, s = this.stage[b] - 1;
    const sx = (st === ACT ? this.fromX[b] : this.x[b]) * T - ox, sy = (st === ACT ? this.fromY[b] : this.y[b]) * T - oy;
    const ex = this.lockX[b] * T - ox, ey = this.lockY[b] * T - oy, len = Math.hypot(ex - sx, ey - sy) || 1, ux = (ex - sx) / len, uy = (ey - sy) / len;
    const hw = B.lane / 2 * T, nx = -uy * hw, ny = ux * hw;
    const locked = st === ACT || this.leg[b] === 1 || this.t[b] >= B.tell[s] - LOCK;
    ctx.fillStyle = EYE;
    ctx.globalAlpha = st === ACT ? Math.max(0, 0.5 - this.t[b]) : locked ? 0.95 : 0.4 + 0.3 * Math.sin(now * 30);
    for (let u = (now * 30) % 6; u < len; u += 6) for (let side = -1; side <= 1; side += 2) {
      ctx.fillRect(Math.round(sx + ux * u + nx * side), Math.round(sy + uy * u + ny * side), 2, 1);
    }
    // (Its far end, a bar across the lane.)
    for (let v = -hw; v <= hw; v += 2) ctx.fillRect(Math.round(ex - uy * v), Math.round(ey + ux * v), 1, 1);
    if (st === TELL) this.ringed(ctx, b, sx, sy);
  }
  // The west's tendrils: each told as a dotted line through the drill, flickering until it locks, and she ringed in
  // the warning's colour; lashed, holding or coming home, a vine from her middle to its tip, swaying as it flies,
  // slack as it holds, pulled straight when taut; and the cell it is anchored in outlined in the warning's colour.
  drawTendrils(game, ctx, ox, oy, b) {
    const T0 = this.tendril, now = this.time, s = this.stage[b] - 1, x0 = this.x[b] * T - ox, y0 = this.y[b] * T - oy;
    let telling = false;
    for (let k = 0; k < 2; k++) {
      const o = k * TD, ph = T0[o + TP];
      if (ph === TW.NONE) continue;
      const ex = T0[o + TX] * T - ox, ey = T0[o + TY] * T - oy, len = Math.hypot(ex - x0, ey - y0) || 1, ux = (ex - x0) / len, uy = (ey - y0) / len;
      if (ph === TW.TELL) {
        telling = true;
        ctx.fillStyle = EYE; ctx.globalAlpha = T0[o + TT] >= BOSS[b].tell[s] - LOCK ? 0.95 : 0.4 + 0.3 * Math.sin(now * 30 + k * 2);
        for (let u = (now * 40) % 4; u < len; u += 4) ctx.fillRect(Math.round(x0 + ux * u), Math.round(y0 + uy * u), 1, 1);
        continue;
      }
      const tip = Math.min(len, T0[o + TIP] * T), sway = ph === TW.ANCHOR ? 0 : ph === TW.HOLD ? 3 : 5, nx = -uy, ny = ux;
      ctx.globalAlpha = 1;
      for (let u = 0; u < tip; u += 2) {
        const bend = Math.sin(u / tip * Math.PI) * sway * Math.sin(now * 9 + u * 0.15), px = Math.round(x0 + ux * u + nx * bend), py = Math.round(y0 + uy * u + ny * bend);
        ctx.fillStyle = VINE[0]; ctx.fillRect(px - 1, py - 1, 3, 3);
        ctx.fillStyle = u % 6 === 0 ? VINE[2] : VINE[1]; ctx.fillRect(px, py, 1, 1);
      }
      if (ph !== TW.ANCHOR || this.anchor[b] < 0) continue;
      const c = this.anchor[b], cx = (c % N) * T - ox, cy = Math.floor(c / N) * T - oy;
      ctx.fillStyle = EYE; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now * 8);
      ctx.fillRect(cx, cy, T, 1); ctx.fillRect(cx, cy + T - 1, T, 1); ctx.fillRect(cx, cy + 1, 1, T - 2); ctx.fillRect(cx + T - 1, cy + 1, 1, T - 2);
    }
    if (telling) this.ringed(ctx, b, x0, y0);
    ctx.globalAlpha = 1; ctx.fillStyle = EYE;
  }
  // The east's ring as he tells: dotted round him at its reach, flickering until it locks, and a second ring
  // growing inside it to meet it as the pulse comes, he ringed in the warning's colour; as he pulses, the ring
  // whole and fading.
  drawRing(ctx, b, x0, y0) {
    const B = BOSS[b], s = this.stage[b] - 1, r = B.ring[s] * T, now = this.time, t = this.t[b];
    ctx.fillStyle = EYE;
    if (this.st[b] === ACT) {
      ctx.globalAlpha = Math.max(0, 1 - t / B.act);
      for (let n = 0; n < 96; n++) { const a = n * Math.PI / 48; ctx.fillRect(Math.round(x0 + Math.cos(a) * r) - 1, Math.round(y0 + Math.sin(a) * r) - 1, 2, 2); }
      ctx.globalAlpha = 1;
      return;
    }
    const locked = t >= B.tell[s] - LOCK, fill = Math.min(1, t / B.tell[s]) * r;
    // (Its dots two pixels across and four apart, and the growing ring's one across: a ring of one-pixel dots seven
    // apart, as it was first drawn, was lost against the ground in play.)
    ctx.globalAlpha = locked ? 0.95 : 0.55 + 0.3 * Math.sin(now * 30);
    for (let n = 0; n < 88; n++) { const a = n * Math.PI / 44 + now * 0.8; ctx.fillRect(Math.round(x0 + Math.cos(a) * r) - 1, Math.round(y0 + Math.sin(a) * r) - 1, 2, 2); }
    ctx.globalAlpha = 0.6;
    for (let n = 0; n < 48; n++) { const a = n * Math.PI / 24 - now * 1.2; ctx.fillRect(Math.round(x0 + Math.cos(a) * fill), Math.round(y0 + Math.sin(a) * fill), 1, 1); }
    this.ringed(ctx, b, x0, y0);
    ctx.globalAlpha = 1;
  }
  // The east's shard: its cell's corners glinting in his crown's colour.
  glint(ctx, b, c, ox, oy) {
    const cx = (c % N) * T - ox, cy = Math.floor(c / N) * T - oy;
    ctx.fillStyle = LAMP[b]; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.time * 6);
    ctx.fillRect(cx - 1, cy - 1, 3, 1); ctx.fillRect(cx - 1, cy, 1, 2); ctx.fillRect(cx + T - 2, cy + T, 3, 1); ctx.fillRect(cx + T, cy + T - 2, 1, 2);
    ctx.globalAlpha = 1;
  }
  // The east blinking out or in (`u` 0 to 1 through it): eight points of light about his middle, drawn in as he goes.
  sparkle(ctx, b, x0, y0, u) {
    const r = 6 + 14 * (1 - u), a0 = this.time * 5;
    ctx.globalAlpha = Math.max(0, 1 - u * 0.7);
    for (let n = 0; n < 8; n++) {
      const a = a0 + n * Math.PI / 4, x = Math.round(x0 + Math.cos(a) * r), y = Math.round(y0 + Math.sin(a) * r);
      ctx.fillStyle = n & 1 ? '#ffffff' : LAMP[b];
      ctx.fillRect(x, y - 1, 1, 3); ctx.fillRect(x - 1, y, 3, 1);
    }
    ctx.globalAlpha = 1;
  }
  // A lord as it tells, ringed in the warning's colour.
  ringed(ctx, b, x0, y0) {
    const r = FR[b][this.pose(b)][this.face[b] < 0 ? 1 : 0].r;
    if (!r) return;
    const lit = tinted('bosses', EYE), image = sheets.bosses.image, px = Math.round(x0 - 24), py = Math.round(y0 - 24);
    ctx.globalAlpha = 0.45 + 0.35 * Math.sin(this.time * 24);
    for (let n = 0; n < 4; n++) ctx.drawImage(lit, r[0], r[1], r[2], r[3], px + SIDES[n][0], py + SIDES[n][1], 48, 48);
    ctx.globalAlpha = 1; ctx.drawImage(image, r[0], r[1], r[2], r[3], px, py, 48, 48);
  }
  // Over the dark, adding light: its eyes (bright as it tells, dim as it rests) and its own lamps.
  glow(game, ctx, ox, oy) {
    if (!frames()) return;
    ctx.globalCompositeOperation = 'lighter';
    for (let b = 0; b < 4; b++) {
      if (!this.up(b)) continue;
      const f = FR[b][this.pose(b)][this.face[b] < 0 ? 1 : 0], px = Math.round(this.x[b] * T - ox - 24), py = Math.round(this.y[b] * T - oy - 24), st = this.st[b];
      if (px < -48 || py < -48 || px > game.W || py > game.H) continue;
      const lit = st === TELL ? 1 : st === REST ? 0.35 : 0.8 + 0.2 * Math.sin(this.time * 2 + b);
      ctx.fillStyle = EYE;
      for (let n = 0; n < f.eyes.length; n++) { const ex = f.eyes[n][0], ey = f.eyes[n][1]; ctx.globalAlpha = lit; ctx.fillRect(px + ex, py + ey, 1, 1); ctx.globalAlpha = lit * 0.35; ctx.fillRect(px + ex - 1, py + ey, 3, 1); ctx.fillRect(px + ex, py + ey - 1, 1, 3); }
      ctx.fillStyle = LAMP[b];
      for (let n = 0; n < f.lamps.length; n++) { const lx = f.lamps[n][0], ly = f.lamps[n][1]; ctx.globalAlpha = 0.6; ctx.fillRect(px + lx, py + ly, 1, 1); ctx.globalAlpha = 0.25; ctx.fillRect(px + lx - 1, py + ly, 3, 1); ctx.fillRect(px + lx, py + ly - 1, 1, 3); }
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  // The light a lord up gives, inside the drawing's own (`Game.light`): one, a little.
  lights(game) {
    if (!frames()) return;
    for (let b = 0; b < 4; b++) if (this.up(b)) game.shine(Math.floor(this.x[b]), Math.floor(this.y[b]), 0.4, 3);
  }
}
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// The colour of each lord's own lamps: the east's crown, the south's seam, the west's spores, the north's frost.
const LAMP = ['#e8d0ff', '#ffb060', '#d8f070', '#bfe6ff'];
// The west's vine: its dark edge, its body, and the spores lit along it.
const VINE = ['#1f2a10', '#7ea83a', '#d8f070'];
// How far a point is from a segment.
function toSegment(x, y, x0, y0, x1, y1) {
  const ex = x1 - x0, ey = y1 - y0, len2 = ex * ex + ey * ey || 1, u = Math.max(0, Math.min(1, ((x - x0) * ex + (y - y0) * ey) / len2));
  return Math.hypot(x0 + ex * u - x, y0 + ey * u - y);
}
