// Browser smoke test: NODE_PATH=$(npm root -g) node tests/smoke.js
// Starts its own static server, opens every route at phone width in light and dark mode,
// and walks through the main flows. Needs Playwright (not installed by this repo).
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  console.log('SKIP: Playwright is not installed (run with NODE_PATH=$(npm root -g) if it is installed globally).');
  process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const p = path.normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^([/\\])+/, '');
  const file = path.join(ROOT, p || 'index.html');
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const SHOTS = process.env.SMOKE_SHOTS || path.join(os.tmpdir(), 'theorie-b-smoke');
const results = [];
const check = (name, ok, extra) => results.push({ name, ok: !!ok, extra });

function launch() {
  const dir = '/opt/pw-browsers';
  const exe = fs.existsSync(dir) && fs.readdirSync(dir).find((d) => /^chromium-\d+$/.test(d));
  const executablePath = exe && path.join(dir, exe, 'chrome-linux', 'chrome');
  return chromium.launch(executablePath && fs.existsSync(executablePath) ? { executablePath } : {});
}

async function run(base) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await launch();

  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, colorScheme: scheme });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    for (const r of ['start', 'kaarten', 'borden', 'voorrang', 'getallen', 'examen', 'fouten', '__proto__']) {
      await page.goto(base + '#/' + r);
      await page.waitForTimeout(100);
      const w = await page.evaluate(() => document.documentElement.scrollWidth);
      check(`${scheme} ${r}: no horizontal scroll`, w <= 360, 'width ' + w);
      await page.screenshot({ path: path.join(SHOTS, `${scheme}-${r}.png`), fullPage: true });
    }
    const navOk = await page.evaluate(() => [...document.querySelectorAll('nav a')].every((a) => {
      const b = a.getBoundingClientRect(); return b.right <= innerWidth && b.left >= 0 && b.height >= 40;
    }));
    check(scheme + ': all menu items visible and at least 40px tall', navOk);
    check(scheme + ': no console errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());

  // Getallen: Dutch thousands separators are accepted, nonsense shows a hint.
  await page.goto(base + '#/getallen');
  await page.click('[data-act=alle]');
  let kg = 0;
  for (let i = 0; i < 60; i++) {
    const q = await page.textContent('.prompt');
    const unit = (await page.textContent('.eenheid')).trim();
    if (unit === 'kg' && /maximummassa/.test(q)) {
      if (!kg) {
        await page.fill('.invul input', 'abc');
        await page.click('[data-act=bevestig]');
        check('getallen: invalid input shows a hint', await page.isVisible('.invul-hint'));
      }
      // Type the real answer the way a Dutch user might: 3.500 or 3 500 (alternating).
      const n = await page.evaluate((t) => window.RB.questions.find((x) => x.q === t).answer, q);
      const ans = n < 1000 ? String(n) : String(n).replace(/(\d)(?=(\d{3})+$)/g, kg % 2 ? '$1 ' : '$1.');
      await page.fill('.invul input', ans);
      await page.click('[data-act=bevestig]');
      check(`getallen: "${ans}" accepted`, /Goed!/.test(await page.textContent('.feedback')), q);
      kg++;
    } else {
      await page.fill('.invul input', '1');
      await page.click('[data-act=bevestig]');
    }
    const next = await page.$('[data-act=volgende]');
    if (!next) break;
    await next.click();
    if (await page.$('.score')) break;
  }
  check('getallen: kg questions found', kg > 0);

  // Flashcards: "wist ik niet" is not a mistake.
  await page.evaluate(() => localStorage.clear());
  await page.goto(base + '#/kaarten'); await page.reload();
  await page.click('[data-deck=alles]');
  await page.click('[data-act=draai]');
  await page.click('[data-act=nee]');
  const mistakes = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('rijbewijs-b-v1')).mistakes).length);
  check('flashcards: "wist ik niet" does not go into the foutenlogboek', mistakes === 0);

  // Voorrang: titles hidden, retry disabled after answering.
  await page.goto(base + '#/voorrang');
  check('voorrang: list does not reveal the answer', !/Van rechts gaat voor/.test(await page.textContent('.scenario-lijst')));
  await page.click('.scenario >> nth=0');
  const n = await page.$$eval('.voertuig', (e) => e.length);
  for (let k = 0; k < n; k++) await page.click('.voertuig >> nth=' + k);
  await page.click('[data-act=bevestig]');
  check('voorrang: "Opnieuw kiezen" disabled after answering', await page.isDisabled('[data-act=wis]'));

  // Proefexamen: 50 questions with a timer, leave guard, stop, full run.
  await page.goto(base + '#/examen');
  await page.click('[data-act=start]');
  const teller = await page.textContent('.teller');
  check('exam: 50 questions with a timer', /Vraag 1 \/ 50/.test(teller) && /\d+:\d\d/.test(teller), teller);
  page.removeAllListeners('dialog');
  page.once('dialog', (d) => d.dismiss());
  await page.click('nav a[href="#/fouten"]');
  await page.waitForTimeout(150);
  check('exam: cancelling the leave dialog keeps the exam', !!(await page.$('.examen')) && page.url().endsWith('#/examen'));
  page.once('dialog', (d) => d.accept());
  await page.click('[data-act=stop]');
  await page.waitForTimeout(150);
  check('exam: "Examen stoppen" goes back to the overview', !(await page.$('.examen')) && !!(await page.$('[data-act=start]')));
  page.on('dialog', (d) => d.accept());
  await page.click('[data-act=start]');
  for (let i = 0; i < 50; i++) {
    if (await page.$('.keuze')) await page.click('.keuze >> nth=0');
    else if (await page.$('.invul input')) await page.fill('.invul input', '1');
    else { const v = await page.$$eval('.voertuig', (e) => e.length); for (let k = 0; k < v; k++) await page.click('.voertuig >> nth=' + k); }
    await page.click('[data-act=bevestig]');
  }
  check('exam: result shows the score out of 50', /\d+ \/ 50 goed/.test(await page.textContent('main')));

  // Old exam records, Vandaag.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('rijbewijs-b-v1'));
    s.exams.push({ date: Date.now(), kennis: 11, inzicht: 26, passed: true });
    localStorage.setItem('rijbewijs-b-v1', JSON.stringify(s));
  });
  await page.goto(base + '#/examen'); await page.reload();
  check('exam history: old-format result is shown', /oud formaat/.test(await page.textContent('main')));
  await page.goto(base + '#/start');
  await page.click('[data-act=vandaag]');
  check('vandaag: session starts', /Vandaag/.test(await page.textContent('h1')));

  // Broken saved data and stored XSS.
  await page.evaluate(() => localStorage.setItem('rijbewijs-b-v1', JSON.stringify({ stats: null, exams: null, mistakes: null, examDate: '"><img src=x onerror=window.__x=1>' })));
  for (const r of ['start', 'examen', 'fouten']) {
    await page.goto(base + '#/' + r); await page.reload(); await page.waitForTimeout(100);
    check('broken saved data: ' + r + ' still renders', ((await page.textContent('main')) || '').length > 50);
  }
  check('stored exam date is not executed as HTML', !(await page.evaluate(() => window.__x)));

  await page.goto(base);
  check('service worker is active', await page.evaluate(async () => !!(await navigator.serviceWorker.ready).active));
  check('no page errors in the flows', errors.length === 0, errors.join(' | '));

  await browser.close();
}

server.listen(0, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${server.address().port}/`;
  try { await run(base); } catch (e) { check('smoke test ran to the end', false, e.message); }
  server.close();
  for (const r of results) console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.extra && !r.ok ? '\n     ' + r.extra : ''));
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? failed + ' check(s) failed. Screenshots: ' + SHOTS : 'All ' + results.length + ' checks passed. Screenshots: ' + SHOTS);
  process.exit(failed ? 1 : 0);
});
