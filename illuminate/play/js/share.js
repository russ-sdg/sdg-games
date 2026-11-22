// Shareable result picture: a PNG of the finished game (the final standings), with the link to play.
export const SHARE_URL = 'https://sdggames.fun/illuminate/play/';
export const SHARE_W = 1200;
const SANS = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const ORD = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4) % 4] || 'th'}`;
const COLORS = ['#f0c864', '#6aa7ff', '#ff7a8a', '#6fd08c'];

// You are player 0. Place is by score (a tie shares the place).
export function result(S) {
  const you = S.players[0];
  return { you, won: S.winners.includes(0), tied: S.winners.includes(0) && S.winners.length > 1, place: 1 + S.players.filter((p) => p.score > you.score).length };
}
export function headline(S) {
  const { you, won, tied, place } = result(S);
  if (won) return tied ? `I tied for the win with ${you.score} points!` : `I won with ${you.score} points!`;
  return `I scored ${you.score} points and finished ${ORD(place)}.`;
}
export function shareMessage(S) {
  const n = S.players.length - 1;
  return `${headline(S)} Illuminate, ${S.sizes.length} hands against ${n} computer player${n > 1 ? 's' : ''}. ${SHARE_URL}`;
}
// The link lives in the text only. Passing it again as `url` makes many messaging apps paste it twice.
export const nativeShareData = (file, S) => ({ files: [file], text: shareMessage(S) });

const roundRect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
function fit(ctx, text, maxW, size, weight, family) { let s = size; for (; s > 12; s -= 1) { ctx.font = `${weight} ${s}px ${family}`; if (ctx.measureText(text).width <= maxW) break; } return s; }

export function drawShareImage(canvas, S) {
  const n = S.players.length, rowH = 76, top = 290, H = top + n * rowH + 150;
  canvas.width = SHARE_W; canvas.height = H;
  const ctx = canvas.getContext('2d'), r = result(S);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#3a2410'); bg.addColorStop(0.6, '#6b3d12'); bg.addColorStop(1, '#c9a227');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, SHARE_W, H);
  const glow = ctx.createRadialGradient(1020, 120, 10, 1020, 120, 340);
  glow.addColorStop(0, 'rgba(255,224,130,.55)'); glow.addColorStop(1, 'rgba(255,224,130,0)');
  ctx.fillStyle = glow; ctx.fillRect(600, 0, 600, 420);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = '#f4ecd8'; ctx.font = `800 72px ${SERIF}`; ctx.fillText('ILLUMINATE', 60, 112);
  ctx.fillStyle = 'rgba(255,255,255,.82)'; ctx.font = `500 24px ${SANS}`; ctx.fillText('A trick-taking game with a Biblical twist', 64, 152);
  ctx.fillStyle = '#fff'; const hl = headline(S); ctx.font = `800 ${fit(ctx, hl, 820, 46, 800, SANS)}px ${SANS}`; ctx.fillText(hl, 60, 222);
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = `500 22px ${SANS}`; ctx.fillText(`${S.sizes.length} hands · ${n} players · ${n - 1} computer opponent${n > 2 ? 's' : ''}`, 62, 254);
  ctx.beginPath(); ctx.arc(1040, 120, 78, 0, 7); ctx.fillStyle = r.won ? '#f0c864' : 'rgba(255,255,255,.92)'; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = '#2b1d0e'; ctx.font = `800 ${r.you.score > 99 ? 56 : 68}px ${SANS}`; ctx.fillText(String(r.you.score), 1040, 134);
  ctx.font = `700 20px ${SANS}`; ctx.fillText(r.won ? (r.tied ? 'TIED' : 'WINNER') : 'POINTS', 1040, 166);

  const order = S.players.map((p, i) => ({ p, i })).sort((a, b) => b.p.score - a.p.score), max = Math.max(1, order[0].p.score), barX = 330, barW = 640;
  order.forEach(({ p, i }, k) => {
    const y = top + k * rowH, win = S.winners.includes(i);
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = `${i === 0 ? 800 : 600} 28px ${SANS}`; ctx.fillText(`${win ? '★ ' : ''}${p.name}`, 60, y + 40);
    roundRect(ctx, barX, y + 12, barW, 38, 19); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fill();
    roundRect(ctx, barX, y + 12, Math.max(38, barW * p.score / max), 38, 19); ctx.fillStyle = COLORS[i % COLORS.length]; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `800 30px ${SANS}`; ctx.fillText(`${p.score}`, barX + barW + 24, y + 42);
  });
  ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.font = '700 26px Arial, Helvetica, sans-serif';
  ctx.fillText('Play free at sdggames.fun/illuminate/play', SHARE_W / 2, H - 42);
  return canvas;
}
export const canvasToBlob = (canvas) => new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('could not draw the picture'))), 'image/png'));
