// The Fruit of the Spirit: play online against 1 to 3 computer players. You are seat 0.
import * as E from './engine.js';
import * as AI from './ai.js';
import { check as checkRecital } from './quiz.js';
import { drawShareImage, canvasToBlob, nativeShareData, shareMessage } from './share.js';

const KEY = 'sdg-fots-play-1', HELP = 'sdg-fots-help';
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const FAST = params.has('fast');                                // ?fast skips the computers' pauses (for testing)
const sleep = (ms) => new Promise((r) => setTimeout(r, FAST ? 1 : ms));
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BOTS = ['Peter', 'Mary', 'John'];
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// How each card looks and what it says (the words on the printed card, then the longer reading).
const LOOK = {
  love: { c: '#e0202a', ic: '❤️', tx: 'To play: remove all Deed cards (at least one) in front of an opponent.',
    more: 'Playing Love counts as your one Fruit card. It frees your opponent’s covered fruit, so it also helps them.' },
  joy: { c: '#ef7d22', ic: '☀️', tx: 'Play only immediately after playing another Fruit card.',
    more: 'Joy does not count as your one Fruit card for the turn. Play it right after another Fruit card goes on your tree.' },
  peace: { c: '#4a9fd6', ic: '🕊️', tx: 'When you play this, all players must discard a Deed card (if they have one).',
    more: 'Everyone, including you, discards one Deed card from their hand if they have one. Nobody draws a replacement.' },
  patience: { c: '#3fae49', ic: '🌿', tx: 'Skip a turn, then play this card on your next turn.',
    more: 'Skip a whole turn (no drawing, no discarding, no playing). On the turn after, Patience may be your one Fruit card.' },
  kindness: { c: '#e0668f', ic: '💗', tx: 'Play a needed card in front of an opponent, then play this card for you.',
    more: 'First choose a card from your hand that an opponent does not have showing, and put it on their tree. Then play Kindness on yours. An opponent holding Jealousy can snatch the card you give.' },
  goodness: { c: '#7a1f4a', ic: '🌸', tx: 'Recite the Fruit of the Spirit, then play this card.',
    more: 'Name all nine fruit of Galatians 5:22–23 from memory, in any order. “Longsuffering” for Patience is fine.' },
  faithfulness: { c: '#5b63ad', ic: '⚓', tx: 'When you draw this, immediately play or discard it, draw another, and continue.',
    more: 'You cannot play Faithfulness if it was dealt to you or taken from another player. Hint: discard it last, then pick it up from the discard pile when you draw back to five.' },
  gentleness: { c: '#1f9d8a', ic: '🌾', tx: 'Play this card and let an opponent take any other card from your hand.',
    more: 'Playing Gentleness counts as your one Fruit card. If you hold Joy you may play it first. Then your opponent looks at your hand and takes one card.' },
  selfcontrol: { c: '#7a3f9a', ic: '🍇', tx: 'Play this card and discard all Deed cards you have played or hold in your hand.',
    more: 'Deeds in your hand are discarded, and every Deed covering your fruit is removed, so those fruit show again. Deeds can only be discarded while Self-Control is showing.' },
  wild: { c: '#5d6b1f', ic: '🫒', tx: 'Play in place of any Fruit when you cannot play another Fruit card.',
    more: 'A Wild card needs none of the usual requirements. It counts as your one Fruit card for the turn.' },
  envy: { c: '#7a1313', ic: '🐍', tx: 'Take a card an opponent has played in front of them into your hand.',
    more: 'Deed. Covers one of your own Fruit cards. Counts as your one Deed card for the turn.' },
  jealousy: { c: '#7a1313', ic: '🐍', tx: 'Play when an opponent plays Kindness: take the card they are giving.',
    more: 'Deed. Play it the moment an opponent plays Kindness, without waiting for your turn. The card goes on your tree instead. It covers one of your own Fruit cards.' },
  revelry: { c: '#7a1313', ic: '🐍', tx: 'Look through the whole discard pile and choose one card to add to your hand.',
    more: 'Deed. Covers one of your own Fruit cards. Counts as your one Deed card for the turn.' },
  rivalry: { c: '#7a1313', ic: '🐍', tx: 'Blindly take a card from an opponent, then give them a card in return.',
    more: 'Deed. You may give back the card you just took. Covers one of your own Fruit cards. Counts as your one Deed card for the turn.' },
  uncleanness: { c: '#7a1313', ic: '🐍', tx: 'Play when another player discards a card you need: take it.',
    more: 'Deed. Play it the moment another player discards a card you need, without waiting for your turn. It covers one of your own Fruit cards.' },
};
const kind = (c) => (E.isDeed(c) ? 'Deed' : c === 'wild' ? 'Wild' : 'Fruit');
const cardHtml = (c, { cls = '', tag = 'div', attrs = '' } = {}) =>
  `<${tag} ${tag === 'button' ? 'type="button"' : ''} class="fp-c ${E.isDeed(c) ? 'deed' : ''} ${c === 'wild' ? 'wild' : ''} ${cls}" style="--c:${LOOK[c].c}" ${attrs} aria-label="${esc(E.name(c))}, ${kind(c)} card">`
  + `<span class="ic" aria-hidden="true">${LOOK[c].ic}</span><span class="nm">${esc(E.name(c))}</span><span class="tx">${esc(LOOK[c].tx)}</span><span class="ty">${kind(c)}</span></${tag}>`;
const FRUIT_COLOR = Object.fromEntries(E.FRUITS.map((f) => [f, LOOK[f].c]));

let S = null, cfg = null, token = 0, busy = false;
let ui = { msg: '' };

function save() { try { localStorage.setItem(KEY, JSON.stringify({ S, cfg })); } catch (e) { /* private mode */ } }
function load() { try { const v = JSON.parse(localStorage.getItem(KEY)); return v && v.S && v.S.v === 1 && v.cfg && !v.S.over ? v : null; } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
const helpOn = () => $('quiz-help').checked;
const show = (w) => { $('setup').hidden = w !== 'setup'; $('game').hidden = w !== 'game'; if (w === 'setup') { $('dock').hidden = true; document.body.classList.remove('has-dock'); } window.scrollTo(0, 0); };

// ---- starting --------------------------------------------------------------------------------------------------------------------
function startGame() {
  const n = Number($('bot-count').value), pick = $('bot-skill').value, skills = ['casual', 'steady', 'sharp'];
  const seed = Number(params.get('seed')) || Math.floor(Math.random() * 1e9) + 1;      // ?seed=N replays a deal (for testing)
  const players = [{ name: 'You', bot: false }, ...Array.from({ length: n }, (_, i) => ({ name: BOTS[i], bot: true, skill: pick === 'mixed' ? skills[(i + 1) % 3] : pick }))];
  cfg = { bots: n, skill: pick, seed };
  S = E.newGame({ seed, players, first: Math.floor(Math.random() * players.length) });
  ui = { msg: '' };
  save(); show('game'); render(); run();
}

// ---- words -----------------------------------------------------------------------------------------------------------------------
const nm = (p) => S.players[p].name;
const V = (who, base, third) => (who === 0 ? base : third || base + 's');
const pos = (p) => (p === 0 ? 'your' : `${nm(p)}’s`);
const N = (c) => E.name(c);
const spotName = (f) => N(f);
function said(e) {
  const W = nm(e.who ?? 0), me = (x) => x === 0, seen = (...ps) => ps.some(me);
  switch (e.k) {
    case 'skip': return `${W} ${V(e.who, 'skip')} the turn.`;
    case 'draw': return e.from === 'discard' ? `${W} ${V(e.who, 'take')} ${N(e.card)} from the discard pile.` : `${W} ${V(e.who, 'draw')} a card from the draw pile.`;
    case 'play': return e.card === 'wild' ? `${W} ${V(e.who, 'play')} a Wild card as ${spotName(e.spot)}.` : `${W} ${V(e.who, 'play')} ${N(e.card)}.`;
    case 'goodness': return e.ok ? `${W} recited the nine fruit.` : `${W} could not recite all nine fruit.`;
    case 'love': return `${W} ${V(e.who, 'remove')} ${plural(e.n, 'Deed card')} from ${pos(e.target)} tree.`;
    case 'selfcontrol': return `${W} ${V(e.who, 'discard')} ${plural(e.hand, 'Deed card')} from ${me(e.who) ? 'your' : 'their'} hand and ${V(e.who, 'remove')} ${plural(e.tree, 'Deed card')} from ${me(e.who) ? 'your' : 'their'} tree.`;
    case 'peace': return `Everyone must discard a Deed card.`;
    case 'peaceDiscard': return `${W} ${V(e.who, 'discard')} ${N(e.card)}.`;
    case 'kindness': return `${W} ${V(e.who, 'play')} ${N(e.card)} for ${me(e.target) ? 'you' : nm(e.target)}.`;
    case 'gift': return `${N(e.card)} goes on ${pos(e.target)} tree.`;
    case 'jealousy': return `${W} ${V(e.who, 'play')} Jealousy and ${V(e.who, 'take')} the ${N(e.card)} that ${me(e.target) ? 'you were' : `${nm(e.target)} was`} given.`;
    case 'deed': return `${W} ${V(e.who, 'play')} ${N(e.card)}, covering ${me(e.who) ? 'your own' : 'their own'} ${N(e.cover)}.`;
    case 'envy': return `${W} ${V(e.who, 'take')} ${N(e.card)} from ${pos(e.target)} tree.`;
    case 'revelry': return `${W} ${V(e.who, 'take')} ${N(e.card)} from the discard pile.`;
    case 'rivalry': return `${W} blindly ${V(e.who, 'take')} ${seen(e.who, e.target) ? N(e.card) : 'a card'} from ${me(e.target) ? 'you' : nm(e.target)}.`;
    case 'give': return `${W} ${V(e.who, 'give')} ${me(e.target) ? 'you' : nm(e.target)} ${seen(e.who, e.target) ? N(e.card) : 'a card'}.`;
    case 'gentle': return e.empty ? `${W} had no cards to hand over.` : `${W} ${V(e.who, 'hand')} ${me(e.target) ? 'you' : nm(e.target)} ${me(e.who) ? 'your' : 'their'} cards.`;
    case 'take': return `${W} ${V(e.who, 'take')} ${seen(e.who, e.from) ? N(e.card) : 'a card'} from ${me(e.from) ? 'your' : `${nm(e.from)}’s`} hand.`;
    case 'discard': return `${W} ${V(e.who, 'discard')} ${N(e.card)}${e.drawn ? ' (just drawn)' : ''}.`;
    case 'uncleanness': return `${W} ${V(e.who, 'play')} Uncleanness and ${V(e.who, 'take')} the ${N(e.card)} ${me(e.from) ? 'you' : nm(e.from)} discarded.`;
    case 'reshuffle': return 'The discard pile is shuffled to make a new draw pile.';
    case 'win': return `${W} ${V(e.who, 'win')}!`;
    case 'limit': return 'The game has gone on a very long time.';
    default: return '';
  }
}

// ---- the computer players --------------------------------------------------------------------------------------------------------
async function run() {
  const my = ++token;
  while (S && !S.over && E.actor(S) !== 0) {
    const seat = E.actor(S), p = S.players[seat];
    ui.msg = `${p.name} is playing…`; render();
    await sleep(900); if (my !== token) return;
    let a = AI.choose(S, p.skill);
    if (a && a.t === 'play' && a.card === 'goodness' && !AI.recites(p.skill)) a = { t: 'goodnessFail' };
    if (!a) break;
    S = E.apply(S, a); save(); render();
  }
  ui.msg = ''; save(); render();
  if (S.over) { showFinal(); return; }
  if (S.pending && S.pending.actor === 0) await answerPending(my);
  else if (S.phase === 'faith' && S.turn === 0) await faithDialog(my);
}
function act(a) {
  try { S = E.apply(S, a); } catch (e) { console.error(e); return; }
  ui.msg = ''; save(); render(); run();
}

// ---- asking you things ------------------------------------------------------------------------------------------------------------
// ask({title, html, options:[{label, sub, value, color, html}], cancel}) -> the chosen value, or null if cancelled
function ask({ title, html = '', options = [], cancel = false }) {
  const d = $('ask'), f = $('ask-form');
  return new Promise((resolve) => {
    f.innerHTML = `<h2 class="h5" id="ask-title">${esc(title)}</h2>${html}<div class="fp-opts">${options.map((o, i) => `<button type="button" class="${o.html ? 'p-0 border-0 bg-transparent' : 'fp-opt'}" data-i="${i}" ${o.color ? `style="--c:${o.color}"` : ''}>${o.html || `${esc(o.label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}`}</button>`).join('')}</div>${cancel ? '<button type="button" class="btn btn-outline-secondary btn-sm" data-i="-1">Cancel</button>' : ''}`;
    let done = false;
    const finish = (v) => { if (done) return; done = true; d.removeEventListener('cancel', onCancel); f.onclick = null; if (d.open) d.close(); resolve(v); };
    const onCancel = (e) => { if (!cancel) e.preventDefault(); else finish(null); };
    d.addEventListener('cancel', onCancel);
    f.onclick = (e) => { const b = e.target.closest('[data-i]'); if (!b) return; const i = Number(b.dataset.i); finish(i < 0 ? null : options[i].value); };
    d.showModal();
  });
}
const cardOption = (c) => ({ value: c, html: cardHtml(c, { cls: 'can', tag: 'span' }) });
const plainName = (i) => (i === 0 ? 'You' : nm(i));

async function answerPending(my) {
  const P = S.pending, L = E.legal(S);
  let a = null;
  if (P.kind === 'jealous' || P.kind === 'uncl') {
    const jealous = P.kind === 'jealous', card = jealous ? P.give : P.card;
    const html = `<p>${jealous ? `${esc(nm(P.from))} played Kindness, giving ${esc(plainName(P.target) === 'You' ? 'you' : nm(P.target))} <b>${N(card)}</b>.` : `${esc(nm(P.from))} discarded <b>${N(card)}</b>, a card you could use.`}</p>
      <p class="small">${jealous ? 'Play Jealousy to take it for yourself?' : 'Play Uncleanness to take it into your hand?'} A Deed always covers one of your own fruit.</p>${cardHtml(card, { cls: 'big' }).replace('fp-c ', 'fp-c mx-auto ')}`;
    const yes = await ask({ title: jealous ? 'Play Jealousy?' : 'Play Uncleanness?', html, options: [{ label: `Yes, play ${jealous ? 'Jealousy' : 'Uncleanness'}`, value: true }, { label: 'No thanks', value: false }] });
    if (my !== token) return;
    if (!yes) a = { t: 'pass' };
    else {
      const covers = L.filter((x) => x.t !== 'pass');
      let cv = covers[0].cover;
      if (covers.length > 1) { cv = await ask({ title: 'Which of your fruit will it cover?', html: '<p class="small">You will need to earn it again, or redeem it with Self-Control.</p>', options: covers.map((x) => ({ label: N(x.cover), value: x.cover, color: FRUIT_COLOR[x.cover] })) }); if (my !== token) return; }
      a = covers.find((x) => x.cover === cv);
    }
  } else if (P.kind === 'give') {
    const v = await ask({ title: `Give ${nm(P.target)} a card`, html: `<p class="small">You took a card from ${esc(nm(P.target))}. Now choose a card from your hand to give back. You may give back the card you just took.</p>`, options: L.map((x) => cardOption(x.card)) });
    if (my !== token) return; a = { t: 'give', card: v };
  } else if (P.kind === 'take') {
    const v = await ask({ title: `${nm(P.from)} hands you their cards`, html: '<p class="small">Look through them and take one for your own hand.</p>', options: L.map((x) => cardOption(x.card)) });
    if (my !== token) return; a = { t: 'take', card: v };
  } else if (P.kind === 'peace') {
    const v = await ask({ title: 'Peace: discard a Deed', html: '<p class="small">Everyone must discard a Deed card. Choose which of yours goes.</p>', options: L.map((x) => cardOption(x.card)) });
    if (my !== token) return; a = { t: 'peaceDiscard', card: v };
  }
  if (a) act(a);
}
async function faithDialog(my) {
  const L = E.legal(S), canPlay = L.some((a) => a.play);
  const v = await ask({ title: 'You drew Faithfulness!', html: `<p class="small">Faithfulness must be played or discarded the moment you draw it. Then you draw another card.${canPlay ? '' : ' Your Faithfulness space is already full, so it has to be discarded.'}</p>${cardHtml('faithfulness', { cls: 'big' }).replace('fp-c ', 'fp-c mx-auto ')}`,
    options: [...(canPlay ? [{ label: 'Play it on my tree', value: true }] : []), { label: 'Discard it', value: false }] });
  if (my !== token) return; act({ t: 'faith', play: v });
}

// Goodness: say the nine fruit.
function quiz() {
  const d = $('ask'), f = $('ask-form');
  return new Promise((resolve) => {
    f.innerHTML = `<h2 class="h5" id="ask-title">Recite the Fruit of the Spirit</h2><p class="small">Type all nine, in any order (Galatians 5:22–23). “Longsuffering” for Patience is fine.</p>
      <textarea class="form-control" id="quiz-text" rows="3" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="love, joy, …"></textarea>
      <p class="mt-2 mb-1" aria-live="polite"><span class="fp-quiz-n" id="quiz-n"></span> <span class="small text-muted" id="quiz-hint"></span></p>
      <div class="d-flex flex-wrap gap-2 mt-2"><button type="button" class="btn btn-primary" data-q="go">Check</button><button type="button" class="btn btn-outline-secondary" data-q="no">I give up</button></div>`;
    let done = false;
    const finish = (v) => { if (done) return; done = true; d.removeEventListener('cancel', onCancel); f.onclick = null; if (d.open) d.close(); resolve(v); };
    const onCancel = (e) => { e.preventDefault(); };
    d.addEventListener('cancel', onCancel);
    const go = () => {
      const r = checkRecital($('quiz-text').value);
      if (r.ok) { finish(true); return; }
      $('quiz-n').textContent = `${r.count} of 9.`;
      $('quiz-hint').textContent = helpOn() ? `Still to find: ${E.FRUITS.filter((x) => !r.found.includes(x)).map((x) => N(x)[0]).join(' ')}` : 'Keep going, or give up.';
    };
    f.onclick = (e) => { const b = e.target.closest('[data-q]'); if (!b) return; if (b.dataset.q === 'go') go(); else finish(false); };
    d.showModal(); $('quiz-text').focus();
  });
}

// ---- your turn -------------------------------------------------------------------------------------------------------------------
const mine = () => !!S && !S.over && E.actor(S) === 0;
// Ask for whichever choices still differ between the possible actions, then return the one chosen action.
async function gather(list, c) {
  const labels = {
    target: () => ({ title: 'Which opponent?', opt: (v) => ({ label: nm(v), sub: `${plural(E.upCount(S.players[v]), 'fruit')} showing, ${plural(S.players[v].hand.length, 'card')} in hand`, value: v }) }),
    give: () => ({ title: 'Which card do you play for them?', html: '<p class="small">It must be a card they do not have showing.</p>', opt: (v) => cardOption(v) }),
    spot: () => ({ title: c === 'envy' ? 'Which of their fruit do you take?' : c === 'kindness' ? 'Which fruit space does the Wild card fill for them?' : 'Which fruit does the Wild card stand for?', opt: (v) => ({ label: N(v), value: v, color: FRUIT_COLOR[v] }) }),
    pick: () => ({ title: 'Which card do you take from the discard pile?', opt: (v) => cardOption(v) }),
    cover: () => ({ title: 'Which of your fruit will this Deed cover?', html: '<p class="small">It will need to be earned again, or redeemed by Self-Control or an opponent’s Love.</p>', opt: (v) => ({ label: N(v), value: v, color: FRUIT_COLOR[v] }) }),
  };
  for (const key of ['target', 'give', 'spot', 'pick', 'cover']) {
    const vals = [...new Set(list.map((a) => a[key]).filter((v) => v !== undefined && v !== null))];
    if (vals.length > 1) {
      const l = labels[key](), v = await ask({ title: l.title, html: l.html || '', options: vals.map(l.opt), cancel: true });
      if (v === null || v === undefined) return null;
      list = list.filter((a) => a[key] === v);
    }
  }
  return list[0];
}
async function openCard(c, { fromHand = true } = {}) {
  if (busy) return; busy = true; const my = token;
  try {
    const L = mine() && fromHand ? E.legal(S) : [], plays = L.filter((a) => (a.t === 'play' || a.t === 'deed') && a.card === c), canDiscard = L.some((a) => a.t === 'discard' && a.card === c);
    const reason = fromHand && mine() && S.phase === 'main' && !plays.length ? E.whyNot(S, 0, c) : '';
    const opts = [];
    if (plays.length) opts.push({ label: E.isDeed(c) ? 'Play this Deed' : 'Play this card', value: 'play' });
    if (canDiscard) opts.push({ label: 'Discard it', value: 'discard' });
    opts.push({ label: 'Close', value: 'close' });
    const v = await ask({ title: N(c), html: `<div class="fp-cardview">${cardHtml(c, { cls: 'big' })}<p class="small mb-0">${esc(LOOK[c].more)}</p>${reason ? `<p class="fp-why mb-0">${esc(reason)}</p>` : ''}</div>`, options: opts });
    if (my !== token) return;
    if (v === 'discard') { busy = false; act({ t: 'discard', card: c }); return; }
    if (v === 'play') {
      if (plays[0].recite) {
        const ok = await quiz();
        if (!ok) { busy = false; act({ t: 'goodnessFail' }); return; }
      }
      const a = await gather(plays, c);
      if (a) { busy = false; act(a); }
    }
  } finally { busy = false; }
}
function doDo(what) {
  if (!mine() || busy) return;
  if (what === 'pile') act({ t: 'draw', from: 'pile' });
  else if (what === 'discard') act({ t: 'draw', from: 'discard' });
  else if (what === 'skip') act({ t: 'skip' });
  else if (what === 'end') act({ t: 'end' });
  else if (what === 'handover') act({ t: 'handover' });
}
async function viewDiscards() {
  const d = S.discard;
  await ask({ title: `The discard pile (${plural(d.length, 'card')})`, html: d.length ? `<div class="fp-hand mb-2">${[...d].reverse().map((c, i) => cardHtml(c, { cls: 'mini' })).join('')}</div><p class="small text-muted">Newest first. The top card may be taken instead of drawing.</p>` : '<p>Empty.</p>', options: [{ label: 'Close', value: 1 }] });
}

// ---- drawing the page ------------------------------------------------------------------------------------------------------------
function render() {
  if (!S) return;
  renderBar(); renderOpps(); renderPiles(); renderMe(); renderHand(); renderLog(); renderDock();
}
function treeHtml(p) {
  return `<div class="fp-tree">${E.FRUITS.map((f) => {
    const s = p.tree[f];
    const cls = s.s === 1 ? `up${s.wild ? ' wild' : ''}` : s.s === 2 ? 'cov' : '';
    const st = s.s === 1 ? (s.wild ? 'Wild' : 'showing') : s.s === 2 ? `covered by ${E.name(s.d)}` : 'empty';
    return `<div class="fp-slot ${cls}" style="--c:${FRUIT_COLOR[f]}" title="${esc(N(f))}: ${esc(st)}"><span class="nm">${esc(N(f))}</span><span class="st">${esc(st)}</span></div>`;
  }).join('')}</div>`;
}
const pips = (p) => `<span class="fp-pips" aria-label="${E.upCount(p)} of 9 fruit showing">${'●'.repeat(E.upCount(p))}${'○'.repeat(9 - E.upCount(p))}</span>`;
function renderBar() {
  $('bar').innerHTML = S.players.map((p, i) => `<div class="fp-score${i === S.turn && !S.over ? ' is-turn' : ''}"><span class="n">${esc(p.name)}</span>${pips(p)}</div>`).join('')
    + `<div class="fp-round">Round ${S.round}</div>`;
}
function renderOpps() {
  $('opps').innerHTML = S.players.map((p, i) => i === 0 ? '' : `<div class="fp-opp${i === S.turn && !S.over ? ' is-turn' : ''}">
    <div class="fp-opp-head"><span>${esc(p.name)}</span>${p.patient ? '<span class="fp-flag" title="Skipped a turn: Patience is ready">Patience ready</span>' : ''}<span class="meta">${plural(E.upCount(p), 'fruit')} &middot; ${plural(p.hand.length, 'card')} in hand</span></div>${treeHtml(p)}</div>`).join('');
}
function renderPiles() {
  const top = S.discard[S.discard.length - 1];
  $('piles').innerHTML = `<div class="fp-pile"><div class="fp-c fp-back" aria-hidden="true">🌳</div>Draw pile<br>${S.draw.length} cards</div>
    <div class="fp-pile">${top ? cardHtml(top, { cls: 'mini', tag: 'button', attrs: 'data-read="' + top + '"' }) : '<div class="fp-c mini" style="--c:#adb5bd"></div>'}Discard pile<br>${S.discard.length} cards<br><button type="button" class="btn btn-link btn-sm p-0" data-do="look">Look through it</button></div>`;
}
function renderMe() {
  const p = S.players[0];
  $('me').className = `fp-me${S.turn === 0 && !S.over ? ' is-turn' : ''}`;
  $('me').innerHTML = `<div class="small mb-1"><b>${plural(E.upCount(p), 'fruit')} showing</b>${p.canPatience && S.turn === 0 ? '<span class="fp-flag">Patience ready</span>' : p.patient ? '<span class="fp-flag">Patience ready next turn</span>' : ''}</div>${treeHtml(p)}`;
}
function renderHand() {
  const p = S.players[0], L = mine() ? E.legal(S) : [];
  const usable = new Set(L.filter((a) => a.t === 'play' || a.t === 'deed' || (a.t === 'discard' && S.phase === 'refill')).map((a) => a.card));
  $('hand').innerHTML = p.hand.map((c) => cardHtml(c, { tag: 'button', cls: usable.has(c) ? 'can' : '', attrs: `data-card="${c}"` })).join('') || '<span class="text-muted">No cards in hand.</span>';
  $('hand-note').textContent = mine() && S.phase === 'main' ? 'Tap a card to read it, play it or discard it.' : 'Tap a card to read it.';
}
function renderLog() {
  $('log').innerHTML = S.log.slice(-16).map((e) => { const t = said(e); return t ? `<li class="${e.who === 0 ? 'me' : e.k === 'reshuffle' || e.k === 'peace' ? 'note' : ''}">${esc(t)}</li>` : ''; }).join('') || '<li>Nothing yet.</li>';
}
function renderDock() {
  const on = !S.over; $('dock').hidden = !on; document.body.classList.toggle('has-dock', on);
  if (!on) return;
  const L = mine() ? E.legal(S) : [], top = S.discard[S.discard.length - 1];
  let t = '', acts = '';
  const btn = (id, label, cls = 'btn-primary') => `<button type="button" class="btn ${cls}" data-do="${id}">${label}</button>`;
  const drawBtns = () => (L.some((a) => a.t === 'draw' && a.from === 'pile') ? btn('pile', 'Draw a card') : '') + (L.some((a) => a.t === 'draw' && a.from === 'discard') ? btn('discard', `Take ${esc(N(top))} from the discard pile`, 'btn-outline-primary') : '');
  if (!mine()) {
    const last = S.log.slice(-1).map(said).join('');
    t = esc(ui.msg || `${S.players[S.turn].name}’s turn…`) + (last ? `<small>${esc(last)}</small>` : '');
  } else if (S.pending) t = 'Your answer is needed…';
  else if (S.phase === 'start') { t = `Your turn.<small>Draw a card from either pile${me0().canPatience ? ', or play Patience now' : ', or skip your turn'}.</small>`; acts = drawBtns() + btn('skip', 'Skip my turn', 'btn-outline-secondary'); }
  else if (S.phase === 'draw1') { t = 'Draw another card.'; acts = drawBtns(); }
  else if (S.phase === 'gentle') { t = `Gentleness played.<small>${L.some((a) => a.t === 'play') ? 'Play your Joy now if you like, then' : 'Now'} hand your cards to ${esc(nm(S.gentle))}.</small>`; acts = btn('handover', `Hand my cards to ${esc(nm(S.gentle))}`); }
  else if (S.phase === 'main') {
    const f = S.flags;
    t = `Play a Fruit card${f.fruit ? ' (done)' : ''}, a Deed card${f.deed ? ' (done)' : ''}, and discard what you do not need.<small>${f.joy ? 'You may play Joy now. ' : ''}Tap a card in your hand.</small>`;
    acts = btn('end', 'End my turn');
  } else if (S.phase === 'refill') {
    if (me0().hand.length < E.HAND) { t = `Draw back up to five cards (${E.HAND - me0().hand.length} to go).`; acts = drawBtns(); }
    else t = `You have too many cards. Tap a card to discard it (${me0().hand.length - E.HAND} to go).`;
  }
  $('status').innerHTML = t; $('actions').innerHTML = acts;
}
const me0 = () => S.players[0];

// ---- the end ---------------------------------------------------------------------------------------------------------------------
function showFinal() {
  const w = S.winner, order = S.players.map((p, i) => ({ ...p, i })).sort((a, b) => E.upCount(b) - E.upCount(a));
  $('final-title').textContent = w === 0 ? 'You win! All nine fruit are showing.' : w === null ? 'The game ends in a tie' : `${S.players[w].name} wins`;
  const why = S.endedBy === 'limit' ? 'The game ran very long, so the player with the most fruit showing wins.' : w === 0 ? 'You collected the fruit of the Spirit: love, joy, peace, patience, kindness, goodness, faithfulness, gentleness and self-control.' : `${S.players[w].name} was first to show all nine fruit.`;
  $('final-body').innerHTML = `<p class="small text-muted">${esc(why)}</p>` + order.map((p) => `<div class="fp-final-row${p.i === w ? ' win' : ''}"><span>${esc(p.name)}</span><span>${plural(E.upCount(p), 'fruit')} showing</span></div><div class="my-2">${treeHtml(p)}</div>`).join('')
    + '<p class="small mt-3 mb-0">&ldquo;But the fruit of the Spirit is love, joy, peace, patience, kindness, goodness, faithfulness, gentleness, self-control; against such things there is no law.&rdquo; Galatians 5:22&ndash;23</p>';
  $('final-body').insertAdjacentHTML('beforeend', '<div id="share-slot"></div>');
  mountShare($('share-slot'), structuredClone(S));
  clearSave();
  if (!$('final').open) $('final').showModal();
}

// Share the result as a picture: the share sheet where the browser offers it, plus a download and copyable text (which has the link).
function mountShare(root, snap) {
  const box = document.createElement('div');
  box.innerHTML = `<h3 class="h6 mt-3">Share your result</h3><div class="d-flex flex-wrap gap-2 my-2"><button type="button" class="btn btn-primary btn-sm" id="share-native" hidden>Share\u2026</button>
    <button type="button" class="btn btn-primary btn-sm" id="share-dl" disabled>Download image</button>
    <button type="button" class="btn btn-outline-secondary btn-sm" id="share-copy">Copy text and link</button></div>
    <img class="img-fluid rounded shadow-sm" alt="Your result: your Fruit Tree and the final standings" hidden>
    <p class="small text-muted mb-0" id="share-msg" aria-live="polite">Drawing your result picture\u2026</p>`;
  root.appendChild(box);
  const im = box.querySelector('img'), msg = box.querySelector('#share-msg'), dl = box.querySelector('#share-dl'), nat = box.querySelector('#share-native');
  box.querySelector('#share-copy').onclick = async () => { try { await navigator.clipboard.writeText(shareMessage(snap)); msg.textContent = 'Copied. Paste it anywhere.'; } catch { msg.textContent = shareMessage(snap); } };
  (async () => {
    try {
      const blob = await canvasToBlob(drawShareImage(document.createElement('canvas'), snap)), url = URL.createObjectURL(blob);
      im.src = url; im.hidden = false; dl.disabled = false; msg.textContent = '';
      const file = new File([blob], 'fruit-of-the-spirit.png', { type: 'image/png' });
      nat.hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
      dl.onclick = () => { const a = document.createElement('a'); a.href = url; a.download = 'fruit-of-the-spirit.png'; document.body.appendChild(a); a.click(); a.remove(); };
      nat.onclick = async () => { try { await navigator.share(nativeShareData(file, snap)); } catch { /* cancelled */ } };
    } catch { msg.textContent = 'Sorry, the picture could not be drawn in this browser. You can still copy the text.'; }
  })();
}

// ---- wiring ----------------------------------------------------------------------------------------------------------------------
function onClick(e) {
  const c = (sel) => e.target.closest && e.target.closest(sel);
  const h = c('[data-card]'); if (h) { openCard(h.dataset.card); return; }
  const r = c('[data-read]'); if (r) { openCard(r.dataset.read, { fromHand: false }); return; }
  const b = c('[data-do]'); if (b) { if (b.dataset.do === 'look') viewDiscards(); else doDo(b.dataset.do); }
}
function init() {
  try { $('quiz-help').checked = localStorage.getItem(HELP) === '1'; } catch (e) { /* ignore */ }
  $('quiz-help').addEventListener('change', (e) => { try { localStorage.setItem(HELP, e.target.checked ? '1' : '0'); } catch (x) { /* ignore */ } });
  $('start-btn').addEventListener('click', () => { clearSave(); token++; startGame(); });
  $('menu-btn').addEventListener('click', () => { token++; refreshResume(); show('setup'); });
  $('final-again').addEventListener('click', () => { clearSave(); token++; show('setup'); refreshResume(); });
  $('resume-btn').addEventListener('click', () => { const v = load(); if (!v) return; S = v.S; cfg = v.cfg; ui = { msg: '' }; show('game'); render(); run(); });
  $('discard-btn').addEventListener('click', () => { clearSave(); refreshResume(); });
  document.addEventListener('click', onClick);
  refreshResume();
  const v = load();
  if (v && params.has('resume')) $('resume-btn').click();
  if (params.has('debug')) window.fp = { get S() { return S; }, E, AI, act };
}
function refreshResume() { const v = load(); $('resume').hidden = !v; if (v) { $('bot-count').value = String(v.cfg.bots); $('bot-skill').value = v.cfg.skill; } }
init();
