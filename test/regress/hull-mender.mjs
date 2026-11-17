// The mender never mends inside the shield. After a knock nothing lands for SHIELD seconds, and the mender gives a
// pip back so many seconds after the last knock: a mender quicker than the shield gave back every pip before the
// next blow could land, so a drill under steady fire never lost more than one, and the hull's late levels and the
// black box were bought for nothing. Every level of the mender is slower than the shield; at its last, blows that
// land the moment each shield runs out wear a hull of two pips down to a wreck, and a single knock is still mended
// within a few seconds.
import { makeGame, WORKS } from '../harness.mjs';
const { SHIELD } = await import('../../js/game.js');

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const rest = (game, seconds) => { for (let f = 0; f < Math.round(seconds * 60); f++) game.update(1 / 60); };
const mender = WORKS.find(u => u.id === 'mender'), last = mender.values.length - 1;

check(mender.values.every(v => v > SHIELD), `the mender gives a pip back every ${mender.values} s, and the shield lasts ${SHIELD} s`);

// (Out in the ground east of the core, where nothing else knocks or mends: riding on to the core makes it whole.)
const out = async () => {
  const game = await makeGame(7, { drill: 4, mender: last }, { hull: true });
  game.input.auto = [1, 0, 1]; rest(game, 2); game.input.auto = null; rest(game, 0.5);
  return game;
};

// ---- steady fire: a blow the moment each shield runs out
{
  const game = await out();
  game.dents = game.val('hull') - 2;
  // (Each blow is the first that can land: the shield has just run out. No blow lands on its own: the shield is let
  // run out in its time, never cleared.)
  let blows = 0, landed = 0;
  while (!game.wrecks && blows < 12) { blows++; if (game.hit(0.3)) landed++; if (!game.wrecks) rest(game, SHIELD + 0.05); }
  check(game.wrecks === 1 && landed === 2, `with the mender at ${game.val('mender')} s, ${blows} blows ${SHIELD + 0.05} s apart (${landed} landed) left a hull of two pips with ${game.hull}${game.wrecks ? ', wrecked' : ''}`);
}

// ---- a single knock is mended, and soon
{
  const game = await out(), full = game.hull;
  game.shield = 0; game.hit(0.3);
  check(game.hull === full - 1, `a knock left ${game.hull} of ${full} pips`);
  let t = 0;
  while (game.hull < full && t < 10) { rest(game, 0.1); t += 0.1; }
  check(game.hull === full && t <= 3.6 + 1e-6, `the knock was mended after ${t.toFixed(1)} s`);
  check(t > SHIELD, `the knock was mended ${t.toFixed(1)} s after it, inside the shield of ${SHIELD} s`);
}

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : `no defect: the mender, at ${mender.values.at(-1)} s at its last, mends slower than the shield, so steady fire wears the hull down and a single knock is mended`);
process.exit(fails.length ? 1 : 0);
