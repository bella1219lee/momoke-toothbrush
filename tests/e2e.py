#!/usr/bin/env python3
"""End-to-end browser test (Playwright/Chromium, iPhone viewport 390x844).
Run:  /tmp/imgenv/bin/python tests/e2e.py   (starts its own local server on 127.0.0.1:8765)
"""
import json, os, subprocess, sys, time
from playwright.sync_api import sync_playwright

APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
server = None
def start_server():
    global server
    server = subprocess.Popen([sys.executable, "-m", "http.server", "8765", "--bind", "127.0.0.1"], cwd=APP_DIR,
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
def stop_server():
    server.terminate(); server.wait()

BASE = os.environ.get("BASE", "http://127.0.0.1:8765/")
SHOTS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "screenshots")
os.makedirs(SHOTS, exist_ok=True)
results = []
errors = []

def shot(page, name):
    page.wait_for_timeout(700)  # let fade-in / reveal transitions finish
    page.screenshot(path=os.path.join(SHOTS, name))

def ok(cond, label):
    results.append((bool(cond), label))
    print(("PASS " if cond else "FAIL ") + label, flush=True)

def url(now, speed=60):
    return f"{BASE}?test=1&speed={speed}&now={now}"

def text(page, sel):
    return page.locator(sel).inner_text().strip()

def brush(page, now, speed=60):
    page.goto(url(now, speed))
    page.wait_for_selector("#screen-home.active")
    page.click("#btn-start")
    page.wait_for_selector("#screen-brush.active")
    page.wait_for_selector("#screen-result.active, #screen-capture.active", timeout=20000)
    if page.locator("#screen-capture.active").count():
        page.wait_for_selector("#capture-info.show", timeout=8000)
        return "capture"
    return "result"

def home_count(page):
    page.goto(url("2026-10-20T10:00"))
    page.wait_for_selector("#screen-home.active")
    return text(page, "#home-count")

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
    page.goto(url("2026-09-26T08:00"))
    page.wait_for_selector("#screen-home.active")
    ok(text(page, "#home-count") == "0 / 39", "home shows 0 / 39 on first load")
    ok("早上" in text(page, "#slot-m") and "○" in text(page, "#slot-m"), "home morning ○ initially")
    body = page.locator("body").inner_text()
    ok("test" not in body.lower() and "speed" not in body.lower(), "no test params visible in UI")
    ok(page.evaluate("document.querySelector('.mascot img').naturalWidth") > 0, "mascot 愛心萌可 image loads")

    # ---- 2. stop button cancels ----
    page.click("#btn-start")
    page.wait_for_selector("#screen-brush.active")
    ok(text(page, "#zone-text") == "請刷上排左邊", "first zone prompt 請刷上排左邊")
    page.wait_for_timeout(300)
    page.click("#btn-stop")
    page.wait_for_selector("#screen-home.active")
    ok("○" in text(page, "#slot-m"), "stopped brushing does not count")

    # ---- 3. visibility pause ----
    page.click("#btn-start")
    page.wait_for_selector("#screen-brush.active")
    page.wait_for_timeout(400)
    page.evaluate("""() => { Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'hidden'});
                         document.dispatchEvent(new Event('visibilitychange')); }""")
    t1 = text(page, "#brush-time"); page.wait_for_timeout(1200); t2 = text(page, "#brush-time")
    ok(t1 == t2 and page.locator("#brush-paused").is_visible(), f"timer pauses when hidden ({t1} == {t2})")
    page.evaluate("""() => { Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'visible'});
                         document.dispatchEvent(new Event('visibilitychange')); }""")
    page.wait_for_timeout(700)
    t3 = text(page, "#brush-time")
    ok(t3 != t2 and not page.locator("#brush-paused").is_visible(), f"timer resumes when visible ({t2} -> {t3})")
    page.click("#btn-stop")

    # ---- 4. morning brush 08:00 (with mid-timer screenshot) ----
    page.goto(url("2026-09-26T08:00"))
    page.wait_for_selector("#screen-home.active")
    page.click("#btn-start")
    page.wait_for_timeout(int(40000 / 60))
    page.screenshot(path=os.path.join(SHOTS, "02_brushing.png"))
    ok(text(page, "#zone-text") == "請刷上排右邊", "zone switches at 30 s: 請刷上排右邊")
    page.wait_for_timeout(int(35000 / 60))
    ok(text(page, "#zone-text") == "請刷下排左邊", "zone switches at 60 s: 請刷下排左邊")
    page.wait_for_selector("#screen-result.active", timeout=10000)
    ok(text(page, "#result-title") + text(page, "#result-msg") == "早上完成！還差晚上一次就能捕捉萌可！", "morning result text")
    page.click("#btn-result-home")
    ok("✓" in text(page, "#slot-m") and "○" in text(page, "#slot-e"), "home shows 早上 ✓ 晚上 ○")
    ok(text(page, "#home-hint") == "還差晚上一次就能捕捉萌可！", "home hint 還差晚上一次就能捕捉萌可！")
    shot(page, "01_home.png")

    # ---- 5. evening 21:00 -> capture 愛心萌可 ----
    r = brush(page, "2026-09-26T21:00")
    ok(r == "capture", "evening brush triggers capture")
    ok(text(page, "#capture-name") == "愛心萌可", "capture 1 is 愛心萌可")
    ok(page.evaluate("document.querySelector('#capture-front img') && document.querySelector('#capture-front img').naturalWidth") > 0, "captured card image shown")
    shot(page, "03_capture_reveal.png")
    page.click("#btn-capture-done")
    page.wait_for_selector("#screen-home.active")
    ok(text(page, "#home-count") == "1 / 39", "home count 1 / 39")
    ok("愛心萌可" in text(page, "#home-hint"), "home hint mentions today's capture")
    r = brush(page, "2026-09-26T22:30")
    ok(r == "result" and "已經捕捉過" in text(page, "#result-msg"), "second evening same day: no extra capture")

    # ---- 6. next day both -> 愛心公主 ----
    brush(page, "2026-09-27T07:30")
    r = brush(page, "2026-09-27T20:00")
    ok(r == "capture" and text(page, "#capture-name") == "愛心公主", "capture 2 is 愛心公主")
    page.wait_for_function("document.querySelector('#capture-front img') && document.querySelector('#capture-front img').naturalWidth > 0")
    ok("圖片準備中" not in text(page, "#capture-front"), "princess capture shows real 愛心公主 image")

    # ---- 7. only evening -> no capture ----
    r = brush(page, "2026-09-28T21:00")
    ok(r == "result" and "不能捕捉" in text(page, "#result-msg"), "evening without morning: no capture message")
    ok(home_count(page) == "2 / 39", "count stays 2 after evening-only day")

    # ---- 8. outside window -> not counted ----
    r = brush(page, "2026-09-29T14:00")
    ok(r == "result" and "不會計算" in text(page, "#result-msg"), "outside window: praised, not counted")
    page.click("#btn-result-home")
    ok("○" in text(page, "#slot-m") and "○" in text(page, "#slot-e"), "home still ○/○ after outside-window brush")

    # ---- 9. after-midnight evening counts for previous day ----
    brush(page, "2026-09-29T06:00", speed=120)
    r = brush(page, "2026-09-30T01:00", speed=120)
    ok(r == "capture", "01:00 evening brush counts for previous day -> capture 3")

    # ---- 10. more days for album content ----
    for d in range(1, 7):
        brush(page, f"2026-10-{d:02d}T07:00", speed=240)
        brush(page, f"2026-10-{d:02d}T19:30", speed=240)
    st = page.evaluate("window.__momoke.state()")
    ok(len(st["collected"]) == 9, f"9 cards collected after 9 capture days (got {len(st['collected'])})")
    seq = [c["id"] for c in st["collected"]]
    ok(seq[0] == "s1-m-01" and seq[1] == "s1-p-01", "draw order: first two fixed")
    royal_ok = all(seq[i + 1] == "s1-p-" + seq[i][-2:] for i in range(len(seq) - 1) if seq[i] in ["s1-m-0%d" % k for k in range(1, 6)])
    ok(royal_ok, "royals immediately followed by their princess in UI flow")
    print("  collected:", seq)

    # ---- 11. album ----
    page.goto(url("2026-10-06T21:00"))
    page.click("#btn-album")
    page.wait_for_selector("#screen-album.active")
    n_momoke = sum(1 for c in seq if c.startswith("s1-m-"))
    ok(page.locator("#album-grid .cell:not(.locked)").count() == n_momoke, f"萌可 tab shows {n_momoke} collected")
    ok(page.locator("#album-grid .cell.locked").count() == 24 - n_momoke, "萌可 tab shows rest as ？")
    page.wait_for_function("[...document.querySelectorAll('#album-grid img')].every(i => i.complete && i.naturalWidth > 0)")
    shot(page, "04_album_momoke.png")
    page.click(".tab[data-tab=princess]")
    ok(page.locator("#album-grid .cell").count() == 5, "公主 tab has 5 slots")
    page.wait_for_function("[...document.querySelectorAll('#album-grid img')].every(i => i.complete && i.naturalWidth > 0)")
    ok("圖片準備中" not in text(page, "#album-grid") and page.locator("#album-grid img").count() >= 1, "collected princess shows real image")
    shot(page, "07_album_princess.png")
    page.click(".tab[data-tab=still]")
    ok(page.locator("#album-grid .cell").count() == 10, "劇照 tab has 10 slots")
    shot(page, "08_album_stills.png")
    ok("第二季 敬請期待" in page.locator("body").inner_text(), "season 2 shown locked 第二季 敬請期待")

    # ---- 12. full-screen view + swipe + arrows ----
    page.click(".tab[data-tab=momoke]")
    page.locator("#album-grid .cell:not(.locked)").first.click()
    page.wait_for_selector("#viewer:not([hidden])")
    first_name = text(page, "#viewer-name")
    ok(first_name == "愛心萌可" and "善良" in text(page, "#viewer-blurb"), "full-screen view shows name + blurb")
    page.wait_for_function("document.querySelector('#viewer-card img') && document.querySelector('#viewer-card img').naturalWidth > 0")
    shot(page, "05_fullscreen_card.png")
    cdp = ctx.new_cdp_session(page)
    def swipe(x0, x1, y=420):
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x0, "y": y}]})
        for i in range(1, 6):
            cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x0 + (x1 - x0) * i / 5, "y": y}]})
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        page.wait_for_timeout(400)
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
    page.goto(url("2026-10-06T21:00"))
    page.click("#btn-calendar")
    page.wait_for_selector("#screen-calendar.active")
    ok(text(page, "#cal-title") == "2026年10月", "calendar opens on current month")
    page.click("#cal-prev")
    ok(text(page, "#cal-title") == "2026年9月", "prev month works")
    def cell(k): return page.locator(f'.cal-day[data-day="{k}"]').inner_text()
    ok("☀" in cell("2026-09-26") and "🌙" in cell("2026-09-26") and "⭐" in cell("2026-09-26"), "9/26: ☀️🌙⭐")
    ok("☀" not in cell("2026-09-28") and "🌙" in cell("2026-09-28") and "⭐" not in cell("2026-09-28"), "9/28: 🌙 only, no ⭐")
    ok("☀" not in cell("2026-09-30") and "⭐" not in cell("2026-09-30"), "9/30: nothing (01:00 brush belongs to 9/29)")
    ok("⭐" in cell("2026-09-29"), "9/29: ⭐")
    shot(page, "06_calendar.png")
    page.click("#cal-next")
    ok("⭐" in cell("2026-10-03"), "10/3: ⭐")

    # ---- 14. reload persists ----
    page.reload()
    page.wait_for_selector("#screen-home.active")
    ok(page.evaluate("window.__momoke.state().collected.length") == 9, "data persists after reload")

    # ---- 15. parent area: long press, export, reset, import ----
    page.goto(url("2026-10-06T21:00"))
    box = page.locator("#app-title").bounding_box()
    page.mouse.move(box["x"] + 20, box["y"] + 10)
    page.mouse.down(); page.wait_for_timeout(1000); page.mouse.up()
    ok(page.locator("#parent").is_hidden(), "short press does not open parent area")
    page.mouse.down(); page.wait_for_timeout(3300); page.mouse.up()
    ok(page.locator("#parent").is_visible(), "3 s long-press on title opens parent area")
    with page.expect_download() as dl:
        page.click("#btn-export")
    backup = os.path.join("/tmp", "momoke-backup-test.json")
    dl.value.save_as(backup)
    data = json.load(open(backup, encoding="utf-8"))
    ok(len(data["state"]["collected"]) == 9, "export backup JSON contains 9 cards")
    page.click("#btn-reset")
    page.wait_for_selector("#screen-home.active")
    ok(text(page, "#home-count") == "0 / 39", "reset clears all data")
    page.mouse.move(box["x"] + 20, box["y"] + 10)
    page.mouse.down(); page.wait_for_timeout(3300); page.mouse.up()
    page.set_input_files("#import-file", backup)
    page.wait_for_timeout(500)
    ok(text(page, "#home-count") == "9 / 39", "import backup restores 9 cards")

    # ---- 16. service worker + offline ----
    page.goto(BASE)
    page.evaluate("navigator.serviceWorker.ready.then(() => true)")
    page.reload(); page.wait_for_selector("#screen-home.active")
    ok(page.evaluate("!!navigator.serviceWorker.controller"), "service worker registered and controlling page")
    cached = page.evaluate("caches.keys().then(ks => Promise.all(ks.map(k => caches.open(k).then(c => c.keys().then(r => [k, r.length])))))")
    print("  caches:", cached)
    ok(any(k == "momoke-brush-v2" and n >= 49 for k, n in cached), "versioned cache (v2) holds core files + 24 萌可 + 5 princess + 10 still images")
    ctx.set_offline(True)
    stop_server()  # really offline: no server at all
    page.reload(); page.wait_for_selector("#screen-home.active")
    ok(text(page, "#home-count") == "9 / 39", "app loads offline with data")
    ok(page.evaluate("document.querySelector('.mascot img').naturalWidth") > 0, "images load offline")
    page.click("#btn-album")
    page.wait_for_function("[...document.querySelectorAll('#album-grid img')].every(i => i.complete && i.naturalWidth > 0)", timeout=5000)
    ok(True, "album images load offline")
    page.goto(url("2026-10-07T08:00", 240))
    page.wait_for_selector("#screen-home.active")
    ok(True, "test URL with query string loads offline")
    ctx.set_offline(False)
    start_server()

    # ---- 17. last card 鬧鬧 + celebration ----
    page.goto(url("2026-11-01T08:00"))
    page.evaluate("""() => {
        const L = window.__momoke.logic; const ids = [];
        let r = 1; const rng = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
        while (ids.length < 38) ids.push(L.drawNextS1(ids, rng));
        const st = { schema: 1, days: {}, collected: ids.map((id, i) => ({ id, t: 0, d: '2026-10-' + String(i % 28 + 1).padStart(2, '0') })) };
        localStorage.setItem('momoke-brush-state-v1', JSON.stringify(st));
    }""")
    brush(page, "2026-11-01T08:00", speed=240)
    r = brush(page, "2026-11-01T20:00", speed=240)
    ok(r == "capture" and text(page, "#capture-name") == "鬧鬧萌可", "39th capture is 鬧鬧萌可")
    ok("第 39 張" in text(page, "#capture-number"), "capture number shows 第 39 張")
    page.click("#btn-capture-done")
    page.wait_for_selector("#screen-celebrate.active")
    ok(text(page, "#celebrate-title") == "恭喜集齊第一季！", "celebration 恭喜集齊第一季！")
    ok("第二季 敬請期待" in text(page, "#screen-celebrate"), "celebration shows 第二季 敬請期待")
    page.wait_for_timeout(600)
    shot(page, "09_celebrate.png")
    r = brush(page, "2026-11-02T08:00", speed=240)
    ok(r == "result", "after completion, brushing still works (no more captures)")

    # ---- 18. all princesses + stills collected (fake state) ----
    page.goto(url("2026-11-10T10:00"))
    page.evaluate("""() => {
        const items = window.MOMOKE_DATA.items.filter(i => i.season === 's1' && (i.type !== 'momoke' || ['s1-m-01','s1-m-02','s1-m-03','s1-m-04','s1-m-05','s1-m-06','s1-m-12'].includes(i.id)));
        const st = { schema: 1, days: {}, collected: items.map((it, i) => ({ id: it.id, t: 0, d: '2026-10-' + String(i % 28 + 1).padStart(2, '0') })) };
        localStorage.setItem('momoke-brush-state-v1', JSON.stringify(st));
    }""")
    page.reload(); page.wait_for_selector("#screen-home.active")
    page.click("#btn-album")
    page.click(".tab[data-tab=princess]")
    page.wait_for_function("[...document.querySelectorAll('#album-grid img')].length === 5 && [...document.querySelectorAll('#album-grid img')].every(i => i.complete && i.naturalWidth > 0)")
    names = page.locator("#album-grid .cell-name").all_inner_texts()
    ok(names == ["愛心公主", "正義公主", "勇氣公主", "希望公主", "音樂公主"], f"公主 tab: all 5 real images in order {names}")
    shot(page, "10_album_princess_full.png")
    page.click(".tab[data-tab=still]")
    page.wait_for_function("[...document.querySelectorAll('#album-grid img')].length === 10 && [...document.querySelectorAll('#album-grid img')].every(i => i.complete && i.naturalWidth > 0)")
    names = page.locator("#album-grid .cell-name").all_inner_texts()
    expected = [it["title"] for it in json.load(open("/workspace/momoke/images/s1_stills/blurbs.json", encoding="utf-8"))]
    ok(names == expected, f"劇照 tab: all 10 real images in episode order, names from blurbs.json {names}")
    ok(page.locator("#album-grid .placeholder").count() == 0, "no 圖片準備中 placeholders left")
    shot(page, "11_album_stills_full.png")
    page.click(".tab[data-tab=princess]")
    page.locator("#album-grid .cell").nth(1).click()
    page.wait_for_function("document.querySelector('#viewer-card img') && document.querySelector('#viewer-card img').naturalWidth > 0")
    ok(text(page, "#viewer-name") == "正義公主" and text(page, "#viewer-blurb") == "樂美和正正萌可一起變身成正義公主！", "princess full-screen: name + blurb")
    shot(page, "12_princess_fullscreen.png")
    page.click("#viewer-close")
    page.click(".tab[data-tab=still]")
    page.locator("#album-grid .cell").nth(3).click()
    page.wait_for_function("document.querySelector('#viewer-card img') && document.querySelector('#viewer-card img').naturalWidth > 0")
    ok(text(page, "#viewer-name") == "正義公主與正正萌可" and text(page, "#viewer-blurb") == "第7集〈忘記也沒什麼大不了〉", "still full-screen: 正義公主與正正萌可 / 第7集〈忘記也沒什麼大不了〉")
    shot(page, "13_still_fullscreen.png")
    page.click("#viewer-close")

    browser.close()
stop_server()

real_errors = [e for e in errors if "favicon" not in e]
ok(not real_errors, "no JS errors in console" + ("" if not real_errors else ": " + "; ".join(real_errors[:5])))
failed = [l for c, l in results if not c]
print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
sys.exit(1 if failed else 0)
