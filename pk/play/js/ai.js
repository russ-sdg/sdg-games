// Prophets & Kings: the computer players. They only ever make legal plays (they ask the rules for them) and only use what a person at the
// table could see: their own hand, the top of each discard pile, every set already played, and the cards an opponent took face-up.
//   casual  chases points but wanders: takes cards at random now and then, forgets some plays, ignores what it hands to others
//   steady  plans its whole hand, prefers sets that can still grow, and avoids discarding cards an opponent could add to a set
//   sharp   as steady, plus it remembers the cards opponents picked up, looks further ahead, and is careful what it gives away
import * as E from './engine.js';

export const SKILLS = {
  casual: { wander: 0.3, forget: 0.2, growth: 0, gift: 0, memory: false },
  steady: { wander: 0, forget: 0, growth: 0.18, gift: 0.35, memory: false },
  sharp: { wander: 0, forget: 0, growth: 0.3, gift: 0.8, memory: true },
};
const kit = (skill) => SKILLS[skill] || SKILLS.steady;

// Context for judging cards: how many copies of each name can still be played, and how close the game is to its end.
function context(s, skill) {
  const k = kit(skill), out = {};
  for (const name of Object.keys(E.COPIES)) out[name] = E.outstanding(s, name);
  return { k, out, hw: Math.max(0.15, Math.min(1, s.draw.length / 16)), s };
}

// Distinct names still playable that match `name` and are not already in `have` (a set of names).
function avail(c, name, have) { return E.matchesOf(name).filter((n) => !have.has(n) && c.out[n] > 0).length; }

// What a set of this length is still worth: the next few cards it could take, discounted.
function growth(c, name, names, len) {
  const m = Math.min(3, avail(c, name, new Set(names)));
  let v = 0;
  for (let j = 1; j <= m; j++) v += 0.7 ** (j - 1) * (E.setScore(len + j) - E.setScore(len + j - 1));
  return c.k.growth * c.hw * v;
}

// What a card is worth held in the hand for later.
function holdValue(c, uid, held) {
  const name = E.label(uid), partners = new Set(held.filter((u) => u !== uid && E.match(u, uid)).map(E.label));
  const outs = Math.min(4, avail(c, name, new Set([name])));
  if (!outs && !partners.size) return 0;
  return c.hw * (Math.min(2, partners.size) * 0.6 + outs * 0.15 + 0.05);
}

// The best way to spend `hand` (cards the player holds) on `sets` (their existing sets): { value, starts, adds, held }.
//   starts  [{ head, members: [uid] }]   adds [{ set, uid }]   held  the cards kept (already cut down to 5)
export function plan(c, hand, sets) {
  const n = hand.length, idx = [...Array(n).keys()];
  const heads = [[]];
  for (let i = 0; i < n; i++) { heads.push([i]); for (let j = i + 1; j < n; j++) heads.push([i, j]); }
  let best = null;
  const base = sets.map((st) => ({ head: st.head, names: E.setNames(st), len: E.setLength(st), isNew: false, members: [], pre: growth(c, E.label(st.head), E.setNames(st), E.setLength(st)) }));

  for (const H of heads) {
    const groups = base.map((g) => ({ ...g, names: [...g.names], members: [] }));
    for (const i of H) groups.push({ head: hand[i], names: [E.label(hand[i])], len: 1, isNew: true, members: [], pre: 0 });
    const rest = idx.filter((i) => !H.includes(i));
    const walk = (k, held) => {
      if (k === rest.length) { score(held); return; }
      const uid = hand[rest[k]], name = E.label(uid);
      walk(k + 1, [...held, uid]);                                                   // keep it
      for (const g of groups) {
        if (g.head !== uid && E.match(g.head, uid) && !g.names.includes(name)) {
          g.names.push(name); g.members.push(uid); g.len++;
          walk(k + 1, held);
          g.len--; g.members.pop(); g.names.pop();
        }
      }
    };
    const score = (held) => {
      let v = 0;
      for (const g of groups) {
        if (g.isNew && !g.members.length) return;                                    // a head with nobody behind it is not a set
        if (!g.members.length) continue;
        const old = g.isNew ? 0 : g.len - g.members.length;
        v += E.setScore(g.len) - E.setScore(old) + growth(c, E.label(g.head), g.names, g.len) - g.pre;
      }
      let keep = held;
      if (keep.length > E.HAND_KEEP) keep = [...keep].sort((a, b) => holdValue(c, b, held) - holdValue(c, a, held)).slice(0, E.HAND_KEEP);
      v += keep.reduce((m, u) => m + holdValue(c, u, keep), 0);
      if (!best || v > best.value) best = { value: v, groups: groups.map((g) => ({ ...g, names: [...g.names], members: [...g.members] })), held: keep };
    };
    walk(0, []);
  }
  const starts = [], adds = [];
  for (const g of best.groups) {
    if (!g.members.length) continue;
    if (g.isNew) starts.push({ head: g.head, members: g.members });
    else for (const uid of g.members) adds.push({ set: sets.findIndex((st) => st.head === g.head), uid });
  }
  return { value: best.value, starts, adds, held: best.held };
}

// ---- drawing -----------------------------------------------------------------------------------------------------------------
// What the best plan is worth with `uid` added to the hand.
const worth = (c, p, uid) => plan(c, [...p.hand, uid], p.sets).value;

// Cards the player cannot see: not in their hand, not played, not on top of a discard pile.
function unseen(s, p) {
  const seen = new Set([...p.hand, ...s.piles.filter((x) => x.length).map((x) => x[x.length - 1]), ...s.players.flatMap((q) => q.sets.flatMap(E.setCards))]);
  return E.DEFS.map((_, i) => i).filter((i) => !seen.has(i));
}

// Which source should the player to move take their next card from?
export function chooseTake(s, skill, r = Math.random) {
  const p = E.me(s), c = context(s, skill), opts = E.sources(s);
  if (c.k.wander && r() < c.k.wander) return opts[Math.floor(r() * opts.length)];
  const pool = unseen(s, p), sample = [];
  for (let i = 0; i < 8 && pool.length; i++) sample.push(pool[Math.floor(r() * pool.length)]);
  const blind = sample.length ? sample.reduce((m, u) => m + worth(c, p, u), 0) / sample.length : -1;
  let best = null;
  for (const o of opts) {
    let v;
    if (o.from === 'deck') v = blind;
    else if (o.from === 'pile') v = worth(c, p, o.uid);
    else {
      const q = s.players[o.p], known = c.k.memory ? q.known.filter((u) => q.hand.includes(u)) : [];
      const share = known.length / q.hand.length;
      v = known.length ? share * (known.reduce((m, u) => m + worth(c, p, u), 0) / known.length) + (1 - share) * blind : blind;
      v -= 0.01;                                                                     // a card from the draw pile does not cost anyone anything
    }
    if (!best || v > best.v + 1e-9) best = { o, v };
  }
  return best.o;
}

// ---- playing and discarding ------------------------------------------------------------------------------------------------
// How much it would help the other players to be handed this card (they could add it to a set they have).
function gift(s, uid) {
  let v = 0;
  s.players.forEach((q, j) => { if (j !== s.turn) for (const st of q.sets) if (E.canAdd(st, uid)) v += E.setScore(E.setLength(st) + 1) - E.setScore(E.setLength(st)); });
  return v * 0.5;
}

// The plays and discards for the whole of the player's turn: { starts, adds, discards: [{ uid, pile }] }.
export function choosePlay(s, skill, r = Math.random) {
  const p = E.me(s), c = context(s, skill), k = c.k;
  const pl = plan(c, p.hand, p.sets);
  if (k.forget) {                                                                    // a casual player overlooks some plays
    pl.starts = pl.starts.filter(() => r() >= k.forget);
    pl.adds = pl.adds.filter(() => r() >= k.forget);
  }
  const used = new Set([...pl.starts.flatMap((x) => [x.head, ...x.members]), ...pl.adds.map((a) => a.uid)]);
  let held = p.hand.filter((u) => !used.has(u));
  const discards = [];
  while (held.length > E.HAND_KEEP) {
    let worst = null;
    for (const u of held) {
      // discard the card that is worth least to keep; handing opponents a card they can use counts against discarding it
      const v = holdValue(c, u, held) + k.gift * gift(s, u) + (k.gift ? 0 : r() * 0.5);
      if (!worst || v < worst.v) worst = { u, v };
    }
    held = held.filter((u) => u !== worst.u);
    discards.push(worst.u);
  }
  return { starts: pl.starts, adds: pl.adds, discards };
}

// Where to put a discard: not on the pile whose top card the player wants themselves next turn.
export function choosePile(s, uid, skill, r = Math.random) {
  const p = E.me(s), c = context(s, skill);
  let want = -1, top = -Infinity;
  s.piles.forEach((pile, i) => { if (pile.length) { const v = worth(c, p, pile[pile.length - 1]); if (v > top) { top = v; want = i; } } });
  const options = s.piles.map((_, i) => i).filter((i) => i !== want);
  return options[Math.floor(r() * options.length)];
}

// Play the whole turn (used by tests and the simulator; the page does the same steps one at a time with pauses).
export function turn(s, r = Math.random) {
  const skill = E.me(s).skill;
  while (s.phase === 'draw') s = E.take(s, chooseTake(s, skill, r), r);
  const pl = choosePlay(s, skill, r);
  for (const st of pl.starts) {
    s = E.startSet(s, st.head, st.members[0]);
    const idx = E.me(s).sets.length - 1;
    for (const m of st.members.slice(1)) s = E.addTo(s, idx, m);
  }
  for (const a of pl.adds) s = E.addTo(s, a.set, a.uid);
  while (E.mustDiscard(s)) {
    const left = pl.discards.find((u) => E.me(s).hand.includes(u)) ?? E.me(s).hand[0];
    s = E.discard(s, left, choosePile(s, left, skill, r));
  }
  return s.over || s.phase !== 'play' ? s : E.endTurn(s);
}
