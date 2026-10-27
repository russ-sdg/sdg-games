// The Three-by-Three gallery's list (3x3/cards-data.js) must match the card pictures and the generated images.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, '3x3/cards-data.js'), 'utf8'), ctx);
const data = JSON.parse(JSON.stringify(ctx.window.SDG_CARDS));
const copies = (c) => c.copies ?? 1;

test('the pictures are the 42-card deck: 13 tribes x 3 and 3 information cards', () => {
  assert.equal(data.cards.reduce((n, c) => n + copies(c), 0), data.total);
  assert.equal(data.total, data.expected);
  const sum = {};
  for (const c of data.cards) sum[c.group] = (sum[c.group] || 0) + copies(c);
  assert.deepEqual(sum, { tribes: 39, info: 3 });
});

test('every card has alt text, a known group and every image size on disk', () => {
  const groups = new Set(data.groups.map((g) => g.id)), ids = new Set();
  for (const c of data.cards) {
    assert.ok(c.alt, `${c.id} has no alt text`);
    for (const w of c.widths) assert.ok(fs.existsSync(path.join(ROOT, '3x3', `${c.src}-${w}.webp`)), `${c.src}-${w}.webp is missing`);
  }
  for (const c of data.cards) { assert.ok(groups.has(c.group), `${c.id} has an unknown group`); assert.ok(!ids.has(c.id), `${c.id} is duplicated`); ids.add(c.id); }
});

test('the list covers every card picture in assets (run: python3 3x3/tools/build-cards.py)', () => {
  const files = fs.readdirSync(path.join(ROOT, 'assets')).filter((f) => /^3x3[A-Z][A-Za-z0-9]*\.webp$/.test(f) && !/^3x3(Example|ThreeMatches|Back)/.test(f));
  assert.equal(files.length, data.cards.length, 'a card picture was added or removed: rebuild the list');
});
