import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { PLACES, EDGES, NEIGHBORS, simplePaths, journeyPoints, REGIONS } from './js/board-data.js';
import { PLACE_CARDS, WILD_CARDS, JOURNEY_CARDS } from './js/deck-data.js';
import * as E from './js/engine.js';

// ---- the data ------------------------------------------------------------------------------------------------------
test('the board: 24 places in 6 regions, every road joins two known places, and every place is reachable', () => {
  assert.equal(Object.keys(PLACES).length, 24);
  for (const p of Object.values(PLACES)) assert.ok(REGIONS[p.region], p.name);
  for (const [a, b, how] of EDGES) { assert.ok(PLACES[a] && PLACES[b], `${a}-${b}`); assert.ok(how === 'road' || how === 'boat'); }
  assert.equal(EDGES.filter((e) => e[2] === 'boat').length, 2);
  for (const id of Object.keys(PLACES)) assert.ok(simplePaths('tyre', id).length > 0, id);
});

test('journey points are the square of the cards on the shortest route, as printed (one printed card is a known exception)', () => {
  const printed = {};
  for (const j of JOURNEY_CARDS) printed[j.id] = j.points;
  const mismatches = JOURNEY_CARDS.filter((j) => journeyPoints(j.a, j.b) !== j.points).map((j) => j.id);
  // Capernaum to Nain is printed as 25 (the 5-card route through Magdala, Cana and Nazareth), but Ptolemais and Caesarea
  // give a 4-card route along the roads, so the board allows it for the same 25 points.
  assert.deepEqual(mismatches, ['capernaum-to-nain']);
});

test('the deck is the printed deck: 59 Place Cards + 13 Journey Cards, and the expansion adds 26 + 10', () => {
  assert.equal(E.deckDefs(false).length, 59);
  assert.equal(E.deckDefs(true).length, 59 + 26);
  assert.equal(E.journeyDefs(false).length, 13);
  assert.equal(E.journeyDefs(true).length, 23);
  assert.equal(WILD_CARDS.filter((w) => !w.exp).reduce((n, w) => n + w.copies, 0), 18);
  assert.equal(PLACE_CARDS.filter((c) => !c.exp).reduce((n, c) => n + c.copies, 0), 41);
});

test('the gallery pictures exist for every card in the deck', () => {
  for (const c of [...PLACE_CARDS, ...WILD_CARDS]) assert.ok(fs.existsSync(new URL(`../../assets/jwj/cards/${c.img}-755.webp`, import.meta.url)), c.img);
});

// ---- a game ----------------------------------------------------------------------------------------------------------
const players = [{ name: 'You' }, { name: 'Bot', bot: true, skill: 'steady' }];
const new2 = (o = {}) => E.newGame({ seed: 5, players, ...o });

// Give the current player exactly these cards (by place or wild region), taken from the deck.
function give(s, ...names) {
  const defs = E.deckDefs(s.expansion), taken = new Set();
  const all = [...s.draw, ...s.up.filter((u) => u !== null), ...s.players.flatMap((p) => p.hand), ...s.discard];
  const find = (n) => {
    const i = all.find((u) => !taken.has(u) && (n.startsWith('wild:') ? (defs[u].kind === 'wild' && defs[u].region === n.slice(5)) : (defs[u].kind === 'place' && defs[u].place === n)));
    if (i === undefined) throw new Error('no card ' + n);
    taken.add(i); return i;
  };
  const uids = names.map(find);
  for (const q of s.players) q.hand = q.hand.filter((u) => !taken.has(u));
  s.draw = s.draw.filter((u) => !taken.has(u)); s.discard = s.discard.filter((u) => !taken.has(u));
  s.up = s.up.map((u) => (taken.has(u) ? null : u));
  E.me(s).hand = uids;
  for (let i = 0; i < 4; i++) if (s.up[i] === null) s.up[i] = s.draw.pop();
  return s;
}
const toPlay = (s) => { s = E.skipRecite(s); while (s.phase === 'draw') s = E.take(s, 'down'); return s; };
const inPlay = (s, ...ids) => { s.inplay = ids; s.jdeck = s.jdeck.filter((j) => !ids.includes(j)); return s; };

test('setup: 7 cards each, 4 face-up piles, 4 journeys in play, the rest face down', () => {
  const s = new2();
  assert.deepEqual(s.players.map((p) => p.hand.length), [7, 7]);
  assert.equal(s.up.length, 4);
  assert.equal(s.inplay.length, 4);
  assert.equal(s.draw.length, 59 - 14 - 4);
  assert.equal(s.jdeck.length, 13 - 4);
  assert.equal(s.phase, 'recite');
});

test('the turn goes recite, draw three, play, then draw back up to 7', () => {
  let s = new2();
  s = E.skipRecite(s);
  assert.equal(s.phase, 'draw');
  s = E.take(s, 0);
  assert.notEqual(s.up[0], null, 'the face-up pile is refilled between draws');
  s = E.take(s, 'down'); s = E.take(s, 3);
  assert.equal(s.phase, 'play');
  assert.equal(E.me(s).hand.length, 10);
  assert.ok(s.up.every((u) => u !== null), 'the face-up piles are refilled');
});

test('after laying cards down you draw back up to 7 from any piles, then the next player starts', () => {
  let s = toPlay(new2());
  s = give(inPlay(s, 'capernaum-to-nazareth'), 'capernaum', 'magdala', 'cana', 'nazareth', 'tyre', 'nain');   // 6 cards
  s = E.play(s, E.plays(s)[0]);
  assert.equal(E.me(s).hand.length, 2);
  s = E.endPlay(s);
  assert.equal(s.phase, 'topup');
  assert.equal(s.topup, 5);
  for (let i = 0; i < 4; i++) s = E.take(s, i);
  assert.equal(s.phase, 'topup');
  s = E.take(s, 'down');
  assert.equal(s.players[0].hand.length, 7);
  assert.equal(s.turn, 1);
  assert.equal(s.phase, 'recite');
  assert.ok(s.up.every((u) => u !== null));
});

test('with 7 or more cards in hand there is no top-up: the next player starts at once', () => {
  let s = toPlay(new2());
  assert.equal(E.me(s).hand.length, 10);
  s = E.endPlay(s);
  assert.equal(s.turn, 1);
  assert.equal(s.phase, 'recite');
});

test('reciting earns a Scripture Memory Token; missing it does not', () => {
  assert.equal(E.me(E.recite(new2(), true, 3)).tokens, 1);
  assert.equal(E.me(E.recite(new2(), false, 3)).tokens, 0);
  assert.equal(E.me(E.skipRecite(new2())).tokens, 0);
});

test('a journey between neighbours needs just those two cards, and scores its points', () => {
  let s = toPlay(new2());
  s = give(inPlay(s, 'capernaum-to-bethsaida', 'jerusalem-to-bethany'), 'capernaum', 'bethsaida', 'tyre');
  const opts = E.plays(s);
  assert.deepEqual(opts.map((o) => o.journey), ['capernaum-to-bethsaida']);
  s = E.play(s, opts[0]);
  assert.equal(E.score(E.me(s)).total, 4);
  assert.deepEqual(E.me(s).hand.length, 1);
  assert.ok(!s.inplay.includes('capernaum-to-bethsaida'));
  assert.equal(s.inplay.length, 2);
});

test('a longer journey needs a card for every place on the road: Capernaum to Nazareth takes four', () => {
  let s = toPlay(new2());
  s = give(inPlay(s, 'capernaum-to-nazareth'), 'capernaum', 'magdala', 'cana');
  assert.equal(E.plays(s).length, 0);
  s = give(s, 'capernaum', 'magdala', 'cana', 'nazareth');
  const o = E.plays(s)[0];
  assert.deepEqual(o.path, ['capernaum', 'magdala', 'cana', 'nazareth']);
  assert.equal(o.points, 16);
});

test('a Region Wild Card stands in for any place in its region; the Israel card for any place; a token too', () => {
  let s = toPlay(new2());
  s = give(inPlay(s, 'capernaum-to-nazareth'), 'capernaum', 'wild:galilee', 'cana', 'nazareth');
  assert.equal(E.plays(s)[0].wildsUsed, 1);
  s = give(s, 'capernaum', 'wild:judea', 'cana', 'nazareth');
  assert.equal(E.plays(s).length, 0, 'a Judea wild cannot replace a Galilee place');
  s = give(s, 'capernaum', 'wild:israel', 'cana', 'nazareth');
  assert.equal(E.plays(s)[0].wildsUsed, 1);
  s = give(s, 'capernaum', 'cana', 'nazareth');
  E.me(s).tokens = 1;
  const t = E.plays(s)[0];
  assert.equal(t.tokensUsed, 1);
  const after = E.play(s, t);
  assert.equal(E.me(after).tokens, 0, 'a token used as a wild is forfeited');
});

test('exact cards are used before wilds and tokens', () => {
  let s = toPlay(new2());
  s = give(inPlay(s, 'capernaum-to-nazareth'), 'capernaum', 'magdala', 'wild:galilee', 'cana', 'nazareth');
  E.me(s).tokens = 2;
  const o = E.plays(s)[0];
  assert.equal(o.wildsUsed, 0);
  assert.equal(o.tokensUsed, 0);
});

test('extending: cards on top of the end of a laid journey complete another, reusing the cards already laid', () => {
  let s = toPlay(new2());
  // lay Capernaum-Magdala-Cana-Nazareth, then Nain on top completes Capernaum to Nain
  s = give(inPlay(s, 'capernaum-to-nazareth', 'nazareth-to-jerusalem', 'capernaum-to-nain'), 'capernaum', 'magdala', 'cana', 'nazareth', 'nain');
  s = E.play(s, E.plays(s).find((o) => o.journey === 'capernaum-to-nazareth'));
  assert.deepEqual(s.chains, [['capernaum', 'magdala', 'cana', 'nazareth']]);
  const ext = E.plays(s).filter((o) => o.extends);
  assert.ok(ext.some((o) => o.journey === 'capernaum-to-nain'));
  const o = ext.find((x) => x.journey === 'capernaum-to-nain');
  assert.equal(o.assign.length, 1, 'only the new card is needed');
  s = E.play(s, o);
  assert.equal(E.score(E.me(s)).total, 16 + 25);
  assert.deepEqual(s.chains, [['capernaum', 'magdala', 'cana', 'nazareth', 'nain']]);
});

test('an extension can start in the middle of what was laid, in the same order', () => {
  let s = toPlay(new2());
  s = give(inPlay(s, 'capernaum-to-nazareth', 'cana-to-sychar'), 'capernaum', 'magdala', 'cana', 'nazareth', 'nain', 'sychar');
  s = E.play(s, E.plays(s).find((o) => o.journey === 'capernaum-to-nazareth'));
  const o = E.plays(s).find((x) => x.extends && x.journey === 'cana-to-sychar');
  assert.ok(o, 'Cana to Sychar starts at Cana, reusing Cana-Nazareth');
  assert.deepEqual(o.path, ['cana', 'nazareth', 'nain', 'sychar']);
  assert.equal(o.assign.length, 2);
});

test('a journey wholly inside what you laid scores too, with no more cards (a run of it, in either direction)', () => {
  let s = toPlay(new2());
  s = give(inPlay(s, 'capernaum-to-nazareth', 'capernaum-to-cana', 'tyre-to-gadara'), 'capernaum', 'magdala', 'cana', 'nazareth');
  s = E.play(s, E.plays(s).find((o) => o.journey === 'capernaum-to-nazareth'));
  const inside = E.plays(s).filter((o) => o.extends && o.assign.length === 0);
  assert.deepEqual(inside.map((o) => o.journey), ['capernaum-to-cana'], 'Capernaum, Magdala, Cana is a run of what was laid');
  const after = E.play(s, inside[0]);
  assert.equal(E.score(E.me(after)).total, 16 + 9);
  assert.equal(E.me(after).hand.length, 0, 'no card is used or lost');
  assert.deepEqual(after.chains, [['capernaum', 'magdala', 'cana', 'nazareth']]);
});

test('a journey laid in the other direction also counts as inside what you laid', () => {
  let s = toPlay(new2());
  s = give(inPlay(s, 'nazareth-to-jerusalem', 'capernaum-to-nazareth', 'jerusalem-to-bethany'), 'nazareth', 'nain', 'sychar', 'ephraim', 'jerusalem', 'bethany');
  s = E.play(s, E.plays(s).find((o) => o.journey === 'nazareth-to-jerusalem'));
  const ext = E.plays(s).filter((o) => o.extends);
  assert.ok(ext.some((o) => o.journey === 'jerusalem-to-bethany' && o.assign.length === 1), 'Bethany on top of Jerusalem');
  const sub = E.plays(s).filter((o) => o.extends && o.assign.length === 0);
  assert.equal(sub.length, 0, 'nothing else is wholly inside yet');
});

test('a completed journey is replaced only when the turn is over', () => {
  let s = toPlay(new2());
  s = give(inPlay(s, 'capernaum-to-bethsaida'), 'capernaum', 'bethsaida', 'jerusalem', 'bethlehem');
  s.jdeck = s.jdeck.filter((j) => j !== 'jerusalem-to-bethlehem'); s.jdeck.push('jerusalem-to-bethlehem');   // on top
  s = E.play(s, E.plays(s)[0]);
  assert.deepEqual(s.inplay, [null], 'the place stays empty for the rest of the turn');
  assert.equal(E.plays(s).length, 0, 'so the new journey cannot be completed this turn');
  s = E.endPlay(s);
  assert.equal(s.phase, 'topup');
  assert.deepEqual(s.inplay, [null], 'still empty while you draw back up');
  while (s.phase === 'topup') s = E.take(s, 'down');
  assert.deepEqual(s.inplay, ['jerusalem-to-bethlehem']);
  assert.deepEqual(s.recent.map((r) => r.journey), ['capernaum-to-bethsaida'], 'the next player can see what was just completed');
  assert.deepEqual(s.turnRoutes, []);
});

test('the game ends when the last journey is completed; points are journeys plus 5 per unplayed token', () => {
  let s = toPlay(new2());
  s = give(inPlay(s, 'capernaum-to-bethsaida'), 'capernaum', 'bethsaida');
  s.jdeck = [];
  E.me(s).tokens = 2;
  s.players[1].journeys = ['capernaum-to-nazareth'];
  s = E.play(s, E.plays(s)[0]);
  assert.equal(s.over, true);
  assert.equal(s.endedBy, 'journeys');
  assert.deepEqual(E.score(s.players[0]), { journeys: 4, tokens: 10, total: 14 });
  assert.deepEqual(E.winners(s), [1]);
});

test('illegal moves are refused', () => {
  const s = new2();
  assert.throws(() => E.take(s, 0), /illegal/);
  assert.throws(() => E.play(s, { journey: 'x', path: [], assign: [] }), /illegal/);
  const d = E.skipRecite(s);
  assert.throws(() => E.endPlay(d), /illegal/);
  let p = toPlay(new2());
  assert.throws(() => E.play(p, { journey: p.inplay[0], path: ['tyre'], assign: [] }), /illegal/);
});

test('when the face-down pile runs out, the played cards are shuffled into a new one', () => {
  let s = new2();
  s.discard = s.draw.splice(0); // everything face down is now "played"
  s = E.skipRecite(s);
  s = E.take(s, 'down');
  assert.equal(s.reshuffles, 1);
  assert.ok(s.draw.length > 0);
});

test('a game where nobody can do anything ends instead of hanging', () => {
  let s = new2();
  s.draw = []; s.discard = []; s.up = [null, null, null, null];
  for (let i = 0; i < 6 && !s.over; i++) { s = E.skipRecite(s); if (s.phase === 'play') s = E.endPlay(s); }
  assert.equal(s.over, true);
  assert.equal(s.endedBy, 'stalled');
});

test('the expansion adds its cards and journeys to the game', () => {
  const s = new2({ expansion: true });
  assert.equal(s.draw.length + s.up.length + 14, 85);
  assert.equal(s.jdeck.length + s.inplay.length, 23);
});

test('a saved game resumes exactly: the state is plain JSON', () => {
  let s = toPlay(new2());
  const back = JSON.parse(JSON.stringify(s));
  assert.deepEqual(back, s);
  assert.deepEqual(E.plays(back), E.plays(s));
});

test('the cards you took this turn are remembered until the turn ends, and the log names the face-up ones', () => {
  let s = E.skipRecite(new2());
  const up0 = s.up[0], name = E.cardLabel(E.deckDefs(false)[up0]);
  s = E.take(s, 0);
  assert.deepEqual(s.picks.map((p) => p.from), ['up']);
  s = E.take(s, 'down'); s = E.take(s, 2);
  assert.equal(s.picks.length, 3);
  assert.deepEqual(s.picks.map((p) => p.from), ['up', 'down', 'up']);
  assert.ok(s.picks.every((p) => E.me(s).hand.includes(p.uid)));
  assert.ok(s.log.at(-1).text.includes(name) && s.log.at(-1).text.includes('1 face-down card'));
  s = E.endPlay(s);
  assert.deepEqual(s.picks, [], 'cleared when the next turn begins');
});

test('each journey you lay is remembered with its route, for the results picture', () => {
  let s = toPlay(new2());
  s = give(inPlay(s, 'capernaum-to-nazareth'), 'capernaum', 'magdala', 'cana', 'nazareth');
  s = E.play(s, E.plays(s)[0]);
  assert.deepEqual(E.me(s).routes, [{ journey: 'capernaum-to-nazareth', path: ['capernaum', 'magdala', 'cana', 'nazareth'] }]);
});
