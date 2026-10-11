// Scripture snippets shown when an evangelist preaches (World English Bible, public domain).
import MAP from './map-data.js';
import DATA from './scripture-data.js';

export const TRANSLATION = DATA.translation;

// What to show when an evangelist preaches in `cityId`, or is called as pastor there.
export function snippetFor(cityId, called = false) {
  const idx = MAP.cities.findIndex((c) => c.id === cityId);
  const name = MAP.cities[idx].name;
  const own = DATA.cities[cityId];
  if (called) {
    return { heading: `Called as pastor in ${name}`, ...DATA.called, note: `He stays on to shepherd the church in ${name}, and his journeys are over.`, translation: TRANSLATION };
  }
  if (own) return { heading: `Preaching in ${name}`, ...own, note: null, translation: TRANSLATION };
  // a city that exists in Paul's world but is not named in the New Testament
  const fb = DATA.fallback[idx % DATA.fallback.length];
  return {
    heading: `Preaching in ${name}`, ...fb, translation: TRANSLATION,
    note: `${name} isn't named in the New Testament. It was a real city of Paul's world, and for the game we assume it had a church.`,
  };
}
