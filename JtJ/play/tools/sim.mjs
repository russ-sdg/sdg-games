// Computer-only games, to check they finish and that the skill levels are ordered:
//   node tools/sim.mjs [games=100] [players=3] [skill=mixed|casual|steady|sharp]
import * as E from '../js/engine.js';
import * as AI from '../js/ai.js';

const games = Number(process.argv[2]) || 100, n = Number(process.argv[3]) || 3, mode = process.argv[4] || 'mixed';
const COLORS = ['R', 'B', 'T', 'L', 'D', 'G'], skills = ['casual', 'steady', 'sharp'];
let seed = 1;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const wins = Object.fromEntries(skills.map((s) => [s, 0])), pts = Object.fromEntries(skills.map((s) => [s, 0])), seats = Object.fromEntries(skills.map((s) => [s, 0]));
let rolls = 0, ends = {}, journeys = 0;
for (let g = 0; g < games; g++) {
  const players = Array.from({ length: n }, (_, i) => ({ name: 'P' + i, bot: true, skill: mode === 'mixed' ? skills[(i + g) % 3] : mode, color: COLORS[i] }));
  let S = E.newGame({ seed: 1000 + g, players });
  S = AI.botStarts(S, rnd);
  while (!S.over) {
    if (S.phase === 'roll') S = E.roll(S);
    else if (S.phase === 'move') { S = AI.botMoves(S, rnd); S = E.resolve(S); }
    else if (S.phase === 'pick') S = AI.botPicks(S, rnd);
  }
  rolls += S.rolls; ends[S.endedBy] = (ends[S.endedBy] || 0) + 1;
  S.players.forEach((p, i) => { seats[p.skill]++; pts[p.skill] += E.score(p); journeys += p.done.length; if (S.winners.includes(i)) wins[p.skill] += 1 / S.winners.length; });
}
console.log(`${games} games, ${n} players (${mode}): ${(rolls / games).toFixed(1)} rolls each on average, ${(journeys / games / n).toFixed(1)} journeys per player; ended by`, ends);
for (const s of skills) if (seats[s]) console.log(`  ${s.padEnd(7)} wins ${(100 * wins[s] / (seats[s])).toFixed(0)}% of its seats, ${(pts[s] / seats[s]).toFixed(0)} points on average`);
