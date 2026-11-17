// No sound stops the game. The browser throws when a sound is given a pitch, a level or a time that is no number,
// and what is thrown comes out of the middle of a step: once, the hull mending itself asked for a tick with no
// note, the step threw, the next frame was never asked for, and the game stood still for good twenty seconds
// after any knock. Here the game is played with a stand-in for the browser's audio that is as strict as the
// browser is: the mend, a random flight through each direction's ground with the hull taking its knocks, and each
// of the rare hazards woken beside the drill.
// And a frame that does throw is written down for the menu, and no more than once a second.
import { makeGame, random, C, N, K } from '../harness.mjs';

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
let made = 0, clock = 1;          // parts of sounds made; and the audio's own clock, which the tests below move on with the game's
const finite = (v, what) => { if (typeof v !== 'number' || !Number.isFinite(v)) throw new TypeError(`${what}: the provided value (${v}) is non-finite`); };
const param = name => {
  let value = 1;
  return {
    get value() { return value; }, set value(v) { finite(v, `${name}.value`); value = v; },
    setValueAtTime(v, t) { finite(v, `${name}.setValueAtTime`); finite(t, `${name}.setValueAtTime time`); if (t < 0) throw new RangeError(`${name}: a time before the beginning`); },
    linearRampToValueAtTime(v, t) { finite(v, `${name}.linearRamp`); finite(t, `${name}.linearRamp time`); },
    exponentialRampToValueAtTime(v, t) { finite(v, `${name}.exponentialRamp`); finite(t, `${name}.exponentialRamp time`); if (v === 0) throw new RangeError(`${name}: an exponential ramp to nothing`); },
    setTargetAtTime(v, t, c) { finite(v, `${name}.setTarget`); finite(t, `${name}.setTarget time`); finite(c, `${name}.setTarget constant`); },
    cancelScheduledValues(t) { finite(t, `${name}.cancel time`); },
  };
};
const node = kind => {
  const params = {}, own = { type: '', loop: false, buffer: null, onended: null, curve: null };
  made++;
  return new Proxy(own, {
    get(target, key) {
      if (key === 'connect' || key === 'disconnect' || key === 'setPeriodicWave' || key === 'addEventListener') return () => {};
      if (key === 'start' || key === 'stop') return (t = 0, offset = 0) => { finite(t, `${kind}.${key}`); finite(offset, `${kind}.${key} offset`); if (t < 0 || offset < 0) throw new RangeError(`${kind}.${key}: before the beginning`); };
      if (key in target) return target[key];
      return params[key] ??= param(`${kind}.${String(key)}`);
    },
    set(target, key, value) { if (key in target || typeof value !== 'number') target[key] = value; else finite(value, `${kind}.${String(key)}`); return true; },
  });
};
globalThis.AudioContext = class {
  constructor() { this.sampleRate = 8000; this.state = 'running'; this.destination = node('destination'); }
  get currentTime() { return clock; }
  resume() {}
  createBuffer(channels, length) { const data = new Float32Array(length); return { getChannelData: () => data }; }
  createPeriodicWave() { return {}; }
};
// (A sound that goes wrong is dropped with a warning, and the frame goes on: here that warning is a defect.)
const warned = [], warn = console.warn;
console.warn = (...said) => { warned.push(said.map(String).join(' ')); };
for (const kind of ['Gain', 'Oscillator', 'BiquadFilter', 'BufferSource', 'DynamicsCompressor', 'ConstantSource', 'StereoPanner', 'Delay', 'WaveShaper', 'Convolver'])
  globalThis.AudioContext.prototype[`create${kind}`] = () => node(kind);
const audio = await import(new URL('../../js/audio.js', import.meta.url));
audio.setMuted(false); audio.unlock();

// ---- the stand-in is as strict as it is meant to be
{
  let threw = '';
  try { new AudioContext().createOscillator().frequency.setValueAtTime(NaN, 1); } catch (error) { threw = error.constructor.name; }
  check(threw === 'TypeError', `a pitch that is no number, given to the stand-in audio, threw '${threw}'`);
}

// ---- the hull mends itself, with its sound
{
  const game = await makeGame(7, {}, { hull: true }), d = game.drill, before = made;
  d.x = d.px = C + 12.5; d.y = d.py = C + 0.5; d.home = false; game.band = [[d.x, d.y], [C + 0.5, C + 0.5]];
  for (let x = 1; x <= 14; x++) game.world.setK(C * N + C + x, K.EMPTY);
  game.changed();
  game.dents = 1;
  let threw = null, frames = 0;
  try { for (; frames < 60 * (game.val('mender') + 2) && game.dents > 0; frames++) { game.update(1 / 60); clock += 1 / 60; } } catch (error) { threw = error; }
  check(!threw && game.dents === 0, threw ? `the step in which the hull mended threw: ${threw.message}` : `after ${(frames / 60).toFixed(0)} s the hull has ${game.dents} dents still`);
  check(made > before, 'the mend made no sound at all: nothing here was heard, so nothing was tested');
}

// ---- play: a random flight out in each direction's ground, knocks and all
for (const [name, ux, uy] of [['north', 0, -1], ['south', 0, 1], ['west', -1, 0], ['east', 1, 0]]) {
  const game = await makeGame(11, { tether: 6, drill: 3, momentum: 2, winch: 2 }, { hull: true }), rnd = random(5 + ux * 3 + uy), w = game.world;
  const set = () => { const d = game.drill; d.x = d.px = C + ux * 160 + 0.5; d.y = d.py = C + uy * 160 + 0.5; d.home = false; d.mode = 'free'; game.band = [[d.x, d.y], [C + 0.5, C + 0.5]]; for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) w.setK((Math.floor(d.y) + v) * N + Math.floor(d.x) + u, K.EMPTY); game.changed(); game.dents = 0; };
  set();
  let heading = rnd() * 6.283, threw = null, f = 0;
  try {
    for (; f < 60 * 45; f++) {
      if (f % 40 === 0) heading += (rnd() - 0.5) * 2.2;
      game.input.auto = [Math.cos(heading), Math.sin(heading), 1];
      game.update(1 / 60); clock += 1 / 60;
      if (f % 20 === 0) game.render();
      if (game.drill.mode === 'dead') { for (let n = 0; n < 300 && game.drill.mode === 'dead'; n++) game.update(1 / 60); game.input.auto = null; game.update(1 / 60); set(); }
    }
  } catch (error) { threw = error; }
  check(!threw, `flying ${name}, the step threw after ${(f / 60).toFixed(0)} s: ${threw?.message}\n      ${String(threw?.stack).split('\n').slice(1, 4).map(l => l.trim()).join(' < ')}`);
}

// ---- the rare hazards, each woken beside the drill: a bell tolls, a fumarole fires, a glowworm swims and bites,
// a lodestone pulls, and every sound of theirs is asked for. The drill keeps off the bell, the fumarole and the
// lodestone, which a cut into would crush before they went off; it goes at the glowworm, to be bitten.
const asked = {};
for (const name of Object.keys(audio.sfx)) { const play = audio.sfx[name]; audio.sfx[name] = (...args) => { asked[name] = (asked[name] ?? 0) + 1; return play(...args); }; }
const THEIRS = { bell: ['bellwake', 'toll'], vent: ['rumble', 'jet'], worm: ['wormwake', 'gnaw'], lodestone: ['hum', 'pull', 'gather'] };
for (const [type, kin] of [['bell', 1], ['vent', 2], ['worm', 3], ['lodestone', 4]]) {
  const game = await makeGame(7, { tether: 3, drill: 4 }, { hull: true }), w = game.world, before = made, at = (x, y) => (C + y) * N + C + x;
  for (let y = -12; y <= 12; y++) for (let x = -12; x <= 12; x++) { w.setK(at(x, y), Math.abs(x) <= 2 && Math.abs(y) <= 2 ? K.EMPTY : (x + y) % 3 ? K.SOFT : K.ORE_A); w.setB(at(x, y), kin); }
  w.setK(at(5, 0), K.RARE); for (let x = 3; x <= 4; x++) w.setK(at(x, 0), K.EMPTY);
  w.see(C, C, 14); game.changed();
  let threw = null;
  for (const name in asked) delete asked[name];
  try {
    game.finishDig(at(5, 1));
    for (let f = 0; f < 60 * 12; f++) { game.input.auto = type === 'worm' && f % 120 < 30 ? [1, 0, 1] : null; game.update(1 / 60); clock += 1 / 60; if (f % 20 === 0) game.render(); }
  } catch (error) { threw = error; }
  const missed = THEIRS[type].filter(name => !asked[name]);
  check(!threw && made > before && !missed.length, threw ? `a woken ${type}: the step threw: ${threw.message}` : `a woken ${type} never asked for ${missed.join(', ') || 'a sound'}`);
}

// ---- the creatures (js/fauna.js), set down beside the drill and played with their voices: a roost of bats woken,
// a leech on the hull, a spitter swelling, a puffling lassoed, a pal, moths, a skink and a frog; and every voice asked
// for with each kind of `near` it might be given.
{
  const said = {};
  for (const name of Object.keys(audio.voices)) { const play = audio.voices[name]; audio.voices[name] = (...args) => { said[name] = (said[name] ?? 0) + 1; return play(...args); }; }
  const { farStart } = await import('../harness.mjs');
  const game = await makeGame(7, { tether: 6, drill: 4 }, { hull: true, fauna: true }), f = game.fauna, before = made;
  farStart(game, -300, 0); game.world.see(C - 300, C, 10); game.changed();
  let threw = null;
  try {
    for (const [kind, state] of [['bat', 'fuse'], ['spitter', 'puff'], ['leech', 'latched'], ['pup', 'pal'], ['moth', ''], ['puff', ''], ['skink', ''], ['frog', '']]) {
      const i = f.stage(game, kind, 8);
      if (i >= 0 && state) f.stageAs(game, i, state);
      for (let n = 0; n < 150; n++) { game.input.auto = n % 50 < 10 ? [1, 0, 0.6] : null; game.update(1 / 60); clock += 1 / 60; if (n % 15 === 0) game.render(); }
    }
    for (const name of Object.keys(audio.voices)) for (const near of [undefined, NaN, -1, 0, 0.5, 1, 7]) { audio.voices[name](near); clock += 0.05; }
  } catch (error) { threw = error; }
  check(!threw && made > before, threw ? `with creatures about, the step threw: ${threw.message}` : 'the creatures made no sound at all');
  check(['screech', 'chitter', 'whoosh', 'wheeze', 'spit', 'splat', 'slurp', 'yip'].every(name => said[name]), `the creatures never asked for ${['screech', 'chitter', 'whoosh', 'wheeze', 'spit', 'splat', 'slurp', 'yip'].filter(name => !said[name]).join(', ')}`);
}

// ---- a frame that threw is written down, for the menu
{
  localStorage.removeItem('tetherbore-stalls');
  const game = await makeGame(7), said = console.error;
  let told = 0;
  console.error = () => { told++; };
  try {
    game.failed(new TypeError("Failed to execute 'setValueAtTime' on 'AudioParam': The provided float value is non-finite."));
    game.failed(new Error('again, at once'));
  } finally { console.error = said; }
  check(game.stalls.length === 1 && /setValueAtTime/.test(game.stalls[0].err) && told === 2, `two frames that threw within a second were written down as ${JSON.stringify(game.stalls)} and said ${told} times`);
  check(JSON.parse(localStorage.getItem('tetherbore-stalls')).length === 1, 'the frame that threw was not kept');
  game.resize(320, 568, 1); game.openLab(true, 'menu'); game.render(); game.openLab(false);
  localStorage.removeItem('tetherbore-stalls');
}

console.warn = warn;
check(warned.length === 0, `a sound was dropped with a warning: ${warned[0]}`);

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : `no defect: with audio as strict as a browser's (${made} sounds' worth of parts made), the hull mends itself and the drill flies every direction's ground without a step throwing; and a frame that throws is written down`);
process.exit(fails.length ? 1 : 0);
