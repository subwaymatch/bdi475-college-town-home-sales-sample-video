#!/usr/bin/env python3
"""Reads every frame sample of a rendered video with OCR and looks for text that must not appear.

    python3 scripts/check-render.py renders/sample-site-demo.mp4 learner
    python3 scripts/check-render.py renders/sample-site-demo-instructor.mp4 instructor

Needs FFmpeg and Tesseract (apt-get install tesseract-ocr).

Checks, in every version:
  - nothing that leads to the site or its repository: domain, username, repository name, a URL,
    GitHub, the dataset's source institution
In the learner version also:
  - none of the Q3 to Q10 answer values from the check list
In the instructor version, the same answer values are expected to be found (a check that OCR works).

Exit code 1 when a forbidden item is found. The report is written next to the video.
"""

import json
import os
import re
import subprocess
import sys
import tempfile

video, mode = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "learner")
fps = float(os.environ.get("CHECK_FPS", "1"))

ALWAYS = {
    "domain or URL": r"github\.io|https?://|www\.|\.com/|\.io\b",
    "GitHub": r"git\s?hub",
    "username": r"subwaymatch",
    "repository name": r"bdi\s?475|home-sales-sample",
    "course or school system": r"canvas|illinois\.edu",
    "dataset source": r"deloitte|foundation center|emerging technologies",
}
ANSWERS = {
    "Q3": r"9th to 11th|10th to 9th|11th to 10th|\$455,639|\$474,550",
    "Q4": r"\+7\.6%|\$263,500|4\.6%",
    "Q5": r"27 days|4-way tie",
    "Q6": r"1\.93%|0\.63%|19,456,633",
    "Q7": r"\$215,000|\$135,500|1,106 sales",
    "Q8": r"6 days each|91 days|44 days",
    "Q9": r"june had the most|\b717\b",
    "Q10": r"2\.8 miles|2,601",
}

tmp = tempfile.mkdtemp(prefix="frames-")
subprocess.run(["ffmpeg", "-loglevel", "error", "-i", video, "-vf", f"fps={fps}", os.path.join(tmp, "f%05d.png")], check=True)
frames = sorted(f for f in os.listdir(tmp) if f.endswith(".png"))

hits = []
answer_hits = []
for i, f in enumerate(frames):
    t = i / fps
    path = os.path.join(tmp, f)
    text = subprocess.run(["tesseract", path, "-", "--psm", "11"], capture_output=True, text=True).stdout
    low = text.lower()
    for name, pat in ALWAYS.items():
        for m in re.finditer(pat, low):
            hits.append({"time": t, "what": name, "text": m.group(0)})
    for q, pat in ANSWERS.items():
        for m in re.finditer(pat, low):
            answer_hits.append({"time": t, "question": q, "text": m.group(0)})
    os.remove(path)
os.rmdir(tmp)

report = {"video": video, "mode": mode, "frames": len(frames), "fps": fps, "identifying": hits, "answers": answer_hits}
with open(re.sub(r"\.mp4$", "", video) + ".check.json", "w") as fh:
    json.dump(report, fh, indent=1)

print(f"{video}: {len(frames)} frames read")
bad = False
if hits:
    bad = True
    for h in hits:
        print(f"  IDENTIFYING  {h['time']:7.1f}s  {h['what']}: {h['text']}")
else:
    print("  no domain, URL, username, repository name or dataset source found")
if mode == "learner":
    if answer_hits:
        bad = True
        for h in answer_hits:
            print(f"  ANSWER SHOWN {h['time']:7.1f}s  {h['question']}: {h['text']}")
    else:
        print("  no Q3 to Q10 answer values found")
else:
    found = sorted({h["question"] for h in answer_hits})
    print(f"  answer values found (expected in this version): {', '.join(found) or 'none'}")
sys.exit(1 if bad else 0)
