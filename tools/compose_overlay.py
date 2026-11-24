#!/usr/bin/env python3
"""Fill Easy's Track 2 / Track 3 overlay plates with the agreed text fields.

Plates (1920x1080 RGBA, designed by Easy 2026-11-23):
  tools/overlays/Track2-OL.png  -> track "library"   (Drillbox example)
  tools/overlays/Track3-BG.png  -> track "coaching"  (best / learning moment)

Field contract (top bar -> bottom bar):
  team | topic | phase | drill   e.g. U11-G | A7 | Drill 1 | 1v1 on the wing
  season  week  date  timeslot  e.g. 2026-F  W11  2026-11-12  17:35-17:40
  objective                     the drill's objective / success sentence

Phase codes are spelled out for coaches (D1 -> "Drill 1") and separated from
the drill name by the same lime-green pipe used between team and topic. The
timeslot is the 5-minute Window from the weekfile Video tab (e.g. 17:35--17:40).

The plates ship with no text: all wording is drawn here, so the same PNG can be
reused for every cell. The middle of both plates is fully transparent, which
leaves room for a coaching cue / highlight ring in Track 3.

Examples:
  python tools/compose_overlay.py --demo --preview-bg frame.png --out-dir previews
  python tools/compose_overlay.py --track library --from-csv A7 U11 D1 \
      --week W11 --date 2026-11-12 --timeslot "17:35--17:40" --out /tmp/overlay.png
  python tools/compose_overlay.py --track coaching --fields fields.json \
      --out /tmp/overlay.png --preview-bg frame.png --preview-out /tmp/preview.jpg
"""
import argparse
import csv
import io
import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
PLATES = {
    "library": HERE / "overlays" / "Track2-OL.png",
    "coaching": HERE / "overlays" / "Track3-BG.png",
}
SESVID = Path(r"C:\Users\munni\Documents\Dashboard\SesVid")
DRILLS_MAP = SESVID / "drills_map.csv"
SUCCESS_MAP = SESVID / "drills_success.csv"
SUCCESS_TEAM_MAP = SESVID / "drills_success_team.csv"

W, H = 1920, 1080
FONT_DIR = Path(r"C:\Windows\Fonts")
PLATE_RGB = (6, 40, 43)
WHITE = (255, 255, 255, 255)
LIME = (144, 191, 29, 255)          # crest green in the plates (#90BF1D)
YELLOW = (255, 237, 0, 255)         # Track 2 bottom accent
MUTED = (185, 202, 204, 255)
ORANGE = (245, 166, 35, 255)
PIPE = "   |   "            # lime separator between every top-line field
DOT = "   ·   "            # quiet separator on the second line

# Rectangles measured from the PNGs, in original 1920x1080 pixels.
GEOM = {
    "library": {
        "top": (0, 0, 1920, 146),
        "text_x": 212,             # after crest (47..144) + divider (177..182)
        "l1_y": 20, "l1_size": 46, "l1_right": 1860,
        "l2_y": 90, "l2_size": 27, "l2_right": 1860,
        "bottom": (0, 933, 1920, 1080),
        "bottom_x": 76,            # after yellow rule (41..46)
        "label_y": 949, "label_size": 22,
        "obj_y": 982, "obj_size": 34, "obj_lines": 2,
        "obj_right": 1848,
    },
    "coaching": {
        "top": (0, 69, 1015, 172),
        "text_x": 244,             # after crest (75..218)
        "l1_y": 82, "l1_size": 38, "l1_right": 990,
        "l2_y": 133, "l2_size": 24, "l2_right": 990,
        "chip": (38, 948, 328, 983),
        "chip_size": 21,
        "bottom": (514, 875, 1880, 1047),
        "bottom_x": 546,
        "label_y": 892, "label_size": 21,
        "obj_y": 924, "obj_size": 31, "obj_lines": 2,
        "obj_right": 1848,
    },
}

DEMO = {
    "team": "U11-G",
    "topic": "A7",
    "phase": "D1",
    "drill": "1v1 on the wing",
    "season": "2026-F",
    "week": "W11",
    "date": "2026-11-12",
    "timeslot": "17:35-17:40",
    "objective": ("Winger is confident in 1v1, has the idea where and how to beat "
                  "the opponent and is successful most of the time."),
    "moment": "FCG MOMENT",
}

# Coach-facing spellings for the phase codes in the Drillbox URL.
PHASE_LABELS = {
    "ACT": "ACT",
    "D1": "Drill 1", "D2": "Drill 2", "D3": "Drill 3",
    "TG": "The Game",
}

STUB = re.compile(r"^(?:[AD]\d+\s*\|\s*U\d+|[AD]\d+-\d+|D1-\d+|D2-\d+|D3-\d+)\b")
EMOJI = re.compile(
    "[\U0001F000-\U0001FAFF\u2600-\u27BF\uFE0F\u200D\u2190-\u21FF\u2B00-\u2BFF]"
)


def clean(text):
    """Drop glyphs the Arial fonts cannot draw (emoji, arrows, variation marks)."""
    text = EMOJI.sub("", str(text or ""))
    return re.sub(r"\s+", " ", text).strip()


def font(size, bold=False):
    name = "arialbd.ttf" if bold else "arial.ttf"
    path = FONT_DIR / name
    if not path.exists():
        path = FONT_DIR / "segoeui.ttf"
    return ImageFont.truetype(str(path), size)


def text_w(draw, text, fnt):
    return draw.textbbox((0, 0), text, font=fnt, anchor="lt")[2]


def phase_label(code):
    """D1 -> 'Drill 1'; leave already-spelled-out labels untouched."""
    code = clean(code)
    return PHASE_LABELS.get(code.upper(), code)


def timeslot_text(value):
    """Weekfile Window is '17:35--17:40'; one hyphen reads better on video."""
    return re.sub(r"\s*--\s*", "-", clean(value)).strip(" -")


def segments(fields, size):
    """Top line: Team | Topic | Drill N | Drill name (all pipes lime).

    Sheet stubs such as "D1-1" never reach a frame: when the drill name is
    missing the last pipe is dropped too, so the line simply ends at "Drill 1".
    """
    parts = [
        (clean(fields.get("team", "")).upper(), WHITE),
        (PIPE, LIME),
        (clean(fields.get("topic", "")).upper(), WHITE),
        (PIPE, LIME),
        (phase_label(fields.get("phase", "")), LIME),
        (PIPE, LIME),
    ]
    drill = clean(fields.get("drill", ""))
    if drill:
        parts.append((drill, WHITE))
    else:
        parts.pop()
    return parts


def meta_segments(fields):
    """Second line: Season · Week · Date · Timeslot."""
    values = [clean(fields.get(k, "")).upper() for k in ("season", "week", "date")]
    values.append(timeslot_text(fields.get("timeslot", "")))
    parts = []
    for value in values:
        if not value:
            continue
        if parts:
            parts.append((DOT, MUTED))
        parts.append((value, MUTED))
    return parts


def fit_parts(draw, parts, max_w, base_size, bold=False, min_size=18):
    """Shrink a segmented line until it fits inside the plate."""
    for size in range(base_size, min_size - 1, -1):
        fnt = font(size, bold)
        width = sum(text_w(draw, t, fnt) for t, _ in parts)
        if width <= max_w:
            return fnt, width
    return font(min_size, bold), sum(text_w(draw, t, font(min_size, bold)) for t, _ in parts)


def draw_segments(draw, x, y, parts, fnt):
    for text, color in parts:
        if not text:
            continue
        draw.text((x, y), text, font=fnt, fill=color, anchor="lt")
        x += text_w(draw, text, fnt)
    return x


def fit_wrap(draw, text, max_w, max_lines, base_size, bold=False, min_size=20):
    """Wrap to <= max_lines, shrinking the font until it fits."""
    text = clean(text)
    for size in range(base_size, min_size - 1, -2):
        fnt = font(size, bold)
        words, lines, cur = text.split(), [], ""
        for word in words:
            trial = (cur + " " + word).strip()
            if text_w(draw, trial, fnt) <= max_w or not cur:
                cur = trial
            else:
                lines.append(cur)
                cur = word
        if cur:
            lines.append(cur)
        if len(lines) <= max_lines and all(text_w(draw, l, fnt) <= max_w for l in lines):
            return lines, fnt, size + 6
    fnt = font(min_size, bold)
    return [text], fnt, min_size + 6


def draw_plate(track, fields):
    plate = PLATES[track]
    if not plate.exists():
        sys.exit("Missing plate: %s" % plate)
    im = Image.open(plate).convert("RGBA")
    if im.size != (W, H):
        sys.exit("Plate %s is %s, expected %s" % (plate.name, im.size, (W, H)))
    draw = ImageDraw.Draw(im)
    g = GEOM[track]

    # --- top bar, line 1: Team | Topic | Drill N | Drill name ----------------
    l1_parts = segments(fields, g["l1_size"])
    l1, _ = fit_parts(draw, l1_parts, g["l1_right"] - g["text_x"],
                      g["l1_size"], bold=True)
    draw_segments(draw, g["text_x"], g["l1_y"], l1_parts, l1)

    # --- top bar, line 2: Season / Week / Date / Timeslot --------------------
    l2_parts = meta_segments(fields)
    l2, _ = fit_parts(draw, l2_parts, g["l2_right"] - g["text_x"], g["l2_size"])
    draw_segments(draw, g["text_x"], g["l2_y"], l2_parts, l2)

    # --- Track 3 status chip on the small bottom-left plate -----------------
    if track == "coaching":
        chip = g["chip"]
        cf = font(g["chip_size"], bold=True)
        label = clean(fields.get("moment", "FCG MOMENT")).upper()
        cx = (chip[0] + chip[2]) / 2
        cy = (chip[1] + chip[3]) / 2
        color = ORANGE if "LEARN" in label else LIME
        draw.text((cx, cy), label, font=cf, fill=color, anchor="mm")

    # --- bottom objective ---------------------------------------------------
    label_f = font(g["label_size"], bold=True)
    draw.text((g["bottom_x"], g["label_y"]), "OBJECTIVE",
              font=label_f, fill=LIME, anchor="lt")
    obj = clean(fields.get("objective", ""))
    lines, obj_f, leading = fit_wrap(draw, obj, g["obj_right"] - g["bottom_x"],
                                     g["obj_lines"], g["obj_size"])
    for i, line in enumerate(lines):
        draw.text((g["bottom_x"], g["obj_y"] + i * leading), line,
                  font=obj_f, fill=WHITE, anchor="lt")
    return im, len(lines), obj_f.size


def resolve_from_csv(topic, age, phase, week="", season="2026-F", date="",
                     squad="", timeslot=""):
    """Autofill drill name + objective from the FCG Drills / success maps."""
    topic, age, phase = topic.upper(), age.upper(), phase.upper()
    fields = dict(DEMO)
    fields.update(team=age + "-G", topic=topic, phase=phase,
                  week=week.upper(), season=season, date=date,
                  timeslot=timeslot_text(timeslot),
                  drill="", objective="", moment="FCG MOMENT")

    def rows(path):
        if not path.exists():
            return []
        with io.open(path, newline="", encoding="utf-8-sig") as f:
            return list(csv.reader(f))

    for r in rows(DRILLS_MAP):
        if len(r) >= 7 and r[1].strip().upper() == topic and r[2].strip().upper() == age:
            block = {"ACT": 3, "D1": 4, "D2": 5, "D3": 6}.get(phase)
            if block and not STUB.match(r[block].strip()):
                fields["drill"] = r[block].strip()
            break

    def sentence(cells, cols, team_only=False):
        for r in rows(cells):
            if len(r) < max(cols.values()) + 1 or r[0].strip().upper() != topic:
                continue
            if team_only:
                # Each age cell has its own team key, e.g. 2026-F-U11-G -> JUV.
                # Resolve it per cell; --squad only overrides when explicitly given.
                if squad:
                    if r[1].strip().upper() != squad.upper():
                        continue
                elif r[2].strip().upper() != team_key.upper():
                    continue
            elif r[1].strip().upper() != age:
                continue
            col = cols.get(phase)
            val = r[col].strip() if col is not None else ""
            if val and not STUB.match(val):
                return val
        return ""

    age_num = int(re.sub(r"\D", "", age))
    team_key = "%s-U%02d-G" % (season, age_num)
    team_cols = {"ACT": 4, "D1": 5, "D2": 6, "D3": 7}
    age_cols = {"ACT": 2, "D1": 3, "D2": 4, "D3": 5}
    fields["objective"] = (sentence(SUCCESS_TEAM_MAP, team_cols, team_only=True)
                           or sentence(SUCCESS_MAP, age_cols))
    return fields


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--track", choices=sorted(PLATES))
    ap.add_argument("--demo", action="store_true", help="render both plates with sample data")
    ap.add_argument("--fields", help="JSON file or inline JSON object")
    ap.add_argument("--from-csv", nargs=3, metavar=("TOPIC", "AGE", "PHASE"),
                    help="resolve drill + objective from SesVid CSV maps")
    ap.add_argument("--squad", default="", help="team squad code for drills_success_team.csv")
    ap.add_argument("--week", default="")
    ap.add_argument("--season", default="2026-F")
    ap.add_argument("--date", default="")
    ap.add_argument("--timeslot", default="",
                    help="5-min Window from the Video tab, e.g. '17:35--17:40'")
    ap.add_argument("--out", type=Path)
    ap.add_argument("--out-dir", type=Path, default=Path("previews"))
    ap.add_argument("--preview-bg", type=Path, help="video frame to composite under the plate")
    ap.add_argument("--preview-out", type=Path)
    args = ap.parse_args()

    if args.fields:
        raw = args.fields
        if Path(raw).exists():
            raw = Path(raw).read_text(encoding="utf-8")
        overrides = json.loads(raw)
    else:
        overrides = {}
    for k in ("week", "season", "date", "timeslot"):
        if getattr(args, k):
            overrides[k] = getattr(args, k)
    if "moment" not in overrides:
        overrides["moment"] = "FCG MOMENT"

    if args.from_csv:
        base = resolve_from_csv(*args.from_csv, week=args.week, season=args.season,
                                date=args.date, squad=args.squad,
                                timeslot=args.timeslot)
    else:
        base = dict(DEMO)
    base.update({k: v for k, v in overrides.items() if v not in (None, "")})
    base["timeslot"] = timeslot_text(base.get("timeslot", ""))

    tracks = sorted(PLATES) if args.demo else [args.track]
    if not tracks or tracks == [None]:
        sys.exit("Use --track library|coaching or --demo")
    args.out_dir.mkdir(parents=True, exist_ok=True)

    for track in tracks:
        im, lines, size = draw_plate(track, base)
        out = args.out if (args.out and not args.demo) else args.out_dir / ("overlay-%s.png" % track)
        out.parent.mkdir(parents=True, exist_ok=True)
        im.save(out)
        print("%-9s -> %s   objective %d line(s) @ %dpx" % (track, out, lines, size))

        if args.preview_bg:
            bg = Image.open(args.preview_bg).convert("RGBA")
            if bg.size != (W, H):
                bg = bg.resize((W, H), Image.LANCZOS)
            preview = Image.alpha_composite(bg, im).convert("RGB")
            pout = args.preview_out if (args.preview_out and not args.demo) \
                else args.out_dir / ("preview-%s.jpg" % track)
            pout.parent.mkdir(parents=True, exist_ok=True)
            preview.save(pout, quality=90)
            print("           preview -> %s" % pout)

    if args.demo:
        (args.out_dir / "fields.json").write_text(
            json.dumps(base, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print("fields    -> %s" % (args.out_dir / "fields.json"))


if __name__ == "__main__":
    main()
