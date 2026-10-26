// Six Days, pass and play: 2 to 6 people share one phone (computer players can fill empty seats). Between turns the phone says who should
// hold it and keeps their hand hidden until they are ready. The days and the discard piles are public, as at a table.
import * as E from './engine.js';
import * as AI from './ai.js';
import { drawShareImage, canvasToBlob, nativeShareData, shareMessage } from './share.js';

const KEY = 'sdg-6d-pass-1';
const $ = (id) => document.getElementById(id);
const FAST = location.search.includes('fast');               // ?fast skips the pauses (for testing)
const sleep = (ms) => new Promise((r) => setTimeout(r, FAST ? 1 : ms));
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const img = (id, w = 480) => `../../assets/6days/cards/${id}-${w}.webp`;
const BOTS = ['Peter', 'Mary', 'John', 'Ruth', 'Paul'];

let S = null, cfg = null, token = 0;
let ui = { sel: null, viewer: null, recap: [], flash: null, msg: '', undo: null };
const human = (i) => !S.players[i].bot;
const mine = () => !S.over && human(S.turn) && ui.viewer === S.turn;       // the person holding the phone is the one whose turn it is

function save() { try { localStorage.setItem(KEY, JSON.stringify({ S, cfg, recap: ui.recap })); } catch (e) { /* private mode */ } }
function load() { try { const v = JSON.parse(localStorage.getItem(KEY)); return v && v.S && v.cfg ? v : null; } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
const show = (w) => { $('setup').hidden = w !== 'setup'; $('game').hidden = w !== 'game'; if (w === 'setup') { $('dock').hidden = true; document.body.classList.remove('has-dock'); } window.scrollTo(0, 0); };

// ---- starting --------------------------------------------------------------------------------------------------------------------
function startGame() {
  const people = Number($('humans').value), n = Number($('bot-count').value), pick = $('bot-skill').value, skills = ['casual', 'steady', 'sharp'];
  const names = [...document.querySelectorAll('#names input')].map((el, i) => el.value.trim() || `Player ${i + 1}`);
  cfg = { people, bots: n, skill: pick, seed: Number(new URLSearchParams(location.search).get('seed')) || Math.floor(Math.random() * 1e9) + 1 };   // ?seed=N replays a deal (for testing)
  const players = [...names.slice(0, people).map((name) => ({ name, bot: false })), ...Array.from({ length: n }, (_, i) => ({ name: BOTS[i], bot: true, skill: pick === 'mixed' ? skills[(i + 1) % 3] : pick }))];
  S = E.newGame({ seed: cfg.seed, players });
  ui = { sel: null, viewer: null, recap: [], flash: null, msg: '', undo: null };
  save(); show('game'); render();
}

// ---- the computer players ------------------------------------------------------------------------------------------------
async function run() {
  const my = ++token;
  while (!S.over && E.me(S).bot) {
    const p = E.me(S);
    ui.msg = `${p.name} is playing…`; ui.flash = null; render();
    await sleep(900); if (my !== token) return;
    S = E.draw(S, AI.chooseDraw(S, p.skill));
    ui.flash = { from: S.drawn.from }; render();
    await sleep(750); if (my !== token) return;
    const { uid, move } = AI.choosePlay(S, p.skill);
    S = E.play(S, uid, move);
    ui.recap.push(S.last.text); ui.flash = { stack: S.last.type === 'discard' ? null : S.last.stack, pile: S.last.type === 'discard' ? S.last.pile : null };
    save(); render();
    await sleep(700); if (my !== token) return;
  }
  ui.msg = ''; ui.viewer = null;
  if (S.over) { save(); render(); showFinal(); return; }
  save(); render();                                          // the next person is asked to pick up the phone
}

// ---- your turn -----------------------------------------------------------------------------------------------------------------
function onDraw(src) {
  if (!mine() || S.phase !== 'draw') return;
  if (src === 'deck' ? !S.draw.length : !S.piles[src].length) return;
  S = E.draw(S, src); ui.sel = null; ui.flash = null; ui.msg = '';
  save(); render();
}
function onHand(uid) {
  if (!mine() || S.phase !== 'play') return;
  ui.sel = ui.sel === uid ? null : uid; ui.msg = '';
  render();
}
function onTarget(kind, i) {
  if (!mine() || S.phase !== 'play' || ui.sel === null) return;
  const ms = E.moves(S, ui.sel);
  const move = kind === 'stack' ? ms.find((m) => m.type !== 'discard' && m.stack === i) : ms.find((m) => m.type === 'discard' && m.pile === i);
  if (!move) { ui.msg = kind === 'stack' ? `That card cannot go on Day ${i + 1}.` : ''; render(); return; }
  const before = structuredClone(S);                          // so the move can be taken back before the next person picks up the phone
  S = E.play(S, ui.sel, move);
  ui.sel = null; ui.flash = { stack: move.type === 'discard' ? null : move.stack, pile: move.type === 'discard' ? move.pile : null }; ui.msg = '';
  ui.recap = [S.last.text]; ui.viewer = null;
  ui.undo = !S.over && !E.me(S).bot ? { S: before, who: S.last.who } : null;
  save(); render();
  if (S.over) { showFinal(); return; }
  if (E.me(S).bot) run();
}
function onReady() { ui.viewer = S.turn; ui.recap = []; ui.flash = null; ui.undo = null; ui.sel = null; render(); }
function onUndo() { if (!ui.undo) return; S = ui.undo.S; ui.viewer = ui.undo.who; ui.undo = null; ui.recap = []; ui.sel = null; ui.flash = null; save(); render(); }
function openZoom(z) { $('zoom-img').src = img(z.dataset.zoom, 960); $('zoom-img').alt = z.dataset.cap; $('zoom-cap').textContent = z.dataset.cap; $('zoom').showModal(); }

// ---- drawing the page -----------------------------------------------------------------------------------------------------------
function render() {
  if (!S) return;
  renderBar(); renderDays(); renderPiles(); renderHand(); renderLog(); renderDock();
}
function renderBar() {
  $('bar').innerHTML = S.players.map((p, i) => `<div class="sp-score${i === S.turn && !S.over ? ' is-turn' : ''}"><span class="n">${esc(p.name)}</span><span class="pts">${p.score}</span></div>`).join('')
    + `<div class="sp-round">Round ${S.round}<br /><small>${E.fullCount(S)} of 6 days full</small></div>`;
}
function targets() {
  const t = { stack: {}, pile: {} };
  if (mine() && S.phase === 'play' && ui.sel !== null) for (const m of E.moves(S, ui.sel)) { if (m.type === 'discard') t.pile[m.pile] = m; else t.stack[m.stack] = m; }
  return t;
}
function renderDays() {
  const t = targets();
  $('days').innerHTML = E.DAYS.map((d, i) => {
    const st = S.stacks[i], n = i + 1, started = i < S.started, full = E.isFull(S, i), closed = E.isClosed(S, i), tg = t.stack[i], fl = ui.flash && ui.flash.stack === i;
    const state = closed ? '<span class="state ok">Closed ✓</span>' : full ? '<span class="state ok">Full: needs Evening &amp; Morning</span>'
      : started ? `<span class="state">${st.cards.length} of ${n} cards</span>` : i === S.started ? `<span class="state">Next: needs a Day ${n} card</span>` : '<span class="state">Not started</span>';
    const fig = (u, cls = '') => `<figure class="sp-c${cls}"><img src="${img(E.DEFS[u].id)}" alt="${esc(E.label(u))}" data-zoom="${E.DEFS[u].id}" data-cap="${esc(E.label(u))}" width="1120" height="820" /><figcaption>${esc(E.DEFS[u].kind === 'em' ? 'Evening & Morning' : E.DEFS[u].name)}</figcaption></figure>`;
    const cards = st.cards.map((u) => fig(u)).join('') + (st.em !== null ? fig(st.em, ' em') : '');
    return `<div class="sp-day${started ? '' : ' is-off'}${tg ? ' is-target' : ''}${fl ? ' is-flash' : ''}" style="--d:${d.color}" ${tg ? `data-stack="${i}" role="button" tabindex="0"` : ''} aria-label="Day ${n}, ${esc(d.name)}${tg ? `, play here for ${tg.pts} point${tg.pts === 1 ? '' : 's'}` : ''}">
      <div class="sp-day-head"><span class="num">Day ${n}</span><span>${esc(d.name)}</span>${state}</div>
      <div class="sp-cards">${cards || '<span class="empty">No cards yet</span>'}</div>${tg ? `<span class="sp-badge">${tg.type === 'close' ? 'Close' : '+' + tg.pts}</span>` : ''}</div>`;
  }).join('');
}
const zoomBtn = (uid) => `<span class="sp-zoombtn" role="button" tabindex="0" data-zoom="${E.DEFS[uid].id}" data-cap="${esc(E.label(uid))}" aria-label="Enlarge ${esc(E.label(uid))}">\u2922</span>`;
function renderPiles() {
  const t = targets(), drawing = mine() && S.phase === 'draw';
  const back = `<button type="button" class="sp-pile" data-draw="deck" ${drawing && S.draw.length ? '' : 'disabled'} aria-label="Draw pile, ${S.draw.length} cards"><span class="lbl">Draw pile</span><span class="back"><img src="${img('back')}" alt="" /></span><span class="count">${S.draw.length}</span><span class="cap">${drawing ? 'Face down: tap to draw' : 'Face down'}</span></button>`;
  const piles = S.piles.map((p, i) => {
    const top = p[p.length - 1], tg = t.pile[i], fl = ui.flash && (ui.flash.pile === i || ui.flash.from === i);
    const inner = top !== undefined ? `<img src="${img(E.DEFS[top].id)}" alt="${esc(E.label(top))}" width="1120" height="820" />${zoomBtn(top)}` : '<span class="gone">Empty</span>';
    const cap = top !== undefined ? (E.DEFS[top].kind === 'em' ? 'Evening & Morning' : `${E.DEFS[top].name} (Day ${E.DEFS[top].day})`) : '';
    return `<button type="button" class="sp-pile${tg ? ' is-target' : ''}${fl ? ' is-flash' : ''}" ${tg ? `data-pile="${i}"` : drawing && top !== undefined ? `data-draw="${i}"` : 'disabled'} aria-label="Discard pile ${i + 1}${top !== undefined ? ', top: ' + esc(E.label(top)) : ', empty'}"><span class="lbl">${tg ? 'Discard here' : 'Discard ' + (i + 1)}</span>${inner}${p.length > 1 ? `<span class="count">${p.length}</span>` : ''}<span class="cap">${esc(cap)}</span></button>`;
  }).join('');
  $('piles').innerHTML = back + piles;
}
function renderHand() {
  const p = S.players[S.turn], shown = !S.over && human(S.turn) && ui.viewer === S.turn, drawn = shown && S.drawn ? S.drawn.uid : null;
  $('hand-title').textContent = S.over ? 'Hands' : `${p.name}'s hand`;
  if (!shown) { $('hand').innerHTML = `<p class="sp-hidden">${S.over ? '' : human(S.turn) ? `Hidden until ${esc(p.name)} is ready.` : `${esc(p.name)} is a computer player.`}</p>`; return; }
  $('hand').innerHTML = p.hand.map((u) => {
    const sel = ui.sel === u, wait = !(mine() && S.phase === 'play');
    return `<button type="button" class="sp-hc${sel ? ' is-sel' : ''}${u === drawn ? ' is-new' : ''}${wait ? ' is-wait' : ''}" data-hand="${u}" aria-pressed="${sel}" aria-label="${esc(E.label(u))}${u === drawn ? ', just drawn' : ''}">
      <img src="${img(E.DEFS[u].id)}" alt="" width="1120" height="820" /><span class="cap">${esc(E.DEFS[u].kind === 'em' ? 'Evening & Morning' : `${E.DEFS[u].name} (Day ${E.DEFS[u].day})`)}</span>${zoomBtn(u)}${u === drawn ? '<span class="new">Just drawn</span>' : ''}</button>`;
  }).join('');
}
function renderLog() {
  $('log').innerHTML = S.log.slice(-10).map((l) => `<li>${esc(l.text)}</li>`).join('') || '<li>Nothing yet.</li>';
}
function renderDock() {
  const on = !S.over; $('dock').hidden = !on; document.body.classList.toggle('has-dock', on);
  if (!on) return;
  const p = E.me(S), nm = esc(p.name);
  let t = '', acts = '';
  if (p.bot) t = esc(ui.msg || `${p.name} is playing\u2026`);
  else if (ui.viewer !== S.turn) {                          // between turns: who should pick the phone up
    t = `${ui.recap.length ? `<small>${ui.recap.map(esc).join('<br />')}</small>` : ''}Pass the phone to ${nm}.`;
    acts = `${ui.undo ? `<button type="button" class="btn btn-outline-secondary btn-sm" data-do="undo">Undo ${esc(S.players[ui.undo.who].name)}'s move</button>` : ''}<button type="button" class="btn btn-primary" data-do="ready">I'm ${nm} \u2014 show me</button>`;
  } else if (S.phase === 'draw') t = esc(ui.msg || `${p.name}: draw a card. Tap the draw pile, or the top card of a discard pile.`);
  else if (ui.sel === null) t = esc(ui.msg || `${p.name}: play one of your ${p.hand.length} cards on the days, or discard it. Tap a card to pick it.`);
  else {
    const d = E.DEFS[ui.sel], tg = targets(), good = Object.keys(tg.stack).length;
    t = esc(ui.msg || (good ? `Tap a highlighted day to play ${d.kind === 'em' ? 'Evening & Morning' : d.name}, or a discard pile to discard it.` : `${d.kind === 'em' ? 'Evening & Morning' : d.name} cannot go on the days right now. Tap a discard pile to discard it, or pick another card.`));
    acts = '<button type="button" class="btn btn-outline-secondary btn-sm" data-do="cancel">Put it back</button>';
  }
  $('status').innerHTML = t; $('actions').innerHTML = acts;
}

// ---- the end ----------------------------------------------------------------------------------------------------------------------
function showFinal() {
  const w = E.winners(S), order = S.players.map((p, i) => ({ ...p, i })).sort((a, b) => b.score - a.score);
  $('final-title').textContent = w.length > 1 ? `${w.map((i) => S.players[i].name).join(' and ')} tie for the win!` : `${S.players[w[0]].name} wins!`;
  $('final-body').innerHTML = `<p class="small text-muted">${S.endedBy === 'complete' ? `All six days were filled in ${S.round} rounds.` : 'The cards ran out before every day could be filled.'}</p>`
    + order.map((p) => `<div class="sp-final-row${w.includes(p.i) ? ' win' : ''}"><span>${esc(p.name)}</span><span>${p.score} points</span></div>`).join('');
  mountShare($('final-body'), structuredClone(S));
  $('final').showModal();
}

// Share the result as a picture: the share sheet where the browser offers it, plus a download and copyable text.
async function mountShare(root, snapshot) {
  const box = document.createElement('div');
  box.className = 'sp-share';
  box.innerHTML = `<div class="d-flex flex-wrap gap-2 my-2"><button type="button" class="btn btn-primary btn-sm" id="share-dl" disabled>Download image</button>
    <button type="button" class="btn btn-outline-primary btn-sm" id="share-native" hidden>Share\u2026</button>
    <button type="button" class="btn btn-outline-secondary btn-sm" id="share-copy">Copy text</button></div>
    <img class="sp-share-preview" alt="Your result: the six days and the scores" hidden>
    <p class="small text-muted mb-0" id="share-msg" aria-live="polite">Drawing your result picture\u2026</p>`;
  root.appendChild(box);
  const im = box.querySelector('img'), msg = box.querySelector('#share-msg'), dl = box.querySelector('#share-dl'), nat = box.querySelector('#share-native'), copy = box.querySelector('#share-copy');
  copy.onclick = async () => { try { await navigator.clipboard.writeText(shareMessage(snapshot, true)); msg.textContent = 'Copied. Paste it anywhere.'; } catch { msg.textContent = shareMessage(snapshot, true); } };
  try {
    const canvas = await drawShareImage(document.createElement('canvas'), snapshot, { imgBase: (id) => img(id, 480), names: snapshot.players.map((p) => p.name), table: true });
    const blob = await canvasToBlob(canvas), url = URL.createObjectURL(blob);
    im.src = url; im.hidden = false; dl.disabled = false; msg.textContent = '';
    const file = new File([blob], 'six-days.png', { type: 'image/png' });
    nat.hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    dl.onclick = () => { const a = document.createElement('a'); a.href = url; a.download = 'six-days.png'; document.body.appendChild(a); a.click(); a.remove(); };
    nat.onclick = async () => { try { await navigator.share(nativeShareData(file, snapshot, true)); } catch { /* cancelled */ } };
  } catch { msg.textContent = 'Sorry, the picture could not be drawn in this browser. You can still copy the text.'; }
}

// ---- wiring --------------------------------------------------------------------------------------------------------------------------
function onClick(e) {
  const z = e.target.closest && e.target.closest('[data-zoom]');
  if (z && z.classList.contains('sp-zoombtn')) { e.preventDefault(); openZoom(z); return; }
  const stack = e.target.closest && e.target.closest('[data-stack]'), pile = e.target.closest && e.target.closest('[data-pile]');
  if (stack) { onTarget('stack', Number(stack.dataset.stack)); return; }
  if (pile) { onTarget('pile', Number(pile.dataset.pile)); return; }
  if (z) { openZoom(z); return; }
  const d = e.target.closest && e.target.closest('[data-draw]'); if (d) { onDraw(d.dataset.draw === 'deck' ? 'deck' : Number(d.dataset.draw)); return; }
  const h = e.target.closest && e.target.closest('[data-hand]'); if (h) { onHand(Number(h.dataset.hand)); return; }
  const b = e.target.closest && e.target.closest('[data-do]'); if (!b) return;
  if (b.dataset.do === 'ready') onReady(); else if (b.dataset.do === 'undo') onUndo(); else if (b.dataset.do === 'cancel') { ui.sel = null; render(); }
}
function names() {
  const people = Number($('humans').value), keep = [...document.querySelectorAll('#names input')].map((el) => el.value);
  $('names').innerHTML = Array.from({ length: people }, (_, i) => `<div class="col-6 col-sm-4"><input class="form-control form-control-sm" maxlength="14" aria-label="Player ${i + 1} name" value="${esc(keep[i] || `Player ${i + 1}`)}"></div>`).join('');
  const room = 6 - people, sel = $('bot-count'), cur = Math.min(Number(sel.value || 0), room);
  sel.innerHTML = Array.from({ length: room + 1 }, (_, i) => `<option value="${i}">${i ? `${i} computer player${i > 1 ? 's' : ''}` : 'None'}</option>`).join(''); sel.value = String(cur);
  $('skill-wrap').hidden = cur === 0;
}
function init() {
  $('humans').addEventListener('change', names); $('bot-count').addEventListener('change', () => { $('skill-wrap').hidden = $('bot-count').value === '0'; }); names();
  $('start-btn').addEventListener('click', () => { clearSave(); token++; startGame(); });
  document.addEventListener('click', (e) => { if ($('game').hidden) return; onClick(e); });
  document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-stack], .sp-zoombtn')) { e.preventDefault(); onClick(e); } });
  $('menu-btn').addEventListener('click', () => { if (S && !S.over && !confirm('Leave this game? It will be lost.')) return; token++; clearSave(); S = null; show('setup'); $('resume').hidden = true; });
  $('final-again').addEventListener('click', () => { token++; clearSave(); S = null; show('setup'); $('resume').hidden = true; });
  const saved = load();
  if (saved && !saved.S.over) {
    $('resume').hidden = false;
    $('resume-text').textContent = `You have a game in progress (round ${saved.S.round}).`;
    $('resume-btn').addEventListener('click', () => {
      S = saved.S; cfg = saved.cfg; ui = { sel: null, viewer: null, recap: saved.recap || [], flash: null, msg: '', undo: null };
      show('game'); render();
      if (E.me(S).bot) run();
    });
    $('discard-btn').addEventListener('click', () => { clearSave(); $('resume').hidden = true; });
  }
}
init();
if (location.search.includes('debug')) window.sixdays = { get S() { return S; }, E, AI, render };   // test hook
