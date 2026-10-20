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
  assert.deepEqual(E.takenBy(t, 'pentateuch'), ['You', 'Ruth'], 'the shelf can say who took it');
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

test('table codes round-trip the seed and reject junk', () => {
  for (const seed of [0, 1, 35, 123456789, 4294967295]) assert.equal(T.parseCode(T.tableCode(seed)), seed);
  assert.equal(T.tableCode(4294967295).length <= 7, true);
  assert.equal(T.parseCode('  ab-12 '), parseInt('AB12', 36));
  assert.equal(T.parseCode(''), null);
  assert.equal(T.parseCode('ZZZZZZZZ'), null);
});

test('two phones with the same code deal identical cards every round, including after the deck is reshuffled', () => {
  const code = T.tableCode(987654321);
  let a = T.newTableGame({ seed: T.parseCode(code) }), b = T.newTableGame({ seed: T.parseCode(code) });
  for (let r = 1; r <= 70; r++) { a = T.nextRound(a); b = T.nextRound(b); assert.deepEqual(a.tray, b.tray); assert.equal(a.round, r); }
  assert.notDeepEqual(T.newTableGame({ seed: 1 }) && T.trayAt(1, 1), T.trayAt(2, 1));
});

test('a phone that is out of step can jump to the right round, but not after placing a book', () => {
  let s = T.nextRound(T.newTableGame({ seed: 5 }));
  s = T.nextRound(s);
  const at5 = T.goToRound(s, 5);
  assert.equal(at5.round, 5);
  assert.deepEqual(at5.tray, T.trayAt(5, 5));
  assert.deepEqual(T.goToRound(at5, 2).tray, T.trayAt(5, 2));
  const opts = [0, 1, 2].filter((i) => E.trayOptions(s, i).length);
  const placed = E.placeFromTray(s, opts[0], E.trayOptions(s, opts[0])[0]);
  assert.throws(() => T.goToRound(placed, 4), /undo/);
  assert.throws(() => T.goToRound(s, 0), /bad round/);
});

test('table play: you say whether you were first; books cannot be taken back out; a full library ends your game', () => {
  let s = T.newTableGame({ seed: 9 });
  s = T.nextRound(s);
  assert.throws(() => E.clearSlot(s, 0), /cannot be moved/);
  // another player already finished Pentateuch
  const t = E.setTaken(s, 'pentateuch', true);
  let u = structuredClone(t); u.library[0] = B('Genesis'); u.library[1] = B('Exodus'); u.tray = ['Leviticus1v1', 'Joshua1v1', 'Ruth1v1'];
  u = E.placeFromTray(u, 0, 2);
  assert.equal(u.claims.pentateuch, 'later');
  assert.equal(E.score(E.setClaim(u, 'pentateuch', 'first')).categories[0].points, 9);
  let f = T.nextRound(T.newTableGame({ seed: 9 }));
  CATS.forEach((c, ci) => { for (let k = 0; k < 3; k++) f.library[ci * 3 + k] = c.lo + k; });
  f.library[20] = null; f.tray = ['Revelation1v1', 'Jude1v1', 'Matthew1v1']; f.placedThisRound = null;
  f = E.placeFromTray(f, 0, 20);
  assert.equal(f.over, true);
  assert.equal(E.score(f).total, 56);
  assert.throws(() => T.nextRound(f), /game over/);
});

test('finishTable ends the game when someone else announced a full library', () => {
  let s = T.nextRound(T.newTableGame({ seed: 4 }));
  s = T.finishTable(s);
  assert.equal(s.over, true);
  assert.throws(() => T.finishTable(s), /game over/);
});

test('bots mode still behaves (the table changes did not break it)', () => {
  assert.equal(E.isRound(T.newTable({ bots: 1 })), true);
  assert.equal(E.isManual(T.newTable({ bots: 1 })), false);
  assert.equal(E.isManual(E.newState()), true);
  assert.equal(E.isManual(T.newTableGame({ seed: 1 })), true);
  assert.equal(E.isRound(E.newState()), false);
});

test('a category a computer completes alone is recorded as taken by it, and not by anyone else', () => {
  let s = T.newTable({ bots: 1, seed: 21 });
  s = T.flipRound(s);
  s.rivals[0].library[0] = B('Genesis'); s.rivals[0].library[1] = B('Exodus'); s.rivals[0].library[2] = B('Leviticus');
  assert.deepEqual(E.takenBy(s, 'pentateuch'), [], 'nobody has taken it yet');
  s = T.flipRound(s);
  assert.ok(s.taken.pentateuch);
  assert.deepEqual(E.takenBy(s, 'pentateuch'), ['Ruth']);
  assert.deepEqual(E.takenBy(s, 'wisdom'), []);
  assert.deepEqual(E.takenBy({}, 'wisdom'), [], 'older saved games have no record of who');
});
