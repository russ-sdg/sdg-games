// The Fruit of the Spirit: the rules as pure functions on plain JSON state (so a saved game resumes).
// A card is a string: one of the nine fruit, 'wild', or one of the five deeds. Players are seats 0..n-1; seat 0 is the person at the screen.
//
//   legal(S)      every action the player who must act next may take (concrete, with all its choices filled in)
//   apply(S, a)   returns the new state; throws if `a` is not one of legal(S)
//
// Turn phases:  start (skip, or draw)  ->  [faith]  ->  main (play, discard)  ->  refill (draw or discard back to 5)  ->  next player.
// While S.pending is set, some player (S.pending.actor) must answer before play goes on.

export const FRUITS = ['love', 'joy', 'peace', 'patience', 'kindness', 'goodness', 'faithfulness', 'gentleness', 'selfcontrol'];
export const DEEDS = ['envy', 'jealousy', 'revelry', 'rivalry', 'uncleanness'];
export const NAMES = {
  love: 'Love', joy: 'Joy', peace: 'Peace', patience: 'Patience', kindness: 'Kindness', goodness: 'Goodness', faithfulness: 'Faithfulness',
  gentleness: 'Gentleness', selfcontrol: 'Self-Control', wild: 'Wild', envy: 'Envy', jealousy: 'Jealousy', revelry: 'Revelry', rivalry: 'Rivalry',
  uncleanness: 'Uncleanness',
};
export const HAND = 5, ROUND_LIMIT = 120;
export const COPIES = { ...Object.fromEntries(FRUITS.map((f) => [f, 7])), wild: 5, envy: 5, rivalry: 5, uncleanness: 5, jealousy: 4, revelry: 1 };   // 88 cards
export const isDeed = (c) => DEEDS.includes(c);
export const isFruit = (c) => FRUITS.includes(c);
export const name = (c) => NAMES[c];
const ORDER = [...FRUITS, 'wild', ...DEEDS];
const byOrder = (a, b) => ORDER.indexOf(a) - ORDER.indexOf(b);
const clone = (s) => structuredClone(s);
const uniq = (a) => [...new Set(a)];

// ---- chance ------------------------------------------------------------------------------------------------------------------------
function rand(S) {                                                    // mulberry32, its state kept in S.rs so a saved game continues the same way
  let t = (S.rs = (S.rs + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(S, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand(S) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---- looking at the state ----------------------------------------------------------------------------------------------------------
// A tree slot: { s: 0 empty | 1 showing | 2 covered by a deed, d: the deed covering it, wild: a Wild card is standing in for the fruit }
export const upCount = (p) => FRUITS.filter((f) => p.tree[f].s === 1).length;
export const coveredCount = (p) => FRUITS.filter((f) => p.tree[f].s === 2).length;
export const hasSC = (p) => p.tree.selfcontrol.s === 1;
export const actor = (S) => (S.pending ? S.pending.actor : S.turn);
export const me = (S) => S.players[S.turn];
// Where a deed may go: on Self-Control if it is showing, otherwise on any fruit that is showing.
export const coverSpots = (p) => (hasSC(p) ? ['selfcontrol'] : FRUITS.filter((f) => p.tree[f].s === 1));
export const canDiscard = (p, c) => !isDeed(c) || hasSC(p);       // deeds can only be discarded once Self-Control is showing
export const giftable = (c) => (isFruit(c) && c !== 'joy' && c !== 'faithfulness') || c === 'wild';
const others = (S, p) => S.players.map((_, i) => i).filter((i) => i !== p);
const without = (hand, c) => { const i = hand.indexOf(c); return i < 0 ? hand : [...hand.slice(0, i), ...hand.slice(i + 1)]; };
// Would taking this discarded card help this player?
export const needed = (p, c) => c === 'wild' || (isFruit(c) && c !== 'faithfulness' && p.tree[c].s !== 1);

const log = (S, e) => { S.log.push(e); if (S.log.length > 300) S.log.splice(0, S.log.length - 300); };
const same = (a, b) => { const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every((k) => a[k] === b[k]); };
const sortHand = (p) => { p.hand.sort(byOrder); };
const removeOne = (arr, c) => { const i = arr.indexOf(c); if (i >= 0) arr.splice(i, 1); return i >= 0; };

// ---- setting up --------------------------------------------------------------------------------------------------------------------
export function newGame({ seed = 1, players, first = 0 }) {
  const S = { v: 1, rs: seed >>> 0, turn: first % players.length, round: 1, turns: 0, over: false, winner: null, endedBy: null, phase: 'start',
    pending: null, held: null, resume: null, gentle: null, flags: null, draw: [], discard: [], log: [], players: [] };
  for (const [c, n] of Object.entries(COPIES)) for (let i = 0; i < n; i++) S.draw.push(c);
  shuffle(S, S.draw);
  const emptyTree = () => Object.fromEntries(FRUITS.map((f) => [f, { s: 0, d: null, wild: false }]));
  S.players = players.map((p) => ({ name: p.name, bot: !!p.bot, skill: p.skill || null, hand: [], tree: emptyTree(), patient: false, canPatience: false }));
  for (let r = 0; r < HAND; r++) S.players.forEach((p) => p.hand.push(S.draw.pop()));
  S.players.forEach(sortHand);
  S.discard.push(S.draw.pop());
  beginTurn(S);
  return S;
}
function beginTurn(S) {
  const p = S.players[S.turn];
  p.canPatience = p.patient; p.patient = false;
  S.flags = { fruit: false, deed: false, joy: false, goodnessFailed: false };
  S.phase = 'start';
}

// ---- what may be done --------------------------------------------------------------------------------------------------------------
const canDrawPile = (S) => S.draw.length > 0 || S.discard.length > 1;

function fruitPlays(S) {
  const p = me(S), F = S.flags, out = [], opp = others(S, S.turn);
  for (const c of uniq(p.hand)) {
    if (c === 'joy') { if (F.joy && p.tree.joy.s !== 1) out.push({ t: 'play', card: 'joy' }); continue; }
    if (F.fruit || !isFruit(c) || c === 'faithfulness' || p.tree[c].s === 1) continue;
    if (c === 'love') for (const o of opp) { if (coveredCount(S.players[o]) > 0) out.push({ t: 'play', card: c, target: o }); }
    else if (c === 'patience') { if (p.canPatience) out.push({ t: 'play', card: c }); }
    else if (c === 'kindness') {
      const rest = without(p.hand, 'kindness');
      for (const o of opp) for (const g of uniq(rest).filter(giftable)) {
        const t = S.players[o].tree;
        if (g === 'wild') { for (const f of FRUITS) if (t[f].s !== 1) out.push({ t: 'play', card: c, target: o, give: g, spot: f }); }
        else if (t[g].s !== 1) out.push({ t: 'play', card: c, target: o, give: g });
      }
    }
    else if (c === 'gentleness') for (const o of opp) out.push({ t: 'play', card: c, target: o });
    else if (c === 'goodness') { if (!F.goodnessFailed) out.push({ t: 'play', card: c, recite: true }); }
    else out.push({ t: 'play', card: c });                           // peace, selfcontrol
  }
  // A Wild card stands in for any fruit, but only when no other Fruit card can be played.
  if (!F.fruit && p.hand.includes('wild') && !out.some((a) => a.card !== 'joy')) {
    for (const f of FRUITS) if (p.tree[f].s !== 1) out.push({ t: 'play', card: 'wild', spot: f });
  }
  return out;
}
function deedPlays(S) {
  const p = me(S), F = S.flags, out = [], opp = others(S, S.turn), covers = coverSpots(p);
  if (F.deed || !covers.length) return out;
  for (const c of uniq(p.hand)) {
    if (c === 'envy') { for (const cv of covers) for (const o of opp) for (const f of FRUITS) if (S.players[o].tree[f].s === 1) out.push({ t: 'deed', card: c, cover: cv, target: o, spot: f }); }
    else if (c === 'revelry') { for (const cv of covers) for (const k of uniq(S.discard)) out.push({ t: 'deed', card: c, cover: cv, pick: k }); }
    else if (c === 'rivalry') { for (const cv of covers) for (const o of opp) if (S.players[o].hand.length) out.push({ t: 'deed', card: c, cover: cv, target: o }); }
  }
  return out;
}
const discards = (S, p) => uniq(p.hand).filter((c) => canDiscard(p, c)).map((c) => ({ t: 'discard', card: c }));
const draws = (S) => [...(canDrawPile(S) ? [{ t: 'draw', from: 'pile' }] : []), ...(S.discard.length ? [{ t: 'draw', from: 'discard' }] : [])];

export function legal(S) {
  if (S.over) return [];
  const P = S.pending;
  if (P) {
    const p = S.players[P.actor];
    if (P.kind === 'jealous' || P.kind === 'uncl') {
      const out = [{ t: 'pass' }];
      for (const cv of coverSpots(p)) out.push({ t: P.kind === 'jealous' ? 'jealousy' : 'uncl', cover: cv });
      return out;
    }
    if (P.kind === 'give') return uniq(p.hand).map((c) => ({ t: 'give', card: c }));
    if (P.kind === 'take') return uniq(S.players[P.from].hand).map((c) => ({ t: 'take', card: c }));
    if (P.kind === 'peace') return uniq(p.hand.filter(isDeed)).map((c) => ({ t: 'peaceDiscard', card: c }));
    return [];
  }
  const p = me(S);
  switch (S.phase) {
    case 'start': return [{ t: 'skip' }, ...draws(S)];
    case 'draw1': return draws(S);
    case 'faith': return [...(p.tree.faithfulness.s !== 1 ? [{ t: 'faith', play: true }] : []), { t: 'faith', play: false }];
    case 'gentle': return [...fruitPlays(S).filter((a) => a.card === 'joy'), { t: 'handover' }];
    case 'main': {
      const plays = fruitPlays(S), out = [...plays, ...deedPlays(S), ...discards(S, p), { t: 'end' }];
      if (plays.some((a) => a.card === 'goodness')) out.push({ t: 'goodnessFail' });
      return out;
    }
    case 'refill': return p.hand.length < HAND ? draws(S) : discards(S, p);
    default: return [];
  }
}

// ---- doing it ----------------------------------------------------------------------------------------------------------------------
function reshuffle(S) {
  if (S.discard.length > 1) { const top = S.discard.pop(); S.draw = shuffle(S, S.discard); S.discard = [top]; log(S, { k: 'reshuffle' }); }
}
function take(S, from) {
  if (from === 'discard') return S.discard.pop();
  if (!S.draw.length) reshuffle(S);
  return S.draw.pop();
}
function place(S, p, f, card) {                                        // put a card face up on a fruit space (re-earning it if a deed covers it)
  const slot = p.tree[f];
  if (slot.s === 2 && slot.d) S.discard.push(slot.d);
  p.tree[f] = { s: 1, d: null, wild: card === 'wild' };
}
function cover(S, p, f, deed) { p.tree[f] = { ...p.tree[f], s: 2, d: deed }; }
function redeem(S, p) {                                                // take every deed off a tree; the fruit shows again
  let n = 0;
  for (const f of FRUITS) { const s = p.tree[f]; if (s.s === 2) { S.discard.push(s.d); p.tree[f] = { s: 1, d: null, wild: s.wild }; n++; } }
  return n;
}
function checkWin(S) {
  if (S.over) return;
  const order = [S.turn, ...others(S, S.turn)];
  for (const i of order) if (upCount(S.players[i]) === FRUITS.length) { S.over = true; S.winner = i; S.phase = 'over'; S.pending = null; log(S, { k: 'win', who: i }); return; }
}
function endGameByLimit(S) {
  const best = Math.max(...S.players.map(upCount)), tops = S.players.map((p, i) => (upCount(p) === best ? i : -1)).filter((i) => i >= 0);
  S.over = true; S.winner = tops.length === 1 ? tops[0] : null; S.endedBy = 'limit'; S.phase = 'over'; S.pending = null; log(S, { k: 'limit' });
}
function nextTurn(S) {
  S.turn = (S.turn + 1) % S.players.length;
  if (S.turn === 0) S.round++;
  S.turns++; S.held = null; S.gentle = null;
  if (S.round > ROUND_LIMIT) { endGameByLimit(S); return; }
  beginTurn(S);
}
// Move play on when nothing is left to do in the refill step.
function settle(S) {
  if (S.over || S.pending || S.phase !== 'refill') return;
  const p = me(S);
  if (p.hand.length === HAND) nextTurn(S);
  else if (p.hand.length < HAND && !draws(S).length) nextTurn(S);
  else if (p.hand.length > HAND && !discards(S, p).length) nextTurn(S);
}

// Offer a Jealousy / Uncleanness card to each player in turn order who holds one and could use it.
function eligible(S, kind, i, P) {
  const p = S.players[i];
  if (!p.hand.includes(kind === 'jealous' ? 'jealousy' : 'uncleanness') || !coverSpots(p).length) return false;
  return kind === 'jealous' ? true : needed(p, P.card);
}
function offer(S, kind, from, rest) {                                  // rest: extra fields for the pending record
  const order = []; for (let k = 1; k < S.players.length; k++) order.push((from + k) % S.players.length);
  S.pending = { kind, from, order, i: -1, actor: null, ...rest };
  return advanceOffer(S);
}
function advanceOffer(S) {                                             // move to the next player who could answer, or finish
  const P = S.pending;
  for (P.i++; P.i < P.order.length; P.i++) if (eligible(S, P.kind, P.order[P.i], P)) { P.actor = P.order[P.i]; return; }
  S.pending = null;
  if (P.kind === 'jealous') finishKindness(S, P);
  settle(S);
}
function finishKindness(S, P) {                                        // nobody snatched the gift: it goes on the opponent's tree
  const t = S.players[P.target], f = P.give === 'wild' ? P.spot : P.give;
  place(S, t, f, P.give);
  log(S, { k: 'gift', who: P.from, target: P.target, card: P.give, spot: f });
  checkWin(S);
}
function runPeace(S, queue) {                                          // everyone discards a deed card if they have one
  while (queue.length) {
    const i = queue.shift(), p = S.players[i], kinds = uniq(p.hand.filter(isDeed));
    if (!kinds.length) continue;
    if (kinds.length === 1) { removeOne(p.hand, kinds[0]); S.discard.push(kinds[0]); log(S, { k: 'peaceDiscard', who: i, card: kinds[0] }); continue; }
    S.pending = { kind: 'peace', actor: i, queue }; return;
  }
  S.pending = null;
}
function discardCard(S, i, c) {                                        // a chosen discard: another player may snatch it with Uncleanness
  removeOne(S.players[i].hand, c); S.discard.push(c);
  log(S, { k: 'discard', who: i, card: c });
  offer(S, 'uncl', i, { card: c });
}

export function apply(S0, a) {
  if (!legal(S0).some((x) => same(x, a))) throw new Error('illegal action ' + JSON.stringify(a));
  const S = clone(S0), p = S.players[S.turn], who = S.turn;
  const P = S.pending;
  if (!P && a.t !== 'play' && a.t !== 'goodnessFail' && a.t !== 'handover') S.flags.joy = false;

  // ---- answers to a pending question ----
  if (P) {
    const q = S.players[P.actor];
    switch (a.t) {
      case 'pass': advanceOffer(S); break;
      case 'jealousy': {                                                  // the card being given comes to you instead
        removeOne(q.hand, 'jealousy'); cover(S, q, a.cover, 'jealousy');
        const g = P.give, f = g === 'wild' ? (q.tree[P.spot].s !== 1 ? P.spot : FRUITS.find((x) => q.tree[x].s !== 1)) : g;
        if (f && q.tree[f].s !== 1) place(S, q, f, g); else { q.hand.push(g); sortHand(q); }
        log(S, { k: 'jealousy', who: P.actor, from: P.from, target: P.target, card: g });
        S.pending = null; checkWin(S); settle(S); break;
      }
      case 'uncl': {
        removeOne(q.hand, 'uncleanness'); cover(S, q, a.cover, 'uncleanness');
        const i = S.discard.lastIndexOf(P.card); if (i >= 0) S.discard.splice(i, 1);
        q.hand.push(P.card); sortHand(q);
        log(S, { k: 'uncleanness', who: P.actor, from: P.from, card: P.card });
        S.pending = null; settle(S); break;
      }
      case 'give': removeOne(q.hand, a.card); S.players[P.target].hand.push(a.card); sortHand(S.players[P.target]); log(S, { k: 'give', who: P.actor, target: P.target, card: a.card }); S.pending = null; break;
      case 'take': { const g = S.players[P.from]; removeOne(g.hand, a.card); q.hand.push(a.card); sortHand(q); log(S, { k: 'take', who: P.actor, from: P.from, card: a.card }); S.pending = null; break; }
      case 'peaceDiscard': removeOne(q.hand, a.card); S.discard.push(a.card); log(S, { k: 'peaceDiscard', who: P.actor, card: a.card }); runPeace(S, P.queue); break;
    }
    return S;
  }

  switch (a.t) {
    case 'skip': p.patient = true; log(S, { k: 'skip', who }); nextTurn(S); return S;
    case 'draw': {
      const from = S.phase, card = take(S, a.from);
      log(S, { k: 'draw', who, from: a.from, card: a.from === 'discard' ? card : null });
      if (card === 'faithfulness') { S.held = card; S.resume = from === 'refill' ? 'refill' : 'draw1'; S.phase = 'faith'; return S; }
      p.hand.push(card); sortHand(p);
      if (from !== 'refill') S.phase = 'main';
      settle(S); return S;
    }
    case 'faith': {
      S.held = null; S.phase = S.resume;
      if (a.play) { place(S, p, 'faithfulness', 'faithfulness'); S.flags.joy = true; log(S, { k: 'play', who, card: 'faithfulness' }); checkWin(S); }
      else { S.discard.push('faithfulness'); log(S, { k: 'discard', who, card: 'faithfulness', drawn: true }); offer(S, 'uncl', who, { card: 'faithfulness' }); }
      return S;
    }
    case 'goodnessFail': S.flags.goodnessFailed = true; log(S, { k: 'goodness', who, ok: false }); return S;
    case 'handover': {
      const to = S.gentle; S.gentle = null; S.phase = 'main';
      if (!p.hand.length) { log(S, { k: 'gentle', who, target: to, empty: true }); return S; }
      log(S, { k: 'gentle', who, target: to });
      S.pending = { kind: 'take', actor: to, from: who }; return S;
    }
    case 'end': S.phase = 'refill'; settle(S); return S;
    case 'discard': discardCard(S, who, a.card); settle(S); return S;
    case 'play': {
      const c = a.card;
      removeOne(p.hand, c);
      if (c === 'joy') { place(S, p, 'joy', 'joy'); S.flags.joy = false; log(S, { k: 'play', who, card: c }); checkWin(S); return S; }
      const spot = c === 'wild' ? a.spot : c;
      place(S, p, spot, c);
      S.flags.fruit = true; S.flags.joy = true;
      log(S, { k: 'play', who, card: c, spot: c === 'wild' ? spot : null });
      if (c === 'goodness') log(S, { k: 'goodness', who, ok: true });
      if (c === 'love') { const n = redeem(S, S.players[a.target]); log(S, { k: 'love', who, target: a.target, n }); }
      else if (c === 'selfcontrol') {
        const hd = p.hand.filter(isDeed); p.hand = p.hand.filter((x) => !isDeed(x)); S.discard.push(...hd);
        const n = redeem(S, p); log(S, { k: 'selfcontrol', who, hand: hd.length, tree: n });
      }
      else if (c === 'peace') { log(S, { k: 'peace', who }); runPeace(S, [S.turn, ...others(S, S.turn)]); }
      else if (c === 'kindness') { log(S, { k: 'kindness', who, target: a.target, card: a.give }); removeOne(p.hand, a.give); offer(S, 'jealous', who, { target: a.target, give: a.give, spot: a.spot || null }); checkWin(S); }
      else if (c === 'gentleness') { S.phase = 'gentle'; S.gentle = a.target; }
      checkWin(S); settle(S); return S;
    }
    case 'deed': {
      const c = a.card;
      removeOne(p.hand, c); cover(S, p, a.cover, c); S.flags.deed = true;
      log(S, { k: 'deed', who, card: c, cover: a.cover });
      if (c === 'envy') {
        const t = S.players[a.target], slot = t.tree[a.spot], got = slot.wild ? 'wild' : a.spot;
        t.tree[a.spot] = { s: 0, d: null, wild: false }; p.hand.push(got); sortHand(p);
        log(S, { k: 'envy', who, target: a.target, card: got, spot: a.spot });
      } else if (c === 'revelry') {
        const i = S.discard.lastIndexOf(a.pick); S.discard.splice(i, 1); p.hand.push(a.pick); sortHand(p);
        log(S, { k: 'revelry', who, card: a.pick });
      } else if (c === 'rivalry') {
        const t = S.players[a.target], got = t.hand.splice(Math.floor(rand(S) * t.hand.length), 1)[0];
        p.hand.push(got); sortHand(p);
        log(S, { k: 'rivalry', who, target: a.target, card: got });
        S.pending = { kind: 'give', actor: who, target: a.target };
      }
      return S;
    }
  }
  throw new Error('unhandled action ' + a.t);
}

// A sentence saying why a card in hand cannot be played right now (for the page to show a player).
export function whyNot(S, seat, c) {
  const p = S.players[seat], F = S.flags || {};
  if (isDeed(c)) {
    if (c === 'jealousy') return 'Jealousy is played the moment an opponent plays Kindness. You do not wait for your turn.';
    if (c === 'uncleanness') return 'Uncleanness is played the moment another player discards a card you need. You do not wait for your turn.';
    if (F.deed) return 'You have already played a Deed card this turn.';
    if (!coverSpots(p).length) return 'A Deed covers one of your own Fruit cards, and you have none showing yet.';
    if (c === 'envy') return 'No opponent has a Fruit card showing to take.';
    if (c === 'rivalry') return 'No opponent has any cards in hand.';
    return 'This Deed cannot be played right now.';
  }
  if (c === 'faithfulness') return 'You cannot play Faithfulness from your hand. Play or discard it the moment you draw it. Hint: discard it last, then pick it up again from the discard pile.';
  if (c === 'joy') return F.joy ? 'Your Joy space is already full.' : 'Joy can only be played immediately after you play another Fruit card.';
  if (c === 'wild') return F.fruit ? 'You have already played a Fruit card this turn.' : 'A Wild card can only be played when you cannot play any other Fruit card.';
  if (F.fruit) return 'You have already played one Fruit card this turn (Joy and Faithfulness are the only extras).';
  if (p.tree[c].s === 1) return `${name(c)} is already showing on your Fruit Tree.`;
  if (c === 'love') return 'To play Love, an opponent must have at least one Deed card covering a fruit.';
  if (c === 'patience') return 'To play Patience, skip your turn first (no drawing, no discarding), then play it on your next turn.';
  if (c === 'kindness') return 'To play Kindness you must first play a card from your hand for an opponent: one they do not have showing.';
  if (c === 'goodness' && F.goodnessFailed) return 'You could not recite all nine fruit this turn.';
  return `${name(c)} cannot be played right now.`;
}
