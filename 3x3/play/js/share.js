// Shareable result picture: a PNG of the finished game (the sets you won, and everyone's standing), with the link to play.
import * as E from './engine.js';

export const SHARE_URL = 'https://sdggames.fun/3x3/play/';
export const SHARE_W = 1200;
export const PLAYER_COLORS = ['#f0c864', '#6aa7ff', '#ff7a8a', '#6fd08c', '#c79bff', '#ffa45c'];
const SANS = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const ORD = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4) % 4] || 'th'}`;
const sets = (n) => `${n} set${n === 1 ? '' : 's'}`;

// You are player 0. Place is by sets won (a tie shares the place).
export function result(state) {
  const you = state.players[0], won = state.winners.includes(0);
  return { you, won, tied: won && state.winners.length > 1, place: 1 + state.players.filter((p) => p.sets.length > you.sets.length).length, levi: won && you.sets.includes(E.LEVI) && state.endedBy === 'levi' };
}
export function headline(state) {
  const { you, won, tied, place, levi } = result(state);
  if (levi) return 'I won with all three Levi cards!';
  if (won && state.endedBy === 'sets') return 'I won with three sets of three!';
  if (won) return tied ? `I tied for the win with ${sets(you.sets.length)}!` : `I won with ${sets(you.sets.length)}!`;
  return `I collected ${sets(you.sets.length)} and finished ${ORD(place)}.`;
}
export function shareMessage(state) {
  const n = state.players.length - 1;
  return `${headline(state)} Three-by-Three, against ${n} computer player${n > 1 ? 's' : ''}. ${SHARE_URL}`;
}
// The link lives in the text only. Passing it again as `url` makes many messaging apps paste it twice.
export const nativeShareData = (file, state) => ({ files: [file], text: shareMessage(state) });

const roundRect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
const loadImage = (src) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
function fit(ctx, text, maxW, size, weight, family) { let s = size; for (; s > 12; s -= 1) { ctx.font = `${weight} ${s}px ${family}`; if (ctx.measureText(text).width <= maxW) break; } return s; }

// info: { names: [display name per player], imgBase: function(tribe) -> url }
export async function drawShareImage(canvas, state, info) {
  const n = state.players.length, mine = state.players[0].sets, cw = 210, ch = Math.round(cw * 1120 / 745), top = 270;
  const cardsEnd = top + (mine.length ? ch + 70 : 90), H = cardsEnd + 80 + n * 44 + 100;
  canvas.width = SHARE_W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const r = result(state);
  const images = Object.fromEntries(await Promise.all([...new Set(mine)].map(async (v) => [v, await loadImage(info.imgBase(v)).catch(() => null)])));

  // night blue over the camp, shading to the gold of the Tabernacle
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#150e30'); bg.addColorStop(0.5, '#3a2a6b'); bg.addColorStop(1, '#b8741a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, SHARE_W, H);
  let a = state.seed >>> 0; const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = 0; i < 90; i++) { ctx.globalAlpha = 0.2 + rnd() * 0.6; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(rnd() * SHARE_W, rnd() * 250, 0.8 + rnd() * 1.7, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  const glow = ctx.createRadialGradient(1020, 120, 10, 1020, 120, 340);
  glow.addColorStop(0, 'rgba(240,200,100,.6)'); glow.addColorStop(1, 'rgba(240,200,100,0)');
  ctx.fillStyle = glow; ctx.fillRect(600, 0, 600, 420);

  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = '#f0c864'; ctx.font = `800 66px ${SERIF}`; ctx.fillText('THREE-BY-THREE', 60, 104);
  ctx.fillStyle = 'rgba(255,255,255,.82)'; ctx.font = `500 24px ${SANS}`; ctx.fillText('A matching game of the tribes of Israel', 64, 144);
  ctx.fillStyle = '#fff'; const hl = headline(state); ctx.font = `800 ${fit(ctx, hl, 820, 46, 800, SANS)}px ${SANS}`; ctx.fillText(hl, 60, 212);
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = `500 22px ${SANS}`;
  ctx.fillText(`${n} players · ${n - 1} computer opponent${n > 2 ? 's' : ''}`, 62, 244);

  // the medallion
  ctx.beginPath(); ctx.arc(1040, 120, 78, 0, 7); ctx.fillStyle = r.won ? '#f0c864' : 'rgba(255,255,255,.92)'; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = '#251a47';
  if (r.levi) { ctx.font = `800 46px ${SANS}`; ctx.fillText('LEVI', 1040, 134); ctx.font = `700 20px ${SANS}`; ctx.fillText('×3', 1040, 164); }
  else { ctx.font = `800 70px ${SANS}`; ctx.fillText(String(mine.length), 1040, 136); ctx.font = `700 20px ${SANS}`; ctx.fillText(r.won ? (r.tied ? 'TIED' : 'WINNER') : mine.length === 1 ? 'SET' : 'SETS', 1040, 166); }

  // the sets you won: each is three of the same card, fanned
  ctx.textAlign = 'left';
  if (!mine.length) { ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.font = `italic 500 26px ${SANS}`; ctx.fillText('No sets this time. Next time!', 60, top + 60); }
  const slot = SHARE_W / Math.max(3, mine.length);
  mine.forEach((v, i) => {
    const cx = slot * i + slot / 2, im = images[v];
    for (let k = 2; k >= 0; k--) {
      const x = cx - cw / 2 + (k - 1) * 34, y = top + k * 6 + (k === 1 ? 0 : 10);
      ctx.save(); ctx.translate(x + cw / 2, y + ch / 2); ctx.rotate((k - 1) * 0.1); ctx.translate(-cw / 2, -ch / 2);
      ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
      roundRect(ctx, 0, 0, cw, ch, 12); ctx.fillStyle = '#fff'; ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.save(); roundRect(ctx, 0, 0, cw, ch, 12); ctx.clip();
      if (im) ctx.drawImage(im, 0, 0, cw, ch); else { ctx.fillStyle = '#ddd'; ctx.fillRect(0, 0, cw, ch); }
      ctx.restore();
      ctx.lineWidth = 3; ctx.strokeStyle = k === 1 ? '#f0c864' : 'rgba(255,255,255,.8)'; roundRect(ctx, 0, 0, cw, ch, 12); ctx.stroke();
      ctx.restore();
    }
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = `800 28px ${SANS}`; ctx.fillText(`${v}. ${E.name(v)}`, cx, top + ch + 52);
  });

  // everyone's standing: a pip for each set
  const order = state.players.map((p, i) => ({ p, i })).sort((x, y) => y.p.sets.length - x.p.sets.length);
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = `800 28px ${SANS}`; ctx.fillText('Final standings', 60, cardsEnd + 46);
  order.forEach(({ p, i }, k) => {
    const y = cardsEnd + 66 + k * 44, name = (info.names && info.names[i]) || p.name, win = state.winners.includes(i);
    ctx.textAlign = 'left'; ctx.font = `${i === 0 ? 800 : 600} 24px ${SANS}`; ctx.fillStyle = '#fff'; ctx.fillText(`${win ? '★ ' : ''}${name}`, 60, y + 26);
    for (let s = 0; s < 3; s++) {
      ctx.beginPath(); ctx.arc(380 + s * 48, y + 17, 17, 0, 7);
      if (s < p.sets.length) { ctx.fillStyle = PLAYER_COLORS[i % PLAYER_COLORS.length]; ctx.fill(); } else { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.stroke(); }
    }
    ctx.fillStyle = '#fff'; ctx.font = `800 22px ${SANS}`; ctx.fillText(sets(p.sets.length), 540, y + 25);
  });
  ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.font = '700 26px Arial, Helvetica, sans-serif';       // not Inter: it turns "3x3" into "3×3"
  ctx.fillText('Play free at sdggames.fun/3x3/play', SHARE_W / 2, H - 42);
  return canvas;
}
export const canvasToBlob = (canvas) => new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('could not draw the picture'))), 'image/png'));
