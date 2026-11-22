import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from './js/engine.js';
import * as AI from './js/ai.js';
import { check } from './js/quiz.js';

const two = [{ name: 'A' }, { name: 'B' }];
function rigged(hands, extra = {}) {
  const S = E.newGame({ seed: 1, players: hands.map((h, i) => ({ name: 'P' + i })) });
  S.players.forEach((p, i) => { p.hand = [...hands[i]]; });
  S.turn = 0; S.phase = 'main'; S.flags = { fruit: false, deed: false, joy: false, goodnessFailed: false };
  return Object.assign(S, extra);
}
const L = (S) => E.legal(S).filter((a) => a.t === 'play' || a.t === 'deed');
const up = (S, p, f) => { S.players[p].tree[f] = { s: 1, d: null, wild: false }; };

test('deck: 88 cards, five dealt each, one turned up', () => {
  const S = E.newGame({ seed: 3, players: two });
  const all = [...S.draw, ...S.discard, ...S.players.flatMap((p) => p.hand)];
  assert.equal(all.length, 88);
  for (const [c, n] of Object.entries(E.COPIES)) assert.equal(all.filter((x) => x === c).length, n);
  assert.ok(S.players.every((p) => p.hand.length === 5)); assert.equal(S.discard.length, 1);
});
test('same seed, same deal; illegal actions throw', () => {
  assert.deepEqual(E.newGame({ seed: 5, players: two }), E.newGame({ seed: 5, players: two }));
  assert.throws(() => E.apply(E.newGame({ seed: 5, players: two }), { t: 'end' }));
});
test('a Deed covers your own fruit, and only Self-Control when it shows', () => {
  const S = rigged([['envy', 'peace'], ['joy']]); up(S, 0, 'love'); up(S, 0, 'selfcontrol'); up(S, 1, 'joy');
  const deeds = L(S).filter((a) => a.t === 'deed');
  assert.ok(deeds.length && deeds.every((a) => a.cover === 'selfcontrol'));
  const N = E.apply(S, deeds[0]);
  assert.equal(N.players[0].tree.selfcontrol.s, 2); assert.ok(!N.players[0].hand.includes('envy'));
});
test('no Deed without a showing fruit; deeds cannot be discarded without Self-Control', () => {
  const S = rigged([['envy', 'rivalry'], ['joy']]);
  assert.equal(L(S).filter((a) => a.t === 'deed').length, 0);
  assert.equal(E.legal(S).filter((a) => a.t === 'discard').length, 0);
  up(S, 0, 'selfcontrol');
  assert.equal(E.legal(S).filter((a) => a.t === 'discard').length, 2);
});
test('Love removes deeds from an opponent, who then shows the fruit again', () => {
  const S = rigged([['love'], []]); S.players[1].tree.joy = { s: 2, d: 'envy', wild: false };
  const N = E.apply(S, E.legal(S).find((a) => a.card === 'love'));
  assert.equal(N.players[1].tree.joy.s, 1); assert.ok(N.discard.includes('envy'));
});
test('Love needs an opponent with a deed on them', () => {
  assert.ok(!L(rigged([['love'], []])).some((a) => a.card === 'love'));
});
test('Joy only straight after another fruit; one Fruit card a turn', () => {
  const S = rigged([['joy', 'peace', 'selfcontrol'], []]);
  assert.ok(!L(S).some((a) => a.card === 'joy'));
  const N = E.apply(S, { t: 'play', card: 'peace' });
  assert.ok(L(N).some((a) => a.card === 'joy'));
  assert.ok(!L(N).some((a) => a.card === 'selfcontrol'));
  const M = E.apply(N, { t: 'play', card: 'joy' });
  assert.equal(M.players[0].tree.joy.s, 1);
});
test('Wild only when no other fruit can be played', () => {
  assert.ok(L(rigged([['wild'], []])).some((a) => a.card === 'wild'));
  assert.ok(!L(rigged([['wild', 'peace'], []])).some((a) => a.card === 'wild'));
});
test('Patience needs a skipped turn first', () => {
  let S = rigged([['patience'], ['peace']]); S.phase = 'start';
  assert.ok(!L({ ...S, phase: 'main' }).some((a) => a.card === 'patience'));
  S = E.apply(S, { t: 'skip' }); assert.equal(S.turn, 1);
  S = E.apply(S, { t: 'skip' }); assert.equal(S.turn, 0);
  S.phase = 'main'; assert.ok(L(S).some((a) => a.card === 'patience'));
});
test('Peace: everyone discards a deed', () => {
  const S = rigged([['peace', 'envy'], ['rivalry']]);
  const N = E.apply(S, { t: 'play', card: 'peace' });
  assert.ok(!N.players[0].hand.includes('envy') && N.players[1].hand.length === 0);
});
test('Self-Control clears deeds from hand and tree', () => {
  const S = rigged([['selfcontrol', 'envy'], []]); S.players[0].tree.love = { s: 2, d: 'envy', wild: false };
  const N = E.apply(S, { t: 'play', card: 'selfcontrol' });
  assert.equal(N.players[0].tree.love.s, 1); assert.deepEqual(N.players[0].hand, []);
});
test('Kindness: gift goes on the opponent tree; Jealousy snatches it', () => {
  const S = rigged([['kindness', 'love'], ['jealousy']]); up(S, 1, 'peace');
  const a = E.legal(S).find((x) => x.card === 'kindness' && x.give === 'love');
  const N = E.apply(S, a);
  assert.equal(N.pending.kind, 'jealous'); assert.equal(N.pending.actor, 1);
  const M = E.apply(N, E.legal(N).find((x) => x.t === 'jealousy'));
  assert.equal(M.players[1].tree.love.s, 1); assert.equal(M.players[1].tree.peace.s, 2);
  const K = E.apply(N, { t: 'pass' }); assert.equal(K.players[1].tree.love.s, 1); assert.equal(K.pending, null);
});
test('Gentleness hands your hand over; the opponent takes a card', () => {
  const S = rigged([['gentleness', 'love', 'peace'], []]);
  let N = E.apply(S, { t: 'play', card: 'gentleness', target: 1 });
  assert.equal(N.phase, 'gentle'); N = E.apply(N, { t: 'handover' });
  assert.equal(N.pending.actor, 1); N = E.apply(N, { t: 'take', card: 'love' });
  assert.deepEqual(N.players[1].hand, ['love']); assert.deepEqual(N.players[0].hand, ['peace']);
});
test('Uncleanness takes a discarded card you need', () => {
  const S = rigged([['peace', 'joy'], ['uncleanness']]); up(S, 1, 'joy');
  const N = E.apply(S, { t: 'discard', card: 'peace' });
  assert.equal(N.pending.kind, 'uncl');
  const M = E.apply(N, E.legal(N).find((x) => x.t === 'uncl'));
  assert.ok(M.players[1].hand.includes('peace'));
});
test('Faithfulness drawn must be played or discarded, then draw again', () => {
  const S = rigged([['peace'], []]); S.phase = 'start'; S.draw.push('faithfulness');
  let N = E.apply(S, { t: 'draw', from: 'pile' });
  assert.equal(N.phase, 'faith'); N = E.apply(N, { t: 'faith', play: true });
  assert.equal(N.players[0].tree.faithfulness.s, 1); assert.equal(N.phase, 'draw1');
});
test('all nine showing wins at once', () => {
  const S = rigged([['peace'], []]); for (const f of E.FRUITS) if (f !== 'peace') up(S, 0, f);
  assert.ok(E.apply(S, { t: 'play', card: 'peace' }).over);
});
test('ending a turn draws back to five and passes play on', () => {
  let S = rigged([['peace'], ['joy']]); S = E.apply(S, { t: 'end' });
  while (S.turn === 0) S = E.apply(S, { t: 'draw', from: 'pile' });
  assert.equal(S.players[0].hand.length, 5); assert.equal(S.turn, 1);
});
test('computer-only games always finish and never lose a card', () => {
  for (let g = 1; g <= 12; g++) {
    let S = E.newGame({ seed: g, players: [0, 1, 2].map((i) => ({ name: 'P' + i, bot: true, skill: ['casual', 'steady', 'sharp'][i] })) }), n = 0;
    while (!S.over && n++ < 20000) S = E.apply(S, AI.choose(S, S.players[E.actor(S)].skill));
    assert.ok(S.over, 'game ' + g);
    const cards = [...S.draw, ...S.discard, ...S.players.flatMap((p) => p.hand), ...S.players.flatMap((p) => Object.values(p.tree).filter((s) => s.s === 2).map((s) => s.d))];
    assert.ok(cards.length <= 88);
  }
});
test('Goodness recital: any order, other wording, small slips', () => {
  assert.ok(check('Love, Joy, Peace, Longsuffering, Kindness, Goodness, Faith, Meekness, Self control').ok);
  assert.ok(check('self-control gentleness faithfulness goodness kindnes patience peace joy love').ok);
  assert.equal(check('love joy peace').count, 3);
});
