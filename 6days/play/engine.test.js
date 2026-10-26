import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from './js/engine.js';

const players = (n = 3) => Array.from({ length: n }, (_, i) => ({ name: 'P' + i, bot: i > 0 }));
const uidOf = (day, name, nth = 0) => E.DEFS.map((d, i) => (d.kind === 'day' && d.day === day && (!name || d.name === name) ? i : -1)).filter((i) => i >= 0)[nth];
// a game with chosen hands and an empty-ish pile set, so a rule can be tried exactly
function rigged(hand, extra = (s) => s) {
  let s = E.newGame({ seed: 5, players: players(3) });
  const p = s.players[0];
  s.draw = s.draw.filter((u) => !hand.includes(u)); s.players.forEach((q) => { q.hand = q.hand.filter((u) => !hand.includes(u)); });
  for (const pile of s.piles) for (let i = pile.length - 1; i >= 0; i--) if (hand.includes(pile[i])) pile.splice(i, 1);
  p.hand = [...hand]; s.phase = 'play';
  return extra(s);
}

test('the deck is the box: 40 day cards in the stated numbers, 6 Evening & Morning', () => {
  const count = (day) => E.DEFS.filter((d) => d.kind === 'day' && d.day === day).length;
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(count), [1, 7, 7, 8, 8, 9]);
  assert.equal(E.DEFS.filter((d) => d.kind === 'em').length, 6);
  const names = (day) => E.DEFS.filter((d) => d.day === day).map((d) => d.name);
  const n = (day, name) => names(day).filter((x) => x === name).length;
  assert.equal(n(3, 'Seas'), 2);
  for (const k of ['Sun', 'Moon', 'Stars']) assert.equal(n(4, k), 2, k);
  assert.equal(n(5, 'Fish'), 2); assert.equal(n(5, 'Birds'), 2); assert.equal(n(5, 'Approval'), 3);
  assert.equal(n(6, 'Mankind'), 2); assert.equal(n(6, 'Approval'), 3);
});

test('setup: Day 1 is in the middle, 2 cards each, 3 discard piles of one card, nothing lost', () => {
  const s = E.newGame({ seed: 9, players: players(4) });
  assert.deepEqual(s.stacks[0].cards, [0]);
  assert.ok(s.players.every((p) => p.hand.length === 2));
  assert.deepEqual(s.piles.map((p) => p.length), [1, 1, 1]);
  const all = [...s.draw, ...s.piles.flat(), ...s.players.flatMap((p) => p.hand), ...s.stacks.flatMap((k) => k.cards)];
  assert.equal(all.length, 46); assert.equal(new Set(all).size, 46);
  assert.throws(() => E.newGame({ players: players(1) }));
  assert.deepEqual(E.newGame({ seed: 9, players: players(4) }), s);
});

test('starting the next day scores 2; only the next day may be started', () => {
  const sky = uidOf(2, 'Sky'), earth = uidOf(3, 'Earth');
  const s = rigged([sky, earth]);
  assert.deepEqual(E.moves(s, sky).filter((m) => m.type !== 'discard'), [{ type: 'start', stack: 1, pts: 2 }]);
  assert.deepEqual(E.moves(s, earth).filter((m) => m.type !== 'discard'), []);
  const t = E.play(s, sky, { type: 'start', stack: 1 });
  assert.equal(t.players[0].score, 2); assert.equal(t.started, 2); assert.equal(t.turn, 1);
});

test('adding scores 1 for a kind already on the stack and 2 for a new kind; full and closed stacks take nothing', () => {
  const [a, b] = [uidOf(2, 'Sky', 0), uidOf(2, 'Sky', 1)], [e1, e2] = [uidOf(3, 'Earth'), uidOf(3, 'Grass')];
  let s = rigged([a, b], (x) => { x.started = 2; x.stacks[1].cards.push(uidOf(2, 'Sky', 2), uidOf(2, 'Sky', 3)); return x; });
  assert.equal(E.moves(s, a).filter((m) => m.type === 'add').length, 0);       // Day 2 already holds its 2 cards: full
  s = rigged([e1, e2], (x) => { x.started = 3; x.stacks[1].cards.push(uidOf(2, 'Sky', 2), uidOf(2, 'Sky', 3)); x.stacks[2].cards.push(uidOf(3, 'Seas', 0)); return x; });
  assert.deepEqual(E.moves(s, e1).filter((m) => m.type === 'add'), [{ type: 'add', stack: 2, pts: 2 }]);
  s.stacks[2].cards.push(e2, uidOf(3, 'Plants'));
  s.players[0].hand = [uidOf(3, 'Seas', 1)];
  assert.deepEqual(E.moves(s, uidOf(3, 'Seas', 1)).filter((m) => m.type === 'add'), []);   // Day 3 is full now
});

test('a card may go on its own or a later started stack, never an earlier one', () => {
  const sky = uidOf(2, 'Sky', 0);
  const s = rigged([sky], (x) => { x.started = 4; x.stacks[1].cards.push(uidOf(2, 'Sky', 1), uidOf(2, 'Sky', 2)); x.stacks[2].cards.push(uidOf(3, 'Earth')); return x; });
  assert.deepEqual(E.moves(s, sky).filter((m) => m.type === 'add').map((m) => m.stack), [2, 3]);   // Day 2 is full; Day 3 and Day 4 are open
  const day4 = uidOf(4, 'Sun', 0);
  assert.deepEqual(E.moves(s, day4).filter((m) => m.type === 'add').map((m) => m.stack), [3]);
});

test('Evening & Morning closes a full stack once, for the day number; day cards then stop going on it', () => {
  const em = E.DEFS.findIndex((d) => d.kind === 'em');
  const s = rigged([em, em + 1], (x) => { x.started = 2; x.stacks[1].cards.push(uidOf(2, 'Sky', 0), uidOf(2, 'Sky', 1)); return x; });
  assert.deepEqual(E.moves(s, em).filter((m) => m.type === 'close').map((m) => [m.stack, m.pts]), [[0, 1], [1, 2]]);
  let t = E.play(s, em, { type: 'close', stack: 1 });
  assert.equal(t.players[0].score, 2);
  t = structuredClone(t); t.turn = 0; t.phase = 'play';
  assert.deepEqual(E.moves(t, em + 1).filter((m) => m.type === 'close').map((m) => m.stack), [0]);
});

test('discarding scores nothing and goes on the pile you pick; empty piles are refilled from the draw pile', () => {
  const sky = uidOf(2, 'Sky');
  let s = rigged([sky]);
  s.piles[1] = [];
  const top = s.draw[s.draw.length - 1];
  const t = E.play(s, sky, { type: 'discard', pile: 2 });
  assert.equal(t.players[0].score, 0);
  assert.equal(t.piles[2].at(-1), sky);
  assert.deepEqual(t.piles[1], [top]);
});

test('drawing takes the draw pile or a pile top; you must draw before you play', () => {
  const s = E.newGame({ seed: 3, players: players(2) });
  assert.throws(() => E.play(s, s.players[0].hand[0], { type: 'discard', pile: 0 }));
  const top = s.piles[1][0], t = E.draw(s, 1);
  assert.equal(t.players[0].hand.length, 3); assert.ok(t.players[0].hand.includes(top)); assert.deepEqual(t.piles[1], []); assert.equal(t.phase, 'play');
  assert.throws(() => E.draw(t, 'deck'));
  const u = E.draw(s, 'deck'); assert.equal(u.draw.length, s.draw.length - 1);
});

test('the game ends the moment every stack is full, and the top score wins', () => {
  const last = uidOf(6, 'Mankind', 1);
  const s = rigged([last], (x) => {
    x.started = 6;
    for (let i = 1; i < 6; i++) for (let k = 0, put = 0; put < (i < 5 ? i + 1 : i); k++) { const u = uidOf(i + 1, undefined, k); if (u !== last) { x.stacks[i].cards.push(u); put++; } }   // Day 6 is one short
    x.players[1].score = 0;
    return x;
  });
  assert.ok(!s.stacks[5].cards.includes(last));
  const t = E.play(s, last, { type: 'add', stack: 5 });
  assert.ok(t.over && t.endedBy === 'complete');
  assert.deepEqual(E.winners(t), [0]);
});

test('computer-free self-play always finishes in a legal way (random legal moves)', () => {
  for (let g = 0; g < 40; g++) {
    let s = E.newGame({ seed: 100 + g, players: players(2 + (g % 5)) });
    const r = E.rng(g + 1);
    let guard = 0;
    while (!s.over && guard++ < 5000) {
      const p = E.me(s);
      const src = ['deck', 0, 1, 2].filter((x) => (x === 'deck' ? s.draw.length : s.piles[x].length));
      s = E.draw(s, src[Math.floor(r() * src.length)]);
      const cand = []; for (const u of E.me(s).hand) for (const m of E.moves(s, u)) cand.push([u, m]);
      const good = cand.filter(([, m]) => m.type !== 'discard'), pool = good.length && r() < 0.8 ? good : cand;
      const [u, m] = pool[Math.floor(r() * pool.length)];
      s = E.play(s, u, m);
      const all = [...s.draw, ...s.piles.flat(), ...s.players.flatMap((q) => q.hand), ...s.stacks.flatMap((k) => k.cards), ...s.stacks.map((k) => k.em).filter((x) => x !== null)];
      assert.equal(new Set(all).size, all.length);
    }
    assert.ok(s.over, `game ${g} did not finish`);
  }
});
