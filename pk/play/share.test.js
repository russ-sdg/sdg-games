import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from './js/engine.js';
import * as S from './js/share.js';

const done = (scores) => {
  const s = E.newGame({ seed: 3, players: scores.map((_, i) => ({ name: i ? 'Bot' + i : 'You', bot: i > 0 })) });
  s.players.forEach((p, i) => { p.score = scores[i]; }); s.over = true; s.endedBy = 'draw';
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
  assert.match(m, /Prophets & Kings, against 2 computer players/); assert.equal(m.split('sdggames.fun').length, 2);
  assert.match(S.shareMessage(done([30, 20])), /against 1 computer player\./);
});

test('the picture shows your best sets first and says how many did not fit', () => {
  const s = done([0, 0]), u = (n, k = 0) => E.DEFS.map((d, i) => (d.name === n ? i : -1)).filter((i) => i >= 0)[k];
  s.players[0].sets = [{ head: u('Elijah'), members: [u('Ahab')] }, { head: u('Elisha'), members: [u('Ahab', 1), u('Jehu'), u('Joram')] }];
  const { rows, more } = S.shownSets(s);
  assert.equal(E.label(rows[0].head), 'Elisha'); assert.equal(more, 0);
  s.players[0].sets = Array.from({ length: 8 }, (_, i) => ({ head: u('Daniel', i % 2), members: [u('Cyrus')] }));
  assert.equal(S.shownSets(s).rows.length, S.MAX_ROWS); assert.equal(S.shownSets(s).more, 2);
});
