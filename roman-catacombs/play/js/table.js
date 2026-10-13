// Roman Catacombs: playing against computer librarians. Everyone sees the same three cards each round and picks at the
// same time; the human places while the round is open, the computers place when the round is resolved.
import { CATS, DECK, SLOTS } from './books.js';
import * as E from './engine.js';
import { chooseMove, SKILLS } from './bot.js';

export const BOT_NAMES = ['Ruth', 'Timothy', 'Lydia', 'Silas', 'Priscilla'];
export const MAX_BOTS = BOT_NAMES.length;
export const MAX_ROUNDS = 120;                                      // a safety net; real games end far sooner

export function newTable({ bots = 2, skill = 'steady', seed = 1 } = {}) {
  const n = Math.max(1, Math.min(MAX_BOTS, bots));
  return E.newState({ mode: E.MODES.bots, seed, rivals: BOT_NAMES.slice(0, n).map((name) => ({ name, skill })) });
}

// The three cards flipped in a round (1-based). Round 1-30 use the shuffled deck; after that the deck is reshuffled.
export function trayAt(seed, round) {
  const pass = Math.floor(((round - 1) * 3) / DECK.length), at = ((round - 1) * 3) % DECK.length;
  return E.shuffled(DECK, pass === 0 ? seed : seed + pass * 7919).slice(at, at + 3);
}

const view = (state, r) => ({ mode: E.MODES.bots, library: r.library, claims: r.claims, taken: r.taken, over: false });
const emptyAnywhere = (p) => p.library.some((b, s) => b === null && E.slotOptions(p, s).length > 0);
const full = (p) => p.library.every((b) => b !== null);

// Why the game would end now, or null.
export function endReason(state) {
  const all = [state, ...state.rivals];
  if (all.some(full)) return 'complete';
  if (!all.some(emptyAnywhere)) return 'stuck';
  if (state.round >= MAX_ROUNDS) return 'long';
  return null;
}

const note = (s, text) => { s.log.push({ round: s.round, text }); if (s.log.length > 80) s.log.shift(); };

// Close the round (the computers place) and deal the next three cards, or end the game.
export function flipRound(state) {
  if (state.mode !== E.MODES.bots) throw new Error('only against computer opponents');
  if (state.over) throw new Error('game over');
  const s = structuredClone(state);
  if (s.round > 0) {
    const rand = E.rng(s.seed * 31 + s.round);
    const tray = s.tray.map((id) => E.trayBook(id));
    s.rivals.forEach((r) => {
      const p = view(s, r);
      p.taken = { ...s.completed };                                  // categories finished in EARLIER rounds only
      const mv = chooseMove(p, tray, r.skill, rand);
      if (!mv) { note(s, `${r.name} passes.`); return; }
      const q = E.place(p, mv.slot, mv.book);
      r.library = q.library; r.claims = q.claims;
      note(s, `${r.name} adds ${E.bookName(mv.book)}.`);
    });
    CATS.forEach((c, ci) => {                                       // who completed what this round
      if (s.completed[c.id]) return;
      const who = [['You', s], ...s.rivals.map((r) => [r.name, r])].filter(([, p]) => E.isComplete(p, ci));
      if (!who.length) return;
      s.completed[c.id] = true;
      note(s, `${who.map(([n]) => n).join(' and ')} ${who.length > 1 ? 'complete' : 'completes'} ${c.label} first!`);
    });
    s.taken = { ...s.completed };
    s.rivals.forEach((r) => { r.taken = { ...s.completed }; });
  }
  const why = endReason(s);
  if (why) { s.over = true; s.endReason = why; s.tray = []; s.placedThisRound = null; return s; }
  s.round += 1;
  s.tray = trayAt(s.seed, s.round);
  s.placedThisRound = null;
  return s;
}

// Everyone's result, best first (you win ties).
export function standings(state) {
  const rows = [{ name: 'You', you: true, p: state }, ...state.rivals.map((r) => ({ name: r.name, you: false, skill: r.skill, p: view(state, r) }))]
    .map((x) => ({ ...x, ...E.score(x.p), filledSlots: SLOTS - E.score(x.p).empty }));
  return rows.sort((a, b) => b.total - a.total || Number(b.you) - Number(a.you));
}
export const skillName = (k) => (SKILLS[k] || SKILLS.steady).name;
