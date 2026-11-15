import test from 'node:test';
import assert from 'node:assert/strict';
import { TILES, ADJ, SITES, SITE_TILE, COLORS, distFrom, reachable, pathBetween } from './js/map-data.js';
import { CARDS, CARD } from './js/cards.js';
import * as E from './js/engine.js';

const players = (n) => Array.from({ length: n }, (_, i) => ({ name: 'P' + i, bot: false, color: 'RBTLDG'[i] }));
const site = (id) => SITE_TILE[SITES.findIndex((s) => s.id === id)];
const sq = (x, y) => TILES.find((t) => t.x === x && t.y === y).i;
const id = (s) => SITES.findIndex((x) => x.id === s);
// a game ready to roll, with chosen cards and squares (everyone else in the deck)
function game(cards, pos) {
  const S = E.newGame({ seed: 7, players: players(cards.length) });
  S.phase = 'roll'; S.roller = 0; S.deck = CARDS.map((c) => c.id).filter((c) => !cards.includes(c));
  S.players.forEach((p, i) => { p.offer = []; p.card = cards[i]; p.pos = pos[i]; });
  return S;
}
// one round: the die is `die`, everyone moves as listed (a square or null to stay)
function round(S, die, moves) { S = E.roll(S); S.die = die; moves.forEach((m, i) => { S = E.submitMove(S, i, m); }); return E.resolve(S); }
const RED_BY_TOMB = () => sq(482, 532);                        // the red square beside both the Tomb and Golgotha

test('the map: 11 sites on one square each, joined into one connected road, with squares of all six token colours', () => {
  assert.equal(SITES.length, 11);
  SITES.forEach((_, s) => assert.equal(TILES.filter((t) => t.site === s).length, 1));
  assert.ok(distFrom(0).every((d) => d >= 0), 'every square can be reached from every other');
  ADJ.forEach((l, i) => { assert.ok(l.length >= 1); l.forEach((j) => assert.ok(ADJ[j].includes(i), 'edges go both ways')); });
  for (const c of COLORS) assert.ok(TILES.filter((t) => t.c === c.id).length >= 4, `${c.name} has squares to start on`);
  assert.ok(TILES.filter((t) => t.site !== null).every((t) => t.c === 'W') && TILES.filter((t) => t.site === null).every((t) => COLORS.some((c) => c.id === t.c)));
  const ends = TILES.filter((t) => ADJ[t.i].length === 1);                       // the road's three dead ends
  assert.equal(ends.length, 3); assert.ok(ends.some((t) => t.site === id('emmaus')) && ends.some((t) => t.site === id('bethany')));
});
test('the map: distances and moves along the printed path', () => {
  const b = site('bethany'), m = site('olives'), g = site('gethsemane');
  assert.equal(distFrom(b)[m], 7); assert.equal(distFrom(m)[g], 3);
  assert.equal(reachable(b, 2).length, 2); assert.ok(reachable(b, 2).every((o) => o.steps >= 1 && o.steps <= 2));
  const path = pathBetween(b, m); assert.equal(path.length, 8); assert.equal(path[0], b); assert.equal(path.at(-1), m);
  assert.equal(distFrom(site('golgotha'))[site('tomb')], 2, 'Golgotha and the Tomb meet at the red square beside them');
});
test('the 18 Character Cards: 7 Apostles, 5 Friends of Jesus, 6 Enemies of Christ, with real sites', () => {
  assert.equal(CARDS.length, 18);
  const n = {}; for (const c of CARDS) n[c.cat] = (n[c.cat] || 0) + 1;
  assert.deepEqual(n, { apostle: 7, friend: 5, enemy: 6 });
  for (const c of CARDS) { assert.ok(c.stops.length >= 2 && c.pts > 0); c.stops.forEach((s) => { assert.ok(id(s.site) >= 0, `${c.id}: ${s.site}`); assert.ok(s.ref); }); assert.equal(new Set(c.stops.map((s) => s.site)).size, c.stops.length); }
  assert.equal(CARD.peter.pts, 170); assert.equal(CARD.nicodemus.stops.length, 2); assert.equal(CARD.judas.pts, 130);
});

test('setup: two cards each, keep one, start on a square of your colour; the other card goes to the bottom of the deck', () => {
  let S = E.newGame({ seed: 5, players: players(2) });
  assert.equal(S.deck.length, 14); assert.ok(S.players.every((p) => p.offer.length === 2));
  const [a, b] = S.players[0].offer;
  assert.throws(() => E.chooseStart(S, 0, S.deck[0], E.startSquares(S, 0)[0]), /two cards/);
  assert.throws(() => E.chooseStart(S, 0, a, E.startSquares(S, 1)[0]), /colour/);
  S = E.chooseStart(S, 0, a, E.startSquares(S, 0)[0]);
  assert.equal(S.deck.at(-1), b); assert.equal(S.phase, 'start');
  S = E.chooseStart(S, 1, S.players[1].offer[0], E.startSquares(S, 1)[0]);
  assert.equal(S.phase, 'roll'); assert.equal(S.deck.length, 16);
});
test('same seed, same deal; a saved game survives JSON', () => {
  const a = E.newGame({ seed: 99, players: players(3) });
  assert.deepEqual(E.newGame({ seed: 99, players: players(3) }), a);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
  assert.notDeepEqual(E.newGame({ seed: 100, players: players(3) }).deck, a.deck);
});

test('moving: up to the die; finishing on a site marks it', () => {
  let S = game(['andrew', 'scribe'], [sq(1091, 832), sq(485, 705)]);
  S = E.roll(S); S.die = 6;
  assert.throws(() => E.submitMove(S, 0, site('temple')), /too far/);
  assert.throws(() => E.submitMove(S, 0, S.players[0].pos === 0 ? 1 : 0), /too far/);
  S = E.submitMove(S, 0, site('bethany'));
  assert.throws(() => E.submitMove(S, 0, site('bethany')), /not time/);
  assert.equal(E.allMoved(S), false);
  S = E.submitMove(S, 1, null); assert.ok(E.allMoved(S));
  S = E.resolve(S);
  assert.deepEqual(S.players[0].visited, [id('bethany')]); assert.equal(S.players[0].pos, site('bethany'));
  assert.equal(S.roller, 1, 'the die passes to the next player');
});
test('passing over a site does not count, only finishing on it', () => {
  let S = game(['nicodemus', 'scribe'], [sq(480, 622), sq(485, 705)]);          // the blue square below the Tomb
  S = round(S, 3, [site('golgotha'), null]);                                    // Tomb, red, Golgotha: three squares
  assert.deepEqual(S.players[0].visited, [id('golgotha')]);
});
test('moving fewer squares includes none: staying put counts if you stand on a site you need', () => {
  let S = game(['nicodemus', 'scribe'], [site('tomb'), sq(485, 705)]);
  S = round(S, 1, [null, null]);
  assert.deepEqual(S.players[0].visited, [id('tomb')]);
  S = game(['nicodemus', 'scribe'], [RED_BY_TOMB(), sq(485, 705)]);
  S = round(S, 1, [null, null]);
  assert.deepEqual(S.players[0].visited, [], 'standing on a plain square marks nothing');
});

test('completing a journey: announce, score, draw two, keep one; visited marks are wiped', () => {
  let S = game(['nicodemus', 'scribe', 'cleopas'], [RED_BY_TOMB(), sq(485, 705), sq(527, 705)]);
  S = round(S, 1, [site('tomb'), null, null]);
  assert.equal(S.players[0].done.length, 0);
  const deck = S.deck.length;
  S = round(S, 2, [site('golgotha'), null, null]);
  assert.deepEqual(S.last.filter((e) => e.t === 'complete').map((e) => [e.seat, e.card]), [[0, 'nicodemus']]);
  assert.equal(E.score(S.players[0]), 30);
  assert.equal(S.phase, 'pick'); assert.equal(S.players[0].offer.length, 2); assert.equal(S.deck.length, deck - 2);
  assert.deepEqual(S.players[0].visited, []); assert.equal(S.players[0].card, null);
  const [keep, back] = S.players[0].offer;
  S = E.chooseCard(S, 0, keep);
  assert.equal(S.players[0].card, keep); assert.equal(S.deck.at(-1), back); assert.equal(S.phase, 'roll'); assert.equal(S.deck.length, deck - 1);
  assert.throws(() => E.chooseCard(S, 0, keep), /not one|pick/);
});
test('two players can complete a journey on the same roll, and both draw', () => {
  let S = game(['nicodemus', 'simon-of-cyrene'], [site('tomb'), site('praetorium')]);
  S.players[0].visited = [id('tomb')]; S.players[1].visited = [id('praetorium')];
  // Nicodemus needs Golgotha (2 squares from the Tomb); Simon needs Golgotha too (from the Praetorium it is far), so give him a start beside it
  S.players[1].pos = sq(570, 565);
  S = round(S, 2, [site('golgotha'), site('golgotha')]);
  assert.deepEqual(S.last.filter((e) => e.t === 'complete').map((e) => e.seat), [0, 1]);
  assert.ok(S.players.every((p) => p.offer.length === 2)); assert.equal(S.phase, 'pick');
  S = E.chooseCard(S, 0, S.players[0].offer[0]); assert.equal(S.phase, 'pick');
  S = E.chooseCard(S, 1, S.players[1].offer[0]); assert.equal(S.phase, 'roll');
});

test('the game ends the moment someone has finished an Apostle, a Friend and an Enemy; nobody draws again', () => {
  let S = game(['nicodemus', 'scribe'], [site('tomb'), sq(485, 705)]);
  S.players[0].done = ['andrew', 'caiaphas']; S.players[0].visited = [id('tomb')];
  S = round(S, 2, [site('golgotha'), null]);
  assert.equal(S.over, true); assert.equal(S.endedBy, 'categories'); assert.equal(S.phase, 'over');
  assert.deepEqual(S.winners, [0]); assert.equal(E.score(S.players[0]), 125 + 85 + 30);
  assert.ok(S.players.every((p) => p.offer.length === 0)); assert.throws(() => E.roll(S));
});
test('the game ends when someone completes a journey and the deck is empty', () => {
  let S = game(['nicodemus', 'scribe'], [site('tomb'), sq(485, 705)]);
  S.deck = []; S.players[0].visited = [id('tomb')];
  S = round(S, 2, [site('golgotha'), null]);
  assert.equal(S.endedBy, 'deck'); assert.ok(S.over);
});
test('with one card left, the player who completes must play it', () => {
  let S = game(['nicodemus', 'scribe'], [site('tomb'), sq(485, 705)]);
  S.deck = ['peter']; S.players[0].visited = [id('tomb')];
  S = round(S, 2, [site('golgotha'), null]);
  assert.equal(S.players[0].card, 'peter'); assert.equal(S.phase, 'roll'); assert.equal(S.deck.length, 0);
});

test('scoring: journeys plus 5 for each site visited on the journey under way (only sites on the card)', () => {
  assert.equal(E.score({ card: 'andrew', done: ['nicodemus'], visited: [id('bethany'), id('tomb'), id('temple')] }), 30 + 5 * 2);
  assert.equal(E.score({ card: null, done: [], visited: [] }), 0);
});
test('a tie goes to the player with the most journeys, and can still be shared', () => {
  const finish = (a, b) => { const S = game(['andrew', 'scribe'], [sq(1091, 832), sq(485, 705)]); S.rolls = E.ROLL_LIMIT - 1; S.players[0].done = a; S.players[1].done = b; return round(S, 1, [null, null]); };
  let S = finish(['nicodemus', 'simon-of-cyrene'], ['cleopas']);              // 65 against 55
  assert.equal(S.endedBy, 'limit'); assert.deepEqual(S.winners, [0]);
  S = finish(['nicodemus', 'mary-magdalene'], ['judas']);                      // 80 against 130
  assert.deepEqual(S.winners, [1]);
  S = finish(['nicodemus', 'cleopas'], ['mary-magdalene', 'simon-of-cyrene']); // 85 against 85, two each
  assert.deepEqual(S.winners, [0, 1]);
  S = finish(['mary-magdalene', 'nicodemus'], ['caiaphas']);                   // 80 against 85, but...
  assert.deepEqual(S.winners, [1]);
  S = finish(['judas', 'nicodemus'], ['peter']);                               // 160 against 170
  assert.deepEqual(S.winners, [1]);
  assert.deepEqual(E.standings(S).map((r) => r.seat), [1, 0]);
});
