// Journeys with Jesus: the gameboard as data. Places, the roads (black) and boat rides (white) between them, and regions.
// Positions are on a 440 x 650 drawing of the board (north at the top), read off the printed board; check.html draws them
// over the board photo so they can be verified by eye.
export const REGIONS = {
  syria: { name: 'Syria', color: '#e11d1d' },
  galilee: { name: 'Galilee', color: '#4f9a3c' },
  decapolis: { name: 'Decapolis', color: '#5b2a17' },
  samaria: { name: 'Samaria', color: '#e0559f' },
  judea: { name: 'Judea', color: '#1f3fe0' },
  perea: { name: 'Perea', color: '#f08a00' },
};

// id, name, region, x, y (label: where the name sits relative to the dot)
export const PLACES = {
  tyre: { name: 'Tyre', region: 'syria', x: 174, y: 107, label: 'n' },
  'caesarea-philippi': { name: 'Caesarea Philippi', region: 'syria', x: 308, y: 115, label: 'sw' },
  'mount-hermon': { name: 'Mount Hermon', region: 'syria', x: 364, y: 70, label: 'sw' },
  ptolemais: { name: 'Ptolemais', region: 'galilee', x: 126, y: 211, label: 'sw' },
  capernaum: { name: 'Capernaum', region: 'galilee', x: 283, y: 221, label: 'n' },
  bethsaida: { name: 'Bethsaida', region: 'galilee', x: 311, y: 217, label: 'e' },
  cana: { name: 'Cana', region: 'galilee', x: 205, y: 247, label: 'sw' },
  magdala: { name: 'Magdala', region: 'galilee', x: 266, y: 243, label: 'sw' },
  gennesaret: { name: 'Gennesaret', region: 'galilee', x: 308, y: 256, label: 'e' },
  gadara: { name: 'Gadara', region: 'decapolis', x: 303, y: 281, label: 'e' },
  nazareth: { name: 'Nazareth', region: 'galilee', x: 206, y: 277, label: 'sw' },
  nain: { name: 'Nain', region: 'galilee', x: 244, y: 313, label: 'ne' },
  pella: { name: 'Pella', region: 'decapolis', x: 293, y: 383, label: 'w' },
  caesarea: { name: 'Caesarea', region: 'samaria', x: 69, y: 376, label: 'se' },
  sychar: { name: 'Sychar', region: 'samaria', x: 198, y: 440, label: 'e' },
  countryside: { name: 'Countryside', region: 'judea', x: 138, y: 471, label: 'n' },
  joppa: { name: 'Joppa', region: 'judea', x: 34, y: 481, label: 'se' },
  ephraim: { name: 'Ephraim', region: 'judea', x: 210, y: 527, label: 'nw' },
  jericho: { name: 'Jericho', region: 'judea', x: 238, y: 550, label: 'ne' },
  emmaus: { name: 'Emmaus', region: 'judea', x: 131, y: 548, label: 'sw' },
  jerusalem: { name: 'Jerusalem', region: 'judea', x: 173, y: 573, label: 'sw' },
  bethany: { name: 'Bethany', region: 'judea', x: 203, y: 572, label: 'se' },
  bethlehem: { name: 'Bethlehem', region: 'judea', x: 168, y: 600, label: 's' },
  'bethany-beyond-jordan': { name: 'Bethany Beyond Jordan', region: 'perea', x: 282, y: 560, label: 'e' },
};

// [from, to, how]: 'road' (black) or 'boat' (white)
export const EDGES = [
  ['tyre', 'caesarea-philippi', 'road'], ['caesarea-philippi', 'mount-hermon', 'road'], ['caesarea-philippi', 'capernaum', 'road'],
  ['tyre', 'ptolemais', 'road'], ['ptolemais', 'capernaum', 'road'], ['ptolemais', 'cana', 'road'], ['ptolemais', 'caesarea', 'road'],
  ['cana', 'magdala', 'road'], ['cana', 'nazareth', 'road'], ['nazareth', 'nain', 'road'],
  ['magdala', 'capernaum', 'road'], ['capernaum', 'bethsaida', 'road'], ['bethsaida', 'gennesaret', 'road'], ['gennesaret', 'gadara', 'road'],
  ['capernaum', 'gadara', 'boat'], ['magdala', 'gennesaret', 'boat'], ['magdala', 'pella', 'road'],
  ['nain', 'caesarea', 'road'], ['nain', 'sychar', 'road'], ['caesarea', 'sychar', 'road'], ['caesarea', 'joppa', 'road'],
  ['sychar', 'countryside', 'road'], ['countryside', 'joppa', 'road'], ['joppa', 'emmaus', 'road'], ['emmaus', 'jerusalem', 'road'],
  ['sychar', 'ephraim', 'road'], ['ephraim', 'jerusalem', 'road'], ['ephraim', 'jericho', 'road'],
  ['jerusalem', 'bethany', 'road'], ['bethany', 'jericho', 'road'], ['jerusalem', 'bethlehem', 'road'],
  ['jericho', 'bethany-beyond-jordan', 'road'], ['jericho', 'pella', 'road'], ['pella', 'bethany-beyond-jordan', 'road'],
];

export const NEIGHBORS = {};
for (const id of Object.keys(PLACES)) NEIGHBORS[id] = [];
for (const [a, b] of EDGES) { NEIGHBORS[a].push(b); NEIGHBORS[b].push(a); }

// Every simple path (no place twice) from `from` to `to`, as lists of place ids. The board is small, so this is cheap.
const pathCache = new Map();
export function simplePaths(from, to) {
  const key = from + '>' + to;
  if (pathCache.has(key)) return pathCache.get(key);
  const out = [], path = [from], seen = new Set([from]);
  (function walk(at) {
    if (at === to) { out.push([...path]); return; }
    for (const n of NEIGHBORS[at]) {
      if (seen.has(n)) continue;
      seen.add(n); path.push(n); walk(n); path.pop(); seen.delete(n);
    }
  })(from);
  pathCache.set(key, out);
  return out;
}

// A journey is worth the square of the Place Cards on its shortest route (2 cards 4, 3 cards 9, ... 6 cards 36).
export function journeyPoints(a, b) {
  const shortest = Math.min(...simplePaths(a, b).map((p) => p.length));
  return shortest * shortest;
}
