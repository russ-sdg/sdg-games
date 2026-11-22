// Illuminate: the rules as pure functions on plain JSON state (so a saved game resumes). Seats go clockwise; seat 0 is the person at the screen.
//   legal(S)      every action the player who must act next may take
//   apply(S, a)   returns the new state; throws if `a` is not one of legal(S)
// Phases: bid -> play (trick after trick, a pending Grace question can interrupt) -> the hand is scored and the next one dealt -> over.
import { CARDS, CARD, SUITS, value, byHand } from './cards.js';

export const HAND_PLANS = { standard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], short: [1, 2, 3, 4, 5, 6], long: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1] };
export const isAllNothing = (size) => size === 6 || size === 12;       // these hands are bid "all" or "nothing" and scored specially
const clone = (s) => structuredClone(s);
const same = (a, b) => { const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every((k) => a[k] === b[k]); };

function rand(S) {                                                    // mulberry32, its state kept in S.rs
  let t = (S.rs = (S.rs + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(S, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand(S) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export const handSize = (S) => S.sizes[S.handNo];
export const actor = (S) => (S.pending ? S.pending.actor : S.turn);
const log = (S, e) => { S.log.push(e); if (S.log.length > 200) S.log.splice(0, S.log.length - 200); };
const trickDisabled = (trick) => trick.some((e) => CARD[e.card].special === 'nograce');

// ---- setting up --------------------------------------------------------------------------------------------------------------------
export function newGame({ seed = 1, players, plan = 'standard', notPerfect = false, dealer = 0 }) {
  const S = { v: 1, rs: seed >>> 0, n: players.length, plan, sizes: HAND_PLANS[plan], opts: { notPerfect }, handNo: 0, dealer: dealer % players.length, phase: 'bid',
    players: players.map((p) => ({ name: p.name, bot: !!p.bot, skill: p.skill || null, role: p.role, score: 0, bid: null, won: 0, hand: [] })),
    turn: 0, leader: 0, tricks: 0, trick: [], pending: null, lastTrick: null, lastHand: null, history: [], over: false, winners: [], log: [] };
  dealHand(S);
  return S;
}
function dealHand(S) {
  const deck = shuffle(S, CARDS.map((c) => c.id)), size = handSize(S);
  S.players.forEach((p) => { p.hand = deck.splice(0, size).sort(byHand); p.bid = null; p.won = 0; });
  S.phase = 'bid'; S.trick = []; S.pending = null;
  S.leader = (S.dealer + 1) % S.n; S.turn = S.leader;                 // the player to the dealer's left bids first, and leads
}

// ---- what may be done --------------------------------------------------------------------------------------------------------------
export function legalCards(hand, trick) {                             // you must follow the suit that was led, if you can
  if (!trick.length) return [...hand];
  const led = CARD[trick[0].card].suit, follow = hand.filter((c) => CARD[c].suit === led);
  return follow.length ? follow : [...hand];
}
export function bidOptions(S) {
  const size = handSize(S);
  if (isAllNothing(size)) return [0, size];
  const out = []; for (let b = 0; b <= size; b++) out.push(b);
  const last = S.players.filter((p) => p.bid !== null).length === S.n - 1;      // the dealer bids last: with "Not Perfect bidding" the bids may not add up to the hand
  if (S.opts.notPerfect && last) { const sum = S.players.reduce((a, p) => a + (p.bid ?? 0), 0); return out.filter((b) => sum + b !== size); }
  return out;
}
export function legal(S) {
  if (S.over) return [];
  const P = S.pending;
  if (P) return [{ t: 'proclaim' }, { t: 'pass' }];
  if (S.phase === 'bid') return bidOptions(S).map((n) => ({ t: 'bid', n }));
  const p = S.players[S.turn], off = trickDisabled(S.trick), out = [];
  for (const c of legalCards(p.hand, S.trick)) {
    out.push({ t: 'play', card: c, grace: false });
    if (!off && CARD[c].roles.includes(p.role)) out.push({ t: 'play', card: c, grace: true });
  }
  return out;
}
export const graceEligible = (card, role) => CARD[card].roles.includes(role);

// ---- tricks ------------------------------------------------------------------------------------------------------------------------
// entries: [{p, card, grace}] in the order played. Returns who wins and why.
export function trickResult(es) {
  const disabled = trickDisabled(es);
  const sp = es.filter((e) => ['lowest', 'leader'].includes(CARD[e.card].special));
  if (sp.length) {                                                      // if more than one such card is played, the last one governs
    const s = sp[sp.length - 1], kind = CARD[s.card].special;
    if (kind === 'leader') return { winner: es[0].p, why: 'leader', card: s.card };
    const low = es.reduce((b, e) => (value(e.card) < value(b.card) || (value(e.card) === value(b.card) && SUITS.indexOf(CARD[e.card].suit) < SUITS.indexOf(CARD[b.card].suit)) ? e : b), es[0]);
    return { winner: low.p, why: 'lowest', card: s.card };
  }
  const g = disabled ? [] : es.filter((e) => e.grace);
  if (g.length) return { winner: g.reduce((b, e) => (value(e.card) > value(b.card) ? e : b)).p, why: 'grace' };
  const led = CARD[es[0].card].suit, inSuit = es.filter((e) => CARD[e.card].suit === led);
  return { winner: inSuit.reduce((b, e) => (value(e.card) > value(b.card) ? e : b)).p, why: disabled ? 'nograce' : 'high' };
}
export function rotateRoles(roles) {                                   // take the Role Card from the player on your left (the next seat), give yours to the right
  return roles.map((_, i) => roles[(i + 1) % roles.length]);
}

// ---- scoring -----------------------------------------------------------------------------------------------------------------------
export function handPoints(size, bid, won) {                           // points for one player, ignoring other players
  if (isAllNothing(size)) return bid === size ? (won === size ? 2 * size : 0) : 2 * size - 2 * won;
  return won === bid ? bid + 2 : 0;
}
function scoreHand(S) {
  const size = handSize(S), pts = S.players.map((p) => handPoints(size, p.bid, p.won));
  if (isAllNothing(size)) {                                             // if someone took every trick after bidding "all", everyone else scores nothing
    const sweep = S.players.findIndex((p) => p.bid === size && p.won === size);
    if (sweep >= 0) pts.forEach((_, i) => { if (i !== sweep) pts[i] = 0; });
  }
  S.players.forEach((p, i) => { p.score += pts[i]; });
  S.lastHand = { no: S.handNo + 1, of: S.sizes.length, size, bids: S.players.map((p) => p.bid), won: S.players.map((p) => p.won), pts, scores: S.players.map((p) => p.score) };
  S.history.push(S.lastHand);
  log(S, { k: 'hand', ...S.lastHand });
}
function endHand(S) {
  scoreHand(S);
  if (S.handNo + 1 >= S.sizes.length) {
    const best = Math.max(...S.players.map((p) => p.score));
    S.over = true; S.phase = 'over'; S.winners = S.players.map((p, i) => (p.score === best ? i : -1)).filter((i) => i >= 0);
    return;
  }
  S.handNo++; S.dealer = (S.dealer + 1) % S.n; dealHand(S);
}
function finishTrick(S) {
  const r = trickResult(S.trick);
  S.lastTrick = { entries: S.trick, winner: r.winner, why: r.why, card: r.card || null, hand: S.handNo };
  S.players[r.winner].won++; S.tricks++;
  log(S, { k: 'trick', who: r.winner, why: r.why, card: r.card || null });
  S.trick = []; S.leader = r.winner; S.turn = r.winner;
  if (!S.players.some((p) => p.hand.length)) endHand(S);
}
function afterPlay(S) {                                                // the card is down and any Grace question is settled
  if (S.trick.length === S.n) finishTrick(S); else S.turn = (S.trick[S.trick.length - 1].p + 1) % S.n;
}

export function apply(S0, a) {
  if (!legal(S0).some((x) => same(x, a))) throw new Error('illegal action ' + JSON.stringify(a));
  const S = clone(S0), who = actor(S), P = S.pending;
  if (P) {
    const e = S.trick[S.trick.length - 1];
    if (a.t === 'proclaim') { e.grace = true; S.pending = null; log(S, { k: 'proclaim', who, target: e.p, card: e.card }); afterPlay(S); return S; }
    P.i++;
    if (P.i < P.order.length) { P.actor = P.order[P.i]; return S; }
    S.pending = null; afterPlay(S); return S;
  }
  if (a.t === 'bid') {
    S.players[who].bid = a.n; log(S, { k: 'bid', who, n: a.n, size: handSize(S) });
    if (S.players.every((p) => p.bid !== null)) { S.phase = 'play'; S.turn = S.leader; } else S.turn = (who + 1) % S.n;
    return S;
  }
  // play a card
  const p = S.players[who];
  p.hand.splice(p.hand.indexOf(a.card), 1);
  S.trick.push({ p: who, card: a.card, grace: a.grace, role: p.role });
  log(S, { k: 'play', who, card: a.card, grace: a.grace });
  if (CARD[a.card].special === 'rotate') {
    const roles = rotateRoles(S.players.map((q) => q.role)); S.players.forEach((q, i) => { q.role = roles[i]; });
    log(S, { k: 'rotate', roles });
  }
  // Another player may proclaim "Grace!" for a Grace card you played without doing so.
  if (!a.grace && graceEligible(a.card, S.trick[S.trick.length - 1].role) && !trickDisabled(S.trick) && S.n > 1) {
    const order = []; for (let k = 1; k < S.n; k++) order.push((who + k) % S.n);
    S.pending = { kind: 'proclaim', order, i: 0, actor: order[0], target: who };
    return S;
  }
  afterPlay(S); return S;
}
