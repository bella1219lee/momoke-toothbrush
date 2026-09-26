# 萌可刷牙（奇妙萌可刷牙獎勵 PWA）

給小朋友用的刷牙獎勵 App：早上和晚上各完整刷牙 2 分鐘，就能「捕捉」一張奇妙萌可卡片，收進畫冊。
純靜態網站（HTML / CSS / 原生 JS），沒有建置步驟、沒有框架、沒有後端。所有資料只存在裝置的 localStorage。
Service worker 會快取所有檔案，第一次載入後可離線使用。

## 檔案結構

```
index.html              單頁 App（所有畫面）
styles.css              樣式（粉紅/紫色、大按鈕、safe-area）
data.js                 ★ 卡片資料（唯一資料來源：萌可 / 公主 / 劇照 / 季度設定）
logic.js                規則（日子、時段、抽卡順序、捕捉），可在 Node 測試
app.js                  介面、計時器、聲音、畫冊、日曆、家長區
sw.js                   Service worker（版本化快取，VERSION 常數）
manifest.webmanifest    PWA 設定（名稱「萌可刷牙」、standalone）
icons/                  apple-touch-icon.png（180）、icon-192.png、icon-512.png（由 01_aixin.jpg 縮放）
img/s1/                 24 張萌可圖（由 /workspace/momoke/images/s1/ 縮放至最長邊 ≤600px、JPEG 85）
img/princess/           5 張公主圖（由 s1_princess/0X_*_gongzhu.png 轉成白底正方形 600×600 JPEG）
img/stills/             10 張劇照（由 s1_stills/ 縮放至 800×450 JPEG）
tools/prepare_images.py 重新產生 img/s1、img/princess、img/stills 和 icons 的腳本（只縮放 / 壓縮 / 以白色補成正方形）
tests/draw.test.js      Node 測試：抽卡順序模擬 20000 次 + 規則測試
tests/e2e.py            Playwright 瀏覽器端對端測試（iPhone 390×844）
screenshots/            測試截圖
```

## 在 iPhone 上使用

1. 把整個資料夾放到任何**HTTPS** 靜態網站空間（iOS 只在 HTTPS 下啟用 service worker / 離線功能；
   純 http 的區域網路位址也能「加入主畫面」，但不能離線）。
2. 在 iPhone Safari 開啟網址 → 分享 → 「加入主畫面」。
3. 之後從主畫面圖示「萌可刷牙」開啟即可，第一次開啟後就能離線使用。

注意：iPhone 側邊靜音鍵開啟時，Web Audio 提示音可能不會發聲（這是 iOS 的行為）。

## 規則

- 「一天」由凌晨 04:00 至翌日 04:00（裝置本地時間）。
- 早上時段 04:00–12:00；晚上時段 17:00–04:00。以**開始刷牙的時間**判斷時段和日子。
- 必須完整刷滿 2 分鐘才計算；按「停止」不計算。時段以外刷牙會計時和稱讚，但不計算。
- 同一天早上和晚上都完成 → 捕捉一張卡（在完成晚上那次時捕捉），每天最多一張。漏刷的那天沒有卡，下一天重新開始；已收集的卡永遠保留。
- 抽卡順序（第一季 39 張）：第 1 張愛心萌可、第 2 張愛心公主；之後如果上一張是皇室萌可，這張就是它的公主；
  否則從未收集的卡中（不含鬧鬧萌可、不含公主）平均抽，但若 S ≤ 2R 就必須抽皇室萌可
  （R = 未收集的皇室萌可數，S = 38 − 已收集的非鬧鬧卡數）；第 39 張固定是鬧鬧萌可。
- 集齊 39 張後顯示「恭喜集齊第一季！」，第二季顯示「第二季 敬請期待」。

## 目前已加入的公主和劇照（2026-09-26，sw.js VERSION = "v2"）

公主（blurb 已經角色專家確認）：

| id | 名稱 | 來源檔 | App 內檔名 |
|---|---|---|---|
| s1-p-01 | 愛心公主 | s1_princess/01_aixin_gongzhu.png | img/princess/01_aixin.jpg |
| s1-p-02 | 正義公主 | s1_princess/02_zhengyi_gongzhu.png | img/princess/02_zhengyi.jpg |
| s1-p-03 | 勇氣公主 | s1_princess/03_yongqi_gongzhu.png | img/princess/03_yongqi.jpg |
| s1-p-04 | 希望公主 | s1_princess/04_xiwang_gongzhu.png | img/princess/04_xiwang.jpg |
| s1-p-05 | 音樂公主 | s1_princess/05_yinyue_gongzhu.png | img/princess/05_yinyue.jpg |

劇照（按集數排列；name / blurb 取自 s1_stills/blurbs.json 的 title / blurb；第 7 集有兩張是刻意的；不使用 04_ep05_litv.jpg）：

| id | 來源檔 | name | blurb |
|---|---|---|---|
| s1-still-01 | 01_ep01_litv.jpg | 樂美與愛心萌可 | 第1集〈亂七八糟的烘焙直播〉 |
| s1-still-02 | 02_ep02_tx.jpg | 愛心公主與愛心萌可 | 第2集〈嬌嬌萌可太過分了〉 |
| s1-still-03 | 03_ep03_litv.jpg | 樂美與愛心萌可 | 第3集〈不要害羞〉 |
| s1-still-04 | backup_02_ep07_tx.jpg | 正義公主與正正萌可 | 第7集〈忘記也沒什麼大不了〉 |
| s1-still-05 | 05_ep07_iq.jpg | 樂美與愛心萌可、正正萌可 | 第7集〈忘記也沒什麼大不了〉 |
| s1-still-06 | 06_ep13_litv.jpg | 音樂公主與唱唱萌可 | 第13集〈無法停止的舞蹈〉 |
| s1-still-07 | 07_ep14_litv.jpg | 愛心公主與美美萌可 | 第14集〈千萬別照鏡子〉 |
| s1-still-08 | 08_ep16_tx.jpg | 樂美與勇氣萌可、盼盼萌可 | 第16集〈怕怕萌可的拍照遊戲〉 |
| s1-still-09 | 09_ep20_litv.jpg | 希望公主與盼盼萌可、愛心萌可 | 第20集〈說出你的秘密吧〉 |
| s1-still-10 | 10_ep23_tx.jpg | 希望公主與愛心萌可、盼盼萌可 | 第23集〈不要生氣了〉 |

以下是加入/更換圖片的步驟（之後要換圖時照做即可）。

## ★ 加入或更換公主圖片（5 張）

1. 把圖片放進 `img/princess/`，**檔名必須如下**（建議正方形、約 600×600、JPEG）：

   | 公主 | data.js 的 id | 檔名 |
   |---|---|---|
   | 愛心公主（愛心萌可） | `s1-p-01` | `img/princess/01_aixin.jpg` |
   | 正義公主（正正萌可） | `s1-p-02` | `img/princess/02_zhengyi.jpg` |
   | 勇氣公主（勇氣萌可） | `s1-p-03` | `img/princess/03_yongqi.jpg` |
   | 希望公主（盼盼萌可） | `s1-p-04` | `img/princess/04_xiwang.jpg` |
   | 音樂公主（唱唱萌可） | `s1-p-05` | `img/princess/05_yinyue.jpg` |

2. 打開 `data.js`，找到對應的公主項目，把 `img` 設成檔名（沒有圖片時為 `null`），例如：

   ```js
   { id: "s1-p-01", season: "s1", type: "princess", name: "愛心公主", royal: "s1-m-01", img: "img/princess/01_aixin.jpg", blurb: "樂美和愛心萌可一起變身成愛心公主！" },
   ```
   （`blurb` 可以按需要修改；**不要改 `id`**，已收集的紀錄靠 id 對應。）

3. 打開 `sw.js`，把 `VERSION` 加一（目前是 `"v2"`，下次改成 `"v3"`，如此類推）。
4. 重新上傳整個資料夾。iPhone 上的 App 會在下次開啟時下載新圖片（可能要關掉 App 再開一次）。

## ★ 加入或更換劇照（10 張）

1. 把圖片放進 `img/stills/`，**檔名**：`s1-still-01.jpg`、`s1-still-02.jpg` … `s1-still-10.jpg`
   （建議橫向 800 像素寬、JPEG；畫冊格子會裁成正方形顯示，全螢幕檢視會以 16:9 完整顯示）。
2. 在 `data.js` 找到 `id: "s1-still-01"` … `"s1-still-10"`，把 `img` 設成
   `"img/stills/s1-still-01.jpg"` 等，並設定 `name`（標題）和 `blurb`（集數與集名），例如：

   ```js
   { id: "s1-still-03", season: "s1", type: "still", name: "樂美與愛心萌可", img: "img/stills/s1-still-03.jpg", blurb: "第3集〈不要害羞〉" },
   ```
3. 把 `sw.js` 的 `VERSION` 加一，重新上傳。

說明：
- `img` 仍為 `null`（或圖片檔找不到）時，卡片會顯示灰色「圖片準備中」空白卡，不影響收集。
- Service worker 會自動快取 `data.js` 內所有 `img` 不是 `null` 的圖片，不需要另外修改快取清單。
- 圖片只可以縮放、壓縮、以白色補成正方形；可參考 `tools/prepare_images.py`。

## 第二季（預留掛鉤，尚未開放）

- `data.js` → `seasons` 已有 `{ id: "s2", open: false, lockedText: "第二季 敬請期待", transform: { from: "s1-m-24", to: null } }`。
- 開放方法（圖片確認後）：
  1. 在 `items` 加入 `season: "s2"` 的卡片（例如幸福萌可 `id: "s2-m-01"`），圖片放 `img/s2/`；
  2. 把第二季的 `open` 改成 `true`，`transform.to` 設為幸福萌可的 id，可加 `total`、`first`、`finalItem`；
  3. `sw.js` 的 `VERSION` 加一。
- `logic.js` 的 `currentSeasonId()` 會在第一季集齊且第二季開放時自動轉到第二季；
  第二季目前使用 `drawNextGeneric()`（`first` 清單優先，其餘平均抽，`finalItem` 最後），需要特別規則時在那裡修改。
- 「鬧鬧萌可變成幸福萌可」的動畫：在 `app.js` 的 `showCelebrate()` 內有註解標示的位置加入。
- 畫冊目前只顯示第一季（`tabItems()` 固定 `"s1"`）；開放第二季時需要在畫冊加入季度切換。

## 家長區

在主頁**長按標題「萌可刷牙」3 秒**開啟：
- 匯出備份：下載 JSON 檔（iPhone 上會開啟分享選單，可選「儲存到檔案」）。
- 匯入備份：選擇之前匯出的 JSON 檔，會取代目前資料。
- 重設所有資料：確認兩次後清除。

資料存在 localStorage，鍵名 `momoke-brush-state-v1`。

## 測試

```bash
# 規則與抽卡順序（20000 次隨機模擬）
node tests/draw.test.js

# 瀏覽器端對端測試（會自行在 127.0.0.1:8765 開本機伺服器，並更新 screenshots/）
python3 -m venv /tmp/imgenv && /tmp/imgenv/bin/pip install playwright pillow && /tmp/imgenv/bin/python -m playwright install chromium
/tmp/imgenv/bin/python tests/e2e.py
```

測試用隱藏網址參數（只在加上 `test=1` 時生效，介面不會顯示）：

- `?test=1&speed=60` 計時器加快 60 倍（2 分鐘 = 2 秒）
- `?test=1&now=2026-09-26T08:00` 假設現在時間（本地時間，時鐘會從這個時間繼續走）
- 可合併：`?test=1&speed=60&now=2026-09-26T21:00`
