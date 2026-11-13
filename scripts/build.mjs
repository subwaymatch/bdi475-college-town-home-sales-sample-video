#!/usr/bin/env node
// Writes the HyperFrames project from scenes.json, scripts/scenes.mjs and captures/manifest.json:
//   index.html             the root: one host per scene, start and duration from scenes.json
//   compositions/<id>.html one file per scene
//   docs/on-screen-text.md every line of on-screen text, by scene (for review and narration)
//
//   node scripts/build.mjs
//
// Re-run after changing scenes.json, scripts/scenes.mjs, video.config.json or the captures.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Scene, finish, FONTS_CSS, C } from './lib/kit.mjs';
import { scenes as defs, exampleNotes } from './scenes.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const config = read('video.config.json');
const list = read('scenes.json');
const manifest = read('captures/manifest.json');

// Starts follow from the durations, so changing one duration moves every later scene.
let t = 0;
for (const s of list.scenes) {
  if (!defs[s.id]) throw new Error(`scenes.json lists ${s.id}, but scripts/scenes.mjs has no scene with that id`);
  s.start = +t.toFixed(3);
  t += s.duration;
}
const total = +t.toFixed(3);
// Keep scenes.json readable: id, title, start, duration in that order.
list.scenes = list.scenes.map(({ id, title, start, duration }) => ({ id, title, start, duration }));
list.total = total;
fs.writeFileSync(path.join(ROOT, 'scenes.json'), JSON.stringify(list, null, 2).replace(/\{\n\s+("id")/g, '{ $1').replace(/,\n\s+("title"|"start"|"duration")/g, ', $1').replace(/\n\s+\}/g, ' }') + '\n');

fs.mkdirSync(path.join(ROOT, 'compositions'), { recursive: true });
const copy = [];
const warnings = [];
const cues = []; // sound effect cues from every scene, in video time
for (const s of list.scenes) {
  const def = defs[s.id];
  const scene = new Scene({ id: s.id, duration: s.duration, base: def.base, manifest });
  def.build(scene);
  for (const w of scene.windows || []) {
    // At 4K each 1080p pixel is 2 device pixels. A capture stays sharp while
    // camera scale x 2 <= its device scale factor.
    const need = (w.camMax || 1) * 2;
    if (w.minDsf && need > w.minDsf + 0.05) warnings.push(`${s.id}: camera zoom ${w.camMax.toFixed(2)} needs scale ${need.toFixed(2)}, capture has ${w.minDsf.toFixed(2)}`);
  }
  for (const c of scene.sfx) cues.push({ t: +(s.start + c.t).toFixed(3), kind: c.kind, scene: s.id });
  fs.writeFileSync(path.join(ROOT, 'compositions', `${s.id}.html`), finish(scene));
  copy.push({ id: s.id, title: s.title, start: s.start, duration: s.duration, lines: [...new Set(scene.copy)] });
}

// Example notes: overlays that span whole sections, above the scenes.
const overlays = [];
for (const note of exampleNotes) {
  const i0 = list.scenes.findIndex((s) => s.id === note.from);
  const i1 = list.scenes.findIndex((s) => s.id === note.to);
  if (i0 < 0 || i1 < i0) throw new Error(`Example note ${note.id}: bad scene range`);
  const start = list.scenes[i0].start;
  const duration = +(list.scenes[i1].start + list.scenes[i1].duration - start).toFixed(3);
  const scene = new Scene({ id: note.id, duration, manifest });
  scene.transparent = true;
  scene.fadeIn = 0;
  const pid = `${note.id}-p`;
  scene.raw(`<p id="${pid}" class="example" style="position:absolute;left:110px;bottom:216px;width:470px">${note.text}</p>`);
  scene.copy.push(note.text);
  scene.js.push(`tl.fromTo('#${pid}', { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0.6);`);
  fs.writeFileSync(path.join(ROOT, 'compositions', `${note.id}.html`), finish(scene));
  overlays.push({ id: note.id, start, duration });
  copy.push({ id: note.id, title: 'Example note', start, duration, lines: [note.text] });
}

const hosts = list.scenes
  .map(
    (s) => `      <div id="${s.id}" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html" data-start="${s.start}" data-duration="${s.duration}" data-track-index="1" data-track-kind="graphics" data-width="1920" data-height="1080"></div>`,
  )
  .join('\n');
const overlayHosts = overlays
  .map((o) => `      <div id="${o.id}" data-composition-id="${o.id}" data-composition-src="compositions/${o.id}.html" data-start="${o.start}" data-duration="${o.duration}" data-track-index="2" data-track-kind="graphics" data-width="1920" data-height="1080"></div>`)
  .join('\n');

// Voiceover: one clip per scene from assets/voice (made by scripts/voiceover.mjs), starting a
// moment after its scene starts. VOICEOVER: false in video.config.json renders a silent video.
const voiceManifest = path.join(ROOT, 'assets', 'voice', 'manifest.json');
const audioTags = [];
if (config.VOICEOVER !== false && fs.existsSync(voiceManifest)) {
  const vm = JSON.parse(fs.readFileSync(voiceManifest, 'utf8'));
  for (const s of list.scenes) {
    const clip = vm.clips[s.id];
    if (!clip) continue;
    const start = +(s.start + vm.lead).toFixed(3);
    if (vm.lead + clip.duration > s.duration) warnings.push(`${s.id}: narration (${clip.duration} s) runs past the scene; run npm run voiceover to refit`);
    audioTags.push(`      <audio id="vo-${s.id}" class="clip" src="${clip.file}" data-start="${start}" data-duration="${clip.duration}" data-track-index="3" data-volume="1"></audio>`);
  }
}

// Sound effects: quiet sounds on visible actions, from assets/sfx (made by scripts/sfx.mjs).
// Clicks alternate between the click sounds so repeats do not sound mechanical. Each kind has its
// own track, and a sound never runs into the next one on its track. SFX: false turns them off.
const sfxManifest = path.join(ROOT, 'assets', 'sfx', 'manifest.json');
const sfxTags = [];
if (config.SFX !== false && fs.existsSync(sfxManifest)) {
  const sm = JSON.parse(fs.readFileSync(sfxManifest, 'utf8'));
  const byKind = {};
  for (const [name, snd] of Object.entries(sm.sounds)) (byKind[snd.kind] ||= []).push({ name, ...snd });
  const tracks = { click: 4, typing: 5, pencil: 6, whoosh: 6 };
  const lastEnd = {};
  const used = {};
  cues.sort((a, b) => a.t - b.t);
  for (const c of cues) {
    const options = byKind[c.kind];
    if (!options) { warnings.push(`${c.scene}: no sound for ${c.kind}; run npm run sfx`); continue; }
    used[c.kind] = (used[c.kind] || 0) + 1;
    const snd = options[(used[c.kind] - 1) % options.length];
    const track = tracks[c.kind] || 7;
    const end = Math.min(c.t + snd.duration, total);
    const prev = lastEnd[track] ?? -1;
    if (c.t < prev) { // trim the earlier sound rather than overlap on one track
      const tag = sfxTags[sfxTags.length - 1 - [...sfxTags].reverse().findIndex((x) => x.track === track)];
      tag.duration = +(c.t - tag.start).toFixed(3);
    }
    sfxTags.push({ id: `sfx-${sfxTags.length + 1}`, file: snd.file, start: c.t, duration: +(end - c.t).toFixed(3), volume: snd.volume, track });
    lastEnd[track] = end;
  }
}
for (const x of sfxTags) audioTags.push(`      <audio id="${x.id}" class="clip" src="${x.file}" data-start="${x.start}" data-duration="${x.duration}" data-track-index="${x.track}" data-volume="${x.volume}"></audio>`);

const variables = [{ id: 'SHOW_ALL_ANSWERS', type: 'boolean', label: 'Show all answers (instructor version)', default: !!config.SHOW_ALL_ANSWERS }];

const index = `<!doctype html>
<!-- Generated by scripts/build.mjs from scenes.json. Edit scenes.json or scripts/scenes.mjs, then run npm run build. -->
<html lang="en" data-composition-variables='${JSON.stringify(variables)}'>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>College-Town Home Sales: one sample site</title>
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      ${FONTS_CSS}
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: ${C.ground}; }
      #root { width: 100%; height: 100%; font-family: 'Inter Site', sans-serif; }
      #bg { position: absolute; inset: 0; background: ${C.ground}; }
      /* The answer switch. Each scene sets data-answers from SHOW_ALL_ANSWERS. */
      html[data-answers="all"] .v-learner { display: none !important; }
      html:not([data-answers="all"]) .v-full { display: none !important; }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="main"
      data-start="0"
      data-duration="${total}"
      data-fps="${config.FPS || 30}"
      data-width="1920"
      data-height="1080"
    >
      <div id="bg"></div>
${hosts}
${overlayHosts}
${audioTags.join('\n')}
    </div>
    <script>
      window.__timelines["main"] = gsap.timeline({ paused: true });
    </script>
  </body>
</html>
`;
fs.writeFileSync(path.join(ROOT, 'index.html'), index);

const md = [
  '# On-screen text by scene',
  '',
  'Generated by `scripts/build.mjs`. Times in seconds. Box labels and chips are included.',
  '',
  ...copy.flatMap((c) => [`## ${c.id} (${c.start} to ${+(c.start + c.duration).toFixed(2)})`, '', ...c.lines.map((l) => `- ${l}`), '']),
].join('\n');
fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs', 'on-screen-text.md'), md);

console.log(`Built ${list.scenes.length} scenes, ${total} s (${Math.floor(Math.round(total) / 60)} min ${Math.round(total) % 60} s)${audioTags.length - sfxTags.length ? `, ${audioTags.length - sfxTags.length} voiceover clips` : ', no voiceover'}, ${sfxTags.length} sound effects.`);
for (const w of warnings) console.log(`warning: ${w}`);
