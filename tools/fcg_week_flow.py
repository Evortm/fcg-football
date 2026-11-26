# -*- coding: utf-8 -*-
"""FCG weekly video flow - one repeatable chain for W13..W20.

The chain (process point 2: PASS -> tagging):

    status      read-only snapshot of the week
    focus       extract the 4 standard focus points per age from the week
                workbook FP tab -> tools/data/wNN-focus.json
    data        refresh tagging/data/wNN-data.js from the LIVE Video board
                (only Pass clips; encode any missing 540p tagging copies)
    clean       move rejected (Redo) takes out of SesVid/CURRENT into
                SesVid/_rejected/WNN/ - reversible, hardlink-safe
    restore     undo `clean` (re-hardlink the quarantined takes)
    queue       refresh the TAG WNN tab from Video + Tags + wNN-data.js
    report      build the compact WNN report tab (live CHAR(10) formulas)
    all         data -> clean -> queue

Usage:
    python tools/fcg_week_flow.py status --week W13
    python tools/fcg_week_flow.py focus  --week W13
    python tools/fcg_week_flow.py all    --week W13
    python tools/fcg_week_flow.py all    --week W14 --topic D2 --topic-file d2-data.json --set-default

Rules encoded here (agreed with Easy, Nov 2026):
  * PASS = watched AND >= 3.0 stars. Only Pass goes into the tagging list.
  * Track 1 improves trainers; a rejected take is NOT a judgement.
  * Redo -> Pass happens in the SAME cell (no extra rows).
  * Rejected takes leave the working set before tagging and are purged at
    week end. `clean` only quarantines; it never destroys data.
  * Week workbooks that do not exist yet are discovered by title, never by
    guessed file ids.
  * Focus points come from the WEEK workbook (FP tab, current-topic column),
    never from the generic observe lines in a topic file. Every clip of a team
    gets the SAME standard four (PA / OB / TW / AE) for its board objective age.
"""
import argparse
import base64
import csv
import glob
import io
import json
import os
import re
import shutil
import subprocess
import sys
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
TOOLS_DATA = REPO / "tools" / "data"
TAG_DATA = REPO / "tagging" / "data"
CONFIG = TOOLS_DATA / "weeks.json"
DRILLS = ("ACT", "D1", "D2", "D3")
PASS, REDO = "Pass", "Redo"
FOCUS = (("passing", "PA", "Actions with ball · Passing"),
         ("without-ball-out", "OB", "Actions without ball · Out of possession"),
         ("teamwork", "TW", "Mindset · Teamwork"),
         ("agility-endurance", "AE", "PD & GK · Agility & Endurance"))
# The FP tab marks the four weekly focus blocks in the current-topic column.
FP_SECTIONS = {"Passing": "passing", "Actions -": "without-ball-out",
               "Teamwork": "teamwork", "Agility / Endurance": "agility-endurance"}
FP_ROWS = 122


# --------------------------------------------------------------------------
# Tencent Docs SDK (version-independent discovery)
# --------------------------------------------------------------------------
def _sdk():
    pat = r"C:\Users\munni\.workbuddy\plugins\cache\workbuddy-builtin\tencent-docs-plugin\*\skills\tencent-docs"
    cands = [p for p in glob.glob(pat) if (Path(p) / "tencentdocs.py").exists()]
    if not cands:
        raise RuntimeError("Tencent Docs SDK not found: " + pat)
    def version(p):
        m = re.search(r"tencent-docs-plugin\\([0-9.]+)", p)
        return tuple(int(x) for x in m.group(1).split(".")) if m else (0,)
    return max(cands, key=version)


sys.path.insert(0, _sdk())
import tencentdocs as td  # noqa: E402

b64 = lambda s: base64.b64encode(str(s).encode("utf-8")).decode()


def call(tool, args, server="sheet-mcp"):
    r, e = td.call_tool(server, tool, args)
    if e:
        raise RuntimeError("%s: %s" % (tool, e))
    if "error" in r:
        raise RuntimeError("%s: %s" % (tool, json.dumps(r["error"], ensure_ascii=False)))
    return r["result"]["structuredContent"]


def grid(file_id, sheet_id, r0, r1, c0, c1, raw=False):
    d = call("get_cell_data", {"file_id": file_id, "sheet_id": sheet_id,
                               "return_csv": not raw, "start_row": r0,
                               "end_row": r1, "start_col": c0, "end_col": c1})
    if raw:
        out = {}
        for c in d.get("cells") or []:
            out.setdefault(c["row"], {})[c["col"]] = c.get("string_value") or ""
        return out
    return list(csv.reader(io.StringIO(d["csv_data"])))


def sheets(file_id):
    return call("get_sheet_info", {"file_id": file_id})["sheets"]


def sheet_by_name(file_id, name):
    for s in sheets(file_id):
        if s["sheet_name"] == name:
            return s["sheet_id"]
    return None


def ensure_sheet(file_id, name):
    found = sheet_by_name(file_id, name)
    if found:
        return found
    d = call("add_sheet", {"file_id": file_id, "name": name,
                           "append_index": True})
    sid = d.get("sheet_id") or d.get("sheetId") or d.get("id")
    if not sid:
        sid = sheet_by_name(file_id, name)
    if not sid:
        raise RuntimeError("add_sheet returned no id: %s" % json.dumps(d)[:300])
    return sid


def resolve_week(cfg, week):
    w = dict(cfg["weeks"][week])
    if not w.get("file_id"):
        d = call("manage.search_file",
                 {"search_key": w["title"], "size": 20, "file_types": ["sheet"]},
                 server="tencent-docs")
        files = d.get("files") or d.get("list") or d.get("items") or []
        hit = next((f for f in files
                    if (f.get("title") or f.get("name")) == w["title"]), None)
        if not hit:
            raise RuntimeError("Week workbook %r not found yet in Tencent Docs. "
                               "Create/copy it first, then re-run." % w["title"])
        w["file_id"] = hit.get("file_id") or hit.get("id")
    w["board"] = w.get("board") or sheet_by_name(w["file_id"], "Video")
    w["tags"] = w.get("tags") or sheet_by_name(w["file_id"], "Tags")
    rs = sheets(cfg["report_file_id"])
    if not w.get("report_detail"):
        cand = [s["sheet_name"] for s in rs
                if s["sheet_name"].endswith("-" + week) and "NEW" not in s["sheet_name"]]
        w["report_detail"] = cand[0] if cand else None
    if not w.get("report_compact"):
        w["report_compact"] = "%s-%s-NEW" % (w.get("topic") or "T", week)
    if not w.get("topic"):
        m = re.match(r"([A-Z][0-9]+)-", w.get("report_detail") or "")
        w["topic"] = m.group(1) if m else None
    if not w.get("topic_code"):
        w["topic_code"] = (w["topic"] or "T") + "F"
    if not w.get("day_tag"):
        w["day_tag"] = None
    return w


# --------------------------------------------------------------------------
# Board
# --------------------------------------------------------------------------
def read_board(cfg, w):
    """Return ordered rows: 12 teams with day/time/status + combined feedback."""
    by = grid(w["file_id"], w["board"], 0, 14, 0, 17, raw=True)
    rows = []
    for r in range(2, 14):
        row = by.get(r, {})
        team = row.get(1, "").strip()
        if not team:
            continue
        drills = []
        for k, drill in enumerate(DRILLS):
            drills.append({"drill": drill,
                           "day": row.get(3 + 3 * k, "").strip(),
                           "time": row.get(4 + 3 * k, "").strip(),
                           "status": row.get(5 + 3 * k, "").strip()})
        def split_lines(col):
            out = {}
            for line in (row.get(col, "") or "").split("\n"):
                m = re.match(r"\s*(ACT|D1|D2|D3)\s*:\s*(.*)", line)
                if m:
                    out[m.group(1)] = m.group(2).strip()
            return out
        rows.append({"team": team, "objective": row.get(0, "").strip(),
                     "group": row.get(2, "").strip(),
                     "drills": drills,
                     "remarks": split_lines(15), "ratings": split_lines(16)})
    return rows


def iter_board(rows):
    for b in rows:
        for d in b["drills"]:
            yield b, d


def rejected(rows):
    return [(b, d) for b, d in iter_board(rows) if d["status"] == REDO]


# --------------------------------------------------------------------------
# data: tagging app dataset
# --------------------------------------------------------------------------
def load_existing_data(week):
    p = TAG_DATA / ("%s-data.js" % week.lower())
    if not p.exists():
        return None, {}
    t = p.read_text(encoding="utf-8")
    m = re.match(r"window\.FCG_W\d+\s*=\s*", t)
    if not m:
        return None, {}
    start = t.find("{", m.end() - 1)
    # JS objects here are JSON except for "roster": window.PILOT.roster
    body = t[start:]
    end = body.find('\n  "roster": window.PILOT.roster')
    if end < 0:
        return None, {}
    head = body[:end].rstrip().rstrip(",") + "\n}"
    obj = json.loads(head)
    dm = re.search(r'"defaultClip"\s*:\s*"([^"]+)"', t)
    if dm:
        obj["defaultClip"] = dm.group(1)
    return obj, {c["id"]: c for c in obj.get("clips", [])}


def focus_path(week, focus_file=None):
    return TOOLS_DATA / (focus_file or ("%s-focus.json" % week.lower()))


def cmd_focus(cfg, week, args):
    """Read the four weekly focus points per age from the week workbook FP tab.

    Column F (`D1` in W13) mirrors the CURRENT topic of the FP matrix. Its
    section headers (Passing / Actions - / Teamwork / Agility / Endurance)
    delimit the four standard building blocks; each U5..U12 row holds that
    week's actual text. This is the single source of truth for tagging focus.
    """
    w = resolve_week(cfg, week)
    sid = w.get("fp_sheet") or sheet_by_name(w["file_id"], "FP")
    if not sid:
        raise RuntimeError("Week %s has no FP tab" % week)
    rows = grid(w["file_id"], sid, 0, FP_ROWS, 0, 7)
    section, by_age = None, {}
    for row in rows:
        cell = lambda i: (row[i].strip() if i < len(row) else "")
        if cell(5) in FP_SECTIONS and not cell(4):
            section = FP_SECTIONS[cell(5)]
            continue
        m = re.fullmatch(r"U(\d+)", cell(4))
        if section and m and cell(5):
            by_age.setdefault(int(m.group(1)), {})[section] = cell(5)
    ages = {a: v for a, v in by_age.items() if len(v) == len(FOCUS)}
    missing = sorted(set(range(5, 13)) - set(ages))
    if missing:
        raise RuntimeError("FP tab: no complete 4-focus set for U%s" %
                           ", U".join(map(str, missing)))
    payload = {
        "week": week,
        "topic": w.get("topic"),
        "source": "%s · FP tab (%s) · current-topic column" % (w["title"], sid),
        "file_id": w["file_id"],
        "sheet_id": sid,
        "sections": FP_SECTIONS,
        "focus": {str(a): ages[a] for a in sorted(ages)},
    }
    p = focus_path(week, w.get("focus_file"))
    p.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print("FOCUS %s | %d ages x %d = %d focus points -> %s" %
          (week, len(ages), len(FOCUS), len(ages) * len(FOCUS), p.name))
    for a in sorted(ages):
        print("  U%-2d %s" % (a, " | ".join(ages[a][f] for f, _, _ in FOCUS)))


def focus_library(topic, topic_file, week, focus_file=None):
    """Four standard focus points per age, from the WEEK workbook FP tab.

    Fallback (only when `focus` has not been run for that week): the topic
    file's gameAssessment - that is the same FP column. The generic
    `path.observe` lines are deliberately NOT used as primary text.
    """
    out = []
    fp = focus_path(week, focus_file)
    if fp.exists():
        src = json.loads(fp.read_text(encoding="utf-8"))
        for age, texts in sorted(((int(a), t) for a, t in src["focus"].items())):
            for fid, suffix, label in FOCUS:
                out.append({"code": "%sU%d%s" % (topic, age, suffix),
                            "label": label,
                            "topic": "%s · %s · U%d" % (topic, week, age),
                            "desc": texts.get(fid, "")})
        return out
    p = TOOLS_DATA / (topic_file or ("%s-data.json" % (topic or "").lower()))
    if not p.exists():
        raise RuntimeError("Focus source missing: run `focus --week %s` "
                           "or provide %s" % (week, p.name))
    d = json.loads(p.read_text(encoding="utf-8"))
    for entry in d["ages"]:
        age = entry["age"]
        observes = [x.strip() for x in
                    entry["path"].get("observe", "").splitlines() if x.strip()]
        assess = {g.get("focusId"): g.get("text", "")
                  for g in entry.get("gameAssessment", [])}
        for i, (fid, suffix, label) in enumerate(FOCUS):
            desc = (assess.get(fid) or
                    (observes[i] if i < len(observes) else label))
            out.append({"code": "%sU%d%s" % (topic, age, suffix),
                        "label": label,
                        "topic": "%s · %s · U%d" % (topic, week, age),
                        "desc": desc})
    return out


def ffmpeg_exe():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def probe_duration(ff, path):
    p = subprocess.run([ff, "-hide_banner", "-i", str(path)],
                       capture_output=True, text=True)
    for line in p.stderr.splitlines():
        if "Duration:" in line:
            h, m, s = line.split("Duration:")[1].split(",")[0].strip().split(":")
            return round(int(h) * 3600 + int(m) * 60 + float(s), 3)
    return 0.0


def encode(ff, src, dst, height, crf):
    cmd = [ff, "-y", "-hide_banner", "-loglevel", "error", "-i", str(src),
           "-map", "0:v:0", "-map", "0:a:0?", "-vf", "scale=-2:%d" % height,
           "-c:v", "libx264", "-preset", "veryfast", "-crf", str(crf),
           "-pix_fmt", "yuv420p", "-threads", "4", "-c:a", "aac",
           "-b:a", "64k", "-ac", "2", "-movflags", "+faststart", str(dst)]
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError("ffmpeg: " + (p.stderr or "")[-400:])


def load_pilot():
    t = (TAG_DATA / "pilot-data.js").read_text(encoding="utf-8").strip()
    return json.loads(t[len("window.PILOT = "):].rstrip().rstrip(";"))


def clip_id(w, b, d, tm):
    age = int(tm["age"][1:])
    day = w.get("day_tag") or d["day"] or "MON"
    return "VID-FCG-%s-%s-U%02d%s-%s-01" % (w["topic_code"], d["drill"],
                                            age, tm["variant"], day)


def find_source(cfg, w, stem, drill, day):
    root = Path(cfg["source_root"])
    cands = [root / "CURRENT" / ("%s-%s.mp4" % (stem, drill))]
    if w.get("week_folder"):
        wf = root / w["week_folder"]
        cands += [wf / day.upper() / ("%s-%s.mp4" % (stem, drill)),
                  wf / "MON" / ("%s-%s.mp4" % (stem, drill)),
                  wf / ("%s-%s.mp4" % (stem, drill))]
    for p in cands:
        if p.exists():
            return p
    return None


def cmd_data(cfg, week, args):
    w = resolve_week(cfg, week)
    if not w.get("topic"):
        raise RuntimeError("No topic for %s - pass --topic D2" % week)
    rows = read_board(cfg, w)
    pilot = load_pilot()
    roster = pilot["roster"]
    # rosterIds are built from a player's REGISTERED team+group. Players who
    # trained with another group that day (guests, moved-up kids) must still be
    # taggable, so each week can list them explicitly per group. Source for
    # W13 is the week workbook's List tab (day attendance), not the master
    # player database.
    additions = w.get("roster_additions") or {}
    known_ids = {p["id"] for p in roster}
    for grp, ids in additions.items():
        unknown = [x for x in ids if x not in known_ids]
        if unknown:
            raise RuntimeError("roster_additions for %s/%s contain IDs missing "
                               "from pilot-data.js roster: %s" %
                               (week, grp, ", ".join(unknown)))
    lib = focus_library(w["topic"], args.topic_file or w.get("topic_file"),
                        week, w.get("focus_file"))
    codes = {f["code"] for f in lib}
    old, templates = load_existing_data(week)
    out_dir = REPO / "tagging" / "media" / w["media_dir"]
    out_dir.mkdir(parents=True, exist_ok=True)
    dur_path = TOOLS_DATA / ("%s-durations.json" % week.lower())
    durations = json.loads(dur_path.read_text(encoding="utf-8")) if dur_path.exists() else {}
    # Which raw take each 540p copy was encoded from. A re-recording replaces
    # the CURRENT hardlink; without this, a stale Monday copy survives forever
    # because the -MON filename already exists.
    manifest_path = TOOLS_DATA / ("%s-media.json" % week.lower())
    manifest = (json.loads(manifest_path.read_text(encoding="utf-8"))
                if manifest_path.exists() else {})
    ff = ffmpeg_exe()

    teams = cfg["teams"]
    clips, skipped, encoded = [], [], []
    for b, d in iter_board(rows):
        if d["status"] != PASS:
            continue
        tm = teams.get(b["team"])
        if not tm:
            skipped.append((b["team"], d["drill"], "no team mapping"))
            continue
        src = find_source(cfg, w, tm["stem"], d["drill"], d["day"])
        if not src:
            skipped.append((b["team"], d["drill"], "no raw take"))
            continue
        name_tpl = w.get("clip_name") or ("%s-%s-{drill}-{stem}-{day}.mp4" % (week, w["topic"]))
        out_name = name_tpl.format(topic=w["topic"], drill=d["drill"],
                                   stem=tm["stem"], day=w.get("day_tag") or d["day"] or "MON")
        out = out_dir / out_name
        real_day = (d["day"] or w.get("day_tag") or "MON").upper()
        real_time = d["time"] or ""
        src_st = src.stat()
        fp = {"ino": getattr(src_st, "st_ino", 0), "size": src_st.st_size,
              "mtime_ns": getattr(src_st, "st_mtime_ns", 0)}
        src_dur = probe_duration(ff, src)
        out_st = out.stat() if out.exists() else None
        out_dur = probe_duration(ff, out) if out_st else None
        entry = manifest.get(out_name)
        # Re-recorded take? Catch it even when the duration happens to match
        # the old take (U9W-D1: MON and TUE are both 172.27 s).
        stale = (out_st is None
                 or src_st.st_mtime > out_st.st_mtime + 1
                 or (entry is not None and entry.get("fp") != fp)
                 or out_dur is None or abs(out_dur - src_dur) > 0.05)
        if stale:
            if args.dry_run:
                encoded.append(out_name)
            else:
                print("  encoding %s -> %s (%s take)" %
                      (src.name, out_name, real_day), flush=True)
                encode(ff, src, out, cfg["video_height"], cfg["video_crf"])
                encoded.append(out_name)
                out_dur = probe_duration(ff, out)
        dur = out_dur or src_dur
        durations[src.name] = round(src_dur, 3)
        durations["%s/%s" % (real_day, src.name)] = round(src_dur, 3)
        manifest[out_name] = {"fp": fp, "duration": round(dur, 3),
                              "day": real_day, "time": real_time}
        cid = clip_id(w, b, d, tm)
        rating = b["ratings"].get(d["drill"], "").replace("—", "").strip()
        remark = b["remarks"].get(d["drill"], "").replace("—", "").strip()
        day = w.get("day_tag") or d["day"] or "MON"
        age = int(tm["age"][1:])
        focus_age = (b["objective"] if re.fullmatch(r"U\d+", b["objective"] or "")
                     else tm["age"])
        is_new = cid not in templates
        if is_new:
            grp = b["group"] or tm["group"]
            c = {"id": cid, "drill": d["drill"], "team": b["team"],
                 "group": grp,
                 "squad": {"label": "%s / %s" % (b["team"], grp),
                           "teams": [b["team"]]},
                 "session": "%s %s · %s take" % (week, w["topic"], day),
                 "window": "", "file": "media/%s/%s" % (w["media_dir"], out_name),
                 "topic": "%s — %s" % (w["topic"], week),
                 "prefix": "%sU%02d%s%s%s" % (w["topic_code"], age,
                                              tm["variant"], d["drill"], day),
                 "basis": "Clip position", "combined": False, "hash": "",
                 "file_id": "", "file_remote": "",
                 "segments": [{"index": 1, "file_start": 0, "file_end": dur,
                               "source_start": None, "clock": "",
                               "note": "Full recording; camera-clock mapping not verified"}],
                 "rosterIds": [p["id"] for p in roster
                               if p["team"] == b["team"] and p["group"] == grp]}
        else:
            c = json.loads(json.dumps(templates[cid]))   # deep copy
        # Day-list guests are appended to the registered squad. Doing this for
        # existing clips too keeps the fix after a data refresh (templates
        # would otherwise carry the old, filtered rosterIds forward).
        for pid in additions.get(c["group"], []):
            if pid not in c.setdefault("rosterIds", []):
                c["rosterIds"].append(pid)
        # Standard rule: every clip of a team shows the SAME four weekly
        # focus points, taken from the FP tab for the board objective age.
        fl = ["%s%s%s" % (w["topic"], focus_age, s) for _, s, _ in FOCUS]
        missing = [x for x in fl if x not in codes]
        if missing:
            raise RuntimeError("Focus library is missing %s" % ", ".join(missing))
        c.update({
            "title": "%s / %s · %s · PASS · %s" % (b["team"], c["group"],
                                                   d["drill"], rating or "—"),
            "status": "Pass 通过",
            "rating": rating,
            "remark": remark,
            "file": c.get("file") or "media/%s/%s" % (w["media_dir"], out_name),
            "source_name": src.name,
            "duration": dur,
            "size": out.stat().st_size if out.exists() else c.get("size", 0),
            "origin": "%s %s · %s %s take · Pass · %s" % (
                week, w["topic"], real_day, real_time, rating or "—"),
            "focus": fl,
            # id / prefix / file stay on the pinned day so existing tags and
            # links survive. The DISPLAY tells when the take was really shot.
            "window": ("%s %s" % (real_day, real_time)).strip(),
            # Keep the richer scheduled-session string for clips still on the
            # pinned day; a re-recorded clip gets an honest plain label.
            "session": (c.get("session") if real_day == day
                        else "%s %s · %s take" % (week, w["topic"], real_day)),
            "phaseLabel": "%s · PASS · %s" % (d["drill"], real_day),
        })
        if c.get("segments"):
            c["segments"][0]["file_end"] = dur
        clips.append(c)

    print("PASS rows: %d | clips: %d | encoded: %d | skipped: %s" %
          (sum(1 for _, d in iter_board(rows) if d["status"] == PASS),
           len(clips), len(encoded), skipped))
    if args.dry_run:
        for n in encoded:
            print("  re-encode", n)
        return

    payload = {
        "week": week,
        "topic": w["topic"],
        "weekLabel": "%s - %s" % (week, w["topic"]),
        "clips": clips,
        "roster": "@@ROSTER@@",
        "focusLibrary": lib,
        "coachCode": "%s%s" % (week, w["topic"]),
        "source": "%s %s takes - 540p H.264/AAC tagging copies" % (week, w["topic"]),
        "defaultClip": (old or {}).get("defaultClip") or (clips[0]["id"] if clips else ""),
    }
    body = json.dumps(payload, ensure_ascii=False, indent=2)
    body = body.replace('"@@ROSTER@@"', "window.PILOT.roster")
    loader = ("(function () {\n"
              "  var week = \"\";\n"
              "  try { week = new URLSearchParams(location.search).get(\"week\") || \"\"; } catch (err) {}\n"
              "  week = (week || (window.FCG_WEEKS && window.FCG_WEEKS.defaultWeek) || \"W11\").toUpperCase();\n"
              "  if (week === \"%s\" && window.FCG_%s) window.PILOT = window.FCG_%s;\n"
              "})();\n" % (week, week, week))
    out = TAG_DATA / ("%s-data.js" % week.lower())
    if out.exists():
        shutil.copy2(out, TAG_DATA / ("%s-data.js.bak" % week.lower()))
    out.write_text("window.FCG_%s = " % week + body + ";\n" + loader,
                   encoding="utf-8")
    dur_path.write_text(json.dumps(durations, ensure_ascii=False, indent=2), encoding="utf-8")
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    # weeks.js: add the week once, keep the current default unless asked
    wp = TAG_DATA / "weeks.js"
    wt = wp.read_text(encoding="utf-8")
    weeks_obj = json.loads(wt[wt.find("=") + 1:].strip().rstrip(";"))
    if not any(x["id"] == week for x in weeks_obj["weeks"]):
        weeks_obj["weeks"].insert(0, {
            "id": week, "short": "%s - %s" % (week, w["topic"]),
            "label": "%s - %s (current)" % (week, w["topic"]),
            "topic": w["topic"], "file": "%s-data.js" % week.lower()})
    if args.set_default:
        weeks_obj["defaultWeek"] = week
    wp.write_text("window.FCG_WEEKS = " + json.dumps(weeks_obj, ensure_ascii=False, indent=2) + ";\n",
                  encoding="utf-8")

    # index.html: load the week data file once
    ip = REPO / "tagging" / "index.html"
    it = ip.read_text(encoding="utf-8")
    tag = "data/%s-data.js" % week.lower()
    if tag not in it:
        m = re.search(r'(<script src="data/[^"]+")', it)
        ver = re.search(r"\?v=([^\"]+)", m.group(1)) if m else None
        q = "?v=" + (ver.group(1) if ver else "20261126-flow")
        anchor = '<script src="assets/core.js"'
        it = it.replace(anchor, '<script src="%s%s"></script>\n' % (tag, q) + anchor)
        ip.write_text(it, encoding="utf-8")
    print("wrote tagging/data/%s-data.js (%d clips)" % (week.lower(), len(clips)))


# --------------------------------------------------------------------------
# clean / restore: rejected takes out of CURRENT (reversible)
# --------------------------------------------------------------------------
def cmd_clean(cfg, week, args, restore=False):
    w = resolve_week(cfg, week)
    rows = read_board(cfg, w)
    root = Path(cfg["source_root"])
    qdir = root / "_rejected" / week
    cur = root / "CURRENT"
    teams = cfg["teams"]
    todo = []
    for b, d in rejected(rows):
        tm = teams.get(b["team"])
        if not tm:
            continue
        name = "%s-%s.mp4" % (tm["stem"], d["drill"])
        todo.append((name, b["team"], d["drill"], cur / name, qdir / name))
    if not todo:
        print("no Redo takes - nothing to do")
        return
    qdir.mkdir(parents=True, exist_ok=True)
    log = qdir / "restore-log.txt"
    print("QUARANTINE %s -> %s" % (cur, qdir))
    for name, team, drill, src, dst in todo:
        if restore:
            if not dst.exists():
                print("  SKIP (quarantine missing) %s" % name); continue
            if src.exists():
                print("  SKIP (already in CURRENT) %s" % name); continue
            os.link(str(dst), str(src))
            print("  RESTORED %s" % name)
            continue
        if not src.exists():
            print("  SKIP (not in CURRENT) %s" % name); continue
        # Back up first: an extra hardlink keeps the bytes safe at zero copy cost.
        if not dst.exists():
            os.link(str(src), str(dst))
        if dst.stat().st_ino != src.stat().st_ino or dst.stat().st_size != src.stat().st_size:
            raise RuntimeError("backup verification failed for %s" % name)
        os.remove(str(src))          # removes only the CURRENT directory entry
        print("  MOVED %-16s %s / %s (backup verified, inode preserved)" %
              (name, team, drill))
    with log.open("a", encoding="utf-8") as f:
        for name, team, drill, src, dst in todo:
            f.write("%s\t%s\t%s\t%s\t%s\n" % (name, team, drill, src, dst))
    print("restore log: %s" % log)
    print("CURRENT now: %d files" % len(list(cur.glob("*.mp4"))))


# --------------------------------------------------------------------------
# queue: TAG Wnn snapshot
# --------------------------------------------------------------------------
def cmd_queue(cfg, week, args):
    w = resolve_week(cfg, week)
    fid = w["file_id"]
    sid = ensure_sheet(fid, w["queue"])
    rows = read_board(cfg, w)
    tagcells = grid(fid, w["tags"], 1, 185, 1, 1, raw=True) if w.get("tags") else {}
    tag_counts = Counter(v.strip() for r in tagcells.values()
                         for v in r.values() if v.strip())
    _, templates = load_existing_data(week)
    id_by_key = {(c.get("team"), c.get("drill")): c["id"] for c in templates.values()}
    teams = cfg["teams"]

    call("clear_range_all", {"file_id": fid, "sheet_id": sid,
                             "start_row": 0, "end_row": 85, "start_col": 0, "end_col": 9})
    call("remove_conditional_format", {"file_id": fid, "sheet_id": sid,
                                       "is_remove_all": True})
    vals = []
    def put(r, c, v, kind="STRING"):
        item = {"row": r, "col": c, "value_type": kind}
        if kind == "NUMBER":
            item["number_value"] = v
        else:
            item["value_base64"] = b64(v)
        vals.append(item)

    statuses, table = [], []
    pass_count = 0
    for i, b in enumerate(rows):
        for k, d in enumerate(b["drills"]):
            r = 2 + i * 4 + k
            stem = teams.get(b["team"], {}).get("stem", b["team"])
            tid = id_by_key.get((b["team"], d["drill"]), "-")
            n = tag_counts.get(tid, 0) if tid != "-" else 0
            if d["status"] == PASS:
                pass_count += 1
            if d["status"] != PASS:
                st = "NVT" if d["status"] == "--" else "WACHT"
            elif tid == "-":
                st = "GEEN CLIP"
            elif n > 0:
                st = "GETAGD"
            else:
                st = "TE TAGGEN"
            statuses.append(st)
            table.append((r, "%s-%s.mp4" % (stem, d["drill"]), b["team"], d["drill"],
                          d["day"], d["time"], d["status"], tid, n, st))

    for c, txt in enumerate(["FCG", "%s - TAG WACHTRIJ" % week, "BRON: VIDEO + TAGS",
                             "PASS", "", "/ 36", "TAGS", "", "regels"]):
        put(0, c, txt)
    put(0, 4, pass_count, "NUMBER")
    put(0, 7, sum(tag_counts.values()), "NUMBER")
    for c, txt in enumerate(["Clip", "Team", "Onderdeel", "Dag", "Tijd",
                             "Bord", "Tag-ID", "Tag-regels", "Status"]):
        put(1, c, txt)
    for r, clip, team, drill, day, tim, bord, tid, n, st in table:
        put(r, 0, clip); put(r, 1, team); put(r, 2, drill)
        put(r, 3, day); put(r, 4, tim); put(r, 5, bord)
        put(r, 6, tid); put(r, 7, n, "NUMBER"); put(r, 8, st)
    cnt = Counter(statuses)
    for c, txt in enumerate(["TE TAGGEN", "", "GETAGD", "", "WACHT", "", "NVT", "", ""]):
        put(50, c, txt)
    for c, v in [(1, cnt["TE TAGGEN"]), (3, cnt["GETAGD"]),
                 (5, cnt["WACHT"]), (7, cnt["NVT"])]:
        put(50, c, v, "NUMBER")
    put(50, 8, "GEEN CLIP %d" % cnt["GEEN CLIP"])
    for c, txt in enumerate(["BRON", "Video (momentopname)", "Tags (geteld)",
                             "%s-data.js" % week.lower(), "vandaag",
                             "NOG TE FILMEN", "zie Video", "Redo = geen tag",
                             "D3 = -- (nvt)"]):
        put(51, c, txt)
    for i in range(0, len(vals), 80):
        call("set_range_value", {"file_id": fid, "sheet_id": sid,
                                 "values": vals[i:i + 80]})

    def sty(r0, r1, c0, c1, **kw):
        a = {"file_id": fid, "sheet_id": sid, "start_row": r0, "end_row": r1,
             "start_col": c0, "end_col": c1}
        a.update(kw)
        return call("set_cell_style", a)
    sty(0, 0, 0, 8, bg_color="FF1B3556", font_color="FFFFFFFF", bold=True,
        font_size=12, vertical_align="center")
    sty(1, 1, 0, 8, bg_color="FF2C4C76", font_color="FFFFFFFF", bold=True,
        font_size=10, vertical_align="center", wrap_text=True, horizontal_align="center")
    for r in range(2, 50):
        sty(r, r, 0, 8, bg_color="FFFFFFFF" if r % 2 == 0 else "FFF6F9FC",
            font_color="FF22354A", font_size=10, vertical_align="center")
        sty(r, r, 2, 5, horizontal_align="center")
        sty(r, r, 7, 8, horizontal_align="center", bold=True)
    sty(2, 49, 3, 4, number_format_pattern="@")
    sty(50, 51, 0, 8, bg_color="FFE7EDF3", font_color="FF5B6B7F",
        font_size=9, vertical_align="center")
    sty(50, 50, 0, 8, bold=True)
    call("set_border", {"file_id": fid, "sheet_id": sid, "start_row": 1,
                        "end_row": 50, "start_col": 0, "end_col": 8,
                        "border_positions": ["BORDER_POS_INNER_VERTICAL",
                                             "BORDER_POS_INNER_HORIZONTAL"],
                        "border_style": "BORDER_STYLE_THIN",
                        "border_color": "D8E0EA"})
    call("set_dimension_size", {"file_id": fid, "sheet_id": sid, "dimensions": [
        {"dimension_type": "col", "index": 0, "size": 145},
        {"dimension_type": "col", "index": 1, "size": 85},
        {"dimension_type": "col", "index": 2, "size": 85},
        {"dimension_type": "col", "index": 3, "size": 62},
        {"dimension_type": "col", "index": 4, "size": 72},
        {"dimension_type": "col", "index": 5, "size": 85},
        {"dimension_type": "col", "index": 6, "size": 250},
        {"dimension_type": "col", "index": 7, "size": 100},
        {"dimension_type": "col", "index": 8, "size": 130},
        {"dimension_type": "row", "index": 0, "size": 34},
        {"dimension_type": "row", "index": 1, "size": 30},
        {"dimension_type": "row", "start_index": 2, "end_index": 49, "size": 25},
        {"dimension_type": "row", "start_index": 50, "end_index": 51, "size": 27},
    ]})
    call("set_freeze", {"file_id": fid, "sheet_id": sid,
                        "row_count": 2, "col_count": 2})

    def cf(rng, pairs):
        for val, color in pairs:
            call("add_conditional_format", {
                "file_id": fid, "sheet_id": sid, "ranges": [rng],
                "rule": {"type": "CF_CELL_IS",
                         "cell_is": {"operator": "EQ", "formulas": ['"%s"' % val]},
                         "style": {"bg_color": color}}})
    cf("F3:F50", [("Pass", "#D8F0DC"), ("Redo", "#FBD9D5"),
                  ("Pending", "#FFF0C2"), ("--", "#F1F4F8")])
    cf("I3:I50", [("TE TAGGEN", "#FFF0C2"), ("GETAGD", "#D8F0DC"),
                  ("WACHT", "#FBD9D5"), ("NVT", "#F1F4F8"),
                  ("GEEN CLIP", "#FCE4D6")])
    print("QUEUE %s | %s | PASS %d/36 | %s" %
          (sid, w["queue"], pass_count, dict(cnt)))


# --------------------------------------------------------------------------
# report: compact week tab with live CHAR(10) formulas
# --------------------------------------------------------------------------
def cmd_report(cfg, week, args):
    w = resolve_week(cfg, week)
    rid = cfg["report_file_id"]
    detail = w.get("report_detail")
    if not detail:
        raise RuntimeError("No detail tab for %s in the report workbook" % week)
    name = args.compact_name or w.get("report_compact") or "%s-%s-NEW" % (w["topic"], week)
    sid = ensure_sheet(rid, name)
    detail_sid = sheet_by_name(rid, detail)
    if not detail_sid:
        raise RuntimeError("Detail tab %r not found in report workbook" % detail)
    src = grid(rid, detail_sid, 0, 90, 0, 9, raw=True)
    # first 4-row block per team: activation row (col C) is the anchor
    starts, seen = [], set()
    for r in sorted(src):
        val = src[r].get(2, "").strip().lower()
        team = src[r].get(0, "").strip()
        if val.startswith("activation") and team and team not in seen:
            seen.add(team)
            starts.append((team, r + 1))     # UI row number of ACT row
    if not starts:
        raise RuntimeError("No 4-row blocks found in %s" % detail)
    ref = "'%s'" % detail
    def crit(letter, s):
        return "=" + "&CHAR(10)&".join(
            '"%s: "&%s!$%s$%d' % (lab, ref, letter, s + k)
            for k, lab in enumerate(DRILLS))
    def avg(s):
        parts = []
        for k, lab in enumerate(DRILLS):
            a = "AVERAGE(%s!$D$%d:$G$%d)" % (ref, s + k, s + k)
            parts.append('"%s: "&IF(%s=0,"-",TEXT(%s,"0.0"))' % (lab, a, a))
        return "=" + "&CHAR(10)&".join(parts)
    def remark(s):
        parts = []
        for k, lab in enumerate(DRILLS):
            c = "%s!$H$%d" % (ref, s + k)
            parts.append('"%s: "&IF(%s="","-",%s)' % (lab, c, c))
        return "=" + "&CHAR(10)&".join(parts)

    vals = []
    def put(r, c, v, formula=False, number=False):
        it = {"row": r, "col": c}
        if number:
            it.update(value_type="NUMBER", number_value=v)
        elif formula:
            it.update(value_type="FORMULA", value_base64=b64(v))
        else:
            it.update(value_type="STRING", value_base64=b64(v))
        vals.append(it)
    put(0, 0, "FCG"); put(0, 1, "%s %s - WEEK REPORT" % (week, w["topic"]))
    for c, h in enumerate(["Team", "Coach", "Objective", "Group", "Organization",
                           "Active Learning Time", "Weekly Focus Points",
                           "Inspiration", "Remark", "Rating (avg)"]):
        put(1, c, h)
    board_rows = read_board(cfg, w)
    for i, (team, s) in enumerate(starts):
        r = 2 + i
        b = board_rows[i] if i < len(board_rows) else {"team": team,
                                                       "objective": "", "group": ""}
        put(r, 0, b["team"])
        put(r, 1, src.get(s - 1, {}).get(1, ""))   # coach from detail tab
        put(r, 2, b["objective"])
        put(r, 3, b["group"])
        for j, letter in enumerate("DEFG"):
            put(r, 4 + j, crit(letter, s), formula=True)
        put(r, 8, remark(s), formula=True)
        put(r, 9, avg(s), formula=True)
    put(len(starts) + 2, 8, "I = berekend: CHAR(10) + Remarks (H)")
    put(len(starts) + 2, 9, "J = berekend: CHAR(10) + AVERAGE")
    for i in range(0, len(vals), 60):
        call("set_range_value", {"file_id": rid, "sheet_id": sid,
                                 "values": vals[i:i + 60]})
    print("REPORT %s | %s | %d teams | live formulas from %s" %
          (sid, name, len(starts), detail))


# --------------------------------------------------------------------------
def cmd_status(cfg, week, args):
    w = resolve_week(cfg, week)
    rows = read_board(cfg, w)
    cnt = Counter(d["status"] for _, d in iter_board(rows))
    print("WEEK %s | workbook %s (%s)" % (week, w["title"], w["file_id"]))
    print("  Board %s | Tags %s | queue %s" % (w["board"], w["tags"], w["queue"]))
    print("  Status:", dict(cnt))
    print("  Redo:", ["%s %s" % (b["team"], d["drill"]) for b, d in rejected(rows)])
    print("  Pending:", ["%s %s" % (b["team"], d["drill"])
                         for b, d in iter_board(rows) if d["status"] == "Pending"])
    cur = Path(cfg["source_root"]) / "CURRENT"
    print("  CURRENT mp4:", len(list(cur.glob("*.mp4"))))
    _, templates = load_existing_data(week)
    print("  tagging/data/%s-data.js clips: %d" % (week.lower(), len(templates)))
    print("  report detail: %s | compact: %s" %
          (w.get("report_detail"), w.get("report_compact")))


def main():
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["weeks", "status", "focus", "data",
                                        "clean", "restore", "queue", "report", "all"])
    ap.add_argument("--week", default="W13")
    ap.add_argument("--topic", help="override topic, e.g. D2 (for a new week)")
    ap.add_argument("--topic-file", help="tools/data/<topic>-data.json")
    ap.add_argument("--compact-name", help="report: override the compact tab name")
    ap.add_argument("--set-default", action="store_true",
                    help="make this week the tagging app default")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if args.week not in cfg["weeks"]:
        raise SystemExit("Unknown week %s (config has %s)" %
                         (args.week, ", ".join(cfg["weeks"])))
    if args.topic:
        cfg["weeks"][args.week]["topic"] = args.topic
        cfg["weeks"][args.week]["topic_code"] = args.topic + "F"
    def dispatch():
        if args.command == "weeks":
            print("%-5s %-9s %-16s %-7s %s" % ("WEEK", "STATE", "WORKBOOK", "TOPIC", "READY"))
            for k, v in cfg["weeks"].items():
                print("%-5s %-9s %-16s %-7s %s" %
                      (k, v["state"], v["title"], v.get("topic") or "-",
                       "yes" if v.get("file_id") else "needs workbook + --topic"))
            return
        if args.command == "status":
            cmd_status(cfg, args.week, args)
        elif args.command == "focus":
            cmd_focus(cfg, args.week, args)
        elif args.command == "data":
            cmd_data(cfg, args.week, args)
        elif args.command in ("clean", "restore"):
            cmd_clean(cfg, args.week, args, restore=(args.command == "restore"))
        elif args.command == "queue":
            cmd_queue(cfg, args.week, args)
        elif args.command == "report":
            cmd_report(cfg, args.week, args)
        elif args.command == "all":
            cmd_focus(cfg, args.week, args)
            cmd_data(cfg, args.week, args)
            if not args.dry_run:
                cmd_clean(cfg, args.week, args)
                cmd_queue(cfg, args.week, args)

    try:
        dispatch()
    except RuntimeError as exc:
        print("ERROR: %s" % exc)
        if "not found yet" in str(exc):
            print("SETUP: duplicate the previous week workbook in Tencent Docs, name it exactly")
            print("       %s, then run with --topic <A/D code> --topic-file <file>.json" %
                  cfg["weeks"][args.week]["title"])
        sys.exit(1)


if __name__ == "__main__":
    main()
