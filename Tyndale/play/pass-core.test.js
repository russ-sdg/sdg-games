import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from './js/pass-core.js';
import * as E from './js/engine.js';

test('the same seed deals the same character cards, and the Secret Supporter is the seat holding Stephen Vaughn (4+ Agents only)', () => {
  const a = P.deal(777, 5), b = P.deal(777, 5);
  assert.deepEqual(a, b);
  assert.equal(new Set(a.chars).size, 5);
  for (const n of [1, 2, 3]) assert.equal(P.deal(777, n).supporter, null);
  for (let seed = 1; seed < 200; seed++) {
    const d = P.deal(seed, 4);
    assert.ok(d.supporter === null || d.chars[d.supporter] === 'vaughn');
    assert.equal(d.supporter === null, !P.deal(seed, 4).chars.includes('vaughn'));
  }
});

test('a seed is non-zero and the card art paths exist for every character', () => {
  assert.ok(P.newSeed() > 0);
  for (const c of P.CHARACTERS) assert.match(P.CARD(c.id), /cards\/.+-480\.webp$/);
});

test('every Agent count the pass-and-play page offers makes a game the engine accepts', () => {
  for (let n = P.MIN_AGENTS; n <= P.MAX_AGENTS; n++) {
    const d = P.deal(42, n);
    const s = E.newGame({ seats: d.names.map((name, i) => ({ name, human: true, char: d.chars[i] })), seed: 42, supporter: d.supporter });
    assert.equal(s.seats.length, n);
    assert.equal(s.pawns.length, n >= 5 ? 5 : 4);
  }
});
