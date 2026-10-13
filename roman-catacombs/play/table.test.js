import test from 'node:test';
import assert from 'node:assert/strict';
import { CATS, BOOKS, DECK, cardBook } from './js/books.js';
import * as E from './js/engine.js';
import * as T from './js/table.js';
import { chooseMove, candidates, SKILLS } from './js/bot.js';

const B = (name) => BOOKS.findIndex((b) => b.name === name);

test('a table has the human plus 1-5 named computer librarians, each with an empty library', () => {
  const s = T.newTable({ bots: 3, skill: 'sharp', seed: 5 });
  assert.equal(s.mode, 'bots');
  assert.equal(s.rivals.length, 3);
  assert.deepEqual(s.rivals.map((r) => r.name), ['Ruth', 'Timothy', 'Lydia']);
  assert.ok(s.rivals.every((r) => r.skill === 'sharp' && r.library.every((b) => b === null)));
  assert.equal(T.newTable({ bots: 99 }).rivals.length, 5);
  assert.equal(T.newTable({ bots: 0 }).rivals.length, 1);
  assert.equal(E.score(s).total, -21);
});

test('every round deals three cards: the first 30 rounds deal the whole deck once, then it is reshuffled', () => {
  const first = Array.from({ length: 30 }, (_, i) => T.trayAt(7, i + 1)).flat();
  assert.deepEqual([...first].sort(), [...DECK].sort());
  assert.deepEqual(T.trayAt(7, 3), T.trayAt(7, 3));                     // the same seed deals the same cards
  const second = Array.from({ length: 30 }, (_, i) => T.trayAt(7, i + 31)).flat();
  assert.deepEqual([...second].sort(), [...DECK].sort());
  assert.notDeepEqual(first, second);
});

test('flipRound: the first flip deals; later flips let each computer place at most one book', () => {
  let s = T.newTable({ bots: 2, seed: 11 });
  s = T.flipRound(s);
  assert.equal(s.round, 1);
  assert.equal(s.tray.length, 3);
  assert.ok(s.rivals.every((r) => r.library.every((b) => b === null)));
  s = T.flipRound(s);
  assert.equal(s.round, 2);
  for (const r of s.rivals) assert.ok(r.library.filter((b) => b !== null).length <= 1);
  assert.ok(s.log.length >= 2);
});

test('a full game against computers always ends, legally, with every library in canon order', () => {
  for (let seed = 1; seed <= 20; seed++) {
    let s = T.newTable({ bots: 1 + (seed % 5), skill: ['casual', 'steady', 'sharp'][seed % 3], seed });
    s = T.flipRound(s);
    while (!s.over) {
      const opts = [0, 1, 2].filter((i) => E.trayOptions(s, i).length);
      if (opts.length) { const i = opts[seed % opts.length]; const o = E.trayOptions(s, i); s = E.placeFromTray(s, i, o[seed % o.length]); }
      s = T.flipRound(s);
    }
    assert.ok(s.endReason);
    for (const p of [s, ...s.rivals]) {
      CATS.forEach((c, ci) => {
        const row = [0, 1, 2].map((k) => p.library[ci * 3 + k]).filter((b) => b !== null);
        assert.deepEqual(row, [...row].sort((x, y) => x - y));
        row.forEach((b) => assert.ok(b >= c.lo && b <= c.hi));
      });
    }
    assert.equal(T.standings(s).length, s.rivals.length + 1);
    assert.throws(() => T.flipRound(s), /game over/);
  }
});

test('the game ends as soon as someone has filled all 21 slots', () => {
  let s = T.newTable({ bots: 1, seed: 3 });
  s = T.flipRound(s);
  CATS.forEach((c, ci) => { for (let k = 0; k < 3; k++) s.library[ci * 3 + k] = c.lo + k; });
  s = T.flipRound(s);
  assert.equal(s.over, true);
  assert.equal(s.endReason, 'complete');
});

test('finishing a category in an earlier round makes yours count as "after"; finishing on the same round is "first" for both', () => {
  // you complete Pentateuch after a computer already did
  let s = T.newTable({ bots: 1, seed: 21 });
  s = T.flipRound(s);
  s.completed.pentateuch = true; s.taken.pentateuch = true; s.rivals[0].taken.pentateuch = true;
  s.library[0] = B('Genesis'); s.library[1] = B('Exodus');
  s.tray = ['Leviticus1v1', 'Joshua1v1', 'Ruth1v1'];
  s = E.placeFromTray(s, 0, 2);
  assert.equal(s.claims.pentateuch, 'later');
  assert.equal(E.score(s).categories[0].points, 6);

  // you and a computer complete Pentateuch in the same round: both first
  let t = T.newTable({ bots: 1, seed: 21 });
  t.rivals[0].skill = 'sharp';
  t = T.flipRound(t);
  t.library[0] = B('Genesis'); t.library[1] = B('Exodus');
  t.rivals[0].library[0] = B('Genesis'); t.rivals[0].library[1] = B('Exodus');
  t.tray = ['Leviticus1v1', 'Leviticus2v1', 'Leviticus3v1'];
  t = E.placeFromTray(t, 0, 2);
  t = T.flipRound(t);
  assert.equal(t.claims.pentateuch, 'first');
  assert.equal(t.rivals[0].claims.pentateuch, 'first');
  assert.equal(t.completed.pentateuch, true);
  assert.ok(t.log.some((l) => /You and Ruth complete Pentateuch first/.test(l.text)));
});

test('the game ends when nobody can place any more books', () => {
  const setUp = (lib) => {
    CATS.forEach((c, ci) => { for (let k = 0; k < 3; k++) lib[ci * 3 + k] = c.lo + k; });
    lib[0] = B('Leviticus'); lib[1] = null; lib[2] = B('Numbers');       // no book fits between Leviticus and Numbers
  };
  const s = T.newTable({ bots: 1, seed: 1 });
  setUp(s.library); setUp(s.rivals[0].library);
  assert.equal(E.slotOptions(s, 1).length, 0);
  assert.equal(T.endReason(s), 'stuck');
});

test('computer players only make legal moves and pass when nothing fits', () => {
  const p = { mode: 'bots', library: Array(21).fill(null), claims: {}, taken: {} };
  const rand = E.rng(1);
  for (const k of Object.keys(SKILLS)) {
    const mv = chooseMove(p, [B('Genesis'), B('Matthew'), B('Revelation')], k, rand);
    if (mv) assert.ok(E.legalSlotsFor(p, mv.book).includes(mv.slot));
  }
  const full = { ...p, library: p.library.map((_, i) => (i < 3 ? B('Genesis') + i : null)) };   // Pentateuch full: Genesis cannot go anywhere
  assert.equal(candidates(full, [B('Genesis')]).length, 0);
  assert.equal(chooseMove(full, [B('Genesis')], 'sharp', rand), null);
});

test('in a race, stronger computers score higher on average (sharp > steady > casual)', () => {
  const total = { casual: 0, steady: 0, sharp: 0 };
  const N = 60;
  for (let seed = 1; seed <= N; seed++) {
    let s = T.newTable({ bots: 3, seed });
    ['casual', 'steady', 'sharp'].forEach((k, i) => { s.rivals[i].skill = k; });
    s = T.flipRound(s);
    const rand = E.rng(seed + 99);
    while (!s.over) {                                                        // a steady computer plays the "human" seat
      const mv = chooseMove({ mode: 'bots', library: s.library, claims: s.claims, taken: s.taken }, s.tray.map(E.trayBook), 'steady', rand);
      if (mv) s = E.placeFromTray(s, s.tray.findIndex((id) => E.trayBook(id) === mv.book), mv.slot);
      s = T.flipRound(s);
    }
    T.standings(s).filter((r) => !r.you).forEach((r) => { total[r.skill] += r.total / N; });
  }
  assert.ok(total.steady > total.casual + 5, `steady ${total.steady} should clearly beat casual ${total.casual}`);
  assert.ok(total.sharp > total.steady + 2, `sharp ${total.sharp} should beat steady ${total.steady}`);
});
