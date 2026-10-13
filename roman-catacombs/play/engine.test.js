import test from 'node:test';
import assert from 'node:assert/strict';
import { CATS, BOOKS, DECK, cardBook } from './js/books.js';
import {
  newState, slotOptions, legalSlotsFor, place, clearSlot, score, setClaim, setTaken, flip, placeFromTray, trayOptions,
  mustPass, shuffled, ROUNDS, MODES,
} from './js/engine.js';

const B = (name) => BOOKS.findIndex((b) => b.name === name);

test('the data: 66 books, 7 categories, 21 slots, a 90-card deck that maps to real books', () => {
  assert.equal(BOOKS.length, 66);
  assert.equal(CATS.length, 7);
  assert.equal(DECK.length, 90);
  assert.equal(new Set(DECK).size, 90);
  for (const id of DECK) assert.ok(cardBook(id) >= 0);
  assert.equal(CATS.map((c) => c.first).join(), '9,7,10,6,9,7,8');
  assert.equal(CATS.map((c) => c.second).join(), '6,5,7,4,6,5,5');
});

test('an empty scorecard scores -21', () => assert.equal(score(newState()).total, -21));

test('empty slots offer the printed ranges (slot 1 can start at the first book, slot 3 can end at the last)', () => {
  const s = newState();
  assert.deepEqual(slotOptions(s, 0).map((b) => BOOKS[b].name), ['Genesis', 'Exodus', 'Leviticus']);
  assert.deepEqual(slotOptions(s, 1).map((b) => BOOKS[b].name), ['Exodus', 'Leviticus', 'Numbers']);
  assert.deepEqual(slotOptions(s, 2).map((b) => BOOKS[b].name), ['Leviticus', 'Numbers', 'Deuteronomy']);
  assert.deepEqual(slotOptions(s, 15).map((b) => BOOKS[b].name).slice(0, 2), ['Romans', '1 Corinthians']);   // Paul slot 1
  assert.equal(BOOKS[slotOptions(s, 20).at(-1)].name, 'Revelation');
});

test('canon order is enforced around filled slots, leaving room for the empty ones', () => {
  let s = newState();
  s = place(s, 1, B('Leviticus'));                                   // middle slot = Leviticus
  assert.deepEqual(slotOptions(s, 0).map((b) => BOOKS[b].name), ['Genesis', 'Exodus']);
  assert.deepEqual(slotOptions(s, 2).map((b) => BOOKS[b].name), ['Numbers', 'Deuteronomy']);
  s = place(s, 0, B('Genesis'));
  assert.deepEqual(slotOptions(s, 2).map((b) => BOOKS[b].name), ['Numbers', 'Deuteronomy']);
  // the first slot can't take a book so late that two more can't follow it
  assert.throws(() => place(newState(), 0, B('Numbers')), /illegal/);
  assert.throws(() => place(newState(), 0, B('Deuteronomy')), /illegal/);
});

test('legalSlotsFor lists the empty slots a book can go in; a placed book has none', () => {
  let s = newState();
  assert.deepEqual(legalSlotsFor(s, B('Exodus')), [0, 1]);
  assert.deepEqual(legalSlotsFor(s, B('Genesis')), [0]);
  assert.deepEqual(legalSlotsFor(s, B('Leviticus')), [0, 1, 2]);
  s = place(s, 1, B('Exodus'));
  assert.deepEqual(legalSlotsFor(s, B('Exodus')), []);
  assert.deepEqual(legalSlotsFor(s, B('Genesis')), [0]);
  assert.deepEqual(legalSlotsFor(s, B('Numbers')), [2]);
});

test('a book can be placed only once and only into an empty slot', () => {
  let s = place(newState(), 0, B('Genesis'));
  assert.throws(() => place(s, 0, B('Exodus')), /not empty/);
  assert.throws(() => place(s, 1, B('Genesis')), /illegal/);
});

test('completing a category scores first by default, later when another player already finished it', () => {
  let s = newState();
  for (const [slot, name] of [[0, 'Genesis'], [1, 'Exodus'], [2, 'Leviticus']]) s = place(s, slot, B(name));
  assert.equal(score(s).categories[0].points, 9);
  assert.equal(score(s).total, 9 - 18);
  let t = setTaken(newState(), 'pentateuch', true);
  for (const [slot, name] of [[0, 'Genesis'], [1, 'Exodus'], [2, 'Leviticus']]) t = place(t, slot, B(name));
  assert.equal(score(t).categories[0].points, 6);
  assert.equal(score(setClaim(t, 'pentateuch', 'first')).categories[0].points, 9);   // same-turn finish counts as first
});

test('scorecard mode can take a book back out; solo mode cannot', () => {
  let s = place(newState(), 0, B('Genesis'));
  assert.equal(clearSlot(s, 0).library[0], null);
  let solo = newState({ mode: MODES.solo, seed: 7 });
  solo = flip(solo);
  assert.throws(() => clearSlot(solo, 0), /cannot be moved/);
});

test('a full scorecard with every category first scores 56 points and no penalty', () => {
  let s = newState();
  CATS.forEach((c, ci) => { for (let k = 0; k < 3; k++) s = place(s, ci * 3 + k, c.lo + k); });
  const r = score(s);
  assert.equal(r.empty, 0);
  assert.equal(r.total, CATS.reduce((a, c) => a + c.first, 0));   // 56
});

test('shuffling is seeded and keeps all 90 cards', () => {
  assert.deepEqual(shuffled(DECK, 5), shuffled(DECK, 5));
  assert.notDeepEqual(shuffled(DECK, 5), shuffled(DECK, 6));
  assert.deepEqual([...shuffled(DECK, 5)].sort(), [...DECK].sort());
});

test('solo: flip three, place at most one, 21 rounds then the game ends', () => {
  let s = newState({ mode: MODES.solo, seed: 11 });
  assert.equal(s.deck.length, 90);
  s = flip(s);
  assert.equal(s.round, 1);
  assert.equal(s.tray.length, 3);
  const i = [0, 1, 2].find((k) => trayOptions(s, k).length);
  if (i !== undefined) {
    s = placeFromTray(s, i, trayOptions(s, i)[0]);
    assert.equal(s.library.filter((b) => b !== null).length, 1);
    assert.throws(() => placeFromTray(s, i, 0), /already placed/);
  }
  for (let r = 2; r <= ROUNDS; r++) s = flip(s);
  assert.equal(s.round, ROUNDS);
  assert.equal(s.over, false);
  s = flip(s);                                                    // the 22nd flip ends the game
  assert.equal(s.over, true);
  assert.throws(() => flip(s), /game over/);
});

test('solo: the same seed deals the same flips (so several phones can play the same game)', () => {
  const a = flip(newState({ mode: MODES.solo, seed: 42 })), b = flip(newState({ mode: MODES.solo, seed: 42 }));
  assert.deepEqual(a.tray, b.tray);
});

test('solo: always completes first, and a full library ends the game at once', () => {
  let s = newState({ mode: MODES.solo, seed: 3 });
  s = flip(s);
  CATS.forEach((c, ci) => { for (let k = 0; k < 3; k++) { s.placedThisRound = null; s = place(s, ci * 3 + k, c.lo + k); } });
  assert.equal(s.over, true);
  assert.equal(score(s).total, 56);
});

test('mustPass is true when none of the three cards can go anywhere', () => {
  let s = newState({ mode: MODES.solo, seed: 1 });
  s = flip(s);
  s.tray = ['Deuteronomy1v1', 'Deuteronomy2v2', 'Deuteronomy1v1'];
  s.library[0] = B('Genesis'); s.library[1] = B('Exodus'); s.library[2] = B('Numbers');       // Pentateuch full
  assert.equal(mustPass(s), true);
});

test('a random play-through never breaks canon order or double-places a book', () => {
  for (let seed = 1; seed <= 25; seed++) {
    let s = newState({ mode: MODES.solo, seed });
    while (!s.over) {
      s = flip(s);
      if (s.over) break;
      const opts = [0, 1, 2].filter((i) => trayOptions(s, i).length);
      if (opts.length) { const i = opts[seed % opts.length]; const o = trayOptions(s, i); s = placeFromTray(s, i, o[seed % o.length]); }
    }
    CATS.forEach((c, ci) => {
      const row = [0, 1, 2].map((k) => s.library[ci * 3 + k]).filter((b) => b !== null);
      assert.deepEqual(row, [...row].sort((x, y) => x - y));
      assert.equal(new Set(row).size, row.length);
      row.forEach((b) => assert.ok(b >= c.lo && b <= c.hi));
    });
    assert.ok(score(s).total >= -21);
  }
});
