// The bomb is not sold: the owner took it out of the upgrades. The shop's rows are the other five, in their order;
// a game that buys every level the shop sells still has no charge, the bomb's key does nothing, and a save that had
// bought the bomb before keeps it (regress/c4-sift-row.mjs holds that).
import { makeGame, UPGRADES, SHOP } from '../harness.mjs';

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
check(SHOP.map(u => u.id).join() === 'tether,drill,winch,scanner,momentum', `the shop's rows are ${SHOP.map(u => u.id).join()}`);
check(UPGRADES.some(u => u.id === 'bombs'), 'the bomb has no row left for a saved game to keep its level under');

const game = await makeGame(7);
game.S.grit = 1e12; game.S.gems = game.S.gems.map(() => 1e6);
let bought = 0;
for (let turn = 0; turn < 100; turn++) for (const u of SHOP) if (game.canBuy(u)) { game.buy(u); bought++; }
check(bought > 20 && SHOP.every(u => game.cost(u) === null), `${bought} levels bought, and the shop still has something to sell`);
check(game.S.lv.bombs === 0 && game.bombs === 0 && game.val('bombs') === 0, `with the shop bought out the bomb is at level ${game.S.lv.bombs} with ${game.bombs} charges`);
game.blast();
check(game.bombs === 0 && game.shake !== 9, 'a blast went off in a game that has no bomb');

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : 'no defect: the shop sells five rows and no bomb');
process.exit(fails.length ? 1 : 0);
