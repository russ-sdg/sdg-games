import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../scorepad-core.js';

test('a player totals sets by the printed table: 2/5/10/25/50/100 for 2 to 7 cards', () => {
  let pad = P.newPad(1);
  assert.equal(P.total(pad.players[0]), 0);
  for (const [size, pts] of [[2, 2], [3, 5], [4, 10], [5, 25], [6, 50], [7, 100]]) assert.equal(P.points(size), pts);
  pad = P.step(pad, 0, 7, 1); pad = P.step(pad, 0, 4, 2); pad = P.step(pad, 0, 2, 1);
  assert.equal(P.total(pad.players[0]), 100 + 20 + 2);
  assert.equal(P.cardCount(pad.players[0]), 7 + 8 + 2);
});

test('steps stay between 0 and the limit and never change the pad they were given', () => {
  const pad = P.newPad(2), same = P.step(pad, 0, 5, -1);
  assert.equal(same.players[0].sets[5], 0);
  let p = pad; for (let i = 0; i < 40; i++) p = P.step(p, 1, 3, 1);
  assert.equal(p.players[1].sets[3], P.MAX_SETS); assert.equal(pad.players[1].sets[3], 0);
  assert.equal(P.step(pad, 9, 3, 1), pad); assert.equal(P.step(pad, 0, 9, 1), pad);
});

test('standings: ties share a rank, and nobody leads before anybody scores', () => {
  let pad = P.newPad(3);
  assert.ok(P.standings(pad).every((r) => !r.leader && r.rank === 1));
  pad = P.step(pad, 0, 3, 1); pad = P.step(pad, 2, 3, 1); pad = P.step(pad, 1, 2, 1);
  const s = P.standings(pad);
  assert.deepEqual(s.map((r) => [r.i, r.total, r.rank, r.leader]), [[0, 5, 1, true], [2, 5, 1, true], [1, 2, 3, false]]);
});

test('players can be added up to six and removed down to one', () => {
  let pad = P.newPad(2);
  for (let i = 0; i < 8; i++) pad = P.addPlayer(pad);
  assert.equal(pad.players.length, P.MAX_PLAYERS); assert.equal(pad.players[5].name, 'Player 6');
  for (let i = 0; i < 8; i++) pad = P.removePlayer(pad, 0);
  assert.equal(pad.players.length, 1);
});

test('resetting scores keeps the names; a damaged saved pad is repaired or dropped', () => {
  let pad = P.newPad(2); pad.players[0].name = 'Ann'; pad = P.step(pad, 0, 7, 2);
  const r = P.resetScores(pad);
  assert.equal(r.players[0].name, 'Ann'); assert.equal(P.total(r.players[0]), 0);
  assert.equal(P.sanitize(null), null); assert.equal(P.sanitize({ v: 2, players: [] }), null);
  const fixed = P.sanitize({ v: 1, players: [{ name: 'x'.repeat(50), sets: { 7: -3, 6: 'a', 5: 2.5, 4: 3 } }] });
  assert.equal(fixed.players[0].name.length, 24); assert.equal(P.total(fixed.players[0]), 30);
});

test('the summary lists everyone, best first', () => {
  let pad = P.newPad(2); pad.players[1].name = 'Ben'; pad = P.step(pad, 1, 5, 1);
  assert.equal(P.summary(pad), 'Prophets & Kings scores: Ben 25, Player 1 0.');
});
