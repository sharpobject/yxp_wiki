export const TIERS = ['S', 'A', 'B', 'C', 'D', 'pool'];
export function blank(character, ids, title = '') {
  return {character, title, rows: Object.fromEntries(TIERS.map(t => [t, t === 'pool' ? [...ids] : []]))};
}
export function decode(search, characters) {
  const q = new URLSearchParams(search);
  const character = characters.find(c => c.id === Number(q.get('character'))) || characters[0];
  const state = blank(character.id, [], (q.get('title') || '').slice(0, 120));
  const allowed = new Set(character.fates), used = new Set();
  let repaired = q.has('character') && Number(q.get('character')) !== character.id;
  if (q.has('v') && q.get('v') !== '1') return {state: blank(character.id, character.fates, state.title), repaired: true};
  for (const tier of TIERS) {
    for (const part of (q.get(tier) || '').split(',').filter(Boolean)) {
      const id = /^\d+$/.test(part) ? Number(part) : NaN;
      if (!allowed.has(id) || used.has(id)) {repaired = true; continue;}
      state.rows[tier].push(id); used.add(id);
    }
  }
  state.rows.pool.push(...character.fates.filter(id => !used.has(id)));
  return {state, repaired};
}
export function encode(state) {
  const q = new URLSearchParams({v: '1', character: String(state.character), title: state.title});
  for (const tier of TIERS) q.set(tier, state.rows[tier].join(','));
  return '?' + q.toString();
}
export function move(state, id, target, before = null) {
  if (!TIERS.includes(target) || !TIERS.some(t => state.rows[t].includes(id)) || before === id) return state;
  const rows = Object.fromEntries(TIERS.map(t => [t, state.rows[t].filter(x => x !== id)]));
  const index = before == null ? -1 : rows[target].indexOf(before);
  rows[target].splice(index < 0 ? rows[target].length : index, 0, id);
  return {...state, rows};
}
