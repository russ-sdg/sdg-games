import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from './js/engine.js';
import * as B from './js/build.js';

const players = [{ name: 'You' }, { name: 'Bot', bot: true, skill: 'steady' }];
const defs = E.deckDefs(false);
function game(hand, jids, { tokens = 0 } = {}) {
  let s = E.newGame({ seed: 5, players });
  const all = [...s.draw, ...s.up, ...s.players.flatMap((p) => p.hand)];
  const taken = new Set();
  const uids = hand.map((n) => { const u = all.find((x) => !taken.has(x) && (n.startsWith('wild:') ? defs[x].kind === 'wild' && defs[x].region === n.slice(5) : defs[x].place === n)); taken.add(u); return u; });
  for (const q of s.players) q.hand = q.hand.filter((u) => !taken.has(u));
  s.draw = s.draw.filter((u) => !taken.has(u)); s.up = s.up.map((u) => (taken.has(u) ? s.draw.pop() : u));
  s.players[0].hand = uids; s.players[0].tokens = tokens;
  s.inplay = jids; s.jdeck = s.jdeck.filter((j) => !jids.includes(j));
  s.phase = 'play'; s.turn = 0;
  return s;
}
const tap = (s, b, place, which = 0) => B.add(b, B.cardsFor(s, b, place)[which]);

test('a new line starts at one end of the journey and runs along the roads to the other', () => {
  const s = game(['capernaum', 'magdala', 'cana', 'nazareth'], ['capernaum-to-nazareth']);
  let { build } = B.begin(s, 'capernaum-to-nazareth');
  assert.equal(build.mode, 'fresh');
  assert.equal(B.canPlace(build, 'magdala').ok, false, 'must start at an end');
  let r = tap(s, build, 'nazareth'); build = r.build;
  assert.equal(r.done, false);
  assert.equal(B.canPlace(build, 'capernaum').ok, false, 'Capernaum is not next to Nazareth');
  assert.equal(B.canPlace(build, 'cana').ok, true);
  r = tap(s, build, 'cana'); build = r.build;
  r = tap(s, build, 'magdala'); build = r.build;
  r = tap(s, build, 'capernaum');
  assert.equal(r.done, true);
  const s2 = E.play(s, B.toPlay(r.build));
  assert.equal(E.score(s2.players[0]).total, 16);
  assert.deepEqual(s2.chains[0], ['nazareth', 'cana', 'magdala', 'capernaum']);
});

test('you only have the cards you hold, and a card is used once', () => {
  const s = game(['capernaum', 'cana', 'nazareth'], ['capernaum-to-nazareth']);
  let { build } = B.begin(s, 'capernaum-to-nazareth');
  build = tap(s, build, 'capernaum').build;
  assert.equal(B.cardsFor(s, build, 'magdala').length, 0, 'no Magdala card');
  assert.equal(B.cardsFor(s, build, 'capernaum').length, 0, 'the Capernaum card is already on the line');
});

test('wild cards and tokens stand in, in order of preference', () => {
  const s = game(['capernaum', 'wild:galilee', 'wild:israel', 'nazareth'], ['capernaum-to-nazareth'], { tokens: 1 });
  let { build } = B.begin(s, 'capernaum-to-nazareth');
  build = tap(s, build, 'capernaum').build;
  assert.deepEqual(B.cardsFor(s, build, 'magdala').map((c) => c.kind), ['region', 'israel', 'token']);
  build = tap(s, build, 'magdala', 0).build;                 // the Galilee wild is Magdala
  assert.deepEqual(B.cardsFor(s, build, 'cana').map((c) => c.kind), ['israel', 'token']);
  build = tap(s, build, 'cana', 0).build;                    // the Israel wild is Cana
  const r = tap(s, build, 'nazareth');
  assert.equal(r.done, true);
  const s2 = E.play(s, B.toPlay(r.build));
  assert.equal(s2.players[0].hand.length, 0);
  assert.equal(s2.players[0].tokens, 1, 'the token was not needed');
});

test('a token can stand for a place, and is forfeited', () => {
  const s = game(['capernaum', 'cana', 'nazareth'], ['capernaum-to-nazareth'], { tokens: 1 });
  let { build } = B.begin(s, 'capernaum-to-nazareth');
  build = tap(s, build, 'capernaum').build;
  build = tap(s, build, 'magdala').build;
  build = tap(s, build, 'cana').build;
  const r = tap(s, build, 'nazareth');
  assert.equal(r.done, true);
  assert.equal(E.play(s, B.toPlay(r.build)).players[0].tokens, 0);
});

test('undo takes the last card back', () => {
  const s = game(['capernaum', 'bethsaida'], ['capernaum-to-bethsaida']);
  let { build } = B.begin(s, 'capernaum-to-bethsaida');
  build = tap(s, build, 'capernaum').build;
  assert.equal(build.target, 'bethsaida');
  build = B.undo(build);
  assert.equal(build.seq.length, 0);
  assert.equal(build.target, null);
});

test('after a journey is laid, another that is wholly inside it is taken with no cards', () => {
  let s = game(['capernaum', 'magdala', 'cana', 'nazareth'], ['capernaum-to-nazareth', 'capernaum-to-cana', 'tyre-to-gadara']);
  let { build } = B.begin(s, 'capernaum-to-nazareth');
  for (const place of ['capernaum', 'magdala', 'cana', 'nazareth']) { const r = tap(s, build, place); build = r.build; if (r.done) s = E.play(s, B.toPlay(build)); }
  const again = B.begin(s, 'capernaum-to-cana');
  assert.ok(again.inside, 'Capernaum, Magdala, Cana is a run of what was laid');
  s = E.play(s, again.inside);
  assert.equal(E.score(s.players[0]).total, 16 + 9);
  assert.deepEqual(s.inplay, [null, null, 'tyre-to-gadara']);
});

test('after a journey is laid, another can be built on top of its end, reusing the cards laid', () => {
  let s = game(['capernaum', 'magdala', 'cana', 'nazareth', 'nain'], ['capernaum-to-nazareth', 'capernaum-to-nain']);
  let { build } = B.begin(s, 'capernaum-to-nazareth');
  for (const place of ['capernaum', 'magdala', 'cana', 'nazareth']) { const r = tap(s, build, place); build = r.build; if (r.done) s = E.play(s, B.toPlay(build)); }
  const ext = B.begin(s, 'capernaum-to-nain');
  assert.equal(ext.build.mode, 'extend');
  assert.equal(ext.build.side, null, 'which end you continue from is settled by your first card');
  assert.deepEqual(B.lineEnds(ext.build), ['capernaum', 'nazareth']);
  assert.equal(B.canPlace(ext.build, 'cana').ok, false, 'already on your line');
  assert.equal(B.canPlace(ext.build, 'tyre').ok, false, 'not next to either end');
  const r = tap(s, ext.build, 'nain');
  assert.equal(r.done, true);
  assert.equal(r.build.side, 'end');
  assert.deepEqual(r.build.reuse, ['capernaum', 'magdala', 'cana', 'nazareth']);
  s = E.play(s, B.toPlay(r.build));
  assert.equal(E.score(s.players[0]).total, 16 + 25);
  assert.equal(s.players[0].hand.length, 0);
  assert.deepEqual(s.chains, [['capernaum', 'magdala', 'cana', 'nazareth', 'nain']]);
});

test('a journey can also be extended from the other end of the line you laid', () => {
  // laid from Nazareth to Capernaum, so the line starts at Nazareth: Cana to Sychar continues from that start (Nain, Sychar)
  let s = game(['nazareth', 'cana', 'magdala', 'capernaum', 'nain', 'sychar'], ['capernaum-to-nazareth', 'cana-to-sychar']);
  let { build } = B.begin(s, 'capernaum-to-nazareth');
  for (const place of ['nazareth', 'cana', 'magdala', 'capernaum']) { const r = tap(s, build, place); build = r.build; if (r.done) s = E.play(s, B.toPlay(build)); }
  assert.deepEqual(s.chains[0], ['nazareth', 'cana', 'magdala', 'capernaum']);
  const ext = B.begin(s, 'cana-to-sychar');
  assert.equal(ext.build.mode, 'extend');
  // Nain is joined to Nazareth, the start of the line, not to Capernaum, the end
  assert.equal(B.canPlace(ext.build, 'nain').ok, true);
  let r = tap(s, ext.build, 'nain');
  assert.equal(r.build.side, 'start');
  assert.deepEqual(r.build.reuse, ['cana', 'nazareth'], 'from Cana back out to the start of the line');
  r = tap(s, r.build, 'sychar');
  assert.equal(r.done, true);
  s = E.play(s, B.toPlay(r.build));
  assert.equal(E.score(s.players[0]).total, 16 + 16);
  assert.deepEqual(s.chains, [['sychar', 'nain', 'nazareth', 'cana', 'magdala', 'capernaum']]);
});

test('undoing the first card of an extension lets you choose the end again', () => {
  let s = game(['nazareth', 'cana', 'magdala', 'capernaum', 'nain'], ['capernaum-to-nazareth', 'cana-to-sychar']);
  s.chains = [['nazareth', 'cana', 'magdala', 'capernaum']];
  let { build } = B.begin(s, 'cana-to-sychar');
  build = tap(s, build, 'nain').build;
  assert.equal(build.side, 'start');
  build = B.undo(build);
  assert.equal(build.side, null);
  assert.deepEqual(build.reuse, []);
});

test('you may decline to extend and start a separate line instead', () => {
  const s = game(['capernaum'], ['capernaum-to-nazareth', 'capernaum-to-nain']);
  s.chains = [['capernaum', 'magdala', 'cana', 'nazareth']];
  const { build } = B.begin(s, 'capernaum-to-nain');
  assert.equal(build.mode, 'extend');
  assert.equal(B.startFresh(build).mode, 'fresh');
});

test('the engine refuses a route that is not on the board or does not match the cards', () => {
  const s = game(['capernaum', 'nazareth'], ['capernaum-to-nazareth']);
  const defsHand = s.players[0].hand;
  const bad = { journey: 'capernaum-to-nazareth', extends: false, path: ['capernaum', 'nazareth'], from: 0, assign: [{ place: 'capernaum', uid: defsHand[0], kind: 'exact' }, { place: 'nazareth', uid: defsHand[1], kind: 'exact' }] };
  assert.throws(() => E.play(s, bad), /illegal/);
  const wrongCard = { journey: 'capernaum-to-nazareth', extends: false, path: ['capernaum', 'magdala', 'cana', 'nazareth'], from: 0, assign: ['capernaum', 'magdala', 'cana', 'nazareth'].map((place) => ({ place, uid: defsHand[0], kind: 'exact' })) };
  assert.throws(() => E.play(s, wrongCard), /illegal/);
});
