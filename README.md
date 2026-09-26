# 萌可刷牙（奇妙萌可刷牙獎勵 PWA）

給小朋友用的刷牙獎勵 App：在早上或晚上的刷牙時段完整刷牙 2 分鐘，每次都能得到一張奇妙萌可卡片（刷牙時卡片會一格一格揭開），收進畫冊。
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
img/stills/             52 張劇照 ep01_a.jpg … ep26_b.jpg（由 s1_stills_v2/ 縮放至 800×450 以內、JPEG 85，保持比例）
tools/prepare_images.py 重新產生 img/s1、img/princess、img/stills 和 icons 的腳本（只縮放 / 壓縮 / 以白色補成正方形）
tests/draw.test.js      Node 測試：抽卡順序模擬 20000 次 + 使用模擬 3000 次 + 得卡規則 + 舊資料轉換
tests/e2e.py            Playwright 瀏覽器端對端測試（iPhone 390×844）
screenshots/            測試截圖
```

## 在 iPhone 上使用

1. 把整個資料夾放到任何**HTTPS** 靜態網站空間（iOS 只在 HTTPS 下啟用 service worker / 離線功能；
   純 http 的區域網路位址也能「加入主畫面」，但不能離線）。
2. 在 iPhone Safari 開啟網址 → 分享 → 「加入主畫面」。
3. 之後從主畫面圖示「萌可刷牙」開啟即可，第一次開啟後就能離線使用。

注意：iPhone 側邊靜音鍵開啟時，Web Audio 提示音可能不會發聲（這是 iOS 的行為）。

## 規則（2026-09-26 起，sw.js VERSION = "v3"）

- 「一天」由凌晨 04:00 至翌日 04:00（裝置本地時間）。
- 早上時段 04:00–12:00；晚上時段 17:00–04:00。以**開始刷牙的時間**判斷時段和日子。
- **每次**在時段內完整刷滿 2 分鐘 → 得到一張卡。每個時段最多一張，所以每天最多兩張。
- 漏刷只是少了那一張卡，不會重設任何進度；已收集的卡永遠保留。
- 時段以外刷牙、或同一時段已得到卡後再刷，仍然會計時和稱讚，但不會得到卡。按「停止」不計算。
- 刷牙**開始時**就決定這次會得到哪一張卡（存在 localStorage 的 `pending`），卡片蓋著「？」分成四格，
  每 30 秒（跟「上排左邊 → 上排右邊 → 下排左邊 → 下排右邊」提示同步）揭開一格，2:00 完全揭開，然後播放捕捉動畫並放進畫冊。
  中途停止的話，下次刷牙仍是同一張（不會重抽）。
- 不會得到卡的刷牙，畫面改為播放已收集卡片的幻燈片（未有卡片時顯示提示卡）。
- 抽卡順序（第一季 81 張，每得到一張卡前進一步）：第 1 張愛心萌可、第 2 張愛心公主；
  之後如果已收集某皇室萌可而未有它的公主（正常即上一張是皇室萌可），這張就是它的公主；
  否則從未收集的卡中（不含鬧鬧萌可、不含公主）平均抽，但若 S ≤ 2R 就必須抽皇室萌可
  （R = 未收集的皇室萌可數，S = 80 − 已收集的非鬧鬧卡數）；第 81 張固定是鬧鬧萌可。每天兩張約 41 天集齊。
- 集齊 81 張後顯示「恭喜集齊第一季！」，第二季顯示「第二季 敬請期待」。

## 第一季卡片（81 張）

- 24 萌可（`s1-m-01`…`s1-m-24`）：5 皇室萌可、18 魔方萌可、鬧鬧萌可（最後一張）。
- 5 公主（樂美的公主形態）：愛心公主（愛心萌可）、正義公主（正正萌可）、勇氣公主（勇氣萌可）、希望公主（盼盼萌可）、音樂公主（唱唱萌可）。

| id | 名稱 | 來源檔 | App 內檔名 |
|---|---|---|---|
| s1-p-01 | 愛心公主 | s1_princess/01_aixin_gongzhu.png | img/princess/01_aixin.jpg |
| s1-p-02 | 正義公主 | s1_princess/02_zhengyi_gongzhu.png | img/princess/02_zhengyi.jpg |
| s1-p-03 | 勇氣公主 | s1_princess/03_yongqi_gongzhu.png | img/princess/03_yongqi.jpg |
| s1-p-04 | 希望公主 | s1_princess/04_xiwang_gongzhu.png | img/princess/04_xiwang.jpg |
| s1-p-05 | 音樂公主 | s1_princess/05_yinyue_gongzhu.png | img/princess/05_yinyue.jpg |

- 52 劇照（每集 a、b 兩張，畫冊按集數再 a/b 排列）：id `s1-still-ep01a` … `s1-still-ep26b`，
  圖片 `img/stills/ep01_a.jpg` … `ep26_b.jpg`，來源 `/workspace/momoke/images/s1_stills_v2/`（集數/畫面資料見該資料夾的 manifest.json）。
  `name` / `blurb` / `intro` 原文照錄 blurbs.json 的 `title` / `blurb` / `intro`（全螢幕檢視和捕捉畫面會顯示 intro）。
  舊的 `s1_stills/` 和 `img/stills/s1-still-XX.jpg` 已不再使用。

## 舊資料轉換（schema 1 → 2）

App 已上線，裝置上可能已有舊資料。第一次開啟新版時自動轉換（`logic.js` 的 `migrateState()`），匯入舊備份時也會轉換：

- 保留所有已收集的卡片（次序不變）和日曆紀錄；舊的 `cap`（晚上完成時捕捉）記為該天晚上的卡片。
- 舊劇照 id 依 `data.js` 的 `legacyIds` 換成新 id（按 manifest.json 的 `reused_existing` 對應）：
  01→ep01_a、02→ep02_a、03→ep03_a、04→ep07_a、05→ep07_b、06→ep13_a、07→ep14_a、08→ep16_a、09→ep20_a、10→ep23_a。
  如有無法對應的舊劇照，會改發一張未收集的劇照以保持張數。
- **今天**已完成刷牙但沒有得到卡的時段（例如舊規則下早上刷了、還未到晚上），轉換時補發該時段的卡，開啟時播放捕捉動畫並說明「補送」。
- 皇室萌可已收集而未有公主 → 公主會是下一張。
- 轉換前的原始資料另存於 localStorage 鍵 `momoke-brush-state-v1-schema1-backup`，轉換紀錄在 `momoke-brush-migration`。

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

3. 打開 `sw.js`，把 `VERSION` 加一（目前是 `"v3"`，下次改成 `"v4"`，如此類推）。
4. 重新上傳整個資料夾。iPhone 上的 App 會在下次開啟時下載新圖片（可能要關掉 App 再開一次）。

## ★ 更換劇照（52 張）

1. 把新的原圖放進 `/workspace/momoke/images/s1_stills_v2/`（檔名 `ep01_a.jpg` … `ep26_b.jpg`，並更新該資料夾的 `manifest.json`、`blurbs.json`）。
2. 執行 `tools/prepare_images.py`（只會縮放至 800×450 以內、JPEG 85、保持比例，並刪除 `img/stills/` 內不在 manifest 的舊檔）：
   ```bash
   /workspace/.pwvenv/bin/python tools/prepare_images.py
   ```
3. 在 `data.js` 找到對應的劇照（例如 `id: "s1-still-ep03a"`），`name` / `blurb` / `intro` 照抄 blurbs.json 的 `title` / `blurb` / `intro`：
   ```js
   { id: "s1-still-ep03a", season: "s1", type: "still", ep: 3, name: "樂美與愛心萌可", img: "img/stills/ep03_a.jpg", blurb: "第3集〈不要害羞〉", intro: "戴著頭盔的樂美，肩上坐著愛心萌可。" },
   ```
   **不要改 `id`**（已收集的紀錄靠 id 對應）。只是換同一格的圖片時，id 不用變。
4. 把 `sw.js` 的 `VERSION` 加一，執行測試，然後重新部署（見下面「部署」）。

說明：
- `img` 仍為 `null`（或圖片檔找不到）時，卡片會顯示灰色「圖片準備中」空白卡，不影響收集。
- Service worker 會自動快取 `data.js` 內所有 `img` 不是 `null` 的圖片（目前 81 張：24 萌可 + 5 公主 + 52 劇照），不需要另外修改快取清單。
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

- 匯入可接受新格式（schema 2）和舊格式（schema 1）的備份，舊格式會自動轉換。

資料存在 localStorage，鍵名 `momoke-brush-state-v1`（鍵名不變，內容為 schema 2，格式見 `logic.js` 開頭註解）。

## 測試

```bash
# 規則、抽卡順序（20000 次隨機模擬 + 3000 次使用模擬）、舊資料轉換
node tests/draw.test.js

# 瀏覽器端對端測試（會自行在 127.0.0.1:8765 開本機伺服器，並重新產生 screenshots/）
uv venv /workspace/.pwvenv && uv pip install --python /workspace/.pwvenv playwright pillow opencc-python-reimplemented
/workspace/.pwvenv/bin/python -m playwright install chromium   # 如果瀏覽器未安裝
/workspace/.pwvenv/bin/python tests/e2e.py
```

測試用隱藏網址參數（只在加上 `test=1` 時生效，介面不會顯示）：

- `?test=1&speed=60` 計時器加快 60 倍（2 分鐘 = 2 秒）
- `?test=1&now=2026-09-26T08:00` 假設現在時間（本地時間，時鐘會從這個時間繼續走）
- 可合併：`?test=1&speed=60&now=2026-09-26T21:00`

## 部署（GitHub Pages）

網站：https://bella1219lee.github.io/momoke-toothbrush/ （公開 repo `bella1219lee/momoke-toothbrush`，branch `main`，根目錄）。

1. 修改後把 `sw.js` 的 `VERSION` 加一（否則已安裝的 App 會繼續用舊快取）。
2. 跑完上面兩個測試，全部通過。
3. 提交並推送：
   ```bash
   cd /workspace/momoke-app
   git add -A && git commit -m "說明這次修改" && git push
   ```
4. 等 GitHub Pages 重新發佈（通常 1–2 分鐘），確認 `https://bella1219lee.github.io/momoke-toothbrush/sw.js` 已是新的 VERSION。
5. iPhone 上關掉 App 再開一次（可能要開兩次），就會用新版本；資料會保留（舊資料會自動轉換）。
