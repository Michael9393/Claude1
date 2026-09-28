// Service worker: bewaart de app zodat hij offline werkt en te installeren is.
// Verhoog CACHE bij elke nieuwe versie; de oude cache wordt dan opgeruimd.
// Op GitHub Pages delen al je repo's één origin: raak alleen caches aan die met PREFIX beginnen.
var PREFIX = 'theorie-b-';
var CACHE = PREFIX + '2026-09-28b';
var FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/util.js',
  'js/data/signs.js',
  'js/data/questions.js',
  'js/data/voorrang.js',
  'js/store.js',
  'js/intersection.js',
  'js/app.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  // cache: 'reload' haalt verse bestanden op, niet de kopie uit de HTTP-cache van de browser.
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(FILES.map(function (f) { return new Request(f, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf(PREFIX) === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Eerst het netwerk (dan heb je altijd de nieuwste vragen), zonder netwerk de bewaarde versie.
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // Alleen in onze eigen cache kijken, niet in die van andere sites op dezelfde origin.
  var own = caches.open(CACHE);
  e.respondWith(
    fetch(req).then(function (res) {
      if (res.ok) {
        var copy = res.clone();
        e.waitUntil(own.then(function (c) { return c.put(req, copy); }));
      }
      return res;
    }).catch(function () {
      return own.then(function (c) {
        return c.match(req, { ignoreSearch: true }).then(function (hit) {
          return hit || (req.mode === 'navigate' ? c.match('index.html') : Response.error());
        });
      });
    })
  );
});
