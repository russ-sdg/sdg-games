import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from './js/share.js';

const done = (sets, winners, endedBy = 'sets') => ({ seed: 1, endedBy, winners, players: sets.map((s, i) => ({ name: 'P' + i, sets: s })) });

test('headlines: a win by sets or by Levi, a tie, and a loss with your place', () => {
  assert.equal(S.headline(done([[1, 2, 3], [4]], [0])), 'I won with three sets of three!');
  assert.equal(S.headline(done([[7], [4]], [0], 'levi')), 'I won with all three Levi cards!');
  assert.equal(S.headline(done([[1, 2], [4]], [0, 1], 'stalemate')), 'I tied for the win with 2 sets!');
  assert.equal(S.headline(done([[1], [4, 5, 6], [2, 3]], [1])), 'I collected 1 set and finished 3rd.');
  assert.equal(S.headline(done([[], [4, 5, 6]], [1])), 'I collected 0 sets and finished 2nd.');
});
test('the message carries the link to the game, once', () => {
  const m = S.shareMessage(done([[1, 2, 3], [4], [5]], [0]));
  assert.match(m, /against 2 computer players\./);
  assert.equal(m.split('https://sdggames.fun/3x3/play/').length, 2);
  assert.match(S.shareMessage(done([[1], [2]], [1])), /against 1 computer player\./);
  assert.equal(S.nativeShareData('f', done([[1], [2]], [1])).url, undefined);
});
