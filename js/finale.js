// The close of the game as it stands: what happens once all four lords are beaten and the drill has brought the last
// kill home. It is no ending (the game is in Early Access, and the world goes on): a short earned sequence, the credits
// over the player's own ground, and the game again, just as it was, at the core.
//
//   HUSH    the view goes dark
//   LORDS   each lord in turn, at its own point of the compass, with its line of light run home
//   JOIN    the four lines reach the core, which answers: THE DEEP IS STILL
//   TALLY   what this dig came to, counted up
//   ROLL    the credits, then a card that waits for a press
//
// It plays once for a player, at the first docking with all four beaten (`watch`), which is also what a game saved
// before there was a close gets the first time it docks. That it has been seen is the player's and not the world's:
// it is kept beside the game in the save (`closed`, written only once it is), as the achievements are, so neither a
// trip lost nor NEW WORLD plays it again. The menu's CREDITS row plays it again; on the desktop that row is there from
// the start, for the licence notices, and until the close has been earned it rolls the credits alone.
//
// It changes nothing of the game. It stands in `Game.front`, which holds the flight as a panel does and takes every
// press (js/game.js, js/pad.js). It draws from no random stream of the game's (`rnd` is its own), lays no cell, and
// does no work at all but one comparison a frame until it is due.
//
// A press does not end it by accident: the first shows PRESS AGAIN TO SKIP and the second skips, but a replay ends at
// one press, and so does the card at the end.
import { draw, sheets, text, textWidth, wrap } from './atlas.js';
import { sfx } from './audio.js';
import { BOSS } from './bosses.js';
import { compact, GEM_COLOR, UI } from './drawing.js';
import { C } from './world.js';

const T = 16, HX = (C + 0.5) * T, HY = (C + 0.5) * T;
export const HUSH = 1.4, LORD_BEAT = 1.3, JOIN = 2.4, TALLY = 5.4, ROLL_AT = HUSH + 4 * LORD_BEAT + JOIN + TALLY;
// How long the first press stays armed; how long a press is not listened to as it begins; how long the drill stands at
// the core with all four beaten before it begins; how fast the credits go, in the game's pixels a second.
const ARMED = 3, DEAF = 0.45, DWELL = 1.4, SPEED = 18;
// The lords in the order they are called, and which way each lies from the core.
const ORDER = [3, 0, 1, 2], WAYS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const GOLD = '#ffe14a', PALE = '#fff6c8', DIM = '#bcb4cc', MINT = '#8cf2c4', DARK = '#07060b';
const PARTS = 220;

// What the shipped dependencies' licences ask to be said (their full texts ship as files: desktop/package.mjs). In
// English in every language: a licence is not a line of the game's to turn.
const MIT = 'PERMISSION IS HEREBY GRANTED, FREE OF CHARGE, TO ANY PERSON OBTAINING A COPY OF THIS SOFTWARE AND ASSOCIATED DOCUMENTATION FILES (THE "SOFTWARE"), TO DEAL IN THE SOFTWARE WITHOUT RESTRICTION, INCLUDING WITHOUT LIMITATION THE RIGHTS TO USE, COPY, MODIFY, MERGE, PUBLISH, DISTRIBUTE, SUBLICENSE, AND/OR SELL COPIES OF THE SOFTWARE, AND TO PERMIT PERSONS TO WHOM THE SOFTWARE IS FURNISHED TO DO SO, SUBJECT TO THE FOLLOWING CONDITIONS: THE ABOVE COPYRIGHT NOTICE AND THIS PERMISSION NOTICE SHALL BE INCLUDED IN ALL COPIES OR SUBSTANTIAL PORTIONS OF THE SOFTWARE. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.';
// The credits, top to bottom: [kind, what it says]. `desktop` adds what only that build ships.
export function creditLines(desktop) {
  const rows = [
    ['logo'],
    ['head', 'A GAME BY'], ['name', 'SKULITOM'],
    ['head', 'ART'], ['name', 'PIXELBOLT'], ['note', 'EVERY SPRITE AND TILE IS MADE WITH PIXELBOLT'],
    ['head', 'MUSIC AND SOUND'], ['note', 'MADE IN CODE'],
    ['head', 'CHINESE LETTERS'], ['name', 'FUSION PIXEL FONT'], ['note', 'BY TAKWOLF'],
    ['legal', 'COPYRIGHT (C) 2022, TAKWOLF (TAKWOLF.COM)'], ['legal', 'SIL OPEN FONT LICENSE, VERSION 1.1'],
    ['legal', 'GITHUB.COM/TAKWOLF/'], ['legal', 'FUSION-PIXEL-FONT'],
  ];
  if (desktop) rows.push(
    ['head', 'BUILT WITH'],
    ['name', 'ELECTRON'], ['legal', 'COPYRIGHT (C) ELECTRON CONTRIBUTORS'], ['legal', 'COPYRIGHT (C) 2013-2020 GITHUB INC.'], ['legal', 'MIT LICENSE'],
    ['legal', 'INCLUDES CHROMIUM: SEE LICENSES.CHROMIUM.HTML'],
    ['name', 'STEAMWORKS.JS'], ['legal', 'COPYRIGHT (C) 2022 GABRIEL FRANCISCO DOS SANTOS'], ['legal', 'MIT LICENSE'],
    ['legal', 'STEAMWORKS API (C) VALVE CORPORATION'],
    ['head', 'LICENCE NOTICES'], ['note', 'ELECTRON AND STEAMWORKS.JS, MIT LICENSE:'], ['block', MIT],
    ['note', 'FULL TEXTS: RESOURCES/LICENSES'],
  );
  return rows;
}
// How tall each kind of row stands, and how far clear of the row before.
const ROWS = { head: [10, 16], name: [20, 3], note: [10, 3], legal: [10, 2], block: [10, 3] };

export class Finale {
  constructor() {
    this.seen = false; this.off = false; this.run = null; this.game = null; this.under = null;
    this.over = false;      // (the game goes on being drawn under it: js/game.js, `front`)
    this.dwell = 0; this.seedOf = 0x51ed; this.parts = null; this.logo = null; this.fit = null;
  }
  // Beside the game in the save: nothing until it has been seen, so a save from before is as it was.
  saved() { return this.seen ? { closed: 1 } : {}; }
  load(closed) { if (closed) this.seen = true; }
  get on() { return this.run !== null; }
  rnd() { this.seedOf = (Math.imul(this.seedOf, 1664525) + 1013904223) >>> 0; return this.seedOf / 4294967296; }

  // Each frame of play with nothing in front: is it due? All four beaten and the kill brought home (`spoils` goes as
  // the drill docks), the drill standing at the core a moment with nothing open.
  watch(game, dt) {
    if (this.seen || this.off || (game.S.bosses ?? 0) >> 4 !== 15) return;
    const d = game.drill;
    if (game.spoils || !game.atCore || d.mode !== 'free' || game.shop || game.lab || game.loading || game.banner || game.notice) { this.dwell = 0; return; }
    if ((this.dwell += dt) >= DWELL) this.begin(game);
  }
  // `replay`: from the menu. It leaves things as they were and goes back to the menu; until the close has been earned
  // it is the credits alone, which give nothing away.
  begin(game, replay = false) {
    if (this.run) return;
    this.game = game; this.under = game.front; game.front = this;
    const from = replay && !this.seen ? ROLL_AT : 0;
    this.run = { t: from, from, replay, armed: 0, atEnd: false, beat: -1, tallied: 0, joined: false };
    game.shop = false; game.lab = false; game.langOpen = false;
    game.input.keys.clear(); game.input.id = null; game.input.pad = null; game.drill.armed = false;
    this.dwell = 0;
    if (!this.parts) this.parts = Array.from({ length: PARTS }, () => ({ x: 0, y: 0, vx: 0, vy: 0, t: 1, life: 0, c: GOLD }));
    for (const p of this.parts) p.t = p.life = 0;
    if (!this.logo && typeof Image !== 'undefined') { const logo = new Image(); logo.src = 'assets/logotype.png'; this.logo = logo; }
    if (!replay) { this.seen = true; game.save(); }
  }
  // Over: the game is where it was, and goes on. (A replay goes back to the menu it was asked for from.)
  finish() {
    const game = this.game, r = this.run;
    if (!r) return;
    this.run = null; game.front = this.under; this.under = null;
    game.input.keys.clear(); game.input.id = null; game.input.pad = null;
    if (r.replay) game.openLab(true, 'menu'); else sfx.tap();
    game.save();
  }

  // ---- what it takes: a touch, a key or a pad's button (js/game.js and js/pad.js hand them here)
  press() {
    const r = this.run;
    if (!r || r.t - r.from < DEAF) return;
    if (r.atEnd || r.replay || r.armed > 0) { this.finish(); return; }
    r.armed = ARMED; sfx.tap();
  }
  back() { this.press(); }
  pointer() { this.press(); }
  key(code, down, repeat = false) {
    if (down && !repeat && !/^(Alt|Control|Shift|Meta|OS|F\d|PrintScreen|Tab)/.test(code)) this.press();
    return true;
  }

  // ---- its time
  step(game, dt) {
    const r = this.run;
    if (!r) return;
    r.t += dt;
    if (r.armed > 0) r.armed -= dt;
    // What sounds as each part begins.
    if (r.t >= HUSH && r.t < ROLL_AT) {
      const beat = Math.min(3, Math.floor((r.t - HUSH) / LORD_BEAT));
      if (beat > r.beat && r.t < HUSH + 4 * LORD_BEAT) { r.beat = beat; sfx.knell?.(beat); this.burst(game, ORDER[beat]); }
      if (!r.joined && r.t >= HUSH + 4 * LORD_BEAT) { r.joined = true; sfx.stillness?.(); this.bloom(game); }
      const rows = Math.floor((r.t - (HUSH + 4 * LORD_BEAT + JOIN)) / 0.8);
      if (rows > r.tallied && rows <= 4) { r.tallied = rows; sfx.tick?.(rows * 3); }
    }
    for (const p of this.parts) if (p.t < p.life) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - 1.6 * dt; p.vy *= 1 - 1.6 * dt; }
    const roll = this.layout(game);
    if (!r.atEnd && r.t >= ROLL_AT + (roll.tall + game.H * 0.5) / SPEED) r.atEnd = true;
  }
  // A part from the pool: one that has gone out, else none.
  spawn(x, y, vx, vy, life, c) {
    const p = this.parts.find(q => q.t >= q.life);
    if (!p) return;
    p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.t = 0; p.life = life; p.c = c;
  }
  burst(game, d) {
    const [x, y] = this.lordAt(game, ORDER.indexOf(d)), c = GEM_COLOR[BOSS[d].kin];
    for (let n = 0; n < 26; n++) { const a = this.rnd() * 6.283, v = 20 + this.rnd() * 60; this.spawn(x, y, Math.cos(a) * v, Math.sin(a) * v, 0.6 + this.rnd() * 0.8, c); }
  }
  bloom(game) {
    const [x, y] = this.coreAt(game);
    for (let n = 0; n < 150; n++) {
      const a = this.rnd() * 6.283, v = 30 + this.rnd() * 190, kin = 1 + (n % 4);
      this.spawn(x, y, Math.cos(a) * v, Math.sin(a) * v, 0.9 + this.rnd() * 1.4, n % 3 ? GEM_COLOR[kin] : n % 2 ? GOLD : PALE);
    }
  }
  // Where the core is on the screen; and a lord's place on the compass round it.
  coreAt(game) {
    return [Math.round(HX - game.cam.x + game.W / 2), Math.round(HY - game.cam.y + (game.H - UI.BAR) / 2)];
  }
  wide(game) { return game.W >= 420 && game.H >= 250; }
  lordAt(game, k) {
    const [cx, cy] = this.coreAt(game);
    return this.wide(game) ? [Math.round(cx + WAYS[k][0] * game.W * 0.26), Math.round(cy + WAYS[k][1] * game.H * 0.3)] : [Math.round(game.W / 2), Math.round(game.H * 0.34)];
  }

  // The credits as they stand on a screen `W` wide: worked out once for it.
  layout(game) {
    const { W, H } = game, desktop = !!game.desktop;
    if (this.fit && this.fit.W === W && this.fit.desktop === desktop) return this.fit;
    const room = Math.min(W - 2 * UI.EDGE, 420), rows = [];
    let y = 0;
    for (const [kind, said] of creditLines(desktop)) {
      if (kind === 'logo') { const k = this.logoScale(W); rows.push({ kind, y, h: 32 * k, k }); y += 32 * k + 12; continue; }
      const [h, gap] = ROWS[kind], size = kind === 'name' && textWidth(said, 2) <= room ? 2 : 1;
      y += gap;
      for (const line of size === 2 || textWidth(said) <= room ? [said] : wrap(said, room)) { rows.push({ kind, said: line, y, size, h: size === 2 ? h : 10 }); y += (size === 2 ? h : kind === 'block' ? 11 : 10) + 1; }
    }
    return this.fit = { W, H, desktop, rows, tall: y };
  }
  logoScale(W) { return Math.max(1, Math.min(2, Math.floor((W - 2 * UI.EDGE) / 160))); }

  // ---- drawn over the game's own frame, in place of its interface (js/drawing.js: `drawHud`)
  draw(game, ctx) {
    const r = this.run;
    if (!r) return;
    const { W, H } = game, t = r.t;
    const dark = t < HUSH ? t / HUSH * 0.74 : t < ROLL_AT ? 0.74 + Math.min(1, (t - HUSH - 4 * LORD_BEAT) / JOIN) * 0.08 : 0.78;
    ctx.globalAlpha = dark; ctx.fillStyle = DARK; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    if (t < ROLL_AT) {
      if (t >= HUSH) this.drawLords(game, ctx, t);
      this.drawParts(ctx);
      if (t >= HUSH + 4 * LORD_BEAT) this.drawJoin(game, ctx, t);
    } else this.drawRoll(game, ctx, t);
    // What a press would do, once it has been pressed.
    if (r.armed > 0 && !r.atEnd) {
      ctx.globalAlpha = Math.min(1, r.armed * 3);
      text(ctx, 'PRESS AGAIN TO SKIP', W / 2, H - 16, MINT, 0.5);
      ctx.globalAlpha = 1;
    }
  }
  drawParts(ctx) {
    for (const p of this.parts) {
      if (p.t >= p.life) continue;
      const u = p.t / p.life, big = u < 0.4 ? 2 : 1;
      ctx.globalAlpha = Math.min(1, (1 - u) * 1.8); ctx.fillStyle = p.c;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), big, big);
    }
    ctx.globalAlpha = 1;
  }
  // Each lord called in turn: its body, a line of its colour run from it toward the core, its name and title under it.
  // On a screen with room they stand round the core at the four points of the compass, and stay; on a phone they come
  // one at a time in the middle.
  drawLords(game, ctx, t) {
    const [cx, cy] = this.coreAt(game), wide = this.wide(game), lit = (t - HUSH) / LORD_BEAT, big = wide ? 2 : 1, out = Math.max(0, Math.min(1, (t - HUSH - 4 * LORD_BEAT) / (JOIN * 0.45)));
    for (let k = 0; k < 4; k++) {
      const u = lit - k;
      if (u <= 0) continue;
      if (!wide && (u >= 1 && k < 3 || t >= HUSH + 4 * LORD_BEAT + 0.6)) continue;
      const B = BOSS[ORDER[k]], [x, y] = this.lordAt(game, k), colour = GEM_COLOR[B.kin], fade = Math.min(1, u * 3) * (1 - out), run = Math.min(1, u * 1.2);
      // The line home, drawn from the lord to the core, shrinking in to it as they join.
      if (wide) {
        // (From clear of the lord and its words: the north's words hang under it, on the line's way.)
        const far = Math.hypot(cx - x, cy - y) || 1, clear = (k === 0 ? 26 * big + 26 : 26 * big + 2) / far, from = Math.max(clear, out), to = clear + (1 - clear) * run, dots = Math.ceil(far / 3);
        ctx.globalAlpha = Math.min(1, u * 2); ctx.fillStyle = colour;
        for (let n = Math.ceil(from * dots); n < to * dots; n++) ctx.fillRect(Math.round(x + (cx - x) * n / dots), Math.round(y + (cy - y) * n / dots), 2, 2);
        ctx.globalAlpha = 1;
      }
      if (fade <= 0) continue;
      const f = sheets.bosses?.frames[`${B.key}-hurt`] ?? sheets.bosses?.frames[`${B.key}-idle-a`];
      ctx.globalAlpha = fade;
      if (f) { const size = 48 * big; ctx.drawImage(sheets.bosses.image, f[0], f[1], f[2], f[3], Math.round(x - size / 2), Math.round(y - size / 2), size, size); }
      const ty = Math.round(y + 26 * big);
      text(ctx, B.name, x, ty, colour, 0.5);
      text(ctx, B.lord, x, ty + 11, PALE, 0.5);
      ctx.globalAlpha = 1;
    }
  }
  // The lines reach the core: a light, rings of the four colours, the words, and what the dig came to.
  drawJoin(game, ctx, t) {
    const [cx, cy] = this.coreAt(game), { W, H } = game, u = (t - HUSH - 4 * LORD_BEAT) / JOIN;
    if (u < 0.5) {
      // A light that opens from the core and goes.
      const a = Math.max(0, 1 - u * 2.4), size = Math.round(50 + u * 300), glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, size);
      glow.addColorStop(0, 'rgba(255, 246, 200, 0.95)'); glow.addColorStop(0.25, 'rgba(255, 225, 74, 0.4)'); glow.addColorStop(1, 'rgba(255, 225, 74, 0)');
      ctx.globalAlpha = a; ctx.fillStyle = glow; ctx.fillRect(cx - size, cy - size, size * 2, size * 2); ctx.globalAlpha = 1;
    }
    for (let k = 0; k < 4; k++) {
      const v = u * 1.6 - k * 0.14;
      if (v <= 0 || v >= 1) continue;
      const rad = (20 + k * 18) + v * Math.min(W, H) * 0.42, n = Math.max(24, rad * 1.6 | 0), c = GEM_COLOR[1 + k];
      ctx.globalAlpha = (1 - v) * 0.9; ctx.fillStyle = c;
      for (let a = 0; a < n; a++) ctx.fillRect(Math.round(cx + Math.cos(a / n * 6.283) * rad), Math.round(cy + Math.sin(a / n * 6.283) * rad), 2, 2);
    }
    ctx.globalAlpha = 1;
    const say = Math.min(1, (t - HUSH - 4 * LORD_BEAT - 0.5) / 0.3);
    if (say > 0) {
      const big = textWidth('THE DEEP IS STILL', 3) <= W - 2 * UI.EDGE ? 3 : textWidth('THE DEEP IS STILL', 2) <= W - 2 * UI.EDGE ? 2 : 1, y = Math.round(H * 0.17);
      ctx.globalAlpha = say;
      text(ctx, 'THE DEEP IS STILL', W / 2, y, GOLD, 0.5, big);
      text(ctx, 'THE FOUR LORDS ARE BEATEN', W / 2, y + 12 * big + 2, PALE, 0.5);
      ctx.globalAlpha = 1;
    }
    this.drawTally(game, ctx, t - (HUSH + 4 * LORD_BEAT + JOIN));
  }
  // What this dig came to, each figure counted up in its turn.
  drawTally(game, ctx, t) {
    if (t <= 0) return;
    const { W, H } = game, S = game.S, wide = this.wide(game), rows = this.tally(S), w = Math.min(W - 2 * UI.EDGE, 240), x0 = Math.round(W / 2 - w / 2), y0 = Math.round(H * (wide ? 0.54 : 0.5));
    ctx.globalAlpha = Math.min(1, t * 2.5); ctx.fillStyle = '#141122';
    ctx.fillRect(x0 - 6, y0 - 16, w + 12, 18 + rows.length * 14);
    text(ctx, 'YOUR DIG', W / 2, y0 - 13, GOLD, 0.5);
    ctx.globalAlpha = 1;
    rows.forEach(([name, value, say], n) => {
      const u = (t - 0.3 - n * 0.8) / 0.7;
      if (u <= 0) return;
      const y = y0 + n * 14;
      ctx.globalAlpha = Math.min(1, u * 3);
      text(ctx, name, x0, y, DIM);
      text(ctx, say(Math.round(value * Math.min(1, u * u * (3 - 2 * Math.min(1, u))))), x0 + w, y, u >= 1 ? '#ffffff' : GOLD, 1);
      ctx.globalAlpha = 1;
    });
  }
  // Its four lines: a name, the figure, and how the figure is said.
  tally(S) {
    const secs = Math.max(0, Math.floor(S.stats?.time ?? 0)), hours = Math.floor(secs / 3600), mins = Math.floor(secs / 60) % 60;
    return [
      ['HAULS', S.stats?.hauls ?? 0, v => compact(v)],
      ['BIGGEST HAUL', S.stats?.best ?? 0, v => `${compact(v)} CELLS`],
      ['FURTHEST OUT', Math.floor(S.out ?? 0), v => `${compact(v)} CELLS`],
      ['TIME UNDERGROUND', secs, () => hours ? `${hours} H ${mins} MIN` : `${mins} MIN`],
    ];
  }
  // The credits, going up the screen from its foot, and the card they leave.
  drawRoll(game, ctx, t) {
    const { W, H } = game, roll = this.layout(game), r = this.run, scroll = (t - ROLL_AT) * SPEED, top = Math.round(H - scroll);
    for (const row of roll.rows) {
      const y = top + row.y;
      if (y + row.h < -2 || y > H) continue;
      if (row.kind === 'logo') this.drawLogo(ctx, W, y, row.k);
      else text(ctx, row.said, W / 2, y, row.kind === 'head' ? GOLD : row.kind === 'name' ? '#ffffff' : row.kind === 'note' ? PALE : DIM, 0.5, row.size);
    }
    if (!r.atEnd) return;
    const since = t - (ROLL_AT + (roll.tall + H * 0.5) / SPEED), a = Math.min(1, since * 1.6);
    ctx.globalAlpha = a * 0.9; ctx.fillStyle = DARK; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = a;
    const size = textWidth('THANK YOU FOR PLAYING', 2) <= W - 2 * UI.EDGE ? 2 : 1, y = Math.round(H * 0.44);
    this.drawLogo(ctx, W, y - 32 * this.logoScale(W) - 14, this.logoScale(W));
    text(ctx, 'THANK YOU FOR PLAYING', W / 2, y, GOLD, 0.5, size);
    let line = y + 12 * size + 6;
    for (const said of wrap('THE WORLD IS STILL YOURS', W - 2 * UI.EDGE)) { text(ctx, said, W / 2, line, PALE, 0.5); line += 11; }
    if (game.desktop) for (const said of wrap('EARLY ACCESS: THE GAME IS STILL GROWING', W - 2 * UI.EDGE)) { text(ctx, said, W / 2, line, DIM, 0.5); line += 11; }
    ctx.globalAlpha = a * (0.65 + 0.35 * Math.sin(t * 4));
    for (const said of wrap('PRESS TO KEEP DIGGING', W - 2 * UI.EDGE)) { text(ctx, said, W / 2, line + 10, MINT, 0.5); line += 11; }
    ctx.globalAlpha = 1;
  }
  // The logotype (store/art's, at its own pixels: assets/logotype.png), or the atlas's small one until that has come.
  drawLogo(ctx, W, y, k) {
    const logo = this.logo;
    if (logo?.complete && logo.naturalWidth) { const w = 160 * k; ctx.drawImage(logo, Math.round(W / 2 - w / 2), y, w, 32 * k); }
    else if (sheets.logo) draw(ctx, 'logo', 'logo', Math.round(W / 2 - 66), y + 4);
  }
}
