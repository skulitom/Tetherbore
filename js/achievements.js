// What a player has done that is worth a medal: the list, the watcher that sees each earned, the word that comes up
// over the bar, and the list the menu opens. It knows nothing of any platform: on the desktop the Electron shell puts
// `window.tetherboreDesktop` in the page (desktop/preload.cjs), which is told what has been earned, and on the web
// there is nothing to tell.
//
// Nothing of the game asks it anything but whether a word is up (`up`, so that a thing's worth waits for it). It reads
// the game and writes only its own fields: it draws from no random stream, lays no cell and makes no piece of the world.
// `off` (js/main.js for a staged view, test/harness.mjs unless asked) leaves it out altogether.
//
// What is earned is kept for the player and not for the world: in the save, beside the game (`ach`, a list of API
// names, written only once there is one), so a trip lost, which puts `S` back to the docking, and NEW WORLD, which makes
// a new `S`, both leave it. A lord is earned at its fall, though the kill itself is kept only if the drill gets home:
// the fight was won either way. A game saved before there were medals is credited on load with all its state proves
// (`has`); what only a moment proves (`hauled`, `note`) is earned from then on.
import { draw, slice9, text, textWidth, wrap } from './atlas.js';
import { rowOf, SEAMS } from './world.js';
import { REACH } from './shop.js';
import { sfx } from './audio.js';
import { DEMO } from './edition.js';

const lord = d => S => ((S.bosses ?? 0) >> (4 + d) & 1) === 1;
const metDir = kin => S => { for (const key in S.met ?? {}) { const row = rowOf(+key); if (row && !row.pocket && row.kin === kin) return true; } return false; };
const best = n => S => (S.stats?.best ?? 0) >= n;
const count = list => (list ?? []).filter(Boolean).length;
// The seven kinds of pocket, by their rows' names.
export const POCKET_KINDS = ['hive', 'drift', 'ash', 'glaze', 'shale', 'tinder', 'grotto'];
const pocketsMet = S => { const met = new Set(); for (const key in S.met ?? {}) { const row = rowOf(+key); if (row?.pocket) met.add(row.name); } return met; };
export const RARE_KINDS = ['bell', 'vent', 'worm', 'lodestone'];
export const LORD_IDS = ['ACH_LORD_KING', 'ACH_LORD_BEHEMOTH', 'ACH_LORD_MOTHER', 'ACH_LORD_WYRM'];

// Each: `id`, its API name on Steam; `name` and `says`, in English (js/words.js has them in the other two); `hidden`,
// where the name would spoil what is out there; and `has`, what a game's state proves, where it can. One with no `has`
// is earned only as it happens.
export const ACHIEVEMENTS = [
  { id: 'ACH_FIRST_HAUL', name: 'FIRST HAUL', says: 'REEL A PIECE OF GROUND HOME', has: S => (S.stats?.hauls ?? 0) >= 1 },
  { id: 'ACH_BIG_HAUL', name: 'CHUNKY', says: 'HAUL 30 CELLS AT ONCE', has: best(30) },
  { id: 'ACH_HUGE_HAUL', name: 'WHOPPER', says: 'HAUL 150 CELLS AT ONCE', has: best(150) },
  { id: 'ACH_COLOSSAL_HAUL', name: 'GEOLOGY HAPPENED', says: 'HAUL 550 CELLS AT ONCE', has: best(550) },
  { id: 'ACH_MOUNTAINOUS', name: 'MOUNTAIN MOVER', says: 'HAUL 1000 CELLS AT ONCE', has: best(1000) },
  { id: 'ACH_HALF_WORLD', name: 'HALF THE WORLD', says: 'TAKE HALF THE LONGEST REACH IN ONE HAUL', hidden: true },
  { id: 'ACH_CLUTCH', name: 'NERVES OF STEEL', says: 'HAUL 80 CELLS ON YOUR LAST HALF HEART' },
  { id: 'ACH_MOTHER_LODE', name: 'MOTHER LODE', says: 'HAUL 30 CELLS OR MORE, HALF OF THEM ORE' },
  { id: 'ACH_HOT_POTATO', name: 'HOT POTATO', says: 'HAUL THREE SLEEPING HAZARDS AT ONCE' },
  { id: 'ACH_WINCH_CRYING', name: 'THE WINCH IS CRYING', says: 'HAUL MORE THAN THE WINCH CAN LOAD' },
  { id: 'ACH_HULL_GONE', name: 'INSURANCE CLAIM', says: 'LOSE THE DRILL AND DIG AGAIN', has: (S, earned, game) => (game?.wrecks ?? 0) > 0 },
  { id: 'ACH_NORTH', name: 'INTO THE ICE', says: 'REACH THE GROUND OF THE NORTH', has: metDir(1) },
  { id: 'ACH_SOUTH', name: 'INTO THE FIRE', says: 'REACH THE GROUND OF THE SOUTH', has: metDir(2) },
  { id: 'ACH_WEST', name: 'INTO THE MIRE', says: 'REACH THE GROUND OF THE WEST', has: metDir(3) },
  { id: 'ACH_EAST', name: 'INTO THE SANDS', says: 'REACH THE GROUND OF THE EAST', has: metDir(4) },
  { id: 'ACH_LONG_WAY', name: 'THE LONG WAY OUT', says: 'TAKE THE DRILL 1000 CELLS FROM THE CORE', has: S => (S.out ?? 0) >= 1000 },
  { id: 'ACH_FIRST_POCKET', name: 'A PLACE OF ITS OWN', says: 'FLY INTO A POCKET', has: S => pocketsMet(S).size > 0 },
  { id: 'ACH_ALL_POCKETS', name: 'POCKET COLLECTOR', says: 'VISIT ALL SEVEN KINDS OF POCKET', has: S => { const met = pocketsMet(S); return POCKET_KINDS.every(k => met.has(k)); } },
  { id: 'ACH_FOUR_SEAMS', name: 'WHERE GROUNDS MEET', says: 'FIND ALL FOUR SEAMS ON THE DIAGONALS', has: S => SEAMS.every(([a, b]) => S.met?.[a] || S.met?.[b]) },
  { id: 'ACH_WRECK_PART', name: 'SALVAGE', says: 'HAUL A PART FROM A WRECK', has: S => count(S.wrecks) > 0 },
  { id: 'ACH_FIRST_RELIC', name: 'SOMETHING SEALED', says: 'BRING A RELIC HOME', has: S => count(S.relics) > 0 },
  { id: 'ACH_ALL_RELICS', name: 'ALL FOUR HOME', says: 'BRING ALL FOUR RELICS HOME', has: S => count(S.relics) === 4 },
  { id: 'ACH_FIRST_SHRINE', name: 'CORNERSTONE', says: 'HAUL A SHRINE WHOLE', has: S => count(S.shrines) > 0 },
  { id: 'ACH_FOSSIL', name: 'WHOLE BONES', says: 'HAUL A FOSSIL WHOLE', has: S => (S.fossils ?? 0) !== 0 },
  { id: 'ACH_CAUGHT_LIVE', name: 'CAUGHT LIVE', says: 'HAUL A RARE HAZARD WHILE IT IS AWAKE' },
  { id: 'ACH_ALL_RARES', name: 'RARE BIRDS', says: 'MEET ALL FOUR RARE HAZARDS', has: S => RARE_KINDS.every(k => S.rare?.[k]) },
  { id: 'ACH_PAL', name: 'GOOD PUP', says: 'FEED A BURROWPUP THREE ORES', has: S => !!S.fauna?.pal },
  { id: 'ACH_EVICTED', name: 'ECO-VANDAL', says: 'CATCH A PUFFLING IN A LOOP' },
  { id: 'ACH_LORD_WYRM', name: 'WYRM, LOOPED', says: 'BEAT THE FROST WYRM WITH A LOOP OF THE TETHER', hidden: true, has: lord(3) },
  { id: 'ACH_LORD_BEHEMOTH', name: 'BEHEMOTH, RAMMED', says: 'BEAT THE MAGMA BEHEMOTH BY RAMMING IT', hidden: true, has: lord(1) },
  { id: 'ACH_LORD_MOTHER', name: 'MOTHER, CUT', says: 'BEAT THE SPORE MOTHER BY CUTTING HER ANCHOR', hidden: true, has: lord(2) },
  { id: 'ACH_LORD_KING', name: 'KING, HAULED', says: 'HAUL HIS SHARDS AND BEAT THE CRYSTAL KING', hidden: true, has: lord(0) },
  { id: 'ACH_ALL_LORDS', name: 'THE DEEP IS STILL', says: 'BEAT ALL FOUR LORDS', hidden: true, has: (S, earned) => LORD_IDS.every(id => earned.has(id)) },
  { id: 'ACH_FIRST_UPGRADE', name: 'TOOLED UP', says: 'BUY AN UPGRADE AT THE CORE', has: S => (S.stats?.buys ?? 0) >= 1 },
  { id: 'ACH_STARLINE', name: 'STARLINE', says: 'BUY THE LAST REACH OF THE TETHER', has: S => (S.lv?.tether ?? 0) >= REACH.length - 1 },
  { id: 'ACH_LAB_36', name: 'FIELD NOTES', says: 'ANALYSE 36 KINDS IN THE LAB', has: S => Object.values(S.lab ?? {}).filter(n => n > 0).length >= 36 },
];
const BY_ID = new Map(ACHIEVEMENTS.map(a => [a.id, a]));
// The demo's lord is not the full game's: beating it earns none of the lords' medals, which wait for the real fights.
const NOT_IN_DEMO = DEMO ? new Set([...LORD_IDS, 'ACH_ALL_LORDS']) : null;
// How often the state is looked at, in seconds of play (a haul, a purchase and a lord's fall are looked at as they
// come), how long a word stays up, and the size of a row of the list and of the words under it.
const EVERY = 1, TOAST = 4, ROW = 20, FOOT = 38, GOLD = '#ffe14a', DIM = '#c8c4d4', SECRET = 'A SECRET, UNTIL IT IS EARNED';
const INSET = 4, CHIP = 16, BAR = 44, DOCK = 2, EDGE = 4, CALL = 6;

export class Achievements {
  constructor() {
    this.earned = new Set(); this.queue = []; this.toast = null; this.off = false;
    this.since = 0; this.synced = false; this.dirty = false; this.held = false;
    this.sel = 0; this.rect = [0, 0, 0, 0];
  }
  // Whether a word is up or on its way to the screen.
  get up() { return this.toast !== null; }
  get count() { let n = 0; for (const a of ACHIEVEMENTS) if (this.earned.has(a.id)) n++; return n; }
  // What goes in the save beside the game: nothing until something is earned, so a save with none is as it was.
  saved() { return this.earned.size ? { ach: [...this.earned] } : {}; }

  // One earned: once, whatever asks twice. Kept at the end of this frame (`step`), told to the platform at once.
  earn(id) {
    const a = BY_ID.get(id);
    if (this.off || !a || this.earned.has(id) || NOT_IN_DEMO?.has(id)) return false;
    this.earned.add(id); this.dirty = true;
    this.queue.push({ head: 'ACHIEVEMENT', name: a.name });
    this.tell('unlock', id);
    return true;
  }
  // What the platform is told, where there is one. (It may be absent, and it may fail: neither is the game's concern.)
  // (A demo tells Steam nothing: what it earns is kept in the save, and the full game tells it.)
  tell(what, arg) {
    if (DEMO) return;
    try { globalThis.tetherboreDesktop?.achievements?.[what]?.(arg)?.catch?.(() => {}); } catch { /* the game goes on */ }
  }
  // A game loaded (`Game.restore`): what its save has earned joins what is held (a list this build does not know is
  // kept whole, for the build that does), and what its state proves is credited, quietly but for one word.
  load(list, S) {
    if (Array.isArray(list)) for (const id of list) if (typeof id === 'string') this.earned.add(id);
    this.synced = false;
    if (this.off) return;
    let credited = 0;
    for (const a of ACHIEVEMENTS) if (a.has && !this.earned.has(a.id) && !NOT_IN_DEMO?.has(a.id) && a.has(S, this.earned)) { this.earned.add(a.id); credited++; }
    if (credited) this.queue.push({ head: 'ACHIEVEMENTS', name: `+${credited} FROM YOUR SAVE` });
  }
  // The state looked at: whatever it now proves is earned.
  check(game) {
    if (this.off || !game.S) return;
    for (const a of ACHIEVEMENTS) if (a.has && !this.earned.has(a.id) && a.has(game.S, this.earned, game)) this.earn(a.id);
  }
  // A haul just made (`Game.haul`): what only the moment proves, then the state. `half`: it was HALF THE WORLD.
  hauled(game, pay, n, half) {
    if (this.off) return;
    if (half) this.earn('ACH_HALF_WORLD');
    if (n >= 80 && game.dents > 0 && game.hull === 1) this.earn('ACH_CLUTCH');
    if (n >= 30 && pay.ores * 2 >= n) this.earn('ACH_MOTHER_LODE');
    if (pay.hazards >= 3) this.earn('ACH_HOT_POTATO');
    if (pay.over < 1) this.earn('ACH_WINCH_CRYING');
    if (pay.caught > 0) this.earn('ACH_CAUGHT_LIVE');
    this.check(game);
  }
  // Each frame (the end of `Game.update`): the state now and then, the platform told what is held, what was earned
  // saved, and the word on show.
  step(game, dt) {
    if (this.off) return;
    if ((this.since += dt) >= EVERY) { this.since = 0; this.check(game); }
    if (!this.synced) { this.synced = true; this.tell('sync', [...this.earned]); }
    if (this.dirty && !game.loading) { this.dirty = false; game.save(); }
    const open = this.clear(game);
    if (!this.toast && this.queue.length && open && !game.eye) { this.toast = { ...this.queue.shift(), t: 0, W: 0, w: 0 }; sfx.gem?.(5); }
    if (this.toast && open && !this.held && (this.toast.t += dt) > TOAST) this.toast = null;
  }
  // A word stands where a thing's worth does, and as that does it waits out a panel, the core (where the shop's
  // button is) and a drill lying dead.
  clear(game) { return !game.shop && !game.lab && !game.atCore && game.drill.mode !== 'dead'; }

  draw(game) {
    const e = this.toast;
    if (this.off || !e || !this.clear(game)) return;
    const { ctx, W, H } = game;
    if (e.W !== W) { e.W = W; e.w = Math.min(W - 2 * EDGE, Math.max(textWidth(e.head), textWidth(e.name)) + CHIP + 2 * INSET); }
    const h = 2 * INSET + 22, slide = Math.min(1, e.t / 0.15), top = H - BAR + DOCK - EDGE - h;
    // (What is called out across the screen comes first: the word waits while that reaches down on to its place.)
    this.held = (game.hudBelow ?? 0) - CALL > top - EDGE;
    if (this.held) return;
    const x = W > H ? EDGE : Math.round(W / 2 - e.w / 2), y = top + Math.round((1 - slide) * (1 - slide) * 8);
    ctx.globalAlpha = Math.min(1, slide, (TOAST - e.t) / 0.3);
    slice9(ctx, 'ui', 'panel', x, y, e.w, h);
    this.rect[0] = x; this.rect[1] = y; this.rect[2] = e.w; this.rect[3] = h;
    game.panels.push(this.rect);
    draw(ctx, 'icons', 'check', x + INSET + 1, y + INSET + 6);
    text(ctx, e.head, x + INSET + CHIP - 2, y + INSET + 1, GOLD);
    text(ctx, e.name, x + INSET + CHIP - 2, y + INSET + 12, '#ffffff');
    ctx.globalAlpha = 1;
  }

  // The list, in the menu's panel: a page of rows, the one chosen said in full under them. A row is chosen by a tap
  // or the up and down keys, a page turned by its arrows or Page Up and Down. A hidden one says nothing until earned.
  drawList(game, px, y0, pw, ph) {
    const { ctx } = game, x = px + INSET, w = pw - 2 * INSET, top = y0 + 16;
    const per = Math.max(3, Math.floor((ph - 16 - FOOT - INSET) / ROW)), pages = Math.ceil(ACHIEVEMENTS.length / per);
    this.per = per;
    const page = Math.floor(this.sel / per), got = `${this.count}/${ACHIEVEMENTS.length}`, title = `ACHIEVEMENTS ${got}`;
    const nav = 16, pageAt = `${page + 1}/${pages}`, navW = 2 * nav + textWidth(pageAt) + 4;
    text(ctx, textWidth(title) <= w - navW - INSET ? title : got, x + INSET, y0 + 4, GOLD);
    text(ctx, pageAt, x + w - nav - 2, y0 + 4, '#ffffff', 1);
    const turn = (label, bx, by) => {
      text(ctx, label, bx + nav / 2, y0 + 4, '#8cf2c4', 0.5);
      game.buttons.unshift({ x: bx, y: y0, w: nav, h: 14, act: () => { this.sel = Math.max(0, Math.min(ACHIEVEMENTS.length - 1, (page + by) * per)); sfx.tap(); } });
    };
    turn('<', x + w - navW, -1 + page >= 0 ? -1 : 0);
    turn('>', x + w - nav, page + 1 < pages ? 1 : 0);
    for (let n = page * per, row = 0; n < ACHIEVEMENTS.length && row < per; n++, row++) {
      const a = ACHIEVEMENTS[n], has = this.earned.has(a.id), y = top + row * ROW, on = n === this.sel;
      slice9(ctx, 'ui', on ? 'button-down' : 'button', x, y, w, ROW - 2);
      draw(ctx, 'icons', has ? 'check' : 'lock', x + INSET, y + 4);
      text(ctx, a.hidden && !has ? '???' : a.name, x + INSET + 14, y + 5, has ? GOLD : DIM);
      game.buttons.unshift({ x, y, w, h: ROW - 2, act: () => { this.sel = n; sfx.tap(); } });
    }
    const a = ACHIEVEMENTS[this.sel], lines = wrap(a.hidden && !this.earned.has(a.id) ? SECRET : a.says, w - 2 * INSET);
    for (let l = 0; l < Math.min(3, lines.length); l++) text(ctx, lines[l], x + INSET, top + per * ROW + 2 + l * 11, '#ffffff');
  }
  // The keys of the list; says whether it took the key.
  key(code) {
    const per = this.per ?? 6, step = { ArrowUp: -1, KeyW: -1, ArrowDown: 1, KeyS: 1, PageUp: -per, PageDown: per }[code];
    if (step === undefined) return false;
    this.sel = Math.max(0, Math.min(ACHIEVEMENTS.length - 1, this.sel + step));
    return true;
  }
}
