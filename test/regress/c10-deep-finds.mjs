// Twin stones and fossils (js/world.js: `find`, `findAt`, FINDS, TWIN_R, FOSSIL_R, FOSSILS, `fossilKin`), as the
// world of generation 2 lays them in its own pieces, on worlds 1 to 6:
//   - twin stones only where the find's middle is over 800 cells out, fossils only over 1,200, and neither in an
//     older game's ground (generation 1), where the sectors of their bands hold nothing laid, as they always did;
//     nor where anything laid over a find could take a cell of one (`findRoom`: a slab any sector could try, a
//     wreck, a relic's vault, a shrine that is laid), which is named and not laid, and every such one has one of
//     those by it;
//   - each laid within four cells of its middle, which is five cells or more from where any pocket's cells can lie,
//     so no cell of one is a pocket's;
//   - twin stones: two cells of K.TWIN three cells either side of the middle along one way, each in a ring of
//     dense rock; a fossil: four to seven bones of K.FOSSIL, joined, each a cell on from the last, in a bed of
//     dense rock, and the first three cells behind the middle (the finder's cell, js/drawing.js);
//   - what a fossil is, its middle's direction says, with no wandering border: north FROZEN BEAST, south EMBER RIBS,
//     west ROOT WYRM, east AMMONITE;
//   - in the world's own pieces every cell of every one is there, so that each can be paid whole (a slab's ground
//     took a stone or a bone of one in two hundred, which could never pay, though the rest was drawn);
//   - a find whose middle's piece is of generation 1 lays nothing anywhere, and one whose middle's piece is of
//     generation 2 lays nothing in a piece of generation 1 beside it.
// And what they pay (js/game.js: `payOf`, `haul`, TWIN_LUMP, BONE_LUMP, TWIN_SPEC, BONE_SPEC), on world 7: twin
// stones both in one haul a lump of TWIN_LUMP seconds of what cutting where they lie earns and a specimen of their
// direction, called TWIN STONES!; one alone, its cells' grit and no more; a fossil whole BONE_LUMP seconds a bone
// and two specimens, called by its species, and counted found by its direction (`fossils`); one with a bone left
// behind, its cells' grit. The game's part fails on the game before they paid: no lump, no title, nothing found.
//   node test/regress/c10-deep-finds.mjs
import { World, N, C, K, FIND, TWIN_R, FOSSIL_R, FOSSILS, fossilKin, rowOf } from '../../js/world.js';

const fails = [], check = (ok, what) => { if (!ok && fails.length < 16) fails.push(what); };
check(TWIN_R === 800 && FOSSIL_R === 1200 && FOSSILS.join() === ',FROZEN BEAST,EMBER RIBS,ROOT WYRM,AMMONITE', `twin stones from ${TWIN_R}, fossils from ${FOSSIL_R}, of ${FOSSILS}`);
check(fossilKin(C, C - 500) === 1 && fossilKin(C, C + 500) === 2 && fossilKin(C - 500, C + 100) === 3 && fossilKin(C + 500, C - 499) === 4, 'a fossil is not its middle\'s direction\'s');
const sums = { twins: 0, fossils: 0, nearTwins: 0, nearFossils: 0, oldLaid: 0, inPocket: 0, laidInWorld: 0, notInWorld: 0, roomless: 0, kinds: [0, 0, 0, 0, 0], bones: [0, 0, 0, 0, 0, 0, 0, 0], unjoined: 0, firstBone: 0 };
for (let seed = 1; seed <= 6; seed++) {
  const w = new World(), old = new World(); w.reset(seed); old.reset(seed); old.genOf.fill(1);
  let looked = 0;
  for (let sy = -50; sy < 50; sy++) for (let sx = -50; sx < 50; sx++) {
    const what = w.findName(sx, sy), fx = w.asked.fx, fy = w.asked.fy, laid = w.asked.laid, r = Math.hypot(fx - C, fy - C);
    if ((what !== 'twin' && what !== 'fossil') || r > 2340) continue;
    old.findName(sx, sy);
    if (old.asked.laid) sums.oldLaid++;
    const out = r > (what === 'twin' ? TWIN_R : FOSSIL_R), room = w.findRoom(fx, fy);
    if (laid !== (out && room)) { check(false, `seed ${seed} ${what} at ${fx - C},${fy - C}, ${Math.round(r)} out: ${laid ? '' : 'not '}laid`); continue; }
    if (!out) { if (what === 'twin') sums.nearTwins++; else sums.nearFossils++; continue; }
    if (!room) {
      // (Refused: what is by it.)
      sums.roomless++;
      let by = w.slabTried(fx, fy, 6) || w.wrecks.some(([x, y]) => Math.max(Math.abs(x - fx), Math.abs(y - fy)) < 8);
      for (let y = fy - 9; y <= fy + 9 && !by; y++) for (let x = fx - 9; x <= fx + 9 && !by; x++) { const k = w.at(x, y); if (k === K.RELIC || k === K.VAULT) by = true; }
      check(by, `seed ${seed} ${what} at ${fx - C},${fy - C} is not laid, with nothing by it`);
      continue;
    }
    if (what === 'twin') sums.twins++; else sums.fossils++;
    if (w.meetsPocket(fx, fy, 5)) sums.inPocket++;
    // Cell by cell, from findAt, and (for every fifth) from the world's own pieces.
    const bones = [];
    let twin = 0, far = 0, bed = 0;
    for (let y = fy - 6; y <= fy + 6; y++) for (let x = fx - 6; x <= fx + 6; x++) {
      const k = w.findAt(x, y);
      if (k < 0) continue;
      if (rowOf(w.biomeAt(x, y)).pocket) sums.inPocket++;
      far = Math.max(far, Math.abs(x - fx), Math.abs(y - fy));
      if (k === K.TWIN) twin++; else if (k === K.FOSSIL) bones.push([x, y]); else if (k === K.DENSE) bed++;
    }
    check(far <= 4, `seed ${seed} ${what} at ${fx - C},${fy - C}: a cell of it lies ${far} from its middle`);
    if (what === 'twin') check(twin === 2 && bed === 16 && !bones.length, `seed ${seed} twin stones at ${fx - C},${fy - C}: ${twin} stones in ${bed} cells of dense rock`);
    else {
      sums.bones[bones.length]++; sums.kinds[fossilKin(fx, fy)]++;
      check(bones.length >= 4 && bones.length <= 7 && !twin && bed >= 8, `seed ${seed} fossil at ${fx - C},${fy - C}: ${bones.length} bones`);
      // Joined, side by side or across a corner, in a line: the first is three cells behind the middle.
      const joined = bones.every(([x, y]) => bones.some(([u, v]) => (u !== x || v !== y) && Math.abs(u - x) <= 1 && Math.abs(v - y) <= 1));
      if (!joined) sums.unjoined++;
      if (!bones.some(([x, y]) => Math.max(Math.abs(x - fx), Math.abs(y - fy)) === 3 && (x === fx || y === fy))) sums.firstBone++;
    }
    looked++;
    for (let y = fy - 4; y <= fy + 4; y++) for (let x = fx - 4; x <= fx + 4; x++) {
      const k = w.findAt(x, y), there = w.at(x, y);
      if (k !== K.TWIN && k !== K.FOSSIL) continue;
      if (there === k) sums.laidInWorld++;
      else { sums.notInWorld++; check(false, `seed ${seed} ${what} at ${fx - C},${fy - C}: its cell at ${x - fx},${y - fy} is ${there} in the world`); }
    }
  }
}
console.log(JSON.stringify(sums));
check(sums.twins > 500 && sums.fossils > 300 && sums.nearTwins > 100 && sums.nearFossils > 300, `twin stones laid ${sums.twins}, and ${sums.nearTwins} too near; fossils ${sums.fossils}, and ${sums.nearFossils} too near: too few to say`);
check(sums.oldLaid === 0, `${sums.oldLaid} twin stones or fossils are laid at generation 1`);
check(sums.inPocket === 0, `${sums.inPocket} cells or middles of twin stones and fossils lie in or by a pocket`);
check(sums.unjoined === 0 && sums.firstBone === 0, `${sums.unjoined} fossils' bones are not joined, ${sums.firstBone} have no bone three cells behind the middle`);
check(sums.kinds.slice(1).every(n => n > 40) && sums.bones.slice(4).every(n => n > 30), `the fossils by direction ${sums.kinds.slice(1)} and by bones ${sums.bones.slice(4)}`);
check(sums.laidInWorld > 3000 && sums.notInWorld === 0, `in the world's own pieces ${sums.laidInWorld} cells of twin stone and bone are there, and ${sums.notInWorld} are not`);
check(sums.roomless > 20 && sums.roomless < (sums.twins + sums.fossils) * 0.06, `${sums.roomless} twin stones and fossils far enough out are not laid for what is by them, of ${sums.twins + sums.fossils} laid`);

// A find's generation is its middle's piece's, and it lays nothing in a piece of generation 1.
{
  const w = new World(); w.reset(7);
  let tried = 0, wrong = 0;
  for (let sy = -40; sy < 40 && tried < 20; sy++) for (let sx = -40; sx < 40 && tried < 20; sx++) {
    w.genOf.fill(2); w.forget();
    const what = w.findName(sx, sy), fx = w.asked.fx, fy = w.asked.fy;
    if ((what !== 'twin' && what !== 'fossil') || !w.asked.laid) continue;
    // A find that reaches over the edge of its middle's piece.
    const home = ((fy >> 6) << 8) | (fx >> 6);
    let cells = 0, across = 0;
    for (let y = fy - 4; y <= fy + 4; y++) for (let x = fx - 4; x <= fx + 4; x++) if (w.findAt(x, y) >= 0) { cells++; if ((((y >> 6) << 8) | (x >> 6)) !== home) across++; }
    if (!across) continue;
    tried++;
    // Its middle's piece of generation 1: nothing anywhere.
    w.genOf.fill(2); w.genOf[home] = 1; w.forget();
    w.findName(sx, sy);
    for (let y = fy - 4; y <= fy + 4; y++) for (let x = fx - 4; x <= fx + 4; x++) if (w.findAt(x, y) >= 0) wrong++;
    // Every other piece of generation 1: only its middle's piece's cells.
    w.genOf.fill(1); w.genOf[home] = 2; w.forget();
    let kept = 0;
    for (let y = fy - 4; y <= fy + 4; y++) for (let x = fx - 4; x <= fx + 4; x++) if (w.findAt(x, y) >= 0) { kept++; if ((((y >> 6) << 8) | (x >> 6)) !== home) wrong++; }
    if (kept !== cells - across) wrong++;
  }
  check(tried >= 10 && wrong === 0, `of ${tried} finds across the edge of their middle's piece, ${wrong} cells are laid where a piece of generation 1 is`);
}

// What they pay.
{
  const { makeGame } = await import('../harness.mjs');
  const { income, round2 } = await import('../../js/shop.js');
  const game = await makeGame(7, { tether: 9 }), w = game.world, S = game.S;
  // Twin stones and fossils of world 7 that are laid, with their cells.
  const twins = [], fossils = [];
  for (let sy = -48; sy < 48 && (twins.length < 3 || fossils.length < 2); sy++) for (let sx = -48; sx < 48; sx++) {
    const what = w.findName(sx, sy), fx = w.asked.fx, fy = w.asked.fy, n = w.asked.n;
    if ((what !== 'twin' && what !== 'fossil') || !w.asked.laid) continue;
    const kind = what === 'twin' ? K.TWIN : K.FOSSIL, cells = [], bed = [];
    for (let y = fy - 4; y <= fy + 4; y++) for (let x = fx - 4; x <= fx + 4; x++) { const k = w.at(x, y); if (k === kind) cells.push(y * N + x); else if (k === K.DENSE) bed.push(y * N + x); }
    const one = { fx, fy, cells, bed, kin: fossilKin(fx, fy), far: Math.hypot(fx - C, fy - C) };
    if (what === 'twin' && cells.length === 2) twins.push(one);
    if (what === 'fossil' && cells.length === n) fossils.push(one);
  }
  check(twins.length >= 3 && fossils.length >= 2, `world 7 has ${twins.length} twin stones and ${fossils.length} fossils laid whole`);
  const haul = cells => { const spec = S.spec.slice(), pay = game.payOf(cells); game.haul(cells); return { pay, title: game.hauled.title, spec: S.spec.map((v, k) => +(v - spec[k]).toFixed(3)) }; };
  // Twin stones both in one haul, with their rings.
  {
    const t = twins[0], got = haul([...t.cells, ...t.bed]);
    check(got.pay.twins === 1 && got.pay.lump === round2(income(Math.max(22, t.far)) * 16), `twin stones hauled together: ${got.pay.twins} pairs, a lump of ${got.pay.lump}`);
    check(got.title === 'TWIN STONES!' && got.spec[t.kin] === 1 && got.spec.reduce((a, b) => a + b, 0) === 1, `twin stones hauled together are called ${got.title} and pay the specimens ${got.spec}`);
  }
  // One alone: its cells' grit and no more.
  {
    const t = twins[1], got = haul([t.cells[0]]);
    check(got.pay.twins === 0 && got.pay.lump === 0 && got.title !== 'TWIN STONES!' && got.spec.every(v => v === 0), `a twin stone alone: ${got.pay.twins} pairs, a lump of ${got.pay.lump}, called ${got.title}, specimens ${got.spec}`);
  }
  // A fossil whole, and one with a bone left behind.
  {
    const f = fossils[0], got = haul([...f.cells, ...f.bed]);
    check(got.pay.fossil === f.kin && got.pay.lump === round2(income(Math.max(22, f.far)) * 4 * f.cells.length), `a fossil whole of ${f.cells.length} bones: its species ${got.pay.fossil}, a lump of ${got.pay.lump}`);
    check(got.title === `${FOSSILS[f.kin]}!` && got.spec[f.kin] === 2 && S.fossils === 1 << (f.kin - 1), `a fossil whole is called ${got.title}, pays the specimens ${got.spec}, and the fossils found are ${S.fossils}`);
    check(game.hauled.sub === 'FOSSIL, WHOLE', `a fossil whole's banner says '${game.hauled.sub}' under it`);
    const g = fossils[1], before = S.fossils, part = haul(g.cells.slice(1));
    check(part.pay.fossil === 0 && part.pay.lump === 0 && part.spec.every(v => v === 0) && S.fossils === before, `a fossil with a bone left: its species ${part.pay.fossil}, a lump of ${part.pay.lump}, specimens ${part.spec}, the fossils found ${S.fossils}`);
  }
}

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: twin stones past 800 cells out and fossils past 1,200, laid as written, of their direction, and only in ground of generation 2; twin stones together and a fossil whole pay, and no less of them');
process.exit(fails.length ? 1 : 0);
