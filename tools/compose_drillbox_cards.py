#!/usr/bin/env python3
"""FCG Track 2 - Drillbox overlay cards (Easy, 2026-11-27).

A 1920x1080 transparent layer burned on top of the ORIGINAL training footage.
Nothing is cropped, scaled-out or replaced: the middle of every plate is empty.

TOP LEFT - DRILL HEADER (visible for the whole clip)
  standalone FC Greenfield crest | thin lime rule | compact rounded dark-forest
  panel. Line 1 = [game format] . [drill title], with the title the largest and
  boldest text. Line 2 = [team] . [topic] . [drill number] . [filming date] in
  smaller soft white. The date is the REAL session date in "D MMM YYYY" form,
  e.g. "24 Nov 2026" - never a week code, season code, timecode or ID.

BOTTOM LEFT - DRILL CARD (aligned with the header panel)
  one compact rounded dark-forest card at a time, sized to its text:
    OBJECTIVE  what the drill teaches, from t=0
    SUCCESS    the observable action that counts as success, from the first
               clear repetition (per-cell switch_at)
    RESULT     only when a VERIFIED success count + assessed attempts are
               supplied; shown after the repetitions.

Usage:
  python tools/compose_drillbox_cards.py --topic D1 --cell U11:D1 \
      --source ".../CURRENT/U11-D1.mp4" --seconds 20.63 --out-dir previews \
      --preview-bg frame.jpg
"""
import argparse
import datetime as dt
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
W, H = 1920, 1080
CREST = HERE / "overlays" / "FCG-crest.png"
FONT_DIR = Path(r"C:\Windows\Fonts")

PANEL_BG = (6, 40, 43, 214)          # semi-transparent dark forest green
LIME = (144, 191, 29, 255)           # #90BF1D
WHITE = (255, 255, 255, 255)
SOFT = (219, 231, 232, 238)
MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
PHASE_LABELS = {"ACT": "Activation", "D1": "Drill 1", "D2": "Drill 2",
                "D3": "Drill 3", "TG": "The Game"}
PART_LABELS = {"ACT": "Activation", "D1": "Drill 1", "D2": "Drill 2",
               "D3": "Drill 3", "TG": "The Game"}
FORMAT_RE = re.compile(r"^(\d+\s*v\s*\d+)\s*[·|\-–]\s*(.+)$", re.I)
VS_RE = re.compile(r"\b(\d+\s*v\s*\d+)\b", re.I)
PLAYER_CODE_RE = re.compile(r"\[([GR])\d+\]", re.I)

# Geometry, in 1920x1080 pixels. The bottom card stops around x=1100 so the
# players, ball and mini-goal on the right/middle of the pitch stay visible.
LEFT, TOP, CREST_H = 56, 42, 150
PANEL_GAP, RULE_INSET, TEXT_INSET = 18, 26, 52
PANEL_Y, PANEL_H = 44, 138
CARD_BOTTOM, CARD_MAX_TEXT_W = 1024, 820


def clean(text):
    return re.sub(r"\s+", " ", str(text or "")).strip()


def card_sentence(text):
    """No internal IDs on a coach/parent-facing card: [G9] -> 'the defender'."""
    def repl(m):
        return "the defender" if m.group(1).upper() == "G" else "the attacker"
    return clean(PLAYER_CODE_RE.sub(repl, str(text or "")))


def font(size, bold=False):
    p = FONT_DIR / ("arialbd.ttf" if bold else "arial.ttf")
    if not p.exists():
        p = FONT_DIR / "segoeui.ttf"
    return ImageFont.truetype(str(p), size)


def text_w(d, text, fnt):
    return d.textbbox((0, 0), text, font=fnt, anchor="lt")[2]


def short_date(raw):
    """ISO date -> 'D MMM YYYY' (explicit month table: locale-independent)."""
    try:
        d = dt.date.fromisoformat(str(raw)[:10])
    except (TypeError, ValueError):
        return ""
    return "%d %s %d" % (d.day, MONTHS[d.month - 1], d.year)


def take_date(path, fallback=""):
    """Real filming date = timestamp of the take itself (hardlinks keep it)."""
    raw = fallback
    if path and Path(path).exists():
        raw = dt.datetime.fromtimestamp(Path(path).stat().st_mtime).date().isoformat()
    return short_date(raw)


def split_title(title):
    """'1v1 . Curved run to press' -> ('1v1', 'Curved run to press').

    The game format is taken from the supplied drill title or its drawing name,
    never invented. Titles without one simply render as a bold drill title.
    """
    title = clean(title).replace("|", "·")
    m = FORMAT_RE.match(title)
    if m:
        return VS_RE.sub(lambda x: x.group(1).replace(" ", "").lower(),
                         m.group(1)), clean(m.group(2))
    m = VS_RE.search(title)
    if m:
        fmt = m.group(1).replace(" ", "").lower()
        rest = clean(title[:m.start()] + title[m.end():]).strip(" ·-|")
        return fmt, rest or title
    return "", title


def wrap_words(d, text, fnt, max_w):
    lines, cur = [], ""
    for word in clean(text).split():
        trial = (cur + " " + word).strip()
        if cur and text_w(d, trial, fnt) > max_w:
            lines.append(cur)
            cur = word
        else:
            cur = trial
    if cur:
        lines.append(cur)
    return lines


def load_config(topic):
    p = REPO / "tools" / "data" / ("%s-drillbox-cards.json" % topic.lower())
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


def pass_map(week, topic):
    p = REPO / "tools" / ("drillbox-%s-pass.json" % week.lower())
    if not p.exists():
        return {}
    return json.loads(p.read_text(encoding="utf-8"))


def drill_record(topic, age, phase):
    """Age/phase-specific goal + success from the published D1 drill data."""
    p = REPO / "tools" / "data" / ("%s-data.json" % topic.lower())
    if not p.exists():
        return {}
    data = json.loads(p.read_text(encoding="utf-8"))
    num = int(re.sub(r"\D", "", age) or 0)
    for group in data.get("ages", []):
        if int(group.get("age", 0)) != num:
            continue
        for drill in group.get("drills", []):
            if clean(drill.get("part", "")).lower() == PART_LABELS.get(phase, phase).lower():
                return drill
    return {}


def resolve_fields(topic, age, phase, source, week="", config=None,
                   overrides=None):
    """One flat dict with every word and number the cards may show."""
    config = config if config is not None else load_config(topic)
    overrides = overrides or {}
    key = "%s:%s" % (age.upper(), phase.upper())
    cell = dict(config.get("cells", {}).get(key, {}))
    cell.update({k: v for k, v in overrides.items() if v not in (None, "")})
    passed = pass_map(week, topic).get(key, {})
    record = drill_record(topic, age, phase)
    title = clean(cell.get("title") or passed.get("drill")
                  or record.get("title") or "Training drill")
    fmt, remainder = split_title(cell.get("format") or title)
    if cell.get("format"):
        fmt, remainder = clean(cell["format"]), clean(cell.get("title") or title)
    return {
        "format": fmt,
        "title": remainder,
        "team": clean(cell.get("team") or passed.get("team") or age.upper() + "-G"),
        "topic": topic.upper(),
        "phase": phase.upper(),
        "phase_label": PHASE_LABELS.get(phase.upper(), phase.upper()),
        "date": short_date(cell.get("date") or "") or take_date(source, ""),
        "objective": card_sentence(cell.get("objective") or passed.get("objective")
                                   or record.get("goal") or ""),
        "success": card_sentence(cell.get("success") or passed.get("success")
                                 or record.get("success") or ""),
        "switch_at": float(cell.get("switch_at")
                           or config.get("default_switch_at", 8.0)),
        "verified": cell.get("verified") or {},
    }


def card_schedule(fields, duration):
    """Exactly one card on screen at a time: [label, sentence, from, to]."""
    duration = max(float(duration or 20), 2.0)
    switch = min(max(float(fields.get("switch_at") or 8), 0.5), duration - 1.0)
    cards = [["OBJECTIVE", fields.get("objective", ""), 0.0, switch]]
    v = fields.get("verified") or {}
    if v.get("successful") is not None and v.get("attempts"):
        result_at = min(max(float(v.get("at") or duration - 4.0), switch + 1.0),
                        duration - 0.5)
        cards.append(["SUCCESS", fields.get("success", ""), switch, result_at])
        cards.append(["RESULT", "%d of %d assessed repetitions were successful."
                      % (int(v["successful"]), int(v["attempts"])), result_at, None])
    else:
        cards.append(["SUCCESS", fields.get("success", ""), switch, None])
    return [c for c in cards if c[1]]


def _header(im, fields):
    """Crest + rounded header panel. Returns the panel's left edge."""
    d = ImageDraw.Draw(im)
    crest_w = 126
    if CREST.exists():
        crest = Image.open(CREST).convert("RGBA")
        crest_w = round(crest.width * CREST_H / crest.height)
        im.alpha_composite(crest.resize((crest_w, CREST_H), Image.LANCZOS),
                           (LEFT, TOP))
    px = LEFT + crest_w + PANEL_GAP
    tx = px + TEXT_INSET

    f_fmt, f_title, f_meta = font(30), font(44, bold=True), font(24)
    line1 = [(fields["format"], f_fmt, SOFT), ("   ·   ", f_fmt, SOFT),
             (fields["title"], f_title, WHITE)] if fields["format"] \
        else [(fields["title"], f_title, WHITE)]
    meta = "   ·   ".join(p for p in (
        fields["team"], fields["topic"], fields["phase_label"],
        fields["date"]) if p)

    def width(parts):
        return sum(text_w(d, t, f) for t, f, _ in parts if t)

    w1, w2 = width(line1), text_w(d, meta, f_meta)
    d.rounded_rectangle([px, PANEL_Y, tx + max(w1, w2) + 34, PANEL_Y + PANEL_H],
                        radius=18, fill=PANEL_BG)
    d.rectangle([px + RULE_INSET, PANEL_Y + 22,
                 px + RULE_INSET + 3, PANEL_Y + PANEL_H - 22], fill=LIME)

    x = tx
    for text, fnt, color in line1:
        if text:
            d.text((x, PANEL_Y + 20), text, font=fnt, fill=color, anchor="lt")
            x += text_w(d, text, fnt)
    d.text((tx, PANEL_Y + 88), meta, font=f_meta, fill=SOFT, anchor="lt")
    return px


def _card(im, left, label, sentence):
    """One compact bottom-left card, sized to its text."""
    d = ImageDraw.Draw(im)
    f_label, f_body = font(22, bold=True), font(30)
    lines = wrap_words(d, sentence, f_body, CARD_MAX_TEXT_W)[:3]
    body_w = max((text_w(d, s, f_body) for s in lines), default=0)
    width = 26 + max(body_w, text_w(d, label, f_label)) + 26
    height = 24 + 26 + 12 + len(lines) * 40 + 24
    top = CARD_BOTTOM - height
    d.rounded_rectangle([left, top, left + width, CARD_BOTTOM],
                        radius=18, fill=PANEL_BG)
    d.text((left + 26, top + 22), label, font=f_label, fill=LIME, anchor="lt")
    y = top + 22 + 26 + 12
    for line in lines:
        d.text((left + 26, y), line, font=f_body, fill=WHITE, anchor="lt")
        y += 40
    return (left, top, left + width, CARD_BOTTOM)


def make_plates(fields, duration, out_dir):
    """Write one transparent PNG per card phase; return (path, from, to)."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    plates = []
    for i, (label, sentence, a, b) in enumerate(card_schedule(fields, duration), 1):
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        left = _header(im, fields)
        _card(im, left, label, sentence)
        path = out_dir / ("card-%02d-%s.png" % (i, label.lower()))
        im.save(path)
        plates.append((path, a, b, label))
    return plates


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--topic", default="D1")
    ap.add_argument("--week", default="W13")
    ap.add_argument("--cell", default="U11:D1")
    ap.add_argument("--source", type=Path, default=Path(""))
    ap.add_argument("--seconds", type=float, default=20.63)
    ap.add_argument("--out-dir", type=Path, default=Path("previews"))
    ap.add_argument("--preview-bg", type=Path,
                    help="real video frame; write a JPG composite per card")
    ap.add_argument("--date", default="", help="override the take's filming date")
    ap.add_argument("--switch-at", type=float, default=0)
    args = ap.parse_args()
    age, phase = args.cell.upper().split(":")
    cfg = load_config(args.topic)
    fields = resolve_fields(args.topic, age, phase, args.source, args.week, cfg,
                            {"date": args.date, "switch_at": args.switch_at or None})
    for label, sentence, a, b in card_schedule(fields, args.seconds):
        print("%-9s %5.1f -> %-5s  %s" % (label, a, "end" if b is None else b,
                                           sentence))
    print("header:", " | ".join(filter(None, (
        fields["format"], fields["title"], "||", fields["team"],
        fields["topic"], fields["phase_label"], fields["date"]))))
    plates = make_plates(fields, args.seconds, args.out_dir)
    for path, _, _, label in plates:
        print("plate:", path)
        if args.preview_bg and args.preview_bg.exists():
            bg = Image.open(args.preview_bg).convert("RGBA")
            if bg.size != (W, H):
                bg = bg.resize((W, H), Image.LANCZOS)
            im = Image.open(path).convert("RGBA")
            out = args.out_dir / ("preview-%s.jpg" % label.lower())
            Image.alpha_composite(bg, im).convert("RGB").save(out, quality=90)
            print("preview:", out)


if __name__ == "__main__":
    main()
