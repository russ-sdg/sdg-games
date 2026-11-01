// Prophets & Kings: the 70 cards and who matches whom. The matches and the copy counts come from the designer's grid
// (Prophets Kings - PK Grid.csv) and agree with the lists printed at the foot of each card. pk/play/engine.test.js checks the
// totals (28 prophets, 42 kings) and that every picture exists.
//
// pics: how many different pictures exist (Jeroboam II is printed 3 times and Darius twice from one picture each).
export const PROPHETS = [
  // name, copies, pics, slug, the kings of his day
  ['Elijah', 2, 2, 'elijah', ['Ahab', 'Ahaziah', 'Joram']],
  ['Elisha', 4, 4, 'elisha', ['Ahab', 'Ahaziah', 'Joram', 'Jehu', 'Jehoahaz (Israel)', 'Jehoash']],
  ['Jonah', 1, 1, 'jonah', ['Jeroboam II']],
  ['Amos', 1, 1, 'amos', ['Uzziah', 'Jeroboam II']],
  ['Hosea', 3, 3, 'hosea', ['Jeroboam II', 'Uzziah', 'Jotham', 'Ahaz', 'Hezekiah']],
  ['Isaiah', 3, 3, 'isaiah', ['Uzziah', 'Jotham', 'Ahaz', 'Hezekiah', 'Manasseh']],
  ['Micah', 2, 2, 'micah', ['Jotham', 'Ahaz', 'Hezekiah']],
  ['Zephaniah', 1, 1, 'zephaniah', ['Josiah']],
  ['Jeremiah', 4, 4, 'jeremiah', ['Josiah', 'Jehoahaz (Judah)', 'Jehoiakim', 'Jehoiachin', 'Zedekiah', 'Nebuchadnezzar']],
  ['Habakkuk', 1, 1, 'habakkuk', ['Jehoiakim']],
  ['Daniel', 2, 2, 'daniel', ['Jehoiakim', 'Nebuchadnezzar', 'Belshazzar', 'Cyrus']],
  ['Ezekiel', 2, 2, 'ezekiel', ['Jehoiachin', 'Zedekiah', 'Nebuchadnezzar']],
  ['Zechariah', 1, 1, 'zechariah', ['Darius']],
  ['Haggai', 1, 1, 'haggai', ['Darius']],
];

// name, copies, pics, slug, group (israel = northern kingdom, judah = southern kingdom, gentile = other nations)
export const KINGS = [
  ['Ahab', 2, 2, 'ahab', 'israel'], ['Ahaziah', 2, 2, 'ahaziah', 'israel'], ['Joram', 2, 2, 'joram', 'israel'],
  ['Jehu', 1, 1, 'jehu', 'israel'], ['Jehoahaz (Israel)', 1, 1, 'jehoahaz-israel', 'israel'], ['Jehoash', 1, 1, 'jehoash', 'israel'],
  ['Jeroboam II', 3, 1, 'jeroboam-ii', 'israel'],
  ['Uzziah', 3, 3, 'uzziah', 'judah'], ['Jotham', 3, 3, 'jotham', 'judah'], ['Ahaz', 3, 3, 'ahaz', 'judah'], ['Hezekiah', 3, 3, 'hezekiah', 'judah'],
  ['Manasseh', 1, 1, 'manasseh', 'judah'], ['Josiah', 2, 2, 'josiah', 'judah'], ['Jehoahaz (Judah)', 1, 1, 'jehoahaz-judah', 'judah'],
  ['Jehoiakim', 3, 3, 'jehoiakim', 'judah'], ['Jehoiachin', 2, 2, 'jehoiachin', 'judah'], ['Zedekiah', 2, 2, 'zedekiah', 'judah'],
  ['Nebuchadnezzar', 3, 3, 'nebuchadnezzar', 'gentile'], ['Belshazzar', 1, 1, 'belshazzar', 'gentile'], ['Cyrus', 1, 1, 'cyrus', 'gentile'],
  ['Darius', 2, 1, 'darius', 'gentile'],
];
