// Tetherbore: what the player is saving for. Of everything in the shop's four tabs, one row is the next thing to buy
// (`goal`): the bar at the foot of the screen draws a line along its top edge as far as what is banked has come
// towards its price, the shop pins it, and coming home with enough says so at the core. The opening buys four
// levels in a second, and from about an hour and a half on every level waits on something other than grit: a
// thing named, and how near it is, is a reason to fly out through both.
//
// Which row it is:
//   - a row the player taps and cannot yet pay for, where nothing is still to be found for it (`lacks`): that row,
//     held until its level is bought (or the game is another);
//   - otherwise, each time the drill comes home and after each purchase, the row with a next level, nothing to be
//     found for it and not yet paid for, that asks least grit of those whose gems and specimens are in hand; and
//     where none of them has its gems and specimens in hand, the one that asks least grit;
//   - a goal that can now be paid for stays the goal until it is bought.
// Its price is kept as it was when it was chosen, so that drawing it every frame asks nothing of the shop and makes
// nothing. Nothing of it is saved: a game loaded, begun again or gone back to a docking chooses afresh (`of`, the
// state it was chosen for).
import { C } from './world.js';
import { ROWS } from './shop.js';

// The goal of a game, made once on the game and filled again: the row (`id`, null for none, and its `name`), the
// level it was chosen at, its price (grit; gems and whose, `gem`; specimens and whose, `kin`), whether the player
// chose it (`pinned`), and the state it is for.
const fresh = () => ({ of: null, id: null, name: '', level: -1, grit: 0, gems: 0, gem: 0, spec: 0, kin: 0, pinned: false });

// The row's price, written into the goal.
function hold(game, g, u, pinned) {
  const c = game.cost(u);
  g.id = u.id; g.name = u.name; g.level = game.S.lv[u.id]; g.pinned = pinned;
  g.grit = c.grit; g.gems = c.gems; g.gem = c.gem; g.spec = c.spec; g.kin = u.kin ?? 0;
  return g;
}
const ROW = new Map(ROWS.map(u => [u.id, u]));

// Chooses the goal, as above; `row`, a row the player tapped and could not pay for. Returns the goal.
export function pickGoal(game, row = null) {
  const g = game.goal ??= fresh(), S = game.S;
  if (g.of !== S) { g.of = S; g.id = null; g.pinned = false; }
  if (row) return game.cost(row) && !game.lacks(row) ? hold(game, g, row, true) : g;
  // (The goal so far stands while its level does: the player's choice whatever, and the game's own once it can be
  // paid for.)
  const was = g.id === null ? null : ROW.get(g.id);
  if (was && S.lv[was.id] === g.level && game.cost(was) && !game.lacks(was) && (g.pinned || game.canBuy(was))) return hold(game, g, was, g.pinned);
  let best = null, least = 0, held = false;
  for (const u of ROWS) {
    const c = game.cost(u);
    if (!c || game.lacks(u) || game.canBuy(u)) continue;
    const has = game.banked(c.gem) >= c.gems && (!c.spec || game.specs(u.kin) >= c.spec);
    if (best === null || (has && !held) || (has === held && c.grit < least)) { best = u; least = c.grit; held = has; }
  }
  if (best) return hold(game, g, best, false);
  g.id = null; g.name = ''; g.level = -1; g.pinned = false;
  return g;
}

// How far what is banked has come towards the goal's price, 0 to 1: the least of its grit, its gems and its
// specimens. (0 with no goal.)
export function goalShare(game) {
  const g = game.goal;
  if (!g || g.of !== game.S || g.id === null) return 0;
  let share = g.grit > 0 ? game.banked() / g.grit : 1;
  if (g.gems > 0) share = Math.min(share, game.banked(g.gem) / g.gems);
  if (g.spec > 0) share = Math.min(share, game.specs(g.kin) / g.spec);
  return Math.max(0, Math.min(1, share));
}

// The drill has come home: where the goal can be paid for now, the core says so; and the goal is chosen again.
export function goalHome(game) {
  const g = pickGoal(game), u = g.id === null ? null : ROW.get(g.id);
  if (u && game.canBuy(u)) game.popup(C, C - 1.1, `${g.name} READY`, '#ffe14a');
  return g;
}
