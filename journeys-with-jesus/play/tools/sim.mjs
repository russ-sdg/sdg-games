// Computer-vs-computer games, to check the game ends and the three skill levels are ordered sensibly:
//   node journeys-with-jesus/play/tools/sim.mjs [games] [players] [expansion]
import * as E from '../js/engine.js';
import * as AI from '../js/ai.js';

const games = Number(process.argv[2] || 200), n = Number(process.argv[3] || 3), exp = process.argv[4] === 'expansion';
const skills = ['casual', 'steady', 'sharp'];
const wins = Object.fromEntries(skills.map((k) => [k, 0])), pts = Object.fromEntries(skills.map((k) => [k, 0]));
let rounds = 0, ended = {}, count = {};
for (let g = 0; g < games; g++) {
  const players = Array.from({ length: n }, (_, i) => ({ name: 'P' + i, bot: true, skill: skills[(i + g) % 3] }));
  let s = E.newGame({ seed: 1000 + g, players, expansion: exp });
  let r = mulberry(g + 7);
  while (!s.over) s = AI.turn(s, r);
  rounds += s.round; ended[s.endedBy] = (ended[s.endedBy] || 0) + 1;
  const w = E.winners(s);
  for (const i of w) wins[players[i].skill] += 1 / w.length;
  s.players.forEach((p, i) => { pts[players[i].skill] += E.score(p).total; count[players[i].skill] = (count[players[i].skill] || 0) + 1; });
}
console.log(`${games} games, ${n} players${exp ? ', expansion' : ''}: average ${(rounds / games).toFixed(1)} rounds; ended by`, ended);
for (const k of skills) console.log(k.padEnd(7), 'wins', wins[k].toFixed(1).padStart(6), ' avg points', (pts[k] / (count[k] || 1)).toFixed(1));
function mulberry(a) { return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
