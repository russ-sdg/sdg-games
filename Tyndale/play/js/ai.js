// Tyndale: the computer players (plain code in the browser; no server, no AI service).
import * as E from './engine.js';
import { POINTS } from './board-data.js';

const ALL = POINTS.map((p) => p.id);
const rank = (letter) => E.PUBS.indexOf(letter);

// ---- Tyndale ----------------------------------------------------------------------------------------------------------------
const threat = (s, pos) => E.livePawns(s).reduce((a, p) => { const d = E.dist(pos, p.pos); return a + (d === 1 ? 1 : d === 2 ? 0.65 : d === 3 ? 0.35 : d === 0 ? 1.2 : 0); }, 0);
const minPawnDist = (s, pos) => Math.min(...E.livePawns(s).map((p) => E.dist(pos, p.pos)));

function goals(s) {
  const t = s.t;
  if (t.published < t.translated) return E.centres.filter((c) => !t.visited.includes(c));     // the next translation needs a new Printing Centre
  return E.coastal.filter((c) => c !== 'B5');                                              // a publication needs a Coastal City
}
function goalDist(s, pos) {
  const t = s.t, gs = goals(s);
  if (!gs.length) return 0;
  if (t.published < t.translated) return Math.min(...gs.map((g) => E.dist(pos, g)));
  return Math.min(...gs.map((g) => E.dist(pos, g) + 0.5 * Math.min(E.pt[g].coast, 11) * 0.5));  // nearer London arrives sooner
}

export const SKILLS = {
  casual: { name: 'Casual', blurb: 'wanders; takes risks', risk: 1.0, noise: 1.6, bonus: 1.4 },
  steady: { name: 'Steady', blurb: 'sensible; keeps clear of the Agents', risk: 2.6, noise: 0.5, bonus: 0.7 },
  sharp: { name: 'Sharp', blurb: 'slips past the Agents', risk: 4.2, noise: 0.15, bonus: 0.5 },
};

export function aiTyndaleStart(s, skill = 'steady') {
  const k = SKILLS[skill] || SKILLS.steady;
  let best = null;
  for (const id of ALL) {
    if (E.pawnAt(s, id)) continue;
    let v = 0;
    if (E.isPrintingCentre(id)) v += 3;
    if (E.isPrintingCentre(id) && E.isCoastal(id)) v += 2 - E.pt[id].coast * 0.15;        // publish and ship straight away
    v += Math.min(minPawnDist(s, id), 6) * 0.8 * (k.risk / 2.6);
    v += E.draw(s) * 0.6 * k.noise;
    if (!best || v > best.v) best = { id, v };
  }
  return best.id;
}

export function aiTyndalePath(s, skill = 'steady') {
  const k = SKILLS[skill] || SKILLS.steady;
  const t = s.t, paths = [];
  const walk = (path) => {
    if (path.length) { const c = E.checkTyndalePath(s, path); if (c.ok) paths.push({ path: [...path], needBonus: c.needBonus }); }
    const nx = E.tyndaleNext(s, path);
    for (const q of nx.steps) { if (path.length && q === path[path.length - 1]) continue; walk([...path, q]); }
  };
  walk([]);
  const gs = new Set(goals(s));
  let best = null;
  for (const c of paths) {
    const e = c.path[c.path.length - 1];
    let v = -goalDist(s, e) * 1.0 - threat(s, e) * k.risk - c.needBonus * k.bonus;
    if (gs.has(e) && !t.visited.includes(e)) v += 6;                                     // reaching the goal publishes or ships
    if (E.isCoastal(e) && t.published > t.shipped) v += 6;
    v += E.draw(s) * k.noise;
    if (!best || v > best.v) best = { ...c, v };
  }
  return best.path;
}

// ---- Bishop's Agents ---------------------------------------------------------------------------------------------------------
export function aiPlacePawns(s, seat) {
  const mine = s.pawns.filter((p) => p.seat === seat);
  const out = [];
  const taken = () => [...s.pawns.filter((p) => p.pos), ...out.map((x) => ({ pos: x.pos }))].map((p) => p.pos);
  for (const p of mine) {
    let best = null;
    for (const id of ALL) {
      if (taken().includes(id)) continue;
      const others = taken();
      let v = (others.length ? Math.min(...others.map((o) => E.dist(id, o))) : 5) * 1.0;
      if (E.isPrintingCentre(id)) v += 1.2;
      if (E.pt[id].kind === 'water') v -= 1.5;
      v += E.draw(s) * 0.8;
      if (!best || v > best.v) best = { pawn: p.id, pos: id, v };
    }
    out.push(best);
  }
  return out;
}

const view = (s, seat) => (seat === s.supporter ? { ...s.found, ...s.private } : s.found);

// Where might Tyndale be right now? A running estimate from everything the Agents have been told: he moves 1-3 steps a
// turn, a spot where he is NOT can be ruled out, and once he has published his spot always carries a mark, so a spot
// with "nothing" and no rumors cannot be his; his trail also stays close to any marks that have been found.
const KERNEL = [0.05, 0.5, 0.3, 0.15];
const cache = new Map();
export function belief(s, seat) {
  const obs = seat === s.supporter ? [...s.obs, ...s.pobs].sort((a, b) => a.round - b.round) : s.obs;
  const key = `${s.seed}|${s.round}|${obs.length}|${seat}`;
  if (cache.has(key)) return cache.get(key);
  let P = Object.fromEntries(ALL.map((id) => [id, (E.isPrintingCentre(id) ? 3 : 1) * (E.pt[id].kind === 'water' ? 0.3 : 1)]));
  const norm = () => { const t = Object.values(P).reduce((a, b) => a + b, 0) || 1; for (const k in P) P[k] /= t; };
  norm();
  const markObs = obs.filter((o) => E.PUBS.includes(o.bible));
  const firstMark = Math.min(Infinity, ...markObs.map((o) => o.round));
  for (let r = 1; r <= s.round; r++) {
    const N = {};                                             // his move this round spreads the estimate
    for (const y of ALL) N[y] = 0;
    for (const x of ALL) { if (P[x] < 1e-6) continue; for (const y of ALL) { const d = E.dist(x, y); if (d <= 3) N[y] += P[x] * KERNEL[d]; } }
    P = N;
    for (const o of obs.filter((q) => q.round === r)) {
      if (o.loc === 'not' || (o.loc !== 'here' && (o.bible === 'nothing' || o.bible === 'rumors') && r >= firstMark)) P[o.pos] = 0;
      if (o.loc === 'near') for (const y of ALL) if (E.dist(o.pos, y) > E.NEAR) P[y] *= 0.02;
      if (o.loc === 'far') for (const y of ALL) if (E.dist(o.pos, y) <= E.NEAR) P[y] *= 0.02;
    }
    norm();
  }
  // His trail is one unbroken line of marks and he is at its end: favor spots near the marks that were found, the newest
  // letters most of all, allowing for how long ago each was found; a rumor means a mark is next door.
  const rmax = Math.max(-1, ...markObs.map((o) => rank(o.bible)));
  const pulls = [...markObs.map((o) => ({ pos: o.pos, w: Math.pow(0.35, rmax - rank(o.bible)) * 8, age: s.round - o.round })),
    ...obs.filter((o) => o.bible === 'rumors').flatMap((o) => E.neighbors(o.pos).map((n) => ({ pos: n, w: 1.2, age: s.round - o.round })))];
  if (pulls.length) {
    for (const y of ALL) P[y] *= 1 + pulls.reduce((a, u) => a + u.w * Math.exp(-E.dist(y, u.pos) / (1.5 + 1.0 * u.age)), 0);
    norm();
  }
  cache.set(key, P);
  if (cache.size > 400) cache.delete(cache.keys().next().value);
  return P;
}

export function aiAgentChoose(s, pawnId, roll, skill = 'steady') {
  const pawn = s.pawns[pawnId], seat = pawn.seat, P = belief(s, seat);
  const noise = { casual: 0.03, steady: 0.008, sharp: 0.001 }[skill] ?? 0.008;
  const carry = s.carry[pawnId];
  let best = null;
  for (const x of E.pawnTargets(s, pawnId, roll)) {
    let v = P[x] + 0.35 * E.neighbors(x).reduce((a, n) => a + P[n], 0);       // chance of catching him now, plus covering the spots around
    for (const q of E.livePawns(s)) if (q.id !== pawnId && q.seat !== undefined) { const d = E.dist(x, q.pos); if (d <= 1) v -= 0.01; }
    if (seat === s.supporter) {                               // the Secret Supporter wants to carry publications to the coast
      v = carry ? 1 - Math.min(...E.coastal.map((c) => E.dist(x, c))) * 0.2 + (E.isCoastal(x) ? 1.5 : 0) : v * 0.5 + E.draw(s) * 0.01;
    }
    v += (E.draw(s) - 0.5) * 2 * noise;
    if (!best || v > best.v) best = { x, v };
  }
  return best.x;
}
// The Secret Supporter shares only harmless results ("Nothing to Report"), as the rules suggest.
export const supporterShares = (ans) => ans.bible === 'nothing' && ans.loc !== 'here';

// ---- accusing -------------------------------------------------------------------------------------------------------------------
// How likely is this seat the Secret Supporter, judging only by what the others have heard from them?
export function suspicion(s) {
  const seats = s.seats.filter((x) => !x.out), q = 0.65;
  const w = seats.map((x) => {
    const r = s.reports[x.id] || { n: 0, nothing: 0 };
    const honest = Math.pow(q, r.nothing) * Math.pow(1 - q, r.n - r.nothing);
    const sup = r.n === r.nothing ? 1 : 0;
    return { seat: x.id, w: sup, honest };
  });
  const tot = w.reduce((a, x) => a + x.w * (1 / seats.length) / Math.max(x.honest, 1e-9), 0) || 1;
  return Object.fromEntries(w.map((x) => [x.seat, (x.w * (1 / seats.length) / Math.max(x.honest, 1e-9)) / tot]));
}
// A computer Agent decides whether to accuse (never a human) after a shipment arrives.
export function aiAccusation(s, voters) {
  const sus = suspicion(s);
  let best = null;
  for (const x of s.seats.filter((x) => !x.out && !x.human)) if (!best || sus[x.id] > best.p) best = { seat: x.id, p: sus[x.id] };
  if (!best || best.p < 0.55) return null;
  const accusers = voters.filter((v) => v !== best.seat);
  return accusers.length ? { accuser: accusers[0], accused: best.seat } : null;
}
export function aiVote(s, seat, accused) {
  if (seat === accused) return false;
  return suspicion(s)[accused] >= 0.4;
}
