// The 48 playing cards of Illuminate: four Gospels of twelve cards. Each card has a chapter and first verse (its value), and one or
// two role symbols (a "Grace" card for the player whose role matches). Four cards are Special Action cards (a star, no role symbol).
// Symbols were read from the card pictures: D doctor (medical symbol), N neighbor (heart), P preacher (church), T teacher (bell).
export const SUITS = ['matthew', 'mark', 'luke', 'john'];
export const SUIT_NAMES = { matthew: 'Matthew', mark: 'Mark', luke: 'Luke', john: 'John' };
export const ROLES = ['doctor', 'neighbor', 'preacher', 'teacher'];
export const ROLE_NAMES = { doctor: 'Doctor', neighbor: 'Neighbor', preacher: 'Preacher', teacher: 'Teacher' };
export const SYMBOL = { doctor: '⚕️', neighbor: '❤️', preacher: '⛪', teacher: '🔔' };
export const ROLE_COLOR = { doctor: '#1f3fbf', neighbor: '#d11a2a', preacher: '#1e7a2c', teacher: '#e07b12' };
const R = { D: 'doctor', N: 'neighbor', P: 'preacher', T: 'teacher' };
const TABLE = {
  matthew: ['4-17 P', '5-6 T', '9-22 D', '9-36 N', '10-27 PT', '11-4-5 D', '12-49-50 N', '14-14 D', '16-21 T', '16-25 P', '19-30 lowest', '22-37-39 N'],
  mark: ['1-11 N', '1-14-15 P', '1-17 T', '1-31 D', '1-41 NP', '4-2 T', '6-56 D', '7-14 T', '8-34 P', '10-21 N', '10-52 D', '14-27 leader'],
  luke: ['4-39 D', '6-31 N', '7-50 P', '8-4 T', '8-50 DN', '9-6 P', '11-1 T', '11-28 P', '15-2 N', '18-43 D', '19-24 rotate', '19-47 T'],
  john: ['1-5 nograce', '3-2 T', '5-8-9 D', '6-11 N', '6-44 P', '9-6-7 TD', '10-14-15 N', '11-25 P', '11-35 N', '11-43-44 D', '12-35 T', '14-1 P'],
};
export const SPECIAL_TEXT = {
  lowest: 'The lowest card (any Gospel) wins this trick.',
  leader: 'The player who led wins this trick.',
  rotate: 'Roles rotate to the right.',
  nograce: 'Grace cards are disabled for this trick.',
};
export const CARDS = [];
export const CARD = {};
for (const suit of SUITS) for (const row of TABLE[suit]) {
  const [ref, tag] = row.split(' '), parts = ref.split('-'), special = ['lowest', 'leader', 'rotate', 'nograce'].includes(tag) ? tag : null;
  const c = { id: `${suit}-${ref}`, suit, ch: Number(parts[0]), vs: Number(parts[1]), label: `${SUIT_NAMES[suit]} ${parts[0]}:${parts.slice(1).join('-')}`,
    roles: special ? [] : [...tag].map((x) => R[x]), special };
  CARDS.push(c); CARD[c.id] = c;
}
export const value = (id) => CARD[id].ch * 100 + CARD[id].vs;
export const cardImage = (id, w = 320) => `../../assets/illuminate-web/cards/${id}-${w}.webp`;
export const backImage = (w = 320) => cardImage('back', w);
export const roleImage = (r, w = 320) => cardImage(r, w);
const SUIT_ORDER = Object.fromEntries(SUITS.map((s, i) => [s, i]));
export const byHand = (a, b) => SUIT_ORDER[CARD[a].suit] - SUIT_ORDER[CARD[b].suit] || value(a) - value(b);
