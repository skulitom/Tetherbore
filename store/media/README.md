# Steam screenshots and trailer

Everything here is the real game at 1920x1080, in the view the desktop build shows (`Game.resize(w, h, dpr, true)`, 3x pixels, one-row bar, the haul payoff of `js/payoff.js`). A scripted pilot flies it. Places and upgrade levels are staged with the game's own `?shot` query. Nothing in `js/`, `assets/`, `css/` or `index.html` was changed.

```bash
node tools/trailer.mjs all      # or: film [ids] | score | stills | cut | check
```

It needs ffmpeg, Edge or Chrome, and release builds of Cutbolt and Inkbolt (the `CUTBOLT` and `INKBOLT` variables, or sibling checkouts). Footage goes to `TRAILER_WORK` (default `store/media/out/work`). The trailer is written to `store/media/out/tetherbore-trailer.mp4`, which git ignores. `shots.mjs` holds the shots, the cut, the levels of the mix and the choice of stills.

## Screenshots, best first

| File | What it is |
|---|---|
| `01-haul-south-lava` | A 317-cell slab of the south mid-flight, lava below |
| `02-haul-north-ice` | A 398-cell haul breaking up in the north's ice |
| `03-haul-east-sandstone` | A 722-cell haul in the east |
| `04-reel-to-core` | The whole verb in one view: tether, rubble, core, count |
| `05-haul-west-mire` | A 191-cell haul in the west's spore caves |
| `06-lord-behemoth` | Lord fight: the Magma Behemoth charges |
| `07-haul-deep-frost` | A 707-cell haul, its count running |
| `08-lord-crystal-king` | Lord fight: the Crystal King tells an attack |
| `09-upgrade-shop` | The upgrade shop |
| `10-lab` | The lab's notes |

Numbers 1 to 5, 7, 9 and 10 show no lord and no fight, for the store's all-ages requirement.

## The trailer, 70.4 s

| Time | Shot |
|---|---|
| 0:00.0 | South: a 317-cell slab lets go |
| 0:02.6 | Its count runs up and stamps |
| 0:05.2 | **CUT**: at the core, the drill cuts round a block |
| 0:07.8 | **LOOP**: the tether closes round it |
| 0:10.4 | **REEL**: the core reels it home (one take across the three) |
| 0:13.0 | 147 cells |
| 0:15.7 | 588 cells |
| 0:18.3 | 707 cells |
| 0:20.9 | 722 cells |
| 0:23.5 | North: ice |
| 0:26.1 | South: basalt and lava |
| 0:28.7 | West: the mire |
| 0:31.3 | East: sandstone and crystal |
| 0:33.9 | The shop, rows bought |
| 0:36.5 | A part fitted at the core |
| 0:39.8 | The lab |
| 0:41.7 | The Frost Wyrm |
| 0:45.0 | The Crystal King |
| 0:48.3 | The Spore Mother |
| 0:51.5 | The Magma Behemoth charges |
| 0:54.8 | 1,102 cells: MOUNTAINOUS! |
| 0:58.7 | Its count |
| 1:02.6 | Logo and "Wishlist on Steam" over the station, dimmed |

## Choices made

- **Music:** the game's own `redrock` piece (92 BPM), rendered from `js/audio.js`, with every cut on its beat. Its quiet bars fall under the fitted part and the lab, just before the lords.
- **Sound:** each shot's sound is what the game asked for on those frames, rendered offline in step with the picture. The logo's sting is the game's own `crack`, `thump` and `stamp`. The game's sound is mono, so the trailer's two channels carry the same signal.
- **Words:** CUT, LOOP, REEL and the end card, in the game's own lettering, placed with Inkbolt. Everything else on screen is the game's own interface.
- **Staging:** most shots use late-game upgrades, and a slab's last key is staged with `?shot&key`. The cuts, loops, hauls and payouts are then played by the game. The shop's grit and gems are set so that its rows can be bought. No lord is beaten on film.
- **Not yet heard:** the mix has been measured but nobody has listened to it.
