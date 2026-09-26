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

  // ---------- 畫面切換 ----------
  var current = "home";
  function go(name) {
    if (name !== "brush" && brush.running) cancelBrush();
    document.querySelectorAll(".screen").forEach(function (s) { s.classList.remove("active"); });
    $("screen-" + name).classList.add("active");
    current = name;
    window.scrollTo(0, 0);
    if (name === "home") renderHome();
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
  function cardVisual(item) {
    if (!item.img) return placeholder(item.name);
    var img = el("img");
    img.alt = item.name;
    img.draggable = false;
    img.onerror = function () { if (img.parentNode) img.parentNode.replaceChild(placeholder(item.name), img); };
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
  $("btn-start").addEventListener("click", function () { sound.unlock(); startBrush(); });

  // ---------- 聲音（Web Audio 合成，不需音效檔） ----------
  var sound = (function () {
    var ctx = null;
    function get() {
      if (!ctx) {
        var C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        try { ctx = new C(); } catch (e) { return null; }
      }
      if (ctx.state === "suspended") { try { ctx.resume(); } catch (e) { /* ignore */ } }
      return ctx;
    }
    function tone(freq, at, dur, type, vol) {
      var c = get(); if (!c) return;
      var t0 = c.currentTime + at;
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || "sine";
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.18, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t0); o.stop(t0 + dur + 0.05);
    }
    return {
      unlock: function () { var c = get(); if (c) tone(1, 0, 0.01, "sine", 0.0002); },
      chime: function () { tone(1046.5, 0, 0.5, "triangle", 0.16); tone(1568, 0.14, 0.7, "triangle", 0.13); },
      start: function () { tone(784, 0, 0.25, "triangle", 0.14); tone(1046.5, 0.12, 0.4, "triangle", 0.14); },
      fanfare: function () {
        [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone(f, i * 0.13, 0.35, "square", 0.07); tone(f, i * 0.13, 0.4, "triangle", 0.12); });
        [523.25, 659.25, 783.99, 1046.5].forEach(function (f) { tone(f, 0.6, 0.9, "triangle", 0.09); });
      },
      sparkle: function () { [1318.5, 1568, 2093, 2637, 3136].forEach(function (f, i) { tone(f, i * 0.07, 0.3, "sine", 0.08); }); }
    };
  })();

  // ---------- 螢幕常亮 ----------
  var wakeLock = null;
  function requestWake() {
    try {
      if ("wakeLock" in navigator && document.visibilityState === "visible") {
        navigator.wakeLock.request("screen").then(function (l) { wakeLock = l; }).catch(function () {});
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
  var brush = { running: false, startTs: 0, acc: 0, seg: null, zone: -1, raf: 0, iv: 0, plan: null, revealed: -1, slides: [], slide: -1, finishTimer: 0 };

  function elapsed() {
    return brush.acc + (brush.seg != null ? (Date.now() - brush.seg) * SPEED : 0);
  }
  function startBrush() {
    clearTimeout(brush.finishTimer);
    brush.running = true;
    brush.startTs = now();
    // 開始時決定這次會不會得到卡片、是哪一張（保存在 localStorage；中途停止下次沿用）
    brush.plan = L.planBrush(state, brush.startTs, Math.random);
    save();
    brush.acc = 0;
    brush.seg = Date.now();
    brush.zone = -1;
    brush.revealed = -1;
    brush.slide = -1;
    document.querySelectorAll(".tq").forEach(function (q) { q.classList.remove("active", "done"); });
    $("brush-paused").hidden = true;
    $("btn-stop").hidden = false;
    $("screen-brush").classList.remove("finished");
    setupStage(brush.plan);
    go("brush");
    sound.start();
    requestWake();
    tick();
    clearInterval(brush.iv);
    brush.iv = setInterval(tick, 200);
    loop();
  }

  function setupStage(plan) {
    var reveal = $("reveal"), show = $("slideshow"), cap = $("brush-caption");
    var stage = $("brush-stage");
    if (plan.earn) {
      var item = L.byId[plan.id];
      reveal.hidden = false; show.hidden = true;
      reveal.classList.toggle("wide", item.type === "still");
      reveal.setAttribute("data-id", item.id);
      reveal.setAttribute("data-revealed", "0");
      var box = $("reveal-img");
      box.innerHTML = "";
      var v = cardVisual(item);
      if (v.tagName === "IMG") v.alt = ""; // 未揭曉前不讀出名字
      box.appendChild(v);
      reveal.querySelectorAll(".cover").forEach(function (c) { c.classList.remove("open", "active"); });
      stage.setAttribute("data-mode", "reveal");
      cap.textContent = "刷完兩分鐘，就能得到這張卡片！";
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
    $("slide-name").textContent = item.name;
  }
  function updateReveal(n, z, done) {
    var reveal = $("reveal");
    if (n !== brush.revealed) {
      var prev = brush.revealed;
      brush.revealed = n;
      reveal.setAttribute("data-revealed", String(n));
      reveal.querySelectorAll(".cover").forEach(function (c) {
        var q = Number(c.getAttribute("data-q"));
        c.classList.toggle("open", q < n);
      });
      if (prev >= 0 && n > prev) { sound.sparkle(); }
    }
    reveal.querySelectorAll(".cover").forEach(function (c) {
      c.classList.toggle("active", !done && Number(c.getAttribute("data-q")) === z);
    });
  }
  function loop() {
    cancelAnimationFrame(brush.raf);
    brush.raf = requestAnimationFrame(function () { if (brush.running) { tick(); loop(); } });
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
    $("brush-time").textContent = Math.floor(remain / 60) + ":" + ("0" + (remain % 60)).slice(-2);
    $("ring-fg").style.strokeDashoffset = RING_C * (1 - e / L.BRUSH_MS);
    var z = Math.min(3, Math.floor(e / L.ZONE_MS));
    if (z !== brush.zone && e < L.BRUSH_MS) {
      if (brush.zone >= 0) sound.chime();
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
    if (brush.plan && brush.plan.earn) {
      // 每刷完一個位置（30 秒）揭開卡片的四分之一：上左、上右、下左、下右
      updateReveal(Math.min(4, Math.floor(e / L.ZONE_MS)), z, e >= L.BRUSH_MS);
    } else {
      var si = Math.floor(e / SLIDE_MS);
      if (si !== brush.slide && e < L.BRUSH_MS) { brush.slide = si; showSlide(si); }
    }
    if (e >= L.BRUSH_MS) completeBrush();
  }
  function cancelBrush() { stopTimers(); clearTimeout(brush.finishTimer); }
  $("btn-stop").addEventListener("click", function () { cancelBrush(); go("home"); });

  document.addEventListener("visibilitychange", function () {
    if (brush.running) {
      if (document.visibilityState === "hidden") {
        brush.acc = elapsed();
        brush.seg = null;
        $("brush-paused").hidden = false;
        releaseWake();
      } else {
        if (brush.seg == null) brush.seg = Date.now();
        $("brush-paused").hidden = true;
        requestWake();
        loop();
        tick();
      }
    } else if (document.visibilityState === "visible" && current === "home") {
      renderHome();
    }
  });

  function completeBrush() {
    stopTimers();
    document.querySelectorAll(".tq").forEach(function (q) { q.classList.remove("active"); q.classList.add("done"); });
    sound.fanfare();
    var res = L.recordBrush(state, brush.startTs, now(), Math.random);
    save();
    $("zone-text").textContent = "完成了！";
    $("brush-bubble").textContent = "刷得真好！";
    $("btn-stop").hidden = true;
    $("screen-brush").classList.add("finished");
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
    $("capture-name").textContent = item.name;
    $("capture-name").classList.toggle("long", item.name.length > 6);
    $("capture-blurb").textContent = item.blurb || "";
    $("capture-blurb").hidden = !item.blurb;
    $("capture-intro").textContent = item.intro || "";
    $("capture-intro").hidden = !item.intro;
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
      c.appendChild(el("div", "cell-name", got ? it.name : "？？？"));
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
    $("viewer-name").textContent = it.name;
    $("viewer-name").classList.toggle("long", it.name.length > 6);
    $("viewer-blurb").textContent = it.blurb || "";
    $("viewer-intro").textContent = it.intro || "";
    $("viewer-intro").hidden = !it.intro;
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
    $("parent").hidden = false;
  }
  $("btn-parent-close").addEventListener("click", function () { $("parent").hidden = true; });
  $("btn-export").addEventListener("click", function () {
    var payload = { app: "momoke-brush", version: 2, exportedAt: new Date(now()).toISOString(), state: state };
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
      var m = null;
      // 新舊格式的備份都可以匯入（舊格式會自動轉換）
      try { var obj = JSON.parse(r.result); m = L.migrateState(obj && obj.state ? obj.state : obj, now(), Math.random); } catch (e) { m = null; }
      if (!m) { alert("備份檔案格式不正確，無法匯入。"); return; }
      var s = m.state;
      if (!confirm("匯入後會取代目前的資料（備份內有 " + s.collected.length + " 張卡片），確定嗎？")) return;
      state = s; save();
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
  renderHome();
  playGrants(migratedGrants);
  setInterval(function () { if (current === "home" && document.visibilityState === "visible") renderHome(); }, 60000);
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
  if (TEST) window.__momoke = { state: function () { return state; }, logic: L, go: go, elapsed: function () { return brush.running ? elapsed() : null; } };
})();
