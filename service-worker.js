/**
 * 旅のしおり Service Worker
 * - アプリシェル（HTML/アイコン/manifest）はキャッシュして高速＆オフライン起動
 * - Firebase / 外部APIなどの動的リクエストはネットワーク優先
 * - バージョン番号を上げると古いキャッシュを自動削除
 */
const CACHE_VERSION = 'v1.0.2';
const CACHE_NAME = `tabi-no-shiori-${CACHE_VERSION}`;

// アプリシェル：このファイル一覧はインストール時に先読みする
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon-32.png'
];

// インストール：シェルを先読み
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// 有効化：古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// フェッチ戦略
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // GET 以外はそのままネットワークへ
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Firebase / Google APIs / その他の動的なAPIはネットワーク優先（オフライン時のみキャッシュ）
  const dynamicHosts = [
    'firebaseio.com',
    'firebasestorage.googleapis.com',
    'firestore.googleapis.com',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
    'cloudfunctions.net',
    'googleapis.com'
  ];
  if (dynamicHosts.some((h) => url.hostname.endsWith(h))) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // ナビゲーションリクエストはネットワーク優先 → 失敗したら index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // それ以外（CDNのスクリプト・アイコンなど）はキャッシュ優先 → 失敗したらネットワーク → 取得時に更新
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((res) => {
        if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
