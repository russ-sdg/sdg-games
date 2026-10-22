// The Journeys with Jesus gallery list (journeys-with-jesus/cards-data.js) must match the generated images.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'journeys-with-jesus/cards-data.js'), 'utf8'), ctx);
const data = JSON.parse(JSON.stringify(ctx.window.SDG_CARDS));

test('the count matches the cards listed', () => {
  assert.equal(data.cards.length, data.total);
  assert.equal(data.total, data.expected);
});

test('every card has a group, alt text and both image sizes on disk', () => {
  const groups = new Set(data.groups.map((g) => g.id));
  const ids = new Set();
  for (const c of data.cards) {
    assert.ok(groups.has(c.group), `${c.id} has an unknown group`);
    assert.ok(c.alt, `${c.id} has no alt text`);
    assert.ok(!ids.has(c.id), `${c.id} is duplicated`);
    ids.add(c.id);
    for (const w of c.widths) assert.ok(fs.existsSync(path.join(ROOT, 'journeys-with-jesus', `${c.src}-${w}.webp`)), `${c.id} is missing its ${w}px image`);
  }
});
