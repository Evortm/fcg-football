(function () {
  "use strict";

  var C = window.FCG;
  var DATA = window.PILOT;
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

  var STORE_KEY = "fcg.tagging.sanitized.v1" + (coachCode() ? "." + coachCode() : "");

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
    playerSearch: $("#playerSearch"),
    playerList: $("#playerList"),
    clearPlayer: $("#clearPlayer"),
    playerHint: $("#playerHint"),
    obs: $("#obs"),
    fillRest: $("#fillRest"),
    comment: $("#comment"),
    commentCount: $("#commentCount"),
    confirm: $(".confirm"),
    saveBtn: $("#saveBtn"),
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
    storeNote: $("#storeNote"),
    toast: $("#toast"),
    exportBtn: $("#exportBtn"),
    exportMenu: $("#exportMenu"),
    importFile: $("#importFile"),
    videoChip: $("#videoChip"),
    chipLegend: $("#chipLegend"),
    clipSelect: $("#clipSelect"),
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
    play: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>'
  };

  var state = {
    player: null,
    start: null,
    end: null,
    ratings: {},
    status: "Draft",
    editing: null,
    replayStop: null,
    duration: V.duration || 0,
    storageOk: true,
    comboIndex: -1,
    comboOptions: []
  };

  var store = loadStore();
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
      el.clipSelect.title = "W11 A7 · " + teamSelect.value;
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
    el.clipSubtitle.textContent = V.title + (V.window ? " · " + V.window : "") + " · " + sessionText(V.session);
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
    el.videoChip.title = "Video ID " + V.id + " — click to copy";
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
    el.playerHint.textContent = player.id === C.UNKNOWN
      ? "Unknown identity — no player ID stored"
      : player.id;
    closeCombo();
  }

  function clearPlayer() {
    state.player = null;
    el.playerSearch.value = "";
    el.clearPlayer.hidden = true;
    el.playerHint.textContent = rosterHint();
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

  function resetForm(keepMarkers) {
    state.player = null;
    state.ratings = {};
    state.status = "Draft";
    state.editing = null;
    if (!keepMarkers) {
      state.start = null;
      state.end = null;
    }
    el.playerSearch.value = "";
    el.clearPlayer.hidden = true;
    el.playerHint.textContent = rosterHint();
    el.comment.value = "";
    updateCommentCount();
    renderRatings();
    updateStatusButtons();
    renderSegment();
    showError("");
    el.formTitle.textContent = "Tag an action";
    el.modeBadge.textContent = "New";
    el.modeBadge.classList.remove("editing");
    el.saveBtn.textContent = "Save tag";
    el.deleteBtn.hidden = true;
    el.eventBody.querySelectorAll("tr.editing").forEach(function (tr) { tr.classList.remove("editing"); });
  }

  function loadEventIntoForm(ev) {
    var player = ev.player_id === C.UNKNOWN
      ? unknownPlayer()
      : allPlayers().filter(function (p) { return p.id === ev.player_id; })[0] || {
          id: ev.player_id, nickname: ev.player_display.replace(/\s+\S+$/, ""), cn: "", year: ""
        };

    state.player = player;
    el.playerSearch.value = playerDisplay(player);
    el.clearPlayer.hidden = false;
    el.playerHint.textContent = player.id === C.UNKNOWN ? "Unknown identity — no player ID stored" : player.id;

    state.start = ev.t_start;
    state.end = ev.t_end;
    state.ratings = Object.assign({}, ev.observations || {});
    state.status = ev.confirmation;
    state.editing = ev.event_id;

    el.comment.value = ev.comment || "";
    updateCommentCount();
    renderRatings();
    updateStatusButtons();
    renderSegment();
    showError("");

    el.formTitle.textContent = "Edit " + ev.event_id;
    el.modeBadge.textContent = "Editing";
    el.modeBadge.classList.add("editing");
    el.saveBtn.textContent = "Update tag";
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
    if (!state.player) { showError("Select a player, or choose Unknown player."); el.playerSearch.focus(); return; }
    var reviewer = el.reviewer.value.trim();
    var existing = state.editing
      ? store.events.filter(function (ev) { return ev.event_id === state.editing; })[0]
      : null;

    var ev = C.buildEvent({
      event_id: existing ? existing.event_id : "",
      video_id: V.id,
      player_id: state.player.id,
      player_display: playerDisplay(state.player),
      t_start: state.start === null ? NaN : state.start,
      t_end: state.end === null ? NaN : state.end,
      source_start: state.start === null ? "" : clockValue(state.start),
      source_end: state.end === null ? "" : clockValue(state.end),
      source_segment: state.start === null ? 0 : segmentOf(state.start).index,
      focus: V.focus,
      observations: state.ratings,
      comment: el.comment.value,
      reviewer: reviewer,
      confirmation: state.status,
      created_at: existing ? existing.created_at : null
    });

    if (isFinite(ev.t_start) && isFinite(ev.t_end) && C.crossesCut(ev.t_start, ev.t_end, V.segments)) {
      showError("This segment crosses the recording cut at " + fmt(V.segments[0].file_end) + " — tag each side separately.");
      return;
    }

    var errors = C.validateEvent(ev, maxClip(), V.focus);
    if (errors.length) { showError(errors[0]); return; }

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
    store.reviewer = reviewer;
    store.events.sort(function (a, b) { return String(b.event_id).localeCompare(String(a.event_id)); });
    saveStore();
    renderEvents();
    resetForm(true);
    toast((existing ? "Updated " : "Saved ") + ev.event_id, "good");
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

      var tdPlayer = document.createElement("td");
      var pname = document.createElement("div");
      pname.className = "p-name" + (ev.player_known ? "" : " p-unknown");
      pname.textContent = ev.player_display || "Unknown player";
      var pid = document.createElement("div");
      pid.className = "p-id";
      pid.textContent = ev.player_known ? ev.player_id : "UNKNOWN · no ID";
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

  /* ------------------------------------------------------------ wiring */
  function init() {
    /* Restore the last-used clip, then render everything for it. */
    var initial = DATA.clips.filter(function (clip) { return clip.id === store.activeClip; })[0]
      || DATA.clips.filter(function (clip) { return clip.id === DATA.defaultClip; })[0]
      || DATA.clips[0];
    V = initial;
    initClipSelect();
    el.clipSelect.value = String(DATA.clips.indexOf(V));
    buildObsRows();
    renderChipLegend();
    initMeta();
    initTicks();
    initCutMarks();
    el.video.src = V.file;

    el.reviewer.value = store.reviewer || "";
    if (store.reviewer) el.reviewer.dataset.saved = "1";
    el.playerHint.textContent = rosterHint();

    el.video.addEventListener("loadedmetadata", onMeta);
    el.video.addEventListener("timeupdate", updateClock);
    el.video.addEventListener("play", setPlayIcon);
    el.video.addEventListener("pause", setPlayIcon);
    el.video.addEventListener("error", function () {
      el.fallback.hidden = false;
      var span = el.fallback.querySelector("span");
      if (span) span.innerHTML = "Keep <code>" + V.file + "</code> beside this file, same name. Use Edge or Chrome.";
      toast("Clip missing — keep " + V.file + " beside index.html.", "bad");
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

    el.reviewer.addEventListener("input", function () {
      store.reviewer = el.reviewer.value.trim();
      saveStore();
    });

    el.playerSearch.addEventListener("focus", openCombo);
    el.playerSearch.addEventListener("click", openCombo);
    el.playerSearch.addEventListener("input", function () {
      if (state.player && el.playerSearch.value !== playerDisplay(state.player)) {
        state.player = null;
        el.clearPlayer.hidden = true;
        el.playerHint.textContent = rosterHint();
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

    el.saveBtn.addEventListener("click", saveEvent);
    el.clearBtn.addEventListener("click", function () { resetForm(false); });
    el.deleteBtn.addEventListener("click", function () {
      if (state.editing) deleteEvent(state.editing);
    });

    el.filter.addEventListener("input", renderEvents);
    el.verifyAll.addEventListener("click", checkAll);

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
    var tag = (ev.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select" || ev.target.isContentEditable) return;
    if (ev.key === "Escape") { closeCombo(); toggleMenu(false); return; }
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
