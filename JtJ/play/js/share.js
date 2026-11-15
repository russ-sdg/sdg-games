// Shareable result picture: a PNG of the finished game (standings and the journeys you completed), with the link to play.
import * as E from './engine.js';
import { CARD, cardImage } from './cards.js';
import { COLORS } from './map-data.js';

export const SHARE_URL = 'https://sdggames.fun/JtJ/play/';
export const SHARE_W = 1200;
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif', SERIF = 'Georgia, "Times New Roman", serif';
const ORD = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4) % 4] || 'th'}`;
const journeys = (n) => `${n} journey${n === 1 ? '' : 's'}`;

// You are player 0. Place is by points (a tie shares the place).
export function result(S) {
  const you = S.players[0], pts = E.score(you), won = S.winners.includes(0);
  return { you, pts, won, tied: won && S.winners.length > 1, place: 1 + S.players.filter((p) => E.score(p) > pts).length };
}
export function headline(S) {
  const { you, pts, won, tied, place } = result(S);
  if (won) return tied ? `I tied for the win with ${pts} points!` : `I won with ${pts} points and ${journeys(you.done.length)}!`;
  return `I scored ${pts} points with ${journeys(you.done.length)} and finished ${ORD(place)}.`;
}
export function shareMessage(S) {
  const n = S.players.length - 1;
  return `${headline(S)} Journeys through Jerusalem, against ${n} computer player${n > 1 ? 's' : ''}. ${SHARE_URL}`;
}
// The link lives in the text only. Passing it again as `url` makes many messaging apps paste it twice.
export const nativeShareData = (file, S) => ({ files: [file], text: shareMessage(S) });

const roundRect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
const loadImage = (src) => new Promise((resolve) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => resolve(null); i.src = src; });
function fit(ctx, text, maxW, size, weight, family) { let s = size; for (; s > 12; s -= 1) { ctx.font = `${weight} ${s}px ${family}`; if (ctx.measureText(text).width <= maxW) break; } return s; }

export async function drawShareImage(canvas, S) {
  const mine = S.players[0].done, n = S.players.length, cw = 200, ch = Math.round(cw * 1120 / 820), top = 250;
  const cardsEnd = top + (mine.length ? ch + 70 : 80), H = cardsEnd + 90 + n * 50 + 100;
  canvas.width = SHARE_W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, SHARE_W, H); g.addColorStop(0, '#2a190c'); g.addColorStop(0.6, '#5b3a1e'); g.addColorStop(1, '#6b6a2a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, SHARE_W, H);
  ctx.textAlign = 'center'; ctx.fillStyle = '#f2c14e'; ctx.font = `700 64px ${SERIF}`; ctx.fillText('Journeys through Jerusalem', SHARE_W / 2, 95);
  ctx.fillStyle = '#fff'; fit(ctx, headline(S), SHARE_W - 120, 44, 700, SANS); ctx.fillText(headline(S), SHARE_W / 2, 175);
  ctx.fillStyle = '#e6d9c3'; ctx.font = `500 28px ${SANS}`; ctx.fillText(mine.length ? 'My journeys' : 'No journey finished this time', SHARE_W / 2, 225);
  if (mine.length) {
    const imgs = await Promise.all(mine.map((id) => loadImage(cardImage(id, 320)))), gap = 24, per = Math.min(mine.length, 5), tw = per * cw + (per - 1) * gap;
    mine.slice(0, 5).forEach((id, i) => {
      const x = (SHARE_W - tw) / 2 + i * (cw + gap);
      ctx.save(); roundRect(ctx, x, top, cw, ch, 10); ctx.clip(); if (imgs[i]) ctx.drawImage(imgs[i], x, top, cw, ch); else { ctx.fillStyle = '#222'; ctx.fillRect(x, top, cw, ch); } ctx.restore();
      ctx.fillStyle = '#fff'; ctx.font = `600 22px ${SANS}`; ctx.fillText(CARD[id].name, x + cw / 2, top + ch + 32);
    });
    if (mine.length > 5) { ctx.fillStyle = '#e6d9c3'; ctx.font = `600 22px ${SANS}`; ctx.fillText(`and ${mine.length - 5} more`, SHARE_W / 2, top + ch + 62); }
  }
  let y = cardsEnd + 50;
  ctx.textAlign = 'left';
  E.standings(S).forEach((r, i) => {
    const p = S.players[r.seat], win = S.winners.includes(r.seat);
    ctx.fillStyle = win ? 'rgba(242,193,78,.25)' : 'rgba(255,255,255,.08)'; roundRect(ctx, 100, y, SHARE_W - 200, 42, 10); ctx.fill();
    ctx.fillStyle = COLORS.find((c) => c.id === p.color).hex; ctx.beginPath(); ctx.arc(135, y + 21, 12, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `${win ? 800 : 600} 26px ${SANS}`; ctx.fillText(`${i + 1}. ${r.seat === 0 ? 'You' : p.name}`, 165, y + 30);
    ctx.textAlign = 'right'; ctx.fillText(`${journeys(r.done)}   ${r.score} points`, SHARE_W - 130, y + 30); ctx.textAlign = 'left';
    y += 50;
  });
  ctx.textAlign = 'center'; ctx.fillStyle = '#f2c14e'; ctx.font = `700 30px ${SANS}`; ctx.fillText('Play free at sdggames.fun/JtJ/play', SHARE_W / 2, H - 45);
}
export const canvasToBlob = (canvas) => new Promise((res) => canvas.toBlob(res, 'image/png'));
