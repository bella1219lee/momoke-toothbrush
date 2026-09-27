/*
 * 萌可刷牙 — 資料檔（唯一的卡片資料來源）
 * ---------------------------------------------------------------
 * 第一季共 81 張：24 萌可 + 5 公主 + 52 劇照。
 * 要更換圖片：
 *   1. 把圖片放進 img/s1/、img/princess/ 或 img/stills/（檔名見 README.md）
 *   2. 在下面對應項目設定 img（例如 "img/stills/ep01_a.jpg"）；沒有圖片時為 null
 *   3. 把 sw.js 裡的 VERSION 加一（例如 "v5" → "v6"），讓已安裝的 App 更新快取
 * img 為 null 或圖片載入失敗時，App 會顯示「圖片準備中」的空白卡片。
 *
 * 欄位：
 *   id       唯一代號（不可更改，已收集的紀錄靠它對應）
 *   season   "s1" / "s2" …
 *   type     "momoke" | "princess" | "still"   → 畫冊分頁：萌可 / 公主 / 劇照
 *   category （只限萌可）"royal" 皇室萌可 | "magic" 魔方萌可 | "villain" 反派萌可
 *   princess （只限皇室萌可）對應公主的 id
 *   royal    （只限公主）對應皇室萌可的 id
 *   ep       （只限劇照）集數
 *   img      圖片路徑（相對於 index.html），沒有圖片時為 null
 *   name     顯示名稱
 *   blurb    簡短介紹（可為空字串）
 *   intro    （只限劇照）畫面說明
 */
(function (root) {
  var DATA = {
    seasons: [
      {
        id: "s1",
        name: "第一季",
        open: true,
        total: 81,
        first: ["s1-m-01", "s1-p-01"],   // 第 1、2 次捕捉固定
        finalItem: "s1-m-24",            // 最後一張（第 81 張）：鬧鬧萌可
        completeTitle: "恭喜集齊第一季！",
        // 刷牙音樂：這一季的主題曲（片頭曲），刷牙時循環播放。檔案會自動加入離線快取（sw.js）。
        music: { op: { src: "audio/s1_op.m4a", type: "audio/mp4", title: "捕萌少女", duration: 55.0 } }
      },
      {
        // 第二季（未開放）。之後開放時：把 open 改成 true，並在 items 加入 season: "s2" 的卡片。
        // transform：集齊第一季後，鬧鬧萌可會變成幸福萌可（見 README「第二季」一節）。
        id: "s2",
        name: "第二季",
        open: false,
        lockedText: "第二季 敬請期待",
        transform: { from: "s1-m-24", to: null /* 例如 "s2-m-01"（幸福萌可） */ },
        // 第二季的主題曲未有檔案。之後加入：放進 audio/（例如 audio/s2_op.m4a），改成
        //   music: { op: { src: "audio/s2_op.m4a", type: "audio/mp4", title: "歌名", duration: 秒數 } }
        // 未有歌的季度會沿用最近一季的歌（logic.js songFor）。
        music: null
      }
    ],

    // 舊版（v2，10 張劇照）的劇照 id → 新版劇照 id（依 s1_stills_v2/manifest.json 的 reused_existing 對應）。
    // 讀取舊資料或匯入舊備份時自動轉換（logic.js migrateState）。
    legacyIds: {
      "s1-still-01": "s1-still-ep01a", // 01_ep01_litv.jpg      → ep01_a.jpg
      "s1-still-02": "s1-still-ep02a", // 02_ep02_tx.jpg        → ep02_a.jpg
      "s1-still-03": "s1-still-ep03a", // 03_ep03_litv.jpg      → ep03_a.jpg
      "s1-still-04": "s1-still-ep07a", // backup_02_ep07_tx.jpg → ep07_a.jpg
      "s1-still-05": "s1-still-ep07b", // 05_ep07_iq.jpg        → ep07_b.jpg
      "s1-still-06": "s1-still-ep13a", // 06_ep13_litv.jpg      → ep13_a.jpg
      "s1-still-07": "s1-still-ep14a", // 07_ep14_litv.jpg      → ep14_a.jpg
      "s1-still-08": "s1-still-ep16a", // 08_ep16_tx.jpg        → ep16_a.jpg
      "s1-still-09": "s1-still-ep20a", // 09_ep20_litv.jpg      → ep20_a.jpg
      "s1-still-10": "s1-still-ep23a"  // 10_ep23_tx.jpg        → ep23_a.jpg
    },

    items: [
    // ---- 24 萌可（圖片來自 img/s1/，名稱與介紹來自 manifest.json / blurbs.json）----
    // s1-m-01 愛心萌可：2026-09-27 採用 manifest.json 記錄的官方第一季 render（Heartsping S1 Render 2），只縮放/壓縮。
    { id: "s1-m-01", season: "s1", type: "momoke", category: "royal", name: "愛心萌可", img: "img/s1/01_aixin.jpg", blurb: "善良又重感情，說話句尾會加「啾」！", princess: "s1-p-01" },
    { id: "s1-m-02", season: "s1", type: "momoke", category: "royal", name: "正正萌可", img: "img/s1/02_zhengzheng.jpg", blurb: "聰明認真，最喜歡讀書學習。", princess: "s1-p-02" },
    { id: "s1-m-03", season: "s1", type: "momoke", category: "royal", name: "勇氣萌可", img: "img/s1/03_yongqi.jpg", blurb: "無所畏懼，最喜歡運動！", princess: "s1-p-03" },
    { id: "s1-m-04", season: "s1", type: "momoke", category: "royal", name: "盼盼萌可", img: "img/s1/04_panpan.jpg", blurb: "樂觀開朗，最喜歡澆花照顧花草。", princess: "s1-p-04" },
    { id: "s1-m-05", season: "s1", type: "momoke", category: "royal", name: "唱唱萌可", img: "img/s1/05_changchang.jpg", blurb: "開朗活潑，最愛唱歌跳舞！", princess: "s1-p-05" },
    { id: "s1-m-06", season: "s1", type: "momoke", category: "magic", name: "淘氣萌可", img: "img/s1/06_taoqi.jpg", blurb: "非常調皮，手拿著棒棒糖。" },
    { id: "s1-m-07", season: "s1", type: "momoke", category: "magic", name: "嬌嬌萌可", img: "img/s1/07_jiaojiao.jpg", blurb: "很會賣萌，揮舞著絲帶棒。" },
    { id: "s1-m-08", season: "s1", type: "momoke", category: "magic", name: "害羞萌可", img: "img/s1/08_haixiu.jpg", blurb: "很害羞，抱著胡蘿蔔抱枕。" },
    { id: "s1-m-09", season: "s1", type: "momoke", category: "magic", name: "賽賽萌可", img: "img/s1/09_saisai.jpg", blurb: "很想贏，手裡拿著旗子。" },
    { id: "s1-m-10", season: "s1", type: "momoke", category: "magic", name: "迷糊萌可", img: "img/s1/10_mihu.jpg", blurb: "很健忘，帶著橡皮擦。" },
    { id: "s1-m-11", season: "s1", type: "momoke", category: "magic", name: "幻幻萌可", img: "img/s1/11_huanhuan.jpg", blurb: "戴著魔術帽，揮舞魔術棒。" },
    { id: "s1-m-12", season: "s1", type: "momoke", category: "magic", name: "淚淚萌可", img: "img/s1/12_leilei.jpg", blurb: "容易傷心，撐著樹葉傘。" },
    { id: "s1-m-13", season: "s1", type: "momoke", category: "magic", name: "厭厭萌可", img: "img/s1/13_yanyan.jpg", blurb: "什麼都覺得厭煩，抱著枕頭。" },
    { id: "s1-m-14", season: "s1", type: "momoke", category: "magic", name: "仿仿萌可", img: "img/s1/14_fangfang.jpg", blurb: "最喜歡模仿別人，拿著望遠鏡。" },
    { id: "s1-m-15", season: "s1", type: "momoke", category: "magic", name: "美美萌可", img: "img/s1/15_meimei.jpg", blurb: "非常愛美，手拿口紅。" },
    { id: "s1-m-16", season: "s1", type: "momoke", category: "magic", name: "怕怕萌可", img: "img/s1/16_papa.jpg", blurb: "很膽小，拿著手電筒。" },
    { id: "s1-m-17", season: "s1", type: "momoke", category: "magic", name: "妒妒萌可", img: "img/s1/17_dudu.jpg", blurb: "愛嫉妒，帶著眼影盤和化妝刷。" },
    { id: "s1-m-18", season: "s1", type: "momoke", category: "magic", name: "乖乖萌可", img: "img/s1/18_guaiguai.jpg", blurb: "非常乖巧，手拿印章。" },
    { id: "s1-m-19", season: "s1", type: "momoke", category: "magic", name: "八卦萌可", img: "img/s1/19_bagua.jpg", blurb: "很愛嘮叨，拿著擴音器。" },
    { id: "s1-m-20", season: "s1", type: "momoke", category: "magic", name: "貪貪萌可", img: "img/s1/20_tantan.jpg", blurb: "很貪心，提著籃子。" },
    { id: "s1-m-21", season: "s1", type: "momoke", category: "magic", name: "怒怒萌可", img: "img/s1/21_nunu.jpg", blurb: "很容易生氣，拿著火焰扇子。" },
    { id: "s1-m-22", season: "s1", type: "momoke", category: "magic", name: "否否萌可", img: "img/s1/22_foufou.jpg", blurb: "什麼都拒絕，舉著禁止牌。" },
    { id: "s1-m-23", season: "s1", type: "momoke", category: "magic", name: "戀戀萌可", img: "img/s1/23_lianlian.jpg", blurb: "很有吸引力，拿著弓箭。" },
    { id: "s1-m-24", season: "s1", type: "momoke", category: "villain", name: "鬧鬧萌可", img: "img/s1/24_naonao.jpg", blurb: "搗蛋鬼，拿著閃電錘，句尾「咚咚」！" },

    // ---- 5 位公主（樂美的公主形態）：圖片來自 s1_princess/0X_*_gongzhu.png ----
    { id: "s1-p-01", season: "s1", type: "princess", name: "愛心公主", royal: "s1-m-01", img: "img/princess/01_aixin.jpg", blurb: "樂美和愛心萌可一起變身成愛心公主！" },
    { id: "s1-p-02", season: "s1", type: "princess", name: "正義公主", royal: "s1-m-02", img: "img/princess/02_zhengyi.jpg", blurb: "樂美和正正萌可一起變身成正義公主！" },
    { id: "s1-p-03", season: "s1", type: "princess", name: "勇氣公主", royal: "s1-m-03", img: "img/princess/03_yongqi.jpg", blurb: "樂美和勇氣萌可一起變身成勇氣公主！" },
    { id: "s1-p-04", season: "s1", type: "princess", name: "希望公主", royal: "s1-m-04", img: "img/princess/04_xiwang.jpg", blurb: "樂美和盼盼萌可一起變身成希望公主！" },
    { id: "s1-p-05", season: "s1", type: "princess", name: "音樂公主", royal: "s1-m-05", img: "img/princess/05_yinyue.jpg", blurb: "樂美和唱唱萌可一起變身成音樂公主！" },

    // ---- 52 張劇照（每集 a、b 兩張，按集數排列）：name / blurb / intro 原文取自 s1_stills_v2/blurbs.json（title / blurb / intro）----
    { id: "s1-still-ep01a", season: "s1", type: "still", ep: 1, name: "樂美與愛心萌可", img: "img/stills/ep01_a.jpg", blurb: "第1集〈亂七八糟的烘焙直播〉", intro: "變身後的愛心公主在粉紅色小店裡。" }, // s1_stills_v2/ep01_a.jpg（沿用 s1_stills/01_ep01_litv.jpg）
    { id: "s1-still-ep01b", season: "s1", type: "still", ep: 1, name: "樂美與愛心萌可", img: "img/stills/ep01_b.jpg", blurb: "第1集〈亂七八糟的烘焙直播〉", intro: "樂美想把萌可鏡盒拿出來看看。" }, // s1_stills_v2/ep01_b.jpg（沿用 s1_stills/backup_01_ep01_tx.jpg）
    { id: "s1-still-ep02a", season: "s1", type: "still", ep: 2, name: "愛心公主與愛心萌可", img: "img/stills/ep02_a.jpg", blurb: "第2集〈嬌嬌萌可太過分了〉", intro: "愛心公主說嬌嬌萌可就在附近。" }, // s1_stills_v2/ep02_a.jpg（沿用 s1_stills/02_ep02_tx.jpg）
    { id: "s1-still-ep02b", season: "s1", type: "still", ep: 2, name: "樂美與愛心萌可", img: "img/stills/ep02_b.jpg", blurb: "第2集〈嬌嬌萌可太過分了〉", intro: "樂美低頭沉思，愛心萌可陪在身旁。" }, // s1_stills_v2/ep02_b.jpg
    { id: "s1-still-ep03a", season: "s1", type: "still", ep: 3, name: "樂美與愛心萌可", img: "img/stills/ep03_a.jpg", blurb: "第3集〈不要害羞〉", intro: "戴著頭盔的樂美，肩上坐著愛心萌可。" }, // s1_stills_v2/ep03_a.jpg（沿用 s1_stills/03_ep03_litv.jpg）
    { id: "s1-still-ep03b", season: "s1", type: "still", ep: 3, name: "害羞萌可", img: "img/stills/ep03_b.jpg", blurb: "第3集〈不要害羞〉", intro: "害羞萌可抱著紅蘿蔔抱枕，暈頭轉向。" }, // s1_stills_v2/ep03_b.jpg
    { id: "s1-still-ep04a", season: "s1", type: "still", ep: 4, name: "樂美與愛心萌可", img: "img/stills/ep04_a.jpg", blurb: "第4集〈生活小標兵 正正萌可〉", intro: "樂美帶著愛心萌可走在街上。" }, // s1_stills_v2/ep04_a.jpg
    { id: "s1-still-ep04b", season: "s1", type: "still", ep: 4, name: "正正萌可", img: "img/stills/ep04_b.jpg", blurb: "第4集〈生活小標兵 正正萌可〉", intro: "正正萌可站在一雙手的手心上。" }, // s1_stills_v2/ep04_b.jpg
    { id: "s1-still-ep05a", season: "s1", type: "still", ep: 5, name: "正義公主", img: "img/stills/ep05_a.jpg", blurb: "第5集〈誰是最棒的〉", intro: "正義公主站在街角，地上有小萌可。" }, // s1_stills_v2/ep05_a.jpg
    { id: "s1-still-ep05b", season: "s1", type: "still", ep: 5, name: "粉紅頭髮的哥哥", img: "img/stills/ep05_b.jpg", blurb: "第5集〈誰是最棒的〉", intro: "粉紅頭髮的哥哥開心地笑著。" }, // s1_stills_v2/ep05_b.jpg
    { id: "s1-still-ep06a", season: "s1", type: "still", ep: 6, name: "勇氣萌可", img: "img/stills/ep06_a.jpg", blurb: "第6集〈勇敢一點 詩雅〉", intro: "勇氣萌可站在牆頭上張望。" }, // s1_stills_v2/ep06_a.jpg
    { id: "s1-still-ep06b", season: "s1", type: "still", ep: 6, name: "棕髮女孩", img: "img/stills/ep06_b.jpg", blurb: "第6集〈勇敢一點 詩雅〉", intro: "棕色長髮的女孩看起來有點難過。" }, // s1_stills_v2/ep06_b.jpg
    { id: "s1-still-ep07a", season: "s1", type: "still", ep: 7, name: "正義公主與正正萌可", img: "img/stills/ep07_a.jpg", blurb: "第7集〈忘記也沒什麼大不了〉", intro: "正義公主手握魔法棒。" }, // s1_stills_v2/ep07_a.jpg（沿用 s1_stills/backup_02_ep07_tx.jpg）
    { id: "s1-still-ep07b", season: "s1", type: "still", ep: 7, name: "樂美與愛心萌可、正正萌可", img: "img/stills/ep07_b.jpg", blurb: "第7集〈忘記也沒什麼大不了〉", intro: "樂美在學校儲物櫃前皺著眉頭。" }, // s1_stills_v2/ep07_b.jpg（沿用 s1_stills/05_ep07_iq.jpg）
    { id: "s1-still-ep08a", season: "s1", type: "still", ep: 8, name: "愛心公主", img: "img/stills/ep08_a.jpg", blurb: "第8集〈奇怪的幻覺〉", intro: "愛心公主和戴黃帽的孩子站在一起。" }, // s1_stills_v2/ep08_a.jpg
    { id: "s1-still-ep08b", season: "s1", type: "still", ep: 8, name: "戴黃帽的孩子", img: "img/stills/ep08_b.jpg", blurb: "第8集〈奇怪的幻覺〉", intro: "戴黃帽的孩子在教室裡開心大笑。" }, // s1_stills_v2/ep08_b.jpg
    { id: "s1-still-ep09a", season: "s1", type: "still", ep: 9, name: "盼盼萌可", img: "img/stills/ep09_a.jpg", blurb: "第9集〈希望的力量〉", intro: "盼盼萌可在樹林小路上奔跑。" }, // s1_stills_v2/ep09_a.jpg
    { id: "s1-still-ep09b", season: "s1", type: "still", ep: 9, name: "愛心公主與愛心萌可", img: "img/stills/ep09_b.jpg", blurb: "第9集〈希望的力量〉", intro: "愛心公主身旁跟著愛心萌可。" }, // s1_stills_v2/ep09_b.jpg
    { id: "s1-still-ep10a", season: "s1", type: "still", ep: 10, name: "樂美", img: "img/stills/ep10_a.jpg", blurb: "第10集〈眼淚糖果是什麼味道〉", intro: "樂美在公園裡開心地張開雙臂。" }, // s1_stills_v2/ep10_a.jpg
    { id: "s1-still-ep10b", season: "s1", type: "still", ep: 10, name: "希望公主", img: "img/stills/ep10_b.jpg", blurb: "第10集〈眼淚糖果是什麼味道〉", intro: "希望公主舉起鏡盒，閃閃發光。" }, // s1_stills_v2/ep10_b.jpg
    { id: "s1-still-ep11a", season: "s1", type: "still", ep: 11, name: "愛心萌可、正正萌可、盼盼萌可", img: "img/stills/ep11_a.jpg", blurb: "第11集〈追蹤厭厭萌可〉", intro: "三隻萌可和草莓杯子蛋糕排排坐。" }, // s1_stills_v2/ep11_a.jpg
    { id: "s1-still-ep11b", season: "s1", type: "still", ep: 11, name: "樂美", img: "img/stills/ep11_b.jpg", blurb: "第11集〈追蹤厭厭萌可〉", intro: "樂美睜大眼睛，好像發現了什麼。" }, // s1_stills_v2/ep11_b.jpg
    { id: "s1-still-ep12a", season: "s1", type: "still", ep: 12, name: "樂美與愛心萌可", img: "img/stills/ep12_a.jpg", blurb: "第12集〈放聲歌唱吧〉", intro: "樂美和肩上的愛心萌可望向前方。" }, // s1_stills_v2/ep12_a.jpg
    { id: "s1-still-ep12b", season: "s1", type: "still", ep: 12, name: "書桌前的女孩", img: "img/stills/ep12_b.jpg", blurb: "第12集〈放聲歌唱吧〉", intro: "女孩坐在書桌前，架上有隻小萌可。" }, // s1_stills_v2/ep12_b.jpg
    { id: "s1-still-ep13a", season: "s1", type: "still", ep: 13, name: "音樂公主與唱唱萌可", img: "img/stills/ep13_a.jpg", blurb: "第13集〈無法停止的舞蹈〉", intro: "音樂公主在公園裡露出驚訝表情。" }, // s1_stills_v2/ep13_a.jpg（沿用 s1_stills/06_ep13_litv.jpg）
    { id: "s1-still-ep13b", season: "s1", type: "still", ep: 13, name: "樂美", img: "img/stills/ep13_b.jpg", blurb: "第13集〈無法停止的舞蹈〉", intro: "樂美站在粉紅色的房間裡。" }, // s1_stills_v2/ep13_b.jpg
    { id: "s1-still-ep14a", season: "s1", type: "still", ep: 14, name: "愛心公主與美美萌可", img: "img/stills/ep14_a.jpg", blurb: "第14集〈千萬別照鏡子〉", intro: "愛心公主和桌上的美美萌可。" }, // s1_stills_v2/ep14_a.jpg（沿用 s1_stills/07_ep14_litv.jpg）
    { id: "s1-still-ep14b", season: "s1", type: "still", ep: 14, name: "樂美和棕髮女孩", img: "img/stills/ep14_b.jpg", blurb: "第14集〈千萬別照鏡子〉", intro: "樂美和棕色長髮的女孩站在一起。" }, // s1_stills_v2/ep14_b.jpg
    { id: "s1-still-ep15a", season: "s1", type: "still", ep: 15, name: "愛心萌可", img: "img/stills/ep15_a.jpg", blurb: "第15集〈回來吧 愛心萌可〉", intro: "愛心萌可開心地指著杯子蛋糕。" }, // s1_stills_v2/ep15_a.jpg
    { id: "s1-still-ep15b", season: "s1", type: "still", ep: 15, name: "樂美", img: "img/stills/ep15_b.jpg", blurb: "第15集〈回來吧 愛心萌可〉", intro: "樂美在掛著彩旗的房間裡。" }, // s1_stills_v2/ep15_b.jpg
    { id: "s1-still-ep16a", season: "s1", type: "still", ep: 16, name: "樂美與勇氣萌可、盼盼萌可", img: "img/stills/ep16_a.jpg", blurb: "第16集〈怕怕萌可的拍照遊戲〉", intro: "樂美雙手叉腰站在樹叢前。" }, // s1_stills_v2/ep16_a.jpg（沿用 s1_stills/08_ep16_tx.jpg）
    { id: "s1-still-ep16b", season: "s1", type: "still", ep: 16, name: "愛心萌可、正正萌可、勇氣萌可", img: "img/stills/ep16_b.jpg", blurb: "第16集〈怕怕萌可的拍照遊戲〉", intro: "三隻皇室萌可一起站在陽光下。" }, // s1_stills_v2/ep16_b.jpg
    { id: "s1-still-ep17a", season: "s1", type: "still", ep: 17, name: "樂美", img: "img/stills/ep17_a.jpg", blurb: "第17集〈只能愛我一個〉", intro: "樂美在粉紅色的店裡手按胸口。" }, // s1_stills_v2/ep17_a.jpg
    { id: "s1-still-ep17b", season: "s1", type: "still", ep: 17, name: "妒妒萌可與愛心萌可", img: "img/stills/ep17_b.jpg", blurb: "第17集〈只能愛我一個〉", intro: "妒妒萌可和愛心萌可圍著杯子蛋糕。" }, // s1_stills_v2/ep17_b.jpg
    { id: "s1-still-ep18a", season: "s1", type: "still", ep: 18, name: "愛心萌可與正正萌可", img: "img/stills/ep18_a.jpg", blurb: "第18集〈一波三折的生日派對〉", intro: "愛心萌可張大嘴巴，非常驚訝。" }, // s1_stills_v2/ep18_a.jpg
    { id: "s1-still-ep18b", season: "s1", type: "still", ep: 18, name: "戴黃帽的孩子與勇氣萌可", img: "img/stills/ep18_b.jpg", blurb: "第18集〈一波三折的生日派對〉", intro: "勇氣萌可坐在戴黃帽孩子的肩上。" }, // s1_stills_v2/ep18_b.jpg
    { id: "s1-still-ep19a", season: "s1", type: "still", ep: 19, name: "樂美與愛心萌可", img: "img/stills/ep19_a.jpg", blurb: "第19集〈幸運印章〉", intro: "樂美和愛心萌可靠在一起。" }, // s1_stills_v2/ep19_a.jpg
    { id: "s1-still-ep19b", season: "s1", type: "still", ep: 19, name: "乖乖萌可", img: "img/stills/ep19_b.jpg", blurb: "第19集〈幸運印章〉", intro: "乖乖萌可抱著粉紅色的大印章。" }, // s1_stills_v2/ep19_b.jpg
    { id: "s1-still-ep20a", season: "s1", type: "still", ep: 20, name: "希望公主與盼盼萌可、愛心萌可", img: "img/stills/ep20_a.jpg", blurb: "第20集〈說出你的秘密吧〉", intro: "希望公主帶著盼盼萌可和愛心萌可。" }, // s1_stills_v2/ep20_a.jpg（沿用 s1_stills/09_ep20_litv.jpg）
    { id: "s1-still-ep20b", season: "s1", type: "still", ep: 20, name: "愛心萌可與正正萌可", img: "img/stills/ep20_b.jpg", blurb: "第20集〈說出你的秘密吧〉", intro: "愛心萌可和正正萌可並肩站著。" }, // s1_stills_v2/ep20_b.jpg
    { id: "s1-still-ep21a", season: "s1", type: "still", ep: 21, name: "愛心萌可", img: "img/stills/ep21_a.jpg", blurb: "第21集〈泡泡糖的災難〉", intro: "愛心萌可睜著閃亮的大眼睛。" }, // s1_stills_v2/ep21_a.jpg
    { id: "s1-still-ep21b", season: "s1", type: "still", ep: 21, name: "勇氣萌可", img: "img/stills/ep21_b.jpg", blurb: "第21集〈泡泡糖的災難〉", intro: "勇氣萌可在藍天白雲下。" }, // s1_stills_v2/ep21_b.jpg
    { id: "s1-still-ep22a", season: "s1", type: "still", ep: 22, name: "樂美", img: "img/stills/ep22_a.jpg", blurb: "第22集〈貪心大王 貪貪萌可〉", intro: "樂美和戴草帽的女士在店裡。" }, // s1_stills_v2/ep22_a.jpg
    { id: "s1-still-ep22b", season: "s1", type: "still", ep: 22, name: "貪貪萌可", img: "img/stills/ep22_b.jpg", blurb: "第22集〈貪心大王 貪貪萌可〉", intro: "貪貪萌可站在大塊餅乾旁邊。" }, // s1_stills_v2/ep22_b.jpg
    { id: "s1-still-ep23a", season: "s1", type: "still", ep: 23, name: "希望公主與愛心萌可、盼盼萌可", img: "img/stills/ep23_a.jpg", blurb: "第23集〈不要生氣了〉", intro: "希望公主瞪大眼睛，身旁有兩隻萌可。" }, // s1_stills_v2/ep23_a.jpg（沿用 s1_stills/10_ep23_tx.jpg）
    { id: "s1-still-ep23b", season: "s1", type: "still", ep: 23, name: "盼盼萌可", img: "img/stills/ep23_b.jpg", blurb: "第23集〈不要生氣了〉", intro: "盼盼萌可在街上轉頭張望。" }, // s1_stills_v2/ep23_b.jpg
    { id: "s1-still-ep24a", season: "s1", type: "still", ep: 24, name: "皇室萌可們", img: "img/stills/ep24_a.jpg", blurb: "第24集〈正正萌可變多了〉", intro: "地板上出現了好幾隻正正萌可。" }, // s1_stills_v2/ep24_a.jpg
    { id: "s1-still-ep24b", season: "s1", type: "still", ep: 24, name: "樂美", img: "img/stills/ep24_b.jpg", blurb: "第24集〈正正萌可變多了〉", intro: "樂美嚇了一跳，睜大了眼睛。" }, // s1_stills_v2/ep24_b.jpg
    { id: "s1-still-ep25a", season: "s1", type: "still", ep: 25, name: "樂美", img: "img/stills/ep25_a.jpg", blurb: "第25集〈拒絕一切的否否萌可〉", intro: "樂美轉頭看著身旁的人。" }, // s1_stills_v2/ep25_a.jpg
    { id: "s1-still-ep25b", season: "s1", type: "still", ep: 25, name: "希望公主", img: "img/stills/ep25_b.jpg", blurb: "第25集〈拒絕一切的否否萌可〉", intro: "希望公主豎起手指說話。" }, // s1_stills_v2/ep25_b.jpg
    { id: "s1-still-ep26a", season: "s1", type: "still", ep: 26, name: "萌可們", img: "img/stills/ep26_a.jpg", blurb: "第26集〈戀戀萌可的箭〉", intro: "萌可們圍在床邊看著勇氣萌可。" }, // s1_stills_v2/ep26_a.jpg
    { id: "s1-still-ep26b", season: "s1", type: "still", ep: 26, name: "樂美", img: "img/stills/ep26_b.jpg", blurb: "第26集〈戀戀萌可的箭〉", intro: "樂美在粉紅色房間裡露出笑容。" }, // s1_stills_v2/ep26_b.jpg
    ]
  };

  root.MOMOKE_DATA = DATA;
  if (typeof module !== "undefined" && module.exports) module.exports = DATA;
})(typeof self !== "undefined" ? self : this);
