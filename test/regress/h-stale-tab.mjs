// A game left open in another tab does not save its old state over the game played since. One did: a game far on,
// its ground mined out for hundreds of cells about the core, was left with the grit and the rig of its first hour,
// and a reach that got to none of the ground still standing. A save is numbered now and written under a second key
// besides; a game that finds a later number than its own loads that game in place of saving, and a game that loads
// takes the later of the two copies.
import { makeGame, Game } from '../harness.mjs';

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
const KEY = 'tetherbore-save-v3', LATEST = `${KEY}-latest`;
const canvas = () => ({ width: 0, height: 0, style: {}, getContext: document.createElement().getContext, getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 640 }) });
const settle = () => new Promise(resolve => setTimeout(resolve, 20));
const open = async () => { const game = new Game(canvas()); const ok = await game.restore(); if (!ok) game.claim(); return game; };
const read = key => JSON.parse(localStorage.getItem(key));

// ---- two tabs on one game
{
  // The game's first hour, saved; and a tab opened on it then, and left.
  const first = await makeGame(7);
  first.S.grit = 72000; first.S.lv.tether = 5; first.save();
  const old = await open();
  check(old.S.grit === 72000 && old.S.seed === 7 && old.rev === 1 && read(LATEST).rev === 1, `the tab left open holds ${old.S.grit} grit of world ${old.S.seed}, save ${old.rev}`);
  // The game is played on in another tab, for hours.
  const now = await open();
  now.S.grit = 64600000; now.S.lv.tether = 9; now.S.stats.time = 30000; now.save(); now.S.grit += 5; now.save();
  check(read(KEY).grit === 64600005 && read(KEY).rev === 3 && read(LATEST).rev === 3, `played on, the save is number ${read(KEY).rev} with ${read(KEY).grit} grit`);
  // The old tab comes to the front and saves, as a tab does when it is shown, hidden or left: nothing is written,
  // and it is the game played on from then.
  old.S.grit += 100; old.save();
  check(read(KEY).grit === 64600005 && read(LATEST).grit === 64600005, `after the old tab saved, the save holds ${read(KEY).grit} grit`);
  await settle();
  check(old.S.grit === 64600005 && old.S.lv.tether === 9 && old.rev === 3 && old.notice?.title === 'GAME LOADED', `the old tab is now at ${old.S.grit} grit, reach level ${old.S.lv.tether}, save ${old.rev}, and says '${old.notice?.title}'`);
  // From there it saves as any game does, and the other tab takes that up in its turn.
  old.S.grit += 7; old.save();
  check(read(KEY).grit === 64600012 && read(KEY).rev === 4, `the old tab, caught up, saved number ${read(KEY).rev}`);
  now.save(); await settle();
  check(now.S.grit === 64600012 && read(KEY).rev === 4, `the other tab then holds ${now.S.grit} grit`);
}

// ---- an older copy of the game, which knows nothing of numbers, writes its old state over the first key
{
  const ours = read(LATEST), stale = { ...ours, grit: 72000, stats: { ...ours.stats, time: 600 } };
  delete stale.rev;
  localStorage.setItem(KEY, JSON.stringify(stale));
  const game = await open();
  check(game.S.grit === 64600012 && game.rev === 4, `loaded after an older copy of the game wrote over the save: ${game.S.grit} grit, save ${game.rev}`);
  // But where that older copy was the one played on (the same world, for longer), it is its game that is loaded.
  const later = { ...stale, grit: 99000000, stats: { ...ours.stats, time: ours.stats.time + 500 } };
  localStorage.setItem(KEY, JSON.stringify(later));
  const on = await open();
  check(on.S.grit === 99000000, `loaded after an older copy of the game played on: ${on.S.grit} grit`);
  on.save();
  check(read(LATEST).grit === 99000000 && read(LATEST).rev === 5, `and saved as number ${read(LATEST).rev}`);
}

// ---- a new world begun in one tab is the game in the other from its next save
{
  const a = await open(), b = await open();
  a.fresh(31); a.save();
  check(read(KEY).seed === 31 && read(KEY).rev === 6, `a new world saved as number ${read(KEY).rev}, world ${read(KEY).seed}`);
  b.S.grit = 1; b.save(); await settle();
  check(b.S.seed === 31 && read(KEY).seed === 31, `the other tab is in world ${b.S.seed}, and the save is world ${read(KEY).seed}'s`);
}

// ---- with no save at all there is nothing to take up, and the first save is the first
{
  localStorage.removeItem(KEY); localStorage.removeItem(LATEST);
  const game = await open();
  game.save();
  check(game.rev === 1 && read(KEY).rev === 1 && read(KEY).seed === game.S.seed, `a game with nothing saved before saves number ${game.rev}`);
}

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : 'no defect: a tab left open on an old state of the game does not save over what was played since but takes it up, an older copy of the game writing over the save is passed by, and a new world begun in one tab is the game in the other');
process.exit(fails.length ? 1 : 0);
