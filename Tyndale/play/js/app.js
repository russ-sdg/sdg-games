// Tyndale: play online. Hunt mode: you are a Bishop's Agent; a computer plays Tyndale and the app answers with the cards.
import * as E from './engine.js';
import * as A from './ai.js';
import { PX, LONDON } from './board-data.js';
import { drawShareImage, canvasToBlob, nativeShareData, shareMessage } from './share.js';

const KEY = 'sdg-ty-play-1';
const $ = (id) => document.getElementById(id);
const SVGNS = 'http://www.w3.org/2000/svg';
const FAST = location.search.includes('fast');               // ?fast skips the pauses (for testing)
const sleep = (ms) => new Promise((r) => setTimeout(r, FAST ? 1 : ms));
const CARD = (id) => `../../assets/tyndale/cards/${id}-480.webp`;
const LOC_CARD = { here: 'here', not: 'not-here', near: 'near', far: 'far' };
const BIB_CARD = { N: 'new-testament', P: 'pentateuch', H: 'historical', O: 'old-testament', rumors: 'rumors', nothing: 'nothing' };
const LOC_TEXT = { here: 'Tyndale is here!', not: 'Tyndale is not here', near: 'Tyndale is near', far: 'Tyndale is far away' };
const SEAT_COLOURS = ['#0d6efd', '#e76f00', '#2a9d8f', '#8e44ad', '#6c757d'];
const AGENT_NAMES = ['Ashby', 'Brand', 'Carew', 'Dacre', 'Elyot', 'Fane'];   // not the names on the character cards, which stay hidden
// The six character cards dealt to the Agents (portraits are in assets/tyndale/cards). Players only see them at the end of the game, except their own.
const CHARACTERS = [{ id: 'vaughn', name: 'Stephen Vaughn' }, { id: 'holt', name: 'William Holt' }, { id: 'dobneck', name: 'John Dobneck' }, { id: 'stokesley', name: 'John Stokesley' }, { id: 'more', name: 'Thomas More' }, { id: 'phillips', name: 'Henry Phillips' }];
const charName = (id) => (CHARACTERS.find((c) => c.id === id) || {}).name;
const x = (id) => PX[E.colOf(id)], y = (id) => PX[E.rowOf(id)];

let S = null;                      // the game
let cfg = null;                    // {nAgents, skill, hint, seed}
let ui = { sel: null, heat: false, route: false, mine: null, banner: '', status: '', path: [], reveal: null };
let token = 0, busy = false;
const fastPace = () => FAST || (cfg && cfg.pace === 'fast');   // accelerated play: no stopping to look at each move
// Normal play stops after each computer move so you can see where it went and the cards it was shown.
let nextResolve = null;
function releaseNext() { const r = nextResolve; nextResolve = null; if (r) r(); }
function waitNext() { if (FAST) return Promise.resolve(); return new Promise((resolve) => { nextResolve = resolve; render(); }); }

// ---- saving ---------------------------------------------------------------------------------------------------------------
function save() { try { localStorage.setItem(KEY, JSON.stringify({ S, cfg, ui: { heat: ui.heat, mine: ui.mine, banner: ui.banner, path: ui.path } })); } catch (e) { /* private mode */ } }
function load() { try { const v = JSON.parse(localStorage.getItem(KEY)); return v && v.S && v.cfg ? v : null; } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }

// ---- small helpers ----------------------------------------------------------------------------------------------------------
const name = (seat) => S.seats[seat].name;
const TY = () => cfg.mode === 'tyndale';                      // you play Tyndale; every Agent is a computer
const humanIn = () => !TY() && !S.seats[0].out;           // a person is still hunting as seat 0
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function say(text) { S = E.logPublic(S, text); }
const describe = (r) => (r.bible === 'rumors' ? 'rumors of a translation nearby' : r.bible === 'nothing' ? 'nothing to report' : 'found ' + E.PUB_NAMES[r.bible]);
const meSupporter = () => !TY() && S.supporter === 0;          // you were dealt the Secret Supporter card

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
  const mode = document.querySelector('input[name=mode]:checked').value;
  const nAgents = Number($('agents').value);
  cfg = { mode, nAgents, skill: $('skill').value, aiSkill: $('aiskill').value, hint: mode === 'hunt' && $('hint').checked, pace: $('pace').value, seed: Number(new URLSearchParams(location.search).get('seed')) || Math.floor(Math.random() * 1e9) + 1 };   // ?seed=N replays a deal (for testing)
  const names = AGENT_NAMES.slice();
  for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(E.hash01(cfg.seed, 900 + i) * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
  const chars = CHARACTERS.map((c) => c.id);
  for (let i = chars.length - 1; i > 0; i--) { const j = Math.floor(E.hash01(cfg.seed, 930 + i) * (i + 1)); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  const seats = mode === 'tyndale' ? Array.from({ length: nAgents }, (_, i) => ({ name: names[i], human: false, char: chars[i] })) : [{ name: 'You', human: true, char: chars[0] }];
  if (mode === 'hunt') for (let i = 1; i < nAgents; i++) seats.push({ name: names[i - 1], human: false, char: chars[i] });
  // Six character cards are shuffled and dealt, one to each Agent; one of them is the Secret Supporter, so with 4 or more Agents
  // someone may hold it. When you hunt, nobody knows unless they are exposed (you may draw it yourself, and then you know). When you
  // are Tyndale, you know who it is.
  const drawn = Math.floor(E.hash01(cfg.seed, 950) * 6);
  const supporter = E.hasSupporter(nAgents) && drawn < nAgents ? drawn : null;
  S = E.newGame({ seats, seed: cfg.seed, supporter });
  if (mode === 'tyndale') for (const seat of S.seats) for (const o of A.aiPlacePawns(S, seat.id)) S = E.placePawn(S, o.pawn, o.pos);
  ui = { sel: null, heat: cfg.hint, route: false, mine: null, banner: '', status: '', path: [], reveal: null };
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
      if (S.phase === 'agents' && S.accusation && S.accusation.open) {          // a shipment has just arrived
        await accusations(my);
        if (my !== token) return;
        continue;
      }
      if (S.phase === 'tyndale' && TY()) {                                       // waiting for you to move Tyndale
        if (!E.canMove(S)) { S = E.trapped(S); save(); continue; }
        busy = false; ui.status = ''; render();
        return;
      }
      if (S.phase === 'tyndale') {
        ui.status = 'Tyndale is on the move…';
        ui.reveal = null;
        render();
        await sleep(fastPace() ? 600 : 1200);
        if (my !== token) return;
        const before = S.delivered.length;
        const path = A.aiTyndalePath(S, cfg.skill);
        if (!path) { S = E.trapped(S); save(); continue; }
        S = E.tyndaleMove(S, path);
        if (S.delivered.length > before) {
          const d = S.delivered[S.delivered.length - 1];
          ui.banner = `${E.PUB_NAMES[d.pub]} has reached London!`;
        }
        save(); render();
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
  ui.reveal = null;
  render();
  await sleep(fastPace() ? 550 : 450);
  if (my !== token) return;
  const from = S.pawns[actor.pawnId].pos;
  if (!S.pending) S = E.rollFor(S, actor.pawnId);
  const { roll } = S.pending;
  const to = TY() ? A.aiAgentChoose(S, actor.pawnId, roll, cfg.aiSkill, A.PEEK[cfg.aiSkill] || 0) : A.aiAgentChoose(S, actor.pawnId, roll, 'steady');
  const sup = E.isSupporterPawn(S, actor.pawnId);
  S = E.agentMove(S, actor.pawnId, roll, to, { report: sup ? (ans, pos, st) => A.supporterReport(st, ans, pos) : undefined });
  if (S.over) { save(); render(); return; }                  // the engine has logged the capture
  const r = S.lastResult;
  say(`${nm} (rolled ${roll}) → ${to}: ${describe({ bible: r.reported })}.`);
  // When you are Tyndale you see the cards each Agent was shown, and what they reported. When you hunt, you see only the report.
  ui.reveal = { name: nm, seat: actor.seat, roll, from, to, loc: r.loc, bible: r.bible, reported: r.reported, supporter: sup };
  save(); render();
  if (S.over) return;
  if (!fastPace()) { await waitNext(); ui.reveal = null; render(); if (my !== token) return; }
  else await sleep(250);
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
    else if (me && s.id === 0 && accused === 0) votes[0] = false;
    else if (me && s.id === 0) {
      const r = await ask({
        title: `${name(accuser)} ${name(accuser) === 'You' ? 'accuse' : 'accuses'} ${name(accused)}`,
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
    : res.supporter ? `${name(accused)} ${name(accused) === 'You' ? 'were' : 'was'} the Secret Supporter and ${name(accused) === 'You' ? 'are' : 'is'} out of the game!`
      : `${name(accuser)} accused the wrong Agent and ${name(accuser) === 'You' ? 'are' : 'is'} out of the game.`;
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
async function onTarget(pos) {
  if (busy || !S.pending) return;
  busy = true;
  const my = token;
  const { pawnId, roll } = S.pending;
  const sup = E.isSupporterPawn(S, pawnId);
  let choice = null;
  if (sup) {                                                   // you are the Secret Supporter: you decide what to report
    const ans = E.answerAt(S, pos, true);
    if (ans.loc !== 'here' && (ans.bible === 'rumors' || E.PUBS.includes(ans.bible))) {
      render();
      const r = await ask({
        title: 'What do you report?',
        text: `You were shown: <b>${esc(LOC_TEXT[ans.loc])}</b>; <b>${esc(ans.bible === 'rumors' ? 'Rumors of a Translation' : E.PUB_NAMES[ans.bible])}</b>. Tell the other Agents the truth, or say &ldquo;Nothing to report&rdquo;?`,
        choices: [{ label: 'Report what I was shown', value: 'truth', cls: 'btn-primary' }, { label: 'Nothing to report', value: 'nothing', cls: 'btn-outline-secondary', esc: true }],
      });
      if (my !== token) return;
      choice = r.value;
    }
  }
  S = E.agentMove(S, pawnId, roll, pos, { report: sup ? (ans) => (choice === 'truth' ? ans.bible : null) : undefined });
  const r = S.lastResult;
  ui.mine = { pos, loc: r.loc, bible: r.bible, reported: sup ? r.reported : null };
  if (!S.over) say(`You (rolled ${roll}) → ${pos}: ${describe({ bible: r.reported })}.`);
  ui.sel = null; ui.reveal = null;
  save();
  if (S.over) { busy = false; render(); showFinal(); return; }
  if (!fastPace()) {                                           // stop so you can read your own report before the others move
    ui.ackMine = true; render();
    await waitNext();
    ui.ackMine = false;
    if (my !== token) return;
  }
  run();
}

// ---- playing Tyndale ---------------------------------------------------------------------------------------------------------
function onStart(pos) {
  if (!TY() || S.phase !== 'place' || E.pawnAt(S, pos)) return;
  S = E.startTyndale(S, pos);
  say('Tyndale has set out. The Bishop\'s Agents are searching for him.');
  save(); render(); run();
}
function onStep(pos) {
  if (busy || !TY() || S.phase !== 'tyndale') return;
  if (!E.tyndaleNext(S, ui.path).steps.includes(pos)) return;
  ui.path = [...ui.path, pos];
  render();
}
function onFinishMove() {
  if (busy || !TY() || S.phase !== 'tyndale' || !E.checkTyndalePath(S, ui.path).ok) return;
  const before = S.delivered.length;
  S = E.tyndaleMove(S, ui.path);
  ui.path = []; ui.banner = '';
  if (S.delivered.length > before) ui.banner = `${E.PUB_NAMES[S.delivered[S.delivered.length - 1].pub]} has reached London!`;
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
  // playing Tyndale: your route so far, the marks you have left behind, and the move you are planning
  if (TY() && S.t.pos !== null) {
    const tr = S.t.trail;
    svg.appendChild(mk('polyline', { points: tr.map((p) => `${x(p)},${y(p)}`).join(' '), fill: 'none', stroke: '#a3262e', 'stroke-width': 3, 'stroke-dasharray': '3 7', 'stroke-linecap': 'round', opacity: 0.8, 'pointer-events': 'none' }));
    for (const pos in S.t.marks) {
      if (S.found[pos]) continue;
      const g = mk('g', { 'pointer-events': 'none', opacity: 0.85 });
      g.appendChild(mk('title', {}, `${pos}: you left a page of ${E.PUB_NAMES[S.t.marks[pos]]} here`));
      g.appendChild(mk('circle', { cx: x(pos), cy: y(pos), r: 12, fill: 'rgba(240,195,106,.55)', stroke: '#8a5a00', 'stroke-width': 2, 'stroke-dasharray': '3 2' }));
      g.appendChild(mk('text', { x: x(pos), y: y(pos) + 1, 'font-size': 14, 'font-weight': 800, fill: '#5a3b00' }, S.t.marks[pos]));
      svg.appendChild(g);
    }
  }
  // what the Agents have found, ringed in the colour of the Agent who found it
  const mark = (pos, f, opts = {}) => {
    const col = SEAT_COLOURS[f.by] || '#6c757d', g = mk('g', {});
    const who = f.by === 0 && S.seats[0].human ? 'You' : name(f.by);
    const what = f.bible === 'nothing' ? 'nothing found' : f.bible === 'rumors' ? 'rumors only' : E.PUB_NAMES[f.bible];
    g.appendChild(mk('title', {}, `${pos}: ${what} (round ${f.round}, ${who})${opts.tip || ''}`));
    const ring = (r, cls) => g.appendChild(mk('circle', { cx: x(pos), cy: y(pos), r, class: cls, style: `stroke:${col};stroke-width:3.5` }));
    if (E.PUBS.includes(f.bible)) { ring(17, 'mk-pub'); g.appendChild(mk('text', { x: x(pos), y: y(pos) + 1, 'font-size': 20, 'font-weight': 800, fill: '#1b1b2e' }, f.bible)); }
    else if (f.bible === 'rumors') { ring(15, 'mk-rumor'); g.appendChild(mk('text', { x: x(pos), y: y(pos) + 1, 'font-size': 17, 'font-weight': 800, fill: '#a3262e' }, 'R')); }
    else { ring(11, 'mk-none'); g.appendChild(mk('text', { x: x(pos), y: y(pos) + 1, 'font-size': 16, 'font-weight': 700, fill: col }, '×')); }
    g.appendChild(mk('text', { x: x(pos) + 15, y: y(pos) - 15, 'font-size': 11, 'font-weight': 700, fill: '#1b1b2e', stroke: '#fff', 'stroke-width': 3, 'paint-order': 'stroke' }, `r${f.round}${opts.tag || ''}`));
    svg.appendChild(g);
  };
  for (const pos in S.found) if (!(meSupporter() && S.private[pos] && S.found[pos].by === 0)) mark(pos, S.found[pos]);
  // the Secret Supporter (you) sees what the cards really showed, including what was held back
  if (meSupporter()) {
    for (const pos in S.private) {
      const f = S.private[pos], told = S.found[pos] && S.found[pos].by === 0 ? S.found[pos].bible : 'nothing';
      if (S.found[pos] && S.found[pos].by !== 0) continue;
      mark(pos, f, { tag: f.loc === 'near' ? ' near' : f.loc === 'far' ? ' far' : '', tip: `; Tyndale was ${f.loc === 'here' ? 'here' : f.loc === 'near' ? 'near' : 'far away'}${told !== f.bible ? '; you reported ' + (told === 'nothing' ? 'nothing' : E.PUB_NAMES[told] || told) : ''}` });
    }
  }
  // playing Tyndale: ghosts of the shipments on their way to London
  if (TY()) {
    const lx = x(LONDON), ly = y(LONDON);
    for (const q of S.shipments) {
      if (q.arrived) continue;
      const f = q.dist > 0 ? (q.dist - q.left) / q.dist : 1, gx = x(q.from) + (lx - x(q.from)) * f, gy = y(q.from) + (ly - y(q.from)) * f;
      const g = mk('g', { 'pointer-events': 'none', opacity: 0.6 });
      g.appendChild(mk('title', {}, `${E.PUB_NAMES[q.pub]}: shipped from ${q.from}, ${q.left} to go${q.fresh ? ' (sails after this turn)' : ''}`));
      g.appendChild(mk('line', { x1: x(q.from), y1: y(q.from), x2: lx, y2: ly, stroke: '#2a6f97', 'stroke-width': 3, 'stroke-dasharray': '2 8', 'stroke-linecap': 'round' }));
      g.appendChild(mk('circle', { cx: gx, cy: gy, r: 15, fill: 'rgba(200,225,245,.75)', stroke: '#2a6f97', 'stroke-width': 3, 'stroke-dasharray': '4 3' }));
      g.appendChild(mk('text', { x: gx, y: gy + 1, 'font-size': 17, 'font-weight': 800, fill: '#1d4e6e' }, q.pub));
      g.appendChild(mk('text', { x: gx + 17, y: gy + 20, 'font-size': 12, 'font-weight': 800, fill: '#1d4e6e', stroke: '#fff', 'stroke-width': 3, 'paint-order': 'stroke' }, String(q.left)));
      svg.appendChild(g);
    }
  }
  // pawns
  for (const p of S.pawns) {
    if (p.out || p.pos === null) continue;
    const g = mk('g', { 'pointer-events': 'none' });
    const me = p.seat === 0 && S.seats[0].human;
    g.appendChild(mk('circle', { cx: x(p.pos), cy: y(p.pos), r: me ? 17 : 14, fill: SEAT_COLOURS[p.seat], stroke: '#fff', 'stroke-width': 3.5 }));
    g.appendChild(mk('text', { x: x(p.pos), y: y(p.pos) + 1, 'font-size': 15, 'font-weight': 800, fill: '#fff' }, me ? 'Y' : name(p.seat)[0]));
    g.appendChild(mk('title', {}, `${name(p.seat)}'s pawn at ${p.pos}`));
    svg.appendChild(g);
  }
  // the move just shown
  if (ui.reveal && ui.reveal.from !== ui.reveal.to) {
    const rv = ui.reveal;
    svg.appendChild(mk('line', { x1: x(rv.from), y1: y(rv.from), x2: x(rv.to), y2: y(rv.to), stroke: SEAT_COLOURS[rv.seat], 'stroke-width': 6, 'stroke-dasharray': '2 9', 'stroke-linecap': 'round', 'pointer-events': 'none' }));
    svg.appendChild(mk('circle', { cx: x(rv.to), cy: y(rv.to), r: 25, fill: 'none', stroke: SEAT_COLOURS[rv.seat], 'stroke-width': 4, 'pointer-events': 'none' }));
  }
  // Tyndale himself, and the path being planned
  if (TY() && S.t.pos !== null) {
    if (ui.path.length && !S.over) {
      const pts = [S.t.pos, ...ui.path];
      svg.appendChild(mk('polyline', { points: pts.map((p) => `${x(p)},${y(p)}`).join(' '), fill: 'none', stroke: '#f0c36a', 'stroke-width': 7, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'pointer-events': 'none' }));
      ui.path.forEach((p, i) => { svg.appendChild(mk('circle', { cx: x(p), cy: y(p), r: 11, fill: '#232a5c', stroke: '#f0c36a', 'stroke-width': 3, 'pointer-events': 'none' })); svg.appendChild(mk('text', { x: x(p), y: y(p) + 1, 'font-size': 13, 'font-weight': 800, fill: '#fff', 'pointer-events': 'none' }, String(i + 1))); });
    }
    const g = mk('g', { 'pointer-events': 'none' });
    g.appendChild(mk('circle', { cx: x(S.t.pos), cy: y(S.t.pos), r: 19, fill: '#a3262e', stroke: '#f0c36a', 'stroke-width': 4 }));
    g.appendChild(mk('text', { x: x(S.t.pos), y: y(S.t.pos) + 1, 'font-size': 18, 'font-weight': 800, fill: '#fff' }, 'T'));
    g.appendChild(mk('title', {}, `Tyndale at ${S.t.pos}`));
    svg.appendChild(g);
  }
  // clickable spots
  if (TY() && placing) {
    for (const pt of Array.from({ length: 121 }, (_, i) => E.idAt(Math.floor(i / 11), i % 11))) {
      if (E.pawnAt(S, pt)) continue;
      svg.appendChild(mk('circle', { cx: x(pt), cy: y(pt), r: 24, class: 'hit', 'data-act': 'start', 'data-pos': pt, role: 'button', tabindex: 0, 'aria-label': `Start Tyndale at ${pt}` }));
    }
  } else if (TY() && S.phase === 'tyndale' && !busy && !S.over) {
    for (const t of E.tyndaleNext(S, ui.path).steps) svg.appendChild(mk('circle', { cx: x(t), cy: y(t), r: 24, class: 'tgt pulse', 'data-act': 'step', 'data-pos': t, role: 'button', tabindex: 0, 'aria-label': `Step to ${t}${E.pawnAt(S, t) ? ' (an Agent is there)' : ''}` }));
  } else if (placing) {
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

function tyndaleSide(out) {
  const t = S.t;
  if (S.phase === 'place') {
    out.push(`<div class="ty-card"><h2>Where does Tyndale begin?</h2><p class="mb-2">The Agents have placed their pawns. Tap the spot where Tyndale starts. A Printing Centre on the coast lets you publish and ship straight away.</p>
      <p class="small text-muted mb-0">You cannot start on an Agent's spot.</p></div>`);
  } else if (S.over) {
    out.push(`<div class="ty-card"><h2>Game over</h2><button type="button" class="btn btn-primary" data-do="results">See the results</button></div>`);
  } else if (busy) {
    if (!(ui.reveal && nextResolve)) out.push(`<div class="ty-card"><h2>Round ${S.round}</h2><p class="mb-0" aria-live="polite">${esc(ui.status || 'The Agents are hunting…')}</p></div>`);
  } else {
    const n = ui.path.length, base = n ? (E.pt[ui.path[0]].kind === 'blue' ? 2 : 1) : 1, total = base + t.bonus.length;
    const chk = n ? E.checkTyndalePath(S, ui.path) : { ok: false, reason: 'move at least one step' };
    const msg = chk.ok ? (chk.needBonus ? `Uses ${chk.needBonus} bonus move${chk.needBonus > 1 ? 's' : ''}.` : 'Ready to go.') : chk.reason.charAt(0).toUpperCase() + chk.reason.slice(1) + '.';
    out.push(`<div class="ty-card"><h2>Round ${S.round}: move Tyndale</h2>
      <p class="mb-2">Tap the highlighted spots to step along. ${base === 2 ? `Your first spot is blue, so you get a second step free${t.bonus.length ? `, plus up to ${t.bonus.length} more from bonus moves` : ''}: up to <b>${total}</b> steps.` : `You may move <b>1</b> step${t.bonus.length ? `, plus up to ${t.bonus.length} more using bonus moves` : ''}. A blue first spot gives a free second step.`}</p>
      <p class="small mb-2" aria-live="polite">${esc(msg)} ${n ? `Steps planned: ${n}.` : ''}</p>
      <div class="d-flex flex-wrap gap-2"><button type="button" class="btn btn-primary" data-do="finish" ${chk.ok ? '' : 'disabled'}>Finish move</button>
      <button type="button" class="btn btn-outline-secondary" data-do="undostep" ${n ? '' : 'disabled'}>Undo step</button></div></div>`);
  }
  if (S.phase !== 'place') {
    const next = t.published < t.translated ? `${E.PUB_NAMES[E.PUBS[t.translated]]} is translated. Reach a Printing Centre you have not used to publish it.`
      : t.published > t.shipped ? `${E.PUB_NAMES[E.PUBS[t.published]]} is printed. Reach a Coastal City to ship it.`
        : 'Everything is shipped. Keep out of sight until the last shipment reaches London.';
    const sea = S.shipments.filter((q) => !q.arrived);
    const lastO = sea.find((q) => q.pub === 'O'), lastTurns = lastO ? lastO.left + (lastO.fresh ? 1 : 0) : null;
    out.push(`<div class="ty-card"><h2>Your scorecard</h2>
      <p class="mb-2">${esc(next)}</p>
      <ul class="small mb-2">
        <li>Bonus moves: <b>${t.bonus.length ? t.bonus.join(' ') : 'none'}</b></li>
        <li>Printing Centres used: <b>${t.visited.length}</b> of 17${t.visited.length ? `<br><span class="text-muted">${esc(t.visited.map((id) => E.pt[id].centre).join(', '))}</span>` : ''}</li>
        <li>Shipments at sea: ${sea.length ? '<ul>' + sea.map((q) => `<li>${esc(E.PUB_NAMES[q.pub])}: <b>${q.left}</b> to go${q.fresh ? ' (sails after this turn)' : ''}<div class="ship-bar" title="${q.dist - q.left} of ${q.dist} moves" aria-hidden="true"><i style="width:${Math.round(100 * (q.dist - q.left) / q.dist)}%"></i></div></li>`).join('') + '</ul>' : '<b>none</b>'}</li>
      </ul>${lastTurns !== null ? `<p class="small mb-2"><b>Stay free for ${lastTurns} more turn${lastTurns === 1 ? '' : 's'}</b>: that is when the Old Testament reaches London and you win.</p>` : ''}<p class="small text-muted mb-0">A shipment is crossed off one number each turn after it sails. At zero it reaches London. Your gold letters on the map are the pages you have left behind; the pale blue ghosts show each shipment sailing towards London.</p></div>`);
  }
  if (cfg.nAgents >= 4 && S.supporter !== null) out.push(`<div class="ty-card"><h2>Your Secret Supporter</h2><p class="mb-0"><b>${esc(S.seats[S.supporter].name)}</b>${S.seats[S.supporter].out ? ' (out of the game)' : ''} is on your side. They report only &ldquo;nothing to report&rdquo; to the other Agents, and may carry a printed Bible to the coast for you.</p></div>`);
  out.push(`<div class="ty-card"><h2>The Agents</h2><ul class="seat-list">${S.seats.map((q) => `<li class="${q.out ? 'out' : ''}"><span class="seat-dot" style="background:${SEAT_COLOURS[q.id]}"></span>${esc(q.name)}${q.out ? ' (out)' : ''}${q.id === S.supporter ? ' ★' : ''}</li>`).join('')}</ul></div>`);
  const entries = S.log.slice(-14).reverse();
  out.push(`<div class="ty-card"><h2>What has happened</h2><ul class="ty-log">${entries.map((l) => `<li><span class="rd">R${l.round}</span>${l.pub ? '' : '<b>You: </b>'}${esc(l.text.replace(/^Tyndale /, l.pub ? 'Tyndale ' : ''))}</li>`).join('') || '<li>Nothing yet.</li>'}</ul></div>`);
  return out.join('');
}

function repText(b) { return b === 'rumors' ? 'Rumors of a translation nearby' : b === 'nothing' ? 'Nothing to report' : `Found ${E.PUB_NAMES[b]}`; }
function revealHtml() {
  const r = ui.reveal;
  if (!r) return '';
  const cap = (id) => (id === 'rumors' ? 'Rumors' : id === 'nothing' ? 'Nothing to report' : E.PUB_NAMES[id]);
  const btns = nextResolve ? '<div class="d-flex gap-2 mt-3"><button type="button" class="btn btn-primary" data-do="next">Next</button><button type="button" class="btn btn-outline-secondary btn-sm" data-do="faster">Speed up</button></div>' : '';
  const move = r.from === r.to ? `Stayed at <b>${esc(r.to)}</b>` : `Moved <b>${esc(r.from)}</b> → <b>${esc(r.to)}</b>`;
  if (TY()) {                                                  // you are Tyndale: you show the cards, so you see them
    return `<div class="ty-card ty-reveal"><h2>${esc(r.name)} rolled ${r.roll}</h2>
      <p class="mb-2">${move}. ${r.supporter ? 'Your Secret Supporter was shown:' : 'Shown the cards:'}</p>
      <div class="report">${card(LOC_CARD[r.loc], LOC_TEXT[r.loc])}${card(BIB_CARD[r.bible], cap(r.bible))}</div>
      <p class="mt-2 mb-0"><b>Reports:</b> ${esc(repText(r.reported))}</p>${btns}</div>`;
  }
  return `<div class="ty-card ty-reveal"><h2>${esc(r.name)} rolled ${r.roll}</h2>
    <p class="mb-1">${move}.</p><p class="mb-0"><b>Reports:</b> ${esc(repText(r.reported))}</p>${btns}</div>`;
}

function mineHtml() {
  const m = ui.mine;
  const cap = m.bible === 'rumors' ? 'Rumors' : m.bible === 'nothing' ? 'Nothing to report' : E.PUB_NAMES[m.bible];
  const btn = ui.ackMine && nextResolve ? '<div class="d-flex gap-2 mt-3"><button type="button" class="btn btn-primary" data-do="next">Next</button><button type="button" class="btn btn-outline-secondary btn-sm" data-do="faster">Speed up</button></div>' : '';
  return `<div class="ty-card ty-reveal ty-mine"><h2>Your report from ${esc(m.pos)}</h2><div class="report">${card(LOC_CARD[m.loc], LOC_TEXT[m.loc])}${card(BIB_CARD[m.bible], cap)}</div>${m.reported ? `<p class="mt-2 mb-0"><b>You reported:</b> ${esc(repText(m.reported))}</p>` : ''}${btn}</div>`;
}

function sideHtml() {
  const out = [];
  if (ui.banner) out.push(`<div class="ty-banner" role="status">${esc(ui.banner)}</div>`);
  if (ui.ackMine && ui.mine) out.push(mineHtml());
  out.push(revealHtml());
  if (TY()) return tyndaleSide(out);
  if (S.seats[0].char && !S.over) out.push(`<div class="ty-card id-card"><img src="${CARD(S.seats[0].char)}" alt="${esc(charName(S.seats[0].char))}" /><div><h2>Your identity</h2><p class="mb-0">You are <b>${esc(charName(S.seats[0].char))}</b>, a Bishop's Agent.</p></div></div>`);
  if (meSupporter() && S.phase !== 'place' && !S.over) out.push(`<div class="ty-card"><h2>You are the Secret Supporter</h2><p class="mb-0">You are on Tyndale's side. When you are shown Rumors or a translation you choose whether to report it or say &ldquo;nothing to report&rdquo;. A printed Bible you find, you carry to the coast and ship for him. If the others accuse you and you are exposed, you are out.</p></div>`);
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
    if (!(ui.reveal && nextResolve) && !ui.ackMine) out.push(`<div class="ty-card"><h2>Round ${S.round}</h2><p class="mb-0" aria-live="polite">${esc(ui.status || 'Waiting…')}</p></div>`);
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
  if (ui.mine && !ui.ackMine) out.push(mineHtml());
  if (cfg.hint && S.phase !== 'place' && !S.over) out.push(`<button type="button" class="btn btn-sm btn-outline-secondary mb-3" data-do="heat">${ui.heat ? 'Hide' : 'Show'} where he might be</button>`);
  out.push(`<div class="ty-card"><h2>The Agents</h2><ul class="seat-list">${S.seats.map((s) => `<li class="${s.out ? 'out' : ''}"><span class="seat-dot" style="background:${SEAT_COLOURS[s.id]}"></span>${esc(s.name)}${s.out ? ' (out)' : ''}</li>`).join('')}</ul>${S.seats.length >= 4 && !meSupporter() ? '<p class="small text-muted mb-0 mt-2">One of the Agents may be Tyndale\'s Secret Supporter.</p>' : ''}</div>`);
  const entries = S.log.filter((l) => l.pub || meSupporter()).slice(-12).reverse();
  out.push(`<div class="ty-card"><h2>What has happened</h2><ul class="ty-log">${entries.map((l) => `<li><span class="rd">R${l.round}</span>${l.pub ? '' : '<b>Secret: </b>'}${esc(l.text)}</li>`).join('') || '<li>Nothing yet.</li>'}</ul></div>`);
  return out.join('');
}

function render() {
  if (!S) return;
  $('bar-main').textContent = S.phase === 'place' ? (TY() ? 'Choose where Tyndale begins' : 'Place your pawns') : S.over ? `Game over after ${S.round} turns` : `Round ${S.round}`;
  $('bar-pubs').innerHTML = pubChips();
  $('legend').innerHTML = TY() ? '<b>On the map:</b> <b>T</b> = Tyndale (you); dotted red line = your route; gold letters = pages you have left; round markers (N, P, H, O, R, ×) = what the Agents have found, ringed in the colour of the Agent who found it; pale blue dashed ghosts = your shipments sailing to London. <b style="color:#0a7a2f">Green numbers</b> mark Coastal Cities: the moves a shipment from there takes to reach London.' : '<b>On the map:</b> a letter (N, P, H, O) = a translation was found there; R = rumors of one; × = nothing; rNN = the round it was found. Each marker is ringed in the colour of the Agent who found it (your own are shown as you saw them' + (meSupporter() ? ', including what you held back' : '') + '). Your pawns have a Y. <b style="color:#0a7a2f">Green numbers</b> mark Coastal Cities: the moves a shipment from there takes to reach London.';
  drawBoard();
  $('side').innerHTML = sideHtml();
  updatePaceBtn();
  if (nextResolve) { const el = document.querySelector('.ty-reveal'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' }); }
}

// ---- the end -----------------------------------------------------------------------------------------------------------------
function showFinal() {
  const sm = E.summary(S);
  const caught = sm.reason === 'captured';
  const captor = caught ? S.pawns[S.lastResult.pawnId].seat : null;
  const n = sm.turns;
  let title, headline;
  if (TY()) {
    if (sm.reason === 'delivered') { title = 'You got the Bible to London!'; headline = `I got the whole Bible to London as Tyndale in ${n} turns!`; }
    else if (sm.reason === 'no-hunters') { title = 'Every Agent is out: you win!'; headline = 'I outwitted every Bishop\'s Agent as Tyndale!'; }
    else if (sm.reason === 'trapped') { title = 'You were surrounded!'; headline = `The Bishop's Agents trapped me as Tyndale on turn ${n}.`; }
    else { title = `${name(captor)} caught you!`; headline = `The Bishop's Agents caught me as Tyndale on turn ${n}.`; }
  } else if (caught) { title = name(captor) === 'You' ? 'You caught Tyndale!' : `${name(captor)} caught Tyndale!`; headline = name(captor) === 'You' ? `I caught Tyndale in ${n} turns!` : `We caught Tyndale in ${n} turns!`; }
  else if (sm.reason === 'delivered') { title = 'Tyndale wins: the Old Testament reached London'; headline = `Tyndale got the whole Bible to London in ${n} turns before we could stop him.`; }
  else { title = 'Tyndale wins: the Agents have been undone'; headline = 'Tyndale outwitted the Bishop\'s Agents.'; }
  const turnsLabel = TY() ? (sm.reason === 'delivered' ? 'turns to complete all the deliveries' : 'turns until you were caught')
    : caught ? 'turns to catch Tyndale' : sm.reason === 'delivered' ? 'turns to complete all the deliveries' : 'turns played';
  const items = sm.delivered.map((d) => `<li><b>${esc(d.name)}</b><small>delivered to London on turn ${d.round}</small></li>`).join('')
    + sm.shippedNotArrived.map((d) => `<li class="pending"><b>${esc(d.name)}</b><small>shipped, ${d.left} move${d.left === 1 ? '' : 's'} from London when the game ended</small></li>`).join('')
    + sm.undelivered.filter((q) => !sm.shippedNotArrived.some((z) => z.name === q)).map((q) => `<li class="no"><b>${esc(q)}</b><small>not delivered</small></li>`).join('');
  $('final-title').textContent = title;
  $('final-body').innerHTML = `<p class="mb-3"><span class="big-stat">${sm.turns}</span> <span class="text-muted">${turnsLabel}</span></p>
    <h3 class="h6">Scripture delivered to London</h3>
    ${sm.delivered.length ? '' : `<p class="mb-1">None: ${TY() ? 'you were stopped' : 'Tyndale was stopped'} before any part reached London.</p>`}
    <ul class="scripture-list">${items}</ul>
    ${S.supporter !== null ? `<p class="small mt-3 mb-0">The Secret Supporter was <b>${esc(name(S.supporter))}</b>${S.seats[S.supporter].out ? ' (already out)' : ''}.</p>` : S.seats.length >= 4 ? '<p class="small mt-3 mb-0">There was no Secret Supporter in this game.</p>' : ''}
    ${S.seats.some((q) => q.char) ? `<h3 class="h6 mt-3">The Bishop's Agents</h3><ul class="agent-reveal">${S.seats.map((q) => `<li class="${q.out ? 'out' : ''}">${q.char ? `<img src="${CARD(q.char)}" alt="" />` : ''}<span><span class="seat-dot" style="background:${SEAT_COLOURS[q.id]}"></span><b>${esc(q.char ? charName(q.char) : q.name)}</b><small>${q.human ? 'You' : esc(q.name)}${q.id === S.supporter ? ' · Secret Supporter' : ''}${q.out ? ' · out' : ''}</small></span></li>`).join('')}</ul>` : ''}
    <p class="small mt-1 mb-0">Tyndale ended at <b>${S.t.pos}</b>.</p>`;
  $('final-route').textContent = ui.route ? 'Hide his route' : 'Show his route';
  const detail = TY() ? `You played Tyndale\n${cfg.nAgents} computer Agent${cfg.nAgents > 1 ? 's' : ''}, ${cfg.aiSkill}` : `${cfg.nAgents} Agent${cfg.nAgents > 1 ? 's' : ''} hunting\nTyndale: ${cfg.skill}`;
  mountShare($('final-body'), headline, { title, turnsLabel, detail, boardSrc: '../../assets/tyndale/board.webp' });
  $('final').showModal();
}

// Share the result as a picture: native share sheet where the browser offers it, plus a download.
async function mountShare(root, headline, info) {
  const box = document.createElement('div');
  box.className = 'share-box';
  box.innerHTML = `<div class="share-actions"><button type="button" class="btn btn-primary btn-sm" id="share-dl" disabled>Download image</button>
    <button type="button" class="btn btn-outline-primary btn-sm" id="share-native" hidden>Share\u2026</button>
    <button type="button" class="btn btn-outline-secondary btn-sm" id="share-copy">Copy text</button></div>
    <img class="share-preview" alt="The finished game: the board with Tyndale's route" width="1200" height="1040" hidden>
    <p class="small text-muted mb-0" id="share-msg" aria-live="polite">Drawing your result card\u2026</p>`;
  root.appendChild(box);
  const img = box.querySelector('.share-preview'), msg = box.querySelector('#share-msg');
  const dl = box.querySelector('#share-dl'), nat = box.querySelector('#share-native'), copy = box.querySelector('#share-copy');
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(shareMessage(headline)); msg.textContent = 'Copied. Paste it anywhere.'; }
    catch { msg.textContent = shareMessage(headline); }
  };
  try {
    const canvas = await drawShareImage(document.createElement('canvas'), S, info);
    const blob = await canvasToBlob(canvas);
    const url = URL.createObjectURL(blob);
    img.src = url; img.hidden = false; dl.disabled = false; msg.textContent = '';
    const file = new File([blob], 'tyndale.png', { type: 'image/png' });
    nat.hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    dl.onclick = () => { const a = document.createElement('a'); a.href = url; a.download = 'tyndale.png'; document.body.appendChild(a); a.click(); a.remove(); };
    nat.onclick = async () => { try { await navigator.share(nativeShareData(file, headline)); } catch { /* cancelled */ } };
  } catch {
    msg.textContent = 'Sorry, the result card could not be drawn in this browser. You can still copy the text.';
  }
}

// ---- wiring --------------------------------------------------------------------------------------------------------------------
function onBoardClick(e) {
  const t = e.target.closest && e.target.closest('[data-act]');
  if (!t) return;
  const pos = t.getAttribute('data-pos');
  const act = t.getAttribute('data-act');
  if (act === 'place') onPlace(pos); else if (act === 'target') onTarget(pos); else if (act === 'start') onStart(pos); else if (act === 'step') onStep(pos);
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
  else if (d === 'finish') onFinishMove();
  else if (d === 'next') releaseNext();
  else if (d === 'faster') { cfg.pace = 'fast'; save(); updatePaceBtn(); releaseNext(); }
  else if (d === 'undostep') { ui.path = ui.path.slice(0, -1); render(); }
}

function updatePaceBtn() { const b = $('pace-btn'); if (b && cfg) b.textContent = `Pace: ${cfg.pace === 'fast' ? 'accelerated' : 'normal'}`; }

function init() {
  $('pace-btn').addEventListener('click', () => { cfg.pace = cfg.pace === 'fast' ? 'normal' : 'fast'; save(); updatePaceBtn(); if (cfg.pace === 'fast') releaseNext(); });
  const setup = () => {
    const mode = document.querySelector('input[name=mode]:checked').value, sel = $('agents'), keep = sel.value || '4';
    const opts = mode === 'tyndale'
      ? ['1 Agent, with 4 pawns', '2 Agents, 2 pawns each', '3 Agents', '4 Agents (one may be your Secret Supporter)', '5 Agents (one may be your Secret Supporter)']
      : ['1 \u2013 you, with 4 pawns', '2 \u2013 you and a computer, 2 pawns each', '3 \u2013 you and 2 computers', '4 \u2013 you and 3 computers', '5 \u2013 you and 4 computers'];
    sel.innerHTML = opts.map((t, i) => `<option value="${i + 1}">${t}</option>`).join('');
    sel.value = keep;
    $('agents-label').textContent = mode === 'tyndale' ? 'Computer Agents hunting you' : 'Bishop\'s Agent players (you and computers)';
    $('start-btn').textContent = mode === 'tyndale' ? 'Start the journey' : 'Start the hunt';
    $('how-hunt').hidden = mode === 'tyndale'; $('how-tyndale').hidden = mode !== 'tyndale';
    $('skill-wrap').hidden = mode === 'tyndale'; $('hint-wrap').hidden = mode === 'tyndale'; $('aiskill-wrap').hidden = mode !== 'tyndale';
    const sup = E.hasSupporter(Number(sel.value));
    $('supp-note').hidden = !sup;
    $('supp-note').textContent = mode === 'tyndale' ? 'With 4 or more Agents, one of the character cards is a Secret Supporter, who may be dealt to one of them. If so, the game tells you who.'
      : 'With 4 or more Agents, one of the character cards is Tyndale\'s Secret Supporter. Someone may be holding it, but you won\'t know unless they are exposed.';
  };
  document.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', setup));
  $('agents').addEventListener('change', setup);
  setup();
  $('start-btn').addEventListener('click', () => { clearSave(); startGame(); });
  $('board').addEventListener('click', onBoardClick);
  $('board').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onBoardClick(e); } });
  $('side').addEventListener('click', onSideClick);
  $('menu-btn').addEventListener('click', () => {
    if (S && !S.over && !confirm('Leave this game? It will be lost.')) return;
    token++; releaseNext(); clearSave(); S = null; show('setup'); $('resume').hidden = true;
  });
  $('final-route').addEventListener('click', () => { ui.route = !ui.route; $('final').close(); render(); });
  $('final-again').addEventListener('click', () => { token++; releaseNext(); clearSave(); S = null; show('setup'); $('resume').hidden = true; });
  const saved = load();
  if (saved && !saved.S.over) {
    $('resume').hidden = false;
    $('resume-text').textContent = `You have a game in progress (round ${saved.S.round || 'setup'}).`;
    $('resume-btn').addEventListener('click', () => {
      S = saved.S; cfg = { mode: 'hunt', aiSkill: 'steady', pace: 'normal', ...saved.cfg }; ui = { sel: null, route: false, status: '', path: [], reveal: null, ...saved.ui };
      show('game'); render();
      if (S.phase !== 'place') run();
    });
    $('discard-btn').addEventListener('click', () => { clearSave(); $('resume').hidden = true; });
  }
}
init();
if (location.search.includes('debug')) window.__ty = { get S() { return S; }, render };   // test hook
