// Journeys for Paul - online play UI (solo + pass-and-play).
import MAP from './map-data.js';
import {
  MODES, MODE_NAMES, EVANGELISTS, EV_NAMES, city, edge, score, wouldBeCalled, maxActions,
} from './engine.js';
import * as G from './game.js';

const SAVE_KEY = 'jfp-play-v1';
const EV_COLOR = { luke: '#1f9d45', silas: '#ef7a1a', titus: '#2f66e0' };
const EV_LETTER = { luke: 'L', silas: 'S', titus: 'T' };
const REGION_COLOR = { mac: '#38b44a', asia: '#9b2fd6', gal: '#f2671e', isl: '#2446e8' };
const TRAIL_WIDTH = [20, 12, 5]; // concentric so routes used by several evangelists stay readable
const MODE_SHORT = { road: 'road', foot: 'footpath', boat: 'boat' };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = (sel) => document.querySelector(sel);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let state = null;
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
  }
  kindEls().forEach((el) => el.addEventListener('change', syncKind));
  count.addEventListener('change', drawNames);
  drawNames();
  syncKind();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const kind = form.querySelector('[name=kind]:checked').value;
    const rulesId = form.querySelector('[name=rules]:checked').value;
    const typed = [...names.querySelectorAll('input')].map((i, n) => i.value.trim() || `Player ${n + 1}`);
    startGame(G.newGame({
      kind, rulesId,
      names: kind === 'solo' ? [$('#solo-name').value.trim() || 'You'] : typed,
      bots: Number($('#bots').value),
    }));
  });

  const saved = loadSaved();
  if (saved) {
    $('#resume').hidden = false;
    $('#resume-btn').onclick = () => startGame(saved);
    $('#discard-btn').onclick = () => { try { localStorage.removeItem(SAVE_KEY); } catch {} $('#resume').hidden = true; };
  }
}

function show(which) {
  for (const id of ['setup', 'game', 'results']) $('#' + id).hidden = id !== which;
  window.scrollTo({ top: 0 });
}

function startGame(s) {
  state = s;
  ui = { selected: null, history: [], handoff: null, rolling: false, showLog: false };
  show('game');
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
  const faces = ['road', 'foot', 'boat', 'choice'];
  let i = 0;
  const die = $('#die');
  const t = setInterval(() => { if (die) die.innerHTML = dieFace(faces[++i % 4]); }, 90);
  setTimeout(() => { clearInterval(t); go(); }, 750);
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
const sheetSeat = () => (state.kind === 'solo' ? 0 : activeSeat(state));
const mySheet = () => state.sheets[sheetSeat()];

function render() {
  if (state.phase === 'over') return renderResults();
  renderHud();
  renderBoard();
  renderSide();
  renderHandoff();
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
  if (state.role === 'roller') return 'You rolled: move or preach with one to three evangelists.';
  return rules().nonRollerMayPreach
    ? 'Another player rolled: use one evangelist to move, or to preach if he cannot move.'
    : 'Another player rolled: move one evangelist (only the roller may preach).';
}
const rules = () => G.rules(state);

function renderHud() {
  const s = state;
  const who = s.seatNames[s.roller];
  const humanRoller = G.isHumanSeat(s, s.roller);
  const head = `<div class="grow"><div class="who">`;
  let body = '';
  if (s.phase === 'roll') {
    body = `${head}Round ${s.round} &middot; ${humanRoller ? `${esc(who)}, roll the die` : `${esc(who)} is about to roll`}</div>
      <div class="sub">${esc(rules().name)}${s.kind === 'solo' ? ' &middot; simulated opponents roll, you act' : ''}</div></div>
      <div id="die" class="die ${ui.rolling ? 'rolling' : ''}">${ui.rolling ? '<span class="q">?</span>' : '<span class="q">&#127922;</span><span>8-sided die</span>'}</div>
      <button class="btn btn-warning btn-lg nudge" id="roll-btn" ${ui.rolling ? 'disabled' : ''}>${humanRoller ? 'Roll' : `Roll for ${esc(who)}`}</button>`;
  } else if (s.phase === 'choose') {
    body = `${head}Player's Choice! ${esc(who)}, pick how everyone travels</div><div class="sub">All players will use the mode you choose.</div></div>
      <div class="btn-group-modes">${MODES.map((m) => `<button class="btn btn-light" data-mode="${m}">${swatch(m)} ${MODE_NAMES[m]}</button>`).join('')}</div>`;
  } else {
    const actor = s.seatNames[s.actor];
    body = `${head}${esc(actor)} &middot; Round ${s.round}</div><div class="sub">${roleText()}</div></div>
      <div class="die ${s.face === 'choice' ? 'choice' : ''}" title="${s.face === 'choice' ? 'Chosen with Player\'s Choice' : 'Rolled'}">${dieFace(s.mode)}</div>`;
  }
  $('#hud').innerHTML = body;
  const rb = $('#roll-btn'); if (rb) rb.onclick = doRoll;
  $('#hud').querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => commit(G.chooseMode(state, b.dataset.mode)); });
}

function renderBoard() {
  const s = state;
  const sheet = mySheet();
  const acting = s.phase === 'act';
  const sel = acting ? ui.selected : null;
  const moves = sel ? G.evOptions(s, sel).moves : [];
  const parts = [];

  parts.push(`<image href="assets/basemap.webp" x="0" y="0" width="${MAP.width}" height="${MAP.height}"/>`);
  for (const c of MAP.captions) {
    parts.push(`<text class="caption" x="${c.x}" y="${c.y}" fill="${c.color}">${esc(c.text)}</text>`);
  }
  // every route, faintly; the rolled mode stands out
  for (const e of MAP.edges) {
    const dim = acting && e.mode !== s.mode ? ' dim' : '';
    if (e.mode === 'boat') {
      parts.push(`<path class="route boat-under${dim}" d="${e.d}"/><path class="route boat-over${dim}" d="${e.d}"/>`);
    } else {
      parts.push(`<path class="route ${e.mode}${dim}" d="${e.d}"/>`);
    }
  }
  // trails: where each evangelist has been
  const byEdge = {};
  EVANGELISTS.forEach((ev, i) => sheet.used[ev].forEach((id) => (byEdge[id] ??= []).push(i)));
  for (const [id, evs] of Object.entries(byEdge)) {
    const d = edge(id).d;
    [...evs].sort((a, b) => a - b).forEach((i, n) => {
      parts.push(`<path class="trail" d="${d}" stroke="${EV_COLOR[EVANGELISTS[i]]}" stroke-width="${TRAIL_WIDTH[n]}" stroke-opacity=".9"/>`);
    });
  }
  // candidate routes for the selected evangelist
  for (const m of moves) {
    parts.push(`<path class="cand" d="${edge(m.edge).d}" stroke="${EV_COLOR[sel]}"/>`);
  }
  // cities
  for (const c of MAP.cities) {
    const seen = sheet.visited.includes(c.id);
    parts.push(`<circle class="dot${seen ? '' : ' unseen'}" cx="${c.x}" cy="${c.y}" r="${c.big ? 17 : 10}" fill="${REGION_COLOR[c.region]}"/>`);
  }
  // preaching rings (called = doubled)
  EVANGELISTS.forEach((ev, i) => {
    const e = sheet.evangelists[ev];
    for (const [cid, n] of Object.entries(e.preachedAt)) {
      const c = city(cid);
      const r = (c.big ? 17 : 10) + 8 + i * 6;
      parts.push(`<circle class="ring" cx="${c.x}" cy="${c.y}" r="${r}" stroke="${EV_COLOR[ev]}" ${n > 1 ? 'stroke-width="8"' : ''}/>`);
      if (e.called && e.city === cid) parts.push(`<circle class="ring" cx="${c.x}" cy="${c.y}" r="${r + 7}" stroke="${EV_COLOR[ev]}"/>`);
    }
  });
  for (const c of MAP.cities) {
    const l = c.label;
    parts.push(`<text class="city-label" x="${l.x}" y="${l.y}" transform="rotate(${l.rot} ${l.x} ${l.y})">${esc(c.name)}</text>`);
  }
  // evangelist tokens: parked on the side of the dot away from its label
  EVANGELISTS.forEach((ev, i) => {
    const e = sheet.evangelists[ev];
    const c = city(e.city);
    const [x, y] = tokenSpot(c, i);
    const done = acting && (state.acted.includes(ev) || e.called);
    parts.push(`<g class="token${sel === ev ? ' sel' : ''}${done || e.called ? ' done' : ''}" data-ev="${ev}" transform="translate(${x} ${y})" tabindex="0" role="button" aria-label="${EV_NAMES[ev]} in ${esc(c.name)}">
      <circle r="19" fill="${EV_COLOR[ev]}"/><text>${EV_LETTER[ev]}</text></g>`);
  });
  // clickable destinations
  for (const m of moves) {
    const c = city(m.to);
    parts.push(`<path class="hitpath" d="${edge(m.edge).d}" data-move="${m.edge}"/>`);
    parts.push(`<g class="dest" data-move="${m.edge}" tabindex="0" role="button" aria-label="Move ${EV_NAMES[sel]} to ${esc(c.name)}">
      <circle class="hit" cx="${c.x}" cy="${c.y}" r="38"/><circle class="pulse" cx="${c.x}" cy="${c.y}" r="${c.big ? 30 : 24}" stroke="${EV_COLOR[sel]}"/></g>`);
  }

  const keep = $('#board').scrollLeft;
  $('#board').innerHTML = `<svg viewBox="0 0 ${MAP.width} ${MAP.height}" role="img" aria-label="Map of Greece and Asia Minor with the cities Paul visited">${parts.join('')}</svg>`;
  const board = $('#board');
  board.scrollLeft = keep;
  if (sel && board.scrollWidth > board.clientWidth && ui.focusEv !== sel) {
    const [tx] = tokenSpot(city(sheet.evangelists[sel].city), EVANGELISTS.indexOf(sel));
    board.scrollLeft = Math.max(0, (tx / MAP.width) * board.scrollWidth - board.clientWidth / 2);
  }
  ui.focusEv = sel;
  board.onclick = (ev) => {
    const mv = ev.target.closest('[data-move]');
    if (mv) return doMove(mv.dataset.move);
    const tok = ev.target.closest('[data-ev]');
    if (tok) selectEv(tok.dataset.ev);
  };
  board.onkeydown = (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const t = ev.target.closest('[data-move],[data-ev]');
    if (!t) return;
    ev.preventDefault();
    t.dataset.move ? doMove(t.dataset.move) : selectEv(t.dataset.ev);
  };

  $('#legend').innerHTML = `
    ${Object.entries(MAP.regions).map(([k, n]) => `<span class="key"><span class="chip" style="background:${REGION_COLOR[k]}"></span>${esc(n)}</span>`).join('')}
    <span class="key"><span class="chip hollow" style="background:#ccc"></span>not yet visited (&minus;2 at the end)</span>
    <span class="key">ring = preached &middot; double ring = called as pastor</span>`;
}

function tokenSpot(c, i) {
  const l = c.label;
  const w = c.name.length * 16;                     // rough label width at 31px Arial
  const rad = (l.rot * Math.PI) / 180;
  const lx = l.x + Math.cos(rad) * (w / 2) - Math.sin(rad) * -10;
  const ly = l.y + Math.sin(rad) * (w / 2) + Math.cos(rad) * -10;
  let dx = c.x - lx, dy = c.y - ly;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;
  const d = (c.big ? 44 : 38) + 4;
  return [c.x + dx * d - dy * (i - 1) * 36, c.y + dy * d + dx * (i - 1) * 36];
}

function selectEv(ev) {
  if (state.phase !== 'act' || !hasOptions(ev)) return;
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
    ${EVANGELISTS.map(evCard).join('')}
    ${controls}
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
  $('#quit-btn').onclick = () => {
    if (!confirm('Quit this game? Your progress will be lost.')) return;
    state = null; save(); try { localStorage.removeItem(SAVE_KEY); } catch {}
    show('setup'); $('#resume').hidden = true;
  };
  $('#log-box').ontoggle = (e) => { ui.showLog = e.target.open; };
}

// ---- results ----------------------------------------------------------------
function renderResults() {
  save();
  show('results');
  const res = G.results(state);
  const best = res[0].total;
  const solo = state.kind === 'solo';
  const rows = res.map((r) => `<tr class="${r.total === best && res.length > 1 ? 'res-winner' : ''}">
      <th scope="row">${esc(r.name)}${r.total === best && res.length > 1 ? ' &#127942;' : ''}</th>
      ${EVANGELISTS.map((ev) => {
        const p = r.perEvangelist[ev];
        return `<td>${p.regions} region${p.regions === 1 ? '' : 's'} &middot; ${p.preaches} preach${p.preaches === 1 ? '' : 'es'}${p.called ? ' &middot; <b>pastor</b>' : ''}</td>`;
      }).join('')}
      <td class="text-end">${r.parts.regions}</td><td class="text-end">${r.parts.preaching}</td><td class="text-end">${r.parts.called}</td>
      <td class="text-end">${r.parts.unvisited} <small class="text-muted">(${r.unvisited})</small></td><td class="text-end fs-5"><b>${r.total}</b></td></tr>`).join('');
  const winners = res.filter((r) => r.total === best).map((r) => r.name);
  const text = solo
    ? `I scored ${res[0].total} in Journeys for Paul (${rules().name.toLowerCase()})! Can you beat it? https://sdggames.fun/JfP/play/`
    : `${winners.join(' & ')} won Journeys for Paul with ${best} points! https://sdggames.fun/JfP/play/`;
  const unvisited = (r) => MAP.cities.filter((c) => !r.sheet.visited.includes(c.id)).map((c) => c.name);
  $('#results').innerHTML = `
    <div class="card shadow-sm"><div class="card-body">
      <h1 class="h3" id="results-title">${solo ? `All journeys complete &ndash; ${res[0].total} points` : `${esc(winners.join(' & '))} ${winners.length > 1 ? 'tie' : 'wins'} with ${best} points`}</h1>
      <p class="text-muted">${esc(rules().name)} &middot; ${state.round} round${state.round === 1 ? '' : 's'}</p>
      <div class="table-responsive"><table class="table res-table align-middle">
        <thead><tr><th>Player</th>${EVANGELISTS.map((e) => `<th class="ev-${e}">${EV_NAMES[e]}</th>`).join('')}
          <th class="text-end">Regions</th><th class="text-end">Preached</th><th class="text-end">Called</th><th class="text-end">Unvisited</th><th class="text-end">Total</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      ${res.map((r) => { const u = unvisited(r); return u.length ? `<p class="small text-muted mb-1"><b>${esc(r.name)}</b> never reached: ${u.map(esc).join(', ')}.</p>` : `<p class="small text-muted mb-1"><b>${esc(r.name)}</b> visited every city!</p>`; }).join('')}
      <div class="d-flex flex-wrap gap-2 mt-3">
        <button class="btn btn-primary" id="again-btn">Play again</button>
        <button class="btn btn-outline-secondary" id="copy-btn">Copy result</button>
        <a class="btn btn-outline-secondary" href="../index.html">About the board game</a>
      </div>
      <p class="small text-muted mt-3 mb-0" id="copy-note" aria-live="polite"></p>
    </div></div>`;
  $('#again-btn').onclick = () => {
    const s = state;
    startGame(G.newGame({ kind: s.kind, rulesId: s.rulesId, names: s.names, bots: s.seats - 1 }));
  };
  $('#copy-btn').onclick = async () => {
    try { await navigator.clipboard.writeText(text); $('#copy-note').textContent = 'Copied!'; }
    catch { $('#copy-note').textContent = text; }
  };
}

// ---- boot ---------------------------------------------------------------------
$('#handoff-ok').onclick = () => { ui.handoff = null; renderHandoff(); };
initSetup();
