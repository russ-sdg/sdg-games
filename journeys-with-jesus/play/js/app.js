// Journeys with Jesus: play online against the computer (UI). The rules live in engine.js, the computer in ai.js and the
// laying of a journey, card by card, in build.js.
import { PLACES } from './board-data.js';
import * as E from './engine.js';
import * as AI from './ai.js';
import * as B from './build.js';
import { drawBoard } from './board.js';
import { drawShareImage, canvasToBlob, nativeShareData, shareMessage, PLAYER_COLORS } from './share.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const KEY = 'jwj-play-v1';
const IMG = '../../assets/jwj/cards/';
const FAST = new URLSearchParams(location.search).has('fast');
const BOT_NAMES = ['Peter', 'Mary', 'Andrew'];

let state = null;
const ui = { build: null, msg: '', fx: null, reciting: false, timer: null, last: null, toastTimer: null, newUp: new Set(), newJ: new Set() };

// ---- saving --------------------------------------------------------------------------------------------------------
const save = () => { try { state && !state.over ? localStorage.setItem(KEY, JSON.stringify(state)) : localStorage.removeItem(KEY); } catch { /* storage unavailable */ } };
function loadSaved() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (!s || s.v !== 1 || !Array.isArray(s.players) || s.over) return null;
    s.chains = s.chains || []; s.turnRoutes = s.turnRoutes || []; s.recent = s.recent || [];
    s.players.forEach((p) => { p.routes = p.routes || []; });
    return s;
  } catch { return null; }
}

// ---- moving through the game ---------------------------------------------------------------------------------------
function commit(next) {
  const was = state;
  // a journey was just completed (by you or a computer): flash it
  const gained = was && next.turnRoutes && (was.turnRoutes || []).length < next.turnRoutes.length ? next.turnRoutes[next.turnRoutes.length - 1] : null;
  // cards that have just been turned up (in the face-up piles or the journeys in play) are highlighted until you start your next turn
  if (!was || (was.turn === 0 && was.phase === 'recite' && next.phase !== 'recite')) { ui.newUp.clear(); ui.newJ.clear(); }
  if (was) {
    next.up.forEach((uid) => { if (uid !== null && !was.up.includes(uid)) ui.newUp.add(uid); });
    next.inplay.forEach((jid) => { if (jid !== null && !was.inplay.includes(jid)) ui.newJ.add(jid); });
  }
  ui.newUp = new Set([...ui.newUp].filter((u) => next.up.includes(u)));
  ui.newJ = new Set([...ui.newJ].filter((j) => next.inplay.includes(j)));
  state = next;
  while (state.phase === 'handover' && !E.me(state).bot && !state.over) state = E.pass(state);      // your own turn passes on at once
  ui.build = null; ui.msg = ''; ui.reciting = false;
  if (gained) {
    const j = E.journeyById[gained.journey];
    ui.fx = { journey: gained.journey, path: gained.path, who: gained.who, points: j.points, drawn: false };
    showToast(`${state.players[gained.who].name}: ${jTitle(j)}`, `+${j.points}`);
  }
  save();
  render();
  if (state.over && !(was && was.over)) { setTimeout(showFinal, FAST ? 0 : 2200); return; }
  schedule();
}

function schedule() {
  clearTimeout(ui.timer);
  if (!state || state.over || !E.me(state).bot || state.phase === 'handover') return;          // after its turn you press Continue
  ui.timer = setTimeout(() => commit(AI.step(state)), FAST ? 0 : state.phase === 'play' ? 1100 : 650);
}

function startGame(opts = ui.last) {
  clearTimeout(ui.timer);
  ui.last = opts; ui.fx = null; ui.newUp.clear(); ui.newJ.clear();
  const skills = ['casual', 'steady', 'sharp'];
  const players = [{ name: 'You', bot: false }];
  for (let i = 0; i < opts.bots; i++) players.push({ name: BOT_NAMES[i], bot: true, skill: opts.skill === 'mixed' ? skills[(i + 1) % 3] : opts.skill });
  $('#setup').hidden = true; $('#game').hidden = false;
  commit(E.newGame({ seed: crypto.getRandomValues(new Uint32Array(1))[0], players, expansion: opts.expansion }));
  window.scrollTo({ top: 0 });
}

function showSetup() {
  clearTimeout(ui.timer);
  $('#game').hidden = true; $('#setup').hidden = false; $('#builder').hidden = true; $('#ack').hidden = true; document.body.classList.remove('has-builder', 'has-ack');
  const saved = loadSaved();
  $('#resume').hidden = !saved;
  if (saved) $('#resume-text').textContent = `Game in progress (round ${saved.round}, ${saved.players.length - 1} computer player${saved.players.length > 2 ? 's' : ''}).`;
}

// ---- pieces ------------------------------------------------------------------------------------------------------
const defs = () => E.deckDefs(state.expansion);
const cardImg = (d, w = 480) => `${IMG}${d.img}-${w}.webp`;
const jTitle = (j) => `${PLACES[j.a].name} to ${PLACES[j.b].name}`;
const iAmPlaying = () => state && !state.over && !E.me(state).bot;
const canBuild = () => iAmPlaying() && state.phase === 'play';
const regionColor = (d) => (d.kind === 'place' ? REGION_COLOR[PLACES[d.place].region] : d.region === 'israel' ? '#555' : REGION_COLOR[d.region]);
const REGION_COLOR = { syria: '#e11d1d', galilee: '#4f9a3c', decapolis: '#5b2a17', samaria: '#e0559f', judea: '#1f3fe0', perea: '#f08a00' };

function showToast(title, big) {
  const t = $('#toast');
  t.innerHTML = `<b>${esc(big)}</b><span>${esc(title)}</span>`;
  t.hidden = false; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  clearTimeout(ui.toastTimer);
  ui.toastTimer = setTimeout(() => { t.hidden = true; }, FAST ? 700 : 2600);
}

// ---- drawing the page --------------------------------------------------------------------------------------------
function render() {
  if (!state) return;
  renderBar(); renderStatus(); renderInplay(); renderBoard(); renderPiles(); renderHand(); renderDrawn(); renderActions(); renderBuilder(); renderAck(); renderPlayers(); renderLog();
}

function renderBar() {
  const left = E.journeysLeft(state);
  $('#bar').innerHTML = state.players.map((p, i) => {
    const sc = E.score(p);
    return `<div class="jp-score${i === state.turn && !state.over ? ' is-turn' : ''}"><span class="n">${esc(p.name)}</span><span class="pts">${sc.total}</span><span class="sub">${p.tokens ? `${p.tokens} token${p.tokens > 1 ? 's' : ''}` : '&nbsp;'}</span></div>`;
  }).join('') + `<div class="jp-round">Round ${state.round}<br /><small>${left} journey${left === 1 ? '' : 's'} left</small></div>`;
}

function renderStatus() {
  const p = E.me(state), b = ui.build;
  let t;
  if (state.over) t = 'The game is over.';
  else if (p.bot && state.phase === 'handover') t = `${p.name}'s turn is over. Look at the board, then press Continue.`;
  else if (p.bot) t = `${p.name}'s turn…`;
  else if (state.phase === 'recite') t = 'Your turn. You may recite a Scripture from memory for a token, or skip.';
  else if (state.phase === 'draw') t = `Draw ${E.DRAWS - state.drawn} more card${E.DRAWS - state.drawn === 1 ? '' : 's'} from any of the piles.`;
  else if (state.phase === 'play') {
    if (b) { const j = E.journeyById[b.jid]; t = `Lay the cards of ${jTitle(j)} along the roads, one by one.`; }
    else t = 'Tap a journey card you want to complete, then lay your cards along its route. Or finish your turn.';
  } else t = `Draw ${state.topup - state.drawn} more card${state.topup - state.drawn === 1 ? '' : 's'} to get back to ${E.HAND}.`;
  $('#status').textContent = t;
}

function renderInplay() {
  const mine = canBuild();
  $('#inplay').innerHTML = state.inplay.map((jid, i) => {
    if (jid !== null) {
      const j = E.journeyById[jid], sel = ui.build && ui.build.jid === jid, fresh = ui.newJ.has(jid);
      return `<button type="button" class="jp-journey${sel ? ' is-selected' : ''}${mine ? ' can-pick' : ''}${fresh ? ' is-new' : ''}" data-jid="${jid}" aria-pressed="${!!sel}" aria-label="${esc(jTitle(j))}, ${j.points} points${fresh ? ', newly turned up' : ''}">
        <img src="${IMG}${jid}-480.webp" width="480" height="670" alt="Journey Card: ${esc(jTitle(j))}" />${fresh ? '<span class="new">New</span>' : ''}</button>`;
    }
    const r = (state.turnRoutes || []).find((x) => x.slot === i);
    if (r) {
      const j = E.journeyById[r.journey];
      return `<button type="button" class="jp-journey is-won" data-zoom-j="${j.id}" aria-label="${esc(jTitle(j))}, completed for ${j.points} points"><img src="${IMG}${j.id}-480.webp" width="480" height="670" alt="" /><span class="won">&#10003; +${j.points}${r.who === 0 ? '' : `<small>${esc(state.players[r.who].name)}</small>`}</span></button>`;
    }
    return '<div class="jp-journey is-empty"><span>A new journey is turned up after this turn</span></div>';
  }).join('') || '<p class="text-muted mb-0">No journeys left.</p>';
}

function renderBoard() {
  const j = ui.build && E.journeyById[ui.build.jid];
  // only what was completed this turn is drawn; once the turn is passed on the board is plain roads and boat rides again
  const routes = (state.turnRoutes || []).map((r) => ({ path: r.path, color: PLAYER_COLORS[r.who], now: true, fresh: !!ui.fx && !ui.fx.drawn && ui.fx.journey === r.journey }));
  const held = canBuild() ? Object.keys(E.inventoryOf(defs(), state.players[0].hand, 0).exact) : [];
  const fx = ui.fx && !ui.fx.drawn ? ui.fx : null;
  const ends = j ? [j.a, j.b, ...B.lineEnds(ui.build)] : [];
  drawBoard($('#board'), { ends, build: ui.build ? B.routeSoFar(ui.build) : [], routes, held, bursts: fx ? [fx.path[0], fx.path[fx.path.length - 1]] : [] });
  if (ui.fx) ui.fx.drawn = true;
}

function renderPiles() {
  const drawing = iAmPlaying() && (state.phase === 'draw' || state.phase === 'topup');
  $('#piles-hint').textContent = drawing ? '(tap a card to take it)' : '';
  const up = state.up.map((uid, i) => (uid === null ? `<div class="jp-pile is-empty" aria-hidden="true"></div>`
    : `<button type="button" class="jp-pile${ui.newUp.has(uid) ? ' is-new' : ''}" data-take="${i}" ${drawing ? '' : 'disabled'} aria-label="Take ${esc(E.cardLabel(defs()[uid]))}${ui.newUp.has(uid) ? ' (newly turned up)' : ''}"><img src="${cardImg(defs()[uid])}" width="480" height="670" alt="${esc(E.cardLabel(defs()[uid]))}" /><span class="jp-cap">${esc(E.cardLabel(defs()[uid]))}</span>${ui.newUp.has(uid) ? '<span class="new">New</span>' : ''}</button>`)).join('');
  const down = state.draw.length + state.discard.length;
  $('#piles').innerHTML = up + `<button type="button" class="jp-pile jp-down" data-take="down" ${drawing && down ? '' : 'disabled'} aria-label="Take the top face-down card (${down} left)"><img src="${IMG}back-place-480.webp" width="480" height="670" alt="" /><span class="count">${down}</span></button>`;
}

function renderHand() {
  const p = state.players[0], inBuild = new Set(ui.build ? ui.build.seq.map((c) => c.uid) : []);
  const fresh = new Set(state.turn === 0 && !state.over ? (state.picks || []).map((x) => x.uid) : []);
  const d = defs();
  const hand = [...p.hand].sort((a, b) => {
    const A = d[a], B2 = d[b], ra = A.kind === 'place' ? PLACES[A.place].region : 'z' + (A.region || ''), rb = B2.kind === 'place' ? PLACES[B2.place].region : 'z' + (B2.region || '');
    return ra < rb ? -1 : ra > rb ? 1 : E.cardLabel(A) < E.cardLabel(B2) ? -1 : 1;
  });
  const recite = ui.reciting && iAmPlaying() && state.phase === 'recite';
  $('#hand-hint').textContent = recite ? '(tap the card you will recite; the verses are hidden)' : ui.build ? '(tap the cards for your route)' : `(${p.hand.length} cards${p.tokens ? `, ${p.tokens} token${p.tokens > 1 ? 's' : ''}` : ''})`;
  $('#hand').innerHTML = hand.map((uid) => {
    const c = d[uid], isNew = fresh.has(uid);
    const hidden = recite && c.kind === 'place';                      // face down while you recite, so you cannot read the verse
    const canPick = recite && c.kind === 'place';
    const src = hidden ? `${IMG}back-place-480.webp` : cardImg(c);
    return `<button type="button" class="jp-hc${inBuild.has(uid) ? ' is-used' : ''}${canPick ? ' is-pick' : ''}${recite && !canPick ? ' is-off' : ''}${hidden ? ' is-down' : ''}${isNew ? ' is-new' : ''}${ui.build && !inBuild.has(uid) ? ' can-lay' : ''}" data-hand="${uid}" ${recite && !canPick ? 'disabled' : ''} style="--rc:${regionColor(c)}" aria-label="${hidden ? 'Face-down card: ' : ''}${esc(E.cardLabel(c))}${isNew ? ', just drawn' : ''}">
      <img src="${src}" width="480" height="670" alt="${hidden ? '' : esc(E.cardLabel(c))}" loading="lazy" /><span class="jp-cap" style="color:${regionColor(c)}">${esc(E.cardLabel(c))}</span>${isNew ? '<span class="new">New</span>' : ''}</button>`;
  }).join('') + tokenTiles(p);
}

// Scripture Memory Tokens sit in your hand like cards: tap one to use it as a wild card on your route.
function tokenTiles(p) {
  const used = ui.build ? ui.build.seq.filter((c) => c.kind === 'token').length : 0;
  return Array.from({ length: p.tokens }, (_, i) => {
    const gone = i >= p.tokens - used;
    return `<button type="button" class="jp-hc jp-tok${gone ? ' is-used' : ''}${ui.build && !gone ? ' can-lay' : ''}" data-token="${i}" style="--rc:#b8941f" aria-label="Scripture Memory Token: 5 points, or a wild card">
      <img src="${IMG}token-back-480.webp" width="480" height="480" alt="" loading="lazy" /><span class="jp-cap" style="color:#7a5d00">Token</span></button>`;
  }).join('');
}

// The cards you took this turn, so a card from the face-down pile is easy to spot among the others in your hand.
function renderDrawn() {
  const box = $('#drawn'), d = defs();
  const mine = state.turn === 0 && !state.over ? (state.picks || []).filter((x) => state.players[0].hand.includes(x.uid)) : [];
  box.hidden = !mine.length;
  box.innerHTML = mine.length ? '<span class="lbl">Just drawn</span>' + mine.map((x) => `<button type="button" class="jp-dc" data-hand="${x.uid}" aria-label="${esc(E.cardLabel(d[x.uid]))}, from ${x.from === 'down' ? 'the face-down pile' : 'a face-up pile'}">
    <img src="${cardImg(d[x.uid])}" width="480" height="670" alt="" /><span class="how">${x.from === 'down' ? 'face-down' : 'face-up'}</span></button>`).join('') : '';
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

// The bar at the foot of the screen while you lay a journey: the route so far, what to do next, and a small map.
function renderBuilder() {
  const bar = $('#builder'), b = ui.build;
  const on = !!b && canBuild();
  bar.hidden = !on; document.body.classList.toggle('has-builder', on);
  if (!on) return;
  const j = E.journeyById[b.jid], name = (id) => PLACES[id].name, last = B.lastPlace(b);
  $('#b-title').innerHTML = `${esc(jTitle(j))} <span class="pts">${j.points} points</span>`;
  const reuse = b.reuse.map((id) => `<span class="chip reuse">${esc(name(id))}</span>`).join('<i>&rarr;</i>');
  const seq = b.seq.map((c) => `<span class="chip${c.kind === 'exact' ? '' : ' wild'}" title="${c.kind === 'exact' ? '' : c.kind === 'token' ? 'a Scripture token' : 'a Wild Card'}">${esc(name(c.place))}</span>`).join('<i>&rarr;</i>');
  let route;
  if (b.mode === 'extend' && !b.side) route = `<span class="muted">Continue from either end of your line, <b>${esc(name(b.chain[0]))}</b> or <b>${esc(name(b.chain[b.chain.length - 1]))}</b>, on to <b>${esc(name(b.target))}</b>.</span>`;
  else {
    route = [reuse, seq].filter(Boolean).join('<i>&rarr;</i>');
    if (!route) route = `<span class="muted">Start at <b>${esc(name(j.a))}</b> or <b>${esc(name(j.b))}</b>.</span>`;
    else if (b.target) route += `<i>&rarr;</i><span class="chip goal">${esc(name(b.target))}</span>`;
  }
  $('#b-route').innerHTML = route;
  $('#b-msg').textContent = ui.msg || (last ? `Next: a place joined to ${name(last)} by a road or boat ride.` : '');
  $('#b-actions').innerHTML = [
    b.seq.length ? '<button type="button" class="btn btn-outline-secondary btn-sm" data-b="undo">Undo</button>' : '',
    b.mode === 'extend' && !b.seq.length ? '<button type="button" class="btn btn-outline-secondary btn-sm" data-b="fresh">Start a separate line</button>' : '',
    '<button type="button" class="btn btn-outline-secondary btn-sm" data-b="map">Map</button>',
    `<button type="button" class="btn btn-outline-secondary btn-sm" data-b="look">See the card</button>`,
    '<button type="button" class="btn btn-outline-danger btn-sm" data-b="cancel">Cancel</button>',
  ].join(' ');
}

// After a computer player's turn: what it did, and a Continue button, so you can look at the board before the next player starts.
function renderAck() {
  const bar = $('#ack'), on = !!state && !state.over && state.phase === 'handover' && E.me(state).bot;
  bar.hidden = !on; document.body.classList.toggle('has-ack', on);
  if (!on) return;
  const who = state.players[state.turn];
  $('#ack-title').textContent = `${who.name}'s turn is over`;
  const mine = state.log.filter((l) => l.round === state.round && l.who === state.turn);
  const key = (l) => (/completed|extended|also/.test(l.text) ? 0 : 1);        // what it completed first
  $('#ack-list').innerHTML = [...mine].sort((a, b) => key(a) - key(b)).map((l) => `<li>${esc(l.text)}</li>`).join('') || '<li>Nothing to report.</li>';
  const stamp = `${state.round}:${state.turn}`;
  if (ui.ackFor !== stamp) { ui.ackFor = stamp; if (state.turnRoutes && state.turnRoutes.length) $('#board').scrollIntoView({ behavior: FAST ? 'auto' : 'smooth', block: 'center' }); }   // bring the journeys it drew into view
  $('#ack-btn').focus({ preventScroll: true });
}

function renderPlayers() {
  $('#players').innerHTML = state.players.map((p, i) => {
    const sc = E.score(p);
    const journeys = p.journeys.map((id) => `<li>${esc(jTitle(E.journeyById[id]))} <b>${E.journeyById[id].points}</b></li>`).join('');
    const skill = p.bot ? ` <span class="badge text-bg-light">${AI.SKILLS[p.skill].name}</span>` : '';
    return `<div class="jp-player${i === state.turn && !state.over ? ' is-turn' : ''}" style="--pc:${PLAYER_COLORS[i]}"><div class="head"><b>${esc(p.name)}</b>${skill} <span class="ms-auto">${sc.total} points</span></div>
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
  $('#card-body').innerHTML = `<img class="jp-zoom" src="${IMG}back-place-755.webp" alt="The card, face down" /><p class="mt-2 mb-0">Say the Scripture on this card from memory, out loud or in your head. When you are ready, turn the card over and check.</p>`;
  $('#card-actions').innerHTML = '<button type="button" class="btn btn-primary" id="rc-show">Turn it over</button><button value="close" class="btn btn-outline-secondary">Cancel</button>';
  $('#rc-show').onclick = () => {
    $('#card-body').innerHTML = `<img class="jp-zoom" src="${cardImg(c, 755)}" alt="${esc(E.cardLabel(c))}" /><p class="mt-2 mb-0">Did you get it right?</p>`;
    $('#card-actions').innerHTML = '<button type="button" class="btn btn-success" id="rc-yes">I got it</button><button type="button" class="btn btn-outline-secondary" id="rc-no">I missed it</button>';
    $('#rc-yes').onclick = () => { $('#card-dialog').close(); commit(E.recite(state, true, uid)); };
    $('#rc-no').onclick = () => { $('#card-dialog').close(); commit(E.recite(state, false, uid)); };
  };
  $('#card-dialog').showModal();
}

// Which place does this Wild Card (or token) stand for? Only places that could come next are offered.
function chooseStand(title, places, make) {
  $('#card-title').textContent = title;
  $('#card-body').innerHTML = `<div class="jp-choose">${places.map((id) => `<button type="button" class="btn btn-outline-primary" data-stand="${id}">${esc(PLACES[id].name)}</button>`).join('')}</div>`;
  $('#card-actions').innerHTML = '<button value="close" class="btn btn-outline-secondary">Cancel</button>';
  $('#card-body').querySelectorAll('[data-stand]').forEach((b) => { b.onclick = () => { $('#card-dialog').close(); apply(make(b.dataset.stand)); }; });
  $('#card-dialog').showModal();
}

function showFinal() {
  const st = E.standings(state), win = E.winners(state);
  const youWon = win.includes(0);
  $('#final-title').textContent = win.length > 1 ? `A tie: ${win.map((i) => state.players[i].name).join(' and ')}` : youWon ? 'You win!' : `${state.players[win[0]].name} wins`;
  $('#final-body').innerHTML = `<p class="small text-muted">${state.endedBy === 'journeys' ? 'The last journey was completed.' : state.endedBy === 'stalled' ? 'Nobody could play any more cards.' : 'The game reached its round limit.'}</p>
    <div class="table-responsive"><table class="table table-sm"><thead><tr><th>Player</th><th class="text-end">Journeys</th><th class="text-end">Tokens</th><th class="text-end">Total</th></tr></thead><tbody>${
  st.map((r) => `<tr${win.includes(r.i) ? ' class="table-success"' : ''}><td>${esc(r.name)}</td><td class="text-end">${r.journeys}</td><td class="text-end">${r.tokens}</td><td class="text-end"><b>${r.total}</b></td></tr>`).join('')}</tbody></table></div>`;
  mountShare($('#final-body'));
  $('#final').showModal();
}

// Share the result as a picture: the native share sheet where the browser offers it, plus a download and copyable text.
async function mountShare(root) {
  const box = document.createElement('div');
  box.className = 'share-box';
  box.innerHTML = `<div class="share-actions"><button type="button" class="btn btn-primary btn-sm" id="share-dl" disabled>Download image</button>
    <button type="button" class="btn btn-outline-primary btn-sm" id="share-native" hidden>Share\u2026</button>
    <button type="button" class="btn btn-outline-secondary btn-sm" id="share-copy">Copy text</button></div>
    <img class="share-preview" alt="The finished game: the board with everyone's journeys, and the scores" width="1200" height="880" hidden>
    <p class="small text-muted mb-0" id="share-msg" aria-live="polite">Drawing your result card\u2026</p>`;
  root.appendChild(box);
  const img = box.querySelector('.share-preview'), msg = box.querySelector('#share-msg');
  const dl = box.querySelector('#share-dl'), nat = box.querySelector('#share-native'), copy = box.querySelector('#share-copy');
  const snapshot = state;
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(shareMessage(snapshot)); msg.textContent = 'Copied. Paste it anywhere.'; } catch { msg.textContent = shareMessage(snapshot); }
  };
  try {
    const canvas = await drawShareImage(document.createElement('canvas'), snapshot);
    const blob = await canvasToBlob(canvas);
    const url = URL.createObjectURL(blob);
    img.src = url; img.hidden = false; dl.disabled = false; msg.textContent = '';
    const file = new File([blob], 'journeys-with-jesus.png', { type: 'image/png' });
    nat.hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    dl.onclick = () => { const a = document.createElement('a'); a.href = url; a.download = 'journeys-with-jesus.png'; document.body.appendChild(a); a.click(); a.remove(); };
    nat.onclick = async () => { try { await navigator.share(nativeShareData(file, snapshot)); } catch { /* cancelled */ } };
  } catch {
    msg.textContent = 'Sorry, the result card could not be drawn in this browser. You can still copy the text.';
  }
}

// ---- laying a journey ----------------------------------------------------------------------------------------------
function selectJourney(jid) {
  if (ui.build && ui.build.jid === jid) { ui.build = null; ui.msg = ''; render(); return; }
  const r = B.begin(state, jid);
  if (r.inside) { commit(E.play(state, r.inside)); return; }          // wholly inside what you laid this turn: yours with no more cards
  ui.build = r.build; ui.msg = '';
  render();
}

function apply(card) {
  try {
    const r = B.add(ui.build, card);
    ui.build = r.build; ui.msg = '';
    if (r.done) { commit(E.play(state, B.toPlay(ui.build))); return; }
    render();
  } catch (e) { ui.msg = e.message; render(); }
}

function placeTapped(place) {
  if (!canBuild()) return;
  if (!ui.build) { ui.msg = ''; $('#status').textContent = 'Tap a journey card first, then lay your cards along its route.'; return; }
  const ok = B.canPlace(ui.build, place);
  if (!ok.ok) { ui.msg = ok.why; render(); return; }
  const cards = B.cardsFor(state, ui.build, place);
  if (!cards.length) { ui.msg = `You have no card for ${PLACES[place].name}.`; render(); return; }
  const card = cards[0];
  if (card.kind === 'token' && !confirm(`Use a Scripture Memory Token for ${PLACES[place].name}? You lose its 5 points.`)) return;
  apply(card);
}

function cardTapped(uid) {
  const c = defs()[uid];
  if (c.kind === 'place') {
    const ok = B.canPlace(ui.build, c.place);
    if (!ok.ok) { ui.msg = ok.why; render(); return; }
    if (ui.build.seq.some((x) => x.uid === uid)) { ui.msg = 'That card is already on your route.'; render(); return; }
    apply({ place: c.place, uid, kind: 'exact' });
    return;
  }
  const options = B.legalPlaces(ui.build).filter((id) => c.region === 'israel' || PLACES[id].region === c.region);
  if (!options.length) { ui.msg = `${E.cardLabel(c)} cannot stand for any place that could come next.`; render(); return; }
  const kind = c.region === 'israel' ? 'israel' : 'region';
  if (options.length === 1) { apply({ place: options[0], uid, kind }); return; }
  chooseStand(`Which place is this ${E.cardLabel(c)}?`, options, (place) => ({ place, uid, kind }));
}

function builderAction(what) {
  const b = ui.build;
  if (what === 'undo') { ui.build = B.undo(b); ui.msg = ''; render(); }
  else if (what === 'fresh') { ui.build = B.startFresh(b); ui.msg = ''; render(); }
  else if (what === 'cancel') { ui.build = null; ui.msg = ''; render(); }
  else if (what === 'map') $('#board').scrollIntoView({ behavior: FAST ? 'auto' : 'smooth', block: 'center' });
  else if (what === 'look') { const j = E.journeyById[b.jid]; zoom(`${IMG}${j.id}-755.webp`, `${jTitle(j)}: ${j.points} points`); }
}

// Tapping a token in your hand: while you lay a journey it stands for a place of your choice (you lose its 5 points).
function tokenTapped() {
  if (!(ui.build && canBuild())) { zoom(`${IMG}token-back-755.webp`, 'Scripture Memory Token: 5 points if you keep it, or use it as a wild card on your route'); return; }
  const left = state.players[0].tokens - ui.build.seq.filter((c) => c.kind === 'token').length;
  if (left <= 0) { ui.msg = 'You have no more tokens.'; render(); return; }
  const options = B.legalPlaces(ui.build);
  if (!options.length) { ui.msg = 'No place could come next.'; render(); return; }
  if (options.length === 1) { apply({ place: options[0], uid: null, kind: 'token' }); return; }
  chooseStand('Which place will the token stand for? (You lose its 5 points.)', options, (place) => ({ place, uid: null, kind: 'token' }));
}

// ---- events ------------------------------------------------------------------------------------------------------
document.addEventListener('click', (e) => {
  if (!state) return;
  const hit = e.target.closest('[data-place]');
  if (hit && hit.closest('#board')) { placeTapped(hit.dataset.place); return; }
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.zoomJ) { const j = E.journeyById[t.dataset.zoomJ]; zoom(`${IMG}${j.id}-755.webp`, `${jTitle(j)}: ${j.points} points`); return; }
  if (t.dataset.ack) { if (state.phase === 'handover') commit(E.pass(state)); return; }
  if (t.dataset.b) { builderAction(t.dataset.b); return; }
  if (t.dataset.token !== undefined) { tokenTapped(); return; }
  if (t.dataset.jid) {
    if (canBuild()) selectJourney(t.dataset.jid);
    else { const j = E.journeyById[t.dataset.jid]; zoom(`${IMG}${j.id}-755.webp`, `${jTitle(j)}: ${j.points} points`); }
    return;
  }
  if (!iAmPlaying()) return;
  if (t.dataset.take !== undefined) {
    const from = t.dataset.take === 'down' ? 'down' : Number(t.dataset.take);
    if ((state.phase === 'draw' || state.phase === 'topup') && E.canTake(state, from)) commit(E.take(state, from));
  } else if (t.dataset.hand !== undefined) {
    const uid = Number(t.dataset.hand), c = defs()[uid];
    if (ui.reciting && state.phase === 'recite') reciteDialog(uid);
    else if (ui.build && canBuild()) cardTapped(uid);
    else zoom(cardImg(c, 755), E.cardLabel(c));
  } else if (t.dataset.act === 'recite') { ui.reciting = true; render(); }
  else if (t.dataset.act === 'cancel-recite') { ui.reciting = false; render(); }
  else if (t.dataset.act === 'skip') commit(E.skipRecite(state));
  else if (t.dataset.act === 'end') commit(E.endPlay(state));
});

$('#start-btn').addEventListener('click', () => startGame({ bots: Number($('#bot-count').value), skill: $('#bot-skill').value, expansion: $('#expansion').checked }));
$('#resume-btn').addEventListener('click', () => { state = loadSaved(); $('#setup').hidden = true; $('#game').hidden = false; render(); schedule(); });
$('#discard-btn').addEventListener('click', () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } showSetup(); });
$('#new-btn').addEventListener('click', () => { if (!state || state.over || confirm('Leave this game? Your game in progress is saved and you can resume it.')) showSetup(); });
$('#final-again').addEventListener('click', (e) => { e.preventDefault(); $('#final').close(); startGame(); });

ui.last = { bots: 2, skill: 'steady', expansion: false };
if (FAST) window.jwj = { get state() { return state; }, get ui() { return ui; } };   // for the browser tests
showSetup();
