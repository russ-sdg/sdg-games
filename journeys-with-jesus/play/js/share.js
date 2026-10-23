// Shareable result picture: a PNG of the finished game (the board with every player's completed journeys, the standings).
import { PLACES } from './board-data.js';
import { drawBoard } from './board.js';
import * as E from './engine.js';

export const SHARE_URL = 'https://sdggames.fun/journeys-with-jesus/play/';
export const SHARE_W = 1200, SHARE_H = 880;
export const PLAYER_COLORS = ['#f2b21c', '#3b82f6', '#e11d48', '#16a34a'];
const SANS = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const ORD = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4) % 4] || 'th'}`;

// You are player 0. Place is by points (a tie shares the place).
export function result(state) {
  const st = E.standings(state);
  const you = st.find((x) => x.i === 0);
  const place = 1 + st.filter((x) => x.total > you.total).length;
  return { st, you, place };
}
export function shareMessage(state) {
  const { you, place } = result(state), n = state.players.length;
  return `I scored ${you.total} points in Journeys with Jesus and finished ${ORD(place)} of ${n}! ${SHARE_URL}`;
}
// The link lives in the text only. Passing it again as `url` makes many messaging apps paste it twice.
export const nativeShareData = (file, state) => ({ files: [file], text: shareMessage(state) });

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function fit(ctx, text, maxW, size, weight, family) {
  let s = size;
  for (; s > 12; s -= 1) { ctx.font = `${weight} ${s}px ${family}`; if (ctx.measureText(text).width <= maxW) break; }
  return s;
}

// The board as a picture, with each player's journeys drawn in their colour.
async function boardImage(state, w, h) {
  const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
  const routes = state.players.flatMap((p, i) => (p.routes || []).map((r) => ({ path: r.path, color: PLAYER_COLORS[i] })));
  drawBoard(svg, { routes });
  svg.setAttribute('xmlns', NS); svg.setAttribute('width', w); svg.setAttribute('height', h);
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
  await img.decode();
  return img;
}

export async function drawShareImage(canvas, state) {
  canvas.width = SHARE_W; canvas.height = SHARE_H;
  const ctx = canvas.getContext('2d');
  const { st, place } = result(state), win = E.winners(state);
  const bg = ctx.createLinearGradient(0, 0, SHARE_W, SHARE_H);
  bg.addColorStop(0, '#1d2410'); bg.addColorStop(0.6, '#3f4a1d'); bg.addColorStop(1, '#6b5a1c');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, SHARE_W, SHARE_H);

  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = '#f3c24b'; ctx.font = `700 54px ${SERIF}`;
  ctx.fillText('JOURNEYS WITH JESUS', 44, 78);
  const youWon = win.includes(0);
  ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.font = `600 28px ${SANS}`;
  ctx.fillText(win.length > 1 ? 'A tie at the top' : youWon ? 'I won!' : `${state.players[win[0]].name} won · I finished ${ORD(place)}`, 46, 120);

  // the board, with everybody's completed journeys
  const bw = 520, bh = Math.round(bw * 650 / 450), bx = 44, by = 148;
  try {
    const img = await boardImage(state, bw, bh);
    ctx.save(); roundRect(ctx, bx, by, bw, bh, 18); ctx.clip(); ctx.drawImage(img, bx, by, bw, bh); ctx.restore();
  } catch { ctx.fillStyle = 'rgba(255,255,255,.1)'; roundRect(ctx, bx, by, bw, bh, 18); ctx.fill(); }

  // standings
  const x0 = 620, w0 = SHARE_W - x0 - 44;
  let y = 160;
  st.forEach((r, rank) => {
    const col = PLAYER_COLORS[r.i], isWin = win.includes(r.i);
    ctx.fillStyle = isWin ? 'rgba(243,194,75,.22)' : 'rgba(255,255,255,.1)'; roundRect(ctx, x0, y, w0, 92, 16); ctx.fill();
    ctx.fillStyle = col; roundRect(ctx, x0, y, 14, 92, 7); ctx.fill();
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = `700 32px ${SANS}`;
    ctx.fillText(`${rank + 1}. ${r.name}`, x0 + 34, y + 40);
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = `500 22px ${SANS}`;
    const p = state.players[r.i];
    ctx.fillText(`${p.journeys.length} journey${p.journeys.length === 1 ? '' : 's'} · ${r.journeys} points${p.tokens ? ` · ${p.tokens} token${p.tokens > 1 ? 's' : ''} (+${r.tokens})` : ''}`, x0 + 34, y + 72);
    ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.font = `800 52px ${SANS}`;
    ctx.fillText(String(r.total), x0 + w0 - 24, y + 62);
    y += 104;
  });

  // your journeys
  const mine = state.players[0].journeys.map((id) => E.journeyById[id]).sort((a, b) => b.points - a.points);
  ctx.textAlign = 'left'; ctx.fillStyle = '#f3c24b'; ctx.font = `700 24px ${SANS}`;
  y += 22;
  ctx.fillText(mine.length ? 'My journeys' : 'No journeys completed this time', x0, y);
  y += 12;
  const rowH = 36, maxRows = Math.max(0, Math.floor((SHARE_H - 70 - y) / rowH));
  mine.slice(0, maxRows).forEach((j, i) => {
    const yy = y + 28 + i * rowH, label = `${PLACES[j.a].name} to ${PLACES[j.b].name}`;
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
    const size = fit(ctx, label, w0 - 90, 23, 500, SANS); ctx.font = `500 ${size}px ${SANS}`;
    ctx.fillText(label, x0, yy);
    ctx.textAlign = 'right'; ctx.fillStyle = '#f3c24b'; ctx.font = `700 24px ${SANS}`; ctx.fillText(String(j.points), x0 + w0, yy);
  });
  if (mine.length > maxRows) { ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = `500 20px ${SANS}`; ctx.fillText(`and ${mine.length - maxRows} more`, x0, y + 28 + maxRows * rowH); }

  ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = `600 24px ${SANS}`;
  ctx.fillText('Play free at sdggames.fun/journeys-with-jesus/play', SHARE_W - 44, SHARE_H - 26);
  ctx.textAlign = 'left';
  return canvas;
}

export const canvasToBlob = (canvas) => new Promise((resolve, reject) =>
  canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('could not encode the image'))), 'image/png'));
