#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Upload Track 3 tagged moments + the week overview to Weiyun.

Track 3 player footage is deliberately NOT published on GitHub Pages. The
Drillbox cuts (website) and these Weiyun clips are two different outputs.

Input : tools/data/wNN-weiyun-staging.json  (event_id/overview -> local mp4)
        CODEBUDDY_MCP_CONFIG                (local connector-proxy credentials)
Output: tools/data/wNN-weiyun-links.json    (share URLs used by the weekfile)

Example:
  python tools/upload_moments_weiyun.py --week W13 --dir-key <hex key>
"""
import argparse
import glob
import json
import os
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
TOOLS_DATA = REPO / "tools" / "data"


def connector():
    cfg = json.loads(os.environ["CODEBUDDY_MCP_CONFIG"])["mcpServers"]["tencent-weiyun"]
    headers = dict(cfg["headers"])
    headers["Content-Type"] = "application/json"
    return cfg["url"], headers


def weiyun_sdk():
    pat = (r"C:\Users\munni\.workbuddy\plugins\cache\workbuddy-connector-plugins-official"
           r"\tencent-weiyun\*\skills\weiyun\scripts")
    cands = [p for p in glob.glob(pat) if (Path(p) / "upload_to_weiyun.py").exists()]
    if not cands:
        raise RuntimeError("Weiyun upload SDK not found: " + pat)
    sys.path.insert(0, max(cands))
    import upload_to_weiyun as u
    return u


def list_files(u, url, headers, dir_key):
    out = {}
    offset = 0
    while True:
        r = u.mcp_call(url, headers, "weiyun.list",
                       {"limit": 50, "get_type": 2, "offset": offset,
                        "dir_key": dir_key})
        for f in r.get("file_list") or []:
            out[f["filename"]] = {"file_id": f["file_id"],
                                  "size": int(f.get("file_size", 0))}
        if r.get("finish_flag", True) or not r.get("file_list"):
            break
        offset += 50
    return out


def share(u, url, headers, dir_key, file_id, name):
    r = u.mcp_call(url, headers, "weiyun.gen_share_link",
                   {"file_list": [{"file_id": file_id, "pdir_key": dir_key}],
                    "share_name": name})
    if r.get("error"):
        raise RuntimeError("share failed for %s: %s" % (name, r["error"]))
    return r.get("short_url", "")


def ensure_week_folder(u, url, headers, parent_dir_key, week):
    """Find or create <topic>/<WEEK> in Weiyun. Returns (dir_key, parent_key)."""
    if not parent_dir_key:
        raise RuntimeError("--parent-dir-key is required when --dir-key is omitted")
    r = u.mcp_call(url, headers, "weiyun.list",
                   {"limit": 50, "get_type": 0, "dir_key": parent_dir_key})
    for d in r.get("dir_list") or []:
        if d.get("dir_name") == week:
            return d["dir_key"], parent_dir_key
    r = u.mcp_call(url, headers, "weiyun.create_dir",
                   {"pdir_key": parent_dir_key, "dir_name": week})
    if r.get("error") or not r.get("dir_key"):
        raise RuntimeError("create_dir failed: %s" % json.dumps(r, ensure_ascii=False))
    return r["dir_key"], parent_dir_key


def share_folder(u, url, headers, dir_key, parent_dir_key, name):
    """gen_share_link needs the PARENT's dir_key as pdir_key, not the child's."""
    r = u.mcp_call(url, headers, "weiyun.gen_share_link",
                   {"dir_list": [{"dir_key": dir_key, "pdir_key": parent_dir_key}],
                    "share_name": name})
    if r.get("error"):
        raise RuntimeError("folder share failed: %s" % r["error"])
    return r.get("short_url", "")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--week", default="W13")
    ap.add_argument("--dir-key", default="", help="Weiyun target folder dir_key")
    ap.add_argument("--parent-dir-key", default="",
                    help="topic folder dir_key; used to find/create <WEEK> and to share the folder")
    ap.add_argument("--staging", default="")
    ap.add_argument("--out", default="")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    wk = args.week.upper()
    staging_path = Path(args.staging) if args.staging else TOOLS_DATA / ("%s-weiyun-staging.json" % wk.lower())
    out_path = Path(args.out) if args.out else TOOLS_DATA / ("%s-weiyun-links.json" % wk.lower())
    staged = json.loads(staging_path.read_text(encoding="utf-8"))
    url, headers = connector()
    u = weiyun_sdk()

    old = json.loads(out_path.read_text(encoding="utf-8")) if out_path.exists() else {}
    dir_key = args.dir_key or old.get("dir_key", "")
    parent_key = args.parent_dir_key or old.get("parent_dir_key", "")
    if not dir_key:
        dir_key, parent_key = ensure_week_folder(u, url, headers, parent_key, wk)
    if args.dry_run and not dir_key:
        print("  (week folder would be created under %s)" % parent_key)
    existing = list_files(u, url, headers, dir_key) if dir_key else {}
    links = {"week": wk, "dir_key": dir_key, "parent_dir_key": parent_key,
             "folder_share_url": old.get("folder_share_url", ""),
             "files": {}, "overview": {}}

    print("WEEK %s | %d files -> Weiyun folder %s" % (wk, len(staged), dir_key))
    for key, path in staged.items():
        p = Path(path)
        if not p.exists():
            raise RuntimeError("Staged file missing: %s" % p)
        name, size = p.name, p.stat().st_size
        found = existing.get(name)
        if args.dry_run:
            print("  %-42s %8d B  %s" % (name, size, "exists" if found else "UPLOAD"))
            continue
        if not found or found["size"] != size:
            print("  uploading %s (%.1f MB)" % (name, size / 1048576))
            u.upload_file(str(p), url, headers, pdir_key=dir_key)
            existing = list_files(u, url, headers, dir_key)
            found = existing.get(name)
            if not found:
                raise RuntimeError("Upload finished but %s is not in the folder" % name)
        file_id = found["file_id"]
        prior = (old.get("overview") or {}) if key == "overview" else \
            (old.get("files", {}).get(key) or {})
        if prior.get("file_id") == file_id and prior.get("share_url"):
            link = prior["share_url"]
        else:
            link = share(u, url, headers, dir_key, file_id, name)
        rec = {"filename": name, "file_id": file_id, "size": size,
               "share_url": link, "local": str(p)}
        if key == "overview":
            links["overview"] = rec
        else:
            links["files"][key] = rec
        print("  %-42s -> %s" % (name, link))

    if not args.dry_run:
        if not links["folder_share_url"] and parent_key:
            links["folder_share_url"] = share_folder(
                u, url, headers, dir_key, parent_key,
                "FCG %s · Track 3 moments" % wk)
        out_path.write_text(json.dumps(links, indent=2, ensure_ascii=False) + "\n",
                            encoding="utf-8")
        print("folder share: %s" % links["folder_share_url"])
        print("links -> %s" % out_path)


if __name__ == "__main__":
    main()
