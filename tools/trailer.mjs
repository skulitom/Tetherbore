// Remakes the Steam screenshots and the gameplay trailer from the real game (store/media/README.md says what each is).
//   node tools/trailer.mjs film [id,id]     the footage: every shot in store/media/shots.mjs, 1080p60 lossless, with its sound
//   node tools/trailer.mjs score            the game's own music for the cut
//   node tools/trailer.mjs stills           the screenshots, into store/media/screenshots/
//   node tools/trailer.mjs cut              the mix, the cards and the edit: Cutbolt exports store/media/out/tetherbore-trailer.mp4
//   node tools/trailer.mjs check            export.review and measurements of the MP4
//   node tools/trailer.mjs all
// Footage and other work go to TRAILER_WORK (default store/media/out/work), which git ignores. Needs ffmpeg on the PATH,
// Edge or Chrome, and release builds of Cutbolt and Inkbolt (the CUTBOLT and INKBOLT variables, or sibling checkouts).
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { openGame, root } from './trailer-rig.mjs';
import { SHOTS, CUT, STILLS, SFX_DB, MUSIC_DB, STING_DB, DUCK } from '../store/media/shots.mjs';

export const WORK = path.resolve(process.env.TRAILER_WORK ?? path.join(root, 'store/media/out/work'));
const [, , stage = 'help', arg] = process.argv;

export const run = (program, args, { input } = {}) => new Promise((resolve, reject) => {
  const child = spawn(program, args, { stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] }), out = [], err = [];
  child.stdout.on('data', d => out.push(d)); child.stderr.on('data', d => err.push(d));
  child.on('error', reject);
  child.on('exit', code => code ? reject(new Error(`${path.basename(program)} failed (${code}): ${Buffer.concat(err).toString().slice(-1500)}`)) : resolve(Buffer.concat(out).toString() + Buffer.concat(err).toString()));
  if (input) child.stdin.end(input);
});

// ---------------------------------------------------------------- the footage
async function filmShot(id) {
  const shot = SHOTS[id], dir = path.join(WORK, 'shots');
  await mkdir(dir, { recursive: true });
  const game = await openGame({ query: shot.query, seconds: shot.seconds + 0.5 });
  try {
    await game.evaluate(`import('./js/shop.js').then(m => { window.__shop = m; window.__plan = ${JSON.stringify(shot.plan)}; return 1; })`);
    await game.evaluate(await readFile(path.join(root, 'tools/trailer-pilot.js'), 'utf8') + ';1');
    const video = path.join(dir, `${id}.mkv`);
    const ffmpeg = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '60', '-c:v', 'png', '-i', '-', '-c:v', 'ffv1', '-level', '3', '-g', '1', '-slices', '12', '-pix_fmt', 'bgr0', video], { stdio: ['pipe', 'ignore', 'inherit'] });
    const done = new Promise((resolve, reject) => ffmpeg.on('exit', code => code ? reject(new Error(`ffmpeg ${code}`)) : resolve()));
    const frames = Math.round(shot.seconds * 60);
    for (let f = 0; f < frames; f++) {
      await game.evaluate('__film.step()');
      if (!ffmpeg.stdin.write(await game.grab())) await new Promise(resolve => ffmpeg.stdin.once('drain', resolve));
    }
    ffmpeg.stdin.end();
    await done;
    const log = JSON.parse(await game.evaluate('JSON.stringify({ hauls: __film.log, errors: __film.errors })'));
    if (log.errors.length || game.problems.length) throw new Error(`${id}: the page went wrong: ${[...log.errors, ...game.problems].join('; ').slice(0, 600)}`);
    // Frame f of the film is the picture after step f + 1, and its sound starts at that step's time.
    const pcm = await game.pcm();
    await writeFile(path.join(dir, `${id}.f32`), pcm.subarray(800 * 8, 800 * 8 + frames * 800 * 8));
    await writeFile(path.join(dir, `${id}.json`), JSON.stringify({ id, frames, hauls: log.hauls.map(h => ({ ...h, f: h.f - 1 })) }));
    console.log(id, frames, 'frames;', log.hauls.filter(h => h.n >= 10).map(h => `${h.title} ${h.n} at ${h.f - 1}`).join(', ') || 'no haul');
  } finally { await game.close(); }
}
async function film(only) {
  const ids = only ? only.split(',') : Object.keys(SHOTS), queue = [...ids], failed = [];
  await Promise.all(Array.from({ length: Math.min(5, ids.length) }, async () => {
    for (let id; (id = queue.shift());) { try { await filmShot(id); } catch (error) { failed.push(id); console.error(`${id}: ${error.message}`); } }
  }));
  if (failed.length) throw new Error(`not filmed: ${failed.join(', ')}`);
}

// ---------------------------------------------------------------- the music
export async function renderScore(name, plan, seconds, cues = []) {
  const game = await openGame({ query: 'shot&seed=7', seconds: seconds + 0.25 });
  try {
    await game.evaluate(`__film.score(${JSON.stringify(plan)}, ${seconds}, ${JSON.stringify(cues)})`);
    const errors = JSON.parse(await game.evaluate('JSON.stringify(__film.errors)'));
    if (errors.length) throw new Error(errors.join('; '));
    const pcm = await game.pcm(), file = path.join(WORK, `${name}.f32`);
    await mkdir(WORK, { recursive: true });
    await writeFile(file, pcm.subarray(0, Math.round(seconds * 48000) * 8));
    return file;
  } finally { await game.close(); }
}

// The piece the trailer is cut to, a bar's length, and how far into its render the first bar of the cut lies (the band
// takes a moment to come up, so the cut starts on its second bar; the band's first step is at 0.05 s).
const SCORE = 'redrock', BEAT = 60 / 92, BAR = BEAT * 4, MUSIC_AT = 0.05 + BAR;
async function score() {
  await renderScore('music', [[0, SCORE, 300]], MUSIC_AT + BAR * 30);
  // What lands with the logo: the game's own haul sounds, a giant's.
  await renderScore('sting', [], 5, [[0.05, 'crack', 1200, 0], [0.05, 'thump', 1200], [0.42, 'stamp', 1200]]);
}

// ---------------------------------------------------------------- the cards: the game's own lettering, placed by Inkbolt
// (A sibling checkout, looked for up the tree so that this also runs from a worktree.)
const sibling = (...parts) => {
  for (let dir = root; ; dir = path.dirname(dir)) {
    if (existsSync(path.join(dir, ...parts))) return path.join(dir, ...parts);
    if (path.dirname(dir) === dir) return null;
  }
};
const exe = process.platform === 'win32' ? '.exe' : '';
const INKBOLT = process.env.INKBOLT ?? sibling('Inkbolt', 'target', 'release', `inkbolt${exe}`) ?? 'inkbolt';
async function ink(work, request) {
  const reply = JSON.parse(await run(INKBOLT, ['--workspace', work], { input: JSON.stringify(request) }));
  if (!reply.ok) throw new Error(`inkbolt ${request.command}: ${JSON.stringify(reply.error)}`);
  return reply.result;
}
async function cards() {
  const work = path.join(WORK, 'cards');
  await rm(work, { recursive: true, force: true });   // (Inkbolt will not write over a file)
  await mkdir(work, { recursive: true });
  const words = { cut: ['CUT', 5, '#ffffff'], loop: ['LOOP', 5, '#ffffff'], reel: ['REEL', 5, '#ffe14a'], wish: ['WISHLIST ON STEAM', 3, '#ffe14a'] };
  const page = await openGame({ query: 'shot&seed=7', seconds: 1 }), sizes = {};
  try {
    for (const [name, [said, scale, colour]] of Object.entries(words)) {
      const got = JSON.parse(await page.evaluate(`import('./js/atlas.js').then(({ text, textWidth }) => { const c = document.createElement('canvas'); c.width = textWidth(${JSON.stringify(said)}, ${scale}) + ${scale} * 2; c.height = 11 * ${scale}; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; text(x, ${JSON.stringify(said)}, ${scale}, 1, ${JSON.stringify(colour)}, 0, ${scale}); return JSON.stringify({ w: c.width, h: c.height, png: c.toDataURL('image/png').split(',')[1] }); })`));
      await writeFile(path.join(work, `${name}.png`), Buffer.from(got.png, 'base64'));
      sizes[name] = got;
    }
  } finally { await page.close(); }
  await copyFile(path.join(root, 'store/art/library_logo.png'), path.join(work, 'logo.png'));
  const asset = async file => (await ink(work, { command: 'asset.import', source_path: file, color_policy: 'assume_srgb' })).asset;
  const compose = async (id, layers) => {
    const assets = {}, items = [];
    for (const [n, l] of layers.entries()) {
      assets[`a${n}`] = await asset(l.file);
      items.push({ id: `layer-${n}`, content: { type: 'image', asset_id: `a${n}`, width: l.w, height: l.h, sampling: 'nearest' }, transform: [1, 0, 0, 1, l.x, l.y] });
    }
    await ink(work, { command: 'document.publish', document: { schema_version: 2, id, kind: 'raster', width: 1920, height: 1080, color_space: 'srgb', revision: 0, assets, items }, output: { file_name: `${id}.png`, format: 'png', render_options: { evaluation: 'tiled' } } });
  };
  // A word of the verb: three of the game's pixels to one of its own, low and in the middle, clear of the bar.
  for (const name of ['cut', 'loop', 'reel']) {
    const { w, h } = sizes[name];
    await compose(`word-${name}`, [{ file: `${name}.png`, w: w * 3, h: h * 3, x: Math.round((1920 - w * 3) / 2), y: 790 }]);
  }
  const wish = sizes.wish;
  await compose('end', [{ file: 'logo.png', w: 1280, h: 256, x: 320, y: 330 }, { file: 'wish.png', w: wish.w * 3, h: wish.h * 3, x: Math.round((1920 - wish.w * 3) / 2), y: 650 }]);
}

// ---------------------------------------------------------------- the edit
const f32 = async file => { const b = await readFile(file); return new Float32Array(b.buffer, b.byteOffset, b.length >> 2); };
// Where each clip of the cut lies: its frames in the timeline (on the beat) and in its shot.
async function layout() {
  const clips = [];
  let beat = 0;
  for (const [n, c] of CUT.entries()) {
    const start = Math.round(beat * BEAT * 60), end = Math.round((beat + c.beats) * BEAT * 60), frames = end - start;
    const meta = JSON.parse(await readFile(path.join(WORK, 'shots', `${c.shot}.json`), 'utf8'));
    const big = meta.hauls.reduce((a, h) => (!a || h.n > a.n ? h : a), null);
    const from = (c.haul ? (big?.f ?? 0) : 0) + (c.at ?? 0);
    if (from < 0 || from + frames > meta.frames) throw new Error(`clip ${n} (${c.shot}): frames ${from} to ${from + frames} are not in a shot of ${meta.frames}`);
    clips.push({ ...c, n, id: `c${String(n).padStart(2, '0')}-${c.shot}`, start, frames, from });
    beat += c.beats;
  }
  return { clips, frames: clips.at(-1).start + clips.at(-1).frames };
}
const dB = x => 10 ** (x / 20);
// The sound of the cut, from the game's own: its music under the sounds of each shot as filmed, the music stepped back
// a little under them, and a limiter on the whole. Written as float; the level is settled by measuring it.
async function mix({ clips, frames }, trim) {
  const L = frames * 800, music = await f32(path.join(WORK, 'music.f32')), sting = await f32(path.join(WORK, 'sting.f32')), fx = new Float32Array(L * 2), bed = new Float32Array(L * 2), out = new Float32Array(L * 2);
  for (const c of clips) {
    if (c.mute) continue;
    const sound = await f32(path.join(WORK, 'shots', `${c.shot}.f32`)), n = c.frames * 800, at = c.start * 800, from = c.from * 800, edge = 192, gain = dB(SFX_DB + (c.db ?? 0));
    for (let i = 0; i < n; i++) {
      const fade = Math.min(1, (i + 1) / edge, (n - i) / edge) * gain;
      fx[(at + i) * 2] += sound[(from + i) * 2] * fade; fx[(at + i) * 2 + 1] += sound[(from + i) * 2 + 1] * fade;
    }
  }
  const end = clips.find(c => c.end), stingAt = end.start * 800;
  for (let i = 0; i < sting.length >> 1 && stingAt + i < L; i++) { fx[(stingAt + i) * 2] += sting[i * 2] * dB(STING_DB); fx[(stingAt + i) * 2 + 1] += sting[i * 2 + 1] * dB(STING_DB); }
  // The music steps back as the sounds rise: at most DUCK dB, quick down, slow up.
  const offset = Math.round(MUSIC_AT * 48000), attack = Math.exp(-1 / (0.006 * 48000)), release = Math.exp(-1 / (0.28 * 48000)), tail = L - Math.round(2.4 * 48000);
  let env = 0;
  for (let i = 0; i < L; i++) {
    const level = Math.max(Math.abs(fx[i * 2]), Math.abs(fx[i * 2 + 1]));
    env = level > env ? attack * env + (1 - attack) * level : release * env + (1 - release) * level;
    const duck = dB(-DUCK * Math.min(1, env / 0.35)), fade = i > tail ? Math.max(0, 1 - (i - tail) / (L - tail)) ** 1.5 : 1, m = dB(MUSIC_DB) * duck * fade;
    bed[i * 2] = (music[(offset + i) * 2] ?? 0) * m; bed[i * 2 + 1] = (music[(offset + i) * 2 + 1] ?? 0) * m;
    out[i * 2] = fx[i * 2] + bed[i * 2];
    out[i * 2 + 1] = fx[i * 2 + 1] + bed[i * 2 + 1];
  }
  // A limiter with 4 ms of lookahead, its ceiling under full level, after the trim that sets the loudness.
  const look = 192, ceiling = dB(-1.6), rel = Math.exp(-1 / (0.09 * 48000)), need = new Float32Array(L), done = new Float32Array(L * 2);
  for (let i = 0; i < L; i++) { const p = Math.max(Math.abs(out[i * 2]), Math.abs(out[i * 2 + 1])) * trim; need[i] = p > ceiling ? ceiling / p : 1; }
  let g = 1, least = 1;
  const window = [];   // (the lowest gain needed in the next `look` samples: a queue of candidates)
  for (let i = 0; i < L; i++) {
    const j = Math.min(L - 1, i + look);
    while (window.length && need[window.at(-1)] >= need[j]) window.pop();
    window.push(j);
    while (window[0] < i) window.shift();
    const want = need[window[0]];
    g = want < g ? Math.max(want, g - (1 - want) / look * 1.5) : rel * g + (1 - rel) * want;
    const applied = Math.min(g, need[i]);
    least = Math.min(least, applied);
    done[i * 2] = out[i * 2] * trim * applied; done[i * 2 + 1] = out[i * 2 + 1] * trim * applied;
  }
  return { done, fx, bed, reduction: -20 * Math.log10(least) };
}
const loudness = async file => {
  const said = await run('ffmpeg', ['-hide_banner', '-nostats', '-f', 'f32le', '-ar', '48000', '-ac', '2', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const tail = said.split('Summary:').at(-1);
  return { lufs: +tail.match(/I:\s*(-?[\d.]+) LUFS/)[1], peak: +tail.match(/Peak:\s*(-?[\d.]+) dBFS/)[1] };
};
const CUTBOLT = process.env.CUTBOLT ?? sibling('Cutbolt', 'target', 'release', `cutbolt${exe}`) ?? 'cutbolt';
async function bolt(request) {
  const file = path.join(WORK, 'request.json');
  await writeFile(file, JSON.stringify(request));
  const child = await new Promise((resolve, reject) => { const p = spawn(CUTBOLT, [file], { stdio: ['ignore', 'pipe', 'pipe'] }), out = []; p.stdout.on('data', d => out.push(d)); p.stderr.on('data', () => {}); p.on('error', reject); p.on('exit', () => resolve(Buffer.concat(out).toString())); });
  const reply = JSON.parse(child);
  if (!reply.ok) throw new Error(`cutbolt ${request.command}: ${JSON.stringify(reply.error).slice(0, 1200)}`);
  return reply.result;
}
const OUT = path.join(root, 'store/media/out'), MP4 = path.join(OUT, 'tetherbore-trailer.mp4');
async function cut() {
  await cards();
  const plan = await layout(), { clips, frames } = plan, audioFile = path.join(WORK, 'mix.f32');
  // The level: trimmed until the whole measures -14 LUFS through its limiter.
  let trim = 1, got = null, sound = null;
  for (let pass = 0; pass < 6; pass++) {
    const mixed = await mix(plan, trim);
    sound = mixed.done;
    await writeFile(audioFile, Buffer.from(sound.buffer));
    got = await loudness(audioFile);
    console.log(`mix pass ${pass}: trim ${(20 * Math.log10(trim)).toFixed(2)} dB, ${got.lufs} LUFS, true peak ${got.peak} dBFS, limiter at most ${mixed.reduction.toFixed(1)} dB`);
    if (Math.abs(got.lufs + 14) < 0.15) {
      // (How the two halves of the mix stand to each other, each at the level it has in the whole.)
      for (const [name, stem] of [['sounds', mixed.fx], ['music', mixed.bed]]) {
        const file = path.join(WORK, `stem-${name}.f32`), scaled = stem.map(x => x * trim);
        await writeFile(file, Buffer.from(scaled.buffer));
        const level = await loudness(file);
        console.log(`  ${name}: ${level.lufs} LUFS, peak ${level.peak} dBFS`);
        await rm(file);
      }
      break;
    }
    trim *= dB(-14 - got.lufs);
  }
  const dir = path.join(WORK, 'clips');
  await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true });
  const toPcm = (from, n) => { const b = Buffer.alloc(n * 4); for (let i = 0; i < n * 2; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sound[from * 2 + i] * 32767))), i * 2); return b; };
  const makeClip = async c => {
    const wav = path.join(dir, `${c.id}.pcm`), file = path.join(dir, `${c.id}.mkv`), n = c.frames * 800;
    await writeFile(wav, toPcm(c.start * 800, n));
    const input = ['-i', path.join(WORK, 'shots', `${c.shot}.mkv`)], trimmed = `trim=start_frame=${c.from}:end_frame=${c.from + c.frames},setpts=PTS-STARTPTS`;
    let graph, extra = [];
    if (c.end) {
      // The end card over the station, dimmed: it comes up over half a second.
      extra = ['-loop', '1', '-framerate', '60', '-i', path.join(WORK, 'cards', 'end.png')];
      graph = `[0:v]${trimmed},format=rgba[bg];color=c=0x0c0a12:s=1920x1080:r=60,format=rgba,colorchannelmixer=aa=0.93,fade=in:st=0:d=0.45:alpha=1[dim];[bg][dim]overlay=shortest=1[under];[1:v]format=rgba,fade=in:st=0.15:d=0.45:alpha=1[card];[under][card]overlay=shortest=1,format=bgr0[v]`;
    } else if (c.word) {
      extra = ['-loop', '1', '-framerate', '60', '-i', path.join(WORK, 'cards', `word-${c.word}.png`)];
      graph = `[0:v]${trimmed}[bg];[1:v]format=rgba,fade=in:st=0.05:d=0.12:alpha=1[card];[bg][card]overlay=shortest=1,format=bgr0[v]`;
    } else graph = `[0:v]${trimmed},format=bgr0[v]`;
    const audioIndex = extra.length ? 2 : 1;
    await run('ffmpeg', ['-y', '-loglevel', 'error', ...input, ...extra, '-f', 's16le', '-ar', '48000', '-ac', '2', '-i', wav, '-filter_complex', graph, '-map', '[v]', '-map', `${audioIndex}:a`, '-frames:v', String(c.frames), '-r', '60', '-c:v', 'ffv1', '-level', '3', '-g', '1', '-slices', '12', '-pix_fmt', 'bgr0', '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2', file]);
    await rm(wav);
    return file;
  };
  const queue = [...clips];
  await Promise.all(Array.from({ length: 5 }, async () => { for (let c; (c = queue.shift());) await makeClip(c); }));
  // The edit: one sequential timeline at 60 fps, exported by Cutbolt.
  let project = await bolt({ command: 'project.create', id: 'tetherbore-trailer', width: 1920, height: 1080, frame_rate: { num: 60, den: 1 } });
  const ops = [];
  for (const c of clips) {
    const duration = { num: c.frames, den: 60 };
    ops.push({ op: 'media.add', asset: { id: c.id, path: `${c.id}.mkv`, duration } }, { op: 'clip.append', clip: { id: c.id, asset_id: c.id, source_in: { num: 0, den: 1 }, duration } });
  }
  project = await bolt({ command: 'timeline.apply', project, expected_revision: project.revision, operations: ops });
  project = project.project ?? project;
  await writeFile(path.join(WORK, 'project.json'), JSON.stringify(project));
  await mkdir(OUT, { recursive: true });
  await rm(MP4, { force: true });
  const receipt = await bolt({ command: 'export.run', project, input_root: dir, output_root: OUT, output: MP4, profile: 'h264_aac', streams: 'audio_video', input_transfer: 'bt709' });
  await writeFile(path.join(WORK, 'export-receipt.json'), JSON.stringify(receipt, null, 1));
  const times = clips.map(c => `${(c.start / 60).toFixed(2).padStart(6)}  ${(c.frames / 60).toFixed(2)} s  ${c.shot}${c.word ? ` [${c.word.toUpperCase()}]` : ''}${c.end ? ' [end card]' : ''}  ${c.note ?? ''}`);
  await writeFile(path.join(WORK, 'shotlist.txt'), times.join('\n') + '\n');
  console.log(times.join('\n'));
  console.log(MP4, (frames / 60).toFixed(3), 's');
}

// ---------------------------------------------------------------- the screenshots
async function stills() {
  const dir = path.join(root, 'store/media/screenshots');
  await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true });
  for (const [n, s] of STILLS.entries()) {
    const meta = JSON.parse(await readFile(path.join(WORK, 'shots', `${s.shot}.json`), 'utf8'));
    const big = meta.hauls.reduce((a, h) => (!a || h.n > a.n ? h : a), null), frame = (s.haul ? big.f : 0) + (s.at ?? 0);
    const file = path.join(dir, `${String(n + 1).padStart(2, '0')}-${s.name}.png`);
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(WORK, 'shots', `${s.shot}.mkv`), '-vf', `select=eq(n\\,${frame})`, '-frames:v', '1', '-pix_fmt', 'rgb24', '-compression_level', '9', file]);
    console.log(path.basename(file), 'frame', frame);
  }
}

// ---------------------------------------------------------------- the check
async function check() {
  const project = JSON.parse(await readFile(path.join(WORK, 'project.json'), 'utf8')), output = path.join(WORK, `review-${Date.now()}`), jobs = path.join(WORK, 'jobs');
  await mkdir(jobs, { recursive: true });
  const ticket = await bolt({ command: 'job.start', job_root: jobs, request_id: `review-${Date.now()}`, run: 'export.review', arguments: { path: MP4, input_root: OUT, output_root: WORK, output, project, frames: 24 } });
  const job_id = ticket.job_id ?? ticket.id ?? ticket.job?.id;
  let done = null;
  for (let tries = 0; tries < 10; tries++) {
    done = await bolt({ command: 'job.wait', job_root: jobs, job_id, timeout_seconds: 120 });
    if (!/queued|running|pending/i.test(String(done.status ?? done.job?.status ?? done.state ?? ''))) break;
  }
  await writeFile(path.join(WORK, 'review-result.json'), JSON.stringify(done, null, 1));
  const review = JSON.parse(await readFile(path.join(output, 'review.json'), 'utf8'));
  console.log(output);
  console.log(review.summary ?? JSON.stringify(review).slice(0, 1500));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.join(root, 'tools', 'trailer.mjs')) {
  try {
    if (stage === 'film' || stage === 'all') await film(stage === 'film' ? arg : undefined);
    if (stage === 'score' || stage === 'all') await score();
    if (stage === 'stills' || stage === 'all') await stills();
    if (stage === 'cut' || stage === 'all') await cut();
    if (stage === 'check' || stage === 'all') await check();
    if (!['film', 'score', 'stills', 'cut', 'check', 'all'].includes(stage)) console.log('node tools/trailer.mjs film [ids] | score | stills | cut | check | all');
    process.exit(0);
  } catch (error) { console.error(error.message); process.exit(1); }
}
