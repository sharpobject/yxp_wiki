import {TIERS, blank, decode, encode, move} from './tier-list-model.mjs';
const $ = s => document.querySelector(s);
const lang = $('#tier-maker').dataset.language;
const zh = lang === 'zh';
const text = (en, cn) => zh ? cn : en;
const status = message => { $('#tl-status').textContent = message; };
try {
  const response = await fetch(new URL(`data-${lang}.json`, import.meta.url));
  if (!response.ok) throw new Error('catalog unavailable');
  const data = await response.json();
  const fates = new Map(data.fates.map(f => [f.id, f]));
  let {state, repaired} = decode(location.search, data.characters);
  let selected = null, undo = [], redo = [], drag = null, suppressClick = false;
  const zones = new Map(TIERS.map(t => [t, $(`[data-tier="${t}"]`)]));
  const character = () => data.characters.find(c => c.id === state.character);
  const clone = s => JSON.parse(JSON.stringify(s));
  const card = id => {
    const f = fates.get(id), b = document.createElement('button');
    b.type = 'button'; b.className = 'tl-card'; b.dataset.id = id;
    b.setAttribute('aria-label', f.name); b.setAttribute('aria-pressed', String(selected === id));
    b.title = f.name + '\n' + f.description + '\n' + f.tags.join(' · ');
    const img = new Image(); img.src = f.image; img.alt = ''; img.draggable = false;
    const name = document.createElement('span'); name.textContent = f.name;
    b.append(img, name); return b;
  };
  for (const c of data.characters) {
    let group = [...$('#tl-character').children].find(g => g.label === c.sect);
    if (!group) {group = document.createElement('optgroup'); group.label = c.sect; $('#tl-character').append(group);}
    group.append(new Option(c.name, String(c.id)));
  }
  function syncUrl() {
    const query = encode(state);
    history.replaceState(null, '', location.pathname + query);
    document.title = (state.title || character().name + ' — ' + text('Heavenly Derivation tier list', '天衍万象仙命梯度榜')) + ' — Yi Xian Wiki';
    const languageLink = document.querySelector('a.lang');
    if (languageLink) {const u = new URL(languageLink.href); u.search = query; languageLink.href = u.href;}
    $('#tl-share-url').value = location.href;
  }
  function render() {
    $('#tl-character').value = state.character;
    $('#tl-title').value = state.title;
    $('#tl-view-title').textContent = state.title; $('#tl-view-title').hidden = !state.title;
    const query = $('#tl-search').value.toLocaleLowerCase().trim();
    let visible = 0;
    for (const t of TIERS) {
      const fragment = document.createDocumentFragment();
      for (const id of state.rows[t]) {
        const f = fates.get(id);
        if (t === 'pool' && query && ![f.name, f.description, ...f.tags].join(' ').toLocaleLowerCase().includes(query)) continue;
        fragment.append(card(id)); if (t === 'pool') visible++;
      }
      zones.get(t).replaceChildren(fragment);
    }
    $('#tl-pool-count').textContent = `(${visible}${query ? '/' + state.rows.pool.length : ''})`;
    $('#tl-progress').textContent = `${character().fates.length - state.rows.pool.length} / ${character().fates.length} ` + text('ranked', '已排名');
    $('#tl-empty').hidden = visible > 0;
    $('#tl-empty').textContent = state.rows.pool.length ? text('No matching fates. Try another search.', '未找到匹配仙命，请换个关键词。') : text('All fates ranked. Drag one back here to unrank it.', '全部已排名，可拖回此处取消排名。');
    $('#tl-undo').disabled = !undo.length; $('#tl-redo').disabled = !redo.length;
    showSelection(); syncUrl();
  }
  function showSelection() {
    const panel = $('#tl-detail'), controls = $('#tl-move');
    panel.replaceChildren(); controls.replaceChildren();
    panel.hidden = controls.hidden = selected == null;
    for (const b of document.querySelectorAll('.tl-card')) b.setAttribute('aria-pressed', String(Number(b.dataset.id) === selected));
    if (selected == null) return;
    const f = fates.get(selected), img = new Image(); img.src = f.image; img.alt = '';
    const copy = document.createElement('div'), h = document.createElement('h2'), p = document.createElement('p'), tags = document.createElement('div'), link = document.createElement('a');
    h.textContent = f.name; p.textContent = f.description; tags.className = 'tl-count'; tags.textContent = f.tags.join(' · ');
    link.href = `heavenly-derivation.html#fate-strategy-${selected}`; link.target = '_blank'; link.rel = 'noopener'; link.textContent = text('Fate details ↗', '仙命详情 ↗');
    copy.append(h, tags, p, link); panel.append(img, copy);
    const label = document.createElement('span'); label.textContent = f.name; controls.append(label);
    for (const t of TIERS) {
      const b = document.createElement('button'); b.className = 'tl-button'; b.dataset.move = t; b.textContent = t === 'pool' ? text('Unrank', '取消排名') : t; controls.append(b);
    }
    const close = document.createElement('button'); close.className = 'tl-button'; close.textContent = '×'; close.setAttribute('aria-label', text('Close selection', '关闭选择')); close.onclick = () => {selected = null; showSelection();}; controls.append(close);
  }
  function commit(next, message = '') {
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    undo.push(clone(state)); if (undo.length > 100) undo.shift(); redo = []; state = next;
    render(); status(message);
  }
  function place(id, tier, before = null) {
    commit(move(state, id, tier, before), fates.get(id).name + ' → ' + (tier === 'pool' ? text('Unranked', '未排名') : tier));
  }
  $('#tier-maker').addEventListener('click', e => {
    if (suppressClick) {suppressClick = false; return;}
    const b = e.target.closest('.tl-card');
    if (b) {selected = Number(b.dataset.id); showSelection(); return;}
    const moveButton = e.target.closest('[data-move]');
    if (moveButton) {
      if (selected != null) place(selected, moveButton.dataset.move);
      else status(text('Select a fate first, or drag one into the tier.', '请先选择仙命，或将仙命拖入此梯度。'));
    }
  });
  $('#tl-title').addEventListener('input', () => {
    state = {...state, title: $('#tl-title').value};
    $('#tl-view-title').textContent = state.title; $('#tl-view-title').hidden = !state.title; syncUrl();
  });
  $('#tl-character').addEventListener('change', () => {
    const next = data.characters.find(c => c.id === Number($('#tl-character').value));
    if (state.rows.pool.length < character().fates.length && !confirm(text('Switch character and start a new ranking? You can Undo this change.', '切换角色并重新排名？此操作可撤销。'))) {$('#tl-character').value = state.character; return;}
    selected = null; $('#tl-search').value = ''; commit(blank(next.id, next.fates, state.title));
  });
  $('#tl-search').addEventListener('input', render);
  $('#tl-reset').onclick = () => {
    if (state.rows.pool.length === character().fates.length || confirm(text('Return every fate to Unranked? You can Undo this.', '将所有仙命移回未排名？此操作可撤销。'))) {selected = null; commit(blank(state.character, character().fates, state.title));}
  };
  $('#tl-undo').onclick = () => {if (undo.length) {redo.push(clone(state)); state = undo.pop(); selected = null; render(); status(text('Undone.', '已撤销。'));}};
  $('#tl-redo').onclick = () => {if (redo.length) {undo.push(clone(state)); state = redo.pop(); selected = null; render(); status(text('Redone.', '已重做。'));}};
  $('#tl-share').onclick = async () => {
    syncUrl();
    try {await navigator.clipboard.writeText(location.href); status(text('Link copied — includes your title, character and every fate’s position.', '链接已复制，包含标题、角色及全部仙命的位置。'));}
    catch {$('#tl-share-url').hidden = false; $('#tl-share-url').focus(); $('#tl-share-url').select(); status(text('Copy the selected link below.', '请复制下方已选中的链接。'));}
  };
  window.addEventListener('popstate', () => {({state} = decode(location.search, data.characters)); undo = []; redo = []; selected = null; render();});
  $('#tier-maker').addEventListener('keydown', e => {
    if (e.key === 'Escape') {cancelDrag(); selected = null; showSelection(); return;}
    const b = e.target.closest('.tl-card'); if (!b || !e.altKey || !e.key.startsWith('Arrow')) return;
    e.preventDefault(); const id = Number(b.dataset.id), tier = TIERS.find(t => state.rows[t].includes(id)), index = state.rows[tier].indexOf(id);
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const next = TIERS[Math.max(0, Math.min(5, TIERS.indexOf(tier) + (e.key === 'ArrowUp' ? -1 : 1)))]; place(id, next);
    } else if (e.key === 'ArrowLeft' && index > 0) place(id, tier, state.rows[tier][index - 1]);
    else if (e.key === 'ArrowRight' && index < state.rows[tier].length - 1) place(id, tier, state.rows[tier][index + 2] ?? null);
    $(`.tl-card[data-id="${id}"]`)?.focus();
  });
  function clearTarget() {
    document.querySelectorAll('.before,.over').forEach(el => el.classList.remove('before', 'over'));
  }
  function targetAt(x, y) {
    clearTarget(); const element = document.elementFromPoint(x, y);
    const zone = element?.closest('[data-tier]') || (element?.closest('[data-move]') ? zones.get(element.closest('[data-move]').dataset.move) : null);
    if (!zone) return null;
    zone.classList.add('over');
    const cards = [...zone.querySelectorAll('.tl-card')].filter(b => Number(b.dataset.id) !== drag.id);
    // Reading-order insertion handles wrapped rows and their inter-row gaps.
    const before = cards.find(b => {const r = b.getBoundingClientRect(); return y < r.top || (y <= r.bottom && x < r.left + r.width / 2);});
    before?.classList.add('before');
    return {tier: zone.dataset.tier, before: before ? Number(before.dataset.id) : null};
  }
  function cancelDrag() {
    if (!drag) return; cancelAnimationFrame(drag.frame); drag.ghost?.remove(); drag.button.classList.remove('dragging'); clearTarget(); drag = null;
  }
  function animate() {
    if (!drag?.active) return;
    const x = drag.x, y = drag.y, tray = zones.get('pool'), r = tray.getBoundingClientRect();
    if (x > r.left && x < r.right && y > r.top && y < r.bottom && tray.scrollHeight > tray.clientHeight) {
      if (y < r.top + 35) tray.scrollTop -= 12; else if (y > r.bottom - 35) tray.scrollTop += 12;
    }
    if (y < 80) window.scrollBy(0, -12); else if (y > innerHeight - 65) window.scrollBy(0, 12);
    drag.target = targetAt(x, y); drag.frame = requestAnimationFrame(animate);
  }
  $('#tier-maker').addEventListener('pointerdown', e => {
    const b = e.target.closest('.tl-card'); if (!b || e.button !== 0) return;
    drag = {id: Number(b.dataset.id), button: b, pointer: e.pointerId, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, active: false};
    b.setPointerCapture(e.pointerId);
  });
  window.addEventListener('pointermove', e => {
    if (!drag || drag.pointer !== e.pointerId) return;
    drag.x = e.clientX; drag.y = e.clientY;
    if (!drag.active && Math.hypot(drag.x-drag.startX, drag.y-drag.startY) < 6) return;
    e.preventDefault();
    if (!drag.active) {
      drag.active = true; drag.ghost = drag.button.cloneNode(true); drag.ghost.classList.add('tl-ghost'); drag.ghost.removeAttribute('data-id'); drag.ghost.setAttribute('aria-hidden', 'true'); document.body.append(drag.ghost); drag.button.classList.add('dragging'); animate();
    }
    drag.ghost.style.left = drag.x + 12 + 'px'; drag.ghost.style.top = drag.y - 30 + 'px';
    drag.target = targetAt(drag.x, drag.y);
  }, {passive:false});
  window.addEventListener('pointerup', e => {
    if (!drag || e.pointerId !== drag.pointer) return;
    const {id, active, target} = drag; cancelDrag();
    if (active) {suppressClick = true; setTimeout(() => {suppressClick = false;}, 0); if (target) place(id, target.tier, target.before);}
  });
  window.addEventListener('pointercancel', cancelDrag); window.addEventListener('blur', cancelDrag);
  render();
  if (repaired) status(text('Some invalid or duplicate entries in this link were skipped. Valid rankings are preserved.', '已忽略链接中无效或重复的条目，保留有效排名。'));
} catch (error) {
  console.error(error); status(text('The fate catalog could not load. Please reload the page.', '仙命数据加载失败，请刷新页面。'));
}
