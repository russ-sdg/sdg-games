// The computer players. They see only what a person at the table could: their own hand, the cards played, the bids and tricks won.
// To bid, a player deals the unseen cards at random to the others many times, plays the hand out each way, and bids what scores best.
//   casual  tries few deals, and sometimes plays a random card
//   steady  a fair number of deals
//   sharp   many deals
import * as E from './engine.js';
import { CARD, SUITS, value } from './cards.js';

const SKILL = { casual: { deals: 4, slip: 0.12, proclaim: 0.35 }, steady: { deals: 12, slip: 0.02, proclaim: 0.8 }, sharp: { deals: 24, slip: 0, proclaim: 1 } };
export const skillOf = (k) => SKILL[k] || SKILL.steady;

// The cost of giving a card up: high cards and role (Grace) cards are worth keeping.
const keep = (card, role) => value(card) + (CARD[card].roles.includes(role) ? 400 : 0) + (CARD[card].special ? 150 : 0);

// ctx: { seat, role, hand, trick:[{p,card,grace}], target, won, n }. Returns { card, grace }.
export function pickCard(ctx) {
  const { seat, role, hand, trick, n } = ctx, off = trick.some((e) => CARD[e.card].special === 'nograce');
  const opts = [];
  for (const c of E.legalCards(hand, trick)) { opts.push({ card: c, grace: false }); if (!off && CARD[c].roles.includes(role)) opts.push({ card: c, grace: true }); }
  const wins = (o) => E.trickResult([...trick, { p: seat, card: o.card, grace: o.grace }]).winner === seat;
  const want = ctx.target - ctx.won > 0, leading = trick.length === 0, remaining = n - trick.length - 1;
  const by = (list, f) => list.reduce((b, x) => (f(x) > f(b) ? x : b), list[0]);
  if (leading) {
    if (!want) return by(opts.filter((o) => !o.grace), (o) => -value(o.card) - (CARD[o.card].special === 'leader' ? 9999 : 0));   // lead low, never Mark 14:27
    const lead = opts.find((o) => CARD[o.card].special === 'leader');           // Mark 14:27 wins the trick for whoever leads it
    if (lead) return lead;
    return by(opts, (o) => value(o.card) + (o.grace ? 1000 : 0) - (CARD[o.card].special === 'lowest' ? 5000 : 0));
  }
  const winners = opts.filter(wins), losers = opts.filter((o) => !wins(o) && !o.grace);
  if (want) {
    if (winners.length) {
      const plain = winners.filter((o) => !o.grace), pool = plain.length ? plain : winners;
      return remaining > 0 ? by(pool, (o) => value(o.card) + (o.grace ? 1000 : 0)) : by(pool, (o) => -keep(o.card, role) - (o.grace ? 5000 : 0));
    }
    return by(opts.filter((o) => !o.grace), (o) => -keep(o.card, role));        // cannot win: throw the card least worth keeping
  }
  if (losers.length) return by(losers, (o) => value(o.card) + (CARD[o.card].special ? -200 : 0));   // stay under, and shed a high card while doing it
  return by(winners.filter((o) => !o.grace).length ? winners.filter((o) => !o.grace) : winners, (o) => -value(o.card));   // forced to win: win as low as possible
}

// ---- bidding: deal the unseen cards at random and play the hand out -------------------------------------------------------------------
function rollout(S, seat, myTarget, rnd) {
  const size = E.handSize(S), n = S.n, me = S.players[seat];
  const unseen = []; for (const id of Object.keys(CARD)) if (!me.hand.includes(id)) unseen.push(id);
  for (let i = unseen.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [unseen[i], unseen[j]] = [unseen[j], unseen[i]]; }
  const hands = S.players.map((p, i) => (i === seat ? [...me.hand] : unseen.splice(0, size)));
  const roles = S.players.map((p) => p.role), won = Array(n).fill(0);
  const targets = S.players.map((p, i) => (i === seat ? myTarget : p.bid !== null ? p.bid : Math.max(0, Math.min(size, Math.floor(size / n + rnd())))));
  let leader = S.leader;
  for (let t = 0; t < size; t++) {
    const trick = [];
    for (let k = 0; k < n; k++) {
      const p = (leader + k) % n, { card, grace } = pickCard({ seat: p, role: roles[p], hand: hands[p], trick, target: targets[p], won: won[p], n });
      hands[p].splice(hands[p].indexOf(card), 1); trick.push({ p, card, grace });
      if (CARD[card].special === 'rotate') { const r = E.rotateRoles(roles); r.forEach((x, i) => { roles[i] = x; }); }
    }
    const w = E.trickResult(trick).winner; won[w]++; leader = w;
  }
  return won[seat];
}
export function chooseBid(S, seat, skill, rnd = Math.random) {
  const sk = skillOf(skill), size = E.handSize(S), opts = E.bidOptions(S);
  let best = null, bestPts = -1;
  for (const b of opts) {
    let pts = 0; for (let k = 0; k < sk.deals; k++) pts += E.handPoints(size, b, rollout(S, seat, b, rnd));
    pts = pts / sk.deals + rnd() * 0.01;
    if (pts > bestPts) { bestPts = pts; best = b; }
  }
  if (skill === 'casual' && opts.length > 2 && rnd() < 0.3) { const i = opts.indexOf(best) + (rnd() < 0.5 ? -1 : 1); if (opts[i] !== undefined) best = opts[i]; }
  return best;
}

// ---- the decisions ----------------------------------------------------------------------------------------------------------------
// Another player played a Grace card without saying "Grace". Proclaim it for them if that would make them win a trick they do not want.
function wantsProclaim(S, seat, skill, rnd) {
  const P = S.pending, tp = S.players[P.target], size = E.handSize(S);
  const would = E.trickResult(S.trick.map((e, i) => (i === S.trick.length - 1 ? { ...e, grace: true } : e))).winner === P.target;
  const wasWinning = E.trickResult(S.trick).winner === P.target;
  const unwanted = E.isAllNothing(size) ? tp.bid === 0 : tp.won >= tp.bid;
  return would && !wasWinning && unwanted && rnd() < skillOf(skill).proclaim;
}
export function choose(S, skill = 'steady', rnd = Math.random) {
  const L = E.legal(S), seat = E.actor(S), me = S.players[seat], sk = skillOf(skill);
  if (!L.length) return null;
  if (S.pending) return wantsProclaim(S, seat, skill, rnd) ? { t: 'proclaim' } : { t: 'pass' };
  if (S.phase === 'bid') return { t: 'bid', n: chooseBid(S, seat, skill, rnd) };
  if (L.length === 1) return L[0];
  if (rnd() < sk.slip) return L[Math.floor(rnd() * L.length)];
  const r = pickCard({ seat, role: me.role, hand: me.hand, trick: S.trick, target: me.bid, won: me.won, n: S.n });
  return { t: 'play', card: r.card, grace: r.grace };
}
