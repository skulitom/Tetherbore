// Where pockets lie (docs/CONTENT-PLAN.md S3; js/world.js: zoneOf, zone, pocketOf, inPocket, meetsPocket, and the
// pocket's place in biomeAt and kindAt). Checked on the world's own answers, with none of it made:
//   - each direction's first pocket (its herald) lies 165 cells out along the direction's line and 14 to one side,
//     nine cells in radius, in every world; 40 cells further out where a wreck lies within 24 cells of that; and is
//     the first kind in its list that has a row;
//   - of the other sectors about half try one; none has its middle under 170 cells from the core, within 40
//     cells and its radius of a wreck or a relic, or so far out that the last reach does not go round it; its
//     radius is within its kind's own; whose direction it lies in is its middle's to say;
//   - which kind a sector's pocket is: one that may lie in that direction, that far out, and of those the one
//     whose own hash for the sector is largest, so that a kind made later takes few sectors from the others and
//     moves none of them;
//   - every cell of a pocket lies inside the pocket's own sector and no further from its middle than its record
//     says (`reach`), and a cell asks only its own sector;
//   - a pocket's cells are its ground before any other rule (the home ground's edge, a direction's, a deep
//     flank's, a province's), and nothing else in the world's ground changes for it;
//   - inside one there is nothing but what its shape lays: no find, no key of a slab, no hazard, no ore;
//   - no slab is laid any cell of which could be a pocket's (its disc and five cells more, a cobble field's and
//     six and a half), and no find within five cells of one;
//   - a cell that holds a pocket's ground where the world lays none (a saved game's may) is plain rock of it;
//   - a sector's pocket is worked out once and kept, afresh for another seed, and asking makes none of the world.
//   node test/regress/s3-pockets.mjs
import { World, N, C, K, B, BIOMES, ZONE, POCKET_MOST, HERALD_R, HERALD_OFF, HERALD_RHO, HERALD_ON, HERALD_CLEAR, RELIC_R, SLAB, FIND, DX, DY, biome, rowOf, cellHash as hash } from '../../js/world.js';

const fails = [], check = (ok, what) => { if (!ok && fails.length < 16) fails.push(what); };
class Unpocketed extends World { zoneOf() { return null; } }
const world = seed => { const w = new World(); w.reset(seed); return w; };
const far = Z => Math.sqrt((Z.cx - C) ** 2 + (Z.cy - C) ** 2);
const out = {};

// ---- 1. the heralds
{
  const WHERE = [null, [HERALD_OFF, -HERALD_R, 0, -1], [-HERALD_OFF, HERALD_R, 0, 1], [-HERALD_R, -HERALD_OFF, -1, 0], [HERALD_R, HERALD_OFF, 1, 0]];
  check(HERALD_R === 165 && HERALD_OFF === 14 && HERALD_RHO === 9 && HERALD_ON === 40 && HERALD_CLEAR === 24, 'the heralds\' figures are not the ones written');
  let moved = 0, stayed = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const w = world(seed), heralds = w.pocketsWithin(260).filter(Z => Z.herald);
    check(heralds.length === 4 && [1, 2, 3, 4].every(kin => heralds.some(Z => Z.kin === kin)), `seed ${seed}: ${heralds.length} heralds, of directions ${heralds.map(Z => Z.kin)}`);
    for (const Z of heralds) {
      const [x, y, ux, uy] = WHERE[Z.kin], wreck = w.wrecks.some(([wx, wy]) => (C + x - wx) ** 2 + (C + y - wy) ** 2 < HERALD_CLEAR * HERALD_CLEAR);
      const want = wreck ? [x + ux * HERALD_ON, y + uy * HERALD_ON] : [x, y];
      if (wreck) moved++; else stayed++;
      check(Z.cx - C === want[0] && Z.cy - C === want[1] && Z.rho === HERALD_RHO, `seed ${seed}: the herald of direction ${Z.kin} lies at ${Z.cx - C},${Z.cy - C} with radius ${Z.rho}, not at ${want} with ${HERALD_RHO}${wreck ? ' (a wreck is near)' : ''}`);
      check(!w.wrecks.some(([wx, wy]) => (Z.cx - wx) ** 2 + (Z.cy - wy) ** 2 < HERALD_CLEAR * HERALD_CLEAR), `seed ${seed}: a wreck lies within ${HERALD_CLEAR} cells of the herald of direction ${Z.kin}`);
      // The first of its kinds that there is: the west's own is the hive, and until the others' are made, theirs too.
      check(BIOMES[Z.row]?.pocket?.shape !== undefined, `seed ${seed}: the herald of direction ${Z.kin} is ground ${Z.row}, which is no pocket's`);
      check(w.zoneOf(Math.floor((Z.cx - C) / ZONE), Math.floor((Z.cy - C) / ZONE)) === Z, `seed ${seed}: the herald of direction ${Z.kin} is not its own sector's pocket`);
      check(far(Z) + Z.reach < 230, `seed ${seed}: the herald of direction ${Z.kin} runs to ${(far(Z) + Z.reach).toFixed(1)} cells out, past the sixth reach`);
    }
  }
  check(moved >= 4 && stayed >= 150, `of the heralds of 60 worlds, ${moved} lie further out for a wreck and ${stayed} where they always do`);
  // The west's own first is the hive. Until the others' own are made (content item 10), the north's and the
  // east's are pumice drifts and the south's an ash flat.
  check(world(7).zoneOf(-2, -1).row === 32, 'the west\'s herald is not a hive');
  check(world(7).zoneOf(0, -2).row === 33 && world(7).zoneOf(1, 0).row === 33 && world(7).zoneOf(-1, 1).row === 34, `the heralds of the north, the east and the south are grounds ${world(7).zoneOf(0, -2).row}, ${world(7).zoneOf(1, 0).row} and ${world(7).zoneOf(-1, 1).row}, not 33, 33 and 34`);
  out.heralds = { moved, stayed };
}

// ---- 2. the rest: where, how big, whose direction
{
  let sectors = 0, tried = 0, laid = 0, west = 0, kinds = new Set();
  const radii = [];
  for (const seed of [1, 7, 34, 99]) {
    const w = world(seed), relics = [0, 1, 2, 3].map(d => [C + DX[d] * RELIC_R, C + DY[d] * RELIC_R]);
    for (let sy = -19; sy < 19; sy++) for (let sx = -19; sx < 19; sx++) {
      const Z = w.zoneOf(sx, sy);
      if (Z && Z.herald) continue;
      sectors++;
      if (hash(sx, sy, seed + 40) < 0.5) tried++;
      if (!Z) continue;
      laid++; kinds.add(Z.row); radii.push(Z.rho);
      const at = `seed ${seed} sector ${sx},${sy}`, dx = Z.cx - C, dy = Z.cy - C, P = rowOf(Z.row).pocket;
      check(hash(sx, sy, seed + 40) < 0.5, `${at}: a pocket where the sector's hash tries none`);
      check(Z.key === `z${sx},${sy}`, `${at}: the pocket is known as ${Z.key}`);
      check(dx - sx * ZONE >= 38 && dx - sx * ZONE < ZONE - 38 && dy - sy * ZONE >= 38 && dy - sy * ZONE < ZONE - 38, `${at}: the middle ${dx},${dy} is not 38 cells inside the sector`);
      check(far(Z) >= 170 && far(Z) + POCKET_MOST <= 2300, `${at}: the middle is ${far(Z).toFixed(1)} cells out`);
      check(Z.rho >= P.rho[0] && Z.rho <= P.rho[1], `${at}: radius ${Z.rho} is not within its kind's ${P.rho}`);
      check(![...w.wrecks, ...relics].some(([x, y]) => (Z.cx - x) ** 2 + (Z.cy - y) ** 2 < (40 + Z.rho) ** 2), `${at}: within 40 cells and its radius of a wreck or a relic`);
      check(Z.kin === (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? B.LODE : B.MIRE) : (dy < 0 ? B.FROST : B.EMBER)), `${at}: direction ${Z.kin} for a middle at ${dx},${dy}`);
      check(P.kins === 'any' || P.kins.includes(Z.kin), `${at}: a ${rowOf(Z.row).name} in direction ${Z.kin}, where it is not found`);
      check(far(Z) >= P.minR, `${at}: a ${rowOf(Z.row).name} ${far(Z).toFixed(0)} cells out, nearer than its kind lies`);
      if (Z.kin === B.MIRE) west++;
      check(Z.reach <= POCKET_MOST && Z.reach >= Z.rho, `${at}: its cells are said to lie up to ${Z.reach} from its middle`);
    }
  }
  check(Math.abs(tried / sectors - 0.5) < 0.03, `${(tried / sectors * 100).toFixed(1)} sectors in a hundred try a pocket, not 50`);
  check(west > 60, `only ${west} pockets lie in the west on four worlds`);
  // (A radius is small more often than large: 6 + 24 x a hash squared, so half are under 12.)
  const under = radii.filter(r => r < 12).length / radii.length;
  check(under > 0.4 && under < 0.6 && Math.max(...radii) > 26, `${(under * 100).toFixed(0)} pockets in a hundred are under 12 cells in radius, the largest ${Math.max(...radii).toFixed(1)}`);
  out.sectors = { sectors, tried, laid, west, kinds: [...kinds] };
}

// ---- 3. which kind: a kind made later takes sectors by its own hash, and moves none of the others
{
  const before = world(7), was = new Map();
  for (let sy = -19; sy < 19; sy++) for (let sx = -19; sx < 19; sx++) { const Z = before.zoneOf(sx, sy); was.set(`${sx},${sy}`, Z && !Z.herald ? Z : null); }
  const hive = BIOMES[32];
  // A kind that lies anywhere from 400 cells out, with half the hive's weight, and is twice as small.
  biome({ ...hive, id: 62, name: 'test-any', pocket: { ...hive.pocket, kins: 'any', minR: 400, rho: [6, 12], weight: 0.5 } });
  const w = world(7);
  // (What a kind's hash for a sector is worth: the hash times the kind's weight.)
  const pick = (sx, sy, row) => hash(sx, sy, 7 + 100 + row) * rowOf(row).pocket.weight;
  let took = 0, kept = 0, fresh = 0, near = 0, wrong = 0, wide = 0;
  const lies = [0, 0, 0, 0, 0], kinds = new Set();
  for (let sy = -19; sy < 19; sy++) for (let sx = -19; sx < 19; sx++) {
    const Z = w.zoneOf(sx, sy), old = was.get(`${sx},${sy}`);
    if (!Z || Z.herald) continue;
    if (Z.row === 62) {
      lies[Z.kin]++;
      if (far(Z) < 400) near++;
      if (Z.rho > 12 || Z.rho < 6) wide++;
      // (Where it took the place of another kind's pocket its own hash was worth more; and it may lie, being
      // smaller, in a sector where the other was too near a wreck to be laid at all.)
      if (old) { took++; kinds.add(old.row); if (pick(sx, sy, 62) <= pick(sx, sy, old.row)) wrong++; } else fresh++;
    } else {
      kept++;
      if (!old || old.cx !== Z.cx || old.cy !== Z.cy || old.rho !== Z.rho || old.row !== Z.row) wrong++;
      if (far(Z) >= 400 && pick(sx, sy, 62) > pick(sx, sy, Z.row)) wrong++;
    }
  }
  check(near === 0 && wide === 0, `${near} pockets of the new kind lie nearer than it may, ${wide} are not within its radius`);
  check(wrong === 0, `${wrong} sectors' pockets are not the kind whose hash times weight is largest, or moved when a kind was added`);
  // (With half the weight it takes about a quarter of the sectors that one other kind had from 400 out, and fewer
  // where two had them between them: from every kind there is, in every direction.)
  // (With seven kinds there already, where there were three, a kind of half the weight takes fewer: a twentieth and more.)
  check(took > kept * 0.05 && took < kept * 0.6 && fresh < took * 0.05, `the new kind took ${took} of the others' sectors and left them ${kept}; it lies in ${fresh} sectors that had none`);
  check(lies.slice(1).every(n => n > 2) && [32, 33, 34].every(row => kinds.has(row)), `the new kind lies in ${lies.slice(1)} sectors of the north, south, west and east, in place of kinds ${[...kinds].sort()}`);
  out.added = { took, kept, fresh, lies: lies.slice(1) };
  // A kind that may lie as near the core as it likes still lies no nearer than any pocket may: 170 cells.
  biome({ ...hive, id: 62, name: 'test-near', pocket: { ...hive.pocket, kins: 'any', minR: 0 } });
  {
    const close = [];
    for (let seed = 1; seed <= 40; seed++) close.push(...world(seed).pocketsWithin(300).filter(Z => !Z.herald));
    check(close.length > 100 && close.some(Z => Z.row === 62 && far(Z) < 200) && close.every(Z => far(Z) >= 170), `with a kind that may lie anywhere, the nearest pockets of forty worlds lie ${close.map(Z => Math.round(far(Z))).sort((a, b) => a - b).slice(0, 8)} out`);
  }
  // (The row is made one that no sector chooses, which is what takes it off the list: tests share the table.)
  biome({ ...hive, id: 62, name: 'test-gone', pocket: { ...hive.pocket, shape: undefined } });
  const after = world(7);
  let back = 0;
  for (let sy = -19; sy < 19; sy++) for (let sx = -19; sx < 19; sx++) { const Z = after.zoneOf(sx, sy), old = was.get(`${sx},${sy}`); if (Z && !Z.herald ? !old || old.row !== Z.row || old.cx !== Z.cx : old) back++; }
  check(back === 0, `${back} sectors are not as they were once the new kind is gone`);
}

// ---- 4. a pocket's cells: inside its sector, within its reach, before every other rule; nothing else moves
{
  let pockets = 0, cells = 0, astray = 0, beyond = 0, other = 0, changed = 0, inHome = 0, inDeep = 0, bad = 0, minerals = 0, unmet = 0;
  const KINDS = new Set([K.EMPTY, K.SOFT, K.MINERAL, K.NODE, K.CAP]);
  for (const seed of [1, 7, 34]) {
    const w = world(seed), bare = new Unpocketed(); bare.reset(seed);
    const list = w.pocketsWithin(2300).filter((Z, n) => Z.herald || n % 5 === 0);
    for (const Z of list) {
      pockets++;
      const sx = Math.floor((Z.cx - C) / ZONE), sy = Math.floor((Z.cy - C) / ZONE);
      // Its sector and a border of cells round it.
      for (let v = -4; v < ZONE + 4; v++) for (let u = -4; u < ZONE + 4; u++) {
        const x = C + sx * ZONE + u, y = C + sy * ZONE + v, b = w.biomeAt(x, y), was = bare.biomeAt(x, y), mine = b === Z.row && w.pocketOf(x, y) === Z;
        if (b !== was && !rowOf(b).pocket) changed++;
        if (u < 0 || v < 0 || u >= ZONE || v >= ZONE) { if (b === Z.row && w.pocketOf(x, y) === null) astray++; continue; }
        if (mine !== w.inPocket(Z, x, y)) other++;
        if (!mine) { if (b !== was) changed++; continue; }
        cells++;
        if ((x - Z.cx) ** 2 + (y - Z.cy) ** 2 > Z.reach * Z.reach) beyond++;
        if (!w.meetsPocket(x, y, 0)) unmet++;
        if (was === B.CRUST) inHome++; else if (was >= 5 && was <= 8) inDeep++;
        const k = w.kindAt(x, y, b);
        if (!KINDS.has(k) && k !== K.BEDROCK) bad++;
        if (k === K.MINERAL) minerals++;
        // (And what the same cell is in the ground that would lie there is anything at all.)
      }
    }
  }
  check(pockets > 60 && cells > 30000 && minerals > 1500, `${pockets} pockets looked at, ${cells} cells, ${minerals} of mineral`);
  check(astray === 0, `${astray} cells of a pocket's ground lie outside its sector`);
  check(beyond === 0, `${beyond} cells of a pocket lie further from its middle than its record says`);
  check(other === 0, `${other} cells are a pocket's ground and not that pocket's, or the other way about`);
  check(unmet === 0, `${unmet} cells of a pocket do not meet a pocket`);
  check(changed === 0, `${changed} cells that are no pocket's are not the ground they would be without pockets`);
  check(inDeep > 0, 'no cell of a pocket lies where a deep flank would: the order of the rules is not tested');
  // The home ground's edge wanders between 105 and 155 cells out and a herald comes no nearer than 150, so a
  // cell that is both is rare. A hive stood where the home ground runs furthest out shows the order: its cells
  // are the hive's where the home ground would lie, but for those within 130 cells of the core, which are never
  // asked.
  {
    const w = world(7), bare = new Unpocketed(); bare.reset(7);
    let at = null;
    for (let y = -146; y <= 146 && !at; y++) for (let x = -146; x <= 146 && !at; x++) {
      const r = Math.sqrt(x * x + y * y), ux = ((x % ZONE) + ZONE) % ZONE, uy = ((y % ZONE) + ZONE) % ZONE;
      if (r > 140 && r < 146 && ux > 16 && ux < ZONE - 16 && uy > 16 && uy < ZONE - 16 && [[0, 0], [5, 0], [-5, 0], [0, 5], [0, -5]].every(([u, v]) => bare.biomeAt(C + x + u, C + y + v) === B.CRUST)) at = [C + x, C + y];
    }
    const Z = w.zone(32, at[0], at[1], 9, B.LODE), zx = Math.floor((Z.cx - C) / ZONE), zy = Math.floor((Z.cy - C) / ZONE);
    w.zoneOf = (sx, sy) => sx === zx && sy === zy ? Z : null;
    let near = 0;
    for (let y = Z.cy - 16; y <= Z.cy + 16; y++) for (let x = Z.cx - 16; x <= Z.cx + 16; x++) {
      const b = w.biomeAt(x, y), r = Math.sqrt((x - C) ** 2 + (y - C) ** 2);
      if (b === 32 && bare.biomeAt(x, y) === B.CRUST) inHome++;
      if (r <= 130 ? b !== bare.biomeAt(x, y) : (b === 32) !== w.inPocket(Z, x, y)) near++;
    }
    check(inHome > 100 && near === 0, `a hive stood on the home ground's edge at ${Z.cx - C},${Z.cy - C}: ${inHome} of its cells lie where the home ground would, ${near} cells are wrong`);
  }
  check(bad === 0, `${bad} cells of a pocket are something its shape does not lay (a find, a key, a hazard, ore)`);
  out.cells = { pockets, cells, minerals, inHome, inDeep };
}

// ---- 5. slabs and finds keep clear
{
  let slabs = 0, meet = 0, refused = 0, finds = 0, close = 0;
  for (const seed of [1, 7, 34]) {
    const w = world(seed);
    for (let sy = -16; sy < 16; sy++) for (let sx = -16; sx < 16; sx++) { const S = w.slabIn(sx, sy); if (S) { slabs++; if (w.meetsPocket(S.cx, S.cy, S.reach)) meet++; } }
    refused += w.refused.pocket;
    for (let sy = -48; sy < 48; sy++) for (let sx = -48; sx < 48; sx++) { const [what, fx, fy] = w.findSpot(sx, sy); if (what) { finds++; if (w.meetsPocket(fx, fy, 5)) close++; } }
    check(w.made === 0, `seed ${seed}: asking where pockets, slabs and finds lie made ${w.made} pieces of the world`);
  }
  check(meet === 0 && slabs > 250 && refused > 5, `${meet} of ${slabs} slabs meet a pocket; ${refused} were not laid for one`);
  check(close === 0 && finds > 10000, `${close} of ${finds} finds lie within five cells of where a pocket's cells can`);
  out.clear = { slabs, refused, finds };
}

// ---- 6. kept, and afresh for another seed; a pocket's ground where the world lays none
{
  const w = world(7), Z = w.zoneOf(-2, 0);
  check(Z && w.zoneOf(-2, 0) === Z && w.pocketOf(Z.cx, Z.cy) === Z, 'a sector\'s pocket is not kept once it is worked out');
  w.reset(8);
  const other = w.zoneOf(-2, 0);
  check(other !== Z && w.pocketOf(Z.cx, Z.cy) === other, 'another seed is given the last seed\'s pocket');
  w.reset(7);
  // Far from any pocket, a cell said to be hive ground: plain wax, whatever would lie there.
  check(w.pocketOf(C + 40, C - 300) === null && w.kindAt(C + 40, C - 300, 32) === K.SOFT && w.kindAt(C + 41, C - 300, 32) === K.SOFT, 'a cell of a pocket\'s ground where the world lays no pocket is not plain rock of it');
  check(JSON.stringify(w.pocketsWithin(600).map(far)) === JSON.stringify(w.pocketsWithin(600).map(far).sort((a, b) => a - b)) && w.pocketsWithin(600).every(p => far(p) <= 600), 'the pockets within a distance are not those, nearest first');
}

console.log(JSON.stringify(out));
console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : 'ok: a herald in every direction, pockets in half the other sectors and wholly inside them, their ground before any other, nothing else in them, and slabs and finds clear of them');
process.exit(fails.length ? 1 : 0);
