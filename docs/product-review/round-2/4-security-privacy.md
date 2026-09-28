# Security & privacy review: Theorie B

Method: I read all the code and ran headless Chromium against `python3 -m http.server` with the repo mounted at `/Claude1/` and a sibling `/other/` page on the same origin, which simulates `username.github.io`. Scripts are `review2/sec.js` and `review2/off.js`.

## Confirmed OK
- **No DOM XSS found.** Every `innerHTML` sink escapes the stored or user values it uses (`esc()`, `Number()`, whitelist lookups). I put `<img onerror>` payloads into `mistakes.given/topic/last/count`, mistake/srs/done ids, `srs.box`, every `exams` field, `stats`, `examDate` and the hash (including `#/__proto__` and `#/constructor`), then loaded all 7 views. None executed. `given` shows as literal text. Unknown ids are dropped by `known()` (`app.js:48`), and the router uses `has(views, name)` (`app.js:707`).
- **The CSP blocks inline code.** An injected `onerror=` attribute, an inline `<script>` and a `javascript:` URL were all blocked (violations `script-src-elem`/`script-src-attr`).
- **No third-party requests.** Every request went to the app's own origin. There are no fonts, analytics or CDNs, no `package.json`, and the tests use only Node built-ins. There are no supply-chain dependencies.
- **No open redirect.** `go()` is only ever called with constant hashes.
- **The SW stores only good responses.** It caches only same-origin `GET` with `res.ok`, so 404s and opaque responses are not stored (verified). Its scope is `/Claude1/`.

## Findings

### 1. SW deletes other apps' caches on the shared origin (Medium, confirmed)
`sw.js:27` deletes **every** cache whose name is not the current `CACHE`. CacheStorage is per origin, so on `username.github.io` this wipes the offline caches of all the user's other Pages sites.
**Repro:** `/other/` creates the cache `other-app-v1`, then `/Claude1/` loads and its SW activates. `caches.keys()` now returns only `['theorie-b-2026-09-28']`.
**Fix:** `keys.filter(k => k.startsWith('theorie-b-') && k !== CACHE)`.

### 2. The offline fallback looks in every cache on the origin (Low–Medium, confirmed)
`sw.js:43` calls `caches.match(req, {ignoreSearch:true})`, which searches every cache on the origin.
**Repro:** a sibling path runs `caches.open('zz-evil').put('/Claude1/fouten.html', <html>)`. Offline, `/Claude1/fouten.html` then serves "POISONED via sibling cache".
Another same-origin site can already do anything to this app, so this is mostly a robustness and isolation issue. It still lets another app's entries get served under this app's path.
**Fix:** `caches.open(CACHE).then(c => c.match(req, {ignoreSearch:true}))`, and in the fallback `c.match('./index.html')`.

### 3. Shared-origin localStorage (Low, confirmed, inherent)
`/other/` reads the key `rijbewijs-b-v1` (including `examDate`) and overwrites it; the app shows the injected mistake. `script-src 'self'` also covers every repo on `username.github.io`.
**Fix:** host it on its own origin (a custom domain, or an org/user root site) if integrity matters. At minimum, document it.

### 4. `__proto__` keys get past `clean()` (Low, confirmed)
`store.js:17-19` (`eachValid`) does `out[k] = src[k]`. For `k === "__proto__"` this goes through the prototype setter: the attacker's object becomes the **prototype** of `state.srs` or `state.mistakes`, and its nested entries are never validated. The global `Object.prototype` is **not** polluted (checked).
**Repro:** stored `{"srs":{"__proto__":{"box":0,"due":0,"n-bebouwd":{"box":"junk","due":-1}}},"mistakes":{"__proto__":{"count":1,"n-buiten":{"count":9,"resolved":true}}}}`.
- `card('n-bebouwd')` returns `{box:"junk"}` and `isDue` is true. After a review the stored card is `{box:null,due:null}`.
- A wrong answer on `n-buiten` is **silently not recorded**: it mutates the inherited object, and `openMistakes()` returns `[]`.

No XSS results, but it bypasses the integrity checks.
**Fix:** build the objects with `Object.create(null)`, or skip `k === '__proto__'`, or use `Object.defineProperty`. `store.js:40/60` should also use `hasOwnProperty`.

### 5. `exams` entries are not validated (Low, confirmed)
`store.js:26` keeps any object. Stored `passed:"false"` is shown as **Geslaagd**, and junk numbers show `NaN / NaN goed` or `Invalid Date`. The array is also not capped on load.
**Fix:** check the types (`typeof passed === 'boolean'`, finite numbers) and apply `.slice(-50)`.

### 6. Clickjacking (Low, confirmed framable)
`frame-ancestors` is ignored in a meta CSP, and GitHub Pages cannot set `X-Frame-Options`. The page loaded inside an iframe. The impact is small: the only destructive action, "Alle voortgang wissen", is behind `confirm()`.
**Fix (optional):** `if (top !== self) top.location = location.href;` in `app.js`, or a custom domain behind a CDN that sets headers.

### 7. CSP could be tighter (Info)
- `style-src 'unsafe-inline'` is needed only for the `style="width:…%"` progress bars (`app.js:250,426,582,661`). Setting `el.style.width` after rendering would let you drop it.
- Consider adding `manifest-src 'self'; worker-src 'self'; connect-src 'self'`. `default-src` already covers these, but listing them documents the intent.
- A meta CSP cannot provide `frame-ancestors`, `report-to` or `sandbox`.

### 8. SW update and offline correctness (Low)
- **Stale install (speculative):** `cache.addAll(FILES)` in `sw.js:18` goes through the HTTP cache. GitHub Pages sends `max-age=600`, so a new SW can pre-cache old files and give a mixed version offline.
  **Fix:** `c.addAll(FILES.map(u => new Request(u, {cache:'reload'})))`.
- **Deep-path fallback (confirmed):** offline, `/Claude1/nope/deep` returns `index.html` with relative `css/` and `js/` URLs that no longer resolve, so the page renders unstyled and broken.
  **Fix:** `<base href>` is not usable here; redirect instead, or only fall back for the scope root.
- **Unawaited cache write:** `c.put()` in `sw.js:35` is not wrapped in `e.waitUntil`, so the write can be dropped.
- **No network timeout:** network-first has no timeout, so on a bad connection ("lie-fi") the page waits a long time before it falls back.

### 9. Invalid-but-matching `examDate` (Info)
`2026-13-45` passes the regex at `store.js:31`. `new Date(...)` is then invalid, so `days` is NaN and the page says "Je examendatum is voorbij".
**Fix:** check `!isNaN(Date.parse(v))`.

## Privacy (AVG/GDPR)
- **Stored data:** only local practice data, including the exam date. That date is mildly personal: combined with the IP address in GitHub's server logs it would say something about a person, but it never leaves the device. There is no tracking and nothing is sent to a server.
- **Cookie rule:** Telecommunicatiewet art. 11.7a (the Dutch cookie rule) exempts storage that is strictly necessary for a service the user asked for, so no consent banner is needed.
- **Recommendation:** add a short privacy note, for example: "Alles blijft op dit apparaat (localStorage); geen cookies, geen tracking; GitHub Pages (hosting) ziet je IP-adres, zie GitHub Privacy Statement; wissen via Foutenlogboek → Alle voortgang wissen." It is not strictly required, but it fits the app's "zonder account" promise and covers the processing GitHub does as host.
- **Data portability:** there is no export. Optional.
