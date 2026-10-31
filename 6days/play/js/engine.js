// Six Days: the rules, as pure functions on a plain (JSON-safe) state object. No DOM. The shuffles use the game's seed, so a saved game
// resumes exactly.
//
// A turn: draw (the draw pile or the top of any discard pile) -> play or discard one card -> the turn ends.
//   start    play the next unplayed day's card (a Day 2 card next to Day 1)                       2 points
//   add      play a day card on its own day's stack or a later one that is started, open and not full   1 point if that kind is already on the stack, else 2
//   close    play an Evening & Morning card on a full stack that has none                          the day's number
//   discard  put any card face-up on one of the three discard piles                                0 points
// The game ends the moment all six stacks hold their full number of day cards.
import { DAY_CARDS, EM_CARD, EM_COPIES } from './deck-data.js';

export const DAYS = [
  { n: 1, name: 'Light', color: '#a85a05' }, { n: 2, name: 'Sky', color: '#2a6fa8' }, { n: 3, name: 'Earth, Seas, and Plants', color: '#2f7d46' },
  { n: 4, name: 'Sun, Moon, Stars', color: '#2a3490' }, { n: 5, name: 'Birds and Fish', color: '#0b7777' }, { n: 6, name: 'Animals and Mankind', color: '#8e4a3d' },
];
export const HAND = 2, PILES = 3, MAX_RESHUFFLES = 3, MAX_ROUNDS = 80;
const clone = (s) => structuredClone(s);

// ---- the deck ----------------------------------------------------------------------------------------------------------------
// uid 0 is the Day 1 card; uids 1..39 the other Day cards; uids 40..45 the Evening & Morning cards.
export const DEFS = [
  ...DAY_CARDS.map((c) => ({ kind: 'day', day: c.day, name: c.name, id: c.id })),
  ...Array.from({ length: EM_COPIES }, () => ({ kind: 'em', day: 0, name: EM_CARD.name, id: EM_CARD.id })),
];
export const label = (uid) => (DEFS[uid].kind === 'em' ? 'Evening & Morning' : `${DEFS[uid].name} (Day ${DEFS[uid].day})`);

export function rng(seed) {                     // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffled(list, seed) {
  const r = rng(seed), a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---- new game ----------------------------------------------------------------------------------------------------------------
// players: [{ name, bot, skill }] (2 to 6). Seat 0 goes first (the youngest player, in the box rules).
export function newGame({ seed = 1, players } = {}) {
  if (!players || players.length < 2 || players.length > 6) throw new Error('2 to 6 players');
  const s = {
    v: 1, seed, round: 1, turn: 0, phase: 'draw', drawn: null, over: false, endedBy: null, reshuffles: 0, started: 1,
    players: players.map((p) => ({ name: p.name, bot: !!p.bot, skill: p.skill || null, hand: [], score: 0 })),
    draw: shuffled(DEFS.map((_, i) => i).filter((i) => i !== 0), seed),
    piles: [[], [], []],
    stacks: DAYS.map(() => ({ cards: [], em: null })),
    log: [], last: null,
  };
  s.stacks[0].cards.push(0);                                   // Day 1 starts face-up in the middle (it needs only the one card)
  for (const p of s.players) for (let i = 0; i < HAND; i++) p.hand.push(s.draw.pop());
  for (let i = 0; i < PILES; i++) s.piles[i].push(s.draw.pop());
  return s;
}

export const me = (s) => s.players[s.turn];
export const isFull = (s, i) => s.stacks[i].cards.length >= i + 1;
export const isClosed = (s, i) => s.stacks[i].em !== null;
export const allFull = (s) => s.stacks.every((_, i) => isFull(s, i));
export const stackKinds = (s, i) => s.stacks[i].cards.map((u) => DEFS[u].name);

// ---- what a card may do -------------------------------------------------------------------------------------------------------
// Returns the legal plays for one card in the current player's hand: { type, stack | pile, pts }.
export function moves(s, uid) {
  const d = DEFS[uid], out = [];
  if (d.kind === 'day') {
    if (d.day === s.started + 1 && s.started < 6) out.push({ type: 'start', stack: s.started, pts: 2 });
    for (let i = d.day - 1; i < s.started; i++) {
      if (isClosed(s, i) || isFull(s, i)) continue;
      out.push({ type: 'add', stack: i, pts: stackKinds(s, i).includes(d.name) ? 1 : 2 });
    }
  } else {
    for (let i = 0; i < s.started; i++) if (isFull(s, i) && !isClosed(s, i)) out.push({ type: 'close', stack: i, pts: i + 1 });
  }
  for (let p = 0; p < PILES; p++) out.push({ type: 'discard', pile: p, pts: 0 });
  return out;
}

// ---- a turn --------------------------------------------------------------------------------------------------------------------
// src: 'deck' or a pile number 0..2.
export function draw(state, src) {
  if (state.over || state.phase !== 'draw') throw new Error('not time to draw');
  const s = clone(state), p = me(s);
  let uid;
  if (src === 'deck') { if (!s.draw.length) throw new Error('the draw pile is empty'); uid = s.draw.pop(); }
  else { if (!s.piles[src] || !s.piles[src].length) throw new Error('that pile is empty'); uid = s.piles[src].pop(); }
  p.hand.push(uid);
  s.drawn = { uid, from: src };
  s.phase = 'play';
  return s;
}

export function play(state, uid, move) {
  if (state.over || state.phase !== 'play') throw new Error('not time to play');
  const s = clone(state), p = me(s);
  if (!p.hand.includes(uid)) throw new Error('that card is not in your hand');
  const ok = moves(s, uid).find((m) => m.type === move.type && m.stack === move.stack && m.pile === move.pile);
  if (!ok) throw new Error('illegal move');
  p.hand.splice(p.hand.indexOf(uid), 1);
  const d = DEFS[uid];
  const rec = { who: s.turn, round: s.round, drew: s.drawn, uid, type: ok.type, stack: ok.stack, pile: ok.pile, pts: ok.pts };
  if (ok.type === 'start') { s.stacks[ok.stack].cards.push(uid); s.started += 1; }
  else if (ok.type === 'add') s.stacks[ok.stack].cards.push(uid);
  else if (ok.type === 'close') s.stacks[ok.stack].em = uid;
  else s.piles[ok.pile].push(uid);
  p.score += ok.pts;
  rec.text = describe(s, rec, d);
  s.log.push(rec); if (s.log.length > 60) s.log.shift();
  s.last = rec;
  if (allFull(s)) { s.over = true; s.endedBy = 'complete'; s.phase = 'over'; return s; }
  return endTurn(s);
}

function describe(s, r, d) {
  const who = s.players[r.who].name, nm = d.kind === 'em' ? 'an Evening & Morning card' : `${d.name}`;
  if (r.type === 'discard') return `${who} discarded ${nm}.`;
  if (r.type === 'close') return `${who} closed Day ${r.stack + 1} with ${nm}: ${r.pts} point${r.pts === 1 ? '' : 's'}.`;
  if (r.type === 'start') return `${who} started Day ${r.stack + 1} with ${nm}: ${r.pts} points.`;
  return `${who} added ${nm} to Day ${r.stack + 1}: ${r.pts} point${r.pts === 1 ? '' : 's'}.`;
}

// Empty discard piles are refilled from the top of the draw pile; when the draw pile has run out the discards are shuffled back in
// (a few times only: if the game still cannot finish, it ends and the points stand).
function endTurn(s) {
  s.drawn = null;
  for (const pile of s.piles) if (!pile.length && s.draw.length) pile.push(s.draw.pop());
  if (!s.draw.length && s.piles.some((pile) => pile.length > 1)) {
    if (s.reshuffles >= MAX_RESHUFFLES) { s.over = true; s.endedBy = 'stalled'; s.phase = 'over'; return s; }
    const back = [];
    for (const pile of s.piles) while (pile.length > 1) back.push(pile.shift());
    s.reshuffles += 1; s.draw = shuffled(back, s.seed + 100 * s.reshuffles);
  }
  s.turn = (s.turn + 1) % s.players.length;
  if (s.turn === 0) s.round += 1;
  if (s.round > MAX_ROUNDS) { s.over = true; s.endedBy = 'stalled'; s.phase = 'over'; return s; }
  s.phase = 'draw';
  return s;
}

// ---- results ---------------------------------------------------------------------------------------------------------------------
export function winners(s) {
  const best = Math.max(...s.players.map((p) => p.score));
  return s.players.map((p, i) => (p.score === best ? i : -1)).filter((i) => i >= 0);
}
export const fullCount = (s) => s.stacks.filter((_, i) => isFull(s, i)).length;
