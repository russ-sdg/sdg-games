// Prophets & Kings: play online against 1 to 5 computer players. You are seat 0.
import * as E from './engine.js';
import * as AI from './ai.js';

const KEY = 'sdg-pk-play-1', HINTS = 'sdg-pk-hints';
const $ = (id) => document.getElementById(id);
const FAST = location.search.includes('fast');               // ?fast skips the pauses (for testing)
const sleep = (ms) => new Promise((r) => setTimeout(r, FAST ? 1 : ms));
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BOTS = ['Peter', 'Mary', 'John', 'Ruth', 'Paul'];
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

let S = null, cfg = null, token = 0;
let ui = { sel: null, undo: [], fresh: [], flash: null, msg: '' };
const mine = () => !!S && S.turn === 0 && !S.over;
const me = () => S.players[0];

function save() { try { localStorage.setItem(KEY, JSON.stringify({ S, cfg })); } catch (e) { /* private mode */ } }
function load() { try { const v = JSON.parse(localStorage.getItem(KEY)); return v && v.S && v.S.v === 1 && v.cfg && !v.S.over ? v : null; } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
const hintsOn = () => $('hints').checked;
const show = (w) => { $('setup').hidden = w !== 'setup'; $('game').hidden = w !== 'game'; if (w === 'setup') { $('dock').hidden = true; document.body.classList.remove('has-dock'); } window.scrollTo(0, 0); };

// "You takes" -> "You take"; "from You's hand" -> "from your hand"
const said = (t) => t.replace(/^You (take|start|add|discard)s\b/, 'You $1').replace(/\bYou's\b/g, 'your');
const nameSpan = (uid) => `<span class="g-${E.DEFS[uid].group}">${esc(E.label(uid))}</span>`;

// ---- starting --------------------------------------------------------------------------------------------------------------------
function startGame() {
  const n = Number($('bot-count').value), pick = $('bot-skill').value, skills = ['casual', 'steady', 'sharp'];
  const seed = Number(new URLSearchParams(location.search).get('seed')) || Math.floor(Math.random() * 1e9) + 1;   // ?seed=N replays a deal (for testing)
  const players = [{ name: 'You', bot: false }, ...Array.from({ length: n }, (_, i) => ({ name: BOTS[i], bot: true, skill: pick === 'mixed' ? skills[(i + 1) % 3] : pick }))];
  cfg = { bots: n, skill: pick, seed };
  S = E.newGame({ seed, players, first: Math.floor(E.rng(seed + 1)() * players.length) });
  ui = { sel: null, undo: [], fresh: [], flash: null, msg: '' };
  save(); show('game'); render(); run();
}

// ---- the computer players --------------------------------------------------------------------------------------------------------
async function run() {
  const my = ++token;
  while (!S.over && E.me(S).bot) {
    const p = E.me(S), seat = S.turn;
    ui.msg = `${p.name} is playing…`; ui.flash = null; ui.sel = null; render();
    await sleep(800); if (my !== token) return;
    while (S.phase === 'draw') {
      const src = AI.chooseTake(S, p.skill);
      S = E.take(S, src);
      ui.flash = src.from === 'pile' ? { pile: src.i } : src.from === 'deck' ? { deck: true } : { opp: src.p };
      ui.msg = said(S.last.text); save(); render();
      await sleep(750); if (my !== token) return;
    }
    const pl = AI.choosePlay(S, p.skill);
    for (const st of pl.starts) {
      S = E.startSet(S, st.head, st.members[0]);
      const idx = E.me(S).sets.length - 1;
      ui.flash = { set: [seat, idx] }; ui.msg = said(S.last.text); save(); render(); await sleep(800); if (my !== token) return;
      for (const m of st.members.slice(1)) { S = E.addTo(S, idx, m); ui.msg = said(S.last.text); save(); render(); await sleep(700); if (my !== token) return; }
    }
    for (const a of pl.adds) {
      S = E.addTo(S, a.set, a.uid);
      ui.flash = { set: [seat, a.set] }; ui.msg = said(S.last.text); save(); render(); await sleep(800); if (my !== token) return;
    }
    while (E.mustDiscard(S)) {
      const uid = pl.discards.find((u) => E.me(S).hand.includes(u)) ?? E.me(S).hand[0], pile = AI.choosePile(S, uid, p.skill);
      S = E.discard(S, uid, pile);
      ui.flash = { pile }; ui.msg = said(S.last.text); save(); render(); await sleep(700); if (my !== token) return;
    }
    if (!S.over && S.turn === seat && S.phase === 'play') S = E.endTurn(S);
    save();
  }
  ui.msg = ''; ui.undo = []; ui.fresh = []; ui.sel = null;
  save(); render();
  if (S.over) showFinal();
}

// ---- your turn -------------------------------------------------------------------------------------------------------------------
function onTake(what) {
  if (!mine() || S.phase !== 'draw') return;
  const [from, arg] = what.split(':'), src = from === 'deck' ? { from } : from === 'pile' ? { from, i: Number(arg) } : { from, p: Number(arg) };
  if (!E.sources(S).some((o) => o.from === from && (from === 'deck' || (from === 'pile' ? o.i === src.i : o.p === src.p)))) return;
  const before = new Set(me().hand);
  S = E.take(S, src);
  ui.fresh.push(...me().hand.filter((u) => !before.has(u))); ui.sel = null; ui.undo = [];
  ui.flash = from === 'pile' ? { pile: src.i } : from === 'deck' ? { deck: true } : { opp: src.p };
  ui.msg = '';
  save(); render();
}

function onHand(uid) {
  if (!mine() || S.phase !== 'play') return;
  ui.msg = '';
  if (ui.sel === null) ui.sel = uid;
  else if (ui.sel === uid) ui.sel = null;
  else if (E.match(ui.sel, uid)) { askHead(ui.sel, uid); return; }
  else ui.sel = uid;
  render();
}

function startWith(head, member) {
  ui.undo.push(S); S = E.startSet(S, head, member);
  ui.sel = null; ui.flash = { set: [0, me().sets.length - 1] }; ui.msg = '';
  save(); render();
}
function onAddSet(i) {
  if (!mine() || S.phase !== 'play' || ui.sel === null || !E.canAdd(me().sets[i], ui.sel)) return;
  ui.undo.push(S); S = E.addTo(S, i, ui.sel);
  ui.sel = null; ui.flash = { set: [0, i] }; ui.msg = '';
  save(); render();
}
function onDiscard(pile) {
  if (!mine() || !E.mustDiscard(S) || ui.sel === null) return;
  S = E.discard(S, ui.sel, pile);
  ui.sel = null; ui.undo = []; ui.flash = { pile }; ui.msg = '';
  afterTurnEnds();
}
function onEnd() {
  if (!mine() || S.phase !== 'play' || E.mustDiscard(S)) return;
  S = E.endTurn(S); ui.sel = null; ui.undo = []; ui.msg = '';
  afterTurnEnds();
}
function afterTurnEnds() {
  save(); render();
  if (S.over) { showFinal(); return; }
  if (S.turn !== 0 || S.phase !== 'play') { ui.fresh = []; }
  run();
}
function onUndo() { if (!ui.undo.length) return; S = ui.undo.pop(); ui.sel = null; ui.msg = ''; save(); render(); }

// Which card goes on top? Both choices are shown, with how far each set could grow.
function askHead(a, b) {
  $('pick-title').textContent = `Start a set with ${E.label(a)} and ${E.label(b)}`;
  const opt = (head, other) => {
    const max = 1 + E.matchesOf(E.label(head)).length;
    return `<button type="button" data-head="${head}" data-member="${other}"><img src="${E.cardImage(head, 320)}" alt="" />${esc(E.label(head))} on top<small>can grow to ${max} cards (${E.setScore(max)} points)</small></button>`;
  };
  $('pick-body').innerHTML = opt(a, b) + opt(b, a);
  $('pick').showModal();
}

function cardInfo(uid) {
  const name = E.label(uid);
  return `${name} ${E.DEFS[uid].kind === 'prophet' ? 'prophesied during the reigns of' : 'reigned while these prophets prophesied:'} ${E.matchesOf(name).join(', ')}.`;
}
function openZoom(uid) {
  $('zoom-img').src = E.cardImage(uid, 640); $('zoom-img').alt = E.label(uid); $('zoom-cap').textContent = cardInfo(uid); $('zoom').showModal();
}

// ---- drawing the page ------------------------------------------------------------------------------------------------------------
function render() {
  if (!S) return;
  renderBar(); renderOpps(); renderTable(); renderMine(); renderHand(); renderLog(); renderDock();
}
function renderBar() {
  $('bar').innerHTML = S.players.map((p, i) => `<div class="pk-score${i === S.turn && !S.over ? ' is-turn' : ''}"><span class="n">${esc(p.name)}</span><span class="pts">${p.score}</span></div>`).join('')
    + `<div class="pk-round">Round ${S.round}<br /><small>${S.draw.length ? `${plural(S.draw.length, 'card')} in the draw pile` : 'Draw pile empty: last turn'}</small></div>`;
}
function setHtml(st, { target, flash, gain } = {}) {
  const len = E.setLength(st), members = [...st.members].reverse();
  return `<div class="pk-set${target ? ' is-target' : ''}${flash ? ' is-flash' : ''}"${target ? ` data-addset="${target}" role="button" tabindex="0"` : ''}>
    <div class="stack">${members.map((u) => `<div class="strip"><img src="${E.cardImage(u)}" alt="${esc(E.label(u))}" data-zoom="${u}" /></div>`).join('')}<img src="${E.cardImage(st.head)}" alt="${esc(E.label(st.head))}" data-zoom="${st.head}" /></div>
    <div class="cap">${nameSpan(st.head)}<br />${len} cards · ${E.setScore(len)}</div>${target ? `<span class="pk-badge">+${gain}</span>` : ''}</div>`;
}
function renderOpps() {
  const drawing = mine() && S.phase === 'draw';
  $('opps').innerHTML = S.players.slice(1).map((p, k) => {
    const j = k + 1, backs = p.hand.slice(0, 7).map(() => `<img src="${E.backImage(320)}" alt="" />`).join('');
    const seen = p.known.filter((u) => p.hand.includes(u));
    const sets = p.sets.map((st, i) => setHtml(st, { flash: ui.flash && ui.flash.set && ui.flash.set[0] === j && ui.flash.set[1] === i })).join('');
    return `<div class="pk-opp${j === S.turn && !S.over ? ' is-turn' : ''}${ui.flash && ui.flash.opp === j ? ' is-flash' : ''}">
      <div class="pk-opp-head"><span>${esc(p.name)}</span><span>${p.score} points</span><span class="meta">${p.skill || ''}</span></div>
      ${backs ? `<div class="pk-fan">${backs}</div>` : ''}
      <p class="seen">${plural(p.hand.length, 'card')} in hand${seen.length ? `. You saw them take: ${seen.map(nameSpan).join(', ')}` : ''}</p>
      ${drawing && p.hand.length ? `<button type="button" class="btn btn-sm btn-outline-primary mb-2" data-take="hand:${j}">Take a blind card from ${esc(p.name)}</button>` : ''}
      <div class="pk-sets">${sets || '<span class="none">No sets yet</span>'}</div></div>`;
  }).join('');
}
const zoomBtn = (uid) => `<span class="pk-zoombtn" role="button" tabindex="0" data-zoom="${uid}" aria-label="Read ${esc(E.label(uid))}">⤢</span>`;
function renderTable() {
  const drawing = mine() && S.phase === 'draw', discarding = mine() && E.mustDiscard(S) && ui.sel !== null;
  const deck = `<button type="button" class="pk-pile${ui.flash && ui.flash.deck ? ' is-flash' : ''}${drawing && S.draw.length ? ' is-target' : ''}" ${drawing && S.draw.length ? 'data-take="deck"' : 'disabled'} aria-label="Draw pile, ${plural(S.draw.length, 'card')}">
    <span class="lbl">Draw pile</span>${S.draw.length ? `<img src="${E.backImage(320)}" alt="" /><span class="count">${S.draw.length}</span>` : '<span class="gone">Empty</span>'}</button>`;
  const piles = S.piles.map((p, i) => {
    const top = p[p.length - 1], fl = ui.flash && ui.flash.pile === i;
    const act = discarding ? `data-discard="${i}"` : drawing && top !== undefined ? `data-take="pile:${i}"` : 'disabled';
    return `<button type="button" class="pk-pile${discarding || (drawing && top !== undefined) ? ' is-target' : ''}${fl ? ' is-flash' : ''}" ${act} aria-label="Discard pile ${i + 1}${top !== undefined ? `, top card ${esc(E.label(top))}` : ', empty'}">
      <span class="lbl">Pile ${i + 1}${discarding ? ': discard here' : ''}</span>${top !== undefined ? `<img src="${E.cardImage(top)}" alt="${esc(E.label(top))}" /><span class="count">${p.length}</span>${zoomBtn(top)}` : '<span class="gone">Empty</span>'}</button>`;
  }).join('');
  $('table').innerHTML = deck + piles;
}
function renderMine() {
  const p = me(), canAdd = mine() && S.phase === 'play' && ui.sel !== null;
  $('mine').innerHTML = p.sets.map((st, i) => {
    const ok = canAdd && E.canAdd(st, ui.sel);
    return setHtml(st, { target: ok ? String(i) : '', gain: ok ? E.setScore(E.setLength(st) + 1) - E.setScore(E.setLength(st)) : 0, flash: ui.flash && ui.flash.set && ui.flash.set[0] === 0 && ui.flash.set[1] === i });
  }).join('') || '<span class="pk-none">No sets yet. Match a prophet with a king of his day to start one.</span>';
}
function renderHand() {
  const p = me(), playing = mine() && S.phase === 'play';
  const pl = playing ? E.plays(S) : { adds: [], starts: [] };
  const can = new Set([...pl.adds.map((a) => a.uid), ...pl.starts.flat()]);
  const partners = playing && ui.sel !== null ? new Set(p.hand.filter((u) => u !== ui.sel && E.match(u, ui.sel))) : new Set();
  $('hand').innerHTML = [...p.hand].sort((a, b) => a - b).map((u) => {
    const sel = ui.sel === u;
    return `<button type="button" class="pk-hc${sel ? ' is-sel' : ''}${partners.has(u) ? ' is-partner' : ''}${ui.fresh.includes(u) ? ' is-new' : ''}${playing ? '' : ' is-wait'}${hintsOn() && can.has(u) ? ' can' : ''}" data-hand="${u}" aria-pressed="${sel}" aria-label="${esc(E.label(u))}">
      <img src="${E.cardImage(u)}" alt="" />${zoomBtn(u)}</button>`;
  }).join('') || '<span class="pk-none">No cards in hand.</span>';
}
function renderLog() {
  $('log').innerHTML = S.log.slice(-12).map((l) => `<li class="${l.startsWith('You ') ? 'me' : ''}">${esc(said(l))}</li>`).join('') || '<li>Nothing yet.</li>';
}
function renderDock() {
  const on = !S.over; $('dock').hidden = !on; document.body.classList.toggle('has-dock', on);
  if (!on) return;
  let t = '', acts = '';
  const n = me().hand.length;
  if (S.turn !== 0) t = esc(ui.msg || `${E.me(S).name}'s turn…`);
  else if (S.phase === 'draw') {
    t = esc(ui.msg || `Your turn. Draw ${plural(E.HAND_TARGET - n, 'more card')} (you hold ${n}): tap the draw pile, a discard pile, or take a blind card from another player.`)
      + (S.ending ? '<small>The last card has been taken, so the game ends after your turn.</small>' : '');
  } else {
    const pl = E.plays(S), none = !pl.adds.length && !pl.starts.length, over = n - E.HAND_KEEP;
    if (ui.sel === null) {
      t = esc(ui.msg || (none ? 'Nothing here can be played.' : 'Tap a card, then a matching card (to start a set) or one of your sets (to add to it).'))
        + `<small>${over > 0 ? `You hold ${n}: discard ${plural(over, 'card')} (tap a card, then a discard pile) to end your turn.` : 'When you are done, end your turn.'}${S.ending ? ' This is the last turn.' : ''}</small>`;
    } else {
      const sets = me().sets.filter((st) => E.canAdd(st, ui.sel)).length, partners = me().hand.filter((u) => u !== ui.sel && E.match(u, ui.sel)).length;
      t = esc(ui.msg || cardInfo(ui.sel))
        + `<small>${sets ? `Tap a highlighted set to add it. ` : ''}${partners ? 'Tap a matching card in your hand to start a set. ' : ''}${!sets && !partners ? 'It cannot be played right now. ' : ''}${over > 0 ? 'Or tap a discard pile to discard it.' : ''}</small>`;
    }
    if (ui.sel !== null) acts += '<button type="button" class="btn btn-outline-secondary btn-sm" data-do="cancel">Put it back</button>';
    if (ui.undo.length) acts += '<button type="button" class="btn btn-outline-secondary btn-sm" data-do="undo">Undo</button>';
    if (n <= E.HAND_KEEP) acts += '<button type="button" class="btn btn-primary" data-do="end">End turn</button>';
  }
  $('status').innerHTML = t; $('actions').innerHTML = acts;
}

// ---- the end ---------------------------------------------------------------------------------------------------------------------
function showFinal() {
  const w = E.winners(S), order = S.players.map((p, i) => ({ ...p, i })).sort((a, b) => b.score - a.score);
  $('final-title').textContent = w.includes(0) ? (w.length > 1 ? 'You tied for the win!' : 'You win!') : `${S.players[w[0]].name} wins`;
  $('final-body').innerHTML = `<p class="small text-muted">${S.endedBy === 'draw' ? `The last card was taken from the draw pile in round ${S.round}.` : 'The game reached its round limit.'}</p>`
    + order.map((p) => `<div class="pk-final-row${w.includes(p.i) ? ' win' : ''}"><span>${esc(p.name)}</span><span>${p.score} points</span></div>`
      + `<div class="pk-final-sets">${p.sets.map((st) => `${E.setLength(st)} cards (${E.setScore(E.setLength(st))}): ${E.setCards(st).map(nameSpan).join(', ')}`).join('<br />') || 'No sets'}</div>`).join('');
  $('final').showModal();
}

// ---- wiring ----------------------------------------------------------------------------------------------------------------------
function onClick(e) {
  const c = (sel) => e.target.closest && e.target.closest(sel);
  const zb = c('.pk-zoombtn'); if (zb) { e.preventDefault(); openZoom(Number(zb.dataset.zoom)); return; }
  const take = c('[data-take]'); if (take) { onTake(take.dataset.take); return; }
  const disc = c('[data-discard]'); if (disc) { onDiscard(Number(disc.dataset.discard)); return; }
  const add = c('[data-addset]'); if (add) { onAddSet(Number(add.dataset.addset)); return; }
  const z = c('img[data-zoom]'); if (z) { openZoom(Number(z.dataset.zoom)); return; }
  const h = c('[data-hand]'); if (h) { onHand(Number(h.dataset.hand)); return; }
  const b = c('[data-do]'); if (!b) return;
  if (b.dataset.do === 'cancel') { ui.sel = null; render(); } else if (b.dataset.do === 'undo') onUndo(); else if (b.dataset.do === 'end') onEnd();
}
function init() {
  try { $('hints').checked = localStorage.getItem(HINTS) !== '0'; } catch (e) { /* ignore */ }
  $('hints').addEventListener('change', () => { try { localStorage.setItem(HINTS, $('hints').checked ? '1' : '0'); } catch (e) { /* ignore */ } if (S) renderHand(); });
  $('start-btn').addEventListener('click', () => { clearSave(); token++; startGame(); });
  document.addEventListener('click', (e) => { if ($('game').hidden) return; onClick(e); });
  document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-addset], .pk-zoombtn')) { e.preventDefault(); onClick(e); } });
  $('pick-body').addEventListener('click', (e) => {
    const b = e.target.closest('[data-head]'); if (!b) return;
    $('pick').close(); startWith(Number(b.dataset.head), Number(b.dataset.member));
  });
  $('menu-btn').addEventListener('click', () => { if (S && !S.over && !confirm('Leave this game? It will be lost.')) return; token++; clearSave(); S = null; show('setup'); $('resume').hidden = true; });
  $('final-again').addEventListener('click', () => { token++; clearSave(); S = null; show('setup'); $('resume').hidden = true; });
  $('discard-btn').addEventListener('click', () => { clearSave(); $('resume').hidden = true; });
  $('resume-btn').addEventListener('click', () => {
    const v = load(); if (!v) return;
    S = v.S; cfg = v.cfg; ui = { sel: null, undo: [], fresh: [], flash: null, msg: '' };
    show('game'); render(); run();
  });
  const saved = load();
  if (saved) { $('resume').hidden = false; $('resume-text').textContent = `You have a game in progress (round ${saved.S.round}, ${saved.S.players.length} players).`; }
  if (location.search.includes('debug')) window.pk = { E, AI, get S() { return S; }, set S(v) { S = v; render(); } };
}
init();
