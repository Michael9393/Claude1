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
  check('AC-11: first exam ever has no change line', !/sinds vorige|Zelfde score als vorige/.test(await page.textContent('main')));
  check('AC-10: full exam shows the per-topic table', (await page.locator('table.onderwerpen tbody tr').count()) > 0);
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
  // Switching kinds keeps the saved date and month.
  await dp.clock.setFixedTime(new Date(2026, 8, 30, 12));
  await dp.evaluate(() => localStorage.setItem('rijbewijs-b-v1', JSON.stringify({ version: 3, examDate: '2026-11-20' })));
  await dp.reload();
  await dp.selectOption('#examen-soort', 'maand');
  check('date switch: Maand preselects the month of the saved date', (await dp.inputValue('.datum-veld select')) === '2026-11');
  await dp.selectOption('#examen-soort', 'datum');
  check('date switch: back to Precieze datum shows the saved date', (await dp.inputValue('.datum-veld input')) === '2026-11-20');
  check('date switch: the saved date is kept', (await stored()).d === '2026-11-20', JSON.stringify(await stored()));
  check('date switch: countdown is back', (await status()) === 'Nog 51 dagen tot je examen.', await status());
  await dp.evaluate(() => localStorage.setItem('rijbewijs-b-v1', JSON.stringify({ version: 3, examMonth: '2026-12' })));
  await dp.reload();
  check('date switch: saved month december is selected', (await dp.inputValue('.datum-veld select')) === '2026-12');
  await dp.selectOption('#examen-soort', 'datum');
  await dp.fill('.datum-veld input', '2026-10-15');
  await dp.selectOption('#examen-soort', 'maand');
  check('date switch: Maand prefers the saved date month', (await dp.inputValue('.datum-veld select')) === '2026-10');
  await dp.evaluate(() => localStorage.setItem('rijbewijs-b-v1', JSON.stringify({ version: 3, examMonth: '2026-12' })));
  await dp.reload();
  await dp.selectOption('#examen-soort', 'datum');
  await dp.selectOption('#examen-soort', 'maand');
  check('date switch: month december → Precieze datum → Maand shows december', (await dp.inputValue('.datum-veld select')) === '2026-12');
  check('date switch: december still saved', (await stored()).m === '2026-12', JSON.stringify(await stored()));
  await dp.evaluate(() => localStorage.setItem('rijbewijs-b-v1', '{"version":2,"examDate":"2026-02-31","examMonth":"2026-13","history":{"__proto__":[{"id":"x","ok":true,"day":"2026-12-01"}]},"seen":"x","exams":[{"date":1,"score":60,"total":50},{"date":2,"score":40,"total":50,"topics":{"a":[9,1]}}]}'));
  for (const r of ['start', 'examen']) {
    await dp.goto(base + '#/' + r); await dp.reload(); await dp.waitForTimeout(100);
    check('broken v2 data: ' + r + ' renders (AC-35)', ((await dp.textContent('main')) || '').length > 50);
  }
  check('broken v2 data: date falls back to "Nog niet gepland"', await dp.goto(base + '#/start').then(() => dp.inputValue('#examen-soort')).then((v) => v === 'geen'));
  check('date: no page errors', derr.length === 0, derr.join(' | '));
  await dctx.close();

  await part1(browser, base);
  await part2(browser, base);
  await part2Edge(browser, base);
  await part3(browser, base);

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

// ---------- Exam-ready loop, part 2: result per topic, weak-topic practice, same-day mistakes ----------
async function part2(browser, base) {
  const NOW = new Date(2026, 9, 1, 12);

  // --- AC-10, AC-11, AC-12, AC-35: time-up result with 0 answered, after an earlier 40 / 50, at 320px ---
  {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 740 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    p.on('dialog', (d) => d.accept());
    await p.clock.install({ time: NOW });
    await p.goto(base + '#/examen');
    await writeState(p, { version: 3, exams: [{ date: NOW.getTime() - 86400000, score: 40, total: 50, passed: false, timeUp: false }] });
    await p.reload();
    await p.getByRole('button', { name: 'Start proefexamen' }).click();
    await p.clock.runFor(31 * 60000);
    await p.getByRole('heading', { name: /Uitslag/ }).waitFor();
    const text = await p.textContent('main');
    check('AC-11: change line after an earlier 40 / 50', /-40 sinds vorige: 40 \/ 50/.test(text), text.slice(0, 300));
    check('AC-11: change line sits right under the score', await p.evaluate(() => /sinds vorige/.test(document.querySelector('.score').nextElementSibling.textContent)));
    const rows = await p.$$eval('table.onderwerpen tbody tr', (trs) => trs.map((tr) => [...tr.cells].map((c) => c.textContent)));
    const nums = rows.map((r) => { const m = /^(\d+) van (\d+)$/.exec(r[1]); return m && { ok: +m[1], asked: +m[2], wrong: +r[2] }; });
    check('AC-10: every row reads "goed van gevraagd" and fout', rows.length > 0 && nums.every((n) => n && n.asked - n.ok === n.wrong), JSON.stringify(rows));
    check('AC-10: rows add up to 50 questions', nums.reduce((a, n) => a + n.asked, 0) === 50);
    check('AC-10: sorted by most wrong first', nums.every((n, i) => !i || nums[i - 1].wrong >= n.wrong), JSON.stringify(rows));
    check('AC-10: table headers have scope=col', await p.$$eval('table.onderwerpen th', (t) => t.length === 3 && t.every((x) => x.getAttribute('scope') === 'col')));
    check('time-up footnote under the table', /Vragen die je niet op tijd hebt beantwoord, tellen hier als fout\./.test(text));
    check('time-up with 0 answered: "Nakijken" heading is there', await p.evaluate(() => [...document.querySelectorAll('main h2')].some((h) => h.textContent === 'Nakijken')));
    check('time-up with 0 answered: no "Alles goed!"', !/Alles goed!/.test(text) && /Je hebt geen vragen fout beantwoord, maar niet alle vragen op tijd gedaan\./.test(text));
    const weakNames = rows.slice(0, 3).map((r) => r[0]);
    check('AC-12: weak line names the top 3 topics', text.includes('Je fouten zaten vooral bij ' + weakNames[0] + ', ' + weakNames[1] + ' en ' + weakNames[2] + '.'), weakNames.join('|'));
    const weakBtns = p.getByRole('button', { name: /^Oefen zwakke onderwerpen \(\d+\)$/ });
    check('AC-12: weak button at top and bottom', (await weakBtns.count()) === 2);
    const n = +(/\((\d+)\)/.exec(await weakBtns.first().textContent())[1]);
    check('AC-12: at most 15 questions', n > 0 && n <= 15, 'n ' + n);
    check('"Nieuw proefexamen" is secondary when there are mistakes', await p.$eval('[data-act=opnieuw]', (b) => b.classList.contains('secundair')));
    check('AC-10: 320px result: no horizontal scroll', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 320);
    await p.screenshot({ path: path.join(SHOTS, 'part2-result-320.png'), fullPage: true });
    await weakBtns.first().click();
    check('AC-12: weak-topic session starts with n questions', (await p.textContent('.teller')).trim() === '1 / ' + n, await p.textContent('.teller'));
    check('session start: focus on the session heading or the input', await p.evaluate(() => document.activeElement.matches('h1, .invul input')));
    check('AC-12: weak session title', /Zwakke onderwerpen/.test(await p.textContent('h1')));
    check('AC-12/35: no page errors', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // --- AC-13, AC-16: Foutenlogboek counts mistakes answered right today; Vandaag leaves them out ---
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.clock.setFixedTime(NOW);
    await p.goto(base + '#/fouten');
    const ids = await p.evaluate(() => window.RB.signs.slice(0, 4).map((s) => 'bord-' + s.id));
    const day = 86400000;
    const mistakes = {};
    ids.forEach((id, i) => { mistakes[id] = { count: 1, streak: 0, last: NOW.getTime() - (i + 2) * day, topic: 'borden' }; });
    Object.assign(mistakes[ids[0]], { streak: 1, okDay: '2026-10-01' });
    await writeState(p, { version: 3, mistakes });
    await p.reload();
    const main = await p.textContent('main');
    check('AC-13: "Oefen mijn fouten (4)" counts all open mistakes', await p.getByRole('button', { name: 'Oefen mijn fouten (4)' }).isEnabled());
    check('AC-13: label on the mistake answered right today', (main.match(/Vandaag al goed\. Morgen nog 1× goed, dan is hij weg\./g) || []).length === 1);
    check('AC-13: summary line', main.includes('1 daarvan had je vandaag al goed. Die is pas weg als je hem morgen weer goed hebt.'));
    check('AC-13: per-topic Oefen is enabled', await p.locator('[data-topic=borden]').isEnabled());
    await p.getByRole('button', { name: 'Oefen mijn fouten (4)' }).click();
    check('AC-13: practice session has all 4', (await p.textContent('.teller')).trim() === '1 / 4');
    check('session start: focus on the session heading', await p.evaluate(() => document.activeElement.tagName === 'H1'));
    await p.goto(base + '#/start');
    check('AC-16: Vandaag leaves the mistake answered right today out', /(^|\D)3 fouten( ·|$)/.test(await p.textContent('.vandaag .plan-detail')), await p.textContent('.vandaag'));

    // Only open mistake answered right today: button still enabled.
    await writeState(p, { version: 3, mistakes: { [ids[0]]: mistakes[ids[0]] } });
    await p.goto(base + '#/fouten'); await p.reload();
    check('AC-13: only open one right today: button enabled', await p.getByRole('button', { name: 'Oefen mijn fouten (1)' }).isEnabled());
    check('AC-13: only open one right today: summary line', (await p.textContent('main')).includes('Die had je vandaag al goed. Hij is pas weg als je hem morgen weer goed hebt.'));

    // AC-35: broken mistake data still renders.
    await writeState(p, { version: 3, mistakes: { [ids[0]]: { count: 1, streak: 'x', okDay: 7, last: 'gisteren' }, x: null } });
    await p.reload();
    check('AC-35: broken mistakes: Foutenlogboek renders without label', /Oefen mijn fouten \(1\)/.test(await p.textContent('main')) && !/Vandaag al goed/.test(await p.textContent('main')));
    check('AC-13/16/35: no page errors', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
}

// ---------- Exam-ready loop, part 2: edge cases (test-engineer) ----------
// Test helper in the page: recognises the question on screen and answers it right or wrong.
// Only used to steer which answers are wrong; the checks read the screen by role and text.
function installOracle() {
  window.__q = {
    id: function () {
      var RB = window.RB, d = document.createElement('div');
      var bord = document.querySelector('.q .bord.groot');
      if (bord) {
        for (var i = 0; i < RB.signs.length; i++) {
          d.innerHTML = RB.signs[i].svg.replace('role="img"', 'role="img" aria-label="Verkeersbord"');
          if (d.innerHTML === bord.innerHTML) return 'bord-' + RB.signs[i].id;
        }
        return null;
      }
      var wrap = document.querySelector('.q .kruispunt-wrap');
      if (wrap) {
        for (var j = 0; j < RB.voorrang.length; j++) {
          d.innerHTML = RB.renderIntersection(RB.voorrang[j], []);
          if (d.innerHTML === wrap.innerHTML) return RB.voorrang[j].id;
        }
        return null;
      }
      var p = document.querySelector('.q .prompt').textContent;
      var q = RB.questions.find(function (x) { return x.q === p; });
      return q ? q.id : null;
    },
    // Answer right (ok) or wrong; in a practice session also go to the next question.
    answer: function (ok) {
      var RB = window.RB, id = this.id(), item = RB.items[id];
      var click = function (el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); };
      var confirm = function () { var b = document.querySelector('.q [data-act=bevestig]'); if (b) click(b); };
      if (item.kind === 'voorrang') {
        var order = item.scenario.order.slice();
        if (!ok) order.push(order.shift());
        order.forEach(function (v) { click(document.querySelector('.q .voertuig[data-id="' + v + '"]')); });
        confirm();
      } else if (item.kind === 'num') {
        document.querySelector('.q .invul input').value = String(ok ? item.answer : item.answer + 1).replace('.', ',');
        confirm();
      } else {
        var good = item.kind === 'sign' ? item.sign.name : item.options[item.answer];
        var btns = [].slice.call(document.querySelectorAll('.q .keuze'));
        click(btns.find(function (b) { return (b.textContent === good) === ok; }));
        confirm();
      }
      var next = document.querySelector('.q [data-act=volgende]');
      if (next) click(next);
      return { id: id, topic: item.topic, ok: ok };
    }
  };
}

// Run a whole mock exam; wrongFor(item, k) decides which questions are answered wrong. Returns the answers.
async function runMock(p, wrongFor) {
  await p.getByRole('button', { name: /proefexamen/i }).last().click();
  const out = [];
  for (let k = 0; k < 50; k++) {
    await p.locator('.q .vraag').waitFor();
    const info = await p.evaluate(() => { const id = window.__q.id(); return { id, topic: id && window.RB.items[id].topic }; });
    if (!info.id) throw new Error('oracle: unknown question ' + k);
    const wrong = wrongFor(info, k, out);
    out.push(await p.evaluate((ok) => window.__q.answer(ok), !wrong));
  }
  await p.getByRole('heading', { name: /Uitslag/ }).waitFor();
  return out;
}
const tableRows = (p) => p.$$eval('table.onderwerpen tbody tr', (trs) => trs.map((tr) => [...tr.cells].map((c) => c.textContent)));
const tally = (answers) => {
  const t = {};
  answers.forEach((a) => { t[a.topic] = t[a.topic] || [0, 0]; t[a.topic][1]++; if (a.ok) t[a.topic][0]++; });
  return t;
};
// Expected AC-10 order from a tally, using the names the app shows.
const expectedRows = (t, names) => Object.keys(t).map((k) => ({ name: names[k] || k, ok: t[k][0], asked: t[k][1], wrong: t[k][1] - t[k][0] }))
  .sort((a, b) => b.wrong - a.wrong || b.asked - a.asked || a.name.localeCompare(b.name, 'nl'))
  .map((r) => [r.name, r.ok + ' van ' + r.asked, String(r.wrong)]);
const weakLine = (p) => p.locator('main p', { hasText: /^Je fouten zaten/ });
const changeText = async (p) => { const t = await p.textContent('main'); const m = /([+-]\d+ sinds vorige: \d+ \/ \d+|Zelfde score als vorige: \d+ \/ \d+)/.exec(t); return m ? m[1] : null; };

async function part2Edge(browser, base) {
  const NOW = new Date(2026, 9, 1, 12);
  const DAY = 86400000;

  // --- AC-10, AC-11, AC-12: full exams with steered mistakes (old-format previous, same score, 0 wrong, 1 topic wrong) ---
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
    await ctx.addInitScript(installOracle);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    p.on('dialog', (d) => d.accept());
    await p.clock.setFixedTime(NOW);
    await p.goto(base + '#/examen');
    const names = await p.evaluate(() => Object.assign({}, window.RB.topics));
    // The newest saved exam is in the old format: no change line, even though an older 40 / 50 exists.
    await writeState(p, { version: 3, exams: [{ date: NOW.getTime() - 2 * DAY, score: 40, total: 50, passed: false }, { date: NOW.getTime() - DAY, kennis: 11, inzicht: 26, passed: true }] });
    await p.reload();

    let ans = await runMock(p, () => false);
    let text = await p.textContent('main');
    check('oracle: an all-correct run scores 50 / 50', /50 \/ 50 goed/.test(text), text.slice(0, 200));
    check('AC-11: newest previous exam in the old format: no change line', (await changeText(p)) === null, await changeText(p));
    check('AC-12: 0 wrong: no weak-topic button', (await p.getByRole('button', { name: /Oefen zwakke onderwerpen/ }).count()) === 0);
    check('AC-12: 0 wrong: no weak-topic line', (await weakLine(p).count()) === 0);
    check('AC-12: 0 wrong: no "Kijk eerst je fouten na" hint', !/Kijk eerst je fouten na/.test(text));
    check('0 wrong: "Alles goed!" in Nakijken', /Alles goed!/.test(text));
    check('0 wrong: third card still starts with the "Nakijken" heading', await p.evaluate(() => { const c = document.querySelectorAll('main section.kaart')[2]; return !!c && c.firstElementChild.tagName === 'H2' && c.firstElementChild.textContent === 'Nakijken' && /Alles goed!/.test(c.textContent); }));
    check('0 wrong: "Nieuw proefexamen" is the primary button', await p.getByRole('button', { name: 'Nieuw proefexamen' }).evaluate((b) => !b.classList.contains('secundair')));
    const rows0 = await tableRows(p);
    check('AC-10: 0 wrong: every topic listed with fout 0, sorted by asked then Dutch name', JSON.stringify(rows0) === JSON.stringify(expectedRows(tally(ans), names)), JSON.stringify(rows0));
    check('AC-10: table lists exactly the topics in this exam', rows0.length === Object.keys(tally(ans)).length);
    check('result: focus on the result heading (50 / 50)', await p.evaluate(() => document.activeElement.tagName === 'H1' && /Uitslag/.test(document.activeElement.textContent)));

    // Same score again.
    ans = await runMock(p, () => false);
    check('AC-11: same score: "Zelfde score als vorige: 50 / 50"', (await changeText(p)) === 'Zelfde score als vorige: 50 / 50', await changeText(p));

    // One wrong answer in one topic: still a pass, weak line without "vooral".
    let wrongTopic = null;
    ans = await runMock(p, (info) => { if (!wrongTopic) { wrongTopic = info.topic; return true; } return false; });
    text = await p.textContent('main');
    check('AC-11: -1 after 50 / 50', (await changeText(p)) === '-1 sinds vorige: 50 / 50', await changeText(p));
    check('AC-12: pass with 1 wrong still shows the weak line and button', /Geslaagd/.test(await p.textContent('h1')) && (await p.getByRole('button', { name: /^Oefen zwakke onderwerpen \(\d+\)$/ }).count()) === 2);
    check('AC-12: 1 wrong topic: "Je fouten zaten bij <topic>." (no "vooral")', (await weakLine(p).textContent()) === 'Je fouten zaten bij ' + names[wrongTopic] + '.', await weakLine(p).textContent());
    const rows1 = await tableRows(p);
    check('AC-10: 1 wrong: that topic is the first row with fout 1', JSON.stringify(rows1) === JSON.stringify(expectedRows(tally(ans), names)) && rows1[0][0] === names[wrongTopic] && rows1[0][2] === '1', JSON.stringify(rows1));
    check('AC-10: fout > 0 is bold, 0 is plain', await p.$$eval('table.onderwerpen tbody tr', (trs) => trs.every((tr) => (tr.cells[2].querySelector('strong') != null) === (tr.cells[2].textContent !== '0'))));

    // Weak session from 1 topic: every question is from that topic, the mistake comes first.
    const n1 = +(/\((\d+)\)/.exec(await p.getByRole('button', { name: /Oefen zwakke onderwerpen/ }).first().textContent())[1]);
    const okIds = new Set(ans.filter((a) => a.ok).map((a) => a.id));
    const wrongId = ans.find((a) => !a.ok).id;
    await p.getByRole('button', { name: /Oefen zwakke onderwerpen/ }).first().click();
    check('session start: focus on the session heading unless the first question has an input', await p.evaluate(() => document.querySelector('.invul input') ? document.activeElement.matches('.invul input') : document.activeElement.tagName === 'H1'));
    const seen1 = [];
    for (let k = 0; k < n1; k++) seen1.push(await p.evaluate(() => window.__q.answer(true)));
    check('AC-12: 1 weak topic: first question is the mistake just made', seen1[0].id === wrongId, JSON.stringify(seen1.slice(0, 3)));
    check('AC-12: 1 weak topic: only questions from that topic', seen1.every((a) => a.topic === wrongTopic), JSON.stringify(seen1.map((a) => a.topic)));
    check('AC-12: 1 weak topic: nothing that was right in this exam', seen1.every((a) => !okIds.has(a.id)));
    check('AC-12: 1 weak topic: no duplicates', new Set(seen1.map((a) => a.id)).size === seen1.length);
    check('AC-12: weak session summary heading', /Zwakke onderwerpen: klaar/.test(await p.textContent('h1')));
    check('session summary: focus on the summary heading after the last "Volgende"', await p.evaluate(() => document.activeElement.tagName === 'H1' && document.activeElement.getAttribute('tabindex') === '-1' && /: klaar$/.test(document.activeElement.textContent)));
    check('AC-12/14: the mistake answered right in the weak session stays open (same day)', await readState(p).then((s) => s.mistakes[wrongId] && !s.mistakes[wrongId].resolved && s.mistakes[wrongId].streak === 1));
    await p.getByRole('button', { name: 'Nog een ronde' }).click();
    const again = await p.evaluate(() => window.__q.id());
    check('AC-12: "Nog een ronde" rebuilds the list with the open mistake first', again === wrongId && (await p.textContent('.teller')).trim() === '1 / ' + n1, again + ' ' + (await p.textContent('.teller')));
    check('AC-10..12 (full exams): no page errors', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // --- AC-11, AC-12: comparison with the newest previous exam; 2, 3 and 4+ weak topics; the weak session order ---
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
    await ctx.addInitScript(installOracle);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('dialog', (d) => d.accept());
    await p.clock.setFixedTime(NOW);
    await p.goto(base + '#/examen');
    const names = await p.evaluate(() => Object.assign({}, window.RB.topics));
    // Older open mistakes in every topic (from 5 days ago), so the session has old and new mistakes.
    const older = await p.evaluate(() => {
      const by = {};
      Object.keys(window.RB.items).forEach((id) => { const t = window.RB.items[id].topic; if (!by[t]) by[t] = id; });
      return by;
    });
    const mistakes = {};
    Object.values(older).forEach((id, i) => { mistakes[id] = { count: 1, streak: 0, last: NOW.getTime() - 5 * DAY - i * 1000 }; });
    await writeState(p, { version: 3, mistakes, exams: [
      { date: NOW.getTime() - 3 * DAY, score: 30, total: 50, passed: false },
      { date: NOW.getTime() - 2 * DAY, score: 45, total: 50, passed: true, timeUp: false }
    ] });
    await p.reload();

    const steer = (k) => { const w = []; return (info) => { if (w.length < k && !w.includes(info.topic)) { w.push(info.topic); return true; } return false; }; };
    let ans = await runMock(p, steer(2));
    check('AC-11: compares with the newest previous exam (45), not the oldest (30)', (await changeText(p)) === '+3 sinds vorige: 45 / 50', await changeText(p));
    let wrongNames = expectedRows(tally(ans), names).filter((r) => r[2] !== '0').map((r) => r[0]);
    check('AC-12: 2 wrong topics: "Je fouten zaten bij A en B."', (await weakLine(p).textContent()) === 'Je fouten zaten bij ' + wrongNames[0] + ' en ' + wrongNames[1] + '.', await weakLine(p).textContent());

    ans = await runMock(p, steer(3));
    check('AC-11: -1 against the exam just before (48)', (await changeText(p)) === '-1 sinds vorige: 48 / 50', await changeText(p));
    wrongNames = expectedRows(tally(ans), names).filter((r) => r[2] !== '0').map((r) => r[0]);
    check('AC-12: 3 wrong topics: no "vooral"', (await weakLine(p).textContent()) === 'Je fouten zaten bij ' + wrongNames[0] + ', ' + wrongNames[1] + ' en ' + wrongNames[2] + '.', await weakLine(p).textContent());

    // 5 topics wrong, with 3 / 2 / 1 / 1 / 1 mistakes, so the 3 weakest are clear.
    const plan = [3, 2, 1, 1, 1];
    const w = [];
    const cnt = {};
    ans = await runMock(p, (info) => {
      let i = w.indexOf(info.topic);
      if (i < 0 && w.length < plan.length) { w.push(info.topic); i = w.length - 1; }
      if (i < 0) return false;
      cnt[info.topic] = (cnt[info.topic] || 0) + 1;
      return cnt[info.topic] <= plan[i];
    });
    const rows = await tableRows(p);
    check('AC-10: steered 5-topic exam: rows match the tally in AC-10 order', JSON.stringify(rows) === JSON.stringify(expectedRows(tally(ans), names)), JSON.stringify(rows));
    const weak = rows.filter((r) => r[2] !== '0').slice(0, 3).map((r) => r[0]);
    check('AC-12: 4+ wrong topics: "vooral" and the 3 weakest', (await weakLine(p).textContent()) === 'Je fouten zaten vooral bij ' + weak[0] + ', ' + weak[1] + ' en ' + weak[2] + '.', await weakLine(p).textContent());
    const st = await readState(p);
    const topicOfName = {}; Object.keys(names).forEach((k) => { topicOfName[names[k]] = k; });
    const weakTopics = weak.map((n) => topicOfName[n]);
    const its = await p.evaluate(() => { const o = {}; Object.keys(window.RB.items).forEach((id) => { o[id] = window.RB.items[id].topic; }); return o; });
    const openWeak = Object.keys(st.mistakes).filter((id) => !st.mistakes[id].resolved && its[id] && weakTopics.includes(its[id]));
    const justMade = ans.filter((a) => !a.ok && weakTopics.includes(a.topic)).map((a) => a.id);
    const okIds = new Set(ans.filter((a) => a.ok).map((a) => a.id));
    const btnN = +(/\((\d+)\)/.exec(await p.getByRole('button', { name: /Oefen zwakke onderwerpen/ }).first().textContent())[1]);
    check('AC-12: weak button count is 15 (enough questions in 3 topics)', btnN === 15, 'n ' + btnN);
    await p.getByRole('button', { name: /Oefen zwakke onderwerpen/ }).last().click();
    check('AC-12: bottom weak button starts the same session', (await p.textContent('.teller')).trim() === '1 / 15');
    const sess = [];
    for (let k = 0; k < 15; k++) sess.push(await p.evaluate(() => window.__q.answer(true)));
    const ids = sess.map((a) => a.id);
    const m = openWeak.length;
    check('AC-12: weak session starts with all open mistakes of the 3 weakest topics', JSON.stringify(ids.slice(0, m).sort()) === JSON.stringify(openWeak.slice().sort()), JSON.stringify({ first: ids.slice(0, m), openWeak }));
    const lastOf = (id) => Number(st.mistakes[id].last) || 0;
    check('AC-12: open mistakes newest first, so those just made come before older ones', ids.slice(0, m).every((id, i) => !i || lastOf(ids[i - 1]) >= lastOf(id)) && justMade.every((id) => ids.indexOf(id) < m), JSON.stringify(ids.slice(0, m).map(lastOf)));
    check('AC-12: only the 3 weakest topics (not the 4th or 5th)', sess.every((a) => weakTopics.includes(a.topic)), JSON.stringify(sess.map((a) => a.topic)));
    check('AC-12: nothing answered right in this exam', ids.every((id) => !okIds.has(id) || openWeak.includes(id)));
    check('AC-12: no duplicates in the weak session', new Set(ids).size === ids.length);
    check('AC-10..12 (steered exams): no page errors', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // --- AC-11, AC-35: previous exam with another total or broken; long topic names at 320px ---
  {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 740 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('dialog', (d) => d.accept());
    await p.clock.install({ time: NOW });
    await p.goto(base + '#/examen');
    await writeState(p, { version: 3, exams: [{ date: NOW.getTime() - DAY, score: 30, total: 40, passed: false }] });
    await p.reload();
    await p.getByRole('button', { name: 'Start proefexamen' }).click();
    await p.clock.runFor(31 * 60000);
    await p.getByRole('heading', { name: /Uitslag/ }).waitFor();
    check('AC-11: previous exam with 40 questions: no change line', (await changeText(p)) === null, await changeText(p));

    // Newest stored exam is broken (score 60 of 50) and has no topics; the valid one before it is used.
    await writeState(p, { version: 3, exams: [
      { date: NOW.getTime() - 2 * DAY, score: 41, total: 50, passed: false },
      { date: NOW.getTime() - DAY, score: 60, total: 50, passed: true, topics: { borden: [9, 1] } }
    ] });
    await p.goto(base + '#/examen'); await p.reload();
    // Very long topic names (no spaces) must wrap, not scroll sideways.
    await p.evaluate(() => { Object.keys(window.RB.topics).forEach((k) => { window.RB.topics[k] = 'Verkeersregelaarsaanwijzingsbevoegdheidsvoorschriften ' + window.RB.topics[k]; }); });
    await p.getByRole('button', { name: 'Start proefexamen' }).click();
    await p.clock.runFor(31 * 60000);
    await p.getByRole('heading', { name: /Uitslag/ }).waitFor();
    check('AC-11/35: broken newest exam is dropped; compares with 41 / 50', (await changeText(p)) === '-41 sinds vorige: 41 / 50', await changeText(p));
    check('AC-10: long topic names at 320px: the per-topic table does not overflow', await p.$eval('table.onderwerpen', (t) => t.scrollWidth <= t.clientWidth && t.getBoundingClientRect().right <= t.closest('.kaart').getBoundingClientRect().right));
    check('AC-10: long topic names: numbers stay on one line', await p.$$eval('table.onderwerpen td.num', (tds) => tds.every((td) => { const r = document.createRange(); r.selectNodeContents(td); return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size === 1; })));
    check('AC-12: long topic names at 320px: the weak-topic line wraps (no horizontal scroll)', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 320, 'page width ' + (await p.evaluate(() => document.documentElement.scrollWidth)) + ', .zwak-regel scrollWidth ' + (await p.$eval('.zwak-regel', (e) => e.scrollWidth)));
    check('AC-10/12: time-up with 0 answered: every topic counts as wrong and weak line shows "vooral"', (await tableRows(p)).every((r) => /^0 van \d+$/.test(r[1]) && r[2] !== '0') && /^Je fouten zaten vooral bij /.test(await weakLine(p).textContent()));
    await p.screenshot({ path: path.join(SHOTS, 'part2-long-names-320.png'), fullPage: true });
    check('AC-11/35 (320px): no page errors', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // --- AC-13, AC-14, AC-15, AC-16, AC-35: Foutenlogboek and Vandaag with mistakes answered right today ---
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
    await ctx.addInitScript(installOracle);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await p.clock.setFixedTime(NOW);
    await p.goto(base + '#/fouten');
    const signs = await p.evaluate(() => window.RB.signs.slice(0, 3).map((s) => ({ id: 'bord-' + s.id, label: 'Bord: ' + s.name })));
    const qs = await p.evaluate(() => window.RB.questions.filter((q) => q.topic === 'snelheid' && q.type === 'mc').slice(0, 2).map((q) => ({ id: q.id, label: q.q })));
    const today = { streak: 1, okDay: '2026-10-01' };

    // Two of five right today (plural line); per-topic Oefen includes them; a topic with only resolved mistakes is disabled.
    const ms = {};
    signs.forEach((s, i) => { ms[s.id] = Object.assign({ count: 1, streak: 0, last: NOW.getTime() - (i + 2) * DAY }, i < 2 ? today : {}); });
    ms[qs[0].id] = { count: 2, streak: 2, resolved: true, last: NOW.getTime() - 9 * DAY };
    ms[qs[1].id] = { count: 1, streak: 2, resolved: true, last: NOW.getTime() - 8 * DAY };
    const parkeer = await p.evaluate(() => window.RB.questions.find((q) => q.topic === 'parkeren').id);
    ms[parkeer] = { count: 1, streak: 0 }; // no last, no given, no topic
    await writeState(p, { version: 3, mistakes: ms });
    await p.reload();
    let main = await p.textContent('main');
    check('AC-13: plural line "2 daarvan … Die zijn pas weg …"', main.includes('2 daarvan had je vandaag al goed. Die zijn pas weg als je ze morgen weer goed hebt.'));
    check('AC-13: button counts all 4 open (2 right today)', await p.getByRole('button', { name: 'Oefen mijn fouten (4)' }).isEnabled());
    check('AC-13: exact label twice', (main.match(/Vandaag al goed\. Morgen nog 1× goed, dan is hij weg\./g) || []).length === 2);
    check('AC-13: old "komen morgen terug" text is gone', !/Die komen morgen terug|vandaag goed, morgen nog een keer/.test(main));
    const rowOf = (name) => p.locator('.balk-rij', { hasText: name });
    check('AC-13: per-topic Oefen disabled for a topic with only resolved mistakes', await rowOf('Snelheid').getByRole('button', { name: 'Oefen' }).isDisabled());
    const labels = await p.$$eval('.fouten-lijst li strong', (s) => s.map((x) => x.textContent));
    check('AC-35: open list newest first; a mistake without "last" sorts as oldest', JSON.stringify(labels) === JSON.stringify([signs[0].label, signs[1].label, signs[2].label, await p.evaluate((id) => window.RB.items[id].q, parkeer)]), JSON.stringify(labels));
    await rowOf('Verkeersborden').getByRole('button', { name: 'Oefen' }).click();
    check('AC-13: per-topic Oefen includes the 2 right today (3 questions)', (await p.textContent('.teller')).trim() === '1 / 3', await p.textContent('.teller'));
    check('session start (per-topic Oefen): focus on the session heading', await p.evaluate(() => document.activeElement.tagName === 'H1'));

    // AC-14 in the UI: answer all 3 right; the 2 right-today ones stay open; "Nog een ronde" has all 3 again.
    for (let k = 0; k < 3; k++) await p.evaluate(() => window.__q.answer(true));
    let s = await readState(p);
    check('AC-14: right again today: still open with streak 1 and okDay today', [signs[0], signs[1]].every((x) => !s.mistakes[x.id].resolved && s.mistakes[x.id].streak === 1 && s.mistakes[x.id].okDay === '2026-10-01'), JSON.stringify(s.mistakes));
    check('AC-14: the third, right for the first time today, is now open with streak 1', !s.mistakes[signs[2].id].resolved && s.mistakes[signs[2].id].streak === 1);
    check('Fouten oefenen: new note text', (await p.textContent('main')).includes('Vandaag vaker oefenen mag, maar telt niet extra.'));
    await p.getByRole('button', { name: 'Nog een ronde' }).click();
    check('AC-13: "Nog een ronde" keeps the mistakes right today (3 again)', (await p.textContent('.teller')).trim() === '1 / 3', await p.textContent('.teller'));

    // AC-16: all 3 borden mistakes are right today → Vandaag leaves them out; the parkeren one stays.
    await p.goto(base + '#/start');
    check('AC-16: Vandaag leaves out every mistake right today', /(^|\D)1 fout( ·|$)/.test(await p.textContent('.vandaag .plan-detail')), await p.textContent('.vandaag'));

    // AC-15 in the UI: answer one of them wrong today → back in Vandaag.
    await p.goto(base + '#/fouten');
    await rowOf('Verkeersborden').getByRole('button', { name: 'Oefen' }).click();
    const w = await p.evaluate(() => window.__q.answer(false));
    s = await readState(p);
    check('AC-15: wrong after right today: streak 0, okDay null', s.mistakes[w.id].streak === 0 && s.mistakes[w.id].okDay == null && !s.mistakes[w.id].resolved, JSON.stringify(s.mistakes[w.id]));
    await p.goto(base + '#/start');
    check('AC-15/16: the mistake answered wrong again is back in Vandaag', /(^|\D)2 fouten( ·|$)/.test(await p.textContent('.vandaag .plan-detail')), await p.textContent('.vandaag'));

    // AC-14 next day: right once more resolves it.
    await p.clock.setFixedTime(new Date(2026, 9, 2, 9));
    await p.goto(base + '#/fouten'); await p.reload();
    check('AC-13: next day: no "vandaag al goed" labels', !/Vandaag al goed/.test(await p.textContent('main')));

    // All open mistakes right today ("allemaal") and 0 open (disabled).
    const all3 = {};
    signs.forEach((x, i) => { all3[x.id] = Object.assign({ count: 1, last: NOW.getTime() - i * 1000 }, today); });
    await p.clock.setFixedTime(NOW);
    await writeState(p, { version: 3, mistakes: all3 });
    await p.reload();
    check('AC-13: all open right today: "allemaal" line', (await p.textContent('main')).includes('Die had je vandaag allemaal al goed. Ze zijn pas weg als je ze morgen weer goed hebt.'));
    check('AC-13: all open right today: button enabled with all 3', await p.getByRole('button', { name: 'Oefen mijn fouten (3)' }).isEnabled());
    await p.goto(base + '#/start');
    check('AC-16: all mistakes right today: Vandaag has no mistakes to repeat', !/\d fouten?( ·|$)/.test(await p.textContent('.vandaag')), await p.textContent('.vandaag'));
    const done = {};
    signs.forEach((x) => { done[x.id] = { count: 1, streak: 2, resolved: true, last: NOW.getTime() }; });
    await writeState(p, { version: 3, mistakes: done });
    await p.goto(base + '#/fouten'); await p.reload();
    check('AC-13: 0 open: "Oefen mijn fouten (0)" disabled, no summary line', (await p.getByRole('button', { name: 'Oefen mijn fouten (0)' }).isDisabled()) && !/vandaag al goed/i.test(await p.textContent('main')));

    // AC-35: mistakes with missing or hostile fields.
    await writeState(p, { version: 3, mistakes: {
      [signs[0].id]: { count: 1 },
      [signs[1].id]: { count: 1, streak: 1, okDay: '2026-10-01', given: '<img src=x onerror="window.__y=1">', last: 'x' },
      'bestaat-niet': { count: 3, streak: 1, okDay: '2026-10-01' },
      constructor: { count: 1 }
    } });
    await p.reload();
    main = await p.textContent('main');
    check('AC-35: mistakes missing fields: Foutenlogboek renders, unknown ids ignored', /Oefen mijn fouten \(2\)/.test(main) && /1 daarvan had je vandaag al goed/.test(main), main.slice(0, 300));
    check('AC-35: stored "given" is shown as text, not HTML', !(await p.evaluate(() => window.__y)) && main.includes('laatste antwoord: <img'));
    await p.getByRole('button', { name: 'Oefen mijn fouten (2)' }).click();
    check('AC-35: practice with broken mistakes starts', (await p.textContent('.teller')).trim() === '1 / 2');
    check('AC-13..16/35: no page errors', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
}

// ---------- Exam-ready loop, part 3: start page target line and readiness (AC-17 … AC-35) ----------
async function part3(browser, base) {
  const NOW = new Date(2026, 8, 30, 12);
  const MOCK = 'proefexamen (30 min, zorg dat je niet gestoord wordt)';
  const ctx = await browser.newContext({ viewport: { width: 320, height: 740 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.clock.setFixedTime(NOW);
  await p.goto(base + '#/start');
  const today = p.getByRole('region', { name: 'Vandaag' });
  const ready = p.getByRole('region', { name: 'Klaar voor het examen?' });
  const noScroll = async () => (await p.evaluate(() => document.documentElement.scrollWidth)) <= 320;
  // Visible text only: the closed <details> repeats the topic rows.
  const has = async (loc, text) => (await loc.getByText(text, { exact: true }).filter({ visible: true }).count()) >= 1;

  // --- First use: nulmeting, "niet gepland", "Nog geen gegevens" ---
  check('AC-24/35: first use target line', await has(today, 'Vandaag: 5 vragen (± 5 min) + ' + MOCK), await today.textContent());
  check('AC-24: start button names the number of questions', await today.getByRole('button', { name: 'Start (5 vragen)' }).isVisible());
  const mock = today.getByRole('link', { name: 'Proefexamen (nulmeting)' });
  check('AC-23: nulmeting button links to #/examen', (await mock.getAttribute('href')) === '#/examen');
  check('AC-23: nulmeting explanation', await has(today, 'Een eerste proefexamen laat zien waar je nu staat.'));
  check('first use: "niet gepland" mode line', await has(today, 'Nog geen examendatum: 10 nieuwe vragen per dag.'));
  check('AC-31: first use readiness says "Nog geen gegevens"', await has(ready, 'Nog geen gegevens'));
  const eisen = await ready.getByRole('heading', { level: 3 }).allTextContents();
  check('AC-29: three eisen with a status word', eisen.length === 3 && /^Proefexamens\s+Nog niet$/.test(eisen[0]) && /^Onderwerpen\s+Nog niet$/.test(eisen[1]) && /^Oude fouten\s+Gehaald$/.test(eisen[2]), eisen.join('|'));
  check('AC-29: eisen are an ordered list of 3', (await ready.locator('ol > li').count()) === 3);
  for (const t of ['Minstens 3 proefexamens, de laatste 3 allemaal 46 of meer goed', 'Elk onderwerp 90% of meer goed over de laatste 20 antwoorden',
    'Geen open fouten ouder dan 2 dagen', '0 van 3 gedaan', '0 van 13 onderwerpen gehaald', 'Geen open fouten']) {
    check('AC-29/35: first use shows "' + t + '"', await has(ready, t));
  }
  const honesty = ['Gevaarherkenning en vragen met foto\'s meet deze app niet. Oefen die met je theorieboek en de filmpjes die erbij horen.',
    'Je kent veel van deze vragen al; het echte examen heeft andere vragen.'];
  for (const t of honesty) check('AC-32: honesty line "' + t.slice(0, 30) + '…"', await has(ready, t));
  check('AC-32: "0 van 243 vragen minstens 1× gezien"', await has(ready, '0 van 243 vragen minstens 1× gezien'));
  check('AC-31: no per-eis buttons without data', (await ready.getByRole('button', { name: /^Oefen/ }).count()) === 0 && (await ready.getByRole('link', { name: 'Doe een proefexamen' }).count()) === 0);
  check('AC-30: topics without answers say "nog geen antwoorden"', (await ready.getByText('nog geen antwoorden', { exact: true }).filter({ visible: true }).count()) === 3);
  check('part 3: 320px first use: no horizontal scroll', await noScroll());
  await p.screenshot({ path: path.join(SHOTS, 'part3-first-use-320.png'), fullPage: true });
  await ready.getByRole('button', { name: 'Naar Vandaag' }).click();
  check('AC-31: "Naar Vandaag" focuses the Vandaag heading', await p.evaluate(() => document.activeElement.tagName === 'H2' && document.activeElement.textContent === 'Vandaag'));

  // --- AC-28: a new exam date recalculates the target at once; focus stays in the field ---
  await p.getByLabel('Examendatum').selectOption('datum');
  await p.getByLabel('Dag van je examen').fill('2026-11-04'); // D = 35, U = 243 → 12 new, mock due → 6
  check('AC-28: date change recalculates the target line', await has(today, 'Vandaag: 6 vragen (± 5 min) + ' + MOCK), await today.textContent());
  check('AC-28: date change saves the new target', ((await readState(p)).today || {}).target === 6, JSON.stringify((await readState(p)).today));
  check('AC-28: focus stays in the date field', await p.getByLabel('Dag van je examen').evaluate((el) => el === document.activeElement));
  check('AC-19/28: no mode line with a date far enough away', !(await today.textContent()).includes('Nog geen examendatum'));
  await mock.click();
  await p.getByRole('button', { name: 'Start proefexamen' }).waitFor();
  check('AC-23: mock button opens the exam page', p.url().endsWith('#/examen'));

  // --- Data: two mocks, weak topics, old mistakes, target fixed this morning ---
  const bank = await p.evaluate(() => ({ topics: Object.keys(window.RB.topics), signs: window.RB.signs.slice(0, 4).map((s) => 'bord-' + s.id) }));
  const day = 86400000;
  const hist = (t, n, ok) => Array.from({ length: n }, (_, i) => ({ id: t + '-h' + i, ok: i < ok, day: '2026-09-29' }));
  const history = {};
  bank.topics.forEach((t) => { history[t] = hist(t, 20, 20); });
  history.snelheid = hist('snelheid', 20, 17);
  history.verlichting = hist('verlichting', 17, 15);
  const [s0, s1, s2, s3] = bank.signs;
  const data = {
    version: 3, history,
    exams: [{ date: NOW.getTime() - 10 * day, score: 47, total: 50, passed: true }, { date: NOW.getTime() - 3 * day, score: 45, total: 50, passed: true }],
    mistakes: { [s0]: { count: 1, last: NOW.getTime() - 10 * day }, [s1]: { count: 1, last: NOW.getTime() - 5 * day }, [s2]: { count: 1 }, [s3]: { count: 1, last: NOW.getTime() - day } },
    today: { day: '2026-09-30', target: 30, mock: false, practised: 12 }
  };
  await p.goto(base + '#/start');
  await writeState(p, data);
  await p.reload();
  check('AC-27/28: stored target and gedaan: "Vandaag: 30 vragen (± 15 min) · 12 gedaan"', await has(today, 'Vandaag: 30 vragen (± 15 min) · 12 gedaan'), await today.textContent());
  check('AC-27: "Ga verder" after some practice', (await today.getByRole('button', { name: /^Ga verder \(\d+ vragen\)$/ }).count()) === 1);
  check('AC-31: readiness "Nog niet" with 3 eisen open', (await ready.locator('p').first().textContent()) === 'Nog niet', await ready.locator('p').first().textContent());
  check('AC-29: eis 1 "2 van 3 gedaan, laagste 45"', await has(ready, '2 van 3 gedaan, laagste 45'));
  check('AC-29: eis 2 "11 van 13 onderwerpen gehaald"', await has(ready, '11 van 13 onderwerpen gehaald'));
  check('AC-29: eis 3 "3 fouten van vóór 28 september"', await has(ready, '3 fouten van vóór 28 september'));
  check('AC-30: topic row "88% (15/17), nog te weinig antwoorden (17/20)"', await has(ready, '88% (15/17), nog te weinig antwoorden (17/20)'));
  const visibleRows = await ready.locator('ul > li').filter({ visible: true }).locator('strong').allTextContents();
  check('AC-29: lowest topic first (Snelheid 85% before Verlichting 88%)', visibleRows.join('|') === 'Snelheid|Verlichting', visibleRows.join('|'));
  check('AC-31: "Doe een proefexamen" links to #/examen', (await ready.getByRole('link', { name: 'Doe een proefexamen' }).getAttribute('href')) === '#/examen');
  check('AC-31: one visible "Oefen <onderwerp>" per open topic', (await ready.getByRole('button', { name: 'Oefen Snelheid' }).count()) === 1 && (await ready.getByRole('button', { name: 'Oefen Verlichting' }).count()) === 1);
  check('AC-32: seen line counts mistakes as seen', await has(ready, '4 van 243 vragen minstens 1× gezien'));
  for (const t of honesty) check('AC-32: honesty line with data "' + t.slice(0, 30) + '…"', await has(ready, t));
  await ready.getByText('Alle onderwerpen (13)').click();
  check('AC-29: "Alle onderwerpen (13)" lists 13 topics', (await ready.locator('details[open] .onderwerp-rij').count()) === 13);
  check('part 3: 320px with all topics open: no horizontal scroll', await noScroll());
  await p.screenshot({ path: path.join(SHOTS, 'part3-data-320.png'), fullPage: true });
  await ready.getByRole('button', { name: 'Oefen oude fouten (3)' }).click();
  check('AC-31: "Oefen oude fouten (3)" starts a session of 3', /Oude fouten/.test(await p.textContent('h1')) && (await p.textContent('.teller')).trim() === '1 / 3', await p.textContent('.teller'));
  await p.reload(); // the session runs on #/start, so reload to get the start page back
  await ready.getByRole('button', { name: 'Oefen Snelheid' }).click();
  check('AC-31: "Oefen Snelheid" starts a Snelheid session (max 15)', /Snelheid/.test(await p.textContent('h1')) && /^1 \/ (1[0-5]|[1-9])$/.test((await p.textContent('.teller')).trim()), await p.textContent('.teller'));

  // --- Target met and "Klaar volgens deze app" ---
  await p.goto(base + '#/start');
  bank.topics.forEach((t) => { history[t] = hist(t, 20, 20); });
  await writeState(p, { version: 3, history, today: { day: '2026-09-30', target: 30, mock: false, practised: 32 },
    exams: [46, 48, 50].map((score, i) => ({ date: NOW.getTime() - (5 - i) * day, score, total: 50, passed: true })) });
  await p.reload();
  check('AC-27: "Doel van vandaag gehaald · 32 gedaan"', await has(today, 'Doel van vandaag gehaald · 32 gedaan'), await today.textContent());
  check('AC-27: "Nog een ronde" stays available', await today.getByRole('button', { name: 'Nog een ronde' }).isVisible());
  check('AC-31: all met: "Klaar volgens deze app"', await has(ready, 'Klaar volgens deze app'));
  for (const t of honesty) check('AC-32: honesty line also when Klaar "' + t.slice(0, 30) + '…"', await has(ready, t));

  // --- AC-35: broken saved data ---
  for (const raw of ['{"version":3,"today":', JSON.stringify({
    version: 3, today: { day: '2026-02-31', target: 'x', practised: -1, mock: 'ja' }, examDate: '2026-02-31', examMonth: '2026-13',
    history: { snelheid: 'x', voorrang: [null, { id: 1 }], constructor: [] }, seen: { constructor: '2026-09-30', a: 'nope' },
    exams: [{ date: 'x' }, { date: 1, score: 60, total: 50 }, { date: NOW.getTime(), score: 48, total: 50, topics: 5 }],
    mistakes: { [s0]: { count: 1, last: 'x', streak: '1', okDay: '2099-99-99' }, constructor: { count: 1 }, weg: { count: 1 } }, srs: { a: { box: 1, due: 'x' } }
  })]) {
    await writeState(p, raw);
    await p.reload();
    const text = (await today.textContent()) + (await ready.textContent());
    check('AC-35: broken data (' + raw.slice(0, 22) + '…): start renders both cards', (await today.isVisible()) && (await ready.isVisible()) && /Vandaag:|Doel van vandaag/.test(text), text.slice(0, 200));
    check('AC-35: broken data (' + raw.slice(0, 22) + '…): no NaN/undefined', !/NaN|undefined|Infinity/.test(text), text);
  }
  check('AC-35: broken data: 320px no horizontal scroll', await noScroll());

  // --- AC-27: an answer in another session before the start page was opened today still counts ---
  await writeState(p, { version: 3, today: { day: '2026-09-29', target: 10, mock: false, practised: 10 } });
  await p.goto(base + '#/borden'); await p.reload();
  await p.getByRole('button', { name: 'Bord → betekenis' }).click();
  await answerPractice(p);
  await p.goto(base + '#/start');
  check('AC-27: a Borden answer before opening the start page counts as "1 gedaan"', /· 1 gedaan$/.test((await today.locator('p').first().textContent()).trim()), await today.locator('p').first().textContent());
  check('part 3: no page errors', errs.length === 0, errs.join(' | '));
  await ctx.close();

  // --- AC-27: after a mock exam, the Vandaag round serves the exam mistakes; they still count as "gedaan" ---
  {
    const c2 = await browser.newContext({ viewport: { width: 360, height: 740 } });
    await c2.addInitScript(installOracle);
    const q = await c2.newPage();
    const e2 = [];
    q.on('pageerror', (e) => e2.push(e.message));
    q.on('dialog', (d) => d.accept());
    await q.clock.setFixedTime(NOW);
    await q.goto(base + '#/start');
    const t2 = q.getByRole('region', { name: 'Vandaag' });
    await t2.getByRole('link', { name: 'Proefexamen (nulmeting)' }).click();
    await runMock(q, (info, k) => k < 20); // nulmeting first, 20 wrong
    await q.goto(base + '#/start');
    await t2.getByRole('button', { name: 'Start (5 vragen)' }).click();
    for (let k = 0; k < 5; k++) { await q.locator('.q').waitFor(); await q.evaluate(() => window.__q.answer(true)); }
    await q.goto(base + '#/start'); await q.reload();
    const line = (await t2.locator('p').first().textContent()).trim();
    check('AC-27: after the nulmeting, a full "Start (5 vragen)" round counts as 5 gedaan', /· 5 gedaan$/.test(line), line);
    check('part 3 mock-first: no page errors', e2.length === 0, e2.join(' | '));
    await c2.close();
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
