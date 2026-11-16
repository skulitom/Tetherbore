// Every sound is synthesised here with Web Audio: there are no audio files. The context starts on the first touch.
//
// A sound is a few layers, each one source into one gain: a body (a low note that falls), a transient (a few
// thousandths of a second of bright noise), a tail (rubble, a ring, a shimmer). Repeats are never the same twice:
// pitch and loudness wander a little, and a run of cuts goes strong, weak, strong, weak. What must stay true:
//   - Making a sound only builds nodes and schedules them: no loop over samples, no buffer made, no timer. The two
//     buffers (a second of noise, the room's echo) are made once, in `unlock`.
//   - Every gain starts at nothing, rises in a ramp and ends at nothing in a ramp, so nothing clicks; every source
//     is stopped, and its layer taken out of the graph when it ends.
//   - A sound that can come many times a second has a least gap (`GAP`), and when many layers are sounding the
//     small sounds are let go (`crowded`), so a burst cannot stack up voices.
//   - With no context (a page not yet touched, a test in Node) and when muted, every `sfx` call does nothing. A
//     sound that goes wrong says so once and is dropped: the frame that asked for it goes on.
//   - `Math.random` is left to the game, whose tests count its draws: variation here has a generator of its own.
//     (`chime` draws from it once a call, heard or not, as it always did.)
//   - The music (at the foot of this file) is five oscillators that sound for as long as it plays: a timer once in
//     a second and a half posts their next notes on the audio clock. No node is made for a note, and nothing is
//     done in a frame.
// `node tools/sounds.mjs` renders every sound in a browser and measures it; test/regress/sound-layers.mjs holds the
// rules above with no browser.

let ctx = null, master = null, room = null, space = null, keys = null, noiseBuffer = null, muted = false, music = true, aside = false;
try { muted = localStorage.getItem('tetherbore-mute') === '1'; music = localStorage.getItem('tetherbore-music') !== '0'; } catch { /* private mode */ }

const LEVEL = 0.4;                       // the master gain when not muted
// Everything goes: layer -> master (the mute switch) -> a gentle compressor -> a soft ceiling -> the speaker. The
// ceiling is a curve that is a straight line up to half of full level and bends to stop short of it, so however
// many layers pile up nothing is clipped. Two more ways in, `room` and `space`, also feed a short echo of a small
// stone room: a little of it for blows (room), more for notes that should hang in the air (space).
export function unlock() {
  if (ctx) { if (ctx.state === 'suspended' && !aside) ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const c = new AC(), rate = c.sampleRate;
  master = c.createGain();
  master.gain.value = muted ? 0 : LEVEL;
  const squash = c.createDynamicsCompressor(), curve = new Float32Array(1025);
  try { squash.threshold.value = -16; squash.knee.value = 10; squash.ratio.value = 3.5; squash.attack.value = 0.004; squash.release.value = 0.16; } catch { /* the browser's own settings */ }
  for (let i = 0; i < curve.length; i++) {
    const x = i / 512 - 1, a = Math.abs(x);
    curve[i] = a <= 0.5 ? x : Math.sign(x) * (0.5 + 0.42 * Math.tanh((a - 0.5) / 0.42));
  }
  master.connect(squash);
  // (Whatever the browser cannot make, the ceiling, the echo or the music box, is done without.)
  try { const ceiling = c.createWaveShaper(); ceiling.curve = curve; squash.connect(ceiling); ceiling.connect(c.destination); } catch { squash.connect(c.destination); }
  noiseBuffer = c.createBuffer(1, rate, rate);
  const data = noiseBuffer.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < data.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; data[i] = s / 2147483648 - 1; }
  room = space = master;
  try {
    // The echo: under half a second of noise that dies away and grows duller as it dies, after a hundredth of a
    // second of nothing (so it stands behind the sound, not on it). It is short because the browser works on it
    // when it is handed over, here, and for as long as anything sounds through it: the music does not.
    const n = Math.floor(rate * 0.45), echo = c.createBuffer(1, n, rate), e = echo.getChannelData(0), wait = Math.floor(rate * 0.01);
    for (let i = wait, low = 0; i < n; i++) {
      const x = i / n;
      s = (s * 1664525 + 1013904223) >>> 0;
      low += (s / 2147483648 - 1 - low) * (0.5 - 0.38 * x);
      e[i] = low * (1 - x) * (1 - x) * Math.exp(-3.2 * x) * Math.min(1, (i - wait) / 240);
    }
    const verb = c.createConvolver(), wet = c.createGain(), some = c.createGain();
    verb.buffer = echo;
    wet.gain.value = 0.6; some.gain.value = 0.3;
    room = c.createGain(); space = c.createGain();
    room.connect(master); room.connect(some); some.connect(verb);
    space.connect(master); space.connect(verb);
    verb.connect(wet); wet.connect(master);
  } catch { room = space = master; }
  // The voice of every note that is a reward: a music box, a clear first harmonic with a little of the next few.
  try { keys = c.createPeriodicWave(new Float32Array([0, 0, 0, 0, 0, 0, 0]), new Float32Array([0, 1, 0.45, 0.18, 0.1, 0, 0.04])); } catch { keys = null; }
  // (The browser draws up a waveform the first time an oscillator asks for it, which takes it a moment: the two
  // that most sounds are made of are asked for now, at the first touch, not at the first cut.)
  c.createOscillator().type = 'triangle';
  seed = (seed ^ Date.now()) >>> 0;      // no two sittings wander the same way
  ctx = c;
  try { tune(); } catch { /* no music */ }
  if (aside) setAside(true);
}
// While the page is out of sight or another window has the focus the game is silent: the context is held still, so
// what is sounding stops where it is and goes on when the player comes back, and no sound is made meanwhile (one
// asked for would wait on the stopped clock and come with all the others at once on the way back).
export function setAside(value) {
  aside = !!value;
  if (!ctx) return;
  try {
    if (aside) ctx.suspend?.()?.catch?.(() => {});
    else if (ctx.state === 'suspended') ctx.resume()?.catch?.(() => {});
  } catch { /* left as it was */ }
}
export const isMuted = () => muted;
export function setMuted(value) {
  muted = value;
  try { localStorage.setItem('tetherbore-mute', value ? '1' : '0'); } catch { /* private mode */ }
  if (master) master.gain.value = value ? 0 : LEVEL;
  tune();
}
// The music has a switch of its own, kept as the mute is: on unless it was turned off. (Muted, there is none.)
export const isMusic = () => music;
export function setMusic(on) {
  music = !!on;
  try { localStorage.setItem('tetherbore-music', music ? '1' : '0'); } catch { /* private mode */ }
  tune();
}

// ---------------------------------------------------------------- what every sound is built from
let seed = 20261116, live = 0;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const vary = (value, by) => value * (1 + (rnd() * 2 - 1) * by);
// How many layers are sounding, and whether that is so many that a small sound should be let go.
const MOST = 26, crowded = () => live >= MOST;
const FLOOR = 0.001, TAIL = 0.012;
// A gain's whole life: nothing, up to `peak` in `attack` seconds, down to next to nothing by `end`, then nothing.
function fade(gain, t, peak, attack, end) {
  const top = t + Math.min(attack, (end - t) / 2);
  gain.value = 0;
  gain.setValueAtTime(0, t);
  gain.linearRampToValueAtTime(Math.max(FLOOR, peak), top);
  gain.exponentialRampToValueAtTime(FLOOR, end);
  gain.linearRampToValueAtTime(0, end + TAIL);
}
// A layer is started, stopped, and taken out of the graph when it has ended.
function play(source, gain, t, end, out, offset) {
  gain.connect(out);
  if (offset === undefined) source.start(t); else source.start(t, offset);
  source.stop(end + TAIL + 0.005);
  live++;
  source.onended = () => { live--; gain.disconnect(); };
}
const voice = (osc, type) => { if (type !== 'keys') osc.type = type; else if (keys) osc.setPeriodicWave(keys); else osc.type = 'triangle'; };
const sweep = (param, from, to, t, end) => {
  try { param.automationRate = 'k-rate'; } catch { /* an old browser */ }      // a filter that moves is worked out once a block, not once a sample
  param.setValueAtTime(from, t);
  if (to !== from) param.exponentialRampToValueAtTime(Math.max(30, to), end);
};

// A note: `freq` falling or rising to `to` over its length. `lp` puts a lowpass on it (closing to `lpTo`), which
// takes the edge off a sawtooth. `kick` is a pitch it starts at and drops from in a hundredth of a second: the
// knock at the front of a blow, for no node more.
function tone(freq, length, { type = 'triangle', gain = 0.2, to = freq, delay = 0, attack = 0.004, out = master, lp = 0, lpTo = lp, kick = 0 } = {}) {
  if (!(freq > 0 && to > 0 && length > 0 && kick >= 0)) return;
  const t = ctx.currentTime + delay, end = t + length, o = ctx.createOscillator(), g = ctx.createGain();
  voice(o, type);
  if (kick) { o.frequency.setValueAtTime(kick, t); o.frequency.exponentialRampToValueAtTime(freq, t + Math.min(0.012, length / 3)); }
  else o.frequency.setValueAtTime(freq, t);
  if (to !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), end);
  fade(g.gain, t, gain, attack, end);
  if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.7; sweep(f.frequency, lp, lpTo, t, end); o.connect(f); f.connect(g); } else o.connect(g);
  play(o, g, t, end, out);
}
// A burst of noise through a filter that may move.
function noise(length, { gain = 0.2, freq = 1200, to = freq, q = 1, delay = 0, type = 'bandpass', attack = 0.002, out = master } = {}) {
  const t = ctx.currentTime + delay, end = t + length, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuffer; src.loop = true;
  f.type = type; f.Q.value = q;
  sweep(f.frequency, freq, to, t, end);
  fade(g.gain, t, gain, attack, end);
  src.connect(f); f.connect(g);
  play(src, g, t, end, out, rnd() * 0.9);
}
// A run of notes on one oscillator: each is struck `gap` seconds after the last and dies to a quarter before the
// next; the last rings for `ring` seconds. However many notes, it is two nodes.
function line(freqs, gap, { type = 'keys', gain = 0.13, ring = 0.4, delay = 0, out = space } = {}) {
  if (!freqs.length || !freqs.every(f => f > 0)) return;
  const t = ctx.currentTime + delay, last = freqs.length - 1, end = t + last * gap + ring, o = ctx.createOscillator(), g = ctx.createGain();
  voice(o, type);
  g.gain.value = 0;
  g.gain.setValueAtTime(0, t);
  freqs.forEach((f, i) => {
    const at = t + i * gap;
    o.frequency.setValueAtTime(f, at);
    g.gain.linearRampToValueAtTime(i === last ? gain : gain * 0.85, at + 0.005);
    if (i < last) g.gain.exponentialRampToValueAtTime(gain * 0.25, at + gap);
  });
  g.gain.exponentialRampToValueAtTime(FLOOR, end);
  g.gain.linearRampToValueAtTime(0, end + TAIL);
  o.connect(g);
  play(o, g, t, end, out);
}
// Bits of noise on one source: `first` is a crack at the start (0 for none), then `count` grains scattered over
// `span` seconds, each smaller than the one before. Rubble falling, an arc spitting.
function grains(count, span, { gain = 0.1, first = 0, freq = 2600, q = 0.8, type = 'highpass', delay = 0, out = master } = {}) {
  const t = ctx.currentTime + delay, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuffer; src.loop = true;
  f.type = type; f.Q.value = q; f.frequency.value = freq;
  g.gain.value = 0;
  let at = t;
  const grain = (peak, length) => {
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(Math.max(FLOOR, peak), at + 0.002);
    g.gain.exponentialRampToValueAtTime(FLOOR, at + length);
    g.gain.linearRampToValueAtTime(0, at + length + 0.004);
    at += length + 0.006;
  };
  if (first) grain(first, 0.035);
  for (let i = 0; i < count; i++) { at += span / count * (0.3 + rnd()) * 0.7; grain(gain * (0.45 + 0.55 * rnd()) * (1 - 0.5 * i / count), 0.02 + 0.03 * rnd()); }
  src.connect(f); f.connect(g);
  play(src, g, t, at - TAIL, out, rnd() * 0.9);
}

const SCALE = [0, 2, 4, 7, 9];   // major pentatonic: any run of payouts is in tune
const note = step => 220 * 2 ** ((SCALE[((step % 5) + 5) % 5] + 12 * Math.floor(step / 5)) / 12);
const fold = freq => { while (freq > 3600) freq /= 2; return freq; };   // nothing shrill: a note too high is an octave down

// ---------------------------------------------------------------- the sounds
// Cutting, by how hard the ground is (1 soft, 2 dense, 3 slate, 4 a vault's wall): the crunch [from Hz, to Hz, Q,
// seconds, gain], the body under it [Hz, gain, the pitch its knock starts at], what the stone rings at [Hz] and
// the crack on top [gain]. Soft ground crumbles; hard ground knocks, slate rings, a vault cracks as well.
const ROCK = [null,
  [1500, 450, 0.9, 0.085, 0.27, 175, 0.19, 0, 0, 0],
  [1250, 380, 1.1, 0.1, 0.28, 150, 0.25, 700, 0, 0],
  [2100, 700, 1.4, 0.12, 0.23, 135, 0.25, 900, 1250, 0],
  [1700, 500, 1.6, 0.14, 0.24, 112, 0.28, 800, 820, 0.19]];
// A haul that is banked within RUN seconds of the last is one more of a run, and everything it plays is a step up.
const RUN = 8;
let digAt = -9, strong = true, grindAt = -9, beat = 0, bankedAt = -9, run = 0, trill = false;

const make = {
  // A cell is cut. `kind` is 'ore' (a bright note of the scale rings out of the crunch, a different one each time,
  // so a seam plays a little tune) or 'ice' (glass), or nothing.
  dig(hard = 1, kind = '') {
    if (hard < 1) { make.crumble(); return; }
    const t = ctx.currentTime, [from, to, q, length, crunch, low, body, kick, ring, crack] = ROCK[Math.min(4, Math.round(hard))] ?? ROCK[1];
    // One cut soon after another is the weaker and higher of a pair: a held cut is a rhythm.
    strong = t - digAt > 0.22 || !strong; digAt = t;
    const a = strong ? 1 : 0.68, up = strong ? 1 : 1.12, thin = crowded();
    noise(length, { freq: vary(from, 0.1) * up, to, q, gain: crunch * a });
    if (thin) return;
    tone(vary(low, 0.07) * up, length * 0.85, { gain: body * a, to: 62, kick: kick * up });
    if (crack) noise(0.022, { type: 'highpass', freq: 3200, gain: crack * a, attack: 0.001 });
    if (ring) tone(vary(ring, 0.05), 0.1, { type: 'sine', gain: 0.06 * a, delay: 0.004, out: room });
    if (kind === 'ore') tone(note(10 + ((rnd() * 5) | 0)), 0.18, { type: 'keys', gain: 0.09, delay: 0.012, out: space });
    else if (kind === 'ice') tone(vary(2300, 0.1), 0.07, { type: 'sine', gain: 0.06, to: 3000, delay: 0.006, out: room });
  },
  // A block of a haul breaks up: small, and one in three knocks.
  crumble() {
    if (crowded()) return;
    noise(0.05, { freq: vary(1050, 0.3), to: 480, q: 1, gain: vary(0.16, 0.25) });
    if (rnd() < 0.34) tone(vary(210, 0.15), 0.05, { gain: 0.11, to: 90 });
  },
  // The bit working at a cell that takes a while. It is asked for thirty times a second and plays ten: four to a
  // bar, the first the strongest, with the motor's chug under the first and third.
  grind() {
    const t = ctx.currentTime;
    beat = t - grindAt > 0.3 ? 0 : (beat + 1) % 4; grindAt = t;
    if (crowded()) return;
    const a = [1, 0.5, 0.72, 0.5][beat];
    noise(0.06, { freq: vary(beat ? 2300 : 1850, 0.05), to: 1250, q: 2.2, gain: 0.075 * a, attack: 0.004 });
    if (!(beat & 1)) tone(beat ? 150 : 118, 0.07, { gain: 0.06 * a, to: 80 });
  },
  slide(cells = 3) {
    const length = 0.13 + Math.min(cells, 12) * 0.012;
    noise(length, { freq: 500, to: 2600, gain: 0.1, q: 1.4, attack: length * 0.35 });
    if (!crowded()) tone(vary(250, 0.05), length, { type: 'sine', gain: 0.035, to: 300 + Math.min(cells, 12) * 45, attack: length * 0.3 });
  },
  step(run = 0) { noise(0.035, { freq: 700 + run * 1100, to: 400 + run * 600, gain: 0.05, q: 2.5 }); },
  thud() { tone(vary(168, 0.08), 0.1, { gain: 0.24, to: 56 }); noise(0.06, { type: 'lowpass', freq: 750, to: 200, q: 0.6, gain: 0.12 }); },
  clink() {
    const f = vary(1500, 0.05);
    tone(f, 0.08, { gain: 0.16, to: f * 0.8, out: room }); tone(f * 1.53, 0.06, { type: 'sine', gain: 0.08, delay: 0.012, out: room });
    noise(0.012, { type: 'highpass', freq: 5000, gain: 0.06, attack: 0.001 });
  },
  // The end of the tether's reach: a plucked string, bright at the pluck and dull as it dies.
  twang() {
    const f = vary(196, 0.03);
    tone(f, 0.34, { type: 'sawtooth', gain: 0.15, to: f * 0.78, lp: 2400, lpTo: 420 });
    tone(f * 2, 0.22, { gain: 0.08, to: f * 1.56 });
    noise(0.014, { type: 'highpass', freq: 2500, gain: 0.07, attack: 0.001 });
  },
  // The tether closes round a piece. The tether snaps taut (a crack), the ground lets go (a drop, lower and longer
  // the bigger the piece), rubble falls, the rope takes up a big piece (a rush that rises), and two notes say it is
  // caught: `link` is how many hauls came just before it, and the notes are a step higher for each.
  crack(size = 1, link = 0) {
    const big = Math.min(1, Math.log2(1 + Math.max(0, size)) / 7.6), step = 5 + Math.min(8, Math.max(0, link | 0));
    if (size >= 30) hush(0.45, 0.5);
    grains(size >= 6 ? 2 + Math.round(big * 4) : 0, 0.18 + big * 0.3, { first: 0.15 + big * 0.1, gain: 0.07 + big * 0.05, delay: 0, out: room });
    tone(vary(200 - big * 60, 0.05), 0.2 + big * 0.36, { gain: 0.3 + big * 0.18, to: 42, out: room });
    noise(0.2 + big * 0.45, { type: 'lowpass', freq: 1000, to: 110, q: 0.6, gain: 0.2 + big * 0.2, attack: 0.004, out: room });
    if (size >= 30) noise(0.45, { freq: 500, to: 2200, q: 2, gain: 0.05 + big * 0.04, delay: 0.1, attack: 0.16 });
    line([note(step), note(step + 2)], 0.07, { gain: 0.1 + big * 0.03, ring: 0.3 + big * 0.2, delay: 0.045 });
  },
  // A bit of a haul comes home. `step` climbs as the haul is paid out; one tick in two is the octave above; and the
  // whole count is a step higher for each haul of a run.
  tick(step = 0) {
    if (crowded()) return;
    const f = note(Math.min(19, Math.max(0, step | 0) + (ctx.currentTime - bankedAt < RUN ? run + 1 : 0)));
    trill = !trill;
    tone(trill || f > 1500 ? f : f * 2, 0.1, { type: 'keys', gain: trill ? 0.15 : 0.1, attack: 0.003, out: space });
  },
  // A gem, a chain, a thing learnt: a bell and the note two above it, with a glint on top.
  gem(step = 0) {
    const f = fold(note((step | 0) + 10));
    tone(f, 0.34, { type: 'keys', gain: 0.15, out: space });
    tone(fold(note((step | 0) + 12)), 0.32, { type: 'keys', gain: 0.085, delay: 0.055, out: space });
    if (f < 1800) tone(f * 4, 0.045, { type: 'sine', gain: 0.022, attack: 0.002 });
  },
  // The last of a haul is home. The load lands, and a chord is run up: two notes for a small haul, five (doubled
  // an octave down, with a shimmer) for a huge one (the sizes are the banners': 10, 30, 80), and a step higher for
  // each haul of a run.
  banked(size = 1) {
    const t = ctx.currentTime, tier = size >= 80 ? 3 : size >= 30 ? 2 : size >= 10 ? 1 : 0;
    run = t - bankedAt < RUN ? Math.min(5, run + 1) : 0; bankedAt = t;
    if (tier) hush(0.5, 0.5 + tier * 0.15);
    const chord = [0, 2, 3, 5, 7].slice(0, 2 + tier).map(s => note(5 + run + tier + s)), last = (chord.length - 1) * 0.062;
    tone(vary(210, 0.05), 0.11 + tier * 0.02, { gain: 0.2 + tier * 0.04, to: 80, out: room });
    line(chord, 0.062, { gain: 0.19 + tier * 0.015, ring: 0.4 + tier * 0.12 });
    if (tier) line(chord.map(f => f / 2), 0.062, { type: 'triangle', gain: 0.07 + tier * 0.015, ring: 0.3 + tier * 0.1 });
    if (tier) tone(fold(chord[chord.length - 1] * 2), 0.45 + tier * 0.15, { type: 'sine', gain: 0.035 + tier * 0.008, delay: last + 0.03, attack: 0.012, out: space });
    if (tier >= 2) noise(0.3 + tier * 0.05, { type: 'highpass', freq: 6500, gain: 0.014 + tier * 0.004, attack: 0.06, delay: last, out: space });
  },
  // A giant haul (`giant` 1 to 6 by its size; 7 is half of all the ground the longest tether reaches round). The
  // ground falls in, a boom and a long rumble, and a run of bells climbs, a note longer for each step up, doubled an
  // octave down and with a shimmer over the big ones; half of everything ends on two bells held a long while.
  vast(giant = 1) {
    const g = Math.max(1, Math.min(7, giant | 0)), half = g === 7;
    hush(0.2, 1 + g * 0.3);
    tone(vary(96, 0.03), 0.6 + g * 0.1, { gain: 0.2, to: 38, out: room });
    noise(0.8 + g * 0.15, { type: 'lowpass', freq: 520, to: 90, q: 0.7, gain: 0.1 + g * 0.01, attack: 0.03, out: room });
    const run = [5, 7, 8, 10, 12, 13, 15, 17, 18, 20].slice(0, 3 + g).map(note), last = (run.length - 1) * 0.07;
    line(run, 0.07, { gain: 0.15, ring: 0.6 + g * 0.08, delay: 0.12 });
    if (g >= 2 && !half) line(run.map(f => f / 2), 0.07, { type: 'triangle', gain: 0.07, ring: 0.5 + g * 0.06, delay: 0.12 });
    if (g >= 3) noise(0.5 + g * 0.08, { type: 'highpass', freq: 6500, gain: 0.02, attack: 0.08, delay: 0.12 + last, out: space });
    if (half) for (const [step, gain] of [[20, 0.07], [22, 0.05]]) tone(fold(note(step)), 3, { type: 'keys', gain, attack: 0.25, delay: 0.2 + last, out: space });
  },
  recall() { noise(0.4, { freq: 300, to: 3200, gain: 0.12, q: 2, attack: 0.1 }); tone(200, 0.4, { gain: 0.07, to: 900, attack: 0.08 }); },
  // The drill rides on to the core: the latch, and two notes a fifth apart.
  dock() {
    noise(0.03, { freq: 1800, to: 900, q: 2, gain: 0.09 }); tone(190, 0.07, { gain: 0.14, to: 100 });
    line([330, 495], 0.09, { gain: 0.15, ring: 0.3 });
  },
  // Something bought: the lever goes over, a chord is run up, and coins.
  buy() {
    hush(0.5, 0.6);
    noise(0.05, { freq: 900, to: 320, q: 1, gain: 0.14 }); tone(200, 0.07, { gain: 0.16, to: 105 });
    line([note(5), note(7), note(8), note(10)], 0.055, { gain: 0.17, ring: 0.5, delay: 0.05 });
    tone(note(15), 0.4, { type: 'sine', gain: 0.04, delay: 0.24, attack: 0.01, out: space });
    noise(0.26, { type: 'highpass', freq: 6000, gain: 0.02, attack: 0.03, delay: 0.2, out: space });
  },
  deny() { tone(196, 0.09, { gain: 0.085, to: 158 }); tone(150, 0.13, { gain: 0.085, to: 118, delay: 0.1 }); },
  tap() { tone(620, 0.05, { type: 'sine', gain: 0.11, to: 900, attack: 0.002 }); },
  low() { line([440, 330], 0.11, { type: 'triangle', gain: 0.1, ring: 0.14, out: master }); },
  // An arc: it spits, falls in pitch, and thumps.
  zap() {
    grains(4, 0.16, { first: 0.15, gain: 0.1, freq: 3000 });
    tone(1100, 0.2, { type: 'sawtooth', gain: 0.1, to: 110, lp: 2600, lpTo: 600 });
    tone(165, 0.12, { gain: 0.15, to: 60, out: room });
  },
  hiss() { noise(0.6, { type: 'highpass', freq: 5200, to: 1300, q: 0.7, gain: 0.11, attack: 0.02 }); noise(0.35, { freq: 900, to: 500, q: 0.8, gain: 0.05, attack: 0.03 }); },
  puff() { noise(0.4, { type: 'lowpass', freq: 520, to: 160, q: 0.8, gain: 0.22, attack: 0.01 }); tone(240, 0.12, { gain: 0.08, to: 100 }); },
  freeze() { const f = note(15 + ((rnd() * 4) | 0)); tone(f, 0.12, { type: 'sine', gain: 0.05, to: f * 1.3, out: space }); },
  // A relic, a cache, a part of a wreck: the scale run up over two held notes, the top note rung, and a shimmer.
  relic() {
    hush(0.4, 1.3);
    line([0, 2, 4, 5, 7, 9, 10, 12].map(s => note(5 + s)), 0.085, { gain: 0.12, ring: 0.9 });
    tone(note(5), 1.3, { type: 'sine', gain: 0.05, attack: 0.12, out: space }); tone(note(8), 1.3, { type: 'sine', gain: 0.04, attack: 0.16, out: space });
    tone(note(15), 0.9, { type: 'keys', gain: 0.07, delay: 0.6, out: space });
    noise(0.5, { type: 'highpass', freq: 7000, gain: 0.016, attack: 0.1, delay: 0.55, out: space });
  },
  // The hull: a knock that takes a pip (a struck plate: the blow, and the plate ringing at two notes that do not
  // agree), the wreck (the blow, the motor running down, three notes falling, then the winch taking up the
  // tether), and the mend at the core (two bright taps and a rising note).
  knock() {
    const f = vary(410, 0.04);
    tone(vary(230, 0.05), 0.16, { gain: 0.3, to: 85, out: room }); noise(0.1, { freq: 2000, to: 500, q: 1, gain: 0.26, attack: 0.001, out: room });
    tone(f, 0.22, { type: 'sine', gain: 0.09, out: room }); tone(f * 2.32, 0.14, { type: 'sine', gain: 0.045, delay: 0.004, out: room });
  },
  wreck() {
    hush(0.3, 2);
    noise(0.5, { type: 'lowpass', freq: 1200, to: 120, q: 0.6, gain: 0.3, out: room }); tone(300, 0.4, { type: 'sine', gain: 0.08, to: 270, out: room });
    tone(420, 0.7, { type: 'sawtooth', gain: 0.17, to: 40, lp: 1400, lpTo: 300 });
    line([note(7), note(5), note(3)], 0.17, { gain: 0.07, ring: 0.5, delay: 0.22 });
    noise(1.6, { freq: 260, to: 1500, q: 2.5, gain: 0.07, delay: 0.5, attack: 0.3 }); tone(120, 1.6, { gain: 0.05, to: 330, delay: 0.5, attack: 0.25 });
  },
  mend() { line([1320, 1320], 0.07, { gain: 0.11, ring: 0.06, out: room }); tone(note(8), 0.32, { type: 'keys', gain: 0.14, to: note(11), delay: 0.14, out: space }); },
};

// The least time between two of one sound, in seconds: for any not named, a fiftieth, so that two asked for in one
// frame are one sound and not one twice as loud.
const GAP = { dig: 0.04, crumble: 0.055, grind: 0.095, tick: 0.04, gem: 0.05, slide: 0.05, thud: 0.05, clink: 0.08, hiss: 0.1, puff: 0.08, freeze: 0.06, zap: 0.06, knock: 0.1, banked: 0.08, relic: 0.25, ping: 0.05 };
const played = Object.create(null);
let told = false;
// A sound by name: `sfx.dig(2)`. Nothing happens with no context, when muted, while the page is aside (`setAside`),
// or sooner than its gap after the last.
const sound = (name, build) => (...args) => {
  if (!ctx || muted || aside) return;
  const t = ctx.currentTime, was = played[name];
  if (was !== undefined && t >= was && t - was < (GAP[name] ?? 0.02)) return;
  played[name] = t;
  try { build(...args); } catch (error) { if (!told) { told = true; console.warn(`sound ${name}:`, error); } }
};
export const sfx = {};
for (const name of Object.keys(make)) sfx[name] = sound(name, make[name]);

// ---------------------------------------------------------------- the sounds of the ground
// What a ground does by itself now and then, and what the drill sets off in it (js/feel.js asks for them): ice that
// groans and then sings as a frozen lake does, an icicle shattering, a drop of water that plinks, gas that blubs out
// of the mud, the ground shaking, the wind, sand pouring, sparks. They are soft beside the game's own sounds, and
// none but the shatter is made when many layers are sounding already. `near` is 0 at the edge of hearing and 1
// beside the drill; whatever a sound is asked with (nothing, or a number that is no number), it makes its sound:
// what is not a number is taken as beside the drill, and every other figure has a plain value of its own. The low
// sounds are pitched where a phone's speaker still plays them, a hundred cycles and up.
// The notes a drop is struck on (a step of `scale` over `base`): the music may point these at the ground's own scale.
export const PLINK = { base: 880, scale: [0, 2, 4, 7, 9] };
const loud = near => Number.isFinite(near) ? 0.35 + 0.65 * Math.min(1, Math.max(0, near)) : 1;
const figure = (value, plain, least, most) => Number.isFinite(value) ? Math.min(most, Math.max(least, value)) : plain;
const quirks = {
  // A groan in the ice, and the long falling note a frozen lake sings after it. `pitch` is the ice's (1 the north's).
  creak(near, pitch) {
    if (crowded()) return;
    const a = loud(near), p = figure(pitch, 1, 0.4, 2.5), f = vary(170, 0.12) * p;
    tone(f, 0.6, { type: 'sawtooth', gain: 0.05 * a, to: f * 0.8, lp: 900, lpTo: 480, attack: 0.12, out: room });
    tone(vary(1900, 0.1) * p, 0.42, { type: 'sine', gain: 0.03 * a, to: 420 * p, delay: 0.16, attack: 0.01, out: space });
  },
  // An icicle hits the floor: glass breaking, and two bright notes.
  shatter(near) {
    const a = loud(near);
    grains(5, 0.16, { first: 0.09 * a, gain: 0.06 * a, freq: 4200, out: room });
    tone(vary(2600, 0.06), 0.12, { type: 'sine', gain: 0.05 * a, to: 3400, out: room });
    tone(3900, 0.08, { type: 'sine', gain: 0.025 * a, delay: 0.03, out: space });
  },
  // A drop lands: a note that rises as it dies (`step` is its place in PLINK), and a soft knock under it.
  drip(near, step) {
    if (crowded()) return;
    const a = loud(near), s = Math.round(figure(step, 0, -10, 10)), n = PLINK.scale.length;
    const f = fold(PLINK.base * 2 ** ((PLINK.scale[((s % n) + n) % n] + 12 * Math.floor(s / n)) / 12));
    tone(f, 0.09, { type: 'sine', gain: 0.05 * a, to: f * 1.5, attack: 0.003, out: space });
    tone(f / 2, 0.05, { gain: 0.02 * a, attack: 0.002 });
  },
  // Gas out of the mud: a bubble's note rising, and the pop.
  blub(near) {
    if (crowded()) return;
    const a = loud(near);
    tone(vary(150, 0.1), 0.12, { type: 'sine', gain: 0.06 * a, to: 420, lp: 900, attack: 0.01 });
    noise(0.03, { type: 'lowpass', freq: 700, gain: 0.03 * a, delay: 0.1 });
  },
  // The ground shakes: a rumble, a low note under it falling, and grit coming down. `power` 0.3 to 2.
  quake(power) {
    if (crowded()) return;
    const p = figure(power, 1, 0.3, 2), length = 1.2 + 0.4 * p;
    noise(length, { type: 'lowpass', freq: 400, to: 200, q: 0.8, gain: 0.08 + 0.03 * p, attack: 0.15, out: room });
    tone(vary(105, 0.05), length * 0.9, { type: 'triangle', gain: 0.07 + 0.03 * p, to: 72, attack: 0.12, out: room });
    grains(4 + Math.round(2 * p), 0.9, { first: 0.03, gain: 0.03, freq: 900, type: 'bandpass', delay: 0.2 });
  },
  // The wind gets up and drops: it rises in pitch as it comes. `strength` 0.2 to 2.
  gust(strength) {
    if (crowded()) return;
    const s = figure(strength, 1, 0.2, 2);
    noise(2.4, { freq: 380, to: 1300, q: 1.2, gain: 0.035 + 0.02 * s, attack: 0.9 });
    noise(1.8, { type: 'highpass', freq: 3000, to: 1800, q: 0.7, gain: 0.012 + 0.008 * s, delay: 0.3, attack: 0.6 });
  },
  // Sand pouring from the roof.
  trickle(near) {
    if (crowded()) return;
    const a = loud(near);
    grains(12, 0.9, { first: 0.02 * a, gain: 0.035 * a, freq: 3400, type: 'bandpass', q: 1.2 });
    noise(0.8, { type: 'highpass', freq: 5000, to: 3000, gain: 0.018 * a, attack: 0.2 });
  },
  // Sparks spitting: a vent, a crystal woken.
  crackle(near) {
    if (crowded()) return;
    const a = loud(near);
    grains(6, 0.35, { first: 0.04 * a, gain: 0.04 * a, freq: 2400 });
  },
};
Object.assign(GAP, { creak: 1.2, shatter: 0.12, drip: 0.1, blub: 0.15, quake: 1.5, gust: 2, trickle: 0.4, crackle: 0.2 });
for (const name of Object.keys(quirks)) sfx[name] = sound(name, quirks[name]);

// ---------------------------------------------------------------- the sound of the place
// A bed of filtered noise and a low drone that change with the ground the drill is in, and now and then a single
// soft note from that ground's own scale.
let bed = null, bedKey = -1, ground = 0, depth = false, away = 0, band = null, conductor = 0;
const AIR = [[420, 55], [1500, 82], [240, 41], [700, 62], [520, 73]];     // [filter Hz, drone Hz] per direction
// (`far` is how many cells the drill is from the core, if the game says: only the music listens to it.)
export function setAmbience(biome, deep, far) {
  if (far >= 0) away = far;
  if (!ctx) return;
  if (!bed) {
    const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), out = ctx.createGain(), drone = ctx.createOscillator(), dg = ctx.createGain();
    src.buffer = noiseBuffer; src.loop = true;
    filter.type = 'lowpass'; filter.Q.value = 0.6;
    out.gain.value = 0;
    drone.type = 'sine'; dg.gain.value = 0.5;
    src.connect(filter); filter.connect(out); drone.connect(dg); dg.connect(out); out.connect(master);
    src.start(); drone.start();
    bed = { filter, out, drone };
  }
  const key = biome + (deep ? 10 : 0);
  if (key === bedKey) return;
  bedKey = key;
  // The music goes with the ground: what it holds is let go, and its next notes are the new ground's.
  ground = biome; depth = !!deep;
  if (band) for (const v of band.voices) if (v.held) v.at = 0;
  const [hz, low] = AIR[biome] ?? AIR[0], t = ctx.currentTime;
  bed.filter.frequency.setTargetAtTime(hz * (deep ? 0.7 : 1), t, 1.2);
  bed.drone.frequency.setTargetAtTime(low * (deep ? 0.75 : 1), t, 1.2);
  bed.out.gain.setTargetAtTime(0.06, t, 1.5);
}
const MOODS = [[0, 4, 7], [7, 9, 12, 14, 16], [0, 3, 5], [2, 4, 9, 11], [0, 4, 7, 9]];
const TOP = [440, 880, 165, 330, 440];                                     // the note each direction's scale stands on
const chime = sound('chime', (biome, pick) => {
  const steps = MOODS[biome] ?? MOODS[0], f = (TOP[biome] ?? TOP[0]) * 2 ** (steps[(pick * steps.length) | 0] / 12);
  tone(f, 1.6, { type: 'sine', gain: 0.045, attack: 0.08, out: space });
  tone(f * 1.5, 1.2, { type: 'sine', gain: 0.02, attack: 0.1, delay: 0.22, out: space });
});
// (The game's own generator picks the note, once a call whether or not it is heard: the game's tests count on it.)
sfx.chime = biome => chime(biome, Math.random());
// A place's name comes up on its plate: two notes of its direction's scale, the lowest and then the highest.
sfx.place = sound('place', kin => {
  const steps = MOODS[kin] ?? MOODS[0], top = TOP[kin] ?? TOP[0];
  line([top * 2 ** (steps[0] / 12), top * 2 ** (steps[steps.length - 1] / 12)], 0.13, { type: 'triangle', gain: 0.085, ring: 0.5 });
});
// A ground met for the first time: the notes of its scale together, spread a little, over the note it stands on.
sfx.arrive = sound('arrive', kin => {
  const steps = MOODS[kin] ?? MOODS[0], top = TOP[kin] ?? TOP[0];
  tone(top / 2, 1.8, { gain: 0.07, attack: 0.03, out: space });
  steps.slice(0, 4).forEach((step, n) => tone(top * 2 ** (step / 12), 1.5, { type: 'sine', gain: 0.07, attack: 0.03, delay: 0.05 + n * 0.07, out: space }));
});
// Something seen for the first time: a few notes of its own for each kind of thing.
const SPOTS = { cache: [10, 12], geode: [7, 9, 12], wreck: [6, 3], key: [5, 5], prism: [12, 14, 17], relic: [5, 7, 9, 12], mineral: [8, 11] };
sfx.spot = sound('spot', what => line((SPOTS[what] ?? SPOTS.cache).map(note), 0.09, { gain: 0.11, ring: 0.32 }));
// A wreck close by ticks: `near` is 0 at the edge of hearing and 1 beside it.
sfx.ping = sound('ping', (near = 0) => tone(620 + 260 * near, 0.08, { type: 'sine', gain: 0.035 + 0.05 * near, attack: 0.002, out: space }));

// ---------------------------------------------------------------- the music
// It grows out of the bed: over the drone, two soft notes of the ground's own scale are held for ten seconds or so
// and let go, not together, so that the pair is always changing; and now and then a third, an octave or so up,
// comes and goes. Each ground has its scale, on the note its drone stands on, and the scale holds the notes its
// chimes are drawn from: the home ground the plainest (a major five-note scale, its notes held longest and the
// third voice rarest), the north open and with no third, the south minor, the west major, the east with a raised
// seventh. Deep ground and ground far from the core are darker and sparser; on the core it is a little brighter.
// A big reward hushes it for a moment (`hush`). While the page is hidden it lets go of what it holds.
//
// Three voices, thirteen nodes, made when the music starts and kept until it stops. A held voice is two triangles
// into a gain, the second quieter and a third of a cycle a second sharp, so that the note swells and sinks slowly
// and never stands still; the third voice is one sine. All go through one lowpass, the hush and the music's own
// level into the master (not the echo: see `unlock`). A note is a few numbers posted on the audio clock by a timer
// that runs once in a second and a half: no node is made for it, and nothing is done in a frame. Which note comes
// next is drawn from the generator the sounds use, so it never comes round again.
const MODE = [[0, 2, 4, 7, 9], [0, 2, 5, 7, 9], [0, 3, 5, 7, 10], [0, 2, 4, 7, 9], [0, 2, 4, 7, 11]];
const EVERY = 1500, AHEAD = 2;          // the timer's period in milliseconds, and how far ahead it posts, in seconds
const MUSIC = 0.5;                      // the music's level against the sounds'
const degree = (base, mode, k) => base * 2 ** ((mode[((k % 5) + 5) % 5] + 12 * Math.floor(k / 5)) / 12);
function hush(to, hold) {
  if (!band) return;
  const t = ctx.currentTime;
  band.duck.gain.setTargetAtTime(to, t, 0.05); band.duck.gain.setTargetAtTime(1, t + hold, 0.5);
}
// The music is playing exactly when there is a context, its switch is on and the game is not muted.
function tune() {
  const want = !!ctx && music && !muted;
  if (want && !band) {
    const t = ctx.currentTime, soft = ctx.createBiquadFilter(), duck = ctx.createGain(), out = ctx.createGain();
    soft.type = 'lowpass'; soft.Q.value = 0.5; soft.frequency.value = 1000;
    out.gain.value = 0; out.gain.setTargetAtTime(MUSIC, t, 1.2);
    soft.connect(duck); duck.connect(out); out.connect(master);
    const voices = [0, 1, 2].map(n => {
      const gain = ctx.createGain(), oscs = [ctx.createOscillator()];
      gain.gain.value = 0; gain.connect(soft);
      oscs[0].type = n < 2 ? 'triangle' : 'sine'; oscs[0].connect(gain);
      if (n < 2) {
        const beside = ctx.createOscillator(), less = ctx.createGain();
        beside.type = 'triangle'; less.gain.value = 0.45;
        beside.connect(less); less.connect(gain); oscs.push(beside);
      }
      for (const o of oscs) o.start(t);
      return { gain, oscs, held: false, at: t + [0.4, 4, 9][n], k: [0, 5, 10][n] };
    });
    band = { soft, duck, out, voices, bright: 0 };
    conductor = setInterval(conduct, EVERY);
    conductor.unref?.();                // (in Node, where the tests run, a timer would keep a finished test from ending)
    conduct();
  } else if (!want && band) {
    clearInterval(conductor);
    const old = band;
    band = null;
    if (!ctx) return;
    const t = ctx.currentTime, oscs = old.voices.flatMap(v => v.oscs);
    old.out.gain.setTargetAtTime(0, t, 0.25);
    for (const o of oscs) o.stop(t + 2);
    oscs[0].onended = () => old.out.disconnect();
  }
}
// What the timer does: each voice whose next change falls within AHEAD seconds has it posted. A voice at rest
// takes a note and rises to it; a voice holding one lets it go, and rests until it has died away and a while more.
// (A voice whose time is nothing was told to let go by a change of ground: `setAmbience`.)
function conduct() {
  if (!band) return;
  const t = ctx.currentTime, mode = MODE[ground] ?? MODE[0], home = ground === 0, hidden = typeof document !== 'undefined' && !!document.hidden;
  const thin = Math.min(1, Math.max(0, (away - 130) / 1200) + (depth ? 0.35 : 0));
  let base = (AIR[ground] ?? AIR[0])[1] * 4;
  if (base < 190) base *= 2;
  const bright = Math.round((away < 3 ? 1500 : 1050) * (1 - 0.4 * thin));
  if (bright !== band.bright) { band.bright = bright; band.soft.frequency.setTargetAtTime(bright, t, 2.5); }
  band.voices.forEach((v, n) => {
    if (hidden ? !v.held : v.at > t + AHEAD) return;
    const at = hidden ? t + 0.05 : Math.max(v.at, t + 0.05), long = n < 2;
    if (v.held) {
      const fall = long ? 1.8 : 1.1, told = v.at === 0;
      v.gain.gain.setTargetAtTime(0, at, fall);
      v.held = false;
      v.at = at + fall * 3 + (told ? n * 2.5 : long ? rnd() * 3 * (1 + thin) : (5 + rnd() * 11) * (1 + 2 * thin) * (home ? 1.5 : 1));
      return;
    }
    // The low voice keeps to the notes the scale stands on (its first, its fifth, its third); the others wander by
    // a step or two, each within its own octave or so.
    if (n === 0) { const was = v.k; do v.k = [0, 0, 3, 2][(rnd() * 4) | 0]; while (v.k === was && rnd() < 0.8); }
    else {
      const low = n === 1 ? 3 : 8, high = n === 1 ? 8 : 12;
      v.k = Math.max(low, Math.min(high, v.k + [-2, -1, -1, 1, 1, 2][(rnd() * 6) | 0]));
      if (v.k === band.voices[0].k + 5) v.k += v.k < high ? 1 : -1;            // never the low voice's own note
    }
    let f = degree(base, mode, v.k);
    while (f > 1500) f /= 2;
    v.oscs[0].frequency.setValueAtTime(f, at);
    if (long) v.oscs[1].frequency.setValueAtTime(f + 0.3 + 0.1 * n, at);
    v.gain.gain.setTargetAtTime([0.02, 0.016, 0.013][n] * (n ? 1 - 0.4 * thin : 1), at, long ? 1.6 : 0.4);
    v.held = true;
    v.at = at + (long ? (7 + rnd() * 7) * (home ? 1.3 : 1) : 1.4 + rnd() * 1.2);
  });
}
