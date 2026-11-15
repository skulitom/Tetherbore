// Tetherbore: the game. A drill on a tether cuts ground round a fixed core; a piece cut wholly free is reeled in.
// Logic moves by whole cells and at once; what is drawn catches up, so input never waits on an animation.
import { World, N, C, K, B, HARD, GRIT, GEMS, DX, DY, BIOME_NAMES, base, cellHash, taut, sight, onCore } from './world.js';
import { sheets, draw, drawScaled, frameAt, duration, slice9, text, textWidth } from './atlas.js';
import { sfx, unlock, isMuted, setMuted } from './audio.js';

const T = 16;                                   // pixels in a cell
const SAVE_KEY = 'tetherbore-save-v1';
const DIR_BIOME = [B.LODE, B.EMBER, B.MIRE, B.FROST];
const GEM_ICON = [null, 'frost', 'ember', 'mire', 'lode'];
const GEM_COLOR = [null, '#bfe6ff', '#ffb060', '#b8f06a', '#d8b8ff'];

// ---------------------------------------------------------------- upgrades
// `values` is what each level gives; `grit` and `gems` what the next level costs; `gem` whose gems it takes.
export const UPGRADES = [
  { id: 'tether', icon: 'string', name: 'TETHER', values: [14, 19, 25, 32, 40, 52, 66, 82, 100, 120], gem: B.MIRE,
    grit: [8, 30, 90, 240, 600, 1400, 3200, 7000, 15000], gems: [0, 0, 3, 8, 20, 45, 90, 170, 300], show: v => `${v}` },
  { id: 'drill', icon: 'drill', name: 'BIT', values: [1, 2, 3], gem: B.LODE, grit: [400, 4000], gems: [12, 90], show: v => `MK${v}` },
  { id: 'battery', icon: 'battery', name: 'CELL', values: [60, 85, 115, 150, 200, 270, 360], gem: B.EMBER,
    grit: [20, 70, 200, 550, 1500, 4000], gems: [0, 4, 12, 30, 70, 150], show: v => `${v}` },
  { id: 'winch', icon: 'winch', name: 'WINCH', values: [1, 1.3, 1.6, 2, 2.5, 3], gem: B.FROST,
    grit: [50, 220, 800, 2600, 8000], gems: [0, 6, 20, 60, 150], show: v => `x${v}` },
  { id: 'scanner', icon: 'scanner', name: 'SCAN', values: [2, 3, 4, 5, 6], gem: B.FROST, grit: [30, 150, 700, 3000], gems: [0, 5, 25, 80], show: v => `${v}` },
  { id: 'momentum', icon: 'momentum', name: 'RAM', values: [0, 2, 4, 7, 12], gem: B.LODE, grit: [60, 300, 1200, 5000], gems: [0, 8, 30, 90], show: v => `${v}` },
  { id: 'shield', icon: 'shield', name: 'GUARD', values: [1, 0.7, 0.45, 0.25], gem: B.MIRE, grit: [100, 600, 3000], gems: [3, 20, 70], show: v => `${Math.round((1 - v) * 100)}%` },
  { id: 'bombs', icon: 'bomb', name: 'BLAST', values: [0, 1, 2, 3, 4], gem: B.EMBER, grit: [80, 400, 1600, 6000], gems: [0, 10, 40, 110], show: v => `${v}` },
];
const DIG_TIME = [0, 0, 0, 0.11, 0.2, 0.11, 0.2, 0.36, 0.6, 0.11, 0, 0.09, 0.2];
const DIG_COST = [0, 0, 0, 1, 1, 1, 1, 2, 3, 1, 0, 1, 1];
const SPEED = [1, 1.25, 1.55, 1.9];

const compact = n => n < 1000 ? `${Math.floor(n)}` : n < 10000 ? `${(Math.floor(n / 100) / 10).toFixed(1)}K` : n < 1e6 ? `${Math.floor(n / 1000)}K` : `${(Math.floor(n / 1e5) / 10).toFixed(1)}M`;
const b64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s, into) => { const raw = atob(s); for (let i = 0; i < into.length && i < raw.length; i++) into[i] = raw.charCodeAt(i); };

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.world = new World();
    this.W = 180; this.H = 320;
    this.time = 0;
    this.input = { held: null, queued: null, id: null, ax: 0, ay: 0, px: 0, py: 0, keys: new Set() };
    this.effects = []; this.popups = []; this.hauls = []; this.clouds = []; this.sparks = new Map(); this.lavaVol = new Map(); this.frostOpen = [];
    this.shake = 0; this.twang = 0; this.coreFlash = 0; this.banner = null; this.shop = false; this.confirmReset = 0;
    this.buttons = [];
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
    this.effects.length = 0; this.popups.length = 0; this.hauls.length = 0; this.clouds.length = 0; this.sparks.clear(); this.lavaVol.clear(); this.frostOpen.length = 0;
    w.lava.fill(0); w.dugAt.fill(0); w.reached.fill(0);
    w.reach(this.val('scanner'));
    this.drill = { x: C + 2, y: C + 1, fx: C + 2, fy: C + 1, dir: 0, mode: 'idle', t: 0, wait: 0, bore: 0, target: -1, dur: 0, route: null, at: 0, site: -1 };
    this.charge = this.val('battery'); this.bombs = this.val('bombs');
    this.cam = { x: this.drill.fx * T + 8, y: this.drill.fy * T + 8 };
    this.retether();
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
    Object.assign(this.input, { id, ax: x, ay: y, px: x, py: y, held: null, lock: false });
  }
  pointerMove(id, x, y) {
    const inp = this.input;
    if (inp.id !== id || inp.lock) return;
    inp.px = x; inp.py = y;
    let dx = x - inp.ax, dy = y - inp.ay;
    const far = Math.hypot(dx, dy);
    if (far < 9) return;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
    if (dir !== inp.held) { inp.held = dir; inp.queued = dir; }
    // The origin trails the finger, so turning takes a short stroke from wherever the thumb is.
    if (far > 20) { inp.ax = x - dx / far * 20; inp.ay = y - dy / far * 20; }
  }
  pointerUp(id) { if (this.input.id === id) { this.input.id = null; this.input.held = null; } }
  key(code, down) {
    const dir = { ArrowRight: 0, KeyD: 0, ArrowDown: 1, KeyS: 1, ArrowLeft: 2, KeyA: 2, ArrowUp: 3, KeyW: 3 }[code];
    const inp = this.input;
    if (dir !== undefined) {
      if (down) { unlock(); if (this.shop) this.shop = false; if (!inp.keys.has(code)) { inp.held = dir; inp.queued = dir; } inp.keys.add(code); }
      else { inp.keys.delete(code); if (inp.held === dir && inp.id === null) inp.held = null; }
      return true;
    }
    if (!down) return false;
    unlock();
    if (code === 'Space' || code === 'KeyR') { this.recallButton(); return true; }
    if (code === 'KeyB' || code === 'KeyE') { this.blast(); return true; }
    if (code === 'KeyU' || code === 'Enter') { if (this.atCore) this.shop = !this.shop; return true; }
    if (code === 'Escape') { this.shop = false; return true; }
    return false;
  }

  // ------------------------------------------------------------ the tether
  // After any change to the ground or the drill's cell: where the tether lies and how it is drawn.
  retether() {
    const w = this.world;
    this.pathCells = w.path(this.di);
    // Drawn as a real string: straight, bending only round the corners it is pulled against.
    this.pathPts = taut(w, this.drill.x, this.drill.y, this.val('tether')) ?? [...this.pathCells.map(i => [i % N + 0.5, ((i / N) | 0) + 0.5]), [C + 0.5, C + 0.5]];
    this.used = Math.max(0, w.dist[this.di]);
    this.foresee();
  }
  // The last cut glows: for each side of the drill, the ground that would come free if that cell were cut.
  foresee() {
    const w = this.world, d = this.drill, tier = this.val('drill'), L = this.val('tether');
    this.preview = [];
    if (w.dist[this.di] + 1 > L) return;
    for (let dir = 0; dir < 4; dir++) {
      const i = (d.y + DY[dir]) * N + d.x + DX[dir], k = w.kind[i];
      if (k === K.EMPTY || HARD[k] > tier) continue;
      w.kind[i] = K.EMPTY; w.dist[i] = 1;
      const found = w.islands();
      w.kind[i] = k; w.dist[i] = -1;
      if (found.length) this.preview.push({ dir, i, cells: found.flat() });
    }
  }
  // After the ground changed: what the tether reaches, what came free, where the tether lies.
  changed() {
    const w = this.world;
    w.reach(this.val('scanner'));
    const islands = w.islands();
    if (islands.length) { for (const cells of islands) this.haul(cells); w.reach(this.val('scanner')); }
    this.retether();
  }

  // ------------------------------------------------------------ moving and cutting
  attempt(dir, fromInput) {
    const w = this.world, d = this.drill, L = this.val('tether');
    d.dir = dir;
    if (fromInput) { d.bore = this.val('momentum'); this.S.stats.moves++; }
    const nx = d.x + DX[dir], ny = d.y + DY[dir], ni = ny * N + nx, k = w.at(nx, ny);
    if (k === K.EMPTY) {
      if (w.lava[ni] > 0) { this.bump(); sfx.hiss(); return; }
      // Heading away from the core the drill snaps to the next ground; any other way it goes a cell at a time.
      const away = this.atCore || (d.x - C) * DX[dir] + (d.y - C) * DY[dir] > 0;
      let x = d.x, y = d.y, steps = 0;
      for (;;) {
        const i = (y + DY[dir]) * N + x + DX[dir];
        if (w.kind[i] !== K.EMPTY || w.lava[i] > 0 || w.dist[i] < 0 || w.dist[i] > L) break;
        x += DX[dir]; y += DY[dir]; steps++;
        if (!away || (x === C && y === C)) break;      // the middle of the core is a place to stop
      }
      if (!steps) { this.taut(nx, ny); return; }
      d.x = x; d.y = y; d.mode = 'slide'; d.speed = away ? 24 : 15; d.wait = away || w.at(x + DX[dir], y + DY[dir]) !== K.EMPTY ? 0.13 : 0;
      sfx.slide(steps);
      this.retether(); this.arrive();
      return;
    }
    const hard = HARD[k];
    if (hard > this.val('drill')) {
      this.bump(); sfx.clink();
      this.effect('sparks', 'sparks', (d.x + 0.5 + DX[dir] * 0.5) * T, (d.y + 0.5 + DY[dir] * 0.5) * T);
      if (hard < 99) this.popup(nx, ny, `MK${hard}`, '#ff8a6a', 'lock');
      d.bore = 0;
      return;
    }
    if (w.dist[this.di] + 1 > L) { this.taut(nx, ny); return; }
    if (this.charge <= 0) { this.bump(); sfx.deny(); this.popup(nx, ny, 'EMPTY', '#ffe14a', 'bolt'); this.nudge = 2.5; return; }
    d.mode = 'dig'; d.target = ni; d.t = 0;
    d.dur = DIG_TIME[k] / SPEED[this.S.lv.drill] * (fromInput ? 1 : 0.55);
  }
  bump() { const d = this.drill; d.mode = 'bump'; d.t = 0; }
  // The tether is all paid out: say so on the cell that was refused, and point at the way home.
  taut(x, y) { this.bump(); this.twang = 0.45; sfx.twang(); this.drill.bore = 0; this.nudge = 2.5; if (!this.popups.some(p => p.icon === 'tether')) this.popup(x, y, 'TETHER OUT', '#ff7a5a', 'tether'); }
  arrive() {
    if (this.atCore && (this.charge < this.val('battery') || this.bombs < this.val('bombs'))) {
      this.charge = this.val('battery'); this.bombs = this.val('bombs');
      sfx.dock(); this.coreFlash = 0.25; this.save();
    }
  }
  finishDig() {
    const w = this.world, d = this.drill, i = d.target, x = i % N, y = (i / N) | 0, k = w.kind[i], b = w.biome[i];
    this.charge = Math.max(0, this.charge - DIG_COST[k]);
    w.kind[i] = K.EMPTY;
    if (base(b) === B.FROST) { w.dugAt[i] = this.time; this.frostOpen.push(i); }
    const tough = k === K.DENSE || k === K.ORE_B || k === K.BASALT ? 2 : HARD[k] + (HARD[k] > 1 ? 1 : 0);
    sfx.dig(tough);
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
    if (enter) { d.x = x; d.y = y; d.mode = 'slide'; d.speed = 30; d.wait = 0; } else d.mode = 'idle';
    this.changed();
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
    this.hauls.push({ sprites, t: 0, n, grit, gems, left: grit, paid: 0, lift, end: lift + spread + 0.45, relic });
    cx = (cx / n + 0.5) * T; cy = (cy / n + 0.5) * T;
    this.effect('haul', 'impact', cx, cy);
    if (n >= 20) this.effect('bank', 'area', cx, cy);
    this.shake = Math.max(this.shake, Math.min(9, 2.5 + n * 0.12));
    this.hitstop = Math.min(0.16, 0.05 + n * 0.002);
    sfx.crack(n);
    const title = relic >= 0 ? 'RELIC!' : n >= 200 ? 'COLOSSAL!' : n >= 80 ? 'HUGE HAUL!' : n >= 30 ? 'BIG HAUL!' : n >= 10 ? 'NICE CUT!' : 'HAUL';
    this.banner = { title, n, mult, grit, gems, t: 0, life: 2.2 + Math.min(1.2, n * 0.01) };
    if (relic >= 0) { S.relics[relic] = 1; sfx.relic(); if (S.relics.every(Boolean) && !S.won) { S.won = true; this.wonAt = this.time; } }
    this.drill.bore = 0; this.homeAfter = true;
  }
  updateHauls(dt) {
    for (const h of this.hauls) {
      h.t += dt;
      let arrived = 0;
      for (const s of h.sprites) {
        if (!s.done && h.t >= s.go + 0.42) {
          s.done = true; arrived++;
          if (s.gem) this.pending.gems[s.gem] = Math.max(0, this.pending.gems[s.gem] - s.gems);
        }
      }
      if (arrived) {
        h.paid += arrived;
        const left = Math.round(h.grit * (1 - h.paid / h.n));
        this.pending.grit = Math.max(0, this.pending.grit - (h.left - left)); h.left = left;
        this.coreFlash = 0.12;
        if (this.time - (this.lastTick ?? 0) > 0.045) { this.lastTick = this.time; sfx.tick(Math.floor(h.paid / Math.max(1, h.n / 14))); }
        if (h.paid >= h.n) {
          sfx.banked(h.n);
          this.effect('bank', 'area', (C + 0.5) * T, (C + 0.5) * T);
          this.save();
        }
      }
    }
    if (this.hauls.length && this.hauls.every(h => h.t > h.end)) {
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
      w.kind[i] = K.EMPTY; w.lava[i] = 9; this.lavaVol.set(i, 5);
      sfx.hiss(); this.effect('steam', 'smoke-puff', (x + 0.5) * T, (y + 0.5) * T);
      if (direct) { this.drain(8); this.shake = 5; }
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
    if (Math.max(Math.abs(d.x - x), Math.abs(d.y - y)) <= 3) { this.drain(16); this.shake = Math.max(this.shake, 5); this.twang = 0.3; }
    for (let v = -3; v <= 3; v++) for (let u = -3; u <= 3; u++) {
      const j = (y + v) * N + x + u;
      if ((u || v) && w.kind[j] === K.HAZARD && base(w.biome[j]) === B.LODE && !this.sparks.has(j)) this.sparks.set(j, { fuse: 0.3 + cellHash(u, v, 7) * 0.3, cool: 0 });
    }
  }
  drain(amount) {
    if (this.charge <= 0) return;
    this.charge = Math.max(0, this.charge - amount * this.val('shield'));
    this.hurt = 0.3;
  }
  updateHazards(dt) {
    const w = this.world, d = this.drill;
    let moved = false;
    // Lava: a pocket pours a stream as long as its volume down the open ground, burns what it touches, then sets.
    this.lavaTick = (this.lavaTick ?? 0) + dt;
    const flow = this.lavaTick >= 0.26;
    if (flow) this.lavaTick = 0;
    let onTether = 0, beside = 0;
    for (let i = 0; i < w.lava.length; i++) {
      if (w.lava[i] <= 0) continue;
      const x = i % N, y = (i / N) | 0;
      if (w.onPath[i]) onTether++;
      if (Math.abs(d.x - x) + Math.abs(d.y - y) === 1) beside++;
      if (flow) {
        const vol = this.lavaVol.get(i) ?? 1, start = (cellHash(x, y, (this.time * 10) | 0) * 4) | 0;
        for (let s = 0; s < 4; s++) {
          const j = (y + DY[(s + start) % 4]) * N + x + DX[(s + start) % 4];
          if (w.kind[j] === K.HAZARD && base(w.biome[j]) === B.EMBER) { this.trigger(j, B.EMBER, false); moved = true; continue; }
          if (vol > 1 && w.kind[j] === K.EMPTY && w.lava[j] <= 0 && j !== this.di && w.seen[j] && !onCore(j % N, (j / N) | 0)) {
            w.lava[j] = 8; this.lavaVol.set(j, vol - 1); this.lavaVol.set(i, 1);
            break;
          }
        }
      }
      w.lava[i] -= dt;
      if (w.lava[i] <= 0) {
        w.lava[i] = 0; this.lavaVol.delete(i);
        if (!w.onPath[i] && Math.abs(d.x - x) + Math.abs(d.y - y) > 1) {
          w.kind[i] = K.BASALT; moved = true;
          this.effect('steam', 'smoke-puff', (x + 0.5) * T, (y + 0.5) * T);
        }
      }
    }
    if (onTether || beside) { this.drain((onTether * 3 + beside * 4) * dt); this.burning = 0.2; }
    // Spores: a burst pod hangs a cloud that saps the cell, then moss closes the ground round it.
    for (const c of this.clouds) {
      c.t += dt;
      if (Math.max(Math.abs(d.x - c.x), Math.abs(d.y - c.y)) <= 2) this.drain(5 * dt);
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

  // ------------------------------------------------------------ recall, blast, shop
  recallButton() {
    const d = this.drill, w = this.world;
    if (d.mode === 'recall' || d.mode === 'launch') return;
    if (!this.atCore) { this.recall(); return; }
    // At the core the same button sends the drill back out to where it was called in from.
    const site = d.site;
    if (site >= 0 && w.kind[site] === K.EMPTY && w.dist[site] > 0 && w.dist[site] <= this.val('tether') && w.lava[site] <= 0) {
      d.x = site % N; d.y = (site / N) | 0; d.site = -1; this.shop = false;
      this.retether();
      d.route = this.pathPts.slice(0, -1).reverse().map(([x, y]) => [x - 0.5, y - 0.5]); d.at = 0; d.mode = 'launch';
      sfx.recall();
    } else sfx.deny();
  }
  recall() {
    const d = this.drill;
    if (this.atCore || d.mode === 'recall') return;
    const cells = this.pathCells, w = this.world;
    d.site = this.di;
    // The drill rides the string in, to the cell beside the core that the string passes through.
    const [bx, by] = this.pathPts[this.pathPts.length - 2];
    let home = cells[cells.length - 1], best = Infinity;
    for (let i = 0; i < w.dist.length; i++) {
      if (w.dist[i] !== 0) continue;
      const far = Math.hypot(i % N + 0.5 - bx, ((i / N) | 0) + 0.5 - by);
      if (far < best && sight(w, bx, by, i % N + 0.5, ((i / N) | 0) + 0.5)) { best = far; home = i; }
    }
    d.route = [...this.pathPts.slice(1, -1).map(([x, y]) => [x - 0.5, y - 0.5]), [home % N, (home / N) | 0]]; d.at = 0; d.mode = 'recall';
    d.x = home % N; d.y = (home / N) | 0;
    this.S.stats.recalls++;
    this.input.queued = null;
    this.retether(); sfx.recall();
  }
  blast() {
    const w = this.world, d = this.drill;
    if (this.bombs <= 0 || d.mode === 'recall' || d.mode === 'launch') { if (this.val('bombs')) sfx.deny(); return; }
    const r = this.S.lv.bombs >= 3 ? 2 : 1, tier = this.val('drill') + 1;
    this.bombs--;
    for (let v = -r; v <= r; v++) for (let u = -r; u <= r; u++) {
      const i = (d.y + v) * N + d.x + u;
      if (w.kind[i] !== K.EMPTY && HARD[w.kind[i]] <= tier) {
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
    if (u.id === 'battery') this.charge = this.val('battery');
    if (u.id === 'bombs') this.bombs = this.val('bombs');
    if (u.id === 'scanner') { this.world.reached.fill(0); this.world.reach(this.val('scanner')); }
    this.bought = { id: u.id, t: 0.5 };
    this.retether(); this.save();
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
    this.nudge = Math.max(0, (this.nudge ?? 0) - dt);

    if (!this.shop) {
      // What is drawn follows the drill's cell.
      if (d.mode === 'slide') {
        const tx = d.x, ty = d.y, dx = tx - d.fx, dy = ty - d.fy, far = Math.hypot(dx, dy), step = d.speed * dt;
        if (far <= step) { d.fx = tx; d.fy = ty; d.mode = 'idle'; if (d.speed < 26) sfx.thud(); } else { d.fx += dx / far * step; d.fy += dy / far * step; }
      } else if (d.mode === 'dig') {
        d.t += dt;
        if (((d.t * 30) | 0) !== (((d.t - dt) * 30) | 0) && d.dur > 0.15) sfx.grind();
        if (d.t >= d.dur) this.finishDig();
      } else if (d.mode === 'bump') {
        d.t += dt; if (d.t > 0.14) d.mode = 'idle';
      } else if (d.mode === 'recall' || d.mode === 'launch') {
        let step = 70 * dt;
        while (step > 0 && d.at < d.route.length) {
          const [tx, ty] = d.route[d.at], dx = tx - d.fx, dy = ty - d.fy, far = Math.hypot(dx, dy);
          if (dx || dy) d.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
          if (far <= step) { d.fx = tx; d.fy = ty; step -= far; d.at++; } else { d.fx += dx / far * step; d.fy += dy / far * step; step = 0; }
        }
        if (d.at >= d.route.length) { const was = d.mode; d.mode = 'idle'; d.route = null; if (was === 'recall') { this.arrive(); sfx.thud(); } }
      }
      if (d.mode === 'idle') {
        d.wait -= dt;
        if (this.homeAfter) { this.homeAfter = false; if (!this.atCore) { Object.assign(inp, { queued: null, held: null, lock: true }); inp.keys.clear(); this.recall(); } }
        else if (d.next) { d.next = false; this.attempt(d.dir, false); }
        else if (inp.queued !== null) { const q = inp.queued; inp.queued = null; this.attempt(q, true); }
        else if (inp.held !== null && d.wait <= 0) this.attempt(inp.held, true);
        else if (this.charge <= 0 && !this.atCore) { this.emptyFor = (this.emptyFor ?? 0) + dt; if (this.emptyFor > 0.7) { this.emptyFor = 0; sfx.low(); this.recall(); } }
      }
      this.updateHazards(dt);
      this.updateHauls(dt);
      this.saveTick = (this.saveTick ?? 0) + dt;
      if (this.saveTick > 15) { this.saveTick = 0; this.save(); }
    }
    for (const e of this.effects) e.t += dt * 1000;
    this.effects = this.effects.filter(e => e.t < duration(e.sheet, e.animation));
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter(p => p.t < 0.9);
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.life) this.banner = null; }
    // The camera eases after the drill.
    const k = 1 - Math.exp(-dt * 11);
    this.cam.x += (d.fx * T + 8 - this.cam.x) * k; this.cam.y += (d.fy * T + 8 - this.cam.y) * k;
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
    const x0 = Math.max(0, Math.floor(ox / T)), y0 = Math.max(0, Math.floor(oy / T)), x1 = Math.min(N - 1, Math.floor((ox + W) / T)), y1 = Math.min(N - 1, Math.floor((oy + H) / T));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * N + x;
      const k = w.kind[i], b = w.biome[i], px = x * T - ox, py = y * T - oy;
      const floors = sheets[`${BIOME_NAMES[b]}-floor`].tiles[255];
      if (!w.seen[i]) {
        // Ground the scanner has not reached: only whose it is shows, dimly.
        if (k !== K.BEDROCK) { ctx.globalAlpha = 0.5; draw(ctx, `${BIOME_NAMES[b]}-floor`, floors[(cellHash(x, y, 1) * floors.length) | 0], px, py); ctx.globalAlpha = 1; }
        continue;
      }
      let m = 255;
      if (k !== K.EMPTY && k !== K.CORE) m = w.mask(x, y);
      if (m !== 255 || k === K.EMPTY || k === K.CORE) draw(ctx, `${BIOME_NAMES[b]}-floor`, floors[(cellHash(x, y, 1) * floors.length) | 0], px, py);
      if (k === K.EMPTY) {
        if (w.lava[i] > 0) draw(ctx, 'lava', frameAt('lava', `lava-${w.lavaMask(x, y)}`, now + cellHash(x, y, 2) * 300), px, py);
        else if (w.dugAt[i] > 0 && this.time - w.dugAt[i] > 22 && !w.onPath[i]) {
          // Ice about to close over a cut: a rim of it creeps in first.
          ctx.globalAlpha = Math.min(0.8, (this.time - w.dugAt[i] - 22) / 8);
          draw(ctx, 'ice', sheets.ice.tiles[0][0], px, py);
          ctx.globalAlpha = 1;
        }
        continue;
      }
      if (k === K.CORE) continue;
      const sheet = this.rockSheet(k, b), rects = sheets[sheet].tiles[m];
      draw(ctx, sheet, rects[(cellHash(x, y, 3) * rects.length) | 0], px, py);
      const over = this.overlay(k, b);
      if (over) {
        const items = this.itemSheet(b), ux = px - ((m & 4) ? 0 : 1), uy = py - ((m & 16) ? 0 : 1);
        if (over === 'hazard') {
          const s = this.sparks.get(i);
          draw(ctx, items, s && s.fuse > 0 ? (((now / 60) | 0) % 2 ? 'hazard-b' : 'hazard') : frameAt(items, 'hazard', now + cellHash(x, y, 4) * 900), ux, uy);
        } else if (over === 'relic') { const rs = `${BIOME_NAMES[DIR_BIOME[w.relicAt.indexOf(i)] ?? b]}-items`; draw(ctx, rs, frameAt(rs, 'relic', now), ux, uy); }
        else draw(ctx, items, over, ux, uy);
      }
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
    draw(ctx, 'core', this.coreFlash > 0 ? 'core-flash' : this.S.won ? 'core-c' : frameAt('core', 'idle', now), coreX, coreY);
    [[39, 20], [20, 39], [1, 20], [20, 1]].forEach(([u, v], dir) => {
      if (this.S.relics[dir]) drawScaled(ctx, `${BIOME_NAMES[DIR_BIOME[dir]]}-items`, 'relic', coreX + u, coreY + v, 8, 8);
    });
    this.drawTether(ox, oy);
    // Cut pieces on their way in.
    const hx = (C + 0.5) * T - ox, hy = (C + 0.5) * T - oy;
    for (const h of this.hauls) {
      const flash = h.t < h.lift && ((h.t * 24) | 0) % 2 === 0;
      for (const s of h.sprites) {
        if (s.done) continue;
        const u = Math.max(0, (h.t - s.go) / 0.42), e = u * u * u;
        const lift = Math.min(1, h.t / h.lift) * 3;
        let px = s.x * T - ox, py = s.y * T - oy - lift, size = T;
        if (u > 0) { px += (hx - 8 - px) * e; py += (hy - 8 - py) * e; size = Math.round(T - 7 * Math.min(1, u * 1.5)); }
        if (px < -T || py < -T || px > W || py > H) continue;
        if (u > 0 && u < 0.5) { ctx.fillStyle = '#fff6c8'; this.line(px + 8, py + 8, hx, hy, 0.25); }
        const off = (T - size) / 2;
        if (size === T) draw(ctx, s.tile[0], s.tile[1], px, py); else drawScaled(ctx, s.tile[0], s.tile[1], px + off, py + off, size, size);
        if (s.over) {
          const items = this.itemSheet(s.biome);
          const f = s.over === 'hazard' || s.over === 'relic' ? frameAt(items, s.over, 0) : s.over;
          if (size === T) draw(ctx, items, f, px, py); else drawScaled(ctx, items, f, px + off, py + off, size, size);
        }
        if (flash) { ctx.globalAlpha = 0.6; ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(px) + 2, Math.round(py) + 2, 12, 12); ctx.globalAlpha = 1; }
      }
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
    if (d.mode === 'dig') { const push = 3 + Math.sin(d.t * 70) * 1.2; dx += DX[d.dir] * push; dy += DY[d.dir] * push; }
    if (d.mode === 'bump') { const push = Math.sin(Math.min(1, d.t / 0.14) * Math.PI) * 3; dx += DX[d.dir] * push; dy += DY[d.dir] * push; }
    const busy = d.mode === 'dig' || d.mode === 'slide' || d.mode === 'recall' || d.mode === 'launch';
    draw(ctx, 'drill', busy ? frameAt('drill', dirName, now) : `${dirName}-a`, dx, dy);
    if (this.hurt > 0 && ((now / 50) | 0) % 2) { ctx.globalAlpha = 0.5; ctx.fillStyle = '#ff5a4a'; ctx.fillRect(Math.round(dx) + 3, Math.round(dy) + 3, 10, 10); ctx.globalAlpha = 1; }
    for (const e of this.effects) {
      const f = frameAt(e.sheet, e.animation, e.t);
      if (f) draw(ctx, e.sheet, f, e.x - ox - f[2] / 2, e.y - oy - f[3] / 2);
    }
    for (const p of this.popups) {
      const py = p.y - oy - p.t * 18, px = p.x - ox;
      ctx.globalAlpha = Math.min(1, (0.9 - p.t) * 4);
      if (p.icon) draw(ctx, 'icons', p.icon, px - textWidth(p.label) / 2 - 11, py - 1);
      text(ctx, p.label, px, py, p.color, 0.5);
      ctx.globalAlpha = 1;
    }
    this.drawHud(ox, oy);
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
    const { ctx } = this, d = this.drill, L = this.val('tether'), ratio = this.used / L;
    const pts = this.pathPts.map(([x, y]) => [x * T - ox, y * T - oy]);
    // The first point is the drill as drawn, the tether leaving from its tail.
    if (d.mode === 'recall' || d.mode === 'launch') {
      // On the way in or out the tether is the part of the route between the drill and the core.
      const rest = d.mode === 'recall' ? d.route.slice(d.at) : d.route.slice(0, d.at).reverse();
      pts.length = 0;
      pts.push([d.fx * T + 8 - ox, d.fy * T + 8 - oy], ...rest.map(([x, y]) => [x * T + 8 - ox, y * T + 8 - oy]), [C * T + 8 - ox, C * T + 8 - oy]);
    } else pts[0] = [d.fx * T + 8 - ox - DX[d.dir] * 5, d.fy * T + 8 - oy - DY[d.dir] * 5];
    const wob = this.twang > 0 ? Math.sin(this.time * 90) * this.twang * 5 : 0;
    const color = this.twang > 0 ? '#ff5a4a' : this.burning > 0 ? '#ff8a2a' : ratio > 0.92 ? '#ff7a5a' : ratio > 0.75 ? '#ffe14a' : '#f4ecd8';
    for (const [pass, shade] of [[1, '#16121c'], [0, color]]) {
      ctx.fillStyle = shade;
      for (let i = 0; i < pts.length - 1; i++) {
        let [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        if (Math.max(x0, x1) < -2 || Math.max(y0, y1) < -2 || Math.min(x0, x1) > this.W + 2 || Math.min(y0, y1) > this.H + 2) continue;
        if (wob && i < pts.length - 2) {
          // A plucked string: the middle of each span swings across it.
          const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, len = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / len * wob, ny = (x1 - x0) / len * wob;
          this.line(x0, y0 + pass, mx + nx, my + ny + pass); this.line(mx + nx, my + ny + pass, x1, y1 + pass);
        } else this.line(x0, y0 + pass, x1, y1 + pass);
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
      const big = b.n >= 10 ? 2 : 1;
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
    text(ctx, compact(S.grit - this.pending.grit), 18, 6, '#ffe14a');
    const gw = (W - 30) / 4;
    for (let g = 1; g < 5; g++) {
      const gx = Math.round(6 + (g - 1) * gw), have = S.gems[g] - this.pending.gems[g];
      ctx.globalAlpha = S.gems[g] > 0 ? 1 : 0.35;
      draw(ctx, 'icons', GEM_ICON[g], gx, 17);
      text(ctx, compact(have), gx + 12, 18, GEM_COLOR[g]);
      ctx.globalAlpha = 1;
    }
    const bw = Math.floor((W - 12 - 26 - 8) / 2), max = this.val('battery'), L = this.val('tether');
    const low = this.charge / max < 0.25 && !this.atCore;
    this.bar(6, 29, bw, 'bolt', this.charge / max, low && ((now / 200) | 0) % 2 ? '#ff5a4a' : '#ffe14a', this.hurt > 0);
    this.bar(6 + bw + 14, 29, bw, 'tether', 1 - this.used / L, this.used / L > 0.92 ? '#ff7a5a' : '#f4ecd8', this.twang > 0);
    text(ctx, `${L - this.used}`, W - 6, 30, this.twang > 0 ? '#ff7a5a' : '#f4ecd8', 1);
    draw(ctx, 'ui', isMuted() ? 'mute' : 'sound', W - 21, 2);
    this.button(W - 24, 0, 24, 20, () => { setMuted(!isMuted()); sfx.tap(); });
    // Bottom: recall (or, at the core, back out), the blast, and the shop.
    const by = H - 46;
    const canLaunch = this.atCore && d.site >= 0;
    if (!this.atCore || canLaunch) {
      const pulse = (low || this.nudge > 0) && ((now / 250) | 0) % 2;
      slice9(ctx, 'ui', pulse ? 'button-down' : canLaunch ? 'button-max' : 'panel', W - 38, by, 34, 34);
      draw(ctx, 'ui', 'recall', W - 29, by + 9);
      this.button(W - 44, by - 6, 44, 46, () => this.recallButton());
      if (low && S.stats.recalls === 0) draw(ctx, 'ui', 'hand', W - 30, by + 16 + Math.round(Math.sin(now / 150) * 3));
    }
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
    // The first move, shown and not told: a hand drags right, toward the piece that is all but cut free.
    if (S.stats.hauls === 0 && S.stats.moves < 3 && !this.shop && this.input.id === null) {
      const u = (now % 1400) / 1400, hx = W / 2 - 22 + Math.min(1, u * 1.6) * 44, hy = H * 0.7;
      ctx.globalAlpha = u < 0.1 ? u * 10 : u > 0.8 ? (1 - u) * 5 : 1;
      ctx.fillStyle = '#ffffff';
      for (let s = 0; s < 5; s++) if (hx - s * 7 > W / 2 - 22) ctx.fillRect(Math.round(hx - s * 7) + 5, Math.round(hy) - 2, 3, 2);
      draw(ctx, 'ui', 'hand', hx, hy);
      ctx.globalAlpha = 1;
      draw(ctx, 'logo', 'logo', W / 2 - 66, 52);
    }
    // Where the thumb is steering from.
    if (this.input.id !== null && !this.shop) {
      const { ax, ay, px, py } = this.input;
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(ax) - 1, Math.round(ay) - 1, 3, 3);
      this.line(ax, ay, px, py, 0.5);
      ctx.globalAlpha = 1;
    }
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
    ctx.globalAlpha = 0.6; ctx.fillStyle = '#07060b'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    const pw = Math.min(W - 8, 200), px = Math.round((W - pw) / 2), rh = Math.max(22, Math.min(28, Math.floor((H - 100) / UPGRADES.length)));
    const ph = 22 + rh * UPGRADES.length + 22, py = Math.max(44, Math.round((H - ph) / 2));
    slice9(ctx, 'ui', 'panel', px, py, pw, ph);
    this.button(px, py, pw, ph, () => {});
    text(ctx, 'UPGRADES', px + 8, py + 7, '#ffe14a');
    text(ctx, 'x', px + pw - 12, py + 6, '#ffffff');
    this.buttons.unshift({ x: px + pw - 24, y: py, w: 24, h: 22, act: () => { this.shop = false; sfx.tap(); } });
    UPGRADES.forEach((u, n) => {
      const y = py + 20 + n * rh, c = this.cost(u), can = this.canBuy(u), lit = this.bought?.id === u.id;
      slice9(ctx, 'ui', lit ? 'button-down' : !c ? 'button-max' : can ? 'button' : 'button-off', px + 4, y, pw - 8, rh - 1);
      draw(ctx, 'upgrades', u.icon, px + 9, y + Math.floor((rh - 13) / 2));
      text(ctx, u.name, px + 25, y + 2, '#ffffff');
      const l = S.lv[u.id];
      text(ctx, c ? `${u.show(u.values[l])}>${u.show(u.values[l + 1])}` : `${u.show(u.values[l])} MAX`, px + 25, y + rh - 12, c ? '#bfe6ff' : '#ffe14a');
      if (c) {
        const two = c.gems > 0, y1 = y + (two ? 2 : Math.floor((rh - 11) / 2));
        draw(ctx, 'icons', 'grit', px + pw - 18, y1 - 1);
        text(ctx, compact(c.grit), px + pw - 20, y1, S.grit >= c.grit ? '#ffe14a' : '#ff7a5a', 1);
        if (two) {
          draw(ctx, 'icons', GEM_ICON[u.gem], px + pw - 18, y + rh - 13);
          text(ctx, `${c.gems}`, px + pw - 20, y + rh - 12, S.gems[u.gem] >= c.gems ? GEM_COLOR[u.gem] : '#ff7a5a', 1);
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
