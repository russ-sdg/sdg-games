// Tyndale at a shared table ("same room, own phones"): the pieces both phones need. There is no server: the table code is the
// shuffle seed (plus the number of Agents), so every phone deals the same character cards and agrees who the Secret Supporter is.
import { hash01, hasSupporter } from './engine.js';

export const AGENT_NAMES = ['Ashby', 'Brand', 'Carew', 'Dacre', 'Elyot', 'Fane'];
export const CHARACTERS = [{ id: 'vaughn', name: 'Stephen Vaughn' }, { id: 'holt', name: 'William Holt' }, { id: 'dobneck', name: 'John Dobneck' }, { id: 'stokesley', name: 'John Stokesley' }, { id: 'more', name: 'Thomas More' }, { id: 'phillips', name: 'Henry Phillips' }];
export const SEAT_COLOURS = ['#0d6efd', '#e76f00', '#2a9d8f', '#8e44ad', '#6c757d'];
export const CARD = (id, w = 480) => `../../assets/tyndale/cards/${id}-${w}.webp`;
export const LOC_CARD = { here: 'here', not: 'not-here', near: 'near', far: 'far' };
export const BIB_CARD = { N: 'new-testament', P: 'pentateuch', H: 'historical', O: 'old-testament', rumors: 'rumors', nothing: 'nothing' };
export const LOC_TEXT = { here: 'Tyndale is here!', not: 'Tyndale is not here', near: 'Tyndale is near', far: 'Tyndale is far away' };
export const BIB_TEXT = { N: 'The New Testament', P: 'The Pentateuch', H: 'The Historical Books', O: 'The Old Testament', rumors: 'Rumors of a translation nearby', nothing: 'Nothing to report' };
export const MIN_AGENTS = 2, MAX_AGENTS = 5;

// "4" + the seed in base 36, 6 characters: the first digit is how many Agent players are at the table.
export const makeCode = (n, seed) => `${n}${Number(seed).toString(36).toUpperCase().padStart(6, '0')}`;
export function parseCode(raw) {
  const c = String(raw || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  const m = /^([1-9])([0-9A-Z]{6})$/.exec(c);
  if (!m) return null;
  const n = Number(m[1]), seed = parseInt(m[2], 36);
  if (n < MIN_AGENTS || n > MAX_AGENTS || !seed) return null;
  return { n, seed, code: makeCode(n, seed) };
}
export const newSeed = () => Math.floor(Math.random() * 1e9) + 1;

// The Agents at a table: their names, the character card each is dealt, and who (if anyone) holds the Secret Supporter card.
// Stephen Vaughn is the Secret Supporter; with 4 or more Agents he may be dealt to one of them.
export function deal(seed, n) {
  const chars = CHARACTERS.map((c) => c.id);
  for (let i = chars.length - 1; i > 0; i--) { const j = Math.floor(hash01(seed, 930 + i) * (i + 1)); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  const held = chars.indexOf('vaughn');
  return { names: AGENT_NAMES.slice(0, n), chars: chars.slice(0, n), supporter: hasSupporter(n) && held < n ? held : null };
}
export const charName = (id) => (CHARACTERS.find((c) => c.id === id) || {}).name;

// The places a pawn on `from` can land after exactly `steps` steps on the grid (it may pass through anything).
export function reach(neighbors, from, steps) {
  let cur = new Set([from]);
  for (let i = 0; i < steps; i++) { const nx = new Set(); cur.forEach((p) => neighbors(p).forEach((q) => nx.add(q))); cur = nx; }
  return [...cur];
}

// The answer cards without passing a phone around: the host phone shows a two-character code for the Agent's landing spot, the Agent
// types it on their own phone, and their phone turns it back into the two cards. The code is scrambled with the table seed, the seat
// and the spot, so hearing it read out tells nobody else anything. The second character catches a mistyped code.
const LOCS = ['here', 'not', 'near', 'far'], BIBS = ['N', 'P', 'H', 'O', 'rumors', 'nothing'];
const D36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const spotNo = (pos) => 'ABCDEFGHIJK'.indexOf(pos[0]) * 11 + Number(pos.slice(1)) - 1;
const keys = (seed, seat, pos) => { const n = 100000 + seat * 200 + spotNo(pos); return [Math.floor(hash01(seed, n) * 36), Math.floor(hash01(seed, n + 50000) * 36)]; };
export function answerCode(seed, seat, pos, ans) {
  const v = LOCS.indexOf(ans.loc) * 6 + BIBS.indexOf(ans.bible), [k1, k2] = keys(seed, seat, pos);
  return D36[(v + k1) % 36] + D36[(v * 13 + k2) % 36];
}
export function decodeAnswer(seed, seat, pos, raw) {
  const c = String(raw || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (c.length !== 2) return null;
  const [k1, k2] = keys(seed, seat, pos), v = (D36.indexOf(c[0]) - k1 + 36) % 36;
  if (v >= 24 || D36[(v * 13 + k2) % 36] !== c[1]) return null;
  return { loc: LOCS[Math.floor(v / 6)], bible: BIBS[v % 6] };
}
