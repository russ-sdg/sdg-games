const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../6days/demo-core.js');

test('the sample game follows the printed rules and its captions agree with its scores', () => {
  assert.deepEqual(D.checkRules(D.STEPS), []);
});

test('the rules check really catches mistakes', () => {
  const bad = (mutate) => { const s = JSON.parse(JSON.stringify(D.STEPS)); mutate(s); return D.checkRules(s); };
  assert.ok(bad((s) => { s[2].pts = 2; }).some((p) => /scores 2 but the rules give 1/.test(p)), 'a repeated kind is 1 point');
  assert.ok(bad((s) => { s[4].day = 4; }).some((p) => /next one/.test(p)), 'a new day must be the next one');
  assert.ok(bad((s) => { s[4] = { who: 'Ann', kind: 'close', day: 3, pts: 3, text: 'Ann closes Day 3: 3 points.' }; }).some((p) => /not full/.test(p)), 'E&M needs a full day');
  assert.ok(bad((s) => { s[5].day = 1; s[5].pts = 1; }).some((p) => /already has its Evening/.test(p)), 'only one E&M per day');
  assert.ok(bad((s) => { s[1].text = 'Ann plays a card.'; }).some((p) => /caption/.test(p)), 'a caption must state the points');
  assert.ok(bad((s) => { [s[1].who, s[2].who] = [s[2].who, s[1].who]; }).some((p) => /wrong player/.test(p)));
});

test('final scores, and the day names match the cards (Day 2 is just Sky)', () => {
  const s = D.stateAt(D.STEPS.length - 1);
  assert.deepEqual(s.pts, { Ann: 4, Ben: 5, Cy: 5 });
  assert.equal(D.DAYS[1].name, 'Sky');
  assert.deepEqual(s.stacks[1].cards, ['Sky', 'Sky']);
  assert.deepEqual(s.stacks.map((x) => x.closed), [true, true, true, false, false, false]);
});
