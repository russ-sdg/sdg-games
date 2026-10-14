import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from './js/engine.js';
import * as A from './js/ai.js';

const setup = (n = 1, supporter = null) => {
  let s = E.newGame({ seats: Array.from({ length: n }, (_, i) => ({ name: 'S' + i, human: i === 0 })), seed: 7, supporter });
  const spots = ['A1', 'K1', 'A11', 'K11', 'F1'];
  s.pawns.forEach((p, i) => { s = E.placePawn(s, p.id, spots[i]); });
  return s;
};

test('board data: 17 printing centres and the coastal distances', () => {
  assert.equal(E.centres.length, 17);
  assert.equal(E.pt['E5'].coast, 3);
  assert.equal(E.pt['A5'].coast, 1);
  assert.ok(E.isCoastal('F4') && !E.isCoastal('H6'));
});

test('rules example: publish, ship, and the shipment arrives', () => {
  let s = E.startTyndale(setup(), 'E5');                       // Antwerp: a Printing Centre and a Coastal City
  assert.equal(E.pubLetter(s), 'N');
  assert.equal(s.shipments[0].left, 3);
  s = E.tyndaleMove(s, ['F5']);                                // Cologne: a new Printing Centre, publishes the Pentateuch
  assert.equal(E.pubLetter(s), 'P');
  assert.equal(s.shipments[0].left, 2);
  s = E.endAgentTurns(s);
  s = E.tyndaleMove(s, ['F4']);                                // F4 is coastal: ships the Pentateuch (5)
  assert.equal(s.shipments[1].left, 5);
  assert.equal(s.shipments[0].left, 1);
  s = E.endAgentTurns(s);
  s = E.tyndaleMove(s, ['G4', 'H4']);                          // two bonus steps; the New Testament arrives
  assert.equal(s.delivered[0].pub, 'N');
});

test('Tyndale may not finish on an Agent and needs bonus moves for extra steps', () => {
  let s = E.startTyndale(setup(), 'E6');                       // no bonus moves yet
  assert.equal(E.checkTyndalePath(s, ['E7', 'E8']).ok, false);  // red spot: only one step without a bonus
  assert.equal(E.checkTyndalePath(s, ['E7']).ok, true);
  s = E.startTyndale(setup(), 'E5');                           // publishing earned one bonus move
  assert.equal(E.checkTyndalePath(s, ['E6', 'E7']).ok, true);
});

test('agents: exact steps, capture, and cards', () => {
  let s = E.startTyndale(setup(), 'E5');
  s = E.tyndaleMove(s, ['F5']);
  assert.deepEqual(E.answerAt(s, 'F5', false), { loc: 'here', bible: 'P' });
  assert.equal(E.answerAt(s, 'F6', false).bible, 'rumors');
  assert.equal(E.answerAt(s, 'A1', false).bible, 'nothing');
  assert.ok(E.pawnTargets(s, 0, 2).every((p) => E.dist('A1', p) % 2 === 0));
});

test('scored game plays to the end and reports turns and deliveries', () => {
  for (let seed = 1; seed <= 12; seed++) {
    let s = E.newGame({ seats: [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }, { name: 'e' }], seed, supporter: 2 });
    for (const seat of s.seats) for (const o of A.aiPlacePawns(s, seat.id)) s = E.placePawn(s, o.pawn, o.pos);
    s = E.startTyndale(s, A.aiTyndaleStart(s, 'steady'));
    let guard = 0;
    while (!s.over && guard++ < 400) {
      if (s.phase === 'tyndale') { s = E.tyndaleMove(s, A.aiTyndalePath(s, 'steady')); if (s.over) break; if (s.accusation?.open) s = E.closeAccusation(s); continue; }
      const a = E.nextActor(s);
      if (!a) { s = E.endAgentTurns(s); continue; }
      s = E.rollFor(s, a.pawnId);
      const to = A.aiAgentChoose(s, a.pawnId, s.pending.roll);
      s = E.agentMove(s, a.pawnId, s.pending.roll, to, { share: E.isSupporterPawn(s, a.pawnId) ? A.supporterShares : undefined });
    }
    assert.ok(s.over, 'game ended');
    const sm = E.summary(s);
    assert.ok(sm.turns >= 1);
    assert.equal(sm.delivered.length + sm.undelivered.length, 4);
    if (sm.reason === 'delivered') assert.equal(sm.delivered.at(-1).pub, 'O');
  }
});

test('a surrounded Tyndale has no legal move and the net closes', () => {
  let s = E.newGame({ seats: [{ name: 'a' }], seed: 3, supporter: null });
  const ring = ['E5', 'E7', 'D6', 'F6'];                       // all four neighbours of E6 (no bonus moves there)
  s.pawns.forEach((p, i) => { s = E.placePawn(s, p.id, ring[i]); });
  s = E.startTyndale(s, 'E6');
  assert.equal(E.canMove(s), false);
  s = E.trapped(s);
  assert.equal(s.over, true);
  assert.equal(E.summary(s).reason, 'trapped');
});
