#!/usr/bin/env node
// Captures every state of the sample site that the video needs, with headless Chrome.
//
//   node scripts/capture.mjs            capture everything
//   node scripts/capture.mjs q7 f3      capture only shots whose name starts with q7 or f3
//
// Output, in captures/:
//   <name>.png           the page as it is
//   <name>.learner.png   the same state with Q3 to Q10 answers, chart data labels and the
//                        insights text blurred inside the page (only for shots that need it)
//   manifest.json        for every shot: size, scale, the positions of the elements the video
//                        points at (in CSS pixels, relative to the shot), and the answer text
//
// Every shot also blurs, in both versions, the parts of the page that could identify the site:
// the footer (dataset citation and the source-code link) and the dataset citation card.

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'captures');
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'video.config.json'), 'utf8'));
const SITE = process.env.SITE_URL || CONFIG.SITE_URL;
const ONLY = process.argv.slice(2);

const DESKTOP = { width: 1920, height: 1080 };
const PHONE = { width: 390, height: 844 };

// Elements hidden in the learner version (SHOW_ALL_ANSWERS = false).
const LEARNER_BLUR = [
  ...[3, 4, 5, 6, 7, 8, 9, 10].map((n) => `#q${n}-answer`),
  ...[3, 4, 5, 6, 7, 8, 9, 10].map((n) => `#q${n}-chart .value-label`),
  '#q3-chart .row-label', // slope chart labels carry the ranks
  '#q8-note', '#q10-note',
  '#p1-text', '#p2 .prose', '#p1-chart .value-label',
  '.tooltip',
];
// Hidden in every version: nothing in the video may lead back to the site or its repository.
const ALWAYS_BLUR = ['.site-footer p', '#methods .method:last-child p'];

const CAPTURE_CSS = `
  html { scroll-behavior: auto !important; }
  *, *::before, *::after { transition: none !important; caret-color: transparent !important; }
  ${ALWAYS_BLUR.join(',\n  ')} { filter: blur(7px) !important; }
  ${LEARNER_BLUR.map((s) => `html.hf-learner ${s}`).join(',\n  ')} { filter: blur(8px) !important; }
`;

const manifest = fs.existsSync(path.join(OUT, 'manifest.json'))
  ? JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8'))
  : { shots: {}, site: {} };

const want = (name) => !ONLY.length || ONLY.some((p) => name.startsWith(p));

// ---------- Page helpers ----------

async function open(browser, { dsf = 3, phone = false, dark = false, query = '', blockData = false } = {}) {
  const context = await browser.newContext({
    viewport: phone ? PHONE : DESKTOP,
    deviceScaleFactor: dsf,
    isMobile: phone,
    hasTouch: phone,
    colorScheme: dark ? 'dark' : 'light',
  });
  const page = await context.newPage();
  if (blockData) {
    // Hold the data request so the loading message stays on screen.
    await page.route(/\.(csv|parquet|json)(\?|$)/, () => {});
    await page.goto(SITE + query, { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: CAPTURE_CSS });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800);
    return page;
  }
  await page.goto(SITE + query, { waitUntil: 'networkidle' });
  await page.waitForSelector('#questions:not([hidden])', { timeout: 60000 });
  await page.addStyleTag({ content: CAPTURE_CSS });
  await page.evaluate(() => document.fonts.ready);
  await settle(page);
  return page;
}

async function settle(page, ms = 600) {
  await page.waitForTimeout(ms);
}

// Page-coordinate rectangle of the first element matching a selector.
async function rect(page, selector) {
  return page.$eval(selector, (e) => {
    const r = e.getBoundingClientRect();
    return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height };
  });
}

// Union of the rectangles of every element matching a selector.
async function unionRect(page, selector) {
  return page.$$eval(selector, (els) => {
    const rs = els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
    if (!rs.length) return null;
    const x1 = Math.min(...rs.map((r) => r.left)), y1 = Math.min(...rs.map((r) => r.top));
    const x2 = Math.max(...rs.map((r) => r.right)), y2 = Math.max(...rs.map((r) => r.bottom));
    return { x: x1 + scrollX, y: y1 + scrollY, w: x2 - x1, h: y2 - y1 };
  });
}

function pad(r, l, t = l, rr = l, b = t) {
  return { x: r.x - l, y: r.y - t, w: r.w + l + rr, h: r.h + t + b };
}

function round(r) {
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) };
}

// Rectangles relative to a shot's top-left corner, rounded to 0.1 px.
function relative(rects, clip) {
  const out = {};
  for (const [k, r] of Object.entries(rects)) {
    if (!r) continue;
    out[k] = { x: +(r.x - clip.x).toFixed(1), y: +(r.y - clip.y).toFixed(1), w: +r.w.toFixed(1), h: +r.h.toFixed(1) };
  }
  return out;
}

// Takes one shot. mode "page" captures any part of the page with the page scrolled to the top,
// so the sticky header only appears at the very top. mode "viewport" captures what is on screen
// (needed for hover states and tooltips, which are positioned against the window).
async function shoot(page, name, clip, { learner = false, rects = {}, text = {}, mode = 'page', dsf } = {}) {
  clip = round(clip);
  const file = path.join(OUT, `${name}.png`);
  const opts = { animations: 'disabled' };
  if (mode === 'page') {
    await page.evaluate(() => window.scrollTo(0, 0));
    Object.assign(opts, { fullPage: true, clip: { x: clip.x, y: clip.y, width: clip.w, height: clip.h } });
  } else {
    const sy = await page.evaluate(() => scrollY);
    Object.assign(opts, { clip: { x: clip.x, y: clip.y - sy, width: clip.w, height: clip.h } });
  }
  const resolved = {};
  for (const [k, v] of Object.entries(rects)) {
    resolved[k] = typeof v === 'string' ? await rect(page, v).catch(() => null) : v;
  }
  await page.screenshot({ ...opts, path: file });
  if (learner) {
    await page.evaluate(() => document.documentElement.classList.add('hf-learner'));
    await page.waitForTimeout(80);
    await page.screenshot({ ...opts, path: path.join(OUT, `${name}.learner.png`) });
    await page.evaluate(() => document.documentElement.classList.remove('hf-learner'));
  } else if (fs.existsSync(path.join(OUT, `${name}.learner.png`))) {
    fs.rmSync(path.join(OUT, `${name}.learner.png`));
  }
  const scale = dsf || page.context()._options?.deviceScaleFactor || 3;
  manifest.shots[name] = { w: clip.w, h: clip.h, dsf: scale, learner, rects: relative(resolved, clip), text };
  console.log(`  ${name}${learner ? ' (+learner)' : ''}  ${clip.w}x${clip.h} css`);
}

const inner = (page, sel) => page.innerText(sel).catch(() => '');

// Selects an option and waits for the page to recalculate.
async function choose(page, selector, value) {
  await page.selectOption(selector, value);
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await settle(page, 500);
}

// Types into a text box the way a visitor would, then leaves the box.
async function typeInto(page, selector, text) {
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press('Control+A');
  await page.keyboard.type(text);
  // Leave the box without moving keyboard focus to the next control (no stray focus ring).
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.mouse.move(5, 5);
  await settle(page, 600);
}

const article = (page, id) => rect(page, `#${id}`).then((r) => pad(r, 32, 28, 32, 28));

// ---------- Shots ----------

async function desktopShots(browser) {
  const page = await open(browser);
  manifest.site.title = await page.title();
  manifest.site.pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  manifest.site.palette = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const keys = ['--bg', '--surface-2', '--ink', '--ink-2', '--muted', '--line', '--accent', '--accent-2', '--quiet', '--accent-ink'];
    return Object.fromEntries(keys.map((k) => [k, cs.getPropertyValue(k).trim()]));
  });

  // The compare panel starts on two cities: its default campus pair shows Q5 values.
  await choose(page, '#cmp-a', 'city:Champaign, IL');
  await choose(page, '#cmp-b', 'city:Urbana, IL');

  if (want('top')) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await shoot(page, 'top', { x: 0, y: 0, w: 1920, h: 1080 }, {
      mode: 'viewport',
      rects: { toggle: '#theme-toggle', h1: '.hero h1', lead: '.hero .lead', stats: '.hero-stats', nav: '.site-nav', header: '.site-header' },
      text: { stats: await inner(page, '.hero-stats') },
    });
  }

  if (want('page')) {
    const H = manifest.site.pageHeight;
    const tiles = [];
    for (let y = 0, i = 0; y < H; y += 2048, i++) {
      const name = `page-${String(i).padStart(2, '0')}`;
      await shoot(page, name, { x: 0, y, w: 1920, h: Math.min(2048, H - y) }, { learner: true });
      tiles.push(name);
    }
    const sections = {};
    for (const id of ['top', 'questions', 'explore', 'insights', 'methods']) sections[id] = await rect(page, `#${id}`);
    manifest.site.pageTiles = tiles;
    manifest.site.sections = Object.fromEntries(Object.entries(sections).map(([k, r]) => [k, round(r)]));
  }

  if (want('questions-intro')) {
    const clip = pad(await rect(page, '#questions .section-head'), 32, 28, 32, 28);
    await shoot(page, 'questions-intro', clip, {
      rects: { intro: '#questions .section-intro', jump: '#questions .jump', h2: '#questions h2' },
    });
  }

  for (const n of [1, 2, 3, 4, 5, 6]) {
    const name = `q${n}`;
    if (!want(name)) continue;
    const clip = await article(page, name);
    await shoot(page, name, clip, {
      learner: n >= 3,
      rects: {
        head: `#${name} .question-head`,
        answer: `#${name}-answer`,
        answer2: `#${name}-answer p:nth-of-type(2)`,
        chart: `#${name}-chart`,
        chartBody: `#${name}-chart .chart-body`,
        chartTitle: `#${name}-chart .chart-caption`,
        keyMarks: await unionRect(page, `#${name}-chart .marks .is-accent, #${name}-chart .marks .is-key`),
        keyLabel: `#${name}-chart .row-label.is-key`,
      },
      text: { answer: await inner(page, `#${name}-answer`), chartTitle: await inner(page, `#${name}-chart .chart-title`) },
    });
  }

  // Q7 to Q10: each setting is changed the way a visitor would change it.
  const live = [
    {
      id: 'q7',
      states: [
        async () => choose(page, '#q7-beds', '3'),
        async () => choose(page, '#q7-beds', '2'),
      ],
      controls: { beds: '#q7-beds' },
    },
    {
      id: 'q8',
      states: [
        async () => { await typeInto(page, '#q8-min', '200000'); await typeInto(page, '#q8-max', '400000'); },
        async () => typeInto(page, '#q8-min', '250000'),
        async () => typeInto(page, '#q8-max', '499999'),
      ],
      controls: { min: '#q8-min', max: '#q8-max' },
    },
    {
      id: 'q9',
      states: [
        async () => { await choose(page, '#q9-city', 'Champaign, IL'); await choose(page, '#q9-year', '2024'); },
        async () => choose(page, '#q9-year', '2025'),
      ],
      controls: { city: '#q9-city', year: '#q9-year' },
    },
    {
      id: 'q10',
      states: [
        async () => { await typeInto(page, '#q10-beds', '3'); await typeInto(page, '#q10-budget', '300000'); },
        async () => typeInto(page, '#q10-budget', '400000'),
      ],
      controls: { campus: '#q10-campus', budget: '#q10-budget', beds: '#q10-beds' },
    },
  ];
  for (const q of live) {
    if (!want(q.id)) continue;
    // Measure every state first, so all states share one frame.
    let clip = null;
    for (const set of q.states) {
      await set();
      const r = await article(page, q.id);
      clip = clip ? { x: clip.x, y: clip.y, w: clip.w, h: Math.max(clip.h, r.h) } : r;
    }
    // Back to the first state, then step through and capture each one.
    for (let i = 0; i < q.states.length; i++) {
      if (i === 0) {
        // Replay from the start so state 0 is reached the same way as before.
        for (const set of [q.states[0]]) await set();
      } else {
        await q.states[i]();
      }
      const rects = { head: `#${q.id} .question-head`, controls: `#${q.id} .controls`, answer: `#${q.id}-answer`, chart: `#${q.id}-chart`, chartBody: `#${q.id}-chart .chart-body`, keyLabel: `#${q.id}-chart .is-key` };
      for (const [k, sel] of Object.entries(q.controls)) rects[`ctl_${k}`] = sel;
      const values = {};
      for (const [k, sel] of Object.entries(q.controls)) values[k] = await page.$eval(sel, (e) => (e.tagName === 'SELECT' ? e.options[e.selectedIndex].text : e.value));
      await shoot(page, `${q.id}-s${i}`, clip, {
        learner: true,
        rects,
        text: { answer: await inner(page, `#${q.id}-answer`), chartTitle: await inner(page, `#${q.id}-chart .chart-title`), values },
      });
    }
  }
  // Put the questions back to their defaults before the explore shots.
  if (want('q')) {
    await choose(page, '#q7-beds', '3');
    await typeInto(page, '#q8-min', '200000');
    await typeInto(page, '#q8-max', '400000');
    await choose(page, '#q9-year', '2025');
    await typeInto(page, '#q10-budget', '400000');
  }

  if (want('insights')) {
    const clip = pad(await rect(page, '#insights'), -392, 0, -392, 0);
    await shoot(page, 'insights', clip, {
      learner: true,
      rects: { head: '#insights .section-head', p1: '#p1', p1head: '#p1 .question-head', p1chart: '#p1-chart', p2: '#p2', p2head: '#p2 .question-head' },
    });
  }

  // ----- Explore -----
  const panelAndTiles = async () => {
    const f = await rect(page, '#filters');
    const t = await rect(page, '.tiles');
    return pad({ x: f.x, y: f.y, w: f.w, h: t.y + t.h - f.y }, 32, 28, 32, 28);
  };
  const tileRects = async () => {
    const out = { tiles: await rect(page, '.tiles') };
    const tiles = await page.$$('.tiles .tile');
    for (let i = 0; i < tiles.length; i++) out[`tile${i}`] = await rect(page, `.tiles .tile:nth-child(${i + 1})`);
    return out;
  };
  const tileText = () => inner(page, '.tiles');

  if (want('f1')) {
    const clip = await panelAndTiles();
    const base = { filters: '#filters', city: '#f-city', campus: '#f-campus', year: '#f-year', beds: '#f-beds', pmin: '#f-pmin', pmax: '#f-pmax', summary: '#filter-summary' };
    await shoot(page, 'f1-s0', clip, { rects: { ...base, ...(await tileRects()) }, text: { tiles: await tileText() } });
    await choose(page, '#f-city', 'Iowa City, IA');
    await shoot(page, 'f1-s1', clip, { rects: { ...base, ...(await tileRects()) }, text: { tiles: await tileText(), summary: await inner(page, '#filter-summary') } });
    await page.click('#reset-filters');
    await settle(page);
  }

  if (want('f2')) {
    const t = await rect(page, '.tiles');
    const m = await rect(page, '#map-figure');
    const c = await rect(page, '#compare');
    const clip = pad({ x: t.x, y: t.y, w: t.w, h: Math.max(m.y + m.h, c.y + c.h) - t.y }, 32, 28, 32, 28);
    const marker = async (label) => page.evaluate((label) => {
      const g = [...document.querySelectorAll('.map-place')].find((p) => p.querySelector('.map-label')?.textContent.trim() === label);
      const r = g.querySelector('.map-dot').getBoundingClientRect();
      return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height };
    }, label);
    const rects = async () => ({ map: '#map-figure', ...(await tileRects()), marker: await marker('Iowa'), campus: '#f-campus' });
    await shoot(page, 'f2-s0', clip, { rects: await rects(), text: { tiles: await tileText() } });
    const mk = await marker('Iowa');
    await page.evaluate((y) => window.scrollTo(0, y - 400), mk.y);
    const sy = await page.evaluate(() => scrollY);
    await page.mouse.click(mk.x + mk.w / 2, mk.y + mk.h / 2 - sy);
    await page.mouse.move(5, 5);
    await settle(page, 800);
    await shoot(page, 'f2-s1', clip, { rects: await rects(), text: { tiles: await tileText(), campus: await page.$eval('#f-campus', (e) => e.value) } });
    await page.click('#reset-filters');
    await settle(page);
  }

  if (want('f4')) {
    const clip = await panelAndTiles();
    const base = { garage: '#f-garage', basement: '#f-basement', fireplace: '#f-fireplace', filters: '#filters' };
    const options = await page.$eval('#f-basement', (s) => [...s.options].map((o) => o.text));
    await shoot(page, 'f4-s0', clip, { rects: { ...base, ...(await tileRects()) }, text: { tiles: await tileText(), options } });
    // Garage has no blank values, so Unknown would match nothing. Basement has many blanks.
    await choose(page, '#f-basement', 'unknown');
    await shoot(page, 'f4-s1', clip, { rects: { ...base, ...(await tileRects()) }, text: { tiles: await tileText(), options } });
    await page.click('#reset-filters');
    await settle(page);
  }

  if (want('f6')) {
    const clip = pad(await rect(page, '#compare'), 24, 20, 24, 20);
    const rects = { a: '#cmp-a', b: '#cmp-b', result: '#compare-result', pickers: '#compare .cmp-pickers' };
    await shoot(page, 'f6-s0', clip, { rects, text: { result: await inner(page, '#compare-result') } });
    await choose(page, '#cmp-b', 'city:Savoy, IL');
    await shoot(page, 'f6-s1', clip, { rects, text: { result: await inner(page, '#compare-result') } });
    await choose(page, '#cmp-b', 'city:Urbana, IL');
  }

  if (want('methods')) {
    const clip = pad(await rect(page, '#methods'), -392, 0, -392, 0);
    const rects = { head: '#methods .section-head' };
    const cards = await page.$$('#methods .method');
    for (let i = 0; i < cards.length; i++) rects[`m${i}`] = await rect(page, `#methods .method:nth-child(${i + 1})`);
    await shoot(page, 'methods', clip, { rects, text: { headings: await page.$$eval('#methods .method h3', (h) => h.map((x) => x.textContent)) } });
  }

  if (want('chart')) {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const clip = pad(await rect(page, `#q${n}-chart`), 16);
      await shoot(page, `chart-q${n}`, clip, { learner: n >= 3, rects: { body: `#q${n}-chart .chart-body`, caption: `#q${n}-chart .chart-caption` } });
    }
  }

  if (want('empty')) {
    const clip = pad(await rect(page, '#filters'), 32, 28);
    await typeInto(page, '#f-pmin', '4990000');
    await typeInto(page, '#f-pmax', '5000000');
    await choose(page, '#f-beds', '1');
    const f = await rect(page, '#filters');
    const e = await rect(page, '#explore-empty');
    const all = pad({ x: f.x, y: f.y, w: f.w, h: e.y + e.h - f.y }, 32, 28);
    await shoot(page, 'empty', all, { rects: { banner: '#explore-empty', summary: '#filter-summary' }, text: { banner: await inner(page, '#explore-empty') } });
    await page.click('#reset-filters');
    await settle(page);
    void clip;
  }

  // Tooltip on Q1 (a worked example), light. Needs a viewport shot.
  if (want('tip')) await tooltipShot(page, 'tip-q1');

  await page.context().close();
}

async function tooltipShot(page, name) {
  const fig = await rect(page, '#q1-chart');
  await page.evaluate((y) => window.scrollTo(0, y - 200), fig.y);
  const bar = await page.evaluate(() => {
    const b = document.querySelector('#q1-chart .marks .is-accent') || document.querySelector('#q1-chart .marks path');
    const r = b.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await page.mouse.move(bar.x + bar.w * 0.7, bar.y + bar.h / 2);
  await settle(page, 400);
  const tip = await rect(page, '.tooltip').catch(() => null);
  const clip = pad(fig, 16);
  const sy = await page.evaluate(() => scrollY);
  await shoot(page, name, clip, {
    mode: 'viewport',
    rects: { tooltip: tip, body: '#q1-chart .chart-body', caption: '#q1-chart .chart-caption', bar: { x: bar.x, y: bar.y + sy, w: bar.w, h: bar.h } },
    text: { tooltip: await inner(page, '.tooltip') },
  });
  await page.mouse.move(5, 5);
}

// Range filter: a real mouse drag on the "Year built" slider, then a typed value. Higher scale,
// because the scene zooms in close.
async function rangeShots(browser) {
  if (!want('f3')) return;
  const page = await open(browser, { dsf: 5 });
  const clip = pad(await rect(page, '#filters'), 32, 28);
  const thumbCenter = (which) => page.evaluate((which) => {
    const root = document.querySelector('#f-built');
    const input = root.querySelector(which === 'lo' ? '.range-lo' : '.range-hi');
    const r = input.getBoundingClientRect();
    const thumb = parseFloat(getComputedStyle(input).getPropertyValue('--thumb')) || 20;
    const f = (input.value - input.min) / (input.max - input.min);
    return { x: r.x + thumb / 2 + f * (r.width - thumb) + scrollX, y: r.y + r.height / 2 + scrollY, value: +input.value };
  }, which);
  const rects = async () => ({
    slider: '#f-built .range-slider', lo: '#f-built .range-box-lo', hi: '#f-built .range-box-hi', group: '#f-built', other: '#f-miles',
    thumbLo: await thumbCenter('lo').then((t) => ({ x: t.x, y: t.y, w: 0, h: 0 })),
    thumbHi: await thumbCenter('hi').then((t) => ({ x: t.x, y: t.y, w: 0, h: 0 })),
  });
  const values = () => page.evaluate(() => ({
    sliderLo: document.querySelector('#f-built .range-lo').value, sliderHi: document.querySelector('#f-built .range-hi').value,
    boxLo: document.querySelector('#f-built .range-box-lo').value, boxHi: document.querySelector('#f-built .range-box-hi').value,
  }));

  await shoot(page, 'f3-s0', clip, { dsf: 5, rects: await rects(), text: { values: await values() } });

  // Drag the lower handle to the right in six steps, capturing while the button is held.
  const start = await thumbCenter('lo');
  const track = await rect(page, '#f-built .range-slider');
  await page.evaluate((y) => window.scrollTo(0, y - 400), start.y);
  const sy = await page.evaluate(() => scrollY);
  await page.mouse.move(start.x, start.y - sy);
  await page.mouse.down();
  const steps = 6;
  const dx = track.w * 0.42;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(start.x + (dx * i) / steps, start.y - sy, { steps: 4 });
    await settle(page, 250);
    await shoot(page, `f3-s${i}`, clip, { dsf: 5, rects: await rects(), text: { values: await values() } });
  }
  await page.mouse.up();
  await page.mouse.move(5, 5);
  await settle(page, 500);
  // Type an exact upper value. The handle follows.
  await typeInto(page, '#f-built .range-box-hi', '2000');
  await shoot(page, `f3-s${steps + 1}`, clip, { dsf: 5, rects: await rects(), text: { values: await values(), summary: await inner(page, '#filter-summary') } });
  manifest.site.rangeSteps = steps + 2;
  await page.context().close();
}

// Sortable table, hover and focus states. Higher scale for close-ups of icons and focus rings.
async function controlShots(browser) {
  if (!want('f7') && !want('ctl')) return;
  const page = await open(browser, { dsf: 5 });
  await choose(page, '#cmp-a', 'city:Champaign, IL');
  await choose(page, '#cmp-b', 'city:Urbana, IL');
  if (want('f7')) {
    const panel = await page.evaluate(() => {
      const r = document.querySelector('#explore-table').closest('.panel').getBoundingClientRect();
      return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height };
    });
    const clip = pad(panel, 16);
    const heads = async () => {
      const out = { table: '#explore-table table', thead: '#explore-table thead' };
      const n = await page.$$eval('#explore-table thead th', (t) => t.length);
      for (let i = 0; i < n; i++) {
        out[`th${i}`] = `#explore-table thead th:nth-child(${i + 1})`;
        out[`icon${i}`] = `#explore-table thead th:nth-child(${i + 1}) .sort-icon`;
      }
      return out;
    };
    const headerText = () => page.$$eval('#explore-table thead th', (t) => t.map((x) => `${x.textContent.trim()}|${x.getAttribute('aria-sort')}`));
    await shoot(page, 'f7-s0', clip, { dsf: 5, rects: await heads(), text: { headers: await headerText(), firstRows: (await inner(page, '#explore-table tbody')).split('\n').slice(0, 3) } });
    const col = await page.$$eval('#explore-table thead th', (t) => t.findIndex((x) => x.textContent.trim() === 'Median sale price'));
    await page.click(`#explore-table thead th:nth-child(${col + 1}) button`);
    await page.mouse.move(5, 5);
    await settle(page, 500);
    await shoot(page, 'f7-s1', clip, { dsf: 5, rects: await heads(), text: { headers: await headerText(), firstRows: (await inner(page, '#explore-table tbody')).split('\n').slice(0, 3), sortCol: col } });
    await page.click(`#explore-table thead th:nth-child(${col + 1}) button`);
    await page.mouse.move(5, 5);
    await settle(page, 500);
    await shoot(page, 'f7-s2', clip, { dsf: 5, rects: await heads(), text: { headers: await headerText(), firstRows: (await inner(page, '#explore-table tbody')).split('\n').slice(0, 3), sortCol: col } });
    await page.click(`#explore-table thead th:nth-child(1) button`).catch(() => {});
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#questions:not([hidden])');
    await page.addStyleTag({ content: CAPTURE_CSS });
    await settle(page);
  }
  if (want('ctl')) {
    const foot = pad(await rect(page, '#filters .filters-foot'), 24, 20);
    const rects = { reset: '#reset-filters', copy: '#copy-link' };
    await shoot(page, 'ctl-rest', foot, { dsf: 5, rects });
    const copy = await rect(page, '#copy-link');
    await page.evaluate((y) => window.scrollTo(0, y - 400), copy.y);
    let sy = await page.evaluate(() => scrollY);
    await page.mouse.move(copy.x + copy.w / 2, copy.y + copy.h / 2 - sy);
    await settle(page, 300);
    await shoot(page, 'ctl-hover', foot, { dsf: 5, rects, mode: 'viewport' });
    await page.mouse.move(5, 5);
    // Keyboard focus: focus the box before the reset button, then press Tab.
    await page.focus('#f-built .range-box-hi');
    await page.keyboard.press('Tab');
    await settle(page, 300);
    const focused = await page.evaluate(() => document.activeElement?.id || document.activeElement?.className);
    sy = await page.evaluate(() => scrollY);
    await shoot(page, 'ctl-focus', foot, { dsf: 5, rects, mode: 'viewport', text: { focused } });
  }
  await page.context().close();
}

// Shareable filters: the query string after each change, then a fresh load from it.
async function urlShots(browser) {
  if (!want('f5') && !want('loading')) return;
  if (want('f5')) {
    const page = await open(browser);
    const f = await rect(page, '#filters');
    const t = await rect(page, '.tiles');
    const clip = pad({ x: f.x, y: f.y, w: f.w, h: t.y + t.h - f.y }, 32, 28);
    const rects = { city: '#f-city', beds: '#f-beds', copy: '#copy-link', tiles: '.tiles', filters: '#filters' };
    const query = async () => { await settle(page, 400); return page.evaluate(() => location.search); };
    await shoot(page, 'f5-s0', clip, { rects, text: { query: await query(), tiles: await inner(page, '.tiles') } });
    await choose(page, '#f-city', 'Iowa City, IA');
    await shoot(page, 'f5-s1', clip, { rects, text: { query: await query(), tiles: await inner(page, '.tiles') } });
    await choose(page, '#f-beds', '3');
    const q = await query();
    await shoot(page, 'f5-s2', clip, { rects, text: { query: q, tiles: await inner(page, '.tiles') } });
    await page.context().close();

    const fresh = await open(browser, { query: q });
    await shoot(fresh, 'f5-s3', clip, {
      rects,
      text: { query: await fresh.evaluate(() => location.search), tiles: await inner(fresh, '.tiles'), city: await fresh.$eval('#f-city', (e) => e.value), beds: await fresh.$eval('#f-beds', (e) => e.value) },
    });
    await fresh.context().close();
  }
  if (want('loading')) {
    const page = await open(browser, { blockData: true });
    await shoot(page, 'loading', { x: 0, y: 0, w: 1920, h: 1080 }, { mode: 'viewport', rects: { status: '#load-status', h1: '.hero h1' }, text: { status: await inner(page, '#load-status') } });
    await page.context().close();
  }
}

async function darkShots(browser) {
  if (!want('dark')) return;
  // Start in light mode and press the real toggle, as the video shows.
  const page = await open(browser);
  await choose(page, '#cmp-a', 'city:Champaign, IL');
  await choose(page, '#cmp-b', 'city:Urbana, IL');
  await page.click('#theme-toggle');
  await page.mouse.move(5, 5);
  await settle(page, 800);
  manifest.site.darkPalette = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return { theme: document.documentElement.dataset.theme, bg: cs.getPropertyValue('--bg').trim(), ink: cs.getPropertyValue('--ink').trim() };
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await shoot(page, 'dark-top', { x: 0, y: 0, w: 1920, h: 1080 }, { mode: 'viewport', rects: { toggle: '#theme-toggle' } });
  await shoot(page, 'dark-q1', await article(page, 'q1'), { rects: { chart: '#q1-chart', answer: '#q1-answer' } });
  const t = await rect(page, '.tiles');
  const m = await rect(page, '#map-figure');
  await shoot(page, 'dark-map', pad({ x: t.x, y: t.y, w: t.w, h: m.y + m.h - t.y }, 32, 28), { rects: { map: '#map-figure' } });
  await tooltipShot(page, 'dark-tip-q1');
  await page.context().close();
}

async function phoneShots(browser) {
  if (!want('phone')) return;
  const page = await open(browser, { phone: true });
  const q3 = await rect(page, '#q3');
  const end = Math.round(q3.y - 24);
  manifest.site.phone = {
    scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth),
    clientWidth: await page.evaluate(() => document.documentElement.clientWidth),
    end,
  };
  await page.evaluate(() => window.scrollTo(0, 0));
  await shoot(page, 'phone-top', { x: 0, y: 0, w: 390, h: 844 }, { mode: 'viewport', rects: { toggle: '#nav-toggle' } });
  // Everything from the top of the page to the end of Q2 (Q1 and Q2 are worked examples).
  const tiles = [];
  for (let y = 0, i = 0; y < end; y += 2400, i++) {
    const name = `phone-${String(i).padStart(2, '0')}`;
    await shoot(page, name, { x: 0, y, w: 390, h: Math.min(2400, end - y) }, { learner: true });
    tiles.push(name);
  }
  manifest.site.phone.tiles = tiles;
  await page.context().close();
}

// ---------- Run ----------

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  console.log('Desktop');
  await desktopShots(browser);
  console.log('Range filter');
  await rangeShots(browser);
  console.log('Controls');
  await controlShots(browser);
  console.log('Shareable filters and loading');
  await urlShots(browser);
  console.log('Dark mode');
  await darkShots(browser);
  console.log('Phone');
  await phoneShots(browser);
} finally {
  await browser.close();
}
manifest.capturedAt = new Date().toISOString();
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`Wrote ${Object.keys(manifest.shots).length} shots to captures/`);
