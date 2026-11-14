'use strict';

(function (global) {
  const words = {
    en: {
      allSects: 'All sects', round: 'Round', encounterPools: 'encounter pools', potentialFates: 'potential fates',
      potential: 'Potential fates', skip: 'Skip', example: 'Example', last: 'Last', lastOffer: 'Last offer',
      additional: 'Additional condition', noPool: 'No encounter pool', lane: 'Pool lane',
      showRound: 'Show round', opening: 'Round 1 only',
      lastLegend: 'Final offer round for the shown fate',
      caption: 'One pool per vertical lane. Shading identifies its skip destination. Last markers identify a fate’s final offer round.',
    },
    zh: {
      allSects: '全部门派', round: '回合', encounterPools: '个奇遇池', potentialFates: '个可选仙命',
      potential: '可选仙命', skip: '跳过', example: '示例', last: '末次', lastOffer: '最后出现',
      additional: '额外条件', noPool: '无奇遇池', lane: '奇遇池列',
      showRound: '查看回合', opening: '仅第 1 回合',
      lastLegend: '所示仙命最后出现的回合',
      caption: '每列显示一个奇遇池，底色表示跳过后的去向。“末次”标记表示所示仙命最后出现的回合。',
    },
  };
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const integer = value => Number.isInteger(value);
  const openingOnly = pool => !pool.special && pool.minRound === 1 && pool.maxRound === 1;

  // Every observable round remains selectable, including newly added windows.
  function selectableRounds(data) {
    const rounds = new Set();
    for (const pool of data.pools) {
      if (pool.special || !integer(pool.minRound) || !integer(pool.maxRound)) continue;
      for (let round = Math.max(1, pool.minRound); round <= pool.maxRound; round++) rounds.add(round);
    }
    return [...rounds].sort((a, b) => a - b);
  }
  function normalizeRound(value, rounds) {
    const number = Number(value);
    if (!Number.isInteger(number)) return rounds[0] ?? 1;
    return rounds.filter(round => round <= number).at(-1) ?? rounds[0] ?? 1;
  }
  function eligible(data, fate, characterId, jobId, round) {
    const rule = fate.eligibility || {};
    const included = rule.includeCharacters || [];
    if (characterId) {
      const sect = data.characters.find(character => character.id === characterId)?.sect;
      if ((rule.excludeCharacters || []).includes(characterId) || (rule.excludeSects || []).includes(sect)) return false;
      // Native precedence: an explicit roster replaces the broad sect rule.
      if (included.length ? !included.includes(characterId) : rule.sect && rule.sect !== sect) return false;
    }
    if (jobId && rule.career && rule.career !== jobId) return false;
    return (fate.minRound == null || round >= fate.minRound) && (fate.maxRound == null || round <= fate.maxRound);
  }
  function filteredFates(data, pool, characterId, jobId, round) {
    const specificity = fate => (characterId && (fate.eligibility?.includeCharacters || []).includes(characterId) ? 2 : 0) +
      (jobId && fate.eligibility?.career === jobId ? 1 : 0);
    return pool.fates.filter(fate => eligible(data, fate, characterId, jobId, round)).sort((a, b) => specificity(b) - specificity(a));
  }
  function encounterPools(data, characterId, jobId, round) {
    return data.pools.filter(pool => !pool.special && round >= pool.minRound && round <= pool.maxRound &&
      filteredFates(data, pool, characterId, jobId, round).length);
  }
  function skipPools(data, characterId, jobId, round) {
    const targets = new Set(encounterPools(data, characterId, jobId, round).map(pool => pool.skipTarget));
    return data.pools.filter(pool => pool.special && targets.has(pool.id) && filteredFates(data, pool, characterId, jobId, round).length);
  }
  function earlyLastRound(fate, pool, maximum) {
    return fate.maxRound != null && fate.maxRound < (pool.maxRound ?? maximum) ? fate.maxRound : null;
  }
  function cutoffFates(data, characterId, jobId, rounds) {
    const maximum = rounds.at(-1) ?? 1;
    return data.pools.flatMap(pool => pool.fates.flatMap(fate => {
      const last = earlyLastRound(fate, pool, maximum);
      if (last == null || !rounds.includes(last) || !eligible(data, fate, characterId, jobId, last)) return [];
      const available = pool.special ? skipPools(data, characterId, jobId, last).includes(pool) : last >= pool.minRound;
      return available ? [{pool, fate, last}] : [];
    })).sort((a, b) => a.last - b.last || a.pool.id.localeCompare(b.pool.id));
  }
  function skipStyles(data) {
    const ids = new Set(data.pools.map(pool => pool.skipTarget).filter(Boolean));
    const targets = data.pools.filter(pool => ids.has(pool.id)).sort((a, b) => (a.configId ?? 0) - (b.configId ?? 0) || a.id.localeCompare(b.id));
    return new Map(targets.map((pool, index) => [pool.id, index]));
  }
  function initialState(data, params, saved = {}) {
    const hasProfile = params.has('character') || params.has('side-job');
    const valid = (value, items) => value != null && (String(value) === '0' || items.some(item => String(item.id) === String(value))) ? String(value) : '';
    return {
      character: valid(hasProfile ? params.get('character') : saved.character, data.characters),
      job: valid(hasProfile ? params.get('side-job') : saved.job, data.sideJobs),
      round: normalizeRound(params.get('round') || (hasProfile ? 1 : saved.round) || 1, selectableRounds(data)),
    };
  }
  function languageUrl(href, currentUrl, state) {
    const target = new URL(href, currentUrl);
    target.search = new URL(currentUrl).search;
    if (state.character !== '') target.searchParams.set('character', state.character);
    if (state.job !== '') target.searchParams.set('side-job', state.job);
    target.searchParams.set('round', state.round);
    return target.href;
  }

  function mount(document, window, data) {
    const byId = id => document.getElementById(id);
    const text = words[data.lang] || words.en;
    const character = byId('character'), sideJob = byId('side-job');
    const rounds = selectableRounds(data);
    const maximum = rounds.at(-1) ?? 1;
    const poolsById = new Map(data.pools.map(pool => [pool.id, pool]));
    const styles = skipStyles(data);
    const openingPools = data.pools.filter(openingOnly);
    const lanes = buildPoolLanes(data.pools.filter(pool => !openingOnly(pool)));
    const storageKey = 'hundred-schools-rounds-v1';
    let round = rounds[0] ?? 1;

    for (const sect of [...new Set(data.characters.map(item => item.sect))].sort((a, b) => a - b)) {
      const group = document.createElement('optgroup');
      group.label = data.sectNames?.[sect] || text.allSects;
      for (const item of data.characters.filter(item => item.sect === sect)) group.append(new window.Option(item.name, item.id));
      character.append(group);
    }
    for (const job of data.sideJobs) sideJob.append(new window.Option(job.name, job.id));
    const fatesFor = (pool, selectedRound = round) => filteredFates(data, pool, +character.value, +sideJob.value, selectedRound);
    const sourceLink = id => data.sourceUrl + '#' + encodeURIComponent(id);
    const iconHTML = fate => `<span class="fate-icon">${fate.artworkHtml || ''}</span>`;
    const styleClass = pool => styles.has(pool.skipTarget) ? ` skip-style-${styles.get(pool.skipTarget)}${styles.get(pool.skipTarget) === 1 ? ' skip-two' : ''}` : '';
    const styleData = pool => styles.has(pool.skipTarget) ? ` data-skip-style="${styles.get(pool.skipTarget)}"` : '';
    const skipLabel = pool => {
      const target = poolsById.get(pool.skipTarget);
      return target ? ` · ${text.skip} → ${target.name}` : '';
    };
    const legend = byId('skip-legend');
    if (legend) {
      legend.innerHTML = [...styles].map(([id, index]) => `<span><i class="legend-swatch skip-style-${index}${index === 1 ? ' skip-two' : ''}" data-skip-style="${index}" aria-hidden="true"></i>${text.skip} → ${escapeHTML(poolsById.get(id).name)}</span>`).join('') +
        `<span><i class="last-offer-label" aria-hidden="true">${text.last}</i>${text.lastLegend}</span>`;
    }
    function endingFates(pool, selectedRound) {
      return fatesFor(pool, selectedRound).filter(fate => earlyLastRound(fate, pool, maximum) === selectedRound);
    }
    function fateHTML(fate, pool) {
      const conditions = fate.conditions || [];
      const condition = conditions.length ? `<span class="condition-mark" aria-label="${escapeHTML(text.additional + ': ' + conditions.join('; '))}">◇</span>` : '';
      const last = earlyLastRound(fate, pool, maximum);
      const deadline = last == null ? '' : `<span class="fate-deadline${round === last ? ' last-now' : ''}">${text.lastOffer}: R${last}</span>`;
      return `<li><a class="fate" data-fate="${escapeHTML(fate.id)}" href="${escapeHTML(sourceLink(fate.id))}" title="${escapeHTML(fate.name + (conditions.length ? ' — ' + conditions.join('; ') : ''))}">${iconHTML(fate)}<span>${escapeHTML(fate.name)}${condition}${deadline}</span></a></li>`;
    }
    function poolHTML(pool) {
      const fates = fatesFor(pool), target = poolsById.get(pool.skipTarget);
      return `<article class="pool-card" id="${escapeHTML(pool.id)}"><div class="pool-head"><h3><a href="${escapeHTML(sourceLink(pool.id))}">${escapeHTML(pool.name)}</a></h3><span class="pool-total" title="${text.potential}">${fates.length}</span><p class="pool-theme">${escapeHTML(pool.theme)}</p></div><ul class="fate-list">${fates.map(fate => fateHTML(fate, pool)).join('')}</ul>${target ? `<button class="pool-skip" data-skip="${escapeHTML(target.id)}">${text.skip} → ${escapeHTML(target.name)} <span aria-hidden="true">↗</span></button>` : ''}</article>`;
    }
    function updateLanguageLink() {
      const link = byId('rounds-language-switch');
      if (link) link.href = languageUrl(link.href, window.location.href, {character: character.value, job: sideJob.value, round});
    }
    function save() {
      const state = {character: character.value, job: sideJob.value, round};
      try { window.localStorage.setItem(storageKey, JSON.stringify(state)); } catch {}
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('character', character.value); url.searchParams.set('side-job', sideJob.value); url.searchParams.set('round', round);
        window.history.replaceState(null, '', url);
      } catch {}
      updateLanguageLink();
    }
    function renderDetail() {
      const pools = encounterPools(data, +character.value, +sideJob.value, round);
      const special = skipPools(data, +character.value, +sideJob.value, round);
      byId('round-title').textContent = text.round + ' ' + String(round).padStart(2, '0');
      byId('profile').textContent = (character.selectedOptions[0]?.text || '') + ' / ' + (sideJob.selectedOptions[0]?.text || '');
      byId('round-count').textContent = pools.length + ' ' + text.encounterPools + ' · ' + pools.reduce((sum, pool) => sum + fatesFor(pool).length, 0) + ' ' + text.potentialFates;
      byId('encounter-pools').innerHTML = pools.map(poolHTML).join('');
      byId('skip-pools').innerHTML = special.map(poolHTML).join('');
      if (byId('skip-section')) byId('skip-section').hidden = !special.length;
      document.querySelectorAll('.round-button').forEach(button => button.setAttribute('aria-current', String(+button.dataset.round === round)));
      document.querySelectorAll('.overview-row').forEach(row => row.classList.toggle('current', +row.dataset.round === round));
    }
    function renderOverview() {
      const headings = lanes.map((_, index) => `<th scope="col" class="lane-heading"><span class="sr-only">${text.lane} ${index + 1}</span></th>`).join('');
      const rows = rounds.map(selectedRound => {
        const cells = lanes.map((lane, laneIndex) => {
          const pool = lane.find(pool => selectedRound >= pool.minRound && selectedRound <= pool.maxRound);
          if (!pool || !fatesFor(pool, selectedRound).length) return `<td class="lane-cell"><span class="matrix-empty" aria-label="${text.noPool}">—</span></td>`;
          const first = rounds.find(value => value >= pool.minRound && value <= pool.maxRound) === selectedRound;
          const last = rounds.filter(value => value >= pool.minRound && value <= pool.maxRound).at(-1) === selectedRound;
          const endings = endingFates(pool, selectedRound), fate = endings[0] || fatesFor(pool, selectedRound)[0];
          const label = `${text.round} ${selectedRound} · ${pool.name} · ${pool.theme} · ${text.example}: ${fate.name}${skipLabel(pool)}${endings.length ? ' · ' + text.lastOffer + ': ' + endings.map(item => item.name).join(', ') : ''}`;
          const marker = endings.length ? `<span class="last-offer-label">${text.last}${endings.length > 1 ? ' ×' + endings.length : ''}</span>` : '';
          return `<td class="lane-cell active${styleClass(pool)}${first ? ' pool-start' : ''}${last ? ' pool-end' : ''}"${styleData(pool)}><button class="matrix-pool${endings.length ? ' has-cutoff' : ''}" data-pool="${escapeHTML(pool.id)}" data-lane="${laneIndex}" data-select-round="${selectedRound}" data-fate="${escapeHTML(fate.id)}" data-skip-target="${escapeHTML(pool.skipTarget || '')}" title="${escapeHTML(label)}" aria-label="${escapeHTML(label)}">${iconHTML(fate)}${marker}</button></td>`;
        }).join('');
        return `<tr class="overview-row" data-round="${selectedRound}"><th scope="row"><button class="overview-round" data-select-round="${selectedRound}" aria-label="${text.showRound} ${selectedRound}">${String(selectedRound).padStart(2, '0')}</button></th>${cells}</tr>`;
      }).join('');
      byId('overview-rows').innerHTML = `<table class="availability-matrix"><caption class="sr-only">${text.caption}</caption><colgroup><col class="round-column">${lanes.map(() => '<col>').join('')}</colgroup><thead><tr><th scope="col" class="matrix-corner">${text.round}</th>${headings}</tr></thead><tbody>${rows}</tbody></table>`;
      const opening = openingPools.filter(pool => fatesFor(pool, 1).length);
      if (byId('round-one-section')) byId('round-one-section').hidden = !opening.length;
      byId('round-one-pools').innerHTML = opening.map(pool => {
        const fate = fatesFor(pool, 1)[0];
        const label = `${text.opening} · ${pool.name} · ${pool.theme} · ${text.example}: ${fate.name}${skipLabel(pool)}`;
        return `<button class="opening-pool${styleClass(pool)}"${styleData(pool)} data-pool="${escapeHTML(pool.id)}" data-select-round="1" data-fate="${escapeHTML(fate.id)}" data-skip-target="${escapeHTML(pool.skipTarget || '')}" title="${escapeHTML(label)}"><span class="opening-label"><strong>${escapeHTML(pool.name)}</strong><small>${escapeHTML(pool.theme)}</small></span>${iconHTML(fate)}</button>`;
      }).join('');
      const cutoffs = cutoffFates(data, +character.value, +sideJob.value, rounds);
      byId('fate-cutoffs').hidden = !cutoffs.length;
      byId('cutoff-list').innerHTML = cutoffs.map(({pool, fate, last}) => `<button class="cutoff-item" data-pool="${escapeHTML(pool.id)}" data-select-round="${last}" data-fate="${escapeHTML(fate.id)}" title="${escapeHTML(pool.name)}">${iconHTML(fate)}<span><strong>${escapeHTML(fate.name)}</strong><small>${escapeHTML(pool.name)}</small></span><span class="cutoff-round">${text.last}<br><b>R${last}</b></span></button>`).join('');
    }
    function refresh() {
      const ready = character.value !== '' && sideJob.value !== '';
      byId('welcome').hidden = ready; byId('results').hidden = !ready;
      if (ready) { renderOverview(); renderDetail(); save(); }
      else updateLanguageLink();
    }
    function revealPool(id, fateId) {
      const card = byId(id); if (!card) return;
      document.querySelectorAll('.highlight').forEach(element => element.classList.remove('highlight'));
      card.classList.add('highlight'); card.scrollIntoView({block: 'start'});
      const fate = fateId ? [...card.querySelectorAll('.fate')].find(element => element.dataset.fate === fateId) : null;
      if (fate) { fate.classList.add('deadline-focus'); fate.scrollIntoView({block: 'nearest'}); fate.focus({preventScroll: true}); }
      else card.querySelector('h3 a')?.focus({preventScroll: true});
    }
    byId('round-buttons').innerHTML = rounds.map(value => `<button class="round-button" data-round="${value}" aria-label="${text.round} ${value}">${String(value).padStart(2, '0')}</button>`).join('');
    byId('round-buttons').addEventListener('click', event => {
      const button = event.target.closest('[data-round]'); if (!button) return;
      round = normalizeRound(button.dataset.round, rounds); renderDetail(); save();
    });
    byId('round-detail').addEventListener('click', event => {
      const skip = event.target.closest('[data-skip]'); if (skip) revealPool(skip.dataset.skip);
    });
    byId('overview').addEventListener('click', event => {
      const button = event.target.closest('[data-select-round]'); if (!button) return;
      round = normalizeRound(button.dataset.selectRound, rounds); renderDetail(); save();
      if (button.dataset.pool) revealPool(button.dataset.pool, button.dataset.fate);
      else { byId('round-detail').scrollIntoView(); document.querySelector(`.round-button[data-round="${round}"]`)?.focus({preventScroll: true}); }
    });
    [character, sideJob].forEach(element => element.addEventListener('change', refresh));
    byId('browse-all').addEventListener('click', () => { character.value = '0'; sideJob.value = '0'; refresh(); });
    let saved = {};
    try { saved = JSON.parse(window.localStorage.getItem(storageKey) || '{}') || {}; } catch {}
    const initial = initialState(data, new URLSearchParams(window.location.search), saved);
    character.value = initial.character; sideJob.value = initial.job; round = initial.round;
    refresh();
    return {refresh, renderDetail, renderOverview, getRound: () => round, getLanes: () => lanes};
  }
  const api = {selectableRounds, normalizeRound, eligible, filteredFates, encounterPools, skipPools, earlyLastRound, cutoffFates, skipStyles, initialState, languageUrl, mount};
  global.HundredSchoolsRounds = api;
  if (typeof document !== 'undefined' && document.getElementById('fate-data')) {
    mount(document, global, JSON.parse(document.getElementById('fate-data').textContent));
  }
})(globalThis);
