// The map mat of Journeys through Jerusalem as a graph. Coordinates are pixels on assets/jtj-web/map.webp (1200 x 1200),
// read off the printed map: one entry per coloured square, [x, y, colour, site].
// Colours: R red, B blue, T teal, L lime, D dark grey, G light grey (the six token colours). Sites are the 11 white squares.

export const MAP_SIZE = 1200;
export const MAP_IMAGE = '../../assets/jtj-web/map.webp';

export const COLORS = [
  { id: 'R', name: 'Red', hex: '#c0394b' },
  { id: 'B', name: 'Blue', hex: '#3f68a8' },
  { id: 'T', name: 'Teal', hex: '#2f9a8c' },
  { id: 'L', name: 'Lime', hex: '#c9bf50' },
  { id: 'D', name: 'Charcoal', hex: '#4a4843' },
  { id: 'G', name: 'Silver', hex: '#cfc9bd' },
];

export const SITES = [
  { id: 'bethany', name: 'Bethany', icon: 'icons/bethany.png' },
  { id: 'olives', name: 'Mount of Olives', icon: 'icons/olives.png' },
  { id: 'gethsemane', name: 'Gethsemane', icon: 'icons/gethsemane.png' },
  { id: 'temple', name: 'The Temple', icon: 'icons/temple.png' },
  { id: 'upper-room', name: 'The Upper Room', icon: 'icons/upper-room.png' },
  { id: 'praetorium', name: 'The Praetorium', icon: 'icons/praetorium.png' },
  { id: 'herod', name: "Herod's Palace", icon: 'icons/herod.png' },
  { id: 'caiaphas', name: "Caiaphas' Palace", icon: 'icons/caiaphas.png' },
  { id: 'golgotha', name: 'Golgotha', icon: 'icons/golgotha.png' },
  { id: 'tomb', name: 'The Tomb', icon: 'icons/tomb.png' },
  { id: 'emmaus', name: 'Emmaus', icon: 'icons/emmaus.png' },
];
export const SITE_INDEX = Object.fromEntries(SITES.map((s, i) => [s.id, i]));

const RAW = [
  // the road from Emmaus, then down the west side to the Tomb
  [55, 242, 'W', 'emmaus'], [97, 260, 'R'], [140, 272, 'B'], [182, 285, 'T'], [226, 302, 'L'], [270, 312, 'D'], [312, 332, 'G'],
  [355, 342, 'R'], [397, 355, 'B'], [440, 362, 'T'], [482, 362, 'G'], [525, 385, 'D'], [570, 420, 'L'], [612, 440, 'T'],
  [442, 400, 'L'], [465, 442, 'D'], [475, 490, 'G'], [482, 532, 'R'], [482, 577, 'W', 'tomb'], [480, 622, 'B'], [480, 662, 'T'], [485, 705, 'L'],
  // Golgotha and the lanes through the middle of the city
  [527, 547, 'W', 'golgotha'], [570, 565, 'T'], [612, 572, 'B'], [655, 575, 'R'], [655, 620, 'G'], [655, 662, 'D'], [656, 705, 'L'],
  [612, 482, 'R'], [612, 525, 'D'],
  // along the top, past the Temple, and down the Mount of Olives side to Bethany
  [655, 442, 'B'], [700, 442, 'R'], [742, 435, 'G'], [785, 427, 'D'], [827, 420, 'L'], [870, 412, 'T'], [870, 367, 'B'], [912, 362, 'R'],
  [956, 362, 'G'], [999, 362, 'D'], [1041, 362, 'L'], [1041, 406, 'T'], [1041, 449, 'W', 'gethsemane'], [1041, 492, 'B'], [1041, 535, 'R'],
  [1041, 577, 'W', 'olives'], [1041, 620, 'G'], [1041, 662, 'D'],
  [1048, 705, 'L'], [1067, 749, 'T'], [1085, 790, 'B'], [1091, 832, 'R'], [1135, 832, 'W', 'bethany'],
  // the lane below the Temple
  [997, 670, 'G'], [956, 680, 'B'], [914, 687, 'L'], [871, 695, 'T'], [827, 700, 'B'], [785, 702, 'R'],
  // the Temple's own path
  [742, 485, 'T'], [762, 527, 'W', 'temple'], [775, 570, 'R'], [797, 612, 'G'], [820, 657, 'D'],
  // the Upper Room row, and the Praetorium and Herod's Palace
  [527, 705, 'R'], [570, 705, 'D'], [614, 705, 'W', 'upper-room'],
  [485, 747, 'W', 'praetorium'], [485, 790, 'D'], [485, 832, 'W', 'herod'],
  [527, 834, 'G'], [570, 834, 'L'], [612, 834, 'G'], [656, 834, 'R'],
  [656, 747, 'T'], [656, 792, 'B'], [699, 750, 'L'], [742, 750, 'D'], [785, 747, 'G'],
  // down to Caiaphas' Palace, along the bottom, and back up the east side of the lower city
  [522, 877, 'R'], [515, 920, 'B'], [502, 962, 'T'], [495, 1005, 'W', 'caiaphas'], [485, 1049, 'L'], [475, 1092, 'D'], [465, 1132, 'G'],
  [650, 877, 'G'], [642, 920, 'D'], [632, 962, 'L'], [625, 1005, 'T'], [612, 1049, 'B'], [571, 1049, 'T'], [527, 1049, 'B'],
];

export const TILE_SIZE = 44;
const NEAR = 52;                                   // squares whose centres are this close share an edge
const AT = (x, y) => RAW.findIndex((t) => t[0] === x && t[1] === y);
const EXTRA = [[[525, 385], [570, 420]]];           // joined on the printed map, though the long diagonal puts their centres further apart
const APART = [];                                   // none needed: Golgotha and the Tomb are 54 apart, so are not joined

export const TILES = RAW.map(([x, y, c, site], i) => ({ i, x, y, c: c, site: site ? SITE_INDEX[site] : null }));
export const ADJ = TILES.map(() => []);
function link(a, b) { if (a < 0 || b < 0 || a === b || ADJ[a].includes(b)) return; ADJ[a].push(b); ADJ[b].push(a); }
for (let a = 0; a < TILES.length; a++) for (let b = a + 1; b < TILES.length; b++) if (Math.hypot(TILES[a].x - TILES[b].x, TILES[a].y - TILES[b].y) <= NEAR) link(a, b);
for (const [p, q] of EXTRA) link(AT(...p), AT(...q));
for (const [p, q] of APART) { const a = AT(...p), b = AT(...q); ADJ[a] = ADJ[a].filter((v) => v !== b); ADJ[b] = ADJ[b].filter((v) => v !== a); }
for (const l of ADJ) l.sort((a, b) => a - b);

export const SITE_TILE = SITES.map((_, s) => TILES.findIndex((t) => t.site === s));

// distances (in squares) from one square to every square, by breadth-first search; cached
const cache = new Map();
export function distFrom(i) {
  let d = cache.get(i);
  if (d) return d;
  d = new Array(TILES.length).fill(-1); d[i] = 0;
  const q = [i];
  for (let h = 0; h < q.length; h++) for (const n of ADJ[q[h]]) if (d[n] < 0) { d[n] = d[q[h]] + 1; q.push(n); }
  cache.set(i, d);
  return d;
}

// every square you can finish a move on from `from` with a die roll of `n`: 1 to n squares away
export function reachable(from, n) {
  const d = distFrom(from), out = [];
  for (let i = 0; i < d.length; i++) if (d[i] >= 1 && d[i] <= n) out.push({ tile: i, steps: d[i] });
  return out;
}

// one shortest path of squares from a to b (inclusive), for drawing the route
export function pathBetween(a, b) {
  const d = distFrom(b), path = [a];
  for (let cur = a; cur !== b;) {
    const next = ADJ[cur].filter((n) => d[n] === d[cur] - 1).sort((p, q) => p - q)[0];
    path.push(next); cur = next;
  }
  return path;
}
