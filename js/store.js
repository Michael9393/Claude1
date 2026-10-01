// Voortgang opslaan in localStorage: flashcards (Leitner), foutenlogboek en proefexamens.
(function () {
  var RB = (window.RB = window.RB || {});
  var U = RB.util;
  var KEY = 'rijbewijs-b-v1';
  var VERSION = 3;
  // Antwoordgeschiedenis: zoveel antwoorden per onderwerp bewaren we.
  var HISTORY = 20;
  // Bovengrens voor doel en "gedaan" per dag: meer is onzin uit de opslag.
  var MAX_DAY = 1000;
  // Wachttijd per Leitner-bak (in dagen). Bak 0 = opnieuw leren.
  var INTERVALS = [0, 1, 2, 4, 8, 16];

  function empty() {
    return {
      version: VERSION, srs: {}, mistakes: {}, exams: [], stats: { answered: 0, correct: 0 }, examDate: null, done: {},
      examMonth: null, history: {}, seen: {}, answeredDay: null, today: null, practisedDay: null
    };
  }

  function isObj(v) { return v != null && typeof v === 'object' && !Array.isArray(v); }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function num(v) { return isNum(v) ? v : 0; }
  function isInt(v) { return isNum(v) && Math.floor(v) === v; }
  // Sleutels die een gewoon object kapot kunnen maken als je ze uit de opslag overneemt.
  function safeKey(k) { return k !== '__proto__' && k !== 'constructor' && k !== 'prototype'; }
  function eachValid(src, ok) {
    var out = {};
    if (isObj(src)) Object.keys(src).forEach(function (k) { if (safeKey(k) && ok(src[k])) out[k] = src[k]; });
    return out;
  }

  // Maak van wat er in de opslag staat (oud, kapot of van een andere versie) altijd een geldige toestand.
  function clean(raw) {
    var s = empty();
    if (!isObj(raw)) return s;
    s.srs = eachValid(raw.srs, function (c) { return isObj(c) && typeof c.box === 'number' && typeof c.due === 'number'; });
    s.mistakes = eachValid(raw.mistakes, function (m) { return isObj(m) && typeof m.count === 'number'; });
    s.done = eachValid(raw.done, function (v) { return typeof v === 'boolean'; });
    // Velden van een fout gelijk trekken: wat niet precies klopt, telt als "nog open, opnieuw beginnen".
    Object.keys(s.mistakes).forEach(function (id) {
      var m = s.mistakes[id];
      if (!isNum(m.last)) delete m.last;
      m.resolved = m.resolved === true;
      m.okDay = U.isDay(m.okDay) ? m.okDay : null;
      if (m.streak === 1 && m.okDay) m.streak = 1;
      else if (m.streak === 2 && m.resolved) m.streak = 2;
      else m.streak = 0;
      if (m.given != null) m.given = String(m.given);
    });
    s.exams = Array.isArray(raw.exams) ? raw.exams.map(cleanExam).filter(Boolean) : [];
    if (isObj(raw.stats)) s.stats = { answered: num(raw.stats.answered), correct: num(raw.stats.correct) };
    if (U.isDay(raw.examDate)) s.examDate = raw.examDate;
    if (U.isMonth(raw.examMonth)) s.examMonth = raw.examMonth;
    if (isObj(raw.history)) {
      Object.keys(raw.history).forEach(function (t) {
        if (!safeKey(t) || !Array.isArray(raw.history[t])) return;
        var list = raw.history[t].filter(function (h) {
          return isObj(h) && typeof h.id === 'string' && typeof h.ok === 'boolean' && U.isDay(h.day);
        }).map(function (h) { return { id: h.id, ok: h.ok, day: h.day }; }).slice(-HISTORY);
        if (list.length) s.history[t] = list;
      });
    }
    if (isObj(raw.seen)) {
      Object.keys(raw.seen).forEach(function (id) {
        if (safeKey(id) && U.isDay(raw.seen[id])) s.seen[id] = raw.seen[id];
      });
    }
    // Welke vragen vandaag al in de geschiedenis staan; geen geldige dag of lijst: null.
    var ad = raw.answeredDay;
    if (isObj(ad) && U.isDay(ad.day) && isObj(ad.ids)) {
      s.answeredDay = { day: ad.day, ids: eachValid(ad.ids, function (v) { return typeof v === 'boolean'; }) };
    }
    // Doel van vandaag (deel 3); klopt er iets niet, dan null: de app rekent het opnieuw uit.
    var td = raw.today;
    if (isObj(td) && U.isDay(td.day) && isInt(td.target) && td.target >= 0 && td.target <= MAX_DAY &&
        isInt(td.practised) && td.practised >= 0 && td.practised <= MAX_DAY &&
        typeof td.mock === 'boolean') {
      s.today = { day: td.day, target: td.target, mock: td.mock, practised: td.practised };
    }
    // Welke vragen vandaag al als "gedaan" telden (buiten een proefexamen); geen geldige dag of lijst: null.
    var pd = raw.practisedDay;
    if (isObj(pd) && U.isDay(pd.day) && isObj(pd.ids)) {
      s.practisedDay = { day: pd.day, ids: eachValid(pd.ids, function (v) { return v === true; }) };
    }
    // "Gedaan" is minstens het aantal vragen dat vandaag als gedaan staat.
    if (s.today) s.today.practised = Math.min(MAX_DAY, Math.max(s.today.practised, practisedCount(s, s.today.day)));
    return s;
  }

  // Een proefexamen uit de opslag: null als het niet te redden is.
  // Oud formaat (kennis/inzicht, zonder score en total) blijft staan.
  function cleanExam(e) {
    if (!isObj(e) || !isNum(e.date)) return null;
    var out = { date: e.date, passed: !!e.passed, timeUp: !!e.timeUp };
    if (e.score != null || e.total != null) {
      if (!isInt(e.score) || !isInt(e.total) || e.score < 0 || e.score > e.total || e.total > 50) return null;
      out.score = e.score;
      out.total = e.total;
    } else {
      if (!isNum(e.kennis) || !isNum(e.inzicht)) return null;
      out.kennis = e.kennis;
      out.inzicht = e.inzicht;
    }
    // Score per onderwerp is optioneel: klopt er iets niet, dan vervalt alleen dit deel.
    if (isObj(e.topics)) {
      var topics = {};
      var ok = Object.keys(e.topics).every(function (t) {
        var v = e.topics[t];
        if (!safeKey(t) || !Array.isArray(v) || v.length !== 2 || !isInt(v[0]) || !isInt(v[1]) || v[0] < 0 || v[0] > v[1]) return false;
        topics[t] = [v[0], v[1]];
        return true;
      });
      if (ok) out.topics = topics;
    }
    return out;
  }

  // Eerste antwoord per vraag per dag komt in de geschiedenis van het onderwerp (max. HISTORY).
  // Of een vraag vandaag al telde, staat los van die ingekorte lijst in answeredDay.
  function addHistory(item, ok) {
    var t = String(item.topic);
    var id = String(item.id);
    if (!safeKey(t) || !safeKey(id)) return;
    var day = U.dayKey();
    if (!state.answeredDay || state.answeredDay.day !== day) state.answeredDay = { day: day, ids: {} };
    var ids = state.answeredDay.ids;
    var list = Object.prototype.hasOwnProperty.call(state.history, t) ? state.history[t] : (state.history[t] = []);
    // De lijst-check vangt ook antwoorden van vandaag van voor answeredDay bestond.
    if (Object.prototype.hasOwnProperty.call(ids, id) || list.some(function (h) { return h.id === id && h.day === day; })) return;
    ids[id] = true;
    list.push({ id: id, ok: !!ok, day: day });
    if (list.length > HISTORY) list.splice(0, list.length - HISTORY);
  }
  // Aantal vragen dat op dag day als "gedaan" telde.
  function practisedCount(st, day) {
    return st.practisedDay && st.practisedDay.day === day ? Object.keys(st.practisedDay.ids).length : 0;
  }
  // "Gedaan" (AC-27): het eerste antwoord per vraag per dag búiten een proefexamen. Los van answeredDay (AC-2),
  // anders telt een vraag die je vandaag eerst in het proefexamen had, bij Vandaag nooit meer mee.
  function addPractised(item) {
    var id = String(item.id);
    if (!safeKey(id)) return;
    var day = U.dayKey();
    if (!state.practisedDay || state.practisedDay.day !== day) state.practisedDay = { day: day, ids: {} };
    var ids = state.practisedDay.ids;
    if (Object.prototype.hasOwnProperty.call(ids, id)) return;
    ids[id] = true;
    if (state.today && state.today.day === day) state.today.practised = Math.min(MAX_DAY, state.today.practised + 1);
  }
  function markSeen(id) {
    if (typeof id === 'string' && safeKey(id)) state.seen[id] = U.dayKey();
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? clean(JSON.parse(raw)) : empty();
    } catch (e) { return empty(); /* geen opslag of kapotte JSON: begin opnieuw in het geheugen */ }
  }

  var state = load();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* negeren */ }
  }

  // Een ander tabblad heeft opgeslagen: neem die voortgang over, anders overschrijven we hem.
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('storage', function (e) {
      if (e.key === KEY) state = load();
    });
  }

  RB.store = {
    state: function () { return state; },

    // Elk antwoord op een vraag (niet de flashcards) komt hier langs.
    // Een fout is opgelost als je de vraag daarna goed hebt op twee verschillende dagen.
    // Ook de antwoordgeschiedenis en "gezien" (voor het plan en de examencheck).
    // inExam: antwoord uit een proefexamen; dat telt niet als "gedaan" voor het doel van vandaag.
    recordAnswer: function (item, correct, given, inExam) {
      addHistory(item, correct);
      if (!inExam) addPractised(item);
      markSeen(item.id);
      state.stats.answered++;
      if (correct) state.stats.correct++;
      var m = state.mistakes[item.id];
      if (!correct) {
        if (!m) m = state.mistakes[item.id] = { count: 0, streak: 0 };
        m.count++;
        m.streak = 0;
        m.okDay = null;
        m.resolved = false;
        m.last = Date.now();
        m.given = given == null ? null : String(given);
        m.topic = item.topic;
      } else if (m && !m.resolved) {
        var today = U.dayKey();
        if (!m.streak) { m.streak = 1; m.okDay = today; }
        else if (m.okDay !== today) { m.streak = 2; m.resolved = true; }
      }
      save();
    },

    // Alleen de statistiek bijhouden (flashcards: je beoordeelt jezelf, dat is geen fout).
    // Wel "gezien", maar niet in de antwoordgeschiedenis.
    recordStat: function (correct, id) {
      if (id != null) markSeen(id);
      state.stats.answered++;
      if (correct) state.stats.correct++;
      save();
    },

    // Open fouten; known(id) filtert fouten van vragen die niet meer bestaan.
    openMistakes: function (known) {
      return Object.keys(state.mistakes).filter(function (id) {
        return !state.mistakes[id].resolved && (!known || known(id));
      });
    },
    // Vandaag al een keer goed? Dan kan de fout pas morgen worden opgelost.
    okToday: function (id) {
      var m = state.mistakes[id];
      return !!(m && !m.resolved && m.streak && m.okDay === U.dayKey());
    },

    // Flashcards: de wachttijd telt in kalenderdagen, vanaf het begin van vandaag.
    card: function (id) { return state.srs[id]; },
    reviewCard: function (id, knew) {
      var c = state.srs[id] || { box: 0 };
      c.box = knew ? Math.min(c.box + 1, INTERVALS.length - 1) : 0;
      c.due = U.addDays(Date.now(), INTERVALS[c.box]);
      state.srs[id] = c;
      save();
    },
    isDue: function (id) {
      var c = state.srs[id];
      return !!c && c.due <= Date.now();
    },

    // Voorrangssituaties: laatste poging goed (true) of fout (false).
    markDone: function (id, ok) {
      state.done[id] = !!ok;
      save();
    },

    // Doel van vandaag: { day, target, mock, practised }, of null als het nog niet voor vandaag is vastgezet.
    today: function () {
      var t = state.today;
      return t && t.day === U.dayKey() ? t : null;
    },
    // Zet het doel van vandaag vast (of opnieuw, na een nieuwe examendatum). Wat vandaag al gedaan is, blijft tellen,
    // ook antwoorden van vóór het vastzetten (die staan in practisedDay).
    setToday: function (target, mock) {
      var day = U.dayKey();
      var n = Math.floor(Number(target));
      var before = state.today && state.today.day === day ? state.today.practised : 0;
      state.today = {
        day: day, target: isFinite(n) && n > 0 ? Math.min(MAX_DAY, n) : 0, mock: !!mock,
        practised: Math.min(MAX_DAY, Math.max(before, practisedCount(state, day)))
      };
      save();
      return state.today;
    },

    addExam: function (result) {
      state.exams.push(result);
      if (state.exams.length > 50) state.exams.shift();
      save();
    },

    // Precieze datum. Een geldige datum vervangt de maand; leeg of ongeldig wist alleen de datum.
    setExamDate: function (value) {
      state.examDate = U.isDay(value) ? value : null;
      if (state.examDate) state.examMonth = null;
      save();
    },
    // Maand (schatting) als "2026-11"; zonder geldige maand: "Nog niet gepland". Wist altijd de precieze datum.
    setExamMonth: function (value) {
      state.examMonth = U.isMonth(value) ? value : null;
      state.examDate = null;
      save();
    },

    reset: function () {
      state = empty();
      save();
    },

    _clean: clean
  };
})();
