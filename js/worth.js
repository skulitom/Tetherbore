// What each thing the lab can know is worth, said the one way wherever it is said: in the lab's notes, and when it
// is first seen and when it is hauled. Worked out once, at load, from the same figures the haul pays by
// (js/game.js: `payOf`), so it cannot say otherwise than a haul does.
//
// Everything is said against a cell of plain rock (K.SOFT) of an ordinary ground at the same distance from the core,
// which pays 1 grit times the distance's richness: `x` is how many such cells one cell of the thing pays in grit,
// before what the lab knows of it. A cell of ore and a cell of rock in one haul share the haul's multiples (its
// size, the winch, the wrecks' parts, the flywheel), so for a thing that pays as a cell does the figure holds in any
// haul: a common ore is x2, a rich one x4, a hazard x3, steel x6. It is said for the thing's own ground (a strain's
// ore at the strain's pay); where the same thing lies in a ground that pays more, it pays that much more there: a
// cross a quarter more, a deep flank twice (its lava, its steel, its keys' iron, a rare hazard's gems), which the
// line does not say. The home ground's ores pay a multiple of their own besides (payOf: 4 and 20 more grit a cell
// at home's richness), so copper and violet quartz, which the east's ground has too, are said for both (`home`).
// A thing that pays a lump, as a pocket's mineral or a rare hazard does (so many seconds of the model player's
// cutting out where it lies), does not share the haul's multiples, so what it is worth against rock depends on the
// haul: it is said against rock in a haul of the model's size (48 cells square, as income() has it) or the winch's
// full load where that is less, at the winch's level (`worthOf(key, winch)`; `LUMP_ROCK`: income() over richness,
// the same at every distance from 144 cells out, where every pocket and rare hazard lies, over that haul's bonus), to two figures, and marked as about so (`~`). A chain of
// aerolite, a glowworm hauled swimming and the live catch pay more; the line does not say. `gems` is the gems a cell
// pays, and to which direction (`gemKin`); `spec` the specimens a cell of a pocket's mineral adds. `tier` is one to
// three, by what it is worth as said: three for 10 rock or 10 gems or more, two for 3 rock or more, one for less;
// the lab rims a thing's chip by it (js/drawing.js: `TIER_RIM`), and the world shows the same. `said` is the line,
// in English (js/lang.js turns it): WORTH x4 ROCK, +5 GEMS; ~x12 ROCK, +0.25 SPEC.
import { K, B, GRIT, GEMS, HAZARDS, RARE, BIOMES, SEAMS, STONES, gemKin } from './world.js';
import { LAB, richness, income, haulBonus, WINCH_LOAD } from './shop.js';

// (The winch's value at each level, as the shop has them, read once the rows are made: js/shop.js, UPGRADES.)
import { UPGRADES } from './shop.js';
const WINCH = UPGRADES.find(u => u.id === 'winch').values;
export const LUMP_ROCK = WINCH.map((v, l) => income(1000) / richness(1000) / haulBonus(Math.min(48 * 48, WINCH_LOAD[l]), v));
const HOME_ORE = { [K.ORE_A]: 4, [K.ORE_B]: 20 }, RARE_LUMP = 12;
export const tierOf = ({ x, gems }) => x >= 10 || gems >= 10 ? 3 : x >= 3 ? 2 : 1;
// A figure said short: whole from ten, else to a tenth, with no trailing nought; about so to two figures; a share of
// a specimen to a hundredth.
const short = n => n >= 10 ? `${Math.round(n)}` : `${Math.round(n * 10) / 10}`;
const about = n => n >= 100 ? `${Math.round(n / 10) * 10}` : short(n);
const part = n => n >= 1 ? short(n) : `${Math.round(n * 100) / 100}`;
const gemsSaid = g => g ? ` +${short(g)} ${g === 1 ? 'GEM' : 'GEMS'}` : '';
// The figure alone, as the line says it: x4, ~x190. (A haul's banner names what paid most in it by it: js/game.js,
// `topPayer`.)
export const figOf = ({ x, lump }) => lump ? `~x${about(x)}` : `x${short(x)}`;
export const worthSaid = ({ x, gems, spec, lump, home }) => {
  if (home) return `HOME x${short(home.x)}, EAST x${short(x)}${gemsSaid(gems)}`;
  const fig = figOf({ x, lump });
  // (A lump's figure, about so, is said without WORTH before it, which there is no room for; and where a thing pays
  // gems and specimens both, as a lit lantern cap does, that it pays specimens is said without how many.)
  if (gems && spec) return `${fig} ROCK,${gemsSaid(gems)}, +SPEC`;
  return `${lump ? '' : 'WORTH '}${fig} ROCK${gems ? `,${gemsSaid(gems)}` : spec ? `, +${part(spec)} SPEC` : ''}`;
};

// What lies where, for each key: the kind and the ground the haul would pay it by. A ground's ores are the first
// ground's of that number to have them that is no cross and no pocket, but the home ground's (copper and violet
// quartz) are said for the east's ground, which has them too, with the home ground's beside (`home`); a hazard is
// its type's first ground's; steel the south's; a key's iron an ordinary ground's; a pocket's mineral its pocket's.
// A cross's rich ore, which is no other ground's, is its pair's first cross's (a quarter more than its host, as every
// cross of the pair pays). A shrine's stone, vault, is said for the deep seam the shrine lies in, and the builders'
// stone for an ordinary ground, as a key's iron is (their halls lie in whatever ground is there, most of it the
// deep flanks, which pay twice that; the line does not say).
const ORDINARY = () => BIOMES.filter(r => r && !r.cross && !r.pocket && r.lay !== undefined);
const placeOf = key => {
  const rows = ORDINARY(), found = rows.filter(r => r.oreKeys?.includes(key));
  if (found.length) {
    const at = r => ({ k: r.oreKeys.indexOf(key) ? K.ORE_B : K.ORE_A, row: r });
    const home = found.find(r => r.id === B.CRUST), own = found.find(r => r.id !== B.CRUST);
    return home && own ? { ...at(own), home: at(home) } : at(found[0]);
  }
  const cross = BIOMES.find(r => r?.cross && r.oreKeys[1] === key);
  if (cross) return { k: K.ORE_B, row: cross };
  const [sheet, frame] = key.split(':');
  if (sheet === 'stones' && STONES.includes(frame)) { const s = STONES.indexOf(frame); return { k: K.VAULT, row: BIOMES[s < 4 ? SEAMS[s][1] : B.FROST] }; }
  if (frame === 'hazard') {
    const type = Object.keys(HAZARDS).find(t => HAZARDS[t].sheet === sheet);
    if (RARE.includes(type)) return { k: K.RARE, row: BIOMES[RARE.indexOf(type)], lump: RARE_LUMP };
    return { k: K.HAZARD, row: rows.find(r => r.haz?.type === type) ?? BIOMES[0] };
  }
  if (key === 'ember-items:steel') return { k: K.STEEL, row: BIOMES[B.EMBER] };
  if (key === 'finds:key') return { k: K.KEY, row: BIOMES[B.FROST] };
  if (sheet === 'minerals') {
    const row = BIOMES.find(r => r?.pocket?.mineral === frame);
    if (row) return { k: row.pocket.kind ?? K.MINERAL, row, lump: row.pocket.lump, spec: row.pocket.spec };
  }
  return null;
};
const gritOf = ({ k, row }) => (GRIT[k] + (row.id === B.CRUST ? HOME_ORE[k] ?? 0 : 0)) * row.rich * row.worth;
// What a key is worth with the winch at level `winch` (only a lump's figure moves with it); null for a key the lab
// has nothing of. (`ground` is what the ground it is said for pays a cell, as a multiple of an ordinary ground's,
// its `rich` times its `worth`: where a cell of it lies in a ground that pays more, the world says how much more
// there, js/game.js: `eyeOn`.)
export const worthOf = (key, winch = 0) => {
  const at = placeOf(key);
  if (!at) return null;
  const lv = Math.max(0, Math.min(LUMP_ROCK.length - 1, winch)), x = gritOf(at) + (at.lump ?? 0) * LUMP_ROCK[lv];
  const gems = GEMS[at.k] * at.row.gemx, worth = { x, gems, gemKin: gems ? gemKin(at.k, at.row) : 0, spec: at.spec ?? 0, lump: !!at.lump, home: at.home ? { x: gritOf(at.home) } : null, ground: at.row.rich * at.row.worth };
  worth.tier = tierOf(worth);
  worth.said = worthSaid(worth);
  return worth;
};
// Every thing of the lab's, by its key, at each level of the winch: WORTH_AT[level][key]; WORTH at the first.
export const WORTH_AT = LUMP_ROCK.map((_, l) => Object.fromEntries(LAB.map(e => [e.key, worthOf(e.key, l)])));
export const WORTH = WORTH_AT[0];
