import * as E from '../js/engine.js';
import * as A from '../js/ai.js';
export function playGame(seed, nSeats, skill = 'steady', maxRounds = 120, tskill = 'steady') {
  const seats = Array.from({ length: nSeats }, (_, i) => ({ name: 'S' + i }));
  const sup = E.hasSupporter(nSeats) ? Math.floor(E.hash01(seed, 7) * nSeats) : null;
  let s = E.newGame({ seats, seed, supporter: sup });
  for (let i = 0; i < nSeats; i++) for (const m of A.aiPlacePawns(s, i)) s = E.placePawn(s, m.pawn, m.pos);
  s = E.startTyndale(s, A.aiTyndaleStart(s, tskill));
  while (!s.over && s.round <= maxRounds) {
    const path = A.aiTyndalePath(s, tskill);
    if (!path) { s = E.trapped(s); break; }
    s = E.tyndaleMove(s, path);
    if (s.over) break;
    if (s.accusation && s.accusation.open) {          // a computer Agent may accuse
      const voters = s.seats.filter((x) => !x.out).map((x) => x.id);
      const acc = A.aiAccusation(s, voters);
      if (acc) { const votes = {}; voters.forEach((v) => { votes[v] = A.aiVote(s, v, acc.accused); }); s = E.accuse(s, acc.accuser, acc.accused, votes); if (s.over) break; }
      s = E.closeAccusation(s);
    }
    for (const seat of s.seats) {
      if (seat.out) continue;
      for (const p of s.pawns.filter((x) => x.seat === seat.id && !x.out)) {
        const roll = E.rollDie(s);
        const pos = A.aiAgentChoose(s, p.id, roll, skill, A.PEEK[skill] || 0);
        s = E.agentMove(s, p.id, roll, pos, { share: A.supporterShares });
        if (s.over) break;
      }
      if (s.over) break;
    }
    if (s.over) break;
    s = E.endAgentTurns(s);
  }
  return s;
}
if (process.argv[1].endsWith('sim.mjs')) {
  const skill = process.argv[2] || 'steady', tskill = process.argv[3] || 'steady';
  console.log('agents', skill, 'vs Tyndale', tskill);
  for (const n of [1, 3, 5]) {
    let agents = 0, rounds = 0, N = 60, deliveredSum = 0, tw = 0, long = 0;
    for (let i = 1; i <= N; i++) {
      const s = playGame(i * 7 + n, n, skill, 120, tskill);
      if (!s.over) long += 1;
      else if (s.winner === 'agents') agents += 1; else tw += 1;
      rounds += s.round; deliveredSum += s.delivered.length;
    }
    console.log(`${n} agent seat(s)${E.hasSupporter(n) ? ' + supporter' : ''}: agents win ${agents}/${N}, Tyndale wins ${tw}, unfinished ${long}, avg rounds ${(rounds / N).toFixed(1)}, avg delivered ${(deliveredSum / N).toFixed(1)}`);
  }
}
