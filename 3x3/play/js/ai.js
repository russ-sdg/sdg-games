// The computer players. They see exactly what a person at the table sees: their own hand, and every card
// that has been shown (and which spot it came from). What they remember depends on their skill.
//   casual: forgets a lot, and sometimes just picks a card to turn over
//   steady: forgets a little
//   sharp:  remembers everything that was shown
import * as E from './engine.js';

export const SKILLS = { casual: { forget: 0.4, wander: 0.2 }, steady: { forget: 0.1, wander: 0 }, sharp: { forget: 0, wander: 0 } };

// Called at the start of the computer's turn: some of what it knew has slipped its mind.
export function forget(S0, seat, skill, r) {
  const S = structuredClone(S0), k = S.know[seat], f = (SKILLS[skill] || SKILLS.steady).forget;
  if (f) for (const key of Object.keys(k)) if (r() < f) delete k[key];
  return S;
}

const pick = (list, r) => list[Math.floor(r() * list.length)];
function weighted(list, w, r) {
  const total = list.reduce((s, x) => s + w(x), 0);
  let t = r() * total;
  for (const x of list) { t -= w(x); if (t <= 0) return x; }
  return list[list.length - 1];
}

// What the player at `seat` believes is at an action's spot (undefined if unknown).
function belief(S, seat, a) {
  if (a.kind === 'hand' && a.p === seat) return S.players[seat].hand[a.idx];
  return S.know[seat][E.keyOf(a)];
}

// The next card to show, given what has been shown so far this turn.
export function nextAction(S, skill, r = Math.random) {
  const seat = S.turn, acts = E.actions(S), conf = SKILLS[skill] || SKILLS.steady;
  if (!acts.length) return null;
  if (conf.wander && r() < conf.wander) return pick(acts, r);
  const known = acts.filter((a) => belief(S, seat, a) !== undefined);
  const unknown = acts.filter((a) => belief(S, seat, a) === undefined);
  const R = S.reveals;
  const explore = (target) => {
    if (!unknown.length) return pick(acts, r);
    // A hand is sorted, so its top card is probably a big number and its bottom card a small one.
    const w = (a) => (a.kind === 'cell' || target === undefined ? 1 : a.which === 'hi' ? (target >= 9 ? 2 : target >= 6 ? 1 : 0.4) : (target <= 5 ? 2 : target <= 8 ? 1 : 0.4));
    return weighted(unknown, w, r);
  };
  if (R.length === 0) {
    // two (or three) cards I already know to match? go and get them. Otherwise look at something new and see if it matches what I know.
    const groups = {};
    for (const a of known) (groups[belief(S, seat, a)] ||= []).push(a);
    const best = Object.entries(groups).filter(([, g]) => g.length >= 2).sort((a, b) => b[1].length - a[1].length || r() - 0.5)[0];
    return best ? pick(best[1], r) : explore();
  }
  const want = R[0].v, mine = known.filter((a) => belief(S, seat, a) === want);
  return mine.length ? pick(mine, r) : explore(want);
}

// A whole turn at once (used by the tests and the simulation).
export function playTurn(S, skill, r = Math.random) {
  let s = forget(S, S.turn, skill, r);
  for (let guard = 0; guard < 4 && !s.outcome && !s.over; guard++) s = E.reveal(s, nextAction(s, skill, r));
  return E.endTurn(s);
}
