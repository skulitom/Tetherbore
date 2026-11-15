
===== LENS geometry =====
TRIED: Built a rig under C:/DEV/Tetherbore-hunt/test/hunt/geometry/ (rig.mjs) with an independent homotopy oracle: every bounded piece of rock is a puncture with a ray, and the reduced crossing word of the drill's flown path (sub-steps included) must equal the band's; oracle-selftest.mjs shows it catches a wrong band the harness calls sound. With it and tetherFaults after every frame I ran hand-made uncuttable fields (single pillars, diagonal pinch chains, a pillar lattice with many corners in line, bars and one-wide passages, checkerboards) flown slowly, fast, with exact keyboard directions and diag

--- F1 [wrong-behaviour] real=True repro=True
TITLE: After a haul the tether stays hooked on a corner it no longer turns round: two bends on one corner (or a bend it runs out to and straight back from) are never let go
MECH: retighten() (js/game.js 335-346) keeps a bend when `turn * b[2] >= 0`, where turn is the cross product of its two spans. Two shapes give a cross product of exactly 0 although the string does not turn round the corner. (1) Twin: the string passes one corner twice, out and back round a piece (band ... d, q1, q2, q3, d ...); the piece is hauled, the bends between are dropped, and the two d bends are neighbours with opposite turns and a zero-length span between them. The same twin is made when caught(c, b, a) sweeps about a bend c whose ground is gone and the triangle holds the string's own next bend d: d is caught a second time, then c is dropped. (2) Fold-back: a and c lie in line on the same side of b (A, B, A). In both cases turn is 0, so the bend is kept on every later retighten. tend() (310-332) cannot lift it either: bx = pivot[0] - P[2][0] and by are 0, so `then` is 0 and `then * pivot[2] < 0` is never true. The harness's tetherFaults has the same blind spot (both its tests come out 0), which is why test/rope-fuzz.mjs reports nothing.
CMD: node test/hunt/geometry/twin-hairpin.mjs   (hand-made ground, steering only). In ordinary play: node test/hunt/geometry/twin-natural.mjs 16   and   node test/hunt/geometry/fuzz-natural2.mjs 15 600 5 2
FIX: In retighten, before the turn test: (a) let go of a bend whose two neighbours are in line with it on the same side (cross 0 and dot of the two spans > 0); (b) when P[n] and P[n+1] have the same corner key, make them one bend: keep it with the sign of the turn the string now makes from P[n-1] to P[n+2] if the corner's cell lies inside that turn, otherwise give it the wrong sign so the existing caught(c, b, a) sweep lets it go. In tend, take the lift direction from the nearest point of the band that differs from the pivot. This was tried from the test side without touching js/ (patchTwins in test/hunt/geometry/rig.mjs, switched on with FIX=1): `FIX=1 node test/hunt/geometry/fuzz-natural2.mjs 15 600 5 2` and seeds 11, 16, 21, 22, 31, 35 give kinds {} for twins and fold-backs with the harness sound, and `FIX=1 node test/hunt/geometry/fuzz-soft.mjs 4 500 16 2 4` (and 14, 18-22) keeps the homotopy oracle at bad 0. Also add a twin and fold-back test to tetherFaults.
REACHABLE: Yes, in ordinary play with no staged ground. The stock fuzz's flight (makeGame(seed, upgrade levels) plus steering through game.input.auto only) produces it on generated ground: reach 5 / bit 4 on seeds 11, 13, 14, 15, 16, 17, 18 (7 of 8; seed 12 clean), and already at reach level 1 / bit level 1 (seed 15) and reach 2 or 3 / bit 1 (seeds 14, 15, 16). With no upgrades at all (reach 0, bit 0) I saw none in 3 seeds x 1500 turns; the tether is too short there to lay long loops, so it is a mid-game d
NOTES: I tried to refute this and could not. It is a defect of the game, not of the test.

**What I ran (all from C:/DEV/Tetherbore-hunt)**

Reporter's commands, output as claimed:
- `node test/hunt/geometry/twin-hairpin.mjs` ends with band `[[0.5,-5.407],[10,3,-1],[10,3,1],[0.5,0.5]]`, length 22.51 against 5.91 straight, harness check "sound", exit 1.
- `node test/hunt/geometry/twin-natural.mjs 16` gives the twin at frame 3615 (hauls 4 -> 5), present in 8573 frames, still there at the end, 0 harness faults.
- `node test/rope-fuzz.mjs 16 600 5` reports framesWithFaults 0.
- `node test/hunt/geometry/fuzz-natural2.mjs 15 600 5 2` gives `{"fold-back":17297,"twin (same corner twice)":2494}`.

My own scripts, under C:/DEV/Tetherbore-hunt/test/hunt/verify/tw2/:
- `node test/hunt/verify/tw2/natural.mjs 16` uses stock steering on untouched ground, its own detector, and its own scan for ground inside th

--- F2 [wrong-behaviour] real=True repro=True
TITLE: A fast drill that slides round a corner inside one frame leaves the tether lying through the rock
MECH: fly() (js/game.js 464-470) moves the drill in up to a dozen sub-steps of 0.3 cells, sliding along what stops it, so in one frame the drill can go down a pillar's face and on past its corner. tend() (310-332) is called once a frame and sweeps one triangle from the old position straight to the new one. When the slide is long enough (more than about 2.8 cells in the frame) that straight chord passes on the far side of the corner the drill actually went round; the corner is outside the triangle (pivot, cur, to), catchIn never sees it, and the span from the previous bend to the drill runs through the cell. Nothing later repairs it: the bend still turns the right way, so the fault stays and the loop round the rock is lost.
CMD: node test/hunt/geometry/fast-slide.mjs   (how often: node test/hunt/geometry/search-slide2.mjs 4 30 700)
FIX: Let the string follow the path the drill really took: call this.tend() inside fly()'s sub-step loop after each sub-step (or record the sub-step points and have tend sweep each leg in turn). One sub-step moves at most 0.3 cells on each axis and the body's 0.34 half-width keeps every point of that small chord clear of rock, so a per-sub-step sweep cannot cut a corner. The same goes for the dig-centring and reach-clamp moves, which are small.
REACHABLE: Yes, by steering alone, but it is rare and belongs to the late game. It needs about 2.3 or more cells of travel in one frame while the drill slides down the end of a one-cell-thick piece of rock and on past its corner.

- **Steady 60 fps:** that is roughly 140-165 cells/s, so RAM level 3-4 and a 9-12 s run without touching anything. The reporter's search gives 1 of 4200 aimed approaches at top speed.
- **30 fps, or one dropped frame at 60 fps:** much less is needed. main.js passes dt up to 0.05,
NOTES: I could not refute it: the defect is real, the mechanism is as claimed, and the proposed fix removes it, with one correction below.

**Reporter's command.** `node test/hunt/geometry/fast-slide.mjs` exits 1 with the reported output: sound at frame 725, then at frame 726 `span 0 (-58.02,3.12)-(-58.50,1.50) passes through rock at (-58.22,2.45)`, 240 more faulty frames, and `flown [0:-1] band []`. The frequency runs also match: search-slide2 gives 1 of 4200 (RAM 4, 60 fps), 24 of 2600 (RAM 4, 30 fps) and 9 of 2800 (RAM 1, 20 fps); fuzz-fast gives 42 bad frames.

**The test is sound.**
- Staging is `setK` followed by `game.changed()`.
- It is a clean flight from frame 1, steering only, with valid levels (tether 9 and momentum 4 are the top levels).
- `tetherFaults` is right here: the span from bend (-58,2) to the drill at (-57.52,3.62) crosses the pillar cell's interior.
- By hand, corner (-5

--- F3 [wrong-behaviour] real=True repro=True
TITLE: With more than about 600 bends, retighten stops short: bends beyond it are left on ground that is gone
MECH: retighten() loops `for (let guard = 0, n = 1; n < P.length - 1 && guard < 600; guard++)` (js/game.js 337) and every bend it merely walks past costs one of the 600 steps. On a band longer than that the loop ends before the far bends (toward the core) are looked at, so a bend there whose cell has been cut or hauled is never let go and stays as a bend in open space; every later changed() stops at the same place. Natural random play without unwinding reached 260-329 bends in 29 minutes (FIX=1 fuzz-natural2.mjs 33/34 3000 7 2 ...), so this is a long-session fault.
CMD: node test/hunt/geometry/long-band.mjs
FIX: Do not spend the guard on bends that are sound: count only the sweeps, or scale the limit with the band, e.g. `guard < 600 + 4 * P.length`. Better still, have changed(touched) tell retighten which cells went, so it visits only bends whose b[3] is among them and their neighbours.
REACHABLE: Yes, but only in a long session. With nothing staged (the game as it starts, drill at the core, upgrades maxed, random full-throttle steering that never deliberately goes home), the band passed 600 bends after 34 to 59 game-minutes on all three seeds I ran. Two of the three then left a bend on a corner that was gone: seed 7 (reach level 9) at 58.7 game-minutes, bend 648 of 1004, still there 18 minutes later when the run ended; seed 34 (reach level 7) at 75.8 game-minutes, bends 663 and 666 of 72
NOTES: The report holds: I could not refute it.

**Reporter's command.** `node test/hunt/geometry/long-band.mjs` (from C:/DEV/Tetherbore-hunt, exit 1, 32 s) printed exactly what was reported: 718 bends after 55250 frames with 0 faulty frames; opening the cell under bend 100 left 0 bends on it and the harness sound; opening the cell under bend 676 left 4 bends on it, first fault "bend 608 (55.50,-48.50) is on a corner that is gone".

**Staging is fair.** The arena and pillars are set with setK and then `place()` calls `game.changed()`. The cell is opened with setK plus `game.changed([cell])`, which is what finishDig does. The near-bend control shows the same operation works when the bend is within the loop's reach. tetherFaults' "corner that is gone" check is simply `w.k(b[3]) === EMPTY`, so the check is not mistaken.

**Mechanism confirmed in code.** js/game.js line 337: `for (let guard = 0, n 

--- F4 [wrong-behaviour] real=True repro=True
TITLE: A haul at the end of two very long legs leaves the bend standing in open space: the triangle is too large to search and retighten gives up
MECH: catchIn() returns undefined once it has looked at more than 400000 cells (js/game.js 263) and caught() passes that on. retighten() treats it as nothing to do: `if (!got) { n++; continue; }` (342), so a bend whose corner is gone, with spans of roughly 900 cells either side at a right angle, is neither let go nor replaced by the corners the string should settle on. It stays until the drill happens to swing back past straight. (tend would also drop a lifted bend without sweeping on undefined, line 327, but its per-frame triangles never get that large.) Needs reach level 8 or 9 and legs of about 900 cells, so it is rare.
CMD: node test/hunt/geometry/big-triangle.mjs 900   (for comparison, sound: node test/hunt/geometry/big-triangle.mjs 600)
FIX: Never give up on a sweep: when catchIn returns undefined, caught() should split the end's travel in two (from -> midpoint, then midpoint -> to) and sweep each part, recursively, since a sweep done in parts is exact and each part's triangle has half the area. Alternatively make the scan cheap enough to need no limit by skipping 64 x 64 pieces of the world that are wholly open or not yet made.
REACHABLE: Yes, but only by an unusual pattern late in the game. I reached it with arrow keys alone on natural ground (seed 7, nothing staged), with reach level 8 and bit and ram at their top levels.

The route: dig a tunnel east 960 cells, dig a shaft south 820, fly back up, dig 60 more east, dig a second shaft south 820, then cut west along the bottom to join the two shafts. The 39,000-cell strip between them comes loose and is hauled while the drill is at the far corner. The bend on the strip's top corn
NOTES: **Reporter's command**

`node test/hunt/geometry/big-triangle.mjs 900` reproduces exactly as reported: exit 1, band `[[902.5,1010.66,0],[901,1,1],[0.5,0.5,0]]`, "bend 1 (900.50,0.50) is on a corner that is gone", still there two seconds later. With 600 it ends sound, exit 0.

The staging is legitimate: the loose bar is registered through `game.changed([cut cell])`, the drill is flown by input, and the check is the harness's own `tetherFaults`. The script's last line ("a straight line from the core to the drill runs through solid ground") is only information; it prints for the sound 600 case too.

**Mechanism**

Confirmed as claimed. `catchIn` returns undefined past 400,000 cells looked at (js/game.js 263), `caught` passes it on (297), and `retighten` skips the bend with `if (!got) { n++; continue; }` (342).

**Played reproduction**

`node test/hunt/verify/big-triangle-played.mjs 960 820 

===== LENS terrain =====
TRIED: Read the tether and world code, located every setK in js/game.js (finishDig, haul, trigger, lava to basalt, moss, ice, blast: each is followed by changed(), so openings are always retightened) and wrote 15 scripts under C:/DEV/Tetherbore-hunt/test/hunt/terrain/ with three extra checks the stock tetherFaults lacks (a span with rock on both sides, a bend whose turn encloses open space, the drill's own cell being rock). Exercised: 14 seeds of random flight with about 12,000 staged openings under and beside bends (a bend's own cell, a neighbour, blocks, half of all bend cells at once, bombs) which

--- F5 [wrong-behaviour] real=True repro=True
TITLE: A throw up a frost tunnel ends inside ice: the drill is stuck for good and the tether runs through rock
MECH: fling() (game.js 525-545) checks the line of the throw once, then fly()'s `d.mode !== 'free'` branch (436-449) moves the drill straight to d.tx,d.ty for up to 0.55 s with no ground check. In that time updateHazards' frost pass (911-919) turns every cut older than 30 s to ice unless it is under the tether (`lies`) or within one cell of the drill, so the cells ahead of a drill in flight, and its landing cell, freeze. The drill lands in an ICE cell: the rescue at line 433 needs `w.k(this.di) === K.EMPTY`, so it does not apply; free() fails for every move; bite() (513-522) probes 0.64 cells from the centre, which from a cell centre only reaches the neighbours, so the drill's own cell can never be cut. tend() cannot help because the sweep along the line of flight has zero area. It is easy to hit: update() skips updateHazards while the shop is open (1037) but this.time still advances (1030), and key() (205) shuts the shop and steers in the same press, so after 30 s in the shop every frost cut is overdue and freezes on the next 0.4 s tick, mid-flight. By touch (tap to shut the shop, then drag) it fails for any drag begun within 0.4 s of the tap (frost-fling-touch.mjs: 12 of 14 delays). With no shop at all, a throw within about 0.5 s of the oldest cut turning 30 s leaves the tether through an ice plug (frost-fling-noshop.mjs: 15 of 36 moments). The same unchecked flight applies to moss and basalt closing; that was not run.
CMD: node test/hunt/terrain/frost-fling.mjs
FIX: Three parts. (1) In fly()'s fling/home branch, test `this.free()` at the next position each frame and end the flight at the last free place when ground has grown across the path. (2) In updateHazards' `lies`, while `d.mode !== 'free'` also add cellsAlong(d.x, d.y, d.tx, d.ty) to `under`, so nothing closes on the path of a throw. (3) As a backstop for 'never stuck', when the drill is free and `w.k(this.di) !== K.EMPTY`, open that cell (setK EMPTY, then changed([di])) instead of leaving it; today the rescue at line 433 only handles neighbours closing.
REACHABLE: Yes, by ordinary play, and I reproduced it with nothing staged. On seed 11 with only upgrade levels set (tether 5, drill 4), the drill digs north from the core by steering until twelve frost cells are cut (cells -108 to -119), flies home down its own shaft, opens the shop with Enter, waits 31 s, and presses ArrowUp. That one press shuts the shop and throws the drill up the shaft.

- **Keyboard:** deterministic. Any throw longer than about 19 cells lasts 0.55 s, the frost tick is every 0.4 s, and
NOTES: I could not refute it: the defect is real, and the reporter's staging is not the cause.

**What I ran**

- `node test/hunt/terrain/frost-fling.mjs` gives the reported output exactly (exit 1). The staging is sound: the crust shaft is opened with `setK` and then `game.changed()`, and the frost cells are cut by real play.
- `node test/hunt/verify/frost-tunnel-played.mjs key 31` is my own version with no `setK` at all. Output: "thrown: 33 frames in flight, frost closed on flight frame 5; landed [0.00,-119.00] mode free; own cell ICE", then the tether fault "span 0 (0.00,-119.00)-(0.00,0.00) passes through rock at (0.00,-118.95)", then "steered eight ways, 4 s each: moved 0.000 cells at most; own cell now ICE; cells N/S/E/W now EMPTY/EMPTY/EMPTY/EMPTY".
- `node test/hunt/verify/frost-tunnel-played.mjs key 3` is the control with 3 s in the shop: same throw, lands in open ground, no faults.
- `

--- F6 [wrong-behaviour] real=True repro=True
TITLE: After a haul the tether stays hooked on a corner it no longer goes round: two bends left on one corner are never let go
MECH: retighten() (335-346) lets the hauled piece's bends go one at a time from the drill's end, each by `caught(c, b, a)` sweeping about the next bend c, which is often itself on ground that has just gone. A sweep about such a doomed pivot can catch a held corner that the tether already has a bend on a little further along (the skip list only holds the keys of a, b and c). When the doomed bends between them are let go in turn, the last sweep runs from the pivot to itself (zero area), and two bends with the same corner key and opposite turns end up neighbours. Their span has zero length, so the turn test is 0 for both: `turn * b[2] >= 0` at line 340 keeps each, and in tend() `bx, by` (318) are 0 so `then * pivot[2] < 0` (320) is never true. Each shields the other, and the string runs from the drill out to that corner and straight back for the rest of the session, including after flying home. Stock tetherFaults does not see it (its cross products are 0 too), which is why test/rope-fuzz.mjs passes. In the stock random flight it is common: `node test/hunt/terrain/hook-count.mjs <seed> 600 5` for seeds 1-8 gives a bend round open space in 6 of 8 seeds, every one beginning on a haul frame, lasting 15 s to 219 s (to the end of the run), with 0 stock faults; that count includes finding 4's kind as well.
CMD: node test/hunt/terrain/twin-bend.mjs
FIX: In retighten() after each splice, and in tend() after each splice, collapse neighbours that share a corner key: if P[n][4] === P[n+1][4], remove both when their turns differ (they cancel) or one when they agree, then step n back and re-test. Better still, stop pivoting about doomed bends: first mark every bend whose cell is EMPTY, then let a whole run of them go against the first sound point beyond the run (sweep about that point from each doomed bend in turn), so nothing is caught relative to a position the string never holds. Also extend tetherFaults to flag neighbouring bends on one corner and bends whose turn encloses open ground (openBends in test/hunt/terrain/lib.mjs does this).
REACHABLE: Yes, in ordinary play with no staged ground. Flying the stock rope-fuzz random steering on untouched worlds (node test/hunt/verify/twin-natural.mjs <seed> 600 5, and test/hunt/verify/twin-fix-trial.mjs <seed> 600), two neighbouring bends with the same corner key and opposite turns appeared in all 8 of seeds 1-8, every time on a frame that hauled a piece: within the 600 random turns for seeds 1, 2, 3, 4, 6 (first at frames 19306, 7040, 4538, 8069, 9494), and on a haul during the straight flight h
NOTES: Could not refute. Ran `node test/hunt/terrain/twin-bend.mjs` in C:/DEV/Tetherbore-hunt: exit 1, output exactly as reported (tether after the haul: drill (-6.45,-1.50), bend(-8,-9 turn -1), bend(-8,-9 turn 1) both on cell (-8,-10), core; length 20.59 vs 6.51 straight with clear sight; still there after flying away and home; stock tetherFaults []).

Checked the test rather than trusting it:
- Staging is sound: ground is set with world.setK and followed by game.changed() before any flight; the piece is held (0 loose pieces known before the cut) and is freed by a real cut made through game.input.auto; the flight is ordinary steering. Nothing about the tether is written by hand.
- The verdict of the check is right, not an artefact: by hand, the closed loop core-(7,-3)-(-8,-9)-(-9,-22)-(-16,-22)-(-16,-16)-(-12,-2)-drill does not enclose the wall W (it passes W to the west and south), so with t

--- F7 [wrong-behaviour] real=True repro=True
TITLE: Ice (and basalt) closes on the far side of a span that lies along a wall, leaving the tether inside solid rock
MECH: updateHazards' `lies` (852-865) marks the cells under the tether with cellsAlong on the band's own line and on the laid line. For a span that runs exactly along a lattice line (two bends with the same x or the same y, which is what a string lying against a wall face is), cellsAlong's Math.floor puts the whole band line in the row below or the column to the right, and the laid line (offset 0.16 at each bend, to opposite sides in an S-bend) covers the other side only for the half of the span next to one bend. The cells on the uncovered side are therefore free to freeze (916), set to basalt (886) or grow moss (897) even where the cell on the other side of the line is already rock. The span then runs along the seam between two rock cells. Stock tetherFaults passes it because the sample is within 0.04 of a cell edge, but the string is inside closed ground, and no later sweep can catch a corner there: in the staged case, flying back down the cut leaves band = [drill, core] straight through about 150 cells of rock for 70 frames, which the stock check does report. It happens in the stock random flight without any staging: `node test/hunt/terrain/seam-trace.mjs 11 600 0 -150` (the same flight as `node test/rope-fuzz.mjs 11 600 5 0 -150`, which reports 0 faults) prints 'frame 3135 t=52.07: span 19 (-28,-165)-(-19,-165) runs in a closed seam: rock on both sides at (-24.90,-165.00), kinds 7 and 11; cells that closed this frame: [[-26,-166,0,11],[-25,-166,0,11]]', and seam-count.mjs shows
CMD: node test/hunt/terrain/ice-seam.mjs
FIX: In `lies`, cover both sides of every span: besides the band line and the laid line, run cellsAlong on the band span shifted by a small step (say 1e-3) to each side along its normal, and add those cells to `under`. That protects both rows of a lattice-line span and both diagonal cells where a span passes exactly through a lattice point. Add the seam check (seamFaults in test/hunt/terrain/lib.mjs: rock at both points 1e-3 either side of a sample) to tetherFaults so the fuzz sees this class.
REACHABLE: Yes, in ordinary play in the frost (north) ground, with no staging needed. The stock random flight (node test/rope-fuzz.mjs 11 600 5 0 -150, which only carves its usual start tunnel) reaches it at frame 3135: the cells that froze, (-26,-166) and (-25,-166), are natural frost ground the drill itself cut at t=21.8-22.0 s, far from the start tunnel, and they closed at t=52.07 s (the 30 s frost timer) while the tether span between bends (-28,-165) and (-19,-165) had been resting unmoved on that latt
NOTES: I could not refute it; the defect is the game's, not the test's.

Ran (all from C:/DEV/Tetherbore-hunt):
- node test/hunt/terrain/ice-seam.mjs -> exactly the reported output (seam at t=31.67 s, 70 stock fault frames on the flight back, exit 1); control `ice-seam.mjs 0` -> no seam, 0 faults.
- node test/hunt/terrain/seam-trace.mjs 11 600 0 -150 -> frame 3135 seam as reported; node test/rope-fuzz.mjs 11 600 5 0 -150 -> 0 faults (stock check lets it by: samples within 0.04 of a cell edge).
- node test/hunt/terrain/hazard-fuzz.mjs 2 500 0 170 0.08 -> basalt seam, kinds 12 and 3.
- seam-count.mjs seeds 3, 11, 5 -> seam in 3 and 11, none in 5 (I did not rerun all 7 seeds of the "3 of 7" claim).

Checks on the test itself: staging in ice-seam.mjs is sound (slab and shaft set before play, followed by game.changed(); the script throws unless every slab cell is frost biome; the drill gets there by

--- F8 [visual] real=True repro=True
TITLE: After a haul the tether takes up a corner that lies on the span it is straightening away from, and keeps it: a bend round open space
MECH: catchIn() (242-287) lets through a corner that lies exactly on the edge the moving end travels along (the second test at line 277 only rejects `< -1e-9`), and then decides by `side * ((qx - px) * (row + 0.5 - qy) - (qy - py) * (x + 0.5 - qx)) > 0` (279), which asks only whether the cell is ahead of the line pivot->corner, not whether the string reaches it. In retighten() that edge is the old span b->a, which runs between lattice corners and often along a cell face, so corners exactly on it are common: typically the other corner of bend a's own cell, a cell that lies wholly beyond the old span. The string only ever touches that corner with its very end, yet it is caught. The turn recorded for it is by construction the turn it has, so retighten's test at 340 keeps it, and the string goes pivot -> wrong corner -> along the cell's face -> a, instead of pivot -> a. Stock tetherFaults passes it (turn and side signs agree). The kink is a cell face long (it could be as long as a wall face beyond the old span), and it persists: in the stock flight it arises on haul frames and lasts for minutes, e.g. `node test/hunt/terrain/hook-trace.mjs 7 13298` prints 'let go (-134,82 ... GONE): sweep about (-144,82 ... GONE) toward (-134,73 turn 1 cell -134,73) catches (-134,74 turn -1 cell -134,73)' then 'bends round open space: ["bend 3 at corner (-134,74) turns round open space: between (-134.00,73.00) and (-154.00,77.00)"]', and hook-count.mjs has it lasting 131 s on that seed.
CMD: node test/hunt/terrain/far-edge-catch.mjs
FIX: In catchIn, for a corner whose cross product with the cur->to edge is within 1e-9 of zero, also require its cell to lie on the triangle's side of that edge: skip it unless `side * ((tx - cx) * (row + 0.5 - cy) - (ty - cy) * (x + 0.5 - cx)) > 0`. A cell beyond the path of the moving end is never reached by the string. This proposed test was not run against the game (js/ is frozen here); check it with far-edge-catch.mjs and hook-count.mjs.
REACHABLE: Yes, in ordinary play with nothing staged. It happens on a haul frame: the player flies round a loose piece, it is reeled, and retighten() lets go of the bends that were on it. If the old span being straightened away from runs along the face of a cell that lies beyond it (typically the other corner of the next bend's own cell), that corner is caught and kept.

The stock random flight of test/rope-fuzz.mjs (fresh game, steering through game.input.auto only, reach 5 / drill 4) reaches it in 4 of t
NOTES: I could not refute it. The defect is real and the reporter's mechanism is right; one detail of the report is wrong (see Correction).

**What I ran**

- `node test/hunt/terrain/far-edge-catch.mjs` gives exactly the reported output, exit 1. After the haul the tether is drill (12.48,-18.82) -> bend (10,-8 turn 1) -> bend (10,-7 turn -1) -> core, both bends on cell (10,-8). Stock tetherFaults is empty.
- `node test/hunt/terrain/hook-trace.mjs 7 13298` prints, in the unstaged stock flight: "let go (-134,82 ... GONE): sweep about (-144,82 ... GONE) toward (-134,73 turn 1 cell -134,73) catches (-134,74 turn -1 cell -134,73)". The moving end travels up x=-134, the caught corner is on that path, and its cell lies on the far side of it from the pivot. That matches catchIn line 277 (the second test only rejects `< -1e-9`) and line 279 (asks only whether the cell is ahead of pivot->corner).
- `node 

--- F9 UNVERIFIED [wrong-behaviour] A haul far from the drill leaves a bend on a corner that is gone when the triangle to straighten across is over 400,000 cells
MECH: catchIn() gives up with `undefined` once it has looked at more than 400000 cells (line 263), and retighten() answers that with `if (!got) { n++; continue; }` (342), keeping the bend even though `w.k(b[3])` is EMPTY. So when a hauled piece carried a bend whose two neighbours in the band are each about 900 cells away at a wide angle, the bend stays in open space; every later changed() tries again and gives up again, and tend() only drops it if the string happens to swing past straight there. Stock tetherFaults reports it. It needs reach level 8 (1350) or 9 and a long thin loose piece (here a str
FIX: In retighten(), when caught() returns undefined, do the release in slices instead of skipping it: walk the moving end from b to a in k steps (k = ceil(estimated triangle area / 300000)), calling caught() for each slice with the pivot carried forward, so each search stays under catchIn's cap and the whole triangle is still covered once. If a slice still cannot be searched, a bend whose cell is EMPTY should at least be removed rather than kept.

===== LENS modes =====
TRIED: Lens: modes, discontinuities and limits. All scripts are in C:/DEV/Tetherbore-hunt/test/hunt/modes/. I fuzzed mode changes (trips home, throws from the core with a wound band, bombs, dt 1/60, 0.05 and mixed) over about 250k frames, fuzzed a cavern of loose rock islands, searched every throw direction for a drill left stuck beyond the reach ring, checked fresh() mid-flight and restore() with and without a database, and soaked random flight at reach 750, 1350 and 2300 from starts 600 to 2200 cells out for up to 67 game-minutes a run, timing every part of the frame. Clean: the reach ring (a throw

--- F10 [wrong-behaviour] real=True repro=True
TITLE: A drill thrown from the core lands inside ground that grew back while it was in the air, and is stuck for good
MECH: fling() works out the landing spot once, from the cells open at that moment, and fly() in mode 'fling' then moves the drill straight there with no further check. updateHazards() closes frost cuts with ice (30 s after the cut) and the ground round a burst pod with moss (6 s after) unless lies(i) says the tether is in the cell or the drill is within one cell. During a throw the tether is still behind the drill, so the cells ahead of it, including the one it will land in, are unprotected. Once the drill's own cell is rock, free() is false for every move, the snap in fly() requires w.k(this.di) === K.EMPTY so it does nothing, and bite() only looks at neighbouring cells, so it can never cut itself out. Only a bomb or a reload frees it. It needs a throw that ends in a cell due to close within the 0.55 s flight: a tunnel in frost cut back toward home (the far end is oldest, so each throw during the freeze lands in the next cell to go; a window of over 1.4 s in this repro), or a throw back to a pod within 6 s. When the cells that close are in mid-path instead (fling-frost.mjs), the drill lands beyond the ice with the tether through it.
CMD: node test/hunt/modes/fling-frost-stuck.mjs   (also: node test/hunt/modes/fling-moss.mjs ; node test/hunt/modes/fling-frost.mjs)
FIX: While d.mode !== 'free', have lies() also add cellsAlong(d.x, d.y, d.tx, d.ty) to `under`, so nothing closes on the line of a throw. In the non-free branch of fly(), stop the drill short if the next cell on its line is no longer open. As a last resort, extend the snap in fly(): when the drill's own cell is rock, open that cell (or move the drill to the nearest open cell on the tether) and call changed().
REACHABLE: Yes, in ordinary play with nothing staged. I reproduced it in a fresh world (seed 7, only upgrade levels set: reach 230, bit MK5) where the drill really digs north from the core into the natural frost (which begins about 134 cells out), cuts a loop off the side of its shaft, flies home and is thrown by real input events.

1. By timing, as reported: the shaft stops at the frost border (133 out), the loop's last stroke comes back down the shaft's line, and a thumb stroke north 22.5 to 24.0 s after
NOTES: Ran the reporter's three commands from C:/DEV/Tetherbore-hunt; all three give the reported output (exit 1 each): fling-frost-stuck 'own cell is ICE ... moved 0.000 cells at most', fling-moss 'own cell is SOFT ... moved 0.000', fling-frost 'span 0 (0.00,-163.00)-(0.00,0.00) passes through rock at (0.00,-151.45)'.

I could not refute it. The staging is sound (setK/setB then game.changed(), band set consistently, d.armed = true is exactly what pointerDown does) and the staged shape is one a player makes. The mechanism is as claimed: fling() (js/game.js 525-545) fixes d.tx/d.ty once; the non-free branch of fly() (436-449) moves there with no check; updateHazards' lies() (852-865) covers only the tether behind the drill and the drill-within-one-cell guard is about where the drill is now, not where it will land; once the drill's own cell is rock, free() is false everywhere, the snap at line 43

--- F11 [wrong-behaviour] real=True repro=True
TITLE: The same corner twice running: a bight that is reeled away leaves the tether hooked on a corner for good
MECH: When the tether passes a corner X, goes round a rock and comes back past X, the band holds X twice with opposite turns and the rock's bends between them. When the rock goes (a haul, a cut), retighten() calls caught(c, b, a) with a and c at the same point: the triangle has no area, catchIn returns null, the bend is spliced out, and X(+1), X(-1) are left side by side. Their turn test is 0, so retighten keeps both. tend() decides a release from the line pivot to P[2] (bx, by), which here has no length, so `then * pivot[2] < 0` is never true and the pair is never let go. tetherFaults() does not see it (zero turn), so rope-fuzz passes. In 43 minutes of random flight at reach 1350, 16 such pairs built up (4 after 8 minutes), each pinning the string to a point.
CMD: node test/hunt/modes/bight-left-on-corner.mjs   (census in free play: node test/hunt/modes/bends-census.mjs 22 4500 8 900 -300, about 1 minute)
FIX: In retighten(), after each splice (and once at the start), if P[n] and P[n+1] are the same corner (same b[4]) remove both when their turns are opposite, or one when they are equal, and step n back to re-examine the neighbours. Add the same check to tetherFaults() in test/harness.mjs so the fuzz catches it.
REACHABLE: Yes, in plain play from a fresh game with nothing staged and no upgrades. Random flight from the core (rope-fuzz style input, default levels) makes the pair whenever a haul or cut removes rock the tether was wound round while a corner nearer the core is still held.

- **Seed 12, fresh game:** at frame 11720 a haul's retighten turned `[d(-3.8,-2), nine bends round the piece, (2.5,2.5,-1), core]` into `[d, (2.5,2.5,+1), (2.5,2.5,-1), core]`. The pair stayed for 1353 frames (22 s). For 1168 of thos
NOTES: I could not refute this. The defect is in the game, not the test.

**What I ran (all from `C:/DEV/Tetherbore-hunt`)**

1. `node test/hunt/modes/bight-left-on-corner.mjs` gave exactly the reported output and exit 1. The band ends as `[[-4.3,6.5],[9.5,4.5,1],[9.5,4.5,-1],[0,0]]` and `tetherFaults` is `[]`. The geometry is valid: the wall at x>=10, y<=4 does block the core-to-rock line, so the first bend at X is legitimate. After the rock goes, both legs from X lie in the sector away from the wall, so a real string would slip off.
2. `node test/hunt/modes/bends-census.mjs 22 4500 8 900 -300` gave the reported last line: `sameCornerTwiceRunning` 16 at 43.3 minutes, 4 at 8.3 minutes.
3. `node test/hunt/verify/twice-play.mjs 1 12 1500 0 0` and `node test/hunt/verify/twice-trace.mjs 12 1500 0 0` (my scripts, plain play, nothing staged) gave the seed 12 result described under reachability.
4. `n

--- F12 [wrong-behaviour] real=True repro=True
TITLE: Moss (and ice, basalt) grows across the tether where it lies along a grid line
MECH: updateHazards() promises 'Ground never grows back across the tether' through lies(i), which marks the cells under the drawn line (lay()) and under the true line. A span between two bends on the same grid line lies exactly on a cell boundary: cellsAlong() floors it, so only the cells on one side are marked (ex, ey are 0 for an axis-aligned span, so the 1e-4 trim does not move it off the line). The drawn line helps only partly: when the two bends turn opposite ways it starts on one side and crosses to the other halfway along. In a shaft that steps sideways away from the middle of the span, the open cells beside the string on the unmarked side are left unprotected, the moss closes one, and the string is left running between two cells of rock. When the drill then swings, the corner it should catch no longer has an open side, so the span cuts through rock.
CMD: node test/hunt/modes/moss-on-line.mjs
FIX: In lies(), for the true line add the cells on both sides of a span that lies on a grid line: run cellsAlong twice, shifted by plus and minus a small amount (say 1e-3) across the span, instead of once on the line. Better still, refuse to close a cell if doing so would take the open side away from any corner a bend sits on, or would leave a span with rock on both sides.
REACHABLE: Yes, by ordinary steering, and more easily in frost than the report's moss case (no pod needed). Cut a one-cell-wide shaft, step one cell sideways somewhere past the middle of its length, carry on, then turn off so the tether has a bend at each end of the shaft on the same grid line, turning opposite ways. In frost every cut cell ices over after 30 s unless the tether lies in it, so simply waiting (or working elsewhere) seals the shaft across the string.

I reproduced it in unstaged ground: fres
NOTES: I tried to refute this and could not. The game is wrong, not the test.

**Reporter's script** (`node test/hunt/modes/moss-on-line.mjs`, exit 1): output matches the report exactly. Staging is sound: terrain set with setK/setB then `game.pieces = []; game.changed()`, and the route is flown with `input.auto`. The band `[drill, (-5.5,15.5), (-5.5,5.5), core]` is a legitimate taut string, 0 faults before the moss. After 8 s cell (-6,11) is moss, so the string runs between two ground cells at row 11. The final fault is a true pass through rock (0.09 cells inside, beyond tetherFaults' 0.04 edge allowance).

**Mechanism confirmed in code** (`js/game.js` 852-865, `js/world.js` cellsAlong):
- For a span on a grid line, `ex` or `ey` is 0, so cellsAlong floors onto the right/lower column only.
- lay() offsets the two opposite-turning bends to opposite sides, so the drawn line crosses the grid line a

--- F13 [wrong-behaviour] real=True repro=True
TITLE: retighten() looks at no more than 600 bends: beyond that, bends stay on corners that are gone or that the string no longer turns round
MECH: retighten() runs `for (guard = 0, n = 1; n < P.length - 1 && guard < 600; guard++)` from the drill's end; every bend it passes costs one count, and every splice costs more. With more than about 600 bends the far part of the band is never examined, on this call or any later one (each call starts again at n = 1), until the band shortens. The number of bends is not bounded: in random flight it grew to 813 in 61 game-minutes at reach 750 while the drill was never more than 750 cells out (tether 9255 cells long), and to 600 in 12.5 minutes at reach 2300 with dt 0.05.
CMD: node test/hunt/modes/guard-600.mjs   (compare: node test/hunt/modes/guard-600.mjs 280)
FIX: Make the bound depend on the band: `guard < 600 + 4 * P.length`, re-read as P changes. Cheaper and exact: pass retighten the cells that changed and visit only bends whose cell (b[3]) or whose neighbours' spans were touched, then walk outward from each splice until a bend is unchanged.
REACHABLE: Yes, in late-game play at the top reach levels, though the lasting fault is rare. It needs two things at once: (1) more than about 600 bends on the tether, and (2) ground going from under a bend that sits beyond what the 600 count covers from the drill's end. (1) is routine at reach level 9 (2300): in unstaged random flight the band was over 600 bends for 20,487 of 51,593 frames (seed 7, dt 0.05) and for 12,046 of 155,700 frames at 60 Hz; retighten ran out of its count thousands of times per run
NOTES: I could not refute it. The defect is in the game, not the test.

**What I ran (all from C:/DEV/Tetherbore-hunt)**

1. `node test/hunt/modes/guard-600.mjs` printed exactly what was reported: 660 bends, then after the cell under bends 659 and 660 is opened and changed([cell]) called, "faults: 2 ... on a corner that is gone", still 2 after five more changed() calls and 10 s of flying; exit 1. `node test/hunt/modes/guard-600.mjs 280` (560 bends) gave "faults: 0", exit 0.

2. `node test/hunt/modes/replay.mjs 7 1500 9 0 -2200 0.05 4 29800` printed the reported frame 29846: band 620 -> 513 points, bend 389 "should have been let go" (-98.000), after "haul of 16205 cells / retighten: 620 -> 513 points". No "caught() gave up" line, so it is not the too-large-triangle path.

3. My own script, C:/DEV/Tetherbore-hunt/test/hunt/verify/guard600-follow.mjs: same flight as replay.mjs, bend checks every f

--- F14 UNVERIFIED [wrong-behaviour] Arriving home with a wound band reels the outer rocks and leaves the one inside lassoed
MECH: look() learns of loose islands only once, on the frame the drill comes within 1.7 cells of the core, and only from the cells its bends lie on at that moment (pieceIn on P[n][3]). When the tether is round several islands and touches only the outer ones, those are found and hauled; changed() then retightens the string onto the island that was inside, but look() does not run again (d.home is already true) and reelIfRound() only knows this.pieces. The string stays closed round a loose rock, with the drill docked, until the drill leaves home and comes back. In the island-cavern fuzz this happened b
FIX: In look(), repeat the search while it hauls something: after reelIfRound() has reeled a piece and the band still has bends, run the pieceIn pass again on the new bends (loop until no new piece is found). More generally, run that pass whenever retighten() adds a bend on a cell not in looseSet while the drill is home.

--- F15 UNVERIFIED [wrong-behaviour] Where the browser's database cannot be opened, a reload throws away everything bought and banked
MECH: save() writes S (grit, gems, upgrade levels, seed) to localStorage and the ground to IndexedDB, and its comment says the game goes on without saving ground when the database fails. restore() reads localStorage, then awaits store() before it assigns this.S; when indexedDB.open errors, the await rejects, the outer catch returns false, and S is never taken. js/main.js then carries on with the new random game the constructor made, and that game's first save() (every 20 s, on pagehide, on docking) overwrites the old save. test/harness.mjs stands in for exactly this case ('opening one fails ... as i
FIX: In restore(), take S from localStorage first and treat a database failure as 'no ground saved': wrap only the store()/cursor part in its own try/catch that yields rows = [], then set this.S, world.reset(S.seed), begin() and return true. The world regenerates from the seed; only the cuts are lost.

--- F16 UNVERIFIED [wrong-behaviour] A reload forgets which pieces are loose: lassoing one afterwards reels nothing in
MECH: restore() brings back the ground and calls begin(), which sets this.pieces = [] and calls changed([C * N + C + 3]). The list of loose pieces is not saved and nothing finds them again: freed() only reports a piece when the touched cell has ground on two sides that proves to be separate (a single flood is taken for the rest of the world), so that changed() call finds nothing, not even the starter piece (a fresh game has pieces.length 0). reelIfRound() only tests this.pieces, so a piece cut loose before the reload is not reeled when the tether goes round it; it is picked up only when the drill ne
FIX: Find islands where the tether meets them instead of relying on a remembered list: when tend() or retighten() adds a bend on a cell that is not in looseSet, run a small bounded pieceIn (a few thousand cells, in a box round the band) and add what it returns to this.pieces. That also covers natural islands in caverns and makes the dead changed([C * N + C + 3]) in begin() unnecessary. Otherwise save the pieces' seed cells with S and re-flood them in restore().

--- F17 UNVERIFIED [wrong-behaviour] Over the 400000-cell budget, retighten() keeps a bend whose rock is gone, and the search itself takes over 100 ms
MECH: catchIn() returns undefined once it has looked at 400000 cells; caught() passes that on; retighten() does `if (!got) { n++; continue; }`, so the bend stays where it was, on a corner that no longer exists, and every later call hits the budget again. (In tend() the same result means no catch and, on a lift, a bend dropped with nothing caught; I could not reach the budget there: a throw at reach 2300 with dt 0.05 sweeps at most about 250000 cells.) The triangle in retighten is the two spans either side of the bend, so it needs spans of roughly 900 cells at a right angle: reach 1350 or 2300 only, 
FIX: In caught(), when catchIn returns undefined, split the move: sweep from cur to the midpoint of cur and to, then on to `to` (recursively), so each triangle is under the budget; the bends come out the same. To cut the cost, walk only the rock cells near the two long edges first, or keep a per-chunk 'all rock / all open' flag so whole 64 x 64 pieces are skipped.

--- F18 UNVERIFIED [performance] Frames of 100 to 200 ms far out: reelIfRound tests every loose cell against every bend, and freed() makes new world mid-flood
MECH: Measured per part of game.update() over random flight (soak.mjs). tend() itself is cheap at any length: mean 0.002 to 0.005 ms, worst 4.3 ms with 900 bends. What goes over 8 ms: (1) reelIfRound(): `pieces.filter(cells => cells.every(winds))` is loose cells x band points, run every 0.1 s and on every changed(). With one large piece cut but not yet lassoed (32785 loose cells) and 520 to 620 bends it costs about 38 ms a call, up to three calls a frame: frames of 110 to 130 ms, mean 5.4 ms over 10000 frames, 3471 of 51593 frames over 8 ms (reach 2300, dt 0.05). At 60 Hz and reach 750 the worst fra
FIX: reelIfRound: the tether cannot pass through a piece, so every cell of a piece has the same winding about the band itself; only the straight closing line from core to drill can split it. Test one cell per piece against the band (points only), then check whether the closing line crosses the piece (cellsAlong on that one segment against looseSet) and fall back to per-cell tests only for pieces it crosses; skip pieces whose bounding box misses the band's. freed(): do not make new world inside a floo

--- F19 UNVERIFIED [performance] Docking with many bends freezes the frame: look() floods the ground once for every bend
MECH: On the frame the drill comes home, look() calls world.pieceIn(P[n][3], box of the whole band, 400000) for every bend whose cell is not already known loose. Each call builds its own Set and floods until it leaves the band's bounding box or reaches 400000 cells. For bends on the main body of ground (most of them) the flood fails only after covering much of the box, and nothing is remembered between bends, so the same ground is flooded again for each. The cost grows with bends x box area; at reach 1350 after a long flight it was 178 ms for 100 floods, and it will be longer on a phone and at reach
FIX: Share one `seen` set across the bends of a single look(): a bend whose cell was already reached by an earlier flood (failed or not) is skipped, so each body of ground is flooded once. Bound each flood by the box of the loop it could belong to rather than the whole band, and stop early when the flood touches a cell known to be held.

===== LENS lasso =====
TRIED: Read game.js (tether, changed, reelIfRound, look, haul, updateHauls, hazards, blast) and world.js (freed, pieceIn), then wrote staged and driven scripts under C:/DEV/Tetherbore-hunt/test/hunt/lasso/ (shared helpers in lib.mjs): the untouched world's first piece, ring cuts finished by bit and by bomb, stems cut beside a spore pod, frost regrowth, pieces of 5,000 to 62,500 cells (timed), wrecks on real seeds near and far, every kind x biome through a real lasso with render() each frame, a two-haul accounting check, and a random-flight fuzz (fuzz.mjs, 14 seeds x ~10,000 frames) asserting that reg

--- F20 [wrong-behaviour] real=True repro=True
TITLE: After a haul the tether is left running out to a far corner and straight back (same corner twice in the band), permanently; later rubble is drawn along it
MECH: When haul() removes the lassoed ground, changed() -> retighten() drops the bends on the removed cells and the loop collapses onto the surviving corners of its two legs. Where both legs turned round the same mainland corner, the band is left as [..., A(turn 1), A(turn -1), ...] (or a longer doubled run A,B,C,C,B,A). retighten() keeps a bend when `turn * b[2] >= 0`; with the neighbour at the identical point `b - c` is (0,0), so turn is exactly 0 and both copies are kept. tend()'s lift test has the same zero (`bx = by = 0` so now = then = 0), so the pair is never let go while the drill flies about. tetherFaults() does not see it either (zero turn). Consequences: the string is drawn out along a corridor and back with nothing to go round (owner's rule: never stuck on a corner it no longer turns round); haul() takes its route from lay(), so the next haul's rubble is drawn out along the spur and back; and look() re-floods from every leftover bend on each homecoming (next finding). It happens whenever a loop is hauled while the drill is away from it: always on the homecoming haul of a natural island or wreck, and in ordinary random play (fuzz seeds 2, 7, 9, 10, 11, 12, 13, 14 of 14, each at the frame of a haul with the drill away from the core).
CMD: node test/hunt/lasso/hairpin.mjs   (consequence for the next haul: node test/hunt/lasso/hairpin-haul.mjs ; in random play: node test/hunt/lasso/fuzz.mjs 7 300)
FIX: In retighten(), let go of a bend the string doubles straight back at: before the keep test, if b and c are the same point (b[0] === c[0] && b[1] === c[1]) splice both out and step back (`P.splice(n, 2); n = Math.max(1, n - 1); continue;`); more generally keep a bend with turn === 0 only when a and c lie on opposite sides of b (dot((a-b),(c-b)) < 0). Apply the same rule in tend() (a pivot whose next point is the same place is lifted). Add the same-corner-twice check to tetherFaults so the rope fuzz catches it.
REACHABLE: Yes, in ordinary play once the tether has been upgraded; no staging is needed. I ran the stock rope-fuzz driver on the game's own generated worlds with nothing set by hand (C:/DEV/Tetherbore-hunt/test/hunt/verify/natural-fuzz.mjs). At tether level 5 the doubled corner appeared in 8 of 12 seeds (1, 2, 3, 4, 6, 9, 10, 11), and at tether level 2 in 4 of 6 seeds (2, 3, 4, 5). Every time it began on the exact frame of a haul with the drill away from the core, and tetherFaults() reported nothing. In 6
NOTES: **Reporter's commands, re-run from C:/DEV/Tetherbore-hunt**
- `node test/hunt/lasso/hairpin.mjs` exits 1 with the reported output: after the haul the band is [[0,0],[-11.5,0.5],[-11.5,0.5],[0,0]], and after flying 14 cells east it is still [[14.15,0],[-11.5,0.5],[-11.5,0.5],[0,0]] (length 37.17 against 14.15 straight).
- `node test/hunt/lasso/hairpin-haul.mjs` exits 1: the control route is 23.8 cells with rubble no further west than 0.3; after the hairpin the route is 47.2 cells and rubble goes to x = -11.4.
- `node test/hunt/lasso/fuzz.mjs 7 300` prints the frame-998 doubled corner, counted on 8,925 frames.

**Is the test at fault? No.**
- Staging is sound: terrain is set with setK and then `game.changed()`, and the island is picked up by look()'s own homecoming scan (pieceIn), which is the path meant for natural islands.
- My step trace (`node test/hunt/verify/hairpin-trace.mjs`) shows

--- F21 [performance] real=True repro=True
TITLE: Coming home with bends on the tether freezes the game: look() floods the mainland from every bend (1.2 s frame after a far wreck, and again on every later homecoming)
MECH: look(), on the frame the drill comes within 1.7 cells of the core with P.length > 2, calls world.pieceIn(P[n][3], band bounding box, 400000) for every bend whose cell is not registered loose. For a bend on held ground the flood only stops when it leaves the band's bounding box or reaches 400,000 cells, and nothing is shared between bends, so the cost is (bends) x (up to 400,000 cells, each with a Set insert and world.k, generating chunks). A tunnel to a far wreck has many corners and each appears twice (out and back). Because of the hairpin defect above, those bends are never let go after the haul, so the same floods run again every time the drill next comes home.
CMD: node test/hunt/lasso/far-wreck.mjs 7 7 60
FIX: In look(), share one `seen` set across the bends of a call: a cell reached by an earlier flood that failed belongs to held ground, so skip it and stop any flood that touches such a cell. Bound each flood by the area the loop can enclose (shoelace area of the band) instead of a flat 400,000, and skip the search when the band is unchanged since the last homecoming. Fixing the hairpin removes the repeats.
REACHABLE: Yes, in ordinary late-game play, with no staging at all. Wrecks are a designed goal (WRECK_R = 45..1700 cells out; REACH levels 8 and 9 are 1350 and 2300), a wreck's hull is never registered loose by a cut (it sits in a hollow of its own), so the only way it is taken is the one look() exists for: fly round it and come home with the tether still round it. On that homecoming the band holds every corner of the tunnel twice (out and back). I drove this with the game's own input only: steer straight 
NOTES: Ran the reporter's command unchanged: `node test/hunt/lasso/far-wreck.mjs 7 7 60` -> worstHomecomingFrameMs 1222, pieceInCalls 145, msInsidePieceIn 1220, later hops 837/921/1047 ms with 140 calls each; `... 7 5 60` -> 110 ms, 68 calls. Matches the report. The script's staging is sound (rect via setK then game.changed(); timing wraps game.update only; pieceIn is wrapped, not altered), and the check is not mistaken: the whole frame is inside pieceIn.

To rule out staging as the cause I wrote C:/DEV/Tetherbore-hunt/test/hunt/verify/dig-wreck.mjs (no setK anywhere; real cutting by steering; args: seed, wreck, tether level). Output:
- `node test/hunt/verify/dig-wreck.mjs 7 7 9`: bendsNearHome 405, worstHomecomingFrameMs 3798, pieceInCalls 391, msInsidePieceIn 3795, slowestPieceInMs 65, part 1, bendsAfter 403; worst frame on the rest of the trip 29 ms out, 2 ms back.
- `... 3 7 9`: bendsNearHo

--- F22 [wrong-behaviour] real=True repro=True
TITLE: The first loose piece beside the core is never registered: it does not glow as loose and is not reeled in when the tether goes right round it
MECH: begin() registers the tutorial piece with `this.changed([C * N + C + 3])`, which calls world.freed() on the open moat cell (3,0). That cell has exactly one solid neighbour, (4,0), so freed() starts one flood, and its first test `going.size === 1 && all.size === 1` breaks at once: a single flood is taken to be 'the rest of the world', so nothing is returned. game.pieces and game.loose are empty in a fresh game, so the dotted crawling edge for loose ground (render, `if (this.loose.length)`) is not drawn on it and reelIfRound() returns at `!this.pieces.length`. The piece is only found by look()'s pieceIn search when the drill comes within 1.7 cells of the core with the tether still round it. Cutting a cell of it does not register it either (both neighbours merge into one flood).
CMD: node test/hunt/lasso/first-piece.mjs
FIX: In begin(), register it directly: `const first = w.pieceIn(C * N + C + 4, C + 3, C - 2, C + 6, C + 1, 16); if (first) { this.pieces.push(first); ... }` before the changed() call. Better, fix freed() as in the next finding so a lone flood that runs out within a small budget is returned as an island.
REACHABLE: Yes, in every new game from the first frame, with no staging. The tutorial piece (cells (4,-1),(5,-1),(4,0),(5,0) relative to the core) comes from world.kindAt, and begin() runs on both fresh() and restore(). On seeds 1, 7, 123 and 99991 the piece is an island yet game.pieces and game.loose are empty at the start. A player who flies one plain loop round it (the moat is 3 or more cells from the core, outside the 1.7-cell "home" radius) sees no haul until the drill is back within 1.7 cells of the 
NOTES: I could not refute it; the defect is in the game, not the test.

**What I ran**
- `node test/hunt/lasso/first-piece.mjs` (from C:/DEV/Tetherbore-hunt) gave exactly the reported output and exit 1. The script stages no terrain: it only flies the drill in an untouched world via makeGame(7), so there is no missing changed() or impossible state. Its winding check is a copy of reelIfRound's own.
- My own variation, `node test/hunt/verify/first-piece-check.mjs` (C:/DEV/Tetherbore-hunt/test/hunt/verify/first-piece-check.mjs), printed:
  - seeds 1, 7, 123, 99991: `pieceIsAnIsland: true, pieces: 0, loose: 0`
  - game as it is, one loop (3,-2) -> (6,-2) -> (6,1) -> (3,1) -> home: `hauledAt: frame 86, drill [1.61,0.53], fromCore 1.69, atCore true` (the same frame it came home)
  - same seed and steering, piece pushed into game.pieces by hand first: `hauledAt: frame 56, drill [6.05,0.48], fromCore 6.

--- F23 [wrong-behaviour] real=True repro=True
TITLE: Ground cut loose by a bomb, or by a cut whose neighbouring spore pod bursts, is never registered: the tether goes right round it and nothing is reeled in
MECH: world.freed(i) assumes exactly one cell was opened: floods start from i's own solid neighbours only, and when there is one flood (or they have all met) it stops at once on `going.size === 1 && all.size === 1` and reports nothing. blast() opens up to 8 (or 24) cells and changed(opened) calls freed() once per cell: each opened cell touches only one side of the gap (or nothing), so no call ever sees the loose side and the held side as two floods. The same happens in finishDig(): trigger() opens a neighbouring HAZARD (mire pod, ember pocket) with setK before changed([i]) is called with only i; when i's remaining solid neighbours are all on the loose side there is again one flood. updateHazards() likewise calls changed() with no cells after trigger(). The piece is loose and fully wound but is not in game.pieces, so reelIfRound() never sees it; only look()'s search at the core finds it later.
CMD: node test/hunt/lasso/bomb-ring.mjs   (pod variant: node test/hunt/lasso/pod-neck.mjs)
FIX: Give freed() the whole set of cells opened together: mark them all as open (owner -1) and seed one flood per solid neighbour of any of them, so the loose side and the held side compete in one run. Have finishDig() and updateHazards() pass the cells trigger() opened (return them from trigger) along with i. Keep the single-flood shortcut only when one cell was opened.
REACHABLE: Yes. Bomb case: buy the BLAST upgrade, dig a trench round a block leaving a one-cell neck, park beside the neck and bomb. The 3x3 blast opens the neck and the cells either side of it, so no opened cell touches both the block and the held ground, and nothing is registered. I reproduced this with the drill digging the tunnel and the whole ring itself from a plain slab of soft ground (no staged trench), so it is not a staging artefact. More generally, a radius-1 blast can only register a piece when
NOTES: The defect is real, but the title overstates it: the block is reeled once the drill gets home with the tether still round it, not never.

**Reporter's commands** (run from C:/DEV/Tetherbore-hunt)
- `node test/hunt/lasso/bomb-ring.mjs` exits 1 with the reported output: cut gives hauls 1; bomb gives blockIsLoose true, registeredPieces 0, hauls 0, 22 cells still there, 6 bends round the block, no tether faults.
- `node test/hunt/lasso/pod-neck.mjs` exits 1 with the reported output: no pod gives hauls 1; pod gives blockIsLoose true, registeredPieces 0, hauls 0, 18 cells left.
- The staging is sound: `setK` is followed by `game.changed()`, and the block really is loose by a 4-neighbour check.

**My variations**
- `node test/hunt/verify/bomb-dug.mjs` (C:/DEV/Tetherbore-hunt/test/hunt/verify/bomb-dug.mjs): the drill digs everything itself.
  - cut: `haulsRound 1`.
  - bomb: `openedByBomb 4, blo

--- F24 UNVERIFIED [wrong-behaviour] Ground that freezes back is ignored by the loose-piece registry: a piece frozen back on to the roof is still hauled, and cutting it free again registers and pays it twice
MECH: changed() only ever shrinks or splits registered pieces (cells that became EMPTY). When updateHazards() regrows ground (ICE over a cut after 30 s; by reading, BASALT from set lava and moss take the same `if (moved) this.changed()` path) nothing checks whether a registered piece is still cut off. (a) A piece joined to held ground by ice stays in game.pieces, keeps its loose marking, and reelIfRound() hauls it as soon as the band plus the straight line home winds round its cells, leaving the ice hanging. (b) When the ice is cut again, freed() returns the island including the ice cell stuck to it
FIX: In changed(), after rebuilding the registry, check each registered piece for a solid 4-neighbour outside itself; if it has one, flood the whole of what it now belongs to (bounded): replace the entry with the grown island if that is still cut off, or drop it if it reaches held ground. When adding a freed piece, remove any registered pieces sharing a cell with it (test every cell, not only cells[0]) before pushing. As a guard, haul() should take `[...new Set(cells)]`.

--- F25 UNVERIFIED [wrong-behaviour] A wreck with slate only at its corners is not hauled when the tether comes home round it: only the slate goes, and the part needs a second trip out of the core and back
MECH: A wreck stands in its hollow as natural loose ground, so it is only registered by look() on the frame the drill comes home, and look() only floods from cells that carry a bend (`pieceIn(P[n][3], ...)`). Slate bits diagonal to the wreck are separate one-cell pieces and take all the bends (the wreck's own corners lie inside or exactly on the line between them), so the wreck cell is never flooded and never registered. reelIfRound() hauls the slate; retighten() then puts the bends on the wreck itself, but look()'s search runs only on the `home && !d.home` edge, which has passed. The part is hauled
FIX: In look(), repeat the bend search after reelIfRound() has hauled something (the band has new bends) until a pass registers nothing new; or register every piece of ground lying inside the closed band rather than only those a bend sits on. Better still, run the search when retighten() adds bends, not only on the homecoming edge.

--- F26 UNVERIFIED [visual] Buying while rubble is still on its way shows a negative amount of grit in the top bar
MECH: haul() adds the whole payment to S.grit at once and holds it back from the display in pending.grit; drawHud() shows `compact(S.grit - this.pending.grit)`. canBuy()/buy() test and spend S.grit, which includes the part still pending, and update() does not run updateHauls() while the shop is open, so pending stays where it was. On the very first haul (18 grit, 4 cells from the core) the drill is home before the rubble; buying the first level of reach (15) leaves S.grit 3 with 18 pending, so the bar shows 3 - 18.
FIX: Keep hauls running while the shop is open (call updateHauls(dt) outside the `if (!this.shop)` block) and have canBuy() compare the price with banked grit and gems (S.grit - pending.grit, S.gems - pending.gems); or, if spending unbanked grit is intended, have buy() reduce pending by the amount it overdraws and clamp what the bar shows at zero.

--- F27 UNVERIFIED [wrong-behaviour] A ring-cut piece well under freed()'s limit of 120,000 cells is not reeled in where it is cut: the real cap is 60,000, or 40,000 when the last cut has held ground on two sides
MECH: changed() calls `w.freed(i, 120000)` with the comment 'cut a piece off, of any size', and freed()'s own comment says each piece is followed 'until it proves larger than `limit` cells'. But `spent` counts cells taken by all floods together, one from each flood per round, and `if (spent > limit)` then holds everything. With the loose piece and the mainland as two floods the piece must be under limit / 2; when the cut cell has held ground on two sides (two mainland floods that keep running after they meet) it must be under limit / 3. The piece is then not registered although the tether is right r
FIX: In freed(), measure each flood by its own size: keep a cell count per root (summed on union) and hold a root only when its own count passes `limit`; stop the round-robin when every root still going has passed it. That makes the cap the documented one whatever the shape of the last cut.

===== SECOND PASS: what three verifiers found in the fixes, and what was done =====
Each line: the finding, then the outcome. Tests named are in test/regress and run by test/all.mjs.

V1 [performance] One cut could freeze the game 0.24 to 0.36 s in World.freed (both sides of a cut flooded, each to 120,000 cells, making unseen world as they went).
DONE: freed settles what is loose by outlines alone and follows only an island's own ground. The hunters' soak: worst frame 279 ms to 22 ms (a colossal haul), frames over 8 ms 1,410 to 16. A loop closed round 400 x 400: 359 ms to 19 ms. Test: g-loop-cut (work counted: sides, cells followed, pieces of world made).

V2, V11 [performance] Letting go of a bend with two legs of 900 to 1,000 cells took 80 ms or more (F17's cost).
DONE: a sweep's first part is 4,000 cells and doubles while it meets nothing; rows are read straight from the world's pieces; the world is made in half the time. budget-400000: 78 ms to 2 ms; big-triangle 212 to 2; far-haul 214 to 13; big-triangle-played 313 to 15. Test: c-budget-400000 counts the cells swept. A sweep across ground that is truly open, the size of the whole triangle, still costs its area.

V3 [performance] New with F24: ground growing back against a loose piece flooded up to every loose cell in the books of the mainland (29 to 62 ms).
DONE: what the grown cell belongs to is followed from that cell, through loose ground and what grew; held ground is known at the first step. Test: g-regrow.

V4 [wrong behaviour, old] A drag held on an exact diagonal into a notch of two cells cut neither, for as long as it was held.
DONE: a cut in progress goes on while the drill is pressed into that cell and the stick is within 20 degrees of where it was when the cut began; a new direction still cancels it. Test: i-diagonal-notch.

V5 [wrong behaviour, old] The drill could be left beyond the end of its reach and then neither move nor cut: stuck for good.
DONE: a move that takes the drill no further out stands when the place on the reach is shut; set free of ground that closed on it, it stands as near its reach as it fits; squaring up to a cut never carries it out. Test: i-reach-pin, i-fuzz-play 60 and 50.
LEFT: hemmed in by lava at the very end of its reach the drill still waits for the lava to drain or set (14 s in the longest flight seen), because lava is shut to it and the ways out are beyond the reach. That is the hazard as designed; i-fuzz-play counts it (`hemmedByLava`) and does not fail on it.

V6 [not fixed: item F] An island the books did not know was not reeled when the tether was right round it without touching it.
DONE: the ground the straight line home passes over is looked at (the string never passes over ground; only that line does), with ground that comes into view and ground that grows, and an island among it is known from then on. The verifiers' plain batch: 45 of 62 flights with such an island, now none; main, core and pillars batches likewise. Test: f-unseen-island, i-fuzz-play 45 and 33.
LEFT: an island whose outline is longer than 600 sides is still learnt of only from a cut, a bend lying on it, or the homecoming; and ground the world has not yet made is not looked at.

V7 [performance] The frame in which a very large piece is cut loose ran over 16 ms (26 ms for 31,931 cells, 84 ms for 115,600).
DONE by V1's change: 32,400 cells 23 ms to 3 ms; 115,600 cells 84 ms to 11 ms; the natural flight has no frame over 8 ms. Not spread over frames: a piece near the 120,000 limit in natural ground still makes its own unseen ground in that one frame.

V8 [visual, old] A thrown drill's body passes through rock beside the line of the throw.
NOT CHANGED: real (up to five frames, a third of a cell). The only fix that keeps the angle shortens the throw to where the body first touches, which down a tunnel one cell wide is three or four cells unless the drag is within a degree of straight; bending the throw to fit would steer the drill. Left for the owner to choose.

V9 [performance] New with B's fix: tend() after every small move made fast straight flight far out cost 12 to 35 times the tether work.
DONE: small moves that go straight on are led as one. 63,905 cell lookups a frame to 156. Test: b-straight-run.

V10 [visual] The shop drew a price as affordable while buy() refused it.
DONE: lit by what has come home, as the purchase is judged. Test: h-shop-price.

V12 [wrong behaviour, latent] World.freed missed an island when the opened cell faced only a hollow inside it.
DONE: such ground is followed a little way (4,000 cells) and is an island if it runs out. freed agrees with a plain flood on 48,000 random trials. Test: f-freed-diff.

V13 [the tests] tetherFaults sampled a span at 4,000 points at the most and stepped over rock on a long span.
DONE: every cell a span crosses is asked about exactly. Test: a-harness-long-span.

Found on the way, by the verifiers' fuzz run on the reworked game: a drill at rest creeps by a hundred-millionth of a cell, and such a move could hook the string on a corner half a cell beyond its end (seed 57, reach 9). A corner further from the pivot than the string reaches is never caught now. Test: a-micro-move, i-fuzz-play 57.
