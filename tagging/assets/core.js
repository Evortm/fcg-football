/* Tagging UI trial — pure logic shared by the app and the test harness.
   No DOM, no storage: everything here is deterministic and testable. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FCG = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var RATINGS = ["Demonstrated", "Needs improvement", "Cannot assess"];
  var CONFIRMATIONS = ["Draft", "Confirmed"];
  var UNKNOWN = "UNKNOWN";
  var COMMENT_MAX = 500;

  /* Where the tagged player stands IN THE FRAME at t_start. Stored inside the
     comment as #pos=x,y (normalised 0-1) so the 18-column A-R Tags paste is
     unchanged: columns S/T/U of the weekfile already hold the Weiyun /
     Drillbox / overview links. The offline publisher reads the mark and burns
     a ring at that coordinate into the Track 3 clip. Optional: old tags work
     exactly as before. */
  var POS_MARK = "#pos=";
  var POS_RE = /(^|\s)#pos=(\d*\.?\d+),(\d*\.?\d+)(?=\s|$)/i;
  var ANY_POS_RE = /\s*#pos=\S+/gi;
  var ANY_DRILLBOX_RE = /\s*#drillbox\b/gi;

  /* One generic observations column: "SM=Demonstrated; DC=Needs improvement; ..."
     Codes come from the clip's focus points, so any clip fits the register. */
  var EVENT_HEADERS = [
    "event_id", "video_id", "player_id", "player_display", "player_known",
    "t_start", "t_end", "t_start_sec", "t_end_sec",
    "source_start", "source_end", "source_segment",
    "observations", "comment", "reviewer", "confirmation", "created_at", "updated_at"
  ];

  var LEGACY_FIELDS = {
    shooting_motion: "SM", direction_change: "DC",
    acceleration: "AC", ball_control: "BC"
  };

  /* Sanitized trial: no legacy real clip IDs are carried over. */
  var LEGACY_CLIP_IDS = {};

  function round3(n) {
    return Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;
  }

  function pad(n, width) {
    return String(Math.floor(n)).padStart(width, "0");
  }

  /* mm:ss.mmm, or h:mm:ss.mmm past an hour. */
  function fmtTime(seconds) {
    var s = Math.max(0, Number(seconds) || 0);
    var hours = Math.floor(s / 3600);
    var minutes = Math.floor((s % 3600) / 60);
    var secs = Math.floor(s % 60);
    var ms = Math.round((s - Math.floor(s)) * 1000);
    if (ms === 1000) { ms = 0; secs += 1; }
    if (secs === 60) { secs = 0; minutes += 1; }
    if (minutes === 60) { minutes = 0; hours += 1; }
    var body = pad(minutes, 2) + ":" + pad(secs, 2) + "." + pad(ms, 3);
    return hours > 0 ? hours + ":" + body : body;
  }

  /* 24h clock from seconds since midnight: 17:24:20.120 */
  function fmtClock(secondsOfDay) {
    var s = ((Number(secondsOfDay) || 0) % 86400 + 86400) % 86400;
    var hours = Math.floor(s / 3600);
    var minutes = Math.floor((s % 3600) / 60);
    var secs = Math.floor(s % 60);
    var ms = Math.round((s - Math.floor(s)) * 1000);
    if (ms === 1000) { ms = 0; secs += 1; }
    if (secs === 60) { secs = 0; minutes += 1; }
    if (minutes === 60) { minutes = 0; hours = (hours + 1) % 24; }
    return pad(hours, 2) + ":" + pad(minutes, 2) + ":" + pad(secs, 2) + "." + pad(ms, 3);
  }

  /* Accepts "mm:ss.mmm", "h:mm:ss", or a plain number of seconds. */
  function parseTime(value) {
    if (typeof value === "number") return round3(value);
    var text = String(value == null ? "" : value).trim();
    if (!text) return NaN;
    if (/^\d+(\.\d+)?$/.test(text)) return round3(text);
    var parts = text.split(":");
    if (parts.length < 2 || parts.length > 3) return NaN;
    var total = 0;
    for (var i = 0; i < parts.length; i += 1) {
      var piece = Number(parts[i]);
      if (!isFinite(piece) || piece < 0) return NaN;
      total = total * 60 + piece;
    }
    return round3(total);
  }

  /* Which recording a clip position falls in. */
  function segmentAt(segments, fileTime) {
    if (!segments || !segments.length) return null;
    var t = Number(fileTime) || 0;
    for (var i = 0; i < segments.length; i += 1) {
      if (t < segments[i].file_end || i === segments.length - 1) return segments[i];
    }
    return segments[segments.length - 1];
  }

  /* Camera-clock time for a clip position, or null when the clip has no
     burned-in clock (most D6 clips are registered without one). */
  function sourceAt(segments, fileTime) {
    var seg = segmentAt(segments, fileTime);
    if (!seg) return null;
    if (seg.source_start == null) return null;
    return round3(Number(seg.source_start) + (Number(fileTime) - Number(seg.file_start)));
  }

  function hasClock(segments) {
    return (segments || []).every(function (seg) { return seg.source_start != null; });
  }

  function crossesCut(start, end, segments) {
    var a = segmentAt(segments, start);
    var b = segmentAt(segments, end);
    if (!a || !b) return false;
    if (a.index === b.index) return false;
    /* end exactly on a cut belongs to the earlier recording */
    return Math.abs(Number(end) - Number(a.file_end)) > 0.001;
  }

  function eventId(prefix, seq) {
    return "EVT-" + prefix + "-" + pad(seq, 4);
  }

  function nextSeq(events) {
    var max = 0;
    (events || []).forEach(function (ev) {
      var m = /-(\d+)$/.exec(String(ev.event_id || ""));
      if (m) max = Math.max(max, Number(m[1]));
    });
    return max + 1;
  }

  /* Older saves stored the four fake-shot values as flat fields; move them
     into observations so every event has the same shape. */
  function migrateEvent(ev) {
    if (ev.observations) return ev;
    var obs = {};
    var focus = [];
    Object.keys(LEGACY_FIELDS).forEach(function (key) {
      if (ev[key]) {
        obs[LEGACY_FIELDS[key]] = ev[key];
        focus.push(LEGACY_FIELDS[key]);
        delete ev[key];
      }
    });
    ev.observations = obs;
    ev.focus = ev.focus || focus;
    return ev;
  }

  function normalizeStore(raw) {
    var src = raw && typeof raw === "object" ? raw : {};
    var events = Array.isArray(src.events) ? src.events.filter(function (ev) {
      return ev && typeof ev === "object" && ev.event_id;
    }).map(migrateEvent) : [];
    /* Clip IDs that changed after registration: keep the tags attached. */
    events.forEach(function (ev) {
      if (LEGACY_CLIP_IDS[ev.video_id]) ev.video_id = LEGACY_CLIP_IDS[ev.video_id];
    });
    var seqs = {};
    if (src.seqs && typeof src.seqs === "object") {
      Object.keys(src.seqs).forEach(function (k) {
        seqs[LEGACY_CLIP_IDS[k] || k] = Number(src.seqs[k]) || 0;
      });
    }
    var activeClip = typeof src.activeClip === "string" ? src.activeClip : "";
    /* Rebuild per-clip sequences from the events themselves. */
    events.forEach(function (ev) {
      var m = /-(\d+)$/.exec(String(ev.event_id || ""));
      if (ev.video_id && m) seqs[ev.video_id] = Math.max(seqs[ev.video_id] || 0, Number(m[1]));
    });
    return {
      version: 1,
      reviewer: typeof src.reviewer === "string" ? src.reviewer : "",
      activeClip: LEGACY_CLIP_IDS[activeClip] || activeClip,
      seqs: seqs,
      events: events
    };
  }

  function buildEvent(input) {
    var now = new Date().toISOString();
    var obs = {};
    var focus = Array.isArray(input.focus) ? input.focus.slice() : Object.keys(input.observations || {});
    focus.forEach(function (code) { obs[code] = input.observations[code] || ""; });
    return {
      event_id: input.event_id || "",
      video_id: input.video_id,
      player_id: input.player_id,
      player_display: input.player_display,
      player_known: input.player_id !== UNKNOWN,
      t_start: round3(input.t_start),
      t_end: round3(input.t_end),
      source_start: input.source_start || "",
      source_end: input.source_end || "",
      source_segment: Number(input.source_segment) || 0,
      focus: focus,
      observations: obs,
      comment: String(input.comment || "").trim(),
      reviewer: String(input.reviewer || "").trim(),
      confirmation: CONFIRMATIONS.indexOf(input.confirmation) >= 0 ? input.confirmation : "Draft",
      created_at: input.created_at || now,
      updated_at: now
    };
  }

  function validateEvent(ev, duration, focus) {
    var errors = [];
    var codes = (focus && focus.length ? focus : ev.focus || Object.keys(ev.observations || {}));
    if (!ev.player_id) errors.push("Select a player (or Unknown player).");
    if (!ev.reviewer || ev.reviewer.length < 2) errors.push("Reviewer name is required.");
    codes.forEach(function (code) {
      if (RATINGS.indexOf((ev.observations || {})[code]) < 0) {
        errors.push("Rate every focus point (use Cannot assess where needed).");
      }
    });
    if (!isFinite(ev.t_start) || !isFinite(ev.t_end)) {
      errors.push("Set both a start and an end marker.");
    } else {
      if (ev.t_start < 0) errors.push("Start marker is before the clip.");
      if (ev.t_end <= ev.t_start + 0.04) errors.push("End marker must come after the start marker.");
      if (isFinite(duration) && duration > 0 && ev.t_end > duration + 0.05) {
        errors.push("End marker is past the end of the clip.");
      }
    }
    if (ev.comment.length > COMMENT_MAX) errors.push("Comment is longer than " + COMMENT_MAX + " characters.");
    return errors;
  }

  /* Replay always uses the clip position, so a combined clip stays exact. */
  function replayTarget(ev) {
    return Math.max(0, round3(Number(ev.t_start) || 0));
  }

  function csvCell(value) {
    var text = value == null ? "" : String(value);
    return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function encodeObservations(ev) {
    var codes = (ev.focus && ev.focus.length ? ev.focus : Object.keys(ev.observations || {}));
    return codes.map(function (code) {
      return code + "=" + (ev.observations[code] || "");
    }).join("; ");
  }

  /* ---------------------------------------------------- inline tag marks
     #drillbox and #pos=... both live in `comment`. One helper owns both so a
     long coach note can never be truncated in a way that drops a mark. */
  function decodePos(comment) {
    var m = POS_RE.exec(String(comment || ""));
    if (!m) return null;
    var x = Number(m[2]), y = Number(m[3]);
    if (!isFinite(x) || !isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x: round3(x), y: round3(y) };
  }

  function stripMarks(comment) {
    return String(comment || "").replace(ANY_POS_RE, "")
      .replace(ANY_DRILLBOX_RE, "").trim();
  }

  function withMarks(comment, drillbox, pos) {
    var base = stripMarks(comment);
    var suffix = (drillbox ? " #drillbox" : "") +
      (pos ? " " + POS_MARK + round3(pos.x).toFixed(3) + "," +
             round3(pos.y).toFixed(3) : "");
    if (base.length + suffix.length > COMMENT_MAX) {
      base = base.slice(0, Math.max(0, COMMENT_MAX - suffix.length)).trim();
    }
    return (base + suffix).trim();
  }

  function eventRow(ev) {
    return [
      ev.event_id, ev.video_id, ev.player_id, ev.player_display,
      ev.player_known ? "TRUE" : "FALSE",
      fmtTime(ev.t_start), fmtTime(ev.t_end),
      Number(ev.t_start).toFixed(3), Number(ev.t_end).toFixed(3),
      ev.source_start, ev.source_end, ev.source_segment,
      encodeObservations(ev),
      ev.comment, ev.reviewer, ev.confirmation, ev.created_at, ev.updated_at
    ];
  }

  function toCsv(events, delimiter) {
    var sep = delimiter || ",";
    var lines = [EVENT_HEADERS.join(sep)];
    (events || []).forEach(function (ev) {
      lines.push(eventRow(ev).map(csvCell).join(sep));
    });
    return lines.join("\r\n");
  }

  function mergeEvents(current, incoming) {
    var byId = {};
    (current || []).forEach(function (ev) { byId[ev.event_id] = ev; });
    (incoming || []).forEach(function (ev) {
      var existing = byId[ev.event_id];
      if (!existing || String(ev.updated_at || "") >= String(existing.updated_at || "")) {
        byId[ev.event_id] = ev;
      }
    });
    return Object.keys(byId).map(function (k) { return byId[k]; }).sort(function (a, b) {
      return String(b.event_id).localeCompare(String(a.event_id));
    });
  }

  return {
    RATINGS: RATINGS,
    CONFIRMATIONS: CONFIRMATIONS,
    UNKNOWN: UNKNOWN,
    COMMENT_MAX: COMMENT_MAX,
    POS_MARK: POS_MARK,
    EVENT_HEADERS: EVENT_HEADERS,
    decodePos: decodePos,
    stripMarks: stripMarks,
    withMarks: withMarks,
    fmtTime: fmtTime,
    fmtClock: fmtClock,
    parseTime: parseTime,
    round3: round3,
    segmentAt: segmentAt,
    sourceAt: sourceAt,
    hasClock: hasClock,
    crossesCut: crossesCut,
    eventId: eventId,
    nextSeq: nextSeq,
    normalizeStore: normalizeStore,
    encodeObservations: encodeObservations,
    buildEvent: buildEvent,
    validateEvent: validateEvent,
    replayTarget: replayTarget,
    eventRow: eventRow,
    toCsv: toCsv,
    mergeEvents: mergeEvents
  };
});
