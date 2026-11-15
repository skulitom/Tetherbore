// What was bought and banked is kept in local storage, the ground in the browser's database. Where the database
// cannot be opened (the harness stands in for exactly that), restore() gives up before it has taken what local
// storage holds, so a reload starts a new game, and that game's first save writes over the old one.
//   node test/hunt/modes/restore-no-db.mjs
import { makeGame, Game, UPGRADES } from '../harness.mjs';
const game = await makeGame(7);
game.S.grit = 5000;
for (let n = 0; n < 3; n++) game.buy(UPGRADES.find(u => u.id === 'tether'));
game.save();
const kept = JSON.parse(localStorage.getItem('tetherbore-save-v3'));
console.log(`saved to local storage: reach level ${kept.lv.tether}, grit ${kept.grit}, seed ${kept.seed}`);
// A reload: what js/main.js does.
const canvas = { width: 0, height: 0, style: {}, getContext: () => new Proxy({}, { get: () => () => ({ data: new Uint8ClampedArray(4) }), set: () => true }) };
const again = new Game(canvas);
const ok = await again.restore();
console.log(`restore() returned ${ok}; the reloaded game has reach level ${again.S.lv.tether}, grit ${again.S.grit}, seed ${again.S.seed === kept.seed ? 'the same' : 'a different one'}`);
again.save();                                     // as the page does when it is hidden, and every 20 s
const after = JSON.parse(localStorage.getItem('tetherbore-save-v3'));
console.log(`after the reloaded game's first save, local storage holds: reach level ${after.lv.tether}, grit ${after.grit}`);
process.exit(ok ? 0 : 1);
