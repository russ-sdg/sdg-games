// Tyndale at a shared table: the host phone. It is the board and the referee. It holds the real game (pawns, Tyndale's route, the cards)
// and each Agent plays their own scorecard on agent.html; they talk across the room. A person or the computer plays Tyndale.
import * as E from './engine.js';
import * as A from './ai.js';
import * as T from './table-core.js';
import { drawBoard } from './boardview.js';
import { drawShareImage, canvasToBlob, nativeShareData, shareMessage } from './share.js';

const KEY = 'sdg-ty-table-1';
const $ = (id) => document.getElementById(id);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const card = (id, cap) => `<figure><img src="${T.CARD(id)}" alt="${esc(cap)}" /><figcaption>${esc(cap)}</figcaption></figure>`;
const capBible = (b) => (b === 'rumors' ? 'Rumors' : b === 'nothing' ? 'Nothing to report' : E.PUB_NAMES[b]);
const repText = (b) => (b === 'rumors' ? 'Rumors of a translation nearby' : b === 'nothing' || b === null ? 'Nothing to report' : `Found ${E.PUB_NAMES[b]}`);

let S = null, cfg = null, hist = [];
let ui = { pick: null, path: [], reveal: null, report: null, banner: '', route: false, ack: null };
const person = () => cfg.ty === 'person';

function save() { try { localStorage.setItem(KEY, JSON.stringify({ S, cfg, hist: hist.slice(-6) })); } catch (e) { /* private mode */ } }
function load() { try { const v = JSON.parse(localStorage.getItem(KEY)); return v && v.S && v.cfg ? v : null; } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }

// Every change to the game goes through here so it can be undone (the referee will mis-tap).
function commit(next, keepUi) {
  hist.push(S); if (hist.length > 40) hist.shift();
  S = next;
  settle();
  if (!keepUi) ui = { ...ui, pick: null, path: [], reveal: null, report: null };
  save(); render();
  if (S.over) showFinal();
}
// After a change: close the Agents' round when everyone has moved, and notice when Tyndale has nowhere left to go.
function settle() {
  if (S.over) return;
  if (S.phase === 'agents' && !(S.accusation && S.accusation.open) && !E.nextActor(S) && !ui.reveal) S = E.endAgentTurns(S);
  if (S.phase === 'tyndale' && person() && S.t.pos && !E.canMove(S)) S = E.trapped(S);
}
function undo() {
  if (!hist.length) return;
  S = hist.pop(); ui = { pick: null, path: [], reveal: null, report: null, banner: '', route: false, ack: null };
  save(); render();
}

// ---- opening the table -----------------------------------------------------------------------------------------------------
function startTable() {
  const n = Number($('agents').value), seed = T.newSeed();
  cfg = { n, seed, code: T.makeCode(n, seed), ty: document.querySelector('input[name=ty]:checked').value, skill: $('skill').value };
  const d = T.deal(seed, n);
  S = E.newGame({ seats: d.names.map((name, i) => ({ name, human: true, char: d.chars[i] })), seed, supporter: d.supporter });
  hist = []; ui = { pick: null, path: [], reveal: null, report: null, banner: '', route: false, ack: null };
  save(); show('game'); render();
}
function show(which) { $('setup').hidden = which !== 'setup'; $('game').hidden = which !== 'game'; window.scrollTo(0, 0); }

// ---- the board ---------------------------------------------------------------------------------------------------------------
function board() {
  const o = { marks: [], pawns: [], trails: [], taps: [], ring: [] };
  const free = (p) => !E.pawnAt(S, p) || (ui.cur && E.pawnAt(S, p).id === ui.cur.pawnId);
  for (const [pos, f] of Object.entries(S.found)) o.marks.push({ pos, bible: f.bible, color: T.SEAT_COLOURS[f.by], title: `${S.seats[f.by].name}: ${repText(f.bible)}` });
  for (const p of S.pawns) if (!p.out && p.pos) o.pawns.push({ pos: p.pos, color: T.SEAT_COLOURS[p.seat], label: S.seats[p.seat].name[0], title: S.seats[p.seat].name });
  if (ui.route || S.over) for (const p of S.pawns) if (p.trail && p.trail.length > 1) o.trails.push({ path: p.trail, color: T.SEAT_COLOURS[p.seat], dash: '' });
  if (S.over) o.trails.push({ path: S.t.trail, color: '#a3262e', dash: '8 6' });
  if ((person() || S.over) && S.t.pos) {
    o.tyndale = { pos: S.t.pos, path: ui.path };
    o.ships = S.shipments;
    if (!S.over) o.trails.push({ path: S.t.trail, color: '#a3262e', dash: '3 7' });
  }
  if (S.phase === 'place') {
    const next = S.pawns.find((p) => !p.out && p.pos === null);
    if (next) E_ALL().forEach((pos) => { if (!E.pawnAt(S, pos)) o.taps.push({ pos, act: 'place', label: `place ${S.seats[next.seat].name} on ${pos}` }); });
    else if (person()) E_ALL().forEach((pos) => { if (!E.pawnAt(S, pos)) o.taps.push({ pos, act: 'start', label: `Tyndale starts on ${pos}` }); });
  } else if (S.phase === 'tyndale' && person() && !S.over) {
    E.tyndaleNext(S, ui.path).steps.forEach((pos) => o.taps.push({ pos, act: 'step', pulse: true, label: `step to ${pos}` }));
  } else if (S.phase === 'agents' && ui.cur && !ui.reveal && !ui.report) {
    E_ALL().forEach((pos) => { if (free(pos)) o.taps.push({ pos, act: 'land', label: `${S.seats[ui.cur.seat].name} landed on ${pos}` }); });
    if (ui.pick) o.ring.push({ pos: ui.pick });
  }
  drawBoard($('board'), o);
}
const E_ALL = () => [...new Set(Array.from({ length: 121 }, (_, i) => E.idAt(Math.floor(i / 11), i % 11)))];

// ---- turns ----------------------------------------------------------------------------------------------------------------------
function onPlace(pos) {
  const next = S.pawns.find((p) => !p.out && p.pos === null);
  if (!next || E.pawnAt(S, pos)) return;
  commit(E.placePawn(S, next.id, pos));
}
function onStart(pos) {
  if (!person() || S.phase !== 'place' || !E.allPlaced(S) || E.pawnAt(S, pos)) return;
  commit(E.logPublic(E.startTyndale(S, pos), 'Tyndale has set out. The Bishop\'s Agents are searching for him.'));
}
function beginComputer() { commit(E.logPublic(E.startTyndale(S, A.aiTyndaleStart(S, cfg.skill)), 'Tyndale has begun his work. The hunt is on!')); }
function onStep(pos) { if (E.tyndaleNext(S, ui.path).steps.includes(pos)) { ui.path = [...ui.path, pos]; render(); } }
function afterTyndale(before, next) {
  ui.banner = next.delivered.length > before ? `${E.PUB_NAMES[next.delivered[next.delivered.length - 1].pub]} has reached London!` : '';
  commit(next);
}
function onFinishMove() {
  if (!E.checkTyndalePath(S, ui.path).ok) return;
  const before = S.delivered.length, path = ui.path;
  afterTyndale(before, E.tyndaleMove(S, path));
}
function computerMoves() {
  const path = A.aiTyndalePath(S, cfg.skill), before = S.delivered.length;
  if (!path) { commit(E.trapped(S)); return; }
  afterTyndale(before, E.tyndaleMove(S, path));
}
function actor() { const a = E.nextActor(S); return a ? { ...a, pos: S.pawns[a.pawnId].pos } : null; }
function onLand(pos) {
  if (!ui.cur) return;
  const o = E.pawnAt(S, pos);
  if (o && o.id !== ui.cur.pawnId) return;
  ui.pick = pos; render();
}
function showCards() {
  ui.banner = '';
  const a = ui.cur, pos = ui.pick, sup = E.isSupporterPawn(S, a.pawnId);
  const from = S.pawns[a.pawnId].pos;
  if (sup) {                                                   // the Secret Supporter chooses what to report: ask before the engine runs
    const ans = E.answerAt(S, pos, true);
    if (ans.loc !== 'here' && (ans.bible === 'rumors' || E.PUBS.includes(ans.bible))) { ui.report = { pos, from, ans }; render(); return; }
    return finishMove(pos, from, null);
  }
  finishMove(pos, from, undefined);
}
function finishMove(pos, from, choice) {
  const a = ui.cur, sup = E.isSupporterPawn(S, a.pawnId);
  const next = E.agentMove(S, a.pawnId, 0, pos, { free: true, report: sup ? (ans) => (choice === 'truth' ? ans.bible : null) : undefined });
  const r = next.lastResult;
  ui.reveal = { name: S.seats[a.seat].name, seat: a.seat, pos, from, loc: r.loc, bible: r.bible, reported: r.reported, supporter: sup, captured: !!r.captured };
  ui.report = null;
  if (!next.over) next.log.push({ round: next.round, text: `${S.seats[a.seat].name} → ${pos}: ${repText(r.reported === 'nothing' ? 'nothing' : r.reported)}.`, pub: true });
  commit(next, true);
}


// ---- accusations --------------------------------------------------------------------------------------------------------------
function accusationHtml() {
  const act = S.seats.filter((s) => !s.out);
  const opts = (sel) => act.map((s) => `<option value="${s.id}"${s.id === sel ? ' selected' : ''}>${esc(s.name)}</option>`).join('');
  return `<div class="ty-card"><h2>${esc(E.PUB_NAMES[S.accusation.after])} has reached London</h2>
    <p class="small mb-2">An Agent may accuse another of being Tyndale's Secret Supporter. Everyone votes; if most vote to charge, the accused is out when they are the Supporter, and the <b>accuser</b> is out when they are not.</p>
    <div class="row g-2 mb-2"><div class="col-6"><label class="form-label small mb-0" for="acc-by">Accuser</label><select class="form-select form-select-sm" id="acc-by">${opts(act[0].id)}</select></div>
    <div class="col-6"><label class="form-label small mb-0" for="acc-to">Accused</label><select class="form-select form-select-sm" id="acc-to">${opts(act[Math.min(1, act.length - 1)].id)}</select></div></div>
    <p class="small mb-1">Who voted to charge? (the accuser always does)</p>
    <div class="pick-list">${act.map((s) => `<label><input type="checkbox" data-vote="${s.id}"> <span>${esc(s.name)}</span></label>`).join('')}</div>
    <div class="d-flex flex-wrap gap-2"><button type="button" class="btn btn-danger" data-do="accuse">Hold the vote</button><button type="button" class="btn btn-outline-secondary" data-do="noaccuse">No accusation</button></div></div>`;
}
function holdVote() {
  const by = Number($('acc-by').value), to = Number($('acc-to').value);
  if (by === to) { ui.banner = 'An Agent cannot accuse themselves.'; render(); return; }
  const votes = {};
  document.querySelectorAll('[data-vote]').forEach((c) => { votes[c.dataset.vote] = c.checked; });
  votes[by] = true;
  const next = E.accuse(S, by, to, votes), res = next.accusationResult, nm = (i) => S.seats[i].name;
  ui.banner = !res.charged ? `The vote on ${nm(to)} fails (${res.yes} of ${res.of}).`
    : res.supporter ? `${nm(to)} was the Secret Supporter and is out of the game!` : `${nm(by)} accused the wrong Agent and is out of the game.`;
  const keep = ui.banner;
  commit(next); ui.banner = keep; render();
}

// ---- the side panel ----------------------------------------------------------------------------------------------------------
function pubChips() {
  return `<span class="lbl">In London:</span>` + E.PUBS.map((l) => { const d = S.delivered.find((q) => q.pub === l); return `<span class="pub-chip${d ? ' on' : ''}" title="${E.PUB_NAMES[l]}">${l}</span>`; }).join('');
}
function codeCard() {
  const url = new URL('agent.html', location.href); url.search = '?code=' + cfg.code;
  return `<div class="ty-card table-code"><h2>Table code</h2><div class="code-big" aria-label="Table code ${esc(cfg.code.split('').join(' '))}">${esc(cfg.code)}</div>
    <p class="small mb-0">Each Agent opens <b>Join a table</b> (<span class="text-break">${esc(url.origin + url.pathname)}</span>) and enters it${cfg.n >= 4 ? '. One of the six character cards is the Secret Supporter' : ''}.</p></div>`;
}
function seatList() {
  return `<div class="ty-card"><h2>The Agents</h2><ul class="seat-list">${S.seats.map((q) => `<li class="${q.out ? 'out' : ''}"><span class="seat-dot" style="background:${T.SEAT_COLOURS[q.id]}"></span>${esc(q.name)}${q.out ? ' (out)' : ''}${person() && q.id === S.supporter ? ' ★ your Secret Supporter' : ''}</li>`).join('')}</ul></div>`;
}
function logCard() {
  const entries = S.log.filter((l) => l.pub || person()).slice(-12).reverse();
  return `<div class="ty-card"><h2>What has happened</h2><ul class="ty-log">${entries.map((l) => `<li><span class="rd">R${l.round}</span>${l.pub ? '' : '<b>Tyndale: </b>'}${esc(l.text)}</li>`).join('') || '<li>Nothing yet.</li>'}</ul></div>`;
}
function scoreCard() {
  const t = S.t;
  const next = t.published < t.translated ? `${E.PUB_NAMES[E.PUBS[t.translated]]} is translated. Reach a Printing Centre you have not used to publish it.`
    : t.published > t.shipped ? `${E.PUB_NAMES[E.PUBS[t.published]]} is printed. Reach a Coastal City to ship it.` : 'Everything is shipped. Keep out of sight until the last shipment reaches London.';
  const sea = S.shipments.filter((q) => !q.arrived);
  return `<div class="ty-card"><h2>Tyndale's scorecard</h2><p class="mb-2">${esc(next)}</p><ul class="small mb-0">
    ${t.last && t.last.length ? `<li>Last turn: ${esc(t.last.join('; '))}</li>` : ''}
    <li>Bonus moves: <b>${t.bonus.length ? t.bonus.join(' ') : 'none'}</b></li>
    <li>Printing Centres used: <b>${t.visited.length}</b> of ${E.centres.length}</li>
    <li>Shipments at sea: ${sea.length ? sea.map((q) => `${esc(E.PUB_NAMES[q.pub])} <b>${q.left}</b> to go${q.fresh ? ' (sails after this turn)' : ''}`).join('; ') : 'none'}</li></ul></div>`;
}
function sideHtml() {
  const out = [];
  if (ui.banner) out.push(`<div class="ty-banner" role="status">${esc(ui.banner)}</div>`);
  if (S.phase === 'place') {
    out.push(codeCard());
    const next = S.pawns.find((p) => !p.out && p.pos === null);
    if (next) {
      const mine = S.pawns.filter((p) => p.seat === next.seat), k = mine.indexOf(next) + 1;
      out.push(`<div class="ty-card"><h2>Place ${esc(S.seats[next.seat].name)}'s pawn${mine.length > 1 ? ` (${k} of ${mine.length})` : ''}</h2><p class="mb-2">Ask them where they want it, and tap that spot on the map. The Agents decide on their own phones where to begin, and tell you.</p>
        <button type="button" class="btn btn-outline-secondary btn-sm" data-do="undo">Undo last pawn</button></div>`);
    } else if (person()) out.push(`<div class="ty-card"><h2>Where does Tyndale begin?</h2><p class="mb-2">All the pawns are down. Tyndale: tap your starting spot. A Printing Centre on the coast lets you publish and ship straight away.</p><p class="small text-muted mb-0">You cannot start on an Agent's spot. Keep the screen to yourself.</p></div>`);
    else out.push(`<div class="ty-card"><h2>All the pawns are down</h2><p class="mb-2">Tyndale (the computer) picks a secret starting place.</p><button type="button" class="btn btn-primary btn-lg" data-do="begin">Begin the hunt</button></div>`);
  } else if (S.over) {
    out.push(`<div class="ty-card"><h2>Game over</h2><button type="button" class="btn btn-primary" data-do="results">See the results</button></div>`);
  } else if (S.phase === 'tyndale') {
    if (person()) {
      const t = S.t, n = ui.path.length, base = n ? (E.pt[ui.path[0]].kind === 'blue' ? 2 : 1) : 1, total = base + t.bonus.length;
      const chk = n ? E.checkTyndalePath(S, ui.path) : { ok: false, reason: 'move at least one step' };
      const msg = chk.ok ? (chk.needBonus ? `Uses ${chk.needBonus} bonus move${chk.needBonus > 1 ? 's' : ''}.` : 'Ready to go.') : chk.reason.charAt(0).toUpperCase() + chk.reason.slice(1) + '.';
      out.push(`<div class="ty-card"><h2>Round ${S.round}: move Tyndale</h2><p class="mb-2">Tap the highlighted spots to step along. You may move up to <b>${total}</b> step${total > 1 ? 's' : ''}${base === 2 ? ' (a blue first spot gives a second step)' : ''}.</p>
        <p class="small mb-2" aria-live="polite">${esc(msg)} ${n ? `Steps planned: ${n}.` : ''}</p>
        <div class="d-flex flex-wrap gap-2"><button type="button" class="btn btn-primary" data-do="finish" ${chk.ok ? '' : 'disabled'}>Finish move</button><button type="button" class="btn btn-outline-secondary" data-do="undostep" ${n ? '' : 'disabled'}>Undo step</button></div></div>`);
      out.push(scoreCard());
    } else out.push(`<div class="ty-card"><h2>Round ${S.round}</h2><p class="mb-2">Tyndale is about to move.</p><button type="button" class="btn btn-primary btn-lg" data-do="computer">Tyndale moves</button></div>`);
  } else if (S.phase === 'agents') {
    if (S.accusation && S.accusation.open) out.push(accusationHtml());
    else if (ui.reveal) out.push(revealHtml());
    else if (ui.report) out.push(reportHtml());
    else {
      const a = ui.cur = actor();
      if (a) {
        const nm = S.seats[a.seat].name, mine = S.pawns.filter((p) => p.seat === a.seat && !p.out);
        out.push(`<div class="ty-card"><h2>Round ${S.round}: ${esc(nm)}'s turn</h2>
          <p class="mb-2">${mine.length > 1 ? `Pawn at <b>${a.pos}</b>. ` : ''}${esc(nm)} rolls their die on their phone (1 to 3), moves exactly that far, and tells you where they landed. Tap that spot${ui.pick ? '' : ' on the map'}.</p>
          ${ui.pick ? `<p class="mb-2">Landed on <b>${ui.pick}</b>${ui.pick === a.pos ? ' (stayed put)' : ''}.</p><div class="d-flex flex-wrap gap-2"><button type="button" class="btn btn-primary btn-lg" data-do="cards">Show the cards</button><button type="button" class="btn btn-outline-secondary" data-do="repick">Pick again</button></div>` : '<p class="small text-muted mb-0">Pawns other than theirs cannot be finished on.</p>'}</div>`);
      } else out.push(`<div class="ty-card"><h2>Round ${S.round}</h2><p class="mb-0">All the Agents have moved.</p></div>`);
    }
    if (person() && !ui.reveal && !ui.report && !(S.accusation && S.accusation.open)) out.push(scoreCard());
  }
  out.push(seatList(), logCard());
  return out.join('');
}
function revealHtml() {
  const r = ui.reveal;
  const move = r.from === r.pos ? `Stayed at <b>${esc(r.pos)}</b>` : `Moved <b>${esc(r.from)}</b> → <b>${esc(r.pos)}</b>`;
  return `<div class="ty-card ty-reveal"><h2>${esc(r.name)}'s answer</h2><p class="mb-2">${move}. ${codeHtml(r.name, r.pos, r.loc, r.bible, r.seat)}</p>
    <p class="mb-2"><b>${esc(r.name)} tells the table:</b> ${r.captured ? 'Tyndale is here!' : esc(repText(r.reported))}</p><button type="button" class="btn btn-primary" data-do="next">${r.captured ? 'Continue' : 'Next Agent'}</button></div>`;
}
// The answer goes to the Agent's own phone as a short code, so this phone never has to be handed round. The cards can still be shown here.
function codeHtml(name, pos, loc, bible, seat) {
  const code = T.answerCode(cfg.seed, seat, pos, { loc, bible });
  return `<span class="d-block mb-2">Read <b>${esc(name)}</b> this code to type on their phone:</span><span class="code-big" aria-label="Answer code ${code.split('').join(' ')}">${code}</span>
    <details class="small"><summary>Show the cards on this phone instead</summary><div class="report mt-2">${card(T.LOC_CARD[loc], T.LOC_TEXT[loc])}${card(T.BIB_CARD[bible], capBible(bible))}</div></details>`;
}
function reportHtml() {
  const r = ui.report, nm = S.seats[ui.cur.seat].name;
  return `<div class="ty-card ty-reveal"><h2>${esc(nm)}: what do you report?</h2><p class="mb-2">${codeHtml(nm, r.pos, r.ans.loc, r.ans.bible, ui.cur.seat)}</p>
    <p class="small mt-2 mb-2">The Secret Supporter may tell the others the truth, or say &ldquo;nothing to report&rdquo;. Ask which, then tap it. (Where Tyndale is stays private.)</p>
    <div class="d-flex flex-wrap gap-2"><button type="button" class="btn btn-primary" data-do="truth">Reports what was shown</button><button type="button" class="btn btn-outline-secondary" data-do="nothing">Nothing to report</button></div></div>`;
}

// ---- screens -------------------------------------------------------------------------------------------------------------------
function render() {
  if (!S) return;
  $('bar-main').textContent = S.phase === 'place' ? 'Place the pawns' : S.over ? `Game over after ${S.round} turns` : `Round ${S.round}`;
  $('bar-pubs').innerHTML = pubChips();
  $('undo-btn').disabled = !hist.length;
  $('legend').innerHTML = (person() ? '<b>T</b> = Tyndale (you; keep the screen private); ' : '') + 'round markers (N, P, H, O, R, ×) = what the Agents have told the table, ringed in the colour of the Agent who found it; the green numbers by the coast are how many moves a shipment from there needs to reach London.';
  ui.cur = S.phase === 'agents' ? actor() : null;
  board();
  $('side').innerHTML = sideHtml();
}
function showFinal() {
  const sm = E.summary(S), caught = sm.reason === 'captured';
  const captor = caught ? S.pawns[S.lastResult.pawnId].seat : null, n = sm.turns;
  const who = (i) => S.seats[i].name;
  let title, headline;
  if (caught) { title = `${who(captor)} caught Tyndale!`; headline = `${who(captor)} caught Tyndale in ${n} turns!`; }
  else if (sm.reason === 'delivered') { title = 'Tyndale wins: the Old Testament reached London'; headline = `Tyndale got the whole Bible to London in ${n} turns before we could stop him.`; }
  else if (sm.reason === 'trapped') { title = 'Tyndale was surrounded!'; headline = `The Bishop's Agents trapped Tyndale on turn ${n}.`; }
  else { title = 'Tyndale wins: the Agents have been undone'; headline = 'Tyndale outwitted the Bishop\'s Agents.'; }
  const turnsLabel = caught ? 'turns to catch Tyndale' : sm.reason === 'delivered' ? 'turns to complete all the deliveries' : 'turns played';
  const items = sm.delivered.map((d) => `<li><b>${esc(d.name)}</b><small>delivered to London on turn ${d.round}</small></li>`).join('')
    + sm.shippedNotArrived.map((d) => `<li class="pending"><b>${esc(d.name)}</b><small>shipped, ${d.left} move${d.left === 1 ? '' : 's'} from London when the game ended</small></li>`).join('')
    + sm.undelivered.filter((q) => !sm.shippedNotArrived.some((z) => z.name === q)).map((q) => `<li class="no"><b>${esc(q)}</b><small>not delivered</small></li>`).join('');
  $('final-title').textContent = title;
  $('final-body').innerHTML = `<p class="mb-3"><span class="big-stat">${sm.turns}</span> <span class="text-muted">${turnsLabel}</span></p>
    <h3 class="h6">Scripture delivered to London</h3><ul class="scripture-list">${items}</ul>
    ${S.supporter !== null ? `<p class="small mt-3 mb-0">The Secret Supporter was <b>${esc(who(S.supporter))}</b>${S.seats[S.supporter].out ? ' (already out)' : ''}.</p>` : S.seats.length >= 4 ? '<p class="small mt-3 mb-0">There was no Secret Supporter in this game.</p>' : ''}
    <h3 class="h6 mt-3">The Bishop's Agents</h3><ul class="agent-reveal">${S.seats.map((q) => `<li class="${q.out ? 'out' : ''}"><img src="${T.CARD(q.char)}" alt="" /><span><span class="seat-dot" style="background:${T.SEAT_COLOURS[q.id]}"></span><b>${esc(q.name)}</b> · ${esc(T.charName(q.char))}${q.id === S.supporter ? ' ★ Secret Supporter' : ''}</span></li>`).join('')}</ul>
    <p class="small mt-1 mb-0">Tyndale ended at <b>${S.t.pos}</b>.</p>`;
  $('final-route').textContent = ui.route ? 'Hide the routes' : 'Show the routes';
  mountShare($('final-body'), headline, { title, turnsLabel, detail: `Same room, own phones\n${cfg.n} Agents · Tyndale: ${person() ? 'a person' : 'the computer, ' + cfg.skill}`, boardSrc: '../../assets/tyndale/board.webp', colours: T.SEAT_COLOURS, labels: S.seats.map((q) => `${q.name} · ${T.charName(q.char)}${q.id === S.supporter ? ' ★' : ''}${q.out ? ' (out)' : ''}`) });
  $('final').showModal();
}
async function mountShare(root, headline, info) {
  const box = document.createElement('div');
  box.className = 'share-box';
  box.innerHTML = `<div class="share-actions"><button type="button" class="btn btn-primary btn-sm" id="share-dl" disabled>Download image</button>
    <button type="button" class="btn btn-outline-primary btn-sm" id="share-native" hidden>Share…</button>
    <button type="button" class="btn btn-outline-secondary btn-sm" id="share-copy">Copy text</button></div>
    <img class="share-preview" alt="The finished game: the board with the routes" width="1200" height="1040" hidden>
    <p class="small text-muted mb-0" id="share-msg" aria-live="polite">Drawing your result card…</p>`;
  root.appendChild(box);
  const img = box.querySelector('.share-preview'), msg = box.querySelector('#share-msg');
  const dl = box.querySelector('#share-dl'), nat = box.querySelector('#share-native'), copy = box.querySelector('#share-copy');
  copy.onclick = async () => { try { await navigator.clipboard.writeText(shareMessage(headline)); msg.textContent = 'Copied. Paste it anywhere.'; } catch { msg.textContent = shareMessage(headline); } };
  try {
    const canvas = await drawShareImage(document.createElement('canvas'), S, info), blob = await canvasToBlob(canvas), url = URL.createObjectURL(blob);
    img.src = url; img.hidden = false; dl.disabled = false; msg.textContent = '';
    const file = new File([blob], 'tyndale.png', { type: 'image/png' });
    nat.hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    dl.onclick = () => { const a = document.createElement('a'); a.href = url; a.download = 'tyndale.png'; document.body.appendChild(a); a.click(); a.remove(); };
    nat.onclick = async () => { try { await navigator.share(nativeShareData(file, headline)); } catch { /* cancelled */ } };
  } catch { msg.textContent = 'Sorry, the result card could not be drawn in this browser. You can still copy the text.'; }
}

// ---- wiring ----------------------------------------------------------------------------------------------------------------------
function onBoardClick(e) {
  const t = e.target.closest && e.target.closest('[data-act]');
  if (!t) return;
  const pos = t.getAttribute('data-pos'), act = t.getAttribute('data-act');
  if (act === 'place') onPlace(pos); else if (act === 'start') onStart(pos); else if (act === 'step') onStep(pos); else if (act === 'land') onLand(pos);
}
function onSideClick(e) {
  const b = e.target.closest && e.target.closest('[data-do]');
  if (!b || b.disabled) return;
  const d = b.getAttribute('data-do');
  if (d === 'undo') { const placed = S.pawns.filter((p) => p.pos !== null); if (placed.length) { S = structuredClone(S); S.pawns[placed[placed.length - 1].id].pos = null; save(); render(); } }
  else if (d === 'begin') beginComputer();
  else if (d === 'finish') onFinishMove();
  else if (d === 'undostep') { ui.path = ui.path.slice(0, -1); render(); }
  else if (d === 'computer') computerMoves();
  else if (d === 'cards') showCards();
  else if (d === 'repick') { ui.pick = null; render(); }
  else if (d === 'truth') finishMove(ui.report.pos, ui.report.from, 'truth');
  else if (d === 'nothing') finishMove(ui.report.pos, ui.report.from, null);
  else if (d === 'next') { ui.reveal = null; ui.pick = null; settle(); if (S.over) { save(); render(); showFinal(); } else { save(); render(); } }
  else if (d === 'accuse') holdVote();
  else if (d === 'noaccuse') { ui.banner = ''; commit(E.closeAccusation(S)); }
  else if (d === 'results') showFinal();
}
function reset() { clearSave(); S = null; cfg = null; hist = []; show('setup'); $('resume').hidden = true; }

function init() {
  const sync = () => { const p = document.querySelector('input[name=ty]:checked').value === 'person'; $('skill-wrap').hidden = p; };
  document.querySelectorAll('input[name=ty]').forEach((r) => r.addEventListener('change', sync)); sync();
  $('start-btn').addEventListener('click', () => { clearSave(); startTable(); });
  $('board').addEventListener('click', onBoardClick);
  $('board').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onBoardClick(e); } });
  $('side').addEventListener('click', onSideClick);
  $('undo-btn').addEventListener('click', undo);
  $('menu-btn').addEventListener('click', () => { if (S && !S.over && !confirm('End this table? The game will be lost.')) return; reset(); });
  $('final-route').addEventListener('click', () => { ui.route = !ui.route; $('final').close(); render(); });
  $('final-again').addEventListener('click', reset);
  const saved = load();
  if (saved && !saved.S.over) {
    $('resume').hidden = false;
    $('resume-text').textContent = `You have a table in progress (code ${saved.cfg.code}, round ${saved.S.round || 'setup'}).`;
    $('resume-btn').addEventListener('click', () => { S = saved.S; cfg = saved.cfg; hist = saved.hist || []; show('game'); render(); });
    $('discard-btn').addEventListener('click', () => { clearSave(); $('resume').hidden = true; });
  }
}
init();
if (location.search.includes('debug')) window.__tt = { get S() { return S; }, get cfg() { return cfg; }, render };   // test hook
