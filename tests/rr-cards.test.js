// The Roman Road gallery's list (RomanRoad/cards-data.js) must match the card pictures and the generated images.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'RomanRoad/cards-data.js'), 'utf8'), ctx);
const data = JSON.parse(JSON.stringify(ctx.window.SDG_CARDS));
const copies = (c) => c.copies || 1;

test('the pictures are the 32 card faces, printed once in each of the 4 decks: 128 cards, 8 per verse per deck', () => {
  assert.equal(data.cards.reduce((n, c) => n + copies(c), 0), data.total);
  assert.equal(data.total, data.expected);
  const sum = {};
  for (const c of data.cards) sum[c.group] = (sum[c.group] || 0) + copies(c);
  assert.deepEqual(sum, { 'rom-3-23': 32, 'rom-6-23': 32, 'rom-5-8': 32, 'rom-10-13': 32 });
});

test('every card has alt text, a known group and every image size on disk', () => {
  const groups = new Set(data.groups.map((g) => g.id)), ids = new Set();
  for (const c of data.cards) {
    assert.ok(c.alt, `${c.id} has no alt text`);
    for (const w of c.widths) assert.ok(fs.existsSync(path.join(ROOT, 'RomanRoad', `${c.src}-${w}.webp`)), `${c.src}-${w}.webp is missing`);
  }
  for (const c of data.cards) { assert.ok(groups.has(c.group), `${c.id} has an unknown group`); assert.ok(!ids.has(c.id), `${c.id} is duplicated`); ids.add(c.id); }
});

test('the list covers every card picture in assets/roman-road (run: python3 RomanRoad/tools/build-cards.py)', () => {
  const files = fs.readdirSync(path.join(ROOT, 'assets/roman-road')).filter((f) => /^Rom-\d+-\d+-\d+V\d+\.png$/i.test(f));
  assert.equal(files.length, data.cards.length, 'a card picture was added or removed: rebuild the list');
});
