// Tyndale, pass and play: one phone handed round the table. Before each private turn the phone names who should hold it and hides the
// map until they say they are ready. Agents roll and move here, see the two answer cards in private, and tell the table what they
// found; Tyndale is a person (secret moves on the same phone) or the computer. The engine is the same one the solo game uses.
import * as E from './engine.js';
import * as A from './ai.js';
import * as T from './pass-core.js';
import { drawBoard, ALL_SPOTS } from './boardview.js';
import { drawShareImage, canvasToBlob, nativeShareData, shareMessage } from './share.js';

const KEY = 'sdg-ty-pass-1';
const $ = (id) => document.getElementById(id);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const card = (id, cap) => `<figure><img src="${T.CARD(id)}" alt="${esc(cap)}" /><figcaption>${esc(cap)}</figcaption></figure>`;
const capBible = (b) => (b === 'rumors' ? 'Rumors' : b === 'nothing' ? 'Nothing to report' : E.PUB_NAMES[b]);
const repText = (b) => (b === 'rumors' ? 'Rumors of a translation nearby' : b === 'nothing' || b === null ? 'Nothing to report' : `Found ${E.PUB_NAMES[b]}`);

let S = null, cfg = null, hist = [];
let ui = { viewer: null, path: [], reveal: null, report: null, banner: '', route: false };
const person = () => cfg.ty === 'person';
const nm = (i) => S.seats[i].name;
const viewerName = (v) => (v === 'tyndale' ? 'Tyndale' : nm(v));

function save() { try { localStorage.setItem(KEY, JSON.stringify({ S, cfg, hist: hist.slice(-6) })); } catch (e) { /* private mode */ } }
function load() { try { const v = JSON.parse(localStorage.getItem(KEY)); return v && v.S && v.cfg ? v : null; } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }

// Every change to the game goes through here so it can be undone.
function commit(next, keepUi) {
  hist.push(S); if (hist.length > 40) hist.shift();
  S = next;
  settle();
  if (!keepUi) ui = { ...ui, path: [], reveal: null, report: null };
  save(); render();
  if (S.over) showFinal();
}
// After a change: close the Agents' round when everyone has moved; the computer's Tyndale moves at once; and notice when a person's
// Tyndale has nowhere left to go.
function settle() {
  if (S.over) return;
  if (S.phase === 'agents' && !(S.accusation && S.accusation.open) && !E.nextActor(S) && !ui.reveal && !ui.report) S = E.endAgentTurns(S);
  if (S.phase === 'tyndale' && S.t.pos) {
    if (person()) { if (!E.canMove(S)) S = E.trapped(S); return; }
    const before = S.delivered.length, path = A.aiTyndalePath(S, cfg.skill);
    S = path ? E.tyndaleMove(S, path) : E.trapped(S);
    if (S.delivered.length > before) ui.banner = `${E.PUB_NAMES[S.delivered[S.delivered.length - 1].pub]} has reached London!`;
    settle();
  }
}
function undo() {
  if (!hist.length) return;
  S = hist.pop(); ui = { viewer: null, path: [], reveal: null, report: null, banner: '', route: false };
  save(); render();
}

// ---- new game ---------------------------------------------------------------------------------------------------------------------
function nameFields() {
  const n = Number($('agents').value), keep = [...document.querySelectorAll('#names input')].map((i) => i.value);
  $('names').innerHTML = Array.from({ length: n }, (_, i) => `<div class="col-6 col-sm-4"><input class="form-control form-control-sm" maxlength="14" aria-label="Agent ${i + 1} name" value="${esc(keep[i] || T.AGENT_NAMES[i])}"></div>`).join('');
  $('supp-note').hidden = !E.hasSupporter(n);
}
function startGame() {
  const n = Number($('agents').value), seed = T.newSeed(), d = T.deal(seed, n);
  const names = [...document.querySelectorAll('#names input')].map((i, k) => i.value.trim() || d.names[k]);
  cfg = { n, seed, ty: document.querySelector('input[name=ty]:checked').value, skill: $('skill').value, seen: 0 };
  S = E.newGame({ seats: names.map((name, i) => ({ name, human: true, char: d.chars[i] })), seed, supporter: d.supporter });
  hist = []; ui = { viewer: null, path: [], reveal: null, report: null, banner: '', route: false };
  save(); show('game'); render();
}
function show(which) { $('setup').hidden = which !== 'setup'; $('game').hidden = which !== 'game'; window.scrollTo(0, 0); }

// ---- who should be holding the phone -----------------------------------------------------------------------------------------------
// null = nobody in particular (the map is on show to everyone).
function required() {
  if (S.over) return null;
  if (S.phase === 'place') {
    if (cfg.seen < cfg.n) return { who: cfg.seen, kind: 'card' };
    if (E.allPlaced(S) && person()) return { who: 'tyndale', kind: 'start' };
    return null;
  }
  if (S.phase === 'tyndale' && person()) return { who: 'tyndale', kind: 'move' };
  if (S.phase === 'agents' && !(S.accusation && S.accusation.open)) { const a = E.nextActor(S); if (a) return { who: a.seat, kind: 'turn' }; }
  return null;
}
function gateHtml(req) {
  const who = viewerName(req.who);
  const why = { card: 'to look at their secret character card.', start: 'to choose where he begins. Everyone else look away.', move: 'to plan his secret move. Everyone else look away.', turn: 'to take their turn.' }[req.kind];
  return `${ui.banner ? `<div class="ty-banner" role="status">${esc(ui.banner)}</div>` : ''}<div class="ty-card gate"><h2>Pass the phone to ${esc(who)}</h2><p class="mb-3">${esc(who)} ${why}</p>
    <button type="button" class="btn btn-primary btn-lg" data-do="ready">I'm ${esc(who)} — show me</button></div>`;
}
// ---- the board ---------------------------------------------------------------------------------------------------------------------
const actor = () => { const a = E.nextActor(S); return a ? { ...a, pos: S.pawns[a.pawnId].pos } : null; };
function board() {
  const o = { marks: [], pawns: [], trails: [], taps: [], ring: [] }, tyV = ui.viewer === 'tyndale' || S.over;
  for (const [pos, f] of Object.entries(S.found)) o.marks.push({ pos, bible: f.bible, color: T.SEAT_COLOURS[f.by], title: `${nm(f.by)}: ${repText(f.bible)}` });
  for (const p of S.pawns) if (!p.out && p.pos) o.pawns.push({ pos: p.pos, color: T.SEAT_COLOURS[p.seat], label: nm(p.seat)[0], title: nm(p.seat) });
  if (ui.route || S.over) for (const p of S.pawns) if (p.trail && p.trail.length > 1) o.trails.push({ path: p.trail, color: T.SEAT_COLOURS[p.seat], dash: '' });
  if (S.over) o.trails.push({ path: S.t.trail, color: '#a3262e', dash: '8 6' });
  if (tyV && S.t.pos) { o.tyndale = { pos: S.t.pos, path: ui.path }; o.ships = S.shipments; if (!S.over) o.trails.push({ path: S.t.trail, color: '#a3262e', dash: '3 7' }); }
  if (!S.over) {
    if (S.phase === 'place') {
      const next = S.pawns.find((p) => !p.out && p.pos === null);
      if (next && cfg.seen >= cfg.n) ALL_SPOTS.forEach((pos) => { if (!E.pawnAt(S, pos)) o.taps.push({ pos, act: 'place', label: `place ${nm(next.seat)} on ${pos}` }); });
      else if (!next && ui.viewer === 'tyndale') ALL_SPOTS.forEach((pos) => { if (!E.pawnAt(S, pos)) o.taps.push({ pos, act: 'start', label: `Tyndale starts on ${pos}` }); });
    } else if (S.phase === 'tyndale' && ui.viewer === 'tyndale') {
      E.tyndaleNext(S, ui.path).steps.forEach((pos) => o.taps.push({ pos, act: 'step', pulse: true, label: `step to ${pos}` }));
    } else if (S.phase === 'agents' && S.pending && !ui.reveal && !ui.report) {
      E.pawnTargets(S, S.pending.pawnId, S.pending.roll).forEach((pos) => o.taps.push({ pos, act: 'target', pulse: true, label: `move to ${pos}` }));
    }
  }
  drawBoard($('board'), o);
}

// ---- turns -------------------------------------------------------------------------------------------------------------------------
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
function onFinishMove() {
  if (!E.checkTyndalePath(S, ui.path).ok) return;
  const before = S.delivered.length, next = E.tyndaleMove(S, ui.path);
  ui.banner = next.delivered.length > before ? `${E.PUB_NAMES[next.delivered[next.delivered.length - 1].pub]} has reached London!` : '';
  commit(next);
}
function onRoll() {
  const a = actor();
  if (!a || S.pending) return;
  ui.banner = '';
  commit(E.rollFor(S, a.pawnId), true);
}
function onTarget(pos) {
  if (!S.pending) return;
  const { pawnId } = S.pending;
  if (E.isSupporterPawn(S, pawnId)) {                          // the Secret Supporter chooses what to report: ask before the engine runs
    const ans = E.answerAt(S, pos, true);
    if (ans.loc !== 'here' && (ans.bible === 'rumors' || E.PUBS.includes(ans.bible))) { ui.report = { pos, ans }; render(); return; }
  }
  finishMove(pos, null);
}
function finishMove(pos, choice) {
  const { pawnId, roll } = S.pending, seat = S.pawns[pawnId].seat, from = S.pawns[pawnId].pos, sup = E.isSupporterPawn(S, pawnId);
  const next = E.agentMove(S, pawnId, roll, pos, { report: sup ? (ans) => (choice === 'truth' ? ans.bible : null) : undefined });
  const r = next.lastResult;
  ui.reveal = { name: nm(seat), roll, pos, from, loc: r.loc, bible: r.bible, reported: r.reported, supporter: sup, captured: !!r.captured };
  ui.report = null;
  if (!next.over) next.log.push({ round: next.round, text: `${nm(seat)} (rolled ${roll}) → ${pos}: ${repText(r.reported)}.`, pub: true });
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


// ---- the side panel ----------------------------------------------------------------------------------------------------------------
function pubChips() {
  return `<span class="lbl">In London:</span>` + E.PUBS.map((l) => { const d = S.delivered.find((q) => q.pub === l); return `<span class="pub-chip${d ? ' on' : ''}" title="${E.PUB_NAMES[l]}">${l}</span>`; }).join('');
}
function seatList() {
  return `<div class="ty-card"><h2>The Agents</h2><ul class="seat-list">${S.seats.map((q) => `<li class="${q.out ? 'out' : ''}"><span class="seat-dot" style="background:${T.SEAT_COLOURS[q.id]}"></span>${esc(q.name)}${q.out ? ' (out)' : ''}${person() && q.id === S.supporter ? ' ★ your Secret Supporter' : ''}</li>`).join('')}</ul></div>`;
}
function logCard() {
  const entries = S.log.filter((l) => l.pub || ui.viewer === 'tyndale').slice(-12).reverse();
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

function cardView(seat) {
  const q = S.seats[seat];
  return `<div class="ty-card id-card"><img src="${T.CARD(q.char)}" alt="${esc(T.charName(q.char))}" /><div><h2>You are ${esc(T.charName(q.char))}</h2>
    <p class="mb-2">${esc(q.name)}, you are a Bishop's Agent.</p>${seat === S.supporter ? '<p class="mb-2"><b>You are the Secret Supporter.</b> You are on Tyndale\'s side. When you are shown Rumors or a translation you choose whether to tell the others the truth or say &ldquo;nothing to report&rdquo;. A printed Bible you find, you carry to the coast for him. Try not to be exposed.</p>' : S.supporter !== null ? '<p class="mb-2 small">One of the Agents is Tyndale\'s Secret Supporter. It is not you.</p>' : ''}
    <button type="button" class="btn btn-primary" data-do="seen">Got it — hide this</button></div></div>`;
}
function sideHtml() {
  const out = [];
  if (ui.banner) out.push(`<div class="ty-banner" role="status">${esc(ui.banner)}</div>`);
  const req = required();
  if (ui.reveal) out.push(revealHtml());
  else if (ui.report) out.push(reportHtml());
  else if (S.over) out.push(`<div class="ty-card"><h2>Game over</h2><button type="button" class="btn btn-primary" data-do="results">See the results</button></div>`);
  else if (req && req.kind === 'card') out.push(cardView(req.who));
  else if (S.phase === 'place') {
    const next = S.pawns.find((p) => !p.out && p.pos === null);
    if (next) {
      const mine = S.pawns.filter((p) => p.seat === next.seat), k = mine.indexOf(next) + 1;
      out.push(`<div class="ty-card"><h2>Place ${esc(nm(next.seat))}'s pawn${mine.length > 1 ? ` (${k} of ${mine.length})` : ''}</h2><p class="mb-2">Agree where each Agent starts and tap that spot. Spread out: Tyndale could be anywhere in Europe.</p>
        <p class="small text-muted">The named cities are Printing Centres, where he publishes; the coast is where he ships.</p><button type="button" class="btn btn-outline-secondary btn-sm" data-do="unplace">Undo last pawn</button></div>`);
    } else if (person()) out.push(`<div class="ty-card"><h2>Where does Tyndale begin?</h2><p class="mb-2">Tap your starting spot. A Printing Centre on the coast lets you publish and ship straight away. You cannot start on an Agent's spot.</p></div>`);
    else out.push(`<div class="ty-card"><h2>All the pawns are down</h2><p class="mb-2">Tyndale (the computer) picks a secret starting place.</p><button type="button" class="btn btn-primary btn-lg" data-do="begin">Begin the hunt</button></div>`);
  } else if (S.phase === 'tyndale') {
    const t = S.t, n = ui.path.length, base = n ? (E.pt[ui.path[0]].kind === 'blue' ? 2 : 1) : 1, total = base + t.bonus.length;
    const chk = n ? E.checkTyndalePath(S, ui.path) : { ok: false, reason: 'move at least one step' };
    const msg = chk.ok ? (chk.needBonus ? `Uses ${chk.needBonus} bonus move${chk.needBonus > 1 ? 's' : ''}.` : 'Ready to go.') : chk.reason.charAt(0).toUpperCase() + chk.reason.slice(1) + '.';
    out.push(`<div class="ty-card"><h2>Round ${S.round}: move Tyndale</h2><p class="mb-2">Tap the highlighted spots to step along. You may move up to <b>${total}</b> step${total > 1 ? 's' : ''}${base === 2 ? ' (a blue first spot gives a second step)' : ''}.</p>
      <p class="small mb-2" aria-live="polite">${esc(msg)} ${n ? `Steps planned: ${n}.` : ''}</p>
      <div class="d-flex flex-wrap gap-2"><button type="button" class="btn btn-primary" data-do="finish" ${chk.ok ? '' : 'disabled'}>Finish move and hide the map</button><button type="button" class="btn btn-outline-secondary" data-do="undostep" ${n ? '' : 'disabled'}>Undo step</button></div></div>`);
    out.push(scoreCard());
  } else if (S.phase === 'agents' && S.accusation && S.accusation.open) out.push(accusationHtml());
  else if (S.phase === 'agents') {
    const a = actor();
    if (a) {
      const mine = S.pawns.filter((p) => p.seat === a.seat && !p.out);
      if (!S.pending) out.push(`<div class="ty-card"><h2>Round ${S.round}: ${esc(nm(a.seat))}'s turn</h2>${mine.length > 1 ? `<p class="mb-2">Pawn at <b>${a.pos}</b>.</p>` : ''}<button type="button" class="btn btn-primary btn-lg" data-do="roll">Roll the die</button></div>`);
      else {
        const tg = E.pawnTargets(S, a.pawnId, S.pending.roll), boxed = tg.length === 1 && tg[0] === a.pos;
        out.push(`<div class="ty-card"><h2>${esc(nm(a.seat))}'s move</h2><div class="d-flex align-items-center"><span class="ty-roll" aria-label="You rolled ${S.pending.roll}">${S.pending.roll}</span><p class="mb-0">${boxed ? 'Boxed in by other pawns: tap your pawn to stay put.' : `Move exactly <b>${S.pending.roll}</b> step${S.pending.roll > 1 ? 's' : ''}. Tap a highlighted spot. You may pass other pawns but not finish on one.`}</p></div></div>`);
      }
    }
  }
  if (!req || req.kind !== 'card') out.push(seatList(), logCard());
  return out.join('');
}
function revealHtml() {
  const r = ui.reveal;
  const move = r.from === r.pos ? `Stayed at <b>${esc(r.pos)}</b>` : `Moved <b>${esc(r.from)}</b> → <b>${esc(r.pos)}</b>`;
  return `<div class="ty-card ty-reveal"><h2>${esc(r.name)} rolled ${r.roll}</h2><p class="mb-2">${move}. <b>Only ${esc(r.name)} should look.</b>${r.supporter ? ' (the Secret Supporter sees whether Tyndale is near or far)' : ''}</p>
    <div class="report">${card(T.LOC_CARD[r.loc], T.LOC_TEXT[r.loc])}${card(T.BIB_CARD[r.bible], capBible(r.bible))}</div>
    <p class="mt-2 mb-2"><b>${r.captured ? 'Tyndale is here!' : r.supporter ? 'You report:' : 'Tell the table:'}</b> ${r.captured ? '' : esc(repText(r.reported))}</p>
    <button type="button" class="btn btn-primary" data-do="done">${r.captured ? 'Continue' : 'Done — pass the phone on'}</button></div>`;
}
function reportHtml() {
  const r = ui.report;
  return `<div class="ty-card ty-reveal"><h2>${esc(nm(S.pawns[S.pending.pawnId].seat))}: what do you report?</h2><p class="mb-2">Only you should look. You were shown:</p>
    <div class="report">${card(T.LOC_CARD[r.ans.loc], T.LOC_TEXT[r.ans.loc])}${card(T.BIB_CARD[r.ans.bible], capBible(r.ans.bible))}</div>
    <p class="small mt-2 mb-2">As the Secret Supporter you may tell the others the truth, or say &ldquo;nothing to report&rdquo;. (Where Tyndale is stays private.)</p>
    <div class="d-flex flex-wrap gap-2"><button type="button" class="btn btn-primary" data-do="truth">Report what I was shown</button><button type="button" class="btn btn-outline-secondary" data-do="nothing">Nothing to report</button></div></div>`;
}

// ---- screens -----------------------------------------------------------------------------------------------------------------------
function render() {
  if (!S) return;
  const req = required(), holding = ui.reveal || ui.report;
  if (!req) ui.viewer = null;
  const gated = !holding && req && ui.viewer !== req.who;
  $('gate').hidden = !gated; $('play-row').hidden = gated;
  $('bar-main').textContent = S.over ? `Game over after ${S.round} turns` : S.phase === 'place' ? 'Place the pawns' : `Round ${S.round}`;
  $('bar-pubs').innerHTML = pubChips();
  $('undo-btn').disabled = !hist.length;
  if (gated) { $('gate').innerHTML = gateHtml(req); return; }
  $('legend').innerHTML = (ui.viewer === 'tyndale' ? '<b>T</b> = Tyndale (you); dotted red line = your route; pale blue ghosts = your shipments sailing to London; ' : '') + 'round markers (N, P, H, O, R, ×) = what the Agents have reported, ringed in the colour of the Agent who found it; the green numbers by the coast are how many moves a shipment from there needs to reach London.';
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
  mountShare($('final-body'), headline, { title, turnsLabel, detail: `Pass and play\n${cfg.n} Agent${cfg.n > 1 ? "s" : ""} · Tyndale: ${person() ? 'a person' : 'the computer, ' + cfg.skill}`, boardSrc: '../../assets/tyndale/board.webp', colours: T.SEAT_COLOURS, labels: S.seats.map((q) => `${q.name} · ${T.charName(q.char)}${q.id === S.supporter ? ' ★' : ''}${q.out ? ' (out)' : ''}`) });
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


// ---- wiring ------------------------------------------------------------------------------------------------------------------------
function onBoardClick(e) {
  const t = e.target.closest && e.target.closest('[data-act]');
  if (!t) return;
  const pos = t.getAttribute('data-pos'), act = t.getAttribute('data-act');
  if (act === 'place') onPlace(pos); else if (act === 'start') onStart(pos); else if (act === 'step') onStep(pos); else if (act === 'target') onTarget(pos);
}
function onClick(e) {
  const b = e.target.closest && e.target.closest('[data-do]');
  if (!b || b.disabled) return;
  const d = b.getAttribute('data-do');
  if (d === 'ready') { ui.viewer = required().who; save(); render(); }
  else if (d === 'seen') { cfg.seen += 1; ui.viewer = null; save(); render(); }
  else if (d === 'unplace') { const placed = S.pawns.filter((p) => p.pos !== null); if (placed.length) { hist.push(S); S = structuredClone(S); S.pawns[placed[placed.length - 1].id].pos = null; save(); render(); } }
  else if (d === 'begin') beginComputer();
  else if (d === 'finish') onFinishMove();
  else if (d === 'undostep') { ui.path = ui.path.slice(0, -1); render(); }
  else if (d === 'roll') onRoll();
  else if (d === 'truth') finishMove(S.pending && ui.report.pos, 'truth');
  else if (d === 'nothing') finishMove(S.pending && ui.report.pos, null);
  else if (d === 'done') { ui.reveal = null; settle(); save(); render(); if (S.over) showFinal(); }
  else if (d === 'accuse') holdVote();
  else if (d === 'noaccuse') { ui.banner = ''; commit(E.closeAccusation(S)); }
  else if (d === 'results') showFinal();
}
function reset() { clearSave(); S = null; cfg = null; hist = []; show('setup'); $('resume').hidden = true; }

function init() {
  const sync = () => { $('skill-wrap').hidden = document.querySelector('input[name=ty]:checked').value === 'person'; };
  document.querySelectorAll('input[name=ty]').forEach((r) => r.addEventListener('change', sync)); sync();
  $('agents').addEventListener('change', nameFields); nameFields();
  $('start-btn').addEventListener('click', () => { clearSave(); startGame(); });
  $('board').addEventListener('click', onBoardClick);
  $('board').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onBoardClick(e); } });
  $('game').addEventListener('click', onClick);
  $('undo-btn').addEventListener('click', undo);
  $('menu-btn').addEventListener('click', () => { if (S && !S.over && !confirm('Leave this game? It will be lost.')) return; reset(); });
  $('final-route').addEventListener('click', () => { ui.route = !ui.route; $('final').close(); render(); });
  $('final-again').addEventListener('click', reset);
  const saved = load();
  if (saved && !saved.S.over) {
    $('resume').hidden = false;
    $('resume-text').textContent = `You have a game in progress (round ${saved.S.round || 'setup'}).`;
    $('resume-btn').addEventListener('click', () => { S = saved.S; cfg = saved.cfg; hist = saved.hist || []; ui = { viewer: null, path: [], reveal: null, report: null, banner: '', route: false }; show('game'); render(); });
    $('discard-btn').addEventListener('click', () => { clearSave(); $('resume').hidden = true; });
  }
}
init();
if (location.search.includes('debug')) window.__pp = { get S() { return S; }, get cfg() { return cfg; }, get ui() { return ui; }, render };   // test hook
