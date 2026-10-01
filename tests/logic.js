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

// Objecten uit de vm-context hebben een ander prototype: vergelijk de inhoud.
const same = (a, b, msg) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), b, msg);

// ---------- Datums en maanden ----------
test('isDay en isMonth weigeren onmogelijke waarden', () => {
  const { isDay, isMonth } = load().RB.util;
  assert.ok(isDay('2026-11-20'));
  assert.ok(isDay('2028-02-29'));
  for (const s of ['2026-02-31', '2026-02-29', '2026-13-01', '2026-00-10', '2026-9-30', '', null, 20261120]) assert.ok(!isDay(s), String(s));
  assert.ok(isMonth('2026-11'));
  for (const s of ['2026-13', '2026-00', '2026-1', '2026-11-01', null]) assert.ok(!isMonth(s), String(s));
});
test('maandlijst: huidige maand plus 11, ook over de jaarwissel', () => {
  const { RB, clock } = load(undefined, new Date(2026, 8, 30, 12).getTime());
  const list = RB.util.monthList(clock.now, 12); // de nepklok, niet de echte (anders faalt dit na september)
  assert.strictEqual(list.length, 12);
  assert.strictEqual(list[0], '2026-09');
  assert.strictEqual(list[11], '2027-08');
  assert.strictEqual(RB.util.monthKey(new Date(2026, 0, 31).getTime(), 1), '2026-02', '31 januari + 1 maand = februari');
  assert.strictEqual(RB.util.monthLabel('2026-11'), 'november 2026');
  assert.strictEqual(RB.util.dayLabel('2026-11-20'), '20 november');
});
test('examInfo: maand november 2026 per dag (AC-8, AC-9)', () => {
  const { examInfo } = load().RB.util;
  const on = (m, d) => examInfo(null, '2026-11', new Date(2026, m - 1, d, 12).getTime());
  same(on(9, 30), { mode: 'maand', month: '2026-11', days: 32, phase: 'later' });
  assert.strictEqual(on(10, 10).phase, 'later');
  assert.strictEqual(on(10, 11).phase, 'bijna');
  assert.strictEqual(on(10, 11).days, 21);
  assert.strictEqual(on(10, 31).phase, 'bijna');
  assert.strictEqual(on(11, 1).phase, 'bezig');
  assert.strictEqual(on(11, 30).phase, 'bezig');
  assert.strictEqual(on(12, 1).phase, 'voorbij');
});
test('examInfo: precieze datum gaat voor de maand; niets is "geen"', () => {
  const { examInfo } = load().RB.util;
  const t = new Date(2026, 8, 30, 23, 30).getTime();
  same(examInfo('2026-10-01', '2026-11', t), { mode: 'datum', day: '2026-10-01', days: 1 });
  assert.strictEqual(examInfo('2026-09-29', null, t).days, -1);
  same(examInfo(null, null, t), { mode: 'geen' });
  same(examInfo('2026-02-31', 'x', t), { mode: 'geen' });
});
test('setExamMonth en setExamDate sluiten elkaar uit', () => {
  const { RB } = load();
  const s = RB.store;
  s.setExamMonth('2026-11');
  assert.strictEqual(s.state().examMonth, '2026-11');
  s.setExamDate('');
  assert.strictEqual(s.state().examMonth, '2026-11', 'leeg datumveld laat de maand staan');
  s.setExamDate('2026-11-20');
  assert.strictEqual(s.state().examDate, '2026-11-20');
  assert.strictEqual(s.state().examMonth, null);
  s.setExamMonth('2026-12');
  assert.strictEqual(s.state().examDate, null);
  s.setExamMonth(null);
  assert.strictEqual(s.state().examMonth, null);
  s.setExamDate('2026-02-31');
  assert.strictEqual(s.state().examDate, null);
});

// ---------- Antwoordgeschiedenis en gezien ----------
test('antwoord komt in history en seen (AC-1, AC-4)', () => {
  const { RB } = load();
  RB.store.recordAnswer({ id: 'v-3', topic: 'voorrang' }, true);
  const st = RB.store.state();
  same(st.history.voorrang, [{ id: 'v-3', ok: true, day: '2026-09-28' }]);
  assert.strictEqual(st.seen['v-3'], '2026-09-28');
});
test('alleen het eerste antwoord per vraag per dag telt (AC-2)', () => {
  const { RB, clock } = load();
  const s = RB.store;
  s.recordAnswer({ id: 'k-alarm', topic: 'kennis' }, false);
  s.recordAnswer({ id: 'k-alarm', topic: 'kennis' }, true);
  assert.strictEqual(s.state().history.kennis.length, 1);
  assert.strictEqual(s.state().history.kennis[0].ok, false);
  clock.now += 24 * HOUR;
  s.recordAnswer({ id: 'k-alarm', topic: 'kennis' }, true);
  assert.strictEqual(s.state().history.kennis.length, 2);
});
test('history houdt de nieuwste 20 per onderwerp (AC-1)', () => {
  const { RB } = load();
  for (let i = 1; i <= 21; i++) RB.store.recordAnswer({ id: 'q' + i, topic: 'borden' }, true);
  const h = RB.store.state().history.borden;
  assert.strictEqual(h.length, 20);
  assert.strictEqual(h[0].id, 'q2');
  assert.strictEqual(h[19].id, 'q21');
});
test('flashcard zelfbeoordeling: wel seen, geen history (AC-3)', () => {
  const { RB } = load();
  RB.store.recordStat(true, 'bord-a1');
  same(RB.store.state().history, {});
  assert.strictEqual(RB.store.state().seen['bord-a1'], '2026-09-28');
});
test('tallyTopics telt goed en gevraagd per onderwerp (AC-5)', () => {
  const { tallyTopics } = load().RB.util;
  const t = tallyTopics([{ topic: 'voorrang', ok: true }, { topic: 'voorrang', ok: false }, { topic: 'borden', ok: true }]);
  same(t, { voorrang: [1, 2], borden: [1, 1] });
});

// ---------- clean(): versie 3 ----------
test('versie 2 wordt versie 3 zonder verlies', () => {
  const v2 = { version: 2, examDate: '2026-11-20', mistakes: { a: { count: 1, last: 5 } }, exams: [{ date: 1, score: 40, total: 50, passed: false }], stats: { answered: 3, correct: 2 } };
  const st = load(v2).RB.store.state();
  assert.strictEqual(st.version, 3);
  assert.strictEqual(st.examDate, '2026-11-20');
  assert.strictEqual(st.examMonth, null);
  same(st.history, {});
  same(st.seen, {});
  assert.strictEqual(st.mistakes.a.last, 5);
  assert.strictEqual(st.exams[0].score, 40);
  assert.strictEqual(st.stats.answered, 3);
});
test('clean: examMonth, onmogelijke examDate, history, seen en sleutelbeveiliging', () => {
  const raw = '{"examDate":"2026-02-31","examMonth":"2026-13",' +
    '"history":{"__proto__":[{"id":"x","ok":true,"day":"2026-09-30"}],"constructor":[],"voorrang":[{"id":"v-1","ok":true,"day":"2026-09-30"},{"id":5,"ok":true,"day":"2026-09-30"},{"id":"v-2","ok":"ja","day":"2026-09-30"},{"id":"v-3","ok":false,"day":"2026-02-31"},null],"kennis":"x"},' +
    '"seen":{"__proto__":"2026-09-30","prototype":"2026-09-30","a":"2026-09-30","b":"gisteren","c":5}}';
  const st = load(raw).RB.store.state();
  assert.strictEqual(st.examDate, null);
  assert.strictEqual(st.examMonth, null);
  same(Object.keys(st.history), ['voorrang']);
  same(st.history.voorrang, [{ id: 'v-1', ok: true, day: '2026-09-30' }]);
  assert.strictEqual(Object.getPrototypeOf(Object.getPrototypeOf(st.history)), null, 'prototype niet vervangen');
  same(Object.keys(st.seen), ['a']);
  assert.ok(load({ examMonth: '2026-11' }).RB.store.state().examMonth === '2026-11');
  const long = Array.from({ length: 25 }, (_, i) => ({ id: 'q' + i, ok: true, day: '2026-09-30' }));
  const h = load({ history: { borden: long } }).RB.store.state().history.borden;
  assert.strictEqual(h.length, 20);
  assert.strictEqual(h[0].id, 'q5');
});
test('clean: proefexamens en onderwerpscores', () => {
  const exams = [
    { date: 1, score: 43, total: 50, passed: false, topics: { voorrang: [4, 6], borden: [5, 7] } },
    { date: 2, score: 43, total: 50, topics: { voorrang: [7, 6] } },
    { date: 3, score: 43, total: 50, topics: { voorrang: [1.5, 6] } },
    { date: 4, score: 43, total: 50, topics: 'x' },
    { date: 5, score: 51, total: 50 },
    { date: 6, score: 44, total: 40.5 },
    { date: 7, score: -1, total: 50 },
    { date: 'x', score: 40, total: 50 },
    { date: 8, kennis: 11, inzicht: 26, passed: true },
    null
  ];
  const st = load({ exams }).RB.store.state();
  same(st.exams.map((e) => e.date), [1, 2, 3, 4, 8]);
  same(st.exams[0].topics, { voorrang: [4, 6], borden: [5, 7] });
  for (const k of [1, 2, 3]) assert.ok(!('topics' in st.exams[k]), 'slechte topics vervallen, examen blijft');
  assert.strictEqual(st.exams[4].kennis, 11, 'oud formaat blijft');
});
test('AC-2: eerste antwoord per dag telt ook na 20 nieuwere antwoorden in hetzelfde onderwerp', () => {
  const { RB, clock, data } = load();
  for (let i = 1; i <= 21; i++) RB.store.recordAnswer({ id: 'q' + i, topic: 'borden' }, true);
  RB.store.recordAnswer({ id: 'q1', topic: 'borden' }, false);
  let h = RB.store.state().history.borden;
  assert.strictEqual(h.length, 20);
  assert.ok(!h.some((x) => x.id === 'q1'), 'q1 niet opnieuw vandaag');
  // Ook na opnieuw laden (answeredDay staat in de opslag).
  const again = load(data['rijbewijs-b-v1'], clock.now).RB.store;
  again.recordAnswer({ id: 'q1', topic: 'borden' }, false);
  assert.ok(!again.state().history.borden.some((x) => x.id === 'q1'), 'ook niet na herladen');
  clock.now += 24 * HOUR;
  RB.store.recordAnswer({ id: 'q1', topic: 'borden' }, false);
  h = RB.store.state().history.borden;
  same(h[19], { id: 'q1', ok: false, day: '2026-09-29' });
  same(Object.keys(RB.store.state().answeredDay.ids), ['q1']);
});
test('AC-2: flashcard-zelfbeoordeling blokkeert het eerste echte antwoord niet', () => {
  const { RB } = load();
  RB.store.recordStat(true, 'k-alarm');
  RB.store.recordAnswer({ id: 'k-alarm', topic: 'kennis' }, false);
  assert.strictEqual(RB.store.state().history.kennis.length, 1);
});
test('clean: answeredDay', () => {
  const ok = load('{"answeredDay":{"day":"2026-09-28","ids":{"a":true,"b":"ja","__proto__":true,"constructor":true,"c":false}}}').RB.store.state().answeredDay;
  assert.strictEqual(ok.day, '2026-09-28');
  same(Object.keys(ok.ids), ['a', 'c']);
  assert.strictEqual(Object.getPrototypeOf(Object.getPrototypeOf(ok.ids)), null, 'prototype niet vervangen');
  for (const bad of [{ day: '2026-02-31', ids: {} }, { day: '2026-09-28', ids: [] }, { day: '2026-09-28' }, 'x', null]) {
    assert.strictEqual(load({ answeredDay: bad }).RB.store.state().answeredDay, null, JSON.stringify(bad));
  }
});
test('clean: oud examenformaat vereist getallen voor kennis en inzicht', () => {
  const exams = [{ date: 5 }, { date: 6, score: null, total: null }, { date: 7, kennis: 11 }, { date: 8, kennis: 'x', inzicht: 3 }, { date: 9, kennis: 11, inzicht: 26 }];
  const st = load({ exams }).RB.store.state();
  same(st.exams.map((e) => e.date), [9]);
});
test('clean: __proto__, constructor en prototype worden overgeslagen in srs, mistakes en done', () => {
  const raw = '{"mistakes":{"__proto__":{"count":1},"constructor":{"count":1},"a":{"count":1}},' +
    '"srs":{"__proto__":{"box":1,"due":1},"prototype":{"box":1,"due":1}},"done":{"__proto__":true,"constructor":false}}';
  const st = load(raw).RB.store.state();
  const objProto = Object.getPrototypeOf(st.history); // Object.prototype van de vm-realm
  assert.strictEqual(Object.getPrototypeOf(st.mistakes), objProto);
  assert.strictEqual(Object.getPrototypeOf(st.srs), objProto);
  assert.strictEqual(Object.getPrototypeOf(st.done), objProto);
  assert.strictEqual(Object.getPrototypeOf(objProto), null);
  same(Object.keys(st.mistakes), ['a']);
  same(Object.keys(st.srs), []);
  same(Object.keys(st.done), []);
});
test('clean: mistakes[id].last moet een eindig getal zijn', () => {
  const st = load({ mistakes: { a: { count: 1, last: 'gisteren' }, b: { count: 1, last: 7 }, c: { count: 1 } } }).RB.store.state();
  assert.ok(!('last' in st.mistakes.a));
  assert.strictEqual(st.mistakes.b.last, 7);
  assert.ok(st.mistakes.c);
});

// ---------- Exam-ready loop, deel 1: extra randgevallen ----------
const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const stored = (data) => JSON.parse(data['rijbewijs-b-v1']);

// AC-1 / AC-2 / AC-4: antwoordgeschiedenis
test('AC-1: de grens van 20 geldt per onderwerp, niet over alle onderwerpen samen', () => {
  const { RB } = load();
  RB.store.recordAnswer({ id: 'v-1', topic: 'voorrang' }, true);
  for (let i = 1; i <= 25; i++) RB.store.recordAnswer({ id: 'b' + i, topic: 'borden' }, i % 2 === 0);
  const h = RB.store.state().history;
  assert.strictEqual(h.borden.length, 20);
  assert.strictEqual(h.borden[0].id, 'b6', 'de 5 oudste zijn weg');
  same(h.voorrang, [{ id: 'v-1', ok: true, day: '2026-09-28' }]);
});
test('AC-1: het 21e antwoord over meerdere dagen laat het oudste vallen', () => {
  const { RB, clock } = load(undefined, at(2026, 9, 1));
  for (let i = 1; i <= 21; i++) { RB.store.recordAnswer({ id: 'k-alarm', topic: 'kennis' }, i !== 21); clock.now += 24 * HOUR; }
  const h = RB.store.state().history.kennis;
  assert.strictEqual(h.length, 20);
  assert.strictEqual(h[0].day, '2026-09-02', 'dag 1 is eruit');
  same(h[19], { id: 'k-alarm', ok: false, day: '2026-09-21' });
});
test('AC-1: history wordt opgeslagen in localStorage (versie 3)', () => {
  const { RB, data } = load();
  RB.store.recordAnswer({ id: 'v-3', topic: 'voorrang' }, false);
  const s = stored(data);
  assert.strictEqual(s.version, 3);
  same(s.history, { voorrang: [{ id: 'v-3', ok: false, day: '2026-09-28' }] });
  same(s.seen, { 'v-3': '2026-09-28' });
});
test('AC-1: een onderwerp als "toString" of "hasOwnProperty" werkt als gewone sleutel', () => {
  const { RB } = load();
  RB.store.recordAnswer({ id: 'x', topic: 'toString' }, true);
  RB.store.recordAnswer({ id: 'y', topic: 'hasOwnProperty' }, true);
  RB.store.recordAnswer({ id: 'y', topic: 'hasOwnProperty' }, false);
  assert.strictEqual(RB.store.state().history.toString.length, 1);
  assert.strictEqual(RB.store.state().history.hasOwnProperty.length, 1);
});
test('AC-1: onderwerp "__proto__" vervuilt geen prototypes', () => {
  const { RB } = load();
  RB.store.recordAnswer({ id: 'x', topic: '__proto__' }, true);
  RB.store.recordAnswer({ id: '__proto__', topic: 'kennis' }, true);
  const st = RB.store.state();
  assert.strictEqual(Object.getPrototypeOf(st.history), Object.getPrototypeOf(st.seen));
  assert.ok(!Array.isArray(Object.getPrototypeOf(st.history)));
  assert.strictEqual(({}).id, undefined);
});
test('AC-2: tweede antwoord dezelfde dag telt niet, ook niet als het goed is; de volgende dag wel', () => {
  const { RB, clock } = load(undefined, at(2026, 9, 30, 8));
  const s = RB.store;
  const k = { id: 'k-alarm', topic: 'kennis' };
  s.recordAnswer(k, true);
  clock.now = at(2026, 9, 30, 23, 59);
  s.recordAnswer(k, false);
  same(s.state().history.kennis, [{ id: 'k-alarm', ok: true, day: '2026-09-30' }]);
  clock.now = at(2026, 10, 1, 0, 0);
  s.recordAnswer(k, false);
  s.recordAnswer(k, true);
  same(s.state().history.kennis, [{ id: 'k-alarm', ok: true, day: '2026-09-30' }, { id: 'k-alarm', ok: false, day: '2026-10-01' }]);
});
test('AC-2: een andere vraag dezelfde dag komt er wel bij', () => {
  const { RB } = load();
  RB.store.recordAnswer({ id: 'k-alarm', topic: 'kennis' }, true);
  RB.store.recordAnswer({ id: 'k-gordel', topic: 'kennis' }, true);
  assert.strictEqual(RB.store.state().history.kennis.length, 2);
});
test('AC-2: foutenlogboek en statistiek tellen het tweede antwoord van de dag wel mee', () => {
  const { RB } = load();
  const k = { id: 'k-alarm', topic: 'kennis' };
  RB.store.recordAnswer(k, true);
  RB.store.recordAnswer(k, false, 'b');
  assert.strictEqual(RB.store.state().stats.answered, 2);
  assert.deepStrictEqual(RB.store.openMistakes(), ['k-alarm']);
  assert.strictEqual(RB.store.state().history.kennis.length, 1);
});
test('AC-4: seen schuift op naar de dag van het laatste antwoord', () => {
  const { RB, clock } = load();
  RB.store.recordAnswer({ id: 'v-3', topic: 'voorrang' }, true);
  clock.now += 3 * 24 * HOUR;
  RB.store.recordAnswer({ id: 'v-3', topic: 'voorrang' }, false);
  assert.strictEqual(RB.store.state().seen['v-3'], '2026-10-01');
});
test('AC-4: zonder antwoord geen seen en geen history (open examenvraag)', () => {
  const { RB } = load();
  RB.store.addExam({ date: Date.now(), score: 0, total: 50, passed: false, timeUp: true, topics: { kennis: [0, 50] } });
  same(RB.store.state().seen, {});
  same(RB.store.state().history, {});
});

// AC-3: flashcards
test('AC-3: "wist ik niet" werkt seen bij, maar niet history en niet het foutenlogboek', () => {
  const { RB, clock } = load();
  RB.store.recordStat(false, 'bord-a1');
  clock.now += 24 * HOUR;
  RB.store.recordStat(true, 'bord-a1');
  const st = RB.store.state();
  same(st.history, {});
  same(st.mistakes, {});
  assert.strictEqual(st.seen['bord-a1'], '2026-09-29');
  assert.strictEqual(st.stats.answered, 2);
});
test('AC-3: zelfbeoordeling laat een bestaande fout en zijn history ongemoeid', () => {
  const { RB } = load();
  RB.store.recordAnswer({ id: 'bord-a1', topic: 'borden' }, false);
  const before = JSON.stringify([RB.store.state().mistakes, RB.store.state().history]);
  RB.store.recordStat(true, 'bord-a1');
  assert.strictEqual(JSON.stringify([RB.store.state().mistakes, RB.store.state().history]), before);
});

// AC-5: score per onderwerp
test('AC-5: tallyTopics telt op tot score en totaal, ook bij tijd-om (open = fout)', () => {
  const { tallyTopics } = load().RB.util;
  const topics = ['voorrang', 'borden', 'kennis', 'snelheid', 'inhalen'];
  const rows = Array.from({ length: 50 }, (_, k) => ({ topic: topics[k % 5], ok: k < 20 && k % 3 !== 0 }));
  const t = tallyTopics(rows);
  const vals = Object.values(t);
  assert.strictEqual(vals.reduce((a, v) => a + v[1], 0), 50);
  assert.strictEqual(vals.reduce((a, v) => a + v[0], 0), rows.filter((r) => r.ok).length);
  for (const v of vals) assert.ok(v[0] <= v[1]);
  same(tallyTopics([]), {});
  same(tallyTopics([{ topic: 'kennis', ok: false }]), { kennis: [0, 1] });
});
test('AC-5: een examen met topics overleeft opslaan en opnieuw laden', () => {
  const { RB, data } = load();
  RB.store.addExam({ date: at(2026, 9, 30), score: 43, total: 50, passed: false, timeUp: true, topics: { voorrang: [4, 6], kennis: [39, 44] } });
  const st = load(data['rijbewijs-b-v1']).RB.store.state();
  same(st.exams[0], { date: at(2026, 9, 30), passed: false, timeUp: true, score: 43, total: 50, topics: { voorrang: [4, 6], kennis: [39, 44] } });
});

// AC-7 / AC-8 / AC-9: datum en maand
test('AC-7: maandlijst op 15 december 2026 loopt over de jaarwissel tot november 2027', () => {
  const { RB, clock } = load(undefined, at(2026, 12, 15));
  const list = RB.util.monthList(clock.now, 12);
  same(list, ['2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06', '2027-07', '2027-08', '2027-09', '2027-10', '2027-11']);
  assert.strictEqual(RB.util.monthKey(clock.now, 1), '2027-01', 'voorkeuze: volgende maand');
  assert.strictEqual(RB.util.monthLabel('2027-01'), 'januari 2027');
});
test('AC-7: maandlijst op 31 augustus slaat geen maand over (31 → 1e)', () => {
  const { RB, clock } = load(undefined, at(2026, 8, 31, 23, 59));
  const list = RB.util.monthList(clock.now, 12);
  assert.strictEqual(list[0], '2026-08');
  assert.strictEqual(list[1], '2026-09');
  assert.strictEqual(new Set(list).size, 12);
});
test('AC-7: "Nog niet gepland" (setExamMonth(null)) wist zowel maand als datum', () => {
  const { RB } = load();
  RB.store.setExamDate('2026-11-20');
  RB.store.setExamMonth(null);
  assert.strictEqual(RB.store.state().examDate, null);
  assert.strictEqual(RB.store.state().examMonth, null);
  RB.store.setExamMonth('2026-11');
  RB.store.setExamMonth('2026-13');
  assert.strictEqual(RB.store.state().examMonth, null, 'ongeldige maand = niet gepland');
});
test('AC-8: precieze datum gaat voor een opgeslagen maand, ook na herladen', () => {
  const { RB } = load({ version: 3, examDate: '2026-11-20', examMonth: '2026-12' }, at(2026, 9, 30));
  const st = RB.store.state();
  same(RB.util.examInfo(st.examDate, st.examMonth, at(2026, 9, 30)), { mode: 'datum', day: '2026-11-20', days: 51 });
});
test('AC-8: onmogelijke precieze datum valt terug op de maand', () => {
  const { examInfo } = load().RB.util;
  assert.strictEqual(examInfo('2026-02-31', '2026-11', at(2026, 9, 30)).mode, 'maand');
});
test('AC-8: precieze datum gisteren / vandaag / morgen', () => {
  const { examInfo } = load().RB.util;
  const t = at(2026, 9, 30, 0, 0);
  assert.strictEqual(examInfo('2026-09-29', null, t).days, -1);
  assert.strictEqual(examInfo('2026-09-30', null, at(2026, 9, 30, 23, 59)).days, 0);
  assert.strictEqual(examInfo('2026-10-01', null, at(2026, 9, 30, 23, 59)).days, 1);
});
test('AC-8: november 2026 op 30 september: 32 dagen tot 1 november, fase "later"', () => {
  const { examInfo } = load().RB.util;
  same(examInfo(null, '2026-11', at(2026, 9, 30)), { mode: 'maand', month: '2026-11', days: 32, phase: 'later' });
});
test('AC-8: maand voorbij over de jaarwissel (december 2026 op 1 januari 2027)', () => {
  const { examInfo } = load().RB.util;
  assert.strictEqual(examInfo(null, '2026-12', at(2026, 12, 31, 23, 59)).phase, 'bezig');
  assert.strictEqual(examInfo(null, '2026-12', at(2027, 1, 1, 0, 0)).phase, 'voorbij');
  assert.strictEqual(examInfo(null, '2027-01', at(2026, 12, 15)).phase, 'bijna');
});
test('AC-9: grens om middernacht: 10 okt 23:59 geen tip, 11 okt 00:00 wel', () => {
  const { examInfo } = load().RB.util;
  assert.strictEqual(examInfo(null, '2026-11', at(2026, 10, 10, 23, 59)).phase, 'later');
  assert.strictEqual(examInfo(null, '2026-11', at(2026, 10, 11, 0, 0)).phase, 'bijna');
});
test('AC-9: huidige maand gekozen is meteen "bezig", niet "bijna"', () => {
  const { examInfo } = load().RB.util;
  assert.strictEqual(examInfo(null, '2026-09', at(2026, 9, 30)).phase, 'bezig');
});
test('isDay: schrikkeljaren en jaren onder 100 (tussenstand bij typen)', () => {
  const { isDay } = load().RB.util;
  assert.ok(isDay('2024-02-29'));
  assert.ok(!isDay('2100-02-29'));
  assert.ok(!isDay('2026-04-31'));
  assert.ok(!isDay('0002-11-20'), 'jaar 0002 is geen examendag');
  assert.ok(!isDay('2026-11-20T00:00'));
  assert.ok(!isDay(' 2026-11-20'));
});

// clean() en migratie
test('migratie v2 → v3: srs, done, stats, fouten (streak/okDay) en examens blijven', () => {
  const v2 = {
    version: 2, examDate: '2026-11-20',
    srs: { 'bord-a1': { box: 2, due: 123 } }, done: { 'v-1': true },
    mistakes: { 'k-alarm': { count: 2, last: 1790000000000, streak: 1, okDay: '2026-09-29', given: 'b' } },
    exams: [{ date: 1, score: 40, total: 50, passed: false, timeUp: true }, { date: 2, kennis: 11, inzicht: 26, passed: true }],
    stats: { answered: 30, correct: 20 }
  };
  const { RB } = load(v2);
  const st = RB.store.state();
  same(st.srs, v2.srs);
  same(st.done, v2.done);
  same(st.mistakes, v2.mistakes);
  same(st.stats, v2.stats);
  assert.strictEqual(st.exams.length, 2);
  same(st.exams[0], { date: 1, passed: false, timeUp: true, score: 40, total: 50 });
  assert.strictEqual(st.exams[1].inzicht, 26);
  assert.ok(RB.store.isDue('bord-a1') !== undefined);
});
test('clean: __proto__, constructor en prototype met geldige entries in history worden overgeslagen', () => {
  const e = '[{"id":"x","ok":true,"day":"2026-09-30"}]';
  const raw = '{"history":{"__proto__":' + e + ',"constructor":' + e + ',"prototype":' + e + ',"kennis":' + e + '}}';
  const st = load(raw).RB.store.state();
  same(Object.keys(st.history), ['kennis']);
  assert.ok(!Array.isArray(Object.getPrototypeOf(st.history)));
  assert.strictEqual(typeof st.history.constructor, 'function', 'constructor is niet overschreven');
});
test('clean: seen met constructor-sleutel en geen object', () => {
  assert.deepStrictEqual(Object.keys(load('{"seen":{"constructor":"2026-09-30","k":"2026-02-31"}}').RB.store.state().seen), []);
  for (const seen of ['x', [], null, 5]) same(load({ seen }).RB.store.state().seen, {});
});
test('clean: history als array, string of null wordt leeg; extra velden in entries vervallen', () => {
  for (const history of [[], 'x', null, 5]) same(load({ history }).RB.store.state().history, {});
  const st = load({ history: { kennis: [{ id: 'a', ok: true, day: '2026-09-30', x: '<img>' }] } }).RB.store.state();
  same(st.history.kennis, [{ id: 'a', ok: true, day: '2026-09-30' }]);
});
test('clean: exams[].topics met __proto__ vervalt, het examen blijft', () => {
  const raw = '{"exams":[{"date":1,"score":4,"total":6,"topics":{"__proto__":[4,6]}},{"date":2,"score":4,"total":6,"topics":{"constructor":[4,6]}},{"date":3,"score":4,"total":6,"topics":{"prototype":[4,6]}}]}';
  const st = load(raw).RB.store.state();
  assert.strictEqual(st.exams.length, 3);
  for (const e of st.exams) assert.ok(!Object.prototype.hasOwnProperty.call(e, 'topics'), JSON.stringify(e));
});
test('clean: exams[].topics met foute waarden vervalt, het examen blijft', () => {
  const bad = [{ a: [1, 2, 3] }, { a: [-1, 2] }, { a: ['1', '2'] }, { a: [1] }, { a: null }, [[1, 2]], { a: [1, Infinity] }];
  const st = load({ exams: bad.map((topics, i) => ({ date: i + 1, score: 1, total: 2, topics })) }).RB.store.state();
  assert.strictEqual(st.exams.length, bad.length);
  for (const e of st.exams) assert.ok(!('topics' in e), JSON.stringify(e));
});
test('clean: score/total grenzen (0/0 en 50/50 goed; total 51, score "40", 40.5, zonder total fout)', () => {
  const exams = [
    { date: 1, score: 0, total: 0 }, { date: 2, score: 50, total: 50 },
    { date: 3, score: 40, total: 51 }, { date: 4, score: '40', total: 50 }, { date: 5, score: 40.5, total: 50 },
    { date: 6, score: 40 }, { date: 7, total: 50 }, { date: 8, score: 40, total: null }
  ];
  same(load({ exams }).RB.store.state().exams.map((e) => e.date), [1, 2]);
});
test('clean: exams zonder geldige date vallen weg (null, Infinity-string, ontbreekt)', () => {
  const st = load('{"exams":[{"score":40,"total":50},{"date":null,"score":40,"total":50},{"date":"1e999","score":40,"total":50},{"date":1e999,"score":40,"total":50}]}').RB.store.state();
  same(st.exams, []);
});
test('clean: mistakes[id].last null, string, object of 1e999 vervalt; de fout blijft', () => {
  const raw = '{"mistakes":{"a":{"count":1,"last":null},"b":{"count":1,"last":"5"},"c":{"count":1,"last":{}},"d":{"count":1,"last":1e999},"e":{"count":1,"last":0}}}';
  const st = load(raw).RB.store.state();
  for (const k of ['a', 'b', 'c', 'd']) { assert.ok(st.mistakes[k], k); assert.ok(!('last' in st.mistakes[k]), k); }
  assert.strictEqual(st.mistakes.e.last, 0);
});
test('clean: examMonth-varianten', () => {
  for (const m of ['2026-1', '2026-00', '26-11', '2026-11-01', 202611, ['2026-11']]) assert.strictEqual(load({ examMonth: m }).RB.store.state().examMonth, null, String(m));
  assert.strictEqual(load({ examMonth: '2027-01' }).RB.store.state().examMonth, '2027-01');
});
test('clean: examDate 2026-02-31 en 2026-04-31 worden geweigerd (#18)', () => {
  for (const d of ['2026-02-31', '2026-04-31', '2026-00-10', '0002-11-20']) assert.strictEqual(load({ examDate: d }).RB.store.state().examDate, null, d);
});
test('AC-35: allerlei rommel geeft geldige history, seen en examMonth', () => {
  for (const raw of ['{niet json', 'null', '[]', '"x"', '{"version":99,"history":{"a":[1,2,3]},"seen":{"a":null}}']) {
    const st = load(raw).RB.store.state();
    same(st.history, {});
    same(st.seen, {});
    assert.strictEqual(st.examMonth, null);
    assert.strictEqual(st.version, 3);
  }
});

// DST: alle daglogica moet om de wisseling van zomer- naar wintertijd heen kloppen (Europe/Amsterdam).
// ---------- Exam-ready loop, deel 2: uitslag per onderwerp en fouten oefenen ----------
const NAMES = { borden: 'Borden', voorrang: 'Voorrang', kennis: 'Kennis', snelheid: 'Snelheid', alcohol: 'Alcohol' };
const nameOf = (t) => NAMES[t] || t;
test('AC-10: onderwerpen op meeste fout, dan meer gevraagd, dan naam', () => {
  const { topicRows } = load().RB.util;
  const rows = topicRows({ kennis: [18, 19], voorrang: [4, 6], borden: [5, 7] }, nameOf);
  same(rows.map((r) => [r.name, r.ok, r.asked, r.wrong]), [['Borden', 5, 7, 2], ['Voorrang', 4, 6, 2], ['Kennis', 18, 19, 1]]);
  const tie = topicRows({ snelheid: [2, 3], alcohol: [2, 3], kennis: [3, 3] }, nameOf);
  same(tie.map((r) => r.topic), ['alcohol', 'snelheid', 'kennis'], 'gelijk: op naam; 0 fout achteraan');
  same(topicRows({}, nameOf), []);
  same(topicRows(undefined), []);
});
test('AC-12: zwakke onderwerpen zijn de 3 met meeste fout, alleen met fout > 0', () => {
  const { topicRows, weakTopics } = load().RB.util;
  const rows = topicRows({ a: [0, 3], b: [1, 3], c: [2, 3], d: [0, 5], e: [4, 4] });
  same(weakTopics(rows), ['d', 'a', 'b']);
  same(weakTopics(topicRows({ a: [3, 3] })), [], '0 fout: geen zwakke onderwerpen');
  same(weakTopics(topicRows({ a: [2, 3], b: [3, 3] })), ['a']);
});
test('AC-11: regel met het verschil met het vorige examen', () => {
  const { changeLine } = load().RB.util;
  assert.strictEqual(changeLine({ score: 40, total: 50 }, { score: 43, total: 50 }), '+3 sinds vorige: 40 / 50');
  assert.strictEqual(changeLine({ score: 45, total: 50 }, { score: 43, total: 50 }), '-2 sinds vorige: 45 / 50');
  assert.strictEqual(changeLine({ score: 43, total: 50 }, { score: 43, total: 50 }), 'Zelfde score als vorige: 43 / 50');
  assert.strictEqual(changeLine(undefined, { score: 43, total: 50 }), null, 'eerste examen');
  assert.strictEqual(changeLine({ kennis: 11, inzicht: 26 }, { score: 43, total: 50 }), null, 'oud formaat');
  assert.strictEqual(changeLine({ score: 30, total: 40 }, { score: 43, total: 50 }), null, 'ander aantal vragen');
});
test('AC-12: oefenlijst zwakke onderwerpen: eerst open fouten, dan niet goed in dit examen, max 15', () => {
  const { weakList } = load().RB.util;
  const items = [];
  for (const t of ['a', 'b', 'c', 'd']) for (let i = 0; i < 10; i++) items.push({ id: t + i, topic: t });
  const list = weakList({
    topics: ['a', 'b'], items,
    open: ['b5', 'd1', 'a3', 'onbekend', 'a3'],
    okIds: { a0: true, a1: true, b0: true },
    examIds: { a0: true, a1: true, b0: true, a9: true, b9: true }
  });
  assert.strictEqual(list.length, 15);
  same(list.slice(0, 2), ['b5', 'a3'], 'eerst open fouten uit de zwakke onderwerpen (in volgorde, zonder dubbele)');
  same(list.slice(2, 4), ['a9', 'b9'], 'dan vragen uit dit examen die niet goed waren');
  assert.ok(list.every((id) => /^[ab]/.test(id)), 'alleen de zwakke onderwerpen');
  assert.ok(!list.some((id) => ['a0', 'a1', 'b0'].includes(id)), 'niets wat goed was in dit examen');
  assert.strictEqual(new Set(list).size, list.length, 'geen dubbele');
  same(weakList({ topics: [], items, open: ['a3'] }), [], 'geen zwakke onderwerpen: lege lijst');
  assert.strictEqual(weakList({ topics: ['a'], items, max: 3 }).length, 3);
});
test('AC-12: fouten die vandaag al goed waren zitten in de oefenlijst', () => {
  const { RB } = load();
  const a = { id: 'a1', topic: 'a' };
  RB.store.recordAnswer(a, false);
  RB.store.recordAnswer(a, true);
  assert.ok(RB.store.okToday('a1'));
  same(RB.util.weakList({ topics: ['a'], items: [a, { id: 'a2', topic: 'a' }], open: RB.store.openMistakes(), okIds: {} }), ['a1', 'a2']);
});
test('namen samenvoegen: "A", "A en B", "A, B en C"', () => {
  const { joinNames } = load().RB.util;
  assert.strictEqual(joinNames(['Voorrang']), 'Voorrang');
  assert.strictEqual(joinNames(['Voorrang', 'Snelheid']), 'Voorrang en Snelheid');
  assert.strictEqual(joinNames(['Borden', 'Voorrang', 'Snelheid']), 'Borden, Voorrang en Snelheid');
  assert.strictEqual(joinNames([]), '');
});
test('AC-13: regel in het foutenlogboek over fouten die vandaag al goed waren', () => {
  const { okTodayLine } = load().RB.util;
  assert.strictEqual(okTodayLine(0, 4), '');
  assert.strictEqual(okTodayLine(1, 4), '1 daarvan had je vandaag al goed. Die is pas weg als je hem morgen weer goed hebt.');
  assert.strictEqual(okTodayLine(3, 4), '3 daarvan had je vandaag al goed. Die zijn pas weg als je ze morgen weer goed hebt.');
  assert.strictEqual(okTodayLine(1, 1), 'Die had je vandaag al goed. Hij is pas weg als je hem morgen weer goed hebt.');
  assert.strictEqual(okTodayLine(2, 2), 'Die had je vandaag allemaal al goed. Ze zijn pas weg als je ze morgen weer goed hebt.');
});
test('AC-14/15: goed vandaag blijft open; nog eens goed vandaag ook; fout zet streak 0 en okDay null', () => {
  const { RB, clock } = load();
  const s = RB.store;
  s.recordAnswer(item, false);
  s.recordAnswer(item, true);
  s.recordAnswer(item, true);
  const m = s.state().mistakes['k-test'];
  assert.strictEqual(m.streak, 1);
  assert.strictEqual(m.okDay, '2026-09-28');
  assert.ok(!m.resolved);
  s.recordAnswer(item, false);
  assert.strictEqual(m.streak, 0);
  assert.strictEqual(m.okDay, null);
  s.recordAnswer(item, true);
  clock.now += 24 * HOUR;
  s.recordAnswer(item, true);
  assert.ok(m.resolved, 'goed op een latere dag: opgelost');
});

// ---------- Deel 2: randgevallen (test-engineer) ----------
test('AC-10: bij gelijk aantal fout gaat meer gevraagd vóór de naam', () => {
  const { topicRows } = load().RB.util;
  // Beide 2 fout; Voorrang heeft 6 gevraagd, Alcohol 2: Voorrang eerst ondanks de naam.
  same(topicRows({ alcohol: [0, 2], voorrang: [4, 6] }, nameOf).map((r) => r.topic), ['voorrang', 'alcohol']);
});
test('AC-10: sorteren op de getoonde naam, niet op de sleutel', () => {
  const { topicRows } = load().RB.util;
  const names = { z: 'Alcohol', a: 'Borden' };
  same(topicRows({ a: [1, 2], z: [1, 2] }, (t) => names[t]).map((r) => r.topic), ['z', 'a']);
});
test('AC-10: naam sorteert Nederlands: hoofdletters en accenten niet eerst', () => {
  const { topicRows } = load().RB.util;
  const names = { v: 'Voorrang', a: 'alcohol', e: 'Één richting', f: 'Fietsers', i: 'ijs', j: 'Jongeren' };
  const rows = topicRows({ v: [1, 2], a: [1, 2], e: [1, 2], f: [1, 2], i: [1, 2], j: [1, 2] }, (t) => names[t]);
  same(rows.map((r) => r.name), ['alcohol', 'Één richting', 'Fietsers', 'ijs', 'Jongeren', 'Voorrang']);
});
test('AC-10: onderwerpen met 0 fout staan er ook in, achteraan, op gevraagd en naam', () => {
  const { topicRows } = load().RB.util;
  const rows = topicRows({ kennis: [19, 19], borden: [7, 7], snelheid: [3, 4], alcohol: [7, 7] }, nameOf);
  same(rows.map((r) => [r.topic, r.wrong]), [['snelheid', 1], ['kennis', 0], ['alcohol', 0], ['borden', 0]]);
});
test('AC-10: onderwerp zonder naam toont de sleutel', () => {
  const { topicRows } = load().RB.util;
  same(topicRows({ onbekend: [0, 1] }, nameOf).map((r) => r.name), ['onbekend']);
});
test('AC-10/AC-5: open vragen bij tijd-om tellen als fout in de rijen en tellen op tot 50', () => {
  const { tallyTopics, topicRows } = load().RB.util;
  // 50 vragen, 3 beantwoord (2 goed), de rest open.
  const list = [];
  for (let i = 0; i < 50; i++) list.push({ topic: ['voorrang', 'borden', 'kennis'][i % 3], ok: i < 3 && i !== 1 });
  const rows = topicRows(tallyTopics(list), nameOf);
  assert.strictEqual(rows.reduce((a, r) => a + r.asked, 0), 50);
  assert.strictEqual(rows.reduce((a, r) => a + r.ok, 0), 2);
  assert.strictEqual(rows.reduce((a, r) => a + r.wrong, 0), 48);
});
test('AC-12: zwakke onderwerpen: gelijke stand op plek 3/4 volgt de AC-10-sortering', () => {
  const { topicRows, weakTopics } = load().RB.util;
  const rows = topicRows({ a: [0, 4], b: [2, 4], c: [1, 3], d: [3, 5], e: [0, 1] }, (t) => t);
  // fout: a4, b2, c2, d2, e1 → a, dan b/d (4 en 5 gevraagd → d eerst), dan b.
  same(weakTopics(rows), ['a', 'd', 'b']);
});
test('AC-12: met fout in 1 of 2 onderwerpen zijn er maar 1 of 2 zwakke', () => {
  const { topicRows, weakTopics } = load().RB.util;
  same(weakTopics(topicRows({ a: [3, 3], b: [1, 3] })), ['b']);
  same(weakTopics(topicRows({ a: [2, 3], b: [1, 3], c: [3, 3] })), ['b', 'a']);
});
test('AC-11: verschil +n en -n met ASCII-min, ook vanaf 0 en tot 50', () => {
  const { changeLine } = load().RB.util;
  assert.strictEqual(changeLine({ score: 0, total: 50 }, { score: 50, total: 50 }), '+50 sinds vorige: 0 / 50');
  assert.strictEqual(changeLine({ score: 50, total: 50 }, { score: 0, total: 50 }), '-50 sinds vorige: 50 / 50');
  assert.strictEqual(changeLine({ score: 44, total: 50 }, { score: 43, total: 50 }), '-1 sinds vorige: 44 / 50');
  assert.ok(!/−/.test(changeLine({ score: 44, total: 50 }, { score: 43, total: 50 })), 'geen Unicode-min');
});
test('AC-11: vorig examen dat op tijd-om eindigde telt gewoon mee', () => {
  const { changeLine } = load().RB.util;
  assert.strictEqual(changeLine({ score: 3, total: 50, timeUp: true }, { score: 40, total: 50 }), '+37 sinds vorige: 3 / 50');
});
test('AC-11: oud formaat met kennis/inzicht en topics geeft geen regel', () => {
  const { changeLine } = load().RB.util;
  assert.strictEqual(changeLine({ kennis: 30, inzicht: 14, passed: true, date: 1 }, { score: 44, total: 50 }), null);
  assert.strictEqual(changeLine(null, { score: 44, total: 50 }), null);
});
test('AC-11/AC-35: vorig examen na clean(): oud formaat blijft zonder regel, kapot examen valt weg', () => {
  const { RB } = load({ version: 3, exams: [
    { date: 1, score: 40, total: 50 },
    { date: 2, score: 60, total: 50 } // kapot: valt weg, dus 40 / 50 is het vorige
  ] });
  const ex = RB.store.state().exams;
  assert.strictEqual(RB.util.changeLine(ex[ex.length - 1], { score: 43, total: 50 }), '+3 sinds vorige: 40 / 50');
  const old = load({ version: 3, exams: [{ date: 1, score: 40, total: 50 }, { date: 2, kennis: 11, inzicht: 26, passed: true }] }).RB;
  const ex2 = old.store.state().exams;
  assert.strictEqual(old.util.changeLine(ex2[ex2.length - 1], { score: 43, total: 50 }), null, 'het nieuwste is oud formaat: geen regel');
});
test('AC-12: minder dan 15 beschikbaar: alles, zonder dubbele', () => {
  const { weakList } = load().RB.util;
  const items = [{ id: 'a1', topic: 'a' }, { id: 'a2', topic: 'a' }, { id: 'a3', topic: 'a' }, { id: 'b1', topic: 'b' }];
  const list = weakList({ topics: ['a'], items, open: ['a2', 'a2'], okIds: { a3: true }, examIds: { a1: true, a3: true } });
  same(list, ['a2', 'a1']);
});
test('AC-12: meer dan 15 open fouten: precies 15, allemaal fouten, in de opgegeven volgorde', () => {
  const { weakList } = load().RB.util;
  const items = [];
  for (let i = 0; i < 30; i++) items.push({ id: 'a' + i, topic: 'a' });
  const open = items.slice(0, 20).map((x) => x.id).reverse();
  const list = weakList({ topics: ['a'], items, open, okIds: {}, examIds: { a25: true } });
  same(list, open.slice(0, 15));
});
test('AC-12: een open fout die in dit examen goed was, blijft een open fout en komt eerst', () => {
  const { weakList } = load().RB.util;
  const items = [{ id: 'a1', topic: 'a' }, { id: 'a2', topic: 'a' }];
  same(weakList({ topics: ['a'], items, open: ['a1'], okIds: { a1: true }, examIds: { a1: true, a2: true } }), ['a1', 'a2']);
});
test('AC-12: open vragen bij tijd-om (in examen, niet goed) komen vóór vragen buiten het examen', () => {
  const { weakList } = load().RB.util;
  const items = [{ id: 'x1', topic: 'a' }, { id: 'x2', topic: 'a' }, { id: 'open', topic: 'a' }, { id: 'goed', topic: 'a' }];
  same(weakList({ topics: ['a'], items, open: [], okIds: { goed: true }, examIds: { open: true, goed: true } }), ['open', 'x1', 'x2']);
});
test('AC-12: open fouten uit andere onderwerpen en van verwijderde vragen doen niet mee', () => {
  const { weakList } = load().RB.util;
  const items = [{ id: 'a1', topic: 'a' }, { id: 'b1', topic: 'b' }];
  same(weakList({ topics: ['a'], items, open: ['b1', 'weg', 'a1'] }), ['a1']);
});
test('AC-12: rare id\'s in de open fouten en onderwerp "__proto__" breken de lijst niet', () => {
  const { weakList } = load().RB.util;
  const items = [{ id: 'a1', topic: 'a' }, { id: 'b1', topic: 'b' }];
  same(weakList({ topics: ['a', '__proto__'], items, open: ['__proto__', 'hasOwnProperty', 'constructor', 'a1'], okIds: {}, examIds: {} }), ['a1']);
  same(weakList({ topics: ['a'], items, open: [], okIds: { a1: true }, examIds: {} }), [], 'goed in examen: niet erin');
});
test('AC-12: 0 fout → geen zwakke onderwerpen en een lege lijst (dus geen knop)', () => {
  const { topicRows, weakTopics, weakList } = load().RB.util;
  const weak = weakTopics(topicRows({ a: [3, 3], b: [5, 5] }));
  same(weak, []);
  same(weakList({ topics: weak, items: [{ id: 'a1', topic: 'a' }], open: ['a1'] }), []);
});
test('AC-12: "Nog een ronde" (zelfde invoer, na goed beantwoorden vandaag) bouwt dezelfde fouten eerst op', () => {
  const { RB } = load();
  const a = { id: 'a1', topic: 'a' };
  const b = { id: 'a2', topic: 'a' };
  RB.store.recordAnswer(a, false);
  const input = () => ({ topics: ['a'], items: [b, a], open: RB.store.openMistakes(), okIds: {}, examIds: {} });
  same(RB.util.weakList(input()), ['a1', 'a2']);
  RB.store.recordAnswer(a, true); // goed in de ronde: nog open (AC-14)
  same(RB.util.weakList(input()), ['a1', 'a2'], 'de fout staat er nog steeds eerst');
});
test('AC-13: regel in het foutenlogboek: 2 van 5 en 5 van 5', () => {
  const { okTodayLine } = load().RB.util;
  assert.strictEqual(okTodayLine(2, 5), '2 daarvan had je vandaag al goed. Die zijn pas weg als je ze morgen weer goed hebt.');
  assert.strictEqual(okTodayLine(5, 5), 'Die had je vandaag allemaal al goed. Ze zijn pas weg als je ze morgen weer goed hebt.');
});
test('AC-13: okToday telt alleen open fouten met streak en okDay vandaag', () => {
  const { RB, clock } = load();
  const s = RB.store;
  s.recordAnswer(item, false);
  assert.ok(!s.okToday('k-test'), 'net fout: niet vandaag goed');
  s.recordAnswer(item, true);
  assert.ok(s.okToday('k-test'));
  assert.deepStrictEqual(s.openMistakes(), ['k-test'], 'telt mee als open fout (knop "Oefen mijn fouten")');
  clock.now += 24 * HOUR;
  assert.ok(!s.okToday('k-test'), 'de volgende dag niet meer');
  assert.ok(!s.okToday('bestaat-niet'));
});
test('AC-13/AC-35: fout met kapotte okDay of streak is niet "vandaag goed"', () => {
  const { RB } = load({ version: 3, mistakes: {
    a: { count: 1, streak: 1, okDay: 7 },
    b: { count: 1, streak: 0, okDay: '2026-09-28' },
    c: { count: 1 }
  } });
  for (const id of ['a', 'b', 'c']) assert.ok(!RB.store.okToday(id), id);
});
test('AC-14: goed op dag 1, nog eens goed op dag 1 (ook 23:59) blijft open; goed op dag 2 om 00:00 lost op', () => {
  const { RB, clock } = load(undefined, at(2026, 9, 30, 8));
  const s = RB.store;
  s.recordAnswer(item, false);
  s.recordAnswer(item, true);
  clock.now = at(2026, 9, 30, 23, 59);
  s.recordAnswer(item, true);
  const m = s.state().mistakes['k-test'];
  assert.strictEqual(m.streak, 1);
  assert.strictEqual(m.okDay, '2026-09-30');
  assert.ok(!m.resolved);
  clock.now = at(2026, 10, 1, 0, 0);
  s.recordAnswer(item, true);
  assert.ok(m.resolved, 'om middernacht is het een nieuwe dag');
  assert.deepStrictEqual(s.openMistakes(), []);
});
test('AC-14: goed gisteren (streak 1, okDay gisteren) en vandaag goed: opgelost', () => {
  const { RB } = load({ version: 3, mistakes: { 'k-test': { count: 1, streak: 1, okDay: '2026-09-27', last: 1 } } });
  RB.store.recordAnswer(item, true);
  assert.ok(RB.store.state().mistakes['k-test'].resolved);
});
test('AC-14: een opgeloste fout wordt door goed antwoorden niet heropend', () => {
  const { RB, clock } = load();
  const s = RB.store;
  s.recordAnswer(item, false); s.recordAnswer(item, true);
  clock.now += 24 * HOUR; s.recordAnswer(item, true);
  clock.now += 24 * HOUR; s.recordAnswer(item, true);
  assert.ok(s.state().mistakes['k-test'].resolved);
  assert.strictEqual(s.state().mistakes['k-test'].streak, 2);
});
test('AC-15: fout na goed vandaag: streak 0, okDay null; daarna goed vandaag = weer streak 1, morgen pas weg', () => {
  const { RB, clock } = load();
  const s = RB.store;
  s.recordAnswer(item, false);
  clock.now += 24 * HOUR;
  s.recordAnswer(item, true); // streak 1, okDay 29 sep
  s.recordAnswer(item, false);
  const m = s.state().mistakes['k-test'];
  assert.strictEqual(m.streak, 0);
  assert.strictEqual(m.okDay, null);
  assert.ok(!m.resolved);
  assert.ok(!s.okToday('k-test'));
  s.recordAnswer(item, true);
  assert.strictEqual(m.streak, 1);
  assert.ok(!m.resolved, 'zelfde dag: nog niet weg');
  clock.now += 24 * HOUR;
  s.recordAnswer(item, true);
  assert.ok(m.resolved);
});
test('AC-15: fout op een opgeloste fout opent hem weer met streak 0', () => {
  const { RB, clock } = load();
  const s = RB.store;
  s.recordAnswer(item, false); s.recordAnswer(item, true);
  clock.now += 24 * HOUR; s.recordAnswer(item, true);
  s.recordAnswer(item, false);
  const m = s.state().mistakes['k-test'];
  assert.ok(!m.resolved);
  assert.strictEqual(m.streak, 0);
  assert.strictEqual(m.okDay, null);
  assert.strictEqual(m.count, 2);
});
test('AC-14/15: streak en okDay overleven opslaan en opnieuw laden', () => {
  const { RB, data } = load();
  RB.store.recordAnswer(item, false);
  RB.store.recordAnswer(item, true);
  const again = load(data['rijbewijs-b-v1']).RB;
  assert.ok(again.store.okToday('k-test'));
  again.store.recordAnswer(item, true);
  assert.ok(!again.store.state().mistakes['k-test'].resolved, 'na herladen nog steeds dezelfde dag');
});

// Contrast (WCAG): --good moet 4,5:1 halen op wit, op --good-bg en als achtergrond voor witte knoptekst.
function cssTokens(dark) {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  const block = dark ? /@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(css)[1] : /:root\s*\{([^}]*)\}/.exec(css)[1];
  const out = {};
  block.replace(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g, (_, k, v) => { out[k] = v; });
  return out;
}
function contrast(a, b) {
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
test('contrast: licht --good #1a7a43 haalt 4,5:1 op wit (--card), op --good-bg en met witte tekst', () => {
  const t = cssTokens(false);
  assert.strictEqual(t.good.toLowerCase(), '#1a7a43');
  for (const [fg, bg] of [[t.good, '#ffffff'], [t.good, t.card], [t.good, t['good-bg']], [t['on-status'], t.good]]) {
    const r = contrast(fg, bg);
    assert.ok(r >= 4.5, fg + ' op ' + bg + ': ' + r.toFixed(2) + ':1');
  }
});
test('contrast: donker --good haalt 4,5:1 op --card, op --good-bg en met --on-status', () => {
  const t = Object.assign(cssTokens(false), cssTokens(true));
  for (const [fg, bg] of [[t.good, t.card], [t.good, t['good-bg']], [t['on-status'], t.good]]) {
    const r = contrast(fg, bg);
    assert.ok(r >= 4.5, fg + ' op ' + bg + ': ' + r.toFixed(2) + ':1');
  }
});

if (process.env.TZ === 'Europe/Amsterdam') {
  test('DST: tijdzone Europe/Amsterdam is echt actief', () => {
    assert.notStrictEqual(new Date(2026, 9, 24, 12).getTimezoneOffset(), new Date(2026, 9, 26, 12).getTimezoneOffset());
  });
  test('DST: daysUntil over zondag 25 oktober 2026 (25-uursdag)', () => {
    const { daysUntil } = load().RB.util;
    assert.strictEqual(daysUntil('2026-10-26', at(2026, 10, 24, 23, 30)), 2);
    assert.strictEqual(daysUntil('2026-10-26', at(2026, 10, 25, 0, 30)), 1);
    assert.strictEqual(daysUntil('2026-10-26', at(2026, 10, 25, 23, 59)), 1);
    assert.strictEqual(daysUntil('2026-11-01', at(2026, 9, 30, 12)), 32);
    assert.strictEqual(daysUntil('2026-11-01', at(2026, 10, 11, 0, 0)), 21);
    assert.strictEqual(daysUntil('2027-03-29', at(2027, 3, 27, 23, 30)), 2, 'ook in maart (23-uursdag)');
  });
  test('DST: AC-9 tip-grens en examInfo in Amsterdam', () => {
    const { examInfo } = load().RB.util;
    assert.strictEqual(examInfo(null, '2026-11', at(2026, 10, 10, 23, 59)).phase, 'later');
    assert.strictEqual(examInfo(null, '2026-11', at(2026, 10, 11, 0, 0)).phase, 'bijna');
    assert.strictEqual(examInfo(null, '2026-11', at(2026, 10, 31, 23, 30)).days, 1);
  });
  test('DST: AC-2 op de 25-uursdag: 00:30 en 23:30 zijn dezelfde dag, 00:10 de volgende niet', () => {
    const { RB, clock } = load(undefined, at(2026, 10, 25, 0, 30));
    const k = { id: 'k-alarm', topic: 'kennis' };
    RB.store.recordAnswer(k, true);
    clock.now += 23 * HOUR; // 25 okt 23:30
    RB.store.recordAnswer(k, false);
    assert.strictEqual(RB.store.state().history.kennis.length, 1);
    clock.now = at(2026, 10, 26, 0, 10);
    RB.store.recordAnswer(k, false);
    same(RB.store.state().history.kennis.map((h) => h.day), ['2026-10-25', '2026-10-26']);
  });
  test('DST AC-14: goed om 00:30 en 23:30 op de 25-uursdag (25 okt) blijft open; 26 okt 00:10 lost op', () => {
    const { RB, clock } = load(undefined, at(2026, 10, 24, 20));
    const s = RB.store;
    s.recordAnswer(item, false);
    clock.now = at(2026, 10, 25, 0, 30);
    s.recordAnswer(item, true);
    clock.now += 23 * HOUR; // 25 okt 23:30 (wintertijd)
    assert.strictEqual(new Date(clock.now).getDate(), 25);
    s.recordAnswer(item, true);
    const m = s.state().mistakes['k-test'];
    assert.strictEqual(m.okDay, '2026-10-25');
    assert.ok(!m.resolved, 'zelfde kalenderdag ondanks 23 uur verschil');
    assert.ok(s.okToday('k-test'));
    clock.now = at(2026, 10, 26, 0, 10);
    assert.ok(!s.okToday('k-test'));
    s.recordAnswer(item, true);
    assert.ok(m.resolved);
  });
  test('DST AC-14: goed om 23:30 op 24 okt en 00:30 op 25 okt (24 uur + 1 uur verschil) lost op', () => {
    const { RB, clock } = load(undefined, at(2026, 10, 24, 10));
    const s = RB.store;
    s.recordAnswer(item, false);
    clock.now = at(2026, 10, 24, 23, 30);
    s.recordAnswer(item, true);
    clock.now = at(2026, 10, 25, 0, 30);
    s.recordAnswer(item, true);
    assert.ok(s.state().mistakes['k-test'].resolved);
  });
  test('DST AC-15: fout op 25 okt 23:30 na goed om 00:30 dezelfde dag zet streak 0 en okDay null', () => {
    const { RB, clock } = load(undefined, at(2026, 10, 24, 20));
    const s = RB.store;
    s.recordAnswer(item, false);
    clock.now = at(2026, 10, 25, 0, 30);
    s.recordAnswer(item, true);
    clock.now += 23 * HOUR;
    s.recordAnswer(item, false);
    const m = s.state().mistakes['k-test'];
    assert.strictEqual(m.streak, 0);
    assert.strictEqual(m.okDay, null);
    clock.now = at(2026, 10, 26, 0, 10);
    s.recordAnswer(item, true);
    assert.ok(!m.resolved, 'na de fout begint het opnieuw');
  });
  test('DST AC-14: maart (23-uursdag, 28 mrt 2027): 00:30 en 23:30 dezelfde dag, blijft open', () => {
    const { RB, clock } = load(undefined, at(2027, 3, 28, 12));
    const s = RB.store;
    s.recordAnswer(item, false);
    clock.now = at(2027, 3, 28, 0, 30);
    s.recordAnswer(item, true);
    clock.now = at(2027, 3, 28, 23, 30);
    s.recordAnswer(item, true);
    assert.ok(!s.state().mistakes['k-test'].resolved);
    clock.now = at(2027, 3, 29, 0, 5);
    s.recordAnswer(item, true);
    assert.ok(s.state().mistakes['k-test'].resolved);
  });
} else {
  test('DST: alle logic-tests ook in TZ=Europe/Amsterdam (kindproces)', () => {
    const r = require('child_process').spawnSync(process.execPath, [__filename], { env: Object.assign({}, process.env, { TZ: 'Europe/Amsterdam' }), encoding: 'utf8' });
    const fails = (r.stdout || '').split('\n').filter((l, i, a) => /^FAIL/.test(l) || /^FAIL/.test(a[i - 1] || '')).join('\n');
    assert.strictEqual(r.status, 0, fails || r.stderr);
  });
}

if (failed) { console.error(failed + ' test(s) mislukt'); process.exit(1); }
console.log('Alle tests geslaagd.');
