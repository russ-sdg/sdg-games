import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from './js/engine.js';
import { headline, shareMessage, result, SHARE_URL } from './js/share.js';

function ended(youDone, themDone, winners) {
  const S = E.newGame({ seed: 1, players: [{ name: 'You', bot: false, color: 'R' }, { name: 'Anna', bot: true, skill: 'steady', color: 'B' }] });
  S.players[0].done = youDone; S.players[1].done = themDone; S.players.forEach((p) => { p.offer = []; }); S.over = true; S.winners = winners;
  return S;
}
test('the share text says how you did and carries the link', () => {
  assert.equal(headline(ended(['peter'], ['nicodemus'], [0])), 'I won with 170 points and 1 journey!');
  assert.match(headline(ended(['nicodemus'], ['peter'], [1])), /^I scored 30 points with 1 journey and finished 2nd\.$/);
  assert.match(headline(ended(['nicodemus'], ['nicodemus'], [0, 1])), /tied for the win with 30 points/);
  assert.equal(shareMessage(ended(['peter'], [], [0])), `I won with 170 points and 1 journey! Journeys through Jerusalem, against 1 computer player. ${SHARE_URL}`);
  assert.equal(result(ended(['peter'], ['judas'], [0])).place, 1);
});
