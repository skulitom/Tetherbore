# Tetherbore

A one-thumb mining game for the phone browser. A core sits fixed at the centre of the world and your drill hangs from it on a tether. Draw the tether right round a piece of ground and the core reels the whole piece in.

Every sprite, tile set and effect is made with [Pixelbolt](https://github.com/skulitom/Pixelbolt).

## How it plays

- **Press anywhere and drag** to steer. The drill goes where you drag, a cell at a time; straight out from the core it runs on to the next piece of ground. From the core itself it can be thrown at any angle. Keep holding to cut. Arrow keys or WASD work on a desktop.
- **The tether is a lasso.** It lies where the drill has been, pulled tight round every corner. Going back the way you came winds it in. Touch your own tether, or come home by another road, and the loop closes: everything inside it is reeled in along the tether and paid out at the core.
- **Only hauls pay.** Drilling through ore crushes it; lasso it instead. The bigger the piece, the bigger the multiplier. Ground that is one cut from coming loose glows, and loose ground waiting for the tether wears a crawling blue edge.
- **Reach, not length.** The tether lets the drill go a set distance from the core, by any road, shown as a dotted ring. Inside the ring you can never be stuck. A longer reach is the first upgrade.
- **Nothing is too hard to cut.** Dense rock, slate and the ancient stone only take longer, cracking as they go, and a better bit cuts everything faster.
- **Home ground, then four directions.** The core sits in plain soft ground. Beyond it, north is ice, where cuts freeze over; south is basalt with lava pockets that pour into your tunnels; west is cave-ridden mire with spore pods; east is sandstone ribbed with slate and charged crystals. Far out, the flanks of each direction turn richer and meaner. Hazards wake when you cut beside them; lassoed asleep, they pay.
- **Something is sealed** in ancient stone a long way out in each direction. Bring all four home.
- **Upgrades** are bought on the core. **NEW**, top right, starts a fresh world (tap twice).

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

See [DESIGN.md](DESIGN.md) for the original goal and pillars.
