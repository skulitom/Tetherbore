// Which game this build is: the whole game, or the demo. `DEMO` is written once, at build time, and nothing can change
// it while the game runs: tools/build-dist.mjs --demo turns the line below to `true` in the copy it ships (`DEMO_LINE`
// there) and every other build ships it as it stands, so a normal build runs none of what hangs on it.
export const DEMO = false;

// The demo's tether stops at this level of REACH (js/shop.js: 400 cells), and its one lord, the south's (js/bosses.js:
// 1), lies this far out on its axis, with its leash inside that reach. docs/REFERENCE.md says why these.
export const DEMO_LEVEL = 5, DEMO_LAIR = 360, DEMO_LORD = 1;

// Where the game is kept. The demo has a save of its own, in keys and a database no full game writes, so a full game's
// save on the same device is never read, written or capped by it; js/carry.js brings a demo's save into a full game
// that has none.
export const DEMO_SAVE = 'tetherbore-demo-save-v3', DEMO_DB = 'tetherbore-demo', FULL_SAVE = 'tetherbore-save-v3', FULL_DB = 'tetherbore';
export const SAVE_KEY = DEMO ? DEMO_SAVE : FULL_SAVE, DB_NAME = DEMO ? DEMO_DB : FULL_DB;
// What this device's storage holds of a demo's game, if anything.
export const demoSaved = (storage = globalThis.localStorage) => { try { return storage.getItem(`${DEMO_SAVE}-latest`) ?? storage.getItem(DEMO_SAVE); } catch { return null; } };
