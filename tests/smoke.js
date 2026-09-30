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
  check('exam: result has the honesty note (AC-6)', /Gevaarherkenning en vragen met foto's zitten niet in dit proefexamen/.test(await page.textContent('main')));
  check('exam: focus moves to the result heading', await page.evaluate(() => document.activeElement.tagName === 'H1'));
  const saved = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('rijbewijs-b-v1'));
    const e = s.exams[s.exams.length - 1];
    const t = Object.values(e.topics || {});
    return { ok: t.reduce((a, v) => a + v[0], 0) === e.score && t.reduce((a, v) => a + v[1], 0) === e.total, hist: Object.keys(s.history).length, seen: Object.keys(s.seen).length };
  });
  check('exam: topics saved and add up to the score (AC-5)', saved.ok);
  check('exam: answers recorded in history and seen (AC-1, AC-4)', saved.hist > 0 && saved.seen >= 50, JSON.stringify(saved));

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

  // Exam date (AC-7, AC-8, AC-9) at 320px with a fixed clock: 30 September 2026.
  const dctx = await browser.newContext({ viewport: { width: 320, height: 740 } });
  const dp = await dctx.newPage();
  const derr = [];
  dp.on('pageerror', (e) => derr.push(e.message));
  await dp.clock.setFixedTime(new Date(2026, 8, 30, 12));
  await dp.goto(base + '#/start');
  const status = async () => (await dp.textContent('.datum .aftellen')).trim();
  const hintShown = () => dp.isVisible('.datum-hint');
  const stored = () => dp.evaluate(() => { const s = JSON.parse(localStorage.getItem('rijbewijs-b-v1') || '{}'); return { d: s.examDate, m: s.examMonth }; });
  const kinds = await dp.$$eval('#examen-soort option', (o) => o.map((x) => x.textContent).join('|'));
  check('date: three choices (AC-7)', kinds === 'Nog niet gepland|Maand (schatting)|Precieze datum', kinds);
  check('date: default is "Nog niet gepland"', (await dp.inputValue('#examen-soort')) === 'geen');
  await dp.focus('#examen-soort');
  await dp.selectOption('#examen-soort', 'maand');
  const months = await dp.$$eval('.datum-veld select option', (o) => o.map((x) => x.textContent));
  check('date: 12 months from the current one', months.length === 12 && months[0] === 'september 2026' && months[11] === 'augustus 2027', months.join('|'));
  check('date: next month preselected', (await dp.inputValue('.datum-veld select')) === '2026-10');
  check('date: focus stays on the kind select', await dp.evaluate(() => document.activeElement.id === 'examen-soort'));
  await dp.selectOption('.datum-veld select', '2026-11');
  check('date: month status (AC-8)', (await status()) === 'Examen in november (schatting) · plan rekent met 1 november', await status());
  check('date: month saved', (await stored()).m === '2026-11');
  check('date: no prompt on 30 September', !(await hintShown()));
  await dp.clock.setFixedTime(new Date(2026, 9, 10, 12)); await dp.reload();
  check('date: no prompt on 10 October (AC-9)', !(await hintShown()));
  await dp.clock.setFixedTime(new Date(2026, 9, 11, 12)); await dp.reload();
  check('date: prompt on 11 October (AC-9)', (await hintShown()) && (await dp.textContent('.datum-hint')) === 'Al geboekt? Vul je examendatum in voor een beter plan.');
  await dp.click('.datum-hint [data-act=precies]');
  check('date: prompt button focuses the date field', await dp.evaluate(() => document.activeElement.matches('.datum-veld input[type=date]')));
  await dp.$eval('.datum-veld input', (el) => { el.__mark = 1; });
  await dp.fill('.datum-veld input', '2026-11-20');
  check('date: precise date shows the countdown', (await status()) === 'Nog 40 dagen tot je examen.', await status());
  check('date: date field is not replaced after a change', await dp.$eval('.datum-veld input', (el) => el.__mark === 1));
  const both = await stored();
  check('date: precise date replaces the month', both.d === '2026-11-20' && both.m == null, JSON.stringify(both));
  await dp.fill('.datum-veld input', '2026-10-01');
  check('date: a past day is not saved', (await stored()).d === '2026-11-20' && /Die dag is al voorbij/.test(await status()));
  await dp.clock.setFixedTime(new Date(2026, 11, 1, 12)); await dp.reload();
  check('date: past precise date asks for a new one (AC-8)', /Je examen was op 20 november\. Heb je een nieuwe datum\?/.test(await status()), await status());
  await dp.evaluate(() => { const s = JSON.parse(localStorage.getItem('rijbewijs-b-v1')); s.examDate = null; s.examMonth = '2026-11'; localStorage.setItem('rijbewijs-b-v1', JSON.stringify(s)); });
  await dp.reload();
  check('date: ended month says so (AC-8)', (await status()) === 'November is voorbij. Kies een nieuwe maand of een precieze datum.', await status());
  check('date: ended month stays visible in the list', /\(voorbij\)/.test(await dp.textContent('.datum-veld select option')));
  check('date: no horizontal scroll at 320px', (await dp.evaluate(() => document.documentElement.scrollWidth)) <= 320);
  await dp.evaluate(() => localStorage.setItem('rijbewijs-b-v1', '{"version":2,"examDate":"2026-02-31","examMonth":"2026-13","history":{"__proto__":[{"id":"x","ok":true,"day":"2026-12-01"}]},"seen":"x","exams":[{"date":1,"score":60,"total":50},{"date":2,"score":40,"total":50,"topics":{"a":[9,1]}}]}'));
  for (const r of ['start', 'examen']) {
    await dp.goto(base + '#/' + r); await dp.reload(); await dp.waitForTimeout(100);
    check('broken v2 data: ' + r + ' renders (AC-35)', ((await dp.textContent('main')) || '').length > 50);
  }
  check('broken v2 data: date falls back to "Nog niet gepland"', await dp.goto(base + '#/start').then(() => dp.inputValue('#examen-soort')).then((v) => v === 'geen'));
  check('date: no page errors', derr.length === 0, derr.join(' | '));
  await dctx.close();

  await part1(browser, base);

  await page.goto(base);
  check('service worker is active', await page.evaluate(async () => !!(await navigator.serviceWorker.ready).active));
  check('no page errors in the flows', errors.length === 0, errors.join(' | '));

  await browser.close();
}

// ---------- Exam-ready loop, part 1: history, seen, exam topics, exam date, broken data ----------
const KEY = 'rijbewijs-b-v1';
const readState = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), KEY);
const writeState = (p, s) => p.evaluate(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)), [KEY, s]);
const histCount = (s) => Object.values(s.history || {}).reduce((a, l) => a + l.length, 0);

// Answer the question on screen in a practice session (any kind), then wait for feedback.
async function answerPractice(p) {
  if (await p.$('.keuze')) await p.locator('.keuzes').getByRole('button').first().click();
  else if (await p.$('.invul input')) { await p.getByRole('textbox').fill('1'); await p.getByRole('button', { name: 'Controleer' }).click(); }
  else {
    const v = await p.$$eval('.voertuig', (e) => e.length);
    for (let k = 0; k < v; k++) await p.click('.voertuig >> nth=' + k);
    await p.getByRole('button', { name: 'Controleer' }).click();
  }
  await p.getByRole('button', { name: 'Volgende' }).waitFor();
}
// Answer the question on screen in the mock exam.
async function answerExam(p) {
  if (await p.$('.keuze')) await p.click('.keuze >> nth=0');
  else if (await p.$('.invul input')) await p.fill('.invul input', '1');
  else { const v = await p.$$eval('.voertuig', (e) => e.length); for (let k = 0; k < v; k++) await p.click('.voertuig >> nth=' + k); }
  await p.getByRole('button', { name: 'Volgende' }).click();
}

async function part1(browser, base) {
  const NOW = new Date(2026, 8, 30, 12);

  // --- AC-1, AC-2, AC-3, AC-4: every session records history and seen ---
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.clock.setFixedTime(NOW);
    await p.goto(base + '#/borden');

    await p.getByRole('button', { name: 'Bord → betekenis' }).click();
    await answerPractice(p);
    let s = await readState(p);
    check('AC-1: Borden answer goes into history.borden', (s.history.borden || []).length === 1, JSON.stringify(s.history));
    check('AC-4: Borden answer marks the sign seen today', Object.keys(s.seen).length === 1 && Object.values(s.seen)[0] === '2026-09-30', JSON.stringify(s.seen));

    await p.goto(base + '#/voorrang');
    await p.getByRole('button', { name: /Kruispunt 1$/ }).click();
    await answerPractice(p);
    s = await readState(p);
    check('AC-1: single Voorrang scenario goes into history.voorrang', (s.history.voorrang || []).length === 1, JSON.stringify(s.history));
    await p.goto(base + '#/start'); await p.goto(base + '#/voorrang');
    await p.getByRole('button', { name: /Kruispunt 1$/ }).click();
    await answerPractice(p);
    s = await readState(p);
    check('AC-2: same scenario again today adds no history entry', s.history.voorrang.length === 1 && s.stats.answered === 3, JSON.stringify(s.history.voorrang) + ' answered ' + s.stats.answered);

    await p.goto(base + '#/getallen');
    await p.getByRole('button', { name: /alle/i }).first().click();
    const before = histCount(s);
    await answerPractice(p);
    s = await readState(p);
    check('AC-1: Getallen answer goes into history', histCount(s) === before + 1, JSON.stringify(s.history));

    await writeState(p, { version: 3 });
    await p.goto(base + '#/start'); await p.reload();
    await p.click('[data-act=vandaag]');
    await answerPractice(p);
    s = await readState(p);
    check('AC-1: Vandaag answer goes into history', histCount(s) === 1, JSON.stringify(s.history));
    check('AC-4: Vandaag answer marks the item seen', Object.keys(s.seen).length === 1, JSON.stringify(s.seen));

    // Fouten oefenen: a mistake from an earlier day, never answered today.
    const signId = await p.evaluate(() => 'bord-' + window.RB.signs[0].id);
    s = await readState(p);
    s.mistakes = { [signId]: { count: 1, streak: 0, last: NOW.getTime() - 86400000 * 3 } };
    s.history = {}; s.seen = {};
    await writeState(p, s);
    await p.goto(base + '#/fouten'); await p.reload();
    await p.click('[data-act=oefen]');
    await answerPractice(p);
    s = await readState(p);
    check('AC-1: Fouten oefenen answer goes into history', (s.history.borden || []).length === 1 && s.history.borden[0].id === signId, JSON.stringify(s.history));
    check('AC-4: Fouten oefenen answer marks the item seen', s.seen[signId] === '2026-09-30');

    // Flashcards: seen, but not history, not mistakes.
    await writeState(p, { version: 3 });
    await p.goto(base + '#/kaarten'); await p.reload();
    await p.click('[data-deck=alles]');
    await p.getByRole('button', { name: 'Toon antwoord' }).click();
    await p.getByRole('button', { name: 'Wist ik', exact: true }).click();
    await p.getByRole('button', { name: 'Toon antwoord' }).click();
    await p.getByRole('button', { name: 'Wist ik niet' }).click();
    s = await readState(p);
    check('AC-3: flashcard self-grades update seen', Object.keys(s.seen).length === 2, JSON.stringify(s.seen));
    check('AC-3: flashcard self-grades add no history', histCount(s) === 0, JSON.stringify(s.history));
    check('AC-3: "wist ik niet" adds no mistake', Object.keys(s.mistakes).length === 0);
    check('AC-1..4: no page errors', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // --- AC-4, AC-5, AC-6: mock exam that runs out of time ---
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('dialog', (d) => d.accept());
    await p.clock.install({ time: NOW });
    await p.goto(base + '#/examen');
    await p.getByRole('button', { name: 'Start proefexamen' }).click();
    for (let i = 0; i < 3; i++) await answerExam(p);
    const mid = await readState(p);
    check('AC-4: exam answers are not recorded before the exam ends', histCount(mid) === 0 && Object.keys(mid.seen || {}).length === 0);
    await p.clock.runFor(31 * 60000);
    await p.getByRole('heading', { name: /Uitslag/ }).waitFor();
    const text = await p.textContent('main');
    check('AC-4: time-up result says 47 questions count as wrong', /De tijd was om\. 47 vragen tellen als fout\./.test(text));
    check('AC-6: honesty note on a time-up result', /Gevaarherkenning en vragen met foto's zitten niet in dit proefexamen\. Een voldoende hier is dus geen garantie voor het echte examen\./.test(text));
    check('AC-6: honesty note sits right after the pass line', await p.evaluate(() => {
      const n = [...document.querySelectorAll('main p')].find((x) => /Gevaarherkenning/.test(x.textContent));
      return !!n && /nodig/.test(n.previousElementSibling.textContent);
    }));
    const s = await readState(p);
    const e = s.exams[s.exams.length - 1];
    const t = Object.values(e.topics || {});
    check('AC-4: only the 3 answered exam questions are seen', Object.keys(s.seen).length === 3, JSON.stringify(s.seen));
    check('AC-4: only the 3 answered exam questions get history', histCount(s) === 3, JSON.stringify(s.history));
    check('AC-5: time-up exam saved with timeUp and total 50', e.timeUp === true && e.total === 50 && e.score <= 3, JSON.stringify(e));
    check('AC-5: time-up topics add up to score and total (open = wrong)', t.length > 0 && t.reduce((a, v) => a + v[0], 0) === e.score && t.reduce((a, v) => a + v[1], 0) === 50, JSON.stringify(e.topics));
    check('AC-5: topic keys are real topics', await p.evaluate((ks) => ks.every((k) => k === 'borden' || k === 'voorrang' || k in window.RB.topics), Object.keys(e.topics)));
    check('AC-4/5: no page errors', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // --- AC-7, AC-8, AC-9: exam date edge cases (Dutch locale, 320px) ---
  {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 740 }, locale: 'nl-NL' });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    const kind = () => p.getByLabel('Examendatum');
    const month = () => p.getByLabel('Maand van je examen');
    const day = () => p.getByLabel('Dag van je examen');
    const status = async () => (await p.getByRole('status').first().textContent()).trim();
    const st = async () => { const s = await readState(p); return { d: s.examDate == null ? null : s.examDate, m: s.examMonth == null ? null : s.examMonth }; };
    const at = async (d) => { await p.clock.setFixedTime(d); await p.goto(base + '#/start'); await p.reload(); };

    // Year boundary: 15 December 2026.
    await at(new Date(2026, 11, 15, 12));
    check('AC-7: status role belongs to the exam date', /Weet je ongeveer wanneer\? Kies dan een maand\./.test(await status()), await status());
    await kind().selectOption({ label: 'Maand (schatting)' });
    const labels = await month().locator('option').allTextContents();
    check('AC-7: on 15 Dec the list runs december 2026 … november 2027', labels.length === 12 && labels[0] === 'december 2026' && labels[1] === 'januari 2027' && labels[11] === 'november 2027', labels.join('|'));
    check('AC-7: on 15 Dec the preselected month is januari 2027', (await month().inputValue()) === '2027-01' && (await st()).m === '2027-01');
    check('AC-9: januari on 15 Dec (17 days before) shows the prompt', /Al geboekt\? Vul je examendatum in voor een beter plan\./.test(await p.textContent('.datum')));

    // Month in progress.
    await month().selectOption('2026-12');
    check('AC-8: month in progress says it can be any day now', (await status()) === 'Examen in december (schatting) · het kan nu elke dag zijn', await status());
    check('AC-8: month in progress asks for a date', /Heb je al een datum\? Vul die in voor een beter plan\./.test(await p.textContent('.datum')));
    check('AC-8: 320px, month in progress: no horizontal scroll', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 320);
    await p.getByRole('button', { name: 'Vul die in' }).click();
    check('AC-8: "Vul die in" focuses the date field', await day().evaluate((el) => el === document.activeElement));
    check('AC-8: precise chosen, empty: month still in force', (await status()) === 'Kies de dag van je examen. Tot dan rekent het plan met december.', await status());
    check('AC-8: precise chosen, empty: month still saved', (await st()).m === '2026-12');

    // Typing the date digit by digit: no save and no error until the year is complete.
    // "12" for day and month, so the test does not depend on the field order (dd-mm or mm/dd).
    const seen = [];
    await p.keyboard.type('1212', { delay: 30 });
    for (const ch of '2027') {
      await p.keyboard.type(ch, { delay: 30 });
      await p.waitForTimeout(50);
      seen.push({ ch, v: await day().inputValue(), s: await status(), d: (await st()).d });
    }
    check('AC-8: typing the year digit by digit never shows "al voorbij"', seen.every((x) => !/voorbij/.test(x.s)), JSON.stringify(seen));
    check('AC-8: typing the year digit by digit saves nothing before 2027', seen.slice(0, 3).every((x) => x.d == null), JSON.stringify(seen));
    check('AC-8: the complete date is saved and replaces the month', JSON.stringify(await st()) === JSON.stringify({ d: '2027-12-12', m: null }), JSON.stringify(await st()));
    check('AC-8: countdown after typing', (await status()) === 'Nog 362 dagen tot je examen.', await status());

    // A fifth year digit (Chrome allows years past 9999) is not a day in the past and must not be saved.
    await day().evaluate((el) => { el.value = '20271-12-12'; el.dispatchEvent(new Event('change', { bubbles: true })); });
    check('AC-8: a 5-digit year is not saved', (await st()).d === '2027-12-12', JSON.stringify(await st()));
    check('AC-8: a 5-digit year does not say "al voorbij"', !/al voorbij/.test(await status()), await status());

    // Precise date today and tomorrow.
    await day().fill('2026-12-15');
    check('AC-8: precise date today', (await status()) === 'Vandaag is je examen. Succes!', await status());
    await day().fill('2026-12-16');
    check('AC-8: precise date tomorrow says "1 dag"', (await status()) === 'Nog 1 dag tot je examen.', await status());

    // Clearing the field.
    await day().fill('');
    check('AC-8: clearing the date field removes the date', (await st()).d === null);
    check('AC-8: after clearing, the kind stays "Precieze datum"', (await kind().inputValue()) === 'datum' && (await status()) === 'Kies de dag van je examen.', await status());

    // Switching to Maand from a saved precise date preselects its month.
    await day().fill('2027-02-10');
    await kind().selectOption({ label: 'Maand (schatting)' });
    check('AC-7: Maand after a precise date preselects that month', (await month().inputValue()) === '2027-02' && JSON.stringify(await st()) === JSON.stringify({ d: null, m: '2027-02' }), JSON.stringify(await st()));

    // "Nog niet gepland" clears both.
    await kind().selectOption({ label: 'Precieze datum' });
    await day().fill('2027-02-10');
    await kind().selectOption({ label: 'Nog niet gepland' });
    check('AC-7: "Nog niet gepland" clears date and month', JSON.stringify(await st()) === JSON.stringify({ d: null, m: null }), JSON.stringify(await st()));
    check('AC-7: "Nog niet gepland" hides the second control', (await p.getByLabel('Dag van je examen').count()) === 0 && (await p.getByLabel('Maand van je examen').count()) === 0);
    check('AC-7: "Nog niet gepland" status', (await status()) === 'Weet je ongeveer wanneer? Kies dan een maand.', await status());

    // Precise date wins over a saved month.
    await writeState(p, { version: 3, examDate: '2026-12-20', examMonth: '2027-02' });
    await p.reload();
    check('AC-8: precise date wins over month on load', (await kind().inputValue()) === 'datum' && (await day().inputValue()) === '2026-12-20' && (await status()) === 'Nog 5 dagen tot je examen.', await status());

    // Ended month: the "(voorbij)" option goes once another month is chosen.
    await writeState(p, { version: 3, examMonth: '2026-11' });
    await p.reload();
    check('AC-8: ended month is the selected "(voorbij)" option', (await month().locator('option:checked').textContent()) === 'november 2026 (voorbij)');
    await month().selectOption('2027-01');
    check('AC-8: choosing another month drops the "(voorbij)" option', (await month().locator('option').count()) === 12 && (await st()).m === '2027-01');

    // Keyboard: arrow keys in the kind select keep focus on it.
    await kind().selectOption('geen');
    await kind().focus();
    await p.keyboard.press('ArrowDown');
    check('AC-7: arrow key in the kind select keeps focus there', await kind().evaluate((el) => el === document.activeElement));

    check('AC-7..9: no page errors', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // --- AC-35: broken saved data renders every Part 1 screen ---
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    p.on('dialog', (d) => d.accept());
    await p.clock.install({ time: NOW });
    await p.goto(base + '#/start');
    const signId = await p.evaluate(() => 'bord-' + window.RB.signs[0].id);
    const broken = '{"version":2,"examDate":"2026-02-31","examMonth":"2026-13",' +
      '"history":{"__proto__":[{"id":"x","ok":true,"day":"2026-09-30"}],"borden":"x","voorrang":[null,{"id":1}]},' +
      '"seen":{"constructor":"2026-09-30","a":"gisteren"},' +
      '"mistakes":{"' + signId + '":{"count":2,"last":"gisteren","streak":"x"}},' +
      '"exams":[{"date":1790000000000,"score":60,"total":50},{"date":1790000000000,"score":40,"total":50,"topics":{"__proto__":[1,2]}},' +
      '{"date":1790000000001,"kennis":11,"inzicht":26,"passed":true},{"date":"x","score":1,"total":2},null,7]}';
    await writeState(p, broken);
    for (const r of ['start', 'examen', 'fouten', 'kaarten', 'voorrang']) {
      await p.goto(base + '#/' + r); await p.reload();
      check('AC-35: broken data, ' + r + ' renders', ((await p.textContent('main')) || '').length > 50);
    }
    await p.goto(base + '#/start'); await p.reload();
    check('AC-35: broken date shows "Nog niet gepland"', (await p.getByLabel('Examendatum').inputValue()) === 'geen' && /Weet je ongeveer wanneer/.test(await p.textContent('.datum')));
    await p.goto(base + '#/examen'); await p.reload();
    const rows = await p.locator('table tbody tr').count();
    check('AC-35: broken exams: only the 2 valid ones are listed', rows === 2, 'rows ' + rows);
    check('AC-35: old-format exam still shown', /oud formaat/.test(await p.textContent('main')));
    await p.getByRole('button', { name: 'Start proefexamen' }).click();
    await answerExam(p);
    await p.clock.runFor(31 * 60000);
    await p.getByRole('heading', { name: /Uitslag/ }).waitFor();
    check('AC-35: result screen renders over broken data', /\d+ \/ 50 goed/.test(await p.textContent('main')));
    const s = await readState(p);
    check('AC-35: saved state is version 3 and clean after an exam', s.version === 3 && Array.isArray(s.history.voorrang || []) && histCount(s) === 1 && s.exams.length === 3, JSON.stringify({ v: s.version, h: s.history, n: s.exams.length }));
    check('AC-35: no page errors with broken data', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
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
