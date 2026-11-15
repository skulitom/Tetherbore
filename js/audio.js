// Every sound is synthesised here with Web Audio: there are no audio files. The context starts on the first touch.

let ctx = null, master = null, noiseBuffer = null, muted = false;
try { muted = localStorage.getItem('tetherbore-mute') === '1'; } catch { /* private mode */ }

export function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  const squash = ctx.createDynamicsCompressor();
  master.connect(squash); squash.connect(ctx.destination);
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < data.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; data[i] = s / 2147483648 - 1; }
}
export const isMuted = () => muted;
export function setMuted(value) {
  muted = value;
  try { localStorage.setItem('tetherbore-mute', value ? '1' : '0'); } catch { /* private mode */ }
  if (master) master.gain.value = value ? 0 : 0.5;
}

function tone(freq, length, { type = 'square', gain = 0.2, to = freq, delay = 0, attack = 0.004 } = {}) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + length);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0008, t + length);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + length + 0.02);
}
function noise(length, { gain = 0.2, freq = 1200, to = freq, q = 1, delay = 0, type = 'bandpass' } = {}) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuffer; src.loop = true;
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (to !== freq) f.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + length);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + length);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t, (t * 7.3) % 0.9); src.stop(t + length + 0.02);
}

const SCALE = [0, 2, 4, 7, 9];   // major pentatonic: any run of payouts is in tune
const note = step => 220 * 2 ** ((SCALE[((step % 5) + 5) % 5] + 12 * Math.floor(step / 5)) / 12);

export const sfx = {
  dig(hard) { noise(0.09, { freq: 1900 - hard * 320, to: 500, gain: 0.22, q: 0.8 }); tone(150 - hard * 18, 0.06, { gain: 0.12, to: 70 }); },
  grind() { noise(0.05, { freq: 2600, to: 1400, gain: 0.07, q: 2 }); },
  slide(cells) { noise(0.12 + Math.min(cells, 12) * 0.012, { freq: 500, to: 2600, gain: 0.1, q: 1.4 }); },
  step(run) { noise(0.035, { freq: 700 + run * 1100, to: 400 + run * 600, gain: 0.05, q: 2.5 }); },
  thud() { tone(110, 0.09, { type: 'sine', gain: 0.3, to: 50 }); },
  clink() { tone(1500, 0.07, { type: 'triangle', gain: 0.2, to: 1100 }); tone(2300, 0.05, { type: 'triangle', gain: 0.1, delay: 0.02 }); },
  twang() { tone(190, 0.32, { type: 'sawtooth', gain: 0.16, to: 120 }); tone(380, 0.2, { type: 'triangle', gain: 0.1, to: 250 }); },
  crack(size) {
    const big = Math.min(1, size / 80);
    noise(0.25 + big * 0.3, { freq: 900, to: 90, gain: 0.4, q: 0.6, type: 'lowpass' });
    tone(90 - big * 30, 0.4 + big * 0.3, { type: 'sine', gain: 0.5, to: 32 });
    tone(520, 0.5, { type: 'sawtooth', gain: 0.12, to: 1900, delay: 0.12 });
  },
  tick(step) { tone(note(step), 0.11, { type: 'triangle', gain: 0.17 }); },
  gem(step) { tone(note(step + 10), 0.22, { type: 'sine', gain: 0.2 }); tone(note(step + 12), 0.2, { type: 'sine', gain: 0.1, delay: 0.05 }); },
  banked(size) {
    const top = 10 + Math.min(10, Math.floor(size / 12));
    [0, 2, 4].forEach((s, i) => tone(note(top - 4 + s), 0.5, { type: 'triangle', gain: 0.18, delay: i * 0.07 }));
    tone(note(top + 5), 0.8, { type: 'sine', gain: 0.16, delay: 0.21 });
  },
  recall() { noise(0.4, { freq: 300, to: 3200, gain: 0.14, q: 2 }); tone(200, 0.4, { type: 'sawtooth', gain: 0.07, to: 900 }); },
  dock() { tone(330, 0.12, { type: 'triangle', gain: 0.2 }); tone(495, 0.2, { type: 'triangle', gain: 0.2, delay: 0.09 }); },
  buy() { [0, 2, 4, 7].forEach((s, i) => tone(note(5 + s), 0.16, { gain: 0.1, delay: i * 0.05 })); },
  deny() { tone(150, 0.14, { gain: 0.12, to: 110 }); },
  tap() { tone(700, 0.04, { type: 'triangle', gain: 0.1 }); },
  low() { tone(440, 0.09, { gain: 0.1 }); tone(330, 0.12, { gain: 0.1, delay: 0.11 }); },
  zap() { noise(0.22, { freq: 3800, to: 700, gain: 0.3, q: 3 }); tone(1100, 0.2, { type: 'sawtooth', gain: 0.12, to: 110 }); },
  hiss() { noise(0.6, { freq: 5200, to: 1300, gain: 0.14, q: 0.7, type: 'highpass' }); },
  puff() { noise(0.4, { freq: 420, to: 160, gain: 0.25, q: 0.8, type: 'lowpass' }); },
  freeze() { tone(1900, 0.12, { type: 'sine', gain: 0.07, to: 2700 }); },
  blast() { noise(0.7, { freq: 1300, to: 50, gain: 0.6, q: 0.5, type: 'lowpass' }); tone(70, 0.6, { type: 'sine', gain: 0.6, to: 26 }); },
  relic() { [0, 2, 4, 5, 7, 9, 10, 12].forEach((s, i) => tone(note(5 + s), 0.6, { type: 'triangle', gain: 0.13, delay: i * 0.09 })); },
};

// ---------------------------------------------------------------- the sound of the place
// A bed of filtered noise and a low drone that change with the ground the drill is in, and now and then a single
// soft note from that ground's own scale.
let bed = null, bedKey = -1;
const AIR = [[420, 55], [1500, 82], [240, 41], [700, 62], [520, 73]];     // [filter Hz, drone Hz] per direction
export function setAmbience(biome, deep) {
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
  const [hz, low] = AIR[biome] ?? AIR[0], t = ctx.currentTime;
  bed.filter.frequency.setTargetAtTime(hz * (deep ? 0.7 : 1), t, 1.2);
  bed.drone.frequency.setTargetAtTime(low * (deep ? 0.75 : 1), t, 1.2);
  bed.out.gain.setTargetAtTime(0.06, t, 1.5);
}
const MOODS = [[0, 4, 7], [7, 9, 12, 14, 16], [0, 3, 5], [2, 4, 9, 11], [0, 4, 7, 9]];
const TOP = [440, 880, 165, 330, 440];                                     // the note each direction's scale stands on
sfx.chime = biome => {
  const steps = MOODS[biome] ?? MOODS[0], step = steps[(Math.random() * steps.length) | 0];
  const f = (TOP[biome] ?? TOP[0]) * 2 ** (step / 12);
  tone(f, 1.6, { type: 'sine', gain: 0.045, attack: 0.08 });
  tone(f * 1.5, 1.2, { type: 'sine', gain: 0.02, attack: 0.1, delay: 0.22 });
};
// A place's name comes up on its plate: two notes of its direction's scale, the lowest and then the highest.
sfx.place = kin => {
  const steps = MOODS[kin] ?? MOODS[0], top = TOP[kin] ?? TOP[0];
  tone(top * 2 ** (steps[0] / 12), 0.28, { type: 'triangle', gain: 0.085, attack: 0.01 });
  tone(top * 2 ** (steps[steps.length - 1] / 12), 0.5, { type: 'triangle', gain: 0.085, attack: 0.01, delay: 0.13 });
};
// A ground met for the first time: the notes of its scale together, spread a little, over the note it stands on.
sfx.arrive = kin => {
  const steps = MOODS[kin] ?? MOODS[0], top = TOP[kin] ?? TOP[0];
  tone(top / 2, 1.8, { type: 'triangle', gain: 0.07, attack: 0.03 });
  steps.slice(0, 4).forEach((step, n) => tone(top * 2 ** (step / 12), 1.5, { type: 'sine', gain: 0.07, attack: 0.03, delay: 0.05 + n * 0.07 }));
};
// Something seen for the first time: a few notes of its own for each kind of thing.
const SPOTS = { cache: [10, 12], geode: [7, 9, 12], wreck: [6, 3], key: [5, 5], prism: [12, 14, 17], relic: [5, 7, 9, 12], mineral: [8, 11] };
sfx.spot = what => (SPOTS[what] ?? SPOTS.cache).forEach((step, n) => tone(note(step), 0.3, { type: 'triangle', gain: 0.11, delay: n * 0.09 }));
// A wreck close by ticks: `near` is 0 at the edge of hearing and 1 beside it.
sfx.ping = near => tone(620 + 260 * near, 0.07, { type: 'sine', gain: 0.035 + 0.05 * near, attack: 0.002 });
