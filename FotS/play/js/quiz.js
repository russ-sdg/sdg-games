// Goodness: "recite from memory the nine Fruits of the Spirit. They don't have to be in order and they don't have to be from any
// specific Bible translation (e.g. saying 'longsuffering' rather than 'patience' is perfectly acceptable)."
// check(text) says which of the nine were named; a near spelling (one letter out) counts.
export const ANSWERS = {
  love: ['love', 'charity'], joy: ['joy'], peace: ['peace'], patience: ['patience', 'longsuffering', 'forbearance'],
  kindness: ['kindness'], goodness: ['goodness'], faithfulness: ['faithfulness', 'faith', 'faithful', 'fidelity'],
  gentleness: ['gentleness', 'meekness', 'gentle'], selfcontrol: ['selfcontrol', 'temperance', 'selfdiscipline'],
};
function distance(a, b) {                                              // edit distance, small strings
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const close = (word, ans) => word === ans || (ans.length >= 6 && Math.abs(word.length - ans.length) <= 1 && distance(word, ans) <= 1);
export function check(text) {
  const t = String(text).toLowerCase().replace(/self[\s-]*(control|discipline)/g, (m, x) => 'self' + x).replace(/long[\s-]*suffering/g, 'longsuffering');
  const words = t.split(/[^a-z]+/).filter(Boolean), found = new Set();
  for (const w of words) for (const [f, answers] of Object.entries(ANSWERS)) if (answers.some((a) => close(w, a))) found.add(f);
  return { found: [...found], count: found.size, ok: found.size === 9 };
}
