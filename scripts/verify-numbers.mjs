#!/usr/bin/env node
// Checks the numbers in the captures against the check list for the video.
// Reads the answer text recorded with each capture (captures/manifest.json) and exits non-zero
// if any expected value is missing. It never changes a number.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'captures', 'manifest.json'), 'utf8'));
const answer = (shot) => (m.shots[shot]?.text?.answer || '').replace(/\s+/g, ' ');

const checks = [
  ['Q1', 'q1', ['Davis, CA', '$889,000']],
  ['Q2', 'q2', ['Athens, GA', '32.8%']],
  ['Q3', 'q3', ['Athens, GA moves down 2 positions, from 9th to 11th', 'Madison, WI moves up 1 position, from 10th to 9th', 'State College, PA moves up 1 position, from 11th to 10th']],
  ['Q4', 'q4', ['University of Illinois Urbana-Champaign had the largest increase', '+7.6%']],
  ['Q5', 'q5', ['Slowest: University of Georgia, with a median of 27 days', 'each with a median of 7 days, a 4-way tie']],
  ['Q6', 'q6', ['1.93%', '0.63%']],
  ['Q7 (3 beds)', 'q7-s0', ['For 3-bedroom homes, Champaign, IL', '$215,000']],
  ['Q7 (2 beds)', 'q7-s1', ['For 2-bedroom homes, Urbana, IL', '$135,500']],
  ['Q8 ($250,000 to $499,999)', 'q8-s2', ['from $250,000 to $499,999, Champaign, IL and Madison, WI', '6 days each']],
  ['Q9 (Champaign, IL 2025)', 'q9-s1', ['In Champaign, IL in 2025, June had the most sales: 86', '717 sales']],
  ['Q10 (UIUC, $400,000, 3+ beds)', 'q10-s1', ['University of Illinois Urbana-Champaign', '$400,000 or less with 3 or more bedrooms', '2.8 miles', '2,601 sales']],
];

let failed = 0;
for (const [label, shot, needles] of checks) {
  const text = answer(shot);
  const missing = needles.filter((n) => !text.includes(n));
  if (missing.length) {
    failed++;
    console.log(`MISMATCH ${label} (${shot}): missing ${missing.map((s) => JSON.stringify(s)).join(', ')}\n  text: ${text}`);
  } else {
    console.log(`ok       ${label}: ${needles.join(' | ')}`);
  }
}

// The settings each live question was captured at.
for (const s of ['q7-s0', 'q7-s1', 'q8-s0', 'q8-s1', 'q8-s2', 'q9-s0', 'q9-s1', 'q10-s0', 'q10-s1']) {
  console.log(`settings ${s}: ${JSON.stringify(m.shots[s]?.text?.values)}`);
}

// Shareable link: the fresh load must show the same filters and numbers.
const s2 = m.shots['f5-s2']?.text, s3 = m.shots['f5-s3']?.text;
if (!s2 || !s3 || s2.query !== s3.query || s2.tiles !== s3.tiles) {
  failed++;
  console.log('MISMATCH shareable link: the fresh load does not match the view it was copied from');
} else {
  console.log(`ok       shareable link ${s3.query} reloads to the same key numbers`);
}

if (failed) {
  console.log(`\n${failed} check(s) failed. Stop and review before building or rendering.`);
  process.exit(1);
}
console.log('\nAll numbers match the check list.');
