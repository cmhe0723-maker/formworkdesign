// =====================================================================
// 下載用 Service Worker（只處理 __dl/ 下載網址，其他請求一律不經手）
// ---------------------------------------------------------------------
// Safari 不會套用 <a download> 指定的檔名於 data URL，且部分版本無法讀取 blob 連結。
// 網頁先把檔案連同 Content-Disposition 標頭放進 Cache（名稱 fw-dl），
// 再以一般連結開啟 __dl/<id>/attachment（下載）或 __dl/<id>/inline（預覽），
// 由此處自快取回傳，Safari 便會以標頭中的檔名存檔。
// =====================================================================
const CACHE = 'fw-dl';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || !/\/__dl\/[A-Za-z0-9_-]+\/(attachment|inline)$/.test(u.pathname)) return;
  e.respondWith(
    caches.open(CACHE)
      .then(c => c.match(u.origin + u.pathname))
      .then(r => r || new Response('檔案已過期，請回到網頁重新產生。\nThe file has expired; please create it again.', {
        status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      }))
  );
});
