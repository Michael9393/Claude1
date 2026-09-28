(function () {
  var RB = window.RB;
  var store = RB.store;
  var main = document.getElementById('app');

  // ---------- Hulpfuncties ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function sample(arr, n) { return shuffle(arr).slice(0, n); }
  function fmtNum(n) { return String(n).replace('.', ','); }
  function parseNum(s) {
    var v = parseFloat(String(s).trim().replace(',', '.'));
    return isNaN(v) ? null : v;
  }
  function topicName(t) { return RB.topics[t] || t; }
  function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }

  // ---------- Alle oefenbare items in één register ----------
  var items = {};
  RB.questions.forEach(function (q) {
    items[q.id] = Object.assign({ kind: q.type }, q);
  });
  RB.signs.forEach(function (s) {
    items['bord-' + s.id] = { id: 'bord-' + s.id, kind: 'sign', part: 'kennis', topic: 'borden', sign: s };
  });
  RB.voorrang.forEach(function (v) {
    items[v.id] = { id: v.id, kind: 'voorrang', part: 'inzicht', topic: 'voorrang', scenario: v };
  });
  RB.items = items;
  function all(filter) {
    return Object.keys(items).map(function (k) { return items[k]; }).filter(filter || function () { return true; });
  }

  function itemLabel(item) {
    if (item.kind === 'sign') return 'Bord: ' + item.sign.name;
    if (item.kind === 'voorrang') return 'Voorrang: ' + item.scenario.title;
    return item.q;
  }
  function correctText(item) {
    if (item.kind === 'sign') return item.sign.name;
    if (item.kind === 'num') return fmtNum(item.answer) + ' ' + item.unit;
    if (item.kind === 'voorrang') return item.scenario.order.join(' → ');
    return item.options[item.answer];
  }
  function explainText(item) {
    if (item.kind === 'sign') return item.sign.meaning;
    if (item.kind === 'voorrang') return item.scenario.explain;
    return item.explain;
  }

  // Maak van een item een vraag met keuzes (gehusseld, behalve Ja/Nee).
  function buildChoices(item, reverse) {
    if (item.kind === 'sign') {
      var s = item.sign;
      var same = RB.signs.filter(function (o) { return o.id !== s.id && o.group === s.group; });
      var other = RB.signs.filter(function (o) { return o.id !== s.id && o.group !== s.group; });
      var distract = sample(same, 3);
      if (distract.length < 3) distract = distract.concat(sample(other, 3 - distract.length));
      return shuffle([s].concat(distract)).map(function (o) {
        return { html: reverse ? o.svg : esc(o.name), text: o.name, correct: o.id === s.id };
      });
    }
    var choices = item.options.map(function (o, i) { return { html: esc(o), text: o, correct: i === item.answer }; });
    var yesNo = item.options.length === 2 && item.options[0] === 'Ja' && item.options[1] === 'Nee';
    return yesNo ? choices : shuffle(choices);
  }

  // ---------- Eén vraag tonen ----------
  // opts.exam: geen directe feedback. opts.onAnswer(correct, given). opts.onNext().
  // opts.reverse: bij borden de betekenis tonen en het bord laten kiezen.
  function renderQuestion(el, item, opts) {
    var answered = false;
    var html = '<div class="vraag">';
    var choices = null;

    if (item.kind === 'sign') {
      choices = buildChoices(item, opts.reverse);
      if (opts.reverse) {
        html += '<p class="prompt">Welk bord is: <strong>' + esc(item.sign.name) + '</strong>?</p>';
      } else {
        html += '<p class="prompt">Wat betekent dit bord?</p><div class="bord groot">' + item.sign.svg + '</div>';
      }
    } else if (item.kind === 'voorrang') {
      html += '<p class="prompt">In welke volgorde gaan de verkeersdeelnemers? Tik ze aan in de juiste volgorde.</p>';
      if ((item.scenario.yieldArms || []).length) html += '<p class="hint">Witte driehoeken op de weg zijn haaientanden.</p>';
      if ((item.scenario.unpaved || []).length) html += '<p class="hint">De bruine weg is onverhard.</p>';
      html += '<div class="kruispunt-wrap"></div><div class="rij"><button class="knop secundair" data-act="wis">Opnieuw kiezen</button></div>';
    } else {
      html += '<p class="prompt">' + esc(item.q) + '</p>';
      if (item.kind === 'mc') choices = buildChoices(item);
    }

    if (choices) {
      html += '<div class="keuzes' + (opts.reverse ? ' borden-keuze' : '') + '">' + choices.map(function (c, i) {
        return '<button class="keuze" data-i="' + i + '">' + c.html + '</button>';
      }).join('') + '</div>';
    }
    if (item.kind === 'num') {
      html += '<form class="invul"><input type="text" inputmode="decimal" autocomplete="off" aria-label="Antwoord" placeholder="Getal"> <span class="eenheid">' + esc(item.unit) + '</span></form>';
    }
    html += '<div class="feedback" hidden></div><div class="rij acties"></div></div>';
    el.innerHTML = html;

    var feedback = el.querySelector('.feedback');
    var actions = el.querySelector('.acties');
    var selected = null;
    var picks = [];

    function button(label, act, cls) {
      return '<button class="knop ' + (cls || '') + '" data-act="' + act + '">' + label + '</button>';
    }

    function finish(correct, given) {
      answered = true;
      opts.onAnswer(correct, given);
      if (opts.exam) { opts.onNext(); return; }
      feedback.hidden = false;
      feedback.className = 'feedback ' + (correct ? 'goed' : 'fout');
      feedback.innerHTML = '<strong>' + (correct ? 'Goed!' : 'Helaas, fout.') + '</strong> ' +
        (correct ? '' : 'Juist antwoord: <strong>' + esc(correctText(item)) + '</strong>. ') +
        '<p>' + esc(explainText(item)) + '</p>';
      actions.innerHTML = button('Volgende', 'volgende');
      actions.querySelector('button').focus();
    }

    function drawCrossing() {
      el.querySelector('.kruispunt-wrap').innerHTML = RB.renderIntersection(item.scenario, picks);
      var n = item.scenario.vehicles.length;
      if (opts.exam) actions.innerHTML = picks.length === n ? button('Volgende', 'bevestig') : '';
      else actions.innerHTML = picks.length === n ? button('Controleer', 'bevestig') : '';
    }

    el.onclick = function (e) {
      var t = e.target.closest('[data-i],[data-act],.voertuig');
      if (!t) return;
      var act = t.getAttribute('data-act');
      if (act === 'volgende') { opts.onNext(); return; }
      if (answered) return;

      if (t.classList.contains('voertuig')) {
        var id = t.getAttribute('data-id');
        if (picks.indexOf(id) < 0) picks.push(id);
        drawCrossing();
        return;
      }
      if (act === 'wis') { picks = []; drawCrossing(); return; }

      if (t.hasAttribute('data-i')) {
        var i = +t.getAttribute('data-i');
        if (opts.exam) {
          selected = i;
          el.querySelectorAll('.keuze').forEach(function (b, j) { b.classList.toggle('gekozen', j === i); });
          actions.innerHTML = button('Volgende', 'bevestig');
          return;
        }
        el.querySelectorAll('.keuze').forEach(function (b, j) {
          b.disabled = true;
          if (choices[j].correct) b.classList.add('juist');
          else if (j === i) b.classList.add('onjuist');
        });
        finish(choices[i].correct, choices[i].text);
        return;
      }
      if (act === 'bevestig') {
        if (item.kind === 'voorrang') {
          finish(picks.join() === item.scenario.order.join(), picks.join(' → '));
        } else if (selected != null) {
          finish(choices[selected].correct, choices[selected].text);
        } else if (item.kind === 'num') {
          submitNum();
        }
      }
    };

    el.onkeydown = function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.voertuig')) {
        e.preventDefault();
        el.onclick(e);
      }
    };

    function submitNum() {
      var input = el.querySelector('input');
      var v = parseNum(input.value);
      if (v === null) { input.focus(); return; }
      input.disabled = true;
      finish(Math.abs(v - item.answer) < 1e-9, fmtNum(v));
    }

    if (item.kind === 'num') {
      var form = el.querySelector('form');
      form.onsubmit = function (e) { e.preventDefault(); if (!answered) submitNum(); };
      actions.innerHTML = button(opts.exam ? 'Volgende' : 'Controleer', 'bevestig');
      el.querySelector('input').focus();
    }
    if (item.kind === 'voorrang') drawCrossing();
  }

  // ---------- Oefensessie (met directe feedback) ----------
  function runSession(title, list, again, opts) {
    opts = opts || {};
    var i = 0, score = 0, wrong = [];
    function next() {
      if (i >= list.length) return summary();
      main.innerHTML = '<section class="kaart"><div class="kop"><h2>' + esc(title) + '</h2><span class="teller">' + (i + 1) + ' / ' + list.length + '</span></div>' +
        '<div class="voortgang"><div style="width:' + pct(i, list.length) + '%"></div></div><div class="q"></div></section>';
      var item = list[i];
      renderQuestion(main.querySelector('.q'), item, {
        reverse: opts.reverse,
        onAnswer: function (ok, given) {
          store.recordAnswer(item, ok, given);
          if (ok) score++; else wrong.push(item);
          if (item.kind === 'voorrang') store.markDone(item.id, ok);
        },
        onNext: function () { i++; next(); }
      });
    }
    function summary() {
      main.innerHTML = '<section class="kaart"><h2>' + esc(title) + ': klaar</h2>' +
        '<p class="score">' + score + ' / ' + list.length + ' goed (' + pct(score, list.length) + '%)</p>' +
        (wrong.length ? '<p>Deze vragen staan nu in je <a href="#/fouten">foutenlogboek</a>:</p><ul class="lijst">' +
          wrong.map(function (w) { return '<li>' + esc(itemLabel(w)) + '</li>'; }).join('') + '</ul>' : '<p>Alles goed. Mooi!</p>') +
        '<div class="rij"><button class="knop" data-act="opnieuw">Nog een ronde</button><a class="knop secundair" href="#/start">Naar start</a></div></section>';
      main.querySelector('[data-act=opnieuw]').onclick = again;
    }
    next();
  }

  // ---------- Views ----------
  var views = {};

  views.start = function () {
    var st = store.state();
    var cards = flashcardPool('alles');
    var due = cards.filter(function (c) { return store.isDue(c.id); }).length;
    var fresh = cards.filter(function (c) { return !store.card(c.id); }).length;
    var open = store.openMistakes().length;
    var last = st.exams[st.exams.length - 1];
    var days = null;
    if (st.examDate) {
      var d = new Date(st.examDate + 'T00:00:00');
      var today = new Date(); today.setHours(0, 0, 0, 0);
      days = Math.round((d - today) / 86400000);
    }
    main.innerHTML =
      '<section class="kaart intro"><h2>Oefenen voor je theorie-examen auto (B)</h2>' +
      '<label class="datum">Examendatum: <input type="date" value="' + (st.examDate || '') + '"></label>' +
      (days != null ? '<p class="aftellen">' + (days > 0 ? 'Nog <strong>' + days + '</strong> dagen tot je examen.' : days === 0 ? '<strong>Vandaag is je examen. Succes!</strong>' : 'Je examendatum is voorbij.') + '</p>' : '') +
      '</section>' +
      '<div class="tegels">' +
      tile('#/kaarten', 'Flashcards', due + ' te herhalen', fresh + ' nieuw') +
      tile('#/borden', 'Verkeersborden', RB.signs.length + ' borden', 'Bord ↔ betekenis') +
      tile('#/voorrang', 'Voorrang', RB.voorrang.length + ' kruispunten', Object.keys(st.done || {}).filter(function (k) { return st.done[k]; }).length + ' opgelost') +
      tile('#/getallen', 'Getallen', all(function (x) { return x.kind === 'num'; }).length + ' getallen', 'Snelheden, promilles, afstanden') +
      tile('#/examen', 'Proefexamen', last ? (last.passed ? 'Laatste: geslaagd' : 'Laatste: gezakt') : 'Nog niet gedaan', last ? 'Kennis ' + last.kennis + '/12 · Inzicht ' + last.inzicht + '/28' : '12 kennis + 28 inzicht') +
      tile('#/fouten', 'Foutenlogboek', open + ' open fouten', st.stats.answered ? pct(st.stats.correct, st.stats.answered) + '% goed van ' + st.stats.answered : 'Nog niets beantwoord') +
      '</div>' +
      '<p class="noot">Dit is een eigen oefenapp met eigen vragen, geen officieel CBR-materiaal. Het onderdeel gevaarherkenning zit er (nog) niet in. Controleer twijfelgevallen altijd bij het CBR of in je theorieboek.</p>';
    main.querySelector('input[type=date]').onchange = function (e) {
      store.setExamDate(e.target.value);
      views.start();
    };
  };
  function tile(href, title, big, small) {
    return '<a class="tegel" href="' + href + '"><h3>' + title + '</h3><p class="groot">' + esc(big) + '</p><p class="klein">' + esc(small) + '</p></a>';
  }

  // ----- Flashcards -----
  var DECKS = {
    alles: 'Alles',
    borden: 'Verkeersborden',
    getallen: 'Getallen',
    kennis: 'Kennis',
    inzicht: 'Inzicht'
  };
  function flashcardPool(deck) {
    return all(function (x) {
      if (x.kind === 'voorrang') return false;
      if (deck === 'borden') return x.kind === 'sign';
      if (deck === 'getallen') return x.kind === 'num';
      if (deck === 'kennis') return x.kind === 'mc' && x.part === 'kennis';
      if (deck === 'inzicht') return x.kind === 'mc' && x.part === 'inzicht';
      return true;
    });
  }

  views.kaarten = function () {
    var rows = Object.keys(DECKS).map(function (k) {
      var pool = flashcardPool(k);
      var due = pool.filter(function (c) { return store.isDue(c.id); }).length;
      var fresh = pool.filter(function (c) { return !store.card(c.id); }).length;
      var known = pool.filter(function (c) { var s = store.card(c.id); return s && s.box >= 3; }).length;
      return '<tr><td>' + DECKS[k] + '</td><td>' + due + '</td><td>' + fresh + '</td><td>' + known + ' / ' + pool.length + '</td>' +
        '<td><button class="knop klein" data-deck="' + k + '"' + (due + fresh ? '' : ' disabled') + '>Start</button></td></tr>';
    }).join('');
    main.innerHTML = '<section class="kaart"><h2>Flashcards</h2>' +
      '<p>Kaarten die je goed weet komen steeds later terug (na 1, 2, 4, 8 en 16 dagen). Weet je het niet, dan komt de kaart snel terug en gaat hij in je foutenlogboek.</p>' +
      '<table class="tabel"><thead><tr><th>Stapel</th><th>Te herhalen</th><th>Nieuw</th><th>Beheerst</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></section>';
    main.querySelectorAll('[data-deck]').forEach(function (b) {
      b.onclick = function () { flashcardSession(b.getAttribute('data-deck')); };
    });
  };

  function flashcardSession(deck) {
    var pool = flashcardPool(deck);
    var due = shuffle(pool.filter(function (c) { return store.isDue(c.id); }));
    var fresh = shuffle(pool.filter(function (c) { return !store.card(c.id); })).slice(0, 15);
    var list = due.concat(fresh).slice(0, 30);
    var i = 0, knew = 0;

    function front(item) {
      if (item.kind === 'sign') return '<p class="prompt">Wat betekent dit bord?</p><div class="bord groot">' + item.sign.svg + '</div>';
      return '<p class="prompt">' + esc(item.q) + '</p>';
    }
    function back(item) {
      if (item.kind === 'sign') return '<p class="antwoord">' + esc(item.sign.name) + '</p><p>' + esc(item.sign.meaning) + '</p>';
      return '<p class="antwoord">' + esc(correctText(item)) + '</p><p>' + esc(item.explain) + '</p>';
    }
    function show() {
      if (i >= list.length) {
        main.innerHTML = '<section class="kaart"><h2>Stapel klaar</h2><p class="score">' + knew + ' / ' + list.length + ' wist je</p>' +
          '<div class="rij"><a class="knop" href="#/kaarten">Terug naar stapels</a></div></section>';
        return;
      }
      var item = list[i];
      main.innerHTML = '<section class="kaart flashcard"><div class="kop"><h2>' + DECKS[deck] + '</h2><span class="teller">' + (i + 1) + ' / ' + list.length + '</span></div>' +
        '<div class="voortgang"><div style="width:' + pct(i, list.length) + '%"></div></div>' +
        front(item) + '<div class="achterkant" hidden>' + back(item) + '</div>' +
        '<div class="rij acties"><button class="knop" data-act="draai">Toon antwoord</button></div></section>';
      var actions = main.querySelector('.acties');
      actions.onclick = function (e) {
        var act = e.target.getAttribute('data-act');
        if (act === 'draai') {
          main.querySelector('.achterkant').hidden = false;
          actions.innerHTML = '<button class="knop fout" data-act="nee">Wist ik niet</button><button class="knop goed" data-act="ja">Wist ik</button>';
        } else if (act === 'ja' || act === 'nee') {
          var ok = act === 'ja';
          if (ok) knew++;
          store.reviewCard(item.id, ok);
          store.recordAnswer(item, ok, ok ? null : '(flashcard: wist ik niet)');
          i++;
          show();
        }
      };
    }
    show();
  }

  // ----- Verkeersborden -----
  views.borden = function () {
    main.innerHTML = '<section class="kaart"><h2>Verkeersborden</h2>' +
      '<p>Oefen in twee richtingen, of bekijk eerst alle borden.</p>' +
      '<div class="rij"><button class="knop" data-mode="normaal">Bord → betekenis</button><button class="knop" data-mode="omgekeerd">Betekenis → bord</button></div>' +
      '<p class="noot">De borden zijn vereenvoudigd getekend, maar vorm en kleur kloppen met het echte bord.</p></section>' +
      '<section class="kaart"><h2>Alle borden</h2><div class="galerij">' + RB.signs.map(function (s) {
        return '<figure><div class="bord">' + s.svg + '</div><figcaption><strong>' + esc(s.name) + '</strong><span>' + esc(s.meaning) + '</span></figcaption></figure>';
      }).join('') + '</div></section>';
    main.querySelectorAll('[data-mode]').forEach(function (b) {
      b.onclick = function () {
        var rev = b.getAttribute('data-mode') === 'omgekeerd';
        var start = function () {
          runSession(rev ? 'Welk bord is het?' : 'Wat betekent dit bord?', sample(all(function (x) { return x.kind === 'sign'; }), 10), start, { reverse: rev });
        };
        start();
      };
    });
  };

  // ----- Voorrang -----
  views.voorrang = function () {
    var done = store.state().done || {};
    main.innerHTML = '<section class="kaart"><h2>Voorrang op kruispunten</h2>' +
      '<p>Tik de verkeersdeelnemers aan in de volgorde waarin ze mogen rijden. De pijl laat zien waar ze heen gaan.</p>' +
      '<div class="rij"><button class="knop" data-act="alle">Alle kruispunten oefenen</button></div>' +
      '<ul class="scenario-lijst">' + RB.voorrang.map(function (v) {
        var mark = done[v.id] === true ? '<span class="status goed">✓</span>' : done[v.id] === false ? '<span class="status fout">✗</span>' : '<span class="status">·</span>';
        return '<li><button class="scenario" data-id="' + v.id + '">' + mark + esc(v.title) + '</button></li>';
      }).join('') + '</ul></section>';
    main.querySelector('[data-act=alle]').onclick = function () {
      var start = function () { runSession('Voorrang', shuffle(all(function (x) { return x.kind === 'voorrang'; })), start); };
      start();
    };
    main.querySelectorAll('.scenario').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-id');
        var start = function () { runSession('Voorrang', [items[id]], start); };
        start();
      };
    });
  };

  // ----- Getallen -----
  views.getallen = function () {
    var nums = all(function (x) { return x.kind === 'num'; });
    main.innerHTML = '<section class="kaart"><h2>Getallen stampen</h2>' +
      '<p>Invulvragen over snelheden, promilles, afstanden en regels voor je rijbewijs. Een komma of punt mag allebei.</p>' +
      '<div class="rij"><button class="knop" data-act="start">Reeks van 10</button><button class="knop secundair" data-act="alle">Alle ' + nums.length + '</button></div></section>' +
      '<section class="kaart"><details><summary>Spiekbriefje</summary><table class="tabel"><tbody>' +
      nums.map(function (n) { return '<tr><td>' + esc(n.q) + '</td><td class="getal">' + esc(fmtNum(n.answer) + ' ' + n.unit) + '</td></tr>'; }).join('') +
      '</tbody></table></details></section>';
    main.querySelector('[data-act=start]').onclick = function () {
      var start = function () { runSession('Getallen', sample(nums, 10), start); };
      start();
    };
    main.querySelector('[data-act=alle]').onclick = function () {
      var start = function () { runSession('Getallen', shuffle(nums), start); };
      start();
    };
  };

  // ----- Proefexamen -----
  var EXAM = { kennis: { n: 12, pass: 10 }, inzicht: { n: 28, pass: 25 } };

  views.examen = function () {
    var exams = store.state().exams;
    main.innerHTML = '<section class="kaart"><h2>Proefexamen</h2>' +
      '<p>Net als het echte examen: eerst kennis, dan inzicht. Je ziet pas aan het eind wat je goed en fout had.</p>' +
      '<table class="tabel"><thead><tr><th>Onderdeel</th><th>Vragen</th><th>Nodig om te slagen</th></tr></thead><tbody>' +
      '<tr><td>Gevaarherkenning</td><td>25</td><td>13 (niet in deze app)</td></tr>' +
      '<tr><td>Kennis</td><td>12</td><td>10</td></tr><tr><td>Inzicht</td><td>28</td><td>25</td></tr></tbody></table>' +
      '<div class="rij"><button class="knop" data-act="start">Start proefexamen</button></div></section>' +
      (exams.length ? '<section class="kaart"><h2>Eerdere proefexamens</h2><table class="tabel"><thead><tr><th>Datum</th><th>Kennis</th><th>Inzicht</th><th>Uitslag</th></tr></thead><tbody>' +
        exams.slice().reverse().slice(0, 10).map(function (e) {
          return '<tr><td>' + new Date(e.date).toLocaleDateString('nl-NL') + '</td><td>' + e.kennis + '/12</td><td>' + e.inzicht + '/28</td><td>' +
            (e.passed ? '<span class="status goed">Geslaagd</span>' : '<span class="status fout">Gezakt</span>') + '</td></tr>';
        }).join('') + '</tbody></table></section>' : '');
    main.querySelector('[data-act=start]').onclick = runExam;
  };

  function runExam() {
    var kennis = sample(all(function (x) { return x.part === 'kennis'; }), EXAM.kennis.n);
    var voorrang = all(function (x) { return x.kind === 'voorrang'; });
    var inzichtMc = all(function (x) { return x.part === 'inzicht' && x.kind !== 'voorrang'; });
    var inzicht = shuffle(sample(voorrang, 10).concat(sample(inzichtMc, EXAM.inzicht.n - 10)));
    var list = kennis.map(function (x) { return { item: x, part: 'kennis' }; })
      .concat(inzicht.map(function (x) { return { item: x, part: 'inzicht' }; }));
    var i = 0;
    var answers = [];
    var started = Date.now();

    function next() {
      if (i >= list.length) return results();
      var cur = list[i];
      var nInPart = cur.part === 'kennis' ? i + 1 : i + 1 - EXAM.kennis.n;
      main.innerHTML = '<section class="kaart examen"><div class="kop"><h2>' + (cur.part === 'kennis' ? 'Kennis' : 'Inzicht') + '</h2>' +
        '<span class="teller">' + nInPart + ' / ' + EXAM[cur.part].n + '</span></div>' +
        '<div class="voortgang"><div style="width:' + pct(i, list.length) + '%"></div></div><div class="q"></div>' +
        '<div class="rij"><button class="knop secundair klein" data-act="stop">Stoppen</button></div></section>';
      main.querySelector('[data-act=stop]').onclick = function () {
        if (confirm('Proefexamen stoppen? Je antwoorden worden niet opgeslagen.')) location.hash = '#/examen';
      };
      renderQuestion(main.querySelector('.q'), cur.item, {
        exam: true,
        onAnswer: function (ok, given) { answers.push({ item: cur.item, part: cur.part, ok: ok, given: given }); },
        onNext: function () { i++; next(); }
      });
    }

    function results() {
      answers.forEach(function (a) {
        store.recordAnswer(a.item, a.ok, a.given);
        if (a.item.kind === 'voorrang') store.markDone(a.item.id, a.ok);
      });
      var score = { kennis: 0, inzicht: 0 };
      answers.forEach(function (a) { if (a.ok) score[a.part]++; });
      var passK = score.kennis >= EXAM.kennis.pass;
      var passI = score.inzicht >= EXAM.inzicht.pass;
      var passed = passK && passI;
      store.addExam({ date: Date.now(), kennis: score.kennis, inzicht: score.inzicht, passed: passed });
      var mins = Math.round((Date.now() - started) / 60000);
      var wrong = answers.filter(function (a) { return !a.ok; });
      main.innerHTML = '<section class="kaart"><h2>Uitslag: ' + (passed ? '<span class="status goed">Geslaagd</span>' : '<span class="status fout">Gezakt</span>') + '</h2>' +
        '<table class="tabel"><tbody>' +
        '<tr><td>Kennis</td><td>' + score.kennis + ' / 12</td><td>' + (passK ? '✓' : '✗ (10 nodig)') + '</td></tr>' +
        '<tr><td>Inzicht</td><td>' + score.inzicht + ' / 28</td><td>' + (passI ? '✓' : '✗ (25 nodig)') + '</td></tr>' +
        '</tbody></table><p class="klein">Tijd: ongeveer ' + mins + ' min.</p>' +
        (wrong.length ? '<h3>Nakijken</h3><ol class="nakijk">' + wrong.map(function (a) {
          return '<li><p><strong>' + esc(itemLabel(a.item)) + '</strong></p>' +
            '<p>Jouw antwoord: <span class="fout-tekst">' + esc(a.given) + '</span><br>Juist: <span class="goed-tekst">' + esc(correctText(a.item)) + '</span></p>' +
            '<p class="klein">' + esc(explainText(a.item)) + '</p></li>';
        }).join('') + '</ol>' : '<p>Alles goed!</p>') +
        '<div class="rij"><button class="knop" data-act="opnieuw">Nieuw proefexamen</button><a class="knop secundair" href="#/fouten">Naar foutenlogboek</a></div></section>';
      main.querySelector('[data-act=opnieuw]').onclick = runExam;
    }
    next();
  }

  // ----- Foutenlogboek -----
  views.fouten = function () {
    var st = store.state();
    var ids = Object.keys(st.mistakes).filter(function (id) { return items[id]; });
    var openIds = ids.filter(function (id) { return !st.mistakes[id].resolved; });
    var byTopic = {};
    ids.forEach(function (id) {
      var m = st.mistakes[id];
      var t = items[id].topic;
      byTopic[t] = byTopic[t] || { open: 0, total: 0, ids: [] };
      byTopic[t].total += m.count;
      if (!m.resolved) { byTopic[t].open++; byTopic[t].ids.push(id); }
    });
    var topics = Object.keys(byTopic).sort(function (a, b) { return byTopic[b].total - byTopic[a].total; });
    var max = topics.length ? byTopic[topics[0]].total : 1;

    if (!ids.length) {
      main.innerHTML = '<section class="kaart"><h2>Foutenlogboek</h2><p>Nog geen fouten. Elke vraag die je fout beantwoordt (in elke oefening) komt hier te staan.</p></section>';
      return;
    }
    var recent = openIds.slice().sort(function (a, b) { return st.mistakes[b].last - st.mistakes[a].last; });

    main.innerHTML = '<section class="kaart"><h2>Foutenlogboek</h2>' +
      '<p>' + openIds.length + ' open fouten. Een fout is opgelost als je die vraag daarna twee keer achter elkaar goed hebt.</p>' +
      '<div class="rij"><button class="knop" data-act="oefen"' + (openIds.length ? '' : ' disabled') + '>Oefen mijn fouten (' + openIds.length + ')</button></div></section>' +
      '<section class="kaart"><h2>Per onderwerp</h2><div class="balken">' + topics.map(function (t) {
        var b = byTopic[t];
        return '<div class="balk-rij"><span class="naam">' + esc(topicName(t)) + '</span>' +
          '<span class="balk"><span style="width:' + pct(b.total, max) + '%"></span></span>' +
          '<span class="aantal">' + b.total + '× fout · ' + b.open + ' open</span>' +
          '<button class="knop klein secundair" data-topic="' + t + '"' + (b.open ? '' : ' disabled') + '>Oefen</button></div>';
      }).join('') + '</div></section>' +
      (recent.length ? '<section class="kaart"><h2>Open fouten</h2><ul class="fouten-lijst">' + recent.map(function (id) {
        var m = st.mistakes[id];
        return '<li><strong>' + esc(itemLabel(items[id])) + '</strong><span class="klein">' + m.count + '× fout · ' + esc(topicName(items[id].topic)) +
          (m.given ? ' · laatste antwoord: ' + esc(m.given) : '') + '</span></li>';
      }).join('') + '</ul></section>' : '') +
      '<section class="kaart"><button class="knop secundair klein" data-act="reset">Alle voortgang wissen</button></section>';

    var practice = function (list) {
      var start = function () {
        var still = list.filter(function (x) { return !store.state().mistakes[x.id].resolved; });
        if (!still.length) { location.hash = '#/fouten'; views.fouten(); return; }
        runSession('Fouten oefenen', shuffle(still), start);
      };
      start();
    };
    var oefen = main.querySelector('[data-act=oefen]');
    oefen.onclick = function () { practice(openIds.map(function (id) { return items[id]; })); };
    main.querySelectorAll('[data-topic]').forEach(function (b) {
      b.onclick = function () { practice(byTopic[b.getAttribute('data-topic')].ids.map(function (id) { return items[id]; })); };
    });
    main.querySelector('[data-act=reset]').onclick = function () {
      if (confirm('Weet je het zeker? Al je voortgang, fouten en proefexamens worden gewist.')) {
        store.reset();
        views.fouten();
      }
    };
  };

  // ---------- Router ----------
  function route() {
    var name = (location.hash.replace(/^#\//, '') || 'start').split('/')[0];
    if (!views[name]) name = 'start';
    document.querySelectorAll('nav a').forEach(function (a) {
      a.classList.toggle('actief', a.getAttribute('href') === '#/' + name);
    });
    views[name]();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  // Ook als je op het huidige menu-item klikt (bijv. midden in een oefening) terug naar het overzicht.
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#/"]');
    if (a && a.getAttribute('href') === location.hash) route();
  });
  route();
})();
