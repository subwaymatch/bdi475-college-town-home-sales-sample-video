#!/usr/bin/env node
// Renders the video with the settings in video.config.json.
//
//   node scripts/render.mjs                       one render, as video.config.json says
//   node scripts/render.mjs --answers all         instructor version (SHOW_ALL_ANSWERS = true)
//   node scripts/render.mjs --resolution 1080p    1920x1080 instead of 4K
//   node scripts/render.mjs -o renders/x.mp4      output file
//   node scripts/render.mjs --all                 the three deliverables:
//       renders/sample-site-demo.mp4              learner, 4K
//       renders/sample-site-demo-instructor.mp4   instructor, 4K
//       renders/sample-site-demo-1080p.mp4        learner, 1080p
//
// The video is laid out once at 1920x1080. 4K is rendered by HyperFrames' supersampling
// (--resolution 4k renders the same layout at device scale 2), so text, boxes and the cursor
// scale with it and nothing in the layout changes between resolutions.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'video.config.json'), 'utf8'));
const HF = ['--yes', 'hyperframes@0.9.41'];

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

function run(cmd, cmdArgs) {
  console.log(`$ ${cmd} ${cmdArgs.join(' ')}`);
  const r = spawnSync(cmd, cmdArgs, { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
}

function render({ showAll, resolution, out }) {
  const flags = ['render', '--fps', String(config.FPS || 30), '--quality', config.QUALITY || 'high', '--variables', JSON.stringify({ SHOW_ALL_ANSWERS: showAll }), '-o', out];
  if (String(resolution).toLowerCase() === '4k') flags.push('--resolution', '4k');
  else if (String(resolution).toLowerCase() !== '1080p') throw new Error(`RESOLUTION must be "4k" or "1080p", not ${resolution}`);
  fs.mkdirSync(path.dirname(path.join(ROOT, out)), { recursive: true });
  run('npx', [...HF, ...flags]);
}

run('node', ['scripts/build.mjs']);

if (args.includes('--all')) {
  render({ showAll: false, resolution: '4k', out: 'renders/sample-site-demo.mp4' });
  render({ showAll: true, resolution: '4k', out: 'renders/sample-site-demo-instructor.mp4' });
  render({ showAll: false, resolution: '1080p', out: 'renders/sample-site-demo-1080p.mp4' });
} else {
  const answers = opt('--answers');
  const showAll = answers ? answers === 'all' : !!config.SHOW_ALL_ANSWERS;
  const resolution = opt('--resolution') || config.RESOLUTION || '4k';
  const out = opt('-o') || `renders/sample-site-demo${showAll ? '-instructor' : ''}${resolution === '1080p' ? '-1080p' : ''}.mp4`;
  render({ showAll, resolution, out });
}
