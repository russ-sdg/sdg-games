// Prophets & Kings scorepad: the page. Scores are kept in this browser (localStorage) so a refresh or a phone call does not lose them.
import * as P from './scorepad-core.js';

const KEY = 'sdg-pk-scorepad-1';
const $ = (id) => document.getElementById(id);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function load() { try { return P.sanitize(JSON.parse(localStorage.getItem(KEY))); } catch (e) { return null; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(pad)); } catch (e) { /* private mode */ } }
let pad = load() || P.newPad(2);
let msgTimer = 0;
const say = (t) => { $('msg').textContent = t; clearTimeout(msgTimer); msgTimer = setTimeout(() => { $('msg').textContent = ''; }, 4000); };

function renderBar() {
  const rows = P.standings(pad);
  $('bar').innerHTML = rows.map((r) => `<div class="ps-chip${r.leader ? ' is-lead' : ''}"><span class="rank">${r.leader ? '★' : r.rank}</span><span class="n">${esc(r.name)}</span><span class="pts">${r.total}</span></div>`).join('');
}

function panelHtml(p, i) {
  const rows = P.SIZES.map((size) => `<div class="ps-row">
      <div class="lbl"><b>${size} cards</b><small>${P.points(size)} points each</small></div>
      <div class="stepper"><button type="button" class="ps-btn" data-step="${i}:${size}:-1" aria-label="One fewer ${size}-card set for ${esc(p.name)}">−</button>
        <output data-n="${i}:${size}" aria-label="${size}-card sets">${p.sets[size]}</output>
        <button type="button" class="ps-btn plus" data-step="${i}:${size}:1" aria-label="One more ${size}-card set for ${esc(p.name)}">+</button></div>
      <div class="sub" data-sub="${i}:${size}">${p.sets[size] ? p.sets[size] * P.points(size) : ''}</div></div>`).join('');
  return `<section class="ps-player" data-p="${i}">
    <div class="ps-head"><label class="visually-hidden" for="name-${i}">Player ${i + 1} name</label>
      <input class="ps-name-in" id="name-${i}" data-name="${i}" value="${esc(p.name)}" maxlength="24" autocomplete="off" />
      <div class="ps-total"><b data-total="${i}">${P.total(p)}</b><small>points</small></div></div>
    ${rows}
    <div class="ps-foot"><span data-cards="${i}">${P.cardCount(p)} cards in sets</span>${pad.players.length > 1 ? `<button type="button" class="btn btn-sm btn-link text-danger p-0" data-remove="${i}">Remove player</button>` : ''}</div>
  </section>`;
}
function renderPlayers() {
  $('players').innerHTML = pad.players.map(panelHtml).join('');
  $('add-btn').disabled = pad.players.length >= P.MAX_PLAYERS;
}
// A step only changes numbers, so update them in place (the button the person is pressing keeps focus).
function refreshPlayer(i) {
  const p = pad.players[i];
  for (const size of P.SIZES) {
    document.querySelector(`[data-n="${i}:${size}"]`).textContent = p.sets[size];
    document.querySelector(`[data-sub="${i}:${size}"]`).textContent = p.sets[size] ? p.sets[size] * P.points(size) : '';
  }
  document.querySelector(`[data-total="${i}"]`).textContent = P.total(p);
  document.querySelector(`[data-cards="${i}"]`).textContent = `${P.cardCount(p)} cards in sets`;
}
function renderTable() {
  $('table').innerHTML = `<div class="ps-tr head"><span>Cards in set</span><span>Points</span></div>` + [...P.SIZES].reverse().map((s) => `<div class="ps-tr"><span>${s}</span><span>${P.points(s)}</span></div>`).join('');
}

document.addEventListener('click', (e) => {
  const st = e.target.closest('[data-step]');
  if (st) {
    const [i, size, d] = st.dataset.step.split(':').map(Number);
    pad = P.step(pad, i, size, d); save(); refreshPlayer(i); renderBar(); return;
  }
  const rm = e.target.closest('[data-remove]');
  if (rm) {
    const i = Number(rm.dataset.remove);
    if (!confirm(`Remove ${pad.players[i].name}?`)) return;
    pad = P.removePlayer(pad, i); save(); renderPlayers(); renderBar();
  }
});
document.addEventListener('input', (e) => {
  const n = e.target.closest && e.target.closest('[data-name]');
  if (!n) return;
  pad.players[Number(n.dataset.name)].name = n.value.slice(0, 24) || `Player ${Number(n.dataset.name) + 1}`; save(); renderBar();
});
$('add-btn').addEventListener('click', () => { pad = P.addPlayer(pad); save(); renderPlayers(); renderBar(); const last = $(`name-${pad.players.length - 1}`); if (last) { last.focus(); last.select(); } });
$('reset-btn').addEventListener('click', () => {
  if (!P.standings(pad).some((r) => r.total) || confirm('Clear everyone’s scores? Player names are kept.')) { pad = P.resetScores(pad); save(); renderPlayers(); renderBar(); say('Scores cleared.'); }
});
$('copy-btn').addEventListener('click', async () => {
  const text = P.summary(pad);
  try { await navigator.clipboard.writeText(text); say('Copied. Paste it anywhere.'); } catch (e) { say(text); }
});

renderBar(); renderPlayers(); renderTable();
if (location.search.includes('debug')) window.ps = { P, get pad() { return pad; } };
