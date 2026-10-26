// Six Days: the computer players. They only ever make legal plays (they ask the rules for them).
//   casual  takes the points in front of them but wanders: sometimes draws or plays at random
//   steady  takes the best points, keeps its Evening & Morning cards for full days, and will not end the game while behind
//   sharp   as steady, plus it avoids filling a day it cannot close (that hands the points to whoever holds an Evening & Morning card)
import * as E from './engine.js';

export const SKILLS = {
  casual: { wander: 0.3, careful: false, gift: 0 },
  steady: { wander: 0, careful: true, gift: 0 },
  sharp: { wander: 0, careful: true, gift: 0.35 },
};

// Could this card still be played somewhere, ever? (day cards for days already full or closed, and Evening & Morning with nothing left to close, are dead)
function useful(s, uid) {
  const d = E.DEFS[uid];
  if (d.kind === 'em') return s.stacks.some((k, i) => k.em === null && (i >= s.started || true));
  for (let i = d.day - 1; i < 6; i++) if (!E.isClosed(s, i) && !E.isFull(s, i)) return true;
  return false;
}

function holdsEM(hand, except) { return hand.some((u) => u !== except && E.DEFS[u].kind === 'em'); }

// The value of one play, for the player who is to move in state `s` (the hand already holds the drawn card).
function value(s, uid, m, skill) {
  const k = SKILLS[skill] || SKILLS.steady, p = E.me(s);
  if (m.type === 'discard') return useful(s, uid) ? -1 : -0.2;
  let v = m.pts;
  if (m.type === 'start' || m.type === 'add') {
    const filled = s.stacks[m.stack].cards.length + 1 >= m.stack + 1;
    if (filled && k.gift && !holdsEM(p.hand, uid)) v -= k.gift * (m.stack + 1);
    if (k.careful) {
      const last = s.stacks.every((st, i) => i === m.stack ? filled : E.isFull(s, i));
      if (last) { const others = Math.max(...s.players.filter((q) => q !== p).map((q) => q.score)); v += p.score + m.pts > others ? 3 : -2; }
    }
  }
  if (m.type === 'close' && k.careful) {
    // closing the last open day ends nothing (the game ends on day cards), so no special case
  }
  return v;
}

// The best play with the cards in `hand` (state `s` with that hand in place).
export function bestPlay(s, hand, skill, r = Math.random) {
  const k = SKILLS[skill] || SKILLS.steady, t = structuredClone(s);
  E.me(t).hand = hand;
  let best = null;
  for (const uid of hand) for (const m of E.moves(t, uid)) {
    if (m.type === 'discard' && m.pile !== 0) continue;                  // the pile is chosen afterwards
    const v = value(t, uid, m, skill) + r() * 0.05;
    if (!best || v > best.v) best = { uid, move: m, v };
  }
  if (k.wander && r() < k.wander) {                                       // a casual player sometimes just does something
    const cand = []; for (const uid of hand) for (const m of E.moves(t, uid)) if (m.type !== 'discard' || m.pile === 0) cand.push({ uid, move: m, v: 0 });
    return cand[Math.floor(r() * cand.length)];
  }
  return best;
}

export function chooseDraw(s, skill, r = Math.random) {
  const k = SKILLS[skill] || SKILLS.steady, p = E.me(s);
  const sources = ['deck', 0, 1, 2].filter((x) => (x === 'deck' ? s.draw.length : s.piles[x].length));
  if (k.wander && r() < k.wander) return sources[Math.floor(r() * sources.length)];
  let best = null;
  for (const src of sources) {
    if (src === 'deck') continue;
    const top = s.piles[src][s.piles[src].length - 1], b = bestPlay(s, [...p.hand, top], skill, () => 0.5);
    if (!best || b.v > best.v) best = { src, v: b.v };
  }
  const baseline = skill === 'sharp' ? 1.2 : 1;                           // what an unseen card is worth, roughly
  if (best && (best.v > baseline + 0.15 || !s.draw.length)) return best.src;
  return s.draw.length ? 'deck' : best.src;
}

export function choosePlay(s, skill, r = Math.random) {
  const p = E.me(s), b = bestPlay(s, p.hand, skill, r);
  let move = b.move;
  if (move.type === 'discard') move = { type: 'discard', pile: Math.floor(r() * E.PILES) };
  return { uid: b.uid, move };
}

// A whole turn for the computer player whose turn it is.
export function turn(s, r = Math.random) {
  const skill = E.me(s).skill || 'steady';
  s = E.draw(s, chooseDraw(s, skill, r));
  const { uid, move } = choosePlay(s, skill, r);
  return E.play(s, uid, move);
}
