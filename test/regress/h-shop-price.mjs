// The shop while the first haul's rubble is still on its way: can the first REACH be bought, and in what colour is its
// price drawn? (#ffe14a is the game's "you have enough" colour, #ff7a5a its "you are short" colour.) The price must
// be lit by what has come home, as the purchase is judged: red while the tap would be refused.
//   node test/regress/h-shop-price.mjs
import '../harness.mjs';

// Know each tinted copy of the font by the colour it was filled with.
const make = document.createElement;
document.createElement = () => { const c = make(); const ctx = c.getContext('2d'); c.getContext = () => new Proxy(ctx, { set: (t, k, v) => { if (k === 'fillStyle') c.tint = v; t[k] = v; return true; } }); return c; };
const { makeGame, UPGRADES } = await import('../harness.mjs');
const { fixRandom, flyTo } = await import('./lib/lasso.mjs');
fixRandom(5);
const game = await makeGame(7), S = game.S;
for (const [x, y] of [[2, -2], [6, -2], [6, 1], [3, 1], [0, 0]]) if (flyTo(game, x, y, { tol: x === 0 ? 0.05 : 0.2 }) < 0) throw new Error('never arrived');
game.key('Enter', true);
const glyphs = [];
// Only the price on the REACH row (the first): right of x = 120, rows y 64 to 95 on this 180 x 320 screen; the shadow copy is left out.
game.ctx.drawImage = (image, sx, sy, sw, sh, dx, dy) => { if (image && image.tint && image.tint !== '#0c0a12' && dx > 120 && dy >= 64 && dy < 96) glyphs.push(image.tint); };
const look = label => {
  glyphs.length = 0; game.shopRise = 1; game.render();
  console.log(`${label}: grit ${S.grit}, on its way ${game.pending.grit}, banked ${game.banked()}, REACH costs ${game.cost(UPGRADES[0]).grit}, canBuy ${game.canBuy(UPGRADES[0])}; the price's glyphs are drawn in ${JSON.stringify(glyphs)}`);
  return glyphs.filter(t => t === '#ff7a5a').length;
};
const redWhileRefused = look('rubble on its way');
const before = S.lv.tether; game.buy(UPGRADES[0]);
console.log(`buy(): reach level ${before} -> ${S.lv.tether}, note "${game.shopNote?.text}"`);
game.shopNote = null;
S.grit = 14; game.pending.grit = 0;
const redWhenShort = look('by hand: 14 grit, nothing on its way');
const bad = !(redWhileRefused > 0 && redWhenShort > 0);
console.log(bad ? 'DEFECT: the price is drawn as affordable while the purchase is refused' : 'no defect');
process.exit(bad ? 1 : 0);
