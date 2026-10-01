// Kleine hulpfuncties zonder DOM, zodat ze met node getest kunnen worden (tests/logic.js).
(function () {
  var RB = (window.RB = window.RB || {});

  // Leest een getal zoals een Nederlander het typt: "0,5", "0.5", "3500", "3.500", "3 500", "1.234,5".
  // Geeft null bij alles wat geen getal is ("", "3500abc", "3,5e3").
  function parseNum(s) {
    var t = String(s == null ? '' : s).trim().replace(/[\s ]/g, '');
    if (!t) return null;
    // Punt als duizendtal-scheiding: 3.500 of 1.234.567,5 (niet 0.500, dat is een decimaal).
    if (/^[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
    else if (/^\d+([.,]\d+)?$/.test(t)) t = t.replace(',', '.');
    else return null;
    var v = Number(t);
    return isFinite(v) ? v : null;
  }

  function fmtNum(n) { return String(n).replace('.', ','); }

  function hasKey(obj, k) { return obj != null && Object.prototype.hasOwnProperty.call(obj, k); }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  // Begin van de lokale dag (tijdstip in ms).
  function dayStart(t) {
    var d = new Date(t == null ? Date.now() : t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  // Lokale datum als "2026-09-28".
  function dayKey(t) {
    var d = new Date(dayStart(t));
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  // n dagen na het begin van vandaag, ook rond de wisseling van zomer- en wintertijd.
  function addDays(t, n) {
    var d = new Date(dayStart(t));
    d.setDate(d.getDate() + n);
    return d.getTime();
  }

  // Is s een echte dag als "2026-09-30"? Ook "2026-02-31" of "2026-13-01" is fout.
  function isDay(s) {
    var m = typeof s === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return false;
    var d = new Date(+m[1], m[2] - 1, +m[3]);
    return d.getFullYear() === +m[1] && d.getMonth() === m[2] - 1 && d.getDate() === +m[3];
  }
  // Is s een maand als "2026-11"?
  function isMonth(s) { return typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s); }

  // Begin van een lokale dag "2026-09-30" als tijdstip.
  function dayTime(day) {
    var p = day.split('-');
    return new Date(+p[0], p[1] - 1, +p[2]).getTime();
  }
  // Kalenderdagen van vandaag (t) tot een dag "2026-11-20"; negatief als die dag voorbij is.
  function daysUntil(day, t) { return Math.round((dayTime(day) - dayStart(t)) / 86400000); }
  // Kalenderdagen van dag a tot dag b: ("2026-09-27", "2026-10-01") -> 4. Ook rond zomer-/wintertijd.
  function dayDiff(a, b) { return daysUntil(b, dayTime(a)); }

  // Maand van tijdstip t plus n maanden, als "2026-11".
  function monthKey(t, n) {
    var d = new Date(dayStart(t));
    d.setDate(1);
    d.setMonth(d.getMonth() + (n || 0));
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  // De huidige maand en de n - 1 maanden daarna.
  function monthList(t, n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(monthKey(t, i));
    return out;
  }

  var MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  // "2026-11" -> "november"; "2026-11-20" -> "november".
  function monthName(s) { return MONTHS[Number(s.split('-')[1]) - 1]; }
  // "2026-11" -> "november 2026".
  function monthLabel(ym) { return monthName(ym) + ' ' + ym.split('-')[0]; }
  // "2026-11-20" -> "20 november".
  function dayLabel(day) { return Number(day.split('-')[2]) + ' ' + monthName(day); }

  // Wat weten we over de examendatum? Een precieze datum gaat voor een maand.
  // { mode: 'geen' }
  // { mode: 'datum', day, days }                 days < 0: voorbij
  // { mode: 'maand', month, days, phase }        days tot de 1e van de maand;
  //   phase: 'later' (meer dan 21 dagen), 'bijna' (1 t/m 21 dagen), 'bezig' (in de maand), 'voorbij'
  function examInfo(examDate, examMonth, t) {
    if (isDay(examDate)) return { mode: 'datum', day: examDate, days: daysUntil(examDate, t) };
    if (!isMonth(examMonth)) return { mode: 'geen' };
    var days = daysUntil(examMonth + '-01', t);
    var now = monthKey(t);
    var phase = examMonth < now ? 'voorbij' : examMonth === now ? 'bezig' : days <= 21 ? 'bijna' : 'later';
    return { mode: 'maand', month: examMonth, days: days, phase: phase };
  }

  // Score per onderwerp: [{ topic, ok }] -> { voorrang: [goed, gevraagd] }.
  function tallyTopics(rows) {
    var out = {};
    rows.forEach(function (r) {
      if (!hasKey(out, r.topic)) out[r.topic] = [0, 0];
      out[r.topic][1]++;
      if (r.ok) out[r.topic][0]++;
    });
    return out;
  }

  // Rijen voor de uitslag per onderwerp: { voorrang: [goed, gevraagd] } -> [{ topic, name, ok, asked, wrong }].
  // Meeste fout eerst; bij gelijk: meer gevraagd eerst, dan de naam. name(t) geeft de naam van een onderwerp.
  function topicRows(topics, name) {
    var nm = name || String;
    return Object.keys(topics || {}).map(function (t) {
      var ok = Number(topics[t][0]), asked = Number(topics[t][1]);
      return { topic: t, name: String(nm(t)), ok: ok, asked: asked, wrong: asked - ok };
    }).sort(function (a, b) {
      return b.wrong - a.wrong || b.asked - a.asked || a.name.localeCompare(b.name, 'nl');
    });
  }
  // De (hoogstens 3) onderwerpen met de meeste fouten, in de volgorde van topicRows.
  function weakTopics(rows) {
    return rows.filter(function (r) { return r.wrong > 0; }).slice(0, 3).map(function (r) { return r.topic; });
  }

  // Verschil met het vorige proefexamen, of null als dat niets zegt
  // (geen vorig examen, oud formaat, of een ander aantal vragen).
  function changeLine(prev, cur) {
    if (!prev || prev.total == null || cur.total == null || Number(prev.total) !== Number(cur.total)) return null;
    var p = Number(prev.score) + ' / ' + Number(prev.total);
    var d = Number(cur.score) - Number(prev.score);
    if (!d) return 'Zelfde score als vorige: ' + p;
    return (d > 0 ? '+' : '') + d + ' sinds vorige: ' + p;
  }

  // Vragen voor "Oefen zwakke onderwerpen" (hoogstens max, standaard 15), als lijst met id's.
  // o.topics: de zwakke onderwerpen. o.items: alle items [{ id, topic }] (al gehusseld).
  // o.open: id's van open fouten (in de gewenste volgorde). o.okIds: { id: true } goed in dit examen.
  // o.examIds: { id: true } in dit examen; die (niet goed beantwoord) komen na de fouten eerst.
  // Volgorde: eerst de open fouten uit die onderwerpen, dan andere vragen daaruit die niet goed waren in het examen.
  function weakList(o) {
    var topic = {}, inTopics = {}, picked = {};
    (o.topics || []).forEach(function (t) { inTopics[t] = true; });
    o.items.forEach(function (x) { topic[x.id] = x.topic; });
    var out = (o.open || []).filter(function (id) {
      return hasKey(topic, id) && inTopics[topic[id]] === true && !picked[id] && (picked[id] = true);
    });
    var rest = o.items.filter(function (x) {
      return inTopics[x.topic] === true && !picked[x.id] && !hasKey(o.okIds, x.id);
    });
    var inExam = function (x) { return hasKey(o.examIds, x.id); };
    var ids = function (x) { return x.id; };
    return out.concat(rest.filter(inExam).map(ids), rest.filter(function (x) { return !inExam(x); }).map(ids)).slice(0, o.max || 15);
  }

  // "Voorrang", "Voorrang en Snelheid", "Borden, Voorrang en Snelheid".
  function joinNames(names) {
    if (names.length < 2) return names.join('');
    return names.slice(0, -1).join(', ') + ' en ' + names[names.length - 1];
  }

  // Regel in het foutenlogboek: hoeveel van de n open fouten had je vandaag al goed (t).
  function okTodayLine(t, n) {
    if (!t) return '';
    if (t === n) {
      return n === 1 ? 'Die had je vandaag al goed. Hij is pas weg als je hem morgen weer goed hebt.'
        : 'Die had je vandaag allemaal al goed. Ze zijn pas weg als je ze morgen weer goed hebt.';
    }
    return t === 1 ? '1 daarvan had je vandaag al goed. Die is pas weg als je hem morgen weer goed hebt.'
      : t + ' daarvan had je vandaag al goed. Die zijn pas weg als je ze morgen weer goed hebt.';
  }

  // ---------- Deel 3: plan voor vandaag en "Klaar voor het examen?" ----------
  // Alles hieronder krijgt de opgeslagen toestand (store.state()), de vragenbank [{ id, topic, kind }]
  // en het tijdstip "nu" mee, en geeft gewone gegevens terug. Geen DOM, zodat het met node te testen is.

  // `last` van een fout als getal; zonder `last` telt hij als oudste.
  function lastOf(mistakes, id) { return isNum(mistakes[id].last) ? mistakes[id].last : -Infinity; }
  function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

  // Heb je dit item ooit gezien? "seen" bestaat sinds deel 1; een flashcard of fout van daarvoor telt ook.
  function wasSeen(state, id) {
    return hasKey(state.seen, id) || hasKey(state.srs, id) || hasKey(state.mistakes, id);
  }
  // Items in de volgorde: nooit gezien, dan gezien zonder bekende dag, dan de oudste "seen"-dag eerst.
  // Bij gelijke stand blijft de volgorde van list (de aanroeper husselt vooraf). AC-33 en "Oefen <onderwerp>".
  function freshFirst(state, list) {
    var key = function (x) {
      return hasKey(state.seen, x.id) ? '2' + state.seen[x.id] : wasSeen(state, x.id) ? '1' : '0';
    };
    return list.map(function (x, i) { return { x: x, k: key(x), i: i }; })
      .sort(function (a, b) { return a.k < b.k ? -1 : a.k > b.k ? 1 : a.i - b.i; })
      .map(function (o) { return o.x; });
  }

  // Open fouten ordenen (AC-21): eerst die met streak 1 van een eerdere dag, dan de oudste `last` eerst.
  function orderMistakes(mistakes, ids, today) {
    var early = function (id) { var m = mistakes[id]; return m.streak === 1 && isDay(m.okDay) && m.okDay < today ? 0 : 1; };
    return ids.slice().sort(function (a, b) {
      return early(a) - early(b) || (lastOf(mistakes, a) - lastOf(mistakes, b)) || cmp(a, b);
    });
  }
  // Id's van open fouten die nog in de bank staan (known: { id: item }).
  function openIds(state, known) {
    var ms = state.mistakes || {};
    return Object.keys(ms).filter(function (id) { return hasKey(known, id) && !ms[id].resolved; });
  }
  function index(bank) {
    var out = {};
    bank.forEach(function (x) { out[x.id] = x; });
    return out;
  }

  // Regels voor het plan uit de examendatum (examInfo) en het aantal nooit geziene items (unseen).
  // mode: 'geen' (geen, voorbije datum of maand), 'datum', 'maand' (vóór de 1e), 'onderhoud' (in de maand zelf).
  // D: dagen tot de plandatum; R: reserve; perDay: nieuwe per dag; mistakes/due: maxima; mockEvery: dagen tussen
  // proefexamens (0 = geen); shortfall: niet alle nieuwe vragen haalbaar vóór het examen (AC-19).
  function planRules(info, unseen) {
    var r = { mode: 'geen', D: null, R: null, perDay: 10, mistakes: 10, due: 10, mockEvery: 7, shortfall: false };
    if (info.mode === 'maand' && info.phase === 'bezig') {
      r.mode = 'onderhoud'; r.perDay = 0; r.mistakes = 20; r.mockEvery = 2;
    } else if ((info.mode === 'datum' && info.days >= 0) || (info.mode === 'maand' && info.phase !== 'voorbij')) {
      var D = r.D = info.days;
      r.mode = info.mode;
      if (info.mode === 'datum' && D <= 1) {
        // AC-25: morgen alleen de open fouten (max. 20), vandaag hoogstens 10; niets nieuws, geen proefexamen.
        r.perDay = 0; r.due = 0; r.mockEvery = 0; r.mistakes = D === 1 ? 20 : 10;
      } else {
        r.R = Math.min(14, Math.floor(D / 2));
        var raw = Math.ceil(unseen / Math.max(1, D - r.R));
        r.perDay = Math.min(20, raw);
        r.shortfall = raw > 20;
        r.mistakes = D >= 15 ? 10 : 20;
        r.mockEvery = D >= 43 ? 7 : D >= 15 ? 4 : 2;
      }
    }
    return r;
  }

  // Dag van het laatste proefexamen, of null.
  function lastExamDay(exams) {
    var last = null;
    (exams || []).forEach(function (e) {
      var t = Number(e && e.date);
      if (!isFinite(t)) return;
      var d = dayKey(t);
      if (!last || d > last) last = d;
    });
    return last;
  }
  // Is er vandaag een proefexamen aan de beurt? Nooit gedaan: ja (nulmeting). Niet gedaan: blijft staan (AC-23).
  function mockDue(rules, exams, today) {
    if (!rules.mockEvery) return false;
    var last = lastExamDay(exams);
    return !last || dayDiff(last, today) >= rules.mockEvery;
  }
  // Laatste dag waarop je iets beantwoordde (geschiedenis of "gezien"), of null.
  function lastActivity(state) {
    var last = null;
    var see = function (d) { if (isDay(d) && (!last || d > last)) last = d; };
    Object.keys(state.history || {}).forEach(function (t) {
      (state.history[t] || []).forEach(function (h) { see(h && h.day); });
    });
    Object.keys(state.seen || {}).forEach(function (id) { see(state.seen[id]); });
    return last;
  }

  // Het plan voor vandaag, live uit de toestand. bank: alle items [{ id, topic, kind }] (gehusseld door de aanroeper).
  // order: id's in planvolgorde (fouten, kaarten, nieuwe); target: aantal vragen voor vandaag (gehalveerd als er
  // een proefexamen aan de beurt is, AC-24). welcome: laatste activiteit van vóór gisteren (AC-22).
  function dayPlan(state, bank, now) {
    var today = dayKey(now);
    var info = examInfo(state.examDate, state.examMonth, now);
    var known = index(bank);
    var open = openIds(state, known);
    var unseen = bank.filter(function (x) { return !wasSeen(state, x.id); });
    var rules = planRules(info, unseen.length);
    var inPlan = {};
    var mark = function (id) { inPlan[id] = true; };
    var id = function (x) { return x.id; };
    // Fouten die je vandaag al goed had, horen niet in het plan (AC-16).
    var mistakes = orderMistakes(state.mistakes, open.filter(function (k) {
      var m = state.mistakes[k];
      return !(m.streak && m.okDay === today);
    }), today).slice(0, rules.mistakes);
    mistakes.forEach(mark);
    var due = bank.filter(function (x) {
      var c = hasKey(state.srs, x.id) ? state.srs[x.id] : null;
      return x.kind !== 'voorrang' && !inPlan[x.id] && c && c.due <= now;
    }).slice(0, rules.due).map(id);
    due.forEach(mark);
    // Nieuwe vragen (ook voorrang, AC-20), bij voorkeur uit het onderwerp met de meeste open fouten.
    var count = {}, weak = null;
    open.forEach(function (k) {
      var t = known[k].topic;
      count[t] = (count[t] || 0) + 1;
      if (weak === null || count[t] > count[weak]) weak = t;
    });
    var fresh = unseen.filter(function (x) { return !inPlan[x.id]; });
    fresh = fresh.filter(function (x) { return x.topic === weak; })
      .concat(fresh.filter(function (x) { return x.topic !== weak; }))
      .slice(0, rules.perDay).map(id);
    var order = mistakes.concat(due, fresh);
    var mock = mockDue(rules, state.exams, today);
    var last = lastActivity(state);
    return {
      today: today, rules: rules, unseen: unseen.length,
      mistakes: mistakes, due: due, fresh: fresh, weak: weak, order: order, total: order.length,
      mock: mock, nulmeting: mock && !(state.exams || []).length,
      target: mock ? Math.ceil(order.length / 2) : order.length,
      welcome: !!last && dayDiff(last, today) >= 2
    };
  }

  // Nieuw doel na een andere examendatum, midden op de dag (AC-28): wat vandaag al gedaan is, plus het doel voor
  // wat er nu nog in het plan staat (halveren voor een proefexamen geldt alleen voor dat restant). { target, mock }.
  function replanToday(state, bank, now) {
    var p = dayPlan(state, bank, now);
    var td = state.today;
    var done = td && td.day === p.today ? Number(td.practised) || 0 : 0;
    return { target: done + p.target, mock: p.mock };
  }

  // Minuten voor n vragen: 30 s per vraag, naar boven afgerond op 5 minuten.
  function minutes(n) { return n > 0 ? Math.ceil(n / 10) * 5 : 0; }

  var MOCK_TEXT = 'proefexamen (30 min, zorg dat je niet gestoord wordt)';
  // Doelregel op de startpagina. o: { target, practised, mock (vandaag aan de beurt), mockDone (vandaag gedaan),
  // available (vragen die nu nog in het plan staan), welcome, rest (examen morgen of vandaag) }.
  // state: 'rust' | 'leeg' | 'gehaald' | 'examen' (vragen klaar, proefexamen nog niet) | 'bezig'.
  function todayStatus(o) {
    var target = o.target, done = o.practised;
    var mockLeft = !!o.mock && !o.mockDone;
    var gedaan = done > 0 ? ' · ' + done + ' gedaan' : '';
    if (!target && !done && !mockLeft) {
      if (o.rest) return { state: 'rust', line: 'Geen open fouten meer. Rust goed uit en succes!', mockLeft: false };
      if (!o.mockDone) return { state: 'leeg', line: 'Vandaag staat er niets klaar. Doe een proefexamen of kom morgen terug.', mockLeft: false };
    }
    var qDone = done >= target || !o.available;
    if (qDone && !mockLeft) return { state: 'gehaald', line: 'Doel van vandaag gehaald' + gedaan, mockLeft: false };
    var line = target
      ? 'Vandaag: ' + target + ' ' + (target === 1 ? 'vraag' : 'vragen') + ' (± ' + minutes(target) + ' min)' + (mockLeft ? ' + ' + MOCK_TEXT : '')
      : 'Vandaag: ' + MOCK_TEXT;
    if (o.welcome && !done) line = 'Welkom terug. ' + line;
    return { state: qDone ? 'examen' : 'bezig', line: line + gedaan, mockLeft: mockLeft };
  }

  // "5 fouten · 4 kaarten · 6 nieuwe vragen (vooral voorrang)"; weakName alleen als er nieuwe uit dat onderwerp bij zitten.
  function planDetail(nMistakes, nDue, nFresh, weakName) {
    var parts = [];
    if (nMistakes) parts.push(nMistakes + ' ' + (nMistakes === 1 ? 'fout' : 'fouten'));
    if (nDue) parts.push(nDue + ' ' + (nDue === 1 ? 'kaart' : 'kaarten'));
    if (nFresh) parts.push(nFresh + ' ' + (nFresh === 1 ? 'nieuwe vraag' : 'nieuwe vragen') + (weakName ? ' (vooral ' + weakName + ')' : ''));
    return parts.join(' · ');
  }

  // Uitlegregels onder het plan (moduslijn en eventueel AC-19), in deze volgorde.
  function planNotes(rules) {
    var out = [];
    if (rules.mode === 'geen') out.push('Nog geen examendatum: 10 nieuwe vragen per dag.');
    else if (rules.mode === 'onderhoud') out.push('Je examen kan nu elke dag zijn. Daarom geen nieuwe vragen meer: alleen herhalen, en om de 2 dagen een proefexamen.');
    else if (rules.mode === 'datum' && rules.D === 1) out.push('Morgen is je examen. Vandaag alleen je open fouten, geen nieuwe vragen en geen proefexamen.');
    else if (rules.mode === 'datum' && rules.D === 0) out.push('Vandaag is je examen. Wil je nog iets doen? Herhaal dan alleen een paar fouten.');
    if (rules.shortfall) out.push('Je haalt niet alle nieuwe vragen vóór je examen; overweeg een latere datum.');
    return out;
  }

  // "Oefen <onderwerp>": open fouten van dat onderwerp (AC-21-volgorde), dan nooit gezien, dan oudste "seen". Id's.
  function topicPractice(state, bank, topic, now, max) {
    var list = bank.filter(function (x) { return x.topic === topic; });
    var mistakes = orderMistakes(state.mistakes, openIds(state, index(list)), dayKey(now));
    var picked = {};
    mistakes.forEach(function (id) { picked[id] = true; });
    var rest = freshFirst(state, list.filter(function (x) { return !picked[x.id]; })).map(function (x) { return x.id; });
    return mistakes.concat(rest).slice(0, max || 15);
  }

  var GOAL = 46;   // eis 1: zoveel goed in elk van de laatste 3 proefexamens
  var ANSWERS = 20; // eis 2: over zoveel antwoorden per onderwerp

  // "Klaar voor het examen?" (AC-29 … AC-32, AC-34). name(topic) geeft de weergavenaam.
  // Alleen onderwerpen met items in de bank tellen; alleen proefexamens van 50 vragen tellen voor eis 1.
  function readiness(state, bank, now, name) {
    var nm = name || String;
    var known = index(bank);
    var topics = [];
    bank.forEach(function (x) { if (topics.indexOf(x.topic) < 0) topics.push(x.topic); });

    // Eis 1: de laatste 3 proefexamens allemaal 46 of meer.
    var exams = (state.exams || []).filter(function (e) { return Number(e.total) === 50 && isNum(Number(e.score)); });
    var last3 = exams.slice(-3).map(function (e) { return Number(e.score); });
    var run = 0;
    for (var i = exams.length - 1; i >= 0 && run < 3 && Number(exams[i].score) >= GOAL; i--) run++;
    var lowest = last3.length ? Math.min.apply(null, last3) : null;
    var e1 = { met: run >= 3, missing: 3 - run };
    e1.text = last3.length < 3
      ? last3.length + ' van 3 gedaan' + (last3.length ? ', laagste ' + lowest : '')
      : 'Laatste 3: ' + last3.join(', ') + (e1.met ? '' : ' (laagste ' + lowest + ')');

    // Eis 2: elk onderwerp 90% of meer over de laatste 20 antwoorden.
    var rows = topics.map(function (t) {
      var h = (hasKey(state.history, t) && Array.isArray(state.history[t]) ? state.history[t] : []).slice(-ANSWERS);
      var n = h.length;
      var ok = h.filter(function (x) { return x && x.ok === true; }).length;
      var pct = n ? Math.floor(ok / n * 100) : null;
      return {
        topic: t, name: String(nm(t)), ok: ok, n: n, pct: pct, met: n >= ANSWERS && ok * 10 >= n * 9,
        text: !n ? 'nog geen antwoorden' : pct + '% (' + ok + '/' + n + ')' + (n < ANSWERS ? ', nog te weinig antwoorden (' + n + '/' + ANSWERS + ')' : '')
      };
    }).sort(function (a, b) {
      return (a.met - b.met) || ((a.n ? 1 : 0) - (b.n ? 1 : 0)) || (a.n && b.n ? a.ok * b.n - b.ok * a.n : 0) ||
        a.n - b.n || a.name.localeCompare(b.name, 'nl');
    });
    var unmet = rows.filter(function (r) { return !r.met; });
    var e2 = {
      met: !unmet.length, rows: rows, total: rows.length,
      text: unmet.length ? (rows.length - unmet.length) + ' van ' + rows.length + ' onderwerpen gehaald' : 'Alle ' + rows.length + ' onderwerpen 90% of meer'
    };

    // Eis 3: geen open fouten van vóór eergisteren (zonder `last`: telt als oud).
    var cutoff = dayKey(addDays(now, -2));
    var open = openIds(state, known);
    var last = function (id) { return lastOf(state.mistakes, id); };
    var old = open.filter(function (id) { return last(id) === -Infinity || dayKey(last(id)) < cutoff; })
      .sort(function (a, b) { return (last(a) - last(b)) || cmp(a, b); });
    var e3 = {
      met: !old.length, cutoff: cutoff, ids: old, open: open.length,
      text: !open.length ? 'Geen open fouten'
        : old.length ? old.length + ' ' + (old.length === 1 ? 'fout' : 'fouten') + ' van vóór ' + dayLabel(cutoff)
        : 'Geen fouten van vóór ' + dayLabel(cutoff)
    };

    var noData = !(state.exams || []).length && !rows.some(function (r) { return r.n; });
    var missing = [e1, e2, e3].filter(function (e) { return !e.met; });
    var status, headline;
    if (noData) { status = 'geen'; headline = 'Nog geen gegevens'; }
    else if (!missing.length) { status = 'klaar'; headline = 'Klaar volgens deze app'; }
    else if (missing.length > 1) { status = 'nog-niet'; headline = 'Nog niet'; }
    else {
      status = 'bijna';
      if (!e1.met) headline = 'nog ' + e1.missing + ' ' + (e1.missing === 1 ? 'proefexamen' : 'proefexamens') + ' met ' + GOAL + ' of meer goed';
      else if (!e2.met) headline = unmet.length === 1 ? 'nog 1 onderwerp (' + unmet[0].name + ')' : 'nog ' + unmet.length + ' onderwerpen';
      else headline = old.length === 1 ? 'nog 1 oude fout' : 'nog ' + old.length + ' oude fouten';
      headline = 'Bijna: ' + headline;
    }
    var seen = bank.filter(function (x) { return wasSeen(state, x.id); }).length;
    return { noData: noData, status: status, headline: headline, eis1: e1, eis2: e2, eis3: e3, seen: seen, total: bank.length };
  }

  RB.util = {
    parseNum: parseNum, fmtNum: fmtNum, dayStart: dayStart, dayKey: dayKey, addDays: addDays,
    isDay: isDay, isMonth: isMonth, daysUntil: daysUntil, monthKey: monthKey, monthList: monthList,
    monthName: monthName, monthLabel: monthLabel, dayLabel: dayLabel, examInfo: examInfo, tallyTopics: tallyTopics,
    topicRows: topicRows, weakTopics: weakTopics, changeLine: changeLine, weakList: weakList,
    joinNames: joinNames, okTodayLine: okTodayLine,
    dayDiff: dayDiff, wasSeen: wasSeen, freshFirst: freshFirst, orderMistakes: orderMistakes, planRules: planRules,
    mockDue: mockDue, lastActivity: lastActivity, dayPlan: dayPlan, minutes: minutes, todayStatus: todayStatus,
    planDetail: planDetail, planNotes: planNotes, replanToday: replanToday, topicPractice: topicPractice, readiness: readiness
  };
})();
