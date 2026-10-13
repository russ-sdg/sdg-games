// The card gallery's list (6days/cards-data.js) must match the artwork folder and the generated images.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, '6days/cards-data.js'), 'utf8'), ctx);
const data = JSON.parse(JSON.stringify(ctx.window.SDG_CARDS));   // plain objects (it was built in another JS context)
const SRC = path.join(ROOT, 'assets/6days/cards-source');
const EXT = /\.(png|jpe?g|webp)$/i;

test('the list is complete and consistent with the artwork folder (run: python3 6days/tools/build-cards.py)', () => {
  const sources = data.groups.flatMap((g) => fs.existsSync(path.join(SRC, g.id)) ? fs.readdirSync(path.join(SRC, g.id)).filter((f) => EXT.test(f)) : []);
  assert.equal(data.cards.length, sources.length, 'artwork was added or removed without rebuilding cards-data.js');
  assert.equal(data.total, data.cards.length);
  assert.equal(data.expected, 72);
  assert.ok(data.total <= 72, 'more than 72 cards');
});

test('every card has its images, valid group, unique id, and landscape shape', () => {
  const groups = new Set(data.groups.map((g) => g.id));
  const ids = new Set();
  for (const c of data.cards) {
    assert.ok(groups.has(c.group), `${c.id}: unknown group`);
    assert.ok(!ids.has(c.id), `duplicate id ${c.id}`); ids.add(c.id);
    assert.ok(c.w > c.h, `${c.id} is not landscape`);
    assert.ok(c.name && (c.group === 'points' || !/ \d+$/.test(c.name)), `${c.id}: a trailing number belongs in the file name, not the card name (${c.name})`);
    assert.deepEqual([...c.widths].sort((a, b) => a - b), c.widths);
    for (const w of c.widths) assert.ok(fs.existsSync(path.join(ROOT, '6days', `${c.src}-${w}.webp`)), `${c.id}-${w}.webp missing`);
  }
});

test('no orphaned generated images', () => {
  const dir = path.join(ROOT, 'assets/6days/cards');
  const used = new Set(data.cards.flatMap((c) => c.widths.map((w) => `${c.id}-${w}.webp`)));
  for (const f of fs.readdirSync(dir)) assert.ok(used.has(f), `${f} is not in cards-data.js`);
});

test('the first batch of Day 5 and Day 6 art is present', () => {
  const has = (id) => data.cards.some((c) => c.id === id);
  for (const id of ['day5-sea-creatures', 'day6-mankind', 'day6-approval', 'day6-animals', 'day6-livestock', 'day4-moon']) assert.ok(has(id), id);
});
