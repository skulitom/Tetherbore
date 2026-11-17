// The four lords at the ends: one at the far end of each direction's axis, LAIR cells out, past the relic and inside
// the last reach, the living kind of its direction's fossil. Each has a verb of its own that beats it, the game's own
// verbs: the north's FROST WYRM is beaten by a loop of the tether wound round it while it rests (LOOP), the south's
// MAGMA BEHEMOTH by the drill flown into it while it rests (RAM), the west's by a cut, the east's by a haul. Each
// takes BLOWS blows, and each blow raises its stage: every tell and rest of the stage after is shorter, and the last
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
//   - Everything it does to the game is one of the creatures' deeds (js/fauna.js: `deed`): a hit, a plug of ice, a
//     thaw, a blow's jolt, the meeting and the beating. With the creatures tame none is done, a lord's blows with
//     them, and the game is the game with none; with them off it is never stepped.
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
// The states a lord is in.
export const ST = { SLEEP: 0, SUNK: 1, RISE: 2, TELL: 3, ACT: 4, REST: 5, HURT: 6, YIELD: 7, LATCH: 8, BLINK: 9, GONE: 10 };
const { SLEEP, SUNK, RISE: UP, TELL, ACT, REST, HURT: HURTING, YIELD: YIELDING, GONE } = ST;

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
  { key: 'king', name: 'CRYSTAL KING', lord: 'LORD OF THE EAST', kin: 4, look: 'lode', fossil: 'AMMONITE', verb: 'haul', ready: false,
    poses: ['blink-a', 'blink-b', ...POSES.slice(2)], tell: [1.2, 1.0, 0.9], act: 0.3, rest: [3.2, 2.7, 2.3], near: [3, 5], ring: [3.5, 4, 4.5], stun: 0.5 },
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
  { key: 'mother', name: 'SPORE MOTHER', lord: 'LORD OF THE WEST', kin: 3, look: 'mire', fossil: 'ROOT WYRM', verb: 'cut', ready: false,
    poses: POSES, tell: [1.1, 0.95, 0.8], act: 0, rest: [3.2, 2.7, 2.3], near: [4, 7], stun: 0.3 },
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
    // of it since its rest began); the plugs and shards it has made this fight, the shard standing and the cell it
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
    // The west's tendrils (three slots) and the drag they put on the drill (1: none).
    this.tendril = new Float64Array(3 * 6); this.drag = 1;
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
    this.time = 0; this.tick = 0; this.work = 0; this.drag = 1; this.v = -1;
  }
  rnd() { return (this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0) / 4294967296; }
  // Whether lord `b` is beaten, by what is saved; and whether any lord is up and fighting.
  beaten(game, b) { return ((game.S.bosses ?? 0) >> (4 + b) & 1) === 1; }
  awake(b) { const s = this.st[b]; return s !== SLEEP && s !== GONE; }
  up(b) { const s = this.st[b]; return s === UP || s === TELL || s === ACT || s === REST || s === HURTING || s === YIELDING; }

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
    this.beat[b] = 0; this.fallT[b] = -1; this.struck[b] = 0; this.leg[b] = 0;
    this.ph[b] = Math.atan2(lairY(b) - d.y, lairX(b) - d.x);
    this.x[b] = d.x + Math.cos(this.ph[b]) * (BOSS[b].arc ?? 6); this.y[b] = d.y + Math.sin(this.ph[b]) * (BOSS[b].arc ?? 6);
    this.fauna.deed(game, 'boss-met', b);
    this.voice(game, 'roar', b, 1);
  }
  // Leashed: asleep again, whole, its fight forgotten.
  heal(b) {
    this.st[b] = SLEEP; this.t[b] = 0; this.stage[b] = 1; this.blows[b] = 0; this.away[b] = 0; this.fallT[b] = -1; this.cell[b] = -1; this.leg[b] = 0;
  }
  // Into the rock, to swim about the drill until it rises again.
  sink(game, b) {
    const d = game.drill;
    this.st[b] = SUNK; this.t[b] = 0; this.cell[b] = -1;
    this.ph[b] = Math.atan2(this.y[b] - d.y, this.x[b] - d.x);
  }
  // Up out of the rock at cell `c`, facing the drill.
  surface(game, b, c) {
    this.st[b] = UP; this.t[b] = 0; this.cell[b] = c;
    this.x[b] = c % N + 0.5; this.y[b] = Math.floor(c / N) + 0.5;
    this.face[b] = game.drill.x >= this.x[b] ? 1 : -1;
  }
  // The ground changed: a lord whose cell has closed under it sinks.
  settle(game) {
    const w = game.world;
    for (let b = 0; b < 4; b++) {
      const st = this.st[b], c = this.cell[b];
      if ((st === UP || st === TELL || st === ACT || st === REST) && c >= 0 && w.peek(c % N, Math.floor(c / N)) !== K.EMPTY) this.sink(game, b);
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
  // At rest: a loop round it from now is a blow, if the band is not round it already.
  rest(game, b) {
    this.st[b] = REST; this.t[b] = 0;
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
    if (this.blows[b] < BLOWS) { this.stage[b]++; if (this.stage[b] === 3 && BOSS[b].verb === 'loop') this.fauna.deed(game, 'thaw', b); }
    this.voice(game, 'groan', b, 1);
    return true;
  }
  // Yielded: beaten, paid and kept (js/game.js: `lordBeaten`), and its husk left where it sank.
  yielded(game, b) {
    if (this.fauna.deed(game, 'beaten', b)) { this.st[b] = GONE; this.t[b] = 0; } else this.heal(b);
  }
  // A cell was cut (js/fauna.js: `crushed`, from `Game.finishDig`). It only reads. (The west's verb.)
  crushed(game, i, k) { }

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
  // more, toward its middle (a drill on it flying off is not). Asked every frame of its rest.
  ram(game, b) {
    const d = game.drill, B = BOSS[b], dx = this.x[b] - d.x, dy = this.y[b] - d.y;
    if (this.st[b] !== REST || B.verb !== 'ram' || d.mode === 'dead') return false;
    if (Math.hypot(dx, dy) > B.ram || Math.hypot(d.vx, d.vy) < B.rush || d.vx * dx + d.vy * dy <= 0) return false;
    return this.blow(game, b);
  }

  // ---------------------------------------------------------------- where it rises
  // A cell for lord `b` to rise in, near the drill: tried at 16 of WAYS ways round from a place its own generator
  // picks, each between `least` and `most` cells off, the first that is seen and open (not lava), inside the
  // tether's reach, `least` or more from the drill, within NEAR of its lair and on the narrowest screen; with
  // `perch`, the first with seen rock (not vault) within three cells behind it from the drill, and failing that the
  // first. Failing all, every way at two cells and more. -1 where there is none. It only peeks.
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
        if (!perch || this.perched(game, mx, my)) return c;
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
  // `gone`, `sleep`, `icefall` for the north, `return` for the south) at stage `n` (its blows one fewer), in cell
  // `at`, or where `spotNear` would raise it, or failing that four cells above the drill. Nothing is done to the game:
  // it is not met. Returns its cell.
  stageAs(game, b, what = 'rest', n = 1, at = -1) {
    const d = game.drill, B = BOSS[b];
    this.stage[b] = n; this.blows[b] = n - 1; this.away[b] = 0; this.fallT[b] = -1; this.struck[b] = 0; this.leg[b] = 0;
    let c = at >= 0 ? at : this.spotNear(game, b, B.near[0], B.near[1], !!B.perch);
    if (c < 0) c = Math.floor(d.y - 4) * N + Math.floor(d.x);
    this.surface(game, b, c);
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
      case 'icefall': this.rest(game, b); this.fall(game, b); break;
    }
    this.t[b] = 0;
    return c;
  }

  // ---------------------------------------------------------------- drawing
  // The pose a lord is drawn in now.
  pose(b) {
    const st = this.st[b], t = this.t[b], beat = ((this.time * 5) | 0) & 1;
    switch (st) {
      case SLEEP: case SUNK: return beat ? P.swim_b : P.swim_a;
      case UP: return t < RISE ? P.rise : ((this.time * 1.5) | 0) & 1 ? P.idle_b : P.idle_a;
      case TELL: return P.tell;
      case ACT: return P.act;
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
      if (!this.up(b) && st !== GONE) continue;
      const r = FR[b][this.pose(b)][this.face[b] < 0 ? 1 : 0].r;
      if (!r) continue;
      const px = Math.round(this.x[b] * T - ox - 24), py = Math.round(this.y[b] * T - oy - 24);
      if (px < -48 || py < -48 || px > game.W || py > game.H) continue;
      ctx.globalAlpha = st === GONE ? 0.5 : st === YIELDING ? Math.max(0, 1 - this.t[b] / YIELD) : st === UP && this.t[b] < RISE ? Math.min(1, 0.3 + this.t[b] / RISE) : 1;
      ctx.drawImage(image, r[0], r[1], r[2], r[3], px, py, 48, 48);
    }
    ctx.globalAlpha = 1;
  }
  // Over the dark: a lord sunk (or asleep, near) as a hump through the rock; a tell's line, ringed in FOE_EYE; the
  // breath; the icefall's rings and shards; the south's lane (`drawLane`); and under a lord up, its blows as three
  // diamonds.
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
      if (st === SLEEP || st === SUNK) {
        const r = FR[b][this.pose(b)][Math.sin(now * 0.4 + b) < 0 ? 1 : 0].r;
        if (r) { ctx.globalAlpha = 0.45; ctx.drawImage(image, r[0], r[1], r[2], r[3], Math.round(hx * T - ox - 24), Math.round(hy * T - oy - 24), 48, 48); }
        continue;
      }
      const x0 = this.x[b] * T - ox, y0 = this.y[b] * T - oy;
      ctx.fillStyle = EYE;
      if ((st === TELL || st === ACT) && BOSS[b].verb === 'ram') this.drawLane(game, ctx, ox, oy, b);
      else if (st === TELL || st === ACT) {
        const s = this.stage[b] - 1, locked = st === ACT || this.t[b] >= BOSS[b].tell[s] - LOCK;
        const ex = this.lockX[b] * T - ox, ey = this.lockY[b] * T - oy, len = Math.hypot(ex - x0, ey - y0) || 1, ux = (ex - x0) / len, uy = (ey - y0) / len;
        if (st === TELL) {
          ctx.globalAlpha = locked ? 0.95 : 0.4 + 0.3 * Math.sin(now * 30);
          for (let u = (now * 40) % 4; u < len; u += 4) ctx.fillRect(Math.round(x0 + ux * u), Math.round(y0 + uy * u), 1, 1);
          // (The lord itself ringed in the warning's colour.)
          const r = FR[b][this.pose(b)][this.face[b] < 0 ? 1 : 0].r;
          if (r) {
            const lit = tinted('bosses', EYE), px = Math.round(x0 - 24), py = Math.round(y0 - 24);
            ctx.globalAlpha = 0.45 + 0.35 * Math.sin(now * 24);
            for (let n = 0; n < 4; n++) ctx.drawImage(lit, r[0], r[1], r[2], r[3], px + SIDES[n][0], py + SIDES[n][1], 48, 48);
            ctx.globalAlpha = 1; ctx.drawImage(image, r[0], r[1], r[2], r[3], px, py, 48, 48);
          }
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
    if (st !== TELL) return;
    const r = FR[b][this.pose(b)][this.face[b] < 0 ? 1 : 0].r;
    if (!r) return;
    const lit = tinted('bosses', EYE), image = sheets.bosses.image, px = Math.round(sx - 24), py = Math.round(sy - 24);
    ctx.globalAlpha = 0.45 + 0.35 * Math.sin(now * 24);
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
// How far a point is from a segment.
function toSegment(x, y, x0, y0, x1, y1) {
  const ex = x1 - x0, ey = y1 - y0, len2 = ex * ex + ey * ey || 1, u = Math.max(0, Math.min(1, ((x - x0) * ex + (y - y0) * ey) / len2));
  return Math.hypot(x0 + ex * u - x, y0 + ey * u - y);
}
