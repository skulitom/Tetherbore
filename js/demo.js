// The demo: what a build made with `--demo` does that the full game does not (js/edition.js). Loaded by js/main.js only
// in such a build, and left out of every other, so the full game runs none of it. It fits itself onto a game (`fit`)
// and changes nothing in how the ground, the tether or the hauls work:
//
//   - The limit. The tether stops at REACH's sixth level, 400 cells (DEMO_LEVEL), and a level of any row that could only
//     be had past that (a distance, a corner's gems, wreck parts or relics out of reach) says FULL GAME in the shop.
//   - The lord. The south's Magma Behemoth lies 360 cells out, inside the limit (js/bosses.js). Its fall is the demo's
//     own: it is saved apart (`demoLords`) and is not the full game's, whose four lords all wait at 2,210 cells.
//   - The end. Reaching the end of the last tether, or beating the lord, brings up a card once: thanks, what the full
//     game holds, and the wishlist. The player plays on inside the limit, and the shop's REACH row opens it again.
import { slice9, text, textWidth, wrap } from './atlas.js';
import { sfx } from './audio.js';
import { REACH } from './shop.js';
import { C } from './world.js';
import { DEMO_LAIR, DEMO_LEVEL, DEMO_LORD, FULL_SAVE } from './edition.js';

export const STORE = 'https://store.steampowered.com/app/5681650';
export const CAP = REACH[DEMO_LEVEL];
// Kept on the device beside the save and never in it, so that nothing of the demo's goes with a game into the full one.
export const SEEN_KEY = 'tetherbore-demo-end';
// How near the end of the tether counts as having reached it, in cells; how long the card takes no press, so that a
// thumb, key or stick still flying as it comes up chooses nothing; and its rows.
const EDGE = 1.5, ARM = 0.7, ROW = 20, GAP = 4, PITCH = 11, INSET = 4, MOST_W = 236;
const GOLD = '#ffe14a', GREEN = '#8cf2c4', SOFT = '#c8c2d4';
// What the full game holds, as it stands today (README, docs/REFERENCE.md).
const HOLDS = [`A TETHER OF ${REACH[REACH.length - 1]} CELLS`, 'ALL FOUR LORDS', 'FOUR RELICS, FOUR SHRINES'];
export const CARD_WORDS = ['THANKS FOR PLAYING', 'THE DEMO ENDS AT THIS REACH', 'THE FULL GAME HOLDS', ...HOLDS, 'WISHLIST ON STEAM', 'KEEP PLAYING', 'FULL GAME', 'MORE IN THE FULL GAME', 'SOMETHING STIRS', `IN THE SOUTH, ${DEMO_LAIR} OUT`, 'YOUR FULL GAME IS SAFE', 'THE DEMO SAVES APART', 'STORE.STEAMPOWERED.COM/APP/5681650'];

const seen = () => { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; } };
// Whether this device's storage holds a full game's save (the demo never opens it: this is only to say that it is safe).
export const fullSaveHere = (storage = globalThis.localStorage) => [FULL_SAVE, `${FULL_SAVE}-latest`].some(key => { try { return JSON.parse(storage.getItem(key))?.v === 3; } catch { return false; } });

export class Demo {
  // `shell`: { wishlist } on the desktop, which asks the Electron shell to open the store (js/main.js); nothing on the web.
  constructor(game, shell = {}) {
    this.game = game; this.shell = shell;
    this.shown = seen(); this.due = false; this.wait = 0; this.blocked = false; this.stir = false; this.link = null; this.linked = false;
    this.wrecksIn = -1; this.wrecksOf = null;
  }
  get open() { return this.game.lab && this.game.labTab === 'demo'; }

  // Whether the next level of a row lies past the limit: asked by the game's prices (below) and by the shop's row.
  capped(u) {
    const game = this.game, l = game.S.lv[u.id];
    if (l >= u.values.length - 1) return false;
    if (u.id === 'tether') return l >= DEMO_LEVEL;
    if ((u.gemAt?.[l] ?? u.gem) >= 5 && (u.gems?.[l] ?? 0) > 0) return true;
    if (!u.needs) return false;
    const asked = u.needs[1][l], what = Array.isArray(asked) ? asked[0] : u.needs[0], count = Array.isArray(asked) ? asked[1] : asked;
    if (what === 'out') return count > CAP;
    if (what === 'relics') return count > 0;
    if (what === 'parts') return count > this.wrecksInReach();
    return false;
  }
  wrecksInReach() {
    const w = this.game.world;
    if (this.wrecksOf !== w.seed) {
      this.wrecksOf = w.seed;
      this.wrecksIn = w.wrecks.filter(([x, y]) => Math.hypot(x - C, y - C) <= CAP).length;
    }
    return this.wrecksIn;
  }

  // Once a frame, after the game's step.
  step(dt) {
    const g = this.game;
    if (this.open) { this.wait = Math.max(0, this.wait - dt); return; }
    if (g.labTab === 'demo') g.labTab = 'stats';
    this.hideLink();
    if (this.stir && !g.shop && !g.lab && !g.notice) { this.stir = false; g.notice = { title: 'SOMETHING STIRS', sub: `IN THE SOUTH, ${DEMO_LAIR} OUT`, colour: '#ff9a6a', t: 0, life: 5 }; }
    if (this.shown || g.S.lv.tether < DEMO_LEVEL) return;
    if (g.far >= CAP - EDGE || ((g.S.bosses ?? 0) >> (4 + DEMO_LORD) & 1)) this.due = true;
    // (It waits for a fight to end, a banner to go and a panel to shut: nothing the player is in the middle of is cut.)
    if (this.due && !g.shop && !g.lab && !g.banner && !g.loading && g.drill.mode !== 'dead' && !g.fauna.bosses?.awake(DEMO_LORD)) this.show();
  }
  // The card. `again`: asked for from the shop, where there is nothing to guard against and nothing new to mark.
  show(again = false) {
    const g = this.game;
    if (!again) {
      this.shown = true; this.wait = ARM;
      try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* it may come up again */ }
      sfx.relic?.();
    }
    this.blocked = false;
    g.openLab(true, 'demo');
  }
  // The store, through the shell on the desktop (Steam's overlay where there is one, else the browser). On the web the
  // button is a real link laid over it (`placeLink`), and this is for a key or a pad.
  wishlist() {
    if (this.wait > 0) return;
    sfx.tap();
    if (this.shell.wishlist) { Promise.resolve(this.shell.wishlist()).catch(() => {}); return; }
    let opened = null;
    try { opened = globalThis.open?.(STORE, '_blank') ?? null; } catch { opened = null; }
    if (opened) { try { opened.opener = null; } catch { /* another origin's now */ } } else this.blocked = true;
  }
  keepPlaying() {
    if (this.wait > 0) return;
    this.game.openLab(false);
  }

  // Drawn in place of the panel while it is up (js/drawing.js, `drawLab`). Its frame takes every touch, so that nothing
  // reaches the ground under it, and its two rows are walked by a pad as any panel's are (js/pad.js).
  draw() {
    const g = this.game, { ctx, W, H } = g, rise = g.labRise;
    ctx.globalAlpha = 0.72 * rise; ctx.fillStyle = '#07060b'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    const pw = Math.min(W - 2 * INSET, MOST_W), inner = pw - 4 * INSET, big = textWidth('THANKS FOR PLAYING', 2) <= inner ? 2 : 1;
    const says = wrap('THE DEMO ENDS AT THIS REACH', inner), head = big * 10 + 4 + says.length * PITCH + 6 + PITCH + HOLDS.length * PITCH + 6;
    const ph = 2 * INSET + 4 + head + 2 * ROW + GAP + (this.blocked ? PITCH : 0), px = Math.round((W - pw) / 2), py = Math.max(2, Math.round((H - ph) / 2 + (1 - rise) * (1 - rise) * 40));
    slice9(ctx, 'ui', 'panel', px, py, pw, ph);
    const mid = px + pw / 2;
    let y = py + INSET + 3;
    text(ctx, 'THANKS FOR PLAYING', mid, y, GOLD, 0.5, big); y += big * 10 + 4;
    for (const line of says) { text(ctx, line, mid, y, '#ffffff', 0.5); y += PITCH; }
    y += 6;
    text(ctx, 'THE FULL GAME HOLDS', mid, y, GREEN, 0.5); y += PITCH;
    for (const line of HOLDS) { text(ctx, line, mid, y, SOFT, 0.5); y += PITCH; }
    y += 6;
    const bx = px + INSET, bw = pw - 2 * INSET;
    slice9(ctx, 'ui', 'button', bx, y, bw, ROW);
    text(ctx, 'WISHLIST ON STEAM', mid, y + 6, GOLD, 0.5);
    this.placeLink(bx, y, bw, ROW);
    const wishY = y; y += ROW + GAP;
    slice9(ctx, 'ui', 'button', bx, y, bw, ROW);
    text(ctx, 'KEEP PLAYING', mid, y + 6, '#ffffff', 0.5);
    const playY = y; y += ROW;
    if (this.blocked) text(ctx, 'STORE.STEAMPOWERED.COM/APP/5681650', mid, y + 2, GREEN, 0.5);
    // (Put before everything else on the list, its frame after its rows, as a panel's are.)
    g.buttons.unshift({ x: 0, y: 0, w: W, h: H, act: () => {}, swallow: true });
    g.buttons.unshift({ x: bx, y: playY, w: bw, h: ROW, act: () => this.keepPlaying() });
    g.buttons.unshift({ x: bx, y: wishY, w: bw, h: ROW, act: () => this.wishlist() });
  }
  // On the web the wishlist is a real link: an anchor with nothing to see, laid exactly over the button the canvas drew.
  placeLink(x, y, w, h) {
    if (this.shell.wishlist || !globalThis.document?.body?.appendChild) return;
    const g = this.game, r = g.canvas.getBoundingClientRect(), sx = r.width / g.W, sy = r.height / g.H;
    if (!this.link) {
      const a = this.link = document.createElement('a');
      a.href = STORE; a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('aria-label', 'Wishlist Tetherbore on Steam');
      Object.assign(a.style, { position: 'fixed', zIndex: 5, opacity: 0, display: 'block' });
      document.body.appendChild(a);
    }
    Object.assign(this.link.style, { display: this.wait > 0 ? 'none' : 'block', left: `${r.left + x * sx}px`, top: `${r.top + y * sy}px`, width: `${w * sx}px`, height: `${h * sy}px` });
    this.linked = true;
  }
  hideLink() { if (this.linked) { this.linked = false; this.link.style.display = 'none'; } }
}

// The demo fitted to a game, before it restores anything. `shell`, as `Demo` takes it; `fullSave`, whether a full game's
// save is on this device, which the demo then says is safe the first time it begins a game of its own.
export function fit(game, shell = {}) {
  const demo = game.demo = new Demo(game, shell);
  const { cost, buy, kept, restore, update, key } = game;
  // The limit: past it a row has no next level, so nothing can buy one, whatever asks.
  game.cost = u => demo.capped(u) ? null : cost.call(game, u);
  game.buy = u => {
    if (demo.capped(u)) {
      if (u.id === 'tether') demo.show(true);
      else { game.shopNote = { t: 2.5, color: '#e8c070', text: 'MORE IN THE FULL GAME', short: null }; sfx.deny?.(); }
      return;
    }
    const was = game.S.lv.tether;
    buy.call(game, u);
    if (u.id === 'tether' && was < DEMO_LEVEL && game.S.lv.tether >= DEMO_LEVEL) demo.stir = true;
  };
  // The demo's lord is saved apart from the full game's, so a demo's save carries no lord beaten into it.
  game.kept = () => {
    const k = kept.call(game);
    if (!k.bosses) return k;
    const { bosses, ...rest } = k;
    return { ...rest, demoLords: bosses };
  };
  game.restore = async () => {
    const ok = await restore.call(game);
    if (ok) {
      const S = game.S;
      if (S.demoLords !== undefined) { S.bosses = S.demoLords; delete S.demoLords; }
      S.lv.tether = Math.min(S.lv.tether, DEMO_LEVEL);
      game.dockMark();
    }
    return ok;
  };
  game.update = dt => { update.call(game, dt); demo.step(dt); };
  game.key = (code, down, repeat = false, shift = false) => {
    if (demo.open && down) {
      if (demo.wait > 0) return true;
      if (code === 'Enter') { if (!repeat) demo.wishlist(); return true; }
    }
    return key.call(game, code, down, repeat, shift);
  };
  return demo;
}
// The word that a full game's save is safe, on a demo's first game on this device.
export function sayFullSafe(game) { game.notice = { title: 'YOUR FULL GAME IS SAFE', sub: 'THE DEMO SAVES APART', colour: '#8ce060', t: 0, life: 6 }; }
