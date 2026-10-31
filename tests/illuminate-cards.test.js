// The Illuminate gallery's list (illuminate/cards-data.js) must match the card pictures and the generated images.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'illuminate/cards-data.js'), 'utf8'), ctx);
const data = JSON.parse(JSON.stringify(ctx.window.SDG_CARDS));

test('the deck is 4 suits of 12 Gospel cards and the 4 Role Cards, and the count matches', () => {
  assert.equal(data.cards.length, data.total);
  assert.equal(data.total, data.expected);
  const sum = {};
  for (const c of data.cards) sum[c.group] = (sum[c.group] || 0) + 1;
  assert.deepEqual(sum, { matthew: 12, mark: 12, luke: 12, john: 12, roles: 4 });
});

test('every card has alt text, a known group and every image size on disk; the back is listed', () => {
  const groups = new Set(data.groups.map((g) => g.id)), ids = new Set();
  for (const c of [...data.cards, data.back]) {
    assert.ok(c.alt, `${c.id || 'back'} has no alt text`);
    for (const w of c.widths) assert.ok(fs.existsSync(path.join(ROOT, 'illuminate', `${c.src}-${w}.webp`)), `${c.src}-${w}.webp is missing`);
  }
  for (const c of data.cards) { assert.ok(groups.has(c.group), `${c.id} has an unknown group`); assert.ok(!ids.has(c.id), `${c.id} is duplicated`); ids.add(c.id); }
});

test('the list covers every card picture in assets/Illuminate (run: python3 illuminate/tools/build-cards.py)', () => {
  const files = fs.readdirSync(path.join(ROOT, 'assets/Illuminate')).filter((f) => /\.png$/i.test(f) && !/^Card-Back/.test(f));
  assert.equal(files.length, data.cards.length, 'a card picture was added or removed: rebuild the list');
});

test('the four Special Action cards are marked', () => {
  const special = data.cards.filter((c) => /Special Action/.test(c.name)).map((c) => c.id).sort();
  assert.deepEqual(special, ['john-1-5', 'luke-19-24', 'mark-14-27', 'matthew-19-30']);
});
