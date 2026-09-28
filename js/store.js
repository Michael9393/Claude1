// Voortgang opslaan in localStorage: flashcards (Leitner), foutenlogboek en proefexamens.
(function () {
  var RB = (window.RB = window.RB || {});
  var U = RB.util;
  var KEY = 'rijbewijs-b-v1';
  var VERSION = 2;
  // Wachttijd per Leitner-bak (in dagen). Bak 0 = opnieuw leren.
  var INTERVALS = [0, 1, 2, 4, 8, 16];

  function empty() {
    return { version: VERSION, srs: {}, mistakes: {}, exams: [], stats: { answered: 0, correct: 0 }, examDate: null, done: {} };
  }

  function isObj(v) { return v != null && typeof v === 'object' && !Array.isArray(v); }
  function num(v) { return typeof v === 'number' && isFinite(v) ? v : 0; }
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
    s.exams = Array.isArray(raw.exams) ? raw.exams.filter(isObj) : [];
    if (isObj(raw.stats)) s.stats = { answered: num(raw.stats.answered), correct: num(raw.stats.correct) };
    if (typeof raw.examDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.examDate)) s.examDate = raw.examDate;
    return s;
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
    recordAnswer: function (item, correct, given) {
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
    recordStat: function (correct) {
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

    setExamDate: function (value) {
      state.examDate = /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : null;
      save();
    },

    reset: function () {
      state = empty();
      save();
    },

    _clean: clean
  };
})();
