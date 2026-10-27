// The Journeys through Jerusalem gallery's list (JtJ/cards-data.js) must match the card pictures and the generated images.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'JtJ/cards-data.js'), 'utf8'), ctx);
const data = JSON.parse(JSON.stringify(ctx.window.SDG_CARDS));
const copies = (c) => c.copies || 1;

test('the pictures are the 18 character cards: 7 Apostles, 5 Friends of Jesus, 6 Enemies of Christ', () => {
  assert.equal(data.cards.reduce((n, c) => n + copies(c), 0), data.total);
  assert.equal(data.total, data.expected);
  const sum = {};
  for (const c of data.cards) sum[c.group] = (sum[c.group] || 0) + copies(c);
  assert.deepEqual(sum, { apostle: 7, friend: 5, enemy: 6 });
});

test('every card has alt text, a known group and every image size on disk; the back is listed', () => {
  const groups = new Set(data.groups.map((g) => g.id)), ids = new Set();
  for (const c of [...data.cards, data.back]) {
    assert.ok(c.alt, `${c.id || 'back'} has no alt text`);
    for (const w of c.widths) assert.ok(fs.existsSync(path.join(ROOT, 'JtJ', `${c.src}-${w}.webp`)), `${c.src}-${w}.webp is missing`);
  }
  for (const c of data.cards) { assert.ok(groups.has(c.group), `${c.id} has an unknown group`); assert.ok(!ids.has(c.id), `${c.id} is duplicated`); ids.add(c.id); }
});

test('the list covers every card picture in assets/jtj (run: python3 JtJ/tools/build-cards.py)', () => {
  const files = fs.readdirSync(path.join(ROOT, 'assets/jtj')).filter((f) => / v\d+\.png$/i.test(f) && !/^(Box|JtJ|Card Back)/i.test(f));
  assert.equal(files.length, data.cards.length, 'a card picture was added or removed: rebuild the list');
});
