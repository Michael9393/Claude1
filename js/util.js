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

  RB.util = { parseNum: parseNum, fmtNum: fmtNum, dayStart: dayStart, dayKey: dayKey, addDays: addDays };
})();
