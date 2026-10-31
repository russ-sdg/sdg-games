// Shareable result image: a 1200x900 PNG drawn on a canvas.
import MAP from './map-data.js';
import { EVANGELISTS, EV_NAMES, city, edge, score } from './engine.js';
import { EV_COLOR, EV_LETTER, REGION_COLOR, TRAIL_WIDTH, tokenSpot } from './board.js';

export const SHARE_URL = 'https://sdggames.fun/JfP/play/';
export const shareMessage = (total) => `I scored ${total} points in Journeys for Paul! ${SHARE_URL}`;
// The link lives in the text only. Passing it again as `url` makes many messaging apps paste it twice.
export const nativeShareData = (file, total) => ({ files: [file], text: shareMessage(total) });

export const SHARE_W = 1200;
export const SHARE_H = 900;
const MAP_Y = 110;
const SCALE = SHARE_W / MAP.width; // 0.5

const imageCache = {};
function loadImage(src) {
  return (imageCache[src] ??= new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  }));
}

function outlined(ctx, text, x, y, fill, outline, width) {
  ctx.lineJoin = 'round';
  ctx.lineWidth = width;
  ctx.strokeStyle = outline;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

// Draw one sheet's map in map coordinates (2400x1200) at the current transform.
function drawMap(ctx, basemap, sheet) {
  ctx.drawImage(basemap, 0, 0, MAP.width, MAP.height);

  ctx.font = '700 41px Arial, Helvetica, sans-serif';
  ctx.textBaseline = 'alphabetic';
  for (const c of MAP.captions) {
    ctx.globalAlpha = 0.9;
    outlined(ctx, c.text, c.x, c.y, c.color, '#fff', 6);
  }
  ctx.globalAlpha = 1;

  // every route, faintly
  ctx.lineCap = 'round';
  for (const e of MAP.edges) {
    const p = new Path2D(e.d);
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#2b2b2b';
    ctx.lineWidth = 7;
    ctx.setLineDash(e.mode === 'foot' ? [9, 15] : []);
    ctx.stroke(p);
    if (e.mode === 'boat') {
      ctx.strokeStyle = '#fff';
      ctx.lineCap = 'butt';
      ctx.setLineDash([18, 22]);
      ctx.stroke(p);
      ctx.lineCap = 'round';
    }
  }
  ctx.setLineDash([]);

  // trails
  ctx.globalAlpha = 0.9;
  ctx.lineJoin = 'round';
  const byEdge = {};
  EVANGELISTS.forEach((ev, i) => sheet.used[ev].forEach((id) => (byEdge[id] ??= []).push(i)));
  for (const [id, evs] of Object.entries(byEdge)) {
    const p = new Path2D(edge(id).d);
    [...evs].sort((a, b) => a - b).forEach((i, n) => {
      ctx.strokeStyle = EV_COLOR[EVANGELISTS[i]];
      ctx.lineWidth = TRAIL_WIDTH[n];
      ctx.stroke(p);
    });
  }
  ctx.globalAlpha = 1;

  // cities
  for (const c of MAP.cities) {
    const seen = sheet.visited.includes(c.id);
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.big ? 17 : 10, 0, Math.PI * 2);
    ctx.globalAlpha = seen ? 1 : 0.55;
    ctx.fillStyle = REGION_COLOR[c.region];
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 3;
    ctx.strokeStyle = seen ? '#222' : '#fff';
    ctx.stroke();
  }
  // preaching rings (doubled = called)
  EVANGELISTS.forEach((ev, i) => {
    const e = sheet.evangelists[ev];
    for (const [cid, n] of Object.entries(e.preachedAt)) {
      const c = city(cid);
      const r = (c.big ? 17 : 10) + 8 + i * 6;
      ctx.strokeStyle = EV_COLOR[ev];
      ctx.lineWidth = n > 1 ? 8 : 5;
      ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.stroke();
      if (e.called && e.city === cid) {
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(c.x, c.y, r + 7, 0, Math.PI * 2); ctx.stroke();
      }
    }
  });
  // labels
  ctx.font = '600 31px Arial, Helvetica, sans-serif';
  for (const c of MAP.cities) {
    const l = c.label;
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.rotate((l.rot * Math.PI) / 180);
    outlined(ctx, c.name, 0, 0, '#111', '#fff', 7);
    ctx.restore();
  }
  // tokens
  ctx.font = '800 20px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  EVANGELISTS.forEach((ev, i) => {
    const [x, y] = tokenSpot(city(sheet.evangelists[ev].city), i);
    ctx.beginPath(); ctx.arc(x, y, 19, 0, Math.PI * 2);
    ctx.fillStyle = EV_COLOR[ev]; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillText(EV_LETTER[ev], x, y + 1);
  });
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

// info: { name, sheet, rulesName, rounds }
export async function drawShareImage(canvas, info) {
  const [basemap, logo] = await Promise.all([loadImage('assets/basemap.webp'), loadImage('../../assets/JfP Logo Long Red.png')]);
  const sc = score(info.sheet);
  canvas.width = SHARE_W;
  canvas.height = SHARE_H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, SHARE_W, SHARE_H);

  // header: logo, name and score
  const lh = 70, lw = (logo.width / logo.height) * lh;
  ctx.drawImage(logo, 28, (MAP_Y - lh) / 2, lw, lh);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#212529';
  ctx.font = '700 62px Arial, Helvetica, sans-serif';
  ctx.fillText(`${sc.total < 0 ? `\u2212${-sc.total}` : sc.total} points`, SHARE_W - 32, 66);
  ctx.fillStyle = '#6c757d';
  ctx.font = '400 22px Arial, Helvetica, sans-serif';
  ctx.fillText(`${info.name} · ${info.rulesName}${info.rounds ? ` · ${info.rounds} rounds` : ''}`, SHARE_W - 32, 96);
  ctx.textAlign = 'left';

  // map
  ctx.save();
  ctx.beginPath(); ctx.rect(0, MAP_Y, SHARE_W, MAP.height * SCALE); ctx.clip();
  ctx.translate(0, MAP_Y);
  ctx.scale(SCALE, SCALE);
  drawMap(ctx, basemap, info.sheet);
  ctx.restore();

  // footer
  const fy = MAP_Y + MAP.height * SCALE;
  ctx.fillStyle = '#f1f3f5';
  ctx.fillRect(0, fy, SHARE_W, SHARE_H - fy);
  const colW = (SHARE_W - 56) / 3;
  EVANGELISTS.forEach((ev, i) => {
    const x = 28 + i * colW;
    const p = sc.perEvangelist[ev];
    const e = info.sheet.evangelists[ev];
    ctx.fillStyle = EV_COLOR[ev];
    ctx.fillRect(x, fy + 20, 8, 82);
    ctx.font = '700 28px Arial, Helvetica, sans-serif';
    ctx.fillText(EV_NAMES[ev], x + 22, fy + 46);
    ctx.fillStyle = '#343a40';
    ctx.font = '400 21px Arial, Helvetica, sans-serif';
    ctx.fillText(`${p.regions} region${p.regions === 1 ? '' : 's'} · ${p.preaches} preach${p.preaches === 1 ? '' : 'es'}`, x + 22, fy + 76);
    ctx.fillText(e.called ? `Called as pastor in ${city(e.city).name}` : `Ended in ${city(e.city).name}`, x + 22, fy + 102);
  });
  ctx.fillStyle = '#343a40';
  ctx.font = '400 21px Arial, Helvetica, sans-serif';
  const bd = sc.parts;
  const signed = (n) => (n < 0 ? `−${-n}` : `+${n}`);
  ctx.fillText(`Regions ${signed(bd.regions)}  ·  Preaching ${signed(bd.preaching)}  ·  Called ${signed(bd.called)}  ·  ${sc.unvisited} cit${sc.unvisited === 1 ? 'y' : 'ies'} not visited ${signed(bd.unvisited)}`, 28, fy + 146);
  ctx.fillStyle = '#868e96';
  ctx.font = '400 19px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Play free at sdggames.fun/JfP/play', SHARE_W - 28, SHARE_H - 18);
  ctx.textAlign = 'left';
  return canvas;
}

export const canvasToBlob = (canvas) => new Promise((resolve, reject) =>
  canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('could not encode the image'))), 'image/png'));
