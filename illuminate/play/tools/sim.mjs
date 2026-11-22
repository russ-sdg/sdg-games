// Computer-only games, to check the rules never break and to compare the skills:  node tools/sim.mjs [games] [players] [plan] [skill...]
import * as E from '../js/engine.js';
import * as AI from '../js/ai.js';
import { CARD } from '../js/cards.js';

const games = Number(process.argv[2]) || 20, n = Number(process.argv[3]) || 3, plan = process.argv[4] || 'standard';
const skills = process.argv.slice(5).length ? process.argv.slice(5) : ['steady'];
const roles = ['doctor', 'neighbor', 'preacher', 'teacher'];
const wins = Array(n).fill(0), pts = Array(n).fill(0); let hit = 0, hands = 0, t0 = Date.now();
for (let g = 1; g <= games; g++) {
  let S = E.newGame({ seed: g, plan, notPerfect: g % 2 === 0, dealer: g % n, players: Array.from({ length: n }, (_, i) => ({ name: 'P' + i, bot: true, skill: skills[i % skills.length], role: roles[(i + g) % 4] })) });
  let guard = 0, r = 11 * g;
  const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  while (!S.over && guard++ < 100000) {
    const seat = E.actor(S), before = S.handNo;
    S = E.apply(S, AI.choose(S, S.players[seat].skill, rnd));
    if (S.handNo !== before || S.over) { const h = S.history[S.history.length - 1]; h.bids.forEach((b, i) => { hands++; if (E.handPoints(h.size, b, h.won[i]) > 0) hit++; }); }
  }
  if (!S.over) throw new Error('game ' + g + ' did not finish');
  S.winners.forEach((w) => wins[w]++); S.players.forEach((p, i) => { pts[i] += p.score; });
}
console.log(`${games} games, ${n} players (${skills.join('/')}, ${plan}): wins ${wins.join(' ')}, avg score ${pts.map((x) => (x / games).toFixed(0)).join(' ')}, bids made ${(100 * hit / hands).toFixed(0)}%, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
