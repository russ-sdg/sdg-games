// Shareable result image: a PNG of your finished library, drawn on a canvas.
import { CATS, BOOKS } from './books.js';
import { score, MODES, ROUNDS } from './engine.js';
import { standings } from './table.js';

export const SHARE_URL = 'https://sdggames.fun/roman-catacombs/play/';
export const shareMessage = (total, place) => `I scored ${total} points in Roman Catacombs${place ? ` and finished ${ORD(place)}` : ''}! ${SHARE_URL}`;
const ORD = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4) % 4] || 'th'}`;
// The link lives in the text only. Passing it again as `url` makes many messaging apps paste it twice.
export const nativeShareData = (file, total, place) => ({ files: [file], text: shareMessage(total, place) });

export const SHARE_W = 1200;
export const SHARE_H = 1050;
const SANS = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';

export const describe = (state) => {
  if (state.mode === MODES.solo) return `Solo \u00b7 ${state.round} of ${ROUNDS} rounds`;
  if (state.mode === MODES.bots) {
    const st = standings(state), place = st.findIndex((x) => x.you) + 1;
    return `vs ${state.rivals.length} computer${state.rivals.length > 1 ? 's' : ''} \u00b7 ${ORD(place)} of ${st.length} \u00b7 ${state.round} rounds`;
  }
  if (state.mode === MODES.table) return `Same room \u00b7 ${state.round} rounds`;
  return 'Scorecard';
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Fit text into a width by shrinking the font a little (down to a floor).
function fit(ctx, text, maxW, size, weight, family) {
  let s = size;
  for (; s > 14; s -= 1) {
    ctx.font = `${weight} ${s}px ${family}`;
    if (ctx.measureText(text).width <= maxW) break;
  }
  return s;
}

export function drawShareImage(canvas, state) {
  canvas.width = SHARE_W; canvas.height = SHARE_H;
  const ctx = canvas.getContext('2d');
  const r = score(state);

  const bg = ctx.createLinearGradient(0, 0, SHARE_W, SHARE_H);
  bg.addColorStop(0, '#1e110a'); bg.addColorStop(0.55, '#4a2a18'); bg.addColorStop(1, '#8a4a2a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, SHARE_W, SHARE_H);

  // header
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = '#f0c36a'; ctx.font = `700 58px ${SERIF}`;
  ctx.fillText('ROMAN CATACOMBS', 48, 86);
  ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.font = `500 26px ${SANS}`;
  ctx.fillText(`${describe(state)} · ${21 - r.empty} of 21 books`, 50, 128);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff'; ctx.font = `800 96px ${SANS}`;
  ctx.fillText(String(r.total), SHARE_W - 48, 108);
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = `600 22px ${SANS}`;
  ctx.fillText(r.empty ? `points  (−${r.empty} for empty slots)` : 'points', SHARE_W - 50, 138);

  // shelves
  const top = 168, rowH = 100, gap = 8, left = 36, width = SHARE_W - 72;
  CATS.forEach((c, ci) => {
    const y = top + ci * (rowH + gap);
    ctx.fillStyle = '#f6efe2'; roundRect(ctx, left, y, width, rowH, 14); ctx.fill();
    ctx.fillStyle = c.color; roundRect(ctx, left, y, 12, rowH, 6); ctx.fill();
    ctx.textAlign = 'left'; ctx.fillStyle = c.ink;
    ctx.font = `700 28px ${SANS}`;
    if (ctx.measureText(c.label).width <= 250) ctx.fillText(c.label, left + 30, y + rowH / 2 + 10);
    else {                                                        // two lines: split near the middle
      const words = c.label.split(' '); let cut = Math.ceil(words.length / 2);
      ctx.font = `700 26px ${SANS}`;
      ctx.fillText(words.slice(0, cut).join(' '), left + 30, y + rowH / 2 - 2);
      ctx.fillText(words.slice(cut).join(' '), left + 30, y + rowH / 2 + 28);
    }
    // slots
    const sx = left + 300, sw = 205, sh = 62, sg = 12;
    for (let k = 0; k < 3; k++) {
      const x = sx + k * (sw + sg), yy = y + (rowH - sh) / 2, b = ci * 3 + k;
      const book = state.library[b];
      if (book !== null) {
        ctx.fillStyle = c.color; roundRect(ctx, x, yy, sw, sh, 14); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
        const name = BOOKS[book].name;
        const s = fit(ctx, name, sw - 20, 27, 700, SANS);
        ctx.font = `700 ${s}px ${SANS}`;
        ctx.fillText(name, x + sw / 2, yy + sh / 2 + s / 3);
      } else {
        ctx.strokeStyle = c.color; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
        roundRect(ctx, x + 1.5, yy + 1.5, sw - 3, sh - 3, 13); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#8a8f96'; ctx.textAlign = 'center'; ctx.font = `600 24px ${SANS}`;
        ctx.fillText('empty', x + sw / 2, yy + sh / 2 + 8);
      }
    }
    // points for the category
    const cat = r.categories[ci];
    ctx.textAlign = 'right';
    if (cat.complete) {
      ctx.fillStyle = c.ink; ctx.font = `800 40px ${SANS}`;
      ctx.fillText(`+${cat.points}`, left + width - 24, y + 50);
      ctx.fillStyle = '#5c636a'; ctx.font = `600 19px ${SANS}`;
      ctx.fillText(cat.how === 'later' ? 'after' : 'first', left + width - 24, y + 76);
    } else {
      ctx.fillStyle = '#8a8f96'; ctx.font = `700 30px ${SANS}`;
      ctx.fillText(`${cat.filled} of 3`, left + width - 24, y + rowH / 2 + 10);
    }
  });

  // footer
  ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = `600 24px ${SANS}`;
  ctx.fillText('Play free at sdggames.fun/roman-catacombs/play', SHARE_W - 36, SHARE_H - 22);
  ctx.textAlign = 'left';
  return canvas;
}

export const canvasToBlob = (canvas) => new Promise((resolve, reject) =>
  canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('could not encode the image'))), 'image/png'));
