// Journeys through Jerusalem: play online against 1 to 5 computer players. You are seat 0.
import * as E from './engine.js';
import * as AI from './ai.js';
import { TILES, SITES, COLORS, MAP_IMAGE, MAP_SIZE, pathBetween } from './map-data.js';
import { CARD, CATEGORIES, cardImage } from './cards.js';
import SCRIPTURE from './scripture-data.js';
import { drawShareImage, canvasToBlob, nativeShareData, shareMessage } from './share.js';

const KEY = 'sdg-jtj-play-1';
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const FAST = params.has('fast');                                // ?fast skips the pauses (for testing)
const sleep = (ms) => new Promise((r) => setTimeout(r, FAST ? 1 : ms));
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BOTS = ['Anna', 'Barnabas', 'Lydia', 'Silas', 'Tabitha'];
const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const NS = 'http://www.w3.org/2000/svg';
const hex = (c) => COLORS.find((x) => x.id === c).hex;
const colorName = (c) => COLORS.find((x) => x.id === c).name;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

let S = null, cfg = null, token = 0, wholeMap = null;
let ui = { sel: null, msg: '', actions: [], die: '', tiles: null };       // tiles: squares you can tap right now
let pending = null;                                                       // a promise resolver waiting on a tap

function save() { try { localStorage.setItem(KEY, JSON.stringify({ S, cfg })); } catch (e) { /* private mode */ } }
function load() { try { const v = JSON.parse(localStorage.getItem(KEY)); return v && v.S && v.S.v === E.V && v.cfg && !v.S.over ? v : null; } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
const show = (w) => { $('setup').hidden = w !== 'setup'; $('game').hidden = w !== 'game'; if (w === 'setup') $('dock').hidden = true; window.scrollTo(0, 0); };
const squareName = (t) => (TILES[t].site !== null ? SITES[TILES[t].site].name : `a ${colorName(TILES[t].c).toLowerCase()} square`);
const youName = (seat) => (seat === 0 ? 'You' : S.players[seat].name);

// ---- starting --------------------------------------------------------------------------------------------------------------------
function buildColors() {
  $('colors').innerHTML = COLORS.map((c, i) => `<label><input type="radio" name="color" value="${c.id}"${i === 1 ? ' checked' : ''}><span class="jt-dot" style="background:${c.hex}"></span>${c.name}</label>`).join('');
}
function startGame() {
  const n = Number($('bot-count').value), pick = $('bot-skill').value, skills = ['casual', 'steady', 'sharp'];
  const mineC = document.querySelector('input[name=color]:checked').value, others = COLORS.map((c) => c.id).filter((c) => c !== mineC);
  const seed = Number(params.get('seed')) || Math.floor(Math.random() * 1e9) + 1;      // ?seed=N replays a deal (for testing)
  const players = [{ name: 'You', bot: false, color: mineC }, ...Array.from({ length: n }, (_, i) => ({ name: BOTS[i], bot: true, skill: pick === 'mixed' ? skills[(i + 1) % 3] : pick, color: others[i] }))];
  cfg = { bots: n, skill: pick, seed };
  S = AI.botStarts(E.newGame({ seed, players }));
  ui = { sel: null, msg: '', actions: [], die: '', tiles: null };
  wholeMap = null;
  save(); show('game'); render(); run();
}

// ---- the flow of a game ----------------------------------------------------------------------------------------------------------
function waitFor() { return new Promise((r) => { pending = r; }); }
const settle = (v) => { if (pending) { const p = pending; pending = null; p(v); } };
const setAct = (list) => { ui.actions = list; render(); };

async function run() {
  const my = ++token; settle(null);
  while (!S.over) {
    if (S.phase === 'start') await humanStart();
    else if (S.phase === 'roll') await doRoll(my);
    else if (S.phase === 'move') await doMove(my);
    else if (S.phase === 'pick') await doPick();
    if (my !== token) return;
  }
  ui.msg = ''; ui.actions = []; ui.tiles = null; ui.die = ''; clearSave(); render(); showFinal();
}

async function humanStart() {
  const card = await pickCardDialog(S.players[0].offer, 'Choose your first journey', 'Keep one card secret to yourself; the other goes back to the bottom of the deck.');
  if (card === null) return;
  const mineC = S.players[0].color;
  ui.tiles = E.startSquares(S, 0).map((t) => ({ tile: t, steps: 0 })); ui.sel = null; wholeMap = true;
  ui.msg = `Your token is ${colorName(mineC).toLowerCase()}. Tap a ${colorName(mineC).toLowerCase()} square to start on. Hint: start close to one end of your journey.`;
  ui.preview = card; setAct([]);
  const tile = await waitFor(); if (tile === null) return;
  S = E.chooseStart(S, 0, card, tile); ui.tiles = null; ui.sel = null; ui.preview = null; wholeMap = null; ui.msg = ''; save(); render();
}

async function doRoll(my) {
  const roller = S.roller;
  if (!S.players[roller].bot) {
    ui.msg = 'Your turn to roll the die. Everyone then moves at once.'; ui.die = ''; setAct([{ label: 'Roll the die', primary: true, act: () => settle(true) }]);
    if (!(await waitFor())) return;
  } else { ui.msg = `${S.players[roller].name} is rolling the die…`; ui.die = ''; setAct([]); await sleep(700); }
  if (my !== token) return;
  S = E.roll(S);
  for (let k = 0; k < 6; k++) { ui.die = FACES[Math.floor(Math.random() * 6)]; render(); await sleep(70); }
  ui.die = FACES[S.die - 1]; save(); render();
}

async function doMove(my) {
  const p = S.players[0], opts = E.options(S, 0), roller = S.players[S.roller].name === 'You' ? 'You rolled' : `${S.players[S.roller].name} rolled`;
  ui.tiles = opts; ui.sel = null;
  const prompt = `${roller} a ${S.die}. Move up to ${plural(S.die, 'square')} along your path: tap where to finish.`;
  const onSite = TILES[p.pos].site !== null;
  const ask = () => {
    ui.msg = ui.sel === null ? prompt : `Move ${plural(opts.find((o) => o.tile === ui.sel).steps, 'square')} to ${squareName(ui.sel)}?`;
    setAct([...(ui.sel !== null ? [{ label: 'Move here', primary: true, act: () => settle(ui.sel) }] : []), { label: onSite ? 'Stay here (counts if you need this site)' : 'Stay put', act: () => settle('stay') }]);
  };
  ui.onPick = (t) => { ui.sel = t; ask(); };
  ask();
  const choice = await waitFor(); ui.onPick = null; if (choice === null || my !== token) return;
  ui.tiles = null; ui.sel = null; ui.actions = [];
  S = E.submitMove(S, 0, choice === 'stay' ? null : choice);
  S = AI.botMoves(S);
  const rolledBy = S.roller === 0 ? 'you' : S.players[S.roller].name, cardBefore = S.players[0].card, seenBefore = S.players[0].visited.slice();
  S = E.resolve(S);
  const lines = describe(S.last);
  logRound(rolledBy, lines); save();
  ui.msg = lines.filter((l) => l.show).map((l) => l.text).join(' ') || 'Everyone has moved.'; ui.die = FACES[S.die - 1]; render();
  const reached = S.last.find((e) => e.seat === 0 && e.site !== null && e.site !== undefined && cardBefore && !seenBefore.includes(e.site));
  const stop = reached && CARD[cardBefore].stops.find((x) => x.site === SITES[reached.site].id);
  if (stop) { await readPassage(stop, cardBefore); if (my !== token) return; }
  if (S.last.some((e) => e.t === 'complete')) { setAct([{ label: 'Continue', primary: true, act: () => settle(true) }]); await waitFor(); } else await sleep(1000);
  ui.actions = []; ui.msg = '';
  S = AI.botPicks(S); save(); render();
}

async function doPick() {
  if (S.players[0].offer.length) {
    const done = S.last.find((e) => e.t === 'complete' && e.seat === 0);
    const card = await pickCardDialog(S.players[0].offer, 'Choose your next journey', done ? `You completed ${CARD[done.card].name}! Keep one of these two; the other goes to the bottom of the deck.` : 'Keep one; the other goes to the bottom of the deck.');
    if (card === null) return;
    S = E.chooseCard(S, 0, card);
  }
  S = AI.botPicks(S); save(); render();
}

// what happened this roll, in words. show: worth reading out in the status line
function describe(ev) {
  const out = [];
  for (const e of ev) {
    if (e.t === 'move' || e.t === 'stay') { if (e.site !== null && e.seat !== 0) out.push({ seat: e.seat, text: `${youName(e.seat)} reached ${SITES[e.site].name}.`, show: false }); else if (e.site !== null) out.push({ seat: 0, text: `You reached ${SITES[e.site].name}.`, show: true }); }
    else if (e.t === 'complete') out.push({ seat: e.seat, text: `${youName(e.seat)} completed ${CARD[e.card].name} for ${CARD[e.card].pts} points!`, show: true });
    else if (e.t === 'forced') out.push({ seat: e.seat, text: `${youName(e.seat)} had to play the last card, ${CARD[e.card].name}.`, show: true });
  }
  if (S.over) out.push({ seat: -1, text: S.endedBy === 'categories' ? 'A player has completed an Apostle, a Friend of Jesus and an Enemy of Christ: the game is over.' : S.endedBy === 'deck' ? 'No cards are left to draw: the game is over.' : 'The game ran out of rolls.', show: true });
  return out;
}
function logRound(who, lines) { cfg.log = (cfg.log || []).concat([{ head: `Roll ${S.rolls}: ${who} rolled a ${S.die}` }, ...lines.map((l) => ({ text: l.text, me: l.seat === 0 }))]).slice(-120); }

// ---- the dialogs -----------------------------------------------------------------------------------------------------------------
function pickCardDialog(offer, title, note) {
  return new Promise((resolve) => {
    $('pick-title').textContent = title; $('pick-note').textContent = note;
    $('pick-cards').innerHTML = offer.map((id) => { const c = CARD[id], cat = CATEGORIES.find((x) => x.id === c.cat);
      return `<button type="button" class="jt-offer" data-id="${id}"><img src="${cardImage(id, 640)}" alt="The ${esc(c.name)} card" /><b>${esc(c.name)} &middot; ${c.pts} points</b><span class="small">${cat.name} &middot; ${plural(c.stops.length, 'site')}</span></button>`; }).join('');
    const dlg = $('pick');
    const onClick = (e) => { const b = e.target.closest('.jt-offer'); if (!b) return; $('pick-cards').removeEventListener('click', onClick); dlg.close(); resolve(b.dataset.id); };
    $('pick-cards').addEventListener('click', onClick);
    pending = (v) => { $('pick-cards').removeEventListener('click', onClick); if (dlg.open) dlg.close(); resolve(v); };
    dlg.addEventListener('cancel', (e) => e.preventDefault(), { once: true });
    dlg.showModal();
  });
}
// the Scripture that puts the character at a site you have reached (World English Bible)
function showPassage(stop, cardId, onClose) {
  const site = SITES.find((x) => x.id === stop.site), verses = SCRIPTURE.passages[stop.ref] || [];
  $('verse-title').innerHTML = `<img src="${site.icon}" alt="" class="jt-verse-icon" /> ${esc(site.name)} <span class="small text-muted">&middot; ${esc(CARD[cardId].name)}</span>`;
  $('verse-ref').textContent = `${stop.ref} (${SCRIPTURE.translation})`;
  $('verse-text').innerHTML = verses.map(([n, t]) => `<sup>${n}</sup>${esc(t)}`).join(' ');
  const dlg = $('verse'); dlg.onclose = () => { dlg.onclose = null; if (onClose) onClose(); };
  dlg.showModal();
}
const readPassage = (stop, cardId) => new Promise((resolve) => { pending = (v) => { if ($('verse').open) $('verse').close(); resolve(v); }; showPassage(stop, cardId, () => { pending = null; resolve(true); }); });
function zoomCard(id) { $('zoom-img').src = cardImage(id, 820); $('zoom-img').alt = `The ${CARD[id].name} card`; $('zoom-cap').textContent = `${CARD[id].name}, ${CARD[id].pts} points`; $('zoom').showModal(); }

// Taps are caught on the map itself (not on squares that get redrawn), and go to the nearest square you can choose. A redraw between
// finger down and finger up (the browser's address bar sliding away resizes the page, for one) can no longer swallow the first tap.
const choose = (tile) => { if (ui.onPick) ui.onPick(tile); else settle(tile); };
function tapMap(e) {
  if (!ui.tiles || !ui.tiles.length || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const svg = $('map'), m = svg.getScreenCTM(); if (!m) return;
  const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  const p = pt.matrixTransform(m.inverse()), per = svg.viewBox.baseVal.width / (svg.clientWidth || 1), tol = Math.max(26, Math.min(44, 22 * per));
  let best = null, bd = Infinity;
  for (const o of ui.tiles) { const d = Math.hypot(TILES[o.tile].x - p.x, TILES[o.tile].y - p.y); if (d < bd) { bd = d; best = o; } }
  if (best && bd <= tol) choose(best.tile);
}

// ---- drawing ---------------------------------------------------------------------------------------------------------------------
function render() {
  if (!S) return;
  renderBar(); renderMap(); renderMine(); renderOpps(); renderLog();
  $('dock').hidden = false; $('status').textContent = ui.msg || '';
  $('die').textContent = ui.die || '';
  $('actions').innerHTML = ''; ui.actions.forEach((a) => { const b = document.createElement('button'); b.type = 'button'; b.className = `btn ${a.primary ? 'btn-primary' : 'btn-outline-secondary'}`; b.textContent = a.label; b.onclick = a.act; $('actions').appendChild(b); });
}
function renderBar() {
  const roller = S.phase === 'over' ? -1 : S.roller;
  $('bar').innerHTML = S.players.map((p, i) => `<div class="jt-score${i === roller ? ' is-roller' : ''}"><span class="jt-dot" style="background:${hex(p.color)}"></span><span class="n">${esc(i === 0 ? 'You' : p.name)}</span><b>${E.score(p)}</b>${cats(p)}</div>`).join('')
    + `<div class="jt-round">${S.phase === 'start' ? 'Choosing journeys' : `Roll ${S.rolls}`} &middot; ${plural(S.deck.length, 'card')} in the deck</div>`;
}
const cats = (p) => { const have = E.doneCategories(p); return `<span class="jt-cats" title="Categories completed">${CATEGORIES.map((c) => `<span class="jt-cat${have.has(c.id) ? ' on' : ''}" style="background:${c.bar}">${c.name[0]}</span>`).join('')}</span>`; };

const el = (name, attrs = {}, parent) => { const n = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (parent) parent.appendChild(n); return n; };
function viewBox() {
  const small = window.innerWidth < 900, close = wholeMap === null ? small : !wholeMap;
  $('zoom-btn').textContent = close ? 'Whole map' : 'Zoom in';
  const me = S.players[0];
  if (!close || me.pos < 0 || !ui.tiles || !ui.tiles.length) return [0, 0, MAP_SIZE, MAP_SIZE];
  const pts = [TILES[me.pos], ...ui.tiles.map((o) => TILES[o.tile])];
  const x0 = Math.min(...pts.map((t) => t.x)) - 70, x1 = Math.max(...pts.map((t) => t.x)) + 70, y0 = Math.min(...pts.map((t) => t.y)) - 70, y1 = Math.max(...pts.map((t) => t.y)) + 70;
  const side = Math.min(MAP_SIZE, Math.max(x1 - x0, y1 - y0, 440)), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return [Math.min(MAP_SIZE - side, Math.max(0, cx - side / 2)), Math.min(MAP_SIZE - side, Math.max(0, cy - side / 2)), side, side];
}
function renderMap() {
  const svg = $('map'), me = S.players[0];
  svg.innerHTML = ''; svg.setAttribute('viewBox', viewBox().join(' '));
  el('image', { href: MAP_IMAGE, x: 0, y: 0, width: MAP_SIZE, height: MAP_SIZE }, svg);
  const card = me.card ? CARD[me.card] : ui.preview ? CARD[ui.preview] : null;
  if (card) for (const s of card.stops) {                                                 // the sites your journey needs
    const i = SITES.findIndex((x) => x.id === s.site), t = TILES.find((q) => q.site === i), got = me.card && me.visited.includes(i);
    el('circle', { cx: t.x, cy: t.y, r: 30, class: `need${got ? ' is-done' : ''}` }, svg);
    if (got) { el('circle', { cx: t.x + 22, cy: t.y - 22, r: 12, class: 'tick' }, svg); el('text', { x: t.x + 22, y: t.y - 17, class: 'tick-t' }, svg).textContent = '✓'; }
  }
  for (const o of ui.tiles || []) {                                                       // the squares you can tap
    const t = TILES[o.tile], g = el('g', { class: `go${t.site !== null ? ' site' : ''}${ui.sel === o.tile ? ' sel' : ''}`, tabindex: 0, role: 'button', 'data-tile': o.tile, 'aria-label': `${squareName(o.tile)}${o.steps ? `, ${plural(o.steps, 'square')} away` : ''}` }, svg);
    el('circle', { cx: t.x, cy: t.y, r: 21, class: 'hit' }, g);
    if (o.steps) el('text', { x: t.x, y: t.y + 5 }, g).textContent = o.steps;
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(o.tile); } });
  }
  if (ui.sel !== null && me.pos >= 0) el('polyline', { points: pathBetween(me.pos, ui.sel).map((i) => `${TILES[i].x},${TILES[i].y}`).join(' '), class: 'route' }, svg);
  if (me.pos >= 0) {
    const t = TILES[me.pos], g = el('g', { class: 'tok', style: `transform:translate(${t.x}px,${t.y}px)` }, svg);
    el('circle', { r: 16, fill: hex(me.color) }, g); el('circle', { r: 16, class: 'ring' }, g);
  }
}
function renderMine() {
  const me = S.players[0], id = me.card || ui.preview, box = $('mine');
  if (!id) { box.innerHTML = `<h2 class="jt-h mt-0">Your journey</h2><p class="mb-0 small">${S.over ? 'The game is over.' : 'Choose a card to begin.'}</p>`; return; }
  const c = CARD[id], cat = CATEGORIES.find((x) => x.id === c.cat), vis = me.card ? me.visited : [], got = c.stops.filter((s) => vis.includes(SITES.findIndex((x) => x.id === s.site))).length;
  box.innerHTML = `<div class="jt-mine"><img src="${cardImage(id, 320)}" alt="The ${esc(c.name)} card (zoom)" data-zoom="${id}" /><div>
    <h2>${esc(c.name)} <span class="cat" style="background:${cat.bar}">${cat.name}</span></h2>
    <div class="small">${c.pts} points &middot; ${got} of ${c.stops.length} sites visited${got ? ` (+${got * E.END_BONUS} if the game ended now)` : ''}</div>
    <ul class="jt-stops">${c.stops.map((s) => { const i = SITES.findIndex((x) => x.id === s.site); return `<li class="${vis.includes(i) ? 'got' : ''}"><img src="${SITES[i].icon}" alt="" /><span>${esc(SITES[i].name)} ${vis.includes(i) ? `<button type="button" class="ref-btn" data-read="${esc(s.ref)}" data-site="${s.site}" data-card="${id}">Read ${esc(s.ref)}</button>` : `<span class="ref">${esc(s.ref)}</span>`}</span></li>`; }).join('')}</ul></div></div>
    <div class="small mt-2 text-muted">You can finish your move on a site you do not need, but it only counts if it is on your card. Your token is ${colorName(me.color).toLowerCase()}.</div>`;
}
function renderOpps() {
  $('opps').innerHTML = S.players.map((p, i) => i === 0 ? '' : `<div class="jt-opp${S.phase !== 'over' && i === S.roller ? ' is-roller' : ''}">
    <div class="jt-opp-head"><span class="jt-dot" style="background:${hex(p.color)}"></span>${esc(p.name)}<span class="meta">${E.score(p)} points &middot; ${p.skill}</span>${cats(p)}</div>
    <div class="jt-marks" title="Sites visited on this player's journey so far">${SITES.map((s, k) => `<img src="${s.icon}" alt="${p.visited.includes(k) ? s.name + ' visited' : ''}" class="${p.visited.includes(k) ? 'on' : ''}" />`).join('')}</div>
    <div class="jt-won">${p.done.length ? p.done.map((id) => `<figure><img src="${cardImage(id, 320)}" alt="${esc(CARD[id].name)}" data-zoom="${id}" /><figcaption>${esc(CARD[id].name)}</figcaption></figure>`).join('') : '<span class="none">No journeys completed yet</span>'}</div></div>`).join('')
    + (S.players[0].done.length ? `<div class="jt-opp"><div class="jt-opp-head">Your completed journeys</div><div class="jt-won">${S.players[0].done.map((id) => `<figure><img src="${cardImage(id, 320)}" alt="${esc(CARD[id].name)}" data-zoom="${id}" /><figcaption>${esc(CARD[id].name)}</figcaption></figure>`).join('')}</div></div>` : '');
}
function renderLog() {
  const groups = []; for (const l of cfg.log || []) { if (l.head || !groups.length) groups.push([]); groups[groups.length - 1].push(l); }       // newest roll first, each roll read top to bottom
  $('log').innerHTML = groups.reverse().map((g) => g.map((l) => l.head ? `<li class="head">${esc(l.head)}</li>` : `<li class="${l.me ? 'me' : ''}">${esc(l.text)}</li>`).join('')).join('');
}

// ---- the end ---------------------------------------------------------------------------------------------------------------------
function showFinal() {
  const st = E.standings(S), won = S.winners.includes(0);
  $('final-title').textContent = won ? (S.winners.length > 1 ? 'You tied for the win!' : 'You won!') : `${S.players[S.winners[0]].name} wins`;
  $('final-body').innerHTML = `<table class="jt-final"><thead><tr><th>Player</th><th>Journeys</th><th>Points</th></tr></thead><tbody>${st.map((r) => {
    const p = S.players[r.seat], open = p.card ? p.visited.filter((v) => E.cardSites(p.card).includes(v)).length * E.END_BONUS : 0;
    return `<tr class="${S.winners.includes(r.seat) ? 'win' : ''}"><td><span class="jt-dot" style="background:${hex(p.color)}"></span> ${esc(r.seat === 0 ? 'You' : p.name)}</td><td>${p.done.map((id) => esc(CARD[id].name)).join(', ') || 'none'}</td><td>${r.score}${open ? ` <span class="small">(incl. ${open} for a journey under way)</span>` : ''}</td></tr>`; }).join('')}</tbody></table>
    <p class="small mt-2 mb-0">Points are the journeys you completed, plus ${E.END_BONUS} for each site visited on a journey still under way. A tie goes to the player with the most journeys.</p>`;
  $('share-note').textContent = ''; $('final').showModal();
}
async function share() {
  const note = $('share-note'), canvas = document.createElement('canvas');
  note.textContent = 'Making your picture…';
  try {
    await drawShareImage(canvas, S);
    const blob = await canvasToBlob(canvas), file = new File([blob], 'journeys-through-jerusalem.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share(nativeShareData(file, S)); note.textContent = 'Shared.'; return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    try { await navigator.clipboard.writeText(shareMessage(S)); note.textContent = 'Picture downloaded, and the text with the link is copied.'; } catch (e) { note.textContent = `Picture downloaded. ${shareMessage(S)}`; }
  } catch (e) { if (e && e.name === 'AbortError') note.textContent = ''; else note.textContent = `Could not share a picture. ${shareMessage(S)}`; }
}

// ---- page wiring -----------------------------------------------------------------------------------------------------------------
buildColors();
$('start-btn').addEventListener('click', () => { const s = load(); if (s && !confirm('Start a new game and discard the one in progress?')) return; clearSave(); startGame(); });
const saved = load();
if (saved) { $('resume').hidden = false; $('resume-btn').addEventListener('click', () => { S = saved.S; cfg = saved.cfg; ui = { sel: null, msg: '', actions: [], die: '', tiles: null }; wholeMap = null; show('game'); render(); run(); }); $('discard-btn').addEventListener('click', () => { clearSave(); $('resume').hidden = true; }); }
$('menu-btn').addEventListener('click', () => { if (S && !S.over && !confirm('Leave this game? It is saved, and you can resume it from the start page.')) return; token++; settle(null); if (S && !S.over) save(); location.reload(); });
$('zoom-btn').addEventListener('click', () => { const small = window.innerWidth < 900; wholeMap = wholeMap === null ? !small : !wholeMap; render(); });
document.addEventListener('click', (e) => { const r = e.target.closest('[data-read]'); if (r) { showPassage({ site: r.dataset.site, ref: r.dataset.read }, r.dataset.card); return; } const z = e.target.closest('[data-zoom]'); if (z) zoomCard(z.dataset.zoom); });
$('final-again').addEventListener('click', () => { clearSave(); location.reload(); });
$('share-btn').addEventListener('click', share);
let lastW = window.innerWidth;
window.addEventListener('resize', () => { if (S && window.innerWidth !== lastW) { lastW = window.innerWidth; renderMap(); } });   // phones resize when the address bar moves: that is not a new layout
$('map').addEventListener('pointerup', tapMap);
if (params.has('debug')) window.jtj = { get S() { return S; }, E, AI };
