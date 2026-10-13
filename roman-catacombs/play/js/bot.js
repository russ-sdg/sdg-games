// Roman Catacombs: the computer librarians. Pure functions (no DOM, no network, no AI service): each looks at the
// three flipped books and its own library and picks a move by points. Skill changes how carefully it plans.
import { BOOKS, CATS, DECK, cardBook, SLOTS } from './books.js';
import { legalSlotsFor, slotOptions, isComplete, catOf } from './engine.js';

// How many cards of each book are in the deck (a book with 4 cards turns up far more often than one with 1).
const COPIES = Array(BOOKS.length).fill(0);
DECK.forEach((id) => { COPIES[cardBook(id)] += 1; });

export const SKILLS = {
  casual: { name: 'Casual', blurb: 'relaxed; sometimes passes on a good card', future: 0, dead: 0.2, noise: 1.2, lapse: 0.2 },
  steady: { name: 'Steady', blurb: 'sensible; keeps its options open', future: 0.07, dead: 0.8, noise: 0.35, lapse: 0.04 },
  sharp: { name: 'Sharp', blurb: 'plans ahead and races for first bonuses', future: 0.1, dead: 1.2, noise: 0.05, lapse: 0 },
};

// Cards still in the deck that could be placed somewhere in this library, and slots that can never be filled.
export function outlook(p) {
  let live = 0;
  for (let b = 0; b < BOOKS.length; b++) if (legalSlotsFor(p, b).length) live += COPIES[b];
  let dead = 0;
  for (let s = 0; s < SLOTS; s++) if (p.library[s] === null && slotOptions(p, s).length === 0) dead += 1;
  return { live, dead };
}

// Every placement open to this player among the flipped books.
export function candidates(p, trayBooks) {
  const out = [];
  for (const book of new Set(trayBooks)) for (const slot of legalSlotsFor(p, book)) out.push({ book, slot });
  return out;
}

const withBook = (p, slot, book) => { const lib = [...p.library]; lib[slot] = book; return { ...p, library: lib }; };

// Pick a move ({book, slot}) or null to pass. `rand` is a function returning [0, 1).
export function chooseMove(p, trayBooks, skillName, rand) {
  const k = SKILLS[skillName] || SKILLS.steady;
  const opts = candidates(p, trayBooks);
  if (!opts.length) return null;
  if (k.lapse && rand() < k.lapse) return null;                   // sometimes overlooks a good card
  const before = outlook(p);
  let best = null;
  for (const o of opts) {
    const q = withBook(p, o.slot, o.book);
    const ci = catOf(o.slot);
    const after = outlook(q);
    // a filled slot is worth a point; completing a category earns its points (more if nobody has finished it yet)
    let gain = 1;
    if (isComplete(q, ci)) gain += p.taken && p.taken[CATS[ci].id] ? CATS[ci].second : CATS[ci].first;
    gain += k.future * (after.live - before.live) / 3;           // fewer useful cards left is a cost
    gain -= k.dead * (after.dead - before.dead);                  // creating a slot nothing can fill is a bigger one
    gain += (rand() - 0.5) * 2 * k.noise;
    if (!best || gain > best.gain) best = { ...o, gain };
  }
  return best.gain > 0 ? { book: best.book, slot: best.slot } : null;
}
