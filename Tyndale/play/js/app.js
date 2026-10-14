// Tyndale: play online. Hunt mode: you are a Bishop's Agent; a computer plays Tyndale and the app answers with the cards.
import * as E from './engine.js';
import * as A from './ai.js';
import { PX } from './board-data.js';

const KEY = 'sdg-ty-play-1';
const $ = (id) => document.getElementById(id);
const SVGNS = 'http://www.w3.org/2000/svg';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CARD = (id) => `../../assets/tyndale/cards/${id}-480.webp`;
const LOC_CARD = { here: 'here', not: 'not-here', near: 'near', far: 'far' };
const BIB_CARD = { N: 'new-testament', P: 'pentateuch', H: 'historical', O: 'old-testament', rumors: 'rumors', nothing: 'nothing' };
const LOC_TEXT = { here: 'Tyndale is here!', not: 'Tyndale is not here', near: 'Tyndale is near', far: 'Tyndale is far away' };
const SEAT_COLOURS = ['#0d6efd', '#e76f00', '#2a9d8f', '#8e44ad', '#6c757d'];
const AGENT_NAMES = ['Ashby', 'Brand', 'Carew', 'Dacre', 'Elyot', 'Fane'];   // not the names on the character cards, which stay hidden
const x = (id) => PX[E.colOf(id)], y = (id) => PX[E.rowOf(id)];

let S = null;                      // the game
let cfg = null;                    // {nAgents, skill, hint, seed}
let ui = { sel: null, heat: false, route: false, mine: null, banner: '', status: '' };
let token = 0, busy = false;

// ---- saving ---------------------------------------------------------------------------------------------------------------
function save() { try { localStorage.setItem(KEY, JSON.stringify({ S, cfg, ui: { heat: ui.heat, mine: ui.mine, banner: ui.banner } })); } catch (e) { /* private mode */ } }
function load() { try { const v = JSON.parse(localStorage.getItem(KEY)); return v && v.S && v.cfg ? v : null; } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }

// ---- small helpers ----------------------------------------------------------------------------------------------------------
const name = (seat) => S.seats[seat].name;
const you = () => S.seats[0];
const humanIn = () => !you().out;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function say(text) { S = E.logPublic(S, text); }
const describe = (r) => (r.bible === 'rumors' ? 'rumors of a translation nearby' : r.bible === 'nothing' ? 'nothing to report' : 'found ' + E.PUB_NAMES[r.bible]);

function ask({ title, text = '', list = null, choices }) {
  return new Promise((resolve) => {
    const dlg = $('accuse');
    $('accuse-title').textContent = title;
    $('accuse-text').innerHTML = text;
    const lst = $('accuse-list');
    lst.innerHTML = '';
    if (list) list.forEach((it, i) => { const l = document.createElement('label'); l.innerHTML = `<input type="radio" name="pick" value="${esc(it.value)}"${i === 0 ? ' checked' : ''}> <span>${esc(it.label)}</span>`; lst.appendChild(l); });
    const act = $('accuse-actions');
    act.innerHTML = '';
    let done = false;
    const end = (value) => { if (done) return; done = true; const r = lst.querySelector('input:checked'); dlg.close(); resolve({ value, pick: r ? r.value : null }); };
    choices.forEach((c) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + (c.cls || 'btn-outline-secondary'); b.textContent = c.label; b.addEventListener('click', () => end(c.value)); act.appendChild(b); });
    dlg.addEventListener('close', () => end(choices.find((c) => c.esc)?.value ?? choices[choices.length - 1].value), { once: true });
    dlg.showModal();
  });
}

// ---- new game ------------------------------------------------------------------------------------------------------------------
function startGame() {
  const nAgents = Number($('agents').value);
  cfg = { nAgents, skill: $('skill').value, hint: $('hint').checked, seed: Math.floor(Math.random() * 1e9) + 1 };
  const names = AGENT_NAMES.slice();
  for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(E.hash01(cfg.seed, 900 + i) * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
  const seats = [{ name: 'You', human: true }];
  for (let i = 1; i < nAgents; i++) seats.push({ name: names[i - 1], human: false });
  // Six character cards are shuffled and dealt, one to each Agent; one of them is the Secret Supporter, so with 4 or more Agents
  // someone may hold it, but nobody knows unless they are exposed. You never draw it.
  const drawn = Math.floor(E.hash01(cfg.seed, 950) * 6);
  const supporter = E.hasSupporter(nAgents) && drawn > 0 && drawn < nAgents ? drawn : null;
  S = E.newGame({ seats, seed: cfg.seed, supporter });
  ui = { sel: null, heat: cfg.hint, route: false, mine: null, banner: '', status: '' };
  save();
  show('game');
  render();
}

function show(which) {
  $('setup').hidden = which !== 'setup';
  $('game').hidden = which !== 'game';
  window.scrollTo(0, 0);
}

// ---- the run loop: plays everything that is not waiting for you ---------------------------------------------------------
async function run() {
  const my = ++token;
  busy = true;
  render();
  try {
    while (!S.over) {
      if (my !== token) return;
      if (S.phase === 'tyndale') {
        ui.status = 'Tyndale is on the move…';
        render();
        await sleep(600);
        if (my !== token) return;
        const before = S.delivered.length;
        S = E.tyndaleMove(S, A.aiTyndalePath(S, cfg.skill));
        if (S.delivered.length > before) {
          const d = S.delivered[S.delivered.length - 1];
          ui.banner = `${E.PUB_NAMES[d.pub]} has reached London!`;
        }
        save(); render();
        if (S.over) break;
        if (S.accusation && S.accusation.open) { await accusations(my); if (my !== token) return; if (S.over) break; }
        continue;
      }
      if (S.phase === 'agents') {
        const actor = E.nextActor(S);
        if (!actor) { S = E.endAgentTurns(S); save(); continue; }
        if (actor.seat === 0 && humanIn()) { busy = false; ui.status = ''; render(); return; }
        await computerMove(actor, my);
        if (my !== token) return;
        continue;
      }
      break;
    }
  } finally { if (my === token) busy = false; }
  if (my === token) { save(); render(); if (S.over) showFinal(); }
}

async function computerMove(actor, my) {
  const nm = name(actor.seat);
  ui.status = `${nm} is hunting…`;
  render();
  await sleep(550);
  if (my !== token) return;
  if (!S.pending) S = E.rollFor(S, actor.pawnId);
  const { roll } = S.pending;
  const to = A.aiAgentChoose(S, actor.pawnId, roll, 'steady');
  const sup = E.isSupporterPawn(S, actor.pawnId);
  S = E.agentMove(S, actor.pawnId, roll, to, { share: sup ? A.supporterShares : undefined });
  const r = S.lastResult;
  say(`${nm} (rolled ${roll}) → ${to}: ${sup ? 'nothing to report' : describe(r)}.`);
  save(); render();
  if (S.over) return;
  await sleep(250);
}

// ---- accusing the Secret Supporter ---------------------------------------------------------------------------------------
async function accusations(my) {
  const active = S.seats.filter((s) => !s.out);
  const me = humanIn();
  const others = active.filter((s) => s.id !== 0);
  let accuser = null, accused = null;
  if (me && others.length > 1) {
    const r = await ask({
      title: `${E.PUB_NAMES[S.accusation.after]} has reached London`,
      text: 'One Agent may be Tyndale\'s Secret Supporter, who only ever reports &ldquo;Nothing to Report&rdquo;. Do you want to accuse someone? If most Agents vote with you and you are right, they are out of the game. If you are wrong, <b>you</b> are out.',
      list: others.map((s) => ({ label: s.name, value: s.id })),
      choices: [{ label: 'Accuse them', value: 'yes', cls: 'btn-danger' }, { label: 'No accusation', value: 'no', cls: 'btn-primary', esc: true }],
    });
    if (my !== token) return;
    if (r.value === 'yes') { accuser = 0; accused = Number(r.pick); }
  }
  if (accuser === null) {
    const c = A.aiAccusation(S, active.map((s) => s.id));
    if (c) { accuser = c.accuser; accused = c.accused; }
  }
  if (accuser === null) { S = E.closeAccusation(S); save(); return; }
  const votes = {};
  for (const s of active) {
    if (s.id === accuser) votes[s.id] = true;
    else if (s.id === 0) {
      const r = await ask({
        title: `${name(accuser)} accuses ${name(accused)}`,
        text: `${esc(name(accuser))} says ${esc(name(accused))} is the Secret Supporter. Do you vote to charge them?`,
        choices: [{ label: 'Yes, charge them', value: true, cls: 'btn-danger' }, { label: 'No', value: false, cls: 'btn-primary', esc: true }],
      });
      if (my !== token) return;
      votes[0] = r.value;
    } else votes[s.id] = A.aiVote(S, s.id, accused);
  }
  S = E.accuse(S, accuser, accused, votes);
  const res = S.accusationResult;
  const msg = !res.charged ? `The vote on ${name(accused)} fails (${res.yes} of ${res.of}).`
    : res.supporter ? `${name(accused)} was the Secret Supporter and is out of the game!`
      : `${name(accuser)} accused the wrong Agent and is out of the game.`;
  ui.banner = msg;
  save(); render();
  await ask({ title: 'The vote', text: esc(msg), choices: [{ label: 'Continue', value: 1, cls: 'btn-primary', esc: true }] });
}

// ---- your turn ----------------------------------------------------------------------------------------------------------------
function myPawns() { return S.pawns.filter((p) => p.seat === 0 && !p.out); }
function selectedPawn() {
  if (S.pending) return S.pending.pawnId;
  const free = myPawns().filter((p) => !S.moved.includes(p.id));
  if (!free.length) return null;
  return free.find((p) => p.id === ui.sel)?.id ?? free[0].id;
}
function onRoll() {
  if (busy || S.pending) return;
  const id = selectedPawn();
  S = E.rollFor(S, id);
  ui.mine = null; ui.banner = '';
  save(); render();
}
function onTarget(pos) {
  if (busy || !S.pending) return;
  const { pawnId, roll } = S.pending;
  S = E.agentMove(S, pawnId, roll, pos);
  const r = S.lastResult;
  ui.mine = { pos, loc: r.loc, bible: r.bible };
  say(`You (rolled ${roll}) → ${pos}: ${describe(r)}.`);
  ui.sel = null;
  save();
  if (S.over) { render(); showFinal(); return; }
  run();
}

// ---- placing the pawns ---------------------------------------------------------------------------------------------------
function onPlace(pos) {
  const next = S.pawns.find((p) => p.seat === 0 && p.pos === null);
  if (!next || E.pawnAt(S, pos)) return;
  S = E.placePawn(S, next.id, pos);
  if (!S.pawns.some((p) => p.seat === 0 && p.pos === null)) {
    for (const seat of S.seats) {
      if (seat.id === 0) continue;
      for (const o of A.aiPlacePawns(S, seat.id)) S = E.placePawn(S, o.pawn, o.pos);
    }
    S = E.startTyndale(S, A.aiTyndaleStart(S, cfg.skill));
    say('Tyndale has begun his work. The hunt is on!');
    save(); render(); run();
    return;
  }
  save(); render();
}
function onUndoPlace() {
  const placed = S.pawns.filter((p) => p.seat === 0 && p.pos !== null);
  if (!placed.length) return;
  S = structuredClone(S);
  S.pawns[placed[placed.length - 1].id].pos = null;
  save(); render();
}

// ---- drawing -----------------------------------------------------------------------------------------------------------------
const mk = (tag, attrs = {}, text) => {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (text !== undefined) n.textContent = text;
  return n;
};

function drawBoard() {
  const svg = $('board');
  svg.innerHTML = '';
  svg.appendChild(mk('image', { href: '../../assets/tyndale/board.webp', x: 0, y: 0, width: 800, height: 800 }));
  const placing = S.phase === 'place';
  // Coastal Cities: how many moves a shipment from here takes to reach London
  for (const c of E.coastal) {
    const d = E.pt[c].coast, g = mk('g', { 'pointer-events': 'none' });
    g.appendChild(mk('title', {}, `${c}: Coastal City, ${d >= 11 ? 'more than 10' : d} move${d === 1 ? '' : 's'} to London`));
    g.appendChild(mk('text', { x: x(c) + 17, y: y(c) - 17, 'font-size': 15, 'font-weight': 800, fill: '#0a7a2f', stroke: '#fff', 'stroke-width': 3, 'paint-order': 'stroke' }, d >= 11 ? '>10' : d));
    svg.appendChild(g);
  }
  // possible-spot heat map
  if (ui.heat && !placing && !S.over) {
    const P = A.belief(S, 0), max = Math.max(...Object.values(P));
    for (const id in P) {
      const a = Math.sqrt(P[id] / max);
      if (a < 0.12) continue;
      svg.appendChild(mk('rect', { x: x(id) - 31, y: y(id) - 31, width: 62, height: 62, rx: 8, fill: `rgba(220,38,38,${(a * 0.6).toFixed(2)})`, 'pointer-events': 'none' }));
    }
  }
  // his whole route, once the game is over
  if (ui.route && S.over) {
    const tr = S.t.trail;
    svg.appendChild(mk('polyline', { points: tr.map((p) => `${x(p)},${y(p)}`).join(' '), fill: 'none', stroke: '#a3262e', 'stroke-width': 4, 'stroke-dasharray': '9 6', 'stroke-linejoin': 'round', 'pointer-events': 'none' }));
    svg.appendChild(mk('circle', { cx: x(tr[0]), cy: y(tr[0]), r: 12, fill: '#198754', stroke: '#fff', 'stroke-width': 3 }));
    svg.appendChild(mk('text', { x: x(tr[0]), y: y(tr[0]) - 24, 'font-size': 16, 'font-weight': 700, fill: '#0f5132', stroke: '#fff', 'stroke-width': 3, 'paint-order': 'stroke' }, 'Start'));
    const e = tr[tr.length - 1];
    svg.appendChild(mk('circle', { cx: x(e), cy: y(e), r: 14, fill: '#a3262e', stroke: '#fff', 'stroke-width': 3 }));
    svg.appendChild(mk('text', { x: x(e), y: y(e) - 26, 'font-size': 16, 'font-weight': 700, fill: '#7a1f26', stroke: '#fff', 'stroke-width': 3, 'paint-order': 'stroke' }, 'Tyndale'));
  }
  // what the Agents have found
  for (const pos in S.found) {
    const f = S.found[pos], g = mk('g', {});
    g.appendChild(mk('title', {}, `${pos}: ${f.bible === 'nothing' ? 'nothing found' : f.bible === 'rumors' ? 'rumors only' : E.PUB_NAMES[f.bible]} (round ${f.round})`));
    if (E.PUBS.includes(f.bible)) { g.appendChild(mk('circle', { cx: x(pos), cy: y(pos), r: 17, class: 'mk-pub' })); g.appendChild(mk('text', { x: x(pos), y: y(pos) + 1, 'font-size': 20, 'font-weight': 800, fill: '#1b1b2e' }, f.bible)); }
    else if (f.bible === 'rumors') { g.appendChild(mk('circle', { cx: x(pos), cy: y(pos), r: 15, class: 'mk-rumor' })); g.appendChild(mk('text', { x: x(pos), y: y(pos) + 1, 'font-size': 17, 'font-weight': 800, fill: '#a3262e' }, 'R')); }
    else { g.appendChild(mk('circle', { cx: x(pos), cy: y(pos), r: 11, class: 'mk-none' })); g.appendChild(mk('text', { x: x(pos), y: y(pos) + 1, 'font-size': 16, fill: '#495057' }, '×')); }
    g.appendChild(mk('text', { x: x(pos) + 15, y: y(pos) - 15, 'font-size': 11, 'font-weight': 700, fill: '#1b1b2e', stroke: '#fff', 'stroke-width': 3, 'paint-order': 'stroke' }, `r${f.round}`));
    svg.appendChild(g);
  }
  // pawns
  for (const p of S.pawns) {
    if (p.out || p.pos === null) continue;
    const g = mk('g', { 'pointer-events': 'none' });
    const me = p.seat === 0;
    g.appendChild(mk('circle', { cx: x(p.pos), cy: y(p.pos), r: me ? 17 : 14, fill: SEAT_COLOURS[p.seat], stroke: '#fff', 'stroke-width': 3.5 }));
    g.appendChild(mk('text', { x: x(p.pos), y: y(p.pos) + 1, 'font-size': 15, 'font-weight': 800, fill: '#fff' }, me ? 'Y' : name(p.seat)[0]));
    g.appendChild(mk('title', {}, `${name(p.seat)}'s pawn at ${p.pos}`));
    svg.appendChild(g);
  }
  // clickable spots
  if (placing) {
    for (const pt of Array.from({ length: 121 }, (_, i) => E.idAt(Math.floor(i / 11), i % 11))) {
      if (E.pawnAt(S, pt)) continue;
      const c = mk('circle', { cx: x(pt), cy: y(pt), r: 24, class: 'hit', 'data-act': 'place', 'data-pos': pt, role: 'button', tabindex: 0, 'aria-label': `Place pawn at ${pt}` });
      svg.appendChild(c);
    }
  } else if (S.pending && !busy) {
    const p = S.pawns[S.pending.pawnId];
    for (const t of E.pawnTargets(S, p.id, S.pending.roll)) {
      const c = mk('circle', { cx: x(t), cy: y(t), r: 24, class: 'tgt pulse', 'data-act': 'target', 'data-pos': t, role: 'button', tabindex: 0, 'aria-label': t === p.pos ? `Stay at ${t}` : `Move to ${t}` });
      svg.appendChild(c);
    }
  }
}

function pubChips() {
  return `<span class="lbl">In London:</span>` + E.PUBS.map((l) => {
    const d = S.delivered.find((q) => q.pub === l);
    return `<span class="pub-chip${d ? ' on' : ''}" title="${E.PUB_NAMES[l]}${d ? ' (arrived turn ' + d.round + ')' : ''}">${l}</span>`;
  }).join('');
}

function card(id, cap) { return `<figure><img src="${CARD(id)}" alt="${esc(cap)}" /><figcaption>${esc(cap)}</figcaption></figure>`; }

function sideHtml() {
  const out = [];
  if (ui.banner) out.push(`<div class="ty-banner" role="status">${esc(ui.banner)}</div>`);
  if (S.phase === 'place') {
    const left = S.pawns.filter((p) => p.seat === 0 && p.pos === null).length, total = myPawns().length;
    out.push(`<div class="ty-card"><h2>Place your pawns</h2><p class="mb-2">Tap a spot on the map to place pawn ${total - left + 1} of ${total}. Spread out: Tyndale is somewhere in Europe and you are a long way from knowing where.</p>
      <p class="small text-muted">Tip: the named cities are Printing Centres, where he publishes. The coast is where he ships.</p>
      <button type="button" class="btn btn-outline-secondary btn-sm" data-do="undo" ${left === total ? 'disabled' : ''}>Undo last pawn</button></div>`);
  } else if (S.over) {
    out.push(`<div class="ty-card"><h2>Game over</h2><button type="button" class="btn btn-primary" data-do="results">See the results</button></div>`);
  } else if (!humanIn()) {
    out.push(`<div class="ty-card"><h2>You are out of the game</h2><p class="mb-0">${esc(ui.status || 'The other Agents play on…')}</p></div>`);
  } else if (busy) {
    out.push(`<div class="ty-card"><h2>Round ${S.round}</h2><p class="mb-0" aria-live="polite">${esc(ui.status || 'Waiting…')}</p></div>`);
  } else {
    const free = myPawns().filter((p) => !S.moved.includes(p.id)), sel = selectedPawn();
    const pick = myPawns().length > 1 ? `<div class="pawn-pick" role="group" aria-label="Choose a pawn">${myPawns().map((p, i) => `<button type="button" data-do="sel" data-id="${p.id}" aria-pressed="${p.id === sel}" ${S.moved.includes(p.id) || S.pending ? 'disabled' : ''}>Pawn ${i + 1} · ${p.pos}${S.moved.includes(p.id) ? ' ✓' : ''}</button>`).join('')}</div>` : '';
    if (S.pending) {
      const p = S.pawns[S.pending.pawnId], tg = E.pawnTargets(S, p.id, S.pending.roll);
      const boxed = tg.length === 1 && tg[0] === p.pos;
      out.push(`<div class="ty-card"><h2>Round ${S.round}: your move</h2>${pick}<div class="d-flex align-items-center"><span class="ty-roll" aria-label="You rolled ${S.pending.roll}">${S.pending.roll}</span><p class="mb-0">${boxed ? 'You are boxed in by other pawns.' : `Move pawn exactly <b>${S.pending.roll}</b> step${S.pending.roll > 1 ? 's' : ''}. Tap a highlighted spot.`}</p></div>${boxed ? '<button type="button" class="btn btn-primary mt-2" data-do="stay">Stay put</button>' : ''}</div>`);
    } else if (free.length) {
      out.push(`<div class="ty-card"><h2>Round ${S.round}: your turn</h2>${pick}<button type="button" class="btn btn-primary btn-lg" data-do="roll">Roll the die</button></div>`);
    }
  }
  if (ui.mine) {
    out.push(`<div class="ty-card"><h2>Report from ${esc(ui.mine.pos)}</h2><div class="report">${card(LOC_CARD[ui.mine.loc], LOC_TEXT[ui.mine.loc])}${card(BIB_CARD[ui.mine.bible], ui.mine.bible === 'rumors' ? 'Rumors' : ui.mine.bible === 'nothing' ? 'Nothing to report' : E.PUB_NAMES[ui.mine.bible])}</div></div>`);
  }
  if (cfg.hint && S.phase !== 'place' && !S.over) out.push(`<button type="button" class="btn btn-sm btn-outline-secondary mb-3" data-do="heat">${ui.heat ? 'Hide' : 'Show'} where he might be</button>`);
  out.push(`<div class="ty-card"><h2>The Agents</h2><ul class="seat-list">${S.seats.map((s) => `<li class="${s.out ? 'out' : ''}"><span class="seat-dot" style="background:${SEAT_COLOURS[s.id]}"></span>${esc(s.name)}${s.out ? ' (out)' : ''}</li>`).join('')}</ul>${S.seats.length >= 4 ? '<p class="small text-muted mb-0 mt-2">One of the Agents may be Tyndale\'s Secret Supporter.</p>' : ''}</div>`);
  const entries = S.log.filter((l) => l.pub).slice(-12).reverse();
  out.push(`<div class="ty-card"><h2>What has happened</h2><ul class="ty-log">${entries.map((l) => `<li><span class="rd">R${l.round}</span>${esc(l.text)}</li>`).join('') || '<li>Nothing yet.</li>'}</ul></div>`);
  return out.join('');
}

function render() {
  if (!S) return;
  $('bar-main').textContent = S.phase === 'place' ? 'Place your pawns' : S.over ? `Game over after ${S.round} turns` : `Round ${S.round}`;
  $('bar-pubs').innerHTML = pubChips();
  $('legend').innerHTML = '<b>On the map:</b> a letter (N, P, H, O) = a translation was found there; R = rumors of one; × = nothing; rNN = the round it was found. Your pawns have a Y. <b style="color:#0a7a2f">Green numbers</b> mark Coastal Cities: the moves a shipment from there takes to reach London.';
  drawBoard();
  $('side').innerHTML = sideHtml();
}

// ---- the end -----------------------------------------------------------------------------------------------------------------
function showFinal() {
  const sm = E.summary(S);
  const caught = sm.reason === 'captured';
  const captor = caught ? S.pawns[S.lastResult.pawnId].seat : null;
  let title;
  if (caught) title = captor === 0 ? 'You caught Tyndale!' : `${name(captor)} caught Tyndale!`;
  else if (sm.reason === 'delivered') title = 'Tyndale wins: the Old Testament reached London';
  else title = 'Tyndale wins: the Agents have been undone';
  const turnsLabel = caught ? 'turns to catch Tyndale' : sm.reason === 'delivered' ? 'turns to complete all the deliveries' : 'turns played';
  const items = sm.delivered.map((d) => `<li><b>${esc(d.name)}</b><small>delivered to London on turn ${d.round}</small></li>`).join('')
    + sm.shippedNotArrived.map((d) => `<li class="pending"><b>${esc(d.name)}</b><small>shipped, ${d.left} move${d.left === 1 ? '' : 's'} from London when the game ended</small></li>`).join('')
    + sm.undelivered.filter((n) => !sm.shippedNotArrived.some((q) => q.name === n)).map((n) => `<li class="no"><b>${esc(n)}</b><small>not delivered</small></li>`).join('');
  $('final-title').textContent = title;
  $('final-body').innerHTML = `<p class="mb-3"><span class="big-stat">${sm.turns}</span> <span class="text-muted">${turnsLabel}</span></p>
    <h3 class="h6">Scripture delivered to London</h3>
    ${sm.delivered.length ? '' : '<p class="mb-1">None: Tyndale was stopped before any part reached London.</p>'}
    <ul class="scripture-list">${items}</ul>
    ${S.supporter !== null ? `<p class="small mt-3 mb-0">The Secret Supporter was <b>${esc(name(S.supporter))}</b>${S.seats[S.supporter].out ? ' (already out)' : ''}.</p>` : S.seats.length >= 4 ? '<p class="small mt-3 mb-0">There was no Secret Supporter in this game.</p>' : ''}
    <p class="small mt-1 mb-0">Tyndale ended at <b>${S.t.pos}</b>.</p>`;
  $('final-route').textContent = ui.route ? 'Hide his route' : 'Show his route';
  $('final').showModal();
}

// ---- wiring --------------------------------------------------------------------------------------------------------------------
function onBoardClick(e) {
  const t = e.target.closest && e.target.closest('[data-act]');
  if (!t) return;
  const pos = t.getAttribute('data-pos');
  if (t.getAttribute('data-act') === 'place') onPlace(pos); else if (t.getAttribute('data-act') === 'target') onTarget(pos);
}
function onSideClick(e) {
  const b = e.target.closest && e.target.closest('[data-do]');
  if (!b || b.disabled) return;
  const d = b.getAttribute('data-do');
  if (d === 'roll') onRoll();
  else if (d === 'sel') { ui.sel = Number(b.getAttribute('data-id')); render(); }
  else if (d === 'stay') onTarget(S.pawns[S.pending.pawnId].pos);
  else if (d === 'undo') onUndoPlace();
  else if (d === 'heat') { ui.heat = !ui.heat; save(); render(); }
  else if (d === 'results') showFinal();
}

function init() {
  $('agents').addEventListener('change', () => { const n = Number($('agents').value); $('supp-note').hidden = !E.hasSupporter(n); });
  $('supp-note').hidden = !E.hasSupporter(Number($('agents').value));
  $('start-btn').addEventListener('click', () => { clearSave(); startGame(); });
  $('board').addEventListener('click', onBoardClick);
  $('board').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onBoardClick(e); } });
  $('side').addEventListener('click', onSideClick);
  $('menu-btn').addEventListener('click', () => {
    if (S && !S.over && !confirm('Leave this game? It will be lost.')) return;
    token++; clearSave(); S = null; show('setup'); $('resume').hidden = true;
  });
  $('final-route').addEventListener('click', () => { ui.route = !ui.route; $('final').close(); render(); });
  $('final-again').addEventListener('click', () => { token++; clearSave(); S = null; show('setup'); $('resume').hidden = true; });
  const saved = load();
  if (saved && !saved.S.over) {
    $('resume').hidden = false;
    $('resume-text').textContent = `You have a game in progress (round ${saved.S.round || 'setup'}).`;
    $('resume-btn').addEventListener('click', () => {
      S = saved.S; cfg = saved.cfg; ui = { sel: null, route: false, status: '', ...saved.ui };
      show('game'); render();
      if (S.phase !== 'place') run();
    });
    $('discard-btn').addEventListener('click', () => { clearSave(); $('resume').hidden = true; });
  }
}
init();
