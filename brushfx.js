/*
 * 萌可刷牙 — 刷牙動畫：泡泡層（canvas）＋ 牙刷 ＋ 小泡泡 ＋ 星星
 * 只畫簡單圖形（牙刷、泡泡、星星），不畫任何角色；角色只會出現在真正的卡片圖片裡。
 *
 * 進度完全由「刷牙經過的時間」決定（不靠逐格累積），所以暫停、放到背景、測試加速、改變畫面大小都不會出錯：
 *   卡片分成四區，跟刷牙提示同步：0–30 秒上排左邊、30–60 秒上排右邊、60–90 秒下排左邊、90–120 秒下排右邊。
 *   每區開頭 1.5 秒牙刷移到該區的起點，其餘 28.5 秒沿之字形路線刷走該區的泡泡；2:00 剛好全部刷走。
 *   路線上每隔幾個像素有一個圓形「刷走點」；經過時間 e 對應固定數目的刷走點，所以結果只取決於 e。
 * plan() / at() / counts() 是純函數，可在 Node 測試（tests/draw.test.js）。
 *
 * 預備倒數（ready / pop）：泡泡層蓋滿（不刷走），卡片四周慢慢升起小泡泡、閃閃的星光；每一秒數字跳出時灑一圈星星。
 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.MomokeBrushFx = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var BRUSH_MS = 120000, ZONE_MS = 30000, GLIDE = 0.05;
  // 牙刷柄的方向（弧度）：上左→右下、上右→左下、下左→右、下右→左
  var ANG = [0.75, Math.PI - 0.75, -0.3, Math.PI + 0.3];
  var TAU = Math.PI * 2;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hash(n) { var x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** w×h 卡片的刷牙路線：四區各一條之字形路線；stamps = [x0, y0, x1, y1, …]，radius(z, k) ≥ rMin */
  function plan(w, h) {
    var r = Math.max(6, Math.min(w, h) * 0.09);
    var rMin = r * 0.9;
    var step = Math.max(1.5, r * 0.22);
    var zones = [];
    for (var q = 0; q < 4; q++) {
      var qw = w / 2, qh = h / 2, qx = (q % 2) * qw, qy = Math.floor(q / 2) * qh;
      var x0 = qx + rMin * 0.55, x1 = qx + qw - rMin * 0.55;
      var y0 = qy + rMin * 0.6, y1 = qy + qh - rMin * 0.6;
      var rows = Math.max(2, Math.ceil((y1 - y0) / (rMin * 1.35)) + 1);
      var pts = [];
      for (var i = 0; i < rows; i++) {
        var y = y0 + (y1 - y0) * i / (rows - 1);
        if (i % 2 === 0) pts.push([x0, y], [x1, y]); else pts.push([x1, y], [x0, y]);
      }
      var st = [];
      for (var k = 0; k < pts.length - 1; k++) {
        var a = pts[k], b = pts[k + 1];
        var n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
        for (var j = 0; j < n; j++) st.push(a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n);
      }
      var last = pts[pts.length - 1];
      st.push(last[0], last[1]);
      zones.push({ x: qx, y: qy, w: qw, h: qh, stamps: st, n: st.length / 2 });
    }
    return { w: w, h: h, r: r, rMin: rMin, zones: zones };
  }
  function radius(P, z, k) { return P.r * (0.9 + 0.2 * hash(z * 100003 + k)); }

  /** 經過時間 e（毫秒）→ 目前區 q、區內進度 f、刷走進度 s（0–1）、移動進度 g（0–1） */
  function at(e) {
    e = clamp(e || 0, 0, BRUSH_MS);
    var q = Math.min(3, Math.floor(e / ZONE_MS));
    var f = (e - q * ZONE_MS) / ZONE_MS;
    return { q: q, f: f, s: f < GLIDE ? 0 : (f - GLIDE) / (1 - GLIDE), g: f < GLIDE ? f / GLIDE : 1, done: e >= BRUSH_MS };
  }
  /** 經過時間 e 時每區已刷走的點數 */
  function counts(P, e) {
    var a = at(e);
    return P.zones.map(function (Z, z) {
      if (a.done || z < a.q) return Z.n;
      if (z > a.q) return 0;
      return Math.min(Z.n, Math.floor(a.s * Z.n));
    });
  }

  // ---------------- 繪圖 ----------------
  function create(opt) {
    var fx = opt.fx, g = fx.getContext("2d");
    var reduced = !!opt.reduced;
    var foam = null, fc = null, target = null, P = null, dpr = 1;
    var box = { ox: 0, oy: 0, w: 0, h: 0 }, cw = 0, ch = 0;
    var done = [0, 0, 0, 0], cleared = false;
    var parts = [], lastT = 0, emitB = 0, emitS = 0, lastQ = -1, frameN = 0, needMeasure = true;
    var tailRaf = 0, lastE = 0;

    function measure() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cw = fx.clientWidth; ch = fx.clientHeight;
      var pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
      if (fx.width !== pw || fx.height !== ph) { fx.width = pw; fx.height = ph; }
      if (!target) { P = null; return; }
      var r = fx.getBoundingClientRect(), tr = target.getBoundingClientRect();
      var tw = target.clientWidth, th = target.clientHeight;
      // 以中心點計算位置（不受縮放動畫影響）；clientWidth 不含邊框 = 卡片內容範圍
      box.ox = tr.left + tr.width / 2 - tw / 2 - r.left;
      box.oy = tr.top + tr.height / 2 - th / 2 - r.top;
      if (!P || tw !== box.w || th !== box.h || (fc && (foam.width !== Math.round(tw * dpr) || foam.height !== Math.round(th * dpr)))) {
        box.w = tw; box.h = th;
        P = tw > 20 && th > 20 ? plan(tw, th) : null;
        if (fc && P) buildFoam();
      }
    }

    function buildFoam() {
      foam.width = Math.round(box.w * dpr); foam.height = Math.round(box.h * dpr);
      var w = box.w, h = box.h, rnd = rng(1219);
      fc.setTransform(dpr, 0, 0, dpr, 0, 0);
      fc.globalCompositeOperation = "source-over";
      var grd = fc.createLinearGradient(0, 0, w, h);
      grd.addColorStop(0, "#fff5fb"); grd.addColorStop(0.55, "#ffe2f1"); grd.addColorStop(1, "#ece2ff");
      fc.fillStyle = grd; fc.fillRect(0, 0, w, h);
      var i, x, y, rr, n = Math.round(w * h / 260);
      function bubble(x, y, rr, a) {
        fc.beginPath(); fc.arc(x, y, rr, 0, TAU);
        fc.fillStyle = "rgba(255,255,255," + a.toFixed(2) + ")"; fc.fill();
        fc.lineWidth = 1; fc.strokeStyle = "rgba(240,140,195,.38)"; fc.stroke();
        fc.beginPath(); fc.arc(x - rr * 0.35, y - rr * 0.38, rr * 0.26, 0, TAU);
        fc.fillStyle = "rgba(255,255,255,.95)"; fc.fill();
      }
      for (i = 0; i < n; i++) { x = rnd() * w; y = rnd() * h; rr = 4 + rnd() * rnd() * 16; bubble(x, y, rr, 0.5 + 0.4 * rnd()); }
      // 中間一個大「？」
      var fs = Math.round(Math.min(w, h) * 0.6);
      fc.font = "900 " + fs + 'px "PingFang TC", "Noto Sans CJK TC", "Noto Sans TC", sans-serif';
      fc.textAlign = "center"; fc.textBaseline = "middle";
      fc.lineWidth = Math.max(4, fs * 0.05); fc.strokeStyle = "rgba(255,255,255,.9)"; fc.lineJoin = "round";
      fc.strokeText("？", w / 2, h / 2);
      fc.fillStyle = "rgba(255,120,185,.62)"; fc.fillText("？", w / 2, h / 2);
      for (i = 0; i < n * 0.25; i++) { x = rnd() * w; y = rnd() * h; rr = 3 + rnd() * 7; bubble(x, y, rr, 0.35 + 0.3 * rnd()); }
      done = [0, 0, 0, 0]; cleared = false;
    }

    function eraseTo(c) {
      if (cleared) return;
      fc.save();
      fc.setTransform(dpr, 0, 0, dpr, 0, 0);
      fc.globalCompositeOperation = "destination-out";
      fc.fillStyle = "#000";
      fc.beginPath();
      var any = false;
      for (var z = 0; z < 4; z++) {
        var st = P.zones[z].stamps;
        for (var k = done[z]; k < c[z]; k++) {
          var x = st[2 * k], y = st[2 * k + 1], rr = radius(P, z, k);
          fc.moveTo(x + rr, y); fc.arc(x, y, rr, 0, TAU); any = true;
        }
        if (c[z] > done[z]) done[z] = c[z];
      }
      if (any) fc.fill();
      fc.restore();
    }
    function clearAll() {
      if (!fc || cleared) return;
      fc.setTransform(1, 0, 0, 1, 0, 0); fc.clearRect(0, 0, foam.width, foam.height); cleared = true;
    }

    function pointAt(z, u) {
      var Z = P.zones[z], idx = clamp(u, 0, 1) * (Z.n - 1), k = Math.floor(idx), t = idx - k;
      var st = Z.stamps, k2 = Math.min(Z.n - 1, k + 1);
      return [st[2 * k] + (st[2 * k2] - st[2 * k]) * t, st[2 * k + 1] + (st[2 * k2 + 1] - st[2 * k + 1]) * t];
    }
    function lerpAng(a, b, u) { var d = ((b - a + Math.PI * 3) % TAU) - Math.PI; return a + d * u; }
    function ease(u) { return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; }

    /** 牙刷位置（fx canvas 的 CSS 座標）；e 決定路線上的位置，t（真實時間）只用來做來回刷的小動作 */
    // 幻燈片（沒有泡泡層）：牙刷沿卡片邊框繞圈（每 15 秒一圈），不擋住卡片中間
    function edgePoint(u) {
      var w = box.w, h = box.h, L = 2 * (w + h), d = (((u % 1) + 1) % 1) * L;
      if (d < w) return [d, 0];
      if ((d -= w) < h) return [w, d];
      if ((d -= h) < w) return [w - d, h];
      return [0, h - (d - w)];
    }
    function edgePose(e, t) {
      var u = e / 15000, p = edgePoint(u), q = edgePoint(u - 0.04);
      var amp = P.r * (reduced ? 0.08 : 0.25), ph = t / 1000 * TAU * 3.2;
      return { x: box.ox + p[0] + amp * Math.sin(ph), y: box.oy + p[1] + amp * Math.cos(ph), ang: Math.atan2(q[1] - p[1], q[0] - p[0]) + 0.09 * Math.sin(ph), s: 0.8 };
    }
    function pose(e, t) {
      if (!fc) return edgePose(e, t);
      var a = at(e), z = a.q, p, ang;
      if (a.g < 1) {
        var from = z > 0 ? pointAt(z - 1, 1) : [box.w * 0.5, box.h * 0.8];
        var to = pointAt(z, 0), u = ease(a.g);
        p = [from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u];
        ang = lerpAng(z > 0 ? ANG[z - 1] : ANG[0], ANG[z], u);
      } else { p = pointAt(z, a.s); ang = ANG[z]; }
      var amp = P.r * (reduced ? 0.12 : 0.42), ph = t / 1000 * TAU * 3.2;
      return { x: box.ox + p[0] + amp * Math.sin(ph), y: box.oy + p[1] + amp * 0.22 * Math.sin(ph * 2), ang: ang + 0.09 * Math.sin(ph) };
    }

    function rrect(x, y, w, h, r) {
      g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    }
    function drawBrush(b) {
      var s = Math.sqrt(box.w * box.h) * 0.0036 * (b.s || 1);
      g.save();
      g.translate(b.x, b.y); g.rotate(b.ang);
      if (Math.cos(b.ang) < 0) g.scale(1, -1);
      g.scale(s, s);
      // 刷毛尖端在原點；刷頭在上方（-y），刷柄沿 +x
      g.lineJoin = "round";
      g.shadowColor = "rgba(90,53,112,.25)"; g.shadowBlur = 6; g.shadowOffsetY = 3;
      // 刷柄
      var hg = g.createLinearGradient(0, -34, 0, -16);
      hg.addColorStop(0, "#ffa3d2"); hg.addColorStop(1, "#b78bff");
      rrect(14, -32, 92, 16, 8); g.fillStyle = hg; g.fill();
      g.shadowColor = "transparent";
      g.lineWidth = 2.5; g.strokeStyle = "#fff"; g.stroke();
      // 刷柄上的小圓點
      g.fillStyle = "rgba(255,255,255,.85)";
      [40, 58, 76].forEach(function (x) { g.beginPath(); g.arc(x, -24, 3, 0, TAU); g.fill(); });
      // 刷頭
      rrect(-26, -34, 48, 14, 7); g.fillStyle = "#8fd6ff"; g.fill(); g.lineWidth = 2.5; g.strokeStyle = "#fff"; g.stroke();
      // 刷毛
      for (var i = 0; i < 7; i++) {
        rrect(-23 + i * 6.3, -21, 4.6, 17, 2);
        g.fillStyle = i % 2 ? "#d7f1ff" : "#ffffff"; g.fill();
        g.lineWidth = 1; g.strokeStyle = "rgba(95,184,255,.8)"; g.stroke();
      }
      // 刷毛上的泡泡
      [[-18, -2, 6], [-8, 1, 7.5], [3, -1, 6.5], [12, 1, 5], [-2, -7, 4]].forEach(function (c) {
        g.beginPath(); g.arc(c[0], c[1], c[2], 0, TAU);
        g.fillStyle = "rgba(255,255,255,.95)"; g.fill();
        g.lineWidth = 1.2; g.strokeStyle = "rgba(240,140,195,.6)"; g.stroke();
      });
      g.restore();
    }

    function spawn(kind, x, y, burst) {
      if (parts.length > 90) parts.shift();
      var r = P ? P.r : 20, life = kind === "b" ? 1.1 + Math.random() * 0.9 : 0.7 + Math.random() * 0.6;
      var sp = burst ? 40 + Math.random() * 70 : 0, an = Math.random() * TAU;
      parts.push({
        k: kind, x: x + (Math.random() - 0.5) * r * (burst ? 0.4 : 1.1), y: y + (Math.random() - 0.5) * r * 0.6,
        vx: burst ? Math.cos(an) * sp : (Math.random() - 0.5) * 30, vy: burst ? Math.sin(an) * sp - 20 : -18 - Math.random() * 30,
        r: kind === "b" ? (2.5 + Math.random() * 5.5) * r / 24 : (4 + Math.random() * 5) * r / 24,
        life: life, max: life, rot: Math.random() * TAU, c: Math.random() < 0.5 ? "#ffd54a" : (Math.random() < 0.5 ? "#ff8cc4" : "#b595ff")
      });
    }
    function burstAt(x, y, n) { for (var i = 0; i < n; i++) spawn(i % 3 ? "s" : "b", x, y, true); }
    function star(p, a) {
      var R = p.r * (0.8 + 0.3 * Math.sin((1 - p.life / p.max) * TAU * 2)), r2 = R * 0.45;
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.beginPath();
      for (var i = 0; i < 10; i++) { var rr = i % 2 ? r2 : R, an = i * Math.PI / 5 - Math.PI / 2; g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
      g.closePath(); g.globalAlpha = a; g.fillStyle = p.c; g.fill();
      g.lineWidth = 1; g.strokeStyle = "rgba(255,255,255,.9)"; g.stroke(); g.restore();
    }
    // 四角閃光（預備倒數時在卡片四周閃爍）：原地放大縮小
    function sparkle4(p, a) {
      var u = 1 - p.life / p.max, R = p.r * Math.sin(Math.PI * u), r2 = R * 0.26;
      if (R <= 0.3) return;
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot * 0.3); g.beginPath();
      for (var i = 0; i < 8; i++) { var rr = i % 2 ? r2 : R, an = i * Math.PI / 4 - Math.PI / 2; g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
      g.closePath(); g.globalAlpha = Math.min(1, a * 1.2); g.fillStyle = p.c; g.fill();
      g.lineWidth = 1; g.strokeStyle = "rgba(255,255,255,.95)"; g.stroke(); g.restore();
    }
    var SPARK_C = ["#ffd54a", "#ff8cc4", "#b595ff", "#ffffff"];
    /** 預備倒數的背景粒子：卡片底部慢慢升起的泡泡、卡片邊框附近的閃光 */
    function ambient(kind) {
      if (parts.length > 90) parts.shift();
      var r = P.r, life;
      if (kind === "b") {
        life = 2.4 + Math.random() * 1.8;
        parts.push({ k: "b", x: box.ox + Math.random() * box.w, y: box.oy + box.h + 6, vx: (Math.random() - 0.5) * 16, vy: -22 - Math.random() * 30,
          r: (3 + Math.random() * 6) * r / 24, life: life, max: life, rot: 0, c: "" });
      } else {
        var p = edgePoint(Math.random()), out = (Math.random() - 0.3) * 30;
        var cx = box.w / 2, cy = box.h / 2, dx = p[0] - cx, dy = p[1] - cy, d = Math.hypot(dx, dy) || 1;
        life = 0.9 + Math.random() * 0.8;
        parts.push({ k: "k", x: box.ox + p[0] + dx / d * out, y: box.oy + p[1] + dy / d * out, vx: 0, vy: 0,
          r: (7 + Math.random() * 8) * r / 24, life: life, max: life, rot: Math.random() * TAU, c: SPARK_C[Math.floor(Math.random() * SPARK_C.length)] });
      }
    }
    /** 一圈星星和泡泡從半徑 rad（卡片短邊的比例）向外飛 */
    function ring(n, rad, big) {
      var cx = box.ox + box.w / 2, cy = box.oy + box.h / 2, R0 = Math.min(box.w, box.h) * rad, r = P.r;
      for (var i = 0; i < n; i++) {
        if (parts.length > 110) parts.shift();
        var an = (i / n) * TAU + Math.random() * 0.4, sp = (big ? 70 : 45) + Math.random() * 60, kind = i % 3 === 2 ? "b" : "s";
        var life = 0.8 + Math.random() * 0.6;
        parts.push({ k: kind, x: cx + Math.cos(an) * R0, y: cy + Math.sin(an) * R0, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - 15,
          r: (kind === "b" ? 3 + Math.random() * 5 : (big ? 6 : 4.5) + Math.random() * 4) * r / 24, life: life, max: life, rot: Math.random() * TAU,
          c: Math.random() < 0.45 ? "#ffd54a" : (Math.random() < 0.5 ? "#ff8cc4" : "#b595ff") });
      }
    }
    function drawParts(dt) {
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        p.life -= dt;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; p.rot += dt * 2;
        if (p.k === "s") p.vy += 30 * dt;
        var a = Math.min(1, p.life / p.max * 1.6);
        if (p.k === "k") { sparkle4(p, a); continue; }
        if (p.k === "b") {
          g.globalAlpha = a;
          g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU);
          g.fillStyle = "rgba(255,255,255,.45)"; g.fill();
          g.lineWidth = 1.2; g.strokeStyle = "rgba(125,170,255,.85)"; g.stroke();
          g.beginPath(); g.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.28, 0, TAU);
          g.fillStyle = "#fff"; g.fill();
          g.globalAlpha = 1;
        } else star(p, a);
      }
    }

    function frame(e, t, showBrush) {
      frameN++;
      if (needMeasure || frameN % 40 === 0) { measure(); needMeasure = false; }
      if (!P) { if (cw) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, fx.width, fx.height); } return; }
      var dt = lastT ? clamp((t - lastT) / 1000, 0, 0.05) : 0;
      lastT = t; lastE = e;
      if (fc) { if (e >= BRUSH_MS) clearAll(); else eraseTo(counts(P, e)); }
      var a = at(e);
      if (a.q !== lastQ) {
        if (lastQ >= 0 && a.q > lastQ && fc) { var Z = P.zones[lastQ]; burstAt(box.ox + Z.x + Z.w / 2, box.oy + Z.y + Z.h / 2, reduced ? 4 : 12); }
        lastQ = a.q;
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, cw, ch);
      var b = showBrush && e < BRUSH_MS ? pose(e, t) : null;
      if (b && dt) {
        emitB += dt * (reduced ? 3 : 9); emitS += dt * (reduced ? 0.8 : 2.4);
        var tipx = b.x, tipy = b.y;
        while (emitB >= 1) { emitB -= 1; spawn("b", tipx, tipy); }
        while (emitS >= 1) { emitS -= 1; spawn("s", tipx, tipy); }
      }
      drawParts(dt);
      if (b) drawBrush(b);
    }

    function stopTail() { cancelAnimationFrame(tailRaf); tailRaf = 0; }
    var api = {
      /** 開始：target = 卡片元素（泡泡層要蓋住的範圍），foam = 泡泡層 canvas（幻燈片時為 null，只有牙刷和泡泡） */
      start: function (o) {
        stopTail();
        target = o.target; foam = o.foam || null; fc = foam ? foam.getContext("2d") : null;
        P = null; box.w = box.h = 0; parts = []; lastT = 0; lastQ = -1; emitB = emitS = 0; needMeasure = true;
        done = [0, 0, 0, 0]; cleared = false;
        if (foam) foam.hidden = false;
      },
      retarget: function (el) { target = el; needMeasure = true; },
      invalidate: function () { needMeasure = true; },
      render: function (e, t) { frame(e, t, true); },
      /** 預備倒數的一格：泡泡層蓋滿（不刷走），不畫牙刷，只有升起的泡泡和閃光 */
      ready: function (t) {
        frameN++;
        if (needMeasure || frameN % 40 === 0) { measure(); needMeasure = false; }
        if (!P) { if (cw) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, fx.width, fx.height); } return; }
        var dt = lastT ? clamp((t - lastT) / 1000, 0, 0.05) : 0;
        lastT = t; lastE = 0;
        if (dt) {
          emitB += dt * (reduced ? 1 : 3.2); emitS += dt * (reduced ? 0.6 : 2.6);
          while (emitB >= 1) { emitB -= 1; ambient("b"); }
          while (emitS >= 1) { emitS -= 1; ambient("k"); }
        }
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, cw, ch);
        drawParts(dt);
      },
      /** 倒數每一秒（big = 「開始刷牙！」）：從中間的大泡泡邊緣灑出一圈星星 */
      pop: function (big) {
        if (!P) return;
        ring(big ? (reduced ? 8 : 22) : (reduced ? 3 : 9), big ? 0.36 : 0.3, big);
      },
      /** 2:00：泡泡全部刷走，牙刷離開，灑星星 */
      finish: function () {
        frame(BRUSH_MS, performance.now(), false);
        if (P && fc) burstAt(box.ox + box.w / 2, box.oy + box.h / 2, reduced ? 8 : 26);
        var end = performance.now() + 1800;
        stopTail();
        (function tail(t) {
          frame(BRUSH_MS, t || performance.now(), false);
          if ((t || 0) < end && parts.length) tailRaf = requestAnimationFrame(tail); else tailRaf = 0;
        })();
      },
      stop: function () {
        stopTail(); parts = []; target = null; P = null;
        if (cw) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, fx.width, fx.height); }
      },
      /** 測試用：泡泡層仍蓋住的比例（0–1） */
      coverage: function () {
        if (!fc || !foam.width) return null;
        var d = fc.getImageData(0, 0, foam.width, foam.height).data, n = 0, on = 0;
        for (var i = 3; i < d.length; i += 4 * 7) { n++; if (d[i] > 24) on++; }
        return on / n;
      },
      info: function () { return { r: P ? P.r : 0, w: box.w, h: box.h, dpr: dpr, parts: parts.length, e: lastE }; }
    };
    return api;
  }

  return { BRUSH_MS: BRUSH_MS, ZONE_MS: ZONE_MS, GLIDE: GLIDE, plan: plan, radius: radius, at: at, counts: counts, create: create };
});
