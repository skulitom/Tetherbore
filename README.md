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
- **Something is sealed** in ancient stone 2,000 cells out in each direction. Bring all four home.
- **Things to find.** Geodes (a shell of slate round rich ore), caches buried in stone, and eight wrecks, each in a hollow of its own further out than the last. A cache pays a lump; each wreck gives up a part that makes every haul pay a tenth more, and wrecks within reach blink on the map. All of them only pay hauled, not drilled.
- **The map**, bottom right, shows everything within reach. **Upgrades** are bought on the core, and each one changes how the drill, the tether or the station looks. **NEW**, top right, starts a fresh world (tap twice).

Progress is saved on the device: what you own in local storage, the ground in the browser's database. There is no server and no account.

## How it is built

The world is about 4,800 cells across, far too large to hold whole. `js/world.js` makes it a 64 x 64 piece at a time, from the seed alone, the first time anything looks there, and only pieces that have been seen or changed are kept and saved. `js/game.js` is the game: flight, the tether, hauling, hazards, drawing.

## Running it

It is a static site: serve the folder with any web server and open `index.html`.

```bash
python -m http.server 4791
```

## Testing it

```bash
node test/all.mjs
```

The game runs with no browser under `test/harness.mjs`. `test/all.mjs` runs every script in `test/regress/` (each fails while the defect it was written for is there), `test/smoke.mjs`, which plays every direction unattended, and the tether fuzz `test/rope-fuzz.mjs`: about two minutes, one line a test. Among the regress scripts, `i-fuzz-play.mjs` plays the whole game at random (throws, bombs, the shop) and checks the tether, the books of loose ground, the hauls and the money after every frame. Tests of speed count work, not time: `game.swept` (cells the tether's sweeps look at) and the world's `sides`, `followed` and `made` (outline sides walked, cells followed, pieces of world made). `test/frame-time.mjs` times a frame over the fuzz's flight. Three of the regress scripts are about the tools below: `t-shot-stage.mjs` runs `js/main.js` on a stand-in page, with and without `?shot`, `t-shot-tool.mjs` takes real pictures where a browser is installed, and `t-field.mjs` checks a map against the world.

## Looking at it

```bash
node tools/shot.mjs out.png --at 0,-300
node tools/shot.mjs out.png --at 0,-300 --size 1200x1200 --zoom 8 --lit
node tools/field.mjs map.png --at 0,-300 --size 800
```

`tools/shot.mjs` takes a picture of the game with nobody at the browser. It serves this folder on a free loopback port, opens the game in an installed Edge or Chrome run headless on a profile of its own (no saved game is read or written), steps it and saves a PNG of the page; the browser and the server are closed whatever happens, and the last line printed is the path written. The picture is of a fresh world on `--seed` (7), with the drill `--at dx,dy` cells from the core: east and south are counted up, so 300 cells north is `0,-300`. Away from the core the drill stands in a small room at the end of a tunnel carved from the core, as the tether fuzz carves a far start, and all the ground in view is uncovered. `--reach` is the tether's level (the first that gets there, if not given), `--size` the page in CSS pixels (360x640, about 11 x 20 cells), `--zoom n` shows n times as many cells across in the same picture, `--frames` how long the game is stepped first (180: three seconds), and `--lit` leaves out the dark, which is what a zoomed picture of a whole province wants. The same view opens by hand at `index.html?shot&seed=7&at=0,-300&zoom=4&lit` (`js/shot.js`); it is held still until `tetherbore.resume()` is typed in the console.

`tools/field.mjs` needs no browser: it asks the world whose ground each cell is and draws a square of it, a pixel a cell, in the colours of the game's map, with the core a white dot. `--size 4800 --step 4` is the whole world; `--ground` darkens open ground. It prints each ground in the square with the box it lies in and the cell of it nearest the middle, which is a place to send `tools/shot.mjs`.

## The art

`art/tiles.mjs` and `art/sprites.mjs` hold the Pixelbolt sources: autotile terrains for every kind of ground, and hand-drawn recipes for the ore, the hazards, the drill, the core and the interface. The effects are Pixelbolt's shipped presets, and the text is Pixelbolt's pixel font.

```bash
node art/build.mjs --pixelbolt <path to a Pixelbolt checkout>
```

writes `assets/*.png` and `assets/atlas.json`, and `art/recipes/*.json` (each sheet's compiled recipe, to open with `pixelbolt inspect`).

## Design

See [DESIGN.md](DESIGN.md) for the original goal and pillars.
