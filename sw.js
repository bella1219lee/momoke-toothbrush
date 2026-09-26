/* 萌可刷牙 — Service Worker（離線快取）
 * 新增/更換任何檔案後，把 VERSION 加一（例如 "v5" → "v6"），已安裝的 App 會在下次開啟時更新。
 */
var VERSION = "v5";
var CACHE = "momoke-brush-" + VERSION;
importScripts("data.js");

var CORE = [
  "./",
  "index.html",
  "styles.css",
  "data.js",
  "logic.js",
  "brushfx.js",
  "app.js",
  "manifest.webmanifest",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png"
];
// 所有卡片圖片由 data.js 自動列出（img 不是 null 的項目）
var IMAGES = (self.MOMOKE_DATA.items || []).filter(function (i) { return i.img; }).map(function (i) { return i.img; });
// 刷牙音樂（data.js 各季的 music.op.src）
var MUSIC = (self.MOMOKE_DATA.seasons || []).filter(function (s) { return s.music && s.music.op && s.music.op.src; })
  .map(function (s) { return s.music.op.src; });

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      var reload = function (u) { return new Request(u, { cache: "reload" }); };
      return cache.addAll(CORE.map(reload)).then(function () {
        // 圖片和音樂逐一加入：個別檔案缺失不會令整個安裝失敗
        return Promise.all(IMAGES.concat(MUSIC).map(function (u) {
          return fetch(reload(u)).then(function (res) { if (res.status === 200) return cache.put(u, res); }).catch(function () {});
        }));
      });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k.indexOf("momoke-brush-") === 0 && k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

/**
 * 音訊（<audio>）會送出 Range 請求；Safari 必須收到 206 部分內容才會播放，
 * 所以從快取回應時按 Range 切出需要的部分。
 */
function rangeResponse(range, res) {
  return res.arrayBuffer().then(function (buf) {
    var size = buf.byteLength;
    var type = res.headers.get("Content-Type") || "audio/mp4";
    var m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!m || (m[1] === "" && m[2] === "")) {
      return new Response(buf, { status: 200, headers: { "Content-Type": type, "Content-Length": String(size), "Accept-Ranges": "bytes" } });
    }
    var start, end;
    if (m[1] === "") { start = Math.max(0, size - Number(m[2])); end = size - 1; }
    else { start = Number(m[1]); end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1); }
    if (start >= size || start > end) {
      return new Response(null, { status: 416, statusText: "Range Not Satisfiable", headers: { "Content-Range": "bytes */" + size } });
    }
    return new Response(buf.slice(start, end + 1), {
      status: 206, statusText: "Partial Content",
      headers: { "Content-Type": type, "Content-Length": String(end - start + 1), "Content-Range": "bytes " + start + "-" + end + "/" + size, "Accept-Ranges": "bytes" }
    });
  });
}

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (req.mode === "navigate") {
    event.respondWith(
      caches.match("index.html", { cacheName: CACHE }).then(function (hit) {
        return hit || fetch(req);
      }).catch(function () { return caches.match("./"); })
    );
    return;
  }
  var range = req.headers.get("range");
  if (range) {
    event.respondWith(
      caches.match(req.url, { ignoreSearch: true, cacheName: CACHE }).then(function (hit) {
        return hit ? rangeResponse(range, hit) : fetch(req);
      })
    );
    return;
  }
  event.respondWith(
    caches.match(req, { ignoreSearch: true, cacheName: CACHE }).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === "basic") {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
        }
        return res;
      });
    })
  );
});
