// Journeys with Jesus: play online against the computer (UI). The rules live in engine.js, the computer in ai.js.
import { PLACES, REGIONS } from './board-data.js';
import * as E from './engine.js';
import * as AI from './ai.js';
import { drawBoard } from './board.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const KEY = 'jwj-play-v1';
const IMG = '../../assets/jwj/cards/';
const FAST = new URLSearchParams(location.search).has('fast');
const BOT_NAMES = ['Peter', 'Mary', 'Andrew'];

let state = null;
const ui = { preview: null, reciting: false, timer: null, last: null };

// ---- saving --------------------------------------------------------------------------------------------------------
const save = () => { try { state && !state.over ? localStorage.setItem(KEY, JSON.stringify(state)) : localStorage.removeItem(KEY); } catch { /* storage unavailable */ } };
function loadSaved() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); return s && s.v === 1 && Array.isArray(s.players) && !s.over ? s : null; } catch { return null; }
}

// ---- moving through the game ---------------------------------------------------------------------------------------
function commit(next) {
  const was = state;
  state = next;
  ui.preview = null; ui.reciting = false;
  save();
  render();
  if (state.over && !(was && was.over)) { setTimeout(showFinal, FAST ? 0 : 500); return; }
  schedule();
}

function schedule() {
  clearTimeout(ui.timer);
  if (!state || state.over || !E.me(state).bot) return;
  ui.timer = setTimeout(() => commit(AI.step(state)), FAST ? 0 : state.phase === 'play' ? 900 : 650);
}

function startGame(opts = ui.last) {
  clearTimeout(ui.timer);
  ui.last = opts;
  const skills = ['casual', 'steady', 'sharp'];
  const players = [{ name: 'You', bot: false }];
  for (let i = 0; i < opts.bots; i++) players.push({ name: BOT_NAMES[i], bot: true, skill: opts.skill === 'mixed' ? skills[(i + 1) % 3] : opts.skill });
  $('#setup').hidden = true; $('#game').hidden = false;
  commit(E.newGame({ seed: crypto.getRandomValues(new Uint32Array(1))[0], players, expansion: opts.expansion }));
  window.scrollTo({ top: 0 });
}

function showSetup() {
  clearTimeout(ui.timer);
  $('#game').hidden = true; $('#setup').hidden = false;
  const saved = loadSaved();
  $('#resume').hidden = !saved;
  if (saved) $('#resume-text').textContent = `Game in progress (round ${saved.round}, ${saved.players.length - 1} computer player${saved.players.length > 2 ? 's' : ''}).`;
}

// ---- pieces ------------------------------------------------------------------------------------------------------
const defs = () => E.deckDefs(state.expansion);
const cardImg = (d, w = 480) => `${IMG}${d.img}-${w}.webp`;
const placeNames = (path) => path.map((id) => PLACES[id].name).join(' → ');
const jTitle = (j) => `${PLACES[j.a].name} to ${PLACES[j.b].name}`;
const regionColor = (d) => (d.kind === 'place' ? REGIONS[PLACES[d.place].region].color : d.region === 'israel' ? '#555' : REGIONS[d.region].color);
const iAmPlaying = () => state && !state.over && !E.me(state).bot;

function describe(o) {
  const bits = [];
  const kinds = o.assign.reduce((m, a) => ((m[a.kind] = (m[a.kind] || 0) + 1), m), {});
  if (kinds.region) bits.push(`${kinds.region} Region Wild`);
  if (kinds.israel) bits.push('Israel Wild');
  if (kinds.token) bits.push(`${kinds.token} Scripture token${kinds.token > 1 ? 's' : ''}`);
  return bits.length ? 'uses ' + bits.join(', ') : '';
}

// ---- drawing the page --------------------------------------------------------------------------------------------
function render() {
  if (!state) return;
  renderBar(); renderStatus(); renderInplay(); renderPlays(); renderPiles(); renderHand(); renderActions(); renderPlayers(); renderLog();
  const ends = [];
  for (const jid of state.inplay) { const j = E.journeyById[jid]; ends.push(j.a, j.b); }
  drawBoard($('#board'), { ends, path: ui.preview ? ui.preview.path : [] });
}

function renderBar() {
  $('#bar').innerHTML = state.players.map((p, i) => {
    const sc = E.score(p);
    return `<div class="jp-score${i === state.turn && !state.over ? ' is-turn' : ''}"><span class="n">${esc(p.name)}</span><span class="pts">${sc.total}</span><span class="sub">${p.tokens ? `${p.tokens} token${p.tokens > 1 ? 's' : ''}` : '&nbsp;'}</span></div>`;
  }).join('') + `<div class="jp-round">Round ${state.round}<br /><small>${state.inplay.length + state.jdeck.length} journey${state.inplay.length + state.jdeck.length === 1 ? '' : 's'} left</small></div>`;
}

function renderStatus() {
  const p = E.me(state);
  let t;
  if (state.over) t = 'The game is over.';
  else if (p.bot) t = `${p.name}'s turn…`;
  else if (state.phase === 'recite') t = 'Your turn. You may recite a Scripture from memory for a token, or skip.';
  else if (state.phase === 'draw') t = `Draw ${E.DRAWS - state.drawn} more card${E.DRAWS - state.drawn === 1 ? '' : 's'} from any of the piles.`;
  else if (state.phase === 'play') t = E.plays(state).length ? 'Lay down a journey you can complete, or finish your turn.' : 'No journey to complete right now. Finish your turn when you are ready.';
  else t = `Draw ${state.topup - state.drawn} more card${state.topup - state.drawn === 1 ? '' : 's'} to get back to ${E.HAND}.`;
  $('#status').textContent = t;
}

function renderInplay() {
  const mine = iAmPlaying() && state.phase === 'play';
  const ready = new Set(mine ? E.plays(state).map((o) => o.journey) : []);
  $('#inplay').innerHTML = state.inplay.map((jid) => {
    const j = E.journeyById[jid];
    return `<button type="button" class="jp-journey${ready.has(jid) ? ' is-ready' : ''}" data-zoom-j="${jid}" aria-label="${esc(jTitle(j))}, ${j.points} points${ready.has(jid) ? ', you can complete this' : ''}">
      <img src="${IMG}${jid}-480.webp" width="480" height="670" alt="Journey Card: ${esc(jTitle(j))}" />${ready.has(jid) ? '<span class="tag">You can complete this</span>' : ''}</button>`;
  }).join('') || '<p class="text-muted mb-0">No journeys left.</p>';
}

function renderPlays() {
  const box = $('#plays');
  if (!iAmPlaying() || state.phase !== 'play') { box.innerHTML = ''; return; }
  // the best way to lay each journey, plus other routes that cost the same
  const all = E.plays(state), best = [];
  const cost = (o) => `${o.tokensUsed}/${o.wildsUsed}/${o.path.length}`;
  for (const o of all) {
    const top = all.find((x) => x.journey === o.journey && x.extends === o.extends);
    if (cost(o) === cost(top) && best.filter((b) => b.journey === o.journey && b.extends === o.extends).length < 3) best.push(o);
  }
  if (!best.length) { box.innerHTML = ''; return; }
  const selected = ui.preview;
  box.innerHTML = '<h3>You can lay down</h3>' + best.map((o, i) => {
    const j = E.journeyById[o.journey], d = describe(o), on = selected && selected.journey === o.journey && selected.path.join() === o.path.join() && selected.extends === o.extends;
    return `<div class="jp-play${on ? ' is-on' : ''}"><button type="button" class="jp-play-pick" data-play="${i}" aria-pressed="${on}">
      <b>${o.extends ? 'Extend to ' : ''}${esc(jTitle(j))}</b> <span class="pts">${o.points} points</span><br /><small>${esc(placeNames(o.path))}${d ? ` &middot; ${esc(d)}` : ''}${o.extends ? (o.assign.length ? ' &middot; reuses your cards already laid' : ' &middot; needs only the cards you already laid') : ''}</small></button>
      ${on ? '<button type="button" class="btn btn-success btn-sm" data-lay="1">Lay it down</button>' : ''}</div>`;
  }).join('');
  box._best = best;
}

function renderPiles() {
  const drawing = iAmPlaying() && (state.phase === 'draw' || state.phase === 'topup');
  $('#piles-hint').textContent = drawing ? '(tap a card to take it)' : '';
  const up = state.up.map((uid, i) => (uid === null ? `<div class="jp-pile is-empty" aria-hidden="true"></div>`
    : `<button type="button" class="jp-pile" data-take="${i}" ${drawing ? '' : 'disabled'} aria-label="Take ${esc(E.cardLabel(defs()[uid]))}"><img src="${cardImg(defs()[uid])}" width="480" height="670" alt="${esc(E.cardLabel(defs()[uid]))}" /></button>`)).join('');
  const down = state.draw.length + state.discard.length;
  $('#piles').innerHTML = up + `<button type="button" class="jp-pile jp-down" data-take="down" ${drawing && down ? '' : 'disabled'} aria-label="Take the top face-down card (${down} left)"><img src="${IMG}back-place-480.webp" width="480" height="670" alt="" /><span class="count">${down}</span></button>`;
}

function renderHand() {
  const p = state.players[0], used = new Set(ui.preview ? ui.preview.assign.map((a) => a.uid) : []);
  const d = defs();
  const hand = [...p.hand].sort((a, b) => {
    const A = d[a], B = d[b], ra = A.kind === 'place' ? PLACES[A.place].region : 'z' + (A.region || ''), rb = B.kind === 'place' ? PLACES[B.place].region : 'z' + (B.region || '');
    return ra < rb ? -1 : ra > rb ? 1 : E.cardLabel(A) < E.cardLabel(B) ? -1 : 1;
  });
  const recite = ui.reciting && iAmPlaying() && state.phase === 'recite';
  $('#hand-hint').textContent = recite ? '(tap the card you will recite)' : `(${p.hand.length} cards${p.tokens ? `, ${p.tokens} token${p.tokens > 1 ? 's' : ''}` : ''})`;
  $('#hand').innerHTML = hand.map((uid) => {
    const c = d[uid];
    return `<button type="button" class="jp-hc${used.has(uid) ? ' is-used' : ''}${recite ? ' is-pick' : ''}" data-hand="${uid}" style="--rc:${regionColor(c)}" aria-label="${esc(E.cardLabel(c))}">
      <img src="${cardImg(c)}" width="480" height="670" alt="${esc(E.cardLabel(c))}" loading="lazy" /></button>`;
  }).join('') + (p.tokens ? Array.from({ length: p.tokens }, () => '<span class="jp-token" title="Scripture Memory Token: 5 points, or a wild card">Token</span>').join('') : '');
}

function renderActions() {
  const box = $('#actions');
  if (!iAmPlaying()) { box.innerHTML = ''; return; }
  if (state.phase === 'recite') {
    box.innerHTML = ui.reciting
      ? '<button type="button" class="btn btn-outline-secondary btn-sm" data-act="cancel-recite">Never mind</button>'
      : '<button type="button" class="btn btn-primary btn-sm" data-act="recite">Recite a Scripture (earn a token)</button> <button type="button" class="btn btn-outline-secondary btn-sm" data-act="skip">Skip</button>';
  } else if (state.phase === 'play') {
    box.innerHTML = '<button type="button" class="btn btn-primary btn-sm" data-act="end">Finish my turn</button>';
  } else box.innerHTML = '';
}

function renderPlayers() {
  $('#players').innerHTML = state.players.map((p, i) => {
    const sc = E.score(p);
    const journeys = p.journeys.map((id) => `<li>${esc(jTitle(E.journeyById[id]))} <b>${E.journeyById[id].points}</b></li>`).join('');
    const skill = p.bot ? ` <span class="badge text-bg-light">${AI.SKILLS[p.skill].name}</span>` : '';
    return `<div class="jp-player${i === state.turn && !state.over ? ' is-turn' : ''}"><div class="head"><b>${esc(p.name)}</b>${skill} <span class="ms-auto">${sc.total} points</span></div>
      <div class="small text-muted">${p.hand.length} Place Cards${p.tokens ? ` &middot; ${p.tokens} token${p.tokens > 1 ? 's' : ''} (${sc.tokens} points)` : ''}${sc.journeys ? ` &middot; journeys ${sc.journeys}` : ''}</div>
      ${journeys ? `<ul class="small mb-0 jp-won">${journeys}</ul>` : ''}</div>`;
  }).join('');
}

function renderLog() {
  $('#log').innerHTML = state.log.slice(-14).reverse().map((l) => `<li><b>${esc(state.players[l.who].name)}</b> ${esc(l.text)}</li>`).join('') || '<li class="text-muted">Nothing yet.</li>';
}

// ---- dialogs -----------------------------------------------------------------------------------------------------
function zoom(src, title) {
  $('#card-title').textContent = title;
  $('#card-body').innerHTML = `<img class="jp-zoom" src="${src}" alt="${esc(title)}" />`;
  $('#card-actions').innerHTML = '<button value="close" class="btn btn-outline-secondary">Close</button>';
  $('#card-dialog').showModal();
}

function reciteDialog(uid) {
  const c = defs()[uid];
  $('#card-title').textContent = `Recite the verse on ${E.cardLabel(c)}`;
  $('#card-body').innerHTML = '<p>Say the Scripture on this card from memory, out loud or in your head. When you are ready, check it against the card.</p>';
  $('#card-actions').innerHTML = '<button type="button" class="btn btn-primary" id="rc-show">Show the card</button><button value="close" class="btn btn-outline-secondary">Cancel</button>';
  $('#rc-show').onclick = () => {
    $('#card-body').innerHTML = `<img class="jp-zoom" src="${cardImg(c, 755)}" alt="${esc(E.cardLabel(c))}" /><p class="mt-2 mb-0">Did you get it right?</p>`;
    $('#card-actions').innerHTML = '<button type="button" class="btn btn-success" id="rc-yes">I got it</button><button type="button" class="btn btn-outline-secondary" id="rc-no">I missed it</button>';
    $('#rc-yes').onclick = () => { $('#card-dialog').close(); commit(E.recite(state, true, uid)); };
    $('#rc-no').onclick = () => { $('#card-dialog').close(); commit(E.recite(state, false, uid)); };
  };
  $('#card-dialog').showModal();
}

function showFinal() {
  const st = E.standings(state), win = E.winners(state);
  const youWon = win.includes(0);
  $('#final-title').textContent = win.length > 1 ? `A tie: ${win.map((i) => state.players[i].name).join(' and ')}` : youWon ? 'You win!' : `${state.players[win[0]].name} wins`;
  $('#final-body').innerHTML = `<p class="small text-muted">${state.endedBy === 'journeys' ? 'The last journey was completed.' : state.endedBy === 'stalled' ? 'Nobody could play any more cards.' : 'The game reached its round limit.'}</p>
    <table class="table table-sm"><thead><tr><th>Player</th><th class="text-end">Journeys</th><th class="text-end">Tokens</th><th class="text-end">Total</th></tr></thead><tbody>${
  st.map((r) => `<tr${win.includes(r.i) ? ' class="table-success"' : ''}><td>${esc(r.name)}</td><td class="text-end">${r.journeys}</td><td class="text-end">${r.tokens}</td><td class="text-end"><b>${r.total}</b></td></tr>`).join('')}</tbody></table>`;
  $('#final').showModal();
}

// ---- events ------------------------------------------------------------------------------------------------------
document.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t || !state) return;
  if (t.dataset.zoomJ) { const j = E.journeyById[t.dataset.zoomJ]; zoom(`${IMG}${j.id}-755.webp`, `${jTitle(j)}: ${j.points} points`); return; }
  if (!iAmPlaying()) return;
  if (t.dataset.take !== undefined) {
    const from = t.dataset.take === 'down' ? 'down' : Number(t.dataset.take);
    if ((state.phase === 'draw' || state.phase === 'topup') && E.canTake(state, from)) commit(E.take(state, from));
  } else if (t.dataset.hand !== undefined) {
    const uid = Number(t.dataset.hand), c = defs()[uid];
    if (ui.reciting && state.phase === 'recite') reciteDialog(uid); else zoom(cardImg(c, 755), E.cardLabel(c));
  } else if (t.dataset.act === 'recite') { ui.reciting = true; render(); }
  else if (t.dataset.act === 'cancel-recite') { ui.reciting = false; render(); }
  else if (t.dataset.act === 'skip') commit(E.skipRecite(state));
  else if (t.dataset.act === 'end') commit(E.endPlay(state));
  else if (t.dataset.play !== undefined) {
    const o = $('#plays')._best[Number(t.dataset.play)];
    ui.preview = ui.preview && ui.preview.journey === o.journey && ui.preview.path.join() === o.path.join() && ui.preview.extends === o.extends ? null : o;
    render();
  } else if (t.dataset.lay && ui.preview) commit(E.play(state, ui.preview));
});

$('#start-btn').addEventListener('click', () => startGame({ bots: Number($('#bot-count').value), skill: $('#bot-skill').value, expansion: $('#expansion').checked }));
$('#resume-btn').addEventListener('click', () => { state = loadSaved(); $('#setup').hidden = true; $('#game').hidden = false; render(); schedule(); });
$('#discard-btn').addEventListener('click', () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } showSetup(); });
$('#new-btn').addEventListener('click', () => { if (!state || state.over || confirm('Leave this game? Your game in progress is saved and you can resume it.')) showSetup(); });
$('#final-again').addEventListener('click', (e) => { e.preventDefault(); $('#final').close(); startGame(); });
$('#final').addEventListener('close', () => { /* leave the finished board visible */ });

ui.last = { bots: 2, skill: 'steady', expansion: false };
showSetup();
