/*
 * 萌可刷牙 — 核心規則（純邏輯，不碰 DOM，可在 Node 測試）
 *   - 一天：凌晨 04:00 至翌日 04:00（裝置本地時間）
 *   - 早上時段 04:00–12:00；晚上時段 17:00–04:00（以開始刷牙的時間判斷；有預備倒數時見 brushStartTs()）
 *   - 每次在時段內完整刷牙 2 分鐘 → 得到一張卡；每個時段最多一張，每天最多兩張
 *   - 漏刷只是少一張卡，不會重設任何進度
 *
 * 資料格式（schema 2，localStorage 鍵 momoke-brush-state-v1）：
 *   { schema: 2,
 *     days: { "YYYY-MM-DD": { m, e, mc, ec, x } },   m/e：該時段第一次完成刷牙的時間；mc/ec：該時段得到的卡片 id；x：時段外刷牙次數
 *     collected: [ { id, t, d, s } ],                 按得到的次序；s："m" | "e" | null（舊資料 / 補發）
 *     pending: { id, n } | null }                     已決定但未完成的下一張卡（n = 決定時已收集的張數）
 * 舊格式（schema 1）：days[k] = { m, e, cap, x }，由 migrateState() 轉換。
 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory;
  else root.createMomokeLogic = factory;
})(typeof self !== "undefined" ? self : this, function createMomokeLogic(DATA) {
  "use strict";

  var SCHEMA = 2;
  var DAY_START_HOUR = 4;
  var MORNING = [4, 12];   // [start, end)
  var EVENING_START = 17;  // 17:00 → 04:00
  var BRUSH_MS = 120000;
  var ZONE_MS = 30000;

  var byId = {};
  DATA.items.forEach(function (it) { byId[it.id] = it; });
  var LEGACY = DATA.legacyIds || {};

  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function ymd(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }

  /** 以 04:00 為分界的「日子」代號 YYYY-MM-DD */
  function dayKey(ts) {
    var d = new Date(ts);
    if (d.getHours() < DAY_START_HOUR) d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 12);
    return ymd(d);
  }

  /** "morning" | "evening" | null */
  function slotOf(ts) {
    var h = new Date(ts).getHours();
    if (h >= MORNING[0] && h < MORNING[1]) return "morning";
    if (h >= EVENING_START || h < DAY_START_HOUR) return "evening";
    return null;
  }
  var SLOT_KEYS = { morning: { done: "m", card: "mc" }, evening: { done: "e", card: "ec" } };

  function season(id) {
    for (var i = 0; i < DATA.seasons.length; i++) if (DATA.seasons[i].id === id) return DATA.seasons[i];
    return null;
  }
  function seasonItems(sid) { return DATA.items.filter(function (it) { return it.season === sid; }); }

  function emptyState() { return { schema: SCHEMA, days: {}, collected: [], pending: null }; }
  function emptyDay() { return { m: null, e: null, mc: null, ec: null, x: 0 }; }

  function validId(id) { return typeof id === "string" && !!byId[id]; }

  /** 驗證 / 清理 schema 2 的資料；格式不對時回傳 null */
  function normalizeState(s) {
    if (!s || typeof s !== "object" || typeof s.days !== "object" || !s.days || !Array.isArray(s.collected)) return null;
    if (s.schema !== SCHEMA) return null;
    var out = emptyState();
    var seen = {};
    s.collected.forEach(function (c) {
      if (c && validId(c.id) && !seen[c.id]) {
        seen[c.id] = 1;
        out.collected.push({ id: c.id, t: c.t || 0, d: c.d || null, s: (c.s === "m" || c.s === "e") ? c.s : null });
      }
    });
    Object.keys(s.days).forEach(function (k) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
      var d = s.days[k] || {};
      out.days[k] = {
        m: d.m || null, e: d.e || null,
        mc: (validId(d.mc) && seen[d.mc]) ? d.mc : null,
        ec: (validId(d.ec) && seen[d.ec]) ? d.ec : null,
        x: d.x || 0
      };
    });
    if (s.pending && validId(s.pending.id) && !seen[s.pending.id] && s.pending.n === out.collected.length) {
      out.pending = { id: s.pending.id, n: s.pending.n };
    }
    return out;
  }

  function collectedSet(state) {
    var set = {};
    state.collected.forEach(function (c) { set[c.id] = true; });
    return set;
  }
  function collectedIn(state, sid) {
    return state.collected.filter(function (c) { return byId[c.id] && byId[c.id].season === sid; });
  }

  /** 目前正在收集的季度（第一季集齊後，若第二季已開放則轉到第二季） */
  function currentSeasonId(state) {
    for (var i = 0; i < DATA.seasons.length; i++) {
      var s = DATA.seasons[i];
      if (!s.open) return null;
      var items = seasonItems(s.id);
      if (!items.length) return null;
      if (collectedIn(state, s.id).length < items.length) return s.id;
    }
    return null; // 全部集齊 / 下一季未開放
  }

  function isSeasonComplete(state, sid) {
    var items = seasonItems(sid);
    return items.length > 0 && collectedIn(state, sid).length >= items.length;
  }

  function pick(arr, rng) { return arr[Math.floor(rng() * arr.length) % arr.length]; }

  /**
   * 第一季抽卡規則（每得到一張卡前進一步）：
   *  1) 第 1 張：愛心萌可；第 2 張：愛心公主
   *  2) 已收集某皇室萌可但未有它的公主 → 這張就是它的公主（正常情況＝上一張是皇室萌可）
   *  3) 否則從未收集（不含鬧鬧、不含公主）中平均抽；
   *     R = 未收集的皇室萌可數，S = 80 − 已收集（不含鬧鬧）數（即剩餘的非鬧鬧位置）；
   *     若 S ≤ 2R 必須抽皇室萌可（每位皇室萌可要佔 2 個位置：自己 + 公主）
   *  4) 其餘 80 張都收集完 → 鬧鬧萌可（第 81 張）
   */
  function drawNextS1(collectedIds, rng) {
    var S1 = season("s1");
    var have = {};
    collectedIds.forEach(function (id) { have[id] = true; });
    var items = seasonItems("s1");
    var finalId = S1.finalItem;
    var nonFinal = items.filter(function (it) { return it.id !== finalId; });
    var uncollectedNonFinal = nonFinal.filter(function (it) { return !have[it.id]; });

    if (!uncollectedNonFinal.length) return have[finalId] ? null : finalId;

    var s1Collected = collectedIds.filter(function (id) { return byId[id] && byId[id].season === "s1"; });
    var n = s1Collected.length + 1;
    if (S1.first && n <= S1.first.length && !have[S1.first[n - 1]]) return S1.first[n - 1];

    // 皇室萌可已收集但公主未收集 → 公主（從最近收集的開始找）
    for (var i = s1Collected.length - 1; i >= 0; i--) {
      var it = byId[s1Collected[i]];
      if (it.category === "royal" && it.princess && !have[it.princess]) return it.princess;
    }

    var royals = uncollectedNonFinal.filter(function (it) { return it.category === "royal"; });
    // 每位未收集的皇室萌可需要的位置數：自己 1 + 公主 1（若公主未收集）
    var need = 0;
    royals.forEach(function (r) { need += 1 + (r.princess && !have[r.princess] ? 1 : 0); });
    var S = uncollectedNonFinal.length; // = 80 − 已收集（不含鬧鬧）數
    var pool;
    if (royals.length > 0 && S <= need) pool = royals;
    else pool = uncollectedNonFinal.filter(function (it) { return it.type !== "princess"; });
    if (!pool.length) pool = uncollectedNonFinal; // 保險：不應發生
    return pick(pool, rng).id;
  }

  /** 其他季度的預設抽卡（第二季的掛鉤）：未收集中平均抽，finalItem 放最後 */
  function drawNextGeneric(sid, collectedIds, rng) {
    var s = season(sid);
    var have = {};
    collectedIds.forEach(function (id) { have[id] = true; });
    var items = seasonItems(sid).filter(function (it) { return !have[it.id]; });
    if (!items.length) return null;
    if (s.first) for (var i = 0; i < s.first.length; i++) if (!have[s.first[i]]) return s.first[i];
    var rest = items.filter(function (it) { return it.id !== s.finalItem; });
    return rest.length ? pick(rest, rng).id : items[0].id;
  }

  function drawNext(state, rng) {
    var sid = currentSeasonId(state);
    if (!sid) return null;
    var ids = state.collected.map(function (c) { return c.id; });
    return sid === "s1" ? drawNextS1(ids, rng) : drawNextGeneric(sid, ids, rng);
  }

  function getDay(state, key) {
    if (!state.days[key]) state.days[key] = emptyDay();
    return state.days[key];
  }

  /** 已決定的下一張卡（仍然有效才回傳） */
  function validPending(state) {
    var p = state.pending;
    if (!p || !byId[p.id] || p.n !== state.collected.length || collectedSet(state)[p.id]) return null;
    return p.id;
  }
  /** 取得（必要時抽出並保存）下一張卡；中途停止的刷牙會沿用同一張 */
  function ensurePending(state, rng) {
    var id = validPending(state);
    if (id) return id;
    id = drawNext(state, rng || Math.random);
    state.pending = id ? { id: id, n: state.collected.length } : null;
    return id;
  }

  /**
   * 開始刷牙時呼叫：判斷這次刷牙會不會得到卡片，會的話決定是哪一張（保存在 state.pending）。
   * 回傳 { earn: true, id, slot, day } 或 { earn: false, reason: "outside" | "already" | "complete", slot, day }
   */
  function planBrush(state, startTs, rng) {
    var key = dayKey(startTs), slot = slotOf(startTs);
    if (!slot) return { earn: false, reason: "outside", slot: null, day: key };
    var day = state.days[key];
    if (day && day[SLOT_KEYS[slot].card]) return { earn: false, reason: "already", slot: slot, day: key };
    var id = ensurePending(state, rng);
    if (!id) return { earn: false, reason: "complete", slot: slot, day: key };
    return { earn: true, id: id, slot: slot, day: key };
  }

  /** 在 ts 開始的刷牙能否得到卡片（不改動 state、不抽卡） */
  function canEarn(state, ts) {
    var slot = slotOf(ts);
    if (!slot) return false;
    var day = state.days[dayKey(ts)];
    if (day && day[SLOT_KEYS[slot].card]) return false;
    return !!(validPending(state) || currentSeasonId(state));
  }

  /**
   * 預備倒數（10 秒，不計入 2 分鐘）：用「按下開始刷牙（倒數開始）」readyTs 和「真正開始計時」startTs
   * 之中對小朋友較有利的一個判斷時段和日子（不改動 state）：
   *   1) 能得到卡片的優先（兩個都可以時用倒數開始的時間）；
   *   2) 都不能得到卡片時，在刷牙時段內的優先（日曆仍會記錄這次刷牙）；
   *   3) 否則用倒數開始的時間。
   * 例：11:59:55 開始倒數 → 早上；16:59:55 開始倒數、17:00:05 開始刷 → 晚上；
   *     03:59:55 開始倒數而昨晚已得到卡片 → 04:00:05 開始刷，算今天早上。
   */
  function brushStartTs(state, readyTs, startTs) {
    if (startTs == null) startTs = readyTs;
    var c = [readyTs, startTs], i;
    for (i = 0; i < 2; i++) if (canEarn(state, c[i])) return c[i];
    for (i = 0; i < 2; i++) if (slotOf(c[i])) return c[i];
    return readyTs;
  }

  function collect(state, id, ts, key, s) {
    state.collected.push({ id: id, t: ts, d: key, s: s || null });
    state.pending = null;
  }

  /**
   * 記錄一次「完整完成 2 分鐘」的刷牙。startTs 用來判斷時段和日子。
   * 回傳 { kind, slot, day, item?, number?, seasonComplete? }
   *  kind: "capture" | "outside" | "again"（這個時段已得到卡片） | "all-done"（已集齊）
   */
  function recordBrush(state, startTs, endTs, rng) {
    rng = rng || Math.random;
    var key = dayKey(startTs);
    var slot = slotOf(startTs);
    var day = getDay(state, key);
    if (!slot) { day.x = (day.x || 0) + 1; return { kind: "outside", slot: null, day: key }; }
    var k = SLOT_KEYS[slot];
    if (!day[k.done]) day[k.done] = endTs;
    if (day[k.card]) return { kind: "again", slot: slot, day: key };
    var sidBefore = currentSeasonId(state);
    var id = ensurePending(state, rng);
    if (!id) return { kind: "all-done", slot: slot, day: key };
    collect(state, id, endTs, key, k.done);
    day[k.card] = id;
    return {
      kind: "capture", slot: slot, day: key, item: byId[id],
      number: collectedIn(state, byId[id].season).length,
      seasonComplete: isSeasonComplete(state, sidBefore) ? sidBefore : null
    };
  }

  /** 某天得到的卡片數（0–2） */
  function cardsOnDay(rec) { return rec ? (rec.mc ? 1 : 0) + (rec.ec ? 1 : 0) : 0; }

  /**
   * 把舊格式（schema 1：每天早晚都刷才有一張卡，劇照 id s1-still-01..10）轉成 schema 2。
   *  - 保留所有已收集的卡片（次序不變）和日曆紀錄；舊劇照 id 依 DATA.legacyIds 換成新 id；
   *    無法對應的舊劇照改發一張未收集的劇照（保持張數），並記在 notes。
   *  - 舊的 cap（晚上完成時捕捉）記為該天晚上時段的卡片（ec）。
   *  - 今天（nowTs 所屬的日子）若有已完成但沒有得到卡片的時段，補發該時段的卡片（按抽卡規則）。
   *  - 皇室萌可已收集但公主未收集 → 抽卡規則會令公主成為下一張。
   * 回傳 { state, granted: [ capture 結果 ], notes: [文字] }；格式不對時回傳 null。
   * 已是 schema 2 的資料只做 normalizeState。
   */
  function migrateState(raw, nowTs, rng) {
    rng = rng || Math.random;
    if (!raw || typeof raw !== "object") return null;
    if (raw.schema === SCHEMA) { var n2 = normalizeState(raw); return n2 ? { state: n2, granted: [], notes: [] } : null; }
    if (typeof raw.days !== "object" || !raw.days || !Array.isArray(raw.collected)) return null;
    var notes = [];
    var out = emptyState();
    var seen = {};
    var remap = {};           // 舊 id → 新 id（包括改發的劇照）
    var unmapped = [];
    raw.collected.forEach(function (c) {
      if (!c || typeof c.id !== "string") return;
      var id = c.id;
      if (!byId[id] && LEGACY[id] && byId[LEGACY[id]]) id = LEGACY[id];
      if (!byId[id]) {
        if (/^s1-still-/.test(c.id)) { unmapped.push(c); remap[c.id] = null; }
        else notes.push("略過未知的卡片 " + c.id);
        return;
      }
      if (seen[id]) return;
      seen[id] = 1; remap[c.id] = id;
      out.collected.push({ id: id, t: c.t || 0, d: c.d || null, s: null, _old: c.id });
    });
    // 無法對應的舊劇照：改發一張未收集的劇照（按集數次序第一張），保持張數
    unmapped.forEach(function (c) {
      var free = seasonItems("s1").filter(function (it) { return it.type === "still" && !seen[it.id]; })[0];
      if (!free) { notes.push("舊劇照 " + c.id + " 無法對應，也沒有可補發的劇照"); return; }
      seen[free.id] = 1; remap[c.id] = free.id;
      out.collected.push({ id: free.id, t: c.t || 0, d: c.d || null, s: null, _old: c.id });
      notes.push("舊劇照 " + c.id + " 無法對應，改發 " + free.id);
    });
    // 保持原本收集次序（改發的劇照放回舊劇照原本的位置）
    var order = raw.collected.map(function (c) { return c && c.id; });
    out.collected.sort(function (a, b) { return order.indexOf(a._old) - order.indexOf(b._old); });
    out.collected.forEach(function (c) { delete c._old; });

    var capDay = {};
    Object.keys(raw.days).forEach(function (k) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
      var d = raw.days[k] || {};
      var cap = d.cap ? (remap[d.cap] !== undefined ? remap[d.cap] : (byId[d.cap] ? d.cap : null)) : null;
      if (cap && !seen[cap]) cap = null;
      out.days[k] = { m: d.m || null, e: d.e || null, mc: null, ec: cap || null, x: d.x || 0 };
      if (cap) capDay[cap] = k;
    });
    // 舊資料捕捉的卡都在晚上時段
    out.collected.forEach(function (c) { if (capDay[c.id] && capDay[c.id] === c.d) c.s = "e"; });

    // 今天已完成但沒有卡片的時段 → 補發
    var granted = [];
    var todayKey = dayKey(nowTs);
    var today = out.days[todayKey];
    if (today) {
      ["morning", "evening"].forEach(function (slot) {
        var k = SLOT_KEYS[slot];
        if (today[k.done] && !today[k.card]) {
          var sidBefore = currentSeasonId(out);
          var id = drawNext(out, rng);
          if (!id) return;
          collect(out, id, nowTs, todayKey, k.done);
          today[k.card] = id;
          granted.push({ kind: "capture", slot: slot, day: todayKey, item: byId[id], migrated: true,
            number: collectedIn(out, byId[id].season).length,
            seasonComplete: isSeasonComplete(out, sidBefore) ? sidBefore : null });
          notes.push("補發今天" + (slot === "morning" ? "早上" : "晚上") + "的卡片 " + id);
        }
      });
    }
    out.pending = null;
    return { state: out, granted: granted, notes: notes };
  }

  /**
   * 刷牙音樂：目前收集中的季度的主題曲；該季未有歌（或已集齊）時，用最近一個已開放而有歌的季度。
   * 回傳 { src, type, title, duration, season } 或 null。
   */
  function songFor(state) {
    var sid = currentSeasonId(state);
    var best = null;
    for (var i = 0; i < DATA.seasons.length; i++) {
      var s = DATA.seasons[i];
      if (!s.open) break;
      if (s.music && s.music.op && s.music.op.src) best = { season: s.id, op: s.music.op };
      if (s.id === sid) break;
    }
    if (!best) return null;
    var op = best.op;
    return { src: op.src, type: op.type || "", title: op.title || "", duration: op.duration || 0, season: best.season };
  }

  /**
   * 家長設定（localStorage 鍵 momoke-brush-settings，另存，不影響 schema 2 的進度資料）：
   *   { music: true | false }   刷牙音樂，預設開啟
   *   ready: false              關閉「預備時間」（開始刷牙前的 10 秒倒數）；預設開啟，開啟時不寫入這個鍵
   */
  function normalizeSettings(s) {
    var o = s && typeof s === "object" ? s : {};
    var out = { music: o.music !== false };
    if (o.ready === false) out.ready = false;
    return out;
  }

  return {
    SCHEMA: SCHEMA, BRUSH_MS: BRUSH_MS, ZONE_MS: ZONE_MS, DAY_START_HOUR: DAY_START_HOUR,
    byId: byId, dayKey: dayKey, slotOf: slotOf, ymd: ymd, SLOT_KEYS: SLOT_KEYS,
    season: season, seasonItems: seasonItems, emptyState: emptyState, normalizeState: normalizeState,
    collectedSet: collectedSet, collectedIn: collectedIn, currentSeasonId: currentSeasonId,
    isSeasonComplete: isSeasonComplete, drawNextS1: drawNextS1, drawNext: drawNext,
    getDay: getDay, validPending: validPending, ensurePending: ensurePending, planBrush: planBrush,
    canEarn: canEarn, brushStartTs: brushStartTs,
    recordBrush: recordBrush, cardsOnDay: cardsOnDay, migrateState: migrateState,
    songFor: songFor, normalizeSettings: normalizeSettings
  };
});
