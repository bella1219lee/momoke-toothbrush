/* 萌可刷牙 — 介面 */
(function () {
  "use strict";
  var DATA = window.MOMOKE_DATA;
  var L = window.createMomokeLogic(DATA);
  var STORE_KEY = "momoke-brush-state-v1";
  var ZONES = ["上排左邊", "上排右邊", "下排左邊", "下排右邊"];
  var CHEERS = ["加油！", "刷得真好！", "慢慢刷乾淨！", "快完成了！"];
  var WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  var TYPE_LABEL = { royal: "皇室萌可", magic: "魔方萌可", villain: "反派萌可", princess: "公主", still: "劇照" };

  // ---------- 測試用隱藏參數（只在 ?test=1 時生效，介面不會顯示） ----------
  var params = new URLSearchParams(location.search);
  var TEST = params.get("test") === "1";
  var SPEED = 1, CLOCK_OFFSET = 0;
  if (TEST) {
    SPEED = Math.max(1, Number(params.get("speed")) || 1);
    var fake = params.get("now");
    if (fake) {
      var t = new Date(fake).getTime();
      if (!isNaN(t)) CLOCK_OFFSET = t - Date.now();
    }
  }
  function now() { return Date.now() + CLOCK_OFFSET; }

  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // ---------- 儲存 ----------
  var OLD_BACKUP_KEY = "momoke-brush-state-v1-schema1-backup";
  var MIGRATION_KEY = "momoke-brush-migration";
  var migratedGrants = [];
  var state = load();
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var obj = JSON.parse(raw);
        if (obj && obj.schema === L.SCHEMA) { var s = L.normalizeState(obj); if (s) return s; }
        // 舊格式（schema 1）→ 轉換並保存；舊資料另存一份備份
        var m = L.migrateState(obj, now(), Math.random);
        if (m) {
          try {
            localStorage.setItem(OLD_BACKUP_KEY, raw);
            localStorage.setItem(MIGRATION_KEY, JSON.stringify({ from: obj.schema || 1, to: L.SCHEMA, at: new Date(now()).toISOString(), notes: m.notes }));
            localStorage.setItem(STORE_KEY, JSON.stringify(m.state));
          } catch (e) { /* ignore */ }
          migratedGrants = m.granted;
          return m.state;
        }
      }
    } catch (e) { /* ignore */ }
    return L.emptyState();
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }
  // 家長設定（另存一個鍵，不改動進度資料的格式）
  var SETTINGS_KEY = "momoke-brush-settings";
  var settings = (function () {
    try { return L.normalizeSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null")); } catch (e) { return L.normalizeSettings(null); }
  })();
  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
  }

  // ---------- 畫面切換 ----------
  var current = "home";
  function go(name) {
    if (name !== "brush" && brush.running) cancelBrush();
    if (name !== "brush" && current === "brush") fx.stop();
    if (name !== "home" && name !== "brush") music.stopHome(); // 畫冊、日曆等畫面不播主頁音樂
    document.querySelectorAll(".screen").forEach(function (s) { s.classList.remove("active"); });
    $("screen-" + name).classList.add("active");
    current = name;
    window.scrollTo(0, 0);
    if (name === "home") { renderHome(); homeMusic(); }
    if (name === "album") renderAlbum();
    if (name === "calendar") { calMonth = null; renderCalendar(); }
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-go]");
    if (t) go(t.getAttribute("data-go"));
  });

  // ---------- 卡片圖片 ----------
  function placeholder(name) {
    var p = el("div", "placeholder");
    p.appendChild(el("span", "ph-icon", "🖼️"));
    p.appendChild(el("span", "", "圖片準備中"));
    return p;
  }
  // 劇照只顯示集數（「第 3 集」），不顯示 data.js 裡的名稱 / 簡介（blurb / intro 只留在資料裡，不會畫出來）。
  // 萌可和公主維持原本的名稱和簡介。畫面、alt 文字都經過這裡，所以不會露出劇照的舊說明文字。
  function shown(item) {
    if (item.type === "still") return { name: "第 " + item.ep + " 集", blurb: "", intro: "" };
    return { name: item.name, blurb: item.blurb || "", intro: item.intro || "" };
  }
  function cardVisual(item) {
    var label = shown(item).name;
    if (!item.img) return placeholder(label);
    var img = el("img");
    img.alt = label;
    img.draggable = false;
    img.onerror = function () { if (img.parentNode) img.parentNode.replaceChild(placeholder(label), img); };
    img.src = item.img;
    return img;
  }

  // ---------- 主頁 ----------
  function s1Total() { return L.seasonItems("s1").length; }
  function renderHome() {
    var ts = now();
    var key = L.dayKey(ts);
    var day = state.days[key] || {};
    var d = new Date(key + "T12:00");
    $("today-label").textContent = "今天 " + (d.getMonth() + 1) + "月" + d.getDate() + "日 " + WEEKDAYS[d.getDay()];
    var complete = !L.currentSeasonId(state);
    var slotNow = L.slotOf(ts);
    var h = new Date(ts).getHours();
    var morningOver = slotNow !== "morning";            // 今天 12:00 之後（直到 04:00）
    var eveningStarted = slotNow === "evening";
    setSlot("slot-m", slotInfo(day.m, day.mc, slotNow === "morning", morningOver, false, complete));
    setSlot("slot-e", slotInfo(day.e, day.ec, eveningStarted, false, !eveningStarted, complete));
    $("home-hint").textContent = hintText(ts, day, complete, slotNow, h);
    var n = L.collectedIn(state, "s1").length, total = s1Total();
    $("home-count").textContent = n + " / " + total;
    $("home-bar").style.width = (100 * n / total) + "%";
  }
  // 時段狀態：得到卡片 / 已完成 / 現在可得 / 已錯過 / 未到時間
  function slotInfo(done, card, open, over, later, complete) {
    if (card) return { cls: "done", mark: "✓", sub: "得到卡片！", card: card };
    if (done) return { cls: "done", mark: "✓", sub: "已完成" };
    if (complete) return { cls: open ? "open" : "", mark: "○", sub: open ? "現在可以刷牙" : "" };
    if (open) return { cls: "open", mark: "○", sub: "刷牙得一張卡片" };
    if (over) return { cls: "missed", mark: "–", sub: "已錯過" };
    if (later) return { cls: "", mark: "○", sub: "下午五點開始" };
    return { cls: "", mark: "○", sub: "" };
  }
  function setSlot(id, info) {
    var s = $(id);
    ["done", "open", "missed"].forEach(function (c) { s.classList.toggle(c, info.cls === c); });
    s.querySelector(".slot-mark").textContent = info.mark;
    s.querySelector(".slot-sub").textContent = info.sub;
    s.setAttribute("data-card", info.card || "");
  }
  function hintText(ts, day, complete, slotNow, h) {
    if (complete) {
      if (L.isSeasonComplete(state, "s1")) return "恭喜集齊第一季！每天也要好好刷牙！";
      return "每天也要好好刷牙！";
    }
    var cards = L.cardsOnDay(day);
    if (slotNow === "morning") {
      if (day.mc) return "早上的卡片已經得到了！晚上五點後刷牙，可以再得到一張！";
      return "現在刷牙兩分鐘，就能得到一張卡片！";
    }
    if (slotNow === "evening") {
      if (day.ec) return cards >= 2 ? "今天的兩張卡片都得到了，明天再來吧！" : "晚上的卡片已經得到了！明天早上再來吧！";
      return day.mc ? "今天已經得到一張卡片！現在刷牙兩分鐘，可以再得到一張！" : "現在刷牙兩分鐘，就能得到一張卡片！";
    }
    // 12:00–17:00
    return day.mc ? "早上的卡片已經得到了！晚上五點後刷牙，可以再得到一張！"
                  : "早上的刷牙錯過了。晚上五點後刷牙，還可以得到一張卡片！";
  }
  $("home-collect").addEventListener("click", function () {
    if (L.isSeasonComplete(state, "s1")) go("celebrate"); else go("album");
  });
  $("btn-album").addEventListener("click", function () { go("album"); });
  $("btn-calendar").addEventListener("click", function () { go("calendar"); });
  $("btn-start").addEventListener("click", function () { music.gesture(); sound.unlock(); startBrush(); });

  // ---------- 主頁音樂 ----------
  // 在主頁循環播放目前季度的主題曲（比刷牙時小聲），家長一打開 App 就知道有沒有聲音。
  // iOS 只允許在使用者手勢內開始播放：顯示主頁時先試一次，被拒絕的話，輕觸主頁任何地方就會開始。
  function homeMusicOn() { return settings.homeMusic !== false; }
  function homeMusic() {
    if (current !== "home" || !$("parent").hidden || brush.running) return;
    if (homeMusicOn()) music.home(L.songFor(state, "home")); else music.stopHome();
  }
  // pointerdown 跟 touchend / click 都聽：iOS 以 touchend / click 作為可以播放聲音的手勢（重複呼叫不會重新播放）
  ["pointerdown", "touchend", "click"].forEach(function (ev) {
    $("screen-home").addEventListener(ev, function (e) {
      // 開始刷牙會自己處理音樂；畫冊、日曆會停止主頁音樂，不用先開始
      if (e.target.closest && e.target.closest("#btn-start, #btn-album, #btn-calendar, #home-collect")) return;
      if (current !== "home" || !$("parent").hidden || !homeMusicOn()) return;
      music.gesture();
      homeMusic();
    }, { passive: true });
  });

  // ---------- 聲音（Web Audio 合成，不需音效檔） ----------
  // 全個 App 共用一個 AudioContext（提示音和音樂的 GainNode 都用它）。
  // iOS workaround: after the phone is locked / the PWA is backgrounded, iOS may leave the context
  // 'interrupted' or 'suspended' and resume() never succeeds → total silence. renew() discards it and
  // creates a fresh one; music.gesture() (below) decides when to do that.
  var sound = (function () {
    var ctx = null;
    function create() {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      try { ctx = new C(); } catch (e) { ctx = null; }
      return ctx;
    }
    function get() {
      if (!ctx) create();
      if (ctx && ctx.state === "suspended") { try { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* ignore */ } }
      return ctx;
    }
    /** 棄用目前的 AudioContext（盡量 close()），建立新的 */
    function renew() {
      var old = ctx;
      ctx = null;
      if (old && old.state !== "closed") { try { var p = old.close(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* ignore */ } }
      return create();
    }
    function tone(freq, at, dur, type, vol) {
      var c = get(); if (!c) return;
      try {
        var t0 = c.currentTime + at;
        var o = c.createOscillator(), g = c.createGain();
        o.type = type || "sine";
        o.frequency.setValueAtTime(freq, t0);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(vol || 0.18, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g); g.connect(c.destination);
        o.start(t0); o.stop(t0 + dur + 0.05);
      } catch (e) { /* 已關閉的 context：保持安靜 */ }
    }
    return {
      context: get,
      /** 目前的 AudioContext（不建立、不 resume） */
      peek: function () { return ctx; },
      renew: renew,
      unlock: function () { var c = get(); if (c) tone(1, 0, 0.01, "sine", 0.0002); },
      // 播放音樂時提示音大聲一點（同時音樂會暫時降低音量）
      chime: function (loud) { var k = loud ? 1.7 : 1; tone(1046.5, 0, 0.5, "triangle", 0.16 * k); tone(1568, 0.14, 0.7, "triangle", 0.13 * k); },
      start: function () { tone(784, 0, 0.25, "triangle", 0.14); tone(1046.5, 0.12, 0.4, "triangle", 0.14); },
      // 預備倒數：每秒一下輕輕的「滴」（最後三秒稍微明亮），不會太吵
      tick: function (n) {
        if (n > 3) { tone(880, 0, 0.16, "sine", 0.05); tone(1760, 0, 0.07, "sine", 0.015); }
        else { tone(1174.66, 0, 0.2, "triangle", 0.075); tone(2349.3, 0, 0.08, "sine", 0.02); }
      },
      // 「開始刷牙！」：明亮的上行鐘聲
      go: function () {
        [783.99, 1046.5, 1318.5, 1567.98].forEach(function (f, i) { tone(f, i * 0.08, 0.45, "triangle", 0.11); });
        tone(2093, 0.32, 0.6, "sine", 0.06); tone(2637, 0.4, 0.5, "sine", 0.04);
      },
      fanfare: function () {
        [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone(f, i * 0.13, 0.35, "square", 0.07); tone(f, i * 0.13, 0.4, "triangle", 0.12); });
        [523.25, 659.25, 783.99, 1046.5].forEach(function (f) { tone(f, 0.6, 0.9, "triangle", 0.09); });
      },
      sparkle: function () { [1318.5, 1568, 2093, 2637, 3136].forEach(function (f, i) { tone(f, i * 0.07, 0.3, "sine", 0.08); }); }
    };
  })();

  // ---------- 音樂（<audio> 循環播放；有 Web Audio 時經 GainNode 控制音量和淡出） ----------
  // 兩種模式：「home」主頁背景音樂（較小聲、不淡出）；「brush」刷牙音樂（預備倒數開始、提示音時降低、最後 3 秒淡出）。
  // 主頁播放目前季度主題曲的純音樂版（songFor(state, "home")），刷牙播放有人聲的主題曲（songFor(state)）；
  // 同一個 <audio>，切換時在手勢內換 src（ensure()），Web Audio 的接駁不變。
  var music = (function () {
    var BASE = 0.55;       // 刷牙音樂音量（比滿音量低，讓提示音聽得清楚）
    var HOME = 0.3;        // 主頁音樂音量（比刷牙時小聲）
    var FADE_MS = 3000;    // 刷牙最後 3 秒淡出，2:00 剛好靜音（音量只看刷牙經過時間；預備倒數時 e = 0，保持正常音量）
    var DUCK = 0.45, DUCK_MS = 1400; // 提示音響起時音樂暫時降低
    var CHECK_MS = 400;    // 手勢後等 resume() 多久才判斷 AudioContext 壞了
    var el = null, gain = null, playing = false, mode = null, duckAt = -1e9, vol = -1, song = null, starts = 0;
    var plain = false;     // true：不再經 Web Audio（重建多次仍失敗時的後備；iOS 上音量不能調）
    var checkTimer = 0, streak = 0, rebuilds = 0;
    function ensure(sg) {
      if (!el) {
        el = document.createElement("audio");
        el.id = "brush-music";
        el.loop = true;
        el.preload = "auto";
        el.setAttribute("playsinline", "");
        el.setAttribute("webkit-playsinline", "");
        document.body.appendChild(el);
      }
      if (el.getAttribute("src") !== sg.src) el.setAttribute("src", sg.src);
      if (!gain && !plain) {
        // iOS 不理會 audio.volume，所以用 Web Audio 的 GainNode 控制音量；不支援時改用 volume（iOS 上 2:00 直接停止）
        // createMediaElementSource 每個 <audio> 只可以呼叫一次，所以換 AudioContext 時要換一個新的 <audio>（見 rebuild()）
        var c = sound.context();
        if (c && c.createMediaElementSource && c.createGain) {
          try {
            var src = c.createMediaElementSource(el);
            gain = c.createGain();
            gain.gain.value = 0;
            src.connect(gain); gain.connect(c.destination);
          } catch (e) { gain = null; }
        }
      }
    }
    /** 換新的 AudioContext，並以新的 <audio> 重新接上（保留播放位置） */
    function rebuild() {
      rebuilds++;
      streak++;
      if (streak > 2) plain = true; // 連續重建仍失敗：音樂改用普通 <audio> 播放
      var routed = !!gain, pos = 0;
      sound.renew();
      if (!el || !routed) return;   // 音樂沒有經舊的 context：只需換 context（提示音用）
      try { pos = el.currentTime || 0; } catch (e) { /* ignore */ }
      el.pause();
      el.removeAttribute("src");
      try { el.load(); } catch (e) { /* ignore */ }
      el.remove();
      el = null; gain = null; vol = -1;
      if (!song) return;
      ensure(song);
      try { el.currentTime = pos; } catch (e) { /* ignore */ }
      apply(target(), true);
    }
    function target() {
      if (mode === "home") return HOME;
      if (mode === "brush") return level(brushE());
      return 0;
    }
    function level(e) {
      var f = Math.max(0, Math.min(1, (L.BRUSH_MS - e) / FADE_MS));
      var d = (performance.now() - duckAt) < DUCK_MS ? DUCK : 1;
      return BASE * f * d;
    }
    var lastE = 0;
    function brushE() { return lastE; }
    function apply(v, now) {
      if (!el) return;
      if (gain) {
        try {
          var c = gain.context, p = gain.gain, t = c.currentTime;
          if (now) { p.cancelScheduledValues(t); p.setValueAtTime(v, t); }
          else if (Math.abs(v - vol) > 0.002) { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(v, t + 0.08); }
        } catch (e) { /* ignore */ }
      } else if (now || Math.abs(v - vol) > 0.002) { try { el.volume = v; } catch (e) { /* ignore */ } }
      vol = v;
    }
    function resumeCtx() {
      var c = sound.peek();
      if (c && c.state !== "running" && c.state !== "closed") { try { var p = c.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* ignore */ } }
    }
    function play() { if (!el) return; var p = el.play(); if (p && p.catch) p.catch(function () { /* 被瀏覽器拒絕時保持安靜，下次輕觸再試 */ }); }
    function session() {
      // iOS 17+：以「播放」類型輸出，靜音鍵開啟時仍會發聲（<audio> 播放本來就不受靜音鍵影響）
      try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* ignore */ }
    }
    /**
     * 每次想播放聲音的使用者手勢都呼叫（主頁輕觸、開始刷牙、我準備好了、輕觸刷牙畫面）。
     * iOS 鎖機後 AudioContext 可能變成 'interrupted' / 'suspended' 而 resume() 永遠不成功：
     *  - 'interrupted' / 'closed'：立即（仍在手勢內）換新的 context 和 <audio>；
     *  - 其他未在 'running'：先 resume()，CHECK_MS 後仍未 'running'（或 currentTime 沒有前進）就重建。
     * The check uses setTimeout (< 1 s) rather than the resume() promise because WebKit carries the
     * user-gesture token into short timers, so play() on the rebuilt <audio> is still allowed.
     */
    function gesture() {
      session();
      var c = sound.peek();
      if (c && (c.state === "closed" || c.state === "interrupted")) { rebuild(); c = sound.peek(); }
      else resumeCtx();
      if (playing && el && el.paused) play();
      if (c && !checkTimer) {
        var t0 = c.currentTime;
        checkTimer = setTimeout(function () {
          checkTimer = 0;
          if (sound.peek() !== c || document.visibilityState === "hidden") return;
          if (c.state !== "running" || c.currentTime <= t0) {
            rebuild();
            if (playing && el) play();
          } else streak = 0;
        }, CHECK_MS);
      }
    }
    return {
      gesture: gesture,
      /** 必須在「開始刷牙」的點擊裡呼叫（iOS 需要使用者手勢）；預備倒數時已經開始，2 分鐘開始時不會重新播放 */
      start: function (sg) {
        playing = false;
        mode = null;
        song = sg || song;
        if (!settings.music || !sg) { if (el) el.pause(); return; }
        ensure(sg);
        session();
        resumeCtx();
        try { el.currentTime = 0; } catch (e) { /* ignore */ }
        mode = "brush";
        playing = true;
        starts++;
        duckAt = -1e9;
        lastE = 0;
        apply(level(0), true);
        play();
      },
      /** 主頁背景音樂（循環、較小聲）；已在播放時不會重新開始。被瀏覽器拒絕時，下次輕觸主頁再試 */
      home: function (sg) {
        if (!sg) return;
        if (mode === "home" && playing && el && !el.paused) return;
        song = sg;
        ensure(sg);
        resumeCtx();
        mode = "home";
        playing = true;
        apply(HOME, true);
        play();
      },
      /** 離開主頁（畫冊 / 日曆 / 家長區）：暫停主頁音樂（保留位置，回來時繼續） */
      stopHome: function () {
        if (mode !== "home") return;
        playing = false; mode = null;
        if (el) { el.pause(); apply(0, true); }
      },
      pause: function () { if (playing && el) el.pause(); },
      resume: function () { if (playing && el) { resumeCtx(); if (el.paused) play(); } },
      /** 停止並回到開頭 */
      stop: function () {
        playing = false; mode = null;
        if (!el) return;
        el.pause();
        try { el.currentTime = 0; } catch (e) { /* ignore */ }
        apply(0, true);
      },
      update: function (e) { if (playing && mode === "brush") { lastE = e; apply(level(e)); } },
      duck: function () { if (playing && mode === "brush") duckAt = performance.now(); },
      active: function () { return playing; },
      mode: function () { return playing ? mode : null; },
      /** 測試用 */
      info: function () {
        var c = sound.peek();
        var base = { playing: playing, mode: playing ? mode : null, song: song && song.title, kind: song && song.kind, starts: starts, rebuilds: rebuilds, plain: plain,
          ctx: c ? c.state : null, audioEls: document.querySelectorAll("audio").length };
        if (!el) { base.exists = false; return base; }
        base.exists = true; base.src = el.getAttribute("src"); base.paused = el.paused; base.currentTime = el.currentTime; base.duration = el.duration;
        base.loop = el.loop; base.target = vol; base.gain = gain ? gain.gain.value : el.volume; base.webAudio = !!gain;
        base.routedCtx = gain ? gain.context.state : null; base.sameCtx = !!gain && gain.context === c;
        return base;
      }
    };
  })();

  // ---------- 螢幕常亮 ----------
  var wakeLock = null;
  function requestWake() {
    try {
      if ("wakeLock" in navigator && document.visibilityState === "visible") {
        navigator.wakeLock.request("screen").then(function (l) {
          if (brush.running && document.visibilityState === "visible") wakeLock = l;
          else { try { l.release(); } catch (e) { /* ignore */ } } // 已停止 / 已放到背景
        }).catch(function () {});
      }
    } catch (e) { /* ignore */ }
  }
  function releaseWake() {
    try { if (wakeLock) wakeLock.release(); } catch (e) { /* ignore */ }
    wakeLock = null;
  }

  // ---------- 刷牙計時（以 Date 計算，不靠累計 tick） ----------
  var RING_C = 2 * Math.PI * 96;
  $("ring-fg").style.strokeDasharray = RING_C;
  var SLIDE_MS = 10000; // 幻燈片：每 10 秒（刷牙時間）換一張
  var READY_MS = 10000; // 預備倒數 10 秒（不計入 2 分鐘）
  var brush = { running: false, phase: "", readyTs: 0, rAcc: 0, rSeg: null, readyNum: 0, startTs: 0, acc: 0, seg: null, zone: -1, raf: 0, iv: 0,
                plan: null, slides: [], slide: -1, finishTimer: 0, goTimer: 0, timeText: "" };
  var reducedMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var fx = window.MomokeBrushFx.create({ fx: $("brush-fx"), reduced: reducedMotion });
  window.addEventListener("resize", function () { fx.invalidate(); });

  /** 刷牙經過時間（預備倒數時為 0） */
  function elapsed() {
    if (brush.phase !== "brush") return 0;
    return brush.acc + (brush.seg != null ? (Date.now() - brush.seg) * SPEED : 0);
  }
  /** 預備倒數經過時間 */
  function readyElapsed() {
    return brush.rAcc + (brush.rSeg != null ? (Date.now() - brush.rSeg) * SPEED : 0);
  }
  function readyOn() { return settings.ready !== false; }

  // 倒數時預覽「這次會不會得到卡片、是哪一張」：在 state 的副本上計算，不保存（倒數時按停止不影響任何資料）。
  // 未有已決定的卡片時抽出的預覽卡記在記憶體，同一個進度下再按開始會是同一張，真正開始刷牙時才寫入 pending。
  var teaser = null;
  function progressKey() { return state.collected.map(function (c) { return c.id; }).join(","); }
  function previewPlan(ts) {
    var tmp = JSON.parse(JSON.stringify(state));
    if (!L.validPending(tmp) && teaser && teaser.key === progressKey()) tmp.pending = { id: teaser.id, n: tmp.collected.length };
    var p = L.planBrush(tmp, ts, Math.random);
    if (p.earn) teaser = { key: progressKey(), id: p.id };
    return p;
  }
  /** 倒數時以「倒數開始」和「預計開始刷牙」兩個時間中較有利的一個預覽（見 logic.js 的 brushStartTs） */
  function readyPreview() {
    var projected = now() + Math.max(0, READY_MS - readyElapsed()) / SPEED;
    return previewPlan(L.brushStartTs(state, brush.readyTs, projected));
  }
  function samePlan(a, b) { return !!a && !!b && a.earn === b.earn && a.id === b.id && a.reason === b.reason && a.slot === b.slot; }
  function startFx() {
    fx.start(brush.plan.earn ? { target: $("reveal"), foam: $("foam") } : { target: $("slide-frame"), foam: null });
  }

  /** 按「開始刷牙」（使用者手勢）：音樂、螢幕常亮從這裡開始；預備時間開啟時先倒數 10 秒 */
  function startBrush() {
    clearTimeout(brush.finishTimer);
    clearTimeout(brush.goTimer);
    var countdown = readyOn();
    brush.running = true;
    brush.phase = countdown ? "ready" : "brush";
    brush.readyTs = now();
    brush.rAcc = 0; brush.rSeg = Date.now(); brush.readyNum = 10;
    brush.acc = 0; brush.seg = null;
    brush.zone = -1;
    brush.slide = -1;
    brush.timeText = "";
    document.querySelectorAll(".tq").forEach(function (q) { q.classList.remove("active", "done"); });
    $("brush-paused").hidden = true;
    $("ready-paused").hidden = true;
    $("btn-stop").hidden = false;
    $("brush-time").textContent = "2:00";
    $("ring-fg").style.strokeDashoffset = RING_C;
    $("zone-text").textContent = "請刷" + ZONES[0];
    $("brush-bubble").textContent = CHEERS[0];
    var sb = $("screen-brush");
    sb.classList.remove("finished");
    sb.classList.toggle("ready", countdown);
    var rc = $("ready-count");
    rc.classList.remove("go");
    rc.hidden = !countdown;
    $("ready-num").textContent = "10";
    // 倒數時只是預覽（不保存）；沒有倒數時立即決定
    brush.plan = countdown ? readyPreview() : null;
    if (countdown) setupStage(brush.plan);
    go("brush");
    music.start(L.songFor(state));
    requestWake();
    if (countdown) {
      // 泡泡層在第一次畫面更新前就畫好（卡片不會先露出來）
      startFx();
      if (!brush.plan.earn && brush.slides.length) { showSlide(0); brush.slide = 0; }
      fx.ready(performance.now());
      popNum();
      sound.tick(10);
    } else {
      beginBrushing(false);
    }
    clearInterval(brush.iv);
    brush.iv = setInterval(step, 200);
    loop();
  }

  /** 倒數完畢 / 按「我準備好了」/ 沒有預備時間：真正開始 2 分鐘 */
  function beginBrushing(afterCountdown) {
    var startTs = now();
    // 時段和日子：倒數開始或真正開始刷牙，取對小朋友較有利的一個
    var ts = L.brushStartTs(state, brush.readyTs, startTs);
    if (!L.validPending(state) && L.canEarn(state, ts) && teaser && teaser.key === progressKey()) {
      state.pending = { id: teaser.id, n: state.collected.length }; // 倒數時預覽的那一張
    }
    var shown = brush.plan;
    // 開始時決定這次會不會得到卡片、是哪一張（保存在 localStorage；中途停止下次沿用）
    brush.plan = L.planBrush(state, ts, Math.random);
    save();
    brush.startTs = ts;
    brush.phase = "brush";
    brush.acc = 0;
    brush.seg = Date.now();
    brush.rSeg = null;
    $("ready-paused").hidden = true;
    $("screen-brush").classList.remove("ready");
    if (!samePlan(shown, brush.plan)) {
      // 預覽和真正的結果不同（例如在時段邊緣提早按「我準備好了」）：重新佈置卡片
      setupStage(brush.plan);
      startFx();
    }
    fx.render(0, performance.now());
    if (afterCountdown) {
      sound.go(); music.duck(); showGo(); fx.pop(true);
    } else {
      $("ready-count").hidden = true;
      sound.start();
    }
    tick();
  }

  function popNum() {
    var b = $("ready-bubble");
    b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop");
  }
  function showGo() {
    var rc = $("ready-count");
    rc.hidden = false;
    rc.classList.remove("go"); void rc.offsetWidth; rc.classList.add("go");
    $("ready-num").textContent = "開始刷牙！";
    popNum();
    clearTimeout(brush.goTimer);
    brush.goTimer = setTimeout(hideReady, 1500);
  }
  function hideReady() {
    clearTimeout(brush.goTimer);
    var rc = $("ready-count");
    rc.hidden = true; rc.classList.remove("go");
  }
  function readyTick() {
    var re = readyElapsed();
    if (re >= READY_MS) { beginBrushing(true); return; }
    var n = Math.max(1, Math.min(10, Math.ceil((READY_MS - re) / 1000)));
    if (n !== brush.readyNum) {
      brush.readyNum = n;
      $("ready-num").textContent = String(n);
      popNum();
      sound.tick(n);
      fx.pop(false);
    }
    music.update(0);
  }
  function step() {
    if (!brush.running) return;
    if (brush.phase === "ready") readyTick(); else tick();
  }
  $("btn-ready").addEventListener("click", function () {
    if (!brush.running || brush.phase !== "ready") return;
    music.gesture();
    music.resume();
    beginBrushing(true);
  });

  function setupStage(plan) {
    var reveal = $("reveal"), show = $("slideshow"), cap = $("brush-caption");
    brush.slide = -1;
    var stage = $("brush-stage");
    if (plan.earn) {
      var item = L.byId[plan.id];
      reveal.hidden = false; show.hidden = true;
      reveal.classList.toggle("wide", item.type === "still");
      reveal.setAttribute("data-id", item.id);
      var box = $("reveal-img");
      box.innerHTML = "";
      var v = cardVisual(item);
      if (v.tagName === "IMG") v.alt = ""; // 未揭曉前不讀出名字
      box.appendChild(v);
      stage.setAttribute("data-mode", "reveal");
      cap.textContent = "把泡泡刷走，就能得到這張卡片！";
    } else {
      reveal.hidden = true; show.hidden = false;
      stage.setAttribute("data-mode", "slideshow");
      var have = L.collectedSet(state);
      // 已收集的卡片：最近得到的先播，其餘隨機
      var list = state.collected.map(function (c) { return L.byId[c.id]; }).filter(Boolean).reverse();
      var rest = list.slice(1);
      for (var i = rest.length - 1; i > 0; i--) { var k = Math.floor(Math.random() * (i + 1)); var t = rest[i]; rest[i] = rest[k]; rest[k] = t; }
      brush.slides = list.length ? [list[0]].concat(rest) : [];
      var msg = plan.reason === "outside" ? "現在不是刷牙時段，不會得到卡片。"
              : plan.reason === "already" ? (plan.slot === "morning" ? "今天早上已經得到卡片了！" : "今天晚上已經得到卡片了！")
              : "你已經集齊所有卡片了！";
      cap.textContent = msg + (brush.slides.length ? "\n一起看看你的收藏吧！" : "");
      show.classList.toggle("empty", !brush.slides.length);
      if (!brush.slides.length) {
        var f = $("slide-frame");
        f.innerHTML = "";
        f.className = "slide-frame friendly";
        f.appendChild(el("span", "friendly-emoji", "🪥✨"));
        f.appendChild(el("span", "friendly-text", "在早上或晚上的刷牙時段刷牙，就能收集萌可卡片！"));
        $("slide-name").textContent = "";
      }
    }
  }
  function showSlide(i) {
    if (!brush.slides.length) return;
    var item = brush.slides[i % brush.slides.length];
    var f = $("slide-frame");
    f.className = "slide-frame" + (item.type === "still" ? " wide" : "");
    f.innerHTML = "";
    f.setAttribute("data-id", item.id);
    f.appendChild(cardVisual(item));
    void f.offsetWidth; f.classList.add("in");
    $("slide-name").textContent = shown(item).name;
    fx.invalidate();
  }
  function loop() {
    cancelAnimationFrame(brush.raf);
    brush.raf = requestAnimationFrame(function (t) {
      if (!brush.running) return;
      step();
      if (!brush.running) return;
      if (brush.phase === "ready") fx.ready(t); else fx.render(Math.min(elapsed(), L.BRUSH_MS), t);
      loop();
    });
  }
  function stopTimers() {
    brush.running = false;
    clearInterval(brush.iv);
    cancelAnimationFrame(brush.raf);
    releaseWake();
  }
  function tick() {
    if (!brush.running) return;
    var e = Math.min(elapsed(), L.BRUSH_MS);
    var remain = Math.ceil((L.BRUSH_MS - e) / 1000);
    var tt = Math.floor(remain / 60) + ":" + ("0" + (remain % 60)).slice(-2);
    if (tt !== brush.timeText) { brush.timeText = tt; $("brush-time").textContent = tt; }
    music.update(e);
    $("ring-fg").style.strokeDashoffset = RING_C * (1 - e / L.BRUSH_MS);
    var z = Math.min(3, Math.floor(e / L.ZONE_MS));
    if (z !== brush.zone && e < L.BRUSH_MS) {
      if (brush.zone >= 0) { sound.chime(music.active()); music.duck(); }
      brush.zone = z;
      var zt = $("zone-text");
      zt.textContent = "請刷" + ZONES[z];
      zt.classList.remove("flash"); void zt.offsetWidth; zt.classList.add("flash");
      $("brush-bubble").textContent = CHEERS[z];
      document.querySelectorAll(".tq").forEach(function (q) {
        var i = Number(q.getAttribute("data-q"));
        q.classList.toggle("active", i === z);
        q.classList.toggle("done", i < z);
      });
    }
    if (!brush.plan.earn) {
      var si = Math.floor(e / SLIDE_MS);
      if (si !== brush.slide && e < L.BRUSH_MS) { brush.slide = si; showSlide(si); }
    }
    if (e >= L.BRUSH_MS) completeBrush();
  }
  function cancelBrush() {
    stopTimers(); clearTimeout(brush.finishTimer); music.stop(); fx.stop();
    brush.phase = ""; hideReady(); $("screen-brush").classList.remove("ready");
  }
  $("btn-stop").addEventListener("click", function () { cancelBrush(); go("home"); });

  document.addEventListener("visibilitychange", function () {
    if (brush.running) {
      var ready = brush.phase === "ready";
      if (document.visibilityState === "hidden") {
        // 預備倒數和刷牙計時一樣會暫停
        if (ready) { brush.rAcc = readyElapsed(); brush.rSeg = null; $("ready-paused").hidden = false; }
        else { brush.acc = elapsed(); brush.seg = null; $("brush-paused").hidden = false; }
        music.pause();
        releaseWake();
      } else {
        if (ready) {
          if (brush.rSeg == null) brush.rSeg = Date.now();
          $("ready-paused").hidden = true;
          // 暫停了一段時間後，預計開始刷牙的時間可能不同：需要時重新佈置卡片
          var p = readyPreview();
          if (!samePlan(p, brush.plan)) {
            brush.plan = p; setupStage(p); startFx();
            if (!p.earn && brush.slides.length) { showSlide(0); brush.slide = 0; }
          }
        } else {
          if (brush.seg == null) brush.seg = Date.now();
          $("brush-paused").hidden = true;
        }
        music.resume();
        requestWake();
        loop();
        step();
      }
    } else if (current === "home") {
      // 主頁音樂：放到背景時暫停；回到前景時再試（iOS 上可能要再輕觸一下主頁）
      if (document.visibilityState === "hidden") music.pause();
      else { renderHome(); homeMusic(); }
    }
  });
  window.addEventListener("pageshow", function (e) { if (e.persisted && current === "home") homeMusic(); });

  // iOS 有時會在回到前景後暫停 AudioContext：刷牙時輕觸畫面就會恢復音樂（需要時重建 AudioContext）
  ["pointerdown", "touchend"].forEach(function (ev) {
    $("screen-brush").addEventListener(ev, function () { if (brush.running) { music.gesture(); music.resume(); } }, { passive: true });
  });

  function completeBrush() {
    stopTimers();
    hideReady();
    music.stop();      // 已在最後 3 秒淡出
    fx.finish();       // 泡泡全部刷走 + 星星
    document.querySelectorAll(".tq").forEach(function (q) { q.classList.remove("active"); q.classList.add("done"); });
    sound.fanfare();
    var res = L.recordBrush(state, brush.startTs, now(), Math.random);
    save();
    $("zone-text").textContent = "完成了！";
    $("brush-bubble").textContent = "刷得真好！";
    $("screen-brush").classList.add("finished"); // 停止按鈕以 visibility 隱藏，版面不會跳動
    if (res.kind === "capture") {
      // 卡片完全揭開，停一下讓她看清楚，然後播放捕捉動畫
      brush.finishTimer = setTimeout(function () { showCapture(res, { revealed: true }); }, 1400);
    } else {
      brush.finishTimer = setTimeout(function () { showResult(res); }, 500);
    }
  }

  // ---------- 結果 ----------
  function showResult(res) {
    var title = "刷得真棒！", msg = "", emoji = "🎉";
    switch (res.kind) {
      case "again":
        title = "刷得真乾淨！";
        msg = res.slot === "morning" ? "今天早上已經得到卡片了，再刷一次也很棒！晚上五點後刷牙，可以再得到一張。"
                                     : "今天晚上已經得到卡片了，再刷一次也很棒！明天早上再來吧！";
        emoji = "✨"; break;
      case "all-done":
        title = res.slot === "morning" ? "早上完成！" : "晚上完成！";
        msg = "你已經集齊所有卡片了，繼續保持好習慣！";
        emoji = res.slot === "morning" ? "☀️" : "🌙"; break;
      case "outside":
        title = "刷得真棒！";
        msg = "不過現在不是刷牙時段，這次不會得到卡片。早上四點至中午十二點、下午五點至凌晨四點刷牙，每次都能得到一張卡片。";
        emoji = "👍"; break;
    }
    $("result-emoji").textContent = emoji;
    $("result-title").textContent = title;
    $("result-msg").textContent = msg;
    go("result");
  }
  $("btn-result-home").addEventListener("click", function () { go("home"); });

  // ---------- 捕捉動畫 ----------
  var pendingCelebrate = false;
  var captureTimers = [];
  function makeSparkles(box, count) {
    box.innerHTML = "";
    var chars = ["✨", "⭐", "💖", "🌟", "💫"];
    for (var i = 0; i < count; i++) {
      var s = el("span", "", chars[i % chars.length]);
      // 星星放在四周，避免蓋住文字
      var edgeX = Math.random() < 0.5;
      s.style.left = (edgeX ? (Math.random() < 0.5 ? Math.random() * 12 : 84 + Math.random() * 10) : Math.random() * 92) + "%";
      s.style.top = (edgeX ? Math.random() * 92 : (Math.random() < 0.5 ? Math.random() * 10 : 86 + Math.random() * 8)) + "%";
      s.style.animationDelay = (Math.random() * 1.8) + "s";
      s.style.fontSize = (18 + Math.random() * 22) + "px";
      box.appendChild(s);
    }
  }
  var captureQueue = [];
  function showCapture(res, opts) {
    opts = opts || {};
    var item = res.item;
    captureTimers.forEach(clearTimeout); captureTimers = [];
    pendingCelebrate = pendingCelebrate || !!res.seasonComplete;
    var card = $("flip-card");
    card.classList.remove("go", "revealed", "instant", "popin");
    card.classList.toggle("wide", item.type === "still");
    var note = res.migrated ? "新規則：每次刷牙都能得到一張卡片！今天" + (res.slot === "morning" ? "早上" : "晚上") + "的刷牙補送你這張卡片。" : "";
    $("capture-note").textContent = note;
    $("capture-note").hidden = !note;
    $("capture-info").classList.remove("show");
    $("capture-title").textContent = item.type === "momoke" ? "萌可出現了！" : "新卡片出現了！";
    var front = $("capture-front");
    front.innerHTML = "";
    front.appendChild(cardVisual(item));
    var total = L.seasonItems(item.season).length;
    $("capture-number").textContent = "第 " + res.number + " 張 / " + total + " 張";
    var sh = shown(item);
    $("capture-name").textContent = sh.name;
    $("capture-name").classList.toggle("long", sh.name.length > 6);
    $("capture-blurb").textContent = sh.blurb;
    $("capture-blurb").hidden = !sh.blurb;
    $("capture-intro").textContent = sh.intro;
    $("capture-intro").hidden = !sh.intro;
    $("btn-capture-done").textContent = captureQueue.length ? "下一張" : (pendingCelebrate ? "太棒了！" : "放進畫冊");
    makeSparkles($("sparkles"), 22);
    go("capture");
    void card.offsetWidth;
    function revealNow() {
      card.classList.remove("go");
      card.classList.add("revealed");
      var b = el("div", "burst"); $("screen-capture").appendChild(b);
      setTimeout(function () { b.remove(); }, 1100);
      sound.sparkle();
      $("capture-title").textContent = item.type === "momoke" ? "成功捕捉萌可！" : "獲得新卡片！";
    }
    if (opts.revealed) {
      // 刷牙時已經揭開了：卡片直接以正面出現
      card.classList.add("instant", "revealed", "popin");
      captureTimers.push(setTimeout(revealNow, 350));
      captureTimers.push(setTimeout(function () { $("capture-info").classList.add("show"); }, 1100));
    } else {
      card.classList.add("go");
      captureTimers.push(setTimeout(revealNow, 1900));
      captureTimers.push(setTimeout(function () { $("capture-info").classList.add("show"); }, 2800));
    }
  }
  $("btn-capture-done").addEventListener("click", function () {
    if (captureQueue.length) { showCapture(captureQueue.shift()); return; }
    if (pendingCelebrate) { pendingCelebrate = false; showCelebrate(); }
    else go("home");
  });
  /** 轉換舊資料 / 匯入時補發的卡片：逐張播放捕捉動畫 */
  function playGrants(list) {
    if (!list || !list.length) return false;
    captureQueue = list.slice(1);
    showCapture(list[0]);
    return true;
  }
  function showCelebrate() {
    var s1 = L.season("s1"), s2 = L.season("s2");
    $("celebrate-title").textContent = s1.completeTitle || "恭喜集齊第一季！";
    $("celebrate-next").textContent = (s2 && !s2.open) ? (s2.lockedText || "第二季 敬請期待") : "第二季開放了！";
    makeSparkles($("celebrate-sparkles"), 26);
    sound.fanfare();
    go("celebrate");
    // 第二季掛鉤：之後在這裡加入「鬧鬧萌可變成幸福萌可」的動畫（見 README）。
  }

  // ---------- 畫冊 ----------
  var albumTab = "momoke";
  var TAB_NAMES = { momoke: "萌可", princess: "公主", still: "劇照" };
  function tabItems(tab) { return L.seasonItems("s1").filter(function (it) { return it.type === tab; }); }
  function renderAlbum() {
    var have = L.collectedSet(state);
    var s1n = L.collectedIn(state, "s1").length;
    $("album-season").textContent = "第一季 " + s1n + " / " + s1Total();
    document.querySelectorAll(".tab").forEach(function (t) {
      var tab = t.getAttribute("data-tab");
      var items = tabItems(tab);
      var n = items.filter(function (it) { return have[it.id]; }).length;
      t.classList.toggle("active", tab === albumTab);
      t.setAttribute("aria-selected", tab === albumTab ? "true" : "false");
      t.innerHTML = "";
      t.appendChild(document.createTextNode(TAB_NAMES[tab] + " "));
      t.appendChild(el("small", "", n + "/" + items.length));
    });
    var grid = $("album-grid");
    grid.innerHTML = "";
    grid.classList.toggle("grid-still", albumTab === "still");
    tabItems(albumTab).forEach(function (it) {
      var got = !!have[it.id];
      var c = el("button", "cell" + (got ? "" : " locked"));
      c.type = "button";
      var box = el("div", "cell-img");
      if (got) box.appendChild(cardVisual(it)); else box.textContent = "？";
      c.appendChild(box);
      c.appendChild(el("div", "cell-name", got ? shown(it).name : "？？？"));
      if (got) {
        c.setAttribute("data-id", it.id);
        c.addEventListener("click", function () { openViewer(albumTab, it.id); });
      }
      grid.appendChild(c);
    });
  }
  document.querySelectorAll(".tab").forEach(function (t) {
    t.addEventListener("click", function () { albumTab = t.getAttribute("data-tab"); renderAlbum(); });
  });

  // ---------- 全螢幕卡片 + 左右滑動 ----------
  var viewer = { list: [], idx: 0 };
  function openViewer(tab, id) {
    var have = L.collectedSet(state);
    viewer.list = tabItems(tab).filter(function (it) { return have[it.id]; });
    viewer.idx = Math.max(0, viewer.list.findIndex(function (it) { return it.id === id; }));
    $("viewer").hidden = false;
    renderViewer();
  }
  function renderViewer() {
    var it = viewer.list[viewer.idx];
    if (!it) return;
    var card = $("viewer-card");
    card.innerHTML = "";
    card.classList.toggle("wide", it.type === "still");
    card.appendChild(cardVisual(it));
    $("viewer-type").textContent = TYPE_LABEL[it.category || it.type] || "";
    var sh = shown(it);
    $("viewer-name").textContent = sh.name;
    $("viewer-name").classList.toggle("long", sh.name.length > 6);
    $("viewer-blurb").textContent = sh.blurb;
    $("viewer-blurb").hidden = !sh.blurb;
    $("viewer-intro").textContent = sh.intro;
    $("viewer-intro").hidden = !sh.intro;
    $("viewer-count").textContent = (viewer.idx + 1) + " / " + viewer.list.length;
    $("viewer-prev").disabled = viewer.idx <= 0;
    $("viewer-next").disabled = viewer.idx >= viewer.list.length - 1;
  }
  function stepViewer(d) {
    var ni = viewer.idx + d;
    if (ni < 0 || ni >= viewer.list.length) return;
    var stage = $("viewer-stage");
    stage.classList.add(d > 0 ? "slide-l" : "slide-r");
    setTimeout(function () {
      viewer.idx = ni;
      renderViewer();
      stage.classList.remove("slide-l", "slide-r");
    }, 160);
  }
  $("viewer-prev").addEventListener("click", function () { stepViewer(-1); });
  $("viewer-next").addEventListener("click", function () { stepViewer(1); });
  $("viewer-close").addEventListener("click", function () { $("viewer").hidden = true; });
  document.addEventListener("keydown", function (e) {
    if ($("viewer").hidden) return;
    if (e.key === "ArrowLeft") stepViewer(-1);
    else if (e.key === "ArrowRight") stepViewer(1);
    else if (e.key === "Escape") $("viewer").hidden = true;
  });
  (function swipe() {
    var v = $("viewer"), sx = 0, sy = 0, active = false;
    function start(x, y) { sx = x; sy = y; active = true; }
    function end(x, y) {
      if (!active) return;
      active = false;
      var dx = x - sx, dy = y - sy;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) stepViewer(dx < 0 ? 1 : -1);
    }
    v.addEventListener("touchstart", function (e) { var t = e.changedTouches[0]; start(t.clientX, t.clientY); }, { passive: true });
    v.addEventListener("touchend", function (e) { var t = e.changedTouches[0]; end(t.clientX, t.clientY); }, { passive: true });
    v.addEventListener("touchcancel", function () { active = false; });
    v.addEventListener("pointerdown", function (e) { if (e.pointerType === "mouse") start(e.clientX, e.clientY); });
    v.addEventListener("pointerup", function (e) { if (e.pointerType === "mouse") end(e.clientX, e.clientY); });
  })();

  // ---------- 日曆 ----------
  var calMonth = null; // Date（該月 1 日）
  function renderCalendar() {
    var todayKey = L.dayKey(now());
    if (!calMonth) { var td = new Date(todayKey + "T12:00"); calMonth = new Date(td.getFullYear(), td.getMonth(), 1); }
    var y = calMonth.getFullYear(), m = calMonth.getMonth();
    $("cal-title").textContent = y + "年" + (m + 1) + "月";
    var grid = $("cal-grid");
    grid.innerHTML = "";
    var first = new Date(y, m, 1).getDay();
    var days = new Date(y, m + 1, 0).getDate();
    for (var i = 0; i < first; i++) grid.appendChild(el("div", "cal-day empty"));
    var caps = 0, brushed = 0;
    for (var d = 1; d <= days; d++) {
      var key = L.ymd(new Date(y, m, d));
      var rec = state.days[key] || {};
      var c = el("div", "cal-day");
      c.setAttribute("data-day", key);
      if (key === todayKey) c.classList.add("today");
      if (key > todayKey) c.classList.add("future");
      var nCards = L.cardsOnDay(rec);
      if (nCards) { c.classList.add("captured"); caps += nCards; }
      if (rec.m || rec.e) brushed++;
      c.appendChild(el("span", "dnum", String(d)));
      c.appendChild(el("span", "marks", (rec.m ? "☀️" : "") + (rec.e ? "🌙" : "")));
      if (nCards) c.appendChild(el("span", "star", nCards === 2 ? "⭐⭐" : "⭐"));
      grid.appendChild(c);
    }
    $("cal-summary").textContent = caps ? "這個月得到了 " + caps + " 張卡片！" : (brushed ? "這個月有 " + brushed + " 天刷牙！" : "早上和晚上刷牙，每次都能得到一顆星星！");
  }
  $("cal-prev").addEventListener("click", function () { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); renderCalendar(); });
  $("cal-next").addEventListener("click", function () { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); renderCalendar(); });

  // ---------- 家長區（長按標題 3 秒） ----------
  (function longPress() {
    var title = $("app-title"), timer = 0;
    function clear() { clearTimeout(timer); timer = 0; }
    title.addEventListener("pointerdown", function (e) {
      clear();
      timer = setTimeout(function () { timer = 0; openParent(); }, 3000);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { title.addEventListener(ev, clear); });
    title.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  })();
  function openParent() {
    var days = Object.keys(state.days).filter(function (k) { var d = state.days[k]; return d.m || d.e; }).length;
    $("parent-info").textContent = "已收集 " + L.collectedIn(state, "s1").length + " / " + s1Total() + " 張卡片，共有 " + days + " 天的刷牙紀錄。";
    renderMusicToggle();
    renderHomeMusicToggle();
    renderReadyToggle();
    $("parent").hidden = false;
    music.stopHome();
  }
  function renderMusicToggle() {
    var on = settings.music, sg = L.songFor(state);
    $("toggle-music").setAttribute("aria-checked", on ? "true" : "false");
    $("toggle-music-text").textContent = on ? "開" : "關";
    $("music-note").textContent = on ? "刷牙時會播放主題曲" + (sg && sg.title ? "《" + sg.title + "》" : "") + "（預備倒數時已經開始），刷牙最後三秒慢慢變小聲。"
                                     : "刷牙時不播放音樂（仍有提示音）。";
  }
  function renderHomeMusicToggle() {
    var on = homeMusicOn(), sg = L.songFor(state, "home");
    $("toggle-home-music").setAttribute("aria-checked", on ? "true" : "false");
    $("toggle-home-music-text").textContent = on ? "開" : "關";
    var name = sg && sg.title ? "《" + sg.title + "》" + (sg.instrumental ? "純音樂版（沒有人聲）" : "") : "主題曲";
    $("home-music-note").textContent = on ? "在主頁小聲循環播放" + name + "，一打開就知道有沒有聲音（iPhone 上可能要先輕觸畫面一下）。"
                                          : "主頁不播放音樂。";
  }
  $("toggle-home-music").addEventListener("click", function () {
    if (homeMusicOn()) settings.homeMusic = false; else delete settings.homeMusic;
    saveSettings();
    renderHomeMusicToggle();
  });
  function renderReadyToggle() {
    var on = readyOn();
    $("toggle-ready").setAttribute("aria-checked", on ? "true" : "false");
    $("toggle-ready-text").textContent = on ? "開" : "關";
    $("ready-note").textContent = on ? "按「開始刷牙」後先倒數十秒，讓小朋友準備好牙刷和牙膏（不計入兩分鐘）。"
                                     : "按「開始刷牙」後立即開始計時。";
  }
  $("toggle-ready").addEventListener("click", function () {
    if (readyOn()) settings.ready = false; else delete settings.ready;
    saveSettings();
    renderReadyToggle();
  });
  $("toggle-music").addEventListener("click", function () {
    settings.music = !settings.music;
    saveSettings();
    renderMusicToggle();
  });
  $("btn-parent-close").addEventListener("click", function () { $("parent").hidden = true; music.gesture(); homeMusic(); });
  $("btn-export").addEventListener("click", function () {
    var payload = { app: "momoke-brush", version: 2, exportedAt: new Date(now()).toISOString(), state: state, settings: settings };
    var json = JSON.stringify(payload, null, 2);
    var name = "萌可刷牙備份-" + L.dayKey(now()) + ".json";
    var blob = new Blob([json], { type: "application/json" });
    function download() {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    }
    try {
      var file = new File([blob], name, { type: "application/json" });
      if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
        navigator.share({ files: [file], title: name }).catch(function (err) { if (!err || err.name !== "AbortError") download(); });
        return;
      }
    } catch (e) { /* fall through */ }
    download();
  });
  $("btn-import").addEventListener("click", function () { $("import-file").value = ""; $("import-file").click(); });
  $("import-file").addEventListener("change", function () {
    var f = this.files && this.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      var m = null, obj = null;
      // 新舊格式的備份都可以匯入（舊格式會自動轉換）
      try { obj = JSON.parse(r.result); m = L.migrateState(obj && obj.state ? obj.state : obj, now(), Math.random); } catch (e) { m = null; }
      if (!m) { alert("備份檔案格式不正確，無法匯入。"); return; }
      var s = m.state;
      if (!confirm("匯入後會取代目前的資料（備份內有 " + s.collected.length + " 張卡片），確定嗎？")) return;
      state = s; save();
      // 備份內有家長設定（刷牙音樂）就一併還原；舊備份沒有設定則保持目前設定
      if (obj && obj.settings && typeof obj.settings === "object") { settings = L.normalizeSettings(obj.settings); saveSettings(); }
      $("parent").hidden = true;
      alert("匯入完成！");
      if (!playGrants(m.granted)) go("home");
    };
    r.readAsText(f);
  });
  $("btn-reset").addEventListener("click", function () {
    if (!confirm("確定要刪除所有刷牙紀錄和已收集的卡片嗎？")) return;
    if (!confirm("真的要全部刪除嗎？刪除後無法復原。")) return;
    state = L.emptyState(); save();
    $("parent").hidden = true;
    go("home");
  });

  // ---------- 啟動 ----------
  // 版本標籤：數字來自 data.js 的 version（sw.js 的 VERSION 必須相同，tests/draw.test.js 會檢查）
  $("app-version").textContent = DATA.version || "";
  renderHome();
  if (!playGrants(migratedGrants)) homeMusic(); // 先試一次（iOS 通常會拒絕，輕觸主頁後就會開始）
  setInterval(function () { if (current === "home" && document.visibilityState === "visible") renderHome(); }, 60000);
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
  if (TEST) window.__momoke = { state: function () { return state; }, logic: L, go: go, elapsed: function () { return brush.running ? elapsed() : null; },
    phase: function () { return brush.running ? brush.phase : null; }, readyLeft: function () { return brush.phase === "ready" ? READY_MS - readyElapsed() : null; },
    plan: function () { return brush.plan; }, startTs: function () { return brush.startTs; },
    music: function () { return music.info(); }, audioCtx: function () { return sound.peek(); }, settings: function () { return settings; }, foam: function () { return fx.coverage(); }, fx: function () { return fx.info(); } };
})();
