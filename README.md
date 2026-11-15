# Tetherbore

A one-thumb mining game for the phone browser. A core sits fixed at the centre of a vast world and your drill flies from it on a tether. Draw the tether round a piece of ground and the core reels the whole piece in.

Every sprite, tile set and effect is made with [Pixelbolt](https://github.com/skulitom/Pixelbolt).

## How it plays

- **Press anywhere and drag** to fly. The drill goes the way the thumb has moved, at any angle, faster the further you drag, and faster still over a long clear run. Pushed into ground, it cuts. From the very middle of the core a fresh stroke throws it straight out along the drag. Arrow keys or WASD work on a desktop.
- **The tether is a lasso.** It is a string from the drill to the core that runs straight and bends only where it is pulled round a corner. Once it has gone far enough round a loose piece of ground that the straight way home would close the loop, the piece is reeled in along the tether and paid out at the core.
- **Only hauls pay.** Drilling through ore crushes it; cut round it and lasso it instead. The bigger the piece, the bigger the multiplier, and the further out the ground lies, the richer it is. Ground that the cut in progress would free glows, and loose ground waiting for the tether wears a crawling blue edge.
- **Reach, not length.** The tether lets the drill go a set distance from the core, by any road, shown as a dotted ring. Each reach upgrade nearly doubles it: 12 cells at first, 2,300 at the last. Close to the core and heading in, the tether reels the drill home.
- **Nothing is too hard to cut.** Dense rock, slate and the ancient stone only take longer, cracking as they go, and a better bit cuts everything faster.
- **Home ground, then four directions.** Plain ground runs about 130 cells out from the core. Beyond it, north is ice, where cuts freeze over; south is basalt with lava pockets that pour into your tunnels; west is cave-ridden mire with spore pods; east is sandstone ribbed with slate and charged crystals. Far out, the flanks of each direction turn richer and meaner. Hazards wake when you cut beside them; lassoed asleep, they pay.
- **Each direction has a rule of its own**, in all of its grounds. South: every pocket of lava lies in a rind of dull slag, and lava that wakes turns the slag it touches to steel, worth twice what the lava was: haul a pocket asleep, or wake it and take the flood for more. East: crystals stud the flanks of the slate, an arc shatters the slate beside its crystal and sets off the crystals near it, so one nick, and a moment to pull back, unzips a rib and lets go what it held; shattered slate is crushed. North: a cut that freezes over beside ore heals as ore, not ice.
- **Each direction has strains.** From a couple of hundred cells out a direction's ground lies in provinces about 256 cells across, and two in three are one of its two strains, each with a shape of its own. North: firn, massive ice crossed by frozen rivers that are quick roads, where a cut stays open longer; serac, shattered by a mesh of lanes of ice, where a cut closes fast. South: scoria, full of bubbles, with less lava; forge, clinker with more lava that pours further, in a thicker rind of slag. West: tangle, great open caves with bridges between; sporefall, where pods hang in bunches and one nick sets off the whole bunch. East: redrock, its slate in long level beds studded with crystals; loess, pale silt that cuts in half the time and holds little ore. A strain pays its direction's gems.
- **Further out, grounds cross.** From 500 cells out some provinces are a cross of two directions: the ground of the direction it lies in, with another direction's rich ore in it and that direction's trait, thinner than at home (the south's lava in its slag, the west's pods, the east's crystals, or the north's ice closing every cut), and sometimes one shape borrowed from a strain: great caves (HOLLOW), lanes of ice (CRAZED), bubbles (FROTHY) or level beds of slate (BANDED). Thaw is ice with lava in it, quench basalt whose cuts freeze over, mouldstone sandstone with pods among its crystals. There are twelve pairs, each with a name and a look of its own, and they are never more than about a third of the provinces: the rest of the world is made by hand. A cross pays a quarter more than its direction's own ground, in both directions' gems, and its plate shows both.
- **Something is sealed** in ancient stone 2,000 cells out in each direction. Bring all four home.
- **Things to find.** Geodes (a shell of slate round rich ore), caches buried in stone, and eight wrecks, each in a hollow of its own further out than the last. A cache pays a lump; each wreck gives up a part that makes every haul pay a tenth more, and wrecks within reach blink on the map. All of them only pay hauled, not drilled.
- **Places have names.** Coming into another ground, its name comes up: across the screen the first time it is ever met, on a small plate under the top bar after that. What is worth going for is called out by name the first time it comes into view (a cache, a geode, a wreck, a relic), with a ring round it and a dot on the map that stays until it is taken. A wreck nobody has claimed ticks when the drill is near, quicker the nearer. Names are all that is ever said.
- **Small hauls do not stop the flight.** A piece of fewer than 12 cells is reeled in with no banner, flash or beat of stillness: what it paid rises from where it lay.
- **The bomb shakes ore loose.** BLAST racks a charge on the drill, four at the last level, and the rack is filled again at the core. A charge blows the plain rock out of a room round the drill, five cells across at first and nine at the last level, and wakes nothing: ore, slate, slag and steel, caches and hazards asleep stand where they stood, each with two cells of room round it, loose and wearing the blue edge, to be flown round and reeled in. A lump that runs out of the room is shaken loose with it if it ends within two cells. A tap that cannot blast says why.
- **Keystone slabs.** Here and there a great disc of ground is already cut round by a natural crack and held to the world by two or three keystones of iron set across it. Cut through the keys, fly one lap of the crack, and the whole disc comes home in one haul: a few hundred cells, which is what the winch is for (a piece over its load is paid less, and the banner says so). The last key's glow lights the whole slab. One slab lies 52 cells from the core in every world, and is a ring on the map from the start. A **cobble field** is the same ground cut into blocks four cells square by open joints, each block held to the next by one key: fly round as many blocks as you like, in the joints, and they come home.
- **A prism** is a clear crystal in a ring of plain ore, from 130 cells out. It pays nothing itself: every prism in a haul makes that haul's gems half as much again, up to three.
- **The map**, bottom right, shows everything within reach. **Upgrades** are bought on the core, and each one changes how the drill, the tether or the station looks. **NEW**, top right, starts a fresh world (tap twice).

Progress is saved on the device: what you own in local storage, the ground in the browser's database. There is no server and no account.

## How it is built

The world is about 4,800 cells across, far too large to hold whole. `js/world.js` makes it a 64 x 64 piece at a time, from the seed alone, the first time anything looks there, and only pieces that have been seen or changed are kept and saved. `js/game.js` is the game: flight, the tether, hauling, hazards, drawing.

What a cell can be and whose ground it lies in are two tables in `js/world.js`: `K`, the kinds, and `BIOMES`, a row for each ground. The numbers are what a saved game stores, so they never move. Everything that differs from one ground to another (its sheets, its dark and its motes, what a haul of it pays, the thresholds it is laid by, its hazards, whether a cut in it freezes over) is in its row, and the game reads the row wherever it needs to know; a hazard does, pays and looks as its type does (lava, spore, spark), whatever ground it lies in. A new ground is a new row.

Whose ground a cell is, `World.biomeAt` settles by asking in a fixed order: the home ground, which direction, a deep flank, then the province the cell lies in (`World.province`: by the province's own hash, a generated cross, a strain of the direction or the direction's own ground), and it leaves places in that order for pockets and seams. A strain is a row made from its direction's row with a few figures changed, and its tell is an extra the row names (`TELLS`: rivers, lanes, bubbles, grapes, strata), which `kindAt` lays at its place among the standard ground. What goes with a hazard goes wherever that hazard is laid, as a ground's first hazard or its second, by a figure of `HAZARDS` that a row may give for itself: with lava its rind of slag (`rind`), with charged crystals the crystals on the flanks of slate (`ribs`). `World.biomeKnown` is whose ground a cell is as far as is known (what a made piece holds, the seed elsewhere), which is what the map shows. What a sector of finds holds is one hash with its whole range allotted in `FINDS`.

Everything above is made by hand; one rule makes the rest out of it. `crossRow(host, donor, structure)` builds sixty rows at load, at numbers that never move (128 to 187): the host direction's row (its thresholds, floor, dark, motes, plain ore and own hazard), the donor's rich ore (`gemB`, drawn from the donor's sheet: `itemsB`) and the donor's trait at six tenths (its hazard as the row's second, or the north's freeze), and one structure, which is a strain's tell (`TELLS`) or tangle's caves. Nothing in the game knows a cross from any other ground: it reads the row. What is hand-made of each pair is its sheet of rock (`art/tiles.mjs`: `cross`, built with the art, never tinted at run time), its name, its colours, and the eye's verdict in `CROSS_OK`; a pair switched off there gives its provinces back to the host's own ground. The share of provinces that are crosses rises from none at `CROSS_FROM` (500 cells out) to `CROSS_MOST` (0.35), and no deep flank or home ground is ever one.

A keystone slab lies in whatever ground is there. `World.slabIn(sx, sy)` says what slab a sector of 144 cells holds, once, and keeps the answer; `World.slabCell` says what a slab makes of a cell (open crack or joint, key, its own ground, its collar), and `kindAt` lays the slab's ground and its collar as the ground of the place with no caves in it, since a cave would split the slab into parts no key holds. A slab is laid only where it is sound: its keys join it to the collar, its crack goes right round, and the ground beyond the collar runs on (`World.slab`). The keys' ways are worked out with no sine (`heading`). `World.meetsPocket` is the one test that will keep slabs out of pockets.

What a haul pays is worked out in one place, `Game.payOf(cells, extra)`, which changes nothing: the haul asks it and does as it says, and anything that shows a worth beforehand asks the same function. What a cut would free is asked of `World.freed(cells, limit, open)` with everything else the cut would open taken as open too (`Game.foresee(i, also)`).

## Running it

It is a static site: serve the folder with any web server and open `index.html`.

```bash
python -m http.server 4791
```

## Testing it

```bash
node test/all.mjs
```

The game runs with no browser under `test/harness.mjs`. `test/all.mjs` runs every script in `test/regress/` (each fails while the defect it was written for is there), `test/smoke.mjs`, which plays every direction unattended, and the tether fuzz `test/rope-fuzz.mjs`: about two minutes, one line a test. Among the regress scripts, `i-fuzz-play.mjs` plays the whole game at random (throws, bombs, the shop) and checks the tether, the books of loose ground, the hauls and the money after every frame. Tests of speed count work, not time: `game.swept` (cells the tether's sweeps look at) and the world's `sides`, `followed` and `made` (outline sides walked, cells followed, pieces of world made). `test/frame-time.mjs` times a frame over the fuzz's flight. `test/slab-moat.mjs` looks at keystone slabs as they lie in the cells of 200 worlds: each has a crack a drill can fly right round, hangs by its keys alone, and is held by the world. The world a seed makes must stay the world it made: `w-same-world.mjs` compares it cell for cell with a plain reading of the ground (the first one, with what has been laid on purpose since written into it as plainly), and `s1-world-hash.mjs` holds 96 pieces of it to the hashes in `test/world-hash.txt` (`node tools/world-hash.mjs --check` names the pieces that moved; `--write` records them again, for a change that lays new ground on purpose). Three of the regress scripts are about the tools below: `t-shot-stage.mjs` runs `js/main.js` on a stand-in page, with and without `?shot`, `t-shot-tool.mjs` takes real pictures where a browser is installed, and `t-field.mjs` checks a map against the world.

## Looking at it

```bash
node tools/shot.mjs out.png --at 0,-300
node tools/shot.mjs out.png --at 0,-300 --size 1200x1200 --zoom 8 --lit
node tools/field.mjs map.png --at 0,-300 --size 800
node tools/strains.mjs --where 7
node tools/strains.mjs
node tools/crosses.mjs --where 7
node tools/crosses.mjs --share 40
node tools/shot.mjs before.png --at 6,-156 --bombs 3
node tools/shot.mjs after.png --at 6,-156 --bombs 3 --blast
node tools/sift.mjs
node tools/slabs.mjs --where 7
node tools/slab-play.mjs --seed 7
node tools/shot.mjs glow.png --at 3,52 --key --frames 50 --size 720x720 --zoom 2
```

`tools/shot.mjs` takes a picture of the game with nobody at the browser. It serves this folder on a free loopback port, opens the game in an installed Edge or Chrome run headless on a profile of its own (no saved game is read or written), steps it and saves a PNG of the page; the browser and the server are closed whatever happens, and the last line printed is the path written. The picture is of a fresh world on `--seed` (7), with the drill `--at dx,dy` cells from the core: east and south are counted up, so 300 cells north is `0,-300`. Away from the core the drill stands in a small room at the end of a tunnel carved from the core, as the tether fuzz carves a far start, and all the ground in view is uncovered. `--reach` is the tether's level (the first that gets there, if not given), `--size` the page in CSS pixels (360x640, about 11 x 20 cells), `--zoom n` shows n times as many cells across in the same picture, `--frames` how long the game is stepped first (180: three seconds), and `--lit` leaves out the dark, which is what a zoomed picture of a whole province wants. The name of the ground the drill stands in comes up as the game begins to be stepped, with the names of what the view uncovered: `--frames 20` catches them, and `--met` takes every ground as met before, so the name is on its plate and not across the screen. `--wake` wakes the hazard nearest the drill as a cut beside it would, so that what it does can be photographed at the moment `--frames` picks: lava woken (5), pouring and quenching its slag (120), set (900); a crystal's fuse lit (30), its arc (52), the rib it unzipped (420). The same view opens by hand at `index.html?shot&seed=7&at=0,-300&zoom=4&lit` (`js/shot.js`); it is held still until `tetherbore.resume()` is typed in the console. `--bombs n` gives the drill BLAST at level n and carves no room, so the ground round the end of the tunnel is as the seed laid it, and `--blast` sets one charge off there: the same view with and without it is a charge's room before and after (`--frames 8` catches the blast itself).

`tools/field.mjs` needs no browser: it asks the world whose ground each cell is and draws a square of it, a pixel a cell, in the colours of the game's map, with the core a white dot. `--size 4800 --step 4` is the whole world; `--ground` darkens open ground. It prints each ground in the square with the box it lies in and the cell of it nearest the middle, which is a place to send `tools/shot.mjs`.

`tools/strains.mjs` counts what the strains are made of, in the middle of real provinces on eight seeds: how much of each is open, soft, dense, ore, slate, hazard and ice beside its direction's own ground, the size of its tell (how wide the ice runs, how big the bubbles and the bunches of pods, how long the beds of slate), how much slag lies round the lava, how many crystals stand beside slate and how much slate one arc among them takes, and what a cell and a second of cutting pay beside the direction's own. A strain's row is tuned by it and by the eye, and `test/regress/c1-tells.mjs` holds the figures. With `--where 7` it says where on that seed a province of each strain lies nearest the core, with the tether level that reaches it: a place for a picture or for a fuzz flight to start.

`tools/crosses.mjs` does the same for the generated ground: each of the twelve pairs and each structure beside the host's own ground, with how thick the donor's hazard lies beside the donor's own (`test/regress/c3-cross-laid.mjs` holds the figures). `--share 40` says how much of the ground is generated at each distance from the core, in cells and in provinces, beside what the rule gives, and the least that is hand-made on any one seed; `--worth 12` what a solid cell pays at each distance with the crosses and without them; `--where 7` where a province of each pair and each structure lies.

`tools/sift.mjs` plays the bomb with no hand on it, at each level of BLAST and in each direction, with the upgrades a player holds when that level comes within reach of their purse: a charge is aimed where most ore stands within five cells of a spot, set off, and every lump it shook loose is flown round by the quickest way there is; then, from the same place in a world made afresh, the biggest loop is cut that is cut and closed in the time that took. It prints how many charges shook nothing loose, what a charge opened and left loose, what came home and in how long, and what the loop brought. The bomb's figures (`SIFT` in `js/game.js`) are judged by it, and `test/regress/c4-sift-worth.mjs` holds them to it; `--radius`, `--shake` and `--room` try other figures, and `--planned` plays the rule as it was first planned.

`tools/slabs.mjs` counts keystone slabs and cobble fields over a few worlds (how many sectors hold one, what stood against the rest, how big they are) and checks each as it lies in the world's cells; `--where 7` lists that world's, nearest first, with a place beside each to send a picture or a fuzz flight. `tools/slab-play.mjs` plays one with no hand on it: from the core to the crack by the quickest way, one lap through each key, and the haul, with what the frame of the last key cost in work (`--slab n` picks another slab, `--staged` starts beside it, `--winch 0` plays it over the winch's load; `--field n` flies a lap of a cobble field's joints instead). `tools/shot.mjs --key` stands the drill at the last key of the slab nearest `--at`, pushing into it: `--frames 50` shows the cut half made with its glow on the whole slab, 180 the slab hanging loose.

## The art

`art/tiles.mjs` and `art/sprites.mjs` hold the Pixelbolt sources: autotile terrains for every kind of ground, and hand-drawn recipes for the ore, the hazards, the drill, the core and the interface. The effects are Pixelbolt's shipped presets, and the text is Pixelbolt's pixel font.

```bash
node art/build.mjs --pixelbolt <path to a Pixelbolt checkout>
```

writes `assets/*.png` and `assets/atlas.json`, and `art/recipes/*.json` (each sheet's compiled recipe, to open with `pixelbolt inspect`).

## Design

See [DESIGN.md](DESIGN.md) for the original goal and pillars.
