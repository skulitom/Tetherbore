// What the lords at the ends pay (js/bosses.js; js/game.js: `lordBeaten`, BOSS_LUMP, BOSS_SPEC), against what the shop
// asks (js/shop.js), each figure worked out from the shop as it stands and not copied in:
//   - Each lord's specimens (BOSS_SPEC, of its direction's) are no more than a quarter of all that the shop asks of
//     that direction's specimens, every level of every row paid in them.
//   - The grit of all four, each at the refinery's last level, is under a hundredth of all the grit the late shop
//     asks (the levels past each row's EARLY one).
//   - The east's specimens, which no foe pays on purpose (js/fauna.js: no foe lives in any ground of the east's), come
//     from the CRYSTAL KING alone, and once: no other lord pays them, no ground of the east's has a foe in its roster,
//     and the King fought to the end in a room at his lair, his shards hauled home along the way, pays BOSS_SPEC of them and no
//     more, the shards paying their ore and no specimens, and fought over forty seconds more he pays nothing again.
// Fails on the game before the east's lord, who never wakes.
//   node test/regress/s9-boss-budget.mjs
import { random, C, K } from '../harness.mjs';
import { rect } from './lib/lasso.mjs';
import { TABS, EARLY, income, round2 } from '../../js/shop.js';
import { BOSS_LUMP, BOSS_SPEC } from '../../js/game.js';
import { BIOMES } from '../../js/world.js';
import { CREATURES, faunaOf } from '../../js/fauna.js';
import { BOSS, LAIR, ST, SHARDS } from '../../js/bosses.js';
import { NAMES, atLair, beat, run, thumb } from './lib/lords.mjs';

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const ROWS = TABS.flatMap(t => t.rows), DIR = ['', 'north', 'south', 'west', 'east'];

// ---- specimens: a quarter of each direction's asks at the most
const asks = [0, 0, 0, 0, 0];
for (const u of ROWS) if (u.spec && u.kin) for (const n of u.spec) asks[u.kin] += n || 0;
for (let b = 0; b < 4; b++) {
  const kin = BOSS[b].kin;
  check(asks[kin] > 0 && BOSS_SPEC <= asks[kin] / 4, `the ${NAMES[b]}'s lord pays ${BOSS_SPEC} of the ${DIR[kin]}'s specimens, where the shop asks ${asks[kin]} of them in all`);
}

// ---- grit: all four at the refinery's last level, against the late shop
const refinery = ROWS.find(u => u.id === 'refinery').values, most = refinery[refinery.length - 1];
const lords = 4 * Math.round(round2(income(LAIR) * BOSS_LUMP) * most);
let late = 0;
for (const u of ROWS) u.grit.forEach((g, n) => { if (n >= (EARLY[u.id] ?? Infinity)) late += g; });
check(late > 1e9 && lords < late / 100, `the four lords pay ${lords} grit at the refinery's last level, where the late shop asks ${late}`);

// ---- the east's specimens: the King's alone, and once
check(BOSS.filter(B => B.kin === 4).length === 1 && BOSS[0].kin === 4, `the east's specimens are paid by ${BOSS.filter(B => B.kin === 4).map(B => B.name).join(', ')}`);
const FOES = new Set(CREATURES.map((c, k) => c?.tier === 'foe' ? k : -1).filter(k => k >= 0)), foes = [];
for (const row of BIOMES) {
  if (!row || row.kin !== 4) continue;
  const f = faunaOf(row);
  for (const [k] of [...f.kin, ...f.named, ...(f.lent ?? [])]) if (FOES.has(k)) foes.push(`${CREATURES[k].key} in ${row.name}`);
}
check(!foes.length, `a foe lives in the east's ground: ${foes.join(', ')}`);
{
  const game = await atLair(0, { hull: false }), B = game.fauna.bosses, S = game.S;
  rect(game, 2196, -6, 2208, 6, K.EMPTY);
  game.world.see(C + 2202, C, 12); game.changed(); game.pieces = [];
  const spec = S.spec[4];
  let shards = 0, hauled = 0;
  const deed = game.fauna.deed.bind(game.fauna);
  game.fauna.deed = (g, what, a, c) => { const done = deed(g, what, a, c); if (what === 'shard' && done) shards++; return done; };
  const hauls = S.stats.hauls;
  check(beat(game, 0), `the east's lord was not beaten (state ${B.st[0]}, blows ${B.blows[0]})`);
  hauled = S.stats.hauls - hauls;
  check(S.spec[4] - spec === BOSS_SPEC && game.fauna.paid.spec[4] === BOSS_SPEC, `the east's lord beaten paid ${S.spec[4] - spec} of the east's specimens (${game.fauna.paid.spec[4]} by the creatures)`);
  check(shards >= 3 && shards <= SHARDS && hauled >= 3, `the east's fight shed ${shards} shards and made ${hauled} hauls`);
  run(game, 40 * 60, thumb(game, 0, random(5), 12));
  check(S.spec[4] - spec === BOSS_SPEC && (B.st[0] === ST.SLEEP || B.st[0] === ST.GONE), `fought over again the east's lord beaten paid ${S.spec[4] - spec} of the east's specimens in all (state ${B.st[0]})`);
}

console.log(fails.length ? `DEFECT: ${fails.join('\n        ')}` : `ok: each lord pays ${BOSS_SPEC} specimens, no more than a quarter of its direction's asks (${asks.slice(1).join(', ')}); the four pay ${(lords / 1e6).toFixed(1)} million grit at the most, under a hundredth of the late shop's ${(late / 1e9).toFixed(2)} thousand million; the east's specimens come from the CRYSTAL KING alone, once`);
process.exit(fails.length ? 1 : 0);
