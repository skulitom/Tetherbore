// The ancient stone of the deep, to the lab (js/world.js: STONES, `stoneOf`, `hallWall`; js/game.js: `sampleOf`,
// `studied`; js/drawing.js: `overlay`). Vault is a thing the lab knows only where it is a shrine's walls or a
// builders' hall's, and which it is the world says from where it was laid, cell for cell as `kindAt` lays it:
//   - round each of the four shrines on worlds 7 and 11 (the three pieces each way round its heart, as the world
//     makes them), every cell of vault within the shrine is its corner's stone and every other cell of vault (the
//     old veins in the rock) is none; nothing but vault is ever known as a stone; a shrine not laid (`unshrined`) or
//     in a piece of an older generation has none;
//   - in halls on worlds 7 and 11, every cell of vault within a hall's walls is the builders' stone, every other
//     cell of vault in its square is none, and nothing that is not vault is a stone;
//   - each stone is drawn as the frame the lab knows it by ('stones:<name>', which the lab has), and plain vault is
//     drawn and known as nothing; a cell of vault asked about with no place is nothing;
//   - hauled, a shrine's or a hall's vault pays with the lab empty what vault paid before it was a thing of the
//     lab's, and a hundredth more a level once it is analysed; plain vault pays the same with every stone known;
//   - cut, a shrine's or a hall's vault is a sample of its stone, said as analysed the first time, and plain vault
//     is no sample.
// Fails on the code before: the world says no vault is a stone, and the lab knows none.
//   node test/regress/l-stones.mjs
import { makeGame, world, N, C, K } from '../harness.mjs';
const { World, SHRINES, STONES, HALL } = world;
const { LAB_OF, labLevel } = await import('../../js/shop.js');

const fails = [], check = (ok, what) => { if (!ok && fails.length < 24) fails.push(what); };
if (typeof World.prototype.stoneOf !== 'function' || !STONES) {
  console.log('DEFECT: the world does not say which vault is ancient stone (`stoneOf`, STONES)');
  process.exit(1);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const KEYS = STONES.map(name => `stones:${name}`);
check(KEYS.every(key => LAB_OF[key]), `the lab does not know ${KEYS.filter(key => !LAB_OF[key])}`);

// What the game draws, knows and pays a cell as, and that this agrees with the world.
const asked = (game, i, want, where) => {
  const w = game.world, row = w.row(i), key = want < 0 ? null : KEYS[want];
  check(same(game.overlay(K.VAULT, row, i), want < 0 ? null : ['stones', STONES[want]]), `${where}: vault is drawn as ${JSON.stringify(game.overlay(K.VAULT, row, i))}, not ${want < 0 ? 'nothing' : STONES[want]}`);
  check(game.sampleOf(K.VAULT, row, i) === key, `${where}: vault is known as ${game.sampleOf(K.VAULT, row, i)}, not ${key}`);
};
const found = { shrine: [], vein: [], hall: [] };
for (const seed of [7, 11]) {
  const game = await makeGame(seed), w = game.world;
  // ---- the shrines
  for (let d = 0; d < 4; d++) {
    const hx = C + SHRINES[d][0], hy = C + SHRINES[d][1];
    check(w.shrine(d), `world ${seed}: the shrine ${d} is not laid`);
    let stones = 0, veins = 0;
    for (let y = ((hy >> 6) - 1) * 64; y < ((hy >> 6) + 2) * 64; y++) for (let x = ((hx >> 6) - 1) * 64; x < ((hx >> 6) + 2) * 64; x++) {
      const k = w.at(x, y), s = w.stoneOf(x, y), edge = Math.max(Math.abs(x - hx), Math.abs(y - hy)), where = `world ${seed}, shrine ${d}, ${x - C},${y - C}`;
      if (k !== K.VAULT) { check(!KEYS.includes(game.sampleOf(k, w.row(y * N + x), y * N + x)), `${where}: a cell of kind ${k} is known as a stone`); continue; }
      check(s === (edge <= 5 ? d : -1), `${where}: vault ${edge} from the heart is stone ${s}`);
      check(w.kindAt(x, y, w.biomeAt(x, y)) === K.VAULT, `${where}: vault the world did not lay`);
      if (s === d) { stones++; if (found.shrine.length < 8 && stones === 3) found.shrine.push({ seed, d, i: y * N + x }); }
      else { veins++; if (found.vein.length < 4 && veins === 1) found.vein.push({ seed, i: y * N + x }); }
    }
    check(stones >= 20, `world ${seed}: the shrine ${d} has ${stones} cells of vault`);
    // (Not laid, or in an older game's piece: none.)
    const ring = hy * N + hx + 2, gen = ((hy >> 6) << 8) | ((hx + 2) >> 6), was = w.genOf[gen];
    w.unshrined = 1 << d; check(w.stoneOf(hx + 2, hy) === -1, `world ${seed}: the shrine ${d}, not laid, has its stone`); w.unshrined = 0;
    w.genOf[gen] = 1; check(w.stoneOf(hx + 2, hy) === -1, `world ${seed}: the shrine ${d}, in a piece of generation 1, has its stone`); w.genOf[gen] = was;
    check(w.stoneOf(ring % N, Math.floor(ring / N)) === d, `world ${seed}: the shrine ${d} has no stone two cells east of its heart`);
  }
  // ---- the halls: up to four in each world, the first found going round the relics' squares
  let halls = 0;
  for (let sy = -50; sy < 50 && halls < 4; sy++) for (let sx = -50; sx < 50 && halls < 4; sx++) {
    const H = w.hallOf(sx, sy);
    if (!H || (seed === 7 ? sx + sy : sx - sy) % 3) continue;
    halls++;
    let walls = 0;
    const x0 = C + sx * HALL, y0 = C + sy * HALL;
    for (let y = y0; y < y0 + HALL; y++) for (let x = x0; x < x0 + HALL; x++) {
      const k = w.at(x, y), s = w.stoneOf(x, y), inside = x >= H.x0 && x <= H.x1 && y >= H.y0 && y <= H.y1, where = `world ${seed}, hall ${sx},${sy}, ${x - C},${y - C}`;
      if (k !== K.VAULT) { check(s < 0 && !KEYS.includes(game.sampleOf(k, w.row(y * N + x), y * N + x)), `${where}: a cell of kind ${k} is a stone ${s}`); continue; }
      check(s === (inside ? 4 : -1), `${where}: vault ${inside ? 'in' : 'outside'} the hall's walls is stone ${s}`);
      check(w.kindAt(x, y, w.biomeAt(x, y)) === K.VAULT, `${where}: vault the world did not lay`);
      if (s === 4) { walls++; if (walls === 5 && found.hall.length < 4) found.hall.push({ seed, i: y * N + x }); }
      else if (found.vein.length < 6) found.vein.push({ seed, i: y * N + x });
    }
    check(walls >= 40, `world ${seed}: the hall at ${sx},${sy} has ${walls} cells of wall`);
  }
  check(halls === 4, `world ${seed}: ${halls} halls asked about, not 4`);
}
check(found.shrine.length === 8 && found.hall.length === 4 && found.vein.length >= 4, `found ${found.shrine.length} shrines' stones, ${found.hall.length} halls' and ${found.vein.length} veins to try`);

// ---- drawn, known, paid and cut, on worlds 7 and 11
for (const seed of [7, 11]) {
  const game = await makeGame(seed), w = game.world, S = game.S;
  const cases = [...found.shrine.filter(f => f.seed === seed).map(f => ({ ...f, want: f.d })), ...found.hall.filter(f => f.seed === seed).map(f => ({ ...f, want: 4 })), ...found.vein.filter(f => f.seed === seed).map(f => ({ ...f, want: -1 }))];
  for (const { i, want } of cases) {
    const x = i % N, y = Math.floor(i / N), where = `world ${seed}, ${x - C},${y - C}`;
    check(w.at(x, y) === K.VAULT, `${where}: not vault`);
    asked(game, i, want, where);
    check(game.sampleOf(K.VAULT, w.row(i)) === null && game.overlay(K.VAULT, w.row(i)) === null, `${where}: vault asked about with no place is a stone`);
    // Hauled: with the lab empty as before it was a thing of the lab's (the world saying no vault is a stone), and
    // a hundredth more a level once analysed; plain vault the same with every stone known.
    const extra = [{ k: K.VAULT, b: w.b(i), x, y }];
    S.lab = {};
    const now = game.payOf([], extra).grit, stone = w.stoneOf;
    w.stoneOf = () => -1;
    const before = game.payOf([], extra).grit;
    w.stoneOf = stone;
    check(now === before, `${where}: a cell of vault pays ${now} grit with the lab empty, not ${before} as before`);
    S.lab = Object.fromEntries(KEYS.map(key => [key, 16]));
    const known = game.payOf([], extra).grit;
    check(want < 0 ? known === before : Math.abs(known - before * (1 + labLevel(16) / 100)) <= 1, `${where}: with sixteen samples of each stone it pays ${known} grit, against ${before}`);
    S.lab = {};
    // Cut: a sample of its stone, or none.
    game.popups.length = 0; game.crushedAt = -9;
    w.see(x, y, 2); game.finishDig(i);
    check(want < 0 ? Object.keys(S.lab).length === 0 : S.lab[KEYS[want]] === 1 && Object.keys(S.lab).length === 1, `${where}: cut, the lab holds ${JSON.stringify(S.lab)}`);
    check(want < 0 || game.popups.some(p => p.label === 'ANALYSED +1%'), `${where}: the first sample of ${STONES[want]} was not said to be analysed`);
    check(w.at(x, y) === K.EMPTY, `${where}: cut, it is ${w.at(x, y)}`);
  }
}

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : 'ok: the shrines\' walls and the builders\' halls\' are stones where the world lays them and nowhere else, drawn and known as the lab has them, paying as vault did until analysed, and counted when cut');
process.exit(fails.length ? 1 : 0);
