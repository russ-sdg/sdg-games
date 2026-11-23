// Illuminate: play online against 1 to 3 computer players. You are seat 0.
import * as E from './engine.js';
import * as AI from './ai.js';
import { CARD, SUIT_NAMES, ROLES, ROLE_NAMES, ROLE_COLOR, SYMBOL, SPECIAL_TEXT, cardImage, backImage, roleImage, symbolImage } from './cards.js';
import { drawShareImage, canvasToBlob, nativeShareData, shareMessage } from './share.js';

const KEY = 'sdg-illuminate-play-1';
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const FAST = params.has('fast');                                // ?fast skips the computers' pauses (for testing)
const sleep = (ms) => new Promise((r) => setTimeout(r, FAST ? 1 : ms));
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BOTS = ['Peter', 'Mary', 'John'];
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

let S = null, cfg = null, token = 0, busy = false, release = null;
let ui = { seenTricks: 0, seenHands: 0, hold: false, rotated: null };

function save() { try { localStorage.setItem(KEY, JSON.stringify({ S, cfg })); } catch (e) { /* private mode */ } }
function load() { try { const v = JSON.parse(localStorage.getItem(KEY)); return v && v.S && v.S.v === 1 && v.cfg && !v.S.over ? v : null; } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
const show = (w) => { $('setup').hidden = w !== 'setup'; $('game').hidden = w !== 'game'; if (w === 'setup') { $('dock').hidden = true; document.body.classList.remove('has-dock'); } window.scrollTo(0, 0); };

// ---- starting --------------------------------------------------------------------------------------------------------------------
function startGame() {
  const n = Number($('bot-count').value), pick = $('bot-skill').value, skills = ['casual', 'steady', 'sharp'], mine = $('my-role').value;
  const seed = Number(params.get('seed')) || Math.floor(Math.random() * 1e9) + 1;      // ?seed=N replays a deal (for testing)
  const others = ROLES.filter((r) => r !== mine).sort(() => Math.random() - 0.5);
  const players = [{ name: 'You', bot: false, role: mine }, ...Array.from({ length: n }, (_, i) => ({ name: BOTS[i], bot: true, role: others[i], skill: pick === 'mixed' ? skills[(i + 1) % 3] : pick }))];
  cfg = { bots: n, skill: pick, role: mine, plan: $('plan').value, notPerfect: $('not-perfect').checked, offer: $('offer-proclaim').checked, seed };
  S = E.newGame({ seed, players, plan: cfg.plan, notPerfect: cfg.notPerfect, dealer: Math.floor(Math.random() * players.length) });
  ui = { seenTricks: 0, seenHands: 0, hold: false, rotated: null };
  save(); show('game'); render(); run();
}

// ---- words -----------------------------------------------------------------------------------------------------------------------
const nm = (p) => S.players[p].name;
const V = (who, base, third) => (who === 0 ? base : third || base + 's');
const bidText = (b, size) => (E.isAllNothing(size) ? (b === 0 ? 'nothing' : 'all') : String(b));
const WHY = {
  high: 'the highest card of the suit led', grace: 'the highest Grace card', lowest: 'the lowest card, as Matthew 19:30 says', leader: 'the player who led, as Mark 14:27 says',
  nograce: 'the highest card of the suit led (Grace was disabled by John 1:5)',
};
function said(e) {
  const W = nm(e.who ?? 0);
  switch (e.k) {
    case 'bid': return `${W} ${V(e.who, 'bid')} ${bidText(e.n, e.size)}.`;
    case 'play': return `${W} ${V(e.who, 'play')} ${CARD[e.card].label}${e.grace ? ' with Grace' : ''}.`;
    case 'proclaim': return `${W} ${V(e.who, 'proclaim')} “Grace!” for ${e.target === 0 ? 'your' : `${nm(e.target)}’s`} ${CARD[e.card].label}.`;
    case 'trick': return `${W} ${V(e.who, 'win')} the trick.`;
    case 'rotate': return `Luke 19:24: the roles rotate to the right. You are now the ${ROLE_NAMES[e.roles[0]]}.`;
    case 'hand': return `Hand ${e.no} is scored.`;
    default: return '';
  }
}

// ---- the game loop ---------------------------------------------------------------------------------------------------------------
function waitClick() {
  if (FAST) return Promise.resolve();
  ui.hold = true; render();
  return new Promise((res) => { release = () => { release = null; ui.hold = false; res(); }; });
}
async function run() {
  const my = ++token;
  for (;;) {
    if (!S) return;
    if (S.tricks > ui.seenTricks) {                              // a trick was just taken: leave it on the table until you say so
      ui.seenTricks = S.tricks; await waitClick(); if (my !== token) return;
      if (S.history.length > ui.seenHands) { ui.seenHands = S.history.length; await handDialog(S.history[S.history.length - 1]); if (my !== token) return; }
      render(); save();
      continue;
    }
    if (S.over) { showFinal(); return; }
    const seat = E.actor(S), p = S.players[seat];
    if (seat === 0) {
      render();
      if (S.pending) await answerProclaim(my);
      return;
    }
    render(); await sleep(S.phase === 'bid' ? 650 : 800); if (my !== token) return;
    step(AI.choose(S, p.skill)); save(); render();
    if (ui.rotated) { await rotationNotice(); if (my !== token) return; }
  }
}
// Apply an action, remembering if it changed anyone's role (only Luke 19:24 does), so the page can say so.
function step(a) {
  const before = S.players.map((p) => p.role);
  S = E.apply(S, a);
  const after = S.players.map((p) => p.role);
  if (before.join() !== after.join()) ui.rotated = { before, after, by: S.log.filter((e) => e.k === 'play').slice(-1)[0].who };
}
function act(a) {
  try { step(a); } catch (e) { console.error(e); return; }
  save(); render(); run();
}
async function rotationNotice() {
  const r = ui.rotated; ui.rotated = null;
  const rows = S.players.map((p, i) => `<tr><td>${esc(p.name)}</td><td>${roleChip(r.before[i])}</td><td>&rarr;</td><td>${roleChip(r.after[i])}</td></tr>`).join('');
  await ask({ title: 'The roles rotate!', html: `<p>${esc(nm(r.by))} played <b>Luke 19:24</b>, the star card that rotates the roles to the right. Everyone takes the role of the player on their left, and the new roles count straight away.</p><table class="il-tbl"><tbody>${rows}</tbody></table><p class="small mb-0 mt-2">You are now the <b>${ROLE_NAMES[r.after[0]]}</b>: cards with ${sym(r.after[0])} are your Grace cards.</p>`,
    options: [{ label: 'OK', value: 1, cls: 'btn-primary' }] });
}

// ---- asking you things ----------------------------------------------------------------------------------------------------------
function ask({ title, html = '', options = [] }) {
  const d = $('ask'), f = $('ask-form');
  return new Promise((resolve) => {
    f.innerHTML = `<h2 class="h5" id="ask-title">${esc(title)}</h2>${html}<div class="il-opts">${options.map((o, i) => `<button type="button" class="btn ${o.cls || 'btn-outline-secondary'}" data-i="${i}">${esc(o.label)}</button>`).join('')}</div>`;
    let done = false;
    const finish = (v) => { if (done) return; done = true; d.removeEventListener('cancel', onCancel); f.onclick = null; if (d.open) d.close(); resolve(v); };
    const onCancel = (e) => { e.preventDefault(); };
    d.addEventListener('cancel', onCancel);
    f.onclick = (e) => { const b = e.target.closest('[data-i]'); if (b) finish(options[Number(b.dataset.i)].value); };
    d.showModal();
  });
}
const cardInfo = (id, role) => {
  const c = CARD[id], bits = [];
  if (c.special) bits.push(`<b>Special card.</b> ${SPECIAL_TEXT[c.special]}`);
  else bits.push(`Grace card for: ${c.roles.map((r) => `<b style="color:${ROLE_COLOR[r]}">${sym(r)} ${ROLE_NAMES[r]}</b>`).join(' and ')}.`);
  if (role && c.roles.includes(role)) bits.push('It is a Grace card for <b>you</b>.');
  return `<p class="small mb-0">${bits.join(' ')}</p>`;
};
async function answerProclaim(my) {
  const P = S.pending, e = S.trick[S.trick.length - 1];
  if (!cfg.offer) { act({ t: 'pass' }); return; }
  const v = await ask({ title: `Proclaim Grace for ${nm(P.target)}?`, html: `<div class="il-cardview"><img src="${cardImage(e.card, 320)}" alt="${esc(CARD[e.card].label)}" /><p class="small mb-0">${esc(nm(P.target))} played ${esc(CARD[e.card].label)}, a Grace card for ${esc(ROLE_NAMES[e.role])}s, without saying &ldquo;Grace&rdquo;. If you proclaim it, it beats every card that is not a Grace card.</p></div>`,
    options: [{ label: 'Proclaim Grace!', value: true, cls: 'btn-primary' }, { label: 'Let it pass', value: false }] });
  if (my !== token) return; act({ t: v ? 'proclaim' : 'pass' });
}
async function handDialog(h) {
  const win = Math.max(...h.pts);
  const rows = S.players.map((p, i) => `<tr class="${h.pts[i] === win && win > 0 ? 'win' : ''}"><td>${esc(p.name)}</td><td>${esc(bidText(h.bids[i], h.size))}</td><td>${h.won[i]}</td><td>+${h.pts[i]}</td><td>${h.scores[i]}</td></tr>`).join('');
  await ask({ title: `Hand ${h.no} of ${h.of} scored`, html: `<table class="il-tbl"><thead><tr><th></th><th>Bid</th><th>Won</th><th>Points</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>`,
    options: [{ label: S.over ? 'See the final result' : 'Deal the next hand', value: 1, cls: 'btn-primary' }] });
}

// ---- your turn ------------------------------------------------------------------------------------------------------------------
const mine = () => !!S && !S.over && E.actor(S) === 0 && !S.pending && !ui.hold;
async function openCard(id, fromTable = false) {
  if (busy) return; busy = true;
  try {
    const me = S.players[0], L = !fromTable && mine() && S.phase === 'play' ? E.legal(S).filter((a) => a.card === id) : [];
    const opts = [];
    if (L.some((a) => a.grace)) { opts.push({ label: 'Play with Grace!', value: 'grace', cls: 'btn-primary' }); opts.push({ label: 'Play without Grace', value: 'plain', cls: 'btn-outline-primary' }); }
    else if (L.length) opts.push({ label: 'Play this card', value: 'plain', cls: 'btn-primary' });
    opts.push({ label: 'Close', value: 'close' });
    let why = '';
    if (!fromTable && mine() && S.phase === 'play' && !L.length) { const led = CARD[S.trick[0].card].suit; why = `<p class="il-why mb-0">You must follow the suit that was led (${SUIT_NAMES[led]}), because you have a ${SUIT_NAMES[led]} card.</p>`; }
    const extra = L.some((a) => a.grace) ? '<p class="small mb-0">Grace: if you proclaim it, this card beats every card that is not a Grace card. Leave it out if you do not want the trick.</p>' : '';
    const my = token, v = await ask({ title: CARD[id].label, html: `<div class="il-cardview"><img src="${cardImage(id, 640)}" alt="${esc(CARD[id].label)}" />${cardInfo(id, me.role)}${extra}${why}</div>`, options: opts });
    busy = false;
    if (my !== token) return;
    if (v === 'grace' || v === 'plain') act({ t: 'play', card: id, grace: v === 'grace' });
  } finally { busy = false; }
}
function doDo(what, arg) {
  if (what === 'next') { if (release) release(); return; }
  if (what === 'bid' && !ui.hold && E.actor(S) === 0 && S.phase === 'bid') act({ t: 'bid', n: Number(arg) });
}

// ---- drawing the page ------------------------------------------------------------------------------------------------------------
function render() {
  if (!S) return;
  renderHead(); renderPlayers(); renderTable(); renderHand(); renderLog(); renderDock();
}
const sym = (r) => `<img class="il-symimg" src="${symbolImage(r)}" alt="" />`;
const roleChip = (r) => `<span class="il-role" style="--c:${ROLE_COLOR[r]}"><span class="il-symbg">${sym(r)}</span> ${ROLE_NAMES[r]}</span>`;
function renderHead() {
  const size = E.handSize(S);
  $('head').innerHTML = `<span>Hand ${S.handNo + 1} of ${S.sizes.length}</span><small>${plural(size, 'card')} each${E.isAllNothing(size) ? ' &middot; bid <b>all</b> or <b>nothing</b>' : ''} &middot; dealer ${esc(nm(S.dealer))}</small>`;
}
function renderPlayers() {
  const size = E.handSize(S);
  $('players').innerHTML = S.players.map((p, i) => `<div class="il-pl${i === S.turn && !S.over && !ui.hold && S.phase !== 'over' ? ' is-turn' : ''}">
    <div class="n"><span>${esc(p.name)}</span>${i === S.dealer ? '<span class="il-badge">dealer</span>' : ''}<span class="sc" title="Score">${p.score}</span></div>
    <div>${roleChip(p.role)}</div>
    <div class="meta">Bid: <b>${p.bid === null ? '&ndash;' : esc(bidText(p.bid, size))}</b> &middot; Won: <b>${p.won}</b> &middot; ${plural(p.hand.length, 'card')}</div></div>`).join('');
}
const faceHtml = (id, { tag = 'div', cls = '', attrs = '', grace = false } = {}) => {
  const c = CARD[id], sym = c.special ? '⭐' : '';
  return `<${tag} ${tag === 'button' ? 'type="button"' : ''} class="il-c ${cls} ${grace ? 'grace' : ''}" ${attrs} aria-label="${esc(c.label)}"><img src="${cardImage(id, 320)}" alt="" />${grace ? '<span class="il-grace">GRACE</span>' : ''}</${tag}>`;
};
function renderTable() {
  const T = S.lastTrick, live = S.trick.length && !ui.hold;
  const entries = live ? S.trick : (T && S.tricks > 0 ? T.entries : []), winner = ui.hold && T ? T.winner : -1;
  $('table').innerHTML = entries.length ? entries.map((e) => `<div class="il-play${e.p === winner ? ' win' : ''}${live ? '' : ' old'}"><span class="who">${esc(nm(e.p))}${e.p === winner ? ' \u2714' : ''}</span>${faceHtml(e.card, { tag: 'button', attrs: `data-table="${e.card}"`, grace: e.grace })}</div>`).join('')
    : '<span class="il-empty">No cards played yet.</span>';
  $('table-note').textContent = live ? (S.trick.some((e) => CARD[e.card].special) ? S.trick.filter((e) => CARD[e.card].special).map((e) => SPECIAL_TEXT[CARD[e.card].special]).join(' ') : `Suit led: ${SUIT_NAMES[CARD[S.trick[0].card].suit]}`) : (entries.length ? 'The last trick' : '');
}
function renderHand() {
  const p = S.players[0], L = mine() && S.phase === 'play' ? E.legal(S) : [], ok = new Set(L.map((a) => a.card));
  const graceOk = new Set(L.filter((a) => a.grace).map((a) => a.card));
  $('hand').innerHTML = p.hand.map((c) => `<div class="il-play">${faceHtml(c, { tag: 'button', cls: mine() && S.phase === 'play' ? (ok.has(c) ? 'can' : 'dim') : '', attrs: `data-card="${c}"` })}</div>`).join('') || '<span class="text-muted">No cards in hand.</span>';
  $('hand-note').innerHTML = `You are the ${roleChip(p.role)} &mdash; cards with this symbol ${sym(p.role)} are Grace cards for you. Tap a card to read it${mine() && S.phase === 'play' ? ' or play it' : ''}.`;
}
function renderLog() {
  $('log').innerHTML = S.log.filter((e) => e.k !== 'hand').slice(-18).map((e) => { const t = said(e); return t ? `<li class="${e.who === 0 ? 'me' : e.k === 'rotate' ? 'me' : ''}">${esc(t)}</li>` : ''; }).join('') || '<li>Nothing yet.</li>';
}
function renderDock() {
  const on = !S.over || ui.hold; $('dock').hidden = !on; document.body.classList.toggle('has-dock', on);
  if (!on) return;
  let t = '', acts = '';
  const size = E.handSize(S);
  if (ui.hold) {
    const T = S.lastTrick, why = WHY[T.why] || '';
    t = `${esc(nm(T.winner))} ${T.winner === 0 ? 'win' : 'wins'} the trick.<small>${esc(why ? `Won by ${why}.` : '')}</small>`;
    acts = '<button type="button" class="btn btn-primary" data-do="next">Next</button>';
  } else if (S.over) t = '';
  else if (E.actor(S) !== 0) t = `${esc(nm(E.actor(S)))} is ${S.phase === 'bid' ? 'bidding' : 'playing'}…`;
  else if (S.pending) t = 'Your answer is needed…';
  else if (S.phase === 'bid') {
    const opts = E.bidOptions(S), all = E.isAllNothing(size);
    t = `Your bid.<small>${all ? `Take every trick (“all”) or none (“nothing”).` : `How many of the ${plural(size, 'trick')} will you win? Win exactly that many to score it plus 2.`}${cfg.notPerfect && opts.length < size + 1 && !all ? ' Not Perfect bidding: the bids may not add up to ' + size + '.' : ''}</small>`;
    acts = opts.map((b) => `<button type="button" class="btn btn-primary" data-do="bid" data-arg="${b}">${all ? (b === 0 ? 'Nothing' : `All (${b})`) : b}</button>`).join('');
  } else t = `Your turn: tap a card to play it.<small>${S.trick.length ? `Follow ${SUIT_NAMES[CARD[S.trick[0].card].suit]} if you can.` : 'You lead the trick.'} Bid ${esc(bidText(S.players[0].bid, size))}, won ${S.players[0].won}.</small>`;
  $('status').innerHTML = t; $('actions').innerHTML = acts;
}

// ---- the end ---------------------------------------------------------------------------------------------------------------------
function showFinal() {
  const w = S.winners, order = S.players.map((p, i) => ({ ...p, i })).sort((a, b) => b.score - a.score);
  $('final-title').textContent = w.includes(0) ? (w.length > 1 ? 'You tied for the win!' : 'You win!') : `${S.players[w[0]].name} wins`;
  $('final-body').innerHTML = order.map((p) => `<div class="d-flex justify-content-between border-bottom py-1${w.includes(p.i) ? ' fw-bold text-success' : ''}"><span>${esc(p.name)} ${roleChip(p.role)}</span><span>${p.score} points</span></div>`).join('');
  $('final-body').insertAdjacentHTML('beforeend', '<div id="share-slot"></div>');
  mountShare($('share-slot'), structuredClone(S));
  clearSave(); render();
  if (!$('final').open) $('final').showModal();
}
function mountShare(root, snap) {
  const box = document.createElement('div');
  box.innerHTML = `<h3 class="h6 mt-3">Share your result</h3><div class="d-flex flex-wrap gap-2 my-2"><button type="button" class="btn btn-primary btn-sm" id="share-native" hidden>Share…</button>
    <button type="button" class="btn btn-primary btn-sm" id="share-dl" disabled>Download image</button>
    <button type="button" class="btn btn-outline-secondary btn-sm" id="share-copy">Copy text and link</button></div>
    <img class="il-share-preview" alt="Your result: the final scores" hidden>
    <p class="small text-muted mb-0" id="share-msg" aria-live="polite">Drawing your result picture…</p>`;
  root.appendChild(box);
  const im = box.querySelector('img'), msg = box.querySelector('#share-msg'), dl = box.querySelector('#share-dl'), nat = box.querySelector('#share-native');
  box.querySelector('#share-copy').onclick = async () => { try { await navigator.clipboard.writeText(shareMessage(snap)); msg.textContent = 'Copied. Paste it anywhere.'; } catch { msg.textContent = shareMessage(snap); } };
  (async () => {
    try {
      const blob = await canvasToBlob(drawShareImage(document.createElement('canvas'), snap)), url = URL.createObjectURL(blob);
      im.src = url; im.hidden = false; dl.disabled = false; msg.textContent = '';
      const file = new File([blob], 'illuminate.png', { type: 'image/png' });
      nat.hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
      dl.onclick = () => { const a = document.createElement('a'); a.href = url; a.download = 'illuminate.png'; document.body.appendChild(a); a.click(); a.remove(); };
      nat.onclick = async () => { try { await navigator.share(nativeShareData(file, snap)); } catch { /* cancelled */ } };
    } catch { msg.textContent = 'Sorry, the picture could not be drawn in this browser. You can still copy the text.'; }
  })();
}

// ---- wiring ----------------------------------------------------------------------------------------------------------------------
function onClick(e) {
  const c = (sel) => e.target.closest && e.target.closest(sel);
  const h = c('[data-card]'); if (h) { openCard(h.dataset.card); return; }
  const t = c('[data-table]'); if (t) { openCard(t.dataset.table, true); return; }
  const b = c('[data-do]'); if (b) doDo(b.dataset.do, b.dataset.arg);
}
function init() {
  $('start-btn').addEventListener('click', () => { clearSave(); token++; startGame(); });
  $('menu-btn').addEventListener('click', () => { token++; refreshResume(); show('setup'); });
  $('final-again').addEventListener('click', () => { clearSave(); token++; show('setup'); refreshResume(); });
  $('resume-btn').addEventListener('click', () => { const v = load(); if (!v) return; S = v.S; cfg = v.cfg; ui = { seenTricks: S.tricks, seenHands: S.history.length, hold: false, rotated: null }; show('game'); render(); run(); });
  $('discard-btn').addEventListener('click', () => { clearSave(); refreshResume(); });
  document.addEventListener('click', onClick);
  refreshResume();
  const v = load();
  if (v && params.has('resume')) $('resume-btn').click();
  if (params.has('debug')) window.il = { get S() { return S; }, E, AI, act };
}
function refreshResume() { const v = load(); $('resume').hidden = !v; if (v) { $('bot-count').value = String(v.cfg.bots); $('bot-skill').value = v.cfg.skill; $('my-role').value = v.cfg.role; $('plan').value = v.cfg.plan; $('not-perfect').checked = v.cfg.notPerfect; $('offer-proclaim').checked = v.cfg.offer; } }
init();
