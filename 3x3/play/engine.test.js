import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from './js/engine.js';

const two = [{ name: 'A' }, { name: 'B' }];
// A game with chosen hands and matrix; the rest of the 39 cards form the draw pile.
function rigged({ hands, matrix, draw }) {
  const s = E.newGame({ seed: 1, players: hands.map((h, i) => ({ name: 'P' + i })) });
  s.players.forEach((p, i) => { p.hand = [...hands[i]].sort((a, b) => a - b); });
  s.matrix = [...matrix];
  const left = {}; for (let v = 1; v <= 13; v++) left[v] = 3;
  [...hands.flat(), ...matrix].forEach((v) => { if (v !== null) left[v]--; });
  s.draw = draw ?? Object.entries(left).flatMap(([v, n]) => Array(n).fill(Number(v)));
  s.reveals = []; s.outcome = null; s.over = false; s.turn = 0; s.know = hands.map(() => ({}));
  return s;
}
const cell = (i) => ({ kind: 'cell', i }), ask = (p, which) => ({ kind: 'hand', p, which });

test('setup: 39 cards, three per tribe, hands of three, a 3x3 matrix, hands sorted', () => {
  for (const n of [2, 3, 6]) {
    const s = E.newGame({ seed: 7, players: Array.from({ length: n }, (_, i) => ({ name: 'P' + i })) });
    const all = [...s.players.flatMap((p) => p.hand), ...s.matrix, ...s.draw].filter((v) => v !== null);
    assert.equal(all.length, 39);
    for (let v = 1; v <= 13; v++) assert.equal(all.filter((x) => x === v).length, 3);
    s.players.forEach((p) => { assert.ok(p.hand.length === 3 && p.hand.every((x, i, a) => !i || a[i - 1] <= x)); });
    assert.ok(s.matrix.length >= 9);
  }
});
test('the same seed deals the same game', () => {
  assert.deepEqual(E.newGame({ seed: 5, players: two }), E.newGame({ seed: 5, players: two }));
});

test('asking for highest twice shows the highest and then the next one (the middle card); lowest works the same way', () => {
  let s = rigged({ hands: [[1, 2, 3], [4, 8, 12]], matrix: [5, 6, 7, 9, 10, 11, 13, 1, 2] });
  s = E.reveal(s, ask(1, 'hi')); assert.equal(s.reveals[0].v, 12);
  assert.equal(E.reveal(s, ask(1, 'hi')).reveals[1].v, 8);
  assert.equal(E.reveal(s, ask(1, 'lo')).reveals[1].v, 4);
  assert.equal(E.reveal(rigged({ hands: [[1, 2, 3], [4, 8, 12]], matrix: [5, 6, 7, 9, 10, 11, 13, 1, 2] }), ask(0, 'lo')).reveals[0].v, 1);
});
test('a card cannot be shown twice in one turn, and a one-card hand has just one end', () => {
  let s = rigged({ hands: [[1, 2, 3], [4, 8, 12]], matrix: [5, 6, 7, 9, 10, 11, 13, 1, 2] });
  s = E.reveal(s, cell(0));
  assert.throws(() => E.reveal(s, cell(0)));
  const a = E.actions(rigged({ hands: [[1], [4, 8]], matrix: [3, 3, 3, 5, 5, 5, 6, 6, 6] })).filter((x) => x.kind === 'hand' && x.p === 0);
  assert.equal(a.length, 1);
});
test('two cards that differ end the turn; the cards go back (nothing is taken)', () => {
  let s = rigged({ hands: [[1, 2, 3], [4, 8, 12]], matrix: [5, 6, 7, 9, 10, 11, 13, 13, 13] });
  s = E.reveal(E.reveal(s, cell(0)), cell(1));
  assert.equal(s.outcome, 'miss');
  assert.deepEqual(E.actions(s), []);
  const t = E.endTurn(s);
  assert.equal(t.turn, 1); assert.deepEqual(t.reveals, []); assert.equal(t.outcome, null);
  assert.deepEqual(t.matrix, s.matrix); assert.deepEqual(t.players[0].hand, [1, 2, 3]);
});
test('two that match go on to a third; a third that differs is a miss', () => {
  let s = rigged({ hands: [[1, 2, 3], [4, 8, 12]], matrix: [5, 5, 7, 9, 10, 11, 13, 5, 2] });
  s = E.reveal(E.reveal(s, cell(0)), cell(1));
  assert.equal(s.outcome, null); assert.ok(E.matching(s));
  assert.equal(E.reveal(s, cell(2)).outcome, 'miss');
  assert.equal(E.reveal(s, cell(7)).outcome, 'set');
});
test('taking a set: cards leave hands and matrix, are replaced from the draw pile, and play passes on', () => {
  // Player 0 holds a 3; player 1 holds a 3 (as lowest); the matrix has the third 3.
  let s = rigged({ hands: [[3, 6, 9], [3, 8, 12]], matrix: [3, 1, 1, 1, 4, 4, 4, 5, 5], draw: [13, 13, 13, 11, 10, 7] });
  s = E.reveal(s, ask(0, 'lo')); s = E.reveal(s, ask(1, 'lo')); s = E.reveal(s, cell(0));
  assert.equal(s.outcome, 'set');
  const t = E.endTurn(s);
  assert.deepEqual(t.players[0].sets, [3]);
  assert.equal(t.players[0].hand.length, 3); assert.equal(t.players[1].hand.length, 3);
  assert.ok(t.matrix.every((c) => c !== null) && t.matrix.length === 9);
  assert.equal(t.draw.length, 6 - 3);
  assert.equal(t.turn, 1);
});
test('the winner: three sets, or a set of Levi', () => {
  let s = rigged({ hands: [[3, 6, 9], [3, 8, 12]], matrix: [3, 1, 1, 2, 2, 4, 4, 5, 5], draw: [13, 13, 13, 11, 10, 7] });
  s.players[0].sets = [1, 2];
  s = E.reveal(E.reveal(E.reveal(s, ask(0, 'lo')), ask(1, 'lo')), cell(0));
  const t = E.endTurn(s);
  assert.ok(t.over); assert.deepEqual(t.winners, [0]); assert.equal(t.endedBy, 'sets');
  let l = rigged({ hands: [[7, 8, 9], [7, 10, 12]], matrix: [7, 1, 1, 2, 2, 4, 4, 5, 5] });
  l = E.reveal(E.reveal(E.reveal(l, ask(0, 'lo')), ask(1, 'lo')), cell(0));
  const done = E.endTurn(l);
  assert.ok(done.over); assert.equal(done.endedBy, 'levi'); assert.deepEqual(done.winners, [0]);
});
test('a set found with the draw pile empty leaves the matrix holes and short hands', () => {
  let s = rigged({ hands: [[3, 6, 9], [3, 8, 12]], matrix: [3, 1, 1, 2, 2, 4, 4, 5, 5], draw: [] });
  s.players[0].sets = [1];
  s = E.reveal(E.reveal(E.reveal(s, ask(0, 'lo')), ask(1, 'lo')), cell(0));
  const t = E.endTurn(s);
  assert.deepEqual(t.players[0].hand, [6, 9]); assert.deepEqual(t.players[1].hand, [8, 12]); assert.equal(t.matrix[0], null);
});

test('a hand\'s middle card alone is not in play; a tribe whose only copy in a hand is its middle card cannot be a set', () => {
  const s = rigged({ hands: [[1, 5, 9], [2, 5, 11]], matrix: [5, 3, 3, 4, 4, 6, 6, 8, 8] });
  assert.ok(!E.inPlayTribes(s).includes(5));               // both 5s are middle cards
  const t = rigged({ hands: [[1, 5, 5], [2, 4, 11]], matrix: [5, 3, 3, 4, 4, 6, 6, 8, 8] });
  assert.ok(E.inPlayTribes(t).includes(5));
});
test('when no set is in play three more cards join the matrix (12, then 15), automatically', () => {
  const s = rigged({ hands: [[1, 5, 9], [2, 6, 11]], matrix: [3, 4, 7, 8, 10, 12, 13, 1, 2], draw: [5, 5, 6, 7, 8, 9] });
  // nothing in play: every tribe is split between hands, matrix and the pile
  assert.deepEqual(E.inPlayTribes(s), []);
  const t = E.endTurn(E.reveal(E.reveal(s, cell(0)), cell(1)));    // a miss; settle runs
  assert.equal(t.matrix.length, 15);                       // still nothing in play at 12, so three more
  assert.equal(t.log.slice(s.log.length).filter((e) => e.t === 'more').length, 2);
});
test('with nothing in play and nothing to draw the game ends; the most sets wins', () => {
  const s = rigged({ hands: [[1, 5, 9], [2, 6, 11]], matrix: [3, 4, 7, 8, 10, 12, 13, 1, 2], draw: [] });
  s.players[1].sets = [4];
  const t = E.endTurn(E.reveal(E.reveal(s, cell(0)), cell(1)));
  assert.ok(t.over); assert.equal(t.endedBy, 'stalemate'); assert.deepEqual(t.winners, [1]);
});

test('what was shown is remembered by everyone but the owner, and forgotten when the spot changes', () => {
  let s = rigged({ hands: [[3, 6, 9], [3, 8, 12]], matrix: [3, 1, 1, 2, 2, 4, 4, 5, 5], draw: [13, 13, 13, 11, 10, 7] });
  s = E.reveal(s, ask(1, 'hi'));                                  // player 0 sees player 1's 12
  assert.equal(s.know[0]['h:1:2'], 12); assert.equal(s.know[1]['h:1:2'], undefined);
  s = E.reveal(s, cell(4));
  assert.equal(s.know[1]['c:4'], 2);
  const t = E.endTurn(s);                                         // a miss: memories stay
  assert.equal(t.know[1]['c:4'], 2); assert.equal(t.know[0]['h:1:2'], 12);
  let u = rigged({ hands: [[3, 6, 9], [3, 8, 12]], matrix: [3, 1, 1, 2, 2, 4, 4, 5, 5], draw: [13, 13, 13, 11, 10, 7] });
  u = E.reveal(u, cell(1)); u = E.endTurn(E.reveal(u, cell(0)));  // 1 vs 3: miss
  u.turn = 0; u = E.reveal(E.reveal(E.reveal(u, ask(0, 'lo')), ask(1, 'lo')), cell(0));
  const v = E.endTurn(u);                                         // matrix cell 0 and both hands changed
  assert.equal(v.know[1]['c:0'], undefined); assert.equal(v.know[1]['c:1'], 1);
});
