/*
 * 萌可刷牙 — 核心規則（純邏輯，不碰 DOM，可在 Node 測試）
 *   - 一天：凌晨 04:00 至翌日 04:00（裝置本地時間）
 *   - 早上時段 04:00–12:00；晚上時段 17:00–04:00
 *   - 同一天早上 + 晚上都完成 → 捕捉一張卡（每天最多一張）
 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory;
  else root.createMomokeLogic = factory;
})(typeof self !== "undefined" ? self : this, function createMomokeLogic(DATA) {
  "use strict";

  var DAY_START_HOUR = 4;
  var MORNING = [4, 12];   // [start, end)
  var EVENING_START = 17;  // 17:00 → 04:00
  var BRUSH_MS = 120000;
  var ZONE_MS = 30000;

  var byId = {};
  DATA.items.forEach(function (it) { byId[it.id] = it; });

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

  function season(id) {
    for (var i = 0; i < DATA.seasons.length; i++) if (DATA.seasons[i].id === id) return DATA.seasons[i];
    return null;
  }
  function seasonItems(sid) { return DATA.items.filter(function (it) { return it.season === sid; }); }

  function emptyState() { return { schema: 1, days: {}, collected: [] }; }

  function normalizeState(s) {
    if (!s || typeof s !== "object" || typeof s.days !== "object" || !Array.isArray(s.collected)) return null;
    var out = emptyState();
    Object.keys(s.days).forEach(function (k) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
      var d = s.days[k] || {};
      out.days[k] = { m: d.m || null, e: d.e || null, cap: (d.cap && byId[d.cap]) ? d.cap : null, x: d.x || 0 };
    });
    var seen = {};
    s.collected.forEach(function (c) {
      if (c && byId[c.id] && !seen[c.id]) { seen[c.id] = 1; out.collected.push({ id: c.id, t: c.t || 0, d: c.d || null }); }
    });
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
   * 第一季抽卡規則：
   *  1) 第 1 張：愛心萌可；第 2 張：愛心公主
   *  2) 上一張是皇室萌可 → 這張是它的公主
   *  3) 否則從未收集（不含鬧鬧、不含公主）中平均抽；
   *     R = 未收集皇室萌可數，S = 38 − 已收集（不含鬧鬧）數；若 S ≤ 2R 必須抽皇室萌可
   *  4) 其餘都收集完 → 鬧鬧萌可（第 39 張）
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

    var last = byId[s1Collected[s1Collected.length - 1]];
    if (last && last.category === "royal" && last.princess && !have[last.princess]) return last.princess;

    var royals = uncollectedNonFinal.filter(function (it) { return it.category === "royal"; });
    var R = royals.length;
    var S = uncollectedNonFinal.length; // = 38 − 已收集（不含鬧鬧）數
    var pool;
    if (R > 0 && S <= 2 * R) pool = royals;
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
    if (!state.days[key]) state.days[key] = { m: null, e: null, cap: null, x: 0 };
    return state.days[key];
  }

  /**
   * 記錄一次「完整完成 2 分鐘」的刷牙。startTs 用來判斷時段和日子。
   * 回傳 { kind, day, item?, seasonComplete? }
   *  kind: "outside" | "morning" | "morning-again" | "evening-capture" |
   *        "evening-no-morning" | "evening-already-captured" | "evening-all-done" | "evening-again"
   */
  function recordBrush(state, startTs, endTs, rng) {
    rng = rng || Math.random;
    var key = dayKey(startTs);
    var slot = slotOf(startTs);
    var day = getDay(state, key);
    if (!slot) { day.x = (day.x || 0) + 1; return { kind: "outside", day: key }; }
    if (slot === "morning") {
      if (day.m) return { kind: "morning-again", day: key };
      day.m = endTs;
      return { kind: "morning", day: key, allDone: !currentSeasonId(state) };
    }
    var firstEvening = !day.e;
    if (!day.e) day.e = endTs;
    if (!day.m) return { kind: "evening-no-morning", day: key };
    if (day.cap) return { kind: firstEvening ? "evening-already-captured" : "evening-again", day: key };
    var sidBefore = currentSeasonId(state);
    var id = drawNext(state, rng);
    if (!id) return { kind: "evening-all-done", day: key };
    state.collected.push({ id: id, t: endTs, d: key });
    day.cap = id;
    return {
      kind: "evening-capture", day: key, item: byId[id],
      number: collectedIn(state, byId[id].season).length,
      seasonComplete: isSeasonComplete(state, sidBefore) ? sidBefore : null
    };
  }

  return {
    BRUSH_MS: BRUSH_MS, ZONE_MS: ZONE_MS, DAY_START_HOUR: DAY_START_HOUR,
    byId: byId, dayKey: dayKey, slotOf: slotOf, ymd: ymd,
    season: season, seasonItems: seasonItems, emptyState: emptyState, normalizeState: normalizeState,
    collectedSet: collectedSet, collectedIn: collectedIn, currentSeasonId: currentSeasonId,
    isSeasonComplete: isSeasonComplete, drawNextS1: drawNextS1, drawNext: drawNext,
    getDay: getDay, recordBrush: recordBrush
  };
});
