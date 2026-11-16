// The lab. What the bit crushes is a sample analysed: the count is kept by the thing's own key (the sheet and frame
// it is drawn from), a level is earned by the first sample and at every doubling of the count, each level makes
// every one of that thing hauled worth a hundredth more (and nothing else worth more), the cell says CRUSHED and,
// under it, SAMPLE and the count or ANALYSED and the new worth, the count is saved and a game saved before the lab loads with none, and a new world starts with none.
// The notes are opened and shut by a tap on the bar, they are a list that scrolls (dragged, flicked, wheeled and
// stepped with the keys), a line is chosen by a tap, and no line or note is wider or longer than its panel holds on
// the narrowest phone.
import { makeGame, K, N, C } from '../harness.mjs';
const { LAB, labLevel, labNext } = await import('../../js/game.js');
const { LAB_KINS } = await import('../../js/shop.js');
const { LAB_LIST, LAB_RH, LAB_SEC, NOTE_LINES } = await import('../../js/drawing.js');
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
check(said.includes('CRUSHED') && said.includes('ANALYSED +1%'), `the cell said ${said}`);
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
check(game.S.lab['lode-items:oreA'] === 5 && game.popups.some(p => p.label === 'CRUSHED') && game.popups.some(p => p.label === 'SAMPLE 5/8'), `the fifth sample said ${game.popups.map(p => p.label)}`);
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

// The notes: a tap on the bar at the foot of the screen opens them, at the thing last analysed, in view. They are
// one list in five parts, longer than a phone's panel, that scrolls: a finger dragged moves it as far as the finger
// went and chooses nothing; a finger that comes down and up where it was is a tap and chooses the line under it (a
// part's head is not a line to choose); flicked, it runs on after the finger is gone and comes to rest within two
// seconds, never past either end; a wheel over it scrolls it; up and down choose the line before and after and
// show it, End the last, and a key held down walks on through the list (and does nothing with the notes shut). The
// list makes no hit area of its own, and the drill does not move while it is up; a tap outside shuts it.
game.resize(320, 568, 1); game.render();
const tap = (x, y) => { game.pointerDown(1, x, y); game.pointerUp(1); game.render(); };
const steps = (n, dt = 1 / 60) => { for (let f = 0; f < n; f++) game.update(dt); };
tap(30, game.H - 20);
check(game.lab === true && game.labSel === 'lode-items:oreB', `after a tap on the bar the notes are ${game.lab ? 'open' : 'shut'} at ${game.labSel}`);
for (let f = 0; f < 10; f++) game.render();
const g = game.labGeom(), inView = key => { const i = LAB.findIndex(e => e.key === key), y = LAB_LIST.at[i] - game.labScroll; return y >= LAB_SEC - 1 && y + LAB_RH <= g.view + 1; };
check(g.view < LAB_LIST.content && Math.floor(g.view / LAB_RH) < LAB.length, `the whole list of ${LAB.length} is in view at 320 by 568 (${g.view} of ${LAB_LIST.content} pixels): it need not scroll`);
check(inView('lode-items:oreB'), `the thing last analysed is not in view on opening (scrolled ${game.labScroll})`);
check(!game.buttons.some(b => b.h === LAB_RH), 'the list still makes a hit area for each line');
check(game.buttons.every(b => b.swallow || b.y + b.h <= g.vy || b.y >= g.vy + g.view), 'a hit area lies over the list');
// A drag of 100 pixels up the list scrolls it about 100 and chooses nothing.
{
  const was = game.labSel, from = game.labScroll = 0;
  game.pointerDown(1, g.vx + 30, g.vy + g.view - 20);
  for (let n = 1; n <= 10; n++) { game.pointerMove(1, g.vx + 30, g.vy + g.view - 20 - n * 10); game.update(1 / 60); }
  game.pointerUp(1);
  check(Math.abs(game.labScroll - from - 100) <= 2 && game.labSel === was, `a drag of 100 pixels scrolled the list ${game.labScroll - from} and chose ${game.labSel}`);
  steps(150);
  check(game.labVel === 0 && game.labScroll >= 0 && game.labScroll <= g.most, `two and a half seconds after a drag the list moves at ${game.labVel} (at ${game.labScroll})`);
}
// A tap on a line chooses it; a tap with a twitch of the finger under five pixels is a tap still; a tap on a part's
// head chooses nothing.
{
  game.labScroll = 0; game.render();
  const third = LAB_LIST.at[2], y = g.vy + third + 5;
  tap(g.vx + 40, y);
  check(game.labSel === LAB[2].key, `a tap on the third line chose ${game.labSel}`);
  game.pointerDown(1, g.vx + 40, g.vy + LAB_LIST.at[3] + 4); game.pointerMove(1, g.vx + 42, g.vy + LAB_LIST.at[3] + 7); game.pointerUp(1);
  check(game.labSel === LAB[3].key && game.labScroll === 0, `a tap that twitched three pixels chose ${game.labSel} and scrolled ${game.labScroll}`);
  tap(g.vx + 40, g.vy + LAB_LIST.head[1] + 4);
  check(game.labSel === LAB[3].key, `a tap on the head of the north chose ${game.labSel}`);
}
// A flick runs on after the finger lets go, and comes to rest within two seconds, inside the ends.
for (const way of [1, -1]) {
  game.labScroll = way > 0 ? 0 : g.most; game.labVel = 0; game.render();
  const y0 = way > 0 ? g.vy + g.view - 10 : g.vy + 20;
  game.pointerDown(1, g.vx + 30, y0);
  for (let n = 1; n <= 4; n++) { game.pointerMove(1, g.vx + 30, y0 - way * n * 12); game.update(1 / 60); }
  game.pointerUp(1);
  const let_go = game.labScroll;
  steps(1);
  check(way * (game.labScroll - let_go) > 0, `flicked ${way > 0 ? 'up' : 'down'}, the list stood still when the finger let go`);
  let past = false;
  for (let f = 0; f < 120; f++) { game.update(1 / 60); if (game.labScroll < 0 || game.labScroll > g.most) past = true; }
  check(game.labVel === 0 && !past, `flicked ${way > 0 ? 'up' : 'down'}, the list ${past ? 'went past its end' : `still moves at ${game.labVel} after two seconds`}`);
}
// A hard flick stops at the end and goes no further.
{
  game.labScroll = g.most - 20; game.labVel = 0;
  game.pointerDown(1, g.vx + 30, g.vy + g.view - 5); game.pointerMove(1, g.vx + 30, g.vy + 5); game.update(1 / 60); game.pointerUp(1);
  steps(60);
  check(game.labScroll === g.most && game.labVel === 0, `flicked hard at the end the list is at ${game.labScroll} of ${g.most}, moving ${game.labVel}`);
}
// The wheel: over the panel it scrolls, outside it does nothing.
{
  game.labScroll = 100; game.render();
  check(game.wheel(g.vx + 30, g.vy + 30, 48) && game.labScroll === 148, `a wheel over the list left it at ${game.labScroll}`);
  check(!game.wheel(1, 1, 48) && game.labScroll === 148, 'a wheel outside the panel scrolled the list');
  game.wheel(g.vx + 30, g.vy + 30, 1e6);
  check(game.labScroll === g.most, `a great turn of the wheel scrolled the list to ${game.labScroll} of ${g.most}`);
}
// The keys: down chooses the next line and shows it, End the last at the end of the list, a key held walks on.
{
  game.labScroll = 0; game.labSel = LAB[0].key;
  for (let n = 0; n < 14; n++) game.key('ArrowDown', true);
  steps(30); game.render();
  check(game.labSel === LAB[14].key && inView(LAB[14].key), `fourteen downs chose ${game.labSel}, ${inView(game.labSel) ? '' : 'not '}in view (at ${game.labScroll})`);
  game.key('End', true); steps(60); game.render();
  check(game.labSel === LAB.at(-1).key && game.labScroll === g.most, `End chose ${game.labSel} with the list at ${game.labScroll} of ${g.most}`);
  game.key('ArrowUp', true, true); game.key('ArrowUp', true, true);
  check(game.labSel === LAB.at(-3).key, `an up held down walked to ${game.labSel}`);
  game.key('Home', true); steps(60);
  check(game.labSel === LAB[0].key && game.labScroll === 0, `Home chose ${game.labSel} with the list at ${game.labScroll}`);
  game.labTab = 'stats';
  check(game.key('ArrowDown', true, true) === false && game.labSel === LAB[0].key, 'a held key walked the list with another tab open');
  game.key('ArrowDown', false); game.labTab = 'lab';
}
const at = [game.drill.x, game.drill.y];
game.input.auto = [1, 0, 1]; for (let f = 0; f < 30; f++) game.update(1 / 60); game.input.auto = null;
check(game.drill.x === at[0] && game.drill.y === at[1], 'the drill moved with the notes open');
tap(2, 2);
check(game.lab === false, 'a tap outside the notes left them open');
// A tap while the panel is still rising lands on the line drawn under it.
{
  game.openLab(true, 'lab'); game.render();
  const r = game.labGeom(), y = r.vy + LAB_LIST.at[5] - game.labScroll + 5;
  if (y > r.vy + LAB_SEC && y < r.vy + r.view) { tap(r.vx + 40, y); check(game.labSel === LAB[5].key, `a tap as the panel rose chose ${game.labSel}, not ${LAB[5].key}`); }
  game.openLab(false);
}
// The list draws on a short screen and on a wide one, known and unknown lines alike, scrolled anywhere.
for (const [cw, ch] of [[600, 260], [360, 640], [1200, 800]]) {
  game.resize(cw, ch, 1); game.openLab(true, 'lab');
  for (const s of [0, 200, 1e6]) { game.labScroll = s; game.render(); }
  game.openLab(false);
}
// No name, place, head or note overflows the panel at its narrowest (320 by 568: 152 pixels of panel, 136 of
// text), and every note, and what is said of what is not yet known, fits the lines drawn under the list.
game.resize(320, 568, 1);
const narrow = game.labGeom(), text = narrow.pw - 16, right = narrow.vw - 5;
check(narrow.pw === 152, `the narrowest panel is ${narrow.pw} pixels, not 152`);
const wrapped = words => { const lines = []; for (const word of words.split(' ')) { const last = lines.at(-1); if (last !== undefined && textWidth(`${last} ${word}`) <= text) lines[lines.length - 1] = `${last} ${word}`; else lines.push(word); } return lines; };
for (const e of LAB) {
  check(18 + textWidth(e.name) + 4 + textWidth('+11%') <= right, `${e.name} is too long for its line`);
  check(18 + textWidth(e.at) <= right, `${e.name}: '${e.at}' is too long for its line`);
  for (const word of `${e.note} CUT THROUGH ONE WITH THE BIT. FOUND: ${e.where}.`.split(' ')) check(textWidth(word) <= text, `'${word}' is wider than the notes`);
  check(wrapped(e.note).length <= NOTE_LINES, `${e.name}: its note takes ${wrapped(e.note).length} lines, of ${NOTE_LINES}`);
  check(wrapped(`CUT THROUGH ONE WITH THE BIT. FOUND: ${e.where}.`).length <= NOTE_LINES, `${e.name}: where it is found takes ${wrapped(`CUT THROUGH ONE WITH THE BIT. FOUND: ${e.where}.`).length} lines`);
}
check(textWidth('99K SAMPLES. +1% AT 131K') <= text, 'what is said of a count of samples is wider than the notes');
LAB_KINS.forEach(([title], kin) => { const all = LAB.filter(e => e.kin === kin).length; check(16 + textWidth(title) + 4 + textWidth(`${all}/${all}`) <= right, `the head ${title} is too long for its line`); });

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : 'no defect: what is crushed is analysed, what is known pays a hundredth more a level, and the notes open from the bar as a list of forty-eight that scrolls');
process.exit(fails.length ? 1 : 0);
