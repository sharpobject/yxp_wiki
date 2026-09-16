export const TIERS = ['S', 'A', 'B', 'C', 'D', 'pool'];
export function blank(character, ids, title = '', career = 1) {
  return {character, career, title, rows: Object.fromEntries(TIERS.map(t => [t, t === 'pool' ? [...ids] : []]))};
}
export function eligibleIds(data, characterId, career) {
  const character = data.characters.find(c => c.id === characterId);
  const allowed = new Set(data.fates.filter(f => !f.careers?.length || f.careers.includes(career)).map(f => f.id));
  return character.fates.filter(id => allowed.has(id));
}
export function decode(search, data) {
  const characters = data.characters;
  const q = new URLSearchParams(search);
  const character = characters.find(c => c.id === Number(q.get('character'))) || characters[0];
  const career = data.sideJobs.find(j => j.id === Number(q.get('career')))?.id ?? data.sideJobs[0].id;
  const ids = eligibleIds(data, character.id, career);
  const state = blank(character.id, [], (q.get('title') || '').slice(0, 120), career);
  const allowed = new Set(ids), used = new Set();
  let repaired = (q.has('character') && Number(q.get('character')) !== character.id) || (q.has('career') && Number(q.get('career')) !== career);
  if (q.has('v') && q.get('v') !== '1') return {state: blank(character.id, ids, state.title, career), repaired: true};
  for (const tier of TIERS) {
    for (const part of (q.get(tier) || '').split(',').filter(Boolean)) {
      const id = /^\d+$/.test(part) ? Number(part) : NaN;
      if (!allowed.has(id) || used.has(id)) {repaired = true; continue;}
      state.rows[tier].push(id); used.add(id);
    }
  }
  state.rows.pool.push(...ids.filter(id => !used.has(id)));
  return {state, repaired};
}
export function encode(state) {
  const q = new URLSearchParams({v: '1', character: String(state.character), career: String(state.career), title: state.title});
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
