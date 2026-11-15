# Tetherbore

A one-thumb mining game for the phone browser. A core sits fixed at the centre of the world and your drill hangs from it on a tether. Cut a piece of ground completely free and the core reels the whole piece in at once.

Every sprite, tile set and effect is made with [Pixelbolt](https://github.com/skulitom/Pixelbolt).

## How it plays

- **Press anywhere and drag** to steer. Heading away from the core, the drill snaps to the next piece of ground in that direction; any other way it moves a cell at a time. Keep holding to cut. Arrow keys or WASD work on a desktop.
- **Only hauls pay.** Drilling through ore crushes it. Cut round a piece instead, and when it no longer touches the rest of the world it flies home. The bigger the piece, the bigger the multiplier. Ground that is one cut from coming free glows.
- **The tether is the limit.** It is a real string: it runs straight and bends only where it is pulled round a corner. When it is all paid out the drill stops. A longer tether is the first upgrade.
- **After a haul** the drill rides the tether home with it. **The house button** does the same at any time. At the core the cell recharges and the upgrades are for sale; the same button then sends the drill back to where it was.
- **Nothing is too hard to cut.** Dense rock, slate and the ancient stone only take longer, and a better bit cuts everything faster.
- **Each direction is a different place.** North is ice, where cuts freeze over unless you are quick. South is basalt with lava pockets that pour into your tunnels. West is soft, cave-ridden mire with spore pods. East is sandstone ribbed with hard slate and charged crystals. Far out, the flanks of each direction turn richer and meaner. Hazards wake when you cut beside them; hauled asleep inside a piece, they pay.
- **Something is sealed** in ancient stone a long way out in each direction. Bring all four home.

Progress is saved on the device. There is no server and no account.

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

See [DESIGN.md](DESIGN.md) for the goal and the pillars the game is built to.
