// The lab. What the bit crushes is a sample analysed: the count is kept by the thing's own key (the sheet and frame
// it is drawn from), a level is earned by the first sample and at every doubling of the count, each level makes
// every one of that thing hauled worth a hundredth more (and nothing else worth more), the cell says what was
// learnt, the count is saved and a game saved before the lab loads with none, and a new world starts with none.
// The notes are opened and shut by a tap on the top bar, a line is chosen by a tap, and no note is wider than its
// panel on the narrowest phone.
import { makeGame, K, N, C } from '../harness.mjs';
const { LAB, labLevel, labNext } = await import('../../js/game.js');
const { textWidth } = await import('../../js/atlas.js');

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
check([0, 1, 2, 3, 4, 7, 8, 1023, 1024].map(labLevel).join() === '0,1,2,2,3,3,4,10,11', `levels by count: ${[0, 1, 2, 3, 4, 7, 8, 1023, 1024].map(labLevel)}`);
check([1, 2, 3, 4, 5, 8].map(labNext).join() === '2,4,4,8,8,16', `the next level comes at ${[1, 2, 3, 4, 5, 8].map(labNext)}`);
check(new Set(LAB.map(e => e.key)).size === LAB.length && LAB.every(e => e.name && e.where && e.note), 'a row of the lab has no name, place or note, or two share a key');

const game = await makeGame(7), w = game.world;
// Ore staged in the home ground, east of the core: a block of copper, a block of violet quartz, a block of plain rock.
const block = (x0, k) => { const cells = []; for (let y = 0; y < 5; y++) for (let x = 0; x < 10; x++) { const i = (C + 20 + y) * N + C + x0 + x; w.setK(i, k); cells.push(i); } return cells; };
const copper = block(-20, K.ORE_A), quartz = block(-5, K.ORE_B), plain = block(10, K.SOFT);
const pay = cells => game.payOf(cells).grit;
const base = { copper: pay(copper), quartz: pay(quartz), plain: pay(plain) };
check(Object.keys(game.S.lab).length === 0, `a new game's lab holds ${JSON.stringify(game.S.lab)}`);

// One cell of copper crushed: one sample, the first level, said on the cell, and copper alone is worth more.
const crushed = copper.pop();
game.finishDig(crushed);
const said = game.popups.map(p => p.label);
check(game.S.lab['lode-items:oreA'] === 1 && Object.keys(game.S.lab).length === 1, `after one cell of copper crushed the lab holds ${JSON.stringify(game.S.lab)}`);
check(said.includes('COPPER +1%') && !said.includes('CRUSHED'), `the cell said ${said}`);
const one = pay(copper.concat(crushed)), near = (got, want) => Math.abs(got - want) <= 1;
w.setK(crushed, K.ORE_A); copper.push(crushed);
check(near(pay(copper), base.copper * 1.01), `fifty cells of copper paid ${base.copper} and pay ${pay(copper)} with one sample`);
check(pay(quartz) === base.quartz && pay(plain) === base.plain, 'a sample of copper changed what quartz or plain rock pays');
// Levels by count: the second sample, the fourth, and none at the third.
for (const [count, level] of [[2, 2], [3, 2], [4, 3], [64, 7]]) {
  game.S.lab['lode-items:oreA'] = count;
  check(near(pay(copper), base.copper * (1 + level / 100)), `with ${count} samples copper pays ${pay(copper)}, not ${base.copper} and ${level} hundredths more`);
}
// A sample that earns no level says how far the count has come; one that does says the new worth.
game.S.lab['lode-items:oreA'] = 4; game.popups.length = 0; game.crushedAt = -9;
const again = copper.pop(); game.finishDig(again);
check(game.S.lab['lode-items:oreA'] === 5 && game.popups.some(p => p.label === 'COPPER 5/8'), `the fifth sample said ${game.popups.map(p => p.label)}`);
// Quartz is its own row, and a pocket's mineral pays its lump more.
game.finishDig(quartz.pop());
check(game.S.lab['lode-items:oreB'] === 1, `after quartz crushed the lab holds ${JSON.stringify(game.S.lab)}`);

// Saved and loaded; and a game saved before the lab has none.
game.save();
const loaded = await makeGame(7); await loaded.restore();
check(loaded.S.lab['lode-items:oreA'] === 5 && loaded.S.lab['lode-items:oreB'] === 1, `loaded, the lab holds ${JSON.stringify(loaded.S.lab)}`);
const { lab, ...old } = game.S;
localStorage.setItem('tetherbore-save-v3', JSON.stringify({ v: 3, ...old }));
const before = await makeGame(7); await before.restore();
check(before.S.lab && Object.keys(before.S.lab).length === 0, `a game saved before the lab loads with ${JSON.stringify(before.S.lab)}`);
loaded.fresh(9);
check(Object.keys(loaded.S.lab).length === 0 && !loaded.lab, 'a new world keeps the old lab');

// The notes: a tap on the top bar opens them, a tap on a line chooses it, a tap outside shuts them; the drill
// does not move while they are up.
game.resize(320, 568, 1); game.render();
const tap = (x, y) => { game.pointerDown(1, x, y); game.pointerUp(1); game.render(); };
tap(30, 10);
// (They open at the thing a level was last gained in: the quartz.)
check(game.lab === true && game.labSel === 'lode-items:oreB', `after a tap on the top bar the notes are ${game.lab ? 'open' : 'shut'} at ${game.labSel}`);
// (Lines are 13 high; the newest button is the last line drawn.)
const lines = game.buttons.filter(b => b.h === 13).sort((a, b) => a.y - b.y);
check(lines.length === LAB.length, `${lines.length} lines can be tapped at 320 by 568, of ${LAB.length}`);
tap(lines[2].x + 5, lines[2].y + 5);
check(game.lab && game.labSel === LAB[2].key, `a tap on the third line chose ${game.labSel}`);
const at = [game.drill.x, game.drill.y];
game.input.auto = [1, 0, 1]; for (let f = 0; f < 30; f++) game.update(1 / 60); game.input.auto = null;
check(game.drill.x === at[0] && game.drill.y === at[1], 'the drill moved with the notes open');
tap(2, game.H - 2);
check(game.lab === false, 'a tap outside the notes left them open');
// Every page of the notes draws on a short screen, known and unknown lines alike.
game.resize(600, 260, 1); game.openLab(true);
for (let n = 0; n < 4; n++) { game.render(); const next = game.buttons.find(b => b.h === 16 && b.x > game.W / 2); if (next) next.act(); }
game.openLab(false);
// No name or note overflows the panel at 320 wide (172 pixels of panel, 156 of text).
for (const e of LAB) {
  check(textWidth(e.name) + textWidth('+11%') + 22 + 14 <= 172, `${e.name} is too long for its line`);
  for (const word of `${e.note} CRUSH ONE WITH THE BIT. FOUND: ${e.where}.`.split(' ')) check(textWidth(word) <= 156, `'${word}' is wider than the notes`);
}

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : 'no defect: what is crushed is analysed, what is known pays a hundredth more a level, and the notes open from the top bar');
process.exit(fails.length ? 1 : 0);
