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

  // Kalenderdagen van vandaag (t) tot een dag "2026-11-20"; negatief als die dag voorbij is.
  function daysUntil(day, t) {
    var p = day.split('-');
    return Math.round((new Date(+p[0], p[1] - 1, +p[2]).getTime() - dayStart(t)) / 86400000);
  }

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
      if (!Object.prototype.hasOwnProperty.call(out, r.topic)) out[r.topic] = [0, 0];
      out[r.topic][1]++;
      if (r.ok) out[r.topic][0]++;
    });
    return out;
  }

  RB.util = {
    parseNum: parseNum, fmtNum: fmtNum, dayStart: dayStart, dayKey: dayKey, addDays: addDays,
    isDay: isDay, isMonth: isMonth, daysUntil: daysUntil, monthKey: monthKey, monthList: monthList,
    monthName: monthName, monthLabel: monthLabel, dayLabel: dayLabel, examInfo: examInfo, tallyTopics: tallyTopics
  };
})();
