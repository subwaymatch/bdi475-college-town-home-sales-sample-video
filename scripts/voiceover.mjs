#!/usr/bin/env node
// Generates the voiceover with ElevenLabs text to speech, one clip per scene, from narration.json.
//
//   node scripts/voiceover.mjs            generate new or changed lines, then fit scene durations
//   node scripts/voiceover.mjs --dry-run  show what would be generated and the character count
//   node scripts/voiceover.mjs --force    regenerate every line
//
// The API key is read from ELEVENLABS_API_KEY and sent in the xi-api-key header. In a session
// whose network proxy adds the key itself, leave the variable unset.
//
// Output: assets/voice/<scene id>.mp3 (loudness evened out to -16 LUFS) and
// assets/voice/manifest.json (duration and a hash of what produced each clip, so unchanged lines
// are not paid for twice). A scene shorter than its line plus a short lead-in and tail is
// lengthened in scenes.json; scenes are never shortened.

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const narration = read('narration.json');
const scenesFile = read('scenes.json');
const OUT = path.join(ROOT, 'assets', 'voice');
const MANIFEST = path.join(OUT, 'manifest.json');
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : { clips: {} };

export const LEAD = 0.45; // seconds from scene start to the first word
export const TAIL = 0.75; // seconds of quiet after the last word, before the scene ends

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');

const voice = narration.voice;
const settings = { stability: 0.5, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true };
const ids = scenesFile.scenes.map((s) => s.id).filter((id) => narration.lines[id]);
for (const id of Object.keys(narration.lines)) {
  if (!scenesFile.scenes.some((s) => s.id === id)) throw new Error(`narration.json has a line for ${id}, which is not in scenes.json`);
}

// Writing rules apply to narration too: no em or en dashes, no arrows or decorative symbols.
for (const [id, text] of Object.entries(narration.lines)) {
  if (/[–—←-⇿]/.test(text)) throw new Error(`Line ${id} breaks the writing rules`);
}

const hashOf = (text) => crypto.createHash('sha256').update(JSON.stringify([voice.id, voice.model, settings, text])).digest('hex').slice(0, 16);
const todo = ids.filter((id) => force || manifest.clips[id]?.hash !== hashOf(narration.lines[id]) || !fs.existsSync(path.join(OUT, `${id}.mp3`)));
const chars = todo.reduce((n, id) => n + narration.lines[id].length, 0);
console.log(`${todo.length} of ${ids.length} lines to generate (${chars} characters) with ${voice.name} (${voice.id}), ${voice.model}`);
if (dryRun) {
  for (const id of todo) console.log(`  ${id}: ${narration.lines[id]}`);
  process.exit(0);
}

fs.mkdirSync(OUT, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-'));

function tts(id) {
  const i = ids.indexOf(id);
  const body = {
    text: narration.lines[id],
    model_id: voice.model,
    voice_settings: settings,
    // Neighbouring lines help the voice keep a steady tone from scene to scene.
    previous_text: i > 0 ? narration.lines[ids[i - 1]] : undefined,
    next_text: i < ids.length - 1 ? narration.lines[ids[i + 1]] : undefined,
  };
  const raw = path.join(tmp, `${id}.raw.mp3`);
  const bodyFile = path.join(tmp, `${id}.json`);
  fs.writeFileSync(bodyFile, JSON.stringify(body));
  const headers = ['-H', 'Content-Type: application/json', '-H', 'Accept: audio/mpeg'];
  if (process.env.ELEVENLABS_API_KEY) headers.push('-H', `xi-api-key: ${process.env.ELEVENLABS_API_KEY}`);
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice.id}?output_format=mp3_44100_128`;
  // curl, not fetch: it follows the HTTPS proxy settings of the machine.
  const status = execFileSync('curl', ['-sS', '-o', raw, '-w', '%{http_code}', '-X', 'POST', url, ...headers, '--data-binary', `@${bodyFile}`], { encoding: 'utf8' }).trim();
  if (status !== '200') {
    const msg = fs.existsSync(raw) ? fs.readFileSync(raw, 'utf8').slice(0, 400) : '';
    throw new Error(`ElevenLabs answered ${status} for ${id}: ${msg}`);
  }
  // Even out loudness so every scene sounds the same level.
  const out = path.join(OUT, `${id}.mp3`);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', raw, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '44100', '-ac', '1', '-b:a', '160k', out]);
  return out;
}

// The length of the decoded audio, without the MP3 encoder's padding (what the renderer plays).
const duration = (file) => execFileSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-f', 's16le', '-ac', '1', '-ar', '44100', '-'], { maxBuffer: 1 << 28 }).length / 2 / 44100 - 0.005;

// The voice sometimes starts on the next line (it is given as context), or takes a breath, in the
// last few milliseconds, which plays as a sudden cut-off sound. Two checks, in order:
//   1. a short burst after a pause at the very end: end the clip in the pause;
//   2. a clip that still has sound in its last 30 ms: end it at the quietest point of its last
//      half second if that is near silence, or else fade out its last 50 ms.
// Returns a description of what it did, or null. A tidied clip passes both checks, so running
// this again changes nothing.
function tidyTail(file) {
  const pcm = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', '44100', '-'], { maxBuffer: 1 << 28 });
  const x = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4);
  const win = 441; // 10 ms
  const db = [];
  for (let i = 0; i + win <= x.length; i += win) {
    let e = 0;
    for (let j = i; j < i + win; j++) e += x[j] * x[j];
    db.push(10 * Math.log10(e / win + 1e-12));
  }
  const QUIET = -55, LOUD = -45;
  let k = db.length - 1;
  while (k >= 0 && db[k] < QUIET) k--; // skip true silence at the end
  if (k < 0) return false;
  let burst = 0;
  while (k >= 0 && db[k] >= QUIET) { k--; burst++; } // the final sound
  let gap = 0, gapMin = 0;
  while (k >= 0 && db[k] < QUIET) { gapMin = Math.min(gapMin, db[k]); k--; gap++; } // the pause before it
  const peak = Math.max(...db.slice(k + gap + 1));
  const write = (af) => {
    const tmpOut = file.replace(/\.mp3$/, '.trim.mp3');
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', file, '-af', af, '-ar', '44100', '-ac', '1', '-b:a', '160k', tmpOut]);
    fs.renameSync(tmpOut, file);
  };
  const cutAt = (cut) => write(`atrim=0:${cut.toFixed(3)},afade=t=out:st=${(cut - 0.02).toFixed(3)}:d=0.02`);
  // 1. A burst of at most 120 ms after a pause of at least 30 ms that reaches true silence (a
  // consonant such as the p in "types" leaves a short gap, but not a silent one), loud enough to hear.
  if (burst <= 12 && gap >= 3 && gapMin <= -70 && peak > LOUD && k > 0) {
    cutAt((k + 1 + Math.min(gap, 6)) * 0.01); // keep up to 60 ms of the pause
    return 'removed a cut-off sound at the end';
  }
  // 2. Still sounding at the very end (a breath, or a hiss after the last word).
  const N = db.length;
  if (db[N - 1] <= -62) return null; // the final 10 ms are already quiet
  let m = N - 1;
  for (let i = N - 50; i < N; i++) if (i >= 0 && db[i] < db[m]) m = i;
  if (db[m] <= -70 && m <= N - 4) {
    cutAt((m + 1) * 0.01);
    return 'removed a breath at the end';
  }
  const len = x.length / 44100;
  write(`afade=t=out:st=${(len - 0.05).toFixed(3)}:d=0.05`);
  return 'faded out the end';
}

for (const id of todo) {
  process.stdout.write(`  ${id} ... `);
  const file = tts(id);
  manifest.clips[id] = { file: `assets/voice/${id}.mp3`, duration: +duration(file).toFixed(3), hash: hashOf(narration.lines[id]) };
  console.log(`${manifest.clips[id].duration} s`);
}
for (const id of Object.keys(manifest.clips)) if (!narration.lines[id]) delete manifest.clips[id];
// Durations are measured from the decoded audio, for every clip.
for (const id of ids) if (manifest.clips[id]) manifest.clips[id].duration = +duration(path.join(OUT, `${id}.mp3`)).toFixed(3);
// Check every clip (new or not) for a cut-off sound at the end.
for (const id of ids) {
  const file = path.join(OUT, `${id}.mp3`);
  const done = fs.existsSync(file) && tidyTail(file);
  if (done) {
    manifest.clips[id].duration = +duration(file).toFixed(3);
    console.log(`  ${id}: ${done} (now ${manifest.clips[id].duration} s)`);
  }
}
manifest.voice = voice;
manifest.lead = LEAD;
manifest.tail = TAIL;
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n');
fs.rmSync(tmp, { recursive: true, force: true });

// Fit scenes to their narration: never shorter than lead-in + line + tail, rounded up to 0.5 s.
let changed = 0;
for (const s of scenesFile.scenes) {
  const clip = manifest.clips[s.id];
  if (!clip) continue;
  const need = Math.ceil((LEAD + clip.duration + TAIL) * 2) / 2;
  if (s.duration < need) {
    console.log(`  ${s.id}: ${s.duration} s to ${need} s to fit the narration`);
    s.duration = need;
    changed++;
  }
}
if (changed) {
  fs.writeFileSync(path.join(ROOT, 'scenes.json'), JSON.stringify(scenesFile, null, 2) + '\n');
  console.log(`${changed} scene(s) lengthened. Run npm run build to rewrite the starts and index.html.`);
} else {
  console.log('Every scene already fits its narration.');
}
