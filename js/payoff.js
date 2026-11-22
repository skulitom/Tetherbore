// The haul at desktop scale: what the phone shows in a flash and a banner is, on a monitor, a moment with a weight of
// its own. Loaded only there (js/main.js, a dynamic import), and only ever told things: the game calls it where a haul
// lets go (`haul`), where its rubble lands at the core (`land`) and where the last of it is home (`banked`), and draws
// and steps it. With no `game.payoff`, the web game, none of this exists.
//
//   the view    kicked toward the core as the ground lets go, and sprung back (`dx`, `dy`, read by `render`), with a
//               short punch of the whole picture (the two canvases scaled together, by the browser)
//   particles   the haul's own rubble thrown out of where it lay, sparks, and a shock ring; a fountain at the core as
//               it comes in
//   sound       a blow under what the game already plays, and a stamp when the count is done (js/audio.js)
//   the count   what the haul pays, large, running up as the rubble lands, stamped when it is all home, then flown down
//               to the grit on the bar. Hauls that overlap add to one count.
//
// It changes nothing of the game: it writes no field of it but the canvases' style, takes no number from Math.random
// (`rnd` is its own) and keeps everything it draws in a pool made once.
import { text, textWidth } from './atlas.js';
import { sfx } from './audio.js';
import { compact, UI } from './drawing.js';
import { C } from './world.js';

const T = 16, HX = (C + 0.5) * T, HY = (C + 0.5) * T;
const POOL = 520, RINGS = 8, GOLD = '#ffe14a', PALE = '#fff6c8', SPARKS = [GOLD, PALE, '#ffb347', '#ffffff'];
// The view's spring, how hard a haul kicks it and punches it in, at the largest; how long the count holds once stamped
// and how long it takes to fly to the bar.
const STIFF = 240, DAMP = 20, KICK = 9, PUNCH = 0.035, HOLD = 1.0, FLY = 0.32;
// How big a haul is, from 0 to 1, for everything that grows with it: a dozen cells is about a third, a thousand all.
const weigh = n => Math.min(1, Math.log2(1 + n) / 10);

export class Payoff {
  // `quiet`: for the title screen's view (js/title.js), which has the show of a haul and no count.
  constructor(game, { quiet = false } = {}) {
    this.game = game; this.quiet = quiet; this.biasX = 0; this.sx = 0; this.sy = 0;
    this.dx = 0; this.dy = 0; this.vx = 0; this.vy = 0; this.punch = 0; this.punched = false;
    this.parts = Array.from({ length: POOL }, () => ({ x: 0, y: 0, vx: 0, vy: 0, t: 1, life: 0, size: 1, c: GOLD, fall: 0, streak: false }));
    this.head = 0;
    this.rings = Array.from({ length: RINGS }, () => ({ x: 0, y: 0, t: 1, life: 0, reach: 0, c: GOLD }));
    this.ringAt = 0;
    this.seed = 0x2f6e2b1;
    // The count: what it is counting to, what has landed of it, the biggest haul in it, and its stages (`at` is the
    // time since it was stamped, negative until then).
    this.count = { on: false, target: 0, paid: 0, n: 0, stamped: false, at: 0, pop: 0, said: '', shown: -1, y: null };
  }
  rnd() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  part(x, y, vx, vy, life, size, c, fall, streak) {
    const p = this.parts[this.head];
    this.head = (this.head + 1) % POOL;
    p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.t = 0; p.life = life; p.size = size; p.c = c; p.fall = fall; p.streak = streak;
  }
  ring(x, y, reach, life, c) {
    const r = this.rings[this.ringAt];
    this.ringAt = (this.ringAt + 1) % RINGS;
    r.x = x; r.y = y; r.t = 0; r.life = life; r.reach = reach; r.c = c;
  }

  // ---- what the game tells it
  // A haul of a dozen cells or more has let go, about (cx, cy) in the world's pixels.
  haul(h, said, cx, cy) {
    const k = weigh(h.n), toX = HX - cx, toY = HY - cy, far = Math.hypot(toX, toY) || 1, kick = 2 + KICK * k;
    this.vx += toX / far * kick * 14; this.vy += toY / far * kick * 14;
    this.punch = Math.max(this.punch, 0.008 + PUNCH * k);
    // The ground's own colours thrown out of where it lay, the heavy pieces falling; sparks fast and straight.
    const rubble = Math.round(36 + 150 * k), sprites = h.sprites;
    for (let n = 0; n < rubble; n++) {
      const s = sprites[(this.rnd() * sprites.length) | 0], a = this.rnd() * 6.283, v = 40 + this.rnd() * (70 + 180 * k), colours = s.debris?.length ? s.debris : SPARKS;
      this.part((s.x + this.rnd()) * T, (s.y + this.rnd()) * T, Math.cos(a) * v, Math.sin(a) * v - 30, 0.5 + this.rnd() * (0.5 + 0.6 * k), this.rnd() < 0.3 ? 3 : 2, colours[(this.rnd() * colours.length) | 0], 150, false);
    }
    const sparks = Math.round(20 + 70 * k);
    for (let n = 0; n < sparks; n++) {
      const a = this.rnd() * 6.283, v = 140 + this.rnd() * (120 + 260 * k);
      this.part(cx, cy, Math.cos(a) * v, Math.sin(a) * v, 0.22 + this.rnd() * 0.4, 1, SPARKS[n % SPARKS.length], 0, true);
    }
    this.ring(cx, cy, 34 + 150 * k, 0.45 + 0.3 * k, PALE);
    if (k > 0.5) this.ring(cx, cy, 60 + 220 * k, 0.7 + 0.35 * k, GOLD);
    sfx.thump?.(h.n);
    if (this.quiet) return;
    const c = this.count;
    if (!c.on || c.stamped) { c.target = 0; c.paid = 0; c.n = 0; c.shown = -1; c.y = null; }
    c.on = true; c.stamped = false; c.at = 0; c.pop = 1;
    c.target += h.grit; c.n = Math.max(c.n, h.n);
  }
  // `arrived` more of haul `h`'s bits have dropped into the core.
  land(h, arrived) {
    if (h.light) return;
    const c = this.count;
    if (c.on && !c.stamped) c.paid = Math.min(c.target, c.paid + h.grit * arrived / h.total);
    const fountain = Math.min(6, arrived + 1);
    for (let n = 0; n < fountain; n++) {
      const a = -Math.PI / 2 + (this.rnd() - 0.5) * 2.2, v = 70 + this.rnd() * 110;
      this.part(HX + (this.rnd() - 0.5) * 18, HY + (this.rnd() - 0.5) * 18, Math.cos(a) * v, Math.sin(a) * v, 0.4 + this.rnd() * 0.5, this.rnd() < 0.3 ? 2 : 1, SPARKS[n % 2], 170, false);
    }
  }
  // The last of `h` is home: if nothing else is still coming, the count is stamped.
  banked(h) {
    if (h.light) return;
    const c = this.count;
    if (!c.on || c.stamped || this.game.hauls.some(o => !o.light && o.doneAt === undefined)) return;
    c.paid = c.target; c.stamped = true; c.at = 0; c.pop = 1;
    const k = weigh(c.n);
    this.ring(HX, HY, 40 + 110 * k, 0.5 + 0.2 * k, GOLD);
    for (let n = 0; n < 24 + 40 * k; n++) { const a = this.rnd() * 6.283, v = 50 + this.rnd() * 170; this.part(HX, HY, Math.cos(a) * v, Math.sin(a) * v, 0.4 + this.rnd() * 0.5, 2, SPARKS[n % SPARKS.length], 60, false); }
    sfx.stamp?.(c.n);
  }

  // ---- its time (`Game.update`, after everything; a beat of stillness slows it as it slows the game)
  step(dt) {
    this.vx += (-STIFF * this.sx - DAMP * this.vx) * dt; this.vy += (-STIFF * this.sy - DAMP * this.vy) * dt;
    this.sx += this.vx * dt; this.sy += this.vy * dt;
    if (Math.abs(this.sx) + Math.abs(this.sy) + Math.abs(this.vx) + Math.abs(this.vy) < 0.02) this.sx = this.sy = this.vx = this.vy = 0;
    this.dx = this.sx + this.biasX; this.dy = this.sy;
    if (this.punch > 0 && !this.quiet) { this.punch = this.punch < 0.0008 ? 0 : this.punch * Math.exp(-dt * 11); this.lens(); }
    for (let i = 0; i < POOL; i++) {
      const p = this.parts[i];
      if (p.t >= p.life) continue;
      p.t += dt; p.vy += p.fall * dt; p.vx *= 1 - 1.4 * dt; p.vy *= 1 - 1.4 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = 0; i < RINGS; i++) if (this.rings[i].t < this.rings[i].life) this.rings[i].t += dt;
    const c = this.count;
    if (!c.on) return;
    c.pop = Math.max(0, c.pop - dt * 5);
    if (c.stamped && (c.at += dt) > HOLD + FLY) { c.on = false; this.game.counted = Math.max(this.game.counted, 0.3); }
  }
  // The whole picture a little larger for a moment: both canvases, so that the tether stays on the ground.
  lens() {
    const { canvas, over } = this.game, how = this.punch > 0 ? `scale(${(1 + this.punch).toFixed(4)})` : '';
    if (canvas.style) canvas.style.transform = how;
    if (over?.style) over.style.transform = how;
  }

  // ---- drawn over the dark, under what is called out (`render`)
  draw(ctx, ox, oy) {
    const { W, H } = this.game;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < RINGS; i++) {
      const r = this.rings[i];
      if (r.t >= r.life) continue;
      const u = r.t / r.life, rad = r.reach * (1 - (1 - u) * (1 - u)), n = Math.max(20, (rad * 1.3) | 0), x = r.x - ox, y = r.y - oy, thick = u < 0.5 ? 2 : 1;
      ctx.globalAlpha = (1 - u) * 0.8; ctx.fillStyle = r.c;
      for (let a = 0; a < n; a++) { const px = Math.round(x + Math.cos(a / n * 6.283) * rad), py = Math.round(y + Math.sin(a / n * 6.283) * rad); if (px >= 0 && py >= 0 && px < W && py < H) ctx.fillRect(px, py, thick, thick); }
    }
    for (let i = 0; i < POOL; i++) {
      const p = this.parts[i];
      if (p.t >= p.life) continue;
      const px = Math.round(p.x - ox), py = Math.round(p.y - oy);
      if (px < -8 || py < -8 || px > W + 8 || py > H + 8) continue;
      ctx.globalAlpha = Math.min(1, (1 - p.t / p.life) * 1.8); ctx.fillStyle = p.c;
      if (p.streak) {
        // A spark drawn back along its way, as a line of whole pixels.
        const sp = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / sp, uy = p.vy / sp, len = Math.min(9, sp * 0.03);
        for (let n = 0; n < len; n++) ctx.fillRect(Math.round(px - ux * n), Math.round(py - uy * n), 1, 1);
      } else ctx.fillRect(px, py, p.size, p.size);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    if (this.count.on && !this.game.shop && !this.game.lab) this.drawCount(ctx);
  }
  // The count, large, under the haul's banner (over the drill, where the banner stands on a screen this size), from
  // the first of the rubble landing. Stamped, it holds a moment and flies down to the grit on the bar.
  drawCount(ctx) {
    const c = this.count, { game } = this, { W, H } = game, value = c.stamped ? c.target : c.paid;
    if (value <= 0) return;
    const whole = Math.round(value);
    if (whole !== c.shown) { c.shown = whole; c.said = `+${compact(whole)}`; if (!c.stamped) c.pop = Math.max(c.pop, 0.35); }
    const b = game.banner;
    // (Under the banner where it stands over the drill; where there is none, or it has gone under, as high. As large as
    // the haul is, and as fits between there and the drill.)
    if (b && !b.below && b.foot !== undefined) c.y = Math.round(b.y + b.foot + 3);
    c.y ??= Math.round(H * 0.24);
    const k = weigh(c.n), fits = Math.floor((Math.round((H - UI.BAR) / 2) - 12 - c.y) / 11), size = Math.max(1, Math.min(fits, k >= 0.72 ? 4 : k >= 0.5 ? 3 : 2)), flight = c.stamped ? Math.max(0, (c.at - HOLD) / FLY) : 0, ease = flight * flight;
    const big = flight > 0.55 ? 1 : flight > 0.2 ? Math.max(1, size - 1) : size;
    const homeY = c.y, x = W / 2 + (UI.DOCK + UI.INSET + UI.ICON + 16 - W / 2) * ease, y = homeY + (H - 16 - homeY) * ease;
    const up = c.pop > 0.5 ? 1 : 0, stamp = c.stamped && c.at < 0.1 ? 1 : 0;
    ctx.globalAlpha = flight ? Math.max(0.25, 1 - flight * 0.7) : 1;
    text(ctx, c.said, x, y - up * big, c.stamped && c.at < 0.22 ? '#ffffff' : GOLD, 0.5, big + stamp);
    ctx.globalAlpha = 1;
  }
}
