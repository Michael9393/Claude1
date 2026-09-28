// Voortgang opslaan in localStorage: flashcards (Leitner), foutenlogboek en proefexamens.
(function () {
  var RB = (window.RB = window.RB || {});
  var KEY = 'rijbewijs-b-v1';
  var DAY = 24 * 60 * 60 * 1000;
  // Wachttijd per Leitner-bak (in dagen). Bak 0 = opnieuw leren.
  var INTERVALS = [0, 1, 2, 4, 8, 16];

  function empty() {
    return { srs: {}, mistakes: {}, exams: [], stats: { answered: 0, correct: 0 }, examDate: null, done: {} };
  }

  var state = empty();
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      state = Object.assign(empty(), parsed);
    }
  } catch (e) { /* geen opslag beschikbaar: werk in het geheugen */ }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* negeren */ }
  }

  RB.store = {
    state: function () { return state; },

    // Elk antwoord (in elke oefening) komt hier langs.
    recordAnswer: function (item, correct, given) {
      state.stats.answered++;
      if (correct) state.stats.correct++;
      var m = state.mistakes[item.id];
      if (!correct) {
        if (!m) m = state.mistakes[item.id] = { count: 0, streak: 0 };
        m.count++;
        m.streak = 0;
        m.resolved = false;
        m.last = Date.now();
        m.given = given == null ? null : String(given);
        m.topic = item.topic;
      } else if (m) {
        m.streak++;
        // Twee keer achter elkaar goed = fout opgelost (blijft wel in de statistiek).
        if (m.streak >= 2) m.resolved = true;
      }
      save();
    },

    openMistakes: function () {
      return Object.keys(state.mistakes).filter(function (id) {
        return !state.mistakes[id].resolved;
      });
    },

    // Flashcards
    card: function (id) { return state.srs[id]; },
    reviewCard: function (id, knew) {
      var c = state.srs[id] || { box: 0 };
      c.box = knew ? Math.min(c.box + 1, INTERVALS.length - 1) : 0;
      c.due = Date.now() + INTERVALS[c.box] * DAY;
      state.srs[id] = c;
      save();
    },
    isDue: function (id) {
      var c = state.srs[id];
      return c && c.due <= Date.now();
    },

    // Voorrangssituaties: laatste poging goed (true) of fout (false).
    markDone: function (id, ok) {
      state.done[id] = ok;
      save();
    },

    addExam: function (result) {
      state.exams.push(result);
      if (state.exams.length > 50) state.exams.shift();
      save();
    },

    setExamDate: function (value) {
      state.examDate = value || null;
      save();
    },

    reset: function () {
      state = empty();
      save();
    }
  };
})();
