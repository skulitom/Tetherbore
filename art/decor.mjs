// What grows in each ground's caves, what floats in its air and how it glows: the Pixelbolt sources of three sheets.
//
//   decor     each ground's own pieces, as frames named `<set>-<place>-<n>`: what hangs from a ceiling (top), stands
//             on a floor (bottom) or grows on a wall (left, and right, the same drawn the other way round), and the
//             faint marks on the back wall of any open cell (floor). A set is a ground's (`row.decor`).
//   decor-x   a cross's pieces of its donor: the donor's shapes, coloured mostly as the host's and a little as the
//             donor's, at the host's brightness, so that THAW has the south's vents in the north's caves and they
//             read as that cave and not as its rock.
//   halo      the soft light laid over a glowing piece, one frame to a colour of glow.
//   air       the motes, as small white sprites whose alpha is their shading: the game tints each in its mote's colour.
//
// What a piece must never be taken for is what pays or hurts, and it must never be taken for rock:
//   - no dark outline (ore, hazards and finds all have one);
//   - every colour of a piece but its glow lies between its ground's floor and its rock: what most of it is no
//     brighter than two thirds of the way from the rock's dark band (D) to the rock's own colour (f), and its
//     highlight no brighter than f. So a piece is a shape in the dark of the cave, never a lump of the rock (whose
//     lit rim is brighter than f, and whose outline is darker than the floor);
//   - a piece keeps to a band BAND pixels deep along the side it hangs from, stands on or grows from: the middle of
//     the cell is always empty, where an ore or a hazard would sit;
//   - a glow keeps well away from the colours of the ore, gems, hazards and minerals of every ground its set is drawn
//     in: the north glows ice-white (its gems are cyan, pink and mint), the south's vents burn sulphur blue (its
//     lava, ore and gems are orange, red and yellow, and its steel a pale grey-blue), the mire's glow-worms are blue
//     (its gems are lime, its ores amber and teal, its pods violet; and the grounds that cross it have lava, steel
//     and the east's violet and cyan), bloom's flowers rose and gilt's lichen phosphor green (the east's spark
//     crystals are gold, its gems violet and cyan). There are no fissures or veins of light in the south (lava), no
//     puffballs (spore pods), no toadstools (the mire's own ore is a cap), no honey (amber), and the colours of
//     bloom, sporefall and the hive are taken away from their pods' violet and their amber.
// test/regress/s6-decor.mjs holds all of this against the sheets as built.
import { ROCKS, STRAINS, POCKETS, FLOORS, POCKET_FLOORS, mix } from './tiles.mjs';

export const BAND = 6;            // how deep a piece may reach from its anchor side, in pixels

// ---- shapes. Keys: o shadow, a body, b lit, c highlight (lit from the upper left, as the tiles are); g a glow's
// core and d the dim light round it; m and n the two tones of a floor mark. A top shape is laid from the top row
// down, a bottom shape up from the bottom row, a side shape against the left edge in the middle rows.
const S = {
  // ---- top
  icicles: ['abbbaa.abbbaabba', '.bcba...bcb..bba', '.bab....bba...b.', '..bb.....b....c.', '..b......c......', '..c.............'],
  spears: ['.abbba..abbba.ab', '..bca....bcb..bb', '..bb.....bb...b.', '..bb......b...c.', '...b......c.....', '...c............'],
  glowtips: ['abbbaa.abbbaabba', '.bcba...bcb..bba', '.bab....bba...d.', '..bb.....d....g.', '..d......g......', '..g.............'],
  glowtips2: ['.abbba..abbbaa..', '..bca....bcba...', '..bb......bb....', '..bd......d.....', '..dg......g.....', '...g............'],
  shards: ['abba..abbba..aba', '.cb...cbba...cb.', '.c.....cb.....c.', '.c.....c......c.', '.......c........'],
  fringe: ['abbaabbaababbaab', 'ab.ba.ab.abb.aba', '.a..a..b..a...a.'],
  frost: ['bbcbbabbcbabbcbb', 'ab.c.ba.cb.a.bab', '.c...b...c...b..'],
  drips: ['aabbbaa.aabbbaa.', '.abcba...abcba..', '..bcb.....bcb...', '..bc......bc....', '...c.......c....', '...b............'],
  stubs: ['aabbaa...aabbaaa', '.abcb.....abcb..', '..bc.......bc...', '..b.........c...'],
  roots: ['.aab....aab...ab', '..ab....a.ab...a', '..a.b..ba..a..ba', '...a...a...b..a.', '...b..a....a....', '......b.........'],
  thick: ['aabbaa..aabbaa..', '..abba...abba...', '..ab.ab...ba.b..', '..a...a...a..a..', '..b....b..b..b..', '...........a....'],
  strands: ['.a....a....a....', '.a....a....a..a.', '.d....a....d..a.', '.g....d....g..d.', '......g.......g.'],
  strands2: ['...a.....a....a.', '...a.....a....a.', '...a.....d....a.', '...d.....g....a.', '...g..........d.', '..............g.'],
  threads: ['.a....a....a....', '.b....a....b..a.', '.a....b....a..b.', '.c....a....c..a.', '......c.......c.'],
  beads: ['.a....a....a....', '.a....a....a..a.', '.b....a....b..a.', '.c....b........b', '......c........c'],
  tendrils: ['aab...bba...aab.', '..b..b...b....b.', '..ab.a...ba..ba.', '...b..b...b..b..', '..ba..ab..a...b.', '..a.......b.....'],
  froth: ['abbaabbaabbaabba', 'b.ab.bcb.ab.bcab', '.ab...b...ab..b.', '..........b.....'],
  // ---- bottom
  mound: ['......bb........', '....bbbaa.......', '..bbbaaaaao...b.', '.bbaaaaaaaaoobba', 'bbaaaaaaaaaaoaao'],
  drift: ['.......bcc......', '....bccbbbaa....', '..bcbbbaaaaaaba.', '.cbbaaaaaaaaaaaa', 'cbaaaaaaaaaaaaaa'],
  heap: ['.........bb.....', '.bb....bbaab....', 'baab..baaaaab.b.', 'aaaabbaaaaaaabba'],
  spikes: ['...c.......c....', '..bc......bc....', '..bca.....bca.c.', '.bbca....bbca.bc', '.baaab..bbaaabba'],
  cones: ['....b...........', '...bcb.....b....', '..bcbba...bcb...', '.bcbbbaa.bcbba..', 'bcbbbbbaabbbbbaa'],
  shardsUp: ['....c......c....', '...cb.....cb....', '...ba..c..ba..c.', '..bba..cb.bba.cb', '..baaa.babbaaabb'],
  pebbles: ['..........bb....', '..bb.....bcba.b.', '.bcba.b..baaabca'],
  sprouts: ['..b........b....', '.bab..b...bab...', '..b..bab...b..b.', '..a...a....a.bab', '..a...a....a..a.'],
  fern: ['....c.......c...', '...cbc.....bcb..', '..b.b.b...b.b.b.', '...bab.....bab..', '....a.......a...', '....a.......a...'],
  ripples: ['..bbbb.....bbb..', '.bcccbb..bbcccb.', 'bbaaaabbbbaaaabb', 'aaaaaaaaaaaaaaaa'],
  ledges: ['.bbbbbba........', '.aaaaaao..bbbbba', '.........aaaaaao', 'bbbba...........', 'aaaao...........'],
  shell: ['....bbbb........', '...bcccbb.......', '...bc.bcb.......', '...bcab.b.......', '....baab........', '.....aaa........'],
  vent: ['.....d..........', '....dgd.........', '....dgd.........', '....bao.........', '...baaao........', '..baaaaao.......'],
  fumarole: ['......d.........', '.....dgd........', '.....dgd........', '......g.........', '....bbaao.......', '..bbaaaaaaoo....'],
  spires: ['...b.......b....', '..bcb.....bc....', '..bca.....bca...', '.bbcaa...bbcaa..', '.baaaab.bbaaaab.'],
  flowers: ['..d.........d...', '.dgd.......dgd..', '..a....d....a...', '..a...dgd...a...', '.bab...a...bab..', '..a...bab...a...'],
  flowers2: ['.......d........', '......dgd.......', '.d.....a....d...', 'dgd....a...dgd..', '.a....bab...a...', '.ab....a...bab..'],
  lichen: ['.....d..........', '....dgd......d..', '.b...b......dgd.', 'bab.bab..b...b..', 'aaabaaab.bab.bab'],
  twigs: ['......b.........', '..b..bb....b....', '...bab...bab.b..', '..baaab.baaab...'],
  flakes: ['.......bb.......', '..bbb..baab.bb..', '.baaab.....baab.'],
  puddle: ['..c.......c.....', '.abbbbbbbbbbba..', '..oaaaaaaaaao...'],
  knot: ['....bb..........', '..bbaab..bb.....', '.ba..aabbaab....', 'baab.baaabaab.b.'],
  // ---- side (against the left wall)
  feather: ['bc....', 'cbc...', 'b.b...', 'bcbc..', 'b.c...', 'cbc...', 'b.bc..', 'bcb...', 'b.....'],
  shelf: ['bbbb..', 'abbbb.', 'oaaa..', '......', 'bbb...', 'abbb..', 'oa....'],
  creep: ['ab....', 'abb...', '.a....', '.ab...', 'ab....', 'a.b...', '.a....', 'abb...', 'a.....', '.a....'],
  comb: ['bbbb..', 'b..b..', 'b..bb.', 'b..b..', 'bbbb..', 'b..b..', 'bbb...'],
  mosswall: ['bb....', 'abb...', 'aabb..', 'abb...', 'ab....', 'abb...', 'abbb..', 'ab....'],
  lichenwall: ['b.....', 'ab....', 'adg...', 'ab.d..', 'a.....', 'abd...', 'adg...', 'a.....'],  // ---- the seams' and the deep strains' (generation 2)
  // top: frosted quartz points; amber glass run in long drips; blocks of ice hanging (seracs); druse crystals
  quartz: ['abbaabbbaa.abbba', '.bcb..bcb...bcb.', '.bc....cb...bc..', '..c....c.....c..', '.......c........'],
  glassdrips: ['abbbaaabbbaabbba', '.bcb...bcb..bcb.', '.bcb....b...bc..', '..c.....c....c..', '..c..........c..', '..b.............'],
  seracs: ['abbbbba.abbbbbbb', 'abccbba..abccbba', '.bccba...abcba..', '.abba.....bba...', '..ba......ba....', '..b.......b.....'],
  crystals: ['abbbabbbaabbbabb', '.cb.bc..bcb.cb..', '.c...c...c...c..', '.....c.......c..'],
  // bottom: cairns with frost on their caps; hoodoos the wind cut; charred reeds; an ember-lit stump; ice mushrooms
  // (ice on a stem, flat-capped: nothing like a toadstool); slag cones; slime moulds' stalks with lit heads (round,
  // on a hair of a stalk: nothing like a cap); a druse's crystals standing
  cairns: ['...cc...........', '..bbbb.....cc...', '...aa.....bbbb..', '..bbbbb....aa...', '.oaaaaao..bbbbb.', 'oaaaaaaaoaaaaaao'],
  hoodoos: ['..bbb.......bbbb', '..aba........ab.', '...a.........ab.', '..bab.......bab.', '.baaab.....baaab', 'baaaaao...baaaao'],
  reeds: ['..c......c......', '..b.....bc...c..', '..b..c...b...b..', '.ab..b...b..ab..', '.ab..b..ab..ab..', 'oaaooaooaaooaaoo'],
  stump: ['....d...........', '...dgd..........', '..bbgbb.........', '..baaab.........', '..baaao.........', '.oaaaaao........'],
  icecaps: ['.bbcccb....bccb.', '.oaaaao....oaao.', '...ab.......a...', '...ab.......b...', '...ab......bab..', '..baab.....aaa..'],
  slagcones: ['....b......b....', '...bab....bab...', '..baoab..baoab..', '..baaab..baaaab.', '.baaaaab.baaaaab', 'baaaaaaaobaaaaao'],
  sporangia: ['..d.......d.....', '.dgd.....dgd....', '..d...d...d.....', '..a..dgd..a.....', '..a...a...a..b..', '.bab..a..bab.ab.'],
  crystalsUp: ['..c.....c.......', '..cb...bc....c..', '.bcb..bcb...bc..', '.bab.bbab..bbab.', 'baaabaaaab.baaab'],
  // side: hoar on the wall; glass shards set in it; the wind's scallops; a crust of sulphur; a druse's crystals
  hoar: ['b.....', 'cb....', 'bcb...', 'b.c...', 'bc....', 'cbc...', 'b..c..', 'bcb...'],
  shardwall: ['bc....', 'abc...', 'ab....', '......', 'bbc...', 'abbc..', 'ab....'],
  scallops: ['bb....', '.cb...', '.ab...', 'bb....', '.cb...', '.ab...', 'bb....', '.cb...'],
  crustwall: ['bc....', 'bbc...', 'ab....', 'abb...', 'bc....', 'abc...', 'a.....'],
  crystalwall: ['ac....', 'abc...', 'aa....', '......', 'ab....', 'aabc..', 'aa....'],
};
// Floor marks: faint, anywhere in the cell, as [x, y, rows]. They are the back wall of the cave showing through.
const M = {
  pebbles: [[2, 4, ['.nn...', 'n..m..', '.mm...', '......', '....nn', '...n.m', '....m.']]],
  hair: [[3, 2, ['n.....', '.n....', '.m.n..', '..m.n.', '....m.', '.....m']]],
  craze: [[2, 3, ['n.......', '.n...n..', '..nnn.m.', '.n....m.', 'm......m']]],
  star: [[5, 5, ['..n..', 'm.n.m', '.nnn.', 'm.n.m', '..n..']]],
  sheets: [[1, 5, ['nnnnnmm.....', '.......mmnn.']], [3, 11, ['mmnnnn..']]],
  flow: [[1, 4, ['..nnn.......', 'nn...nn.....', '.......mmn..', '..........mm']]],
  cracks: [[3, 3, ['n.....', '.n....', '.nm...', '..n...', '..mn..', '....m.']]],
  bubbles: [[3, 4, ['.nn.....', 'n..m....', '.mm..n..', '....n.m.', '.....m..']]],
  specks: [[2, 3, ['n.......', '....m...', '..n.....', '.......n', '.m......', '....n...', '........', '..m...n.']]],
  spores: [[3, 3, ['n.....n.', '...m....', '.n......', '......m.', '..n.....', 'm....n..']]],
  rootmark: [[4, 1, ['.n....', 'n.....', '.m....', '..n...', '..m.n.', '...m..', '....m.']]],
  petals: [[4, 4, ['.n...', 'nmn..', '.n...', '....n', '...nm']]],
  strata: [[0, 5, ['nnnnnnnmmmnnnnnn']], [0, 10, ['mmmmnnnnnnmmmmmm']]],
  grain: [[3, 3, ['n...n...', 'n...m..n', 'm......n', '...n...m', '...m....']]],
  ripple: [[2, 6, ['.nnn....nnn.', 'n...mmmm...m']]],
  drops: [[4, 4, ['n.....', 'm.....', '....n.', '....m.', '.n....']]],
  wet: [[6, 1, ['n.', 'n.', '.m', '.n', '.n', 'm.', 'n.', '.m', '.m']]],
  soot: [[2, 4, ['.mm.....', 'mnnm..m.', '.mm..mnm', '......m.']]],
  flake: [[3, 6, ['nnnmm.....', '.....mmnn.']]],
};

// ---- each set: the shapes it draws in each place, the ground it is made for (its floor and rock sheets, which its
// colours come from) and its glow. `hue` takes the body toward a colour of its own; `falls` names the top shapes
// that are icicles (the game may let one fall: js/decor.js, `falls`).
export const HALOS = {
  ice: { g: '#eef8ff', d: '#b8d8f8', halo: '#d0e8ff' },
  sulphur: { g: '#dce8ff', d: '#3a5cff', halo: '#3e64ff' },
  wisp: { g: '#e8eeff', d: '#3448ff', halo: '#3a50ff' },
  rose: { g: '#ff9ab8', d: '#ff4a8a', halo: '#ff5a90' },
  phosphor: { g: '#d0ffc0', d: '#6ae078', halo: '#7af08a' },
  // (Not a piece's: the spore pods' own, laid over the dark about each one near the drill: js/drawing.js, `podHalos`.)
  toxin: { g: '#ffd8ff', d: '#e060ff', halo: '#f070ff' },
};
export const SETS = [
  { name: 'crust', floor: 'crust-floor', rock: 'crust', hue: '#8c8866', top: ['roots', 'thick', 'drips'], bottom: ['pebbles', 'mound'], side: ['creep'], marks: ['pebbles', 'hair'] },
  { name: 'frost', floor: 'frost-floor', rock: 'frost', top: ['icicles', 'spears', 'frost'], bottom: ['drift', 'fern'], side: ['feather'], marks: ['craze', 'star'], falls: ['icicles', 'spears'] },
  { name: 'rime', floor: 'rime-floor', rock: 'rime', hue: '#7a88a8', top: ['glowtips', 'glowtips2', 'spears', 'frost'], bottom: ['shardsUp', 'fern'], side: ['feather'], marks: ['star', 'craze'], glow: 'ice', falls: ['glowtips', 'glowtips2', 'spears'] },
  { name: 'firn', floor: 'frost-floor', rock: 'firn', top: ['fringe', 'icicles'], bottom: ['drift', 'heap'], side: ['feather'], marks: ['sheets', 'star'], falls: ['icicles'] },
  { name: 'serac', floor: 'frost-floor', rock: 'serac', top: ['shards', 'spears'], bottom: ['shardsUp', 'spikes'], side: ['feather'], marks: ['craze', 'cracks'], falls: ['shards', 'spears'] },
  { name: 'ember', floor: 'ember-floor', rock: 'ember', top: ['drips', 'stubs'], bottom: ['vent', 'heap', 'fumarole', 'mound'], side: [], marks: ['flow', 'cracks'], glow: 'sulphur' },
  { name: 'magma', floor: 'magma-floor', rock: 'magma', top: ['drips', 'stubs'], bottom: ['fumarole', 'spires', 'vent'], side: [], marks: ['cracks', 'flow'], glow: 'sulphur' },
  { name: 'scoria', floor: 'ember-floor', rock: 'scoria', top: ['froth'], bottom: ['heap', 'mound'], side: [], marks: ['bubbles', 'bubbles'] },
  { name: 'forge', floor: 'ember-floor', rock: 'forge', top: ['stubs', 'drips'], bottom: ['vent', 'heap', 'fumarole'], side: [], marks: ['flow', 'soot'], glow: 'sulphur' },
  { name: 'mire', floor: 'mire-floor', rock: 'mire', hue: '#3e6a44', top: ['strands', 'strands2', 'fringe', 'roots'], bottom: ['sprouts', 'fern'], side: ['shelf', 'mosswall'], marks: ['specks', 'rootmark'], glow: 'wisp' },
  { name: 'bloom', floor: 'bloom-floor', rock: 'bloom', hue: '#a83a5a', top: ['tendrils', 'roots'], bottom: ['flowers', 'flowers2', 'sprouts'], side: ['shelf'], marks: ['petals', 'specks'], glow: 'rose' },
  { name: 'tangle', floor: 'mire-floor', rock: 'tangle', top: ['thick', 'roots'], bottom: ['knot', 'sprouts'], side: ['creep'], marks: ['rootmark', 'specks'] },
  { name: 'sporefall', floor: 'mire-floor', rock: 'sporefall', hue: '#9a9488', top: ['threads', 'fringe'], bottom: ['sprouts', 'fern'], side: ['shelf'], marks: ['spores', 'specks'] },
  { name: 'lode', floor: 'lode-floor', rock: 'lode', top: ['drips', 'stubs'], bottom: ['ripples', 'shell'], side: [], marks: ['strata', 'ripple'] },
  { name: 'gilt', floor: 'gilt-floor', rock: 'gilt', top: ['drips', 'stubs'], bottom: ['ripples', 'lichen'], side: ['lichenwall'], marks: ['ripple', 'grain'], glow: 'phosphor' },
  { name: 'redrock', floor: 'lode-floor', rock: 'redrock', top: ['drips', 'stubs'], bottom: ['ledges', 'ripples'], side: [], marks: ['strata', 'strata'] },
  { name: 'loess', floor: 'lode-floor', rock: 'loess', top: ['fringe'], bottom: ['cones', 'ripples'], side: [], marks: ['grain', 'ripple'] },
  { name: 'hive', floor: 'wax-floor', rock: 'wax', hue: '#a09a8a', top: ['drips', 'stubs'], bottom: ['heap'], side: ['comb'], marks: ['drops', 'drops'] },
  { name: 'grotto', floor: 'grotto-floor', rock: 'grotto', top: ['beads', 'threads'], bottom: ['puddle'], side: [], marks: ['wet', 'drops'] },
  { name: 'tinder', floor: 'tinder-floor', rock: 'tinder', top: ['stubs'], bottom: ['twigs'], side: [], marks: ['soot', 'soot'] },
  { name: 'glaze', floor: 'glaze-floor', rock: 'glaze', top: ['frost'], bottom: [], side: [], marks: ['star', 'craze'] },
  { name: 'shale', floor: 'shale-floor', rock: 'shale', top: [], bottom: ['flakes'], side: [], marks: ['flake', 'grain'] },  // The seams' and the deep strains' (generation 2: a deep seam has its seam's set). Each glows, if at all, as its
  // direction's own ground does: the south's sulphur in the cinderfen's stumps and the caldera's fumaroles, and in
  // the mycelium the rose of the bloom it is a strain of, on the heads of its slime moulds.
  { name: 'hoarstone', floor: 'hoarstone-floor', rock: 'hoarstone', top: ['quartz', 'frost'], bottom: ['cairns', 'drift'], side: ['hoar'], marks: ['craze', 'star'] },
  { name: 'glassdune', floor: 'glassdune-floor', rock: 'glassdune', top: ['glassdrips', 'stubs'], bottom: ['hoodoos', 'ripples'], side: ['shardwall'], marks: ['ripple', 'grain'] },
  { name: 'cinderfen', floor: 'cinderfen-floor', rock: 'cinderfen', top: ['drips', 'roots'], bottom: ['reeds', 'stump', 'heap'], side: [], marks: ['soot', 'bubbles'], glow: 'sulphur' },
  { name: 'frostfen', floor: 'frostfen-floor', rock: 'frostfen', top: ['frost', 'fringe'], bottom: ['icecaps', 'reeds', 'fern'], side: ['mosswall'], marks: ['star', 'specks'] },
  { name: 'glacier', floor: 'rime-floor', rock: 'glacier', top: ['seracs', 'icicles'], bottom: ['drift', 'heap'], side: ['scallops'], marks: ['sheets', 'craze'], falls: ['icicles'] },
  { name: 'caldera', floor: 'magma-floor', rock: 'caldera', top: ['stubs', 'drips'], bottom: ['slagcones', 'fumarole', 'spires'], side: ['crustwall'], marks: ['cracks', 'soot'], glow: 'sulphur' },
  { name: 'mycelium', floor: 'bloom-floor', rock: 'mycelium', top: ['threads', 'tendrils'], bottom: ['sporangia', 'sprouts'], side: ['shelf'], marks: ['spores', 'hair'], glow: 'rose' },
  { name: 'druse', floor: 'gilt-floor', rock: 'druse', top: ['crystals', 'stubs'], bottom: ['crystalsUp', 'pebbles'], side: ['crystalwall'], marks: ['grain', 'specks'] },
];
// The crosses' pieces, host by donor: the donor's shapes at the host's brightness. (The four directions' own sets.)
const KIN_SETS = ['frost', 'ember', 'mire', 'lode'];
export const CROSS_SETS = KIN_SETS.flatMap(host => KIN_SETS.filter(d => d !== host).map(donor => [host, donor]));

// ---- colours
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const hex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const luma = h => { const [r, g, b] = rgb(h); return 0.299 * r + 0.587 * g + 0.114 * b; };
// A colour of the same hue at the brightness `y` (as near as 255 lets it).
const at = (h, y) => { const c = rgb(h), l = luma(h) || 1; return hex(c.map(v => v * y / l)); };
const sheetOf = name => [...ROCKS, ...STRAINS, ...POCKETS].find(r => r.name === name).palette;
const floorOf = name => [...FLOORS, ...POCKET_FLOORS].find(r => r.name === name).palette;
// A set's colours: the shadow between its floor and its rock's dark band, the body and its lit side two fifths and
// three fifths of the way from the dark band to the rock's own colour, the highlight just under that colour, all
// taken toward `hue` where it has one (at the same brightness); its glow's two; and the marks' two tones, between
// the floor and the dark band.
export function paletteOf(set) {
  const fl = floorOf(set.floor).f, r = sheetOf(set.rock), D = r.D, f = r.f;
  const tone = (from, to, t) => { const c = mix(from, to, t); return set.hue ? at(mix(c, at(set.hue, luma(c)), 0.6), luma(c)) : c; };
  const p = { o: tone(fl, D, 0.85), a: tone(D, f, 0.4), b: tone(D, f, 0.62), c: tone(D, f, 0.95), m: tone(fl, D, 0.55), n: tone(fl, D, 0.9) };
  const glow = set.glow ? HALOS[set.glow] : HALOS.ice;
  return { ...p, g: glow.g, d: glow.d };
}
const BASE = { o: '#000000', a: '#000000', b: '#000000', c: '#000000', g: '#000000', d: '#000000', m: '#000000', n: '#000000' };
const pad = row => (row + '................').slice(0, 16);
// The frames of one set: [name, ops, palette, glow centre or null, falls].
function framesOf(name, set, palette, places) {
  const out = [];
  for (const place of places) {
    const shapes = place === 'left' || place === 'right' ? set.side : place === 'floor' ? set.marks : set[place];
    shapes.forEach((shape, n) => {
      const frame = `${name}-${place}-${n}`;
      let ops, rows, x0, y0, flip = false;
      if (place === 'floor') {
        ops = M[shape].map(([x, y, r]) => ({ op: 'grid', x, y, rows: r }));
        rows = null;
      } else {
        rows = S[shape];
        if (!rows) throw new Error(`${name}: there is no shape called ${shape}`);
        if (place === 'top' || place === 'bottom') { rows = rows.map(pad); x0 = 0; y0 = place === 'top' ? 0 : 16 - rows.length; }
        else { x0 = place === 'left' ? 0 : 16 - rows[0].length; y0 = Math.floor((16 - rows.length) / 2); flip = place === 'right'; }
        ops = [{ op: 'grid', x: x0, y: y0, rows, ...(flip && { flipX: true }) }];
      }
      // Where its glow is: the middle of its g pixels, as drawn.
      let glow = null;
      if (rows && set.glow) {
        let sx = 0, sy = 0, k = 0;
        rows.forEach((row, v) => [...row].forEach((ch, u) => { if (ch === 'g') { sx += flip ? x0 + row.length - 1 - u : x0 + u; sy += y0 + v; k++; } }));
        if (k) glow = [Math.round(sx / k * 2) / 2 + 0.5, Math.round(sy / k * 2) / 2 + 0.5, `halo-${set.glow}`];
      }
      out.push({ frame, ops, palette, glow, falls: place === 'top' && (set.falls ?? []).includes(shape) });
    });
  }
  return out;
}
const recipe = (name, frames) => ({
  version: 1, name, width: 16, height: 16, palette: BASE,
  frames: frames.map(f => ({ name: f.frame, duration: 100, palette: f.palette, ops: f.ops })),
  sheet: { columns: 16 },
});
const extra = frames => ({
  glows: Object.fromEntries(frames.filter(f => f.glow).map(f => [f.frame, f.glow])),
  falls: frames.filter(f => f.falls).map(f => f.frame),
});

const own = SETS.flatMap(set => framesOf(set.name, set, paletteOf(set), ['top', 'bottom', 'left', 'right', 'floor']));
// A cross's donor pieces: each colour two fifths the donor's and three the host's, at the brightness of the host's (all the
// donor's own, and the mire's moss came out mint in the north, the colour of the north's gems).
const crossed = CROSS_SETS.flatMap(([host, donor]) => {
  const h = paletteOf(SETS.find(s => s.name === host)), dset = SETS.find(s => s.name === donor), d = paletteOf(dset);
  const palette = { ...h, ...Object.fromEntries(['o', 'a', 'b', 'c'].map(k => [k, at(mix(at(d[k], luma(h[k])), h[k], 0.6), luma(h[k]))])), g: d.g, d: d.d };
  return framesOf(`${host}-${donor}`, dset, palette, ['top', 'bottom', 'left', 'right']);
});

// ---- the halos: three soft rings and a small bright middle, in the glow's colour.
const halo = (name, color) => ({
  name: `halo-${name}`, duration: 100, ops: [
    { op: 'ellipse', x: 1, y: 1, w: 22, h: 22, color: `${color}1c`, filled: true },
    { op: 'ellipse', x: 4, y: 4, w: 16, h: 16, color: `${color}2a`, filled: true },
    { op: 'ellipse', x: 7, y: 7, w: 10, h: 10, color: `${color}40`, filled: true },
    { op: 'ellipse', x: 10, y: 10, w: 4, h: 4, color: `${color}60`, filled: true },
  ],
});

// ---- the air: white, shaded by alpha. Tinted at run time in the mote's colour.
const W = a => `#ffffff${a}`;
const air = {
  version: 1, name: 'air', width: 5, height: 5, palette: { w: '#ffffff', h: W('a0'), q: W('50') },
  frames: [
    { name: 'flake-a', duration: 700, ops: [{ op: 'grid', x: 1, y: 1, rows: ['.h.', 'hwh', '.h.'] }] },
    { name: 'flake-b', duration: 700, ops: [{ op: 'grid', x: 1, y: 1, rows: ['q.q', '.w.', 'q.q'] }] },
    { name: 'ember-a', duration: 90, ops: [{ op: 'grid', x: 2, y: 2, rows: ['ww', 'q.'] }] },
    { name: 'ember-b', duration: 90, ops: [{ op: 'grid', x: 2, y: 2, rows: ['w', 'q'] }] },
    { name: 'ember-c', duration: 90, ops: [{ op: 'grid', x: 2, y: 2, rows: ['h'] }] },
    { name: 'spore-a', duration: 400, ops: [{ op: 'grid', x: 1, y: 1, rows: ['qq.', 'qwq', '.qq'] }] },
    { name: 'spore-b', duration: 400, ops: [{ op: 'grid', x: 1, y: 1, rows: ['.q.', 'qwq', '.q.'] }] },
    { name: 'firefly-on', duration: 300, ops: [{ op: 'grid', x: 1, y: 1, rows: ['qhq', 'hwh', 'qhq'] }] },
    { name: 'firefly-dim', duration: 150, ops: [{ op: 'grid', x: 2, y: 2, rows: ['h'] }] },
    { name: 'firefly-off', duration: 250, ops: [{ op: 'grid', x: 2, y: 2, rows: ['q'] }] },
    { name: 'glint-a', duration: 160, ops: [{ op: 'grid', x: 2, y: 2, rows: ['w'] }] },
    { name: 'glint-b', duration: 160, ops: [{ op: 'grid', x: 0, y: 0, rows: ['..q..', '..h..', 'qhwhq', '..h..', '..q..'] }] },
    { name: 'ash-a', duration: 500, ops: [{ op: 'grid', x: 1, y: 2, rows: ['hw', '.q'] }] },
  ],
  animations: {
    flake: { frames: ['flake-a', 'flake-b'], loop: true },
    ember: { frames: ['ember-a', 'ember-b', 'ember-c', 'ember-b'], loop: true },
    spore: { frames: ['spore-a', 'spore-b'], loop: true },
    firefly: { frames: ['firefly-on', 'firefly-dim', 'firefly-off', 'firefly-off', 'firefly-dim'], loop: true },
    glint: { frames: ['glint-a', 'glint-b', 'glint-a', 'glint-a', 'glint-a'], loop: true },
    ash: { frames: ['ash-a'], loop: true },
  },
  sheet: { columns: 13 },
};

// What art/build.mjs builds: [recipe, what goes into the atlas beside its frames].
export const DECOR_RECIPES = [
  [recipe('decor', own), extra(own)],
  [recipe('decor-x', crossed), extra(crossed)],
  [{ version: 1, name: 'halo', width: 24, height: 24, palette: { w: '#ffffff' }, frames: Object.entries(HALOS).map(([n, h]) => halo(n, h.halo)) }, {}],
  [air, {}],
];
