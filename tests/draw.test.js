// 執行：node tests/draw.test.js
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const DATA = require("../data.js");
const L = require("../logic.js")(DATA);

// 簡單可重現的亂數（mulberry32）
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let checks = 0;
const ok = (c, m) => { assert(c, m); checks++; };
const eq = (a, b, m) => { assert.strictEqual(a, b, m); checks++; };

const TOTAL = 81;
const s1 = DATA.items.filter((i) => i.season === "s1");
const royals = s1.filter((i) => i.category === "royal");
const princesses = s1.filter((i) => i.type === "princess");
const stills = s1.filter((i) => i.type === "still");
const FINAL = "s1-m-24";

// ---- 資料檢查 ----
eq(s1.length, TOTAL, "第一季 81 張");
eq(L.season("s1").total, TOTAL, "seasons.total = 81");
eq(s1.filter((i) => i.type === "momoke").length, 24);
eq(s1.filter((i) => i.category === "magic").length, 18, "18 魔方萌可");
eq(princesses.length, 5);
eq(stills.length, 52);
assert.deepStrictEqual(royals.map((r) => r.name), ["愛心萌可", "正正萌可", "勇氣萌可", "盼盼萌可", "唱唱萌可"]);
const pairs = { "愛心萌可": "愛心公主", "正正萌可": "正義公主", "勇氣萌可": "勇氣公主", "盼盼萌可": "希望公主", "唱唱萌可": "音樂公主" };
royals.forEach((r) => {
  eq(L.byId[r.princess].name, pairs[r.name]);
  eq(L.byId[r.princess].royal, r.id);
});
eq(L.byId[FINAL].name, "鬧鬧萌可");
eq(L.season("s1").finalItem, FINAL);
eq(new Set(DATA.items.map((i) => i.id)).size, DATA.items.length, "id 不重複");
// 劇照：按集數、a/b 排列；名稱/說明與 blurbs.json 完全一致；圖片檔存在
const V2 = "/workspace/momoke/images/s1_stills_v2";
const expectFiles = [];
for (let e = 1; e <= 26; e++) for (const ab of ["a", "b"]) expectFiles.push(`ep${String(e).padStart(2, "0")}_${ab}.jpg`);
assert.deepStrictEqual(stills.map((s) => path.basename(s.img)), expectFiles, "劇照次序：集數再 a/b");
stills.forEach((s) => ok(fs.existsSync(path.join(__dirname, "..", s.img)), "圖片存在 " + s.img));
s1.forEach((s) => ok(s.img && fs.existsSync(path.join(__dirname, "..", s.img)), "圖片存在 " + s.img));
if (fs.existsSync(V2)) {
  const blurbs = JSON.parse(fs.readFileSync(path.join(V2, "blurbs.json"), "utf8"));
  const byFile = Object.fromEntries(blurbs.map((b) => [b.file, b]));
  stills.forEach((s) => {
    const b = byFile[path.basename(s.img)];
    ok(b, "blurbs.json 有 " + s.img);
    eq(s.name, b.title, "name = title " + s.img);
    eq(s.blurb, b.blurb, "blurb = blurb " + s.img);
    eq(s.intro, b.intro, "intro = intro " + s.img);
  });
  // 舊劇照對應：與 manifest.json 的 reused_existing 一致
  const manifest = JSON.parse(fs.readFileSync(path.join(V2, "manifest.json"), "utf8"));
  const oldSrc = { "s1-still-01": "01_ep01_litv.jpg", "s1-still-02": "02_ep02_tx.jpg", "s1-still-03": "03_ep03_litv.jpg",
    "s1-still-04": "backup_02_ep07_tx.jpg", "s1-still-05": "05_ep07_iq.jpg", "s1-still-06": "06_ep13_litv.jpg",
    "s1-still-07": "07_ep14_litv.jpg", "s1-still-08": "08_ep16_tx.jpg", "s1-still-09": "09_ep20_litv.jpg", "s1-still-10": "10_ep23_tx.jpg" };
  Object.entries(oldSrc).forEach(([oldId, src]) => {
    const m = manifest.find((x) => x.reused_existing === src);
    ok(m, "manifest 有沿用 " + src);
    eq(path.basename(L.byId[DATA.legacyIds[oldId]].img), m.file, oldId + " → " + m.file);
  });
  console.log("✓ 劇照名稱 / 說明與 blurbs.json 一致，舊劇照對應與 manifest.json 一致");
}
console.log("✓ 資料檢查（81 張 = 24 萌可 + 5 公主 + 52 劇照）");

// ---- 抽卡順序檢查（共用） ----
function checkSequence(seq, label) {
  eq(seq.length, TOTAL, label + "：共 81 張");
  eq(new Set(seq).size, TOTAL, label + "：81 張都不重複");
  eq(seq[0], "s1-m-01", label + "：第 1 張是愛心萌可");
  eq(seq[1], "s1-p-01", label + "：第 2 張是愛心公主");
  eq(seq[TOTAL - 1], FINAL, label + "：第 81 張是鬧鬧萌可");
  royals.forEach((ro) => {
    const i = seq.indexOf(ro.id);
    eq(seq[i + 1], ro.princess, label + "：" + ro.name + " 之後緊接其公主");
    ok(i + 1 < TOTAL - 1, label + "：公主在鬧鬧之前");
  });
  princesses.forEach((p) => eq(seq[seq.indexOf(p.id) - 1], p.royal, label + "：" + p.name + " 前面是對應的皇室萌可"));
}

// ---- 抽卡模擬（drawNextS1 直接模擬） ----
const RUNS = 20000;
const positionHist = {};
let maxRoyalPos = 0, forcedRuns = 0;
for (let run = 0; run < RUNS; run++) {
  const r = rng(run + 1);
  const seq = [];
  for (;;) {
    const id = L.drawNextS1(seq, r);
    if (!id) break;
    seq.push(id);
    assert(seq.length <= TOTAL, "不可多於 81 張");
  }
  checkSequence(seq, "模擬 " + run);
  royals.forEach((ro) => { maxRoyalPos = Math.max(maxRoyalPos, seq.indexOf(ro.id) + 2); });
  if (royals.some((ro) => seq.indexOf(ro.princess) === TOTAL - 2)) forcedRuns++;
  seq.forEach((id, i) => { (positionHist[id] = positionHist[id] || []).push(i + 1); });
}
console.log(`✓ 抽卡模擬 ${RUNS} 次全部通過（皇室萌可 + 公主最遲在第 ${maxRoyalPos} 張，${forcedRuns} 次最後一對在第 79–80 張）`);
const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
console.log("  平均出現位置：" + ["s1-m-02", "s1-m-05", "s1-m-10", "s1-still-ep01a", "s1-still-ep26b"].map((id) => L.byId[id].name + "(" + id + ") " + avg(positionHist[id])).join("，"));

// 極端亂數（永遠 0 / 永遠接近 1）也要守規則（測試強制抽皇室萌可）
for (const fixed of [0, 0.999999, 0.5]) {
  const seq = [];
  for (let id; (id = L.drawNextS1(seq, () => fixed));) seq.push(id);
  checkSequence(seq, "固定亂數 " + fixed);
}
console.log("✓ 極端亂數（強制抽皇室萌可的情況）");

// ---- 日子 / 時段 ----
const T = (s) => new Date(s).getTime();
eq(L.dayKey(T("2026-09-26T03:59")), "2026-09-25");
eq(L.dayKey(T("2026-09-26T04:00")), "2026-09-26");
eq(L.dayKey(T("2026-10-01T01:00")), "2026-09-30");
eq(L.dayKey(T("2026-01-01T02:00")), "2025-12-31");
eq(L.slotOf(T("2026-09-26T03:59")), "evening");
eq(L.slotOf(T("2026-09-26T04:00")), "morning");
eq(L.slotOf(T("2026-09-26T11:59")), "morning");
eq(L.slotOf(T("2026-09-26T12:00")), null);
eq(L.slotOf(T("2026-09-26T16:59")), null);
eq(L.slotOf(T("2026-09-26T17:00")), "evening");
console.log("✓ 日子與時段");

// ---- 新的得卡規則：每次在時段內完整刷牙 = 一張卡，每時段最多一張 ----
{
  const st = L.emptyState();
  const R = rng(7);
  const rec = (s) => L.recordBrush(st, T(s), T(s) + 120000, R);
  let r = rec("2026-09-26T08:00");
  eq(r.kind, "capture", "早上刷牙得卡"); eq(r.item.id, "s1-m-01"); eq(r.number, 1); eq(r.slot, "morning");
  eq(rec("2026-09-26T09:00").kind, "again", "同一早上第二次不得卡");
  eq(rec("2026-09-26T14:00").kind, "outside", "時段外不得卡");
  r = rec("2026-09-26T21:00");
  eq(r.kind, "capture", "晚上刷牙得卡"); eq(r.item.id, "s1-p-01", "第 2 張愛心公主"); eq(r.number, 2);
  eq(rec("2026-09-26T22:00").kind, "again", "同一晚上第二次不得卡");
  eq(rec("2026-09-27T02:00").kind, "again", "凌晨 02:00 屬前一天晚上");
  eq(st.collected.length, 2);
  eq(L.cardsOnDay(st.days["2026-09-26"]), 2, "一天最多兩張");
  eq(st.days["2026-09-26"].x, 1);
  // 漏了早上：晚上照樣得卡（不再重設）
  r = rec("2026-09-27T20:00");
  eq(r.kind, "capture", "漏早上，晚上仍得卡"); eq(st.collected.length, 3);
  // 只有早上
  r = rec("2026-09-28T07:00"); eq(r.kind, "capture");
  eq(st.collected.length, 4);
  // 凌晨 01:00 的晚上刷牙屬於前一天
  r = rec("2026-09-30T01:00"); eq(r.kind, "capture"); eq(r.day, "2026-09-29"); eq(r.slot, "evening");
  eq(st.collected[4].s, "e");
  console.log("✓ 得卡規則（早上/晚上/時段外/同時段第二次/漏刷/凌晨歸前一天）");

  // ---- 刷牙開始時決定卡片；中途停止沿用同一張 ----
  const p1 = L.planBrush(st, T("2026-09-30T08:00"), rng(99));
  ok(p1.earn && p1.slot === "morning", "planBrush: 早上可得卡");
  eq(st.pending.id, p1.id, "pending 已保存");
  const saved = JSON.parse(JSON.stringify(st));
  const st2 = L.normalizeState(saved);
  eq(st2.pending.id, p1.id, "pending 經過儲存/讀取後保留");
  for (let i = 0; i < 20; i++) eq(L.planBrush(st2, T("2026-09-30T08:05"), rng(1000 + i)).id, p1.id, "停止後再開始：同一張");
  eq(L.planBrush(st2, T("2026-09-30T19:00"), rng(5)).id, p1.id, "改在晚上再試：仍是同一張");
  r = L.recordBrush(st2, T("2026-09-30T08:05"), T("2026-09-30T08:07"), rng(3));
  eq(r.item.id, p1.id, "完成時得到的就是 pending 那張"); eq(st2.pending, null);
  const pa = L.planBrush(st2, T("2026-09-30T09:00"));
  ok(!pa.earn && pa.reason === "already", "planBrush: 同時段已得卡");
  eq(st2.pending, null, "不得卡時不抽 pending");
  const po = L.planBrush(st2, T("2026-09-30T13:00"));
  ok(!po.earn && po.reason === "outside", "planBrush: 時段外");
  // pending 失效（收集數量改變）會重抽
  const st3 = L.normalizeState(saved); st3.pending.n = 99;
  eq(L.normalizeState(st3).pending, null, "失效的 pending 被清除");
  console.log("✓ 開始刷牙時決定卡片、停止後沿用同一張");

  // ---- 補齊到 81 張（每天兩張 ≈ 41 天）----
  let d = new Date(2026, 9, 1), last, days = 0;
  const firstDay = st2.collected.length;
  while (st2.collected.length < TOTAL) {
    const k = L.ymd(d);
    for (const hm of ["T07:00", "T20:00"]) {
      if (st2.collected.length >= TOTAL) break;
      const pl = L.planBrush(st2, T(k + hm), Math.random);
      ok(pl.earn, "未集齊時可得卡");
      last = L.recordBrush(st2, T(k + hm), T(k + hm) + 120000, Math.random);
      eq(last.item.id, pl.id, "得到的卡 = 開始時決定的卡");
    }
    d.setDate(d.getDate() + 1); days++;
  }
  eq(last.item.id, FINAL, "最後一張是鬧鬧萌可");
  eq(last.number, TOTAL);
  eq(last.seasonComplete, "s1");
  checkSequence(st2.collected.map((c) => c.id), "完整流程");
  const k = L.ymd(d);
  const pc = L.planBrush(st2, T(k + "T08:00"));
  ok(!pc.earn && pc.reason === "complete", "集齊後 planBrush = complete");
  eq(L.recordBrush(st2, T(k + "T08:00"), T(k + "T08:02")).kind, "all-done");
  eq(L.normalizeState(JSON.parse(JSON.stringify(st2))).collected.length, TOTAL);
  eq(L.normalizeState({ foo: 1 }), null);
  console.log(`✓ 完整流程集齊 81 張（由第 ${firstDay + 1} 張起用了 ${days} 天，每天最多兩張）`);
  eq(Math.ceil(TOTAL / 2), 41, "約 41 天");
}

// ---- 隨機模擬實際使用（漏刷、時段外、中途停止）----
{
  for (let run = 0; run < 3000; run++) {
    const R = rng(50000 + run);
    const st = L.emptyState();
    let d = new Date(2026, 9, 1), guard = 0;
    while (st.collected.length < TOTAL && guard++ < 400) {
      const k = L.ymd(d);
      for (const hm of ["T07:00", "T13:00", "T20:00", "T21:00"]) {
        if (R() < 0.3) continue; // 漏刷
        const t = T(k + hm);
        const before = st.collected.length;
        const pl = L.planBrush(st, t, R);
        if (R() < 0.2) continue; // 中途停止：不記錄，pending 保留
        const res = L.recordBrush(st, t, t + 120000, R);
        if (pl.earn) { eq(res.kind, "capture"); eq(res.item.id, pl.id); eq(st.collected.length, before + 1); }
        else eq(st.collected.length, before, "不得卡的刷牙不增加卡片");
      }
      ok(L.cardsOnDay(st.days[k]) <= 2, "每天最多兩張");
      d.setDate(d.getDate() + 1);
    }
    checkSequence(st.collected.map((c) => c.id), "使用模擬 " + run);
  }
  console.log("✓ 使用模擬 3000 次（隨機漏刷 / 時段外 / 中途停止）全部符合抽卡規則");
}

// ---- 舊資料轉換（schema 1 → 2）----
{
  const NOW = T("2026-09-26T21:30");
  // 舊資料：9/24 捕捉愛心萌可，9/25 捕捉愛心公主，今天(9/26) 早上已刷、晚上未刷（舊規則：還差晚上）
  // 另有一張舊劇照 s1-still-04（→ ep07_a）
  const old = {
    schema: 1,
    days: {
      "2026-09-23": { m: T("2026-09-23T08:02"), e: null, cap: null, x: 0 },
      "2026-09-24": { m: T("2026-09-24T08:02"), e: T("2026-09-24T20:02"), cap: "s1-m-01", x: 0 },
      "2026-09-25": { m: T("2026-09-25T08:02"), e: T("2026-09-25T20:02"), cap: "s1-p-01", x: 1 },
      "2026-09-26": { m: T("2026-09-26T08:02"), e: null, cap: null, x: 0 },
    },
    collected: [
      { id: "s1-m-01", t: T("2026-09-24T20:02"), d: "2026-09-24" },
      { id: "s1-p-01", t: T("2026-09-25T20:02"), d: "2026-09-25" },
    ],
  };
  let m = L.migrateState(JSON.parse(JSON.stringify(old)), NOW, rng(1));
  ok(m, "轉換成功");
  eq(m.state.schema, 2);
  eq(m.state.collected.length, 3, "保留 2 張 + 補發今天早上 1 張");
  eq(m.state.collected[0].id, "s1-m-01"); eq(m.state.collected[1].id, "s1-p-01");
  eq(m.granted.length, 1); eq(m.granted[0].slot, "morning");
  eq(m.state.days["2026-09-26"].mc, m.granted[0].item.id);
  eq(m.state.days["2026-09-24"].ec, "s1-m-01", "舊 cap → 晚上的卡");
  eq(m.state.days["2026-09-23"].mc, null, "以前的日子不補發");
  eq(m.state.days["2026-09-25"].x, 1, "日曆紀錄保留");
  ok(L.normalizeState(JSON.parse(JSON.stringify(m.state))), "轉換後可通過 normalizeState");
  // 轉換後今天晚上還可以得卡
  const r = L.recordBrush(m.state, T("2026-09-26T21:40"), T("2026-09-26T21:42"), rng(2));
  eq(r.kind, "capture", "轉換後晚上可再得一張");

  // 舊劇照 + 皇室萌可最後收集（公主未有）+ 今天 cap 在晚上（早上的刷牙沒有卡）
  const old2 = {
    days: {
      "2026-09-20": { m: 1, e: 2, cap: "s1-m-01" }, "2026-09-21": { m: 1, e: 2, cap: "s1-p-01" },
      "2026-09-22": { m: 1, e: 2, cap: "s1-still-04" }, "2026-09-23": { m: 1, e: 2, cap: "s1-m-10" },
      "2026-09-24": { m: 1, e: 2, cap: "s1-still-09" }, "2026-09-25": { m: 1, e: null, cap: null },
      "2026-09-26": { m: T("2026-09-26T08:02"), e: T("2026-09-26T20:02"), cap: "s1-m-03" },
    },
    collected: [
      { id: "s1-m-01", t: 1, d: "2026-09-20" }, { id: "s1-p-01", t: 1, d: "2026-09-21" },
      { id: "s1-still-04", t: 1, d: "2026-09-22" }, { id: "s1-m-10", t: 1, d: "2026-09-23" },
      { id: "s1-still-09", t: 1, d: "2026-09-24" }, { id: "s1-m-03", t: 1, d: "2026-09-26" },
    ],
  };
  for (let i = 0; i < 200; i++) {
    m = L.migrateState(JSON.parse(JSON.stringify(old2)), NOW, rng(i));
    const ids = m.state.collected.map((c) => c.id);
    assert.deepStrictEqual(ids.slice(0, 6), ["s1-m-01", "s1-p-01", "s1-still-ep07a", "s1-m-10", "s1-still-ep20a", "s1-m-03"], "舊劇照換成新 id、次序不變");
    eq(ids[6], "s1-p-03", "皇室萌可（勇氣萌可）未有公主 → 補發的就是勇氣公主");
    eq(m.state.days["2026-09-26"].ec, "s1-m-03"); eq(m.state.days["2026-09-26"].mc, "s1-p-03");
    eq(m.state.days["2026-09-22"].ec, "s1-still-ep07a", "日曆中的舊劇照也轉換");
    eq(m.granted.length, 1, "今天晚上已有卡，只補發早上");
    // 繼續抽到 81 張仍符合規則
    const seq = ids.slice();
    const R = rng(900 + i);
    for (let id; (id = L.drawNextS1(seq, R));) seq.push(id);
    checkSequence(seq, "轉換後續抽 " + i);
  }
  // 皇室萌可收集了但公主沒有、而且不是最後一張（不正常的舊資料）→ 公主成為下一張
  const old3 = { days: {}, collected: [{ id: "s1-m-01" }, { id: "s1-p-01" }, { id: "s1-m-02" }, { id: "s1-m-12" }] };
  m = L.migrateState(old3, NOW, rng(3));
  eq(L.drawNext(m.state, rng(4)), "s1-p-02", "孤立的皇室萌可 → 公主成為下一張");
  // 今天只有晚上（舊規則：evening-no-morning，沒有卡）→ 補發晚上的卡
  const old4 = { schema: 1, days: { "2026-09-26": { m: null, e: T("2026-09-26T20:02"), cap: null } }, collected: [] };
  m = L.migrateState(old4, NOW, rng(5));
  eq(m.granted.length, 1); eq(m.granted[0].slot, "evening"); eq(m.granted[0].item.id, "s1-m-01", "空資料補發第 1 張愛心萌可");
  // 無法對應的舊劇照 → 改發未收集的劇照，張數不變
  const old5 = { days: {}, collected: [{ id: "s1-m-01" }, { id: "s1-p-01" }, { id: "s1-still-99", d: "2026-09-10" }, { id: "s1-still-01" }] };
  m = L.migrateState(old5, NOW, rng(6));
  eq(m.state.collected.length, 4, "張數不變");
  assert.deepStrictEqual(m.state.collected.map((c) => c.id), ["s1-m-01", "s1-p-01", "s1-still-ep01b", "s1-still-ep01a"]);
  ok(m.notes.some((n) => n.indexOf("s1-still-99") >= 0), "記錄無法對應");
  // schema 2 資料原樣通過；壞資料回傳 null
  const m2 = L.migrateState(JSON.parse(JSON.stringify(m.state)), NOW);
  eq(m2.granted.length, 0); eq(m2.state.collected.length, 4);
  eq(L.migrateState({ foo: 1 }, NOW), null);
  eq(L.migrateState(null, NOW), null);
  // 過了 04:00 分界：昨天的就不補發
  const m6 = L.migrateState({ days: { "2026-09-25": { m: 1, e: null, cap: null } }, collected: [] }, T("2026-09-26T08:00"), rng(1));
  eq(m6.granted.length, 0, "只補發今天");
  console.log("✓ 舊資料轉換（保留卡片與日曆、舊劇照對應、補發今天的卡、公主優先、無法對應時補發劇照）");
}

// ---- 刷牙動畫（brushfx.js）：泡泡按時間刷走，2:00 剛好全部刷走 ----
{
  const FX = require("../brushfx.js");
  eq(FX.BRUSH_MS, L.BRUSH_MS, "動畫長度 = 刷牙 2 分鐘");
  eq(FX.ZONE_MS, L.ZONE_MS, "每區 30 秒 = 刷牙提示");
  // 覆蓋檢查：某時間 e 已刷走的點是否蓋住 (x, y)
  function coveredAt(P, cnt, x, y) {
    for (let z = 0; z < 4; z++) {
      const st = P.zones[z].stamps;
      for (let k = 0; k < cnt[z]; k++) {
        const dx = st[2 * k] - x, dy = st[2 * k + 1] - y, r = FX.radius(P, z, k);
        if (dx * dx + dy * dy <= r * r) return true;
      }
    }
    return false;
  }
  for (const [w, h] of [[308, 308], [342, 187], [260, 260], [400, 225], [180, 180]]) {
    const P = FX.plan(w, h);
    const full = FX.counts(P, FX.BRUSH_MS);
    let miss = 0;
    for (let y = 0; y <= h; y += 2) for (let x = 0; x <= w; x += 2) if (!coveredAt(P, full, x, y)) miss++;
    eq(miss, 0, `2:00 全部刷走（${w}×${h}）`);
    // 每區在自己的 30 秒內刷完；之前完全未刷
    for (let q = 0; q < 4; q++) {
      const endQ = FX.counts(P, (q + 1) * FX.ZONE_MS - 1);
      const Z = P.zones[q];
      let m = 0;
      for (let y = Z.y; y <= Z.y + Z.h; y += 3) for (let x = Z.x; x <= Z.x + Z.w; x += 3) if (!coveredAt(P, FX.counts(P, (q + 1) * FX.ZONE_MS), x, y)) m++;
      eq(m, 0, `第 ${q + 1} 區在 ${(q + 1) * 30} 秒刷完（${w}×${h}）`);
      eq(FX.counts(P, q * FX.ZONE_MS + 1)[q], 0, "每區開頭牙刷先移動，未開始刷");
      ok(endQ[q] <= Z.n, "點數不超過");
    }
    // 單調：時間越後，刷走的點越多（每區都不會減少）
    let prev = [0, 0, 0, 0];
    for (let e = 0; e <= FX.BRUSH_MS; e += 250) {
      const c = FX.counts(P, e);
      for (let z = 0; z < 4; z++) ok(c[z] >= prev[z], "刷走的點只增不減");
      prev = c;
    }
    assert.deepStrictEqual(FX.counts(P, 0), [0, 0, 0, 0], "開始時全部蓋住");
    assert.deepStrictEqual(FX.counts(P, FX.BRUSH_MS + 5000), full, "超過 2:00 仍是全部刷走");
  }
  console.log("✓ 刷牙動畫：泡泡隨時間單調減少、四區跟提示同步、2:00 完全刷走（正方形卡和 16:9 劇照）");
}

// ---- 刷牙音樂、家長設定 ----
{
  const song = L.songFor(L.emptyState());
  eq(song.src, "audio/s1_op.m4a"); eq(song.title, "捕萌少女"); eq(song.season, "s1");
  ok(fs.existsSync(path.join(__dirname, "..", song.src)), "音樂檔存在");
  // 集齊第一季（第二季未開放）仍播第一季的歌
  const all = L.emptyState();
  s1.forEach((it) => all.collected.push({ id: it.id, t: 0, d: null, s: null }));
  eq(L.songFor(all).src, "audio/s1_op.m4a", "集齊後仍播第一季主題曲");
  eq(DATA.seasons.find((x) => x.id === "s2").music, null, "第二季未有歌");
  // 首頁音樂：純音樂版（music.home）；該季沒有 home 時用該季的 op；刷牙仍用 op
  const hs = L.songFor(L.emptyState(), "home");
  eq(hs.src, "audio/s1_home.m4a"); eq(hs.kind, "home"); eq(hs.instrumental, true); eq(hs.title, "捕萌少女");
  ok(fs.existsSync(path.join(__dirname, "..", hs.src)), "首頁音樂檔存在");
  eq(L.songFor(L.emptyState(), "op").src, "audio/s1_op.m4a"); eq(song.kind, "op"); eq(song.instrumental, false);
  eq(L.songFor(all, "home").src, "audio/s1_home.m4a", "集齊後首頁仍播第一季純音樂版");
  {
    const D2 = JSON.parse(JSON.stringify(DATA)); delete D2.seasons[0].music.home;
    const L2 = require("../logic.js")(D2);
    eq(L2.songFor(L2.emptyState(), "home").src, "audio/s1_op.m4a", "沒有 home 時首頁用該季的 op");
    eq(L2.songFor(L2.emptyState(), "home").kind, "op");
    // 第二季開放而只有 op：首頁用第二季的 op；第二季沒有音樂：沿用第一季的 home
    const D3 = JSON.parse(JSON.stringify(DATA)); D3.seasons[1].open = true;
    D3.seasons[1].music = { op: { src: "audio/s2_op.m4a", title: "x" } };
    const L3 = require("../logic.js")(D3);
    const st3 = L3.emptyState(); s1.forEach((it) => st3.collected.push({ id: it.id, t: 0, d: null, s: null }));
    eq(L3.songFor(st3, "home").src, "audio/s2_op.m4a", "第二季有 op 沒有 home：首頁用第二季的 op");
    D3.seasons[1].music = null;
    const L4 = require("../logic.js")(D3);
    eq(L4.songFor(st3, "home").src, "audio/s1_home.m4a", "第二季沒有音樂：沿用第一季的純音樂版");
    eq(L4.songFor(st3).src, "audio/s1_op.m4a");
  }
  assert.deepStrictEqual(L.normalizeSettings(null), { music: true }, "預設開啟");
  assert.deepStrictEqual(L.normalizeSettings({ music: false }), { music: false });
  assert.deepStrictEqual(L.normalizeSettings({ music: "x" }), { music: true });
  console.log("✓ 刷牙音樂：每季可各有主題曲（第一季《捕萌少女》），家長設定預設開啟");
}
// ---- 預備倒數：時段邊緣取對小朋友較有利的時間、家長設定「預備時間」 ----
{
  const T = (str) => new Date(str).getTime();
  const fresh = () => L.emptyState();
  // 11:59:55 開始倒數、12:00:05 開始刷 → 早上
  let st = fresh();
  eq(L.brushStartTs(st, T("2026-09-26T11:59:55"), T("2026-09-26T12:00:05")), T("2026-09-26T11:59:55"), "11:59:55 倒數 → 算早上");
  eq(L.planBrush(JSON.parse(JSON.stringify(st)), L.brushStartTs(st, T("2026-09-26T11:59:55"), T("2026-09-26T12:00:05")), rng(1)).slot, "morning");
  // 16:59:55 開始倒數、17:00:05 開始刷 → 晚上
  eq(L.brushStartTs(st, T("2026-09-26T16:59:55"), T("2026-09-26T17:00:05")), T("2026-09-26T17:00:05"), "16:59:55 倒數、17:00:05 開始 → 算晚上");
  // 16:59:50 倒數但 16:59:55 就按「我準備好了」→ 兩個都在時段外 → 用倒數開始的時間（時段外）
  eq(L.brushStartTs(st, T("2026-09-26T16:59:50"), T("2026-09-26T16:59:55")), T("2026-09-26T16:59:50"));
  // 兩個都能得到卡片 → 用倒數開始的時間
  eq(L.brushStartTs(st, T("2026-09-26T08:00:00"), T("2026-09-26T08:00:10")), T("2026-09-26T08:00:00"));
  // 03:59:55：昨晚未得到卡 → 算昨晚；昨晚已得到卡 → 04:00:05 開始算今天早上
  eq(L.dayKey(L.brushStartTs(st, T("2026-09-27T03:59:55"), T("2026-09-27T04:00:05"))), "2026-09-26", "03:59:55 倒數 → 昨晚");
  st.collected.push({ id: "s1-m-01", t: 0, d: "2026-09-26", s: "e" });
  st.days["2026-09-26"] = { m: null, e: 1, mc: null, ec: "s1-m-01", x: 0 };
  const ts = L.brushStartTs(st, T("2026-09-27T03:59:55"), T("2026-09-27T04:00:05"));
  eq(ts, T("2026-09-27T04:00:05"), "昨晚已得到卡 → 算今天早上");
  eq(L.slotOf(ts), "morning"); eq(L.dayKey(ts), "2026-09-27");
  // 早上已得到卡、11:59:55 倒數、12:00:05 開始：都得不到卡 → 在時段內的優先（倒數開始，日曆記早上）
  st.days["2026-09-27"] = { m: 1, e: null, mc: "s1-p-01", ec: null, x: 0 };
  st.collected.push({ id: "s1-p-01", t: 0, d: "2026-09-27", s: "m" });
  eq(L.brushStartTs(st, T("2026-09-27T11:59:55"), T("2026-09-27T12:00:05")), T("2026-09-27T11:59:55"));
  // 集齊後（得不到卡）16:59:55 倒數、17:00:05 開始 → 在時段內的一個（晚上，日曆有紀錄）
  const all = fresh();
  s1.forEach((it) => all.collected.push({ id: it.id, t: 0, d: null, s: null }));
  eq(L.brushStartTs(all, T("2026-09-26T16:59:55"), T("2026-09-26T17:00:05")), T("2026-09-26T17:00:05"));
  // canEarn 不改動 state（不抽卡）
  const before = JSON.stringify(fresh());
  const s0 = fresh(); L.canEarn(s0, T("2026-09-26T08:00")); L.brushStartTs(s0, T("2026-09-26T08:00"), T("2026-09-26T08:00:10"));
  eq(JSON.stringify(s0), before, "brushStartTs / canEarn 不改動資料");
  // 家長設定：預備時間預設開啟（不寫入），關閉時為 ready: false；刷牙音樂設定不受影響
  assert.deepStrictEqual(L.normalizeSettings({ music: true, ready: false }), { music: true, ready: false });
  assert.deepStrictEqual(L.normalizeSettings({ music: false, ready: true }), { music: false });
  assert.deepStrictEqual(L.normalizeSettings({ ready: false }), { music: true, ready: false });
  // 首頁音樂：預設開啟（不寫入），關閉時為 homeMusic: false；與刷牙音樂、預備時間互不影響
  assert.deepStrictEqual(L.normalizeSettings({ music: true, homeMusic: false }), { music: true, homeMusic: false });
  assert.deepStrictEqual(L.normalizeSettings({ music: false, homeMusic: true, ready: false }), { music: false, ready: false });
  assert.deepStrictEqual(L.normalizeSettings({ homeMusic: "x" }), { music: true });
  checks += 6;
  console.log("✓ 預備倒數：時段邊緣以倒數開始 / 真正開始中較有利的時間判斷，不改動資料；預備時間設定預設開啟");
}
// App 版本：主頁底部的小字（data.js 的 version）必須和 sw.js 的 VERSION 相同
{
  const swSrc = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
  const m = /var VERSION = "(v\d+)"/.exec(swSrc);
  ok(m, "sw.js 有 VERSION");
  eq(DATA.version, m[1], "data.js version 必須等於 sw.js VERSION");
  ok(/^v\d+$/.test(DATA.version), "版本格式 vN");
  console.log("✓ 版本標籤：data.js version = sw.js VERSION = " + DATA.version);
}
console.log(`全部測試通過（${checks} 項斷言）`);
