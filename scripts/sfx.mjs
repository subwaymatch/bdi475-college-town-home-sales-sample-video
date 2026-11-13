#!/usr/bin/env node
// Generates the sound effects in sfx.json with ElevenLabs text to sound.
//
//   node scripts/sfx.mjs            generate new or changed sounds
//   node scripts/sfx.mjs --dry-run  list what would be generated
//   node scripts/sfx.mjs --force    regenerate every sound
//
// The API key is read from ELEVENLABS_API_KEY and sent in the xi-api-key header.
//
// Output: assets/sfx/<name>.mp3 (leading silence trimmed, peak at -3 dBFS, a short fade at the
// end) and assets/sfx/manifest.json (kind, volume, duration and a hash of what made each one).
// The scenes decide where sounds go (see Scene.cue in lib/kit.mjs); build.mjs places them.

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'sfx.json'), 'utf8'));
const OUT = path.join(ROOT, 'assets', 'sfx');
const MANIFEST = path.join(OUT, 'manifest.json');
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : { sounds: {} };

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const PROMPT_INFLUENCE = 0.6;

const hashOf = (s) => crypto.createHash('sha256').update(JSON.stringify([spec.model, PROMPT_INFLUENCE, s.prompt, s.seconds])).digest('hex').slice(0, 16);
const names = Object.keys(spec.sounds);
const todo = names.filter((k) => force || manifest.sounds[k]?.hash !== hashOf(spec.sounds[k]) || !fs.existsSync(path.join(OUT, `${k}.mp3`)));
console.log(`${todo.length} of ${names.length} sounds to generate with ${spec.model}`);
if (dryRun) {
  for (const k of todo) console.log(`  ${k}: ${spec.sounds[k].prompt}`);
  process.exit(0);
}

fs.mkdirSync(OUT, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sfx-'));
const duration = (file) => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim();
// The length of the decoded audio, without the MP3 encoder's padding (what the renderer plays).
const decoded = (file) => execFileSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-f', 's16le', '-ac', '1', '-ar', '44100', '-'], { maxBuffer: 1 << 26 }).length / 2 / 44100;

for (const k of todo) {
  const s = spec.sounds[k];
  process.stdout.write(`  ${k} ... `);
  const raw = path.join(tmp, `${k}.raw.mp3`);
  const bodyFile = path.join(tmp, `${k}.json`);
  fs.writeFileSync(bodyFile, JSON.stringify({ text: s.prompt, duration_seconds: s.seconds, prompt_influence: PROMPT_INFLUENCE, model_id: spec.model }));
  const headers = ['-H', 'Content-Type: application/json'];
  if (process.env.ELEVENLABS_API_KEY) headers.push('-H', `xi-api-key: ${process.env.ELEVENLABS_API_KEY}`);
  const url = 'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128';
  const status = execFileSync('curl', ['-sS', '-o', raw, '-w', '%{http_code}', '-X', 'POST', url, ...headers, '--data-binary', `@${bodyFile}`], { encoding: 'utf8' }).trim();
  if (status !== '200') throw new Error(`ElevenLabs answered ${status} for ${k}: ${fs.readFileSync(raw, 'utf8').slice(0, 400)}`);
  // Trim leading silence so the sound lands on its cue, then set the peak to -3 dBFS.
  const trimmed = path.join(tmp, `${k}.wav`);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', raw, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB', '-ac', '1', '-ar', '44100', trimmed]);
  const det = execFileSync('sh', ['-c', `ffmpeg -i "${trimmed}" -af volumedetect -f null - 2>&1 | grep max_volume`], { encoding: 'utf8' });
  const peak = +det.match(/max_volume: (-?[\d.]+)/)[1];
  const len = duration(trimmed);
  const fade = Math.min(0.15, len / 4);
  const out = path.join(OUT, `${k}.mp3`);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', trimmed, '-af', `volume=${(-3 - peak).toFixed(2)}dB,afade=t=out:st=${(len - fade).toFixed(3)}:d=${fade.toFixed(3)}`, '-b:a', '128k', out]);
  manifest.sounds[k] = { file: `assets/sfx/${k}.mp3`, hash: hashOf(s) };
  console.log(`${decoded(out).toFixed(2)} s`);
}
for (const k of Object.keys(manifest.sounds)) {
  if (!spec.sounds[k]) delete manifest.sounds[k];
  else Object.assign(manifest.sounds[k], { kind: spec.sounds[k].kind, volume: spec.sounds[k].volume, duration: +(decoded(path.join(ROOT, manifest.sounds[k].file)) - 0.005).toFixed(3) });
}
manifest.model = spec.model;
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n');
fs.rmSync(tmp, { recursive: true, force: true });
console.log('Done. Run npm run build to place them.');
