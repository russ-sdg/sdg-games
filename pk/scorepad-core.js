// Prophets & Kings scorepad: the arithmetic, with no page in it. Players hold a count of sets of each length (7 down to 2 cards).
import { SCORES } from './play/js/engine.js';

export const SIZES = [7, 6, 5, 4, 3, 2];
export const MAX_PLAYERS = 6, MAX_SETS = 20;
export const points = (size) => SCORES[size] || 0;

export const newPlayer = (name) => ({ name, sets: Object.fromEntries(SIZES.map((n) => [n, 0])) });
export const newPad = (count = 2) => ({ v: 1, players: Array.from({ length: count }, (_, i) => newPlayer(`Player ${i + 1}`)) });

export const total = (p) => SIZES.reduce((n, size) => n + (p.sets[size] || 0) * points(size), 0);
export const cardCount = (p) => SIZES.reduce((n, size) => n + (p.sets[size] || 0) * size, 0);

// Add or remove one set of a size (never below 0 or above MAX_SETS). Returns a new pad.
export function step(pad, i, size, delta) {
  const next = structuredClone(pad), p = next.players[i];
  if (!p || !SIZES.includes(size)) return pad;
  p.sets[size] = Math.max(0, Math.min(MAX_SETS, (p.sets[size] || 0) + delta));
  return next;
}
export function addPlayer(pad) {
  if (pad.players.length >= MAX_PLAYERS) return pad;
  const next = structuredClone(pad); next.players.push(newPlayer(`Player ${pad.players.length + 1}`)); return next;
}
export function removePlayer(pad, i) {
  if (pad.players.length <= 1) return pad;
  const next = structuredClone(pad); next.players.splice(i, 1); return next;
}
export const resetScores = (pad) => ({ ...structuredClone(pad), players: pad.players.map((p) => newPlayer(p.name)) });

// Standings: rank 1 for the top total, equal totals share a rank. `leaders` is true only once somebody has scored.
export function standings(pad) {
  const rows = pad.players.map((p, i) => ({ i, name: p.name, total: total(p) })).sort((a, b) => b.total - a.total || a.i - b.i);
  rows.forEach((r) => { r.rank = 1 + rows.filter((o) => o.total > r.total).length; r.leader = r.rank === 1 && r.total > 0; });
  return rows;
}

// A saved pad that is not what we expect is dropped rather than half-trusted.
export function sanitize(v) {
  if (!v || v.v !== 1 || !Array.isArray(v.players) || !v.players.length || v.players.length > MAX_PLAYERS) return null;
  return {
    v: 1,
    players: v.players.map((p, i) => {
      const out = newPlayer(String((p && p.name) || `Player ${i + 1}`).slice(0, 24));
      for (const size of SIZES) { const n = Number(p && p.sets && p.sets[size]); out.sets[size] = Number.isInteger(n) ? Math.max(0, Math.min(MAX_SETS, n)) : 0; }
      return out;
    }),
  };
}

export function summary(pad) {
  const rows = standings(pad);
  return `Prophets & Kings scores: ${rows.map((r) => `${r.name} ${r.total}`).join(', ')}.`;
}
