TETHERBORE CONTENT BUILD PLAN (biomes, mini zones, resources, upgrades)

Nothing was edited, built or run. I read README.md, DESIGN.md, the owner's rules, js/world.js in full, the economy, fly, finishDig, haul, hazards, blast, HUD, map and shop parts of js/game.js, art/tiles.mjs, art/sprites.mjs and art/build.mjs. Prices below were recomputed from the game's own income()/priced() with a throwaway script; everything else is design and must be checked in code as it lands.

Files: C:/DEV/Tetherbore/js/world.js, C:/DEV/Tetherbore/js/game.js, C:/DEV/Tetherbore/art/tiles.mjs, C:/DEV/Tetherbore/art/sprites.mjs, C:/DEV/Tetherbore/art/build.mjs, C:/DEV/Tetherbore/test/rope-fuzz.mjs. New: tools/world-hash.mjs, tools/zone-budget.mjs, tools/ground-worth.mjs, test/slab-moat.mjs.


==============================================================
0. THE SHAPE OF THE PLAN
==============================================================

Three layers of place, hand-made first, then one rule that makes the rest:
- BIOMES: 9 today, plus 8 hand strains laid as provinces, plus 4 hand-made seam biomes on the diagonals (8 rows with their deep kinds).
- POCKETS (mini zones): 12 hand-made, 12 to 60 cells across, each with its own ground, mineral and one rule. Keystone slabs are a thirteenth kind of place that lies in ordinary ground.
- THE GENERATOR: (a) CROSSES, a host direction's ground with a donor direction's hazard and one hand-made structure, 60 rows from 12 reviewed sheets; (b) FLANK POCKETS, a hand-made pocket's shape laid in deep flank ground, up to 48 rows with no new art. Both only cross parts that exist hand-made, so a player can read them at a glance.

Resources: grit and the four gems as now; one new resource, SPECIMENS, counted per direction, earned only from pocket minerals, spent only on one-off unlocks ("gems buy strength, specimens buy verbs"). Every pocket mineral also pays a lump of income, so no pocket is ever dead.

Where the two judges disagreed I chose as follows, and say so at the item: heralds at r 165 (the player asked 150 to 160; 165 is the nearest that clears home ground's wandering edge); PRIMER as its own WORKS row (builder) with the player's fold-in as the alternative; Lantern caps light on any pass (player), no speed gate; hand strains keep all eight rows (builder) but the four the player called "thresholds" each get a structural tell.

Income model: PACE, WORTH, income(), REACH_COST and every existing price stay as they are. Each item says what it adds; tools/ground-worth.mjs is the check, and the rule is: if any ring's sampled mean of GRIT x rich moves more than 15% from today's, WORTH is set to the sampled mean and all prices follow.


==============================================================
1. SYSTEMS TO BUILD FIRST
==============================================================

--------------------------------------------------------------
S1. One table of kinds, one table of biomes (land alone, with the hash check)
--------------------------------------------------------------

KINDS, in world.js. Ids 0 to 14 stay. HARD, GRIT, GEMS and DIG_TIME are derived from this table (DIG_TIME moves to world.js and is imported by game.js).

  id name     hard grit gems dig
  0  EMPTY    0    0    0    0
  1  CORE     99   0    0    0
  2  BEDROCK  99   0    0    0
  3  SOFT     1    1    0    0.24
  4  DENSE    1    2    0    0.45
  5  ORE_A    1    2    1    0.24
  6  ORE_B    1    4    5    0.45
  7  SLATE    1    4    0    1.0
  8  VAULT    1    10   0    1.8
  9  HAZARD   1    3    2    0.24
  10 RELIC    99   0    0    0
  11 ICE      1    0    0    0.18
  12 BASALT   1    1    0    0.45
  13 CACHE    1    0    0    0.6
  14 WRECK    99   0    0    0
  15 MINERAL  1    0    0    0.45   a pocket's mineral; which one comes from the cell's biome row
  16 NODE     1    0    0    row    a pocket's special cell (stalk, fuse, brace, seed); dig = row.pocket.nodeDig
  17 HAZARD2  1    3    2    0.24   a row's second hazard
  18 KEY      1    4    0    1.0    keystone
  19 FAULT    1    1    0    0.12
  20 SLAG     1    2    0    0.45
  21 STEEL    1    6    2    0.6    gems are ember's
  22 CAP      1    1    1    0.24   gems are mire's
  23 CAP_LIT  1    1    3    0.24   gems are mire's
  24 PRISM    1    0    0    0.6
  25 GLASS    1    1    0    0.12
  26 TWIN     1    2    0    0.6
  27 FOSSIL   1    2    0    1.0
  28-31 reserved

Whose gem a cell pays (one function, gemKin(k, row)): ORE_A row.gemA; ORE_B row.gemB; HAZARD the kin of row.haz.type; HAZARD2 the kin of row.haz2.type; STEEL ember; CAP and CAP_LIT mire. Hazard types and their kins: lava ember, spore mire, spark lode.

BIOMES, in world.js, indexed by id (sparse). The id is what chunk.biome stores (Uint8), so ids never move:
  0-8      today's nine, unchanged
  9-16     seams (9 hoarstone, 10 glassdune, 11 cinderfen, 12 frostfen; 13-16 their deep kinds)
  17-24    hand strains (17 firn, 18 serac, 19 scoria, 20 forge, 21 tangle, 22 sporefall, 23 redrock, 24 loess)
  25-31    reserved for more hand strains
  32-63    pockets (32 hive, 33 drift, 34 ash, 35 grotto, 36 tinderwork, 37 glaze, 38 shale, 39 echo, 40 salt, 41 old works, 42 slab garden, 43 chalk downs)
  64-127   reserved for hand-made rows
  128-187  generated crosses: id = 128 + (host - 1) * 15 + donorIndex * 5 + structure
  192-239  generated flank pockets: id = 192 + (pocketId - 32) * 4 + (flank - 5)

Row shape (only fields something reads):
  { id, name, title, kin (0-4), gemA, gemB, rich, gemx, worth (1), dig (1),
    sheet, floor, gloom [r,g,b], dark (1), mote [colour, 'rise'|'fall'|'sway'|'still'], map [r,g,b], debris [3 colours],
    gen { dense, oreA, oreB, slate, cave, cavern },
    haz { type, rate, t } | null, haz2 { type, rate, t } | null, lavaVol (5), freeze (seconds, 0 = never), glass (false),
    extras [names of feature rules, in order],
    pocket null | { shape, kins, minR, rho [min, max], weight, wobble (true), mineral, node, kind (K.MINERAL), lump, spec, nodeDig, twist } }

Rows 0 to 8 with today's numbers (must reproduce today's world exactly):
  0 crust: kin 0, rich 1, gemx 0. Its generation stays the existing crust branch, verbatim.
  1 frost: gen dense 0.68, oreA 0.66, oreB 0.74, slate 0.03, cave 0.8, cavern 0.78; haz null; freeze 30.
  2 ember: as frost but dense 0.64; haz lava t 0.78; freeze 0.
  3 mire:  cave 0.68, cavern 0.7; haz spore rate 1.
  4 lode:  slate 0.05; haz spark rate 1.
  5-8 rime, magma, bloom, gilt: the kin's row with oreA 0.6, oreB 0.66, rich 2, gemx 2, hazard rate 1.8 (lava t 0.72). Rime keeps freeze 30.
  Lava rows carry the threshold t explicitly (0.78, 0.72), never computed, so no float differs. Spore is hash(x, y, seed+10) < 0.022 * rate, spark 0.026 * rate, exactly today's expressions. The vault vein rule (r > 600) stays for every row but crust.
  gloom, mote colour, map and debris come from today's GLOOM, MOTE, MAPC and DEBRIS. Mote drift: frost fall, ember rise, mire sway, others still (today's branches in ambient()). MAPC today equals each sheet's f colour; keep that rule for every new row.

Second hazard. A row's first hazard is K.HAZARD, its second K.HAZARD2. What a hazard cell is and looks like comes from its type, never from the biome: HAZ_SHEET = { lava: 'ember-items', spore: 'mire-items', spark: 'lode-items' }, and hazard sprites are never recoloured. The second hazard is generated from its own seeds so it cannot land on the first: lava noise(x/2.5, y/2.5, seed+58) > t and hash(x, y, seed+9) > 0.45; spore or spark hash(x, y, seed+59) < 0.022 or 0.026 times rate.

kindAt(x, y, b) becomes: bedrock, core, starter piece, relic vaults and wrecks exactly as now; then if the row is a pocket, the pocket's shape generator (no finds, no slabs, no extras); then slabAt (system S3) ; then findAt; then the crust branch for row 0, or the standard ground for every other row reading thresholds from row.gen, in today's order (dense, oreA, oreB, hazard, slate, vault, small caves, great caverns), with the row's extras applied at their stated place.

game.js, every place that tests base(b) or b > 4 or indexes by biome id (about 20): haul (rich and gem index), finishDig and blast (frost test becomes row.freeze > 0), trigger and zap and the lava loop (switch on hazard type of that cell), the frost tick (30 becomes the cell row's freeze), ambient (gloom, motes by row.mote[1], setAmbience(row.kin, row.rich >= 2), sfx.chime(row.kin)), rockSheet (row.sheet), paint (row.floor), itemSheet and overlay (take k and the row; return [sheet, frame]), the relic draw, light (alpha 168 * the eased row.dark), fly (digDur = DIG_TIME[k] * row.dig / SPEED), drawMap (row.map). The spore regrowth must stop writing B.MIRE into the cell's biome byte: the regrown cell keeps the row it lies in.

The check, tools/world-hash.mjs (pure, imports world.js): for seeds 1, 7 and 123456, build the pieces holding the core, each axis at r 200, 600, 1000, 1500 and 2000, and each diagonal at 1000 and 1500; print an FNV hash of each piece's kind and biome bytes. Run before and after this refactor; every line must match. Later items change ungenerated ground on purpose and are not held to it.

Size M. Risk: a transcribed threshold; the hash check catches it.

--------------------------------------------------------------
S2. Loose ground from a whole set of cuts; one pay function; the light haul
--------------------------------------------------------------

freed(cells, limit, open). Today freed(i) starts from the four neighbours of one cell, and a group that is the only solid neighbour is taken for the rest of the world, so an island whose every neighbour was opened in one go (a bomb, a pane, an arc through slate, a crack) is never registered. Change: `cells` is one index or an array; `owner` is seeded with every opened cell as -1; the floods start from every solid 4-neighbour of every opened cell; `open` is an optional Set of cells treated as EMPTY for the glow preview (a pane, a crack, a punch). The rest of the algorithm is unchanged. changed(touched) calls it once with all touched cells not already loose, instead of once per cell. foresee(i, also = []) passes the extra cells as `open`.

payOf(cells, extra = []) : one pure function that haul() calls and the glow's worth figure will call, returning { n, grit, gems[5], lump, spec[5], minerals, prisms, relic, caches, parts, mult, over }. Per cell, with row = BIOMES[b] and far = distance from the core:
  grit += GRIT[k] * richness(far) * row.rich * row.worth
  gems[gemKin(k, row)] += GEMS[k] * row.gemx           (row 0 pays no gems, as now)
  the crust ore bonus, cache lump, wreck part and relic exactly as now
  if k is the row's pocket kind (K.MINERAL unless the row says otherwise): lump += round2(income(max(22, far)) * P.lump * chain) and spec[zone kin] += P.spec
  prisms += (k === K.PRISM)
  grit = round(grit * haulBonus(n, winch) * (1 + 0.1 * parts owned) * overload) + lump
  gems are multiplied by 1 + 0.5 * min(prisms, 3) and rounded once per colour at the end.

The light haul. haul() fires hitstop, shake, flash, a ring and the banner every time, which will stutter flight when small hauls chain (Hive, Drift, Sift). A haul is light when n < 12 and it holds no relic, cache or part: no hitstop, no flash, no 'bank' effect, shake at most 1.5, a small ring, and instead of replacing the banner a popup at the piece ("+1.2K" in gold with the mineral's icon). While a chain is running its rubble breaks coarser (per = 2). haul() returns at once if it is handed no cells (a haul with none never finishes: doneAt is only set when a bit arrives).

Size S to M.

--------------------------------------------------------------
S3. Where places lie
--------------------------------------------------------------

biomeAt(x, y), in this order:
  1. r > 150 and the cell lies in a pocket: the pocket's row id.
  2. Home ground, as now.
  3. n1 = noise(x/61, y/61, seed+1), n2 = noise(x/61, y/61, seed+2), ax, ay, the kin b and `deep`, all as now.
  4. Seam (once seams are built): |ax - ay| < clamp(0.12 r, 24, 90) gives the seam row for that corner, or its deep row where r > DEEP_R + (noise(x/50, y/50, seed+14) - 0.5) * 200. Corners: north-east hoarstone, south-east glassdune, south-west cinderfen, north-west frostfen.
  5. deep: b + 4, as now. Strains and crosses never replace deep flank ground.
  6. Province: px = floor((x - C + (n1 - 0.5) * 120) / 256), py likewise with n2; rc = distance of that province's middle from the core. If rc >= 220:
       X = clamp((rc - 500) / 2500, 0, 0.35)                 the share of generated ground
       v = hash(px, py, seed+55)
       v < X: a cross. donor = the other three kins in id order [floor(hash(px, py, seed+56) * 3)], structure = floor(hash(px, py, seed+57) * 5). Return the cross row, or the parent if that sheet failed review (CROSS_OK[host][donor]).
       v < X + (1 - X) * 2/3: a hand strain of this kin, the one with the largest hash(px, py, seed + 300 + rowId) (so adding a strain later disturbs few provinces).
       else the parent.
  7. b.

Pockets. ZONE = 128. zoneOf(sx, sy), sx = floor((x - C) / 128), cached in a Map cleared on reset, with the last sector memoised (biomeAt and kindAt both ask):
  - Heralds, fixed like the wrecks, rho 9, one per direction just past home ground: east at (C+165, C+14) in sector (1, 0), west (C-165, C-14) in (-2, -1), north (C+14, C-165) in (0, -2), south (C-14, C+165) in (-1, 1). The 14-cell offset keeps each inside one sector. Types: north Glaze, south Tinderwork, west Lantern Grotto, east Shale Stack; until those are built, north and east are Pumice Drift, south Ash Flats, west Amber Hive.
  - Otherwise none unless hash(sx, sy, seed+40) < 0.5.
  - rho0 = 6 + 24 * hash(sx, sy, seed+41)^2. Centre = sector corner + 38 + floor(hash(seed+42 | seed+43) * 52) on each axis (38 = the largest edge, 1.2 * 30 + 2, so a cell only ever checks its own sector).
  - None if the centre is nearer the core than 170, or within 40 + rho of a wreck or a relic vault.
  - zone.kin = the centre's direction with no noise (|dx| > |dy| ? east or west : north or south).
  - Type = the eligible pocket row (kins holds zone.kin or is 'any', centre distance >= minR) with the largest hash(sx, sy, seed + 100 + rowId) * weight. In a deep flank (r > 900 and the flank test without its noise) half the pockets, by hash(sx, sy, seed+97) < 0.5, become that type's flank row (section 4).
  - rho = clamp(rho0, type's range).
  - A cell is inside when d < rho * (0.8 + 0.4 * noise(x/7, y/7, seed+44)); only cells with 0.8 rho <= d <= 1.2 rho need the noise. Types with wobble: false use d < rho.
  - The record: { key, row, cx, cy, rho, kin }.
  Counts within reach: about 6 at reach 230 (the heralds and two more), 14 at 420, 51 at 750, 172 at 1,350, 505 at 2,300. Cover 2.4% of the ground.

Slabs (keystone slabs, content item 5) use their own sectors of 144 and lie in whatever biome is there; see the item.

findAt's free band 0.70 to 1.00, allocated once: [0.70, 0.74) prism, [0.74, 0.80) twin stones, [0.80, 0.86) fossil, the rest empty. Geodes and caches keep their rates. Add findSpot(sx, sy) returning [what, fx, fy, size] with no chunk made (callouts and SURVEY read it).

Seeds in use by new rules, so nothing collides: 40-44 zones; 45-47 hive; 48-50 drift; 51 ash; 52, 96 tinderwork; 53 caps; 54 echo; 55-57 provinces; 58-59 second hazard; 64 grapes; 65 lanes; 66 rivers; 67 bubbles; 68 slag; 80-89 slabs; 90-91 faults; 92 salt; 93-94 glaze; 95 shale; 97 flank pockets; 100+id pocket type; 300+id strain.

The map. drawMap asks biomeAt for unseen cells even where the chunk already exists with older ground, which would show places that are not there in an old save. Add world.biomeKnown(x, y): the stored byte when the chunk exists, biomeAt otherwise. Pockets too small to show at the map's scale are drawn as 2x2 pips in their ground colour, the 24 nearest unvisited within reach, after the wreck blips; a pip is skipped when the centre's chunk exists and its stored biome is not the pocket's row. The list is rebuilt when the drill changes sector or reach changes.

Old saves: SAVE_KEY stays v3. Chunks already made keep their bytes; new places appear in ground not yet generated, and a place straddling an explored chunk is cut off at its edge. That is harmless (every cell is cuttable) and a NEW world has everything. Runtime rules must read real cells (w.k), never regenerate a place from its record and trust it.

--------------------------------------------------------------
S4. The resource set
--------------------------------------------------------------

- Grit, and the four gems, as now. Gems buy levels.
- SPECIMENS, one count per direction: S.spec = [0, north, south, west, east] indexed by kin like S.gems. A pocket mineral cell hauled adds the pocket's `spec` (a fraction; shown floored) to the count of zone.kin, twice that in a flank pocket. Never multiplied by richness, winch or parts, so the numbers stay human: every pocket type is tuned to about 12 specimens at radius 14. They buy the one-off unlocks on the WORKS tab (12, 12, 12 and 30). A future unlock names the direction it is bought in; a future pocket or generated place needs no new currency.
- LUMPS: a mineral cell pays round2(income(max(22, far)) * lump seconds), the form of the cache line. Budget for every pocket type: mean mineral cells * lump <= 3.5 * radius seconds of income (49 s at radius 14; that is 15% of the next reach at reach 230, 12% at 750). tools/zone-budget.mjs (pure) makes 200 pockets of each type and prints mean mineral cells, seconds against the budget, specimens against 12, and the pay rate while inside against the model's. The lumps and spec values in section 2 are first figures to be set by that script.
- HUD: no permanent slot. When specimens are banked a line slides out under the top panel for 3 s: the specimen icon in the direction's gem colour and the count, with "/need" while an unlock in that direction is unbought. The haul banner's third line gains the mineral's icon and +n.

Model: pockets cover 2.4% of the ground and pay 1.3 to 2 times the model's rate while inside, about +3% in all; nothing is repriced.

--------------------------------------------------------------
S5. Naming a place and announcing a find (the first juice item, needed by everything)
--------------------------------------------------------------

- look(): when the drill's cell changes, the place key is the zone key in a pocket, else the biome id. On a change set this.place = { title, icon, colour, t }.
- The plate: a small panel at (4, 44), left of NEW, with an 8x8 icon (the pocket's mineral scaled, or the kin's gem icon) and the name in the place's map colour, for 2.4 s, with a two-note motif by kin. The first time a row is ever met (S.met[id] unset) it is a title card instead: the name alone at twice the size at H * 0.3 for 1.6 s with a chord. Names only: no hint text and no rule lines anywhere.
- First sight: world.see() pushes each newly seen notable cell to world.spotted (CACHE, WRECK, RELIC, KEY, PRISM, a pocket's mineral, and SLATE inside a geode's radius by findSpot). look() drains it: one callout per thing (keyed by kind and 48-cell sector), one per kind per 3 s: a ring spreading from the object, a motif per kind, a popup with its name ('GEODE', 'CACHE', 'WRECK', 'KEYSTONE', 'PRISM', the mineral's name), and a dot in S.marks (24 at most) drawn on the map until the cell is gone. An unclaimed wreck within 30 cells ticks softly, quicker as the drill nears.
- Saves: S.met ??= {}, S.marks ??= [], S.visited ??= {}.
- Code: world.see, look, drawHud, drawMap, audio.js (two motifs). Size S for the plate and callouts, M with the title card and the tick.

--------------------------------------------------------------
S6. Shop layout: two tabs (built with the first WORKS item, after the cut line)
--------------------------------------------------------------

The six-row panel keeps its size. The 22-pixel header holds two tabs in place of the word UPGRADES: RIG at px+4 (40 wide) and WORKS at px+46 (48 wide), the close cross where it is. this.shopTab is 'rig' or 'works', not saved. A dot on a tab means something in it can be bought. The shop note moves to the footer line, replacing NEW WORLD while it shows. RIG is the six levelled rows exactly as now. WORKS uses the same row renderer: 16x16 preview, name, what it does, grit, and specimens as have/need with the specimen icon in the direction's colour; short of specimens the second line says where ("NORTH POCKETS"); bought, the row is the gold 'button-max' reading FITTED. Up to six rows; a third tab can be added the same way. Saves: S.mods ??= {}.

WORKS rows and prices (grit = priced(beside, share) from the game's own formula):
  LAUNCH   south 12 specimens, 64K   (beside 5.0, share 0.4)
  PRIMER   west 12,  56K             (beside 5.2, share 0.3)
  MAGNET   east 12,  93K             (beside 5.5, share 0.4)
  RELAY    north 30, 140K            (beside 6.0, share 0.4)   a candidate: see open questions
All four together are about six minutes of income at reach 230 to 420, on a model run of about 68.


==============================================================
2. CONTENT, IN BUILD ORDER
==============================================================

--------------------------------------------------------------
1. Eight hand strains, laid as provinces  (M to L, mostly art)
--------------------------------------------------------------
Two named kinds of each direction's ground in provinces 256 cells across from r 220 (placement in S3), so a long flight keeps changing. Each has a structural tell seen in the shape of the ground. Floors, gloom and motes are the kin's; the plate shows the kin's gem icon so colour and icon both say which gem the place pays.

  17 FIRN (north). Massive ice with few caves, crossed by long frozen rivers that are fast roads. gen dense 0.60, cave 0.86, cavern 0.84; freeze 45; extras ['rivers']: a SOFT or DENSE cell where |noise(x/40, y/40, seed+66) - 0.5| < 0.012 is K.ICE. rich 0.95.
  18 SERAC (north). Shattered: a mesh of brittle lanes, so pieces fall loose easily, and cuts freeze fast. freeze 15; extras ['lanes']: SOFT or DENSE where |noise(x/6, y/6, seed+65) - 0.5| < 0.04 is K.ICE (aim for 15% of cells; sample and adjust the width). rich 1.05.
  19 SCORIA (south). Frothy: bubbles of 1 to 3 cells everywhere, less lava. haz lava t 0.80; extras ['bubbles', 'slag']: EMPTY where noise(x/2.5, y/2.5, seed+67) > 0.7. rich 0.95.
  20 FORGE (south). Clinker fields: more and bigger lava pockets, each in a thick rind of slag (content item 2). haz lava t 0.735, lavaVol 7; slag rind 0.12 wide; slate 0.04. rich 1.25.
  21 TANGLE (west). Great open caves with thin bridges. cavern 0.60. rich 1.0.
  22 SPOREFALL (west). Pods hang in grapes of three to six: one nick is a chain of clouds, one sleeping lasso a jackpot. haz spore rate 0.5; extras ['grapes']: HAZARD where noise(x/3, y/3, seed+64) > 0.8 and hash(x, y, seed+10) < 0.6; oreA 0.63. rich 1.2.
  23 REDROCK (east). Slate in level strata, so loops come out long and flat. slate 0; extras ['strata', 'ribs']: SLATE where |noise(x/40, y/3, seed+11) - 0.5| < 0.05. rich 1.0.
  24 LOESS (east). Pale silt that cuts in half the time, poor in ore: the fast road. dig 0.5; dense 0.76, oreA 0.72, oreB 0.80, slate 0.02; haz spark rate 0.5. rich 0.85.

rich follows 1 + 0.4 * (hazard multiple - 1) + 0.3 * (dig - 1), so pay follows danger by formula. gemx is 1 for all eight.

Art (art/tiles.mjs, one rock() call each, speckle as [colour, amount, size]):
  firn      k #1c2e4a D #5f7ea8 L #eef6ff s #06102659 f #9fb4cc a #8aa0bc b #b4c8dc c #dcecf8; a .24/7, b .14/5, c .02/2; seed 113
  serac     k #2a4a72 D #8ab8e0 L #ffffff s #06102659 f #e4f6ff a #c4e2f6 b #f4fcff c #6fb0e0; a .20/3, b .12/2, c .06/1; seed 127
  scoria    k #1a0a08 D #4a2420 L #d08a64 s #00000066 f #8a4a38 a #6e3830 b #a05c44 c #2a1210; a .22/3, b .14/3, c .08/2; seed 131
  forge     k #120808 D #34222a L #b08a80 s #00000066 f #5e4648 a #4c383c b #74585a c #ff9a3a; a .26/4, b .16/3, c .04/2; seed 137
  tangle    k #0e1a12 D #24402c L #a8e070 s #05020a59 f #3e5a40 a #324a36 b #5a4a70 c #c8f08a; a .22/6, b .12/5, c .03/2; seed 139
  sporefall k #22142c D #5a4070 L #f0c8ff s #05020a59 f #a888b8 a #8e70a0 b #c4a4d0 c #b4e878; a .20/5, b .16/4, c .04/2; seed 149
  redrock   k #2e120a D #703420 L #f0b080 s #1a0c0459 f #a85a3a a #944a2e b #bc6e48 c #e09a6a; a .24/6, b .18/4, c .04/2; seed 151
  loess     k #4a4030 D #a89878 L #ffffff s #1a140c59 f #e4dcc8 a #d4cab0 b #f0ead8 c #fffaf0; a .18/3, b .12/3, c .02/1; seed 157
  DEBRIS for each: [f, a or b, L]. Draw all eight over their items with art/preview.py and judge by eye before shipping.
Code: eight rows, the province pick in biomeAt, five extras (rivers, lanes, bubbles, grapes, strata) as small functions.
Model: rich 0.85 to 1.25 on two thirds of non-deep ground past 220, mean about 1.03. No change.
Risk: a palette that strays loses which gem a place pays; the hue family and the gem icon guard it.

--------------------------------------------------------------
2. Three direction rules  (S each; they are also what the generator crosses)
--------------------------------------------------------------
SLAG AND STEEL (every row with lava). A rind of dull slag round each lava pocket turns to steel where lava touches it: lasso the pocket asleep, or wake it and take the flood for more.
  Generation, on the lava noise n already sampled, threshold T = the row's t: SLAG where n is in (T - 0.07, T] and the cell would be SOFT or DENSE, and on the cells with n > T that did not become lava, where hash(x, y, seed+68) < 0.5.
  Rule: in trigger() for lava and in the lava flow loop, each 4-neighbour that is SLAG becomes STEEL with a white quench flash, a sparkle, sfx.clink and a hiss; bump version so the chunk repaints. No solidity changes, so no changed().
  Numbers: a pocket of 6 lava and 12 slag pays 12 gems asleep, 36 woken with steel at 2 gems. Ember gems only feed BLAST. If waking is always right, lower steel's grit, not add rules.
  Art, ember-items: 'slag' (a pitted clinker lump 9x8: #6a5a52, pits #3e3230, light #8e7c70; must look worthless), 'steel' (a banded ingot 10x6: #d8e8ff, #6e8cc8, #3a4a7a, with a one-frame glint; must look precious), 'quench' (steel with every colour white).
CRACKLING RIBS (every row with spark). Crystals stud the flanks of slate ribs, and an arc shatters the slate beside it: nick, pull back, and the arc unzips the rib.
  Generation: HAZARD where s = |noise(x/9, y/9, seed+11) - 0.5| is in (w, w + 0.015), w the row's slate width, and hash(x, y, seed+10) < 0.10 (Redrock uses its strata noise).
  Rule: zap(x, y) also opens every SLATE among the crystal's 8 neighbours that is within reach, with chips, then one changed(opened) (needs S2). The fuse of a crystal woken from beside it goes from 0.55 to 0.8 s so there is room to retreat at RAM level 0. Shattered slate is crushed: that is the price.
  Art: none.
VEIN FROST (every row with freeze). A cut that freezes over beside ore heals as ore.
  Rule, in the frost tick: when a cut closes and a 4-neighbour is ORE_A or ORE_B, it becomes ORE_A instead of ICE, with a sparkle (#a8fff0) and sfx.gem when on screen.
  Numbers: a cut cell borders ore about a third of the time, so at most about 0.35 gems per cell cut against about 4 for ordinary loops: under +10% frost gems, and it needs a fresh cut each time.
  Art: none.
Code: kindAt (two extras), trigger, zap, updateHazards, overlay.

--------------------------------------------------------------
3. The cross generator  (M; today's request, so it does not slip)
--------------------------------------------------------------
Specified in section 4. It needs S1 (second hazard), the province pick of item 1 and the rules of item 2, and 12 sheets.

--------------------------------------------------------------
4. SIFT CHARGE: BLAST reworked, same row and save id  (S)
--------------------------------------------------------------
The bomb takes the plain ground and leaves everything of value standing loose, ready for one circle of the tether.
Rule, blast(): a disc of radius [-, 2.5, 2.5, 3.5, 4.5] by level (21, 21, 37, 61 cells; today's squares are 9 and 25, so it is also a buff) opens only SOFT, ICE, BASALT, GLASS and FAULT cells within reach. Ore, stones, slate, minerals, caches, geodes and sleeping hazards stay, and hazards are not woken. Then one changed(opened), which with S2 registers every island. The row reads 'BOMB: SHAKES ORE LOOSE'.
Numbers: charges 0, 1, 2, 3, 4 as now. A 37-cell disc in direction ground keeps about 14 cells holding 13 to 17 gems; four charges are about 60 gems, the gems of a 14x14 loop without its cutting, against gem prices of 150 to 1,200. Grit is below loop play. Share 0.35 to 0.4: 210, 4.3K, 64K (+150 ember gems), 370K (+790).
Art: none.
Try on a phone: the swirl round one nugget in a 5-cell room. If fiddly, also clear one ring of plain ground beyond the disc.

--------------------------------------------------------------
5. Keystone slabs, with the cobble field; and Prism  (M + S)
--------------------------------------------------------------
KEYSTONE SLAB. A great disc of ground already cut round by a natural crack and held by two or three iron keystones: cut the keys, fly one lap, haul hundreds of cells.
Plays: the white glow lights the whole slab from the last key; then a free lap of the moat at speed. The expert order is the lap first and the last key second.
Generation, slabAt(x, y), cached per 144-cell sector, checked after wrecks and vaults and before finds:
  - A sector holds a slab when hash(sx, sy, seed+80) < 0.22 and its centre is more than 60 out. Radius p = 8 + floor(hash(seed+81) * 9) (8 to 16); centre jittered with a 40-cell margin (seed+82, +83).
  - One fixed first slab, p 8, at r 52 on the bearing hash(1, 1, seed+89) * 2 pi (turned 90 degrees if within 25 cells of the first wreck): wholly inside reach 72, and a ring on the map before that.
  - No slab where its disc of p + 5 meets a pocket (ask zoneOf for the sectors it overlaps), within 40 + p of a wreck or vault, or where noise(cx/19, cy/19, seed+18) is within 0.08 of the row's cavern threshold (it would float in a great cavern).
  - pw = p + (noise(x/6, y/6, seed+84) - 0.5) * 3. The moat: |d - pw| < 1.1 is EMPTY, except within 1.2 cells of arc of the key angles (2 keys, 3 when p > 12, from hash(seed+86, +87, +88), at least 60 degrees apart), which is K.KEY.
  - Inside (d < pw - 1.1) and in a collar outside (pw + 1.1 <= d < pw + 3.5): the row's ordinary ground with both cave rules skipped, and inside with ore thresholds lowered by 0.05. No finds within pw + 2. Caves inside would split the slab into parts no key holds (the west is 32% open), which is why they are skipped.
  - Cobble field when hash(seed+85) < 0.35: in a disc of p + 4, cells with u mod 5 = 0 or v mod 5 = 0 are EMPTY grout; each 4x4 block keeps one KEY in the grout on its east or south side by hash, so every block hangs through its neighbours on the rock outside and nothing floats.
Numbers: KEY grit 4, dig 1.0. A slab of p 12 is 452 cells, 42 s of model cutting taken in about 10; at 0.22 per sector that is +1.6% income. haulBonus and overload apply, so WINCH matters (452 is over the first load of 150; the banner already says so).
Art, finds sheet: 'key', an iron staple across the block: a bar 10x3 (#8a94a8, top row #eef4ff), a leg 2x4 down at each end, rust dots #b0603a, outline #1c1420. It must read from across the screen; each key in view shines 0.4 / 2 (12 at most).
Code: slabAt and the cave-less ground flag in world.js; overlay, the `tough` line in finishDig, light() in game.js.
Test, test/slab-moat.mjs: on 200 seeds, the moat is one 4-connected ring a 0.68-wide body can fly; the inside touches the outside only through keys; the collar is held by the world.
PRISM. A clear crystal that multiplies the gems of whatever haul it rides in.
  Generation: findAt band [0.70, 0.74), r > 130: PRISM at the find point, ORE_A in the eight cells round it.
  Numbers: gems * (1 + 0.5 * min(prisms, 3)), rounded once. A 48-cell loop carries about 640 gems, so one prism adds about 320, one or two gem prices at reach 230 to 420. 4% of sectors: about +2% gems.
  Art, finds: 'prism', a six-sided crystal 6 wide and 10 tall (left facet #ffffff, middle and right from the palette), three frames cycling the palette through #bfe6ff/#4fd0e8, #ffb060/#c8442a, #b8f06a/#d8b8ff; drawn in the per-frame pass. Banner line 'PRISM x1.5'.

--------------------------------------------------------------
6. Pockets (the scaffold of S3 and S4) with AMBER HIVE  (L + M)
--------------------------------------------------------------
The scaffold: zoneOf, the pocket branch of biomeAt and kindAt, K.MINERAL and K.NODE with overlay(k, row), the lump and specimens in payOf, the plate and pips, tools/zone-budget.mjs, and a new 'minerals' sheet in art/sprites.mjs (16x16 frames, 12x12 symbols at 2, 2, added to RECIPES). Inside a pocket there are no finds, slabs, hazards or regrowth.

AMBER HIVE (32). A honeycomb of wax chambers where one bite on a stalk drops an amber nugget to be circled.
Plays: fly in through a door or bite through a wax wall (0.12 s). Bite the stalk; the 3x3 nugget wears the blue edge; one swirl in the two-wide ring of space and it reels in. About five seconds a nugget.
Row: kins mire, minR 170 (it is the west's herald until the Grotto is built), rho 8 to 30, dig 0.5, worth 1, shape 'hive', mineral 'amber', node 'stalk', nodeDig 0.1, lump 0.9, spec 0.25, gloom [28, 16, 4], mote [#ffd070, 'still'].
Generation, in whole-cell offsets (u, v) from the centre: rows of chambers 8 tall, odd rows shifted 4; a cell on a row line or a column line is wall (SOFT). Each 7-cell wall segment has a door (EMPTY) at its middle with chance 0.4 (hash of the segment, seed+45). Each 7x7 chamber by c = hash(chamber, seed+46): c < 0.55 a nugget (MINERAL on offsets 3 to 5 by 3 to 5, and a two-cell NODE stalk from it to the wall on the side floor(hash(seed+47) * 4)); c < 0.70 solid wax; else empty.
Numbers at radius 14: about 5.3 nuggets, 48 amber, 43 s against a budget of 49.
Art: rock 'wax' k #3a2208 D #8a5a14 L #ffe89a s #1a0c0059 f #d89a2a a #c0841e b #eab040 c #fff2c0, fill as a 16-row hexagon pattern (a pattern has no seed, so the three variants match; if it tiles badly use speckle a .22/4, b .16/3, c .03/2). Floor 'wax-floor' f #201206 a #1a0e04 b #2a1a0a. 'amber': a drop, point up, body #ff9a1a, highlight #ffd070 upper left, shade #a85a10 lower right, one dark speck #3a2208. 'stalk-h' and 'stalk-v': a pale strand 4 pixels wide (#f4dc9a, edges #c0841e) across a full wax block, so the stalk is as wide as any block. Pip #ffb020.
Code: generation and art only. The stalk is an ordinary cut and the nugget comes loose through freed().

--------------------------------------------------------------
7. PUMICE DRIFT and ASH FLATS  (M + S)
--------------------------------------------------------------
PUMICE DRIFT (33). An open cavern of boulders that are already loose: nothing to cut, only to lasso, and quick hauls chain.
Plays: on entry every boulder lights with the blue edge. The thumb draws circles; each haul within 6 s of the last rings a note higher and pays its lump 20% more, up to double. The window is never shown as a bar.
Row: kins any, minR 170, rho 8 to 30, wobble false, shape 'drift', twist 'drift', mineral 'aerolite', lump 2.2, spec 0.9, gloom [6, 10, 22], mote [#7fd0ff, 'rise'].
Generation: everything inside is EMPTY but the boulders. A grid of period 7; a grid cell holds a boulder with chance 0.8 (seed+48), centre at the grid cell's middle +-0.8 (seed+49), radius 1.2 to 2.0 (seed+50), only if centre distance + radius + 2 <= rho (a two-cell moat). Solid where distance < radius: MINERAL within 0.9 of the centre, SOFT (pumice) otherwise. A boulder never leaves its grid cell, so a cell checks one; lanes are never under 1.4 cells.
Rule: look(), on entering a drift, registers each boulder that is still whole with pieceIn (limit 60, the pocket's box), then reelIfRound(); on leaving, pieces lying wholly in that drift are dropped from this.pieces so the list never grows. Nothing is saved. haul(): this.chain = { t, n } raises the lump (1 + 0.2 n, n to 5) and the pitch of sfx.gem.
Numbers at radius 14: about 5 boulders, 13 aerolite, 29 s flat, about 43 s chained (budget 49), gathered in about 30 s.
Art: rock 'pumice' k #2a2630 D #5a5466 L #e8e2f0 s #00000059 f #a8a0b4 a #948ca2 b #bdb6c8 c #d8d2e4; a .24/3, b .12/2, c .02/1. Floor 'pumice-floor' f #0e1420 a #0a101a b #141c2c (night blue, so the cavern reads as sky). 'aerolite': a four-point star 9 across on a small pumice knob, core #e8fbff, arms #7fd0ff, outline #2a6cc0. Pip #7fd0ff.
Check: several physical hauls at once (about 16 bits a cell with no global cap) on a phone; a tether crossing the drift on a later trip and winding a boulder by accident should read as a gift.

ASH FLATS (34). Worthless ash that cuts like air, salted with tektites: the place to draw huge freehand loops.
Row: kins ember, minR 170 and weight 1 while it is the south's herald, then minR 400 and weight 0.5 (a treat); rho 8 to 30; dig 0.2; worth 0; shape 'ash'; mineral 'tektite'; lump 0.5; spec 0.2; gloom [14, 14, 16]; mote [#d0d0d0, 'fall'].
Generation: SOFT everywhere; MINERAL where hash(x, y, seed+51) < 0.1.
Rule, fly(): in a row with dig under 0.3 a hit does not zero d.run and the drill is not pulled square on to the block (today's lines 486 and 503), or 0.05 s cells will stutter instead of plough; the mineral's dig time is scaled by the row too. CRUSHED popups are limited to one a second here.
Numbers at radius 14: about 62 tektites, 31 s in 15 to 20 s of play, about twice the model's rate, bounded by the pocket.
Art: rock 'ash' k #3a3a40 D #77777f L #f4f4f0 s #00000040 f #c4c4c0 a #b4b4b2 b #d2d2ce c #e4e4e0; a .20/6, b .14/6, c .02/3 (soft, low contrast). Floor 'ash-floor' f #1a1a1e a #151518 b #222226. 'tektite': a dark nodule 8x7 (#2a2a36), a cyan edge along the upper left rim (#8ce0ff), one white glint. Pip #d0d0d0.

------------------------- CUT LINE: everything above is one working session -------------------------

--------------------------------------------------------------
8. The tabs, WORKS, MAGNET and PRIMER  (M + M + S)
--------------------------------------------------------------
Tabs as S6. This is where specimens get a use.
MAGNET (east). Ore the bit goes through is strung on the tether instead of crushed. finishDig pushes { k, b, x, y } to S.beads (24 at most) for ORE_A, ORE_B, MINERAL, CAP, CAP_LIT, STEEL, PRISM and FOSSIL in place of the CRUSHED popup. Beads join the next haul as extra cells in payOf (counted in n and paid at its multiplier) and as sprites at the drill's end of the route. At the core they are banked directly, with a sparkle and a count, never through a haul of no cells. Beads are drawn 2x2 in the ore's colours along lay() behind the drill; when the string is full the last bead blinks red and ore is crushed as before. Bounded by the cap: about +2% grit and +7% gems on a 48 loop. Art: a horseshoe on the drill's back, a 12x12 magnet in the upgrades sheet. Saves: S.beads ??= [].
PRIMER (west). A haul of 150 x the rack's size or more racks a charge back on the drill, with a spark and a clack, up to the rack; ten times that racks two. Three lines in haul(). Art: a striker on the bomb rack. (The player judge would fold this into the BLAST row instead; see open questions.)

--------------------------------------------------------------
9. SURVEY: SCAN reworked, same row and save id 'scanner'  (M)
--------------------------------------------------------------
The dish becomes a prospector. Every 5 s a ring leaves the drill and unseen rich ore, caches and minerals within sight + 3 glint through the dark for a second. At the screen edge at most two chevrons point at the nearest things the dish knows of, icon large, distance small; the same things are dots on the map.
Levels: 0 sight 3, one chevron for the nearest pocket or wreck within 60; 1 sight 4, caches within 60; 2 sight 5, geodes too, 120; 3 sight 7, pockets by their mineral's icon, 240; 4 sight 9, plus the nearest wreck and relic at any distance, 480.
Rule: survey() runs from look() on a change of 48-cell sector and reads findSpot and zoneOf, never making a chunk and never calling k() where none exists. A find is taken when its sector is in S.taken (set when its cache cell or a geode shell cell is hauled or crushed); a spot counts only if it still generates as that find (wrecks, vaults and pockets overwrite finds).
Numbers: share 0.3 to 0.45: 28, 670, 12K, 130K grit, plus 260 frost gems on the last. One extra cache every 90 s is about +13% income, half of what BIT is priced for.
Art: a 5x5 chevron on the ui sheet; 8x8 cache, geode and pocket icons; a two-frame 16x16 glint star. The dish art per level exists.

--------------------------------------------------------------
10. The four heralds  (M each)
--------------------------------------------------------------
TINDERWORK (36, south). Coal ground laced with rings of fuse: one bite and the ring burns itself open, leaving its heart to be lassoed.
  Row: kins ember, minR 165, rho 9 to 30, shape 'rings', twist 'fuse', mineral 'fire opal', node 'fuse', nodeDig 0.1, lump 1.5, spec 0.4, gloom [20, 10, 6].
  Generation: a grid of period 14 (seed+52), each cell a ring of radius R = 3.5 to 5.5 (seed+96); under rho 12 one ring at the centre with R = rho - 4. NODE where |dist - R| < 1.2 (two cells thick, so the burnt ring can be flown at speed without biting the heart). Inside R - 2: MINERAL with chance 0.5, else SOFT.
  Rule: this.fuses, a Set stepped in updateHazards every 0.04 s: a burning cell becomes EMPTY and lights its 8 neighbouring NODE cells; one changed(batch) a tick. Lit by a cut, a bomb or lava. A ring any part of which lies past the reach ring does not light: its fuse is only cut. Each front shines 0.9 / 3.
  Numbers at radius 14: about 3 rings and 30 opals, 45 s.
  Art: rock 'tinder' k #0c0a0c D #221c1e L #6e5a52 s #00000066 f #3a3032 a #2e2628 b #463a3c c #ffb030 (c .02/2). Floor f #140e0c. 'fuse': yellow-orange grains (#ffd84a, #ff8a2a) on a dark block. 'fire opal': #ff5a3a body, #ffd070 light, #7a1e3a shade. Burn uses the 'sparks' sheet. Pip #ffb030.
LANTERN GROTTO (35, west) with LANTERN CAPS. Dull caps on cave walls light when the drill flies past, each a note up a scale, and pay triple once lit.
  Caps everywhere in mire-kin rows: a would-be SOFT cell where hash(x, y, seed+53) < 0.10 and the small-cave noise is in (T - 0.06, T], T the row's cave threshold: the rim just outside each cave.
  Rule, at the end of fly(): a CAP within 1.6 cells of the drill's middle becomes CAP_LIT (no speed gate), with world.see(x, y, 4) and the next note; five without a 2 s gap is a GLOW RUN (see radius 7 and a ring). Lit caps shine 0.8 / 5, 24 at most in view, and are drawn in the per-frame pass so lighting one repaints nothing. No wilting, and the drill's own light is not dimmed.
  The pocket: kins mire, minR 165, rho 8 to 30, shape 'grotto', kind CAP_LIT (the lump and specimens are paid on lit caps), lump 2.5, spec 0.67, dark 1.25, gloom [4, 12, 12]. Generation: open where noise(x/5, y/5, seed+13) > 0.6; a solid cell with an open 4-neighbour is CAP with chance 0.15. About 18 caps at radius 14, 45 s.
  Art: rock 'grotto' k #06100e D #12302c L #3a8a78 s #00000066 f #1c443e a #16383a b #245048 c #58f0e0 (c .01/1). Floor f #040a0a. mire-items: 'cap' (a dull teal dome #2a5a54 with dark gills, stem #8a8478) and 'cap-lit' in two frames (#58f0e0, #c8fff8, stem #e8e0d0). Pip #58f0e0.
GLAZE (37, north). Sheet ice in panes: one bite shatters a whole pane.
  Row: kins frost, minR 165, rho 6 to 30, worth 0, freeze 0, shape 'panes', twist 'pane', mineral 'starglass', lump 5, spec 1.3, gloom [5, 14, 30].
  Generation: pane = (floor(v / 2), floor((u + off) / 5)), off a hash 0 to 4 per row (seed+93); half the pockets turned (u and v swapped). A pane holds one MINERAL at a hashed cell with chance 0.15 (seed+94).
  Rule: digDur = 0.4 / SPEED; finishDig opens every other cell of the pane that is inside reach and in the pocket, with a shatter on each, and leaves a mineral cell standing: only biting the mineral cell itself crushes it. foresee passes the pane as the open set so the pane and what it frees glow first. Needs S2.
  Numbers at radius 14: 62 panes, about 9 starglass, 46 s. The ice pays nothing, or pane-breaking would run at four times the model.
  Art: rock 'glaze' k #0a1830 D #1e4a7a L #c8f4ff s #06102659 f #3a78b0 a #326ca4 b #4686bc c #a8fff0 (all at size 7, low amounts: smooth). Floor f #081424. Pane seams as a dark and a light pixel line in paint() where the neighbour's pane differs. 'starglass': #ffffff, #a8fff0, #30c8c0. Pip #a8fff0.
SHALE STACK (38, east). Banded shale that splits along the grain: with the grain one bite sends a plank of up to four cells away; across it, the cut is ordinary.
  Row: kins lode, minR 165, rho 6 to 30, shape 'shale', twist 'plank', mineral 'agate', lump 1.0, spec 0.33, gloom [20, 16, 8]. Grain is level only (one sheet).
  Generation: SOFT; rows with hash(row, seed+95) < 0.12 hold a seam: MINERAL where noise(u / 6, row, seed+95) > 0.5, in runs of 4 to 12.
  Rule, finishDig: when the cut cell was entered along the grain, also open up to three SOFT cells beyond it in the same row (stopping at a mineral, the pocket's edge or the reach ring), chips streaking along the grain.
  Numbers at radius 14: about 37 agate, 37 s.
  Art: rock 'shale' k #1c1a14 D #4a4636 L #c8c0a0 s #00000059 f #7c765c, fill as a 16-row pattern of level stripes in a #6a644c and b #908a6c, bold. Floor f #18160e. 'agate': banded #e85a3a, #ffd8a0, #7a2a1a. Pip #e85a3a.
When each lands, its herald spot switches to it (in ground not yet made).

--------------------------------------------------------------
11. Flank pockets  (S)   Section 4.
--------------------------------------------------------------

--------------------------------------------------------------
12. Four seam biomes and the reactions table  (L; ship Hoarstone and Glassdune first)
--------------------------------------------------------------
Hand-made hybrids on the four diagonals (placement in S3), each with both parents' hazards and one interplay.
  9  HOARSTONE (north-east): kin frost, gemA frost, gemB lode; haz spark 1; freeze 30; slate 0.05; extras ['ribs']. rich 1.25.
  10 GLASSDUNE (south-east): kin lode, gemA lode, gemB ember; haz spark 1; haz2 lava t 0.78; glass true; extras ['slag']. rich 1.25.
  11 CINDERFEN (south-west): kin ember, gemA ember, gemB mire; haz lava t 0.78; haz2 spore 1; cave 0.74; extras ['slag']. rich 1.25.
  12 FROSTFEN (north-west): kin mire, gemA mire, gemB frost; haz spore 1; freeze 30; cave 0.68, cavern 0.7. rich 1.25.
  13-16: the same with oreA 0.6, oreB 0.66, hazard rates 1.8 (lava t 0.72), rich 2, gemx 2, same sheets.
Reactions, keyed by the pair of traits present in the cell's row and never by biome, so generated crosses get them free:
  spark + freeze: an arc clears every ICE cell within 3 (the spark reopens a frozen cut).
  spark + lava:   an arc wakes lava pockets within 3; in a row with glass, lava sets as GLASS (0.12 s) and spent flows become fast roads.
  lava + spore:   lava touching a pod bursts it and the cloud burns: no moss grows back.
  spore + freeze: a burst pod's cloud sets at once as a ring of ICE in place of the slow moss, never on the drill's cell, beside the drill or under the tether.
  lava + freeze (crosses only): lava touching ICE melts it.
  spore + spark (crosses only): an arc bursts pods within 3.
One guaranteed interplay where each seam begins, a fixed set piece at the diagonal point r 150: a crystal ringed by ice; a crystal two cells from a lava pocket; a lava pocket two cells from a pod; a pod in an open cave.
Art, four rocks and four floors:
  hoarstone k #2e2c36 D #6e6c74 L #f4fbff s #06081059 f #b9b8b0 a #a4a39c b #cfd0cc c #e8fbff; floor f #22242e a #1c1e26 b #2c2e3a
  glassdune k #1c0e0a D #5c3a1c L #f0c070 s #00000066 f #a8743a a #94642e b #bc8848 c #2a2030; floor f #2e1c10 a #26160c b #3c2616
  cinderfen k #120a10 D #2a1c22 L #b06a4a s #00000066 f #4a3438 a #3c2a2e b #5c4244 c #9ad062; floor f #1c1014 a #160c10 b #281820
  frostfen  k #14262a D #3e6a68 L #e0fff4 s #02101a59 f #7aa8a0 a #689690 b #92bcb0 c #b4e878; floor f #14282c a #102024 b #1c3438
  'glass' rock: k #1c0e0a D #3a2a40 L #c8b8e8 s #00000066 f #5a4a70 a #4a3c60 b #6e5c88 c #f0e0ff (smooth, size 6).
Code: biomeAt's seam test, eight rows, the reactions in zap(), trigger(), the lava loop and the cloud loop.

--------------------------------------------------------------
13. RAM that rams, then LAUNCH, then RELAY  (M, S, M)
--------------------------------------------------------------
RAM (same row). A run-up punches through plain ground. Hold a straight drag for a second or more and the nose lights; driven into rock the drill goes through block after block until the charge is spent.
  Budget in seconds of base dig time at full charge (3 s of run, in proportion from 1 s): 0, 0.5, 1.2, 2.4, 4.0, so soft 0/2/5/10/16 blocks, slate 0/0/1/2/4.
  Rules from both judges: it breaks only SOFT, DENSE, SLATE, VAULT, ICE, BASALT, GLASS and FAULT, and stops dead at ore, minerals, finds, hazards, and any cell with a hazard beside it. It ends the instant the thumb lifts or turns more than 30 degrees from the heading held when it charged. The first punched cell squares the drill to its row. The core's throw punches only if the thumb is still held on that heading when the drill lands. One finishDig a frame.
  Numbers: at most +8% late and +10% at reach 40. Share 0.4 to 0.5: 90, 2.9K, 40K, 200K grit, plus 340 lode gems.
  Art: a three-frame 16x16 cone of light ahead of the bit on the drill sheet, shown in the shop preview.
LAUNCH (south). A second button stacked tight above the bomb, sharing the rack. Tap it and the drill crouches; the next fresh stroke is the core's throw from where it stands: fling() generalised to start anywhere, straight along the stroke to the first rock, then a punch of max(1.5, 1.5 x RAM's budget) if the thumb is still held. Not "full run": it behaves like the throw already learnt. Art: a 12x12 launch icon, a nozzle band on the drill.
RELAY (north, candidate). The core's throw runs the last trip's line: a throw aimed within 20 degrees of where the last tether left goes on, span by span, down the saved line while the thumb stays held, stopping at the first blocked span or the moment the thumb lifts. Build last, behind test/rope-fuzz.mjs, and only if the owner wants it.

--------------------------------------------------------------
14. Fault seams  (M)
--------------------------------------------------------------
A hairline crack through the rock: cut one cell and the break races along the whole seam, cutting a side of your loop for you.
Generation, in districts (noise(x/90, y/90, seed+91) > 0.55, r > 60), on would-be SOFT or DENSE cells: with f = noise(x/14, y/14, seed+90) - 0.5, the cell is FAULT where the sign of f differs from the cell to its right or the cell below. (The band rule first proposed marks 13.8% of cells in a thick mesh; the sign change gives a true one-cell line.)
Rule: a `zips` queue in updateHazards opens 8-connected FAULT cells at 25 a second, 60 at most a trigger, never past the reach ring, with a rising arpeggio and one changed(batch) a frame; set off by a cut, a bomb, an arc or lava. foresee passes the whole seam as the open set, since the plan is the fun. It only ever opens plain ground.
Numbers: FAULT grit 1, dig 0.12. Up to one loop side in four saved inside districts: about +12% averaged over a third of the ground.
Art: an overlay 'fault-0' to 'fault-15' by which of the four neighbours are fault, a light line (#fff2c0) with a dark lip, so it reads as one continuous bright line across cells.

--------------------------------------------------------------
15. Feedback on what already happens  (S each; a day for all)
--------------------------------------------------------------
In this order: the crawling blue edge of a loose piece turns gold in proportion to how far round it the rope has gone; the worth of what the glow would free, beside it ('~1.2K', from payOf, so it cannot lie); the reach ring grows from old to new on buying REACH, on the map too; a blue arrow at the screen edge to a loose piece waiting off screen; each cut within half a second of the last raises sfx.dig a step; CRUSHED shows the loss in red; named banners ('GEODE!', 'PURE VEIN', 'FOUR WINDS', 'BEST HAUL'); rubble clacks at a bend and chimes as it passes things on its way home. The reach whine, if added, very quiet. All game.js.

--------------------------------------------------------------
16. More hand-made pockets  (S to M each)
--------------------------------------------------------------
ECHO VEIN (39). A mirrored pocket where every cut is answered across the seam: cut once, haul twice. kins any, minR 400, rho 6 to 8, wobble false. Kinds from (u, |v|); the row v = 0 is EMPTY; MINERAL in 2x2 clusters where noise(u/3, |v|/3, seed+54) > 0.72. finishDig also opens (x, 2cy - y) when it is solid, in the same pocket and within reach, and is not a mineral (minerals are left standing); changed([i, twin]); a twin of the drill at 40% for 0.2 s; the camera eases halfway to the seam while inside so the twin is on screen. lump 0.8; about 28 'twinstone' at radius 8, 22 s (budget 28). Rock 'echo' k #201830 D #5a4a80 L #f4eaff f #b8a8dc a #a898cc b #ccbcec; floor f #140e22; mineral a two-lobed crystal, #ff8ad0 and #8ad0ff. Pip #f0b0ff.
SALT GARDEN (40). The one place where drilling through the special cell is right. kins lode and frost, minR 400 (after 'drilling crushes' is learnt), rho 6 to 30. NODE seeds where hash(x, y, seed+92) < 0.035, no two adjacent. Drilled, a seed says BLOOM: its soft 4-neighbours become MINERAL at once and their soft neighbours with chance 0.5 after 0.25 s, never the cell the drill is about to enter; version bumped. Solidity never changes. A seed hauled undrilled pays one bloom. lump 0.4; about 126 bloom at radius 14, 50 s. Rock 'halite' k #5a2a3a D #c07a8c L #ffffff f #f0c4cc a #e4b0bc b #f8d8dc; floor f #2a141c; node a rose cube (#ff6a9a, #ffd0e0) that pulses when the drill faces it and looks nothing like ore; mineral a white cube cluster (#ffffff, #ffd0e0, #d88aa0). Pip #ff9ab8.
OLD WORKS (41). The cobble field dressed as an older machine's mine: the same lattice function at period 9 (7x7 blocks, galleries two wide), each block tied east or south by a two-cell NODE brace (dig 0.6, shines 0.4 / 2), a 2x2 MINERAL crate at the block's middle with chance 0.5. kins any, minR 700, rho 14 to 30, lump 2.0; about 31 ingots at radius 20, 62 s (budget 70). Rock 'works' k #14161a D #3a4048 L #a8b0b8 f #5c646e, fill as brick courses, c #c8442a rust; floor f #101216; node an iron beam (#8e98ac, #e2e8f4, #565e72); mineral stacked bars (#ffd84a, #fff2a0, #b0803a). Pip #ffd84a.
SLAB GARDEN (42). Three to five keystone slabs of p 6 to 8 packed in one pocket of radius 24 to 30, in its own pale stone with rich ore inside (oreB +0.1); no mineral, it pays by haul size. kins any, minR 300. Rock 'garden' k #20241c D #4e5644 L #d4dcc0 f #868e74 a #747c64 b #98a084 c #e8f0d0.

--------------------------------------------------------------
17. Twin stones, then Fossil  (M each)
--------------------------------------------------------------
TWIN STONES, findAt [0.74, 0.80): two halves of a sigil 7 to 16 cells apart, both answering from one sector. A faint line through the rock joins them while either is on screen. Both in one haul: round2(income(max(22, far)) * 20). One alone is banked on the core where it can be seen waiting (S.twins ??= {}), never called a failure, and its twin later pays * 10. Art: two 12x12 halves of a carved disc in worn gold on dark stone that visibly fit.
FOSSIL, findAt [0.80, 0.86): a chain of 4 to 7 bones. Bones take 1.0 s and crack, so a brush never breaks one; seeing one reveals the chain; pay is 1 s of income a bone always, tripled when every bone comes home in one haul. Art: skull, vertebra, tail (#f0e8d0, #b8a888).
If Fossil is liked, a BONE YARD pocket reuses its kind and counting.

--------------------------------------------------------------
18. Last, and only behind tests
--------------------------------------------------------------
CHALK DOWNS (43): ground the rope itself cuts, with nuggets renamed CHERT. First add a chalk pocket to test/rope-fuzz.mjs and run it; batch crumbles into one changed() a tick; ease the rope's straightening over a few frames with dust at the corner; use the light haul. Build only if the fuzz is clean.
WORM LOAM (Gritworm, pocket only): hearing = scanner sight - 1 and never more than 4; it shows through rock when awake; never leaves the reach ring; tires after 6 cells; pays 15 s.
A COLLECTION page as a third tab (each mineral and find, dark until seen, no pay) once there are eight or more to show.


==============================================================
3. THE CUT LINE
==============================================================

ONE SESSION: systems S1 to S5, then items 1 to 7: eight hand strains; slag and steel, crackling ribs, vein frost; the cross generator; SIFT CHARGE; keystone slabs with Prism; the pocket scaffold with Amber Hive; Pumice Drift and Ash Flats. That is 8 hand-made biomes, 3 hand-made pockets, slabs, and 60 generated rows. If time runs short, Prism and Ash Flats slip first; the generator does not, since it is what was asked for today.

AFTER, in order: 8 tabs with MAGNET and PRIMER; 9 SURVEY; 10 the four heralds; 11 flank pockets; 12 seams and reactions; 13 RAM, LAUNCH, RELAY; 14 fault seams; 15 feedback; 16 Echo Vein, Salt Garden, Old Works, Slab Garden; 17 twins and fossil; 18 Chalk Downs, Worm Loam, the collection page.

CUT, by name:
- SLIPSTREAM: the drill is always beside its own tether, so the boost fires in ordinary flight, and full run round corners sticks.
- BOOM: tunnels refused because the arm points elsewhere read as the false "tether out" the owner already threw out.
- Specimen cabinet's +5% sets: a plain bigger number; its tab strip is kept for WORKS.
- Eleven mineral currencies, and flint hearts in findAt: replaced by one specimen count per direction fed by pockets.
- The strain generator's STILL and WILD tempers and hue-shifted sheets: hazard rates and 12 degrees of hue are not noticed; replaced by crosses.
- Old Works as its own generator: its braces left clusters floating; it returns as the cobble field's dressed pocket.
- Fossil Bed: a minute-long cut for one all-or-little reward; the small Fossil first.
- Glowcap wilting and the dimmed drill light: a punishment; merged into Lantern caps.
- Obsidian and Chalk as strain names: Obsidian became Forge (a tell, not thresholds), Chalk became Loess (the name clashed).
- Capstan posts: fiddly to wrap, invisible pay, and a "held" rule inside freed().
- Creeper moss: waiting, and ground that plugs the player's tunnels.
- Dowsing stones: SURVEY gives the arrow without muddying "drilling crushes".
- Drift pearls: pay by where a long rope happens to lie reads as luck; only the chime is kept.
- Shatterfield and Pearl Gallery: duplicates of the cobble field and the cut pearls.
- Hint text on plates and rule lines on callouts: tutorial text; names only.
- Distance records: number spam.
- The ORDERS board, flywheel streaks, cryo charge, pitons, gem exchange and the rest the designers already rejected stay rejected.


==============================================================
4. THE HAND-MADE LIST IN FULL, AND THE RULE THAT GENERATES THE REST
==============================================================

HAND-MADE BIOMES (21 rows, 13 places beyond today's nine)
  Today: crust; frost, ember, mire, lode; rime, magma, bloom, gilt.
  North strains: FIRN (massive, frozen rivers, slow freeze), SERAC (brittle lanes, fast freeze).
  South strains: SCORIA (bubbles, less lava), FORGE (slag fields, more lava).
  West strains: TANGLE (great caves, thin bridges), SPOREFALL (pods in grapes).
  East strains: REDROCK (level slate strata studded with crystals), LOESS (half the cutting time, poor: the fast road).
  Seams: HOARSTONE (ice and sandstone; the spark reopens frozen cuts), GLASSDUNE (sandstone and basalt; arcs wake lava, which sets as glass roads), CINDERFEN (basalt and mire; lava burns pods and their moss), FROSTFEN (mire and ice; a pod's cloud sets as an ice ring), each with a deep kind.
  Minerals of the biomes: the four gems, with oreA paying the first parent and oreB the second in seams; steel (ember gems) wherever there is lava; lantern caps (mire gems) on every mire cave rim.

HAND-MADE POCKETS (12) and what lies in open ground
  Amber Hive (west): wax lattice; AMBER nuggets on stalks; snip and swirl.
  Pumice Drift (any): loose boulders; AEROLITE; lasso only, chained hauls.
  Ash Flats (south): ash that cuts like air; TEKTITE; huge freehand loops.
  Lantern Grotto (west herald): dark cave; GLOWCAPS lit by flying past.
  Tinderwork (south herald): fuse rings that burn themselves open; FIRE OPAL.
  Glaze (north herald): panes that shatter whole; STARGLASS.
  Shale Stack (east herald): planks along the grain; AGATE ribbons.
  Echo Vein (any, from 400): mirrored cuts; TWINSTONE.
  Salt Garden (east and north, from 400): seeds that bloom when drilled; BLOOM SALT.
  Old Works (any, from 700): braced blocks and galleries; INGOTS.
  Slab Garden (any, from 300): packed keystone slabs; pays by size.
  Chalk Downs (any, last): the rope cuts chalk; CHERT.
  In ordinary ground: keystone slabs and cobble fields, fault seams, geodes, caches, prisms, twin stones, fossils, eight wrecks, four relics.
  Rules every pocket keeps: one twist at most; nothing regrows, closes, pushes or steers; every cell is cuttable; special cells are drawn as full blocks; lights go through shine(); the mineral pays a lump within 3.5 x radius seconds and about 12 specimens.

THE RULE THAT GENERATES THE REST

(a) Crosses: host x donor x structure, 60 rows.
  host: one of the four direction rows (1 to 4). It gives the ground's ramp, floor, motes, ore rules, its own hazard at full rate, and gemA.
  donor: one of the other three. It gives gemB (rich ore pays the donor's gem) and its trait at 0.6 strength as the second hazard: frost freeze 30; ember haz2 lava t 0.80 with the slag rind; mire haz2 spore rate 0.6; lode haz2 spark rate 0.6 with rib crystals where the host has slate. The reactions table of item 12 applies to the pair.
  structure: 0 plain; 1 HOLLOW (cavern 0.62, Tangle's); 2 CRAZED (Serac's lanes of ICE; only where host or donor is frost, otherwise plain); 3 FROTHY (Scoria's bubbles); 4 BANDED (Redrock's strata).
  Pay: rich 1.25 (1 + 0.4 x 0.6), gemx 1; hazards pay their own kin's gem. Closed under mixing: no cross needs a new currency, HUD slot or shop row.
  Where: provinces past rc 500, share clamp((rc - 500) / 2500, 0, 0.35), never in deep flanks (S3). Hand-made ground is always at least 65%.
  Coherence rules: 1 the host's ramp is kept, so colour always tells the first gem; 2 one donor trait and one structure at most; 3 hazard sprites never recolour; 4 a pair whose sheet fails review by eye is switched off in CROSS_OK and its provinces fall back to the parent.
  Art, at build time only, never tinted at run time: cross(host, donor) in art/tiles.mjs makes 12 rock sheets 'x-<host>-<donor>' from the host's palette with c = the donor's accent (frost #e8fbff, ember #ff8a3a, mire #b4e878, lode #ffe08a) and b = the host's b mixed 35% toward the donor's f (frost #bcd8ee, ember #74403a, mire #665478, lode #b98a5a); speckle a .20 at the host's size, b .18/4, c .07/2. Floors are the host's. Map colour is the host's f mixed 30% toward the donor's f, so provinces show as patches. Each is drawn with art/preview.py and judged beside its host on a phone-sized view; if it does not read apart, raise c to .10 and the mix to 50%, and if it still does not, switch the pair off.
  Names, a handwritten table of twelve, with the structure as a first word when not plain (HOLLOW, CRAZED, FROTHY, BANDED), 20 characters at most:
    frost host: with ember THAW, with mire TUNDRA, with lode HAILSTONE
    ember host: with frost QUENCH, with mire SOOTFEN, with lode FLASHROCK
    mire host:  with frost RIMEMOSS, with ember SMOULDER, with lode BUZZMIRE
    lode host:  with frost HOARSAND, with ember KILNSTONE, with mire MOULDSTONE
  Code: crossRow(host, donor, structure) builds the 60 rows at load at their fixed ids; biomeAt picks them.

(b) Flank pockets: pocket shape x deep flank, up to 48 rows, no new art.
  In a deep flank half the pockets are the hand-made type's flank row: the same shape, twist, mineral and node, with walls and floor in the flank's own sheet (rime, magma, bloom, gilt), specimens doubled, lumps unchanged (they already rise with distance). Named flank + shape: RIME HIVE, MAGMA DRIFT, GILT WORKS, BLOOM RINGS. id = 192 + (pocketId - 32) * 4 + (flank - 5).

Both rules only recombine parts made by hand, so every new hand-made strain structure or pocket shape later widens the generated set by itself: a new structure is a sixth value of the structure axis (a new id block, never a renumbering), a new pocket gets its four flank rows from its id.

MODEL CHECK for all of it: tools/ground-worth.mjs samples 20,000 cells in each ring (r 200, 400, 700, 1,000, 1,500, 2,000) and direction through biomeAt and kindAt and prints the mean of GRIT x rich x worth per solid cell, the share of each row, and the change against rows 0 to 8 alone. Expected: strains about +3%, crosses at most +9% far out, pockets +3%, slabs +1.6%. Past 15% in any ring, set WORTH to the sampled figure.


==============================================================
5. SAVES, AND THE OWNER'S RULES CHECKED
==============================================================

Save fields, all defaulted on restore as S.wrecks is: S.spec ??= [0, 0, 0, 0, 0]; S.met ??= {}; S.marks ??= []; S.visited ??= {}; later S.mods ??= {}, S.beads ??= [], S.taken ??= {}, S.twins ??= {}. Upgrade ids do not change ('scanner', 'bombs', 'momentum' keep their levels under new names). SAVE_KEY stays v3. Not saved: fuses, zips, chain, registered drift boulders, the place plate.

Rules checked against the owner's list: drag is the only movement control and nothing here steers, pulls or pushes the drill (the punch and launch only continue the heading the thumb holds, and stop when it lifts or turns); HUD taps only for the bomb, LAUNCH and shop tabs; nothing is unminable (every new kind has hard 1) and nothing regrows inside a pocket; freeze and moss still never close over the drill or the tether; reach is untouched; a refused fuse says REACH on the spot; special cells are full blocks; lights spread through shine(); every upgrade change is visible (sift leaves ore hanging, the punch has a cone, survey has chevrons, magnet has beads, each WORKS row a part on the drill); no tutorial text was added; tether geometry is touched by nothing before Chalk Downs and RELAY, both gated on the fuzz.


==============================================================
6. OPEN QUESTIONS FOR THE OWNER (each with the default the engineer builds on)
==============================================================

1. One specimen count per direction, or one pooled count? Default: per direction (four), since it gives each direction's pockets a purpose and needs no HUD slot. Pooled is a two-line change.
2. Specimens have nothing to buy until the tabs land (first item after the cut line); in session one they only count and pay lumps. Default: ship counting now.
3. PRIMER: its own WORKS row bought in the west (builder), or folded into BLAST from level 2 (player)? Default: own row, threshold 150 x rack size.
4. The north's unlock: RELAY (the throw runs the last trip's line) is a candidate that touches fast flight along the tether. Default: build the other three, leave north's specimens paying lumps, decide after playing.
5. Old saves get new places only in ground not yet seen, with possible cut-off edges where a place meets explored ground. Default: accept; NEW gives the whole new world.
6. A place's name as a title card on first meeting is text on screen (a name, never a rule). Default: keep it, names only.
7. Lantern caps light on any pass (player) or only after a run-up (builder)? Default: any pass; the GLOW RUN of five rewards speed.
8. Ash Flats and chained Drift hauls pay up to twice the model's rate while inside a pocket. Default: accept, bounded by the 3.5 x radius budget and 2.4% cover.
9. Generated ground: at most 35% of non-deep provinces, from r 500. Default as stated; one constant each to change.
10. All names here (strains, seams, pockets, minerals, the twelve cross nouns) are working names in one table. Default: use them until the owner renames.
11. Session one adds about 26 terrain sheets (8 strains, 3 pockets with floors, 12 crosses), each its own image request of about 2.4 KB. Default: ship unpacked and pack into one atlas when the count passes 60.