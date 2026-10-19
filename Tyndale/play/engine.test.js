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

test('board data: 18 printing centres (London included) and the coastal distances', () => {
  assert.equal(E.centres.length, 18);
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
      s = E.agentMove(s, a.pawnId, s.pending.roll, to, { report: (ans, pos, st) => A.supporterReport(st, ans, pos) });
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

test('the capturing pawn is the one recorded in lastResult', () => {
  let s = E.newGame({ seats: [{ name: 'a' }, { name: 'b' }], seed: 5, supporter: null });
  const spots = ['A1', 'K1', 'A11', 'K11'];
  s.pawns.forEach((p, i) => { s = E.placePawn(s, p.id, spots[i]); });
  s = E.startTyndale(s, 'B1');                                // one step from A1 (a's pawn 0)
  s = E.tyndaleMove(s, ['C1']);
  s = E.rollFor(s, 0);
  s = E.agentMove(s, 0, 1, 'A2', {});                         // a quiet move first
  s.t.pos = 'K2';
  const r = E.agentMove(s, 1, 1, 'K2', {});                   // pawn 1 (seat 0) steps onto Tyndale
  assert.equal(r.over, true);
  assert.equal(r.lastResult.pawnId, 1);
  assert.equal(r.lastResult.loc, 'here');
});

test('the Secret Supporter is crafty but never lies about what is there', () => {
  let s = E.startTyndale((() => { let g = E.newGame({ seats: Array.from({ length: 4 }, (_, i) => ({ name: 'S' + i })), seed: 9, supporter: 1 }); const sp = ['A1', 'K1', 'A11', 'K11']; g.pawns.forEach((p, i) => { g = E.placePawn(g, p.id, sp[i]); }); return g; })(), 'E5');
  const ans = (bible) => ({ loc: 'far', bible });
  assert.equal(A.supporterReport(s, ans('nothing'), 'C5'), 'nothing');
  assert.equal(A.supporterReport(s, ans('N'), 'E5'), null);   // nobody has reported it yet: say nothing
  s.found['E5'] = { loc: 'not', bible: 'N', round: 1, by: 0 };
  assert.equal(A.supporterReport(s, ans('N'), 'E5'), 'N');    // someone already reported it: report it too
  assert.equal(A.supporterReport(s, ans('P'), 'E5'), 'N');    // only ever repeat what is known
  assert.equal(A.supporterReport(s, ans('rumors'), 'F5'), 'rumors');   // next to a reported translation
  assert.equal(A.supporterReport(s, ans('rumors'), 'A5'), null);
  assert.equal(A.supporterReport(s, { loc: 'here', bible: 'N' }, 'E5'), null);
});

test('London is a Printing Centre: publish, ship, arrive and translate in one turn', () => {
  let s = E.startTyndale(setup(), 'B6');
  s = E.tyndaleMove(Object.assign(structuredClone(s), { phase: 'tyndale' }), ['B5']);
  assert.deepEqual(s.delivered.map((d) => d.pub), ['N']);
  assert.equal(s.t.last.length, 4);   // published, shipped, reached London, translated
  assert.ok(s.t.last.some((e) => /reached London/.test(e)));
});

test('shipping completes the next translation, and it is printed and shipped at once from a Printing Centre not visited before', () => {
  let s = E.startTyndale(setup(), 'F5');                       // Cologne: not coastal, publishes the New Testament and waits to ship it
  assert.equal(E.pubLetter(s), 'N');
  assert.equal(s.shipments.length, 0);
  s = E.tyndaleMove(s, ['E5']);                                // Antwerp: new Printing Centre on the coast
  assert.deepEqual(s.shipments.map((x) => [x.pub, x.from]), [['N', 'E5'], ['P', 'E5']], 'N and P both ship from Antwerp');
  assert.equal(E.pubLetter(s), 'P');
  assert.equal(s.t.shipped, 1);
  assert.equal(s.t.translated, 2, 'the Historical Books are translated next');
  assert.deepEqual(s.t.last.map((e) => e.split(' ')[0]), ['shipped', 'translated', 'published', 'shipped', 'translated']);
  assert.ok(s.t.visited.includes('E5') && s.t.visited.includes('F5'));
  // the Historical Books now need a centre he has not used
  s = E.endAgentTurns(s);
  s = E.tyndaleMove(s, ['E6']);
  assert.equal(E.pubLetter(s), 'P', 'nothing to print on a plain spot');
});

test('a centre prints only once: starting on the coast does not print the second translation in the same place', () => {
  const s = E.startTyndale(setup(), 'E5');                     // Antwerp: prints and ships the New Testament, translates the Pentateuch
  assert.deepEqual(s.shipments.map((x) => x.pub), ['N']);
  assert.equal(E.pubLetter(s), 'N');
  assert.equal(s.t.translated, 1);
});

test('London, visited for the first time with a publication waiting: ship, arrive, translate, print and ship the next one there too', () => {
  let s = E.startTyndale(setup(), 'F5');                       // the New Testament is published in Cologne, waiting to ship
  s = structuredClone(s); s.t.pos = 'B6';                      // (a few moves later, beside London)
  s = E.tyndaleMove(s, ['B5']);
  assert.deepEqual(s.delivered.map((d) => d.pub), ['N', 'P'], 'both reach London in the same turn');
  assert.equal(s.t.translated, 2);
  assert.equal(s.accusation.after, 'P');
});

test('London prints a translation that is waiting, and ships it, in one visit', () => {
  let s = E.startTyndale(setup(), 'B6');                       // no translation published yet
  s = E.tyndaleMove(s, ['B5']);
  assert.deepEqual(s.delivered.map((d) => d.pub), ['N']);
  assert.equal(s.t.translated, 1, 'the Pentateuch is translated, but London has already printed once this visit');
});

test('every pawn keeps its route, for the results map', () => {
  let s = E.startTyndale(setup(), 'F5');
  assert.deepEqual(s.pawns.map((p) => p.trail), s.pawns.map((p) => [p.pos]), 'routes start where the pawns were placed');
  s = E.tyndaleMove(s, ['E5']);
  const start = s.pawns[0].pos;
  s = E.rollFor(s, 0);
  const to = E.pawnTargets(s, 0, s.pending.roll)[0];
  s = E.agentMove(s, 0, s.pending.roll, to);
  assert.deepEqual(s.pawns[0].trail, to === start ? [start] : [start, to], 'a move extends the route; staying put does not');
  const old = structuredClone(s); delete old.pawns[1].trail;      // a game saved before routes were kept
  old.moved = []; old.pending = null;
  const moved = E.agentMove(E.rollFor(old, 1), 1, 1, E.pawnTargets(E.rollFor(old, 1), 1, 1)[0] ?? old.pawns[1].pos);
  assert.ok(Array.isArray(moved.pawns[1].trail) && moved.pawns[1].trail[0] === old.pawns[1].pos);
});
