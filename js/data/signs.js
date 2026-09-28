// Verkeersborden, getekend als vereenvoudigde SVG (geen officiële afbeeldingen).
(function () {
  var RB = (window.RB = window.RB || {});

  var RED = '#d4202a';
  var BLUE = '#1d4f9c';
  var YELLOW = '#f5c400';

  function svg(inner) {
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img">' + inner + '</svg>';
  }
  function redRing(content) {
    return svg('<circle cx="50" cy="50" r="44" fill="#fff" stroke="' + RED + '" stroke-width="10"/>' + (content || ''));
  }
  function blueDisc(content) {
    return svg('<circle cx="50" cy="50" r="47" fill="#fff"/><circle cx="50" cy="50" r="44" fill="' + BLUE + '"/>' + (content || ''));
  }
  function blueSquare(content) {
    return svg('<rect x="3" y="3" width="94" height="94" rx="8" fill="#fff"/><rect x="7" y="7" width="86" height="86" rx="6" fill="' + BLUE + '"/>' + (content || ''));
  }
  function warning(content) {
    return svg('<polygon points="50,8 94,88 6,88" fill="#fff" stroke="' + RED + '" stroke-width="8" stroke-linejoin="round"/>' + (content || ''));
  }
  function number(n, color, size) {
    return '<text x="50" y="52" text-anchor="middle" dominant-baseline="central" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="' + (size || 40) + '" fill="' + color + '">' + n + '</text>';
  }
  function diamond(extra) {
    return svg('<polygon points="50,2 98,50 50,98 2,50" fill="#fff" stroke="#222" stroke-width="2"/>' +
      '<polygon points="50,20 80,50 50,80 20,50" fill="' + YELLOW + '"/>' + (extra || ''));
  }
  function frontCar(cx, color) {
    return '<g fill="' + color + '"><path d="M' + (cx - 11) + ',56 l4,-12 h14 l4,12 z"/>' +
      '<rect x="' + (cx - 13) + '" y="55" width="26" height="10" rx="2"/>' +
      '<rect x="' + (cx - 12) + '" y="64" width="6" height="5"/><rect x="' + (cx + 6) + '" y="64" width="6" height="5"/></g>';
  }
  // Drie pijlen tegen de klok in (rotonde bij rechtsverkeer).
  function roundaboutArrows() {
    var out = '';
    for (var i = 0; i < 3; i++) {
      var a0 = (i * 120 + 20) * Math.PI / 180;
      var a1 = (i * 120 + 100) * Math.PI / 180;
      var r = 24;
      var x0 = 50 + r * Math.cos(a0), y0 = 50 - r * Math.sin(a0);
      var x1 = 50 + r * Math.cos(a1), y1 = 50 - r * Math.sin(a1);
      out += '<path d="M' + x0.toFixed(1) + ',' + y0.toFixed(1) + ' A' + r + ',' + r + ' 0 0 0 ' + x1.toFixed(1) + ',' + y1.toFixed(1) + '" fill="none" stroke="#fff" stroke-width="7"/>';
      // pijlpunt in de rijrichting (raaklijn tegen de klok in)
      var tx = -Math.sin(a1), ty = -Math.cos(a1);
      var nx = Math.cos(a1), ny = -Math.sin(a1);
      var tip = [x1 + tx * 9, y1 + ty * 9];
      var b1 = [x1 + nx * 7, y1 + ny * 7];
      var b2 = [x1 - nx * 7, y1 - ny * 7];
      out += '<polygon points="' + [tip, b1, b2].map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '" fill="#fff"/>';
    }
    return out;
  }

  var octagon = (function () {
    var pts = [];
    for (var i = 0; i < 8; i++) {
      var a = (22.5 + i * 45) * Math.PI / 180;
      pts.push((50 + 47 * Math.cos(a)).toFixed(1) + ',' + (50 + 47 * Math.sin(a)).toFixed(1));
    }
    return pts.join(' ');
  })();

  RB.signs = [
    {
      id: 'max-50', group: 'rond-rood', name: 'Maximumsnelheid 50 km/h',
      meaning: 'Je mag vanaf dit bord niet harder rijden dan 50 km/h.',
      svg: redRing(number('50', '#111'))
    },
    {
      id: 'max-30', group: 'rond-rood', name: 'Maximumsnelheid 30 km/h',
      meaning: 'Je mag vanaf dit bord niet harder rijden dan 30 km/h.',
      svg: redRing(number('30', '#111'))
    },
    {
      id: 'einde-max-30', group: 'rond-rood', name: 'Einde maximumsnelheid 30 km/h',
      meaning: 'De eerder aangegeven maximumsnelheid geldt niet meer. De gewone limiet voor die weg geldt weer.',
      svg: svg('<circle cx="50" cy="50" r="45" fill="#fff" stroke="#222" stroke-width="2"/>' + number('30', '#999') +
        '<g stroke="#222" stroke-width="2.5"><line x1="22" y1="82" x2="82" y2="22"/><line x1="18" y1="76" x2="76" y2="18"/><line x1="26" y1="88" x2="88" y2="26"/></g>')
    },
    {
      id: 'advies', group: 'blauw', name: 'Adviessnelheid',
      meaning: 'Aanbevolen snelheid, bijvoorbeeld voor een bocht. Het is geen verplichte limiet.',
      svg: blueSquare(number('50', '#fff'))
    },
    {
      id: 'voorrangsweg', group: 'voorrang', name: 'Voorrangsweg',
      meaning: 'Je rijdt op een voorrangsweg: verkeer van zijwegen moet jou voorrang verlenen.',
      svg: diamond()
    },
    {
      id: 'einde-voorrangsweg', group: 'voorrang', name: 'Einde voorrangsweg',
      meaning: 'De voorrangsweg houdt op. Let op de voorrangsregels bij het volgende kruispunt.',
      svg: diamond('<g stroke="#222" stroke-width="3"><line x1="30" y1="78" x2="78" y2="30"/><line x1="24" y1="72" x2="72" y2="24"/><line x1="36" y1="84" x2="84" y2="36"/></g>')
    },
    {
      id: 'voorrang-verlenen', group: 'voorrang', name: 'Voorrang verlenen',
      meaning: 'Je moet voorrang verlenen aan bestuurders op de weg die je nadert.',
      svg: svg('<polygon points="6,12 94,12 50,92" fill="#fff" stroke="' + RED + '" stroke-width="8" stroke-linejoin="round"/>')
    },
    {
      id: 'stop', group: 'voorrang', name: 'Stop, voorrang verlenen',
      meaning: 'Je moet altijd helemaal stoppen en daarna voorrang verlenen.',
      svg: svg('<polygon points="' + octagon + '" fill="' + RED + '" stroke="#fff" stroke-width="3"/>' + number('STOP', '#fff', 24))
    },
    {
      id: 'voorrangskruispunt', group: 'driehoek', name: 'Kruispunt waar je voorrang hebt',
      meaning: 'Waarschuwing: op het volgende kruispunt heb jij voorrang.',
      svg: warning('<rect x="45" y="36" width="10" height="42" fill="#111"/><rect x="30" y="54" width="40" height="5" fill="#111"/>')
    },
    {
      id: 'gesloten', group: 'rond-rood', name: 'Gesloten voor voertuigen in beide richtingen',
      meaning: 'Je mag deze weg niet in met een voertuig, uit geen enkele richting.',
      svg: redRing()
    },
    {
      id: 'inrijden-verboden', group: 'rond-rood', name: 'Inrijden verboden',
      meaning: 'Je mag de weg vanaf deze kant niet inrijden (vaak een eenrichtingsweg van de andere kant).',
      svg: svg('<circle cx="50" cy="50" r="46" fill="' + RED + '"/><rect x="18" y="42" width="64" height="16" fill="#fff"/>')
    },
    {
      id: 'parkeerverbod', group: 'rond-rood', name: 'Parkeerverbod',
      meaning: 'Parkeren is verboden. Kort stilstaan om mensen te laten in- of uitstappen of om te laden en lossen mag wel.',
      svg: svg('<circle cx="50" cy="50" r="44" fill="' + BLUE + '" stroke="' + RED + '" stroke-width="10"/><line x1="22" y1="22" x2="78" y2="78" stroke="' + RED + '" stroke-width="10"/>')
    },
    {
      id: 'stopverbod', group: 'rond-rood', name: 'Verbod stil te staan',
      meaning: 'Je mag hier helemaal niet stilstaan, ook niet even om iemand te laten uitstappen.',
      svg: svg('<circle cx="50" cy="50" r="44" fill="' + BLUE + '" stroke="' + RED + '" stroke-width="10"/><g stroke="' + RED + '" stroke-width="10"><line x1="22" y1="22" x2="78" y2="78"/><line x1="78" y1="22" x2="22" y2="78"/></g>')
    },
    {
      id: 'parkeren', group: 'blauw', name: 'Parkeergelegenheid',
      meaning: 'Hier mag je parkeren.',
      svg: blueSquare(number('P', '#fff', 62))
    },
    {
      id: 'inhaalverbod', group: 'rond-rood', name: 'Inhaalverbod',
      meaning: 'Motorvoertuigen mogen elkaar niet inhalen. Fietsers en bromfietsers mag je wel inhalen.',
      svg: redRing(frontCar(34, RED) + frontCar(66, '#111'))
    },
    {
      id: 'autosnelweg', group: 'blauw', name: 'Autosnelweg',
      meaning: 'Begin van de autosnelweg. Alleen voor motorvoertuigen die harder dan 60 km/h kunnen en mogen rijden.',
      svg: blueSquare('<rect x="18" y="26" width="64" height="8" fill="#fff"/><rect x="22" y="34" width="6" height="12" fill="#fff"/><rect x="72" y="34" width="6" height="12" fill="#fff"/>' +
        '<path d="M34,86 L46,44 M66,86 L54,44" stroke="#fff" stroke-width="6" fill="none"/><path d="M50,84 v-8 M50,68 v-8 M50,53 v-6" stroke="#fff" stroke-width="3"/>')
    },
    {
      id: 'einde-autosnelweg', group: 'blauw', name: 'Einde autosnelweg',
      meaning: 'De autosnelweg houdt op. De regels voor de autosnelweg gelden niet meer.',
      svg: blueSquare('<rect x="18" y="26" width="64" height="8" fill="#fff"/><rect x="22" y="34" width="6" height="12" fill="#fff"/><rect x="72" y="34" width="6" height="12" fill="#fff"/>' +
        '<path d="M34,86 L46,44 M66,86 L54,44" stroke="#fff" stroke-width="6" fill="none"/><line x1="12" y1="88" x2="88" y2="12" stroke="' + RED + '" stroke-width="8"/>')
    },
    {
      id: 'autoweg', group: 'blauw', name: 'Autoweg',
      meaning: 'Begin van de autoweg: alleen voor motorvoertuigen die minstens 50 km/h kunnen en mogen rijden. Maximumsnelheid 100 km/h.',
      svg: blueSquare('<g fill="#fff"><path d="M18,62 l6,-14 h30 l10,10 h16 l4,4 v8 h-66 z"/><circle cx="30" cy="72" r="7"/><circle cx="72" cy="72" r="7"/></g>' +
        '<g fill="' + BLUE + '"><circle cx="30" cy="72" r="3"/><circle cx="72" cy="72" r="3"/></g>')
    },
    {
      id: 'erf', group: 'blauw', name: 'Erf',
      meaning: 'Begin van een erf (woonerf). Maximaal 15 km/h; voetgangers mogen de hele breedte van de weg gebruiken en je parkeert alleen op aangegeven plaatsen.',
      svg: blueSquare('<g fill="#fff"><path d="M16,50 l18,-16 l18,16 v24 h-36 z"/><circle cx="68" cy="40" r="5"/><rect x="64" y="47" width="8" height="18" rx="2"/><rect x="64" y="64" width="3" height="12"/><rect x="69" y="64" width="3" height="12"/>' +
        '<circle cx="84" cy="62" r="3.5"/><rect x="81" y="67" width="6" height="10" rx="2"/></g><rect x="28" y="60" width="10" height="14" fill="' + BLUE + '"/>')
    },
    {
      id: 'eenrichtingsweg', group: 'blauw', name: 'Eenrichtingsweg',
      meaning: 'Je mag de weg alleen in de richting van de pijl berijden.',
      svg: blueSquare('<path d="M16,44 h44 v-14 l26,20 l-26,20 v-14 h-44 z" fill="#fff"/>')
    },
    {
      id: 'fietspad', group: 'blauw', name: 'Verplicht fietspad',
      meaning: 'Fietsers moeten dit fietspad gebruiken. Auto\'s mogen hier niet rijden of stilstaan.',
      svg: blueDisc('<g fill="none" stroke="#fff" stroke-width="4"><circle cx="30" cy="62" r="12"/><circle cx="70" cy="62" r="12"/><path d="M30,62 L44,40 H64 L70,62 M44,40 L52,62 L64,40 M40,36 h10 M60,34 h8"/></g>')
    },
    {
      id: 'rotonde', group: 'blauw', name: 'Rotonde',
      meaning: 'Je nadert een rotonde. Volg de rijrichting van de pijlen.',
      svg: blueDisc(roundaboutArrows())
    },
    {
      id: 'rijrichting-rechts', group: 'blauw', name: 'Verplichte rijrichting (rechtsaf)',
      meaning: 'Je moet in de richting van de pijl rijden, hier: rechtsaf.',
      svg: blueDisc('<path d="M20,44 h36 v-14 l26,20 l-26,20 v-14 h-36 z" fill="#fff"/>')
    },
    {
      id: 'gevaar', group: 'driehoek', name: 'Gevaar (algemeen)',
      meaning: 'Waarschuwing voor een gevaar. Een onderbord vertelt vaak welk gevaar.',
      svg: warning('<rect x="46" y="36" width="8" height="28" rx="2" fill="#111"/><circle cx="50" cy="73" r="5" fill="#111"/>')
    },
    {
      id: 'verkeerslichten', group: 'driehoek', name: 'Verkeerslichten',
      meaning: 'Waarschuwing: verderop staan verkeerslichten.',
      svg: warning('<rect x="41" y="34" width="18" height="46" rx="4" fill="#111"/><circle cx="50" cy="43" r="5" fill="' + RED + '"/><circle cx="50" cy="57" r="5" fill="' + YELLOW + '"/><circle cx="50" cy="71" r="5" fill="#2aa84a"/>')
    },
    {
      id: 'wegversmalling', group: 'driehoek', name: 'Wegversmalling',
      meaning: 'Waarschuwing: de weg wordt smaller.',
      svg: warning('<path d="M38,82 v-10 l6,-12 v-20 M62,82 v-10 l-6,-12 v-20" fill="none" stroke="#111" stroke-width="5"/>')
    },
    {
      id: 'bocht', group: 'driehoek', name: 'Gevaarlijke bocht (naar rechts)',
      meaning: 'Waarschuwing: er komt een gevaarlijke bocht naar rechts. Pas je snelheid aan.',
      svg: warning('<path d="M44,82 V58 Q44,44 58,40" fill="none" stroke="#111" stroke-width="6"/><polygon points="56,32 68,38 56,46" fill="#111"/>')
    },
    {
      id: 'doodlopend', group: 'blauw', name: 'Doodlopende weg',
      meaning: 'Deze weg loopt dood: je kunt er aan het eind niet verder.',
      svg: blueSquare('<rect x="43" y="34" width="14" height="52" fill="#fff"/><rect x="24" y="20" width="52" height="14" fill="' + RED + '"/>')
    }
  ];
})();
