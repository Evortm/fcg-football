#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Render Track 3 tagged moments + a per-team week overview FOR WEIYUN.

Track 3 player footage is deliberately NOT published on GitHub Pages. Only the
#drillbox opt-ins (build_drillbox.py) belong on the website. Every file this
script writes lives OUTSIDE the website repo and is staged for Weiyun upload.

Source : SesVid/CURRENT (the full-quality PASS takes referenced by wNN-data.js)
Input  : tools/data/wNN-tags-tab.csv (18-column A-R paste from the weekfile Tags tab)
Output : <FCG_TRACK3_ROOT>/rendered/<WEEK>/<event_id>.mp4   one clip per tag
         <FCG_TRACK3_ROOT>/rendered/<WEEK>/<TEAM>-week-overview.mp4
         <FCG_TRACK3_ROOT>/rendered/manifest.json            local audit only
         <FCG_TRACK3_ROOT>/weiyun/<WEEK>/<readable name>.mp4 Weiyun upload set
         tools/data/wNN-weiyun-staging.json                  uploader input

Unlike the Drillbox (one >= 20 s ideal example per cell), Track 3 keeps EVERY
PLAYER tag, however short, with the player name and the coach comment burned
in. Bare Drillbox rows (player_id == "DRILLBOX") are Track 2 only and are
skipped here. Only NON-#drillbox moments are staged for Weiyun; older player
tags that carry #drillbox are still rendered for the team week overview.
Duplicate / overlapping windows on the same source take are merged in the
overview so a player is not shown the same action three times.

Examples:
  python tools/build_tag_moments.py --week W13 --dry-run
  python tools/build_tag_moments.py --week W13
  python tools/build_tag_moments.py --week W13 --stage-only
"""
import argparse
import csv
import datetime as dt
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_drillbox import duration_of  # noqa: E402

REPO = Path(__file__).resolve().parents[1]
# Track 3 output MUST stay outside the website repo (never served by Pages).
TRACK3_ROOT = Path(os.environ.get("FCG_TRACK3_ROOT",
                                  str(REPO.parent / "track3-staging")))
OUT_ROOT = TRACK3_ROOT / "rendered"
WEIYUN_ROOT = TRACK3_ROOT / "weiyun"
DEFAULT_SOURCE = Path(r"C:\Users\munni\Documents\Dashboard\SesVid\CURRENT")
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

W, H = 1920, 1080
FONT_CJK = Path(r"C:\Windows\Fonts\msyh.ttc")
FONT_LATIN = Path(r"C:\Windows\Fonts\arialbd.ttf")
# Easy's own 1920x1080 plate (FCG crest + top bar + bottom comment panel).
PLATE3 = REPO / "tools" / "overlays" / "Track3-BG.png"
USE_PLATE = True
DARK = (6, 40, 43, 255)
LIME = (144, 191, 29, 255)
WHITE = (255, 255, 255, 255)
MUTED = (185, 202, 204, 255)
YELLOW = (255, 237, 0, 255)

VIDEO_ID_RE = re.compile(
    r"^VID-FCG-([A-Z]\d+)[A-Z]?-(ACT|D1|D2|D3|TG)-U(\d+)([A-Z])-", re.IGNORECASE)
DRILLBOX_RE = re.compile(r"(^|\s)#drillbox\b", re.IGNORECASE)
DRILLBOX_PLAYER_ID = "DRILLBOX"
# Legacy only: a short-lived build wrote #pos=x,y. Keep stripping it from
# captions so those old rows still read cleanly; nothing writes it any more.
TAG_MARK_RE = re.compile(r"\s*#(?:drillbox|pos=[\d.]+,[\d.]+)\b", re.IGNORECASE)
PHASE_ORDER = {"ACT": 0, "D1": 1, "D2": 2, "D3": 3, "TG": 4}
PHASE_LABEL = {"ACT": "Activation", "D1": "Drill 1", "D2": "Drill 2",
               "D3": "Drill 3", "TG": "The Game"}


# --------------------------------------------------------------------------
# data
# --------------------------------------------------------------------------
def parse_time(value):
    text = str(value or "").strip()
    if not text:
        return None
    try:
        if ":" in text:
            total = 0.0
            for power, part in enumerate(reversed(text.split(":"))):
                total += float(part) * (60 ** power)
            return round(total, 3)
        return round(float(text), 3)
    except ValueError:
        return None


def clean_text(text):
    text = str(text or "").strip().strip('"').strip()
    return re.sub(r"\s+", " ", text)


def display_comment(text):
    """Coach words only; inline marks are instructions, not captions."""
    return clean_text(TAG_MARK_RE.sub("", str(text or "")))


def load_tags(path):
    """Return every valid PLAYER tag. #drillbox is a flag, NOT a filter here;
    bare Drillbox rows (Track 2) are skipped and left to build_drillbox.py."""
    text = Path(path).read_text(encoding="utf-8-sig")
    rows = list(csv.reader(io.StringIO(text),
                           delimiter="\t" if "\t" in text.splitlines()[0] else ","))
    if not rows:
        raise RuntimeError("Tags CSV is empty: %s" % path)
    header = [h.strip().lower() for h in rows[0]]

    def col(name, default):
        return header.index(name) if name in header else default

    idx = {k: col(k, i) for i, k in enumerate(
        ["event_id", "video_id", "player_id", "player_display", "player_known",
         "t_start", "t_end", "t_start_sec", "t_end_sec", "source_start",
         "source_end", "source_segment", "observations", "comment",
         "reviewer", "confirmation", "created_at", "updated_at"])}

    def cell(row, name):
        i = idx[name]
        return row[i] if i < len(row) else ""

    out = []
    for row in rows[1:]:
        if not any(str(v).strip() for v in row):
            continue
        event_id = clean_text(cell(row, "event_id"))
        if clean_text(cell(row, "player_id")).upper() == DRILLBOX_PLAYER_ID:
            print("  NOTE: %s is a bare Drillbox row -> Track 2 only, skipped" % event_id)
            continue
        video_id = cell(row, "video_id").strip()
        m = VIDEO_ID_RE.match(video_id)
        if not m:
            print("  NOTE: %s has an unparseable video_id %s" % (event_id, video_id))
            continue
        start, end = parse_time(cell(row, "t_start")), parse_time(cell(row, "t_end"))
        if start is None or end is None or end <= start:
            print("  NOTE: %s has invalid markers" % event_id)
            continue
        raw_comment = cell(row, "comment")
        out.append({
            "event_id": event_id,
            "video_id": video_id,
            "topic": m.group(1).upper(),
            "phase": m.group(2).upper(),
            "age": "U%d" % int(m.group(3)),
            "variant": m.group(4).upper(),
            "player": clean_text(cell(row, "player_display")) or "Unknown player",
            "player_id": clean_text(cell(row, "player_id")),
            "reviewer": clean_text(cell(row, "reviewer")),
            "comment": clean_text(raw_comment),
            "words": display_comment(raw_comment),
            "observations": clean_text(cell(row, "observations")),
            "confirmation": clean_text(cell(row, "confirmation")),
            "t_start": cell(row, "t_start").strip(),
            "t_end": cell(row, "t_end").strip(),
            "start": start,
            "end": end,
            "seconds": round(end - start, 3),
            "drillbox": bool(DRILLBOX_RE.search(raw_comment or "")),
        })
    return out


def load_dataset(path):
    """wNN-data.js -> {video_id: clip}. Keeps source_name (CURRENT filename)."""
    text = Path(path).read_text(encoding="utf-8")
    m = re.match(r"window\.FCG_W\d+\s*=\s*", text)
    if not m:
        raise RuntimeError("Not a week dataset: %s" % path)
    body = text[text.find("{", m.end() - 1):]
    end = body.find('\n  "roster": window.PILOT.roster')
    obj = json.loads(body[:end].rstrip().rstrip(",") + "\n}")
    return {c["id"]: c for c in obj["clips"]}


# --------------------------------------------------------------------------
# caption artwork
# --------------------------------------------------------------------------
def cjk_font(size, bold=False):
    path = FONT_CJK if FONT_CJK.exists() else FONT_LATIN
    return ImageFont.truetype(str(path), size, index=0)


def wrap_chars(draw, text, fnt, max_w, max_lines):
    """Greedy character wrap: works for Chinese names and English sentences.

    Returns (lines, truncated). An ellipsis is added ONLY when characters were
    actually dropped - short titles must not be cut for no reason.
    """
    lines, cur = [], ""
    truncated = False
    for ch in text:
        trial = cur + ch
        if cur and draw.textbbox((0, 0), trial, font=fnt)[2] > max_w:
            if len(lines) >= max_lines - 1:
                truncated = True
                break
            lines.append(cur)
            cur = ch
        else:
            cur = trial
    else:
        if cur:
            lines.append(cur)
    if truncated:
        tail = cur
        while tail and draw.textbbox((0, 0), tail + "…", font=fnt)[2] > max_w:
            tail = tail[:-1]
        lines.append(tail + "…")
    return lines, truncated


def fit_text(draw, text, max_w, max_lines, base, min_size=20):
    for size in range(base, min_size - 1, -2):
        fnt = cjk_font(size)
        lines, truncated = wrap_chars(draw, text, fnt, max_w, max_lines)
        if not truncated and len(lines) <= max_lines:
            return lines, fnt, size + 8
    fnt = cjk_font(min_size)
    lines, _ = wrap_chars(draw, text, fnt, max_w, max_lines)
    return lines, fnt, min_size + 8


def _plate():
    if USE_PLATE and PLATE3.exists():
        im = Image.open(PLATE3).convert("RGBA")
        if im.size == (W, H):
            return im
        print("  NOTE: %s is %s, expected %sx%s" % (PLATE3.name, im.size, W, H))
    return None


def _crest():
    plate = _plate()
    if plate is None:
        return None
    return plate.crop((65, 10, 230, 220))   # FCG shield, transparent surround


def make_moment_caption(tag, clip, week, path):
    """Track 3 caption, drawn into Easy's FCG crest plate (Track3-BG.png).

    Geometry comes from compose_overlay.GEOM["coaching"]: top bar 0..1015 x
    69..172 with the crest at 75..218, status chip at 38..328 / 948..983 and
    the comment panel at 514..1880 / 875..1047. The middle stays transparent
    so the ring around the player is never covered.
    """
    im = (_plate() or Image.new("RGBA", (W, H), (0, 0, 0, 0))).copy()
    d = ImageDraw.Draw(im)
    plated = _plate() is not None
    if plated:
        x1, x2, right = 244, 546, 1848
        top1, top2, label_y, body_y, foot_y = 80, 133, 890, 920, 1008
        title_w, body_w = 990 - x1, right - x2
        d.text((183, 965), "PLAYER MOMENT", font=cjk_font(19), fill=LIME, anchor="mm")
    else:
        # Fallback if the plate is missing: the original full-width lower third.
        x1 = x2 = 82
        right = W - 60
        title_w = body_w = W - 140
        top1, top2, label_y, body_y, foot_y = 866, 924, 842, 924, 1018
        d.rectangle([0, 842, W, H], fill=(6, 40, 43, 214))
        d.rectangle([46, 872, 53, 1028], fill=LIME)

    title = "%s · %s   |   %s   |   %s   |   %s" % (
        week, clip.get("topic", ""), tag["team"],
        PHASE_LABEL.get(tag["phase"], tag["phase"]), tag["player"])
    l1, f1, _ = fit_text(d, title, title_w, 1, 34 if plated else 40, 20)
    d.text((x1, top1), l1[0] if l1 else title, font=f1, fill=WHITE)

    if plated:
        meta = "2026-F  ·  %s  ·  %s  ·  %s → %s" % (
            week, tag["reviewer"] or "—", tag["t_start"], tag["t_end"])
        l2, f2, _ = fit_text(d, meta, title_w, 1, 23, 16)
        d.text((x1, top2), l2[0] if l2 else meta, font=f2, fill=MUTED)
        d.text((x2, label_y), "COACH COMMENT", font=cjk_font(21), fill=LIME)

    body = tag.get("words") or re.sub(r";\s*", " · ", tag["observations"])
    l3, f3, lead3 = fit_text(d, body, body_w, 2, 29 if plated else 31, 19)
    for i, line in enumerate(l3[:2]):
        d.text((x2, body_y + i * lead3), line, font=f3,
               fill=WHITE if plated else MUTED)
    foot = "%s · %s → %s · %s%s" % (
        tag["reviewer"] or "—", tag["t_start"], tag["t_end"], tag["event_id"],
        "  ·  #drillbox" if tag["drillbox"] else "")
    d.text((x2, foot_y), foot, font=cjk_font(21 if plated else 22),
           fill=MUTED if plated else LIME)
    im.save(path)
    return path


def make_card(title, subtitle, detail, path, accent=LIME):
    """Full-screen title card used between overview segments."""
    im = Image.new("RGBA", (W, H), DARK)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 12], fill=accent)
    d.rectangle([0, 0, 18, H], fill=accent)
    crest = _crest()
    if crest is not None:
        im.paste(crest, (42, 22), crest)
        d = ImageDraw.Draw(im)
    t, f, _ = fit_text(d, title, W - 220, 1, 92, 44)
    d.text((110, 300), t[0] if t else title, font=f, fill=WHITE)
    if subtitle:
        s, fs, _ = fit_text(d, subtitle, W - 220, 1, 46, 28)
        d.text((110, 430), s[0] if s else subtitle, font=fs, fill=accent)
    if detail:
        dl, fd, lead = fit_text(d, detail, W - 220, 3, 34, 22)
        for i, line in enumerate(dl[:3]):
            d.text((110, 560 + i * lead), line, font=fd, fill=MUTED)
    d.text((110, 990), "FCG · WEEK OVERVIEW · COACH / PLAYER MEETING",
           font=cjk_font(24), fill=(120, 150, 152, 255))
    im.save(path)
    return path


# --------------------------------------------------------------------------
# encoding
# --------------------------------------------------------------------------
def run(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError((result.stderr or "").strip()[-700:] or "ffmpeg failed")
    return result


def encode_moment(src, dst, start, seconds, caption, crf):
    filt = ("[0:v]scale=%d:%d:force_original_aspect_ratio=decrease,"
            "pad=%d:%d:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[bg];"
            "[1:v]scale=%d:%d[ol];[bg][ol]overlay=0:0[out]"
            % (W, H, W, H, W, H))
    # -t must be an OUTPUT option (after every -i); placing it between two
    # inputs makes it an input option and the clip runs to the end of the take.
    cmd = [FFMPEG, "-y", "-hide_banner", "-loglevel", "error",
           "-ss", str(start), "-i", str(src),
           "-i", str(caption), "-filter_complex", filt,
           "-map", "[out]", "-map", "0:a:0?", "-t", str(seconds),
           "-c:v", "libx264", "-preset", "veryfast", "-crf", str(crf),
           "-pix_fmt", "yuv420p", "-r", "30",
           "-c:a", "aac", "-b:a", "64k", "-ar", "48000", "-ac", "2",
           "-movflags", "+faststart", str(dst)]
    run(cmd)
    return dst


def encode_card(png, dst, seconds, crf):
    cmd = [FFMPEG, "-y", "-hide_banner", "-loglevel", "error",
           "-loop", "1", "-framerate", "30", "-t", str(seconds), "-i", str(png),
           "-f", "lavfi", "-t", str(seconds),
           "-i", "anullsrc=r=48000:cl=stereo",
           "-map", "0:v:0", "-map", "1:a:0",
           "-c:v", "libx264", "-preset", "veryfast", "-crf", str(crf),
           "-pix_fmt", "yuv420p", "-r", "30",
           "-c:a", "aac", "-b:a", "64k", "-ar", "48000", "-ac", "2",
           "-movflags", "+faststart", str(dst)]
    run(cmd)
    return dst


def concat_parts(parts, dst):
    """All parts share identical stream parameters -> stream copy concat."""
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False,
                                     encoding="utf-8") as f:
        for p in parts:
            f.write("file '%s'\n" % str(p).replace("\\", "/"))
        listfile = f.name
    try:
        run([FFMPEG, "-y", "-hide_banner", "-loglevel", "error",
             "-f", "concat", "-safe", "0", "-i", listfile,
             "-c", "copy", "-movflags", "+faststart", str(dst)])
    finally:
        Path(listfile).unlink(missing_ok=True)
    return dst


def sha(path):
    return hashlib.sha1(Path(path).read_bytes()).hexdigest()[:8]


# --------------------------------------------------------------------------
# overview
# --------------------------------------------------------------------------
def merge_windows(tags):
    """Merge duplicate / overlapping / nested tagged windows per source take."""
    by_video = defaultdict(list)
    for t in tags:
        by_video[t["video_id"]].append(t)
    groups = []
    for video_id, items in by_video.items():
        items.sort(key=lambda x: (x["start"], x["end"]))
        cur = None
        for t in items:
            if cur and t["start"] <= cur["end"] + 0.5:
                cur["end"] = max(cur["end"], t["end"])
                cur["players"].append(t["player"])
                cur["comments"].append(t["words"])
                cur["event_ids"].append(t["event_id"])
                cur["drillbox"] = cur["drillbox"] or t["drillbox"]
                cur["tags"] += 1
            else:
                cur = {"video_id": video_id, "phase": t["phase"],
                       "start": t["start"], "end": t["end"],
                       "players": [t["player"]],
                       "comments": [t["words"]],
                       "event_ids": [t["event_id"]],
                       "drillbox": t["drillbox"], "tags": 1}
                groups.append(cur)
    for g in groups:
        g["players"] = list(dict.fromkeys(g["players"]))
        g["seconds"] = round(g["end"] - g["start"], 3)
        g["comment"] = next((c for c in g["comments"] if c), "")
    groups.sort(key=lambda g: (PHASE_ORDER.get(g["phase"], 9), g["start"]))
    return groups


def build_overview(team, tags, dataset, source_root, out_dir, week, topic,
                   crf, tmpdir):
    """Intro card -> [card + footage] per merged window -> outro card."""
    groups = merge_windows(tags)
    if not groups:
        raise RuntimeError("No tagged windows for %s" % team)
    parts = []
    intro = Path(tmpdir) / "card-intro.png"
    make_card("%s · %s" % (week, team), "%s · WEEK OVERVIEW" % topic,
              "%d tagged moments from %d players, merged into %d clips." % (
                  len(tags), len({t["player"] for t in tags}), len(groups)),
              intro)
    parts.append(encode_card(intro, Path(tmpdir) / "p00-intro.mp4", 2.5, crf))

    for i, g in enumerate(groups, 1):
        card = Path(tmpdir) / ("card-%02d.png" % i)
        detail = "%s   ·   %s" % (
            " / ".join(g["players"]),
            g["comment"][:150] if g["comment"] else "Coach observation")
        make_card("%s · %s" % (PHASE_LABEL.get(g["phase"], g["phase"]), team),
                  "%0.1f s   ·   %0.1f–%0.1f s   ·   %d tag(s)" % (
                      g["seconds"], g["start"], g["end"], g["tags"]),
                  detail, card, YELLOW if g["drillbox"] else LIME)
        parts.append(encode_card(card, Path(tmpdir) / ("p%02d-card.mp4" % i), 2.5, crf))

        src = source_root / dataset[g["video_id"]]["source_name"]
        caption = Path(tmpdir) / ("caption-%02d.png" % i)
        fake = {"event_id": "%d tagged moment(s)" % g["tags"], "team": team,
                "phase": g["phase"], "player": " / ".join(g["players"]),
                "reviewer": "FCG", "t_start": "%.3f" % g["start"],
                "t_end": "%.3f" % g["end"], "comment": g["comment"],
                "words": g["comment"],
                "observations": "", "drillbox": g["drillbox"]}
        make_moment_caption(fake, {"topic": topic}, week, caption)
        seg = Path(tmpdir) / ("p%02d-footage.mp4" % i)
        encode_moment(src, seg, g["start"], g["seconds"], caption, crf)
        parts.append(seg)

    outro = Path(tmpdir) / "card-outro.png"
    make_card("FCG", "%s · %s · END OF OVERVIEW" % (week, team),
              "Discuss the moments with the players, then tag the next week.", outro)
    parts.append(encode_card(outro, Path(tmpdir) / "p99-outro.mp4", 2.0, crf))

    dst = out_dir / ("%s-week-overview.mp4" % team)
    concat_parts(parts, dst)
    return dst, groups


# --------------------------------------------------------------------------
# Weiyun staging (readable filenames; #drillbox rows are excluded)
# --------------------------------------------------------------------------
def safe_slug(text):
    s = re.sub(r"[^A-Za-z0-9]+", "-", str(text or "")).strip("-")
    return s or "Player"


def write_staging(wk, tags, overview_team, out_dir, stage_json):
    """Copy non-Drillbox moments + overview to readable Weiyun filenames."""
    stage_dir = WEIYUN_ROOT / wk
    stage_dir.mkdir(parents=True, exist_ok=True)
    used, mapping = set(), {}
    for t in tags:
        if t["drillbox"]:
            continue
        src = out_dir / ("%s.mp4" % t["event_id"])
        if not src.exists():
            raise RuntimeError("rendered moment missing: %s" % src)
        first = (t["player"].split() or [""])[0]
        base = "%s-%s-%s-%s" % (wk, t["team"].replace("-", ""),
                                t["phase"], safe_slug(first))
        name, n = base + ".mp4", 2
        while name in used:
            name, n = "%s-%d.mp4" % (base, n), n + 1
        used.add(name)
        dst = stage_dir / name
        if dst.resolve() != src.resolve():
            shutil.copy2(src, dst)
        mapping[t["event_id"]] = str(dst)
        print("  stage %-42s -> %s" % (t["event_id"], name))
    if overview_team:
        ov = out_dir / ("%s-week-overview.mp4" % overview_team)
        if not ov.exists():
            raise RuntimeError("week overview missing: %s" % ov)
        name = "%s-%s-WEEK-OVERVIEW.mp4" % (wk, overview_team.replace("-", ""))
        dst = stage_dir / name
        if dst.resolve() != ov.resolve():
            shutil.copy2(ov, dst)
        mapping["overview"] = str(dst)
        print("  stage %-42s -> %s" % ("overview", name))
    Path(stage_json).parent.mkdir(parents=True, exist_ok=True)
    Path(stage_json).write_text(
        json.dumps(mapping, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("staging manifest -> %s (%d files)" % (stage_json, len(mapping)))
    return stage_json


# --------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--week", default="W13")
    ap.add_argument("--tags", default="", help="wNN-tags-tab.csv (defaults by week)")
    ap.add_argument("--data", default="", help="tagging/data/wNN-data.js (defaults by week)")
    ap.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    ap.add_argument("--out", type=Path, default=OUT_ROOT)
    ap.add_argument("--overview", default="U11-G",
                    help="team to build the meeting clip for; empty = skip")
    ap.add_argument("--crf", type=int, default=28)
    ap.add_argument("--stage-json", default="",
                    help="wNN-weiyun-staging.json (defaults to tools/data/)")
    ap.add_argument("--stage-only", action="store_true",
                    help="skip rendering; stage already-rendered clips for Weiyun")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    wk = args.week.strip().upper()
    stage_json = (Path(args.stage_json) if args.stage_json else
                  REPO / "tools" / "data" / ("%s-weiyun-staging.json" % wk.lower()))
    tags_path = Path(args.tags) if args.tags else REPO / "tools" / "data" / ("%s-tags-tab.csv" % wk.lower())
    data_path = Path(args.data) if args.data else REPO / "tagging" / "data" / ("%s-data.js" % wk.lower())
    tags = load_tags(tags_path)
    if not tags:
        print("WEEK %s | no Track 3 PLAYER tags (Drillbox-only week) — nothing for Weiyun" % wk)
        Path(stage_json).parent.mkdir(parents=True, exist_ok=True)
        Path(stage_json).write_text("{}\n", encoding="utf-8")
        return
    dataset = load_dataset(data_path)
    source_root = Path(args.source)
    out_dir = Path(args.out) / wk
    topic = dataset[tags[0]["video_id"]].get("topic", "").split("—")[0].strip() or wk

    missing_ids = sorted({t["video_id"] for t in tags} - set(dataset))
    if missing_ids:
        raise RuntimeError("Tags reference clips missing from %s: %s"
                           % (data_path, ", ".join(missing_ids)))
    missing_src = sorted({dataset[t["video_id"]]["source_name"] for t in tags}
                         - {p.name for p in source_root.glob("*.mp4")})
    if missing_src:
        raise RuntimeError("CURRENT is missing source takes: %s" % ", ".join(missing_src))

    for t in tags:
        c = dataset[t["video_id"]]
        t["team"] = c["team"]
        t["source"] = c["source_name"]

    print("WEEK %s | topic %s | %d tags (%d #drillbox, %d Track 3) | source %s"
          % (wk, topic, len(tags), sum(1 for t in tags if t["drillbox"]),
             sum(1 for t in tags if not t["drillbox"]), source_root))
    overview_team = args.overview.strip()
    ov_tags = [t for t in tags if t["team"] == overview_team] if overview_team else []
    groups = merge_windows(ov_tags) if ov_tags else []
    print("OVERVIEW %s | %d tags -> %d merged windows: %s"
          % (overview_team or "(none)", len(ov_tags), len(groups),
             ", ".join("%s %.1fs" % (g["phase"], g["seconds"]) for g in groups)))
    if args.dry_run:
        for t in tags:
            print("  %-42s %-9s -> %-9s %6.2fs  %s" % (
                t["event_id"], t["t_start"], t["t_end"], t["seconds"], t["player"]))
        return

    if args.stage_only:
        if not out_dir.exists():
            raise RuntimeError("nothing rendered yet: %s" % out_dir)
        write_staging(wk, tags, overview_team, out_dir, stage_json)
        return

    out_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = Path(args.out) / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {
        "convention": "<FCG_TRACK3_ROOT>/rendered/<WEEK>/<event_id>.mp4",
        "description": "Track 3: every tagged moment with player + coach comment. LOCAL ONLY - never publish on the website.",
        "weeks": {}, "entries": {}, "overviews": {}}
    manifest.setdefault("entries", {})
    manifest.setdefault("overviews", {})
    manifest.setdefault("weeks", {})

    tmp = tempfile.TemporaryDirectory(prefix="fcg-moments-")
    total = 0
    try:
        for i, t in enumerate(tags, 1):
            dst = out_dir / ("%s.mp4" % t["event_id"])
            caption = Path(tmp.name) / ("caption-%02d.png" % i)
            make_moment_caption(t, {"topic": topic}, wk, caption)
            src = source_root / t["source"]
            print("  [%2d/%d] %-42s %6.2fs  %s" % (
                i, len(tags), t["event_id"], t["seconds"], t["player"]))
            encode_moment(src, dst, t["start"], t["seconds"], caption, args.crf)
            seconds, size = duration_of(dst), dst.stat().st_size
            total += size
            manifest["entries"][t["event_id"]] = {
                "week": wk, "team": t["team"], "phase": t["phase"],
                "player": t["player"], "player_id": t["player_id"],
                "reviewer": t["reviewer"], "comment": t["comment"],
                "observations": t["observations"],
                "confirmation": t["confirmation"],
                "video_id": t["video_id"], "source": t["source"],
                "t_start": t["t_start"], "t_end": t["t_end"],
                "start": t["start"], "seconds": round(seconds, 2),
                "bytes": size, "file": "%s/%s.mp4" % (wk, dst.name),
                "sha": sha(dst), "drillbox": t["drillbox"],
                "plate": "Track3-BG.png" if _plate() is not None else "classic",
                "updated": dt.date.today().isoformat(),
            }
            print("       -> %.1f s, %.1f MB" % (seconds, size / 1048576))

        if ov_tags:
            print("  building %s week overview ..." % overview_team)
            ov, groups = build_overview(overview_team, ov_tags, dataset,
                                        source_root, out_dir, wk, topic,
                                        args.crf, tmp.name)
            seconds, size = duration_of(ov), ov.stat().st_size
            total += size
            manifest["overviews"]["%s/%s" % (wk, overview_team)] = {
                "week": wk, "team": overview_team,
                "file": "%s/%s" % (wk, ov.name), "sha": sha(ov),
                "seconds": round(seconds, 2), "bytes": size,
                "tags": len(ov_tags), "moments": len(groups),
                "players": sorted({t["player"] for t in ov_tags}),
                "windows": [{"phase": g["phase"], "start": g["start"],
                             "end": g["end"], "seconds": g["seconds"],
                             "players": g["players"]} for g in groups],
                "updated": dt.date.today().isoformat(),
            }
            print("       -> %s  %.1f s, %.1f MB" % (ov.name, seconds, size / 1048576))
    finally:
        tmp.cleanup()

    manifest["updated"] = dt.datetime.now().isoformat(timespec="seconds")
    manifest["weeks"][wk] = {
        "topic": topic, "clips": len(tags),
        "overviews": 1 if ov_tags else 0,
        "bytes": total, "updated": dt.date.today().isoformat()}
    Path(args.out).mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
                             encoding="utf-8")
    print("total %.1f MB in %s | manifest -> %s"
          % (total / 1048576, out_dir, manifest_path))
    write_staging(wk, tags, overview_team, out_dir, stage_json)


if __name__ == "__main__":
    main()
