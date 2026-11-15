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

S1 AS BUILT (read this with the above; where they differ, this is the code):
- Rows are made with biome({ id, name, ... }) in world.js, which fills in what is left out and makes row.lay, the thresholds as kindAt reads them. A row must give gloom, mote, map and debris; sheet, floor and items default to name, name-floor and the kin's items sheet. Rows also carry `items` (the sheet of dense rock and ore), which the row shape above leaves out.
- rowOf(b) is the row of a ground's number (the home ground's for a number with no row); world.row(i) the row of a cell; hazOf(k, row) and world.hazAt(i) the hazard type of a cell ('lava', 'spore', 'spark' or null); gemKin(k, row); digTime(k, row). HAZARDS has each type's kin, sheet and share (HAZ_SHEET above is HAZARDS[type].sheet).
- kindAt keeps the order the code had when this was built, which is the plan's order backwards with the first that holds settling the cell (great caverns, small caves, vault, slate, hazard, second hazard, ore B, ore A, dense): the same ground, asked more cheaply. Extras, pockets and slabs have no hook in it yet.
- game.overlay(k, row) returns [sheet, frame] or null and itemSheet is gone; game.debris(k, b) gives a cell's chip colours and chips() takes the colours; the depth of the dark is game.murk, eased to row.dark.
- Noise layers are numbered 0 to 127 (a layer added to the seed is its own number): pass the number as the fourth argument, as kindAt does.
- The check: `node tools/world-hash.mjs --check` against test/world-hash.txt (96 lines), held by test/regress/s1-world-hash.mjs. An item that lays new ground on purpose records the lines again with --write and says so.

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

S2 AS BUILT (read this with the above; where they differ, this is the code):
- World.freed was reworked by the hunt's second pass before this was built: it walks outlines and floods nothing, and already took a list of cuts and an `open` set. What was missing is in: walks begin from the sides of the cells taken as open as well as from the cuts', so ground that hung only on a pane, a crack or a punched cell is found. Game.foresee(i, also = []) passes `also` as the open set and the glow holds those cells with what they free.
- Game.payOf(cells, extra = []) returns { n, grit, gems, lump, spec, minerals, mineral, prisms, shine, relic, caches, parts, wrecks, mult, over }: as the plan lists, with `mineral` (the name in the row's pocket, for an icon), `shine` (what prisms multiply gems by) and `wrecks` (which wrecks the parts are of: the haul marks them held, payOf does not). `extra` is a list of { k, b, x, y }. Specimens go to `world.zoneOf(sx, sy)?.kin`, or the row's kin where the sector has no pocket on record. They are counted and not banked: S.spec is S4's.
- A chain is Game.chain = { t, n }: a haul within CHAIN (8) seconds of the one before is a link, n is how many hauls the chain holds, and payOf raises a pocket mineral's lump by a fifth for each haul before this one, to five. In a chain no rubble breaks finer than 2 x 2 to a cell. Any haul is a link, light or not. The eight seconds are a first figure for whoever builds Pumice Drift.
- Game.hauled is what the last haul was and paid ({ title, n, mult, over, grit, gems, light }); Game.banner is that same record when the haul was not light. The tests that read the banner as the record of a haul read `hauled`.
- The light haul's popup has the grit icon, and one more for each direction's gems it paid. The mineral's own icon waits for the minerals sheet (content item 6).
- World.ZONE (128) and World.zoneOf(sx, sy), which says null for every sector until S3 lays pockets, are in world.js so that payOf and the place plate have one thing to ask.

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

S3 AS BUILT, THE PROVINCE PART (read this with the above; where they differ, this is the code). Pockets (zoneOf), seams and slabs are not laid yet: their places in the order are marked in biomeAt's comment. Crosses are laid since content item 3 (see ITEM 3 AS BUILT): what is said of them below is how it stood before.
- World.biomeAt asks in the plan's order: (1 a pocket, not laid), 2 the home ground, 3 the direction, (4 a seam, not laid), 5 a deep flank, 6 the province, 7 the direction's own ground. Past the world's edge no province is asked for.
- A province is PROVINCE (256) cells across on borders that wander with the directions' own long sweeps: px = floor((dx + (n1 - 0.5) * 120) / 256), py likewise with n2. World.province(px, py, kin) says what the ground of direction `kin` is there and keeps the answer (a byte for each province and direction, forgotten when the seed changes). The four provinces round the core are never asked: their middles are 181 cells out, under the 220 the plan sets. So strains begin 200 to 320 cells out, depending on the sweep.
- By hash(px, py, seed + 55): under X = clamp((rc - 500) / 2500, 0, 0.35) the province is kept for a cross and is the direction's own ground until crosses are built (seeds 56 and 57 are kept for them); under X + (1 - X) * 2/3 it is the strain of the direction with the largest hash(px, py, seed + 300 + id); else the direction's own. The strains of a direction are whatever rows 17 to 31 have its kin (STRAINS, filled by biome()).
- World.biomeKnown(x, y) is the stored byte where the piece is made and biomeAt where it is not, and makes nothing; drawMap reads it for every cell. The pips for pockets wait for pockets.
- The finds' bands are one table, FINDS = [[0.38, 'geode'], [0.70, 'cache'], [0.74, 'prism'], [0.80, 'twin'], [0.86, 'fossil']]. World.find works out the sector's middle for all five (a prism only where its middle is over 130 cells out, none within 16), findSpot names all five, and findAt lays only geodes and caches: whoever builds a prism, twin stones or a fossil adds its cells there. findSpot does not yet say null inside a pocket.
- Tests: s3-provinces (the order, the shares, each strain in its own direction, a strain added later), s3-find-bands, s3-biome-known. test/regress/w-same-world.mjs, the plain reading of the ground, now has the provinces and the strains written out in it as plainly as the rest, so it holds them cell for cell; 38 of the 96 hashed pieces moved and were recorded again (none at the core; the pieces 200 out to the east and south reach into the next province).

S3 AS BUILT, POCKETS (read this with "Pockets" and "The map" above; where they differ, this is the code). Built with content item 6; counted with tools/zone-budget.mjs, held by test/regress/s3-pockets.mjs and s3-pocket-pips.mjs.
- A pocket's ground is a row made with pocket(id, name, { ..., pocket: { shape, kins, minR, rho, weight, wobble, mineral, kind, node, nodeDig, lump, spec, chain, pip, chips } }) in js/world.js, with no thresholds of its own; grounds 32 to 63 that name a shape are what a sector may choose among. What lays a shape is a rule of POCKET_SHAPES: reach(rho), how far from its middle a cell of such a pocket can lie; has(Z, ex, ey), where the shape has an edge of its own (left out: a disc, wandering by layer 44 unless the row says `wobble: false`); cell(seed, Z, x, y), what a cell is.
- World.zoneOf(sx, sy) is as the plan has it, worked out once for a sector and kept, with the record { key, row, cx, cy, rho, kin, reach, shape, mineral, wobble, herald } (key 'z' + the sector). World.pocketOf(x, y) is the pocket of a cell's sector with the last sector kept, World.inPocket(Z, x, y) whether a cell is that pocket's, World.pocketCell(Z, x, y) what it is, World.zone(row, cx, cy, rho, kin) a record made by hand (for tools and tests), World.pocketsWithin(far) a world's pockets nearest the core first.
- biomeAt asks for a pocket first, of cells over 130 cells out (the plan says 150; nothing lies between). kindAt lays a pocket's cells straight after the wrecks and asks nothing else of them. A cell that holds a pocket's ground where the world would lay none (a saved game's may) is plain rock of it.
- Heralds: 165 out and 14 aside, radius 9, as planned; and 40 cells further out where a wreck lies within 24 cells of that (8 heralds of 240 on sixty worlds), which the plan does not say. What kind each is: the first of its list that has a row (HERALDS: north glaze, drift, hive; south tinderwork, ash, hive; west grotto, hive; east shale, drift, hive). Only the hive has a row yet, so all four are hives today, and each direction has a pocket inside the sixth reach. When Pumice Drift and Ash Flats get their rows (33, 34) the north's, the east's and the south's heralds become those by themselves: the pieces round those three heralds will then move, on purpose.
- No pocket's middle lies under 170 cells out or so far out that the last reach does not go round it (the plan does not say the second).
- Finds and slabs keep clear: World.find gives a sector nothing where its find's middle is within 5 cells of where a pocket's cells can lie, so findAt lays nothing there and findSpot says null; World.meetsPocket(cx, cy, reach) is now true to the record's own `reach` and asks every sector within that and POCKET_MOST (36). Of 2,037 slabs tried on 12 worlds 70 are refused for a pocket, with pockets in the west alone; with pockets in every direction it will be about four times that, one slab in seven.
- The map: Game.pocketPips() is the list (pockets within reach, not visited, whose middle's ground is the pocket's as far as is known, the 24 nearest the drill), made again when the drill comes into another sector, the reach changes or a pocket is visited. Every such pocket has a pip, whether or not it is big enough to show as a patch of its own colour; a pip is two pixels of the pocket's `pip` colour on four of dark.
- Counts, 8 worlds, hives alone (they lie only in the west, and the heralds): 4.6 pockets within reach 230, 6.3 within 420, 16.9 within 750, 44.6 within 1,350, 123.8 within 2,300; 0.65% of the ground. The plan's figures (6, 14, 51, 172, 505; 2.4%) are for pockets of every direction.
- Flank pockets (seed 97) are not built: item 11.
- test/regress/w-same-world.mjs has pockets and the hive in its plain reading; 7 of the 96 hashed pieces moved and were recorded again, all in the west.
- Since content item 7 (see ITEM 7 AS BUILT): Pumice Drift (33) and Ash Flats (34) have rows, so the north's and the east's heralds are drifts and the south's an ash flat, as planned, and pockets lie in every direction: the north's and the east's are all drifts, the south's drifts or ash flats and the west's hives or drifts, whichever kind's hash for the sector is the larger (so the west has half the hives it had). Counts, 8 worlds: 6.1 pockets within reach 230, 15.3 within 420, 53.4 within 750, 166 within 1,350, 479 within 2,300 (360 drifts, 58 hives, 62 ash flats); 2.39% of the ground. A cobble field keeps clear of a pocket by as far as its own collar runs (its radius and six cells and a half, where a slab's is five): its collar ran a cell and a half into a pocket that lay just clear of a slab's, which showed as open cells of collar once a pocket could be open ground. 22 of the 96 hashed pieces moved and were recorded again, none at the core.

--------------------------------------------------------------
S4. The resource set
--------------------------------------------------------------

- Grit, and the four gems, as now. Gems buy levels.
- SPECIMENS, one count per direction: S.spec = [0, north, south, west, east] indexed by kin like S.gems. A pocket mineral cell hauled adds the pocket's `spec` (a fraction; shown floored) to the count of zone.kin, twice that in a flank pocket. Never multiplied by richness, winch or parts, so the numbers stay human: every pocket type is tuned to about 12 specimens at radius 14. They buy the one-off unlocks on the WORKS tab (12, 12, 12 and 30). A future unlock names the direction it is bought in; a future pocket or generated place needs no new currency.
- LUMPS: a mineral cell pays round2(income(max(22, far)) * lump seconds), the form of the cache line. Budget for every pocket type: mean mineral cells * lump <= 3.5 * radius seconds of income (49 s at radius 14; that is 15% of the next reach at reach 230, 12% at 750). tools/zone-budget.mjs (pure) makes 200 pockets of each type and prints mean mineral cells, seconds against the budget, specimens against 12, and the pay rate while inside against the model's. The lumps and spec values in section 2 are first figures to be set by that script.
- HUD: no permanent slot. When specimens are banked a line slides out under the top panel for 3 s: the specimen icon in the direction's gem colour and the count, with "/need" while an unlock in that direction is unbought. The haul banner's third line gains the mineral's icon and +n.

Model: pockets cover 2.4% of the ground and pay 1.3 to 2 times the model's rate while inside, about +3% in all; nothing is repriced.

S4 AS BUILT (read this with the above; where they differ, this is the code). Held by test/regress/s4-specimens.mjs and s4-budget.mjs.
- S.spec is made in fresh() and defaulted in restore(). haul() banks what payOf said (built with S2), a fraction a cell, to the direction of the pocket's record. `hauled.spec` is how far the whole count rose and `hauled.specOf` whose.
- A pocket's lump rises in a chain of hauls only where its row says `chain: true` (S2 built it for every pocket; it is Pumice Drift's twist, and the hive's figures have none).
- The line: Game.specLine = { kin, t, life }, three seconds, drawn as a small panel at (4, 60), under where a place's plate goes: a specimen icon in the direction's colour ('spec-frost', 'spec-ember', 'spec-mire', 'spec-lode', added to the icons sheet on the code track: one six-sided cut stone drawn once, in each direction's three colours) and the whole count. Game.specNeed(kin) is what "/need" will read; it is 0 until the WORKS tab sells something.
- A light haul (a nugget is one) has no banner, so it says it where it lay: what it paid with the mineral's own picture beside it in place of the grit's icon, and under that '+n' with the specimen icon when the whole count rose. A haul with a banner has the mineral's picture and '+n' at the end of the line of what it paid (Game.bannerSays(b)[2]).
- tools/zone-budget.mjs is as planned (pure but for --play, which plays hives through the test harness). By it the hive's lump is 0.8, not the 0.9 first written, so that a herald, the smallest pocket anyone meets and the first, is within its 31.5 s (30.5); and its specimens stay 0.25 a cell: 11.1 at radius 14.
- A kind whose lump rises in a chain (the drift) is held to the budget at the most it can pay: every piece of its ground that holds mineral hauled by itself in one chain, the poorest first (`chained`); the tool prints what it pays with no chain beside that.

--------------------------------------------------------------
S5. Naming a place and announcing a find (the first juice item, needed by everything)
--------------------------------------------------------------

- look(): when the drill's cell changes, the place key is the zone key in a pocket, else the biome id. On a change set this.place = { title, icon, colour, t }.
- The plate: a small panel at (4, 44), left of NEW, with an 8x8 icon (the pocket's mineral scaled, or the kin's gem icon) and the name in the place's map colour, for 2.4 s, with a two-note motif by kin. The first time a row is ever met (S.met[id] unset) it is a title card instead: the name alone at twice the size at H * 0.3 for 1.6 s with a chord. Names only: no hint text and no rule lines anywhere.
- First sight: world.see() pushes each newly seen notable cell to world.spotted (CACHE, WRECK, RELIC, KEY, PRISM, a pocket's mineral, and SLATE inside a geode's radius by findSpot). look() drains it: one callout per thing (keyed by kind and 48-cell sector), one per kind per 3 s: a ring spreading from the object, a motif per kind, a popup with its name ('GEODE', 'CACHE', 'WRECK', 'KEYSTONE', 'PRISM', the mineral's name), and a dot in S.marks (24 at most) drawn on the map until the cell is gone. An unclaimed wreck within 30 cells ticks softly, quicker as the drill nears.
- Saves: S.met ??= {}, S.marks ??= [], S.visited ??= {}.
- Code: world.see, look, drawHud, drawMap, audio.js (two motifs). Size S for the plate and callouts, M with the title card and the tick.

S5 AS BUILT (read this with the above; where they differ, this is the code):
- Game.placeAt(i) gives { key, row, zone }: the key is the zone's (world.zoneOf of the cell's sector) where the cell's own row is a pocket's, else the row's number. Game.arrive(i), from look() on a change of cell, sets Game.place = { title, icon, colour, t, card, life } and S.met[row.id]; in a pocket, S.visited[zone.key]. The ground a game begins in is met from the start and never announced. Not saved: place, placeKey.
- The plate's icon is the kin's gem from the icons sheet at its own 10 x 10 (the home ground: grit), not scaled to 8 x 8. The name is written in the row's map colour made as bright as it goes (`bright`), since several map colours are too dark to read on the panel. A title card too wide for the screen at twice the size is set on two lines, and sits under a haul's banner when one is up. The sounds are sfx.place(kin) and sfx.arrive(kin).
- World.see pushes [what, cell, middle] to World.spotted (400 at the most; cleared by reset): 'cache', 'wreck', 'relic', 'key', 'prism', 'mineral' (the kind the row's pocket names, K.MINERAL if none) and 'geode' (slate within a geode by World.findSpot, the middle being the geode's). World.findSpot(sx, sy) returns ['geode' | 'cache' | null, x, y, size] and makes no ground; World.find(sx, sy, record) is the sum it shares with findAt. The free band of findAt is still S3's to allot.
- Game.callOut(), from look() whenever the list is not empty: one call for each thing (what it is and the 48-cell sector of its middle), a ring and five sparks, the name in a popup, sfx.spot(what). Of one kind no more than one call in three seconds, but a thing seen sooner still gets its dot. S.marks holds [cell, kind, colour], 24 at the most, pruned in changed() when the cell is no longer that kind; a geode's dot is on the ore cell east of its middle. Wrecks and relics are called out and get no dot: the map shows them already.
- Game.listen(dt): the nearest unclaimed wreck within HEAR (30) cells ticks every 0.22 to 1.6 s by its distance (sfx.ping), counted in Game.ticks.
- Saved: S.met, S.marks, S.visited (and S.wrecks), made in fresh() and defaulted in restore().
- tools/shot.mjs has `--met` (js/shot.js: `&met`): every ground taken as met, so the staged view shows the plate.

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

ITEM 1 AS BUILT (read this with the above; where they differ, this is the code). The rows are in js/world.js, each made by strain(id, name, kin, { what differs }); the tells are rules of TELLS, one figure each, asked in kindAt at their place in its order. Counted with tools/strains.mjs on 8 seeds (a window of 96 x 96 cells in the middle of each province) and looked at with tools/shot.mjs, close, 75 cells wide and across a border of each direction.

  row           gen (where not its direction's)                 freeze  dig  rich  hazard            tell (TELLS figure)
  17 firn       dense 0.60, cave 0.86, cavern 0.84              45      1    0.95  none              rivers 0.02
  18 serac      -                                               15      1    1.05  none              lanes 0.085
  19 scoria     -                                               0       1    0.95  lava t 0.80       bubbles 0.8
  20 forge      slate 0.04                                      0       1    1.25  lava t 0.735, lavaVol 7   its rind of slag, 0.12 wide where the others' is 0.07 (built with item 2)
  21 tangle     cavern 0.60                                     0       1    1.0   spore rate 1      none (its caves are the tell)
  22 sporefall  oreA 0.63                                       0       1    1.2   spore rate 0.5    grapes 0.85
  23 redrock    slate 0                                         0       1    1.0   spark rate 1      strata 0.05
  24 loess      dense 0.76, oreA 0.72, oreB 0.80, slate 0.02    0       0.5  0.85  spark rate 0.5    none

What was counted (cells in a hundred of all cells, the direction's own ground in brackets):
- Firn: rivers of ice 4.5, cut across in 3.3 cells; open 11.5 (21.6); dense 18.7 (11.7). A river is K.ICE where |noise(x/40, y/40, seed+66) - 0.5| < 0.02 (the plan's 0.012 is 2.8 cells in a hundred, a thread), and it runs through ore as through plain rock, so that it is one unbroken ribbon: slate, vault and caves still cross it.
- Serac: lanes of ice 14.9, two cells wide, a mesh round blocks six to twelve cells across. |noise(x/6, y/6, seed+65) - 0.5| < 0.085 (the plan's 0.04 gave 7.3); only where plain rock would lie, so its ore is the north's.
- Scoria: open 24.4 (19.6), 125 bubbles of one to three cells in a window (the south's own 6); lava 3.3 (4.3). A bubble is EMPTY where noise(x/2, y/2, seed+67) > 0.8: the plan's threshold of 0.7 opens 12 cells in a hundred, more cave than froth, and x/2 keeps a bubble to one to three cells.
- Forge: lava 5.9 (4.3) in bigger pockets (a quarter of them four cells and more); slate 10.4 (7.7).
- Tangle: open 49.5 (39.0).
- Sporefall: pods 1.9 (1.2); 20 bunches of three and more in a window, two thirds of the bunches three to six pods, and 64 pods in a hundred hang in one. Bunches are laid on a grid of squares six cells across, not by the plan's noise, which cannot hold a bunch to three to six pods: a square has a bunch where hash(gx, gy, seed+64) >= 0.85, the same hash places its middle a cell or more inside the square, and the pods are the middle cell and those of the eight round it with hash(x, y, seed+10) < 0.6.
- Redrock: slate 12.1 (12.2), in beds 6.2 cells long along a row and 1.4 thick (the east's own: 2.6 and 2.5); one bed in eight is twelve cells and more, the longest over fifty.
- Loess: soft 50.3 (38.0), ore 9.7 (13.7), slate 4.9 (12.2), crystals 0.9 (1.7).
What a solid cell pays in grit beside its direction's own ground, and what a second of cutting it does: firn 0.91 and 0.92, serac 0.94 and 0.99, scoria 0.96 and 0.95, forge 1.33 and 1.25, tangle 1.03 and 1.01, sporefall 1.21 and 1.22, redrock 0.99 and 1.00, loess 0.72 and 1.70. Loess is the one to watch in play: it pays less a cell and, cut in half the time, 1.7 times as much for a second of cutting. tools/ground-worth.mjs is not written yet; these are tools/strains.mjs's figures, held by test/regress/c1-tells.mjs.

The chain of clouds: a spore pod that bursts sets off the pods round it, side by side or corner to corner, 0.15 s later (POD_CHAIN in game.js), in every ground, so one nick takes a whole bunch. Game.bunch(j) says which pods go with a pod, and the glow of a cut (foresee) holds them and what they leave hanging.

By eye, in the game: all eight read as places of their own and of their direction, close and wide, and at their borders (firn against serac against the north's own; scoria against forge; sporefall against the west's own; loess against redrock). No sheet was changed. Forge and tangle are the darkest and scoria against forge the faintest border.

Tests: c1-strain-rows (the table above, and the sheets), c1-tells (the counts above, in real provinces), c1-strain-play (ice, cutting, lava, pay, sheets, the name), c1-pod-bunch; the play fuzz and the rope fuzz fly from inside a province of each strain, and the hazard fuzz inside sporefall and forge (test/all.mjs). `node tools/strains.mjs --where 7` says where a province of each lies.

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

ITEM 2 AS BUILT (read this with the above; where they differ, this is the code). Counted with tools/strains.mjs on 8 seeds and in play by the tests named; looked at with tools/shot.mjs, which has `--wake` for it (the hazard nearest the drill is woken as a cut beside it would wake it, and `--frames` picks the moment).

Where the rules live. Slag and rib crystals are not names in a row's `extras` (the plan has scoria ['bubbles', 'slag'] and redrock ['strata', 'ribs']): they go with the hazard, wherever that hazard is laid, as a ground's first or its second, by a figure of HAZARDS in js/world.js that a row's own `haz` may override (0: none). So every ground with lava has slag and every ground with crystals has ribs without saying so, and a cross that takes either as its second hazard gets them from `haz2` alone. biome() works the figures into row.lay: rind and rind2, ribs and ribs2.

SLAG AND STEEL.
- Generation as planned: HAZARDS.lava.rind 0.07 (forge's own: 0.12, the plan's "thick rind"); half of the plain rock within a pocket by hash 68. Slag takes only soft and dense rock, asked last in kindAt. A second hazard's lava (layers 58) has its rind the same way.
- Counted, cells in a hundred: ember lava 4.3 and slag 5.2; magma 6.4 and 5.5; scoria 3.3 and 4.4; forge 5.9 and 10.0. A pocket is about as much slag as lava (forge 1.7 times), not the plan's two to one: three pockets in four have slag against them, and four cells of slag in five lie within two cells of lava. One cell of slag in five belongs to no pocket (the noise came near the threshold and no lava was laid).
- The rule as planned: Game.quench(i), from trigger() for lava and from the lava loop when lava pours into a cell, turns the slag on that cell's four sides to steel, white for 0.12 s (Game.quenched, the 'quench' frame, a light through shine()), with a sparkle, sfx.clink and a hiss when in view. Nothing opens or closes and changed() is not called; version is bumped. Steel glints in the per-frame pass.
- Steel pays 4 gems, not the plan's 2 (K.STEEL in the table of kinds, and test/regress/s1-tables.mjs). The plan's sum took every cell of slag for steel. Counted in real ground (c2-quench: 30 pockets woken by a cut beside them), a woken pocket makes 0.74 cells of steel for each cell of lava it had (forge 0.94, scoria 0.58), so at 2 gems waking paid a third fewer gems than hauling the pocket asleep and the choice was no choice. At 4 a woken pocket pays about half as much again in gems (forge nearly twice), and a fifth more grit, for the flood. If that proves too much it is this one number.
- A cell of steel cut into says CRUSHED, as ore does.

CRACKLING RIBS.
- Generation, not the plan's figures. A cell is on a flank when it is not slate and lies within RIB = 0.03 beyond the edge of a rib (or of a level bed in a ground with strata) on the slate's own layer of noise; a flank cell is a crystal where the crystals' own hash (seed + 10; a second hazard's, 59) is under HAZARDS.spark.ribs = 0.2 times the ground's rate (so loess 0.1, gilt 0.36). The plan's one cell in ten within 0.015 was counted first: a crystal every ten cells of rib, 2.0 crystals in a hundred cells (1.7 without), and an arc beside slate set off 2.6 crystals and took 4.1 cells of slate (3 as often as not), a notch. As built: lode 2.9 crystals in a hundred, redrock 2.8, loess 1.5; half of them stand beside slate (a quarter without ribs); one arc among those sets off 5.3 crystals and shatters 8.2 cells of slate, 6 or more as often as not (redrock 5.0 and 7.3; loess 2.8 and 3.6). Nine in ten of the crystals the ribs add stand against slate in the east's own ground, seven in ten in redrock, where a bed's flank is wide at its thin ends.
- The rule as planned: Game.zap(x, y) returns the cells it opened, the slate among the eight round the crystal that the tether reaches (Game.shatters), and the caller tells changed() once with everything that opened together: finishDig with the cut (trigger() now returns what a crystal cut into opened), updateHazards with whatever else opened in the frame, so two arcs in one frame are one call. FUSE is 0.8 s. Shattered slate pays nothing.
- Added to the plan: slate an arc opens in ground that freezes is a cut like any other and closes with ice (as a bomb's cells do); the arc uncovers the two cells round its crystal (World.see), so what it broke open is seen; the glow of a cut into a crystal (foresee) holds the slate its arc will take and what hangs on it.
- The crystal stands after its arc, as before.

VEIN FROST.
- As planned, in the frost tick: Game.veined(i), and the cell closes as ORE_A with six sparks of #a8fff0 and sfx.gem when in view. It is told to changed() as ground that grew, as the ice is.
- Not in the plan: only ore the seed laid counts. World.first(i) is what the seed laid in a cell, in the ground the cell lies in, and a neighbour seeds a vein only when it is ore now and was laid as that ore. Without it a cut beside healed ore heals too, and cuts close in the order they were made: one cut against one nugget turned the whole tunnel dug on from it to ore. Healed ore where the seed also laid ore (a nugget cut and healed) counts, so a vein can grow back but not on.
- Counted: 39 cells in a hundred of the north's plain rock lie beside ore (the plan: a third).

Tests: c2-slag-laid, c2-quench, c2-ribs-laid, c2-rib-arc (staged as f-bomb-ring stages a bomb: a block on a neck of slate, shattered by an arc, is in the books and is hauled), c2-vein-frost; t-shot-stage has `wake`. w-same-world's plain reading has the rind and the ribs; 27 hashed pieces were recorded again for the slag (those along the south and its two diagonals, on each seed) and 27 for the ribs (along the east and its two diagonals); none at the core, none along the north or the west. The play fuzz flies the east's, the south's and the north's own ground, the hazard fuzz the east's own crystals, the rope fuzz a deep flank (test/all.mjs). Generating 160 pieces of world takes 96 ms before and after.

By eye (seed 7): a pocket asleep, dull grey lumps round the orange; the same pocket woken, the white bar for a moment and then blue steel bars standing where the slag was, the lava set to basalt between them; forge 45 cells wide, clinker round every pocket; a rib with tufts along its flank, the arc, and three seconds later a channel through the rib where the slate was, the crystals still standing in it; redrock's beds with crystals along their upper and lower edges. Slag reads as worthless and steel as worth having.

--------------------------------------------------------------
3. The cross generator  (M; today's request, so it does not slip)
--------------------------------------------------------------
Specified in section 4. It needs S1 (second hazard), the province pick of item 1 and the rules of item 2, and 12 sheets.

ITEM 3 AS BUILT (read this with section 4 (a) and S3 step 6; where they differ, this is the code). Counted with tools/crosses.mjs and looked at with tools/shot.mjs.

The rows. js/world.js: crossRow(host, donor, structure) builds the sixty rows at load, at CROSS + (host - 1) * 15 + (the donor's place among the other three, in the order of their numbers) * 5 + structure, with crossId(host, donor, structure) for the number, DONORS for the order and row.cross = { host, donor, structure } on each (null on every hand-made row).
- The host's: kin, gemA, gen, floor, gloom, dark, mote, items, lavaVol and its own hazard (haz) exactly as its row has it.
- The donor's: gemB; a new row field itemsB, the sheet the rich ore is drawn from, which is the donor's (Game.overlay reads it), so the rich ore of a cross looks like what it pays: the plan had it paying the donor's gem and drawn as the host's. And the trait at WEAK = 0.6: haz2 { lava, t 0.80 } with the rind that goes with lava anywhere (0.07), haz2 { spore, rate 0.6 }, haz2 { spark, rate 0.6 } with crystals on the flanks of slate at 0.2 x 0.6; a donor from the north gives freeze 30 and no hazard. A cross of the north's ground has no first hazard: its donor's hazard is still its second (K.HAZARD2).
- The structure: 1 HOLLOW gen.cavern 0.62; 2 CRAZED extras ['lanes']; 3 FROTHY extras ['bubbles']; 4 BANDED gen.slate 0 with extras ['strata'] (redrock's beds in place of the host's ribs, as redrock itself has them, not on top of them). CRAZED exists only where the host or the donor is the north. The six rows at structure 2 of the other pairs are there, so no number of the block lacks a row, as twins of the plain cross (same title, structure 0 in row.cross), and World.province never lays them: it lays the plain row instead, so those pairs are plain in two provinces of five. That leaves 54 different places.
- rich 1.25, gemx 1, worth 1, dig 1. Titles from the handwritten table with the structure's word before (BANDED MOULDSTONE is the longest, 17 letters).
- The art's part, held equal to assets/atlas.json by test/regress/c3-cross-rows.mjs: sheet x-<host>-<donor>, map as the art made it (the host's f mixed 40% toward the donor's patch colour), debris [the host's f, the patch colour b, the donor's accent] (the art's third chip is the host's L; the accent was the artist's own suggestion). CROSS_OK[host][donor] is true for all twelve pairs, by the artist's verdicts and by mine below.

Where. World.province: under X = clamp((rc - CROSS_FROM) / 2500, 0, CROSS_MOST) (500 and 0.35, one constant each) the province is a cross: donor = DONORS[kin][floor(hash 56 * 3)], structure = floor(hash 57 * 5); if CROSS_OK says no, the direction's own ground. Counted on 40 seeds (`node tools/crosses.mjs --share 40`), provinces that are crosses beside the rule: 500 to 800 cells out 5.3 in a hundred (6.7), 800 to 1,100 16.9 (17.3), 1,100 to 1,375 28.1 (28.2), 1,375 to 1,900 36.6 (35), beyond 34.7 (35). In cells: 0.3 in a hundred of the ground 220 to 500 out (a province whose middle is just past 500 reaches in to 330), 4.1 of 500 to 750, 10 of 750 to 1,000, then 12 to 17 of all ground and 28 to 38 of the ground that is no deep flank. On the worst single seed and ring 74.5 cells in a hundred are hand-made; test/regress/c3-cross-provinces.mjs fails under 65. The nearest cross to the core on seed 7 is 905 cells out (buzzmire), so they are met with the tether at level 8.

Counted in real provinces on 8 seeds (`node tools/crosses.mjs`), cells in a hundred:
- The donor's hazard beside the donor's own ground: lava 0.59 to 0.75 of the south's 4.1 (thaw 3.1, kilnstone 2.7, smoulder 2.5, where the caves take more); pods 0.66 to 0.74 of the west's 1.1; crystals 0.44 to 0.55 of the east's 2.8 (the hosts have less slate for them to stud). The host's own hazard is 0.86 to 1.0 of what its own ground has.
- Slag round the donor's lava: thaw 4.1, kilnstone 3.7, smoulder 3.3; none in a cross without the south.
- HOLLOW open ground: 40 in the north's (plain 18), 35 in the south's (21), 44 in the west's (38), 36 in the east's (19). FROTHY: 26, 25, 46, 27. CRAZED: 10 to 12.5 ice. BANDED: 10 to 12 slate, 5.6 cells along a row and 1.5 down a column (plain crosses 2.0 and 2.1).
- A solid cell pays 1.21 (crazed, for its ice) to 1.39 (banded) of what one of the host's own ground does. Over the whole ground (`--worth 12`): +0.6% 500 to 750 out, +1.7% to 1,000, +2.3% to 1,375, +3.2% beyond. The plan allowed +9% far out and reprices past 15%: nothing is repriced.
- Making 160 pieces of world far out takes 107 ms with every pair switched off and 111 ms with the crosses; test/frame-time.mjs has no frame over 16 ms on six flights inside crosses (worst 14 ms, in rubble).

In play. Nothing in js/game.js knows a cross: freeze, hazards, pay, sheets and the name are read from the row as for any ground. Two things were added for them: the rich ore's sheet (above), and the plate that names a place shows a second gem after the first where the place's rich ore pays another direction (place.also), so a cross's plate has both gems it pays. The title card is the name alone, on two lines when a structure's word is before it. The reactions between two traits (item 12) are not built: in a cross each trait does what it does alone (lava in thaw pours down a cut and sets there as basalt, and the ice closes what is left of the cut; a pod's moss and the frost each close what they close).

By eye (seed 7, tools/shot.mjs, close in the dark at phone size and 75 cells wide lit): thaw, crazed tundra, frothy hailstone, crazed quench, frothy sootfen, hollow flashrock, banded rimemoss, smoulder, buzzmire, hoarsand, banded kilnstone, mouldstone: every pair, and every structure at least once. Each reads as its host's direction and as a place of its own. The donor's rich ore drawn in the host's rock is the loudest tell close up (the south's gold suns in ice, the north's pink crystals in basalt and sandstone, the west's teal caps, the east's violet gems), then the donor's hazard with what goes with it (lava in its slag in ice is unmistakable), then the sheet's patches. Weakest: smoulder in the dark (dull brown on dull violet: it reads by its lava and slag), and kilnstone against the east's own ground at a border in the dark (it reads by scorch, lava and slag, not by colour), as the artist said of both sheets. On the whole-world map (tools/field.mjs) the crosses show as patches of their own colours among the strains. Also seen: the card BANDED / MOULDSTONE on two lines and its plate with both gems clear of NEW; lava woken in thaw, pouring through the ice; a crystal woken in frothy hailstone.

Tests: c3-cross-rows (every field of the sixty rows, the names, the art's sheets and colours), c3-cross-provinces (the share by distance, the host, donors and structures as often as the rule says, pairs switched off, 65 in a hundred hand-made), c3-cross-laid (the counts above), c3-cross-play (ice, each donor's hazard woken, pay and gems, sheets, a frame of each row drawn, the name and both gems). s3-provinces, c2-slag-laid and c2-ribs-laid were taught that crosses exist. w-same-world's plain reading has the crosses written into it (which province, and what a cross's number says of its ground); 21 of the 96 hashed pieces moved and were recorded again, all of them along the four axes from 1,000 cells out (none at the core, at 200 or at 600, none on a diagonal: those are deep flanks). 42 mutations, one rule removed each, were each caught by a test. test/all.mjs flies from inside crosses: the play fuzz ten times (one of each host with each donor between them and each structure), the rope fuzz six, the hazard fuzz five with both of a cross's hazards planted.

--------------------------------------------------------------
4. SIFT CHARGE: BLAST reworked, same row and save id  (S)
--------------------------------------------------------------
The bomb takes the plain ground and leaves everything of value standing loose, ready for one circle of the tether.
Rule, blast(): a disc of radius [-, 2.5, 2.5, 3.5, 4.5] by level (21, 21, 37, 61 cells; today's squares are 9 and 25, so it is also a buff) opens only SOFT, ICE, BASALT, GLASS and FAULT cells within reach. Ore, stones, slate, minerals, caches, geodes and sleeping hazards stay, and hazards are not woken. Then one changed(opened), which with S2 registers every island. The row reads 'BOMB: SHAKES ORE LOOSE'.
Numbers: charges 0, 1, 2, 3, 4 as now. A 37-cell disc in direction ground keeps about 14 cells holding 13 to 17 gems; four charges are about 60 gems, the gems of a 14x14 loop without its cutting, against gem prices of 150 to 1,200. Grit is below loop play. Share 0.35 to 0.4: 210, 4.3K, 64K (+150 ember gems), 370K (+790).
Art: none.
Try on a phone: the swirl round one nugget in a 5-cell room. If fiddly, also clear one ring of plain ground beyond the disc.

ITEM 4 AS BUILT (read this with the above; where they differ, this is the code). Played with tools/sift.mjs and looked at with tools/shot.mjs, which has `--bombs n` and `--blast` for it (the drill at the end of its tunnel with no room carved, and one charge set off there).

The rule as planned did not do what it was planned to do, and was changed until it did. Played as planned (`node tools/sift.mjs --planned`: 214 charges on four seeds, each aimed where most ore stands within five cells), two charges in three shook nothing loose at all and a charge brought home 1 to 9 gems. Two things the plan did not count: with dense rock left standing, half of a disc in a direction's ground stands (14 cells of 30 that are not open already, as the plan says; but they hold one another to the walls), and a lump of ore nearly always runs on over the disc's edge, where the rock beyond holds it.

The rule, js/game.js: Game.sifts(cx, cy) says what a charge set off in that cell opens and changes nothing; Game.blast() opens it. The figures are one record, SIFT = { radius: [0, 2.5, 2.5, 3.5, 4.5], shake: 2, room: 2 }.
- The disc is the plan's, by level: the cells whose middles lie within the radius of the drill's cell, 21, 21, 37 and 69 of them (the plan says 61 for 4.5; it is 69).
- What opens is PLAIN: SOFT, DENSE, ICE, BASALT, GLASS and FAULT. DENSE is added to the plan's list. Everything else stands, slag and steel among it (the pocket of lava a charge shakes loose can still be woken for steel), and nothing of hard 99 is touched.
- What stands in the disc has the plain rock round it opened `room` cells deep, on every side and at the corners, past the disc's edge where it stands near the edge. This is the plan's phone note (one ring of plain ground beyond the disc), cleared where something stands and two cells deep, not one. Checked as the note asks: the drill is 0.68 of a cell wide and cuts whatever it is pushed into, so no circle fits a lane one cell wide round a nugget (it would need a radius of 1.19 cells or more to clear the nugget's corners and 1.16 or less to clear the wall), and any circle of 1.2 to 2.1 cells fits two. Flown by a thumb's circle (a point a little way on round the circle steered at, with no care for cells), at four levels of bit and ram: twelve of twelve nuggets come home whole with two cells of room, nine of twelve with one (the rest are crushed).
- A lump that runs out of the disc is followed, side to side through whatever stands, `shake` cells past the disc's edge, and has its room cleared too: it comes loose whole if it ends within that. One that runs further stays on the wall.
- Nothing opens beyond the tether's reach. Nothing is cut, so nothing wakes: trigger() is never called. In ground that freezes the opened cells are cuts like any other and close with ice (or as ore beside ore: vein frost). One changed(opened) tells the books; what came loose glints.
- A charge that would open nothing is not spent and says NO ROCK; a tap with the rack empty says NO BOMBS. (Before, an empty rack only sounded, and a charge in a cavern was spent on nothing.)
- The row: 'BLAST', 'BOMB: SHAKES ORE LOOSE', the same id and place, charges 0 to 4, prices by priced() at a share of 0.4 beside reach 1, 2.8, 5 and 7.4: 210, 4.3K, 64K and 150 gems, 370K and 790 gems, the plan's figures exactly. The name BLAST is kept: the plan gives the row's text and no new name.

What a charge brings home (tools/sift.mjs, seeds 7, 11, 13 and 17, four places a direction; the upgrades are those priced below the reach the level lies beside; the pilot is the same for the charge and the loop and slows for every turn, which favours the loop):
  level  reach  charges  none loose  a charge brings home, by direction     in        the loop of the same time
  1      22     22       1           51 to 145 grit                         1.8-2.7 s 12 to 24 grit
  2      72     64       2           554 to 1.0K grit                       1.8-2.5 s 67 to 270 grit
  3      230    64       2           1.3K to 2.3K grit and 28 to 39 gems    2.4-3.2 s 364 to 888 grit and 2 to 16 gems
  4      750    64       1           5.3K to 14.6K grit and 33 to 62 gems   2.7-3.7 s 3.4K to 7.1K grit and 10 to 31 gems
So a charge is worth two to eleven loops of its own time in the home ground, and from level 3 at least twice the loop's gems and mostly three times or more; in grit at level 4 it is one to two times the loop (on six seeds level with it in the east and a little under it in the north). That is two to three times the 13 to 17 gems a charge the plan aimed at, and it comes of aiming: a charge set off wherever the spot happens to be (`--aim 0`) brings about half as much, 10 to 21 gems at level 3 and 27 to 34 at level 4, and one in seven of those shakes nothing loose. A rack is three or four charges a trip, so the bomb adds about 100 gems a trip at level 3 and 130 to 250 at level 4; a level's gems are paid back in 5 charges at level 3 and 16 at level 4, its grit in about 40.

Still true and left: lumps stand close together in real ground and the drill starts among them, so two charges in three leave some lane one cell wide past a loose lump on the quickest way round (the tool's `close`); more room does not change that, since it is other lumps that stand in the way, not the wall. A very large piece the charge happens to cut off (a neck between two caves: 102 and 345 cells, twice in 214) is in the books but is not flown round by the tool.

Tests: c4-sift-rule (the disc by level, what goes and what stands kind by kind, the room and the lump followed with each figure's control, one changed, hazards of each type left asleep, the reach, the freeze, the two refusals, a nugget flown round and paid, the thumb's circle), c4-sift-row (the row, the prices, a saved level kept), c4-sift-worth (the table above on two seeds, and that it falls without `shake` or `room`), t-shot-stage (`bombs`, `blast`). 32 mutations, one rule removed each, were each caught. The play fuzz flies with bombs in the north's, the south's and the west's own ground and on the first reach but one with trips home (test/all.mjs), and a-fuzz-soft now fills its rack so that its charges go off. A charge takes 2 ms in the frame it goes off (13 at the worst of 128).

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

ITEM 5 AS BUILT (read this with the above; where they differ, this is the code). Counted with tools/slabs.mjs, played with tools/slab-play.mjs, looked at with tools/shot.mjs, which has `--key` for it (the drill at a slab's last key, the others cut through, pushing into it).

Where a slab lies and what it is made of, js/world.js: World.slabIn(sx, sy) is a sector's slab, worked out once and kept (sectors of SLAB = 144 cells); World.firstSlab the fixed one; World.slabCell(S, x, y) what a slab makes of a cell (nothing, open crack or joint, key, its own ground, its collar); kindAt asks after the wrecks and the vaults and before the finds, and a piece of the world asks once which slab lies in it (World.slabOver), so that no cell of it has to.
- The plan's figures are kept: a sector tries a slab at hash 80 under 0.22, radius 8 to 16, its middle 40 cells or more inside the sector, the crack 1.1 to either side of a line that wanders a cell and a half (layer 84), a key 1.2 to either side of its way across the crack, two keys or three over radius 12, the collar out to 3.5, ore thresholds 0.05 lower inside, no cave, bubble or find inside or in the collar, a cobble field in 35 of 100 (a disc four cells wider, joints every fifth row and column, each block's one key in the joint east or south of it by hash 86, against one of its four cells by hash 87).
- The keys' ways and the first slab's bearing are worked out with no sine: World's `heading(q)` gives the way q quarters of a circle round as a rational point on the circle, so the world is the same on every engine. Two keys are at least 0.8 of a quarter apart by it, which is 64 degrees or more.
- A slab is laid only where it is sound, which the plan left to the test and the generator now asks itself before it lays one (`World.slab`, `fault`): each key must join the slab to the collar in one run of cells ('keys'), the crack with the keys cut must be one ring of open cells joined side to side ('ring'), and the ground against the outside of the collar must run on unbroken 48 cells beyond the slab (`held`, HOLD: a collar on a stalk in a cavern is not held by the world). The plan's cavern rule is kept as well (the middle within 0.08 of a great cavern on its layer of noise). Counted on 12 worlds, every sector out past the world's edge: of 2,037 slabs tried, 1,439 are laid, 399 stood in or beside a great cavern, 189 lay within 60 cells of the core or out where the last reach does not go round them, 6 on a wreck, 1 on the first slab, and 3 had a key that did not hold. Of the sectors within the last reach 16.6 in a hundred hold one, 35 in a hundred of those a cobble field. They cover 0.35% of the ground; the median slab or field has 434 cells, the largest 808. Trying a slab asks about 285 cells of ground, once for a sector.
- The first slab is 52 cells from the core, radius 8 with two keys, on the bearing hash(1, 1, seed + 89) says, and a quarter of a circle further round (and so on) where that is within 25 cells of the first wreck or not sound. All of it lies within 70 cells of the core. No other slab lies within 44 cells and its own radius of it.
- No slab where its disc and five cells more meet a pocket: World.meetsPocket(cx, cy, reach) is the one function for it. It asks zoneOf for each sector of pockets the disc's box overlaps and takes a record { cx, cy, rho } to run no further than 1.2 rho from its middle. No pocket is laid yet, so it never says yes: whoever lays pockets keeps it true to them (it counts on a pocket lying wholly inside its own sector, as S3 lays them).
- A prism is laid by findAt in its band, [0.70, 0.74): one cell of K.PRISM at the find's middle and K.ORE_A in the eight round it, only where the middle is over 130 cells out. 3.9 sectors of finds in a hundred hold one.
- 14 of the 96 hashed pieces moved and were recorded again (tools/world-hash.mjs): each has a slab, a field or a prism in it, and of the pieces that did not move only two are so much as touched by a slab's box (at its very edge, where the collar is the ground that lay there anyway). Five of the 14 are pieces at the core: the first slab lies in four of them and a cobble field 93 cells out in the fifth. So the core's lines, which no earlier item moved, moved here on purpose. (The commit that recorded them says three; it is five.) test/regress/w-same-world.mjs has slabs, fields and the prism in its plain reading, with the three questions of soundness each asked the plainest way.

In the game, js/game.js:
- A key is drawn as the staple from the finds sheet over its block of rock, sheds iron and rust, and cuts as slate does (dig 1.0, the ring and the shatter of slate). The twelve cells of key nearest the drill that have been seen glint at 0.4 (KEY_GLINTS, KEY_GLINT). Rock drinks light, so a glint lights the key's own cell and no further, as steel white from the quench does.
- The glow of a cut is what it always was (Game.foresee): at the last key it holds the whole slab. The cut that parts the last key puts the whole slab in the books in that frame through the same World.freed as any cut: counted in play, it walks 250 to 730 outline sides, follows the slab's own cells and no others, makes none of the world, and took 0.1 to 2.8 ms.
- The first slab is a ring on the map from the start of a new game until no cell of its keys is left (Game.firstRing reads the cells). The plan asks for the ring before the reach goes that far; the map shows only a little more than the reach, so until then the ring is drawn small at the map's edge on the way to the slab, which the plan does not say. An older saved game, whose ground there was made before slabs, has no ring.
- A haul with a prism in it is never a light haul, and its banner has a third line, 'PRISM x1.5' (x2, x2.5), in the gems' colours by turns. The multiplier is payOf's, built with S2. A prism cut into is CRUSHED. It is drawn afresh each frame through its three frames. What a banner says besides its title is one function, Game.bannerSays, which also says WINCH OVER LOAD.
- Nothing was added to SIFT's list: keys and prisms stand in a blast. A charge beside a key opens the rock the key holds to, which can let the slab go with the key still standing.

Played with no hand on it (tools/slab-play.mjs; the pilot flies to the crack by the quickest way, then the cheapest lap of the crack's own cells through each key, and slows for every turn):
- The first slab of a new game, on 24 worlds, with reach 72 and what a player holds by then (bit 2, winch 2, ram 2): 7.9 to 11.9 s from the core to the crack, 6.2 to 10.3 s round it, 128 to 182 cells hauled whole in every one, 2,764 to 6,235 grit. The model's income at that reach is 78 grit a second, so the slab is 35 to 80 seconds of it for about 18 of flying.
- 28 slabs of radius 8 to 16 further out on two worlds, in every direction's ground and several strains: 28 hauled whole, a lap of 5 to 18 s. One of radius 12 (399 cells, 233 out) pays 52,896 grit with the winch a player holds at reach 420, which is 52 seconds of that reach's income; with no winch bought it is over the load, pays 21,114 and says WINCH OVER LOAD; one level of winch pays it in full. One of radius 16 at the edge of reach 750 paid 546,688, five minutes of the model's income there, for a lap of ten seconds: it lies where that reach's ground is richest and comes home whole at x4.5. That is the one to watch. (By the bit's and the ram's own figures a plain loop cut for those ten seconds at that reach would shut in more cells than the slab has; that was worked out, not played.)
- A cobble field: a lap of the joints round one block cuts the two to four keys that hold it and brings its 16 cells home; round a square of four, 64 cells and the keys between them.
- The first slab has 128 to 182 cells, about the first winch load (150): with no winch bought some first slabs are a little over it and say so, most are not. Any slab of radius 10 or more is over the first load.

Seen with tools/shot.mjs on seed 7: the first slab lit and in the dark (a disc in a ring of open crack, two patches of iron staples across it); one key close up (the staple reads as iron, rust dots and all, on its block); a slab of three keys in scoria, 67 cells wide; a cobble field in serac (a grid of blocks four cells square with a staple in each joint); two prisms in their rings of ore, in mire and in frost, with PRISM called out; the last key half cut with the whole disc glowing white, on the first slab and on one of 457 cells; the slab hanging loose with the blue edge; and the map at reach 12, 22 and 72 with the ring at its edge and in its place.

Not done, or done otherwise:
- The glint lights only the key's own cell (the plan's 0.4 / 2 would light the crack beside it if light spread from rock).
- Twelve cells of key glint, not twelve keys: a key is five to seven cells.
- A slab's keys are called out as S5 calls anything out: once for each sector of finds they lie in, so a slab is named once or twice and a field one to four times, each with a dot on the map.
- test/slab-moat.mjs looks at the first slab, every slab within 700 cells of the core and every seventh beyond, in each of 200 worlds (about 5,900 slabs and fields); test/all.mjs runs it as four runs of fifty.
- Nobody has heard a key cut or seen a slab's rubble come home: the shot tool cannot fly a lap.

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

ITEM 6 AS BUILT (read this with the above and with S3 AS BUILT, POCKETS and S4 AS BUILT; where they differ, this is the code). Counted with tools/zone-budget.mjs, played with tools/hive-play.mjs, looked at with tools/shot.mjs, which has `--pocket` for it (the drill inside the pocket nearest, in the lane beside the nugget at a hive's middle) and `--haul n` (that many nuggets brought home from there).

The hive as it lies, js/world.js (POCKET_SHAPES.hive, hiveChambers, nuggets):
- A hive is whole chambers. The pocket's middle cell is the middle of a chamber; a chamber is the hive's if its own middle is within rho of the hive's; and every cell of such a chamber and of the walls round it is the hive's, so its edge is the chambers' own, a wall of wax a cell thick all the way round, and no chamber is cut through by a circle. A hive of radius 9 (a herald) is seven chambers, 25 cells across; one of radius 30 about forty-four. A hive's cells lie up to 5.7 cells beyond its radius.
- Doors are not in any wall at four in ten, as planned: laid so, one nugget in eight (23 of 189 looked at) hung from a scrap of wall that doors had cut off from everything, loose before anyone came. Instead, at the corner where a chamber's west wall meets the wall over it, one of the two may have a door (35 corners in a hundred each): the west wall two cells above or below its middle, or the wall overhead in its half next the corner. The other half of the wall overhead never has one, and a door is only ever between two chambers of the hive. So from any corner the wall runs on unbroken to the outside wall, which is whole: nothing in a hive hangs on nothing (0 of 189), and the way in is to bite through the wax.
- A stalk's wall is never a door: the walls' doors are two cells off their middles, and a stalk hangs from a middle.
- The chamber at a hive's middle always holds a nugget, so no hive is without one.
- The share of the other chambers that hold a nugget is 55 in a hundred up to radius 14 and 7.7 / rho beyond (26 in a hundred at radius 30), not 55 everywhere. A hive has chambers as the square of its radius and its budget grows with the radius: at a flat 55 a hive of radius 30 held 220 cells of amber, 198 s of income where it may pay 105, and 55 specimens. As built the mean hive holds 3 to 3.7 cells of amber for each cell of its radius, small or great.
- Numbers, 200 hives made as the world makes them: the mean (radius 13.7) holds 45.9 cells of amber and pays 36.8 s of the 48 it may; by band of radius 61%, 73%, 84% and 86% of what it may; a herald 38.1 cells, 30.5 s of 31.5, 9.5 specimens; at radius 14, 11.1 specimens.

In the game, js/game.js:
- K.MINERAL is drawn as its row's mineral from the 'minerals' sheet over its block of rock, and K.NODE as `node`-h or `node`-v as the cell lies between what it joins: Game.overlay(k, row, i) takes the cell for that. The artist's stalk is a cord across a whole block of wax, so the stalk is a block wide.
- Amber cut into is CRUSHED (as ore is) and sheds amber; a stalk cut says nothing.
- Nothing grows back in a pocket: a pod's moss does not close a pocket's open cells, and lava that runs into one goes out and leaves no basalt.
- The plate of a pocket has its mineral on it, twelve pixels square at its own size, where the plan has it scaled to eight.
- A charge (SIFT) opens wax and leaves amber and stalks standing, so a nugget whose wall went with the charge hangs loose: nothing was added for it.

Played with no hand on it (tools/hive-play.mjs; the pilot bites in by the cheapest way, flies the lane against the chamber's walls once round, through the stalk's far cell, and slows for every turn; with the bit and ram a player holds at that reach):
- World 7's first six hives: every nugget home, 32 of them, each a light haul of 10 or 11 cells, no amber crushed, the tether sound; 2.0 s a nugget with the way to it, about 1.3 s of that in its chamber. A nugget pays nine lumps: about 2,900 grit at 166 cells out.
- That is 3.7 times the model's income while inside, where the plan allows 1.3 to 2: the plan reckoned five seconds a nugget (1.44 times at lump 0.8), and the pilot takes two. A thumb will be between. What a hive pays in all is held by its budget whatever the pace; the rate while inside is the one to watch in play.
- The fuzz flies from inside four hives, with bombs and without, and is clean.

Seen with tools/shot.mjs on seed 7: the west's first hive whole, lit and in the dark, in a cavern of the mire (gold comb, sealed, three nuggets on their stalks); the north's in pale frost and the south's in red basalt, each plainly its own place; a great hive of forty chambers 460 cells out (a brick-laid maze with a nugget in every fourth chamber, some chambers wax right through); inside, in the dark, AMBER HIVE across the screen and AMBER called out with its ring; the plate with the amber on it; a nugget hauled, with '+3.5K' beside an amber and '+2' beside a green specimen where it lay and the count out under the plate; two nuggets, with NICE CUT!, '22 x1.6' and the amber and '+4' on the banner's last line; and the map with a gold pip in each direction.

Not done, or done otherwise:
- The heralds of the north, east and south are hives until item 7's rows exist (above).
- Nobody has flown a hive by hand: the lap of a two-cell lane with a thumb, and whether a one-cell door is worth aiming for, are unseen. The light haul's popups were seen staged (`--haul`), not after a real lap.
- A hive that stands clear of the rock in a great cavern is one loose piece from first sight, walls and nuggets and all, to be lassoed whole: 4 of the 522 hives of four worlds do (small ones, of three to seven chambers). Nothing prevents it, as the slabs' `held` does for slabs; it pays no more than the hive holds.
- No glint or glow on amber: in the dark outside a hive its comb is dim gold.
- The sounds at a nugget's haul (sfx.gem when the whole count rises) have not been heard by anyone.

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

ITEM 7 AS BUILT (read this with the above and with S3 AS BUILT, POCKETS and S4 AS BUILT; where they differ, this is the code). Counted with tools/zone-budget.mjs, played with tools/drift-play.mjs and tools/ash-play.mjs, looked at with tools/shot.mjs (`--pocket`, `--haul n`, `--bombs n --blast`).

The drift as it lies, js/world.js (POCKET_SHAPES.drift, boulderOf, driftBoulders, boulders):
- A plain disc of open ground, 9 to 30 cells in radius (not 8: at 8 the four boulders round the middle did not all fit, and one drift in a world had none). Squares of seven cells, as planned, but the drift's middle lies at a corner where four squares meet, not in the middle of one: so the four squares round the middle hold a boulder each within nine cells of it, they always do, and a direction's first drift (radius 9) has four boulders where the plan's grid gave it one.
- A boulder's middle lies in the middle cell of its square (a part of a cell each way, from the two halves of one hash on seed 49; the plan's 0.8 either way would have left lanes one cell wide), its radius is 1.2 to 1.8 (50; not 2.0, which gave boulders of 13 cells), and it is aerolite within 0.9 of its middle and pumice outside that: 4 to 12 cells, two to four across, with one to four of aerolite. So a boulder lies on the third to the sixth cell of its square and the lanes between boulders are three cells wide or more; one boulder in fifty is 12 cells, the size at which a haul is no longer a light one.
- Two cells to the wall: a boulder is no bigger than leaves that, where the plan left it out altogether (so near the wall it is a pebble; one in a hundred is 2 or 3 cells), and is left out only where its aerolite would not fit.
- Of the squares away from the middle the share `boulders(rho)` = min(0.8, 5.2 / rho) hold one (seed 48), not 0.8 everywhere: a drift has squares as the square of its radius and its budget grows with the radius. At a flat 0.8 a drift of radius 24 held 26 boulders and paid nearly three times what it may. As built a drift under 14 cells in radius has its four boulders, one of 17 has 7, one of 24 has 9, and the richest in 8 worlds 19.
- Lump 2, not 2.2, by the budget with the chain counted (below). Specimens 0.9 a cell: 12.2 at radius 14.
- Numbers, 200 drifts made as the world makes them: the mean (radius 14.6) holds 14.6 cells of aerolite in 5.8 boulders and pays 29.2 s with no chain, 45.7 s in one chain, of the 51.2 it may; by band of radius 87%, 67%, 94% and 94% of what it may; a herald 10 cells in 4 boulders, 26.9 s of 31.5, 9 specimens.

The ash flat as it lies (POCKET_SHAPES.ash, tektites): as planned, a disc whose edge wanders, ash everywhere and a cell of tektite where its hash (51) is under one in ten; and under 2.1 / rho in a flat over 21 cells in radius, for the same reason as the drift's boulders. minR 170 and weight 1, as the plan has it while the flat is the south's herald. Numbers: the mean flat (radius 13.4) holds 62.7 tektites and pays 31.3 s of the 46.9 it may, 12.2 specimens at radius 14; a herald 25.6 tektites, 12.8 s of 31.5: a small flat pays well under what it may, since its tektites go as its area and its budget as its radius, and one in ten is the plan's figure.

In the game, js/game.js:
- The books. The plan's loop over the pocket's box with pieceIn was written before the hunt's second pass: ground that comes into view is already looked at a cell at a time (`spot`, on `World.isle`), so a boulder is in the books from first sight, in a drift or seen from outside one. What is added: `driftIn`, from `arrive` when the drill's place becomes a drift, looks at every solid cell of the drift's own ground in the pocket's box, so every boulder that stands is in the books that frame, seen or not, and its edge shows through the dark (the record says where to look; what stands is the cells' to say). And `driftsOut`, from `look` on a change of cell: a drift whose boulders are in the books (`Game.drifts`, which `enter` adds to) and which the drill is out of, and further from than its radius, half the screen's diagonal and AWAY (6) cells, has its boulders taken out of `pieces` and `pieceOf`; but for a boulder a bend of the tether lies on, whose drift is asked about again. Not at the moment of leaving, as planned: a boulder two cells inside the wall would lose its edge on the screen as the drill stepped out. A boulder out of the books is found again as any island is (`spot` when it comes into view, `discover` when the tether lies on it, `sweepHome` when the line home passes over it), which is what makes a boulder wound from far off on a later trip come home. reelIfRound is not called on coming in: the game asks it ten times a second anyway. Nothing is saved.
- The chain. CHAIN is 6 seconds, as this item has it (S2 built it at 8, for every haul). A haul of a mineral whose row says `chain` rings `sfx.gem` every time, a step higher for each haul before it up to five (any other pocket's rings only when the whole count of specimens rises). `payOf` returns `chain`, what the lump was multiplied by (0 where no cell chains), and `hauled.chain` says it.
- The plough. PLOUGH = 0.3: where the row of the cell bitten (or, with no cell to say, of the cell the drill stands in) has `dig` under that, a push does not zero the drill's run and the drill is not drawn square on to the block. The second case is not in the plan: sliding past a block at speed the drill can be stopped by one that is no longer before the bit when the frame ends, and with a bit that cuts ash in one frame that broke the run several times a second (a lap's run unbroken for 2.0 s of 7.3; now all of it). CRUSHED comes up no more than once a second in such ground (`crushedAt`). A tektite's time is its kind's times the row's `dig` already (0.09 s).
- Nothing was added for a charge: BLAST opens pumice and ash as it does any plain rock, so in a drift it blows the pumice off the aerolite and in a flat the ash off the tektites, which stand loose.

Several hauls at once (the plan's check), counted with `node tools/drift-play.mjs --drift 25 --burst 0.3`: the richest drift within 700 cells of the core in world 7, fifteen boulders of 108 cells, each hauled as a loop would haul it, one every 0.3 s. Only the first haul breaks fine (S2's rule for a chain), so 516 bits of rubble are made in all, at the most 421 are on their way at once in 14 hauls, and a frame moves a bit 1,296 times; game.update took 0.96 ms in the mean and 5.5 ms at the worst. One every tenth of a second: 516 bits at once, 2,064 moves, 8.7 ms at the worst. One great haul by itself is 400 bits moved four times, so a drift asks no more than the game already did, and nothing was capped or made coarser. test/regress/c7-drift-rubble.mjs holds the counts.

Played with no hand on it:
- Drifts (tools/drift-play.mjs: in at the end of a tunnel, once round each boulder two cells clear, slowing to a walk for every corner). Three drifts of world 7, of 4, 7 and 8 boulders: every boulder home in 5.1, 11.4 and 13.2 s, every haul of one boulder a light one, the lump at x1.6 by the fourth haul and x2 from the sixth, no aerolite cut, the tether sound. That is 5 to 5.5 times the model's income while inside (9 and 11 times in the two richest drifts), where the plan reckoned thirty seconds for five boulders and 1.4 times. What a drift pays in all is held by its budget whatever the pace.
- Ash flats (tools/ash-play.mjs: one round loop about the flat's middle, steered by a heading that turns all the way). The south's first, radius 9, with the bit a player holds there: a loop of 6.8 cells in radius closes in 2.6 s, 105 cells home with 10 of the flat's 25 tektites, 9 crushed on the way, CRUSHED said 3 times; 1.8 times the model's income. A flat of radius 23: a loop of 14.5 in 4.5 s with the best bit (7.7 s with the first), 580 cells home with 47 of 149 tektites; 3 to 4.7 times the model's income. The drill flies 14 to 21 cells a second through ash; with the first bit and no ram it goes 9.8 cells in its first second and a half, where soft rock gives four.
- The fuzz flies from inside three drifts and two ash flats, with bombs, trips home and the best ram, and is clean; test/frame-time.mjs shows no frame over 16 ms on four such flights.

Seen with tools/shot.mjs on seed 7: the north's first drift whole and lit (a round night-blue cavern in pale frost, four grey boulders with blue stars in them) and close in the dark (PUMICE DRIFT across the screen, the boulders' dotted edges, the floor pricked with stars); the east's in sandstone; a drift of fifteen boulders whole (they stand in rows, seven cells apart: it reads as a field more than as a scatter) and from inside with its plate; a boulder hauled (+2.4K beside an aerolite, +2 beside a blue specimen, the count out under the plate) and two at once (NICE CUT!, 12 x1.4, the aerolite and +4); a charge set off beside a boulder (two cells of aerolite left standing loose). The south's first ash flat whole and lit (pale grey with dark nodules, plainly its own place in the red basalt) and close (ASH FLATS, TEKTITE called out); a great flat that lies across the border of the south and the west; from inside, at the end of a way one cell wide; three tektites hauled; a charge's room in the ash with two tektites standing loose in it.

Not done, or done otherwise:
- Nobody has flown either by hand. A loop ploughed through ash has not been seen in a picture (the shot tool cannot fly), only its haul staged; nor a boulder being wound.
- The pay while inside is several times the plan's figure for both (above), by a pilot's hand. Open question 8 allows twice; the budget bounds the whole.
- A small ash flat is poor: a direction's first pays 12.8 s of the 31.5 it may, and a loop takes ten of its 25 tektites.
- In a great drift the boulders stand visibly in rows. More play in where a boulder lies would narrow the lanes.
- The drift's row has kin 0, so the sound of the place and its motif are the home ground's; its specimens are the direction's it lies in.
- None of the sounds (the rising note of a chain) has been heard by anyone.

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