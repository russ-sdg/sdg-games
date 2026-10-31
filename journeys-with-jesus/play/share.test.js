import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from './js/engine.js';
import { result, shareMessage, SHARE_URL } from './js/share.js';

const finished = (mine, bot) => {
  const s = E.newGame({ seed: 1, players: [{ name: 'You' }, { name: 'Peter', bot: true, skill: 'steady' }] });
  s.players[0].journeys = mine; s.players[1].journeys = bot; s.over = true;
  return s;
};

test('the share text says your points and place, with the link once', () => {
  const s = finished(['capernaum-to-nazareth'], ['capernaum-to-nain']);
  assert.equal(result(s).place, 2);
  const m = shareMessage(s);
  assert.match(m, /16 points in Journeys with Jesus and finished 2nd of 2/);
  assert.equal(m.split(SHARE_URL).length - 1, 1);
});

test('a tie shares the place', () => {
  const s = finished(['capernaum-to-nazareth'], ['capernaum-to-nazareth']);
  assert.equal(result(s).place, 1);
});
