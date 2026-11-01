// Prophets & Kings: the rules, as pure functions on a plain (JSON-safe) state object. No DOM. The shuffle uses the game's seed.
//
// A turn:
//   draw     take cards, one at a time, from the draw pile, the top of any discard pile or (blind) another player's hand,
//            until you hold 7 (you may take several from one place)
//   play     start sets (a prophet with a king who matches him) and add matching cards to sets you already have
//   discard  if you hold more than 5, discard down to 5, face-up onto any discard pile. That ends the turn.
// The game ends when the last card is taken from the draw pile; the player who took it finishes their turn.
import { PROPHETS, KINGS } from './deck-data.js';

export const HAND_TARGET = 7, HAND_KEEP = 5, PILES = 4, MAX_ROUNDS = 80;
export const SCORES = { 2: 2, 3: 5, 4: 10, 5: 25, 6: 50, 7: 100 };
export const setScore = (n) => SCORES[n] || 0;
const clone = (s) => structuredClone(s);

// ---- the deck ----------------------------------------------------------------------------------------------------------------
// DEFS[uid] = { name, kind: 'prophet' | 'king', group, slug, pic }. A uid is a card's place in the box; the same name has several.
export const DEFS = [];
export const COPIES = {};                      // name -> copies in the box
const PAIRS = new Set();                       // "Prophet|King"
const MATCHES = {};                            // name -> the names it matches
for (const [name, copies, pics, slug, kings] of PROPHETS) {
  for (let i = 0; i < copies; i++) DEFS.push({ name, kind: 'prophet', group: 'prophets', slug, pic: Math.min(i + 1, pics) });
  COPIES[name] = copies; MATCHES[name] = [...kings];
  for (const k of kings) { PAIRS.add(`${name}|${k}`); (MATCHES[k] = MATCHES[k] || []).push(name); }
}
for (const [name, copies, pics, slug, group] of KINGS) {
  for (let i = 0; i < copies; i++) DEFS.push({ name, kind: 'king', group, slug, pic: Math.min(i + 1, pics) });
  COPIES[name] = copies;
}
export const DECK_SIZE = DEFS.length;
export const matchesOf = (name) => MATCHES[name] || [];
export const namesMatch = (a, b) => PAIRS.has(`${a}|${b}`) || PAIRS.has(`${b}|${a}`);
export const match = (u, v) => namesMatch(DEFS[u].name, DEFS[v].name);
export const label = (uid) => DEFS[uid].name;
export const cardImage = (uid, w = 320) => `../../assets/pk-web/cards/${DEFS[uid].slug}-${DEFS[uid].pic}-${w}.webp`;
export const backImage = (w = 320) => `../../assets/pk-web/cards/back-${w}.webp`;

export function rng(seed) {                    // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffled(list, seed) {
  const r = rng(seed), a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---- sets --------------------------------------------------------------------------------------------------------------------
// A set is { head, members: [uid] }: the head is the card on top; every member matches the head, and no name appears twice.
export const setCards = (set) => [set.head, ...set.members];
export const setLength = (set) => 1 + set.members.length;
export const setNames = (set) => setCards(set).map(label);
export const canAdd = (set, uid) => match(set.head, uid) && !setNames(set).includes(label(uid));
export const totalScore = (p) => p.sets.reduce((n, st) => n + setScore(setLength(st)), 0);

// ---- new game ----------------------------------------------------------------------------------------------------------------
// players: [{ name, bot, skill }] (2 to 6). `first` is the seat that goes first.
export function newGame({ seed = 1, players, first = 0 } = {}) {
  if (!players || players.length < 2 || players.length > 6) throw new Error('2 to 6 players');
  const s = {
    v: 1, seed, round: 1, first, turn: first, phase: 'draw', over: false, endedBy: null, ending: false,
    players: players.map((p) => ({ name: p.name, bot: !!p.bot, skill: p.skill || null, hand: [], sets: [], score: 0, known: [] })),
    draw: shuffled(DEFS.map((_, i) => i), seed),
    piles: Array.from({ length: PILES }, () => []),
    log: [], last: null,
  };
  for (let i = 0; i < HAND_KEEP; i++) for (const p of s.players) p.hand.push(s.draw.pop());
  for (let i = 0; i < PILES; i++) s.piles[i].push(s.draw.pop());
  return s;
}

export const me = (s) => s.players[s.turn];
const say = (t, who, text, extra = {}) => { t.last = { who, text, ...extra }; t.log.push(text); if (t.log.length > 200) t.log.shift(); };
const drop = (list, uid) => { const i = list.indexOf(uid); if (i >= 0) list.splice(i, 1); };

// ---- drawing -----------------------------------------------------------------------------------------------------------------
// Where the player to move may take a card from right now.
export function sources(s) {
  if (s.over || s.phase !== 'draw') return [];
  const out = [];
  if (s.draw.length) out.push({ from: 'deck', n: s.draw.length });
  s.piles.forEach((p, i) => { if (p.length) out.push({ from: 'pile', i, uid: p[p.length - 1], n: p.length }); });
  s.players.forEach((q, j) => { if (j !== s.turn && q.hand.length) out.push({ from: 'hand', p: j, n: q.hand.length }); });
  return out;
}

// Take one card. src: { from: 'deck' } | { from: 'pile', i } | { from: 'hand', p }. `r` picks the blind card from a hand.
export function take(s, src, r = Math.random) {
  if (s.over || s.phase !== 'draw') throw new Error('not drawing');
  const t = clone(s), p = me(t);
  let uid, text;
  if (src.from === 'deck') {
    if (!t.draw.length) throw new Error('the draw pile is empty');
    uid = t.draw.pop(); text = `${p.name} takes a card from the draw pile.`;
  } else if (src.from === 'pile') {
    const pile = t.piles[src.i];
    if (!pile || !pile.length) throw new Error('that discard pile is empty');
    uid = pile.pop(); p.known.push(uid); text = `${p.name} takes ${label(uid)} from discard pile ${src.i + 1}.`;
  } else if (src.from === 'hand') {
    const v = t.players[src.p];
    if (!v || src.p === t.turn || !v.hand.length) throw new Error('nothing to take there');
    uid = v.hand.splice(Math.floor(r() * v.hand.length), 1)[0]; drop(v.known, uid);
    text = `${p.name} takes a card from ${v.name}'s hand.`;
  } else throw new Error('unknown source');
  p.hand.push(uid);
  for (const pile of t.piles) if (!pile.length && t.draw.length) pile.push(t.draw.pop());      // an emptied discard pile is refilled at once
  if (!t.draw.length) t.ending = true;                                                         // the last card has been taken
  if (p.hand.length >= HAND_TARGET || !sources({ ...t, phase: 'draw' }).length) t.phase = 'play';
  say(t, t.turn, text, { type: 'take', src: src.from, uid: src.from === 'pile' ? uid : null });
  return t;
}

// ---- playing -----------------------------------------------------------------------------------------------------------------
function needPlay(s) { if (s.over || s.phase !== 'play') throw new Error('not playing'); }

// Start a set: `head` goes on top, `member` behind it.
export function startSet(s, head, member) {
  needPlay(s);
  const t = clone(s), p = me(t);
  if (!p.hand.includes(head) || !p.hand.includes(member) || head === member) throw new Error('those cards are not in your hand');
  if (!match(head, member)) throw new Error(`${label(head)} and ${label(member)} do not match`);
  drop(p.hand, head); drop(p.hand, member); drop(p.known, head); drop(p.known, member);
  p.sets.push({ head, members: [member] }); p.score = totalScore(p);
  say(t, t.turn, `${p.name} starts a set: ${label(head)} with ${label(member)} (${setScore(2)} points).`, { type: 'start', set: p.sets.length - 1 });
  return t;
}

// Add a card to a set you already have.
export function addTo(s, setIndex, uid) {
  needPlay(s);
  const t = clone(s), p = me(t), st = p.sets[setIndex];
  if (!st) throw new Error('no such set');
  if (!p.hand.includes(uid)) throw new Error('that card is not in your hand');
  if (!canAdd(st, uid)) throw new Error(`${label(uid)} cannot be added to ${label(st.head)}'s set`);
  const before = setScore(setLength(st));
  drop(p.hand, uid); drop(p.known, uid); st.members.push(uid); p.score = totalScore(p);
  const gain = setScore(setLength(st)) - before;
  say(t, t.turn, `${p.name} adds ${label(uid)} to the ${label(st.head)} set: now ${setLength(st)} cards, +${gain} points.`, { type: 'add', set: setIndex, uid });
  return t;
}

// Every legal play for the player to move: cards that can join a set they own, and pairs that can start one.
export function plays(s) {
  const p = me(s), adds = [], starts = [];
  p.hand.forEach((u) => p.sets.forEach((st, i) => { if (canAdd(st, u)) adds.push({ uid: u, set: i }); }));
  for (let a = 0; a < p.hand.length; a++) for (let b = a + 1; b < p.hand.length; b++) if (match(p.hand[a], p.hand[b])) starts.push([p.hand[a], p.hand[b]]);
  return { adds, starts };
}

// ---- finishing the turn ------------------------------------------------------------------------------------------------------
export const mustDiscard = (s) => s.phase === 'play' && me(s).hand.length > HAND_KEEP;

// Discard one card onto a discard pile (only while holding more than 5). Getting down to 5 ends the turn.
export function discard(s, uid, pile) {
  needPlay(s);
  if (!mustDiscard(s)) throw new Error('you only discard down to 5');
  if (!(pile >= 0 && pile < PILES)) throw new Error('no such pile');
  const t = clone(s), p = me(t);
  if (!p.hand.includes(uid)) throw new Error('that card is not in your hand');
  drop(p.hand, uid); drop(p.known, uid); t.piles[pile].push(uid);
  say(t, t.turn, `${p.name} discards ${label(uid)} onto pile ${pile + 1}.`, { type: 'discard', pile, uid });
  return p.hand.length <= HAND_KEEP ? finishTurn(t) : t;
}

// End the turn without discarding (only when holding 5 or fewer).
export function endTurn(s) {
  needPlay(s);
  if (mustDiscard(s)) throw new Error('discard down to 5 first');
  return finishTurn(clone(s));
}

function finishTurn(t) {
  if (t.ending) { t.over = true; t.endedBy = 'draw'; t.phase = 'over'; return t; }
  t.turn = (t.turn + 1) % t.players.length;
  if (t.turn === t.first) t.round++;
  if (t.round > MAX_ROUNDS) { t.over = true; t.endedBy = 'rounds'; t.phase = 'over'; return t; }
  t.phase = 'draw';
  if (!sources(t).length) t.phase = 'play';
  return t;
}

// ---- results -----------------------------------------------------------------------------------------------------------------
export function winners(s) {
  const top = Math.max(...s.players.map((p) => p.score));
  return s.players.map((p, i) => (p.score === top ? i : -1)).filter((i) => i >= 0);
}

// How many copies of a card (by name) have not been played in anyone's set yet.
export function outstanding(s, name) {
  let n = COPIES[name];
  for (const p of s.players) for (const st of p.sets) for (const u of setCards(st)) if (label(u) === name) n--;
  return n;
}
