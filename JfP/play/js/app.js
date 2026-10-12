// Journeys for Paul - online play UI (solo, pass-and-play and in-person own-phone play).
import MAP from './map-data.js';
import {
  MODES, MODE_NAMES, EVANGELISTS, EV_NAMES, city, edge, score, wouldBeCalled, maxActions,
} from './engine.js';
import * as G from './game.js';
import { RULESETS, canTravelAny, allCalled } from './engine.js';
import { boardSVG, legendHTML, tokenSpot, esc, EV_COLOR, REGION_COLOR } from './board.js';
import { snippetFor } from './scripture.js';
import { mountReplay, verseHTML } from './replay.js';
import { drawShareImage, canvasToBlob, shareMessage, nativeShareData } from './share.js';

const SAVE_KEY = 'jfp-play-v1';
const MODE_SHORT = { road: 'road', foot: 'footpath', boat: 'boat' };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = (sel) => document.querySelector(sel);

let state = null;
let replayHandle = null;
let ui = { selected: null, history: [], handoff: null, rolling: false, showLog: false };

// ---- persistence ------------------------------------------------------------
function save() {
  try {
    if (state && state.phase !== 'over') localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    else localStorage.removeItem(SAVE_KEY);
  } catch { /* private mode etc. - the game still works */ }
}
function loadSaved() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    return s && s.v === 1 && G.rules(s) ? s : null;
  } catch { return null; }
}

// ---- setup screen -----------------------------------------------------------
function initSetup() {
  const form = $('#setup-form');
  const kindEls = () => form.querySelectorAll('[name=kind]');
  const names = $('#player-names');
  const count = $('#player-count');

  function drawNames() {
    const prev = [...names.querySelectorAll('input')].map((i) => i.value);
    names.innerHTML = '';
    for (let i = 0; i < Number(count.value); i++) {
      names.insertAdjacentHTML('beforeend',
        `<div class="col-sm-6"><input class="form-control" maxlength="20" aria-label="Player ${i + 1} name" placeholder="Player ${i + 1}" value="${esc(prev[i] ?? '')}"></div>`);
    }
  }
  function syncKind() {
    const kind = form.querySelector('[name=kind]:checked').value;
    $('#solo-fields').hidden = kind !== 'solo';
    $('#pass-fields').hidden = kind !== 'pass';
    $('#table-fields').hidden = kind !== 'table';
  }
  const syncBots = () => { $('#skill-wrap').hidden = Number($('#bots').value) === 0; };
  $('#bots').addEventListener('change', syncBots);
  syncBots();
  kindEls().forEach((el) => el.addEventListener('change', syncKind));
  count.addEventListener('change', drawNames);
  drawNames();
  syncKind();

  // in-person table: every player is listed (same order on every phone) and one row is "me"
  const tNames = $('#table-names');
  const tCount = $('#table-count');
  function drawTable() {
    const prev = [...tNames.querySelectorAll('input[type=text]')].map((i) => i.value);
    const me = tNames.querySelector('input[type=radio]:checked')?.value ?? '0';
    tNames.innerHTML = '';
    for (let i = 0; i < Number(tCount.value); i++) {
      tNames.insertAdjacentHTML('beforeend', `<div class="seat-row">
        <input type="radio" name="me" value="${i}" ${String(i) === me ? 'checked' : ''} aria-label="Player ${i + 1} is me">
        <input type="text" class="form-control" maxlength="20" aria-label="Player ${i + 1} name" placeholder="Player ${i + 1}${i === 0 ? ' (rolls first)' : ''}" value="${esc(prev[i] ?? '')}"></div>`);
    }
  }
  const readTable = () => ({
    names: [...tNames.querySelectorAll('input[type=text]')].map((i, n) => i.value.trim() || `Player ${n + 1}`),
    me: Number(tNames.querySelector('input[type=radio]:checked').value),
  });
  tCount.addEventListener('change', drawTable);
  drawTable();

  $('#invite-btn').onclick = async () => {
    const link = inviteURL(form.querySelector('[name=rules]:checked').value, readTable().names);
    const msg = $('#invite-msg');
    try {
      if (navigator.share) await navigator.share({ title: 'Journeys for Paul', text: 'Join our game of Journeys for Paul:', url: link });
      else { await navigator.clipboard.writeText(link); msg.textContent = 'Link copied - send it to the others.'; }
    } catch { msg.textContent = link; }
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const kind = form.querySelector('[name=kind]:checked').value;
    const rulesId = form.querySelector('[name=rules]:checked').value;
    const typed = [...names.querySelectorAll('input')].map((i, n) => i.value.trim() || `Player ${n + 1}`);
    if (kind === 'table') {
      const t = readTable();
      return startGame(G.newGame({ kind, rulesId, names: t.names, me: t.me }));
    }
    startGame(G.newGame({
      kind, rulesId,
      names: kind === 'solo' ? [$('#solo-name').value.trim() || 'You'] : typed,
      bots: Number($('#bots').value),
      botLevel: $('#bot-skill').value,
    }));
  });

  const saved = loadSaved();
  if (saved) {
    $('#resume').hidden = false;
    $('#resume-btn').onclick = () => startGame(saved);
    $('#discard-btn').onclick = () => { try { localStorage.removeItem(SAVE_KEY); } catch {} $('#resume').hidden = true; };
  }
}

// ---- invite / join links (in-person table play) ------------------------------
function inviteURL(rulesId, names) {
  const q = new URLSearchParams({ table: '1', rules: rulesId });
  names.forEach((n) => q.append('p', n));
  return `${location.origin}${location.pathname}?${q}`;
}

function initJoin() {
  const q = new URLSearchParams(location.search);
  const players = q.getAll('p').map((n) => n.slice(0, 20));
  const rulesId = q.get('rules');
  if (q.get('table') !== '1' || players.length < 2 || players.length > 6 || !RULESETS[rulesId]) return;
  $('#join').hidden = false;
  $('#join-rules').textContent = RULESETS[rulesId].name;
  $('#join-players').innerHTML = players.map((n, i) => `<label class="choice"><input type="radio" name="join-me" value="${i}" ${i === 0 ? 'checked' : ''}>
    <span><strong>${esc(n)}</strong><small>${i === 0 ? 'Player 1 &ndash; rolls first' : `Player ${i + 1}`}</small></span></label>`).join('');
  $('#join-btn').onclick = () => {
    const me = Number(document.querySelector('[name=join-me]:checked').value);
    history.replaceState(null, '', location.pathname);   // a reload resumes the game instead of re-joining
    startGame(G.newGame({ kind: 'table', rulesId, names: players, me }));
  };
}

function show(which) {
  $('#verse').hidden = true;
  for (const id of ['setup', 'game', 'results']) $('#' + id).hidden = id !== which;
  window.scrollTo({ top: 0 });
}

// keep the phone awake during an in-person game
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* not supported or refused: the game still works */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state?.kind === 'table' && state.phase !== 'over') keepAwake(true);
});

function startGame(s) {
  state = s;
  ui = { selected: null, history: [], handoff: null, rolling: false, showLog: false, viewSeat: null };
  show('game');
  keepAwake(s.kind === 'table');
  save();
  render();
}

// ---- state transitions ------------------------------------------------------
const activeSeat = (s) => (s.phase === 'act' ? s.actor : G.isHumanSeat(s, s.roller) ? s.roller : 0);

function commit(next, { undoable = false } = {}) {
  const prev = state;
  if (undoable) ui.history.push(prev); else ui.history = [];
  state = next;
  if (next.kind === 'pass' && next.phase !== 'over' && activeSeat(prev) !== activeSeat(next)) {
    ui.handoff = next.seatNames[activeSeat(next)];
  }
  // keep the selection only while it still means something
  if (ui.selected && !(next.phase === 'act' && hasOptions(ui.selected))) ui.selected = null;
  if (!ui.selected) ui.focusEv = null;
  autoSelect();
  save();
  render();
}

function autoSelect() {
  if (state.phase !== 'act' || ui.selected) return;
  const able = EVANGELISTS.filter(hasOptions);
  if (able.length === 1) ui.selected = able[0];
}

const hasOptions = (ev) => {
  const o = G.evOptions(state, ev);
  return o.moves.length > 0 || o.preach;
};

function doRoll() {
  if (ui.rolling) return;
  const go = () => { ui.rolling = false; commit(G.roll(state)); };
  if (reduceMotion) return go();
  ui.rolling = true;
  render();
  setTimeout(go, 800);
}

function doMove(edgeId) {
  if (!ui.selected) return;
  commit(G.move(state, ui.selected, edgeId), { undoable: true });
}
function doPreach(ev) { commit(G.preach(state, ev), { undoable: true }); }
function doUndo() {
  if (!ui.history.length) return;
  state = ui.history.pop();
  ui.selected = null;
  autoSelect();
  save();
  render();
}

// ---- rendering --------------------------------------------------------------
function swatch(mode) {
  const line = {
    road: '<line x1="4" y1="7" x2="50" y2="7" stroke="#222" stroke-width="7" stroke-linecap="round"/>',
    foot: '<line x1="4" y1="7" x2="50" y2="7" stroke="#222" stroke-width="7" stroke-linecap="round" stroke-dasharray="1 13"/>',
    boat: '<line x1="4" y1="7" x2="50" y2="7" stroke="#222" stroke-width="9" stroke-linecap="round"/><line x1="8" y1="7" x2="46" y2="7" stroke="#fff" stroke-width="5" stroke-dasharray="9 7"/>',
  }[mode];
  return `<svg class="swatch" viewBox="0 0 54 14" aria-hidden="true">${line}</svg>`;
}
function dieFace(face) {
  return face === 'choice'
    ? `<span class="q">?</span><span>Player's Choice</span>`
    : `${swatch(face)}<span>${MODE_NAMES[face]}</span>`;
}
// which sheet the board is showing: mine, or (solo) a computer opponent's, read-only
const viewing = () => ui.viewSeat != null && G.isBotSeat(state, ui.viewSeat);
const viewSheet = () => (viewing() ? state.sheets[ui.viewSeat] : mySheet());
const sheetSeat = () => (state.kind === 'pass' ? activeSeat(state) : 0);
const mySheet = () => state.sheets[sheetSeat()];

function render() {
  if (state.phase === 'over') return renderResults();
  renderHud();
  renderBoard();
  renderSide();
  renderVerse();
  renderHandoff();
}

// Scripture for the preach just made, as a dismissible toast (it does not shift the layout)
function renderVerse() {
  const el = $('#verse');
  const lp = state.lastPreach;
  if (!lp || state.phase !== 'act') { el.hidden = true; ui.verseKey = null; return; }
  const key = `${state.round}:${lp.seat}:${lp.ev}:${lp.cityId}:${lp.n}`;
  if (key !== ui.verseKey) { ui.verseKey = key; ui.verseOpen = true; }
  el.hidden = !ui.verseOpen;
  if (!ui.verseOpen) return;
  el.innerHTML = `<button type="button" class="btn-close verse-close" aria-label="Close verse"></button>${verseHTML(snippetFor(lp.cityId, lp.called), EV_NAMES[lp.ev])}`;
  el.querySelector('.verse-close').onclick = () => { ui.verseOpen = false; el.hidden = true; };
}

function renderHandoff() {
  const el = $('#handoff');
  el.hidden = !ui.handoff;
  if (ui.handoff) {
    $('#handoff-title').textContent = ui.handoff;
    setTimeout(() => $('#handoff-ok').focus(), 0);
  }
}

function roleText() {
  const table = state.kind === 'table';
  if (state.role === 'roller') {
    return table ? 'Tell the table what you rolled! Then move or preach with one to three evangelists.'
      : 'You rolled: move or preach with one to three evangelists.';
  }
  const who = table || G.isBotSeat(state, state.roller) ? state.seatNames[state.roller] : 'Another player';
  return rules().nonRollerMayPreach
    ? `${who} rolled: use one evangelist to move, or to preach if he cannot move.`
    : `${who} rolled: move one evangelist (only the roller may preach).`;
}
const rules = () => G.rules(state);

const dieImg = (extra = '') => `<img class="die-img ${extra}" src="assets/die.svg" alt="The eight-sided die" width="72" height="63">`;

function renderHud() {
  const s = state;
  const who = s.seatNames[s.roller];
  const humanRoller = G.isHumanSeat(s, s.roller);
  const table = s.kind === 'table';
  const head = `<div class="grow"><div class="who">`;
  let body = '';
  if (s.phase === 'roll' && table && !humanRoller) {
    // in person: someone else rolls and says what came up
    body = `${dieImg()}${head}Round ${s.round} &middot; ${esc(who)} is rolling</div>
      <div class="sub">Listen for ${esc(who)}'s roll, then tap what they announced. (Player's Choice? Tap the way they chose.)</div></div>
      <div class="announce">${MODES.map((m) => `<button class="btn btn-light btn-lg" data-announce="${m}">${swatch(m)} ${MODE_NAMES[m]}</button>`).join('')}</div>`;
  } else if (s.phase === 'roll') {
    body = `${dieImg(ui.rolling ? 'rolling' : '')}${head}Round ${s.round} &middot; ${humanRoller ? (table ? 'Your turn to roll' : `${esc(who)}, roll the die`) : `${esc(who)} is about to roll`}</div>
      <div class="sub">${esc(rules().name)}${s.kind === 'solo' && s.seats > 1 ? ' &middot; opponents play their own maps' : table ? ' &middot; roll, then tell the table what came up' : ''}</div></div>
      <button class="btn btn-warning btn-lg nudge" id="roll-btn" ${ui.rolling ? 'disabled' : ''}>${humanRoller ? 'Roll' : `Roll for ${esc(who)}`}</button>`;
  } else if (s.phase === 'choose') {
    body = `${dieImg()}${head}Player's Choice! ${esc(who)}, pick how everyone travels</div><div class="sub">${table ? 'Tell the table which way you choose &ndash; everyone travels that way.' : 'All players will use the mode you choose.'}</div></div>
      <div class="btn-group-modes">${MODES.map((m) => `<button class="btn btn-light" data-mode="${m}">${swatch(m)} ${MODE_NAMES[m]}</button>`).join('')}</div>`;
  } else {
    const actor = s.seatNames[s.actor];
    const say = table && s.role === 'roller' ? `<div class="say-it">Tell the table: &ldquo;${MODE_NAMES[s.mode]}!&rdquo;</div>` : '';
    body = `${dieImg()}${head}${esc(actor)} &middot; Round ${s.round}</div><div class="sub">${roleText()}</div>${say}</div>
      <div class="die ${s.face === 'choice' ? 'choice' : ''}" title="${s.face === 'choice' ? 'Chosen with Player\'s Choice' : 'Rolled'}">${dieFace(s.mode)}</div>`;
  }
  $('#hud').innerHTML = body;
  const rb = $('#roll-btn'); if (rb) rb.onclick = doRoll;
  $('#hud').querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => commit(G.chooseMode(state, b.dataset.mode)); });
  $('#hud').querySelectorAll('[data-announce]').forEach((b) => { b.onclick = () => commit(G.announceRoll(state, b.dataset.announce)); });
}

function renderBoard() {
  const s = state;
  const watching = viewing();
  const sheet = viewSheet();
  const acting = !watching && s.phase === 'act';
  const sel = acting ? ui.selected : null;
  const moves = sel ? G.evOptions(s, sel).moves : [];

  const board = $('#board');
  const keep = board.scrollLeft;
  board.innerHTML = boardSVG(sheet, { acting, mode: s.mode, sel, moves, acted: s.acted });
  renderViewBar();
  board.scrollLeft = keep;
  if (sel && board.scrollWidth > board.clientWidth && ui.focusEv !== sel) {
    const [tx] = tokenSpot(city(sheet.evangelists[sel].city), EVANGELISTS.indexOf(sel));
    board.scrollLeft = Math.max(0, (tx / MAP.width) * board.scrollWidth - board.clientWidth / 2);
  }
  ui.focusEv = sel;
  board.onclick = (ev) => {
    if (watching) return;
    const mv = ev.target.closest('[data-move]');
    if (mv) return doMove(mv.dataset.move);
    const tok = ev.target.closest('[data-ev]');
    if (tok) selectEv(tok.dataset.ev);
  };
  board.onkeydown = (ev) => {
    if (watching || (ev.key !== 'Enter' && ev.key !== ' ')) return;
    const t = ev.target.closest('[data-move],[data-ev]');
    if (!t) return;
    ev.preventDefault();
    t.dataset.move ? doMove(t.dataset.move) : selectEv(t.dataset.ev);
  };
  $('#legend').innerHTML = legendHTML();
}

function selectEv(ev) {
  if (viewing() || state.phase !== 'act' || !hasOptions(ev)) return;
  ui.selected = ui.selected === ev ? null : ev;
  render();
}

function evCard(ev) {
  const s = state;
  const sheet = mySheet();
  const e = sheet.evangelists[ev];
  const c = city(e.city);
  const acting = s.phase === 'act';
  const o = acting ? G.evOptions(s, ev) : { moves: [], preach: false };
  const able = o.moves.length > 0 || o.preach;
  const preached = Object.values(e.preachedAt).reduce((a, b) => a + b, 0);
  const chips = Object.entries(MAP.regions).map(([k, n]) =>
    `<span class="rchip${e.regions.includes(k) ? ' on' : ''}" style="--rc:${REGION_COLOR[k]}" title="${esc(n)}">${esc(n.replace('Mediterranean ', '').replace(' & Achaia', ''))}</span>`).join('');
  let status;
  if (e.called) status = '<b>Called as pastor</b> &ndash; journey complete';
  else if (!acting) status = `In ${esc(c.name)}`;
  else if (s.acted.includes(ev)) status = 'Already acted this turn';
  else if (s.actions >= maxActions(s.role)) status = 'No more actions this turn';
  else if (o.moves.length) status = `Can travel to ${o.moves.length} ${o.moves.length === 1 ? 'place' : 'places'} by ${MODE_SHORT[s.mode]}`;
  else if (o.preach) status = `Cannot move by ${MODE_SHORT[s.mode]} &ndash; can preach`;
  else status = `Cannot ${s.role === 'other' && !rules().nonRollerMayPreach ? 'move' : 'act'} with ${MODE_SHORT[s.mode]}`;

  const sel = ui.selected === ev;
  let actions = '';
  if (acting && sel && o.moves.length) {
    actions += `<div class="dest-list">${o.moves.map((m) =>
      `<button class="btn btn-outline-dark" data-act="move" data-edge="${m.edge}">&rarr; ${esc(city(m.to).name)}</button>`).join('')}</div>`;
  }
  if (acting && o.preach) {
    const calls = wouldBeCalled(sheet, ev, rules());
    actions += `<div class="dest-list"><button class="btn ${calls ? 'btn-danger' : 'btn-primary'}" data-act="preach" data-ev="${ev}">${calls ? `Preach &ndash; called as pastor in ${esc(c.name)}` : `Preach in ${esc(c.name)}`}</button></div>`;
  }
  return `<div class="ev-card${sel ? ' sel' : ''}${acting && !able ? ' idle' : ''}" style="--c:${EV_COLOR[ev]}">
      <div class="d-flex justify-content-between align-items-baseline gap-2">
        <h3>${EV_NAMES[ev]}</h3>
        ${acting && able && !sel && o.moves.length ? `<button class="btn btn-sm btn-outline-secondary" data-act="select" data-ev="${ev}">Select</button>` : ''}
        <span class="meta ms-auto">${esc(c.name)}</span>
      </div>
      <div class="region-chips">${chips}</div>
      <div class="meta">${status} &middot; preached ${preached}&times;</div>
      ${actions}</div>`;
}

function renderViewBar() {
  const bar = $('#view-bar');
  const bots = state.sheets.map((_, i) => i).filter((i) => G.isBotSeat(state, i));
  bar.hidden = bots.length === 0;
  if (!bots.length) return;
  const pill = (seat, label) => `<button type="button" class="btn btn-sm ${(ui.viewSeat ?? 0) === seat || (seat === 0 && ui.viewSeat == null) ? 'btn-dark' : 'btn-outline-dark'}" data-view="${seat}">${esc(label)}</button>`;
  bar.innerHTML = pill(0, 'My map') + bots.map((i) => pill(i, `${state.seatNames[i]}'s map`)).join('') +
    (viewing() ? `<span class="note">Watching ${esc(state.seatNames[ui.viewSeat])} &ndash; read-only</span>` : '');
  bar.onclick = (e) => {
    const b = e.target.closest('[data-view]');
    if (!b) return;
    ui.viewSeat = Number(b.dataset.view) === 0 ? null : Number(b.dataset.view);
    render();
  };
}

function standingsCard() {
  const s = state;
  const rows = s.sheets.map((sheet, i) => ({ i, name: s.seatNames[i], sc: score(sheet), called: EVANGELISTS.filter((e) => sheet.evangelists[e].called).length }))
    .sort((a, b) => b.sc.total - a.sc.total || a.i - b.i);
  return `<div class="card standings mb-3"><div class="card-body py-2">
    <div class="fw-semibold mb-1">Standings <span class="small text-muted fw-normal">if the game ended now</span></div>
    ${rows.map((r) => `<div class="row-s${r.i === 0 ? ' me' : ''}">
      <div><span class="name">${esc(r.name)}${r.i === 0 ? ' (you)' : ''}</span> <span class="small text-muted">&middot; ${r.called}/3 pastors</span>
        ${r.i > 0 ? `<div class="did">${(s.lastBot?.[r.i] ?? []).length ? esc(s.lastBot[r.i].join(' \u00B7 ')) : 'has not moved yet'}</div>
          <button type="button" class="btn btn-link" data-view="${r.i}">view map</button>` : ''}</div>
      <div class="pts">${r.sc.total}</div></div>`).join('')}
  </div></div>`;
}

function tableCard() {
  const s = state;
  const sheet = mySheet();
  const seats = s.seatNames.map((n, i) => `<span class="seat${i === s.mySeat ? ' me' : ''}${i === s.roller ? ' rolling' : ''}">${i + 1}. ${esc(n)}${i === s.mySeat ? ' (you)' : ''}${i === s.roller ? ' &#127922;' : ''}</span>`).join('');
  const stuck = !allCalled(sheet) && !canTravelAny(sheet);
  return `<div class="card table-card mb-3"><div class="card-body py-2">
    <div class="fw-semibold">The table</div>
    <div class="seats">${seats}</div>
    ${s.phase === 'roll' ? `<div class="small text-muted mb-1"><label for="roller-fix">Out of step? Whose roll is it:</label>
      <select id="roller-fix" class="form-select form-select-sm d-inline-block w-auto">${s.seatNames.map((n, i) => `<option value="${i}" ${i === s.roller ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>` : ''}
    ${stuck ? '<div class="alert alert-warning small my-2 py-2">None of your evangelists can travel any more. If nobody at the table can either, the game is over.</div>' : ''}
    <button type="button" class="btn btn-outline-danger mt-1" id="finish-btn">The game is over &ndash; show my score</button>
  </div></div>`;
}

function renderSide() {
  const s = state;
  const sc = score(mySheet());
  let controls = '';
  if (s.phase === 'act') {
    const can = G.canEndTurn(s);
    const forced = s.actions === 0 && G.nothingToDo(s);
    const next = s.queue.length && s.kind === 'pass' ? s.seatNames[s.queue[0]] : null;
    controls = `<div class="actionbar">
      <button class="btn btn-primary${G.nothingToDo(s) ? ' nudge' : ''}" id="end-btn" ${can ? '' : 'disabled'}>${forced ? 'No move possible &ndash; pass' : next ? `End turn &rarr; ${esc(next)}` : 'End turn'}</button>
      <button class="btn btn-outline-secondary" id="undo-btn" ${ui.history.length ? '' : 'disabled'}>Undo</button></div>
      <p class="small text-muted">${s.role === 'roller' ? `${s.actions}/3 actions used.` : `${s.actions}/1 action used.`}${can ? '' : ' Pick an evangelist, then a highlighted city on the map.'}</p>`;
  }
  const log = s.log.slice(-40).reverse().map((l) => `<li>${esc(l.text)}</li>`).join('');
  $('#side').innerHTML = `
    ${s.kind === 'pass' ? `<div class="mb-2 fw-semibold">${esc(s.seatNames[sheetSeat()])}'s map</div>` : ''}
    ${s.kind === 'table' ? tableCard() : ''}
    ${EVANGELISTS.map(evCard).join('')}
    ${controls}
    ${s.sheets.some((_, i) => G.isBotSeat(s, i)) ? standingsCard() : ''}
    <div class="card score-box mb-3"><div class="card-body py-2">
      <div class="d-flex justify-content-between"><b>Score if the game ended now</b><b>${sc.total}</b></div>
      <table class="table table-sm table-borderless"><tbody>
        <tr><td>Regions visited</td><td class="text-end">${sc.parts.regions}</td></tr>
        <tr><td>Preaching (${sc.preaches}&times;3)</td><td class="text-end">${sc.parts.preaching}</td></tr>
        <tr><td>Called as pastor (${sc.called}&times;5)</td><td class="text-end">${sc.parts.called}</td></tr>
        <tr><td>Cities not visited (${sc.unvisited}&times;&minus;2)</td><td class="text-end">${sc.parts.unvisited}</td></tr>
      </tbody></table></div></div>
    <details ${ui.showLog ? 'open' : ''} id="log-box"><summary class="small">Game log</summary><ul class="log mt-2">${log}</ul></details>
    <div class="mt-3"><button class="btn btn-sm btn-outline-danger" id="quit-btn">Quit game</button></div>`;

  $('#side').onclick = (ev) => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'select') selectEv(b.dataset.ev);
    else if (act === 'move') doMove(b.dataset.edge);
    else if (act === 'preach') doPreach(b.dataset.ev);
  };
  const end = $('#end-btn'); if (end) end.onclick = () => commit(G.endTurn(state));
  const undo = $('#undo-btn'); if (undo) undo.onclick = doUndo;
  $('#side').querySelectorAll('[data-view]').forEach((b) => { b.onclick = () => { ui.viewSeat = Number(b.dataset.view); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }; });
  const fix = $('#roller-fix'); if (fix) fix.onchange = () => commit(G.setRoller(state, Number(fix.value)));
  const fin = $('#finish-btn');
  if (fin) fin.onclick = () => {
    if (confirm('Is the game over? That is when someone has all three evangelists called as pastors, or nobody at the table can move.')) commit(G.finishNow(state));
  };
  $('#quit-btn').onclick = () => {
    if (!confirm('Quit this game? Your progress will be lost.')) return;
    state = null; keepAwake(false); save(); try { localStorage.removeItem(SAVE_KEY); } catch {}
    show('setup'); $('#resume').hidden = true;
  };
  $('#log-box').ontoggle = (e) => { ui.showLog = e.target.open; };
}

// ---- results ----------------------------------------------------------------
function renderResults() {
  keepAwake(false);
  save();
  show('results');
  const res = G.results(state);
  const best = res[0].total;
  const solo = res.length === 1;
  const withBots = state.kind === 'solo' && res.some((r) => r.bot);
  const rows = res.map((r) => `<tr class="${r.total === best && res.length > 1 ? 'res-winner' : ''}">
      <th scope="row">${esc(r.name)}${r.mine && withBots ? ' (you)' : ''}${r.bot ? ' <span class="badge text-bg-secondary">computer</span>' : ''}${r.total === best && res.length > 1 ? ' &#127942;' : ''}</th>
      ${EVANGELISTS.map((ev) => {
        const p = r.perEvangelist[ev];
        return `<td>${p.regions} region${p.regions === 1 ? '' : 's'} &middot; ${p.preaches} preach${p.preaches === 1 ? '' : 'es'}${p.called ? ' &middot; <b>pastor</b>' : ''}</td>`;
      }).join('')}
      <td class="text-end">${r.parts.regions}</td><td class="text-end">${r.parts.preaching}</td><td class="text-end">${r.parts.called}</td>
      <td class="text-end">${r.parts.unvisited} <small class="text-muted">(${r.unvisited})</small></td><td class="text-end fs-5"><b>${r.total}</b></td></tr>`).join('');
  const winners = res.filter((r) => r.total === best).map((r) => r.name);
  const me = res.find((r) => r.mine);
  const rank = me ? res.filter((r) => r.total > me.total).length + 1 : 0;
  const ordinal = (n) => ['', '1st', '2nd', '3rd', '4th'][n] ?? `${n}th`;
  const opponents = res.filter((r) => r.bot).length;
  const headline = withBots
    ? (me.total === best
      ? (winners.length > 1 ? `You tie for first with ${best} points` : `You win with ${best} points!`)
      : `${esc(winners.join(' & '))} ${winners.length > 1 ? 'tie' : 'wins'} with ${best} points &ndash; you finished ${ordinal(rank)} with ${me.total}`)
    : solo
      ? `${state.kind === 'table' ? 'Your journeys are complete' : 'All journeys complete'} &ndash; ${res[0].total} points`
      : `${esc(winners.join(' & '))} ${winners.length > 1 ? 'tie' : 'wins'} with ${best} points`;
  const text = withBots
    ? (me.total === best
      ? `I beat ${opponents} computer opponent${opponents === 1 ? '' : 's'} in Journeys for Paul with ${me.total} points! https://sdggames.fun/JfP/play/`
      : `I scored ${me.total} in Journeys for Paul against ${opponents} computer opponent${opponents === 1 ? '' : 's'}. Can you beat them? https://sdggames.fun/JfP/play/`)
    : state.kind === 'table'
    ? `I scored ${res[0].total} in Journeys for Paul at our table of ${state.seats}! https://sdggames.fun/JfP/play/`
    : solo
    ? `I scored ${res[0].total} in Journeys for Paul (${rules().name.toLowerCase()})! Can you beat it? https://sdggames.fun/JfP/play/`
    : `${winners.join(' & ')} won Journeys for Paul with ${best} points! https://sdggames.fun/JfP/play/`;
  const unvisited = (r) => MAP.cities.filter((c) => !r.sheet.visited.includes(c.id)).map((c) => c.name);
  $('#results').innerHTML = `
    <div class="card shadow-sm"><div class="card-body">
      <h1 class="h3" id="results-title">${headline}</h1>
      <p class="text-muted">${esc(rules().name)} &middot; ${state.round} round${state.round === 1 ? '' : 's'}${state.kind === 'table' ? ' &middot; compare scores with the rest of the table!' : ''}</p>
      <div class="table-responsive"><table class="table res-table align-middle">
        <thead><tr><th>Player</th>${EVANGELISTS.map((e) => `<th class="ev-${e}">${EV_NAMES[e]}</th>`).join('')}
          <th class="text-end">Regions</th><th class="text-end">Preached</th><th class="text-end">Called</th><th class="text-end">Unvisited</th><th class="text-end">Total</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      ${res.filter((r) => !r.bot).map((r) => { const u = unvisited(r); return u.length ? `<p class="small text-muted mb-1"><b>${esc(r.name)}</b> never reached: ${u.map(esc).join(', ')}.</p>` : `<p class="small text-muted mb-1"><b>${esc(r.name)}</b> visited every city!</p>`; }).join('')}
      <hr>
      <h2 class="h5">Replay the journey${res.length > 1 ? 's' : ''}</h2>
      <div id="replay"></div>
      <hr>
      <h2 class="h5">Share your result</h2>
      <div id="share"></div>
      <hr>
      <div class="d-flex flex-wrap gap-2 mt-3">
        <button class="btn btn-primary" id="again-btn">Play again</button>
        <button class="btn btn-outline-secondary" id="copy-btn">Copy result</button>
        <a class="btn btn-outline-secondary" href="../index.html">About the board game</a>
      </div>
      <p class="small text-muted mt-3 mb-0" id="copy-note" aria-live="polite"></p>
    </div></div>`;
  replayHandle?.stop();
  replayHandle = mountReplay($('#replay'), { players: res.map((r) => ({ name: r.name, sheet: r.sheet })), rules: rules(), start: Math.max(0, res.findIndex((r) => r.mine)) });
  mountShare($('#share'), res);
  $('#again-btn').onclick = () => {
    replayHandle?.stop();
    const s = state;
    startGame(G.newGame({ kind: s.kind, rulesId: s.rulesId, names: s.kind === 'table' ? s.seatNames : s.names, bots: s.seats - 1, me: s.mySeat, botLevel: s.botLevel }));
  };
  $('#copy-btn').onclick = async () => {
    try { await navigator.clipboard.writeText(text); $('#copy-note').textContent = 'Copied!'; }
    catch { $('#copy-note').textContent = text; }
  };
}

function mountShare(root, res) {
  const solo = res.length === 1;
  root.innerHTML = `
    <div class="d-flex flex-wrap gap-2 align-items-center mb-2">
      ${solo ? '' : `<select class="form-select w-auto" id="share-who" aria-label="Whose result">${res.map((r, i) => `<option value="${i}" ${i === Math.max(0, res.findIndex((x) => x.mine)) ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>`}
      <button class="btn btn-primary" id="share-dl" disabled>Download image</button>
      <button class="btn btn-outline-primary" id="share-native" hidden>Share&hellip;</button>
    </div>
    <img class="share-preview img-fluid rounded border" alt="Your Journeys for Paul result card" width="1200" height="900" hidden>
    <p class="small text-muted mt-2 mb-0" id="share-msg" aria-live="polite">Drawing your result card&hellip;</p>`;
  const img = root.querySelector('.share-preview');
  const msg = root.querySelector('#share-msg');
  const dl = root.querySelector('#share-dl');
  const nat = root.querySelector('#share-native');
  const canvas = document.createElement('canvas');
  let blob = null, url = null, who = Math.max(0, res.findIndex((r) => r.mine));

  async function build() {
    dl.disabled = true; nat.hidden = true;
    try {
      await drawShareImage(canvas, { name: res[who].name, sheet: res[who].sheet, rulesName: rules().name, rounds: state.round });
      blob = await canvasToBlob(canvas);
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(blob);
      img.src = url; img.hidden = false; dl.disabled = false;
      msg.textContent = '';
      const file = new File([blob], 'journeys-for-paul.png', { type: 'image/png' });
      nat.hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    } catch (e) {
      msg.textContent = 'Sorry, the result card could not be drawn in this browser.';
    }
  }
  dl.onclick = () => {
    const a = document.createElement('a');
    a.href = url; a.download = `journeys-for-paul-${res[who].name.replace(/[^\w-]+/g, '-').toLowerCase()}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  };
  nat.onclick = async () => {
    try {
      const file = new File([blob], 'journeys-for-paul.png', { type: 'image/png' });
      await navigator.share(nativeShareData(file, res[who].total));
    } catch { /* cancelled */ }
  };
  const sel = root.querySelector('#share-who');
  if (sel) sel.onchange = () => { who = Number(sel.value); build(); };
  build();
}

// ---- boot ---------------------------------------------------------------------
$('#handoff-ok').onclick = () => { ui.handoff = null; renderHandoff(); };
initSetup();
initJoin();
