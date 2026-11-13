// What each scene shows. Each function receives a Scene (see lib/kit.mjs) and fills it.
// Times are beats in seconds at the scene's design length ("base"); when scenes.json gives a
// scene a different duration, every beat moves in proportion.
//
// On-screen text rules: plain English, short sentences, no em or en dashes, no arrows or
// decorative symbols, at least 28 px at 1080p, and nothing below y = 880 (caption band).

import { C } from './lib/kit.mjs';

const WIN = { x: 640, y: 96, w: 1170, h: 768 };
const COL = { x: 110, y: 150, w: 480 };

const grow = (r, g) => ({ x: r.x - g, y: r.y - g, w: r.w + 2 * g, h: r.h + 2 * g });
const union = (...rs) => {
  const x1 = Math.min(...rs.map((r) => r.x)), y1 = Math.min(...rs.map((r) => r.y));
  const x2 = Math.max(...rs.map((r) => r.x + r.w)), y2 = Math.max(...rs.map((r) => r.y + r.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
};
const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const full = (p) => ({ x: p.x, y: p.y, w: p.shot.w * p.k, h: p.shot.h * p.k });

// ---------- Cards ----------

function card(S, { kicker, title, sub, titleSize = 72, subSize = 36, subWidth = 1100, immediate = false, image = null, underline = null }) {
  const id = `${S.id}-card`;
  const parts = [];
  const items = [];
  if (image) parts.push(`<img id="${id}-img" src="${image.src}" alt="" style="width:${image.w}px;height:auto;display:block;margin-bottom:${image.space || 10}px">`);
  const add = (cls, text, size, extra = '', html = text) => {
    if (cls === 'kicker') extra += 'margin-bottom:-20px;';
    const pid = `${id}-${items.length}`;
    parts.push(`<p id="${pid}" class="${cls}" style="margin:0;font-size:${size}px;text-align:center;${extra}">${html}</p>`);
    items.push(pid);
    S.copy.push(text);
  };
  if (kicker) add('kicker', kicker, 32);
  add('title', title, titleSize, 'max-width:1500px;margin-bottom:6px');
  if (sub) add('note', sub, subSize, `max-width:${subWidth}px`, underline ? underlined(S, sub, underline) : sub);
  // Centred in the area above the caption band; the opening card (with its image) is centred in
  // the whole frame, sized so that it still ends above the caption band.
  S.raw(`<div id="${id}" data-hold style="position:absolute;left:0;top:0;width:1920px;height:${image ? 1080 : 880}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px">${parts.join('')}</div>`);
  const times = immediate ? [null, null, 0.9] : kicker ? [0.3, 0.5, 1.3] : [0.4, 0.8];
  items.forEach((pid, i) => {
    if (times[i] == null) return; // already on screen at frame 0
    const blur = pid.endsWith('-0') && !kicker || (kicker && pid.endsWith('-1'));
    S.js.push(blur
      ? `tl.fromTo('#${pid}', { opacity: 0, filter: 'blur(8px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.6, ease: 'power3.out' }, ${S.T(times[i])});`
      : `tl.fromTo('#${pid}', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, ${S.T(times[i])});`);
  });
}

// A hand-drawn underline under one word: a single tapered ink stroke with slightly rough edges,
// drawn from left to right by widening a clip rectangle.
function underlined(S, text, { word, at = 1.7 }) {
  const u = `${S.id}-ul`;
  const ink = C.black;
  const svg = `<svg aria-hidden="true" viewBox="0 0 120 22" preserveAspectRatio="none" style="position:absolute;left:-0.18em;top:calc(100% - 0.31em);width:calc(100% + 0.36em);height:0.5em;overflow:visible">
    <defs>
      <filter id="${u}-rough" x="-5%" y="-40%" width="110%" height="180%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.6"/></filter>
      <clipPath id="${u}-c1"><rect id="${u}-r1" x="0" y="0" width="0" height="22"/></clipPath>
    </defs>
    <g filter="url(#${u}-rough)" fill="${ink}">
      <path clip-path="url(#${u}-c1)" d="M2,10.8 C25,6.6 60,4.8 88,5.4 C102,5.7 111,6.3 118,7.0 C111,8.8 102,10.4 88,11.6 C60,12.8 25,14.0 2,12.4 Z"/>
    </g>
  </svg>`;
  S.js.push(`tl.fromTo('#${u}-r1', { attr: { width: 0 } }, { attr: { width: 120 }, duration: 0.5, ease: 'power2.inOut' }, ${S.T(at)});`);
  return text.replace(word, `<span style="position:relative;display:inline-block">${word}${svg}</span>`);
}

// A note held under the text column through each section that shows the site, so viewers know
// the screenshots are one example, not the only way. Each spans its scenes as one overlay.
export const exampleNotes = [
  { id: 'note-site', from: 'first-look', to: 'questions-intro', text: 'One example of what a finished site could look like.' },
  { id: 'note-questions', from: 'q1', to: 'q10', text: 'One example of how a site could answer this question.' },
  { id: 'note-insights', from: 'insights', to: 'insights', text: 'One example of how a site could present the insights.' },
  { id: 'note-features', from: 'feature-01', to: 'feature-10', text: 'One example of how a site could meet this requirement.' },
  { id: 'note-design', from: 'design', to: 'design', text: 'One example of how a site could handle design and polish.' },
];

export const scenes = {
  title: {
    base: 6,
    build(S) {
      // The title is on screen from the first frame (it is the thumbnail on most players).
      S.fadeIn = 0;
      card(S, {
        immediate: true,
        image: { src: 'assets/images/college-town-riso.webp', w: 670, space: 36 },
        kicker: 'A data analytics case study',
        title: 'College-Town Home Sales: one sample site',
        sub: 'A sample of what your site could look like. Not the answer key, and not the only way.',
        underline: { word: 'could', at: 1.7 },
      });
    },
  },

  'first-look': {
    base: 12,
    build(S) {
      const m = S.m;
      const H = m.site.pageHeight;
      const w = S.window(WIN);
      let y = 0;
      for (const t of m.site.pageTiles) {
        w.img(t, { y });
        y += m.shots[t].h;
      }
      const s = 0.585;
      const visible = WIN.h / s;
      w.cam(0, { x: 0, y: 0, w: 1920, h: visible }, { scale: s, align: 'top', pad: 0, dur: 0 });
      const t0 = 1.0, dur = 10.4, travel = H - visible;
      w.pan(t0, dur, { x: 0, y: travel, w: 1920, h: visible }, { scale: s, align: 'top', pad: 0 });
      const when = (yy) => t0 + dur * Math.max(0, Math.min(1, (yy - visible * 0.45) / travel));
      const sec = m.site.sections;
      S.column({
        ...COL,
        kicker: 'First look',
        title: 'One long page, read from top to bottom.',
        notes: [
          { text: 'Explore', chip: true, at: when(sec.explore.y) },
          { text: 'Insights', chip: true, at: when(sec.insights.y) },
          { text: 'Data and methods', chip: true, at: Math.min(when(sec.methods.y), 10.6) },
        ],
      });
    },
  },

  'questions-intro': {
    base: 4.5,
    build(S) {
      const w = S.window({ ...WIN, y: 236, h: 420 });
      const p = w.img('questions-intro');
      w.cam(0, full(p), { dur: 0, pad: 24 });
      w.box(w.r(p, 'intro'), { label: 'How the questions work', at: 1.4 });
      S.column({ ...COL, kicker: 'Ten questions', title: 'Q1 to Q6 always use the full dataset.', notes: [{ text: 'Q7 to Q10 update when a visitor changes a setting.', at: 1.6 }] });
    },
  },

  q1: question(1, { worked: true, chart: 'bar chart', line: 'Each answer is written out, then shown in a chart.', answer: 'Answer: Davis, CA, $889,000', extra: { rect: 'keyMarks', label: 'The answer in the accent color' } }),
  q2: question(2, { worked: true, chart: 'dumbbell chart', line: 'The answer also explains what causes the gap.', answer: 'Answer: Athens, GA. Its mean is 32.8% above its median.', extra: { rect: 'answer2', label: 'What causes it' } }),
  q3: question(3, { chart: 'slope chart', line: 'A slope chart shows how each city moves in rank.' }),
  q4: question(4, { chart: 'bar chart', line: 'Bars show the change for every campus area.' }),
  q5: question(5, { chart: 'box plot', line: 'A box plot shows the spread, not only the median.' }),
  q6: question(6, { chart: 'dot chart', line: 'Dots compare the tax burden across campus areas.' }),

  q7: live(7, {
    chart: 'bar chart',
    line: 'Change the setting. The answer and chart update.',
    base: 8,
    actions: [{ kind: 'select', ctl: 'ctl_beds', options: ['1 bedroom', '2 bedrooms', '3 bedrooms', '4 bedrooms'], from: 2, to: 1, state: 1 }],
  }),
  q8: live(8, {
    chart: 'dot chart',
    line: 'Type any amount. The answer and chart update.',
    base: 8.5,
    actions: [
      { kind: 'type', ctl: 'ctl_min', state: 1 },
      { kind: 'type', ctl: 'ctl_max', state: 2 },
    ],
  }),
  q9: live(9, {
    chart: 'column chart',
    line: 'Pick a city and a year. The chart shows each month.',
    base: 8,
    actions: [{ kind: 'select', ctl: 'ctl_year', options: ['2023', '2024', '2025', '2026'], from: 1, to: 2, state: 1 }],
  }),
  q10: live(10, {
    chart: 'histogram',
    line: 'Set a campus area, a budget and a number of bedrooms.',
    base: 8,
    actions: [{ kind: 'type', ctl: 'ctl_budget', state: 1 }],
  }),

  insights: {
    base: 8,
    build(S) {
      const w = S.window(WIN);
      const p = w.img('insights');
      const head = w.r(p, 'head'), p1 = w.r(p, 'p1head'), p2 = w.r(p, 'p2head');
      w.cam(0, { x: 0, y: head.y, w: p.shot.w, h: 700 }, { dur: 0, align: 'top', scale: 1.0, pad: 24 });
      w.box(grow(p1, 4), { label: 'P1 Data quality', at: 1.0, until: 3.6 });
      w.pan(2.4, 3.2, { x: 0, y: p2.y - 120, w: p.shot.w, h: 700 }, { scale: 1.0, align: 'top', pad: 24, ease: 'power1.inOut' });
      w.box(grow(p2, 4), { label: 'P2 Working with a coding agent', at: 5.3 });
      S.column({
        ...COL,
        kicker: 'Insights',
        title: 'Two short written notes, each under its own heading.',
        titleSize: 44,
        notes: [{ text: 'The text is hidden in this version.', at: 2.0, learner: true }],
      });
    },
  },

  'features-intro': {
    base: 3,
    build(S) {
      card(S, { title: 'Ten required features', sub: 'How this sample site does each one.', titleSize: 72 });
    },
  },

  'feature-01': feature(1, 'Filters and key numbers', 'Change a filter and the key numbers update.', (S, w) => {
    const a = w.img('f1-s0');
    w.img('f1-s1', { at: 3.5, fade: 0.1 });
    w.cam(0, full(a), { dur: 0, pad: 20 });
    w.box(grow(w.r(a, 'filters'), -6), { label: 'Filters', at: 0.8, until: 1.9 });
    const city = w.r(a, 'city');
    const menu = w.menu(city, ['All cities', 'Gainesville, FL', 'Iowa City, IA', 'Lafayette, IN'], { at: 2.2, until: 3.45, selected: 0, pick: 2, pickAt: 3.2 });
    const o = menu.optionAt(2);
    w.cursor([
      { t: 1.4, x: city.x + city.w * 0.6, y: city.y + 260 },
      { t: 1.5, x: city.x + city.w * 0.7, y: center(city).y, click: true, dur: 0.7 },
      { t: 2.6, x: o.x, y: o.y, click: true, dur: 0.5 },
    ], { hide: 4.4 });
    w.box(w.r(a, 'tiles'), { label: 'Key numbers update', at: 3.9, pos: 'top' });
  }),

  'feature-02': feature(2, 'Map filter', 'Click a campus on the map to filter the section.', (S, w) => {
    const a = w.img('f2-s0');
    w.img('f2-s1', { at: 3.0, fade: 0.1 });
    w.cam(0, full(a), { dur: 0, pad: 16 });
    const mk = w.r(a, 'marker');
    w.box(w.r(a, 'map'), { label: 'Map of campus areas', at: 0.8, until: 2.0 });
    w.cursor([
      { t: 1.5, x: mk.x + 200, y: mk.y + 160 },
      { t: 1.7, x: center(mk).x, y: center(mk).y, click: true, dur: 0.9 },
    ], { hide: 4.0 });
    w.box(grow(mk, 10), { label: 'Iowa selected', at: 3.2, pos: 'top' });
    w.box(w.r(a, 'tiles'), { label: 'Key numbers follow the map', at: 3.8, pos: 'bottom' });
  }),

  'feature-03': feature(3, 'Range filter', 'Drag the slider or type exact values.', (S, w) => {
    const m = S.m;
    const steps = m.site.rangeSteps; // states f3-s0 .. f3-s7
    const a = w.img('f3-s0');
    const drag = [];
    for (let i = 1; i < steps; i++) {
      const at = i < steps - 1 ? 2.75 + (i - 1) * 0.33 : 6.0;
      w.img(`f3-s${i}`, { at, fade: i < steps - 1 ? 0.06 : 0.1 });
      drag.push(at);
    }
    w.cam(0, full(a), { dur: 0, pad: 16 });
    const group = w.r(a, 'group');
    w.cam(1.0, grow(group, 24), { dur: 1.3, max: 2.4 });
    const thumb = (i) => S.m.shots[`f3-s${i}`].rects.thumbLo;
    const P = (r) => ({ x: a.x + r.x * a.k, y: a.y + r.y * a.k });
    const t0 = P(thumb(0));
    const path = [{ t: 1.9, x: t0.x + 60, y: t0.y + 70 }, { t: 1.95, x: t0.x, y: t0.y, dur: 0.45, press: true }];
    for (let i = 1; i < steps - 1; i++) {
      const p = P(thumb(i));
      path.push({ t: 2.75 + (i - 1) * 0.33 - 0.3, x: p.x, y: p.y, dur: 0.3 });
    }
    const hi = w.r(a, 'hi');
    path.push({ t: 4.7, x: P(thumb(steps - 2)).x, y: P(thumb(steps - 2)).y, dur: 0.01, release: true });
    path.push({ t: 4.9, x: center(hi).x, y: center(hi).y, dur: 0.8, click: true });
    w.cursor(path, { hide: 7.3 });
    w.box(grow(S.m.shots['f3-s0'].rects.slider && w.r(a, 'slider'), 4), { label: 'Drag the handle', at: 1.6, until: 4.6, pos: 'top-right' });
    w.box(union(w.r(a, 'lo'), w.r(a, 'hi')), { label: 'Number boxes move with it', at: 2.9, until: 4.8, pos: 'bottom' });
    w.box(w.r(a, 'hi'), { label: 'Or type an exact value', at: 6.2, pos: 'bottom' });
    return { notes: [{ text: 'The two stay in sync.', at: 3.6 }] };
  }, { base: 8 }),

  'feature-04': feature(4, 'Home feature filter', 'Garage, basement and fireplace each offer Any, Yes, No and Unknown.', (S, w) => {
    const a = w.img('f4-s0');
    w.img('f4-s1', { at: 3.6, fade: 0.1 });
    w.cam(0, full(a), { dur: 0, pad: 20 });
    const feats = union(w.r(a, 'garage'), w.r(a, 'basement'), w.r(a, 'fireplace'));
    w.box(grow(feats, 4), { label: 'Home features', at: 0.8, until: 2.2 });
    const b = w.r(a, 'basement');
    const options = S.m.shots['f4-s0'].text.options;
    const menu = w.menu(b, options, { at: 2.45, until: 3.5, selected: 0, pick: options.indexOf('Unknown'), pickAt: 3.25 });
    const o = menu.optionAt(options.indexOf('Unknown'));
    w.cursor([
      { t: 1.5, x: b.x + b.w * 0.5, y: b.y + 220 },
      { t: 1.6, x: b.x + b.w * 0.6, y: center(b).y, click: true, dur: 0.7 },
      { t: 2.6, x: o.x, y: o.y, click: true, dur: 0.55 },
    ], { hide: 4.6 });
    w.box(w.r(a, 'tiles'), { label: 'Unknown is its own choice', at: 4.1 });
    return { notes: [{ text: 'A blank is Unknown, not No.', at: 4.0 }] };
  }, { base: 7, titleSize: 46 }),

  'feature-05': feature(5, 'Shareable filters', 'The filters are saved in the page address.', (S, w) => {
    const q1 = S.m.shots['f5-s1'].text.query;
    const q2 = S.m.shots['f5-s2'].text.query;
    const a = w.img('f5-s1');
    w.img('f5-s2', { at: 3.3, fade: 0.1 });
    // A fresh page load: white page, the loading message, then the same view.
    const wipe = `${S.id}-reload`;
    w.add(`<div id="${wipe}" style="position:absolute;left:0;top:0;width:${a.shot.w}px;height:${a.shot.h}px;background:#fff"></div>`);
    S.js.push(`tl.fromTo('#${wipe}', { opacity: 0 }, { opacity: 1, duration: 0.25 }, ${S.T(5.6)});`);
    S.js.push(`tl.to('#${wipe}', { opacity: 0, duration: 0.3 }, ${S.T(6.7)});`);
    w.img('loading', { k: a.shot.w / 1920, y: 30, at: 5.6, fade: 0.25, until: 6.7 });
    w.img('f5-s3', { at: 6.6, fade: 0.3 });
    w.cam(0, full(a), { dur: 0, pad: 20 });
    const beds = w.r(a, 'beds');
    const menu = w.menu(beds, ['Any', '1', '2', '3', '4'], { at: 2.2, until: 3.2, selected: 0, pick: 3, pickAt: 3.0 });
    const o = menu.optionAt(3);
    w.cursor([
      { t: 1.2, x: beds.x + 80, y: beds.y + 220 },
      { t: 1.3, x: beds.x + beds.w * 0.6, y: center(beds).y, click: true, dur: 0.7 },
      { t: 2.35, x: o.x, y: o.y, click: true, dur: 0.45 },
    ], { hide: 4.6 });
    w.box(grow(union(w.r(a, 'city'), w.r(a, 'beds')), 2), { label: 'Filters set', at: 3.6, until: 5.4 });
    w.box(w.r(a, 'tiles'), { label: 'Same view, loaded from the link', at: 6.9, pos: 'top' });
    // The query string, in a plain box drawn by the video. Never the address bar or the domain.
    const qy = 520;
    S.text('Query string', { x: COL.x, y: qy, w: COL.w, size: 28, cls: 'kicker', at: 0.9 });
    S.raw(`<div id="${S.id}-qbox" style="position:absolute;left:${COL.x}px;top:${qy + 50}px;width:${COL.w}px;height:74px;background:#fff;border:2px solid ${C.black};border-radius:10px"></div>`);
    const qa = S.text(q1, { x: COL.x + 22, y: qy + 66, w: COL.w - 30, size: 28, cls: 'mono qs', at: 1.0, until: 3.35 });
    S.text(q2, { x: COL.x + 22, y: qy + 66, w: COL.w - 30, size: 28, cls: 'mono qs', at: 3.45 });
    S.js.push(`tl.fromTo('#${S.id}-qbox', { opacity: 0 }, { opacity: 1, duration: 0.4 }, ${S.T(0.9)});`);
    S.css.push(`#root .qs { margin: 0; color: ${C.black}; white-space: nowrap; }`);
    void qa;
    return { notes: [{ text: 'Open the link and the same view loads.', at: 5.2 }] };
  }, { base: 9 }),

  'feature-06': feature(6, 'Side-by-side comparison', 'Pick any two places.', (S, w) => {
    const a = w.img('f6-s0', { x: 0 });
    w.img('f6-s1', { at: 3.3, fade: 0.1 });
    w.cam(0, full(a), { dur: 0, pad: 20, max: 1.4 });
    const b = w.r(a, 'b');
    const menu = w.menu(b, ['Pittsboro, NC', 'Savoy, IL', 'State College, PA', 'Urbana, IL'], { at: 2.1, until: 3.25, selected: 3, pick: 1, pickAt: 3.0, width: 300 });
    const o = menu.optionAt(1);
    w.cursor([
      { t: 1.1, x: b.x + 40, y: b.y + 300 },
      { t: 1.2, x: b.x + b.w * 0.5, y: center(b).y, click: true, dur: 0.7 },
      { t: 2.35, x: o.x, y: o.y, click: true, dur: 0.5 },
    ], { hide: 4.3 });
    w.box(w.r(a, 'result'), { label: 'Side by side', at: 3.7, pos: 'right' });
    return { notes: [{ text: 'Median sale price and number of sales, next to each other.', at: 2.2 }] };
  }, { titleSize: 46 }),

  'feature-07': feature(7, 'Sortable table', 'Click a column heading to sort.', (S, w) => {
    const a = w.img('f7-s0');
    w.img('f7-s1', { at: 2.85, fade: 0.1 });
    w.img('f7-s2', { at: 4.6, fade: 0.1 });
    const col = S.m.shots['f7-s1'].text.sortCol;
    w.cam(0, full(a), { dur: 0, pad: 16 });
    const th = w.r(a, `th${col}`);
    const icon = w.r(a, `icon${col}`);
    // Close-up of the sorted column and its neighbours: headings, sort icons and the first rows.
    // Labels appear only while the camera holds still, so they keep their size on screen.
    const near = union(w.r(a, `th${col - 1}`), th, w.r(a, `th${col + 1}`));
    w.cam(0.6, { x: near.x - 20, y: near.y - 70, w: near.w + 40, h: 300 }, { dur: 1.0, max: 2.4 });
    w.box(grow(near, 2), { label: 'Sort icons', at: 1.6, until: 2.9 });
    w.cursor([
      { t: 1.7, x: th.x + 40, y: th.y + 90 },
      { t: 1.8, x: center(th).x, y: center(th).y, click: true, dur: 0.75 },
      { t: 3.7, x: center(th).x + 4, y: center(th).y + 2, click: true, dur: 0.55 },
    ], { hide: 5.8 });
    w.box(grow(union(th, icon), 3), { label: 'Highest first', at: 3.0, until: 4.35 });
    w.box(grow(union(th, icon), 3), { label: 'Lowest first', at: 4.7, until: 5.85 });
    w.cam(5.9, grow(w.r(a, 'table'), 10), { dur: 0.9, max: 1.3, align: 'top', pad: 60 });
    return { notes: [{ text: 'The icon shows the sorted column and its direction.', at: 3.2 }] };
  }, { base: 7 }),

  'feature-08': feature(8, 'Responsive layout', 'The same page on a desktop and on a phone.', (S, w) => {
    const d = w.img('top', { x: 34, y: 150, k: 0.42, frame: `border-radius:10px;box-shadow:0 0 0 2px ${C.line}` });
    void d;
    // Phone: a frame with the phone captures scrolling inside it.
    const k = 0.76, pw = 390 * k, ph = 844 * k, px = 1170 - pw - 70, py = 40;
    const tiles = S.m.site.phone.tiles;
    let y = 0;
    const inner = [];
    for (const t of tiles) {
      const sh = S.m.shots[t];
      inner.push(`<div class="shot" style="left:0;top:${y * k}px;width:${390 * k}px;height:${sh.h * k}px"><img class="v-full" src="captures/${t}.png" width="${390 * k}" height="${sh.h * k}" alt=""><img class="v-learner" src="captures/${t}.learner.png" width="${390 * k}" height="${sh.h * k}" alt=""></div>`);
      y += sh.h;
    }
    const sid = `${S.id}-phone-scroll`;
    // Desktop box first, so the phone sits on top of it.
    w.box({ x: 34, y: 150, w: 1920 * 0.42, h: 1080 * 0.42 }, { label: 'Desktop, 1920 pixels wide', at: 0.8, pos: 'bottom' });
    w.add(`<div style="position:absolute;left:${px - 12}px;top:${py - 12}px;width:${pw + 24}px;height:${ph + 24}px;border-radius:44px;background:${C.black}"></div>`);
    w.add(`<div style="position:absolute;left:${px}px;top:${py}px;width:${pw}px;height:${ph}px;border-radius:32px;overflow:hidden;background:#fff"><div id="${sid}" style="position:absolute;left:0;top:0;width:${pw}px">${inner.join('')}</div></div>`);
    const scrollTo = Math.min(y * k - ph, 1850 * k);
    S.js.push(`tl.fromTo('#${sid}', { y: 0 }, { y: ${-scrollTo.toFixed(1)}, duration: ${S.T(5.2) - S.T(1.4)}, ease: 'power1.inOut' }, ${S.T(1.4)});`);
    w.cam(0, { x: 0, y: 0, w: 1170, h: 768 }, { dur: 0, scale: 1, pad: 0 });
    w.box({ x: px - 12, y: py - 12, w: pw + 24, h: ph + 24 }, { label: 'Phone, 390 pixels wide', at: 1.4, pos: 'bottom', pad: 4 });
    return { notes: [{ text: 'Nothing needs sideways scrolling on a phone.', at: 2.6 }] };
  }, { titleSize: 50 }),

  'feature-09': feature(9, 'Light and dark mode', 'A toggle switches the theme.', (S, w) => {
    const a = w.img('top');
    // The dark capture, extended with the page's dark background to fill the whole window.
    const dark = w.img('dark-top', { crop: { x: 0, y: 0, w: 1920, h: Math.ceil((1920 * 768) / 1170) }, frame: 'background:#151514' });
    S.js.push(`tl.fromTo('#${dark.id}', { clipPath: 'inset(0 0 0 100%)' }, { clipPath: 'inset(0 0 0 0%)', duration: 0.7, ease: 'power2.inOut' }, ${S.T(2.65)});`);
    w.cam(0, { x: 0, y: 0, w: 1920, h: 1080 }, { dur: 0, pad: 0, scale: 1170 / 1920, align: 'top' });
    const tg = w.r(a, 'toggle');
    w.cursor([
      { t: 1.0, x: tg.x - 220, y: tg.y + 420 },
      { t: 1.1, x: center(tg).x, y: center(tg).y, click: true, dur: 1.0 },
    ], { hide: 3.6 });
    w.box(grow(tg, 2), { label: 'Theme toggle', at: 0.7, until: 2.4, pos: 'bottom' });
    // Then the map, charts and controls in dark mode.
    const w2 = S.window({ ...WIN, at: 3.7, bg: '#151514' });
    const m = w2.img('dark-map');
    w2.cam(0, full(m), { dur: 0, pad: 0 });
    return { notes: [{ text: 'Charts, the map and controls follow the theme.', at: 3.9 }] };
  }),

  'feature-10': feature(10, 'Data and methods', 'The rules behind every number, and the dataset citation.', (S, w) => {
    const a = w.img('methods');
    const r = S.m.shots.methods.rects;
    w.cam(0, { x: 0, y: 0, w: a.shot.w, h: 760 }, { dur: 0, scale: 1.0, align: 'top', pad: 20 });
    w.box(grow(w.r(a, 'm0'), 6), { label: 'Price rule', at: 0.8, until: 3.6 });
    w.box(grow(w.r(a, 'm1'), 6), { label: 'Days on market', at: 1.2, until: 3.6 });
    w.box(grow(w.r(a, 'm4'), 6), { label: 'Missing values', at: 1.6, until: 3.6 });
    const last = Object.keys(r).filter((k) => /^m\d+$/.test(k)).sort((x, y) => +x.slice(1) - +y.slice(1)).pop();
    w.pan(2.0, 1.6, { x: 0, y: r[last].y + r[last].h - 740, w: a.shot.w, h: 760 }, { scale: 1.0, align: 'top', pad: 20, ease: 'power2.inOut' });
    w.box(grow(w.r(a, last), 6), { label: 'Dataset citation', at: 3.3, until: 4.4 });
    w.hideAt(4.4);
    // At least three chart types: thumbnails of the question charts.
    const g = S.window({ ...WIN, at: 4.5 });
    g.cam(0, { x: 0, y: 0, w: WIN.w, h: WIN.h }, { dur: 0, scale: 1, pad: 0 });
    const list = [
      ['chart-q1', 'Bar chart'], ['chart-q2', 'Dumbbell chart'], ['chart-q3', 'Slope chart'], ['chart-q5', 'Box plot'],
      ['chart-q6', 'Dot chart'], ['chart-q9', 'Column chart'], ['chart-q10', 'Histogram'],
    ];
    const cw = 270, ch = 270, gx = 22, top = 34;
    list.forEach(([name, label], i) => {
      const row = i < 4 ? 0 : 1;
      const colN = row === 0 ? i : i - 4;
      const perRow = row === 0 ? 4 : 3;
      const x0 = (WIN.w - (perRow * cw + (perRow - 1) * gx)) / 2 + colN * (cw + gx);
      const y0 = top + row * (ch + 90);
      const sh = S.m.shots[name];
      const body = sh.rects.body;
      const k = Math.min(cw / body.w, ch / body.h);
      const crop = { x: body.x, y: body.y, w: body.w, h: body.h };
      g.img(name, { x: x0 + (cw - body.w * k) / 2, y: y0 + (ch - body.h * k) / 2, k, crop, at: 4.7 + i * 0.12 });
      g.add(`<p id="${S.id}-ct${i}" style="position:absolute;left:${x0}px;top:${y0 + ch + 10}px;width:${cw}px;margin:0;text-align:center;font-size:28px;font-weight:600;color:${C.black};white-space:nowrap">${label}</p>`);
      S.copy.push(label);
      S.js.push(`tl.fromTo('#${S.id}-ct${i}', { opacity: 0 }, { opacity: 1, duration: 0.35 }, ${S.T(4.8 + i * 0.12)});`);
    });
    return { notes: [{ text: 'Seven chart types across the ten questions.', at: 4.9 }] };
  }, { base: 8 }),

  design: { base: 21, build: designScene },

  closing: {
    base: 7,
    build(S) {
      S.fadeOut = 0;
      card(S, {
        image: { src: 'assets/images/design-tools-riso.webp', w: 520, space: 36 },
        kicker: 'One sample site, not the answer key.',
        title: 'Your site will look different, and that is expected.',
        sub: 'Check your numbers against the rules in the case, not against this video.',
        subWidth: 1400,
        titleSize: 64,
      });
    },
  },
};

// ---------- Question scenes ----------

function question(nq, { worked = false, chart, line, answer, extra }) {
  const base = worked ? 8 : 6.5;
  return {
    base,
    build(S) {
      const w = S.window(WIN);
      const p = w.img(`q${nq}`);
      const head = w.r(p, 'head');
      w.cam(0, grow(union(head, { x: head.x, y: head.y, w: p.shot.w * 0.8, h: 120 }), 24), { dur: 0, max: 1.45 });
      w.box(grow(head, 2), { label: 'The question', at: 0.5, until: 1.9 });
      w.cam(1.5, full(p), { dur: 1.3, pad: 18 });
      const ans = w.r(p, 'answer');
      const off = worked ? 4.5 : null;
      w.box(ans, { label: 'Written answer', at: 2.6, pos: 'bottom', until: off });
      if (!worked) w.hidden(ans, { at: 2.8 });
      w.box(w.r(p, 'chartBody'), { label: `Chart: ${chart}`, at: 3.3, pos: 'bottom', until: off });
      const notes = [];
      if (worked) {
        w.cam(4.6, grow(union(ans, w.r(p, extra.rect)), 30), { dur: 1.4, max: 1.45 });
        w.box(grow(w.r(p, extra.rect), 4), { label: extra.label, at: 5.6, pos: nq === 1 ? 'bottom' : 'top' });
        notes.push({ text: answer, answer: true, at: 5.0 });
      }
      S.column({
        ...COL,
        kicker: worked ? `Question ${nq} of 10. Worked example.` : `Question ${nq} of 10`,
        title: line,
        titleSize: 44,
        notes,
      });
    },
  };
}

function live(nq, { chart, line, base, actions }) {
  return {
    base,
    build(S) {
      const w = S.window(WIN);
      const id = `q${nq}`;
      const states = Object.keys(S.m.shots).filter((k) => k.startsWith(`${id}-s`)).sort();
      const p = w.img(states[0]);
      const head = w.r(p, 'head');
      w.cam(0, grow(union(head, { x: head.x, y: head.y, w: p.shot.w * 0.8, h: 120 }), 24), { dur: 0, max: 1.45 });
      w.box(grow(head, 2), { label: 'The question', at: 0.5, until: 1.8 });
      w.cam(1.4, full(p), { dur: 1.2, pad: 18 });
      w.box(grow(w.r(p, 'controls'), 2), { label: 'Settings', at: 2.1, until: 2.9 });

      const path = [];
      let t = 2.4;
      const cur0 = w.r(p, actions[0].ctl);
      path.push({ t: 2.3, x: cur0.x + cur0.w * 0.5 + 60, y: cur0.y + 260 });
      const swapAt = [];
      for (const act of actions) {
        const c = w.r(p, act.ctl);
        if (act.kind === 'select') {
          path.push({ t, x: c.x + c.w * 0.6, y: center(c).y, click: true, dur: 0.7 });
          const menu = w.menu(c, act.options, { at: t + 0.75, until: t + 2.0, selected: act.from, pick: act.to, pickAt: t + 1.75 });
          const o = menu.optionAt(act.to);
          path.push({ t: t + 1.1, x: o.x, y: o.y, click: true, dur: 0.5 });
          swapAt.push([act.state, t + 2.05]);
          t += 2.45;
        } else {
          path.push({ t, x: c.x + c.w * 0.55, y: center(c).y, click: true, dur: 0.7 });
          // Typing: the new value appears in the box, then the page recalculates.
          swapAt.push([act.state, t + 1.25]);
          t += 1.7;
        }
      }
      for (const [st, at] of swapAt) w.img(`${id}-s${st}`, { at, fade: 0.1 });
      w.cursor(path, { hide: t + 0.6 });
      const tb = t + 0.2;
      const ans = w.r(p, 'answer');
      w.box(ans, { label: 'The answer updates', at: tb, pos: 'bottom' });
      w.hidden(ans, { at: tb + 0.2 });
      w.box(w.r(p, 'chartBody'), { label: `Chart: ${chart}`, at: tb + 0.7, pos: 'bottom' });
      S.column({ ...COL, kicker: `Question ${nq} of 10`, title: line, titleSize: 44 });
    },
  };
}

// ---------- Feature scenes ----------

function feature(nf, name, note, body, { base = 6.5, titleSize = 52 } = {}) {
  return {
    base,
    build(S) {
      const w = S.window(WIN);
      const extra = body(S, w) || {};
      S.column({
        ...COL,
        kicker: `Required feature ${nf} of 10`,
        title: name,
        titleSize,
        notes: [{ text: note, at: 0.9 }, ...(extra.notes || [])],
      });
    },
  };
}

// ---------- Design and polish: six beats ----------

function designScene(S) {
  const beats = [
    { title: 'Typography', note: 'A serif for headings, a sans serif for text.' },
    { title: 'Color', note: 'A small palette. The answer gets the accent color.' },
    { title: 'Layout and spacing', note: 'One column, even spacing, clear sections.' },
    { title: 'Controls', note: 'Sort icons, hover and focus states.' },
    { title: 'Chart finish', note: 'Titles, axis labels, formatted numbers, tooltips.' },
    { title: 'Finishing touches', note: 'Loading, no matches and a page title.' },
  ];
  const L = 3.5; // seconds per beat
  S.text('Design and polish', { x: COL.x, y: COL.y, w: COL.w, size: 28, cls: 'kicker', at: 0.2 });
  beats.forEach((b, i) => {
    const t0 = i * L;
    const last = i === beats.length - 1;
    S.text(b.title, { x: COL.x, y: COL.y + 44, w: COL.w, size: 52, cls: 'title', at: t0 + 0.15, until: last ? null : t0 + L - 0.3 });
    S.text(b.note, { x: COL.x, y: COL.y + 144, w: COL.w, size: 30, cls: 'note', at: t0 + 0.45, until: last ? null : t0 + L - 0.3 });
  });
  const win = (i) => {
    const w = S.window({ ...WIN, at: i === 0 ? 0 : i * L });
    if (i < beats.length - 1) w.hideAt((i + 1) * L - 0.3, 0.3);
    return w;
  };

  // a. Typography
  {
    const w = win(0);
    const p = w.img('top');
    const h1 = w.r(p, 'h1'), lead = w.r(p, 'lead');
    w.cam(0, grow(union(h1, lead), 60), { dur: 0, max: 1.3 });
    w.box(grow(h1, 6), { label: 'Headings: serif', at: 0.6 });
    w.box(grow(lead, 6), { label: 'Text: sans serif', at: 1.3, pos: 'bottom' });
  }
  // b. Color
  {
    const w = win(1);
    w.cam(0, { x: 0, y: 0, w: WIN.w, h: WIN.h }, { dur: 0, scale: 1, pad: 0 });
    const k = 0.98;
    const p = w.img('chart-q1', { x: 24, y: 24, k });
    const key = S.m.shots['chart-q1'].rects;
    void key;
    const pal = S.m.site.palette;
    const sw = [
      [pal['--accent'], 'Accent: the answer'],
      [pal['--accent-2'], 'Blue: controls'],
      [pal['--quiet'], 'Quiet: everything else'],
      [pal['--ink'], 'Ink: text'],
      [pal['--surface-2'], 'Warm grey: panels'],
    ];
    const x0 = 24 + 657 * k + 40;
    sw.forEach(([color, label], i) => {
      const y0 = 70 + i * 128;
      w.add(`<div id="${S.id}-sw${i}" style="position:absolute;left:${x0}px;top:${y0}px;width:72px;height:72px;border-radius:12px;background:${color};box-shadow:0 0 0 1px rgba(22,24,29,0.12)"></div>`);
      w.add(`<p id="${S.id}-swl${i}" style="position:absolute;left:${x0 + 92}px;top:${y0 + 16}px;margin:0;font-size:28px;font-weight:600;color:${C.black};white-space:nowrap">${label}</p>`);
      S.copy.push(label);
      S.js.push(`tl.fromTo(['#${S.id}-sw${i}', '#${S.id}-swl${i}'], { opacity: 0 }, { opacity: 1, duration: 0.35 }, ${S.T(L + 0.4 + i * 0.15)});`);
    });
    const tip = S.m.shots['tip-q1'].rects;
    const bar = { x: p.x + tip.bar.x * k, y: p.y + tip.bar.y * k, w: tip.bar.w * k, h: tip.bar.h * k };
    w.box(grow(bar, 4), { label: 'Davis, CA: the answer', at: L + 1.4, pos: 'bottom' });
  }
  // c. Layout and spacing
  {
    const w = win(2);
    w.cam(0, { x: 0, y: 0, w: WIN.w, h: WIN.h }, { dur: 0, scale: 1, pad: 0 });
    const k = 0.36;
    const x = (WIN.w - 1920 * k) / 2;
    const tiles = S.m.site.pageTiles.slice(0, 3);
    let y = 0;
    const ids = [];
    for (const t of tiles) {
      const pl = w.img(t, { x, y, k });
      ids.push(pl.id);
      y += S.m.shots[t].h * k;
    }
    // A slow drift down the page.
    S.js.push(`tl.fromTo([${ids.map((i) => `'#${i}'`).join(',')}], { y: '+=0' }, { y: '-=${(y - WIN.h).toFixed(0) > 0 ? Math.min(y - WIN.h, 900).toFixed(0) : 0}', duration: ${L - 0.4}, ease: 'none' }, ${S.T(2 * L)});`);
    const colX = x + 424 * k, colW = 1072 * k;
    w.box({ x: colX, y: 90, w: colW, h: WIN.h - 130 }, { label: 'One column, one width', at: 2 * L + 0.6, pad: 10 });
  }
  // d. Controls
  {
    const w = win(3);
    w.cam(0, { x: 0, y: 0, w: WIN.w, h: WIN.h }, { dur: 0, scale: 1, pad: 0 });
    const f7 = S.m.shots['f7-s1'];
    const col = f7.text.sortCol;
    const th = f7.rects[`th${col}`];
    const crop = { x: th.x - 260, y: th.y - 30, w: th.w + 520, h: th.h + 60 };
    const k1 = 1060 / crop.w;
    const a = w.img('f7-s1', { x: (WIN.w - crop.w * k1) / 2, y: 60, k: k1, crop, frame: `border-radius:10px;box-shadow:0 0 0 2px ${C.line}` });
    w.box(grow(w.r(a, `icon${col}`), 6), { label: 'Sort icon', at: 3 * L + 0.5, pos: 'top' });
    const foot = S.m.shots['ctl-hover'].rects.copy;
    const c2 = { x: foot.x - 30, y: foot.y - 26, w: foot.w + 60, h: foot.h + 52 };
    const k2 = 470 / c2.w;
    const hv = w.img('ctl-hover', { x: 70, y: 390, k: k2, crop: c2, frame: `border-radius:10px;box-shadow:0 0 0 2px ${C.line}` });
    const fc = w.img('ctl-focus', { x: WIN.w - 70 - c2.w * k2, y: 390, k: k2, crop: c2, frame: `border-radius:10px;box-shadow:0 0 0 2px ${C.line}` });
    w.box(hv.box, { label: 'Hover', at: 3 * L + 1.0, pos: 'bottom', pad: 4 });
    w.box(fc.box, { label: 'Keyboard focus', at: 3 * L + 1.4, pos: 'bottom', pad: 4 });
  }
  // e. Chart finish
  {
    const w = win(4);
    w.cam(0, { x: 0, y: 0, w: WIN.w, h: WIN.h }, { dur: 0, scale: 1, pad: 0 });
    const k = 0.84;
    const a = w.img('tip-q1', { x: 30, y: 60, k });
    const b = w.img('dark-tip-q1', { x: WIN.w - 30 - 657 * k, y: 60, k });
    w.box(grow(w.r(a, 'caption'), 4), { label: 'Title and subtitle', at: 4 * L + 0.4 });
    w.box(grow(w.r(a, 'tooltip'), 4), { label: 'Tooltip', at: 4 * L + 1.0, pos: 'bottom' });
    w.box(grow(full(b), 0), { label: 'Same chart in dark mode', at: 4 * L + 1.6, pos: 'top-right', pad: 2 });
  }
  // f. Finishing touches
  {
    const w = win(5);
    w.cam(0, { x: 0, y: 0, w: WIN.w, h: WIN.h }, { dur: 0, scale: 1, pad: 0 });
    const ls = S.m.shots.loading.rects.status;
    const c1 = { x: ls.x - 30, y: ls.y - 24, w: 560, h: ls.h + 48 };
    const k1 = 1.25;
    const l = w.img('loading', { x: 60, y: 70, k: k1, crop: c1, frame: `border-radius:10px;box-shadow:0 0 0 2px ${C.line}` });
    const eb = S.m.shots.empty.rects.banner;
    const c2 = { x: eb.x - 24, y: eb.y - 20, w: eb.w + 48, h: eb.h + 40 };
    const k2 = Math.min(1050 / c2.w, 1.4);
    const e = w.img('empty', { x: 60, y: 300, k: k2, crop: c2, frame: `border-radius:10px;box-shadow:0 0 0 2px ${C.line}` });
    w.box(l.box, { label: 'Loading message', at: 5 * L + 0.4, pos: 'right', pad: 4 });
    w.box(e.box, { label: 'No matches message', at: 5 * L + 0.6, pos: 'top', pad: 4 });
    const title = S.m.site.title;
    const ty = 560;
    w.add(`<p id="${S.id}-ptl" style="position:absolute;left:60px;top:${ty}px;margin:0;font-size:28px;font-weight:600;color:${C.black};white-space:nowrap">Page title, as the browser tab shows it</p>`);
    w.add(`<p id="${S.id}-pt" style="position:absolute;left:60px;top:${ty + 48}px;margin:0;padding:16px 24px;font-size:34px;font-weight:600;color:${C.black};background:#fff;border:2px solid ${C.black};border-radius:10px;white-space:nowrap">${title}</p>`);
    S.copy.push('Page title, as the browser tab shows it', title);
    S.js.push(`tl.fromTo(['#${S.id}-ptl', '#${S.id}-pt'], { opacity: 0 }, { opacity: 1, duration: 0.4 }, ${S.T(5 * L + 0.8)});`);
  }
}
