# Scene plan (draft for approval)

Total: 197 s (3 min 17 s). 27 scenes. Every scene has a stable id that a narration script can use.

## Frame layout (all scenes except title and closing)

Authored at 1920x1080 and rendered at 4K with HyperFrames' supersampling (`--resolution 4k`), so text, boxes and the cursor scale together.

- Background: the site's warm grey `#f1f0ec`. Text in `#16181d`. Highlight boxes and labels in the site's accent orange (`#eb6834`, `#b8451a` for label fills). Cursor and "control" labels in the site's blue (`#2a78d6`).
- Fonts: the site's own, Source Serif 4 (headings) and Inter (text).
- Left column (x 96 to 600): kicker (28 px), main line (44 to 52 px serif), one or two notes (30 px).
- Right "site window" (about 1180 x 760): the capture in a plain white rounded panel. No browser bar, tabs or URL. Slow pans and zooms happen inside this window, and highlight boxes and the cursor move with it.
- Bottom 160 px (y 920 to 1080) is kept empty for captions later.

## Scenes

| # | id | Start | Dur | What it shows | On-screen text |
|---|----|------:|----:|---------------|----------------|
| 1 | `title` | 0 | 6 | Title card on the site palette, a soft still of the page top behind it | **College-Town Home Sales: one sample site** / A sample of what your site could look like. Not the answer key, and not the only way. |
| 2 | `first-look` | 6 | 12 | Slow scroll of the whole desktop page, top to bottom. Section names appear as each section passes. | First look / One long page: questions, explore, insights, methods. Chips: Ten questions, Explore, Insights, Data and methods |
| 3 | `questions-intro` | 18 | 4 | Zoom on the section intro and the Q1 to Q10 jump links | Ten questions / Q1 to Q6 always use the full dataset. / Q7 to Q10 update when a visitor changes a setting. |
| 4 | `q1` | 22 | 8 | Q1 heading, written answer, bar chart. Box on the answer and on Davis's accent bar. | Question 1 of 10. Worked example. / Which city has the highest median sale price? / Answer: Davis, CA, $889,000 / Labels: Written answer; Chart: bar chart |
| 5 | `q2` | 30 | 8 | Q2 answer and dumbbell chart, pan down to the "what causes it" paragraph | Question 2 of 10. Worked example. / Which city's mean sale price is furthest above its median? / Answer: Athens, GA, mean 32.8% above median / The answer also explains the cause. / Chart: dumbbell chart |
| 6 | `q3` | 38 | 6.5 | Q3 answer box (hidden) and slope chart (data labels hidden) | Question 3 of 10 / Which cities change rank by mean sale price once the price rule is applied? / Chart: slope chart |
| 7 | `q4` | 44.5 | 6.5 | Same pattern | Question 4 of 10 / How did the median sale price change from 2024 to 2025 in each campus area? / Chart: bar chart |
| 8 | `q5` | 51 | 6.5 | Same pattern | Question 5 of 10 / Which campus areas sell slowest and fastest, by median days on market? / Chart: box plot |
| 9 | `q6` | 57.5 | 6.5 | Same pattern | Question 6 of 10 / Which campus areas have the highest and lowest property tax burden? / Chart: dot chart |
| 10 | `q7` | 64 | 8 | Cursor changes Bedrooms from 3 to 2. Answer and chart update. | Question 7 of 10 / For a chosen number of bedrooms, which city has the lowest median sale price? / Change the setting. The answer and chart update. / Chart: bar chart |
| 11 | `q8` | 72 | 8 | Cursor types a new price range: $200,000 to $400,000 becomes $250,000 to $499,999 | Question 8 of 10 / For a chosen price range, which city has the shortest median days on market? / Any amount can be typed. / Chart: dot chart |
| 12 | `q9` | 80 | 8 | Cursor changes Year from 2024 to 2025 (city: Champaign, IL) | Question 9 of 10 / For a chosen city and year, how many sales were recorded in each month? / Chart: column chart |
| 13 | `q10` | 88 | 8 | Cursor types a budget: $300,000 becomes $400,000 (campus area Illinois, at least 3 beds) | Question 10 of 10 / For a chosen campus area, budget and number of bedrooms, how far from campus are the homes? / Chart: histogram |
| 14 | `insights` | 96 | 8 | Insights heading, then P1 and P2 headings with boxes. Paragraph text is blurred and never held still. | Insights / Two short written notes. / Labels: P1 Data quality; P2 Working with a coding agent |
| 15 | `features-intro` | 104 | 3 | Chapter card | Ten required features |
| 16 | `feature-01` | 107 | 6 | Cursor sets City to Champaign, IL. The four key-number tiles update. | Required feature 1 of 10 / Filters and key numbers / Change a filter and the key numbers update. |
| 17 | `feature-02` | 113 | 6 | Cursor clicks a campus marker on the map. Map, tiles and charts update. | Required feature 2 of 10 / Map filter / Click a campus on the map to filter the section. |
| 18 | `feature-03` | 119 | 7 | Zoom on the "Year built" range. Cursor drags a handle and the number box changes with it. Then a typed value moves the handle. | Required feature 3 of 10 / Range filter / Drag the slider or type exact values. They stay in sync. |
| 19 | `feature-04` | 126 | 6 | Garage, Basement, Fireplace filters. The four choices are shown, cursor picks Unknown, tiles update. | Required feature 4 of 10 / Home feature filter / Every feature offers Any, Yes, No and Unknown. A blank is Unknown, not No. |
| 20 | `feature-05` | 132 | 8 | A plain text box drawn by the video shows only the query string: `?city=champaign-il` becomes `?city=champaign-il&beds=3`. Then the page loads fresh from that query string and shows the same filters. | Required feature 5 of 10 / Shareable filters / The filters are saved in the page address. / Open the link and the same view loads. |
| 21 | `feature-06` | 140 | 6 | Compare panel. Cursor changes the second place, the side-by-side numbers update. | Required feature 6 of 10 / Side-by-side comparison / Pick any two places. |
| 22 | `feature-07` | 146 | 6 | Zoom on the table header sort icons, cursor clicks "Median sale price", rows reorder and the icon changes. | Required feature 7 of 10 / Sortable table / Click a column header to sort. The icon shows the column and direction. |
| 23 | `feature-08` | 152 | 6 | Desktop capture next to a phone capture (390 px wide) of the same part of the page, phone scrolls slowly | Required feature 8 of 10 / Responsive layout / The same page on a desktop and a phone. No sideways scrolling. |
| 24 | `feature-09` | 158 | 6 | Cursor clicks the "Dark mode" toggle, the page wipes from light to dark | Required feature 9 of 10 / Light and dark mode / Charts, the map and controls follow the theme. |
| 25 | `feature-10` | 164 | 7 | Data and methods section, then a row of chart thumbnails (labels hidden for Q3 to Q10) | Required feature 10 of 10 / Data and methods / The rules behind every number, and the dataset citation. / Chart types: bar, dumbbell, slope, box plot, dot, column, histogram |
| 26 | `design` | 171 | 20 | Six beats of about 3.3 s: (a) heading and body text close up, (b) palette swatches from the site and the Q1 chart with Davis in accent, (c) zoomed-out column with spacing marks, (d) sort icons, a hovered button and a keyboard focus ring, (e) a chart with title, axis labels and a tooltip, light and dark, (f) loading message, empty state, and the page title in a video-drawn text box | Design and polish / (a) Typography: a serif for headings, a sans serif for text. (b) Color: a small palette. The answer gets the accent color. (c) Layout: one column, even spacing, clear sections. (d) Controls: sort icons, hover and focus states. (e) Charts: titles, axis labels, formatted numbers. (f) Finishing touches: loading, empty state, page title. |
| 27 | `closing` | 191 | 6 | Closing card | One sample site, not the answer key. / **Your site will look different, and that is expected.** / Check your numbers against the rules in the case, not against this video. |

## Answer visibility (`SHOW_ALL_ANSWERS = false`)

- Hiding is done in the page at capture time: answer text and chart data labels get a strong blur in place, so the layout stays real. Each blurred capture also has a clear twin, and the switch picks one. A small chip, "Answer hidden in this version", sits on each hidden answer.
- Learner version: Q1 and Q2 fully visible. Q3 to Q10 answer text and chart data labels blurred in every scene where they appear (the first-look scroll, the chart thumbnails and the phone view too). Insights paragraphs and the P1 chart labels blurred.
- Instructor version: nothing blurred, no chips.

## Nothing that identifies the site

- No address bar, tab, domain, repo name or username anywhere. The query string in feature 5 is the only part of a URL shown.
- The footer line "The code is on GitHub." is blurred in every capture that includes it.

## Changes after approval

- The video's own colours are a light neutral grey ground with black type, highlight boxes and labels (the site's colours stay in the captures and the palette swatches). Inter is set slightly tighter.
- The title card opens with a risograph illustration of a college town (`assets/images/college-town-riso.webp`).
- First look: no "Ten questions" chip.
- Responsive layout: the phone sits on top of the desktop's box. Light and dark mode: the dark background fills the window.
- Sortable table: the camera zooms in on the sort icons; state changes swap in 0.1 s.
- Kickers sit closer to their titles at weight 500; paragraphs have more space above them.
- Every section that shows the site carries a note under the text column: "One example of how a site could answer this question." (Q1 to Q10), "...meet this requirement." (features), and similar for the first look, insights and design. Each note spans its whole section (`note-*` in index.html).
