/* 萌可刷牙 — Service Worker（離線快取）
 * 新增/更換任何檔案後，把 VERSION 加一（例如 "v1" → "v2"），已安裝的 App 會在下次開啟時更新。
 */
var VERSION = "v2";
var CACHE = "momoke-brush-" + VERSION;
importScripts("data.js");

var CORE = [
  "./",
  "index.html",
  "styles.css",
  "data.js",
  "logic.js",
  "app.js",
  "manifest.webmanifest",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png"
];
// 所有卡片圖片由 data.js 自動列出（img 不是 null 的項目）
var IMAGES = (self.MOMOKE_DATA.items || []).filter(function (i) { return i.img; }).map(function (i) { return i.img; });

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      var reload = function (u) { return new Request(u, { cache: "reload" }); };
      return cache.addAll(CORE.map(reload)).then(function () {
        // 圖片逐一加入：個別圖片缺失不會令整個安裝失敗
        return Promise.all(IMAGES.map(function (u) {
          return fetch(reload(u)).then(function (res) { if (res.ok) return cache.put(u, res); }).catch(function () {});
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
  event.respondWith(
    caches.match(req, { ignoreSearch: true, cacheName: CACHE }).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok && res.type === "basic") {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
