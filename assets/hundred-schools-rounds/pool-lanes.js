/**
 * Assign encounter pools to fixed columns without overlapping inclusive ranges.
 * Returns chronological arrays containing the original pool objects. Source
 * visitor order seeds the columns; later pools prefer their visitor's old lane
 * or a nearby free lane. The input array and pool objects are not changed.
 */
function buildPoolLanes(pools) {
  const entries = pools.filter(pool => !pool.special).map((pool, order) => ({pool, order}));
  const visitorOrder = new Map();
  for (const {pool} of entries) {
    if (!Number.isInteger(pool.minRound) || !Number.isInteger(pool.maxRound) || pool.minRound > pool.maxRound) {
      throw new RangeError('Invalid encounter round range: ' + pool.id);
    }
    if (!visitorOrder.has(pool.visitor)) visitorOrder.set(pool.visitor, visitorOrder.size);
  }
  entries.sort((a, b) => a.pool.minRound - b.pool.minRound || a.order - b.order);
  const lanes = [];
  const last = lane => lane[lane.length - 1];
  const free = (lane, round) => last(lane).maxRound < round;
  const containsVisitor = (lane, visitor) => lane.some(pool => pool.visitor === visitor);

  // Find the source-order gap for a visitor that has not appeared yet.
  function sourceAnchor(visitor) {
    const rank = visitorOrder.get(visitor);
    const current = lanes.map((lane, index) => ({index, rank: visitorOrder.get(last(lane).visitor)}));
    const before = current.filter(item => item.rank < rank);
    const after = current.filter(item => item.rank > rank);
    const beforeRank = Math.max(...before.map(item => item.rank));
    const afterRank = Math.min(...after.map(item => item.rank));
    const left = Math.max(...before.filter(item => item.rank === beforeRank).map(item => item.index));
    const right = Math.min(...after.filter(item => item.rank === afterRank).map(item => item.index));
    if (before.length && after.length) return (left + right) / 2;
    if (before.length) return left + 1;
    if (after.length) return right - 1;
    return 0;
  }

  for (let offset = 0; offset < entries.length;) {
    const round = entries[offset].pool.minRound;
    let end = offset + 1;
    while (end < entries.length && entries[end].pool.minRound === round) end++;
    const batch = entries.slice(offset, end);
    const canReuse = pool => lanes.some(lane => free(lane, round) && containsVisitor(lane, pool.visitor));
    // Reserve existing visitor lanes before placing newcomers starting together.
    batch.sort((a, b) => Number(canReuse(b.pool)) - Number(canReuse(a.pool)) ||
      visitorOrder.get(a.pool.visitor) - visitorOrder.get(b.pool.visitor) || a.order - b.order);
    for (const {pool} of batch) {
      const ownColumns = lanes.flatMap((lane, index) => containsVisitor(lane, pool.visitor) ? [index] : []);
      const anchor = ownColumns.length ? null : sourceAnchor(pool.visitor);
      const candidates = lanes.flatMap((lane, index) => {
        if (!free(lane, round)) return [];
        const reuse = last(lane).visitor === pool.visitor ? 0 : containsVisitor(lane, pool.visitor) ? 1 : 2;
        const distance = ownColumns.length ? Math.min(...ownColumns.map(column => Math.abs(column - index))) : Math.abs(index - anchor);
        return [{index, score: [reuse, distance, -last(lane).maxRound, index]}];
      });
      candidates.sort((a, b) => {
        for (let i = 0; i < a.score.length; i++) if (a.score[i] !== b.score[i]) return a.score[i] - b.score[i];
        return 0;
      });
      if (candidates.length) lanes[candidates[0].index].push(pool);
      else lanes.push([pool]);
    }
    offset = end;
  }
  return lanes;
}
