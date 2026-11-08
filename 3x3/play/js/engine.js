// Three-by-Three: the rules as pure functions on plain JSON state (so a saved game resumes).
// A card is just its tribe's number, 1 to 13, in the order the tribes set out (there are three of each; Levi is 7).
// Every hand is kept sorted low to high, so a hand's "index" is its position in that order.

export const TRIBES = [null, 'Judah', 'Issachar', 'Zebulun', 'Reuben', 'Simeon', 'Gad', 'Levi', 'Ephraim', 'Manasseh', 'Benjamin', 'Dan', 'Asher', 'Naphtali'];
export const LEVI = 7, HAND = 3, COLS = 3, SETS_TO_WIN = 3, ROUND_LIMIT = 250;
export const name = (v) => TRIBES[v];
export const cardImage = (v, w = 320) => `../../assets/3x3-web/cards/${v ? TRIBES[v].toLowerCase() : 'back'}-${w}.webp`;
export const backImage = (w = 320) => cardImage(0, w);

export function rng(seed) {                                    // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clone = (s) => structuredClone(s);
const byValue = (a, b) => a - b;

// ---- setting up -----------------------------------------------------------------------------------------------------------------
export function newGame({ seed = 1, players, first = 0 }) {
  const r = rng(seed), deck = [];
  for (let v = 1; v <= 13; v++) deck.push(v, v, v);
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const S = {
    v: 1, seed, turn: first % players.length, round: 1, over: false, winners: [], endedBy: null,
    players: players.map((p) => ({ name: p.name, bot: !!p.bot, skill: p.skill || null, hand: deck.splice(0, HAND).sort(byValue), sets: [] })),
    matrix: deck.splice(0, 9), draw: deck,
    reveals: [], outcome: null,                                // this turn's revealed cards; outcome is null | 'miss' | 'set'
    know: players.map(() => ({})),                             // what each player has seen and still remembers: {"h:p:idx": v, "c:cell": v}
    log: [],
  };
  settle(S);
  return S;
}

export const me = (S) => S.players[S.turn];

// ---- looking at what can be revealed --------------------------------------------------------------------------------------------
const revealedIdx = (S, p) => S.reveals.filter((x) => x.kind === 'hand' && x.p === p).map((x) => x.idx);
const revealedCell = (S, i) => S.reveals.some((x) => x.kind === 'cell' && x.i === i);

// The highest and lowest cards in a hand that have not been shown yet this turn: { hi: idx|null, lo: idx|null }
export function ends(S, p) {
  const gone = new Set(revealedIdx(S, p)), left = S.players[p].hand.map((_, i) => i).filter((i) => !gone.has(i));
  return { hi: left.length ? left[left.length - 1] : null, lo: left.length ? left[0] : null };
}
// Everything the player to move may do next.
export function actions(S) {
  if (S.over || S.outcome || S.reveals.length >= 3) return [];
  const out = [];
  S.players.forEach((pl, p) => {
    const e = ends(S, p);
    if (e.hi !== null) out.push({ kind: 'hand', p, which: 'hi', idx: e.hi });
    if (e.lo !== null && e.lo !== e.hi) out.push({ kind: 'hand', p, which: 'lo', idx: e.lo });
  });
  S.matrix.forEach((v, i) => { if (v !== null && !revealedCell(S, i)) out.push({ kind: 'cell', i }); });
  return out;
}
export const valueAt = (S, a) => (a.kind === 'cell' ? S.matrix[a.i] : S.players[a.p].hand[a.idx]);
const keyOf = (a) => (a.kind === 'cell' ? `c:${a.i}` : `h:${a.p}:${a.idx}`);
export { keyOf };

// ---- a turn -----------------------------------------------------------------------------------------------------------------------
// Reveal one card. After two cards that differ, or three cards, the turn is decided (outcome 'miss' or 'set') and waits for endTurn.
export function reveal(S0, a) {
  const S = clone(S0);
  const ok = actions(S).find((x) => x.kind === a.kind && (a.kind === 'cell' ? x.i === a.i : x.p === a.p && (a.idx !== undefined ? x.idx === a.idx : x.which === a.which)));
  if (!ok) throw new Error('That card cannot be shown now.');
  const v = valueAt(S, ok), who = S.turn;
  S.reveals.push({ ...ok, v });
  S.know.forEach((k, seat) => { if (!(ok.kind === 'hand' && ok.p === seat)) k[keyOf(ok)] = v; });    // everyone sees it; its owner already knows it
  log(S, ok.kind === 'cell' ? { t: 'flip', who, cell: ok.i, v } : { t: 'ask', who, from: ok.p, which: ok.which, v });
  const R = S.reveals;
  if (R.length === 2 && R[0].v !== R[1].v) S.outcome = 'miss';
  else if (R.length === 3) S.outcome = R[2].v === R[0].v ? 'set' : 'miss';
  return S;
}
export const matching = (S) => S.reveals.length >= 2 && S.reveals.every((x) => x.v === S.reveals[0].v);

// Close the turn: take a found set (and refill), or put every card back; then check for the end and pass the turn on.
export function endTurn(S0) {
  const S = clone(S0), who = S.turn, pl = S.players[who];
  if (S.outcome === 'set') {
    const v = S.reveals[0].v, hands = new Set();
    for (const x of S.reveals) {
      if (x.kind === 'cell') S.matrix[x.i] = null;
      else hands.add(x.p);
    }
    for (const p of hands) {
      const gone = S.reveals.filter((x) => x.kind === 'hand' && x.p === p).map((x) => x.idx).sort((a, b) => b - a);
      for (const i of gone) S.players[p].hand.splice(i, 1);
    }
    pl.sets.push(v);
    // Anyone short of three cards draws, then the matrix holes are filled.
    S.players.forEach((q, p) => { if (hands.has(p)) { while (q.hand.length < HAND && S.draw.length) q.hand.push(S.draw.pop()); q.hand.sort(byValue); } });
    S.matrix.forEach((c, i) => { if (c === null && S.draw.length) S.matrix[i] = S.draw.pop(); });
    // What was remembered about changed hands and cells is no longer true.
    S.know.forEach((k) => { for (const key of Object.keys(k)) { const [t, a] = key.split(':'); if ((t === 'h' && hands.has(Number(a))) || (t === 'c' && S.reveals.some((x) => x.kind === 'cell' && x.i === Number(a)))) delete k[key]; } });
    log(S, { t: 'set', who, v });
    if (v === LEVI) return finish(S, [who], 'levi');
    if (pl.sets.length >= SETS_TO_WIN) return finish(S, [who], 'sets');
  } else {
    log(S, { t: 'miss', who });
  }
  S.reveals = []; S.outcome = null;
  if (S.round >= ROUND_LIMIT && (S.turn + 1) % S.players.length === S.start) return finish(S, mostSets(S), 'limit');
  S.turn = (S.turn + 1) % S.players.length;
  if (S.turn === S.start) S.round++;
  return settle(S);
}

// If no tribe has all three of its cards in play, three more go into the matrix (or the game ends if there are none left).
function settle(S) {
  if (S.start === undefined) S.start = S.turn;
  for (;;) {
    if (inPlayTribes(S).length) return S;
    if (!S.draw.length) return finish(S, mostSets(S), 'stalemate');
    const n = Math.min(3, S.draw.length);
    for (let i = 0; i < n; i++) S.matrix.push(S.draw.pop());
    log(S, { t: 'more', n, size: S.matrix.filter((c) => c !== null).length });
  }
}
// Tribes whose three cards can all be turned over this turn. They must be in hands or the matrix, and a hand's middle card
// cannot be reached on its own (you would have to show a different card first), so a tribe whose copy in a three-card hand
// is only the middle one is not in play.
export function inPlayTribes(S) {
  const n = {};
  for (const pl of S.players) for (const v of pl.hand) n[v] = (n[v] || 0) + 1;
  for (const v of S.matrix) if (v !== null) n[v] = (n[v] || 0) + 1;
  const buried = (v) => S.players.some((pl) => pl.hand.length === 3 && pl.hand[1] === v && pl.hand[0] !== v && pl.hand[2] !== v);
  return Object.keys(n).map(Number).filter((v) => n[v] === 3 && !buried(v));
}
function mostSets(S) {
  const best = Math.max(...S.players.map((p) => p.sets.length));
  return S.players.map((p, i) => (p.sets.length === best ? i : -1)).filter((i) => i >= 0);
}
function finish(S, winners, endedBy) { S.over = true; S.winners = winners; S.endedBy = endedBy; S.reveals = []; S.outcome = null; return S; }
function log(S, e) { S.log.push(e); if (S.log.length > 80) S.log.splice(0, S.log.length - 80); }
