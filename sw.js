// オフライン動作用。素材カタログは network-first、それ以外は cache-first。
// tools/deploy.sh が中身のハッシュでこの行を書き換える
const CACHE = 'monosashi-d5865ae3';
const SHELL = [
  './',
  './index.html',
  './styles.css?v=2',
  './manifest.webmanifest',
  './js/app.js',
  './js/db.js',
  './js/util.js',
  './js/store.js',
  './js/scheduler.js',
  './js/subquestions.js',
  './js/screens/home.js',
  './js/screens/session.js',
  './js/screens/expose.js',
  './js/screens/capture.js',
  './js/screens/review.js',
  './js/screens/settings.js',
  './data/items.json',
];

// 待機状態に留まらせない。app.js 側が controllerchange で1度だけ再読み込みする。
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // 素材カタログは更新を優先する（入荷の検知に使う）
  if (url.pathname.endsWith('/data/items.json')) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }))
  );
});
