// Shareable result picture: a PNG of the finished game (the six days as they were built, with every card, and the final scores).
import * as E from './engine.js';

export const SHARE_URL = 'https://sdggames.fun/6days/play/';
export const SHARE_W = 1200;
export const PLAYER_COLORS = ['#f3c24b', '#6aa7ff', '#ff7a8a', '#6fd08c', '#c79bff', '#ffa45c'];
const SANS = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const ORD = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4) % 4] || 'th'}`;

// You are player 0. Place is by points (a tie shares the place).
export function result(state) {
  const you = state.players[0], place = 1 + state.players.filter((p) => p.score > you.score).length;
  const best = Math.max(...state.players.map((p) => p.score));
  return { you, place, won: you.score === best, tied: state.players.filter((p) => p.score === best).length > 1, best };
}
export function headline(state) {
  const { you, place, won, tied } = result(state);
  if (won) return tied ? `I tied for the win with ${you.score} points!` : `I won with ${you.score} points!`;
  return `I scored ${you.score} points and finished ${ORD(place)}.`;
}
export function shareMessage(state) {
  const n = state.players.length - 1;
  return `${headline(state)} Six Days, against ${n} computer player${n > 1 ? 's' : ''}. ${SHARE_URL}`;
}
// The link lives in the text only. Passing it again as `url` makes many messaging apps paste it twice.
export const nativeShareData = (file, state) => ({ files: [file], text: shareMessage(state) });

const roundRect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
const loadImage = (src) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
function fit(ctx, text, maxW, size, weight, family) { let s = size; for (; s > 12; s -= 1) { ctx.font = `${weight} ${s}px ${family}`; if (ctx.measureText(text).width <= maxW) break; } return s; }
const pts = (n) => `${n} point${n === 1 ? '' : 's'}`;

// info: { names: [display name per player], imgBase: function(id) -> url }
export async function drawShareImage(canvas, state, info) {
  const n = state.players.length, ROW = 104, top = 250, rowsEnd = top + 6 * ROW;
  const H = rowsEnd + 70 + n * 40 + 90;
  canvas.width = SHARE_W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const { you, won, tied } = result(state);
  const ids = [...new Set(state.stacks.flatMap((k) => [...k.cards, ...(k.em !== null ? [k.em] : [])]).map((u) => E.DEFS[u].id))];
  const images = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await loadImage(info.imgBase(id)).catch(() => null)])));

  // the sky of the first day, brightening to the last
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0c1433'); bg.addColorStop(0.55, '#1f3d78'); bg.addColorStop(1, '#c78a2c');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, SHARE_W, H);
  let a = state.seed >>> 0; const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = 0; i < 90; i++) { ctx.globalAlpha = 0.25 + rnd() * 0.6; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(rnd() * SHARE_W, rnd() * 210, 0.8 + rnd() * 1.6, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  const glow = ctx.createRadialGradient(1000, 90, 10, 1000, 90, 320);
  glow.addColorStop(0, 'rgba(243,194,75,.55)'); glow.addColorStop(1, 'rgba(243,194,75,0)');
  ctx.fillStyle = glow; ctx.fillRect(600, 0, 600, 400);

  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = '#f3c24b'; ctx.font = `800 70px ${SERIF}`; ctx.fillText('SIX DAYS', 60, 100);
  ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = `500 24px ${SANS}`; ctx.fillText('A creation card game', 64, 140);
  ctx.fillStyle = '#fff'; const hl = headline(state); ctx.font = `800 ${fit(ctx, hl, 800, 46, 800, SANS)}px ${SANS}`; ctx.fillText(hl, 60, 205);
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = `500 22px ${SANS}`;
  ctx.fillText(`${n} players · ${state.endedBy === 'complete' ? `all six days filled in ${state.round} rounds` : 'the cards ran out first'}`, 62, 236);

  // the score medallion
  ctx.beginPath(); ctx.arc(1040, 118, 78, 0, 7); ctx.fillStyle = won ? '#f3c24b' : 'rgba(255,255,255,.92)'; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = '#1a2347'; ctx.font = `800 ${you.score >= 100 ? 54 : 70}px ${SANS}`; ctx.fillText(String(you.score), 1040, 134);
  ctx.font = `700 20px ${SANS}`; ctx.fillText(won ? (tied ? 'TIED' : 'WINNER') : 'POINTS', 1040, 164);

  // the six days
  E.DAYS.forEach((d, i) => {
    const y = top + i * ROW, k = state.stacks[i], cards = [...k.cards, ...(k.em !== null ? [k.em] : [])], full = E.isFull(state, i), started = i < state.started;
    ctx.fillStyle = 'rgba(255,255,255,.12)'; roundRect(ctx, 50, y, 1100, ROW - 10, 16); ctx.fill();
    ctx.fillStyle = d.color; roundRect(ctx, 50, y, 16, ROW - 10, 8); ctx.fill();
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = `800 28px ${SANS}`; ctx.fillText(`Day ${i + 1}`, 88, y + 36);
    ctx.font = `600 ${fit(ctx, d.name, 230, 20, 600, SANS)}px ${SANS}`; ctx.fillText(d.name, 88, y + 62);
    ctx.font = `700 17px ${SANS}`; ctx.fillStyle = k.em !== null ? '#9be7b0' : full ? '#f3c24b' : 'rgba(255,255,255,.7)';
    ctx.fillText(k.em !== null ? 'Closed ✓' : full ? 'Full' : started ? `${k.cards.length} of ${i + 1} cards` : 'Not started', 88, y + 84);
    if (!cards.length) { ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.font = `italic 500 20px ${SANS}`; ctx.fillText('no cards', 400, y + 52); return; }
    cards.forEach((u, j) => {
      const x = 340 + j * 108, w = 100, h = 73, im = images[E.DEFS[u].id], isEm = k.em === u;
      ctx.save(); roundRect(ctx, x, y + 9, w, h, 8); ctx.clip();
      if (im) ctx.drawImage(im, x, y + 9, w, h); else { ctx.fillStyle = '#ddd'; ctx.fillRect(x, y + 9, w, h); }
      ctx.restore();
      ctx.lineWidth = isEm ? 4 : 2; ctx.strokeStyle = isEm ? '#f3c24b' : 'rgba(255,255,255,.7)'; roundRect(ctx, x, y + 9, w, h, 8); ctx.stroke();
    });
  });

  // the scores
  const order = state.players.map((p, i) => ({ p, i })).sort((x, y) => y.p.score - x.p.score), best = Math.max(1, order[0].p.score);
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = `800 28px ${SANS}`; ctx.fillText('Final scores', 60, rowsEnd + 46);
  order.forEach(({ p, i }, r) => {
    const y = rowsEnd + 66 + r * 40, winner = p.score === order[0].p.score, name = (info.names && info.names[i]) || p.name;
    ctx.font = `${i === 0 ? 800 : 600} 22px ${SANS}`; ctx.fillStyle = '#fff'; ctx.fillText(`${winner ? '★ ' : ''}${name}`, 60, y + 22);
    ctx.fillStyle = 'rgba(255,255,255,.14)'; roundRect(ctx, 300, y + 4, 640, 26, 13); ctx.fill();
    ctx.fillStyle = PLAYER_COLORS[i % PLAYER_COLORS.length]; roundRect(ctx, 300, y + 4, Math.max(26, 640 * p.score / best), 26, 13); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `800 22px ${SANS}`; ctx.fillText(pts(p.score), 960, y + 24);
  });
  ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = `700 24px ${SANS}`;
  ctx.fillText('Play free at sdggames.fun/6days/play', SHARE_W / 2, H - 38);
  return canvas;
}
export const canvasToBlob = (canvas) => new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('could not draw the picture'))), 'image/png'));
