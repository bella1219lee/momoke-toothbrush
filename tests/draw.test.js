// 執行：node tests/draw.test.js
"use strict";
const assert = require("assert");
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

const s1 = DATA.items.filter((i) => i.season === "s1");
const royals = s1.filter((i) => i.category === "royal");
const princesses = s1.filter((i) => i.type === "princess");

// ---- 資料檢查 ----
assert.strictEqual(s1.length, 39, "第一季 39 張");
assert.strictEqual(s1.filter((i) => i.type === "momoke").length, 24);
assert.strictEqual(princesses.length, 5);
assert.strictEqual(s1.filter((i) => i.type === "still").length, 10);
assert.deepStrictEqual(royals.map((r) => r.name), ["愛心萌可", "正正萌可", "勇氣萌可", "盼盼萌可", "唱唱萌可"]);
const pairs = { "愛心萌可": "愛心公主", "正正萌可": "正義公主", "勇氣萌可": "勇氣公主", "盼盼萌可": "希望公主", "唱唱萌可": "音樂公主" };
royals.forEach((r) => {
  assert.strictEqual(L.byId[r.princess].name, pairs[r.name]);
  assert.strictEqual(L.byId[r.princess].royal, r.id);
});
assert.strictEqual(L.byId["s1-m-24"].name, "鬧鬧萌可");
assert.strictEqual(new Set(DATA.items.map((i) => i.id)).size, DATA.items.length, "id 不重複");
console.log("✓ 資料檢查");

// ---- 抽卡模擬 ----
const RUNS = 20000;
const positionHist = {}; // 用來看分佈是否合理
let maxRoyalPos = 0;
for (let run = 0; run < RUNS; run++) {
  const r = rng(run + 1);
  const seq = [];
  for (;;) {
    const id = L.drawNextS1(seq, r);
    if (!id) break;
    seq.push(id);
    assert(seq.length <= 39, "不可多於 39 張");
  }
  assert.strictEqual(seq.length, 39, "共 39 張");
  assert.strictEqual(new Set(seq).size, 39, "39 張都不重複");
  assert.strictEqual(seq[0], "s1-m-01", "第 1 張是愛心萌可");
  assert.strictEqual(seq[1], "s1-p-01", "第 2 張是愛心公主");
  assert.strictEqual(seq[38], "s1-m-24", "第 39 張是鬧鬧萌可");
  royals.forEach((ro) => {
    const i = seq.indexOf(ro.id);
    assert.strictEqual(seq[i + 1], ro.princess, ro.name + " 之後緊接其公主");
    maxRoyalPos = Math.max(maxRoyalPos, i + 1);
  });
  princesses.forEach((p) => {
    const i = seq.indexOf(p.id);
    assert.strictEqual(seq[i - 1], p.royal, p.name + " 前面是對應的皇室萌可");
  });
  seq.forEach((id, i) => { (positionHist[id] = positionHist[id] || []).push(i + 1); });
}
console.log(`✓ 抽卡模擬 ${RUNS} 次全部通過（皇室萌可最遲出現在第 ${maxRoyalPos} 張）`);
const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
console.log("  平均出現位置：" + ["s1-m-02", "s1-m-05", "s1-m-10", "s1-still-01"].map((id) => L.byId[id].name + " " + avg(positionHist[id])).join("，"));

// ---- 日子 / 時段 ----
const T = (s) => new Date(s).getTime();
assert.strictEqual(L.dayKey(T("2026-09-26T03:59")), "2026-09-25");
assert.strictEqual(L.dayKey(T("2026-09-26T04:00")), "2026-09-26");
assert.strictEqual(L.dayKey(T("2026-10-01T01:00")), "2026-09-30");
assert.strictEqual(L.dayKey(T("2026-01-01T02:00")), "2025-12-31");
assert.strictEqual(L.slotOf(T("2026-09-26T03:59")), "evening");
assert.strictEqual(L.slotOf(T("2026-09-26T04:00")), "morning");
assert.strictEqual(L.slotOf(T("2026-09-26T11:59")), "morning");
assert.strictEqual(L.slotOf(T("2026-09-26T12:00")), null);
assert.strictEqual(L.slotOf(T("2026-09-26T16:59")), null);
assert.strictEqual(L.slotOf(T("2026-09-26T17:00")), "evening");
console.log("✓ 日子與時段");

// ---- 刷牙紀錄流程 ----
{
  const st = L.emptyState();
  const rec = (s) => L.recordBrush(st, T(s), T(s) + 120000, rng(7));
  assert.strictEqual(rec("2026-09-26T08:00").kind, "morning");
  assert.strictEqual(rec("2026-09-26T09:00").kind, "morning-again");
  assert.strictEqual(rec("2026-09-26T14:00").kind, "outside");
  let r = rec("2026-09-26T21:00");
  assert.strictEqual(r.kind, "evening-capture"); assert.strictEqual(r.item.id, "s1-m-01"); assert.strictEqual(r.number, 1);
  assert.strictEqual(rec("2026-09-26T22:00").kind, "evening-again", "每天最多一張");
  assert.strictEqual(st.collected.length, 1);
  // 翌日（凌晨 02:00 仍屬前一天）
  assert.strictEqual(rec("2026-09-27T02:00").kind, "evening-again");
  rec("2026-09-27T07:30");
  r = rec("2026-09-27T01:00".replace("27T01", "27T20"));
  assert.strictEqual(r.item.id, "s1-p-01");
  // 只有晚上
  assert.strictEqual(rec("2026-09-28T21:00").kind, "evening-no-morning");
  assert.strictEqual(st.collected.length, 2);
  // 凌晨 01:00 的晚上刷牙屬於前一天：09-29 早上 + 09-30 01:00 → 捕捉
  rec("2026-09-29T06:00");
  r = rec("2026-09-30T01:00");
  assert.strictEqual(r.kind, "evening-capture"); assert.strictEqual(r.day, "2026-09-29");
  assert.strictEqual(st.collected.length, 3);
  // 補齊到 39 張
  let d = new Date(2026, 9, 1);
  let last;
  while (st.collected.length < 39) {
    const k = L.ymd(d);
    L.recordBrush(st, T(k + "T08:00"), T(k + "T08:02"), Math.random);
    last = L.recordBrush(st, T(k + "T20:00"), T(k + "T20:02"), Math.random);
    d.setDate(d.getDate() + 1);
  }
  assert.strictEqual(last.item.id, "s1-m-24");
  assert.strictEqual(last.seasonComplete, "s1");
  const k = L.ymd(d);
  assert.strictEqual(L.recordBrush(st, T(k + "T08:00"), T(k + "T08:02")).allDone, true);
  assert.strictEqual(L.recordBrush(st, T(k + "T20:00"), T(k + "T20:02")).kind, "evening-all-done");
  // normalizeState
  const copy = L.normalizeState(JSON.parse(JSON.stringify(st)));
  assert.strictEqual(copy.collected.length, 39);
  assert.strictEqual(L.normalizeState({ foo: 1 }), null);
  console.log("✓ 刷牙紀錄流程（早上/晚上/時段外/每天一張/凌晨歸前一天/集齊 39 張）");
}
console.log("全部測試通過");
