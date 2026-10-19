// Shareable result image: a PNG of the finished game (the board with Tyndale's route, the turns and the scripture delivered).
import * as E from './engine.js';
import { PX } from './board-data.js';

export const SHARE_URL = 'https://sdggames.fun/Tyndale/play/';
export const shareMessage = (headline) => `${headline} ${SHARE_URL}`;
// The link lives in the text only. Passing it again as `url` makes many messaging apps paste it twice.
export const nativeShareData = (file, headline) => ({ files: [file], text: shareMessage(headline) });

export const SHARE_W = 1200, SHARE_H = 1040;
const SANS = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const px = (id) => PX[E.colOf(id)], py = (id) => PX[E.rowOf(id)];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function fit(ctx, text, maxW, size, weight, family) {
  let s = size;
  for (; s > 14; s -= 1) { ctx.font = `${weight} ${s}px ${family}`; if (ctx.measureText(text).width <= maxW) break; }
  return s;
}
const loadImage = (src) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });

// info: { title, turnsLabel, detail, boardSrc, colours: [one per seat], labels: [one per seat] }
export async function drawShareImage(canvas, state, info) {
  canvas.width = SHARE_W; canvas.height = SHARE_H;
  const ctx = canvas.getContext('2d');
  const sm = E.summary(state);
  const board = await loadImage(info.boardSrc);

  const bg = ctx.createLinearGradient(0, 0, SHARE_W, SHARE_H);
  bg.addColorStop(0, '#0f1020'); bg.addColorStop(0.55, '#232a5c'); bg.addColorStop(1, '#7a1f26');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, SHARE_W, SHARE_H);

  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = '#f0c36a'; ctx.font = `700 58px ${SERIF}`;
  ctx.fillText('TYNDALE', 48, 86);
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  const s = fit(ctx, info.title, 760, 28, 600, SANS);
  ctx.font = `600 ${s}px ${SANS}`;
  ctx.fillText(info.title, 50, 130);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff'; ctx.font = `800 96px ${SANS}`;
  ctx.fillText(String(sm.turns), SHARE_W - 48, 108);
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = `600 20px ${SANS}`;
  ctx.fillText(info.turnsLabel, SHARE_W - 50, 138);

  // the board, with his route
  const bx = 36, by = 168, bs = 800;
  ctx.save();
  roundRect(ctx, bx - 6, by - 6, bs + 12, bs + 12, 14); ctx.fillStyle = '#0f1020'; ctx.fill();
  ctx.translate(bx, by);
  roundRect(ctx, 0, 0, bs, bs, 10); ctx.clip();
  ctx.drawImage(board, 0, 0, bs, bs);
  const tr = state.t.trail;
  // everyone's route, to show how close the Agents got (drawn first, so his route stays on top)
  const col = (seat) => (info.colours && info.colours[seat]) || '#6c757d';
  for (const p of state.pawns) {
    const rt = p.trail && p.trail.length ? p.trail : p.pos ? [p.pos] : [];
    if (!rt.length) continue;
    ctx.strokeStyle = col(p.seat); ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.globalAlpha = p.out ? 0.55 : 0.9;
    ctx.beginPath(); rt.forEach((id, i) => (i ? ctx.lineTo(px(id), py(id)) : ctx.moveTo(px(id), py(id)))); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = col(p.seat); ctx.lineWidth = 3;                         // where it started: an open ring
    ctx.beginPath(); ctx.arc(px(rt[0]), py(rt[0]), 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const end = rt[rt.length - 1], nm = (state.seats[p.seat].name || '?')[0];                         // where it ended: a filled marker
    ctx.fillStyle = col(p.seat); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(px(end), py(end), 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `800 15px ${SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(nm, px(end), py(end) + 1);
    ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
  }
  ctx.strokeStyle = '#a3262e'; ctx.lineWidth = 5; ctx.setLineDash([12, 8]); ctx.lineJoin = 'round';
  ctx.beginPath(); tr.forEach((p, i) => (i ? ctx.lineTo(px(p), py(p)) : ctx.moveTo(px(p), py(p)))); ctx.stroke(); ctx.setLineDash([]);
  const dot = (p, col, label) => {
    ctx.fillStyle = col; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(px(p), py(p), 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.font = `800 20px ${SANS}`; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#1b1b2e';
    ctx.strokeText(label, px(p), py(p) - 28); ctx.fillText(label, px(p), py(p) - 28);
  };
  dot(tr[0], '#198754', 'Start'); dot(tr[tr.length - 1], '#a3262e', state.winner === 'agents' ? 'Caught' : 'Tyndale');
  ctx.restore();

  // the scripture delivered to London
  const cx = 872, cw = 292;
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = `700 26px ${SANS}`;
  ctx.fillText('Delivered to London', cx, 200);
  let y = 224;
  const rowH = 96;
  for (const l of E.PUBS) {
    const d = sm.delivered.find((q) => q.pub === l), sh = sm.shippedNotArrived.find((q) => q.pub === l);
    if (d) { ctx.fillStyle = '#f0c36a'; roundRect(ctx, cx, y, cw, rowH - 10, 12); ctx.fill(); }
    else if (sh) { ctx.fillStyle = 'rgba(240,195,106,.28)'; roundRect(ctx, cx, y, cw, rowH - 10, 12); ctx.fill(); }
    else { ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); roundRect(ctx, cx + 1.5, y + 1.5, cw - 3, rowH - 13, 12); ctx.stroke(); ctx.setLineDash([]); }
    ctx.textAlign = 'left';
    ctx.fillStyle = d ? '#1b1b2e' : '#fff';
    const name = E.PUB_NAMES[l], f = fit(ctx, name, cw - 28, 26, 700, SANS);
    ctx.font = `700 ${f}px ${SANS}`;
    ctx.fillText(name, cx + 14, y + 38);
    ctx.font = `600 20px ${SANS}`;
    ctx.fillStyle = d ? '#3b3b52' : 'rgba(255,255,255,.8)';
    ctx.fillText(d ? `arrived on turn ${d.round}` : sh ? `at sea, ${sh.left} move${sh.left === 1 ? '' : 's'} away` : 'not delivered', cx + 14, y + 68);
    y += rowH;
  }
  ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = `500 20px ${SANS}`;
  const lines = (info.detail || '').split('\n');
  lines.forEach((t, i) => ctx.fillText(t, cx, y + 26 + i * 28));

  // how close the Agents got, and whose route is whose
  const endSpot = state.t.trail[state.t.trail.length - 1];
  const live = state.pawns.filter((p) => !p.out && p.pos).map((p) => ({ p, d: E.dist(p.pos, endSpot) })).sort((a, b) => a.d - b.d);
  let ly = y + 26 + lines.length * 28 + 22;
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = `700 22px ${SANS}`;
  ctx.fillText('The Agents\u2019 routes', cx, ly);
  ctx.font = `500 17px ${SANS}`; ctx.fillStyle = 'rgba(255,255,255,.8)';
  if (live.length && state.endReason !== 'captured') ctx.fillText(`Nearest at the end: ${live[0].d} step${live[0].d === 1 ? '' : 's'} away`, cx, ly + 24);
  ly += 52;
  state.seats.forEach((seat, i) => {
    const label = (info.labels && info.labels[i]) || seat.name;
    ctx.fillStyle = col(i); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx + 11, ly - 7, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = seat.out ? 'rgba(255,255,255,.6)' : '#fff';
    const f = fit(ctx, label, cw - 40, 19, 600, SANS); ctx.font = `600 ${f}px ${SANS}`;
    ctx.fillText(label, cx + 30, ly);
    ly += 28;
  });

  ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = `600 24px ${SANS}`;
  ctx.fillText('Play free at sdggames.fun/Tyndale/play', SHARE_W - 36, SHARE_H - 22);
  ctx.textAlign = 'left';
  return canvas;
}

export const canvasToBlob = (canvas) => new Promise((resolve, reject) =>
  canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('could not encode the image'))), 'image/png'));
