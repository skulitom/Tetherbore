// The rules js/audio.js keeps, held with no browser: a stand-in for Web Audio writes down every node that is made
// and everything posted to it, and each sound is asked for as the game asks.
//   - With no context (before the first touch) and when muted, a sound makes nothing; and no sound but `chime`
//     draws from Math.random, heard or not (the game's tests count its draws), `chime` once.
//   - Every layer's gain starts at nothing and ends at nothing (no clicks), is never loud, and goes to the master,
//     the room or the space; every source is started and stopped, not before its gain has died; every pitch is a
//     number a speaker can play; and when a source ends its layer is taken out of the graph.
//   - No sound makes more than 16 nodes.
//   - Rewards grow with what happened: a bigger haul is banked with more notes, a run of hauls and a chain of
//     loops each begin a step higher than the last, and the ticks of a haul climb as it is paid out.
//   - Sounds that come in bursts have a least gap: sixty cuts asked for in a second are at most 26 sounds, thirty
//     grinds at most 11; and with many layers sounding the small sounds make little or nothing.
//   - A sound that goes wrong does not throw into the frame that asked for it, and says so once.
//   - While the page is aside (hidden, or another window has the focus) the context is suspended and no sound makes
//     anything; a touch then does not wake it, and coming back resumes it.
//   - The music is made once (26 nodes, eleven sources, one timer), makes no node however long it plays or however
//     often the ground changes, is soft, posts each voice's notes in the order of their times and always a little
//     ahead, changes a voice's waveform only while it is silent, changes ground only when the drill has stayed, posts
//     nothing while the page is hidden, and stops with its switch or the mute and comes back with the score it was
//     playing; both switches are kept in storage. Every ground's call and bell is its own score's.
// What they sound like is not held here: `node tools/sounds.mjs` measures that in a browser.
//   node test/regress/sound-layers.mjs
const fails = [], kept = new Map();
globalThis.localStorage = { getItem: k => kept.has(k) ? kept.get(k) : null, setItem: (k, v) => { kept.set(k, String(v)); } };
globalThis.window = globalThis;
globalThis.document = { hidden: false };

// ---------------------------------------------------------------- Web Audio, stood in for
let clock = 100, made = [], contexts = 0, resumed = 0, suspended = 0, broken = false;
class Param {
  constructor(value) { this.first = value; this.now = value; this.events = []; this.sets = 0; }
  get value() { return this.now; }
  set value(v) { this.now = v; this.sets++; if (!this.events.length) this.first = v; }
  post(kind, value, time, more) {
    if (!Number.isFinite(value) || !Number.isFinite(time)) throw new TypeError(`${kind}: ${value} at ${time} is not a number`);
    if (kind === 'exp' && !(value > 0)) throw new RangeError(`an exponential ramp to ${value}`);
    this.events.push({ kind, value, time, more });
  }
  setValueAtTime(v, t) { this.post('set', v, t); } linearRampToValueAtTime(v, t) { this.post('line', v, t); }
  exponentialRampToValueAtTime(v, t) { this.post('exp', v, t); } setTargetAtTime(v, t, c) { this.post('target', v, t, c); }
}
class Node {
  constructor(kind, params = {}) { this.kind = kind; this.outs = []; this.cut = false; for (const [name, value] of Object.entries(params)) this[name] = new Param(value); made.push(this); }
  connect(to) { this.outs.push(to); return to; }
  disconnect() { this.outs.length = 0; this.cut = true; }
  start(when = clock) { this.started = when; } stop(when = clock) { this.stopped = when; }
  setPeriodicWave(wave) { this.wave = wave; }
}
class Context {
  constructor() { contexts++; this.sampleRate = 48000; this.state = 'running'; this.destination = new Node('destination'); }
  get currentTime() { return clock; }
  resume() { resumed++; this.state = 'running'; }
  suspend() { suspended++; this.state = 'suspended'; }
  createGain() { return new Node('gain', { gain: 1 }); }
  createOscillator() {
    if (broken) throw new Error('no oscillator today');
    // (Every time an oscillator is dressed in a waveform is written down, with the time.)
    const o = new Node('oscillator', { frequency: 440, detune: 0 });
    o.dressed = []; let type = 'sine';
    Object.defineProperty(o, 'type', { get: () => type, set: v => { type = v; o.dressed.push(clock); } });
    o.setPeriodicWave = wave => { o.wave = wave; o.dressed.push(clock); };
    return o;
  }
  createBufferSource() { return new Node('noise'); }
  createBiquadFilter() { return new Node('filter', { frequency: 350, Q: 1 }); }
  createDynamicsCompressor() { return new Node('compressor', { threshold: -24, knee: 30, ratio: 12, attack: 0.003, release: 0.25 }); }
  createWaveShaper() { return new Node('shaper'); } createConvolver() { return new Node('convolver'); }
  createBuffer(channels, length) { const data = new Float32Array(length); return { getChannelData: () => data }; }
  createPeriodicWave() { return {}; }
}
globalThis.AudioContext = Context;
const timers = new Map();
let timerId = 0;
globalThis.setInterval = (run, ms) => { timers.set(++timerId, { run, ms }); return timerId; };
globalThis.clearInterval = id => { timers.delete(id); };
let draws = 0;
const random = Math.random;
Math.random = () => { draws++; return random(); };
const warned = [], warn = console.warn;
console.warn = (...said) => { warned.push(said.join(' ')); };

const audio = await import('../../js/audio.js'), { sfx } = audio;
// What the game asks for, each with what it is asked with.
const ASKS = [['dig', 1], ['dig', 2], ['dig', 3], ['dig', 4], ['dig', 2, 'ore'], ['dig', 1, 'ice'], ['dig', 0], ['crumble'], ['grind'], ['slide', 3], ['slide', 12], ['thud'], ['clink'], ['twang'],
  ['crack', 1], ['crack', 12, 0], ['crack', 80, 3], ['crack', 400, 9], ['tick', 0], ['tick', 14], ['tick'], ['gem', 0], ['gem', 6], ['gem', 14], ['banked', 3], ['banked', 20], ['banked', 50], ['banked', 300],
  ['dock'], ['buy'], ['deny'], ['tap'], ['zap'], ['hiss'], ['puff'], ['freeze'], ['relic'], ['knock'], ['wreck'], ['mend'], ['chime', 0], ['chime', 3], ['chime', 9], ['place', 1], ['arrive', 2],
  ['spot', 'relic'], ['spot', 'nothing known'], ['ping', 0], ['ping', 1], ['step', 0.5], ['recall'], ['low']];
const said = ask => `${ask[0]}(${ask.slice(1).map(a => JSON.stringify(a)).join(', ')})`;
const ask = ([name, ...args]) => { const from = made.length; draws = 0; sfx[name](...args); return made.slice(from); };
// (A giant haul's sound, at every size of giant and at HALF.)
ASKS.push(['vast', 1], ['vast', 3], ['vast', 6], ['vast', 7], ['vast', 0], ['vast', NaN]);
// (A place's bell and calls, by a score's name, a row of a pocket, a cross, a ground with no score, a number.)
const THAW = { name: 'hollow thaw', kin: 1, cross: { host: 1, donor: 2, structure: 1 } };
ASKS.push(['chime', 'hive'], ['chime', { name: 'glaze', kin: 1 }], ['place', 'drift'], ['place', THAW], ['arrive', 'rime'], ['arrive', 'no such ground'], ['place', 9]);
// (The sounds of the ground, js/feel.js's: each as it asks, and with nothing, or with what is no number.)
ASKS.push(['creak'], ['creak', 0, 1.5], ['creak', NaN, NaN], ['shatter', 1], ['shatter', 0], ['shatter'], ['drip', 1, 0], ['drip', 0, 4], ['drip', 0.5, -2], ['drip', NaN, NaN], ['drip'],
  ['blub', 0.5], ['blub'], ['quake', 1], ['quake', 2], ['quake', NaN], ['quake'], ['gust', 1], ['gust', 0.5], ['gust'], ['trickle', 0.5], ['trickle'], ['crackle', 1], ['crackle']);
for (const name of ['creak', 'shatter', 'drip', 'blub', 'quake', 'gust', 'trickle', 'crackle']) if (typeof sfx[name] !== 'function') fails.push(`the ground's feel asks for sfx.${name}, and there is none`);
for (const name of ['tap', 'gem', 'relic', 'dig', 'tick', 'slide', 'hiss', 'dock', 'clink', 'zap', 'wreck', 'twang', 'thud', 'spot', 'puff', 'place', 'ping', 'mend', 'knock', 'grind', 'freeze', 'deny', 'crack', 'chime', 'buy', 'banked', 'arrive']) {
  if (typeof sfx[name] !== 'function') fails.push(`the game asks for sfx.${name}, and there is none`);
}

// ---------------------------------------------------------------- no context: nothing, and the game's random numbers left alone
for (const one of ASKS) {
  const nodes = ask(one), meant = one[0] === 'chime' ? 1 : 0;
  if (nodes.length) fails.push(`${said(one)} made ${nodes.length} nodes with no context`);
  if (draws !== meant) fails.push(`${said(one)} drew ${draws} from Math.random with no context (${meant} is meant)`);
}
audio.setAmbience(0, false, 12);
if (audio.isMusic() !== true || audio.isMuted() !== false) fails.push('before anything is set, the music is not on or the game is muted');
if (timers.size) fails.push('a timer runs before the first touch');

// ---------------------------------------------------------------- the first touch
audio.unlock();
const fixed = made.slice(), master = fixed.find(node => node.kind === 'gain'), ways = new Set(fixed.filter(node => node.kind === 'gain' && node.outs.includes(master)).concat(master));
// (The last thing made before the music is an oscillator that is never started: it is there to have its waveform drawn up.)
const band = fixed.slice(fixed.findIndex(node => node.kind === 'oscillator' && node.started === undefined) + 1);
audio.unlock();
if (contexts !== 1) fails.push(`unlocking twice made ${contexts} contexts`);
if (!(master.gain.value > 0 && master.gain.value <= 1)) fails.push(`the master's gain is ${master.gain.value}`);
const level = master.gain.value;
if (fixed.filter(node => node.kind === 'compressor').length !== 1 || fixed.filter(node => node.kind === 'shaper').length !== 1) fails.push('there is not one compressor and one ceiling');
const music = band.filter(node => node.kind === 'oscillator' || node.kind === 'noise');
if (music.length !== 11 || music.filter(node => node.kind === 'oscillator').length !== 10 || timers.size !== 1) fails.push(`the music is ${music.length} sources and ${timers.size} timers at the first touch (11, ten of them oscillators, and 1 are meant)`);
const musicNodes = band.length;
if (musicNodes !== 26) fails.push(`the music is ${musicNodes} nodes (26 are meant)`);

// ---------------------------------------------------------------- each sound, layer by layer
let most = 0;
for (const one of ASKS) {
  clock += 10;
  const nodes = ask(one), meant = one[0] === 'chime' ? 1 : 0, at = clock, name = said(one);
  if (draws !== meant) fails.push(`${name} drew ${draws} from Math.random (${meant} is meant)`);
  if (!nodes.length) { fails.push(`${name} made no sound`); continue; }
  most = Math.max(most, nodes.length);
  if (nodes.length > 16) fails.push(`${name} made ${nodes.length} nodes`);
  const sources = nodes.filter(node => node.kind === 'oscillator' || node.kind === 'noise');
  for (const node of nodes) {
    for (const key of ['frequency', 'detune', 'Q']) for (const e of node[key]?.events ?? []) if (key === 'frequency' && !(e.value >= 20 && e.value <= 16000)) fails.push(`${name}: a ${node.kind} at ${e.value} Hz`);
    if (node.kind !== 'gain') continue;
    const events = node.gain.events, last = events[events.length - 1];
    if (node.gain.first !== 0 || events[0]?.value !== 0) fails.push(`${name}: a gain starts at ${events[0]?.value ?? node.gain.first}, not at nothing: a click`);
    if (last?.value !== 0 || last.kind === 'set' || last.kind === 'target') fails.push(`${name}: a gain does not end in a ramp to nothing: a click`);
    if (events.some((e, n) => e.time < at - 1e-9 || (n && e.time < events[n - 1].time - 1e-9))) fails.push(`${name}: a gain's times run backwards or begin before the sound`);
    for (let n = 1; n < events.length; n++) if (events[n].kind === 'set' && Math.abs(events[n].value - events[n - 1].value) > 1e-9) fails.push(`${name}: a gain jumps from ${events[n - 1].value} to ${events[n].value}: a click`);
    const peak = Math.max(...events.map(e => e.value));
    if (!(peak > 0.005 && peak <= 0.55)) fails.push(`${name}: a layer's gain peaks at ${peak}`);
    if (node.outs.length !== 1 || !ways.has(node.outs[0])) fails.push(`${name}: a layer does not go to the master, the room or the space`);
  }
  for (const source of sources) {
    let gain = source;
    while (gain && gain.kind !== 'gain') gain = gain.outs[0];
    if (!gain) { fails.push(`${name}: a source goes nowhere`); continue; }
    const end = gain.gain.events[gain.gain.events.length - 1].time;
    if (!(source.started >= at) || !(source.stopped >= end) || source.stopped > end + 0.05) fails.push(`${name}: a source runs from ${source.started} to ${source.stopped}, and its gain is done at ${end}`);
    if (typeof source.onended !== 'function') { fails.push(`${name}: a source is not followed to its end`); continue; }
    source.onended();
    if (!gain.cut) fails.push(`${name}: a layer is left in the graph when its source has ended`);
  }
  if (nodes.filter(node => node.kind === 'gain').length !== sources.length) fails.push(`${name}: ${sources.length} sources and ${nodes.filter(node => node.kind === 'gain').length} gains`);
}

// ---------------------------------------------------------------- bursts
const burst = (name, per, args = []) => {
  clock += 10;
  let sounds = 0;
  for (let n = 0; n < per; n++, clock += 1 / per) { const nodes = ask([name, ...args]); if (nodes.length) sounds++; for (const node of nodes) node.onended?.(); }
  return sounds;
};
const digs = burst('dig', 60, [2]), grinds = burst('grind', 30), ticks = burst('tick', 60, [3]), breaks = burst('crumble', 60);
if (!(digs >= 12 && digs <= 26)) fails.push(`sixty cuts asked for in a second were ${digs} sounds`);
if (!(grinds >= 8 && grinds <= 11)) fails.push(`thirty grinds asked for in a second were ${grinds} sounds`);
if (!(ticks >= 12 && ticks <= 26)) fails.push(`sixty ticks asked for in a second were ${ticks} sounds`);
if (!(breaks >= 10 && breaks <= 19)) fails.push(`sixty breaks asked for in a second were ${breaks} sounds`);
const shatters = burst('shatter', 30, [1]);
if (!(shatters >= 4 && shatters <= 9)) fails.push(`thirty icicles shattering in a second were ${shatters} sounds`);
clock += 10;
if (ask(['relic']).length && ask(['relic']).length) fails.push('a relic asked for twice in one frame sounds twice');
// Many layers sounding (none has ended): the small sounds give way, the large still play.
clock += 10;
const sounding = [];
for (let n = 0; n < 12; n++, clock += 0.3) sounding.push(...ask(['crack', 100, 0]));
const crowd = { dig: ask(['dig', 3]).length, tick: ask(['tick', 2]).length, grind: ask(['grind']).length, crumble: ask(['crumble']).length, banked: ask(['banked', 100]).length };
if (crowd.dig > 3 || crowd.tick || crowd.grind || crowd.crumble) fails.push(`with ${sounding.filter(node => node.onended).length} layers sounding, a cut made ${crowd.dig} nodes, a tick ${crowd.tick}, a grind ${crowd.grind}, a break ${crowd.crumble}`);
if (!crowd.banked) fails.push('with many layers sounding, a haul is not banked aloud');
for (const node of made) if (node.onended && !fixed.includes(node)) node.onended();
clock += 10;
if (ask(['tick', 2]).length !== 2) fails.push('when the layers have ended, a tick does not come back');

// ---------------------------------------------------------------- rewards grow with what happened
// The run of notes a reward plays is the one oscillator whose pitch is only ever set, never slid: its first note.
const tune = nodes => nodes.find(node => node.kind === 'oscillator' && node.frequency.events.length >= 2 && node.frequency.events.every(e => e.kind === 'set'))?.frequency.events.map(e => e.value) ?? [];
const done = nodes => { for (const node of nodes) node.onended?.(); return nodes; };
clock += 20;
const hauls = [];
for (let n = 0; n < 6; n++, clock += 1.5) hauls.push(tune(done(ask(['banked', 20])))[0]);
if (!hauls.every((f, n) => f > 0 && (n === 0 || f > hauls[n - 1]))) fails.push(`six hauls banked one after another begin at ${hauls.map(f => Math.round(f)).join(', ')} Hz: a run is meant to climb`);
clock += 20;
const alone = tune(done(ask(['banked', 20])))[0];
if (alone !== hauls[0]) fails.push(`a haul banked long after a run begins at ${Math.round(alone)} Hz, not at the ${Math.round(hauls[0])} Hz a first haul does`);
const links = [];
for (let n = 0; n < 6; n++) { clock += 1; links.push(tune(done(ask(['crack', 20, n])))[0]); }
if (!links.every((f, n) => f > 0 && (n === 0 || f > links[n - 1]))) fails.push(`six loops closed in a chain ring at ${links.map(f => Math.round(f)).join(', ')} Hz: each is meant to be higher`);
const sizes = [3, 15, 40, 150].map(size => { clock += 20; return tune(done(ask(['banked', size]))).length; });
if (sizes.join() !== '2,3,4,5') fails.push(`hauls of 3, 15, 40 and 150 cells are banked with ${sizes.join(', ')} notes (2, 3, 4, 5 are meant)`);
clock += 20;
const paid = [0, 7, 14].map(step => { clock += 1; return done(ask(['tick', step])).find(node => node.kind === 'oscillator').frequency.events[0].value; });
if (!(paid[0] < paid[1] && paid[1] < paid[2])) fails.push(`ticks at the start, middle and end of a haul are at ${paid.map(f => Math.round(f)).join(', ')} Hz: they are meant to climb`);
const rocks = [1, 2, 3, 4].map(hard => { clock += 1; return done(ask(['dig', hard])).length; }), ore = (clock += 1, done(ask(['dig', 2, 'ore'])).length);
if (rocks[0] !== 5 || rocks[3] <= rocks[2] || rocks[2] <= rocks[1] || ore <= rocks[1]) fails.push(`cuts in soft, dense, slate and vault are ${rocks.join(', ')} nodes and in ore ${ore}: soft is meant to be 5, and slate, a vault and ore each to have a layer more`);

// ---------------------------------------------------------------- a sound that goes wrong
clock += 10;
broken = true;
try { sfx.tap(); clock += 1; sfx.gem(2); } catch (error) { fails.push(`a sound that went wrong threw into the game: ${error.message}`); }
broken = false;
if (warned.length !== 1) fails.push(`two sounds that went wrong said so ${warned.length} times (once is meant)`);
console.warn = warn;

// ---------------------------------------------------------------- the music
// Ten minutes of it, the ground changed every twelve seconds through every kind of score (a direction, a deep
// flank, a strain, a pocket, a cross, by name, number and row): the timer is run as a browser would run it, and the
// ground is told once each time, as the conductor is to take it up by itself.
const before = made.length, [timer] = timers.values();
const posts = () => band.reduce((sum, node) => sum + ['gain', 'frequency'].reduce((n, key) => n + (node[key]?.events.length ?? 0), 0), 0);
const posted = posts();
const soft = band[0], duck = soft.outs[0], isParam = to => to instanceof Param;
const voices = band.filter(node => node.kind === 'gain' && (node.outs[0] === soft || (node.outs[0] === duck && node !== soft)));
const hits = voices.find(node => node.outs[0] === duck), sways = band.filter(node => node.kind === 'gain' && isParam(node.outs[0]));
const swayers = band.filter(node => node.kind === 'oscillator' && sways.includes(node.outs[0]));
if (voices.length !== 7 || !hits || sways.length !== 2 || swayers.length !== 2) fails.push(`the music's voices are ${voices.length} gains (7 are meant: two pads, a lead, two plucks, a bass and a drum) and ${sways.length} sways`);
if (timer.ms < 250 || timer.ms > 1000) fails.push(`the music's timer runs every ${timer.ms} ms`);
const GROUNDS = [0, [1, true], 'firn', 'serac', 'hive', 2, 'scoria', 'forge', 'drift', 3, [3, true], 'tangle', 'sporefall', 'grotto', 4, [4, true], 'redrock', 'loess',
  'shale', 'ash', 'tinder', 'glaze', [2, true], 1, THAW, { name: 'banded buzzmire', kin: 3, cross: { host: 3, donor: 4, structure: 4 } },
  { name: 'crazed hoarsand', kin: 4, cross: { host: 4, donor: 1, structure: 2 } }];
const runs = Math.round(600 / (timer.ms / 1000)), every = Math.round(12 / (timer.ms / 1000)), heard = new Set();
let short = 0;
for (let n = 0; n < runs; n++) {
  clock += timer.ms / 1000;
  if (n % every === 0) { const g = GROUNDS[(n / every) % GROUNDS.length]; audio.setAmbience(...(Array.isArray(g) ? g : [g, false]), 100 + n); }
  timer.run();
  const now = audio.musicNow();
  if (now.score) heard.add(now.score);
  // (What is posted reaches always a little ahead of the clock: the horizon, not the last note, as a sparse score
  // may go a while with none.)
  if (now.dressed && !(now.next >= clock + 0.6)) short++;
}
if (short) fails.push(`the music's posting fell short of 0.6 s ahead ${short} times`);
if (heard.size < GROUNDS.length - 3) fails.push(`in ten minutes of ${GROUNDS.length} grounds the music played ${heard.size} scores: ${[...heard].join(', ')}`);
if (made.length - before > 5) fails.push(`the music made ${made.length - before} nodes in ten minutes (the bed's five, the first time the ground is told, are all that is meant)`);
const notes = posts() - posted;
if (!(notes > 1500 && notes < 36000)) fails.push(`the music posted ${notes} changes in ten minutes (thousands are meant: a note is three to five)`);
// What a gain's automation comes to at time `d`, all its events being targets.
const valueAt = (param, d) => {
  let v = param.first, target = v, tau = 0, start = 0;
  for (const e of [...param.events].sort((a, b) => a.time - b.time)) {
    if (e.time > d) break;
    if (tau) v = target + (v - target) * Math.exp(-(e.time - start) / tau);
    target = e.value; tau = e.more; start = e.time;
  }
  return tau ? target + (v - target) * Math.exp(-(d - start) / tau) : v;
};
let loudest = 0;
for (const node of voices) {
  const events = node.gain.events, top = node === hits ? 0.5 : 0.04;
  for (const e of events) if (e.kind !== 'target' || !(e.more >= 0.001) || !(e.value >= 0 && e.value <= top)) fails.push(`the music: a voice's gain goes to ${e.value} over ${e.more} s (${e.kind})`);
  if (events.some((e, n) => n && e.time < events[n - 1].time - 1e-9)) fails.push('the music: a voice\'s gain has an event posted before one already there: a note is cut');
  if (node !== hits) loudest += Math.max(0, ...events.map(e => e.value));
}
if (loudest > 0.13) fails.push(`the music's melodic voices together reach ${loudest.toFixed(3)} (0.13 at the most is meant)`);
for (const node of sways) for (const e of node.gain.events) if (e.kind !== 'target' || !(e.value >= 0 && e.value <= 40)) fails.push(`the music: a sway goes to ${e.value} cents`);
for (const node of band) {
  if (node.kind === 'gain' && !voices.includes(node) && !sways.includes(node)) for (const e of node.gain.events) if (e.kind !== 'target' || e.value > 1 || e.value < 0) fails.push(`the music: its level goes to ${e.value} (${e.kind})`);
  if (node.kind === 'oscillator') {
    const [lo, hi] = swayers.includes(node) ? [0.05, 32] : [50, 2000], events = node.frequency.events;
    for (const e of events) if (!(e.value >= lo && e.value <= hi)) fails.push(`the music: ${swayers.includes(node) ? 'a sway' : 'a note'} at ${e.value} Hz`);
    if (events.some((e, n) => n && e.time < events[n - 1].time - 1e-9)) fails.push('the music: a pitch is posted before one already there');
  }
  if (node.kind === 'filter') {
    for (const e of node.frequency.events) if (!(e.value >= 60 && e.value <= 9000)) fails.push(`the music: a filter at ${e.value} Hz`);
    for (const e of node.Q.events) if (!(e.value >= 0.1 && e.value <= 20)) fails.push(`the music: a filter's Q at ${e.value}`);
  }
}
// A waveform is changed only on a voice that is silent at that moment (each oscillator's first dressing is as it
// is made, before it sounds).
let dressings = 0;
for (const node of band) {
  if (node.kind !== 'oscillator' || swayers.includes(node)) continue;
  let gain = node;
  while (gain && gain.kind !== 'gain') gain = gain.outs[0];
  for (const d of node.dressed.slice(1)) {
    dressings++;
    const v = valueAt(gain.gain, d);
    if (!(v <= 0.0004)) fails.push(`the music: a voice was dressed in another waveform at ${d.toFixed(2)} s while its gain was ${v.toFixed(5)}: a click`);
  }
}
if (dressings < GROUNDS.length) fails.push(`in ten minutes of ${GROUNDS.length} grounds the music's voices were dressed in another waveform ${dressings} times`);
// A border that wanders: the ground goes to the south and back within a moment, and the music does not turn; held
// there, it turns once.
const dressed = () => band.reduce((n, node) => n + (node.dressed?.length ?? 0), 0), runFor = seconds => { for (let k = 0; k < seconds / (timer.ms / 1000); k++) { clock += timer.ms / 1000; timer.run(); } };
audio.setAmbience('frost', false, 200); runFor(10);
const still = dressed(), turns = audio.musicNow().turns;
clock += 0.3; audio.setAmbience('ember', false, 200); timer.run(); clock += 0.3; audio.setAmbience('frost', false, 200); timer.run(); runFor(3);
if (audio.musicNow().playing !== 'frost' || dressed() !== still || audio.musicNow().turns !== turns) fails.push(`a border crossed and crossed back within 0.6 s turned the music ${audio.musicNow().turns - turns} times (to ${audio.musicNow().playing}, ${dressed() - still} voices dressed)`);
audio.setAmbience('ember', false, 200); runFor(4);
if (audio.musicNow().playing !== 'ember' || audio.musicNow().score !== 'ember' || !audio.musicNow().dressed || audio.musicNow().turns !== turns + 1) fails.push(`held in the south for 4 s, the music plays ${audio.musicNow().score}, having turned ${audio.musicNow().turns - turns} times (once is meant)`);
// The page hidden: nothing is posted; shown again, nothing is posted in the past.
runFor(3);
document.hidden = true;
const hidden = posts();
runFor(5);
if (posts() !== hidden) fails.push(`with the page hidden the music posted ${posts() - hidden} changes`);
document.hidden = false;
const back = clock, params = band.flatMap(node => ['gain', 'frequency'].map(key => node[key]).filter(Boolean)), was = params.map(p => p.events.length);
clock += timer.ms / 1000; timer.run();
if (params.some((p, n) => p.events.slice(was[n]).some(e => e.time < back))) fails.push('back from hidden, the music posted a note in the past');
// The calls of a place are its own score's: the north's and the south's begin apart, and the east's are the first
// and the last note of its motif, a fifth apart.
const call = ground => { clock += 10; const nodes = ask(['place', ground]), f = tune(nodes); for (const node of nodes) node.onended?.(); return f; };
const [north, south, east] = ['frost', 'ember', 'lode'].map(call);
if (!(north[0] > 0 && south[0] > 0 && Math.abs(north[0] - south[0]) > 1)) fails.push(`the north's and the south's names come up on ${Math.round(north[0])} and ${Math.round(south[0])} Hz`);
if (!(east.length === 2 && Math.abs(east[0] / east[1] - 2 ** (7 / 12)) < 1e-6 && east.every(f => f >= 260 && f <= 1400))) fails.push(`the east's name comes up on ${east.map(Math.round).join(', ')} Hz: the first and last of its motif, a fifth apart, are meant`);
// Its switch, and the mute, which also stops it.
audio.setMusic(false);
if (audio.isMusic() || timers.size || kept.get('tetherbore-music') !== '0' || !music.every(o => o.stopped >= clock)) fails.push('the music\'s switch, turned off, does not stop it, its timer and its oscillators, or is not kept');
let from = made.length;
audio.setMusic(true);
if (!audio.isMusic() || timers.size !== 1 || made.length - from !== 26 || kept.get('tetherbore-music') !== '1') fails.push(`the music's switch, turned on again, made ${made.length - from} nodes and ${timers.size} timers (26 and 1 are meant)`);
if (audio.musicNow().score !== audio.musicNow().playing || !audio.musicNow().playing) fails.push(`the music, turned on again, plays ${audio.musicNow().score} where the ground's is ${audio.musicNow().playing}`);
audio.setMuted(true);
if (!audio.isMuted() || master.gain.value !== 0 || kept.get('tetherbore-mute') !== '1' || timers.size) fails.push('muted, the master is not at nothing, or the music\'s timer still runs, or the mute is not kept');
clock += 10;
for (const one of ASKS) { const nodes = ask(one); if (nodes.length) fails.push(`${said(one)} made ${nodes.length} nodes when muted`); if (draws !== (one[0] === 'chime' ? 1 : 0)) fails.push(`${said(one)} drew ${draws} from Math.random when muted`); }
from = made.length;
audio.setMuted(false);
if (audio.isMuted() || master.gain.value !== level || kept.get('tetherbore-mute') !== '0' || timers.size !== 1 || made.length - from !== 26) fails.push('unmuted, the master is not back at its level or the music is not back');
audio.setMusic(false);

// ---------------------------------------------------------------- aside: the page hidden or out of focus
clock += 10;
const wasResumed = resumed;
audio.setAside(true);
if (!suspended) fails.push('aside, the context was not suspended');
audio.unlock();
if (resumed !== wasResumed) fails.push('aside, a touch resumed the context');
for (const one of ASKS) { const nodes = ask(one); if (nodes.length) fails.push(`${said(one)} made ${nodes.length} nodes while aside`); }
audio.setAside(false);
if (resumed !== wasResumed + 1) fails.push('back from aside, the context was not resumed');
clock += 10;
if (!ask(['tap']).length) fails.push('back from aside, a tap made nothing');

console.log(fails.length ? `DEFECT: ${[...new Set(fails)].slice(0, 30).join('\n        ')}` : `ok: ${ASKS.length} sounds, none over ${most} nodes, every gain from nothing to nothing; sixty cuts asked in a second are ${digs} sounds and thirty grinds ${grinds}; the music is ${musicNodes} nodes and posted ${notes} changes in ten minutes of ${GROUNDS.length} grounds (${heard.size} scores played, ${dressings} waveforms changed on silent voices, its melodic voices together at most ${loudest.toFixed(3)})`);
process.exit(fails.length ? 1 : 0);
