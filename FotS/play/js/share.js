// Shareable result picture: a PNG of the finished game (your Fruit Tree and everyone's standing), with the link to play.
import * as E from './engine.js';

export const SHARE_URL = 'https://sdggames.fun/FotS/play/';
export const SHARE_W = 1200;
const SANS = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const COLORS = { love: '#e0202a', joy: '#ef7d22', peace: '#4a9fd6', patience: '#3fae49', kindness: '#e0668f', goodness: '#7a1f4a', faithfulness: '#5b63ad', gentleness: '#1f9d8a', selfcontrol: '#7a3f9a' };
const ORD = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4) % 4] || 'th'}`;
const fruit = (n) => `${n} fruit`;

// You are player 0. Place is by fruit showing (a tie shares the place).
export function result(S) {
  const you = S.players[0], won = S.winner === 0, n = E.upCount(you);
  return { you, won, tied: S.winner === null && S.endedBy === 'limit' && S.players.every((p) => E.upCount(p) <= n), n, place: 1 + S.players.filter((p) => E.upCount(p) > n).length };
}
export function headline(S) {
  const { won, n, place } = result(S);
  if (won && S.endedBy !== 'limit') return 'I collected all nine fruit of the Spirit!';
  if (won) return `I won with ${fruit(n)} showing!`;
  return `I showed ${fruit(n)} of nine and finished ${ORD(place)}.`;
}
export function shareMessage(S) {
  const n = S.players.length - 1;
  return `${headline(S)} The Fruit of the Spirit, against ${n} computer player${n > 1 ? 's' : ''}. ${SHARE_URL}`;
}
// The link lives in the text only. Passing it again as `url` makes many messaging apps paste it twice.
export const nativeShareData = (file, S) => ({ files: [file], text: shareMessage(S) });

const roundRect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
function fit(ctx, text, maxW, size, weight, family) { let s = size; for (; s > 12; s -= 1) { ctx.font = `${weight} ${s}px ${family}`; if (ctx.measureText(text).width <= maxW) break; } return s; }

export function drawShareImage(canvas, S) {
  const n = S.players.length, treeTop = 270, tw = 250, th = 96, gap = 14, treeH = 3 * th + 2 * gap, H = treeTop + treeH + 90 + n * 44 + 110;
  canvas.width = SHARE_W; canvas.height = H;
  const ctx = canvas.getContext('2d'), r = result(S), you = S.players[0];
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#11251a'); bg.addColorStop(0.55, '#35572b'); bg.addColorStop(1, '#b8731a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, SHARE_W, H);
  const glow = ctx.createRadialGradient(1020, 120, 10, 1020, 120, 340);
  glow.addColorStop(0, 'rgba(240,199,94,.55)'); glow.addColorStop(1, 'rgba(240,199,94,0)');
  ctx.fillStyle = glow; ctx.fillRect(600, 0, 600, 420);

  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = '#f0c75e'; ctx.font = `800 58px ${SERIF}`; ctx.fillText('THE FRUIT OF THE SPIRIT', 60, 104);
  ctx.fillStyle = 'rgba(255,255,255,.82)'; ctx.font = `500 24px ${SANS}`; ctx.fillText('A take-that and give-that card game · Galatians 5:22–23', 64, 144);
  ctx.fillStyle = '#fff'; const hl = headline(S); ctx.font = `800 ${fit(ctx, hl, 820, 46, 800, SANS)}px ${SANS}`; ctx.fillText(hl, 60, 212);
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = `500 22px ${SANS}`; ctx.fillText(`${n} players · ${n - 1} computer opponent${n > 2 ? 's' : ''}`, 62, 244);

  ctx.beginPath(); ctx.arc(1040, 120, 78, 0, 7); ctx.fillStyle = r.won ? '#f0c75e' : 'rgba(255,255,255,.92)'; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = '#1f2a12'; ctx.font = `800 64px ${SANS}`; ctx.fillText(`${r.n}/9`, 1040, 134);
  ctx.font = `700 20px ${SANS}`; ctx.fillText(r.won ? 'WINNER' : 'FRUIT', 1040, 166);

  // your Fruit Tree
  const x0 = (SHARE_W - (3 * tw + 2 * gap)) / 2;
  E.FRUITS.forEach((f, i) => {
    const s = you.tree[f], x = x0 + (i % 3) * (tw + gap), y = treeTop + Math.floor(i / 3) * (th + gap);
    roundRect(ctx, x, y, tw, th, 14);
    ctx.fillStyle = s.s === 1 ? '#fff' : s.s === 2 ? '#343a40' : 'rgba(255,255,255,.12)'; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = s.s === 0 ? 'rgba(255,255,255,.4)' : COLORS[f]; ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = s.s === 1 ? COLORS[f] : s.s === 2 ? '#f8f9fa' : 'rgba(255,255,255,.7)';
    ctx.font = `800 ${fit(ctx, E.name(f), tw - 30, 32, 800, SERIF)}px ${SERIF}`; ctx.fillText(E.name(f), x + tw / 2, y + 46);
    ctx.font = `600 20px ${SANS}`; ctx.fillText(s.s === 1 ? (s.wild ? '✓ Wild' : '✓ showing') : s.s === 2 ? 'covered' : 'not yet', x + tw / 2, y + 76);
  });

  // everyone's standing: a pip for each fruit
  const base = treeTop + treeH + 40, order = S.players.map((p, i) => ({ p, i })).sort((a, b) => E.upCount(b.p) - E.upCount(a.p));
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = `800 28px ${SANS}`; ctx.fillText('Final standings', 60, base + 6);
  order.forEach(({ p, i }, k) => {
    const y = base + 26 + k * 44, win = S.winner === i;
    ctx.textAlign = 'left'; ctx.font = `${i === 0 ? 800 : 600} 24px ${SANS}`; ctx.fillStyle = '#fff'; ctx.fillText(`${win ? '★ ' : ''}${p.name}`, 60, y + 26);
    for (let s = 0; s < 9; s++) {
      ctx.beginPath(); ctx.arc(330 + s * 40, y + 17, 14, 0, 7);
      if (s < E.upCount(p)) { ctx.fillStyle = '#f0c75e'; ctx.fill(); } else { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.stroke(); }
    }
    ctx.fillStyle = '#fff'; ctx.font = `800 22px ${SANS}`; ctx.fillText(fruit(E.upCount(p)), 710, y + 25);
  });
  ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.font = '700 26px Arial, Helvetica, sans-serif';
  ctx.fillText('Play free at sdggames.fun/FotS/play', SHARE_W / 2, H - 42);
  return canvas;
}
export const canvasToBlob = (canvas) => new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('could not draw the picture'))), 'image/png'));
