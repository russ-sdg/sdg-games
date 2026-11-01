// Computer-only games, to see how the skills compare: node pk/play/tools/sim.mjs [games] [players]
// Seats rotate so no skill always sits first. Prints the average score and win share of each skill.
import * as E from '../js/engine.js';
import * as AI from '../js/ai.js';

const games = Number(process.argv[2]) || 100, n = Number(process.argv[3]) || 3, skills = ['casual', 'steady', 'sharp'];
const mulberry = (a) => () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const tally = Object.fromEntries(skills.map((k) => [k, { pts: 0, seats: 0, wins: 0 }]));
let turns = 0, capped = 0;
for (let g = 0; g < games; g++) {
  const players = Array.from({ length: n }, (_, i) => ({ name: 'P' + i, bot: true, skill: skills[(i + g) % 3] }));
  let s = E.newGame({ seed: 1000 + g, players, first: g % n }); const r = mulberry(g + 7);
  while (!s.over) { s = AI.turn(s, r); turns++; }
  if (s.endedBy === 'rounds') capped++;
  s.players.forEach((p, i) => { const t = tally[p.skill]; t.pts += p.score; t.seats++; if (E.winners(s).includes(i)) t.wins += 1 / E.winners(s).length; });
}
console.log(`${games} games, ${n} players, ${(turns / games / n).toFixed(1)} turns each, ${capped} hit the round limit`);
for (const k of skills) { const t = tally[k]; console.log(k.padEnd(7), 'avg', (t.pts / t.seats).toFixed(1).padStart(6), ' wins', ((100 * t.wins) / t.seats).toFixed(0) + '%'); }
