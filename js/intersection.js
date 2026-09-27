// Tekent een kruispunt van bovenaf als SVG. Alles wordt getekend alsof het voertuig
// van onder (S) komt en daarna rond het midden gedraaid naar de juiste arm.
(function () {
  var RB = (window.RB = window.RB || {});
  var ANGLE = { S: 0, W: 90, N: 180, E: 270 };
  var COLORS = { auto: '#2f6fd6', fiets: '#1f9d55', tram: '#e0a800' };

  function rot(arm, inner) {
    return '<g transform="rotate(' + ANGLE[arm] + ' 150 150)">' + inner + '</g>';
  }

  function arm(armName, unpaved) {
    var fill = unpaved ? 'var(--unpaved)' : 'var(--road)';
    var inner = '<rect x="110" y="190" width="80" height="110" fill="' + fill + '"/>';
    if (unpaved) {
      for (var i = 0; i < 18; i++) {
        inner += '<circle cx="' + (116 + (i * 37) % 70) + '" cy="' + (196 + (i * 23) % 100) + '" r="1.6" fill="var(--unpaved-dot)"/>';
      }
    } else {
      inner += '<line x1="150" y1="200" x2="150" y2="300" stroke="#fff" stroke-width="2" stroke-dasharray="10 8"/>';
    }
    return rot(armName, inner);
  }

  // Haaientanden over de rijstrook van wie het kruispunt nadert (punt naar de bestuurder).
  function sharkTeeth(armName) {
    var t = '';
    for (var i = 0; i < 4; i++) {
      var x = 152 + i * 9.5;
      t += '<polygon points="' + x + ',192 ' + (x + 8) + ',192 ' + (x + 4) + ',203" fill="#fff"/>';
    }
    return rot(armName, t);
  }

  function rails(armName) {
    // Rails in de rijstrook van de tram, over de hele breedte van het kruispunt.
    return rot(armName, '<g stroke="var(--rail)" stroke-width="1.5"><line x1="164" y1="0" x2="164" y2="300"/><line x1="176" y1="0" x2="176" y2="300"/></g>');
  }

  function arrow(move) {
    var d;
    if (move === 'links') d = 'M0,-20 L0,-36 L-14,-36';
    else if (move === 'rechts') d = 'M0,-20 L0,-36 L14,-36';
    else d = 'M0,-20 L0,-46';
    var head;
    if (move === 'links') head = '-20,-36 -13,-41 -13,-31';
    else if (move === 'rechts') head = '20,-36 13,-41 13,-31';
    else head = '0,-52 -5,-44 5,-44';
    return '<path d="' + d + '" fill="none" stroke="var(--arrow)" stroke-width="3"/><polygon points="' + head + '" fill="var(--arrow)"/>';
  }

  function vehicleShape(type) {
    if (type === 'tram') return '<rect x="-10" y="-18" width="20" height="62" rx="4" fill="' + COLORS.tram + '" stroke="#333" stroke-width="1.5"/>';
    if (type === 'fiets') return '<rect x="-4" y="-14" width="8" height="28" rx="3" fill="' + COLORS.fiets + '" stroke="#fff" stroke-width="1"/>';
    return '<rect x="-11" y="-18" width="22" height="36" rx="5" fill="' + COLORS.auto + '" stroke="#fff" stroke-width="1"/>' +
      '<rect x="-8" y="-12" width="16" height="7" rx="2" fill="#bcd4ff"/>';
  }

  // Middelpunt van een voertuig dat van onder komt, daarna gedraaid.
  function position(armName) {
    var a = ANGLE[armName] * Math.PI / 180;
    var dx = 20, dy = 88; // (170, 238) relatief t.o.v. (150,150)
    return {
      x: 150 + dx * Math.cos(a) - dy * Math.sin(a),
      y: 150 + dx * Math.sin(a) + dy * Math.cos(a)
    };
  }

  RB.renderIntersection = function (scenario, picks) {
    picks = picks || [];
    var yieldArms = scenario.yieldArms || [];
    var unpaved = scenario.unpaved || [];
    var out = '<svg class="kruispunt" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">';
    out += '<rect width="300" height="300" fill="var(--grass)"/>';
    ['S', 'N', 'E', 'W'].forEach(function (a) { out += arm(a, unpaved.indexOf(a) >= 0); });
    out += '<rect x="110" y="110" width="80" height="80" fill="var(--road)"/>';
    yieldArms.forEach(function (a) { out += sharkTeeth(a); });
    scenario.vehicles.forEach(function (v) {
      if (v.type === 'tram') out += rails(v.arm);
    });
    scenario.vehicles.forEach(function (v) {
      var p = position(v.arm);
      out += '<g class="voertuig" data-id="' + v.id + '" role="button" tabindex="0" aria-label="Voertuig ' + v.id + '">';
      out += '<g transform="rotate(' + ANGLE[v.arm] + ' 150 150) translate(170 238)">' + vehicleShape(v.type) + arrow(v.move) + '</g>';
      out += '<circle cx="' + p.x + '" cy="' + p.y + '" r="22" fill="transparent" class="raakvlak"/>';
      out += '<text x="' + p.x + '" y="' + p.y + '" class="letter" text-anchor="middle" dominant-baseline="central">' + v.id + '</text>';
      var n = picks.indexOf(v.id);
      if (n >= 0) {
        out += '<circle cx="' + (p.x + 16) + '" cy="' + (p.y - 16) + '" r="10" fill="var(--accent)"/>' +
          '<text x="' + (p.x + 16) + '" y="' + (p.y - 16) + '" class="badge" text-anchor="middle" dominant-baseline="central">' + (n + 1) + '</text>';
      }
      out += '</g>';
    });
    out += '</svg>';
    return out;
  };
})();
