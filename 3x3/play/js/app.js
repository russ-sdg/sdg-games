// Three-by-Three: play online against 1 to 5 computer players. You are seat 0.
import * as E from './engine.js';
import * as AI from './ai.js';

const KEY = 'sdg-3x3-play-1', MEM = 'sdg-3x3-memory';
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const FAST = params.has('fast');                                // ?fast skips the computers' pauses (for testing)
const sleep = (ms) => new Promise((r) => setTimeout(r, FAST ? 1 : ms));
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BOTS = ['Peter', 'Mary', 'John', 'Ruth', 'Paul'];
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

let S = null, cfg = null, token = 0;
let ui = { flash: null, msg: '' };
const mine = () => !!S && !S.over && S.turn === 0;
const tribe = (v) => `${v}. ${E.name(v)}`;

function save() { try { localStorage.setItem(KEY, JSON.stringify({ S, cfg })); } catch (e) { /* private mode */ } }
function load() { try { const v = JSON.parse(localStorage.getItem(KEY)); return v && v.S && v.S.v === 1 && v.cfg && !v.S.over ? v : null; } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
const memoryOn = () => $('memory2').checked;
const show = (w) => { $('setup').hidden = w !== 'setup'; $('game').hidden = w !== 'game'; if (w === 'setup') { $('dock').hidden = true; document.body.classList.remove('has-dock'); } window.scrollTo(0, 0); };

// ---- starting --------------------------------------------------------------------------------------------------------------------
function startGame() {
  const n = Number($('bot-count').value), pick = $('bot-skill').value, skills = ['casual', 'steady', 'sharp'];
  const seed = Number(params.get('seed')) || Math.floor(Math.random() * 1e9) + 1;      // ?seed=N replays a deal (for testing)
  const players = [{ name: 'You', bot: false }, ...Array.from({ length: n }, (_, i) => ({ name: BOTS[i], bot: true, skill: pick === 'mixed' ? skills[(i + 1) % 3] : pick }))];
  cfg = { bots: n, skill: pick, seed };
  S = E.newGame({ seed, players, first: Math.floor(E.rng(seed + 1)() * players.length) });
  ui = { flash: null, msg: '' };
  save(); show('game'); render(); run();
}

// ---- the computer players --------------------------------------------------------------------------------------------------------
async function run() {
  const my = ++token;
  while (!S.over && E.me(S).bot) {
    const p = E.me(S), seat = S.turn;
    ui.msg = `${p.name} is playing…`; ui.flash = null; render();
    await sleep(900); if (my !== token) return;
    if (!S.reveals.length) S = AI.forget(S, seat, p.skill, Math.random);
    while (!S.outcome) {
      const a = AI.nextAction(S, p.skill);
      S = E.reveal(S, a);
      ui.flash = a; ui.msg = `${p.name} is playing…`; save(); render();
      await sleep(1100); if (my !== token) return;
    }
    ui.msg = S.outcome === 'set' ? `${p.name} found a set of ${E.name(S.reveals[0].v)}!` : `${p.name} did not find a set. Every card goes back.`;
    render(); await sleep(S.outcome === 'set' ? 1900 : 1500); if (my !== token) return;
    S = E.endTurn(S); ui.flash = null; ui.msg = ''; save(); render();
  }
  ui.msg = ''; ui.flash = null; save(); render();
  if (S.over) showFinal();
}

// ---- your turn -------------------------------------------------------------------------------------------------------------------
function doReveal(a) {
  if (!mine() || S.outcome) return;
  const ok = E.actions(S).some((x) => x.kind === a.kind && (a.kind === 'cell' ? x.i === a.i : x.p === a.p && x.which === a.which));
  if (!ok) return;
  S = E.reveal(S, a); ui.flash = null; ui.msg = '';
  save(); render();
}
function onContinue() {
  if (!mine() || !S.outcome) return;
  S = E.endTurn(S); ui.msg = ''; ui.flash = null;
  save(); render();
  if (S.over) { showFinal(); return; }
  run();
}

// ---- words -----------------------------------------------------------------------------------------------------------------------
const nm = (p) => S.players[p].name;
const verb = (who, v) => (who === 0 ? v : v + 's');
const poss = (p) => (p === 0 ? 'your' : 'their');
const rowName = (i) => { const r = Math.floor(i / E.COLS), c = i % E.COLS, rows = Math.ceil(S.matrix.length / E.COLS); const rn = rows === 3 ? ['top', 'middle', 'bottom'][r] : `row ${r + 1}`; return `${rn} ${['left', 'center', 'right'][c]}`; };
function said(e) {
  const W = nm(e.who ?? 0);
  switch (e.t) {
    case 'ask': return e.from === e.who ? `${W} ${verb(e.who, 'show')} ${poss(e.who)} ${e.which === 'hi' ? 'highest' : 'lowest'} card: ${tribe(e.v)}.` : `${W} ${verb(e.who, 'ask')} ${nm(e.from)} to show ${poss(e.from)} ${e.which === 'hi' ? 'highest' : 'lowest'} card: ${tribe(e.v)}.`;
    case 'flip': return `${W} ${verb(e.who, 'turn')} over the ${rowName(e.cell)} card in the matrix: ${tribe(e.v)}.`;
    case 'miss': return `${W} ${e.who === 0 ? 'did' : 'did'} not find a set.`;
    case 'set': return `${W} ${verb(e.who, 'collect')} a set of ${E.name(e.v)}!`;
    case 'more': return `No set can be found, so ${e.n} more cards go into the matrix (${e.size} cards now).`;
    default: return '';
  }
}

// ---- drawing the page ------------------------------------------------------------------------------------------------------------
function render() {
  if (!S) return;
  renderBar(); renderOpps(); renderMatrix(); renderMe(); renderLog(); renderDock();
}
const shownAt = (kind, a, b) => S.reveals.findIndex((x) => x.kind === kind && (kind === 'cell' ? x.i === a : x.p === a && x.idx === b));
const matched = () => S.reveals.length >= 2 && E.matching(S);
function cardClasses(r) { return r >= 0 ? ` is-up${matched() ? ' is-match' : ''}` : ''; }

function renderBar() {
  $('bar').innerHTML = S.players.map((p, i) => `<div class="tt-score${i === S.turn && !S.over ? ' is-turn' : ''}"><span class="n">${esc(p.name)}</span><span class="tt-pips" aria-label="${plural(p.sets.length, 'set')} of ${E.SETS_TO_WIN}">${'●'.repeat(p.sets.length)}${'○'.repeat(Math.max(0, E.SETS_TO_WIN - p.sets.length))}</span></div>`).join('')
    + `<div class="tt-round">Round ${S.round}<br /><small>${S.draw.length ? `${plural(S.draw.length, 'card')} in the draw pile` : 'Draw pile empty'}</small></div>`;
}
function wonHtml(p) {
  return p.sets.map((v) => `<figure><img src="${E.cardImage(v, 320)}" alt="Set of ${E.name(v)}" data-zoom="${v}" /><figcaption>${tribe(v)} ×3</figcaption></figure>`).join('');
}
// One player's cards. `own` shows their faces to you; others are face down until shown.
function handHtml(p, { own }) {
  const hand = S.players[p].hand, can = mine() && !S.outcome;
  const ends = E.ends(S, p);
  return `<div class="tt-hand">${hand.map((v, idx) => {
    const r = shownAt('hand', p, idx), up = r >= 0;
    const rank = hand.length === 3 ? ['lowest', 'middle', 'highest'][idx] : (idx === 0 ? 'lowest' : idx === hand.length - 1 ? 'highest' : '');
    const mem = !own && !up && memoryOn() && S.know[0][`h:${p}:${idx}`];
    const face = own || up;
    const fl = ui.flash && ui.flash.kind === 'hand' && ui.flash.p === p && ui.flash.idx === idx ? ' is-flash' : '';
    return `<div class="tt-slot"><span class="rank">${rank}</span><div class="tt-c${cardClasses(r)}${fl}" ${face ? `data-zoom="${v}" role="img" aria-label="${esc(tribe(v))}"` : `role="img" aria-label="Face down card, ${rank}"`}>
      <img src="${face ? E.cardImage(v, 320) : E.backImage(320)}" alt="" />${up && own ? '<span class="tt-shown">shown</span>' : ''}${mem ? `<span class="tt-mem">${mem}</span>` : ''}</div></div>`;
  }).join('')}</div>`
    + (hand.length ? `<div class="tt-ask">${can ? `<button type="button" class="btn btn-outline-primary" data-ask="${p}:hi"${ends.hi === null ? ' disabled' : ''}>${own ? 'Show my highest' : 'Ask for highest'}</button><button type="button" class="btn btn-outline-primary" data-ask="${p}:lo"${ends.lo === null ? ' disabled' : ''}>${own ? 'Show my lowest' : 'Ask for lowest'}</button>` : ''}</div>` : '<p class="small text-muted mb-0">No cards left in hand.</p>');
}
function renderOpps() {
  $('opps').innerHTML = S.players.slice(1).map((pl, k) => {
    const j = k + 1;
    return `<div class="tt-opp${j === S.turn && !S.over ? ' is-turn' : ''}">
      <div class="tt-opp-head"><span>${esc(pl.name)}</span><span>${plural(pl.sets.length, 'set')}</span><span class="meta">${pl.skill || ''}</span></div>
      ${handHtml(j, { own: false })}
      <div class="tt-won">${wonHtml(pl) || '<span class="none">No sets yet</span>'}</div></div>`;
  }).join('');
}
function renderMatrix() {
  const can = mine() && !S.outcome;
  $('matrix').innerHTML = S.matrix.map((v, i) => {
    if (v === null) return '<div class="tt-c hole" aria-label="Empty"></div>';
    const r = shownAt('cell', i), up = r >= 0, mem = !up && memoryOn() && S.know[0][`c:${i}`];
    const fl = ui.flash && ui.flash.kind === 'cell' && ui.flash.i === i ? ' is-flash' : '';
    const label = up ? tribe(v) : `Face down card, ${rowName(i)}`;
    return `<button type="button" class="tt-c${cardClasses(r)}${fl}${can && !up ? ' can' : ''}" ${can && !up ? `data-flip="${i}"` : up ? `data-zoom="${v}"` : 'disabled'} aria-label="${esc(label)}">
      <img src="${up ? E.cardImage(v, 320) : E.backImage(320)}" alt="" />${mem ? `<span class="tt-mem">${mem}</span>` : ''}</button>`;
  }).join('');
  $('matrix-note').textContent = S.matrix.length > 9 ? `${S.matrix.filter((c) => c !== null).length} cards` : '';
}
function renderMe() {
  const p = S.players[0];
  $('me').className = `tt-me${S.turn === 0 && !S.over ? ' is-turn' : ''}`;
  $('me').innerHTML = `<div class="small text-muted mb-1">Your cards, lowest to highest. Only you can see them until you show one.</div>${handHtml(0, { own: true })}
    <div class="tt-won">${wonHtml(p) || '<span class="none">No sets yet</span>'}</div>`;
}
function renderLog() {
  $('log').innerHTML = S.log.slice(-14).map((e) => `<li class="${e.who === 0 ? 'me' : e.t === 'more' ? 'note' : ''}">${esc(said(e))}</li>`).join('') || '<li>Nothing yet.</li>';
}
function renderDock() {
  const on = !S.over; $('dock').hidden = !on; document.body.classList.toggle('has-dock', on);
  if (!on) return;
  const R = S.reveals;
  let t = '', acts = '';
  if (S.turn !== 0) t = esc(ui.msg || `${E.me(S).name}'s turn…`);
  else if (S.outcome === 'set') {
    t = `You found a set of ${esc(E.name(R[0].v))}!<small>Take it. Cards are replaced from the draw pile.</small>`;
    acts = '<button type="button" class="btn btn-primary" data-do="continue">Take the set</button>';
  } else if (S.outcome === 'miss') {
    t = R.length === 2 ? `${esc(tribe(R[0].v))} and ${esc(tribe(R[1].v))} don't match.` : `The third card is ${esc(tribe(R[2].v))}. No set.`;
    t += '<small>Take a good look: every card goes back where it was.</small>';
    acts = '<button type="button" class="btn btn-primary" data-do="continue">OK, next player</button>';
  } else if (!R.length) t = 'Your turn. Turn over a card: flip one in the matrix, or ask anyone (even yourself) to show their highest or lowest card.';
  else if (R.length === 1) t = `You have ${esc(tribe(R[0].v))}. Now turn over a second card.`;
  else t = `They match: ${esc(E.name(R[0].v))}! Turn over a third to make a set.`;
  $('status').innerHTML = t; $('actions').innerHTML = acts;
}

// ---- the end ---------------------------------------------------------------------------------------------------------------------
function showFinal() {
  const w = S.winners, order = S.players.map((p, i) => ({ ...p, i })).sort((a, b) => b.sets.length - a.sets.length);
  $('final-title').textContent = w.includes(0) ? (w.length > 1 ? 'You tied for the win!' : 'You win!') : `${S.players[w[0]].name} wins`;
  const why = { sets: 'collected three sets of three', levi: 'collected all three Levi cards', stalemate: 'No more sets could be found, so the player with the most sets wins.', limit: 'The game ran very long, so the player with the most sets wins.' }[S.endedBy];
  $('final-body').innerHTML = `<p class="small text-muted">${S.endedBy === 'sets' || S.endedBy === 'levi' ? `${esc(S.players[w[0]].name)} ${why}.` : why}</p>`
    + order.map((p) => `<div class="tt-final-row${w.includes(p.i) ? ' win' : ''}"><span>${esc(p.name)}</span><span>${plural(p.sets.length, 'set')}</span></div><div class="tt-final-sets">${p.sets.map((v) => `<img src="${E.cardImage(v, 320)}" alt="${esc(E.name(v))}" title="${esc(tribe(v))}" />`).join('')}</div>`).join('');
  $('final').showModal();
}
function openZoom(v) { $('zoom-img').src = E.cardImage(v, 640); $('zoom-img').alt = tribe(v); $('zoom-cap').textContent = tribe(v); $('zoom').showModal(); }

// ---- wiring ----------------------------------------------------------------------------------------------------------------------
function onClick(e) {
  const c = (sel) => e.target.closest && e.target.closest(sel);
  const f = c('[data-flip]'); if (f) { doReveal({ kind: 'cell', i: Number(f.dataset.flip) }); return; }
  const a = c('[data-ask]'); if (a) { const [p, which] = a.dataset.ask.split(':'); doReveal({ kind: 'hand', p: Number(p), which }); return; }
  const b = c('[data-do]'); if (b) { if (b.dataset.do === 'continue') onContinue(); return; }
  const z = c('[data-zoom]'); if (z) openZoom(Number(z.dataset.zoom));
}
function setMemory(on) {
  $('memory').checked = $('memory2').checked = on;
  try { localStorage.setItem(MEM, on ? '1' : '0'); } catch (e) { /* ignore */ }
  if (S) { renderOpps(); renderMatrix(); }
}
function init() {
  try { setMemory(localStorage.getItem(MEM) === '1'); } catch (e) { /* ignore */ }
  $('memory').addEventListener('change', (e) => setMemory(e.target.checked));
  $('memory2').addEventListener('change', (e) => setMemory(e.target.checked));
  $('start-btn').addEventListener('click', () => { clearSave(); token++; startGame(); });
  $('menu-btn').addEventListener('click', () => { token++; refreshResume(); show('setup'); });
  $('final-again').addEventListener('click', () => { clearSave(); token++; show('setup'); refreshResume(); });
  $('resume-btn').addEventListener('click', () => { const v = load(); if (!v) return; S = v.S; cfg = v.cfg; ui = { flash: null, msg: '' }; show('game'); render(); run(); });
  $('discard-btn').addEventListener('click', () => { clearSave(); refreshResume(); });
  document.addEventListener('click', onClick);
  refreshResume();
  const v = load();
  if (v && params.has('resume')) $('resume-btn').click();
  if (params.has('debug')) window.tt = { get S() { return S; }, E, AI };
}
function refreshResume() { const v = load(); $('resume').hidden = !v; if (v) { $('bot-count').value = String(v.cfg.bots); $('bot-skill').value = v.cfg.skill; } }
init();
