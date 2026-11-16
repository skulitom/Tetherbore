// No sound stops the game. The browser throws when a sound is given a pitch, a level or a time that is no number,
// and what is thrown comes out of the middle of a step: once, the hull mending itself asked for a tick with no
// note, the step threw, the next frame was never asked for, and the game stood still for good twenty seconds
// after any knock. Here the game is played with a stand-in for the browser's audio that is as strict as the
// browser is: the mend, and a random flight through each direction's ground with the hull taking its knocks.
// And a frame that does throw is written down for the menu, and no more than once a second.
import { makeGame, random, C, N, K } from '../harness.mjs';

const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
let made = 0;
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
  const params = {}, own = { type: '', loop: false, buffer: null };
  made++;
  return new Proxy(own, {
    get(target, key) {
      if (key === 'connect' || key === 'disconnect') return () => {};
      if (key === 'start' || key === 'stop') return (t = 0, offset = 0) => { finite(t, `${kind}.${key}`); finite(offset, `${kind}.${key} offset`); if (t < 0 || offset < 0) throw new RangeError(`${kind}.${key}: before the beginning`); };
      if (key in target) return target[key];
      return params[key] ??= param(`${kind}.${String(key)}`);
    },
    set(target, key, value) { if (key in target) target[key] = value; else { finite(value, `${kind}.${String(key)}`); } return true; },
  });
};
globalThis.AudioContext = class {
  constructor() { this.currentTime = 1; this.sampleRate = 8000; this.state = 'running'; this.destination = node('destination'); }
  resume() {}
  createBuffer(channels, length) { const data = new Float32Array(length); return { getChannelData: () => data }; }
};
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
  try { for (; frames < 60 * (game.val('mender') + 2) && game.dents > 0; frames++) game.update(1 / 60); } catch (error) { threw = error; }
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
      game.update(1 / 60);
      if (f % 20 === 0) game.render();
      if (game.drill.mode === 'dead') { for (let n = 0; n < 300 && game.drill.mode === 'dead'; n++) game.update(1 / 60); game.input.auto = null; game.update(1 / 60); set(); }
    }
  } catch (error) { threw = error; }
  check(!threw, `flying ${name}, the step threw after ${(f / 60).toFixed(0)} s: ${threw?.message}\n      ${String(threw?.stack).split('\n').slice(1, 4).map(l => l.trim()).join(' < ')}`);
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

console.log(fails.length ? `DEFECT:\n  ${fails.join('\n  ')}` : `no defect: with audio as strict as a browser's (${made} sounds' worth of parts made), the hull mends itself and the drill flies every direction's ground without a step throwing; and a frame that throws is written down`);
process.exit(fails.length ? 1 : 0);
