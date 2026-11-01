import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from './js/engine.js';
import * as AI from './js/ai.js';

const uidOf = (name, n = 0) => E.DEFS.map((d, i) => (d.name === name ? i : -1)).filter((i) => i >= 0)[n];
const bots = (skill = 'steady') => [{ name: 'A', bot: true, skill }, { name: 'B', bot: true, skill }];
const give = (s, who, names) => {                                    // put these cards in a hand, taking them out of wherever they were
  const uids = names.map((n, i) => uidOf(n, names.slice(0, i).filter((x) => x === n).length));
  for (const p of s.players) p.hand = p.hand.filter((u) => !uids.includes(u));
  s.draw = s.draw.filter((u) => !uids.includes(u)); s.piles = s.piles.map((p) => p.filter((u) => !uids.includes(u)));
  s.piles.forEach((p, i) => { if (!p.length) p.push(s.draw.pop()); });
  s.players[who].hand = uids; s.phase = 'play';
  return uids;
};
const r = () => 0.5;

test('computer players finish whole games at every skill and never make an illegal play', () => {
  for (let g = 0; g < 24; g++) {
    const players = Array.from({ length: 2 + (g % 5) }, (_, i) => ({ name: 'B' + i, bot: true, skill: ['casual', 'steady', 'sharp'][(i + g) % 3] }));
    let s = E.newGame({ seed: 300 + g, players, first: g % players.length }), guard = 0;
    const rr = (() => { let a = g + 1; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
    while (!s.over && guard++ < 1000) s = AI.turn(s, rr);
    assert.ok(s.over, `game ${g} did not end`);
    assert.equal(s.endedBy, 'draw');
  }
});

test('a computer player adds a card to a set it already has, and starts a set with a matching pair', () => {
  let s = E.newGame({ seed: 4, players: bots() });
  const [elisha, ahab] = give(s, 0, ['Elisha', 'Ahab']);
  s.players[0].hand = [elisha, ahab]; s.players[0].sets = []; s.phase = 'play';
  let t = E.startSet(s, elisha, ahab);
  const [jehu] = give(t, 0, ['Jehu', 'Haggai', 'Amos', 'Micah', 'Zechariah']);
  t.players[0].sets = [{ head: elisha, members: [ahab] }]; t.players[0].score = 2;
  const pl = AI.choosePlay(t, 'steady', r);
  assert.deepEqual(pl.adds, [{ set: 0, uid: jehu }]);
  assert.deepEqual(pl.starts, []);
  const [elijah, amos, haggai] = give(t, 1, ['Elijah', 'Amos', 'Haggai']);
  const [joram] = [uidOf('Joram')];
  t.players[1].hand = [elijah, joram, amos]; t.players[1].sets = [];
  const pl2 = AI.choosePlay(t, 'steady', r);
  t.turn = 1; assert.equal(AI.choosePlay(t, 'steady', r).starts.length, 1);
});

test('with Elisha and two kings of his day in hand, a computer player makes one three-card set with Elisha on top', () => {
  const s = E.newGame({ seed: 5, players: bots() });
  const [elisha, jehu, ahab] = give(s, 0, ['Elisha', 'Jehu', 'Ahab']);
  const pl = AI.choosePlay(s, 'steady', r);
  assert.equal(pl.starts.length, 1);
  assert.equal(pl.starts[0].head, elisha);
  assert.deepEqual([...pl.starts[0].members].sort(), [jehu, ahab].sort());
});

test('a computer player takes the discard-pile card that grows a five-card set into a six-card set', () => {
  const s = E.newGame({ seed: 6, players: bots() });
  const set = give(s, 0, ['Elisha', 'Ahab', 'Jehu', 'Joram', 'Ahaziah']);
  s.players[0].sets = [{ head: set[0], members: set.slice(1) }];
  give(s, 0, ['Haggai', 'Amos', 'Zephaniah', 'Jonah', 'Zechariah']); s.phase = 'draw';
  const jehoash = uidOf('Jehoash'), filler = [uidOf('Jeremiah', 0), uidOf('Jeremiah', 1), uidOf('Jeremiah', 2)], all = [jehoash, ...filler];
  s.draw = s.draw.filter((u) => !all.includes(u)); s.piles = [[filler[0]], [filler[1]], [jehoash], [filler[2]]];
  const src = AI.chooseTake(s, 'steady', r);
  assert.deepEqual([src.from, src.i], ['pile', 2]);
});

test('a computer player does not discard the card an opponent is waiting for when it can discard another', () => {
  const s = E.newGame({ seed: 7, players: bots('sharp') });
  const [elisha, ahab] = give(s, 1, ['Elisha', 'Ahab']);
  s.players[1].sets = [{ head: elisha, members: [ahab] }]; s.players[1].hand = [];
  const hand = give(s, 0, ['Haggai', 'Amos', 'Micah', 'Zechariah', 'Cyrus', 'Jehu', 'Zephaniah']);
  const pl = AI.choosePlay(s, 'sharp', r);
  assert.equal(pl.discards.length, 2);
  assert.ok(!pl.discards.includes(hand[5]), 'Jehu would extend Elisha\'s set');
});
