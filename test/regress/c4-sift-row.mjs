// Content item 4: the bomb's row in the shop. It is the row it was (the same id, so a saved game keeps its level;
// the same place; charges 0 to 4; the south's gems), it says what the bomb now does, and its prices are the plan's,
// worked out by the game's own `priced` at two fifths of the reach each lies beside: 210, 4.3K, 64K and 150 gems,
// 370K and 790 gems. A level bought fills the rack, and the rack is filled again at the core.
import { makeGame, UPGRADES, B } from '../harness.mjs';

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const row = UPGRADES.find(u => u.id === 'bombs');
check(UPGRADES.indexOf(row) === 5 && row.name === 'BLAST' && row.icon === 'bomb', `the bomb's row is number ${UPGRADES.indexOf(row)}, named ${row?.name}`);
check(row.what === 'BOMB: SHAKES ORE LOOSE', `the row reads '${row.what}'`);
check(JSON.stringify(row.values) === '[0,1,2,3,4]' && row.gem === B.EMBER, `charges ${JSON.stringify(row.values)}, gems of ground ${row.gem}`);
check(JSON.stringify(row.grit) === '[210,4300,64000,370000]' && JSON.stringify(row.gems) === '[0,0,150,790]', `prices ${JSON.stringify(row.grit)} and gems ${JSON.stringify(row.gems)}`);
check(JSON.stringify(row.beside) === '[1,2.8,5,7.4]', `the levels of reach the prices lie beside: ${JSON.stringify(row.beside)}`);

// A saved game's level is kept under the same id, and buying a level racks its charges.
const game = await makeGame(7);
game.S.grit = 1e6; game.S.gems[B.EMBER] = 1000;
for (let level = 1; level <= 4; level++) {
  const before = game.S.grit, c = game.cost(row);
  game.buy(row);
  check(game.S.lv.bombs === level && game.bombs === level && before - game.S.grit === row.grit[level - 1] && c.gems === row.gems[level - 1], `bought level ${level}: level ${game.S.lv.bombs}, ${game.bombs} charges, ${before - game.S.grit} grit paid`);
}
check(game.cost(row) === null, 'there is a fifth level of BLAST to buy');
localStorage.setItem('tetherbore-save-v3', JSON.stringify({ v: 3, ...game.S, lv: { ...game.S.lv, bombs: 2 } }));
const again = await makeGame(7);
await again.restore();
check(again.S.lv.bombs === 2 && again.bombs === 2, `a saved game with bombs at 2 came back with level ${again.S.lv.bombs} and ${again.bombs} charges`);

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : "no defect: the bomb's row is where it was, says what the bomb does and costs what the plan says");
process.exit(fails.length ? 1 : 0);
