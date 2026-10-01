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
  same(st.mistakes, { 'k-alarm': Object.assign({}, v2.mistakes['k-alarm'], { resolved: false }) });
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
test('clean: streak "x" met okDay telt als streak 0; één goed antwoord lost de fout niet op (AC-14)', () => {
  const { RB } = load({ version: 3, mistakes: { 'k-test': { count: 1, streak: 'x', okDay: '2026-09-01' } } });
  const s = RB.store;
  s.recordAnswer(item, true);
  const m = s.state().mistakes['k-test'];
  assert.ok(!m.resolved);
  assert.strictEqual(m.streak, 1);
  assert.strictEqual(m.okDay, '2026-09-28');
  assert.deepStrictEqual(s.openMistakes(), ['k-test']);
});
test('clean: streak 1 zonder geldige okDay telt als streak 0', () => {
  for (const okDay of [undefined, null, 7, '2026-13-01']) {
    const { RB } = load({ version: 3, mistakes: { 'k-test': { count: 1, streak: 1, okDay } } });
    RB.store.recordAnswer(item, true);
    assert.ok(!RB.store.state().mistakes['k-test'].resolved, String(okDay));
  }
});
test('clean: resolved "false" (string) blijft een open fout', () => {
  const { RB } = load({ version: 3, mistakes: { 'k-test': { count: 1, resolved: 'false' } } });
  assert.strictEqual(RB.store.state().mistakes['k-test'].resolved, false);
  assert.deepStrictEqual(RB.store.openMistakes(), ['k-test']);
});
test('clean: een geldige opgeloste fout blijft opgelost; streak 2 zonder resolved wordt 0', () => {
  const { RB } = load({ version: 3, mistakes: {
    a: { count: 2, streak: 2, okDay: '2026-09-20', resolved: true, given: 3 },
    b: { count: 1, streak: 2, okDay: '2026-09-20' }
  } });
  const st = RB.store.state();
  assert.strictEqual(st.mistakes.a.resolved, true);
  assert.strictEqual(st.mistakes.a.streak, 2);
  assert.strictEqual(st.mistakes.a.given, '3');
  assert.strictEqual(st.mistakes.b.streak, 0);
  assert.deepStrictEqual(RB.store.openMistakes(), ['b']);
});
test('clean: geldige streak 1 van gisteren lost op met één goed antwoord vandaag', () => {
  const { RB } = load({ version: 3, mistakes: { 'k-test': { count: 1, streak: 1, okDay: '2026-09-27', resolved: false } } });
  RB.store.recordAnswer(item, true);
  const m = RB.store.state().mistakes['k-test'];
  assert.ok(m.resolved);
  assert.strictEqual(m.streak, 2);
  assert.deepStrictEqual(RB.store.openMistakes(), []);
});

// ---------- Exam-ready loop, deel 3: plan, doel van vandaag, klaar voor het examen (test-engineer) ----------
// Alle tijden als lokale tijd, zodat de tests ook in TZ=Europe/Amsterdam kloppen. m = 1..12.
const T = (y, m, d, h = 12, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();
const SEP30 = T(2026, 9, 30);
// Testbank: mk('snelheid', 3) -> [{ id: 'snelheid-0', topic: 'snelheid', kind: 'mc' }, …].
const mk = (topic, n, kind = 'mc', from = 0) => Array.from({ length: n }, (_, i) => ({ id: topic + '-' + (from + i), topic, kind }));
const idsOf = (list) => list.map((x) => x.id);
const byId = (ids, f) => Object.fromEntries(ids.map((id, i) => [id, f(id, i)]));
const mis = (ids, last, extra) => byId(ids, () => Object.assign({ count: 1, streak: 0, last }, extra));
const cards = (ids, due) => byId(ids, () => ({ box: 1, due }));
const seenOn = (ids, day) => byId(ids, () => day);
const hist = (topic, n, ok, day = '2026-09-29') => Array.from({ length: n }, (_, i) => ({ id: topic + '-h' + i, ok: i < ok, day }));
const exam = (score, date = T(2026, 9, 29), total = 50, extra) => Object.assign({ date, score, total, passed: score >= 44, timeUp: false }, extra);
// De toestand zoals de app hem ziet (door clean()), met util en store uit dezelfde vm.
function setup(raw, now) {
  const env = load(raw, now || SEP30);
  return { U: env.RB.util, S: env.RB.store, st: env.RB.store.state(), clock: env.clock, data: env.data };
}
const planOf = (raw, bank, now) => { const { U, st } = setup(raw, now); return U.dayPlan(st, bank, now || SEP30); };
const NAMES3 = { snelheid: 'Snelheid', voorrang: 'Voorrang', verlichting: 'Verlichting', gedrag: 'Gedrag' };
const readyOf = (raw, bank, now) => { const { U, st } = setup(raw, now); return U.readiness(st, bank, now || SEP30, (t) => NAMES3[t] || t); };
const MOCK = 'proefexamen (30 min, zorg dat je niet gestoord wordt)';

// --- Plan: formule (AC-17 … AC-19) ---
test('AC-17: D = 15, U = 120 geeft 15 nieuwe (R = 7, ⌈120/8⌉)', () => {
  const r = load().RB.util.planRules({ mode: 'datum', days: 15 }, 120);
  assert.strictEqual(r.R, 7);
  assert.strictEqual(r.perDay, 15);
  assert.strictEqual(r.shortfall, false);
});
test('AC-17: volgende dag D = 14, U = 105 geeft weer 15 nieuwe (R = 7, ⌈105/7⌉), geen sprong', () => {
  const r = load().RB.util.planRules({ mode: 'datum', days: 14 }, 105);
  assert.strictEqual(r.R, 7);
  assert.strictEqual(r.perDay, 15);
});
test('AC-17: D = 35, U = 200 geeft 10 nieuwe (R = 14, ⌈200/21⌉)', () => {
  const r = load().RB.util.planRules({ mode: 'datum', days: 35 }, 200);
  assert.strictEqual(r.R, 14);
  assert.strictEqual(r.perDay, 10);
});
test('AC-17: dayPlan met datum 15 oktober op 30 september en 120 nooit geziene: 15 nieuw; op 1 oktober na 15 gezien weer 15', () => {
  const bank = mk('snelheid', 120);
  const p1 = planOf({ version: 3, examDate: '2026-10-15' }, bank);
  assert.strictEqual(p1.rules.D, 15);
  assert.strictEqual(p1.unseen, 120);
  assert.strictEqual(p1.fresh.length, 15);
  const p2 = planOf({ version: 3, examDate: '2026-10-15', seen: seenOn(idsOf(bank.slice(0, 15)), '2026-09-30') }, bank, T(2026, 10, 1));
  assert.strictEqual(p2.rules.D, 14);
  assert.strictEqual(p2.unseen, 105);
  assert.strictEqual(p2.fresh.length, 15);
  assert.ok(p2.fresh.every((id) => +id.split('-')[1] >= 15), 'alleen nog niet geziene');
});
test('AC-18: D = 4, U = 10 geeft 5 nieuwe (R = 2, ⌈10/2⌉)', () => {
  const r = load().RB.util.planRules({ mode: 'datum', days: 4 }, 10);
  assert.strictEqual(r.R, 2);
  assert.strictEqual(r.perDay, 5);
});
test('AC-19: D = 15, U = 200 geeft 20 nieuwe (plafond, niet 25) en de waarschuwing', () => {
  const U = load().RB.util;
  const r = U.planRules({ mode: 'datum', days: 15 }, 200);
  assert.strictEqual(r.perDay, 20);
  assert.strictEqual(r.shortfall, true);
  same(U.planNotes(r), ['Je haalt niet alle nieuwe vragen vóór je examen; overweeg een latere datum.']);
});
test('AC-19: precies op het plafond (⌈U/(D−R)⌉ = 20) is geen tekort; 21 wel', () => {
  const U = load().RB.util;
  const at20 = U.planRules({ mode: 'datum', days: 15 }, 160);
  assert.strictEqual(at20.perDay, 20);
  assert.strictEqual(at20.shortfall, false);
  assert.deepStrictEqual(U.planNotes(at20).length, 0);
  assert.strictEqual(U.planRules({ mode: 'datum', days: 15 }, 161).shortfall, true);
});
test('AC-19: het tekort schuift niet door: een gemiste dag (D 15 → 14, U blijft 200) blijft 20, niet 40', () => {
  const bank = mk('snelheid', 200);
  const p1 = planOf({ version: 3, examDate: '2026-10-15' }, bank);
  const p2 = planOf({ version: 3, examDate: '2026-10-15' }, bank, T(2026, 10, 1));
  assert.strictEqual(p1.fresh.length, 20);
  assert.strictEqual(p2.rules.D, 14);
  assert.strictEqual(p2.fresh.length, 20);
  assert.ok(p2.rules.shortfall);
});
test('AC-19: geen waarschuwing zonder examendatum, ook niet met veel nooit geziene', () => {
  const U = load().RB.util;
  const r = U.planRules({ mode: 'geen' }, 243);
  assert.strictEqual(r.perDay, 10);
  assert.strictEqual(r.shortfall, false);
  same(U.planNotes(r), ['Nog geen examendatum: 10 nieuwe vragen per dag.']);
});

// --- Plan: randgevallen van de formule ---
test('plan: U = 0 geeft 0 nieuwe en geen tekort, ook bij D = 2', () => {
  const U = load().RB.util;
  for (const days of [2, 15, 60]) {
    const r = U.planRules({ mode: 'datum', days }, 0);
    assert.strictEqual(r.perDay, 0, 'D ' + days);
    assert.strictEqual(r.shortfall, false, 'D ' + days);
  }
});
test('plan: D = 2 en D = 3 (R = 1): deler 1 en 2; kleine U blijft klein', () => {
  const U = load().RB.util;
  assert.strictEqual(U.planRules({ mode: 'datum', days: 2 }, 7).perDay, 7);
  assert.strictEqual(U.planRules({ mode: 'datum', days: 3 }, 7).perDay, 4);
  const r2 = U.planRules({ mode: 'datum', days: 2 }, 50);
  assert.strictEqual(r2.perDay, 20);
  assert.ok(r2.shortfall);
});
test('plan: reserve R = min(14, floor(D/2)) rond D = 28 en 29', () => {
  const U = load().RB.util;
  assert.strictEqual(U.planRules({ mode: 'datum', days: 28 }, 140).R, 14);
  assert.strictEqual(U.planRules({ mode: 'datum', days: 28 }, 140).perDay, 10);
  assert.strictEqual(U.planRules({ mode: 'datum', days: 29 }, 150).perDay, 10);
  assert.strictEqual(U.planRules({ mode: 'datum', days: 100 }, 243).R, 14);
});
test('plan: plafonds fouten 10 (D ≥ 15) / 20 (D ≤ 14), kaarten 10, proefexamen 7 / 4 / 2', () => {
  const U = load().RB.util;
  const r = (days) => U.planRules({ mode: 'datum', days }, 100);
  assert.strictEqual(r(15).mistakes, 10);
  assert.strictEqual(r(14).mistakes, 20);
  assert.strictEqual(r(2).mistakes, 20);
  for (const d of [2, 14, 15, 42, 43, 200]) assert.strictEqual(r(d).due, 10, 'kaarten D ' + d);
  assert.strictEqual(r(43).mockEvery, 7);
  assert.strictEqual(r(42).mockEvery, 4);
  assert.strictEqual(r(15).mockEvery, 4);
  assert.strictEqual(r(14).mockEvery, 2);
  assert.strictEqual(r(2).mockEvery, 2);
  const geen = U.planRules({ mode: 'geen' }, 100);
  assert.deepStrictEqual([geen.perDay, geen.mistakes, geen.due, geen.mockEvery], [10, 10, 10, 7]);
});
test('plan: voorbije precieze datum en voorbije maand rekenen als "niet gepland"', () => {
  const U = load().RB.util;
  const past = U.planRules(U.examInfo('2026-09-29', null, SEP30), 50);
  assert.strictEqual(past.mode, 'geen');
  assert.strictEqual(past.perDay, 10);
  const ended = U.planRules(U.examInfo(null, '2026-08', SEP30), 50);
  assert.strictEqual(ended.mode, 'geen');
});
test('plan: maandmodus over de 1e: 31 okt 23:59 nog plan naar 1 nov (D = 1, formule), 1 nov 00:00 onderhoud', () => {
  const U = load().RB.util;
  const before = U.planRules(U.examInfo(null, '2026-11', T(2026, 10, 31, 23, 59)), 10);
  assert.strictEqual(before.mode, 'maand');
  assert.strictEqual(before.D, 1);
  assert.strictEqual(before.perDay, 10, 'maand D = 1 volgt de formule, niet de AC-25-regel');
  assert.strictEqual(before.mistakes, 20);
  assert.strictEqual(before.mockEvery, 2);
  const on = U.planRules(U.examInfo(null, '2026-11', T(2026, 11, 1, 0, 0)), 10);
  assert.strictEqual(on.mode, 'onderhoud');
  assert.strictEqual(on.perDay, 0);
  assert.strictEqual(U.planRules(U.examInfo(null, '2026-11', T(2026, 11, 30, 23, 59)), 10).mode, 'onderhoud');
  assert.strictEqual(U.planRules(U.examInfo(null, '2026-11', T(2026, 12, 1, 0, 0)), 10).mode, 'geen');
});
test('plan: maand vóór de 1e met tekort toont alleen de tekortregel (geen modusregel)', () => {
  const U = load().RB.util;
  const r = U.planRules(U.examInfo(null, '2026-10', T(2026, 9, 25)), 200); // D = 6
  assert.strictEqual(r.mode, 'maand');
  same(U.planNotes(r), ['Je haalt niet alle nieuwe vragen vóór je examen; overweeg een latere datum.']);
});
test('plan: precieze datum om middernacht: 30 sep 23:59 is D = 2 (nieuw + proefexamen), 1 okt 00:00 is D = 1', () => {
  const U = load().RB.util;
  const d2 = U.planRules(U.examInfo('2026-10-02', null, T(2026, 9, 30, 23, 59)), 10);
  assert.strictEqual(d2.D, 2);
  assert.strictEqual(d2.perDay, 10);
  assert.strictEqual(d2.mockEvery, 2);
  const d1 = U.planRules(U.examInfo('2026-10-02', null, T(2026, 10, 1, 0, 0)), 10);
  assert.strictEqual(d1.D, 1);
  assert.strictEqual(d1.perDay, 0);
  assert.strictEqual(d1.mockEvery, 0);
});

// --- Plan: inhoud (AC-20 … AC-22) ---
test('AC-20: nooit geziene voorrangssituaties tellen in U en komen als nieuwe vraag in het plan', () => {
  const bank = mk('snelheid', 5).concat(mk('voorrang', 5, 'voorrang'));
  const p = planOf({ version: 3, mistakes: mis(['snelheid-0'], T(2026, 9, 20)) }, bank);
  assert.strictEqual(p.unseen, 9);
  assert.ok(p.fresh.includes('voorrang-0') && p.fresh.filter((id) => /^voorrang/.test(id)).length === 5, JSON.stringify(p.fresh));
});
test('AC-20: een voorrangssituatie met een (oude) kaart komt nooit bij de kaarten', () => {
  const bank = mk('voorrang', 2, 'voorrang').concat(mk('borden', 2, 'sign'));
  const p = planOf({ version: 3, srs: cards(idsOf(bank), T(2026, 9, 29)) }, bank);
  same(p.due, ['borden-0', 'borden-1']);
});
test('AC-20: voorrang die vóór deze functie al eens gedaan was (done, geen seen) telt als nooit gezien', () => {
  const bank = mk('voorrang', 3, 'voorrang');
  const p = planOf({ version: 3, done: { 'voorrang-0': true, 'voorrang-1': false } }, bank);
  assert.strictEqual(p.unseen, 3);
});
test('plan: nieuwe vragen eerst uit het onderwerp met de meeste open fouten', () => {
  const bank = mk('snelheid', 12).concat(mk('voorrang', 12, 'voorrang'));
  const raw = { version: 3, mistakes: mis(['voorrang-0', 'voorrang-1', 'snelheid-0'], T(2026, 9, 20)) };
  const p = planOf(raw, bank);
  assert.strictEqual(p.weak, 'voorrang');
  assert.ok(p.fresh.slice(0, 10).every((id) => /^voorrang/.test(id)), JSON.stringify(p.fresh));
});
test('AC-21: A (streak 1, gisteren goed), B (fout 20 sep), C (fout 25 sep) → A, B, C', () => {
  const { U, st } = setup({ version: 3, mistakes: {
    A: { count: 1, streak: 1, okDay: '2026-09-29', last: T(2026, 9, 28) },
    B: { count: 1, streak: 0, last: T(2026, 9, 20) },
    C: { count: 1, streak: 0, last: T(2026, 9, 25) }
  } });
  same(U.orderMistakes(st.mistakes, ['C', 'A', 'B'], '2026-09-30'), ['A', 'B', 'C']);
  const bank = [{ id: 'C', topic: 't', kind: 'mc' }, { id: 'B', topic: 't', kind: 'mc' }, { id: 'A', topic: 't', kind: 'mc' }];
  same(U.dayPlan(st, bank, SEP30).mistakes, ['A', 'B', 'C']);
});
test('AC-21: fout zonder `last` telt als oudste; streak 1 van vandaag zit niet in het plan (AC-16)', () => {
  const { U, st } = setup({ version: 3, mistakes: {
    nu: { count: 1, streak: 1, okDay: '2026-09-30', last: T(2026, 9, 1) },
    oud: { count: 1, streak: 0, last: T(2026, 9, 10) },
    geen: { count: 1 }
  } });
  same(U.orderMistakes(st.mistakes, ['oud', 'geen'], '2026-09-30'), ['geen', 'oud']);
  const bank = ['nu', 'oud', 'geen'].map((id) => ({ id, topic: 't', kind: 'mc' }));
  same(U.dayPlan(st, bank, SEP30).mistakes, ['geen', 'oud']);
});
test('AC-21: plafond 10 neemt de eerste 10 in AC-21-volgorde; opgeloste en verwijderde fouten doen niet mee', () => {
  const bank = mk('gedrag', 14);
  const ms = {};
  bank.forEach((x, i) => { ms[x.id] = { count: 1, streak: 0, last: T(2026, 9, 1 + i) }; });
  ms['gedrag-13'] = { count: 1, streak: 1, okDay: '2026-09-29', last: T(2026, 9, 29) };
  ms['gedrag-0'] = { count: 1, streak: 2, resolved: true, okDay: '2026-09-02', last: T(2026, 9, 1) };
  ms['weg-1'] = { count: 1, streak: 0, last: T(2026, 8, 1) };
  const p = planOf({ version: 3, mistakes: ms }, bank);
  same(p.mistakes, ['gedrag-13', 'gedrag-1', 'gedrag-2', 'gedrag-3', 'gedrag-4', 'gedrag-5', 'gedrag-6', 'gedrag-7', 'gedrag-8', 'gedrag-9']);
});
test('AC-22: terug na 26 sep, D = 35, U = 200, 35 fouten, 40 kaarten → 10 + 10 + 10 en "Welkom terug." zonder achterstand', () => {
  const fresh = mk('snelheid', 200), wrong = mk('gedrag', 35), due = mk('borden', 40, 'sign');
  const bank = fresh.concat(wrong, due);
  const raw = {
    version: 3, examDate: '2026-11-04',
    mistakes: mis(idsOf(wrong), T(2026, 9, 26, 10), { topic: 'gedrag' }),
    srs: cards(idsOf(due), T(2026, 9, 27, 0)),
    seen: seenOn(idsOf(wrong).concat(idsOf(due)), '2026-09-26'),
    history: { gedrag: hist('gedrag', 20, 0, '2026-09-26') },
    exams: [exam(40, T(2026, 9, 26, 9))]
  };
  const { U, st } = setup(raw);
  const p = U.dayPlan(st, bank, SEP30);
  assert.strictEqual(p.rules.D, 35);
  assert.strictEqual(p.unseen, 200);
  assert.deepStrictEqual([p.fresh.length, p.mistakes.length, p.due.length, p.total], [10, 10, 10, 30]);
  assert.strictEqual(p.welcome, true);
  assert.strictEqual(p.mock, true, 'cadans 4, laatste 26 sep');
  const s = U.todayStatus({ target: p.target, practised: 0, mock: p.mock, mockDone: false, available: p.target, welcome: p.welcome });
  assert.strictEqual(s.line, 'Welkom terug. Vandaag: 15 vragen (± 10 min) + ' + MOCK);
  assert.ok(!/35|40/.test(s.line));
  assert.strictEqual(U.planDetail(p.mistakes.length, p.due.length, p.fresh.length, ''), '10 fouten · 10 kaarten · 10 nieuwe vragen');
});
test('AC-22: "Welkom terug." alleen als de laatste activiteit van vóór gisteren is', () => {
  const bank = mk('snelheid', 5);
  const w = (seen) => planOf({ version: 3, seen }, bank).welcome;
  assert.strictEqual(w({ 'snelheid-0': '2026-09-28' }), true, 'eergisteren');
  assert.strictEqual(w({ 'snelheid-0': '2026-09-29' }), false, 'gisteren');
  assert.strictEqual(w({ 'snelheid-0': '2026-09-30' }), false, 'vandaag');
  assert.strictEqual(w({}), false, 'nooit iets gedaan: geen welkom');
  assert.strictEqual(w({ 'snelheid-0': '2026-09-20', 'snelheid-1': '2026-09-30' }), false, 'nieuwste dag telt');
});
test('AC-22: laatste activiteit komt uit history én seen (flashcard vandaag = geen welkom)', () => {
  const { U, st } = setup({ version: 3, history: { gedrag: hist('gedrag', 3, 1, '2026-09-26') }, seen: { k: '2026-09-30' } });
  assert.strictEqual(U.lastActivity(st), '2026-09-30');
  const { U: U2, st: st2 } = setup({ version: 3, history: { gedrag: hist('gedrag', 3, 1, '2026-09-26') } });
  assert.strictEqual(U2.lastActivity(st2), '2026-09-26');
  assert.strictEqual(U2.lastActivity({ history: { x: [null, { day: '2026-02-31' }, { day: 5 }] }, seen: { a: 'nope' } }), null);
});
test('AC-22: "Welkom terug." verdwijnt zodra er vandaag iets gedaan is', () => {
  const U = load().RB.util;
  assert.strictEqual(U.todayStatus({ target: 30, practised: 0, available: 30, welcome: true }).line, 'Welkom terug. Vandaag: 30 vragen (± 15 min)');
  assert.strictEqual(U.todayStatus({ target: 30, practised: 1, available: 29, welcome: true }).line, 'Vandaag: 30 vragen (± 15 min) · 1 gedaan');
});

// --- Proefexamen-ritme (AC-23, AC-24) ---
test('AC-23: nooit een proefexamen → vandaag aan de beurt als nulmeting', () => {
  const p = planOf({ version: 3 }, mk('snelheid', 20));
  assert.strictEqual(p.mock, true);
  assert.strictEqual(p.nulmeting, true);
  const q = planOf({ version: 3, exams: [exam(40, T(2026, 9, 1))] }, mk('snelheid', 20));
  assert.strictEqual(q.mock, true, '29 dagen geleden, cadans 7');
  assert.strictEqual(q.nulmeting, false);
});
test('AC-23: cadans 4, laatste 27 sep: niet op 30 sep, wel op 1 okt, nog steeds op 2 okt', () => {
  const U = load().RB.util;
  const exams = [exam(40, T(2026, 9, 27, 20))];
  const rules = { mockEvery: 4 };
  assert.strictEqual(U.mockDue(rules, exams, '2026-09-30'), false);
  assert.strictEqual(U.mockDue(rules, exams, '2026-10-01'), true);
  assert.strictEqual(U.mockDue(rules, exams, '2026-10-02'), true);
  const raw = { version: 3, examDate: '2026-11-01', exams };
  const bank = mk('snelheid', 50);
  const p30 = planOf(raw, bank, SEP30), p1 = planOf(raw, bank, T(2026, 10, 1)), p2 = planOf(raw, bank, T(2026, 10, 2));
  assert.deepStrictEqual([p30.rules.mockEvery, p1.rules.mockEvery, p2.rules.mockEvery], [4, 4, 4]);
  assert.deepStrictEqual([p30.mock, p1.mock, p2.mock], [false, true, true]);
});
test('AC-23: een doorgeschoven proefexamen heeft dezelfde tekst (geen herinnering of "te laat")', () => {
  const U = load().RB.util;
  const o = { target: 6, practised: 0, mock: true, mockDone: false, available: 6 };
  const day1 = U.todayStatus(o).line, day2 = U.todayStatus(o).line;
  assert.strictEqual(day1, 'Vandaag: 6 vragen (± 5 min) + ' + MOCK);
  assert.strictEqual(day2, day1);
});
test('AC-23: een proefexamen waarbij de tijd om was, telt als laatste proefexamen', () => {
  const U = load().RB.util;
  const exams = [exam(40, T(2026, 9, 20)), exam(12, T(2026, 9, 29), 50, { timeUp: true })];
  assert.strictEqual(U.mockDue({ mockEvery: 4 }, exams, '2026-09-30'), false);
  assert.strictEqual(U.mockDue({ mockEvery: 0 }, [], '2026-09-30'), false, 'mockEvery 0: nooit, ook geen nulmeting');
});
test('AC-23: examens met kapotte datum tellen niet als laatste proefexamen', () => {
  const U = load().RB.util;
  assert.strictEqual(U.mockDue({ mockEvery: 7 }, [{ date: 'x' }, null, { date: NaN }], '2026-09-30'), true);
});
test('AC-24: plan van 30 vragen met proefexamen → doel 15, "Vandaag: 15 vragen (± 10 min) + proefexamen (…)"', () => {
  const bank = mk('snelheid', 200).concat(mk('gedrag', 10), mk('borden', 10, 'sign'));
  const raw = { version: 3, examDate: '2026-11-04', mistakes: mis(idsOf(mk('gedrag', 10)), T(2026, 9, 29)), srs: cards(idsOf(mk('borden', 10, 'sign')), T(2026, 9, 29)) };
  const { U, st } = setup(raw);
  const p = U.dayPlan(st, bank, SEP30);
  assert.strictEqual(p.total, 30);
  assert.strictEqual(p.mock, true);
  assert.strictEqual(p.target, 15);
  same(p.order.slice(0, 15), p.mistakes.concat(p.due.slice(0, 5)), 'planvolgorde: fouten, kaarten, nieuwe');
  assert.strictEqual(U.todayStatus({ target: 15, practised: 0, mock: true, mockDone: false, available: 15 }).line,
    'Vandaag: 15 vragen (± 10 min) + proefexamen (30 min, zorg dat je niet gestoord wordt)');
});
test('AC-24: zonder proefexamen blijft het 30 vragen, "± 15 min"', () => {
  const bank = mk('snelheid', 200).concat(mk('gedrag', 10), mk('borden', 10, 'sign'));
  const raw = { version: 3, examDate: '2026-11-04', exams: [exam(40, T(2026, 9, 29))],
    mistakes: mis(idsOf(mk('gedrag', 10)), T(2026, 9, 29)), srs: cards(idsOf(mk('borden', 10, 'sign')), T(2026, 9, 29)) };
  const { U, st } = setup(raw);
  const p = U.dayPlan(st, bank, SEP30);
  assert.strictEqual(p.mock, false);
  assert.strictEqual(p.target, 30);
  assert.strictEqual(U.todayStatus({ target: 30, practised: 0, mock: false, available: 30 }).line, 'Vandaag: 30 vragen (± 15 min)');
});
test('AC-24: halveren rondt naar boven af (31 → 16, 1 → 1)', () => {
  const bank = mk('snelheid', 7);
  const p = planOf({ version: 3 }, bank); // niet gepland: 7 nieuwe, nulmeting
  assert.deepStrictEqual([p.total, p.mock, p.target], [7, true, 4]);
  const one = planOf({ version: 3, mistakes: mis(['snelheid-0'], T(2026, 9, 1)), seen: seenOn(idsOf(bank), '2026-09-01') }, bank);
  assert.strictEqual(one.total, 1);
  assert.strictEqual(one.target, 1);
});
test('minuten: 30 s per vraag, naar boven op 5 minuten; minstens 5 bij 1 vraag', () => {
  const { minutes } = load().RB.util;
  same([0, 1, 10, 11, 15, 20, 21, 30].map(minutes), [0, 5, 5, 10, 10, 10, 15, 15]);
});

// --- Eindspurt en onderhoud (AC-25, AC-26) ---
test('AC-25: datum morgen (D = 1) met 14 open fouten: alleen die 14, geen nieuwe, geen kaarten, geen proefexamen', () => {
  const wrong = mk('gedrag', 14);
  const bank = wrong.concat(mk('snelheid', 50), mk('borden', 5, 'sign'));
  const raw = { version: 3, examDate: '2026-10-01', mistakes: mis(idsOf(wrong), T(2026, 9, 20)), srs: cards(idsOf(mk('borden', 5, 'sign')), T(2026, 9, 29)) };
  const { U, st } = setup(raw);
  const p = U.dayPlan(st, bank, SEP30);
  assert.strictEqual(p.rules.D, 1);
  assert.deepStrictEqual([p.mistakes.length, p.due.length, p.fresh.length, p.total, p.target], [14, 0, 0, 14, 14]);
  assert.strictEqual(p.mock, false, 'ook geen nulmeting');
  same(U.planNotes(p.rules), ['Morgen is je examen. Vandaag alleen je open fouten, geen nieuwe vragen en geen proefexamen.']);
});
test('AC-25: D = 1 met 25 open fouten: hoogstens 20', () => {
  const wrong = mk('gedrag', 25);
  assert.strictEqual(planOf({ version: 3, examDate: '2026-10-01', mistakes: mis(idsOf(wrong), T(2026, 9, 20)) }, wrong).mistakes.length, 20);
});
test('AC-25: datum vandaag (D = 0): hoogstens 10 open fouten, geen proefexamen', () => {
  const wrong = mk('gedrag', 14);
  const { U, st } = setup({ version: 3, examDate: '2026-09-30', mistakes: mis(idsOf(wrong), T(2026, 9, 20)) });
  const p = U.dayPlan(st, wrong.concat(mk('snelheid', 10)), SEP30);
  assert.strictEqual(p.rules.D, 0);
  assert.deepStrictEqual([p.mistakes.length, p.fresh.length, p.due.length], [10, 0, 0]);
  assert.strictEqual(p.mock, false);
  same(U.planNotes(p.rules), ['Vandaag is je examen. Wil je nog iets doen? Herhaal dan alleen een paar fouten.']);
});
test('AC-25: D ≤ 1 zonder open fouten: "Geen open fouten meer. Rust goed uit en succes!"', () => {
  const U = load().RB.util;
  const s = U.todayStatus({ target: 0, practised: 0, mock: false, mockDone: false, available: 0, rest: true });
  assert.strictEqual(s.state, 'rust');
  assert.strictEqual(s.line, 'Geen open fouten meer. Rust goed uit en succes!');
});
test('AC-26: maand november op 2 november: onderhoud, geen nieuwe, fouten max 20, kaarten max 10, om de 2 dagen', () => {
  const wrong = mk('gedrag', 25), due = mk('borden', 15, 'sign');
  const bank = wrong.concat(due, mk('snelheid', 50));
  const raw = { version: 3, examMonth: '2026-11', mistakes: mis(idsOf(wrong), T(2026, 10, 20)), srs: cards(idsOf(due), T(2026, 11, 1)), exams: [exam(45, T(2026, 10, 31))] };
  const { U, st } = setup(raw, T(2026, 11, 2));
  const p = U.dayPlan(st, bank, T(2026, 11, 2));
  assert.strictEqual(p.rules.mode, 'onderhoud');
  assert.deepStrictEqual([p.fresh.length, p.mistakes.length, p.due.length], [0, 20, 10]);
  assert.strictEqual(p.rules.mockEvery, 2);
  assert.strictEqual(p.mock, true, 'laatste 31 okt, 2 dagen');
  same(U.planNotes(p.rules), ['Je examen kan nu elke dag zijn. Daarom geen nieuwe vragen meer: alleen herhalen, en om de 2 dagen een proefexamen.']);
  const q = planOf(Object.assign({}, raw, { exams: [exam(45, T(2026, 11, 1))] }), bank, T(2026, 11, 2));
  assert.strictEqual(q.mock, false, 'laatste 1 nov, 1 dag');
});

// --- Doelregel en "gedaan" (AC-27, AC-28) ---
test('AC-27: "Vandaag: 30 vragen (± 15 min) · 12 gedaan"', () => {
  const s = load().RB.util.todayStatus({ target: 30, practised: 12, mock: false, available: 18 });
  assert.strictEqual(s.state, 'bezig');
  assert.strictEqual(s.line, 'Vandaag: 30 vragen (± 15 min) · 12 gedaan');
});
test('AC-27: vragen klaar, proefexamen nog niet: proefexamen blijft in de regel', () => {
  const s = load().RB.util.todayStatus({ target: 15, practised: 15, mock: true, mockDone: false, available: 0 });
  assert.strictEqual(s.state, 'examen');
  assert.strictEqual(s.mockLeft, true);
  assert.strictEqual(s.line, 'Vandaag: 15 vragen (± 10 min) + ' + MOCK + ' · 15 gedaan');
});
test('AC-27: vragen en proefexamen klaar: "Doel van vandaag gehaald · 32 gedaan"', () => {
  const U = load().RB.util;
  const a = U.todayStatus({ target: 15, practised: 32, mock: true, mockDone: true, available: 0 });
  assert.strictEqual(a.state, 'gehaald');
  assert.strictEqual(a.line, 'Doel van vandaag gehaald · 32 gedaan');
  const b = U.todayStatus({ target: 30, practised: 30, mock: false, available: 0 });
  assert.strictEqual(b.line, 'Doel van vandaag gehaald · 30 gedaan');
});
test('AC-27: proefexamen klaar maar vragen niet: nog bezig, zonder proefexamen in de regel', () => {
  const s = load().RB.util.todayStatus({ target: 15, practised: 3, mock: true, mockDone: true, available: 12 });
  assert.strictEqual(s.state, 'bezig');
  assert.strictEqual(s.line, 'Vandaag: 15 vragen (± 10 min) · 3 gedaan');
});
test('AC-27: doel 0 met proefexamen: "Vandaag: proefexamen (…)"; doel 0 zonder iets: niets klaar', () => {
  const U = load().RB.util;
  assert.strictEqual(U.todayStatus({ target: 0, practised: 0, mock: true, mockDone: false, available: 0 }).line, 'Vandaag: ' + MOCK);
  const leeg = U.todayStatus({ target: 0, practised: 0, mock: false, available: 0 });
  assert.strictEqual(leeg.state, 'leeg');
  assert.strictEqual(leeg.line, 'Vandaag staat er niets klaar. Doe een proefexamen of kom morgen terug.');
});
test('AC-27: enkelvoud "1 vraag"', () => {
  assert.strictEqual(load().RB.util.todayStatus({ target: 1, practised: 0, available: 1 }).line, 'Vandaag: 1 vraag (± 5 min)');
});
test('AC-27/AC-2: "gedaan" telt het eerste antwoord per vraag per dag, uit elke sessie', () => {
  const { S } = setup({ version: 3 });
  S.setToday(30, false);
  S.recordAnswer({ id: 'a', topic: 'snelheid' }, true);
  S.recordAnswer({ id: 'a', topic: 'snelheid' }, false);
  S.recordAnswer({ id: 'a', topic: 'snelheid' }, true);
  assert.strictEqual(S.today().practised, 1, 'dezelfde vraag 3× is 1 gedaan');
  S.recordAnswer({ id: 'b', topic: 'borden' }, false, 'x');
  S.recordAnswer({ id: 'c', topic: 'voorrang' }, true);
  assert.strictEqual(S.today().practised, 3);
});
test('AC-27: antwoorden uit een proefexamen tellen niet als "gedaan" (wel history, seen en fouten)', () => {
  const { S } = setup({ version: 3 });
  S.setToday(10, true);
  S.recordAnswer({ id: 'e1', topic: 'snelheid' }, true, null, true);
  S.recordAnswer({ id: 'e2', topic: 'snelheid' }, false, 'x', true);
  const st = S.state();
  assert.strictEqual(S.today().practised, 0);
  assert.strictEqual(st.history.snelheid.length, 2);
  assert.ok(st.seen.e1 && st.seen.e2);
  assert.deepStrictEqual(S.openMistakes(), ['e2']);
});
test('AC-27: flashcard-zelfbeoordeling telt niet als "gedaan"', () => {
  const { S } = setup({ version: 3 });
  S.setToday(10, false);
  S.recordStat(true, 'kaart-1');
  assert.strictEqual(S.today().practised, 0);
});
test('AC-27: zonder vastgezet doel telt recordAnswer nog niet op, maar setToday neemt het daarna mee (practisedDay)', () => {
  const { S } = setup({ version: 3, today: { day: '2026-09-29', target: 10, mock: false, practised: 10 } });
  S.recordAnswer({ id: 'bord-x', topic: 'borden' }, true);
  assert.strictEqual(S.today(), null, 'doel van gisteren geldt niet vandaag');
  assert.strictEqual(S.state().today.practised, 10, 'gisteren wordt niet opgehoogd');
  S.setToday(20, false); // wat app.js doet vóór elk antwoord in een sessie
  assert.strictEqual(S.today().practised, 1, 'bord-x van vóór het vastzetten telt mee');
  S.recordAnswer({ id: 'bord-y', topic: 'borden' }, true);
  same(S.today(), { day: '2026-09-30', target: 20, mock: false, practised: 2 });
});
// Na een proefexamen bestaat het plan eerst uit de net gemaakte examenfouten; die tellen toch als "gedaan",
// want "gedaan" is het eerste antwoord per vraag per dag búiten een proefexamen (los van de AC-2-geschiedenis).
test('AC-27: na een proefexamen telt een ronde Vandaag (uit het plan) gewoon als "gedaan"', () => {
  const { U, S } = setup(undefined);
  const bank = Array.from({ length: 60 }, (_, i) => ({ id: 'q' + i, topic: 't' + (i % 3), kind: 'mc' }));
  let p = U.dayPlan(S.state(), bank, SEP30);
  S.setToday(p.target, p.mock); // eerste gebruik: 5 vragen + nulmeting
  bank.slice(0, 50).forEach((x, i) => S.recordAnswer(x, i >= 20, 'x', true)); // nulmeting eerst: 20 fout
  S.addExam({ date: SEP30, score: 30, total: 50, passed: false, timeUp: false });
  p = U.dayPlan(S.state(), bank, SEP30);
  const round = p.order.slice(0, S.today().target - S.today().practised);
  assert.strictEqual(round.length, 5);
  round.forEach((id) => S.recordAnswer(bank.find((x) => x.id === id), true));
  assert.strictEqual(S.today().practised, 5, 'ronde ' + JSON.stringify(round) + ' telde niet: "checked answers outside a mock exam" (AC-27)');
});
test('AC-28: doel van vandaag ligt vast; een nieuwe examendatum rekent opnieuw, "gedaan" blijft', () => {
  const { S, clock } = setup({ version: 3 });
  assert.strictEqual(S.today(), null, 'eerste gebruik: nog geen doel');
  S.setToday(30, true);
  for (const id of ['a', 'b', 'c']) S.recordAnswer({ id, topic: 'gedrag' }, true);
  same(S.today(), { day: '2026-09-30', target: 30, mock: true, practised: 3 });
  S.setToday(12, false); // nieuwe datum
  same(S.today(), { day: '2026-09-30', target: 12, mock: false, practised: 3 });
  clock.now = T(2026, 10, 1, 0, 0);
  assert.strictEqual(S.today(), null, 'volgende dag: opnieuw uitrekenen');
  same(S.setToday(20, true), { day: '2026-10-01', target: 20, mock: true, practised: 0 });
});
test('AC-28: het doel blijft 30 als fouten worden opgelost (plan krimpt, opgeslagen doel niet), ook na herladen', () => {
  const wrong = mk('gedrag', 30);
  const raw = { version: 3, mistakes: mis(idsOf(wrong), T(2026, 9, 20), { streak: 1, okDay: '2026-09-29' }), exams: [exam(40, T(2026, 9, 29))] };
  const env = load(raw, SEP30);
  const S = env.RB.store, U = env.RB.util;
  const p = U.dayPlan(S.state(), wrong, SEP30);
  S.setToday(p.target, p.mock);
  assert.strictEqual(S.today().target, 10, 'plafond 10 zonder datum');
  for (const x of wrong.slice(0, 10)) S.recordAnswer(x, true); // opgelost (gisteren al goed)
  assert.strictEqual(U.dayPlan(S.state(), wrong, SEP30).mistakes.length, 10, 'het plan schuift door');
  assert.strictEqual(S.today().target, 10);
  assert.strictEqual(S.today().practised, 10);
  const again = load(env.data['rijbewijs-b-v1'], SEP30 + HOUR).RB.store;
  same(again.today(), { day: '2026-09-30', target: 10, mock: false, practised: 10 });
});
test('AC-28: nieuwe datum midden op de dag: nieuw doel = al gedaan + doel voor wat er nog in het plan staat', () => {
  const wrong = mk('gedrag', 10);
  const fresh = mk('borden', 80);
  const bank = wrong.concat(fresh);
  const raw = { version: 3, mistakes: mis(idsOf(wrong), T(2026, 9, 20)), seen: seenOn(idsOf(wrong), '2026-09-20'), exams: [exam(40, T(2026, 9, 29))] };
  const { U, S } = setup(raw);
  const p = U.dayPlan(S.state(), bank, SEP30); // geen datum: 10 fouten + 10 nieuwe, geen proefexamen
  assert.deepStrictEqual([p.mistakes.length, p.fresh.length, p.mock, p.target], [10, 10, false, 20]);
  S.setToday(p.target, p.mock);
  for (const x of wrong) S.recordAnswer(x, true);
  assert.strictEqual(S.today().practised, 10);
  S.setExamDate('2026-10-15'); // D = 15, U = 80: 10 nieuwe per dag, proefexamen om de 4 dagen (gisteren gedaan)
  const t = U.replanToday(S.state(), bank, SEP30);
  same(t, { target: 20, mock: false });
  S.setToday(t.target, t.mock);
  same(S.today(), { day: '2026-09-30', target: 20, mock: false, practised: 10 });
  const st = U.todayStatus({ target: 20, practised: 10, mock: false, available: U.dayPlan(S.state(), bank, SEP30).order.length });
  assert.strictEqual(st.state, 'bezig', 'niet al "gehaald" na 10 van de 20');
  // Halveren voor een proefexamen geldt alleen voor het restant: 10 gedaan + ⌈10/2⌉.
  const withMock = setup(Object.assign({}, raw, { exams: [] }));
  withMock.S.setToday(20, true);
  for (const x of wrong) withMock.S.recordAnswer(x, true);
  withMock.S.setExamDate('2026-10-15');
  same(withMock.U.replanToday(withMock.S.state(), bank, SEP30), { target: 15, mock: true });
});
test('AC-27/35: clean: practisedDay alleen met geldige dag, eigen sleutels en waarde true', () => {
  const raw = '{"version":3,"practisedDay":{"day":"2026-09-30","ids":{"a":true,"b":1,"__proto__":true,"constructor":true,"c":"true"}}}';
  same(setup(raw).st.practisedDay, { day: '2026-09-30', ids: { a: true } });
  for (const practisedDay of [null, 'x', [], { day: '2026-02-31', ids: {} }, { day: '2026-09-30', ids: [] }, { day: '2026-09-30' }]) {
    assert.strictEqual(setup({ version: 3, practisedDay }).st.practisedDay, null, JSON.stringify(practisedDay));
  }
  // Een lijst van gisteren telt vandaag niet: hetzelfde id telt vandaag weer als "gedaan".
  const { S } = setup({ version: 3, practisedDay: { day: '2026-09-29', ids: { a: true } } });
  S.setToday(5, false);
  S.recordAnswer({ id: 'a', topic: 'snelheid' }, true);
  assert.strictEqual(S.today().practised, 1);
});
test('AC-28: setToday met rommel: NaN/negatief → 0, kommagetal naar beneden, mock als boolean', () => {
  const { S } = setup({ version: 3 });
  assert.strictEqual(S.setToday('abc', 'ja').target, 0);
  assert.strictEqual(S.today().mock, true);
  assert.strictEqual(S.setToday(-5, 0).target, 0);
  assert.strictEqual(S.today().mock, false);
  assert.strictEqual(S.setToday(12.7).target, 12);
  assert.strictEqual(S.setToday(Infinity).target, 0);
});

// --- Plan-detail ---
test('plandetail: "5 fouten · 4 kaarten · 6 nieuwe vragen (vooral voorrang)", enkelvoud en weglaten', () => {
  const { planDetail } = load().RB.util;
  assert.strictEqual(planDetail(5, 4, 6, 'voorrang'), '5 fouten · 4 kaarten · 6 nieuwe vragen (vooral voorrang)');
  assert.strictEqual(planDetail(1, 1, 1, ''), '1 fout · 1 kaart · 1 nieuwe vraag');
  assert.strictEqual(planDetail(0, 3, 0, 'voorrang'), '3 kaarten');
  assert.strictEqual(planDetail(0, 0, 0, ''), '');
});

// --- Klaar voor het examen? (AC-29 … AC-32, AC-34) ---
const RBANK = mk('snelheid', 3).concat(mk('voorrang', 3, 'voorrang'));
const readyRaw = () => ({ version: 3, history: { snelheid: hist('snelheid', 20, 20), voorrang: hist('voorrang', 20, 18) }, exams: [exam(46, T(2026, 9, 20)), exam(47, T(2026, 9, 25)), exam(50, T(2026, 9, 29))] });
test('AC-29/AC-31: alle drie gehaald → "Klaar volgens deze app" met cijfers per eis', () => {
  const r = readyOf(readyRaw(), RBANK);
  assert.strictEqual(r.status, 'klaar');
  assert.strictEqual(r.headline, 'Klaar volgens deze app');
  assert.strictEqual(r.eis1.text, 'Laatste 3: 46, 47, 50');
  assert.strictEqual(r.eis2.text, 'Alle 2 onderwerpen 90% of meer');
  assert.strictEqual(r.eis3.text, 'Geen open fouten');
  assert.ok(r.eis1.met && r.eis2.met && r.eis3.met);
});
test('AC-29: eis 1 "2 van 3 gedaan, laagste 45" en "0 van 3 gedaan"', () => {
  const raw = readyRaw();
  raw.exams = [exam(47, T(2026, 9, 20)), exam(45, T(2026, 9, 25))];
  assert.strictEqual(readyOf(raw, RBANK).eis1.text, '2 van 3 gedaan, laagste 45');
  raw.exams = [];
  assert.strictEqual(readyOf(raw, RBANK).eis1.text, '0 van 3 gedaan');
});
test('AC-29: eis 1 met 3 gedaan en niet gehaald: "Laatste 3: 47, 45, 48 (laagste 45)", oudste eerst', () => {
  const raw = readyRaw();
  raw.exams = [exam(30, T(2026, 9, 1)), exam(47, T(2026, 9, 20)), exam(45, T(2026, 9, 25)), exam(48, T(2026, 9, 29))];
  const r = readyOf(raw, RBANK);
  assert.strictEqual(r.eis1.text, 'Laatste 3: 47, 45, 48 (laagste 45)');
  assert.strictEqual(r.eis1.met, false);
});
test('AC-29: eis 3 op 30 september: "3 fouten van vóór 28 september" (zonder last telt als oud, 28 sep niet)', () => {
  const bank = RBANK.concat(mk('gedrag', 5));
  const raw = readyRaw();
  raw.mistakes = {
    'gedrag-0': { count: 1, last: T(2026, 9, 27, 23, 59) },
    'gedrag-1': { count: 1, last: T(2026, 9, 20) },
    'gedrag-2': { count: 1 },
    'gedrag-3': { count: 1, last: T(2026, 9, 28, 0, 0) },
    'gedrag-4': { count: 1, last: T(2026, 9, 1), streak: 2, resolved: true }
  };
  const r = readyOf(raw, bank);
  assert.strictEqual(r.eis3.text, '3 fouten van vóór 28 september');
  same(r.eis3.ids, ['gedrag-2', 'gedrag-1', 'gedrag-0'], 'oudste eerst (zonder last voorop)');
  assert.strictEqual(r.eis3.met, false);
});
test('AC-29: eis 3 enkelvoud en "Geen fouten van vóór …" met alleen recente fouten', () => {
  const bank = RBANK.concat(mk('gedrag', 2));
  const raw = readyRaw();
  raw.mistakes = { 'gedrag-0': { count: 1, last: T(2026, 9, 27) } };
  assert.strictEqual(readyOf(raw, bank).eis3.text, '1 fout van vóór 28 september');
  raw.mistakes = { 'gedrag-0': { count: 1, last: T(2026, 9, 29) } };
  const r = readyOf(raw, bank);
  assert.strictEqual(r.eis3.text, 'Geen fouten van vóór 28 september');
  assert.ok(r.eis3.met);
});
test('AC-29: eis 3 grens over de maand: op 1 oktober is de grens 29 september', () => {
  const r = readyOf(readyRaw(), RBANK, T(2026, 10, 1));
  assert.strictEqual(r.eis3.cutoff, '2026-09-29');
});
test('AC-29: eis 2 onderwerpen laagste eerst: geen antwoorden, dan percentage, dan minder antwoorden, dan naam', () => {
  const bank = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((t) => ({ id: t + '-0', topic: t, kind: 'mc' }));
  const raw = { version: 3, history: {
    e: hist('e', 20, 19), b: hist('b', 20, 10), d: hist('d', 17, 15), c: hist('c', 20, 17),
    f: hist('f', 10, 5), g: hist('g', 0, 0)
  } };
  const r = readyOf(raw, bank);
  same(r.eis2.rows.map((x) => x.topic), ['a', 'g', 'f', 'b', 'c', 'd', 'e']);
  assert.strictEqual(r.eis2.text, '1 van 7 onderwerpen gehaald');
});
test('AC-30: 17 antwoorden waarvan 15 goed: "88% (15/17), nog te weinig antwoorden (17/20)", niet gehaald', () => {
  const r = readyOf({ version: 3, history: { verlichting: hist('verlichting', 17, 15) } }, mk('verlichting', 2));
  const row = r.eis2.rows[0];
  assert.strictEqual(row.text, '88% (15/17), nog te weinig antwoorden (17/20)');
  assert.strictEqual(row.met, false);
});
test('AC-30: 0 antwoorden: "nog geen antwoorden" (niet 0%)', () => {
  const r = readyOf({ version: 3, exams: [exam(40)] }, mk('verlichting', 2));
  assert.strictEqual(r.eis2.rows[0].text, 'nog geen antwoorden');
  assert.strictEqual(r.eis2.rows[0].pct, null);
});
test('AC-30: grens 90%: 18/20 gehaald, 17/20 niet; 17/17 goed is nog te weinig', () => {
  const row = (n, ok) => readyOf({ version: 3, history: { snelheid: hist('snelheid', n, ok) } }, mk('snelheid', 1)).eis2.rows[0];
  assert.strictEqual(row(20, 18).met, true);
  assert.strictEqual(row(20, 18).text, '90% (18/20)');
  assert.strictEqual(row(20, 17).met, false);
  assert.strictEqual(row(20, 17).text, '85% (17/20)');
  assert.strictEqual(row(17, 17).met, false);
  assert.strictEqual(row(17, 17).text, '100% (17/17), nog te weinig antwoorden (17/20)');
});
test('AC-30: percentage naar beneden afgerond, nooit "90%" onder de 90 (bv. 17/19 = 89%)', () => {
  const { U } = setup({ version: 3 });
  for (let n = 1; n <= 20; n++) {
    for (let ok = 0; ok <= n; ok++) {
      const s = { history: { t: hist('t', n, ok) }, exams: [], mistakes: {} };
      const row = U.readiness(s, [{ id: 'x', topic: 't' }], SEP30).eis2.rows[0];
      assert.strictEqual(row.pct, Math.floor((ok * 100) / n), ok + '/' + n);
    }
  }
});
test('AC-30: alleen de laatste 20 antwoorden tellen (state met 25)', () => {
  const { U } = setup({ version: 3 });
  const h = hist('t', 25, 0).map((x, i) => Object.assign(x, { ok: i >= 5 })); // eerste 5 fout, laatste 20 goed
  const r = U.readiness({ history: { t: h }, exams: [], mistakes: {} }, [{ id: 'x', topic: 't' }], SEP30);
  assert.strictEqual(r.eis2.rows[0].text, '100% (20/20)');
});
test('AC-31: alleen eis 1 open: "Bijna: nog 1 proefexamen met 46 of meer goed" (begint met "Bijna: nog 1 proefexamen")', () => {
  const raw = readyRaw();
  raw.exams = raw.exams.slice(1);
  const r = readyOf(raw, RBANK);
  assert.strictEqual(r.status, 'bijna');
  assert.ok(r.headline.startsWith('Bijna: nog 1 proefexamen'));
  assert.strictEqual(r.headline, 'Bijna: nog 1 proefexamen met 46 of meer goed');
});
test('AC-31: laatste 3 = 47, 45, 48 → "Bijna: nog 2 proefexamens met 46 of meer goed"; laatste < 46 → nog 3', () => {
  const raw = readyRaw();
  raw.exams = [exam(47, T(2026, 9, 20)), exam(45, T(2026, 9, 25)), exam(48, T(2026, 9, 29))];
  assert.strictEqual(readyOf(raw, RBANK).headline, 'Bijna: nog 2 proefexamens met 46 of meer goed');
  raw.exams = [exam(47, T(2026, 9, 20)), exam(48, T(2026, 9, 25)), exam(45, T(2026, 9, 29))];
  assert.strictEqual(readyOf(raw, RBANK).headline, 'Bijna: nog 3 proefexamens met 46 of meer goed');
});
test('AC-31: alleen eis 2 open met 1 onderwerp: "Bijna: nog 1 onderwerp (Voorrang)"', () => {
  const raw = readyRaw();
  raw.history.voorrang = hist('voorrang', 20, 17);
  assert.strictEqual(readyOf(raw, RBANK).headline, 'Bijna: nog 1 onderwerp (Voorrang)');
});
test('AC-31 (besluit 1): alleen eis 2 open met 13 onderwerpen: letterlijk "Bijna: nog 13 onderwerpen"', () => {
  const topics = ['borden', 'voorrang', 'snelheid', 'alcohol', 'rijbewijs', 'parkeren', 'verlichting', 'snelweg', 'inhalen', 'weggebruikers', 'verkeerslichten', 'afstand', 'gedrag'];
  const bank = topics.map((t) => ({ id: t + '-0', topic: t, kind: 'mc' }));
  const raw = { version: 3, exams: [exam(46), exam(47), exam(48)], history: {} };
  topics.forEach((t) => { raw.history[t] = hist(t, 20, 17); });
  const r = readyOf(raw, bank);
  assert.strictEqual(r.status, 'bijna');
  assert.strictEqual(r.headline, 'Bijna: nog 13 onderwerpen');
  assert.strictEqual(r.eis2.text, '0 van 13 onderwerpen gehaald');
});
test('AC-31: alleen eis 3 open: "Bijna: nog 1 oude fout" / "Bijna: nog 3 oude fouten"', () => {
  const raw = readyRaw();
  raw.mistakes = mis(['snelheid-0'], T(2026, 9, 20));
  assert.strictEqual(readyOf(raw, RBANK).headline, 'Bijna: nog 1 oude fout');
  raw.mistakes = mis(['snelheid-0', 'snelheid-1', 'voorrang-2'], T(2026, 9, 20));
  assert.strictEqual(readyOf(raw, RBANK).headline, 'Bijna: nog 3 oude fouten');
});
test('AC-31: twee of drie eisen open: "Nog niet"', () => {
  const raw = readyRaw();
  raw.exams = raw.exams.slice(1);
  raw.mistakes = mis(['snelheid-0'], T(2026, 9, 20));
  assert.strictEqual(readyOf(raw, RBANK).headline, 'Nog niet', 'eis 1 en 3');
  raw.history.voorrang = hist('voorrang', 5, 5);
  const r = readyOf(raw, RBANK);
  assert.strictEqual(r.status, 'nog-niet');
  assert.strictEqual(r.headline, 'Nog niet');
});
test('AC-31: geen antwoorden en geen proefexamens: "Nog geen gegevens" (ook met oude open fouten)', () => {
  const bank = RBANK.concat(mk('gedrag', 1));
  const r = readyOf({ version: 3 }, bank);
  assert.strictEqual(r.status, 'geen');
  assert.strictEqual(r.headline, 'Nog geen gegevens');
  assert.strictEqual(r.eis1.text, '0 van 3 gedaan');
  assert.strictEqual(r.eis2.text, '0 van 3 onderwerpen gehaald');
  assert.strictEqual(r.eis3.text, 'Geen open fouten');
  const old = readyOf({ version: 3, mistakes: mis(['gedrag-0'], T(2026, 9, 1)) }, bank);
  assert.strictEqual(old.headline, 'Nog geen gegevens');
  assert.strictEqual(readyOf({ version: 3, exams: [exam(30)] }, bank).noData, false, 'één proefexamen is genoeg voor gegevens');
});
test('AC-31/Decided: proefexamen met tijd om telt voor eis 1, open vragen als fout', () => {
  const raw = readyRaw();
  raw.exams[2] = exam(46, T(2026, 9, 29), 50, { timeUp: true });
  assert.ok(readyOf(raw, RBANK).eis1.met);
  raw.exams[2] = exam(20, T(2026, 9, 29), 50, { timeUp: true });
  assert.strictEqual(readyOf(raw, RBANK).eis1.text, 'Laatste 3: 46, 47, 20 (laagste 20)');
});
test('AC-31 (besluit 5): examens met total ≠ 50 tellen niet voor eis 1', () => {
  const raw = readyRaw();
  raw.exams = [exam(48, T(2026, 9, 1)), exam(47, T(2026, 9, 5)), exam(30, T(2026, 9, 10), 40), exam(49, T(2026, 9, 20))];
  const r = readyOf(raw, RBANK);
  assert.strictEqual(r.eis1.text, 'Laatste 3: 48, 47, 49');
  assert.ok(r.eis1.met);
  raw.exams = [exam(48, T(2026, 9, 1)), exam(47, T(2026, 9, 5)), exam(40, T(2026, 9, 10), 40)];
  assert.strictEqual(readyOf(raw, RBANK).eis1.text, '2 van 3 gedaan, laagste 47');
});
test('AC-31: oud examenformaat (kennis/inzicht) telt niet voor eis 1', () => {
  const raw = readyRaw();
  raw.exams = [{ date: T(2026, 9, 1), kennis: 12, inzicht: 27, passed: true }].concat(raw.exams.slice(1));
  assert.strictEqual(readyOf(raw, RBANK).eis1.text, '2 van 3 gedaan, laagste 47');
});
test('AC-32: "x van y vragen minstens 1× gezien" telt seen, kaarten en fouten, alleen uit de bank', () => {
  const bank = mk('snelheid', 5);
  const r = readyOf({ version: 3, seen: { 'snelheid-0': '2026-09-29', weg: '2026-09-29' }, srs: cards(['snelheid-1'], SEP30), mistakes: mis(['snelheid-2', 'weg-2'], T(2026, 9, 1)) }, bank);
  assert.strictEqual(r.seen, 3);
  assert.strictEqual(r.total, 5);
});
test('AC-33: proefexamen kiest eerst nooit gezien, dan zonder bekende dag, dan oudste seen; gelijk blijft in volgorde', () => {
  const { U, st } = setup({ version: 3, seen: { a: '2026-09-29', c: '2026-09-20', e: '2026-09-20' }, srs: cards(['d'], SEP30) });
  const list = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id }));
  same(U.freshFirst(st, list).map((x) => x.id), ['b', 'f', 'd', 'c', 'e', 'a']);
});
test('AC-33: wasSeen kijkt naar seen, kaarten en fouten (ook van vóór deel 1)', () => {
  const { U, st } = setup({ version: 3, seen: { a: '2026-09-29' }, srs: cards(['b'], SEP30), mistakes: mis(['c'], SEP30) });
  same(['a', 'b', 'c', 'd', 'toString'].map((id) => U.wasSeen(st, id)), [true, true, true, false, false]);
});
test('Oefen <onderwerp> (besluit 3): open fouten (AC-21), dan nooit gezien, dan oudste seen; max 15; alleen dat onderwerp', () => {
  const bank = mk('snelheid', 20).concat(mk('gedrag', 5));
  const seen = {};
  bank.slice(0, 20).forEach((x, i) => { if (i >= 5) seen[x.id] = '2026-09-' + String(10 + i).padStart(2, '0'); });
  seen['snelheid-19'] = '2026-09-01';
  const raw = { version: 3, seen, mistakes: {
    'snelheid-3': { count: 1, last: T(2026, 9, 25) },
    'snelheid-4': { count: 1, last: T(2026, 9, 20) },
    'snelheid-1': { count: 1, streak: 2, resolved: true, last: T(2026, 9, 1) },
    'gedrag-0': { count: 1, last: T(2026, 9, 1) }
  } };
  const { U, st } = setup(raw);
  const ids = U.topicPractice(st, bank, 'snelheid', SEP30, 15);
  assert.strictEqual(ids.length, 15);
  same(ids.slice(0, 2), ['snelheid-4', 'snelheid-3'], 'open fouten eerst, oudste eerst');
  same(ids.slice(2, 4), ['snelheid-0', 'snelheid-2'], 'dan nooit gezien (opgeloste fout telt als gezien)');
  assert.strictEqual(ids[4], 'snelheid-1', 'gezien zonder dag');
  assert.strictEqual(ids[5], 'snelheid-19', 'oudste seen-dag');
  assert.ok(ids.every((id) => /^snelheid/.test(id)));
  assert.strictEqual(new Set(ids).size, 15, 'geen dubbele');
});
test('AC-34: onderwerp zonder vragen in de bank telt niet mee in de examencheck (history, fouten)', () => {
  const raw = readyRaw();
  raw.history.weg = hist('weg', 20, 0);
  raw.mistakes = mis(['weg-1'], T(2026, 9, 1));
  raw.exams[0].topics = { weg: [0, 5], snelheid: [41, 45] };
  const r = readyOf(raw, RBANK);
  same(r.eis2.rows.map((x) => x.topic).sort(), ['snelheid', 'voorrang']);
  assert.strictEqual(r.eis3.open, 0);
  assert.strictEqual(r.headline, 'Klaar volgens deze app');
  assert.strictEqual(readyOf({ version: 3, history: { weg: hist('weg', 5, 5) } }, RBANK).headline, 'Nog geen gegevens');
});
test('AC-34: fouten en kaarten van verwijderde vragen komen niet in het plan', () => {
  const p = planOf({ version: 3, mistakes: mis(['weg-1'], T(2026, 9, 1)), srs: cards(['weg-2'], T(2026, 9, 1)) }, mk('snelheid', 3));
  assert.deepStrictEqual([p.mistakes.length, p.due.length, p.fresh.length], [0, 0, 3]);
  assert.strictEqual(p.weak, null);
});

// --- AC-35: kapotte opslag voor deel 3 ---
test('AC-35: clean: geldig `today` blijft, extra velden vervallen', () => {
  const st = setup({ version: 3, today: { day: '2026-09-30', target: 30, mock: true, practised: 12, x: '<img>' } }).st;
  same(st.today, { day: '2026-09-30', target: 30, mock: true, practised: 12 });
  same(setup({ version: 3, today: { day: '2026-09-30', target: 0, mock: false, practised: 0 } }).st.today, { day: '2026-09-30', target: 0, mock: false, practised: 0 });
});
test('AC-35: clean: kapot `today` wordt null (onmogelijke dag, verkeerde typen, negatief, kommagetal, Infinity)', () => {
  const good = { day: '2026-09-30', target: 30, mock: true, practised: 12 };
  const bad = [null, 'x', 5, [], [good],
    Object.assign({}, good, { day: '2026-02-31' }), Object.assign({}, good, { day: '2026-9-30' }), Object.assign({}, good, { day: 20260930 }),
    Object.assign({}, good, { target: '30' }), Object.assign({}, good, { target: -1 }), Object.assign({}, good, { target: 1.5 }), Object.assign({}, good, { target: null }),
    Object.assign({}, good, { practised: '12' }), Object.assign({}, good, { practised: -3 }), Object.assign({}, good, { practised: undefined }),
    Object.assign({}, good, { mock: 'true' }), Object.assign({}, good, { mock: 1 })];
  for (const today of bad) assert.strictEqual(setup({ version: 3, today }).st.today, null, JSON.stringify(today));
  const raw = '{"version":3,"today":{"day":"2026-09-30","target":1e999,"mock":true,"practised":NaN}}';
  assert.strictEqual(setup(raw).st.version, 3, 'NaN is geen JSON: hele opslag wordt leeg, geen crash');
  assert.strictEqual(setup('{"version":3,"today":{"day":"2026-09-30","target":1e999,"mock":true,"practised":0}}').st.today, null);
});
test('AC-35: clean: `today` met __proto__/constructor-sleutels vervuilt niets', () => {
  const raw = '{"version":3,"today":{"__proto__":{"day":"2026-09-30","target":5,"mock":true,"practised":1}},"seen":{"__proto__":"2026-09-30","constructor":"2026-09-30","ok":"2026-09-30"}}';
  const { st, U } = setup(raw);
  assert.strictEqual(st.today, null);
  same(st.seen, { ok: '2026-09-30' });
  assert.strictEqual(({}).day, undefined);
  assert.strictEqual(U.wasSeen(st, '__proto__'), false);
  assert.strictEqual(U.wasSeen(st, 'constructor'), false);
});
test('AC-35: kapot `today` van gisteren of later: today() is null en setToday begint "gedaan" op 0', () => {
  const { S } = setup({ version: 3, today: { day: '2099-01-01', target: 5, mock: false, practised: 99 } });
  assert.strictEqual(S.today(), null);
  assert.strictEqual(S.setToday(7, false).practised, 0);
});
test('AC-35: plan en examencheck over allerlei rommel: geen fout, geen NaN/undefined in de teksten', () => {
  const raw = {
    version: 2, examDate: '2026-02-31', examMonth: '2026-13', today: 'x',
    history: { snelheid: [{ id: 's', ok: 'ja', day: '2026-09-30' }, null, { id: 'snelheid-0', ok: true, day: '2026-09-29' }], voorrang: 'x', constructor: [] },
    seen: { 'snelheid-1': 'gisteren', 'snelheid-2': '2026-09-28' },
    exams: [{ date: 'x', score: 48, total: 50 }, { date: 1, score: 60, total: 50 }, { date: T(2026, 9, 28), score: 47, total: 50, topics: 5 }, null],
    mistakes: { 'snelheid-0': { count: 1, last: 'x', streak: '1', okDay: '2099-99-99' }, 'snelheid-3': { count: 'x' }, constructor: { count: 1 } },
    srs: { 'snelheid-4': { box: 1, due: 'x' }, 'snelheid-5': { box: 2, due: T(2026, 9, 1) } }
  };
  const { U, st } = setup(raw);
  const bank = mk('snelheid', 8).concat(mk('voorrang', 2, 'voorrang'));
  const p = U.dayPlan(st, bank, SEP30);
  const r = U.readiness(st, bank, SEP30, (t) => NAMES3[t]);
  const s = U.todayStatus({ target: p.target, practised: 0, mock: p.mock, mockDone: false, available: p.target, welcome: p.welcome });
  const texts = [s.line, r.headline, r.eis1.text, r.eis2.text, r.eis3.text].concat(r.eis2.rows.map((x) => x.text), U.planNotes(p.rules));
  for (const t of texts) assert.ok(typeof t === 'string' && t && !/NaN|undefined|null|Infinity/.test(t), JSON.stringify(t));
  assert.strictEqual(p.rules.mode, 'geen');
  same(p.mistakes, ['snelheid-0']);
  same(p.due, ['snelheid-5']);
  assert.strictEqual(r.eis1.text, '1 van 3 gedaan, laagste 47');
  assert.strictEqual(r.eis3.text, '1 fout van vóór 28 september', 'fout zonder geldige last telt als oud');
});
test('AC-35: eerste gebruik (lege opslag): nulmeting, "niet gepland", "Nog geen gegevens"', () => {
  const { U, st, S } = setup(undefined);
  assert.strictEqual(st.today, null);
  assert.strictEqual(S.today(), null);
  const bank = mk('snelheid', 20);
  const p = U.dayPlan(st, bank, SEP30);
  assert.deepStrictEqual([p.rules.mode, p.fresh.length, p.mock, p.nulmeting, p.target, p.welcome], ['geen', 10, true, true, 5, false]);
  assert.strictEqual(U.todayStatus({ target: p.target, practised: 0, mock: true, mockDone: false, available: 5 }).line, 'Vandaag: 5 vragen (± 5 min) + ' + MOCK);
  assert.strictEqual(U.readiness(st, bank, SEP30).headline, 'Nog geen gegevens');
});
test('AC-35: versie 2 zonder today/history/seen krijgt today null en blijft verder intact', () => {
  const { st } = setup({ version: 2, mistakes: { a: { count: 2, last: T(2026, 9, 1) } }, exams: [exam(45)] });
  assert.strictEqual(st.version, 3);
  assert.strictEqual(st.today, null);
  assert.ok(st.mistakes.a);
  assert.strictEqual(st.exams.length, 1);
});
test('dayDiff: kalenderdagen, ook over maand, jaar en de wisseling van zomer- naar wintertijd', () => {
  const { dayDiff } = load().RB.util;
  same([dayDiff('2026-09-27', '2026-10-01'), dayDiff('2026-12-31', '2027-01-01'), dayDiff('2026-10-24', '2026-10-26'),
    dayDiff('2027-03-27', '2027-03-29'), dayDiff('2026-10-01', '2026-09-27')], [4, 1, 2, 2, -4]);
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

// --- Review-fixes deel 3 ---
test('Nog een ronde: plan leeg in onderhoud of vlak voor het examen: alleen al geziene items, oudste eerst (AC-25/26)', () => {
  const bank = mk('gedrag', 5);
  const seen = { 'gedrag-3': '2026-09-20', 'gedrag-1': '2026-09-25' };
  for (const raw of [{ version: 3, examMonth: '2026-09', seen }, { version: 3, examDate: '2026-10-01', seen }, { version: 3, examDate: '2026-09-30', seen }]) {
    const { U, st } = setup(raw);
    const p = U.dayPlan(st, bank, SEP30);
    assert.strictEqual(p.rules.perDay, 0, JSON.stringify(raw));
    assert.deepStrictEqual(p.order, []);
    assert.deepStrictEqual(U.extraRound(st, bank, p, 15), ['gedrag-3', 'gedrag-1'], JSON.stringify(raw));
  }
  const { U, st } = setup({ version: 3, examMonth: '2026-09' });
  assert.deepStrictEqual(U.extraRound(st, bank, U.dayPlan(st, bank, SEP30), 15), [], 'niets gezien: leeg, dus geen knop');
});
test('Nog een ronde: plan niet leeg: de volgende uit het plan; zonder datum en leeg plan mogen nieuwe', () => {
  const bank = mk('gedrag', 30);
  const { U, st } = setup({ version: 3 });
  const p = U.dayPlan(st, bank, SEP30);
  assert.deepStrictEqual(U.extraRound(st, bank, p, 15), p.order.slice(0, 15));
  const empty = Object.assign({}, p, { order: [] });
  assert.strictEqual(U.extraRound(st, bank, empty, 15).length, 15, 'perDay 10: nooit geziene mogen');
});
test('Oefen oude fouten: zonder die van vandaag al goed, oudste eerst, max. 20; eis 3 telt ze wel', () => {
  const old = mk('gedrag', 25);
  const raw = { version: 3, mistakes: mis(idsOf(old), T(2026, 9, 1)) };
  raw.mistakes['gedrag-0'] = { count: 1, streak: 1, okDay: '2026-09-30', last: T(2026, 8, 1) };
  old.forEach((x, i) => { if (i) raw.mistakes[x.id].last = T(2026, 9, 1) + i * HOUR; });
  const { U, st } = setup(raw);
  const ids = U.oldPractice(st, old, SEP30, 20);
  assert.strictEqual(ids.length, 20);
  assert.ok(!ids.includes('gedrag-0'), 'vandaag al goed: niet opnieuw');
  assert.deepStrictEqual(ids, idsOf(old).slice(1, 21));
  const r = U.readiness(st, old, SEP30);
  assert.strictEqual(r.eis3.ids.length, 25);
  assert.strictEqual(r.eis3.todo.length, 24);
  assert.strictEqual(r.eis3.okToday, 1);
  assert.strictEqual(r.eis3.met, false);
});
test('Oefen oude fouten: volgende ronde geeft de volgende 20 (goed = vandaag al goed, fout = niet meer oud)', () => {
  const old = mk('gedrag', 25);
  const { U, S } = setup({ version: 3, mistakes: mis(idsOf(old), T(2026, 9, 1)), seen: seenOn(idsOf(old), '2026-09-01') });
  const first = U.oldPractice(S.state(), old, SEP30, 20);
  first.forEach((id, i) => S.recordAnswer({ id, topic: 'gedrag' }, i % 2 === 0));
  const second = U.oldPractice(S.state(), old, SEP30, 20);
  assert.deepStrictEqual(second.slice().sort(), idsOf(old).filter((id) => !first.includes(id)).sort());
  second.forEach((id) => S.recordAnswer({ id, topic: 'gedrag' }, true));
  const r = U.readiness(S.state(), old, SEP30);
  assert.deepStrictEqual(U.oldPractice(S.state(), old, SEP30, 20), []);
  assert.strictEqual(r.eis3.okToday, 15, 'alle oude die nog over zijn, waren vandaag goed: tekst in plaats van knop');
  assert.strictEqual(r.eis3.todo.length, 0);
  assert.strictEqual(U.okTodayLine(1, 1), 'Die had je vandaag al goed. Hij is pas weg als je hem morgen weer goed hebt.');
});
test('Oefen <onderwerp>: fouten die vandaag al goed waren, blijven eruit', () => {
  const list = mk('gedrag', 4);
  const raw = { version: 3, mistakes: mis(['gedrag-0', 'gedrag-1'], T(2026, 9, 1)), seen: seenOn(idsOf(list), '2026-09-01') };
  raw.mistakes['gedrag-1'] = { count: 1, streak: 1, okDay: '2026-09-30', last: T(2026, 9, 1) };
  const { U, st } = setup(raw);
  const ids = U.topicPractice(st, list, 'gedrag', SEP30, 15);
  assert.strictEqual(ids[0], 'gedrag-0');
  assert.ok(!ids.includes('gedrag-1'));
  assert.strictEqual(ids.length, 3);
});
test('AC-24/28: proefexamen vóór de startpagina: doel eerst vastgezet (gehalveerd), examenantwoorden tellen niet', () => {
  const bank = mk('gedrag', 60);
  const { U, S } = setup({ version: 3 });
  const p = U.dayPlan(S.state(), bank, SEP30); // wat runExam via ensureToday doet
  if (!S.today()) S.setToday(p.target, p.mock);
  bank.slice(0, 50).forEach((x) => S.recordAnswer(x, true, null, true));
  same(S.today(), { day: '2026-09-30', target: 5, mock: true, practised: 0 });
});
test('AC-27: practised volgt practisedDay: clean en setToday nemen het grootste', () => {
  const pd = { day: '2026-09-30', ids: { a: true, b: true, c: true } };
  assert.strictEqual(setup({ version: 3, today: { day: '2026-09-30', target: 10, mock: false, practised: 1 }, practisedDay: pd }).st.today.practised, 3);
  assert.strictEqual(setup({ version: 3, today: { day: '2026-09-30', target: 10, mock: false, practised: 5 }, practisedDay: pd }).st.today.practised, 5, 'oud getal zonder lijst blijft');
  assert.strictEqual(setup({ version: 3, today: { day: '2026-09-30', target: 10, mock: false, practised: 1 }, practisedDay: Object.assign({}, pd, { day: '2026-09-29' }) }).st.today.practised, 1);
  const { S } = setup({ version: 3, practisedDay: pd });
  assert.strictEqual(S.setToday(10, false).practised, 3);
  S.recordAnswer({ id: 'a', topic: 'x' }, true);
  assert.strictEqual(S.today().practised, 3, 'a telde al');
  S.recordAnswer({ id: 'd', topic: 'x' }, true);
  assert.strictEqual(S.today().practised, 4);
});
test('AC-35: clean: today.target en practised hoogstens 1000; setToday kapt af', () => {
  const ok = { day: '2026-09-30', target: 1000, mock: false, practised: 1000 };
  same(setup({ version: 3, today: ok }).st.today, ok);
  for (const today of [Object.assign({}, ok, { target: 1001 }), Object.assign({}, ok, { practised: 1001 }), Object.assign({}, ok, { target: 1e300 }), Object.assign({}, ok, { practised: 1e300 })]) {
    assert.strictEqual(setup({ version: 3, today }).st.today, null, JSON.stringify(today));
  }
  const { S } = setup({ version: 3 });
  assert.strictEqual(S.setToday(1e300, false).target, 1000);
});

if (process.env.TZ === 'Europe/Amsterdam') {
  test('DST: tijdzone Europe/Amsterdam is echt actief', () => {
    assert.notStrictEqual(new Date(2026, 9, 24, 12).getTimezoneOffset(), new Date(2026, 9, 26, 12).getTimezoneOffset());
  });
  test('DST AC-27/28: op de 25-uursdag telt 00:30 en 23:30 als één doel-dag; 26 okt 00:10 is een nieuwe dag', () => {
    const { RB, clock } = load(undefined, at(2026, 10, 25, 0, 30));
    const s = RB.store;
    s.setToday(10, false);
    s.recordAnswer({ id: 'a', topic: 'snelheid' }, true);
    clock.now = at(2026, 10, 25, 23, 30);
    s.recordAnswer({ id: 'b', topic: 'snelheid' }, true);
    assert.strictEqual(s.today().practised, 2);
    assert.strictEqual(s.today().target, 10);
    clock.now = at(2026, 10, 26, 0, 10);
    assert.strictEqual(s.today(), null);
  });
  test('DST AC-25: datum 26 okt: 24 okt 23:30 is D = 2, 25 okt 23:30 is D = 1 (alleen fouten)', () => {
    const U = load().RB.util;
    assert.strictEqual(U.planRules(U.examInfo('2026-10-26', null, at(2026, 10, 24, 23, 30)), 10).D, 2);
    const r = U.planRules(U.examInfo('2026-10-26', null, at(2026, 10, 25, 23, 30)), 10);
    assert.deepStrictEqual([r.D, r.perDay, r.mockEvery, r.mistakes], [1, 0, 0, 20]);
  });
  test('DST AC-23: cadans 4 over de wisseling: examen 23 okt 23:30, niet op 26 okt, wel op 27 okt 00:05', () => {
    const { RB } = load();
    const st = RB.store._clean({ version: 3, examDate: '2026-11-20', exams: [{ date: at(2026, 10, 23, 23, 30), score: 40, total: 50 }] });
    const bank = [{ id: 'x', topic: 't', kind: 'mc' }];
    assert.strictEqual(RB.util.dayPlan(st, bank, at(2026, 10, 26, 23, 59)).mock, false);
    assert.strictEqual(RB.util.dayPlan(st, bank, at(2026, 10, 27, 0, 5)).mock, true);
  });
  test('DST AC-29: eis-3-grens op 26 okt 00:30 is 24 oktober; fout van 23 okt 23:59 is oud, 24 okt 00:00 niet', () => {
    const { RB } = load();
    const now = at(2026, 10, 26, 0, 30);
    const bank = [{ id: 'oud', topic: 't' }, { id: 'nieuw', topic: 't' }];
    const st = RB.store._clean({ version: 3, mistakes: { oud: { count: 1, last: at(2026, 10, 23, 23, 59) }, nieuw: { count: 1, last: at(2026, 10, 24, 0, 0) } } });
    const r = RB.util.readiness(st, bank, now);
    assert.strictEqual(r.eis3.cutoff, '2026-10-24');
    assert.strictEqual(r.eis3.text, '1 fout van vóór 24 oktober');
  });
  test('DST AC-22: welkom terug over de wisseling: laatste 24 okt, op 26 okt 00:30 wel; laatste 25 okt niet', () => {
    const { RB } = load();
    const bank = [{ id: 'x', topic: 't', kind: 'mc' }];
    const w = (day) => RB.util.dayPlan(RB.store._clean({ version: 3, seen: { x: day } }), bank, at(2026, 10, 26, 0, 30)).welcome;
    assert.strictEqual(w('2026-10-24'), true);
    assert.strictEqual(w('2026-10-25'), false);
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
