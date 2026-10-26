/* DoKit service worker (restore).
 * Precache the core shell so the site opens offline; navigations fall
 * back to the offline page when the network is gone. */
// v6 (Oct 26): bumped from dokit-v2 so the Oct 26 account.js / main.js /
// style.css replace stale cached files — the Oct 26 profile form click
// did nothing in browsers holding the v2 cache (old account.js has no
// Update Profile binding). The activate handler deletes old caches.
// v7 (Oct 26): bumped to dokit-v4 so the referral writer fix (typing
// page now loads account.js + Firebase) replaces stale cached JS —
// without the bump, browsers holding v3 keep serving the old files
// and the activation writer can never fire.
// v8 (Oct 26): dokit-v5 — referral capture fallback needs fresh account.js.
// v9 (Oct 26): dokit-v6 — signup race fix needs fresh account.js.
// v10 (Oct 26): dokit-v7 — JS/CSS network-reload-first.
var CACHE = 'dokit-v7';
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
  /* Fresh-JS rule (live-test 4, Oct 26): Pages serves JS with
   * max-age=600, so a session could run a 10-minute-old account.js
   * and fail on already-fixed code. JS/CSS therefore always
   * revalidate from the network (bypassing the HTTP cache) and fall
   * back to the worker cache only when offline. Other same-origin
   * assets keep cache-first. */
  if (/\.(js|css)(\?|#|$)/.test(url.pathname)) {
    e.respondWith(fetch(e.request, { cache: 'reload' }).catch(function () {
      return caches.match(e.request);
    }));
    return;
  }
  e.respondWith(caches.match(e.request).then(function (hit) {
    return hit || fetch(e.request);
  }));
});
