// Roman Catacombs: rules engine (pure functions on plain state; no DOM). Used by the scorecard and, later, the game modes.
//
// A player's library is 21 slots, three per category. Within a category the three books must be in canon order
// (strictly increasing). A category scores `first` points if you complete it first, `second` after that;
// every empty slot is -1 at the end.
import { CATS, BOOKS, SLOTS, DECK, cardBook } from './books.js';

export const ROUNDS = 21;                       // solo game length
export const MODES = { scorecard: 'scorecard', solo: 'solo' };

const clone = (s) => structuredClone(s);
export const catOf = (slot) => Math.floor(slot / 3);

// ---- seeded shuffling ------------------------------------------------------------------------------------------
export function rng(seed) {                     // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffled(list, seed) {
  const r = rng(seed), a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- state -------------------------------------------------------------------------------------------------------
export function newState({ mode = MODES.scorecard, seed = 1 } = {}) {
  return {
    mode,
    library: Array(SLOTS).fill(null),            // book index in each slot, or null
    claims: {},                                   // category id -> 'first' | 'later' (how you completed it)
    taken: {},                                    // category id -> true when another player already completed it
    seed,
    deck: mode === MODES.solo ? shuffled(DECK, seed) : [],
    round: 0,                                     // solo: how many sets of three have been flipped
    tray: [],                                     // solo: the three cards face up this round
    placedThisRound: null,                        // solo: tray index of the card placed this round
    over: false,
  };
}

// ---- where a book may go ---------------------------------------------------------------------------------------
// Slot k (0..2) of category c can hold any book in [lower, upper]: in the category, after the filled slots to its left
// (leaving a book for each empty slot between) and before the filled slots to its right.
export function slotRange(state, slot) {
  const c = CATS[catOf(slot)], k = slot % 3, base = catOf(slot) * 3;
  let lower = c.lo + k, upper = c.hi - (2 - k);
  for (let j = 0; j < 3; j++) {
    const b = state.library[base + j];
    if (b === null || j === k) continue;
    if (j < k) lower = Math.max(lower, b + (k - j));
    else upper = Math.min(upper, b - (j - k));
  }
  return [lower, upper];
}

// Books that may go into this (empty or filled) slot.
export function slotOptions(state, slot) {
  const [lo, hi] = slotRange(state, slot);
  const out = [];
  for (let b = lo; b <= hi; b++) out.push(b);
  return out;
}

// Empty slots where this book is allowed. (A book already in the library has none.)
export function legalSlotsFor(state, book) {
  const ci = BOOKS[book].cat;
  if (state.library.includes(book)) return [];
  const out = [];
  for (let k = 0; k < 3; k++) {
    const slot = ci * 3 + k;
    if (state.library[slot] === null && slotOptions(state, slot).includes(book)) out.push(slot);
  }
  return out;
}

export function slotOf(state, book) {
  const i = state.library.indexOf(book);
  return i < 0 ? null : i;
}

// ---- changing the library --------------------------------------------------------------------------------------
export function place(state, slot, book) {
  if (state.over) throw new Error('game over');
  if (state.library[slot] !== null) throw new Error('slot is not empty');
  if (!legalSlotsFor(state, book).includes(slot)) throw new Error('illegal placement');
  const s = clone(state);
  s.library[slot] = book;
  return settle(s);
}

// Scorecard use only: take a book back out (the physical game never moves a book once written).
export function clearSlot(state, slot) {
  if (state.mode !== MODES.scorecard) throw new Error('books cannot be moved');
  const s = clone(state);
  s.library[slot] = null;
  return s;
}

// ---- categories and score ----------------------------------------------------------------------------------------
export const filled = (state, ci) => [0, 1, 2].filter((k) => state.library[ci * 3 + k] !== null).length;
export const isComplete = (state, ci) => filled(state, ci) === 3;

// The way you completed a category if nobody has said otherwise: first, unless another player already did.
function settle(s) {
  CATS.forEach((c, ci) => {
    if (isComplete(s, ci) && !s.claims[c.id]) s.claims[c.id] = s.mode === MODES.solo || !s.taken[c.id] ? 'first' : 'later';
  });
  if (s.library.every((b) => b !== null)) s.over = s.mode === MODES.solo ? true : s.over;
  return s;
}

export function setClaim(state, catId, how) {            // how: 'first' | 'later'
  if (!CATS.some((c) => c.id === catId) || !['first', 'later'].includes(how)) throw new Error('bad claim');
  const s = clone(state);
  s.claims[catId] = how;
  return s;
}
export function setTaken(state, catId, taken) {           // another player has completed this category
  const s = clone(state);
  s.taken[catId] = !!taken;
  return s;
}

export function categoryPoints(state, ci) {
  const c = CATS[ci];
  if (!isComplete(state, ci)) return 0;
  return state.claims[c.id] === 'later' ? c.second : c.first;
}

export function score(state) {
  const categories = CATS.map((c, ci) => ({ id: c.id, label: c.label, filled: filled(state, ci), complete: isComplete(state, ci), points: categoryPoints(state, ci), how: isComplete(state, ci) ? state.claims[c.id] : null }));
  const empty = state.library.filter((b) => b === null).length;
  const earned = categories.reduce((a, c) => a + c.points, 0);
  return { categories, earned, empty, total: earned - empty };
}

// ---- solo: three cards a round ---------------------------------------------------------------------------------
export const trayBooks = (state) => state.tray.map(cardBook);

// Flip the next three cards. After round 21 this ends the game.
export function flip(state) {
  if (state.mode !== MODES.solo) throw new Error('only in solo play');
  if (state.over) throw new Error('game over');
  const s = clone(state);
  if (s.round >= ROUNDS) { s.over = true; s.tray = []; s.placedThisRound = null; return s; }
  s.tray = s.deck.slice(s.round * 3, s.round * 3 + 3);
  s.round += 1;
  s.placedThisRound = null;
  return s;
}

// Put one of this round's three books into a slot (at most one a round).
export function placeFromTray(state, trayIndex, slot) {
  if (state.mode !== MODES.solo) throw new Error('only in solo play');
  if (state.placedThisRound !== null) throw new Error('already placed a book this round');
  if (!(trayIndex >= 0 && trayIndex < state.tray.length)) throw new Error('no such card');
  const s = place(state, slot, cardBook(state.tray[trayIndex]));
  s.placedThisRound = trayIndex;
  return s;
}

// Which slots can the card at this tray position go in right now?
export function trayOptions(state, trayIndex) {
  if (state.mode !== MODES.solo || state.over || state.placedThisRound !== null || !state.tray[trayIndex]) return [];
  return legalSlotsFor(state, cardBook(state.tray[trayIndex]));
}

// Can the player still do anything useful this round? (Used to nudge a pass.)
export function mustPass(state) {
  return state.tray.every((_, i) => trayOptions(state, i).length === 0);
}
