// World.freed against a plain flood, on random ground in a box set in solid mainland: one to three cells or a
// 3 x 3 opened together, already open in the world or only asked about. Every island the plain flood finds beside
// the opened cells must be returned, whole, and nothing else. freed decides by outlines and floods nothing to find
// out, so this is what holds it to the plain meaning of "cut off". One kind of miss was once let pass and is not
// now: an opened cell that faces only a closed hollow inside the island (the outline walked from there is the
// hollow's wall, which says nothing of what surrounds it).
//   node test/regress/f-freed-diff.mjs <seed> <trials> <box> <fill>
import { makeGame, random, C, N, K } from '../harness.mjs';
const [seed = 1, trials = 3000, S = 14, fill = 0.55] = process.argv.slice(2).map(Number);
const game = await makeGame(7), w = game.world, rnd = random(seed);
const X0 = C + 300, Y0 = C + 300;       // plain crust, far from the core's own things
const at = (x, y) => (Y0 + y) * N + X0 + x;
// mainland all round
for (let y = -30; y < S + 30; y++) for (let x = -30; x < S + 30; x++) w.setK(at(x, y), K.SOFT);
let bad = 0, islandsSeen = 0, lone = 0, hollows = 0;
for (let t = 0; t < trials && bad < 5; t++) {
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) w.setK(at(x, y), rnd() < fill ? K.SOFT : K.EMPTY);
  // cells opened together: a few random cells, or a 3 x 3
  const opened = [];
  if (rnd() < 0.3) { const cx = 1 + Math.floor(rnd() * (S - 2)), cy = 1 + Math.floor(rnd() * (S - 2)); for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) if (w.k(at(cx + u, cy + v)) !== K.EMPTY) opened.push(at(cx + u, cy + v)); }
  else for (let n = 1 + Math.floor(rnd() * 3); n > 0; n--) { const c = at(Math.floor(rnd() * S), Math.floor(rnd() * S)); if (w.k(c) !== K.EMPTY && !opened.includes(c)) opened.push(c); }
  if (!opened.length) continue;
  const already = rnd() < 0.5;          // opened in the world before asking, or only asked about
  if (already) for (const c of opened) w.setK(c, K.EMPTY);
  const got = w.freed(opened.length === 1 && rnd() < 0.5 ? opened[0] : opened, 100000);
  // brute force
  const gone = new Set(opened), seen = new Set(), want = [];
  for (const i of opened) for (const s of [1, N, -1, -N]) {
    const start = i + s;
    if (gone.has(start) || seen.has(start) || w.k(start) === K.EMPTY) continue;
    const cells = [start]; seen.add(start); let held = false;
    for (let h = 0; h < cells.length; h++) for (const d of [1, N, -1, -N]) {
      const j = cells[h] + d;
      if (seen.has(j) || gone.has(j) || w.k(j) === K.EMPTY) continue;
      const x = (j % N) - X0, y = Math.floor(j / N) - Y0;
      if (x < 0 || y < 0 || x >= S || y >= S) { held = true; continue; }
      seen.add(j); cells.push(j);
    }
    if (!held) want.push(cells);
  }
  const key = list => list.map(c => c.slice().sort((a, b) => a - b).join(',')).sort().join(' | ');
  islandsSeen += want.length;
  if (key(got) !== key(want)) {
    // which kind of miss?
    const gotKeys = new Set(got.map(c => Math.min(...c)));
    const missed = want.filter(c => !gotKeys.has(Math.min(...c)));
    // Is the open ground the cut opens on to a pocket walled only by ground that hangs on nothing (a hollow inside the
    // missed piece), and was nothing returned that should not have been?
    const islandCells = new Set(want.flat()), wantKeys = new Set(want.map(c => Math.min(...c)));
    const openSeen = new Set(opened), stack = opened.slice(); let hollow = missed.length > 0 && got.every(c => wantKeys.has(Math.min(...c)));
    while (stack.length && hollow) { const c = stack.pop(); for (const d of [1, N, -1, -N]) { const j = c + d; if (openSeen.has(j)) continue; if (w.k(j) === K.EMPTY) { openSeen.add(j); stack.push(j); } else if (!islandCells.has(j)) hollow = false; } }
    if (hollow) {
      if (!hollows++) {
        console.log(`trial ${t}: freed gave ${got.length} pieces (${got.map(c => c.length)}), a plain flood finds ${want.length} (${want.map(c => c.length)}); missed: ${missed.map(c => c.length)} cells. o = the cell opened, M = the island missed, # = other ground, . = open`);
        let rows = '';
        for (let y = -1; y <= S; y++) { for (let x = -1; x <= S; x++) { const c = at(x, y); rows += gone.has(c) ? 'o' : w.k(c) === K.EMPTY ? '.' : missed.some(m => m.includes(c)) ? 'M' : '#'; } rows += String.fromCharCode(10); }
        console.log(rows);
      }
      continue;
    }
    bad++;
    console.log(`trial ${t}: freed gave ${got.length} pieces (${got.map(c => c.length)}), the plain flood ${want.length} (${want.map(c => c.length)}); missed sizes ${missed.map(c => c.length)}; opened ${opened.length} cells, already open: ${already}`);
    let rows = '';
    for (let y = -1; y <= S; y++) { for (let x = -1; x <= S; x++) { const c = at(x, y); rows += gone.has(c) ? 'o' : w.k(c) === K.EMPTY ? '.' : missed.some(m => m.includes(c)) ? 'M' : '#'; } rows += '\n'; }
    console.log(rows);
  }
}
console.log(JSON.stringify({ seed, trials, islandsFound: islandsSeen, missedFromInsideAHollow: hollows, otherMismatches: bad }));
process.exit(bad || hollows ? 1 : 0);
