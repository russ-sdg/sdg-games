import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from './js/engine.js';
import * as AI from './js/ai.js';
import { CARDS, CARD } from './js/cards.js';

const mk = (n = 3, extra = {}) => E.newGame({ seed: 3, players: Array.from({ length: n }, (_, i) => ({ name: 'P' + i, role: ['doctor', 'neighbor', 'preacher', 'teacher'][i] })), ...extra });
const es = (...a) => a.map(([p, card, grace]) => ({ p, card, grace: !!grace }));

test('the deck: 48 cards, 12 per Gospel, four star cards, symbols as printed', () => {
  assert.equal(CARDS.length, 48);
  for (const s of ['matthew', 'mark', 'luke', 'john']) assert.equal(CARDS.filter((c) => c.suit === s).length, 12);
  assert.deepEqual(CARDS.filter((c) => c.special).map((c) => c.id).sort(), ['john-1-5', 'luke-19-24', 'mark-14-27', 'matthew-19-30']);
  assert.deepEqual(CARD['luke-8-50'].roles.sort(), ['doctor', 'neighbor']);
  assert.deepEqual(CARD['john-9-6-7'].roles.sort(), ['doctor', 'teacher']);
  assert.ok(CARDS.every((c) => c.special ? !c.roles.length : c.roles.length >= 1));
  const unique = new Set(CARDS.map((c) => `${c.ch}:${c.vs}:${c.suit}`)); assert.equal(unique.size, 48);
});
test('dealing: hand sizes grow by one, dealer to the left bids first', () => {
  const S = mk(3, { dealer: 2 });
  assert.equal(E.handSize(S), 1); assert.equal(S.turn, 0); assert.ok(S.players.every((p) => p.hand.length === 1));
  assert.equal(new Set(S.players.flatMap((p) => p.hand)).size, 3);
});
test('"all or nothing" hands are the 6- and 12-card ones', () => {
  assert.ok(E.isAllNothing(6) && E.isAllNothing(12) && !E.isAllNothing(5));
  assert.deepEqual(E.HAND_PLANS.long.length, 23);
});
test('scoring as printed', () => {
  assert.equal(E.handPoints(3, 0, 0), 2); assert.equal(E.handPoints(3, 1, 1), 3); assert.equal(E.handPoints(3, 0, 1), 0);
  assert.equal(E.handPoints(6, 6, 6), 12); assert.equal(E.handPoints(6, 6, 5), 0); assert.equal(E.handPoints(6, 0, 3), 6);
  assert.equal(E.handPoints(12, 12, 12), 24); assert.equal(E.handPoints(12, 0, 3), 18);
});
test('Not Perfect bidding: the last bidder may not make the bids add up', () => {
  const S = mk(3, { notPerfect: true });
  const T = E.apply(E.apply(S, { t: 'bid', n: 1 }), { t: 'bid', n: 0 });
  assert.deepEqual(E.legal(T).map((a) => a.n), [1]);        // 1 + 0 + 0 would add up to the 1 card dealt
  assert.deepEqual(E.legal(S).map((a) => a.n), [0, 1]);
});
test('trick: highest card of the suit led wins; off-suit cards lose', () => {
  assert.equal(E.trickResult(es([0, 'mark-1-11'], [1, 'mark-4-2'], [2, 'luke-19-47'])).winner, 1);
  assert.equal(E.trickResult(es([0, 'mark-1-31'], [1, 'mark-1-11'])).winner, 0);
});
test('Grace beats non-Grace; the higher Grace wins; disabled by John 1:5', () => {
  assert.equal(E.trickResult(es([0, 'mark-4-2'], [1, 'luke-19-47', true])).winner, 1);
  assert.equal(E.trickResult(es([0, 'mark-4-2', true], [1, 'luke-4-39', true])).winner, 1);      // 4:39 is higher than 4:2
  assert.equal(E.trickResult(es([0, 'mark-1-31'], [1, 'luke-19-47', true], [2, 'john-1-5'])).winner, 0);
});
test('star cards: lowest wins, leader wins, the last decisive one governs', () => {
  assert.equal(E.trickResult(es([0, 'matthew-22-37-39'], [1, 'matthew-19-30'], [2, 'matthew-4-17'])).winner, 2);
  assert.equal(E.trickResult(es([0, 'matthew-4-17'], [1, 'matthew-19-30'], [2, 'luke-19-47'])).winner, 0);
  assert.equal(E.trickResult(es([1, 'mark-1-11'], [2, 'mark-14-27'], [0, 'mark-10-52'])).winner, 1);
  assert.equal(E.trickResult(es([0, 'matthew-4-17'], [1, 'matthew-19-30'], [2, 'mark-14-27'])).winner, 0);
});
test('roles rotate right: you take the role of the player on your left', () => {
  assert.deepEqual(E.rotateRoles(['doctor', 'neighbor', 'preacher']), ['neighbor', 'preacher', 'doctor']);
});
test('you must follow suit if you can, and may offer Grace only with your role symbol', () => {
  const S = mk(2); S.phase = 'play'; S.players[0].hand = ['mark-1-11', 'luke-4-39', 'matthew-4-17']; S.players[1].hand = ['mark-4-2']; S.turn = 0;
  S.players[0].role = 'doctor';
  const first = E.apply(S, { t: 'play', card: 'mark-1-11', grace: false });
  assert.equal(first.turn, 1);
  const L = E.legal({ ...first, pending: null, trick: [first.trick[0]] });
  assert.ok(E.legalCards(['mark-4-2', 'luke-4-39'], [{ p: 0, card: 'mark-1-11' }]).length === 1);
  assert.ok(E.legal(S).some((a) => a.card === 'luke-4-39' && a.grace));      // doctor symbol
  assert.ok(!E.legal(S).some((a) => a.card === 'mark-1-11' && a.grace));     // heart: not the doctor's
  assert.ok(L.length >= 1);
});
test('a Grace card played plain can be proclaimed by another player', () => {
  const S = mk(3); S.phase = 'play'; S.players[0].hand = ['luke-4-39']; S.players[1].hand = ['luke-19-47']; S.players[2].hand = ['luke-6-31']; S.turn = 0; S.players[0].role = 'doctor';
  const N = E.apply(S, { t: 'play', card: 'luke-4-39', grace: false });
  assert.equal(N.pending.kind, 'proclaim'); assert.equal(N.pending.actor, 1);
  const M = E.apply(N, { t: 'proclaim' });
  assert.equal(M.trick[0].grace, true); assert.equal(M.turn, 1);
  const K = E.apply(E.apply(N, { t: 'pass' }), { t: 'pass' }); assert.equal(K.pending, null); assert.equal(K.turn, 1);
});
test('Luke 19:24 rotates the roles at once', () => {
  const S = mk(3); S.phase = 'play'; S.players[0].hand = ['luke-19-24']; S.turn = 0;
  const N = E.apply(S, { t: 'play', card: 'luke-19-24', grace: false });
  assert.deepEqual(N.players.map((p) => p.role), ['neighbor', 'preacher', 'doctor']);
});
test('winning the last trick scores the hand and deals the next, one card bigger', () => {
  let S = mk(2);
  S = E.apply(E.apply(S, { t: 'bid', n: 0 }), { t: 'bid', n: 0 });
  while (S.handNo === 0) S = E.apply(S, E.legal(S)[0]);
  assert.equal(S.history.length, 1); assert.equal(E.handSize(S), 2); assert.equal(S.phase, 'bid');
  assert.equal(S.players.reduce((a, p) => a + p.score, 0) >= 0, true);
});
test('computer-only games always finish, in every length', () => {
  for (const plan of ['short', 'standard']) for (let g = 1; g <= 3; g++) {
    let S = E.newGame({ seed: g, plan, notPerfect: g === 2, players: [0, 1, 2].map((i) => ({ name: 'P' + i, bot: true, skill: ['casual', 'steady', 'sharp'][i], role: ['doctor', 'neighbor', 'preacher', 'teacher'][i] })) }), n = 0;
    while (!S.over && n++ < 50000) S = E.apply(S, AI.choose(S, S.players[E.actor(S)].skill));
    assert.ok(S.over && S.winners.length >= 1, `${plan} ${g}`);
    assert.equal(S.history.length, S.sizes.length);
  }
});
test('share text: headline and link', async () => {
  const { headline, shareMessage } = await import('./js/share.js');
  const S = mk(2); S.players[0].score = 40; S.players[1].score = 30; S.winners = [0]; S.over = true;
  assert.match(headline(S), /won with 40 points/); assert.match(shareMessage(S), /sdggames\.fun\/illuminate\/play\//);
  S.winners = [1]; S.players[0].score = 30; S.players[1].score = 40; assert.match(headline(S), /finished 2nd/);
});
