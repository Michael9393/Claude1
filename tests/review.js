// Exporteert alle vragen, borden en voorrangssituaties als leesbare lijst voor een controleronde.
// Gebruik: node tests/review.js > review.txt
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { window: {}, Math };
vm.createContext(ctx);
for (const f of ['signs.js', 'questions.js', 'voorrang.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'data', f), 'utf8'), ctx, { filename: f });
}
const RB = ctx.window.RB;
const fmt = (n) => String(n).replace('.', ',');

console.log('# Vragen (' + RB.questions.length + ')\n');
RB.questions.forEach((q, i) => {
  const answer = q.type === 'num' ? fmt(q.answer) + ' ' + q.unit : q.options[q.answer];
  console.log(`${i + 1}. [${q.id}] (${q.part}, ${q.topic}) ${q.q}`);
  console.log(`   Antwoord: ${answer}`);
  if (q.type === 'mc') console.log(`   Fout: ${q.options.filter((_, j) => j !== q.answer).join(' | ')}`);
  console.log(`   Uitleg: ${q.explain}`);
  console.log(`   Bron: ${q.source}\n`);
});

console.log('# Borden (' + RB.signs.length + ')\n');
RB.signs.forEach((s) => console.log(`- [${s.id}] ${s.name}: ${s.meaning}`));

console.log('\n# Voorrang (' + RB.voorrang.length + ')\n');
RB.voorrang.forEach((v) => {
  const who = v.vehicles.map((x) => `${x.id}=${x.type} van ${x.arm} ${x.move}`).join(', ');
  const extra = [v.yieldArms && 'haaientanden: ' + v.yieldArms.join(','), v.unpaved && 'onverhard: ' + v.unpaved.join(',')].filter(Boolean).join('; ');
  console.log(`- [${v.id}] ${who}${extra ? ' (' + extra + ')' : ''} → ${v.order.join(', ')}\n  ${v.explain}`);
});
