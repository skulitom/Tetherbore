// ------------------------------------------------------------------ the creatures of the ground (js/fauna.js)
// Each creature is drawn here a pose at a time, facing east, and turned to face west by the sheet (`-l`): a frame is
// `<kind>-<pose>` and `<kind>-<pose>-l`. Each is a fill alone ringed with its direction's own outline (`k`, as the
// ores are), so it is always closed and reads against its rock; its colours are its own, on the frame.
// Lit from the upper left: a light, b body, c shade; d and the rest accents of its own.
// One rule says who to keep away from: a friend's eye is plain white with a dark pupil (`w`, `p`), seen only where
// the lamp falls; a foe's eyes are the one colour no ore, hazard, glow or tether is drawn in (`e`, FOE_EYE), and the
// game lays them again over the dark, so a foe's eyes are seen across the screen (`eyes`, which the build writes
// into the atlas beside the frames: where each frame's foe eyes are). A creature that gives light says which of its
// colours is lit (`lamps`), and the build writes where those pixels lie in each frame the same way, for the game to
// lay its light on them and nowhere else.
// A creature that stands on a floor is drawn with its feet on the frame's last row; one that hangs from a ceiling,
// with its top on the first; one that flies, about the middle.

export const FOE_EYE = '#ff2bd6';
const OUTLINE = { home: '#1e1610', north: '#22395a', south: '#160c12', west: '#1c1426', east: '#3a2414', hive: '#201810', drift: '#0e1a30', grotto: '#06201e' };

// Every key a frame may use, so the sheet has them all (each frame sets its own).
const KEYS = Object.fromEntries([...'kabcdefghlmnprstwxyz'].map(c => [c, '#000000']));

// The creatures, each with its outline, its colours and its poses: [pose, rows, where: 'floor' | 'ceil' | 'air',
// how long a frame lasts (ms)]. A pose may be the rows of another turned (`rotate`).
export const CREATURES_ART = {
  // HOME. The pebble beetle: a grey-brown shell with a lighter rim, its legs flickering; it tucks into a ball.
  beetle: {
    outline: 'home', palette: { x: '#c8b8a0', a: '#9c8c76', b: '#786852', c: '#524436', h: '#3c3026', w: '#e8e0d0', d: '#2e2418' },
    poses: {
      'walk-a': [['...xxxx....', '..xaaaax...', '.xaabbbac...', '.abbbbbbbhh.', '.bccccccchwh', '..d.d..d.d..'], 'floor'],
      'walk-b': [['...xxxx....', '..xaaaax...', '.xaabbbac...', '.abbbbbbbhh.', '.bccccccchwh', '.d.d..d.d...'], 'floor'],
      'ball-a': [['..xxx..', '.xaaax.', 'xaabbac', 'xabbbbc', 'abbbbcc', '.bcccc.', '..ccc..'], 'floor'],
      'ball-b': [['..xxx..', '.xaaax.', 'xaabbac', 'xabbbbc', 'abbbbcc', '.bcccc.', '..ccc..'], 'floor', { rotate: 90 }],
      'ball-c': [['..xxx..', '.xaaax.', 'xaabbac', 'xabbbbc', 'abbbbcc', '.bcccc.', '..ccc..'], 'floor', { rotate: 180 }],
      'ball-d': [['..xxx..', '.xaaax.', 'xaabbac', 'xabbbbc', 'abbbbcc', '.bcccc.', '..ccc..'], 'floor', { rotate: 270 }],
    },
  },
  // The burrowpup: a mole pup, round, with a pale snout, a pink nose, claws and a big white eye.
  pup: {
    outline: 'home', palette: { a: '#b8987a', b: '#8e6e54', c: '#634a38', s: '#ecd0b0', n: '#ff8aa0', z: '#f4e8dc', w: '#ffffff', p: '#1a1010', m: '#4a1e22' },
    poses: {
      'idle-a': [['....aaaa.....', '..aabbbbaa...', '.abbbbbbbbwwa.', 'abbbbbbbbwwpb.', 'abbbbbbbbbbsss', 'bbbbbbbbbbbssn', 'cbbbbbbbbbbss.', '.cccccccccc...', '..zz....zz....'], 'floor'],
      'idle-b': [['..............', '....aaaa......', '..aabbbbaa....', '.abbbbbbbbwwa.', 'abbbbbbbbwwpb.', 'abbbbbbbbbbsss', 'bbbbbbbbbbbssn', 'cccccccccccss.', '..zz....zz....'], 'floor'],
      'walk-a': [['....aaaa.....', '..aabbbbaa...', '.abbbbbbbbwwa.', 'abbbbbbbbwwpb.', 'abbbbbbbbbbsss', 'bbbbbbbbbbbssn', 'cbbbbbbbbbbss.', '.cccccccccc...', '.zz......zz...'], 'floor'],
      'walk-b': [['..............', '....aaaa......', '..aabbbbaa....', '.abbbbbbbbwwa.', 'abbbbbbbbwwpb.', 'abbbbbbbbbbsss', 'bbbbbbbbbbbssn', 'cccccccccccss.', '...zz..zz.....'], 'floor'],
      blink: [['....aaaa.....', '..aabbbbaa...', '.abbbbbbbbbba.', 'abbbbbbbbccbb.', 'abbbbbbbbbbsss', 'bbbbbbbbbbbssn', 'cbbbbbbbbbbss.', '.cccccccccc...', '..zz....zz....'], 'floor'],
      yip: [['..........aa..', '....aaaa.abba.', '..aabbbbabwwa.', '.abbbbbbbwwpbs', 'abbbbbbbbbbssn', 'abbbbbbbbbbmm.', 'bbbbbbbbbbbss.', 'cbbbbbbbbbc...', '.cccccccccc...', '..zz....zz....'], 'floor'],
      sniff: [['..............', '....aaaa......', '..aabbbbaa....', '.abbbbbbbbba..', 'abbbbbbbbbwwa.', 'abbbbbbbbbwpb.', 'bbbbbbbbbbbsss', 'cbbbbbbbbbbssn', '.cccccccc.zz..'], 'floor'],
      sleep: [['....aaaaa....', '..aabbbbbaa..', '.abbbbbbbbba.', 'abbbbbbbbbccb', 'bbbbbbbbbbsns', 'cbbbbbbbbbss.', '.ccccccccccc.'], 'floor'],
      ride: [['..aaaa...', '.abbbbww.', 'abbbbbwpb', 'bbbbbbbss', 'zbbbbbssn', '.zcccccz.'], 'air'],
    },
  },
  // NORTH. The lumen moth: pale wings with lilac eyespots, beating in three drawings.
  moth: {
    outline: 'north', palette: { a: '#ffffff', b: '#e8f2ff', c: '#b4c4dc', l: '#8a8ac8', d: '#7a6a94', w: '#ffffff', p: '#22395a' },
    poses: {
      'flap-a': [['.bb.....bb.', 'bbbb...bbbb', 'blbbb.bbblb', '.bbbbdbbbb.', '..cbbdbbc..', '....ddd....', '....d.d....'], 'air'],
      'flap-b': [['...........', 'bbb.....bbb', 'blbbbdbbblb', 'bbbbbdbbbbb', '.cbbbdbbbc.', '....ddd....', '....d.d....'], 'air'],
      'flap-c': [['...........', '....wdw....', '.bbbbdbbbb.', 'blbbbdbbblb', 'bbbb.d.bbbb', '.bb..d..bb.', '...........'], 'air'],
    },
  },
  // The rime spitter: a squat toad of frosted grey with white warts, its eyes bulging on top; its throat swells
  // pale before it spits.
  spitter: {
    outline: 'north', palette: { a: '#d8d4e4', b: '#a8a4bc', c: '#74708e', f: '#ffffff', e: FOE_EYE, m: '#1c1a2c', g: '#f0ecf8' },
    poses: {
      sit: [['.aa......aa.', 'aeea....aeea', 'abbba..abbba', '.abbbbbbbbb.', 'abbfbbbbfbbb', 'bbbbbbfbbbbc', 'bmmmmmmmmmmc', 'cbbbbbbbbbbc', '.cbbfbbbbbc.', 'cc.c....c.cc'], 'floor'],
      'puff-a': [['.aa......aa.', 'aeea....aeea', 'abbba..abbba', '.abbbbbbbbb.', 'abbfbbbbfbbb', 'bmmmmmmmmmmc', 'cbggggggggbc', 'cggggggggggc', '.cbggggggbc.', 'cc.c....c.cc'], 'floor'],
      'puff-b': [['..aa......aa..', '.aeea....aeea.', '.abbba..abbba.', 'aabbbbbbbbbbba', 'abbfbbbbbbfbbb', 'bbmmmmmmmmmmbc', 'cggggggggggggc', 'cggggggfgggggc', 'cggggggggggggc', '.cggggggggggc.', '..cc.c....c.cc'], 'floor'],
      spit: [['.aa......aa.', 'aeea....aeea', 'abbba..abbba', '.abbbbbbbbb.', 'abmmmmmmmmbb', 'bmffffffffmc', 'cbmmmmmmmmbc', 'cbbbbbbbbbbc', '.cbbfbbbbbc.', 'cc.c....c.cc'], 'floor'],
      sag: [['............', '.aa......aa.', 'acca....acca', 'abbba..abbba', '.abbbbbbbbb.', 'abbfbbbbfbbb', 'bbbmmmmmmbbc', 'cbbbbbbbbbbc', '.cbbfbbbbbc.', 'cc.c....c.cc'], 'floor'],
      glob: [['.ff.', 'fggf', 'fgaf', '.ff.'], 'air'],
    },
  },
  // SOUTH. The ember salamander: slate-dark with ash spots and a dim heat line along its back; never lava's
  // orange nor slag's grey.
  salamander: {
    outline: 'south', palette: { a: '#8a7488', b: '#62506a', c: '#3e3046', h: '#d8785a', s: '#bcaebc', w: '#ffffff', p: '#160c12', d: '#3e3046' },
    poses: {
      'walk-a': [['......hhhhh...', 'b.bbbbbbbbbbaw', 'abbsbbbbsbbbbp', '..d...d...d..d'], 'floor'],
      'walk-b': [['......hhhhh...', '.bbbbbbbbbbbaw', 'bbbsbbbbsbbbbp', '...d...d...d.d'], 'floor'],
      bask: [['......hhhhh...', '..bbbbbbbbbbaw', 'bbbsbbbbsbbbbp', '.c.cc..cc.cc..'], 'floor'],
      swim: [['.....hhhhh.aw', 'bbbbbbbbbbbbb'], 'floor'],
    },
  },
  // The cinder bat: charcoal violet; it hangs head down in its roost, swoops, and clings where it stopped.
  bat: {
    outline: 'south', palette: { a: '#9484a8', b: '#685878', c: '#42364e', m: '#a898bc', e: FOE_EYE, d: '#2a2030' },
    poses: {
      'hang-a': [['..d.d..', '..bbb..', '.abbba.', 'ccbbbcc', 'cmbbbmc', 'cmbbbmc', '.cebec.', '..bbb..', '...b...'], 'ceil'],
      'hang-b': [['..d.d..', '..bbb..', '.abbba.', 'ccbbbcc', 'cmbbbmc', '.mbbbm.', '.cebec.', '..bbb..', '..b....'], 'ceil'],
      'fly-a': [['cc..........cc', 'cmc..b..b..cmc', 'cmmc.bbbb.cmmc', '.cmmbebbebmmc.', '..cccbbbbccc..', '.....bbbb.....', '......bb......'], 'air'],
      'fly-b': [['......b..b....', '.....bbbb.....', '....bebbeb....', '.ccmmbbbbmmcc.', 'cmmmccbbccmmmc', 'cmcc..bb..ccmc', 'cc..........cc'], 'air'],
      rest: [['..d.d..', '..bbb..', '.cbbbc.', 'cbbbbbc', 'cbbbbbc', '.cbbbc.', '..ccc..'], 'ceil'],
    },
  },
  // WEST. The mire frog: olive and violet, croaking in a slow rhythm, its throat swelling.
  frog: {
    outline: 'west', palette: { a: '#b0aa6c', b: '#88844e', c: '#5a4a6e', t: '#d8c088', w: '#ffffff', p: '#1c1426', d: '#76668e' },
    poses: {
      sit: [['.aw...wa.', 'abpbbbpba', 'abbbbbbbb', 'dbbbbbbbd', 'cbbbbbbbc', 'cc.c.c.cc'], 'floor'],
      croak: [['.aw...wa.', 'abpbbbpba', 'abbbbbbbb', 'dbbtttbbd', 'cbtttttbc', 'cc.ttt.cc'], 'floor'],
      hop: [['.aw...wa.', 'abpbbbpba', 'abbbbbbbb', 'dbbbbbbbd', '.cbbbbbc.', '.c.c.c.c.', 'c.......c'], 'floor'],
    },
  },
  // The puffling: a lavender puff of spores with darker dots, eyes and a smile; it drifts and bobs.
  puff: {
    outline: 'west', palette: { a: '#fff6e8', b: '#f4dcc4', c: '#d4b090', d: '#c8a080', w: '#ffffff', p: '#1c1426', m: '#5a3a3a' },
    poses: {
      'drift-a': [['...aaaa...', '.aabbbbaa.', '.abdbbbbba', 'abbbbbdbbb', 'abwpbbwpbb', 'abbbbbbbbc', 'bdbbmmbbdc', '.bbbbbbbc.', '.cbbbbbcc.', '..cccccc..'], 'air'],
      'drift-b': [['..aaaaa...', '.abbbbbaa.', 'aabdbbbbba', 'abbbbbbdbb', 'abwpbbbwpb', 'abbbbbbbbc', 'bdbbmmmbdc', 'bbbbbbbbbc', '.cbbbbbbc.', '..cccccc..'], 'air'],
      shy: [['...aaaa...', '.aabbbbaa.', '.abdbbbbba', 'abbbbbdbbb', 'abppbbppbb', 'abbbbbbbbc', 'bdbbbbbbdc', '.bbbmmbbc.', '.cbbbbbcc.', '..cccccc..'], 'air'],
      caught: [['...aaaa...', '.aabbbbaa.', '.abdbbbbba', 'abpbpbpbpb', 'abbpbbbpbb', 'abpbpbpbpc', 'bdbbmmbbdc', '.bbmbbmbc.', '.cbbmmbcc.', '..cccccc..'], 'air'],
    },
  },
  // The cave leech: hanging and swaying, a drip at its tip; latched to the hull, a fat comma. Its outline is the
  // colour of the west's dark air, so its body is the paler for it: a mauve the lamp shows as a stalk, not a spark.
  leech: {
    outline: 'west', palette: { a: '#d0aac0', b: '#a07c92', c: '#6c4c60', e: FOE_EYE, d: '#cab4ca' },
    poses: {
      'hang-a': [['.bbb.', '..bc.', '.abc.', '.bbc.', '..bc.', '.abc.', '.ebe.', '..b..'], 'ceil'],
      'hang-b': [['.bbb.', '.bc..', '.abc.', '..bbc', '..bc.', '.abc.', '.ebe.', '..b..'], 'ceil'],
      stiff: [['.bbb.', '.abc.', '.abc.', '.abc.', '.abc.', '.abc.', '.ebe.', '.bbb.'], 'ceil'],
      fall: [['.bbb.', 'abbbc', 'eb.bc', 'eb.bc', '.bbc.'], 'air'],
      latched: [['....abbbbe', '.aabcbcbcbe', 'abbbbbbbbb.', '.cc.c.c....'], 'air'],
      crawl: [['.....ab', '.abbbbe', 'bbcccbe'], 'floor'],
    },
  },
  // EAST. The sand skink: sand and rust with a pale belly; it suns itself and darts.
  skink: {
    outline: 'east', palette: { a: '#c4cc94', b: '#94a068', c: '#5e6a44', l: '#eeecd0', w: '#ffffff', p: '#3a2414' },
    poses: {
      'walk-a': [['........abba..', 'cbbbbbbbbbbbwb', '..lbllbllbbbb.', '...c....c.....'], 'floor'],
      'walk-b': [['........abba..', 'cbbbbbbbbbbbwb', '..lbllbllbbbb.', '..c....c......'], 'floor'],
      sun: [['........abba..', '.cbbbbbbbbbbwb', 'c.lbllbllbbbb.', '..cc..cc......'], 'floor'],
    },
  },
  // The prospector wren: dark with a pale brow and breast, so it shows on sand; it pecks, flits and perches.
  wren: {
    outline: 'east', palette: { a: '#7c6a76', b: '#5a4c58', c: '#3c3242', h: '#2a2028', n: '#f2eadc', l: '#e6d8c0', w: '#ffffff', p: '#1e1410', d: '#2a2028' },
    poses: {
      'perch-a': [['...hhh...', '..hnnwp..', '..hbbbbn.', '.abbbbll.', 'abbbbbll.', 'cbbbbbl..', '.ccbcc...', '...d.d...'], 'floor'],
      'perch-b': [['....hhh..', '...hnnwp.', '..abbbbbn', '.abbbbll.', 'abbbbbll.', 'cbbbbbl..', '.ccbcc...', '...d.d...'], 'floor'],
      peck: [['.........', '..hhh....', '.abhnn...', '.abbhwp..', 'abbbbbbn.', 'cbbbbll..', '.ccbcc...', '...d.d...'], 'floor'],
      'fly-a': [['.c.......', 'cbc..hhh.', 'cbbahnnwp', '.abbbbbbn', '..cbbbll.', '...cc....'], 'air'],
      'fly-b': [['.........', '.....hhh.', '..aaahnwp', '.abbbbbbn', 'cbbcbbll.', 'cc..cc...'], 'air'],
    },
  },
  // POCKETS. The hive's nurse bees: pale lemon banded in black, never amber, a plump body with a dark head and a
  // bright eye, and wings that stand up and fold back.
  bee: {
    outline: 'hive', palette: { y: '#f4ea9c', l: '#fffbe0', d: '#3a2e1c', w: '#e8f0ff', p: '#ffffff' },
    poses: {
      'fly-a': [['..ww....', '.wwww...', '.lydyydd', 'yyydyydp', '.yydyyd.'], 'air'],
      'fly-b': [['........', '........', '.wwwwdd.', 'yyydyydp', '.yydyyd.'], 'air'],
    },
  },
  // The drift's star jellies: clear bells trailing tendrils.
  jelly: {
    outline: 'drift', palette: { a: '#f6f0ff', b: '#d8c8f0', c: '#a898d0', t: '#c4b4e4', w: '#ffffff', p: '#0e1a30' },
    poses: {
      'bob-a': [['..aaa..', '.aabba.', 'abbbbba', 'bwpbwpb', 'cbbbbbc', '.t.t.t.', '.t.t.t.', 't..t..t'], 'air'],
      'bob-b': [['..aaa..', '.aabba.', 'abbbbba', 'bwpbwpb', 'cbbbbbc', '.t.t.t.', 't..t..t', '.t.t.t.'], 'air'],
    },
  },
  // The lantern grotto's newt: teal-dark with spots of pale light; it lights the caps it touches.
  newt: {
    outline: 'grotto', lamps: 's', palette: { a: '#5a9a92', b: '#3a7068', c: '#22484a', s: '#f0e8a8', w: '#ffffff', p: '#06201e', d: '#22484a' },
    poses: {
      'walk-a': [['.bbsbbsbbaw', 'cbbbbbbbbbp', '.d...d..d..'], 'floor'],
      'walk-b': [['.bbsbbsbbaw', 'cbbbbbbbbbp', '..d...d...d'], 'floor'],
      lick: [['.bbsbbsbbaw.', 'cbbbbbbbbbps', '.d...d..d...'], 'floor'],
    },
  },
  // THE BROODS, the young of the lords at the ends of the axes (js/bosses.js), each in its direction's outline and
  // in colours as quiet as the creatures' kin, so that none is near what pays or hurts far out on its axis; each
  // scurries in its two drawings. NORTH. The rimeling: a fist-sized wyrm of the frost wyrm's blue-grey plates, its
  // little crest glinting, its head reared.
  rimeling: {
    outline: 'north', palette: { a: '#c8d2e2', b: '#8e9cb8', c: '#5c6a88', s: '#eef4fc', w: '#ffffff', p: '#22395a' },
    poses: {
      'crawl-a': [['.......aab..', '......abbwp.', '.s.s.abbbbb.', 'abbbbbbbc...', 'bcbcbcbc....', '.c..c..c....'], 'floor'],
      'crawl-b': [['.......aab..', '......abbwp.', 's.s..abbbbb.', '.abbbbbbc...', 'bcbcbcbc....', 'c..c..c.....'], 'floor'],
    },
  },
  // SOUTH. The emberling: a hatchling of the behemoth's slag crust, its cracks alight (`lamps`), on stubby legs.
  emberling: {
    outline: 'south', lamps: 'g', palette: { a: '#8c7a80', b: '#64525a', c: '#3e3038', g: '#f4dcbc', w: '#ffffff', p: '#160c12' },
    poses: {
      'crawl-a': [['....aaa.....', '..aabbba.aa.', '.abbgbbbabwp', 'abgbbbgbbbbb', 'bbbbgbbbbbc.', '.cccccccc...', '..c.c..c.c..'], 'floor'],
      'crawl-b': [['....aaa.....', '..aabbba.aa.', '.abbgbbbabwp', 'abgbbbgbbbbb', 'bbbbgbbbbbc.', '.cccccccc...', '.c.c..c.c...'], 'floor'],
    },
  },
  // WEST. The mireling: a spore-slug of the mother's mauve, pale spores on its back and its eyes on stalks; it inches.
  mireling: {
    outline: 'west', palette: { a: '#c0a8b4', b: '#94788a', c: '#64505e', s: '#e4dcc4', w: '#ffffff', p: '#1c1426' },
    poses: {
      'crawl-a': [['...s...s..w.w', '..sas.sas.b.b', '.abbbbbbbbbbp', 'abbbbbbbbbbbb', 'ccccccccccccc'], 'floor'],
      'crawl-b': [['....s...s.w.w', '...sas.sas.bb', '..abbbbbbbbbp', '.abbbbbbbbbbb', 'ccccccccccccc'], 'floor'],
    },
  },
  // EAST. The lodeling: a burr of the king's pale crystal, spiked all round; it rolls (its second drawing its first
  // turned a quarter).
  lodeling: {
    outline: 'east', palette: { a: '#e8e0f0', b: '#b8acc8', c: '#867a98', s: '#f8f4ff', w: '#ffffff', p: '#3a2414' },
    poses: {
      'crawl-a': [['...s..s...', '..sab.as..', '.sabbbbbs.', '..bwpbwpc.', '.sbbbbbcs.', '..sccccs..', '...s..s...'], 'floor'],
      'crawl-b': [['...s..s...', '..sab.as..', '.sabbbbbs.', '..bwpbwpc.', '.sbbbbbcs.', '..sccccs..', '...s..s...'], 'floor', { rotate: 90 }],
    },
  },
};

// The frames of the sheet, and where each frame's foe eyes lie in it.
const frames = [], eyes = {}, lamps = {};
for (const [kind, art] of Object.entries(CREATURES_ART)) {
  for (const [pose, [given, where, extra = {}]] of Object.entries(art.poses)) {
    // (Rows are filled out to the widest of them.)
    const rows = given.map(row => row.padEnd(Math.max(...given.map(r => r.length)), '.'));
    // (Turned a quarter, the rows' width and height trade places.)
    const turned = extra.rotate === 90 || extra.rotate === 270, w = turned ? rows.length : rows[0].length, h = turned ? rows[0].length : rows.length;
    const x = Math.floor((16 - w) / 2), y = where === 'floor' ? 15 - h : where === 'ceil' ? 1 : Math.floor((16 - h) / 2);
    for (const left of [false, true]) {
      const name = `${kind}-${pose}${left ? '-l' : ''}`;
      frames.push({ name, duration: 200, palette: { ...art.palette, k: OUTLINE[art.outline] },
        ops: [{ op: 'stamp', symbol: `${kind}-${pose}`, x, y, ...(left && { flipX: true }), ...(extra.rotate && { rotate: extra.rotate }) }, { op: 'outline', color: 'k', position: 'outside' }] });
      if (!extra.rotate) {
        const at = [], lit = [];
        rows.forEach((row, v) => [...row].forEach((c, u) => {
          if (c === 'e') at.push([x + (left ? w - 1 - u : u), y + v]);
          if (art.lamps && art.lamps.includes(c)) lit.push([x + (left ? w - 1 - u : u), y + v]);
        }));
        if (at.length) eyes[name] = at;
        if (lit.length) lamps[name] = lit;
      }
    }
  }
}
export const fauna = {
  version: 1, name: 'fauna', width: 16, height: 16,
  palette: KEYS,
  symbols: Object.fromEntries(Object.entries(CREATURES_ART).flatMap(([kind, art]) => Object.entries(art.poses).map(([pose, [rows]]) => [`${kind}-${pose}`, rows.map(row => row.padEnd(Math.max(...rows.map(r => r.length)), '.'))]))),
  frames,
  // (Written into the atlas beside the frames, not into the recipe: `art/build.mjs`.)
  extra: { eyes, lamps },
};
