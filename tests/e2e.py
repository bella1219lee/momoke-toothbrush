#!/usr/bin/env python3
"""End-to-end browser test (Playwright/Chromium, iPhone viewport 390x844).
Run:  /workspace/.pwvenv/bin/python tests/e2e.py   (starts its own local server on 127.0.0.1:8765)
Setup (once): uv venv /workspace/.pwvenv && uv pip install --python /workspace/.pwvenv playwright pillow opencc-python-reimplemented
              (/workspace/.pwvenv/bin/python -m playwright install chromium  if the browser is missing)
"""
import json, os, re, subprocess, sys, time
from playwright.sync_api import sync_playwright

APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V2 = "/workspace/momoke/images/s1_stills_v2"
server = None
def start_server():
    global server
    server = subprocess.Popen([sys.executable, "-m", "http.server", "8765", "--bind", "127.0.0.1"], cwd=APP_DIR,
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
def stop_server():
    server.terminate(); server.wait()

BASE = os.environ.get("BASE", "http://127.0.0.1:8765/")
SHOTS = os.path.join(APP_DIR, "screenshots")
os.makedirs(SHOTS, exist_ok=True)
for f in os.listdir(SHOTS):
    if f.endswith(".png"): os.remove(os.path.join(SHOTS, f))
results = []
errors = []

def shot(page, name, wait=700):
    page.wait_for_timeout(wait)  # let fade-in / reveal transitions finish
    page.screenshot(path=os.path.join(SHOTS, name))

def ok(cond, label):
    results.append((bool(cond), label))
    print(("PASS " if cond else "FAIL ") + label, flush=True)

def url(now, speed=60):
    return f"{BASE}?test=1&speed={speed}&now={now}"

def text(page, sel):
    return page.locator(sel).inner_text().strip()

def state(page):
    return page.evaluate("window.__momoke.state()")

def open_home(page, now, speed=60):
    page.goto(url(now, speed))
    page.wait_for_selector("#screen-home.active")

def brush(page, now, speed=60, on_brush=None):
    open_home(page, now, speed)
    page.click("#btn-start")
    page.wait_for_selector("#screen-brush.active")
    if on_brush: on_brush()
    page.wait_for_selector("#screen-result.active, #screen-capture.active", timeout=30000)
    if page.locator("#screen-capture.active").count():
        page.wait_for_selector("#capture-info.show", timeout=8000)
        return "capture"
    return "result"

def reveal_info(page):
    return page.evaluate("""() => ({ revealed: Number(document.getElementById('reveal').getAttribute('data-revealed')),
        open: document.querySelectorAll('#reveal .cover.open').length, elapsed: window.__momoke.elapsed(),
        id: document.getElementById('reveal').getAttribute('data-id'), zone: document.getElementById('zone-text').textContent,
        pending: (window.__momoke.state().pending || {}).id || null,
        stored: (JSON.parse(localStorage.getItem('momoke-brush-state-v1') || '{}').pending || {}).id || null })""")

def slot(page, sid):
    return text(page, f"#{sid}")

def open_parent(page):
    box = page.locator("#app-title").bounding_box()
    page.mouse.move(box["x"] + 20, box["y"] + 10)
    page.mouse.down(); page.wait_for_timeout(3300); page.mouse.up()
    page.wait_for_selector("#parent:not([hidden])")

def imgs_loaded(page, sel, n=None, timeout=10000):
    cond = f"[...document.querySelectorAll('{sel}')]"
    js = f"{cond}.length > 0 && {cond}.every(i => i.complete && i.naturalWidth > 0)"
    if n is not None: js = f"{cond}.length === {n} && " + js
    page.wait_for_function(js, timeout=timeout)

ROYAL = ["s1-m-0%d" % k for k in range(1, 6)]
blurbs = json.load(open(os.path.join(V2, "blurbs.json"), encoding="utf-8"))
blurbs.sort(key=lambda b: b["file"])

start_server()
with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1, is_mobile=True,
                              has_touch=True, timezone_id="Asia/Hong_Kong", locale="zh-HK", accept_downloads=True)
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("dialog", lambda d: d.accept())

    # ---- 1. first load / home ----
    open_home(page, "2026-09-26T08:00")
    ok(text(page, "#home-count") == "0 / 81", "home shows 0 / 81 on first load")
    ok("早上" in slot(page, "slot-m") and "刷牙得一張卡片" in slot(page, "slot-m"), "home: morning window open → 刷牙得一張卡片")
    ok("下午五點開始" in slot(page, "slot-e"), "home: evening not yet → 下午五點開始")
    ok(text(page, "#home-hint") == "現在刷牙兩分鐘，就能得到一張卡片！", "home hint: 現在刷牙兩分鐘，就能得到一張卡片！")
    body = page.locator("body").inner_text()
    ok("test" not in body.lower() and "speed" not in body.lower(), "no test params visible in UI")
    ok(page.evaluate("document.querySelector('.mascot img').naturalWidth") > 0, "mascot 愛心萌可 image loads")

    # ---- 2. interrupted brushing keeps the same pending card ----
    page.goto(url("2026-09-26T08:00", 10))
    page.wait_for_selector("#screen-home.active")
    page.click("#btn-start")
    page.wait_for_selector("#screen-brush.active")
    ok(text(page, "#zone-text") == "請刷上排左邊", "first zone prompt 請刷上排左邊")
    page.wait_for_timeout(3600)
    r1 = reveal_info(page)
    ok(r1["id"] == "s1-m-01" and r1["pending"] == "s1-m-01" and r1["stored"] == "s1-m-01", f"pending card decided at start and saved in localStorage ({r1['id']})")
    ok(r1["revealed"] == 1, f"first quarter uncovered after 30 s before stopping ({r1['revealed']})")
    page.click("#btn-stop")
    page.wait_for_selector("#screen-home.active")
    ok("○" in slot(page, "slot-m") and len(state(page)["collected"]) == 0, "stopped brushing does not count")
    ok(state(page)["pending"]["id"] == "s1-m-01", "pending card kept after stopping")
    page.reload(); page.wait_for_selector("#screen-home.active")
    page.click("#btn-start"); page.wait_for_selector("#screen-brush.active"); page.wait_for_timeout(300)
    r2 = reveal_info(page)
    ok(r2["id"] == r1["id"] and r2["revealed"] == 0, "restart after stop (and reload) reuses the same pending card, covered again")
    # ---- 3. visibility pause ----
    page.evaluate("""() => { Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'hidden'});
                         document.dispatchEvent(new Event('visibilitychange')); }""")
    t1 = text(page, "#brush-time"); page.wait_for_timeout(1500); t2 = text(page, "#brush-time")
    ok(t1 == t2 and page.locator("#brush-paused").is_visible(), f"timer pauses when hidden ({t1} == {t2})")
    page.evaluate("""() => { Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'visible'});
                         document.dispatchEvent(new Event('visibilitychange')); }""")
    page.wait_for_timeout(1200)
    t3 = text(page, "#brush-time")
    ok(t3 != t2 and not page.locator("#brush-paused").is_visible(), f"timer resumes when visible ({t2} -> {t3})")
    page.click("#btn-stop")
    page.wait_for_selector("#screen-home.active")

    # ---- 4. morning brushing: reveal quarters at 30/60/90/120 s (speed 10: 30 s = 3 s) ----
    page.goto(url("2026-09-26T08:00", 10))
    page.wait_for_selector("#screen-home.active")
    page.click("#btn-start")
    page.wait_for_selector("#screen-brush.active")
    t0 = time.time()
    def at(sec):  # wait until simulated brushing time ~sec
        page.wait_for_function(f"window.__momoke.elapsed() !== null && window.__momoke.elapsed() >= {sec * 1000}", timeout=20000)
    at(15); r = reveal_info(page)
    ok(r["revealed"] == 0 and r["open"] == 0 and r["zone"] == "請刷上排左邊", f"0–30 s: card fully covered, 請刷上排左邊 ({r['revealed']})")
    ok(page.locator("#reveal").is_visible() and page.locator("#slideshow").is_hidden(), "earning brush shows the covered card (not slideshow)")
    ok(page.locator("#brush-time").is_visible() and page.locator("#ring-fg").is_visible(), "ring/timer still visible")
    at(44); r = reveal_info(page)
    ok(r["revealed"] == 1 and r["open"] == 1 and r["zone"] == "請刷上排右邊", f"30 s: 1 quarter uncovered + 請刷上排右邊 ({r})")
    ok(page.evaluate("getComputedStyle(document.querySelector('.cover[data-q=\"0\"]')).opacity") != "1", "top-left cover is fading/hidden")
    page.screenshot(path=os.path.join(SHOTS, "02_reveal_1quarter.png"))
    at(75); r = reveal_info(page)
    ok(r["revealed"] == 2 and r["zone"] == "請刷下排左邊", f"60 s: 2 quarters uncovered + 請刷下排左邊 ({r['revealed']})")
    at(104); r = reveal_info(page)
    ok(r["revealed"] == 3 and r["zone"] == "請刷下排右邊", f"90 s: 3 quarters uncovered + 請刷下排右邊 ({r['revealed']})")
    page.screenshot(path=os.path.join(SHOTS, "03_reveal_3quarters.png"))
    page.wait_for_selector("#screen-brush.finished", timeout=10000)
    r = reveal_info(page)
    ok(r["revealed"] == 4 and r["open"] == 4, f"120 s: card fully shown ({r['revealed']})")
    page.screenshot(path=os.path.join(SHOTS, "04_reveal_full.png"))
    page.wait_for_selector("#screen-capture.active", timeout=5000)
    page.wait_for_selector("#capture-info.show", timeout=5000)
    ok(text(page, "#capture-name") == "愛心萌可", "morning brush earns card 1 = 愛心萌可 (same as the revealed card)")
    ok("第 1 張 / 81 張" in text(page, "#capture-number"), "capture number 第 1 張 / 81 張")
    ok(page.evaluate("document.querySelector('#capture-front img').naturalWidth") > 0, "captured card image shown")
    shot(page, "05_capture.png")
    page.click("#btn-capture-done")
    page.wait_for_selector("#screen-home.active")
    ok(text(page, "#home-count") == "1 / 81", "home count 1 / 81")
    ok("✓" in slot(page, "slot-m") and "得到卡片" in slot(page, "slot-m"), "home: morning ✓ 得到卡片！")
    ok(text(page, "#home-hint") == "早上的卡片已經得到了！晚上五點後刷牙，可以再得到一張！", "home hint after morning card")
    ok(state(page)["pending"] is None and state(page)["days"]["2026-09-26"]["mc"] == "s1-m-01", "day record mc = s1-m-01, pending cleared")

    # ---- 5. second brushing in same window → slideshow, no card ----
    def slideshow_check():
        page.wait_for_timeout(600)
        ok(page.locator("#slideshow").is_visible() and page.locator("#reveal").is_hidden(), "non-earning brush shows slideshow instead of covered card")
        page.wait_for_function("document.querySelector('#slide-frame img') && document.querySelector('#slide-frame img').naturalWidth > 0")
        ok(text(page, "#slide-name") == "愛心萌可", "slideshow shows collected card 愛心萌可")
        ok("早上已經得到卡片" in text(page, "#brush-caption"), "slideshow caption explains window already earned")
        page.screenshot(path=os.path.join(SHOTS, "06_slideshow.png"))
    r = brush(page, "2026-09-26T09:00", speed=10, on_brush=slideshow_check)
    ok(r == "result" and "早上已經得到卡片" in text(page, "#result-msg"), "second morning brushing: praised, no card")
    ok(len(state(page)["collected"]) == 1, "still 1 card")

    # ---- 6. outside window ----
    def outside_check():
        page.wait_for_timeout(300)
        ok(page.locator("#slideshow").is_visible() and "不是刷牙時段" in text(page, "#brush-caption"), "outside window: slideshow + caption")
    r = brush(page, "2026-09-26T14:00", speed=30, on_brush=outside_check)
    ok(r == "result" and "不會得到卡片" in text(page, "#result-msg"), "outside window: praised, no card")
    page.click("#btn-result-home")
    ok(len(state(page)["collected"]) == 1 and "下午五點開始" in slot(page, "slot-e"), "outside window: no card, evening slot 下午五點開始")

    # home screenshot with the new indicators (morning ✓, evening open)
    open_home(page, "2026-09-26T18:00")
    ok("得到卡片" in slot(page, "slot-m") and "刷牙得一張卡片" in slot(page, "slot-e"), "18:00 home: morning 得到卡片！ / evening 刷牙得一張卡片")
    ok(text(page, "#home-hint") == "今天已經得到一張卡片！現在刷牙兩分鐘，可以再得到一張！", "18:00 hint")
    shot(page, "01_home.png", 900)

    # ---- 7. evening → card 2 愛心公主 ----
    r = brush(page, "2026-09-26T21:00")
    ok(r == "capture" and text(page, "#capture-name") == "愛心公主", "evening brush earns card 2 = 愛心公主")
    page.wait_for_function("document.querySelector('#capture-front img') && document.querySelector('#capture-front img').naturalWidth > 0")
    page.click("#btn-capture-done")
    ok(text(page, "#home-hint") == "今天的兩張卡片都得到了，明天再來吧！", "hint after 2 cards today")
    ok(text(page, "#home-count") == "2 / 81", "home count 2 / 81")
    r = brush(page, "2026-09-26T22:30")
    ok(r == "result" and "晚上已經得到卡片" in text(page, "#result-msg"), "second evening brushing: no extra card")
    r = brush(page, "2026-09-27T02:00")
    ok(r == "result" and "晚上已經得到卡片" in text(page, "#result-msg"), "02:00 counts as previous evening (already earned)")

    # ---- 8. missed morning → only forfeits that card; evening still earns ----
    open_home(page, "2026-09-27T14:00")
    ok("已錯過" in slot(page, "slot-m"), "missed morning shows 已錯過")
    ok(text(page, "#home-hint") == "早上的刷牙錯過了。晚上五點後刷牙，還可以得到一張卡片！", "missed-morning hint")
    r = brush(page, "2026-09-27T20:00")
    ok(r == "capture", "evening after missed morning still earns a card (no reset)")
    page.click("#btn-capture-done")
    ok(text(page, "#home-count") == "3 / 81", "count 3 / 81")

    # ---- 9. after-midnight evening counts for previous day; morning next ----
    r = brush(page, "2026-09-29T01:00", speed=120)
    ok(r == "capture" and state(page)["days"]["2026-09-28"]["ec"], "01:00 brush earns 9/28 evening card")
    r = brush(page, "2026-09-29T06:00", speed=120)
    ok(r == "capture", "9/29 morning card")

    # ---- 10. more days for album content ----
    for d in range(1, 7):
        brush(page, f"2026-10-{d:02d}T07:00", speed=240)
        brush(page, f"2026-10-{d:02d}T19:30", speed=240)
    st = state(page)
    ok(len(st["collected"]) == 17, f"17 cards after 17 counted brushings (got {len(st['collected'])})")
    seq = [c["id"] for c in st["collected"]]
    ok(seq[0] == "s1-m-01" and seq[1] == "s1-p-01", "draw order: first two fixed")
    royal_ok = all(seq[i + 1] == "s1-p-" + seq[i][-2:] for i in range(len(seq) - 1) if seq[i] in ROYAL)
    ok(royal_ok, "royals immediately followed by their princess in UI flow")
    ok(all(st["days"][c["d"]]["mc" if c["s"] == "m" else "ec"] == c["id"] for c in st["collected"]), "each card recorded in its day/window")
    print("  collected:", seq)

    # ---- 11. album ----
    open_home(page, "2026-10-06T21:00")
    page.click("#btn-album")
    page.wait_for_selector("#screen-album.active")
    tabs = [t.strip() for t in page.locator(".tab").all_inner_texts()]
    n_m = sum(1 for c in seq if c.startswith("s1-m-")); n_p = sum(1 for c in seq if c.startswith("s1-p-")); n_s = sum(1 for c in seq if c.startswith("s1-still-"))
    ok(tabs == [f"萌可 {n_m}/24", f"公主 {n_p}/5", f"劇照 {n_s}/52"], f"album tabs show /24 /5 /52 ({tabs})")
    ok(text(page, "#album-season") == f"第一季 {len(seq)} / 81", "album season chip n / 81")
    ok(page.locator("#album-grid .cell").count() == 24 and page.locator("#album-grid .cell:not(.locked)").count() == n_m, f"萌可 tab: 24 slots, {n_m} collected")
    imgs_loaded(page, "#album-grid img")
    page.click(".tab[data-tab=princess]")
    ok(page.locator("#album-grid .cell").count() == 5, "公主 tab has 5 slots")
    page.click(".tab[data-tab=still]")
    ok(page.locator("#album-grid .cell").count() == 52 and page.locator("#album-grid .cell:not(.locked)").count() == n_s, f"劇照 tab has 52 slots, {n_s} collected")
    ok("第二季 敬請期待" in page.locator("body").inner_text(), "season 2 shown locked 第二季 敬請期待")

    # ---- 12. full-screen view + swipe + arrows ----
    page.click(".tab[data-tab=momoke]")
    page.locator("#album-grid .cell:not(.locked)").first.click()
    page.wait_for_selector("#viewer:not([hidden])")
    first_name = text(page, "#viewer-name")
    ok(first_name == "愛心萌可" and "善良" in text(page, "#viewer-blurb"), "full-screen view shows name + blurb")
    page.wait_for_function("document.querySelector('#viewer-card img') && document.querySelector('#viewer-card img').naturalWidth > 0")
    cdp = ctx.new_cdp_session(page)
    def swipe(x0, x1, y=420):
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x0, "y": y}]})
        for i in range(1, 6):
            cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x0 + (x1 - x0) * i / 5, "y": y}]})
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        page.wait_for_timeout(400)
    if n_m >= 2:
        swipe(320, 70)
        second = text(page, "#viewer-name")
        ok(second != first_name and text(page, "#viewer-count").startswith("2 /"), f"swipe left -> next card ({second})")
        swipe(70, 320)
        ok(text(page, "#viewer-name") == first_name, "swipe right -> previous card")
        page.click("#viewer-next"); page.wait_for_timeout(350)
        ok(text(page, "#viewer-name") == second, "arrow › -> next card")
        page.click("#viewer-prev"); page.wait_for_timeout(350)
        ok(text(page, "#viewer-name") == first_name, "arrow ‹ -> previous card")
    page.click("#viewer-close")
    ok(page.locator("#viewer").is_hidden(), "viewer closes")

    # ---- 13. calendar ----
    open_home(page, "2026-10-06T21:00")
    page.click("#btn-calendar")
    page.wait_for_selector("#screen-calendar.active")
    ok(text(page, "#cal-title") == "2026年10月", "calendar opens on current month")
    ok("⭐ 得到一張卡片" in text(page, ".cal-legend") and "捕捉" not in text(page, ".cal-legend"), "calendar legend updated (⭐ 得到一張卡片)")
    page.click("#cal-prev")
    ok(text(page, "#cal-title") == "2026年9月", "prev month works")
    def cell(k): return page.locator(f'.cal-day[data-day="{k}"]').inner_text()
    ok("☀" in cell("2026-09-26") and "🌙" in cell("2026-09-26") and cell("2026-09-26").count("⭐") == 2, "9/26: ☀️🌙 ⭐⭐ (2 cards)")
    ok("☀" not in cell("2026-09-27") and "🌙" in cell("2026-09-27") and cell("2026-09-27").count("⭐") == 1, "9/27: 🌙 ⭐ (missed morning)")
    ok("🌙" in cell("2026-09-28") and cell("2026-09-28").count("⭐") == 1, "9/28: 01:00 brush belongs to 9/28")
    ok(text(page, "#cal-summary") == "這個月得到了 5 張卡片！", f"September summary counts cards ({text(page, '#cal-summary')})")
    shot(page, "09_calendar.png")

    # ---- 14. reload persists ----
    page.reload()
    page.wait_for_selector("#screen-home.active")
    ok(page.evaluate("window.__momoke.state().collected.length") == 17, "data persists after reload")

    # ---- 15. parent area: long press, export, reset, import (new + old format) ----
    open_home(page, "2026-10-06T21:00")
    box = page.locator("#app-title").bounding_box()
    page.mouse.move(box["x"] + 20, box["y"] + 10)
    page.mouse.down(); page.wait_for_timeout(1000); page.mouse.up()
    ok(page.locator("#parent").is_hidden(), "short press does not open parent area")
    open_parent(page)
    ok(page.locator("#parent").is_visible(), "3 s long-press on title opens parent area")
    rules = text(page, ".parent-rules")
    ok("每次都能得到一張卡片" in rules and "每天最多兩張" in rules and "81" in rules, "parent help describes the new rule")
    ok("17 / 81" in text(page, "#parent-info"), "parent info shows 17 / 81")
    with page.expect_download() as dl:
        page.click("#btn-export")
    backup = os.path.join("/tmp", "momoke-backup-test.json")
    dl.value.save_as(backup)
    data = json.load(open(backup, encoding="utf-8"))
    ok(len(data["state"]["collected"]) == 17 and data["state"]["schema"] == 2, "export backup JSON contains 17 cards (schema 2)")
    page.click("#btn-reset")
    page.wait_for_selector("#screen-home.active")
    ok(text(page, "#home-count") == "0 / 81", "reset clears all data")
    open_parent(page)
    page.set_input_files("#import-file", backup)
    page.wait_for_timeout(600)
    ok(text(page, "#home-count") == "17 / 81", "import new-format backup restores 17 cards")
    old_backup = {"app": "momoke-brush", "version": 1, "exportedAt": "2026-09-25T13:00:00.000Z", "state": {
        "schema": 1,
        "days": {"2026-09-23": {"m": 1, "e": 2, "cap": "s1-m-01", "x": 0}, "2026-09-24": {"m": 1, "e": 2, "cap": "s1-p-01", "x": 0},
                 "2026-09-25": {"m": 1, "e": 2, "cap": "s1-still-06", "x": 0}},
        "collected": [{"id": "s1-m-01", "t": 1, "d": "2026-09-23"}, {"id": "s1-p-01", "t": 1, "d": "2026-09-24"}, {"id": "s1-still-06", "t": 1, "d": "2026-09-25"}]}}
    old_path = "/tmp/momoke-old-backup.json"
    json.dump(old_backup, open(old_path, "w", encoding="utf-8"), ensure_ascii=False)
    open_parent(page)
    page.set_input_files("#import-file", old_path)
    page.wait_for_timeout(600)
    st = state(page)
    ok(text(page, "#home-count") == "3 / 81" and [c["id"] for c in st["collected"]] == ["s1-m-01", "s1-p-01", "s1-still-ep13a"] and st["schema"] == 2,
       "import old-format (v1) backup: converted, old still s1-still-06 → s1-still-ep13a")

    # ---- 16. migration from an old-format localStorage state ----
    old_state = {"schema": 1, "days": {
        "2026-09-24": {"m": 1, "e": 2, "cap": "s1-m-01", "x": 0},
        "2026-09-25": {"m": 1, "e": 2, "cap": "s1-p-01", "x": 1},
        "2026-09-26": {"m": 3, "e": None, "cap": None, "x": 0}},  # today: morning done under old rule, no card yet
        "collected": [{"id": "s1-m-01", "t": 1, "d": "2026-09-24"}, {"id": "s1-p-01", "t": 1, "d": "2026-09-25"}]}
    # plus an old still collected earlier
    old_state["days"]["2026-09-22"] = {"m": 1, "e": 2, "cap": "s1-still-04", "x": 0}
    old_state["collected"].append({"id": "s1-still-04", "t": 1, "d": "2026-09-22"})
    page.evaluate("s => { localStorage.clear(); localStorage.setItem('momoke-brush-state-v1', JSON.stringify(s)); }", old_state)
    page.goto(url("2026-09-26T19:00"))
    page.wait_for_selector("#screen-capture.active", timeout=8000)
    page.wait_for_selector("#capture-info.show", timeout=8000)
    st = state(page)
    ids = [c["id"] for c in st["collected"]]
    ok(st["schema"] == 2 and ids[:3] == ["s1-m-01", "s1-p-01", "s1-still-ep07a"], f"migration keeps cards and maps s1-still-04 → s1-still-ep07a ({ids})")
    ok(len(ids) == 4 and st["days"]["2026-09-26"]["mc"] == ids[3], "migration grants today's morning card (morning brushed under old rule)")
    ok("補送" in text(page, "#capture-note"), "granted card shown with explanation note")
    ok(st["days"]["2026-09-24"]["ec"] == "s1-m-01" and st["days"]["2026-09-25"]["x"] == 1, "calendar history kept (old cap → evening card)")
    ok(page.evaluate("!!localStorage.getItem('momoke-brush-state-v1-schema1-backup')"), "old raw data backed up in localStorage")
    shot(page, "10_migration_grant.png")
    page.click("#btn-capture-done")
    page.wait_for_selector("#screen-home.active")
    ok(text(page, "#home-count") == "4 / 81", "home 4 / 81 after migration")
    page.reload(); page.wait_for_selector("#screen-home.active")
    ok(page.locator("#screen-capture.active").count() == 0 and len(state(page)["collected"]) == 4, "migration runs only once")
    r = brush(page, "2026-09-26T19:10")
    ok(r == "capture" and len(state(page)["collected"]) == 5, "after migration evening brushing earns a card")
    page.click("#btn-capture-done")
    page.click("#btn-album"); page.click(".tab[data-tab=still]")
    ok("正義公主與正正萌可" in page.locator("#album-grid .cell:not(.locked) .cell-name").all_inner_texts()
       and page.locator('#album-grid img[src="img/stills/ep07_a.jpg"]').count() == 1, "migrated still appears in 劇照 tab as ep07_a 正義公主與正正萌可")

    # ---- 17. slideshow placeholder when nothing collected ----
    page.evaluate("localStorage.clear()")
    def empty_check():
        page.wait_for_timeout(300)
        ok(page.locator("#slide-frame.friendly").is_visible() and "收集萌可卡片" in text(page, "#slide-frame"), "no cards yet: friendly placeholder in slideshow")
        page.screenshot(path=os.path.join(SHOTS, "07_slideshow_empty.png"))
    brush(page, "2026-09-26T14:00", speed=30, on_brush=empty_check)

    # ---- 18. service worker + offline (all 52 stills cached) ----
    page.evaluate("s => localStorage.setItem('momoke-brush-state-v1', JSON.stringify(s))", data["state"])
    page.goto(BASE)
    page.evaluate("navigator.serviceWorker.ready.then(() => true)")
    page.reload(); page.wait_for_selector("#screen-home.active")
    ok(page.evaluate("!!navigator.serviceWorker.controller"), "service worker registered and controlling page")
    for _ in range(40):
        cached = page.evaluate("caches.keys().then(ks => Promise.all(ks.map(k => caches.open(k).then(c => c.keys().then(r => [k, r.map(x => new URL(x.url).pathname)])))))")
        v3 = dict(cached).get("momoke-brush-v3", [])
        if len(v3) >= 91: break
        page.wait_for_timeout(250)
    print("  caches:", [(k, len(v)) for k, v in cached])
    all_imgs = page.evaluate("window.MOMOKE_DATA.items.map(i => i.img)")
    missing = [u for u in all_imgs if "/" + u not in v3]
    ok(not missing and len(all_imgs) == 81, f"cache v3 holds all 81 card images incl. 52 stills (missing {missing[:3]})")
    ok(all(f in v3 for f in ["/", "/index.html", "/styles.css", "/data.js", "/logic.js", "/app.js", "/manifest.webmanifest", "/icons/icon-192.png"]), "cache v3 holds core files")
    ok(not any(k == "momoke-brush-v2" for k, _ in cached), "old v2 cache removed")
    ctx.set_offline(True)
    stop_server()  # really offline: no server at all
    page.reload(); page.wait_for_selector("#screen-home.active")
    ok(text(page, "#home-count") == "17 / 81", "app loads offline with data")
    ok(page.evaluate("document.querySelector('.mascot img').naturalWidth") > 0, "images load offline")
    page.goto(url("2026-10-07T08:00", 240))
    page.wait_for_selector("#screen-home.active")
    # offline: show every still in album (fake full collection) and make sure all load
    page.evaluate("""() => {
        const items = window.MOMOKE_DATA.items.filter(i => i.season === 's1' && i.id !== 's1-m-24');
        const st = { schema: 2, days: {}, pending: null, collected: items.map((it, i) => ({ id: it.id, t: 0, d: '2026-10-01', s: null })) };
        localStorage.setItem('momoke-brush-state-v1', JSON.stringify(st));
    }""")
    page.reload(); page.wait_for_selector("#screen-home.active")
    page.click("#btn-album"); page.click(".tab[data-tab=still]")
    imgs_loaded(page, "#album-grid img", 52)
    ok(True, "offline: all 52 still images load from cache")
    r = brush(page, "2026-10-07T08:00", speed=240)
    ok(r == "capture" and text(page, "#capture-name") == "鬧鬧萌可", "offline brushing works (earns 81st card 鬧鬧萌可)")
    ctx.set_offline(False)
    start_server()

    # ---- 19. last card 鬧鬧 (#81) via normal draw + celebration ----
    open_home(page, "2026-11-01T08:00")
    page.evaluate("""() => {
        const L = window.__momoke.logic; const ids = [];
        let r = 1; const rng = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
        while (ids.length < 80) ids.push(L.drawNextS1(ids, rng));
        const st = { schema: 2, days: {}, pending: null, collected: ids.map((id, i) => ({ id, t: 0, d: '2026-10-' + String(i % 28 + 1).padStart(2, '0'), s: null })) };
        localStorage.setItem('momoke-brush-state-v1', JSON.stringify(st));
    }""")
    r = brush(page, "2026-11-01T08:00", speed=240)
    ok(r == "capture" and text(page, "#capture-name") == "鬧鬧萌可", "81st card is 鬧鬧萌可")
    ok("第 81 張 / 81 張" in text(page, "#capture-number"), "capture number shows 第 81 張 / 81 張")
    page.click("#btn-capture-done")
    page.wait_for_selector("#screen-celebrate.active")
    ok(text(page, "#celebrate-title") == "恭喜集齊第一季！", "celebration 恭喜集齊第一季！")
    ok("第二季 敬請期待" in text(page, "#screen-celebrate"), "celebration shows 第二季 敬請期待")
    shot(page, "12_celebrate.png", 900)
    def complete_check():
        page.wait_for_timeout(300)
        ok(page.locator("#slideshow").is_visible() and "集齊" in text(page, "#brush-caption"), "after completion: slideshow while brushing")
    r = brush(page, "2026-11-01T20:00", speed=240, on_brush=complete_check)
    ok(r == "result" and "集齊" in text(page, "#result-msg"), "after completion, brushing still works (no more cards)")

    # ---- 20. all princesses + stills collected: names from blurbs.json ----
    open_home(page, "2026-11-10T10:00")
    page.evaluate("""() => {
        const items = window.MOMOKE_DATA.items.filter(i => i.season === 's1' && (i.type !== 'momoke' || ['s1-m-01','s1-m-02','s1-m-03','s1-m-04','s1-m-05','s1-m-06','s1-m-12'].includes(i.id)));
        const st = { schema: 2, days: {}, pending: null, collected: items.map((it, i) => ({ id: it.id, t: 0, d: '2026-10-' + String(i % 28 + 1).padStart(2, '0'), s: null })) };
        localStorage.setItem('momoke-brush-state-v1', JSON.stringify(st));
    }""")
    page.reload(); page.wait_for_selector("#screen-home.active")
    page.click("#btn-album")
    page.click(".tab[data-tab=princess]")
    imgs_loaded(page, "#album-grid img", 5)
    names = page.locator("#album-grid .cell-name").all_inner_texts()
    ok(names == ["愛心公主", "正義公主", "勇氣公主", "希望公主", "音樂公主"], f"公主 tab: all 5 real images in order")
    tabs = [t.strip() for t in page.locator(".tab").all_inner_texts()]
    ok(tabs == ["萌可 7/24", "公主 5/5", "劇照 52/52"], f"album tabs {tabs}")
    page.click(".tab[data-tab=still]")
    imgs_loaded(page, "#album-grid img", 52)
    names = page.locator("#album-grid .cell-name").all_inner_texts()
    ok(names == [b["title"] for b in blurbs], "劇照 tab: 52 stills ordered by episode then a/b, names exactly from blurbs.json")
    srcs = page.evaluate("[...document.querySelectorAll('#album-grid img')].map(i => i.getAttribute('src'))")
    ok(srcs == ["img/stills/" + b["file"] for b in blurbs], "劇照 tab image order ep01_a … ep26_b")
    ok(page.locator("#album-grid .placeholder").count() == 0, "no 圖片準備中 placeholders")
    page.evaluate("window.scrollTo(0, 0)")
    shot(page, "08_album_stills.png")
    page.click(".tab[data-tab=princess]")
    page.locator("#album-grid .cell").nth(1).click()
    page.wait_for_function("document.querySelector('#viewer-card img') && document.querySelector('#viewer-card img').naturalWidth > 0")
    ok(text(page, "#viewer-name") == "正義公主" and text(page, "#viewer-blurb") == "樂美和正正萌可一起變身成正義公主！", "princess full-screen: name + blurb")
    page.click("#viewer-close")
    page.click(".tab[data-tab=still]")
    all_ok = True
    for idx in [0, 13, 29, 51]:
        page.locator("#album-grid .cell").nth(idx).click()
        page.wait_for_function("document.querySelector('#viewer-card img') && document.querySelector('#viewer-card img').naturalWidth > 0")
        b = blurbs[idx]
        good = text(page, "#viewer-name") == b["title"] and text(page, "#viewer-blurb") == b["blurb"] and text(page, "#viewer-intro") == b["intro"]
        all_ok = all_ok and good
        if idx == 13: shot(page, "11_still_fullscreen.png")
        page.click("#viewer-close")
    ok(all_ok, "still full-screen: title / blurb / intro exactly as in blurbs.json")

    # ---- 21. reveal works for a 16:9 still ----
    page.evaluate("""() => {
        const st = { schema: 2, days: {}, collected: [{id:'s1-m-01',t:0,d:'2026-10-01',s:null},{id:'s1-p-01',t:0,d:'2026-10-01',s:null}],
                     pending: { id: 's1-still-ep05b', n: 2 } };
        localStorage.setItem('momoke-brush-state-v1', JSON.stringify(st));
    }""")
    def still_check():
        page.wait_for_function("window.__momoke.elapsed() >= 95000", timeout=20000)
        ok(page.locator("#reveal.wide").is_visible() and page.evaluate("document.querySelector('#reveal-img img').naturalWidth") > 0, "16:9 still pending → wide reveal frame")
        bb = page.locator("#reveal").bounding_box()
        ok(abs(bb["width"] / bb["height"] - 16 / 9) < 0.05 and bb["x"] >= 0 and bb["x"] + bb["width"] <= 390, f"wide reveal fits 390px screen ({bb['width']:.0f}×{bb['height']:.0f})")
        page.screenshot(path=os.path.join(SHOTS, "03b_reveal_still_3quarters.png"))
    r = brush(page, "2026-11-12T08:00", speed=10, on_brush=still_check)
    ok(r == "capture" and text(page, "#capture-name") == "粉紅頭髮的哥哥" and "第5集" in text(page, "#capture-blurb"), "still capture: name/blurb from blurbs.json")
    shot(page, "05b_capture_still.png")

    # ---- 22. layout: nothing overflows horizontally on 390px ----
    for scr in ["home", "album", "calendar"]:
        page.evaluate(f"window.__momoke.go('{scr}')")
        page.wait_for_timeout(300)
        ok(page.evaluate("document.documentElement.scrollWidth <= 390"), f"{scr}: no horizontal overflow at 390px")

    browser.close()
stop_server()

# ---- 23. UI text scan: written Chinese (Traditional), no Cantonese colloquial, no simplified ----
CANTONESE = set("嘅咗唔係佢哋冇喺嚟啲嘢睇俾攞諗咩噉啱嗰乜冚揾搵咁")
src_text = ""
for f in ["index.html", "app.js", "data.js", "manifest.webmanifest"]:
    src_text += open(os.path.join(APP_DIR, f), encoding="utf-8").read()
strings = "".join(re.findall(r"[\u3400-\u9fff\u3000-\u303f\uff00-\uffef]+", src_text))
bad_cant = sorted(set(ch for ch in strings if ch in CANTONESE))
ok(not bad_cant, f"no Cantonese colloquial characters in UI text {bad_cant}")
try:
    from opencc import OpenCC
    s2t = OpenCC("s2t"); t2s = OpenCC("t2s")
    # a character is suspicious if converting s→t changes it (it is a simplified form)
    suspicious = sorted(set(ch for ch in set(strings) if s2t.convert(ch) != ch and t2s.convert(s2t.convert(ch)) == ch))
    ALLOW = set("著台床秘")  # standard Traditional (HK/TW) forms; OpenCC maps them to variants 着/臺/牀/祕
    suspicious = [c for c in suspicious if c not in ALLOW]
    ok(not suspicious, f"no simplified characters in UI text {suspicious}")
except ImportError:
    ok(False, "opencc not installed for simplified-character scan")

real_errors = [e for e in errors if "favicon" not in e and "ERR_INTERNET_DISCONNECTED" not in e]
ok(not real_errors, "no JS errors in console" + ("" if not real_errors else ": " + "; ".join(real_errors[:5])))
results[:] = [r for r in results if r[1]]
failed = [l for c, l in results if not c]
print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
if failed: print("FAILED:", failed)
sys.exit(1 if failed else 0)
