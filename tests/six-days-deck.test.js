// The deck table on the Six Days page must add up to 72 and match the cards the online game deals.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', '6days', 'index.html'), 'utf8');

test('the deck table lists the counts from the box and totals 72', async () => {
  const rows = [...html.matchAll(/<tr[^>]*><th scope="row">([^<]+)<\/th><td>(\d+)<\/td>/g)].map((m) => [m[1].replace(/&amp;/g, '&'), Number(m[2])]);
  const by = Object.fromEntries(rows);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((d) => by['Day ' + d]), [1, 7, 7, 8, 8, 9]);
  assert.equal(by['Evening & Morning'], 6);
  assert.equal(by['Points: 1 or 2'], 22);
  assert.equal(by['Points: 3, 4, 5, 6'], 4);
  const parts = rows.filter(([k]) => k !== 'Total').reduce((n, [, c]) => n + c, 0);
  assert.equal(parts, 72); assert.equal(by.Total, 72);
  const E = await import('../6days/play/js/engine.js');
  assert.equal(E.DEFS.length, 46, 'the online game deals the 40 day cards and 6 Evening & Morning cards');
});
