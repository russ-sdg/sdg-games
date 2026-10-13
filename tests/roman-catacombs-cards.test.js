// The Roman Catacombs gallery data (roman-catacombs/cards-data.js) must match the deck the scorepad deals.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'roman-catacombs/cards-data.js'), 'utf8'), ctx);
const data = JSON.parse(JSON.stringify(ctx.window.SDG_CARDS));
const deck = JSON.parse(/cardImages = (\[.*?\]);/.exec(fs.readFileSync(path.join(ROOT, 'js/Catacombs.js'), 'utf8'))[1]);

test('the gallery has exactly the 90 cards the scorepad deals (run: python3 roman-catacombs/tools/build-cards.py)', () => {
  assert.equal(deck.length, 90);
  assert.deepEqual(data.cards.map((c) => c.id).sort(), [...deck].sort());
  assert.equal(data.total, 90);
});

test('every card has a known category and its image file; the card back exists', () => {
  const groups = new Set(data.groups.map((g) => g.id));
  assert.equal(groups.size, 7);
  for (const c of data.cards) {
    assert.ok(groups.has(c.group), `${c.id}: unknown group`);
    for (const w of c.widths) assert.ok(fs.existsSync(path.join(ROOT, 'roman-catacombs', `${c.src}-${w}.webp`)), `${c.id}-${w}.webp missing`);
  }
  assert.ok(fs.existsSync(path.join(ROOT, 'roman-catacombs', `${data.back.src}-${data.back.widths[0]}.webp`)));
});

test('categories hold the right number of cards (the scorecard lists these counts)', () => {
  const n = (g) => data.cards.filter((c) => c.group === g).length;
  assert.deepEqual(['pentateuch', 'historical', 'wisdom', 'prophets', 'gospels', 'paul', 'general'].map(n), [12, 12, 12, 17, 12, 13, 12]);
});

test('no orphaned generated images', () => {
  const used = new Set([...data.cards.flatMap((c) => c.widths.map((w) => `${c.id}-${w}.webp`)), `back-${data.back.widths[0]}.webp`]);
  for (const f of fs.readdirSync(path.join(ROOT, 'assets/roman-catacombs/cards'))) assert.ok(used.has(f), `${f} is not in cards-data.js`);
});
