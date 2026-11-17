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
//   - The music (at the foot of this file) is eleven sources that sound for as long as it plays, each ground's own
//     piece: a timer twice a second posts their next notes on the audio clock. No node is made for a note or for a
//     change of ground, and nothing is done in a frame.
// `node tools/sounds.mjs` renders every sound in a browser and measures it; test/regress/sound-layers.mjs holds the
// rules above with no browser.

let ctx = null, master = null, sounds = null, room = null, space = null, keys = null, noiseBuffer = null, muted = false, music = true, aside = false;
try { muted = localStorage.getItem('tetherbore-mute') === '1'; music = localStorage.getItem('tetherbore-music') !== '0'; } catch { /* private mode */ }

const LEVEL = 0.4;                       // the master gain when not muted
const SOUNDS = 0.6;                      // what the sounds and the bed are laid on at, against the music
// Everything goes: layer -> sounds -> master (the mute switch) -> a gentle compressor -> a soft ceiling -> the
// speaker. Every sound and the bed go through `sounds`, which lays them on at SOUNDS, and the music straight into the
// master, so the music is heard beside them and not under them. The
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
  sounds = c.createGain();
  sounds.gain.value = SOUNDS;
  sounds.connect(master);
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
  room = space = sounds;
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
    room.connect(sounds); room.connect(some); some.connect(verb);
    space.connect(sounds); space.connect(verb);
    verb.connect(wet); wet.connect(sounds);
  } catch { room = space = sounds; }
  // The voice of every note that is a reward: a music box, a clear first harmonic with a little of the next few.
  try { keys = c.createPeriodicWave(new Float32Array([0, 0, 0, 0, 0, 0, 0]), new Float32Array([0, 1, 0.45, 0.18, 0.1, 0, 0.04])); } catch { keys = null; }
  // (And the waves the music's instruments are made of, which the cues of a place ring in too.)
  try { for (const [name, h] of Object.entries(SHAPES)) waves[name] = c.createPeriodicWave(new Float32Array(h.length + 1), new Float32Array([0, ...h])); } catch { /* triangles */ }
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
const voice = (osc, type) => { if (BUILT.includes(type)) osc.type = type; else if (type === 'keys' && keys) osc.setPeriodicWave(keys); else if (waves[type]) osc.setPeriodicWave(waves[type]); else osc.type = 'triangle'; };
const sweep = (param, from, to, t, end) => {
  try { param.automationRate = 'k-rate'; } catch { /* an old browser */ }      // a filter that moves is worked out once a block, not once a sample
  param.setValueAtTime(from, t);
  if (to !== from) param.exponentialRampToValueAtTime(Math.max(30, to), end);
};

// A note: `freq` falling or rising to `to` over its length. `lp` puts a lowpass on it (closing to `lpTo`), which
// takes the edge off a sawtooth. `kick` is a pitch it starts at and drops from in a hundredth of a second: the
// knock at the front of a blow, for no node more.
function tone(freq, length, { type = 'triangle', gain = 0.2, to = freq, delay = 0, attack = 0.004, out = sounds, lp = 0, lpTo = lp, kick = 0 } = {}) {
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
function noise(length, { gain = 0.2, freq = 1200, to = freq, q = 1, delay = 0, type = 'bandpass', attack = 0.002, out = sounds } = {}) {
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
function grains(count, span, { gain = 0.1, first = 0, freq = 2600, q = 0.8, type = 'highpass', delay = 0, out = sounds } = {}) {
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
  low() { line([440, 330], 0.11, { type: 'triangle', gain: 0.1, ring: 0.14, out: sounds }); },
  // An arc: it spits, falls in pitch, and thumps.
  zap() {
    grains(4, 0.16, { first: 0.15, gain: 0.1, freq: 3000 });
    tone(1100, 0.2, { type: 'sawtooth', gain: 0.1, to: 110, lp: 2600, lpTo: 600 });
    tone(165, 0.12, { gain: 0.15, to: 60, out: room });
  },
  hiss() { noise(0.6, { type: 'highpass', freq: 5200, to: 1300, q: 0.7, gain: 0.11, attack: 0.02 }); noise(0.35, { freq: 900, to: 500, q: 0.8, gain: 0.05, attack: 0.03 }); },
  puff() { noise(0.4, { type: 'lowpass', freq: 520, to: 160, q: 0.8, gain: 0.22, attack: 0.01 }); tone(240, 0.12, { gain: 0.08, to: 100 }); },
  freeze() { const f = note(15 + ((rnd() * 4) | 0)); tone(f, 0.12, { type: 'sine', gain: 0.05, to: f * 1.3, out: space }); },
  // The rare things. A rime bell is glass: woken it shivers (two high notes a few beats a second apart, and the ice
  // creaking), and it tolls (three partials that are no chord, a struck thump and the ice cracking), ringing on.
  bellwake() {
    tone(1568, 0.9, { type: 'sine', gain: 0.03, attack: 0.3, out: space }); tone(1575, 0.9, { type: 'sine', gain: 0.03, attack: 0.3, out: space });
    grains(6, 0.8, { gain: 0.05, freq: 2200, q: 3, type: 'bandpass', out: room });
  },
  toll() {
    hush(0.4, 1.5);
    tone(330, 2.4, { type: 'sine', gain: 0.1, out: space }); tone(911, 1.5, { type: 'sine', gain: 0.045, out: space }); tone(1782, 0.7, { type: 'sine', gain: 0.03, out: space });
    tone(165, 1.2, { gain: 0.12, to: 150, kick: 400, out: room });
    grains(10, 0.5, { first: 0.2, gain: 0.08, freq: 3500, out: room });
  },
  // A fumarole: the ground below it rumbling up, then a jet that roars out and is gone.
  rumble() {
    noise(1.2, { type: 'lowpass', freq: 160, to: 320, q: 0.8, gain: 0.2, attack: 0.7, out: room });
    tone(48, 1.2, { type: 'sine', gain: 0.1, to: 64, attack: 0.8, out: room });
    grains(12, 1.1, { gain: 0.05, freq: 900, type: 'bandpass', out: room });
  },
  jet() {
    noise(0.5, { freq: 2000, to: 700, q: 0.6, gain: 0.2, attack: 0.02 }); noise(0.45, { type: 'lowpass', freq: 500, to: 140, q: 0.7, gain: 0.26, out: room });
    tone(80, 0.35, { gain: 0.24, to: 55, kick: 260, out: room });
    grains(6, 0.4, { first: 0.15, gain: 0.08, freq: 2400 });
  },
  // A glowworm is small, wet and strange: it wakes on three notes that are no tune and a slither, chews as it goes
  // (`near` is 0 a way off and 1 beside the drill), snaps when it bites, and is caught with a run up and a sparkle.
  wormwake() {
    line([587, 831, 1175], 0.07, { gain: 0.07, ring: 0.3 });
    noise(0.3, { freq: 500, to: 1400, q: 4, gain: 0.08, attack: 0.08 });
  },
  gnaw(near = 0.5) {
    const n = Math.min(1, Math.max(0, +near || 0));
    grains(2, 0.07, { gain: 0.08 + 0.14 * n, freq: vary(1300, 0.1), q: 3, type: 'bandpass' });
    if (!crowded()) tone(vary(260, 0.08), 0.08, { type: 'sine', gain: 0.03 + 0.05 * n, to: 190 });
  },
  bite() { noise(0.07, { type: 'highpass', freq: 2500, gain: 0.16, attack: 0.001, out: room }); tone(900, 0.06, { type: 'square', gain: 0.04, to: 350 }); },
  caught() {
    line([5, 6, 8, 10].map(note), 0.065, { gain: 0.12, ring: 0.45 });
    grains(8, 0.45, { gain: 0.04, freq: 6500, delay: 0.2, out: space });
  },
  // A lodestone hums as it wakes (a buzz that opens up, beating against a note just off its octave, and a thin
  // whine), each ore it pulls goes zing and lands with a clack, and when it has done it clangs (two partials that
  // do not agree: metal) and runs up a note for each ore it gathered, as many as six.
  hum() {
    tone(55, 1, { type: 'sawtooth', gain: 0.1, lp: 250, lpTo: 900, attack: 0.35 });
    tone(113, 1, { type: 'sine', gain: 0.07, attack: 0.35 });
    noise(0.9, { freq: 4200, to: 5200, q: 5, gain: 0.025, attack: 0.3 });
  },
  pull() {
    tone(vary(1200, 0.05), 0.09, { type: 'sine', gain: 0.06, to: 2800 }); noise(0.02, { type: 'highpass', freq: 5000, gain: 0.04, attack: 0.001 });
    tone(240, 0.07, { gain: 0.09, to: 120, kick: 600, delay: 0.18, out: room });
  },
  gather(n = 4) {
    const f = vary(523, 0.03), k = Math.min(6, Math.max(0, n | 0));
    tone(f, 0.6, { type: 'sine', gain: 0.1, out: room }); tone(f * 2.76, 0.4, { type: 'sine', gain: 0.05, out: room });
    noise(0.02, { type: 'highpass', freq: 5000, gain: 0.06, attack: 0.001 });
    if (k) line(Array.from({ length: k }, (_, i) => note(10 + i)), 0.045, { gain: 0.1, ring: 0.35, delay: 0.08 });
  },
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
const GAP = { dig: 0.04, crumble: 0.055, grind: 0.095, tick: 0.04, gem: 0.05, slide: 0.05, thud: 0.05, clink: 0.08, hiss: 0.1, puff: 0.08, freeze: 0.06, zap: 0.06, knock: 0.1, banked: 0.08, relic: 0.25, ping: 0.05,
  toll: 0.25, rumble: 0.3, jet: 0.3, gnaw: 0.15, bite: 0.2, hum: 0.5, pull: 0.12, gather: 0.3 };
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
// The notes a drop is struck on (a step of `scale` over `base`), which the music points at the key of the piece it
// is playing (`retune`): the root lifted by octaves to between 620 and 1240 Hz, and the piece's scale. So a drop, the
// grotto's notes and the ice's singing are in the music of the ground they are heard in.
export const PLINK = { base: 880, scale: [0, 2, 4, 7, 9] };
// The note of PLINK's key nearest to `f`.
const inKey = f => {
  const s = 12 * Math.log2(f / PLINK.base), o = Math.floor(s / 12), r = s - 12 * o;
  let best = 12;
  for (const d of PLINK.scale) if (Math.abs(d - r) < Math.abs(best - r)) best = d;
  return PLINK.base * 2 ** (o + best / 12);
};
const loud = near => Number.isFinite(near) ? 0.35 + 0.65 * Math.min(1, Math.max(0, near)) : 1;
const figure = (value, plain, least, most) => Number.isFinite(value) ? Math.min(most, Math.max(least, value)) : plain;
const quirks = {
  // A groan in the ice, and the long falling note a frozen lake sings after it, from a note of the music's key down
  // to another. `pitch` is the ice's (1 the north's).
  creak(near, pitch) {
    if (crowded()) return;
    const a = loud(near), p = figure(pitch, 1, 0.4, 2.5), f = vary(170, 0.12) * p;
    tone(f, 0.6, { type: 'sawtooth', gain: 0.05 * a, to: f * 0.8, lp: 900, lpTo: 480, attack: 0.12, out: room });
    tone(inKey(vary(1900, 0.1) * p), 0.42, { type: 'sine', gain: 0.03 * a, to: inKey(420 * p), delay: 0.16, attack: 0.01, out: space });
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
  // The ground shakes: a rumble, a low note under it falling, and grit coming down. `power` 0.3 to 2. The music
  // steps back a little while it shakes (as deep as anything else asks, and no deeper: `hush`).
  quake(power) {
    const p = figure(power, 1, 0.3, 2), length = 1.2 + 0.4 * p;
    hush(0.75, length);
    if (crowded()) return;
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

// ---------------------------------------------------------------- the voices of the creatures
// What the creatures of the ground say (js/fauna.js asks for them): small, soft and short, and a few of them
// warnings, which the player plays by (a bat's chitter and screech, a spitter's wheeze, a leech's drip, the pal's
// yip). Each goes into the sounds' own gain, as every sound does, under the music; none ducks it. `near` is 0 at the
// edge of hearing and 1 beside the drill, and whatever a voice is asked with it makes its sound. None but a warning
// is made when many layers are sounding already.
const VOICE_GAP = { tick: 0.4, yip: 0.25, coo: 0.15, tug: 0.3, pop: 0.2, flutter: 3, wheeze: 0.6, spit: 0.3, splat: 0.2, purr: 3, chitter: 2, screech: 0.4,
  whoosh: 0.15, croak: 2, squeak: 0.5, caught: 0.5, poof: 0.3, plip: 0.12, slurp: 1.5, skitter: 1, trill: 0.8, buzz: 3, glass: 4, meet: 1.5, befriend: 1 };
const calls = {
  // A beetle tucking in: two dry ticks.
  tick(near) { if (crowded()) return; const a = loud(near); grains(2, 0.08, { first: 0.03 * a, gain: 0.025 * a, freq: 3800 }); },
  // The pal: a yip, high and quick (a warning); a coo, fed; a tug, pulling a leech off; a pop out of the rock.
  yip(near) { const a = loud(near); tone(1180, 0.07, { type: 'triangle', gain: 0.05 * a, to: 1700 }); tone(1500, 0.06, { type: 'triangle', gain: 0.04 * a, to: 2100, delay: 0.09 }); },
  coo(near) { if (crowded()) return; const a = loud(near); tone(inKey(520), 0.16, { type: 'sine', gain: 0.045 * a, to: inKey(700), attack: 0.03 }); },
  tug(near) { const a = loud(near); noise(0.12, { freq: 900, to: 400, q: 2, gain: 0.04 * a }); tone(330, 0.1, { type: 'triangle', gain: 0.04 * a, to: 520, delay: 0.08 }); },
  pop(near) { if (crowded()) return; const a = loud(near); tone(260, 0.06, { type: 'sine', gain: 0.05 * a, to: 520, attack: 0.002 }); },
  // Moths: a breath of wings.
  flutter(near) { if (crowded()) return; const a = loud(near); grains(6, 0.3, { gain: 0.03 * a, freq: 1800, type: 'bandpass', q: 0.8 }); },
  // The spitter: a wheeze rising as it swells (a warning), the spit, and the splat of ice.
  wheeze(near) { const a = loud(near); noise(0.85, { freq: 500, to: 1600, q: 2, gain: 0.06 * a, attack: 0.5 }); },
  spit(near) { const a = loud(near); noise(0.08, { type: 'highpass', freq: 2400, gain: 0.05 * a }); tone(700, 0.06, { type: 'sine', gain: 0.03 * a, to: 300 }); },
  splat(near) { const a = loud(near); grains(4, 0.12, { first: 0.04 * a, gain: 0.03 * a, freq: 4200, out: room }); },
  // A salamander's low purr.
  purr(near) { if (crowded()) return; const a = loud(near); tone(110, 0.5, { type: 'sawtooth', gain: 0.025 * a, to: 100, lp: 300, attack: 0.1 }); },
  // Bats: a chitter in the roost (a warning, low and dry), the screech as they wake, the whoosh of a swoop.
  chitter(near) { const a = loud(near); grains(5, 0.25, { gain: 0.06 * a, freq: 3200, type: 'bandpass', q: 1.5 }); },
  screech(near) { const a = loud(near); tone(2400, 0.22, { type: 'sawtooth', gain: 0.03 * a, to: 1700, lp: 3600 }); tone(2900, 0.16, { type: 'triangle', gain: 0.02 * a, to: 2100, delay: 0.05 }); },
  whoosh(near) { const a = loud(near); noise(0.3, { freq: 600, to: 1800, q: 1, gain: 0.05 * a, attack: 0.08 }); },
  // A frog's croak, on a note of the key, rolled.
  croak(near) { if (crowded()) return; const a = loud(near), f = inKey(240) / 2; tone(f, 0.18, { type: 'square', gain: 0.02 * a, to: f * 0.9, lp: 600 }); tone(f, 0.12, { type: 'square', gain: 0.015 * a, to: f * 0.85, lp: 500, delay: 0.2 }); },
  // The puffling: a squeak, shy; caught, three soft notes rising; and the poof as it goes.
  squeak(near) { const a = loud(near); tone(1600, 0.06, { type: 'sine', gain: 0.035 * a, to: 2300 }); },
  caught() { const f = inKey(660); for (let n = 0; n < 3; n++) tone(f * [1, 1.25, 1.5][n], 0.18, { type: 'sine', gain: 0.05, delay: n * 0.09, out: space }); },
  poof(near) { const a = loud(near); noise(0.2, { type: 'lowpass', freq: 1400, to: 500, gain: 0.04 * a, attack: 0.01 }); },
  // A leech: a drip quickening (a warning), a slurp on the hull.
  plip(near) { const a = loud(near), f = inKey(1300); tone(f, 0.05, { type: 'sine', gain: 0.04 * a, to: f * 1.4 }); },
  slurp(near) { const a = loud(near); tone(200, 0.18, { type: 'sine', gain: 0.04 * a, to: 140, lp: 500 }); noise(0.1, { type: 'lowpass', freq: 600, gain: 0.02 * a, delay: 0.05 }); },
  // A skink darting: a skitter of grains.
  skitter(near) { if (crowded()) return; const a = loud(near); grains(7, 0.22, { gain: 0.03 * a, freq: 3000, type: 'bandpass', q: 1.2 }); },
  // The wren: a trill in the key.
  trill(near) { const a = loud(near), f = inKey(1760); for (let n = 0; n < 4; n++) tone(n % 2 ? f * 1.12 : f, 0.05, { type: 'sine', gain: 0.03 * a, delay: n * 0.055 }); },
  // Bees: a soft buzz. Jellies: a glass chime in the key, now and then.
  buzz(near) { if (crowded()) return; const a = loud(near); tone(190, 0.5, { type: 'sawtooth', gain: 0.018 * a, to: 200, lp: 700, attack: 0.15 }); },
  glass(near) { if (crowded()) return; const a = loud(near); tone(inKey(2200), 0.6, { type: 'sine', gain: 0.025 * a, attack: 0.004, out: space }); },
  // A creature met for the first time: two soft notes. A pal made: the coo and a third note over it.
  meet() { tone(inKey(880), 0.14, { type: 'sine', gain: 0.035, out: space }); tone(inKey(1320), 0.2, { type: 'sine', gain: 0.03, delay: 0.1, out: space }); },
  befriend() { const f = inKey(520); tone(f, 0.16, { type: 'sine', gain: 0.045 }); tone(f * 1.5, 0.24, { type: 'sine', gain: 0.04, delay: 0.14, out: space }); },
};
// (Their least gaps are kept apart from the game's own, under names of their own.)
for (const [name, gap] of Object.entries(VOICE_GAP)) GAP[`v:${name}`] = gap;
export const voices = {};
for (const name of Object.keys(calls)) voices[name] = sound(`v:${name}`, calls[name]);

// ---------------------------------------------------------------- the sound of the place
// A bed of filtered noise and a low drone that change with the ground the drill is in, and now and then a single
// soft bell. Every ground has a piece of music of its own, its score (`scoreOf`, with the music below), and the bed,
// the bell and the two calls a place makes (its name coming up, a ground met for the first time) are drawn from it:
// its key, its air, its bell and its motif.
let bed = null, band = null, conductor = 0, away = 0;
// The score the drill's ground asks for (`wanted`, since `wantedAt`) and the one the music and the bed are playing.
// A border that wanders is crossed many times in a few cells: the music changes only when the drill has been in
// the new ground for SETTLE seconds.
let wanted = null, wantedAt = 0, playing = null, lastGround, lastDeep;
const SETTLE = 0.8;
// `ground` is the ground's row (or a score's name, or a number: a direction, `deep` taking its deep flank); `far` is
// how many cells the drill is from the core, if the game says: only the music listens to it. Asked every frame, it
// does nothing but compare unless the ground has changed.
export function setAmbience(ground, deep, far) {
  if (far >= 0) away = far;
  if (ground !== lastGround || deep !== lastDeep) {
    lastGround = ground; lastDeep = deep;
    const s = scoreOf(ground, deep);
    if (s !== wanted) { wanted = s; wantedAt = ctx ? ctx.currentTime : 0; }
  }
  if (!ctx) return;
  if (!bed) {
    const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), out = ctx.createGain(), drone = ctx.createOscillator(), dg = ctx.createGain();
    src.buffer = noiseBuffer; src.loop = true;
    filter.type = 'lowpass'; filter.Q.value = 0.6;
    out.gain.value = 0;
    drone.type = 'sine'; dg.gain.value = 0.5;
    src.connect(filter); filter.connect(out); drone.connect(dg); dg.connect(out); out.connect(sounds);
    src.start(); drone.start();
    bed = { filter, out, drone };
    const [hz, low] = (playing ?? wanted).air;
    filter.frequency.value = hz; drone.frequency.value = low;
    out.gain.setTargetAtTime(0.06, ctx.currentTime, 1.5);
  }
  settle();
}
// The new ground's score is taken when it has been asked for long enough, or at once if nothing is playing.
function settle() {
  if (!ctx || !wanted || wanted === playing) return;
  if (playing && ctx.currentTime - wantedAt < SETTLE) return;
  playing = wanted;
  retune(playing);
  if (bed) {
    const [hz, low] = playing.air, t = ctx.currentTime;
    bed.filter.frequency.setTargetAtTime(hz, t, 1.2);
    bed.drone.frequency.setTargetAtTime(low, t, 1.2);
  }
  if (band) turn(playing);
}
// The drops are struck in the key of the piece that plays (PLINK).
function retune(s) { PLINK.base = keep(s.root, 620, 1240); PLINK.scale = MODES[s.mode] ?? MODES.major5; }
// What a bell is scaled by in its wave, as the waves with more harmonics sound the louder.
const BELL = { sine: 1, triangle: 1, keys: 0.9, glass: 0.8, hollow: 0.9, reed: 0.7, organ: 0.7, choir: 0.8, brass: 0.6, buzz: 0.5, bass: 0.8, anvil: 0.7, square: 0.5, sawtooth: 0.55 };
const bellOf = s => BELL[s.bell] ?? 1;
// Degrees of a score lifted together by octaves into [lo, hi], so a run keeps its shape.
const phrase = (s, degrees, lo, hi) => { const fs = degrees.map(k => hz(s, k)), up = lift(fs, lo, hi, 0); return fs.map(f => keep(f * up, lo, hi)); };
// A bell of the ground's own scale in its own voice, and the note two above it after a moment.
const chime = sound('chime', (ground, pick) => {
  const s = scoreOf(ground), k = (pick * MODES[s.mode].length) | 0, [a, b] = phrase(s, [k, k + 2], 300, 1300);
  tone(a, 1.6, { type: s.bell, gain: 0.045 * bellOf(s), attack: 0.08, out: space });
  tone(b, 1.2, { type: s.bell, gain: 0.02 * bellOf(s), attack: 0.1, delay: 0.22, out: space });
});
// (The game's own generator picks the note, once a call whether or not it is heard: the game's tests count on it.)
sfx.chime = ground => chime(ground, Math.random());
// A place's name comes up on its plate: the first and the last note of its motif, which its music opens with (with
// no motif, its first note and its fifth). The music steps back for it, as the music may still be the last place's.
sfx.place = sound('place', ground => {
  const s = scoreOf(ground), tune = s.fit.tune.length ? [s.fit.tune[0], s.fit.tune[s.fit.tune.length - 1]] : [0, MODES[s.mode].length > 5 ? 4 : 3];
  hush(0.4, 1.2);
  line(phrase(s, tune, 260, 1400), 0.13, { type: s.bell, gain: 0.085 * bellOf(s), ring: 0.5 });
});
// A ground met for the first time: its root low down, its motif (five notes at the most) in its bell over it, and
// a glint an octave over the last.
sfx.arrive = sound('arrive', ground => {
  const s = scoreOf(ground), tune = phrase(s, s.fit.tune.length ? s.fit.tune.slice(0, 5) : [0, 2, 4], 300, 1400);
  hush(0.3, 2);
  tone(keep(s.root, 100, 250), 1.8, { gain: 0.07, attack: 0.03, out: space });
  line(tune, 0.11, { type: s.bell, gain: 0.08 * bellOf(s), ring: 0.9, out: space });
  tone(keep(tune[tune.length - 1] * 2, 300, 2600), 1.2, { type: 'sine', gain: 0.02, delay: 0.11 * tune.length, attack: 0.05, out: space });
});
// Something seen for the first time: a few notes of its own for each kind of thing.
const SPOTS = { cache: [10, 12], geode: [7, 9, 12], wreck: [6, 3], key: [5, 5], prism: [12, 14, 17], relic: [5, 7, 9, 12], mineral: [8, 11],
  bell: [15, 12, 15], vent: [3, 0, 5], worm: [9, 7, 10, 8], lodestone: [5, 10, 5] };
sfx.spot = sound('spot', what => line((SPOTS[what] ?? SPOTS.cache).map(note), 0.09, { gain: 0.11, ring: 0.32 }));
// A wreck close by ticks: `near` is 0 at the edge of hearing and 1 beside it.
sfx.ping = sound('ping', (near = 0) => tone(620 + 260 * near, 0.08, { type: 'sine', gain: 0.035 + 0.05 * near, attack: 0.002, out: space }));

// ---------------------------------------------------------------- the music
// Every ground plays a piece of its own. A piece is a score: a row of figures that says its tempo and metre, its
// scale and the note it stands on, the chords it goes round, a motif of a bar that is the ground's own tune, the
// instruments that play it (their waveforms, how high they sit, how they rise and die) and the patterns they play,
// one bar long or two. The home ground is a music box over warm pads; the north a waltz of glass over open fifths
// and wind; the south a slow march on a stone drum, a reed sighing a half step; the west a seasick lilt on a scale
// of whole tones, its pads swaying; the east a caravan, a reed over a drum and an oud. The deep flanks have darker
// pieces of their own, each strain is its direction's piece with one thing changed, each pocket has a small piece,
// and a cross plays its host's piece with the donor's own voice in it (the north gives its glass, the south its
// drum, the west its swaying pads, the east its reed) and its structure's change.
//
// A piece goes round its form, a phrase of four bars to a letter: an A phrase plays as written, a B phrase thinner
// (no drum, fewer plucks, the motif a little higher, the lead more), and a rest only the pads; every phrase but a
// rest opens with the motif. Notes come at random within the patterns, so a long stay does not come round the same
// twice. Ground far from the core is sparser and darker, and on the core it is a little brighter.
//
// The band is made once, when the music starts, and kept until it stops: two pads (two oscillators into a gain
// each), a lead, two plucks (each through a lowpass that closes as it dies), a bass, a drum (the second of noise,
// through a bandpass) and two slow oscillators that sway the pads' pitch and the lead's (joined for good, which costs
// a little even where a piece has no sway). Twenty-six nodes. A note is
// a few numbers posted on the audio clock by a timer twice a second, AHEAD of time, on a grid of sixteenths: no node
// is made for it, and nothing is done in a frame. What is posted on a voice is posted in the order of its times
// (each voice keeps `last`, the time of the latest), so nothing posted cuts what was posted before it. A pluck,
// the bass, the lead and the drum strike again only after a dip of a few thousandths of a second to nothing, so
// that a note still ringing is never cut with a click; the two plucks take turns, so one rings over the next. The
// pads take turns too: the new chord rises on the pad that is silent as the other falls. A waveform is changed only
// on a voice that is silent (`quiet`), which is why a change of ground lets the old piece's posted notes play out,
// lets its voices go, and holds the sounding pad until the new piece begins on the other.
// It is soft, under the sounds, and steps back for a moment when anything that pays rings (`hush`), so that rewards,
// which ring in the major five-note scale, do not rub against a ground in another.
const MODES = {
  major5: [0, 2, 4, 7, 9], open5: [0, 2, 5, 7, 9], minor5: [0, 3, 5, 7, 10], hira: [0, 2, 3, 7, 8], hexa: [0, 2, 4, 5, 7, 9], whole: [0, 2, 4, 6, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], lydaug: [0, 2, 4, 6, 8, 9, 11],
  mixo: [0, 2, 4, 5, 7, 9, 10], harmonic: [0, 2, 3, 5, 7, 8, 11], hijaz: [0, 1, 4, 5, 7, 8, 10], double: [0, 1, 4, 5, 7, 8, 11],
};
// The waves of the instruments, by the strength of each harmonic from the first up (made once, in `unlock`).
// `keys`, the music box, is made there too; the browser's own four are used as they are.
const SHAPES = {
  glass: [1, 0.05, 0.35, 0, 0.2, 0, 0.12, 0, 0.06], reed: [1, 0.08, 0.55, 0.05, 0.3, 0.03, 0.18, 0, 0.1],
  organ: [1, 0.7, 0.25, 0.45, 0, 0.2, 0, 0.18], hollow: [1, 0, 0, 0.45, 0, 0, 0, 0, 0.12], bass: [1, 0.6, 0.4, 0.2, 0.12, 0.06],
  buzz: [0.5, 0.8, 0.7, 0.6, 0.5, 0.42, 0.34, 0.28, 0.22, 0.18, 0.14], brass: [1, 0.85, 0.65, 0.48, 0.34, 0.22, 0.14, 0.08],
  choir: [1, 0.15, 0.5, 0.08, 0.3, 0.04, 0.12], anvil: [1, 0, 0.5, 0, 0, 0.45, 0, 0, 0.3, 0, 0.22],
};
const BUILT = ['sine', 'square', 'sawtooth', 'triangle'], waves = {};
// The drum's hits, all soft and low, so that none is taken for the ground cracking: [band Hz, Q, peak, decay,
// attack]. s a shaker, h a breath of wind, w a knock of wood, d a low skin drum.
const DRUMS = { s: [5000, 1.2, 0.05, 0.03, 0.003], h: [2200, 0.6, 0.06, 0.16, 0.05], w: [560, 3, 0.2, 0.05, 0.003], d: [210, 2.2, 0.45, 0.1, 0.004] };
// Where each voice may sound, in Hz: a phrase is lifted by octaves as a whole into its voice's room (the bass up
// where a phone's speaker can play it).
const ROOM = { pad: [110, 880], lead: [196, 1568], pluck: [220, 1760], bass: [90, 330] };
// What a score is, with what each figure is when a score does not say. A step is a sixteenth.
//   bpm, bar        beats a minute; steps to a bar (12 is three beats, 16 four, 20 five)
//   swing, tempo    how much later the off steps fall (0 to 0.3); what the bpm is multiplied by (a strain's twist)
//   root, mode      the note the scale stands on, in Hz, and the scale (MODES)
//   chords          the degree each bar's chord stands on, bar by bar, round and round
//   motif           a bar of degrees of the scale from its root (0-9, a-f; '.' is nothing): the ground's tune
//   form, lift      the round of four-bar phrases (A, B, r), and how many degrees higher a B phrase's motif is
//   air             the bed's [filter Hz, drone Hz]; bright, the music's lowpass in Hz; bell, the wave of its bells
//   level           the piece's loudness against the others; sign, the voice it gives a cross it is the donor of
//   echo            [steps, share]: a pluck or lead note comes back that many steps later, that much softer
//   burst           [count, by]: a pluck note sets off count - 1 more on the steps after, `by` degrees apart
//   glide           what a pluck's pitch slides up to as it dies (1, none)
const TOP = { bpm: 66, bar: 16, swing: 0, tempo: 1, root: 220, mode: 'major5', chords: [0], motif: '', form: 'AABr', lift: 2,
  air: [420, 55], bright: 1100, bell: 'keys', level: 1, sign: null, echo: null, burst: null, glide: 1 };
// And each voice. Patterns are in degrees over the bar's chord; `oct` is how many octaves up its room a phrase sits;
// `vib` is [rate Hz, cents]. A pad holds two notes of the chord (`tones`), the second `spread` Hz off, and rises
// and falls in `rise` and `fall` (time constants, seconds). The lead wanders among the degrees of `range`, a note at
// a time every `grid` steps with the chance `every`, each `len` seconds long. A pluck strikes its pattern with the
// chance `chance`, its lowpass closing from lp[0] to lp[1] as it dies in `decay`. The drum's pattern is of DRUMS.
const PART = {
  pad: { wave: 'triangle', tones: [0, 2], spread: 0.4, gain: 0.016, rise: 1.5, fall: 0.35, oct: 0, vib: [0.1, 0] },
  lead: { wave: 'sine', grid: 4, every: 0.25, range: [5, 10], len: 0.6, rise: 0.05, fall: 0.4, gain: 0.011, oct: 0, vib: [0.1, 0] },
  pluck: { wave: 'keys', pattern: '0...', chance: 0.8, lp: [3000, 1500], q: 0.7, decay: 0.4, gain: 0.011, oct: 1 },
  bass: { wave: 'bass', pattern: '0...............', decay: 0.8, gain: 0.02, oct: 0 },
  perc: { pattern: 'w...', gain: 1 },
};
const VOICES = Object.keys(PART);
// The scores made by hand, by the name of the ground. A strain is `of` its direction's score: its `twist` is the
// change that is its own and goes into crosses of its structure, and the rest of it is changed for it alone.
const SCORES = {
  // The home ground: a music box over warm pads, steady and kind.
  crust: { bpm: 66, root: 220, mode: 'major5', chords: [0, 3, 4, 3], motif: '4.3.2...0.......', bright: 1100, air: [420, 55], bell: 'keys', sign: 'pluck',
    pad: { wave: 'triangle', tones: [0, 2], spread: 0.35, gain: 0.017, rise: 1.4, fall: 0.3, oct: 1 },
    pluck: { wave: 'keys', pattern: '0...2...1...3...', chance: 0.85, lp: [3000, 1600], q: 0.5, decay: 0.45, gain: 0.012, oct: 1 },
    bass: { wave: 'bass', pattern: '0.......3.......', decay: 1.2, gain: 0.018 } },
  // The north: a crystal waltz with no third in it, glass high over open fifths, a breath of wind, no bass.
  frost: { bpm: 52, bar: 12, root: 330, mode: 'open5', chords: [0, 0, 3, 1], motif: '9.7.4.......', bright: 2400, air: [1500, 82], bell: 'glass', sign: 'pluck', form: 'AABAr',
    pad: { wave: 'sine', tones: [0, 3], spread: 0.9, gain: 0.018, rise: 2.2, fall: 0.4, oct: 1 },
    pluck: { wave: 'glass', pattern: '7.....9.....', chance: 0.6, lp: [6000, 3000], q: 0.3, decay: 0.9, gain: 0.012, oct: 2 },
    perc: { pattern: 'h...........', gain: 1 } },
  // The south: a slow march in the dark. Phrygian, a stone drum, a reed that sighs down a half step.
  ember: { bpm: 60, root: 147, mode: 'phrygian', chords: [0, 1, 0, 6], motif: '8.7.............', bright: 800, air: [240, 41], bell: 'sine', sign: 'perc', level: 1.1,
    pad: { wave: 'sawtooth', tones: [0, 4], spread: 0.25, gain: 0.012, rise: 0.9, fall: 0.3, oct: 1 },
    lead: { wave: 'reed', grid: 8, every: 0.4, range: [7, 12], len: 1.2, rise: 0.15, fall: 0.6, gain: 0.014, vib: [4.5, 12] },
    bass: { wave: 'bass', pattern: '0.......0.0.....', decay: 0.35, gain: 0.024 },
    perc: { pattern: 'd.......d.w.....', gain: 1 } },
  // The west: a seasick lilt. Whole tones, swung, pads that sway out of tune and back, hollow drips.
  mire: { bpm: 76, swing: 0.22, root: 196, mode: 'whole', chords: [0, 1, 0, 5], motif: '5.4.3...0.......', bright: 1200, air: [700, 62], bell: 'hollow', sign: 'pad',
    pad: { wave: 'triangle', tones: [0, 2], spread: 0.5, gain: 0.017, rise: 1.8, fall: 0.35, oct: 1, vib: [0.35, 22] },
    pluck: { wave: 'hollow', pattern: '0..3.....5..2...', chance: 0.7, lp: [2600, 900], q: 1, decay: 0.3, gain: 0.015, oct: 1 },
    bass: { wave: 'bass', pattern: '0...........4...', decay: 0.8, gain: 0.02 },
    perc: { pattern: '......w.......w.', gain: 0.6 } },
  // The east: a caravan. Double harmonic, a reed with vibrato over a drum and an oud, a fifth held under.
  lode: { bpm: 92, root: 220, mode: 'double', chords: [0, 0, 1, 0], motif: '4.5.4.2.1...0...', bright: 1500, air: [520, 73], bell: 'keys', sign: 'lead', level: 1.1,
    pad: { wave: 'triangle', tones: [0, 4], spread: 0.2, gain: 0.011, rise: 2.5, fall: 0.35, oct: 0 },
    lead: { wave: 'reed', grid: 2, every: 0.35, range: [4, 11], len: 0.35, rise: 0.02, fall: 0.25, gain: 0.013, oct: 1, vib: [5.5, 18] },
    pluck: { wave: 'sawtooth', pattern: '0.0.4...0.1.0...', chance: 0.9, lp: [2200, 400], q: 2, decay: 0.12, gain: 0.012, oct: 0 },
    perc: { pattern: 'd..w..w.d.w.w...', gain: 1 } },
  // Deep north: frozen stillness in five. Lydian glass pads, a low pure drone, a rare high bell.
  rime: { bpm: 44, bar: 20, root: 262, mode: 'lydian', chords: [0, 1], motif: '3...4...6...........', bright: 1900, air: [1100, 65], bell: 'glass', sign: 'pluck', form: 'AB',
    pad: { wave: 'glass', tones: [0, 4], spread: 0.6, gain: 0.016, rise: 3, fall: 0.4, oct: 1 },
    pluck: { wave: 'keys', pattern: '....b...............', chance: 0.5, lp: [5000, 2500], q: 0.3, decay: 1.4, gain: 0.011, oct: 2 },
    bass: { wave: 'organ', pattern: '0...................', decay: 3, gain: 0.018 } },
  // Deep south: a forge's heartbeat. Eighths in the bass, a drum on every beat, dark square pads.
  magma: { bpm: 80, root: 139, mode: 'hijaz', chords: [0, 0, 1, 6], motif: '7.8.9.8.7.......', bright: 700, air: [180, 36], bell: 'sine', sign: 'perc',
    pad: { wave: 'square', tones: [0, 4], spread: 0.3, gain: 0.01, rise: 1.2, fall: 0.3, oct: 1 },
    lead: { wave: 'sawtooth', grid: 8, every: 0.15, range: [7, 11], len: 1.5, rise: 0.3, fall: 0.8, gain: 0.01, oct: 1, vib: [3, 10] },
    bass: { wave: 'bass', pattern: '0.0.0.0.1.0.0.0.', decay: 0.15, gain: 0.024 },
    perc: { pattern: 'd...d...d...d.d.', gain: 1 } },
  // Deep west: a strange garden waltz. Choir pads swaying, a hollow arpeggio climbing, a soft shaker.
  bloom: { bpm: 84, bar: 12, swing: 0.15, root: 233, mode: 'lydaug', chords: [0, 1, 4, 1], motif: '7.9.b.9.7...', bright: 1400, air: [600, 58], bell: 'hollow', sign: 'pad',
    pad: { wave: 'choir', tones: [0, 2], spread: 0.7, gain: 0.016, rise: 1, fall: 0.3, oct: 1, vib: [0.5, 18] },
    lead: { wave: 'sine', grid: 4, every: 0.3, range: [7, 13], len: 0.6, rise: 0.05, fall: 0.5, gain: 0.011, oct: 1, vib: [0.5, 15] },
    pluck: { wave: 'hollow', pattern: '0.2.4.6.4.2.', chance: 0.9, lp: [3000, 1200], q: 0.8, decay: 0.25, gain: 0.012, oct: 1 },
    bass: { wave: 'bass', pattern: '0...........', decay: 1.2, gain: 0.016 },
    perc: { pattern: 's...s...s...', gain: 0.7 } },
  // Deep east: a gilded tomb's procession. Harmonic minor, organ pads, a slow brass fanfare over a pedal.
  gilt: { bpm: 58, root: 175, mode: 'harmonic', chords: [0, 3, 4, 0], motif: '4...6...7.....6.', bright: 1300, air: [480, 44], bell: 'keys', sign: 'lead',
    pad: { wave: 'organ', tones: [0, 2], spread: 0.15, gain: 0.013, rise: 0.6, fall: 0.25, oct: 1 },
    lead: { wave: 'brass', grid: 4, every: 0.2, range: [4, 11], len: 0.9, rise: 0.06, fall: 0.4, gain: 0.011, oct: 1, vib: [5, 8] },
    bass: { wave: 'organ', pattern: '0.......0.......', decay: 1.5, gain: 0.02 },
    perc: { pattern: 'd.......w.......', gain: 0.8 } },

  // The strains. Firn: a frozen river, a run of glass up the scale every bar, slower, no wind. Serac: shattered,
  // every twinkle falls in shards down the scale. Scoria: bubbles, rising pops of a pure note. Forge: an anvil rings
  // on the second and fourth beats. Tangle: great caves, slower, and every note comes back off the walls.
  // Sporefall: one drip sets off two more. Redrock: level beds, even eighths in the bass. Loess: the quick road,
  // faster, a light shaker, the oud quiet.
  firn: { of: 'frost', twist: { pluck: { pattern: '0.1.2.3.4...' } }, bpm: 46, perc: null, chords: [0, 3] },
  serac: { of: 'frost', twist: { burst: [3, -1] }, bpm: 58, pluck: { decay: 0.35, chance: 0.8 } },
  scoria: { of: 'ember', twist: { glide: 1.5, pluck: { wave: 'sine', pattern: '..5...7....4..9.', chance: 0.6, lp: [2000, 1500], q: 0.5, decay: 0.2, gain: 0.012, oct: 1 } },
    perc: { pattern: 'd...............' } },
  forge: { of: 'ember', twist: { pluck: { wave: 'anvil', pattern: '....7.......7...', chance: 1, lp: [5000, 2500], q: 0.5, decay: 0.5, gain: 0.009, oct: 2 } },
    bpm: 70, bass: { pattern: '0...0...0.0.0...' } },
  tangle: { of: 'mire', twist: { tempo: 0.85, echo: [3, 0.45] }, bright: 1500, pad: { rise: 2.6 } },
  sporefall: { of: 'mire', twist: { burst: [3, 1] }, perc: { pattern: '....s.......s...' }, pluck: { chance: 0.5 } },
  redrock: { of: 'lode', twist: { bass: { wave: 'bass', pattern: '0.0.0.0.0.0.0.0.', decay: 0.12, gain: 0.02, oct: 0 } }, perc: { pattern: 'd...w...d...w...' } },
  loess: { of: 'lode', twist: { tempo: 1.2, perc: { pattern: 's.s.s.s.s.s.s.s.', gain: 0.6 } }, pluck: null, lead: { every: 0.2 }, bright: 1900 },

  // The pockets. Where a pocket's own rule rings rewards (the drift's chain, the grotto's caps), its key holds
  // the major five-note scale on A that they ring in.
  // The amber hive: the comb, six to a bar like its cells, warm wax organ, a buzz flitting on the sixteenths.
  hive: { bpm: 104, bar: 12, root: 262, mode: 'hexa', chords: [0, 3, 4, 0], motif: '4.5.4.5.4...', bright: 1600, air: [900, 87], bell: 'keys', level: 1.15,
    pad: { wave: 'organ', tones: [0, 4], spread: 0.2, gain: 0.012, rise: 0.8, fall: 0.25, oct: 1 },
    lead: { wave: 'buzz', grid: 1, every: 0.55, range: [5, 9], len: 0.1, rise: 0.01, fall: 0.06, gain: 0.008, oct: 1, vib: [26, 30] },
    pluck: { wave: 'hollow', pattern: '0.2.4.0.2.4.', chance: 0.9, lp: [2800, 1000], q: 0.7, decay: 0.15, gain: 0.011, oct: 1 } },
  // The pumice drift: a night sky. Almost nothing: high stars come and go, and leave room for the chain's notes.
  drift: { bpm: 40, root: 440, mode: 'major5', chords: [0, 3], motif: '7.......9.......', bright: 2600, air: [1800, 110], bell: 'keys', form: 'AB',
    pad: { wave: 'sine', tones: [0, 5], spread: 1.2, gain: 0.012, rise: 3, fall: 0.6, oct: 1 },
    pluck: { wave: 'keys', pattern: '0.2.4.7.9.4.2.7.', chance: 0.22, lp: [6000, 4000], q: 0.3, decay: 1.2, gain: 0.01, oct: 2 } },
  // The ash flats: muffled and grey, a soft breath on every beat as the drill ploughs, nothing bright; its motif
  // is the bass's.
  ash: { bpm: 66, root: 165, mode: 'minor5', chords: [0, 0, 3, 2], motif: '2...0...........', bright: 600, air: [300, 41], bell: 'sine', level: 0.85,
    pad: { wave: 'sine', tones: [0, 2], spread: 0.15, gain: 0.018, rise: 2, fall: 0.4, oct: 1 },
    bass: { wave: 'bass', pattern: '0.......3.......', decay: 0.9, gain: 0.02, oct: 1 },
    perc: { pattern: 'h...h...h...h...', gain: 0.9 } },
  // The lantern grotto: a lullaby in three on a music box, a slow sway, a drip.
  grotto: { bpm: 56, bar: 12, root: 220, mode: 'mixo', chords: [0, 6, 3, 0], motif: '9.8.7...4...', bright: 1400, air: [650, 49], bell: 'keys',
    pad: { wave: 'triangle', tones: [0, 2], spread: 0.4, gain: 0.015, rise: 2, fall: 0.4, oct: 1, vib: [0.25, 14] },
    lead: { wave: 'keys', grid: 4, every: 0.3, range: [7, 12], len: 0.5, rise: 0.01, fall: 0.9, gain: 0.012, oct: 1 },
    bass: { wave: 'bass', pattern: '0...........', decay: 2, gain: 0.016 },
    perc: { pattern: '.......w....', gain: 0.5 } },
  // The tinderwork: a fuse burning. A clock's knock counting under a smouldering ostinato in threes against four.
  tinder: { bpm: 96, root: 147, mode: 'phrygian', chords: [0, 1], motif: '7.8.7.......', bright: 900, air: [350, 49], bell: 'sine', level: 1.15,
    pad: { wave: 'sawtooth', tones: [0, 4], spread: 0.3, gain: 0.01, rise: 0.8, fall: 0.25, oct: 1 },
    pluck: { wave: 'square', pattern: '0..0..0.0..0..1.', chance: 0.9, lp: [1600, 300], q: 3, decay: 0.08, gain: 0.011, oct: 1 },
    bass: { wave: 'bass', pattern: '0...............', decay: 0.4, gain: 0.022 },
    perc: { pattern: 'w...w...w...w...', gain: 0.7 } },
  // Glaze: panes. Every other bar a pane shatters, a cascade of glass down the scale, then stillness.
  glaze: { bpm: 66, root: 392, mode: 'hira', chords: [0, 3], motif: '7.4.2.0.........', bright: 2600, air: [1700, 98], bell: 'glass', level: 1.1,
    pad: { wave: 'sine', tones: [0, 3], spread: 0.8, gain: 0.013, rise: 2.5, fall: 0.4, oct: 1 },
    pluck: { wave: 'glass', pattern: 'a987654.........'.padEnd(32, '.'), chance: 0.9, lp: [7000, 4000], q: 0.3, decay: 0.5, gain: 0.01, oct: 1 } },
  // The shale stack: beds of shale, notes in level planks of four, step by step.
  shale: { bpm: 84, root: 185, mode: 'dorian', chords: [0, 3, 0, 4], motif: '0.2.4.7.........', bright: 1200, air: [500, 46], bell: 'hollow', level: 1.15,
    pad: { wave: 'triangle', tones: [0, 4], spread: 0.2, gain: 0.011, rise: 2, fall: 0.4, oct: 1 },
    pluck: { wave: 'hollow', pattern: '0.0.0.0.2.2.2.2.', chance: 1, lp: [2400, 900], q: 0.8, decay: 0.12, gain: 0.011, oct: 1 },
    bass: { wave: 'bass', pattern: '0.......0.......', decay: 0.5, gain: 0.02 },
    perc: { pattern: 'w...............', gain: 0.7 } },
};
// A direction's score by its number, and its deep flank's; and the strain whose twist each structure of a cross
// takes (HOLLOW, CRAZED, FROTHY, BANDED). The numbers are the world's, which never move.
const KIN = ['crust', 'frost', 'ember', 'mire', 'lode'], DEEP = ['crust', 'rime', 'magma', 'bloom', 'gilt'];
const STRAIN_TWIST = [null, 'tangle', 'serac', 'scoria', 'redrock'];
export const scoreNames = () => Object.keys(SCORES);

// A score made whole: every figure there, every voice it has filled out, and what is worked out once beforehand
// (`fit`: how far each phrase is lifted, the motif's notes). Frozen, so nothing that plays it can change it.
const merge = (base, over) => {
  const s = { ...base };
  for (const [key, value] of Object.entries(over)) s[key] = VOICES.includes(key) && value && base[key] ? { ...base[key], ...value } : value;
  return s;
};
const freeze = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) freeze(v); } return o; };
function finish(s, name, from) {
  const o = { name, from };
  for (const key of Object.keys(TOP)) o[key] = s[key] === undefined ? TOP[key] : s[key];
  for (const key of VOICES) o[key] = s[key] ? { ...PART[key], ...s[key] } : null;
  if (!MODES[o.mode]) o.mode = 'major5';
  if (!o.chords?.length) o.chords = [0];
  if (!/^A[ABr]*$/.test(o.form)) o.form = 'A';
  o.fit = fits(o);
  return freeze(o);
}
const named = new Map(), rows = new WeakMap(), crosses = new Map();
function resolve(name) {
  if (named.has(name)) return named.get(name);
  const raw = SCORES[name];
  let s = null;
  if (raw?.of && SCORES[raw.of]) {
    const { of, twist, ...own } = raw;
    s = finish(merge(merge(resolve(of), twist ?? {}), own), name, [of]);
  } else if (raw) s = finish(raw, name, null);
  named.set(name, s);
  return s;
}
// A cross: the host's piece, its structure's twist, and the donor's own voice last, so that it is always there.
// The donor's voice is written in degrees, so it plays in the host's key and scale.
function crossScore(row) {
  const { host, donor, structure } = row.cross, a = resolve(KIN[host]), b = resolve(KIN[donor]), twist = STRAIN_TWIST[structure] ?? null;
  if (!a || !b) return null;
  const key = `${host} ${donor} ${structure} ${row.name}`;
  if (!crosses.has(key)) {
    const sign = b.sign;
    crosses.set(key, finish(merge(merge(a, twist ? SCORES[twist].twist : {}), sign ? { [sign]: b[sign] } : {}), row.name, [a.name, b.name, twist]));
  }
  return crosses.get(key);
}
// The score of a ground: its row (by its name, then as a cross, then its direction's), a score's name, or a number
// (a direction; with `deep`, its deep flank). Whatever it is given it answers with a score, the home ground's if
// nothing else.
export function scoreOf(ground, deep = false) {
  let s = null;
  if (ground && typeof ground === 'object') {
    s = rows.get(ground);
    if (!s) {
      s = resolve(ground.name) ?? (ground.cross ? crossScore(ground) : null) ?? resolve(KIN[ground.kin] ?? 'crust') ?? resolve('crust');
      rows.set(ground, s);
    }
    return s;
  }
  if (typeof ground === 'number') return resolve((deep ? DEEP : KIN)[ground] ?? 'crust') ?? resolve('crust');
  return resolve(String(ground)) ?? resolve('crust');
}

// ---- pitches
// The k-th degree of a score's scale from its root (k may run past an octave, or below).
const hz = (s, k) => { const m = MODES[s.mode], n = m.length; return s.root * 2 ** ((m[((k % n) + n) % n] + 12 * Math.floor(k / n)) / 12); };
const hex = c => { const d = c === undefined ? NaN : parseInt(c, 16); return d >= 0 ? d : -1; };
// A note moved by octaves into [lo, hi] (a last resort: phrases are lifted whole, below).
const keep = (f, lo, hi) => { if (!(f > 0 && Number.isFinite(f))) return lo; while (f > hi) f /= 2; while (f < lo) f *= 2; return f; };
// What a phrase is multiplied by to lie in [lo, hi], `oct` octaves up from the bottom of it where there is room: a
// power of two, so the phrase keeps its shape.
function lift(fs, lo, hi, oct) {
  if (!fs.length) return 1;
  const low = Math.min(...fs), high = Math.max(...fs), floor = Math.ceil(Math.log2(lo / low) - 1e-9);
  return 2 ** Math.max(floor, Math.min(floor + (oct | 0), Math.floor(Math.log2(hi / high) + 1e-9)));
}
const digits = p => [...p].map(hex).filter(d => d >= 0);
// The room a voice of a score sounds in (a pluck that glides keeps room to glide up into), and what degree `k`
// sounds at on it, its phrase lifted by `up`.
const roomOf = (s, voice) => voice === 'pluck' ? [ROOM.pluck[0], ROOM.pluck[1] / Math.max(1, s.glide)] : ROOM[voice];
const pitch = (s, voice, k, up) => keep(up * hz(s, k), ...roomOf(s, voice));
function fits(s) {
  const fit = { pad: {}, pluck: {}, bass: {}, lead: 1, motif: 1, carrier: s.lead ? 'lead' : s.pluck ? 'pluck' : s.bass ? 'bass' : null, tune: digits(s.motif), gaps: [] };
  for (const c of new Set(s.chords)) {
    if (s.pad) fit.pad[c] = lift(s.pad.tones.map(t => hz(s, c + t)), ...roomOf(s, 'pad'), s.pad.oct);
    for (const voice of ['pluck', 'bass']) if (s[voice]) fit[voice][c] = lift(digits(s[voice].pattern).map(d => hz(s, c + d)), ...roomOf(s, voice), s[voice].oct);
  }
  if (s.lead) fit.lead = lift([hz(s, s.lead.range[0]), hz(s, s.lead.range[1])], ...roomOf(s, 'lead'), s.lead.oct);
  if (fit.carrier && fit.tune.length) fit.motif = lift([...fit.tune, ...fit.tune.map(k => k + s.lift)].map(k => hz(s, k)), ...roomOf(s, fit.carrier), s[fit.carrier].oct);
  // How many steps from each note of the motif to its next (a motif's notes run into each other, never over).
  for (let i = 0, last = -1; i <= s.bar; i++) if (i === s.bar || hex(s.motif[i]) >= 0) { if (last >= 0) fit.gaps[last] = i < s.bar ? i - last : 0; last = i; }
  return fit;
}

// ---- the band
const EVERY = 500, AHEAD = 1.2;         // the timer's period in milliseconds, and how far ahead it posts, in seconds
const LET_GO = 0.2, DIP = 0.006;        // how quickly a voice is let go at a change of ground; the dip before a strike
const MUSIC = 0.8;                      // the music's level against the sounds'
const LULL = 0.55;                      // what the music steps back to while anything that pays rings
const STEPS = [-2, -1, -1, 1, 1, 2], NO_VIB = [0.1, 0];
let spoke = false;
const stepLen = (s, n) => 15 / (s.bpm * s.tempo) * (n % 2 ? 1 - s.swing : 1 + s.swing);
const pat = (p, n, i, bar) => p[p.length % bar ? i % p.length : n % p.length];
// The music steps back to `to` for `hold` seconds (the deepest of any asked for meanwhile), and comes back when the
// conductor next looks.
function hush(to, hold) {
  if (!band) return;
  const t = ctx.currentTime;
  if (t >= band.downUntil) band.down = 1;
  if (to < band.down) { band.duck.gain.setTargetAtTime(to, t, 0.05); band.down = to; }
  band.downUntil = Math.max(band.downUntil, t + hold);
}
// Whatever pays rings over the music stepped back a little.
for (const name of ['tick', 'gem', 'crack', 'banked', 'spot', 'mend', 'freeze']) {
  const play = sfx[name];
  sfx[name] = (...args) => { if (ctx && !muted && !aside) hush(LULL, 0.6); play(...args); };
}
// The music is playing exactly when there is a context, its switch is on and the game is not muted. A band made
// anew (the switch, the mute) takes up the score being played, the home ground's if there is none yet.
function tune() {
  const want = !!ctx && music && !muted;
  if (want && !band) {
    const t = ctx.currentTime, soft = ctx.createBiquadFilter(), duck = ctx.createGain(), out = ctx.createGain(), sources = [];
    soft.type = 'lowpass'; soft.Q.value = 0.5; soft.frequency.value = 1000;
    out.gain.value = 0; out.gain.setTargetAtTime(MUSIC, t, 1.2);
    soft.connect(duck); duck.connect(out); out.connect(master);
    const osc = () => { const o = ctx.createOscillator(); o.type = 'triangle'; sources.push(o); return o; };
    const gain = to => { const g = ctx.createGain(); g.gain.value = 0; g.connect(to); return g; };
    const pads = [0, 1].map(() => { const g = gain(soft), o = [osc(), osc()]; o[0].connect(g); o[1].connect(g); return { osc: o, gain: g, wave: 'triangle', last: 0, quiet: 0 }; });
    const mono = () => { const g = gain(soft), o = osc(); o.connect(g); return { osc: o, gain: g, wave: 'triangle', last: 0, flast: 0, quiet: 0 }; };
    const lead = mono();
    const plucks = [0, 1].map(() => {
      const o = osc(), lp = ctx.createBiquadFilter(), g = gain(soft);
      lp.type = 'lowpass'; lp.frequency.value = 2000; o.connect(lp); lp.connect(g);
      return { osc: o, lp, gain: g, wave: 'triangle', last: 0, flast: 0, quiet: 0 };
    });
    const bass = mono();
    const noise = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), hits = gain(duck);
    noise.buffer = noiseBuffer; noise.loop = true; bp.type = 'bandpass'; bp.frequency.value = 600; noise.connect(bp); bp.connect(hits); sources.push(noise);
    const perc = { gain: hits, bp, drum: '', last: 0, quiet: 0 };
    // (An old browser whose oscillators have no detune does without the sway.)
    const sway = to => {
      const o = ctx.createOscillator(), depth = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 0.1; depth.gain.value = 0; o.connect(depth); sources.push(o);
      for (const one of to) try { depth.connect(one.detune); } catch { /* no sway */ }
      return { osc: o, depth };
    };
    const swayPads = sway(pads.flatMap(p => p.osc)), swayLead = sway([lead.osc]);
    for (const o of sources) o.start(t);
    band = { soft, duck, out, sources, pads, lead, plucks, bass, perc, swayPads, swayLead, voices: [lead, ...plucks, bass, perc],
      score: null, turns: 0, next: t + 0.05, n: 0, begin: 0, dressed: false, on: -1, chord: null, pk: 0, leadK: 0, bright: 0, thin: 0, mix: 1, down: 1, downUntil: 0,
      queue: Array.from({ length: 16 }, () => ({ n: -1, f: 0, vel: 0, lead: false })) };
    conductor = setInterval(conduct, EVERY);
    conductor.unref?.();                // (in Node, where the tests run, a timer would keep a finished test from ending)
    turn(playing ?? (playing = wanted ?? scoreOf(0)));
    conduct();
  } else if (!want && band) {
    clearInterval(conductor);
    const old = band;
    band = null;
    if (!ctx) return;
    const t = ctx.currentTime;
    old.out.gain.setTargetAtTime(0, t, 0.25);
    for (const o of old.sources) o.stop(t + 2);
    old.sources[0].onended = () => old.out.disconnect();
  }
}
// The music turns to another score. What is posted plays out, which is the end of its phrase; then every voice but
// the sounding pad is let go, and the new piece begins once they are silent and can be dressed in its waves.
function turn(s) {
  const t = ctx.currentTime, at = Math.max(band.next, t + 0.05);
  if (band.dressed) {
    let begin = t;
    for (const v of band.voices) {
      const go = Math.max(at, v.last);
      v.gain.gain.setTargetAtTime(0, go, LET_GO);
      v.last = go; v.quiet = Math.min(v.quiet, go + 5 * LET_GO);
      begin = Math.max(begin, v.quiet);
    }
    for (const p of band.pads) if (p !== band.pads[band.on]) begin = Math.max(begin, p.quiet);
    band.begin = begin;
  }
  band.score = s; band.n = 0; band.next = at; band.dressed = false; band.chord = null; band.turns++;
  for (const q of band.queue) q.n = -1;
}
// A voice is dressed in a wave only while it is silent.
const wear = (v, wave) => { if (v.wave !== wave) { for (const o of Array.isArray(v.osc) ? v.osc : [v.osc]) voice(o, wave); v.wave = wave; } };
function dress(s, t) {
  if (s.lead) wear(band.lead, s.lead.wave);
  if (s.pluck) for (const p of band.plucks) { wear(p, s.pluck.wave); p.lp.Q.setValueAtTime(s.pluck.q, t); }
  if (s.bass) wear(band.bass, s.bass.wave);
  band.perc.drum = '';
  if (!s.pad && band.on >= 0) {
    const p = band.pads[band.on], go = Math.max(t + 0.05, p.last);
    p.gain.gain.setTargetAtTime(0, go, 0.6); p.last = go; p.quiet = go + 3; band.on = -1;
  }
  const pv = s.pad?.vib ?? NO_VIB, lv = s.lead?.vib ?? NO_VIB;
  for (const [sway, [rate, cents]] of [[band.swayPads, pv], [band.swayLead, lv]]) {
    sway.osc.frequency.setTargetAtTime(Math.max(0.05, rate), t + 0.05, 0.3);
    sway.depth.gain.setTargetAtTime(Math.max(0, cents), t + 0.05, 0.4);
  }
  if (s.lead) band.leadK = Math.round((s.lead.range[0] + s.lead.range[1]) / 2);
  band.bright = 0; band.dressed = true; band.next = Math.max(band.next, t + 0.05);
}
// (The pad that sounded through a turn is dressed when it has fallen silent.)
const redress = (s, t) => { if (s.pad) for (const p of band.pads) if (t >= p.quiet) wear(p, s.pad.wave); };
// What the timer does: the next steps that fall within AHEAD seconds are posted. A conductor that goes wrong says
// so once and is let be: the timer goes on.
function conduct() {
  if (!band) return;
  try { follow(); } catch (error) { if (!spoke) { spoke = true; console.warn('music:', error); } }
}
function follow() {
  const t = ctx.currentTime, hidden = typeof document !== 'undefined' && !!document.hidden;
  settle();
  if (band.down < 1 && t >= band.downUntil) { band.duck.gain.setTargetAtTime(1, t, 0.5); band.down = 1; }
  if (!band.score) turn(playing ?? (playing = wanted ?? scoreOf(0)));
  if (hidden) { band.next = Math.max(band.next, t + 0.05); return; }
  const s = band.score;
  if (!band.dressed) { if (t < band.begin) return; dress(s, t); }
  redress(s, t);
  // Ground far from the core is sparser and darker; on the core it is a little brighter.
  const thin = Math.min(1, Math.max(0, (away - 130) / 1200)), bright = Math.round(s.bright * (away < 3 ? 1.4 : 1) * (1 - 0.4 * thin));
  band.thin = thin; band.mix = s.level * (1 - 0.4 * thin);
  if (bright !== band.bright) { band.bright = bright; band.soft.frequency.setTargetAtTime(bright, t, 2.5); }
  if (band.next < t + 0.05) band.next = t + 0.05;       // (after a stall, what was missed is let go)
  while (band.next < t + AHEAD) { post(band.next, band.n); band.next += stepLen(s, band.n); band.n++; }
}
// A strike on a voice: a dip to nothing, the pitch, the rise, and after `hold` the fall. Never before what is
// already posted on it.
function strike(v, at, f, peak, attack, hold, fall) {
  const from = Math.max(at, v.last), on = from + DIP, g = v.gain.gain;
  g.setTargetAtTime(0, from, 0.0015);
  v.osc.frequency.setValueAtTime(f, on);
  g.setTargetAtTime(peak, on, attack);
  g.setTargetAtTime(0, on + hold, fall);
  v.last = on + hold; v.flast = Math.max(v.flast, on); v.quiet = on + hold + 5 * fall;
  return on;
}
// One step of the score at `at`: the pads on a change of chord, then the motif or the patterns.
function post(at, n) {
  const s = band.score, bar = s.bar, i = n % bar, b = Math.floor(n / bar), part = s.form[Math.floor(b / 4) % s.form.length], chord = s.chords[b % s.chords.length];
  const vel = (i === 0 ? 1 : i % 4 === 0 ? 0.85 : i % 2 === 0 ? 0.72 : 0.6) * (0.9 + 0.2 * rnd()), fit = s.fit;
  if (i === 0 && s.pad && (chord !== band.chord || band.on < 0)) chordOn(at, s, chord);
  if (part === 'r') return;
  const motif = b % 4 === 0 ? hex(s.motif[i]) : -1, carrier = b % 4 === 0 ? fit.carrier : null, lift = part === 'B' ? s.lift : 0, B = part === 'B';
  let plucked = false;
  if (s.lead && s.lead.wave === band.lead.wave) {
    if (carrier === 'lead') { if (motif >= 0) leadNote(at, n, pitch(s, 'lead', motif + lift, fit.motif), 1, fit.gaps[i] ? Math.min(s.lead.len, 0.9 * fit.gaps[i] * stepLen(s, 1)) : s.lead.len); }
    else if (i % s.lead.grid === 0 && at >= band.lead.last && rnd() < s.lead.every * (B ? 1.4 : 1) * (1 - 0.6 * band.thin)) {
      band.leadK = Math.max(s.lead.range[0], Math.min(s.lead.range[1], band.leadK + STEPS[(rnd() * 6) | 0]));
      leadNote(at, n, pitch(s, 'lead', band.leadK, fit.lead), vel, s.lead.len);
    }
  }
  if (s.pluck && s.pluck.wave === band.plucks[0].wave) {
    if (carrier === 'pluck') { if (motif >= 0) plucked = pluck(at, n, motif + lift, fit.motif, 1); }
    else {
      const d = hex(pat(s.pluck.pattern, n, i, bar));
      if (d >= 0 && rnd() < s.pluck.chance * (B ? 0.6 : 1) * (1 - 0.5 * band.thin)) plucked = pluck(at, n, chord + d, fit.pluck[chord], vel);
    }
  }
  // What was queued for this step (an echo, the rest of a burst), where nothing else is playing (and never on the
  // lead in a bar whose motif it plays).
  for (const q of band.queue) {
    if (q.n < 0 || q.n > n) continue;
    if (q.n === n) { if (q.lead) { if (s.lead && carrier !== 'lead') leadNote(at, n, q.f, q.vel, s.lead.len, false); } else if (!plucked) plucked = strikePluck(at, q.f, q.vel); }
    q.n = -1;
  }
  if (s.bass && s.bass.wave === band.bass.wave) {
    const d = carrier === 'bass' ? motif : hex(pat(s.bass.pattern, n, i, bar));
    if (d >= 0 && at >= band.bass.last) {
      const f = carrier === 'bass' ? pitch(s, 'bass', motif + lift, fit.motif) : pitch(s, 'bass', chord + d, fit.bass[chord]);
      strike(band.bass, at, f, s.bass.gain * vel * band.mix, 0.006, 0.03, s.bass.decay);
    }
  }
  if (s.perc && !B) { const c = pat(s.perc.pattern, n, i, bar); if (DRUMS[c]) hit(at, c, vel, s); }
}
// The pads: the chord rises on the pad that is silent while the other falls. A pad still in another piece's wave
// takes no chord: the pad held over a turn is let go at the first chord after it, and in a piece whose bars are
// short its next chord would be posted while it is still falling, before it could be dressed, and so on round,
// every other chord in the last ground's wave for as long as the drill stayed. Instead the sounding pad holds its
// chord a bar or two more, and the other is dressed as soon as it has gone quiet (`redress`).
function chordOn(at, s, chord) {
  const p = s.pad, old = band.on < 0 ? null : band.pads[band.on], up = s.fit.pad[chord] ?? 1;
  let on = band.on < 0 ? 0 : 1 - band.on;
  if (band.pads[on].wave !== p.wave) { if (old || band.pads[1 - on].wave !== p.wave) return; on = 1 - on; }
  const v = band.pads[on];
  const when = Math.max(at, v.last), f = p.tones.map(k => pitch(s, 'pad', chord + k, up));
  v.osc[0].frequency.setValueAtTime(f[0], when); v.osc[1].frequency.setValueAtTime(f[1] + p.spread, when);
  v.gain.gain.setTargetAtTime(p.gain * band.mix, when, p.rise);
  v.last = when; v.quiet = Infinity;
  if (old) { const go = Math.max(when, old.last); old.gain.gain.setTargetAtTime(0, go, p.fall); old.last = go; old.quiet = go + 5 * p.fall; }
  band.on = on; band.chord = chord;
}
// The lead holds a note for `hold` seconds, but never into the first note of a motif it is to play; an echo of it
// is queued, unless it is an echo itself.
function leadNote(at, n, f, vel, hold, echo = true) {
  const s = band.score, v = band.lead, bar = s.bar;
  if (at < v.last) return;
  if (Math.floor(n / bar) % 4 === 3 && s.fit.carrier === 'lead' && hex(s.motif[0]) >= 0) {
    let room = 0;
    for (let k = n; k % bar || k === n; k++) room += stepLen(s, k);
    hold = Math.min(hold, room - DIP - 0.02);
    if (hold < 0.04) return;
  }
  strike(v, at, f, s.lead.gain * vel * band.mix, s.lead.rise, hold, s.lead.fall);
  if (s.echo && echo) queue(n + s.echo[0], f, vel * s.echo[1], true);
}
// A pluck of degree `k` (lifted by `up`), with its echo and the rest of its burst queued.
function pluck(at, n, k, up, vel) {
  const s = band.score, f = pitch(s, 'pluck', k, up);
  if (!strikePluck(at, f, vel)) return false;
  if (s.echo) queue(n + s.echo[0], f, vel * s.echo[1], false);
  if (s.burst) for (let j = 1; j < s.burst[0]; j++) queue(n + j, pitch(s, 'pluck', k + j * s.burst[1], up), vel * (1 - 0.2 * j), false);
  return true;
}
function strikePluck(at, f, vel) {
  const s = band.score, p = s.pluck;
  let v = band.plucks[band.pk];
  if (at < Math.max(v.last, v.flast)) v = band.plucks[1 - band.pk];
  if (at < Math.max(v.last, v.flast)) return false;
  band.pk = band.plucks.indexOf(v) ^ 1;
  const on = strike(v, at, f, p.gain * vel * band.mix, 0.004, 0.015, p.decay);
  v.lp.frequency.setValueAtTime(p.lp[0], on); v.lp.frequency.setTargetAtTime(p.lp[1], on, p.decay * 0.7);
  if (s.glide > 1) { v.flast = on + Math.min(3 * p.decay, 1.2 * stepLen(s, 1)); v.osc.frequency.exponentialRampToValueAtTime(f * s.glide, v.flast); }
  return true;
}
function queue(n, f, vel, lead) {
  const q = band.queue.find(q => q.n < 0);
  if (q) { q.n = n; q.f = f; q.vel = vel; q.lead = lead; }
}
// A hit of the drum: the bandpass is moved only while the hit before it has dipped to nothing, and well before the
// hit (MOVE), since a bandpass moved from a wide band to a narrow one rings out for a while with what it held.
const MOVE = 0.03;
function hit(at, c, vel, s) {
  const [freq, q, peak, decay, rise] = DRUMS[c], v = band.perc, attack = Math.min(rise, 0.25 * stepLen(s, 1)), moved = v.drum !== c;
  const from = Math.max(at + (rnd() - 0.5) * 0.008 - (moved ? MOVE : 0), v.last), on = from + (moved ? MOVE : DIP), g = v.gain.gain;
  g.setTargetAtTime(0, from, 0.0015);
  if (moved) { v.bp.frequency.setValueAtTime(freq, from + 0.004); v.bp.Q.setValueAtTime(q, from + 0.004); v.drum = c; }
  g.setTargetAtTime(peak * s.perc.gain * vel * (1 - 0.5 * band.thin), on, attack);
  g.setTargetAtTime(0, on + 2 * attack, decay);
  v.last = on + 2 * attack; v.quiet = v.last + 5 * decay;
}
// For the tools: a ground's music alone, with no bed (`node tools/sounds.mjs`), and what the music is doing.
export function hear(ground, far = 300) {
  away = far; lastGround = ground; lastDeep = false;
  wanted = playing = scoreOf(ground);
  retune(playing);
  if (band) turn(playing);
}
// For the tests: every phrase a score's voices play (each chord's pads and patterns, the lead's range, the motif
// and its answer), as degrees and as the pitches they sound at; and the names of the waves there are.
export function phrasesOf(ground) {
  const s = scoreOf(ground), fit = s.fit, out = [], take = (voice, degrees, up, motif = false) => out.push({ voice, motif, degrees, hz: degrees.map(k => pitch(s, voice, k, up)) });
  for (const c of new Set(s.chords)) {
    if (s.pad) take('pad', s.pad.tones.map(k => c + k), fit.pad[c]);
    for (const voice of ['pluck', 'bass']) if (s[voice]) take(voice, digits(s[voice].pattern).map(d => c + d), fit[voice][c]);
  }
  if (s.lead) take('lead', Array.from({ length: s.lead.range[1] - s.lead.range[0] + 1 }, (_, k) => s.lead.range[0] + k), fit.lead);
  if (fit.carrier) for (const up of [0, s.lift]) take(fit.carrier, fit.tune.map(k => k + up), fit.motif, true);
  return out;
}
export const waveNames = () => [...BUILT, 'keys', ...Object.keys(SHAPES)];
export const musicNow = () => ({ playing: playing?.name ?? null, wanted: wanted?.name ?? null, score: band?.score?.name ?? null, next: band?.next ?? null, dressed: !!band?.dressed, turns: band?.turns ?? 0 });
