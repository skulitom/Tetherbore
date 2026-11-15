// Tetherbore: the game. A drill on a tether cuts ground round a fixed core; a piece cut wholly free is reeled in.
// Logic moves by whole cells and at once; what is drawn catches up, so input never waits on an animation.
import { World, N, C, SIZE, K, B, HARD, GRIT, GEMS, DX, DY, BIOME_NAMES, base, cellHash, sight, onCore } from './world.js';
import { sheets, draw, drawScaled, frameAt, duration, slice9, text, textWidth } from './atlas.js';
import { sfx, unlock, isMuted, setMuted, setAmbience } from './audio.js';

const T = 16;                                   // pixels in a cell
const SAVE_KEY = 'tetherbore-save-v1';
const DIR_BIOME = [B.LODE, B.EMBER, B.MIRE, B.FROST];
const GEM_ICON = [null, 'frost', 'ember', 'mire', 'lode'];
const GEM_COLOR = [null, '#bfe6ff', '#ffb060', '#b8f06a', '#d8b8ff'];

// ---------------------------------------------------------------- upgrades
// `values` is what each level gives; `grit` and `gems` what the next level costs; `gem` whose gems it takes.
export const UPGRADES = [
  // The tether's reach: how far from the core the drill may go, by any road.
  { id: 'tether', icon: 'string', name: 'REACH', what: 'TETHER GOES FURTHER', values: [12, 15, 19, 23, 28, 33, 38, 44, 51, 58], gem: B.MIRE,
    grit: [10, 50, 150, 400, 900, 1800, 3000, 4500, 6500], gems: [0, 0, 4, 10, 22, 40, 70, 110, 160], show: v => `${v}` },
  { id: 'drill', icon: 'drill', name: 'BIT', what: 'CUTS FASTER', values: [1, 2, 3, 4, 5], gem: B.LODE, grit: [80, 500, 2000, 7000], gems: [0, 12, 45, 130], show: v => `MK${v}` },
  { id: 'winch', icon: 'winch', name: 'WINCH', what: 'BIG HAULS PAY MORE', values: [1, 1.3, 1.6, 2, 2.5, 3], gem: B.FROST,
    grit: [60, 300, 1100, 3500, 9000], gems: [0, 8, 25, 70, 170], show: v => `x${v}` },
  { id: 'scanner', icon: 'scanner', name: 'SCAN', what: 'SEES DEEPER IN ROCK', values: [2, 3, 4, 5, 6], gem: B.FROST, grit: [40, 250, 1000, 3500], gems: [0, 6, 30, 90], show: v => `${v}` },
  { id: 'momentum', icon: 'momentum', name: 'RAM', what: 'RUNS ON THROUGH SOFT', values: [0, 2, 4, 7, 12], gem: B.LODE, grit: [70, 400, 1500, 5000], gems: [0, 10, 35, 100], show: v => `${v}` },
  { id: 'bombs', icon: 'bomb', name: 'BLAST', what: 'BOMB: CLEARS ROCK', values: [0, 1, 2, 3, 4], gem: B.EMBER, grit: [90, 450, 1800, 6000], gems: [0, 12, 45, 120], show: v => `${v}` },
];
// What flies off each kind of ground when it is cut, and the dark each direction's ground lies in.
const DEBRIS = {
  crust: ['#6f5b49', '#806a55', '#a08a6c'], frost: ['#bcd8ee', '#ffffff', '#a2c4e2'], ember: ['#4a2f37', '#855350', '#ff8a2a'],
  mire: ['#574766', '#5c8a48', '#a5d86a'], lode: ['#b98a5a', '#f0d8a0', '#a57648'], slate: ['#6a7080', '#a4acbc', '#454a5a'],
  vault: ['#463a68', '#8a78c0', '#c8a8ff'], ice: ['#6fb0e0', '#d8f4ff', '#ffffff'], basalt: ['#4a3840', '#8a6468', '#8a3424'],
  rime: ['#62b8b4', '#d8fff4', '#84d4c8'], magma: ['#7a2418', '#e8743a', '#ffb040'], bloom: ['#8a3c8c', '#ffa0e0', '#7af0d0'],
  gilt: ['#6e5a34', '#ffe680', '#ffd040'], bedrock: ['#1e1e26', '#34343e'],
};
const GLOOM = [[10, 8, 7], [5, 12, 30], [22, 5, 6], [14, 6, 26], [22, 13, 4], [3, 18, 24], [30, 5, 3], [26, 4, 28], [24, 18, 2]];
const MOTE = ['#8a7a66', '#ffffff', '#ff9a3a', '#a5f0a0', '#ffe08a', '#d8fff4', '#ffc040', '#ffa0e0', '#ffe680'];
// How the tether looks at each level of reach: its two colours, how they alternate, and whether it is two pixels
// thick. Rope, then braid, then steel cable, then a line of light.
const TETHERS = [
  { a: '#e8dcc0', b: '#e8dcc0', dash: 1 }, { a: '#e8dcc0', b: '#b89a6c', dash: 0.5 }, { a: '#f0d890', b: '#b0803a', dash: 0.5 },
  { a: '#f0b060', b: '#c8442a', dash: 0.5 }, { a: '#d8e0ec', b: '#8a94a8', dash: 0.5 }, { a: '#eef4ff', b: '#6e7c98', dash: 0.25, thick: true },
  { a: '#ffe89a', b: '#c89020', dash: 0.25, thick: true }, { a: '#fff4c0', b: '#e8a020', dash: 0.5, thick: true },
  { a: '#a8fff0', b: '#30c8c0', dash: 0.5, thick: true }, { a: '#ffffff', b: '#5cc4f0', dash: 0.5, thick: true, glow: true },
];
const DIG_TIME = [0, 0, 0, 0.24, 0.45, 0.24, 0.45, 1.0, 1.8, 0.24, 0, 0.18, 0.45];
const SPEED = [1, 1.6, 2.4, 3.6, 5];

const compact = n => n < 1000 ? `${Math.floor(n)}` : n < 10000 ? `${(Math.floor(n / 100) / 10).toFixed(1)}K` : n < 1e6 ? `${Math.floor(n / 1000)}K` : `${(Math.floor(n / 1e5) / 10).toFixed(1)}M`;
const b64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s, into) => { const raw = atob(s); for (let i = 0; i < into.length && i < raw.length; i++) into[i] = raw.charCodeAt(i); };

// Every cell a straight line passes through, in order, each sharing a side with the one before.
function cellsAlong(x0, y0, x1, y1) {
  let cx = Math.floor(x0), cy = Math.floor(y0);
  const ex = Math.floor(x1), ey = Math.floor(y1), dx = x1 - x0, dy = y1 - y0, sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const tdx = dx ? Math.abs(1 / dx) : Infinity, tdy = dy ? Math.abs(1 / dy) : Infinity, cells = [cy * N + cx];
  let tx = dx ? (dx > 0 ? cx + 1 - x0 : x0 - cx) * tdx : Infinity, ty = dy ? (dy > 0 ? cy + 1 - y0 : y0 - cy) * tdy : Infinity;
  for (let guard = 0; guard < 400 && (cx !== ex || cy !== ey); guard++) {
    if (tx < ty) { tx += tdx; cx += sx; } else { ty += tdy; cy += sy; }
    cells.push(cy * N + cx);
  }
  return cells;
}

const LIGHT_STEP = [1, -1, N, -N, N + 1, N - 1, -N + 1, -N - 1];

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.world = new World();
    this.W = 180; this.H = 320;
    this.time = 0;
    this.input = { held: null, queued: null, id: null, ax: 0, ay: 0, px: 0, py: 0, keys: new Set() };
    this.hist = []; this.pos = new Int32Array(SIZE).fill(-1); this.loose = []; this.preview = []; this.pathPts = [];
    this.effects = []; this.popups = []; this.hauls = []; this.clouds = []; this.sparks = new Map(); this.lavaVol = new Map(); this.frostOpen = [];
    this.parts = []; this.rings = []; this.motes = []; this.gloom = [10, 8, 7]; this.flash = 0; this.counted = 0; this.chime = 3;
    this.shake = 0; this.twang = 0; this.coreFlash = 0; this.banner = null; this.shop = false; this.confirmReset = 0;
    this.buttons = [];
    this.chunks = new Map(); this.version = 0; this.lavaCells = new Set();
    this.load() || this.fresh((Math.random() * 1e9) | 0);
  }

  // ------------------------------------------------------------ state
  fresh(seed) {
    this.S = { seed, grit: 0, gems: [0, 0, 0, 0, 0], lv: Object.fromEntries(UPGRADES.map(u => [u.id, 0])), relics: [0, 0, 0, 0],
      stats: { hauls: 0, best: 0, recalls: 0, buys: 0, moves: 0, time: 0 }, won: false };
    this.world.generate(seed);
    this.begin();
  }
  begin() {
    const w = this.world;
    this.pending = { grit: 0, gems: [0, 0, 0, 0, 0] };
    this.parts.length = 0; this.rings.length = 0;
    this.effects.length = 0; this.popups.length = 0; this.hauls.length = 0; this.clouds.length = 0; this.sparks.clear(); this.lavaVol.clear(); this.frostOpen.length = 0;
    w.lava.fill(0); w.dugAt.fill(0); w.reached.fill(0); this.lavaCells.clear(); this.version++;
    w.reach(this.val('scanner'));
    this.drill = { x: C, y: C, fx: C, fy: C, dir: 0, mode: 'idle', t: 0, wait: 0, bore: 0, target: -1, dur: 0, stun: 0, run: 0, rest: 0, squash: 0 };
    this.bombs = this.val('bombs');
    this.cam = { x: this.drill.fx * T + 8, y: this.drill.fy * T + 8 };
    this.pos.fill(-1); this.hist = [C * N + C]; this.pos[C * N + C] = 0;
    this.changed();
    this.shop = false;
  }
  val(id) { const u = UPGRADES.find(u => u.id === id); return u.values[this.S.lv[id]]; }
  get di() { return this.drill.y * N + this.drill.x; }
  get atCore() { return onCore(this.drill.x, this.drill.y); }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, ...this.S, kind: b64(this.world.kind), seen: b64(this.world.seen) }));
    } catch { /* storage full or unavailable: the game goes on without saving */ }
  }
  load() {
    try {
      const data = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!data || data.v !== 1) return false;
      const { v, kind, seen, ...S } = data;
      this.S = S;
      for (const u of UPGRADES) this.S.lv[u.id] = Math.min(this.S.lv[u.id] ?? 0, u.values.length - 1);
      this.world.generate(S.seed);
      unb64(kind, this.world.kind); unb64(seen, this.world.seen);
      for (let i = 0; i < this.world.kind.length; i++) if (this.world.kind[i] === K.CORE) this.world.kind[i] = K.EMPTY;
      this.begin();
      return true;
    } catch { return false; }
  }

  // ------------------------------------------------------------ view
  resize(cssW, cssH, dpr) {
    const scale = Math.max(1, Math.round(Math.min(cssW, cssH * 0.62) * dpr / 190));
    this.W = Math.ceil(cssW * dpr / scale); this.H = Math.ceil(cssH * dpr / scale);
    this.canvas.width = this.W; this.canvas.height = this.H;
    this.pixel = cssW / this.W;            // CSS pixels per game pixel
    this.ctx.imageSmoothingEnabled = false;
  }

  // ------------------------------------------------------------ input
  pointerDown(id, x, y) {
    unlock();
    if (this.input.id !== null) return;
    const hit = this.buttons.find(b => x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h);
    if (hit) { hit.act(); return; }
    if (this.shop) { this.shop = false; sfx.tap(); return; }
    Object.assign(this.input, { id, ax: x, ay: y, px: x, py: y, held: null });
  }
  pointerMove(id, x, y) {
    const inp = this.input;
    if (inp.id !== id) return;
    inp.px = x; inp.py = y;
    const dx = x - inp.ax, dy = y - inp.ay, far = Math.hypot(dx, dy);
    if (far < 10) return;
    // Each short stroke is read on its own, from where the last one ended: a turn is a thumb's width of travel the
    // new way, wherever the thumb has got to. A stroke has to lean clearly one way to change the heading.
    const ax = Math.abs(dx), ay = Math.abs(dy), dir = ax > ay ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
    inp.vec = [dx / far, dy / far];
    if (dir !== inp.held && (inp.held === null || Math.max(ax, ay) > Math.min(ax, ay) * 1.35)) { inp.held = dir; inp.queued = dir; }
    inp.ax = x; inp.ay = y;
  }
  pointerUp(id) { if (this.input.id === id) { this.input.id = null; this.input.held = null; } }
  key(code, down) {
    const dir = { ArrowRight: 0, KeyD: 0, ArrowDown: 1, KeyS: 1, ArrowLeft: 2, KeyA: 2, ArrowUp: 3, KeyW: 3 }[code];
    const inp = this.input;
    if (dir !== undefined) {
      if (down) { unlock(); if (this.shop) this.shop = false; if (!inp.keys.has(code)) { inp.held = dir; inp.queued = dir; inp.vec = null; } inp.keys.add(code); }
      else { inp.keys.delete(code); if (inp.held === dir && inp.id === null) inp.held = null; }
      return true;
    }
    if (!down) return false;
    unlock();
    if (code === 'KeyB' || code === 'KeyE') { this.blast(); return true; }
    if (code === 'KeyU' || code === 'Enter') { if (this.atCore) this.shop = !this.shop; return true; }
    if (code === 'Escape') { this.shop = false; return true; }
    return false;
  }

  // ------------------------------------------------------------ the tether
  // The tether lies where the drill has been. `hist` is every cell from the middle of the core out to the drill, and
  // `pos` where each cell is in it. Going back the way it came winds the tether in; touching its own tether closes a
  // loop, and whatever ground that loop surrounds is lassoed and reeled in.
  step(i) {
    const h = this.hist, pos = this.pos, x = i % N, y = (i / N) | 0, centre = C * N + C;
    if (onCore(x, y)) {
      // Home. The whole trip, closed by the core itself, is a loop.
      const loop = h.length > 2 ? h.slice() : null;
      for (const c of h) pos[c] = -1;
      // From the middle to this cell of the platform, by neighbouring cells.
      this.hist = i === centre ? [centre] : x !== C && y !== C ? [centre, C * N + x, i] : [centre, i];
      this.hist.forEach((c, n) => { pos[c] = n; });
      if (loop) this.lasso(loop, true);
      return;
    }
    if (h.length >= 2 && h[h.length - 2] === i) { pos[h.pop()] = -1; return; }
    // The earliest place the tether already lies in this cell or right beside it (the cell just left does not count).
    let j = pos[i];
    for (const n of [i + 1, i - 1, i + N, i - N]) if (pos[n] >= 0 && pos[n] < h.length - 1 && (j < 0 || pos[n] < j)) j = pos[n];
    if (j < 0) { pos[i] = h.length; h.push(i); return; }
    const loop = h.slice(j);
    if (h[j] !== i) loop.push(i);
    for (let n = j + 1; n < h.length; n++) pos[h[n]] = -1;
    h.length = j + 1;
    if (h[j] !== i) { pos[i] = h.length; h.push(i); }
    this.lasso(loop, false);
  }
  // Reel in every piece of ground inside a closed loop of tether.
  lasso(loop, home) {
    const w = this.world, wall = w.mark, queue = w.queue;
    if (loop.length < 4) return;
    wall.fill(0);
    for (const c of loop) wall[c] = 1;
    if (home) for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) wall[(C + v) * N + C + u] = 1;
    // Everything the outside can reach without crossing the loop is outside it.
    let tail = 0;
    wall[0] = 2; queue[tail++] = 0;
    for (let head = 0; head < tail; head++) {
      const c = queue[head], x = c % N;
      if (x + 1 < N && !wall[c + 1]) { wall[c + 1] = 2; queue[tail++] = c + 1; }
      if (c + N < SIZE && !wall[c + N]) { wall[c + N] = 2; queue[tail++] = c + N; }
      if (x > 0 && !wall[c - 1]) { wall[c - 1] = 2; queue[tail++] = c - 1; }
      if (c >= N && !wall[c - N]) { wall[c - N] = 2; queue[tail++] = c - N; }
    }
    const cells = [];
    for (let c = 0; c < SIZE; c++) if (!wall[c] && w.kind[c] !== K.EMPTY && w.kind[c] !== K.BEDROCK) cells.push(c);
    if (!cells.length) return;
    this.haul(cells);
    this.changed();
  }
  // After any change to the ground or the drill's cell: pull the tether tight, and see what a cut would free.
  retether() {
    const w = this.world, d = this.drill;
    this.pathPts = this.pull();
    // The tether lies where the tight string lies, so what closes a loop is the string that is drawn.
    const pts = this.pathPts, cells = [], seen = new Set();
    let ok = true;
    for (let n = pts.length - 1; n > 0 && ok; n--) {
      const run = cellsAlong(pts[n][0], pts[n][1], pts[n - 1][0], pts[n - 1][1]);
      for (let k = cells.length ? 1 : 0; k < run.length; k++) {
        if (seen.has(run[k]) || w.kind[run[k]] !== K.EMPTY) { ok = false; break; }
        seen.add(run[k]); cells.push(run[k]);
      }
    }
    if (ok && cells.length && cells[cells.length - 1] === this.di && cells[0] === C * N + C) {
      for (const c of this.hist) this.pos[c] = -1;
      this.hist = cells;
      cells.forEach((c, n) => { this.pos[c] = n; });
    }
    w.onPath.fill(0);
    for (const c of this.hist) w.onPath[c] = 1;
    this.far = Math.hypot(d.x - C, d.y - C);
    this.foresee();
  }
  // The tether as a string pulled tight along the way the drill went, worked out the way a string does it: every
  // bend that nothing holds is let go, and every bend that is held is drawn toward the straight line between its
  // neighbours until ground stops it. What is left lies against corners. From the drill to the core, in cells.
  pull() {
    const w = this.world, kind = w.kind, P = [];
    for (let n = this.hist.length - 1; n >= 0; n--) { const i = this.hist[n]; P.push([i % N + 0.5, ((i / N) | 0) + 0.5]); }
    // A point of string keeps a hair clear of ground on every side.
    const m = 0.14, open = (x, y) => kind[Math.floor(y - m) * N + Math.floor(x - m)] === K.EMPTY && kind[Math.floor(y - m) * N + Math.floor(x + m)] === K.EMPTY
      && kind[Math.floor(y + m) * N + Math.floor(x - m)] === K.EMPTY && kind[Math.floor(y + m) * N + Math.floor(x + m)] === K.EMPTY;
    for (let round = 0; round < 90; round++) {
      for (let n = P.length - 2; n >= 1; n--) if (this.slack(P[n - 1], P[n], P[n + 1])) P.splice(n, 1);
      let moved = 0;
      for (let n = 1; n < P.length - 1; n++) {
        const a = P[n - 1], b = P[n], c = P[n + 1];
        let dx = (a[0] + c[0]) / 2 - b[0], dy = (a[1] + c[1]) / 2 - b[1];
        const far = Math.hypot(dx, dy);
        if (far < 0.004) continue;
        const step = Math.min(far, 0.3);
        dx *= step / far; dy *= step / far;
        // Straight toward the line if it can; otherwise along whatever it is lying against.
        for (const [mx, my] of [[dx, dy], [dx, 0], [0, dy]]) {
          if (Math.abs(mx) + Math.abs(my) < 0.004) continue;
          const qx = b[0] + mx, qy = b[1] + my;
          if (!open(qx, qy) || !sight(w, b[0], b[1], qx, qy) || !sight(w, a[0], a[1], qx, qy) || !sight(w, qx, qy, c[0], c[1])) continue;
          P[n] = [qx, qy]; moved = Math.max(moved, Math.abs(mx) + Math.abs(my));
          break;
        }
      }
      if (moved < 0.01) break;
    }
    // A held bend ends up beside the corner that holds it; set it on the corner itself, a hair clear.
    for (let n = 1; n < P.length - 1; n++) {
      const a = P[n - 1], b = P[n], c = P[n + 1];
      let best = Math.hypot(a[0] - b[0], a[1] - b[1]) + Math.hypot(c[0] - b[0], c[1] - b[1]) - 0.01, at = null;
      for (let y = Math.floor(b[1]) - 1; y <= Math.floor(b[1]) + 1; y++) for (let x = Math.floor(b[0]) - 1; x <= Math.floor(b[0]) + 1; x++) {
        if (kind[y * N + x] === K.EMPTY) continue;
        for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const qx = x + u + (u ? m : -m), qy = y + v + (v ? m : -m), len = Math.hypot(a[0] - qx, a[1] - qy) + Math.hypot(c[0] - qx, c[1] - qy);
          if (len < best && kind[Math.floor(qy) * N + Math.floor(qx)] === K.EMPTY && sight(w, b[0], b[1], qx, qy) && sight(w, a[0], a[1], qx, qy) && sight(w, qx, qy, c[0], c[1])) { best = len; at = [qx, qy]; }
        }
      }
      if (at) P[n] = at;
    }
    return P;
  }
  // Is the bend at `b` slack: can the string run straight from `a` to `c` without crossing or passing over ground?
  slack(a, b, c) {
    const w = this.world;
    if (!sight(w, a[0], a[1], c[0], c[1])) return false;
    const x0 = Math.floor(Math.min(a[0], b[0], c[0])), x1 = Math.floor(Math.max(a[0], b[0], c[0]));
    const y0 = Math.floor(Math.min(a[1], b[1], c[1])), y1 = Math.floor(Math.max(a[1], b[1], c[1]));
    const turn = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (!turn) return true;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (w.kind[y * N + x] === K.EMPTY) continue;
      // Ground whose middle lies inside the corner being cut off is ground the string is wrapped round.
      const px = x + 0.5, py = y + 0.5;
      const s1 = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]), s2 = (c[0] - b[0]) * (py - b[1]) - (c[1] - b[1]) * (px - b[0]), s3 = (a[0] - c[0]) * (py - c[1]) - (a[1] - c[1]) * (px - c[0]);
      if ((s1 > 0 && s2 > 0 && s3 > 0) || (s1 < 0 && s2 < 0 && s3 < 0)) return false;
    }
    return true;
  }
  // The last cut glows: for each side of the drill, the ground that would come free if that cell were cut.
  foresee() {
    const w = this.world, d = this.drill;
    this.preview = [];
    for (let dir = 0; dir < 4; dir++) {
      const x = d.x + DX[dir], y = d.y + DY[dir], i = y * N + x, k = w.kind[i];
      if (k === K.EMPTY || HARD[k] >= 99 || !this.within(x, y)) continue;
      const found = w.wouldFree(i);
      if (found.length) this.preview.push({ dir, i, cells: found.flat() });
    }
  }
  // After the ground changed: what is open, what lies loose waiting to be lassoed, how the tether is drawn.
  changed() {
    this.version++;
    const w = this.world;
    w.reach(this.val('scanner'));
    this.pieces = w.islands();
    this.loose = this.pieces.flat();
    this.retether();
    this.reelIfRound();
  }
  // A loose piece is as good as lassoed once the tether has gone far enough round it that the straight way home
  // would close the loop: it is reeled in there and then, with no trip back to draw the loop shut.
  reelIfRound() {
    const pts = this.pathPts;
    if (!this.pieces?.length || pts.length < 3) return;
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
    for (const cells of this.pieces) {
      if (!cells.every(i => winds(i % N + 0.5, ((i / N) | 0) + 0.5) !== 0)) continue;
      this.haul(cells);
      this.changed();
      return;
    }
  }
  // The tether lets the drill go this far from the core and no further, whatever road it takes.
  within(x, y) { return Math.hypot(x - C, y - C) <= this.val('tether') + 0.3; }

  // ------------------------------------------------------------ moving and cutting
  // The drill goes exactly where it is told: one cell at a time, except that straight out from the core it runs on
  // to the next ground. From the core itself it can be thrown at any angle.
  attempt(dir, fromInput) {
    const w = this.world, d = this.drill;
    if (d.stun > 0) return;
    d.dir = dir;
    if (fromInput) { d.bore = this.val('momentum'); this.S.stats.moves++; }
    // Only from the very middle of the core is the drill thrown; anywhere else on it, it steps like anywhere else,
    // so coming home never sends it out the other side.
    const centred = d.x === C && d.y === C;
    if (fromInput && centred && this.input.vec && this.fling(this.input.vec)) return;
    const nx = d.x + DX[dir], ny = d.y + DY[dir], ni = ny * N + nx, k = w.at(nx, ny);
    if (!this.within(nx, ny)) { this.refuse(nx, ny); return; }
    if (k === K.EMPTY) {
      if (w.lava[ni] > 0) { this.bump(); sfx.hiss(); return; }
      const px = d.x - C, py = d.y - C, along = px * DX[dir] + py * DY[dir], across = Math.abs(px * DY[dir] - py * DX[dir]);
      const away = centred || (!this.atCore && along > 0 && along >= across);
      const cells = [];
      let x = d.x, y = d.y;
      for (;;) {
        const cx = x + DX[dir], cy = y + DY[dir], i = cy * N + cx;
        if (w.kind[i] !== K.EMPTY || w.lava[i] > 0 || !this.within(cx, cy)) break;
        x = cx; y = cy; cells.push(i);
        if (!away || (x === C && y === C)) break;      // the middle of the core is a place to stop
      }
      if (!cells.length) { this.bump(); return; }
      this.go(cells, away ? 24 : 18, away || w.at(x + DX[dir], y + DY[dir]) !== K.EMPTY ? 0.13 : 0);
      if (away) sfx.slide(cells.length);
      return;
    }
    if (HARD[k] >= 99) {
      this.bump(); sfx.clink();
      this.effect('sparks', 'sparks', (d.x + 0.5 + DX[dir] * 0.5) * T, (d.y + 0.5 + DY[dir] * 0.5) * T);
      d.bore = 0;
      return;
    }
    d.mode = 'dig'; d.target = ni; d.t = 0;
    d.dur = DIG_TIME[k] / SPEED[this.S.lv.drill] * (fromInput ? 1 : 0.55);
  }
  // Move through a run of open cells, laying tether in each.
  go(cells, speed, wait) {
    const d = this.drill;
    for (const i of cells) { d.x = i % N; d.y = (i / N) | 0; this.step(i); }
    d.mode = 'slide'; d.speed = speed; d.wait = wait;
    if (speed === 18) {
      sfx.step(d.run);
      this.chips(d.x, d.y, BIOME_NAMES[this.world.biome[this.di]], 1, d.dir, 0.3);
    }
    this.retether(); this.reelIfRound(); this.arrive();
    // Home: the drill settles in the middle and waits for a fresh stroke before it sets out again.
    if (d.x === C && d.y === C) { this.input.held = null; this.input.queued = null; this.input.keys.clear(); d.wait = 0.2; }
  }
  // From the core the drill can be thrown at any angle: it flies straight along the drag until ground, lava or
  // the end of its reach stops it. Returns false when it cannot leave its cell that way.
  fling([vx, vy]) {
    const w = this.world, d = this.drill, cells = [];
    let cx = d.x, cy = d.y;
    const sx = vx > 0 ? 1 : -1, sy = vy > 0 ? 1 : -1, tdx = vx ? Math.abs(1 / vx) : Infinity, tdy = vy ? Math.abs(1 / vy) : Infinity;
    let tx = tdx / 2, ty = tdy / 2;
    for (let guard = 0; guard < 300; guard++) {
      if (tx < ty) { tx += tdx; cx += sx; } else { ty += tdy; cy += sy; }
      const i = cy * N + cx;
      if (w.kind[i] !== K.EMPTY || w.lava[i] > 0 || !this.within(cx, cy)) break;
      cells.push(i);
    }
    if (!cells.length) return false;
    d.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 0 : 2) : (vy > 0 ? 1 : 3);
    this.go(cells, 24, 0.13);
    sfx.slide(cells.length);
    return true;
  }
  bump() { const d = this.drill; d.mode = 'bump'; d.t = 0; d.squash = 0.14; d.run = 0; }
  // The end of the tether's reach: say so on the cell that was refused, and show where the edge is.
  refuse(x, y) { this.bump(); this.twang = 0.45; this.edge = 1.2; sfx.twang(); this.drill.bore = 0; this.popup(x, y, 'REACH', '#ff7a5a', 'tether'); }
  arrive() {
    if (this.atCore && this.bombs < this.val('bombs')) {
      this.bombs = this.val('bombs');
      sfx.dock(); this.coreFlash = 0.25; this.save();
      this.ring((C + 0.5) * T, (C + 0.5) * T, '#84dcff', 46);
    }
  }
  finishDig() {
    const w = this.world, d = this.drill, i = d.target, x = i % N, y = (i / N) | 0, k = w.kind[i], b = w.biome[i];
    w.kind[i] = K.EMPTY;
    if (base(b) === B.FROST) { w.dugAt[i] = this.time; this.frostOpen.push(i); }
    const tough = k === K.SLATE ? 3 : k === K.VAULT ? 4 : k === K.DENSE || k === K.ORE_B || k === K.BASALT ? 2 : 1;
    sfx.dig(tough);
    this.chips(x, y, this.rockSheet(k, b), 9 + tough * 3, d.dir, 1);
    this.effect('dust', 'dust', (x + 0.5) * T, (y + 0.5) * T);
    if (tough >= 2 || k === K.ICE) this.effect('shatter', 'shatter', (x + 0.5) * T, (y + 0.5) * T);
    if (k === K.ORE_A || k === K.ORE_B) this.popup(x, y, 'CRUSHED', '#9a94a8');
    this.shake = Math.max(this.shake, 1 + tough * 0.5);
    let enter = true;
    if (k === K.HAZARD) enter = this.trigger(i, b, true);
    for (let s = 0; s < 4; s++) {
      const j = (y + DY[s]) * N + x + DX[s];
      if (w.kind[j] === K.HAZARD) this.trigger(j, w.biome[j], false);
    }
    this.changed();
    if (enter) this.go([i], 30, 0); else d.mode = 'idle';
    // The ram: a swipe carries on through soft ground, but never through anything worth hauling.
    if (enter && d.bore > 0) {
      const nk = w.at(d.x + DX[d.dir], d.y + DY[d.dir]);
      if (nk === K.SOFT || nk === K.ICE) { d.bore--; d.next = true; } else d.bore = 0;
    }
  }

  // ------------------------------------------------------------ hauling
  haul(cells) {
    const w = this.world, S = this.S, n = cells.length;
    let grit = 0, relic = -1, cx = 0, cy = 0;
    const gems = [0, 0, 0, 0, 0], sprites = [];
    for (const i of cells) {
      const x = i % N, y = (i / N) | 0, k = w.kind[i], b = w.biome[i];
      const rich = b > 4 ? 2 : 1, gem = b ? GEMS[k] * rich : 0;
      grit += GRIT[k] * rich; gems[base(b)] += gem;
      if (b === B.CRUST && k === K.ORE_A) grit += 4;
      if (k === K.RELIC) relic = [0, 1, 2, 3].find(d => w.relicAt[d] === i);
      cx += x; cy += y;
      sprites.push({ x, y, tile: this.rockRect(x, y, k, b, i), over: this.overlay(k, b), gem: gem ? base(b) : 0, gems: gem, biome: b, far: Math.hypot(x - C, y - C) });
    }
    for (const i of cells) w.kind[i] = K.EMPTY;
    const mult = 1 + (n - 1) * 0.02 * this.val('winch');
    grit = Math.round(grit * mult);
    S.grit += grit; this.pending.grit += grit;
    for (let b = 1; b < 5; b++) { S.gems[b] += gems[b]; this.pending.gems[b] += gems[b]; }
    S.stats.hauls++; S.stats.best = Math.max(S.stats.best, n);
    sprites.sort((a, b) => a.far - b.far);
    const spread = Math.min(1.7, 0.25 + n * 0.018), lift = Math.min(0.5, 0.26 + n * 0.003);
    sprites.forEach((s, i) => { s.go = lift + (n > 1 ? i / (n - 1) : 0) * spread; s.done = false; });
    // The bundle rides the tether from where the loop closed to the core.
    const route = this.pathPts.map(([x, y]) => [x * T, y * T]);
    let length = 0;
    for (let k = 1; k < route.length; k++) length += Math.hypot(route[k][0] - route[k - 1][0], route[k][1] - route[k - 1][1]);
    this.hauls.push({ sprites, t: 0, n, grit, gems, left: grit, paid: 0, lift, relic, route, length, speed: Math.max(260, length / 1.6) });
    cx = (cx / n + 0.5) * T; cy = (cy / n + 0.5) * T;
    this.effect('haul', 'impact', cx, cy);
    if (n >= 20) this.effect('bank', 'area', cx, cy);
    this.shake = Math.max(this.shake, Math.min(9, 2.5 + n * 0.12));
    this.hitstop = Math.min(0.16, 0.05 + n * 0.002);
    sfx.crack(n);
    this.flash = Math.min(0.5, 0.12 + n * 0.006);
    this.ring(cx, cy, '#fff6c8', 30 + Math.min(60, n * 1.5));
    for (const sp of sprites) if (sprites.length < 60 || cellHash(sp.x, sp.y, 9) < 0.4) this.chips(sp.x, sp.y, sp.tile[0], 2, -1, 0.7);
    const title = relic >= 0 ? 'RELIC!' : n >= 200 ? 'COLOSSAL!' : n >= 80 ? 'HUGE HAUL!' : n >= 30 ? 'BIG HAUL!' : n >= 10 ? 'NICE CUT!' : 'HAUL';
    this.banner = { title, n, mult, grit, gems, t: 0, life: 2.2 + Math.min(1.2, n * 0.01) };
    if (relic >= 0) { S.relics[relic] = 1; sfx.relic(); if (S.relics.every(Boolean) && !S.won) { S.won = true; this.wonAt = this.time; } }
    this.drill.bore = 0;
  }
  // A lassoed piece gathers into a bundle, runs in along the tether, and is paid out at the core.
  updateHauls(dt) {
    for (const h of this.hauls) {
      h.t += dt;
      if (h.home === undefined && (h.t - h.lift - 0.45) * h.speed >= h.length) h.home = h.t;
      let arrived = 0;
      for (const s of h.sprites) {
        if (!s.done && h.home !== undefined && h.t >= s.go + 0.42 && h.t >= h.home + (s.go - h.lift) * 0.5 + 0.12) {
          s.done = true; arrived++;
          if (s.gem) this.pending.gems[s.gem] = Math.max(0, this.pending.gems[s.gem] - s.gems);
        }
      }
      if (arrived) {
        h.paid += arrived;
        const left = Math.round(h.grit * (1 - h.paid / h.n));
        this.pending.grit = Math.max(0, this.pending.grit - (h.left - left)); h.left = left;
        this.coreFlash = 0.12; this.counted = 0.12;
        if (this.time - (this.lastRing ?? 0) > 0.11) { this.lastRing = this.time; this.ring((C + 0.5) * T, (C + 0.5) * T, '#ffe14a', 30); this.sparkle((C + 0.5) * T, (C + 0.5) * T, 3, '#ffe14a'); }
        if (this.time - (this.lastTick ?? 0) > 0.045) { this.lastTick = this.time; sfx.tick(Math.floor(h.paid / Math.max(1, h.n / 14))); }
        if (h.paid >= h.n) {
          h.doneAt = h.t;
          sfx.banked(h.n);
          this.effect('bank', 'area', (C + 0.5) * T, (C + 0.5) * T);
          this.save();
        }
      }
    }
    if (this.hauls.length && this.hauls.every(h => h.doneAt !== undefined && h.t > h.doneAt + 0.4)) {
      this.hauls.length = 0; this.pending.grit = 0; this.pending.gems.fill(0);
    }
  }

  // ------------------------------------------------------------ hazards
  // A hazard wakes when the drill cuts beside it (or into it: `direct`). Hauled asleep, it is worth gems.
  // Returns whether the drill may enter the cell it cut.
  trigger(i, biome, direct) {
    const w = this.world, x = i % N, y = (i / N) | 0;
    biome = base(biome);
    if (biome === B.EMBER) {
      w.kind[i] = K.EMPTY; w.lava[i] = 9; this.lavaVol.set(i, 5); this.lavaCells.add(i);
      sfx.hiss(); this.effect('steam', 'smoke-puff', (x + 0.5) * T, (y + 0.5) * T);
      if (direct) { this.jolt(0.5); this.shake = 5; }
      return false;
    }
    if (biome === B.MIRE) {
      w.kind[i] = K.EMPTY;
      this.clouds.push({ x, y, t: 0, life: 6 });
      sfx.puff();
      return true;
    }
    if (biome === B.LODE) {
      if (direct) { this.zap(x, y); return true; }
      const s = this.sparks.get(i);
      if (!s || s.cool <= 0) this.sparks.set(i, { fuse: 0.55, cool: 0 });
      return true;
    }
    return true;
  }
  zap(x, y) {
    const w = this.world, d = this.drill;
    this.effect('zap', 'impact', (x + 0.5) * T, (y + 0.5) * T);
    sfx.zap();
    if (Math.max(Math.abs(d.x - x), Math.abs(d.y - y)) <= 3) { this.jolt(0.7); this.shake = Math.max(this.shake, 5); this.twang = 0.3; }
    for (let v = -3; v <= 3; v++) for (let u = -3; u <= 3; u++) {
      const j = (y + v) * N + x + u;
      if ((u || v) && w.kind[j] === K.HAZARD && base(w.biome[j]) === B.LODE && !this.sparks.has(j)) this.sparks.set(j, { fuse: 0.3 + cellHash(u, v, 7) * 0.3, cool: 0 });
    }
  }
  // A hazard's bite: the drill is knocked senseless for a moment.
  jolt(time) { this.drill.stun = Math.max(this.drill.stun, time); this.hurt = time; this.drill.bore = 0; }
  updateHazards(dt) {
    const w = this.world, d = this.drill;
    let moved = false;
    // Lava: a pocket pours a stream as long as its volume down the open ground, burns what it touches, then sets.
    this.lavaTick = (this.lavaTick ?? 0) + dt;
    const flow = this.lavaTick >= 0.26;
    if (flow) this.lavaTick = 0;
    for (const i of [...this.lavaCells]) {
      const x = i % N, y = (i / N) | 0;
      if (flow) {
        const vol = this.lavaVol.get(i) ?? 1, start = (cellHash(x, y, (this.time * 10) | 0) * 4) | 0;
        for (let s = 0; s < 4; s++) {
          const j = (y + DY[(s + start) % 4]) * N + x + DX[(s + start) % 4];
          if (w.kind[j] === K.HAZARD && base(w.biome[j]) === B.EMBER) { this.trigger(j, B.EMBER, false); moved = true; continue; }
          if (vol > 1 && w.kind[j] === K.EMPTY && w.lava[j] <= 0 && j !== this.di && w.seen[j] && !onCore(j % N, (j / N) | 0)) {
            w.lava[j] = 8; this.lavaVol.set(j, vol - 1); this.lavaVol.set(i, 1); this.lavaCells.add(j);
            break;
          }
        }
      }
      w.lava[i] -= dt;
      if (w.lava[i] <= 0) {
        w.lava[i] = 0; this.lavaVol.delete(i); this.lavaCells.delete(i);
        if (!w.onPath[i] && Math.abs(d.x - x) + Math.abs(d.y - y) > 1) {
          w.kind[i] = K.BASALT; moved = true;
          this.effect('steam', 'smoke-puff', (x + 0.5) * T, (y + 0.5) * T);
        }
      }
    }
    // Spores: a burst pod hangs a cloud that saps the cell, then moss closes the ground round it.
    for (const c of this.clouds) {
      c.t += dt;
      if (Math.max(Math.abs(d.x - c.x), Math.abs(d.y - c.y)) <= 1 && c.t < 0.2) this.jolt(0.4);
      if (c.t >= c.life) {
        for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) {
          const j = (c.y + v) * N + c.x + u;
          if (w.kind[j] === K.EMPTY && !onCore(c.x + u, c.y + v) && !w.onPath[j] && w.lava[j] <= 0 && Math.max(Math.abs(d.x - c.x - u), Math.abs(d.y - c.y - v)) > 1) {
            w.kind[j] = K.SOFT; w.biome[j] = B.MIRE; moved = true;
          }
        }
      }
    }
    this.clouds = this.clouds.filter(c => c.t < c.life);
    // Charged crystals: a short fuse, then an arc that jumps to every crystal near it.
    for (const [i, s] of this.sparks) {
      if (w.kind[i] !== K.HAZARD) { this.sparks.delete(i); continue; }
      if (s.fuse > 0) { s.fuse -= dt; if (s.fuse <= 0) { s.cool = 3; this.zap(i % N, (i / N) | 0); } }
      else { s.cool -= dt; if (s.cool <= 0) this.sparks.delete(i); }
    }
    // Frost: a cut in the north closes over with ice unless the tether lies in it.
    this.frostTick = (this.frostTick ?? 0) + dt;
    if (this.frostTick > 0.4) {
      this.frostTick = 0;
      this.frostOpen = this.frostOpen.filter(i => {
        if (w.kind[i] !== K.EMPTY) return false;
        if (this.time - w.dugAt[i] < 30) return true;
        const x = i % N, y = (i / N) | 0;
        if (w.onPath[i] || Math.max(Math.abs(d.x - x), Math.abs(d.y - y)) <= 1 || w.lava[i] > 0) return true;
        w.kind[i] = K.ICE; moved = true;
        if (this.onScreen(x, y)) { this.effect('freeze', 'impact', (x + 0.5) * T, (y + 0.5) * T); sfx.freeze(); }
        return false;
      });
    }
    if (moved) this.changed();
  }

  // ------------------------------------------------------------ blast, shop
  blast() {
    const w = this.world, d = this.drill;
    if (this.bombs <= 0 || d.mode === 'dig') { if (this.val('bombs')) sfx.deny(); return; }
    const r = this.S.lv.bombs >= 3 ? 2 : 1, tier = this.val('drill') + 1;
    this.bombs--;
    for (let v = -r; v <= r; v++) for (let u = -r; u <= r; u++) {
      const i = (d.y + v) * N + d.x + u;
      if (w.kind[i] !== K.EMPTY && HARD[w.kind[i]] < 99) {
        w.kind[i] = K.EMPTY;
        if (base(w.biome[i]) === B.FROST) { w.dugAt[i] = this.time; this.frostOpen.push(i); }
      }
    }
    this.effect('blast', 'fire-explosion', (d.x + 0.5) * T, (d.y + 0.5) * T);
    this.shake = 9; sfx.blast();
    this.changed();
  }
  cost(u) { const l = this.S.lv[u.id]; return l >= u.values.length - 1 ? null : { grit: u.grit[l], gems: u.gems[l] }; }
  canBuy(u) { const c = this.cost(u); return !!c && this.S.grit >= c.grit && this.S.gems[u.gem] >= c.gems; }
  buy(u) {
    if (!this.canBuy(u)) { sfx.deny(); return; }
    const c = this.cost(u);
    this.S.grit -= c.grit; this.S.gems[u.gem] -= c.gems; this.S.lv[u.id]++; this.S.stats.buys++;
    sfx.buy();
    this.ring((C + 0.5) * T, (C + 0.5) * T, '#8ce060', 70); this.sparkle((C + 0.5) * T, (C + 0.5) * T, 16, '#c8f4a0'); this.flash = 0.15;
    if (u.id === 'bombs') this.bombs = this.val('bombs');
    if (u.id === 'scanner') { this.world.reached.fill(0); this.world.reach(this.val('scanner')); this.version++; }
    this.bought = { id: u.id, t: 0.5 };
    this.retether(); this.save();
  }

  // ------------------------------------------------------------ feel
  // Chips of the ground's own colours. `dir` is the way the drill was cutting (they fly back at it), -1 for all round.
  chips(cx, cy, sheet, count, dir, speed) {
    const colors = DEBRIS[sheet] ?? DEBRIS.crust;
    if (this.parts.length > 420) return;
    for (let n = 0; n < count; n++) {
      const a = Math.random() * 6.283, v = (20 + Math.random() * 70) * speed;
      let vx = Math.cos(a) * v, vy = Math.sin(a) * v;
      if (dir >= 0) { vx -= DX[dir] * 45 * speed; vy -= DY[dir] * 45 * speed; }
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
  // The drill fetches up against ground at the end of a snap.
  land() {
    const d = this.drill, x = d.x + DX[d.dir], y = d.y + DY[d.dir], k = this.world.at(x, y);
    this.shake = Math.max(this.shake, 2.2);
    if (k !== K.EMPTY) this.chips(d.x + DX[d.dir] * 0.5, d.y + DY[d.dir] * 0.5, this.rockSheet(k, this.world.biome[y * N + x]), 6, d.dir, 0.8);
    this.effect('dust', 'dust', (d.x + 0.5 + DX[d.dir] * 0.4) * T, (d.y + 0.5 + DY[d.dir] * 0.4) * T);
  }
  // Everything that only sets the mood: chips in flight, rings, drifting motes, glints on ore, the colour of the
  // dark, and the sound of the place.
  ambient(dt) {
    const w = this.world, d = this.drill, W = this.W, H = this.H;
    for (const p of this.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - 3.5 * dt; p.vy *= 1 - 3.5 * dt; }
    this.parts = this.parts.filter(p => p.t < p.life);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter(r => r.t < 0.5);
    this.flash = Math.max(0, this.flash - dt); this.counted = Math.max(0, this.counted - dt);
    const here = w.biome[this.di], want = GLOOM[here], k = 1 - Math.exp(-dt * 1.5);
    for (let c = 0; c < 3; c++) this.gloom[c] += (want[c] - this.gloom[c]) * k;
    // Motes hang in open ground near the view; each belongs to the ground it was born over.
    while (this.motes.length < 34) {
      const x = this.cam.x + (Math.random() - 0.5) * (W + 60), y = this.cam.y + (Math.random() - 0.5) * (H + 60);
      this.motes.push({ x, y, seed: Math.random() * 100, t: 0, life: 4 + Math.random() * 5, biome: w.biome[Math.max(0, Math.min(N - 1, (y / T) | 0)) * N + Math.max(0, Math.min(N - 1, (x / T) | 0))] });
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
      const x = ((this.cam.x + (Math.random() - 0.5) * W) / T) | 0, y = ((this.cam.y + (Math.random() - 0.5) * H) / T) | 0;
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const i = y * N + x, kk = w.kind[i];
      if (w.seen[i] && (kk === K.ORE_A || kk === K.ORE_B || kk === K.RELIC) && Math.random() < 0.5) this.parts.push({ x: (x + 0.25 + Math.random() * 0.5) * T, y: (y + 0.25 + Math.random() * 0.5) * T, vx: 0, vy: 0, t: 0, life: 0.35, color: '#ffffff', size: 1, star: true });
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
    const d = this.drill, inp = this.input;
    this.twang = Math.max(0, this.twang - dt); this.coreFlash = Math.max(0, this.coreFlash - dt);
    this.hurt = Math.max(0, (this.hurt ?? 0) - dt); this.burning = Math.max(0, (this.burning ?? 0) - dt);
    this.shake = Math.max(0, this.shake - dt * 22);
    if (this.bought) { this.bought.t -= dt; if (this.bought.t <= 0) this.bought = null; }
    if (this.confirmReset > 0) this.confirmReset -= dt;
    this.edge = Math.max(0, (this.edge ?? 0) - dt); d.stun = Math.max(0, d.stun - dt); d.squash = Math.max(0, d.squash - dt);

    if (!this.shop) {
      // What is drawn follows the drill's cell.
      if (d.mode === 'slide') {
        // Moving is one flowing motion: speed builds while the drill keeps going, and what is left of a frame when
        // a cell is reached is spent on the next cell, so there is never a hitch between two.
        d.run = Math.min(1, d.run + dt * 2.4); d.rest = 0;
        let step = d.speed * (d.speed === 18 ? 0.7 + 0.65 * d.run : 1) * dt;
        for (let guard = 0; guard < 4 && step > 0 && d.mode === 'slide'; guard++) {
          const dx = d.x - d.fx, dy = d.y - d.fy, far = Math.hypot(dx, dy);
          if (far > step) { d.fx += dx / far * step; d.fy += dy / far * step; break; }
          d.fx = d.x; d.fy = d.y; step -= far; d.mode = 'idle';
          if (d.speed === 24) { sfx.thud(); this.land(); d.squash = 0.12; break; }
          const want = inp.queued ?? inp.held;
          if (d.next || want === null || d.wait > 0 || d.stun > 0) break;
          inp.queued = null;
          this.attempt(want, true);
        }
      } else if (d.mode === 'dig' && inp.queued !== null && inp.queued !== d.dir) {
        // A change of mind: a new direction drops the cut where it stands.
        d.mode = 'idle'; d.bore = 0; d.next = false;
      } else if (d.mode === 'dig') {
        d.t += dt;
        if (((d.t * 30) | 0) !== (((d.t - dt) * 30) | 0) && d.dur > 0.15) { sfx.grind(); if (d.dur > 0.4) this.shake = Math.max(this.shake, 1.2); }
        if (((d.t * 18) | 0) !== (((d.t - dt) * 18) | 0)) this.chips(d.target % N, (d.target / N) | 0, this.rockSheet(this.world.kind[d.target], this.world.biome[d.target]), 2, d.dir, 0.6);
        if (d.t >= d.dur) this.finishDig();
      } else if (d.mode === 'bump') {
        d.t += dt; if (d.t > 0.14) d.mode = 'idle';
      }
      if (d.mode === 'idle') {
        d.wait -= dt;
        d.rest += dt; if (d.rest > 0.12) d.run = 0;
        if (d.next) { d.next = false; this.attempt(d.dir, false); }
        else if (inp.queued !== null) { const q = inp.queued; inp.queued = null; this.attempt(q, true); }
        else if (inp.held !== null && d.wait <= 0) this.attempt(inp.held, true);
      }
      this.updateHazards(dt);
      this.updateHauls(dt);
      // The station makes a trickle of grit of its own: however a world has been spent, the next reach is never
      // out of reach for good.
      this.trickle = (this.trickle ?? 0) + dt;
      if (this.trickle >= 2) { this.trickle -= 2; this.S.grit += 1; }
      this.saveTick = (this.saveTick ?? 0) + dt;
      if (this.saveTick > 15) { this.saveTick = 0; this.save(); }
    }
    this.ambient(dt);
    for (const e of this.effects) e.t += dt * 1000;
    this.effects = this.effects.filter(e => e.t < duration(e.sheet, e.animation));
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter(p => p.t < 0.9);
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.life) this.banner = null; }
    // The camera eases after the drill.
    const k = 1 - Math.exp(-dt * 7);
    const lead = d.mode === 'idle' ? 0 : 14;
    this.cam.x += (d.fx * T + 8 + DX[d.dir] * lead - this.cam.x) * k; this.cam.y += (d.fy * T + 8 + DY[d.dir] * lead - this.cam.y) * k;
  }

  // ------------------------------------------------------------ drawing
  rockSheet(k, b) {
    return k === K.BEDROCK ? 'bedrock' : k === K.SLATE ? 'slate' : k === K.VAULT || k === K.RELIC ? 'vault' : k === K.ICE ? 'ice' : k === K.BASALT ? 'basalt' : BIOME_NAMES[b];
  }
  rockRect(x, y, k, b, i) {
    const sheet = this.rockSheet(k, b), rects = sheets[sheet].tiles[this.world.mask(x, y)];
    return [sheet, rects[(cellHash(x, y, 3) * rects.length) | 0]];
  }
  overlay(k, b) {
    return k === K.DENSE ? 'dense' : k === K.ORE_A ? 'oreA' : k === K.ORE_B ? 'oreB' : k === K.HAZARD ? 'hazard' : k === K.RELIC ? 'relic' : null;
  }
  itemSheet(b) { return b === B.CRUST ? 'lode-items' : `${BIOME_NAMES[base(b)]}-items`; }

  render() {
    const { ctx, W, H, world: w } = this, d = this.drill, now = this.time * 1000;
    const sx = this.shake ? (cellHash((now / 16) | 0, 1, 5) - 0.5) * this.shake : 0, sy = this.shake ? (cellHash((now / 16) | 0, 2, 5) - 0.5) * this.shake : 0;
    const ox = Math.round(this.cam.x - W / 2 + sx), oy = Math.round(this.cam.y - H / 2 + sy);
    ctx.fillStyle = '#07060b';
    ctx.fillRect(0, 0, W, H);
    // The ground is painted once into 8 x 8 cell pieces and redrawn only when it changes; a frame lays those
    // down, then draws what moves over them.
    const x0 = Math.max(0, Math.floor(ox / T)), y0 = Math.max(0, Math.floor(oy / T)), x1 = Math.min(N - 1, Math.floor((ox + W) / T)), y1 = Math.min(N - 1, Math.floor((oy + H) / T));
    for (let cy = y0 >> 3; cy <= y1 >> 3; cy++) for (let cx = x0 >> 3; cx <= x1 >> 3; cx++) ctx.drawImage(this.chunk(cx, cy), cx * 128 - ox, cy * 128 - oy);
    for (const i of this.lavaCells) {
      const x = i % N, y = (i / N) | 0;
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1 && w.seen[i]) draw(ctx, 'lava', frameAt('lava', `lava-${w.lavaMask(x, y)}`, now + cellHash(x, y, 2) * 300), x * T - ox, y * T - oy);
    }
    for (const i of this.frostOpen) {
      // Ice about to close over a cut: a rim of it creeps in first.
      const age = this.time - w.dugAt[i];
      if (age <= 22 || w.onPath[i] || w.kind[i] !== K.EMPTY) continue;
      ctx.globalAlpha = Math.min(0.8, (age - 22) / 8);
      draw(ctx, 'ice', sheets.ice.tiles[0][0], (i % N) * T - ox, ((i / N) | 0) * T - oy);
      ctx.globalAlpha = 1;
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * N + x, k = w.kind[i];
      if ((k !== K.HAZARD && k !== K.RELIC) || !w.seen[i]) continue;
      const b = w.biome[i], m = w.mask(x, y), ux = x * T - ox - ((m & 4) ? 0 : 1), uy = y * T - oy - ((m & 16) ? 0 : 1);
      if (k === K.HAZARD) {
        const items = this.itemSheet(b), s = this.sparks.get(i);
        draw(ctx, items, s && s.fuse > 0 ? (((now / 60) | 0) % 2 ? 'hazard-b' : 'hazard') : frameAt(items, 'hazard', now + cellHash(x, y, 4) * 900), ux, uy);
      } else { const rs = `${BIOME_NAMES[DIR_BIOME[w.relicAt.indexOf(i)] ?? base(b)]}-items`; draw(ctx, rs, frameAt(rs, 'relic', now), ux, uy); }
    }
    // The block being cut cracks further the nearer it is to giving way.
    if (d.mode === 'dig' && d.dur > 0.12) {
      const stage = Math.min(4, Math.floor(d.t / d.dur * 5));
      if (stage > 0) draw(ctx, 'cracks', `crack-${stage}`, (d.target % N) * T - ox, ((d.target / N) | 0) * T - oy);
    }
    // Ground one cut from coming free.
    if (d.mode === 'idle' || d.mode === 'bump') for (const p of this.preview) {
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.16 + 0.12 * Math.sin(now / 110);
      for (const i of p.cells) ctx.fillRect((i % N) * T - ox, ((i / N) | 0) * T - oy, T, T);
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(now / 110);
      const cx = (p.i % N) * T - ox, cy = ((p.i / N) | 0) * T - oy;
      ctx.fillStyle = '#ffe14a';
      ctx.fillRect(cx + 1, cy + 1, 14, 1); ctx.fillRect(cx + 1, cy + 14, 14, 1); ctx.fillRect(cx + 1, cy + 1, 1, 14); ctx.fillRect(cx + 14, cy + 1, 1, 14);
      ctx.globalAlpha = 1;
    }
    // The core.
    const coreX = (C - 1) * T - ox, coreY = (C - 1) * T - oy;
    const hull = this.S.lv.winch;
    draw(ctx, 'core', this.coreFlash > 0 ? `core-flash-${hull}` : this.S.won ? `core-c-${hull}` : frameAt('core', `idle-${hull}`, now), coreX, coreY);
    draw(ctx, 'dish', frameAt('dish', `dish-${this.S.lv.scanner}`, now), coreX + 34, coreY - 6);
    [[39, 20], [20, 39], [1, 20], [20, 1]].forEach(([u, v], dir) => {
      if (this.S.relics[dir]) drawScaled(ctx, `${BIOME_NAMES[DIR_BIOME[dir]]}-items`, 'relic', coreX + u, coreY + v, 8, 8);
    });
    this.drawTether(ox, oy);
    // Lassoed pieces: they lift, gather into a bundle, run in along the tether, then drop into the core.
    const hx = (C + 0.5) * T - ox, hy = (C + 0.5) * T - oy;
    for (const h of this.hauls) {
      // The bundle is packed as a disc as wide as the piece was big.
      const girth = Math.min(40, 4 + Math.sqrt(h.n) * 4.2);
      let run = Math.max(0, (h.t - h.lift - 0.45) * h.speed), tailX = h.route[0][0] - ox, tailY = h.route[0][1] - oy;
      for (let k = 1; k < h.route.length && run > 0; k++) {
        const seg = Math.hypot(h.route[k][0] - h.route[k - 1][0], h.route[k][1] - h.route[k - 1][1]), take = Math.min(seg, run);
        tailX = h.route[k - 1][0] + (h.route[k][0] - h.route[k - 1][0]) * (seg ? take / seg : 1) - ox;
        tailY = h.route[k - 1][1] + (h.route[k][1] - h.route[k - 1][1]) * (seg ? take / seg : 1) - oy;
        run -= take;
      }
      const flash = h.t < h.lift && ((h.t * 24) | 0) % 2 === 0;
      h.sprites.forEach((s, n) => {
        if (s.done) return;
        const u = Math.max(0, Math.min(1, (h.t - s.go) / 0.42)), e = u * u;
        const lift = Math.min(1, h.t / h.lift) * 3;
        const ring = Math.sqrt((n + 0.5) / h.n) * girth, turn = n * 2.39996 + h.t * 0.6;
        let bx = tailX + Math.cos(turn) * ring - 8, by = tailY + Math.sin(turn) * ring - 8;
        if (h.home !== undefined) {
          // Home: each piece in turn leaves the bundle for the core.
          const v = Math.max(0, Math.min(1, (h.t - h.home) / ((s.go - h.lift) * 0.5 + 0.12)));
          bx += (hx - 8 - bx) * v * v; by += (hy - 8 - by) * v * v;
        }
        let px = s.x * T - ox, py = s.y * T - oy - lift, size = T;
        if (u > 0) { px += (bx - px) * e; py += (by - py) * e; size = Math.round(T - 5 * u); }
        if (px < -T || py < -T || px > W || py > H) return;
        if (u > 0 && u < 1) { ctx.fillStyle = '#fff6c8'; this.line(px + 8, py + 8, tailX, tailY, 0.25); }
        const off = (T - size) / 2;
        if (size === T) draw(ctx, s.tile[0], s.tile[1], px, py); else drawScaled(ctx, s.tile[0], s.tile[1], px + off, py + off, size, size);
        if (s.over) {
          const items = this.itemSheet(s.biome);
          const f = s.over === 'hazard' || s.over === 'relic' ? frameAt(items, s.over, 0) : s.over;
          if (size === T) draw(ctx, items, f, px, py); else drawScaled(ctx, items, f, px + off, py + off, size, size);
        }
        if (flash) { ctx.globalAlpha = 0.6; ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(px) + 2, Math.round(py) + 2, 12, 12); ctx.globalAlpha = 1; }
      });
    }
    // Spore clouds.
    for (const c of this.clouds) {
      ctx.globalAlpha = Math.min(1, (c.life - c.t) * 2) * 0.85;
      const f = frameAt('spore', 'area', (c.t * 1000) % (duration('spore', 'area') * 0.8));
      if (f) draw(ctx, 'spore', f, (c.x + 0.5) * T - ox - f[2] / 2, (c.y + 0.5) * T - oy - f[3] / 2);
      ctx.globalAlpha = 1;
    }
    // The drill.
    const dirName = ['right', 'down', 'left', 'up'][d.dir];
    let dx = d.fx * T - ox, dy = d.fy * T - oy;
    if (d.mode === 'dig') { const push = 2 + Math.min(1, d.t / d.dur) * 5 + Math.sin(d.t * 70) * 1.1; dx += DX[d.dir] * push; dy += DY[d.dir] * push; }
    if (d.mode === 'bump') { const push = Math.sin(Math.min(1, d.t / 0.14) * Math.PI) * 3; dx += DX[d.dir] * push; dy += DY[d.dir] * push; }
    const busy = d.mode === 'dig' || d.mode === 'slide';
    if (d.mode === 'slide' && d.speed >= 24) {
      // Speed leaves a wake: fading copies of the drill back along the way it came.
      const mvx = d.x - d.fx, mvy = d.y - d.fy, far = Math.hypot(mvx, mvy) || 1;
      for (let g = 3; g >= 1; g--) { ctx.globalAlpha = 0.34 - g * 0.09; draw(ctx, 'drill', `${dirName}-a-${this.S.lv.drill}`, dx - mvx / far * g * 7, dy - mvy / far * g * 7); }
      ctx.globalAlpha = 1;
    }
    let along = 16, across = 16;
    if (d.squash > 0) { along = 13; across = 19; }
    else if (d.mode === 'slide') { along = 16 + Math.round((d.speed >= 24 ? 4 : 3 * d.run)); across = 16 - Math.round(d.speed >= 24 ? 2 : d.run); }
    this.drawDrill(dx, dy, d.dir, this.S.lv.drill, this.S.lv.momentum, busy ? now : -1, d.dir % 2 ? across : along, d.dir % 2 ? along : across);
    // Blasts left, racked across the drill's tail.
    for (let n = 0; n < this.bombs; n++) {
      const side = (n - (this.bombs - 1) / 2) * 3, bx = Math.round(dx + 7 - DX[d.dir] * 9 + DY[d.dir] * side), by = Math.round(dy + 7 - DY[d.dir] * 9 + DX[d.dir] * side);
      ctx.fillStyle = '#16121c'; ctx.fillRect(bx, by, 2, 2); ctx.fillStyle = '#ff5a3a'; ctx.fillRect(bx, by, 1, 1);
    }
    if (this.hurt > 0 && ((now / 50) | 0) % 2) { ctx.globalAlpha = 0.5; ctx.fillStyle = '#ff5a4a'; ctx.fillRect(Math.round(dx) + 3, Math.round(dy) + 3, 10, 10); ctx.globalAlpha = 1; }
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
      const cx = (m.x / T) | 0, cy = (m.y / T) | 0;
      if (cx < 0 || cy < 0 || cx >= N || cy >= N || w.kind[cy * N + cx] !== K.EMPTY || !w.seen[cy * N + cx]) continue;
      ctx.globalAlpha = Math.max(0, Math.min(1, m.t, m.life - m.t)) * (0.35 + 0.3 * Math.sin(this.time * 3 + m.seed)); ctx.fillStyle = MOTE[m.biome];
      ctx.fillRect(Math.round(m.x - ox), Math.round(m.y - oy), 1, 1);
    }
    ctx.globalAlpha = 1;
    this.light(ox, oy);
    // Ground lying loose: cut off from the world, waiting for the tether to be drawn round it. It shows through the
    // dark, with a dotted edge that crawls round it.
    if (this.loose.length) {
      const set = this.looseSet ??= new Set();
      if (this.looseFor !== this.version) { this.looseFor = this.version; set.clear(); for (const i of this.loose) set.add(i); }
      const crawl = (now / 90) | 0;
      for (const i of this.loose) {
        const x = i % N, y = (i / N) | 0, px = x * T - ox, py = y * T - oy;
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

  // The drill as its upgrades have made it: the bit's metal, and whatever the ram has bolted on.
  drawDrill(x, y, dir, bit, ram, now, w = 16, h = 16) {
    const name = ['right', 'down', 'left', 'up'][dir], body = now >= 0 ? frameAt('drill', `${name}-${bit}`, now) : `${name}-a-${bit}`;
    if (w === 16 && h === 16) {
      if (ram > 0) draw(this.ctx, 'drill', `ram-${name}-${ram}`, x, y);
      draw(this.ctx, 'drill', body, x, y);
      return;
    }
    // Stretched along its way with speed, squashed against what stops it; its middle stays put.
    const px = x + (16 - w) / 2, py = y + (16 - h) / 2;
    if (ram > 0) drawScaled(this.ctx, 'drill', `ram-${name}-${ram}`, px, py, w, h);
    drawScaled(this.ctx, 'drill', body, px, py, w, h);
  }
  // A span of tether in the style of a level of reach.
  drawSpan(x0, y0, x1, y1, style, off = 0) {
    const { ctx } = this;
    ctx.fillStyle = style.a; this.line(x0, y0 + off, x1, y1 + off);
    if (style.b !== style.a) { ctx.fillStyle = style.b; this.line(x0, y0 + off, x1, y1 + off, style.dash); }
  }
  chunk(cx, cy) {
    const key = cy * 32 + cx;
    let c = this.chunks.get(key);
    if (!c) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 128;
      c = { canvas, ctx: canvas.getContext('2d', { alpha: false }), v: -1 };
      this.chunks.set(key, c);
    }
    if (c.v !== this.version) { c.v = this.version; this.paint(c.ctx, cx * 8, cy * 8); }
    return c.canvas;
  }
  // Everything in a piece of ground that stays put: floors, rock, ore and armour.
  paint(ctx, x0, y0) {
    const w = this.world;
    ctx.globalAlpha = 1; ctx.fillStyle = '#07060b'; ctx.fillRect(0, 0, 128, 128);
    for (let y = y0; y < y0 + 8 && y < N; y++) for (let x = x0; x < x0 + 8 && x < N; x++) {
      const i = y * N + x, k = w.kind[i], b = w.biome[i], px = (x - x0) * T, py = (y - y0) * T;
      const floorSheet = `${BIOME_NAMES[b]}-floor`, floors = sheets[floorSheet].tiles[255], floor = floors[(cellHash(x, y, 1) * floors.length) | 0];
      if (!w.seen[i]) {
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
      const over = this.overlay(k, b);
      if (over && over !== 'hazard' && over !== 'relic') draw(ctx, this.itemSheet(b), over, ux, uy);
    }
  }

  // Light spreads from a cell through open ground, losing a little with every cell, and soaks a short way into
  // the rock it meets: so it takes the shape of the tunnels and lights the faces of their walls, where a disc
  // laid over everything would look like a ball. `want` holds the brightest light to reach each cell this frame.
  shine(cx, cy, power, reach) {
    const kind = this.world.kind, want = this.want, queue = this.lightQueue, start = cy * N + cx;
    if (cx < 1 || cy < 1 || cx >= N - 1 || cy >= N - 1 || want[start] >= power) return;
    let head = 0, tail = 0;
    want[start] = power; queue[tail++] = start;
    const fade = power / reach;
    while (head < tail) {
      const i = queue[head++], here = want[i], x = i % N, y = (i / N) | 0;
      if (x < 1 || y < 1 || x >= N - 1 || y >= N - 1) continue;
      const solid = kind[i] !== K.EMPTY;
      for (let n = 0; n < 8; n++) {
        const j = i + LIGHT_STEP[n];
        // Rock drinks light fast: a face is lit, the cell behind it barely.
        const next = here - fade * (n < 4 ? 1 : 1.41) * (solid || kind[j] !== K.EMPTY ? 2.6 : 1);
        if (next > want[j] + 0.01 && tail < queue.length) { want[j] = next; queue[tail++] = j; }
      }
    }
  }
  // The dark, in the colour of the ground the drill is in, thinned wherever light reaches. It is worked out a cell
  // at a time and drawn smoothed, and each cell's light eases toward what it should be, so light trails the drill.
  light(ox, oy) {
    const { ctx, W, H } = this, d = this.drill, w = this.world;
    this.want ??= new Float32Array(SIZE); this.lit ??= new Float32Array(SIZE); this.lightQueue ??= new Int32Array(4096);
    const want = this.want, lit = this.lit;
    const x0 = Math.max(0, Math.floor(ox / T) - 1), y0 = Math.max(0, Math.floor(oy / T) - 1), x1 = Math.min(N - 1, Math.floor((ox + W) / T) + 1), y1 = Math.min(N - 1, Math.floor((oy + H) / T) + 1);
    const pad = 11;
    for (let y = Math.max(0, y0 - pad); y <= Math.min(N - 1, y1 + pad); y++) want.fill(0, y * N + Math.max(0, x0 - pad), y * N + Math.min(N - 1, x1 + pad) + 1);
    const near = (x, y) => x >= x0 - pad && x <= x1 + pad && y >= y0 - pad && y <= y1 + pad;
    const flick = 1 + Math.sin(this.time * 9) * 0.03;
    this.shine(Math.round(d.fx), Math.round(d.fy), (d.mode === 'dig' ? 1.08 : 1) * flick, 8.5);
    if (near(C, C)) this.shine(C, C, 1 + this.coreFlash * 1.5 + Math.sin(this.time * 2) * 0.04, 8 + this.coreFlash * 10);
    let lavas = 0;
    for (const i of this.lavaCells) { if (lavas++ > 40) break; if (near(i % N, (i / N) | 0)) this.shine(i % N, (i / N) | 0, 0.85, 3.5); }
    for (const e of this.effects) if (e.sheet === 'blast' || e.sheet === 'zap' || e.sheet === 'haul' || e.sheet === 'bank') { const ex = (e.x / T) | 0, ey = (e.y / T) | 0; if (near(ex, ey)) this.shine(ex, ey, 1, 6); }
    for (const [i, sp] of this.sparks) if (sp.fuse > 0 && near(i % N, (i / N) | 0)) this.shine(i % N, (i / N) | 0, 0.9, 3);
    // One pixel of darkness per cell, drawn sixteen times the size and smoothed.
    const cols = x1 - x0 + 1, rows = y1 - y0 + 1;
    let map = this.dark;
    if (!map || map.width !== cols || map.height !== rows) { map = this.dark = document.createElement('canvas'); map.width = cols; map.height = rows; this.darkData = null; }
    const mc = map.getContext('2d'), data = this.darkData ??= mc.createImageData(cols, rows), px = data.data, [r, g, b] = this.gloom;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * N + x, o = ((y - y0) * cols + x - x0) * 4;
      lit[i] += (Math.min(1, want[i]) - lit[i]) * 0.3;
      const l = lit[i];
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 168 * (1 - l * (2 - l));
    }
    mc.putImageData(data, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(map, x0 * T - ox, y0 * T - oy, cols * T, rows * T);
    ctx.imageSmoothingEnabled = false;
    // The core's slow turning rays.
    const cxp = (C + 0.5) * T - ox, cyp = (C + 0.5) * T - oy;
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

  // A line of whole pixels; `dash` (0-1) draws only that share of every 4 pixels.
  line(x0, y0, x1, y1, dash = 1) {
    const { ctx, W, H } = this;
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy, n = 0;
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
    const cx = (C + 0.5) * T - ox, cy = (C + 0.5) * T - oy, rad = (R + 0.8) * T, dots = Math.ceil(rad * 6.2832 / 7);
    if (Math.hypot(W / 2 - cx, H / 2 - cy) + Math.hypot(W, H) / 2 > rad) {
      ctx.fillStyle = this.edge > 0 ? '#ff7a5a' : '#f4ecd8'; ctx.globalAlpha = this.edge > 0 ? 0.9 : 0.3;
      const turn = this.time * 0.05;
      for (let n = 0; n < dots; n++) {
        const a = n / dots * 6.2832 + turn, x = Math.round(cx + Math.cos(a) * rad), y = Math.round(cy + Math.sin(a) * rad);
        if (x >= 0 && y >= 0 && x < W && y < H) ctx.fillRect(x, y, 2, 1);
      }
      ctx.globalAlpha = 1;
    }
    const pts = this.pathPts.map(([x, y]) => [x * T - ox, y * T - oy]);
    if (!pts.length) return;
    // The first point is the drill as drawn, the tether leaving from its tail.
    pts[0] = [d.fx * T + 8 - ox - DX[d.dir] * 5, d.fy * T + 8 - oy - DY[d.dir] * 5];
    const wob = this.twang > 0 ? Math.sin(this.time * 90) * this.twang * 5 : 0;
    // Turned back at the edge it shows red; otherwise it is whatever the reach upgrades have made it.
    const own = TETHERS[this.S.lv.tether], style = this.twang > 0 ? { a: '#ff5a4a', b: '#ff5a4a', dash: 1, thick: own.thick } : own;
    for (const pass of own.thick ? [2, 1, 0] : [1, 0]) {
      const shadow = pass === (own.thick ? 2 : 1), use = shadow ? { a: '#16121c', b: '#16121c', dash: 1 } : style;
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        if (Math.max(x0, x1) < -2 || Math.max(y0, y1) < -2 || Math.min(x0, x1) > W + 2 || Math.min(y0, y1) > H + 2) continue;
        if (wob) {
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
    // The way home, when the core is out of sight.
    const cx = (C + 0.5) * T - ox, cy = (C + 0.5) * T - oy;
    if (cx < 0 || cy < 44 || cx > W || cy > H - 44) {
      const mx = W / 2, my = H / 2, vx = cx - mx, vy = cy - my, s = Math.min((W / 2 - 10) / Math.abs(vx || 1e-6), (H / 2 - 52) / Math.abs(vy || 1e-6));
      draw(ctx, 'icons', 'home', mx + vx * s - 5, my + vy * s - 5);
    }
    // Banner of the last haul.
    if (this.banner) {
      const b = this.banner, pop = Math.min(1, b.t / 0.12), y = Math.round(H * 0.2 - (1 - pop) * 8);
      ctx.globalAlpha = Math.min(1, (b.life - b.t) * 3);
      const big = (b.n >= 10 ? 2 : 1) + (b.t < 0.07 ? 1 : 0);
      text(ctx, b.title, W / 2, y, b.n >= 30 ? '#ffe14a' : '#ffffff', 0.5, big);
      text(ctx, `${b.n} x${b.mult.toFixed(1)}`, W / 2, y + 11 * big + 2, '#bfe6ff', 0.5);
      let line = `+${compact(b.grit)}`, lw = textWidth(line) + 11;
      const gems = [1, 2, 3, 4].filter(g => b.gems[g] > 0);
      for (const g of gems) lw += textWidth(`+${b.gems[g]}`) + 15;
      let lx = Math.round(W / 2 - lw / 2), ly = y + 11 * big + 14;
      draw(ctx, 'icons', 'grit', lx, ly - 1); text(ctx, line, lx + 11, ly, '#ffe14a'); lx += textWidth(line) + 15;
      for (const g of gems) { draw(ctx, 'icons', GEM_ICON[g], lx, ly - 1); text(ctx, `+${b.gems[g]}`, lx + 11, ly, GEM_COLOR[g]); lx += textWidth(`+${b.gems[g]}`) + 15; }
      ctx.globalAlpha = 1;
    }
    if (S.won && this.wonAt !== undefined && this.time - this.wonAt < 6) {
      text(ctx, 'CORE RESTORED', W / 2, H * 0.36, '#ffe14a', 0.5, 2);
    }
    // Top: what has been banked, the cell and the tether.
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
    // How much of its reach the tether has left.
    const R = this.val('tether'), left = Math.max(0, R - this.far);
    this.bar(6, 29, W - 34, 'tether', left / R, this.far / R > 0.93 ? '#ff7a5a' : '#f4ecd8', this.twang > 0);
    text(ctx, `${Math.floor(left)}`, W - 6, 30, this.twang > 0 ? '#ff7a5a' : '#f4ecd8', 1);
    draw(ctx, 'ui', isMuted() ? 'mute' : 'sound', W - 21, 2);
    this.button(W - 24, 0, 24, 20, () => { setMuted(!isMuted()); sfx.tap(); });
    // Start over: two taps, so a slip of the thumb does not cost a world.
    const sure = this.confirmReset > 0, label = sure ? 'SURE?' : 'NEW', lw = textWidth(label) + 8;
    slice9(ctx, 'ui', sure ? 'button-off' : 'panel', W - lw - 2, 44, lw, 14);
    text(ctx, label, W - lw / 2 - 2, 46, sure ? '#ff7a5a' : '#9a94a8', 0.5);
    this.button(W - lw - 6, 42, lw + 6, 20, () => {
      if (this.confirmReset > 0) { this.confirmReset = 0; this.fresh((Math.random() * 1e9) | 0); this.save(); sfx.relic(); } else { this.confirmReset = 2.5; sfx.tap(); }
    });
    // Bottom: the blast, and the shop when the drill is home.
    const by = H - 46;
    if (this.val('bombs') > 0) {
      slice9(ctx, 'ui', this.bombs > 0 ? 'panel' : 'button-off', 4, by, 34, 34);
      draw(ctx, 'upgrades', 'bomb', 12, by + 8);
      text(ctx, `${this.bombs}`, 31, by + 22, '#ffffff', 1);
      this.button(0, by - 6, 44, 46, () => this.blast());
    }
    const afford = UPGRADES.some(u => this.canBuy(u));
    if (this.atCore && !this.shop && d.mode === 'idle') {
      const w = 84, x = Math.round(W / 2 - w / 2), up = afford && ((now / 300) | 0) % 2;
      slice9(ctx, 'ui', afford ? (up ? 'button-down' : 'button') : 'panel', x, by + 6, w, 24);
      text(ctx, 'UPGRADES', W / 2, by + 13, afford ? '#ffffff' : '#9a94a8', 0.5);
      this.button(x - 4, by, w + 8, 36, () => { this.shop = true; sfx.tap(); });
      if (afford && S.stats.buys === 0) draw(ctx, 'ui', 'hand', W / 2 - 4, by + 18 + Math.round(Math.sin(now / 150) * 3));
    }
    // The idea, shown and not told: a hand draws a loop, as the tether must be drawn round the loose piece.
    if (S.stats.hauls === 0 && !this.shop && this.input.id === null) {
      const u = (now % 2200) / 2200, turn = u * 6.2832 - 1.5708, hx = W / 2 - 6 + Math.cos(turn) * 20, hy = H * 0.72 + Math.sin(turn) * 14;
      ctx.fillStyle = '#ffffff';
      for (let n = 1; n < 14; n++) { const a = turn - n * 0.22; ctx.globalAlpha = 1 - n / 14; ctx.fillRect(Math.round(W / 2 + Math.cos(a) * 20), Math.round(H * 0.72 + Math.sin(a) * 14) - 2, 2, 2); }
      ctx.globalAlpha = 1;
      draw(ctx, 'ui', 'hand', hx, hy);
      if (S.stats.moves < 3) draw(ctx, 'logo', 'logo', W / 2 - 66, 52);
    }
    // Where the thumb is steering from.
    if (this.input.id !== null && !this.shop) {
      const { ax, ay, px, py } = this.input;
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(ax) - 1, Math.round(ay) - 1, 3, 3);
      this.line(ax, ay, px, py, 0.5);
      ctx.globalAlpha = 1;
    }
    this.shopRise = this.shop ? Math.min(1, (this.shopRise ?? 0) + 0.12) : 0;
    if (this.shop) this.drawShop();
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
    text(ctx, 'x', px + pw - 12, py + 6, '#ffffff');
    this.buttons.unshift({ x: px + pw - 24, y: py, w: 24, h: 22, act: () => { this.shop = false; sfx.tap(); } });
    UPGRADES.forEach((u, n) => {
      const y = py + 20 + n * rh, c = this.cost(u), can = this.canBuy(u), lit = this.bought?.id === u.id;
      slice9(ctx, 'ui', lit ? 'button-down' : !c ? 'button-max' : can ? 'button' : 'button-off', px + 4, y, pw - 8, rh - 1);
      // What it will look like once bought (or does now, at its last level).
      const next = Math.min(S.lv[u.id] + 1, u.values.length - 1), vx = px + 7, vy = y + Math.floor((rh - 17) / 2);
      ctx.fillStyle = '#0c0a12'; ctx.fillRect(vx, vy, 16, 16);
      if (u.id === 'drill') this.drawDrill(vx, vy, 0, next, S.lv.momentum, this.time * 1000);
      else if (u.id === 'momentum') this.drawDrill(vx, vy, 0, S.lv.drill, next, -1);
      else if (u.id === 'tether') { for (const pass of TETHERS[next].thick ? [1, 0] : [0]) this.drawSpan(vx + 1, vy + 12 + pass, vx + 14, vy + 3 + pass, TETHERS[next]); }
      else if (u.id === 'winch') drawScaled(ctx, 'core', `core-a-${next}`, vx, vy, 16, 16);
      else if (u.id === 'scanner') draw(ctx, 'dish', `dish-${next}`, vx, vy);
      else { draw(ctx, 'upgrades', u.icon, vx + 2, vy + 2); text(ctx, `${u.values[next]}`, vx + 15, vy + 7, '#ffffff', 1); }
      // What it is, what it does, and what the next level changes.
      const l = S.lv[u.id];
      text(ctx, u.name, px + 25, y + 2, '#ffffff');
      text(ctx, c ? `${u.show(u.values[l])}>${u.show(u.values[l + 1])}` : `${u.show(u.values[l])} MAX`, px + 31 + textWidth(u.name), y + 2, c ? '#bfe6ff' : '#ffe14a');
      text(ctx, u.what, px + 25, y + rh - 12, c ? '#c8c2d4' : '#e8c070');
      if (c) {
        let cx = px + pw - 18;
        draw(ctx, 'icons', 'grit', cx, y + 1);
        text(ctx, compact(c.grit), cx - 2, y + 2, S.grit >= c.grit ? '#ffe14a' : '#ff7a5a', 1);
        if (c.gems > 0) {
          cx -= textWidth(compact(c.grit)) + 16;
          draw(ctx, 'icons', GEM_ICON[u.gem], cx, y + 1);
          text(ctx, `${c.gems}`, cx - 2, y + 2, S.gems[u.gem] >= c.gems ? GEM_COLOR[u.gem] : '#ff7a5a', 1);
        }
      }
      this.buttons.unshift({ x: px + 4, y, w: pw - 8, h: rh - 1, act: () => this.buy(u) });
    });
    const fy = py + ph - 19;
    text(ctx, this.confirmReset > 0 ? 'TAP AGAIN: NEW WORLD' : 'NEW WORLD', px + pw / 2, fy + 4, this.confirmReset > 0 ? '#ff7a5a' : '#6a6478', 0.5);
    this.buttons.unshift({ x: px + 4, y: fy, w: pw - 8, h: 17, act: () => {
      if (this.confirmReset > 0) { this.confirmReset = 0; this.fresh((Math.random() * 1e9) | 0); this.save(); sfx.relic(); } else { this.confirmReset = 2.5; sfx.tap(); }
    } });
  }
}
