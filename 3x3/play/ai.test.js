import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from './js/engine.js';
import * as AI from './js/ai.js';

const players = (n, skill) => Array.from({ length: n }, (_, i) => ({ name: 'P' + i, bot: true, skill }));

test('a computer that already knows where a match is goes straight for it', () => {
  const s = E.newGame({ seed: 3, players: players(2, 'sharp') });
  s.players[0].hand = [2, 4, 9]; s.matrix = [9, 1, 1, 5, 5, 6, 6, 8, 8]; s.know = [{}, {}];
  s.reveals = []; s.turn = 0;
  const a = AI.nextAction(s, 'sharp', E.rng(1));            // it holds a 9 (top card) and has seen... nothing yet: it explores
  assert.ok(a);
  s.know[0]['c:0'] = 9;                                      // now it has seen the 9 in the matrix
  const b = AI.nextAction(s, 'sharp', E.rng(1));
  assert.ok((b.kind === 'cell' && b.i === 0) || (b.kind === 'hand' && b.p === 0 && b.which === 'hi'));
});
test('after a first card it looks for a known partner', () => {
  let s = E.newGame({ seed: 3, players: players(2, 'sharp') });
  s.players[0].hand = [2, 4, 9]; s.players[1].hand = [1, 3, 10]; s.matrix = [9, 11, 11, 5, 5, 6, 6, 8, 8]; s.know = [{ 'c:0': 9 }, {}];
  s.reveals = []; s.turn = 0;
  s = E.reveal(s, { kind: 'hand', p: 0, which: 'hi' });       // shows its 9
  const b = AI.nextAction(s, 'sharp', E.rng(1));
  assert.deepEqual(b, { kind: 'cell', i: 0 });
});
test('computers only use what they have seen: another hand\'s cards are unknown until shown', () => {
  const s = E.newGame({ seed: 4, players: players(2, 'sharp') });
  assert.deepEqual(s.know, [{}, {}]);
});
test('forgetting: sharp keeps everything, casual loses some', () => {
  const s = E.newGame({ seed: 4, players: players(2, 'sharp') });
  for (let i = 0; i < 60; i++) s.know[0]['c:' + i] = 5;
  assert.equal(Object.keys(AI.forget(s, 0, 'sharp', E.rng(1)).know[0]).length, 60);
  const n = Object.keys(AI.forget(s, 0, 'casual', E.rng(1)).know[0]).length;
  assert.ok(n < 60 && n > 10);
});
test('whole games finish with a winner, for 2 to 6 players and every skill', () => {
  for (const n of [2, 3, 4, 5, 6]) for (const skill of ['casual', 'steady', 'sharp']) {
    let s = E.newGame({ seed: 100 + n, players: players(n, skill) }); const r = E.rng(n);
    for (let g = 0; g < 3000 && !s.over; g++) s = AI.playTurn(s, skill, r);
    assert.ok(s.over, `${n} players ${skill} did not finish`);
    assert.ok(s.winners.length >= 1);
    const all = [...s.players.flatMap((p) => [...p.hand, ...p.sets.flatMap((v) => [v, v, v])]), ...s.matrix.filter((c) => c !== null), ...s.draw];
    assert.equal(all.length, 39, 'no card is lost or invented');
  }
});
test('sharp beats casual', () => {
  let sharp = 0, games = 40;
  for (let g = 0; g < games; g++) {
    let s = E.newGame({ seed: 900 + g, players: [{ name: 'a', bot: true, skill: g % 2 ? 'sharp' : 'casual' }, { name: 'b', bot: true, skill: g % 2 ? 'casual' : 'sharp' }] }); const r = E.rng(g);
    while (!s.over) s = AI.playTurn(s, s.players[s.turn].skill, r);
    if (s.winners.length === 1 && s.players[s.winners[0]].skill === 'sharp') sharp++;
  }
  assert.ok(sharp > games * 0.6, `sharp won ${sharp} of ${games}`);
});
