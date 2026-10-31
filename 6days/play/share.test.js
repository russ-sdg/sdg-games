import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from './js/engine.js';
import * as S from './js/share.js';

const done = (scores) => {
  const s = E.newGame({ seed: 3, players: scores.map((_, i) => ({ name: i ? 'Bot' + i : 'You', bot: i > 0 })) });
  s.players.forEach((p, i) => { p.score = scores[i]; }); s.over = true; s.endedBy = 'complete';
  return s;
};

test('the result: place counts the players ahead of you; a shared top score is a tie for the win', () => {
  assert.deepEqual([S.result(done([30, 20, 10])).place, S.result(done([20, 30, 25])).place, S.result(done([20, 20, 5])).place], [1, 3, 1]);
  assert.ok(S.result(done([20, 20, 5])).tied);
});

test('the headline and the message read right and carry the link once', () => {
  assert.equal(S.headline(done([30, 20])), 'I won with 30 points!');
  assert.equal(S.headline(done([20, 20])), 'I tied for the win with 20 points!');
  assert.equal(S.headline(done([20, 30, 25])), 'I scored 20 points and finished 3rd.');
  const m = S.shareMessage(done([30, 20, 10]));
  assert.match(m, /against 2 computer players/); assert.equal(m.split('sdggames.fun').length, 2);
});

test('a pass-and-play result names the winner (or the tie) instead of saying "I"', () => {
  const s = done([20, 30, 25]); s.players[0].name = 'Ann'; s.players[1].name = 'Ben';
  assert.equal(S.headline(s, true), 'Ben won Six Days with 30 points!');
  s.players[2].score = 30; s.players[2].name = 'Cy';
  assert.equal(S.headline(s, true), 'Ben and Cy tied for the win with 30 points!');
  assert.match(S.shareMessage(s, true), /played with friends around one phone/);
});
