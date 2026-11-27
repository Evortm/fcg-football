(function () {
  "use strict";

  var C = window.FCG;
  var DATA = window.PILOT;
  /* Canonical reviewer names + the Drillbox minimum live here so the timer,
     the save guard and the dropdown can never disagree about "20 seconds". */
  var REVIEWERS = window.FCG_REVIEWERS || [];
  var REVIEWER_ALIASES = window.FCG_REVIEWER_ALIASES || {};
  var DRILLBOX_MIN_SECONDS = C.DRILLBOX_MIN_SECONDS;
  var WEEKS = window.FCG_WEEKS || {
    defaultWeek: "W11",
    weeks: [{ id: "W11", short: "W11 · A7", label: "W11 · A7 (pilot)", topic: "A7" }]
  };
  function urlWeek() {
    var raw = "";
    try { raw = new URLSearchParams(location.search).get("week") || ""; } catch (err) {}
    return String(raw || WEEKS.defaultWeek || "W11").toUpperCase();
  }
  var WEEK_ID = urlWeek();
  /* If a week's data file did not load, stay on the pilot set instead of
     showing W13 labels over W11 clips. */
  if (WEEK_ID !== "W11" && (!DATA.week || DATA.week !== WEEK_ID)) WEEK_ID = "W11";
  var WEEK_META = WEEKS.weeks.filter(function (w) { return w.id === WEEK_ID; })[0]
    || { id: WEEK_ID, short: WEEK_ID, label: WEEK_ID, topic: DATA.topic || "" };
  var V = DATA.clips[0]; /* the active clip; reassigned by the clip selector */
  /* One hosted site can serve every coach: ?coach=NK gives each coach their
     own event-ID prefix and their own browser storage. Offline bundles bake the
     code into pilot-data.js instead. No code at all = master screen. */
  function coachCode() {
    var fromUrl = "";
    try {
      fromUrl = new URLSearchParams(location.search).get("coach") || "";
    } catch (err) { /* file:// or old browser */ }
    var code = String(fromUrl || DATA.coachCode || "").toUpperCase()
      .replace(/[^A-Z0-9]/g, "").slice(0, 6);
    return code;
  }

  /* W11 keeps its original key so tags already on coaches' devices survive.
     Later weeks get their own store: switching weeks never mixes tag sets. */
  var STORE_KEY = "fcg.tagging.sanitized.v1"
    + (coachCode() ? "." + coachCode() : "")
    + (WEEK_ID === "W11" ? "" : "." + WEEK_ID.toLowerCase());
  /* One-step undo for Clear: a snapshot of the store taken just before the
     wipe. Scoped to this week + coach, exactly like the live store. */
  var CLEAR_BACKUP_KEY = STORE_KEY + ".beforeClear";

  function eventPrefix() {
    return V.prefix + (coachCode() ? "-" + coachCode() : "");
  }

  function fileTag() {
    var name = String(store.reviewer || "").trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return (name || coachCode().toLowerCase() || "coach") + "-" + today();
  }

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var el = {
    video: $("#video"),
    fallback: $("#videoFallback"),
    curTime: $("#curTime"),
    durTime: $("#durTime"),
    sourceNow: $("#sourceNow"),
    recLabel: $("#recLabel"),
    clipNote: $("#clipNote"),
    timeline: $("#timeline"),
    tlRegion: $("#tlRegion"),
    tlStart: $("#tlStart"),
    tlEnd: $("#tlEnd"),
    tlHead: $("#tlHead"),
    ticks: $("#ticks"),
    playBtn: $("#playBtn"),
    frameBack: $("#frameBack"),
    frameFwd: $("#frameFwd"),
    speed: $("#speed"),
    setStart: $("#setStart"),
    setEnd: $("#setEnd"),
    segStart: $("#segStart"),
    segEnd: $("#segEnd"),
    segStartSource: $("#segStartSource"),
    segEndSource: $("#segEndSource"),
    segLen: $("#segLen"),
    reviewer: $("#reviewer"),
    reviewerOther: $("#reviewerOther"),
    segTimer: $("#segTimer"),
    timerValue: $("#timerValue"),
    timerHint: $("#timerHint"),
    timerFill: $("#timerFill"),
    playerSearch: $("#playerSearch"),
    playerList: $("#playerList"),
    clearPlayer: $("#clearPlayer"),
    playerHint: $("#playerHint"),
    obs: $("#obs"),
    fillRest: $("#fillRest"),
    comment: $("#comment"),
    commentCount: $("#commentCount"),
    confirm: $(".confirm"),
    tagForm: $("#tagForm"),
    modeSwitch: $("#modeSwitch"),
    drillboxNote: $("#drillboxNote"),
    drillboxLen: $("#drillboxLen"),
    saveBtn: $("#saveBtn"),
    sameTimeBtn: $("#sameTimeBtn"),
    clearBtn: $("#clearForm"),
    deleteBtn: $("#deleteBtn"),
    formTitle: $("#formTitle"),
    modeBadge: $("#modeBadge"),
    formError: $("#formError"),
    eventBody: $("#eventBody"),
    eventCount: $("#eventCount"),
    emptyState: $("#emptyState"),
    filter: $("#filter"),
    verifyAll: $("#verifyAll"),
    clearTagsBtn: $("#clearTags"),
    clearPanel: $("#clearPanel"),
    clearWeekName: $("#clearWeekName"),
    clearScopeWeek: $("#clearScopeWeek"),
    clearWeekCount: $("#clearWeekCount"),
    clearClipCount: $("#clearClipCount"),
    clearConfirm: $("#clearConfirm"),
    clearBackup: $("#clearBackup"),
    clearRestore: $("#clearRestore"),
    clearCancel: $("#clearCancel"),
    storeNote: $("#storeNote"),
    toast: $("#toast"),
    exportBtn: $("#exportBtn"),
    exportMenu: $("#exportMenu"),
    importFile: $("#importFile"),
    videoChip: $("#videoChip"),
    chipLegend: $("#chipLegend"),
    clipSelect: $("#clipSelect"),
    weekSelect: $("#weekSelect"),
    clipSubtitle: $("#clipSubtitle"),
    videoIdLabel: $("#videoIdLabel"),
    clipName: $("#clipName"),
    clipDuration: $("#clipDuration"),
    clipOrigin: $("#clipOrigin")
  };

  var ICON = {
    replay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 2.6-6.4"/><path d="M3 4v5h5"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>'
  };

  var state = {
    player: null,
    start: null,
    end: null,
    ratings: {},
    status: "Draft",
    /* mode = which form the coach is using; drillbox = this event carries the
       #drillbox mark (kept separately so legacy nominated player tags survive). */
    mode: "player",
    drillbox: false,
    editing: null,
    replayStop: null,
    duration: V.duration || 0,
    storageOk: true,
    comboIndex: -1,
    comboOptions: [],
    /* Clip id whose hosted fallback copy has already been attempted. */
    remoteTried: null
  };

  var store = loadStore();
  state.mode = store.mode === "drillbox" ? "drillbox" : "player";
  state.drillbox = state.mode === "drillbox";
  var toastTimer = null;

  /* ------------------------------------------------------------ storage */
  function loadStore() {
    var raw = null;
    try { raw = localStorage.getItem(STORE_KEY); } catch (err) { state.storageOk = false; }
    try {
      return C.normalizeStore(raw ? JSON.parse(raw) : null);
    } catch (err) {
      return C.normalizeStore(null);
    }
  }

  function saveStore() {
    store.activeClip = V.id;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
      state.storageOk = true;
    } catch (err) {
      state.storageOk = false;
    }
    renderStoreNote();
  }

  function eventsOfClip(clip) {
    return store.events.filter(function (ev) { return ev.video_id === (clip || V).id; });
  }

  /* ------------------------------------------------------------ helpers */
  function fmt(seconds) { return C.fmtTime(seconds); }

  function clipNow() {
    return C.round3(el.video.currentTime || 0);
  }

  function sourceNow() {
    return C.sourceAt(V.segments, el.video.currentTime || 0);
  }

  function sourceText(fileTime) {
    var value = C.sourceAt(V.segments, fileTime);
    return value == null ? "—" : C.fmtClock(value);
  }

  function clockValue(fileTime) {
    var value = C.sourceAt(V.segments, fileTime);
    return value == null ? "" : C.fmtClock(value);
  }

  function sourceCell(value) {
    return value == null ? "—" : C.fmtClock(value);
  }

  function maxClip() {
    return state.duration || V.duration || 0;
  }

  /* ---------------------------------------------------- reviewer dropdown
     A fixed list keeps "Johan" from becoming "johan" / "Jonah" in the Tags
     tab. "Other name…" stays as a guarded escape hatch for guest reviewers. */
  function canonicalReviewer(name) {
    var n = String(name || "").trim();
    if (!n) return "";
    var hit = REVIEWERS.filter(function (r) {
      return r.toLowerCase() === n.toLowerCase();
    })[0];
    return hit || REVIEWER_ALIASES[n.toLowerCase()] || "";
  }

  function currentReviewer() {
    if (el.reviewer.value === "__other__") return el.reviewerOther.value.trim();
    return canonicalReviewer(el.reviewer.value);
  }

  function syncReviewerField(persist) {
    var other = el.reviewer.value === "__other__";
    el.reviewerOther.hidden = !other;
    if (other && persist) el.reviewerOther.focus();
    if (persist) {
      store.reviewer = currentReviewer();
      saveStore();
    }
  }

  function initReviewer() {
    var sel = el.reviewer;
    $$("option[data-canonical]", sel).forEach(function (o) { o.remove(); });
    var other = sel.querySelector('option[value="__other__"]');
    REVIEWERS.forEach(function (name) {
      var opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      opt.dataset.canonical = "1";
      if (other) sel.insertBefore(opt, other);
      else sel.appendChild(opt);
    });
    var saved = canonicalReviewer(store.reviewer);
    if (saved) {
      sel.value = saved;
    } else if (String(store.reviewer || "").trim()) {
      sel.value = "__other__";
      el.reviewerOther.value = String(store.reviewer).trim();
    } else {
      sel.value = "";
    }
    syncReviewerField(false);
  }

  function segmentOf(fileTime) {
    return C.segmentAt(V.segments, fileTime) || { index: 0 };
  }

  function toast(message, kind) {
    el.toast.textContent = message;
    el.toast.className = "toast show" + (kind ? " " + kind : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.className = "toast"; }, 3800);
  }

  function download(filename, text, type) {
    var blob = new Blob([text], { type: type || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function showError(message) {
    if (!message) { el.formError.hidden = true; el.formError.textContent = ""; return; }
    el.formError.textContent = message;
    el.formError.hidden = false;
  }

  /* ------------------------------------------------------------ focus points */
  function focusPoint(code) {
    return DATA.focusLibrary.filter(function (f) { return f.code === code; })[0]
      || { code: code, label: code, desc: "" };
  }

  function buildObsRows() {
    el.obs.innerHTML = "";
    V.focus.slice(0, 4).forEach(function (code) {
      var fp = focusPoint(code);
      var row = document.createElement("div");
      row.className = "obs-row";
      row.dataset.field = code;

      var name = document.createElement("span");
      name.className = "obs-name";
      name.textContent = fp.desc || fp.label;
      name.title = fp.label;

      var rate = document.createElement("div");
      rate.className = "rate";
      rate.setAttribute("role", "group");
      rate.setAttribute("aria-label", fp.desc || fp.label);
      C.RATINGS.forEach(function (value) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.value = value;
        btn.textContent = value;
        btn.addEventListener("click", function () { setRating(code, value); });
        rate.appendChild(btn);
      });

      row.appendChild(name);
      row.appendChild(rate);
      el.obs.appendChild(row);
    });
  }

  function renderChipLegend() {
    if (!el.chipLegend) return;
    el.chipLegend.innerHTML = "";
    V.focus.forEach(function (code, i) {
      if (i) {
        var dot = document.createElement("span");
        dot.className = "dot";
        dot.textContent = "·";
        el.chipLegend.appendChild(dot);
      }
      var b = document.createElement("b");
      b.textContent = code;
      el.chipLegend.appendChild(b);
      el.chipLegend.appendChild(document.createTextNode(" " + focusPoint(code).label.toLowerCase()));
    });
  }

  /* ------------------------------------------------------------ clip switch */
  var PHASE_LABEL = {
    ACT: "ACT · fake-shot activation",
    D1: "D1 · individual defending",
    D2: "D2 · defending together",
    D3: "D3 · goalkeeper",
    D3M: "D3 · sprint / movement"
  };

  function clipOptionLabel(clip) {
    /* A clip can carry its own phase label (A7/W11 topics differ from D6/W10). */
    var phase = clip.phaseLabel || PHASE_LABEL[clip.drill] || clip.title;
    var tail = clip.window ? " · " + clip.window : "";
    return phase + tail;
  }

  function initClipSelect() {
    var label = document.createElement("label");
    label.textContent = "Team ";
    var teamSelect = document.createElement("select");
    teamSelect.id = "teamSelect";
    teamSelect.setAttribute("aria-label", "Select team");
    var teams = [];
    DATA.clips.forEach(function(c) { if (teams.indexOf(c.group) < 0) teams.push(c.group); });
    teams.sort().forEach(function(team) {
      var option = document.createElement("option");
      option.value = team; option.textContent = team + " · " + squadOf(DATA.clips.find(function(c) { return c.group === team; })).label;
      teamSelect.appendChild(option);
    });
    label.appendChild(teamSelect);
    el.clipSelect.parentNode.insertBefore(label, el.clipSelect);
    teamSelect.value = V.group;
    function populate() {
      el.clipSelect.innerHTML = "";
      DATA.clips.forEach(function(clip, i) {
        if (clip.group !== teamSelect.value) return;
        var option = document.createElement("option");
        option.value = String(i); option.textContent = clipOptionLabel(clip);
        el.clipSelect.appendChild(option);
      });
      el.clipSelect.title = WEEK_META.short + " · " + teamSelect.value;
    }
    populate();
    teamSelect.addEventListener("change", function() {
      populate(); selectClip(DATA.clips[Number(el.clipSelect.value)]);
    });
    el.clipSelect.addEventListener("change", function() {
      selectClip(DATA.clips[Number(el.clipSelect.value)]);
    });
  }

  function selectClip(clip) {
    if (!clip || clip === V) return;
    V = clip;
    state.duration = clip.duration || 0;
    state.start = null;
    state.end = null;
    state.ratings = {};
    state.replayStop = null;
    el.video.pause();
    state.remoteTried = null;
    el.video.src = clip.file;
    try { el.video.load(); } catch (err) {}

    buildObsRows();
    renderChipLegend();
    initMeta();
    initTicks();
    initCutMarks();
    resetForm(false);
    renderEvents();
    updateClock();
    setPlayIcon();
    saveStore();
    toast("Switched to " + clip.title + " — " + clip.id, "good");
  }

  /* "1-MON-HB-17:15--18:45" -> "Mon 17:15–18:45 · HB" */
  function sessionText(session) {
    var m = /^\d-([A-Z]{3})-([A-Z]{2,3})-(.+?)--(.+)$/.exec(session || "");
    if (!m) return session || "—";
    var day = m[1].charAt(0) + m[1].slice(1).toLowerCase();
    return day + " " + m[3] + "–" + m[4] + " · " + m[2];
  }

  /* ------------------------------------------------------------ video meta */
  function initMeta() {
    el.videoIdLabel.textContent = V.id;
    el.clipSubtitle.textContent = WEEK_META.short + " · " + V.title
      + (V.window ? " · " + V.window : "") + " · " + sessionText(V.session);
    $("#ctxTeam").textContent = squadOf(V).label;
    $("#ctxSession").textContent = sessionText(V.session);
    $("#ctxVideo").textContent = V.id;
    el.clipName.textContent = V.source_name;
    el.clipOrigin.textContent = V.origin;
    el.durTime.textContent = fmt(V.duration);
    el.clipDuration.textContent = fmt(V.duration);
    el.clipNote.textContent = V.combined
      ? V.segments.length + " recordings"
      : "1 recording" + (C.hasClock(V.segments) ? "" : " · no camera clock");
    /* The day inside a video ID is a pinned filename slug, not the shoot day.
       W13's Tuesday reshoots kept their -MON IDs so saved tags stay attached;
       shotDay / window / phaseLabel carry the real day. */
    el.videoChip.title = "Video ID " + V.id + " — click to copy"
      + (V.shotDay ? " · shot " + V.shotDay + (V.shotTime ? " " + V.shotTime : "")
                   + " (day in ID is a pinned label)" : "");
  }

  function initCutMarks() {
    el.timeline.querySelectorAll(".tl-cut").forEach(function (node) { node.remove(); });
    var total = state.duration || V.duration;
    V.segments.slice(0, -1).forEach(function (seg, i) {
      var next = V.segments[i + 1];
      var cut = document.createElement("div");
      cut.className = "tl-cut";
      cut.style.left = (seg.file_end / total * 100) + "%";
      cut.title = "Recording cut at " + fmt(seg.file_end) + " — source clock jumps to " + next.clock;
      el.timeline.appendChild(cut);
    });
  }

  function initTicks() {
    el.ticks.innerHTML = "";
    var last = state.duration || V.duration;
    for (var i = 0; i <= 4; i += 1) {
      var span = document.createElement("span");
      span.textContent = fmt(last * (i / 4));
      span.style.left = (i / 4) * 100 + "%";
      el.ticks.appendChild(span);
    }
  }

  function onMeta() {
    state.duration = isFinite(el.video.duration) && el.video.duration > 0 ? el.video.duration : V.duration;
    /* Every duration label comes from the player, so the header and the
       transport can never disagree by a millisecond. */
    el.durTime.textContent = fmt(state.duration);
    el.clipDuration.textContent = fmt(state.duration);
    el.timeline.setAttribute("aria-valuemax", String(state.duration.toFixed(3)));
    el.fallback.hidden = true;
    initTicks();
    initCutMarks();
    renderSegment();
    updateClock();
  }

  function updateClock() {
    var fileTime = el.video.currentTime || 0;
    el.curTime.textContent = fmt(fileTime);
    el.sourceNow.textContent = sourceText(el.video.currentTime || 0);
    el.recLabel.textContent = "rec " + segmentOf(fileTime).index;
    var pct = state.duration ? Math.min(1, Math.max(0, fileTime / state.duration)) : 0;
    el.tlHead.style.left = (pct * 100) + "%";
    el.timeline.setAttribute("aria-valuenow", String((el.video.currentTime || 0).toFixed(3)));
    if (state.replayStop !== null && el.video.currentTime >= state.replayStop - 0.02) {
      state.replayStop = null;
      el.video.pause();
    }
    /* Live stopwatch: only while a start marker exists and no end is stamped. */
    if (state.start !== null && state.end === null) renderTimer();
  }

  function setPlayIcon() {
    var playing = !el.video.paused && !el.video.ended;
    el.playBtn.innerHTML = playing ? ICON.pause : ICON.play;
    el.playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
  }

  function seekTo(fileTime) {
    var dur = state.duration || V.duration;
    var t = Math.min(Math.max(0, fileTime), Math.max(0, dur - 0.001));
    return new Promise(function (resolve) {
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        el.video.removeEventListener("seeked", finish);
        resolve(el.video.currentTime);
      }
      el.video.addEventListener("seeked", finish, { once: true });
      try { el.video.currentTime = t; } catch (err) { finish(); }
      setTimeout(finish, 1200);
    });
  }

  /* ------------------------------------------------------------ markers */
  function setStartAtPlayhead() {
    var t = clipNow();
    state.start = C.round3(t);
    if (state.end !== null && state.end <= state.start + 0.04) state.end = null;
    renderSegment();
  }

  function setEndAtPlayhead() {
    var t = clipNow();
    if (state.start === null) {
      toast("Set a start marker first.", "bad");
      return;
    }
    if (t <= state.start + 0.04) {
      toast("Move the playhead past the start marker first.", "bad");
      return;
    }
    state.end = C.round3(t);
    renderSegment();
  }

  function renderSegment() {
    var hasStart = state.start !== null;
    var hasEnd = state.end !== null;
    /* The separate start/end readout box is hidden. Each marker button now
       carries its own stamped time (data-time -> CSS ::after on laptop;
       mobile.js writes the same value into the phone label) and turns lime
       when stamped. The class/attribute survive mobile.js text rewrites. */
    [[el.setStart, hasStart, state.start, "start"], [el.setEnd, hasEnd, state.end, "end"]].forEach(function (row) {
      var btn = row[0], has = row[1], text = has ? fmt(row[2]) : "";
      btn.classList.toggle("stamped", has);
      btn.dataset.time = text;
      btn.setAttribute("aria-label", has
        ? "Set " + row[3] + " marker, currently " + text
        : "Set " + row[3] + " marker");
    });
    el.segStart.textContent = hasStart ? fmt(state.start) : "—";
    el.segEnd.textContent = hasEnd ? fmt(state.end) : "—";
    el.segStartSource.textContent = hasStart
      ? sourceText(state.start) + " · rec " + segmentOf(state.start).index
      : "—";
    el.segEndSource.textContent = hasEnd
      ? sourceText(state.end) + " · rec " + segmentOf(state.end).index
      : "—";
    el.segLen.textContent = hasStart && hasEnd ? (state.end - state.start).toFixed(1) + " s" : "—";

    var dur = state.duration || V.duration || 1;
    if (hasStart) {
      var s = state.start / dur;
      el.tlStart.hidden = false;
      el.tlStart.style.left = (Math.min(1, Math.max(0, s)) * 100) + "%";
    } else {
      el.tlStart.hidden = true;
    }
    if (hasEnd) {
      var e = state.end / dur;
      el.tlEnd.hidden = false;
      el.tlEnd.style.left = (Math.min(1, Math.max(0, e)) * 100) + "%";
    } else {
      el.tlEnd.hidden = true;
    }
    if (hasStart && hasEnd) {
      var a = Math.min(1, Math.max(0, state.start / dur));
      var b = Math.min(1, Math.max(0, state.end / dur));
      el.tlRegion.classList.add("on");
      el.tlRegion.style.left = (a * 100) + "%";
      el.tlRegion.style.width = (Math.max(0.4, (b - a) * 100)) + "%";
    } else {
      el.tlRegion.classList.remove("on");
    }
    renderTimer();
  }

  /* -------------------------------------------------- 20 s segment timer
     A live stopwatch from the start marker to the playhead, shown as a compact
     chip beside the current/total time. Nobody has to subtract timestamps to
     know whether a Drillbox example is long enough. Once the end marker is set
     the readout freezes on the final length. */
  function renderTimer() {
    if (!el.segTimer) return;
    var goal = DRILLBOX_MIN_SECONDS;
    var fixed = state.end !== null;
    var len = null;
    if (state.start !== null) {
      var to = fixed ? state.end : Math.max(state.start, clipNow());
      len = Math.max(0, C.round3(to - state.start));
    }
    var mode = "idle";
    if (len === null) {
      el.timerValue.textContent = "0.0 s";
      el.timerHint.textContent = "set start";
    } else if (!fixed) {
      mode = len >= goal ? "ready" : "running";
      el.timerValue.textContent = len.toFixed(1) + " s";
      el.timerHint.textContent = mode === "ready"
        ? goal.toFixed(0) + " s reached · press E"
        : (goal - len).toFixed(1) + " s to " + goal.toFixed(0) + " s";
    } else {
      mode = len >= goal ? "ok" : "short";
      el.timerValue.textContent = len.toFixed(1) + " s";
      el.timerHint.textContent = mode === "ok"
        ? goal.toFixed(0) + " s ✓ Drillbox"
        : (goal - len).toFixed(1) + " s short";
    }
    el.segTimer.dataset.state = mode;
    el.timerFill.style.width = (len === null ? 0 : Math.min(100, len / goal * 100)) + "%";
    updateModeNote(len);
  }

  /* In Drillbox mode the form is nearly empty, so repeat the live window
     length next to the save button. It uses the same 20 s rule as the timer. */
  function updateModeNote(len) {
    if (!el.drillboxLen || state.mode !== "drillbox") return;
    if (len === undefined || len === null) len = drillboxLength(state.start, state.end);
    var ok = isFinite(len);
    el.drillboxLen.textContent = ok ? len.toFixed(1) + " s" : "—";
    el.drillboxLen.dataset.state = !ok ? "idle"
      : (len >= DRILLBOX_MIN_SECONDS ? "ok" : "short");
  }

  function seekFromPointer(event) {
    var rect = el.timeline.getBoundingClientRect();
    var ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    el.video.currentTime = ratio * (state.duration || V.duration);
  }

  /* ------------------------------------------------------------ roster combo */
  function unknownPlayer() {
    return { id: C.UNKNOWN, nickname: "Unknown player", cn: "", year: "" };
  }

  function playerDisplay(player) {
    if (!player) return "";
    if (player.id === C.UNKNOWN) return "Unknown player";
    return (player.nickname + " " + player.cn).trim();
  }

  /* A clip's roster is its squad; this trial uses one anonymous test squad. */
  function squadOf(clip) {
    var c = clip || {};
    var sq = c.squad || {};
    var teams = Array.isArray(sq.teams) && sq.teams.length ? sq.teams : [c.team];
    return {
      label: sq.label || ((c.team || "") + (c.group ? " / " + c.group : "")),
      teams: teams.filter(Boolean)
    };
  }

  function allPlayers() {
    /* Only the anonymous slots assigned to this test clip. Unknown player is always offered. */
    var teams = squadOf(V).teams;
    return DATA.roster.filter(function (p) { return Array.isArray(V.rosterIds) ? V.rosterIds.indexOf(p.id) >= 0 : teams.indexOf(p.team) >= 0; })
      .slice()
      .sort(function (a, b) {
        var byTeam = teams.indexOf(a.team) - teams.indexOf(b.team);
        if (byTeam) return byTeam;
        return a.nickname.toLowerCase() < b.nickname.toLowerCase() ? -1 : 1;
      });
  }

  function rosterHint() {
    return squadOf(V).label + " · " + allPlayers().length + " players";
  }

  /* On laptop the hint row is hidden once a player is picked, because the
     name is already in the search field. The roster hint stays while empty.
     Phone keeps showing both rows (CSS only targets min-width:701px). */
  function setPlayerHint(text, picked) {
    el.playerHint.textContent = text;
    if (picked) el.playerHint.setAttribute("data-picked", "1");
    else el.playerHint.removeAttribute("data-picked");
  }

  function renderOptions(query) {
    var q = String(query || "").trim().toLowerCase();
    var list = allPlayers().filter(function (p) {
      if (!q) return true;
      return (p.nickname + " " + p.cn + " " + p.id + " " + p.year).toLowerCase().indexOf(q) >= 0;
    });
    if (!q || "unknown player".indexOf(q) === 0) {
      list.unshift(unknownPlayer());
    }
    state.comboOptions = list;
    state.comboIndex = -1;
    el.playerList.innerHTML = "";

    if (!list.length) {
      var empty = document.createElement("div");
      empty.className = "combo-empty";
      empty.textContent = "No player matches that search.";
      el.playerList.appendChild(empty);
      return;
    }

    var mixed = squadOf(V).teams.length > 1;
    list.forEach(function (p, index) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "combo-option" + (p.id === C.UNKNOWN ? " unknown" : "");
      btn.setAttribute("role", "option");
      btn.dataset.index = String(index);

      var name = document.createElement("span");
      name.className = "nm";
      name.textContent = p.id === C.UNKNOWN ? "Unknown player" : p.nickname;
      if (p.cn) {
        var cn = document.createElement("small");
        cn.textContent = p.cn;
        name.appendChild(cn);
      }

      var pid = document.createElement("span");
      pid.className = "pid";
      /* Mixed squads: the team is what tells two children apart, the ID is on hover. */
      pid.textContent = p.id === C.UNKNOWN ? "no ID" : (mixed ? p.team : p.id);
      if (mixed) btn.title = p.id;

      btn.appendChild(name);
      btn.appendChild(pid);
      btn.addEventListener("mousedown", function (ev) {
        ev.preventDefault();
        selectPlayer(p);
      });
      el.playerList.appendChild(btn);
    });
  }

  function openCombo() {
    renderOptions(el.playerSearch.value === playerDisplay(state.player) ? "" : el.playerSearch.value);
    el.playerList.hidden = false;
    el.playerSearch.setAttribute("aria-expanded", "true");
  }

  function closeCombo() {
    el.playerList.hidden = true;
    el.playerSearch.setAttribute("aria-expanded", "false");
    state.comboIndex = -1;
  }

  function selectPlayer(player) {
    state.player = player;
    el.playerSearch.value = playerDisplay(player);
    el.clearPlayer.hidden = false;
    setPlayerHint(player.id === C.UNKNOWN
      ? "Unknown identity — no player ID stored"
      : player.id, true);
    closeCombo();
  }

  function clearPlayer() {
    state.player = null;
    el.playerSearch.value = "";
    el.clearPlayer.hidden = true;
    setPlayerHint(rosterHint(), false);
    closeCombo();
  }

  function highlightOption(index) {
    var options = $$(".combo-option", el.playerList);
    options.forEach(function (node) { node.classList.remove("active"); });
    if (index >= 0 && options[index]) {
      options[index].classList.add("active");
      options[index].scrollIntoView({ block: "nearest" });
    }
  }

  /* ------------------------------------------------------------ ratings */
  function renderRatings() {
    $$(".obs-row").forEach(function (row) {
      var field = row.dataset.field;
      $$(".rate button", row).forEach(function (btn) {
        btn.setAttribute("aria-pressed", String(state.ratings[field] === btn.dataset.value));
      });
    });
    var rated = Object.keys(state.ratings).filter(function (k) { return !!state.ratings[k]; }).length;
    el.fillRest.hidden = !(rated > 0 && rated < V.focus.length);
  }

  function setRating(field, value) {
    state.ratings[field] = value;
    renderRatings();
  }

  /* ------------------------------------------------------------ form */
  function updateCommentCount() {
    el.commentCount.textContent = String(el.comment.value.length);
  }

  function updateStatusButtons() {
    $$(".confirm button", el.confirm).forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.dataset.status === state.status));
    });
  }

  /* ------------------------------------------------- Drillbox nomination
     One best example per topic / age / exercise cell, Green team only. The
     flag lives inside `comment` as #drillbox so the 18-column A-R paste into
     the weekfile stays untouched. The offline publisher reads it; this app
     never encodes video. C.withMarks() re-attaches it on save so a long coach
     note cannot truncate it. The publisher cuts the tagged segment, so a
     Drillbox example must be at least 20 seconds (no maximum). The live timer
     in the clip card shows the coach exactly how far the segment has come. */
  /* DRILLBOX_MIN_SECONDS comes from core.js so the timer, validateEvent() and
     the save guard can never disagree about "20 seconds". */

  function drillboxLength(start, end) {
    if (start == null || end == null) return NaN;
    var s = Number(start), e = Number(end);
    if (!isFinite(s) || !isFinite(e)) return NaN;
    return C.round3(e - s);
  }

  function drillboxTimeError(start, end) {
    var len = drillboxLength(start, end);
    if (!isFinite(len) || len <= 0) {
      return "Drillbox examples need a start and end marker spanning at least 20 seconds.";
    }
    if (len < DRILLBOX_MIN_SECONDS) {
      return "Drillbox clip is " + len.toFixed(1) + " s — examples must be at least 20 s. Extend the end marker.";
    }
    return "";
  }

  function hasDrillbox(ev) {
    return C.isDrillboxTag(ev);
  }

  function withDrillbox(comment, on) {
    return C.withMarks(comment, on);
  }

  /* VID-FCG-A7F-ACT-U11G-TUE-01 -> A7/U11/ACT, team G. */
  function clipCell(videoId) {
    var m = /^VID-FCG-([A-Z]\d+)[A-Z]?-(ACT|D1|D2|D3|TG)-U(\d+)([A-Z])-/i.exec(videoId || "");
    if (!m) return { cell: videoId || "?", green: true };
    return {
      cell: m[1].toUpperCase() + "/U" + Number(m[3]) + "/" + m[2].toUpperCase(),
      green: m[4].toUpperCase() === "G"
    };
  }

  /* ------------------------------------------------------ two tag modes
     Player tag -> player, four quality ratings, free comment.
     Drillbox   -> ONLY the >= 20 s window. No player, no ratings, no comment.
     The mode is a workspace preference (remembered in the store); the saved
     row uses C.DRILLBOX_PLAYER_ID as a sentinel so the publisher and the
     Tags sheet can tell the two apart without a 19th column. */
  function updateSaveButton() {
    var drillbox = state.mode === "drillbox";
    el.saveBtn.textContent = state.editing
      ? (drillbox ? "Update Drillbox" : "Update tag")
      : (drillbox ? "Save Drillbox example" : "Save tag");
    el.saveBtn.title = drillbox
      ? "Save a window of at least 20 s as the Drillbox example for " + clipCell(V.id).cell
      : "Save this player tag with its ratings and comment";
  }

  function applyMode() {
    var drillbox = state.mode === "drillbox";
    el.tagForm.dataset.mode = state.mode;
    $$("#modeSwitch button").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.dataset.mode === state.mode));
    });
    el.formTitle.textContent = state.editing
      ? (drillbox ? "Edit Drillbox example" : "Edit player tag")
      : (drillbox ? "Drillbox example" : "Tag a player");
    el.drillboxNote.hidden = !drillbox;
    updateSaveButton();
    updateModeNote();
    showError("");
  }

  function clearOtherNominations(keepId, videoId) {
    var cell = clipCell(videoId).cell, stamp = new Date().toISOString();
    store.events = store.events.map(function (ev) {
      if (ev.event_id === keepId || !hasDrillbox(ev)) return ev;
      if (clipCell(ev.video_id).cell !== cell) return ev;
      return Object.assign({}, ev, {
        comment: withDrillbox(ev.comment, false), updated_at: stamp
      });
    });
  }

  /* Legacy escape hatch only: older player tags could be nominated with the
     star. New examples are created in Drillbox mode, never promoted from a
     player tag. The row action therefore only ever REMOVES a nomination. */
  function toggleDrillbox(id) {
    var target = store.events.filter(function (ev) { return ev.event_id === id; })[0];
    if (!target) return;
    var on = !hasDrillbox(target), info = clipCell(target.video_id);
    if (on) {
      toast("Use Drillbox mode to create a new example.", "bad");
      return;
    }
    store.events = store.events.map(function (ev) {
      if (ev.event_id !== id) return ev;
      return Object.assign({}, ev, {
        comment: withDrillbox(ev.comment, on), updated_at: new Date().toISOString()
      });
    });
    if (on) clearOtherNominations(id, target.video_id);
    saveStore();
    renderEvents();
    if (state.editing === id) {
      state.drillbox = on;
      updateSaveButton();
    }
    toast(on ? "Drillbox example for " + info.cell : "Drillbox nomination removed", "good");
  }

  function resetForm(keepMarkers) {
    state.player = null;
    state.ratings = {};
    state.status = "Draft";
    state.drillbox = state.mode === "drillbox";
    state.editing = null;
    if (!keepMarkers) {
      state.start = null;
      state.end = null;
    }
    el.playerSearch.value = "";
    el.clearPlayer.hidden = true;
    setPlayerHint(rosterHint(), false);
    el.comment.value = "";
    updateCommentCount();
    renderRatings();
    updateStatusButtons();
    renderSegment();
    showError("");
    el.modeBadge.textContent = "New";
    el.modeBadge.classList.remove("editing");
    applyMode();
    el.deleteBtn.hidden = true;
    el.eventBody.querySelectorAll("tr.editing").forEach(function (tr) { tr.classList.remove("editing"); });
  }

  function loadEventIntoForm(ev) {
    var drillbox = C.eventMode(ev) === "drillbox";
    if (drillbox) {
      state.player = null;
      el.playerSearch.value = "";
      el.clearPlayer.hidden = true;
      setPlayerHint("Drillbox example — no player", false);
    } else {
      var player = ev.player_id === C.UNKNOWN
        ? unknownPlayer()
        : allPlayers().filter(function (p) { return p.id === ev.player_id; })[0] || {
            id: ev.player_id, nickname: ev.player_display.replace(/\s+\S+$/, ""), cn: "", year: ""
          };
      state.player = player;
      el.playerSearch.value = playerDisplay(player);
      el.clearPlayer.hidden = false;
      setPlayerHint(player.id === C.UNKNOWN ? "Unknown identity — no player ID stored" : player.id, true);
    }

    state.mode = drillbox ? "drillbox" : "player";
    store.mode = state.mode;
    state.start = ev.t_start;
    state.end = ev.t_end;
    state.ratings = Object.assign({}, ev.observations || {});
    state.status = ev.confirmation;
    state.drillbox = hasDrillbox(ev);
    state.editing = ev.event_id;

    /* #drillbox lives in state, not in the textarea, so the coach sees his
       own words only. withMarks() re-attaches it on save. */
    el.comment.value = C.stripMarks(ev.comment);
    updateCommentCount();
    renderRatings();
    updateStatusButtons();
    renderSegment();
    showError("");

    el.modeBadge.textContent = "Editing";
    el.modeBadge.classList.add("editing");
    applyMode();
    el.deleteBtn.hidden = false;

    highlightEditingRow(ev.event_id);
    seekTo(C.replayTarget(ev)).then(function () { el.video.pause(); });
  }

  function highlightEditingRow(id) {
    $$("#eventBody tr").forEach(function (tr) {
      tr.classList.toggle("editing", tr.dataset.id === id);
    });
  }

  function saveEvent() {
    var drillbox = state.mode === "drillbox";
    if (!drillbox && !state.player) {
      showError("Select a player, or choose Unknown player.");
      el.playerSearch.focus();
      return false;
    }
    if (drillbox) {
      /* Never let a short segment slip through as a Drillbox example — the
         publisher would cut an invalid video from these markers. */
      var drillboxErr = drillboxTimeError(state.start, state.end);
      if (drillboxErr) { showError(drillboxErr); toast(drillboxErr, "bad"); return false; }
    }
    var reviewer = currentReviewer();
    if (reviewer.length < 2) {
      showError("Choose a reviewer from the list, or pick 'Other name…' and type it.");
      el.reviewer.focus();
      return false;
    }
    var existing = state.editing
      ? store.events.filter(function (ev) { return ev.event_id === state.editing; })[0]
      : null;

    var ev = C.buildEvent({
      event_id: existing ? existing.event_id : "",
      video_id: V.id,
      player_id: drillbox ? C.DRILLBOX_PLAYER_ID : state.player.id,
      player_display: drillbox ? "Drillbox example" : playerDisplay(state.player),
      t_start: state.start === null ? NaN : state.start,
      t_end: state.end === null ? NaN : state.end,
      source_start: state.start === null ? "" : clockValue(state.start),
      source_end: state.end === null ? "" : clockValue(state.end),
      source_segment: state.start === null ? 0 : segmentOf(state.start).index,
      focus: drillbox ? [] : V.focus,
      observations: drillbox ? {} : state.ratings,
      comment: C.withMarks(drillbox ? "" : el.comment.value, drillbox || state.drillbox),
      reviewer: reviewer,
      confirmation: state.status,
      created_at: existing ? existing.created_at : null
    });

    if (isFinite(ev.t_start) && isFinite(ev.t_end) && C.crossesCut(ev.t_start, ev.t_end, V.segments)) {
      showError("This segment crosses the recording cut at " + fmt(V.segments[0].file_end) + " — tag each side separately.");
      return false;
    }

    var errors = C.validateEvent(ev, maxClip(), V.focus);
    if (errors.length) { showError(errors[0]); return false; }

    if (existing) {
      store.events = store.events.map(function (item) { return item.event_id === ev.event_id ? ev : item; });
    } else {
      /* Sequence numbers are per clip AND per coach: a bundle carries a short
         coach code so two coaches tagging the same clip never collide. */
      var seq = Math.max((store.seqs[V.id] || 0) + 1, C.nextSeq(eventsOfClip()));
      ev.event_id = C.eventId(eventPrefix(), seq);
      store.seqs[V.id] = seq;
      store.events.push(ev);
    }
    var nominated = drillbox || state.drillbox;
    if (nominated) clearOtherNominations(ev.event_id, V.id);
    store.reviewer = reviewer;
    store.mode = state.mode;
    store.events.sort(function (a, b) { return String(b.event_id).localeCompare(String(a.event_id)); });
    saveStore();
    renderEvents();
    resetForm(true);
    toast((existing ? "Updated " : "Saved ") + ev.event_id
      + (nominated ? " · Drillbox example for " + clipCell(V.id).cell : ""), "good");
    return true;
  }

  /* One repetition can contain several players, each with different focus
     points. Save the current tag, keep exactly the same start/end markers and
     open a fresh form for the next player. No schema, export or storage change. */
  function saveAndSameTime() {
    if (state.mode === "drillbox") {
      toast("Same time is for tagging several players on one repetition.", "bad");
      return;
    }
    if (state.start === null || state.end === null) {
      showError("Mark a start and end first, then tag another player on the same repetition.");
      return;
    }
    var start = state.start, end = state.end;
    /* Save a tag that is in progress; an empty form simply reuses the markers
       that the previous save left in place. Validation errors keep the form. */
    if (state.player && !saveEvent()) return;
    state.start = start;
    state.end = end;
    resetForm(true);
    el.playerSearch.focus();
    toast("Same repetition kept — choose the next player.", "good");
  }

  function deleteEvent(id) {
    var ev = store.events.filter(function (item) { return item.event_id === id; })[0];
    if (!ev) return;
    if (!window.confirm("Delete " + ev.event_id + "? This cannot be undone in the app.")) return;
    store.events = store.events.filter(function (item) { return item.event_id !== id; });
    saveStore();
    renderEvents();
    if (state.editing === id) resetForm(true);
    toast("Deleted " + id, "good");
  }

  function toggleStatus(id) {
    store.events = store.events.map(function (ev) {
      if (ev.event_id !== id) return ev;
      var next = ev.confirmation === "Confirmed" ? "Draft" : "Confirmed";
      return Object.assign({}, ev, { confirmation: next, updated_at: new Date().toISOString() });
    });
    saveStore();
    renderEvents();
  }

  /* ------------------------------------------------------------ events */
  function ratingChip(code, value) {
    var cls = value === "Demonstrated" ? "demo" : value === "Needs improvement" ? "need" : value === "Cannot assess" ? "na" : "none";
    var chip = document.createElement("span");
    chip.className = "chip " + cls;
    chip.textContent = code;
    chip.title = focusPoint(code).label + ": " + (value || "not rated");
    return chip;
  }

  function visibleEvents() {
    var q = el.filter.value.trim().toLowerCase();
    return eventsOfClip().filter(function (ev) {
      if (!q) return true;
      return [ev.event_id, ev.player_id, ev.player_display, ev.reviewer, ev.comment, ev.confirmation]
        .join(" ").toLowerCase().indexOf(q) >= 0;
    });
  }

  function renderEvents() {
    var events = visibleEvents();
    el.eventBody.innerHTML = "";
    el.eventCount.textContent = String(eventsOfClip().length);
    if (el.chipLegend) el.chipLegend.hidden = events.length === 0;
    el.emptyState.hidden = events.length > 0 || eventsOfClip().length > 0;
    if (!events.length && eventsOfClip().length) {
      var row = document.createElement("tr");
      var cell = document.createElement("td");
      cell.colSpan = 7;
      cell.className = "empty";
      cell.textContent = "No tag matches that filter.";
      row.appendChild(cell);
      el.eventBody.appendChild(row);
    }

    events.forEach(function (ev) {
      var tr = document.createElement("tr");
      tr.dataset.id = ev.event_id;
      if (ev.event_id === state.editing) tr.classList.add("editing");

      var tdEvent = document.createElement("td");
      var id = document.createElement("div");
      id.className = "ev-id";
      id.textContent = ev.event_id;
      var sub = document.createElement("div");
      sub.className = "ev-sub";
      sub.textContent = (ev.created_at || "").slice(0, 10);
      tdEvent.appendChild(id);
      tdEvent.appendChild(sub);
      var bare = C.eventMode(ev) === "drillbox";
      if (bare || hasDrillbox(ev)) {
        var typeChip = document.createElement("span");
        typeChip.className = "type-chip" + (bare ? " drillbox" : " legacy");
        typeChip.textContent = bare ? "DRILLBOX" : "★ DRILLBOX · player tag";
        typeChip.title = bare
          ? "Bare Drillbox example — window only, no player / ratings / comment"
          : "Older player tag that was nominated as a Drillbox example";
        tdEvent.appendChild(typeChip);
      }

      var tdPlayer = document.createElement("td");
      var pname = document.createElement("div");
      pname.className = "p-name" + (ev.player_known ? "" : " p-unknown");
      pname.textContent = ev.player_display || "Unknown player";
      var pid = document.createElement("div");
      pid.className = "p-id";
      pid.textContent = bare ? "no player · window only"
        : (ev.player_known ? ev.player_id : "UNKNOWN · no ID");
      tdPlayer.appendChild(pname);
      tdPlayer.appendChild(pid);

      var tdSeg = document.createElement("td");
      tdSeg.className = "seg-cell";
      tdSeg.textContent = fmt(ev.t_start) + " → " + fmt(ev.t_end);
      var src = document.createElement("small");
      var srcStart = ev.source_start || sourceCell(C.sourceAt(V.segments, ev.t_start));
      var srcEnd = ev.source_end || sourceCell(C.sourceAt(V.segments, ev.t_end));
      src.textContent = srcStart + " → " + srcEnd + " · rec " + (ev.source_segment || segmentOf(ev.t_start).index);
      tdSeg.appendChild(src);

      var tdObs = document.createElement("td");
      var chips = document.createElement("div");
      chips.className = "chips";
      var codes = (ev.focus && ev.focus.length ? ev.focus : V.focus);
      codes.forEach(function (code) {
        chips.appendChild(ratingChip(code, (ev.observations || {})[code]));
      });
      tdObs.appendChild(chips);

      var tdReviewer = document.createElement("td");
      tdReviewer.textContent = ev.reviewer || "—";

      var tdStatus = document.createElement("td");
      var badge = document.createElement("button");
      badge.type = "button";
      badge.className = "badge" + (ev.confirmation === "Confirmed" ? " confirmed" : "");
      badge.textContent = ev.confirmation;
      badge.title = "Toggle confirmation";
      badge.addEventListener("click", function () { toggleStatus(ev.event_id); });
      tdStatus.appendChild(badge);

      var tdActions = document.createElement("td");
      var actions = document.createElement("div");
      actions.className = "actions";

      var replay = document.createElement("button");
      replay.type = "button";
      replay.className = "act";
      replay.title = "Replay and check";
      replay.setAttribute("aria-label", "Replay " + ev.event_id);
      replay.innerHTML = ICON.replay;
      replay.addEventListener("click", function () { replayEvent(ev); });

      var edit = document.createElement("button");
      edit.type = "button";
      edit.className = "act";
      edit.title = "Edit";
      edit.setAttribute("aria-label", "Edit " + ev.event_id);
      edit.innerHTML = ICON.edit;
      edit.addEventListener("click", function () { loadEventIntoForm(ev); });

      var del = document.createElement("button");
      del.type = "button";
      del.className = "act danger";
      del.title = "Delete";
      del.setAttribute("aria-label", "Delete " + ev.event_id);
      del.innerHTML = ICON.trash;
      del.addEventListener("click", function () { deleteEvent(ev.event_id); });

      /* Legacy only: a nominated PLAYER tag can drop its nomination here.
         New examples are made in Drillbox mode, never promoted from a row. */
      if (!bare && hasDrillbox(ev)) {
        var star = document.createElement("button");
        star.type = "button";
        star.className = "act drillbox-star drillbox-on";
        star.title = "Remove Drillbox nomination";
        star.setAttribute("aria-label", "Remove Drillbox nomination from " + ev.event_id);
        star.innerHTML = ICON.star;
        star.addEventListener("click", function () { toggleDrillbox(ev.event_id); });
        actions.appendChild(star);
      }
      actions.appendChild(replay);
      actions.appendChild(edit);
      actions.appendChild(del);
      tdActions.appendChild(actions);

      tr.appendChild(tdEvent);
      tr.appendChild(tdPlayer);
      tr.appendChild(tdSeg);
      tr.appendChild(tdObs);
      tr.appendChild(tdReviewer);
      tr.appendChild(tdStatus);
      tr.appendChild(tdActions);
      el.eventBody.appendChild(tr);
    });

    renderStoreNote();
  }

  function renderStoreNote() {
    var n = store.events.length;
    var mine = eventsOfClip().length;
    var base = state.storageOk
      ? "Saved on this device · " + mine + (mine === 1 ? " tag" : " tags") + " on this clip"
        + (n > mine ? " · " + (n - mine) + " on other clips" : "")
      : "Storage unavailable — export before closing";
    el.storeNote.textContent = base;
    el.verifyAll.disabled = mine === 0;
    if (el.clearTagsBtn) {
      /* Keep Clear reachable with zero tags when an undo snapshot exists —
         otherwise the panel (and its Undo button) could never be opened. */
      var undo = hasUndo();
      el.clearTagsBtn.disabled = n === 0 && !undo;
      el.clearTagsBtn.title = n
        ? "Erase saved tags from this device so you can start a fresh tagging round"
        : (undo ? "Undo the last Clear" : "No saved tags to clear");
      if (!n && !undo && el.clearPanel) toggleClearPanel(false);
      else if (el.clearPanel && !el.clearPanel.hidden) updateClearPanel();
    }
  }

  /* ------------------------------------------------------------- clear */
  /* Tags live in this browser's localStorage (one store per week + coach),
     not on a server. Clear gives a coach an empty slate after a tagging round
     has been exported. It is deliberately two-step and ALWAYS downloads a
     backup first; the weekfile > Tags sheet and published videos are never
     touched. The seqs counters are kept so new event IDs cannot collide with
     rows that were already pasted into the weekfile. */
  function snapshot() {
    return {
      version: 1, week: WEEK_ID, coach: coachCode(),
      reviewer: store.reviewer, seqs: store.seqs, mode: store.mode,
      activeClip: V.id, events: store.events
    };
  }

  function backupJson(prefix) {
    var name = prefix + "-" + WEEK_ID.toLowerCase() + "-" + fileTag() + ".json";
    download(name, JSON.stringify(snapshot(), null, 2), "application/json");
    return name;
  }

  function clearBackupSnapshot() {
    try {
      var raw = localStorage.getItem(CLEAR_BACKUP_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) { return null; }
  }

  function hasUndo() {
    var snap = clearBackupSnapshot();
    return !!(snap && snap.store && snap.store.events && snap.store.events.length);
  }

  function restoreClear() {
    var snap = clearBackupSnapshot();
    if (!snap || !snap.store || !Array.isArray(snap.store.events)
        || !snap.store.events.length) {
      toast("No cleared tags to restore on this device.", "bad");
      return;
    }
    store.events = C.mergeEvents(store.events, snap.store.events);
    store.seqs = C.normalizeStore({ events: store.events, seqs: snap.store.seqs }).seqs;
    saveStore();
    renderEvents();
    updateClearPanel();
    toast("Restored " + snap.store.events.length + " tags.", "good");
  }

  function clearScope() {
    var checked = document.querySelector('input[name="clearScope"]:checked');
    return checked && checked.value === "clip" ? "clip" : "week";
  }

  function clearTargetCount(scope) {
    return scope === "clip" ? eventsOfClip().length : store.events.length;
  }

  function updateClearPanel() {
    var scope = clearScope();
    var all = store.events.length, mine = eventsOfClip().length;
    var n = clearTargetCount(scope);
    el.clearWeekName.textContent = WEEK_ID + " · " + (coachCode() || "master screen");
    el.clearScopeWeek.textContent = WEEK_ID;
    el.clearWeekCount.textContent = String(all);
    el.clearClipCount.textContent = String(mine);
    el.clearConfirm.textContent = "Clear " + n + (n === 1 ? " tag" : " tags");
    el.clearConfirm.disabled = n === 0;
    el.clearBackup.disabled = all === 0;
    var snap = clearBackupSnapshot();
    var undo = hasUndo();
    el.clearRestore.hidden = !undo;
    if (undo) {
      var at = String(snap.clearedAt || "").slice(0, 16).replace("T", " ");
      el.clearRestore.title = "Put back " + snap.store.events.length
        + " tags from the last Clear" + (at ? " (" + at + ")" : "");
    }
    return { scope: scope, count: n };
  }

  function toggleClearPanel(force) {
    if (!el.clearPanel) return;
    var open = typeof force === "boolean" ? force : el.clearPanel.hidden;
    el.clearPanel.hidden = !open;
    el.clearTagsBtn.setAttribute("aria-expanded", String(open));
    if (open) {
      /* Never inherit a narrow scope from the previous clear: each new Clear
         starts at the documented default (all clips of this week). */
      var weekRadio = document.querySelector('input[name="clearScope"][value="week"]');
      if (weekRadio) weekRadio.checked = true;
      updateClearPanel();
    }
  }

  function clearTags() {
    var target = updateClearPanel();
    if (!target.count) { toast("No tags to clear.", "bad"); return; }
    var snap = snapshot();
    var name = backupJson("tagging-ui-trial-before-clear");
    try {
      localStorage.setItem(CLEAR_BACKUP_KEY, JSON.stringify({
        clearedAt: new Date().toISOString(), scope: target.scope, store: snap
      }));
    } catch (err) { /* the downloaded JSON remains the fallback */ }
    store.events = target.scope === "clip"
      ? store.events.filter(function (ev) { return ev.video_id !== V.id; })
      : [];
    /* seqs stay high on purpose: a fresh tag must not reuse an event ID that
       already exists in the weekfile. */
    state.editing = null;
    el.filter.value = "";
    saveStore();
    resetForm(false);
    renderEvents();
    toggleClearPanel(false);
    toast("Cleared " + target.count + (target.count === 1 ? " tag" : " tags")
      + " · backup " + name, "good");
  }

  /* ------------------------------------------------------------ replay */
  function replayEvent(ev) {
    var target = C.replayTarget(ev);
    el.video.pause();
    var measured = null;
    var onSeek = function () {
      measured = el.video.currentTime;
      var drift = Math.abs(measured - target);
      state.replayStop = Math.max(0, ev.t_end);
      el.video.play().catch(function () { setPlayIcon(); });
      toast(
        "Replay " + ev.event_id + " at " + fmt(ev.t_start) +
        (drift <= 0.3 ? " · seek OK (" + drift.toFixed(2) + " s)" : " · drift " + drift.toFixed(2) + " s"),
        drift <= 0.3 ? "good" : "bad"
      );
    };
    el.video.addEventListener("seeked", onSeek, { once: true });
    el.video.currentTime = target;
  }

  function checkAll() {
    var events = eventsOfClip();
    if (!events.length) { toast("No tags to check on this clip yet.", "bad"); return; }
    var passed = 0;
    var maxDrift = 0;
    var failures = [];
    el.verifyAll.disabled = true;
    el.verifyAll.textContent = "Checking…";

    var chain = Promise.resolve();
    events.forEach(function (ev) {
      chain = chain.then(function () {
        return seekTo(C.replayTarget(ev)).then(function (actual) {
          var target = C.replayTarget(ev);
          var drift = Math.abs(actual - target);
          maxDrift = Math.max(maxDrift, drift);
          if (drift <= 0.3) passed += 1;
          else failures.push(ev.event_id);
        });
      });
    });

    chain.then(function () {
      el.verifyAll.disabled = false;
      el.verifyAll.textContent = "Check replay";
      toast(
        passed + "/" + events.length + " tags reopen at the stored moment" +
        (failures.length ? " · check " + failures.join(", ") : " · max drift " + maxDrift.toFixed(2) + " s"),
        failures.length ? "bad" : "good"
      );
    });
  }

  /* ------------------------------------------------------------ export/import */
  function exportCsv() {
    if (!store.events.length) { toast("No tags to export yet.", "bad"); return; }
    download("tagging-ui-trial-events-" + fileTag() + ".csv", C.toCsv(store.events, ","), "text/csv;charset=utf-8");
    toast("CSV ready — paste into Events (columns A–R).", "good");
  }

  function copyRows() {
    if (!store.events.length) { toast("No tags to copy yet.", "bad"); return; }
    var tsv = C.toCsv(store.events, "\t");
    function fallback() {
      var area = document.createElement("textarea");
      area.value = tsv;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try { document.execCommand("copy"); toast("Rows copied — paste into the current weekfile > Tags > A2.", "good"); }
      catch (err) { toast("Copy failed. Use Export → Events CSV.", "bad"); }
      document.body.removeChild(area);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(tsv).then(function () {
        toast("Rows copied — paste into the current weekfile > Tags > A2.", "good");
      }).catch(fallback);
    } else {
      fallback();
    }
  }

  function exportJson() {
    download(
      "tagging-ui-trial-backup-" + fileTag() + ".json",
      JSON.stringify({ version: 1, reviewer: store.reviewer, seqs: store.seqs, activeClip: V.id, events: store.events }, null, 2),
      "application/json"
    );
    toast("Backup saved.", "good");
  }

  function importJson(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result));
        var incoming = C.normalizeStore(parsed).events;
        if (!incoming.length) { toast("No tags found in that file.", "bad"); return; }
        store.events = C.mergeEvents(store.events, incoming);
        store.seqs = C.normalizeStore({ events: store.events }).seqs;
        saveStore();
        renderEvents();
        toast("Imported " + incoming.length + " tags (merged by event ID).", "good");
      } catch (err) {
        toast("That file is not a valid backup.", "bad");
      }
    };
    reader.readAsText(file);
  }

  /* ------------------------------------------------------------ week switch */
  /* Each week is its own dataset file. Reloading with ?week= keeps the coach
     code, the reviewer and the tags on that device intact. */
  function initWeekSelect() {
    var sel = el.weekSelect;
    if (!sel) return;
    sel.innerHTML = "";
    WEEKS.weeks.forEach(function (w) {
      var option = document.createElement("option");
      option.value = w.id;
      option.textContent = w.short || w.id;
      option.title = w.label || w.short || w.id;
      if (w.disabled) option.disabled = true;
      sel.appendChild(option);
    });
    sel.value = WEEK_ID;
    sel.addEventListener("change", function () {
      var query;
      try {
        var params = new URLSearchParams(location.search);
        params.set("week", sel.value);
        query = params.toString();
      } catch (err) {
        query = "week=" + encodeURIComponent(sel.value);
      }
      location.href = location.pathname + "?" + query;
    });
  }

  /* ------------------------------------------------------------ wiring */
  function init() {
    /* Restore the last-used clip, then render everything for it. */
    var initial = DATA.clips.filter(function (clip) { return clip.id === store.activeClip; })[0]
      || DATA.clips.filter(function (clip) { return clip.id === DATA.defaultClip; })[0]
      || DATA.clips[0];
    V = initial;
    document.title = "FCG · " + WEEK_META.short + " team tagging";
    initWeekSelect();
    initClipSelect();
    el.clipSelect.value = String(DATA.clips.indexOf(V));
    buildObsRows();
    renderChipLegend();
    initMeta();
    initTicks();
    initCutMarks();
    state.remoteTried = null;
    el.video.src = V.file;

    initReviewer();
    setPlayerHint(rosterHint(), false);

    el.video.addEventListener("loadedmetadata", onMeta);
    el.video.addEventListener("timeupdate", updateClock);
    el.video.addEventListener("play", setPlayIcon);
    el.video.addEventListener("pause", setPlayIcon);
    el.video.addEventListener("error", function () {
      /* Clips are served from this site so seeking works. If a local copy is
         missing, fall back once to the original hosted file before giving up. */
      if (V.file_remote && state.remoteTried !== V.id) {
        state.remoteTried = V.id;
        el.video.src = V.file_remote;
        try { el.video.load(); } catch (err) {}
        return;
      }
      el.fallback.hidden = false;
      var span = el.fallback.querySelector("span");
      if (span) span.innerHTML = "<code>" + V.file + "</code> is not on the site yet. Upload it to <code>tagging/media/</code>, or use Edge or Chrome.";
      toast("Clip missing — upload " + V.file + " to tagging/media/.", "bad");
    });
    if (el.video.readyState >= 1) onMeta();

    el.playBtn.addEventListener("click", function () {
      if (el.video.paused) {
        state.replayStop = null;
        el.video.play().catch(function () {});
      } else {
        el.video.pause();
      }
    });

    el.frameBack.addEventListener("click", function () { step(-1 / 30); });
    el.frameFwd.addEventListener("click", function () { step(1 / 30); });
    el.speed.addEventListener("change", function () { el.video.playbackRate = Number(el.speed.value); });

    el.setStart.addEventListener("click", setStartAtPlayhead);
    el.setEnd.addEventListener("click", setEndAtPlayhead);
    $$("[data-mark]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (btn.dataset.mark === "start") setStartAtPlayhead();
        else setEndAtPlayhead();
      });
    });

    el.timeline.addEventListener("pointerdown", function (ev) {
      ev.preventDefault();
      el.timeline.setPointerCapture(ev.pointerId);
      seekFromPointer(ev);
    });
    el.timeline.addEventListener("pointermove", function (ev) {
      if (ev.buttons === 1) seekFromPointer(ev);
    });
    el.timeline.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowLeft") { ev.preventDefault(); step(-1 / 30); }
      if (ev.key === "ArrowRight") { ev.preventDefault(); step(1 / 30); }
    });

    el.reviewer.addEventListener("change", function () { syncReviewerField(true); });
    el.reviewerOther.addEventListener("input", function () { syncReviewerField(true); });

    el.playerSearch.addEventListener("focus", openCombo);
    el.playerSearch.addEventListener("click", openCombo);
    el.playerSearch.addEventListener("input", function () {
      if (state.player && el.playerSearch.value !== playerDisplay(state.player)) {
        state.player = null;
        el.clearPlayer.hidden = true;
        setPlayerHint(rosterHint(), false);
      }
      renderOptions(el.playerSearch.value);
      el.playerList.hidden = false;
      el.playerSearch.setAttribute("aria-expanded", "true");
    });
    el.playerSearch.addEventListener("keydown", function (ev) {
      var options = $$(".combo-option", el.playerList);
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        if (el.playerList.hidden) openCombo();
        state.comboIndex = Math.min(options.length - 1, state.comboIndex + 1);
        highlightOption(state.comboIndex);
      } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        state.comboIndex = Math.max(0, state.comboIndex - 1);
        highlightOption(state.comboIndex);
      } else if (ev.key === "Enter") {
        if (!el.playerList.hidden && state.comboIndex >= 0 && state.comboOptions[state.comboIndex]) {
          ev.preventDefault();
          selectPlayer(state.comboOptions[state.comboIndex]);
        }
      } else if (ev.key === "Escape") {
        closeCombo();
      }
    });
    el.clearPlayer.addEventListener("click", clearPlayer);

    document.addEventListener("mousedown", function (ev) {
      if (!el.playerList.hidden && !ev.target.closest(".combo")) closeCombo();
      if (!el.exportMenu.hidden && !ev.target.closest(".menu-wrap")) toggleMenu(false);
    });

    el.fillRest.addEventListener("click", function () {
      V.focus.forEach(function (code) {
        if (!state.ratings[code]) state.ratings[code] = "Cannot assess";
      });
      renderRatings();
    });

    el.comment.addEventListener("input", updateCommentCount);

    $$(".confirm button", el.confirm).forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.status = btn.dataset.status;
        updateStatusButtons();
      });
    });

    $$("#modeSwitch button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var next = btn.dataset.mode;
        if (next === state.mode) return;
        if (next === "drillbox" && !clipCell(V.id).green) {
          toast("Drillbox examples are Green-team only.", "bad");
          return;
        }
        state.mode = next;
        state.drillbox = next === "drillbox";
        store.mode = next;
        saveStore();
        applyMode();
        renderSegment();
        toast(next === "drillbox"
          ? "Drillbox: just mark a window of at least 20 s."
          : "Player tag: pick a player, rate the focus points, add a comment.", "good");
      });
    });

    el.saveBtn.addEventListener("click", saveEvent);
    el.sameTimeBtn.addEventListener("click", saveAndSameTime);
    el.clearBtn.addEventListener("click", function () { resetForm(false); });
    el.deleteBtn.addEventListener("click", function () {
      if (state.editing) deleteEvent(state.editing);
    });

    el.filter.addEventListener("input", renderEvents);
    el.verifyAll.addEventListener("click", checkAll);

    /* Clear is two-step: the panel states the scope, a backup is downloaded
       and kept locally, then the tags are wiped from this device only. */
    el.clearTagsBtn.addEventListener("click", function () { toggleClearPanel(); });
    $$('input[name="clearScope"]').forEach(function (radio) {
      radio.addEventListener("change", updateClearPanel);
    });
    el.clearBackup.addEventListener("click", function () {
      if (!store.events.length) { toast("No tags to back up.", "bad"); return; }
      toast("Backup saved: " + backupJson("tagging-ui-trial-backup"), "good");
    });
    el.clearRestore.addEventListener("click", restoreClear);
    el.clearCancel.addEventListener("click", function () { toggleClearPanel(false); });
    el.clearConfirm.addEventListener("click", clearTags);
    document.addEventListener("click", function (ev) {
      if (el.clearPanel.hidden) return;
      if (el.clearPanel.contains(ev.target) || el.clearTagsBtn.contains(ev.target)) return;
      toggleClearPanel(false);
    });

    el.exportBtn.addEventListener("click", function () { toggleMenu(); });
    $$("#exportMenu [data-action]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        toggleMenu(false);
        var action = btn.dataset.action;
        if (action === "csv") exportCsv();
        if (action === "tsv") copyRows();
        if (action === "json") exportJson();
        if (action === "import") el.importFile.click();
      });
    });
    $("#copyCsv").addEventListener("click", copyRows);
    el.importFile.addEventListener("change", function () {
      if (el.importFile.files && el.importFile.files[0]) importJson(el.importFile.files[0]);
      el.importFile.value = "";
    });

    el.videoChip.addEventListener("click", function () {
      var text = V.id;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { toast("Video ID copied: " + text, "good"); })
          .catch(function () { toast("Video ID: " + text); });
      } else {
        toast("Video ID: " + text);
      }
    });

    document.addEventListener("keydown", onKey);
    updateStatusButtons();
    applyMode();
    renderRatings();
    renderSegment();
    renderEvents();
    updateCommentCount();
    updateClock();
    setPlayIcon();
  }

  function step(delta) {
    var t = Math.min(Math.max(0, el.video.currentTime + delta), state.duration || V.duration);
    el.video.currentTime = t;
    if (el.video.paused) updateClock();
  }

  function toggleMenu(force) {
    var open = typeof force === "boolean" ? force : el.exportMenu.hidden;
    el.exportMenu.hidden = !open;
    el.exportBtn.setAttribute("aria-expanded", String(open));
  }

  function onKey(ev) {
    /* Escape closes overlays even when a Clear radio or form field has focus. */
    if (ev.key === "Escape") { closeCombo(); toggleMenu(false); toggleClearPanel(false); return; }
    var tag = (ev.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select" || ev.target.isContentEditable) return;
    if (ev.code === "Space") {
      ev.preventDefault();
      el.playBtn.click();
      return;
    }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.key === "s" || ev.key === "S") { ev.preventDefault(); setStartAtPlayhead(); }
    if (ev.key === "e" || ev.key === "E") { ev.preventDefault(); setEndAtPlayhead(); }
    if (ev.key === "ArrowLeft") { ev.preventDefault(); step(ev.shiftKey ? -1 : -1 / 30); }
    if (ev.key === "ArrowRight") { ev.preventDefault(); step(ev.shiftKey ? 1 : 1 / 30); }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
