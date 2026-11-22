// Every test in one command: each script in test/regress (each fails while the defect it was written for is there),
// the smoke test, and the rope fuzz on seeds 11 to 18 from the core, from a start 200 cells out each way and from
// inside a province of each strain of ground, from a deep flank, from inside provinces of generated crosses, from
// the cracks of keystone slabs, and from inside amber hives, pumice drifts and ash flats (most on world 7, some of
// each on worlds 19 and 23 as well), from beside a rare hazard's site of each kind, and from inside each seam and
// each deep strain; and the slabs themselves, as they lie in 200 worlds (slab-moat.mjs).
//   node test/all.mjs [only: a word the test's name must hold]
// One line a test, and the last line of a failing test's own output under it. Exits 1 if any failed. Tests run side by
// side, as many as the machine has cores to spare, and the whole run takes a few minutes.
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url)), only = process.argv[2] ?? '';
// A regress script named here is run once for each list of arguments; any other is run once, with none.
const ARGS = {
  'a-fuzz-field': [[1, 400, 0], [1, 400, 1], [1, 400, 2], [1, 400, 3], [1, 400, 4]],
  'a-fuzz-keys': [[2, 300, 0, 4], [2, 300, 1, 4], [2, 300, 2, 4], [2, 300, 3, 4], [2, 300, 4, 4]],
  'a-fuzz-soft': [[4, 500, 16, 2], [14, 500, 16, 2], [18, 500, 12, 0], [5, 500, 16, 2], [6, 500, 16, 2]],
  'b-fuzz-fast': [[1, 100, 4, 80, 70, 60], [2, 100, 4, 80, 70, 30]],
  'e-hazard-fuzz': [[2, 500, 0, 170, 0.08], [1, 300, -170, 0, 0.08], [4, 300, 170, 0, 0.08],
    [3, 300, 0, 170, 0.08, 5, 'second'], [5, 300, -170, 0, 0.08, 5, 'second'], [6, 300, 170, 0, 0.08, 5, 'second'],
    // Inside a province of sporefall (pods in bunches, which go off together) and one of forge (lava that pours further).
    [7, 300, -384, -128, 0.08, 7], [7, 300, 128, 384, 0.08, 7],
    // The east's own ground with few hazards planted, so that the crystals are mostly the world's own, on the
    // flanks of its slate: their arcs shatter the slate beside the string.
    [8, 300, 200, 0, 0.02],
    // Inside provinces of generated crosses (`node tools/crosses.mjs --where 7` says where), with both of a cross's
    // hazards planted: smoulder (pods and lava), kilnstone (crystals and lava), buzzmire (pods and crystals), thaw
    // (lava in ground that freezes) and mouldstone (crystals and pods). (Buzzmire was flown from -640,-640, which the
    // north-west seam has taken since: `node tools/field.mjs --seed 7 --at -900,-300` says where it lies now.)
    [7, 300, -1152, -384, 0.08, 8, 'second'], [7, 300, 1152, 384, 0.08, 8, 'second'], [7, 300, -912, -304, 0.08, 8, 'second'],
    [7, 300, -128, -1408, 0.08, 9, 'second'], [7, 300, 1920, 640, 0.08, 9, 'second'],
    // Each direction's rare hazard planted thickly, with no site round it: rime bells (in the north, which has no
    // other hazard), fumaroles, glowworms and lodestones.
    [2, 300, 0, -200, 0.02, 5, 'rare'], [3, 300, 0, 200, 0.02, 5, 'rare'], [4, 300, -200, 0, 0.02, 5, 'rare'], [5, 300, 200, 0, 0.02, 5, 'rare'],
    // The east's own ground again with the bit's last level and the diamond tip, which plough the slate of its
    // ribs and the rock round them keeping the drill's run (js/game.js: `ploughs`).
    [9, 300, 200, 0, 0.02, 7, 'plough'],
    // Inside each seam on world 7, with its own hazards planted (both, where it has two), so that its reaction comes
    // again and again (js/game.js: REACT): hoarstone's arcs thawing frozen cuts, glassdune's lava setting as glass,
    // cinderfen's lava burning off pods, frostfen's pods riming; and the mycelium with its pods, where faults zip and
    // caps light, and the caldera with its lava, under the heat.
    [7, 300, 624, -632, 0.08, 8], [7, 300, 560, 584, 0.08, 8, 'second'], [7, 300, -568, 544, 0.08, 8, 'second'], [7, 300, -616, -592, 0.08, 8],
    [7, 300, -1576, 648, 0.08, 9], [7, 300, 824, 1360, 0.08, 9]],
  'f-big': [[71], [250], [205, 'jog'], [150, 'bump']],
  'f-freed-diff': [[1, 4000, 14, 0.55], [5, 6000, 20, 0.62], [9, 3000, 20, 0.62]],
  'f-fuzz-books': [[2, 300], [7, 300], [9, 300], [12, 300]],
  'f-wreck': [[7, 0], [32, 0], [61, 0], [63, 0]],
  'g-far-wreck': [[7, 5, 60], [7, 7, 60]],
  // (The deep flank on world 57, first flown from -1061,1061, where the south-west's deep seam lies now.)
  'i-fuzz-play': [[45, 500, 5, 0, 0, 30], [33, 400, 5, 60, 210, 60], [60, 400, 5, 141, 141, 60], [50, 400, 5, 60, 210, 60], [57, 260, 9, -936, 1296, 'mix'],
    [39, 260, 1, 0, 0, 60, 'lowdrill,home'], [51, 260, 5, 141, 141, 60, 'forceshop'],
    // From a start inside a province of each strain (`node tools/strains.mjs --where 7` and `--where 11` say where):
    // firn, serac, scoria, forge, tangle, sporefall, redrock, loess. (Redrock on world 11 was flown from 384,-384,
    // where the north-east seam begins now.)
    [7, 300, 7, -128, -384, 60], [7, 300, 7, 128, -384, 'mix'], [7, 300, 7, -128, 384, 60], [7, 300, 7, 128, 384, 60],
    [11, 300, 7, -384, 128, 60], [7, 300, 7, -384, -128, 60], [11, 300, 7, 432, -320, 60], [7, 300, 7, 384, -128, 30],
    // The east's own ground, where arcs shatter slate (at mixed frame lengths too), the south's own,
    // where lava quenches its slag to steel, and the north's own, where a cut beside ore heals as ore.
    [21, 300, 5, 190, 10, 60], [23, 300, 5, 190, 10, 'mix'], [22, 300, 5, 20, 180, 60], [24, 300, 5, 10, -190, 60],
    // And the east's own ground on a far reach with the bit's last level and the diamond tip, ploughing.
    [21, 300, 7, 190, 10, 60, 'plough'],
    // From a start inside a province of a generated cross, one of each host with each donor between them and
    // each structure: buzzmire, hollow flashrock, thaw, crazed rimemoss, crazed quench, kilnstone, crazed tundra,
    // mouldstone, frothy hailstone, banded kilnstone.
    [7, 300, 8, -912, -304, 60], [7, 300, 8, 384, 1152, 'mix'], [7, 300, 9, -128, -1408, 60], [7, 300, 9, -1408, -128, 60],
    [7, 300, 9, -128, 1920, 60], [7, 300, 8, 1152, 384, 30], [7, 300, 9, 384, -1408, 'mix'], [7, 300, 9, 1920, 640, 60],
    [7, 300, 9, -128, -1920, 60], [7, 300, 9, 1408, 384, 60],
    // Other flights in the north's own ground, the south's and the west's, and on the first reach but one from
    // the core, with trips home. (These, and the flights below, were first flown with the bomb, since taken out
    // of the game; they are kept as flights.)
    [25, 300, 5, 10, -190, 60], [26, 300, 5, 20, 180, 60], [27, 300, 5, -190, 10, 'mix'], [29, 300, 1, 0, 0, 60, 'home'],
    // From a start in the crack of a keystone slab (`node tools/slabs.mjs --where 7` and `--where 11` say where they
    // lie): the first slab of a new game on the reach that goes round it, a slab with three keys,
    // the middle of a cobble field, and the widest slab there is.
    [7, 300, 3, 3, 44, 60], [7, 300, 7, 334, 375, 'mix'], [7, 300, 7, 192, -500, 60], [11, 300, 6, 222, 82, 60],
    // From a start inside an amber hive (`node tools/zone-budget.mjs --where 7` says where pockets lie): the west's
    // first, a great hive of forty chambers, one
    // 23 cells in radius, and a middling one with trips home at thirty frames a second.
    [7, 300, 6, -205, -11, 60], [7, 300, 7, -456, -72, 'mix'], [7, 300, 7, -464, 49, 60], [7, 300, 6, -209, 53, 30, 'home'],
    // From a start inside a pumice drift, among boulders that hang on nothing from the first: the north's first,
    // the richest near the core (fifteen boulders), and one of
    // seven with trips home at thirty frames a second (its boulders leave the books and come back).
    [7, 300, 5, 14, -165, 60], [7, 300, 7, 470, 431, 'mix'], [7, 300, 5, 174, -78, 30, 'home'],
    // From a start inside an ash flat, where the drill ploughs: the south's first, and a great one, also
    // with the best ram.
    [7, 300, 5, -14, 165, 60], [7, 300, 6, -207, 211, 'mix'], [7, 300, 6, -207, 211, 60, 'ram'],
    // The same grounds on two worlds more (the session's close flew every new ground on worlds 19 and 23, with
    // both fuzzes, and all were clean; these are kept): crosses of hosts, donors and structures the flights above
    // have not (crazed thaw, banded flashrock, frothy sootfen, hollow kilnstone), a cobble
    // field of thirty-two blocks, a hive 21 cells in radius, a drift rich in aerolite with trips home, and a
    // great ash flat. (Frothy sootfen on world 23 was flown from -640,640, where the south-west seam lies now.)
    [19, 300, 9, 128, -1408, 60], [19, 300, 8, -384, 640, 60], [23, 300, 8, -552, 696, 'mix'], [23, 300, 8, 1152, 384, 60],
    [23, 300, 6, -310, 49, 'mix'], [23, 300, 6, -330, -54, 60], [19, 300, 6, 300, -171, 30, 'home'], [19, 300, 7, -212, 341, 'mix'],
    // From beside the site of a rare hazard (`node tools/sites.mjs --where 7` and `--where 11` say where they lie),
    // which is woken at the start and every twelve seconds it is asleep: the first rime bell, fumarole, glowworm
    // and lodestone of worlds 7 and 11, and the nearest glowworm of world 7.
    [7, 300, 6, 141, -576, 60, 'wake'], [7, 300, 6, -139, 565, 'mix', 'wake'], [7, 300, 6, -558, -141, 60, 'wake'], [7, 300, 6, 562, 151, 30, 'wake'],
    [11, 300, 6, 143, -575, 'mix', 'wake'], [11, 300, 6, -140, 560, 60, 'wake'], [11, 300, 6, -578, -138, 30, 'wake'], [11, 300, 6, 574, 134, 60, 'wake'],
    [7, 300, 6, -430, 285, 'mix', 'wake'],
    // With the creatures (js/fauna.js) about the flight and more set down beside the drill every few seconds, foes
    // woken: in the north's own ground, loess, sporefall, magma, serac and the home ground.
    [7, 300, 5, 60, -150, 60, 'fauna'], [7, 300, 6, 300, 0, 'mix', 'fauna'], [7, 300, 7, -260, -124, 60, 'fauna'], [7, 300, 7, -332, 800, 60, 'fauna'],
    [7, 300, 7, 128, -384, 30, 'fauna'], [7, 260, 3, -60, 20, 60, 'fauna'],
    // From inside each seam on world 7 (`node tools/field.mjs --seed 7 --at 600,-600` and so on say where): hoarstone,
    // glassdune, cinderfen and frostfen; and each deep strain: the glacier's halls, the caldera's lakes, the
    // mycelium's faults and the druse's geodes.
    [7, 300, 8, 624, -632, 60], [7, 300, 8, 560, 584, 'mix'], [7, 300, 8, -568, 544, 60], [7, 300, 8, -616, -592, 30],
    [7, 300, 8, -480, -1248, 60], [7, 300, 9, 824, 1360, 'mix'], [7, 300, 9, -1576, 648, 60], [7, 300, 8, 1264, -472, 60]],
};
const tests = [];
for (const file of readdirSync(here + 'regress').filter(name => name.endsWith('.mjs')).sort()) {
  for (const args of ARGS[file.slice(0, -4)] ?? [[]]) tests.push({ name: `regress/${file}${args.length ? ' ' + args.join(' ') : ''}`, run: [`regress/${file}`, ...args] });
}
tests.push({ name: 'smoke.mjs', run: ['smoke.mjs'] });
// Keystone slabs as they lie in the world's own cells, on 200 worlds: fifty to a run, so that four run side by side.
for (let from = 1; from <= 151; from += 50) tests.push({ name: `slab-moat.mjs 50 ${from}`, run: ['slab-moat.mjs', 50, from] });
for (let seed = 11; seed <= 18; seed++) tests.push({ name: `rope-fuzz.mjs ${seed} 600 5`, run: ['rope-fuzz.mjs', seed, 600, 5] });
// North is up the screen: negative y.
for (const [seed, x, y, way] of [[11, 0, -200, 'north'], [12, 0, 200, 'south'], [13, 200, 0, 'east'], [14, -200, 0, 'west']]) tests.push({ name: `rope-fuzz.mjs ${seed} 600 5 ${x} ${y} (${way})`, run: ['rope-fuzz.mjs', seed, 600, 5, x, y] });

// And from inside a province of each strain, where the ground has shapes of its own for the string to lie on.
for (const [seed, x, y, strain] of [[7, -128, -384, 'firn'], [7, 128, -384, 'serac'], [7, -128, 384, 'scoria'], [7, 128, 384, 'forge'], [11, -384, 128, 'tangle'], [7, -384, -128, 'sporefall'], [11, 384, -384, 'redrock'], [7, 384, -128, 'loess']]) {
  tests.push({ name: `rope-fuzz.mjs ${seed} 400 7 ${x} ${y} (${strain})`, run: ['rope-fuzz.mjs', seed, 400, 7, x, y] });
}

// And from inside provinces of generated crosses, with each structure among them: great caves, lanes of ice,
// bubbles and level beds for the string to lie on.
for (const [x, y, reach, cross] of [[-912, -304, 8, 'buzzmire'], [384, 1152, 8, 'hollow flashrock'], [384, -1408, 9, 'crazed tundra'], [-128, -1920, 9, 'frothy hailstone'], [1408, 384, 9, 'banded kilnstone'], [-1408, -384, 9, 'banded rimemoss']]) {
  tests.push({ name: `rope-fuzz.mjs 7 400 ${reach} ${x} ${y} (${cross})`, run: ['rope-fuzz.mjs', 7, 400, reach, x, y] });
}

// And from a start in the crack of a keystone slab: the first slab, one with three keys, the middle of a cobble
// field (joints one cell wide between blocks that hang by a key each) and the widest slab there is.
for (const [seed, x, y, reach, what] of [[7, 3, 44, 3, 'the first slab'], [7, 334, 375, 7, 'a slab of three keys'], [7, 192, -500, 7, 'a cobble field'], [11, 222, 82, 6, 'a slab 16 in radius']]) {
  tests.push({ name: `rope-fuzz.mjs ${seed} 400 ${reach} ${x} ${y} (${what})`, run: ['rope-fuzz.mjs', seed, 400, reach, x, y] });
}

// And from inside an amber hive, where the string lies on walls of wax a cell thick and on nuggets that hang by a
// stalk: the west's first hive, a great one, and one 23 cells in radius.
for (const [x, y, reach, what] of [[-205, -11, 6, 'the west\'s first hive'], [-456, -72, 7, 'a great hive'], [-464, 49, 7, 'a hive 23 in radius']]) {
  tests.push({ name: `rope-fuzz.mjs 7 400 ${reach} ${x} ${y} (${what})`, run: ['rope-fuzz.mjs', 7, 400, reach, x, y] });
}

// And from inside a pumice drift, where the string lies on boulders that hang on nothing and go when it is round
// them, and an ash flat, which the drill ploughs through at any angle: each direction's first and a great one.
for (const [x, y, reach, what] of [[14, -165, 5, 'the north\'s first drift'], [470, 431, 7, 'a drift of fifteen boulders'], [-14, 165, 5, 'the south\'s first ash flat'], [-207, 211, 6, 'a great ash flat']]) {
  tests.push({ name: `rope-fuzz.mjs 7 400 ${reach} ${x} ${y} (${what})`, run: ['rope-fuzz.mjs', 7, 400, reach, x, y] });
}

// And on two worlds more: a cross with lanes of ice and one with level beds, a cobble field of thirty-two blocks,
// a hive, a drift and an ash flat.
for (const [seed, x, y, reach, what] of [[19, 128, -1408, 9, 'crazed thaw'], [23, -1152, 384, 8, 'banded rimemoss'], [23, -310, 49, 6, 'a cobble field of 32'], [23, -330, -54, 6, 'a hive 21 in radius'],
  [19, 300, -171, 6, 'a drift rich in aerolite'], [23, 88, 210, 6, 'a great ash flat']]) {
  tests.push({ name: `rope-fuzz.mjs ${seed} 400 ${reach} ${x} ${y} (${what})`, run: ['rope-fuzz.mjs', seed, 400, reach, x, y] });
}

// And from beside the first site of each rare hazard on world 7: a rime bell, a fumarole, a glowworm, a lodestone.
for (const [x, y, what] of [[141, -576, 'a rime bell'], [-139, 565, 'a fumarole'], [-558, -141, 'a glowworm'], [562, 151, 'a lodestone']]) {
  tests.push({ name: `rope-fuzz.mjs 7 400 6 ${x} ${y} (${what})`, run: ['rope-fuzz.mjs', 7, 400, 6, x, y] });
}

// And in a deep flank, where the crystals and the lava are thickest. (Flown first from 1000,1000, on the diagonal,
// where the south-east's deep seam lies now.)
tests.push({ name: 'rope-fuzz.mjs 31 400 9 768 1024 (deep south)', run: ['rope-fuzz.mjs', 31, 400, 9, 768, 1024] });

// And from inside each seam, where two directions' ground and hazards meet, and each deep strain: the glacier's
// halls sheathed in ice, the caldera's lakes in their slag, the mycelium's faults and caps, the druse's geodes.
for (const [x, y, reach, what] of [[624, -632, 8, 'hoarstone'], [560, 584, 8, 'glassdune'], [-568, 544, 8, 'cinderfen'], [-616, -592, 8, 'frostfen'],
  [-480, -1248, 8, 'glacier'], [824, 1360, 9, 'caldera'], [-1576, 648, 9, 'mycelium'], [1264, -472, 8, 'druse']]) {
  tests.push({ name: `rope-fuzz.mjs 7 400 ${reach} ${x} ${y} (${what})`, run: ['rope-fuzz.mjs', 7, 400, reach, x, y] });
}

// And the shop and STATS, and what is called out across the screen, in Russian and in Mandarin, which say most of
// their lines in more or fewer pixels than English (h-shop-fit and h-call-clear, run with TETHERBORE_LANG:
// js/lang.js). (The language test, l-lang, runs itself in each.)
for (const id of ['ru', 'zh']) for (const name of ['h-shop-fit', 'h-call-clear', 'p-pad']) tests.push({ name: `regress/${name}.mjs [${id}]`, run: [`regress/${name}.mjs`], env: { TETHERBORE_LANG: id } });

const queue = tests.filter(test => test.name.includes(only)), began = Date.now();
let failed = 0, done = 0;
const one = test => new Promise(resolve => {
  const t = Date.now(), child = spawn(process.execPath, [here + test.run[0], ...test.run.slice(1).map(String)], { cwd: here + '..', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...test.env } });
  let out = '';
  child.stdout.on('data', data => { out += data; });
  child.stderr.on('data', data => { out += data; });
  // A test that hangs is a failed test: the longest (c-long-band) takes about a minute alone, and two or three when
  // every core is busy.
  const timer = setTimeout(() => { out += '\ntook over 420 s: stopped'; child.kill(); }, 420000);
  child.on('close', code => {
    clearTimeout(timer);
    const ok = code === 0, lines = out.trim().split('\n');
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${test.name}  (${((Date.now() - t) / 1000).toFixed(1)} s)${ok ? '' : `\n     ${lines.slice(-2).join('\n     ').slice(0, 600)}`}`);
    done++;
    resolve();
  });
});
const workers = Array.from({ length: Math.max(1, Math.min(queue.length, availableParallelism() - 1)) }, async () => { while (queue.length) await one(queue.shift()); });
await Promise.all(workers);
console.log(`${done} tests, ${failed} failed, ${((Date.now() - began) / 1000).toFixed(0)} s`);
process.exit(failed ? 1 : 0);
