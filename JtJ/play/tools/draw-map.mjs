// Writes the tile graph as JSON ({tiles, adj}) so it can be drawn over the printed map and checked by eye:
//   node tools/draw-map.mjs > /tmp/graph.json
import { TILES, ADJ, SITES } from '../js/map-data.js';

const dead = TILES.filter((t) => ADJ[t.i].length <= 1).map((t) => `${t.x},${t.y}`);
console.error(`${TILES.length} squares, ${SITES.length} sites, ${ADJ.reduce((n, l) => n + l.length, 0) / 2} edges; dead ends: ${dead.join(' ')}`);
console.log(JSON.stringify({ tiles: TILES, adj: ADJ }));
