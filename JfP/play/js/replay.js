// Step-by-step replay of each player's journey, shown on the results screen.
import { EV_NAMES, city, edge, sheetAt } from './engine.js';
import { boardSVG, legendHTML, esc, EV_COLOR } from './board.js';
import { snippetFor } from './scripture.js';

const SPEEDS = { slow: 1700, normal: 1000, fast: 450 };

export function describe(h) {
  const who = EV_NAMES[h.ev];
  if (h.k === 'move') return `${who} travels ${city(h.from).name} → ${city(h.to).name} by ${{ road: 'road', foot: 'footpath', boat: 'boat' }[edge(h.edge).mode]}`;
  return h.called ? `${who} is called as pastor in ${city(h.city).name}` : `${who} preaches in ${city(h.city).name}`;
}

// players: [{name, sheet}] (final sheets, each with its `history`); rules: the ruleset used.
export function mountReplay(root, { players, rules }) {
  let pi = 0, step = 0, timer = null;
  const hist = () => players[pi].sheet.history ?? [];
  const stop = () => { clearInterval(timer); timer = null; };

  root.innerHTML = `
    <div class="replay-tabs" role="tablist" aria-label="Whose journey"></div>
    <div class="board card shadow-sm replay-board"></div>
    <div class="replay-caption" aria-live="polite"></div>
    <div class="replay-controls">
      <button class="btn btn-outline-secondary btn-sm" data-r="first" title="Back to the start" aria-label="Back to the start">&#9198;</button>
      <button class="btn btn-outline-secondary btn-sm" data-r="back" title="Step back" aria-label="Step back">&#9664;</button>
      <button class="btn btn-primary btn-sm" data-r="play" style="min-width:6.5rem"></button>
      <button class="btn btn-outline-secondary btn-sm" data-r="fwd" title="Step forward" aria-label="Step forward">&#9654;</button>
      <input type="range" class="form-range replay-range" min="0" value="0" aria-label="Replay position" />
      <select class="form-select form-select-sm w-auto" data-r="speed" aria-label="Replay speed">
        <option value="slow">Slow</option><option value="normal" selected>Normal</option><option value="fast">Fast</option>
      </select>
    </div>
    <div class="replay-verse"></div>
    <div class="legend small text-muted mt-2"></div>`;
  const $r = (sel) => root.querySelector(sel);
  $r('.legend').innerHTML = legendHTML();

  function drawTabs() {
    const tabs = $r('.replay-tabs');
    tabs.hidden = players.length < 2;
    tabs.innerHTML = players.map((p, i) =>
      `<button type="button" role="tab" aria-selected="${i === pi}" class="btn btn-sm ${i === pi ? 'btn-dark' : 'btn-outline-dark'}" data-p="${i}">${esc(p.name)}</button>`).join('');
  }

  function draw() {
    const h = hist();
    const range = $r('.replay-range');
    range.max = h.length;
    range.value = step;
    range.disabled = h.length === 0;
    const last = step > 0 ? h[step - 1] : null;
    const flash = last ? (last.k === 'move' ? { edge: last.edge } : { city: last.city }) : null;
    $r('.replay-board').innerHTML = boardSVG(sheetAt(h, step, rules), { flash });

    const cap = $r('.replay-caption');
    if (!h.length) cap.textContent = 'No moves to replay.';
    else if (!last) cap.innerHTML = `<b>Start</b> &middot; Luke in Philippi, Silas in Antioch, Titus on Crete`;
    else cap.innerHTML = `<span class="step-no">Step ${step} of ${h.length}${last.round ? ` &middot; round ${last.round}` : ''}</span>
      <span class="dot-ev" style="background:${EV_COLOR[last.ev]}"></span>${esc(describe(last))}`;

    const verse = $r('.replay-verse');
    if (last?.k === 'preach') {
      const v = snippetFor(last.city, last.called);
      verse.innerHTML = verseHTML(v, EV_NAMES[last.ev]);
    } else verse.innerHTML = '';

    const play = $r('[data-r=play]');
    play.textContent = timer ? '⏸ Pause' : step >= h.length && h.length ? '↻ Replay' : '▶ Play';
    play.disabled = h.length === 0;
    $r('[data-r=first]').disabled = $r('[data-r=back]').disabled = step === 0;
    $r('[data-r=fwd]').disabled = step >= h.length;
  }

  function tick() {
    if (step >= hist().length) { stop(); return draw(); }
    step += 1;
    if (step >= hist().length) stop();
    draw();
  }
  function play() {
    if (timer) { stop(); return draw(); }
    if (step >= hist().length) step = 0;
    const ms = SPEEDS[$r('[data-r=speed]').value];
    timer = setInterval(tick, ms);
    tick();
  }

  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-p],[data-r]');
    if (!t) return;
    if (t.dataset.p !== undefined) { stop(); pi = Number(t.dataset.p); step = hist().length; drawTabs(); return draw(); }
    const r = t.dataset.r;
    if (r === 'play') return play();
    stop();
    if (r === 'first') step = 0;
    if (r === 'back') step = Math.max(0, step - 1);
    if (r === 'fwd') step = Math.min(hist().length, step + 1);
    draw();
  });
  root.addEventListener('input', (e) => {
    if (e.target.matches('.replay-range')) { stop(); step = Number(e.target.value); draw(); }
  });
  root.addEventListener('change', (e) => {
    if (e.target.matches('[data-r=speed]') && timer) { stop(); play(); }
  });

  step = hist().length; // open on the finished journey; Replay runs it from the start
  drawTabs();
  draw();
  return { stop };
}

export function verseHTML(v, who) {
  return `<figure class="verse">
    <figcaption class="verse-head">${esc(who ? `${who}: ${v.heading}` : v.heading)}</figcaption>
    <blockquote>${esc(v.text)}</blockquote>
    <div class="verse-ref">&mdash; ${esc(v.ref)} <span class="text-muted">(${esc(v.translation)}, public domain)</span></div>
    ${v.note ? `<div class="verse-note">${esc(v.note)}</div>` : ''}
  </figure>`;
}
