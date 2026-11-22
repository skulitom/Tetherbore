// A controller, through the browser's Gamepad API. It flies the drill by the game's own steering (`input.pad`, read by
// `Game.steer`) and works every panel by what the panel already has: the keyboard's paths (`Game.key`, `labKey`) and
// the buttons each frame draws (`Game.buttons`), walked with a visible focus. So a row added to a panel can be reached
// with no change here.
//
// With no pad it does nothing: `poll` returns at once until the browser says one is connected, `Game.pad` stays null
// so that nothing more is drawn, and the game plays and draws as it would without this file. What it draws (the focus
// and the button prompts) is shown only once the pad has been used, and goes when a key or the pointer is used.
//
//   stick or d-pad   fly; in a panel, move the focus (left and right set a volume), pan the map
//   A                at the core, the shop; in a panel, press what has the focus
//   B                back: the language list, then the panel
//   X, Y             LAB; the MAP (STATS until the chart is bought)
//   LB, RB           the panel's tabs
//   LT, RT           the lab's list a page at a time; zoom the map
//   Start, View      MENU; the panel at the tab it was left at
import { text, textWidth } from './atlas.js';
import { sfx, unlock } from './audio.js';
import { LANGS, lang } from './lang.js';

// The standard mapping's buttons.
const A = 0, B = 1, X = 2, Y = 3, LB = 4, RB = 5, LT = 6, RT = 7, VIEW = 8, START = 9, UP = 12, DOWN = 13, LEFT = 14, RIGHT = 15, COUNT = 17;
// The stick: nothing inside DEAD (worn sticks rest well off their middle), full from LIVE, and from the edge of the
// dead zone at the least the slowest a thumb's drag flies (`Game.pointerMove`: a twelfth).
export const DEAD = 0.2;
const LIVE = 0.95, SLOWEST = 1 / 12;
// How hard a stroke must be to throw the drill from the core (`Game.fly`).
const THROW = 0.5;
// The stick as four directions in a panel, with a gap so that it does not flicker at the line; and how a direction
// held comes again.
const NAV_ON = 0.55, NAV_OFF = 0.35, REPEAT_FIRST = 0.36, REPEAT_NEXT = 0.09;
// The map: how many of the screen's pixels it pans a second, and how fast a trigger zooms it.
const PAN = 110, ZOOM = 1.8;
// How long after the page comes up the pad is not listened to, in seconds.
export const SETTLE = 1;

const BADGE = { A: '#2f8f4e', B: '#b8413a', X: '#3468b8', Y: '#b58a1e' };
const BACK = ['B', 'BACK'], TABS = ['LB', 'RB', 'TABS'];
const LEGENDS = {
  shop: [['A', 'BUY'], BACK, TABS],
  stats: [BACK, TABS],
  lab: [['LT', 'RT', 'PAGE'], BACK, TABS],
  chart: [['LT', 'RT', 'ZOOM'], BACK, TABS],
  menu: [['A', 'SELECT'], BACK, TABS],
  volume: [['<', '>', 'LEVEL'], ['A', 'MUTE'], BACK, TABS],
  home: [['X', 'LAB'], ['Y', 'STATS'], ['START', 'MENU']],
  charted: [['X', 'LAB'], ['Y', 'MAP'], ['START', 'MENU']],
};
// Every word the prompts say, for the language test.
export const PAD_WORDS = [...new Set(Object.values(LEGENDS).flat(2))];

export class Pad {
  // `source` stands in for the browser's list of pads in a test.
  constructor(game, source = () => globalThis.navigator?.getGamepads?.() ?? []) {
    this.game = game; this.source = source;
    this.age = 0;            // seconds since the page came up, up to SETTLE
    this.live = false;       // a pad is connected
    this.shown = false;      // and it is the device last used, so its focus and prompts are drawn
    this.now = new Uint8Array(COUNT); this.was = new Uint8Array(COUNT);
    this.lx = this.ly = this.lt = this.rt = 0;
    this.way = [0, 0, 0];    // what `Game.steer` is given: the same array, filled again
    this.hard = 0;           // how hard it was steered the frame before
    this.at = '';            // the screen open, and the one last drawn (the buttons are those of the frame before)
    this.drawn = '';
    this.focus = 0; this.rows = []; this.langAt = -1;
    this.nav = 0; this.navT = 0; this.held = false; this.heard = null;
    const wake = () => this.wake();
    globalThis.addEventListener?.('gamepadconnected', wake);
    // (A pad the page was told of before it was listening is in the list already.)
    try { if ([...this.source()].some(p => p?.connected)) this.wake(); } catch { /* no pads to be had */ }
  }
  wake() {
    if (this.live) return;
    this.live = true; this.game.pad = this; this.now.fill(0); this.was.fill(0);
    if (this.heard) return;
    // A key or the pointer takes the prompts away again. (Listened for only once there is a pad.)
    this.heard = () => { this.shown = false; };
    globalThis.addEventListener?.('keydown', this.heard, true);
    globalThis.addEventListener?.('pointerdown', this.heard, true);
  }
  // The pad unplugged: nothing is left held.
  sleep() {
    const { game } = this;
    this.live = false; this.shown = false; game.input.pad = null; game.pad = null;
    this.hard = 0; this.nav = 0; this.at = ''; this.drawn = '';
  }

  // Every pad connected is read as one (a Deck can list its controls twice, and one of the two may be silent).
  read() {
    const { now, was } = this;
    was.set(now); now.fill(0);
    let on = false, best = 0;
    this.lx = this.ly = this.lt = this.rt = 0;
    for (const p of this.source()) {
      if (!p?.connected) continue;
      on = true;
      const buttons = p.buttons, axes = p.axes;
      for (let i = 0; i < COUNT && i < buttons.length; i++) if (buttons[i].pressed || buttons[i].value > 0.5) now[i] = 1;
      this.lt = Math.max(this.lt, buttons[LT]?.value ?? 0); this.rt = Math.max(this.rt, buttons[RT]?.value ?? 0);
      const x = axes[0] ?? 0, y = axes[1] ?? 0, far = x * x + y * y;
      if (far > best) { best = far; this.lx = x; this.ly = y; }
    }
    return on;
  }
  hit(button) { return this.now[button] === 1 && this.was[button] === 0; }
  // Which way the stick or the d-pad says, and how hard: the d-pad over the stick, at full.
  aim() {
    const w = this.way, { now } = this, dx = now[RIGHT] - now[LEFT], dy = now[DOWN] - now[UP];
    if (dx || dy) { const far = Math.hypot(dx, dy); w[0] = dx / far; w[1] = dy / far; w[2] = 1; return w; }
    const far = Math.hypot(this.lx, this.ly);
    if (far < DEAD) { w[0] = w[1] = w[2] = 0; return w; }
    w[0] = this.lx / far; w[1] = this.ly / far;
    w[2] = Math.min(1, SLOWEST + (1 - SLOWEST) * (far - DEAD) / (LIVE - DEAD));
    return w;
  }
  screen() { const g = this.game; return g.shop ? `shop:${g.shopTab}` : g.lab ? `lab:${g.labTab}` : ''; }

  // Once a frame, before the step.
  poll(dt) {
    if (this.age < SETTLE) this.age += dt;
    if (!this.live) return;
    const { game } = this;
    if (!this.read()) { this.sleep(); return; }
    // (Another window has the focus: the pad is that window's. A button held as it comes back is not a press. Nor is
    // one held as the page comes up: the A that chose a language from the menu is still down, or still reads as down,
    // as the page loads again in it, and would open the shop.)
    if (this.age < SETTLE || globalThis.document?.hasFocus?.() === false) { game.input.pad = null; this.hard = 0; this.nav = 0; this.was.set(this.now); return; }
    const w = this.aim();
    let pressed = false;
    for (let i = 0; i < COUNT; i++) if (this.now[i] && !this.was[i]) pressed = true;
    if (pressed || w[2] > 0 || this.lt > 0.5 || this.rt > 0.5) {
      // (A press is what lets the browser start the sound, where it counts one as the player's.)
      if (pressed || !this.shown) unlock();
      this.shown = true;
    }
    // What stands in front of the game (the close, the title screen) has the pad: A and Start press, B goes back, and
    // the stick or the d-pad moves through what it shows. (With the panel open over it, the panel has it, below.)
    if (game.front && !game.lab) {
      game.input.pad = null; this.hard = 0; this.at = ''; this.drawn = '';
      if (this.hit(A) || this.hit(START)) game.front.press();
      else if (this.hit(B)) game.front.back();
      else this.walk(dt, w, 'front', this.rows);
      return;
    }
    const id = this.screen();
    if (id !== this.at) {
      // A panel opened with the stick held does not walk its list until the stick has come back.
      if (!this.at) this.held = this.nav !== 0 || w[2] > 0;
      this.at = id; this.focus = 0; this.langAt = -1; game.langOpen = false; game.confirmReset = 0;
    }
    if (id) this.panel(dt, w); else this.flight(w);
  }

  flight(w) {
    const { game } = this;
    game.input.pad = w[2] > 0 ? w : null;
    // A fresh stroke, past half way, can throw the drill from the core, as a fresh drag does.
    if (w[2] >= THROW && this.hard < THROW) game.drill.armed = true;
    this.hard = w[2]; this.nav = 0;
    if (this.hit(A)) game.key('Enter', true);
    else this.common();
  }
  // The buttons that do the same with a panel up and without.
  common() {
    const { game } = this;
    if (this.hit(START)) game.key('Escape', true);
    else if (this.hit(X)) game.key('KeyL', true);
    else if (this.hit(Y)) game.key(game.charted ? 'KeyM' : 'KeyI', true);
    else if (this.hit(VIEW)) game.openLab(!(game.lab || game.shop));
    else return false;
    return true;
  }

  panel(dt, w) {
    const { game } = this, tab = game.shop ? 'shop' : game.labTab;
    game.input.pad = null; this.hard = 0;
    const rows = this.list();
    this.followLanguages(rows);
    if (this.hit(B)) {
      // (B goes back a step at a time: the list of achievements is opened from the menu.)
      if (game.langOpen) { game.langOpen = false; sfx.tap(); } else if (tab === 'ach') { game.labTab = 'menu'; sfx.tap(); } else game.key('Escape', true);
      return;
    }
    if (this.hit(LB) || this.hit(RB)) { game.key('Tab', true, false, this.hit(LB)); return; }
    if (this.common()) return;
    if (this.hit(A)) rows[this.focus]?.act();
    if (tab === 'chart') { this.chart(dt, w); return; }
    if (tab === 'lab') {
      if (this.hit(LT)) game.labKey('PageUp', false);
      if (this.hit(RT)) game.labKey('PageDown', false);
    }
    if (tab === 'ach') {
      if (this.hit(LT)) game.key('PageUp', true);
      if (this.hit(RT)) game.key('PageDown', true);
    }
    this.walk(dt, w, tab, rows);
  }
  // The language list opens at the language spoken, and shut, the focus goes back to its row.
  followLanguages(rows) {
    const { game } = this;
    if (game.langOpen && this.langAt < 0) { this.langAt = this.focus; this.focus += 1 + LANGS.findIndex(l => l.id === lang); }
    else if (!game.langOpen && this.langAt >= 0) { this.focus = this.langAt; this.langAt = -1; }
    if (this.focus >= rows.length) this.focus = Math.max(0, rows.length - 1);
  }
  // What the focus walks: the rows of the panel drawn last, top to bottom, without its tabs and cross (the bumpers and
  // B are those) and without the bar under it. (The panel's own controls are the ones put before the bar, and its
  // frame is the one that swallows a tap.)
  list() {
    const { game, rows } = this;
    rows.length = 0;
    if (this.drawn !== this.at || game.labTab === 'chart' && game.lab) return rows;
    const frame = game.buttons.find(b => b.swallow);
    if (!frame) return rows;
    for (const b of game.buttons) {
      if (b === frame || (b.x === 0 && b.w === game.W)) break;
      if (b.y > frame.y) rows.push(b);
    }
    return rows.sort((a, b) => a.y - b.y || a.x - b.x);
  }
  // The stick as four directions, a direction held coming again.
  walk(dt, w, tab, rows) {
    const { now } = this;
    let dir = now[UP] ? 1 : now[DOWN] ? 2 : now[LEFT] ? 3 : now[RIGHT] ? 4 : 0;
    if (!dir) {
      const need = this.nav ? NAV_OFF : NAV_ON, ax = Math.abs(this.lx), ay = Math.abs(this.ly);
      if (Math.max(ax, ay) >= need) dir = ay >= ax ? (this.ly < 0 ? 1 : 2) : (this.lx < 0 ? 3 : 4);
    }
    if (this.held) { if (dir) return; this.held = false; }
    if (!dir) { this.nav = 0; return; }
    if (dir !== this.nav) { this.nav = dir; this.navT = REPEAT_FIRST; this.step(dir, false, tab, rows); return; }
    if ((this.navT -= dt) <= 0) { this.navT = REPEAT_NEXT; this.step(dir, true, tab, rows); }
  }
  step(dir, repeat, tab, rows) {
    const { game } = this;
    if (tab === 'front') { if (dir <= 2) game.front.move?.(dir === 1 ? -1 : 1); return; }
    if (tab === 'lab') { if (dir <= 2) game.labKey(dir === 1 ? 'ArrowUp' : 'ArrowDown', repeat); return; }
    if (tab === 'ach') { if (dir <= 2) game.key(dir === 1 ? 'ArrowUp' : 'ArrowDown', true); return; }
    if (!rows.length) return;
    if (dir > 2) { rows[this.focus]?.nudge?.(dir === 3 ? -1 : 1); return; }
    const by = dir === 1 ? -1 : 1, n = rows.length;
    // (Round from either end, but not by a direction held.)
    const to = repeat ? Math.max(0, Math.min(n - 1, this.focus + by)) : (this.focus + by + n) % n;
    if (to === this.focus) return;
    this.focus = to; game.confirmReset = 0;
    if (!repeat) sfx.tap();
  }
  // The map: the stick or the d-pad looks about it, the triggers zoom about its middle.
  chart(dt, w) {
    const { game } = this, r = game.chartRect;
    if (!r) return;
    if (w[2] > 0 && !this.held) {
      const c = game.chartView(), per = game.chartBase / c.zoom;
      c.x += w[0] * w[2] * PAN * per * dt; c.y += w[1] * w[2] * PAN * per * dt;
      game.chartView();
    } else if (!(w[2] > 0)) this.held = false;
    const by = (this.rt > 0.1 ? this.rt : 0) - (this.lt > 0.1 ? this.lt : 0);
    if (by) game.chartZoom(Math.exp(by * ZOOM * dt), r[0] + r[2] / 2, r[1] + r[3] / 2);
  }

  // ---- what is drawn, last of the interface (js/drawing.js, `drawHud`)
  draw(ctx) {
    const { game } = this;
    this.drawn = this.screen();
    if (!this.shown) return;
    if (!this.drawn) {
      for (const b of game.buttons) if (b.pad) this.badge(ctx, b.pad, b.x + b.padX, b.y + b.padY);
      if (game.atCore && game.drill.mode === 'free') this.legend(ctx, game.charted ? LEGENDS.charted : LEGENDS.home, game.H - 44 - 12);
      return;
    }
    if (this.drawn !== this.at) return;
    const rows = this.list(), b = rows[this.focus], tab = game.shop ? 'shop' : game.labTab;
    if (b) {
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(game.time * 7);
      ctx.fillStyle = '#ffe14a';
      ctx.fillRect(b.x - 1, b.y - 1, b.w + 2, 1); ctx.fillRect(b.x - 1, b.y + b.h, b.w + 2, 1);
      ctx.fillRect(b.x - 1, b.y, 1, b.h); ctx.fillRect(b.x + b.w, b.y, 1, b.h);
      ctx.globalAlpha = 1;
    }
    const says = tab === 'menu' ? (b?.nudge ? LEGENDS.volume : LEGENDS.menu) : LEGENDS[tab === 'ach' ? 'lab' : tab] ?? LEGENDS.stats;
    ctx.globalAlpha = 0.9; ctx.fillStyle = '#07060b'; ctx.fillRect(0, game.H - 13, game.W, 13); ctx.globalAlpha = 1;
    this.legend(ctx, says, game.H - 12);
  }
  // A button's name on its colour, a row wider than its word each side. Returns how wide.
  badge(ctx, name, x, y) {
    const w = textWidth(name) + 4;
    ctx.fillStyle = BADGE[name] ?? '#3a3450';
    ctx.fillRect(x, y, w, 11);
    text(ctx, name, x + 2, y, '#ffffff');
    return w;
  }
  // A line of prompts in the middle of the screen, each its buttons and then what they do: as many, from the first,
  // as the screen has room for.
  legend(ctx, items, y) {
    const { W } = this.game, widthOf = item => item.reduce((sum, s, i) => sum + (i < item.length - 1 ? textWidth(s) + 5 : textWidth(s) + 2), 0);
    let n = 0, total = 0;
    for (const item of items) { const add = widthOf(item) + (n ? 8 : 0); if (total + add > W - 4) break; total += add; n++; }
    let x = Math.round((W - total) / 2);
    for (let k = 0; k < n; k++) {
      const item = items[k];
      for (let i = 0; i < item.length - 1; i++) x += this.badge(ctx, item[i], x, y) + 1;
      text(ctx, item[item.length - 1], x + 2, y, '#f4ecd8');
      x += textWidth(item[item.length - 1]) + 2 + 8;
    }
  }
}
