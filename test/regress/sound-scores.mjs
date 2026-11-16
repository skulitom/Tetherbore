// Every ground plays a piece of music of its own (js/audio.js: `scoreOf` and the scores). Held here, with no browser:
//   - every ground made by hand (the home ground, the four directions and their deep flanks, the strains, the
//     pockets) has a score of its own, by its name, and every generated cross the score its rule makes of three
//     others: the host's, the donor's, and the strain whose twist is its structure's (HOLLOW tangle's, CRAZED
//     serac's, FROTHY scoria's, BANDED redrock's), or none;
//   - the nine main grounds are pieces apart, each pair in three ways at least of six: tempo (or metre), scale,
//     the note it stands on, the waves it is played in, which voices play, and the drum;
//   - a strain is its direction's piece and not the same; a pocket is not its direction's piece; a cross keeps its
//     host's key, scale, chords, motif, tempo and metre (a HOLLOW one is slower) and has the donor's own voice in
//     it as the donor plays it, and is not its host's piece;
//   - where a pocket's own rule rings rewards (the drift's chain, the grotto's caps), its key holds the major
//     five-note scale on A that they ring in;
//   - every score is whole and in bounds: a known scale, waves the music has, patterns of the letters it reads,
//     a motif of a bar at the most, a tempo of 36 to 125 a minute, a metre of three, four or five beats, chords,
//     a form that begins with its motif, every voice's level soft, and every phrase a voice plays (its pads for
//     each chord, its patterns, the lead's range, the motif and its answer) inside the voice's room, where a phone's
//     speaker plays it and nothing is shrill, with its shape as written: a phrase is lifted whole, by octaves.
// What the music sounds like is not held here: `node tools/sounds.mjs music` renders and measures every score.
//   node test/regress/sound-scores.mjs
import { BIOMES } from '../../js/world.js';
import { scoreOf, scoreNames, phrasesOf, waveNames } from '../../js/audio.js';

const fails = [], KIN = ['crust', 'frost', 'ember', 'mire', 'lode'], DEEP = ['crust', 'rime', 'magma', 'bloom', 'gilt'], TWIST = [null, 'tangle', 'serac', 'scoria', 'redrock'];
const MAIN = [...KIN, ...DEEP.slice(1)], VOICES = ['pad', 'lead', 'pluck', 'bass', 'perc'], WAVES = new Set(waveNames());
// A score as music, without its name, where it came from and what is worked out from it.
const bare = s => JSON.stringify({ ...s, name: 0, from: 0, fit: 0 });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- every ground has its own piece
const rows = BIOMES.filter(Boolean), none = [];
for (const row of rows) {
  const s = scoreOf(row);
  if (row.cross) {
    const { host, donor, structure } = row.cross, from = [KIN[host], KIN[donor], TWIST[structure] ?? null];
    if (!same(s.from, from) || s.name !== row.name) fails.push(`${row.name} (${row.id}) plays ${s.name} made of ${JSON.stringify(s.from)}, where ${JSON.stringify(from)} is meant`);
  } else if (s.name !== row.name) none.push(`${row.name} (${row.id})`);
}
if (none.length) fails.push(`grounds with no piece of their own (each is to have a score in js/audio.js): ${none.join(', ')}`);
if (scoreOf(9).name !== 'crust' || scoreOf('no such ground').name !== 'crust' || scoreOf({ name: 'nowhere', kin: 3 }).name !== 'mire' || scoreOf(2, true).name !== 'magma') fails.push('a ground with no score is not given its direction\'s, or the home ground\'s');

// ---- the nine main grounds are apart
const looks = s => ({ tempo: [s.bpm * s.tempo, s.bar], mode: s.mode, root: s.root, waves: [...new Set(VOICES.filter(v => s[v]?.wave).map(v => s[v].wave))].sort().join(), voices: VOICES.filter(v => s[v]).join(), perc: s.perc?.pattern ?? '' });
for (let a = 0; a < MAIN.length; a++) for (let b = a + 1; b < MAIN.length; b++) {
  const x = looks(scoreOf(MAIN[a])), y = looks(scoreOf(MAIN[b]));
  const ways = [Math.abs(x.tempo[0] - y.tempo[0]) >= 8 || x.tempo[1] !== y.tempo[1], x.mode !== y.mode, Math.abs(12 * Math.log2(x.root / y.root)) >= 2, x.waves !== y.waves, x.voices !== y.voices, x.perc !== y.perc].filter(Boolean).length;
  if (ways < 3) fails.push(`${MAIN[a]} and ${MAIN[b]} are apart in ${ways} ways (three at least are meant)`);
}

// ---- strains, pockets, crosses
for (const row of rows.filter(r => r.id >= 17 && r.id <= 31)) {
  const s = scoreOf(row), of = scoreOf(KIN[row.kin]);
  if (!same(s.from, [of.name]) || bare(s) === bare(of)) fails.push(`the strain ${row.name} is not its direction's piece changed (from ${JSON.stringify(s.from)})`);
}
for (const row of rows.filter(r => r.pocket)) if (bare(scoreOf(row)) === bare(scoreOf(KIN[row.kin]))) fails.push(`the pocket ${row.name} plays its direction's piece`);
// (What a score plays is in its key: if all of it together holds A major's five notes, so does the key.)
const A_MAJOR = [9, 11, 1, 4, 6], classOf = f => ((Math.round(12 * Math.log2(f / 440)) % 12) + 12 + 9) % 12;
for (const name of ['drift', 'grotto']) {
  const played = new Set(phrasesOf(name).flatMap(p => p.hz).map(classOf));
  if (!A_MAJOR.every(pc => played.has(pc))) fails.push(`the ${name}'s rule rings rewards in A major's five notes, and its music does not hold them all`);
}
for (const row of rows.filter(r => r.cross)) {
  const s = scoreOf(row), host = scoreOf(KIN[row.cross.host]), donor = scoreOf(KIN[row.cross.donor]), hollow = row.cross.structure === 1;
  const kept = ['root', 'mode', 'chords', 'motif', 'bpm', 'bar', ...(hollow ? [] : ['tempo'])].filter(key => !same(s[key], host[key]));
  if (kept.length) fails.push(`the cross ${row.name} does not keep its host's ${kept.join(', ')}`);
  if (hollow && !(s.tempo < host.tempo)) fails.push(`the cross ${row.name} is HOLLOW and not slower than its host`);
  if (!donor.sign || !same(s[donor.sign], donor[donor.sign])) fails.push(`the cross ${row.name} does not have ${KIN[row.cross.donor]}'s own ${donor.sign} in it as it plays it`);
  if (bare(s) === bare(host)) fails.push(`the cross ${row.name} plays its host's piece unchanged`);
}

// ---- every score whole and in bounds
const ROOM = { pad: [110, 880], lead: [196, 1568], pluck: [220, 1760], bass: [90, 330] };
const all = [...scoreNames(), ...rows.filter(r => r.cross)];
for (const ground of all) {
  const s = scoreOf(ground), name = s.name, bad = what => fails.push(`${name}: ${what}`);
  for (const key of ['bpm', 'bar', 'swing', 'tempo', 'root', 'mode', 'chords', 'motif', 'form', 'lift', 'air', 'bright', 'bell', 'level', 'glide']) if (s[key] === undefined || s[key] === null) bad(`has no ${key}`);
  if (typeof ground === 'string' && name !== ground) bad(`is called ${name}`);
  if (!(s.bpm * s.tempo >= 36 && s.bpm * s.tempo <= 125)) bad(`goes at ${s.bpm * s.tempo} a minute`);
  if (![12, 16, 20].includes(s.bar)) bad(`has ${s.bar} steps to a bar`);
  if (!(s.swing >= 0 && s.swing <= 0.3) || !(s.level >= 0.6 && s.level <= 1.3) || !(s.glide >= 1 && s.glide <= 2)) bad(`swings ${s.swing}, is at ${s.level}, glides ${s.glide}`);
  if (!s.chords.length || !s.chords.every(Number.isInteger)) bad(`has chords ${JSON.stringify(s.chords)}`);
  if (!/^A[ABr]*$/.test(s.form)) bad(`has the form ${s.form}`);
  if (!/^[0-9a-f.]*$/.test(s.motif) || s.motif.length > s.bar) bad(`has the motif '${s.motif}'`);
  if (!WAVES.has(s.bell)) bad(`rings its bells in ${s.bell}, which is no wave`);
  if (!VOICES.some(v => s[v])) bad('has no voice');
  for (const v of VOICES) {
    const part = s[v];
    if (!part) continue;
    if (v !== 'perc' && !WAVES.has(part.wave)) bad(`its ${v} is played in ${part.wave}, which is no wave`);
    if (part.pattern !== undefined && !(v === 'perc' ? /^[shwd.]+$/ : /^[0-9a-f.]+$/).test(part.pattern)) bad(`its ${v}'s pattern '${part.pattern}' has a letter it does not read`);
    if (v === 'perc' ? !(part.gain > 0 && part.gain <= 1.2) : !(part.gain > 0 && part.gain <= 0.03)) bad(`its ${v} is at ${part.gain}`);
    if (part.vib && !(part.vib[0] >= 0.05 && part.vib[0] <= 32 && part.vib[1] >= 0 && part.vib[1] <= 40)) bad(`its ${v} sways at ${part.vib}`);
  }
  if (s.lead && !(s.lead.range[0] <= s.lead.range[1] && s.lead.grid >= 1)) bad(`its lead wanders over ${s.lead.range} every ${s.lead.grid}`);
  for (const p of phrasesOf(ground)) {
    const [lo, hi] = ROOM[p.voice], top = p.voice === 'pluck' ? hi / s.glide : hi;
    if (!p.hz.every(f => f >= lo - 1e-6 && f <= top + 1e-6)) bad(`its ${p.voice}${p.motif ? '\'s motif' : ''} sounds at ${p.hz.map(Math.round).join(', ')} Hz, outside ${lo} to ${Math.round(top)}`);
    if (p.voice === 'pad' && !(p.hz[1] + s.pad.spread <= 2000)) bad(`its pads reach ${p.hz[1] + s.pad.spread} Hz`);
    for (let k = 1; k < p.degrees.length; k++) if (Math.sign(p.degrees[k] - p.degrees[k - 1]) !== Math.sign(Math.round(1e6 * (p.hz[k] - p.hz[k - 1])))) { bad(`its ${p.voice}${p.motif ? '\'s motif' : ''} ${p.degrees.join(' ')} does not keep its shape: ${p.hz.map(Math.round).join(', ')} Hz`); break; }
  }
}

console.log(fails.length ? `DEFECT: ${fails.slice(0, 30).join('\n        ')}` : `ok: ${rows.length} grounds each play their own piece (${scoreNames().length} made by hand, ${rows.filter(r => r.cross).length} crosses made of them), the nine main ones apart, every score whole and every phrase in its voice's room and its own shape`);
process.exit(fails.length ? 1 : 0);
