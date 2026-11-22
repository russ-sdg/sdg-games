// The computer players. They see only what a person at the table could: their own hand, every Fruit Tree, the discard pile and
// how many cards each opponent holds. (They are never shown another hand, except one handed over by Gentleness.)
//   casual  plays at random a fifth of the time, and often cannot recite the fruit
//   steady  sensible play
//   sharp   sensible play that also takes the best deal on offer and plays Deeds against whoever is closest to winning
import * as E from './engine.js';

const SKILL = {
  casual: { slip: 0.2, recite: 0.65, aggro: 0.6 },
  steady: { slip: 0.04, recite: 0.9, aggro: 1 },
  sharp: { slip: 0, recite: 1, aggro: 1.4 },
};
export const skillOf = (k) => SKILL[k] || SKILL.steady;
export const recites = (skill, rnd = Math.random) => rnd() < skillOf(skill).recite;

const up = (p, f) => p.tree[f].s === 1;
const threat = (p) => E.upCount(p) / 9;
const opps = (S, seat) => S.players.map((p, i) => i).filter((i) => i !== seat);
const best = (list, score) => list.reduce((b, x) => (b === null || score(x) > score(b) ? x : b), null);

// How much a card in hand is worth keeping.
function value(S, seat, c) {
  const p = S.players[seat];
  if (c === 'wild') return 8;
  if (E.isDeed(c)) return E.coverSpots(p).length ? 3 : 1;
  if (c === 'faithfulness') return p.tree.faithfulness.s === 1 ? 0 : 6;     // useless in hand, but it can be discarded and picked up again
  if (up(p, c)) return c === 'selfcontrol' ? 3 : c === 'joy' ? 2 : 1;       // a duplicate
  if (c === 'selfcontrol') return 9 + E.coveredCount(p);
  if (c === 'joy') return 6;
  if (c === 'patience') return 7;
  return 9;
}

function playScore(S, seat, a, k) {
  const me = S.players[seat], F = S.flags;
  const covered = E.coveredCount(me);
  switch (a.card) {
    case 'joy': return 20;
    case 'love': { const t = S.players[a.target]; return 10 - 0.9 * E.coveredCount(t) * (0.4 + threat(t)) * 2; }
    case 'kindness': { const t = S.players[a.target]; return 10 - 5 * threat(t) - (a.give === 'wild' ? 4 : 0) - (E.upCount(t) >= 7 ? 12 : 0); }
    case 'gentleness': { const t = S.players[a.target]; return 8.5 - 3 * threat(t) - (E.upCount(t) >= 7 ? 6 : 0); }
    case 'selfcontrol': return 10 + 3 * covered + (me.hand.some(E.isDeed) ? 1.5 : 0);
    case 'peace': return 9.5 - (me.hand.filter(E.isDeed).length ? 0.5 : 0);
    case 'goodness': return 9.8;
    case 'patience': return 10.2;
    case 'wild': return 7 + (a.spot === 'selfcontrol' ? 1 : 0) + (F.fruit ? 0 : 0);
    default: return 9;
  }
}

function deedScore(S, seat, a, sk) {
  const me = S.players[seat], mine = me.tree[a.cover];
  const cost = 1.2 + (a.cover === 'selfcontrol' ? 0.5 : 0);
  const junk = me.hand.filter(E.isDeed).length;                              // deeds clog the hand and can only be thrown away under Self-Control
  const pressure = (junk >= 2 ? 1.4 : 0) + (me.hand.length >= 5 && junk >= 1 ? 0.6 : 0);
  if (a.card === 'envy') {
    const t = S.players[a.target], card = t.tree[a.spot].wild ? 'wild' : a.spot;
    const gain = E.needed(me, card) ? 2.4 : 0.8;
    return sk.aggro * (gain + 2.6 * threat(t) + (E.upCount(t) >= 7 ? 2.5 : 0)) + pressure - cost - (a.spot === 'selfcontrol' ? 0.6 : 0);
  }
  if (a.card === 'revelry') {
    const gain = E.needed(me, a.pick) ? (a.pick === 'faithfulness' ? 0.5 : 3.6) : 0.2;
    return gain * sk.aggro + pressure - cost;
  }
  const t = S.players[a.target];                                             // rivalry: a blind swap, good for dumping a weak card
  return sk.aggro * (0.4 + 1.5 * threat(t)) + pressure + (me.hand.length >= 5 ? 0.3 : 0) - cost - (mine ? 0 : 0);
}

// Which of my showing fruit to cover with a deed: Self-Control is forced; otherwise the one easiest to earn back.
function coverRank(S, seat, f) {
  const hardness = { selfcontrol: 5, patience: 5, kindness: 4, goodness: 4, love: 3, gentleness: 3, peace: 2, joy: 2, faithfulness: 4 };
  const have = S.players[seat].hand.filter((c) => c === f).length;
  return -(hardness[f] || 3) + have * 6;                                      // already holding a spare of it: re-earn at once
}

export function choose(S, skill = 'steady', rnd = Math.random) {
  const L = E.legal(S), seat = E.actor(S), me = S.players[seat], sk = skillOf(skill), P = S.pending;
  if (!L.length) return null;
  if (L.length === 1) return L[0];
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const slip = rnd() < sk.slip;

  // ---- answering a question ----
  if (P) {
    if (P.kind === 'jealous') {
      const yes = L.filter((a) => a.t === 'jealousy');
      const tgt = S.players[P.target];
      const want = E.upCount(tgt) >= 5 || (P.give !== 'wild' && me.tree[P.give].s !== 1 && rnd() < 0.5 * sk.aggro);
      if (!want || !yes.length) return L.find((a) => a.t === 'pass');
      return best(yes, (a) => coverRank(S, seat, a.cover));
    }
    if (P.kind === 'uncl') {
      const yes = L.filter((a) => a.t === 'uncl');
      const mineNeeded = P.card === 'wild' || me.tree[P.card].s !== 1;
      if (!mineNeeded || rnd() > 0.55 * sk.aggro) return L.find((a) => a.t === 'pass');
      return best(yes, (a) => coverRank(S, seat, a.cover));
    }
    if (P.kind === 'give') return best(L, (a) => -value(S, seat, a.card) + (slip ? rnd() : 0));
    if (P.kind === 'peace') return best(L, (a) => -value(S, seat, a.card));
    if (P.kind === 'take') {                                                    // someone handed me their cards: take the one they most need
      const g = S.players[P.from];
      return best(L, (a) => (a.card === 'wild' ? 8 : E.isFruit(a.card) && g.tree[a.card] && g.tree[a.card].s !== 1 && a.card !== 'faithfulness' ? 10 : 2) + rnd());
    }
  }

  switch (S.phase) {
    case 'start': {
      const top = S.discard[S.discard.length - 1], draw = L.filter((a) => a.t === 'draw');
      const wantTop = top && ((top === 'faithfulness' && me.tree.faithfulness.s !== 1) || (E.needed(me, top) && top !== 'wild') || (top === 'wild' && rnd() < 0.5)
        || (top === 'selfcontrol' && E.coveredCount(me) > 0));
      const skip = L.find((a) => a.t === 'skip');
      if (skip && me.hand.includes('patience') && !up(me, 'patience') && !me.canPatience && rnd() < 0.5) return skip;
      if (wantTop && draw.some((a) => a.from === 'discard') && !slip) return draw.find((a) => a.from === 'discard');
      return draw.find((a) => a.from === 'pile') || draw[0];
    }
    case 'draw1': case 'refill': {
      if (L.some((a) => a.t === 'draw')) {
        const top = S.discard[S.discard.length - 1], d = L.filter((a) => a.t === 'draw');
        const wantTop = top && ((top === 'faithfulness' && me.tree.faithfulness.s !== 1) || (E.needed(me, top) && rnd() < 0.7));
        if (wantTop && d.some((a) => a.from === 'discard')) return d.find((a) => a.from === 'discard');
        return d.find((a) => a.from === 'pile') || d[0];
      }
      return best(L, (a) => -value(S, seat, a.card));                          // too many cards: throw away the least useful
    }
    case 'faith': return L.find((a) => a.t === 'faith' && a.play) || L[0];
    case 'gentle': return L.find((a) => a.t === 'play') || L.find((a) => a.t === 'handover');
    case 'main': {
      if (slip) { const r = pick(L.filter((a) => a.t !== 'goodnessFail')); if (r.t !== 'play' || r.card !== 'goodness') return r; }
      const plays = L.filter((a) => a.t === 'play');
      if (plays.length) {
        let top = best(plays, (a) => playScore(S, seat, a, sk));
        if (playScore(S, seat, top, sk) > 5) {
          if (top.card === 'goodness' && !recites(skill, rnd)) return { t: 'goodnessFail' };
          return top;
        }
      }
      const deeds = L.filter((a) => a.t === 'deed');
      if (deeds.length) {
        const d = best(deeds, (a) => deedScore(S, seat, a, sk) + 0.001 * coverRank(S, seat, a.cover));
        if (deedScore(S, seat, d, sk) > 2.5) return d;
      }
      // tidy up: throw away what can never help (spares, Faithfulness last so it can be picked up again), then end the turn
      const spare = L.filter((a) => a.t === 'discard' && value(S, seat, a.card) <= 1 && a.card !== 'faithfulness' && !E.isDeed(a.card));
      if (spare.length && me.hand.length > 3) return spare[0];
      return L.find((a) => a.t === 'end');
    }
  }
  return L[0];
}
