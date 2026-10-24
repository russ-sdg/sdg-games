// Tyndale at a shared table: an Agent's own phone. It is a map, a die and a scorecard. The real positions and the answer cards are
// on the host phone; the Agents share what they learn by talking.
import * as E from './engine.js';
import * as T from './table-core.js';
import { drawBoard, ALL_SPOTS } from './boardview.js';

const PREFIX = 'sdg-ty-agent-', LAST = 'sdg-ty-agent-last';
const $ = (id) => document.getElementById(id);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TOOLS = [['pawn', 'Pawn'], ['N', 'N'], ['P', 'P'], ['H', 'H'], ['O', 'O'], ['rumors', 'R'], ['nothing', '×'], ['other', 'Other pawn'], ['erase', 'Erase']];
const TOOL_HELP = { pawn: 'Tap a spot to place or move your pawn.', N: 'New Testament found here', P: 'Pentateuch found here', H: 'Historical Books found here', O: 'Old Testament found here', rumors: 'Rumors of a translation here', nothing: 'Nothing to report here', other: 'Another Agent\'s pawn (to remember where they are)', erase: 'Tap a note to rub it out.' };

let me = null;       // { code, n, seed, seat, name, char, supporter, pawnCount }
let st = null;       // { pawns: [pos|null], sel, roll, marks: {pos: tool}, others: [pos], tool, shown, undo: [] }
const key = () => PREFIX + me.code + '-' + me.seat;
function save() { try { localStorage.setItem(key(), JSON.stringify({ me, st })); localStorage.setItem(LAST, key()); } catch (e) { /* private mode */ } }
function loadKey(k) { try { const v = JSON.parse(localStorage.getItem(k)); return v && v.me && v.st ? v : null; } catch (e) { return null; } }

function newState() { return { pawns: Array(me.pawnCount).fill(null), sel: 0, roll: null, marks: {}, others: [], tool: 'pawn', shown: false, undo: [] }; }
function snap() { st.undo.push(JSON.stringify({ pawns: st.pawns, marks: st.marks, others: st.others, roll: st.roll })); if (st.undo.length > 60) st.undo.shift(); }
function undo() { if (!st.undo.length) return; const p = JSON.parse(st.undo.pop()); Object.assign(st, p); save(); render(); }

// ---- joining ------------------------------------------------------------------------------------------------------------------
let pending = null;
function checkCode() {
  const p = T.parseCode($('code').value);
  $('code-err').hidden = !!p || !$('code').value.trim();
  $('seat-pick').hidden = !p;
  if (!p) { pending = null; return; }
  if (pending && pending.code === p.code) return;           // the list is already built (and keeps the seat they picked)
  pending = p;
  const d = T.deal(p.seed, p.n), per = E.pawnsPerSeat(p.n);
  $('seat-list').innerHTML = d.names.map((nm, i) => `<label><input type="radio" name="seat" value="${i}"${i === 0 ? ' checked' : ''}> <span class="seat-dot" style="background:${T.SEAT_COLOURS[i]}"></span><span>${esc(nm)} <small class="text-muted">${per[i]} pawn${per[i] > 1 ? 's' : ''}</small></span></label>`).join('');
}
function join() {
  checkCode();
  if (!pending) { $('code').focus(); return; }
  const seat = Number((document.querySelector('input[name=seat]:checked') || {}).value || 0), d = T.deal(pending.seed, pending.n);
  me = { code: pending.code, n: pending.n, seed: pending.seed, seat, name: d.names[seat], char: d.chars[seat], supporter: d.supporter === seat, pawnCount: E.pawnsPerSeat(pending.n)[seat] };
  const old = loadKey(key());
  st = old ? old.st : newState();
  save(); show('game'); render();
}
function show(w) { $('join').hidden = w !== 'join'; $('game').hidden = w !== 'game'; window.scrollTo(0, 0); }

// ---- the map ---------------------------------------------------------------------------------------------------------------------
const colour = () => T.SEAT_COLOURS[me.seat];
function targets() { return st.roll && st.pawns[st.sel] ? T.reach(E.neighbors, st.pawns[st.sel], st.roll) : []; }
function board() {
  const o = { marks: [], pawns: [], taps: [] };
  for (const [pos, b] of Object.entries(st.marks)) o.marks.push({ pos, bible: b, color: colour() });
  st.others.forEach((pos) => o.pawns.push({ pos, color: '#8b8f94', label: '•' }));
  st.pawns.forEach((pos, i) => { if (pos) o.pawns.push({ pos, color: colour(), label: me.pawnCount > 1 ? String(i + 1) : me.name[0], big: i === st.sel }); });
  const tg = st.tool === 'pawn' ? targets() : [];
  if (tg.length) tg.forEach((pos) => o.taps.push({ pos, act: 'tap', pulse: true, label: `move to ${pos}` }));
  else ALL_SPOTS.forEach((pos) => o.taps.push({ pos, act: 'tap', label: pos }));
  drawBoard($('board'), o);
}
function tap(pos) {
  snap();
  if (st.tool === 'pawn') {
    if (st.roll && !targets().includes(pos)) { st.undo.pop(); return; }
    st.pawns[st.sel] = pos; st.roll = null; st.moved = pos;
  } else if (st.tool === 'other') {
    st.others = st.others.includes(pos) ? st.others.filter((q) => q !== pos) : [...st.others, pos];
  } else if (st.tool === 'erase') {
    delete st.marks[pos]; st.others = st.others.filter((q) => q !== pos);
  } else if (st.marks[pos] === st.tool) delete st.marks[pos]; else st.marks[pos] = st.tool;
  save(); render();
}

// ---- the panels --------------------------------------------------------------------------------------------------------------------
function roll() { st.roll = 1 + Math.floor(Math.random() * 3); st.tool = 'pawn'; if (!st.pawns[st.sel]) st.roll = st.roll; save(); render(); }
function controls() {
  const place = st.pawns[st.sel] === null;
  const pawnBtns = me.pawnCount > 1 ? `<div class="pawn-pick mb-2" role="group" aria-label="Choose a pawn">${st.pawns.map((p, i) => `<button type="button" data-do="sel" data-i="${i}" aria-pressed="${i === st.sel}">Pawn ${i + 1} · ${p || 'not placed'}</button>`).join('')}</div>` : '';
  const rollHtml = st.roll
    ? `<div class="d-flex align-items-center gap-2 mb-2"><span class="ty-roll" aria-label="You rolled ${st.roll}">${st.roll}</span><p class="mb-0">${st.pawns[st.sel] ? `Move exactly <b>${st.roll}</b> step${st.roll > 1 ? 's' : ''}: tap one of the pulsing spots, then <b>tell the host where you landed</b>.` : 'Place your pawn first (tap Pawn, then the map).'}</p></div>`
    : `<div class="d-flex flex-wrap align-items-center gap-2 mb-2"><button type="button" class="btn btn-primary" data-do="roll" ${place ? 'disabled' : ''}>Roll the die</button>${st.moved && !place ? `<span class="small">Last landed on <b>${esc(st.pawns[st.sel])}</b> — tell the host.</span>` : ''}${place ? '<span class="small">Tap the map to place your pawn first, then tell the host where it is.</span>' : ''}</div>`;
  return `${pawnBtns}${rollHtml}<div class="tool-row" role="group" aria-label="Tool">${TOOLS.map(([k, l]) => `<button type="button" data-do="tool" data-k="${k}" aria-pressed="${st.tool === k}" class="tool tool-${k}">${esc(l)}</button>`).join('')}</div><p class="small text-muted mb-0 mt-1">${esc(TOOL_HELP[st.tool])}</p>`;
}
function side() {
  const shown = st.shown;
  return `<div class="ty-card id-card"><img src="${T.CARD(me.char)}" alt="${shown ? esc(T.charName(me.char)) : 'Your character card (hidden)'}" ${shown ? '' : 'style="filter:blur(14px)"'}/><div><h2>You are ${esc(me.name)}</h2>
      <p class="small mb-1">${shown ? `Your character card: <b>${esc(T.charName(me.char))}</b>.` : 'Your character card is hidden.'}</p>
      ${shown && me.supporter ? '<p class="mb-1"><b>You are the Secret Supporter.</b> You are on Tyndale\'s side. When the referee shows you Rumors or a translation, you decide whether to tell the others the truth or say &ldquo;nothing to report&rdquo;.</p>' : ''}
      <button type="button" class="btn btn-sm btn-outline-secondary" data-do="card">${shown ? 'Hide my card' : 'Show my card (private)'}</button></div></div>
    <div class="ty-card"><h2>Table ${esc(me.code)}</h2><p class="small mb-0">${me.n} Agents. On your turn: roll here, move, tell the host where you landed, look at the two cards they show you (only you), then tell the table what you found. Jot down what the others report with the clue tools.</p></div>`;
}
function render() {
  $('bar-main').textContent = `${me.name} · table ${me.code}`;
  $('undo-btn').disabled = !st.undo.length;
  $('controls').innerHTML = controls();
  $('side').innerHTML = side();
  board();
}

function init() {
  const q = new URLSearchParams(location.search).get('code');
  if (q) $('code').value = q;
  $('code').addEventListener('input', checkCode);
  $('join-btn').addEventListener('click', join);
  $('board').addEventListener('click', (e) => { const t = e.target.closest && e.target.closest('[data-act]'); if (t) tap(t.getAttribute('data-pos')); });
  $('board').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { const t = e.target.closest && e.target.closest('[data-act]'); if (t) { e.preventDefault(); tap(t.getAttribute('data-pos')); } } });
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-do]');
    if (!b || b.disabled || !st || $('game').hidden) return;
    const d = b.dataset.do;
    if (d === 'roll') roll();
    else if (d === 'sel') { st.sel = Number(b.dataset.i); st.roll = null; save(); render(); }
    else if (d === 'tool') { st.tool = b.dataset.k; save(); render(); }
    else if (d === 'card') { st.shown = !st.shown; save(); render(); }
  });
  $('undo-btn').addEventListener('click', undo);
  $('leave-btn').addEventListener('click', () => { if (!confirm('Leave this table? Your notes on this phone will be kept if you rejoin with the same code and name.')) return; me = st = null; show('join'); });
  const last = (() => { try { return loadKey(localStorage.getItem(LAST)); } catch (e) { return null; } })();
  if (last) {
    $('resume').hidden = false;
    $('resume-text').textContent = `You were ${last.me.name} at table ${last.me.code}.`;
    $('resume-btn').addEventListener('click', () => { me = last.me; st = last.st; show('game'); render(); });
    $('discard-btn').addEventListener('click', () => { try { localStorage.removeItem(localStorage.getItem(LAST)); localStorage.removeItem(LAST); } catch (e) { /* ignore */ } $('resume').hidden = true; });
  }
  if (q) checkCode();
}
init();
if (location.search.includes('debug')) window.__ta = { get me() { return me; }, get st() { return st; } };   // test hook
