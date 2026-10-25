// Computer-vs-computer games, to check the games end and the skill levels are ordered sensibly:
//   node 6days/play/tools/sim.mjs [games] [players]
import * as E from '../js/engine.js';
import * as AI from '../js/ai.js';
const games = Number(process.argv[2] || 300), n = Number(process.argv[3] || 3);
const skills = ['casual', 'steady', 'sharp'], wins = { casual: 0, steady: 0, sharp: 0 }, pts = { casual: 0, steady: 0, sharp: 0 }, count = { casual: 0, steady: 0, sharp: 0 };
let rounds = 0; const ended = {};
const mulberry = (a) => () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
for (let g = 0; g < games; g++) {
  const players = Array.from({ length: n }, (_, i) => ({ name: 'P' + i, bot: true, skill: skills[(i + g) % 3] }));
  let s = E.newGame({ seed: 1000 + g, players }); const r = mulberry(g + 7);
  while (!s.over) s = AI.turn(s, r);
  rounds += s.round; ended[s.endedBy] = (ended[s.endedBy] || 0) + 1;
  const w = E.winners(s); for (const i of w) wins[players[i].skill] += 1 / w.length;
  s.players.forEach((p, i) => { pts[players[i].skill] += p.score; count[players[i].skill]++; });
}
console.log(`${games} games, ${n} players: average ${(rounds / games).toFixed(1)} rounds; ended by`, ended);
for (const k of skills) console.log(k.padEnd(7), 'wins', wins[k].toFixed(1).padStart(6), ' avg points', (pts[k] / (count[k] || 1)).toFixed(1));
