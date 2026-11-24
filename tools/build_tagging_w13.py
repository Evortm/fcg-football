# -*- coding: utf-8 -*-
"""Build the W13/D1 tagging clip set for fcgfootball.com/tagging.

The raw W13 MON takes are 4K HEVC (~800 MB each). This script makes light
540p H.264/AAC copies for the browser, then writes the week dataset and the
week selector manifest. Run again with --skip-encode to regenerate only JS.
"""
import argparse
import csv
import json
import subprocess
from pathlib import Path

import imageio_ffmpeg

REPO = Path(__file__).resolve().parents[1]
TOOLS_DATA = REPO / "tools" / "data"
DURATIONS = TOOLS_DATA / "w13-durations.json"
TAG_DATA = REPO / "tagging" / "data"
OUT_DIR = REPO / "tagging" / "media" / "w13"
DEFAULT_SOURCE = Path(r"C:\Users\munni\Documents\Dashboard\SesVid\D1-W13\MON")
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
PHASES = ("ACT", "D1", "D2")

# raw filename stem -> curriculum age, team, squad group, Drillbox variant.
# The W13 sheet has a typo: U9 / BEN is written as team "U08-G".
STEMS = {
    "U6":   {"age": "U6",  "team": "U06-G", "group": "CEL", "variant": "G", "sheet_age": "U6",  "sheet_team": "U06-G"},
    "U7":   {"age": "U7",  "team": "U07-G", "group": "MC",  "variant": "G", "sheet_age": "U7",  "sheet_team": "U07-G"},
    "U8":   {"age": "U8",  "team": "U08-G", "group": "FE",  "variant": "G", "sheet_age": "U8",  "sheet_team": "U08-G"},
    "U9":   {"age": "U9",  "team": "U09-G", "group": "BEN", "variant": "G", "sheet_age": "U9",  "sheet_team": "U08-G"},
    "U10":  {"age": "U10", "team": "U10-G", "group": "GAL", "variant": "G", "sheet_age": "U10", "sheet_team": "U10-G"},
    "U11":  {"age": "U11", "team": "U11-G", "group": "JUV", "variant": "G", "sheet_age": "U11", "sheet_team": "U11-G"},
    "U12":  {"age": "U12", "team": "U12-G", "group": "RSB", "variant": "G", "sheet_age": "U12", "sheet_team": "U12-G"},
    "U11W": {"age": "U10", "team": "U11-W", "group": "TWE", "variant": "W", "sheet_age": "U10", "sheet_team": "U11-W"},
    "U9W":  {"age": "U8",  "team": "U09-W", "group": "MA",  "variant": "W", "sheet_age": "U8",  "sheet_team": "U09-W"},
    "U9B":  {"age": "U6",  "team": "U09-B", "group": "PS",  "variant": "B", "sheet_age": "U6",  "sheet_team": "U09-B"},
}

FOCUS = [
    ("passing", "PA", "Actions with ball · Passing"),
    ("without-ball-out", "OB", "Actions without ball · Out of possession"),
    ("teamwork", "TW", "Mindset · Teamwork"),
    ("agility-endurance", "AE", "PD & GK · Agility & Endurance"),
]


def probe_duration(path):
    proc = subprocess.run([FFMPEG, "-hide_banner", "-i", str(path)],
                          capture_output=True, text=True)
    for line in proc.stderr.splitlines():
        if "Duration:" in line:
            clock = line.split("Duration:")[1].split(",")[0].strip()
            h, m, s = clock.split(":")
            return round(int(h) * 3600 + int(m) * 60 + float(s), 3)
    return 0.0


def encode(src, dst, crf, height):
    cmd = [FFMPEG, "-y", "-hide_banner", "-loglevel", "error",
           "-i", str(src),
           "-map", "0:v:0", "-map", "0:a:0?",
           "-vf", "scale=-2:%d" % height,
           "-c:v", "libx264", "-preset", "veryfast", "-crf", str(crf),
           "-pix_fmt", "yuv420p", "-threads", "4",
           "-c:a", "aac", "-b:a", "64k", "-ac", "2",
           "-movflags", "+faststart", str(dst)]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip()[-500:] or "ffmpeg failed")


def load_pilot():
    text = (TAG_DATA / "pilot-data.js").read_text(encoding="utf-8").strip()
    text = text[len("window.PILOT = "):].rstrip().rstrip(";")
    return json.loads(text)


def load_sheet():
    rows = list(csv.reader((TOOLS_DATA / "w13-video-tab.csv").read_text(
        encoding="utf-8-sig").splitlines()))
    sheet, groups, sessions = {}, {}, {}
    for row in rows[2:]:
        if len(row) < 14:
            continue
        session, sheet_age, sheet_team, group, drill, window, status = row[:7]
        remark, rating = row[12].strip(), row[13].strip()
        if drill not in PHASES or not status.strip():
            continue
        if not (session.startswith("1-MON") or session.startswith("2-TUE")):
            continue
        key = (sheet_age, sheet_team)
        # All 30 takes live in the MON folder. A few sheet rows were pasted
        # from the Tuesday block; use the squad's own MON session for display.
        if key not in sessions:
            sessions[key] = session
        sheet[key + (drill,)] = {
            "session": session, "window": window, "status": status,
            "remark": remark, "rating": rating,
        }
        if group.strip():
            groups[key] = group.strip()
    return sheet, groups, sessions


def build_focus_library():
    d1 = json.loads((TOOLS_DATA / "d1-data.json").read_text(encoding="utf-8"))
    library = []
    for entry in d1["ages"]:
        age = entry["age"]
        observes = [x.strip() for x in entry["path"].get("observe", "").splitlines() if x.strip()]
        assess = {g.get("focusId"): g.get("text", "")
                  for g in entry.get("gameAssessment", [])}
        for i, (fid, suffix, label) in enumerate(FOCUS):
            desc = observes[i] if i < len(observes) else assess.get(fid, label)
            library.append({
                "code": "D1U%d%s" % (age, suffix),
                "label": label,
                "topic": "D1 · W13 · U%d" % age,
                "desc": desc,
            })
    return library


def clip_id(age, variant, phase):
    return "VID-FCG-D1F-%s-U%02d%s-MON-01" % (phase, int(age[1:]), variant)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default=str(DEFAULT_SOURCE))
    ap.add_argument("--crf", type=int, default=26)
    ap.add_argument("--height", type=int, default=540)
    ap.add_argument("--skip-encode", action="store_true",
                    help="reuse existing MP4s, only regenerate JS")
    ap.add_argument("--dry-run", action="store_true",
                    help="print the plan without writing files")
    args = ap.parse_args()

    source = Path(args.source)
    sheet, groups, sessions = load_sheet()
    pilot = load_pilot()
    roster = pilot["roster"]
    focus_library = build_focus_library()
    focus_by_age = {}
    for age in range(5, 13):
        focus_by_age["U%d" % age] = ["D1U%d%s" % (age, s) for _, s, _ in FOCUS]

    durations = json.loads(DURATIONS.read_text(encoding="utf-8")) if DURATIONS.exists() else {}
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    clips = []
    for stem, meta in STEMS.items():
        sheet_key = (meta["sheet_age"], meta["sheet_team"])
        group = groups[sheet_key]
        session = sessions[sheet_key]
        roster_ids = [p["id"] for p in roster
                      if p["team"] == meta["team"] and p["group"] == group]
        for phase in PHASES:
            key = (meta["sheet_age"], meta["sheet_team"], phase)
            row = sheet.get(key)
            if not row:
                raise RuntimeError("Missing W13 sheet row for %s" % (key,))
            src = source / ("%s-%s.mp4" % (stem, phase))
            if not src.exists():
                raise RuntimeError("Missing raw take: %s" % src)
            out_name = "W13-D1-%s-%s-MON.mp4" % (phase, stem)
            out_path = OUT_DIR / out_name
            duration = durations.get(src.name) or probe_duration(src)
            if not args.skip_encode or not out_path.exists():
                if not args.dry_run:
                    encode(src, out_path, args.crf, args.height)
            size = out_path.stat().st_size if out_path.exists() else 0
            cid = clip_id(meta["age"], meta["variant"], phase)
            passed = row["status"].lower().startswith("pass")
            verdict = "PASS" if passed else "REDO"
            title = "%s / %s · %s · %s · %s" % (
                meta["team"], group, phase, verdict, row["rating"])
            clips.append({
                "id": cid,
                "prefix": "D1FU%02d%s%sMON" % (int(meta["age"][1:]), meta["variant"], phase),
                "drill": phase,
                "title": title,
                "topic": "D1 — W13 Press the goalkeeper build-up",
                "team": meta["team"],
                "group": group,
                "squad": {
                    "label": "%s / %s" % (meta["team"], group),
                    "teams": [meta["team"]],
                },
                "session": session,
                "window": row["window"],
                "status": row["status"],
                "rating": row["rating"],
                "remark": row["remark"],
                "file": "media/w13/" + out_name,
                "source_name": src.name,
                "duration": duration,
                "basis": "Clip position",
                "combined": False,
                "hash": "",
                "size": size,
                "origin": "W13 D1 · MON take · %s · %s" % (row["status"], row["rating"]),
                "file_id": "",
                "focus": focus_by_age[meta["age"]],
                "phaseLabel": "%s · %s · MON" % (phase, verdict),
                "segments": [{
                    "index": 1,
                    "file_start": 0,
                    "file_end": duration,
                    "source_start": None,
                    "clock": "",
                    "note": "Full recording; camera-clock mapping not verified",
                }],
                "rosterIds": roster_ids,
                "file_remote": "",
            })
            print("%-16s %-4s %6.2fs -> %-38s %6.2f MB" % (
                src.name, phase, duration, out_name, size / 1024 / 1024))

    if args.dry_run:
        print("dry-run: %d clips, no files written" % len(clips))
        return

    weeks = {
        "defaultWeek": "W13",
        "weeks": [
            {"id": "W13", "short": "W13 · D1",
             "label": "W13 · D1 (current)", "topic": "D1", "file": "w13-data.js"},
            {"id": "W12", "short": "W12 · A8",
             "label": "W12 · A8 (takes pending)", "topic": "A8",
             "file": "", "disabled": True},
            {"id": "W11", "short": "W11 · A7",
             "label": "W11 · A7 (pilot)", "topic": "A7", "file": "pilot-data.js"},
        ],
    }
    (TAG_DATA / "weeks.js").write_text(
        "window.FCG_WEEKS = " + json.dumps(weeks, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8")

    payload = {
        "week": "W13",
        "topic": "D1",
        "weekLabel": "W13 · D1",
        "clips": clips,
        "roster": "@@ROSTER@@",
        "focusLibrary": focus_library,
        "coachCode": "W13D1",
        "source": "W13 D1 MON takes · 540p H.264/AAC tagging copies",
        "defaultClip": "VID-FCG-D1F-ACT-U10G-MON-01",
    }
    body = json.dumps(payload, ensure_ascii=False, indent=2)
    body = body.replace('"@@ROSTER@@"', "window.PILOT.roster")
    loader = """(function () {
  var week = "";
  try { week = new URLSearchParams(location.search).get("week") || ""; } catch (err) {}
  week = (week || (window.FCG_WEEKS && window.FCG_WEEKS.defaultWeek) || "W11").toUpperCase();
  if (week === "W13" && window.FCG_W13) window.PILOT = window.FCG_W13;
})();
"""
    (TAG_DATA / "w13-data.js").write_text(
        "window.FCG_W13 = " + body + ";\n" + loader, encoding="utf-8")
    print("wrote %d clips, %d focus points -> tagging/data/{weeks,w13-data}.js"
          % (len(clips), len(focus_library)))


if __name__ == "__main__":
    main()
