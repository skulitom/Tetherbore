// Tetherbore: the game. A drill flies free on a tether from a fixed core, cuts whatever ground it is pushed into,
// and reels in any piece of ground it has drawn the tether round.
import { World, N, C, K, B, HARD, GRIT, GEMS, DX, DY, BIOME_NAMES, base, cellHash, sight, cellsAlong, RELIC_R, HOME_R } from './world.js';
import { sheets, draw, drawScaled, frameAt, duration, slice9, text, textWidth } from './atlas.js';
import { sfx, unlock, isMuted, setMuted, setAmbience } from './audio.js';

const T = 16;                                   // pixels in a cell
const HX = C + 0.5, HY = C + 0.5;               // the middle of the core, in cells
const SAVE_KEY = 'tetherbore-save-v3';
const DIR_BIOME = [B.LODE, B.EMBER, B.MIRE, B.FROST];
const GEM_ICON = [null, 'frost', 'ember', 'mire', 'lode'];
const GEM_COLOR = [null, '#bfe6ff', '#ffb060', '#b8f06a', '#d8b8ff'];

// ---------------------------------------------------------------- the economy
// Everything here is worked out from one model of how fast a player earns, so that prices keep pace with income
// however far out the game goes.
//
// Ground is worth more the further out it lies, in proportion to the distance (`richness`). A haul pays the worth of
// its cells times a bonus for its size that grows with the logarithm of the size (`haulBonus`): cutting a big piece is
// already quicker per cell than cutting small ones, so a bonus in proportion to size would pay with its square.
// For the same reason a piece larger than the winch's load pays less a cell (`overload`).
//
// A player with reach R cuts loops about R / 3 across, 48 at most. A loop of side s takes 4 s cells of cutting and
// frees s x s cells, so at `PACE` cells cut a second it earns about s x PACE / 4 cells a second (`income`). The price
// of a level of reach is that income for a set time (`MINUTES`), longer at each level. Every other upgrade is priced
// as a share of the reach it belongs beside (`beside`, in levels of reach), and takes gems only once that reach is
// well into the ground the gems come from.
const REACH = [12, 22, 40, 72, 130, 230, 420, 750, 1350, 2300];
const PACE = 0.9, WORTH = 1.6;                  // cells cut a second, turning and flying counted in; grit in an average cell
const GEM_REACH = 5;                            // the level of reach (230) from which upgrades may ask for gems
export const richness = r => Math.max(1, r / 12);
export const haulBonus = (n, winch = 1) => 1 + winch * Math.log2(Math.max(1, n)) / 8;
// The winch draws in so many cells at full pay; a piece beyond that pays less for each cell, though never less in all,
// so the biggest loop a player can cut is a little better than a middling one and not many times better.
const WINCH_LOAD = [150, 400, 1000, 2300, 5000, 12000];
export const overload = (n, level) => n <= WINCH_LOAD[level] ? 1 : (WINCH_LOAD[level] / n) ** 0.35;
export const income = R => { const side = Math.max(4, Math.min(48, R / 3)); return side * PACE / 4 * WORTH * richness(R * 0.7) * haulBonus(side * side); };
const round2 = n => { const unit = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1); return Math.round(n / unit) * unit; };
// What the step up from each level of reach costs: the first is within the first haul, then 1.5 minutes of income
// rising to 7.
const REACH_COST = REACH.slice(0, -1).map((R, l) => l === 0 ? 15 : round2(income(R) * (40 + 50 * l)));
// The price of something that belongs beside level `at` of reach (it may lie between two), and its gems.
const priced = (at, share) => {
  const lo = Math.min(REACH_COST.length - 1, Math.floor(at)), hi = Math.min(REACH_COST.length - 1, lo + 1);
  return round2(share * Math.exp(Math.log(REACH_COST[lo]) + (Math.log(REACH_COST[hi]) - Math.log(REACH_COST[lo])) * (at - lo)));
};
const gemsFor = at => at < GEM_REACH ? 0 : round2(150 * 2 ** (at - GEM_REACH));
const levels = (beside, share) => ({ beside, grit: beside.map(at => priced(at, share)), gems: beside.map(gemsFor) });

// ---------------------------------------------------------------- upgrades
// `values` is what each level gives; `grit` and `gems` what the next level costs; `gem` whose gems it takes.
export const UPGRADES = [
  // The tether's reach: how far from the core the drill may go, by any road. Each level nearly doubles it.
  { id: 'tether', icon: 'string', name: 'REACH', what: 'TETHER GOES FURTHER', values: REACH, gem: B.MIRE, ...levels(REACH.slice(0, -1).map((R, l) => l), 1), show: v => `${v}` },
  { id: 'drill', icon: 'drill', name: 'BIT', what: 'CUTS FASTER', values: [1, 2, 3, 4, 5], gem: B.LODE, ...levels([0.6, 2.2, 4.4, 6.6], 0.6), show: v => `MK${v}` },
  { id: 'winch', icon: 'winch', name: 'WINCH', what: 'BIGGER HAULS AT FULL PAY', values: [1, 1.3, 1.6, 2, 2.5, 3], gem: B.FROST, ...levels([0.8, 2, 3.6, 5.4, 7.2], 0.5), show: v => `x${v}` },
  { id: 'scanner', icon: 'scanner', name: 'SCAN', what: 'SEES DEEPER IN ROCK', values: [3, 4, 5, 7, 9], gem: B.FROST, ...levels([0.4, 1.6, 3.4, 5.8], 0.3), show: v => `${v}` },
  { id: 'momentum', icon: 'momentum', name: 'RAM', what: 'FLIES FASTER', values: [1, 1.25, 1.5, 1.8, 2.2], gem: B.LODE, ...levels([0.7, 2.4, 4.2, 6.2], 0.4), show: v => `x${v}` },
  { id: 'bombs', icon: 'bomb', name: 'BLAST', what: 'BOMB: CLEARS ROCK', values: [0, 1, 2, 3, 4], gem: B.EMBER, ...levels([1, 2.8, 5, 7.4], 0.35), show: v => `${v}` },
];
// Where each direction's gems are found, for a price that cannot be met yet.
const GEM_WHERE = [null, 'NORTH', 'SOUTH', 'WEST', 'EAST'];
// What flies off each kind of ground when it is cut, the dark each direction's ground lies in, its motes, and its
// colour on the map.
const DEBRIS = {
  crust: ['#6f5b49', '#806a55', '#a08a6c'], frost: ['#bcd8ee', '#ffffff', '#a2c4e2'], ember: ['#74403a', '#c07a5c', '#ff8a3a'],
  mire: ['#665478', '#5f9450', '#b4e878'], lode: ['#b98a5a', '#f0d8a0', '#a57648'], slate: ['#6a7080', '#a4acbc', '#454a5a'],
  vault: ['#463a68', '#8a78c0', '#c8a8ff'], ice: ['#6fb0e0', '#d8f4ff', '#ffffff'], basalt: ['#463e4c', '#7a6a78', '#8a3424'],
  rime: ['#62b8b4', '#d8fff4', '#84d4c8'], magma: ['#7a2418', '#e8743a', '#ffb040'], bloom: ['#8a3c8c', '#ffa0e0', '#7af0d0'],
  gilt: ['#6e5a34', '#ffe680', '#ffd040'], bedrock: ['#1e1e26', '#34343e'],
};
const GLOOM = [[10, 8, 7], [5, 12, 30], [22, 5, 6], [14, 6, 26], [22, 13, 4], [3, 18, 24], [30, 5, 3], [26, 4, 28], [24, 18, 2]];
const MOTE = ['#8a7a66', '#ffffff', '#ff9a3a', '#a5f0a0', '#ffe08a', '#d8fff4', '#ffc040', '#ffa0e0', '#ffe680'];
const MAPC = [[111, 91, 73], [188, 216, 238], [116, 64, 58], [102, 84, 120], [185, 138, 90], [98, 184, 180], [122, 36, 24], [138, 60, 140], [110, 90, 52]];
// How the tether looks at each level of reach: rope, braid, cable, then lines of light.
const TETHERS = [
  { a: '#e8dcc0', b: '#e8dcc0', dash: 1 }, { a: '#e8dcc0', b: '#b89a6c', dash: 0.5 }, { a: '#f0d890', b: '#b0803a', dash: 0.5 },
  { a: '#f0b060', b: '#c8442a', dash: 0.5 }, { a: '#d8e0ec', b: '#8a94a8', dash: 0.5 }, { a: '#eef4ff', b: '#6e7c98', dash: 0.25, thick: true },
  { a: '#ffe89a', b: '#c89020', dash: 0.25, thick: true }, { a: '#fff4c0', b: '#e8a020', dash: 0.5, thick: true },
  { a: '#a8fff0', b: '#30c8c0', dash: 0.5, thick: true }, { a: '#ffc8f4', b: '#b050d0', dash: 0.5, thick: true }, { a: '#ffffff', b: '#5cc4f0', dash: 0.5, thick: true },
];
// Nothing is too hard to cut: tougher ground only takes longer, and a better bit cuts all of it faster.
const DIG_TIME = [0, 0, 0, 0.24, 0.45, 0.24, 0.45, 1.0, 1.8, 0.24, 0, 0.18, 0.45, 0.6, 0];
const SPEED = [1, 1.6, 2.4, 3.6, 5];
const FLY = 9, BODY = 0.34;                     // cells a second in open ground; the drill's half-width in cells
const LIGHT_STEP = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.41], [-1, 1, 1.41], [1, -1, 1.41], [-1, -1, 1.41]];

const compact = n => n < 1000 ? `${Math.floor(n)}` : n < 10000 ? `${(Math.floor(n / 100) / 10).toFixed(1)}K` : n < 1e6 ? `${Math.floor(n / 1000)}K`
  : n < 1e9 ? `${(Math.floor(n / 1e5) / 10).toFixed(1)}M` : `${(Math.floor(n / 1e8) / 10).toFixed(1)}B`;
const store = () => new Promise((resolve, reject) => {
  const open = indexedDB.open('tetherbore', 1);
  open.onupgradeneeded = () => open.result.createObjectStore('pieces');
  open.onsuccess = () => resolve(open.result);
  open.onerror = () => reject(open.error);
});

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.world = new World();
    this.W = 180; this.H = 320;
    this.time = 0;
    this.input = { id: null, ax: 0, ay: 0, px: 0, py: 0, vx: 0, vy: 0, m: 0, keys: new Set(), auto: null };
    this.band = []; this.pieces = []; this.loose = []; this.looseSet = new Set(); this.preview = []; this.under = new Set();
    this.effects = []; this.popups = []; this.hauls = []; this.clouds = []; this.sparks = new Map(); this.lavaVol = new Map(); this.frostOpen = [];
    this.parts = []; this.rings = []; this.motes = []; this.gloom = [10, 8, 7]; this.flash = 0; this.counted = 0; this.chime = 3;
    this.shake = 0; this.twang = 0; this.edge = 0; this.hurt = 0; this.coreFlash = 0; this.banner = null; this.shop = false; this.shopRise = 0; this.confirmReset = 0;
    this.buttons = [];
    this.chunks = new Map(); this.version = 0;
    this.fresh((Math.random() * 1e9) | 0, true);
  }

  // ------------------------------------------------------------ state
  fresh(seed, quiet = false) {
    this.S = { seed, grit: 0, gems: [0, 0, 0, 0, 0], lv: Object.fromEntries(UPGRADES.map(u => [u.id, 0])), relics: [0, 0, 0, 0], wrecks: [0, 0, 0, 0, 0, 0, 0, 0],
      stats: { hauls: 0, best: 0, buys: 0, moves: 0, time: 0 }, won: false };
    this.world.reset(seed);
    this.begin();
    if (!quiet) store().then(db => db.transaction('pieces', 'readwrite').objectStore('pieces').clear()).catch(() => {});
  }
  begin() {
    const w = this.world;
    this.pending = { grit: 0, gems: [0, 0, 0, 0, 0] };
    this.parts.length = 0; this.rings.length = 0; this.effects.length = 0; this.popups.length = 0; this.hauls.length = 0; this.clouds.length = 0;
    this.sparks.clear(); this.lavaVol.clear(); this.frostOpen.length = 0; w.lava.clear(); w.dug.clear();
    this.drill = { x: HX, y: HY, px: HX, py: HY, vx: 0, vy: 0, ang: 0, mode: 'free', tx: 0, ty: 0, speed: 0, dig: -1, digT: 0, digDur: 1, stun: 0, squash: 0, run: 0, armed: true, cell: -1, home: true };
    this.bombs = this.val('bombs');
    this.cam = { x: HX * T, y: HY * T };
    this.band = [[HX, HY], [HX, HY]];
    this.pieces = [];
    w.see(C, C, this.val('scanner') + 4);
    this.changed([C * N + C + 3]);
    this.shop = false;
  }
  val(id) { const u = UPGRADES.find(u => u.id === id); return u.values[this.S.lv[id]]; }
  get di() { return Math.floor(this.drill.y) * N + Math.floor(this.drill.x); }
  get far() { return Math.hypot(this.drill.x - HX, this.drill.y - HY); }
  get atCore() { return this.far < 1.7; }

  // What was bought and banked goes in local storage; the ground, a piece at a time, in the browser's database.
  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 3, ...this.S })); } catch { /* the game goes on without saving */ }
    const w = this.world, ids = [...w.touched];
    if (!ids.length) return;
    w.touched.clear();
    store().then(db => {
      const pieces = db.transaction('pieces', 'readwrite').objectStore('pieces');
      for (const id of ids) { const p = w.chunks[id]; if (p) pieces.put({ kind: p.kind, biome: p.biome, seen: p.seen }, id); }
    }).catch(() => {});
  }
  async restore() {
    try {
      const data = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!data || data.v !== 3) return false;
      const { v, ...S } = data;
      const db = await store();
      const rows = await new Promise((resolve, reject) => {
        const found = [], walk = db.transaction('pieces').objectStore('pieces').openCursor();
        walk.onsuccess = () => { const c = walk.result; if (c) { found.push([c.key, c.value]); c.continue(); } else resolve(found); };
        walk.onerror = () => reject(walk.error);
      });
      this.S = S;
      for (const u of UPGRADES) this.S.lv[u.id] = Math.min(this.S.lv[u.id] ?? 0, u.values.length - 1);
      this.world.reset(S.seed);
      for (const [id, p] of rows) this.world.chunks[id] = p;
      this.begin();
      return true;
    } catch { return false; }
  }

  // ------------------------------------------------------------ view
  resize(cssW, cssH, dpr) {
    const scale = Math.max(1, Math.round(Math.min(cssW, cssH * 0.62) * dpr / 190));
    this.W = Math.ceil(cssW * dpr / scale); this.H = Math.ceil(cssH * dpr / scale);
    this.canvas.width = this.W; this.canvas.height = this.H;
    this.ctx.imageSmoothingEnabled = false;
  }

  // ------------------------------------------------------------ input
  // Press anywhere and drag: the drill flies the way the thumb has moved from where it came down, at any angle,
  // faster the further it is dragged. The origin trails the thumb, so a change of mind is a short stroke.
  pointerDown(id, x, y) {
    unlock();
    if (this.input.id !== null) return;
    const hit = this.buttons.find(b => x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h);
    if (hit) { hit.act(); return; }
    if (this.shop) { this.shop = false; sfx.tap(); return; }
    Object.assign(this.input, { id, ax: x, ay: y, px: x, py: y, m: 0 });
    this.drill.armed = true;
  }
  pointerMove(id, x, y) {
    const inp = this.input;
    if (inp.id !== id) return;
    inp.px = x; inp.py = y;
    const dx = x - inp.ax, dy = y - inp.ay, far = Math.hypot(dx, dy);
    if (far < 4) { inp.m = 0; return; }
    inp.vx = dx / far; inp.vy = dy / far; inp.m = Math.min(1, (far - 3) / 12);
    if (far > 24) { inp.ax = x - inp.vx * 24; inp.ay = y - inp.vy * 24; }
  }
  pointerUp(id) { if (this.input.id === id) { this.input.id = null; this.input.m = 0; } }
  key(code, down) {
    const dir = { ArrowRight: 0, KeyD: 0, ArrowDown: 1, KeyS: 1, ArrowLeft: 2, KeyA: 2, ArrowUp: 3, KeyW: 3 }[code];
    if (dir !== undefined) {
      if (down) { unlock(); if (this.shop) this.shop = false; if (!this.input.keys.size) this.drill.armed = true; this.input.keys.add(dir); } else this.input.keys.delete(dir);
      return true;
    }
    if (!down) return false;
    unlock();
    if (code === 'KeyB' || code === 'KeyE' || code === 'Space') { this.blast(); return true; }
    if (code === 'KeyU' || code === 'Enter') { if (this.atCore) this.shop = !this.shop; return true; }
    if (code === 'Escape') { this.shop = false; return true; }
    return false;
  }
  // Which way the player is steering, and how hard: [x, y, 0-1].
  steer() {
    const inp = this.input;
    if (inp.auto) return inp.auto;
    if (inp.keys.size) {
      let x = 0, y = 0;
      for (const k of inp.keys) { x += DX[k]; y += DY[k]; }
      const far = Math.hypot(x, y);
      return far ? [x / far, y / far, 1] : [0, 0, 0];
    }
    return inp.id !== null && inp.m > 0 ? [inp.vx, inp.vy, inp.m] : [0, 0, 0];
  }

  // ------------------------------------------------------------ the tether
  // The tether is a string from the drill to the core: `band`, a line of points, the drill's end first. It runs
  // straight and bends only where it lies against a corner of ground. A bend is [x, y, turn, cell, corner]: a point
  // a hair off the corner, which way the string turns there (1 or -1), the cell whose corner it is, and which corner.
  //
  // Nothing is nudged into place. When an end of the string moves, the string sweeps a triangle about the bend next
  // to it, and any corner of ground inside that triangle is one the string has caught: it becomes a bend at once,
  // exactly at the corner. When the string swings back until it no longer turns round a bend, the bend is let go.
  // So the string is always the tight one for the way it has been led, and it never creeps.

  // The first corner a string catches as its end moves from `cur` to `to` about `pivot`: [x, y, cell, corner], null
  // when there is none, undefined when the triangle is too large to search. It is caught when the string meets the
  // rock's own corner, and the bend is put a hair off it. `skip` is the corners the string is on already.
  catchIn(pivot, cur, to, skip) {
    const w = this.world, m = 0.14, px = pivot[0], py = pivot[1], cx = cur[0], cy = cur[1], tx = to[0], ty = to[1];
    const area = (cx - px) * (ty - py) - (cy - py) * (tx - px);
    if (Math.abs(area) < 1e-9) return null;
    const side = area > 0 ? 1 : -1, tri = [[px, py], [cx, cy], [tx, ty]];
    let best = null, least = Infinity, reach = 0, looked = 0;
    for (let row = Math.floor(Math.min(py, cy, ty) - m) - 1; row <= Math.floor(Math.max(py, cy, ty) + m) + 1; row++) {
      // The stretch of this row the triangle crosses, a cell to spare either side.
      const ya = row - 0.3, yb = row + 1.3;
      let lo = Infinity, hi = -Infinity;
      for (let e = 0; e < 3; e++) {
        const a = tri[e], b = tri[(e + 1) % 3];
        if (a[1] >= ya && a[1] <= yb) { lo = Math.min(lo, a[0]); hi = Math.max(hi, a[0]); }
        if (a[1] === b[1]) continue;
        for (const y of [ya, yb]) {
          const t = (y - a[1]) / (b[1] - a[1]);
          if (t >= 0 && t <= 1) { const x = a[0] + (b[0] - a[0]) * t; lo = Math.min(lo, x); hi = Math.max(hi, x); }
        }
      }
      if (lo > hi) continue;
      const x0 = Math.floor(lo - m) - 1, x1 = Math.floor(hi + m) + 1;
      if ((looked += x1 - x0 + 1) > 400000) return undefined;
      for (let x = x0; x <= x1; x++) {
        if (w.k(row * N + x) === K.EMPTY) continue;
        for (let c = 0; c < 4; c++) {
          // A corner that sticks out: the three other cells round it are open.
          const ox = c & 1, oy = c >> 1, nx = ox ? 1 : -1, ny = oy ? 1 : -1;
          if (w.k(row * N + x + nx) !== K.EMPTY || w.k((row + ny) * N + x) !== K.EMPTY || w.k((row + ny) * N + x + nx) !== K.EMPTY) continue;
          const key = (row * N + x) * 4 + c;
          if (skip.includes(key)) continue;
          const qx = x + ox, qy = row + oy;
          const off = side * ((cx - px) * (qy - py) - (cy - py) * (qx - px));
          if (off <= 1e-7 || side * ((tx - cx) * (qy - cy) - (ty - cy) * (qx - cx)) < -1e-9 || side * ((px - tx) * (qy - ty) - (py - ty) * (qx - tx)) <= 1e-7) continue;
          // The one met first is the one least far round from where the string lay; of two in line, the further.
          const round = Math.atan2(off, (cx - px) * (qx - px) + (cy - py) * (qy - py)), far = (qx - px) ** 2 + (qy - py) ** 2;
          if (round < least - 1e-9 || (round < least + 1e-9 && far > reach)) { least = round; reach = far; best = [qx, qy, row * N + x, key, qx + nx * m, qy + ny * m]; }
        }
      }
    }
    return best;
  }
  // The bends a string picks up as its end moves from `from` to `to` while the rest holds at `pivot`, in order from
  // the pivot outward; undefined when that could not be worked out.
  caught(pivot, from, to, skip = []) {
    const out = [];
    let cur = from;
    skip = skip.slice();
    if (pivot[4] !== undefined) skip.push(pivot[4]);
    for (let guard = 0; guard < 40; guard++) {
      const q = this.catchIn(pivot, cur, to, skip);
      if (q === undefined) return undefined;
      if (!q) break;
      // Where the moving end was when the string met the corner.
      const ax = q[0] - pivot[0], ay = q[1] - pivot[1], mx = to[0] - cur[0], my = to[1] - cur[1], den = mx * ay - my * ax;
      const t = den ? Math.max(0, Math.min(1, -((cur[0] - pivot[0]) * ay - (cur[1] - pivot[1]) * ax) / den)) : 0;
      cur = [cur[0] + mx * t, cur[1] + my * t];
      pivot = [q[4], q[5], Math.sign(ax * (to[1] - q[1]) - ay * (to[0] - q[0])) || 1, q[2], q[3]];
      skip.push(q[3]);
      out.push(pivot);
    }
    return out;
  }
  // The drill has moved: the string follows, catching corners and letting go of bends it no longer turns round.
  tend() {
    const d = this.drill, P = this.band, to = [d.x, d.y];
    let cur = P[0];
    for (let guard = 0; guard < 40 && P.length >= 2; guard++) {
      const pivot = P[1];
      let target = to, lift = false;
      if (P.length > 2 && pivot[2]) {
        // Does the string swing past straight at this bend on the way? Then it goes only that far first.
        const bx = pivot[0] - P[2][0], by = pivot[1] - P[2][1];
        const now = bx * (cur[1] - pivot[1]) - by * (cur[0] - pivot[0]), then = bx * (to[1] - pivot[1]) - by * (to[0] - pivot[0]);
        if (then * pivot[2] < 0) {
          lift = true;
          const t = now * pivot[2] <= 0 ? 0 : now / (now - then);
          target = [cur[0] + (to[0] - cur[0]) * t, cur[1] + (to[1] - cur[1]) * t];
        }
      }
      const got = this.caught(pivot, cur, target, P.length > 2 && P[2][4] !== undefined ? [P[2][4]] : []);
      if (got && got.length) P.splice(1, 0, ...got.reverse()); else if (lift) P.splice(1, 1);
      cur = target;
      if (!lift) break;
    }
    P[0] = to;
  }
  // The ground has changed: a bend whose corner is gone, or that the string no longer turns round, is let go, and
  // the string takes up whatever corners lie in the way as it straightens.
  retighten() {
    const w = this.world, P = this.band;
    for (let guard = 0, n = 1; n < P.length - 1 && guard < 600; guard++) {
      const a = P[n - 1], b = P[n], c = P[n + 1];
      const turn = (b[0] - c[0]) * (a[1] - b[1]) - (b[1] - c[1]) * (a[0] - b[0]);
      if (b[2] && w.k(b[3]) !== K.EMPTY && turn * b[2] >= 0) { n++; continue; }
      const got = this.caught(c, b, a, [b[4], a[4]].filter(k => k !== undefined));
      if (!got) { n++; continue; }
      P.splice(n, 1, ...got.reverse());
      n = Math.max(1, n - 1);
    }
  }
  // After the ground changed: which pieces lie loose, how the tether settles, what the next cut would free.
  // `touched` is the cells that were opened.
  changed(touched = []) {
    const w = this.world;
    this.version++;
    // A loose piece that has been cut into is whatever is left of it, which may be several pieces now.
    const was = this.looseSet, pieces = [];
    for (const cells of this.pieces) {
      if (cells.every(i => w.k(i) !== K.EMPTY)) { pieces.push(cells); continue; }
      const left = new Set(cells.filter(i => w.k(i) !== K.EMPTY));
      for (const start of left) {
        const part = [start];
        left.delete(start);
        for (let head = 0; head < part.length; head++) for (const j of [part[head] + 1, part[head] - 1, part[head] + N, part[head] - N]) if (left.delete(j)) part.push(j);
        pieces.push(part);
      }
    }
    this.pieces = pieces;
    this.looseSet = new Set(pieces.flat());
    // A cut into ground that was held may have cut a piece off, of any size.
    for (const i of touched) {
      if (was.has(i)) continue;
      for (const cells of w.freed(i, 120000)) {
        if (this.looseSet.has(cells[0])) continue;
        this.pieces.push(cells);
        for (const c of cells) this.looseSet.add(c);
      }
    }
    this.loose = this.pieces.flat();
    this.retighten();
    this.reelIfRound();
  }
  // A loose piece is lassoed once the tether has gone far enough round it that the straight way home would close
  // the loop: it is reeled in there and then.
  reelIfRound() {
    const pts = this.band;
    if (!this.pieces.length || pts.length < 3) return;
    // How many times the tether, closed by the straight line from the core back to the drill, winds round a point.
    const winds = (x, y) => {
      let turns = 0;
      for (let n = 0; n < pts.length; n++) {
        const a = pts[n], b = pts[(n + 1) % pts.length];
        if (a[1] <= y) { if (b[1] > y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) > 0) turns++; }
        else if (b[1] <= y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) < 0) turns--;
      }
      return turns;
    };
    // Everything the tether is round goes in as one haul.
    const round = this.pieces.filter(cells => cells.every(i => winds((i % N) + 0.5, Math.floor(i / N) + 0.5) !== 0));
    if (!round.length) return;
    this.haul(round.flat());
    this.changed();
  }
  // The tether lets the drill go this far from the core and no further, whatever road it takes.
  within(x, y) { return Math.hypot(x - HX, y - HY) <= this.val('tether') + 0.3; }

  // ------------------------------------------------------------ flying and cutting
  free(x, y) {
    const w = this.world;
    for (const [u, v] of [[-BODY, -BODY], [BODY, -BODY], [-BODY, BODY], [BODY, BODY]]) {
      const i = Math.floor(y + v) * N + Math.floor(x + u);
      if (w.k(i) !== K.EMPTY || w.lava.has(i)) return false;
    }
    return true;
  }
  fly(dt) {
    const w = this.world, d = this.drill;
    let [ix, iy, m] = this.steer();
    if (d.stun > 0 || this.shop) m = 0;
    // Just reeled home: it stays put until the thumb lets go.
    if (d.park) { if (m === 0) d.park = false; m = 0; }
    // Ground that grew back round the drill never holds it: it is set in the middle of the cell it is in.
    if (d.mode === 'free' && !this.free(d.x, d.y) && w.k(this.di) === K.EMPTY && this.free(Math.floor(d.x) + 0.5, Math.floor(d.y) + 0.5)) { d.x = Math.floor(d.x) + 0.5; d.y = Math.floor(d.y) + 0.5; }
    d.px = d.x; d.py = d.y;
    const far = this.far;
    if (d.mode !== 'free') {
      // Thrown from the core, or being reeled home: straight to where it is going.
      const dx = d.tx - d.x, dy = d.ty - d.y, left = Math.hypot(dx, dy), step = d.speed * dt;
      d.ang = Math.atan2(dy, dx); d.vx = dx / (left || 1) * d.speed; d.vy = dy / (left || 1) * d.speed;
      if (left > step) { d.x += dx / left * step; d.y += dy / left * step; }
      else {
        d.x = d.tx; d.y = d.ty; d.vx = d.vy = 0;
        if (d.mode === 'home') { sfx.dock(); this.ring(HX * T, HY * T, '#84dcff', 30); d.armed = false; d.park = true; }
        else { sfx.thud(); this.land(); d.squash = 0.12; }
        d.mode = 'free'; d.run = 0;
      }
      this.look();
      return;
    }
    if (m > 0) {
      // The drill turns to face the way it is steered, quickly but not at once.
      let turn = Math.atan2(iy, ix) - d.ang;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      d.ang += turn * Math.min(1, dt * 18);
      // From the very middle of the core a fresh stroke throws it, straight out along the drag.
      if (far < 0.3 && d.armed && m > 0.5) { d.armed = false; if (this.fling(ix, iy)) return; }
      d.armed = false;
      d.run = Math.min(12, d.run + dt);
    } else d.run = 0;
    // Speed builds over a long clear run, so far ground is not a long walk.
    const top = FLY * this.val('momentum') * (1 + Math.max(0, d.run - 0.8) * 0.9) * m, ease = Math.min(1, dt * (m > 0 ? 14 : 10));
    d.vx += (ix * top - d.vx) * ease; d.vy += (iy * top - d.vy) * ease;
    // Move a little at a time, sliding along whatever stops it.
    const speed = Math.hypot(d.vx, d.vy), steps = Math.max(1, Math.ceil(speed * dt / 0.3));
    let hitX = false, hitY = false;
    for (let n = 0; n < steps; n++) {
      const nx = d.x + d.vx * dt / steps, ny = d.y + d.vy * dt / steps;
      if (this.free(nx, d.y)) d.x = nx; else hitX = true;
      if (this.free(d.x, ny)) d.y = ny; else hitY = true;
    }
    // The end of the tether's reach.
    const R = this.val('tether'), out = Math.hypot(d.x - HX, d.y - HY);
    if (out > R) {
      d.x = HX + (d.x - HX) / out * R; d.y = HY + (d.y - HY) / out * R;
      if (!this.free(d.x, d.y)) { d.x = d.px; d.y = d.py; }
      if (m > 0 && (d.vx * (d.x - HX) + d.vy * (d.y - HY)) > 0 && this.edge <= 0) this.refuse();
      d.run = 0;
    }
    // Pushed into ground, it cuts.
    if (m > 0 && (hitX || hitY)) {
      d.run = 0;
      const i = this.bite(ix, iy, hitX, hitY);
      if (i < 0) { d.dig = -1; if (hitX) d.vx = 0; if (hitY) d.vy = 0; }
      else {
        const k = w.k(i);
        if (HARD[k] >= 99) {
          if (this.time - (this.lastClink ?? -1) > 0.35) { this.lastClink = this.time; sfx.clink(); d.squash = 0.12; this.effect('sparks', 'sparks', (d.x + ix * 0.5) * T, (d.y + iy * 0.5) * T); }
          d.dig = -1;
        } else if (!this.within((i % N) + 0.5, Math.floor(i / N) + 0.5)) { if (this.edge <= 0) this.refuse(); d.dig = -1; }
        else {
          if (d.dig !== i) { d.dig = i; d.digT = 0; d.digDur = DIG_TIME[k] / SPEED[this.S.lv.drill]; this.foresee(i); }
          const before = d.digT;
          d.digT += dt;
          if (((d.digT * 30) | 0) !== ((before * 30) | 0) && d.digDur > 0.15) { sfx.grind(); if (d.digDur > 0.4) this.shake = Math.max(this.shake, 1.2); }
          if (((d.digT * 18) | 0) !== ((before * 18) | 0)) this.chips(i % N, Math.floor(i / N), this.rockSheet(k, w.b(i)), 2, d.ang, 0.6);
          // Cutting draws the drill square on to the block, so tunnels come out clean.
          const cx = (i % N) + 0.5, cy = Math.floor(i / N) + 0.5;
          if (Math.abs(cx - d.x) > Math.abs(cy - d.y)) { const ny = d.y + (cy - d.y) * Math.min(1, dt * 6); if (this.free(d.x, ny)) d.y = ny; }
          else { const nx = d.x + (cx - d.x) * Math.min(1, dt * 6); if (this.free(nx, d.y)) d.x = nx; }
          if (d.digT >= d.digDur) this.finishDig(i);
        }
      }
    } else { if (d.dig >= 0) this.preview = []; d.dig = -1; }
    // Close to the core and heading in, the tether takes over and reels the drill the rest of the way home.
    const near = this.far;
    if (m > 0 && near < 3.3 && near > 0.4 && (d.vx * (HX - d.x) + d.vy * (HY - d.y)) > 0.5 * speed * near && near < far + 1e-6 && sight(w, d.x, d.y, HX, HY)) {
      d.mode = 'home'; d.tx = HX; d.ty = HY; d.speed = 22; sfx.slide(3);
    }
    if (m > 0 && speed > 1) this.S.stats.moves += dt;
    this.look();
  }
  // The cell the bit is pressed into: the ground that stopped it, on the side it is being pushed.
  bite(ix, iy, hitX, hitY) {
    const w = this.world, d = this.drill, reach = BODY + 0.3, tries = [];
    const sx = Math.sign(ix) || 1, sy = Math.sign(iy) || 1;
    const across = [[d.x + sx * reach, d.y], [d.x + sx * reach, d.y - BODY], [d.x + sx * reach, d.y + BODY]];
    const down = [[d.x, d.y + sy * reach], [d.x - BODY, d.y + sy * reach], [d.x + BODY, d.y + sy * reach]];
    if (hitX && (!hitY || Math.abs(ix) >= Math.abs(iy))) tries.push(...across, ...(hitY ? down : []));
    else tries.push(...down, ...(hitX ? across : []));
    for (const [x, y] of tries) { const i = Math.floor(y) * N + Math.floor(x); if (w.k(i) !== K.EMPTY) return i; }
    return -1;
  }
  // From the core the drill can be thrown at any angle: it flies straight along the drag until ground, lava or
  // the end of its reach stops it. Returns false when it cannot leave that way.
  fling(ix, iy) {
    const w = this.world, d = this.drill, R = this.val('tether');
    const cells = cellsAlong(HX, HY, HX + ix * R, HY + iy * R, 12000);
    let last = -1;
    for (let n = 1; n < cells.length; n++) {
      const i = cells[n];
      if (w.k(i) !== K.EMPTY || w.lava.has(i) || !this.within((i % N) + 0.5, Math.floor(i / N) + 0.5)) break;
      last = n;
    }
    if (last < 2) return false;
    // As far along the drag as the last open cell lets the drill's middle go.
    // It stays on the line of the drag: where its body would not fit, it stops a little short instead.
    const lx = (cells[last] % N) + 0.5, ly = Math.floor(cells[last] / N) + 0.5;
    let along = (lx - HX) * ix + (ly - HY) * iy;
    while (along > 0.5 && !this.free(HX + ix * along, HY + iy * along)) along -= 0.1;
    if (along <= 0.5) return false;
    d.tx = HX + ix * along; d.ty = HY + iy * along;
    d.mode = 'fling'; d.speed = Math.max(34, along / 0.55); d.ang = Math.atan2(iy, ix);
    sfx.slide(Math.min(12, along));
    return true;
  }
  // What the drill sees from where it is, and what being home does.
  look() {
    const d = this.drill, cell = this.di;
    if (cell !== d.cell) {
      d.cell = cell;
      if (this.world.see(Math.floor(d.x), Math.floor(d.y), this.val('scanner'))) this.version++;
    }
    const home = this.atCore;
    if (home && !d.home && this.bombs < this.val('bombs')) { this.bombs = this.val('bombs'); sfx.dock(); this.coreFlash = 0.25; }
    if (home && !d.home) {
      const P = this.band;
      if (P.length > 2) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, found = false;
        for (const [x, y] of P) { x0 = Math.min(x0, Math.floor(x) - 1); y0 = Math.min(y0, Math.floor(y) - 1); x1 = Math.max(x1, Math.floor(x) + 1); y1 = Math.max(y1, Math.floor(y) + 1); }
        for (let n = 1; n < P.length - 1; n++) {
          if (P[n][3] === undefined || this.looseSet.has(P[n][3])) continue;
          const cells = this.world.pieceIn(P[n][3], x0, y0, x1, y1, 400000);
          if (!cells) continue;
          this.pieces.push(cells); found = true;
          for (const c of cells) this.looseSet.add(c);
        }
        if (found) { this.loose = this.pieces.flat(); this.reelIfRound(); }
      }
      this.save();
    }
    d.home = home;
  }
  // The end of the tether's reach: say so, and show where the edge is.
  refuse() {
    const d = this.drill;
    this.twang = 0.45; this.edge = 1.2; sfx.twang(); d.squash = 0.14;
    this.popup(d.x - 0.5, d.y - 1, 'REACH', '#ff7a5a', 'tether');
  }
  // The last cut glows: the ground that would come free if this cell were cut.
  foresee(i) {
    const found = this.world.freed(i, 4000);
    this.preview = found.length ? [{ i, cells: found.flat() }] : [{ i, cells: [] }];
  }
  finishDig(i) {
    const w = this.world, d = this.drill, x = i % N, y = Math.floor(i / N), k = w.k(i), b = w.b(i);
    w.setK(i, K.EMPTY);
    if (base(b) === B.FROST) { w.dug.set(i, this.time); this.frostOpen.push(i); }
    const tough = k === K.SLATE ? 3 : k === K.VAULT ? 4 : k === K.DENSE || k === K.ORE_B || k === K.BASALT ? 2 : 1;
    sfx.dig(tough);
    this.chips(x, y, this.rockSheet(k, b), 9 + tough * 3, d.ang, 1);
    this.effect('dust', 'dust', (x + 0.5) * T, (y + 0.5) * T);
    if (tough >= 2 || k === K.ICE) this.effect('shatter', 'shatter', (x + 0.5) * T, (y + 0.5) * T);
    if (k === K.ORE_A || k === K.ORE_B) this.popup(x, y, 'CRUSHED', '#9a94a8');
    this.shake = Math.max(this.shake, 1 + tough * 0.5);
    if (k === K.HAZARD) this.trigger(i, b, true);
    for (let s = 0; s < 4; s++) {
      const j = (y + DY[s]) * N + x + DX[s];
      if (w.k(j) === K.HAZARD) this.trigger(j, w.b(j), false);
    }
    d.dig = -1; this.preview = [];
    w.see(x, y, 1);
    this.changed([i]);
  }

  // ------------------------------------------------------------ hauling
  haul(cells) {
    const w = this.world, S = this.S, n = cells.length;
    let grit = 0, relic = -1, cx = 0, cy = 0, caches = 0, lump = 0, parts = 0;
    S.wrecks ??= [0, 0, 0, 0, 0, 0, 0, 0];
    const gems = [0, 0, 0, 0, 0], sprites = [], show = Math.max(1, Math.ceil(n / 400));
    cells.forEach((i, at) => {
      const x = i % N, y = Math.floor(i / N), k = w.k(i), b = w.b(i), far = Math.hypot(x - C, y - C), rich = richness(far) * (b > 4 ? 2 : 1);
      const gem = b ? GEMS[k] * (b > 4 ? 2 : 1) : 0;
      grit += GRIT[k] * rich; gems[base(b)] += gem;
      if (b === B.CRUST && (k === K.ORE_A || k === K.ORE_B)) grit += (k === K.ORE_B ? 20 : 4) * rich;
      if (k === K.RELIC) relic = w.relicAt.indexOf(i);
      // A cache holds what a quarter of a minute's cutting out here would earn; a wreck gives up its part.
      if (k === K.CACHE) { caches++; lump += round2(income(Math.max(22, far)) * 12); }
      if (k === K.WRECK) { const which = w.wrecks.findIndex(([wx, wy]) => wx === x && wy === y); if (which >= 0 && !S.wrecks[which]) { S.wrecks[which] = 1; parts++; } }
      cx += x; cy += y;
      // A very large piece is shown by a share of its cells.
      if (at % show === 0) sprites.push({ x, y, tile: this.rockRect(x, y, k, b), over: this.overlay(k), gem: gem ? base(b) : 0, gems: gem * show, biome: b, far });
    });
    for (const i of cells) w.setK(i, K.EMPTY);
    // Each part brought home from a wreck makes every haul pay a tenth more.
    const over = overload(n, S.lv.winch), mult = haulBonus(n, this.val('winch')) * (1 + 0.1 * S.wrecks.filter(Boolean).length) * over;
    grit = Math.round(grit * mult) + lump;
    for (let b = 1; b < 5; b++) gems[b] = Math.round(gems[b]);
    S.grit += grit; this.pending.grit += grit;
    for (let b = 1; b < 5; b++) { S.gems[b] += gems[b]; this.pending.gems[b] += gems[b]; }
    S.stats.hauls++; S.stats.best = Math.max(S.stats.best, n);
    sprites.sort((a, b) => a.far - b.far);
    const count = sprites.length, spread = Math.min(1.0, 0.2 + count * 0.012), lift = Math.min(0.5, 0.26 + count * 0.003);
    // The rubble is drawn in along the tether as it lay when the loop closed.
    const route = this.band.map(([x, y]) => [x * T, y * T]), cum = [0];
    for (let k = 1; k < route.length; k++) cum.push(cum[k - 1] + Math.hypot(route[k][0] - route[k - 1][0], route[k][1] - route[k - 1][1]));
    const length = cum[cum.length - 1];
    // Small pieces break fine, big ones coarse, so there are never too many bits of ground to push about.
    const per = count <= 24 ? 4 : count <= 140 ? 2 : 1, size = T / per, h = { sprites, t: 0, n, count, grit, gems, left: grit, paid: 0, lift, relic, route, cum, length,
      bits: [], total: count * per * per, size, v: 0, hole: 0, gathered: lift + spread + 0.3 };
    let at = 0;
    sprites.forEach((s, i) => {
      s.go = lift + (count > 1 ? i / (count - 1) : 0) * spread; s.left = per * per;
      const [u, k] = this.onRoute(h, (s.x + 0.5) * T, (s.y + 0.5) * T, 0, route.length);
      s.k = k; at += u / count;
      if (s.over) { const items = this.itemSheet(s.biome, s.over), f = s.over === 'hazard' || s.over === 'relic' ? frameAt(items, s.over, 0) : sheets[items].frames[s.over]; s.item = [sheets[items].image, f]; }
    });
    // The rubble gathers on the tether beside where it lay. From here the haul has a rope of its own, and the drill
    // is free to go.
    h.S = at;
    this.hauls.push(h);
    cx = (cx / n + 0.5) * T; cy = (cy / n + 0.5) * T;
    this.effect('haul', 'impact', cx, cy);
    if (n >= 20) this.effect('bank', 'area', cx, cy);
    this.shake = Math.max(this.shake, Math.min(9, 2.5 + n * 0.12));
    this.hitstop = Math.min(0.16, 0.05 + n * 0.002);
    sfx.crack(n);
    this.flash = Math.min(0.5, 0.12 + n * 0.006);
    this.ring(cx, cy, '#fff6c8', 30 + Math.min(60, n * 1.5));
    for (const sp of sprites) if (count < 60 || cellHash(sp.x, sp.y, 9) < 0.4) this.chips(sp.x, sp.y, sp.tile[0], 2, null, 0.7);
    const title = relic >= 0 ? 'RELIC!' : parts ? 'WRECK PART! PAY +10%' : caches ? 'CACHE!' : n >= 200 ? 'COLOSSAL!' : n >= 80 ? 'HUGE HAUL!' : n >= 30 ? 'BIG HAUL!' : n >= 10 ? 'NICE CUT!' : 'HAUL';
    this.banner = { title, n, mult, over, grit, gems, t: 0, life: 2.2 + Math.min(1.2, n * 0.01) };
    if (parts || caches) sfx.relic();
    if (relic >= 0) { S.relics[relic] = 1; sfx.relic(); if (S.relics.every(Boolean) && !S.won) { S.won = true; this.wonAt = this.time; } }
  }
  // A point `dist` pixels along a haul's route, from the drill's end toward the core.
  along(h, dist) {
    const { route, cum } = h;
    if (dist <= 0 || route.length < 2) return route[0];
    if (dist >= h.length) return route[route.length - 1];
    let k = 1;
    while (cum[k] < dist) k++;
    const u = (dist - cum[k - 1]) / ((cum[k] - cum[k - 1]) || 1);
    return [route[k - 1][0] + (route[k][0] - route[k - 1][0]) * u, route[k - 1][1] + (route[k][1] - route[k - 1][1]) * u];
  }
  // The nearest place on a haul's route to a point, looking at segments `from` to `to`: [pixels along, segment].
  onRoute(h, px, py, from, to) {
    const { route, cum } = h;
    let best = Infinity, at = 0, seg = 1;
    for (let k = Math.max(1, from); k < Math.min(route.length, to); k++) {
      const ax = route[k - 1][0], ay = route[k - 1][1], bx = route[k][0] - ax, by = route[k][1] - ay, len = bx * bx + by * by;
      const u = len ? Math.max(0, Math.min(1, ((px - ax) * bx + (py - ay) * by) / len)) : 0, gap = (px - ax - bx * u) ** 2 + (py - ay - by * u) ** 2;
      if (gap < best) { best = gap; at = cum[k - 1] + (cum[k] - cum[k - 1]) * u; seg = k; }
    }
    return [at, seg];
  }
  // A lassoed piece crumbles into bits of ground, and they are real: they cannot overlap each other, the drill or the
  // rock, so they have to flow down the tunnels to the core, where a hatch opens and they drop in. `h.S` is how far
  // along the route the rope is drawing them to.
  updateHauls(dt) {
    const w = this.world, homeX = HX * T, homeY = HY * T;
    for (const h of this.hauls) {
      h.t += dt;
      const { size, bits } = h, per = T / size, rad = size * 0.45, wall = size * 0.4;
      // Blocks break up, each bit thrown a little way out.
      for (const s of h.sprites) {
        if (s.broke || h.t < s.go) continue;
        s.broke = true;
        for (let q = 0; q < per * per; q++) {
          const qx = q % per, qy = (q / per) | 0, a = Math.atan2(qy - (per - 1) / 2, qx - (per - 1) / 2) + (Math.random() - 0.5) * 2, v = 25 + Math.random() * 70;
          bits.push({ s, sx: qx * size, sy: qy * size, x: s.x * T + (qx + 0.5) * size, y: s.y * T + (qy + 0.5) * size, vx: Math.cos(a) * v, vy: Math.sin(a) * v, born: h.t, k: s.k, st: 0, ft: 0, stall: 0, ghost: false });
        }
        if (h.count < 80 || cellHash(s.x, s.y, 9) < 0.35) this.chips(s.x, s.y, s.tile[0], 3, null, 0.8);
        if (this.time - (this.lastSnap ?? 0) > 0.05) { this.lastSnap = this.time; sfx.dig((s.x + s.y) & 1); }
      }
      // Once the blocks have broken up, the rope draws the lot in. A long way out it is carried
      // fast as one bundle; the last stretch, and any short haul, is pushed through the tunnels bit by bit.
      const before = this.along(h, h.S), left = h.length - h.S;
      const want = h.t < h.gathered ? 0 : left > 600 ? Math.max(700, left * 2.5) : 320;
      h.v = want > h.v ? Math.min(want, h.v + Math.max(900, want * 3) * dt) : want;
      h.S = Math.min(h.length, h.S + h.v * dt);
      const express = h.v > 330, aim = this.along(h, h.S), seg = this.onRoute(h, aim[0], aim[1], 0, h.route.length)[1];
      const home = h.S >= h.length - 0.5;
      if (home && h.homeAt === undefined) h.homeAt = h.t;
      // The hatch in the core opens as the rubble comes up to it, and shuts behind the last bit.
      const open = left < 130 && h.t > h.gathered && h.paid < h.total ? 5 + size * 1.3 : 0;
      h.hole += Math.max(-60 * dt, Math.min(60 * dt, open - h.hole));
      const steps = express ? 1 : Math.max(1, Math.min(4, Math.ceil((h.v * 1.5 + 80) * dt / 3))), sdt = dt / steps;
      let arrived = 0;
      for (let step = 0; step < steps; step++) {
        for (const b of bits) {
          if (b.st) continue;
          const age = h.t - b.born;
          if (express && age > 0.18) {
            // Carried: the bundle moves as one, still jostling.
            b.x += (aim[0] - before[0]) / steps; b.y += (aim[1] - before[1]) / steps; b.k = seg; b.ghost = true; b.fast = true;
          } else if (b.fast) { b.fast = false; b.ghost = false; b.stall = 0; }
          if (age > 0.18) {
            // Drawn along the tether toward where the bundle is, never faster than it can follow.
            const [u, k] = this.onRoute(h, b.x, b.y, b.k - 1, b.k + 3);
            b.k = k;
            const to = home && h.hole > 3 ? [homeX, homeY] : this.along(h, u < h.S ? Math.min(h.S, u + 24) : Math.max(h.S, u - 24));
            const tx = to[0] - b.x, ty = to[1] - b.y, gap = Math.hypot(tx, ty) || 1, top = Math.min(h.v * 1.5 + 90, gap * 12), ease = Math.min(1, sdt * 12);
            b.vx += (tx / gap * top - b.vx) * ease; b.vy += (ty / gap * top - b.vy) * ease;
            // A bit that is caught behind rock is let through it rather than left behind.
            if (!b.ghost) { if (gap > 20 && Math.abs(b.vx) + Math.abs(b.vy) > 30 && b.moved < 0.25 * sdt * top) b.stall += sdt; else b.stall = Math.max(0, b.stall - sdt); if (b.stall > 0.5) b.ghost = true; }
          } else { b.vx *= 1 - 4 * sdt; b.vy *= 1 - 4 * sdt; }
          b.ox = b.x; b.oy = b.y;
          b.x += b.vx * sdt; b.y += b.vy * sdt;
        }
        // No two bits in the same place: this is what makes the heap flow instead of shrinking.
        for (let pass = 0; pass < 2; pass++) {
          const grid = new Map();
          for (const b of bits) {
            if (b.st) continue;
            const key = Math.floor(b.x / size) * 1048576 + Math.floor(b.y / size);
            const cell = grid.get(key);
            if (cell) cell.push(b); else grid.set(key, [b]);
          }
          for (const b of bits) {
            if (b.st) continue;
            const gx = Math.floor(b.x / size), gy = Math.floor(b.y / size);
            for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
              const cell = grid.get((gx + ox) * 1048576 + gy + oy);
              if (!cell) continue;
              for (const c of cell) {
                if (c === b) continue;
                const ux = c.x - b.x, uy = c.y - b.y, far2 = ux * ux + uy * uy;
                if (far2 >= 4 * rad * rad) continue;
                const far = Math.sqrt(far2) || 0.01, push = (2 * rad - far) * 0.25, nx = far2 ? ux / far : 1, ny = far2 ? uy / far : 0;
                b.x -= nx * push; b.y -= ny * push; c.x += nx * push; c.y += ny * push;
              }
            }
          }
        }
        for (const b of bits) {
          if (b.st) continue;
          // Rock is solid to it.
          if (!b.ghost) {
            for (let cy = Math.floor((b.y - wall) / T); cy <= Math.floor((b.y + wall) / T); cy++) for (let cx = Math.floor((b.x - wall) / T); cx <= Math.floor((b.x + wall) / T); cx++) {
              if (w.k(cy * N + cx) === K.EMPTY) continue;
              const nx = Math.max(cx * T, Math.min(b.x, cx * T + T)), ny = Math.max(cy * T, Math.min(b.y, cy * T + T)), vx = b.x - nx, vy = b.y - ny, gap = Math.hypot(vx, vy);
              if (gap >= wall) continue;
              if (gap > 0.01) { b.x = nx + vx / gap * wall; b.y = ny + vy / gap * wall; }
              else { b.x = b.ox; b.y = b.oy; }
            }
          }
          b.moved = Math.hypot(b.x - b.ox, b.y - b.oy);
          // Over the open hatch, it drops in.
          if (h.hole > 3 && Math.hypot(b.x - homeX, b.y - homeY) < h.hole - 1) { b.st = 1; arrived++; if (--b.s.left === 0 && b.s.gem) this.pending.gems[b.s.gem] = Math.max(0, this.pending.gems[b.s.gem] - b.s.gems); }
        }
      }
      // Nothing is ever left lying about: stragglers are drawn straight in.
      if (h.homeAt !== undefined && h.t > h.homeAt + 2.5 + h.total * 0.004) for (const b of bits) {
        if (b.st) continue;
        b.ghost = true;
        if (h.t > h.homeAt + 4.5 + h.total * 0.004) { b.st = 1; arrived++; b.s.left--; }
      }
      for (const b of bits) if (b.st === 1) { b.ft += dt; if (b.ft > 0.16) b.st = 2; }
      // Dust shed along the way.
      if (h.v > 50 && this.parts.length < 380 && bits.length && Math.random() < dt * 30) {
        const b = bits[(Math.random() * bits.length) | 0], colors = DEBRIS[b.s.tile[0]] ?? DEBRIS.crust;
        if (!b.st) this.parts.push({ x: b.x, y: b.y, vx: (Math.random() - 0.5) * 16, vy: (Math.random() - 0.5) * 16, t: 0, life: 0.2 + Math.random() * 0.3, color: colors[(Math.random() * colors.length) | 0], size: 1 });
      }
      if (arrived) {
        h.paid += arrived;
        const left = Math.round(h.grit * (1 - h.paid / h.total));
        this.pending.grit = Math.max(0, this.pending.grit - (h.left - left)); h.left = left;
        this.coreFlash = 0.12; this.counted = 0.12;
        if (this.time - (this.lastRing ?? 0) > 0.11) { this.lastRing = this.time; this.ring(HX * T, HY * T, '#ffe14a', 30); this.sparkle(HX * T, HY * T, 3, '#ffe14a'); }
        if (this.time - (this.lastTick ?? 0) > 0.045) { this.lastTick = this.time; sfx.tick(Math.floor(h.paid / Math.max(1, h.total / 14))); }
        if (h.paid >= h.total && h.doneAt === undefined) {
          h.doneAt = h.t;
          sfx.banked(h.n);
          this.effect('bank', 'area', HX * T, HY * T);
          this.save();
        }
      }
    }
    if (this.hauls.length && this.hauls.every(h => h.doneAt !== undefined && h.t > h.doneAt + 0.4 && h.hole < 0.5)) {
      this.hauls.length = 0; this.pending.grit = 0; this.pending.gems.fill(0);
    }
  }

  // ------------------------------------------------------------ hazards
  // A hazard wakes when the drill cuts beside it (or into it: `direct`). Lassoed asleep, it is worth gems.
  trigger(i, biome, direct) {
    const w = this.world, x = i % N, y = Math.floor(i / N);
    biome = base(biome);
    if (biome === B.EMBER) {
      w.setK(i, K.EMPTY); w.lava.set(i, 9); this.lavaVol.set(i, 5);
      sfx.hiss(); this.effect('steam', 'smoke-puff', (x + 0.5) * T, (y + 0.5) * T);
      if (direct) { this.jolt(0.5); this.shake = 5; }
    } else if (biome === B.MIRE) {
      w.setK(i, K.EMPTY);
      this.clouds.push({ x, y, t: 0, life: 6 });
      sfx.puff();
    } else if (biome === B.LODE) {
      if (direct) this.zap(x, y);
      else { const s = this.sparks.get(i); if (!s || s.cool <= 0) this.sparks.set(i, { fuse: 0.55, cool: 0 }); }
    }
  }
  zap(x, y) {
    const w = this.world, d = this.drill;
    this.effect('zap', 'impact', (x + 0.5) * T, (y + 0.5) * T);
    sfx.zap();
    if (Math.max(Math.abs(d.x - x - 0.5), Math.abs(d.y - y - 0.5)) <= 3.5) { this.jolt(0.7); this.shake = Math.max(this.shake, 5); this.twang = 0.3; }
    for (let v = -3; v <= 3; v++) for (let u = -3; u <= 3; u++) {
      const j = (y + v) * N + x + u;
      if ((u || v) && w.k(j) === K.HAZARD && base(w.b(j)) === B.LODE && !this.sparks.has(j)) this.sparks.set(j, { fuse: 0.3 + cellHash(u, v, 7) * 0.3, cool: 0 });
    }
  }
  // A hazard's bite: the drill is knocked senseless for a moment.
  jolt(time) { const d = this.drill; d.stun = Math.max(d.stun, time); this.hurt = time; d.vx = d.vy = 0; d.dig = -1; }
  updateHazards(dt) {
    const w = this.world, d = this.drill, here = this.di, dcx = Math.floor(d.x), dcy = Math.floor(d.y);
    let moved = false;
    // Where the tether lies, a few times a second: ground never closes over it.
    this.underTick = (this.underTick ?? 0) + dt;
    // Ground never grows back across the tether: where it lies is worked out afresh, at the moment it is asked.
    let fresh = false;
    const lies = i => {
      if (!fresh) {
        fresh = true; this.under.clear();
        for (let n = 1; n < this.band.length; n++) for (const c of cellsAlong(this.band[n - 1][0], this.band[n - 1][1], this.band[n][0], this.band[n][1])) this.under.add(c);
      }
      return this.under.has(i);
    };
    // Lava: a pocket pours a stream as long as its volume down the open ground, then sets.
    this.lavaTick = (this.lavaTick ?? 0) + dt;
    const flow = this.lavaTick >= 0.26;
    if (flow) this.lavaTick = 0;
    for (const [i, life] of [...w.lava]) {
      const x = i % N, y = Math.floor(i / N);
      if (flow) {
        const vol = this.lavaVol.get(i) ?? 1, start = (cellHash(x, y, (this.time * 10) | 0) * 4) | 0;
        for (let s = 0; s < 4; s++) {
          const j = (y + DY[(s + start) % 4]) * N + x + DX[(s + start) % 4];
          if (w.k(j) === K.HAZARD && base(w.b(j)) === B.EMBER) { this.trigger(j, B.EMBER, false); moved = true; continue; }
          if (vol > 1 && w.k(j) === K.EMPTY && !w.lava.has(j) && j !== here && w.s(j) && Math.hypot(x - C, y - C) > 3) {
            w.lava.set(j, 8); this.lavaVol.set(j, vol - 1); this.lavaVol.set(i, 1);
            break;
          }
        }
      }
      if (life - dt > 0) { w.lava.set(i, life - dt); continue; }
      w.lava.delete(i); this.lavaVol.delete(i);
      if (!lies(i) && Math.abs(dcx - x) + Math.abs(dcy - y) > 1) {
        w.setK(i, K.BASALT); moved = true;
        this.effect('steam', 'smoke-puff', (x + 0.5) * T, (y + 0.5) * T);
      }
    }
    // Spores: a burst pod hangs a cloud that stuns what flies into it, then moss closes the ground round it.
    for (const c of this.clouds) {
      c.t += dt;
      if (Math.max(Math.abs(dcx - c.x), Math.abs(dcy - c.y)) <= 1 && c.t < 0.2) this.jolt(0.4);
      if (c.t < c.life) continue;
      for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) {
        const j = (c.y + v) * N + c.x + u;
        if (w.k(j) === K.EMPTY && !lies(j) && !w.lava.has(j) && Math.max(Math.abs(dcx - c.x - u), Math.abs(dcy - c.y - v)) > 1) { w.setK(j, K.SOFT); w.setB(j, B.MIRE); moved = true; }
      }
    }
    this.clouds = this.clouds.filter(c => c.t < c.life);
    // Charged crystals: a short fuse, then an arc that jumps to every crystal near it.
    for (const [i, s] of this.sparks) {
      if (w.k(i) !== K.HAZARD) { this.sparks.delete(i); continue; }
      if (s.fuse > 0) { s.fuse -= dt; if (s.fuse <= 0) { s.cool = 3; this.zap(i % N, Math.floor(i / N)); } }
      else { s.cool -= dt; if (s.cool <= 0) this.sparks.delete(i); }
    }
    // Frost: a cut in the north closes over with ice unless the tether lies in it.
    this.frostTick = (this.frostTick ?? 0) + dt;
    if (this.frostTick > 0.4) {
      this.frostTick = 0;
      this.frostOpen = this.frostOpen.filter(i => {
        if (w.k(i) !== K.EMPTY) { w.dug.delete(i); return false; }
        if (this.time - w.dug.get(i) < 30) return true;
        const x = i % N, y = Math.floor(i / N);
        if (lies(i) || Math.max(Math.abs(dcx - x), Math.abs(dcy - y)) <= 1 || w.lava.has(i)) return true;
        w.setK(i, K.ICE); w.dug.delete(i); moved = true;
        if (this.onScreen(x, y)) { this.effect('freeze', 'impact', (x + 0.5) * T, (y + 0.5) * T); sfx.freeze(); }
        return false;
      });
    }
    if (moved) this.changed();
  }

  // ------------------------------------------------------------ blast, shop
  blast() {
    const w = this.world, d = this.drill;
    if (this.bombs <= 0) { if (this.val('bombs')) sfx.deny(); return; }
    const r = this.S.lv.bombs >= 3 ? 2 : 1, cx = Math.floor(d.x), cy = Math.floor(d.y), opened = [];
    this.bombs--;
    for (let v = -r; v <= r; v++) for (let u = -r; u <= r; u++) {
      const i = (cy + v) * N + cx + u, k = w.k(i);
      if (k === K.EMPTY || HARD[k] >= 99 || !this.within(cx + u + 0.5, cy + v + 0.5)) continue;
      w.setK(i, K.EMPTY); opened.push(i);
      if (base(w.b(i)) === B.FROST) { w.dug.set(i, this.time); this.frostOpen.push(i); }
    }
    this.effect('blast', 'fire-explosion', d.x * T, d.y * T);
    this.shake = 9; sfx.blast();
    w.see(cx, cy, r + 1);
    this.changed(opened);
  }
  cost(u) { const l = this.S.lv[u.id]; return l >= u.values.length - 1 ? null : { grit: u.grit[l], gems: u.gems[l] }; }
  canBuy(u) { const c = this.cost(u); return !!c && this.S.grit >= c.grit && this.S.gems[u.gem] >= c.gems; }
  buy(u) {
    if (!this.canBuy(u)) {
      // Says what is missing, and where gems are to be had.
      const c = this.cost(u);
      if (c) this.shopNote = { t: 2.5, color: c.gems > this.S.gems[u.gem] ? GEM_COLOR[u.gem] : '#ff7a5a', text: c.gems > this.S.gems[u.gem] ? `GEMS: ${GEM_WHERE[u.gem]}, PAST ${HOME_R}` : 'NOT ENOUGH GRIT' };
      sfx.deny(); return;
    }
    const c = this.cost(u);
    this.S.grit -= c.grit; this.S.gems[u.gem] -= c.gems; this.S.lv[u.id]++; this.S.stats.buys++;
    sfx.buy();
    this.ring(HX * T, HY * T, '#8ce060', 70); this.sparkle(HX * T, HY * T, 16, '#c8f4a0'); this.flash = 0.15;
    if (u.id === 'bombs') this.bombs = this.val('bombs');
    if (u.id === 'scanner') { this.world.see(Math.floor(this.drill.x), Math.floor(this.drill.y), this.val('scanner')); this.version++; }
    this.bought = { id: u.id, t: 0.5 };
    this.save();
  }

  // ------------------------------------------------------------ feel
  // Chips of the ground's own colours. `ang` is the way the drill was cutting (they fly back at it), null for all round.
  chips(cx, cy, sheet, count, ang, speed) {
    const colors = DEBRIS[sheet] ?? DEBRIS.crust;
    if (this.parts.length > 420) return;
    for (let n = 0; n < count; n++) {
      const a = Math.random() * 6.283, v = (20 + Math.random() * 70) * speed;
      let vx = Math.cos(a) * v, vy = Math.sin(a) * v;
      if (ang !== null) { vx -= Math.cos(ang) * 45 * speed; vy -= Math.sin(ang) * 45 * speed; }
      this.parts.push({ x: (cx + 0.2 + Math.random() * 0.6) * T, y: (cy + 0.2 + Math.random() * 0.6) * T, vx, vy, t: 0, life: 0.25 + Math.random() * 0.4,
        color: colors[(Math.random() * colors.length) | 0], size: Math.random() < 0.3 ? 2 : 1 });
    }
  }
  sparkle(x, y, count, color) {
    for (let n = 0; n < count; n++) {
      const a = Math.random() * 6.283, v = 30 + Math.random() * 90;
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 0.3 + Math.random() * 0.5, color, size: 1, star: Math.random() < 0.4 });
    }
  }
  ring(x, y, color, reach) { this.rings.push({ x, y, color, reach, t: 0 }); }
  // The drill fetches up against ground at the end of a throw.
  land() {
    const d = this.drill, x = Math.floor(d.x + Math.cos(d.ang) * 0.8), y = Math.floor(d.y + Math.sin(d.ang) * 0.8), k = this.world.at(x, y);
    this.shake = Math.max(this.shake, 2.2);
    if (k !== K.EMPTY) this.chips(d.x - 0.5 + Math.cos(d.ang) * 0.5, d.y - 0.5 + Math.sin(d.ang) * 0.5, this.rockSheet(k, this.world.b(y * N + x)), 6, d.ang, 0.8);
    this.effect('dust', 'dust', (d.x + Math.cos(d.ang) * 0.4) * T, (d.y + Math.sin(d.ang) * 0.4) * T);
  }
  // Everything that only sets the mood: chips in flight, rings, drifting motes, glints on ore, the colour of the
  // dark, and the sound of the place.
  ambient(dt) {
    const w = this.world, W = this.W, H = this.H;
    for (const p of this.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - 3.5 * dt; p.vy *= 1 - 3.5 * dt; }
    this.parts = this.parts.filter(p => p.t < p.life);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter(r => r.t < 0.5);
    this.flash = Math.max(0, this.flash - dt); this.counted = Math.max(0, this.counted - dt);
    const here = w.b(this.di), want = GLOOM[here], k = 1 - Math.exp(-dt * 1.5);
    for (let c = 0; c < 3; c++) this.gloom[c] += (want[c] - this.gloom[c]) * k;
    // Motes hang in open ground near the view; each belongs to the ground it was born over.
    while (this.motes.length < 34) {
      const x = this.cam.x + (Math.random() - 0.5) * (W + 60), y = this.cam.y + (Math.random() - 0.5) * (H + 60);
      this.motes.push({ x, y, seed: Math.random() * 100, t: 0, life: 4 + Math.random() * 5, biome: w.b(Math.floor(y / T) * N + Math.floor(x / T)) });
    }
    for (const m of this.motes) {
      m.t += dt;
      const b = base(m.biome), sway = Math.sin(this.time * 1.3 + m.seed);
      if (b === B.FROST) { m.y += 9 * dt; m.x += sway * 6 * dt; }
      else if (b === B.EMBER) { m.y -= 14 * dt; m.x += sway * 4 * dt; }
      else if (b === B.MIRE) { m.y += Math.cos(this.time * 0.9 + m.seed) * 4 * dt; m.x += sway * 5 * dt; }
      else { m.y -= 2 * dt; m.x += sway * 2 * dt; }
    }
    this.motes = this.motes.filter(m => m.t < m.life && Math.abs(m.x - this.cam.x) < W / 2 + 40 && Math.abs(m.y - this.cam.y) < H / 2 + 40);
    // A glint now and then on ore in view.
    for (let n = 0; n < 2; n++) {
      const x = Math.floor((this.cam.x + (Math.random() - 0.5) * W) / T), y = Math.floor((this.cam.y + (Math.random() - 0.5) * H) / T), kk = w.peek(x, y);
      if ((kk === K.ORE_A || kk === K.ORE_B || kk === K.RELIC || kk === K.CACHE || kk === K.WRECK) && Math.random() < (kk >= K.CACHE ? 1 : 0.5)) this.parts.push({ x: (x + 0.25 + Math.random() * 0.5) * T, y: (y + 0.25 + Math.random() * 0.5) * T, vx: 0, vy: 0, t: 0, life: 0.35, color: '#ffffff', size: 1, star: true });
    }
    setAmbience(base(here), here > 4);
    this.chime -= dt;
    if (this.chime <= 0) { this.chime = 2.5 + Math.random() * 4.5; sfx.chime(base(here)); }
  }

  // ------------------------------------------------------------ small things
  effect(sheet, animation, x, y) { this.effects.push({ sheet, animation, x, y, t: 0 }); }
  popup(cx, cy, label, color, icon) { this.popups = this.popups.filter(p => p.label !== label); this.popups.push({ x: (cx + 0.5) * T, y: cy * T, label, color, icon, t: 0 }); }
  onScreen(x, y) { const sx = x * T - this.cam.x + this.W / 2, sy = y * T - this.cam.y + this.H / 2; return sx > -T && sy > -T && sx < this.W && sy < this.H; }

  // ------------------------------------------------------------ update
  update(dt) {
    if (this.hitstop > 0) { this.hitstop -= dt; dt *= 0.15; }
    this.time += dt; this.S.stats.time += dt;
    const d = this.drill;
    this.twang = Math.max(0, this.twang - dt); this.coreFlash = Math.max(0, this.coreFlash - dt); this.hurt = Math.max(0, this.hurt - dt);
    this.edge = Math.max(0, this.edge - dt); d.stun = Math.max(0, d.stun - dt); d.squash = Math.max(0, d.squash - dt);
    this.shake = Math.max(0, this.shake - dt * 22);
    if (this.bought) { this.bought.t -= dt; if (this.bought.t <= 0) this.bought = null; }
    if (this.confirmReset > 0) this.confirmReset -= dt;
    if (!this.shop) {
      this.fly(dt);
      this.tend();
      this.reelTick = (this.reelTick ?? 0) + dt;
      if (this.reelTick > 0.1) { this.reelTick = 0; this.reelIfRound(); }
      this.updateHazards(dt);
      this.updateHauls(dt);
      // The station makes a trickle of grit of its own: however a world has been spent, the next reach is never out
      // of reach for good.
      this.trickle = (this.trickle ?? 0) + dt;
      if (this.trickle >= 2) { this.trickle -= 2; this.S.grit += Math.ceil(richness(this.val('tether') / 2)); }
      this.saveTick = (this.saveTick ?? 0) + dt;
      if (this.saveTick > 20) { this.saveTick = 0; this.save(); }
    }
    this.ambient(dt);
    for (const e of this.effects) e.t += dt * 1000;
    this.effects = this.effects.filter(e => e.t < duration(e.sheet, e.animation));
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter(p => p.t < 0.9);
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.life) this.banner = null; }
    // The camera eases after the drill, a little ahead of the way it is flying.
    const k = 1 - Math.exp(-dt * 8), lead = Math.min(3, Math.hypot(d.vx, d.vy) * 0.1), speed = Math.hypot(d.vx, d.vy) || 1;
    this.cam.x += ((d.x + d.vx / speed * lead) * T - this.cam.x) * k; this.cam.y += ((d.y + d.vy / speed * lead) * T - this.cam.y) * k;
    // Flying very fast, the view must not fall behind what is being flown through.
    const lag = Math.hypot(d.x * T - this.cam.x, d.y * T - this.cam.y), most = Math.min(this.W, this.H) * 0.3;
    if (lag > most) { this.cam.x += (d.x * T - this.cam.x) * (1 - most / lag); this.cam.y += (d.y * T - this.cam.y) * (1 - most / lag); }
  }

  // ------------------------------------------------------------ drawing
  rockSheet(k, b) {
    return k === K.BEDROCK ? 'bedrock' : k === K.SLATE ? 'slate' : k === K.VAULT || k === K.RELIC ? 'vault' : k === K.ICE ? 'ice' : k === K.BASALT ? 'basalt' : BIOME_NAMES[b];
  }
  rockRect(x, y, k, b) {
    const sheet = this.rockSheet(k, b), rects = sheets[sheet].tiles[this.world.mask(x, y)];
    return [sheet, rects[(cellHash(x, y, 3) * rects.length) | 0]];
  }
  overlay(k) { return k === K.DENSE ? 'dense' : k === K.ORE_A ? 'oreA' : k === K.ORE_B ? 'oreB' : k === K.HAZARD ? 'hazard' : k === K.RELIC ? 'relic' : k === K.CACHE ? 'cache' : k === K.WRECK ? 'part' : null; }
  itemSheet(b, over) { return over === 'cache' || over === 'part' ? 'finds' : b === B.CRUST ? 'lode-items' : `${BIOME_NAMES[base(b)]}-items`; }

  render() {
    const { ctx, W, H, world: w } = this, d = this.drill, now = this.time * 1000;
    const sx = this.shake ? (cellHash((now / 16) | 0, 1, 5) - 0.5) * this.shake : 0, sy = this.shake ? (cellHash((now / 16) | 0, 2, 5) - 0.5) * this.shake : 0;
    const ox = Math.round(this.cam.x - W / 2 + sx), oy = Math.round(this.cam.y - H / 2 + sy);
    ctx.fillStyle = '#07060b';
    ctx.fillRect(0, 0, W, H);
    // The ground is painted once into 8 x 8 cell pieces and redrawn only when it changes; a frame lays those
    // down, then draws what moves over them.
    const x0 = Math.floor(ox / T), y0 = Math.floor(oy / T), x1 = Math.floor((ox + W) / T), y1 = Math.floor((oy + H) / T);
    for (let cy = y0 >> 3; cy <= y1 >> 3; cy++) for (let cx = x0 >> 3; cx <= x1 >> 3; cx++) ctx.drawImage(this.chunk(cx, cy), cx * 128 - ox, cy * 128 - oy);
    for (const i of w.lava.keys()) {
      const x = i % N, y = Math.floor(i / N);
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1 && w.s(i)) draw(ctx, 'lava', frameAt('lava', `lava-${w.lavaMask(x, y)}`, now + cellHash(x, y, 2) * 300), x * T - ox, y * T - oy);
    }
    for (const i of this.frostOpen) {
      // Ice about to close over a cut: a rim of it creeps in first.
      const age = this.time - (w.dug.get(i) ?? this.time);
      if (age <= 22 || this.under.has(i)) continue;
      ctx.globalAlpha = Math.min(0.8, (age - 22) / 8);
      draw(ctx, 'ice', sheets.ice.tiles[0][0], (i % N) * T - ox, Math.floor(i / N) * T - oy);
      ctx.globalAlpha = 1;
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = w.peek(x, y);
      if (k !== K.HAZARD && k !== K.RELIC) continue;
      const i = y * N + x, b = w.b(i), m = w.mask(x, y), ux = x * T - ox - ((m & 4) ? 0 : 1), uy = y * T - oy - ((m & 16) ? 0 : 1);
      if (k === K.HAZARD) {
        const items = this.itemSheet(b), s = this.sparks.get(i);
        draw(ctx, items, s && s.fuse > 0 ? (((now / 60) | 0) % 2 ? 'hazard-b' : 'hazard') : frameAt(items, 'hazard', now + cellHash(x, y, 4) * 900), ux, uy);
      } else { const rs = `${BIOME_NAMES[DIR_BIOME[w.relicAt.indexOf(i)] ?? base(b)]}-items`; draw(ctx, rs, frameAt(rs, 'relic', now), ux, uy); }
    }
    // The block being cut cracks further the nearer it is to giving way, and what it would free glows.
    if (d.dig >= 0) {
      const stage = Math.min(4, Math.floor(d.digT / d.digDur * 5));
      if (stage > 0) draw(ctx, 'cracks', `crack-${stage}`, (d.dig % N) * T - ox, Math.floor(d.dig / N) * T - oy);
      for (const p of this.preview) {
        ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.16 + 0.12 * Math.sin(now / 110);
        for (const i of p.cells) ctx.fillRect((i % N) * T - ox, Math.floor(i / N) * T - oy, T, T);
        ctx.globalAlpha = 1;
      }
    }
    // The core, as the winch upgrades have built it, with the scanner's dish on its shoulder.
    const coreX = (C - 1) * T - ox, coreY = (C - 1) * T - oy;
    if (coreX > -80 && coreY > -80 && coreX < W + 40 && coreY < H + 40) {
      const hull = this.S.lv.winch;
      draw(ctx, 'core', this.coreFlash > 0 ? `core-flash-${hull}` : this.S.won ? `core-c-${hull}` : frameAt('core', `idle-${hull}`, now), coreX, coreY);
      draw(ctx, 'dish', frameAt('dish', `dish-${this.S.lv.scanner}`, now), coreX + 34, coreY - 6);
      [[39, 20], [20, 39], [1, 20], [20, 1]].forEach(([u, v], dir) => {
        if (this.S.relics[dir]) drawScaled(ctx, `${BIOME_NAMES[DIR_BIOME[dir]]}-items`, 'relic', coreX + u, coreY + v, 8, 8);
      });
    }
    this.drawTether(ox, oy);
    // Lassoed pieces: blocks tremble, crack and break into bits of ground, held in a loop of the tether, and the
    // hatch they are bound for.
    for (const h of this.hauls) {
      const flash = h.t < h.lift && ((h.t * 24) | 0) % 2 === 0, hx = Math.round(HX * T - ox), hy = Math.round(HY * T - oy), hull = [];
      if (h.hole > 0.5) {
        const R = h.hole;
        for (const [rad, color] of [[R + 1.5, '#f4ecd8'], [R + 0.5, '#3a3046'], [R - 0.5, '#07060a']]) {
          ctx.fillStyle = color;
          for (let y = -Math.ceil(rad); y <= Math.ceil(rad); y++) { const half = Math.sqrt(rad * rad - y * y); if (half > 0) ctx.fillRect(Math.round(hx - half), hy + y, Math.round(half * 2), 1); }
        }
      }
      for (const s of h.sprites) {
        const before = h.t - s.go;
        if (before >= 0) continue;
        const shake = Math.max(0, 1 + before / 0.3) * 1.4;
        const px = s.x * T - ox + Math.sin(h.t * 83 + s.x * 3.1) * shake, py = s.y * T - oy - Math.min(1, h.t / h.lift) * 3 + Math.cos(h.t * 71 + s.y * 2.3) * shake;
        hull.push([px, py], [px + T, py], [px, py + T], [px + T, py + T]);
        if (px < -T || py < -T || px > W || py > H) continue;
        draw(ctx, s.tile[0], s.tile[1], px, py);
        if (s.item) ctx.drawImage(s.item[0], s.item[1][0], s.item[1][1], T, T, Math.round(px), Math.round(py), T, T);
        if (before > -0.24) draw(ctx, 'cracks', `crack-${Math.min(4, 1 + (((before + 0.24) / 0.06) | 0))}`, px, py);
        if (flash) { ctx.globalAlpha = 0.6; ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(px) + 2, Math.round(py) + 2, 12, 12); ctx.globalAlpha = 1; }
      }
      const size = h.size, half = size / 2;
      for (const b of h.bits) {
        if (b.st === 2) continue;
        let x = b.x - ox, y = b.y - oy, sz = size;
        if (b.st === 1) {
          // Dropping down the hatch: away from the eye, into the dark.
          const u = Math.min(1, b.ft / 0.16);
          x += (hx - x) * u * 0.7; y += (hy - y) * u * 0.7; sz = Math.max(1, Math.round(size * (1 - u * 0.7))); ctx.globalAlpha = 1 - u * 0.8;
        } else hull.push([x - half, y - half], [x + half, y - half], [x - half, y + half], [x + half, y + half]);
        if (x > -size && y > -size && x < W + size && y < H + size) {
          const r = b.s.tile[1], px = Math.round(x - sz / 2), py = Math.round(y - sz / 2);
          ctx.drawImage(sheets[b.s.tile[0]].image, r[0] + b.sx, r[1] + b.sy, size, size, px, py, sz, sz);
          if (b.s.item) ctx.drawImage(b.s.item[0], b.s.item[1][0] + b.sx, b.s.item[1][1] + b.sy, size, size, px, py, sz, sz);
          // The break shows white for a moment.
          if (h.t - b.born < 0.07) { ctx.globalAlpha = 0.7; ctx.fillStyle = '#ffffff'; ctx.fillRect(px, py, sz, sz); }
        }
        ctx.globalAlpha = 1;
      }
      // The haul's own rope: a loop round the lot, and a line from it along the way home.
      if (hull.length && h.doneAt === undefined) {
        hull.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), ring = [];
        for (const pass of [0, 1]) {
          const start = ring.length;
          for (const p of pass ? hull.slice().reverse() : hull) { while (ring.length >= start + 2 && turn(ring[ring.length - 2], ring[ring.length - 1], p) <= 0) ring.pop(); ring.push(p); }
          ring.pop();
        }
        if (ring.length > 2) {
          let mx = 0, my = 0;
          for (const p of ring) { mx += p[0] / ring.length; my += p[1] / ring.length; }
          const own = TETHERS[this.S.lv.tether], dark = { a: '#16121c', b: '#16121c', dash: 1 };
          const line = [this.along(h, h.S)];
          for (let k = 1; k < h.route.length; k++) if (h.cum[k] > h.S) line.push(h.route[k]);
          for (const pass of [1, 0]) for (let i = 0; i + 1 < line.length; i++) {
            const a = line[i], b = line[i + 1];
            if (Math.max(a[0], b[0]) - ox < -2 || Math.max(a[1], b[1]) - oy < -2 || Math.min(a[0], b[0]) - ox > W + 2 || Math.min(a[1], b[1]) - oy > H + 2) continue;
            this.drawSpan(a[0] - ox, a[1] - oy, b[0] - ox, b[1] - oy, pass ? dark : own, pass);
          }
          // The loop lies like rope, not like a line drawn from bit to bit: it is the heap's outline as a distance
          // from its middle in each direction, eased round the loop and over time, and drawn as one smooth curve.
          // Slack at first, drawn tight as the blocks break up.
          const M = 28, slack = 2.5 + 3 * Math.max(0, 1 - h.t / h.gathered), want = new Float32Array(M), loop = h.loop ??= new Float32Array(M);
          const ease = h.loopAt === undefined ? 1 : Math.max(0, Math.min(1, (this.time - h.loopAt) * 16));
          h.loopAt = this.time;
          for (let i = 0; i < M; i++) {
            const ux = Math.cos(i / M * 6.2832), uy = Math.sin(i / M * 6.2832);
            let far = Infinity;
            for (let k = 0; k < ring.length; k++) {
              const a = ring[k], b = ring[(k + 1) % ring.length], ex = b[0] - a[0], ey = b[1] - a[1], den = ux * ey - uy * ex;
              if (Math.abs(den) < 1e-6) continue;
              const t = ((a[0] - mx) * ey - (a[1] - my) * ex) / den, v = ((a[0] - mx) * uy - (a[1] - my) * ux) / den;
              if (t > 0 && v >= -0.001 && v <= 1.001 && t < far) far = t;
            }
            want[i] = (far === Infinity ? 4 : far) + slack;
          }
          const round = [];
          for (let i = 0; i < M; i++) {
            loop[i] += (want[(i + M - 1) % M] * 0.25 + want[i] * 0.5 + want[(i + 1) % M] * 0.25 - loop[i]) * ease;
            round.push([mx + Math.cos(i / M * 6.2832) * loop[i], my + Math.sin(i / M * 6.2832) * loop[i]]);
          }
          if (Math.max(mx, my) > -80 && mx < W + 80 && my < H + 80) for (const pass of [1, 0]) this.rope(round, true, pass ? dark : own, pass);
        }
      }
    }
    // Spore clouds.
    for (const c of this.clouds) {
      ctx.globalAlpha = Math.min(1, (c.life - c.t) * 2) * 0.85;
      const f = frameAt('spore', 'area', (c.t * 1000) % (duration('spore', 'area') * 0.8));
      if (f) draw(ctx, 'spore', f, (c.x + 0.5) * T - ox - f[2] / 2, (c.y + 0.5) * T - oy - f[3] / 2);
      ctx.globalAlpha = 1;
    }
    // The drill: turned to its heading, biting into what it cuts, stretched by speed and squashed by a knock.
    const speed = Math.hypot(d.vx, d.vy), bite = d.dig >= 0 ? 2 + Math.min(1, d.digT / d.digDur) * 4 + Math.sin(d.digT * 70) : 0;
    const dx = d.x * T - ox + Math.cos(d.ang) * bite, dy = d.y * T - oy + Math.sin(d.ang) * bite;
    const along = d.squash > 0 ? 0.82 : 1 + Math.min(0.3, speed / 90), across = d.squash > 0 ? 1.18 : 1 - Math.min(0.14, speed / 200);
    if (speed > 14) {
      // Speed leaves a wake: fading copies of the drill back along the way it came.
      for (let g = 3; g >= 1; g--) { ctx.globalAlpha = 0.34 - g * 0.09; this.drawDrill(dx - d.vx / speed * g * 7, dy - d.vy / speed * g * 7, d.ang, this.S.lv.drill, this.S.lv.momentum, -1, along, across); }
      ctx.globalAlpha = 1;
    }
    this.drawDrill(dx, dy, d.ang, this.S.lv.drill, this.S.lv.momentum, d.dig >= 0 || speed > 1 ? now : -1, along, across);
    // Blasts left, racked across the drill's tail.
    for (let n = 0; n < this.bombs; n++) {
      const side = (n - (this.bombs - 1) / 2) * 3, bx = Math.round(dx - Math.cos(d.ang) * 9 - Math.sin(d.ang) * side - 1), by = Math.round(dy - Math.sin(d.ang) * 9 + Math.cos(d.ang) * side - 1);
      ctx.fillStyle = '#16121c'; ctx.fillRect(bx, by, 2, 2); ctx.fillStyle = '#ff5a3a'; ctx.fillRect(bx, by, 1, 1);
    }
    if (this.hurt > 0 && ((now / 50) | 0) % 2) { ctx.globalAlpha = 0.5; ctx.fillStyle = '#ff5a4a'; ctx.fillRect(Math.round(dx) - 5, Math.round(dy) - 5, 10, 10); ctx.globalAlpha = 1; }
    for (const e of this.effects) {
      const f = frameAt(e.sheet, e.animation, e.t);
      if (f) draw(ctx, e.sheet, f, e.x - ox - f[2] / 2, e.y - oy - f[3] / 2);
    }
    for (const p of this.parts) {
      const px = Math.round(p.x - ox), py = Math.round(p.y - oy), fade = 1 - p.t / p.life;
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      ctx.globalAlpha = Math.min(1, fade * 2); ctx.fillStyle = p.color;
      if (p.star) { const arm = fade > 0.5 ? 2 : 1; ctx.fillRect(px - arm, py, arm * 2 + 1, 1); ctx.fillRect(px, py - arm, 1, arm * 2 + 1); }
      else ctx.fillRect(px, py, p.size, p.size);
    }
    for (const m of this.motes) {
      if (w.peek(Math.floor(m.x / T), Math.floor(m.y / T)) !== K.EMPTY) continue;
      ctx.globalAlpha = Math.max(0, Math.min(1, m.t, m.life - m.t)) * (0.35 + 0.3 * Math.sin(this.time * 3 + m.seed)); ctx.fillStyle = MOTE[m.biome];
      ctx.fillRect(Math.round(m.x - ox), Math.round(m.y - oy), 1, 1);
    }
    ctx.globalAlpha = 1;
    this.light(ox, oy);
    // Ground lying loose: cut off from the world, waiting for the tether to be drawn round it. It shows through the
    // dark, with a dotted edge that crawls round it.
    if (this.loose.length) {
      const set = this.looseSet, crawl = (now / 90) | 0;
      for (const i of this.loose) {
        const px = (i % N) * T - ox, py = Math.floor(i / N) * T - oy;
        if (px < -T || py < -T || px > W || py > H) continue;
        ctx.fillStyle = '#84dcff'; ctx.globalAlpha = 0.16 + 0.08 * Math.sin(now / 260);
        ctx.fillRect(px, py, T, T);
        ctx.globalAlpha = 0.95;
        for (let n = 0; n < T; n++) {
          if ((n + crawl) & 3) continue;
          if (!set.has(i - N)) ctx.fillRect(px + n, py, 1, 1);
          if (!set.has(i + N)) ctx.fillRect(px + T - 1 - n, py + T - 1, 1, 1);
          if (!set.has(i - 1)) ctx.fillRect(px, py + T - 1 - n, 1, 1);
          if (!set.has(i + 1)) ctx.fillRect(px + T - 1, py + n, 1, 1);
        }
      }
      ctx.globalAlpha = 1;
    }
    for (const r of this.rings) {
      // A ring of whole pixels spreading from a point.
      const u = r.t / 0.5, rad = r.reach * (1 - (1 - u) * (1 - u)), n = Math.max(12, (rad * 1.6) | 0);
      ctx.globalAlpha = (1 - u) * 0.9; ctx.fillStyle = r.color;
      for (let a = 0; a < n; a++) ctx.fillRect(Math.round(r.x - ox + Math.cos(a / n * 6.283) * rad), Math.round(r.y - oy + Math.sin(a / n * 6.283) * rad), 1, 1);
    }
    ctx.globalAlpha = 1;
    if (this.flash > 0) { ctx.globalAlpha = Math.min(0.45, this.flash * 1.4); ctx.fillStyle = '#fff6c8'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    for (const p of this.popups) {
      const py = p.y - oy - p.t * 18, px = p.x - ox;
      ctx.globalAlpha = Math.min(1, (0.9 - p.t) * 4);
      if (p.icon) draw(ctx, 'icons', p.icon, px - textWidth(p.label) / 2 - 11, py - 1);
      text(ctx, p.label, px, py, p.color, 0.5);
      ctx.globalAlpha = 1;
    }
    this.drawHud(ox, oy);
  }

  // The drill as its upgrades have made it (the bit's metal, whatever the ram has bolted on), drawn about its
  // middle at any heading, `along` and `across` times its size.
  drawDrill(x, y, ang, bit, ram, now, along = 1, across = 1) {
    const { ctx } = this, body = now >= 0 ? frameAt('drill', `right-${bit}`, now) : `right-a-${bit}`, s = sheets.drill;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(ang);
    ctx.scale(along, across);
    for (const frame of ram > 0 ? [`ram-right-${ram}`, body] : [body]) {
      const r = typeof frame === 'string' ? s.frames[frame] : frame;
      ctx.drawImage(s.image, r[0], r[1], r[2], r[3], -8, -8, 16, 16);
    }
    ctx.restore();
  }
  // A rope through `pts` (a closed loop if `closed`), as one clean line of pixels: a smooth curve through the points,
  // with no doubled corners.
  rope(pts, closed, style, off = 0) {
    const { ctx } = this, n = pts.length, px = [];
    const at = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = at(i - 1), b = at(i), c = at(i + 1), e = at(i + 2), steps = Math.max(2, Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]) * 2));
      for (let k = 0; k < steps; k++) {
        const t = k / steps, t2 = t * t, t3 = t2 * t;
        const X = Math.round(0.5 * (2 * b[0] + (c[0] - a[0]) * t + (2 * a[0] - 5 * b[0] + 4 * c[0] - e[0]) * t2 + (3 * b[0] - a[0] - 3 * c[0] + e[0]) * t3));
        const Y = Math.round(0.5 * (2 * b[1] + (c[1] - a[1]) * t + (2 * a[1] - 5 * b[1] + 4 * c[1] - e[1]) * t2 + (3 * b[1] - a[1] - 3 * c[1] + e[1]) * t3)) + off;
        const last = px.length - 2;
        if (last >= 0 && px[last] === X && px[last + 1] === Y) continue;
        // A pixel that only joins two that already touch at a corner is taken out.
        if (last >= 2 && Math.abs(X - px[last - 2]) === 1 && Math.abs(Y - px[last - 1]) === 1) { px[last] = X; px[last + 1] = Y; continue; }
        px.push(X, Y);
      }
    }
    ctx.fillStyle = style.a;
    for (let k = 0; k < px.length; k += 2) ctx.fillRect(px[k], px[k + 1], 1, 1);
    if (style.b !== style.a) { ctx.fillStyle = style.b; for (let k = 0; k < px.length; k += 2) if (((k >> 1) & 3) < style.dash * 4) ctx.fillRect(px[k], px[k + 1], 1, 1); }
  }
  // A span of tether in the style of a level of reach.
  drawSpan(x0, y0, x1, y1, style, off = 0) {
    const { ctx } = this;
    ctx.fillStyle = style.a; this.line(x0, y0 + off, x1, y1 + off);
    if (style.b !== style.a) { ctx.fillStyle = style.b; this.line(x0, y0 + off, x1, y1 + off, style.dash); }
  }
  chunk(cx, cy) {
    const key = cy * 4096 + cx;
    let c = this.chunks.get(key);
    if (!c) {
      // Far-off pieces are dropped, so a long journey does not hold every piece it passed.
      if (this.chunks.size > 180) for (const [k, old] of this.chunks) if (Math.abs(old.cx - cx) > 9 || Math.abs(old.cy - cy) > 12) this.chunks.delete(k);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 128;
      c = { canvas, ctx: canvas.getContext('2d', { alpha: false }), v: -1, cx, cy };
      this.chunks.set(key, c);
    }
    if (c.v !== this.version) { c.v = this.version; this.paint(c.ctx, cx * 8, cy * 8); }
    return c.canvas;
  }
  // Everything in a piece of ground that stays put: floors, rock, ore and armour.
  paint(ctx, x0, y0) {
    const w = this.world;
    ctx.globalAlpha = 1; ctx.fillStyle = '#07060b'; ctx.fillRect(0, 0, 128, 128);
    for (let y = y0; y < y0 + 8; y++) for (let x = x0; x < x0 + 8; x++) {
      const i = y * N + x, k = w.k(i), b = w.b(i), px = (x - x0) * T, py = (y - y0) * T;
      const floorSheet = `${BIOME_NAMES[b]}-floor`, floors = sheets[floorSheet].tiles[255], floor = floors[(cellHash(x, y, 1) * floors.length) | 0];
      if (!w.s(i)) {
        // Ground the scanner has not reached: only whose it is shows, dimly.
        if (k !== K.BEDROCK) { ctx.globalAlpha = 0.42; draw(ctx, floorSheet, floor, px, py); ctx.globalAlpha = 1; }
        continue;
      }
      const m = k === K.EMPTY ? 255 : w.mask(x, y);
      if (m !== 255 || k === K.EMPTY) draw(ctx, floorSheet, floor, px, py);
      if (k === K.EMPTY) continue;
      const sheet = this.rockSheet(k, b), rects = sheets[sheet].tiles[m];
      draw(ctx, sheet, rects[(cellHash(x, y, 3) * rects.length) | 0], px, py);
      const ux = px - ((m & 4) ? 0 : 1), uy = py - ((m & 16) ? 0 : 1);
      if (k === K.SLATE || k === K.VAULT) draw(ctx, 'tough', k === K.SLATE ? 'slate' : 'vault', ux, uy);
      const over = this.overlay(k);
      if (over && over !== 'hazard' && over !== 'relic') draw(ctx, this.itemSheet(b, over), over, ux, uy);
    }
  }

  // Light spreads from a cell through open ground, losing a little with every cell, and soaks a short way into
  // the rock it meets: so it takes the shape of the tunnels and lights the faces of their walls. It is worked out
  // in a window of cells round the view; `want` holds the brightest light to reach each cell this frame.
  shine(cx, cy, power, reach) {
    const L = this.lightMap, w = this.world, x = cx - L.x0, y = cy - L.y0;
    if (x < 1 || y < 1 || x >= L.cols - 1 || y >= L.rows - 1 || L.want[y * L.cols + x] >= power) return;
    const queue = L.queue, fade = power / reach;
    let head = 0, tail = 0;
    L.want[y * L.cols + x] = power; queue[tail++] = y * L.cols + x;
    while (head < tail) {
      const at = queue[head++], here = L.want[at], qx = at % L.cols, qy = (at / L.cols) | 0;
      if (qx < 1 || qy < 1 || qx >= L.cols - 1 || qy >= L.rows - 1) continue;
      const solid = L.solid[at];
      for (const [u, v, far] of LIGHT_STEP) {
        const j = at + v * L.cols + u;
        // Rock drinks light fast: a face is lit, the cell behind it barely.
        const next = here - fade * far * (solid || L.solid[j] ? 2.6 : 1);
        if (next > L.want[j] + 0.01 && tail < queue.length) { L.want[j] = next; queue[tail++] = j; }
      }
    }
  }
  // The dark, in the colour of the ground the drill is in, thinned wherever light reaches. It is worked out a cell
  // at a time and drawn smoothed, and each cell's light eases toward what it should be, so light trails the drill.
  light(ox, oy) {
    const { ctx, W, H } = this, d = this.drill, w = this.world, pad = 10;
    const vx0 = Math.floor(ox / T) - 1, vy0 = Math.floor(oy / T) - 1, vx1 = Math.floor((ox + W) / T) + 1, vy1 = Math.floor((oy + H) / T) + 1;
    const x0 = vx0 - pad, y0 = vy0 - pad, cols = vx1 - vx0 + 1 + pad * 2, rows = vy1 - vy0 + 1 + pad * 2;
    let L = this.lightMap;
    if (!L || L.cols !== cols || L.rows !== rows) L = this.lightMap = { x0, y0, cols, rows, want: new Float32Array(cols * rows), lit: new Float32Array(cols * rows), next: new Float32Array(cols * rows), solid: new Uint8Array(cols * rows), queue: new Int32Array(4096) };
    // The window follows the view: what was lit keeps its place in the world.
    if (L.x0 !== x0 || L.y0 !== y0) {
      const sx = x0 - L.x0, sy = y0 - L.y0;
      L.next.fill(0);
      for (let y = Math.max(0, -sy); y < Math.min(rows, rows - sy); y++) for (let x = Math.max(0, -sx); x < Math.min(cols, cols - sx); x++) L.next[y * cols + x] = L.lit[(y + sy) * cols + x + sx];
      [L.lit, L.next] = [L.next, L.lit]; L.x0 = x0; L.y0 = y0;
    }
    L.want.fill(0);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) L.solid[y * cols + x] = w.peek(x0 + x, y0 + y) === K.EMPTY ? 0 : 1;
    const flick = 1 + Math.sin(this.time * 9) * 0.03;
    this.shine(Math.floor(d.x), Math.floor(d.y), (d.dig >= 0 ? 1.08 : 1) * flick, 8.5);
    this.shine(C, C, 1 + this.coreFlash * 1.5 + Math.sin(this.time * 2) * 0.04, 8 + this.coreFlash * 10);
    let lavas = 0;
    for (const i of w.lava.keys()) { if (lavas++ > 40) break; this.shine(i % N, Math.floor(i / N), 0.85, 3.5); }
    for (const e of this.effects) if (e.sheet === 'blast' || e.sheet === 'zap' || e.sheet === 'haul' || e.sheet === 'bank') this.shine(Math.floor(e.x / T), Math.floor(e.y / T), 1, 6);
    for (const [i, sp] of this.sparks) if (sp.fuse > 0) this.shine(i % N, Math.floor(i / N), 0.9, 3);
    // One pixel of darkness per cell, drawn sixteen times the size and smoothed.
    const mcols = vx1 - vx0 + 1, mrows = vy1 - vy0 + 1;
    let map = this.dark;
    if (!map || map.width !== mcols || map.height !== mrows) { map = this.dark = document.createElement('canvas'); map.width = mcols; map.height = mrows; this.darkData = null; }
    const mc = map.getContext('2d'), data = this.darkData ??= mc.createImageData(mcols, mrows), px = data.data, [r, g, b] = this.gloom;
    for (let i = 0; i < L.lit.length; i++) L.lit[i] += (Math.min(1, L.want[i]) - L.lit[i]) * 0.3;
    for (let y = 0; y < mrows; y++) for (let x = 0; x < mcols; x++) {
      const l = L.lit[(y + pad) * cols + x + pad], o = (y * mcols + x) * 4;
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 168 * (1 - l * (2 - l));
    }
    mc.putImageData(data, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(map, vx0 * T - ox, vy0 * T - oy, mcols * T, mrows * T);
    ctx.imageSmoothingEnabled = false;
    // The core's slow turning rays.
    const cxp = HX * T - ox, cyp = HY * T - oy;
    if (cxp > -80 && cyp > -80 && cxp < W + 80 && cyp < H + 80) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#5cc4f0';
      for (let ray = 0; ray < 6; ray++) {
        const a = this.time * 0.25 + ray * 1.0472, len = 46 + Math.sin(this.time * 1.7 + ray * 2) * 10 + this.coreFlash * 80;
        ctx.globalAlpha = 0.07 + this.coreFlash * 0.5;
        this.line(cxp + Math.cos(a) * 24, cyp + Math.sin(a) * 24, cxp + Math.cos(a) * len, cyp + Math.sin(a) * len);
        this.line(cxp + Math.cos(a + 0.04) * 24, cyp + Math.sin(a + 0.04) * 24, cxp + Math.cos(a + 0.04) * len * 0.8, cyp + Math.sin(a + 0.04) * len * 0.8);
      }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
  }

  // A line of whole pixels, clipped to the view; `dash` (0-1) draws only that share of every 4 pixels.
  line(x0, y0, x1, y1, dash = 1) {
    const { ctx, W, H } = this;
    // A long line is cut down to the part that crosses the view before it is walked.
    const dxf = x1 - x0, dyf = y1 - y0;
    let t0 = 0, t1 = 1;
    for (const [p, q] of [[-dxf, x0 + 2], [dxf, W + 2 - x0], [-dyf, y0 + 2], [dyf, H + 2 - y0]]) {
      if (p === 0) { if (q < 0) return; continue; }
      const t = q / p;
      if (p < 0) { if (t > t1) return; if (t > t0) t0 = t; } else { if (t < t0) return; if (t < t1) t1 = t; }
    }
    const skip = Math.round(Math.max(Math.abs(dxf), Math.abs(dyf)) * t0);
    x1 = Math.round(x0 + dxf * t1); y1 = Math.round(y0 + dyf * t1); x0 = Math.round(x0 + dxf * t0); y0 = Math.round(y0 + dyf * t0);
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy, n = skip;
    for (let guard = 0; guard < 4000; guard++) {
      if (x0 >= 0 && y0 >= 0 && x0 < W && y0 < H && (dash >= 1 || (n & 3) < dash * 4)) ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
      n++;
    }
  }
  drawTether(ox, oy) {
    const { ctx, W, H } = this, d = this.drill, R = this.val('tether');
    // Where the tether's reach ends: a faint dotted ring, bright for a moment when the drill is turned back by it.
    const cx = HX * T - ox, cy = HY * T - oy, rad = (R + 0.5) * T, off = Math.hypot(W / 2 - cx, H / 2 - cy), half = Math.hypot(W, H) / 2;
    if (off + half > rad && off - half < rad) {
      ctx.fillStyle = this.edge > 0 ? '#ff7a5a' : '#f4ecd8'; ctx.globalAlpha = this.edge > 0 ? 0.9 : 0.3;
      // Only the arc that crosses the view is walked: the ring may be thousands of cells round.
      const mid = Math.atan2(H / 2 - cy, W / 2 - cx), sweep = Math.min(Math.PI, half / rad * 1.3), step = 7 / rad, phase = (this.time * 0.05) % step;
      for (let a = Math.ceil((mid - sweep) / step) * step + phase; a < mid + sweep; a += step) {
        const x = Math.round(cx + Math.cos(a) * rad), y = Math.round(cy + Math.sin(a) * rad);
        if (x >= 0 && y >= 0 && x < W && y < H) ctx.fillRect(x, y, 2, 1);
      }
      ctx.globalAlpha = 1;
    }
    const pts = this.band.map(([x, y]) => [x * T - ox, y * T - oy]);
    const wob = this.twang > 0 ? Math.sin(this.time * 90) * this.twang * 5 : 0;
    // Turned back at the edge it shows red; otherwise it is whatever the reach upgrades have made it.
    const own = TETHERS[this.S.lv.tether], style = this.twang > 0 ? { a: '#ff5a4a', b: '#ff5a4a', dash: 1, thick: own.thick } : own;
    for (const pass of own.thick ? [2, 1, 0] : [1, 0]) {
      const shadow = pass === (own.thick ? 2 : 1), use = shadow ? { a: '#16121c', b: '#16121c', dash: 1 } : style;
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        if (Math.max(x0, x1) < -2 || Math.max(y0, y1) < -2 || Math.min(x0, x1) > W + 2 || Math.min(y0, y1) > H + 2) continue;
        if (wob && Math.hypot(x1 - x0, y1 - y0) < 600) {
          // A plucked string: the middle of each span swings across it.
          const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, len = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / len * wob, ny = (x1 - x0) / len * wob;
          this.drawSpan(x0, y0, mx + nx, my + ny, use, pass); this.drawSpan(mx + nx, my + ny, x1, y1, use, pass);
        } else this.drawSpan(x0, y0, x1, y1, use, pass);
      }
    }
  }

  button(x, y, w, h, act) { this.buttons.push({ x, y, w, h, act }); }
  drawHud(ox, oy) {
    const { ctx, W, H, S } = this, now = this.time * 1000, d = this.drill;
    this.buttons.length = 0;
    // Banner of the last haul.
    if (this.banner) {
      const b = this.banner, pop = Math.min(1, b.t / 0.12), y = Math.round(H * 0.2 - (1 - pop) * 8);
      ctx.globalAlpha = Math.min(1, (b.life - b.t) * 3);
      const big = (b.n >= 10 ? 2 : 1) + (b.t < 0.07 ? 1 : 0);
      text(ctx, b.title, W / 2, y, b.n >= 30 ? '#ffe14a' : '#ffffff', 0.5, big);
      text(ctx, b.over < 1 ? `${b.n} x${b.mult.toFixed(1)} WINCH OVER LOAD` : `${b.n} x${b.mult.toFixed(1)}`, W / 2, y + 11 * big + 2, b.over < 1 ? '#ffb060' : '#bfe6ff', 0.5);
      let line = `+${compact(b.grit)}`, lw = textWidth(line) + 11;
      const gems = [1, 2, 3, 4].filter(g => b.gems[g] > 0);
      for (const g of gems) lw += textWidth(`+${compact(b.gems[g])}`) + 15;
      let lx = Math.round(W / 2 - lw / 2), ly = y + 11 * big + 14;
      draw(ctx, 'icons', 'grit', lx, ly - 1); text(ctx, line, lx + 11, ly, '#ffe14a'); lx += textWidth(line) + 15;
      for (const g of gems) { draw(ctx, 'icons', GEM_ICON[g], lx, ly - 1); text(ctx, `+${compact(b.gems[g])}`, lx + 11, ly, GEM_COLOR[g]); lx += textWidth(`+${compact(b.gems[g])}`) + 15; }
      ctx.globalAlpha = 1;
    }
    if (S.won && this.wonAt !== undefined && this.time - this.wonAt < 6) text(ctx, 'CORE RESTORED', W / 2, H * 0.36, '#ffe14a', 0.5, 2);
    // Top: what has been banked, and how much of its reach the tether has left.
    slice9(ctx, 'ui', 'panel', 2, 2, W - 4, 40);
    draw(ctx, 'icons', 'grit', 6, 5);
    text(ctx, compact(S.grit - this.pending.grit), 18, 6 - (this.counted > 0 ? 1 : 0), this.counted > 0 ? '#ffffff' : '#ffe14a');
    const gw = (W - 30) / 4;
    for (let g = 1; g < 5; g++) {
      const gx = Math.round(6 + (g - 1) * gw), have = S.gems[g] - this.pending.gems[g];
      ctx.globalAlpha = S.gems[g] > 0 ? 1 : 0.35;
      draw(ctx, 'icons', GEM_ICON[g], gx, 17);
      text(ctx, compact(have), gx + 12, 18, GEM_COLOR[g]);
      ctx.globalAlpha = 1;
    }
    const R = this.val('tether'), far = this.far, left = Math.max(0, R - far), label = compact(left), room = textWidth(label) + 10;
    this.bar(6, 29, W - 12 - room, 'tether', left / R, far / R > 0.93 ? '#ff7a5a' : '#f4ecd8', this.twang > 0);
    text(ctx, label, W - 6, 30, this.twang > 0 ? '#ff7a5a' : '#f4ecd8', 1);
    draw(ctx, 'ui', isMuted() ? 'mute' : 'sound', W - 21, 2);
    this.button(W - 24, 0, 24, 20, () => { setMuted(!isMuted()); sfx.tap(); });
    // Start over: two taps, so a slip of the thumb does not cost a world.
    const sure = this.confirmReset > 0, word = sure ? 'SURE?' : 'NEW', ww = textWidth(word) + 8;
    slice9(ctx, 'ui', sure ? 'button-off' : 'panel', W - ww - 2, 44, ww, 14);
    text(ctx, word, W - ww / 2 - 2, 46, sure ? '#ff7a5a' : '#9a94a8', 0.5);
    this.button(W - ww - 6, 42, ww + 6, 20, () => {
      if (this.confirmReset > 0) { this.confirmReset = 0; this.fresh((Math.random() * 1e9) | 0); this.save(); sfx.relic(); } else { this.confirmReset = 2.5; sfx.tap(); }
    });
    this.drawMap(W - 54, H - 58);
    // Bottom: the blast, and the shop when the drill is home.
    const by = H - 46;
    if (this.val('bombs') > 0) {
      slice9(ctx, 'ui', this.bombs > 0 ? 'panel' : 'button-off', 4, by, 34, 34);
      draw(ctx, 'upgrades', 'bomb', 12, by + 8);
      text(ctx, `${this.bombs}`, 31, by + 22, '#ffffff', 1);
      this.button(0, by - 6, 44, 46, () => this.blast());
    }
    const afford = UPGRADES.some(u => this.canBuy(u));
    if (this.atCore && !this.shop && d.mode === 'free') {
      const w = 84, x = Math.round(W / 2 - w / 2) - 14, up = afford && ((now / 300) | 0) % 2;
      slice9(ctx, 'ui', afford ? (up ? 'button-down' : 'button') : 'panel', x, by + 6, w, 24);
      text(ctx, 'UPGRADES', x + w / 2, by + 13, afford ? '#ffffff' : '#9a94a8', 0.5);
      this.button(x - 4, by, w + 8, 36, () => { this.shop = true; sfx.tap(); });
      if (afford && S.stats.buys === 0) draw(ctx, 'ui', 'hand', x + w / 2 - 4, by + 18 + Math.round(Math.sin(now / 150) * 3));
    }
    // The idea, shown and not told: a hand draws a loop, as the tether must be drawn round the loose piece.
    if (S.stats.hauls === 0 && !this.shop && this.input.id === null) {
      const u = (now % 2200) / 2200, turn = u * 6.2832 - 1.5708, cx = W / 2 - 20, hx = cx - 6 + Math.cos(turn) * 20, hy = H * 0.72 + Math.sin(turn) * 14;
      ctx.fillStyle = '#ffffff';
      for (let n = 1; n < 14; n++) { const a = turn - n * 0.22; ctx.globalAlpha = 1 - n / 14; ctx.fillRect(Math.round(cx + Math.cos(a) * 20), Math.round(H * 0.72 + Math.sin(a) * 14) - 2, 2, 2); }
      ctx.globalAlpha = 1;
      draw(ctx, 'ui', 'hand', hx, hy);
      if (S.stats.moves < 1.5) draw(ctx, 'logo', 'logo', W / 2 - 66, 62);
    }
    // Where the thumb is steering from, and which way.
    if (this.input.id !== null && !this.shop) {
      const { ax, ay, px, py } = this.input;
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(ax) - 1, Math.round(ay) - 1, 3, 3);
      this.line(ax, ay, px, py, 0.5);
      ctx.globalAlpha = 1;
    }
    this.shopRise = this.shop ? Math.min(1, this.shopRise + 0.12) : 0;
    if (this.shop) this.drawShop();
  }
  // The map: everything within the tether's reach, the core in the middle. Ground that has been seen shows as
  // rock or open; the rest only as whose ground it is, so there is always somewhere to choose to go.
  drawMap(x, y) {
    const { ctx } = this, w = this.world, d = this.drill, size = 46, R = this.val('tether'), per = Math.max(0.6, R * 2.25 / size);
    slice9(ctx, 'ui', 'panel', x - 3, y - 3, size + 6, size + 6);
    let map = this.mapCanvas;
    if (!map) { map = this.mapCanvas = document.createElement('canvas'); map.width = map.height = size; this.mapData = map.getContext('2d').createImageData(size, size); this.mapAt = -1; }
    if (this.time - this.mapAt > 0.5 || this.mapFor !== this.version + R) {
      this.mapAt = this.time; this.mapFor = this.version + R;
      const px = this.mapData.data;
      for (let v = 0; v < size; v++) for (let u = 0; u < size; u++) {
        const wx = Math.floor(HX + (u - size / 2 + 0.5) * per), wy = Math.floor(HY + (v - size / 2 + 0.5) * per), o = (v * size + u) * 4, k = w.peek(wx, wy);
        const [r, g, b] = MAPC[k < 0 ? w.biomeAt(wx, wy) : w.b(wy * N + wx)];
        const inside = Math.hypot(wx - C, wy - C) <= R, shade = (k < 0 ? 0.3 : k === K.EMPTY ? 0.12 : 0.85) * (inside ? 1 : 0.45);
        px[o] = r * shade + 8; px[o + 1] = g * shade + 7; px[o + 2] = b * shade + 10; px[o + 3] = 255;
      }
      map.getContext('2d').putImageData(this.mapData, 0, 0);
    }
    ctx.drawImage(map, x, y);
    const at = (wx, wy) => [x + size / 2 + (wx - HX) / per, y + size / 2 + (wy - HY) / per];
    // The tether, the reach, what each direction hides, the core and the drill.
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, size, size); ctx.clip();
    ctx.fillStyle = '#f4ecd8'; ctx.globalAlpha = 0.5;
    for (let a = 0; a < 6.283; a += 0.09) { const [mx, my] = at(HX + Math.cos(a) * R, HY + Math.sin(a) * R); ctx.fillRect(Math.round(mx), Math.round(my), 1, 1); }
    ctx.globalAlpha = 1; ctx.fillStyle = TETHERS[this.S.lv.tether].a;
    for (let n = 1; n < this.band.length; n++) {
      const [ax, ay] = at(...this.band[n - 1]), [bx, by] = at(...this.band[n]), steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
      for (let s = 0; s <= steps; s++) ctx.fillRect(Math.round(ax + (bx - ax) * s / steps), Math.round(ay + (by - ay) * s / steps), 1, 1);
    }
    for (let dir = 0; dir < 4; dir++) {
      if (this.S.relics[dir]) continue;
      const [mx, my] = at(HX + DX[dir] * RELIC_R, HY + DY[dir] * RELIC_R);
      ctx.fillStyle = GEM_COLOR[DIR_BIOME[dir]]; ctx.fillRect(Math.round(mx) - 1, Math.round(my) - 1, 3, 3);
    }
    if (((this.time * 2) | 0) % 2) this.world.wrecks.forEach(([wx, wy], n) => {
      if (this.S.wrecks?.[n] || Math.hypot(wx + 0.5 - HX, wy + 0.5 - HY) > R) return;
      const [mx, my] = at(wx + 0.5, wy + 0.5);
      ctx.fillStyle = '#ff9a3a'; ctx.fillRect(Math.round(mx) - 1, Math.round(my), 3, 1); ctx.fillRect(Math.round(mx), Math.round(my) - 1, 1, 3);
    });
    ctx.fillStyle = '#84dcff'; ctx.fillRect(x + size / 2 - 1, y + size / 2 - 1, 3, 3);
    const [dx, dy] = at(d.x, d.y);
    ctx.fillStyle = ((this.time * 3) | 0) % 2 ? '#ffffff' : '#ffd83a'; ctx.fillRect(Math.round(dx) - 1, Math.round(dy) - 1, 3, 3);
    ctx.restore();
  }
  bar(x, y, w, icon, fill, color, flash) {
    const { ctx } = this;
    draw(ctx, 'icons', icon, x, y);
    ctx.fillStyle = '#0c0a12'; ctx.fillRect(x + 11, y + 2, w - 11, 6);
    ctx.fillStyle = flash ? '#ffffff' : color; ctx.fillRect(x + 12, y + 3, Math.round((w - 13) * Math.max(0, Math.min(1, fill))), 4);
  }
  drawShop() {
    const { ctx, W, H, S } = this;
    ctx.globalAlpha = 0.6 * this.shopRise; ctx.fillStyle = '#07060b'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    const pw = Math.min(W - 8, 200), px = Math.round((W - pw) / 2), rh = Math.max(24, Math.min(32, Math.floor((H - 100) / UPGRADES.length)));
    const rise = 1 - this.shopRise, ph = 22 + rh * UPGRADES.length + 22, py = Math.max(44, Math.round((H - ph) / 2)) + Math.round(rise * rise * 60);
    slice9(ctx, 'ui', 'panel', px, py, pw, ph);
    this.button(px, py, pw, ph, () => {});
    text(ctx, 'UPGRADES', px + 8, py + 7, '#ffe14a');
    if (this.shopNote && this.shopNote.t > 0) { this.shopNote.t -= 1 / 60; text(ctx, this.shopNote.text, px + pw - 28, py + 7, this.shopNote.color, 1); }
    text(ctx, 'x', px + pw - 12, py + 6, '#ffffff');
    this.buttons.unshift({ x: px + pw - 24, y: py, w: 24, h: 22, act: () => { this.shop = false; sfx.tap(); } });
    UPGRADES.forEach((u, n) => {
      const y = py + 20 + n * rh, c = this.cost(u), can = this.canBuy(u), lit = this.bought?.id === u.id;
      slice9(ctx, 'ui', lit ? 'button-down' : !c ? 'button-max' : can ? 'button' : 'button-off', px + 4, y, pw - 8, rh - 1);
      // What it will look like once bought (or does now, at its last level).
      const l = S.lv[u.id], next = Math.min(l + 1, u.values.length - 1), vx = px + 7, vy = y + Math.floor((rh - 17) / 2);
      ctx.fillStyle = '#0c0a12'; ctx.fillRect(vx, vy, 16, 16);
      if (u.id === 'drill') this.drawDrill(vx + 8, vy + 8, 0, next, S.lv.momentum, this.time * 1000);
      else if (u.id === 'momentum') this.drawDrill(vx + 8, vy + 8, 0, S.lv.drill, next, -1);
      else if (u.id === 'tether') { for (const pass of TETHERS[next].thick ? [1, 0] : [0]) this.drawSpan(vx + 1, vy + 12 + pass, vx + 14, vy + 3 + pass, TETHERS[next]); }
      else if (u.id === 'winch') drawScaled(ctx, 'core', `core-a-${next}`, vx, vy, 16, 16);
      else if (u.id === 'scanner') draw(ctx, 'dish', `dish-${next}`, vx, vy);
      else { draw(ctx, 'upgrades', u.icon, vx + 2, vy + 2); text(ctx, `${u.values[next]}`, vx + 15, vy + 7, '#ffffff', 1); }
      // What it is, what it does, and what the next level changes.
      text(ctx, u.name, px + 25, y + 2, '#ffffff');
      text(ctx, c ? `${u.show(u.values[l])}>${u.show(u.values[l + 1])}` : `${u.show(u.values[l])} MAX`, px + 31 + textWidth(u.name), y + 2, c ? '#bfe6ff' : '#ffe14a');
      if (c) {
        // The cost sits on the second line when the first is full.
        let cx = px + pw - 18;
        const wide = textWidth(u.name) + textWidth(`${u.show(u.values[l])}>${u.show(u.values[l + 1])}`) + textWidth(compact(c.grit)) + (c.gems ? textWidth(compact(c.gems)) + 16 : 0) > pw - 80, cy = wide ? y + rh - 12 : y + 2;
        draw(ctx, 'icons', 'grit', cx, cy - 1);
        text(ctx, compact(c.grit), cx - 2, cy, S.grit >= c.grit ? '#ffe14a' : '#ff7a5a', 1);
        if (c.gems > 0) {
          cx -= textWidth(compact(c.grit)) + 16;
          draw(ctx, 'icons', GEM_ICON[u.gem], cx, cy - 1);
          text(ctx, compact(c.gems), cx - 2, cy, S.gems[u.gem] >= c.gems ? GEM_COLOR[u.gem] : '#ff7a5a', 1);
        }
        const short = c.gems > 0 && S.gems[u.gem] < c.gems;
        if (!wide) text(ctx, short ? `${GEM_WHERE[u.gem]}, PAST ${HOME_R}` : u.what, px + 25, y + rh - 12, short ? GEM_COLOR[u.gem] : '#c8c2d4');
      } else text(ctx, u.what, px + 25, y + rh - 12, '#e8c070');
      this.buttons.unshift({ x: px + 4, y, w: pw - 8, h: rh - 1, act: () => this.buy(u) });
    });
    const fy = py + ph - 19;
    text(ctx, this.confirmReset > 0 ? 'TAP AGAIN: NEW WORLD' : 'NEW WORLD', px + pw / 2, fy + 4, this.confirmReset > 0 ? '#ff7a5a' : '#6a6478', 0.5);
    this.buttons.unshift({ x: px + 4, y: fy, w: pw - 8, h: 17, act: () => {
      if (this.confirmReset > 0) { this.confirmReset = 0; this.fresh((Math.random() * 1e9) | 0); this.save(); sfx.relic(); } else { this.confirmReset = 2.5; sfx.tap(); }
    } });
  }
}
