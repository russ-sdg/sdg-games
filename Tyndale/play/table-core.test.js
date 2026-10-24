import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from './js/table-core.js';
import * as E from './js/engine.js';

test('a table code carries the seed and the number of Agents, and survives being typed in any case, with spaces', () => {
  const code = T.makeCode(4, 123456789);
  assert.equal(code.length, 7);
  assert.deepEqual(T.parseCode(code.toLowerCase()), { n: 4, seed: 123456789, code });
  assert.deepEqual(T.parseCode(` ${code.slice(0, 3)} ${code.slice(3)} `), { n: 4, seed: 123456789, code });
  assert.equal(T.parseCode('4ABC'), null);
  assert.equal(T.parseCode('9000001'), null, 'too many Agents');
  assert.equal(T.parseCode('1000001'), null, 'a table needs at least two Agents');
  assert.equal(T.parseCode(''), null);
});

test('every phone deals the same cards from the same code, so everyone agrees who the Secret Supporter is', () => {
  for (const n of [2, 3, 4, 5]) {
    for (let seed = 1; seed < 60; seed++) {
      const a = T.deal(seed, n), b = T.deal(seed, n);
      assert.deepEqual(a, b);
      assert.equal(a.names.length, n);
      assert.equal(new Set(a.chars).size, n, 'each Agent has a different character');
      if (n < 4) assert.equal(a.supporter, null, 'no Secret Supporter with fewer than 4 Agents');
      else if (a.supporter !== null) assert.equal(a.chars[a.supporter], 'vaughn');
    }
  }
});

test('with 4 or 5 Agents the Secret Supporter is sometimes dealt to someone and sometimes to nobody (Vaughn may be left in the pack)', () => {
  let held = 0;
  for (let seed = 1; seed <= 300; seed++) if (T.deal(seed, 5).supporter !== null) held += 1;
  assert.ok(held > 150 && held < 300, `held ${held} of 300`);
});

test('a pawn reaches the spots exactly that many steps away', () => {
  const near = T.reach(E.neighbors, 'F5', 1);
  assert.deepEqual(near.sort(), E.neighbors('F5').sort());
  const two = T.reach(E.neighbors, 'F5', 2);
  assert.ok(two.includes('F5') && two.includes('H5') && two.includes('G6'));
  assert.ok(!two.includes(near[0]));
});

test('at a table an Agent lands where their own die took them, and the engine answers with the right cards', () => {
  const deal = T.deal(99, 4);
  let s = E.newGame({ seats: deal.names.map((name, i) => ({ name, human: false, char: deal.chars[i] })), seed: 99, supporter: deal.supporter });
  const spots = ['A1', 'A3', 'A5', 'A7'];
  s.pawns.forEach((p, i) => { s = E.placePawn(s, p.id, spots[i]); });
  s = E.startTyndale(s, 'F6');
  s = E.tyndaleMove(s, ['F5']);
  assert.equal(s.phase, 'agents');
  // any landing is accepted, because the roll was made on another phone; a spot held by another pawn is not
  const far = E.agentMove(s, 0, 0, 'C2', { free: true });
  assert.equal(far.pawns[0].pos, 'C2');
  assert.ok(['not', 'near', 'far'].includes(far.lastResult.loc));
  assert.throws(() => E.agentMove(s, 0, 0, 'A3', { free: true }), /illegal/);
  const caught = E.agentMove(s, 1, 0, 'F5', { free: true });
  assert.equal(caught.over, !E.isSupporterPawn(s, 1), 'landing on Tyndale ends the game, unless the Agent is his Secret Supporter');
});

test('an answer code turns back into the same two cards, only for the right seat and spot', () => {
  for (const loc of ['here', 'not', 'near', 'far']) for (const bible of ['N', 'P', 'H', 'O', 'rumors', 'nothing']) {
    const code = T.answerCode(12345, 2, 'F6', { loc, bible });
    assert.match(code, /^[0-9A-Z]{2}$/);
    assert.deepEqual(T.decodeAnswer(12345, 2, 'F6', code.toLowerCase()), { loc, bible });
  }
  const code = T.answerCode(12345, 2, 'F6', { loc: 'not', bible: 'N' });
  const wrong = [T.decodeAnswer(12345, 3, 'F6', code), T.decodeAnswer(12345, 2, 'F7', code), T.decodeAnswer(999, 2, 'F6', code)];
  assert.ok(wrong.some((w) => w === null), 'a code read at another seat or spot is usually rejected');
  assert.equal(T.decodeAnswer(12345, 2, 'F6', 'ZZ'), null);
});
