(() => {
  const $ = (selector) => document.querySelector(selector);
  const catalog = window.RECORDING_CATALOG ?? [];
  const select = $("#recording-select");
  const timeline = $("#timeline");
  const previous = $("#previous");
  const next = $("#next");
  const roundSelect = $("#round-select");
  const assetMode = document.body.dataset.assetMode || "wiki";
  const recordingBase = document.body.dataset.recordingBase || "data";
  const vocabulary = {
    phases: {
      1: ["Meditation", "炼气"], 2: ["Foundation", "筑基"], 3: ["Virtuoso", "金丹"],
      4: ["Immortality", "元婴"], 5: ["Incarnation", "化神"], 6: ["Void Return", "返虚"],
    },
    sects: {
      1: ["Cloud Spirit Sword Sect", "云灵剑宗"], 2: ["Heptastar Pavilion", "七星阁"],
      3: ["Five Elements Alliance", "五行道盟"], 4: ["Duan Xuan Sect", "锻玄宗"],
    },
    careers: {
      0: ["No Side Job", "无副职业"], 1: ["Elixirist", "炼丹师"], 2: ["Fuluist", "符咒师"],
      3: ["Musician", "琴师"], 4: ["Painter", "画师"], 5: ["Formation Master", "阵法师"],
      6: ["Plant Master", "灵植师"], 7: ["Fortune Teller", "命理师"],
    },
  };
  let recording = null;
  let states = [];
  let index = 0;
  let selectedUid = "";

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
  const cardAsset = (id) => assetMode === "local" ? `card-images/${id}_en.png` : `/yxp_wiki/assets/cards/${id}_en.png`;
  const characterAsset = (id, kind) => assetMode === "local" ? `character-images/${id}-${kind}.png` : `/yxp_wiki/assets/characters/${id}-${kind}.png`;
  const fateAsset = (entry, kind) => {
    if (assetMode === "local") return `fate-icons/${kind === "talent" ? `Icon_Talent_${entry.iconId || entry.id}.png` : entry.iconFile || `Icon_FateStrategy_${entry.id}.png`}`;
    return `/yxp_wiki/assets/fates/${kind === "talent" ? `Icon_Talent_${entry.iconId || entry.id}.png` : entry.iconFile || `Icon_FateStrategy_${entry.id}.png`}`;
  };
  const numericPrefix = (value) => Number.parseInt(String(value ?? "0"), 10) || 0;
  const bilingual = (pair, fallback = "") => pair ? `${pair[0]} / ${pair[1]}` : fallback;
  const phaseName = (value) => bilingual(vocabulary.phases[numericPrefix(value)], String(value ?? "Unknown phase"));
  const sectName = (value) => bilingual(vocabulary.sects[numericPrefix(value)], String(value ?? ""));
  const careerName = (value) => bilingual(vocabulary.careers[numericPrefix(value)], String(value ?? ""));
  const characterName = (player) => {
    const info = recording.catalog.characters[player?.characterId];
    if (!info) return player?.character || "Unknown character";
    return `${info.nameEnglish}${info.nameChinese && info.nameChinese !== info.nameEnglish ? ` / ${info.nameChinese}` : ""}`;
  };

  function mergePatch(target, patch) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) return structuredClone(patch);
    const result = target && typeof target === "object" && !Array.isArray(target) ? structuredClone(target) : {};
    for (const [key, value] of Object.entries(patch)) {
      if (value && typeof value === "object" && value.$deleted === true) delete result[key];
      else result[key] = mergePatch(result[key], value);
    }
    return result;
  }

  function hydrateStates(data) {
    const result = [];
    let state = {};
    for (const step of data.steps) {
      state = mergePatch(state, step.patch);
      result.push(state);
    }
    return result;
  }

  function card(id) {
    if (!id) return '<div class="empty-slot" title="Empty deck slot"></div>';
    const info = recording.catalog.cards[id] ?? { id, nameEnglish: `Card ${id}`, upgrade: 1 };
    return `<div class="game-card" title="${esc(info.nameEnglish)}${info.nameChinese ? ` / ${esc(info.nameChinese)}` : ""}">
      <span class="card-fallback"><strong>${esc(info.nameEnglish)}</strong><small>${esc(info.nameChinese || `ID ${id}`)}</small></span>
      <img data-asset-fallback src="${cardAsset(id)}" alt="${esc(info.nameEnglish)}"><span class="card-level">Lv.${esc(info.upgrade)}</span>
    </div>`;
  }

  function trait(reference, kind) {
    const info = kind === "talent" ? recording.catalog.talents[reference.id] : recording.catalog.fateStrategies[reference.id];
    if (!info) return "";
    const runtime = reference.runtime;
    const badge = runtime ? `<span class="trait-count">${runtime.kind === "cooldown" ? "CD " : ""}${esc(runtime.value)}</span>` : "";
    const description = info.descriptionEnglish ? ` — ${info.descriptionEnglish}` : "";
    return `<div class="trait-icon ${kind === "talent" ? "talent" : "heavenly-fate"}${reference.locked ? " locked" : ""}" data-tooltip="${esc(`${info.nameEnglish}${description}`)}"><img data-asset-fallback src="${fateAsset(info, kind)}" alt="${esc(info.nameEnglish)}">${badge}</div>`;
  }

  function playerPortrait(player, state) {
    const own = state.players[state.targetUid];
    const upcoming = own?.nextOpponent === player.uid;
    return `<button class="player-portrait ${selectedUid === player.uid ? "selected" : ""} ${player.settled ? "settled" : ""}" data-uid="${esc(player.uid)}" title="Inspect ${esc(player.username)}'s previous-round state">
      <span class="avatar-wrap"><img class="avatar" src="${characterAsset(player.characterId, "avatar")}" alt=""><span class="life-gem"><span>${esc(player.life)}</span></span>${upcoming ? '<span class="opponent-badge" title="Upcoming opponent">⚔</span>' : ""}</span>
      <span class="name">${esc(player.username)}</span><span class="character-name">${esc(characterName(player))}</span>
    </button>`;
  }

  function renderCharacter(player, traits, state, priorRound) {
    const privatePlayer = state.privatePlayer;
    const exchangeText = player.uid === state.targetUid ? ` · ${privatePlayer?.exchangesRemaining ?? "—"} exchanges` : "";
    const talents = (traits.talents ?? []).map((value) => trait(value, "talent")).join("");
    const fates = (traits.fates ?? []).map((value) => trait(value, "fateStrategy")).join("");
    $("#character-panel").innerHTML = `<div class="trait-panel">
        <div class="trait-group"><span class="trait-heading">Immortal Fates / 仙命</span><div class="trait-row">${talents || '<span class="trait-empty">None visible</span>'}</div></div>
        <div class="trait-group"><span class="trait-heading">Heavenly Derivation / 天衍仙命</span><div class="trait-row">${fates || '<span class="trait-empty">None visible</span>'}</div></div>
      </div>
      <img class="character-art" src="${characterAsset(player.characterId, "portrait")}" alt="${esc(characterName(player))}">
      <div class="character-stats"><strong>${esc(player.username)}</strong><span>${esc(characterName(player))}</span><span>${esc(phaseName(priorRound?.phase ?? player.phase))}</span><span>${esc(sectName(player.sect))}${numericPrefix(player.career) ? ` · ${esc(careerName(player.career))}` : ""}</span><span>${esc(priorRound?.cultivation ?? player.cultivation)} Cultivation / 修为 · ${esc(player.life)} Destiny / 命元${exchangeText ? ` · ${esc(privatePlayer?.exchangesRemaining ?? "—")} Exchange Chance / 换牌机会` : ""}</span></div>`;
  }

  function renderChoice(overlay) {
    const host = $("#selection-overlay");
    if (!overlay) { host.hidden = true; host.innerHTML = ""; return; }
    const canReroll = overlay.kind === "heavenly-derivation" && overlay.rerollsRemaining > 0;
    const options = overlay.options.map((reference, optionIndex) => {
      if (overlay.kind === "daoist-rhyme") {
        const info = recording.catalog.cards[reference.id] ?? {};
        return `<article class="selection-option card-choice"><div class="selection-icon"><img data-asset-fallback src="${cardAsset(reference.id)}" alt=""></div><strong>${esc(info.nameEnglish || reference.id)}</strong><span class="selection-cn">${esc(info.nameChinese || "")}</span></article>`;
      }
      const kind = overlay.kind === "immortal-fate" ? "talent" : "fateStrategy";
      const info = kind === "talent" ? recording.catalog.talents[reference.id] : recording.catalog.fateStrategies[reference.id];
      return `<article class="selection-option"><div class="selection-icon"><img data-asset-fallback src="${fateAsset(info, kind)}" alt=""></div>${canReroll ? `<span class="reroll-slot" title="This slot can be refreshed">↻ <small>${optionIndex + 1}</small></span>` : ""}<strong>${esc(info?.nameEnglish || reference.id)}</strong><span class="selection-cn">${esc(info?.nameChinese || "")}</span><p>${esc(info?.descriptionEnglish || "")}</p></article>`;
    }).join("");
    const bilingualTitle = overlay.kind === "heavenly-derivation"
      ? "Select a Heavenly Derivation Fate / 选择天衍仙命"
      : overlay.kind === "immortal-fate"
        ? "Select an Immortal Fate / 选择仙命"
        : "Select a Daoist Rhyme Omen / 选择道韵预感";
    const roundOrPhase = overlay.kind === "heavenly-derivation" || overlay.kind === "daoist-rhyme"
      ? `Round ${esc(overlay.roundOrPhase)}`
      : `${esc(phaseName(overlay.roundOrPhase))}`;
    host.dataset.kind = overlay.kind;
    host.innerHTML = `<div class="selection-frame" style="--choice-count:${overlay.options.length}">
      <div class="selection-heading"><span class="selection-context">${roundOrPhase}</span><h2>${esc(bilingualTitle)}</h2><span class="selection-hide">◒ Hide</span></div>
      <div class="selection-options">${options}</div>
      <div class="selection-actions">${overlay.kind === "heavenly-derivation" ? `<span class="reroll-bank">↻ ${esc(overlay.rerollsRemaining)} rerolls remaining / 剩余刷新 ${esc(overlay.rerollsRemaining)} 次</span>` : ""}<span class="selection-confirm">Confirm / 确认</span><span class="recording-pending">Recorded choice pending / 等待记录中的选择</span></div>
    </div>`;
    host.hidden = false;
  }

  function recentActions() {
    const actions = [];
    for (let cursor = index; cursor >= 0 && actions.length < 5; cursor -= 1) {
      for (const action of [...(recording.steps[cursor].humanActions ?? [])].reverse()) {
        actions.push({ ...action, current: cursor === index });
        if (actions.length === 5) break;
      }
    }
    return actions.reverse();
  }

  function renderActions() {
    const actions = recentActions();
    $("#action-list").innerHTML = actions.length
      ? actions.map((action) => `<li class="${action.current ? "current" : ""}"><span class="action-kind">${esc(action.kind)}</span>${esc(action.text)}</li>`).join("")
      : '<li class="empty">No player action has occurred yet.</li>';
  }

  function render() {
    const state = states[index];
    if (!state) return;
    const players = Object.values(state.players ?? {});
    if (!selectedUid || !state.players[selectedUid]) selectedUid = state.targetUid || players[0]?.uid || "";
    const selected = state.players[selectedUid] ?? players[0];
    const isOwn = selected?.uid === state.targetUid;
    const prior = isOwn ? null : selected?.lastRound;
    const deck = isOwn ? state.privatePlayer?.deck ?? [] : prior?.deck ?? [];
    const hand = isOwn ? state.privatePlayer?.hand ?? [] : null;
    const traits = isOwn
      ? { talents: selected?.talents, fates: state.privatePlayer?.selectedFateStrategies }
      : { talents: prior?.talents, fates: prior?.fateStrategies };

    $(".game-stage").dataset.viewMode = isOwn ? "private" : "prior-round";

    $("#player-roster").innerHTML = players.map((player) => playerPortrait(player, state)).join("");
    $("#round-marker").textContent = `Round ${state.round || "—"}`;
    $("#view-caption").textContent = isOwn
      ? `Current private view · ${selected?.username || recording.targetUsername}`
      : `${selected?.username} · previous-round public state`;
    $("#deck-label").textContent = isOwn ? `Deck / 牌组 · ${deck.length} slots` : `Previous-round deck / 上回合牌组 · ${deck.length} slots`;
    $("#deck").innerHTML = deck.map(card).join("") || '<span class="private-hand">No deck was visible.</span>';
    $("#hand-label").textContent = isOwn ? `Hand / 手牌 · ${hand?.length ?? 0}` : "Hand / 手牌";
    $("#hand").innerHTML = hand ? hand.map(card).join("") : '<span class="private-hand">Private hand is not visible when browsing another player.</span>';
    renderCharacter(selected, traits, state, prior);
    renderChoice(isOwn ? state.privatePlayer?.choiceOverlay : null);
    renderActions();

    timeline.value = index;
    previous.disabled = index === 0;
    next.disabled = index === recording.steps.length - 1;
    $("#step-label").textContent = `${index + 1} / ${recording.steps.length}`;
    $("#recording-meta").textContent = `Room ${recording.roomId} · ${recording.targetUsername}`;
    document.querySelectorAll(".player-portrait").forEach((button) => button.addEventListener("click", () => { selectedUid = button.dataset.uid; render(); }));
  }

  function setIndex(value) {
    index = Math.max(0, Math.min(recording.steps.length - 1, Number(value)));
    render();
  }

  function installRecording(data) {
    recording = data;
    states = hydrateStates(data);
    index = states.findIndex((state) => state.round > 0);
    if (index < 0) index = 0;
    selectedUid = data.targetUid;
    timeline.max = data.steps.length - 1;
    const firstByRound = new Map();
    states.forEach((state, stateIndex) => { if (state.round && !firstByRound.has(state.round)) firstByRound.set(state.round, stateIndex); });
    roundSelect.innerHTML = '<option value="">Jump to round…</option>' + [...firstByRound].map(([round, stateIndex]) => `<option value="${stateIndex}">Round ${round}</option>`).join("");
    $("#loading").hidden = true;
    $("#viewer").hidden = false;
    render();
  }

  function loadRecording(item) {
    $("#loading").hidden = false;
    $("#viewer").hidden = true;
    window.REPLAY_RECORDING = null;
    const old = document.querySelector("script[data-recording]");
    if (old) old.remove();
    const script = document.createElement("script");
    script.dataset.recording = "";
    script.src = `${recordingBase}/${item.file}`;
    script.onload = () => installRecording(window.REPLAY_RECORDING);
    script.onerror = () => { $("#loading").textContent = `Could not load ${item.file}`; };
    document.body.appendChild(script);
  }

  select.innerHTML = catalog.map((item) => `<option value="${esc(item.id)}">${esc(item.label)}</option>`).join("");
  select.addEventListener("change", () => loadRecording(catalog.find((item) => item.id === select.value)));
  previous.addEventListener("click", () => setIndex(index - 1));
  next.addEventListener("click", () => setIndex(index + 1));
  timeline.addEventListener("input", (event) => setIndex(event.target.value));
  roundSelect.addEventListener("change", (event) => { if (event.target.value !== "") setIndex(event.target.value); });
  addEventListener("keydown", (event) => {
    if (["INPUT", "SELECT"].includes(document.activeElement?.tagName)) return;
    if (event.key === "ArrowLeft") setIndex(index - 1);
    if (event.key === "ArrowRight") setIndex(index + 1);
  });
  addEventListener("error", (event) => {
    if (event.target instanceof HTMLImageElement && event.target.matches("img[data-asset-fallback]")) event.target.hidden = true;
  }, true);
  if (catalog[0]) loadRecording(catalog[0]);
  else $("#loading").textContent = "No complete recordings are available.";
})();
