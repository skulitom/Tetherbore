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
//   - The music is made once (13 nodes and one timer), makes no node however long it plays, is soft and slow, and
//     stops with its switch or the mute and comes back; both switches are kept in storage.
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
  createOscillator() { if (broken) throw new Error('no oscillator today'); return new Node('oscillator', { frequency: 440, detune: 0 }); }
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
const music = band.filter(node => node.kind === 'oscillator');
if (music.length !== 5 || timers.size !== 1) fails.push(`the music is ${music.length} oscillators and ${timers.size} timers at the first touch (5 and 1 are meant)`);
const musicNodes = band.length;
if (musicNodes !== 13) fails.push(`the music is ${musicNodes} nodes (13 are meant)`);

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
// Ten minutes of it, the ground changed now and then: the timer is run as a browser would run it.
const before = made.length, [timer] = timers.values(), posts = () => band.reduce((sum, node) => sum + ['gain', 'frequency'].reduce((n, key) => n + (node[key]?.events.length ?? 0), 0), 0);
const posted = posts();
if (timer.ms < 1000) fails.push(`the music's timer runs every ${timer.ms} ms`);
for (let n = 0; n < 400; n++) {
  clock += timer.ms / 1000;
  if (n % 40 === 20) audio.setAmbience((n / 40) % 5 | 0, n % 80 === 20, 100 + n * 5);
  timer.run();
}
if (made.length - before > 5) fails.push(`the music made ${made.length - before} nodes in ten minutes (the bed's five, the first time the ground is told, are all that is meant)`);
const notes = posts() - posted;
if (!(notes > 80 && notes < 1200)) fails.push(`the music posted ${notes} changes in ten minutes (a few hundred are meant: a note is three)`);
for (const node of band) {
  for (const e of node.gain?.events ?? []) if (e.kind !== 'target' || e.value > 1 || (node.outs[0]?.kind === 'filter' && (e.value > 0.03 || e.more < 0.3))) fails.push(`the music: a gain goes to ${e.value} over ${e.more} s (${e.kind})`);
  if (node.kind === 'oscillator') for (const e of node.frequency.events) if (!(e.value >= 150 && e.value <= 1500)) fails.push(`the music: a note at ${e.value} Hz`);
}
// Its switch, and the mute, which also stops it.
audio.setMusic(false);
if (audio.isMusic() || timers.size || kept.get('tetherbore-music') !== '0' || !music.every(o => o.stopped >= clock)) fails.push('the music\'s switch, turned off, does not stop it, its timer and its oscillators, or is not kept');
let from = made.length;
audio.setMusic(true);
if (!audio.isMusic() || timers.size !== 1 || made.length - from !== 13 || kept.get('tetherbore-music') !== '1') fails.push(`the music's switch, turned on again, made ${made.length - from} nodes and ${timers.size} timers (13 and 1 are meant)`);
audio.setMuted(true);
if (!audio.isMuted() || master.gain.value !== 0 || kept.get('tetherbore-mute') !== '1' || timers.size) fails.push('muted, the master is not at nothing, or the music\'s timer still runs, or the mute is not kept');
clock += 10;
for (const one of ASKS) { const nodes = ask(one); if (nodes.length) fails.push(`${said(one)} made ${nodes.length} nodes when muted`); if (draws !== (one[0] === 'chime' ? 1 : 0)) fails.push(`${said(one)} drew ${draws} from Math.random when muted`); }
from = made.length;
audio.setMuted(false);
if (audio.isMuted() || master.gain.value !== level || kept.get('tetherbore-mute') !== '0' || timers.size !== 1 || made.length - from !== 13) fails.push('unmuted, the master is not back at its level or the music is not back');
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

console.log(fails.length ? `DEFECT: ${[...new Set(fails)].slice(0, 30).join('\n        ')}` : `ok: ${ASKS.length} sounds, none over ${most} nodes, every gain from nothing to nothing; sixty cuts asked in a second are ${digs} sounds and thirty grinds ${grinds}; the music is 13 nodes and posted ${notes} changes in ten minutes`);
process.exit(fails.length ? 1 : 0);
