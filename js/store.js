// Voortgang opslaan in localStorage: flashcards (Leitner), foutenlogboek en proefexamens.
(function () {
  var RB = (window.RB = window.RB || {});
  var U = RB.util;
  var KEY = 'rijbewijs-b-v1';
  var VERSION = 3;
  // Antwoordgeschiedenis: zoveel antwoorden per onderwerp bewaren we.
  var HISTORY = 20;
  // Wachttijd per Leitner-bak (in dagen). Bak 0 = opnieuw leren.
  var INTERVALS = [0, 1, 2, 4, 8, 16];

  function empty() {
    return {
      version: VERSION, srs: {}, mistakes: {}, exams: [], stats: { answered: 0, correct: 0 }, examDate: null, done: {},
      examMonth: null, history: {}, seen: {}
    };
  }

  function isObj(v) { return v != null && typeof v === 'object' && !Array.isArray(v); }
  function num(v) { return typeof v === 'number' && isFinite(v) ? v : 0; }
  function isInt(v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v; }
  function own(obj, k) { return Object.prototype.hasOwnProperty.call(obj, k); }
  // Sleutels die een gewoon object kapot kunnen maken als je ze uit de opslag overneemt.
  function safeKey(k) { return k !== '__proto__' && k !== 'constructor' && k !== 'prototype'; }
  function eachValid(src, ok) {
    var out = {};
    if (isObj(src)) Object.keys(src).forEach(function (k) { if (ok(src[k])) out[k] = src[k]; });
    return out;
  }

  // Maak van wat er in de opslag staat (oud, kapot of van een andere versie) altijd een geldige toestand.
  function clean(raw) {
    var s = empty();
    if (!isObj(raw)) return s;
    s.srs = eachValid(raw.srs, function (c) { return isObj(c) && typeof c.box === 'number' && typeof c.due === 'number'; });
    s.mistakes = eachValid(raw.mistakes, function (m) { return isObj(m) && typeof m.count === 'number'; });
    s.done = eachValid(raw.done, function (v) { return typeof v === 'boolean'; });
    Object.keys(s.mistakes).forEach(function (id) {
      var m = s.mistakes[id];
      if (!(typeof m.last === 'number' && isFinite(m.last))) delete m.last;
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
    return s;
  }

  // Een proefexamen uit de opslag: null als het niet te redden is.
  // Oud formaat (kennis/inzicht, zonder score en total) blijft staan.
  function cleanExam(e) {
    if (!isObj(e) || typeof e.date !== 'number' || !isFinite(e.date)) return null;
    var out = { date: e.date, passed: !!e.passed, timeUp: !!e.timeUp };
    if (e.score != null || e.total != null) {
      if (!isInt(e.score) || !isInt(e.total) || e.score < 0 || e.score > e.total || e.total > 50) return null;
      out.score = e.score;
      out.total = e.total;
    } else {
      out.kennis = num(e.kennis);
      out.inzicht = num(e.inzicht);
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
  function addHistory(item, ok) {
    var t = String(item.topic);
    if (!safeKey(t)) return;
    var day = U.dayKey();
    var list = own(state.history, t) ? state.history[t] : (state.history[t] = []);
    if (list.some(function (h) { return h.id === item.id && h.day === day; })) return;
    list.push({ id: item.id, ok: !!ok, day: day });
    if (list.length > HISTORY) list.splice(0, list.length - HISTORY);
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
    recordAnswer: function (item, correct, given) {
      addHistory(item, correct);
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
