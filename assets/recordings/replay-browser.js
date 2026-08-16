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
  const recordingVersion = document.body.dataset.recordingVersion || "";
  const isChinese = document.documentElement.lang.toLowerCase().startsWith("zh");
  const language = isChinese ? "zh" : "en";
  const copy = isChinese ? {
    unknownPhase: "未知境界", noSideJob: "无副职业", emptySlot: "空卡位", unknownCard: "未知卡牌",
    inspect: "查看上一轮公开状态", upcomingOpponent: "下一位对手", immortalFates: "仙命",
    heavenlyDerivation: "天衍仙命", noneVisible: "暂无可见信息", cultivation: "修为", destiny: "命元",
    exchangeChance: "换牌机会", currentView: "当前私密视角", previousView: "上一轮公开状态",
    deck: "卡组", previousDeck: "上一轮卡组", hand: "手牌", slots: "格", noDeck: "未记录到可见卡组。",
    hiddenHand: "查看其他玩家时无法看到其手牌。", round: "第", roundSuffix: "轮", hide: "隐藏",
    rerollsRemaining: "次刷新剩余", choicePending: "等待记录中的选择", selectHdf: "选择天衍仙命",
    selectTalent: "选择仙命", selectDaoYun: "选择道韵预感", noActions: "尚无玩家操作。",
    jumpRound: "跳转到轮次…", loading: "正在载入…", couldNotLoad: "无法载入", noRecordings: "没有完整录像。",
    rating: "分", rounds: "轮", recordingRoom: "房间", currentPrivate: "当前私密视角",
    actionKinds: { move: "移动", rearrange: "调整", upgrade: "合成", exchange: "换牌", absorb: "吸收", destiny: "命元", emote: "表情" },
    previousOffer: "此前选项", rerolledAway: "已刷走", finalOffer: "最终选项", offer: "选项", daoYunChoices: "道韵预感", chosen: "已选择",
  } : {
    unknownPhase: "Unknown phase", noSideJob: "No Side Job", emptySlot: "Empty deck slot", unknownCard: "Unknown card",
    inspect: "Inspect previous-round public state", upcomingOpponent: "Upcoming opponent", immortalFates: "Immortal Fates",
    heavenlyDerivation: "Heavenly Derivation", noneVisible: "None visible", cultivation: "Cultivation", destiny: "Destiny",
    exchangeChance: "Exchange Chance", currentView: "Current private view", previousView: "previous-round public state",
    deck: "Deck", previousDeck: "Previous-round deck", hand: "Hand", slots: "slots", noDeck: "No deck was visible.",
    hiddenHand: "Private hand is not visible when browsing another player.", round: "Round ", roundSuffix: "", hide: "Hide",
    rerollsRemaining: "rerolls remaining", choicePending: "Recorded choice pending", selectHdf: "Select a Heavenly Derivation Fate",
    selectTalent: "Select an Immortal Fate", selectDaoYun: "Select a Daoist Rhyme Omen", noActions: "No player action has occurred yet.",
    jumpRound: "Jump to round…", loading: "Loading…", couldNotLoad: "Could not load", noRecordings: "No complete recordings are available.",
    rating: "rating", rounds: "rounds", recordingRoom: "Room", currentPrivate: "Current private view",
    actionKinds: { move: "move", rearrange: "rearrange", upgrade: "upgrade", exchange: "exchange", absorb: "absorb", destiny: "destiny", emote: "emote" },
    previousOffer: "Previous offer", rerolledAway: "Rerolled away", finalOffer: "Final offer", offer: "Offer", daoYunChoices: "Daoist Rhyme Omens", chosen: "Chosen",
  };
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
  const cardAsset = (id) => {
    const artId = Number(id) === 27 ? 347 : id;
    return assetMode === "local" ? `card-images/${artId}_${language}.png` : `/yxp_wiki/assets/cards/${artId}_${language}.png`;
  };
  const characterAsset = (id, kind) => assetMode === "local" ? `character-images/${id}-${kind}.png` : `/yxp_wiki/assets/characters/${id}-${kind}.png`;
  const fateAsset = (entry, kind) => {
    if (assetMode === "local") return `fate-icons/${kind === "talent" ? `Icon_Talent_${entry.iconId || entry.id}.png` : entry.iconFile || `Icon_FateStrategy_${entry.id}.png`}`;
    return `/yxp_wiki/assets/fates/${kind === "talent" ? `Icon_Talent_${entry.iconId || entry.id}.png` : entry.iconFile || `Icon_FateStrategy_${entry.id}.png`}`;
  };
  const numericPrefix = (value) => Number.parseInt(String(value ?? "0"), 10) || 0;
  const localizedPair = (pair, fallback = "") => pair ? pair[isChinese ? 1 : 0] : fallback;
  const localizedInfo = (info, field = "name") => info?.[`${field}${isChinese ? "Chinese" : "English"}`]
    || info?.[`${field}${isChinese ? "English" : "Chinese"}`] || "";
  const phaseName = (value) => localizedPair(vocabulary.phases[numericPrefix(value)], String(value ?? copy.unknownPhase));
  const sectName = (value) => localizedPair(vocabulary.sects[numericPrefix(value)], String(value ?? ""));
  const careerName = (value) => localizedPair(vocabulary.careers[numericPrefix(value)], String(value ?? copy.noSideJob));
  const characterName = (player) => {
    const info = recording.catalog.characters[player?.characterId];
    if (!info) return player?.character || "Unknown character";
    return localizedInfo(info);
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

  function card(id, zeroAsNormalAttack = false) {
    if (!id && !zeroAsNormalAttack) return `<div class="empty-slot" title="${esc(copy.emptySlot)}"></div>`;
    const cardId = id || 0;
    const info = recording.catalog.cards[cardId] ?? (cardId === 0
      ? { id: 0, nameEnglish: "Normal Attack", nameChinese: "普通攻击", upgrade: 1 }
      : { id: cardId, nameEnglish: `Card ${cardId}`, nameChinese: `卡牌 ${cardId}`, upgrade: 1 });
    const name = localizedInfo(info) || `${copy.unknownCard} ${cardId}`;
    return `<div class="game-card" title="${esc(name)}">
      <span class="card-fallback"><strong>${esc(name)}</strong><small>ID ${esc(cardId)}</small></span>
      <img data-asset-fallback src="${cardAsset(cardId)}" alt="${esc(name)}">
    </div>`;
  }

  function offerHistory(history, kind) {
    if (!history?.offers?.length) return "";
    const final = history.offers.at(-1);
    const rows = kind === "fateStrategy"
      ? history.offers.slice(0, -1).flatMap((offer, offerIndex) => {
        const remaining = [...history.offers[offerIndex + 1]];
        return offer.filter((id) => {
          const retainedIndex = remaining.indexOf(id);
          if (retainedIndex < 0) return true;
          remaining.splice(retainedIndex, 1);
          return false;
        }).map((id) => ({ offer: [id], label: copy.rerolledAway, previous: true }));
      }).concat([{ offer: final, label: copy.finalOffer, previous: false }])
      : kind === "card"
        ? [{ offer: final, label: copy.offer, previous: false }]
        : history.offers.map((offer, offerIndex) => ({
          offer: offerIndex === history.offers.length - 1 ? offer : offer.slice(1),
          label: offerIndex === history.offers.length - 1 ? copy.finalOffer : copy.previousOffer,
          previous: offerIndex !== history.offers.length - 1,
        }));
    return `<div class="offer-history">${rows.map((row) => {
      const icons = row.offer.map((id) => {
        const info = kind === "card" ? recording.catalog.cards[id]
          : kind === "talent" ? recording.catalog.talents[id]
            : recording.catalog.fateStrategies[id];
        const source = kind === "card" ? cardAsset(id) : fateAsset(info ?? { id }, kind);
        const selected = !row.previous && Number(id) === Number(history.selected);
        return `<span class="offer-icon${selected ? " selected" : ""}" title="${esc(localizedInfo(info) || id)}"><img data-asset-fallback src="${source}" alt="${esc(localizedInfo(info) || id)}"></span>`;
      }).join("");
      return `<div class="offer-row${row.previous ? " previous" : " final"}"><small>${esc(row.label)}</small><div>${icons}</div></div>`;
    }).join("")}</div>`;
  }

  function trait(reference, kind) {
    const info = kind === "talent" ? recording.catalog.talents[reference.id] : recording.catalog.fateStrategies[reference.id];
    if (!info) return "";
    const runtime = reference.runtime;
    const badge = runtime ? `<span class="trait-count">${runtime.kind === "cooldown" ? "CD " : ""}${esc(runtime.value)}</span>` : "";
    const name = localizedInfo(info);
    const localizedDescription = localizedInfo(info, "description");
    return `<div class="trait-icon ${kind === "talent" ? "talent" : "heavenly-fate"}${reference.locked ? " locked" : ""}" tabindex="0"><img data-asset-fallback src="${fateAsset(info, kind)}" alt="${esc(name)}">${badge}<div class="trait-popover"><strong>${esc(name)}</strong>${localizedDescription ? `<p>${esc(localizedDescription)}</p>` : ""}${offerHistory(reference.choiceHistory, kind)}</div></div>`;
  }

  function daoYunChoice(choice) {
    const info = recording.catalog.cards[choice.selected] ?? {};
    const name = localizedInfo(info) || choice.selected;
    return `<div class="dao-yun-choice" tabindex="0"><span class="dao-round">${copy.round}${esc(choice.roundOrPhase)}${copy.roundSuffix}</span><span class="dao-pentagon"><img data-asset-fallback src="${cardAsset(choice.selected)}" alt="${esc(name)}"></span><div class="trait-popover"><strong>${esc(name)}</strong><p>${esc(copy.chosen)} · ${copy.round}${esc(choice.roundOrPhase)}${copy.roundSuffix}</p>${offerHistory(choice, "card")}</div></div>`;
  }

  function playerPortrait(player, state) {
    const own = state.players[state.targetUid];
    const upcoming = own?.nextOpponent === player.uid;
    return `<button class="player-portrait ${selectedUid === player.uid ? "selected" : ""} ${player.settled ? "settled" : ""}" data-uid="${esc(player.uid)}" title="${esc(copy.inspect)}: ${esc(player.username)}">
      <span class="avatar-wrap"><img class="avatar" src="${characterAsset(player.characterId, "avatar")}" alt=""><span class="life-gem"><span>${esc(player.life)}</span></span>${upcoming ? `<span class="opponent-badge" title="${esc(copy.upcomingOpponent)}">⚔</span>` : ""}</span>
      <span class="name">${esc(player.username)}</span><span class="character-name">${esc(characterName(player))}</span>
    </button>`;
  }

  function renderCharacter(player, traits, state, priorRound) {
    const privatePlayer = state.privatePlayer;
    const talents = (traits.talents ?? []).map((value) => trait(value, "talent")).join("");
    const fates = (traits.fates ?? []).map((value) => trait(value, "fateStrategy")).join("");
    const daoYunChoices = player.uid === state.targetUid
      ? (privatePlayer?.daoYunChoices ?? []).map(daoYunChoice).join("")
      : "";
    $("#character-panel").innerHTML = `<div class="trait-panel">
        <div class="trait-group"><span class="trait-heading">${esc(copy.immortalFates)}</span><div class="trait-row">${talents || `<span class="trait-empty">${esc(copy.noneVisible)}</span>`}</div></div>
        <div class="trait-group"><span class="trait-heading">${esc(copy.heavenlyDerivation)}</span><div class="trait-row">${fates || `<span class="trait-empty">${esc(copy.noneVisible)}</span>`}</div></div>
        ${player.uid === state.targetUid ? `<div class="trait-group dao-yun-group"><span class="trait-heading">${esc(copy.daoYunChoices)}</span><div class="trait-row dao-yun-row">${daoYunChoices || `<span class="trait-empty">${esc(copy.noneVisible)}</span>`}</div></div>` : ""}
      </div>
      <img class="character-art" src="${characterAsset(player.characterId, "portrait")}" alt="${esc(characterName(player))}">
      <div class="character-stats"><strong>${esc(player.username)}</strong><span>${esc(characterName(player))}</span><span>${esc(phaseName(priorRound?.phase ?? player.phase))}</span><span>${esc(sectName(player.sect))}${numericPrefix(player.career) ? ` · ${esc(careerName(player.career))}` : ""}</span><span>${esc(priorRound?.cultivation ?? player.cultivation)} ${esc(copy.cultivation)} · ${esc(player.life)} ${esc(copy.destiny)}</span></div>`;
  }

  function renderChoice(overlay) {
    const host = $("#selection-overlay");
    if (!overlay) { host.hidden = true; host.innerHTML = ""; return; }
    const canReroll = overlay.kind === "heavenly-derivation" && overlay.rerollsRemaining > 0;
    const options = overlay.options.map((reference, optionIndex) => {
      if (overlay.kind === "daoist-rhyme") {
        const info = recording.catalog.cards[reference.id] ?? {};
        return `<article class="selection-option card-choice"><div class="selection-icon"><img data-asset-fallback src="${cardAsset(reference.id)}" alt=""></div><strong>${esc(localizedInfo(info) || reference.id)}</strong></article>`;
      }
      const kind = overlay.kind === "immortal-fate" ? "talent" : "fateStrategy";
      const info = kind === "talent" ? recording.catalog.talents[reference.id] : recording.catalog.fateStrategies[reference.id];
      return `<article class="selection-option"><div class="selection-icon"><img data-asset-fallback src="${fateAsset(info, kind)}" alt=""></div>${canReroll ? `<span class="reroll-slot">↻ <small>${optionIndex + 1}</small></span>` : ""}<strong>${esc(localizedInfo(info) || reference.id)}</strong><p>${esc(localizedInfo(info, "description"))}</p></article>`;
    }).join("");
    const title = overlay.kind === "heavenly-derivation"
      ? copy.selectHdf
      : overlay.kind === "immortal-fate"
        ? copy.selectTalent
        : copy.selectDaoYun;
    const roundOrPhase = overlay.kind === "heavenly-derivation" || overlay.kind === "daoist-rhyme"
      ? `${copy.round}${esc(overlay.roundOrPhase)}${copy.roundSuffix}`
      : `${esc(phaseName(overlay.roundOrPhase))}`;
    host.dataset.kind = overlay.kind;
    host.innerHTML = `<div class="selection-frame" style="--choice-count:${overlay.options.length}">
      <div class="selection-heading"><span class="selection-context">${roundOrPhase}</span><h2>${esc(title)}</h2><span class="selection-hide">◒ ${esc(copy.hide)}</span></div>
      <div class="selection-options">${options}</div>
      <div class="selection-actions">${overlay.kind === "heavenly-derivation" ? `<span class="reroll-bank">↻ ${esc(overlay.rerollsRemaining)} ${esc(copy.rerollsRemaining)}</span>` : ""}<span class="recording-pending">${esc(copy.choicePending)}</span></div>
    </div>`;
    host.hidden = false;
  }

  function recentActions() {
    return recording.steps.slice(0, index + 1)
      .flatMap((step, stepIndex) => (step.humanActions ?? []).map((action) => ({ ...action, current: stepIndex === index })))
      .slice(-5);
  }

  const actionText = (action) => action[isChinese ? "textChinese" : "textEnglish"] || action.text || "";

  function renderActions() {
    const actions = recentActions();
    $("#action-list").innerHTML = actions.length
      ? actions.map((action) => `<li class="${action.current ? "current" : ""}"><span class="action-kind">${esc(copy.actionKinds[action.kind] || action.kind)}</span>${esc(actionText(action))}</li>`).join("")
      : `<li class="empty">${esc(copy.noActions)}</li>`;
  }

  function render() {
    const state = states[index];
    if (!state) return;
    const privatePlayer = state.privatePlayer;
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
    $("#round-marker").textContent = `${copy.round}${state.round || "—"}${copy.roundSuffix}`;
    $("#view-caption").textContent = isOwn
      ? `${copy.currentView} · ${selected?.username || recording.targetUsername}`
      : `${selected?.username} · ${copy.previousView}`;
    $("#deck-label").textContent = isOwn ? copy.deck : copy.previousDeck;
    $("#deck").innerHTML = deck.map((id) => card(id, !isOwn)).join("") || `<span class="private-hand">${esc(copy.noDeck)}</span>`;
    $("#hand-label").textContent = isOwn ? `${copy.hand} · ${hand?.length ?? 0}` : copy.hand;
    $("#hand").innerHTML = hand ? hand.map(card).join("") : `<span class="private-hand">${esc(copy.hiddenHand)}</span>`;
    const exchangeCounter = $("#exchange-counter");
    exchangeCounter.hidden = !isOwn;
    const exchangeLimit = Number(privatePlayer?.exchangeLimit);
    exchangeCounter.textContent = isOwn
      ? `${privatePlayer?.exchangesRemaining ?? "—"}${Number.isFinite(exchangeLimit) && exchangeLimit > 0 ? `/${exchangeLimit}` : ""}`
      : "";
    exchangeCounter.title = copy.exchangeChance;
    renderCharacter(selected, traits, state, prior);
    renderChoice(isOwn ? state.privatePlayer?.choiceOverlay : null);
    renderActions();

    timeline.value = index;
    previous.disabled = index === 0;
    next.disabled = index === recording.steps.length - 1;
    $("#step-label").textContent = `${index + 1} / ${recording.steps.length}`;
    $("#recording-meta").textContent = `${copy.recordingRoom} ${recording.roomId} · ${recording.targetUsername}`;
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
    roundSelect.innerHTML = `<option value="">${esc(copy.jumpRound)}</option>` + [...firstByRound].map(([round, stateIndex]) => `<option value="${stateIndex}">${copy.round}${round}${copy.roundSuffix}</option>`).join("");
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
    script.src = `${recordingBase}/${item.file}${recordingVersion ? `?v=${encodeURIComponent(recordingVersion)}` : ""}`;
    script.onload = () => installRecording(window.REPLAY_RECORDING);
    script.onerror = () => { $("#loading").textContent = `${copy.couldNotLoad} ${item.file}`; };
    document.body.appendChild(script);
  }

  const recordingLabel = (item) => {
    if (!item.targetUsername || !item.rounds) return item.label;
    const parts = [item.targetUsername, `${item.rounds} ${copy.rounds}`];
    if (Number.isFinite(item.startingRating) && item.startingRating > 0) parts.push(`${item.startingRating} ${copy.rating}`);
    if (numericPrefix(item.career) > 0) parts.push(careerName(item.career));
    parts.push(item.roomId || item.id);
    return parts.join(" · ");
  };
  select.innerHTML = catalog.map((item) => `<option value="${esc(item.id)}">${esc(recordingLabel(item))}</option>`).join("");
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
  else $("#loading").textContent = copy.noRecordings;
})();
