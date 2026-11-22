// The desktop build's title screen: the logotype, a live view of the game behind it, and CONTINUE, NEW GAME, SETTINGS
// and QUIT, by mouse, keyboard or pad. Loaded only there (js/main.js, a dynamic import).
//
// A returning player is one press from playing: CONTINUE is first and has the focus, and Enter, Space, A or a click on
// it goes. With no game saved it is not there and NEW GAME is first; with one saved, NEW GAME asks a second press, as
// the menu's NEW WORLD does, as it starts over the world on file. SETTINGS opens the menu's own panel over the game
// (`Game.front` gives way while the panel is up), and shutting it comes back here.
//
// What is behind it is no picture: it is a second game, the `view`, with a world and a rig of its own, flown by a small
// pilot (the one tools/clip.mjs films the game with), cutting ground free and reeling it in. It is the game's own step
// and drawing, so it can never go out of date, and it is nobody's: it never saves (`save` and `claim` are taken from it),
// earns nothing, closes nothing, and its sounds are held (`holdSounds`) so that only its music and bed are heard. The
// player's game stands still underneath until the title screen is left, and the view is then let go.
import { draw, sheets, slice9, text, textWidth } from './atlas.js';
import { holdSounds, sfx, unlock } from './audio.js';
import { UI } from './drawing.js';
import { Game } from './game.js';
import { Payoff } from './payoff.js';
import { C, N } from './world.js';

const SEED = 7, SHOWN = 92, GOLD = '#ffe14a', DIM = '#d8d2e2', ROW_H = 26, CONFIRM = 3.5;
// The rig the view flies with: enough reach and bit to make a show of the first ground, nothing more.
const RIG = { tether: 3, drill: 5, momentum: 3, winch: 4, scanner: 5, lamp: 4 };
const STUCK = 22;   // seconds without a haul before the view begins again

export class Title {
  // `returning`: there is a game saved to go on with.
  constructor(game, returning) {
    this.game = game; this.over = true; this.on = true; this.returning = returning;
    this.rows = [...(returning ? [{ id: 'continue', say: 'CONTINUE' }] : []), { id: 'new', say: 'NEW GAME' }, { id: 'settings', say: 'SETTINGS' }, { id: 'quit', say: 'QUIT' }];
    this.focus = 0; this.sure = 0; this.boxes = []; this.t = 0;
    this.logo = null; this.view = null; this.pilot = null;
    if (typeof Image !== 'undefined') { const logo = new Image(); logo.src = 'assets/logotype.png'; this.logo = logo; }
    this.makeView();
    game.front = this;
  }

  // ---- the view
  makeView() {
    const canvas = document.createElement('canvas'), v = new Game(canvas, null, { blank: true });
    v.save = () => {}; v.claim = () => {}; v.popup = () => {}; v.bare = true;
    v.ach.off = true; v.finale.off = true;
    v.fresh(SEED, true);
    v.payoff = new Payoff(v, { quiet: true });
    this.dress(v);
    this.view = v; this.fitView();
  }
  // A game for looking at: its rig, and the ground near the core already seen. Its hull takes no harm, so the flight goes on.
  dress(v) {
    Object.assign(v.S.lv, RIG);
    v.S.stats.hauls = 1; v.S.stats.moves = 2;
    v.hit = () => false;
    v.world.see(C, C, SHOWN);
    v.changed();
    this.pilot = { legs: [], target: null, budget: 0, idle: 30, hauls: v.S.stats.hauls, since: 0 };
  }
  fitView() {
    const { game, view: v } = this;
    if (!v || (v.W === game.W && v.H === game.H)) return;
    v.W = game.W; v.H = game.H; v.canvas.width = v.W; v.canvas.height = v.H; v.ctx.imageSmoothingEnabled = false; v.scale = 1;
    // (Where the words stand down the left, the drill is flown right of the middle, clear of them.)
    v.payoff.biasX = this.side() ? -Math.round(game.W * 0.2) : 0;
  }
  // Round the loose piece nearest the drill until it is reeled in, then the next; with none, a moat round a block of
  // ground ahead of it, outward from the core.
  fly(dt) {
    const v = this.view, p = this.pilot, d = v.drill, HX = C + 0.5, HY = C + 0.5;
    if (v.S.stats.hauls !== p.hauls) { p.hauls = v.S.stats.hauls; p.target = null; p.legs = []; p.idle = 34; p.since = 0; }
    p.since += dt;
    if (p.since > STUCK || Math.hypot(d.x - HX, d.y - HY) > 70) { v.fresh(SEED + ((Math.random() * 3) | 0), true); this.dress(v); return; }
    if (p.idle > 0) { p.idle--; v.input.auto = null; return; }
    if (!p.legs.length) { p.target = this.choose(); p.legs = p.target.legs; p.budget = 0; }
    const [x, y] = p.legs[0], dx = x + 0.5 - d.x, dy = y + 0.5 - d.y, far = Math.hypot(dx, dy);
    if (far < 0.45 || ++p.budget > 420) { p.legs.shift(); p.budget = 0; v.input.auto = null; return; }
    v.input.auto = [dx / far, dy / far, Math.max(0.35, Math.min(1, far / 2))];
  }
  choose() {
    const v = this.view, d = v.drill, HX = C + 0.5, HY = C + 0.5, size = 4;
    const boxOf = cells => { let b = [Infinity, Infinity, -Infinity, -Infinity]; for (const c of cells) { const x = c % N, y = Math.floor(c / N); b = [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)]; } return b; };
    let best = null, near = 40;
    for (const cells of v.pieces) {
      if (cells.length > 300) continue;
      const box = boxOf(cells), f = Math.hypot((box[0] + box[2]) / 2 + 0.5 - d.x, (box[1] + box[3]) / 2 + 0.5 - d.y);
      if (f < near) { near = f; best = box; }
    }
    if (!best) {
      const ox = d.x - HX, oy = d.y - HY, m = Math.hypot(ox, oy) || 1, ux = m > 2 ? ox / m : Math.cos(v.time), uy = m > 2 ? oy / m : Math.sin(v.time);
      const cx = Math.floor(d.x + ux * (2 + size)), cy = Math.floor(d.y + uy * (2 + size)), h = size >> 1;
      best = [cx - h, cy - h, cx - h + size - 1, cy - h + size - 1];
    }
    const [x0, y0, x1, y1] = best, corners = [[x0 - 1, y0 - 1], [x1 + 1, y0 - 1], [x1 + 1, y1 + 1], [x0 - 1, y1 + 1]];
    let first = 0;
    for (let n = 1; n < 4; n++) if (Math.hypot(corners[n][0] + 0.5 - d.x, corners[n][1] + 0.5 - d.y) < Math.hypot(corners[first][0] + 0.5 - d.x, corners[first][1] + 0.5 - d.y)) first = n;
    const legs = [];
    for (let n = 0; n < 9; n++) legs.push(corners[(first + n) % 4]);
    return { legs };
  }

  // ---- its time and its drawing, in place of the game's (`Game.update`, `render`)
  step(game, dt) {
    this.t += dt;
    if (this.sure > 0) this.sure = Math.max(0, this.sure - dt);
    game.input.keys.clear(); game.input.id = null;
    game.ach.step(game, dt);
    this.fitView();
    holdSounds(true);
    try { this.fly(dt); this.view.update(dt); } finally { holdSounds(false); }
  }
  render(game) {
    const { ctx, W, H } = game;
    // (The tether's canvas lies over this one, and has nothing to show here.)
    if (game.overCtx) { game.overCtx.setTransform(1, 0, 0, 1, 0, 0); game.overCtx.clearRect(0, 0, game.over.width, game.over.height); game.ropeDirty = null; }
    game.buttons.length = 0; game.panels.length = 0; game.callN = 0;
    this.fitView();
    this.view.render();
    ctx.drawImage(this.view.canvas, 0, 0);
    this.shade(ctx, W, H);
    // On a screen with the room, the logotype and the choices stand down the left, and the view's action to the right
    // of them; on a narrow one, in the middle.
    const side = this.side(), k = this.logoScale(W, H), logoW = 160 * k, x0 = side ? Math.max(UI.EDGE * 2, Math.round(W * 0.05)) : Math.round(W / 2 - logoW / 2), top = Math.max(6, Math.round(H * 0.12));
    this.drawLogo(ctx, x0, top, k);
    const n = this.rows.length, y0 = Math.max(top + 32 * k + 10, Math.min(H - n * ROW_H - 10, Math.round(H * 0.46))), wide = this.rowWidth();
    this.boxes.length = 0;
    for (let i = 0; i < n; i++) {
      const row = this.rows[i], on = i === this.focus, x = side ? x0 : Math.round(W / 2 - wide / 2), y = y0 + i * ROW_H, said = this.said(row), big = textWidth(said, 2) <= wide - 18 ? 2 : 1;
      if (on) {
        ctx.globalAlpha = 0.62; ctx.fillStyle = '#07060b'; ctx.fillRect(x, y, wide, ROW_H - 2); ctx.globalAlpha = 1;
        ctx.fillStyle = GOLD; ctx.fillRect(x, y, 3, ROW_H - 2);
      }
      const ty = y + Math.round((ROW_H - 2 - 10 * big) / 2), nudge = on ? 2 + Math.round((Math.sin(this.t * 5) + 1) * 0.75) : 0;
      text(ctx, said, x + 10 + nudge, ty, row.id === 'new' && this.sure > 0 ? '#ff7a5a' : on ? GOLD : DIM, 0, big);
      this.boxes.push([x, y, wide, ROW_H - 2]);
    }
    if (game.pad?.shown) game.pad.legend(ctx, [['A', 'SELECT'], ['B', 'BACK']], H - 14);
  }
  said(row) {
    if (row.id !== 'new' || !(this.sure > 0)) return row.say;
    return this.game.pad?.shown ? 'A AGAIN: NEW WORLD' : 'ENTER AGAIN: NEW WORLD';
  }
  side() { return this.game.W >= 480 && this.game.W > this.game.H; }
  rowWidth() {
    let w = 150;
    for (const row of this.rows) w = Math.max(w, textWidth(row.say, 2) + 24);
    return Math.min(this.game.W - 2 * UI.EDGE, Math.max(w, textWidth(this.said(this.rows[this.focus])) + 24));
  }
  // The ground behind drawn down so that what stands on it reads: most at the side the words are on, or at the middle.
  shade(ctx, W, H) {
    const side = this.side();
    if (!this.wash || this.wash.W !== W || this.wash.side !== side) {
      const g = side ? ctx.createLinearGradient(0, 0, W, 0) : ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(7, 6, 11, 0.86)'); g.addColorStop(side ? 0.42 : 0.5, 'rgba(7, 6, 11, 0.62)'); g.addColorStop(side ? 0.72 : 1, side ? 'rgba(7, 6, 11, 0.08)' : 'rgba(7, 6, 11, 0.7)');
      if (side) g.addColorStop(1, 'rgba(7, 6, 11, 0.16)');
      this.wash = { W, side, g };
    }
    ctx.fillStyle = this.wash.g; ctx.fillRect(0, 0, W, H);
  }
  logoScale(W, H) { return Math.max(1, Math.min(4, Math.floor(Math.min((this.side() ? W * 0.56 : W - 2 * UI.EDGE) / 160, H * 0.26 / 32)))); }
  drawLogo(ctx, x, y, k) {
    const logo = this.logo;
    if (logo?.complete && logo.naturalWidth) ctx.drawImage(logo, x, y, 160 * k, 32 * k);
    else if (sheets.logo) draw(ctx, 'logo', 'logo', Math.round(x + 80 * k - 66), y + 4);
  }

  // ---- what it takes (`Game.pointerDown` and the rest hand them here)
  move(by) {
    const n = this.rows.length;
    this.focus = (this.focus + by + n) % n; this.sure = 0;
    sfx.tap();
  }
  press() {
    const row = this.rows[this.focus];
    if (!row) return;
    unlock();
    if (row.id === 'continue') this.leave();
    else if (row.id === 'new') {
      // (With a game on file, a second press: it starts over the world that is there.)
      if (this.returning && !(this.sure > 0)) { this.sure = CONFIRM; sfx.tap(); return; }
      this.sure = 0;
      this.game.fresh((Math.random() * 1e9) | 0);
      this.game.save();
      sfx.relic();
      this.leave();
    } else if (row.id === 'settings') { this.sure = 0; this.game.openLab(true, 'menu'); }
    else if (row.id === 'quit') { sfx.tap(); this.game.desktop?.quit?.(); }
  }
  back() { if (this.sure > 0) { this.sure = 0; sfx.tap(); } }
  rowAt(x, y) { return this.boxes.findIndex(b => x >= b[0] && y >= b[1] && x < b[0] + b[2] && y < b[1] + b[3]); }
  hover(x, y) {
    const i = this.rowAt(x, y);
    if (i >= 0 && i !== this.focus) { this.focus = i; this.sure = 0; }
  }
  pointer(x, y) {
    const i = this.rowAt(x, y);
    if (i < 0) return;
    if (i !== this.focus) { this.focus = i; this.sure = 0; }
    this.press();
  }
  key(code, down, repeat = false) {
    if (!down) return true;
    unlock();
    if (code === 'ArrowUp' || code === 'KeyW') this.move(-1);
    else if (code === 'ArrowDown' || code === 'KeyS') this.move(1);
    else if (!repeat && (code === 'Enter' || code === 'Space' || code === 'NumpadEnter')) this.press();
    else if (!repeat && code === 'Escape') this.back();
    return true;
  }
  // Into the game: the view is let go, and the game goes on from where it stands.
  leave() {
    const { game } = this;
    this.on = false; game.front = null; this.view = null; this.pilot = null;
    game.input.keys.clear(); game.input.id = null; game.input.auto = null;
    sfx.dock?.();
  }
}
