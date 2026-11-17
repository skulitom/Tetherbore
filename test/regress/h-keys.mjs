// The keyboard's panel keys. U and Enter open the shop at the core; I, L, M and Escape open the bar's panel at
// STATS, LAB, MAP and MENU, and the key of the tab open shuts it; M does nothing before the chart is bought; Escape
// shuts whatever is open; with a panel open Tab steps through its tabs (Shift+Tab back) and 1 to 4 choose one, and
// with none open they are let through. A key flown with still shuts every panel.
import { makeGame } from '../harness.mjs';
const { TABS } = await import('../../js/shop.js');

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const game = await makeGame(7);
const panel = () => game.shop ? `shop:${game.shopTab}` : game.lab ? `lab:${game.labTab}` : 'shut';
const press = (code, shift = false) => { const took = game.key(code, true, false, shift); game.key(code, false); return took; };

check(game.atCore && panel() === 'shut', `a new game starts with ${panel()}`);
press('KeyI'); check(panel() === 'lab:stats', `I opened ${panel()}`);
press('KeyL'); check(panel() === 'lab:lab', `L with STATS open opened ${panel()}`);
press('KeyL'); check(panel() === 'shut', `L with LAB open left ${panel()}`);
check(press('KeyM') && panel() === 'shut', `M before the chart is bought opened ${panel()}`);
press('Escape'); check(panel() === 'lab:menu', `Escape with nothing open opened ${panel()}`);
press('Escape'); check(panel() === 'shut', `Escape with MENU open left ${panel()}`);

// Tab and the numbers walk the panel's tabs, which are three before the chart and four after.
press('KeyI'); press('Tab'); check(panel() === 'lab:lab', `Tab from STATS went to ${panel()}`);
press('Tab'); check(panel() === 'lab:menu', `Tab from LAB without the chart went to ${panel()}`);
press('Tab'); check(panel() === 'lab:stats', `Tab from MENU went round to ${panel()}`);
press('Tab', true); check(panel() === 'lab:menu', `Shift+Tab from STATS went to ${panel()}`);
press('Digit2'); check(panel() === 'lab:lab', `2 chose ${panel()}`);
press('Digit4'); check(panel() === 'lab:lab', `4 with three tabs chose ${panel()}`);
game.S.lv.chart = 1;
press('Digit3'); check(panel() === 'lab:chart', `3 with the chart chose ${panel()}`);
press('KeyM'); check(panel() === 'shut', `M with MAP open left ${panel()}`);
press('KeyM'); check(panel() === 'lab:chart', `M with the chart opened ${panel()}`);
press('ArrowLeft'); check(panel() === 'shut', `a key flown with left ${panel()}`);

// The shop: its own tabs, in the order they are drawn; Escape shuts it and opens nothing.
press('KeyU'); check(panel() === `shop:${TABS[0].id}`, `U at the core opened ${panel()}`);
press('Tab'); check(panel() === `shop:${TABS[1].id}`, `Tab in the shop went to ${panel()}`);
press('Numpad4'); check(panel() === `shop:${TABS[3].id}`, `4 in the shop chose ${panel()}`);
press('Tab'); check(panel() === `shop:${TABS[0].id}`, `Tab from the last tab of the shop went to ${panel()}`);
press('KeyL'); check(panel() === 'lab:lab', `L with the shop open opened ${panel()}`);
press('Enter'); check(panel() === `shop:${TABS[0].id}`, `Enter with LAB open at the core opened ${panel()}`);
press('Escape'); check(panel() === 'shut', `Escape in the shop left ${panel()}`);

// With nothing open the numbers are not the game's, and Tab is kept from leaving the page.
check(!press('Digit1') && panel() === 'shut', 'a number with nothing open was taken');
check(press('Tab') && panel() === 'shut', `Tab with nothing open was let through or opened ${panel()}`);

for (const f of fails) console.log(f);
console.log(fails.length ? `${fails.length} FAILED` : 'the panel keys hold');
process.exit(fails.length ? 1 : 0);
