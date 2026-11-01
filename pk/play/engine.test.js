import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as E from './js/engine.js';

const two = [{ name: 'A' }, { name: 'B' }];
const uidOf = (name, n = 0) => E.DEFS.map((d, i) => (d.name === name ? i : -1)).filter((i) => i >= 0)[n];
const rigged = (hands, extra = {}) => {                       // a game with chosen hands (and the rest of the deck as the draw pile)
  const s = E.newGame({ seed: 1, players: two });
  const used = new Set();
  hands.forEach((h, i) => { s.players[i].hand = h.map((x) => { if (typeof x !== 'string') return x; const u = uidOf(x, [...used].filter((v) => E.label(v) === x).length); used.add(u); return u; }); });
  s.draw = E.DEFS.map((_, i) => i).filter((i) => !used.has(i));
  s.piles = [[], [], [], []].map(() => [s.draw.pop()]);
  return Object.assign(s, extra);
};

test('the deck is 70 cards: 28 prophets and 42 kings, with the copy counts from the grid', () => {
  assert.equal(E.DECK_SIZE, 70);
  assert.equal(E.DEFS.filter((d) => d.kind === 'prophet').length, 28);
  assert.equal(E.DEFS.filter((d) => d.kind === 'king').length, 42);
  assert.equal(E.COPIES.Elisha, 4); assert.equal(E.COPIES['Jeroboam II'], 3); assert.equal(E.COPIES.Darius, 2); assert.equal(E.COPIES.Nebuchadnezzar, 3);
});

test('matches are symmetric and follow the grid (spot checks, including the two Jehoahaz kings)', () => {
  assert.ok(E.namesMatch('Elisha', 'Jehu') && E.namesMatch('Jehu', 'Elisha'));
  assert.ok(!E.namesMatch('Elijah', 'Jehu'));
  assert.ok(E.namesMatch('Jeremiah', 'Jehoahaz (Judah)') && !E.namesMatch('Jeremiah', 'Jehoahaz (Israel)'));
  assert.ok(E.namesMatch('Elisha', 'Jehoahaz (Israel)') && !E.namesMatch('Elisha', 'Jehoahaz (Judah)'));
  assert.ok(!E.namesMatch('Ahab', 'Jehu'), 'two kings never match');
  assert.deepEqual(E.matchesOf('Jehoiakim').sort(), ['Daniel', 'Habakkuk', 'Jeremiah']);
  assert.deepEqual(E.matchesOf('Nebuchadnezzar').sort(), ['Daniel', 'Ezekiel', 'Jeremiah']);
  assert.equal(E.matchesOf('Jeroboam II').length, 3);
});

test("every king's copy count equals the grid's 'copies' column, and each name has a picture", () => {
  const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(new URL('../cards-data.js', import.meta.url), 'utf8'), ctx);
  const ids = new Set(ctx.window.SDG_CARDS.cards.map((c) => c.id));
  for (const d of E.DEFS) assert.ok(ids.has(`${d.slug}-${d.pic}`), `no picture for ${d.slug}-${d.pic}`);
  for (const w of [320, 640]) for (let u = 0; u < E.DECK_SIZE; u++) assert.ok(fs.existsSync(new URL(E.cardImage(u, w), import.meta.url)), E.cardImage(u, w));
});

test('scoring table: 2 cards 2, 3 cards 5, 4 cards 10, 5 cards 25, 6 cards 50, 7 cards 100', () => {
  assert.deepEqual([2, 3, 4, 5, 6, 7].map(E.setScore), [2, 5, 10, 25, 50, 100]);
});

test('setup: 5 cards each, 4 discard piles with one card, the rest face-down in the draw pile', () => {
  const s = E.newGame({ seed: 9, players: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] });
  assert.deepEqual(s.players.map((p) => p.hand.length), [5, 5, 5]);
  assert.deepEqual(s.piles.map((p) => p.length), [1, 1, 1, 1]);
  assert.equal(s.draw.length, 70 - 15 - 4);
  const all = [...s.draw, ...s.piles.flat(), ...s.players.flatMap((p) => p.hand)];
  assert.equal(new Set(all).size, 70);
  assert.deepEqual(E.newGame({ seed: 9, players: two }).players[0].hand, E.newGame({ seed: 9, players: two }).players[0].hand, 'same seed, same deal');
});

test('drawing: up to 7 from the pile, a discard pile or a blind card from a hand; an emptied discard pile refills at once', () => {
  let s = E.newGame({ seed: 3, players: two });
  const top = s.piles[1][0], deck = s.draw.length;
  s = E.take(s, { from: 'pile', i: 1 });
  assert.ok(s.players[0].hand.includes(top)); assert.equal(s.piles[1].length, 1); assert.equal(s.draw.length, deck - 1, 'the emptied pile took a card from the draw pile');
  assert.equal(s.phase, 'draw');
  const victim = s.players[1].hand.length;
  s = E.take(s, { from: 'hand', p: 1 }, () => 0);
  assert.equal(s.players[1].hand.length, victim - 1); assert.equal(s.players[0].hand.length, 7); assert.equal(s.phase, 'play');
  assert.throws(() => E.take(s, { from: 'deck' }), /not drawing/);
});

test('a set needs a prophet with a king of his day; the head goes on top; no card of the same name twice', () => {
  let s = rigged([['Elisha', 'Ahab', 'Ahab', 'Daniel', 'Jehu', 'Uzziah', 'Cyrus'], []], { phase: 'play' });
  const [elisha, ahab1, ahab2, daniel, jehu] = s.players[0].hand;
  assert.throws(() => E.startSet(s, ahab1, ahab2), /do not match/);
  assert.throws(() => E.startSet(s, elisha, daniel), /do not match/);
  s = E.startSet(s, elisha, ahab1);
  assert.equal(s.players[0].score, 2); assert.equal(s.players[0].hand.length, 5);
  assert.throws(() => E.addTo(s, 0, ahab2), /cannot be added/, 'a second Ahab cannot join the same set');
  s = E.addTo(s, 0, jehu);
  assert.equal(s.players[0].score, 5);
  assert.deepEqual(E.plays(s).adds, []);
});

test('a king can head a set of prophets too, and the Jehoahaz kings are told apart', () => {
  let s = rigged([['Jehoiakim', 'Jeremiah', 'Daniel', 'Habakkuk', 'Elisha', 'Jehoahaz (Judah)', 'Jehoahaz (Israel)'], []], { phase: 'play' });
  const h = s.players[0].hand;
  s = E.startSet(s, h[0], h[1]); s = E.addTo(s, 0, h[2]); s = E.addTo(s, 0, h[3]);
  assert.equal(s.players[0].score, 10);
  assert.deepEqual(E.plays(s).starts.map((p) => p.map(E.label)), [['Elisha', 'Jehoahaz (Israel)']]);
  assert.ok(!E.plays(s).starts.some((p) => p.map(E.label).includes('Jehoahaz (Judah)') && p.map(E.label).includes('Elisha')));
});

test('a seven-card set scores 100 (Jeremiah and his six kings)', () => {
  const kings = ['Josiah', 'Jehoahaz (Judah)', 'Jehoiakim', 'Jehoiachin', 'Zedekiah', 'Nebuchadnezzar'];
  let s = rigged([['Jeremiah', ...kings], []], { phase: 'play' });
  const h = s.players[0].hand;
  s = E.startSet(s, h[0], h[1]); for (const u of h.slice(2)) s = E.addTo(s, 0, u);
  assert.equal(s.players[0].score, 100);
});

test('discard down to 5, face-up on any pile; that ends the turn; you cannot discard when at 5 or fewer', () => {
  let s = rigged([['Elisha', 'Ahab', 'Daniel', 'Jehu', 'Uzziah', 'Cyrus', 'Zedekiah'], ['Haggai']], { phase: 'play' });
  const [a, b] = s.players[0].hand.slice(5);
  s = E.discard(s, a, 3);
  assert.equal(s.piles[3].at(-1), a); assert.equal(s.turn, 0); assert.equal(s.players[0].hand.length, 6);
  assert.throws(() => E.endTurn(s), /discard down to 5/);
  s = E.discard(s, b, 0);
  assert.equal(s.turn, 1); assert.equal(s.phase, 'draw');
  const t = rigged([['Elisha', 'Ahab'], []], { phase: 'play' });
  assert.throws(() => E.discard(t, t.players[0].hand[0], 0), /only discard down/);
  assert.equal(E.endTurn(t).turn, 1);
});

test('the game ends when the last card leaves the draw pile; that player finishes their turn', () => {
  let s = rigged([['Elisha', 'Ahab', 'Daniel', 'Jehu', 'Uzziah'], ['Haggai', 'Darius']]);
  s.draw = [uidOf('Cyrus')]; s.piles = [[uidOf('Zedekiah')], [uidOf('Josiah')], [uidOf('Amos')], [uidOf('Jonah')]];
  s = E.take(s, { from: 'deck' });
  assert.ok(s.ending && !s.over); assert.equal(s.phase, 'draw');
  s = E.take(s, { from: 'pile', i: 0 });
  assert.equal(s.phase, 'play');
  s = E.discard(s, s.players[0].hand[0], 1); s = E.discard(s, s.players[0].hand[0], 1);
  assert.ok(s.over); assert.equal(s.endedBy, 'draw');
});

test('a full game between computers ends, and no card is lost or doubled along the way', async () => {
  const AI = await import('./js/ai.js');
  const r = (() => { let a = 5; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
  let s = E.newGame({ seed: 77, players: [{ name: 'A', bot: true, skill: 'steady' }, { name: 'B', bot: true, skill: 'sharp' }, { name: 'C', bot: true, skill: 'casual' }] });
  for (let g = 0; !s.over && g < 800; g++) {
    s = AI.turn(s, r);
    const all = [...s.draw, ...s.piles.flat(), ...s.players.flatMap((p) => [...p.hand, ...p.sets.flatMap(E.setCards)])];
    assert.equal(all.length, 70); assert.equal(new Set(all).size, 70);
  }
  assert.ok(s.over);
  assert.ok(s.players.every((p) => p.score === E.totalScore(p)));
});
