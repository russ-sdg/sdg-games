// Journeys for Paul scorepad. Same scoring as the board game and the online version (JfP/play):
// +4 per region per evangelist, +3 per preach, +5 per pastor called, -2 per city nobody visited.
import MAP from './play/js/map-data.js';

const EVS = [
  { id: 'luke', name: 'Luke', color: 'var(--luke)', start: 'Philippi' },
  { id: 'silas', name: 'Silas', color: 'var(--silas)', start: 'Antioch' },
  { id: 'titus', name: 'Titus', color: 'var(--titus)', start: 'Crete' },
];
const REGIONS = Object.entries(MAP.regions);                                  // [['mac', 'Macedonia & Achaia'], ...]
const cityById = Object.fromEntries(MAP.cities.map((c) => [c.id, c]));
const startRegion = (ev) => cityById[MAP.starts[ev.id]].region;
const startCities = new Set(Object.values(MAP.starts));
const KEY = 'jfp-scorepad-v1';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const short = (n) => n.replace('Mediterranean ', '').replace(' & Achaia', '');

let state = blank();
function blank() { return { regions: {}, cities: {}, preached: 0, called: 0 }; }
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.regions) state = { ...blank(), ...s }; } catch { /* storage unavailable */ }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } }

const regionOn = (ev, r) => r === startRegion(ev) || !!state.regions[`${ev.id}:${r}`];
const cityOn = (c) => startCities.has(c.id) || !!state.cities[c.id];

function build() {
  $('#evs').innerHTML = EVS.map((ev) => `
    <div class="sp-card sp-ev" style="--c:${ev.color}">
      <h2>${ev.name} <span class="pts" id="pts-${ev.id}">0</span></h2>
      <p class="sp-hint">Starts in ${esc(MAP.starts[ev.id])}. Which regions has ${ev.name} been to?</p>
      <div class="pills">${REGIONS.map(([r, n]) => `
        <label class="pill r-${r}"><input type="checkbox" data-region="${ev.id}:${r}" ${r === startRegion(ev) ? 'disabled' : ''}><span>${esc(short(n))}</span></label>`).join('')}
      </div>
    </div>`).join('');
  $('#cities').innerHTML = REGIONS.map(([r, n]) => `
    <div class="sp-region r-${r}"><h3>${esc(n)}</h3>
      <div class="pills">${MAP.cities.filter((c) => c.region === r).map((c) => `
        <label class="pill r-${r}"><input type="checkbox" data-city="${esc(c.id)}" ${startCities.has(c.id) ? 'disabled' : ''}><span>${esc(c.name)}</span></label>`).join('')}
      </div>
    </div>`).join('');
}

function sync() {
  document.querySelectorAll('[data-region]').forEach((i) => {
    const [e, r] = i.dataset.region.split(':');
    i.checked = regionOn(EVS.find((x) => x.id === e), r);
  });
  document.querySelectorAll('[data-city]').forEach((i) => { i.checked = cityOn(cityById[i.dataset.city]); });
  $('#preached').textContent = state.preached;
  $('#called').textContent = state.called;
  document.querySelector('[data-step=preached][data-d="-1"]').disabled = state.preached <= 0;
  document.querySelector('[data-step=called][data-d="-1"]').disabled = state.called <= 0;
  document.querySelector('[data-step=called][data-d="1"]').disabled = state.called >= 3;

  const perEv = EVS.map((ev) => 4 * REGIONS.filter(([r]) => regionOn(ev, r)).length);
  EVS.forEach((ev, i) => { $(`#pts-${ev.id}`).textContent = `${perEv[i]} pts`; });
  const regions = perEv.reduce((a, b) => a + b, 0);
  const preach = 3 * state.preached, called = 5 * state.called;
  const visited = MAP.cities.filter(cityOn).length, missed = MAP.cities.length - visited;
  const total = regions + preach + called - 2 * missed;
  $('#city-count').textContent = `${visited} of ${MAP.cities.length} visited, ${missed} missed.`;
  $('#total').textContent = total;
  $('#breakdown').innerHTML = [
    ['Regions visited', `+${regions}`], [`Preached ${state.preached} time${state.preached === 1 ? '' : 's'}`, `+${preach}`],
    [`Called as pastor ${state.called}`, `+${called}`], [`Cities not visited (${missed})`, `${missed ? '−' : ''}${2 * missed}`],
    ['Total', String(total)],
  ].map(([a, b], i, all) => `<tr${i === all.length - 1 ? ' style="font-weight:800"' : ''}><td>${esc(a)}</td><td>${b}</td></tr>`).join('');
}

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.region) state.regions[t.dataset.region] = t.checked;
  else if (t.dataset.city) state.cities[t.dataset.city] = t.checked;
  else return;
  save(); sync();
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-step]');
  if (b) {
    const k = b.dataset.step, d = Number(b.dataset.d);
    state[k] = Math.max(0, Math.min(k === 'called' ? 3 : 99, state[k] + d));
    save(); sync();
  }
});
$('#reset').addEventListener('click', () => {
  if (!confirm('Clear everything and start a new scoresheet?')) return;
  state = blank(); save(); sync();
});

load(); build(); sync();
