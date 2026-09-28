// Controleert de vragenbank: node tests/validate.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { window: {}, Math };
vm.createContext(ctx);
for (const f of ['signs.js', 'questions.js', 'voorrang.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'data', f), 'utf8'), ctx, { filename: f });
}
const RB = ctx.window.RB;
const errors = [];
const fail = (msg) => errors.push(msg);
const ids = new Set();
const texts = new Map();
const unique = (id) => { if (ids.has(id)) fail('Dubbel id: ' + id); ids.add(id); };

for (const s of RB.signs) {
  unique('bord-' + s.id);
  if (!s.name || !s.meaning || !s.group) fail('Bord mist velden: ' + s.id);
  if (!/^<svg[\s\S]*<\/svg>$/.test(s.svg)) fail('Bord heeft geen geldige svg: ' + s.id);
}

for (const q of RB.questions) {
  unique(q.id);
  if (!RB.topics[q.topic]) fail('Onbekend onderwerp: ' + q.id);
  if (!['kennis', 'inzicht'].includes(q.part)) fail('Onbekend onderdeel: ' + q.id);
  if (!q.q || !q.explain) fail('Vraag of uitleg ontbreekt: ' + q.id);
  if (!q.source) fail('Bron ontbreekt: ' + q.id);
  const key = q.q.trim().toLowerCase();
  if (texts.has(key)) fail('Dubbele vraagtekst: ' + q.id + ' en ' + texts.get(key));
  texts.set(key, q.id);
  if (q.type === 'mc') {
    if (!Array.isArray(q.options) || q.options.length < 2) fail('Te weinig opties: ' + q.id);
    if (!(q.answer >= 0 && q.answer < q.options.length)) fail('Antwoord buiten bereik: ' + q.id);
    if (new Set(q.options).size !== q.options.length) fail('Dubbele opties: ' + q.id);
  } else if (q.type === 'num') {
    if (typeof q.answer !== 'number' || !q.unit) fail('Invulvraag mist getal of eenheid: ' + q.id);
  } else {
    fail('Onbekend type: ' + q.id);
  }
}

const ARMS = ['N', 'E', 'S', 'W'];
for (const v of RB.voorrang) {
  unique(v.id);
  const vids = v.vehicles.map((x) => x.id);
  if (new Set(vids).size !== vids.length) fail('Dubbel voertuig: ' + v.id);
  if (new Set(v.vehicles.map((x) => x.arm)).size !== vids.length) fail('Twee voertuigen op dezelfde arm: ' + v.id);
  if ([...v.order].sort().join() !== [...vids].sort().join()) fail('Volgorde klopt niet met voertuigen: ' + v.id);
  for (const x of v.vehicles) {
    if (!ARMS.includes(x.arm)) fail('Onbekende arm: ' + v.id);
    if (!['rechtdoor', 'links', 'rechts'].includes(x.move)) fail('Onbekende richting: ' + v.id);
    if (!['auto', 'fiets', 'tram'].includes(x.type)) fail('Onbekend voertuig: ' + v.id);
  }
  for (const a of [...(v.yieldArms || []), ...(v.unpaved || [])]) if (!ARMS.includes(a)) fail('Onbekende arm: ' + v.id);
}

// Genoeg vragen voor een proefexamen (12 kennis, 28 inzicht waarvan 10 voorrang).
const kennis = RB.questions.filter((q) => q.part === 'kennis').length + RB.signs.length;
const inzichtMc = RB.questions.filter((q) => q.part === 'inzicht').length;
if (kennis < 12) fail('Te weinig kennisvragen: ' + kennis);
if (RB.voorrang.length < 10) fail('Te weinig voorrangssituaties: ' + RB.voorrang.length);
if (inzichtMc < 18) fail('Te weinig inzichtvragen: ' + inzichtMc);
if (RB.questions.length < 200) fail('Minder dan 200 vragen: ' + RB.questions.length);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`OK: ${RB.signs.length} borden, ${RB.questions.length} vragen, ${RB.voorrang.length} voorrangssituaties.`);
