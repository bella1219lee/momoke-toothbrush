/*
 * 萌可刷牙 — 資料檔（唯一的卡片資料來源）
 * ---------------------------------------------------------------
 * 要加入公主圖片或劇照：
 *   1. 把圖片放進 img/princess/ 或 img/stills/（檔名見 README.md）
 *   2. 在下面對應項目把 img: null 改成圖片路徑（例如 "img/princess/01_aixin.jpg"）
 *      劇照也可以改 name（標題）和 blurb（說明）
 *   3. 把 sw.js 裡的 VERSION 加一（例如 "v1" → "v2"），讓已安裝的 App 更新快取
 * img 為 null 或圖片載入失敗時，App 會顯示「圖片準備中」的空白卡片。
 *
 * 欄位：
 *   id       唯一代號（不可更改，已收集的紀錄靠它對應）
 *   season   "s1" / "s2" …
 *   type     "momoke" | "princess" | "still"   → 畫冊分頁：萌可 / 公主 / 劇照
 *   category （只限萌可）"royal" 皇室萌可 | "magic" 魔方萌可 | "villain" 反派萌可
 *   princess （只限皇室萌可）對應公主的 id
 *   royal    （只限公主）對應皇室萌可的 id
 *   img      圖片路徑（相對於 index.html），沒有圖片時為 null
 *   name     顯示名稱
 *   blurb    簡短介紹（可為空字串）
 */
(function (root) {
  var DATA = {
    seasons: [
      {
        id: "s1",
        name: "第一季",
        open: true,
        total: 39,
        first: ["s1-m-01", "s1-p-01"],   // 第 1、2 次捕捉固定
        finalItem: "s1-m-24",            // 第 39 張：鬧鬧萌可
        completeTitle: "恭喜集齊第一季！"
      },
      {
        // 第二季（未開放）。之後開放時：把 open 改成 true，並在 items 加入 season: "s2" 的卡片。
        // transform：集齊第一季後，鬧鬧萌可會變成幸福萌可（見 README「第二季」一節）。
        id: "s2",
        name: "第二季",
        open: false,
        lockedText: "第二季 敬請期待",
        transform: { from: "s1-m-24", to: null /* 例如 "s2-m-01"（幸福萌可） */ }
      }
    ],

    items: [
    // ---- 24 萌可（圖片來自 img/s1/，名稱與介紹來自 manifest.json / blurbs.json）----
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

    // ---- 10 張劇照（按集數排列）：name / blurb 取自 s1_stills/blurbs.json（title / blurb）----
    { id: "s1-still-01", season: "s1", type: "still", name: "樂美與愛心萌可", img: "img/stills/s1-still-01.jpg", blurb: "第1集〈亂七八糟的烘焙直播〉" }, // 來源：s1_stills/01_ep01_litv.jpg
    { id: "s1-still-02", season: "s1", type: "still", name: "愛心公主與愛心萌可", img: "img/stills/s1-still-02.jpg", blurb: "第2集〈嬌嬌萌可太過分了〉" }, // 來源：s1_stills/02_ep02_tx.jpg
    { id: "s1-still-03", season: "s1", type: "still", name: "樂美與愛心萌可", img: "img/stills/s1-still-03.jpg", blurb: "第3集〈不要害羞〉" }, // 來源：s1_stills/03_ep03_litv.jpg
    { id: "s1-still-04", season: "s1", type: "still", name: "正義公主與正正萌可", img: "img/stills/s1-still-04.jpg", blurb: "第7集〈忘記也沒什麼大不了〉" }, // 來源：s1_stills/backup_02_ep07_tx.jpg
    { id: "s1-still-05", season: "s1", type: "still", name: "樂美與愛心萌可、正正萌可", img: "img/stills/s1-still-05.jpg", blurb: "第7集〈忘記也沒什麼大不了〉" }, // 來源：s1_stills/05_ep07_iq.jpg
    { id: "s1-still-06", season: "s1", type: "still", name: "音樂公主與唱唱萌可", img: "img/stills/s1-still-06.jpg", blurb: "第13集〈無法停止的舞蹈〉" }, // 來源：s1_stills/06_ep13_litv.jpg
    { id: "s1-still-07", season: "s1", type: "still", name: "愛心公主與美美萌可", img: "img/stills/s1-still-07.jpg", blurb: "第14集〈千萬別照鏡子〉" }, // 來源：s1_stills/07_ep14_litv.jpg
    { id: "s1-still-08", season: "s1", type: "still", name: "樂美與勇氣萌可、盼盼萌可", img: "img/stills/s1-still-08.jpg", blurb: "第16集〈怕怕萌可的拍照遊戲〉" }, // 來源：s1_stills/08_ep16_tx.jpg
    { id: "s1-still-09", season: "s1", type: "still", name: "希望公主與盼盼萌可、愛心萌可", img: "img/stills/s1-still-09.jpg", blurb: "第20集〈說出你的秘密吧〉" }, // 來源：s1_stills/09_ep20_litv.jpg
    { id: "s1-still-10", season: "s1", type: "still", name: "希望公主與愛心萌可、盼盼萌可", img: "img/stills/s1-still-10.jpg", blurb: "第23集〈不要生氣了〉" }, // 來源：s1_stills/10_ep23_tx.jpg
    ]
  };

  root.MOMOKE_DATA = DATA;
  if (typeof module !== "undefined" && module.exports) module.exports = DATA;
})(typeof self !== "undefined" ? self : this);
