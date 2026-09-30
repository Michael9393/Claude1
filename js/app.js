(function () {
  var RB = window.RB;
  var store = RB.store;
  var U = RB.util;
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
  var fmtNum = U.fmtNum;
  var parseNum = U.parseNum;
  function topicName(t) { return RB.topics[t] || t; }
  function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }
  function has(obj, k) { return Object.prototype.hasOwnProperty.call(obj, k); }

  // Bord-SVG met een naam voor schermlezers. In een quiz geven we een neutrale naam, anders verklap je het antwoord.
  function signSvg(sign, label) {
    return sign.svg.replace('role="img"', 'role="img" aria-label="' + esc(label) + '"');
  }

  // ---------- Alle oefenbare items in één register ----------
  var items = {};
  RB.questions.forEach(function (q) {
    items[q.id] = Object.assign({ kind: q.type }, q);
  });
  RB.signs.forEach(function (s) {
    items['bord-' + s.id] = { id: 'bord-' + s.id, kind: 'sign', part: 'kennis', topic: 'borden', sign: s };
  });
  RB.voorrang.forEach(function (v, i) {
    items[v.id] = { id: v.id, kind: 'voorrang', part: 'inzicht', topic: 'voorrang', scenario: v, nr: i + 1 };
  });
  RB.items = items;
  function all(filter) {
    return Object.keys(items).map(function (k) { return items[k]; }).filter(filter || function () { return true; });
  }
  function known(id) { return has(items, id); }

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
  function sourceHtml(item) {
    return item.source ? '<p class="bron">Bron: ' + esc(item.source) + '</p>' : '';
  }

  // Maak van een item een vraag met keuzes (gehusseld, behalve Ja/Nee).
  function buildChoices(item, reverse) {
    if (item.kind === 'sign') {
      var s = item.sign;
      var same = RB.signs.filter(function (o) { return o.id !== s.id && o.group === s.group; });
      var other = RB.signs.filter(function (o) { return o.id !== s.id && o.group !== s.group; });
      var distract = sample(same, 3);
      if (distract.length < 3) distract = distract.concat(sample(other, 3 - distract.length));
      return shuffle([s].concat(distract)).map(function (o, i) {
        return { html: reverse ? signSvg(o, 'Bord ' + (i + 1)) : esc(o.name), text: o.name, correct: o.id === s.id };
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
        html += '<p class="prompt">Wat betekent dit bord?</p><div class="bord groot">' + signSvg(item.sign, 'Verkeersbord') + '</div>';
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
      html += '<form class="invul"><input type="text" inputmode="decimal" autocomplete="off" aria-label="Antwoord in ' + esc(item.unit) + '" placeholder="Getal"> <span class="eenheid">' + esc(item.unit) + '</span></form>' +
        '<p class="hint invul-hint" role="alert" hidden></p>';
    }
    html += '<div class="feedback" role="status" aria-live="polite" hidden></div><div class="rij acties"></div></div>';
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
      if (item.kind === 'voorrang') {
        // Laat op het kruispunt zelf de juiste volgorde zien.
        el.querySelector('.kruispunt-wrap').innerHTML = RB.renderIntersection(item.scenario, item.scenario.order, { still: true });
        el.querySelector('[data-act=wis]').disabled = true;
      }
      feedback.hidden = false;
      feedback.className = 'feedback ' + (correct ? 'goed' : 'fout');
      feedback.innerHTML = '<strong>' + (correct ? 'Goed!' : 'Helaas, fout.') + '</strong> ' +
        (correct ? '' : 'Juist antwoord: <strong>' + esc(correctText(item)) + '</strong>. ') +
        (item.kind === 'voorrang' ? '<span class="klein">De cijfers op het kruispunt tonen de juiste volgorde.</span>' : '') +
        '<p>' + esc(explainText(item)) + '</p>' + sourceHtml(item);
      actions.innerHTML = button('Volgende', 'volgende');
      actions.querySelector('button').focus();
    }

    function drawCrossing(focusId) {
      el.querySelector('.kruispunt-wrap').innerHTML = RB.renderIntersection(item.scenario, picks);
      var n = item.scenario.vehicles.length;
      if (opts.exam) actions.innerHTML = picks.length === n ? button('Volgende', 'bevestig') : '';
      else actions.innerHTML = picks.length === n ? button('Controleer', 'bevestig') : '';
      // Houd de focus op het kruispunt (anders springt hij na elke keuze naar het begin van de pagina).
      if (focusId) {
        var next = picks.length === n ? actions.querySelector('button') : el.querySelector('.voertuig[data-id="' + focusId + '"]');
        if (next) next.focus();
      }
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
        drawCrossing(id);
        return;
      }
      if (act === 'wis') { picks = []; drawCrossing(); return; }

      if (t.hasAttribute('data-i')) {
        var i = +t.getAttribute('data-i');
        if (opts.exam) {
          selected = i;
          el.querySelectorAll('.keuze').forEach(function (b, j) {
            b.classList.toggle('gekozen', j === i);
            b.setAttribute('aria-pressed', j === i ? 'true' : 'false');
          });
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
      var hint = el.querySelector('.invul-hint');
      var v = parseNum(input.value);
      if (v === null) {
        hint.hidden = false;
        hint.textContent = input.value.trim() ? 'Dat is geen getal. Typ alleen het getal, bijvoorbeeld 50 of 0,5.' : 'Vul eerst een getal in.';
        input.focus();
        return;
      }
      hint.hidden = true;
      input.disabled = true;
      var ok = Math.abs(v - item.answer) < 1e-9;
      if (!opts.exam) input.classList.add(ok ? 'juist' : 'onjuist');
      finish(ok, fmtNum(v));
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
  // opts.reverse: borden omgekeerd. opts.afterAnswer(item, ok): extra werk per antwoord.
  function runSession(title, list, again, opts) {
    opts = opts || {};
    var i = 0, score = 0, wrong = [];
    function next() {
      if (i >= list.length) return summary();
      main.innerHTML = '<section class="kaart"><div class="kop"><h1>' + esc(title) + '</h1><span class="teller">' + (i + 1) + ' / ' + list.length + '</span></div>' +
        '<div class="voortgang"><div style="width:' + pct(i, list.length) + '%"></div></div><div class="q"></div></section>';
      var item = list[i];
      renderQuestion(main.querySelector('.q'), item, {
        reverse: opts.reverse,
        onAnswer: function (ok, given) {
          store.recordAnswer(item, ok, given);
          if (ok) score++; else wrong.push(item);
          if (item.kind === 'voorrang') store.markDone(item.id, ok);
          if (opts.afterAnswer) opts.afterAnswer(item, ok);
        },
        onNext: function () { i++; next(); }
      });
    }
    function summary() {
      main.innerHTML = '<section class="kaart"><h1>' + esc(title) + ': klaar</h1>' +
        '<p class="score">' + score + ' / ' + list.length + ' goed (' + pct(score, list.length) + '%)</p>' +
        (wrong.length ? '<p>Deze vragen staan nu in je <a href="#/fouten">foutenlogboek</a>:</p><ul class="lijst">' +
          wrong.map(function (w) { return '<li>' + esc(itemLabel(w)) + '</li>'; }).join('') + '</ul>' : '<p>Alles goed. Mooi!</p>') +
        (opts.note ? '<p class="klein">' + esc(opts.note) + '</p>' : '') +
        '<div class="rij">' + (again ? '<button class="knop" data-act="opnieuw">' + esc(opts.againLabel || 'Nog een ronde') + '</button>' : '') +
        '<a class="knop secundair" href="#/start">Naar start</a></div></section>';
      if (again) main.querySelector('[data-act=opnieuw]').onclick = again;
    }
    next();
  }
  // Klikfunctie voor een sessie waarbij "Nog een ronde" een nieuwe lijst maakt.
  function repeating(title, makeList, opts) {
    return function start() { runSession(title, makeList(), start, opts); };
  }
  // Open fouten sorteren: de laatst foute eerst.
  function newestMistake(a, b) {
    var m = store.state().mistakes;
    return (Number(m[b].last) || 0) - (Number(m[a].last) || 0);
  }

  // ---------- Vandaag: één knop voor wat je nu het beste kunt oefenen ----------
  // Open fouten (die vandaag nog niet goed waren), kaarten die aan de beurt zijn en een paar nieuwe vragen.
  function todayPlan() {
    var mistakes = store.openMistakes(known)
      .filter(function (id) { return !store.okToday(id); })
      .sort(newestMistake)
      .map(function (id) { return items[id]; });
    var inPlan = {};
    mistakes = mistakes.slice(0, 10);
    mistakes.forEach(function (x) { inPlan[x.id] = true; });
    var due = shuffle(flashcardPool('alles').filter(function (c) { return !inPlan[c.id] && store.isDue(c.id); })).slice(0, 10);
    due.forEach(function (x) { inPlan[x.id] = true; });
    // Nieuwe vragen, bij voorkeur uit het onderwerp met de meeste open fouten.
    var weak = weakestTopic();
    var fresh = shuffle(flashcardPool('alles').filter(function (c) { return !inPlan[c.id] && !store.card(c.id); }));
    fresh.sort(function (a, b) { return (b.topic === weak) - (a.topic === weak); });
    var nNew = Math.max(5, 15 - mistakes.length - due.length);
    fresh = fresh.slice(0, nNew);
    return { mistakes: mistakes, due: due, fresh: fresh, weak: weak, list: shuffle(mistakes.concat(due, fresh)) };
  }
  function weakestTopic() {
    var count = {};
    store.openMistakes(known).forEach(function (id) { var t = items[id].topic; count[t] = (count[t] || 0) + 1; });
    var best = null;
    Object.keys(count).forEach(function (t) { if (!best || count[t] > count[best]) best = t; });
    return best;
  }
  function runToday() {
    var plan = todayPlan();
    runSession('Vandaag', plan.list, runToday, {
      againLabel: 'Nog een ronde',
      note: 'Een fout is opgelost als je hem op twee verschillende dagen goed hebt. Wat je vandaag goed had, komt morgen terug.',
      // Alles uit "Vandaag" (behalve voorrang) gaat ook in de herhaling van de flashcards.
      afterAnswer: function (item, ok) { if (item.kind !== 'voorrang') store.reviewCard(item.id, ok); }
    });
  }

  // ---------- Views ----------
  var views = {};
  var TITLES = { start: 'Start', kaarten: 'Flashcards', borden: 'Verkeersborden', voorrang: 'Voorrang', getallen: 'Getallen', examen: 'Proefexamen', fouten: 'Foutenlogboek' };

  views.start = function () {
    var st = store.state();
    var plan = todayPlan();
    var cards = flashcardPool('alles');
    var fresh = cards.filter(function (c) { return !store.card(c.id); }).length;
    var due = cards.filter(function (c) { return store.isDue(c.id); }).length;
    var open = store.openMistakes(known).length;
    var last = st.exams[st.exams.length - 1];
    var parts = [];
    if (plan.mistakes.length) parts.push(plan.mistakes.length + ' ' + (plan.mistakes.length === 1 ? 'fout' : 'fouten') + ' herhalen');
    if (plan.due.length) parts.push(plan.due.length + ' ' + (plan.due.length === 1 ? 'kaart' : 'kaarten') + ' herhalen');
    if (plan.fresh.length) parts.push(plan.fresh.length + ' nieuwe vragen' + (plan.weak ? ' (vooral ' + topicName(plan.weak).toLowerCase() + ')' : ''));

    main.innerHTML =
      '<section class="kaart intro"><h1>Oefenen voor je theorie-examen auto (B)</h1>' +
      '<p class="belofte">Gratis, zonder account en zonder reclame. Bij elke vraag zie je op welke regel uit de wet het antwoord is gebaseerd.</p>' +
      '<div class="datum"><label for="examen-soort">Examendatum</label>' +
      '<div class="datum-rij"><select id="examen-soort">' +
      '<option value="geen">Nog niet gepland</option><option value="maand">Maand (schatting)</option><option value="datum">Precieze datum</option>' +
      '</select><span class="datum-veld"></span></div>' +
      '<p class="aftellen" role="status"></p><p class="klein datum-hint" hidden></p></div>' +
      '</section>' +
      '<section class="kaart vandaag"><h2>Vandaag</h2>' +
      (plan.list.length
        ? '<p>' + esc(parts.join(' · ')) + '. Ongeveer ' + Math.max(1, Math.round(plan.list.length * 0.5)) + ' minuten.</p>' +
          '<div class="rij"><button class="knop groot" data-act="vandaag">Start (' + plan.list.length + ' vragen)</button></div>'
        : '<p>Je hebt alles voor vandaag gedaan. Doe een proefexamen of kom morgen terug.</p>') +
      '</section>' +
      '<div class="tegels">' +
      tile('#/kaarten', 'Flashcards', due + ' te herhalen', fresh + ' nog niet gezien') +
      tile('#/borden', 'Verkeersborden', RB.signs.length + ' borden', 'Bord ↔ betekenis') +
      tile('#/voorrang', 'Voorrang', RB.voorrang.length + ' kruispunten', Object.keys(st.done).filter(function (k) { return st.done[k] && known(k); }).length + ' opgelost') +
      tile('#/getallen', 'Getallen', all(function (x) { return x.kind === 'num'; }).length + ' getallen', 'Snelheden, promilles, afstanden') +
      tile('#/examen', 'Proefexamen', last ? (last.passed ? 'Laatste: geslaagd' : 'Laatste: gezakt') : 'Nog niet gedaan', last ? examScore(last) : EXAM.n + ' vragen · ' + EXAM.minutes + ' minuten') +
      tile('#/fouten', 'Foutenlogboek', open + ' open ' + (open === 1 ? 'fout' : 'fouten'), st.stats.answered ? pct(st.stats.correct, st.stats.answered) + '% goed van ' + st.stats.answered : 'Nog niets beantwoord') +
      '</div>' +
      '<p class="noot">Dit is een eigen oefenapp met eigen vragen, geen officieel CBR-materiaal. Gevaarherkenning (de filmpjes in het echte examen) zit er nog niet in. Controleer twijfelgevallen altijd bij het CBR of in je theorieboek.</p>';
    examDateControl(main.querySelector('.datum'));
    var btn = main.querySelector('[data-act=vandaag]');
    if (btn) btn.onclick = runToday;
  };

  // Examendatum op de startpagina: "Nog niet gepland", een maand (schatting) of een precieze datum.
  // Bij een wijziging passen we alleen dit blok aan, nooit het datumveld waarin je aan het typen bent.
  function examDateControl(box) {
    var kindSel = box.querySelector('#examen-soort');
    var slot = box.querySelector('.datum-veld');
    var status = box.querySelector('.aftellen');
    var hint = box.querySelector('.datum-hint');
    var precise = false; // "Precieze datum" gekozen, maar nog geen datum opgeslagen
    var typedPast = false; // de getypte datum ligt voor vandaag (niet opgeslagen)

    function kind() {
      var st = store.state();
      return precise || st.examDate ? 'datum' : st.examMonth ? 'maand' : 'geen';
    }

    // Tweede keuzelijst of datumveld; alleen opnieuw tekenen als het soort verandert.
    function drawField() {
      var st = store.state();
      var k = kind();
      if (slot.getAttribute('data-soort') === k) return;
      slot.setAttribute('data-soort', k);
      if (k === 'maand') {
        var months = U.monthList(Date.now(), 12);
        var opts = months.map(function (m) {
          return '<option value="' + esc(m) + '"' + (m === st.examMonth ? ' selected' : '') + '>' + esc(U.monthLabel(m)) + '</option>';
        });
        // Een opgeslagen maand die niet (meer) in de lijst staat, blijft zichtbaar.
        if (months.indexOf(st.examMonth) < 0) {
          var past = U.examInfo(null, st.examMonth, Date.now()).phase === 'voorbij';
          opts.unshift('<option value="' + esc(st.examMonth) + '" selected' + (past ? ' data-voorbij="1"' : '') + '>' +
            esc(U.monthLabel(st.examMonth)) + (past ? ' (voorbij)' : '') + '</option>');
        }
        slot.innerHTML = '<select aria-label="Maand van je examen">' + opts.join('') + '</select>';
        var monthSel = slot.querySelector('select');
        monthSel.onchange = function () {
          store.setExamMonth(monthSel.value);
          var old = monthSel.querySelector('[data-voorbij]');
          if (old && !old.selected) old.remove();
          update();
        };
      } else if (k === 'datum') {
        slot.innerHTML = '<input type="date" aria-label="Dag van je examen" min="' + esc(U.dayKey()) + '" value="' + esc(st.examDate || '') + '">';
        var input = slot.querySelector('input');
        input.onchange = function () {
          var v = input.value;
          typedPast = false;
          if (!v) { precise = true; store.setExamDate(null); }
          else if (U.isDay(v) && U.daysUntil(v, Date.now()) >= 0) store.setExamDate(v);
          // Een dag in het verleden slaan we niet op. Tussenstanden tijdens het typen van het jaar
          // (Chrome meldt 0002, 0020, 0202, of 20271 bij een vijfde cijfer) negeren we, anders knippert de melding.
          else if (U.isDay(v) && Number(v.slice(0, 4)) >= 1000) typedPast = true;
          update();
        };
      } else {
        slot.innerHTML = '';
      }
    }

    function promptButton(before, label, after) {
      return esc(before) + '<button type="button" class="link-knop in-tekst" data-act="precies">' + esc(label) + '</button>' + esc(after);
    }

    // Statusregel en eventuele tip, zonder de invoervelden te vervangen.
    function update() {
      var st = store.state();
      var k = kind();
      kindSel.value = k;
      drawField();
      var info = U.examInfo(st.examDate, st.examMonth, Date.now());
      var text = '', tip = '';
      if (k === 'datum' && typedPast) {
        text = 'Die dag is al voorbij. Kies een dag vanaf vandaag.';
      } else if (k === 'datum' && info.mode !== 'datum') {
        text = 'Kies de dag van je examen.';
        if (info.mode === 'maand' && info.phase !== 'voorbij') text += ' Tot dan rekent het plan met ' + U.monthName(info.month) + '.';
        text = esc(text);
      } else if (info.mode === 'datum') {
        var days = info.days;
        text = days > 0 ? 'Nog <strong>' + days + '</strong> ' + (days === 1 ? 'dag' : 'dagen') + ' tot je examen.'
          : days === 0 ? '<strong>Vandaag is je examen. Succes!</strong>'
          : esc('Je examen was op ' + U.dayLabel(info.day) + '. Heb je een nieuwe datum? Vul die hier in.');
      } else if (info.mode === 'maand') {
        var name = U.monthName(info.month);
        if (info.phase === 'voorbij') {
          text = esc(name.charAt(0).toUpperCase() + name.slice(1) + ' is voorbij. Kies een nieuwe maand of een precieze datum.');
        } else if (info.phase === 'bezig') {
          text = esc('Examen in ' + name + ' (schatting) · het kan nu elke dag zijn');
          tip = promptButton('Heb je al een datum? ', 'Vul die in', ' voor een beter plan.');
        } else {
          text = esc('Examen in ' + name + ' (schatting) · plan rekent met 1 ' + name);
          if (info.phase === 'bijna') tip = promptButton('Al geboekt? ', 'Vul je examendatum in', ' voor een beter plan.');
        }
      } else {
        text = 'Weet je ongeveer wanneer? Kies dan een maand.';
      }
      if (status.innerHTML !== text) status.innerHTML = text;
      hint.hidden = !tip;
      hint.innerHTML = tip;
    }

    kindSel.onchange = function () {
      var st = store.state();
      var v = kindSel.value;
      typedPast = false;
      precise = v === 'datum';
      if (v === 'geen') store.setExamMonth(null);
      else if (v === 'maand') {
        // Voorkeuze: de maand van een opgeslagen datum als die in de lijst staat, anders volgende maand.
        var from = st.examDate && st.examDate.slice(0, 7);
        store.setExamMonth(from && U.monthList(Date.now(), 12).indexOf(from) >= 0 ? from : U.monthKey(Date.now(), 1));
      }
      update(); // de focus blijft op deze keuzelijst
    };
    hint.onclick = function (e) {
      if (!e.target.closest('[data-act=precies]')) return;
      precise = true;
      typedPast = false;
      update();
      slot.querySelector('input').focus();
    };
    update();
  }

  function tile(href, title, big, small) {
    return '<a class="tegel" href="' + href + '"><h2>' + esc(title) + '</h2><p class="groot">' + esc(big) + '</p><p class="klein">' + esc(small) + '</p></a>';
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
      var knownCards = pool.filter(function (c) { var s = store.card(c.id); return s && s.box >= 3; }).length;
      return '<li><div><strong>' + DECKS[k] + '</strong><span class="klein">' + due + ' te herhalen · ' + fresh + ' nieuw · ' + knownCards + ' / ' + pool.length + ' beheerst</span></div>' +
        '<button class="knop klein" data-deck="' + k + '"' + (due + fresh ? '' : ' disabled') + '>Start</button></li>';
    }).join('');
    main.innerHTML = '<section class="kaart"><h1>Flashcards</h1>' +
      '<p>Kaarten die je goed weet komen steeds later terug (na 1, 2, 4, 8 en 16 dagen). Weet je het niet, dan komt de kaart de volgende keer dat je oefent meteen weer terug. "Beheerst" betekent: drie keer achter elkaar goed.</p>' +
      '<ul class="stapels">' + rows + '</ul></section>';
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
      if (item.kind === 'sign') return '<p class="prompt">Wat betekent dit bord?</p><div class="bord groot">' + signSvg(item.sign, 'Verkeersbord') + '</div>';
      return '<p class="prompt">' + esc(item.q) + '</p>';
    }
    function back(item) {
      if (item.kind === 'sign') return '<p class="antwoord">' + esc(item.sign.name) + '</p><p>' + esc(item.sign.meaning) + '</p>';
      return '<p class="antwoord">' + esc(correctText(item)) + '</p><p>' + esc(item.explain) + '</p>' + sourceHtml(item);
    }
    function show() {
      if (i >= list.length) {
        main.innerHTML = '<section class="kaart"><h1>Stapel klaar</h1><p class="score">' + knew + ' / ' + list.length + ' wist je</p>' +
          '<div class="rij"><a class="knop" href="#/kaarten">Terug naar stapels</a></div></section>';
        return;
      }
      var item = list[i];
      main.innerHTML = '<section class="kaart flashcard"><div class="kop"><h1>' + DECKS[deck] + '</h1><span class="teller">' + (i + 1) + ' / ' + list.length + '</span></div>' +
        '<div class="voortgang"><div style="width:' + pct(i, list.length) + '%"></div></div>' +
        front(item) + '<div class="achterkant" hidden>' + back(item) + '</div>' +
        '<div class="rij acties"><button class="knop" data-act="draai">Toon antwoord</button></div>' +
        '<p class="klein toetsen">Toetsen: spatie = omdraaien, 1 = wist ik niet, 2 = wist ik.</p></section>';
      var actions = main.querySelector('.acties');
      function act(a) {
        if (a === 'draai') {
          main.querySelector('.achterkant').hidden = false;
          actions.innerHTML = '<button class="knop fout" data-act="nee">Wist ik niet</button><button class="knop goed" data-act="ja">Wist ik</button>';
          actions.querySelector('[data-act=ja]').focus();
        } else if (a === 'ja' || a === 'nee') {
          var ok = a === 'ja';
          if (ok) knew++;
          store.reviewCard(item.id, ok);
          // Jezelf eerlijk beoordelen is geen fout: alleen de statistiek, niet het foutenlogboek.
          store.recordStat(ok, item.id);
          i++;
          show();
        }
      }
      actions.onclick = function (e) { act(e.target.getAttribute('data-act')); };
      keyHandler = function (e) {
        var flipped = !main.querySelector('.achterkant').hidden;
        if (!flipped && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); act('draai'); }
        else if (flipped && e.key === '1') act('nee');
        else if (flipped && e.key === '2') act('ja');
      };
    }
    show();
  }
  var keyHandler = null;
  document.addEventListener('keydown', function (e) {
    if (keyHandler && main.querySelector('.flashcard') && !e.target.closest('input, textarea')) keyHandler(e);
  });

  // ----- Verkeersborden -----
  views.borden = function () {
    main.innerHTML = '<section class="kaart"><h1>Verkeersborden</h1>' +
      '<p>Oefen in twee richtingen, of bekijk eerst alle borden.</p>' +
      '<div class="rij"><button class="knop" data-mode="normaal">Bord → betekenis</button><button class="knop" data-mode="omgekeerd">Betekenis → bord</button></div>' +
      '<p class="noot">De borden zijn vereenvoudigd getekend, maar vorm en kleur kloppen met het echte bord.</p></section>' +
      '<section class="kaart"><h2>Alle borden</h2><div class="galerij">' + RB.signs.map(function (s) {
        return '<figure><div class="bord">' + signSvg(s, s.name) + '</div><figcaption><strong>' + esc(s.name) + '</strong><span>' + esc(s.meaning) + '</span></figcaption></figure>';
      }).join('') + '</div></section>';
    main.querySelectorAll('[data-mode]').forEach(function (b) {
      var rev = b.getAttribute('data-mode') === 'omgekeerd';
      b.onclick = repeating(rev ? 'Welk bord is het?' : 'Verkeersborden',
        function () { return sample(all(function (x) { return x.kind === 'sign'; }), 10); }, { reverse: rev });
    });
  };

  // ----- Voorrang -----
  views.voorrang = function () {
    var done = store.state().done;
    main.innerHTML = '<section class="kaart"><h1>Voorrang op kruispunten</h1>' +
      '<p>Tik de verkeersdeelnemers aan in de volgorde waarin ze mogen rijden. De pijl laat zien waar ze heen gaan.</p>' +
      '<div class="rij"><button class="knop" data-act="alle">Alle kruispunten oefenen</button></div>' +
      '<ul class="scenario-lijst">' + all(function (x) { return x.kind === 'voorrang'; }).map(function (it) {
        var v = it.scenario;
        var st = done[v.id];
        var mark = st === true ? '<span class="status goed" aria-label="goed">✓</span>' : st === false ? '<span class="status fout" aria-label="fout">✗</span>' : '<span class="status" aria-label="nog niet gedaan">○</span>';
        // De titel verklapt de regel, dus die zie je pas als je het kruispunt goed hebt gedaan.
        return '<li><button class="scenario" data-id="' + v.id + '">' + mark + '<span>Kruispunt ' + it.nr +
          (st === true ? '<span class="klein"> · ' + esc(v.title) + '</span>' : '') + '</span></button></li>';
      }).join('') + '</ul></section>';
    main.querySelector('[data-act=alle]').onclick = repeating('Voorrang', function () { return shuffle(all(function (x) { return x.kind === 'voorrang'; })); });
    main.querySelectorAll('.scenario').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-id');
        runSession('Kruispunt ' + items[id].nr, [items[id]], null);
      };
    });
  };

  // ----- Getallen -----
  views.getallen = function () {
    var nums = all(function (x) { return x.kind === 'num'; });
    main.innerHTML = '<section class="kaart"><h1>Getallen stampen</h1>' +
      '<p>Invulvragen over snelheden, promilles, afstanden en regels voor je rijbewijs. Een komma of punt mag allebei, ook voor duizendtallen (3.500).</p>' +
      '<div class="rij"><button class="knop" data-act="start">Reeks van 10</button><button class="knop secundair" data-act="alle">Alle ' + nums.length + '</button></div></section>' +
      '<section class="kaart"><details><summary>Spiekbriefje</summary><table class="tabel"><tbody>' +
      nums.map(function (n) { return '<tr><td>' + esc(n.q) + '</td><td class="getal">' + esc(fmtNum(n.answer) + ' ' + n.unit) + '</td></tr>'; }).join('') +
      '</tbody></table></details></section>';
    main.querySelector('[data-act=start]').onclick = repeating('Getallen', function () { return sample(nums, 10); });
    main.querySelector('[data-act=alle]').onclick = repeating('Getallen', function () { return shuffle(nums); });
  };

  // ----- Proefexamen -----
  // Het CBR-examen B (sinds 7 april 2025): 50 vragen door elkaar, 30 minuten, 44 goed om te slagen.
  // Gevaarherkenning zit daar als filmpjes tussen; die kan deze app nog niet.
  var EXAM = { n: 50, pass: 44, minutes: 30, voorrang: 6, inzicht: 22 };

  function examScore(e) {
    if (e.total != null) return Number(e.score) + ' / ' + Number(e.total) + ' goed';
    return 'Kennis ' + Number(e.kennis) + '/12 · Inzicht ' + Number(e.inzicht) + '/28 (oud formaat)';
  }

  views.examen = function () {
    var exams = store.state().exams;
    main.innerHTML = '<section class="kaart"><h1>Proefexamen</h1>' +
      '<p>Zoals het echte CBR-examen: <strong>' + EXAM.n + ' vragen</strong> door elkaar, <strong>' + EXAM.minutes + ' minuten</strong>, en je hebt er <strong>' + EXAM.pass + '</strong> goed nodig. ' +
      'Je ziet pas aan het eind wat je goed en fout had. Vragen die je niet op tijd beantwoordt, tellen als fout.</p>' +
      '<p class="noot">In het echte examen zitten ook gevaarherkenning en vragen met foto\'s. Die zitten niet in dit proefexamen, dus een voldoende hier is geen garantie.</p>' +
      '<div class="rij"><button class="knop" data-act="start">Start proefexamen</button></div></section>' +
      (exams.length ? '<section class="kaart"><h2>Eerdere proefexamens</h2><table class="tabel"><thead><tr><th>Datum</th><th>Score</th><th>Uitslag</th></tr></thead><tbody>' +
        exams.slice().reverse().slice(0, 10).map(function (e) {
          return '<tr><td>' + esc(new Date(Number(e.date)).toLocaleDateString('nl-NL')) + '</td><td>' + esc(examScore(e)) + '</td><td>' +
            (e.passed ? '<span class="status goed">Geslaagd</span>' : '<span class="status fout">Gezakt</span>') + '</td></tr>';
        }).join('') + '</tbody></table></section>' : '');
    main.querySelector('[data-act=start]').onclick = runExam;
  };

  function runExam() {
    var voorrang = sample(all(function (x) { return x.kind === 'voorrang'; }), EXAM.voorrang);
    var inzicht = sample(all(function (x) { return x.part === 'inzicht' && x.kind !== 'voorrang'; }), EXAM.inzicht);
    var kennis = sample(all(function (x) { return x.part === 'kennis'; }), EXAM.n - voorrang.length - inzicht.length);
    var list = shuffle(kennis.concat(inzicht, voorrang));
    var i = 0;
    var answers = [];
    var started = Date.now();
    var deadline = started + EXAM.minutes * 60000;
    var timer = null;
    var over = false;

    leaveGuard = function () { return confirm('Je bent bezig met een proefexamen. Stoppen? Je antwoorden worden niet opgeslagen.'); };
    cleanup = function () { clearInterval(timer); leaveGuard = null; };

    function clock() {
      var left = Math.max(0, deadline - Date.now());
      var el = main.querySelector('.klok');
      if (el) {
        var m = Math.floor(left / 60000), s = Math.floor(left / 1000) % 60;
        el.textContent = m + ':' + String(s).padStart(2, '0');
        el.classList.toggle('bijna', left < 5 * 60000);
      }
      if (!left) results(true);
    }

    function next() {
      if (i >= list.length) return results(false);
      var item = list[i];
      main.innerHTML = '<section class="kaart examen"><div class="kop"><h1>Proefexamen</h1>' +
        '<span class="teller">Vraag ' + (i + 1) + ' / ' + list.length + ' · <span class="klok" role="timer" aria-label="Resterende tijd"></span></span></div>' +
        '<div class="voortgang"><div style="width:' + pct(i, list.length) + '%"></div></div><div class="q"></div>' +
        '<div class="rij stop-rij"><button class="link-knop" data-act="stop">Examen stoppen</button></div></section>';
      clock();
      if (over) return; // tijd was net om: de uitslag staat er al
      main.querySelector('[data-act=stop]').onclick = function () {
        if (leaveGuard()) { cleanup(); go('#/examen'); }
      };
      renderQuestion(main.querySelector('.q'), item, {
        exam: true,
        onAnswer: function (ok, given) { answers.push({ item: item, ok: ok, given: given }); },
        onNext: function () { i++; next(); }
      });
    }

    function results(timeUp) {
      if (over) return;
      over = true;
      cleanup();
      answers.forEach(function (a) {
        store.recordAnswer(a.item, a.ok, a.given);
        if (a.item.kind === 'voorrang') store.markDone(a.item.id, a.ok);
      });
      var score = answers.filter(function (a) { return a.ok; }).length;
      var passed = score >= EXAM.pass;
      // Score per onderwerp; open vragen bij tijd-om tellen als fout, zodat het optelt tot de score.
      var topics = U.tallyTopics(list.map(function (item, k) { return { topic: item.topic, ok: k < answers.length && answers[k].ok }; }));
      store.addExam({ date: Date.now(), score: score, total: list.length, passed: passed, timeUp: timeUp, topics: topics });
      var mins = Math.round((Date.now() - started) / 60000);
      var wrong = answers.filter(function (a) { return !a.ok; });
      var skipped = list.length - answers.length;
      main.innerHTML = '<section class="kaart"><h1 tabindex="-1">Uitslag: ' + (passed ? '<span class="status goed">Geslaagd</span>' : '<span class="status fout">Gezakt</span>') + '</h1>' +
        '<p class="score">' + score + ' / ' + list.length + ' goed</p>' +
        '<p>' + (passed ? 'Je had er ' + EXAM.pass + ' nodig. Goed bezig!' : 'Je had er ' + EXAM.pass + ' nodig, dus nog ' + (EXAM.pass - score) + ' meer. Kijk je fouten na en probeer het nog eens.') + '</p>' +
        '<p class="noot">Gevaarherkenning en vragen met foto\'s zitten niet in dit proefexamen. Een voldoende hier is dus geen garantie voor het echte examen.</p>' +
        (timeUp ? '<p class="fout-tekst">De tijd was om. ' + skipped + ' ' + (skipped === 1 ? 'vraag telt' : 'vragen tellen') + ' als fout.</p>' : '<p class="klein">Tijd: ongeveer ' + mins + ' van de ' + EXAM.minutes + ' minuten.</p>') +
        (wrong.length ? '<h2>Nakijken</h2><ol class="nakijk">' + wrong.map(function (a) {
          return '<li><p><strong>' + esc(itemLabel(a.item)) + '</strong></p>' +
            (a.item.kind === 'voorrang' ? '<div class="kruispunt-wrap klein-kruispunt">' + RB.renderIntersection(a.item.scenario, a.item.scenario.order, { still: true }) + '</div>' : '') +
            '<p>Jouw antwoord: <span class="fout-tekst">' + esc(a.given) + '</span><br>Juist: <span class="goed-tekst">' + esc(correctText(a.item)) + '</span></p>' +
            '<p class="klein">' + esc(explainText(a.item)) + '</p></li>';
        }).join('') + '</ol>' : '<p>Alles goed!</p>') +
        '<div class="rij"><button class="knop" data-act="opnieuw">Nieuw proefexamen</button><a class="knop secundair" href="#/fouten">Naar foutenlogboek</a></div></section>';
      main.querySelector('[data-act=opnieuw]').onclick = runExam;
      window.scrollTo(0, 0);
      main.querySelector('h1').focus();
    }
    timer = setInterval(clock, 1000);
    next();
  }

  // ----- Foutenlogboek -----
  views.fouten = function () {
    var st = store.state();
    var ids = Object.keys(st.mistakes).filter(known);
    var openIds = ids.filter(function (id) { return !st.mistakes[id].resolved; });
    var ready = openIds.filter(function (id) { return !store.okToday(id); });
    var tomorrow = openIds.length - ready.length;
    var byTopic = {};
    ids.forEach(function (id) {
      var m = st.mistakes[id];
      var t = items[id].topic;
      byTopic[t] = byTopic[t] || { open: 0, total: 0, ids: [] };
      byTopic[t].total += m.count;
      if (!m.resolved) byTopic[t].open++;
      if (!m.resolved && !store.okToday(id)) byTopic[t].ids.push(id);
    });
    var topics = Object.keys(byTopic).sort(function (a, b) { return byTopic[b].total - byTopic[a].total; });
    var max = topics.length ? byTopic[topics[0]].total : 1;

    if (!ids.length) {
      main.innerHTML = '<section class="kaart"><h1>Foutenlogboek</h1><p>Nog geen fouten. Elke vraag die je fout beantwoordt (in elke oefening en in het proefexamen) komt hier te staan.</p>' +
        '<div class="rij"><a class="knop" href="#/start">Begin met oefenen</a></div></section>';
      return;
    }
    var recent = openIds.slice().sort(newestMistake);

    main.innerHTML = '<section class="kaart"><h1>Foutenlogboek</h1>' +
      '<p>' + openIds.length + ' open ' + (openIds.length === 1 ? 'fout' : 'fouten') + '. Een fout is opgelost als je die vraag daarna goed hebt op <strong>twee verschillende dagen</strong>. Zo weet je zeker dat je het onthoudt.</p>' +
      (tomorrow ? '<p class="klein">' + tomorrow + ' ' + (tomorrow === 1 ? 'fout had' : 'fouten had') + ' je vandaag al goed. Die komen morgen terug.</p>' : '') +
      '<div class="rij"><button class="knop" data-act="oefen"' + (ready.length ? '' : ' disabled') + '>Oefen mijn fouten (' + ready.length + ')</button></div></section>' +
      '<section class="kaart"><h2>Per onderwerp</h2><div class="balken">' + topics.map(function (t) {
        var b = byTopic[t];
        return '<div class="balk-rij"><span class="naam">' + esc(topicName(t)) + '</span>' +
          '<span class="balk" aria-hidden="true"><span style="width:' + pct(b.total, max) + '%"></span></span>' +
          '<span class="aantal">' + b.total + '× fout · ' + b.open + ' open</span>' +
          '<button class="knop klein secundair" data-topic="' + esc(t) + '"' + (b.ids.length ? '' : ' disabled') + '>Oefen</button></div>';
      }).join('') + '</div></section>' +
      (recent.length ? '<section class="kaart"><h2>Open fouten</h2><ul class="fouten-lijst">' + recent.map(function (id) {
        var m = st.mistakes[id];
        return '<li><strong>' + esc(itemLabel(items[id])) + '</strong><span class="klein">' + Number(m.count) + '× fout · ' + esc(topicName(items[id].topic)) +
          (m.given ? ' · laatste antwoord: ' + esc(m.given) : '') + (store.okToday(id) ? ' · vandaag goed, morgen nog een keer' : '') + '</span></li>';
      }).join('') + '</ul></section>' : '') +
      '<section class="kaart gevaarzone"><h2>Opnieuw beginnen</h2><p class="klein">Wist al je voortgang, fouten en proefexamens op dit apparaat.</p>' +
      '<button class="knop gevaar klein" data-act="reset">Alle voortgang wissen</button></section>';

    var practice = function (list) {
      var start = function () {
        var still = list.filter(function (x) { var m = store.state().mistakes[x.id]; return m && !m.resolved && !store.okToday(x.id); });
        if (!still.length) { go('#/fouten'); return; }
        runSession('Fouten oefenen', shuffle(still), start, {
          note: 'Wat je nu goed had, komt morgen nog één keer terug. Is het dan weer goed, dan is de fout opgelost.'
        });
      };
      start();
    };
    main.querySelector('[data-act=oefen]').onclick = function () { practice(ready.map(function (id) { return items[id]; })); };
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
  var leaveGuard = null; // functie die true geeft als je de pagina mag verlaten (bijv. tijdens een proefexamen)
  var cleanup = null;    // opruimen bij het verlaten van een pagina (bijv. de examenklok)
  var currentHash = location.hash;
  var restoring = false;

  function route() {
    if (cleanup) { cleanup(); cleanup = null; }
    leaveGuard = null;
    keyHandler = null;
    currentHash = location.hash;
    var name = (location.hash.replace(/^#\//, '') || 'start').split('/')[0];
    if (!has(views, name)) name = 'start';
    document.querySelectorAll('nav a').forEach(function (a) {
      var on = a.getAttribute('href') === '#/' + name;
      a.classList.toggle('actief', on);
      if (on) { a.setAttribute('aria-current', 'page'); a.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } else a.removeAttribute('aria-current');
    });
    document.title = (name === 'start' ? '' : TITLES[name] + ' · ') + 'Theorie Oefenen B';
    views[name]();
    window.scrollTo(0, 0);
  }
  // Naar een pagina gaan, ook als je daar al bent (dan komt er geen hashchange).
  function go(hash) {
    leaveGuard = null;
    if (location.hash === hash) route(); else location.hash = hash;
  }

  window.addEventListener('hashchange', function () {
    if (restoring) { restoring = false; return; }
    if (leaveGuard && !leaveGuard()) {
      restoring = true;
      location.hash = currentHash;
      return;
    }
    route();
  });
  // Ook als je op het huidige menu-item klikt (bijv. midden in een oefening) terug naar het overzicht.
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#/"]');
    if (!a || a.getAttribute('href') !== location.hash) return;
    e.preventDefault();
    if (leaveGuard && !leaveGuard()) return;
    route();
  });
  window.addEventListener('beforeunload', function (e) {
    if (leaveGuard) { e.preventDefault(); e.returnValue = ''; }
  });
  route();

  // Offline gebruiken en installeren (alleen als de app via http(s) geserveerd wordt).
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* offline werkt dan niet, de app wel */ });
  }
})();
