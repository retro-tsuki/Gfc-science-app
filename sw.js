const CACHE_NAME = 'my-site-cache-v1';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
];

// ① インストール：指定したリソースをキャッシュに保存
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('を開いたキャッシュ');
        return cache.addAll(URLS_TO_CACHE);
      })
  );
  // 新しいService Workerをすぐに有効化する
  self.skipWaiting();
});

// ② アクティベート：古いキャッシュの削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('古いキャッシュを削除:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  // ページのリロードなしで、すぐに制御を開始する
  self.clients.claim();
});

// ③ フェッチ：リクエストを横取りしてキャッシュがあればそれを返す（オフライン対応）
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // キャッシュがあればそれを返す、なければ通常のネットワーク通信を行う
        return response || fetch(event.request);
      })
  );
});
