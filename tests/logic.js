// Test de logica zonder browser: node tests/logic.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

// Laad util.js en store.js in een nep-browser met een eigen localStorage en klok.
function load(stored, now) {
  const data = {};
  if (stored !== undefined) data['rijbewijs-b-v1'] = typeof stored === 'string' ? stored : JSON.stringify(stored);
  const clock = { now: now || new Date(2026, 8, 28, 21, 0).getTime() };
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { super(...(a.length ? a : [clock.now])); }
    static now() { return clock.now; }
  }
  const ctx = {
    window: {},
    Date: FakeDate,
    localStorage: {
      getItem: (k) => (k in data ? data[k] : null),
      setItem: (k, v) => { data[k] = String(v); }
    },
    JSON, Math, Object, Array, String, Number, isFinite
  };
  ctx.window.addEventListener = () => {};
  vm.createContext(ctx);
  for (const f of ['util.js', 'store.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
  }
  return { RB: ctx.window.RB, clock, data };
}

let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + e.message); }
}
const HOUR = 3600 * 1000;

// ---------- parseNum ----------
test('parseNum: gewone getallen en decimalen', () => {
  const { parseNum } = load().RB.util;
  assert.strictEqual(parseNum('50'), 50);
  assert.strictEqual(parseNum(' 0,5 '), 0.5);
  assert.strictEqual(parseNum('0.5'), 0.5);
  assert.strictEqual(parseNum('1,6'), 1.6);
  assert.strictEqual(parseNum('0,220'), 0.22);
});
test('parseNum: duizendtallen met punt of spatie', () => {
  const { parseNum } = load().RB.util;
  assert.strictEqual(parseNum('3.500'), 3500);
  assert.strictEqual(parseNum('3 500'), 3500);
  assert.strictEqual(parseNum('4.250'), 4250);
  assert.strictEqual(parseNum('1.234,5'), 1234.5);
  assert.strictEqual(parseNum('0.500'), 0.5);
});
test('parseNum: onzin geeft null', () => {
  const { parseNum } = load().RB.util;
  for (const s of ['', '  ', 'abc', '3500abc', '3,5e3', '1,2,3', '-5', null, undefined]) {
    assert.strictEqual(parseNum(s), null, JSON.stringify(s));
  }
});

// ---------- Flashcards: kalenderdagen ----------
test('flashcard is de volgende dag vanaf middernacht weer aan de beurt', () => {
  const { RB, clock } = load(); // 28 sep, 21:00
  RB.store.reviewCard('x', true); // bak 1: 1 dag
  clock.now += 3 * HOUR; // 29 sep, 00:00
  assert.ok(RB.store.isDue('x'), 'om middernacht aan de beurt');
});
test('flashcard "wist ik niet" is meteen weer aan de beurt', () => {
  const { RB } = load();
  RB.store.reviewCard('x', false);
  assert.ok(RB.store.isDue('x'));
});

// ---------- Foutenlogboek ----------
const item = { id: 'k-test', topic: 'snelheid' };
test('fout wordt pas opgelost na goed op twee verschillende dagen', () => {
  const { RB, clock } = load();
  const s = RB.store;
  s.recordAnswer(item, false, 'fout');
  assert.deepStrictEqual(s.openMistakes(), ['k-test']);
  s.recordAnswer(item, true);
  s.recordAnswer(item, true);
  assert.deepStrictEqual(s.openMistakes(), ['k-test'], 'twee keer goed op dezelfde dag is niet genoeg');
  assert.ok(s.okToday('k-test'));
  clock.now += 24 * HOUR;
  assert.ok(!s.okToday('k-test'));
  s.recordAnswer(item, true);
  assert.deepStrictEqual(s.openMistakes(), []);
});
test('een nieuwe fout zet de teller terug', () => {
  const { RB, clock } = load();
  const s = RB.store;
  s.recordAnswer(item, false);
  s.recordAnswer(item, true);
  clock.now += 24 * HOUR;
  s.recordAnswer(item, false);
  s.recordAnswer(item, true);
  assert.deepStrictEqual(s.openMistakes(), ['k-test']);
});
test('flashcards tellen alleen in de statistiek, niet als fout', () => {
  const { RB } = load();
  RB.store.recordStat(false);
  assert.deepStrictEqual(RB.store.openMistakes(), []);
  assert.strictEqual(RB.store.state().stats.answered, 1);
});
test('openMistakes filtert vragen die niet meer bestaan', () => {
  const { RB } = load();
  RB.store.recordAnswer({ id: 'weg', topic: 'x' }, false);
  RB.store.recordAnswer(item, false);
  assert.deepStrictEqual(RB.store.openMistakes((id) => id !== 'weg'), ['k-test']);
});

// ---------- Opslag ----------
test('kapotte of oude opslag geeft een geldige toestand', () => {
  for (const raw of ['{niet json', 'null', '[]', { stats: null, exams: null, mistakes: null, srs: 5, done: 'x' },
    { examDate: '<img src=x onerror=alert(1)>', mistakes: { a: null, b: { count: 2 } }, srs: { c: { box: 'x' } } }]) {
    const st = load(raw).RB.store.state();
    assert.ok(Array.isArray(st.exams));
    assert.strictEqual(typeof st.stats.answered, 'number');
    assert.strictEqual(st.examDate, null);
    assert.ok(!('a' in st.mistakes));
    assert.ok(!('c' in st.srs));
  }
  const ok = load({ mistakes: { b: { count: 2 } }, examDate: '2026-10-19' }).RB.store.state();
  assert.ok(ok.mistakes.b);
  assert.strictEqual(ok.examDate, '2026-10-19');
});
test('setExamDate accepteert alleen een datum', () => {
  const { RB } = load();
  RB.store.setExamDate('"><script>');
  assert.strictEqual(RB.store.state().examDate, null);
  RB.store.setExamDate('2026-10-19');
  assert.strictEqual(RB.store.state().examDate, '2026-10-19');
});

if (failed) { console.error(failed + ' test(s) mislukt'); process.exit(1); }
console.log('Alle tests geslaagd.');
