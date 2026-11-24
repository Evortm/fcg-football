#!/usr/bin/env python3
"""Publish one FCG weekly topic into the Drillbox video tree.

Source : SesVid week folder (raw/renamed takes) or SesVid/CURRENT
Output : <repo>/drillbox-videos/<TOPIC>/<U5..U12>/<ACT|D1|D2>/video.mp4

Rules confirmed 2026-11-23:
  * Green team only (U9W / U9B / U11W ... are excluded)
  * ages U5..U12, phases ACT / D1 / D2 (D3 and TG not used this week)
  * every published clip must be >= 20 s; no upper limit
  * output is H.264 + AAC, faststart, <= 100 MB (GitHub Pages file limit)

Examples:
  python tools/build_drillbox.py --source ".../SesVid/D1-W13" --topic D1 --week W13 --dry-run
  python tools/build_drillbox.py --source ".../SesVid/CURRENT" --topic D1 --week W13
  python tools/build_drillbox.py --source ".../SesVid/D1-W13" --topic D1 --week W13 \
      --overlay library --height 1080 --timeslot-map w13-windows.json --dry-run
  python tools/build_drillbox.py --source ".../A8-W12/SUN" --topic A8 --week W12 --only U10:D1 --seconds 30
"""
import argparse
import datetime as dt
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import imageio_ffmpeg

# Overlay plates live next to this script (tools/overlays/). Import by path so the
# publisher works no matter which directory it is launched from.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from compose_overlay import (draw_plate, resolve_from_csv,  # noqa: E402
                            timeslot_text)

REPO = Path(__file__).resolve().parents[1]
OUT_ROOT = REPO / "drillbox-videos"
MANIFEST = OUT_ROOT / "manifest.json"
DEFAULT_SOURCE = Path(r"C:\Users\munni\Documents\Dashboard\SesVid\CURRENT")
DEFAULT_PHASES = ("ACT", "D1", "D2")
AGES = range(5, 13)
# Known FCG26 sequence; --week always wins so a new topic never needs a code change.
TOPIC_WEEK_HINT = {"A7": "W11", "A8": "W12", "D1": "W13"}
NAME_RE = re.compile(r"^U(\d+)([WB])?-(ACT|D1|D2|D3)\.(mp4|mov)$", re.IGNORECASE)
SKIP_DIRS = {"backup", "clips", "renders", "past", "overlay", "_archive",
             "_retired", "_trash", "_extras", "_work", "_qa", "_mask", "_media"}
MIN_SECONDS = 20.0
MAX_BYTES = 95 * 1024 * 1024
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


def duration_of(path):
    probe = subprocess.run([FFMPEG, "-hide_banner", "-i", str(path)],
                           capture_output=True, text=True)
    match = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", probe.stderr)
    if not match:
        return 0.0
    h, m, s = match.groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


def discover(source, phases):
    found = {}
    for root, dirs, files in os.walk(source):
        dirs[:] = [d for d in dirs if d.lower() not in SKIP_DIRS
                   and not d.startswith("_")]
        for name in files:
            m = NAME_RE.match(name)
            if not m:
                continue
            age, variant, phase = int(m.group(1)), m.group(2), m.group(3).upper()
            if variant or age not in AGES or phase not in phases:
                continue
            path = Path(root) / name
            key = ("U%d" % age, phase)
            # Latest take wins, matching the CURRENT/Pass convention.
            if key not in found or path.stat().st_mtime > found[key].stat().st_mtime:
                found[key] = path
    return found


def encode(src, dst, start, seconds, crf, overlay=None, height=540):
    """Transcode one take. When overlay is a PNG path, burn it into every frame.

    The plates are authored at 1920x1080 (16:9). They are scaled to match the
    output height; use --height 1080 to keep the type at its designed size.
    A single still input is fine: ffmpeg's overlay repeats its last frame.
    """
    width = int(round(height * 16 / 9))
    cmd = [FFMPEG, "-y", "-hide_banner", "-loglevel", "error"]
    if start:
        cmd += ["-ss", str(start)]
    cmd += ["-i", str(src)]
    if overlay:
        cmd += ["-i", str(overlay)]
    if seconds:
        cmd += ["-t", str(seconds)]
    if overlay:
        cmd += ["-filter_complex",
                "[0:v]scale=%d:%d:force_original_aspect_ratio=decrease,"
                "pad=%d:%d:(ow-iw)/2:(oh-ih)/2,setsar=1[bg];"
                "[1:v]scale=%d:%d[ol];[bg][ol]overlay=0:0[out]"
                % (width, height, width, height, width, height),
                "-map", "[out]", "-map", "0:a:0?"]
    else:
        cmd += ["-map", "0:v:0", "-map", "0:a:0?", "-vf", "scale=-2:%d" % height]
    cmd += ["-c:v", "libx264", "-preset", "veryfast", "-crf", str(crf),
            "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "64k", "-ac", "2",
            "-movflags", "+faststart", str(dst)]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip()[-500:] or "ffmpeg failed")
    return dst


def load_cells_map(raw):
    """Per-cell field overrides and, at the same time, the publish allow-list.

    Only cells present in this map are encoded, so a week's approved ("Pass")
    rows can be published without publishing every take that happens to exist.
    Keys: "U10:ACT" or "U10/ACT"; values: any field override (team, drill,
    objective, timeslot, ...).
    """
    if not raw:
        return {}
    if Path(raw).exists():
        raw = Path(raw).read_text(encoding="utf-8")
    data = json.loads(raw)
    out = {}
    for key, value in data.items():
        age, sep, phase = key.replace("/", ":").partition(":")
        if not sep:
            continue
        out[(age.upper(), phase.upper())] = dict(value)
    return out


def load_timeslot_map(raw):
    """Per-cell Windows from a JSON map: {"U11:D1": "17:35--17:40"} or nested.

    A key without a phase (e.g. "U11") applies to all its phases; a bare phase
    code (e.g. "D1") is a fallback for ages not listed. --timeslot is the final
    fallback, so a one-cell publish needs no map at all.
    """
    if not raw:
        return {}
    if Path(raw).exists():
        raw = Path(raw).read_text(encoding="utf-8")
    data = json.loads(raw)
    out = {}
    for key, value in data.items():
        if isinstance(value, dict):
            for phase, slot in value.items():
                out[(key.upper(), phase.upper())] = timeslot_text(slot)
            continue
        age, sep, phase = key.replace("/", ":").partition(":")
        if sep:
            out[(age.upper(), phase.upper())] = timeslot_text(value)
        elif re.fullmatch(r"ACT|D1|D2|D3|TG", key, re.IGNORECASE):
            out[("*", key.upper())] = timeslot_text(value)
        else:
            out[(key.upper(), "*")] = timeslot_text(value)
    return out


def timeslot_for(age, phase, mapping, fallback):
    return (mapping.get((age, phase)) or mapping.get((age, "*"))
            or mapping.get(("*", phase)) or timeslot_text(fallback))


def build_fields(topic, age, phase, args):
    """Resolve the text fields for one cell, from CSV maps or a JSON override."""
    week = args.week.strip().upper() or TOPIC_WEEK_HINT.get(topic, "")
    date = args.date.strip() or dt.date.today().isoformat()
    extra = args.cells_map.get((age, phase), {})
    slot = (timeslot_text(extra.get("timeslot", ""))
            or timeslot_for(age, phase, args.timeslot_map, args.timeslot))
    if args.overlay_fields:
        raw = args.overlay_fields
        if Path(raw).exists():
            raw = Path(raw).read_text(encoding="utf-8")
        fields = resolve_from_csv(topic, age, phase, week=week,
                                  season=args.season, date=date, squad=args.squad,
                                  timeslot=slot)
        fields.update(json.loads(raw))
    else:
        fields = resolve_from_csv(topic, age, phase, week=week,
                                  season=args.season, date=date, squad=args.squad,
                                  timeslot=slot)
    fields.update(extra)
    # A cell always wins over any JSON/CSV value for these facts.
    fields.update(team=extra.get("team", age + "-G"), topic=topic, phase=phase,
                  week=week, season=args.season, date=date)
    if slot:
        fields["timeslot"] = slot
    return fields


def load_manifest():
    if MANIFEST.exists():
        try:
            return json.loads(MANIFEST.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass
    return {"convention": "drillbox-videos/{topic}/{age}/{phase}/video.mp4",
            "rules": {"green_team_only": True, "min_seconds": MIN_SECONDS,
                      "ages": "U5-U12", "phases": list(DEFAULT_PHASES)},
            "entries": {}}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    ap.add_argument("--topic", required=True, help="weekly topic code, e.g. D1")
    ap.add_argument("--week", default="", help="season week for this topic, e.g. W13")
    ap.add_argument("--phases", default=",".join(DEFAULT_PHASES))
    ap.add_argument("--only", help="single cell, e.g. U10:D1")
    ap.add_argument("--start", type=float, default=0, help="seek into source (s)")
    ap.add_argument("--seconds", type=float, default=0, help="0 = full clip")
    ap.add_argument("--mid-excerpt", type=float, default=0,
                    help="publish the middle N seconds of each take (e.g. 60)")
    ap.add_argument("--cells-map", default="",
                    help="JSON file/object: per-cell fields AND the allow-list of cells to publish")
    ap.add_argument("--crf", type=int, default=28)
    ap.add_argument("--height", type=int, default=540, choices=(540, 720, 1080),
                    help="output height; 1080 keeps overlay text at its designed size")
    ap.add_argument("--activation-alias", action="store_true",
                    help="also write activation/video.mp4 alongside ACT/video.mp4")
    ap.add_argument("--overlay", choices=("none", "library", "coaching"), default="none",
                    help="burn Track2-OL (library) or Track3-BG (coaching) plate into the video")
    ap.add_argument("--overlay-fields", default="",
                    help="JSON file or inline object overriding team/topic/phase/drill/objective/etc.")
    ap.add_argument("--squad", default="",
                    help="team squad code (e.g. JUV) to pick its own success sentence")
    ap.add_argument("--season", default="2026-F")
    ap.add_argument("--date", default="", help="recording date, defaults to today")
    ap.add_argument("--timeslot", default="",
                    help="5-min Window for the clip, e.g. '17:35--17:40' (all cells)")
    ap.add_argument("--timeslot-map", default="",
                    help="JSON file/object with per-cell Windows, e.g. {\"U11:D1\": \"17:35--17:40\"}")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    args.timeslot_map = load_timeslot_map(args.timeslot_map)
    args.cells_map = load_cells_map(args.cells_map)
    if args.mid_excerpt and args.mid_excerpt < MIN_SECONDS:
        sys.exit("--mid-excerpt must be >= %.0f s" % MIN_SECONDS)

    topic = args.topic.upper()
    phases = tuple(p.strip().upper() for p in args.phases.split(",") if p.strip())
    if not args.source.exists():
        sys.exit("Source folder not found: %s" % args.source)

    found = discover(args.source, phases)
    if args.only:
        age, phase = args.only.upper().split(":")
        found = {k: v for k, v in found.items() if k == (age, phase)}
    if args.cells_map:
        missing = sorted(set(args.cells_map) - set(found))
        found = {k: v for k, v in found.items() if k in args.cells_map}
        if missing:
            print("  NOTE: no take on disk for %s" % ", ".join("/".join(c) for c in missing))
    if not found:
        sys.exit("No Green-team U5-U12 clips matching %s in %s" % (phases, args.source))

    print("topic=%s  source=%s  cells=%d  overlay=%s"
          % (topic, args.source, len(found), args.overlay))
    entries = load_manifest()
    total = 0
    tmpdir = tempfile.TemporaryDirectory(prefix="fcg-overlay-") if args.overlay != "none" else None
    try:
      for (age, phase), src in sorted(found.items()):
        cell = "%s/%s/%s" % (topic, age, phase)
        dst_dir = OUT_ROOT / topic / age / phase
        dst = dst_dir / "video.mp4"
        fields = build_fields(topic, age, phase, args) if args.overlay != "none" else None
        missing = [k for k in ("objective",) if fields and not fields.get(k)]
        start, seconds = args.start, args.seconds
        if args.mid_excerpt:
            seconds = min(args.mid_excerpt, duration_of(src))
            start = max(0.0, (duration_of(src) - seconds) / 2)
        print("  %-14s <- %s" % (cell, src.name)
              + ("  [%s%s]" % (args.overlay,
                 " missing " + ",".join(missing) if missing else "") if fields else "")
              + ("  %.0fs @ %.0fs" % (seconds, start) if args.mid_excerpt else ""))
        if args.dry_run:
            continue
        if seconds and seconds < MIN_SECONDS:
            print("    SKIP: would be only %.1f s (< %.0f s)" % (seconds, MIN_SECONDS))
            continue
        dst_dir.mkdir(parents=True, exist_ok=True)
        overlay = None
        if fields:
            plate, _, _ = draw_plate(args.overlay, fields)
            overlay = Path(tmpdir.name) / ("%s-%s-%s.png" % (topic, age, phase))
            plate.save(overlay)
        encode(src, dst, start, seconds, args.crf, overlay, args.height)
        seconds, size = duration_of(dst), dst.stat().st_size
        if seconds < MIN_SECONDS:
            dst.unlink(missing_ok=True)
            raise RuntimeError("%s is only %.1f s (< 20 s)" % (cell, seconds))
        if size > MAX_BYTES:
            print("    WARNING: %.1f MB exceeds the 95 MB target" % (size / 1048576))
        digest = hashlib.sha1(dst.read_bytes()).hexdigest()[:8]
        entries["entries"][cell] = {
            "url": "/drillbox-videos/%s/video.mp4?v=%s" % (cell, digest),
            "seconds": round(seconds, 2),
            "bytes": size,
            "source": src.name,
            "start": round(start, 1), "seconds": round(seconds, 1) if seconds else None,
            "updated": dt.date.today().isoformat(),
        }
        if args.activation_alias and phase == "ACT":
            alias_dir = OUT_ROOT / topic / age / "activation"
            alias_dir.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(dst, alias_dir / "video.mp4")
        total += size
        print("    -> %.1f s, %.1f MB" % (seconds, size / 1048576))
    finally:
        if tmpdir:
            tmpdir.cleanup()

    if not args.dry_run:
        OUT_ROOT.mkdir(parents=True, exist_ok=True)
        entries["updated"] = dt.datetime.now().isoformat(timespec="seconds")
        # Week selector source of truth: one row per topic that has videos.
        # Labels such as "last week" are computed by the reader, never stored.
        known = {w["topic"]: w.get("week", "") for w in entries.get("weeks", [])}
        week = args.week.strip().upper() or TOPIC_WEEK_HINT.get(topic, "")
        if week:
            known[topic] = week
        by_topic = {}
        for cell, meta in entries["entries"].items():
            agg = by_topic.setdefault(cell.split("/")[0],
                                      {"cells": 0, "bytes": 0, "updated": ""})
            agg["cells"] += 1
            agg["bytes"] += meta.get("bytes", 0)
            agg["updated"] = max(agg["updated"], meta.get("updated", ""))
        entries["weeks"] = sorted(
            [{"week": known.get(t, ""), "topic": t, "cells": a["cells"],
              "bytes": a["bytes"], "updated": a["updated"]}
             for t, a in by_topic.items()],
            key=lambda w: (w["week"], w["topic"]), reverse=True)
        MANIFEST.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n",
                            encoding="utf-8")
        print("total %.1f MB, %d weeks, manifest -> %s"
              % (total / 1048576, len(entries["weeks"]), MANIFEST))


if __name__ == "__main__":
    main()
