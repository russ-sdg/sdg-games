// Roman Catacombs: scorecard and solo play (UI). Rules live in engine.js.
import { CATS, BOOKS, cardBook } from './books.js';
import * as E from './engine.js';
import * as T from './table.js';
import { SKILLS } from './bot.js';
import { drawShareImage, canvasToBlob, nativeShareData, shareMessage } from './share.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const KEY = 'rc-play-v1';
const IMG = '../../assets/roman-catacombs/cards/';
const colors = (c) => `--c:${c.color};--ci:${c.ink}`;

let state = null;
const ui = { tab: 'library', selected: null, history: [] };

// ---- saving --------------------------------------------------------------------------------------------------------
const save = () => { try { state ? localStorage.setItem(KEY, JSON.stringify(state)) : localStorage.removeItem(KEY); } catch { /* storage unavailable */ } };
function loadSaved() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); return s && Array.isArray(s.library) && s.library.length === 21 ? s : null; } catch { return null; }
}

// ---- moving through the game -------------------------------------------------------------------------------------
function commit(next, { fresh = false } = {}) {
  const before = state;
  if (fresh) ui.history = []; else if (before) ui.history.push(before);
  if (ui.history.length > 60) ui.history.shift();
  state = next;
  ui.selected = null;
  save();
  render();
  if (state.mode === E.MODES.scorecard && before) {
    const done = CATS.findIndex((c, ci) => E.isComplete(state, ci) && !E.isComplete(before, ci));
    if (done >= 0 && !before.claims[CATS[done].id]) askFirst(done);
  }
  if (E.isRound(state) && state.over && !(before && before.over)) showSheet(true);
}

function startGame(mode, opts = ui.last || {}) {
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  ui.tab = 'library';
  ui.last = opts;
  commit(mode === E.MODES.bots ? T.newTable({ bots: opts.bots || 2, skill: opts.skill || 'steady', seed }) : E.newState({ mode, seed }), { fresh: true });
  $('#setup').hidden = true; $('#game').hidden = false;
  window.scrollTo({ top: 0 });
}

function showSetup() {
  $('#game').hidden = true; $('#setup').hidden = false;
  const saved = loadSaved();
  $('#resume').hidden = !saved;
  if (saved) $('#resume-text').textContent = saved.mode === E.MODES.solo ? `Solo game in progress (round ${saved.round} of ${E.ROUNDS}).`
    : saved.mode === E.MODES.bots ? `Game against ${saved.rivals.length} computer${saved.rivals.length > 1 ? 's' : ''} in progress (round ${saved.round}).` : 'A scorecard in progress.';
}

// ---- dialogs -----------------------------------------------------------------------------------------------------
function askFirst(ci) {
  const c = CATS[ci];
  if (state.taken[c.id]) return;                                  // already known: scored as "later"
  $('#claim-title').textContent = `${c.label} complete!`;
  $('#claim-first').textContent = `Yes, first (${c.first} points)`;
  $('#claim-later').textContent = `No, someone finished earlier (${c.second})`;
  const d = $('#claim');
  d.onclose = () => { if (d.returnValue === 'later') commit(E.setClaim(state, c.id, 'later')); d.returnValue = ''; };
  d.showModal();
}

function openSlotPicker(slot) {
  const ci = E.catOf(slot), c = CATS[ci], k = slot % 3;
  const cur = state.library[slot];
  $('#pick-title').textContent = `${c.label} · slot ${k + 1}`;
  $('#pick-sub').textContent = 'These books keep the category in canon order.';
  const opts = E.slotOptions(state, slot);
  $('#pick-list').innerHTML = opts.length ? opts.map((b) => `<button type="button" data-book="${b}" class="${b === cur ? 'cur' : ''}">${esc(BOOKS[b].name)}</button>`).join('')
    : '<p class="mb-0">No book can go here right now.</p>';
  const clear = $('#pick-clear');
  clear.hidden = cur === null;
  clear.onclick = () => { $('#pick').close(); commit(E.clearSlot(state, slot)); };
  $('#pick-list').onclick = (e) => {
    const b = e.target.closest('[data-book]'); if (!b) return;
    $('#pick').close();
    const base = cur === null ? state : E.clearSlot(state, slot);
    commit(E.place(base, slot, Number(b.dataset.book)));
  };
  $('#pick').showModal();
}

function openBookSlotPicker(book, slots) {
  const c = CATS[BOOKS[book].cat];
  $('#pick-title').textContent = `${BOOKS[book].name}: which slot?`;
  $('#pick-sub').textContent = `${c.label}. It can go in any of these without breaking canon order.`;
  const names = ['first', 'middle', 'last'];
  $('#pick-list').innerHTML = slots.map((s) => `<button type="button" data-slot="${s}">Slot ${s % 3 + 1} (${names[s % 3]})</button>`).join('');
  $('#pick-clear').hidden = true;
  $('#pick-list').onclick = (e) => {
    const b = e.target.closest('[data-slot]'); if (!b) return;
    $('#pick').close();
    commit(E.place(state, Number(b.dataset.slot), book));
  };
  $('#pick').showModal();
}

function showSheet(final) {
  const r = E.score(state);
  const bots = state.mode === E.MODES.bots;
  const st = bots ? T.standings(state) : null;
  const place = bots ? st.findIndex((x) => x.you) + 1 : null;
  $('#final-title').textContent = final ? (bots ? (place === 1 ? 'You won!' : `You placed ${ordinal(place)} of ${st.length}`) : 'Game over') : 'Score sheet';
  const why = { complete: 'Someone filled all 21 slots.', stuck: 'No one could place another book.', long: 'The game reached its round limit.' }[state.endReason];
  const standingsHtml = bots ? `${final && why ? `<p class="small text-muted mb-1">${esc(why)} (${state.round} rounds)</p>` : ''}<table class="final-table"><tbody>
    ${st.map((x, i) => `<tr${x.you ? ' style="font-weight:700"' : ''}><td>${i + 1}. ${esc(x.name)}${x.you ? '' : ` <small class="text-muted">${esc(T.skillName(x.skill))}</small>`} <small class="text-muted">${x.filledSlots} of 21 slots</small></td><td>${x.total}</td></tr>`).join('')}</tbody></table><h3 class="h6">Your score sheet</h3>` : '';
  $('#final-body').innerHTML = standingsHtml + `<table class="final-table"><tbody>
    ${r.categories.map((c) => `<tr><td>${esc(c.label)} <small class="text-muted">${c.complete ? (c.how === 'later' ? 'completed after others' : 'completed first') : `${c.filled} of 3`}</small></td><td>${c.complete ? '+' + c.points : '0'}</td></tr>`).join('')}
    <tr><td>Empty slots (${r.empty})</td><td>${r.empty ? '−' + r.empty : '0'}</td></tr>
    <tr class="final-total"><td>Total</td><td>${r.total}</td></tr></tbody></table>`;
  $('#final-again').textContent = final ? 'Play again' : 'New game';
  mountShare($('#final-body'), r.total, place);
  $('#final').showModal();
}

// Share your library as a picture: native share sheet where the browser offers it, plus a download.
async function mountShare(root, total, place) {
  const box = document.createElement('div');
  box.className = 'share-box';
  box.innerHTML = `<div class="share-actions"><button type="button" class="btn btn-primary btn-sm" id="share-dl" disabled>Download image</button>
    <button type="button" class="btn btn-outline-primary btn-sm" id="share-native" hidden>Share\u2026</button>
    <button type="button" class="btn btn-outline-secondary btn-sm" id="share-copy">Copy text</button></div>
    <img class="share-preview" alt="Your finished Roman Catacombs library" width="1200" height="1050" hidden>
    <p class="small text-muted mb-0" id="share-msg" aria-live="polite">Drawing your result card\u2026</p>`;
  root.appendChild(box);
  const img = box.querySelector('.share-preview'), msg = box.querySelector('#share-msg');
  const dl = box.querySelector('#share-dl'), nat = box.querySelector('#share-native'), copy = box.querySelector('#share-copy');
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(shareMessage(total, place)); msg.textContent = 'Copied. Paste it anywhere.'; }
    catch { msg.textContent = shareMessage(total, place); }
  };
  try {
    const canvas = drawShareImage(document.createElement('canvas'), state);
    const blob = await canvasToBlob(canvas);
    const url = URL.createObjectURL(blob);
    img.src = url; img.hidden = false; dl.disabled = false; msg.textContent = '';
    const file = new File([blob], 'roman-catacombs.png', { type: 'image/png' });
    nat.hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    dl.onclick = () => { const a = document.createElement('a'); a.href = url; a.download = 'roman-catacombs.png'; document.body.appendChild(a); a.click(); a.remove(); };
    nat.onclick = async () => { try { await navigator.share(nativeShareData(file, total, place)); } catch { /* cancelled */ } };
  } catch {
    msg.textContent = 'Sorry, the result card could not be drawn in this browser. You can still copy the text.';
  }
}

// ---- rendering -----------------------------------------------------------------------------------------------------
function render() {
  if (!state) return;
  const solo = E.isRound(state);                    // the game deals the cards (solo or against computers)
  const sc = E.score(state);
  $('#score').textContent = sc.total;
  const filled = 21 - sc.empty;
  const bots = state.mode === E.MODES.bots;
  const roundText = state.over ? 'Game over' : state.round ? (bots ? `Round ${state.round}` : `Round ${state.round} of ${E.ROUNDS}`) : 'Ready to flip';
  $('#bar-sub').textContent = solo ? `${roundText} · ${filled} of 21 slots filled${bots ? ` · vs ${state.rivals.length}` : ''}` : `Scorecard · ${filled} of 21 slots filled`;
  $('#undo-btn').disabled = !ui.history.length;
  document.querySelectorAll('.rc-tabs [role=tab]').forEach((t) => {
    const on = t.id === `tab-${ui.tab}`;
    t.setAttribute('aria-selected', on);
    $(`#panel-${t.id.slice(4)}`).hidden = !on;
  });
  renderTray(solo);
  renderRivals(bots);
  renderShelves(solo);
  renderBooks(solo);
}

function renderTray(solo) {
  const el = $('#tray');
  if (!solo) { el.innerHTML = ''; return; }
  if (state.over) { el.innerHTML = `<div class="tray"><h2>Game over</h2><p class="hint mb-2">Your final score is ${E.score(state).total}.</p><button type="button" class="btn btn-primary" id="again-btn">Play again</button> <button type="button" class="btn btn-outline-secondary" id="sheet-btn">Score sheet</button></div>`; return; }
  if (state.round === 0) {
    el.innerHTML = `<div class="tray"><h2>Your deck is shuffled</h2><p class="hint">Each round three cards are flipped and you may add one of the books to your library${state.mode === E.MODES.bots ? ` &mdash; while ${state.rivals.length === 1 ? 'a computer librarian races you' : `${state.rivals.length} computer librarians race you`} for the first-to-finish points` : ''}.</p>
      <div class="deck-back mb-2"><img src="${IMG}back-600.webp" alt="The face-down deck" width="600" height="818"></div>
      <button type="button" class="btn btn-primary btn-lg" id="flip-btn">Flip the first three cards</button></div>`;
    return;
  }
  const placed = state.placedThisRound;
  const bots = state.mode === E.MODES.bots;
  const last = bots ? state.library.every((b) => b !== null) : state.round >= E.ROUNDS;
  const tip = placed !== null ? 'Placed. Flip the next three when you are ready.'
    : E.mustPass(state) ? 'None of these can go anywhere right now, so you pass.'
      : ui.selected === null ? 'Tap a card, then tap a glowing slot to place it. Or pass.' : `Tap a glowing slot for ${BOOKS[cardBook(state.tray[ui.selected])].name}.`;
  el.innerHTML = `<div class="tray"><h2>Round ${state.round}${bots ? '' : ` of ${E.ROUNDS}`}</h2><p class="hint">${esc(tip)}</p>
    <div class="tray-cards">${state.tray.map((id, i) => {
      const opts = E.trayOptions(state, i).length;
      const cls = `tcard${ui.selected === i ? ' sel' : ''}${placed !== null && placed !== i ? ' dim' : ''}${placed === null && !opts ? ' dim' : ''}`;
      return `<button type="button" class="${cls}" data-tray="${i}" ${placed !== null || !opts ? 'disabled' : ''} aria-label="${esc(BOOKS[cardBook(id)].name)}${placed === i ? ', placed' : !opts && placed === null ? ', cannot be placed' : ''}">
        <img src="${IMG}${id}-250.webp" alt="" width="250" height="341">${placed === i ? '<span class="tag">Placed ✔</span>' : ''}</button>`;
    }).join('')}</div>
    <div class="tray-actions"><button type="button" class="btn btn-primary" id="flip-btn">${last ? 'Finish the game' : placed !== null ? 'Flip the next three' : 'Pass – flip the next three'}</button></div></div>`;
}

const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4) % 4] || 'th'}`;

// Standings and the latest moves of the computer librarians.
function renderRivals(bots) {
  const el = $('#rivals');
  if (!bots) { el.innerHTML = ''; return; }
  const rows = T.standings(state);
  const recent = state.log.filter((l) => l.round >= state.round - 1).slice(-8).reverse();
  el.innerHTML = `<div class="tray rivals"><h2>Standings</h2>
    <ul class="rank">${rows.map((x, i) => `<li${x.you ? ' class="you"' : ''}><span class="pos">${i + 1}</span><span class="nm">${esc(x.name)}${x.you ? '' : ` <small>${esc(T.skillName(x.skill))}</small>`}</span><span class="sl">${x.filledSlots}/21</span><b>${x.total}</b></li>`).join('')}</ul>
    ${state.rivals.map((r) => `<details class="rival"><summary>${esc(r.name)}'s library</summary>${CATS.map((c, ci) => `<div class="rl" style="--c:${c.color}"><span class="rc">${esc(c.label)}</span> ${[0, 1, 2].map((k) => { const b = r.library[ci * 3 + k]; return `<span class="rb${b === null ? ' empty' : ''}">${b === null ? '&ndash;' : esc(BOOKS[b].name)}</span>`; }).join('')}</div>`).join('')}</details>`).join('')}
    ${recent.length ? `<h3>Last round</h3><ul class="log">${recent.map((l) => `<li>${esc(l.text)}</li>`).join('')}</ul>` : ''}</div>`;
}

function renderShelves(solo) {
  const targets = solo && ui.selected !== null ? new Set(E.trayOptions(state, ui.selected)) : new Set();
  $('#shelves').innerHTML = CATS.map((c, ci) => {
    const done = E.isComplete(state, ci);
    const pts = done ? E.categoryPoints(state, ci) : null;
    const how = state.claims[c.id];
    const chip = done
      ? `<button type="button" class="pts done" data-claim="${c.id}" ${solo ? 'disabled' : ''} title="${how === 'later' ? 'Completed after another player' : 'Completed first'}">${pts} pts · ${how === 'later' ? 'after' : 'first'}</button>`
      : `<span class="pts">${c.first} first / ${c.second} after</span>`;
    const taken = !solo && !done ? `<label class="taken"><input type="checkbox" data-taken="${c.id}" ${state.taken[c.id] ? 'checked' : ''}> Someone has completed this</label>` : '';
    const slots = [0, 1, 2].map((k) => {
      const s = ci * 3 + k, b = state.library[s];
      const label = `${c.label}, slot ${k + 1}: ${b === null ? 'empty' : BOOKS[b].name}`;
      const target = targets.has(s);
      const disabled = solo && !target ? 'disabled' : '';
      return `<button type="button" class="slot${b !== null ? ' has' : ''}${target ? ' target' : ''}" data-slot="${s}" ${disabled} aria-label="${esc(label)}">${b === null ? (target ? 'Place here' : 'Empty') : esc(BOOKS[b].name)}</button>`;
    }).join('');
    return `<section class="shelf" style="${colors(c)}" aria-label="${esc(c.label)}"><div class="shelf-head"><h2>${esc(c.label)}</h2>${chip}${taken}</div><div class="slots">${slots}</div></section>`;
  }).join('');
}

function renderBooks(solo) {
  $('#panel-books').innerHTML = (solo ? '<p class="small text-muted">Your library so far. In solo play books come from the cards you flip.</p>' : '<p class="small text-muted">Tap a book to add it to your library; tap it again to take it out. Only books that keep canon order are available.</p>')
    + CATS.map((c) => `<section class="bk-cat" style="${colors(c)}"><h2>${esc(c.label)}</h2><div class="bk-list">${c.books.map((name, i) => {
      const b = c.lo + i, at = E.slotOf(state, b), legal = E.legalSlotsFor(state, b);
      const on = at !== null;
      const dis = solo || (!on && !legal.length);
      return `<button type="button" class="bk${on ? ' on' : dis ? ' off' : ''}" data-book="${b}" ${dis ? 'disabled' : ''} aria-pressed="${on}">${on ? '✔ ' : ''}${esc(name)}</button>`;
    }).join('')}</div></section>`).join('');
}

// ---- events ----------------------------------------------------------------------------------------------------------
document.addEventListener('click', (e) => {
  if (!state) return;
  const solo = E.isRound(state);
  const t = e.target;
  const tray = t.closest('[data-tray]');
  if (tray) { const i = Number(tray.dataset.tray); ui.selected = ui.selected === i ? null : i; render(); return; }
  const slot = t.closest('[data-slot]');
  if (slot && slot.closest('#shelves')) {
    const s = Number(slot.dataset.slot);
    if (solo) { if (ui.selected !== null && E.trayOptions(state, ui.selected).includes(s)) commit(E.placeFromTray(state, ui.selected, s)); }
    else openSlotPicker(s);
    return;
  }
  const claim = t.closest('[data-claim]');
  if (claim && !solo) { const id = claim.dataset.claim; commit(E.setClaim(state, id, state.claims[id] === 'later' ? 'first' : 'later')); return; }
  const book = t.closest('.bk[data-book]');
  if (book && !solo) {
    const b = Number(book.dataset.book), at = E.slotOf(state, b);
    if (at !== null) commit(E.clearSlot(state, at));
    else { const legal = E.legalSlotsFor(state, b); if (legal.length === 1) commit(E.place(state, legal[0], b)); else if (legal.length) openBookSlotPicker(b, legal); }
    return;
  }
  if (t.closest('#flip-btn')) { commit(state.mode === E.MODES.bots ? T.flipRound(state) : E.flip(state), { fresh: true }); return; }
  if (t.closest('#again-btn')) { startGame(state.mode); return; }
  if (t.closest('#sheet-btn') || t.closest('#sum-btn')) { showSheet(solo && state.over); return; }
});
document.addEventListener('change', (e) => {
  const tk = e.target.closest && e.target.closest('[data-taken]');
  if (tk && state) commit(E.setTaken(state, tk.dataset.taken, tk.checked));
});
document.querySelectorAll('.rc-tabs [role=tab]').forEach((t) => t.addEventListener('click', () => { ui.tab = t.id.slice(4); render(); }));
$('#undo-btn').addEventListener('click', () => { if (ui.history.length) { state = ui.history.pop(); ui.selected = null; save(); render(); } });
$('#menu-btn').addEventListener('click', () => {
  if (state && !state.over && state.library.some((b) => b !== null) && !confirm('Leave this game? Your current library will be lost.')) return;
  state = null; ui.history = []; save(); showSetup();
});
$('#start-btn').addEventListener('click', () => startGame(document.querySelector('input[name=mode]:checked').value, { bots: Number($('#bot-count').value), skill: $('#bot-skill').value }));
document.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', () => { $('#bots-fields').hidden = document.querySelector('input[name=mode]:checked').value !== 'bots'; }));
$('#resume-btn').addEventListener('click', () => { state = loadSaved(); ui.history = []; $('#setup').hidden = true; $('#game').hidden = false; render(); });
$('#discard-btn').addEventListener('click', () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } $('#resume').hidden = true; });
$('#final').addEventListener('close', () => { if ($('#final').returnValue === 'again') { const m = state && state.mode; state = null; ui.history = []; save(); m === E.MODES.scorecard ? showSetup() : startGame(m); } $('#final').returnValue = ''; });

showSetup();
