// Computer-only games, to check the rules never break and to compare the skills:  node tools/sim.mjs [games] [players] [skill...]
import * as E from '../js/engine.js';
import * as AI from '../js/ai.js';

const games = Number(process.argv[2]) || 100, n = Number(process.argv[3]) || 3;
const skills = process.argv.slice(4).length ? process.argv.slice(4) : ['steady'];
const wins = Array(n).fill(0); let limit = 0, turns = 0, steps = 0;
for (let g = 1; g <= games; g++) {
  let S = E.newGame({ seed: g, players: Array.from({ length: n }, (_, i) => ({ name: 'P' + i, bot: true, skill: skills[i % skills.length] })), first: g % n });
  let guard = 0, r = 7 * g;
  const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  while (!S.over && guard++ < 20000) {
    const seat = E.actor(S), a = AI.choose(S, S.players[seat].skill, rnd);
    S = E.apply(S, a); steps++;
    const all = [...S.draw, ...S.discard, ...S.players.flatMap((p) => p.hand), ...S.players.flatMap((p) => Object.values(p.tree).filter((s) => s.s === 2).map((s) => s.d))];
    if (S.held) all.push(S.held);
    if (all.length > 88) throw new Error('too many cards: ' + all.length);
  }
  if (!S.over) throw new Error('game ' + g + ' did not finish');
  if (S.endedBy === 'limit') limit++; else wins[S.winner]++;
  turns += S.turns;
}
console.log(`${games} games, ${n} players (${skills.join('/')}): wins by seat ${wins.join(' ')}, ended on the round limit ${limit}, avg turns ${(turns / games).toFixed(0)}, steps ${steps}`);
