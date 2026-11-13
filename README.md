# College-Town Home Sales: one sample site (demo video)

This repository holds the source of a short narrated video (4 minutes 36 seconds) that walks through one sample website for the College-Town Home Sales data analytics case. The case asks learners to build, with a coding agent, a website that analyzes home sales in U.S. college towns.

The video shows one possible finished site: how it answers the case's questions, and how it meets the required features and the design items. It is not the answer key and not the only right design. The video says this at the start and at the end, and the narration repeats through the questions and the design section that other charts, colors and layouts work just as well.

The video is made with [HyperFrames](https://github.com/heygen-com/hyperframes), which renders HTML to video. Every scene is built from screenshots of the real site, taken with headless Chrome.

## What is where

| Path | What it holds |
|---|---|
| `video.config.json` | The switches: resolution, answer visibility, frame rate, quality, and the address of the site to capture. |
| `scenes.json` | Every scene's id, start and duration. The one place for timing. |
| `scripts/scenes.mjs` | What each scene shows: text, camera moves, highlight boxes, cursor and dropdowns. Also the "one example" notes that span each section. |
| `scripts/lib/kit.mjs` | The building blocks the scenes use, and the layout rules (text sizes, caption band). |
| `scripts/capture.mjs` | Captures every state of the site the video needs. |
| `scripts/verify-numbers.mjs` | Checks the captured answers against the check list. |
| `scripts/build.mjs` | Writes `index.html` and `compositions/*.html` from the files above. |
| `scripts/render.mjs` | Renders the video. |
| `captures/` | The screenshots, a `.learner.png` copy of each one that shows answers, and `manifest.json` (element positions and answer text). |
| `compositions/`, `index.html` | The HyperFrames project. Generated: edit `scenes.json` and `scripts/scenes.mjs` instead. |
| `docs/scene-plan.md` | The approved scene plan. |
| `docs/on-screen-text.md` | Every line of on-screen text, by scene. Generated. |
| `renders/` | Rendered videos. Not committed: they go to GitHub releases. |
| `.github/workflows/render.yml` | Renders the three versions on GitHub and attaches them to a release. |

## Requirements

- Node.js 22 or later, and FFmpeg.
- Chrome for rendering: `npx hyperframes browser ensure` installs the one HyperFrames uses.
- Playwright with Chromium, for capturing: `npm install`, then `npx playwright install chromium`.

Run `npx hyperframes doctor` to check the setup. Whisper, music and Docker are optional and not needed. Text to speech is needed only to regenerate the narration (see Voiceover).

## The switches

All in `video.config.json`:

| Setting | Values | What it does |
|---|---|---|
| `RESOLUTION` | `"4k"` (default) or `"1080p"` | The video is laid out once at 1920x1080. For 4K, HyperFrames renders the same layout at twice the pixel density (`--resolution 4k`), so text, boxes and the cursor scale with it and the layout does not change. |
| `VOICEOVER` | `true` (default) or `false` | Include the narration from `assets/voice/`. |
| `SFX` | `true` (default) or `false` | Include the sound effects from `assets/sfx/`. |
| `SHOW_ALL_ANSWERS` | `false` (default) or `true` | `false` is the learner version: Q1 and Q2 are shown in full as worked examples, while the answer text and chart data labels of Q3 to Q10 and the insights text are blurred. `true` is the instructor version, with every answer visible. |
| `FPS` | `30` | Frame rate. |
| `QUALITY` | `"high"` | HyperFrames render quality (`draft`, `looks`, `high`). |
| `SITE_URL` | the sample site's address | The page that `scripts/capture.mjs` captures. It never appears in the video. |

The render script can also override the first two for one render: `--answers all` or `--answers hidden`, and `--resolution 4k` or `--resolution 1080p`.

## Re-render

```bash
npm run render:all
```

This rebuilds the project and writes the three deliverables:

| File | Version |
|---|---|
| `renders/sample-site-demo.mp4` | Learner, 4K (3840x2160) |
| `renders/sample-site-demo-instructor.mp4` | Instructor, 4K |
| `renders/sample-site-demo-1080p.mp4` | Learner, 1920x1080, for platforms with upload size limits |

To render one version with the settings in `video.config.json`:

```bash
npm run render
```

A 4K render takes about 15 minutes on a 4-core machine, and the 1080p version about 5. To look at the video before rendering, run `npm run preview` and open the Studio link it prints.

## Render on GitHub

The workflow in `.github/workflows/render.yml` renders all three versions on GitHub, so nothing has to run on your own computer. Start it from the Actions tab: **Render video**, then **Run workflow**. It has three options:

- **Recapture the live site first.** Off by default, which renders from the committed captures. When on, it captures the site again and checks the numbers against the check list. If any number differs, the run stops before rendering. The new captures are kept as a workflow artifact, not committed.
- **Attach the videos to a new GitHub release.** On by default.
- **Release tag.** Leave it blank for `video-<run number>`.

The three versions render in parallel, one per runner. Each 4K render takes roughly 15 to 30 minutes, depending on the runner. Each video is checked with OCR (see below) before it is uploaded, and the release is created only if all three pass. The videos are attached to the release rather than committed: GitHub does not accept files over 100 MB in the repository, and a release accepts files up to 2 GB. Each run's videos also stay as workflow artifacts for 14 days.

## Check a render

```bash
python3 scripts/check-render.py renders/sample-site-demo.mp4 learner
```

```bash
python3 scripts/check-render.py renders/sample-site-demo-instructor.mp4 instructor
```

The script samples one frame a second, reads it with OCR (Tesseract: `apt-get install tesseract-ocr`), and fails if it finds the site's domain, a URL, the username, the repository name, GitHub or the dataset's source institution. For the learner version it also fails on any Q3 to Q10 answer value from the check list. For the instructor version it lists the answer values it found, which shows that the OCR works. OCR cannot prove that nothing is there, so also step through the video by eye.

## Recapture the site

Recapture when the site changes:

```bash
npm run capture
```

```bash
npm run verify
```

```bash
npm run build
```

```bash
npm run check
```

1. `npm run capture` opens the site in headless Chrome at 1920x1080 (desktop) and 390x844 (phone), device scale factor 3. Close-ups that the video zooms into (the range filter, the sort icons, hover and focus states) are captured at scale factor 5. Every interaction is scripted: changing Q7 to Q10 settings, dragging the range slider, clicking the map, sorting, switching to dark mode, loading the page from a shared query string. To recapture only some shots, pass name prefixes, for example `node scripts/capture.mjs q7 f3`.
2. `npm run verify` reads every answer from the captures and compares it with the check list. If anything does not match, it stops with a list of the differences. Do not change a number to make it match: find out why it differs.
3. `npm run build` rewrites the scenes. Highlight boxes and the cursor follow the element positions recorded at capture time, so small layout changes on the site are picked up.
4. `npm run check` runs HyperFrames' lint, layout and contrast checks.

### What the captures hide

The capture script blurs parts of the page inside the browser before each screenshot, so the layout stays real:

- In every capture: the footer and the dataset citation card. They name the data source and link to the site's code, and nothing in the video may lead back to the site or its repository.
- In the learner copies (`*.learner.png`): the Q3 to Q10 written answers, the data labels on their charts, the rank labels on the Q3 slope chart, and the insights text.

The video never shows the browser's address bar, tabs, the site's domain, the repository name or a username. Feature 5 (shareable filters) shows only the query string, in a box drawn by the video.

## Voiceover

The narration is in `narration.json`, one line per scene id, read by the ElevenLabs voice Drew (`q0IMILNRPxOgtBTS4taI`). Both versions share one audio track, so the narration never states a Q3 to Q10 answer.

```bash
npm run voiceover
```

This generates a clip for each new or changed line in `assets/voice/`, evens out the loudness, and lengthens any scene in `scenes.json` that is shorter than its line (it never shortens one). Then run `npm run build`. It needs an ElevenLabs API key in `ELEVENLABS_API_KEY`, sent in the `xi-api-key` header. `node scripts/voiceover.mjs --dry-run` shows what would be generated and how many characters it costs. Set `VOICEOVER` to `false` in `video.config.json` to render without narration. The clips are committed, so rendering (locally or in the GitHub workflow) never calls ElevenLabs.

Where narration lengthens a scene, the scene's beats stretch in proportion, and the question scenes end on a slow push-in so the camera never sits still for long. After generating, it is worth transcribing the clips back (for example with ElevenLabs speech to text) and comparing them with `narration.json`, to catch a skipped or misread word.

## Sound effects

Quiet sounds on visible actions: a click wherever the cursor clicks, light typing wherever a value is typed, a pencil stroke for the two hand-drawn underlines, and a soft whoosh on the section cards. The sounds are in `sfx.json` (a prompt, a length and a playback volume for each), made with ElevenLabs text to sound v3 (`eleven_text_to_sound_v3`).

```bash
npm run sfx
```

This generates each new or changed sound in `assets/sfx/`, trims its leading silence and sets its peak to -3 dBFS. Then run `npm run build`. The scenes decide where sounds go: the kit records a cue whenever it animates one of those actions (`Scene.cue` in `scripts/lib/kit.mjs`), so cues follow the timing when scenes change. The volumes in `sfx.json` keep them well under the narration. Set `SFX` to `false` in `video.config.json` to render without them. Like the voice clips, the sounds are committed.

## Change the timing

Each scene has a stable id in `scenes.json` (`title`, `first-look`, `q1` to `q10`, `insights`, `feature-01` to `feature-10`, `design`, `closing`). To fit a scene to narration, change its `duration` and run `npm run build`. Every later scene moves to match, and the beats inside the scene stretch or shrink in proportion. The bottom 200 pixels of the frame (at 1080p) are kept empty for captions.

## Writing rules for on-screen text

Plain English, short sentences, one or two lines. No em dashes, en dashes, arrows or other decorative symbols. At least 28 px at 1080p (56 px at 4K). Each line stays on screen long enough to read. The build stops if a line breaks the symbol rule. Keep everything general: no course, school, instructor, term, due date or points.
