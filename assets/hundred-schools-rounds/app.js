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
  function normalizedProfile(data, characterValue, jobValue) {
    const characters = data.characters.filter(item => Number(item.id) > 0);
    const character = characters.find(item => String(item.id) === String(characterValue)) ||
      characters.find(item => Number(item.id) === 1000004) || characters[0];
    return {
      character: character ? String(character.id) : '',
      job: data.sideJobs.some(item => String(item.id) === String(jobValue)) ? String(jobValue) : '0',
    };
  }
  function initialState(data, params, saved = {}) {
    const hasProfile = params.has('character') || params.has('side-job');
    return {
      ...normalizedProfile(data, hasProfile ? params.get('character') : saved.character, hasProfile ? params.get('side-job') : saved.job),
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
  function poolMarkup(data, pool, characterId, jobId, selectedRound, maximum, preview = false) {
    const text = words[data.lang] || words.en;
    const eligibleFates = filteredFates(data, pool, characterId, jobId, selectedRound);
    const hasDeadline = fate => earlyLastRound(fate, pool, maximum) != null;
    const fates = [...eligibleFates.filter(fate => !hasDeadline(fate)), ...eligibleFates.filter(hasDeadline)];
    const target = data.pools.find(item => item.id === pool.skipTarget);
    const link = id => escapeHTML(data.sourceUrl + '#' + encodeURIComponent(id));
    const items = fates.map(fate => {
      const conditions = fate.conditions || [];
      const condition = conditions.length ? `<span class="condition-mark" aria-label="${escapeHTML(text.additional + ': ' + conditions.join('; '))}">◇</span>` : '';
      const last = earlyLastRound(fate, pool, maximum);
      const deadline = last == null ? '' : `<span class="fate-deadline${selectedRound === last ? ' last-now' : ''}">${text.lastOffer}: R${last}</span>`;
      return `<li><a class="fate" data-fate="${escapeHTML(fate.id)}" href="${link(fate.id)}" title="${escapeHTML(fate.name + (conditions.length ? ' — ' + conditions.join('; ') : ''))}"><span class="fate-icon">${fate.artworkHtml || ''}</span><span>${escapeHTML(fate.name)}${condition}${deadline}</span></a></li>`;
    }).join('');
    return `<article class="pool-card" id="${preview ? 'preview-' : ''}${escapeHTML(pool.id)}"><div class="pool-head"><h3><a href="${link(pool.id)}">${escapeHTML(pool.name)}</a></h3><span class="pool-total" title="${text.potential}">${fates.length}</span><p class="pool-theme">${escapeHTML(pool.theme)}</p></div><ul class="fate-list">${items}</ul>${target ? `<button type="button" class="pool-skip" data-skip="${escapeHTML(target.id)}">${text.skip} → ${escapeHTML(target.name)} <span aria-hidden="true">↗</span></button>` : ''}</article>`;
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
    const overview = byId('overview'), preview = byId('pool-preview'), previewContent = byId('pool-preview-content');
    const storageKey = 'hundred-schools-rounds-v1';
    let round = rounds[0] ?? 1;
    let previewState = null, closeTimer = null, ignoredFocusTrigger = null;

    const fatesFor = (pool, selectedRound = round) => filteredFates(data, pool, +character.value, +sideJob.value, selectedRound);
    const iconHTML = fate => `<span class="fate-icon">${fate.artworkHtml || ''}</span>`;
    const poolHTML = (pool, selectedRound = round, isPreview = false) => poolMarkup(data, pool, +character.value, +sideJob.value, selectedRound, maximum, isPreview);
    const previewAttributes = pool => pool.special ? ' aria-controls="skip-pools"' : ' aria-haspopup="dialog" aria-controls="pool-preview" aria-expanded="false"';
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
      byId('skip-pools').innerHTML = special.map(pool => poolHTML(pool)).join('');
      byId('skip-round').textContent = text.round + ' ' + String(round).padStart(2, '0');
      if (byId('skip-section')) byId('skip-section').hidden = !special.length;
      document.querySelectorAll('.round-button').forEach(button => button.setAttribute('aria-current', String(+button.dataset.round === round)));
      document.querySelectorAll('.overview-row').forEach(row => row.classList.toggle('current', +row.dataset.round === round));
    }
    function renderOverview() {
      const headings = lanes.map((_, index) => `<th scope="col" class="lane-heading"><span class="sr-only">${text.lane} ${index + 1}</span></th>`).join('');
      const rows = rounds.map(selectedRound => {
        const cells = lanes.map((lane, laneIndex) => {
          const pool = lane.find(pool => selectedRound >= pool.minRound && selectedRound <= pool.maxRound);
          const available = pool ? fatesFor(pool, selectedRound) : [];
          if (!available.length) return `<td class="lane-cell"><span class="matrix-empty" aria-label="${text.noPool}">—</span></td>`;
          const first = rounds.find(value => value >= pool.minRound && value <= pool.maxRound) === selectedRound;
          const last = rounds.filter(value => value >= pool.minRound && value <= pool.maxRound).at(-1) === selectedRound;
          const endings = available.filter(fate => earlyLastRound(fate, pool, maximum) === selectedRound);
          const regular = available.find(fate => (fate.minRound ?? pool.minRound) <= pool.minRound &&
            (fate.maxRound ?? pool.maxRound) >= pool.maxRound);
          const fate = endings[0] || regular || available.find(fate => earlyLastRound(fate, pool, maximum) == null) || available[0];
          const label = `${text.round} ${selectedRound} · ${pool.name} · ${pool.theme} · ${text.example}: ${fate.name}${skipLabel(pool)}${endings.length ? ' · ' + text.lastOffer + ': ' + endings.map(item => item.name).join(', ') : ''}`;
          const marker = endings.length ? `<span class="last-offer-label">${text.last}${endings.length > 1 ? ' ×' + endings.length : ''}</span>` : '';
          return `<td class="lane-cell active${styleClass(pool)}${first ? ' pool-start' : ''}${last ? ' pool-end' : ''}"${styleData(pool)}><button type="button" class="matrix-pool${endings.length ? ' has-cutoff' : ''}" data-pool="${escapeHTML(pool.id)}" data-lane="${laneIndex}" data-select-round="${selectedRound}" data-fate="${escapeHTML(fate.id)}" data-skip-target="${escapeHTML(pool.skipTarget || '')}"${previewAttributes(pool)} aria-label="${escapeHTML(label)}">${iconHTML(fate)}${marker}</button></td>`;
        }).join('');
        return `<tr class="overview-row" data-round="${selectedRound}"><th scope="row"><button class="overview-round" data-select-round="${selectedRound}" aria-label="${text.showRound} ${selectedRound}">${String(selectedRound).padStart(2, '0')}</button></th>${cells}</tr>`;
      }).join('');
      byId('overview-rows').innerHTML = `<table class="availability-matrix"><caption class="sr-only">${text.caption}</caption><colgroup><col class="round-column">${lanes.map(() => '<col>').join('')}</colgroup><thead><tr><th scope="col" class="matrix-corner">${text.round}</th>${headings}</tr></thead><tbody>${rows}</tbody></table>`;
      const opening = openingPools.filter(pool => fatesFor(pool, 1).length);
      if (byId('round-one-section')) byId('round-one-section').hidden = !opening.length;
      byId('round-one-pools').innerHTML = opening.map(pool => {
        const fate = fatesFor(pool, 1)[0];
        const label = `${text.opening} · ${pool.name} · ${pool.theme} · ${text.example}: ${fate.name}${skipLabel(pool)}`;
        return `<button type="button" class="opening-pool${styleClass(pool)}"${styleData(pool)} data-pool="${escapeHTML(pool.id)}" data-select-round="1" data-fate="${escapeHTML(fate.id)}" data-skip-target="${escapeHTML(pool.skipTarget || '')}"${previewAttributes(pool)} aria-label="${escapeHTML(label)}"><span class="opening-label"><strong>${escapeHTML(pool.name)}</strong><small>${escapeHTML(pool.theme)}</small></span>${iconHTML(fate)}</button>`;
      }).join('');
      const cutoffs = cutoffFates(data, +character.value, +sideJob.value, rounds);
      byId('fate-cutoffs').hidden = !cutoffs.length;
      byId('cutoff-list').innerHTML = cutoffs.map(({pool, fate, last}) => `<button type="button" class="cutoff-item" data-pool="${escapeHTML(pool.id)}" data-select-round="${last}" data-fate="${escapeHTML(fate.id)}"${previewAttributes(pool)} aria-label="${escapeHTML(`${text.round} ${last} · ${pool.name} · ${fate.name}`)}">${iconHTML(fate)}<span><strong>${escapeHTML(fate.name)}</strong><small>${escapeHTML(pool.name)}</small></span><span class="cutoff-round">${text.last}<br><b>R${last}</b></span></button>`).join('');
    }
    function refresh() {
      closePreview();
      const profile = normalizedProfile(data, character.value, sideJob.value);
      character.value = profile.character; sideJob.value = profile.job;
      byId('results').hidden = false;
      renderOverview(); renderDetail(); save();
    }
    function revealSuanni(id, fateId) {
      if (!poolsById.get(id)?.special) return;
      const card = byId(id); if (!card) return;
      document.querySelectorAll('.highlight').forEach(element => element.classList.remove('highlight'));
      card.classList.add('highlight'); card.scrollIntoView({block: 'start'});
      const fate = fateId ? [...card.querySelectorAll('.fate')].find(element => element.dataset.fate === fateId) : null;
      if (fate) { fate.classList.add('deadline-focus'); fate.scrollIntoView({block: 'nearest'}); fate.focus({preventScroll: true}); }
      else card.querySelector('h3 a')?.focus({preventScroll: true});
    }
    function cancelClose() {
      if (closeTimer !== null) window.clearTimeout(closeTimer);
      closeTimer = null;
    }
    function clearPreviewState() {
      cancelClose();
      if (previewState) {
        ignoredFocusTrigger = previewState.trigger;
        previewState.trigger.setAttribute('aria-expanded', 'false');
      }
      previewState = null;
    }
    function closePreview(restoreFocus = false) {
      const trigger = previewState?.trigger;
      clearPreviewState();
      if (preview.matches(':popover-open')) preview.hidePopover();
      if (restoreFocus && trigger) trigger.focus({preventScroll: true});
    }
    function scheduleClose() {
      cancelClose();
      closeTimer = window.setTimeout(() => {
        closeTimer = null;
        if (!previewState || previewState.pinned || preview.matches(':hover') || previewState.trigger.matches(':hover') ||
            preview.contains(document.activeElement) || document.activeElement === previewState.trigger) return;
        closePreview();
      }, 180);
    }
    function positionPreview() {
      if (!previewState || !preview.matches(':popover-open')) return;
      const anchor = previewState.trigger.getBoundingClientRect(), box = preview.getBoundingClientRect();
      const gap = 6, margin = 12, width = window.innerWidth, height = window.innerHeight;
      let left, top;
      if (anchor.right + gap + box.width <= width - margin) {
        left = anchor.right + gap; top = anchor.top;
      } else if (anchor.left - gap - box.width >= margin) {
        left = anchor.left - gap - box.width; top = anchor.top;
      } else {
        left = anchor.left;
        top = anchor.bottom + gap + box.height <= height - margin ? anchor.bottom + gap : anchor.top - gap - box.height;
      }
      preview.style.left = Math.max(margin, Math.min(left, width - box.width - margin)) + 'px';
      preview.style.top = Math.max(margin, Math.min(top, height - box.height - margin)) + 'px';
    }
    function showPreview(trigger, pinned = false) {
      const pool = poolsById.get(trigger.dataset.pool);
      if (!pool || pool.special || (previewState?.pinned && !pinned && previewState.trigger !== trigger)) return;
      cancelClose();
      if (previewState?.trigger === trigger) {
        previewState.pinned ||= pinned;
        return;
      }
      if (previewState) previewState.trigger.setAttribute('aria-expanded', 'false');
      const selectedRound = normalizeRound(trigger.dataset.selectRound, rounds);
      previewState = {trigger, pool, round: selectedRound, pinned};
      byId('pool-preview-title').textContent = `${text.round} ${selectedRound} · ${pool.name}`;
      previewContent.innerHTML = poolHTML(pool, selectedRound, true);
      preview.scrollTop = 0;
      trigger.setAttribute('aria-expanded', 'true');
      if (!preview.matches(':popover-open')) preview.showPopover();
      positionPreview();
    }
    function selectRound(value) {
      closePreview();
      round = normalizeRound(value, rounds); renderDetail(); save();
    }
    const triggerFor = target => target?.closest?.('button[data-pool][data-select-round]');
    overview.addEventListener('pointerout', event => {
      const trigger = triggerFor(event.target);
      if (trigger && !trigger.contains(event.relatedTarget) && !preview.contains(event.relatedTarget)) scheduleClose();
    });
    overview.addEventListener('focusin', event => {
      const trigger = triggerFor(event.target);
      if (trigger && trigger !== ignoredFocusTrigger) showPreview(trigger);
    });
    document.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch' || !(event.movementX || event.movementY)) return;
      ignoredFocusTrigger = null;
      const trigger = triggerFor(event.target);
      if (trigger && overview.contains(trigger)) showPreview(trigger);
    });
    overview.addEventListener('focusout', event => {
      const trigger = triggerFor(event.target);
      if (trigger && trigger === ignoredFocusTrigger && !trigger.contains(event.relatedTarget)) ignoredFocusTrigger = null;
      if (!preview.contains(event.relatedTarget)) scheduleClose();
    });
    overview.addEventListener('keydown', event => {
      if (event.key !== 'Tab' || event.shiftKey || !previewState || triggerFor(event.target) !== previewState.trigger) return;
      event.preventDefault();
      previewState.pinned = true;
      (previewContent.querySelector('a[href]') || byId('close-pool-preview')).focus({preventScroll: true});
    });
    preview.addEventListener('pointerenter', cancelClose);
    preview.addEventListener('pointerleave', scheduleClose);
    preview.addEventListener('focusin', cancelClose);
    preview.addEventListener('focusout', event => {
      if (!preview.contains(event.relatedTarget)) scheduleClose();
    });
    preview.addEventListener('beforetoggle', event => {
      if (event.newState === 'closed') clearPreviewState();
    });
    preview.addEventListener('click', event => {
      const skip = event.target.closest('[data-skip]');
      if (!skip || !previewState) return;
      const selectedRound = previewState.round;
      selectRound(selectedRound); revealSuanni(skip.dataset.skip);
    });
    byId('close-pool-preview').addEventListener('click', () => closePreview(true));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && previewState) { event.preventDefault(); closePreview(true); }
    }, true);
    window.addEventListener('resize', () => closePreview());
    document.addEventListener('scroll', event => {
      if (!previewState || preview.contains(event.target)) return;
      const trigger = previewState.trigger, anchor = trigger.getBoundingClientRect();
      const scroller = trigger.closest('.matrix-scroll');
      const clip = scroller?.getBoundingClientRect();
      const left = Math.max(0, clip?.left ?? 0), top = Math.max(0, clip?.top ?? 0);
      const right = Math.min(window.innerWidth, clip?.right ?? window.innerWidth);
      const bottom = Math.min(window.innerHeight, clip?.bottom ?? window.innerHeight);
      if (anchor.right <= left || anchor.left >= right || anchor.bottom <= top || anchor.top >= bottom) closePreview();
      else positionPreview();
    }, true);
    byId('round-buttons').innerHTML = rounds.map(value => `<button class="round-button" data-round="${value}" aria-label="${text.round} ${value}">${String(value).padStart(2, '0')}</button>`).join('');
    byId('round-buttons').addEventListener('click', event => {
      const button = event.target.closest('[data-round]'); if (!button) return;
      selectRound(button.dataset.round);
    });
    overview.addEventListener('click', event => {
      const button = event.target.closest('[data-select-round]'); if (!button) return;
      selectRound(button.dataset.selectRound);
      if (button.dataset.pool) {
        if (poolsById.get(button.dataset.pool)?.special) revealSuanni(button.dataset.pool, button.dataset.fate);
        else showPreview(button, true);
      }
      else { byId('round-detail').scrollIntoView(); document.querySelector(`.round-button[data-round="${round}"]`)?.focus({preventScroll: true}); }
    });
    [character, sideJob].forEach(element => element.addEventListener('change', refresh));
    let saved = {};
    try { saved = JSON.parse(window.localStorage.getItem(storageKey) || '{}') || {}; } catch {}
    const initial = initialState(data, new URLSearchParams(window.location.search), saved);
    character.value = initial.character; sideJob.value = initial.job; round = initial.round;
    refresh();
    return {refresh, renderDetail, renderOverview, getRound: () => round, getLanes: () => lanes};
  }
  const api = {selectableRounds, normalizeRound, eligible, filteredFates, encounterPools, skipPools, earlyLastRound, cutoffFates, skipStyles, initialState, languageUrl, poolMarkup, mount};
  global.HundredSchoolsRounds = api;
  if (typeof document !== 'undefined' && document.getElementById('fate-data')) {
    mount(document, global, JSON.parse(document.getElementById('fate-data').textContent));
  }
})(globalThis);
