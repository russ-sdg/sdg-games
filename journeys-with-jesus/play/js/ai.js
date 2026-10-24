// Journeys with Jesus: the computer players. Pure functions (no DOM, no network): each looks at the same things a person
// can see (its own hand, the face-up piles, the journeys in play) and picks one engine action. `step` does one action;
// the page calls it repeatedly so you can watch what the computer does.
import { simplePaths } from './board-data.js';
import * as E from './engine.js';

// Skill: how many journeys a computer lays in one turn, the longest route it will go looking for, how often it overlooks a
// journey it could complete, whether it spots extensions (cards on top of a journey), and how often it recites correctly.
export const SKILLS = {
  casual: { name: 'Casual', blurb: 'takes its time; sometimes overlooks a journey', recite: 0.35, noise: 1.2, extend: false, tokens: false, perTurn: 1, maxCards: 7, miss: 0.5 },
  steady: { name: 'Steady', blurb: 'sensible; lays a journey most turns', recite: 0.6, noise: 0.35, extend: true, tokens: true, perTurn: 1, maxCards: 7, miss: 0.25 },
  sharp: { name: 'Sharp', blurb: 'plans ahead; finds long routes and extensions', recite: 0.85, noise: 0.05, extend: true, tokens: true, look: true, perTurn: 2, maxCards: 9, miss: 0.1 },
};

// How close is this hand to completing each journey in play? (the fewest cards it still lacks, over every route)
function closeness(s, hand, tokens, weights) {
  const defs = E.deckDefs(s.expansion), inv = E.inventoryOf(defs, hand, tokens);
  let total = 0;
  for (const jid of s.inplay) {
    if (jid === null) continue;
    const j = E.journeyById[jid];
    let best = Infinity;
    for (const path of simplePaths(j.a, j.b)) { const m = E.missing(path, inv); if (m < best) best = m; }
    total += (weights ? Math.sqrt(j.points) : 1) / (1 + best * best);
  }
  return total;
}

// Which pile to take from next: the card that brings the hand closest to finishing a journey (the face-down card is a gamble).
export function chooseTake(s, rand = Math.random) {
  const p = E.me(s), sk = SKILLS[p.skill] || SKILLS.steady, base = closeness(s, p.hand, p.tokens, sk !== SKILLS.casual);
  let best = null, bestV = -Infinity, bestUp = 0;
  for (let i = 0; i < E.UP_PILES; i++) {
    if (!E.canTake(s, i)) continue;
    const v = closeness(s, [...p.hand, s.up[i]], p.tokens, sk !== SKILLS.casual) - base + (rand() - 0.5) * sk.noise * 0.1;
    if (v > bestV) { bestV = v; best = i; }
    bestUp = Math.max(bestUp, v);
  }
  if (E.canTake(s, 'down') && (best === null || bestUp < 0.02)) return 'down';
  return best === null ? 'down' : best;
}

// The best journey to lay right now, or null. Sharp also looks one lay ahead (what the next journey could add on top).
const value = (o) => o.points - E.TOKEN_POINTS * o.tokensUsed - 0.3 * o.wildsUsed;
function options(s, sk) { return E.plays(s).filter((o) => (sk.extend || !o.extends) && (sk.tokens || !o.tokensUsed) && o.path.length <= sk.maxCards && value(o) > 0); }
export function choosePlay(s, rand = Math.random) {
  const sk = SKILLS[E.me(s).skill] || SKILLS.steady;
  if ((s.turnRoutes || []).filter((r) => r.who === s.turn).length >= sk.perTurn) return null;
  if (sk.miss && rand() < sk.miss) return null;
  let best = null, bestV = 0;
  for (const o of options(s, sk)) {
    let v = value(o);
    if (sk.look && !s.over) {
      const after = E.play(s, o);
      if (!after.over) v += 0.9 * Math.max(0, ...options(after, sk).map(value));
    }
    if (v > bestV) { bestV = v; best = o; }
  }
  return best;
}

// One action for the computer whose turn it is.
export function step(s, rand = Math.random) {
  const p = E.me(s), sk = SKILLS[p.skill] || SKILLS.steady;
  if (s.phase === 'recite') {
    if (p.hand.length === 0) return E.skipRecite(s);
    const uid = p.hand[Math.floor(rand() * p.hand.length)];
    return E.recite(s, rand() < sk.recite, uid);
  }
  if (s.phase === 'draw' || s.phase === 'topup') return E.take(s, chooseTake(s, rand));
  if (s.phase === 'play') {
    const o = choosePlay(s, rand);
    return o ? E.play(s, o) : E.endPlay(s);
  }
  return s;
}

// Play a whole turn at once (used by tests and simulations).
export function turn(s, rand = Math.random) {
  const who = s.turn, round = s.round;
  while (!s.over && s.turn === who && s.round === round) s = step(s, rand);
  return s;
}
