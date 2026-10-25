/* DoKit service worker (restore).
 * Precache the core shell so the site opens offline; navigations fall
 * back to the offline page when the network is gone. */
// v5 (Oct 25): bumped from dokit-v1 so updated builds replace stale
// cached files — the activate handler below already deletes old caches.
var CACHE = 'dokit-v2';
var ORIGIN = self.location.origin;
var BASE = self.location.pathname.replace(/sw\.js$/, '');
function u(p) { return ORIGIN + BASE + p; }
var CORE = [u(''), u('tools/'), u('typing/'), u('guides/'),
  u('pricing/'), u('faq/'), u('offline/'),
  u('assets/css/style.css'), u('assets/js/main.js')];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(CORE);
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') { return; }
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) { return; }
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(function () {
      return caches.match(u('offline/'));
    }));
    return;
  }
  e.respondWith(caches.match(e.request).then(function (hit) {
    return hit || fetch(e.request);
  }));
});
