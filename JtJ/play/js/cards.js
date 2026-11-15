// The 18 Character Cards, read off the printed cards (JtJ/cards-data.js has the pictures). Each lists the sites visited and the
// Scripture that puts the character there; points are the number printed on the card.
// category: apostle | friend | enemy
export const CATEGORIES = [
  { id: 'apostle', name: 'Apostle', plural: 'Apostles', bar: '#0a6b0a' },
  { id: 'friend', name: 'Friend of Jesus', plural: 'Friends of Jesus', bar: '#1f3fd1' },
  { id: 'enemy', name: 'Enemy of Christ', plural: 'Enemies of Christ', bar: '#d11f3f' },
];

const j = (...pairs) => pairs.map(([site, ref]) => ({ site, ref }));
const BETH = 'bethany', MT = 'olives', GETH = 'gethsemane', TEMP = 'temple', UPPER = 'upper-room', PRAE = 'praetorium', HER = 'herod', CAI = 'caiaphas', GOLG = 'golgotha', TOMB = 'tomb', EMM = 'emmaus';

export const CARDS = [
  { id: 'peter', name: 'Peter', cat: 'apostle', pts: 170, stops: j([BETH, 'Matthew 26:6-13'], [MT, 'Mark 13:3-37'], [GETH, 'Matthew 26:36-46'], [TEMP, 'Luke 24:52-53'], [UPPER, 'John 13:1-17'], [CAI, 'Luke 22:54-62'], [TOMB, 'John 20:3-10']) },
  { id: 'andrew', name: 'Andrew', cat: 'apostle', pts: 125, stops: j([BETH, 'Matthew 26:6-13'], [MT, 'Mark 13:3-37'], [GETH, 'Luke 22:39-46'], [TEMP, 'Mark 13:1-2'], [UPPER, 'Acts 1:12-14']) },
  { id: 'james', name: 'James', cat: 'apostle', pts: 125, stops: j([BETH, 'Matthew 26:6-13'], [MT, 'Mark 13:3-37'], [GETH, 'Mark 14:32-42'], [TEMP, 'Mark 13:1-2'], [UPPER, 'John 20:19-23']) },
  { id: 'john', name: 'John', cat: 'apostle', pts: 150, stops: j([BETH, 'John 12:1-3'], [MT, 'Mark 13:3-37'], [GETH, 'John 18:1'], [TEMP, 'Luke 24:52-53'], [UPPER, 'Matthew 26:20'], [GOLG, 'John 19:25-27'], [TOMB, 'John 20:3-4']) },
  { id: 'philip', name: 'Philip', cat: 'apostle', pts: 125, stops: j([BETH, 'Matthew 26:6-13'], [MT, 'Matthew 24:3-14'], [GETH, 'Luke 22:39-46'], [TEMP, 'Mark 13:1-2'], [UPPER, 'Acts 1:12-14']) },
  { id: 'matthew', name: 'Matthew', cat: 'apostle', pts: 125, stops: j([BETH, 'Matthew 26:6-13'], [MT, 'Matthew 24:3-14'], [GETH, 'Luke 22:47-53'], [TEMP, 'Mark 13:1-2'], [UPPER, 'Acts 1:12-14']) },
  { id: 'thomas', name: 'Thomas', cat: 'apostle', pts: 125, stops: j([BETH, 'Matthew 26:6-13'], [MT, 'Matthew 24:3-14'], [GETH, 'Luke 22:47-53'], [TEMP, 'Mark 13:1-2'], [UPPER, 'John 20:24-29']) },
  { id: 'mary-magdalene', name: 'Mary Magdalene', cat: 'friend', pts: 50, stops: j([UPPER, 'John 20:2'], [GOLG, 'Matthew 27:55-56'], [TOMB, 'Mark 16:1-7']) },
  { id: 'nicodemus', name: 'Nicodemus', cat: 'friend', pts: 30, stops: j([GOLG, 'John 19:39-40'], [TOMB, 'John 19:41-42']) },
  { id: 'joseph-of-arimathea', name: 'Joseph of Arimathea', cat: 'friend', pts: 45, stops: j([PRAE, 'Mark 15:42-45'], [GOLG, 'Matthew 27:59'], [TOMB, 'Matthew 27:60']) },
  { id: 'simon-of-cyrene', name: 'Simon of Cyrene', cat: 'friend', pts: 35, stops: j([PRAE, 'Mark 15:21'], [GOLG, 'Mark 15:22']) },
  { id: 'cleopas', name: 'Cleopas', cat: 'friend', pts: 55, stops: j([UPPER, 'Luke 24:33'], [EMM, 'Luke 24:13-32']) },
  { id: 'caiaphas', name: 'Caiaphas', cat: 'enemy', pts: 85, stops: j([TEMP, 'Mark 11:27-33'], [PRAE, 'Matthew 27:1-2'], [CAI, 'Matthew 26:57-65'], [GOLG, 'Mark 15:31-32']) },
  { id: 'judas', name: 'Judas', cat: 'enemy', pts: 130, stops: j([BETH, 'John 12:1-8'], [GETH, 'Luke 22:47-53'], [TEMP, 'Matthew 27:3-10'], [UPPER, 'John 13:18-30'], [CAI, 'Matthew 26:14-16']) },
  { id: 'malchus', name: 'Malchus', cat: 'enemy', pts: 80, stops: j([GETH, 'John 18:1-11'], [PRAE, 'Luke 23:1-2'], [CAI, 'Luke 22:54']) },
  { id: 'centurion', name: 'Centurion', cat: 'enemy', pts: 80, stops: j([PRAE, 'Mark 15:44-45'], [HER, 'Luke 23:11'], [CAI, 'Matthew 28:11-15'], [GOLG, 'Mark 15:39'], [TOMB, 'Matthew 27:62-66']) },
  { id: 'pharisee', name: 'Pharisee', cat: 'enemy', pts: 100, stops: j([MT, 'Luke 19:37-40'], [GETH, 'John 18:2-7'], [TEMP, 'Luke 20:20-26'], [CAI, 'Matthew 26:57-59']) },
  { id: 'scribe', name: 'Scribe', cat: 'enemy', pts: 70, stops: j([TEMP, 'Mark 12:28-34'], [CAI, 'Mark 14:53-65'], [GOLG, 'Mark 15:31-32']) },
];
export const CARD = Object.fromEntries(CARDS.map((c) => [c.id, c]));
export const cardImage = (id, w = 320) => `../../assets/jtj-web/cards/${id}-${w}.webp`;
