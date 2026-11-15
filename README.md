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
- **The map**, bottom right, shows everything within reach. **Upgrades** are bought on the core, and each one changes how the drill, the tether or the station looks. **NEW**, top right, starts a fresh world (tap twice).

Progress is saved on the device: what you own in local storage, the ground in the browser's database. There is no server and no account.

## How it is built

The world is about 4,800 cells across, far too large to hold whole. `js/world.js` makes it a 64 x 64 piece at a time, from the seed alone, the first time anything looks there, and only pieces that have been seen or changed are kept and saved. `js/game.js` is the game: flight, the tether, hauling, hazards, drawing.

## Running it

It is a static site: serve the folder with any web server and open `index.html`.

```bash
python -m http.server 4791
```

## The art

`art/tiles.mjs` and `art/sprites.mjs` hold the Pixelbolt sources: autotile terrains for every kind of ground, and hand-drawn recipes for the ore, the hazards, the drill, the core and the interface. The effects are Pixelbolt's shipped presets, and the text is Pixelbolt's pixel font.

```bash
node art/build.mjs --pixelbolt <path to a Pixelbolt checkout>
```

writes `assets/*.png` and `assets/atlas.json`, and `art/recipes/*.json` (each sheet's compiled recipe, to open with `pixelbolt inspect`).

## Design

See [DESIGN.md](DESIGN.md) for the original goal and pillars.
