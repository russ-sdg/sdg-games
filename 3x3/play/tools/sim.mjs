// Computer-only games, to see how the skills compare: node 3x3/play/tools/sim.mjs [games] [players]
// Seats rotate so no skill always sits first. Prints the average sets and win share of each skill, and how games ended.
import * as E from '../js/engine.js';
import * as AI from '../js/ai.js';

const games = Number(process.argv[2]) || 200, n = Number(process.argv[3]) || 3, skills = ['casual', 'steady', 'sharp'];
const tally = Object.fromEntries(skills.map((k) => [k, { sets: 0, seats: 0, wins: 0 }]));
const ended = {}; let rounds = 0;
for (let g = 0; g < games; g++) {
  const players = Array.from({ length: n }, (_, i) => ({ name: 'P' + i, bot: true, skill: skills[(i + g) % 3] }));
  let s = E.newGame({ seed: 5000 + g, players, first: g % n }); const r = E.rng(g + 77);
  while (!s.over) s = AI.playTurn(s, s.players[s.turn].skill, r);
  ended[s.endedBy] = (ended[s.endedBy] || 0) + 1; rounds += s.round;
  s.players.forEach((p, i) => { const t = tally[p.skill]; t.sets += p.sets.length; t.seats++; if (s.winners.includes(i)) t.wins += 1 / s.winners.length; });
}
console.log(`${games} games, ${n} players, ${(rounds / games).toFixed(1)} rounds on average; ended by`, ended);
for (const k of skills) { const t = tally[k]; console.log(k.padEnd(7), 'avg sets', (t.sets / t.seats).toFixed(2), ' wins', ((100 * t.wins) / t.seats).toFixed(0) + '%'); }
