# 萌可刷牙（奇妙萌可刷牙獎勵 PWA）

給小朋友用的刷牙獎勵 App：按「開始刷牙」後先有 10 秒預備倒數（準備牙刷和牙膏），然後在早上或晚上的刷牙時段完整刷牙 2 分鐘，每次都能得到一張奇妙萌可卡片（刷牙時牙刷會把蓋著卡片的泡泡慢慢刷走，同時播放第一季主題曲《捕萌少女》），收進畫冊。主頁會小聲循環播放主題曲的純音樂版（首頁音樂，沒有人聲），家長一打開 App 就知道有沒有聲音。
純靜態網站（HTML / CSS / 原生 JS），沒有建置步驟、沒有框架、沒有後端。所有資料只存在裝置的 localStorage。
Service worker 會快取所有檔案，第一次載入後可離線使用。

## 檔案結構

```
index.html              單頁 App（所有畫面）
styles.css              樣式（粉紅/紫色、大按鈕、safe-area）
data.js                 ★ 卡片資料（唯一資料來源：萌可 / 公主 / 劇照 / 季度設定）
logic.js                規則（日子、時段、抽卡順序、捕捉、每季主題曲、家長設定），可在 Node 測試
brushfx.js              刷牙動畫（泡泡層 canvas、牙刷、小泡泡、星星、預備倒數的泡泡和閃光），路線計算可在 Node 測試
app.js                  介面、預備倒數、計時器、聲音、首頁 / 刷牙音樂（含 iOS 聲音自動恢復）、畫冊、日曆、家長區
sw.js                   Service worker（版本化快取，VERSION 常數）
manifest.webmanifest    PWA 設定（名稱「萌可刷牙」、standalone）
icons/                  apple-touch-icon.png（180）、icon-192.png、icon-512.png（由 01_aixin.jpg 縮放）
img/s1/                 24 張萌可圖（由 /workspace/momoke/images/s1/ 縮放至最長邊 ≤600px、JPEG 85）
img/princess/           5 張公主圖（由 s1_princess/0X_*_gongzhu.png 轉成白底正方形 600×600 JPEG）
audio/s1_op.m4a         第一季主題曲《捕萌少女》（刷牙音樂，有人聲，見下面「刷牙音樂」）
audio/s1_home.m4a       第一季主題曲的官方純音樂版（首頁音樂，沒有人聲，見下面「首頁音樂」）
img/stills/             52 張劇照 ep01_a.jpg … ep26_b.jpg（由 s1_stills_v2/ 縮放至 800×450 以內、JPEG 85，保持比例）
tools/prepare_images.py 重新產生 img/s1、img/princess、img/stills 和 icons 的腳本（只縮放 / 壓縮 / 以白色補成正方形）
tests/draw.test.js      Node 測試：抽卡順序模擬 20000 次 + 使用模擬 3000 次 + 得卡規則 + 舊資料轉換 + 泡泡路線覆蓋 + 音樂資料 + 預備倒數的時段邊緣
tests/e2e.py            Playwright 瀏覽器端對端測試（iPhone 390×844），包括首頁音樂和模擬壞掉的 AudioContext 自動重建
screenshots/            測試截圖
```

## 在 iPhone 上使用

1. 把整個資料夾放到任何**HTTPS** 靜態網站空間（iOS 只在 HTTPS 下啟用 service worker / 離線功能；
   純 http 的區域網路位址也能「加入主畫面」，但不能離線）。
2. 在 iPhone Safari 開啟網址 → 分享 → 「加入主畫面」。
3. 之後從主畫面圖示「萌可刷牙」開啟即可，第一次開啟後就能離線使用。

注意：iPhone 側邊靜音鍵開啟時，Web Audio 提示音可能不會發聲（這是 iOS 的行為）；刷牙音樂開啟時一般不受影響（見「刷牙音樂」）。

## 規則（2026-09-27 起；目前 sw.js VERSION = "v9"）

- 「一天」由凌晨 04:00 至翌日 04:00（裝置本地時間）。
- 早上時段 04:00–12:00；晚上時段 17:00–04:00。以**開始刷牙的時間**判斷時段和日子；
  有預備倒數時，見下面「預備倒數」的時段邊緣規則。
- **每次**在時段內完整刷滿 2 分鐘 → 得到一張卡。每個時段最多一張，所以每天最多兩張。
- 漏刷只是少了那一張卡，不會重設任何進度；已收集的卡永遠保留。
- 時段以外刷牙、或同一時段已得到卡後再刷，仍然會計時和稱讚，但不會得到卡。按「停止」不計算。
- 刷牙**開始時**就決定這次會得到哪一張卡（存在 localStorage 的 `pending`），卡片蓋著一層泡泡（中間有「？」），
  一支牙刷以之字形來回刷，刷過的地方泡泡消失，並冒出小泡泡和星星；2:00 剛好完全露出，然後播放捕捉動畫並放進畫冊。
  中途停止的話，下次刷牙仍是同一張（不會重抽），計時和泡泡都重新開始（泡泡重新蓋滿）。
- 不會得到卡的刷牙，畫面改為播放已收集卡片的幻燈片（未有卡片時顯示提示卡），牙刷沿卡片邊框繞圈（不擋住卡片）。

## 預備倒數（v5 新增）

- 按「開始刷牙」後，刷牙畫面先進入 10 秒預備倒數：上方顯示「準備好牙刷和牙膏了嗎？」「倒數完畢就開始刷牙！」，
  卡片中間一個大泡泡裡顯示 10→1 的粉紅/紫色漸層大數字，每秒彈跳一下並灑出一圈星星，卡片四周有升起的小泡泡和閃光
  （全部是 canvas / CSS 簡單圖形，不畫角色）。倒數完畢顯示「開始刷牙！」約 1.5 秒（同時 2 分鐘已開始計時）。
- 會得到卡片的刷牙：倒數時已顯示這次的卡片，完全蓋著泡泡（預告）；不會得到卡片：顯示幻燈片的第一張（未有卡片時顯示提示卡的底色）。
- 「我準備好了」：立即結束倒數開始刷牙。「停止」：回到主頁，**不改動任何資料**。
- 倒數**不計入** 2 分鐘；倒數時計時器、牙齒四區提示不顯示。App 放到背景 / 鎖機時倒數也會暫停（顯示「暫停中」）。
- 螢幕常亮（Wake Lock）由按「開始刷牙」開始。
- 聲音：每秒一下輕輕的「滴」（最後三秒稍微明亮），「開始刷牙！」時一段明亮的上行鐘聲（音樂暫時降低）。
- **時段邊緣**（`logic.js` 的 `brushStartTs()`）：以「倒數開始」和「真正開始刷牙」兩個時間中對小朋友較有利的一個判斷時段和日子：
  1. 能得到卡片的優先（兩個都可以時用倒數開始的時間）；
  2. 都不能得到卡片時，在刷牙時段內的優先（日曆仍有紀錄）；
  3. 否則用倒數開始的時間。
  例：11:59:55 開始倒數 → 算早上；16:59:55 開始倒數、17:00:05 開始刷 → 算晚上；
  03:59:55 開始倒數：昨晚未得到卡 → 算昨晚，昨晚已得到卡 → 04:00:05 開始刷，算今天早上。
  倒數時的預覽用「倒數開始」和「預計開始刷牙」（倒數開始 + 餘下倒數）計算；如果提早按「我準備好了」或暫停令結果不同，
  開始刷牙時會重新佈置卡片（例如 16:59:50 倒數、16:59:52 就按「我準備好了」→ 時段外，改為幻燈片）。
- **資料**：倒數期間只在資料的副本上預覽，不寫入 localStorage；真正開始刷牙時才決定並保存 `pending`（跟以前一樣）。
  未有已決定的卡片時，預覽抽出的卡記在記憶體，同一進度下停止後再按開始仍是同一張，開始刷牙時寫入 `pending`。
  進度資料格式不變（schema 2），不需要轉換。
- 家長區「預備時間」：開 / 關（預設開啟）。關閉時按「開始刷牙」立即開始計時（跟 v4 一樣），
  設定存在 `momoke-brush-settings`：關閉時為 `{ "music": true, "ready": false }`，開啟時不寫入 `ready`。
- 測試用 `speed` 參數同樣加快倒數（例如 `speed=10` 時倒數 1 秒）。

## 首頁音樂（v7 新增；v8 起用純音樂版）

- 在主頁以**較小的音量**（30%，刷牙時是 55%）循環播放目前季度主題曲的**純音樂版（沒有人聲）**：
  `songFor(state, "home")` 用 `data.js` 的 `seasons[].music.home`；該季沒有 `home` 時用該季的 `op`；
  該季完全沒有音樂時沿用最近一季（跟刷牙音樂一樣的規則）。刷牙音樂仍是有人聲的 `music.op`（`songFor(state)`）。
  不淡出、不降低。目的是家長打開 App 時立即聽到聲音是否正常，不用等到刷牙才發現沒有聲音。
- iOS 只允許在使用者手勢內開始播放：顯示主頁時先試一次；被拒絕的話，**輕觸主頁任何地方**（pointerdown / touchend / click）就會開始。
  App 放到背景 / 鎖機時暫停；回到前景（visibilitychange / pageshow）時再試，iOS 上通常要再輕觸一下主頁。
- 按「開始刷牙」改播刷牙音樂（由頭開始，音量、降低、淡出的邏輯跟以前一樣）。首頁和刷牙共用同一個 `<audio>`（Web Audio 接駁不變），
  在「開始刷牙」的點擊內把 `src` 由純音樂版換成有人聲的版本；回到主頁時（同樣在點擊內）換回純音樂版並由頭播放。
  從畫冊 / 日曆 / 家長區回來時 `src` 沒有變，會由暫停的位置繼續。
- 第一季檔案：`audio/s1_home.m4a`（AAC-LC 192 kbps / 48 kHz，56.6 秒，1.4 MB），原樣複製自 `/workspace/momoke/music/s1/home_inst.m4a`。
  來源（見該資料夾的 `sources.json`）：SAMG 官方的第一季片頭曲伴奏〈캐치티니핑 오프닝곡 (MR)〉
  （Apple Music / iTunes 名稱「CATCH PING : Fairies of Emotion opening song (Instrumental)」），
  YouTube「Catch! Teenieping - Topic」官方發行頻道 <https://www.youtube.com/watch?v=iGb2d6Qi8-8>
  （Provided to YouTube by Collab Asia Music，℗ SAMG Entertainment，2020-03-19）；
  同一發行亦見於 Apple Music <https://music.apple.com/nz/album/catch-ping-fairies-of-emotion-title-instrumental/1562086171>（第 4 首）。
  《捕萌少女》是這首韓文片頭曲的中文版，用的是同一條伴奏。由 YouTube Opus 轉成 AAC，只加了開頭 0.05 秒淡入和結尾 2 秒淡出（方便循環），沒有其他處理。
  只保留 m4a（mp3 版本不放進 App）。
- 進入畫冊、日曆或家長區時停止；回到主頁（刷牙完成或停止後、從畫冊 / 日曆返回、關閉家長區）時繼續播放（iOS 上可能要輕觸一下）。
- 家長區「首頁音樂」：開 / 關（預設開啟），與「刷牙音樂」分開。設定存在 `momoke-brush-settings`：關閉時寫入 `"homeMusic": false`，
  開啟時不寫入（舊設定沒有這個鍵 = 開啟，不需要轉換）。

## 聲音自動恢復（iOS 鎖機後沒有聲音）

- 問題：音樂的 `<audio>` 經 `createMediaElementSource` + GainNode 接到共用的 AudioContext（iOS 不理會 `audio.volume`），
  提示音也用同一個 context。iPhone 鎖機一段時間後，iOS 會把 context 變成 `interrupted` / `suspended`，而 `resume()` 經常永遠不成功，
  於是所有聲音都沒有了，要強制關閉 App 才會恢復。
- 做法（`app.js` 的 `music.gesture()`）：每次想播放聲音的手勢（輕觸主頁、開始刷牙、我準備好了、輕觸刷牙畫面）都檢查 context：
  1. `closed` / `interrupted`：立即（仍在手勢內）重建；
  2. 其他未在 `running`：先 `resume()`，約 0.4 秒後仍未 `running`（或 `currentTime` 沒有前進）就重建。
     用短的 `setTimeout` 而不是等 `resume()` 的 promise，因為 WebKit 會把使用者手勢帶進 1 秒內的計時器，新的 `<audio>` 仍可以 `play()`。
- 重建：盡量 `close()` 舊的 context，建立新的 AudioContext；`createMediaElementSource` 每個 `<audio>` 只可以用一次，
  所以移除舊的 `<audio>`，建立新的（同一首歌、保留播放位置）接到新的 context。提示音之後也用新的 context。
- 不支援 Web Audio、或連續重建仍失敗時，音樂改用普通 `<audio>` 播放（iOS 上不能調音量，刷牙 2:00 時直接停止）。
- 同時設定 `navigator.audioSession.type = "playback"`（iOS 17+）。
- 這些都不會改動進度資料。

## 刷牙動畫（brushfx.js）

- 只用 canvas 畫簡單圖形：泡泡、牙刷、小泡泡、星星。**不畫任何萌可/樂美角色**，角色只出現在真正的卡片圖片。
- 卡片分成四區，跟刷牙提示同步：0–30 秒上排左邊、30–60 秒上排右邊、60–90 秒下排左邊、90–120 秒下排右邊。
  每區開頭 1.5 秒牙刷移到該區起點，其餘時間沿之字形路線刷走該區的泡泡。
- 進度**只由刷牙經過時間決定**（路線上固定的「刷走點」，經過時間 e 對應固定數目），不靠逐格累積：
  暫停 / 放到背景 / 測試加速 / 旋轉或改變大小（會重畫泡泡再補回進度）都不影響，泡泡只會減少，2:00 一定完全刷走。
  路線的覆蓋範圍在 `tests/draw.test.js` 逐點檢查（正方形卡和 16:9 劇照）。
- 使用 `requestAnimationFrame`；canvas 解像度 = 顯示大小 × devicePixelRatio（最多 2 倍）。每格只補畫新刷走的點和少量粒子，iPhone 上很輕。
- 系統設定「減少動態效果」時，牙刷來回動作和粒子會減少。

## 刷牙音樂

- 由預備倒數開始循環播放第一季片頭曲《捕萌少女》（55 秒，循環播放；連同倒數共約 2:10），2 分鐘開始時**不會重新播放**，
  繼續播下去；刷牙最後 3 秒淡出（音量只看刷牙經過時間，倒數時保持正常音量），2:00 剛好靜音，然後播放完成音效和捕捉動畫。
  不會得到卡的刷牙也會播放。片尾曲不使用。
- 檔案：`audio/s1_op.m4a`（AAC 256 kbps，1.8 MB），原樣複製自 `/workspace/momoke/music/s1/s1_op.m4a`。
  來源（見該資料夾的 `sources.json`）：網易雲音樂 <https://music.163.com/#/song?id=1865683356>，
  〈捕萌少女（《奇妙萌可》動畫主題曲 TV Version）〉，演唱：樂嘉曄，上載者劉亦雄（專輯《奇妙萌可》，2021-08-01），
  屬於半官方的錄音室版本（不是版權方 / 官方帳號上載）。m4a 由 320 kbps MP3 以 ffmpeg 轉換，沒有其他處理。
  只保留 m4a（iOS Safari 可播放）；mp3 版本（2.2 MB）不放進 App。
- 在「開始刷牙」的點擊裡（即倒數開始時）開始播放（iOS 需要使用者手勢），使用 `<audio loop>`；音量經 Web Audio 的 GainNode 控制
  （`createMediaElementSource`，因為 iOS 不理會 `audio.volume`）：平時 55% 音量，區域提示音響起時暫時降低，最後 3 秒淡出。
  不支援 Web Audio 時改用 `audio.volume`（iOS 上則在 2:00 直接停止）。
- 計時或倒數暫停（App 放到背景 / 鎖機）時音樂暫停，回來時一起繼續；按「停止」（包括倒數時）時停止並回到開頭，回到主頁後改播首頁音樂（見下面）。
- iOS 注意事項：`<audio>` 播放一般不受側邊靜音鍵影響；iOS 17 以上另外把 `navigator.audioSession.type` 設為 `"playback"`，
  讓經 Web Audio 輸出的音樂和提示音在靜音鍵開啟時也會發聲。音量由手機音量鍵控制。
  如果 iOS 在回到前景後暫停了音訊，輕觸刷牙畫面就會恢復（需要時自動重建音訊，見「聲音自動恢復」）。音樂以真實時間播放，測試用的 `speed` 參數只加快計時和動畫。
- 家長區可以關閉「刷牙音樂」（預設開啟），設定存在 localStorage 鍵 `momoke-brush-settings`（`{ "music": true }`），
  與進度資料分開（進度資料格式不變，不需要轉換）。
- 每季可以有自己的歌：`data.js` → `seasons[].music.op`（刷牙，`src`、`type`、`title`、`duration`）和 `music.home`（首頁純音樂版，可省略，另有 `instrumental: true`）。
  `logic.js` 的 `songFor()` 播放目前收集中的季度的歌；該季未有歌時沿用最近一季的歌。
  第二季的歌未有檔案（`music: null`）；之後把檔案放進 `audio/`（例如 `audio/s2_op.m4a`、`audio/s2_home.m4a`），在第二季加入 `music: { op: { … }, home: { … } }`，
  再把 `sw.js` 的 `VERSION` 加一（Service worker 會自動快取 data.js 列出的所有音樂檔）。
- 抽卡順序（第一季 81 張，每得到一張卡前進一步）：第 1 張愛心萌可、第 2 張愛心公主；
  之後如果已收集某皇室萌可而未有它的公主（正常即上一張是皇室萌可），這張就是它的公主；
  否則從未收集的卡中（不含鬧鬧萌可、不含公主）平均抽，但若 S ≤ 2R 就必須抽皇室萌可
  （R = 未收集的皇室萌可數，S = 80 − 已收集的非鬧鬧卡數）；第 81 張固定是鬧鬧萌可。每天兩張約 41 天集齊。
- 集齊 81 張後顯示「恭喜集齊第一季！」，第二季顯示「第二季 敬請期待」。

## 第一季卡片（81 張）

- 24 萌可（`s1-m-01`…`s1-m-24`）：5 皇室萌可、18 魔方萌可、鬧鬧萌可（最後一張）。
- 5 公主（樂美的公主形態）：愛心公主（愛心萌可）、正義公主（正正萌可）、勇氣公主（勇氣萌可）、希望公主（盼盼萌可）、音樂公主（唱唱萌可）。

- 愛心萌可（`s1-m-01`）來源已於 2026-09-27 更新：`/workspace/momoke/images/s1/manifest.json` 記錄的官方第一季 render（Catch! Teenieping wiki：`Heartsping_S1_Render_2.png`），替換了舊的後期設計；App 圖片由 `01_aixin.jpg` 只縮放/壓縮產生。

| id | 名稱 | 來源檔 | App 內檔名 |
|---|---|---|---|
| s1-p-01 | 愛心公主 | s1_princess/01_aixin_gongzhu.png | img/princess/01_aixin.jpg |
| s1-p-02 | 正義公主 | s1_princess/02_zhengyi_gongzhu.png | img/princess/02_zhengyi.jpg |
| s1-p-03 | 勇氣公主 | s1_princess/03_yongqi_gongzhu.png | img/princess/03_yongqi.jpg |
| s1-p-04 | 希望公主 | s1_princess/04_xiwang_gongzhu.png | img/princess/04_xiwang.jpg |
| s1-p-05 | 音樂公主 | s1_princess/05_yinyue_gongzhu.png | img/princess/05_yinyue.jpg |

- 52 劇照（每集 a、b 兩張，畫冊按集數再 a/b 排列）：id `s1-still-ep01a` … `s1-still-ep26b`，
  圖片 `img/stills/ep01_a.jpg` … `ep26_b.jpg`，來源 `/workspace/momoke/images/s1_stills_v2/`（集數/畫面資料見該資料夾的 manifest.json）。
  `name` / `blurb` / `intro` 原文照錄 blurbs.json 的 `title` / `blurb` / `intro`，只作為資料保留，**App 不會顯示**（v9 起）：
  劇照在所有地方（刷牙揭開卡片、得到卡片畫面、畫冊格子和全螢幕檢視、刷牙幻燈片、圖片 alt / 無障礙文字）都**只顯示集數**「第 N 集」，沒有任何說明文字，
  版面不留空位（`app.js` 的 `shown()`）。萌可和公主維持原本的名稱和簡介。日曆只顯示日子和星星，不顯示卡片文字。
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

3. 打開 `sw.js`，把 `VERSION` 加一（目前是 `"v9"`，下次改成 `"v10"`，如此類推），並把 `data.js` 的 `version` 改成同一個數字（見「版本標籤」）。
4. 重新上傳整個資料夾。iPhone 上的 App 會在下次開啟時下載新圖片（可能要關掉 App 再開一次）。

## 版本標籤（v9 新增）

- 主頁最底部有一行極小、淡灰色的版本字樣（例如「v9」），不可點、不攔截觸控（`pointer-events: none`），不佔版面，不影響長按標題和按鈕。
- 數字來自 `data.js` 的 `version`；`sw.js` 不能 import 它，所以 `sw.js` 的 `VERSION` 要一起加一。
  `tests/draw.test.js` 檢查兩者相同，`tests/e2e.py` 也檢查主頁的標籤等於 `sw.js` 的 VERSION。
- 每次更新：`sw.js` 的 `VERSION` 和 `data.js` 的 `version` 一起加一。

## ★ 更換劇照（52 張）

1. 把新的原圖放進 `/workspace/momoke/images/s1_stills_v2/`（檔名 `ep01_a.jpg` … `ep26_b.jpg`，並更新該資料夾的 `manifest.json`、`blurbs.json`）。
2. 執行 `tools/prepare_images.py`（只會縮放至 800×450 以內、JPEG 85、保持比例，並刪除 `img/stills/` 內不在 manifest 的舊檔）：
   ```bash
   /workspace/.pwvenv/bin/python tools/prepare_images.py
   ```
3. 在 `data.js` 找到對應的劇照（例如 `id: "s1-still-ep03a"`），`ep`（集數，畫面上顯示「第 N 集」）要正確；`name` / `blurb` / `intro` 照抄 blurbs.json 的 `title` / `blurb` / `intro`（只作資料，不會顯示）：
   ```js
   { id: "s1-still-ep03a", season: "s1", type: "still", ep: 3, name: "樂美與愛心萌可", img: "img/stills/ep03_a.jpg", blurb: "第3集〈不要害羞〉", intro: "戴著頭盔的樂美，肩上坐著愛心萌可。" },
   ```
   **不要改 `id`**（已收集的紀錄靠 id 對應）。只是換同一格的圖片時，id 不用變。
4. 把 `sw.js` 的 `VERSION` 加一，執行測試，然後重新部署（見下面「部署」）。

說明：
- `img` 仍為 `null`（或圖片檔找不到）時，卡片會顯示灰色「圖片準備中」空白卡，不影響收集。
- Service worker 會自動快取 `data.js` 內所有 `img` 不是 `null` 的圖片（目前 81 張：24 萌可 + 5 公主 + 52 劇照）和各季的音樂檔（刷牙 `op` 和首頁 `home`），不需要另外修改快取清單。
  音樂的 Range 請求由 service worker 從快取切出 206 回應（Safari 播放快取的音訊需要這樣）。
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
- 刷牙音樂：開 / 關（預設開啟，存在 `momoke-brush-settings`）。
- 首頁音樂：開 / 關（預設開啟；主頁小聲循環播放主題曲的純音樂版，見「首頁音樂」）。
- 預備時間：開 / 關（預設開啟；開始刷牙前倒數 10 秒）。
- 重設所有資料：確認兩次後清除進度（家長設定保留）。
- 家長區內容比螢幕高時可以上下捲動。

- 匯入可接受新格式（schema 2）和舊格式（schema 1）的備份，舊格式會自動轉換。
- 備份檔另有 `settings`（例如 `{ "music": false }`、`{ "music": true, "ready": false }` 或 `{ "music": true, "homeMusic": false }`）；匯入時一併還原，
  舊備份沒有 `settings` 則保持目前設定；舊備份的 `settings` 沒有 `homeMusic` 時首頁音樂為開啟。

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

- `?test=1&speed=60` 計時器和預備倒數加快 60 倍（2 分鐘 = 2 秒）
- `?test=1&now=2026-09-26T08:00` 假設現在時間（本地時間，時鐘會從這個時間繼續走）
- 可合併：`?test=1&speed=60&now=2026-09-26T21:00`

## 部署（GitHub Pages）

網站：https://bella1219lee.github.io/momoke-toothbrush/ （公開 repo `bella1219lee/momoke-toothbrush`，branch `main`，根目錄）。

1. 修改後把 `sw.js` 的 `VERSION` 和 `data.js` 的 `version` 一起加一（否則已安裝的 App 會繼續用舊快取）。
2. 跑完上面兩個測試，全部通過。
3. 提交並推送：
   ```bash
   cd /workspace/momoke-app
   git add -A && git commit -m "說明這次修改" && git push
   ```
4. 等 GitHub Pages 重新發佈（通常 1–2 分鐘），確認 `https://bella1219lee.github.io/momoke-toothbrush/sw.js` 已是新的 VERSION。
5. iPhone 上關掉 App 再開一次（可能要開兩次），就會用新版本；資料會保留（舊資料會自動轉換）。
