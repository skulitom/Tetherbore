// The four pockets met further out, one to a direction, each with a mineral of its own and one rule: a glaze's
// pane shatters whole and leaves its starglass standing; shale cut along the grain splits off a plank; a ring of
// fuse cut into burns away and its heart, with the fire opals in it, hangs on nothing; a grotto's caps light as
// the drill flies by, and only a lit cap is the grotto's mineral. None lies nearer the core than 300 cells, and a
// direction's first pocket is what it always was.
import { makeGame, world, C, N, K, B } from '../harness.mjs';

const { BIOMES } = world, { LAB } = await import('../../js/game.js');
const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const game = await makeGame(7, { tether: 9, drill: 4 }), w = game.world;
const all = w.pocketsWithin(1500), named = id => BIOMES[id].name, of = name => all.filter(Z => named(Z.row) === name);
const cellsOf = Z => { const out = []; for (let y = Z.cy - 40; y <= Z.cy + 40; y++) for (let x = Z.cx - 40; x <= Z.cx + 40; x++) if (w.inPocket(Z, x, y)) out.push(y * N + x); return out; };

// ---- where they lie, and what each is
{
  const rows = { grotto: [B.MIRE, 'lantern', 'glow'], tinder: [B.EMBER, 'opal', 'fuse'], glaze: [B.FROST, 'starglass', 'pane'], shale: [B.LODE, 'agate', 'plank'] };
  for (const [name, [kin, mineral, twist]] of Object.entries(rows)) {
    const row = BIOMES.find(r => r?.name === name), found = of(name), far = Z => Math.hypot(Z.cx - C, Z.cy - C);
    check(row?.pocket?.mineral === mineral && row.pocket.twist === twist && row.kin === kin, `${name}: its row says ${row?.pocket?.mineral}, ${row?.pocket?.twist}, kin ${row?.kin}`);
    check(found.length >= 3 && found.every(Z => far(Z) >= 300 && Z.kin === kin && !Z.herald), `${name}: ${found.length} within 1,500 cells, the nearest ${Math.round(Math.min(...found.map(far)))} out, in directions ${[...new Set(found.map(Z => Z.kin))]}`);
    check(LAB.some(e => e.key === `minerals:${mineral}`), `the lab does not know ${mineral}`);
  }
  check(LAB.length === 64, `the lab knows ${LAB.length} things, not sixty-four`);
  const heralds = all.filter(Z => Z.herald).map(Z => named(Z.row)).sort().join();
  check(heralds === 'ash,drift,drift,hive', `the four directions' first pockets are ${heralds}`);
}

// ---- a glaze: one bite takes the pane, and the starglass stays
{
  // (A starglass whose pane lies whole inside the pocket: a pane at the edge is only the cells of it that are the pocket's.)
  const whole = (Z, i) => w.k(i) === K.MINERAL && w.paneOf(Z, i % N, Math.floor(i / N)).length === 10;
  const Z = of('glaze').find(Z => cellsOf(Z).some(i => whole(Z, i))), cells = cellsOf(Z);
  const star = cells.find(i => whole(Z, i)), pane = w.paneOf(Z, star % N, Math.floor(star / N)), ice = pane.filter(i => w.k(i) === K.SOFT);
  check(pane.length === 10 && pane.includes(star) && ice.length === pane.length - 1, `the pane of a starglass is ${pane.length} cells, ${ice.length} of them ice`);
  check(new Set(pane.map(i => w.paneKey(Z, i % N, Math.floor(i / N)))).size === 1 && pane.every(i => w.paneOf(Z, i % N, Math.floor(i / N)).length === pane.length), 'the cells of a pane do not agree which pane they are of');
  const also = game.alsoOpens(ice[0]);
  check(also.length === ice.length - 1 && !also.includes(star) && !also.includes(ice[0]), `a bite at the pane would open ${also.length} cells more`);
  game.finishDig(ice[0]);
  check(ice.every(i => w.k(i) === K.EMPTY) && w.k(star) === K.MINERAL, `after the bite ${ice.filter(i => w.k(i) === K.EMPTY).length} of the pane's ${ice.length} cells of ice are gone, and the starglass is ${w.k(star) === K.MINERAL ? 'standing' : 'gone'}`);
  // A bite at the starglass itself crushes it and takes nothing else.
  const other = cells.find(i => w.k(i) === K.MINERAL && i !== star);
  if (other !== undefined) { check(game.alsoOpens(other).length === 0, 'a bite at a starglass would shatter its pane'); }
  // Past the tether's reach a pane does not go.
  game.S.lv.tether = 0;
  const far = cells.find(i => w.k(i) === K.SOFT);
  check(game.alsoOpens(far).length === 0, `with a reach of 12 a bite ${Math.round(Math.hypot(far % N - C, Math.floor(far / N) - C))} cells out would open ${game.alsoOpens(far).length} cells more`);
  game.S.lv.tether = 9;
}

// ---- a shale stack: a plank along the grain, one cell across it
{
  const Z = of('shale')[0], cells = new Set(cellsOf(Z)), d = game.drill;
  const run = [...cells].find(i => [0, 1, 2, 3, 4].every(n => cells.has(i + n) && w.k(i + n) === K.SOFT));
  d.digX = 1; d.digY = 0;
  const plank = game.alsoOpens(run);
  check(plank.join() === [run + 1, run + 2, run + 3].join(), `cut level, a bite would open ${plank.length} cells more`);
  d.digX = 0; d.digY = 1;
  check(game.alsoOpens(run).length === 0, `cut across the beds, a bite would open ${game.alsoOpens(run).length} cells more`);
  d.digX = 1; d.digY = 0;
  game.finishDig(run);
  check([0, 1, 2, 3].every(n => w.k(run + n) === K.EMPTY) && w.k(run + 4) === K.SOFT, 'the plank did not go, or more than the plank went');
  // A seam of agate stops a plank: the agate is never split away.
  const seam = [...cells].find(i => w.k(i) === K.SOFT && cells.has(i + 1) && w.k(i + 1) === K.SOFT && w.k(i + 2) === K.MINERAL);
  if (seam !== undefined) { const got = game.alsoOpens(seam); check(got.join() === String(seam + 1), `beside a seam a bite would open ${got.length} cells more`); }
  const agates = [...cells].filter(i => w.k(i) === K.MINERAL);
  check(agates.length >= 8 && new Set(agates.map(i => Math.floor(i / N))).size < agates.length / 2, `the stack holds ${agates.length} agates in ${new Set(agates.map(i => Math.floor(i / N))).size} beds`);
}

// ---- a tinderwork: the ring burns, and what it held hangs loose
{
  const Z = of('tinder')[0], cells = cellsOf(Z), fuse = cells.filter(i => w.k(i) === K.NODE);
  // The ring about the pocket's middle: the fuse nearest it, and all the fuse joined to that.
  const near = fuse.slice().sort((a, b) => Math.hypot(a % N - Z.cx, Math.floor(a / N) - Z.cy) - Math.hypot(b % N - Z.cx, Math.floor(b / N) - Z.cy))[0];
  const heart = [], middle = Z.cy * N + Z.cx;
  for (const seen = new Set([middle]), queue = [middle]; queue.length;) { const at = queue.pop(); heart.push(at); for (const s of [1, -1, N, -N]) if (!seen.has(at + s) && w.k(at + s) !== K.NODE && w.k(at + s) !== K.EMPTY && heart.length < 400) { seen.add(at + s); queue.push(at + s); } }
  check(fuse.length >= 20 && heart.length >= 12 && heart.length < 120 && heart.some(i => w.k(i) === K.MINERAL), `the ring at the middle of a tinderwork holds ${heart.length} cells, ${heart.filter(i => w.k(i) === K.MINERAL).length} of them opal, in ${fuse.length} cells of fuse`);
  const was = game.pieces.length;
  game.finishDig(near);
  check(game.fuses.length === 1, `a bite at the fuse set ${game.fuses.length} rings burning`);
  let frames = 0;
  for (; frames < 600 && game.fuses.length; frames++) game.update(1 / 60);
  const ring = fuse.filter(i => Math.abs(Math.hypot(i % N - Z.cx, Math.floor(i / N) - Z.cy) - Math.hypot(near % N - Z.cx, Math.floor(near / N) - Z.cy)) < 3);
  check(frames > 6 && frames < 300 && ring.every(i => w.k(i) === K.EMPTY), `after ${(frames / 60).toFixed(1)} s ${ring.filter(i => w.k(i) === K.EMPTY).length} of the ring's ${ring.length} cells of fuse are burnt`);
  check(heart.every(i => game.pieceOf.has(i)) && game.pieces.length === was + 1, `${heart.filter(i => game.pieceOf.has(i)).length} of the heart's ${heart.length} cells are known to hang loose, in ${game.pieces.length - was} piece more`);
}

// ---- a grotto: caps light as the drill flies by
{
  const Z = of('grotto')[0], cells = cellsOf(Z), dull = cells.filter(i => w.k(i) === K.CAP);
  check(dull.length >= 4 && !cells.some(i => w.k(i) === K.CAP_LIT) && dull.every(i => [1, -1, N, -N].some(s => w.k(i + s) === K.EMPTY)), `a grotto has ${dull.length} caps, every one on a cave's wall`);
  // The drill is set down in the cave beside one.
  const cap = dull[0], side = [1, -1, N, -N].find(s => w.k(cap + s) === K.EMPTY), at = cap + side, d = game.drill;
  d.x = d.px = at % N + 0.5; d.y = d.py = Math.floor(at / N) + 0.5; d.home = false; d.mode = 'free'; game.band = [[d.x, d.y], [C + 0.5, C + 0.5]];
  const version = game.version;
  game.glow();
  check(w.k(cap) === K.CAP_LIT && game.version > version, `the cap beside the drill is ${w.k(cap) === K.CAP_LIT ? 'lit' : 'dull'}`);
  const lit = cells.filter(i => w.k(i) === K.CAP_LIT), still = cells.filter(i => w.k(i) === K.CAP);
  check(lit.every(i => Math.hypot(i % N + 0.5 - d.x, Math.floor(i / N) + 0.5 - d.y) <= 2.1) && still.every(i => Math.hypot(i % N + 0.5 - d.x, Math.floor(i / N) + 0.5 - d.y) > 2.1), `${lit.length} caps lit, and ${still.length} are dull still`);
  // Only a lit cap pays as the grotto's mineral.
  const pay = game.payOf([cap]), plain = still.length ? game.payOf([still[0]]) : null;
  check(pay.minerals === 1 && pay.mineral === 'lantern' && (!plain || (plain.minerals === 0 && plain.grit < pay.grit)), `a lit cap hauled pays ${pay.grit} grit as ${pay.minerals} of '${pay.mineral}'; a dull one ${plain?.grit}`);
  game.resize(360, 640, 1); game.render();
}

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : 'no defect: glaze, shale stack, tinderwork and lantern grotto lie from 300 cells out, each in its own direction, and each plays by its rule: a pane shatters whole, a plank splits along the grain, a ring of fuse burns its heart loose, and caps light as the drill flies by');
process.exit(fails.length ? 1 : 0);
