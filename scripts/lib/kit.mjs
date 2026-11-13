// Building blocks for the scenes: the text column, the site window with its camera, highlight
// boxes, the cursor, dropdown lists and the answer switch. Every scene is written out as a
// static HyperFrames composition by scripts/build.mjs.
//
// Coordinates: the frame is authored at 1920x1080 and rendered at 4K by supersampling, so every
// size here is in 1080p pixels and doubles at 4K. Inside a window, "stage" coordinates are the
// site's CSS pixels; the camera scales the stage, and overlays divide their sizes by the camera
// scale so they keep a constant size on screen.

export const FRAME = { W: 1920, H: 1080 };
// Nothing important below this line: the band is kept free for captions.
export const CAPTION_TOP = 880;
// Smallest text the video draws, at 1080p.
export const MIN_TEXT = 28;

export const C = {
  // The video's own colours: a light, neutral grey ground and black type, boxes and labels.
  // (The site's own colours appear only in the captures and the palette swatches.)
  ground: '#f4f4f5',
  black: '#111111',
  paper: '#ffffff',
  ink: '#16181d',
  ink2: '#4a4d55',
  muted: '#6d6e73',
  line: '#e7e5df',
  accent: '#eb6834',
  accentInk: '#b8451a',
  blue: '#2a78d6',
  blueSoft: 'rgba(42, 120, 214, 0.12)',
  quiet: '#bdbab0',
};

export const FONTS_CSS = `
  @font-face { font-family: 'Inter Site'; src: url('assets/fonts/Inter-latin.woff2') format('woff2'); font-weight: 100 900; font-style: normal; }
  @font-face { font-family: 'Source Serif 4'; src: url('assets/fonts/SourceSerif4-latin.woff2') format('woff2'); font-weight: 600; font-style: normal; }
`;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (v) => +(+v).toFixed(2);
// Writing rules for on-screen text: no em or en dashes, no arrows or decorative symbols.
const FORBIDDEN = /[–—←-⇿•■-◿☀-➿]/;
function checkCopy(text) {
  if (FORBIDDEN.test(text)) throw new Error(`On-screen text breaks the writing rules: ${text}`);
  return text;
}

export class Scene {
  constructor({ id, duration, base, manifest }) {
    this.id = id;
    this.duration = duration;
    this.pace = base ? duration / base : 1; // beats stretch when a scene is lengthened for narration
    this.m = manifest;
    this.html = [];
    this.css = [];
    this.js = [];
    this.count = 0;
    this.fadeIn = 0.45;
    this.fadeOut = 0.35;
    this.copy = []; // every line of on-screen text, for the review list
  }

  // Beat time: a moment in the scene's design, stretched with the scene.
  T(t) {
    return n(Math.min(t * this.pace, this.duration - 0.05));
  }

  uid(prefix) {
    this.count += 1;
    return `${this.id}-${prefix}${this.count}`;
  }

  shot(name) {
    const s = this.m.shots[name];
    if (!s) throw new Error(`No capture named ${name}. Run npm run capture.`);
    return s;
  }

  // ---------- Text ----------

  // The left column: a kicker, a main line and notes that appear in turn.
  column({ x = 110, y = 150, w = 490, kicker, title, titleSize = 46, notes = [], at = 0.25 }) {
    const id = this.uid('col');
    const parts = [];
    let t = at;
    if (kicker) {
      const kid = `${id}-k`;
      parts.push(`<p id="${kid}" class="kicker">${esc(checkCopy(kicker))}</p>`);
      this.copy.push(kicker);
      this.js.push(`tl.fromTo('#${kid}', { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' }, ${this.T(t)});`);
      t += 0.15;
    }
    if (title) {
      const tid = `${id}-t`;
      parts.push(`<h2 id="${tid}" class="title" style="font-size:${titleSize}px">${esc(checkCopy(title))}</h2>`);
      this.copy.push(title);
      this.js.push(`tl.fromTo('#${tid}', { opacity: 0, filter: 'blur(8px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.5, ease: 'power3.out' }, ${this.T(t)});`);
    }
    notes.forEach((note, i) => {
      const nid = `${id}-n${i}`;
      const cls = note.chip ? 'chip' : note.answer ? 'note answer' : 'note';
      parts.push(`<p id="${nid}" class="${cls}${note.learner ? ' v-learner' : ''}">${esc(checkCopy(note.text))}</p>`);
      this.copy.push(note.text);
      this.js.push(`tl.fromTo('#${nid}', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }, ${this.T(note.at)});`);
      if (note.until != null) this.js.push(`tl.to('#${nid}', { opacity: 0, duration: 0.25, ease: 'power2.in' }, ${this.T(note.until)});`);
    });
    this.html.push(`<div id="${id}" class="column" style="left:${x}px;top:${y}px;width:${w}px">${parts.join('\n')}</div>`);
    return id;
  }

  // Free text anywhere on screen.
  text(str, { x, y, w, size = 32, cls = 'note', at = 0, until, align = 'left', style = '' }) {
    const id = this.uid('tx');
    this.copy.push(str);
    this.html.push(`<p id="${id}" class="${cls}" style="position:absolute;left:${x}px;top:${y}px;width:${w}px;font-size:${size}px;text-align:${align};${style}">${esc(checkCopy(str))}</p>`);
    this.js.push(`tl.fromTo('#${id}', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }, ${this.T(at)});`);
    if (until != null) this.js.push(`tl.to('#${id}', { opacity: 0, duration: 0.25, ease: 'power2.in' }, ${this.T(until)});`);
    return id;
  }

  raw(html) {
    this.html.push(html);
  }

  window(opts) {
    return new Win(this, opts);
  }

  // ---------- Output ----------

  file() {
    const D = this.duration;
    const content = `${this.id}-content`;
    const fade = [
      this.fadeIn > 0 ? `tl.fromTo('#${content}', { opacity: 0 }, { opacity: 1, duration: ${this.fadeIn}, ease: 'power2.out' }, 0);` : '',
      this.fadeOut > 0 ? `tl.to('#${content}', { opacity: 0, duration: ${this.fadeOut}, ease: 'power2.in' }, ${n(D - this.fadeOut - 0.02)});` : '',
    ].join('\n    ');
    return `<template>
  <style>
    ${FONTS_CSS}
    #root { position: absolute; inset: 0; overflow: hidden; background: ${C.ground}; font-family: 'Inter Site', sans-serif; color: ${C.black}; letter-spacing: -0.012em; }
    #root .content { position: absolute; inset: 0; }
    #root .column { position: absolute; display: flex; flex-direction: column; gap: 22px; }
    #root .kicker { margin: 0; font-size: 28px; font-weight: 600; color: ${C.black}; }
    #root .title { margin: 0; font-family: 'Source Serif 4', serif; font-weight: 600; line-height: 1.14; letter-spacing: -0.01em; color: ${C.black}; }
    #root .note { margin: 0; font-size: 30px; line-height: 1.38; color: ${C.black}; }
    #root .note.answer { color: ${C.black}; font-weight: 600; padding: 14px 18px; background: #fff; border-left: 6px solid ${C.black}; border-radius: 6px; }
    #root .chip { margin: 0; align-self: flex-start; font-size: 28px; font-weight: 600; color: ${C.black}; background: #fff; border: 2px solid ${C.black}; border-radius: 999px; padding: 8px 20px; }
    #root .win { position: absolute; overflow: hidden; background: #fff; border-radius: 16px; box-shadow: 0 0 0 1px rgba(0,0,0,0.08), 0 18px 50px rgba(0,0,0,0.08); }
    #root .stage { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
    #root .shot, #root .shot img { position: absolute; left: 0; top: 0; display: block; }
    #root .box { position: absolute; box-sizing: border-box; border-style: solid; border-color: ${C.black}; }
    #root .lbl { position: absolute; white-space: nowrap; font-weight: 600; color: #fff; background: ${C.black}; line-height: 1.2; }
    #root .hid { position: absolute; white-space: nowrap; font-weight: 600; color: #fff; background: ${C.black}; line-height: 1.2; }
    #root .cursor { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
    #root .menu { position: absolute; background: #fff; border-style: solid; border-color: rgba(0,0,0,0.2); box-shadow: 0 8px 28px rgba(0,0,0,0.16); overflow: hidden; }
    #root .menu p { margin: 0; color: ${C.black}; white-space: nowrap; }
    #root .mono { font-family: 'JetBrains Mono', monospace; letter-spacing: 0; }
    ${this.css.join('\n    ')}
  </style>
  <div id="root" data-composition-id="${this.id}" data-width="${FRAME.W}" data-height="${FRAME.H}">
    <div id="${content}" class="content">
      ${this.html.join('\n      ')}
    </div>
  </div>
  <script>
    // Answer switch: SHOW_ALL_ANSWERS comes from the render (--variables), else the declared default.
    (function () {
      var o = window.__hfVariables || {};
      var show;
      if (Object.prototype.hasOwnProperty.call(o, 'SHOW_ALL_ANSWERS')) show = !!o.SHOW_ALL_ANSWERS;
      else {
        try {
          var d = JSON.parse(document.documentElement.getAttribute('data-composition-variables') || '[]');
          show = !!(d.find(function (x) { return x.id === 'SHOW_ALL_ANSWERS'; }) || {}).default;
        } catch (e) { show = false; }
      }
      document.documentElement.setAttribute('data-answers', show ? 'all' : 'hidden');
    })();
    const tl = gsap.timeline({ paused: true });
    ${fade}
    ${this.js.join('\n    ')}
    window.__timelines["${this.id}"] = tl;
  </script>
</template>
`;
  }
}

// A plain white panel that shows the site, with a camera. No browser bar, tabs or address.
export class Win {
  constructor(scene, { x = 640, y = 96, w = 1170, h = 768, at = 0, radius = 16, bg = '#fff', id } = {}) {
    if (y + h > CAPTION_TOP + 1) throw new Error(`Window in ${scene.id} reaches into the caption band`);
    this.s = scene;
    Object.assign(this, { x, y, w, h });
    this.id = id || scene.uid('win');
    this.stageId = `${this.id}-stage`;
    this.items = [];
    this.keys = [{ t: 0, s: 1, tx: 0, ty: 0 }];
    this.cursorId = null;
    this.at = at;
    scene.html.push(`@@WIN:${this.id}@@`);
    this.style = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:${radius}px;background:${bg}`;
    if (at > 0) scene.js.push(`tl.fromTo('#${this.id}', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, ${scene.T(at)});`);
    scene.windows = scene.windows || [];
    scene.windows.push(this);
    this._origFile = null;
  }

  // Camera scale at a beat time (the target of the move under way).
  scaleAt(t) {
    let k = this.keys[0];
    for (const key of this.keys) if (key.t <= t + 1e-6) k = key;
    return k.s;
  }

  // Places a capture on the stage. Both the clear and the learner copy are placed when the
  // capture has one; the answer switch shows one of them.
  img(name, { x = 0, y = 0, k = 1, at = null, until = null, fade = 0.3, id, crop = null, frame = '' } = {}) {
    const shot = this.s.shot(name);
    const sid = id || this.s.uid('img');
    const w = n(shot.w * k), h = n(shot.h * k);
    const c = crop || { x: 0, y: 0, w: shot.w, h: shot.h };
    const off = `left:${n(-c.x * k)}px;top:${n(-c.y * k)}px`;
    const imgs = shot.learner
      ? `<img class="v-full" src="captures/${name}.png" width="${w}" height="${h}" style="${off}" alt=""><img class="v-learner" src="captures/${name}.learner.png" width="${w}" height="${h}" style="${off}" alt="">`
      : `<img src="captures/${name}.png" width="${w}" height="${h}" style="${off}" alt="">`;
    this.items.push(`<div id="${sid}" class="shot" style="left:${x}px;top:${y}px;width:${n(c.w * k)}px;height:${n(c.h * k)}px;overflow:hidden;${frame}">${imgs}</div>`);
    if (at != null) this.s.js.push(`tl.fromTo('#${sid}', { opacity: 0 }, { opacity: 1, duration: ${fade}, ease: 'power1.inOut' }, ${this.s.T(at)});`);
    if (until != null) this.s.js.push(`tl.to('#${sid}', { opacity: 0, duration: ${fade}, ease: 'power1.inOut' }, ${this.s.T(until)});`);
    this.maxDsf = Math.max(this.maxDsf || 0, shot.dsf / k);
    this.minDsf = Math.min(this.minDsf || 99, shot.dsf / k);
    return { name, x: x - c.x * k, y: y - c.y * k, k, shot, id: sid, box: { x, y, w: c.w * k, h: c.h * k } };
  }

  // Fades the whole window out (for a scene that swaps windows).
  hideAt(t, dur = 0.35) {
    this.s.js.push(`tl.to('#${this.id}', { opacity: 0, duration: ${dur}, ease: 'power2.in' }, ${this.s.T(t)});`);
  }

  // A rectangle from a capture's manifest, in stage coordinates.
  r(place, key, grow = 0) {
    const rr = typeof key === 'string' ? place.shot.rects[key] : key;
    if (!rr) throw new Error(`No rect ${key} in ${place.name}`);
    return { x: place.x + (rr.x - grow) * place.k, y: place.y + (rr.y - grow) * place.k, w: (rr.w + 2 * grow) * place.k, h: (rr.h + 2 * grow) * place.k };
  }

  // Moves the camera so a stage rectangle fills the window. align: center | top
  cam(t, focus, { dur = 1.4, ease = 'power2.inOut', pad = 28, max = 1.5, align = 'center', scale } = {}) {
    let s = scale || Math.min((this.w - 2 * pad) / focus.w, (this.h - 2 * pad) / focus.h);
    s = Math.min(s, max);
    const tx = this.w / 2 - (focus.x + focus.w / 2) * s;
    const ty = align === 'top' ? pad - focus.y * s : this.h / 2 - (focus.y + focus.h / 2) * s;
    const T = this.s.T(t);
    this.keys.push({ t: T, s, tx, ty });
    this.keys.sort((a, b) => a.t - b.t);
    if (dur === 0 || T === 0) this.s.js.push(`tl.set('#${this.stageId}', { x: ${n(tx)}, y: ${n(ty)}, scale: ${+s.toFixed(4)} }, ${T});`);
    else this.s.js.push(`tl.to('#${this.stageId}', { x: ${n(tx)}, y: ${n(ty)}, scale: ${+s.toFixed(4)}, duration: ${dur}, ease: '${ease}' }, ${T});`);
    this.camMax = Math.max(this.camMax || 0, s);
    return s;
  }

  // A pan at constant speed between two camera settings (used for scrolling).
  pan(t, dur, focus, opts = {}) {
    return this.cam(t, focus, { dur, ease: opts.ease || 'none', ...opts });
  }

  // An outlined highlight box with a small label.
  box(rect, { label, at, until = null, color = 'accent', pos = 'top', pad = 8 }) {
    const T = this.s.T(at);
    const s = this.scaleAt(T);
    const id = this.s.uid('box');
    const b = 3 / s, p = pad / s;
    const cls = color === 'blue' ? ' blue' : '';
    this.items.push(`<div id="${id}" class="box${cls}" style="left:${n(rect.x - p)}px;top:${n(rect.y - p)}px;width:${n(rect.w + 2 * p)}px;height:${n(rect.h + 2 * p)}px;border-width:${n(b)}px;border-radius:${n(8 / s)}px"></div>`);
    const ids = [`#${id}`];
    if (label) {
      checkCopy(label);
      this.s.copy.push(label);
      const lid = `${id}-l`;
      const fs = MIN_TEXT / s;
      const lh = fs * 1.2 + 2 * (6 / s);
      let style;
      if (pos === 'top') style = `left:${n(rect.x - p)}px;top:${n(rect.y - p - lh + b)}px`;
      else if (pos === 'bottom') style = `left:${n(rect.x - p)}px;top:${n(rect.y + rect.h + p - b)}px`;
      else if (pos === 'inside') style = `left:${n(rect.x - p + b)}px;top:${n(rect.y - p + b)}px`;
      else if (pos === 'right') style = `left:${n(rect.x + rect.w + p - b)}px;top:${n(rect.y - p)}px`;
      else if (pos === 'top-right') style = `right:auto;left:${n(rect.x + rect.w + p)}px;top:${n(rect.y - p - lh + b)}px;transform:translateX(-100%)`;
      this.items.push(`<p id="${lid}" class="lbl${cls}" style="${style};font-size:${n(fs)}px;padding:${n(6 / s)}px ${n(12 / s)}px;border-radius:${n(6 / s)}px;margin:0">${esc(label)}</p>`);
      ids.push(`#${lid}`);
    }
    this.s.js.push(`tl.fromTo([${ids.map((i) => `'${i}'`).join(',')}], { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' }, ${T});`);
    if (until != null) this.s.js.push(`tl.to([${ids.map((i) => `'${i}'`).join(',')}], { opacity: 0, duration: 0.3, ease: 'power2.in' }, ${this.s.T(until)});`);
    return id;
  }

  // Learner version only: a small chip on a hidden answer.
  hidden(rect, { at, until = null, text = 'Answer hidden in this version' }) {
    const T = this.s.T(at);
    const s = this.scaleAt(T);
    const id = this.s.uid('hid');
    const fs = MIN_TEXT / s;
    this.s.copy.push(text);
    this.items.push(`<div class="v-learner"><p id="${id}" class="hid" style="left:${n(rect.x + rect.w / 2)}px;top:${n(rect.y + rect.h / 2)}px;transform:translate(-50%,-50%);font-size:${n(fs)}px;padding:${n(8 / s)}px ${n(16 / s)}px;border-radius:${n(999)}px;margin:0">${esc(text)}</p></div>`);
    this.s.js.push(`tl.fromTo('#${id}', { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' }, ${T});`);
    if (until != null) this.s.js.push(`tl.to('#${id}', { opacity: 0, duration: 0.3 }, ${this.s.T(until)});`);
  }

  // The animated cursor. steps: [{ t, x, y, click, dur }]. Positions are stage coordinates.
  cursor(steps, { size = 34, appear = null, hide = null } = {}) {
    const id = this.s.uid('cur');
    this.cursorId = id;
    const s0 = this.scaleAt(this.s.T(steps[0].t));
    const k = 1 / s0;
    const svg = `<svg width="${size}" height="${size * 1.25}" viewBox="0 0 24 30" aria-hidden="true"><path d="M2 2 L2 24 L8 18.5 L12 27.5 L16 25.8 L12.2 17 L20 17 Z" fill="${C.black}" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
    this.items.push(`<div id="${id}" class="cursor"><div id="${id}-i" style="transform-origin:2px 2px">${svg}</div></div>`);
    const first = steps[0];
    const T0 = this.s.T(appear != null ? appear : first.t);
    this.s.js.push(`tl.set('#${id}', { x: ${n(first.x)}, y: ${n(first.y)}, scale: ${n(k)} }, 0);`);
    this.s.js.push(`tl.fromTo('#${id}', { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' }, ${T0});`);
    for (const st of steps.slice(1)) {
      const T = this.s.T(st.t);
      const kk = 1 / this.scaleAt(T);
      const d = st.dur || 0.8;
      this.s.js.push(`tl.to('#${id}', { x: ${n(st.x)}, y: ${n(st.y)}, scale: ${n(kk)}, duration: ${d}, ease: 'power2.inOut' }, ${T});`);
      if (st.press) this.s.js.push(`tl.to('#${id}-i', { scale: 0.82, duration: 0.09, ease: 'power2.out' }, ${n(T + d + 0.05)});`);
      if (st.release) this.s.js.push(`tl.to('#${id}-i', { scale: 1, duration: 0.16, ease: 'power2.out' }, ${T});`);
      if (st.click) {
        const tc = n(T + d + 0.05);
        this.s.js.push(`tl.to('#${id}-i', { scale: 0.82, duration: 0.09, ease: 'power2.out' }, ${tc});`);
        this.s.js.push(`tl.to('#${id}-i', { scale: 1, duration: 0.16, ease: 'power2.out' }, ${n(tc + 0.1)});`);
      }
    }
    if (hide != null) this.s.js.push(`tl.to('#${id}', { opacity: 0, duration: 0.3 }, ${this.s.T(hide)});`);
    return id;
  }

  // A dropdown list drawn by the video, styled like the site's own select menus. Native menus
  // do not appear in screenshots, so the list is shown here with the select's real options.
  menu(anchor, options, { at, until, selected = 0, pick = null, pickAt = null, width = null }) {
    const T = this.s.T(at);
    const s = this.scaleAt(T);
    const id = this.s.uid('menu');
    const fs = MIN_TEXT / s;
    const padY = 8 / s, padX = 16 / s, top = 4 / s;
    const rowH = fs * 1.25 + 2 * padY;
    const rows = options.map((o, i) => {
      checkCopy(o);
      return `<p style="position:absolute;left:0;right:0;top:${n(top + i * rowH)}px;height:${n(rowH)}px;box-sizing:border-box;font-size:${n(fs)}px;line-height:${n(fs * 1.25)}px;padding:${n(padY)}px ${n(padX)}px">${esc(o)}</p>`;
    });
    const w = Math.max(width ? width / s : 0, anchor.w);
    const hl = `<div id="${id}-hl" style="position:absolute;left:0;right:0;top:${n(top + selected * rowH)}px;height:${n(rowH)}px;background:rgba(0,0,0,0.07)"></div>`;
    this.items.push(`<div id="${id}" class="menu" style="left:${n(anchor.x)}px;top:${n(anchor.y + anchor.h + 4 / s)}px;width:${n(w)}px;height:${n(2 * top + options.length * rowH)}px;border-width:${n(1.5 / s)}px;border-radius:${n(8 / s)}px">${hl}${rows.join('')}</div>`);
    this.s.js.push(`tl.fromTo('#${id}', { opacity: 0, y: ${n(-6 / s)} }, { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' }, ${T});`);
    if (pick != null && pickAt != null) {
      this.s.js.push(`tl.to('#${id}-hl', { y: ${n((pick - selected) * rowH)}, duration: 0.18, ease: 'power2.out' }, ${this.s.T(pickAt)});`);
    }
    this.s.js.push(`tl.to('#${id}', { opacity: 0, duration: 0.15, ease: 'power2.in' }, ${this.s.T(until)});`);
    const y0 = anchor.y + anchor.h + 4 / s + top;
    return { optionAt: (i) => ({ x: anchor.x + Math.min(w * 0.5, 160 / s), y: y0 + rowH * (i + 0.5) }) };
  }

  // Free HTML on the stage (for drawn elements).
  add(html) {
    this.items.push(html);
  }

  render() {
    return `<div id="${this.id}" class="win" style="${this.style}"><div id="${this.stageId}" class="stage">${this.items.join('')}</div></div>`;
  }
}

// Inserts every window's markup where it was declared.
export function finish(scene) {
  for (const w of scene.windows || []) {
    const i = scene.html.indexOf(`@@WIN:${w.id}@@`);
    scene.html[i] = w.render();
  }
  return scene.file();
}

export { esc };
