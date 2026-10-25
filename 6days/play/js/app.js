// Six Days: play online against 1 to 5 computer players. You are seat 0.
import * as E from './engine.js';
import * as AI from './ai.js';

const KEY = 'sdg-6d-play-1';
const $ = (id) => document.getElementById(id);
const FAST = location.search.includes('fast');               // ?fast skips the pauses (for testing)
const sleep = (ms) => new Promise((r) => setTimeout(r, FAST ? 1 : ms));
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const img = (id, w = 480) => `../../assets/6days/cards/${id}-${w}.webp`;
const BOTS = ['Peter', 'Mary', 'John', 'Ruth', 'Paul'];

let S = null, cfg = null, token = 0;
let ui = { sel: null, ack: false, recap: [], flash: null, msg: '' };
const mine = () => S.turn === 0 && !S.over && !ui.ack;

function save() { try { localStorage.setItem(KEY, JSON.stringify({ S, cfg, recap: ui.recap })); } catch (e) { /* private mode */ } }
function load() { try { const v = JSON.parse(localStorage.getItem(KEY)); return v && v.S && v.cfg ? v : null; } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
const show = (w) => { $('setup').hidden = w !== 'setup'; $('game').hidden = w !== 'game'; if (w === 'setup') { $('dock').hidden = true; document.body.classList.remove('has-dock'); } window.scrollTo(0, 0); };

// ---- starting --------------------------------------------------------------------------------------------------------------------
function startGame() {
  const n = Number($('bot-count').value), pick = $('bot-skill').value, skills = ['casual', 'steady', 'sharp'];
  cfg = { bots: n, skill: pick, seed: Number(new URLSearchParams(location.search).get('seed')) || Math.floor(Math.random() * 1e9) + 1 };   // ?seed=N replays a deal (for testing)
  const players = [{ name: 'You', bot: false }, ...Array.from({ length: n }, (_, i) => ({ name: BOTS[i], bot: true, skill: pick === 'mixed' ? skills[(i + 1) % 3] : pick }))];
  S = E.newGame({ seed: cfg.seed, players });
  ui = { sel: null, ack: false, recap: [], flash: null, msg: '' };
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
  ui.msg = '';
  if (S.over) { save(); render(); showFinal(); return; }
  if (ui.recap.length) ui.ack = true;                       // look at what the others did, then press Continue
  save(); render();
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
  S = E.play(S, ui.sel, move);
  ui.sel = null; ui.recap = []; ui.flash = { stack: move.type === 'discard' ? null : move.stack, pile: move.type === 'discard' ? move.pile : null }; ui.msg = '';
  save(); render();
  if (S.over) { showFinal(); return; }
  run();
}
function onContinue() { ui.ack = false; ui.recap = []; ui.flash = null; save(); render(); }

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
    const cards = st.cards.map((u) => `<img src="${img(E.DEFS[u].id)}" alt="${esc(E.DEFS[u].name)}" data-zoom="${E.DEFS[u].id}" data-cap="${esc(E.label(u))}" width="1120" height="820" />`).join('')
      + (st.em !== null ? `<img class="em" src="${img(E.DEFS[st.em].id)}" alt="Evening &amp; Morning" data-zoom="${E.DEFS[st.em].id}" data-cap="Evening &amp; Morning" width="1120" height="820" />` : '');
    return `<div class="sp-day${started ? '' : ' is-off'}${tg ? ' is-target' : ''}${fl ? ' is-flash' : ''}" style="--d:${d.color}" ${tg ? `data-stack="${i}" role="button" tabindex="0"` : ''} aria-label="Day ${n}, ${esc(d.name)}${tg ? `, play here for ${tg.pts} point${tg.pts === 1 ? '' : 's'}` : ''}">
      <div class="sp-day-head"><span class="num">Day ${n}</span><span>${esc(d.name)}</span>${state}</div>
      <div class="sp-cards">${cards || '<span class="empty">No cards yet</span>'}</div>${tg ? `<span class="sp-badge">${tg.type === 'close' ? 'Close' : '+' + tg.pts}</span>` : ''}</div>`;
  }).join('');
}
function renderPiles() {
  const t = targets(), drawing = mine() && S.phase === 'draw';
  const back = `<button type="button" class="sp-pile" data-draw="deck" ${drawing && S.draw.length ? '' : 'disabled'} aria-label="Draw pile, ${S.draw.length} cards"><span class="lbl">Draw pile</span><span class="back"><img src="${img('back')}" alt="" /></span><span class="count">${S.draw.length}</span></button>`;
  const piles = S.piles.map((p, i) => {
    const top = p[p.length - 1], tg = t.pile[i], fl = ui.flash && (ui.flash.pile === i || ui.flash.from === i);
    const inner = top !== undefined ? `<img src="${img(E.DEFS[top].id)}" alt="${esc(E.label(top))}" width="1120" height="820" />` : '<span class="gone">Empty</span>';
    return `<button type="button" class="sp-pile${tg ? ' is-target' : ''}${fl ? ' is-flash' : ''}" ${tg ? `data-pile="${i}"` : drawing && top !== undefined ? `data-draw="${i}"` : 'disabled'} aria-label="Discard pile ${i + 1}${top !== undefined ? ', top: ' + esc(E.label(top)) : ', empty'}"><span class="lbl">${tg ? 'Discard here' : 'Discard ' + (i + 1)}</span>${inner}${p.length > 1 ? `<span class="count">${p.length}</span>` : ''}</button>`;
  }).join('');
  $('piles').innerHTML = back + piles;
}
function renderHand() {
  const p = S.players[0], drawn = S.turn === 0 && S.drawn ? S.drawn.uid : null;
  $('hand').innerHTML = p.hand.map((u) => {
    const sel = ui.sel === u, wait = !(mine() && S.phase === 'play');
    return `<button type="button" class="sp-hc${sel ? ' is-sel' : ''}${u === drawn ? ' is-new' : ''}${wait ? ' is-wait' : ''}" data-hand="${u}" aria-pressed="${sel}" aria-label="${esc(E.label(u))}${u === drawn ? ', just drawn' : ''}">
      <img src="${img(E.DEFS[u].id)}" alt="" width="1120" height="820" /><span class="cap">${esc(E.DEFS[u].kind === 'em' ? 'Evening & Morning' : E.DEFS[u].name)}</span>${u === drawn ? '<span class="new">Just drawn</span>' : ''}</button>`;
  }).join('');
}
function renderLog() {
  $('log').innerHTML = S.log.slice(-10).map((l) => `<li class="${l.who === 0 ? 'me' : ''}">${esc(l.text)}</li>`).join('') || '<li>Nothing yet.</li>';
}
function renderDock() {
  const on = !S.over; $('dock').hidden = !on; document.body.classList.toggle('has-dock', on);
  if (!on) return;
  let t = '', acts = '';
  if (ui.ack) {
    t = `<small>${ui.recap.map(esc).join('<br />')}</small>Your turn next.`;
    acts = '<button type="button" class="btn btn-primary" data-do="continue">Continue</button>';
  } else if (S.turn !== 0) t = esc(ui.msg || `${E.me(S).name}'s turn…`);
  else if (S.phase === 'draw') t = esc(ui.msg || 'Your turn. Draw a card: tap the draw pile, or the top card of a discard pile.');
  else if (ui.sel === null) t = esc(ui.msg || `Now play one of your ${S.players[0].hand.length} cards on the days, or discard it. Tap a card to pick it.`);
  else {
    const d = E.DEFS[ui.sel], tg = targets(), good = Object.keys(tg.stack).length;
    t = esc(ui.msg || (good ? `Tap a highlighted day to play ${d.kind === 'em' ? 'Evening & Morning' : d.name}, or a discard pile to discard it.` : `${d.kind === 'em' ? 'Evening & Morning' : d.name} cannot go on the days right now. Tap a discard pile to discard it, or pick another card.`));
    acts = '<button type="button" class="btn btn-outline-secondary btn-sm" data-do="cancel">Put it back</button>';
  }
  $('status').innerHTML = t; $('actions').innerHTML = acts;
}

// ---- the end ----------------------------------------------------------------------------------------------------------------------
function resultText() {
  const w = E.winners(S), mePts = S.players[0].score, won = w.includes(0);
  return won ? `I ${w.length > 1 ? 'tied for the win' : 'won'} Six Days with ${mePts} points against ${S.players.length - 1} computer player${S.players.length > 2 ? 's' : ''}!` : `I scored ${mePts} points in Six Days. ${S.players[w[0]].name} won with ${S.players[w[0]].score}.`;
}
function showFinal() {
  const w = E.winners(S), order = S.players.map((p, i) => ({ ...p, i })).sort((a, b) => b.score - a.score);
  $('final-title').textContent = w.includes(0) ? (w.length > 1 ? 'You tied for the win!' : 'You win!') : `${S.players[w[0]].name} wins`;
  $('final-body').innerHTML = `<p class="small text-muted">${S.endedBy === 'complete' ? `All six days were filled in ${S.round} rounds.` : 'The cards ran out before every day could be filled.'}</p>`
    + order.map((p) => `<div class="sp-final-row${w.includes(p.i) ? ' win' : ''}"><span>${esc(p.name)}</span><span>${p.score} points</span></div>`).join('');
  $('final').showModal();
}

// ---- wiring --------------------------------------------------------------------------------------------------------------------------
function onClick(e) {
  const z = e.target.closest && e.target.closest('[data-zoom]');
  const stack = e.target.closest && e.target.closest('[data-stack]'), pile = e.target.closest && e.target.closest('[data-pile]');
  if (stack) { onTarget('stack', Number(stack.dataset.stack)); return; }
  if (pile) { onTarget('pile', Number(pile.dataset.pile)); return; }
  if (z) { $('zoom-img').src = img(z.dataset.zoom, 960); $('zoom-img').alt = z.dataset.cap; $('zoom-cap').textContent = z.dataset.cap; $('zoom').showModal(); return; }
  const d = e.target.closest && e.target.closest('[data-draw]'); if (d) { onDraw(d.dataset.draw === 'deck' ? 'deck' : Number(d.dataset.draw)); return; }
  const h = e.target.closest && e.target.closest('[data-hand]'); if (h) { onHand(Number(h.dataset.hand)); return; }
  const b = e.target.closest && e.target.closest('[data-do]'); if (!b) return;
  if (b.dataset.do === 'continue') onContinue(); else if (b.dataset.do === 'cancel') { ui.sel = null; render(); }
}
function init() {
  $('start-btn').addEventListener('click', () => { clearSave(); token++; startGame(); });
  document.addEventListener('click', (e) => { if ($('game').hidden) return; onClick(e); });
  document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-stack]')) { e.preventDefault(); onClick(e); } });
  $('menu-btn').addEventListener('click', () => { if (S && !S.over && !confirm('Leave this game? It will be lost.')) return; token++; clearSave(); S = null; show('setup'); $('resume').hidden = true; });
  $('final-again').addEventListener('click', () => { token++; clearSave(); S = null; show('setup'); $('resume').hidden = true; });
  $('final-share').addEventListener('click', async () => {
    const text = `${resultText()} https://sdggames.fun/6days/`;
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); $('final-share').textContent = 'Copied'; } } catch (e) { /* cancelled */ }
  });
  const saved = load();
  if (saved && !saved.S.over) {
    $('resume').hidden = false;
    $('resume-text').textContent = `You have a game in progress (round ${saved.S.round}).`;
    $('resume-btn').addEventListener('click', () => {
      S = saved.S; cfg = saved.cfg; ui = { sel: null, ack: false, recap: saved.recap || [], flash: null, msg: '' };
      show('game'); render();
      if (S.turn !== 0) run(); else if (ui.recap.length) { ui.ack = true; render(); }
    });
    $('discard-btn').addEventListener('click', () => { clearSave(); $('resume').hidden = true; });
  }
}
init();
if (location.search.includes('debug')) window.sixdays = { get S() { return S; }, E, AI, render };   // test hook
